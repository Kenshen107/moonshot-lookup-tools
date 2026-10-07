// =====================================================================
// Booster draft (2026-10-08, owner's request): you and 7 computer
// drafters, 3 packs each (real pack odds from MTGJSON), passed left,
// right, left. Then you build a 40-card deck (basic lands free) and play
// 3 rounds against other drafters' decks. Entry is the price of 3 packs
// in coins; you keep every card you draft.
// =====================================================================
const DRAFT_SETS = [
    { code: 'mrd', name: 'Mirrodin', released: '2003-10-02', type: 'expansion', checked: '2026-10-08', blurb: 'Artifacts everywhere: Equipment, affinity, imprint and artifact lands.' },
    { code: 'm10', name: 'Magic 2010', released: '2009-07-17', type: 'core', checked: '2026-10-08', blurb: 'A classic core set: Wolves, Vampires and Merfolk, Lightning Bolt, Fireball and Baneslayer Angel.' }
];
const DRAFT_SEATS = 8, DRAFT_PACKS = 3, DRAFT_ROUNDS = 3, DRAFT_WIN_COINS = 300;
const DRAFT_BOT_NAMES = ['Greg', 'Marcus', 'Sarah', 'Leo', 'Trevor', 'Sam', 'Arthur', 'Brenda', 'Luke'];
const draftMeta = s => ({ code: s.code, kind: 'play', type: s.type, released: s.released, name: s.name });
const draftEntry = s => DRAFT_PACKS * packCoins(draftMeta(s));
const draftCard = p => CARDS.get(p.id);
const colName = c => COLOR_NAMES[c][0].toUpperCase() + COLOR_NAMES[c].slice(1);

