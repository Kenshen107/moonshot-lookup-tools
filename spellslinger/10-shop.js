// =====================================================================
// Card shop (phase 1, 2026-10-05): the profile's shop fields, card
// conditions and serialized copies, daily market events, the personalities
// shared by shop customers and (later) campaign opponents, and the shop
// day loop. Shop cash ($) is in-game money like coins: it can't be bought
// or cashed out.
// =====================================================================

// ---- Profile: the shop and collector fields, filled in on old profiles ----
const SHOP_START_USD = 50;
const SHOP_RENT = 12;            // taken when you close the shop each day
const SHOP_MAX_QUEUE = 3;        // customers waiting at once
const SHOP_TICK_MS = 3000;       // how often a customer might walk in
const SHOP_DAY_MS = 10 * 60 * 1000; // a shop day lasts 10 minutes of open time (owner, 2026-10-06)
const SHOP_PATIENCE_TICKS = 30;  // about 90 seconds before a customer gives up
const SHOP_SELLER_CHANCE = 0.3;  // share of walk-ins who come to sell you cards
const QUICK_PCTS = [10, 20, 30]; // the quick counteroffer buttons, up and down
function profileDefaults() {
    return {
        usd: SHOP_START_USD, shopDay: 1, shopReputation: 0,
        mode: 'campaign', bucket: 'main', stash: { sandbox: sandboxStart() }, // Phase 4: the three game modes (04b-modes.js)
        displayCase: [],   // { id, condition, foil, serial, askingPrice }
        bulkBox: [],       // { id, condition, foil } (the bulk bin)
        bulkPrice: 0.25,   // what the bulk bin charges per card
        vault: [],         // up to 3 card ids, shown off (not for sale)
        copies: {},        // id -> [{ c, f, s }] condition / foil / serialized per copy
        campaignProgress: [], starterDeck: null, setBinders: {},
        cosmetics: { sleeves: 'default', playmat: 'default' },
        marketEvent: null, // { key, day }
        shopToday: null,   // { day, visitsLeft, sales: [], revenue }
        shopLedger: [],    // the last few closed days
        sealed: {},        // 'code|kind' -> { code, kind, name, type, released, n } sealed packs in the stockroom
        distStock: null,   // today's distributor offers { day, offers }
        campaignNodes: {}, // ladder stop -> its precon opponent { file, name, type, code }
        campaignDiscount: 0, // permanent distributor discount from Regional wins
        grading: []        // cards out for grading { id, copy, tier, sent, due }
    };
}
function upgradeProfile(p) {
    const d = profileDefaults();
    Object.keys(d).forEach(k => { if (p[k] === undefined) p[k] = d[k]; });
    return p;
}

// ---- Conditions and copies ----
// Each owned copy has a condition (and may be foil or serialized). Copies
// opened before conditions existed count as Mint, non-foil.
const CONDITIONS = {
    M: { label: 'Mint', short: 'M', mult: 1 },
    LP: { label: 'Lightly Played', short: 'LP', mult: 0.8 },
    MP: { label: 'Moderately Played', short: 'MP', mult: 0.6 },
    D: { label: 'Damaged', short: 'DMG', mult: 0.3 }
};
// How often each condition comes out of a pack (a game choice, not real data)
const CONDITION_ODDS = [['M', 70], ['LP', 18], ['MP', 9], ['D', 3]];
const SERIAL_CHANCE = 0.001;          // per card, sets from 2020 on
const SERIAL_FROM = '2020-01-01';
const SERIAL_MULT = 10;
function rollCopy(foil, setRelease) {
    const c = CONDITION_ODDS[pickWeighted(CONDITION_ODDS)][0];
    const copy = { c };
    if (foil) copy.f = 1;
    if (setRelease && setRelease >= SERIAL_FROM && Math.random() < SERIAL_CHANCE) copy.s = 1;
    return copy;
}
function ownedCopies(id) {
    const n = profile.collection[id] || 0;
    const list = (profile.copies[id] || []).slice(0, n);
    while (list.length < n) list.push({ c: 'M' });
    return list;
}
function addCopy(id, copy) {
    profile.collection[id] = (profile.collection[id] || 0) + 1;
    const list = ownedCopies(id).slice(0, profile.collection[id] - 1);
    list.push(copy);
    profile.copies[id] = list;
}
// Take one copy matching `match` (a copy object) out of the collection
function takeCopy(id, match) {
    const list = ownedCopies(id);
    const i = list.findIndex(c => c.c === match.c && !!c.f === !!match.f && !!c.s === !!match.s && (c.g || 0) === (match.g || 0));
    if (i < 0) return null;
    const [copy] = list.splice(i, 1);
    profile.collection[id] = list.length;
    if (list.length) profile.copies[id] = list;
    else { delete profile.collection[id]; delete profile.copies[id]; }
    return copy;
}
function copyKey(c) { return `${c.c}${c.f ? 'f' : ''}${c.s ? 's' : ''}${c.g ? `g${c.g}` : ''}`; }
function copyLabel(c) { return `${c.g ? `Graded ${c.g} (${gradeWord(c.g)})` : CONDITIONS[c.c].label}${c.f ? ' foil' : ''}${c.s ? ' · SERIALIZED' : ''}`; }
function condBadge(c) {
    if (c.g) return `<span class="slab" title="${esc(copyLabel(c))}">🔖 ${c.g}${c.f ? ' ✨' : ''}</span>${c.s ? '<span class="serial-tag">#/500</span>' : ''}`;
    return `<span class="cond cond-${c.c}" title="${esc(copyLabel(c))}">${CONDITIONS[c.c].short}${c.f ? ' ✨' : ''}</span>${c.s ? '<span class="serial-tag">#/500</span>' : ''}`;
}
// A listing in the case or bin <-> a copy
function listingCopy(l) { const c = { c: l.condition }; if (l.foil) c.f = 1; if (l.serial) c.s = 1; if (l.grade) c.g = l.grade; return c; }

