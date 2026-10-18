// Planeswalker's Ascent, part 3: card upgrades. Every copy you own can carry up to 2 upgrades (3 on a mythic): a keyword, a stat boost
// or a simple trigger for a creature, a small extra for a spell. Upgrades belong to the single copy, so your four Bears can all differ.
// An upgraded copy plays as its own card (id "<card id>~<upgrade ids>") whose rules text has the upgrade written into it, so the card reader
// understands it with no special rules. Paid with Aether, and/or by feeding in spare plain copies of the same card.
const ASCENT_UPGRADES = {
    // keywords (creatures)
    firststrike: { label: 'First strike', icon: '⚔️', kind: 'kw', kw: 'first strike', cost: 30, on: 'creature' },
    vigilance: { label: 'Vigilance', icon: '🛡️', kind: 'kw', kw: 'vigilance', cost: 30, on: 'creature' },
    reach: { label: 'Reach', icon: '🕸️', kind: 'kw', kw: 'reach', cost: 30, on: 'creature' },
    trample: { label: 'Trample', icon: '🐗', kind: 'kw', kw: 'trample', cost: 45, on: 'creature' },
    haste: { label: 'Haste', icon: '💨', kind: 'kw', kw: 'haste', cost: 45, on: 'creature' },
    lifelink: { label: 'Lifelink', icon: '💗', kind: 'kw', kw: 'lifelink', cost: 45, on: 'creature' },
    flying: { label: 'Flying', icon: '🪽', kind: 'kw', kw: 'flying', cost: 60, on: 'creature' },
    deathtouch: { label: 'Deathtouch', icon: '☠️', kind: 'kw', kw: 'deathtouch', cost: 60, on: 'creature' },
    menace: { label: 'Menace', icon: '👥', kind: 'kw', kw: 'menace', cost: 60, on: 'creature' },
    hexproof: { label: 'Hexproof', icon: '🔮', kind: 'kw', kw: 'hexproof', cost: 75, on: 'creature' },
    // stats (creatures; one per copy)
    plus11: { label: '+1/+1', icon: '💪', kind: 'stat', p: 1, t: 1, cost: 40, on: 'creature' },
    plus20: { label: '+2/+0', icon: '🗡️', kind: 'stat', p: 2, t: 0, cost: 35, on: 'creature' },
    plus02: { label: '+0/+2', icon: '🧱', kind: 'stat', p: 0, t: 2, cost: 30, on: 'creature' },
    // simple triggers (creatures)
    etbdraw: { label: 'Enters: draw a card', icon: '📖', kind: 'trig', line: n => `When ${n} enters, draw a card.`, cost: 70, on: 'creature' },
    dielife: { label: 'Dies: gain 3 life', icon: '🌱', kind: 'trig', line: n => `When ${n} dies, you gain 3 life.`, cost: 25, on: 'creature' },
    etblife: { label: 'Enters: gain 2 life', icon: '🍀', kind: 'trig', line: n => `When ${n} enters, you gain 2 life.`, cost: 20, on: 'creature' },
    // spells
    sdraw: { label: 'Cantrip: draw a card', icon: '📖', kind: 'spell', append: ' Draw a card.', cost: 50, on: 'spell' },
    slife: { label: 'Gain 3 life', icon: '🍀', kind: 'spell', append: ' You gain 3 life.', cost: 25, on: 'spell' }
};
const ASCENT_UPGRADE_RARITY = { common: 1, uncommon: 1.5, rare: 2, mythic: 3 };
const ASCENT_SWAP_FEE = 0.25;      // swapping or removing an upgrade costs this share of the old upgrade's price
const ASCENT_SACRIFICE_VALUE = 2;  // a spare plain copy fed in covers this many times its dust value

