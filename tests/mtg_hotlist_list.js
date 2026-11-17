// Case Map -> "Print customer list" (2026-11-17): names only, by category, A to Z, no shelf or spot. node tests/mtg_hotlist_list.js
const path = require('path'), fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'MTG_Lookup_Tool.html');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '#casemap'); await p.waitForTimeout(1500);
  await p.evaluate(() => { window.print = () => {}; });
  ok(await p.evaluate(() => /printHotlistList/.test(document.body.innerHTML)), 'the button is on the Case Map tab');
  await p.evaluate(() => printHotlistList()); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const pages = [...document.querySelectorAll('#htPrintArea .ht-page')];
    const names = [...document.querySelectorAll('#htPrintArea .hl-card')].map(e => e.textContent);
    return { pages: pages.length, cards: names.length, names, text: document.getElementById('htPrintArea').textContent, cats: [...document.querySelectorAll('#htPrintArea .hl-cat')].map(e => e.textContent), over: pages.map(pg => pg.scrollHeight > pg.clientHeight + 1) };
  });
  const want = await p.evaluate(() => new Set(hotlistCards().map(c => c.name.trim().replace(/\s*\(\d{3,5}[a-z]?\)\s*$/i, '').toLowerCase())).size);
  ok(r.cards === want, `every different hotlist card is listed once (${r.cards} of ${want})`);
  ok(r.pages >= 2 && r.pages <= 4, `fits ${r.pages} pages`);
  ok(r.over.every(x => !x), 'no page overflows');
  ok(!/Shelf|spot|\bLeft\b|\bRight\b/.test(r.text), 'no shelf, side or spot on the customer list');
  ok(!/\(0468\)/.test(r.text) && r.names.some(n => /Rikku/.test(n)), 'printing numbers like (0468) are dropped');
  ok(r.cats.includes('Shock Lands') && r.cats.includes('Reserved List'), `categories shown (${r.cats.length} headings)`);
  ok(await p.evaluate(() => { const n = [...document.querySelectorAll('#htPrintArea .hl-cat')].find(e => e.textContent === 'Shock Lands'); const l = []; let e = n.nextElementSibling; while (e && e.classList.contains('hl-card')) { l.push(e.textContent); e = e.nextElementSibling; } return l.join('|') === [...l].sort((a, b) => a.localeCompare(b)).join('|') && l.length === 10; }), 'cards are A to Z inside a category');
  fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
  await p.pdf({ path: path.join(__dirname, '.out', 'hotlist-customer-list.pdf'), format: 'Letter', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 }, preferCSSPageSize: true });
  ok(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close(); console.log(`hotlist list: ${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
})();
