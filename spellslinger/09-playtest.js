// =====================================================================
// Playtester: goldfish any deck (or the one you're editing), like
// Moxfield's playtest. No opponent and no rules enforcement - move
// cards anywhere. Drag cards between zones, or tap a card for a menu.
// Keys: D draw, U untap all, N next turn, S shuffle, M mulligan.
// =====================================================================
let PT = null;
let ptUid = 1;
const PT_ZONES = { hand: 'Hand', bf: 'Battlefield', gy: 'Graveyard', exile: 'Exile', library: 'Library', command: 'Command zone' };

function playtestDeck(deck) {
    const d = deck || editing;
    if (!d) return;
    const cards = [];
    Object.entries(d.cards).forEach(([id, n]) => { const c = CARDS.get(id); if (c) for (let k = 0; k < n; k++) cards.push(c); });
    if (!cards.length) { toast('Add some cards first.'); return; }
    PT = { name: d.name, format: d.format, cards, commander: d.commander ? CARDS.get(d.commander) : null };
    $('playtest').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    ptRestart();
}
function playtestSaved(i) { playtestDeck(profile.decks[i]); }

function ptObj(card, extra) { return Object.assign({ uid: ptUid++, card, tapped: false, counters: 0 }, extra || {}); }

function ptRestart() {
    Object.assign(PT, { library: shuffle(PT.cards.map(c => ptObj(c))), hand: [], bf: [], gy: [], exile: [], command: PT.commander ? [ptObj(PT.commander)] : [],
        life: FORMATS[PT.format].life, turn: 1, mulligans: 0, log: [] , bottoming: 0 });
    ptDraw(7, true);
    ptLog('New game: drew 7.');
    ptRender();
}
function ptLog(msg) { PT.log.push(msg); if (PT.log.length > 30) PT.log.shift(); }
function ptDraw(n = 1, quiet) {
    for (let k = 0; k < n; k++) { const o = PT.library.shift(); if (!o) { toast('Your library is empty.'); break; } PT.hand.push(o); }
    if (!quiet) ptLog(`Drew ${n === 1 ? 'a card' : `${n} cards`}.`);
    ptRender();
}
function ptUntap() { PT.bf.forEach(o => { o.tapped = false; }); ptLog('Untapped everything.'); ptRender(); }
function ptNextTurn() { PT.turn++; PT.bf.forEach(o => { o.tapped = false; }); ptDraw(1, true); ptLog(`Turn ${PT.turn}: untap, draw.`); ptRender(); }
function ptShuffle() { shuffle(PT.library); ptLog('Shuffled the library.'); ptRender(); toast('Library shuffled.'); }
// London mulligan: shuffle the hand in, draw 7, then put one on the bottom per mulligan
function ptMulligan() {
    PT.library.push(...PT.hand.splice(0));
    shuffle(PT.library);
    PT.mulligans++;
    PT.hand = [];
    ptDraw(7, true);
    PT.bottoming = PT.mulligans;
    ptLog(`Mulligan ${PT.mulligans}: drew 7 - put ${PT.mulligans} on the bottom (tap a card in your hand).`);
    ptRender();
}
function ptAdjustLife(d) { PT.life += d; ptRender(); }
function ptFind(uid) {
    for (const z of Object.keys(PT_ZONES)) { const i = PT[z].findIndex(o => o.uid === uid); if (i >= 0) return { z, i, o: PT[z][i] }; }
    return null;
}
function ptMove(uid, to, where) {
    const f = ptFind(uid);
    if (!f) return;
    PT[f.z].splice(f.i, 1);
    const o = f.o;
    if (to !== 'bf') { o.tapped = false; o.counters = 0; }
    if (o.token && to !== 'bf') { ptLog(`${o.card.name} (token) left the battlefield and is gone.`); ptRender(); return; }
    if (to === 'library') { if (where === 'bottom') PT.library.push(o); else PT.library.unshift(o); }
    else PT[to].push(o);
    ptLog(`${o.card.name}: ${PT_ZONES[f.z]} → ${to === 'library' ? `${where === 'bottom' ? 'bottom' : 'top'} of library` : PT_ZONES[to]}.`);
    closePtMenu();
    ptRender();
}
function ptTap(uid) { const f = ptFind(uid); if (!f || f.z !== 'bf') return; f.o.tapped = !f.o.tapped; closePtMenu(); ptRender(); }
function ptCounter(uid, d) { const f = ptFind(uid); if (!f) return; f.o.counters = Math.max(0, f.o.counters + d); closePtMenu(); ptRender(); }
function ptToken() {
    showModal(`<h2>Create a token</h2>
        <div class="row" style="justify-content:center; margin:10px 0;">
            <input type="text" id="ptTokName" value="Soldier" aria-label="Token name" style="width:140px;">
            <input type="text" id="ptTokPT" value="1/1" aria-label="Power/toughness" style="width:60px;">
            <input type="text" id="ptTokN" value="1" aria-label="How many" style="width:50px;">
        </div>
        <div class="row" style="justify-content:center;"><button class="btn primary" onclick="ptMakeToken()">Create</button><button class="btn" onclick="closeModal()">Cancel</button></div>`);
}
function ptMakeToken() {
    const name = $('ptTokName').value.trim() || 'Token';
    const [p, t] = ($('ptTokPT').value.match(/\d+/g) || ['1', '1']);
    const n = Math.min(20, Math.max(1, parseInt($('ptTokN').value, 10) || 1));
    for (let k = 0; k < n; k++) PT.bf.push(ptObj({ id: `tok-${ptUid}`, name: `${name} token`, type: `Token Creature — ${name}`, text: '', power: p, toughness: t || p, img: null, imgS: null, cost: '', cmc: 0 }, { token: true }));
    ptLog(`Created ${n} ${p}/${t || p} ${name} token${n === 1 ? '' : 's'}.`);
    closeModal();
    ptRender();
}

