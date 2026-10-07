// =====================================================================
// Wholesale distributor and sealed product (shop phase 2, 2026-10-05).
// Which boxes exist and how many packs they hold come from MTGJSON's
// SetList (sealedProduct); pack prices are the game's own ($4 x the set's
// tier), not real market prices.
// =====================================================================
const PACK_BASE_USD = 4;
const WHOLESALE_BOX = 0.65;   // a box costs 65% of its packs' shop price
const WHOLESALE_PACK = 0.8;   // a loose pack costs 80%
// One table prices packs in shop cash (mult x $4) and in coins (2026-10-06,
// owner's request: 100 coins for an Alpha pack was "busted"). The older and
// rarer the pack, the more it costs; a box is 20% off its packs in coins.
const POWER_SETS = ['lea', 'leb'];
const EARLY_SETS = ['2ed', 'arn', 'atq', 'leg']; // Unlimited, Arabian Nights, Antiquities, Legends: power, duals and Reserved List cards
const PACK_TIERS = [
    { key: 'power', label: 'Alpha / Beta', mult: 500, coins: 50000, premium: 25, test: b => POWER_SETS.includes(b.code) },
    { key: 'early', label: 'Unlimited era', mult: 150, coins: 15000, premium: 12, test: b => EARLY_SETS.includes(b.code) },
    { key: 'vintage', label: 'Early vintage', mult: 50, coins: 4000, premium: 4, test: b => b.released < '2000-01-01' },
    { key: 'collector', label: 'Collector', mult: 6, coins: 600, test: b => b.kind === 'collector' },
    { key: 'classic', label: 'Classic (2000-2008)', mult: 3, coins: 300, premium: 1.5, test: b => b.released < '2009-01-01' },
    { key: 'masters', label: 'Masters', mult: 3, coins: 300, test: b => b.type === 'masters' },
    { key: 'standard', label: 'Standard', mult: 1, coins: 100, test: () => true }
];
const COIN_BOX_DISCOUNT = 0.2;
const COLLECTOR_FROM = '2019-10-04';
function packTier(b) { return PACK_TIERS.find(t => t.test(b)); }
// ---------------------------------------------------------------------
// Cash pack prices (2026-10-06, owner's request: "what they are worth plus
// normal TCG prices"). There's no free source for sealed pack prices, so a
// pack is priced from its cards: each card's TCGplayer price (Scryfall),
// weighted by MTGJSON's real pull odds and the game's condition odds, is the
// pack's expected value; the shop price is that x PACK_EV_MARKUP x the
// tier's sealed premium (old sealed packs sell far above their cards: about
// 25x for Alpha/Beta, 12x Unlimited era, 4x other pre-2000, 1.5x 2000-2008).
// Until a set's value is worked out, the tier price shows.
// ---------------------------------------------------------------------
const PACK_EV_MARKUP = 1.15;
const PACK_EV_DAYS = 3;            // values are kept this long (duels:packev)
const PACK_EV = store.get('packev', {}); // 'code|kind' -> { ev, at }
function tierPrice(b) { return PACK_BASE_USD * packTier(b).mult; }
function packEVKnown(b) { const e = PACK_EV[sealedKey(b)]; return e && Date.now() - e.at < PACK_EV_DAYS * 864e5 ? e.ev : null; }
function packMarket(b) {
    const ev = packEVKnown(b);
    if (ev === null) return tierPrice(b);
    return round2(Math.max(0.5, ev * PACK_EV_MARKUP * (packTier(b).premium || 1)));
}
const AVG_CONDITION = CONDITION_ODDS.reduce((a, [c, w]) => a + CONDITIONS[c].mult * w, 0) / CONDITION_ODDS.reduce((a, [, w]) => a + w, 0);
// Prices only (not kept in the card cache, which would fill browser storage)
async function sfPrices(ids) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 75) {
        const res = await sfJSON(`${SF}/cards/collection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: ids.slice(i, i + 75).map(id => ({ id })) }) });
        ((res && res.data) || []).forEach(c => out.set(c.id, { usd: parseFloat(c.prices && c.prices.usd) || 0, foil: parseFloat(c.prices && (c.prices.usd_foil || c.prices.usd_etched)) || 0 }));
    }
    return out;
}
// Expected value of one pack: sum over layouts (by weight) of each slot's average card price
const evPending = {};
const EV_FAILED = new Set();
function packEV(b) {
    const k = sealedKey(b);
    if (packEVKnown(b) !== null) return Promise.resolve(packEVKnown(b));
    if (!evPending[k]) evPending[k] = (async () => {
        const src = await packSource(b.code, b.kind);
        const { booster, byUuid } = src;
        const idOf = uuid => { const c = byUuid.get(uuid); return c && c.identifiers && c.identifiers.scryfallId && !(c.types || []).includes('Token') ? c.identifiers.scryfallId : null; };
        const ids = new Set();
        Object.values(booster.sheets).forEach(sh => Object.keys(sh.cards).forEach(u => { const id = idOf(u); if (id) ids.add(id); }));
        const prices = await sfPrices([...ids]);
        const sheetAvg = {};
        Object.entries(booster.sheets).forEach(([name, sh]) => {
            let tw = 0, tv = 0;
            Object.entries(sh.cards).forEach(([u, w]) => { const pr = prices.get(idOf(u)) || { usd: 0, foil: 0 }; tw += w; tv += w * (sh.foil ? (pr.foil || pr.usd) : (pr.usd || pr.foil)); });
            sheetAvg[name] = tw ? tv / tw : 0;
        });
        const W = booster.boosters.reduce((a, l) => a + l.weight, 0);
        const ev = booster.boosters.reduce((a, l) => a + (l.weight / W) * Object.entries(l.contents).reduce((x, [sh, n]) => x + n * (sheetAvg[sh] || 0), 0), 0) * AVG_CONDITION;
        PACK_EV[k] = { ev: round2(ev), at: Date.now() };
        store.set('packev', PACK_EV);
        return PACK_EV[k].ev;
    })().finally(() => { delete evPending[k]; });
    return evPending[k];
}
// Work out any missing values for these products, then call back once
async function ensurePackEVs(list, then) {
    const need = list.filter(b => b && packEVKnown(b) === null && !EV_FAILED.has(sealedKey(b)));
    if (!need.length) return;
    for (const b of need) {
        try { await packEV(b); if (then) then(); }
        catch (e) { EV_FAILED.add(sealedKey(b)); } // no pack data or Scryfall busy: the tier price stays until the next visit
    }
}
function packPriceNote(b) {
    const ev = packEVKnown(b);
    if (ev === null) return 'tier price (cards being priced...)';
    const prem = packTier(b).premium || 1;
    return `cards inside ≈ ${usd(ev)} a pack (TCGplayer via Scryfall) × ${PACK_EV_MARKUP}${prem > 1 ? ` × ${prem} sealed ${packTier(b).label.toLowerCase()} premium` : ''}`;
}
function wholesaleDiscount() { return Math.min(CAMPAIGN_DISCOUNT_MAX, profile.campaignDiscount || 0); } // + set binder rewards (phase 4)
const round2 = n => Math.round(n * 100) / 100;
function boxPrice(b) { return round2(b.packs * packMarket(b) * WHOLESALE_BOX * (1 - wholesaleDiscount())); }
function loosePackPrice(b) { return round2(packMarket(b) * WHOLESALE_PACK * (1 - wholesaleDiscount())); }
function kindLabel(b) { return b.kind === 'collector' ? 'Collector Booster' : 'Booster'; }
function sealedKey(b) { return `${b.code}|${b.kind}`; }

// MTGJSON's set list, slimmed to one standard box and one collector box per
// set, saved for a week (duels:boxes)
let boxCatalog = store.get('boxes', null);
async function loadBoxCatalog() {
    if (boxCatalog && boxCatalog.list && boxCatalog.list.length && Date.now() - boxCatalog.fetched < 7 * 864e5) return boxCatalog.list;
    const res = await fetch(`${MTGJSON}/SetList.json.gz`);
    if (!res.ok) throw new Error(`MTGJSON's product list didn't load (${res.status})`);
    const data = JSON.parse(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text()).data;
    const today = todayISO();
    const STD = ['play', 'set', 'draft', 'default'];
    // A few entries list the box as holding 1 item (a display, not packs): use a normal box size then
    const packsIn = (p, kind) => { const s = ((p.contents && p.contents.sealed) || [])[0]; return s && s.count >= 6 ? s.count : (kind === 'collector' ? 12 : 36); };
    const list = [];
    data.forEach(s => {
        if (s.isOnlineOnly || !s.releaseDate || s.releaseDate > today || !PACK_SET_TYPES.includes(s.type)) return;
        const boxes = (s.sealedProduct || []).filter(p => p.category === 'booster_box');
        const std = STD.map(k => boxes.find(p => p.subtype === k)).find(Boolean);
        const col = boxes.find(p => p.subtype === 'collector');
        const base = { code: s.code.toLowerCase(), name: s.name, type: s.type, released: s.releaseDate };
        if (std) list.push({ ...base, kind: 'play', packs: packsIn(std, 'play'), box: std.name });
        if (col) list.push({ ...base, kind: 'collector', packs: packsIn(col, 'collector'), box: col.name });
    });
    boxCatalog = { fetched: Date.now(), list };
    store.set('boxes', boxCatalog);
    return list;
}

// Today's offers: 3 recent sets, 1 collector box, 1 Masters set and one
// vintage find (now and then Alpha or Beta). New offers each shop day.
async function ensureDistStock() {
    if (profile.distStock && profile.distStock.day === profile.shopDay) return;
    const list = await loadBoxCatalog();
    const d = new Date(); d.setFullYear(d.getFullYear() - 4);
    const recent = d.toISOString().slice(0, 10);
    const pick = (pool, n) => shuffle(pool.slice()).slice(0, n);
    const std = list.filter(b => b.kind === 'play' && ['expansion', 'core', 'draft_innovation'].includes(b.type) && b.released >= recent);
    const col = list.filter(b => b.kind === 'collector' && b.released >= recent);
    const mas = list.filter(b => b.kind === 'play' && b.type === 'masters');
    const vin = list.filter(b => b.kind === 'play' && b.released < '2000-01-01' && !['lea', 'leb'].includes(b.code));
    const pow = list.filter(b => ['lea', 'leb'].includes(b.code));
    const offers = [...pick(std, 3), ...pick(col, 1), ...pick(mas, 1), ...pick(pow.length && Math.random() < 0.15 ? pow : vin, 1)]
        .map(b => ({ ...b, boxesLeft: b.released < '2000-01-01' ? 1 : 1 + rand(3) }));
    profile.distStock = { day: profile.shopDay, offers };
    saveProfile();
}

function addSealed(b, n) {
    const k = sealedKey(b);
    const s = profile.sealed[k] || { code: b.code, kind: b.kind, name: b.name, type: b.type, released: b.released, n: 0 };
    s.n += n;
    profile.sealed[k] = s;
}
function buyBox(i) {
    const o = profile.distStock && profile.distStock.offers[i];
    if (!o || o.boxesLeft <= 0) return;
    const price = boxPrice(o);
    if (profile.usd < price) { toast(`A box costs ${usd(price)} - you have ${usd(profile.usd)}.`); return; }
    profile.usd = round2(profile.usd - price);
    o.boxesLeft--;
    addSealed(o, o.packs);
    saveProfile();
    toast(`📦 ${o.box || o.name} arrived: ${o.packs} packs in your stockroom.`);
    renderDist();
}
function buyLoosePack(i) {
    const o = profile.distStock && profile.distStock.offers[i];
    if (!o) return;
    const price = loosePackPrice(o);
    if (profile.usd < price) { toast(`A pack costs ${usd(price)} - you have ${usd(profile.usd)}.`); return; }
    profile.usd = round2(profile.usd - price);
    addSealed(o, 1);
    saveProfile();
    renderDist();
}
async function crackSealed(k) {
    const s = profile.sealed[k];
    if (!s || !s.n) return;
    const area = $('crackArea');
    area.innerHTML = '<div class="loading">Shuffling the sheets...</div>';
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    let pack;
    try {
        pack = await drawPack(s.code, s.kind);
    } catch (e) {
        area.innerHTML = `<p class="warn">Couldn't open it: ${esc(e.message)} The pack is still sealed - you can sell it in the case.</p>`;
        return;
    }
    s.n--;
    if (!s.n) delete profile.sealed[k];
    pack.cards.forEach(p => { p.copy = rollCopy(p.foil, pack.set.releaseDate); addCopy(p.id, p.copy); });
    profile.packs++;
    saveProfile();
    renderStockroom();
    renderPackReveal(pack, 'crackArea');
}
function listSealed(k) {
    const s = profile.sealed[k];
    if (!s || !s.n) return;
    s.n--;
    // Listed at its shop price: pack buyers pay up to 10% over, never more
    profile.displayCase.push({ sealed: k, meta: { code: s.code, kind: s.kind, name: s.name, type: s.type, released: s.released }, askingPrice: packMarket(s) });
    if (!s.n) delete profile.sealed[k];
    saveProfile();
    renderStockroom();
    toast(`📦 A ${s.name} pack is in your display case.`);
}

