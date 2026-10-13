// =====================================================================
// Views, packs, collection and decks
// =====================================================================
const VIEWS = ['home', 'packs', 'decks', 'play', 'precons', 'draft', 'welcome', 'campaign', 'shop', 'dist', 'rules'];
const MORE_VIEWS = [['precons', '📚 Precons'], ['draft', '🃏 Draft'], ['welcome', '🎁 Welcome Decks'], ['campaign', '🗺️ Campaign'], ['shop', '🏪 Shop'], ['dist', '📦 Distributor'], ['rules', '📖 Rules']];
function showView(v) {
    closeSheet();
    if (profile && !modeAllows(v)) { toast(`${$(`tab-${v}`) ? $(`tab-${v}`).textContent.trim() : v} isn't in ${MODES[modeKey()].name} mode. Use the mode buttons at the top.`); v = 'home'; }
    VIEWS.forEach(k => {
        $(`view-${k}`).classList.toggle('hidden', k !== v);
        $(`tab-${k}`).setAttribute('aria-selected', String(k === v));
    });
    document.querySelectorAll('.bottom-nav [data-v]').forEach(b => { const on = b.dataset.v === v || (b.dataset.v === 'more' && MORE_VIEWS.some(([k]) => k === v)); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (v === 'welcome') renderWelcomeView();
    if (v === 'precons') renderPreconLibrary();
    if (v === 'home') renderHome();
    if (v === 'packs') renderPacksView();
    if (v === 'decks') { if (!editing) renderDeckPicker(); }
    if (v === 'play') renderPlayView();
    if (v === 'rules') renderRulesView();
    if (v === 'shop') renderShop();
    if (v === 'dist') renderDist();
    if (v === 'campaign') renderCampaign();
    if (v === 'draft') renderDraft();
    try { history.replaceState(null, '', `#${v}`); } catch (e) { /* fine */ }
}

function ensureProfile() {
    if (!profile) {
        profile = { coins: START_COINS, freePacks: 3, collection: {}, decks: [], wins: 0, losses: 0, packs: 0, created: todayISO(), mode: 'campaign', bucket: 'main', stash: { sandbox: sandboxStart() } };
    }
    upgradeProfile(profile);
    saveProfile();
    renderCoins();
}

// How much of Magic the game can run: every paper card (one per name, from Scryfall) through rulesFor.
// Measured after each rules round with the coverage test; update these numbers when it's rerun.
const CARD_COVERAGE = { measured: '2026-10-09', total: 34142, full: 13045, partial: 16691, none: 4406, top1000: { full: 822, partial: 129, none: 49 } };
function coverageHTML() {
    const c = CARD_COVERAGE, pct = n => Math.round(100 * n / c.total), play = c.full + c.partial;
    const seg = (n, cls, label) => `<span class="cov-seg ${cls}" style="width:${(100 * n / c.total).toFixed(2)}%" title="${label}: ${n.toLocaleString()} cards (${pct(n)}%)"></span>`;
    return `<div class="cov-head"><strong>🃏 ${play.toLocaleString()} of ${c.total.toLocaleString()} Magic cards are playable</strong> <span class="note">(${pct(play)}%)</span></div>
        <div class="cov-bar" role="img" aria-label="${c.full.toLocaleString()} cards fully automated, ${c.partial.toLocaleString()} partly, ${c.none.toLocaleString()} not yet">${seg(c.full, 'cov-full', 'Automated')}${seg(c.partial, 'cov-part', 'Partly')}${seg(c.none, 'cov-none', 'Not yet')}</div>
        <div class="cov-legend note"><span><span class="cov-dot cov-full"></span>Automated <strong>${c.full.toLocaleString()}</strong> (${pct(c.full)}%)</span><span><span class="cov-dot cov-part"></span>Partly <strong>${c.partial.toLocaleString()}</strong> (${pct(c.partial)}%)</span><span><span class="cov-dot cov-none"></span>Not yet <strong>${c.none.toLocaleString()}</strong> (${pct(c.none)}%)</span></div>
        <div class="note">Of the 1,000 most-played Commander cards, <strong>${c.top1000.full}</strong> are fully automated and <strong>${c.top1000.full + c.top1000.partial}</strong> are playable. Counted over every paper card on ${c.measured}.</div>`;
}
function renderHome() {
    $('homeCoverage').innerHTML = coverageHTML();
    $('homePrecon').classList.toggle('hidden', !!profile.starterDeck);
    const owned = Object.values(profile.collection).reduce((a, b) => a + b, 0);
    $('homeStats').innerHTML = `
        <div>🪙 <strong>${profile.coins.toLocaleString()}</strong> coins${profile.freePacks ? ` · 🎁 <strong>${profile.freePacks}</strong> free pack${profile.freePacks === 1 ? '' : 's'} to open` : ''}</div>
        <div>🃏 <strong>${owned}</strong> cards collected (${Object.keys(profile.collection).length} different) from ${profile.packs} pack${profile.packs === 1 ? '' : 's'}</div>
        <div>🗂️ <strong>${profile.decks.length}</strong> deck${profile.decks.length === 1 ? '' : 's'}</div>
        <div>⚔️ <strong>${profile.wins}</strong> win${profile.wins === 1 ? '' : 's'} · <strong>${profile.losses}</strong> loss${profile.losses === 1 ? '' : 'es'}</div>`;
}

// ---------------------------------------------------------------------
// Packs: pick one of
// the pack's layouts by its weight, then cards from each sheet by their
// weights (no repeats within a sheet).
// ---------------------------------------------------------------------
let packSets = [];
const PACK_SET_TYPES = ['expansion', 'core', 'masters', 'draft_innovation', 'funny'];
const PACK_TYPE_LABEL = { expansion: 'Expansions', core: 'Core sets', masters: 'Masters sets', draft_innovation: 'Draft sets', funny: 'Un-sets and other fun sets' };
async function loadPackSets() {
    if (packSets.length) return packSets;
    const res = await sfJSON(`${SF}/sets`);
    // Every paper set that came in booster packs, back to Alpha (1993).
    // MTGJSON has the pack odds for nearly all of them; a set without them
    // says so when you try to open one.
    packSets = (res ? res.data : []).filter(s => PACK_SET_TYPES.includes(s.set_type) && !s.digital && s.released_at && s.released_at <= todayISO())
        .sort((a, b) => b.released_at.localeCompare(a.released_at));
    return packSets;
}

async function renderPacksView() {
    const sel = $('packSet');
    // No buying until the set list is in (a click before then had no set and failed)
    if (sel.dataset.ready !== '1') $('buyPlay').disabled = $('buyCollector').disabled = true;
    try {
        await loadPackSets();
        if (!packSets.length) throw new Error('no sets');
        if (sel.dataset.ready !== '1') {
            // Grouped by decade, newest first
            const groups = {};
            packSets.forEach(s => { const dec = `${s.released_at.slice(0, 3)}0s`; (groups[dec] = groups[dec] || []).push(s); });
            sel.innerHTML = Object.entries(groups).map(([dec, list]) => `<optgroup label="${dec}">${list.map(s => `<option value="${s.code}">${esc(s.name)} (${s.released_at.slice(0, 4)})</option>`).join('')}</optgroup>`).join('');
            sel.dataset.ready = '1';
        }
    } catch (e) {
        sel.innerHTML = '<option value="">Couldn\'t load sets - open this tab again to retry</option>';
        return;
    }
    updatePackButtons();
    loadBoxCatalog().then(updatePackButtons).catch(() => {}); // real box sizes, when MTGJSON answers
}
// The selected set as a priced product: { code, kind, type, released, name }
function packMetaFor(code, kind) {
    const s = packSets.find(x => x.code === code);
    return s ? { code, kind, type: s.set_type, released: s.released_at, name: s.name } : null;
}
function packCoins(meta) { return packTier(meta).coins; }
function coinBoxSize(meta) {
    const b = boxCatalog && boxCatalog.list && boxCatalog.list.find(x => x.code === meta.code && x.kind === meta.kind);
    return b ? b.packs : (meta.kind === 'collector' ? 12 : 36);
}
function boxCoins(meta) { return Math.round(coinBoxSize(meta) * packCoins(meta) * (1 - COIN_BOX_DISCOUNT) / 10) * 10; }
const coins = n => `🪙 ${n.toLocaleString()}`;
function updatePackButtons() {
    const play = packMetaFor($('packSet').value, 'play'), col = packMetaFor($('packSet').value, 'collector');
    if (!play) return;
    const free = profile.freePacks > 0;
    $('buyPlay').textContent = free ? `Play booster · 🎁 free (${profile.freePacks} left)` : `Play booster · ${coins(packCoins(play))}`;
    $('buyPlay').disabled = !free && profile.coins < packCoins(play);
    const noCol = col.released < COLLECTOR_FROM; // collector boosters began with Throne of Eldraine (2019)
    $('buyCollector').textContent = noCol ? 'Collector booster · none for this set' : `Collector booster · ${coins(packCoins(col))}`;
    $('buyCollector').disabled = noCol || profile.coins < packCoins(col);
    $('buyPlayBox').textContent = `📦 Box of ${coinBoxSize(play)} · ${coins(boxCoins(play))}`;
    $('buyPlayBox').disabled = profile.coins < boxCoins(play);
    $('buyCollectorBox').textContent = noCol ? '📦 Collector box · none for this set' : `📦 Collector box of ${coinBoxSize(col)} · ${coins(boxCoins(col))}`;
    $('buyCollectorBox').disabled = noCol || profile.coins < boxCoins(col);
    const t = packTier(play);
    $('packTierNote').textContent = `${t.label} pricing. Boxes are ${Math.round(COIN_BOX_DISCOUNT * 100)}% off their packs and go to your stockroom (📦 Distributor tab), or open them all right away. Not every set had collector boosters.`;
}

// Buy a box with coins: its packs go to the stockroom (shared with the shop), and you can open them all now
async function buyCoinBox(kind) {
    const meta = packMetaFor($('packSet').value, kind);
    if (!meta) return;
    const price = boxCoins(meta), n = coinBoxSize(meta);
    if (profile.coins < price) { toast('Not enough coins - win games to earn more.'); return; }
    const area = $('packArea');
    area.innerHTML = '<div class="loading">Checking the box...</div>';
    try { await packSource(meta.code, kind); } // make sure the set has this kind of pack before charging
    catch (e) { area.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    profile.coins -= price;
    addSealed(meta, n);
    saveProfile();
    renderCoins();
    updatePackButtons();
    area.innerHTML = `<div class="box-bought"><p><strong>📦 ${esc(meta.name)} ${kind === 'collector' ? 'collector ' : ''}box</strong>: ${n} packs for ${coins(price)}. They're in your stockroom (📦 Distributor tab).</p>
        <div class="row"><button class="btn gold" onclick="openWholeBox('${sealedKey(meta)}', 'packArea')">🎉 Open the whole box</button><button class="btn" onclick="showView('dist')">Keep it sealed (go to the stockroom)</button></div></div>`;
}
// Open every pack in a box (up to one box's worth from the stockroom) and show the best hits
async function openWholeBox(k, areaId = 'crackArea') {
    const s = profile.sealed[k];
    if (!s || !s.n) return;
    const n = Math.min(s.n, coinBoxSize(s));
    const area = $(areaId);
    area.innerHTML = `<div class="loading">Opening ${n} packs of ${esc(s.name)}...</div>`;
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    let packs;
    try { packs = await drawPacks(s.code, s.kind, n); }
    catch (e) { area.innerHTML = `<p class="warn">Couldn't open them: ${esc(e.message)} The packs are still sealed.</p>`; return; }
    s.n -= n;
    if (!s.n) delete profile.sealed[k];
    const cards = packs.flatMap(p => p.cards);
    cards.forEach(p => { p.copy = rollCopy(p.foil, packs[0].set.releaseDate); addCopy(p.id, p.copy); });
    profile.packs += n;
    saveProfile();
    if ($('stockroom')) renderStockroom();
    if (areaId === 'packArea') updatePackButtons();
    renderBoxResult(packs, cards, s, areaId);
}
function renderBoxResult(packs, cards, s, areaId) {
    const total = cards.reduce((a, p) => a + pullValue(p), 0);
    const byVal = cards.slice().sort((a, b) => pullValue(b) - pullValue(a));
    // The hits: everything worth $2+ (or serialized), at least the best 5, at most 24
    let hits = byVal.filter(p => pullTier(p));
    if (hits.length < 5) hits = byVal.slice(0, 5);
    hits = hits.slice(0, 24);
    const count = f => cards.filter(f).length;
    const packVals = packs.map(p => p.cards.reduce((a, c) => a + pullValue(c), 0));
    const best = packVals.indexOf(Math.max(...packVals));
    const id = `${areaId}-hits`;
    $(areaId).innerHTML = `<div class="box-result">
        <h3>🎉 ${packs.length} packs of ${esc(s.name)} opened</h3>
        <div class="pos-stats box-stats">
            <div><span class="pos-k">Cards</span><strong>${cards.length}</strong></div>
            <div><span class="pos-k">Box value</span><strong class="money">${usd(total)}</strong></div>
            <div><span class="pos-k">Mythics · rares</span><strong>${count(p => p.card.rarity === 'mythic')} · ${count(p => p.card.rarity === 'rare')}</strong></div>
            <div><span class="pos-k">Foils</span><strong>${count(p => p.foil)}</strong></div>
            <div><span class="pos-k">Hits ($2+)</span><strong>${count(p => pullTier(p))}</strong></div>
            <div><span class="pos-k">Best pack</span><strong>#${best + 1} · ${usd(packVals[best])}</strong></div>
        </div>
        <p class="note">Prices: Scryfall's TCGplayer price × condition × today's market. Every card is in your collection. Below: the ${hits.length} best hits, cheapest first, as a stack - tap to send each one flying.</p>
        <div id="${id}"></div>
        <details class="note" style="margin-top:10px;"><summary>All ${cards.length} cards, most valuable first</summary>
            <ul class="box-all">${byVal.map(p => `<li><button class="linkish" onclick="showCardSheet('${p.card.id}')">${esc(p.card.name)}</button> ${p.copy ? condBadge(p.copy) : ''} <span class="note">${p.card.rarity}${p.foil ? ' · foil' : ''}</span> <strong>${usd(pullValue(p))}</strong></li>`).join('')}</ul>
        </details>
    </div>`;
    renderPackReveal({ isHits: true, name: `The ${hits.length} best hits`, set: { code: packs[0].set.code, name: `${s.name}: best of ${packs.length} packs` }, cards: hits }, id);
}
function pickWeighted(entries) {
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    const i = entries.findIndex(([, w]) => (x -= w) < 0);
    return i < 0 ? entries.length - 1 : i;
}

// One pack's card picks (Scryfall ids + foil) from a set's MTGJSON booster data
async function packSource(code, kind) {
    const setData = await mtgjsonSet(code);
    const boosters = setData.booster || {};
    const key = kind === 'collector' ? (boosters.collector ? 'collector' : null)
        : ['play', 'draft', 'default', 'set'].find(k => boosters[k]);
    if (!key) throw new Error(kind === 'collector' ? 'This set has no collector booster data.' : 'This set has no booster data.');
    const booster = boosters[key];
    const sources = [setData, ...await Promise.all((booster.sourceSetCodes || []).filter(c => c !== setData.code).map(c => mtgjsonSet(c).catch(() => null)))];
    const byUuid = new Map();
    sources.filter(Boolean).forEach(src => [...(src.cards || []), ...(src.tokens || [])].forEach(c => byUuid.set(c.uuid, c)));
    return { setData, booster, byUuid };
}
function rollPicks(src) {
    const { booster, byUuid } = src;
    const cfg = booster.boosters[pickWeighted(booster.boosters.map(b => [b, b.weight]))];
    const picks = [];
    Object.entries(cfg.contents).forEach(([sheetName, count]) => {
        const sheet = booster.sheets[sheetName];
        if (!sheet) return;
        const pool = Object.entries(sheet.cards);
        for (let i = 0; i < count && pool.length; i++) {
            const [uuid] = pool.splice(pickWeighted(pool), 1)[0];
            const c = byUuid.get(uuid);
            const id = c && c.identifiers && c.identifiers.scryfallId;
            if (id && !(c.types || []).includes('Token') && c.layout !== 'token' && c.layout !== 'art_series') picks.push({ id, foil: !!sheet.foil });
        }
    });
    return picks;
}
const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, mythic: 3, special: 2, bonus: 3 };
function buildPack(src, picks, byId) {
    return { name: src.booster.name || `${src.setData.name} booster`, set: src.setData,
        cards: picks.map(p => ({ ...p, card: byId.get(p.id) })).filter(p => p.card)
            .sort((a, b) => (a.foil - b.foil) || ((isBasic(a.card) ? -1 : RARITY_ORDER[a.card.rarity] ?? 1) - (isBasic(b.card) ? -1 : RARITY_ORDER[b.card.rarity] ?? 1))) };
}
async function drawPack(code, kind) { return (await drawPacks(code, kind, 1))[0]; }
// Several packs at once: the cards are fetched in one go (75 per Scryfall request)
async function drawPacks(code, kind, n) {
    const src = await packSource(code, kind);
    const all = Array.from({ length: n }, () => rollPicks(src));
    const cards = await cardsByIds([...new Set(all.flat().map(p => p.id))]);
    const byId = new Map(cards.map(c => [c.id, c]));
    return all.map(picks => buildPack(src, picks, byId));
}

async function buyPack(kind) {
    const code = $('packSet').value;
    const free = kind === 'play' && profile.freePacks > 0;
    const meta = packMetaFor(code, kind);
    if (!meta) return;
    const price = free ? 0 : packCoins(meta);
    if (profile.coins < price) { toast('Not enough coins - win a game to earn more.'); return; }
    const area = $('packArea');
    area.innerHTML = '<div class="loading">Shuffling the sheets...</div>';
    $('buyPlay').disabled = $('buyCollector').disabled = true;
    try {
        if (free && packTier(meta).coins > 100) throw new Error('Free packs are for sets at standard prices - pick a newer set.');
        const pack = await drawPack(code, kind);
        if (free) profile.freePacks--; else profile.coins -= price;
        profile.packs++;
        pack.cards.forEach(p => { p.copy = rollCopy(p.foil, pack.set.releaseDate); addCopy(p.id, p.copy); });
        saveProfile();
        renderPackReveal(pack);
    } catch (e) {
        console.error(e);
        area.innerHTML = `<p class="warn">Couldn't open a pack: ${esc(e.message)}</p>`;
    }
    renderPacksView();
}


// ---------------------------------------------------------------------
// Card details popup, used everywhere outside the game
// ---------------------------------------------------------------------
function cardTextHTML(card) {
    return `<div class="otext">${esc(card.cost)}${card.cost ? '\n' : ''}${esc(card.type)}${card.text ? `\n\n${esc(card.text)}` : ''}${card.power !== undefined ? `\n\n${esc(card.power)}/${esc(card.toughness)}` : ''}</div>`;
}
function showCardSheet(id, actionsHTML = '') {
    const card = CARDS.get(id);
    if (!card) return;
    const R = rulesFor(card);
    $('sheetHost').innerHTML = `
        <div class="sheet-bg" onclick="if (event.target === this) closeSheet()">
            <div class="sheet" role="dialog" aria-label="${esc(card.name)}">
                <div>${card.img ? `<img src="${card.img}" alt="${esc(card.name)}">` : ''}</div>
                <div>
                    <h3>${esc(card.fullName)}</h3>
                    <div class="note">${esc(card.setName || '')} · ${esc(card.rarity || '')}${profile.collection[id] ? ` · you own ${profile.collection[id]}` : ''}</div>
                    ${cardTextHTML(card)}
                    <div>${supportBadge(card)} <span class="note">${esc(R.why || 'Everything on this card works in the game.')}</span></div>
                    <div id="kwHelp"></div>
                    <div class="actions">${actionsHTML}<button class="btn" onclick="closeSheet()">Close</button></div>
                </div>
            </div>
        </div>`;
    fillKeywordHelp(card);
}
function closeSheet() { $('sheetHost').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// ---------------------------------------------------------------------
// Deck rules
// ---------------------------------------------------------------------
const FORMATS = {
    modern: { name: 'Modern', size: 60, copies: 4, life: 20 },
    commander: { name: 'Commander', size: 100, copies: 1, life: 40 },
    // Kitchen-table rules for precons and the campaign: 30+ cards, 4 copies, any card
    casual: { name: 'Casual', size: 30, copies: 4, life: 20 },
    // Booster draft decks: 40+ cards from your draft pool, basic lands free
    limited: { name: 'Limited', size: 40, copies: 99, life: 20 }
};

function deckCount(deck) { return Object.values(deck.cards).reduce((a, b) => a + b, 0) + (deck.commander ? 1 : 0); }

function deckProblems(deck) {
    const F = FORMATS[deck.format];
    const out = [];
    const total = deckCount(deck);
    if (deck.format === 'modern' && total < 60) out.push(`${total}/60 cards - a Modern deck needs at least 60.`);
    if (deck.format === 'casual' && total < 30) out.push(`${total}/30 cards - a Casual deck needs at least 30.`);
    if (deck.format === 'limited' && total < 40) out.push(`${total}/40 cards - a Limited deck needs at least 40.`);
    if (deck.format === 'commander') {
        if (total !== 100) out.push(`${total}/100 cards - a Commander deck has exactly 100, commander included.`);
        const cmd = deck.commander && CARDS.get(deck.commander);
        if (!cmd) out.push('Pick a commander: a legendary creature.');
        else if (!(rulesFor(cmd).legendary && rulesFor(cmd).kind === 'creature')) out.push(`${cmd.name} isn't a legendary creature.`);
    }
    const cmd = deck.commander && CARDS.get(deck.commander);
    for (const [id, n] of Object.entries(deck.cards)) {
        const c = CARDS.get(id);
        if (!c) continue;
        if (!isBasic(c) && n > F.copies) out.push(`${c.name}: ${n} copies (${F.copies} max).`);
        if (c.legal[deck.format] && c.legal[deck.format] !== 'legal') out.push(`${c.name} isn't legal in ${F.name} (${c.legal[deck.format].replace('_', ' ')}).`);
        if (cmd && c.ci.some(col => !cmd.ci.includes(col))) out.push(`${c.name} is outside ${cmd.name}'s colors.`);
        if (!deck.starter && !isBasic(c) && n + (deck.commander === id ? 1 : 0) > (profile.collection[id] || 0)) out.push(`You own ${profile.collection[id] || 0} ${c.name} but the deck uses ${n}.`);
    }
    return out;
}
function deckUncastable(deck) {
    return Object.entries(deck.cards).filter(([id]) => CARDS.get(id) && rulesFor(CARDS.get(id)).support === 'none').reduce((a, [, n]) => a + n, 0);
}

// ---------------------------------------------------------------------
// Deck list and builder
// ---------------------------------------------------------------------
let editing = null; // the deck open in the builder (a copy until saved)

async function renderDeckPicker() {
    $('builder').classList.add('hidden');
    const el = $('deckPicker');
    el.classList.remove('hidden');
    const need = new Set();
    profile.decks.forEach(d => { Object.keys(d.cards).forEach(id => need.add(id)); if (d.commander) need.add(d.commander); });
    Object.keys(profile.collection).forEach(id => need.add(id));
    if ([...need].some(id => !CARDS.has(id))) {
        el.innerHTML = '<div class="loading">Loading your cards...</div>';
        await cardsByIds([...need]);
    }
    el.innerHTML = `
        <h2>Your decks</h2>
        ${profile.decks.length ? profile.decks.map((d, i) => {
            const probs = deckProblems(d);
            return `<div class="row" style="padding:6px 0; border-bottom:1px solid var(--border-subtle);">
                <strong style="flex:1; min-width:180px;">${esc(d.name)}</strong>
                <span class="note">${FORMATS[d.format].name} · ${deckCount(d)} cards${d.starter ? ' · starter' : ''}</span>
                ${probs.length ? `<span class="warn" title="${esc(probs.join('\n'))}">⚠ ${probs.length} to fix</span>` : '<span class="ok">✓ Ready</span>'}
                <button class="btn small" onclick="playtestSaved(${i})">🧪 Playtest</button>
                <button class="btn small" onclick="editDeck(${i})">Edit</button>
                <button class="btn small danger" onclick="deleteDeck(${i})">Delete</button>
            </div>`;
        }).join('') : '<p class="note">No decks yet. Start one below, or grab a starter deck to play right away.</p>'}
        <div class="row" style="margin-top:12px;">
            <button class="btn primary" onclick="newDeck('modern')">➕ New Modern deck</button>
            <button class="btn primary" onclick="newDeck('commander')">➕ New Commander deck</button>
            <button class="btn primary" onclick="newDeck('casual')">➕ New Casual deck</button>
            <button class="btn gold" onclick="starterPicker()">🎁 Get a starter deck</button>
            <button class="btn" onclick="importDialog()">📥 Import a decklist (Moxfield)</button>
        </div>
        <p class="note" style="margin-top:8px;">Starter decks are ready to play and don't use your collection. Decks you build use cards you've pulled from packs (basic lands are free).</p>
        <h2 style="margin-top:16px;">Your collection</h2>
        <p class="note">${Object.keys(profile.collection).length ? `${Object.values(profile.collection).reduce((a, b) => a + b, 0)} cards. Open a deck to browse and add them.` : 'Empty so far - open some packs!'}</p>`;
}

function newDeck(format) {
    editing = { id: `d${Date.now()}`, name: `My ${FORMATS[format].name} deck`, format, cards: {}, commander: null, starter: false, isNew: true };
    openBuilder();
}
function editDeck(i) {
    editing = JSON.parse(JSON.stringify(profile.decks[i]));
    editing.index = i;
    openBuilder();
}
function deleteDeck(i) {
    const d = profile.decks[i];
    if (!d) return;
    if ($('deckPicker').dataset.confirm !== String(i)) {
        $('deckPicker').dataset.confirm = String(i);
        toast(`Click Delete again to delete "${d.name}".`);
        return;
    }
    delete $('deckPicker').dataset.confirm;
    profile.decks.splice(i, 1);
    saveProfile();
    renderDeckPicker();
}

// ---- The builder, laid out like Moxfield (2026-10-06, owner's request) ----
// A head with Playtest / Bulk edit / Save and a "Find and add cards" box, a
// sticky preview of the card under the pointer, the deck in type groups
// (or by mana value, color or automation) in columns or as picture stacks,
// then the mana curve, color stats and a sample hand, and a summary bar.
const BX_GROUPS = { type: 'Type', mv: 'Mana value', color: 'Color', support: 'Automation' };
const BX_SORTS = { name: 'Name', mv: 'Mana value', price: 'Price' };
let BX = Object.assign({ view: 'text', group: 'type', sort: 'name' }, store.get('builderPrefs', {}));
let BXS = { hover: null, curveSel: null, hand: [], lib: [] };
function bxPref(k, v) { BX[k] = v; store.set('builderPrefs', { view: BX.view, group: BX.group, sort: BX.sort }); renderDeckPanel(); }

async function openBuilder() {
    $('deckPicker').classList.add('hidden');
    $('builder').classList.remove('hidden');
    $('collectionGrid').innerHTML = '<div class="loading">Loading cards...</div>';
    $('fSupport').value = 'full'; // only Automated cards by default (owner, 2026-10-06)
    BXS = { hover: null, curveSel: null, hand: [], lib: [] };
    renderBuilderHead();
    await loadBasics().catch(() => {});
    await cardsByIds([...Object.keys(profile.collection), ...Object.keys(editing.cards), editing.commander].filter(Boolean));
    renderCollection();
    renderDeckPanel();
    if (bxPool().length >= 7) bxDeal();
}

function cardColorsKey(c) { return c.colors.length > 1 ? 'M' : (c.colors[0] || 'C'); }

function usableIn(deck, c) {
    if (c.legal[deck.format] && c.legal[deck.format] !== 'legal') return false;
    const cmd = deck.commander && CARDS.get(deck.commander);
    if (cmd && c.ci.some(col => !cmd.ci.includes(col))) return false;
    return true;
}
// The cards you can add: your collection (a starter deck: its own cards), plus the free basics
function builderPool() {
    const ids = editing.starter ? Object.keys(editing.cards) : Object.keys(profile.collection);
    const out = new Map();
    [...ids, ...Object.values(BASIC_IDS)].forEach(id => { const c = CARDS.get(id); if (c) out.set(id, c); });
    return [...out.values()];
}
function autoOk(c) { const sup = $('fSupport').value; return !sup || isBasic(c) || rulesFor(c).support === sup; }
function setAutoFilter(v) { $('fSupport').value = v; renderCollection(); mxFindRender(true); }
function autoNoteHTML() {
    return $('fSupport').value === 'full'
        ? 'Showing only cards the game fully automates. <button type="button" class="linkish" onclick="setAutoFilter(\'\')">Show all cards</button>'
        : `Showing ${$('fSupport').value === '' ? 'all cards' : $('fSupport').selectedOptions[0].textContent.toLowerCase() + ' cards'}. <button type="button" class="linkish" onclick="setAutoFilter('full')">Automated only</button>`;
}
function inDeckCount(id) { return (editing.cards[id] || 0) + (editing.commander === id ? 1 : 0); }

function renderCollection() {
    if (!editing) return;
    const q = $('fName').value.trim().toLowerCase();
    const col = $('fColor').value, type = $('fType').value, legal = $('fLegal').checked;
    const all = editing.starter ? Object.keys(editing.cards).map(id => CARDS.get(id)).filter(Boolean) : Object.keys(profile.collection).map(id => CARDS.get(id)).filter(Boolean);
    const base = all
        .filter(c => !q || c.fullName.toLowerCase().includes(q))
        .filter(c => !col || cardColorsKey(c) === col)
        .filter(c => !type || c.type.includes(type))
        .filter(c => !legal || usableIn(editing, c));
    const list = base.filter(autoOk).sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));
    const hidden = base.length - list.length;
    if ($('mxAutoNote')) $('mxAutoNote').innerHTML = autoNoteHTML();
    $('collectionGrid').innerHTML = (list.length ? list.map(c => {
        const owned = editing.starter ? '' : profile.collection[c.id] || 0;
        const used = inDeckCount(c.id);
        return `<button type="button" class="ctile${owned !== '' && used >= owned ? ' dim' : ''}" onclick="collectionClick('${c.id}')" onmouseenter="mxHover('${c.id}')" title="${esc(c.name)}">
            ${c.imgS || c.img ? `<img src="${c.img || c.imgS}" alt="${esc(c.name)}" loading="lazy">` : `<div class="noimg">${esc(c.name)}</div>`}
            ${owned !== '' ? `<span class="cnt">${used}/${owned}</span>` : ''}
            <span class="meta">${esc(c.name)}<br>${supportBadge(c)}</span>
        </button>`;
    }).join('') : `<p class="note">${all.length ? 'No cards match these filters.' : 'No cards yet - open packs to fill your collection.'}</p>`)
        + (hidden ? `<p class="note" style="grid-column:1/-1;">${hidden} more card${hidden === 1 ? '' : 's'} the game doesn't fully automate yet. <button type="button" class="linkish" onclick="setAutoFilter('')">Show them</button></p>` : '');
}

function collectionClick(id) {
    const c = CARDS.get(id);
    const R = rulesFor(c);
    const canCmd = editing.format === 'commander' && R.legendary && R.kind === 'creature';
    showCardSheet(id, `
        <button class="btn primary" onclick="addToDeck('${id}'); closeSheet();">➕ Add to deck</button>
        ${editing.cards[id] ? `<button class="btn" onclick="removeFromDeck('${id}'); closeSheet();">➖ Remove one</button>` : ''}
        ${canCmd ? `<button class="btn gold" onclick="setCommander('${id}'); closeSheet();">👑 Make commander</button>` : ''}`);
}

// Adds one copy; false (with a toast) when the format or your collection says no
function addToDeck(id, quiet) {
    const c = CARDS.get(id);
    const F = FORMATS[editing.format];
    const n = editing.cards[id] || 0;
    if (!isBasic(c)) {
        if (n >= F.copies) { if (!quiet) toast(`${F.name} allows ${F.copies === 1 ? 'one copy' : `${F.copies} copies`} of ${c.name}.`); return false; }
        const owned = profile.collection[id] || 0;
        if (!editing.starter && n + (editing.commander === id ? 1 : 0) >= owned) { if (!quiet) toast(`You only own ${owned} ${c.name}.`); return false; }
        if (editing.format === 'commander' && editing.commander === id) { if (!quiet) toast(`${c.name} is already your commander.`); return false; }
    }
    if (editing.commander && c.ci.some(col => !CARDS.get(editing.commander).ci.includes(col))) { if (!quiet) toast(`${c.name} is outside your commander's colors.`); return false; }
    editing.cards[id] = n + 1;
    if (!quiet) builderChanged();
    return true;
}
function removeFromDeck(id, all) {
    if (!editing.cards[id]) return;
    editing.cards[id] = all ? 0 : editing.cards[id] - 1;
    if (!editing.cards[id]) delete editing.cards[id];
    builderChanged();
}
function setCommander(id) {
    if (editing.cards[id]) { editing.cards[id]--; if (!editing.cards[id]) delete editing.cards[id]; }
    if (editing.commander && editing.commander !== id) editing.cards[editing.commander] = (editing.cards[editing.commander] || 0) + 1;
    editing.commander = id;
    builderChanged();
}
function unsetCommander() {
    const id = editing.commander;
    if (!id) return;
    editing.commander = null;
    editing.cards[id] = (editing.cards[id] || 0) + 1;
    builderChanged();
}
async function addBasic(color, n = 1) {
    if (!editing) return;
    await loadBasics();
    const id = BASIC_IDS[color];
    if (!id) { toast('Couldn\'t load basic lands.'); return; }
    if (editing.commander && !CARDS.get(editing.commander).ci.includes(color)) { toast(`${BASIC_FOR[color]} is outside your commander's colors.`); return; }
    editing.cards[id] = (editing.cards[id] || 0) + n;
    builderChanged();
}
function builderChanged() { renderDeckPanel(); renderCollection(); mxFindRender(true); }

// ---- Head: name, actions, find and add ----
function renderBuilderHead() {
    const d = editing;
    $('mxHead').innerHTML = `
        <div class="mx-title">
            <input type="text" id="deckName" value="${esc(d.name)}" aria-label="Deck name" oninput="editing.name = this.value">
            <span class="badge">${FORMATS[d.format].name}</span>${d.starter ? '<span class="note">Starter deck</span>' : ''}
        </div>
        <div class="mx-actions">
            <button class="btn gold" onclick="playtestDeck()">🧪 Playtest</button>
            <button class="btn" onclick="bulkEdit()">✏️ Bulk edit</button>
            <button class="btn primary" onclick="saveDeck()">💾 Save</button>
            <button class="btn" onclick="closeBuilder()">← Back</button>
        </div>
        <div class="mx-find">
            <input type="search" id="mxFind" placeholder="🔍 Find and add cards" autocomplete="off" aria-label="Find and add cards"
                oninput="mxFindRender()" onfocus="mxFindRender()" onkeydown="mxFindKey(event)" onblur="setTimeout(() => $('mxFindList') && $('mxFindList').classList.add('hidden'), 150)">
            <div class="mx-find-list hidden" id="mxFindList" role="listbox" aria-label="Matching cards"></div>
        </div>
        <div class="note" id="mxAutoNote">${autoNoteHTML()}</div>`;
}
let mxFindHits = [];
function mxFindRender(keepClosed) {
    const inp = $('mxFind'), el = $('mxFindList');
    if (!inp || !el || !editing) return;
    const q = inp.value.trim().toLowerCase();
    if (!q) { el.classList.add('hidden'); el.innerHTML = ''; mxFindHits = []; return; }
    const base = builderPool().filter(c => c.fullName.toLowerCase().includes(q) && usableIn(editing, c));
    const list = base.filter(autoOk).sort((a, b) => b.fullName.toLowerCase().startsWith(q) - a.fullName.toLowerCase().startsWith(q) || a.name.localeCompare(b.name)).slice(0, 12);
    const hidden = base.length - base.filter(autoOk).length;
    mxFindHits = list.map(c => c.id);
    el.innerHTML = (list.length ? list.map((c, i) => {
        const owned = editing.starter || isBasic(c) ? '' : `${inDeckCount(c.id)}/${profile.collection[c.id] || 0}`;
        return `<button type="button" class="mx-find-row${i === 0 ? ' first' : ''}" role="option" onmousedown="event.preventDefault()" onclick="mxFindAdd('${c.id}')" onmouseenter="mxHover('${c.id}')">
            <span class="nm">${esc(c.fullName)}</span>${costHTML(c.cost)}${rulesFor(c).support !== 'full' && !isBasic(c) ? supportBadge(c) : ''}<span class="note">${owned}</span><span class="mx-add">＋</span></button>`;
    }).join('') : `<div class="note mx-find-none">No match in ${editing.starter ? 'this deck' : 'your collection'}.</div>`)
        + (hidden ? `<div class="note mx-find-none">${hidden} more not fully automated - <button type="button" class="linkish" onmousedown="event.preventDefault()" onclick="setAutoFilter('')">show all</button></div>` : '');
    if (!keepClosed || document.activeElement === inp) el.classList.remove('hidden');
}
function mxFindKey(e) {
    if (e.key === 'Enter' && mxFindHits[0]) { e.preventDefault(); mxFindAdd(mxFindHits[0]); }
    if (e.key === 'Escape') { e.target.value = ''; mxFindRender(); }
}
function mxFindAdd(id) { if (addToDeck(id)) toast(`Added ${CARDS.get(id).name}.`); }

// ---- Mana symbols and the preview ----
function costHTML(cost) {
    if (!cost) return '';
    return `<span class="mx-cost" aria-label="${esc(cost)}" title="${esc(cost)}">${(cost.match(/\{[^}]+\}/g) || []).map(t => {
        const s = t.slice(1, -1), col = (s.match(/[WUBRGC]/) || [''])[0];
        return `<i class="ms${col ? ` ${col}` : ''}">${/^[WUBRGC]$/.test(s) ? '' : esc(s.replace('/', '').replace(/[WUBRG]/g, ''))}</i>`;
    }).join('')}</span>`;
}
function mxHover(id) { if (BXS.hover === id) return; BXS.hover = id; renderPreview(); }
function renderPreview() {
    const el = $('mxPreview');
    if (!el || !editing) return;
    const first = Object.keys(editing.cards).map(id => CARDS.get(id)).find(c => c && !isBasic(c));
    const c = CARDS.get(BXS.hover) || CARDS.get(editing.commander) || first;
    if (!c) { el.innerHTML = '<div class="note">Point at a card to see it here.</div>'; return; }
    const R = rulesFor(c);
    el.innerHTML = `${c.img ? `<img src="${c.img}" alt="${esc(c.fullName)}">` : `<div class="noimg">${esc(c.fullName)}</div>`}
        <div class="mx-pv-meta"><strong>${esc(c.fullName)}</strong>
            <div class="note">${esc(c.setName || '')}${c.rarity ? ` · ${esc(c.rarity)}` : ''}</div>
            <div class="mx-pv-price">${c.usd ? usd(+c.usd) : '<span class="note">No price</span>'} ${isBasic(c) ? '' : supportBadge(c)}</div>
            ${R.why && !isBasic(c) ? `<div class="note">${esc(R.why)}</div>` : ''}</div>`;
}

// ---- The deck ----
const BX_COLOR_NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', M: 'Multicolor', C: 'Colorless' };
function bxGroupOf(c) {
    const R = rulesFor(c);
    if (BX.group === 'support') return isBasic(c) ? 'full' : R.support;
    if (R.kind === 'land' && BX.group !== 'type') return 'land';
    if (BX.group === 'mv') return `mv${Math.min(7, Math.round(c.cmc))}`;
    if (BX.group === 'color') return cardColorsKey(c);
    return TYPE_GROUPS.some(([k]) => k === R.kind) ? R.kind : 'other';
}
function bxGroups() {
    if (BX.group === 'mv') return [...[0, 1, 2, 3, 4, 5, 6].map(i => [`mv${i}`, `${i} mana`]), ['mv7', '7+ mana'], ['land', 'Lands']];
    if (BX.group === 'color') return [...['W', 'U', 'B', 'R', 'G', 'M', 'C'].map(k => [k, BX_COLOR_NAMES[k]]), ['land', 'Lands']];
    if (BX.group === 'support') return [['full', 'Automated'], ['partial', 'Partly automated'], ['none', 'Not yet castable']];
    return TYPE_GROUPS;
}
function bxSort(a, b) {
    if (BX.sort === 'mv') return a.c.cmc - b.c.cmc || a.c.name.localeCompare(b.c.name);
    if (BX.sort === 'price') return (+b.c.usd || 0) - (+a.c.usd || 0) || a.c.name.localeCompare(b.c.name);
    return a.c.name.localeCompare(b.c.name);
}
function bxRowHTML(c, n, isCmd) {
    const sup = isBasic(c) ? 'full' : rulesFor(c).support;
    if (BX.view === 'visual') return `<button type="button" class="mx-vc" onmouseenter="mxHover('${c.id}')" onclick="mxRowMenu('${c.id}')" aria-label="${n} ${esc(c.fullName)}">
        ${c.img || c.imgS ? `<img src="${c.img || c.imgS}" alt="" loading="lazy">` : `<span class="noimg">${esc(c.fullName)}</span>`}${n > 1 ? `<span class="mx-vq">×${n}</span>` : ''}${sup !== 'full' ? `<span class="badge sup-${sup} mx-vs">${sup === 'none' ? '!' : '~'}</span>` : ''}</button>`;
    return `<div class="mx-row" onmouseenter="mxHover('${c.id}')">
        <span class="n">${n}</span>
        <button type="button" class="nm" onclick="mxRowMenu('${c.id}')">${esc(c.fullName)}</button>
        ${sup !== 'full' ? `<span class="badge sup-${sup}" title="${sup === 'none' ? 'Not yet castable' : 'Partly automated'}">${sup === 'none' ? '!' : '~'}</span>` : ''}
        ${costHTML(c.cost)}
        ${isCmd ? '' : `<span class="mx-q"><button type="button" onclick="removeFromDeck('${c.id}')" aria-label="Remove one ${esc(c.name)}">−</button><button type="button" onclick="addToDeck('${c.id}')" aria-label="Add one ${esc(c.name)}">+</button></span>`}
        <button type="button" class="mx-menu" onclick="mxRowMenu('${c.id}')" aria-label="More for ${esc(c.name)}">▾</button>
    </div>`;
}
function mxRowMenu(id) {
    const c = CARDS.get(id);
    if (!c) return;
    const R = rulesFor(c);
    const isCmd = editing.commander === id;
    const canCmd = editing.format === 'commander' && R.legendary && R.kind === 'creature' && !isCmd;
    showCardSheet(id, isCmd
        ? `<button class="btn" onclick="unsetCommander(); closeSheet();">↩ Move to the main deck</button>`
        : `<button class="btn primary" onclick="addToDeck('${id}'); closeSheet();">＋ Add one</button>
           ${editing.cards[id] ? `<button class="btn" onclick="removeFromDeck('${id}'); closeSheet();">− Remove one</button>` : ''}
           ${editing.cards[id] > 1 ? `<button class="btn danger" onclick="removeFromDeck('${id}', true); closeSheet();">✖ Remove all ${editing.cards[id]}</button>` : ''}
           ${canCmd ? `<button class="btn gold" onclick="setCommander('${id}'); closeSheet();">👑 Make commander</button>` : ''}`);
}
// Tokens the deck's cards make, read from their text
function deckTokens(entries) {
    const map = new Map();
    entries.forEach(({ c }) => {
        const t = [c.text, c.back && c.back.text].filter(Boolean).join(' ');
        const found = new Set();
        for (const m of t.matchAll(/\b(\d+\/\d+|X\/X) ((?:(?:white|blue|black|red|green|colorless|and) )*)((?:[A-Z][a-z]+ )*[A-Z][a-z]+) (?:artifact )?(?:enchantment )?creature tokens?/g)) found.add(`${m[1]} ${m[2]}${m[3]}`.replace(/\s+/g, ' '));
        for (const m of t.matchAll(/\b(Treasure|Food|Clue|Blood|Map|Powerstone|Gold|Junk|Incubator|Shard|Lander|Mutagen) tokens?\b/g)) found.add(m[1]);
        found.forEach(k => { if (!map.has(k)) map.set(k, []); map.get(k).push(c.name); });
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderDeckPanel() {
    const d = editing;
    if (!d) return;
    const entries = Object.entries(d.cards).map(([id, n]) => ({ c: CARDS.get(id), n })).filter(e => e.c);
    const probs = deckProblems(d);
    const cmd = d.commander && CARDS.get(d.commander);
    const groups = bxGroups().map(([k, label]) => {
        const rows = entries.filter(e => bxGroupOf(e.c) === k).sort(bxSort);
        if (!rows.length) return '';
        const n = rows.reduce((a, r) => a + r.n, 0);
        const value = rows.reduce((a, r) => a + (+r.c.usd || 0) * r.n, 0);
        return `<section class="mx-group"><h3>${label} <span class="mx-gn">(${n})</span><span class="mx-gv">${value ? usd(value) : ''}</span></h3><div class="${BX.view === 'visual' ? 'mx-stack' : 'mx-rows'}">${rows.map(({ c, n }) => bxRowHTML(c, n)).join('')}</div></section>`;
    }).join('');
    const tokens = deckTokens([...entries, ...(cmd ? [{ c: cmd, n: 1 }] : [])]);
    $('deckPanel').innerHTML = `
        <div class="mx-tools">
            <div class="seg" role="group" aria-label="View">
                <button type="button" aria-pressed="${BX.view === 'text'}" onclick="bxPref('view', 'text')">☰ Text</button>
                <button type="button" aria-pressed="${BX.view === 'visual'}" onclick="bxPref('view', 'visual')">🂠 Visual</button>
            </div>
            <label class="note">Group by <select onchange="bxPref('group', this.value)">${Object.entries(BX_GROUPS).map(([k, v]) => `<option value="${k}"${BX.group === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="note">Sort by <select onchange="bxPref('sort', this.value)">${Object.entries(BX_SORTS).map(([k, v]) => `<option value="${k}"${BX.sort === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        ${probs.length ? `<details class="mx-probs"><summary class="warn">⚠ ${probs.length} thing${probs.length === 1 ? '' : 's'} to fix before this deck can play</summary><ul>${probs.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}
        <div class="mx-cols${BX.view === 'visual' ? ' visual' : ''}">
            ${d.format === 'commander' ? `<section class="mx-group mx-cmd"><h3>Commander <span class="mx-gn">(${cmd ? 1 : 0})</span></h3>${cmd ? `<div class="${BX.view === 'visual' ? 'mx-stack' : 'mx-rows'}">${bxRowHTML(cmd, 1, true)}</div>` : '<p class="note">None yet. Open a legendary creature and choose 👑 Make commander.</p>'}</section>` : ''}
            ${groups || (d.format === 'commander' ? '' : '<p class="note">No cards yet. Use "Find and add cards" above, or browse your collection below.</p>')}
            ${tokens.length ? `<section class="mx-group"><h3>Tokens <span class="mx-gn">(${tokens.length})</span></h3><div class="mx-rows">${tokens.map(([t, from]) => `<div class="mx-row mx-token" title="Made by ${esc(from.join(', '))}"><span class="n"></span><span class="nm">${esc(t)}</span><span class="note">${esc(from.length === 1 ? from[0] : `${from.length} cards`)}</span></div>`).join('')}</div></section>` : ''}
        </div>`;
    renderPreview();
    renderBuilderStats(entries, cmd);
    renderBuilderBar(entries, cmd, probs);
}

// ---- Stats: mana curve, colors, sample hand ----
function renderBuilderStats(entries, cmd) {
    const all = [...entries, ...(cmd ? [{ c: cmd, n: 1 }] : [])];
    $('mxStats').innerHTML = `
        <div class="panel mx-stat"><h3>Mana curve</h3>${mxCurveHTML(all)}</div>
        <div class="panel mx-stat"><h3>Colors</h3>${mxColorsHTML(all)}</div>
        <div class="panel mx-stat"><h3>Sample hand</h3><div id="mxHand">${mxHandHTML()}</div></div>`;
}
function mxCurveHTML(all) {
    const perm = Array(8).fill(0), spl = Array(8).fill(0);
    let n = 0, mv = 0;
    all.forEach(({ c, n: q }) => {
        const k = rulesFor(c).kind;
        if (k === 'land') return;
        const i = Math.min(7, Math.round(c.cmc));
        (['instant', 'sorcery'].includes(k) ? spl : perm)[i] += q;
        n += q; mv += c.cmc * q;
    });
    const W = 300, H = 150, padB = 18, padT = 16, slot = W / 8, bw = Math.min(26, slot - 8);
    const max = Math.max(1, ...perm.map((v, i) => v + spl[i]));
    const sy = v => (v / max) * (H - padB - padT);
    const seg = (x, yBase, h, round, cls) => {
        if (h <= 0) return '';
        const top = yBase - h, r = round ? Math.min(4, h / 2) : 0;
        return `<path class="${cls}" d="M${x},${yBase} V${top + r} ${r ? `Q${x},${top} ${x + r},${top}` : ''} H${x + bw - r} ${r ? `Q${x + bw},${top} ${x + bw},${top + r}` : ''} V${yBase} Z"></path>`;
    };
    const cols = perm.map((p, i) => {
        const s = spl[i], x = i * slot + (slot - bw) / 2, base = H - padB;
        const hp = sy(p), hs = sy(s), gap = p && s ? 2 : 0;
        const label = i === 7 ? '7+' : String(i);
        const sel = BXS.curveSel === i;
        return `<g class="cv-col${sel ? ' sel' : ''}" onclick="bxCurvePick(${i})" role="button" tabindex="0" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); bxCurvePick(${i}); }" aria-label="Mana value ${label}: ${p} permanent${p === 1 ? '' : 's'}, ${s} spell${s === 1 ? '' : 's'}">
            <title>Mana value ${label}: ${p} permanent${p === 1 ? '' : 's'}, ${s} instant${s === 1 ? '' : 's'}/sorcer${s === 1 ? 'y' : 'ies'}</title>
            <rect x="${i * slot}" y="0" width="${slot}" height="${H}" class="cv-hit"></rect>
            ${seg(x, base, hp, !s, 'cv-bar')}${seg(x, base - hp - gap, hs - (gap && hs > gap ? 0 : 0), true, 'cv-bar2')}
            ${p + s ? `<text x="${x + bw / 2}" y="${base - hp - hs - gap - 4}" class="cv-val">${p + s}</text>` : ''}
            <text x="${x + bw / 2}" y="${H - 4}" class="cv-axis">${label}</text></g>`;
    }).join('');
    const pick = BXS.curveSel;
    const picked = pick === null ? [] : all.filter(({ c }) => rulesFor(c).kind !== 'land' && Math.min(7, Math.round(c.cmc)) === pick).sort((a, b) => a.c.name.localeCompare(b.c.name));
    return `<div class="mx-curve">
        <svg viewBox="0 0 ${W} ${H}" class="curve-svg" role="img" aria-label="Mana curve">
            <line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" class="cv-base"></line>${cols}</svg>
        <div class="mx-legend note"><span><i class="lg cv1"></i>Permanents</span><span><i class="lg cv2"></i>Instants &amp; sorceries</span></div>
        <div class="note">Average mana value <strong>${n ? (mv / n).toFixed(2) : '0'}</strong> (nonland cards). ${pick === null ? 'Tap a bar to list its cards.' : ''}</div>
        ${pick !== null ? `<div class="mx-curve-pick"><div class="lane-label">Mana value ${pick === 7 ? '7+' : pick} (${picked.reduce((a, e) => a + e.n, 0)}) <button type="button" class="linkish" onclick="bxCurvePick(null)">close</button></div>
            ${picked.length ? picked.map(({ c, n }) => `<div class="mx-row" onmouseenter="mxHover('${c.id}')"><span class="n">${n}</span><button type="button" class="nm" onclick="mxRowMenu('${c.id}')">${esc(c.fullName)}</button>${costHTML(c.cost)}</div>`).join('') : '<p class="note">No cards.</p>'}</div>` : ''}
        <details class="note"><summary>Curve as a table</summary><table class="pos-table"><tr><th></th>${perm.map((_, i) => `<th>${i === 7 ? '7+' : i}</th>`).join('')}</tr><tr><th>Permanents</th>${perm.map(v => `<td>${v}</td>`).join('')}</tr><tr><th>Spells</th>${spl.map(v => `<td>${v}</td>`).join('')}</tr></table></details>
    </div>`;
}
function bxCurvePick(i) { BXS.curveSel = BXS.curveSel === i ? null : i; renderDeckPanel(); }

// Cost symbols per color (nonland cards) against the colors the lands and mana sources make
function deckColorStats(all) {
    const sym = { W: 0, U: 0, B: 0, R: 0, G: 0 }, prod = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    all.forEach(({ c, n }) => {
        const R = rulesFor(c);
        if (R.kind !== 'land') (c.cost.match(/\{[^}]+\}/g) || []).forEach(t => COLORS.forEach(col => { if (t.includes(col)) sym[col] += n; }));
        if (R.mana) COLORS.forEach(col => { if (R.mana.colors.includes(col)) prod[col] += n; });
    });
    return { sym, prod };
}
function mxColorsHTML(all) {
    const { sym, prod } = deckColorStats(all);
    const cmd = editing.commander && CARDS.get(editing.commander);
    // The deck's colors: the commander's, else the colors in its costs (else what its lands make)
    const cols = cmd ? COLORS.filter(c => cmd.ci.includes(c)) : COLORS.some(c => sym[c]) ? COLORS.filter(c => sym[c]) : COLORS.filter(c => prod[c]);
    const ts = cols.reduce((a, c) => a + sym[c], 0), tp = cols.reduce((a, c) => a + prod[c], 0);
    const pct = (v, t) => t ? Math.round(100 * v / t) : 0;
    const target = editing.format === 'casual' ? 40 : FORMATS[editing.format].size;
    const fill = Math.max(0, target - deckCount(editing));
    const allowed = cmd ? COLORS.filter(c => cmd.ci.includes(c)) : COLORS;
    return `${cols.length ? cols.map(c => {
        const ps = pct(sym[c], ts), pp = pct(prod[c], tp), short = ts && pp + 10 < ps;
        return `<div class="mx-color">
            <div class="mx-cl"><span class="pip ${c}"></span> ${BX_COLOR_NAMES[c]}${short ? ' <span class="warn" title="Fewer sources than this color\'s share of your costs">⚠ low on sources</span>' : ''}</div>
            <div class="mx-cbar" title="${sym[c]} ${BX_COLOR_NAMES[c].toLowerCase()} symbol${sym[c] === 1 ? '' : 's'} in mana costs"><span class="lbl">Symbols</span><span class="track"><i class="m-${c}" style="width:${ps}%"></i></span><span class="v">${ps}%</span></div>
            <div class="mx-cbar" title="${prod[c]} land${prod[c] === 1 ? '' : 's'} and mana source${prod[c] === 1 ? '' : 's'} that make ${BX_COLOR_NAMES[c].toLowerCase()}"><span class="lbl">Mana</span><span class="track"><i class="m-${c}" style="width:${pp}%"></i></span><span class="v">${pp}%</span></div>
        </div>`;
    }).join('') : '<p class="note">Add some colored cards to see how your mana lines up.</p>'}
        <div class="lane-label" style="margin-top:10px;">Quick add basics</div>
        <div class="row">${allowed.map(c => `<button type="button" class="btn small" onclick="addBasic('${c}')"><span class="pip ${c}"></span> ${BASIC_FOR[c]}</button>`).join('')}</div>
        <div class="row" style="margin-top:6px;"><button type="button" class="btn small" onclick="fillBasics()"${fill && ts ? '' : ' disabled'}>Fill to ${target} with basics${fill ? ` (+${fill})` : ''}</button><span class="note">split by your cost symbols</span></div>`;
}
async function fillBasics() {
    const target = editing.format === 'casual' ? 40 : FORMATS[editing.format].size;
    const need = target - deckCount(editing);
    if (need <= 0) return;
    await loadBasics();
    const all = Object.entries(editing.cards).map(([id, n]) => ({ c: CARDS.get(id), n })).filter(e => e.c);
    if (editing.commander) all.push({ c: CARDS.get(editing.commander), n: 1 });
    const { sym } = deckColorStats(all);
    const cmd = editing.commander && CARDS.get(editing.commander);
    const cols = COLORS.filter(c => sym[c] && (!cmd || cmd.ci.includes(c)));
    if (!cols.length) { toast('Add colored cards first, so the split has something to follow.'); return; }
    const split = landSplit(cols.map(c => ({ card: { cost: `{${c}}`.repeat(sym[c]) }, n: 1 })), cols, need);
    Object.entries(split).forEach(([c, k]) => { if (k > 0 && BASIC_IDS[c]) editing.cards[BASIC_IDS[c]] = (editing.cards[BASIC_IDS[c]] || 0) + k; });
    toast(`Added ${need} basic land${need === 1 ? '' : 's'}: ${Object.entries(split).filter(([, k]) => k > 0).map(([c, k]) => `${k} ${BASIC_FOR[c]}`).join(', ')}.`);
    builderChanged();
}

// Sample hand: 7 from the shuffled deck, Draw, Deal another hand
function bxPool() {
    const pool = [];
    Object.entries(editing.cards).forEach(([id, n]) => { const c = CARDS.get(id); if (c) for (let i = 0; i < n; i++) pool.push(c); });
    return pool;
}
function bxDeal() {
    const lib = shuffle(bxPool());
    BXS.hand = lib.splice(0, 7);
    BXS.lib = lib;
    if ($('mxHand')) $('mxHand').innerHTML = mxHandHTML();
}
function bxDraw() {
    if (!BXS.lib.length) { toast('No cards left to draw.'); return; }
    BXS.hand.push(BXS.lib.shift());
    $('mxHand').innerHTML = mxHandHTML();
}
function hyperC(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
function mxHandHTML() {
    const pool = bxPool();
    const N = pool.length, L = pool.filter(c => rulesFor(c).kind === 'land').length;
    if (N < 7) return '<p class="note">Add at least 7 cards to deal a sample hand.</p>';
    const hand = BXS.hand;
    const lands = hand.filter(c => rulesFor(c).kind === 'land').length;
    const p24 = [2, 3, 4].reduce((a, k) => a + hyperC(L, k) * hyperC(N - L, 7 - k), 0) / hyperC(N, 7);
    return `<div class="mx-hand">${hand.map((c, i) => `<button type="button" class="th-card" style="--i:${i}" onclick="showCardSheet('${c.id}')" onmouseenter="mxHover('${c.id}')" title="${esc(c.name)}">${c.imgS || c.img ? `<img src="${c.img || c.imgS}" alt="${esc(c.name)}">` : `<span class="noimg">${esc(c.name)}</span>`}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px;">
            <button type="button" class="btn small gold" onclick="playtestDeck()">🧪 Playtest</button>
            <button type="button" class="btn small" onclick="bxDraw()"${BXS.lib.length ? '' : ' disabled'}>Draw</button>
            <button type="button" class="btn small" onclick="bxDeal()">Deal another hand</button>
        </div>
        <div class="note" style="margin-top:6px;">${hand.length ? `This hand: ${lands} land${lands === 1 ? '' : 's'} of ${hand.length}. ` : ''}Average lands in an opening hand: <strong>${(7 * L / N).toFixed(1)}</strong> (${L} lands in ${N} cards). ${Math.round(p24 * 100)}% of opening hands have 2-4 lands.</div>`;
}

// ---- The bar along the bottom ----
function renderBuilderBar(entries, cmd, probs) {
    const d = editing;
    const main = entries.reduce((a, e) => a + e.n, 0);
    const value = [...entries, ...(cmd ? [{ c: cmd, n: 1 }] : [])].reduce((a, e) => a + (+e.c.usd || 0) * e.n, 0);
    const kinds = {};
    entries.forEach(({ c, n }) => { const k = rulesFor(c).kind; kinds[k] = (kinds[k] || 0) + n; });
    const F = FORMATS[d.format];
    $('mxBar').innerHTML = `
        <span><strong>${deckCount(d)}</strong>${d.format === 'commander' ? '/100' : ''} ${d.format === 'commander' ? 'cards' : 'main deck'}</span>
        ${d.format === 'commander' ? `<span class="${cmd ? 'ok' : 'warn'}">Commander ${cmd ? '✓' : '✗'}</span>` : `<span class="note">${F.name} · ${F.size}+</span>`}
        <span class="mx-price" title="TCGplayer market prices from Scryfall">${usd(value)}</span>
        <span class="mx-kinds note">${TYPE_GROUPS.filter(([k]) => kinds[k]).map(([k, l]) => `${l} ${kinds[k]}`).join(' · ')}</span>
        <span class="mx-bar-end">${(() => { const m = d.starter ? { need: [] } : deckMissing(d); const k = m.need.reduce((a, x) => a + x.n, 0); return k ? `<button type="button" class="btn small gold" onclick="buyMissing()" title="${cashOn() ? `Buy the ${k} cards this deck uses that you don't own, with shop cash (you have ${usd(profile.usd || 0)})` : `Add the ${k} cards this deck uses that you don't own (free in Sandbox)`}">${cashOn() ? `🛒 Buy missing (${k} · ${usd(m.cost)})` : `➕ Add missing (${k})`}</button>` : ''; })()}${probs.length ? `<span class="warn" title="${esc(probs.join('\n'))}">⚠ ${probs.length} to fix</span>` : '<span class="ok">✓ Ready</span>'}
        <button type="button" class="btn small primary" onclick="saveDeck()">💾 Save</button></span>`;
}

// ---- Bulk edit: the whole list as text ----
function bulkEdit() {
    const d = editing;
    const lines = [];
    if (d.commander && CARDS.get(d.commander)) lines.push(`1 ${CARDS.get(d.commander).fullName} *CMDR*`);
    Object.entries(d.cards).map(([id, n]) => ({ c: CARDS.get(id), n })).filter(e => e.c).sort((a, b) => a.c.name.localeCompare(b.c.name)).forEach(({ c, n }) => lines.push(`${n} ${c.fullName}`));
    menuSheet('Bulk edit', `<p class="note">One card per line, like "4 Lightning Bolt".${d.format === 'commander' ? ' Put *CMDR* after your commander.' : ''} ${d.starter ? '' : 'Only cards you own (and basic lands) can go in.'}</p>
        <textarea id="bulkText" rows="16" spellcheck="false" aria-label="Deck list">${esc(lines.join('\n'))}</textarea>
        <div class="row" style="margin-top:8px;"><button class="btn primary" onclick="applyBulkEdit()">Apply</button></div>
        <div id="bulkNote" class="note" style="margin-top:6px;"></div>`);
}
async function applyBulkEdit() {
    const d = editing;
    const lines = $('bulkText').value.split('\n').map(l => l.trim()).filter(l => l && !/^(\/\/|#)/.test(l) && !/^(deck|sideboard|commander|maybeboard)$/i.test(l));
    const parsed = lines.map(l => {
        const m = l.match(/^(\d+)\s*x?\s+(.+?)$/i) || [null, '1', l];
        let name = m[2], cmdr = false;
        if (/\*CMDR\*/i.test(name)) { cmdr = true; name = name.replace(/\*CMDR\*/ig, ''); }
        name = name.replace(/\s*\([A-Z0-9]+\)\s*[\w-]*\s*$/, '').replace(/\s*\*F\*\s*$/i, '').trim();
        return { n: Math.max(1, parseInt(m[1], 10) || 1), name, cmdr };
    });
    const byName = new Map();
    const index = c => { [c.fullName, c.name].forEach(nm => { const k = nm.toLowerCase(); const prev = byName.get(k); if (!prev || (!profile.collection[prev.id] && profile.collection[c.id])) byName.set(k, c); }); };
    builderPool().forEach(index);
    Object.keys(d.cards).forEach(id => CARDS.get(id) && index(CARDS.get(id)));
    if (d.commander && CARDS.get(d.commander)) index(CARDS.get(d.commander));
    if (d.starter) {
        const missing = parsed.filter(p => !byName.has(p.name.toLowerCase())).map(p => p.name);
        if (missing.length) { $('bulkNote').textContent = 'Looking up cards...'; (await cardsByNames(missing)).forEach(index); }
    }
    const F = FORMATS[d.format];
    const cards = {}, notes = [];
    let commander = null;
    for (const p of parsed) {
        const c = byName.get(p.name.toLowerCase());
        if (!c) { notes.push(`"${p.name}": ${d.starter ? 'not found' : 'not in your collection'}.`); continue; }
        if (p.cmdr && d.format === 'commander') { commander = c.id; continue; }
        let n = p.n;
        if (!isBasic(c)) {
            const owned = d.starter ? Infinity : profile.collection[c.id] || 0;
            const cap = Math.min(F.copies, owned) - (cards[c.id] || 0);
            if (n > cap) { notes.push(`${c.name}: ${Math.max(0, cap)} instead of ${n} (${owned < F.copies ? `you own ${owned}` : `${F.copies} max`}).`); n = Math.max(0, cap); }
        }
        if (n) cards[c.id] = (cards[c.id] || 0) + n;
    }
    if (commander && cards[commander]) { cards[commander]--; if (!cards[commander]) delete cards[commander]; }
    d.cards = cards;
    if (d.format === 'commander') d.commander = commander || (d.commander && parsed.some(p => p.cmdr) ? null : d.commander);
    builderChanged();
    if (notes.length) $('bulkNote').innerHTML = `Applied, with changes:<br>${notes.map(esc).join('<br>')}`;
    else { closeSheet(); toast('Deck list updated.'); }
}

const TYPE_GROUPS = [['creature', 'Creatures'], ['instant', 'Instants'], ['sorcery', 'Sorceries'], ['artifact', 'Artifacts'], ['enchantment', 'Enchantments'], ['planeswalker', 'Planeswalkers'], ['battle', 'Battles'], ['land', 'Lands'], ['other', 'Other']];

function saveDeck() {
    const d = { ...editing };
    delete d.index; delete d.isNew;
    if (editing.index !== undefined) profile.decks[editing.index] = d;
    else { profile.decks.push(d); editing.index = profile.decks.length - 1; }
    saveProfile();
    toast(`Saved "${d.name}".`);
}
function closeBuilder() { editing = null; renderDeckPicker(); }

// ---------------------------------------------------------------------
// Decklists from Moxfield (2026-10-07, owner's request): paste a list,
// buy the cards you don't own with in-game shop cash, or face it.
// Moxfield's API doesn't let other sites read it, so lists are pasted
// (Moxfield: Export -> Copy for Moxfield / MTGA / plain text).
// ---------------------------------------------------------------------
const IMPORT_NO_PRICE = 0.25; // a card Scryfall has no price for costs this much
// "1 Sol Ring (CMR) 263 *F*", "4x Lightning Bolt", section headers, *CMDR*
function parseDeckText(text) {
    const out = { commander: [], main: [], side: [], unread: [] };
    let section = 'main', blocks = [[]];
    const HEAD = { commander: 'commander', commanders: 'commander', deck: 'main', main: 'main', mainboard: 'main', maindeck: 'main', sideboard: 'side', maybeboard: 'side', considering: 'side', companion: 'side', tokens: 'side', attractions: 'side', stickers: 'side' };
    for (let raw of String(text || '').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) { if (blocks[blocks.length - 1].length) blocks.push([]); continue; }
        const head = line.replace(/^\/\/\s*|^#\s*/, '').replace(/[:\s]*(\(\d+\))?$/, '').toLowerCase();
        if (HEAD[head] && !/^\d/.test(line)) { section = HEAD[head]; blocks.push([]); continue; }
        if (/^(\/\/|#)/.test(line)) continue;
        const m = line.match(/^(?:SB:\s*)?(\d+)\s*x?\s+(.+?)$/i) || [null, '1', line];
        let name = m[2], set = null, num = null, cmdr = false, foil = false;
        if (/\*CMDR\*/i.test(name)) { cmdr = true; name = name.replace(/\*CMDR\*/ig, ''); }
        if (/\*[FE]\*/.test(name)) { foil = true; name = name.replace(/\*[FE]\*/g, ''); }
        name = name.replace(/\s+#\S.*$/, '').replace(/\s+\^[^^]*\^/g, '').trim();
        const sm = name.match(/^(.+?)\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([A-Za-z0-9★\-]+))?$/) || name.match(/^(.+?)\s+\[([A-Za-z0-9]{2,6})(?::([A-Za-z0-9★\-]+))?\]$/);
        if (sm) { name = sm[1].trim(); set = sm[2].toLowerCase(); num = sm[3] || null; }
        name = name.replace(/\s*\/\/?\s*/g, ' // '); // "Life / Death", "Life/Death"
        if (!name) { out.unread.push(line); continue; }
        const e = { n: Math.max(1, parseInt(m[1], 10) || 1), name, set, num, foil, line };
        const where = cmdr ? 'commander' : /^SB:/i.test(line) ? 'side' : section;
        out[where].push(e);
        blocks[blocks.length - 1].push({ e, where });
    }
    // MTGO / Moxfield plain exports put the commander in a last short block after a blank line
    blocks = blocks.filter(b => b.length);
    if (!out.commander.length && blocks.length > 1) {
        const last = blocks[blocks.length - 1];
        const mainCount = out.main.reduce((a, e) => a + e.n, 0);
        if (last.length <= 2 && last.every(x => x.e.n === 1 && x.where !== 'commander') && mainCount - last.length >= 97 && mainCount <= 101) {
            last.forEach(x => { const arr = out[x.where]; arr.splice(arr.indexOf(x.e), 1); out.commander.push(x.e); });
        }
    }
    return out;
}
// The cards for a parsed list: the printing named in the list when Scryfall has it, else any printing
async function resolveDeckCards(entries) {
    const want = entries.filter(e => e.set && e.num);
    const bySetNum = new Map();
    if (want.length) {
        const { found } = await fetchCollection(want.map(e => ({ set: e.set, collector_number: e.num })));
        // Only when the printing is the card named (a wrong number falls back to the name)
        const named = new Set(want.map(e => `${e.set}:${e.num}:${e.name.toLowerCase()}`));
        found.forEach(c => { if (named.has(`${c.set}:${c.num}:${c.fullName.toLowerCase()}`) || named.has(`${c.set}:${c.num}:${c.name.toLowerCase()}`)) bySetNum.set(`${c.set}:${c.num}`, c); });
    }
    const byName = await cardsByNames(entries.filter(e => !bySetNum.has(`${e.set}:${e.num}`)).map(e => e.name));
    // Archidekt writes double-faced cards as "Storm the Vault // Vault of Catlacan": look those up by the front face
    const faces = entries.filter(e => / \/\/ /.test(e.name) && !bySetNum.has(`${e.set}:${e.num}`) && !byName.get(e.name.toLowerCase())).map(e => e.name.split(' // ')[0]);
    if (faces.length) (await cardsByNames(faces)).forEach((v, k) => { if (!byName.has(k)) byName.set(k, v); });
    return entries.map(e => ({ ...e, card: bySetNum.get(`${e.set}:${e.num}`) || byName.get(e.name.toLowerCase()) || byName.get(e.name.split(' // ')[0].toLowerCase()) || null }));
}
const importPrice = card => parseFloat(card.usd || card.usdFoil) || IMPORT_NO_PRICE;
// Your owned printings of a card, by name
function ownedByName() {
    const map = new Map();
    Object.keys(profile.collection).forEach(id => { const c = CARDS.get(id); if (c && profile.collection[id] > 0) { const k = c.fullName.toLowerCase(); if (!map.has(k)) map.set(k, []); map.get(k).push(id); } });
    return map;
}

let IMP = null; // the list being imported
function importDialog() {
    menuSheet('📥 Import a decklist', `
        <p class="note">Paste a list from Moxfield (<strong>Export → Copy</strong>; the Moxfield, MTGA and plain text formats all work), Archidekt or MTG Arena. Cards you own are used first; ${cashOn() ? `the rest are bought at Scryfall's TCGplayer price with your shop cash (<strong>${usd(profile.usd || 0)}</strong>). Basic lands are free. Earn more cash in the 🏪 Shop.` : 'the rest are added to your collection for free (Sandbox has no shop cash).'}</p>
        <textarea id="impText" rows="12" spellcheck="false" placeholder="1 Atraxa, Praetors' Voice (2X2) 190&#10;1 Sol Ring&#10;..." aria-label="Decklist">${esc(IMP ? IMP.text : '')}</textarea>
        <div class="row" style="margin-top:8px;">
            <input type="text" id="impName" placeholder="Deck name" value="${esc(IMP ? IMP.name : '')}" aria-label="Deck name" style="flex:1 1 180px;">
            <select id="impFormat" aria-label="Format"><option value="auto">Format: work it out</option><option value="commander">Commander</option><option value="modern">Modern</option><option value="casual">Casual</option></select>
            <button class="btn primary" onclick="checkImport()">Check prices</button>
        </div>
        <div id="impOut" style="margin-top:10px;"></div>`);
    $('sheetHost').querySelector('.sheet').classList.add('wide');
}
async function checkImport() {
    const text = $('impText').value;
    const parsed = parseDeckText(text);
    const all = [...parsed.commander, ...parsed.main];
    if (!all.length) { $('impOut').innerHTML = '<p class="warn">No cards found in that text.</p>'; return; }
    $('impOut').innerHTML = '<div class="loading">Looking up the cards and prices on Scryfall...</div>';
    await loadBasics().catch(() => {});
    await cardsByIds(Object.keys(profile.collection));
    const rows = await resolveDeckCards(all);
    const total = all.reduce((a, e) => a + e.n, 0);
    let fmt = $('impFormat').value;
    if (fmt === 'auto') fmt = parsed.commander.length || (total >= 98 && total <= 101) ? 'commander' : total >= 60 ? 'modern' : 'casual';
    // The commander: the list's, else a legendary creature the player picks
    let cmd = null;
    if (fmt === 'commander') {
        const marked = rows.filter(r => parsed.commander.includes(all[rows.indexOf(r)]) && r.card);
        cmd = (marked[0] || rows.find(r => r.card && rulesFor(r.card).legendary && rulesFor(r.card).kind === 'creature')) || null;
    }
    IMP = { text, name: $('impName').value.trim(), fmt, rows, cmdRow: cmd, partners: fmt === 'commander' ? rows.filter(r => parsed.commander.includes(all[rows.indexOf(r)]) && r !== cmd).length : 0 };
    renderImport();
}
// Which copies come from your collection, and what's left to buy
function importPlan(rows, cmdRow) {
    const owned = ownedByName();
    const use = new Map(); // id -> copies used so far
    const plan = rows.filter(r => r.card).map(r => {
        const free = isBasic(r.card);
        let need = r.n;
        const from = [];
        if (!free) for (const id of owned.get(r.card.fullName.toLowerCase()) || []) {
            const left = (profile.collection[id] || 0) - (use.get(id) || 0);
            const k = Math.min(left, need);
            if (k > 0) { from.push([id, k]); use.set(id, (use.get(id) || 0) + k); need -= k; }
            if (!need) break;
        }
        return { r, free, from, buy: free ? 0 : need, price: importPrice(r.card), isCmd: r === cmdRow };
    });
    const cost = cashOn() ? plan.reduce((a, p) => a + p.buy * p.price, 0) : 0;
    return { plan, cost: Math.round(cost * 100) / 100 };
}
function renderImport() {
    const { rows, fmt, cmdRow } = IMP;
    const { plan, cost } = importPlan(rows, cmdRow);
    const missing = rows.filter(r => !r.card);
    const cash = profile.usd || 0;
    const count = rows.filter(r => r.card).reduce((a, r) => a + r.n, 0);
    const toBuy = plan.reduce((a, p) => a + p.buy, 0);
    const notYet = plan.filter(p => !p.free && rulesFor(p.r.card).support === 'none');
    const legends = rows.filter(r => r.card && rulesFor(r.card).legendary && rulesFor(r.card).kind === 'creature');
    const short = Math.max(0, cost - cash);
    $('impOut').innerHTML = `
        <div class="imp-sum">
            <div><span class="pos-k">Cards</span><strong>${count}</strong></div>
            <div><span class="pos-k">Format</span><strong>${FORMATS[fmt].name}</strong></div>
            <div><span class="pos-k">You own</span><strong>${count - toBuy - plan.filter(p => p.free).reduce((a, p) => a + p.r.n, 0)}</strong></div>
            <div><span class="pos-k">To buy</span><strong>${toBuy}</strong></div>
            ${cashOn() ? `<div><span class="pos-k">Cost</span><strong class="money">${usd(cost)}</strong></div>
            <div><span class="pos-k">Your cash</span><strong class="${short ? 'warn' : 'ok'}">${usd(cash)}</strong></div>` : '<div><span class="pos-k">Cost</span><strong class="ok">Free</strong></div>'}
        </div>
        ${fmt === 'commander' ? `<div class="row" style="margin:8px 0;"><label class="note" for="impCmd">👑 Commander</label><select id="impCmd" onchange="IMP.cmdRow = IMP.rows[this.value]; renderImport();">${legends.length ? legends.map(r => `<option value="${rows.indexOf(r)}"${r === cmdRow ? ' selected' : ''}>${esc(r.card.fullName)}</option>`).join('') : '<option>No legendary creature in the list</option>'}</select>${IMP.partners ? '<span class="note">This game has one commander: the other one plays in the deck.</span>' : ''}</div>` : ''}
        ${missing.length ? `<p class="warn">Not found on Scryfall (left out): ${missing.map(r => esc(r.name)).join(', ')}</p>` : ''}
        ${notYet.length ? `<p class="note">⚠ ${notYet.length} card${notYet.length === 1 ? '' : 's'} can't be cast in the game yet (marked "Not yet"): ${notYet.slice(0, 8).map(p => esc(p.r.card.name)).join(', ')}${notYet.length > 8 ? '…' : ''}.</p>` : ''}
        <details class="note" ${toBuy && toBuy <= 30 ? 'open' : ''}><summary>What you'd buy (${toBuy} card${toBuy === 1 ? '' : 's'}, most expensive first)</summary>
            <table class="pos-table imp-table"><tr><th>Card</th><th>Own</th><th>Buy</th><th>Each</th><th>Total</th></tr>
            ${plan.filter(p => p.buy).sort((a, b) => b.buy * b.price - a.buy * a.price).map(p => `<tr><td>${esc(p.r.card.fullName)}${p.isCmd ? ' 👑' : ''} ${supportBadge(p.r.card)}</td><td>${p.from.reduce((a, [, k]) => a + k, 0)}</td><td>${p.buy}</td><td>${p.r.card.usd || p.r.card.usdFoil ? usd(p.price) : `<span title="No price on Scryfall">~${usd(p.price)}</span>`}</td><td>${usd(p.buy * p.price)}</td></tr>`).join('')}</table></details>
        <div class="row" style="margin-top:10px;">
            <button class="btn gold" onclick="finishImport(true)" ${short || !toBuy ? 'disabled' : ''}>${cashOn() ? `🛒 Buy ${toBuy} for ${usd(cost)} and save` : `➕ Add the ${toBuy} cards you don't own and save`}</button>
            <button class="btn${toBuy ? '' : ' primary'}" onclick="finishImport(false)">${toBuy ? (cashOn() ? 'Save without buying' : 'Save without adding them') : '💾 Save the deck'}</button>
        </div>
        <p class="note">${short ? `You need <strong>${usd(short)}</strong> more. Earn it in the 🏪 Shop, then buy the missing cards from the deck builder (🛒 Buy missing). ` : ''}${cashOn() ? `Prices are Scryfall's TCGplayer market price for that printing (cards with no price cost ${usd(IMPORT_NO_PRICE)}). Bought cards arrive Mint.` : 'Cards you add arrive Mint, at no cost.'}</p>`;
}
function finishImport(buy) {
    const { rows, fmt, cmdRow } = IMP;
    const { plan, cost } = importPlan(rows, cmdRow);
    if (buy && cost > (profile.usd || 0)) { toast('Not enough shop cash.'); return; }
    const cards = {};
    let commander = null;
    plan.forEach(p => {
        // Owned printings first, then the list's printing (bought or missing)
        p.from.forEach(([id, k]) => { cards[id] = (cards[id] || 0) + k; });
        if (p.free) cards[p.r.card.id] = (cards[p.r.card.id] || 0) + p.r.n;
        if (p.buy) {
            if (buy) for (let k = 0; k < p.buy; k++) addCopy(p.r.card.id, { c: 'M' });
            cards[p.r.card.id] = (cards[p.r.card.id] || 0) + p.buy;
        }
        if (p.isCmd) { const id = p.from.length ? p.from[0][0] : p.r.card.id; commander = id; cards[id]--; if (!cards[id]) delete cards[id]; }
    });
    if (buy && cashOn()) {
        profile.usd = Math.round(((profile.usd || 0) - cost) * 100) / 100;
        (profile.shopLedger = profile.shopLedger || []).push({ day: profile.shopDay || 1, note: `Bought ${plan.reduce((a, p) => a + p.buy, 0)} cards for an imported deck`, usd: -cost });
    }
    const deck = { id: `d${Date.now()}`, name: IMP.name || (commander ? CARDS.get(commander).name : 'Imported deck'), format: fmt, cards, commander, starter: false, imported: true };
    profile.decks.push(deck);
    saveProfile();
    renderCoins();
    closeSheet();
    IMP = null;
    toast(buy ? (cashOn() ? `Bought the cards for ${usd(cost)} and saved "${deck.name}".` : `Added the cards and saved "${deck.name}".`) : `Saved "${deck.name}".`);
    renderDeckPicker();
}
// Cards a deck uses that you don't own, and what they'd cost
function deckMissing(deck) {
    const need = [];
    const use = { ...deck.cards };
    if (deck.commander) use[deck.commander] = (use[deck.commander] || 0) + 1;
    Object.entries(use).forEach(([id, n]) => {
        const c = CARDS.get(id);
        if (!c || isBasic(c)) return;
        const k = n - (profile.collection[id] || 0);
        if (k > 0) need.push({ id, card: c, n: k, price: importPrice(c) });
    });
    return { need, cost: Math.round(need.reduce((a, x) => a + x.n * x.price, 0) * 100) / 100 };
}
function buyMissing() {
    const d = editing;
    if (!d) return;
    const { need, cost } = deckMissing(d);
    if (!need.length) return;
    if (cashOn() && cost > (profile.usd || 0)) { toast(`You need ${usd(cost - (profile.usd || 0))} more shop cash. Earn it in the 🏪 Shop.`); return; }
    need.forEach(x => { for (let k = 0; k < x.n; k++) addCopy(x.id, { c: 'M' }); });
    if (cashOn()) {
        profile.usd = Math.round(((profile.usd || 0) - cost) * 100) / 100;
        (profile.shopLedger = profile.shopLedger || []).push({ day: profile.shopDay || 1, note: `Bought ${need.reduce((a, x) => a + x.n, 0)} missing cards for "${d.name}"`, usd: -cost });
    }
    saveProfile();
    renderCoins();
    toast(cashOn() ? `Bought ${need.reduce((a, x) => a + x.n, 0)} cards for ${usd(cost)}.` : `Added ${need.reduce((a, x) => a + x.n, 0)} cards.`);
    builderChanged();
}

// ---- Opponents from a pasted list (free: it's the other side of the table) ----
async function listToOppDeck(text, wantFormat) {
    await loadBasics();
    const parsed = parseDeckText(text);
    const all = [...parsed.commander, ...parsed.main];
    if (!all.length) throw new Error('No cards found in that list.');
    const rows = await resolveDeckCards(all);
    const total = all.reduce((a, e) => a + e.n, 0);
    const format = wantFormat === 'commander' || parsed.commander.length || (total >= 98 && total <= 101) ? 'commander' : 'casual';
    let commander = null;
    if (format === 'commander') {
        const c = rows.find(r => parsed.commander.includes(all[rows.indexOf(r)]) && r.card) || rows.find(r => r.card && rulesFor(r.card).legendary && rulesFor(r.card).kind === 'creature');
        if (!c) throw new Error('That list has no commander (a legendary creature).');
        commander = c.card;
    }
    const ci = (commander ? commander.ci : [...new Set(rows.filter(r => r.card).flatMap(r => r.card.ci))]).filter(c => BASIC_IDS[c]);
    const entries = [];
    let swapped = 0, used = false;
    rows.forEach(r => {
        if (!r.card) { swapped += r.n; return; }
        let n = r.n;
        if (commander && r.card.id === commander.id && !used) { used = true; n--; }
        if (!n) return;
        if (rulesFor(r.card).support === 'none' && !isBasic(r.card)) { swapped += n; return; }
        entries.push({ card: r.card, n });
    });
    // Swapped and missing cards become basic lands of its colors (so it keeps its size)
    for (let i = 0; i < swapped; i++) {
        const id = BASIC_IDS[ci.length ? ci[i % ci.length] : 'W'];
        const e = entries.find(x => x.card.id === id);
        if (e) e.n++; else entries.push({ card: CARDS.get(id), n: 1 });
    }
    return { name: commander ? commander.name : 'Pasted deck', format, commander, entries, swapped, source: `pasted decklist${swapped ? `, ${swapped} cards swapped for lands` : ''}` };
}
function pasteOpponentDialog() {
    menuSheet('📋 Face a pasted decklist', `
        <p class="note">Paste any list (Moxfield <strong>Export → Copy</strong>, MTGA or plain text). It's the opponent's deck, so it's free. Cards the game can't run yet become basic lands of its colors.</p>
        <textarea id="oppText" rows="12" spellcheck="false" aria-label="Opponent's decklist">${esc(chosenOpponent && chosenOpponent.type === 'list' ? chosenOpponent.text : '')}</textarea>
        <div class="row" style="margin-top:8px;"><button class="btn primary" onclick="useOppList()">Use this deck</button><span class="note" id="oppTextNote"></span></div>`);
    $('sheetHost').querySelector('.sheet').classList.add('wide');
}
async function useOppList() {
    const text = $('oppText').value;
    $('oppTextNote').textContent = 'Reading the list...';
    try {
        const deck = profile.decks[$('playDeck').value];
        const gen = await listToOppDeck(text, deck && deck.format === 'commander' ? 'commander' : null);
        chosenOpponent = { type: 'list', key: 'list', text, gen, name: gen.name };
        closeSheet();
        renderOpponents();
        toast(`Opponent: ${gen.name}${gen.swapped ? ` (${gen.swapped} cards swapped for lands)` : ''}.`);
    } catch (e) { $('oppTextNote').textContent = e.message; }
}

// ---- Face any commander: EDHREC's average deck for it ----
// EDHREC's page name: "Atraxa, Praetors' Voice" -> atraxa-praetors-voice
function edhrecSlug(name) {
    return String(name).split(' // ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/['’",.!?:]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
let cmdSuggestTimer = null;
function suggestCommanders(q) {
    clearTimeout(cmdSuggestTimer);
    if (q.trim().length < 2) return;
    cmdSuggestTimer = setTimeout(async () => {
        try {
            const res = await sfJSON(`${SF}/cards/search?q=${encodeURIComponent(`is:commander game:paper ${q}`)}&order=edhrec&unique=cards`);
            const names = ((res && res.data) || []).slice(0, 12).map(c => c.name);
            if ($('cmdSuggest')) $('cmdSuggest').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
        } catch (e) { /* suggestions are optional */ }
    }, 250);
}
async function faceCommander() {
    const name = $('cmdFind').value.trim();
    if (!name) return;
    $('cmdFindNote').textContent = 'Looking for its EDHREC deck...';
    const slug = edhrecSlug(name);
    try {
        const res = await fetch(`${EDH}/average-decks/${slug}.json`);
        if (!res.ok) throw new Error();
        chosenOpponent = { type: 'commander', key: slug, name };
        $('cmdFindNote').textContent = '';
        renderOpponents();
    } catch (e) { $('cmdFindNote').textContent = `EDHREC has no deck for "${name}". Check the spelling (pick from the suggestions).`; }
}

// ---------------------------------------------------------------------
// Theme decks (Modern) and Commander decks, for opponents and starters
// ---------------------------------------------------------------------
// Each theme is two Scryfall searches (creatures, spells), most-played
// first. Only cards the game can run go in: fully automated first, then
// "partly" creatures if there aren't enough. Checked live on 2026-10-05.
const MODERN_THEMES = [
    { key: 'burn', name: 'Red Burn', desc: 'Fast red creatures and burn spells', colors: ['R'], creatures: 'c=r t:creature cmc<=3 pow>=2', spells: 'c=r (t:instant or t:sorcery) (o:"damage to any target" or o:"damage to target creature")', spellCount: 4 },
    { key: 'stompy', name: 'Green Stompy', desc: 'Big green creatures and pump spells', colors: ['G'], creatures: 'c=g t:creature cmc<=4 pow>=3', spells: 'c=g (t:instant or t:sorcery) o:"target creature" o:"gets +"' },
    { key: 'weenie', name: 'White Weenie', desc: 'A wide army of small white creatures', colors: ['W'], creatures: 'c=w t:creature cmc<=3', spells: 'c=w (t:instant or t:sorcery) (o:"exile target creature" or o:"destroy target creature" or o:"gets +")' },
    { key: 'skies', name: 'Azorius Skies', desc: 'White and blue flyers with bounce and card draw', colors: ['W', 'U'], creatures: '(c=w or c=u or c=wu) t:creature kw:flying cmc<=4', spells: '(c=u or c=w or c=wu) (t:instant or t:sorcery) (o:"to its owner\'s hand" or o:"draw two cards" or o:"exile target creature")' },
    { key: 'black', name: 'Mono-Black Removal', desc: 'Black creatures backed by removal and drain', colors: ['B'], creatures: 'c=b t:creature cmc<=4', spells: 'c=b (t:instant or t:sorcery) (o:"destroy target creature" or o:"loses")', spellCount: 4 },
    { key: 'goblins', name: 'Goblins', desc: 'A goblin horde', colors: ['R'], creatures: 't:goblin t:creature c<=r', spells: 'c=r (t:instant or t:sorcery) o:"damage to any target"', creatureCount: 7 },
    { key: 'elves', name: 'Elves', desc: 'Elves and green pump', colors: ['G'], creatures: 't:elf t:creature c<=g', spells: 'c=g (t:instant or t:sorcery) o:"target creature" o:"gets +"', creatureCount: 7 },
    { key: 'zombies', name: 'Zombies', desc: 'Black zombies and removal', colors: ['B'], creatures: 't:zombie t:creature c<=b', spells: 'c=b (t:instant or t:sorcery) o:"destroy target creature"', creatureCount: 7 },
    { key: 'lifelink', name: 'Orzhov Lifelink', desc: 'White and black lifelinkers', colors: ['W', 'B'], creatures: 'id<=wb -c:c t:creature kw:lifelink', spells: '(c=w or c=b or c=wb) (t:instant or t:sorcery) (o:"gain" or o:"destroy target creature")' },
    { key: 'tempo', name: 'Mono-Blue Tempo', desc: 'Blue flyers backed by counterspells and bounce', colors: ['U'], creatures: 'c=u t:creature kw:flying cmc<=4', spells: 'c=u t:instant (o:"counter target spell" or o:"counter target noncreature spell" or o:"counter target creature spell" or o:"to its owner\'s hand")', spellCount: 5 },
    { key: 'gruul', name: 'Gruul Trample', desc: 'Red and green tramplers', colors: ['R', 'G'], creatures: 'id<=rg -c:c t:creature kw:trample cmc<=5', spells: '(c=r or c=g or c=rg) (t:instant or t:sorcery) (o:"damage to any target" or o:"gets +")' }
];

function landSplit(cards, colors, landCount) {
    const pips = Object.fromEntries(colors.map(c => [c, 0]));
    cards.forEach(({ card, n }) => colors.forEach(col => { pips[col] += (card.cost.split(`{${col}}`).length - 1) * n; }));
    const total = Object.values(pips).reduce((a, b) => a + b, 0) || colors.length;
    const out = {};
    let given = 0;
    colors.forEach((col, i) => {
        const share = i === colors.length - 1 ? landCount - given : Math.round(landCount * ((pips[col] || 1) / total));
        out[col] = share;
        given += share;
    });
    return out;
}

async function buildThemeDeck(theme) {
    await loadBasics();
    const base = theme.base || ' f:modern game:paper -t:land';
    const fixed = theme.fixed ? [...(await cardsByNames(theme.fixed)).values()].filter(c => rulesFor(c).support !== 'none') : [];
    const [creaturePool, spellPool] = await Promise.all([
        searchCards(theme.creatures + base, 3),
        theme.spells ? searchCards(theme.spells + base, 2) : Promise.resolve([])
    ]);
    const ok = (c, kind) => rulesFor(c).kind === kind && rulesFor(c).support !== 'none';
    const creatures = [
        ...creaturePool.filter(c => ok(c, 'creature') && rulesFor(c).support === 'full'),
        ...creaturePool.filter(c => ok(c, 'creature') && rulesFor(c).support === 'partial')
    ];
    const spells = spellPool.filter(c => ['instant', 'sorcery'].includes(rulesFor(c).kind) && rulesFor(c).support === 'full');
    const spellN = Math.min(spells.length, theme.spellCount || 3);
    const creatureN = Math.min(creatures.length, (theme.creatureCount || 6) + (3 - Math.min(spellN, 3)));
    // A sensible curve: mostly cheap creatures, a couple of top-end ones
    const picked = creatures.slice(0, creatureN * 2);
    const chosen = [];
    const cheap = picked.filter(c => c.cmc <= 3), top = picked.filter(c => c.cmc > 3);
    chosen.push(...cheap.slice(0, Math.max(creatureN - 2, creatureN - top.length)));
    chosen.push(...top.slice(0, creatureN - chosen.length));
    if (chosen.length < creatureN) chosen.push(...picked.filter(c => !chosen.includes(c)).slice(0, creatureN - chosen.length));
    const nonland = [...fixed.map(card => ({ card, n: 1 })), ...[...chosen, ...spells.slice(0, spellN)].map(card => ({ card, n: 4 }))];
    const nonlandCount = nonland.reduce((a, e) => a + e.n, 0);
    const landCount = Math.max(20, 60 - nonlandCount);
    const split = landSplit(nonland, theme.colors, landCount);
    const lands = Object.entries(split).filter(([, n]) => n > 0).map(([col, n]) => ({ card: CARDS.get(BASIC_IDS[col]), n }));
    return { name: theme.name, format: 'modern', commander: null, entries: [...nonland, ...lands].filter(e => e.card) };
}

let trendingCommanders = null;
async function loadTrendingCommanders() {
    if (trendingCommanders) return trendingCommanders;
    const res = await fetch(`${EDH}/commanders/week.json`);
    if (!res.ok) throw new Error('EDHREC unavailable');
    const json = await res.json();
    const views = ((json.container && json.container.json_dict && json.container.json_dict.cardlists) || [])[0];
    trendingCommanders = ((views && views.cardviews) || []).slice(0, 16).map(v => ({ name: v.name, slug: v.sanitized || v.slug, decks: v.num_decks }));
    return trendingCommanders;
}

// EDHREC's average deck for a commander: the cards most of its decks run.
// Cards the game can't cast yet are swapped for basic lands of its colors.
async function buildCommanderDeck(slug) {
    await loadBasics();
    const res = await fetch(`${EDH}/average-decks/${slug}.json`);
    if (!res.ok) throw new Error('EDHREC has no average deck for that commander');
    const avg = await res.json();
    const cmdName = avg.deck.commander[0];
    const list = Object.values(avg.deck.cards).flat();
    const byName = await cardsByNames([cmdName, ...list.map(e => e[0])]);
    const commander = byName.get(cmdName.toLowerCase());
    if (!commander) throw new Error(`Couldn't find ${cmdName}`);
    const ci = commander.ci.filter(c => BASIC_IDS[c]);
    const entries = [];
    let swapped = 0;
    list.forEach(([name, q]) => {
        const card = byName.get(String(name).toLowerCase());
        if (!card || card.id === commander.id) return;
        if (rulesFor(card).support === 'none' && !isBasic(card)) { swapped += q; return; }
        entries.push({ card, n: q });
    });
    let total = entries.reduce((a, e) => a + e.n, 0);
    for (let i = 0; total < 99; i++, total++) {
        const id = BASIC_IDS[ci.length ? ci[i % ci.length] : 'W'];
        const e = entries.find(x => x.card.id === id);
        if (e) e.n++; else entries.push({ card: CARDS.get(id), n: 1 });
    }
    return { name: `${commander.name}`, format: 'commander', commander, entries, swapped, source: 'EDHREC average deck' };
}

function generatedToDeck(gen, name) {
    const cards = {};
    gen.entries.forEach(e => { cards[e.card.id] = (cards[e.card.id] || 0) + e.n; });
    return { id: `d${Date.now()}`, name, format: gen.format, cards, commander: gen.commander ? gen.commander.id : null, starter: true };
}

// Decks checked card by card (every card Automated, rule checks and AI games; owner's decks, 2026-10-07 and 2026-10-08).
// Offered as starter decks and as Commander opponents. Plain-text lists; the last block is the commander.
const VERIFIED_DECKS = [
    { key: 'sandman', name: 'Sandman, Shifting Scoundrel', colors: ['G'], desc: 'Mono-green lands: ramp, landfall and big creatures that grow with your lands', checked: '2026-10-07', text: "1 Altar of Dementia\n1 Ash Barrens\n1 Bala Ged Recovery\n1 Beast Within\n1 Biosynthic Burst\n1 Blighted Woodland\n1 Braulios of Pheres Band\n1 Bridgeworks Battle\n1 Bugenhagen, Wise Elder\n1 Bushwhack\n1 Collector's Vault\n1 Conduit of Worlds\n1 Contest of Claws\n1 Cultivator Colossus\n1 Damage Control Crew\n1 Demolition Field\n1 Disciple of Freyalise\n1 Druid of Purification\n1 Dryad's Revival\n1 Eternal Witness\n1 Evolution Charm\n1 Evolving Wilds\n1 Feed the Pack\n25 Forest\n1 Gaea's Gift\n1 Gaea's Touch\n1 Garruk's Uprising\n1 Genesis Wave\n1 Ghalta, Primal Hunger\n1 Ghost Quarter\n1 Greensleeves, Maro-Sorcerer\n1 Groundchuck & Dirtbag\n1 Harmonious Grovestrider\n1 Healing Technique\n1 Horizon Explorer\n1 Jubilation\n1 Khalni Ambush\n1 Lazotep Quarry\n1 Life's Legacy\n1 Lifestream's Blessing\n1 Lumbering Worldwagon\n1 Matzalantli, the Great Door\n1 Michelangelo, On the Scene\n1 Molimo, Maro-Sorcerer\n1 Momentous Fall\n1 Multani, Yavimaya's Avatar\n1 Myriad Landscape\n1 Nature's Lore\n1 Naya Panorama\n1 Old One Eye\n1 Overprotect\n1 Pair o' Dice Lost\n1 Primeval Herald\n1 Pulse of Murasa\n1 Rampant Frogantua\n1 Return of the Wildspeaker\n1 Rishkar's Expertise\n1 Rude Awakening\n1 Soul's Majesty\n1 Spelunking\n1 Splendid Reclamation\n1 Spry and Mighty\n1 Summon: Fenrir\n1 Summon: Titan\n1 Swampbenders\n1 Tamiyo's Safekeeping\n1 Terramorphic Expanse\n1 Three Visits\n1 Timeless Witness\n1 Travel Through Caradhras\n1 Traverse the Outlands\n1 Ulvenwald Hydra\n1 Vibrant Cityscape\n1 Wilderness Reclamation\n1 Zanarkand, Ancient Metropolis\n\n1 Sandman, Shifting Scoundrel" },
    { key: 'brudiclad', name: 'Brudiclad, Telchor Engineer', colors: ['U', 'R'], desc: 'Izzet artifacts and tokens: Treasures, copies and Myr', checked: '2026-10-07', text: "1 Academy Manufactor\n1 Academy Ruins\n1 Audacious Reshapers\n1 Buried Ruin\n1 Burn Down the House\n1 Cascade Bluffs\n1 Chaos Warp\n1 Chief of the Foundry\n1 Combustible Gearhulk\n1 Command Tower\n1 Confirm Suspicions\n1 Curiosity Crafter\n1 Cyclonic Rift\n1 Daretti, Scrap Savant\n1 Darksteel Citadel\n1 Darksteel Forge\n1 Darksteel Juggernaut\n1 Dockside Extortionist\n1 Emry, Lurker of the Loch\n1 Fact or Fiction\n1 Fathom Fleet Swordjack\n1 Flameshadow Conjuring\n1 Frostboil Snarl\n1 Goldspan Dragon\n1 Great Furnace\n1 Hellkite Tyrant\n1 Impulsive Pilferer\n11 Island\n1 Izzet Boilerworks\n1 Izzet Signet\n1 Jeska's Will\n1 Jhoira, Weatherlight Captain\n1 Leadership Vacuum\n1 Loyal Apprentice\n1 Magmaquake\n1 Master of Etherium\n1 Master Transmuter\n1 Mimic Vat\n1 Mirrorworks\n9 Mountain\n1 Mox Opal\n1 Myr Battlesphere\n1 Myriad Landscape\n1 Mystic Reflection\n1 Phyrexian Triniform\n1 Pongify\n1 Prototype Portal\n1 Pull from Tomorrow\n1 Quasiduplicate\n1 Reef Worm\n1 Replication Technique\n1 Retrofitter Foundry\n1 River's Rebuke\n1 Ruin Grinder\n1 Saheeli, the Gifted\n1 Saheeli's Artistry\n1 Seat of the Synod\n1 Sharding Sphinx\n1 Sol Ring\n1 Solemn Simulacrum\n1 Soul of New Phyrexia\n1 Spell Swindle\n1 Steam Vents\n1 Steel Hellkite\n1 Storm the Vault // Vault of Catlacan\n1 Stormcarved Coast\n1 Swiftfoot Boots\n1 Talisman of Creativity\n1 Tamiyo's Journal\n1 Temple of Epiphany\n1 Tempt with Reflections\n1 Thopter Assembly\n1 Thopter Spy Network\n1 Thought Vessel\n1 Trading Post\n1 Training Center\n1 Treasure Map // Treasure Cove\n1 Treasure Nabber\n1 Treasure Vault\n1 Triplicate Titan\n1 Unwinding Clock\n\n1 Brudiclad, Telchor Engineer" },
    { key: 'gitrog', name: 'The Gitrog, Ravenous Ride', colors: ['B', 'G'], desc: 'Golgari graveyard and lands: sacrifice, reanimation and big trampling creatures', checked: '2026-10-08', text: "1 Arcane Signet\n1 Beanstalk Giant\n1 Biosynthic Burst\n1 Braulios of Pheres Band\n1 Bridgeworks Battle\n1 Broodguard Elite\n1 Bygone Colossus\n1 Command Tower\n1 Daemogoth Titan\n1 Damage Control Crew\n1 Day of Black Sun\n1 Dryad's Revival\n1 Emissary Green\n1 Espers to Magicite\n1 Eternal Witness\n1 Evolution Charm\n1 Exotic Orchard\n1 Exponential Growth\n1 Festering Gulch\n1 Final Act\n1 Flopsie, Bumi's Buddy\n22 Forest\n1 Goreclaw, Terror of Qal Sisma\n1 Hagra Mauling\n1 Harmonious Grovestrider\n1 Infested Thrinax\n1 Into the Pit\n1 Invasion of Fiora\n1 Invasion of Zendikar\n1 Khalni Ambush\n1 Life/Death\n1 Lifestream's Blessing\n1 Lounge\n1 Lumbering Worldwagon\n1 Malboro\n1 Monstrous Vortex\n1 Morlun, Devourer of Spiders\n1 Nightshade Dryad\n1 Nissa, Worldsoul Speaker\n1 Nullpriest of Oblivion\n1 Nurgle's Conscription\n1 Nyxborn Hydra\n1 Old Man Willow\n1 Once and Future\n1 Pelakka Predation\n1 Polygoyf\n1 Primeval Herald\n1 Rampant Frogantua\n1 Rampant Growth\n1 Regrowth\n1 Rejoin the Fight\n1 Return of the Wildspeaker\n1 Revitalizing Repast\n1 Sandman, Shifting Scoundrel\n1 Shadow, Mysterious Assassin\n1 Sol Ring\n1 Stormkeld Vanguard\n8 Swamp\n1 Tenacious Underdog\n1 Tend the Pests\n1 The Earth King\n1 The Falcon, Airship Restored\n1 The Grim Captain's Locker\n1 Thought Vessel\n1 Timeless Witness\n1 Titania's Command\n1 Trickster's Elk\n1 Ulvenwald Hydra\n1 Undercity Upheaval\n1 Victimize\n1 Yargle, Glutton of Urborg\n\n1 The Gitrog, Ravenous Ride" },
    { key: 'tyrox', name: 'Tyrox, Saurid Tyrant', colors: ['R'], desc: 'Mono-red aggro: cheap haste creatures, equipment and burn, with a 2-mana commander to recast', checked: '2026-10-07', text: "1 Abrade\n1 Ancient Tomb\n1 Anger of the Gods\n1 Arcane Signet\n1 Big Score\n1 Blasphemous Act\n1 Bonesplitter\n1 Castle Embereth\n1 Chain Reaction\n1 Chaos Warp\n1 Colossus Hammer\n1 Combat Celebrant\n1 Commander's Plate\n1 Dragon Fodder\n1 Embercleave\n1 Embereth Shieldbreaker\n1 Etali, Primal Storm\n1 Faithless Looting\n1 Fire Diamond\n1 Flamewake Phoenix\n1 Forgotten Cave\n1 Furnace Whelp\n1 Glorybringer\n1 Goblin Bombardment\n1 Goblin Chieftain\n1 Goblin Guide\n1 Goblin Rabblemaster\n1 Goblin Warchief\n1 Goldspan Dragon\n1 Hanweir Garrison\n1 Hazoret the Fervent\n1 Hellkite Tyrant\n1 Hellrider\n1 Hordeling Outburst\n1 Inferno Titan\n1 Jeska's Will\n1 Krenko, Mob Boss\n1 Light Up the Stage\n1 Lightning Bolt\n1 Lightning Greaves\n1 Lightning Strike\n1 Magma Jet\n1 Mind Stone\n1 Mizzium Mortars\n1 Monastery Swiftspear\n28 Mountain\n1 Mutavault\n1 Professional Face-Breaker\n1 Purphoros, God of the Forge\n1 Rograkh, Son of Rohgahh\n1 Samut, Hazoret's Champion\n1 Searing Spear\n1 Shinka, the Bloodsoaked Keep\n1 Siege-Gang Commander\n1 Skullclamp\n1 Slagstorm\n1 Sol Ring\n1 Storm-Kiln Artist\n1 Swiftfoot Boots\n1 Sword of Fire and Ice\n1 Temur Battle Rage\n1 Terror of the Peaks\n1 Thought Vessel\n1 Thrill of Possibility\n1 Torbran, Thane of Red Fell\n1 Tormenting Voice\n1 Unexpected Windfall\n1 Vandalblast\n1 Walking Ballista\n1 Wayfarer's Bauble\n1 Wheel of Fortune\n1 Wild Slash\n\n1 Tyrox, Saurid Tyrant" },
    { key: 'terrian', name: "Terrian, World Tyrant", colors: ['G'], desc: "Mono-green ramp and big creatures: a 5-mana 9/7 commander, mana creatures and fat bodies (EDHREC average deck, cards the game fully reads; not playtested yet)", checked: '2026-10-08', text: "1 Alpine Grizzly\n1 Ancient Brontodon\n1 Arcane Signet\n1 Axebane Beast\n1 Beast Whisperer\n1 Beast Within\n1 Biowaste Blob\n1 Bite Down\n1 Blanchwood Armor\n1 Bonders' Enclave\n1 Colossal Majesty\n1 Cultivate\n1 Cylian Elf\n1 Disciple of Freyalise\n1 Elvish Mystic\n1 Emerald Medallion\n1 Eternal Witness\n1 Explore\n1 Fanatic of Rhonas\n1 Fog\n1 Fyndhorn Elves\n1 Garruk's Gorehorn\n1 Garruk's Uprising\n1 Garruk, Primal Hunter\n1 Ghalta, Primal Hunger\n1 Gigantosaurus\n1 Goreclaw, Terror of Qal Sisma\n1 Harmonize\n1 Heroic Intervention\n1 Hulking Raptor\n1 Jibbirik Omnivore\n1 Kalonian Tusker\n1 Kindercatch\n1 Kodama's Reach\n1 Leatherback Baloth\n1 Llanowar Elves\n1 Nature's Lore\n1 Nettle Swine\n1 Ordinary Bear\n1 Overwhelming Stampede\n1 Pheres-Band Centaurs\n1 Primordial Wurm\n1 Quakestrider Ceratops\n1 Quilled Slagwurm\n1 Ram Through\n1 Rampant Growth\n1 Rancor\n1 Reliquary Tower\n1 Return of the Wildspeaker\n1 Rhonas's Monument\n1 Rishkar's Expertise\n1 Rogue's Passage\n1 Sakura-Tribe Elder\n1 Simulacrum Shaper\n1 Snakeskin Veil\n1 Sol Ring\n1 Soul's Majesty\n1 Spined Karok\n1 Swiftfoot Boots\n1 The Great Henge\n1 Three Visits\n1 Trained Jackal\n1 Traverse the Outlands\n1 Unnatural Growth\n1 Vorstclaw\n1 Wild Growth\n1 Willow Elf\n32 Forest\n\n1 Terrian, World Tyrant\n" },
    { key: 'kalakscion', name: "Kalakscion, Hunger Tyrant", colors: ['B'], desc: "Mono-black Crocodiles and sacrifice: a 7/2 for three, creature recursion and removal (EDHREC average deck, cards the game fully reads; not playtested yet)", checked: '2026-10-08', text: "1 Accursed Marauder\n1 Adorned Crocodile\n1 Arcane Signet\n1 Armor of Shadows\n1 Basilisk Collar\n1 Blackblade Reforged\n1 Blood Pet\n1 Boggart Trawler\n1 Bojuka Bog\n1 Brotherhood Regalia\n1 Burnished Hart\n1 Cabal Coffers\n1 Cabal Stronghold\n1 Cat-Gator\n1 Catacomb Crocodile\n1 Charcoal Diamond\n1 Commander's Plate\n1 Crashing Drawbridge\n1 Crypt Ghast\n1 Dark Ritual\n1 Defile\n1 Demonic Embrace\n1 Disciple of Bolas\n1 Dread Presence\n1 Dross Crocodile\n1 Falthis, Shadowcat Familiar\n1 Feed the Swarm\n1 Fireshrieker\n1 Fleshbag Marauder\n1 Foundry Inspector\n1 Go for the Throat\n1 Gray Merchant of Asphodel\n1 Guul Draz Mucklord\n1 Hagra Crocodile\n1 Haunted Cloak\n1 Infernal Grasp\n1 Jet Medallion\n1 Leaden Myr\n1 Lightning Greaves\n1 Loxodon Warhammer\n1 Malakir Rebirth\n1 Massacre Wurm\n1 Mind Stone\n1 Morbid Opportunist\n1 Myriad Landscape\n1 Night's Whisper\n1 Nightmare Lash\n1 Old Thrush\n1 Ornithopter of Paradise\n1 Phyresis\n1 Phyrexian Arena\n1 Plaguecrafter\n1 Ravenous Chupacabra\n1 Read the Bones\n1 Reanimate\n1 Rogue's Passage\n1 Sign in Blood\n1 Skeletal Crocodile\n1 Skeletal Grimace\n1 Sol Ring\n1 Solemn Simulacrum\n1 Suspicious Bookcase\n1 Swiftfoot Boots\n1 Sword of Vengeance\n1 Tainted Strike\n1 Unearth\n1 Urborg, Tomb of Yawgmoth\n1 Wayfarer's Bauble\n1 Withering Torment\n1 Yargle, Glutton of Urborg\n29 Swamp\n\n1 Kalakscion, Hunger Tyrant\n" },
    { key: 'sundial', name: "Sundial, Dawn Tyrant", colors: ['W'], desc: "Mono-white artifacts: cheap artifact creatures, Myr and equipment around a 2-mana 3/3 commander (EDHREC average deck, cards the game fully reads; not playtested yet)", checked: '2026-10-08', text: "1 All That Glitters\n1 Ancient Den\n1 Angel of the Ruins\n1 Arcane Signet\n1 Austere Command\n1 Buried Ruin\n1 Burnished Hart\n1 Chief of the Foundry\n1 Cloud Key\n1 Cut a Deal\n1 Darksteel Citadel\n1 Darksteel Mutation\n1 Digsite Engineer\n1 Disenchant\n1 Dispatch\n1 Your Temple Is Under Attack\n1 Emeria, the Sky Ruin\n1 Enlightened Tutor\n1 Esper Sentinel\n1 Expedition Envoy\n1 Foundry Inspector\n1 Generous Gift\n1 Ghostly Prison\n1 Glory Seeker\n1 Gold Myr\n1 Guidelight Synergist\n1 Hangarback Walker\n1 Hedron Crawler\n1 Jhoira's Familiar\n1 Junk Diver\n1 Knight of the White Orchid\n1 Land Tax\n1 Loran of the Third Path\n1 Mana Tithe\n1 Manakin\n1 Marble Diamond\n1 Marketback Walker\n1 Memnite\n1 Mind Stone\n1 Myr Retriever\n1 Myriad Landscape\n1 Ornithopter of Paradise\n1 Palladium Myr\n1 Patchwork Automaton\n1 Path to Exile\n1 Pearl Medallion\n1 Platoon Dispenser\n1 Reprieve\n1 Rogue's Passage\n1 Salvation Engine\n1 Scrawling Crawler\n1 Sculpting Steel\n1 Secret Rendezvous\n1 Shambling Suit\n1 Smothering Tithe\n1 Sol Ring\n1 Solemn Simulacrum\n1 Sram, Senior Edificer\n1 Steel Overseer\n1 Stroke of Midnight\n1 Sun Titan\n1 Swiftfoot Boots\n1 Swords to Plowshares\n1 Tempered Steel\n1 Teshar, Ancestor's Apostle\n1 Thought Vessel\n1 Voyager Quickwelder\n1 Walking Ballista\n1 Witch Enchanter\n1 Workshop Assistant\n29 Plains\n\n1 Sundial, Dawn Tyrant\n" },
    { key: 'caelorna', name: "Caelorna, Coral Tyrant", colors: ['U'], desc: "Mono-blue sea creatures and card draw: a 0/8 for two with Octopus, Kraken and Merfolk beef (EDHREC average deck, cards the game fully reads; not playtested yet)", checked: '2026-10-08', text: "1 Academy Ruins\n1 Aegis Turtle\n1 Aetherize\n1 An Offer You Can't Refuse\n1 Ancient Carp\n1 Ancient Crab\n1 Aqueous Form\n1 Arcane Denial\n1 Arcane Signet\n1 Arcanis the Omnipotent\n1 Archaeomancer\n1 Bilbo Baggins, Burglar\n1 Blackblade Reforged\n1 Brainstorm\n1 Burnished Hart\n1 Castle Vantress\n1 Chasm Skulker\n1 Confusticate and Bebother\n1 Coral Eel\n1 Counterspell\n1 Etherium Sculptor\n1 Fabricate\n1 Fellwar Stone\n1 Foundry Inspector\n1 Frantic Search\n1 Giant Octopus\n1 Grappling Kraken\n1 Hero's Heirloom\n1 Hullbreaker Horror\n1 Inkwell Leviathan\n1 Kraken Hatchling\n1 Laboratory Maniac\n1 L\u00f3rien Revealed\n1 Mana Drain\n1 Merfolk of the Pearl Trident\n1 Mesmerizing Benthid\n1 Mind Stone\n1 Mulldrifter\n1 Myriad Landscape\n1 Mystic Remora\n1 Mystic Sanctuary\n1 Nadir Kraken\n1 Negate\n1 Opt\n1 Phyrexian Metamorph\n1 Ponder\n1 Pongify\n1 Preordain\n1 Propaganda\n1 Rapid Hybridization\n1 Ravenhill Flock\n1 Reef Worm\n1 Reliquary Tower\n1 Rogue's Passage\n1 Sapphire Medallion\n1 Shorecomber Crab\n1 Silver Myr\n1 Sky Diamond\n1 Sol Ring\n1 Solemn Simulacrum\n1 Swiftfoot Boots\n1 Sword of the Animist\n1 Thassa, God of the Sea\n1 Thought Vessel\n1 Thranduil's Decree\n1 Wayfarer's Bauble\n1 Windfall\n1 Wonder\n31 Island\n\n1 Caelorna, Coral Tyrant\n" },
];
function verifiedDecksHTML(onclick, pressedKey) {
    return `<div class="opp-grid">${VERIFIED_DECKS.map(v => `<button type="button" class="opp" aria-pressed="${pressedKey === v.key}" onclick="${onclick}('${v.key}')">
        <strong>✅ ${v.colors.map(c => `<span class="pip ${c}"></span>`).join('')} ${esc(v.name)}</strong><small>${esc(v.desc)}</small></button>`).join('')}</div>`;
}
async function makeVerifiedStarter(key) {
    const v = VERIFIED_DECKS.find(x => x.key === key);
    const status = $('starterStatus');
    if (status) status.innerHTML = '<span class="loading">Building the deck from live card data...</span>';
    try {
        const gen = await listToOppDeck(v.text, 'commander');
        const deck = generatedToDeck(gen, `${v.name} (starter)`);
        profile.decks.push(deck);
        saveProfile();
        closeModal();
        toast(`Added "${deck.name}" to your decks.`);
        renderDeckPicker();
        renderPlayView();
    } catch (e) {
        console.error(e);
        if (status) status.innerHTML = `<span class="warn">Couldn't build that deck: ${esc(e.message)}</span>`;
    }
}
async function starterPicker() {
    let cmdOptions = '<option disabled>Loading trending commanders...</option>';
    showModal(`<h2>🎁 Starter decks</h2>
        <p class="note">Ready-made decks to play right away. They don't use your collection.</p>
        <div style="text-align:left; margin-top:12px;"><h3 style="font-size:1rem;">✅ Fully working Commander decks</h3>
            <p class="note" style="margin-bottom:6px;">Every card in these decks is automated and was checked one by one.</p>
            ${verifiedDecksHTML('makeVerifiedStarter', null)}</div>
        <div class="grid-2" style="text-align:left; margin-top:12px;">
            <div><h3 style="font-size:1rem;">Modern (60 cards)</h3>
                <select id="starterTheme" style="width:100%; margin:6px 0;">${MODERN_THEMES.map(t => `<option value="${t.key}">${esc(t.name)} - ${esc(t.desc)}</option>`).join('')}</select>
                <button class="btn primary" onclick="makeStarter('modern')">Build this deck</button></div>
            <div><h3 style="font-size:1rem;">Commander (100 cards)</h3>
                <select id="starterCmd" style="width:100%; margin:6px 0;">${cmdOptions}</select>
                <button class="btn primary" onclick="makeStarter('commander')">Build this deck</button>
                <div class="note" style="margin-top:4px;">This week's trending commanders on EDHREC, with their average deck.</div></div>
        </div>
        <div id="starterStatus" class="note" style="margin-top:10px;"></div>
        <div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
    try {
        const list = await loadTrendingCommanders();
        if ($('starterCmd')) $('starterCmd').innerHTML = list.map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
    } catch (e) {
        if ($('starterCmd')) $('starterCmd').innerHTML = '<option disabled>EDHREC is unavailable right now</option>';
    }
}

async function makeStarter(format) {
    const status = $('starterStatus');
    status.innerHTML = '<span class="loading">Building the deck from live card data...</span>';
    try {
        let deck;
        if (format === 'modern') {
            const theme = MODERN_THEMES.find(t => t.key === $('starterTheme').value);
            deck = generatedToDeck(await buildThemeDeck(theme), `${theme.name} (starter)`);
        } else {
            const slug = $('starterCmd').value;
            const gen = await buildCommanderDeck(slug);
            deck = generatedToDeck(gen, `${gen.name} (starter)`);
        }
        profile.decks.push(deck);
        saveProfile();
        closeModal();
        toast(`Added "${deck.name}" to your decks.`);
        renderDeckPicker();
        renderPlayView();
    } catch (e) {
        console.error(e);
        status.innerHTML = `<span class="warn">Couldn't build that deck: ${esc(e.message)}</span>`;
    }
}

function showModal(html) { $('modalHost').innerHTML = `<div class="modal"><div class="box" role="dialog">${html}</div></div>`; }
function closeModal() { $('modalHost').innerHTML = ''; }

// ---------------------------------------------------------------------
// Play setup
// ---------------------------------------------------------------------
let chosenOpponent = null;
const OPPSEL = { kind: 'all', q: '' };
function oppSel(k, v) { OPPSEL[k] = v; renderOpponents(); }
// Pass and play: your deck and another account's deck on this device
function renderFriendPanel() {
    const others = accounts.list.filter(n => n !== accounts.current);
    $('frMeName').textContent = `${accounts.current}'s deck`;
    $('frMyDeck').innerHTML = profile.decks.length ? profile.decks.map((d, i) => `<option value="${i}">${esc(d.name)} · ${FORMATS[d.format].name}</option>`).join('') : '<option value="">No decks yet</option>';
    const sel = $('frWho'), prev = sel.value;
    sel.innerHTML = others.length ? others.map(n => `<option value="${esc(n)}">Friend: ${esc(n)}</option>`).join('') : '<option value="">Add another player first (👤 menu)</option>';
    if (prev && others.includes(prev)) sel.value = prev;
    renderFriendDecks();
}
function renderFriendDecks() {
    const name = $('frWho').value, prof = name ? store.get(`profile:${name}`, null) : null;
    const decks = (prof && prof.decks) || [];
    $('frTheirDeck').innerHTML = decks.length ? decks.map((d, i) => `<option value="${i}">${esc(d.name)} · ${FORMATS[d.format].name}</option>`).join('') : `<option value="">${name ? `${esc(name)} has no decks yet` : '-'}</option>`;
    $('frStart').disabled = !profile.decks.length || !decks.length;
    $('frNote').textContent = !name ? 'Your friend needs their own player: 👤 → Add player.' : !decks.length ? `Switch to ${name} to build or pick a deck first.` : 'Both Commander decks play Commander; anything else plays Casual (20 life).';
}
async function startFriendMatch() {
    const name = $('frWho').value, prof = store.get(`profile:${name}`, null);
    const mine = profile.decks[$('frMyDeck').value], theirs = prof && prof.decks[$('frTheirDeck').value];
    if (!mine || !theirs) { toast('Pick both decks first.'); return; }
    showModal('<h2>Shuffling up...</h2><p class="loading">Loading both decks...</p>');
    try {
        await cardsByIds([...Object.keys(mine.cards), mine.commander, ...Object.keys(theirs.cards), theirs.commander].filter(Boolean));
        await loadBasics();
        const A = deckToEntries(mine), B = deckToEntries(theirs);
        const fmt = mine.format === 'commander' && theirs.format === 'commander' ? 'commander' : 'casual';
        A.format = B.format = fmt;
        if (fmt !== 'commander') { A.commander = null; B.commander = null; }
        closeModal();
        newGame(A, B, { accounts: [accounts.current, name] });
    } catch (e) {
        console.error(e);
        showModal(`<h2>Couldn't start</h2><p class="warn">${esc(e.message)}</p><div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">OK</button></div>`);
    }
}
// Step 1 of the Play tab: pick a TYPE of deck (Commander, Modern, Casual, Limited), then one of your decks of that type.
// The hidden #playDeck select still holds the choice (value = index in profile.decks), so the rest of the game reads it as before.
const PLAYSEL = { type: null, q: '' };
const DECK_TYPE_ICONS = { commander: '👑', modern: '⚔️', casual: '🎴', limited: '🃏' };
function playPickType(t) { PLAYSEL.type = t; PLAYSEL.q = ''; const first = profile.decks.findIndex(d => d.format === t); if (first >= 0 && profile.decks[$('playDeck').value] && profile.decks[$('playDeck').value].format !== t) $('playDeck').value = String(first); renderPlayView(); }
function playPickDeck(i) { $('playDeck').value = String(i); renderPlayView(); }
function playDeckSearch(v) { PLAYSEL.q = v; renderPlayView(); const el = $('playDeckQ'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }
function renderPlayView() {
    renderFriendPanel();
    const sel = $('playDeck');
    const prev = sel.value;
    sel.innerHTML = profile.decks.map((d, i) => `<option value="${i}">${esc(d.name)} · ${FORMATS[d.format].name}</option>`).join('');
    if (prev !== '' && profile.decks[prev]) sel.value = prev; else if (profile.decks.length) sel.value = '0';
    const cur = profile.decks[sel.value];
    const counts = {}; profile.decks.forEach(d => { counts[d.format] = (counts[d.format] || 0) + 1; });
    const types = ['commander', 'modern', 'casual', 'limited'].filter(k => counts[k]);
    if (!PLAYSEL.type || !counts[PLAYSEL.type]) PLAYSEL.type = cur ? cur.format : types[0] || null;
    if (cur && cur.format !== PLAYSEL.type) { const i = profile.decks.findIndex(d => d.format === PLAYSEL.type); if (i >= 0) sel.value = String(i); }
    const box = $('deckPick');
    if (!profile.decks.length) box.innerHTML = '<p class="note">No decks yet.</p>';
    else {
        const q = PLAYSEL.q.trim().toLowerCase();
        const mine = profile.decks.map((d, i) => [d, i]).filter(([d]) => d.format === PLAYSEL.type && (!q || d.name.toLowerCase().includes(q)));
        const chosen = Number(sel.value);
        box.innerHTML = `<div class="chips" style="margin:0 0 8px;" role="group" aria-label="Deck type">${types.map(k => `<button type="button" class="chip${PLAYSEL.type === k ? ' on' : ''}" aria-pressed="${PLAYSEL.type === k}" onclick="playPickType('${k}')">${DECK_TYPE_ICONS[k] || ''} ${esc(FORMATS[k].name)} (${counts[k]})</button>`).join('')}</div>
            ${counts[PLAYSEL.type] > 6 ? `<input type="search" id="playDeckQ" value="${esc(PLAYSEL.q)}" placeholder="Find one of your ${esc(FORMATS[PLAYSEL.type].name)} decks" aria-label="Find a deck" oninput="playDeckSearch(this.value)" style="width:100%; margin-bottom:8px;">` : ''}
            <div class="opp-grid deck-pick">${mine.map(([d, i]) => { const pr = deckProblems(d); return `<button type="button" class="opp" aria-pressed="${i === chosen}" onclick="playPickDeck(${i})"><strong>${esc(d.name)}</strong><small>${deckCount(d)} cards${pr.length ? ` · ⚠ ${pr.length} to fix` : ' · ✓ ready'}</small></button>`; }).join('') || '<p class="note">No deck matches.</p>'}</div>`;
    }
    $('oppHead').textContent = cur ? `2. Your opponent - ${FORMATS[PLAYSEL.type].name} decks, so it's a fair match` : '2. Your opponent';
    renderOpponents();
}

async function renderOpponents() {
    const deck = profile.decks[$('playDeck').value];
    const list = $('oppList');
    $('startBtn').disabled = !deck;
    if (!deck) {
        $('playDeckNote').innerHTML = '';
        list.innerHTML = '<p class="note">Make a deck first: build one in Collection &amp; Decks, or <button class="btn small gold" onclick="starterPicker()">🎁 get a starter deck</button>.</p>';
        return;
    }
    const probs = deckProblems(deck);
    $('playDeckNote').innerHTML = probs.length ? `<span class="warn">⚠ ${esc(probs[0])}${probs.length > 1 ? ` (+${probs.length - 1} more)` : ''}</span>` : '<span class="ok">✓ Ready</span>';
    const pasted = chosenOpponent && chosenOpponent.type === 'list' ? `<div class="opp-custom"><button type="button" class="opp" aria-pressed="true" onclick="pasteOpponentDialog()"><strong>📋 ${esc(chosenOpponent.name)}</strong><small>Your pasted list${chosenOpponent.gen.swapped ? ` · ${chosenOpponent.gen.swapped} cards swapped for lands` : ''} · tap to change</small></button></div>` : '';
    const pasteBtn = `<button type="button" class="btn small" onclick="pasteOpponentDialog()">📋 Face a pasted decklist (Moxfield)</button>`;
    if (deck.format === 'casual' || deck.format === 'limited') {
        list.innerHTML = '<div class="loading">Loading precons...</div>';
        try {
            const pl = await loadPreconList(); await loadPreconReady(); const nm = await setNames();
            if ($('playDeck').value !== String(profile.decks.indexOf(deck))) return;
            const q = OPPSEL.q.trim().toLowerCase();
            const kinds = PRECON_GROUPS.filter(g => pl.some(p => p.type === g[0] && preconIsReady(p)));
            const shown = pl.filter(p => preconIsReady(p) && (OPPSEL.kind === 'all' || p.type === OPPSEL.kind) && (!q || `${p.name} ${nm[(p.code || '').toUpperCase()] || ''}`.toLowerCase().includes(q)));
            list.innerHTML = `${pasted}<div class="row" style="margin-bottom:10px;">${pasteBtn}</div>
                <p class="note" style="margin-bottom:8px;">Precons the game plays in full, the same kind of ${esc(FORMATS[deck.format].name)} game as yours. Pick a type, then a deck.</p>
                <div class="chips" style="margin:0 0 8px;"><button type="button" class="chip${OPPSEL.kind === 'all' ? ' on' : ''}" onclick="oppSel('kind','all')">All</button>${kinds.map(g => `<button type="button" class="chip${OPPSEL.kind === g[0] ? ' on' : ''}" onclick="oppSel('kind','${g[0]}')">${esc(g[1])}</button>`).join('')}</div>
                <input type="search" id="oppQ" value="${esc(OPPSEL.q)}" placeholder="Find a precon" aria-label="Find a precon" oninput="oppSel('q', this.value)" style="width:100%; margin-bottom:8px;">
                <div class="opp-grid">${shown.map(p => `<button type="button" class="opp" aria-pressed="${chosenOpponent && chosenOpponent.type === 'precon' && chosenOpponent.key === p.file}" onclick="chooseOpponent({ type: 'precon', key: '${esc(p.file)}', name: '${esc(p.name).replace(/'/g, "\\'")}' })"><strong>${esc(p.name)}</strong><small>${esc(nm[(p.code || '').toUpperCase()] || p.code || '')} · ${esc((p.date || '').slice(0, 4))} · ${esc(p.type)}</small></button>`).join('') || '<p class="note">No precon matches.</p>'}</div>`;
            if (OPPSEL.q) { const el = $('oppQ'); if (el) { el.focus(); el.setSelectionRange(OPPSEL.q.length, OPPSEL.q.length); } }
        } catch (e) { list.innerHTML = `${pasted}<p class="warn">${esc(e.message)}</p>`; }
    } else if (deck.format !== 'commander') {
        list.innerHTML = `${pasted}<div class="row" style="margin-bottom:10px;">${pasteBtn}</div><p class="note" style="margin-bottom:8px;">Themed decks built live from Scryfall: the most-played Modern-legal cards for each theme that the game can run (not tournament lists).</p>
            <div class="opp-grid">${MODERN_THEMES.map(t => `<button type="button" class="opp" aria-pressed="${chosenOpponent && chosenOpponent.key === t.key}" onclick="chooseOpponent({ type: 'theme', key: '${t.key}' })">
                <strong>${t.colors.map(c => `<span class="pip ${c}"></span>`).join('')} ${esc(t.name)}</strong><small>${esc(t.desc)}</small></button>`).join('')}</div>`;
    } else {
        list.innerHTML = '<div class="loading">Loading this week\'s trending commanders from EDHREC...</div>';
        try {
            const cmds = await loadTrendingCommanders();
            const custom = chosenOpponent && chosenOpponent.type === 'commander' && !cmds.some(c => c.slug === chosenOpponent.key) ? `<div class="opp-custom"><button type="button" class="opp" aria-pressed="true"><strong>👑 ${esc(chosenOpponent.name || chosenOpponent.key)}</strong><small>EDHREC average deck</small></button></div>` : '';
            list.innerHTML = `${verifiedOppHTML()}<h3 class="opp-h">Face any commander</h3>
                <div class="row" style="margin-bottom:6px;"><input type="search" id="cmdFind" list="cmdSuggest" placeholder="Type a commander's name" aria-label="Commander to face" oninput="suggestCommanders(this.value)" onkeydown="if (event.key === 'Enter') faceCommander()" style="flex:1 1 220px;"><datalist id="cmdSuggest"></datalist>
                <button class="btn" onclick="faceCommander()">👑 Face this commander</button>${pasteBtn}</div>
                <div class="note" id="cmdFindNote" style="margin-bottom:8px;">Any commander EDHREC has decks for, playing its average deck. Or paste a real list.</div>
                ${custom}${pasted}
                <h3 class="opp-h">Trending this week</h3>
                <p class="note" style="margin-bottom:8px;">This week's trending commanders on EDHREC, each playing its EDHREC average deck (cards the game can't run yet are swapped for basic lands).</p>
                <div class="opp-grid">${cmds.map(c => `<button type="button" class="opp" aria-pressed="${chosenOpponent && chosenOpponent.key === c.slug}" onclick="chooseOpponent({ type: 'commander', key: '${esc(c.slug)}' })">
                    <strong>👑 ${esc(c.name)}</strong><small>${c.decks ? `${c.decks.toLocaleString()} decks on EDHREC` : ''}</small></button>`).join('')}</div>`;
        } catch (e) {
            list.innerHTML = `${verifiedOppHTML()}<p class="warn">EDHREC is unavailable right now, so its commanders aren't listed. Try again later.</p>`;
        }
    }
    const oppIsCmd = chosenOpponent && (chosenOpponent.type === 'commander' || chosenOpponent.type === 'verified' || (chosenOpponent.type === 'list' && chosenOpponent.gen.format === 'commander'));
    if (chosenOpponent && (deck.format === 'commander') !== !!oppIsCmd) chosenOpponent = null;
    if (chosenOpponent && ((chosenOpponent.type === 'precon') !== (deck.format === 'casual' || deck.format === 'limited') && chosenOpponent.type !== 'list')) chosenOpponent = null;
    if (chosenOpponent && chosenOpponent.type === 'theme' && deck.format !== 'modern') chosenOpponent = null;
    $('startNote').textContent = chosenOpponent ? '' : 'Pick an opponent.';
}
function verifiedOppHTML() {
    return `<h3 class="opp-h">✅ Fully working decks</h3><p class="note" style="margin-bottom:8px;">Every card in these decks is automated and was checked one by one.</p>${verifiedDecksHTML('chooseVerifiedOpp', chosenOpponent && chosenOpponent.type === 'verified' ? chosenOpponent.key : null)}`;
}
function chooseVerifiedOpp(key) { chooseOpponent({ type: 'verified', key, name: VERIFIED_DECKS.find(v => v.key === key).name }); }
function chooseOpponent(o) {
    chosenOpponent = o;
    renderOpponents();
}

