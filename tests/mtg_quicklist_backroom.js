// Buylist -> Quicklist: the backroom printout layout (# Game Set Product Name Condition Printing Qty. Low Price Market), 2026-11-17.
// node tests/mtg_quicklist_backroom.js   (sample: tests/data/quicklist_backroom.pdf, the owner's 81-line "buy 11" printout)
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'MTG_Lookup_Tool.html');
const PDF = path.resolve(__dirname, 'data', 'quicklist_backroom.pdf');
const PDFJS = process.env.PDFJS_DIR || '/tmp/claude-0/pdfjs/package/build';
if (!fs.existsSync(path.join(PDFJS, 'pdf.min.js'))) { const dir = path.dirname(path.dirname(PDFJS)); fs.mkdirSync(dir, { recursive: true }); execSync('npm pack pdfjs-dist@3.11.174 --silent && tar xzf pdfjs-dist-3.11.174.tgz', { cwd: dir, stdio: 'ignore' }); }
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const EXPECT = { // num: [name, set, printing, low, market]
  1: ['Tarmogoyf (Borderless)', 'Reality Fracture', 'Foil', 2.35, 3.61],
  18: ['Central Plexus Core - The Immortal Sun', 'Commander: Star Trek', 'Normal', 2.64, 2.83],
  44: ['Exploration', 'Commander: Star Trek', 'Normal', 11.56, 11.54],
  61: ['Flawless Maneuver', 'Commander: Phyrexia: All Will Be One', 'Normal', 11.98, 19.54],
  65: ["Niv-Mizzet, Ghost Counsel", 'Commander: Reality Fracture', 'Normal', null, 2.53],
  80: ['Cid, Timeless Artificer (0409)', 'FINAL FANTASY', 'Foil', 8.24, 8.33],
  81: ["Cloud, Planet's Champion (Costco Bundle)", 'Unique and Miscellaneous Promos', 'Foil', 1.89, 1.96],
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const layout = execSync(`pdftotext -layout "${PDF}" -`).toString();
  for (const w of [1280, 360]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.route(/pdf(\.worker)?\.min\.js$/, r => { const f = path.join(PDFJS, r.request().url().endsWith('pdf.worker.min.js') ? 'pdf.worker.min.js' : 'pdf.min.js'); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(URL + '#buylist'); await p.waitForTimeout(1200);
    await p.evaluate(() => localStorage.removeItem('qlBuyV1')); await p.reload(); await p.waitForTimeout(1000);
    await p.setInputFiles('#qlbFile', PDF);
    await p.waitForFunction(() => QLB.rows.length > 0, null, { timeout: 15000 }).catch(() => {});
    for (const [label, getRows] of [['PDF', async () => p.evaluate(() => QLB.rows)], ['pasted layout text', async () => { await p.evaluate(t => { QLB.rows = []; qlbLoadText(t, 'pasted'); }, layout); return p.evaluate(() => QLB.rows); }]]) {
      const rows = await getRows();
      ok(rows.length === 81, `${w} ${label}: 81 lines (got ${rows.length})`);
      ok(rows.every((r, i) => r.num === i + 1), `${w} ${label}: numbered 1 to 81 in order`);
      for (const [n, [name, set, pr, low, mk]] of Object.entries(EXPECT)) {
        const r = rows.find(r => r.num === +n) || {};
        ok(r.name === name && r.set === set && r.cond === 'NM' && r.printing === pr && r.qty === 1 && r.low === low && r.market === mk, `${w} ${label}: line ${n} (${JSON.stringify(r)})`);
      }
      ok(rows.filter(r => r.name === 'Avacyn, Angel of Horror').length === 4 && rows.every(r => !/^Magic\b/.test(r.set)), `${w} ${label}: game column dropped from sets`);
    }
    ok(await p.evaluate(() => QLB.meta.project) === 'buy 11', `${w}: project name kept`);
    const t = await p.evaluate(() => qlbTotals());
    ok(t.lines === 81 && t.value > 300 && !Number.isNaN(t.value), `${w}: totals work (value ${t.value})`);
    ok(await p.evaluate(() => { const r = QLB.rows[64]; return qlbUnit(r) === 2.53; }), `${w}: a line with no Low Price uses Market`);
    ok(errs.length === 0, `${w}: no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  await b.close(); console.log(`quicklist backroom: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
})();
