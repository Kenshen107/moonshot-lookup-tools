// Planeswalker's Ascent: roster, Play Booster (14 slots) and Collector Booster odds, rule of 4, Aether dust and crafting.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

(async () => {
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            ensureProfile(); profile.ascent = null;
            await loadAscentRoster();
            const R = ASCENT.roster, P = ascentPools();
            ok('the roster has 1,000+ cards', R.length >= 1000, R.length);
            ok('every rarity pool has cards', ['common', 'uncommon', 'rare', 'mythic'].every(k => P[k].length >= 10), ['common', 'uncommon', 'rare', 'mythic'].map(k => P[k].length));
            ok('5 basics and duals exist', P.basics.length === 5 && P.duals.length >= 10, [P.basics.length, P.duals.length]);
            // seeded rng so the run is repeatable
            let seed = 12345; const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
            const N = 20000; let mythic10 = 0, list = 0, wildFoil = 0, bad = 0, dupes = 0, foil11 = 0, rare11 = 0, mythic11 = 0;
            for (let i = 0; i < N; i++) {
                const pk = rollAscentPlayBooster(rng), by = s => pk.find(x => x.slot === s), card = x => ASCENT.byId.get(x.id);
                if (pk.length !== 14 || pk.map(x => x.slot).join() !== '1,2,3,4,5,6,7,8,9,10,11,12,13,14') bad++;
                for (let s = 1; s <= 6; s++) if (card(by(s)).rarity !== 'common' || card(by(s)).type === 'land') bad++;
                for (let s = 7; s <= 9; s++) if (card(by(s)).rarity !== 'uncommon') bad++;
                const c10 = card(by(10)); if (c10.rarity === 'mythic') mythic10++; else if (c10.rarity !== 'rare') bad++;
                if (by(11).foil) foil11++; const c11 = card(by(11)); if (c11.rarity === 'rare') rare11++; if (c11.rarity === 'mythic') mythic11++;
                if (by(12).foil) wildFoil++;
                if (card(by(13)).kind !== 'basic') bad++;
                const c14 = card(by(14)); if (c14.kind === 'tapdual') { } else if (['rare', 'mythic'].includes(c14.rarity)) list++; else bad++;
                const names = pk.filter(x => card(x).kind !== 'basic').map(x => x.id); if (new Set(names).size !== names.length) dupes++;
            }
            ok('every Play Booster has the 14 slots in the right rarities', bad === 0, bad);
            ok('no card repeats inside a pack', dupes === 0, dupes);
            ok('the rare slot upgrades to a mythic about 1 time in 7', Math.abs(mythic10 / N - 1 / 7) < 0.01, (mythic10 / N).toFixed(3));
            ok('the foil slot is always foil', foil11 === N, foil11);
            ok('the foil slot gives rares about 11% and mythics about 3%', Math.abs(rare11 / N - 0.11) < 0.015 && Math.abs(mythic11 / N - 0.03) < 0.01, [(rare11 / N).toFixed(3), (mythic11 / N).toFixed(3)]);
            ok('the wildcard is foil about 1 time in 6', Math.abs(wildFoil / N - 1 / 6) < 0.012, (wildFoil / N).toFixed(3));
            ok('The List slot is a rare or mythic 12.5% of the time', Math.abs(list / N - 0.125) < 0.01, (list / N).toFixed(3));
            const cb = rollAscentCollectorBooster(rng);
            ok('the Collector Booster has 14 foils with 5+ rares or mythics', cb.length === 14 && cb.every(x => x.foil) && cb.filter(x => ['rare', 'mythic'].includes(ASCENT.byId.get(x.id).rarity)).length >= 5, cb.length);

            // ---- rule of 4 and Aether ----
            const st = ascentState();
            const cm = P.common[0], rr = P.rare[0], base = P.basics[0];
            let rep = ascentAddCards([1, 2, 3, 4].map(() => ({ id: cm.id, foil: false })));
            ok('four copies are kept', st.owned[cm.id].n === 4 && rep.dusted.length === 0);
            rep = ascentAddCards([{ id: cm.id, foil: false }, { id: cm.id, foil: true }]);
            ok('the 5th and 6th copy dust (foil counts double)', st.owned[cm.id].n === 4 && rep.aether === ASCENT_DUST.common * 3 && st.aether === 15, [st.aether, rep.aether]);
            rep = ascentAddCards(Array.from({ length: 9 }, () => ({ id: base.id, foil: false })));
            ok('basic lands are unlimited and never dust', st.owned[base.id].n === 9 && rep.aether === 0);
            // crafting
            st.aether = 100;
            let c = craftAscentCard(rr.id);
            ok('a rare costs 240 Aether, so 100 is not enough', !c.ok && st.aether === 100, c.why);
            st.aether = 300; c = craftAscentCard(rr.id);
            ok('crafting a rare spends 240 and adds one copy', c.ok && st.aether === 60 && st.owned[rr.id].n === 1, [c, st.aether]);
            st.aether = 5000; for (let i = 0; i < 5; i++) craftAscentCard(rr.id);
            ok('crafting stops at 4 copies', st.owned[rr.id].n === 4, st.owned[rr.id].n);
            ok('lands cannot be crafted', !craftAscentCard(base.id).ok);
            // dusting by hand keeps what decks use
            st.decks = [{ name: 'x', cards: { [rr.id]: 3 } }];
            ok('hand dusting keeps copies a deck uses', !dustAscentCard(rr.id, 2).ok && dustAscentCard(rr.id, 1).ok && st.owned[rr.id].n === 3);
            // opening a pack stores it and counts it
            const before = st.packs, op = openAscentPack('play', rng);
            ok('opening a pack adds its cards to the Ascent collection only', st.packs === before + 1 && op.picks.length === 14 && Object.keys(profile.collection).length === Object.keys(profile.collection).length && !op.picks.some(p => profile.collection[p.id]));
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascent', results, []);
    await h.close();
})();