function ptCardHTML(o, zone) {
    const land = /\bLand\b/.test(o.card.type) && !/\bCreature\b/.test(o.card.type);
    const img = o.card.imgS || o.card.img;
    return `<button type="button" class="pt-card${land && zone === 'bf' ? ' land' : ''}${o.tapped ? ' tapped' : ''}" draggable="true" data-uid="${o.uid}"
        onclick="ptCardClick(event, ${o.uid})" ondblclick="ptCardDouble(${o.uid})" ondragstart="ptDragStart(event, ${o.uid})" title="${esc(o.card.name)}">
        ${img ? `<img src="${zone === 'hand' ? (o.card.img || img) : img}" alt="${esc(o.card.name)}" draggable="false">` : `<span class="noimg">${esc(o.card.name)}${o.card.power !== undefined ? `<br>${esc(o.card.power)}/${esc(o.card.toughness)}` : ''}</span>`}
        ${o.counters ? `<span class="ctr">+${o.counters}</span>` : ''}</button>`;
}

function ptRender() {
    if (!PT || $('playtest').classList.contains('hidden')) return;
    const lands = PT.bf.filter(o => /\bLand\b/.test(o.card.type) && !/\bCreature\b/.test(o.card.type));
    const creatures = PT.bf.filter(o => /\bCreature\b/.test(o.card.type));
    const other = PT.bf.filter(o => !lands.includes(o) && !creatures.includes(o));
    const untappedLands = lands.filter(o => !o.tapped).length;
    $('ptTop').innerHTML = `
        <span class="title">🧪 Playtest · ${esc(PT.name)}</span>
        <span class="note">Turn ${PT.turn}</span>
        <span class="pt-life"><button class="btn small" onclick="ptAdjustLife(-1)" aria-label="Lose 1 life">−</button><b aria-label="Life">${PT.life}</b><button class="btn small" onclick="ptAdjustLife(1)" aria-label="Gain 1 life">+</button></span>
        <button class="btn small primary" onclick="ptDraw()" title="Draw a card (D)">Draw</button>
        <button class="btn small" onclick="ptNextTurn()" title="Untap and draw (N)">Next turn</button>
        <button class="btn small" onclick="ptUntap()" title="Untap all (U)">Untap all</button>
        <button class="btn small" onclick="ptShuffle()" title="Shuffle the library (S)">Shuffle</button>
        <button class="btn small" onclick="ptMulligan()" title="London mulligan (M)">Mulligan</button>
        <button class="btn small" onclick="ptToken()">＋ Token</button>
        <button class="btn small" onclick="ptRestart()">↺ Restart</button>
        <button class="btn small danger" onclick="closePlaytest()" style="margin-left:auto;">Close</button>`;
    const lane = (list, cls) => `<div class="pt-lane ${cls || ''}">${list.map(o => ptCardHTML(o, 'bf')).join('')}</div>`;
    $('ptField').innerHTML = PT.bf.length
        ? `${creatures.length ? `<div class="lane-label">Creatures</div>${lane(creatures)}` : ''}${other.length ? `<div class="lane-label">Other permanents</div>${lane(other)}` : ''}${lands.length ? `<div class="lane-label">Lands · ${untappedLands} untapped</div>${lane(lands, 'lands')}` : ''}`
        : '<p class="note" style="margin:auto; text-align:center;">Drag cards here from your hand (or tap a card in your hand and pick "Battlefield"). Double-click a permanent to tap it.</p>';
    const pile = (z, label) => {
        const top = PT[z][PT[z].length - 1];
        const face = z === 'library' ? (PT.library.length ? '<div class="back"></div>' : '') : top ? `<img src="${top.card.imgS || top.card.img || ''}" alt="">` : '';
        return `<div class="pt-pile" data-zone="${z}" onclick="ptOpenZone('${z}')" ondragover="ptDragOver(event)" ondragleave="ptDragLeave(event)" ondrop="ptDrop(event, '${z}')">${label} (${PT[z].length})${face}</div>`;
    };
    $('ptSide').innerHTML = (PT.command.length || PT.commander ? pile('command', '👑 Command') : '') + pile('library', '📚 Library') + pile('gy', '🪦 Graveyard') + pile('exile', '🚫 Exile');
    $('ptHand').innerHTML = PT.hand.map(o => ptCardHTML(o, 'hand')).join('') || '<span class="note">No cards in hand.</span>';
    const handLands = PT.hand.filter(o => /\bLand\b/.test(o.card.type)).length;
    $('ptFoot').innerHTML = `<span>✋ ${PT.hand.length} in hand (${handLands} land${handLands === 1 ? '' : 's'})</span><span>📚 ${PT.library.length} in library</span>${PT.bottoming ? `<span class="warn">Tap ${PT.bottoming} card${PT.bottoming === 1 ? '' : 's'} in your hand to put on the bottom</span>` : ''}<span class="muted">${esc(PT.log[PT.log.length - 1] || '')}</span><span class="muted pt-keys" style="margin-left:auto;">Keys: D draw · N next turn · U untap · S shuffle · M mulligan</span>`;
    ['ptField', 'ptHand'].forEach(id => {
        const el = $(id);
        el.ondragover = ptDragOver; el.ondragleave = ptDragLeave;
        el.ondrop = e => ptDrop(e, el.dataset.zone);
    });
}

