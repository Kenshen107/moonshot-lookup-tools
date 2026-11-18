// Combat stops (owner, 2026-11-18): a person who is not taking the turn can respond at declare attackers, declare blockers, combat damage and end of combat,
// and the active person can go through combat without attacking (beginning-of-combat effects still happen) and land in the second main phase.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        const C = await T.cards(['Mountain', 'Lightning Bolt', 'Grizzly Bears']);
        window.__FORCE_WINDOWS = true; manaMode = 'auto';
        let [A, B] = await T.newGame(); T.clear(); A.isAI = false; B.isAI = true;
        T.put(A, C['Mountain']); A.hand.push(makeObj(C['Lightning Bolt'], 0));
        G.active = 1; G.phase = 'declareBlocks';
        for (const label of ['Attackers declared', 'Blockers declared', 'Combat damage dealt']) {
            const w = combatWindow(label); await new Promise(r => setTimeout(r, 150));
            const asked = !!G.mode && G.mode.type === 'respond' && G.mode.who === A.i && /respond|window/.test(String(G.mode.item.kind)) || (G.mode && G.mode.type === 'respond');
            ok(`a person holding an instant is asked at "${label}"`, asked && String(G.mode.item.name).includes(label), G.mode && G.mode.item && G.mode.item.name);
            if (G.mode && G.mode.type === 'respond') passPriority(); await w;
        }
        // nothing to cast: no stop
        A.hand.length = 0; const before = G.mode; await combatWindow('Attackers declared');
        ok('with nothing to do there is no stop', G.mode === before);
        // the active person goes through combat without attacking
        T.clear(); [A, B] = [G.players[0], G.players[1]]; A.isAI = false; G.active = 0; G.view = 0; G.phase = 'main1'; G.busy = false; G.combatFired = false;
        T.put(A, C['Grizzly Bears']);
        await throughCombat();
        ok('through combat ends in the second main phase', G.phase === 'main2' && !G.busy, G.phase);
        ok('and counts combat as having happened', G.combatFired === true, G.combatFired);
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('combatwindows', results, []);
    writeOut('combatwindows', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
