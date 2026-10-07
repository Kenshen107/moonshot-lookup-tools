// =====================================================================
// Drawing the table
// =====================================================================
const PHASE_LABEL = { setup: 'Setting up', beginning: 'Beginning', upkeep: 'Upkeep', main1: 'Main phase', declareAttackers: 'Declare attackers', declareBlocks: 'Declare blockers', afterBlocks: 'Combat', combatDamage: 'Combat damage', main2: 'Second main phase', end: 'End step' };

function cardImg(card, big) {
    const src = big ? (card.img || card.imgS) : (card.imgS || card.img);
    return src ? `<img src="${src}" alt="${esc(card.name)}" loading="lazy">`
        : `<span class="noimg">${esc(card.name)}${card.power !== undefined ? `<br>${esc(card.power)}/${esc(card.toughness)}` : ''}</span>`;
}

const COUNTER_KINDS = [['loyalty', '🔷'], ['charge', '🔌'], ['oil', '🛢️'], ['stun', '💫'], ['shield', '🔰'], ['lore', '📖'], ['time', '⏳'], ['ice', '🧊'], ['fade', '🌫️'], ['age', '📅'], ['quest', '🗝️'], ['level', '📶'], ['flood', '🌊'], ['other', '🔹']];
const counterIcon = k => (COUNTER_KINDS.find(x => x[0] === k) || [k, '🔹'])[1];
function permHTML(o, count = 1) {
    const r = Rx(o);
    const m = G.mode;
    const cls = ['perm'];
    if (r.kind === 'land') cls.push('land');
    if (o.tapped) cls.push('tapped');
    if (G.attackers.includes(o.uid)) cls.push('attacking');
    const blocking = Object.entries(G.blocks).find(([, bs]) => bs.includes(o.uid));
    if (blocking) cls.push('blocking');
    let selectable = false;
    if (m && m.type === 'target') selectable = m.valid.some(v => v.o && v.o.uid === o.uid);
    if (m && m.type === 'attack') { selectable = o.owner === G.view && canAttackWith(o); if (m.sel.has(o.uid)) cls.push('attacking'); }
    if (m && m.type === 'block') selectable = (o.owner === G.view && isCreature(o) && !o.tapped) || (o.owner !== G.view && G.attackers.includes(o.uid) && !!m.picked);
    if (m && m.type === 'pay' && o.owner === G.view) selectable = helpsPay(me(), o);
    if (selectable) cls.push('selectable');
    if (m && m.type === 'block' && m.picked === o.uid) cls.push('picked');
    const chips = [];
    if (o.isCommander) chips.push('<span class="chip">👑</span>');
    if (o.counters > 0) chips.push(`<span class="chip c-plus" title="${o.counters} +1/+1 counter${o.counters === 1 ? '' : 's'}">+${o.counters}</span>`);
    if (o.counters < 0) chips.push(`<span class="chip c-minus" title="${-o.counters} -1/-1 counter${o.counters === -1 ? '' : 's'}">−${-o.counters}</span>`);
    Object.entries(o.ctr || {}).forEach(([k, n]) => chips.push(`<span class="chip" title="${n} ${esc(k)} counter${n === 1 ? '' : 's'}">${counterIcon(k)}${n}</span>`));
    if (o.tp || o.tq || o.tkw.length) chips.push(`<span class="chip c-temp" title="Until end of turn: ${[o.tp || o.tq ? `${o.tp >= 0 ? '+' : ''}${o.tp}/${o.tq >= 0 ? '+' : ''}${o.tq}` : '', ...o.tkw].filter(Boolean).join(', ')}">⏱</span>`);
    if (o.dmg) chips.push(`<span class="chip c-dmg" title="${o.dmg} damage marked (wears off at end of turn)">💥${o.dmg}</span>`);
    if (isCreature(o) && o.sick && !has(o, 'haste') && o.owner === G.active) chips.push('<span class="chip sick" title="Summoning sick">💤</span>');
    if (allPerms().some(a => a.attachedTo === o.uid)) chips.push(`<span class="chip" title="${esc(allPerms().filter(a => a.attachedTo === o.uid).map(a => a.card.name).join(', '))}">🛡️</span>`);

    let pt = '';
    if (isCreature(o)) {
        const p = pow(o), t = tou(o);
        const up = p > Number(o.card.power) || t > Number(o.card.toughness);
        pt = `<span class="pt${o.dmg ? ' hurt' : up ? ' up' : ''}">${p}/${t - o.dmg}</span>`;
    }
    const blockedAtk = blocking && onBf(Number(blocking[0]));
    const blockLabel = blockedAtk ? `<span class="blocklabel">blocks ${esc(blockedAtk.card.name.split(',')[0])}</span>` : '';
    if (count > 1) cls.push('pile');
    return `<button type="button" class="${cls.join(' ')}" data-uid="${o.uid}" onclick="permClick(${o.uid})" title="${esc(o.card.name)}${count > 1 ? ` ×${count}` : ''}">${cardImg(o.card)}<span class="chips">${chips.join('')}</span>${pt}${blockLabel}${count > 1 ? `<span class="pile-n">×${count}</span>` : ''}</button>`;
}
// Identical permanents share one pile (lands and others from 2, creatures
// from 3, only while nothing is being chosen) so a full board fits.
function groupPerms(list, min) {
    const m = G.mode;
    const out = [], byKey = new Map();
    list.forEach(o => {
        const plain = !m && !o.attachedTo && !allPerms().some(a => a.attachedTo === o.uid) && !o.counters && !Object.keys(o.ctr || {}).length && !o.dmg && !o.tp && !o.tq && !o.tkw.length
            && !G.attackers.includes(o.uid) && !Object.values(G.blocks).some(bs => bs.includes(o.uid)) && !o.isCommander;
        if (!plain) { out.push([o]); return; }
        const key = `${o.card.id}|${o.tapped}|${isCreature(o) && o.sick && !has(o, 'haste')}|${o.token}`;
        if (byKey.has(key)) byKey.get(key).push(o);
        else { const g = [o]; byKey.set(key, g); out.push(g); }
    });
    return out.flatMap(g => g.length >= min ? [g] : g.map(o => [o]));
}

