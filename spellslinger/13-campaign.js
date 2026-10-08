// =====================================================================
// Precons, the campaign ladder and deck analytics (shop phase 3,
// 2026-10-05). Real preconstructed decks come from MTGJSON's deck files
// (DeckList.json, decks/<file>.json); the campaign uses them for Kitchen
// Table and FNM opponents and the personalities as Regional bosses.
// =====================================================================
const PRECON_TYPES = {
    'Welcome Deck': 'Welcome Decks (30 cards, for brand-new players)',
    'Starter Kit': 'Starter Kits (60 cards)',
    'Arena Starter Kit': 'Arena Starter Kits (60 cards)',
    'Planeswalker Deck': 'Planeswalker Decks (60 cards)',
    'Challenger Deck': 'Challenger Decks (60 cards, tournament-ready)',
    'Pioneer Challenger Deck': 'Pioneer Challenger Decks (60 cards)',
    'Intro Pack': 'Intro Packs (about 60 cards)',
    'Theme Deck': 'Theme Decks (classic, 40-60 cards)',
    'Starter Deck': 'Starter Decks (1990s)'
};
let preconList = store.get('precons', null);
async function loadPreconList() {
    if (preconList && preconList.list && preconList.list.length && Date.now() - preconList.fetched < 7 * 864e5) return preconList.list;
    const res = await fetch(`${MTGJSON}/DeckList.json`);
    if (!res.ok) throw new Error(`MTGJSON's deck list didn't load (${res.status})`);
    const data = (await res.json()).data;
    const list = data.filter(d => PRECON_TYPES[d.type]).map(d => ({ file: d.fileName, name: d.name, code: d.code, type: d.type, date: d.releaseDate }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    preconList = { fetched: Date.now(), list };
    store.set('precons', preconList);
    return list;
}
const preconCache = {};
// A precon's main deck as game entries (casual format: 30+ cards)
async function loadPreconDeck(p) {
    if (!preconCache[p.file]) {
        preconCache[p.file] = (async () => {
            const res = await fetch(`${MTGJSON}/decks/${encodeURIComponent(p.file)}.json`);
            if (!res.ok) throw new Error(`Couldn't load ${p.name} (${res.status})`);
            const d = (await res.json()).data;
            const counts = {};
            (d.mainBoard || []).forEach(c => { const id = c.identifiers && c.identifiers.scryfallId; if (id) counts[id] = (counts[id] || 0) + c.count; });
            await cardsByIds(Object.keys(counts));
            const entries = Object.entries(counts).map(([id, n]) => ({ card: CARDS.get(id), n })).filter(e => e.card);
            return { name: p.name, format: 'casual', commander: null, entries, type: p.type, code: p.code };
        })();
        preconCache[p.file].catch(() => { delete preconCache[p.file]; });
    }
    return preconCache[p.file];
}
function deckColors(entries) {
    const n = {};
    entries.forEach(({ card, n: k }) => { if (rulesFor(card).kind !== 'land') (card.colors || []).forEach(c => { n[c] = (n[c] || 0) + k; }); });
    return Object.keys(n).filter(c => 'WUBRG'.includes(c)).sort((a, b) => n[b] - n[a]);
}
// For an AI opponent: cards the game can't cast become basics of its colors
async function preconForAI(deck) {
    await loadBasics();
    const cols = deckColors(deck.entries);
    let swapped = 0, k = 0;
    const out = [];
    deck.entries.forEach(e => {
        if (rulesFor(e.card).kind === 'land' || rulesFor(e.card).support !== 'none') { out.push(e); return; }
        swapped += e.n;
        for (let i = 0; i < e.n; i++) {
            const col = cols.length ? cols[k++ % cols.length] : 'W';
            const land = CARDS.get(BASIC_IDS[col]);
            const ex = out.find(x => x.card === land);
            if (ex) ex.n++; else out.push({ card: land, n: 1 });
        }
    });
    return { ...deck, entries: out, swapped };
}
function supportSummary(entries) {
    const s = { full: 0, partial: 0, none: 0 };
    entries.forEach(({ card, n }) => { if (rulesFor(card).kind !== 'land') s[rulesFor(card).support] += n; });
    return s;
}

// ---- Welcome Deck Duels: battle any Welcome Deck, chosen from a random six ----
let wdPick = null;
// Set names for the deck cards ("Red Deck" is from Welcome Deck 2016), cached a week
async function setNames() {
    const c = store.get('setNames', null);
    if (c && c.map && Date.now() - c.fetched < 7 * 864e5) return c.map;
    const res = await sfJSON(`${SF}/sets`).catch(() => null);
    const map = {};
    (res ? res.data : []).forEach(x => { map[x.code.toUpperCase()] = x.name; });
    if (Object.keys(map).length) store.set('setNames', { fetched: Date.now(), map });
    return map;
}
async function welcomeDecks() { return (await loadPreconList()).filter(p => p.type === 'Welcome Deck'); }
function wdYear(p) { return (p.date || '').slice(0, 4); }
async function renderWelcomeView() {
    let list;
    try { list = await welcomeDecks(); } catch (e) { $('wdGrid').innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    let six = store.get('welcomeSix', []).filter(f => list.some(p => p.file === f));
    if (six.length < Math.min(6, list.length)) { six = shuffle(list.slice()).slice(0, 6).map(p => p.file); store.set('welcomeSix', six); }
    if (wdPick && !six.includes(wdPick)) wdPick = null;
    const names = await setNames();
    const setOf = p => names[(p.code || '').toUpperCase()] || p.code || '';
    $('wdNote').textContent = `${list.length} Welcome Decks from MTGJSON`;
    $('wdGrid').innerHTML = six.map(f => list.find(p => p.file === f)).map(p => `<button type="button" class="wd-card" aria-pressed="${wdPick === p.file}" onclick="pickWelcome('${esc(p.file)}')">
        <strong>${esc(p.name)}</strong><span class="note">${esc(setOf(p))}${wdYear(p) && !setOf(p).includes(wdYear(p)) ? ` · ${wdYear(p)}` : ''} · 30 cards</span><span class="note">${wdPick === p.file ? '✔ Your opponent' : 'Tap to battle this deck'}</span></button>`).join('');
    // Your deck: one you built (not Commander), or a Welcome Deck of your own
    const sel = $('wdMine'), prev = sel.value;
    const mine = profile.decks.map((d, i) => [d, i]).filter(([d]) => d.format !== 'commander');
    sel.innerHTML = (mine.length ? `<optgroup label="Your decks">${mine.map(([d, i]) => `<option value="${i}">${esc(d.name)}</option>`).join('')}</optgroup>` : '')
        + `<optgroup label="Play a Welcome Deck">${list.map(p => `<option value="wd:${esc(p.file)}">${esc(p.name)} (${esc(setOf(p))})</option>`).join('')}</optgroup>`;
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
    else if (!mine.length) sel.value = `wd:${list.filter(p => !six.includes(p.file))[0]?.file || list[0].file}`;
    $('wdMineNote').textContent = 'Your own decks play by Casual rules here.';
    $('wdStart').disabled = !wdPick;
    $('wdStartNote').textContent = wdPick ? `vs ${list.find(p => p.file === wdPick).name} (${setOf(list.find(p => p.file === wdPick))})` : 'Pick an opponent above.';
}
function pickWelcome(f) { wdPick = f; renderWelcomeView(); if (isPhone()) $('wdStart').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
function rerollWelcomeSix() { store.set('welcomeSix', []); wdPick = null; renderWelcomeView(); }
async function startWelcomeMatch() {
    const list = await welcomeDecks();
    const opp = list.find(p => p.file === wdPick);
    if (!opp) { toast('Pick an opponent first.'); return; }
    const v = $('wdMine').value;
    showModal('<h2>Shuffling up...</h2><p class="loading">Loading both decks...</p>');
    try {
        let mine;
        if (v.startsWith('wd:')) { const p = list.find(x => x.file === v.slice(3)); mine = { ...(await loadPreconDeck(p)) }; }
        else {
            const deck = profile.decks[Number(v)];
            if (!deck) throw new Error('Pick your deck first.');
            await cardsByIds(Object.keys(deck.cards));
            mine = deckToEntries(deck);
        }
        mine.format = 'casual';
        const oppDeck = await preconForAI(await loadPreconDeck(opp));
        oppDeck.format = 'casual';
        oppDeck.source = `Welcome Deck${oppDeck.swapped ? `, ${oppDeck.swapped} cards swapped for lands` : ''}`;
        closeModal();
        newGame(mine, oppDeck);
    } catch (e) {
        console.error(e);
        showModal(`<h2>Couldn't start</h2><p class="warn">${esc(e.message)}</p><div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">OK</button></div>`);
    }
}

// ---- Onboarding: a new player picks a real precon as their first deck ----
function needsOnboarding() {
    return !AUTOPLAY && profile && !profile.starterDeck && !profile.decks.length && !Object.keys(profile.collection).length;
}
async function preconPicker(auto) {
    showModal(`<h2>🎁 Choose your first deck</h2>
        <p class="note">Pick a real preconstructed deck (decklists from MTGJSON). Its cards go into your collection, Mint, and it's ready to play in the Campaign's Kitchen Table.</p>
        <div id="pcPick" class="loading" style="margin-top:10px;">Loading Wizards' precons...</div>
        <div id="pcPreview" style="margin-top:10px; text-align:left;"></div>
        <div class="row" style="justify-content:center; margin-top:12px;">
            <button class="btn primary" id="pcTake" onclick="takePrecon()" disabled>Take this deck</button>
            <button class="btn" onclick="closeModal()">${auto ? 'Later' : 'Close'}</button>
        </div>`);
    try {
        const list = await loadPreconList();
        const groups = Object.keys(PRECON_TYPES).map(t => [t, list.filter(p => p.type === t).slice(0, t === 'Theme Deck' || t === 'Intro Pack' ? 40 : 30)]).filter(([, l]) => l.length);
        $('pcPick').className = '';
        $('pcPick').innerHTML = `<select id="pcSel" style="width:100%;" onchange="previewPrecon()" aria-label="Precon deck">${groups.map(([t, l]) => `<optgroup label="${esc(PRECON_TYPES[t])}">${l.map(p => `<option value="${esc(p.file)}">${esc(p.name)} (${esc(p.code)}, ${(p.date || '').slice(0, 4)})</option>`).join('')}</optgroup>`).join('')}</select>`;
        // Default to the newest Starter Kit: two-player-ready, 60 cards
        const def = list.find(p => p.type === 'Starter Kit') || list[0];
        if (def) $('pcSel').value = def.file;
        previewPrecon();
    } catch (e) {
        $('pcPick').className = 'warn';
        $('pcPick').textContent = `${e.message}. Try again in a moment.`;
    }
}
let pcChosen = null;
async function previewPrecon() {
    const file = $('pcSel') && $('pcSel').value;
    const p = (preconList && preconList.list || []).find(x => x.file === file);
    if (!p) return;
    pcChosen = null;
    $('pcTake').disabled = true;
    $('pcPreview').innerHTML = '<div class="loading">Loading the decklist...</div>';
    try {
        const deck = await loadPreconDeck(p);
        if (($('pcSel') || {}).value !== file) return;
        pcChosen = { p, deck };
        const total = deck.entries.reduce((a, e) => a + e.n, 0);
        const s = supportSummary(deck.entries);
        const value = deck.entries.reduce((a, e) => a + (isBasic(e.card) ? 0 : baseUsd(e.card) * e.n), 0);
        const top = deck.entries.filter(e => rulesFor(e.card).kind !== 'land').sort((a, b) => baseUsd(b.card) - baseUsd(a.card)).slice(0, 6);
        $('pcPreview').innerHTML = `<div><strong>${esc(p.name)}</strong> <span class="note">${esc(p.type)} · ${total} cards · ${deckColors(deck.entries).map(c => `<span class="pip ${c}"></span>`).join('')}</span></div>
            <div class="note">The game runs ${s.full} spells fully, ${s.partial} partly${s.none ? `, ${s.none} not yet` : ''}. Worth about ${usd(value)} (Scryfall's TCGplayer prices).</div>
            <div class="note">Best cards: ${top.map(e => `<a href="#" onclick="showCardSheet('${e.card.id}'); return false;">${esc(e.card.name)}</a>`).join(', ')}</div>`;
        $('pcTake').disabled = false;
    } catch (e) {
        $('pcPreview').innerHTML = `<p class="warn">${esc(e.message)}</p>`;
    }
}
function takePrecon() {
    if (!pcChosen) return;
    const { p, deck } = pcChosen;
    const cards = {};
    deck.entries.forEach(e => { cards[e.card.id] = (cards[e.card.id] || 0) + e.n; for (let i = 0; i < e.n; i++) if (!isBasic(e.card)) addCopy(e.card.id, { c: 'M' }); });
    profile.decks.push({ id: `d${Date.now()}`, name: `${p.name} (${p.type})`, format: 'casual', cards, commander: null, starter: false });
    profile.starterDeck = p.file;
    saveProfile();
    closeModal();
    toast(`🎁 ${p.name} is yours. Try it in the Campaign!`);
    if (!$('view-home').classList.contains('hidden')) renderHome();
}

// ---- Boss decks: what each personality plays at the Regional Qualifier ----
// Built like the theme decks (two Scryfall searches, only cards the game
// can run), but not limited to Modern. Checked live on 2026-10-05.
const BOSS_THEMES = {
    control: { name: 'Azorius Control', colors: ['W', 'U'], base: ' f:modern game:paper -t:land', creatures: '(c=w or c=u or c=wu) t:creature (kw:flying or kw:flash) cmc<=5', spells: '(c=u or c=w or c=wu) t:instant (o:"counter target spell" or o:"exile target creature" or o:"destroy target creature" or o:"draw two cards")', spellCount: 6, creatureCount: 5 },
    artifacts: { name: 'Artifact Combo', colors: ['U'], base: ' f:modern game:paper -t:land', creatures: 'id<=u t:artifact t:creature cmc<=5', spells: 'c=u (t:instant or t:sorcery) (o:"draw two cards" or o:"to its owner\'s hand")', spellCount: 3, creatureCount: 7 },
    tribal: { name: 'Goblin Tribal', colors: ['R'], base: ' f:modern game:paper -t:land', creatures: 't:goblin t:creature c<=r', spells: 'c=r (t:instant or t:sorcery) o:"damage to any target"', creatureCount: 7 },
    stax: { name: 'Lockdown', colors: ['W'], base: ' f:modern game:paper -t:land', creatures: 'c=w t:creature o:"tap target creature" cmc<=5', spells: 'c=w (t:instant or t:sorcery) (o:"tap target creature" or o:"exile target creature")', spellCount: 4 },
    burn: MODERN_THEMES.find(t => t.key === 'burn'),
    stompy: MODERN_THEMES.find(t => t.key === 'stompy'),
    power: { name: 'Vintage Power', colors: ['U'], base: ' f:vintage game:paper -t:land', creatures: 'c=u t:creature kw:flying cmc<=5', spells: 'c=u t:instant (o:"counter target spell" or o:"draw three cards" or o:"draws three cards")', spellCount: 4,
        fixed: ['Mox Sapphire', 'Mox Pearl', 'Mox Jet', 'Mox Ruby', 'Mox Emerald', 'Sol Ring', 'Ancestral Recall'] },
    mill: { name: 'Mill & Discard', colors: ['U', 'B'], base: ' f:modern game:paper -t:land', creatures: '(c=u or c=b or c=ub) t:creature (o:"mills" or o:"discards" or o:"draw")', spells: '(c=u or c=b or c=ub) (t:instant or t:sorcery) (o:"mills" or o:"discards" or o:"destroy target creature")', spellCount: 5 }
};
async function buildBossDeck(P) {
    const key = P.duel.theme;
    if (key === 'precon') {
        const list = (await loadPreconList()).filter(p => p.type === 'Theme Deck' || p.type === 'Intro Pack');
        const deck = await preconForAI(await loadPreconDeck(list[rand(Math.min(list.length, 40))]));
        return { ...deck, name: `${P.name}'s ${deck.name}` };
    }
    const deck = await buildThemeDeck(BOSS_THEMES[key]);
    return { ...deck, format: 'casual', name: `${P.name}'s ${BOSS_THEMES[key].name}` };
}

// ---- The campaign ladder ----
const CAMPAIGN_TIERS = [
    { tier: 1, key: 'kitchen', icon: '🍕', name: 'Kitchen Table', level: 'easy', nodes: 5, entry: { coins: 0, usd: 0 }, minValue: 0, maxValue: 50, unlock: 0,
        types: ['Welcome Deck', 'Theme Deck', 'Intro Pack', 'Starter Deck'], reward: { coins: 30 }, lossReward: { coins: 5 },
        desc: 'Free. Casual opponents with classic precons, and they make mistakes. Decks worth up to $50. Good for testing a starter deck.' },
    { tier: 2, key: 'fnm', icon: '🎉', name: 'Friday Night Magic', level: 'normal', nodes: 5, entry: { coins: 100, usd: 0 }, minValue: 50, maxValue: 300, unlock: 3,
        types: ['Challenger Deck', 'Planeswalker Deck', 'Arena Starter Kit', 'Starter Kit', 'Pioneer Challenger Deck'], reward: { usd: 20, packs: 2 }, lossReward: {},
        desc: 'Entry 🪙 100 and a deck worth $50 to $300. Upgraded precons and Challenger Decks, played properly.' },
    { tier: 3, key: 'rq', icon: '🏆', name: 'Regional Qualifier', level: 'hard', bosses: true, entry: { coins: 300, usd: 25 }, minValue: 100, unlock: 3,
        reward: { usd: 100, collector: 2, discount: 0.02 }, lossReward: {},
        desc: 'Entry 🪙 300 + $25 and a deck worth $100+. The personalities bring their own decks and play to win: they hold removal and counters for real threats.' }
];
const CAMPAIGN_DISCOUNT_MAX = 0.18;
function tierWins(t) { return profile.campaignProgress.filter(id => id.startsWith(`${t.key}-`)).length; }
function tierUnlocked(t) {
    if (t.tier === 1) return true;
    const prev = CAMPAIGN_TIERS[t.tier - 2];
    return tierWins(prev) >= t.unlock;
}
function tierNodes(t) {
    if (t.bosses) return Object.keys(PERSONALITIES).map(k => ({ id: `${t.key}-${k}`, boss: k }));
    return Array.from({ length: t.nodes }, (_, i) => ({ id: `${t.key}-${i + 1}` }));
}
// Each Kitchen Table / FNM stop gets a precon opponent the first time it's shown, and keeps it
async function assignNodeDecks() {
    const list = await loadPreconList();
    let changed = false;
    profile.campaignNodes = profile.campaignNodes || {};
    CAMPAIGN_TIERS.filter(t => !t.bosses).forEach(t => {
        const pool = list.filter(p => t.types.includes(p.type));
        const used = new Set(Object.values(profile.campaignNodes).map(n => n.file));
        tierNodes(t).forEach(n => {
            if (profile.campaignNodes[n.id] || !pool.length) return;
            const free = pool.filter(p => !used.has(p.file));
            const p = (free.length ? free : pool)[rand((free.length ? free : pool).length)];
            profile.campaignNodes[n.id] = { file: p.file, name: p.name, type: p.type, code: p.code };
            used.add(p.file);
            changed = true;
        });
    });
    if (changed) saveProfile();
}
function deckValue(deck) {
    return Object.entries(deck.cards).reduce((a, [id, n]) => { const c = CARDS.get(id); return a + (c && !isBasic(c) ? baseUsd(c) * n : 0); }, 0);
}
let campaignSel = null;
async function renderCampaign() {
    const box = $('campaignMap');
    box.innerHTML = '<div class="loading">Setting up the ladder...</div>';
    try { await assignNodeDecks(); } catch (e) { box.innerHTML = `<p class="warn">${esc(e.message)}. Try this tab again in a moment.</p>`; return; }
    const ids = profile.decks.flatMap(d => Object.keys(d.cards)).filter(id => !CARDS.has(id));
    if (ids.length) await cardsByIds(ids).catch(() => {});
    $('campaignHead').innerHTML = `<div class="pos-stats">
            <div><span class="pos-k">Coins</span><strong>🪙 ${profile.coins.toLocaleString()}</strong></div>
            <div><span class="pos-k">Shop cash</span><strong>💵 ${usd(profile.usd)}</strong></div>
            <div><span class="pos-k">Wins on the ladder</span><strong>${profile.campaignProgress.length}</strong></div>
            <div><span class="pos-k">Distributor discount</span><strong>${Math.round((profile.campaignDiscount || 0) * 100)}%</strong></div>
        </div>`;
    box.innerHTML = CAMPAIGN_TIERS.map(t => {
        const open = tierUnlocked(t);
        const nodes = tierNodes(t);
        return `<div class="tier-band tier-${t.tier}${open ? '' : ' locked'}">
            <div class="tier-head"><span class="tier-icon" aria-hidden="true">${t.icon}</span><div><strong>Tier ${t.tier}: ${esc(t.name)}</strong>
                <div class="note">${esc(t.desc)}${open ? '' : ` 🔒 Win ${t.unlock} games in ${esc(CAMPAIGN_TIERS[t.tier - 2].name)} to unlock (${tierWins(CAMPAIGN_TIERS[t.tier - 2])}/${t.unlock}).`}</div></div></div>
            <div class="trail">${nodes.map((n, i) => {
                const beaten = profile.campaignProgress.includes(n.id);
                const P = n.boss && PERSONALITIES[n.boss];
                const info = P ? P.name : (profile.campaignNodes[n.id] ? profile.campaignNodes[n.id].name : `Game ${i + 1}`);
                return `<button type="button" class="trail-node${beaten ? ' beaten' : ''}${campaignSel === n.id ? ' sel' : ''}" ${open ? '' : 'disabled'} onclick="selectNode('${n.id}')" aria-pressed="${campaignSel === n.id}">
                    <span class="dot" aria-hidden="true">${beaten ? '✓' : P ? P.emoji : i + 1}</span><span class="lbl">${esc(info)}</span></button>`;
            }).join('<span class="trail-line" aria-hidden="true"></span>')}</div>
        </div>`;
    }).join('');
    renderNodePanel();
    renderCircuit();
}
function selectNode(id) { campaignSel = id; renderCampaign(); }
function nodeInfo(id) {
    const t = CAMPAIGN_TIERS.find(x => id.startsWith(`${x.key}-`));
    const n = tierNodes(t).find(x => x.id === id);
    return { t, n };
}
function rewardText(r) {
    const parts = [];
    if (r.coins) parts.push(`🪙 ${r.coins}`);
    if (r.usd) parts.push(`💵 ${usd(r.usd)}`);
    if (r.packs) parts.push(`📦 ${r.packs} play boosters`);
    if (r.collector) parts.push(`📦 ${r.collector} collector boosters`);
    if (r.discount) parts.push(`a permanent ${Math.round(r.discount * 100)}% distributor discount (first win against each boss, up to ${Math.round(CAMPAIGN_DISCOUNT_MAX * 100)}%)`);
    return parts.join(' + ') || 'nothing';
}
function renderNodePanel() {
    const box = $('campaignNode');
    if (!campaignSel) { box.innerHTML = '<p class="note">Pick a stop on the map.</p>'; return; }
    const { t, n } = nodeInfo(campaignSel);
    const P = n.boss && PERSONALITIES[n.boss];
    const opp = P ? `${P.emoji} <strong>${esc(P.name)}</strong> the ${esc(P.archetype)} · ${esc(P.duel.desc)}` : (() => { const d = profile.campaignNodes[n.id]; return d ? `<strong>${esc(d.name)}</strong> <span class="note">${esc(d.type)} (${esc(d.code)})</span>` : 'A random precon'; })();
    const decks = profile.decks.map((d, i) => ({ d, i })).filter(x => x.d.format !== 'commander');
    box.innerHTML = `<h3>${t.icon} ${esc(t.name)}</h3>
        <div>Opponent: ${opp}</div>
        <div class="note">AI: ${t.level === 'easy' ? 'casual (makes mistakes)' : t.level === 'normal' ? 'solid' : 'expert (holds answers for real threats)'} · Entry: ${t.entry.coins || t.entry.usd ? [t.entry.coins ? `🪙 ${t.entry.coins}` : '', t.entry.usd ? `💵 ${usd(t.entry.usd)}` : ''].filter(Boolean).join(' + ') : 'free'}${t.minValue ? ` · Your deck must be worth ${usd(t.minValue)}+` : ''}</div>
        <div class="note">Win: ${rewardText(t.reward)}${t.lossReward.coins ? ` · Loss: 🪙 ${t.lossReward.coins}` : ''}</div>
        ${decks.length ? `<div class="row" style="margin-top:8px;"><select id="campDeck" onchange="renderNodeDeckNote()" aria-label="Your deck">${decks.map(x => `<option value="${x.i}">${esc(x.d.name)} · ${FORMATS[x.d.format].name}</option>`).join('')}</select>
            <button class="btn primary" onclick="startCampaignMatch()">⚔️ Play</button></div><div id="campDeckNote" class="note"></div>`
        : `<p class="note">You need a Modern or Casual deck. <button class="btn small gold" onclick="preconPicker()">🎁 Choose a starter precon</button></p>`}`;
    renderNodeDeckNote();
}
function renderNodeDeckNote() {
    const el = $('campDeckNote');
    if (!el || !campaignSel) return;
    const deck = profile.decks[$('campDeck').value];
    const { t } = nodeInfo(campaignSel);
    const v = deckValue(deck);
    const probs = deckProblems(deck);
    el.innerHTML = `Deck value: ${usd(v)}${campaignDeckProblem(t, v) ? ` <span class="warn">(${esc(campaignDeckProblem(t, v))})</span>` : ''}${probs.length ? ` · <span class="warn">⚠ ${esc(probs[0])}</span>` : ''}`;
}
async function startCampaignMatch() {
    const { t, n } = nodeInfo(campaignSel);
    const deck = profile.decks[$('campDeck').value];
    if (!deck) return;
    const probs = deckProblems(deck);
    if (probs.length) { toast(`Fix your deck first: ${probs[0]}`); return; }
    { const dp = campaignDeckProblem(t, deckValue(deck)); if (dp) { toast(dp); return; } }
    if (profile.coins < t.entry.coins || profile.usd < t.entry.usd) { toast('Not enough for the entry fee.'); return; }
    showModal('<h2>Shuffling up...</h2><p class="loading">Building your opponent\'s deck...</p>');
    try {
        await cardsByIds(Object.keys(deck.cards));
        let oppDeck, P = null;
        if (n.boss) {
            P = PERSONALITIES[n.boss];
            oppDeck = await buildBossDeck(P);
            oppDeck.source = `${P.archetype} boss deck`;
        } else {
            const d = profile.campaignNodes[n.id];
            oppDeck = await preconForAI(await loadPreconDeck(d));
            oppDeck.source = `${d.type} from MTGJSON${oppDeck.swapped ? `, ${oppDeck.swapped} cards swapped for lands` : ''}`;
        }
        profile.coins -= t.entry.coins;
        profile.usd = round2(profile.usd - t.entry.usd);
        saveProfile();
        closeModal();
        oppDeck.aiLevel = t.level;
        oppDeck.aiStyle = P ? P.duel.style : null;
        oppDeck.campaign = { tier: t.tier, node: n.id, boss: n.boss || null };
        const mine = deckToEntries(deck);
        mine.format = 'casual';
        oppDeck.format = 'casual';
        newGame(mine, oppDeck);
    } catch (e) {
        console.error(e);
        showModal(`<h2>Couldn't start</h2><p class="warn">${esc(e.message)}</p><div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">OK</button></div>`);
    }
}
// Called from endGame for campaign games; returns a line for the result box
function campaignResult(won) {
    if (G.campaign.circuit) return circuitResult(won);
    const c = G.campaign;
    const t = CAMPAIGN_TIERS[c.tier - 1];
    const r = won ? t.reward : t.lossReward;
    const first = won && !profile.campaignProgress.includes(c.node);
    if (first) profile.campaignProgress.push(c.node);
    if (r.coins) profile.coins += r.coins;
    if (r.usd) profile.usd = round2(profile.usd + r.usd);
    let line = won ? `Campaign win! ${rewardText({ ...r, discount: 0 })}` : (r.coins ? `Campaign: 🪙 ${r.coins} for trying.` : 'Campaign: no prize this time.');
    if (won && r.discount && first) {
        profile.campaignDiscount = Math.min(CAMPAIGN_DISCOUNT_MAX, round2((profile.campaignDiscount || 0) + r.discount));
        line += ` · Distributor discount now ${Math.round(profile.campaignDiscount * 100)}%.`;
    }
    if (won && (r.packs || r.collector)) grantPrizePacks(r.packs || 0, r.collector || 0);
    saveProfile();
    return line;
}
async function grantPrizePacks(play, collector) {
    try {
        const list = await loadBoxCatalog();
        const recent = list.filter(b => ['expansion', 'core'].includes(b.type)).sort((a, b) => b.released.localeCompare(a.released));
        const p = recent.find(b => b.kind === 'play');
        const c = recent.find(b => b.kind === 'collector');
        if (play && p) addSealed(p, play);
        if (collector && c) addSealed(c, collector);
        saveProfile();
        toast(`📦 Prize packs are in your stockroom (Distributor tab).`);
    } catch (e) {
        toast('Prize packs will arrive when MTGJSON can be reached.');
    }
}

