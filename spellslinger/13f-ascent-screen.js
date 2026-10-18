// Planeswalker's Ascent, the screen (Campaign tab). Tabs: Map, Packs, Collection (craft / upgrade / dust), Decks.
// The old ladder and Precon Circuit still exist underneath, folded away in "Old ladder" until the owner says they can go.
const ASC = { tab: 'map', opp: null, deck: 0, q: '', type: 'all', color: 'all', rar: 'all', owned: true, page: 0, pack: null, dq: '', dtype: 'all', dcolor: 'all' };
const ASC_COLORS = { W: ['⚪', 'White'], U: ['🔵', 'Blue'], B: ['⚫', 'Black'], R: ['🔴', 'Red'], G: ['🟢', 'Green'] };
const ASC_PAGE = 36;
const ascPips = cols => (cols || '').split('').map(c => ASC_COLORS[c] ? ASC_COLORS[c][0] : '').join('') || '◇';
const ascRarityClass = r => `asc-r-${r}`;

async function renderAscent() {
    const host = $('ascentApp');
    if (!host) return;
    try { await loadAscentRoster(); } catch (e) { host.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    ascentSignatures();
    ascProbeArt();
    const st = ascentState();
    const ids = Object.keys(st.owned).filter(id => ASCENT.byId.has(id) && !CARDS.has(id));
    if (ids.length) cardsByIds(ids).then(() => { if (ASC.tab !== 'map') renderAscent(); }).catch(() => {});
    const sealed = st.sealed || { play: 0, collector: 0 }, cards = Object.values(st.owned).reduce((a, o) => a + (o.c ? o.c.length : 0), 0);
    host.innerHTML = `
        <div class="pos">
            <div class="pos-title"><h2>🌌 Planeswalker's Ascent</h2><span class="note">Climb three leagues with a slow, simple card pool. Your own collection, decks and Aether.</span></div>
            <div class="pos-stats">
                <div><span class="pos-k">Aether</span><strong>✨ ${st.aether.toLocaleString()}</strong></div>
                <div><span class="pos-k">Packs to open</span><strong>📦 ${sealed.play + sealed.collector}</strong></div>
                <div><span class="pos-k">Opponents beaten</span><strong>${st.progress.length} / ${ASCENT_OPPONENTS.length}</strong></div>
                <div><span class="pos-k">Cards owned</span><strong>${cards}</strong></div>
            </div>
            <label class="note asc-fxtoggle"><input type="checkbox" ${ascFxPref() ? 'checked' : ''} onchange="ascFxSet(this.checked)"> Play pixel-art effects in games</label>
            <div class="tabs" role="tablist">${[['map', '🗺️ Map'], ['packs', '📦 Packs'], ['coll', '🃏 Collection'], ['decks', '🛠️ Decks']].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${ASC.tab === k}" onclick="ascTab('${k}')">${l}</button>`).join('')}</div>
            <div id="ascBody"></div>
        </div>`;
    ({ map: ascMap, packs: ascPacks, coll: ascColl, decks: ascDecks })[ASC.tab]();
}
function ascTab(t) { ASC.tab = t; ASC.page = 0; renderAscent(); }

// A helper character who talks on each tab (placeholder art until the sprite files exist)
const ASC_NPC = { map: 'npc-guide', packs: 'npc-packmaster', coll: 'npc-smith', decks: 'npc-deckwright' };
function ascNpcHTML(tab) {
    const id = ASC_NPC[tab], seed = ascentState().progress.length + (ascentState().packs || 0);
    return id ? `<div class="asc-npc">${ascSpeechHTML(id, 'intro', seed)}<p class="note asc-tipline">💡 ${esc(ascLine(id, 'tip', 0))}</p></div>` : '';
}

// ---------- Map ----------
function ascMap() {
    const st = ascentState(), body = $('ascBody');
    if (!st.started) {
        body.innerHTML = `<div class="asc-start"><h3>Choose your starter deck</h3>
            <p class="note">One color, 40 cards of simple creatures, plus 3 Play Boosters to open. You can only choose once, but every color is open to you later through packs and crafting.</p>
            <div class="asc-colors">${Object.entries(ASC_COLORS).map(([c, [e, n]]) => `<button class="btn" onclick="ascChooseStarter('${c}')"><span class="asc-big">${e}</span> ${n}</button>`).join('')}</div></div>`;
        return;
    }
    body.innerHTML = ascNpcHTML('map') + ASCENT_TIERS.map(t => {
        const open = ascentTierOpen(t.tier), opps = ASCENT_OPPONENTS.filter(o => o.tier === t.tier);
        return `<div class="tier-band tier-${t.tier}${open ? '' : ' locked'}">
            <div class="tier-head"><span class="tier-icon" aria-hidden="true">${t.icon}</span><div><strong>Tier ${t.tier}: ${esc(t.name)}</strong>
                <div class="note">${esc(t.desc)}${open ? '' : ` 🔒 Beat the boss of ${esc(ASCENT_TIERS[t.tier - 2].name)} to open it.`}</div></div></div>
            <div class="trail">${opps.map((o, i) => {
                const beaten = ascentBeaten(o.id), unlocked = ascentOpponentOpen(o);
                return `<button type="button" class="trail-node${beaten ? ' beaten' : ''}${ASC.opp === o.id ? ' sel' : ''}${o.boss ? ' boss' : ''}" ${open ? '' : 'disabled'} onclick="ascSelectOpp('${o.id}')" aria-pressed="${ASC.opp === o.id}">
                    <span class="dot" aria-hidden="true">${beaten ? '✓' : o.boss ? '👑' : i + 1}</span><span class="lbl">${esc(o.name)}${!unlocked && open ? ' 🔒' : ''}</span></button>`;
            }).join('<span class="trail-line" aria-hidden="true"></span>')}</div></div>`;
    }).join('') + '<div id="ascOpp"></div>';
    if (ASC.opp) ascOppPanel();
}
async function ascChooseStarter(c) {
    const deck = ascentStarter(c);
    if (deck) { saveProfile(); toast('Starter deck added. Open your 3 packs on the Packs tab!'); }
    ASC.tab = 'packs'; renderAscent();
}
function ascSelectOpp(id) { ASC.opp = id; ascMap(); }
async function ascOppPanel() {
    const o = ASCENT_OPP[ASC.opp], st = ascentState(), box = $('ascOpp');
    if (!o || !box) return;
    const sigs = ascentSignatures()[o.id], t = ASCENT_TIERS[o.tier - 1], open = ascentOpponentOpen(o);
    await cardsByIds(sigs).catch(() => {});
    const archName = { stomp: 'Big creatures', weenie: 'Small fast creatures', fliers: 'Fliers', value: 'Deathtouch and life gain', burn: 'Burn and haste', control: 'Removal and walls', tempo: 'Bounce and evasion' }[o.arch];
    box.innerHTML = `<div class="pos asc-opp"><div class="pos-title"><h3>${o.boss ? '👑 ' : ''}${esc(o.name)}</h3><span class="note">${ascPips(o.colors)} · ${esc(archName)} · ${t.level} AI</span></div>
        ${ascSpeechHTML(o.id, 'intro', st.progress.length)}
        <p>${esc(o.blurb)}</p>
        <p class="note">💡 ${esc(ASCENT_CHAR[o.id].lines.tip)}</p>
        <p class="note">Prize for a win: ${o.boss ? '2 Play Boosters and a Collector Booster' : 'a Play Booster'}. ${ascentBeaten(o.id) ? 'Beaten before.' : 'First win guarantees a signature card.'} Later wins drop a signature card ${Math.round(ASCENT_PRIZE.sigRepeatChance * 100)}% of the time. A loss pays ${ASCENT_PRIZE.lossAether} Aether.</p>
        <h4>Signature cards (only this opponent drops them)</h4>
        <div class="asc-grid">${sigs.map(id => ascTile(id, { sig: true })).join('')}</div>
        <div class="row" style="margin-top:12px;"><select id="ascDeckPick" aria-label="Your deck">${st.decks.map((d, i) => `<option value="${i}" ${i === ASC.deck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
            <button class="btn primary" onclick="ascPlay('${o.id}')" ${open ? '' : 'disabled'}>⚔️ Battle ${esc(o.name)}</button>
            ${open ? '' : `<span class="note">${o.boss ? 'Beat the other five of this league first.' : 'Locked.'}</span>`}</div></div>`;
}
async function ascPlay(oppId) {
    ASC.deck = Number($('ascDeckPick').value) || 0;
    const o = ASCENT_OPP[oppId];
    showModal(`<h2>${esc(o.name)}</h2>${ascSpeechHTML(oppId, 'intro', Math.floor(Math.random() * 8))}
        <div class="actions"><button class="btn primary" onclick="ascGo('${oppId}')">⚔️ Let's play</button><button class="btn" onclick="closeModal()">Not yet</button></div>`);
}
async function ascGo(oppId) {
    showModal('<h2>Shuffling up...</h2><p class="loading">Loading both decks...</p>');
    try { await startAscentMatch(oppId, ASC.deck); closeModal(); }
    catch (e) { closeModal(); toast(e.message || 'Could not start the game.'); }
}

// ---------- Cards ----------
function ascOwnedN(id) { const o = ascentState().owned[id]; return o ? o.n : 0; }
function ascTile(id, opts = {}) {
    const r = ASCENT.byId.get(id), c = CARDS.get(id), n = ascOwnedN(id);
    const up = (ascentState().owned[id] && ascentState().owned[id].c || []).reduce((a, x) => a + x.u.length, 0);
    const img = c && (c.imgS || c.img);
    return `<button type="button" class="asc-tile ${ascRarityClass(r.rarity)}${n ? '' : ' unowned'}" onclick="ascCardDialog('${id}')" title="${esc(r.name)}">
        ${img ? `<img src="${img}" alt="${esc(r.name)}" loading="lazy">` : `<span class="asc-noimg"><strong>${esc(r.name)}</strong><small>${esc(r.cost)}</small><small>${esc(r.pt || r.kind)}</small></span>`}
        <span class="asc-badge">${r.type === 'land' ? '' : `${n}/${ASCENT_COPY_LIMIT}`}${up ? ` ✦${up}` : ''}${opts.sig ? ' ⭐' : ''}</span></button>`;
}
function ascFiltered() {
    let list = ASCENT.roster.filter(c => c.kind !== 'basic');
    if (ASC.owned) list = list.filter(c => ascOwnedN(c.id) > 0);
    if (ASC.type !== 'all') list = list.filter(c => ASC.type === 'land' ? c.type === 'land' : c.type === ASC.type);
    if (ASC.color !== 'all') list = list.filter(c => ASC.color === 'C' ? !c.colors : c.colors.includes(ASC.color));
    if (ASC.rar !== 'all') list = list.filter(c => c.rarity === ASC.rar);
    if (ASC.q) list = list.filter(c => c.name.toLowerCase().includes(ASC.q.toLowerCase()));
    const ro = { mythic: 0, rare: 1, uncommon: 2, common: 3, basic: 4 };
    return list.sort((a, b) => ro[a.rarity] - ro[b.rarity] || a.name.localeCompare(b.name));
}
function ascFilterBar(prefix = '') {
    const sel = (key, opts) => `<select onchange="ASC.${key}=this.value; ASC.page=0; ascRefresh()" aria-label="${key}">${opts.map(([v, l]) => `<option value="${v}" ${ASC[key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    return `<div class="row asc-filters"><input type="search" placeholder="Search by name" value="${esc(ASC.q)}" oninput="ASC.q=this.value; ASC.page=0; ascRefresh()" aria-label="Search">
        ${sel('type', [['all', 'All types'], ['creature', 'Creatures'], ['spell', 'Spells'], ['land', 'Lands']])}
        ${sel('color', [['all', 'All colors'], ...Object.entries(ASC_COLORS).map(([c, [e, n]]) => [c, `${e} ${n}`]), ['C', '◇ Colorless']])}
        ${sel('rar', [['all', 'All rarities'], ['mythic', 'Mythic'], ['rare', 'Rare'], ['uncommon', 'Uncommon'], ['common', 'Common']])}
        <label class="note"><input type="checkbox" ${ASC.owned ? 'checked' : ''} onchange="ASC.owned=this.checked; ASC.page=0; ascRefresh()"> Only cards I own</label></div>`;
}
function ascRefresh() { if (ASC.tab === 'coll') ascColl(true); }
async function ascColl(keepFocus) {
    const body = $('ascBody'), list = ascFiltered(), pages = Math.max(1, Math.ceil(list.length / ASC_PAGE));
    ASC.page = Math.min(ASC.page, pages - 1);
    const shown = list.slice(ASC.page * ASC_PAGE, (ASC.page + 1) * ASC_PAGE);
    const need = shown.map(c => c.id).filter(id => !CARDS.has(id));
    const draw = () => {
        const focus = keepFocus && document.activeElement && document.activeElement.type === 'search';
        body.innerHTML = `${ascNpcHTML('coll')}${ascFilterBar()}<p class="note">${list.length} cards. ✦ = upgrades on your copies, ⭐ = a signature card. Tap a card to craft, upgrade or dust.</p>
            <div class="asc-grid">${shown.map(c => ascTile(c.id)).join('') || '<p class="note">No cards match.</p>'}</div>
            <div class="row" style="justify-content:center;margin-top:10px;"><button class="btn small" ${ASC.page ? '' : 'disabled'} onclick="ASC.page--; ascColl()">◀</button><span class="note">Page ${ASC.page + 1} of ${pages}</span><button class="btn small" ${ASC.page < pages - 1 ? '' : 'disabled'} onclick="ASC.page++; ascColl()">▶</button></div>`;
        if (focus) { const el = body.querySelector('input[type=search]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    };
    draw();
    if (need.length) cardsByIds(need).then(() => { if (ASC.tab === 'coll') draw(); }).catch(() => {});
}

// ---------- One card: copies, upgrades, crafting, dusting ----------
function ascUpChips(copy) { return copy.u.map(u => `<span class="asc-up" title="${esc(ASCENT_UPGRADES[u].label)}">${ASCENT_UPGRADES[u].icon} ${esc(ASCENT_UPGRADES[u].label)}</span>`).join('') || '<span class="note">no upgrades</span>'; }
function ascCardDialog(id) {
    const r = ASCENT.byId.get(id), st = ascentState(), o = st.owned[id], c = CARDS.get(id), copies = (o && o.c) || [];
    const inDecks = ascentKeysInDecks(), sigOwner = ascentOwnerOf(id);
    const craftable = r.type !== 'land' && copies.length < ASCENT_COPY_LIMIT;
    showModal(`<h2>${esc(r.name)}</h2>
        <div class="asc-dlg"><div>${c && c.img ? `<img src="${c.img}" alt="${esc(r.name)}" class="asc-big-img">` : `<div class="asc-noimg big"><strong>${esc(r.name)}</strong><small>${esc(r.cost)}</small></div>`}</div>
        <div><p class="note">${esc(r.type)}${r.pt ? ' · ' + r.pt : ''} · ${esc(r.rarity)} · tier ${r.tier}${sigOwner ? ` · ⭐ dropped by ${esc(ASCENT_OPP[sigOwner].name)}` : ''}</p>
        ${c ? `<div class="otext">${esc(c.text || '(no text)')}</div>` : ''}
        ${r.type === 'land' ? '<p class="note">Lands come from packs. Basics are free.</p>' : `
        <h4>Your copies (${copies.length}/${ASCENT_COPY_LIMIT})</h4>
        ${copies.length ? copies.map(x => `<div class="asc-copy"><span>${x.f ? '✨ ' : ''}Copy ${x.k}${inDecks.has(x.k) ? ' · in a deck' : ''}</span><span class="asc-ups">${ascUpChips(x)}</span>
            <span class="asc-copy-btns"><button class="btn small" onclick="ascUpgradeDialog(${x.k})">✦ Upgrades</button>${!inDecks.has(x.k) ? `<button class="btn small" onclick="ascDust('${id}', ${x.k})">Dust</button>` : ''}</span></div>`).join('') : '<p class="note">You do not own this card yet.</p>'}
        <div class="row" style="margin-top:10px;"><button class="btn gold small" ${craftable && st.aether >= ascentCraftCost(r) ? '' : 'disabled'} onclick="ascCraft('${id}', false)">Craft · ✨ ${ascentCraftCost(r)}</button>
            <button class="btn small" ${craftable && st.aether >= ascentCraftCost(r, true) ? '' : 'disabled'} onclick="ascCraft('${id}', true)">Craft foil · ✨ ${ascentCraftCost(r, true)}</button></div>
        <p class="note">Dust gives ✨ ${ASCENT_DUST[r.rarity]} (foil double). You have ✨ ${st.aether}.</p>`}</div></div>
        <div class="actions"><button class="btn" onclick="closeModal()">Close</button></div>`);
}
function ascCraft(id, foil) { const res = craftAscentCard(id, foil); if (!res.ok) toast(res.why); else { saveProfile(); toast('Crafted!'); } ascCardDialog(id); renderAscent(); }
function ascDust(id, key) { const res = dustAscentCard(id, 1, [key]); if (!res.ok) toast(res.why); else { saveProfile(); toast(`+${res.aether} Aether`); } ascCardDialog(id); renderAscent(); }
function ascUpgradeDialog(key) {
    const f = ascentFindCopy(key), st = ascentState();
    if (!f) return;
    const slots = ascentUpgradeSlots(f.card), spare = ascentSacrificeCandidates(f);
    const rows = Object.entries(ASCENT_UPGRADES).filter(([, u]) => u.on === f.card.type).map(([id, u]) => {
        const why = ascentUpgradeBlocked(f, id), cost = ascentUpgradeCost(id, f.card);
        return `<div class="asc-uprow${why ? ' blocked' : ''}"><span>${u.icon} <strong>${esc(u.label)}</strong> <small class="note">${u.kind}</small></span>
            <span>${why ? `<small class="note">${esc(why)}</small>` : `<button class="btn small" onclick="ascBuyUpgrade(${key}, '${id}')">✨ ${cost}</button>`}</span></div>`;
    }).join('');
    showModal(`<h2>${esc(f.card.name)} · copy ${key}</h2>
        <p class="note">${f.copy.u.length} of ${slots} slots used. ✨ ${st.aether} Aether.</p>
        <h4>On this copy</h4>${f.copy.u.map((u, i) => `<div class="asc-uprow"><span>${ASCENT_UPGRADES[u].icon} ${esc(ASCENT_UPGRADES[u].label)}</span><button class="btn small" onclick="ascRemoveUpgrade(${key}, ${i})" title="Costs a quarter of its price">Remove · ✨ ${Math.max(5, Math.round(ascentUpgradeCost(u, f.card) * ASCENT_SWAP_FEE / 5) * 5)}</button></div>`).join('') || '<p class="note">None yet.</p>'}
        <h4>Add an upgrade</h4>
        ${spare.length ? `<label class="note"><input type="checkbox" id="ascFeed"> Feed in ${Math.min(spare.length, 4)} spare plain cop${spare.length === 1 ? 'y' : 'ies'} of this card (each covers ✨ ${ascentSacrificeValue(f.card, spare[0])})</label>` : '<p class="note">Spare plain copies of this card can cover part of the price.</p>'}
        <div class="asc-uplist">${rows}</div>
        <p class="note">To swap, remove the old upgrade first (a quarter of its price), then add the new one.</p>
        <div class="actions"><button class="btn" onclick="ascCardDialog('${f.id}')">Back</button></div>`);
}
function ascBuyUpgrade(key, upId) {
    const f = ascentFindCopy(key), feed = $('ascFeed') && $('ascFeed').checked ? ascentSacrificeCandidates(f).slice(0, 4).map(x => x.k) : [];
    // feed in only as many copies as the price needs
    let needed = [], price = ascentUpgradeCost(upId, f.card), cover = 0;
    for (const k of feed) { if (cover >= price) break; needed.push(k); cover += ascentSacrificeValue(f.card, f.o.c.find(x => x.k === k)); }
    const res = upgradeAscentCopy(key, upId, needed);
    toast(res.ok ? `Upgraded! ${res.aether ? `✨ ${res.aether} spent` : 'Paid with spare copies'}` : res.why);
    if (res.ok) saveProfile();
    ascUpgradeDialog(key); renderAscent();
}
function ascRemoveUpgrade(key, slot) { const res = swapAscentUpgrade(key, slot, null); toast(res.ok ? 'Removed.' : res.why); if (res.ok) saveProfile(); ascUpgradeDialog(key); renderAscent(); }

// ---------- Packs ----------
function ascPacks() {
    const st = ascentState(), s = st.sealed || { play: 0, collector: 0 }, body = $('ascBody');
    body.innerHTML = ascNpcHTML('packs') + `<div class="row"><button class="btn primary" ${s.play ? '' : 'disabled'} onclick="ascOpenPack('play')">📦 Open a Play Booster (${s.play})</button>
        <button class="btn gold" ${s.collector ? '' : 'disabled'} onclick="ascOpenPack('collector')">🌟 Open a Collector Booster (${s.collector})</button></div>
        <p class="note">Win matches for Play Boosters; bosses also give a Collector Booster (all foils, 5+ rares). The 5th copy of any card turns into Aether.</p>
        <div id="ascReveal">${ASC.pack ? ascRevealHTML(ASC.pack) : '<p class="note">Nothing opened yet.</p>'}</div>`;
}
async function ascOpenPack(kind) {
    const st = ascentState();
    if (!st.sealed || !st.sealed[kind]) return;
    st.sealed[kind]--;
    const res = openAscentPack(kind);
    await cardsByIds(res.picks.map(p => p.id)).catch(() => {});
    ASC.pack = { ...res, flipped: new Set() };
    saveProfile(); renderAscent();
}
function ascRevealHTML(pk) {
    const dust = new Set(pk.report.dusted.map(p => p.slot + ':' + p.id));
    return `<div class="asc-pack">${pk.picks.map((p, i) => {
        const r = ASCENT.byId.get(p.id), c = CARDS.get(p.id), up = pk.flipped.has(i), img = c && (c.imgS || c.img), d = dust.has(p.slot + ':' + p.id);
        return `<button type="button" class="asc-flip${up ? ' up' : ''} ${ascRarityClass(r.rarity)}${p.foil ? ' foil' : ''}" onclick="ascFlip(${i})" aria-label="${up ? esc(r.name) : 'Hidden card'}">
            ${up ? `${img ? `<img src="${img}" alt="${esc(r.name)}">` : `<span class="asc-noimg"><strong>${esc(r.name)}</strong><small>${esc(r.cost)}</small></span>`}<span class="asc-badge">${p.foil ? '✨ ' : ''}${esc(r.rarity)}${d ? ' · dusted' : ''}</span>` : '<span class="asc-back">?</span>'}</button>`;
    }).join('')}</div>
    <div class="row" style="margin-top:10px;"><button class="btn" onclick="ascFlipAll()">Flip all</button>${pk.report.aether ? `<span class="ok">✨ +${pk.report.aether} Aether from extra copies</span>` : ''}</div>`;
}
function ascFlip(i) { ASC.pack.flipped.add(i); $('ascReveal').innerHTML = ascRevealHTML(ASC.pack); }
function ascFlipAll() { ASC.pack.picks.forEach((_, i) => ASC.pack.flipped.add(i)); $('ascReveal').innerHTML = ascRevealHTML(ASC.pack); }

// ---------- Decks ----------
function ascDecks() {
    const st = ascentState(), body = $('ascBody');
    if (!st.decks.length) { body.innerHTML = '<p class="note">Choose a starter deck on the Map tab first.</p>'; return; }
    ASC.deck = Math.min(ASC.deck, st.decks.length - 1);
    const deck = ascentNormalizeDeck(st.decks[ASC.deck]), problems = ascentDeckProblems(deck);
    const total = Object.values(deck.cards).reduce((a, b) => a + b, 0);
    const entries = Object.entries(deck.cards).map(([id, n]) => [ASCENT.byId.get(id), id, n]).filter(([r]) => r)
        .sort((a, b) => (a[0].type === 'land') - (b[0].type === 'land') || a[0].cmc - b[0].cmc || a[0].name.localeCompare(b[0].name));
    const basics = ASCENT.roster.filter(c => c.kind === 'basic');
    body.innerHTML = `${ascNpcHTML('decks')}<div class="row"><select aria-label="Deck" onchange="ASC.deck=Number(this.value); ascDecks()">${st.decks.map((d, i) => `<option value="${i}" ${i === ASC.deck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <button class="btn small" onclick="ascNewDeck()">＋ New deck</button><button class="btn small" onclick="ascRenameDeck()">Rename</button><button class="btn small" ${st.decks.length > 1 ? '' : 'disabled'} onclick="ascDeleteDeck()">Delete</button></div>
        <div class="asc-deckhead"><strong>${total} / ${ASCENT_DECK_SIZE}+</strong> cards ${problems.length ? `<span class="warn">${esc(problems[0])}</span>` : '<span class="ok">✔ Ready to play</span>'}</div>
        <div class="asc-twocol"><div class="asc-decklist"><h4>In this deck</h4>
            ${entries.map(([r, id, n]) => `<div class="asc-row ${ascRarityClass(r.rarity)}"><span><strong>${n}×</strong> ${esc(r.name)} <small class="note">${esc(r.cost)}</small></span>
                <span class="asc-row-ups">${(deck.sel[id] || []).map(k => { const f = ascentFindCopy(k); return f && f.copy.u.length ? `<small title="${esc(f.copy.u.map(u => ASCENT_UPGRADES[u].label).join(', '))}">✦${f.copy.u.length}</small>` : ''; }).join('')}</span>
                ${r.kind === 'basic' ? `<span><button class="btn small" onclick="ascBasic('${id}', -1)">−</button><button class="btn small" onclick="ascBasic('${id}', 1)">＋</button></span>` : `<button class="btn small" onclick="ascDropCard('${id}')">Remove</button>`}</div>`).join('') || '<p class="note">Empty.</p>'}
            <div class="row" style="margin-top:8px;">${basics.map(b => `<button class="btn small" onclick="ascBasic('${b.id}', 1)">＋ ${ASC_COLORS[{ Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' }[b.name]][0]} ${esc(b.name)}</button>`).join('')}</div></div>
          <div class="asc-pool"><h4>Your cards</h4>
            <div class="row asc-filters"><input type="search" placeholder="Search" value="${esc(ASC.dq)}" oninput="ASC.dq=this.value; ascPoolDraw()" aria-label="Search your cards">
              <select onchange="ASC.dtype=this.value; ascPoolDraw()" aria-label="Type">${[['all', 'All'], ['creature', 'Creatures'], ['spell', 'Spells'], ['land', 'Lands']].map(([v, l]) => `<option value="${v}" ${ASC.dtype === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <select onchange="ASC.dcolor=this.value; ascPoolDraw()" aria-label="Color">${[['all', 'All colors'], ...Object.entries(ASC_COLORS).map(([c, [e, n]]) => [c, `${e} ${n}`]), ['C', '◇ Colorless']].map(([v, l]) => `<option value="${v}" ${ASC.dcolor === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div id="ascPool"></div></div></div>`;
    ascPoolDraw();
}
function ascPoolDraw() {
    const st = ascentState(), deck = st.decks[ASC.deck], box = $('ascPool');
    if (!box) return;
    let list = ASCENT.roster.filter(c => c.kind !== 'basic' && ascOwnedN(c.id) > 0);
    if (ASC.dtype !== 'all') list = list.filter(c => c.type === ASC.dtype);
    if (ASC.dcolor !== 'all') list = list.filter(c => ASC.dcolor === 'C' ? !c.colors : c.colors.includes(ASC.dcolor));
    if (ASC.dq) list = list.filter(c => c.name.toLowerCase().includes(ASC.dq.toLowerCase()));
    list.sort((a, b) => (a.type === 'land') - (b.type === 'land') || a.cmc - b.cmc || a.name.localeCompare(b.name));
    box.innerHTML = list.slice(0, 60).map(r => {
        const o = st.owned[r.id];
        return `<div class="asc-row ${ascRarityClass(r.rarity)}"><span>${esc(r.name)} <small class="note">${esc(r.cost)} ${esc(r.pt || '')}</small></span>
            <span class="asc-copies">${o.c.map(x => { const on = (deck.sel[r.id] || []).includes(x.k); return `<button type="button" class="asc-chip${on ? ' on' : ''}" onclick="ascToggleCopy(${x.k})" title="${esc(x.u.map(u => ASCENT_UPGRADES[u].label).join(', ') || 'plain copy')}">${x.f ? '✨' : ''}${x.u.length ? '✦' + x.u.length : '·'}</button>`; }).join('')}</span></div>`;
    }).join('') + (list.length > 60 ? `<p class="note">Showing 60 of ${list.length}. Use the search.</p>` : '') || '<p class="note">No cards match.</p>';
}
function ascToggleCopy(key) {
    const f = ascentFindCopy(key), deck = ascentNormalizeDeck(ascentState().decks[ASC.deck]);
    if (!f) return;
    const sel = deck.sel[f.id] || (deck.sel[f.id] = []), at = sel.indexOf(key);
    if (at >= 0) { sel.splice(at, 1); deck.cards[f.id]--; if (deck.cards[f.id] <= 0) { delete deck.cards[f.id]; delete deck.sel[f.id]; } }
    else if (sel.length < ASCENT_COPY_LIMIT) { sel.push(key); deck.cards[f.id] = sel.length; }
    saveProfile(); ascDecks();
}
function ascDropCard(id) { const d = ascentState().decks[ASC.deck]; delete d.cards[id]; if (d.sel) delete d.sel[id]; saveProfile(); ascDecks(); }
function ascBasic(id, delta) { const d = ascentState().decks[ASC.deck]; d.cards[id] = Math.max(0, (d.cards[id] || 0) + delta); if (!d.cards[id]) delete d.cards[id]; saveProfile(); ascDecks(); }
function ascNewDeck() { const st = ascentState(); st.decks.push({ name: `Deck ${st.decks.length + 1}`, cards: {}, sel: {} }); ASC.deck = st.decks.length - 1; saveProfile(); ascDecks(); }
function ascRenameDeck() { const d = ascentState().decks[ASC.deck], n = prompt('Deck name', d.name); if (n && n.trim()) { d.name = n.trim().slice(0, 40); saveProfile(); ascDecks(); } }
function ascDeleteDeck() { const st = ascentState(); if (st.decks.length > 1 && confirm('Delete this deck? Your cards stay yours.')) { st.decks.splice(ASC.deck, 1); ASC.deck = 0; saveProfile(); ascDecks(); } }