// How good a card is in Limited, roughly (the computer drafters' pick order)
function draftRating(card) {
    if (!card) return 0;
    const R = rulesFor(card);
    if (isBasic(card)) return 0;
    let v = { common: 1, uncommon: 1.6, rare: 2.3, mythic: 2.6 }[card.rarity] || 1;
    const fx = [...(R.spell || []), ...R.etb, ...(R.modes || []).flat(), ...(R.etbModes || []).flat(), ...R.trig.flatMap(t => t.effects || []), ...R.acts.flatMap(a => a.effects || [])];
    const removal = fx.some(e => ['destroy', 'exile', 'bounce', 'steal'].includes(e.t) && ['creature', 'perm', 'any'].includes(e.target)) || fx.some(e => e.t === 'dmg' && e.target && e.target !== 'player') || fx.some(e => e.t === 'pump' && e.p < 0 && e.target === 'creature') || fx.some(e => e.t === 'wipe');
    if (removal) v += 2.5;
    if (fx.some(e => e.t === 'draw')) v += 0.7;
    if (fx.some(e => e.t === 'token')) v += 0.7;
    if (R.kind === 'creature') {
        const p = Number(card.power) || 0, t = Number(card.toughness) || 0, mv = card.cmc || 0;
        v += Math.min(3, (p + t) / (mv + 1)) * 0.9;
        if (R.kw.has('flying')) v += 1;
        ['first strike', 'deathtouch', 'trample', 'lifelink', 'vigilance', 'haste', 'menace', 'shroud', 'protection'].forEach(k => { if (R.kw.has(k)) v += 0.3; });
        if (R.kw.has('defender')) v -= 1;
    }
    if (R.isEquipment) v += 1.2;
    if (R.isAura) v += R.buffBad ? 1.2 : 0.3;
    if (R.kind === 'land') v = R.mana && R.mana.colors.length > 1 ? 1.2 : 0.6;
    if (R.mana && R.kind === 'artifact') v += 0.6;
    if (R.support === 'none') v *= 0.15; else if (R.support === 'partial') v *= 0.8;
    return v;
}
const cardColors = c => (c.colors || []).filter(x => COLORS.includes(x));
// A drafter's colors so far: rating per color of what they've taken
function draftColorWeights(pool) {
    const w = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    pool.forEach(p => { const c = draftCard(p); if (!c) return; cardColors(c).forEach(x => { w[x] += draftRating(c); }); });
    return w;
}
const topColors = (w, n = 2) => Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, n).filter(([, v]) => v > 0).map(([k]) => k);
// A computer drafter's pick: the best card, leaning into its two colors as the draft goes on
function botPickIndex(D, seat) {
    const pack = D.packs[seat], pool = D.pools[seat];
    const picks = pool.length, lean = Math.min(1, picks / 10);
    const top = topColors(draftColorWeights(pool));
    const jitter = D.bots[seat].jitter || 0;
    let best = 0, bestV = -1;
    pack.forEach((p, i) => {
        const c = draftCard(p);
        let v = draftRating(c) * (1 + jitter * (((i * 7 + seat * 13 + picks) % 10) / 10 - 0.5));
        const cols = c ? cardColors(c) : [];
        if (cols.length && top.length >= 2) { const fit = cols.every(x => top.includes(x)); v *= fit ? 1 + 0.25 * lean : 1 - 0.6 * lean; }
        if (v > bestV) { bestV = v; best = i; }
    });
    return best;
}
// A 40-card deck from a pool: the two best colors, the 23 best cards, 17 lands
function autoDeckFromPool(pool) {
    const w = draftColorWeights(pool);
    const cols = topColors(w);
    const fits = c => cardColors(c).every(x => cols.includes(x));
    const idx = pool.map((p, i) => ({ i, c: draftCard(p) })).filter(x => x.c && !isBasic(x.c) && rulesFor(x.c).support !== 'none' && fits(x.c));
    const landOk = c => { const m = rulesFor(c).mana; return !!m && m.colors.some(x => cols.includes(x)); }; // lands that make one of its colors
    const lands = idx.filter(x => rulesFor(x.c).kind === 'land' && landOk(x.c)).sort((a, b) => draftRating(b.c) - draftRating(a.c)).slice(0, 3);
    const spells = idx.filter(x => rulesFor(x.c).kind !== 'land').sort((a, b) => draftRating(b.c) - draftRating(a.c));
    // Keep the curve sane: at most 4 cards costing 6 or more
    const main = [];
    for (const x of spells) { if (main.length >= 23) break; if ((x.c.cmc || 0) >= 6 && main.filter(y => (y.c.cmc || 0) >= 6).length >= 4) continue; main.push(x); }
    const basics = splitBasics(main.map(x => x.c), Math.max(0, 40 - main.length - lands.length), cols);
    return { main: [...main, ...lands].map(x => x.i), basics, colors: cols };
}
// Basic lands split by the colored mana symbols in the spells
function splitBasics(cards, n, cols) {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    cards.forEach(c => COLORS.forEach(x => { pips[x] += ((c.cost || '').match(new RegExp(`\\{[^}]*${x}[^}]*\\}`, 'g')) || []).length; }));
    const use = (cols && cols.length ? cols : COLORS).filter(x => pips[x] > 0);
    const out = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    if (!use.length) { const c = (cols && cols[0]) || 'W'; out[c] = n; return out; }
    const total = use.reduce((a, x) => a + pips[x], 0);
    let left = n;
    use.forEach((x, k) => { const m = k === use.length - 1 ? left : Math.round(n * pips[x] / total); out[x] = Math.max(0, Math.min(left, m)); left -= out[x]; });
    return out;
}
function draftDeckEntries(pool, main, basics, name) {
    const count = new Map();
    main.forEach(i => { const p = pool[i]; if (p) count.set(p.id, (count.get(p.id) || 0) + 1); });
    Object.entries(basics).forEach(([c, n]) => { if (n > 0) count.set(BASIC_IDS[c], (count.get(BASIC_IDS[c]) || 0) + n); });
    return { name, format: 'limited', commander: null, entries: [...count].map(([id, n]) => ({ card: CARDS.get(id), n })).filter(e => e.card) };
}
function botDeck(D, seat) {
    const b = D.bots[seat], a = autoDeckFromPool(D.pools[seat]);
    const d = draftDeckEntries(D.pools[seat], a.main, a.basics, `${b.name}'s ${a.colors.map(c => COLOR_NAMES[c]).join('-')} draft deck`);
    d.source = `drafted at your table, seat ${seat + 1}`;
    return d;
}

