// Planeswalker's Ascent deck power: features, the Elo-style rating, opponents ordered by league, and the numbers on the screen.
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
            ok('the fitted weights file loaded', !!ASCENT_POWER.fitted && ASCENT_POWER.fitted.games >= 5000 && ASCENT_POWER_FEATURES.every(k => typeof ASCENT_POWER.weights[k] === 'number'), ASCENT_POWER.fitted);
            ok('the fit predicts who wins clearly better than a coin flip (held-out)', ASCENT_POWER.fitted.cvAccuracy >= ASCENT_POWER.fitted.baselineAccuracy + 0.04, [ASCENT_POWER.fitted.cvAccuracy, ASCENT_POWER.fitted.baselineAccuracy]);
            ok('no weight is negative (more of anything never lowers power)', ASCENT_POWER_FEATURES.every(k => ASCENT_POWER.weights[k] >= 0), ASCENT_POWER.weights);
            // features
            const bear = ASCENT.roster.find(c => c.type === 'creature' && c.kind === 'vanilla' && c.cmc <= 2 && c.colors === 'G'), big = ASCENT.roster.find(c => c.type === 'creature' && c.cmc >= 6 && c.colors === 'B');
            const f0 = ascentDeckFeatures({ [bear.id]: 4 }), f1 = ascentDeckFeatures({ [bear.id + '~firebreath+plus20']: 4 }), f2 = ascentDeckFeatures({ [big.id + '~wrath']: 1 });
            ok('a spell counts toward the base sum; basics do not', f0.spells === 4 && Math.abs(f0.base - 4 * Math.max(0.5, bear.power)) < 1e-9 && ascentDeckFeatures({ [ASCENT.roster.find(c => c.kind === 'basic').id]: 17 }).spells === 0);
            ok('modules count by grade, per copy', f1.m1 === 8 && f1.m2 === 0 && f2.m4 === 1 && f2.top === 1, [f1, f2]);
            ok('adding modules raises the power rating; a bigger module raises it more', ascentPowerRating(f1) > ascentPowerRating(f0) && ascentPowerRating(ascentDeckFeatures({ [big.id + '~wrath']: 1 })) > ascentPowerRating(ascentDeckFeatures({ [big.id]: 1 })));
            // Elo-style scale
            ok('100 points apart is about a 64% win chance, equal is 50%', Math.abs(ascentWinChance(200, 100) - 0.64) < 0.01 && ascentWinChance(100, 100) === 0.5);
            ok('matchup words follow the odds', ascentMatchupWords(300, 100).label === 'You are far ahead' && ascentMatchupWords(100, 100).label === 'An even match' && ascentMatchupWords(0, 250).label === 'You are far behind');
            // opponents
            const avg = tier => { const l = ASCENT_OPPONENTS.filter(o => o.tier === tier && !o.boss).map(o => ascentOpponentPower(o.id)); return l.reduce((a, b) => a + b, 0) / l.length; };
            ok('opponents get stronger league by league (average power 1 < 2 < 3)', avg(1) < avg(2) && avg(2) < avg(3), [1, 2, 3].map(avg));
            ok('the average tier 1 opponent is about 100 (the scale\'s anchor)', Math.abs(avg(1) - 100) <= 12, avg(1));
            // a player's deck
            ascentStarter('W');
            const deck = ascentState().decks[0], p0 = ascentDeckPower(deck);
            ok('a starter deck has a power in a sensible range', p0 > 0 && p0 < 400, p0);
            const st = ascentState(), nonBasic = Object.keys(deck.cards).find(id => ASCENT.byId.get(id).kind !== 'basic' && ASCENT.byId.get(id).type === 'creature');
            st.aether = 99999; const k = st.owned[nonBasic].c[0].k;
            upgradeAscentCopy(k, 'plus20'); upgradeAscentCopy(k, 'firebreath');
            ok('upgrading a card in the deck raises the deck power', ascentDeckPower(deck) > p0, [p0, ascentDeckPower(deck)]);
            ok('power does not need the card data to be loaded', (() => { const saved = CARDS.get(nonBasic); CARDS.delete(nonBasic); const v = ascentDeckPower(deck); CARDS.set(nonBasic, saved); return v === ascentDeckPower(deck); })());
            // the screen
            profile.mode = 'campaign'; showView('campaign'); await renderAscent();
            ASC.tab = 'decks'; ASC.deck = 0; ascDecks();
            ok('the Decks tab shows the deck power and the next opponent', /Power/.test(document.querySelector('.asc-deckhead').textContent) && /Next up/.test(document.querySelector('.asc-deckhead').textContent), document.querySelector('.asc-deckhead').textContent);
            ASC.opp = 't1-mick'; ASC.tab = 'map'; ascMap(); await ascOppPanel();
            ok('the opponent panel shows both powers and a verdict', /power \d+/.test(document.getElementById('ascOpp').textContent) && /about \d+%/.test(document.getElementById('ascOpp').textContent), document.querySelector('.asc-matchup') && document.querySelector('.asc-matchup').textContent);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentpower', results, []);
    await h.close();
})();
