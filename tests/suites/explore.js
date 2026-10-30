// Explore (2026-10-30): every wording, the land/nonland result, "explores" triggers. Card data comes live from Scryfall.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = ['Merfolk Branchwalker', 'Jadelight Ranger', 'Wildgrowth Walker', 'Grizzly Bears', 'Forest', 'Mountain', 'Island'];
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const [A] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; A.isAI = true;
            const stack = (...ns) => { A.library.length = 0; A.hand.length = 0; A.gy.length = 0; ns.slice().reverse().forEach(n => A.library.push(makeObj(have(n), 0))); };
            const settle2 = async () => { await settle(); await settle(); };
            // Land on top: goes to hand, no counter
            { stack('Forest', 'Island'); const o = T.put(A, have('Grizzly Bears')); await applyEffect(A, { t: 'explore', n: 1 }, null, o); await settle2(); ok('explore: a land goes to hand, no counter', A.hand.some(x => x.card.name === 'Forest') && !o.counters, [A.hand.length, o.counters]); }
            // Nonland: +1/+1 counter (AI keeps a cheap card on top)
            { stack('Grizzly Bears', 'Island'); const o = T.put(A, have('Grizzly Bears')); await applyEffect(A, { t: 'explore', n: 1 }, null, o); await settle2(); ok('explore: a nonland gives a +1/+1 counter', o.counters === 1, o.counters); }
            // Twice (Jadelight): land then land
            { stack('Forest', 'Mountain', 'Island'); const o = T.put(A, have('Grizzly Bears')); await applyEffect(A, { t: 'explore', n: 2 }, null, o); await settle2(); ok('explore twice: two lands to hand', A.hand.length === 2, A.hand.length); }
            // Enters trigger on a real card
            { stack('Forest', 'Island'); const o = T.put(A, have('Merfolk Branchwalker')); await settle2(); ok('Merfolk Branchwalker explores when it enters', A.hand.some(x => x.card.name === 'Forest') , A.hand.map(x => x.card.name)); }
            // Explores event: Wildgrowth Walker gets a counter
            { stack('Forest', 'Island'); const w = T.put(A, have('Wildgrowth Walker')); const b = T.put(A, have('Grizzly Bears')); const life = A.life; await applyEffect(A, { t: 'explore', n: 1 }, null, b); await settle2(); ok('Wildgrowth Walker triggers when a creature explores', w.counters === 1 && A.life === life + 3, [w.counters, A.life - life]); }
            // Empty library
            { stack(); const o = T.put(A, have('Grizzly Bears')); await applyEffect(A, { t: 'explore', n: 1 }, null, o); await settle2(); ok('explore with an empty library gives a counter', o.counters === 1, o.counters); }
            { const bad = ['Merfolk Branchwalker', 'Jadelight Ranger', 'Wildgrowth Walker'].filter(n => rulesFor(C[n]).support !== 'full'); ok('explore cards read as Automated', bad.length === 0, bad); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('explore', results, []);
    writeOut('explore', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