// Tap a card: a menu of moves (also how phones move cards)
function ptCardClick(e, uid) {
    e.stopPropagation();
    const f = ptFind(uid);
    if (!f) return;
    if (f.z === 'hand' && PT.bottoming) {
        ptMove(uid, 'library', 'bottom');
        PT.bottoming--;
        ptRender();
        return;
    }
    const items = [];
    if (f.z === 'bf') items.push(['↻ Tap / untap', `ptTap(${uid})`], ['＋1/＋1 counter', `ptCounter(${uid}, 1)`], ['−1 counter', `ptCounter(${uid}, -1)`]);
    Object.entries(PT_ZONES).forEach(([z, label]) => {
        if (z === f.z) return;
        if (z === 'library') { items.push(['To top of library', `ptMove(${uid}, 'library', 'top')`], ['To bottom of library', `ptMove(${uid}, 'library', 'bottom')`]); return; }
        if (z === 'command' && !(PT.commander && f.o.card.id === PT.commander.id)) return;
        items.push([`To ${label.toLowerCase()}`, `ptMove(${uid}, '${z}')`]);
    });
    items.push(['🔍 View card', `closePtMenu(); showCardSheet('${f.o.card.id}')`]);
    const menu = document.createElement('div');
    menu.className = 'pt-menu';
    menu.id = 'ptMenu';
    menu.innerHTML = `<div class="mh">${esc(f.o.card.name)}</div>${items.map(([label, fn]) => `<button type="button" onclick="${fn}">${label}</button>`).join('')}`;
    closePtMenu();
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(e.clientX, innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(e.clientY, innerHeight - r.height - 8)}px`;
}
function closePtMenu() { const m = $('ptMenu'); if (m) m.remove(); }
document.addEventListener('click', e => { if (!e.target.closest('#ptMenu')) closePtMenu(); });
function ptCardDouble(uid) {
    const f = ptFind(uid);
    if (!f) return;
    if (f.z === 'bf') ptTap(uid);
    else if (f.z === 'hand' || f.z === 'command') ptMove(uid, 'bf');
}

// Drag and drop between zones
function ptDragStart(e, uid) { e.dataTransfer.setData('text/plain', String(uid)); e.dataTransfer.effectAllowed = 'move'; closePtMenu(); }
function ptDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drop'); }
function ptDragLeave(e) { e.currentTarget.classList.remove('drop'); }
function ptDrop(e, zone) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop');
    const uid = Number(e.dataTransfer.getData('text/plain'));
    if (uid) ptMove(uid, zone, 'top');
}

function ptOpenZone(z) {
    const list = z === 'library' ? PT.library : PT[z].slice().reverse();
    showModal(`<h2>${PT_ZONES[z]} (${PT[z].length})</h2>
        ${z === 'library' ? '<p class="note">Top of the library first. Tap a card to move it.</p>' : ''}
        <div class="pt-zone-list">${list.map(o => ptCardHTML(o, z)).join('') || '<p class="note">Empty.</p>'}</div>
        <div class="row" style="justify-content:center; margin-top:12px;">${z === 'library' ? '<button class="btn" onclick="ptShuffle(); closeModal();">Shuffle</button>' : ''}<button class="btn" onclick="closeModal()">Close</button></div>`);
}

function closePlaytest() {
    $('playtest').classList.add('hidden');
    document.body.style.overflow = '';
    closePtMenu();
    PT = null;
}

document.addEventListener('keydown', e => {
    if (!PT || $('playtest').classList.contains('hidden') || /input|textarea|select/i.test(e.target.tagName) || $('modalHost').innerHTML) return;
    const k = e.key.toLowerCase();
    if (k === 'd') ptDraw();
    else if (k === 'n') ptNextTurn();
    else if (k === 'u') ptUntap();
    else if (k === 's') ptShuffle();
    else if (k === 'm') ptMulligan();
    else if (k === 'escape') closePtMenu();
});

