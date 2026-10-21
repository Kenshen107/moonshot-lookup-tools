// Looks and frames (2026-10-21): a picker in the header (and the phone Player sheet) switches color themes and pixel panel frames; saved per device.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile();
    const root = document.documentElement, brand = () => getComputedStyle(root).getPropertyValue('--brand').trim();
    const classic = brand();
    ok('starts Classic with frames on', !root.hasAttribute('data-theme') && root.getAttribute('data-frames') === 'on', root.getAttribute('data-frames'));
    ok('the header has a Look button', [...document.querySelectorAll('.topbar .btn')].some(b => /Look/.test(b.textContent)));
    lookPanel();
    ok('the panel lists every look', document.querySelectorAll('#modalHost .look-card').length === SP_LOOKS.length && SP_LOOKS.length === 7);
    document.querySelector('#modalHost .look-card[data-look="ember"]').click();
    ok('picking Ember sets the theme and changes the colors', root.getAttribute('data-theme') === 'ember' && brand() !== classic && brand() === '#b8561f', brand());
    ok('the frame picture follows the look', /art\/site\/frame-panel-autumn\.png/.test(root.style.getPropertyValue('--sp-frame')), root.style.getPropertyValue('--sp-frame'));
    ok('the panel stays open and marks the chosen look', !!document.querySelector('#modalHost .look-card.on[data-look="ember"]'));
    const panel = document.querySelector('.panel');
    ok('panels draw the frame (border-image set)', panel && getComputedStyle(panel).borderImageSource.includes('frame-panel-autumn'), panel && getComputedStyle(panel).borderImageSource);
    const u = (getComputedStyle(panel).borderImageSource.match(/url\("?([^")]+)/) || [])[1];
    window.__frameUrls = SP_LOOKS.map(l => { setLook(l.key, true); return (getComputedStyle(document.querySelector('.panel')).borderImageSource.match(/url\("?([^")]+)/) || [])[1]; }); setLook('ember', true);
    setLook(null, false);
    ok('frames can be turned off', root.getAttribute('data-frames') === 'off' && (!panel || getComputedStyle(panel).borderImageSource === 'none'));
    ok('the choice is mirrored for the next page load', JSON.parse(localStorage.getItem('spLook')).name === 'ember' && JSON.parse(localStorage.getItem('spLook')).frames === false);
    setLook('royal', true);
    ok('every look sets its own colors', SP_LOOKS.every(l => { setLook(l.key); return l.key === 'classic' ? brand() === classic : brand() !== classic; }));
    setLook('classic', true); closeModal();
    ok('Classic restores the original', !root.hasAttribute('data-theme') && brand() === classic);
    accountSheet();
    ok('the phone Player sheet has Look and frames', [...document.querySelectorAll('#sheetHost .btn')].some(b => /Look and frames/.test(b.textContent)));
    closeSheet();
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'looks');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const extra = [];
    // the harness blocks pictures, so check the path each look draws resolves to a real file in the repo
    const urls = await page.evaluate('window.__frameUrls');
    extra.push(['every look\'s frame path is a real file (resolved from styles.css)', urls.length === 7 && urls.every(u => u && fs.existsSync(path.join(ROOT, new URL(u).pathname))), urls]);
    // a saved look comes back after a reload, set before the first paint
    await page.evaluate("setLook('frost', true)");
    await page.reload(); await page.waitForFunction('typeof lookPanel === "function"');
    extra.push(['the look survives a reload', await page.evaluate("document.documentElement.getAttribute('data-theme') === 'frost' && spLook.name === 'frost'")]);
    for (const [w, hh] of [[360, 740], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: hh });
        await page.evaluate('lookPanel()');
        const over = await page.evaluate(() => { const b = document.querySelector('#modalHost .box'); return { box: b.scrollWidth - b.clientWidth, page: document.documentElement.scrollWidth - innerWidth }; });
        extra.push([`no sideways scroll at ${w}px`, over.box <= 1 && over.page <= 1, over]);
        fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
        await page.screenshot({ path: path.join(ROOT, 'tests', '.out', `looks-${w}.png`) });
        await page.evaluate('closeModal()');
    }
    const results = formatChecks(raw.concat(extra));
    const good = printResults('looks', results, errors);
    writeOut('looks', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
