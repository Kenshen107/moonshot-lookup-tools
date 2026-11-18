// On-theme EDHREC builds (2026-11-19): synergy weights, the staple cap, top-played order (offline: a made-up pool).
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(() => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const pool = [];
            for (let i = 0; i < 10; i++) pool.push({ name: 'Staple' + i, rate: 0.8 - i * 0.01, syn: 0 });
            for (let i = 0; i < 20; i++) pool.push({ name: 'Theme' + i, rate: 0.4 - i * 0.005, syn: 0.5 });
            for (let i = 0; i < 30; i++) pool.push({ name: 'Filler' + i, rate: 0.3, syn: 0.05 });
            const top = edhrecPick(pool, 30, true, true);
            const staples = top.filter(x => x.name.startsWith('Staple')).length, theme = top.filter(x => x.name.startsWith('Theme')).length;
            ok('the top-played build keeps at most 6 generic staples', staples <= 6 && staples >= 1, staples);
            ok('every high-synergy card is in it', theme === 20, theme);
            const plain = edhrecPick(pool, 30, true, false);
            ok('without synergy the old order (play rate) fills the deck with staples', plain.filter(x => x.name.startsWith('Staple')).length === 10);
            ok('a negative synergy is penalised', edhrecWeight({ rate: 0.5, syn: -0.2 }, true) < edhrecWeight({ rate: 0.5, syn: 0 }, true));
            // the random build draws theme cards far more often than filler of the same play rate
            let th = 0, fi = 0; let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
            for (let t = 0; t < 300; t++) edhrecPick(pool, 20, false, true, 6, rnd).forEach(x => { if (x.name.startsWith('Theme')) th++; else if (x.name.startsWith('Filler')) fi++; });
            ok('the random build prefers high-synergy cards', th / 20 > fi / 30 * 1.5, [th / 20, fi / 30]);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('edhrecpick', results); writeOut('edhrecpick', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
