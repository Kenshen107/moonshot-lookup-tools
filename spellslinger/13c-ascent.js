// Planeswalker's Ascent (campaign rebuild, plan in docs/spellslinger-ascent-plan.md).
// This file: the card roster, the 14-slot Play Booster and the Collector Booster, the rule of 4 and the Aether (crafting) economy.
// Ascent has its own collection (profile.ascent.owned) and its own money (Aether), separate from Sandbox and the Shop.
// The roster is spellslinger/data/ascent-roster.json, written by `node tests/ascent_roster.js`.
const ASCENT = { roster: null, byId: new Map(), byName: new Map(), loading: null };
const ASCENT_COPY_LIMIT = 4;
const ASCENT_RARITIES = ['common', 'uncommon', 'rare', 'mythic']; // packs; 'trophy' cards (13d) are won only, one copy each
// Aether: leftover copies dust into it, missing cards are crafted with it (foils count double when dusted, cost 2x to craft)
const ASCENT_DUST = { common: 3, uncommon: 10, rare: 30, mythic: 100 }; // halved 2026-10-19: Aether now comes in slower (a pack is about 100, not 200)
const ASCENT_CRAFT = { common: 20, uncommon: 80, rare: 240, mythic: 800 };
// How rarity is rolled in the open slots (weights, a game choice)
const ASCENT_FOIL_SLOT = { common: 56, uncommon: 30, rare: 11, mythic: 3 };
const ASCENT_WILD_SLOT = { common: 45, uncommon: 30, rare: 20, mythic: 5 };
const ASCENT_MYTHIC_UPGRADE = 1 / 7;
const ASCENT_LIST_CHANCE = 0.125;
const ASCENT_WILD_FOIL = 1 / 6;