// Laid out like MTG Arena and the tournament table rules: creatures in the
// front row (toward the middle), lands in the back row by the player, other
// permanents to the right of the lands. Auras and Equipment are tucked
// behind the creature they're on.
function sideHTML(P) {
    const tucked = o => !!(o.attachedTo && onBf(o.attachedTo));
    const lands = P.bf.filter(o => Rx(o).kind === 'land' && !tucked(o));
    const creatures = P.bf.filter(o => isCreature(o) && !tucked(o));
    const other = P.bf.filter(o => !isCreature(o) && Rx(o).kind !== 'land' && !tucked(o));
    const lane = (list, extra = '', min = 2) => `<div class="lane ${extra}">${groupPerms(list, min).map(g => permWrapHTML(g[0], g.length)).join('')}</div>`;
    const power = creatures.reduce((a, o) => a + Math.max(0, pow(o)), 0);
    const untapped = lands.filter(o => !o.tapped).length;
    const front = `<div class="row-front"><span class="board-sum" title="Creatures and their total power">${creatures.length ? `⚔️ ${creatures.length} · power ${power}` : 'No creatures'}</span>${creatures.length ? lane(creatures, 'creatures', 3) : ''}</div>`;
    const back = `<div class="row-back"><div class="back-lands" title="Lands: ${lands.length}, ${untapped} untapped">${lane(lands, 'lands')}</div>${other.length ? `<div class="back-other">${lane(other, 'stack')}</div>` : ''}</div>`;
    return you(P) ? front + back : back + front;
}
// A permanent plus whatever is attached to it, tucked behind (tap one to see it)
function permWrapHTML(o, count) {
    const att = allPerms().filter(a => a.attachedTo === o.uid);
    if (!att.length) return permHTML(o, count);
    return `<div class="perm-wrap" style="--tucks:${att.length}">${att.map((a, i) => `<button type="button" class="tuck" style="--i:${i}" data-uid="${a.uid}" onclick="permClick(${a.uid})" title="${esc(a.card.name)} (attached)">${cardImg(a.card)}</button>`).join('')}${permHTML(o, count)}</div>`;
}

function manaSummary(P) {
    const floating = (P.pool || []).length ? `<span class="floating" title="Mana in your pool: it empties at the end of the step">Pool ${pipsHTML(P.pool.map(c => c[0]))}</span>` : '';
    return manaSourcesSummary(P) + floating;
}
function manaSourcesSummary(P) {
    const srcs = manaSources(P);
    const counts = {};
    srcs.forEach(o => { const m = manaOf(o); const key = m.colors.length > 1 ? 'any' : m.colors[0]; counts[key] = (counts[key] || 0) + m.n; });
    const total = availableMana(P);
    return `<span class="pool" title="Untapped mana">⚡ ${total}${Object.entries(counts).map(([c, n]) => c === 'any' ? ` · ${n} multi` : ` · ${n}<span class="pip ${c}"></span>`).join('')}</span>`;
}

