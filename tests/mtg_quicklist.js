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
    ok(/Card Buy Slip/.test(slip) && /Jane Seller/.test(slip) && /Sam Staff/.test(slip) && /Seller signature/.test(slip) && /Employee signature/.test(slip), `${w}: slip has seller, employee and signature lines`);
    ok(/Consecrated Sphinx/.test(slip) && /MagicFest Cards/.test(slip) && /11\/13\/2026 18:56/.test(slip) && /Low Price/.test(slip), `${w}: slip lists every column and the printout date`);
    ok(await p.evaluate(() => document.querySelectorAll('#qlbPrintArea img').length) === 0, `${w}: no card pictures on the slip`);
    ok(/Amount to be paid/.test(slip), `${w}: slip shows the amount due`);
    ok(!/Market total|Low Price total/.test(slip) && !/Market total|Low Price total/.test(await p.innerText('#qlBuy')), `${w}: no Market or Low Price totals on the slip or screen`);
    ok(!/lower of/i.test(slip), `${w}: slip doesn't explain the lower-of-two rule`);
    ok(!slip.includes('$251.54') && !slip.includes('$237.61'), `${w}: slip doesn't show the summed Market / Low amounts`);
    await p.evaluate(() => { document.body.classList.remove('qlb-printing'); const a = document.getElementById('qlbPrintArea'); if (a) a.remove(); });
    // Over $1,000: cash defaults to digital; credit stays
    await p.fill('#qlbCashPct', '600'); await p.dispatchEvent('#qlbCashPct', 'change');
    ok(await p.evaluate(() => qlbPay()) === 'digital', `${w}: cash over $1,000 defaults to digital payment`);
    ok(/defaults to a digital payment/.test(await p.textContent('#qlbPayInfo')), `${w}: note says so`);
    await p.check('input[name="qlbPayType"][value="credit"]');
    ok(await p.evaluate(() => qlbPay()) === 'credit', `${w}: store credit is still allowed over $1,000`);
    await p.check('input[name="qlbPayType"][value="cash"]'); await p.waitForTimeout(100);
    ok(dialogs.some(d => /Pay it in cash anyway/.test(d)) && await p.evaluate(() => qlbPay()) === 'cash', `${w}: cash over $1,000 only after staff confirm`);
    // Reload keeps it
    await p.reload(); await p.waitForTimeout(1000);
    ok(await p.locator('#qlbBody tbody tr').count() === 17 && await p.inputValue('#qlbSeller') === 'Jane Seller', `${w}: saved across reload`);
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
  await p.evaluate(() => { QLB.seller = 'Jane Seller'; QLB.employee = 'Sam Staff'; QLB.pay = 'digital'; QLB.payDetail = 'PayPal @jane'; QLB.cashPct = 50; QLB.bumpPct = 20; const a = document.createElement('div'); a.id = 'qlbPrintArea'; a.innerHTML = qlbSlipHTML(qlbTotals(), 'digital'); document.body.appendChild(a); document.body.classList.add('qlb-printing'); });
  fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: path.join(__dirname, '.out', 'buy-slip.pdf'), format: 'Letter', preferCSSPageSize: true, printBackground: true });
  ok(fs.statSync(path.join(__dirname, '.out', 'buy-slip.pdf')).size > 5000, 'slip prints to a PDF');
  await b.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
