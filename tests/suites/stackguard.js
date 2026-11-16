// Stuck stack guard (2026-11-16, spellslinger/15z-stack-guard.js): a land can't be played with something on the stack or a choice open; a stack that nothing is resolving is restarted.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        try {
            const ok = (l, c, d) => out.push([l, !!c, d]);
            const C = await T.cards(['Forest', 'Grizzly Bears']);
            const [A] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.active = 0; G.busy = false; G.firstTurn = false; A.isAI = false;
            const bears = T.put(A, C['Grizzly Bears']);
            // 1. a land can't be played with something on the stack
            const land = makeObj(C['Forest'], A.i); A.hand.push(land);
            G.stackRunning = true; // an outer loop "is working"
            await putTriggers(A, bears, [{ t: 'draw', n: 1 }], null, 0, null);
            ok('a trigger waits on the stack while the loop is busy', G.stack.length === 1, G.stack.length);
            const lp0 = A.landsPlayed; await humanPlayLand(land.uid);
            ok('no land can be played with something on the stack', A.landsPlayed === lp0 && A.hand.includes(land), [A.landsPlayed, lp0]);
            // 2. a stuck stack is restarted by the watchdog (nothing open, loop "running")
            const hand0 = A.hand.length; let fired = false;
            for (let i = 0; i < 5; i++) fired = stackGuardTick() || fired;
            ok('five quiet ticks do nothing yet', !fired && G.stack.length === 1, G.stack.length);
            ok('the sixth restarts the stack', stackGuardTick() === true);
            for (let i = 0; i < 20 && G.stack.length; i++) await new Promise(r => setTimeout(r, 100));
            await settle();
            ok('the stuck trigger resolved (a card was drawn)', G.stack.length === 0 && A.hand.length === hand0 + 1, [G.stack.length, A.hand.length - hand0]);
            ok('the loop is free again', G.stackRunning === false);
            // 3. the watchdog leaves an open choice alone
            G.stackRunning = true; await putTriggers(A, bears, [{ t: 'draw', n: 1 }], null, 0, null); G.mode = { type: 'target', who: 0, resolve() {} };
            let fired2 = false; for (let i = 0; i < 10; i++) fired2 = stackGuardTick() || fired2;
            ok('an open choice is not interrupted', !fired2 && G.stack.length === 1);
            // 4. and the land can be played once the stack is empty
            G.mode = null; G.stackRunning = false; G.stack.length = 0; const lp1 = A.landsPlayed; await humanPlayLand(land.uid); await settle();
            ok('a land can be played with an empty stack', A.landsPlayed === lp1 + 1, [A.landsPlayed, lp1]);
        } catch (e) { out.push(['suite threw: ' + e.message, false, e.stack && e.stack.split('\n').slice(0, 3)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('stackguard', results, []); writeOut('stackguard', results);
    await h.close(); process.exit(results.every(x => x.ok) ? 0 : 1);
})();
