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
// Painted icons (Antigravity Batch 2, 2026-11-28) when the file exists, else the emoji; ascIco is in 13j-ascent-ui-art.js
const uiIco = (id, fb, px) => typeof ascIco === 'function' ? ascIco(id, fb, px || 16) : fb;
const counterIco = k => ['loyalty', 'charge'].includes(k) ? uiIco('ctr-' + k, counterIcon(k), 14) : counterIcon(k);
const MOOD_ICO = { angry: 'angry', annoyed: 'salty', salty: 'salty', worried: 'worried', nervous: 'worried', smug: 'confident', determined: 'confident', calm: 'calm', scheming: 'calm', nerdy: 'calm', cheerful: 'happy', impressed: 'happy' };
const moodIco = (m, px) => MOOD_ICO[m] ? uiIco('mood-' + MOOD_ICO[m], MOODS[m].emoji, px || 18) : (MOODS[m] || MOODS.calm).emoji;
// Keywords written with a number or a quality (ward:2, pro:red, toxic:1)
// A permanent's type as a painted icon (tokens first, then the main card type); '' when there's no art
const TYPE_ICO_ORDER = ['battle', 'planeswalker', 'creature', 'land', 'artifact', 'enchantment', 'instant', 'sorcery'];
function typeKey(o) { if (o.token) return 'token'; const t = (o.card && o.card.type || '').toLowerCase(); return TYPE_ICO_ORDER.find(k => t.includes(k)) || ''; }
function typeIco(o, px) { const k = typeKey(o); return k ? uiIco('type-' + k, '', px || 16) : ''; }
// A card's rarity as its painted gem (special and bonus share one)
function rarityIco(r, px) { r = String(r || '').toLowerCase(); const k = r === 'bonus' ? 'special' : r; return ['common', 'uncommon', 'rare', 'mythic', 'special'].includes(k) ? uiIco('rarity-' + k, '', px || 14) : ''; }
const kwPrefixed = (o, p) => !lostAbilities(o) && ([...Rx(o).kw].concat(o.tkw || []).some(x => typeof x === 'string' && (x === p || x.startsWith(p + ':') || x.startsWith(p + ' '))));

// Crisp MTG Arena-style inline SVG keyword medallions (compact, legible even on shrunk 2-row boards)
const KW_ICONS = [
    ['flying', 'Flying', '<path d="M2 11c3-5 7-7 12-8-1 4-4 7-8 8l-1 3-3-3z"/>'],
    ['trample', 'Trample', '<path d="M3 12l3-7 3 4 3-5 2 8H3z"/>'],
    ['deathtouch', 'Deathtouch', '<circle cx="8" cy="6.5" r="4"/><path d="M5 11.5h6l-1 2.5H6z"/>'],
    ['lifelink', 'Lifelink', '<path d="M8 13.5S2.5 9.8 2.5 6A3 3 0 0 1 8 4.2 3 3 0 0 1 13.5 6C13.5 9.8 8 13.5 8 13.5z"/>'],
    ['vigilance', 'Vigilance', '<path d="M1.5 8s2.6-4.5 6.5-4.5S14.5 8 14.5 8s-2.6 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2" fill="var(--bg-canvas)"/>'],
    ['haste', 'Haste', '<path d="M9.5 1.5L3.5 9h4l-1 5.5 6-7.5h-4z"/>'],
    ['double strike', 'Double strike', '<path d="M3 13L11 3l2 1.5-8 10zM6.5 13.5L13 5.5l1.5 1.2-6.5 8z"/>'],
    ['first strike', 'First strike', '<path d="M3 13L12 2.5l1.8 1.5L5 14.2zM2.5 9.5l4 4"/>'],
    ['indestructible', 'Indestructible', '<path d="M8 1.8L13.5 4v4.2c0 3.2-2.4 5.3-5.5 6.3-3.1-1-5.5-3.1-5.5-6.3V4L8 1.8z"/>'],
    ['hexproof', 'Hexproof', '<path d="M8 1.8l5.2 3v6.4L8 14.2l-5.2-3V4.8z"/>'],
    ['menace', 'Menace', '<path d="M5 13c-1.5-2.5-.5-6 2-8.5 0 2 1.2 3 2 3 0-2 1-3.5 2.2-5 2 2.5 2.8 6.5 1.3 10.5H5z"/>'],
    ['reach', 'Reach', '<path d="M3 13L13 3m0 0H7.5M13 3v5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'],
    ['defender', 'Defender', '<rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M3 7.5h10M8 3v9.5" stroke="var(--bg-canvas)" stroke-width="1.3"/>'],
    ['infect', 'Infect', '<circle cx="8" cy="8" r="2.6"/><circle cx="8" cy="3" r="1.6"/><circle cx="3.7" cy="10.5" r="1.6"/><circle cx="12.3" cy="10.5" r="1.6"/>', 'infect'],
    ['toxic', 'Toxic', '<path d="M8 1.8c2.6 3.4 4.4 5.7 4.4 8a4.4 4.4 0 0 1-8.8 0c0-2.3 1.8-4.6 4.4-8z"/>', 'toxic'],
    ['ward', 'Ward', '<path d="M8 1.8L13.5 4v4.2c0 3.2-2.4 5.3-5.5 6.3-3.1-1-5.5-3.1-5.5-6.3V4L8 1.8z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="7.5" r="1.8"/>', 'ward'],
    ['protection', 'Protection', '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.8"/>', 'pro'],
    ['prowess', 'Prowess', '<path d="M8 1.5l1.8 4.2 4.5.4-3.4 3 1 4.4L8 11.2l-3.9 2.3 1-4.4-3.4-3 4.5-.4z"/>'],
    ['flash', 'Flash', '<path d="M8 1.5l1.6 4.9L14.5 8l-4.9 1.6L8 14.5 6.4 9.6 1.5 8l4.9-1.6z"/>']
];
function kwBadgesHTML(o) {
    if (!isCreature(o) || typeof has !== 'function') return '';
    const out = [];
    for (const [k, label, path, pre] of KW_ICONS) {
        if (k === 'first strike' && has(o, 'double strike')) continue;
        if (pre ? (has(o, k) || kwPrefixed(o, pre)) : has(o, k)) {
            const slug = k.replace(/\s+/g, '-');
            const art = typeof ASC_UI !== 'undefined' && ASC_UI.ok['kw-' + slug];
            out.push(art
                ? `<span class="kw-ico has-art kw-${slug}" title="${label}"><img class="asc-ico" src="spellslinger/art/ui/kw-${slug}.png" alt="" aria-hidden="true" width="20" height="20"></span>`
                : `<span class="kw-ico kw-${slug}" title="${label}"><svg viewBox="0 0 16 16" aria-hidden="true">${path}</svg></span>`);
            if (out.length >= 4) break;
        }
    }
    return out.length ? `<span class="kw-strip">${out.join('')}</span>` : '';
}

