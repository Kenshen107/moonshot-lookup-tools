// Cosmetics Locker (2026-11-27, Batch 1 of docs/spellslinger-asset-plan.md): sleeves, playmats, looks and table companions, bought with coins.
// The 🎨 button opens the Locker (it replaced the Looks panel; Looks and Playmats are two of its tabs). Coins come from the main bucket
// (Campaign and Shop Simulator share it; Sandbox coins can be added for free, so they can't buy cosmetics). Nothing costs real money.
// What a player owns and wears is saved in profile.cosmetics: { owned: [ids], sleeve, companion, deckSleeves: { deckName: id } }.
// Art is optional: a sleeve with `css` is drawn in code from the theme tokens; one with `img` uses spellslinger/art/sleeves/<id>.png.

const COS_PRICES = { common: 300, rare: 1000, epic: 3000, legendary: 8000 };
const COS_RARITY_LABEL = { free: 'Free', common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const weave = (c, rot = 45) => `radial-gradient(circle at 50% 50%, var(--gold) 0 9%, color-mix(in srgb, var(--gold) 40%, transparent) 10% 12%, transparent 13%), ` +
    `repeating-linear-gradient(${rot}deg, color-mix(in srgb, var(--mana-${c}) 70%, var(--bg-canvas)) 0 5px, color-mix(in srgb, var(--mana-${c}) 38%, var(--bg-canvas)) 5px 10px)`;
const COSMETICS = [
    // Sleeves (card backs)
    { id: 'classic', slot: 'sleeve', rarity: 'free', name: 'Arena Classic', note: 'The ornate gold card back the table has always used.', img: 'spellslinger/art/ui/arena-cardback.jpg', classic: true },
    { id: 'ember-weave', slot: 'sleeve', rarity: 'common', name: 'Ember Weave', note: 'Red woven stripes with a gold stud.', css: weave('R') },
    { id: 'tide-weave', slot: 'sleeve', rarity: 'common', name: 'Tide Weave', note: 'Blue woven stripes with a gold stud.', css: weave('U', -45) },
    { id: 'grave-weave', slot: 'sleeve', rarity: 'common', name: 'Grave Weave', note: 'Dark woven stripes with a gold stud.', css: weave('B') },
    { id: 'grove-weave', slot: 'sleeve', rarity: 'common', name: 'Grove Weave', note: 'Green woven stripes with a gold stud.', css: weave('G', -45) },
    { id: 'dawn-weave', slot: 'sleeve', rarity: 'common', name: 'Dawn Weave', note: 'Pale gold woven stripes.', css: weave('W') },
    { id: 'gilded-sanctum', slot: 'sleeve', rarity: 'rare', name: 'Gilded Sanctum', note: 'Art-deco navy and gold around a glowing crystal.', img: 'spellslinger/art/sleeves/gilded-sanctum.png' },
    { id: 'ember-crest', slot: 'sleeve', rarity: 'common', name: 'Ember Crest', note: 'Deep red with a gold flame crest.', img: 'spellslinger/art/sleeves/ember-crest.png' },
    { id: 'dragon-coil', slot: 'sleeve', rarity: 'rare', name: 'Dragon Coil', note: 'A gold dragon coiled on dark red.', img: 'spellslinger/art/sleeves/dragon-coil.png' },
    { id: 'koi-pair', slot: 'sleeve', rarity: 'rare', name: 'Koi Pair', note: 'Two gold koi circling in deep blue water.', img: 'spellslinger/art/sleeves/koi-pair.png' },
    { id: 'night-owl', slot: 'sleeve', rarity: 'rare', name: 'Night Owl', note: 'A gold owl under a crescent moon on violet.', img: 'spellslinger/art/sleeves/night-owl.png' },
    // Table companions (08i-companion.js draws and moves them)
    { id: 'none', slot: 'companion', rarity: 'free', name: 'No companion', note: 'Keep your corner of the table empty.' },
    { id: 'ember-drake', slot: 'companion', rarity: 'rare', name: 'Ember Drake', note: 'A dragon whelp who cheers your hits, flinches when you are hurt and naps when nothing happens. Tap it to pet it.', thumb: 'spellslinger/art/companions/ember-drake/thumb.png' }
];
// The computer characters each have a sleeve of their own, so a table of four looks like four people
const BOT_SLEEVES = { greg: 'grove-weave', marcus: 'koi-pair', sarah: 'gilded-sanctum', leo: 'night-owl', trevor: 'grave-weave', sam: 'ember-crest', arthur: 'dragon-coil', brenda: 'dawn-weave', luke: 'grave-weave' };
const COS_SEAT_SLEEVES = ['tide-weave', 'ember-weave', 'grove-weave', 'grave-weave'];
const COS_SOON = [['🎲', 'Desk props', 'a life-counter d20, an hourglass that turns on your turn, a candle, a crystal ball'], ['🧙', 'Avatars', '24 portraits for your seat'], ['😄', 'Emotes', '24 stickers to send at the table'], ['🎆', 'Win celebrations', 'fireworks, a dragon flyover, a rain of coins and more'], ['🖼️', 'Themes', '12 painted themes with backgrounds and frames'], ['🃏', 'More sleeves and companions', '30 sleeves and 16 companions in all (11 sleeves and 1 companion so far)']];

function cosItem(id) { return COSMETICS.find(c => c.id === id) || null; }
function cosPrice(c) { return c.rarity === 'free' ? 0 : COS_PRICES[c.rarity] || 0; }
function cosState() {
    if (!profile) return { owned: [], sleeve: 'classic', companion: 'none', deckSleeves: {} };
    const c = profile.cosmetics = profile.cosmetics || {};
    if (!Array.isArray(c.owned)) c.owned = [];
    if (!c.sleeve || !cosItem(c.sleeve)) c.sleeve = 'classic';
    if (!c.companion || !cosItem(c.companion)) c.companion = 'none';
    if (!c.deckSleeves || typeof c.deckSleeves !== 'object') c.deckSleeves = {};
    return c;
}
function cosOwns(id) { const c = cosItem(id); return !!c && (c.rarity === 'free' || cosState().owned.includes(id)); }
// Coins of the main bucket, wherever they are parked right now (04b-modes.js swapBucket)
function cosCoins() {
    if (!profile) return 0;
    if ((profile.bucket || 'main') === 'main') return profile.coins || 0;
    return (profile.stash && profile.stash.main && profile.stash.main.coins) || 0;
}
function cosSpend(n) {
    if ((profile.bucket || 'main') === 'main') profile.coins -= n;
    else profile.stash.main.coins -= n;
}
let cosConfirm = null; // { id, until } - the second tap buys
function cosBuy(id) {
    const c = cosItem(id); if (!c || cosOwns(id)) return;
    const price = cosPrice(c);
    if (cosCoins() < price) { toast(`🪙 ${c.name} costs ${price.toLocaleString()} coins; you have ${cosCoins().toLocaleString()} (Campaign and Shop coins).`); return; }
    if (!cosConfirm || cosConfirm.id !== id || Date.now() > cosConfirm.until) { cosConfirm = { id, until: Date.now() + 4000 }; lockerPanel(); return; }
    cosConfirm = null;
    cosSpend(price); cosState().owned.push(id);
    saveProfile(); renderCoins();
    toast(`✨ ${c.name} is yours.`);
    cosEquip(id);
}
function cosEquip(id, deckName) {
    const c = cosItem(id); if (!c || !cosOwns(id)) return;
    const s = cosState();
    if (c.slot === 'sleeve' && deckName) { if (id === 'default') delete s.deckSleeves[deckName]; else s.deckSleeves[deckName] = id; }
    else if (c.slot === 'sleeve') s.sleeve = id;
    else if (c.slot === 'companion') s.companion = id;
    saveProfile();
    if (typeof companionSync === 'function') companionSync();
    if (typeof G !== 'undefined' && G && !G.over && typeof renderGame === 'function') renderGame();
    lockerPanel();
}
function cosDeckSleeve(deckName, id) {
    const s = cosState();
    if (!id || id === 'default') delete s.deckSleeves[deckName]; else if (cosOwns(id)) s.deckSleeves[deckName] = id;
    saveProfile();
}

// ---- Sleeves on the table ----
function sleeveIdFor(P) {
    if (!P) return 'classic';
    if (P.isAI) {
        const key = P.char && P.char.key;
        return (key && BOT_SLEEVES[key]) || COS_SEAT_SLEEVES[P.i % COS_SEAT_SLEEVES.length];
    }
    if (G && G.hotseat && P.i !== 0) return 'classic'; // the second person's own picks live in their profile, not loaded here
    const s = cosState();
    return (P.deckName && s.deckSleeves[P.deckName]) || s.sleeve || 'classic';
}
// A picture's address is made absolute: a url() inside --slv would otherwise be read from styles.css's folder (spellslinger/spellslinger/art/...)
function sleeveBg(c) { if (c.css) return c.css; let u = c.img; try { u = new URL(c.img, document.baseURI).href; } catch (e) { /* keep it */ } return `url('${u}') center / cover no-repeat`; }
// Class and style for the library pile and the hand backs (08-table.js). Classic keeps the table's own drawing.
function sleeveAttr(P) {
    const c = cosItem(sleeveIdFor(P));
    if (!c || c.classic) return { cls: '', style: '' };
    return { cls: ' has-slv', style: ` style="--slv: ${sleeveBg(c).replace(/"/g, '&quot;')}" data-sleeve="${c.id}"` };
}

// ---- The Locker ----
let LOCKER_TAB = 'looks';
const LOCKER_TABS = [['looks', '🎨', 'Looks'], ['sleeves', '🃏', 'Sleeves'], ['mats', '🗺️', 'Playmats'], ['companions', '🐉', 'Companions'], ['soon', '✨', 'Coming soon']];
function cosBuyBtn(c) {
    if (cosOwns(c.id)) return '';
    const price = cosPrice(c), confirm = cosConfirm && cosConfirm.id === c.id && Date.now() <= cosConfirm.until;
    return `<button type="button" class="btn small ${confirm ? 'primary' : ''} cos-buy" onclick="cosBuy('${c.id}')"${cosCoins() < price ? ' aria-disabled="true"' : ''}>${confirm ? `Tap again to buy · 🪙 ${price.toLocaleString()}` : `Buy · 🪙 ${price.toLocaleString()}`}</button>`;
}
function cosCard(c, worn, preview) {
    const owned = cosOwns(c.id);
    return `<div class="cos-card${worn ? ' on' : ''}${owned ? '' : ' locked'}" data-cos="${c.id}">
        ${preview}
        <strong>${esc(c.name)}</strong>
        <span class="cos-rar r-${c.rarity}">${COS_RARITY_LABEL[c.rarity]}</span>
        <small>${esc(c.note)}</small>
        <div class="cos-act">${owned ? (worn ? '<span class="cos-worn">✔ Using</span>' : `<button type="button" class="btn small" onclick="cosEquip('${c.id}')">Use</button>`) : cosBuyBtn(c)}</div>
    </div>`;
}
function sleevesTabHTML() {
    const s = cosState(), list = COSMETICS.filter(c => c.slot === 'sleeve');
    const owned = list.filter(c => cosOwns(c.id));
    const decks = (profile && profile.decks || []).map(d => d.name).filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 40);
    const perDeck = decks.length ? `<details class="cos-perdeck"><summary>🃏 A different sleeve for one deck</summary>
        <div class="cos-deck-list">${decks.map(n => `<label><span>${esc(n)}</span><select onchange="cosDeckSleeve(${esc(JSON.stringify(n))}, this.value)"><option value="default">Same as my sleeve</option>${owned.map(c => `<option value="${c.id}"${s.deckSleeves[n] === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`).join('')}</div></details>` : '';
    return `<p class="note">Your card back on the table: the library pile and the backs of your hand. Each computer opponent has a sleeve of its own.</p>
        <div class="cos-grid">${list.map(c => cosCard(c, s.sleeve === c.id, `<span class="cos-sleeve" style="--slv: ${sleeveBg(c).replace(/"/g, '&quot;')}"><i></i></span>`)).join('')}</div>${perDeck}`;
}
function companionsTabHTML() {
    const s = cosState();
    return `<p class="note">A companion sits in the corner of your side of the table during games and reacts to what happens. It never covers cards. Tap it to pet it.</p>
        <div class="cos-grid">${COSMETICS.filter(c => c.slot === 'companion').map(c => cosCard(c, s.companion === c.id,
            c.id === 'none' ? '<span class="cos-comp none">∅</span>' : `<span class="cos-comp" data-comp-preview="${c.id}">${c.thumb ? `<img src="${c.thumb}" alt="">` : ''}</span>`)).join('')}</div>`;
}
function soonTabHTML() {
    return `<p class="note">Coming in the next batches of new art. They will be bought with coins here too.</p>
        <div class="cos-soon">${COS_SOON.map(([i, n, t]) => `<div><span aria-hidden="true">${i}</span><strong>${n}</strong><small>${t}</small></div>`).join('')}</div>`;
}
function lockerPanel(tab) {
    if (tab) LOCKER_TAB = tab;
    if (!LOCKER_TABS.some(t => t[0] === LOCKER_TAB)) LOCKER_TAB = 'looks';
    const body = LOCKER_TAB === 'looks' ? looksTabHTML() : LOCKER_TAB === 'mats' ? matsTabHTML() : LOCKER_TAB === 'sleeves' ? sleevesTabHTML() : LOCKER_TAB === 'companions' ? companionsTabHTML() : soonTabHTML();
    const html = `<div class="looks locker" data-tab="${LOCKER_TAB}"><div class="locker-head"><h2>🎨 Locker</h2>
        <span class="locker-coins" title="Coins from Campaign and Shop Simulator buy cosmetics (Sandbox coins can be added for free, so they don't)">🪙 ${cosCoins().toLocaleString()}</span></div>
        <div class="locker-tabs" role="tablist">${LOCKER_TABS.map(([k, i, n]) => `<button type="button" role="tab" class="locker-tab${k === LOCKER_TAB ? ' on' : ''}" aria-selected="${k === LOCKER_TAB}" onclick="lockerPanel('${k}')"><span aria-hidden="true">${i}</span> ${n}</button>`).join('')}</div>
        <div class="locker-body">${body}</div>
        <p class="note locker-foot">Coins only: nothing here costs real money. Cosmetics change how the table looks, never how a game plays.</p>
        <div class="row" style="justify-content:center; margin-top:8px;"><button class="btn primary" onclick="closeModal()">Done</button></div></div>`;
    const open = document.querySelector('#modalHost .locker');
    if (open) { open.outerHTML = html; } else showModal(html);
    if (typeof companionPreviews === 'function') companionPreviews();
}
lookPanel = function () { lockerPanel(); };