async function startDraft(code) {
    const set = DRAFT_SETS.find(s => s.code === code);
    if (!set) return;
    if (profile.draft && profile.draft.stage !== 'done') { toast('Finish or leave your current draft first.'); return; }
    const price = draftEntry(set);
    if (profile.coins < price) { toast(`A ${set.name} draft costs 🪙 ${price.toLocaleString()} - win games to earn more.`); return; }
    $('draftArea').innerHTML = '<div class="loading">Opening 24 packs for the table...</div>';
    try {
        const packs = await drawPacks(set.code, 'play', DRAFT_SEATS * DRAFT_PACKS);
        const slim = pk => pk.cards.map(p => ({ id: p.id, foil: !!p.foil }));
        const names = shuffle(DRAFT_BOT_NAMES.slice()).slice(0, DRAFT_SEATS - 1);
        profile.coins -= price;
        profile.draft = {
            set: set.code, name: set.name, released: set.released, stage: 'pick', packNo: 0, pickNo: 0, started: todayISO(), paid: price,
            packs: packs.slice(0, DRAFT_SEATS).map(slim),
            later: [packs.slice(DRAFT_SEATS, 2 * DRAFT_SEATS).map(slim), packs.slice(2 * DRAFT_SEATS).map(slim)],
            pools: Array.from({ length: DRAFT_SEATS }, () => []),
            bots: [{ name: 'You' }, ...names.map(n => ({ name: n, jitter: 0.2 + Math.random() * 0.3 }))],
            main: [], basics: { W: 0, U: 0, B: 0, R: 0, G: 0 }, round: 0, results: [], opps: []
        };
        saveProfile();
        renderCoins();
        renderDraft();
    } catch (e) {
        console.error(e);
        $('draftArea').innerHTML = `<p class="warn">Couldn't open the packs: ${esc(e.message)}</p>`;
    }
}
function draftPick(i) {
    const D = profile.draft;
    if (!D || D.stage !== 'pick' || !D.packs[0][i]) return;
    takeDraftPick(D, 0, i);
    for (let s = 1; s < DRAFT_SEATS; s++) if (D.packs[s].length) takeDraftPick(D, s, botPickIndex(D, s));
    // Pass: pack 1 and 3 to the left, pack 2 to the right
    const dir = D.packNo === 1 ? -1 : 1;
    const next = [];
    D.packs.forEach((pk, s) => { next[(s + dir + DRAFT_SEATS) % DRAFT_SEATS] = pk; });
    D.packs = next;
    D.pickNo++;
    if (!D.packs[0].length) {
        D.packNo++; D.pickNo = 0;
        if (D.packNo < DRAFT_PACKS) D.packs = D.later.shift();
        else finishDrafting(D);
    }
    saveProfile();
    renderDraft();
}
function takeDraftPick(D, seat, i) {
    const p = D.packs[seat].splice(i, 1)[0];
    D.pools[seat].push(p);
    if (seat === 0 && !AUTOPLAY) addCopy(p.id, rollCopy(p.foil, D.released)); // you keep every card you draft
}
function finishDrafting(D) {
    D.stage = 'build';
    D.packs = []; D.later = [];
    const a = autoDeckFromPool(D.pools[0]);
    D.main = a.main; D.basics = a.basics;
    D.opps = shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, DRAFT_ROUNDS);
}
function leaveDraft() {
    const D = profile.draft;
    if (!D) return;
    if (D.stage !== 'done' && !confirm('Leave this draft? The entry isn\'t refunded, but you keep the cards you drafted.')) return;
    profile.draft = null;
    saveProfile();
    renderDraft();
}