// ---- Values: Scryfall's TCGplayer price x condition x serialized x today's market ----
function baseUsd(card, foil) { return parseFloat((foil && card.usdFoil) || card.usd) || 0; }
function copyValue(card, copy, ignoreCondition) {
    if (!card) return 0;
    let v = baseUsd(card, copy.f);
    if (copy.g) v *= gradeMult(card, copy.g); // a graded slab: the grade replaces the condition
    else if (!ignoreCondition) v *= CONDITIONS[copy.c].mult;
    if (copy.s) v *= SERIAL_MULT;
    return Math.round(v * eventMult(card) * 100) / 100;
}
const usd = n => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

// ---- Market events: one each shop day (made-up in-game news) ----
const MARKET_EVENTS = [
    { key: 'pt-red', icon: '🏆', title: 'Pro Tour spike', text: 'A red deck won the Pro Tour: red cards are worth 40% more today.', mult: 1.4, match: c => c.colors.includes('R') },
    { key: 'ban-blue', icon: '🔨', title: 'Banlist update', text: 'Blue staples got hit: blue cards are worth 25% less today.', mult: 0.75, match: c => c.colors.includes('U') },
    { key: 'precon', icon: '👑', title: 'Commander precon hype', text: 'A new precon is out: legendary creatures are worth 30% more.', mult: 1.3, match: c => /Legendary/.test(c.type) && /Creature/.test(c.type) },
    { key: 'artifacts', icon: '⚙️', title: 'Artifact season', text: 'An artifact deck is everywhere: artifacts are worth 25% more.', mult: 1.25, match: c => /Artifact/.test(c.type) },
    { key: 'yard', icon: '🪦', title: 'Graveyard meta', text: 'Graveyard decks are winning: cards that mention the graveyard are worth 30% more.', mult: 1.3, match: c => /graveyard/i.test(c.text || '') },
    { key: 'ramp', icon: '🌲', title: 'Ramp craze', text: 'Big green decks are back: green cards are worth 20% more.', mult: 1.2, match: c => c.colors.includes('G') },
    { key: 'dragons', icon: '🐉', title: 'Dragon week', text: 'A dragon set was announced: Dragons are worth 50% more.', mult: 1.5, match: c => /\bDragon\b/.test(c.type) },
    { key: 'reprint', icon: '📉', title: 'Reprint announced', text: 'A big reprint set is coming: mythic rares are worth 15% less.', mult: 0.85, match: c => c.rarity === 'mythic' },
    { key: 'instants', icon: '⚡', title: 'Tempo is in', text: 'Fast decks are popular: instants are worth 20% more.', mult: 1.2, match: c => /Instant/.test(c.type) },
    { key: 'quiet', icon: '☕', title: 'Quiet market', text: 'Nothing big happened: prices are steady.', mult: 1, match: () => false }
];
function todayEvent() {
    const e = profile && profile.marketEvent;
    return e ? MARKET_EVENTS.find(m => m.key === e.key) || null : null;
}
function eventMult(card) {
    const e = todayEvent();
    return e && card && e.match(card) ? e.mult : 1;
}
function rollMarketEvent() {
    const last = profile.marketEvent && profile.marketEvent.key;
    const pool = MARKET_EVENTS.filter(m => m.key !== last);
    profile.marketEvent = { key: pool[rand(pool.length)].key, day: profile.shopDay };
}

