// Board overview (2026-10-19, owner's request: "if you have a lot of creatures on the field we need an easier way at looking at all of them").
// 👁 Board on every player bar opens a panel with every permanent of one player (tabs switch players): creatures first, as pictures or as
// a compact list, sorted by power / name / mana value; tap one to read it big in the pane at the top. Nothing here changes the game.
const OV = { who: null, mode: 'pics', sort: 'power', sel: null, only: 'all' };
function ovStatus(o) {
    const out = [];
    if (G.attackers.includes(o.uid)) { const t = o.atkTo != null && G.players[o.atkTo] ? ` → ${who(G.players[o.atkTo])}` : ''; out.push(`⚔️ attacking${t}`); }
    if (Object.values(G.blocks || {}).some(bs => bs.includes(o.uid))) out.push('🛡️ blocking');
    if (o.tapped) out.push('↪ tapped');
    if (isCreature(o) && o.sick && !has(o, 'haste') && o.owner === G.active) out.push('💤 summoning sick');
    if (o.counters) out.push(`${o.counters > 0 ? '+' : '−'}${Math.abs(o.counters)} counter${Math.abs(o.counters) === 1 ? '' : 's'}`);
    Object.entries(o.ctr || {}).forEach(([k, n]) => { if (n) out.push(`${n} ${k}`); });
    if (o.dmg) out.push(`💥 ${o.dmg} damage`);
    return out;
}
function ovKeywords(o) { return ['flying', 'first strike', 'double strike', 'deathtouch', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance', 'defender', 'flash'].filter(k => has(o, k)); }
function ovSorted(list) {
    const k = OV.sort;
    return list.slice().sort((a, b) => k === 'name' ? a.card.name.localeCompare(b.card.name) : k === 'mv' ? (b.card.cmc || 0) - (a.card.cmc || 0) || a.card.name.localeCompare(b.card.name) : (isCreature(b) ? pow(b) : -1) - (isCreature(a) ? pow(a) : -1) || a.card.name.localeCompare(b.card.name));
}
function ovTile(o) {
    const st = ovStatus(o), cls = ['ov-tile'];
    if (o.tapped) cls.push('tapped');
    if (G.attackers.includes(o.uid)) cls.push('attacking');
    if (OV.sel === o.uid) cls.push('sel');
    const pt = isCreature(o) ? `<span class="pt${o.dmg ? ' hurt' : ''}">${pow(o)}/${tou(o) - o.dmg}</span>` : '';
    if (OV.mode === 'list') return `<button type="button" class="${cls.join(' ')} row-tile" onclick="ovPick(${o.uid})"><b>${esc(o.card.name)}</b>${pt}<span class="ov-kw">${esc(ovKeywords(o).join(', '))}</span><span class="ov-st">${esc(st.join(' · '))}</span></button>`;
    return `<button type="button" class="${cls.join(' ')}" onclick="ovPick(${o.uid})" title="${esc(o.card.name)}${st.length ? ' — ' + esc(st.join(', ')) : ''}">${cardImg(o.card)}${pt}${st.length ? `<span class="ov-badges">${o.tapped ? '↪' : ''}${G.attackers.includes(o.uid) ? '⚔️' : ''}${o.counters ? (o.counters > 0 ? '＋' : '−') : ''}${o.dmg ? '💥' : ''}</span>` : ''}</button>`;
}
function ovDetail() {
    const o = OV.sel != null ? onBf(OV.sel) : null;
    if (!o) return '<p class="note">Tap a creature below to read it here.</p>';
    const r = Rx(o), st = ovStatus(o), att = allPerms().filter(a => a.attachedTo === o.uid).map(a => a.card.name);
    return `<div class="ov-detail">${cardImg(o.card, true)}<div style="text-align:left;"><h3>${esc(o.card.name)} ${isCreature(o) ? `<span class="pt-big">${pow(o)}/${tou(o) - o.dmg}</span>` : ''}</h3>
        <p class="note">${esc(o.card.type)}${o.card.cost ? ` · ${esc(o.card.cost)}` : ''}${r.support !== 'full' ? ` · ${r.support === 'partial' ? 'partly automated' : 'not automated'}` : ''}</p>
        ${st.length ? `<p>${esc(st.join(' · '))}</p>` : ''}${ovKeywords(o).length ? `<p><b>Has:</b> ${esc(ovKeywords(o).join(', '))}</p>` : ''}${att.length ? `<p><b>Attached:</b> ${esc(att.join(', '))}</p>` : ''}
        <p class="ov-text">${esc((o.card.text || '').replace(/~/g, o.card.name))}</p>
        <button class="btn small" onclick="ovFull(${o.uid})">Open the full card (abilities)</button></div></div>`;
}
function ovBody() {
    const P = G.players[OV.who];
    const tucked = o => !!(o.attachedTo && onBf(o.attachedTo));
    const creatures = ovSorted(P.bf.filter(o => isCreature(o) && !tucked(o)));
    const other = ovSorted(P.bf.filter(o => !isCreature(o) && Rx(o).kind !== 'land' && !tucked(o)));
    const lands = P.bf.filter(o => Rx(o).kind === 'land' && !tucked(o));
    const power = creatures.reduce((a, o) => a + Math.max(0, pow(o)), 0), ready = creatures.filter(o => !o.tapped && !(o.sick && !has(o, 'haste'))).length;
    const sec = (title, list) => list.length ? `<h4>${title} <span class="note">(${list.length})</span></h4><div class="ov-grid ${OV.mode}">${list.map(ovTile).join('')}</div>` : '';
    const landNames = {}; lands.forEach(l => { landNames[l.card.name] = (landNames[l.card.name] || 0) + 1; });
    return `<div class="ov-sum"><b>${creatures.length}</b> creature${creatures.length === 1 ? '' : 's'} · power <b>${power}</b> · <b>${ready}</b> ready · ${other.length} other permanent${other.length === 1 ? '' : 's'} · ${lands.length} land${lands.length === 1 ? '' : 's'} (${lands.filter(l => !l.tapped).length} untapped)</div>
        ${OV.only !== 'other' ? sec('Creatures', creatures) : ''}${OV.only !== 'creatures' ? sec('Other permanents', other) : ''}
        ${OV.only === 'all' && lands.length ? `<h4>Lands <span class="note">(${lands.length})</span></h4><p class="note">${Object.entries(landNames).map(([n, k]) => `${k} ${esc(n)}`).join(', ')}</p>` : ''}
        ${!creatures.length && !other.length ? '<p class="note">Nothing here yet.</p>' : ''}`;
}
function boardOverview(i) {
    if (!G) return;
    if (i != null) { if (i !== OV.who) OV.sel = null; OV.who = i; } else if (OV.who == null) OV.who = G.view || 0;
    const tabs = G.players.map(X => `<button type="button" class="btn small${X.i === OV.who ? ' primary' : ''}" onclick="boardOverview(${X.i})">${X.out ? '💀 ' : ''}${esc(who(X))} <span class="note">${X.bf.filter(isCreature).length}</span></button>`).join('');
    const seg = (key, opts) => `<span class="seg">${opts.map(([v, t]) => `<button type="button" aria-pressed="${OV[key] === v}" onclick="ovSet('${key}','${v}')">${t}</button>`).join('')}</span>`;
    showModal(`<div class="ov"><div class="row" style="justify-content:space-between; gap:8px; flex-wrap:wrap;"><h2 style="margin:0;">👁 Board</h2><button class="btn small" onclick="closeModal()">Close</button></div>
        <div class="row" style="gap:6px; flex-wrap:wrap; margin:8px 0;">${tabs}</div>
        <div class="row" style="gap:10px; flex-wrap:wrap; margin-bottom:8px;">${seg('mode', [['pics', '🖼 Pictures'], ['list', '☰ List']])}${seg('sort', [['power', 'Power'], ['mv', 'Mana value'], ['name', 'A–Z']])}${seg('only', [['all', 'All'], ['creatures', 'Creatures'], ['other', 'Other']])}</div>
        ${ovDetail()}<div class="ov-body">${ovBody()}</div></div>`);
}
function ovSet(k, v) { OV[k] = v; boardOverview(); }
function ovPick(uid) { OV.sel = OV.sel === uid ? null : uid; boardOverview(); const el = document.querySelector('.ov-detail'); if (el) el.scrollIntoView({ block: 'nearest' }); }
function ovFull(uid) { closeModal(); showGameCard(uid); }
