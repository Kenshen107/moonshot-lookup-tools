// Planeswalker's Ascent: DECK POWER. One number for how strong a 40-card deck is, so the game can compare your deck with an opponent's
// (and, later, scale opponents, rewards and daily challenges to it).
//
// How it works: a deck is boiled down to a few counts (its features): the sum of its spells' base strength, how many modules it carries at
// each grade, and how many top-end cards (mana value 5+) it plays. Each feature has a weight that was FITTED from lab games
// (tests/ascent_power_fit.js plays ~100 varied decks against each other and fits a logistic model to who won), stored in
// spellslinger/data/ascent-power.json. The score is Elo-like: the weighted sum is scaled so 400 points = 10-to-1 odds, then shifted so an
// average tier 1 opponent is 100. So a deck 100 points above another should win about 64% of the time, 200 points about 76%.
// Re-run the fit whenever cards, modules or the AI change a lot; the game and the tests need nothing else.
const ASCENT_POWER = {
    // used until the fitted file loads (and if it is missing): rough guesses, never shown as exact
    weights: { base: 0.05, m1: 0.04, m2: 0.1, m3: 0.2, m4: 0.35, top: 0.03 },
    origin: 100, offset: 0, scale: 400 / Math.LN10, fitted: null
};
const ASCENT_POWER_FEATURES = ['base', 'm1', 'm2', 'm3', 'm4', 'top'];

// Loaded with the roster (loadAscentRoster in 13c); a missing file just leaves the defaults
async function loadAscentPower() {
    try {
        const r = await fetch('spellslinger/data/ascent-power.json');
        if (!r.ok) return;
        const d = await r.json();
        Object.assign(ASCENT_POWER, { weights: d.weights, offset: d.offset, fitted: d.fitted || null });
    } catch (e) { /* defaults stay */ }
}
// Features of a deck given as { card id (or variant id "<id>~<module>+<module>"): count }
function ascentDeckFeatures(cards) {
    const f = { base: 0, m1: 0, m2: 0, m3: 0, m4: 0, top: 0, spells: 0 };
    for (const [id, n] of Object.entries(cards)) {
        const [baseId, mods] = id.split('~'), r = ASCENT.byId.get(baseId);
        if (!r || r.type === 'land') continue;
        f.spells += n; f.base += n * Math.max(0.5, r.power);
        if (r.cmc >= 5) f.top += n;
        if (mods) mods.split('+').forEach(m => { const u = ASCENT_UPGRADES[m]; if (u) f['m' + u.grade] += n; });
    }
    return f;
}
function ascentPowerRaw(f, w = ASCENT_POWER.weights) { return ASCENT_POWER_FEATURES.reduce((a, k) => a + (w[k] || 0) * (f[k] || 0), 0); }
function ascentPowerRating(f) { return Math.round(ASCENT_POWER.origin + ASCENT_POWER.scale * (ascentPowerRaw(f) - ASCENT_POWER.offset)); }
// Power of a player's deck as it plays (upgraded copies count) and of an opponent's deck
function ascentDeckCardMap(deck) {
    // { card id or variant id: count } for a player's deck, from the copies they chose (needs no card data, so it works while cards still load)
    ascentNormalizeDeck(deck);
    const st = ascentState(), cards = {};
    for (const [id, n] of Object.entries(deck.cards)) {
        const r = ASCENT.byId.get(id);
        if (!r || r.kind === 'basic') { cards[id] = (cards[id] || 0) + n; continue; }
        const o = st.owned[id];
        for (const k of deck.sel[id]) {
            const c = o && o.c.find(x => x.k === k), key = c && c.u.length ? id + '~' + c.u.slice().sort().join('+') : id;
            cards[key] = (cards[key] || 0) + 1;
        }
    }
    return cards;
}
function ascentDeckPower(deck) { return ascentPowerRating(ascentDeckFeatures(ascentDeckCardMap(deck))); }
function ascentOpponentPower(oppId) {
    ASCENT.oppPower = ASCENT.oppPower || {};
    if (ASCENT.oppPower[oppId] === undefined) ASCENT.oppPower[oppId] = ascentPowerRating(ascentDeckFeatures(ascentOpponentDeck(ASCENT_OPP[oppId])));
    return ASCENT.oppPower[oppId];
}
// Chance the first deck beats the second, from the Elo-like difference
function ascentWinChance(powerA, powerB) { return 1 / (1 + Math.pow(10, (powerB - powerA) / 400)); }
// A plain-words read on a matchup
function ascentMatchupWords(mine, theirs) {
    const p = ascentWinChance(mine, theirs), pc = Math.round(p * 100);
    const label = p >= 0.75 ? 'You are far ahead' : p >= 0.6 ? 'You are favored' : p > 0.4 ? 'An even match' : p > 0.25 ? 'You are the underdog' : 'You are far behind';
    return { label, percent: pc };
}
