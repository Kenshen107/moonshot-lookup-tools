// A cast-time dry run (15x-casting.js) is put back, so it must not show in the game record (pod record 2026-11-24: Spry and Mighty's draw and pump lines and its
// questions appeared twice). spellslinger/04e-game-records.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: path.join(ROOT, 'tests', '.cache', 'recdry') });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        window.__REC_FORCE = true;
        const C = await T.cards(['Forest', 'Grizzly Bears', 'Hill Giant', 'Spry and Mighty']);
        const [A] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.view = 0; G.busy = false;
        A.isAI = false; manaMode = 'auto'; window.__PRE_FORCE = true;
        const put = n => { const o = T.put(A, C[n]); o.sick = false; return o; };
        put('Grizzly Bears'); put('Hill Giant'); for (let i = 0; i < 5; i++) put('Forest');
        const sp = makeObj(C['Spry and Mighty'], 0); A.hand.push(sp);
        const q = ['Hill Giant', 'Grizzly Bears']; let asked = 0;
        window.__pickBase = async (P, pool) => { asked++; return pool.find(c => c.card.name === q[(asked - 1) % 2]) || pool[0]; };
        const lib0 = A.library.length;
        await humanCast(sp.uid); await settle(); await settle();
        const L = G.rec ? G.rec.log : [];
        ok('the spell really drew once', lib0 - A.library.length === 1, lib0 - A.library.length);
        ok('the record has the draw line once', L.filter(l => /^You draw a card\./.test(l)).length === 1, L.slice(-8));
        ok('the record has the pump line once', L.filter(l => /get \+1\/\+1 and trample/.test(l)).length === 1);
        ok('each choice is recorded once, after the cast line', L.filter(l => /choose the first creature/.test(l)).length === 1 && L.filter(l => /choose the second creature/.test(l)).length === 1 && L.findIndex(l => /You cast Spry/.test(l)) < L.findIndex(l => /choose the first creature/.test(l)), L.slice(-8));
        return out;
    });
    const results = formatChecks(raw); const good = printResults('recdry', results, errors); writeOut('recdry', { results, errors }); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
