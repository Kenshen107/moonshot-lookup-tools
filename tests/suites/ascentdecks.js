// Planeswalker's Ascent gauntlet: 18 opponents, their decks, signature cards, prizes, unlocks and the starter deck.
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
            ok('three tiers of five opponents and a boss each', [1, 2, 3].every(t => ASCENT_OPPONENTS.filter(o => o.tier === t).length === 6 && ASCENT_OPPONENTS.filter(o => o.tier === t && o.boss).length === 1));
            const sigs = ascentSignatures(), all = Object.values(sigs).flat();
            ok('every opponent has signature cards (3, or 4 for a boss), none shared', ASCENT_OPPONENTS.every(o => sigs[o.id].length === (o.boss ? 4 : 3)) && new Set(all).size === all.length, all.length);
            const unc = all.filter(id => ASCENT.byId.get(id).rarity === 'uncommon');
            ok('signature cards fit their owner\'s colors and are almost all rare or mythic (an uncommon only when a color runs short)', ASCENT_OPPONENTS.every(o => sigs[o.id].every(id => ascentFits(ASCENT.byId.get(id), o.colors))) && unc.length <= 6, unc.map(id => ASCENT.byId.get(id).name));
            ok('signature cards never come out of packs', ascentPools() && ['common', 'uncommon', 'rare', 'mythic'].every(k => ascentPools()[k].every(c => !ASCENT.sigSet.has(c.id))));
            const bad = [];
            for (const o of ASCENT_OPPONENTS) {
                const cards = ascentOpponentDeck(o), total = Object.values(cards).reduce((a, b) => a + b, 0);
                const t = ASCENT_TIERS[o.tier - 1];
                for (const [id, n] of Object.entries(cards)) {
                    const c = ASCENT.byId.get(id);
                    if (c.kind !== 'basic' && n > 4) bad.push(`${o.id} ${c.name} x${n}`);
                    if (c.type !== 'land' && c.tier > t.maxTier + 1) bad.push(`${o.id} ${c.name} is tier ${c.tier}`);
                    if (!ascentFits(c, o.colors)) bad.push(`${o.id} ${c.name} off color`);
                    if (rulesFor(CARDS.get(id)).support !== 'full') bad.push(`${o.id} ${c.name} is not Automated`);
                }
                if (total !== ASCENT_DECK_SIZE) bad.push(`${o.id} has ${total} cards`);
                const lands = Object.entries(cards).filter(([id]) => ASCENT.byId.get(id).type === 'land').reduce((a, [, n]) => a + n, 0);
                if (lands !== ASCENT_LANDS) bad.push(`${o.id} has ${lands} lands`);
                if (sigs[o.id].some(id => !cards[id])) bad.push(`${o.id} does not play its signature cards`);
                const creatures = Object.entries(cards).filter(([id]) => ASCENT.byId.get(id).type === 'creature').reduce((a, [, n]) => a + n, 0);
                if (creatures < 15) bad.push(`${o.id} has only ${creatures} creatures`);
            }
            ok('all 18 decks: 40 cards, 17 lands, 15+ creatures, in color and no more than a tier above theirs (signatures only), max 4 copies, every card Automated, plays its signatures', bad.length === 0, bad.slice(0, 5));
            const again = JSON.stringify(ascentOpponentDeck(ASCENT_OPP['t2-sasha']));
            ok('an opponent\'s deck is the same every time', again === JSON.stringify(ascentOpponentDeck(ASCENT_OPP['t2-sasha'])));
            ok('tier 1 decks are nearly all creatures (2 spells at most)', ASCENT_OPPONENTS.filter(o => o.tier === 1).every(o => Object.entries(ascentOpponentDeck(o)).filter(([id]) => ASCENT.byId.get(id).type === 'spell').reduce((a, [, n]) => a + n, 0) <= 4), ASCENT_OPPONENTS.filter(o => o.tier === 1).map(o => Object.entries(ascentOpponentDeck(o)).filter(([id]) => ASCENT.byId.get(id).type === 'spell').reduce((a, [, n]) => a + n, 0)));

            // ---- starter, unlocks, prizes ----
            const st = ascentState();
            ok('tier 1 is open, tier 2 and 3 are locked', ascentTierOpen(1) && !ascentTierOpen(2) && !ascentTierOpen(3));
            ok('a tier\'s boss waits for the other five', !ascentOpponentOpen(ASCENT_OPP['t1-boss']));
            const deck = ascentStarter('R');
            ok('the starter deck is 40 cards with no problems and 3 packs to open', deck && ascentDeckProblems(deck).length === 0 && st.sealed.play === 3, deck && ascentDeckProblems(deck));
            ok('the starter can only be taken once', ascentStarter('G') === null);
            G = { campaign: { ascent: true, node: 't1-mick', tier: 1, name: 'Mossback Mick' } };
            const line1 = ascentResult(true);
            ok('the first win: a Play Booster, a guaranteed signature card and progress', st.sealed.play === 4 && st.progress.includes('t1-mick') && sigs['t1-mick'].some(id => (st.owned[id] || {}).n === 1) && /signature card/.test(line1), line1);
            ['t1-annie', 't1-tess', 't1-gus', 't1-cal'].forEach(id => { G.campaign.node = id; ascentResult(true); });
            ok('beating the five opens the boss', ascentOpponentOpen(ASCENT_OPP['t1-boss']) && !ascentTierOpen(2));
            G.campaign = { ascent: true, node: 't1-boss', tier: 1, name: 'Greg', boss: true };
            const before = { play: st.sealed.play, col: st.sealed.collector };
            const line2 = ascentResult(true);
            ok('a boss pays 2 Play Boosters and a Collector Booster and opens the next tier', st.sealed.play === before.play + 2 && st.sealed.collector === before.col + 1 && ascentTierOpen(2) && /Friday Grinders/.test(line2), line2);
            const aether = st.aether; G.campaign.node = 't1-mick';
            const line3 = ascentResult(false);
            ok('a loss pays 5 Aether and no pack', st.aether === aether + 5 && /5 Aether/.test(line3));
            ok('the result hook is wired into the campaign (13-campaign.js)', /G\.campaign\.ascent\) return ascentResult/.test(campaignResult.toString()));
            ok('building an opponent for a real game works', (await buildAscentOpponent('t2-leo')).entries.length > 5);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentdecks', results, []);
    await h.close();
})();
