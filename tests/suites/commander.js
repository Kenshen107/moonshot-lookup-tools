// Commander zone changes (owner's report, 2026-10-14): a commander put into the graveyard or exile lets its owner choose the command zone
// or leaving it there (to reanimate it); a commander exiled from the graveyard asks again; to the library it goes to the command zone.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        const C = await T.cards(['Mountain', 'Grizzly Bears']);
        const [A] = await T.newGame(); A.isAI = false; // a person, so the question is asked
        T.clear();
        const zones = o => ['bf', 'gy', 'exile', 'command', 'hand', 'library'].filter(z => A[z].includes(o)).join(',') || 'nowhere';
        const mk = () => { const c = T.put(A, C['Grizzly Bears']); c.isCommander = true; return c; };
        const asks = [];
        const real = window.askYes;
        const answer = v => { window.askYes = async (P, msg) => { asks.push(msg); return v; }; };

        // 1. Dies, owner says yes -> command zone
        answer(true); let c = mk(); dieOrLeave(c, 'gy'); await settle();
        out.push(['a commander that dies goes to the command zone when its owner says so', zones(c) === 'command' && asks.length === 1, zones(c)]);

        // 2. Dies, owner says no -> stays in the graveyard, and is not asked again
        A.command.length = 0; asks.length = 0; answer(false); c = mk(); dieOrLeave(c, 'gy'); await settle(); await settle();
        out.push(['the owner can leave a dead commander in the graveyard', zones(c) === 'gy' && asks.length === 1, { z: zones(c), asks: asks.length }]);

        // 3. From the graveyard it can be reanimated like any card
        pull(A.gy, c); A.bf.push(c);
        out.push(['a commander left in the graveyard can be put back onto the battlefield', zones(c) === 'bf', zones(c)]);
        pull(A.bf, c);
        A.gy.push(c); c.cmdSeenZone = 'gy';

        // 4. Exiled from the graveyard -> asked again, and yes sends it to the command zone
        pull(A.gy, c); A.exile.push(c); asks.length = 0; answer(true); await settle();
        out.push(['a commander exiled from the graveyard goes to the command zone when asked', zones(c) === 'command' && asks.length === 1, { z: zones(c), asks: asks.length }]);

        // 5. Exiled from the battlefield, owner says no -> stays in exile
        A.command.length = 0; asks.length = 0; answer(false); c = mk(); leaveBattlefield(c, 'exile'); await settle();
        out.push(['the owner can leave an exiled commander in exile', zones(c) === 'exile' && asks.length === 1, zones(c)]);

        // 6. To the library -> command zone, no question
        A.exile.length = 0; asks.length = 0; c = mk(); leaveBattlefield(c, 'library'); await settle();
        out.push(['a commander that would go to the library returns to the command zone without asking', zones(c) === 'command' && asks.length === 0, zones(c)]);

        // 7. Tokens and ordinary cards are never asked about
        asks.length = 0; const plain = T.put(A, C['Grizzly Bears']); dieOrLeave(plain, 'gy'); await settle();
        out.push(['an ordinary creature stays in the graveyard and nothing is asked', zones(plain) === 'gy' && asks.length === 0, zones(plain)]);
        window.askYes = real;
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('commander', results, []);
    writeOut('commander', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
