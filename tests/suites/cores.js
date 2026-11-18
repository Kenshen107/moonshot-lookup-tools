// Draft-set round (2026-11-18): Magic 2011 cards read by rules/cores.js and spellslinger/15zb-cores.js.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const NAMES = ['Ancient Hellkite', "Autumn's Veil", 'Bloodcrazed Goblin', 'Captivating Vampire', "Chandra's Spitfire", 'Combust', 'Conundrum Sphinx', 'Cyclops Gladiator', 'Dark Tutelage', "Demon of Death's Gate", 'Destructive Force', 'Fauna Shaman', 'Fire Servant', 'Frost Titan', "Gaea's Revenge", 'Gargoyle Sentinel', 'Harbor Serpent', 'Hoarding Dragon', "Hunters' Feast", 'Incite'];
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
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('cores', results, []);
    writeOut('cores', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
