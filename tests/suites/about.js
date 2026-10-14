// About panel: opens from the header, the footer and the phone More sheet; shows features, the log and credits; closes with Esc, Got it and a tap outside.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile();
    const open = () => !!document.querySelector('#modalHost .about');
    ok('closed at start', !open());
    aboutPanel();
    ok('opens', open());
    const a = document.querySelector('#modalHost .about');
    ok('has every feature card', a.querySelectorAll('.about-card').length === ABOUT_FEATURES.length && ABOUT_FEATURES.length >= 8);
    ok('has a log entry per day, newest open', a.querySelectorAll('details').length === ABOUT_LOG.length && a.querySelector('details').open && !a.querySelectorAll('details')[1].open);
    ok('shows the card coverage numbers', /cards fully automated/.test(a.textContent) && a.textContent.includes(CARD_COVERAGE.full.toLocaleString()));
    ok('says it is fan-made and not a store\'s', /fan-made/.test(a.textContent) && /not made or run by any store/.test(a.textContent));
    ok('credits Scryfall, MTGJSON and EDHREC', /Scryfall/.test(a.textContent) && /MTGJSON/.test(a.textContent) && /EDHREC/.test(a.textContent));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok('Esc closes it', !open());
    aboutPanel(); document.querySelector('#modalHost .about .btn.primary').click();
    ok('"Got it" closes it', !open());
    document.querySelector('footer a').click();
    ok('the footer link opens it', open()); closeModal();
    const hb = [...document.querySelectorAll('.topbar .btn')].find(b => /About/.test(b.textContent));
    ok('the header has an About button', !!hb);
    moreSheet();
    const mb = [...document.querySelectorAll('#sheetHost .btn')].find(b => /About/.test(b.textContent));
    ok('the More sheet has About', !!mb);
    mb.click();
    ok('About from More opens it and closes the sheet', open() && !document.querySelector('#sheetHost .sheet'));
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'about');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    // Screenshots at phone and desktop widths: no horizontal overflow
    const shots = [];
    for (const [w, hh] of [[360, 740], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: hh });
        await page.evaluate('aboutPanel()');
        const over = await page.evaluate(() => { const b = document.querySelector('#modalHost .box'); return { box: b.scrollWidth - b.clientWidth, page: document.documentElement.scrollWidth - innerWidth }; });
        shots.push([`no sideways scroll at ${w}px`, over.box <= 1 && over.page <= 1, over]);
        fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
        await page.screenshot({ path: path.join(ROOT, 'tests', '.out', `about-${w}.png`) });
        await page.evaluate('closeModal()');
    }
    const results = formatChecks(raw.concat(shots));
    const good = printResults('about', results, errors);
    writeOut('about', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
