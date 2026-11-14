// Buylist -> Buy from a TCGplayer Quicklist: node tests/mtg_quicklist.js
// Reads tests/data/quicklist_sample.pdf (the owner's 17-line test order, 2026-11-13). pdf.js comes from
// npm (npm pack pdfjs-dist@3.11.174 into $PDFJS_DIR, default /tmp/claude-0/pdfjs/package/build), because
// the test machine can't reach the CDN the live page uses.
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'MTG_Lookup_Tool.html');
const PDF = path.resolve(__dirname, 'data', 'quicklist_sample.pdf');
const PDFJS = process.env.PDFJS_DIR || '/tmp/claude-0/pdfjs/package/build';
if (!fs.existsSync(path.join(PDFJS, 'pdf.min.js'))) { // fetch the same pdf.js the page loads, from npm
  const dir = path.dirname(path.dirname(PDFJS)); fs.mkdirSync(dir, { recursive: true });
  execSync('npm pack pdfjs-dist@3.11.174 --silent && tar xzf pdfjs-dist-3.11.174.tgz', { cwd: dir, stdio: 'ignore' });
}
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const EXPECT = [ // name, set, cond, printing, qty, #, market, low
  ['Forsaken Crossroads', 'Mystery Booster 2', 'NM', 'Foil', 1, 1, 23.45, 20.89],
  ['Spell Swindle', 'Ixalan', 'LP', 'Foil', 1, 10, 3.17, 3.17],
  ['Venom, King in Black - Skithiryx, the Blight Dragon (Borderless)', 'Marvel Universe Eternal-Legal', 'NM', 'Normal', 1, 16, 10.49, 9.97],
  ['Consecrated Sphinx (Retro Frame)', 'MagicFest Cards', 'NM', 'Foil', 1, 17, 28.16, 28.48],
];
// Lower of Market and Low Price per line, summed: the expected value total.
const LOWER = [20.89, 9.68, 10.08, 5.34, 4.00, 3.90, 27.53, 30.25, 27.53, 3.17, 2.86, 25.97, 10.30, 8.44, 8.84, 9.97, 28.16];
const VALUE = Math.round(LOWER.reduce((a, b) => a + b, 0) * 100) / 100;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const texts = {};
  try { texts.layout = execSync(`pdftotext -layout "${PDF}" -`).toString(); texts.plain = execSync(`pdftotext "${PDF}" -`).toString(); } catch (e) { console.log('(pdftotext missing: paste checks skipped)'); }
  for (const w of [1280, 360]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.route(/pdf(\.worker)?\.min\.js$/, r => { const f = path.join(PDFJS, r.request().url().endsWith('pdf.worker.min.js') ? 'pdf.worker.min.js' : 'pdf.min.js'); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const dialogs = [];
    p.on('dialog', d => { dialogs.push(d.message()); d.type() === 'prompt' ? d.accept(d.message().startsWith('Seller') ? 'Jane Seller' : 'Sam Staff') : d.accept(); });
    await p.goto(URL + '#buylist'); await p.waitForTimeout(1200);
    await p.evaluate(() => { localStorage.removeItem('qlBuyV1'); });
    await p.reload(); await p.waitForTimeout(1000);
    ok(await p.locator('#qlBuy').isVisible(), `${w}: Quicklist section shows on the Buylist tab`);
    ok(await p.evaluate(() => /quicklist/i.test(APP_VIEWS.buylist.desc)), `${w}: Buylist menu description mentions the Quicklist`);
    const qj = await p.evaluate(() => searchQuickJump('quicklist').map(e => e.label));
    ok(qj[0] === 'Buy from a TCGplayer Quicklist', `${w}: quick jump finds it (${qj.join(', ')})`);
    await p.evaluate(() => navigateTo('podcast')); await p.waitForTimeout(300);
    await p.evaluate(() => { const r = searchQuickJump('quicklist'); r[0].go(); }); await p.waitForTimeout(900);
    ok(await p.locator('#buylistApp').isVisible() && await p.evaluate(() => { const r = document.getElementById('qlBuy').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), `${w}: quick jump opens Buylist at the Quicklist section`);
    await p.setInputFiles('#qlbFile', PDF);
    await p.waitForFunction(() => document.querySelectorAll('#qlbBody tbody tr').length > 0, null, { timeout: 15000 }).catch(() => {});
    const rows = await p.evaluate(() => QLB.rows);
    ok(rows.length === 17, `${w}: PDF read: 17 lines (got ${rows.length}) ${await p.textContent('#qlbStatus')}`);
    for (const [name, set, cond, pr, qty, num, mk, low] of EXPECT) {
      const r = rows.find(r => r.num === num) || {};
      ok(r.name === name && r.set === set && r.cond === cond && r.printing === pr && r.qty === qty && r.market === mk && r.low === low && r.lang === 'EN', `${w}: line ${num} read in full (${JSON.stringify(r)})`);
    }
    ok(await p.evaluate(() => QLB.meta.printed) === '11/13/2026 18:56', `${w}: printed date kept`);
    const t = await p.evaluate(() => qlbTotals());
    ok(t.value === VALUE, `${w}: value uses the lower of Market and Low (${t.value} vs ${VALUE})`);
    ok(Math.abs(t.cash - VALUE / 2) < 0.1, `${w}: 50% by default (${t.cash})`);
    // Per-card %: Sensei's Top #7 at 70%.
    const idx = rows.findIndex(r => r.num === 7);
    await p.locator(`#qlbRow-${idx} input.buylist-pct`).fill('70');
    const t2 = await p.evaluate(() => qlbTotals());
    ok(Math.abs(t2.cash - t.cash - 27.53 * 0.2) < 0.02, `${w}: one card's own % changes only that card (${t.cash} -> ${t2.cash})`);
    ok(await p.locator(`#qlbRow-${idx}`).evaluate(e => e.classList.contains('buylist-own-rate')), `${w}: row with its own % is highlighted`);
    ok((await p.textContent(`#qlbCash-${idx}`)) === '$19.27', `${w}: row cash updates ($19.27)`);
    // Global % to 50 -> credit bump 10
    await p.fill('#qlbBumpPct', '10'); await p.dispatchEvent('#qlbBumpPct', 'change');
    const t3 = await p.evaluate(() => qlbTotals());
    ok(Math.abs(t3.credit - t3.cash * 1.1) < 0.1, `${w}: store credit bump applies`);
    ok(await p.locator('#qlbSeller').evaluate(e => e === document.activeElement || e.placeholder.length > 0), `${w}: seller name field ready`);
    // Payment: none picked -> print refuses after asking for the name
    await p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await p.click('text=🖨️ Print buy slip'); await p.waitForTimeout(300);
    ok(dialogs.some(d => d.startsWith('Seller')), `${w}: printing asks for the seller's name`);
    ok(await p.evaluate(() => QLB.seller) === 'Jane Seller', `${w}: seller name saved`);
    ok(!(await p.evaluate(() => window.__printed)), `${w}: no print until a payment type is picked`);
    await p.check('input[name="qlbPayType"][value="cash"]');
    await p.click('text=🖨️ Print buy slip'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__printed) === 1, `${w}: prints once payment is picked`);
    const slip = await p.evaluate(() => { const a = document.getElementById('qlbPrintArea'); return a ? a.innerText : ''; });
    ok(/Buy Slip/.test(slip) && /Jane Seller/.test(slip) && /Sam Staff/.test(slip) && /Seller signature/.test(slip) && /Employee signature/.test(slip), `${w}: slip has seller, employee and signature lines`);
    ok(/Consecrated Sphinx/.test(slip) && /MagicFest Cards/.test(slip) && /11\/13\/2026 18:56/.test(slip) && /Market/.test(slip) && /Low/.test(slip), `${w}: slip lists every column and the printout date`);
    ok(await p.evaluate(() => document.querySelectorAll('#qlbPrintArea img').length) === 0, `${w}: no card pictures on the slip`);
    ok(/Amount to be paid/.test(slip), `${w}: slip shows the amount due`);
    ok(!/Market total|Low Price total/.test(slip) && !/Market total|Low Price total/.test(await p.innerText('#qlBuy')), `${w}: no Market or Low Price totals on the slip or screen`);
    ok(!/lower of/i.test(slip), `${w}: slip doesn't explain the lower-of-two rule`);
    ok(!slip.includes('$251.54') && !slip.includes('$237.61'), `${w}: slip doesn't show the summed Market / Low amounts`);
    await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
    // Over $1,000: cash defaults to digital; store credit can be added
    const box = k => `input[name="qlbPayType"][value="${k}"]`;
    const ticked = () => p.evaluate(() => [...document.querySelectorAll('input[name="qlbPayType"]')].filter(x => x.checked).map(x => x.value).join('+'));
    ok(await p.evaluate(() => [...document.querySelectorAll('input[name="qlbPayType"]')].every(x => x.type === 'checkbox')), `${w}: payment methods are checkboxes`);
    await p.fill('#qlbCashPct', '600'); await p.dispatchEvent('#qlbCashPct', 'change');
    ok(await p.evaluate(() => qlbPay()) === 'digital' && await ticked() === 'digital', `${w}: cash over $1,000 defaults to digital payment (${await ticked()})`);
    ok(/defaults to a digital payment/.test(await p.textContent('#qlbPayInfo')), `${w}: note says so`);
    await p.check(box('credit')); await p.waitForTimeout(100);
    ok(await p.evaluate(() => qlbPay()) === 'split' && await ticked() === 'credit+digital', `${w}: store credit + digital can be ticked together (${await ticked()})`);
    await p.uncheck(box('digital')); await p.waitForTimeout(100);
    ok(await p.evaluate(() => qlbPay()) === 'credit' && await ticked() === 'credit', `${w}: store credit alone`);
    await p.uncheck(box('credit')); await p.check(box('cash')); await p.waitForTimeout(100);
    ok(dialogs.some(d => /Pay it in cash anyway/.test(d)) && await p.evaluate(() => qlbPay()) === 'cash', `${w}: cash over $1,000 only after staff confirm`);
    await p.check(box('digital')); await p.waitForTimeout(100);
    ok(await ticked() === 'digital', `${w}: ticking digital unticks cash (they can't be combined)`);
    // Split: store credit + cash, the employee types the cash part
    await p.fill('#qlbCashPct', '50'); await p.dispatchEvent('#qlbCashPct', 'change');
    await p.uncheck(box('digital')); await p.check(box('credit')); await p.check(box('cash')); await p.waitForTimeout(100);
    ok(await ticked() === 'credit+cash' && await p.evaluate(() => qlbPay()) === 'split', `${w}: store credit + cash makes a split (${await ticked()})`);
    ok(await p.locator('#qlbSplitCash').isVisible(), `${w}: split shows a cash-part box`);
    const tS = await p.evaluate(() => qlbTotals());
    await p.locator('#qlbSplitCash').fill('50');
    const sp = await p.evaluate(() => qlbSplit());
    ok(sp.cash === 50 && Math.abs(sp.credit - (tS.cash - 50) * 1.1) < 0.02, `${w}: split: $50 cash, the rest as credit with the bump (${sp.credit})`);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'qlbSplitCash'), `${w}: typing the cash part keeps focus`);
    ok((await p.textContent('#qlbSplitCredit')) === '$' + sp.credit.toFixed(2), `${w}: credit part updates as you type`);
    ok(/\$50\.00.*cash.*store credit/.test(await p.textContent('#qlbPayInfo')), `${w}: amount due shows both parts`);
    await p.locator('#qlbSplitCash').fill('99999');
    ok(await p.evaluate(() => qlbSplit().cash) === tS.cash, `${w}: cash part is capped at the whole cash offer`);
    await p.fill('#qlbCashPct', '1000'); await p.dispatchEvent('#qlbCashPct', 'change');
    await p.locator('#qlbSplitCash').fill('1500');
    ok(await p.evaluate(() => qlbSplit().how) === 'digital' && await ticked() === 'credit+digital', `${w}: split cash part over $1,000 defaults to digital`);
    await p.fill('#qlbCashPct', '50'); await p.dispatchEvent('#qlbCashPct', 'change');
    await p.locator('#qlbSplitCash').fill('40');
    await p.evaluate(() => { window.__printed = 0; });
    await p.locator('#qlbBody button', { hasText: 'Print buy slip' }).click(); await p.waitForTimeout(400);
    const slipS = await p.evaluate(() => { const a = document.getElementById('qlbPrintArea'); return a ? a.innerText : ''; });
    ok(/\$40\.00/.test(slipS) && /Store credit/.test(slipS) && /Cash/.test(slipS) && await p.evaluate(() => document.querySelectorAll('#qlbPrintArea .qbp-check.on').length) === 2, `${w}: split slip shows the cash part, the credit part and two ticks`);
    await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
    await p.uncheck(box('credit')); await p.waitForTimeout(100);
    // Reload keeps it
    await p.reload(); await p.waitForTimeout(1000);
    ok(await p.locator('#qlbBody tbody tr').count() === 17 && await p.inputValue('#qlbSeller') === 'Jane Seller', `${w}: saved across reload`);
    // Items added by hand (sealed product)
    await p.evaluate(() => { document.getElementById('qlbAddBox').open = true; });
    await p.fill('#qlbcName', 'Bloomburrow Play Booster Box'); await p.fill('#qlbcQty', '2'); await p.fill('#qlbcPrice', '100');
    await p.locator('#qlbAddBox button', { hasText: 'Add to the buy' }).click(); await p.waitForTimeout(200);
    let cr = await p.evaluate(() => QLB.rows.filter(r => r.custom));
    ok(cr.length === 1 && cr[0].qty === 2 && cr[0].price === 100 && cr[0].set === 'Sealed product' && cr[0].cond === 'Sealed', `${w}: custom sealed item added (${JSON.stringify(cr[0])})`);
    const ci = await p.evaluate(() => QLB.rows.findIndex(r => r.custom));
    ok(await p.locator(`#qlbRow-${ci}.qlb-custom`).count() === 1 && /added by hand/.test(await p.innerText(`#qlbRow-${ci}`)), `${w}: custom row shows in the list`);
    ok((await p.textContent(`#qlbCash-${ci}`)) === '$100.00', `${w}: 2 x $100 at 50% = $100 cash (${await p.textContent(`#qlbCash-${ci}`)})`);
    await p.locator(`#qlbRow-${ci} input.qlb-mini-price`).fill('120'); await p.dispatchEvent(`#qlbRow-${ci} input.qlb-mini-price`, 'change');
    ok((await p.textContent(`#qlbCash-${ci}`)) === '$120.00', `${w}: editing the value updates the row`);
    await p.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; QLB.pay = 'cash'; qlbSave(); });
    await p.locator('#qlbBody button', { hasText: 'Print buy slip' }).click(); await p.waitForTimeout(400);
    const slipC = await p.evaluate(() => { const a = document.getElementById('qlbPrintArea'); return a ? a.innerText : ''; });
    ok(await p.evaluate(() => [...document.querySelectorAll('#qlbPrintArea .qbp-items .used')].some(e => e.textContent === '$120.00')), `${w}: custom item's value is bold on the slip`);
    ok(await p.evaluate(i => getComputedStyle(document.querySelector(`#qlbRow-${i} input.qlb-mini-price`)).fontWeight >= 700, ci), `${w}: custom item's value is bold on screen`);
    ok(/Bloomburrow Play Booster Box/.test(slipC) && /Sealed product/.test(slipC) && /\$120\.00 each/.test(slipC), `${w}: custom item on the slip`);
    await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
    // A buy with only hand-added items (no printout)
    await p.evaluate(() => { QLB.rows = []; QLB.meta = {}; qlbSave(); qlbRender(); });
    await p.fill('#qlbcName', 'Deck box'); await p.selectOption('#qlbcKind', 'Accessory'); await p.selectOption('#qlbcCond', ''); await p.fill('#qlbcPrice', '10');
    await p.locator('#qlbAddBox button', { hasText: 'Add to the buy' }).click(); await p.waitForTimeout(200);
    ok(await p.locator('#qlbBody tbody tr').count() === 1 && await p.locator('#qlbSeller').isVisible(), `${w}: a buy can be only hand-added items`);
    // Graded slab
    ok(!(await p.locator('#qlbcGrade').isVisible()), `${w}: slab fields hidden for other kinds`);
    await p.selectOption('#qlbcKind', 'Graded slab');
    ok(await p.locator('#qlbcGrade').isVisible() && await p.locator('#qlbcCert').isVisible() && !(await p.locator('#qlbcCond').isVisible()), `${w}: picking Graded slab shows the slab fields and hides condition`);
    await p.fill('#qlbcName', 'Lightning Bolt'); await p.fill('#qlbcPrice', '500');
    await p.locator('#qlbAddBox button', { hasText: 'Add to the buy' }).click(); await p.waitForTimeout(150);
    ok(await p.evaluate(() => QLB.rows.length) === 1 && /grade/i.test(await p.textContent('#qlbStatus')), `${w}: a slab with no grade is refused`);
    await p.selectOption('#qlbcGrader', 'PSA'); await p.fill('#qlbcGrade', '9'); await p.fill('#qlbcCert', '12345678'); await p.fill('#qlbcSet', 'Alpha 1993'); await p.fill('#qlbcSub', 'C9 E9 S9.5');
    await p.locator('#qlbAddBox button', { hasText: 'Add to the buy' }).click(); await p.waitForTimeout(200);
    const sl = await p.evaluate(() => QLB.rows.find(r => r.slab));
    ok(sl && sl.cond === 'PSA 9' && sl.set === 'Alpha 1993' && sl.slab.cert === '12345678' && sl.slab.sub === 'C9 E9 S9.5' && sl.price === 500, `${w}: slab saved (${JSON.stringify(sl)})`);
    const si = await p.evaluate(() => QLB.rows.findIndex(r => r.slab));
    const srow = await p.innerText(`#qlbRow-${si}`);
    ok(/graded slab/.test(srow) && /PSA 9/.test(srow) && /Cert #12345678/.test(srow) && /Subgrades C9 E9 S9\.5/.test(srow), `${w}: slab row shows grade, cert and subgrades`);
    ok(await p.inputValue('#qlbcGrade') === '' && await p.inputValue('#qlbcCert') === '', `${w}: slab fields cleared after adding`);
    await p.fill('#qlbSeller', 'Jane Seller'); await p.dispatchEvent('#qlbSeller', 'change');
    await p.locator('#qlbBody button', { hasText: 'Print buy slip' }).click(); await p.waitForTimeout(400);
    const slipG = await p.evaluate(() => { const a = document.getElementById('qlbPrintArea'); return a ? a.innerText : ''; });
    ok(/Lightning Bolt/.test(slipG) && /Graded slab · Cert #12345678 · Subgrades C9 E9 S9\.5/.test(slipG) && /PSA 9/.test(slipG) && /Alpha 1993/.test(slipG), `${w}: slab details on the slip`);
    await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
    await p.reload(); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !!(QLB.rows.find(r => r.slab) || {}).slab), `${w}: slab kept after reload`);
    await p.evaluate(() => { document.getElementById('qlbAddBox').open = true; });
    await p.selectOption('#qlbcKind', 'Sealed product');
    ok(!(await p.locator('#qlbcGrade').isVisible()) && await p.locator('#qlbcCond').isVisible(), `${w}: switching back hides the slab fields`);
    // Pasted text (layout and one cell per line)
    for (const k of Object.keys(texts)) {
      await p.evaluate(() => { QLB.rows = []; });
      await p.evaluate(txt => qlbLoadText(txt, 'pasted'), texts[k]); await p.waitForTimeout(200);
      const pr = await p.evaluate(() => QLB.rows);
      const v = pr.find(r => r.num === 16) || {};
      ok(pr.length === 17 && pr.every(r => r.market != null && r.low != null && r.set), `${w}: pasted ${k} text: 17 lines with set and both prices (${pr.length})`);
      ok(/Blight Dragon/.test(v.name || '') && v.set === 'Marvel Universe Eternal-Legal', `${w}: pasted ${k}: wrapped name joined (${v.name} | ${v.set})`);
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${w}: no sideways page scroll`);
    if (w === 360) await p.screenshot({ path: path.join(__dirname, '.out', 'quicklist-360.png'), fullPage: false });
    ok(errs.length === 0, `${w}: no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  // Print preview of the slip as a PDF, to look at
  const ctx = await b.newContext(); await ctx.route(/pdf(\.worker)?\.min\.js$/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PDFJS, r.request().url().endsWith('pdf.worker.min.js') ? 'pdf.worker.min.js' : 'pdf.min.js')) }));
  const p = await ctx.newPage(); await p.goto(URL + '#buylist'); await p.waitForTimeout(800);
  await p.setInputFiles('#qlbFile', PDF); await p.waitForFunction(() => QLB.rows.length === 17, null, { timeout: 15000 });
  await p.evaluate(() => { QLB.rows[6].pct = 70; });
  await p.evaluate(() => { QLB.rows.push({ custom: true, num: 'C1', qty: 1, name: 'Bloomburrow Play Booster Box', set: 'Sealed product', cond: 'Sealed', printing: '', lang: '', market: null, low: null, price: 105, pct: 60 }); QLB.rows.push({ custom: true, num: 'C2', qty: 1, name: 'Ragavan, Nimble Pilferer', kind: 'Graded slab', set: 'Modern Horizons 2 #138', cond: 'PSA 10', printing: '', lang: '', market: null, low: null, price: 240, pct: null, slab: { grader: 'PSA', grade: '10', cert: '98765432', sub: '' } }); });
  await p.evaluate(() => { QLB.seller = 'Jane Seller'; QLB.employee = 'Sam Staff'; QLB.pay = 'digital'; QLB.payDetail = 'PayPal @jane'; QLB.cashPct = 50; QLB.bumpPct = 20; const a = document.createElement('div'); a.id = 'qlbPrintArea'; a.innerHTML = qlbSlipHTML(qlbTotals(), 'digital'); document.body.appendChild(a); document.body.classList.add('qlb-printing'); });
  fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: path.join(__dirname, '.out', 'buy-slip.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: true });
  ok(fs.statSync(path.join(__dirname, '.out', 'buy-slip.pdf')).size > 5000, 'slip prints to a PDF');
  for (const [name, set] of [['buy-slip-split.pdf', "QLB.pay = 'split'; QLB.splitCash = 60; QLB.splitHow = 'cash';"], ['buy-slip-cash.pdf', "QLB.pay = 'cash';"]]) {
    await p.evaluate(code => { eval(code); const a = document.getElementById('qlbPrintArea'); a.innerHTML = qlbSlipHTML(qlbTotals(), qlbPay()); }, set);
    await p.pdf({ path: path.join(__dirname, '.out', name), format: 'Letter', preferCSSPageSize: true, printBackground: true });
  }
  await b.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
