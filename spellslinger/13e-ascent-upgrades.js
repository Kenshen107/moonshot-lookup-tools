// Planeswalker's Ascent, part 3: card modules (the upgrades). A copy you own can carry several modules, written into its rules text, so the
// card reader understands it with no special rules. An upgraded copy plays as its own card (id "<card id>~<module ids>").
//
// How it is balanced (owner, 2026-10-19: "effects appropriate for mana values ... bigger mana valued cards have the most game warping effects"):
//  - GRADE comes from the card's mana value: 1 Minor (0-2), 2 Solid (3-4), 3 Strong (5), 4 Game-warping (6+). A card can take modules up to its own grade.
//  - COLOR: each module belongs to one or more colors (or is colorless). A card takes modules of its colors; a colorless card takes any, for +50%.
//  - UNLOCK: Minor modules are free. Solid, Strong and Game-warping ones are unlocked for good with Salvage, which you get by scrapping spare cards
//    (scrap a card of a color, get that color's salvage). Dusting still gives Aether.
//  - PRICE: base price x rarity x a steep stack factor (each extra module on the same copy costs much more), paid with Aether and/or spare plain copies.
//    There is no hard cap on how strong a copy can get, only on how much you will pay for it (6 modules at most).
const ASCENT_GRADES = { 1: 'Minor', 2: 'Solid', 3: 'Strong', 4: 'Game-warping' };
const ASCENT_UNLOCK_SALVAGE = { 1: 0, 2: 10, 3: 30, 4: 80 };
const ASCENT_SCRAP = { common: 1, uncommon: 3, rare: 8, mythic: 25 };   // salvage a scrapped card gives (foil x2), to each of its colors
const ASCENT_MAX_MODULES = 6;
const ASCENT_STACK_COST = [1, 1.5, 2.5, 4, 7, 12];                      // price factor for the 1st, 2nd ... 6th module on one copy
const ASCENT_COLORLESS_SURCHARGE = 1.5;
const ASCENT_COLORS = ['W', 'U', 'B', 'R', 'G'];
// m(label, icon, on, cols, grade, cost, how) - how: { kw } keyword, { p, t } stat, { line } a rules line, { append } a spell sentence
const _m = (label, icon, on, cols, grade, cost, how) => ({ label, icon, on, cols, grade, cost, ...how, kind: how.kw ? 'kw' : how.p !== undefined ? 'stat' : how.line ? 'line' : 'spell' });
const ASCENT_UPGRADES = {
    // ---- Minor (mana value 0-2) ----
    firststrike: _m('First strike', '⚔️', 'creature', 'WR', 1, 30, { kw: 'first strike' }),
    vigilance: _m('Vigilance', '🛡️', 'creature', 'WG', 1, 30, { kw: 'vigilance' }),
    reach: _m('Reach', '🕸️', 'creature', 'G', 1, 30, { kw: 'reach' }),
    trample: _m('Trample', '🐗', 'creature', 'GR', 1, 40, { kw: 'trample' }),
    haste: _m('Haste', '💨', 'creature', 'R', 1, 40, { kw: 'haste' }),
    prowess: _m('Prowess', '📜', 'creature', 'UR', 1, 35, { kw: 'prowess' }),
    flash: _m('Flash', '⚡', 'creature', 'U', 1, 35, { kw: 'flash' }),
    fear: _m('Fear', '👻', 'creature', 'B', 1, 40, { kw: 'fear' }),
    plus02: _m('+0/+2', '🧱', 'creature', 'C', 1, 25, { p: 0, t: 2 }),
    plus20: _m('+2/+0', '🗡️', 'creature', 'C', 1, 30, { p: 2, t: 0 }),
    firebreath: _m('Firebreathing', '🔥', 'creature', 'R', 1, 40, { line: () => '{R}: ~ gets +1/+0 until end of turn.' }),
    greendork: _m('Mana tap: {T} for {G}', '🌿', 'creature', 'G', 1, 45, { line: () => '{T}: Add {G}.' }),
    etblife: _m('Enters: gain 2 life', '🍀', 'creature', 'WG', 1, 20, { line: n => `When ${n} enters, you gain 2 life.` }),
    dielife: _m('Dies: gain 3 life', '🌱', 'creature', 'WBG', 1, 25, { line: n => `When ${n} dies, you gain 3 life.` }),
    escry: _m('Enters: scry 2', '🔭', 'creature', 'U', 1, 25, { line: n => `When ${n} enters, scry 2.` }),
    slife: _m('Gain 3 life', '🍀', 'spell', 'WG', 1, 25, { append: ' You gain 3 life.' }),
    sscry: _m('Scry 2', '🔭', 'spell', 'U', 1, 25, { append: ' Scry 2.' }),
    sping: _m('1 damage to each opponent', '🔥', 'spell', 'R', 1, 30, { append: ' It deals 1 damage to each opponent.' }),
    sdrain1: _m('Each opponent loses 2 life', '🦇', 'spell', 'B', 1, 30, { append: ' Each opponent loses 2 life.' }),
    // ---- Solid (mana value 3-4) ----
    flying: _m('Flying', '🪽', 'creature', 'WU', 2, 90, { kw: 'flying' }),
    lifelink: _m('Lifelink', '💗', 'creature', 'WB', 2, 70, { kw: 'lifelink' }),
    deathtouch: _m('Deathtouch', '☠️', 'creature', 'BG', 2, 90, { kw: 'deathtouch' }),
    menace: _m('Menace', '👥', 'creature', 'BR', 2, 80, { kw: 'menace' }),
    hexproof: _m('Hexproof', '🔮', 'creature', 'UG', 2, 90, { kw: 'hexproof' }),
    plus11: _m('+1/+1', '💪', 'creature', 'C', 2, 60, { p: 1, t: 1 }),
    anymana: _m('Aether tap: {T} for any color', '🌈', 'creature', 'C', 2, 100, { line: () => '{T}: Add one mana of any color.' }),
    etbdraw: _m('Enters: draw a card', '📖', 'creature', 'UBG', 2, 80, { line: n => `When ${n} enters, draw a card.` }),
    hitdraw: _m('Hits a player: draw a card', '🕵️', 'creature', 'UB', 2, 90, { line: n => `Whenever ${n} deals combat damage to a player, draw a card.` }),
    soldier: _m('Enters: make a 1/1 Soldier', '🪖', 'creature', 'W', 2, 80, { line: n => `When ${n} enters, create a 1/1 white Soldier creature token.` }),
    wlord: _m('Other creatures +0/+1', '🏰', 'creature', 'W', 2, 80, { line: () => 'Other creatures you control get +0/+1.' }),
    ebounce: _m('Enters: bounce a creature', '🌊', 'creature', 'U', 2, 90, { line: n => `When ${n} enters, return target creature to its owner's hand.` }),
    bdrain: _m('Dies: each opponent loses 2', '🦇', 'creature', 'B', 2, 80, { line: n => `When ${n} dies, each opponent loses 2 life.` }),
    bdiscard: _m('Enters: opponent discards', '🗑️', 'creature', 'B', 2, 80, { line: n => `When ${n} enters, each opponent discards a card.` }),
    eping: _m('Enters: 2 damage', '💥', 'creature', 'R', 2, 90, { line: n => `When ${n} enters, ${n} deals 2 damage to any target.` }),
    gcounter: _m('Enters: +1/+1 counter on a creature', '🌱', 'creature', 'G', 2, 80, { line: n => `When ${n} enters, put a +1/+1 counter on target creature.` }),
    ggrow: _m('Grows when it attacks', '📈', 'creature', 'G', 2, 100, { line: n => `Whenever ${n} attacks, put a +1/+1 counter on ${n}.` }),
    gland: _m('Enters: fetch a basic land', '⛰️', 'creature', 'G', 2, 90, { line: n => 'When ' + n + ' enters, search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' }),
    sdraw: _m('Cantrip: draw a card', '📖', 'spell', 'UBG', 2, 60, { append: ' Draw a card.' }),
    ssoldier: _m('Make a 1/1 Soldier', '🪖', 'spell', 'W', 2, 60, { append: ' Create a 1/1 white Soldier creature token.' }),
    sdiscard: _m('Each opponent discards a card', '🗑️', 'spell', 'B', 2, 60, { append: ' Each opponent discards a card.' }),
    streasure: _m('Make a Treasure', '💰', 'spell', 'RG', 2, 60, { append: ' Create a Treasure token.' }),
    sburn2: _m('2 damage to each opponent', '🔥', 'spell', 'R', 2, 60, { append: ' It deals 2 damage to each opponent.' }),
    // ---- Strong (mana value 5) ----
    doublestrike: _m('Double strike', '⚔️', 'creature', 'WR', 3, 220, { kw: 'double strike' }),
    indestructible: _m('Indestructible', '💎', 'creature', 'C', 3, 240, { kw: 'indestructible' }),
    ward2: _m('Ward {2}', '🔰', 'creature', 'WU', 3, 180, { kw: 'ward {2}' }),
    spirits: _m('Enters: two 1/1 flying Spirits', '👼', 'creature', 'W', 3, 230, { line: n => `When ${n} enters, create two 1/1 white Spirit creature tokens with flying.` }),
    wlord1: _m('Other creatures +1/+1', '🏰', 'creature', 'W', 3, 250, { line: () => 'Other creatures you control get +1/+1.' }),
    unblock: _m("Can't be blocked", '🌫️', 'creature', 'U', 3, 220, { line: n => `${n} can't be blocked.` }),
    edraw2: _m('Enters: draw two cards', '📚', 'creature', 'U', 3, 230, { line: n => `When ${n} enters, draw two cards.` }),
    ekill: _m('Enters: destroy a creature', '☠️', 'creature', 'B', 3, 260, { line: n => `When ${n} enters, destroy target creature an opponent controls.` }),
    bsiphon: _m('Attacks: drain 1', '🩸', 'creature', 'B', 3, 200, { line: n => `Whenever ${n} attacks, each opponent loses 1 life and you gain 1 life.` }),
    eburn3: _m('Enters: 3 damage', '🌋', 'creature', 'R', 3, 230, { line: n => `When ${n} enters, ${n} deals 3 damage to any target.` }),
    rattack: _m('Attacks: 2 damage', '🎯', 'creature', 'R', 3, 220, { line: n => `Whenever ${n} attacks, it deals 2 damage to any target.` }),
    gfight: _m('Enters: fights a creature', '🥊', 'creature', 'G', 3, 220, { line: n => `When ${n} enters, ${n} fights target creature you don't control.` }),
    gcounters2: _m('Enters with two +1/+1 counters', '🌳', 'creature', 'G', 3, 220, { line: n => `When ${n} enters, put two +1/+1 counters on ${n}.` }),
    gherd: _m('Grows with every creature', '🦬', 'creature', 'G', 3, 240, { line: n => `Whenever another creature you control enters, put a +1/+1 counter on ${n}.` }),
    sdraw2: _m('Draw two cards', '📚', 'spell', 'U', 3, 200, { append: ' Draw two cards.' }),
    ssoldiers: _m('Make two 1/1 Soldiers', '🪖', 'spell', 'W', 3, 180, { append: ' Create two 1/1 white Soldier creature tokens.' }),
    sdiscard2: _m('Each opponent discards two cards', '🗑️', 'spell', 'B', 3, 180, { append: ' Each opponent discards two cards.' }),
    sburn3: _m('3 damage to each opponent', '🔥', 'spell', 'R', 3, 180, { append: ' It deals 3 damage to each opponent.' }),
    sland: _m('Fetch a basic land', '⛰️', 'spell', 'G', 3, 180, { append: ' Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' }),
    // ---- Game-warping (mana value 6+) ----
    knights: _m('Enters: three 2/2 Knights', '🛡️', 'creature', 'W', 4, 600, { line: n => `When ${n} enters, create three 2/2 white Knight creature tokens with vigilance.` }),
    wlord2: _m('Other creatures +2/+2', '🏰', 'creature', 'W', 4, 650, { line: () => 'Other creatures you control get +2/+2.' }),
    wexile: _m('Enters: exile a creature', '✨', 'creature', 'W', 4, 650, { line: n => `When ${n} enters, exile target creature an opponent controls.` }),
    edraw3: _m('Enters: draw three cards', '🧠', 'creature', 'U', 4, 600, { line: n => `When ${n} enters, draw three cards.` }),
    ufly: _m('Other creatures have flying', '☁️', 'creature', 'U', 4, 650, { line: () => 'Other creatures you control have flying.' }),
    utap: _m('Enters: tap all their creatures', '🧊', 'creature', 'U', 4, 550, { line: n => `When ${n} enters, tap all creatures your opponents control.` }),
    uengine: _m('Draws every upkeep', '⚙️', 'creature', 'UB', 4, 700, { line: () => 'At the beginning of your upkeep, draw a card.' }),
    wrath: _m('Enters: destroy all other creatures', '🌑', 'creature', 'B', 4, 700, { line: n => `When ${n} enters, destroy all other creatures.` }),
    edict2: _m('Enters: they sacrifice two creatures', '🪦', 'creature', 'B', 4, 650, { line: n => `When ${n} enters, each opponent sacrifices two creatures.` }),
    reanimate: _m('Enters: reanimate a creature', '⚰️', 'creature', 'B', 4, 600, { line: n => `When ${n} enters, return target creature card from your graveyard to the battlefield.` }),
    eburn5: _m('Enters: 5 damage', '☄️', 'creature', 'R', 4, 650, { line: n => `When ${n} enters, ${n} deals 5 damage to any target.` }),
    sweep3: _m('Enters: 3 damage to every other creature', '🌋', 'creature', 'R', 4, 700, { line: n => `When ${n} enters, ${n} deals 3 damage to each other creature.` }),
    rwar: _m('Creatures +2/+0', '🚩', 'creature', 'R', 4, 600, { line: () => 'Creatures you control get +2/+0.' }),
    gcounters4: _m('Enters with four +1/+1 counters', '🏔️', 'creature', 'G', 4, 600, { line: n => `When ${n} enters, put four +1/+1 counters on ${n}.` }),
    ggrowth: _m('Grows every upkeep', '🌲', 'creature', 'G', 4, 650, { line: n => `At the beginning of your upkeep, put a +1/+1 counter on ${n}.` }),
    gtrample: _m('Creatures have trample', '🐘', 'creature', 'G', 4, 550, { line: () => 'Creatures you control have trample.' }),
    sdraw3: _m('Draw three cards', '🧠', 'spell', 'U', 4, 500, { append: ' Draw three cards.' }),
    sdrain4: _m('Drain 4', '🩸', 'spell', 'B', 4, 450, { append: ' Each opponent loses 4 life and you gain 4 life.' }),
    sburn4: _m('4 damage to each opponent', '☄️', 'spell', 'R', 4, 450, { append: ' It deals 4 damage to each opponent.' }),
    steam: _m('Your creatures +2/+2 this turn', '📣', 'spell', 'W', 4, 450, { append: ' Creatures you control get +2/+2 until end of turn.' }),
    sbeast: _m('Make a 3/3 Beast', '🐻', 'spell', 'G', 4, 450, { append: ' Create a 3/3 green Beast creature token.' })
};
const ASCENT_UPGRADE_RARITY = { common: 1, uncommon: 1.5, rare: 2, mythic: 3 };
const ASCENT_SWAP_FEE = 0.25;      // swapping or removing a module costs this share of its price
const ASCENT_SACRIFICE_VALUE = 2;  // a spare plain copy fed in covers this many times its dust value

