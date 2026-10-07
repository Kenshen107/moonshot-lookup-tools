// =====================================================================
// Spellslinger Duels - core: helpers, storage, card data
// =====================================================================
const SF = 'https://api.scryfall.com';
const MTGJSON = 'https://mtgjson.com/api/v5';
const EDH = 'https://json.edhrec.com/pages';
const COLORS = ['W', 'U', 'B', 'R', 'G'];
const COLOR_NAMES = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless' };
const BASIC_FOR = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
// Coin prices come from PACK_TIERS (packCoins / boxCoins), by set and kind
const REWARDS = { win: 150, winCommander: 200, loss: 40 };
const START_COINS = 500;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = n => Math.floor(Math.random() * n);
// Takes x out of the list (an empty list back if it isn't there; splice(-1) would
// remove the last item instead - audit, 2026-10-06)
function pull(a, x) { const i = a.indexOf(x); return i >= 0 ? a.splice(i, 1) : []; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

let toastTimer = null;
function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---- Saved data: `store` lives in 00-storage.js (IndexedDB, loaded into memory before this file runs) ----
// Players: each has their own profile (duels:profile:<name>). A profile
// saved before players existed (duels:profile) moves to the first one
// signed in (Ovid, 2026-10-05).
const DEFAULT_ACCOUNTS = ['Dustyn', 'Ovid'];
let accounts = store.get('accounts', null);
if (!accounts) {
    accounts = { list: DEFAULT_ACCOUNTS.slice(), current: 'Ovid' };
    const old = store.get('profile', null);
    if (old) { store.set('profile:Ovid', old); store.remove('profile'); }
    store.set('accounts', accounts);
}
let profile = store.get('profile:' + accounts.current, null);
// The card cache shares browser storage with every player's profile (with IndexedDB the limit is far larger than
// localStorage's 5MB, but the same handling stays for browsers that fall back to localStorage). If a
// save doesn't fit, the cache is cut to the cards this player uses and the
// save is tried again; if it still fails, the player is told (audit, 2026-10-06).
function saveProfile() {
    if (!store.set('profile:' + accounts.current, profile)) {
        trimCardCache();
        if (!store.set('profile:' + accounts.current, profile)) toast('⚠ Browser storage is full: your progress couldn\'t be saved.');
    }
    renderCoins();
}
function trimCardCache() {
    const keep = new Set(Object.keys(profile.collection));
    profile.decks.forEach(d => { Object.keys(d.cards).forEach(id => keep.add(id)); if (d.commander) keep.add(d.commander); });
    try { Object.values(BASIC_IDS).forEach(id => keep.add(id)); } catch (e) { /* not loaded yet */ }
    store.remove('cards');
    store.set('cards', Object.fromEntries([...CARDS].filter(([id]) => keep.has(id))));
}
// Redraws that happen often (the game table, the shop floor): only touch the page when the HTML really changed.
// Keeps hover, scroll, a half-typed price and an open <details> as they were, and skips the layout work.
// Use it only for containers that nothing else writes to (it remembers the last HTML it set).
function setHTML(el, html) {
    if (!el || el._html === html) return false;
    el.innerHTML = html;
    el._html = html;
    return true;
}
// Phones: one sheet for the rest of the tabs, one for the player and test buttons
const isPhone = () => window.matchMedia('(max-width: 600px)').matches;
function menuSheet(title, inner) { $('sheetHost').innerHTML = `<div class="sheet-bg" onclick="if (event.target === this) closeSheet()"><div class="sheet one" role="dialog" aria-label="${esc(title)}"><div><h3>${esc(title)}</h3>${inner}<div class="actions"><button class="btn" onclick="closeSheet()">Close</button></div></div></div></div>`; }
function moreSheet() { menuSheet('More', `<div class="menu-list">${MORE_VIEWS.map(([k, label]) => `<button class="btn${$(`view-${k}`).classList.contains('hidden') ? '' : ' primary'}" onclick="showView('${k}')">${label}</button>`).join('')}</div>`); }
function accountSheet() {
    menuSheet('Player', `<label class="note" for="acctSel2">Who's playing</label>
        <select id="acctSel2" onchange="closeSheet(); pickAccount(this.value)" style="width:100%; margin-top:4px;">${$('acctSel').innerHTML}</select>
        <div class="menu-list"><button class="btn" onclick="closeSheet(); addTestCoins()">＋🪙 Add coins (test build)</button><button class="btn" onclick="closeSheet(); restartPlayer()">↺ Start over (test build)</button></div>`);
    $('acctSel2').value = accounts.current;
}
function renderAccounts() {
    if ($('acctName')) $('acctName').textContent = accounts.current || '';
    $('acctSel').innerHTML = accounts.list.map(n => `<option value="${esc(n)}"${n === accounts.current ? ' selected' : ''}>${esc(n)}</option>`).join('')
        + '<option value="__add">＋ Add player…</option>';
}
function pickAccount(name) {
    if (name === '__add') {
        const n = (prompt('New player name:') || '').trim().slice(0, 24);
        if (!n) { renderAccounts(); return; }
        if (!accounts.list.includes(n)) accounts.list.push(n);
        name = n;
    }
    if (editing && !confirm('Switch players? Unsaved changes to the deck you are building will be lost.')) { renderAccounts(); return; }
    editing = null;
    pauseShop(); SHOP.queue = []; SHOP.log = [];
    accounts.current = name;
    store.set('accounts', accounts);
    profile = store.get('profile:' + name, null);
    ensureProfile();
    renderAccounts();
    const v = VIEWS.find(k => !$(`view-${k}`).classList.contains('hidden')) || 'home';
    showView(v);
    toast(`Playing as ${name}.`);
    if (needsOnboarding()) preconPicker(true);
}
// Test build: wipe the current player back to a brand-new profile.
function restartPlayer() {
    if (!confirm(`Start ${accounts.current} over? This deletes their coins, cards, decks and win/loss record (other players aren't touched).`)) return;
    editing = null;
    pauseShop(); SHOP.queue = []; SHOP.log = [];
    profile = null;
    ensureProfile();
    const v = VIEWS.find(k => !$(`view-${k}`).classList.contains('hidden')) || 'home';
    showView(v);
    toast(`${accounts.current} starts fresh: 🪙 ${START_COINS} coins and 3 free packs.`);
    preconPicker(true);
}
// Test build: free coins on demand, for trying things out.
function addTestCoins() {
    const raw = prompt(`Add how many coins to ${accounts.current}?`, '1000');
    const n = Math.floor(Number(String(raw || '').replace(/[, ]/g, '')));
    if (!n || n < 1) return;
    profile.coins += Math.min(n, 1e7);
    saveProfile();
    if (!$('view-home').classList.contains('hidden')) renderHome();
    if (!$('view-packs').classList.contains('hidden')) renderPacksView();
    toast(`🪙 +${Math.min(n, 1e7).toLocaleString()} coins for ${accounts.current}.`);
}
// Phones show big amounts short (12.5k, $1.2k) so the header stays one row
const shortNum = n => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : Math.round(n).toLocaleString();
function renderCoins() {
    const coins = profile ? profile.coins : 0, usdAmt = profile ? profile.usd || 0 : 0;
    const phone = isPhone();
    const c = phone ? shortNum(coins) : coins.toLocaleString();
    if ($('coinCount').textContent !== c) $('coinCount').textContent = c;
    // Shop cash next to the coins (2026-10-07, owner's request)
    const full = `$${usdAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const cash = phone && usdAmt >= 1000 ? `$${usdAmt >= 1e4 ? shortNum(usdAmt) : `${(usdAmt / 1e3).toFixed(1)}k`}` : phone ? `$${Math.round(usdAmt)}` : full;
    if ($('cashCount') && $('cashCount').textContent !== cash) { $('cashCount').textContent = cash; $('cashPill').setAttribute('aria-label', `Shop cash ${full}. Open the Shop`); }
}
// Cash changes in many places (sales, rent, grading...): keep the pill current
setInterval(() => { try { if (profile) renderCoins(); } catch (e) { /* not ready yet */ } }, 1000);

// ---- Scryfall: requests spaced out, as Scryfall asks (50-100ms apart) ----
let sfQueue = Promise.resolve();
function sfFetch(url, opts) {
    const p = sfQueue.then(async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
            let res;
            // A rate-limited reply can arrive without CORS headers, which the
            // browser reports as a network error: wait and try again either way.
            try { res = await fetch(url, opts); } catch (e) { if (attempt === 3) throw e; await sleep(1500 * (attempt + 1)); continue; }
            if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
            return res;
        }
        throw new Error('Scryfall is busy - try again in a minute');
    });
    sfQueue = p.then(() => sleep(110), () => sleep(110));
    return p;
}
async function sfJSON(url, opts) {
    const res = await sfFetch(url, opts);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
    return res.json();
}

// ---- Card cache: only the fields the game needs, saved between visits ----
const CARDS = new Map(Object.entries(store.get('cards', {})));
let cardsDirty = false;
function persistCards() {
    if (!cardsDirty) return;
    cardsDirty = false;
    const obj = Object.fromEntries(CARDS);
    // Browser storage full: keep the cards the collection and decks use
    if (!store.set('cards', obj)) trimCardCache();
}

// The mana value of one face's cost ("{2}{R}" -> 3)
function manaValueOf(cost) { return (String(cost || '').match(/\{[^}]+\}/g) || []).reduce((a, t) => { const s = t.slice(1, -1); return a + (/^\d+$/.test(s) ? Number(s) : s === 'X' ? 0 : 1); }, 0); }
function slimCard(c) {
    const face = c.card_faces && !c.oracle_text ? c.card_faces[0] : c;
    const front = slimFace(c, face, 0);
    // Two-faced and two-part cards keep their other half: transform and
    // modal double-faced cards, adventures, split cards (712, 715, 709)
    if (c.card_faces && c.card_faces.length > 1 && !c.oracle_text) front.back = slimFace(c, c.card_faces[1], 1);
    return front;
}
function slimFace(c, face, n) {
    const img = (n && face.image_uris) || c.image_uris || (c.card_faces && c.card_faces[0].image_uris) || {};
    const L = c.legalities || {};
    return {
        id: n ? `${c.id}-b` : c.id, name: face.name || c.name, fullName: c.name, cost: face.mana_cost || (n ? '' : c.mana_cost) || '',
        cmc: ['split', 'adventure', 'modal_dfc'].includes(c.layout) ? manaValueOf(face.mana_cost) : (c.cmc || 0),
        type: face.type_line || c.type_line || '', text: face.oracle_text || '', power: face.power, toughness: face.toughness,
        colors: face.colors || c.colors || [], ci: c.color_identity || [], img: img.normal || null, imgS: img.small || null,
        rarity: c.rarity, set: c.set, num: c.collector_number, setName: c.set_name, layout: c.layout, loyalty: face.loyalty ?? c.loyalty,
        defense: face.defense ?? c.defense,
        legal: { modern: L.modern, commander: L.commander },
        usd: (c.prices && (c.prices.usd || c.prices.usd_foil)) || null,
        usdFoil: (c.prices && c.prices.usd_foil) || null,
        frame: c.frame_effects || [], released: c.released_at || null, v: 3
    };
}
function remember(c) { const s = slimCard(c); CARDS.set(s.id, s); cardsDirty = true; return s; }

// Scryfall's /cards/collection: up to 75 cards a request, by id or by name.
async function fetchCollection(identifiers) {
    const found = [];
    const missing = [];
    for (let i = 0; i < identifiers.length; i += 75) {
        const batch = identifiers.slice(i, i + 75);
        const res = await sfJSON(`${SF}/cards/collection`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: batch }) });
        if (!res) continue;
        (res.data || []).forEach(c => found.push(remember(c)));
        (res.not_found || []).forEach(n => missing.push(n));
    }
    persistCards();
    return { found, missing };
}
async function cardsByIds(ids) {
    // Two-part cards cached before back faces were kept are fetched again
    const need = [...new Set(ids)].filter(id => id && (!CARDS.has(id) || (/ \/\/ /.test(CARDS.get(id).fullName || '') && !CARDS.get(id).back) || (/\bBattle\b/.test(CARDS.get(id).type || '') && CARDS.get(id).defense === undefined)));
    if (need.length) await fetchCollection(need.map(id => ({ id })));
    return ids.map(id => CARDS.get(id)).filter(Boolean);
}
// Names -> cards (first printing Scryfall returns for each name)
async function cardsByNames(names) {
    const uniq = [...new Set(names)];
    const { found } = await fetchCollection(uniq.map(name => ({ name })));
    const byName = new Map();
    found.forEach(c => { byName.set(c.fullName.toLowerCase(), c); byName.set(c.name.toLowerCase(), c); });
    return byName;
}
async function searchCards(q, maxPages = 2, order = 'edhrec') {
    let url = `${SF}/cards/search?q=${encodeURIComponent(q)}&order=${order}&unique=cards`;
    const out = [];
    for (let page = 0; page < maxPages && url; page++) {
        const res = await sfJSON(url);
        if (!res) break;
        (res.data || []).forEach(c => out.push(remember(c)));
        url = res.has_more ? res.next_page : null;
    }
    persistCards();
    return out;
}

// Basic lands: one fixed printing each (Foundations), fetched once
const BASIC_IDS = {};
async function loadBasics() {
    if (Object.keys(BASIC_IDS).length === 5) return;
    const saved = store.get('basics', null);
    if (saved && Object.values(saved).every(id => CARDS.has(id))) { Object.assign(BASIC_IDS, saved); return; }
    const res = await sfJSON(`${SF}/cards/search?q=${encodeURIComponent('t:basic -t:snow (name:plains or name:island or name:swamp or name:mountain or name:forest) set:fdn')}&unique=cards`);
    (res ? res.data : []).forEach(c => {
        const s = remember(c);
        const color = Object.keys(BASIC_FOR).find(k => BASIC_FOR[k] === s.name);
        if (color) BASIC_IDS[color] = s.id;
    });
    persistCards();
    store.set('basics', BASIC_IDS);
}
function isBasic(card) { return /\bBasic\b/.test(card.type) && /\bLand\b/.test(card.type); }

// MTGJSON files come gzipped; browsers can unzip them directly.
const mtgjsonCache = {};
function mtgjsonSet(code) {
    if (!mtgjsonCache[code]) {
        mtgjsonCache[code] = fetch(`${MTGJSON}/${code.toUpperCase()}.json.gz`).then(async res => {
            if (!res.ok) throw new Error(`Couldn't load ${code.toUpperCase()} (${res.status})`);
            return JSON.parse(await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text()).data;
        });
        mtgjsonCache[code].catch(() => { delete mtgjsonCache[code]; });
    }
    return mtgjsonCache[code];
}

