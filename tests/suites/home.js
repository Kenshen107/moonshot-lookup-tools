// Home screen: game-style hero, action tiles, stats chips, coverage; fits phones and desktop with no sideways scroll.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, printResults, writeOut, ROOT } = require('../lib/harness');

async function main() {
    const results = [];
    const shots = path.join(ROOT, 'tests', '.out');
    fs.mkdirSync(shots, { recursive: true });
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    for (const [w, ht] of [[360, 740], [412, 915], [768, 1000], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: ht });
        const m = await page.evaluate(async () => {
            ensureProfile(); setMode('sandbox'); showView('home'); renderHome();
            await new Promise(r => setTimeout(r, 200));
            const v = $('view-home'), tiles = [...v.querySelectorAll('.home-tile')].filter(t => t.offsetParent);
            const out = { scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth, tiles: tiles.length,
                small: tiles.filter(t => t.getBoundingClientRect().height < 44).length, offX: tiles.filter(t => t.getBoundingClientRect().right > innerWidth + 1).length,
                chips: v.querySelectorAll('.hstat').length, cov: $('homeCoverage').textContent.includes('playable'), steps: v.querySelectorAll('.home-steps li').length,
                title: v.querySelector('.home-title').textContent };
            return out;
        });
        await page.screenshot({ path: path.join(shots, `home-${w}.png`), fullPage: true });
        const tag = `${w}px`;
        results.push({ label: `${tag}: no sideways scroll`, ok: m.scrollX <= 0, detail: JSON.stringify(m) });
        results.push({ label: `${tag}: action tiles shown, tall enough to tap, on screen`, ok: m.tiles >= 4 && m.small === 0 && m.offX === 0, detail: JSON.stringify(m) });
        results.push({ label: `${tag}: stats, coverage and the 5 steps are there`, ok: m.chips >= 4 && m.cov && m.steps === 5 && /Spellslinger/.test(m.title), detail: JSON.stringify(m) });
    }
    // Play tab: the VS strip and Start button
    await page.setViewportSize({ width: 360, height: 740 });
    const pv = await page.evaluate(async () => {
        ensureProfile(); setMode('sandbox'); showView('play'); renderPlayView();
        await new Promise(r => setTimeout(r, 300));
        const vs = $('vsStrip'), b = $('startBtn');
        return { vs: !!vs && /VS/.test(vs.textContent), you: !!vs && vs.textContent.includes('You'), h: Math.round(b.getBoundingClientRect().height), steps: document.querySelectorAll('#view-play h2 .step-n').length, scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    results.push({ label: 'Play tab: VS strip, numbered steps, a tall Start button, no sideways scroll', ok: pv.vs && pv.you && pv.steps === 2 && pv.h >= 44 && pv.scrollX <= 0, detail: JSON.stringify(pv) });
    const good = printResults('home', results, errors);
    writeOut('home', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