function ascentUpgradeSlots() { return ASCENT_MAX_MODULES; }
// A card's grade from its mana value
function ascentGrade(card) { const v = card.cmc; return v <= 2 ? 1 : v <= 4 ? 2 : v === 5 ? 3 : 4; }
// Does a card's color allow a module? Colorless cards can take anything (at a surcharge); a module marked C fits every card.
function ascentColorFit(card, up) {
    if (up.cols === 'C') return 1;
    const cc = card.colors || '';
    if (!cc) return ASCENT_COLORLESS_SURCHARGE;
    return up.cols.split('').some(ch => cc.includes(ch)) ? 1 : 0;
}
// Price of the next module on a copy that already has `count` of them
function ascentUpgradeCost(upId, card, count = 0) {
    const up = ASCENT_UPGRADES[upId], fit = ascentColorFit(card, up) || 1;
    return Math.round(up.cost * ASCENT_UPGRADE_RARITY[card.rarity] * ASCENT_STACK_COST[Math.min(count, ASCENT_MAX_MODULES - 1)] * fit / 5) * 5;
}
// ---- Salvage and unlocking ----
function ascentSalvage() { const st = ascentState(); if (!st.salvage) st.salvage = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }; if (!st.modules) st.modules = {}; return st.salvage; }
function ascentModuleCols(up) { return up.cols === 'C' ? ['W', 'U', 'B', 'R', 'G', 'C'] : up.cols.split(''); }
function ascentSalvageFor(up) { const sv = ascentSalvage(); return ascentModuleCols(up).reduce((a, ch) => a + (sv[ch] || 0), 0); }
function ascentModuleUnlocked(upId) {
    const up = ASCENT_UPGRADES[upId]; ascentSalvage();
    if (!up) return false;
    if (up.grade === 1 || ascentState().modules[upId]) return true;
    // a module already on a copy you own counts as learned (older saves)
    return Object.values(ascentState().owned).some(o => (o.c || []).some(x => x.u && x.u.includes(upId)));
}
function unlockAscentModule(upId) {
    const up = ASCENT_UPGRADES[upId], st = ascentState(), sv = ascentSalvage();
    if (!up) return { ok: false, why: 'No such module.' };
    if (ascentModuleUnlocked(upId)) return { ok: false, why: 'Already unlocked.' };
    const need = ASCENT_UNLOCK_SALVAGE[up.grade];
    if (ascentSalvageFor(up) < need) return { ok: false, why: `Needs ${need} salvage in ${up.cols === 'C' ? 'any color' : up.cols.split('').join(' or ')} (you have ${ascentSalvageFor(up)}).` };
    // spend from the color you have most of
    let left = need;
    for (const ch of ascentModuleCols(up).sort((a, b) => (sv[b] || 0) - (sv[a] || 0))) { const t = Math.min(left, sv[ch] || 0); sv[ch] -= t; left -= t; if (!left) break; }
    st.modules[upId] = true;
    return { ok: true, spent: need };
}
// Scrap spare copies (in no deck) into salvage in the card's colors, instead of dusting them into Aether
function scrapAscentCard(id, keys) {
    const c = ASCENT.byId.get(id), st = ascentState(), o = st.owned[id], sv = ascentSalvage();
    if (!c || !o || c.kind === 'basic' || c.type === 'land') return { ok: false, why: 'Nothing to scrap.' };
    if (c.rarity === 'trophy') return { ok: false, why: 'Trophy cards cannot be scrapped.' };
    ascentOwnedEntry(id);
    const used = ascentKeysInDecks();
    const list = o.c.filter(x => !used.has(x.k) && keys.includes(x.k));
    if (list.length !== keys.length || !list.length) return { ok: false, why: 'Those copies are in a deck or gone.' };
    let gain = 0;
    list.forEach(x => { gain += ASCENT_SCRAP[c.rarity] * (x.f ? 2 : 1); o.c.splice(o.c.indexOf(x), 1); });
    ascentSyncOwned(o);
    (c.colors ? c.colors.split('') : ['C']).forEach(ch => { sv[ch] = (sv[ch] || 0) + gain; });
    st.scrappedTotal = (st.scrappedTotal || 0) + gain;
    return { ok: true, salvage: gain, colors: c.colors || 'C' };
}
function ascentFindCopy(key) {
    const st = ascentState();
    for (const [id, o] of Object.entries(st.owned)) { if (!o.c) continue; const copy = o.c.find(x => x.k === key); if (copy) return { id, o, copy, card: ASCENT.byId.get(id) }; }
    return null;
}
// Why this copy cannot take this module right now (null when it can). Unlocking is checked separately (ascentModuleUnlocked).
function ascentUpgradeBlocked(found, upId, replacingIndex = -1) {
    const up = ASCENT_UPGRADES[upId], { card, copy } = found;
    if (!up) return 'No such module.';
    if (card.rarity === 'trophy') return 'Trophy cards cannot be upgraded.';
    if (up.on !== card.type) return up.on === 'creature' ? 'Creatures only.' : 'Spells only.';
    if (up.on === 'spell' && card.perm) return 'Enchantments cannot take spell extras.';
    if (up.on === 'spell' && card.kind === 'rock') return 'Mana rocks cannot be upgraded.';
    const rest = copy.u.filter((_, i) => i !== replacingIndex);
    if (rest.includes(upId)) return 'Already on this copy.';
    if (rest.length >= ASCENT_MAX_MODULES) return `At most ${ASCENT_MAX_MODULES} modules per copy.`;
    if (!ascentColorFit(card, up)) return `Needs a ${up.cols.split('').join(' or ')} card.`;
    if (ascentGrade(card) < up.grade) return `Needs a card of mana value ${[0, 0, 3, 5, 6][up.grade]}+ (${ASCENT_GRADES[up.grade]}).`;
    const base = (typeof CARDS !== 'undefined' && CARDS.get(card.id)) || null, text = base && base.text || '';
    if (up.kind === 'kw' && ((card.kws || []).includes(up.kw) || rest.some(u => ASCENT_UPGRADES[u].kw === up.kw))) return `Already has ${up.label.toLowerCase()}.`;
    if (up.kind === 'line') {
        const line = up.line(card.name).replace(/~/g, card.name);
        const norm = t => t.replace(new RegExp(card.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~').replace(/\bthis (creature|permanent)\b/gi, '~').replace(/\s+/g, ' ');
        if (norm(text).includes(norm(up.line(card.name)).trim())) return 'The card already does this.';
        const isMana = /Add (\{|one mana)/.test(line);
        if (isMana && ((card.tags || []).some(t => t.startsWith('mana') || t === 'anymana') || rest.some(u => ASCENT_UPGRADES[u].line && /Add (\{|one mana)/.test(ASCENT_UPGRADES[u].line(card.name))))) return 'Already taps for mana.';
        if (/Whenever .* attacks/.test(line) && (card.kws || []).includes('defender')) return 'A defender never attacks.';
    }
    return null;
}
// Spare plain copies of the same card that could be fed in (not in a deck, no upgrades, not the target)
function ascentSacrificeCandidates(found) {
    const used = ascentKeysInDecks();
    return found.o.c.filter(x => x.k !== found.copy.k && !x.u.length && !used.has(x.k));
}
function ascentSacrificeValue(card, copy) { return ASCENT_DUST[card.rarity] * ASCENT_SACRIFICE_VALUE * (copy.f ? 2 : 1); }
// Add a module to a copy. sacrifice: keys of spare plain copies to feed in; the rest of the price is paid in Aether.
function upgradeAscentCopy(key, upId, sacrifice = []) {
    const st = ascentState(), found = ascentFindCopy(key);
    if (!found) return { ok: false, why: 'You do not own that copy.' };
    const why = ascentUpgradeBlocked(found, upId);
    if (why) return { ok: false, why };
    if (!ascentModuleUnlocked(upId)) return { ok: false, why: `Locked: scrap spare cards to unlock ${ASCENT_UPGRADES[upId].label} (${ASCENT_UNLOCK_SALVAGE[ASCENT_UPGRADES[upId].grade]} salvage).` };
    const cands = ascentSacrificeCandidates(found), feed = sacrifice.map(k => cands.find(x => x.k === k)).filter(Boolean);
    if (feed.length !== sacrifice.length) return { ok: false, why: 'One of those copies cannot be used.' };
    const price = ascentUpgradeCost(upId, found.card, found.copy.u.length), covered = feed.reduce((a, x) => a + ascentSacrificeValue(found.card, x), 0);
    const aether = Math.max(0, price - covered);
    if (st.aether < aether) return { ok: false, why: `Needs ${aether} more Aether (you have ${st.aether}).` };
    feed.forEach(x => found.o.c.splice(found.o.c.indexOf(x), 1));
    st.aether -= aether; st.upgradedTotal = (st.upgradedTotal || 0) + 1;
    found.copy.u.push(upId);
    ascentSyncOwned(found.o);
    return { ok: true, price, aether, sacrificed: feed.length };
}
// Swap or remove the module in a slot. The old one is lost; the fee is a quarter of what it cost where it sits.
function swapAscentUpgrade(key, slot, newUpId = null) {
    const st = ascentState(), found = ascentFindCopy(key);
    if (!found || !found.copy.u[slot]) return { ok: false, why: 'Nothing in that slot.' };
    const old = found.copy.u[slot];
    if (newUpId) {
        const why = ascentUpgradeBlocked(found, newUpId, slot); if (why) return { ok: false, why };
        if (!ascentModuleUnlocked(newUpId)) return { ok: false, why: 'That module is still locked.' };
    }
    const fee = Math.max(5, Math.round(ascentUpgradeCost(old, found.card, slot) * ASCENT_SWAP_FEE / 5) * 5);
    const extra = newUpId ? ascentUpgradeCost(newUpId, found.card, slot) : 0;
    // a swap pays the fee plus the new module's price; removing pays only the fee
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
        else if (up.kind === 'line') text += (text ? '\n' : '') + up.line(base.name).replace(/~/g, base.name);
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