// ---- Personalities: shop customers now; campaign opponents later ----
// `duel` is what each one plays as an opponent (wired up with the campaign);
// `shop` is how they buy: what they want, which conditions they take, what
// share of today's value they pay, and how far a counteroffer can push them.
const HATE_RE = /\b(players can't|can't cast|can't be cast|exile (?:target player's|all cards from|each opponent's) graveyard|doesn't untap|don't untap|each player sacrifices|costs? \{\d\} more|can't search)/i;
const PERSONALITIES = {
    greg: {
        name: 'Greg', archetype: 'Timmy', emoji: '🦖',
        duel: { theme: 'stompy', style: 'aggro', desc: 'Green Stompy, all-out attacks' },
        shop: { desc: 'Big mythic creatures (5/5 or bigger). Takes LP and MP copies.', conditions: ['M', 'LP', 'MP'], pay: () => 1.1, tolerance: 0.1,
            wants: card => card.rarity === 'mythic' && /Creature/.test(card.type) && +card.power >= 5 && +card.toughness >= 5 }
    },
    marcus: {
        name: 'Marcus', archetype: 'Spike', emoji: '🧠',
        duel: { theme: 'control', style: 'control', desc: 'Azorius Control, holds mana up for instants' },
        shop: { desc: 'Mint tournament staples only (Modern-legal, $4+). Always lowballs.', conditions: ['M'], pay: () => 0.8 + Math.random() * 0.1, tolerance: 0.05, lowball: true,
            wants: (card, copy) => card.legal && card.legal.modern === 'legal' && !isBasic(card) && copyValue(card, copy) >= 4 }
    },
    sarah: {
        name: 'Sarah', archetype: 'Johnny', emoji: '🧩',
        duel: { theme: 'artifacts', style: 'combo', desc: 'Artifact combo' },
        shop: { desc: 'Odd enchantments and bulk rares, at full value.', conditions: ['M', 'LP', 'MP'], pay: () => 1, tolerance: 0.1,
            wants: (card, copy) => (/Enchantment/.test(card.type) && !/Creature/.test(card.type) && copyValue(card, copy) < 3)
                || (['rare', 'mythic'].includes(card.rarity) && copyValue(card, copy) < 1.5) }
    },
    leo: {
        name: 'Leo', archetype: 'Vorthos', emoji: '📜',
        duel: { theme: 'tribal', style: 'midrange', desc: 'Themed tribal decks' },
        shop: { desc: 'Foils, showcase frames and cards from before 2003. Pays 125%.', conditions: ['M', 'LP'], pay: () => 1.25, tolerance: 0.15,
            wants: (card, copy) => !!copy.f || (card.frame || []).includes('showcase') || (!!card.released && card.released < '2003-01-01') }
    },
    trevor: {
        name: 'Trevor', archetype: 'Melvin', emoji: '🔒',
        duel: { theme: 'stax', style: 'prison', desc: 'Stax and prison pieces' },
        shop: { desc: 'Hate cards (cards that stop other players). Takes your price or walks: no haggling.', conditions: ['M', 'LP', 'MP'], pay: () => 1, tolerance: 0, noHaggle: true,
            wants: card => HATE_RE.test(card.text || '') }
    },
    sam: {
        name: 'Sam', archetype: 'Speedrunner', emoji: '🏃',
        duel: { theme: 'burn', style: 'aggro', desc: 'Red Deck Wins' },
        shop: { desc: 'Playsets of cheap playables ($1-$5 each). Doesn\'t care about condition.', conditions: ['M', 'LP', 'MP', 'D'], pay: () => 1, tolerance: 0.05, ignoreCondition: true, playset: true,
            wants: (card, copy) => { const v = copyValue(card, copy, true); return v >= 1 && v <= 5 && !isBasic(card); } }
    },
    arthur: {
        name: 'Arthur', archetype: 'Whale', emoji: '🐋',
        duel: { theme: 'power', style: 'control', desc: 'Vintage with the Power 9' },
        shop: { desc: 'Glass-case cards worth more than $50, or slabs graded 9+ worth $15+. Pays 150%.', conditions: ['M', 'LP'], pay: () => 1.5, tolerance: 0.2, best: true,
            wants: (card, copy) => copyValue(card, copy) > 50 || (copy.g >= 9 && copyValue(card, copy) >= 15) }
    },
    brenda: {
        name: 'Brenda', archetype: 'Budget', emoji: '🧺',
        duel: { theme: 'precon', style: 'casual', desc: 'Preconstructed decks' },
        shop: { desc: 'Digs through the bulk bin for cards under $2.', conditions: ['M', 'LP', 'MP', 'D'], pay: () => 1, tolerance: 0.1, bulkOnly: true,
            wants: (card, copy) => copyValue(card, copy) < 2 }
    },
    luke: {
        name: 'Luke', archetype: 'Disruptor', emoji: '🌀',
        duel: { theme: 'mill', style: 'disrupt', desc: 'Mill and discard' },
        shop: { desc: 'Cards that mill or make players discard.', conditions: ['M', 'LP', 'MP'], pay: () => 1, tolerance: 0.1,
            wants: card => /\blibrary\b|\bdiscard/i.test(card.text || '') }
    }
};

