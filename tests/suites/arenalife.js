// Living battlefields, part 2 (2026-11-27): the #arenaLife canvas draws moving scenery for every mat (spellslinger/08h-arena-life.js).
// Checks: the canvas exists behind the cards and can't be clicked, every mat paints something and changes between two frames,
// nothing throws; screenshots of each mat are saved to tests/.out/life-<mat>.png for a look.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    // the harness blocks pictures; let the playmat through so the screenshots show the real thing
    await h.ctx.route(/spellslinger\.test\/.*art\/ui\/arena-mat\.jpg/, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(ROOT, 'spellslinger', 'art', 'ui', 'arena-mat.jpg')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const setup = await page.evaluate(async () => {
        const out = [];
        try {
            window.__LIFE_FORCE = true;
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            ['Island', 'Forest', 'Tyrox, Saurid Tyrant', 'Grizzly Bears'].forEach(n => { const c = raw.find(x => x.name === n && x.type_line); if (c) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 7; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0;
            G.players[0].isAI = false;
            const o = makeObj(C['Grizzly Bears'], 0); putOntoBattlefield(G.players[0], o); o.sick = false;
            $('game').classList.remove('hidden'); setBoardStyle('open'); renderGame(); fitTable();
            const cv = document.getElementById('arenaLife');
            out.push(['the canvas exists inside the table', !!cv && cv.parentNode === $('game')]);
            out.push(['it cannot be clicked and sits behind the cards', cv && getComputedStyle(cv).pointerEvents === 'none' && Number(getComputedStyle(cv).zIndex) <= 0, cv && getComputedStyle(cv).zIndex]);
        } catch (e) { out.push(['setup threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(setup);
    for (const mat of ['sanctum', 'plains', 'island', 'swamp', 'mountain', 'forest']) {
        await page.evaluate(m => setArenaMat(m), mat);
        await page.waitForTimeout(1600);
        const a = await page.evaluate(() => { const c = document.getElementById('arenaLife'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, sum = 0; for (let i = 3; i < d.length; i += 40) { if (d[i] > 0) n++; sum += d[i]; } return { n, sum, mat: document.getElementById('game').dataset.mat }; });
        await page.waitForTimeout(500);
        const b = await page.evaluate(() => { const c = document.getElementById('arenaLife'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let i = 3; i < d.length; i += 40) sum += d[i]; return sum; });
        results.push(...formatChecks([[`${mat}: the layer paints something`, a.n > 300 && a.mat === mat, a], [`${mat}: it moves between frames`, a.sum !== b, [a.sum, b]]]));
        try { await page.screenshot({ path: path.join(ROOT, 'tests', '.out', `life-${mat}.png`) }); } catch (e) { /* ignore */ }
    }
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('arenalife', results); writeOut('arenalife', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
