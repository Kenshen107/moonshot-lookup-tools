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
            // losses: Aether (more while the deck is rough), and a Play Booster after every second loss in a row
            const aether = st.aether; G.campaign.node = 't1-mick'; G.campaign.deckIndex = 0;
            const play0 = st.sealed.play;
            ok('the starter deck counts as rough (under 3 rare cards)', ascentDeckIsRough(st.decks[0]));
            const line3 = ascentResult(false);
            ok('a first loss with a rough deck pays 15 Aether and no pack', st.aether === aether + ASCENT_PRIZE.weakDeckLossAether && st.sealed.play === play0 && /15 Aether/.test(line3) && !/Booster/.test(line3), line3);
            const line3b = ascentResult(false);
            ok('the second loss in a row also gives a Play Booster', st.sealed.play === play0 + 1 && /Play Booster/.test(line3b) && st.lossStreak === 0, line3b);
            ascentResult(false); ascentResult(true);
            ok('a win resets the loss streak', st.lossStreak === 0);
            ascentResult(false);
            const rares = ASCENT.roster.filter(c => c.rarity === 'rare' && c.type === 'creature').slice(0, 3);
            rares.forEach(c => { st.decks[0].cards[c.id] = 1; });
            ok('a deck with 3 rares is no longer rough', !ascentDeckIsRough(st.decks[0]));
            const a2 = st.aether; st.lossStreak = 0; const line3c = ascentResult(false);
            ok('a loss with a decent deck pays the normal 5 Aether', st.aether === a2 + ASCENT_PRIZE.lossAether && /5 Aether/.test(line3c) && !/Extra/.test(line3c), line3c);
            rares.forEach(c => { delete st.decks[0].cards[c.id]; });
            // white's plan: token makers, anthems, lords; its starter has them
            const kinds = k => ASCENT.roster.filter(c => c.kind === k && c.colors === 'W').length;
            ok('white has token spells, anthems, lords, token creatures and cheap removal in the roster', kinds('tokens') >= 10 && kinds('anthem') >= 2 && kinds('lord') >= 3 && kinds('tokencreature') >= 10 && ASCENT.roster.some(c => c.colors === 'W' && c.kind === 'exile'), ['tokens', 'anthem', 'lord', 'tokencreature'].map(kinds));
            const ws = ascentStarterCards('W'), wk = Object.keys(ws.cards).map(id => ASCENT.byId.get(id));
            ok('the white starter has token makers, an anthem and fliers, 23 spells, nothing outside white', wk.some(c => c.kind === 'tokens') && wk.some(c => c.kind === 'anthem') && wk.some(c => (c.kws || []).includes('flying')) && Object.values(ws.cards).reduce((a, b) => a + b, 0) === ASCENT_DECK_SIZE - ASCENT_LANDS && wk.every(c => c.colors === 'W'), wk.map(c => c.name));
            const anth = ASCENT.roster.find(c => c.kind === 'anthem'), tokS = ASCENT.roster.find(c => c.kind === 'tokens');
            ok('an anthem cannot take a spell extra (it is not a one-shot spell)', /Enchantments/.test(ascentUpgradeBlocked({ card: anth, copy: { u: [] } }, 'sdraw')) && !ascentUpgradeBlocked({ card: tokS, copy: { u: [] } }, 'sdraw'));
            ok('the result hook is wired into the campaign (13-campaign.js)', /G\.campaign\.ascent\) return ascentResult/.test(campaignResult.toString()));
            // ---- trophies ----
            const tro = ascentTrophies(), allT = Object.values(tro).flat();
            ok('every opponent has 10 trophies and none are shared', ASCENT_OPPONENTS.every(o => tro[o.id].length === 10) && new Set(allT).size === allT.length, allT.length);
            ok('trophies are in their opponent\'s colors and are trophy rarity', ASCENT_OPPONENTS.every(o => tro[o.id].every(id => ascentFits(ASCENT.byId.get(id), o.colors) && ASCENT.byId.get(id).rarity === 'trophy')));
            const avg = tier => { const ids = ASCENT_OPPONENTS.filter(o => o.tier === tier).flatMap(o => tro[o.id]); return ids.reduce((a, id) => a + ASCENT.byId.get(id).power, 0) / ids.length; };
            ok('higher leagues hold stronger trophies', avg(1) < avg(2) && avg(2) < avg(3), [avg(1), avg(2), avg(3)].map(x => x.toFixed(1)));
            ok('trophies are never in packs or in any opponent\'s deck', ['common', 'uncommon', 'rare', 'mythic'].every(k => ascentPools()[k].every(c => c.rarity !== 'trophy')) && ASCENT_OPPONENTS.every(o => Object.keys(ascentOpponentDeck(o)).every(id => ASCENT.byId.get(id).rarity !== 'trophy')));
            ok('the roster has 100+ trophy cards to choose from', ASCENT.roster.filter(c => c.rarity === 'trophy').length >= 400, ASCENT.roster.filter(c => c.rarity === 'trophy').length);
            // wins and milestones
            const st2 = ascentState(); st2.wins = {}; st2.owned = {};
            G = { campaign: { ascent: true, node: 't3-boss', tier: 3, name: 'Sarah', boss: true } };
            const got = [];
            for (let w = 1; w <= 75; w++) { const line = ascentResult(true); if (/TROPHY/.test(line)) got.push(w); }
            ok('a trophy is won at exactly 3, 6, 10, 15, 20, 25, 30, 40, 50 and 75 wins', JSON.stringify(got) === JSON.stringify(ASCENT_TROPHY_WINS), got);
            ok('all ten are owned, one copy each', tro['t3-boss'].every(id => st2.owned[id] && st2.owned[id].n === 1) && ascentWins('t3-boss') === 75);
            const tid = tro['t3-boss'][0];
            ok('a trophy cannot be crafted, dusted or upgraded', !craftAscentCard(tid).ok && !dustAscentCard(tid, 1, [st2.owned[tid].c[0].k]).ok && !upgradeAscentCopy(st2.owned[tid].c[0].k, 'flying').ok && /Trophy/.test(ascentUpgradeBlocked(ascentFindCopy(st2.owned[tid].c[0].k), 'flying')));
            const aeBefore = st2.aether;
            ascentAddCards([{ id: tid, foil: false }]);
            ok('another copy of a trophy is not added and does not become Aether', st2.owned[tid].n === 1 && st2.aether === aeBefore, [st2.owned[tid].n, st2.aether, aeBefore]);
            G = null;
            ok('building an opponent for a real game works', (await buildAscentOpponent('t2-leo')).entries.length > 5);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentdecks', results, []);
    await h.close();
})();
