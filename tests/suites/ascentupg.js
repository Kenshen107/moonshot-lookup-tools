// Planeswalker's Ascent upgrades: per-copy upgrades, slots, prices, sacrifice, swapping, and that every upgraded card still reads as Automated.
'use strict';
const fs = require('fs'), path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch();
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json();
            ensureProfile(); profile.ascent = null;
            await loadAscentRoster();
            const ids = new Set(ASCENT.roster.map(c => c.id));
            raw.filter(c => ids.has(c.id)).forEach(c => CARDS.set(c.id, slimCard(c)));
            const st = ascentState();
            const bears = ASCENT.roster.find(c => c.type === 'creature' && c.kind === 'vanilla' && c.rarity === 'common' && c.pt === '2/2');
            const mythic = ASCENT.roster.find(c => c.type === 'creature' && c.rarity === 'mythic' && c.kind === 'vanilla');
            ascentAddCards([1, 2, 3, 4].map(() => ({ id: bears.id, foil: false })));
            const copies = st.owned[bears.id].c;
            ok('each copy is its own record with its own key', copies.length === 4 && new Set(copies.map(c => c.k)).size === 4 && st.owned[bears.id].n === 4);

            // ---- every upgrade on every card still reads as Automated ----
            const badRead = [];
            for (const c of ASCENT.roster.filter(x => x.type === 'creature' || x.type === 'spell')) {
                const base = CARDS.get(c.id);
                for (const u of Object.keys(ASCENT_UPGRADES)) {
                    if (ascentUpgradeBlocked({ card: c, copy: { u: [] } }, u)) continue;
                    const v = ascentVariantCard(base, [u]);
                    if (rulesFor(v).support !== 'full') badRead.push(`${c.name}+${u}`);
                }
            }
            ok('every card with every upgrade it can take reads as fully Automated', badRead.length === 0, badRead.slice(0, 6));
            // two upgrades at once (the common case)
            const pairs = [['flying', 'plus11'], ['lifelink', 'etbdraw'], ['firststrike', 'dielife'], ['trample', 'plus20']], bad2 = [];
            for (const [a, b] of pairs) { const v = ascentVariantCard(CARDS.get(bears.id), [a, b]); if (rulesFor(v).support !== 'full') bad2.push(a + b); }
            ok('two upgrades together read as Automated', bad2.length === 0, bad2);

            // ---- what an upgrade does to the card ----
            const v1 = ascentVariantCard(CARDS.get(bears.id), ['plus11', 'flying']);
            ok('+1/+1 and flying make a 3/3 flier', v1.power === '3' && v1.toughness === '3' && rulesFor(v1).kw.has('flying'), [v1.power, v1.toughness, v1.text]);
            ok('the variant is its own card and the plain card is untouched', v1.id !== bears.id && CARDS.get(bears.id).power === '2' && !CARDS.get(bears.id).text.includes('Flying'));
            const v2 = ascentVariantCard(CARDS.get(bears.id), ['etbdraw']);
            ok('an enters trigger is read as a trigger', rulesFor(v2).etb.length > 0 || rulesFor(v2).trig.length > 0, v2.text);
            ok('upgraded cards are never saved with the card cache', (() => { cardsDirty = true; persistCards(); return !Object.keys(store.get('cards', {})).some(k => k.includes('~')); })());

            const vm = ascentVariantCard(CARDS.get(bears.id), ['anymana']);
            ok('the Aether tap upgrade makes a creature a mana dork', !!rulesFor(vm).mana && rulesFor(vm).support === 'full', rulesFor(vm).mana);
            const dorkCard = ASCENT.roster.find(c => c.kind === 'dork');
            ok('a mana dork cannot take the Aether tap upgrade', /taps for mana/.test(ascentUpgradeBlocked({ card: dorkCard, copy: { u: [] } }, 'anymana') || ''), ascentUpgradeBlocked({ card: dorkCard, copy: { u: [] } }, 'anymana'));
            const rockCard = ASCENT.roster.find(c => c.kind === 'rock');
            ok('mana rocks cannot take spell upgrades', rockCard && /cannot be upgraded/.test(ascentUpgradeBlocked({ card: rockCard, copy: { u: [] } }, 'sdraw') || ''));

            // ---- buying one on a single copy ----
            st.aether = 1000;
            const k0 = copies[0].k;
            let res = upgradeAscentCopy(k0, 'flying');
            ok('flying on a common costs 60 Aether, on that one copy', res.ok && res.price === 60 && res.aether === 60 && st.aether === 940 && copies[0].u.join() === 'flying' && copies[1].u.length === 0, res);
            res = upgradeAscentCopy(k0, 'flying');
            ok('the same upgrade cannot be added twice', !res.ok && /Already/.test(res.why), res.why);
            res = upgradeAscentCopy(k0, 'plus11');
            ok('a second upgrade fits (2 slots)', res.ok && copies[0].u.length === 2);
            res = upgradeAscentCopy(k0, 'lifelink');
            ok('a third does not fit on a common', !res.ok && /slot/.test(res.why));
            res = upgradeAscentCopy(copies[1].k, 'plus11'); res = upgradeAscentCopy(copies[1].k, 'plus02');
            ok('only one stat boost per copy', !res.ok && /stat/.test(res.why), res.why);
            ok('a spell upgrade cannot go on a creature', !upgradeAscentCopy(copies[2].k, 'sdraw').ok);
            const printedKw = ASCENT.roster.find(c => c.type === 'creature' && (c.kws || []).includes('flying'));
            ascentAddCards([{ id: printedKw.id, foil: false }]);
            ok('a keyword the card already has cannot be added', !upgradeAscentCopy(st.owned[printedKw.id].c[0].k, 'flying').ok);
            // rarity price and the third mythic slot
            ascentAddCards([{ id: mythic.id, foil: false }]);
            const mk = st.owned[mythic.id].c[0].k;
            ok('a mythic costs 3x and has 3 slots', ascentUpgradeCost('flying', mythic) === 180 && ascentUpgradeSlots(mythic) === 3 && ['reach', 'vigilance', 'dielife'].every(u => upgradeAscentCopy(mk, u).ok) && st.owned[mythic.id].c[0].u.length === 3);

            // ---- paying with spare copies ----
            st.aether = 10;
            res = upgradeAscentCopy(copies[3].k, 'deathtouch');
            ok('not enough Aether blocks it and spends nothing', !res.ok && st.aether === 10);
            // copies[2] is plain and free: it covers 2 x 5 = 10 of the 60
            res = upgradeAscentCopy(copies[3].k, 'deathtouch', [copies[2].k]);
            ok('feeding in a spare copy covers 10 of the price (60 - 10 = 50 Aether needed)', !res.ok && /50/.test(res.why), res.why);
            st.aether = 50;
            res = upgradeAscentCopy(copies[3].k, 'deathtouch', [copies[2].k]);
            ok('with 50 Aether and a spare copy it goes through', res.ok && res.sacrificed === 1 && st.aether === 0 && st.owned[bears.id].c.length === 3 && st.owned[bears.id].n === 3, res);
            ok('an upgraded copy cannot be fed in', !upgradeAscentCopy(copies[1].k, 'reach', [k0]).ok);

            // ---- swapping and removing ----
            st.aether = 500;
            const before = st.aether;
            res = swapAscentUpgrade(k0, 0, 'trample');
            ok('swapping flying for trample costs a quarter of flying (15) plus trample (45)', res.ok && res.fee === 15 && before - st.aether === 60 && copies[0].u[0] === 'trample', res);
            res = swapAscentUpgrade(k0, 1, null);
            ok('removing an upgrade costs only the fee and frees the slot', res.ok && copies[0].u.length === 1);
            ok('a stat swap is allowed in its own slot', swapAscentUpgrade(copies[1].k, 0, 'plus02').ok && copies[1].u[0] === 'plus02');

            // ---- decks use the chosen copies ----
            const deck = { name: 'T', cards: { [bears.id]: 2 } };
            st.decks.push(deck); ascentNormalizeDeck(deck);
            ok('a deck without a copy list takes upgraded copies first', deck.sel[bears.id].length === 2 && deck.sel[bears.id].every(k => copies.find(c => c.k === k).u.length));
            const play = ascentPlayableCards(deck);
            ok('the playable list swaps in the upgraded variants', Object.keys(play).length === 2 && Object.keys(play).every(id => id.includes('~')) && Object.values(play).reduce((a, b) => a + b, 0) === 2, Object.keys(play));
            ok('copies in a deck are not offered for dusting', !dustAscentCard(bears.id, 3).ok);
            deck.sel[bears.id] = [copies[0].k, copies[1].k];
            const d = dustAscentCard(bears.id, 1, [copies[2].k]);
            ok('an upgraded spare copy can be dusted when you name it', d.ok && d.aether === 5, d);
            ok('no broken state', Object.values(st.owned).every(o => !o.c || (o.n === o.c.length)));
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentupg', results, []);
    await h.close();
})();
