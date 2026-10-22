// Podcast Prep tab: node tests/mtg_podcast.js (offline; Scryfall calls may fail, the tab must still work)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + require('path').resolve(__dirname, '..', 'MTG_Lookup_Tool.html');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const w of [1280, 360]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 800 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL + '#podcast'); await p.waitForTimeout(1500);
    ok(await p.locator('#podcastApp').isVisible(), `${w}: tab opens from #podcast`);
    ok(await p.locator('.pod-q').count() === 34, `${w}: 34 questions`);
    await p.locator('.pod-notes').first().fill('hello notes');
    await p.locator('.pod-ready input').first().check();
    ok((await p.textContent('#podProgText')).startsWith('1 of 34'), `${w}: progress updates`);
    await p.reload(); await p.waitForTimeout(1200);
    ok(await p.locator('.pod-notes').first().inputValue() === 'hello notes', `${w}: notes saved`);
    for (const t of ['cheat', 'set', 'design', 'run']) { await p.evaluate(t => switchPodcastTab(t), t); await p.waitForTimeout(t === 'set' ? 9000 : 400); ok((await p.locator('#podBody').innerText()).length > 50, `${w}: ${t} tab renders`); }
    await p.evaluate(() => podPracticeStart()); await p.waitForTimeout(300);
    ok(await p.locator('.pod-practice, .pod-practice-q').count() > 0, `${w}: practice mode`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${w}: no sideways scroll`);
    ok(errs.length === 0, `${w}: no page errors ${errs.join('|')}`);
  }
  await b.close(); console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