async function renderDist() {
    ensureShopDay();
    $('distHead').innerHTML = `<div class="pos-stats">
            <div><span class="pos-k">Day</span><strong>${profile.shopDay}</strong></div>
            <div><span class="pos-k">Shop cash</span><strong class="${profile.usd < 0 ? 'neg' : ''}">💵 ${usd(profile.usd)}</strong></div>
            <div><span class="pos-k">Sealed packs</span><strong>📦 ${Object.values(profile.sealed).reduce((a, s) => a + s.n, 0)}</strong></div>
        </div>
        <p class="note">Boxes and pack counts are real products from <a href="https://mtgjson.com" target="_blank" rel="noopener">MTGJSON</a>. A pack's shop price is what its cards are worth on average (each card's TCGplayer price from <a href="https://scryfall.com" target="_blank" rel="noopener">Scryfall</a>, weighted by the set's real pull odds and card condition) × ${PACK_EV_MARKUP}, times a sealed premium for older packs (${PACK_TIERS.filter(t => t.premium).map(t => `${t.label} ×${t.premium}`).join(', ')}), since unopened old packs sell for far more than their cards. Card values are refreshed every ${PACK_EV_DAYS} days. Boxes cost ${Math.round(WHOLESALE_BOX * 100)}% of their packs' shop price, loose packs ${Math.round(WHOLESALE_PACK * 100)}%. New offers come each shop day.</p>`;
    renderStockroom();
    const box = $('distOffers');
    if (!profile.distStock || profile.distStock.day !== profile.shopDay) box.innerHTML = '<div class="loading">Calling the distributor...</div>';
    try {
        await ensureDistStock();
    } catch (e) {
        box.innerHTML = `<p class="warn">${esc(e.message)}. Try this tab again in a moment.</p>`;
        return;
    }
    box.innerHTML = profile.distStock.offers.map((o, i) => {
        const t = packTier(o);
        return `<div class="offer-card tier-${t.key}">
            <div class="offer-top"><span class="tier-chip">${esc(t.label)}</span><span class="note">${o.released.slice(0, 4)}</span></div>
            <strong>${esc(o.name)}</strong>
            <div class="note">${esc(o.box || `${o.name} box`)} · ${o.packs} packs</div>
            <div class="note">Shop price ${usd(packMarket(o))} a pack</div>
            <div class="note">${esc(packPriceNote(o))}</div>
            <div class="row">
                <button class="btn gold small" onclick="buyBox(${i})" ${o.boxesLeft <= 0 || profile.usd < boxPrice(o) ? 'disabled' : ''}>Box ${usd(boxPrice(o))}</button>
                <button class="btn small" onclick="buyLoosePack(${i})" ${profile.usd < loosePackPrice(o) ? 'disabled' : ''}>1 pack ${usd(loosePackPrice(o))}</button>
            </div>
            <div class="note">${o.boxesLeft > 0 ? `${o.boxesLeft} box${o.boxesLeft === 1 ? '' : 'es'} left today` : 'Boxes sold out today'}</div>
        </div>`;
    }).join('');
    // Price anything not yet valued, then redraw once
    ensurePackEVs([...profile.distStock.offers, ...Object.values(profile.sealed)], () => { if (!$('view-dist').classList.contains('hidden')) renderDist(); });
}
function renderStockroom() {
    const list = Object.entries(profile.sealed).sort((a, b) => packMarket(b[1]) - packMarket(a[1]));
    $('stockroom').innerHTML = list.length ? `<table class="pos-table"><thead><tr><th>Sealed</th><th>Packs</th><th>Shop price</th><th></th></tr></thead><tbody>${list.map(([k, s]) => `
        <tr><td><strong>${esc(s.name)}</strong> <span class="note">${kindLabel(s)} · ${esc(packTier(s).label)}</span></td><td>${s.n}</td><td title="${esc(packPriceNote(s))}">${usd(packMarket(s))}</td>
        <td class="pos-actions"><button class="btn small primary" onclick="crackSealed('${k}')">✂️ Crack one</button>
        ${s.n > 1 ? `<button class="btn small gold" onclick="openWholeBox('${k}')" title="Open up to one box's worth and see the best hits">🎉 Open ${Math.min(s.n, coinBoxSize(s))}</button>` : ''}
        <button class="btn small" onclick="listSealed('${k}')" title="Sell it sealed at its shop price: customers who don't find a single they want often grab a pack (they pay up to 10% over the shop price)">＋ Case</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="note">No sealed product yet. Order a box or a pack above.</p>';
}