function permHTML(o, count = 1) {
    const r = Rx(o);
    const m = G.mode;
    const cls = ['perm'];
    if (r.kind === 'land') cls.push('land');
    if (/Legendary/i.test(o.card.type || '') || o.isCommander) cls.push('is-legendary');
    if (o.token) cls.push('is-token');
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
    if (m && m.type === 'attack' && o.owner === G.view && canAttackWith(o) && !m.sel.has(o.uid)) cls.push('can-atk');
    if (m && m.type === 'block' && m.picked === o.uid) cls.push('picked');
    const isSick = isCreature(o) && o.sick && !has(o, 'haste') && o.owner === G.active;
    if (isSick) cls.push('sick-card');
    const chips = [];
    if (o.isCommander) chips.push('<span class="chip c-cmd" title="Commander">👑</span>');
    if (o.counters > 0) chips.push(`<span class="chip c-plus" title="${o.counters} +1/+1 counter${o.counters === 1 ? '' : 's'}">${o.counters}</span>`);
    if (o.counters < 0) chips.push(`<span class="chip c-minus" title="${-o.counters} -1/-1 counter${o.counters === -1 ? '' : 's'}">−${-o.counters}</span>`);
    Object.entries(o.ctr || {}).forEach(([k, n]) => chips.push(`<span class="chip" title="${n} ${esc(k)} counter${n === 1 ? '' : 's'}">${counterIco(k)}${n}</span>`));
    if (o.tp || o.tq || o.tkw.length) chips.push(`<span class="chip c-temp" title="Until end of turn: ${[o.tp || o.tq ? `${o.tp >= 0 ? '+' : ''}${o.tp}/${o.tq >= 0 ? '+' : ''}${o.tq}` : '', ...o.tkw].filter(Boolean).join(', ')}">⏱</span>`);
    if (o.dmg) chips.push(`<span class="chip c-dmg" title="${o.dmg} damage marked (wears off at end of turn)">💥${o.dmg}</span>`);
    if (isSick) chips.push('<span class="chip sick" title="Summoning sick">💤</span>');
    if (allPerms().some(a => a.attachedTo === o.uid)) chips.push(`<span class="chip" title="${esc(allPerms().filter(a => a.attachedTo === o.uid).map(a => a.card.name).join(', '))}">🛡️</span>`);

    let pt = '';
    if (isCreature(o)) {
        const p = pow(o), t = tou(o);
        const up = p > Number(o.card.power) || t > Number(o.card.toughness);
        pt = `<span class="pt${o.dmg ? ' hurt' : up ? ' up' : ''}">${p}/${t - o.dmg}</span>`;
    }
    const blockedAtk = blocking && onBf(Number(blocking[0]));
    const atkLabel = G.players.length > 2 && o.atkTo != null && G.attackers.includes(o.uid) && G.players[o.atkTo] ? `<span class="blocklabel">→ ${esc(who(G.players[o.atkTo]).split(',')[0])}</span>` : '';
    const blockLabel = blockedAtk ? `<span class="blocklabel">blocks ${esc(blockedAtk.card.name.split(',')[0])}</span>` : '';
    if (count > 1) cls.push('pile');
    const cols = o.card.colors || [];
    const cc = cols.length > 1 ? 'var(--gold)' : cols.length === 1 ? `var(--mana-${cols[0]})` : 'var(--mana-C)';
    return `<button type="button" class="${cls.join(' ')}" data-uid="${o.uid}" style="--cc:${cc}" onclick="permClick(${o.uid})" title="${esc(o.card.name)}${count > 1 ? ` ×${count}` : ''}">${cardImg(o.card)}${o.tapped ? '<span class="tap-ico" aria-hidden="true">↪</span>' : ''}<span class="pname">${esc(o.card.name.split(',')[0])}</span><span class="chips">${chips.join('')}</span>${kwBadgesHTML(o)}${pt}${blockLabel || atkLabel}${count > 1 ? `<span class="pile-n">×${count}</span>` : ''}</button>`;
}
// Identical permanents share one pile (lands and others from 2, creatures
// from 3). Only un-pile permanents that are individually selectable in the
// current choice mode so lands and non-targetable tokens stay neatly shingled
// during combat and targeting, just like MTG Arena.
function groupPerms(list, min) {
    const m = G.mode;
    const out = [], byKey = new Map();
    list.forEach(o => {
        const mCanPick = m && (
            (m.type === 'target' && (m.valid || []).some(v => v.o && v.o.uid === o.uid))
            || (m.type === 'attack' && o.owner === G.view && canAttackWith(o))
            || (m.type === 'block' && ((o.owner === G.view && isCreature(o) && !o.tapped) || (o.owner !== G.view && G.attackers.includes(o.uid))))
            || (m.type === 'pay' && o.owner === G.view && helpsPay(me(), o))
        );
        const plain = !mCanPick && !o.attachedTo && !allPerms().some(a => a.attachedTo === o.uid) && !o.dmg && !o.tp && !o.tq && !o.tkw.length
            && !G.attackers.includes(o.uid) && !Object.values(G.blocks).some(bs => bs.includes(o.uid)) && !o.isCommander;
        if (!plain) { out.push([o]); return; }
        // Tokens each get their own card id, so identical ones are matched by name and stats (16 Soldier tokens are one pile)
        const ident = o.token ? `${o.card.name}|${o.card.power}|${o.card.toughness}|${o.card.type}|${(o.card.colors || []).join('')}|${o.card.text || ''}` : o.card.id;
        const key = `${ident}|${o.counters || 0}|${JSON.stringify(o.ctr || {})}|${o.tapped}|${isCreature(o) && o.sick && !has(o, 'haste')}|${o.token}`;
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
    // Your commander leads the row so a crowded board never hides it
    const creatures = P.bf.filter(o => isCreature(o) && !tucked(o)).sort((x, y) => (y.isCommander ? 1 : 0) - (x.isCommander ? 1 : 0));
    const other = P.bf.filter(o => !isCreature(o) && Rx(o).kind !== 'land' && !tucked(o));
    const lane = (list, extra = '', min = 2) => `<div class="lane ${extra}">${groupPerms(list, min).map(g => permWrapHTML(g[0], g.length)).join('')}</div>`;
    const power = creatures.reduce((a, o) => a + Math.max(0, pow(o)), 0);
    const untapped = lands.filter(o => !o.tapped).length;
    const front = `<div class="row-front"><button type="button" class="board-sum" onclick="boardOverview(${P.i})" title="Creatures and their total power: tap to see the whole board">${creatures.length ? `⚔️ ${creatures.length} · power ${power}` : 'No creatures'}</button>${creatures.length ? lane(creatures, 'creatures', 3) : ''}</div>`;
    const back = `<div class="row-back"><div class="back-lands" title="Lands: ${lands.length}, ${untapped} untapped">${lane(lands, 'lands')}</div>${other.length ? `<div class="back-other">${lane(other, 'stack')}</div>` : ''}</div>`;
    return you(P) ? front + back : back + front;
}
// A permanent plus whatever is attached to it, tucked behind (tap one to see it)
function permWrapHTML(o, count) {
    const att = allPerms().filter(a => a.attachedTo === o.uid);
    if (!att.length) return permHTML(o, count);
    // Besides the tucked pictures, every attachment is also a named chip under (compact tiles) or over the bottom of (phones) its creature, so it can always be read
    // and tapped: the pictures are hidden in compact rows and too small to read on a phone (2026-11-19, owner's phone screenshots: equipment on a creature was invisible)
    const chips = `<span class="att-list">${att.map(a => `<button type="button" class="att-chip" data-uid="${a.uid}" onclick="permClick(${a.uid})" title="${esc(a.card.name)} is attached to ${esc(o.card.name)}">${/Equipment/.test(a.card.type) ? '⚔️' : /Aura/.test(a.card.type) ? '✨' : '📎'} ${esc(a.card.name.split(',')[0])}</button>`).join('')}</span>`;
    return `<div class="perm-wrap" style="--tucks:${att.length}">${att.map((a, i) => `<button type="button" class="tuck" style="--i:${i}" data-uid="${a.uid}" onclick="permClick(${a.uid})" title="${esc(a.card.name)} (attached)">${cardImg(a.card)}</button>`).join('')}${permHTML(o, count)}${chips}</div>`;
}

// Pooled mana as counts per color (a big pool stays short): 3<pip> 2<pip>
function poolCountsHTML(pool) {
    const c = {};
    pool.forEach(m => { const k = m[0][0]; c[k] = (c[k] || 0) + 1; });
    return `<b>${pool.length}</b>` + Object.entries(c).map(([k, n]) => ` <span class="pool-n">${n}<span class="pip ${k}" title="${k}"></span></span>`).join('');
}
function manaSummary(P) {
    const floating = (P.pool || []).length ? `<span class="floating" title="Mana in your pool: it empties at the end of the step">Pool ${poolCountsHTML(P.pool)}</span>` : '';
    return manaSourcesSummary(P) + floating;
}
function manaSourcesSummary(P) {
    const srcs = manaSources(P);
    const counts = {};
    srcs.forEach(o => { const m = manaOf(o); const key = m.colors.length > 1 ? 'any' : m.colors[0]; counts[key] = (counts[key] || 0) + m.n; });
    const total = availableMana(P);
    return `<span class="pool" title="Untapped mana">⚡ ${total}${Object.entries(counts).map(([c, n]) => c === 'any' ? ` · ${n}${uiIco('gem-multi', ' multi', 15)}` : ` · ${n}<span class="pip ${c}"></span>`).join('')}</span>`;
}

// Commander metadata for a player (art portrait, color identity glow, current zone)
function playerCmdr(P) {
    if (!P) return null;
    const o = [...(P.command || []), ...(P.bf || []), ...(P.gy || []), ...(P.exile || []), ...(P.hand || []), ...(P.library || [])].find(x => x && x.isCommander);
    if (!o || !o.card) return null;
    const ci = o.card.ci || o.card.colors || [];
    const col = ci.length === 1 ? `var(--mana-${ci[0]})` : ci.length ? 'var(--gold)' : 'var(--mana-C)';
    return { o, card: o.card, art: o.card.imgS || o.card.img || '', ci, col, onBf: (P.bf || []).includes(o), inCmd: (P.command || []).includes(o) };
}

// Playback speed (1 = normal, 2 = brisk, 4 = turbo) for opponent turns and play-by-play
let gameSpeed = Number(store.get('gameSpeed', 1)) || 1;
if (![1, 2, 4].includes(gameSpeed)) gameSpeed = 1;
window._gameSpeed = gameSpeed;
function applyGameSpeed() {
    window._gameSpeed = gameSpeed;
    document.querySelectorAll('.speed-seg [data-sp]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.sp) === gameSpeed)));
    const cyc = $('speedCycleBtn');
    if (cyc) cyc.textContent = gameSpeed === 4 ? '⚡' : `${gameSpeed}×`;
}
function setGameSpeed(v) {
    gameSpeed = [1, 2, 4].includes(Number(v)) ? Number(v) : 1;
    window._gameSpeed = gameSpeed;
    store.set('gameSpeed', gameSpeed);
    applyGameSpeed();
}
function cycleGameSpeed() { setGameSpeed(gameSpeed === 1 ? 2 : gameSpeed === 2 ? 4 : 1); }

// Phone hand peek toggle: keeps phone hand compact (~half height) for extra board room, 1-tap to expand
let phoneHandOpen = false;
function applyPhoneHand() {
    const g = $('game'), btn = $('phoneHandToggle');
    if (g) g.classList.toggle('phone-hand-open', !!phoneHandOpen);
    if (btn) {
        btn.setAttribute('aria-expanded', String(!!phoneHandOpen));
        const ico = btn.querySelector('.pht-ico');
        if (ico) ico.textContent = phoneHandOpen ? '▼' : '▲';
    }
}
function togglePhoneHand() { phoneHandOpen = !phoneHandOpen; applyPhoneHand(); fitTable(); }
function speedToggleHTML(reopen) {
    return `<div class="seg speed-seg" role="group" aria-label="Game speed" style="width:100%;">${[[1, '1× Normal'], [2, '2× Fast'], [4, '⚡ Turbo']].map(([n, lbl]) => `<button type="button" style="flex:1; padding:10px;" data-sp="${n}" aria-pressed="${gameSpeed === n}" onclick="setGameSpeed(${n}); ${reopen}">${lbl}</button>`).join('')}</div>`;
}

// A pod (3 or 4 players): rich broadcast-style seat cards with Commander art, live mana/board telemetry,
// active deals, combat direction and 1-click focus switching.
function podStripHTML() {
    const v = me(), m = G.mode;
    const opps = G.players.filter(X => X !== v);
    const chips = opps.map((X, idx) => {
        const on = foe() === X, turn = G.active === X.i && !G.over;
        const atkMe = G.active === X.i && (G.defender === v.i || G.attackers.some(u => { const a = onBf(u); return a && a.atkTo === v.i; }));
        let atkOther = '';
        if (!atkMe && G.active === X.i && G.attackers.length) {
            const defP = G.defender != null && G.players[G.defender] !== v ? G.players[G.defender] : null;
            if (defP) atkOther = who(defP).split(',')[0];
        }
        const tgt = m && m.type === 'target' && m.valid.some(t => t.p && t.p.i === X.i);
        const dmg = G.format === 'commander' ? (v.cmdBy[X.i] || 0) : 0;
        const mood = botMood(X), crs = X.bf.filter(isCreature), power = crs.reduce((n, o) => n + Math.max(0, pow(o)), 0);
        const avail = typeof availableMana === 'function' ? availableMana(X) : 0;
        const start = (FORMATS[G.format] && FORMATS[G.format].life) || 40, pct = Math.max(0, Math.min(100, Math.round(100 * X.life / start)));
        const cmdr = playerCmdr(X);
        const col = cmdr ? cmdr.col : 'var(--mana-C)';
        const sub = cmdr ? cmdr.card.name.split(',')[0] : (X.char ? X.name.split(',')[0] : styleOf(X) ? styleOf(X).name : '');
        const styleLbl = styleOf(X) ? `${styleOf(X).emoji} ${styleOf(X).name}` : '';
        const myDeals = (G.deals || []).filter(d => !d.over && ((d.a === v.i && d.b === X.i) || (d.b === v.i && d.a === X.i)));
        const tags = [];
        if (G.arch === X.i && !X.out) tags.push('<span class="seat-tag arch" title="Archenemy: the table is focusing on this player">🎯 Arch</span>');
        myDeals.slice(0, 2).forEach(d => {
            if (d.alliance) tags.push('<span class="seat-tag deal" title="Active alliance">🤝 Ally</span>');
            else if (d.type === 'peace') tags.push('<span class="seat-tag deal" title="Peace deal active">🕊️ Peace</span>');
            else if (d.type === 'spare') tags.push('<span class="seat-tag deal" title="Hands-off truce active">🛡️ Truce</span>');
            else if (d.type === 'pact') tags.push('<span class="seat-tag deal" title="Gang-up pact active">⚔️ Pact</span>');
        });
        if (atkMe) tags.push('<span class="seat-tag atk-danger">⚔️ Attacks you</span>');
        else if (atkOther) tags.push(`<span class="seat-tag atk">⚔️ → ${esc(atkOther)}</span>`);
        else if (G.defender === X.i && G.active === v.i) tags.push('<span class="seat-tag atk">🎯 Target</span>');
        const avHTML = cmdr && cmdr.art
            ? `<span class="seat-av has-art" aria-hidden="true"><span class="seat-av-clip"><img src="${cmdr.art}" alt=""></span><span class="seat-mood">${X.out ? '💀' : moodIco(mood.mood, 16)}</span></span>`
            : `<span class="seat-av" aria-hidden="true">${X.out ? '💀' : moodIco(mood.mood, 22)}</span>`;
        return `<button type="button" data-seat="${X.i}" style="--sc:${col}" class="pod-chip seat${on ? ' on' : ''}${turn ? ' turn' : ''}${X.out ? ' out' : ''}${tgt ? ' targetable' : ''}${X.life <= 10 && !X.out ? ' low' : pct <= 50 && !X.out ? ' mid' : ''}" onclick="${tgt ? `pickTarget({ p: G.players[${X.i}] })` : `podFocus(${X.i})`}" ${X.out ? 'disabled' : ''}
            title="${esc(X.name)}${X.out ? ' (out of the game)' : ''}: ${X.life} life, ${avail} open mana, ${X.hand.length} in hand, ${X.library.length} in library, ${crs.length} creatures (power ${power}), ${X.gy.length} in graveyard${styleLbl ? `, ${esc(styleLbl)}` : ''}. Feeling ${esc(MOODS[mood.mood].name)}: ${esc(mood.why)}${dmg ? `. Commander damage to you: ${dmg}/21` : ''}. Press ${idx + 1} to view board.">
            ${avHTML}
            <span class="seat-main"><b>${esc(who(X))}${typeof reliTag === 'function' ? reliTag(X) : ''}<span class="seat-cmdr">${turn ? '<span class="seat-think" aria-label="taking their turn"><i></i><i></i><i></i></span>' : ''}${esc(sub)}</span><kbd class="seat-key desk-only">${idx + 1}</kbd></b>${tags.length ? `<span class="seat-tags">${tags.join('')}</span>` : ''}</span>
            <span class="seat-life-wrap"><span class="seat-life">${X.out ? 'OUT' : X.life}</span></span>
            <span class="seat-stats"><span title="Cards in hand">✋${X.hand.length}</span><span title="Untapped open mana">💧${avail}</span><span title="Creatures and total power">⚔️${crs.length}${power ? `·${power}` : ''}</span><span title="Graveyard">${uiIco('zone-graveyard', '🪦', 14)}${X.gy.length}</span><span class="seat-lib" title="Library">${uiIco('zone-library', '📚', 14)}${X.library.length}</span>${cmdr && !X.out ? `<span class="seat-cz${cmdr.onBf ? ' live' : ''}" title="${cmdr.onBf ? 'Commander is on the battlefield' : cmdr.inCmd ? 'Commander is in the command zone' : 'Commander is in another zone'}">${uiIco('zone-command', '👑', 14)}${cmdr.onBf ? '●' : ''}</span>` : ''}${dmg ? `<span class="seat-cdmg" title="Commander damage you have taken from them">🩸${dmg}</span>` : ''}${(X.salt || 0) >= 3 ? `<span title="Salt level: how annoyed they are with the table">🧂${Math.round(X.salt)}</span>` : ''}</span>
            <span class="seat-bar" aria-hidden="true"><i style="width:${X.out ? 0 : pct}%"></i></span></button>`;
    }).join('');
    const mine = dealsOf(v.i).length;
    return `<div class="pod-strip" role="group" aria-label="Opponents">${chips}<div class="pod-utils"><div class="pod-util-row"><button type="button" class="pod-chip pod-act" onclick="dealDialog()" title="Make a deal with a bot: peace, hands off, or gang up"><b>${uiIco('act-deal', '🤝', 16)}<span class="lbl"> Deals</span></b>${mine ? `<span class="pod-badge">${mine}</span>` : ''}</button>${typeof askButtonHTML === 'function' ? askButtonHTML() : ''}</div><span class="pod-chip meters" title="Table salt: how annoyed the bots are. Cool: impressive plays so far (they earn you style points)."><span>🧂 ${tableSalt()}</span><span>✨ ${(G.cool || []).reduce((a, b) => a + b, 0)}</span></span></div></div>`;
}
function podFocus(i) { G.focusPick = i; renderGame(); }

function barHTML(P) {
    const m = G.mode;
    const isPodOpp = G.players.length > 2 && P !== me();
    const targetable = m && m.type === 'target' && m.valid.some(v => v.p && v.p.i === P.i);
    const cmd = P.command.map(o => {
        const t = P.commanderUid2 ? (P.cmdCastN[o.cmdSlot || 0] || 0) : P.tax;
        const art = o.card.imgS || o.card.img;
        const castable = P === me() && G.active === G.view && !G.busy && canCastNow(P, o) && canPay(P, o);
        return `<button type="button" class="btn small cmd-chip${castable ? ' playable' : ''}" onclick="showGameCard(${o.uid})" title="${esc(o.card.name)}${t ? ` (commander tax +${t * 2})` : ''} — tap to inspect or cast">${art ? `<span class="cmd-thumb-wrap"><img class="cmd-thumb" src="${art}" alt=""></span>` : '<span class="cmd-ico">👑</span>'}<span class="cmd-nm">${esc(o.card.name.split(',')[0])}</span>${t ? `<span class="cmd-tax">+${t * 2}</span>` : ''}</button>`;
    }).join('');
    const cmdrObj = playerCmdr(P);
    const avArt = cmdrObj && cmdrObj.art;
    const avCol = cmdrObj && cmdrObj.col ? cmdrObj.col : (you(P) ? 'var(--gold)' : 'var(--brand-light)');
    const avHTML = avArt
        ? `<span class="${you(P) ? 'me-av' : 'opp-av'} arena-av" style="--sc:${avCol}" aria-hidden="true"><span class="seat-av-clip"><img src="${avArt}" alt=""></span></span>`
        : `<span class="${you(P) ? 'me-av' : 'opp-av'} arena-av no-art" style="--sc:${avCol}" aria-hidden="true">${you(P) ? '🧙' : '🤖'}</span>`;
    const topGy = P.gy && P.gy.length ? P.gy[P.gy.length - 1] : null;
    const gyArt = topGy && topGy.card && (topGy.card.imgS || topGy.card.img);
    const gyPile = `<button type="button" class="zone-count zone-btn pile-card pile-gy${gyArt ? ' has-art' : ''}" title="Graveyard (${P.gy.length}): tap to look" onclick="showGraveyard(${P.i})">${gyArt ? `<img class="pile-art" src="${gyArt}" alt="">` : ''}<span class="pile-ico" aria-hidden="true">${uiIco('zone-graveyard', '🪦', 22)}</span><span class="pile-cnt">${P.gy.length}</span></button>`;
    // Exile (2026-11-28): a pile next to the graveyard, shown only once something is exiled
    const exPile = (P.exile || []).length ? `<button type="button" class="zone-count zone-btn pile-card pile-ex" title="Exile (${P.exile.length}): tap to look" onclick="showExile(${P.i})"><span class="pile-ico" aria-hidden="true">${uiIco('zone-exile', '🌀', 22)}</span><span class="pile-cnt">${P.exile.length}</span></button>` : '';
    const slv = typeof sleeveAttr === 'function' ? sleeveAttr(P) : { cls: '', style: '' };
    const libPile = `<span class="zone-count pile-card pile-deck${slv.cls}"${slv.style} title="Library: ${P.library.length} cards"><span class="pile-ico" aria-hidden="true">${uiIco('zone-library', '📚', 22)}</span><span class="pile-cnt">${P.library.length}</span></span>`;
    const crestSVG = `<svg class="av-crest" viewBox="0 0 120 76" aria-hidden="true"><path class="crest-wing" d="M8 58 L28 32 L38 42 L60 12 L82 42 L92 32 L112 58 L94 64 L60 54 L26 64 Z"/><path class="crest-trim" d="M18 55 L32 39 L43 47 L60 22 L77 47 L88 39 L102 55" fill="none"/></svg>`;
    return `
        <span class="bar-center">
            <span class="who">${isPodOpp ? '<span class="pod-viewing-tag">Viewing</span>' : ''}${typeof ascBarFace === 'function' ? ascBarFace(P) : ''}${you(P) ? 'You' : esc(P.name)}${P.isAI && !you(P) ? ` <span class="mood" title="${esc(P.name.split(',')[0])} is feeling ${esc(MOODS[botMood(P).mood].name)}: ${esc(botMood(P).why)}">${moodIco(botMood(P).mood, 18)}</span>` : ''}</span>
            <span class="av-medallion">${crestSVG}${avHTML}<button type="button" class="life${targetable ? ' targetable' : ''}" onclick="pickTarget({ p: G.players[${P.i}] })" ${targetable ? '' : 'tabindex="-1"'} aria-label="${you(P) ? 'Your' : `${esc(P.name)}'s`} life: ${P.life}"><span class="lh">❤️ </span>${P.life}</button></span>
        </span>
        <span class="bar-left">
            ${G.format === 'commander' ? `<span class="zone-count cmd-dmg-pill" title="Commander damage taken (21 loses)">⚔️ ${P.cmdDmg}/21</span>` : ''}
            ${G.monarch === P.i ? '<span class="pc" title="The monarch draws a card at the end of their turn; deal them combat damage to take it">👑 Monarch</span>' : ''}${P.poison ? `<span class="pc poison" title="Poison counters (10 loses)">${uiIco('ctr-poison', '☠️', 16)} ${P.poison}/10</span>` : ''}${P.energy ? `<span class="pc" title="Energy counters">${uiIco('ctr-energy', '🔋', 16)} ${P.energy}</span>` : ''}${P.exp ? `<span class="pc" title="Experience counters">🎓 ${P.exp}</span>` : ''}
            ${P === me() && P.bf.some(o => Rx(o).peekTop) && P.library.length ? `<span class="pc" title="You may look at the top card of your library any time">👁 ${esc(P.library[P.library.length - 1].card.name)}</span>` : ''}
            <span class="zones">${libPile}${gyPile}${exPile}</span>
            ${P !== me() ? (handRevealed(P) ? `<button type="button" class="zone-count" onclick="showRevealedHand(${P.i})" title="Telepathy: their hand is revealed">✋ ${P.hand.length} 👁</button>` : `<span class="zone-count">✋ ${P.hand.length}</span>`) + `<span class="opp-hand${slv.cls}"${slv.style}>${'<i></i>'.repeat(Math.min(P.hand.length, 12))}</span>` : manaSummary(P)}
            <span class="cmd-zone">${cmd}</span>
        </span>
        <span class="bar-right">
            <button type="button" class="btn small" onclick="boardOverview(${P.i})" title="See every permanent on this side in one place">👁 Board</button>
            ${P !== me() ? `<span class="note deckname">${styleOf(P) ? `${styleOf(P).emoji} ${esc(styleOf(P).name)} · ` : ''}${esc(P.deckName)}${P.source ? ` · ${esc(P.source)}` : ''}</span>` : `<button type="button" class="btn small phone-only gm-btn" onclick="gameMenu()" aria-label="Game menu: log, life tracker, mana mode, concede">⋯</button>`}
            <button type="button" class="btn small desk-only bar-more" onclick="barMenu(${P.i})" title="Life and counters tracker${P === me() ? ', concede' : ''}" aria-label="More for ${esc(P.name)}">⋯</button>
        </span>`;
}

// Desktop: the "⋯" on each player bar holds the tracker (and Concede on your own bar), so the bar stays calm (2026-11-10)
function barMenu(i) {
    const P = G.players[i];
    menuSheet(you(P) ? 'You' : esc(P.name), `<div class="menu-list">
        <button class="btn" onclick="closeSheet(); playerSheet(${i})">🧮 Life, poison, energy and experience</button>
        ${you(P) ? `<button class="btn danger" onclick="closeSheet(); concede()">${uiIco('act-concede', '🏳️', 18)} Concede</button>` : `<p class="note">${esc(P.deckName)}${P.source ? ` · ${esc(P.source)}` : ''}</p>`}</div>`);
}
// Phones: the game menu (log, trackers, paying mana, concede) and the full log
function gameMenu() {
    menuSheet('Game', `<div class="menu-list">
        <button class="btn" onclick="logSheet()">📜 Game log</button>
        <button class="btn" onclick="closeSheet(); boardOverview(0)">👁 Board: every creature</button>
        <button class="btn" onclick="closeSheet(); playerSheet(0)">🧮 Your life & counters</button>
        <button class="btn" onclick="closeSheet(); tapAllLands()">💧 Tap all my lands (float the mana)</button>
        <button class="btn" onclick="closeSheet(); playerSheet(1)">🧮 ${esc(foe().name)}'s life & counters</button>
        <div class="seg" role="group" aria-label="Paying mana" style="width:100%;"><button type="button" style="flex:1; padding:10px;" data-mm="manual" aria-pressed="${manaMode === 'manual'}" onclick="setManaMode('manual'); gameMenu()">🖐 Tap lands myself</button><button type="button" style="flex:1; padding:10px;" data-mm="auto" aria-pressed="${manaMode === 'auto'}" onclick="setManaMode('auto'); gameMenu()">⚡ Auto-pay</button></div>
        <div class="seg" role="group" aria-label="Stops at the end of their turn" style="width:100%;"><button type="button" style="flex:1; padding:10px;" aria-pressed="${endStops === 'on'}" onclick="setEndStops('on'); gameMenu()" title="Ask me at the end of an opponent's turn when I can still cast an instant or use an ability">⏸ Ask at their end step</button><button type="button" style="flex:1; padding:10px;" aria-pressed="${endStops === 'off'}" onclick="setEndStops('off'); gameMenu()">⏩ Don't ask</button></div>
        ${speedToggleHTML('gameMenu()')}
        <p class="note">${esc(foe().deckName)}${foe().source ? ` · ${esc(foe().source)}` : ''}</p>
        <button class="btn danger" onclick="closeSheet(); concede()">${uiIco('act-concede', '🏳️', 18)} Concede</button></div>`);
}
// Telepathy (Magic 2010): a player who controls it sees the opponent's hand
function handRevealed(P) { return !!G && foes(P).some(F => F.bf.some(x => Rx(x).telepathy && !lostAbilities(x))); }
function showRevealedHand(i) {
    const P = G.players[i];
    if (!handRevealed(P)) return;
    showModal(`<h2>${esc(P.name)}'s hand (revealed)</h2><div class="pick-grid">${P.hand.map(o => `<button type="button" class="pick-card" title="${esc(o.card.name)}" onclick="closeModal()">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}</button>`).join('') || '<p class="note">No cards.</p>'}</div><div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
}
function logSheet() {
    menuSheet('Game log', `<div class="log" id="logSheetBody" style="max-height:60vh; font-size:0.9rem;">${G.log.map(l => { const cls = typeof logLineClass === 'function' ? logLineClass(l) : ''; return `<div${cls ? ` class="${cls}"` : ''}>${esc(l)}</div>`; }).join('')}</div>`);
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
function actOn() { return !AUTOPLAY && !!G && !G.hotseat && !G.over && !$('game').classList.contains('hidden'); }
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
    const others = G.players.filter(p => p !== me());
    if (!theirs && !(others.some(p => msg.includes(p.name)) || /^(?:Blocks:|You )/.test(msg) || cards.some(c => others.some(F => F.bf.concat(F.gy, F.exile, F.command).some(o => o.card === c)) && !me().bf.some(o => o.card === c)))) return;
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
function actMeta(msg, turn) {
    if (turn) return ['turn', '👑 Turn'];
    if (/\bcounters?\b/i.test(msg)) return ['counter', '↩️ Counter'];
    if (/\b(?:attacks? with|combat|damage)\b|^Blocks:|^No blocks/i.test(msg)) return ['combat', '⚔️ Combat'];
    if (/\bcasts?\b/i.test(msg)) return ['cast', '✨ Cast'];
    if (/\bplays?\b/i.test(msg)) return ['land', '🌿 Land'];
    if (/\b(?:activates?|equips?|crews?|cycles?|saddles?|foretells?)\b/i.test(msg)) return ['ability', '⚡ Ability'];
    return ['event', '📜 Action'];
}
function actScale(ms) { return Math.max(220, Math.round(ms / (gameSpeed || 1))); }
function renderAct() {
    const el = $('actBanner');
    if (!el || !actCur) return;
    const a = actCur, big = a.cards.length === 1;
    const [kind, badge] = actMeta(a.msg, a.turn);
    el.classList.toggle('turn', a.turn);
    el.dataset.kind = kind;
    el.style.setProperty('--act-ms', `${Math.max(250, a.ms)}ms`);
    el.innerHTML = `${a.cards.length ? `<div class="act-cards${big ? ' one' : ''}">${a.cards.map(c => (c.img || c.imgS) ? `<img src="${big ? (c.img || c.imgS) : (c.imgS || c.img)}" alt="${esc(c.name)}">` : `<span class="noimg">${esc(c.name)}</span>`).join('')}</div>` : ''}
        <div class="act-text"><span class="act-pill">${badge}</span><strong>${esc(a.msg.replace(/^— | —$/g, ''))}</strong>${a.subs.map(s => `<div>${esc(s)}</div>`).join('')}
        <small>${actQ.length ? `${actQ.length} more · click or Space to skip` : 'click to close'}</small></div><span class="act-prog" aria-hidden="true"></span>`;
}
function actNext() {
    clearTimeout(actTimer);
    const el = $('actBanner');
    actCur = actOn() ? actQ.shift() || null : null;
    if (!actCur) {
        actQ = [];
        if (el) { el.classList.remove('show', 'turn'); delete el.dataset.kind; }
        actWaiters.splice(0).forEach(r => r());
        return;
    }
    // A long chain plays faster the more is waiting (2026-11-11): a pile of steps shouldn't hold the table for half a minute
    if (actQ.length >= 4) actCur.ms = Math.min(actCur.ms, 600); else if (actQ.length >= 2) actCur.ms = Math.min(actCur.ms, 1000);
    actCur.ms = actScale(actCur.ms);
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
        return `<button type="button" class="stack-item${i === 0 ? ' top' : ''}${sel ? ' selectable' : ''}" data-stack-id="${it.id}" onclick="stackClick(${it.id})" title="${esc(it.name)}">${it.o.card.imgS ? `<img src="${it.o.card.imgS}" alt="">` : ''}<span>${esc(it.name)}${it.target ? ` → ${esc(targetName(it.target))}` : ''}</span></button>`;
    }).join('')}</div>`;
}
function stackClick(id) {
    const it = G.stack.find(x => x.id === id);
    if (!it) return;
    if (G.mode && G.mode.type === 'target') { pickTarget({ item: it }); return; }
    showGameCard(it.o.uid);
}

function combatBannerHTML() {
    if (!G || G.over) return '';
    const picking = G.mode && G.mode.type === 'attack' && G.mode.sel && G.mode.sel.size > 0;
    const uids = picking ? [...G.mode.sel] : (G.attackers || []);
    if (!uids.length) return '';
    const att = G.players[G.active];
    if (!att) return '';
    const objs = uids.map(onBf).filter(Boolean);
    if (!objs.length) return '';
    const tot = objs.reduce((n, o) => n + Math.max(0, pow(o)), 0);
    // Live unblocked damage math (accounts for blockers, double strike, and trample)
    let unblocked = 0;
    objs.forEach(o => {
        const p = Math.max(0, pow(o));
        const mult = has(o, 'double strike') ? 2 : 1;
        const blks = ((G.blocks && G.blocks[o.uid]) || []).map(onBf).filter(Boolean);
        if (!blks.length) { unblocked += p * mult; }
        else if (has(o, 'trample')) {
            const soak = blks.reduce((s, b) => s + Math.max(0, tou(b) - (b.dmg || 0)), 0);
            unblocked += Math.max(0, p * mult - soak);
        }
    });
    const defs = [...new Set(objs.map(o => o.atkTo != null ? o.atkTo : G.defender).filter(i => i != null && G.players[i]))];
    const primaryDef = defs.length === 1 ? G.players[defs[0]] : (G.players.length === 2 ? G.players[1 - att.i] : null);
    const defText = defs.length ? defs.map(i => G.players[i] === me() ? 'You' : who(G.players[i]).split(',')[0]).join(' & ') : (primaryDef ? (primaryDef === me() ? 'You' : who(primaryDef).split(',')[0]) : '');
    const hitsMe = defs.includes(me().i) || (primaryDef === me());
    const lethal = primaryDef && unblocked >= primaryDef.life;
    const anyUnblocked = objs.some(o => !((G.blocks && G.blocks[o.uid]) || []).length);
    const dmgNote = unblocked > 0
        ? (lethal ? ` · <strong class="lethal-tag">💀 LETHAL (${unblocked} dmg)</strong>` : ` · 💥 ${unblocked} unblocked${primaryDef ? ` (${defText} → ${Math.max(0, primaryDef.life - unblocked)})` : ''}`)
        : anyUnblocked ? ' · 0 dmg' : ' · 🛡️ All blocked';
    return `<div class="combat-pill${hitsMe || lethal ? ' danger' : ''}${lethal ? ' is-lethal' : ''}" role="status">⚔️ <strong>${att === me() ? 'You' : esc(who(att).split(',')[0])}</strong>${defText ? ` → <strong>${esc(defText)}</strong>` : ''} <span>· ${objs.length} ${objs.length === 1 ? 'attacker' : 'attackers'} (${tot} pwr)${dmgNote}</span></div>`;
}

// The mid bar: the phase strip, what you can do now, and the turn button,
// which stays in the same spot on every phase and both players' turns.
function midHTML() {
    return `<div class="mid-main">${phaseStripHTML()}${combatBannerHTML()}${stackHTML()}<div class="mid-controls">${midControlsHTML()}</div></div>${turnButtonHTML()}`;
}
const PHASE_STEPS = [['Upkeep', ['beginning', 'upkeep']], ['Main 1', ['main1']], ['Combat', ['declareAttackers', 'declareBlocks', 'afterBlocks', 'combatDamage']], ['Main 2', ['main2']], ['End', ['end']]];
// Whose turn it is, by the name the table uses (a bot's character name in a pod, else the player's name)
function turnName() { const A = G.players[G.active]; return A ? (A.char ? `${who(A)} (${A.name.split(',')[0]})` : A.name) : ''; }
function phaseStripHTML() {
    if (G.over || G.phase === 'setup') return '';
    return `<ol class="phase-strip ${G.active === G.view ? 'mine' : 'theirs'}" aria-label="Turn ${G.turn}: ${G.active === G.view ? 'your turn' : `${esc(turnName())}'s turn`}">
        <li class="whose">${G.active === G.view ? 'Your turn' : `${esc(turnName())}'s turn`}</li>${PHASE_STEPS.map(([label, ids], pi) => `<li${ids.includes(G.phase) ? ' class="now" aria-current="step"' : ''}>${typeof ascIco === 'function' ? ascIco(['phase-upkeep', 'phase-main', 'phase-combat', 'phase-main', 'phase-end'][pi], '', 16) : ''}${label}</li>`).join('')}</ol>`;
}
function turnButtonHTML() {
    if (G.over) return '';
    const m = G.mode;
    let label = 'End turn', sub = '', dis = false, title = 'End your turn';
    if (G.active !== G.view) { label = 'Their turn'; sub = m && m.type === 'block' ? 'Block, then Done' : m && m.type === 'respond' ? 'Respond or let it resolve' : 'Opponent is playing'; dis = true; title = `${turnName()} is taking their turn`; }
    else if (m && ['target', 'pay', 'block', 'respond'].includes(m.type)) { dis = true; sub = m.type === 'pay' ? 'Finish paying first' : 'Finish choosing first'; title = 'Finish or cancel what you are choosing first'; }
    else if (G.busy) { dis = true; sub = 'Resolving…'; }
    else if (m && m.type === 'attack') sub = 'Skips combat';
    else if (G.phase === 'afterBlocks') sub = 'Deals damage first';
    else if (G.extraCombat > 0 && (G.phase === 'main1' || G.phase === 'main2')) { sub = 'Additional combat first'; label = 'Extra combat'; title = 'You have an additional combat phase coming'; }
    else if (G.phase === 'main1') sub = 'Skips combat';
    const nudge = !dis && typeof MAIN !== 'undefined' && MAIN.includes(G.phase) && !m && !G.busy && !nextStepHint();
    return `<button type="button" id="turnBtn" class="turn-btn${dis ? '' : ' ready'}${nudge ? ' nudge' : ''}" ${dis ? 'disabled' : ''} onclick="endMyTurn()" title="${esc(title)}"><span class="tb-label">${label}${G.active === G.view ? ` ${uiIco('act-end-turn', '⏭', 18)}` : ''}</span>${sub ? `<span class="tb-sub">${esc(sub)}</span>` : ''}</button>`;
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

function allAttack() {
    if (!G || !G.mode || G.mode.type !== 'attack') return;
    me().bf.filter(canAttackWith).forEach(o => G.mode.sel.add(o.uid));
    confirmAttack();
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
        const avail = me().bf.filter(canAttackWith).length;
        const primaryAtk = m.sel.size
            ? `<button class="btn primary act-atk" onclick="confirmAttack()">${uiIco('act-attack', '⚔️', 18)} Attack with ${m.sel.size}</button>${m.sel.size < avail ? `<button class="btn gold" onclick="allAttack()" title="Attack with all ${avail} eligible creatures">⚔️ All Attack (${avail})</button>` : ''}`
            : `<button class="btn primary act-atk" onclick="allAttack()" title="Attack with all ${avail} eligible creatures">${uiIco('act-attack', '⚔️', 18)} All Attack${avail > 1 ? ` (${avail})` : ''}</button>`;
        return `${phase}<span class="prompt">Choose attackers${m.sel.size ? ` (${m.sel.size}/${avail})` : ''}</span>${primaryAtk}${typeof attackListButton === 'function' ? attackListButton() : ''}<button class="btn" onclick="throughCombat()" title="Beginning-of-combat effects stay; no attack; on to your second main phase">⏭️ No attack: to Main 2</button><button class="btn" onclick="cancelAttack()">Back</button>`;
    }
    if (m && m.type === 'respond') {
        const it = m.item;
        const apBtn = `<button type="button" class="btn small" onclick="toggleAutoPass()" title="Auto-pass all remaining priority stops this turn (Shift+Enter)">⏩ Auto-pass turn</button>`;
        if (it.window) return `${phase}<span class="prompt">⏳ ${esc(it.name)}: cast an instant or activate an ability, or:</span><button class="btn primary act-resolve" onclick="passPriority()">✔ Continue</button>${apBtn}`;
        return `${phase}<span class="prompt">↩️ ${esc(it.name)}${it.target ? ` (targeting ${esc(targetName(it.target))})` : ''} is on the stack.</span><button class="btn primary act-resolve" onclick="passPriority()">${uiIco('act-pass', '✔', 18)} Resolve</button>${apBtn}`;
    }
    if (m && m.type === 'block') {
        return `${phase}<span class="prompt">🛡️ ${m.picked && onBf(m.picked) ? `Now tap the attacker ${esc(onBf(m.picked).card.name.split(',')[0])} should block` : 'Tap one of your creatures, then the attacker it blocks. You can cast instants now.'}</span><button class="btn primary" onclick="confirmBlocks()">${uiIco('act-block', '✔', 18)} Done blocking</button>`;
    }
    if (G.active === G.view && !G.busy) {
        const hint = nextStepHint();
        const hintHTML = hint ? `<span class="hint">${esc(hint)}</span>` : '';
        if (G.phase === 'main1') return `${hintHTML}<button class="btn primary act-go" onclick="goToCombat()">${uiIco('phase-combat', '⚔️', 18)} Go to combat</button><button class="btn" onclick="throughCombat()" title="Go through combat without attacking (combat abilities still happen), then your second main phase">⏭️ Through combat to Main 2</button>`;
        if (G.phase === 'afterBlocks') return `<span class="prompt">Blocks are set. Cast a trick now, or:</span><button class="btn primary act-atk" onclick="dealDamage()">${uiIco('phase-damage', '💥', 18)} Deal damage</button>`;
        if (G.phase === 'main2') return hintHTML || '<span class="hint">Second main phase: cast anything else, then end your turn.</span>';
    }
    const apActive = G.autoPassTurn === G.turn ? `<button type="button" class="btn small gold" onclick="toggleAutoPass()" title="Click to stop auto-passing">⏩ Auto-passing (Cancel)</button>` : '';
    return `${apActive}<span class="note">${G.players[G.active] && G.players[G.active].isAI && G.active !== G.view ? `${esc(turnName())} is thinking…` : ''}</span>`;
}

function handHTML() {
    const P = me();
    // Cards you may play from exile this turn sit at the end of your hand, marked
    const top = P.library[P.library.length - 1];
    const topCard = top && (topCastOk(P, top) || pitTop(P) === top) ? [top] : [];
    const extraLands = MAIN.includes(G.phase) && G.active === G.view ? extraLandZones(P).filter(o => !topCard.includes(o)) : [];
    const gyModes = P.gy.filter(o => castAsOk(P, o, 'blitz') || castAsOk(P, o, 'disturb') || castAsOk(P, o, 'retrace') || castAsOk(P, o, 'beam') || lockerOk(P, o));
    return [...P.hand, ...P.exile.filter(o => o.playUntil >= G.turn || o.advReady || (o.foretoldTurn && o.foretoldTurn < G.turn) || (o.warpedTurn && o.warpedTurn < G.turn)), ...topCard, ...extraLands, ...gyModes].map(o => {
        const r = Rx(o);
        const playable = r.kind === 'land' ? canPlayLand(P, o) : (canCastNow(P, o) && canPay(P, o)) || ['blitz', 'escape', 'disturb', 'retrace', 'beam', 'sneak'].some(md => { o.castAs = md; const ok = castAsOk(P, o, md) && canCastNow(P, o) && canPay(P, o); o.castAs = null; return ok; });
        return `<button type="button" class="hc${playable ? ' playable' : ''}${!P.hand.includes(o) ? ' from-exile' : ''}" data-uid="${o.uid}" onclick="showGameCard(${o.uid})" title="${esc(o.card.name)}">${cardImg(o.card, true)}${r.support !== 'full' ? `<span class="sup badge sup-${r.support}">${r.support === 'none' ? '!' : '~'}</span>` : ''}</button>`;
    }).join('') || '<span class="note">No cards in hand.</span>';
}

function renderGame() {
    if (!G || $('game').classList.contains('hidden')) return;
    if (G.hotseat && !G.over) { const d = decider(); if (d !== null && d !== G.view) handTo(G.players[d]); }
    // Each zone is rebuilt only if its HTML changed (Phase 1c); the fitting below runs only if something did, or the window changed
    let changed = false;
    changed = setHTML($('oppBar'), (G.players.length > 2 ? podStripHTML() : '') + barHTML(foe())) || changed;
    changed = setHTML($('meBar'), barHTML(me())) || changed;
    changed = setHTML($('oppSide'), sideHTML(foe())) || changed;
    changed = setHTML($('meSide'), sideHTML(me())) || changed;
    changed = setHTML($('midBar'), midHTML()) || changed;
    changed = setHTML($('hand'), handHTML()) || changed;
    const handLabel = `Hand · ${me().hand.length}`;
    if ($('handCount').textContent !== handLabel) $('handCount').textContent = handLabel;
    const phl = $('phoneHandLbl');
    if (phl) phl.textContent = `✋ Hand · ${me().hand.length}`;
    if (typeof applyPhoneHand === 'function') applyPhoneHand();
    const fitKey = `${innerWidth}x${innerHeight}|${handSize}|${G.mode ? G.mode.type : ''}|${isPhone()}`;
    if (changed || renderGame.fitKey !== fitKey) { renderGame.fitKey = fitKey; fitTable(); }
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
const LANE_SCROLL = {}; // where each side's compact creature list was scrolled to, kept across redraws
function fitSide(side) {
    const front = side.querySelector('.lane.creatures');
    const back = side.querySelector('.row-back');
    const H = side.clientHeight - 10;
    const phone = innerWidth < 700;
    const isOpen = typeof openBoard === 'function' && openBoard();
    const AR = isOpen ? 0.82 : 88 / 63; // height per width: the open board shows the name bar and art only
    const items = front ? [...front.children] : [];
    const n = items.length;
    // Back row: lands and other permanents. Shrink slightly when the creature army is huge so zero scrollbars are needed!
    const paying = G && G.mode && G.mode.type === 'pay' && side.id === 'meSide';
    const landShare = paying ? 0.4 : (isOpen && !phone && n >= 10) ? 0.21 : 0.26;
    const landMax = paying ? 84 : (isOpen && !phone && n >= 10) ? 54 : 68;
    side.style.setProperty('--land-w', `${Math.max(paying ? 44 : 34, Math.min(landMax, Math.round(H * landShare / AR)))}px`);
    if (!front) return;
    front.classList.remove('crowded', 'compact', 'arena-dense');
    front.style.maxHeight = '';
    items.forEach(c => { c.style.marginLeft = ''; });
    const Hf = H - (back ? back.offsetHeight : 0) - 8 - (front.querySelector('.perm-wrap') ? 26 : 0);
    const W = Math.min(front.clientWidth, side.clientWidth - 8, innerWidth - 16); // never wider than the screen
    // MTG Arena zero-scrollbar scaling on desktop Open Board: smoothly shrinks cards down to 48px across 2-3 rows
    // for up to 22 distinct creature piles before ever falling back to compact scrolling tiles (26+ unique creatures still compact for layout.js).
    const minW = phone ? 58 : (isOpen && n <= 22) ? 48 : 76;
    const gap = (isOpen && !phone && n >= 10) ? 6 : 8;
    let w = 132, fits = false;
    for (; w >= minW; w -= 2) {
        const perRow = Math.max(1, Math.floor((W + gap) / (w + gap)));
        if (Math.ceil(n / perRow) * (w * AR + 8) <= Hf) { fits = true; break; }
    }
    // A short row with only a few creatures (a pod on a laptop screen): one row of smaller cards reads better than tiles
    if (!fits) { const wFit = Math.floor((Hf - 10) / AR); if (wFit >= 48 && n * (wFit + gap) <= W + gap) { w = wFit; fits = true; } }
    if (!fits) {
        w = phone ? 58 : 76;
        front.classList.add('compact');
        front.style.maxHeight = `${Math.max(96, Hf)}px`;
        front.onscroll = () => { LANE_SCROLL[side.id] = front.scrollTop; };
        if (LANE_SCROLL[side.id]) front.scrollTop = LANE_SCROLL[side.id];
    } else {
        delete LANE_SCROLL[side.id];
        if (isOpen && !phone && w <= 68) front.classList.add('arena-dense');
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
    // Never shingle past 44% overlap so every card's center remains directly clickable (even with 14+ cards!)
    const step = over ? Math.max(Math.ceil(w * 0.56), (W - w) / (n - 1)) : w + 6;
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
// Big preview of whatever card you point at (desktop fine mouse only; never stuck on touch phones, never rebuilds DOM on child micro-moves)
document.addEventListener('mouseover', e => {
    const peek = $('cardPeek');
    if (!peek || !G || isPhone() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const el = e.target.closest && e.target.closest('#game [data-uid]');
    if (!el) { peek.classList.add('hidden'); delete peek.dataset.uid; return; }
    // On desktop Open Board, hovered hand cards already glide up at full readability, so skip redundant side-peek flicker
    if (el.classList.contains('hc') && typeof openBoard === 'function' && openBoard()) {
        peek.classList.add('hidden'); delete peek.dataset.uid; return;
    }
    const o = findObj(Number(el.dataset.uid));
    if (!o || !o.card.img) { peek.classList.add('hidden'); delete peek.dataset.uid; return; }
    const rect = el.getBoundingClientRect();
    const uidKey = `${o.uid}:${onBf(o.uid) && isCreature(o) ? `${pow(o)}/${tou(o) - o.dmg}/${o.counters}` : ''}`;
    if (peek.dataset.uid !== uidKey) {
        peek.dataset.uid = uidKey;
        peek.innerHTML = `<img src="${o.card.img}" alt="">${onBf(o.uid) && isCreature(o) ? `<div class="peek-stats">${pow(o)}/${tou(o) - o.dmg}${o.counters ? ` · ${o.counters > 0 ? '+1/+1' : '-1/-1'} ×${Math.abs(o.counters)}` : ''}</div>` : ''}`;
    }
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
function showGraveyard(i, filter = 'all') {
    const P = G.players[i];
    if (!P.gy.length) { toast('The graveyard is empty.'); return; }
    const isCastable = o => you(P) && (Rx(o).flashback || (typeof gyCastOk === 'function' && gyCastOk(P, o)) || (typeof castAsOk === 'function' && ['escape', 'disturb', 'retrace', 'blitz', 'beam'].some(m => castAsOk(P, o, m))));
    const items = P.gy.map((o, k) => ({ o, k, cast: isCastable(o), kind: Rx(o).kind }))
        .sort((a, b) => (b.cast - a.cast) || (b.k - a.k));
    const shown = items.filter(x => filter === 'all' ? true : filter === 'cast' ? x.cast : filter === 'creature' ? x.kind === 'creature' : ['instant', 'sorcery'].includes(x.kind));
    const castN = items.filter(x => x.cast).length;
    window.__gy = k => { closeModal(); const o = P.gy[k]; if (o) showGameCard(o.uid); };
    const chip = (k, lbl) => `<button type="button" class="chip${filter === k ? ' on' : ''}" onclick="showGraveyard(${i}, '${k}')">${lbl}</button>`;
    showModal(`<h2>🪦 ${you(P) ? 'Your graveyard' : `${esc(P.name)}'s graveyard`} (${P.gy.length})</h2>
        <div class="chips zone-filters">${chip('all', `All (${items.length})`)}${castN ? chip('cast', `✨ Castable (${castN})`) : ''}${chip('creature', 'Creatures')}${chip('spell', 'Spells')}</div>
        <div class="pick-grid">${shown.length ? shown.map(({ o, k, cast }) => `<button type="button" class="pick-card${cast ? ' pick-castable' : ''}" onclick="__gy(${k})" title="${esc(o.card.name)}${cast ? ' — castable from graveyard' : ''}">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}${cast ? '<span class="pick-badge">✨ Castable</span>' : ''}</button>`).join('') : '<p class="note">No cards match this filter.</p>'}</div>
        <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
}
// What a player has in exile; face-down cards stay hidden from everyone but their owner (foretold, hideaway and the like)
function showExile(i, filter = 'all') {
    const P = G.players[i];
    if (!P.exile.length) { toast('Nothing is in exile.'); return; }
    const hidden = o => (o.faceDown || o.foretoldTurn) && !you(P);
    const isCastable = o => you(P) && !hidden(o) && (o.playUntil >= G.turn || o.advReady || (o.foretoldTurn && o.foretoldTurn < G.turn) || (o.warpedTurn && o.warpedTurn < G.turn));
    const items = P.exile.map((o, k) => ({ o, k, hid: hidden(o), cast: isCastable(o), kind: Rx(o).kind }))
        .sort((a, b) => (b.cast - a.cast) || (b.k - a.k));
    const shown = items.filter(x => filter === 'all' ? true : filter === 'cast' ? x.cast : !x.hid && x.kind === 'creature');
    const castN = items.filter(x => x.cast).length;
    window.__ex = k => { const o = P.exile[k]; if (!o || hidden(o)) return; closeModal(); showGameCard(o.uid); };
    const chip = (k, lbl) => `<button type="button" class="chip${filter === k ? ' on' : ''}" onclick="showExile(${i}, '${k}')">${lbl}</button>`;
    showModal(`<h2>${uiIco('zone-exile', '🌀', 26)} ${you(P) ? 'Your exile' : `${esc(P.name)}'s exile`} (${P.exile.length})</h2>
        <div class="chips zone-filters">${chip('all', `All (${items.length})`)}${castN ? chip('cast', `✨ Playable (${castN})`) : ''}${chip('creature', 'Creatures')}</div>
        <div class="pick-grid">${shown.length ? shown.map(({ o, k, hid, cast }) => hid ? `<span class="pick-card" title="A face-down card"><span class="noimg">Face down</span></span>` : `<button type="button" class="pick-card${cast ? ' pick-castable' : ''}" onclick="__ex(${k})" title="${esc(o.card.name)}${cast ? ' — playable from exile' : ''}">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}${cast ? '<span class="pick-badge">✨ Playable</span>' : ''}</button>`).join('') : '<p class="note">No cards match this filter.</p>'}</div>
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