async function loadAscentRoster() {
    if (ASCENT.roster) return ASCENT.roster;
    if (!ASCENT.loading) ASCENT.loading = (async () => {
        const r = await fetch('spellslinger/data/ascent-roster.json');
        if (!r.ok) throw new Error('The Ascent card list could not be loaded.');
        const data = await r.json();
        ASCENT.roster = data.cards;
        data.cards.forEach(c => { ASCENT.byId.set(c.id, c); ASCENT.byName.set(c.name, c); });
        return ASCENT.roster;
    })();
    return ASCENT.loading;
}
function ascentState() {
    if (!profile.ascent) profile.ascent = { aether: 0, owned: {}, decks: [], progress: [], packs: 0, dustedTotal: 0, craftedTotal: 0 };
    return profile.ascent;
}
// pools by group; the roster has no tokens, so The List slot uses a rare/mythic card
function ascentPools() {
    if (ASCENT.pools) return ASCENT.pools;
    // signature cards (13d) only drop from their opponent, so they stay out of packs
    const sigs = typeof ascentSignatures === 'function' ? (ascentSignatures(), ASCENT.sigSet) : new Set();
    const nonLand = ASCENT.roster.filter(c => c.type !== 'land' && c.rarity !== 'trophy' && !sigs.has(c.id)); // trophy cards are never in packs
    const by = r => nonLand.filter(c => c.rarity === r);
    ASCENT.pools = {
        common: by('common'), uncommon: by('uncommon'), rare: by('rare'), mythic: by('mythic'),
        basics: ASCENT.roster.filter(c => c.kind === 'basic'), duals: ASCENT.roster.filter(c => c.kind === 'tapdual')
    };
    return ASCENT.pools;
}
function ascentWeighted(table, rng) {
    const total = ASCENT_RARITIES.reduce((a, r) => a + table[r], 0);
    let x = rng() * total;
    for (const r of ASCENT_RARITIES) { if ((x -= table[r]) < 0) return r; }
    return 'common';
}
// One Play Booster. Slots 1-6 commons, 7-9 uncommons, 10 rare (1 in 7 a mythic), 11 foil of any rarity, 12 wildcard (1 in 6 foil),
// 13 a basic land, 14 The List: a dual land, or 1 time in 8 a rare or mythic. No card repeats inside a pack except basics.
function rollAscentPlayBooster(rng = Math.random) {
    const P = ascentPools(), seen = new Set(), cards = [];
    const take = (pool, slot, foil = false) => {
        let c = pool[Math.floor(rng() * pool.length)];
        for (let i = 0; i < 12 && seen.has(c.id); i++) c = pool[Math.floor(rng() * pool.length)];
        if (c.kind !== 'basic') seen.add(c.id);
        cards.push({ id: c.id, foil, slot });
        return c;
    };
    for (let s = 1; s <= 6; s++) take(P.common, s);
    for (let s = 7; s <= 9; s++) take(P.uncommon, s);
    take(rng() < ASCENT_MYTHIC_UPGRADE ? P.mythic : P.rare, 10);
    take(P[ascentWeighted(ASCENT_FOIL_SLOT, rng)], 11, true);
    take(P[ascentWeighted(ASCENT_WILD_SLOT, rng)], 12, rng() < ASCENT_WILD_FOIL);
    take(P.basics, 13);
    if (rng() < ASCENT_LIST_CHANCE) take(rng() < 0.3 ? P.mythic : P.rare, 14); else take(P.duals, 14);
    return cards;
}
// The Collector Booster (boss prize): 14 cards, all foil, at least 5 rares or mythics
function rollAscentCollectorBooster(rng = Math.random) {
    const P = ascentPools(), seen = new Set(), cards = [];
    const take = (pool, slot) => {
        let c = pool[Math.floor(rng() * pool.length)];
        for (let i = 0; i < 12 && seen.has(c.id); i++) c = pool[Math.floor(rng() * pool.length)];
        if (c.kind !== 'basic') seen.add(c.id);
        cards.push({ id: c.id, foil: true, slot });
    };
    for (let s = 1; s <= 3; s++) take(P.common, s);
    for (let s = 4; s <= 6; s++) take(P.uncommon, s);
    for (let s = 7; s <= 11; s++) take(rng() < 0.2 ? P.mythic : P.rare, s);
    take(P[ascentWeighted({ common: 0, uncommon: 30, rare: 55, mythic: 15 }, rng)], 12);
    take(P.duals, 13);
    take(P.basics, 14);
    return cards;
}
// Every non-basic copy you own is its own record { k, f, u }: k a unique key, f 1 if foil, u its upgrades (13e-ascent-upgrades.js).
// owned[id] = { n, f, c: [copies] }; n and f stay in step with c so older code can still read the counts. Basics are only counted.
function ascentSyncOwned(o) { if (!o.c) return; o.n = o.c.length; o.f = o.c.filter(x => x.f).length; }
function ascentNewCopy(foil) { const st = ascentState(); st.nextKey = (st.nextKey || 0) + 1; return { k: st.nextKey, f: foil ? 1 : 0, u: [] }; }
function ascentOwnedEntry(id) {
    const st = ascentState(), o = st.owned[id] || (st.owned[id] = { n: 0, f: 0, c: [] });
    if (!o.c) { o.c = []; for (let i = 0; i < o.n; i++) o.c.push(ascentNewCopy(i < o.f)); } // an older save with counts only
    return o;
}
// Adds cards to the Ascent collection. The 5th and later copy of a card is dusted into Aether on the spot (the rule of 4).
function ascentAddCards(picks) {
    const st = ascentState(), report = { kept: [], dusted: [], aether: 0 };
    for (const p of picks) {
        const c = ASCENT.byId.get(p.id);
        if (!c) continue;
        if (c.kind === 'basic') { const o = st.owned[p.id] || (st.owned[p.id] = { n: 0, f: 0 }); o.n += 1; if (p.foil) o.f += 1; report.kept.push(p); continue; } // basics are free and unlimited
        const o = ascentOwnedEntry(p.id);
        if (c.rarity === 'trophy') { if (!o.c.length) { o.c.push(ascentNewCopy(false)); ascentSyncOwned(o); report.kept.push(p); } continue; } // one of each, never dusted
        if (o.c.length < ASCENT_COPY_LIMIT) { o.c.push(ascentNewCopy(p.foil)); ascentSyncOwned(o); report.kept.push(p); continue; }
        const v = ASCENT_DUST[c.rarity] * (p.foil ? 2 : 1);
        report.dusted.push({ ...p, aether: v }); report.aether += v;
    }
    st.aether += report.aether; st.dustedTotal += report.aether;
    return report;
}
function openAscentPack(kind = 'play', rng = Math.random) {
    const picks = kind === 'collector' ? rollAscentCollectorBooster(rng) : rollAscentPlayBooster(rng);
    const report = ascentAddCards(picks);
    ascentState().packs++;
    return { kind, picks, report };
}
function ascentCraftCost(card, foil = false) { return ASCENT_CRAFT[card.rarity] * (foil ? 2 : 1); }
// Craft a missing card with Aether. Returns { ok, why }.
function craftAscentCard(id, foil = false) {
    const c = ASCENT.byId.get(id), st = ascentState();
    if (!c || c.type === 'land') return { ok: false, why: 'Lands are free: basics are unlimited and duals come from packs.' };
    if (c.rarity === 'trophy') return { ok: false, why: 'Trophy cards cannot be crafted: win them against their opponent.' };
    const have = st.owned[id] ? st.owned[id].n : 0;
    if (have >= ASCENT_COPY_LIMIT) return { ok: false, why: `You already own ${ASCENT_COPY_LIMIT} copies.` };
    const cost = ascentCraftCost(c, foil);
    if (st.aether < cost) return { ok: false, why: `Needs ${cost} Aether (you have ${st.aether}).` };
    st.aether -= cost; st.craftedTotal += cost;
    const o = ascentOwnedEntry(id);
    o.c.push(ascentNewCopy(foil)); ascentSyncOwned(o);
    return { ok: true, cost };
}
// Which copy keys are in a deck. A deck lists its copies in deck.sel[id]; one without a list gets one made, upgraded copies first.
function ascentNormalizeDeck(deck) {
    deck.sel = deck.sel || {};
    for (const [id, n] of Object.entries(deck.cards)) {
        const c = ASCENT.byId.get(id);
        if (!c || c.kind === 'basic') continue;
        const o = ascentOwnedEntry(id), have = (deck.sel[id] || []).filter(k => o.c.some(x => x.k === k));
        const rest = o.c.filter(x => !have.includes(x.k)).sort((a, b) => b.u.length - a.u.length || a.k - b.k);
        while (have.length < n && rest.length) have.push(rest.shift().k);
        deck.sel[id] = have.slice(0, n);
    }
    return deck;
}
function ascentKeysInDecks(except) {
    const keys = new Set();
    ascentState().decks.forEach(d => { if (d === except) return; ascentNormalizeDeck(d); Object.values(d.sel).flat().forEach(k => keys.add(k)); });
    return keys;
}
// Dust copies by hand: only copies that are in no deck and carry no upgrades, unless you name the copies (keys) yourself
function dustAscentCard(id, n = 1, keys = null) {
    const c = ASCENT.byId.get(id), st = ascentState(), o = st.owned[id];
    if (!c || !o || c.kind === 'basic') return { ok: false, why: 'Nothing to dust.' };
    if (c.rarity === 'trophy') return { ok: false, why: 'Trophy cards cannot be dusted.' };
    ascentOwnedEntry(id);
    const used = ascentKeysInDecks();
    let list = o.c.filter(x => !used.has(x.k) && (keys ? keys.includes(x.k) : !x.u.length)).sort((a, b) => a.f - b.f || a.k - b.k);
    if (list.length < n) return { ok: false, why: list.length === 0 ? 'Every copy is in a deck or upgraded.' : `Only ${list.length} spare.` };
    list = list.slice(0, n);
    let gain = 0;
    list.forEach(x => { gain += ASCENT_DUST[c.rarity] * (x.f ? 2 : 1); o.c.splice(o.c.indexOf(x), 1); });
    ascentSyncOwned(o);
    st.aether += gain; st.dustedTotal += gain;
    return { ok: true, aether: gain };
}