// ---------------------------------------------------------------------
// Pack reveal (stacked, 2026-10-06): the wrapper peels open in 3D, the
// cards land in one stack, cheapest on top, and each tap sends the top
// card flying to show the next. The better the pull, the bigger the show
// (PULL_TIERS, by the copy's value): a glow, light rays and a banner,
// confetti and a shake, and for the really expensive ones a full-screen
// jackpot with the price counting up.
// ---------------------------------------------------------------------
const REVEALS = {};
const PULL_TIERS = [
    { key: 'jackpot', min: 250, label: '💎 JACKPOT!' },
    { key: 'huge', min: 50, label: '🔥 HUGE PULL!' },
    { key: 'big', min: 10, label: '💰 BIG HIT!' },
    { key: 'nice', min: 2, label: '✨ Nice pull' }
];
function pullValue(p) { return p.copy ? copyValue(p.card, p.copy) : baseUsd(p.card, p.foil); }
function pullTier(p) {
    if (p.copy && p.copy.s) return PULL_TIERS[0]; // serialized is always a jackpot
    const v = pullValue(p);
    return PULL_TIERS.find(t => v >= t.min) || null;
}
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function renderPackReveal(pack, areaId = 'packArea') {
    // Cheapest first, the best pull last (basics first of all)
    const order = pack.cards.map((p, i) => i).sort((a, b) => {
        const A = pack.cards[a], B = pack.cards[b];
        return (isBasic(B.card) - isBasic(A.card)) || (pullValue(A) - pullValue(B)) || (a - b);
    });
    REVEALS[areaId] = { pack, order, pos: 0, busy: false };
    const code = (pack.set.code || '').toUpperCase();
    const n = order.length;
    $(areaId).innerHTML = `
        <div class="crack-stage">
            <div class="pack3d" id="p3d-${areaId}" role="button" tabindex="0" aria-label="Tear the pack open" onclick="peelPack('${areaId}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); peelPack('${areaId}'); }">
                <div class="pk-flap"><span>${esc(code)}</span></div>
                <div class="pk-body"><span class="pk-spark" aria-hidden="true">✨</span><strong>${esc(pack.set.name)}</strong><small>${esc(pack.name || '')}</small><em>Tap to tear open</em></div>
            </div>
            <div class="stack-stage hidden" id="ss-${areaId}">
                <button type="button" class="pstack" id="ps-${areaId}" onclick="nextPackCard('${areaId}')" aria-label="Next card">
                    <span class="rays" aria-hidden="true"></span>
                    ${order.map((ci, k) => { const p = pack.cards[ci]; return `<span class="scard${p.foil ? ' foil' : ''}${p.copy && p.copy.s ? ' serial' : ''}" data-k="${k}" style="--i:${n - k}; z-index:${n - k}; --rot:${((k * 37) % 9) - 4}deg; --dx:${((k * 53) % 7) - 3}px; --dy:${Math.min(k, 6) * 2}px;">${p.card.img ? `<img src="${p.card.img}" alt="${esc(p.card.name)}" loading="${k < 3 ? 'eager' : 'lazy'}">` : `<span class="noimg">${esc(p.card.name)}</span>`}</span>`; }).join('')}
                </button>
                <div class="stack-info" id="si-${areaId}" aria-live="polite"></div>
                <div class="row" style="justify-content:center;">
                    <button class="btn primary" id="snext-${areaId}" onclick="nextPackCard('${areaId}')">Next card ▶</button>
                    <button class="btn" onclick="revealAllPack('${areaId}')">⏩ Reveal all</button>
                    <span class="note" id="sleft-${areaId}"></span>
                </div>
                <div class="pulled" id="pl-${areaId}" aria-label="Cards pulled so far"></div>
            </div>
            <div class="pull-announce" id="ann-${areaId}" aria-live="polite"></div>
            <p class="note hidden" id="sum-${areaId}"></p>
        </div>`;
}
function peelPack(areaId) {
    const el = $(`p3d-${areaId}`);
    if (!el || el.classList.contains('peeling')) return;
    el.classList.add('peeling');
    setTimeout(() => el.classList.add('opened'), 650);
    setTimeout(() => {
        el.classList.add('hidden');
        $(`ss-${areaId}`).classList.remove('hidden');
        showTopCard(areaId);
    }, 1150);
}
function topEl(areaId) { const R = REVEALS[areaId]; return document.querySelector(`#ps-${areaId} .scard[data-k="${R.pos}"]`); }
// The card now on top of the stack: name, value and its celebration
function showTopCard(areaId) {
    const R = REVEALS[areaId];
    const n = R.order.length;
    $(`sleft-${areaId}`).textContent = R.pos < n ? `${n - R.pos} of ${n} left` : '';
    if (R.pos >= n) return;
    const p = R.pack.cards[R.order[R.pos]];
    const el = topEl(areaId);
    if (el) el.classList.add('top');
    const t = pullTier(p);
    const stack = $(`ps-${areaId}`);
    stack.className = `pstack${t ? ` t-${t.key}` : ''}`;
    const v = pullValue(p);
    $(`si-${areaId}`).innerHTML = `<strong>${esc(p.card.name)}</strong> ${p.copy ? condBadge(p.copy) : ''}<span class="si-val${t && t.key !== 'nice' ? ' hot' : ''}">${usd(v)}</span><br><span class="note">${esc(p.card.rarity)}${p.foil ? ' · foil' : ''} · ${supportBadge(p.card)}</span>`;
    stack.setAttribute('aria-label', `${p.card.name}, ${usd(v)}. Tap for the next card`);
    if (t) celebratePull(areaId, p, t, v);
    else if (p.card.rarity === 'mythic' || p.foil) floatValue(stack, p.card.rarity === 'mythic' ? '🌟 Mythic' : '✨ Foil');
}
function nextPackCard(areaId) {
    const R = REVEALS[areaId];
    if (!R || R.busy || $('spotlight')) return;
    if (R.pos >= R.order.length) return;
    const el = topEl(areaId);
    const p = R.pack.cards[R.order[R.pos]];
    const t = pullTier(p);
    R.busy = true;
    if (el) { el.classList.remove('top'); el.classList.add(R.pos % 2 ? 'fly-l' : 'fly-r'); }
    const done = () => {
        if (el) el.remove();
        const thumb = document.createElement('button');
        thumb.type = 'button';
        if (t) thumb.className = `t-${t.key}`;
        thumb.title = `${p.card.name} · ${usd(pullValue(p))}`;
        thumb.innerHTML = p.card.imgS || p.card.img ? `<img src="${p.card.imgS || p.card.img}" alt="${esc(p.card.name)}">` : `<span class="noimg">${esc(p.card.name)}</span>`;
        thumb.onclick = () => showCardSheet(p.card.id);
        $(`pl-${areaId}`).appendChild(thumb);
        R.pos++;
        R.busy = false;
        if (R.pos >= R.order.length) { $(`ps-${areaId}`).classList.add('hidden'); $(`si-${areaId}`).innerHTML = ''; $(`snext-${areaId}`).disabled = true; packSummary(areaId); }
        showTopCard(areaId);
        if (R.auto && R.pos < R.order.length) setTimeout(() => nextPackCard(areaId), pullTier(R.pack.cards[R.order[R.pos]]) ? 1600 : 260);
    };
    if (reducedMotion()) done(); else setTimeout(done, 380);
}
function revealAllPack(areaId) {
    const R = REVEALS[areaId];
    if (!R) return;
    R.auto = true;
    nextPackCard(areaId);
}
// ---- Celebrations, bigger with the price ----
function floatValue(host, text) {
    const f = document.createElement('span');
    f.className = 'float-val';
    f.textContent = text;
    host.appendChild(f);
    setTimeout(() => f.remove(), 1700);
}
function confettiBurst(n) {
    if (reducedMotion()) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['var(--gold)', 'var(--mana-R)', 'var(--mana-U)', 'var(--mana-G)', 'var(--mana-W)', 'var(--mana-B)', 'var(--brand-light)', 'var(--mythic)'];
    box.innerHTML = Array.from({ length: n }, () => `<i style="--x:${Math.random() * 100}vw; --c:${colors[rand(colors.length)]}; --r:${rand(360)}deg; --drift:${Math.round((Math.random() - 0.5) * 240)}px; --t:${(1.8 + Math.random() * 1.8).toFixed(2)}s; --d:${(Math.random() * 0.6).toFixed(2)}s; --w:${6 + rand(6)}px"></i>`).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4600);
}
function shakePage() {
    if (reducedMotion()) return;
    const wrap = document.querySelector('.wrap');
    if (!wrap) return;
    wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
    setTimeout(() => wrap.classList.remove('shake'), 600);
}
// Count a price up from $0 (the plain value is set at the end, for copying and screen readers)
function rollPrice(el, value, ms = 1800) {
    if (!el) return;
    if (reducedMotion()) { el.textContent = usd(value); return; }
    const t0 = performance.now();
    const step = now => {
        const k = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - k, 3);
        el.textContent = usd(value * eased);
        if (k < 1) requestAnimationFrame(step); else el.textContent = usd(value);
    };
    requestAnimationFrame(step);
}
function announce(areaId, what, name, value) {
    const ann = $(`ann-${areaId}`);
    if (!ann) return;
    ann.innerHTML = `<span class="ann-what">${what}</span><span class="ann-name">${esc(name)}</span><span class="ann-val">${usd(value)}</span>`;
    ann.classList.remove('show'); void ann.offsetWidth; ann.classList.add('show');
    clearTimeout(ann._t); ann._t = setTimeout(() => ann.classList.remove('show'), 2500);
    rollPrice(ann.querySelector('.ann-val'), value, 1200);
}
function celebratePull(areaId, p, t, v) {
    const stack = $(`ps-${areaId}`);
    if (t.key === 'nice') { floatValue(stack, `+${usd(v)}`); return; }
    if (t.key === 'big') { announce(areaId, t.label, p.card.name, v); confettiBurst(24); return; }
    if (t.key === 'huge') { announce(areaId, t.label, p.card.name, v); confettiBurst(70); shakePage(); return; }
    spotlight({ title: p.copy && p.copy.s ? '🌈 SERIALIZED!' : t.label, card: p.card, value: v, sub: `${p.copy ? `${copyLabel(p.copy)} · ` : ''}one of the best pulls you can get` });
}
// Full-screen moment: jackpots and graded slabs
function spotlight({ title, card, value, sub, slab }) {
    closeSpotlight();
    const el = document.createElement('div');
    el.className = 'spotlight';
    el.id = 'spotlight';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    const pic = `<div class="sl-card">${card.img ? `<img src="${card.img}" alt="${esc(card.name)}">` : `<span class="noimg">${esc(card.name)}</span>`}</div>`;
    el.innerHTML = `<div class="sl-rays" aria-hidden="true"></div><div class="sl-box">
        <div class="sl-title">${title}</div>
        ${slab ? `<div class="slab-case"><div class="slab-label"><span>${esc(card.name)}<br><small class="note">${esc(slab.word)}</small></span><span class="g">${slab.grade}</span></div>${pic}</div>` : pic}
        <div class="sl-name">${esc(card.name)}</div>
        <div class="sl-val" id="slVal">${usd(0)}</div>
        ${sub ? `<div class="sl-sub">${sub}</div>` : ''}
        <button class="btn primary" onclick="closeSpotlight()">${slab ? 'Nice!' : 'Keep it ✨'}</button></div>`;
    el.onclick = e => { if (e.target === el) closeSpotlight(); };
    document.body.appendChild(el);
    el.querySelector('.btn').focus();
    rollPrice($('slVal'), value, 2200);
    confettiBurst(120);
    setTimeout(() => confettiBurst(60), 900);
    shakePage();
}
function closeSpotlight() {
    const el = $('spotlight');
    if (!el) return;
    el.remove();
    // A "reveal all" run carries on
    Object.keys(REVEALS).forEach(a => { const R = REVEALS[a]; if (R.auto && !R.busy && R.pos < R.order.length) setTimeout(() => nextPackCard(a), 500); });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('spotlight')) closeSpotlight(); });
function packSummary(areaId) {
    const cards = REVEALS[areaId].pack.cards;
    const total = cards.reduce((a, p) => a + pullValue(p), 0);
    const best = cards.slice().sort((a, b) => pullValue(b) - pullValue(a))[0];
    const sum = $(`sum-${areaId}`);
    if (REVEALS[areaId].pack.isHits) { sum.innerHTML = `That's the best of the box: ${cards.length} hits worth about ${usd(total)} together. Tap any card above for details.`; sum.classList.remove('hidden'); return; }
    sum.innerHTML = `${cards.length} cards added to your collection${best ? ` · best pull: <strong>${esc(best.card.name)}</strong> (${usd(pullValue(best))})` : ''} · pack total about ${usd(total)} (Scryfall's TCGplayer prices × condition × today's market). Tap a card above for details.`;
    sum.classList.remove('hidden');
}

