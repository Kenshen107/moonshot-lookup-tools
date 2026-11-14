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
    // NM cards in the hotlist case: labelled on screen, and the first press of Print only reminds staff to check the case.
    const caseTags = await p.evaluate(() => [...document.querySelectorAll('#qlbBody .qlb-tag-case')].map(e => e.closest('tr').querySelector('.qlb-name').firstChild.textContent.trim() + ' = ' + e.textContent));
    ok(caseTags.length === 6 && caseTags.some(x => /Consecrated Sphinx.*S2R · 112/.test(x)) && caseTags.some(x => /Atraxa.*S3R · 210/.test(x)), `${w}: NM case-map cards are tagged with their spot (${caseTags.join('; ')})`);
    ok(!caseTags.some(x => /Spell Swindle/.test(x)), `${w}: non-case cards aren't tagged`);
    const nBefore = dialogs.length;
    await p.click('text=🖨️ Print buy slip'); await p.waitForTimeout(400);
    const caseMsg = dialogs.slice(nBefore).find(d => /hotlist case/.test(d)) || '';
    ok(caseMsg && /Consecrated Sphinx \(Retro Frame\): Shelf 2, right side, spot 112 \(Blue\)/.test(caseMsg) && /press Print again/.test(caseMsg), `${w}: first press pops up the case reminder with each card's spot (${caseMsg.slice(0, 120)})`);
    ok(!(await p.evaluate(() => window.__printed)), `${w}: the first press doesn't print`);
    ok(/Case checked/.test(await p.textContent('#qlbCaseNote')), `${w}: the note turns to "case checked"`);
    await p.click('text=🖨️ Print buy slip'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__printed) === 1, `${w}: prints once payment is picked (second press, after the case check)`);
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
  // Rounding: lines keep exact amounts, only the sums are rounded (half a cent rounds up)
  const rnd = await p.evaluate(() => {
    QLB.rows = []; QLB.cashPct = 50; QLB.bumpPct = 20;
    for (let i = 0; i < 3; i++) QLB.rows.push({ num: i + 1, qty: 1, name: 'R' + i, set: 'S', cond: 'NM', printing: 'Normal', lang: 'EN', market: 0.29, low: 0.35, pct: null });
    const a = qlbTotals();
    QLB.rows = [{ num: 1, qty: 1, name: 'B', set: 'S', cond: 'NM', printing: 'Normal', lang: 'EN', market: 2.01, low: 2.10, pct: null }];
    const b = qlbTotals();
    return { a, b, line: qlbLine(QLB.rows[0]) };
  });
  ok(rnd.a.cash === 0.44 && rnd.a.value === 0.87, `rounding: 3 x $0.29 at 50% = $0.435, rounded once to $0.44 (not 3 x $0.15) (${rnd.a.cash})`);
  ok(rnd.a.credit === 0.52, `rounding: credit 3 x $0.174 = $0.522, rounded once to $0.52 (${rnd.a.credit})`);
  ok(rnd.b.cash === 1.01 && rnd.b.credit === 1.21 && Math.abs(rnd.line.cash - 1.005) < 1e-9, `rounding: $2.01 x 50% stays $1.005 on the line, the sum rounds to $1.01, credit $1.206 to $1.21 (${rnd.b.cash}, ${rnd.b.credit})`);
  // The amount to be paid is whole dollars (50 cents and up rounds up); the totals stay to the cent
  const paid = await p.evaluate(() => {
    const row = v => ({ num: 1, qty: 1, name: 'X', set: 'S', cond: 'NM', printing: 'Normal', lang: 'EN', market: v, low: v, pct: null });
    const box = () => { const d = document.createElement('div'); d.innerHTML = qlbSlipHTML(qlbTotals(), qlbPay()); return [...d.querySelectorAll('.qbp-payline')].map(e => e.textContent.replace(/\s+/g, '')); };
    QLB.cashPct = 50; QLB.bumpPct = 25; QLB.cashOk = false;
    QLB.rows = [row(106.76)]; QLB.pay = 'cash'; const a = box(), at = qlbTotals();
    QLB.pay = 'credit'; const b = box();
    QLB.rows = [row(101)]; QLB.pay = 'cash'; const c = box();
    QLB.rows = [row(106.76)]; QLB.pay = 'split'; QLB.splitCash = 20.4; QLB.splitHow = 'cash'; const d = box();
    return { a, at: at.cash, b, c, d };
  });
  ok(paid.a[0] === 'Cash$53.00' && paid.at === 53.38, `paid: cash offer $53.38 is paid as $53 (${paid.a})`);
  ok(paid.b[0] === 'Storecredit$67.00', `paid: credit $66.73 is paid as $67 (${paid.b})`);
  ok(paid.c[0] === 'Cash$51.00', `paid: $50.50 rounds up to $51 (${paid.c})`);
  ok(paid.d.join('|') === 'Cash$20.00|Storecredit$41.00', `paid: split $20.40 cash + $41.22 credit pays $20 + $41 (${paid.d})`);
  // ---- Maybe items, the Working toward cart and Undo (2026-11-14) ----
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
  await p.evaluate(() => {
    const row = (n, name, v) => ({ num: n, qty: 1, name, set: 'S', cond: 'NM', printing: 'Normal', lang: 'EN', market: v, low: v, pct: null });
    QLB.rows = [row(1, 'Alpha Card', 10), row(2, 'Beta Card', 4), row(3, 'Gamma Card', 6)]; QLB.cart = []; QLB.cashPct = 50; QLB.bumpPct = 20;
    QLB.pay = 'credit'; QLB.seller = 'Jane Seller'; QLB_UNDO.length = 0; qlbSaveUndo(); qlbSave(); qlbRender();
  });
  const slipText = () => p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = qlbSlipHTML(qlbTotals(), qlbPay()); return d.textContent.replace(/\s+/g, ' '); });
  let st = await slipText();
  ok(!/Maybe items/.test(st) && !/Working toward/.test(st), 'slip: no Maybe or Working toward section when they are empty');
  ok(!(await p.locator('#qlbUndo button').count()), 'undo: no button before anything is deleted');
  // Undo a removal
  await p.locator('#qlbRow-1 .buylist-remove-btn').click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => QLB.rows.length === 2 && !QLB.rows.some(r => r.name === 'Beta Card')), 'remove: the row is gone (no confirm needed)');
  ok(/Undo: removed "Beta Card"/.test(await p.textContent('#qlbUndo')), 'undo: the button names what it brings back');
  await p.locator('#qlbUndo button').click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => QLB.rows.length === 3 && QLB.rows[1].name === 'Beta Card'), 'undo: the removed row is back in its place');
  // Maybe
  await p.locator('#qlbRow-2 .qlb-maybe-btn').click(); await p.waitForTimeout(150);
  const mb = await p.evaluate(() => ({ firm: qlbTotals(), all: qlbTotals('all'), maybe: qlbTotals('maybe'), tbl: !!document.querySelector('.qlb-maybe'), cmp: document.getElementById('qlbCompare').textContent.replace(/\s+/g, ' ') }));
  ok(mb.firm.value === 14 && mb.maybe.value === 6 && mb.all.value === 20 && mb.tbl, `maybe: Gamma moves out of the totals (${mb.firm.value} + ${mb.maybe.value})`);
  ok(/Without the maybe items Cash \$7\.00 · Store credit \$8\.40/.test(mb.cmp) && /With the maybe items Cash \$10\.00 · Store credit \$12\.00/.test(mb.cmp), `maybe: with and without shown (${mb.cmp})`);
  st = await slipText();
  ok(/Maybe items/.test(st) && /Gamma Card/.test(st) && /If the seller adds these/.test(st), 'slip: Maybe section prints');
  ok(/Store credit offer\s*\$8\.40\s*\$12\.00\s*\+\$3\.60/.test(st) && /To be paid: Store credit\s*\$8\.00\s*\$12\.00\s*\+\$4\.00/.test(st), `slip: was / would be amounts for the maybe items (${(st.match(/If the seller adds these.{0,160}/) || [''])[0]})`);
  ok(/What we're buying/.test(st) && /The offer/.test(st) && !/Gamma Card[^]*?The offer/.test(st), 'slip: numbered steps, and the maybe item is not in step 1');
  ok(/Storecredit\$8\.00/.test(st.replace(/ /g, '')), 'slip: the amount to be paid leaves the maybe item out ($8)');
  await p.uncheck('#qlbPrintMaybe'); await p.waitForTimeout(100);
  st = await slipText();
  ok(await p.evaluate(() => QLB.printMaybe === false) && !/Maybe items/.test(st) && !/Gamma Card/.test(st), 'maybe toggle: unticked, the Maybe section is left off the slip');
  await p.check('#qlbPrintMaybe'); await p.waitForTimeout(100);
  ok(/Maybe items/.test(await slipText()), 'maybe toggle: ticked again, it prints');
  await p.evaluate(() => { document.getElementById('qlbAddBox').open = true; });
  await p.fill('#qlbcName', 'Maybe Box'); await p.selectOption('#qlbcKind', 'Sealed product'); await p.fill('#qlbcPrice', '40'); await p.check('#qlbcMaybe');
  await p.locator('#qlbAddBox button', { hasText: 'Add to the buy' }).click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => { const r = QLB.rows.find(x => x.name === 'Maybe Box'); return r && r.maybe && qlbTotals().value === 14; }), 'maybe: an item added by hand with Maybe ticked stays out of the totals');
  // Cart
  await p.fill('#qlbkName', 'Sol Ring'); await p.selectOption('#qlbkKind', 'Single card'); await p.fill('#qlbkQty', '2'); await p.fill('#qlbkPrice', '10');
  ok(/\/search\?q=Sol%20Ring/.test(await p.getAttribute('#qlbkLook', 'href')), 'cart: the look-up link searches the store for the typed item');
  await p.locator('#qlbCart button', { hasText: 'Add to the cart' }).click(); await p.waitForTimeout(150);
  await p.fill('#qlbkName', 'Deck box'); await p.selectOption('#qlbkKind', 'Accessory'); await p.fill('#qlbkPrice', '5.50'); await p.press('#qlbkPrice', 'Enter'); await p.waitForTimeout(150);
  const ct = await p.evaluate(() => ({ t: qlbCartTotals(), sum: document.getElementById('qlbCartSum').textContent.replace(/\s+/g, ' ') }));
  ok(ct.t.sub === 25.5 && ct.t.tax === 1.79 && ct.t.total === 27.29, `cart: subtotal $25.50 + Indiana 7% $1.79 = $27.29 (${JSON.stringify(ct.t)})`);
  ok(/Indiana sales tax \(7%\)/.test(ct.sum) && /Still needed \$18\.89/.test(ct.sum) && /With the maybe items/.test(ct.sum), `cart: shows tax and what is still needed ($27.29 - $8.40 credit) (${ct.sum.slice(0, 200)})`);
  await p.locator('#qlbCart tbody tr').nth(0).locator('input.qlb-mini:not(.qlb-mini-price)').fill('1'); await p.dispatchEvent('#qlbCart tbody tr:nth-child(1) input.qlb-mini:not(.qlb-mini-price)', 'change'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => qlbCartTotals().sub === 15.5), 'cart: editing a quantity updates the totals');
  st = await slipText();
  ok(/Working toward/.test(st) && /Sol Ring/.test(st) && /Indiana sales tax \(7%\)/.test(st) && /Still needed/.test(st), 'slip: the cart prints when it has items');
  ok(await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = qlbSlipHTML(qlbTotals(), qlbPay()); const bars = d.querySelectorAll('.qbp-progress'); return bars.length === 2 && !bars[0].classList.contains('done') && bars[1].classList.contains('done'); }), 'slip: progress bars: this buy still short, with the maybe items covered');
  await p.locator('#qlbCart tbody tr').nth(0).locator('.buylist-remove-btn').click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => QLB.cart.length === 1), 'cart: an item can be removed');
  await p.locator('#qlbUndo button').click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => QLB.cart.length === 2 && QLB.cart[0].name === 'Sol Ring'), 'undo: a removed cart item comes back');
  // Start over can be undone
  p.once('dialog', d => d.accept());
  await p.locator('#qlbBody button', { hasText: 'Start over' }).click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !QLB.rows.length && !QLB.cart.length) && await p.locator('#qlbCart .qlb-cart').count() === 1, 'start over: buy and cart cleared, the cart section stays');
  await p.locator('#qlbUndo button').click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => QLB.rows.length === 4 && QLB.cart.length === 2), 'undo: Start over can be undone');
  ok(await p.evaluate(() => QLB_UNDO.length >= 1), 'undo: earlier steps are still there');
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => QLB.cart.length === 2 && QLB_UNDO.length >= 1) && await p.locator('#qlbUndo button').count() === 1, 'reload: cart and undo history are kept');
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '360: no sideways scroll with maybe and cart');
  await p.screenshot({ path: path.join(__dirname, '.out', 'quicklist-cart-360.png'), fullPage: false });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.evaluate(() => { const d = document.getElementById('qlbPrintArea') || document.createElement('div'); d.id = 'qlbPrintArea'; d.innerHTML = qlbSlipHTML(qlbTotals(), qlbPay()); document.body.appendChild(d); document.body.classList.add('qlb-printing'); });
  await p.emulateMedia({ media: 'print' }); await p.pdf({ path: path.join(__dirname, '.out', 'buy-slip-cart.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: true }); await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
  // Hotlist case only for NM, employee required, and quote mode
  await p.evaluate(() => { QLB.rows = []; QLB.cart = []; QLB.caseChecked = ''; QLB.quote = false; qlbSave(); qlbLoadText('Consecrated Sphinx  MagicFest Cards  LP  Foil  EN  1  1  $28.16  $28.48\nSpell Swindle  Ixalan  NM  Foil  EN  1  2  $3.17  $3.17', 'pasted'); QLB.seller = 'Jane Seller'; QLB.employee = ''; QLB.pay = 'cash'; qlbSave(); qlbRender(); window.__printed = 0; window.print = () => { window.__printed++; }; });
  ok(await p.locator('#qlbBody .qlb-tag-case').count() === 0 && await p.locator('#qlbCaseNote').count() === 0, 'case: an LP copy of a case card is not tagged or asked about');
  ok(await p.locator('#qlbEmployee').evaluate(e => e.parentElement.classList.contains('req')), 'employee: the field is marked required');
  p.removeAllListeners('dialog');
  const seen = []; p.on('dialog', d => { seen.push(d.message()); d.type() === 'prompt' ? d.dismiss() : d.accept(); });
  await p.click('text=🖨️ Print buy slip'); await p.waitForTimeout(300);
  ok(seen.some(m => /Employee name \(required/.test(m)) && !(await p.evaluate(() => window.__printed)), `employee: printing asks for the employee and Cancel stops the print (${seen.join(' | ')})`);
  ok(!seen.some(m => /hotlist case/.test(m)), 'case: no reminder when no NM case card is in the buy');
  p.removeAllListeners('dialog'); p.on('dialog', d => { seen.push(d.message()); d.type() === 'prompt' ? d.accept(/Employee/.test(d.message()) ? 'Sam Staff' : 'x') : d.accept(); });
  await p.click('text=🖨️ Print buy slip'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__printed === 1 && QLB.employee === 'Sam Staff'), 'employee: prints once the name is given');
  await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
  // Quote: NM case card, no seller, no payment, no employee
  await p.evaluate(() => { QLB.rows[0].cond = 'NM'; QLB.seller = ''; QLB.employee = ''; QLB.pay = ''; QLB.caseChecked = ''; qlbSave(); qlbRender(); });
  ok(await p.locator('#qlbBody .qlb-tag-case').count() === 1 && await p.locator('#qlbCaseNote').count() === 1, 'case: an NM copy is tagged and listed');
  await p.check('#qlbQuote'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => QLB.quote === true) && /Print quote/.test(await p.textContent('#qlbPrintBtn')) && await p.locator('#qlbCaseNote').count() === 0, 'quote: the toggle switches the button to "Print quote" and hides the case reminder');
  ok(!(await p.locator('#qlbSeller').evaluate(e => e.parentElement.classList.contains('req'))) && !(await p.locator('#qlbEmployee').evaluate(e => e.parentElement.classList.contains('req'))), 'quote: seller and employee are optional');
  const nSeen = seen.length;
  await p.click('text=🖨️ Print quote'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__printed === 2) && seen.length === nSeen, `quote: prints at once, with no prompts or case reminder (${seen.slice(nSeen).join(' | ')})`);
  const qs = await p.evaluate(() => document.getElementById('qlbPrintArea').innerText);
  ok(/Price Quote/.test(qs) && /Not a purchase/i.test(qs) && !/Buy Slip/.test(qs), 'quote: titled as a price quote');
  ok(!/signature/i.test(qs) && !/seller confirms/i.test(qs), 'quote: no signature lines or seller confirmation');
  ok(/not an offer to buy/i.test(qs) && /later visit may be subject to price changes/.test(qs) && /not a contract/.test(qs), 'quote: the reference-only notice is printed');
  ok(/Quoted amount/.test(qs) && /Cash/.test(qs) && /or Store credit/.test(qs), 'quote: with no payment picked, both the cash and the store credit amounts show');
  ok(/^Q\d{8}-\d{4}$/m.test(qs) || /Q\d{8}-\d{4}/.test(qs), 'quote: numbered as a quote (Q...)');
  await p.emulateMedia({ media: 'print' }); await p.pdf({ path: path.join(__dirname, '.out', 'price-quote.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: true }); await p.emulateMedia({ media: 'screen' });
  await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
  p.removeAllListeners('dialog'); p.on('dialog', d => d.accept());
  await p.locator('#qlbBody button', { hasText: 'Start over' }).click(); await p.waitForTimeout(150);
  ok(await p.evaluate(() => QLB.quote === false), 'quote: Start over goes back to a buy slip');
  // Print CSS: long sections may break, totals print once
  ok(await p.evaluate(() => [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /\.qbp-items tfoot/.test(r.cssText) && /table-row-group/.test(r.cssText)); } catch (e) { return false; } })), 'print: a table\'s totals row prints once, not on every page');
  // A Pokémon Quicklist: multi-word printings (Reverse Holofoil) and the DG condition
  await p.evaluate(() => { QLB.rows = []; qlbSave(); });
  await p.setInputFiles('#qlbFile', path.resolve(__dirname, 'data', 'quicklist_pokemon.pdf')); await p.waitForFunction(() => QLB.rows.length >= 14, null, { timeout: 15000 });
  const pk = await p.evaluate(() => QLB.rows.map(r => ({ num: r.num, name: r.name, set: r.set, cond: r.cond, printing: r.printing, market: r.market, low: r.low })));
  ok(pk.length === 14 && pk.every((r, i) => r.num === i + 1), `pokemon: 14 rows numbered 1-14 (${pk.length})`);
  ok(pk[0].name === 'Rattata' && pk[0].printing === 'Reverse Holofoil' && pk[0].cond === 'MP' && pk[0].set === 'EX FireRed & LeafGreen', `pokemon: Reverse Holofoil row read (${JSON.stringify(pk[0])})`);
  ok(pk[8].name === 'Dragonite EX' && pk[8].cond === 'DG' && pk[8].set === 'XY - Evolutions' && pk[8].low === 2.69, `pokemon: DG condition row read (${JSON.stringify(pk[8])})`);
  ok(pk[9].name === 'Plusle' && pk[3].name === 'Squirtle - 082/112', `pokemon: neighbours not merged`);
  await p.evaluate(() => { QLB.rows = []; qlbLoadText('Rattata  EX FireRed & LeafGreen  MP  Reverse Holofoil  EN  1  1  $19.98  $19.98\nDragonite EX  XY - Evolutions  DG  Holofoil  EN  1  9  $2.80  $2.69', 'pasted'); });
  ok(await p.evaluate(() => QLB.rows.length === 2 && QLB.rows[0].printing === 'Reverse Holofoil' && QLB.rows[1].cond === 'DG'), 'pokemon: pasted text with Reverse Holofoil and DG');
  await b.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
