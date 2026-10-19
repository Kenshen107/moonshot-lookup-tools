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
            ok('the Aether tap module makes a creature a mana dork', !!rulesFor(vm).mana && rulesFor(vm).support === 'full', rulesFor(vm).mana);
            const pick = f => ASCENT.roster.find(c => c.rarity !== 'trophy' && f(c));
            const dorkCard = pick(c => c.kind === 'dork' && c.colors === 'G');
            ok('a mana dork cannot take another mana tap module', /taps for mana/.test(ascentUpgradeBlocked({ card: dorkCard, copy: { u: [] } }, 'greendork') || ''), ascentUpgradeBlocked({ card: dorkCard, copy: { u: [] } }, 'greendork'));
            const rockCard = ASCENT.roster.find(c => c.kind === 'rock');
            ok('mana rocks cannot take spell modules', rockCard && /cannot be upgraded/.test(ascentUpgradeBlocked({ card: rockCard, copy: { u: [] } }, 'sdraw') || ''));

            // ---- the catalog: grades, colors, prices ----
            const U = Object.entries(ASCENT_UPGRADES);
            ok('every module has a grade 1-4, valid colors, a price and a way to be written', U.every(([id, u]) => [1, 2, 3, 4].includes(u.grade) && /^(C|[WUBRG]+)$/.test(u.cols) && u.cost > 0 && ['creature', 'spell'].includes(u.on) && (u.kw || u.p !== undefined || u.line || u.append)), U.filter(([, u]) => !u.cost).map(x => x[0]));
            const avgCost = g => { const l = U.filter(([, u]) => u.grade === g); return l.reduce((a, [, u]) => a + u.cost, 0) / l.length; };
            ok('higher grades cost more (on average 1 < 2 < 3 < 4)', avgCost(1) < avgCost(2) && avgCost(2) < avgCost(3) && avgCost(3) < avgCost(4), [1, 2, 3, 4].map(avgCost));
            ok('every color has creature and spell modules in all four grades', ASCENT_COLORS.every(ch => ['creature', 'spell'].every(on => [1, 2, 3, 4].every(g => U.some(([, u]) => u.on === on && u.grade === g && u.cols.includes(ch))))), ASCENT_COLORS.flatMap(ch => ['creature', 'spell'].flatMap(on => [1, 2, 3, 4].filter(g => !U.some(([, u]) => u.on === on && u.grade === g && u.cols.includes(ch))).map(g => ch + on + g))));
            ok('grades follow mana value: 0-2 minor, 3-4 solid, 5 strong, 6+ game-warping', [[0, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 4], [9, 4]].every(([cmc, g]) => ascentGrade({ cmc }) === g));
            ok('game-warping modules are only on 6+ mana cards, color-matched', (() => {
                const small = pick(c => c.type === 'creature' && c.colors === 'B' && c.cmc <= 4), big = pick(c => c.type === 'creature' && c.colors === 'B' && c.cmc >= 6), wrongColor = pick(c => c.type === 'creature' && c.colors === 'W' && c.cmc >= 6);
                return /mana value 6/.test(ascentUpgradeBlocked({ card: small, copy: { u: [] } }, 'wrath') || '') && !ascentUpgradeBlocked({ card: big, copy: { u: [] } }, 'wrath') && /B card/.test(ascentUpgradeBlocked({ card: wrongColor, copy: { u: [] } }, 'wrath') || '');
            })());
            const colorless = pick(c => c.type === 'creature' && !c.colors && c.cmc <= 2 && c.rarity === 'common');
            ok('a colorless card takes colored modules for +50%', colorless && !ascentUpgradeBlocked({ card: colorless, copy: { u: [] } }, 'haste') && ascentUpgradeCost('haste', colorless) === Math.round(40 * 1.5 / 5) * 5 && ascentUpgradeCost('plus20', colorless) === 30);
            ok('price = base x rarity x stack factor (each extra module costs much more)', (() => {
                const c = { rarity: 'rare', colors: 'R' }; // haste base 40, rare x2
                return [0, 1, 2, 3, 4, 5].map(n => ascentUpgradeCost('haste', c, n)).join() === [80, 120, 200, 320, 560, 960].join();
            })(), [0, 1, 2, 3, 4, 5].map(n => ascentUpgradeCost('haste', { rarity: 'rare', colors: 'R' }, n)));

            // ---- salvage: scrap spare cards, unlock modules for good ----
            st.aether = 1000;
            const w3 = pick(c => c.type === 'creature' && c.colors === 'W' && c.cmc === 3 && c.rarity === 'common' && !(c.kws || []).length && !(c.tags || []).length);
            ascentAddCards([1, 2, 3, 4].map(() => ({ id: w3.id, foil: false })));
            const wc = st.owned[w3.id].c;
            let res = upgradeAscentCopy(wc[0].k, 'flying');
            ok('a Solid module is locked until it is unlocked with salvage', !res.ok && /Locked/.test(res.why) && !ascentModuleUnlocked('flying') && ascentModuleUnlocked('haste'), res.why);
            ok('Minor modules are free to use', ascentModuleUnlocked('firststrike') && ascentModuleUnlocked('plus02'));
            ok('not enough salvage: unlocking fails and spends nothing', !unlockAscentModule('flying').ok && ascentSalvage().W === 0);
            const rareW = pick(c => c.colors === 'W' && c.type === 'creature' && c.rarity === 'rare'), mythW = pick(c => c.colors === 'W' && c.type === 'creature' && c.rarity === 'mythic');
            ascentAddCards([{ id: rareW.id, foil: false }, { id: rareW.id, foil: true }, { id: mythW.id, foil: false }]);
            const sc1 = scrapAscentCard(rareW.id, [st.owned[rareW.id].c[0].k]);
            ok('scrapping a rare gives 8 salvage in its color and removes the copy', sc1.ok && sc1.salvage === ASCENT_SCRAP.rare && ascentSalvage().W === 8 && st.owned[rareW.id].c.length === 1, sc1);
            const sc2 = scrapAscentCard(rareW.id, [st.owned[rareW.id].c[0].k]);
            ok('a foil gives double', sc2.ok && sc2.salvage === ASCENT_SCRAP.rare * 2 && ascentSalvage().W === 8 + 16, sc2);
            const dk = { name: 'S', cards: { [mythW.id]: 1 } }; st.decks.push(dk); ascentNormalizeDeck(dk);
            ok('a copy in a deck cannot be scrapped', !scrapAscentCard(mythW.id, [st.owned[mythW.id].c[0].k]).ok);
            st.decks.pop();
            const multi = pick(c => c.colors.length === 2 && c.type === 'creature' && c.rarity === 'common');
            ascentAddCards([{ id: multi.id, foil: false }]);
            const before2 = { ...ascentSalvage() };
            scrapAscentCard(multi.id, [st.owned[multi.id].c[0].k]);
            ok('a two-color card gives salvage to both colors', multi.colors.split('').every(ch => ascentSalvage()[ch] === (before2[ch] || 0) + 1), ascentSalvage());
            const ul = unlockAscentModule('flying');
            ok('with 24 salvage in white, flying (Solid, 10) unlocks for good and spends 10', ul.ok && ul.spent === 10 && ascentModuleUnlocked('flying') && ascentSalvage().W === 14 + (multi.colors.includes('W') ? 1 : 0), [ul, ascentSalvage()]);
            ok('Strong needs 30 and Game-warping 80 salvage', ASCENT_UNLOCK_SALVAGE[3] === 30 && ASCENT_UNLOCK_SALVAGE[4] === 80 && !unlockAscentModule('wlord2').ok);
            ok('trophies cannot be scrapped', (() => { const t = ASCENT.roster.find(c => c.rarity === 'trophy'); ascentAddCards([{ id: t.id, foil: false }]); return !scrapAscentCard(t.id, [st.owned[t.id].c[0].k]).ok; })());

            // ---- buying one on a single copy ----
            const w0 = wc[0].k;
            res = upgradeAscentCopy(w0, 'flying');
            ok('flying on a common costs 90 Aether, on that one copy', res.ok && res.price === 90 && res.aether === 90 && st.aether === 910 && wc[0].u.join() === 'flying' && wc[1].u.length === 0, res);
            res = upgradeAscentCopy(w0, 'flying');
            ok('the same module cannot be added twice', !res.ok && /Already/.test(res.why), res.why);
            res = upgradeAscentCopy(w0, 'plus11');
            ok('a second module costs x1.5 (60 -> 90)', !res.ok && /Locked|salvage/.test(res.why) ? true : (res.ok && res.price === 90), res);
            res = upgradeAscentCopy(w0, 'plus02');
            ok('a second Minor module costs 25 x 1.5 = 40 (rounded to 5)', res.ok && res.price === 40 && wc[0].u.length === 2, res);
            res = upgradeAscentCopy(w0, 'plus20');
            ok('a third costs 30 x 2.5 = 75', res.ok && res.price === 75 && wc[0].u.length === 3, res);
            let n = wc[0].u.length;
            for (const m of ['firststrike', 'vigilance', 'dielife']) { if (wc[0].u.length >= ASCENT_MAX_MODULES) break; st.aether += 5000; upgradeAscentCopy(w0, m); }
            st.aether += 5000; res = upgradeAscentCopy(w0, 'etblife');
            ok(`at most ${ASCENT_MAX_MODULES} modules per copy`, !res.ok && /At most/.test(res.why) && wc[0].u.length === ASCENT_MAX_MODULES, [res.why, wc[0].u.length]);
            ok('a spell module cannot go on a creature', !upgradeAscentCopy(wc[2].k, 'sdraw').ok);
            const printedKw = ASCENT.roster.find(c => c.type === 'creature' && (c.kws || []).includes('flying') && c.colors === 'W' && c.cmc >= 3);
            ascentAddCards([{ id: printedKw.id, foil: false }]);
            ok('a keyword the card already has cannot be added', !upgradeAscentCopy(st.owned[printedKw.id].c[0].k, 'flying').ok);
            const dupLine = pick(c => c.type === 'creature' && (c.tags || []).includes('etb-draw') && c.colors === 'U' && c.cmc >= 3);
            ok('a line the card already has cannot be added again', !dupLine || /already/.test(ascentUpgradeBlocked({ card: dupLine, copy: { u: [] } }, 'etbdraw') || ''), dupLine && ascentUpgradeBlocked({ card: dupLine, copy: { u: [] } }, 'etbdraw'));

            // ---- paying with spare copies ----
            st.aether = 10;
            res = upgradeAscentCopy(wc[3].k, 'vigilance');
            ok('not enough Aether blocks it and spends nothing', !res.ok && st.aether === 10, res);
            // wc[2] is plain: it covers 2 x 3 (common dust) = 6 of the 30
            st.aether = 24;
            res = upgradeAscentCopy(wc[3].k, 'vigilance', [wc[2].k]);
            ok('feeding in a spare copy covers 6 of the 30 (24 Aether is exactly enough)', res.ok && res.sacrificed === 1 && st.aether === 0 && st.owned[w3.id].c.length === 3 && st.owned[w3.id].n === 3, res);
            ok('an upgraded copy cannot be fed in', !upgradeAscentCopy(wc[1].k, 'reach', [w0]).ok);

            // ---- swapping and removing ----
            st.aether = 2000;
            const before = st.aether;
            res = swapAscentUpgrade(w0, 0, 'vigilance');
            ok('a swap for a module the copy already has is refused', !res.ok, res);
            const sw0 = st.aether; res = swapAscentUpgrade(w0, 0, 'etblife'); // flying (slot 0) -> etblife: fee 1/4 of 90 + 20 x stack(0)
            ok('swapping flying for enters-gain-life costs a quarter of flying (25) plus 20', res.ok && res.fee === 25 && sw0 - st.aether === 45 && wc[0].u[0] === 'etblife', res);
            res = swapAscentUpgrade(wc[1].k, 0, null);
            ok('removing a module that is not there fails cleanly', !res.ok);
            const before3 = st.aether; res = swapAscentUpgrade(w0, 5, null);
            ok('removing a module costs only the fee and frees the slot', res.ok && res.fee >= 5 && wc[0].u.length === ASCENT_MAX_MODULES - 1 && before3 - st.aether === res.total, res);

            // ---- decks use the chosen copies ----
            const deck = { name: 'T', cards: { [w3.id]: 2 } };
            st.decks.push(deck); ascentNormalizeDeck(deck);
            ok('a deck without a copy list takes upgraded copies first', deck.sel[w3.id].length === 2 && deck.sel[w3.id].every(k => wc.find(c => c.k === k).u.length));
            const play = ascentPlayableCards(deck);
            ok('the playable list swaps in the upgraded variants', Object.keys(play).length === 2 && Object.keys(play).every(id => id.includes('~')) && Object.values(play).reduce((a, b) => a + b, 0) === 2, Object.keys(play));
            ok('copies in a deck are not offered for dusting', !dustAscentCard(w3.id, 3).ok);
            ok('dust is halved (3 / 10 / 30 / 100)', ASCENT_DUST.common === 3 && ASCENT_DUST.uncommon === 10 && ASCENT_DUST.rare === 30 && ASCENT_DUST.mythic === 100);
            ok('no broken state', Object.values(st.owned).every(o => !o.c || (o.n === o.c.length)));
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentupg', results, []);
    await h.close();
})();