// ---- The shop day ----
const SHOP = { open: false, timer: null, queue: [], seq: 1, log: [] };
function shopVisitsFor(rep) { return Math.min(36, 14 + Math.floor(rep / 3)); }
function ensureShopDay() {
    if (!profile.marketEvent) rollMarketEvent();
    if (!profile.shopToday || profile.shopToday.day !== profile.shopDay)
        profile.shopToday = { day: profile.shopDay, visitsLeft: shopVisitsFor(profile.shopReputation), sales: [], revenue: 0, timeLeft: SHOP_DAY_MS, bought: 0 };
    if (profile.shopToday.timeLeft === undefined) profile.shopToday.timeLeft = SHOP_DAY_MS;
}
function clockText(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function vaultBonus() {
    // Trophies draw a crowd: up to +15% customer chance
    const total = profile.vault.reduce((a, id) => a + baseUsd(CARDS.get(id) || {}, false), 0);
    return Math.min(0.15, total / 400);
}
function shopLog(msg) { SHOP.log.unshift(msg); SHOP.log.length = Math.min(SHOP.log.length, 30); }

function openShop() {
    ensureShopDay();
    if (profile.shopToday.visitsLeft <= 0 || profile.shopToday.timeLeft <= 0) { toast('The day is over - close up to start a new day.'); return; }
    SHOP.open = true;
    clearInterval(SHOP.timer);
    SHOP.timer = setInterval(shopTick, SHOP_TICK_MS);
    shopLog(`🔓 Day ${profile.shopDay}: the shop is open.`);
    renderShop();
}
function pauseShop() {
    SHOP.open = false;
    clearInterval(SHOP.timer);
    SHOP.timer = null;
}
function shopTick() {
    if ($('view-shop').classList.contains('hidden') || !$('game').classList.contains('hidden')) return; // paused while you're elsewhere
    // Waiting customers lose patience
    SHOP.queue.forEach(c => c.patience--);
    SHOP.queue.filter(c => c.patience <= 0).forEach(c => shopLog(`⌛ ${c.p.name} got tired of waiting and left.`));
    SHOP.queue = SHOP.queue.filter(c => c.patience > 0);
    const T = profile.shopToday;
    if (SHOP.open) T.timeLeft = Math.max(0, T.timeLeft - SHOP_TICK_MS);
    if (SHOP.open && T.timeLeft > 0 && T.visitsLeft > 0 && SHOP.queue.length < SHOP_MAX_QUEUE) {
        // Spread the day's customers over its 10 minutes; reputation and trophies bring them sooner
        const ticksLeft = Math.max(1, T.timeLeft / SHOP_TICK_MS);
        const chance = Math.min(0.7, (T.visitsLeft / ticksLeft) * 1.6 * (1 + Math.min(profile.shopReputation, 40) * 0.01 + vaultBonus()));
        if (Math.random() < chance) {
            T.visitsLeft--;
            spawnCustomer();
            saveProfile();
        }
    }
    if ((T.visitsLeft <= 0 || T.timeLeft <= 0) && !SHOP.queue.length && SHOP.open) {
        pauseShop();
        shopLog('🚪 Closing time - that was the last customer today. Close the shop to start a new day.');
    }
    if (SHOP.open && T.timeLeft % 30000 < SHOP_TICK_MS) saveProfile();
    renderShopFloor();
}

// What a customer would take home: listings from the case (or the bulk bin)
function buildBasket(P) {
    const S = P.shop;
    const ok = (l, inBulk) => {
        const card = CARDS.get(l.id);
        if (!card || !S.conditions.includes(l.condition)) return false;
        const copy = listingCopy(l);
        return S.wants(card, copy) && (inBulk || !S.bulkOnly);
    };
    if (S.bulkOnly) {
        const pick = shuffle(profile.bulkBox.map((l, i) => ({ l, i })).filter(x => ok(x.l, true))).slice(0, 1 + rand(6));
        return pick.length ? { from: 'bulk', items: pick } : null;
    }
    const all = profile.displayCase.map((l, i) => ({ l, i })).filter(x => ok(x.l, false));
    if (!all.length) return null;
    if (S.playset) {
        const byId = {};
        all.forEach(x => (byId[x.l.id] = byId[x.l.id] || []).push(x));
        const sets = Object.values(byId).sort((a, b) => b.length - a.length);
        return { from: 'case', items: sets[0].slice(0, 4) };
    }
    if (S.best) return { from: 'case', items: [all.sort((a, b) => listingValue(b.l) - listingValue(a.l))[0]] };
    return { from: 'case', items: [all[rand(all.length)]] };
}
function listingValue(l, ignoreCondition) { if (l.sealed) return packMarket(l.meta); return copyValue(CARDS.get(l.id), listingCopy(l), ignoreCondition); }
function listingAsk(l, from) { return from === 'bulk' ? profile.bulkPrice : l.askingPrice; }

function spawnCustomer() {
    const keys = Object.keys(PERSONALITIES).filter(k => !SHOP.queue.some(c => c.p === PERSONALITIES[k])); // one of each at a time
    if (!keys.length) return;
    const P = PERSONALITIES[keys[rand(keys.length)]];
    if (Math.random() < SHOP_SELLER_CHANCE && spawnSeller(P)) return;
    const basket = buildBasket(P);
    if (!basket && sellSealedTo(P)) return;
    if (!basket) { shopLog(`👀 ${P.emoji} ${P.name} looked for ${P.shop.desc.charAt(0).toLowerCase()}${P.shop.desc.slice(1, 60).replace(/\.$/, '')}${P.shop.desc.length > 60 ? '...' : ''} and found nothing.`); return; }
    const value = basket.items.reduce((a, x) => a + listingValue(x.l, P.shop.ignoreCondition), 0);
    const asking = basket.items.reduce((a, x) => a + listingAsk(x.l, basket.from), 0);
    const maxPay = Math.max(0.05, value * P.shop.pay());
    let offer;
    if (P.shop.lowball) offer = Math.min(asking, maxPay);                        // Spike: never more than 80-90%
    else if (asking <= maxPay) offer = asking;                                   // happy to pay your price
    else offer = maxPay * (0.85 + Math.random() * 0.1);                          // offers a bit under their limit
    offer = Math.round(offer * 100) / 100;
    const say = offer >= asking ? `I'll take ${basket.items.length > 1 ? 'these' : 'it'} at your price!` : P.shop.noHaggle ? `${usd(offer)}. That's my offer - I don't haggle.` : `Would you take ${usd(offer)}?`;
    SHOP.queue.push({ id: SHOP.seq++, kind: 'buy', p: P, basket, value, asking, maxPay, offer, patience: SHOP_PATIENCE_TICKS, rounds: 0, say });
    shopLog(`🔔 ${P.emoji} ${P.name} walked in.`);
}
// Walk-in sellers: a customer brings cards they want cash for (cards of the
// kind they like, from cards the game has seen). They ask 60-75% of what the
// cards are worth and take as little as 42-52%.
function spawnSeller(P) {
    const pool = [];
    for (const card of CARDS.values()) {
        const v = baseUsd(card);
        if (!card || isBasic(card) || !(v >= 0.5 && v <= 400) || !card.img) continue;
        const copy = rollCopy(false);
        try { if (P.shop.wants(card, copy)) pool.push({ card, copy }); } catch (e) { /* skip */ }
        if (pool.length > 400) break;
    }
    if (!pool.length) return false;
    const items = shuffle(pool).slice(0, 1 + rand(3)).map(x => ({ id: x.card.id, copy: Math.random() < 0.15 && x.card.usdFoil ? { ...x.copy, f: 1 } : x.copy }));
    const value = round2(items.reduce((a, x) => a + copyValue(CARDS.get(x.id), x.copy), 0));
    if (value < 0.5) return false;
    const asking = round2(Math.max(0.25, value * (0.6 + Math.random() * 0.15)));
    const minTake = round2(value * (0.42 + Math.random() * 0.1));
    const lines = ['I\'m cashing out a few cards.', 'Cleaning out my binder - interested?', 'Need some cash for the prerelease.', 'Got some doubles to sell.'];
    SHOP.queue.push({ id: SHOP.seq++, kind: 'sell', p: P, items, value, asking, minTake, patience: SHOP_PATIENCE_TICKS, rounds: 0, say: `${lines[rand(lines.length)]} ${usd(asking)} for ${items.length > 1 ? 'the lot' : 'it'}?` });
    shopLog(`🔔 ${P.emoji} ${P.name} walked in with cards to sell.`);
    return true;
}

// Sealed packs are the safe flip: a customer who finds no single they want
// often grabs a pack priced at or near its shop price (up to 10% over).
function sellSealedTo(P) {
    const packs = profile.displayCase.filter(l => l.sealed && l.askingPrice <= packMarket(l.meta) * 1.1);
    if (!packs.length || Math.random() > 0.7) return false;
    const l = packs.sort((a, b) => a.askingPrice - b.askingPrice)[0];
    pull(profile.displayCase, l);
    profile.usd = round2(profile.usd + l.askingPrice);
    const T = profile.shopToday;
    T.revenue = round2(T.revenue + l.askingPrice);
    T.sales.push({ who: P.name, cards: [`${l.meta.name} pack`], price: l.askingPrice });
    shopLog(`📦 ${P.emoji} ${P.name} grabbed a ${esc(l.meta.name)} ${kindLabel(l.meta).toLowerCase()} for ${usd(l.askingPrice)}.`);
    saveProfile();
    return true;
}
function findCustomer(id) { return SHOP.queue.find(c => c.id === id); }
function removeCustomer(c) { SHOP.queue = SHOP.queue.filter(x => x !== c); }
function completeSale(c, price) {
    // Take the items out of the case or bin (highest index first)
    const list = c.basket.from === 'bulk' ? profile.bulkBox : profile.displayCase;
    c.basket.items.map(x => x.l).forEach(l => { const i = list.indexOf(l); if (i >= 0) list.splice(i, 1); });
    profile.usd = Math.round((profile.usd + price) * 100) / 100;
    const T = profile.shopToday;
    T.revenue = Math.round((T.revenue + price) * 100) / 100;
    T.sales.push({ who: c.p.name, cards: c.basket.items.map(x => CARDS.get(x.l.id)?.name || '?'), price });
    // Fair deals build the shop's name
    if (price <= c.value * 1.1) profile.shopReputation++;
    removeCustomer(c);
    // Other customers' baskets may hold the sold items now: send them home politely
    SHOP.queue.filter(o => o.basket.items.some(x => !(o.basket.from === 'bulk' ? profile.bulkBox : profile.displayCase).includes(x.l)))
        .forEach(o => { shopLog(`🤷 ${o.p.name} saw their pick get sold and left.`); removeCustomer(o); });
    shopLog(`💵 Sold ${c.basket.items.length > 1 ? `${c.basket.items.length} cards` : esc(CARDS.get(c.basket.items[0].l.id)?.name || 'a card')} to ${c.p.name} for ${usd(price)}.`);
    saveProfile();
}
function acceptOffer(id) {
    const c = findCustomer(id);
    if (!c) return;
    if (c.kind === 'sell') buyFromCustomer(c, c.asking);
    else completeSale(c, c.offer);
    renderShop();
}
function declineOffer(id) {
    const c = findCustomer(id);
    if (!c) return;
    removeCustomer(c);
    shopLog(`👋 You passed on ${c.p.name}'s ${c.kind === 'sell' ? 'cards' : 'offer'}. They said thanks anyway.`);
    renderShopFloor();
}
// Buying from a walk-in seller
function buyFromCustomer(c, price) {
    if (profile.usd < price) { toast(`You need ${usd(price)} in shop cash (you have ${usd(profile.usd)}).`); return false; }
    profile.usd = round2(profile.usd - price);
    c.items.forEach(x => addCopy(x.id, x.copy));
    const T = profile.shopToday;
    T.bought = round2((T.bought || 0) + price);
    (T.buys = T.buys || []).push({ who: c.p.name, cards: c.items.map(x => CARDS.get(x.id)?.name || '?'), price });
    if (price >= c.value * 0.5) profile.shopReputation++; // a fair buy gets around
    removeCustomer(c);
    shopLog(`🛒 Bought ${c.items.length > 1 ? `${c.items.length} cards` : esc(CARDS.get(c.items[0].id)?.name || 'a card')} from ${c.p.name} for ${usd(price)} (worth ${usd(c.value)}). They're in your collection.`);
    saveProfile();
    return true;
}
// Your counteroffer, typed or from the quick buttons. Customers are friendly:
// they meet you partway up to twice before they politely move on.
function counterAt(c, price) {
    price = round2(price);
    if (!(price > 0)) { toast('Type a price first.'); return; }
    if (c.kind === 'sell') {
        if (price >= c.asking) { if (buyFromCustomer(c, price) && price > c.asking) { shopLog(`😊 ${c.p.name} didn't expect that much - they'll tell their friends.`); } }
        else if (price >= c.minTake) { if (buyFromCustomer(c, price)) shopLog(`🤝 ${c.p.name} took your offer.`); }
        else if (c.rounds < 2) { c.rounds++; c.asking = round2(Math.max(c.minTake, (c.asking + price) / 2)); c.say = `Hmm, that's a bit low. Could you do ${usd(c.asking)}?`; }
        else { removeCustomer(c); shopLog(`🙂 ${c.p.name} decided to hang on to their cards. Maybe next time.`); }
        renderShop();
        return;
    }
    const limit = c.maxPay * (1 + c.p.shop.tolerance);
    if (price <= c.offer || price <= limit) { completeSale(c, price); shopLog(`🤝 ${c.p.name}: "Deal!"`); }
    else if (c.p.shop.noHaggle) c.say = `Sorry, I don't haggle. ${usd(c.offer)} is my offer.`;
    else if (c.rounds < 2) { c.rounds++; c.offer = round2(Math.min(limit, (price + c.offer) / 2)); c.say = `That's a little steep for me. How about ${usd(c.offer)}?`; }
    else {
        removeCustomer(c);
        if (price > c.value * 1.5) { profile.shopReputation = Math.max(0, profile.shopReputation - 1); saveProfile(); }
        shopLog(`🙂 ${c.p.name} couldn't quite make the price work and said they'd come back another day.`);
    }
    renderShop();
}
function counterOffer(id) {
    const c = findCustomer(id);
    if (!c) return;
    const input = $(`counter-${id}`);
    counterAt(c, parseFloat(String(input && input.value || '').replace(/[$,]/g, '')));
}
// Quick buttons: up or down 10/20/30% from your price (selling) or their ask (buying)
function quickBase(c) { return c.kind === 'sell' ? c.asking : c.asking; }
function quickCounter(id, pct) {
    const c = findCustomer(id);
    if (!c) return;
    counterAt(c, quickBase(c) * (1 + pct / 100));
}
function quickHTML(c) {
    if (c.kind !== 'sell' && c.p.shop.noHaggle) return '';
    const base = quickBase(c);
    const pcts = [...QUICK_PCTS.slice().reverse().map(x => -x), ...QUICK_PCTS];
    return `<div class="quick" role="group" aria-label="Quick counteroffers"><span class="note">${c.kind === 'sell' ? 'Offer from their ask' : 'Counter from your price'}:</span>${pcts.map(pct => {
        const v = round2(base * (1 + pct / 100));
        const pointless = c.kind !== 'sell' && v <= c.offer; // their offer is already higher: just accept
        return `<button class="btn small ${pct < 0 ? 'down' : 'up'}" onclick="quickCounter(${c.id}, ${pct})" ${pointless ? 'disabled title="Their offer is already higher - press Accept"' : ''}>${pct > 0 ? '+' : '−'}${Math.abs(pct)}%<small>${usd(v)}</small></button>`;
    }).join('')}</div>`;
}
function customerHTML(c) {
    const head = `<div class="cust-head"><span class="cust-face" aria-hidden="true">${c.p.emoji}</span><div><strong>${esc(c.p.name)}</strong> <span class="note">the ${esc(c.p.archetype)}${c.kind === 'sell' ? ' · selling' : ''}</span>${c.kind === 'sell' ? '' : `<div class="note">${esc(c.p.shop.desc)}</div>`}</div></div>`;
    const say = `<div class="cust-say">💬 ${esc(c.say || '')}</div>`;
    const custom = `<details class="note" id="oth-${c.id}" style="margin-top:4px;"><summary>Other amount</summary><div class="row" style="margin-top:4px;"><input type="text" inputmode="decimal" id="counter-${c.id}" placeholder="$" aria-label="Your price" class="counter-in"><button class="btn small" onclick="counterOffer(${c.id})">↔ Offer</button></div></details>`;
    const bar = `<div class="patience" aria-hidden="true"><span style="width:${Math.max(0, c.patience / SHOP_PATIENCE_TICKS * 100)}%"></span></div>`;
    if (c.kind === 'sell') {
        const items = c.items.map(x => { const card = CARDS.get(x.id); return `<li><button class="linkish" onclick="showCardSheet('${x.id}')">${esc(card ? card.name : '?')}</button> ${condBadge(x.copy)} <span class="note">worth ${usd(copyValue(card, x.copy))}</span></li>`; }).join('');
        return `<div class="cust seller">${head}${say}<ul class="cust-items">${items}</ul>
            <div class="cust-offer">Worth <strong>${usd(c.value)}</strong> · They ask: <strong class="offer">${usd(c.asking)}</strong> <span class="note">(${Math.round(c.asking / c.value * 100)}% of value)</span></div>
            <div class="row"><button class="btn primary small" onclick="acceptOffer(${c.id})" ${profile.usd < c.asking ? 'disabled title="Not enough shop cash"' : ''}>✔ Buy for ${usd(c.asking)}</button><button class="btn small" onclick="declineOffer(${c.id})">✖ Pass</button></div>
            ${quickHTML(c)}${custom}${bar}</div>`;
    }
    const items = c.basket.items.map(x => { const card = CARDS.get(x.l.id); return `<li>${esc(card ? card.name : '?')} ${condBadge(listingCopy(x.l))} <span class="note">worth ${usd(listingValue(x.l, c.p.shop.ignoreCondition))}</span></li>`; }).join('');
    return `<div class="cust">${head}${say}<ul class="cust-items">${items}</ul>
        <div class="cust-offer">${c.basket.from === 'bulk' ? 'Bulk bin' : 'Your price'}: <strong>${usd(c.asking)}</strong> · Offers: <strong class="offer">${usd(c.offer)}</strong></div>
        <div class="row"><button class="btn primary small" onclick="acceptOffer(${c.id})">✔ Accept ${usd(c.offer)}</button><button class="btn small" onclick="declineOffer(${c.id})">✖ Decline</button></div>
        ${quickHTML(c)}${c.p.shop.noHaggle ? '' : custom}${bar}</div>`;
}

function closeShop() {
    ensureShopDay();
    const T = profile.shopToday;
    pauseShop();
    SHOP.queue.forEach(c => shopLog(`🚪 ${c.p.name} left at closing.`));
    SHOP.queue = [];
    profile.usd = Math.round((profile.usd - SHOP_RENT) * 100) / 100;
    profile.shopLedger.unshift({ day: profile.shopDay, revenue: T.revenue, bought: T.bought || 0, rent: SHOP_RENT, sales: T.sales.length, event: profile.marketEvent && profile.marketEvent.key });
    profile.shopLedger.length = Math.min(profile.shopLedger.length, 14);
    shopLog(`🔒 Closed day ${profile.shopDay}: ${T.sales.length} sale${T.sales.length === 1 ? '' : 's'}, ${usd(T.revenue)} in${T.bought ? `, ${usd(T.bought)} spent buying cards` : ''}, ${usd(SHOP_RENT)} rent.`);
    profile.shopDay++;
    rollMarketEvent();
    profile.shopToday = null;
    ensureShopDay();
    // The distributor restocks for the new day (ensureDistStock)
    saveProfile();
    const e = todayEvent();
    toast(`Day ${profile.shopDay}: ${e.icon} ${e.title}`);
    renderShop();
}

