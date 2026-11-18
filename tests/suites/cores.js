// Draft-set round (2026-11-18): Magic 2011 cards read by rules/cores.js and spellslinger/15zb-cores.js.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const NAMES = ['Doubling Season', 'Mind Stone', 'Hardened Scales', 'Ancient Hellkite', "Autumn's Veil", 'Bloodcrazed Goblin', 'Captivating Vampire', "Chandra's Spitfire", 'Combust', 'Conundrum Sphinx', 'Cyclops Gladiator', 'Dark Tutelage', "Demon of Death's Gate", 'Destructive Force', 'Fauna Shaman', 'Fire Servant', 'Frost Titan', "Gaea's Revenge", 'Gargoyle Sentinel', 'Harbor Serpent', 'Hoarding Dragon', "Hunters' Feast", 'Incite'];
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async (names) => {
        const out = [];
        const C = await T.cards(names.concat(['Mountain', 'Grizzly Bears']));
        for (const n of names) { const R = rulesFor(slimCard(C[n])); out.push([`${n} reads as Automated`, R.support === 'full', R.unhandled]); }
        const [A, B] = await T.newGame(); T.clear();
        // Combust deals 5 that can't be prevented
        const bear = T.put(B, C['Grizzly Bears']);
        await CMD.dc_combust(A, {}, { o: bear }, T.put(A, C['Combust']));
        sba(); await settle(); out.push(['Combust kills the target', !B.bf.includes(bear), B.bf.length]);
        // Gargoyle Sentinel loses defender and flies
        const g = T.put(A, C['Gargoyle Sentinel']);
        out.push(['Gargoyle Sentinel starts with defender', has(g, 'defender'), 0]);
        CMD.dc_gargoyle(A, {}, null, g);
        out.push(['Gargoyle Sentinel loses defender this turn', !has(g, 'defender') && has(g, 'flying'), 0]);
        // Dark Tutelage
        A.library.length = 0; A.library.push(makeObj(C['Combust'], 0)); const l0 = A.life; A.hand.length = 0;
        CMD.dc_tutelage(A, {}, null, g);
        out.push(['Dark Tutelage draws the top card and loses life equal to its mana value', A.hand.length === 1 && A.life === l0 - 2, { hand: A.hand.length, life: A.life - l0 }]);
        // Hardened Scales also applies to counters a creature enters with, and to counters put on it
        T.clear(); const hs = T.put(A, C['Hardened Scales']); const e1 = T.put(A, C['Grizzly Bears']);
        addEtbCounters(e1, 2); out.push(['Hardened Scales adds one to "enters with" counters', e1.counters === 3, e1.counters]);
        const e2 = T.put(A, C['Grizzly Bears']); putCounters(e2, 1, A); out.push(['Hardened Scales adds one to counters put on a creature', e2.counters === 2, e2.counters]);
        // Doc Samson: enters-with, evolve-style and named counters all get the extra one (planeswalkers don't)
        T.clear(); T.put(A, C['Doc Samson, Super Psychiatrist']); const e3 = T.put(A, C['Grizzly Bears']);
        addEtbCounters(e3, 1); out.push(['Doc Samson adds one to "enters with" counters', e3.counters === 2, e3.counters]);
        addNamedCounter(e3, 'flying', 1); out.push(['Doc Samson adds one to a named counter put by other code', e3.ctr.flying === 2, e3.ctr.flying]);
        // Counter kinds: Scales only +1/+1, Doubling Season everything, Samson one more of any kind
        T.clear(); const hs2 = T.put(A, C['Hardened Scales']); const k1 = T.put(A, C['Grizzly Bears']); const art = T.put(A, C['Mind Stone']);
        addNamedCounter(k1, 'flying', 1); out.push(['Hardened Scales ignores other kinds of counters', k1.ctr.flying === 1, k1.ctr.flying]);
        T.clear(); T.put(A, C['Doubling Season']); const k2 = T.put(A, C['Grizzly Bears']);
        addEtbCounters(k2, 2); addNamedCounter(k2, 'flying', 2);
        out.push(['Doubling Season doubles +1/+1 counters', k2.counters === 4, k2.counters]);
        out.push(['Doubling Season doubles other kinds of counters too', k2.ctr.flying === 4, k2.ctr.flying]);
        T.clear(); T.put(A, C['Doc Samson, Super Psychiatrist']); T.put(A, C['Hardened Scales']); const k3 = T.put(A, C['Grizzly Bears']);
        addEtbCounters(k3, 1); addNamedCounter(k3, 'flying', 1);
        out.push(['Samson plus Scales: a +1/+1 counter becomes three', k3.counters === 3, k3.counters]);
        out.push(['Samson plus Scales: another kind only gets Samson\'s one more', k3.ctr.flying === 2, k3.ctr.flying]);
        return out;
    }, NAMES.concat(['Doc Samson, Super Psychiatrist']));
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('cores', results, []);
    writeOut('cores', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
