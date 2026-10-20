// Pod game records (2026-10-20, owner's request: "whenever someone plays a 4 pod commander game it records ... just their play log and the
// choices they made and whether they won or lost ... the share button just gives a format that is copy pastable with just a simple copy button
// and they could just text it to me"). Every pod game (3 or 4 players) with a person at the table is recorded in THIS browser only: the play log,
// each choice the person made (prompt and answer) and the result. Nothing is sent anywhere. 📋 Game records lists them, and Copy puts one on the
// clipboard as plain text (a short version for texting, or the full log) for the player to paste into a message.
const REC_KEEP = 15, REC_MAX_LINES = 4000;
const recOn = () => !!G && !!G.players && G.players.length >= 3 && !G.hotseat && (window.__REC_FORCE || (!AUTOPLAY && G.players.some(P => !P.isAI)));
function recInit() {
    const cmdr = P => { const c = [...P.command, ...P.bf, ...P.hand, ...P.library].find(o => o.isCommander); return c ? c.card.name : ''; };
    G.rec = { v: 1, date: new Date().toISOString(), seats: G.players.length, players: G.players.map(P => ({ seat: P.i, name: P.name, human: !P.isAI, commander: cmdr(P), deck: P.deckName || '', style: P.aiStyle || '', level: P.aiLevel || '' })), log: [], n: 0 };
}
function recAdd(line) {
    if (!G || !G.players) return;
    if (!G.rec) { if (!recOn()) return; recInit(); }
    if (G.rec.done || G.rec.log.length >= REC_MAX_LINES) return;
    G.rec.log.push(String(line));
}
// Wrap the global log, the questions a person answers and the end of the game (plain assignments: the engine calls these by name)
(function recHooks() {
    const _log = window.log;
    window.log = function (msg) { try { recAdd(msg); } catch (e) { } return _log.apply(this, arguments); };
    const nm = x => x == null ? '' : x.card ? x.card.name : x.name ? x.name : String(x);
    const show = a => Array.isArray(a) ? a.map(nm).join(', ') : typeof a === 'boolean' ? (a ? 'yes' : 'no') : a && typeof a === 'object' ? (a.o ? a.o.card.name : a.p ? a.p.name : a.item ? 'a spell on the stack' : nm(a)) : a == null ? 'none' : String(a);
    const wrap = (name, who, prompt) => {
        const f = window[name]; if (typeof f !== 'function') return;
        window[name] = function () {
            const P = arguments[who], r = f.apply(this, arguments);
            if (!P || P.isAI || !G || !G.players || !recOn()) return r;
            const note = a => { try { recAdd(`» ${P.name} chose [${prompt.apply(null, arguments)}]: ${show(a)}`); } catch (e) { } };
            const args = arguments;
            return r && typeof r.then === 'function' ? r.then(a => { note.apply(null, [a]); return a; }) : (note(r), r);
        };
    };
    const clean = s => String(s || '').replace(/\s+/g, ' ').slice(0, 140);
    wrap('askYes', 0, (P, msg) => clean(msg));
    wrap('askNumber', 0, (P, msg) => clean(msg));
    wrap('pickCard', 0, (P, list, title) => clean(title));
    wrap('pickMode', 0, (P, modes, src) => `${src && src.card ? src.card.name : 'card'}: choose a mode`);
    wrap('chooseTarget', 0, (P, e, src) => `target for ${src && src.card ? src.card.name : 'an effect'}`);
    wrap('pickScry', 0, (P, cards, surveil, src) => `${surveil ? 'surveil' : 'scry'} ${src && src.card ? src.card.name : ''}`);
    const _end = window.endGame;
    window.endGame = function (winner, reason) {
        const had = G && !G.over;
        try { if (had && G.rec && !G.rec.done) { G.rec.done = true; G.rec.winner = winner; G.rec.reason = String(reason || ''); G.rec.turns = G.turn; const hs = G.players.findIndex(P => !P.isAI); G.rec.humanSeat = hs; G.rec.result = winner === null ? 'draw' : (hs >= 0 && winner === hs) ? 'won' : 'lost'; G.rec.log.push(`Game over: ${reason}`); recSave(G.rec); } } catch (e) { }
        const r = _end.apply(this, arguments);
        try { if (had && G.rec && G.rec.done && !AUTOPLAY) recAddCopyButton(G.rec.id); } catch (e) { }
        return r;
    };
})();
// The game-over screen's last row of buttons gets a Copy button
function recAddCopyButton(id) { const row = document.querySelector('#modalHost .box > .row:last-child, #modalHost .box > div:last-child .row:last-child'); if (row) row.insertAdjacentHTML('beforeend', `<button class="btn" onclick="recCopyId('${id}', 'short')">📋 Copy this game</button>`); return !!row; }
function recSave(rec) {
    rec.id = rec.date.replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
    const list = store.get('gameRecords') || [];
    list.unshift(rec);
    store.set('gameRecords', list.slice(0, REC_KEEP));
}
// The text a player pastes into a message. short = the story of the game (turns, casts, attacks, deaths, deals, their choices); full = every log line
const REC_KEY = /^(—|»|Game over)|\b(cast|casts|attacks|Blocks|dies|destroyed|exiled|sacrifice|deal|eliminat|loses|wins|monarch|returns to the command zone|mulligan|archenemy|🤝|💔|🎯)|combat damage|\bplays\b/i;
function recText(rec, mode) {
    const who = (i, r) => (r.players[i] && (r.players[i].commander || r.players[i].name)) || ('seat ' + (i + 1));
    const head = [`SPELLSLINGER POD RECORD v${rec.v} (${mode === 'full' ? 'full log' : 'short'})`, `Date: ${rec.date.slice(0, 16).replace('T', ' ')} UTC · ${rec.seats} players · ${rec.turns || '?'} turns`,
        ...rec.players.map(p => `Seat ${p.seat + 1}${p.human || p.seat === rec.humanSeat ? ' (the player)' : ''}: ${p.commander || p.name}${p.style ? ` [${p.style}]` : ''}${p.deck ? ` - ${p.deck}` : ''}`),
        `Result: ${rec.result || '?'}${rec.winner != null ? ` (winner: ${who(rec.winner, rec)})` : ''} - ${rec.reason || ''}`, ''];
    let lines = rec.log;
    if (mode !== 'full') { const out = []; let last = ''; for (const l of lines) { if (REC_KEY.test(l) && l !== last) { out.push(l); last = l; } } lines = out; }
    return head.concat(lines).join('\n');
}
function recCopyText(text) {
    const done = ok => toast(ok ? 'Copied. Paste it into a message.' : 'Could not copy: select the text in the box and copy it.');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => done(true), () => recFallback(text, done));
    else recFallback(text, done);
}
function recFallback(text, done) {
    const box = document.getElementById('recText');
    const ta = box || Object.assign(document.createElement('textarea'), { value: text });
    try { if (!box) { ta.style.cssText = 'position:fixed;left:-999px'; document.body.appendChild(ta); } ta.select(); const ok = document.execCommand('copy'); if (!box) ta.remove(); done(ok); } catch (e) { done(false); }
}
function recById(id) { return (store.get('gameRecords') || []).find(r => r.id === id); }
function recCopyId(id, mode) { const r = recById(id); if (r) recCopyText(recText(r, mode)); }
function recView(id, mode) {
    const r = recById(id); if (!r) return recordsPanel();
    const text = recText(r, mode);
    showModal(`<div class="about"><h2>📋 Game record</h2>
        <p class="note">Nothing is sent anywhere. Press Copy, then paste it into a text or message.</p>
        <div class="row" style="gap:8px; flex-wrap:wrap; justify-content:center;"><button class="btn primary" onclick="recCopyId('${id}', '${mode}')">📋 Copy ${mode === 'full' ? 'full log' : 'short version'}</button>
        <button class="btn" onclick="recView('${id}', '${mode === 'full' ? 'short' : 'full'}')">${mode === 'full' ? 'Show the short version' : 'Show the full log (long)'}</button><button class="btn" onclick="recordsPanel()">← All games</button></div>
        <textarea id="recText" readonly style="width:100%; height:42vh; margin-top:10px; font-size:0.8em; background:var(--bg-inset); color:var(--text-primary); border:1px solid var(--border); border-radius:var(--radius-sm);">${esc(text)}</textarea>
        <p class="note">${text.length.toLocaleString()} characters${mode === 'full' ? '' : ' (the short version is meant for texting)'}.</p></div>`);
}
function recordsPanel() {
    recClearArmed = false;
    const list = store.get('gameRecords') || [];
    showModal(`<div class="about"><h2>📋 Game records</h2>
        <p class="about-lead">Every 3- or 4-player Commander game you play is saved here, on this device only: the play log, the choices you made and whether you won. Nothing is sent anywhere. To share one, open it, press Copy and paste it into a message.</p>
        ${list.length ? list.map(r => `<div class="about-card" style="margin:6px 0; text-align:left;"><strong>${r.result === 'won' ? '🏆' : r.result === 'draw' ? '🤝' : '💀'} ${esc((r.players.find(p => p.human) || r.players[0]).commander || 'Game')}</strong> <span class="note">${esc(r.date.slice(0, 10))} · ${r.seats} players · ${r.turns || '?'} turns</span>
            <div class="row" style="gap:6px; margin-top:4px;"><button class="btn small primary" onclick="recCopyId('${r.id}', 'short')">📋 Copy</button><button class="btn small" onclick="recView('${r.id}', 'short')">View</button><button class="btn small" onclick="recDelete('${r.id}')">Delete</button></div></div>`).join('') : '<p class="note">No pod games recorded yet. Play a 3- or 4-player Commander game and it will show up here.</p>'}
        <div class="actions">${list.length ? '<button class="btn" id="recClearBtn" onclick="recClear()">Delete all</button> ' : ''}<button class="btn primary" onclick="closeModal()">Close</button></div></div>`);
}
function recDelete(id) { store.set('gameRecords', (store.get('gameRecords') || []).filter(r => r.id !== id)); recordsPanel(); }
let recClearArmed = false;
function recClear() { if (!recClearArmed) { recClearArmed = true; const b = document.getElementById('recClearBtn'); if (b) b.textContent = 'Really delete all?'; return; } recClearArmed = false; store.set('gameRecords', []); recordsPanel(); }