function ascentUpgradeSlots(card) { return card.rarity === 'mythic' ? 3 : 2; }
function ascentUpgradeCost(upId, card) { return Math.round(ASCENT_UPGRADES[upId].cost * ASCENT_UPGRADE_RARITY[card.rarity] / 5) * 5; }
function ascentFindCopy(key) {
    const st = ascentState();
    for (const [id, o] of Object.entries(st.owned)) { if (!o.c) continue; const copy = o.c.find(x => x.k === key); if (copy) return { id, o, copy, card: ASCENT.byId.get(id) }; }
    return null;
}
// Why this copy cannot take this upgrade right now (null when it can)
function ascentUpgradeBlocked(found, upId, replacingIndex = -1) {
    const up = ASCENT_UPGRADES[upId], { card, copy } = found;
    if (!up) return 'No such upgrade.';
    if (up.on !== card.type) return up.on === 'creature' ? 'Creatures only.' : 'Spells only.';
    const rest = copy.u.filter((_, i) => i !== replacingIndex);
    if (rest.includes(upId)) return 'Already on this copy.';
    if (rest.length >= ascentUpgradeSlots(card)) return 'No free slot.';
    if (up.kind === 'kw' && (card.kws || []).includes(up.kw)) return `Already has ${up.label.toLowerCase()}.`;
    if (up.kind === 'stat' && rest.some(u => ASCENT_UPGRADES[u].kind === 'stat')) return 'One stat boost per copy.';
    if (up.kind === 'trig' && rest.some(u => ASCENT_UPGRADES[u].kind === 'trig')) return 'One trigger per copy.';
    return null;
}
// Spare plain copies of the same card that could be fed in (not in a deck, no upgrades, not the target)
function ascentSacrificeCandidates(found) {
    const used = ascentKeysInDecks();
    return found.o.c.filter(x => x.k !== found.copy.k && !x.u.length && !used.has(x.k));
}
function ascentSacrificeValue(card, copy) { return ASCENT_DUST[card.rarity] * ASCENT_SACRIFICE_VALUE * (copy.f ? 2 : 1); }
// Add an upgrade to a copy. sacrifice: keys of spare plain copies to feed in; the rest of the price is paid in Aether.
function upgradeAscentCopy(key, upId, sacrifice = []) {
    const st = ascentState(), found = ascentFindCopy(key);
    if (!found) return { ok: false, why: 'You do not own that copy.' };
    const why = ascentUpgradeBlocked(found, upId);
    if (why) return { ok: false, why };
    const cands = ascentSacrificeCandidates(found), feed = sacrifice.map(k => cands.find(x => x.k === k)).filter(Boolean);
    if (feed.length !== sacrifice.length) return { ok: false, why: 'One of those copies cannot be used.' };
    const price = ascentUpgradeCost(upId, found.card), covered = feed.reduce((a, x) => a + ascentSacrificeValue(found.card, x), 0);
    const aether = Math.max(0, price - covered);
    if (st.aether < aether) return { ok: false, why: `Needs ${aether} more Aether (you have ${st.aether}).` };
    feed.forEach(x => found.o.c.splice(found.o.c.indexOf(x), 1));
    st.aether -= aether; st.upgradedTotal = (st.upgradedTotal || 0) + 1;
    found.copy.u.push(upId);
    ascentSyncOwned(found.o);
    return { ok: true, price, aether, sacrificed: feed.length };
}
// Swap or remove the upgrade in a slot. The old one is lost; the fee is a quarter of its price.
function swapAscentUpgrade(key, slot, newUpId = null) {
    const st = ascentState(), found = ascentFindCopy(key);
    if (!found || !found.copy.u[slot]) return { ok: false, why: 'Nothing in that slot.' };
    const old = found.copy.u[slot];
    if (newUpId) { const why = ascentUpgradeBlocked(found, newUpId, slot); if (why) return { ok: false, why }; }
    const fee = Math.max(5, Math.round(ascentUpgradeCost(old, found.card) * ASCENT_SWAP_FEE / 5) * 5);
    const extra = newUpId ? ascentUpgradeCost(newUpId, found.card) : 0;
    // a swap pays the fee plus the new upgrade's price; removing pays only the fee
    const total = fee + extra;
    if (st.aether < total) return { ok: false, why: `Needs ${total} Aether (you have ${st.aether}).` };
    st.aether -= total;
    if (newUpId) found.copy.u[slot] = newUpId; else found.copy.u.splice(slot, 1);
    return { ok: true, fee, total };
}
// The card an upgraded copy plays as. The text gets the upgrade written in, so the card reader treats it like any printed card.
function ascentVariantCard(base, ups) {
    if (!ups.length) return base;
    const id = base.id + '~' + ups.slice().sort().join('+');
    if (CARDS.has(id)) return CARDS.get(id);
    const v = { ...base, id, upgrades: ups.slice(), _r: undefined };
    delete v._r;
    let text = base.text || '', kws = [], p = base.power, t = base.toughness;
    for (const u of ups) {
        const up = ASCENT_UPGRADES[u];
        if (up.kind === 'kw') kws.push(up.kw);
        else if (up.kind === 'stat') { p = String(Number(p) + up.p); t = String(Number(t) + up.t); }
        else if (up.kind === 'trig') text += (text ? '\n' : '') + up.line(base.name);
        else if (up.kind === 'spell') text = text.replace(/\n+/g, ' ').trim() + up.append;
    }
    if (kws.length) text = (text ? text + '\n' : '') + kws.map(k => k[0].toUpperCase() + k.slice(1)).join(', ');
    v.text = text; v.power = p; v.toughness = t;
    CARDS.set(id, v);
    return v;
}
// A deck's cards as the game plays them: { cardId (or variant id): count }
function ascentPlayableCards(deck) {
    ascentNormalizeDeck(deck);
    const out = {}, st = ascentState();
    for (const [id, n] of Object.entries(deck.cards)) {
        const base = CARDS.get(id), roster = ASCENT.byId.get(id);
        if (!roster || roster.kind === 'basic' || !base) { out[id] = (out[id] || 0) + n; continue; }
        const o = st.owned[id];
        for (const k of deck.sel[id]) {
            const copy = o.c.find(x => x.k === k), vid = copy && copy.u.length ? ascentVariantCard(base, copy.u).id : id;
            out[vid] = (out[vid] || 0) + 1;
        }
    }
    return out;
}