// ---- The Draft tab ----
async function renderDraft() {
    const el = $('draftArea');
    const D = profile.draft;
    if (!D) {
        el.innerHTML = `<p class="note">Draft against 7 computer drafters. Each of you opens a pack, takes one card and passes the rest (pack 1 to the left, pack 2 to the right, pack 3 to the left) until all 45 picks are made. Then you build a 40-card deck (basic lands are free) and play ${DRAFT_ROUNDS} rounds against other drafters' decks: 🪙 ${DRAFT_WIN_COINS} for each win. You keep every card you draft.</p>
            <div class="draft-sets">${DRAFT_SETS.map(s => `<div class="pos draft-set"><h3>${esc(s.name)} <span class="note">(${s.released.slice(0, 4)})</span></h3><p class="note">${esc(s.blurb)}</p>
                <button class="btn primary" onclick="startDraft('${s.code}')" ${profile.coins < draftEntry(s) ? 'disabled' : ''}>🃏 Draft ${esc(s.name)} · 🪙 ${draftEntry(s).toLocaleString()}</button>
                ${profile.coins < draftEntry(s) ? `<p class="note warn">You have 🪙 ${profile.coins.toLocaleString()}.</p>` : ''}</div>`).join('')}</div>`;
        return;
    }
    const ids = [...new Set([...D.pools.flat(), ...(D.packs || []).flat()].map(p => p.id).concat(Object.values(BASIC_IDS)))];
    if (ids.some(id => !CARDS.has(id))) { el.innerHTML = '<div class="loading">Loading the cards...</div>'; await cardsByIds(ids); if (profile.draft !== D) return; }
    if (D.stage === 'pick') return renderDraftPick(el, D);
    if (D.stage === 'build') return renderDraftBuild(el, D);
    renderDraftRounds(el, D);
}
function draftPoolSummary(pool) {
    const w = draftColorWeights(pool), n = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    pool.forEach(p => { const c = draftCard(p); if (!c) return; const cs = cardColors(c); if (!cs.length) n.C++; cs.forEach(x => n[x]++); });
    return `${COLORS.map(c => `<span class="dr-col" title="${colName(c)}: ${n[c]} cards"><span class="pip ${c}"></span>${n[c]}</span>`).join('')}<span class="dr-col" title="Colorless: ${n.C} cards">◇ ${n.C}</span>${topColors(w).length ? ` <span class="note">leaning ${topColors(w).map(c => colName(c)).join(' + ')}</span>` : ''}`;
}
function renderDraftPick(el, D) {
    const pack = D.packs[0];
    const dir = D.packNo === 1 ? 'right' : 'left';
    el.innerHTML = `<div class="draft-head"><div><strong>${esc(D.name)} · Pack ${D.packNo + 1} of ${DRAFT_PACKS} · Pick ${D.pickNo + 1}</strong><div class="note">Tap a card to look at it, then pick it. This pack goes to the ${dir} next. ${pack.length} card${pack.length === 1 ? '' : 's'} left in it.</div></div>
        <button class="btn small" onclick="leaveDraft()">Leave draft</button></div>
        <div class="cards draft-pack">${pack.map((p, i) => { const c = draftCard(p); return c ? `<button type="button" class="ctile${p.foil ? ' foil' : ''}" onclick="draftCardSheet(${i})" title="${esc(c.name)}">${cardImg(c)}<span class="meta">${esc(c.name)}${p.foil ? ' ✨' : ''}<br>${supportBadge(c)}</span></button>` : ''; }).join('')}</div>
        <h3 class="opp-h">Your picks (${D.pools[0].length})</h3><div class="dr-sum">${draftPoolSummary(D.pools[0])}</div>
        <div class="draft-picks">${D.pools[0].map(p => { const c = draftCard(p); return c ? `<button type="button" class="dr-mini" onclick="showCardSheet('${c.id}')" title="${esc(c.name)}">${cardImg(c)}</button>` : ''; }).join('')}</div>`;
}
function draftCardSheet(i) {
    const D = profile.draft, p = D && D.packs[0][i];
    if (!p) return;
    showCardSheet(p.id, `<button class="btn primary" onclick="closeSheet(); draftPick(${i})">✔ Pick this card</button>`);
}
// ---- Building the 40 ----
let draftFilter = '';
function draftDeckCount(D) { return D.main.length + Object.values(D.basics).reduce((a, b) => a + b, 0); }
function renderDraftBuild(el, D) {
    const inMain = new Set(D.main);
    const pool = D.pools[0].map((p, i) => ({ p, i, c: draftCard(p) })).filter(x => x.c)
        .sort((a, b) => (a.c.cmc || 0) - (b.c.cmc || 0) || a.c.name.localeCompare(b.c.name));
    const shown = pool.filter(x => !draftFilter || (draftFilter === 'C' ? !cardColors(x.c).length : cardColors(x.c).includes(draftFilter)));
    const n = draftDeckCount(D);
    const curve = [0, 0, 0, 0, 0, 0, 0];
    D.main.forEach(i => { const c = draftCard(D.pools[0][i]); if (c && rulesFor(c).kind !== 'land') curve[Math.min(6, c.cmc || 0)]++; });
    const creatures = D.main.filter(i => { const c = draftCard(D.pools[0][i]); return c && rulesFor(c).kind === 'creature'; }).length;
    const tile = x => `<button type="button" class="ctile${inMain.has(x.i) ? ' in-deck' : ' dim'}" onclick="draftToggle(${x.i})" title="${esc(x.c.name)}: tap to ${inMain.has(x.i) ? 'take out' : 'add'}">${cardImg(x.c)}<span class="meta">${esc(x.c.name)}<br>${supportBadge(x.c)}</span></button>`;
    el.innerHTML = `<div class="draft-head"><div><strong>Build your deck: ${n}/40</strong><div class="note">Tap cards to add or take them out (bright = in the deck). At least 40 cards; basic lands are free. About 17 lands, 15-17 creatures is the usual Limited deck.</div></div>
        <div class="row"><button class="btn" onclick="draftAutoBuild()">✨ Auto-build</button><button class="btn" onclick="draftFillLands()">🌲 Lands to 40</button><button class="btn small" onclick="leaveDraft()">Leave draft</button></div></div>
        <div class="dr-stats"><span>Creatures ${creatures}</span><span>Spells ${D.main.length - creatures}</span><span>Curve ${curve.map((k, m) => `<b title="${m === 6 ? '6+' : m} mana">${k}</b>`).join(' ')}</span></div>
        <div class="dr-basics">${COLORS.map(c => `<span class="dr-basic"><span class="pip ${c}"></span> ${colName(c)} <button class="btn small" onclick="draftBasic('${c}', -1)" aria-label="One less ${colName(c)} land">−</button><output>${D.basics[c]}</output><button class="btn small" onclick="draftBasic('${c}', 1)" aria-label="One more ${colName(c)} land">+</button></span>`).join('')}</div>
        <div class="row" style="margin:10px 0;">${['', 'W', 'U', 'B', 'R', 'G', 'C'].map(f => `<button class="btn small${draftFilter === f ? ' primary' : ''}" onclick="draftFilter='${f}'; renderDraft()">${f ? (f === 'C' ? '◇ Colorless' : `<span class="pip ${f}"></span> ${colName(f)}`) : 'All'}</button>`).join('')}</div>
        <h3 class="opp-h">In the deck (${D.main.length} + ${n - D.main.length} basics)</h3><div class="cards">${shown.filter(x => inMain.has(x.i)).map(tile).join('') || '<p class="note">Nothing here yet.</p>'}</div>
        <h3 class="opp-h">Sideboard</h3><div class="cards">${shown.filter(x => !inMain.has(x.i)).map(tile).join('') || '<p class="note">Everything is in the deck.</p>'}</div>
        <div class="row draft-go"><button class="btn primary" onclick="draftNextRound()" ${n < 40 ? 'disabled' : ''}>⚔️ Start round ${D.round + 1}</button><span class="note">${n < 40 ? `Add ${40 - n} more card${40 - n === 1 ? '' : 's'}.` : `You'll face ${esc(D.bots[D.opps[D.round]].name)}.`}</span></div>`;
}
function draftToggle(i) { const D = profile.draft; const k = D.main.indexOf(i); if (k >= 0) D.main.splice(k, 1); else D.main.push(i); saveProfile(); renderDraft(); }
function draftBasic(c, d) { const D = profile.draft; D.basics[c] = Math.max(0, D.basics[c] + d); saveProfile(); renderDraft(); }
function draftAutoBuild() { const D = profile.draft, a = autoDeckFromPool(D.pools[0]); D.main = a.main; D.basics = a.basics; saveProfile(); renderDraft(); }
function draftFillLands() {
    const D = profile.draft, need = 40 - draftDeckCount(D);
    if (need <= 0) { toast('The deck already has 40 cards.'); return; }
    const add = splitBasics(D.main.map(i => draftCard(D.pools[0][i])).filter(Boolean), need, null);
    COLORS.forEach(c => { D.basics[c] += add[c]; });
    saveProfile(); renderDraft();
}
// ---- Rounds ----
function draftMyDeck(D) { return draftDeckEntries(D.pools[0], D.main, D.basics, `Your ${D.name} draft deck`); }
async function draftNextRound() {
    const D = profile.draft;
    if (!D || draftDeckCount(D) < 40) return;
    if (D.stage === 'build') D.stage = 'rounds';
    if (D.round >= DRAFT_ROUNDS) return;
    saveProfile();
    const opp = botDeck(D, D.opps[D.round]);
    opp.name = `${D.bots[D.opps[D.round]].name}`;
    opp.draftRound = D.round;
    newGame(draftMyDeck(D), opp);
}
// Called from endGame
function draftResult(won) {
    const D = profile.draft;
    if (!D || G.draftRound === undefined || G.draftRound !== D.round) return '';
    D.results.push({ opp: D.opps[D.round], won });
    D.round++;
    const coins = won ? DRAFT_WIN_COINS : REWARDS.loss;
    profile.coins += coins;
    if (D.round >= DRAFT_ROUNDS) D.stage = 'done';
    saveProfile();
    const w = D.results.filter(r => r.won).length;
    return `Round ${D.round} ${won ? 'won' : 'lost'}: 🪙 +${coins}. Record ${w}-${D.results.length - w}.`;
}
function renderDraftRounds(el, D) {
    const w = D.results.filter(r => r.won).length, done = D.stage === 'done';
    el.innerHTML = `<div class="draft-head"><div><strong>${esc(D.name)} draft · ${done ? 'finished' : `round ${D.round + 1} of ${DRAFT_ROUNDS}`} · record ${w}-${D.results.length - w}</strong>
        <div class="note">${done ? `Done! You won 🪙 ${(w * DRAFT_WIN_COINS + (D.results.length - w) * REWARDS.loss).toLocaleString()} over ${DRAFT_ROUNDS} rounds, and the ${D.pools[0].length} cards you drafted are in your collection.` : 'Each round is one game (20 life). You can change your deck between rounds.'}</div></div></div>
        <ol class="dr-rounds">${D.opps.map((s, k) => { const r = D.results[k]; return `<li>${esc(D.bots[s].name)} <span class="note">(${topColors(draftColorWeights(D.pools[s])).map(c => `<span class="pip ${c}"></span>`).join('')})</span> ${r ? (r.won ? '<span class="ok">✔ won</span>' : '<span class="warn">✖ lost</span>') : k === D.round ? '<span class="note">next</span>' : ''}</li>`; }).join('')}</ol>
        <div class="row draft-go">${done ? `<button class="btn primary" onclick="saveDraftDeck()">💾 Save this deck</button><button class="btn" onclick="profile.draft = null; saveProfile(); renderDraft();">🃏 New draft</button>`
            : `<button class="btn primary" onclick="draftNextRound()">⚔️ Play round ${D.round + 1} vs ${esc(D.bots[D.opps[D.round]].name)}</button><button class="btn" onclick="profile.draft.stage = 'build'; renderDraft();">🛠️ Change your deck</button><button class="btn small" onclick="leaveDraft()">Leave draft</button>`}</div>`;
}
function saveDraftDeck() {
    const D = profile.draft;
    if (!D) return;
    const d = draftMyDeck(D), cards = {};
    d.entries.forEach(e => { cards[e.card.id] = (cards[e.card.id] || 0) + e.n; });
    profile.decks.push({ id: `d${Date.now()}`, name: `${D.name} draft deck (${D.started})`, format: 'limited', cards, commander: null });
    saveProfile();
    toast('Saved to your decks (Limited, 40 cards).');
}
// Testing: ?autoplay&format=draft&set=mrd - the whole table drafts by itself, then seat 1's deck plays another drafter's
async function autoDraftTest(code) {
    const set = DRAFT_SETS.find(s => s.code === code) || DRAFT_SETS[0];
    const packs = await drawPacks(set.code, 'play', DRAFT_SEATS * DRAFT_PACKS);
    const slim = pk => pk.cards.map(p => ({ id: p.id, foil: !!p.foil }));
    const D = { set: set.code, name: set.name, stage: 'pick', packNo: 0, pickNo: 0, packs: packs.slice(0, 8).map(slim), later: [packs.slice(8, 16).map(slim), packs.slice(16).map(slim)],
        pools: Array.from({ length: 8 }, () => []), bots: Array.from({ length: 8 }, (_, i) => ({ name: `Drafter ${i + 1}`, jitter: 0.3 })), main: [], basics: {}, round: 0, results: [], opps: [] };
    while (D.stage === 'pick') {
        for (let s = 0; s < 8; s++) if (D.packs[s].length) takeDraftPick(D, s, botPickIndex(D, s));
        const dir = D.packNo === 1 ? -1 : 1, next = [];
        D.packs.forEach((pk, s) => { next[(s + dir + 8) % 8] = pk; });
        D.packs = next;
        if (!D.packs[0].length) { D.packNo++; if (D.packNo < 3) D.packs = D.later.shift(); else finishDrafting(D); }
    }
    const q = new URLSearchParams(location.search);
    const a = Number(q.get('a') || 0), b = Number(q.get('b') || D.opps[0]);
    return { A: botDeck(D, a), B: botDeck(D, b), D };
}

