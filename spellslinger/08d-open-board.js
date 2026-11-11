// =====================================================================
// Open board (2026-11-12, owner's MTG Arena screenshots: "look at how their board is more open, can we do anything like this?", then
// "build steps 1 to 4 with the toggle"). A different look for the same table; nothing about how the game plays changes.
//   1. Piles: identical permanents pile from 2 (creatures too), and lands pile by name whatever their printing, with a ×N tag.
//   2. Art-first cards: each permanent shows its name bar and art with the power/toughness badge (CSS crop of the card picture); tap for the full card.
//   3. One mat: the player bars, the two sides and the middle bar lose their panels and borders; life is a round medallion; the stack shows
//      only its top item plus "+N more" (tap to see them all), unless you are choosing a target on the stack.
//   4. Phase rail: the phase strip is a row of small icons with only the current step named.
// Toggle: "Open board / Classic board" in the game menu (phones), the ⋯ menu on your bar and the hand tools (desktop). Saved per device
// (`boardStyle`, default open). `#game.open-board` turns the CSS on (end of styles.css). Loaded after 08c-attack-list.js.
'use strict';
let boardStyle = store.get('boardStyle', 'open');
function openBoard() { return boardStyle !== 'classic'; }
function applyBoardStyle() {
    const g = $('game'); if (g) g.classList.toggle('open-board', openBoard());
    const b = $('boardBtn'); if (b) b.innerHTML = openBoard() ? '▦<span class="mm-word"> Classic board</span>' : '▦<span class="mm-word"> Open board</span>';
}
function setBoardStyle(v) {
    boardStyle = v === 'classic' ? 'classic' : 'open';
    store.set('boardStyle', boardStyle);
    applyBoardStyle();
    if (G && !$('game').classList.contains('hidden')) { renderGame.fitKey = null; renderGame(); }
}
function boardToggleHTML(reopen) {
    return `<div class="seg" role="group" aria-label="Board look" style="width:100%;"><button type="button" style="flex:1; padding:10px;" aria-pressed="${openBoard()}" onclick="setBoardStyle('open'); ${reopen}">▦ Open board</button><button type="button" style="flex:1; padding:10px;" aria-pressed="${!openBoard()}" onclick="setBoardStyle('classic'); ${reopen}">▤ Classic board</button></div>`;
}

// 1. Piles
{
    const base = groupPerms;
    groupPerms = function (list, min) {
        if (!openBoard()) return base.apply(this, arguments);
        const m = G.mode, out = [], byKey = new Map();
        list.forEach(o => {
            const plain = !m && !o.attachedTo && !allPerms().some(a => a.attachedTo === o.uid) && !o.dmg && !o.tp && !o.tq && !o.tkw.length
                && !G.attackers.includes(o.uid) && !Object.values(G.blocks).some(bs => bs.includes(o.uid)) && !o.isCommander;
            if (!plain) { out.push([o]); return; }
            const land = Rx(o).kind === 'land' && !isCreature(o);
            // Lands by name (every Forest is one pile, whatever the printing); tokens by name and stats; other cards by card
            const ident = land ? `land|${o.card.name}` : o.token ? `${o.card.name}|${o.card.power}|${o.card.toughness}|${o.card.type}|${(o.card.colors || []).join('')}|${o.card.text || ''}` : o.card.id;
            const key = `${ident}|${o.counters || 0}|${JSON.stringify(o.ctr || {})}|${o.tapped}|${isCreature(o) && o.sick && !has(o, 'haste')}|${land ? '' : o.token}`;
            if (byKey.has(key)) byKey.get(key).push(o);
            else { const g = [o]; byKey.set(key, g); out.push(g); }
        });
        return out.flatMap(g => g.length >= 2 ? [g] : g.map(o => [o]));
    };
}

// 3. The stack: the top item, then "+N more"
function stackSheet() {
    menuSheet(`The stack (${G.stack.length}), top first`, `<div class="menu-list">${G.stack.slice().reverse().map((it, i) => `<button class="btn" style="justify-content:flex-start; text-align:left;" onclick="closeSheet(); stackClick(${it.id})">${i === 0 ? '⬆ ' : ''}${esc(it.name)}${it.target ? ` → ${esc(targetName(it.target))}` : ''}</button>`).join('')}</div>`);
}
{
    const base = stackHTML;
    stackHTML = function () {
        if (!openBoard() || G.stack.length <= 1) return base.apply(this, arguments);
        const m = G.mode;
        if (m && m.type === 'target' && G.stack.some(it => m.valid.some(v => v.item && v.item.id === it.id))) return base.apply(this, arguments); // a target on the stack: show them all
        const it = G.stack[G.stack.length - 1];
        return `<div class="stackbar open" aria-label="The stack, top first"><span class="lane-label">Stack</span><button type="button" class="stack-item top" onclick="stackClick(${it.id})" title="${esc(it.name)}">${it.o.card.imgS ? `<img src="${it.o.card.imgS}" alt="">` : ''}<span>${esc(it.name)}${it.target ? ` → ${esc(targetName(it.target))}` : ''}</span></button><button type="button" class="stack-more" onclick="stackSheet()" title="See everything on the stack">+${G.stack.length - 1} more</button></div>`;
    };
}

// 4. Phase rail
const PHASE_RAIL_ICONS = ['🔄', '🪄', '⚔️', '🪄', '🌙'];
{
    const base = phaseStripHTML;
    phaseStripHTML = function () {
        if (!openBoard() || G.over || G.phase === 'setup') return base.apply(this, arguments);
        const mine = G.active === G.view, whose = mine ? 'Your turn' : `${turnName()}'s turn`;
        return `<ol class="phase-strip rail ${mine ? 'mine' : 'theirs'}" aria-label="Turn ${G.turn}: ${esc(whose)}">
            <li class="whose" title="${esc(whose)}"><span class="rail-dot" aria-hidden="true"></span>${mine ? 'You' : esc(String(turnName()).split(/[ ,(]/)[0])}</li>${PHASE_STEPS.map(([label, ids], pi) => {
                const now = ids.includes(G.phase);
                return `<li title="${esc(label)}"${now ? ' class="now" aria-current="step"' : ''}><span class="rail-ico" aria-hidden="true">${typeof ascIco === 'function' ? ascIco(['phase-upkeep', 'phase-main', 'phase-combat', 'phase-main', 'phase-end'][pi], PHASE_RAIL_ICONS[pi], 16) : PHASE_RAIL_ICONS[pi]}</span>${now ? `<span class="rail-name">${label}</span>` : `<span class="sr-only">${label}</span>`}</li>`;
            }).join('')}</ol>`;
    };
}

// The toggle in the menus
{
    const baseGame = gameMenu;
    gameMenu = function () {
        baseGame.apply(this, arguments);
        const list = document.querySelector('#sheetHost .menu-list');
        if (list) list.insertAdjacentHTML('afterbegin', boardToggleHTML('gameMenu()'));
    };
    const baseBar = barMenu;
    barMenu = function (i) {
        baseBar.apply(this, arguments);
        const list = document.querySelector('#sheetHost .menu-list');
        if (list && G.players[i] && you(G.players[i])) list.insertAdjacentHTML('afterbegin', boardToggleHTML(`barMenu(${i})`));
    };
    const baseRender = renderGame;
    renderGame = function () { applyBoardStyle(); return baseRender.apply(this, arguments); };
}