function barHTML(P) {
    const m = G.mode;
    const targetable = m && m.type === 'target' && m.valid.some(v => v.p && v.p.i === P.i);
    const cmd = P.command.map(o => `<button type="button" class="btn small" onclick="showGameCard(${o.uid})">👑 ${esc(o.card.name.split(',')[0])}${P.tax ? ` (+${P.tax * 2})` : ''}</button>`).join('');
    return `
        <span class="who">${you(P) ? '🧙 You' : `🤖 ${esc(P.name)}`}</span>
        <button type="button" class="life${targetable ? ' targetable' : ''}" onclick="pickTarget({ p: G.players[${P.i}] })" ${targetable ? '' : 'tabindex="-1"'} aria-label="${you(P) ? 'Your' : `${esc(P.name)}'s`} life: ${P.life}">❤️ ${P.life}</button>
        ${G.format === 'commander' ? `<span class="zone-count" title="Commander damage taken (21 loses)">⚔️ ${P.cmdDmg}/21</span>` : ''}
        ${G.monarch === P.i ? '<span class="pc" title="The monarch draws a card at the end of their turn; deal them combat damage to take it">👑 Monarch</span>' : ''}${P.poison ? `<span class="pc poison" title="Poison counters (10 loses)">☠️ ${P.poison}/10</span>` : ''}${P.energy ? `<span class="pc" title="Energy counters">🔋 ${P.energy}</span>` : ''}${P.exp ? `<span class="pc" title="Experience counters">🎓 ${P.exp}</span>` : ''}
 ${P === me() && P.bf.some(o => Rx(o).peekTop) && P.library.length ? `<span class="pc" title="You may look at the top card of your library any time">👁 ${esc(P.library[P.library.length - 1].card.name)}</span>` : ''}
        <button type="button" class="btn small desk-only" onclick="playerSheet(${P.i})" title="Track life, poison, energy and experience">🧮</button>
        <span class="zone-count" title="Library">📚 ${P.library.length}</span>
        <button type="button" class="zone-count zone-btn" title="Graveyard: tap to look" onclick="showGraveyard(${P.i})">🪦 ${P.gy.length}</button>
        ${P.i === 1 ? (handRevealed(P) ? `<button type="button" class="zone-count" onclick="showRevealedHand(${P.i})" title="Telepathy: their hand is revealed">✋ ${P.hand.length} 👁</button>` : `<span class="zone-count">✋ ${P.hand.length}</span>`) + `<span class="opp-hand">${'<i></i>'.repeat(Math.min(P.hand.length, 12))}</span>` : manaSummary(P)}
        <span class="cmd-zone">${cmd}</span>
        ${P.i === 1 ? `<span class="note deckname" style="margin-left:auto;">${esc(P.deckName)}${P.source ? ` · ${esc(P.source)}` : ''}</span>` : `<span style="margin-left:auto;" class="row desk-only"><button class="btn small danger" onclick="concede()">Concede</button></span><button type="button" class="btn small phone-only gm-btn" onclick="gameMenu()" aria-label="Game menu: log, life tracker, mana mode, concede">⋯</button>`}`;
}

// Phones: the game menu (log, trackers, paying mana, concede) and the full log
function gameMenu() {
    menuSheet('Game', `<div class="menu-list">
        <button class="btn" onclick="logSheet()">📜 Game log</button>
        <button class="btn" onclick="closeSheet(); playerSheet(0)">🧮 Your life & counters</button>
        <button class="btn" onclick="closeSheet(); playerSheet(1)">🧮 ${esc(foe().name)}'s life & counters</button>
        <div class="seg" role="group" aria-label="Paying mana" style="width:100%;"><button type="button" style="flex:1; padding:10px;" data-mm="manual" aria-pressed="${manaMode === 'manual'}" onclick="setManaMode('manual'); gameMenu()">🖐 Tap lands myself</button><button type="button" style="flex:1; padding:10px;" data-mm="auto" aria-pressed="${manaMode === 'auto'}" onclick="setManaMode('auto'); gameMenu()">⚡ Auto-pay</button></div>
        <p class="note">${esc(foe().deckName)}${foe().source ? ` · ${esc(foe().source)}` : ''}</p>
        <button class="btn danger" onclick="closeSheet(); concede()">🏳️ Concede</button></div>`);
}
// Telepathy (Magic 2010): a player who controls it sees the opponent's hand
function handRevealed(P) { return !!G && G.players[1 - P.i].bf.some(x => Rx(x).telepathy && !lostAbilities(x)); }
function showRevealedHand(i) {
    const P = G.players[i];
    if (!handRevealed(P)) return;
    showModal(`<h2>${esc(P.name)}'s hand (revealed)</h2><div class="pick-grid">${P.hand.map(o => `<button type="button" class="pick-card" title="${esc(o.card.name)}" onclick="closeModal()">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}</button>`).join('') || '<p class="note">No cards.</p>'}</div><div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
}
function logSheet() {
    menuSheet('Game log', `<div class="log" id="logSheetBody" style="max-height:60vh; font-size:0.9rem;">${G.log.map(l => `<div>${esc(l)}</div>`).join('')}</div>`);
    const b = $('logSheetBody'); if (b) b.scrollTop = b.scrollHeight;
}
// ---- Play-by-play (owner's request 2026-10-07: the opponent did everything at once) ----
// What the opponent does is shown one step at a time in the middle of the table,
// with the card: a cast, land, ability, attack or block starts a step, and what
// follows from it (enters, dies, damage) is added under it. The computer waits
// for each step (actDrain) before its next action, and every question to you
// waits until the steps so far have been shown. Tap the panel to skip ahead.
const ACT_MAJOR = /'s turn —|\b(?:casts?|plays?|activates?|attacks? with|equips?|crews?|cycles?|saddles?|foretells?|counters?)\b|^Blocks:|^No blocks/;
const ACT_MS = 1700, ACT_QUICK_MS = 1200, ACT_SUB_MS = 900, ACT_MAX_SUBS = 5;
let actQ = [], actCur = null, actTimer = null, actWaiters = [];
function actOn() { return !AUTOPLAY && !!G && G.players.length === 2 && !G.hotseat && !G.over && !$('game').classList.contains('hidden'); }
const actBusy = () => actOn() && (!!actCur || actQ.length > 0);
// The cards a line names, from every zone the players can see (longest names first)
function actCards(msg) {
    const seen = new Map();
    G.players.forEach(P => [P.bf, P.gy, P.exile, P.command, P.isAI ? P.hand : []].forEach(z => z.forEach(o => { if (o && o.card && !seen.has(o.card.name)) seen.set(o.card.name, o.card); })));
    G.stack.forEach(it => { if (it.o && it.o.card && !seen.has(it.o.card.name)) seen.set(it.o.card.name, it.o.card); });
    let rest = msg;
    const found = [];
    [...seen.keys()].sort((a, b) => b.length - a.length).forEach(n => {
        const at = rest.indexOf(n);
        if (at < 0) return;
        found.push({ at, card: seen.get(n) });
        rest = rest.split(n).join(' '.repeat(n.length));
    });
    return found.sort((a, b) => a.at - b.at).map(f => f.card).slice(0, 4);
}
function showActBanner(msg) {
    if (!actOn()) return;
    if (/^You (?:draw|tap|add)\b/.test(msg) || /^You /.test(msg) && !/\b(?:take|lose|are|discard|sacrifice)\b/.test(msg)) return;
    const theirs = G.players[G.active] && G.players[G.active].isAI;
    const cards = actCards(msg);
    // On your own turn, only what the opponent does and what happens to you
    if (!theirs && !(msg.includes(foe().name) || /^(?:Blocks:|You )/.test(msg) || cards.some(c => foe().bf.concat(foe().gy, foe().exile, foe().command).some(o => o.card === c) && !me().bf.some(o => o.card === c)))) return;
    const major = ACT_MAJOR.test(msg);
    const last = actQ.length ? actQ[actQ.length - 1] : actCur;
    if (!major && last && last.subs.length < ACT_MAX_SUBS) {
        last.subs.push(msg);
        cards.forEach(c => { if (last.cards.length < 4 && !last.cards.includes(c)) last.cards.push(c); });
        last.ms += ACT_SUB_MS / 2;
        if (last === actCur) { renderAct(); actSchedule(ACT_SUB_MS); }
        return;
    }
    actQ.push({ msg, subs: [], cards, ms: !major ? ACT_SUB_MS : /'s turn —| plays? /.test(msg) ? ACT_QUICK_MS : ACT_MS, turn: /'s turn —/.test(msg) });
    if (!actCur) actNext();
}
function actSchedule(minLeft) {
    const left = Math.max(minLeft || 0, actCur.end - Date.now());
    actCur.end = Date.now() + left;
    clearTimeout(actTimer);
    actTimer = setTimeout(actNext, left);
}
function renderAct() {
    const el = $('actBanner');
    if (!el || !actCur) return;
    const a = actCur, big = a.cards.length === 1;
    el.classList.toggle('turn', a.turn);
    el.innerHTML = `${a.cards.length ? `<div class="act-cards${big ? ' one' : ''}">${a.cards.map(c => (c.img || c.imgS) ? `<img src="${big ? (c.img || c.imgS) : (c.imgS || c.img)}" alt="${esc(c.name)}">` : `<span class="noimg">${esc(c.name)}</span>`).join('')}</div>` : ''}
        <div class="act-text"><strong>${esc(a.msg.replace(/^— | —$/g, ''))}</strong>${a.subs.map(s => `<div>${esc(s)}</div>`).join('')}
        <small>${actQ.length ? `${actQ.length} more · tap to skip` : 'tap to close'}</small></div>`;
}
function actNext() {
    clearTimeout(actTimer);
    const el = $('actBanner');
    actCur = actOn() ? actQ.shift() || null : null;
    if (!actCur) {
        actQ = [];
        if (el) el.classList.remove('show', 'turn');
        actWaiters.splice(0).forEach(r => r());
        return;
    }
    actCur.end = Date.now() + actCur.ms;
    renderAct();
    if (el) { el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
    actSchedule(0);
}
function actSkip() { if (actCur) actNext(); }
// Wait until everything queued so far has been shown (at most 20 seconds)
function actDrain() {
    if (!actBusy()) return Promise.resolve();
    return new Promise(r => { actWaiters.push(r); setTimeout(r, 20000); });
}
function actReset() { actQ = []; actCur = null; clearTimeout(actTimer); const el = $('actBanner'); if (el) el.classList.remove('show', 'turn'); actWaiters.splice(0).forEach(r => r()); }
// ---- Pass and play (owner's request 2026-10-06): two accounts on one device ----
// The table always shows the player holding the device (G.view). When a decision
// belongs to the other player, a cover hides the table until they take over.
function decider() {
    if (!G || G.over) return null;
    if (G.mode && G.mode.who !== undefined) return G.mode.who;
    if (G.busy || !['main1', 'main2', 'declareAttackers', 'afterBlocks'].includes(G.phase)) return null;
    return G.active;
}
let coverWait = null;
function handTo(P) {
    if (!G || !G.hotseat || G.view === P.i) return Promise.resolve();
    if (coverWait && coverWait.i === P.i) return coverWait.p;
    let done;
    const p = new Promise(r => { done = r; });
    coverWait = { i: P.i, p };
    const el = $('hsCover');
    el.innerHTML = `<div class="hs-box"><div class="hs-ico">🔒</div><h2>Pass to ${esc(P.name)}</h2><p class="note">${esc(P.name)}, it's your ${G.active === P.i ? 'turn' : 'decision'}. ${esc(G.players[1 - P.i].name)}, no peeking at their hand!</p><button class="btn primary" id="hsGo">I'm ${esc(P.name)} - show my cards</button></div>`;
    el.classList.remove('hidden');
    $('hsGo').onclick = () => { el.classList.add('hidden'); el.innerHTML = ''; G.view = P.i; coverWait = null; closeSheet(); renderGame(); done(); };
    return p;
}
function stackHTML() {
    if (!G.stack.length) return '';
    const m = G.mode;
    return `<div class="stackbar" aria-label="The stack, top first"><span class="lane-label">Stack ↓</span>${G.stack.slice().reverse().map((it, i) => {
        const sel = m && m.type === 'target' && m.valid.some(v => v.item && v.item.id === it.id);
        return `<button type="button" class="stack-item${i === 0 ? ' top' : ''}${sel ? ' selectable' : ''}" onclick="stackClick(${it.id})" title="${esc(it.name)}">${it.o.card.imgS ? `<img src="${it.o.card.imgS}" alt="">` : ''}<span>${esc(it.name)}${it.target ? ` → ${esc(targetName(it.target))}` : ''}</span></button>`;
    }).join('')}</div>`;
}
function stackClick(id) {
    const it = G.stack.find(x => x.id === id);
    if (!it) return;
    if (G.mode && G.mode.type === 'target') { pickTarget({ item: it }); return; }
    showGameCard(it.o.uid);
}

// The mid bar: the phase strip, what you can do now, and the turn button,
// which stays in the same spot on every phase and both players' turns.
function midHTML() {
    return `<div class="mid-main">${phaseStripHTML()}${stackHTML()}<div class="mid-controls">${midControlsHTML()}</div></div>${turnButtonHTML()}`;
}
const PHASE_STEPS = [['Upkeep', ['beginning', 'upkeep']], ['Main 1', ['main1']], ['Combat', ['declareAttackers', 'declareBlocks', 'afterBlocks', 'combatDamage']], ['Main 2', ['main2']], ['End', ['end']]];
function phaseStripHTML() {
    if (G.over || G.phase === 'setup') return '';
    return `<ol class="phase-strip ${G.active === G.view ? 'mine' : 'theirs'}" aria-label="Turn ${G.turn}: ${G.active === G.view ? 'your turn' : `${esc(foe().name)}'s turn`}">
        <li class="whose">${G.active === G.view ? 'Your turn' : `${esc(foe().name)}'s turn`}</li>${PHASE_STEPS.map(([label, ids]) => `<li${ids.includes(G.phase) ? ' class="now" aria-current="step"' : ''}>${label}</li>`).join('')}</ol>`;
}
function turnButtonHTML() {
    if (G.over) return '';
    const m = G.mode;
    let label = 'End turn', sub = '', dis = false, title = 'End your turn';
    if (G.active !== G.view) { label = 'Their turn'; sub = m && m.type === 'block' ? 'Block, then Done' : m && m.type === 'respond' ? 'Respond or let it resolve' : 'Opponent is playing'; dis = true; title = `${foe().name} is taking their turn`; }
    else if (m && ['target', 'pay', 'block', 'respond'].includes(m.type)) { dis = true; sub = m.type === 'pay' ? 'Finish paying first' : 'Finish choosing first'; title = 'Finish or cancel what you are choosing first'; }
    else if (G.busy) { dis = true; sub = 'Resolving…'; }
    else if (m && m.type === 'attack') sub = 'Skips combat';
    else if (G.phase === 'afterBlocks') sub = 'Deals damage first';
    else if (G.phase === 'main1') sub = 'Skips combat';
    return `<button type="button" id="turnBtn" class="turn-btn${dis ? '' : ' ready'}" ${dis ? 'disabled' : ''} onclick="endMyTurn()" title="${esc(title)}"><span class="tb-label">${label}${G.active === G.view ? ' ⏭' : ''}</span>${sub ? `<span class="tb-sub">${esc(sub)}</span>` : ''}</button>`;
}
// A short hint about what you can do right now
function nextStepHint() {
    const P = me();
    if (G.active !== G.view || G.busy || G.mode || !MAIN.includes(G.phase)) return '';
    const land = P.hand.some(o => canPlayLand(P, o));
    const cast = [...P.hand, ...P.command].some(o => Rx(o).kind !== 'land' && canCastNow(P, o) && canPay(P, o));
    if (land && cast) return 'Play a land, or tap a glowing card to cast it.';
    if (land) return 'You can play a land this turn.';
    if (cast) return 'Tap a glowing card in your hand to cast it.';
    return G.phase === 'main1' && P.bf.some(canAttackWith) ? 'Nothing left to cast - go to combat or end your turn.' : '';
}

function midControlsHTML() {
    if (G.over) return `<span class="phase">Game over</span><button class="btn primary" onclick="leaveGame()">Leave the table</button>`;
    const m = G.mode;
    const phase = '';
    if (m && m.type === 'pay') {
        const P = me(), need = stillNeeded(P, m.cost, m.extra, m.opts);
        const pool = (P.pool || []).map(c => c[0]);
        return `<span class="prompt">💧 Pay for ${esc(m.label)}: tap your glowing lands. Still needed <strong class="need">${esc(costSymbols(need))}</strong>${pool.length ? ` · in pool ${pipsHTML(pool)}` : ''}</span><button class="btn primary" onclick="autoPayRest()" title="Let the game pick the sources for the rest">⚡ Auto-pay the rest</button><button class="btn" onclick="cancelPay()">Cancel</button>`;
    }
    if (m && m.type === 'target') {
        return `${phase}<span class="prompt">🎯 Choose a target for ${esc(m.source.card.name)}</span>${m.cancelable ? '<button class="btn" onclick="cancelTarget()">Cancel</button>' : ''}`;
    }
    if (m && m.type === 'attack') {
        return `${phase}<span class="prompt">Tap creatures to attack (${m.sel.size})</span><button class="btn primary" onclick="confirmAttack()">⚔️ Attack${m.sel.size ? ` with ${m.sel.size}` : ''}</button><button class="btn" onclick="cancelAttack()">Back</button>`;
    }
    if (m && m.type === 'respond') {
        const it = m.item;
        return `${phase}<span class="prompt">↩️ ${esc(it.name)}${it.target ? ` (targeting ${esc(targetName(it.target))})` : ''} is on the stack. Cast an instant to respond, or:</span><button class="btn primary" onclick="passPriority()">✔ Let it resolve</button>`;
    }
    if (m && m.type === 'block') {
        return `${phase}<span class="prompt">🛡️ ${m.picked && onBf(m.picked) ? `Now tap the attacker ${esc(onBf(m.picked).card.name.split(',')[0])} should block` : 'Tap one of your creatures, then the attacker it blocks. You can cast instants now.'}</span><button class="btn primary" onclick="confirmBlocks()">✔ Done blocking</button>`;
    }
    if (G.active === G.view && !G.busy) {
        const hint = nextStepHint();
        const hintHTML = hint ? `<span class="hint">${esc(hint)}</span>` : '';
        if (G.phase === 'main1') return `${hintHTML}<button class="btn primary" onclick="goToCombat()">⚔️ Go to combat</button>`;
        if (G.phase === 'afterBlocks') return `<span class="prompt">Blocks are set. Cast a trick now, or:</span><button class="btn primary" onclick="dealDamage()">💥 Deal damage</button>`;
        if (G.phase === 'main2') return hintHTML || '<span class="hint">Second main phase: cast anything else, then end your turn.</span>';
    }
    return `<span class="note">${G.active === 1 ? `${esc(foe().name)} is thinking…` : ''}</span>`;
}

function handHTML() {
    const P = me();
    // Cards you may play from exile this turn sit at the end of your hand, marked
    const top = P.library[P.library.length - 1];
    const topCard = top && ((P.bf.some(x => Rx(x).castTopCreatures) && Rx(top).kind === 'creature') || pitTop(P) === top) ? [top] : [];
    const extraLands = MAIN.includes(G.phase) && G.active === G.view ? extraLandZones(P).filter(o => !topCard.includes(o)) : [];
    const gyModes = P.gy.filter(o => castAsOk(P, o, 'blitz') || lockerOk(P, o));
    return [...P.hand, ...P.exile.filter(o => o.playUntil >= G.turn || o.advReady || (o.foretoldTurn && o.foretoldTurn < G.turn) || (o.warpedTurn && o.warpedTurn < G.turn)), ...topCard, ...extraLands, ...gyModes].map(o => {
        const r = Rx(o);
        const playable = r.kind === 'land' ? canPlayLand(P, o) : (canCastNow(P, o) && canPay(P, o)) || ['blitz', 'escape'].some(md => { o.castAs = md; const ok = castAsOk(P, o, md) && canCastNow(P, o) && canPay(P, o); o.castAs = null; return ok; });
        return `<button type="button" class="hc${playable ? ' playable' : ''}${!P.hand.includes(o) ? ' from-exile' : ''}" data-uid="${o.uid}" onclick="showGameCard(${o.uid})" title="${esc(o.card.name)}">${cardImg(o.card, true)}${r.support !== 'full' ? `<span class="sup badge sup-${r.support}">${r.support === 'none' ? '!' : '~'}</span>` : ''}</button>`;
    }).join('') || '<span class="note">No cards in hand.</span>';
}

function renderGame() {
    if (!G || $('game').classList.contains('hidden')) return;
    if (G.hotseat && !G.over) { const d = decider(); if (d !== null && d !== G.view) handTo(G.players[d]); }
    $('oppBar').innerHTML = barHTML(foe());
    $('meBar').innerHTML = barHTML(me());
    $('oppSide').innerHTML = sideHTML(foe());
    $('meSide').innerHTML = sideHTML(me());
    $('midBar').innerHTML = midHTML();
    $('hand').innerHTML = handHTML();
    $('handCount').textContent = `Hand · ${me().hand.length}`;
    fitTable();
}

// ---- Fitting the table: battlefield cards shrink to fit; the hand fans out ----
let handSize = store.get('handSize', 'm');
function setHandSize(sz) {
    handSize = sz;
    store.set('handSize', sz);
    applyHandSize();
    fitTable();
}
function applyHandSize() {
    applyManaMode();
    $('game').dataset.hand = handSize;
    document.querySelectorAll('.seg [data-hs]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hs === handSize)));
}
function fitSide(side) {
    const front = side.querySelector('.lane.creatures');
    const back = side.querySelector('.row-back');
    const H = side.clientHeight - 14;
    const phone = innerWidth < 700;
    // Back row: lands and other permanents, about a quarter of the side
    // While you're paying, your lands grow so they're easy to tap
    const paying = G && G.mode && G.mode.type === 'pay' && side.id === 'meSide';
    side.style.setProperty('--land-w', `${Math.max(paying ? 44 : 32, Math.min(paying ? 84 : 70, Math.round(H * (paying ? 0.4 : 0.27) * 63 / 88)))}px`);
    if (!front) return;
    front.classList.remove('crowded');
    const items = [...front.children];
    items.forEach(c => { c.style.marginLeft = ''; });
    const Hf = H - (back ? back.offsetHeight : 0) - 10 - (front.querySelector('.perm-wrap') ? 30 : 0);
    const W = front.clientWidth, n = items.length;
    // Like Arena, never shrink cards past readable: below this they overlap instead
    const minW = phone ? 46 : 64;
    let w = 132, fits = false;
    for (; w >= minW; w -= 4) {
        const perRow = Math.max(1, Math.floor((W + 8) / (w + 8)));
        if (Math.ceil(n / perRow) * (w * 88 / 63 + 12) <= Hf) { fits = true; break; }
    }
    if (!fits) {
        // One row at the largest readable size, cards cascading over each other
        w = Math.max(minW, Math.min(132, Math.floor((Hf - 12) * 63 / 88)));
        front.classList.add('crowded');
        const step = n > 1 ? Math.min(w + 8, (W - w) / (n - 1)) : 0;
        items.forEach((c, i) => { if (i) c.style.marginLeft = `${Math.round(step - w)}px`; });
    }
    side.style.setProperty('--card-w', `${w}px`);
}
function fitHand() {
    const el = $('hand');
    if (isPhone()) { el.querySelectorAll('.hc').forEach(c => { c.style.marginLeft = ''; c.style.zIndex = ''; c.style.removeProperty('--rot'); c.style.removeProperty('--dip'); }); return; }
    const cards = [...el.querySelectorAll('.hc')];
    if (!cards.length) return;
    const W = el.clientWidth - 56, w = cards[0].offsetWidth, n = cards.length;
    const over = n * w + (n - 1) * 6 > W && n > 1;
    const step = over ? (W - w) / (n - 1) : w + 6;
    cards.forEach((c, i) => {
        c.style.marginLeft = i ? `${Math.round(step - w)}px` : '0';
        // A gentle fan: small tilt, outer cards dip a little
        const k = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
        c.style.setProperty('--rot', over ? `${(k * 3).toFixed(2)}deg` : '0deg');
        c.style.setProperty('--dip', over ? `${Math.round(k * k * 6)}px` : '0px');
        c.style.zIndex = String(i + 1);
    });
}
function fitTable() {
    if (!G || $('game').classList.contains('hidden')) return;
    applyHandSize();
    fitSide($('oppSide'));
    fitSide($('meSide'));
    fitHand();
}
window.addEventListener('resize', () => fitTable());
// Big preview of whatever card you point at (mouse only)
document.addEventListener('mouseover', e => {
    const peek = $('cardPeek');
    if (!peek || !G || !matchMedia('(hover: hover)').matches) return;
    const el = e.target.closest && e.target.closest('#game [data-uid]');
    if (!el) { peek.classList.add('hidden'); return; }
    const o = findObj(Number(el.dataset.uid));
    if (!o || !o.card.img) { peek.classList.add('hidden'); return; }
    const rect = el.getBoundingClientRect();
    peek.innerHTML = `<img src="${o.card.img}" alt="">${onBf(o.uid) && isCreature(o) ? `<div class="peek-stats">${pow(o)}/${tou(o) - o.dmg}${o.counters ? ` · ${o.counters > 0 ? '+1/+1' : '-1/-1'} ×${Math.abs(o.counters)}` : ''}</div>` : ''}`;
    peek.classList.toggle('left', rect.left + rect.width / 2 > innerWidth / 2);
    peek.classList.remove('hidden');
});

// ---- Tracking counters by hand (card popup and the 🧮 player button) ----
function counterTrackerHTML(o) {
    const n = o.counters;
    const rows = Object.entries(o.ctr || {}).map(([k, v]) => `<div class="trk-row"><span>${counterIcon(k)} ${esc(k)}</span><button class="btn small" onclick="adjCounter(${o.uid}, '${esc(k)}', -1)" aria-label="Remove a ${esc(k)} counter">−</button><strong>${v}</strong><button class="btn small" onclick="adjCounter(${o.uid}, '${esc(k)}', 1)" aria-label="Add a ${esc(k)} counter">+</button></div>`).join('');
    return `<div class="tracker"><div class="lane-label">Counters</div>
        <div class="trk-row"><span>${n < 0 ? '−1/−1' : '+1/+1'}</span><button class="btn small" onclick="adjCounter(${o.uid}, 'pm', -1)" aria-label="Remove a +1/+1 or add a -1/-1 counter">−</button><strong>${Math.abs(n)}</strong><button class="btn small" onclick="adjCounter(${o.uid}, 'pm', 1)" aria-label="Add a +1/+1 or remove a -1/-1 counter">+</button><span class="note">+1/+1 and −1/−1 cancel out</span></div>
        ${rows}
        <div class="trk-row"><select id="trkKind" aria-label="Counter type">${COUNTER_KINDS.filter(([k]) => !(k in (o.ctr || {}))).map(([k, i]) => `<option value="${k}">${i} ${k}</option>`).join('')}</select><button class="btn small" onclick="adjCounter(${o.uid}, $('trkKind').value, 1)">Add counter</button></div>
    </div>`;
}
function adjCounter(uid, kind, d) {
    const o = onBf(uid);
    if (!o) return;
    const who = o.card.name;
    if (kind === 'pm') {
        o.counters += d;
        log(`${d > 0 ? (o.counters > 0 ? `A +1/+1 counter goes on ${who}` : `A -1/-1 counter comes off ${who}`) : (o.counters < 0 ? `A -1/-1 counter goes on ${who}` : `A +1/+1 counter comes off ${who}`)} (tracked by hand).`);
    } else {
        o.ctr[kind] = Math.max(0, (o.ctr[kind] || 0) + d);
        if (!o.ctr[kind]) delete o.ctr[kind];
        log(`${who}: ${o.ctr[kind] || 0} ${kind} counter${o.ctr[kind] === 1 ? '' : 's'} (tracked by hand).`);
    }
    sba();
    renderGame();
    if (onBf(uid)) showGameCard(uid); else closeSheet();
}
const PLAYER_COUNTERS = [['life', '❤️ Life'], ['poison', '☠️ Poison (10 loses)'], ['energy', '🔋 Energy'], ['exp', '🎓 Experience']];
function showGraveyard(i) {
    const P = G.players[i];
    if (!P.gy.length) { toast('The graveyard is empty.'); return; }
    window.__gy = k => { closeModal(); const o = P.gy[k]; if (o) showGameCard(o.uid); };
    showModal(`<h2>🪦 ${you(P) ? 'Your graveyard' : `${esc(P.name)}'s graveyard`}</h2>${P.i === 0 && P.gy.some(o => Rx(o).flashback) ? '<p class="note">Cards with flashback can be cast from here.</p>' : ''}
        <div class="pick-grid">${P.gy.map((o, k) => `<button type="button" class="pick-card" onclick="__gy(${k})" title="${esc(o.card.name)}">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}</button>`).join('')}</div>
        <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
}
function playerSheet(i) {
    const P = G.players[i];
    $('sheetHost').innerHTML = `<div class="sheet-bg" onclick="if (event.target === this) closeSheet()">
        <div class="sheet one" role="dialog" aria-label="Counters for ${esc(you(P) ? 'you' : P.name)}">
            <div><h3>🧮 ${you(P) ? 'Your counters' : esc(P.name)}</h3>
            <p class="note">Track life and player counters by hand. Changes go in the game log.</p>
            ${PLAYER_COUNTERS.map(([k, label]) => `<div class="trk-row"><span>${label}</span>
                ${k === 'life' ? `<button class="btn small" onclick="adjPlayer(${i}, '${k}', -5)">−5</button>` : ''}<button class="btn small" onclick="adjPlayer(${i}, '${k}', -1)">−</button><strong>${P[k]}</strong><button class="btn small" onclick="adjPlayer(${i}, '${k}', 1)">+</button>${k === 'life' ? `<button class="btn small" onclick="adjPlayer(${i}, '${k}', 5)">+5</button>` : ''}</div>`).join('')}
            <div class="actions"><button class="btn" onclick="closeSheet()">Close</button></div></div>
        </div></div>`;
}
function adjPlayer(i, key, d) {
    const P = G.players[i];
    if (!P || G.over) return;
    P[key] = key === 'life' ? P[key] + d : Math.max(0, P[key] + d);
    const name = you(P) ? 'You' : P.name;
    log(`${name}: ${key === 'exp' ? 'experience' : key} ${P[key]} (tracked by hand).`);
    sba();
    renderGame();
    if (!G.over) playerSheet(i);
    else closeSheet();
}

