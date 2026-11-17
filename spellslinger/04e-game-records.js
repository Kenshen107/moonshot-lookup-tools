// Game records (2026-10-20 for pods; reworked 2026-11-17, owner: "make our logs better ... a mass export of all games ... would probably be helpful for
// developing AI", then "do all three in one round, pods and 2-player both"). Every game with a person at the table (2 to 4 players, not a game on one
// device, not autoplay) is recorded in THIS browser only. A record holds: the play log (plain text), what the person answered, who won, AND (v2) the data
// a program can learn from: every seat's decklist, a snapshot of the table at the start of each turn, and one structured event for each decision (a
// spell cast, a land played, an ability used, attackers, blockers, a prompt the person answered) with the state it was made in and, for the
// computer's casts, the plays it was choosing between. Nothing is sent anywhere. 📋 Game records lists them; Copy puts one on the clipboard as text
// (short for texting, or the full log); Export saves every game (or one) as a .jsonl file, one game per line, for people who want to hand the games over.
const REC_VERSION = 2, REC_KEEP = 100, REC_MAX_LINES = 4000, REC_MAX_EV = 5000, REC_MAX_BYTES = 24e6;
const recOn = () => !!G && !!G.players && G.players.length >= 2 && !G.hotseat && (window.__REC_FORCE || (!AUTOPLAY && G.players.some(P => !P.isAI)));
const recNm = x => x == null ? '' : x.card ? x.card.name : x.name ? x.name : String(x);
// Card names grouped with a count: ["Mountain x40", "Sol Ring"]
function recGroup(list) { const m = {}; (list || []).forEach(n => { m[n] = (m[n] || 0) + 1; }); return Object.entries(m).map(([n, c]) => c > 1 ? `${n} x${c}` : n); }
function recDeckList(P) {
    try { return recGroup([...P.command, ...P.bf, ...P.hand, ...P.library, ...P.gy, ...P.exile].map(o => o.card && o.card.name).filter(Boolean)).sort(); } catch (e) { return []; }
}
function recInit() {
    const cmdr = P => { const c = [...P.command, ...P.bf, ...P.hand, ...P.library].find(o => o.isCommander); return c ? c.card.name : ''; };
    if (window.__recBusyReset) window.__recBusyReset();
    G.rec = {
        v: REC_VERSION, date: new Date().toISOString(), seats: G.players.length, kind: G.format || '', campaign: !!G.campaign, draftRound: G.draftRound || 0,
        build: typeof SPV === 'string' ? SPV : '', rules: typeof CARD_COVERAGE === 'object' ? CARD_COVERAGE.measured : '', seed: (window.__LAB && window.__LAB.seed) || null,
        players: G.players.map(P => ({ seat: P.i, name: P.name, human: !P.isAI, commander: cmdr(P), deck: P.deckName || '', style: P.aiStyle || '', level: P.aiLevel || '', deckList: recDeckList(P) })),
        log: [], ev: [], n: 0
    };
}
function recAdd(line) {
    if (!G || !G.players) return;
    if (!G.rec) { if (!recOn()) return; recInit(); }
    if (G.rec.done || G.rec.log.length >= REC_MAX_LINES) return;
    G.rec.log.push(String(line));
}
// A compact picture of the table from one seat's point of view: everyone's life, hand and library size, non-land permanents (with power and
// toughness for creatures), land counts, and the chooser's own hand and available mana.
function recSnap(P, light) {
    try {
        // The computer's decisions get the light picture (life, hand, mana): the turn events already hold the whole board
        if (light) return { life: G.players.map(X => X.life), mine: recGroup(P.hand.map(o => o.card.name)), mana: (() => { try { return availableMana(P); } catch (e) { return null; } })() };
        const board = X => recGroup(X.bf.filter(o => !hasType(o, 'Land')).map(o => o.card.name + (isCreature(o) ? ` ${pow(o)}/${tou(o)}` : '') + (o.tapped ? ' (tapped)' : '')));
        return {
            life: G.players.map(X => X.life), hand: G.players.map(X => X.hand.length), lib: G.players.map(X => X.library.length),
            lands: G.players.map(X => X.bf.filter(o => hasType(o, 'Land')).length), board: G.players.map(board), out: G.players.map(X => !!X.out),
            mine: recGroup(P.hand.map(o => o.card.name)), mana: (() => { try { return availableMana(P); } catch (e) { return null; } })()
        };
    } catch (e) { return null; }
}
// One structured event. e = 'turn' (start of a turn), 'dec' (a decision), 'out' (a player leaves).
function recEv(ev, P) {
    if (!G || !G.players) return;
    if (!G.rec) { if (!recOn()) return; recInit(); }
    if (G.rec.done || G.rec.ev.length >= REC_MAX_EV) return;
    ev.t = G.turn; ev.ph = G.phase;
    if (P) { ev.s = P.i; ev.ai = !!P.isAI; if (ev.e === 'dec') ev.st = recSnap(P, !!P.isAI); }
    G.rec.ev.push(ev);
}
const recTgt = t => { try { return t == null ? null : t.o ? t.o.card.name : t.p ? 'player ' + (t.p.i + 1) : t.item ? 'a spell on the stack' : recNm(t); } catch (e) { return null; } };
// The computer's choices (called from aiBestPlay): the best few plays it was choosing between and the one it took.
function recCands(cands, pick) {
    try { if (!G || !G.rec || !pick) return; G.recCands = { pick: pick.o, list: cands.slice().sort((a, b) => b.s - a.s).slice(0, 8).map(c => ({ c: c.o.card.name, s: Math.round(c.s * 10) / 10, tgt: recTgt(c.target), picked: c === pick || (c.o === pick.o && c.target === pick.target) })) }; } catch (e) { }
}
// Wrap the global log, the questions a person answers, the engine's decision points and the end of the game (plain assignments: the engine calls these by name)
(function recHooks() {
    const _log = window.log;
    window.log = function (msg) { try { recAdd(msg); } catch (e) { } return _log.apply(this, arguments); };
    const nm = recNm;
    const show = a => Array.isArray(a) ? a.map(nm).join(', ') : typeof a === 'boolean' ? (a ? 'yes' : 'no') : a && typeof a === 'object' ? (a.o ? a.o.card.name : a.p ? a.p.name : a.item ? 'a spell on the stack' : nm(a)) : a == null ? 'none' : String(a);
    const wrap = (name, who, prompt, optsOf) => {
        const f = window[name]; if (typeof f !== 'function') return;
        window[name] = function () {
            // A question that asks itself again (waiting for the play-by-play, handing the device over) is one choice, not two
            if (wrap.busy[name]) return f.apply(this, arguments);
            const P = arguments[who];
            wrap.busy[name] = true;
            let r; try { r = f.apply(this, arguments); } finally { wrap.busy[name] = false; }
            if (!P || P.isAI || !G || !G.players || !recOn()) return r;
            if (r && typeof r.then === 'function') wrap.busy[name] = true;
            const args = arguments;
            const note = a => {
                try {
                    recAdd(`» ${P.name} chose [${prompt.apply(null, args)}]: ${show(a)}`);
                    recEv({ e: 'dec', k: 'prompt', kind: name, prompt: prompt.apply(null, args), opts: optsOf ? optsOf.apply(null, args) : null, choice: show(a) }, P);
                } catch (e) { }
            };
            return r && typeof r.then === 'function' ? r.then(a => { wrap.busy[name] = false; note(a); return a; }, er => { wrap.busy[name] = false; throw er; }) : (note(r), r);
        };
    };
    wrap.busy = {}; window.__recBusyReset = () => { wrap.busy = {}; };
    const clean = s => String(s || '').replace(/\s+/g, ' ').slice(0, 140);
    const names = l => { try { return (l || []).map(x => typeof x === 'string' ? x : x.text || x.label || nm(x)).slice(0, 40); } catch (e) { return null; } };
    wrap('askYes', 0, (P, msg) => clean(msg), () => ['yes', 'no']);
    wrap('askNumber', 0, (P, msg) => clean(msg), (P, msg, lo, hi) => ({ min: lo, max: hi }));
    wrap('pickCard', 0, (P, list, title) => clean(title), (P, list) => names(list));
    wrap('pickMode', 0, (P, modes, src) => `${src && src.card ? src.card.name : 'card'}: choose a mode`, (P, modes) => names(modes));
    wrap('chooseTarget', 0, (P, e, src) => `target for ${src && src.card ? src.card.name : 'an effect'}`, null);
    wrap('pickScry', 0, (P, cards, surveil, src) => `${surveil ? 'surveil' : 'scry'} ${src && src.card ? src.card.name : ''}`, (P, cards) => names(cards));

    // Decision points for every player, person or computer. Each recorder is wrapped in try/catch: a record problem must never touch the game.
    const hook = (name, before) => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function () { try { if (G && G.players && recOn()) before.apply(this, arguments); } catch (e) { } return f.apply(this, arguments); }; };
    hook('beginTurn', function () { const P = G.players[G.active]; recEv({ e: 'turn', s: P.i, ai: !!P.isAI, st: recSnap(P) }); });
    hook('castSpell', function (P, o, tgt) {
        const zone = P.hand.includes(o) ? 'hand' : P.command.includes(o) ? 'command' : P.gy.includes(o) ? 'graveyard' : P.exile.includes(o) ? 'exile' : P.library.includes(o) ? 'library' : 'other';
        const ev = { e: 'dec', k: 'cast', card: o.card.name, from: zone, tgt: recTgt(tgt) };
        const c = G.recCands; if (c && c.pick === o && P.isAI) { ev.options = c.list; } G.recCands = null;
        recEv(ev, P);
    });
    hook('playLand', function (P, o) { recEv({ e: 'dec', k: 'land', card: o.card.name }, P); });
    hook('activate', function (P, o, a) { recEv({ e: 'dec', k: 'ability', card: o.card.name }, P); });
    hook('declareAttackers', function (P, list) {
        const able = P.bf.filter(x => { try { return canAttackWith(x); } catch (e) { return false; } }).map(x => x.card.name);
        recEv({ e: 'dec', k: 'attack', able: recGroup(able), atk: (list || []).map(x => ({ c: x.card.name, pt: `${pow(x)}/${tou(x)}`, to: x.atkTo != null ? x.atkTo : (G.players.length === 2 ? opp(P).i : null) })) }, P);
    });
    hook('combatDamage', function (A) {
        const atks = (G.attackers || []).map(onBf).filter(Boolean); if (!atks.length) return;
        const blocks = atks.map(x => ({ a: x.card.name, to: x.atkTo != null ? x.atkTo : (G.players.length === 2 ? opp(A).i : null), by: (G.blocks[x.uid] || []).map(onBf).filter(Boolean).map(b => b.card.name) }));
        const key = G.turn + JSON.stringify(blocks); if (G.rec && G.rec.lastBlocks === key) return; if (G.rec) G.rec.lastBlocks = key;
        const dai = {}; G.players.forEach(X => { if (X !== A && !X.out) dai[X.i] = !!X.isAI; });
        const avail = {}; G.players.forEach(X => { if (X !== A && !X.out) avail[X.i] = recGroup(X.bf.filter(o => isCreature(o) && !o.tapped && !atks.includes(o)).map(o => o.card.name)); });
        recEv({ e: 'dec', k: 'block', blocks, defenderAI: dai, avail }, A);
    });
    hook('eliminate', function (P, reason) { recEv({ e: 'out', reason: String(reason || '') }, P); });

    const _end = window.endGame;
    window.endGame = function (winner, reason) {
        const had = G && !G.over;
        try {
            if (had && G.rec && !G.rec.done) {
                G.rec.done = true; G.rec.winner = winner; G.rec.reason = String(reason || ''); G.rec.turns = G.turn;
                const hs = G.players.findIndex(P => !P.isAI); G.rec.humanSeat = hs; G.rec.result = winner === null ? 'draw' : hs < 0 ? 'ai game' : winner === hs ? 'won' : 'lost'; // 'ai game': nobody was at the table (the lab)
                G.rec.final = { life: G.players.map(X => X.life), out: G.players.map(X => !!X.out) };
                G.rec.log.push(`Game over: ${reason}`); recSave(G.rec);
            }
        } catch (e) { }
        const r = _end.apply(this, arguments);
        try { if (had && G.rec && G.rec.done && !AUTOPLAY) recAddCopyButton(G.rec.id); } catch (e) { }
        return r;
    };
})();
// The game-over screen's last row of buttons gets a Copy button
function recAddCopyButton(id) { const row = document.querySelector('#modalHost .box > .row:last-child, #modalHost .box > div:last-child .row:last-child'); if (row) row.insertAdjacentHTML('beforeend', `<button class="btn" onclick="recCopyId('${id}', 'short')">📋 Copy this game</button>`); return !!row; }
function recSave(rec) {
    rec.id = rec.date.replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6);
    rec.lastBlocks = undefined;
    try { rec.bytes = JSON.stringify(rec).length; } catch (e) { rec.bytes = 0; }
    let list = [rec, ...(store.get('gameRecords') || [])].slice(0, REC_KEEP);
    // Keep the newest games that fit the size budget (the saved data is held in memory, so it can't grow without a limit)
    let total = 0; const kept = [];
    for (const r of list) { total += r.bytes || 0; if (kept.length && total > REC_MAX_BYTES) break; kept.push(r); }
    store.set('gameRecords', kept);
}
// The text a player pastes into a message. short = the story of the game (turns, casts, attacks, deaths, deals, their choices); full = every log line
const REC_KEY = /^(—|»|Game over)|\b(cast|casts|attacks|Blocks|dies|destroyed|exiled|sacrifice|deal|eliminat|loses|wins|monarch|returns to the command zone|mulligan|archenemy|🤝|💔|🎯)|combat damage|\bplays\b/i;
// A short summary from the structured events: life by turn, who left when, how much each seat cast and attacked
function recSummary(rec) {
    const ev = rec.ev || []; if (!ev.length) return [];
    const out = ['Summary:'];
    const turns = ev.filter(e => e.e === 'turn' && e.st);
    if (turns.length) {
        const step = Math.max(1, Math.ceil(turns.length / 14));
        out.push('Life at the start of each turn (seat 1/2/...):');
        turns.forEach((e, i) => { if (i % step === 0 || i === turns.length - 1) out.push(`  turn ${e.t} (seat ${e.s + 1}'s): ${e.st.life.join(' / ')}`); });
    }
    const n = rec.seats, cast = Array(n).fill(0), atk = Array(n).fill(0), lands = Array(n).fill(0), ab = Array(n).fill(0);
    ev.forEach(e => { if (e.e !== 'dec') return; if (e.k === 'cast') cast[e.s]++; else if (e.k === 'attack') atk[e.s] += (e.atk || []).length; else if (e.k === 'land') lands[e.s]++; else if (e.k === 'ability') ab[e.s]++; });
    out.push(`Spells cast: ${cast.join(' / ')} · lands played: ${lands.join(' / ')} · attackers sent: ${atk.join(' / ')} · abilities used: ${ab.join(' / ')}`);
    ev.filter(e => e.e === 'out').forEach(e => out.push(`Seat ${e.s + 1} left on turn ${e.t}: ${e.reason}`));
    const deals = (rec.log || []).filter(l => /^🤝/.test(l)).length, broken = (rec.log || []).filter(l => /^💔/.test(l)).length;
    if (deals || broken) out.push(`Deals logged: ${deals} made, ${broken} broken`);
    out.push('');
    return out;
}
function recText(rec, mode) {
    const who = (i, r) => (r.players[i] && (r.players[i].commander || r.players[i].name)) || ('seat ' + (i + 1));
    const head = [`SPELLSLINGER ${rec.seats > 2 ? 'POD' : 'GAME'} RECORD v${rec.v} (${mode === 'full' ? 'full log' : 'short'})`, `Date: ${rec.date.slice(0, 16).replace('T', ' ')} UTC · ${rec.seats} players · ${rec.turns || '?'} turns${rec.kind ? ' · ' + rec.kind : ''}${rec.build ? ' · build ' + rec.build : ''}`,
        ...rec.players.map(p => `Seat ${p.seat + 1}${p.human || p.seat === rec.humanSeat ? ' (the player)' : ''}: ${p.commander || p.name}${p.style ? ` [${p.style}]` : ''}${p.deck ? ` - ${p.deck}` : ''}`),
        `Result: ${rec.result || '?'}${rec.winner != null ? ` (winner: ${who(rec.winner, rec)})` : ''} - ${rec.reason || ''}`, '', ...recSummary(rec)];
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
// Export: one game per line (JSON Lines). Every field of the record goes out as saved, so the file can be read by a program with no help from the game.
function recJsonl(list) { return list.map(r => JSON.stringify(r)).join('\n') + '\n'; }
function recDownload(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
}
async function recGzip(text) {
    const cs = new CompressionStream('gzip'), w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(text)); w.close();
    return await new Response(cs.readable).blob();
}
async function recExport(ids, gz) {
    const all = store.get('gameRecords') || [];
    const list = ids ? all.filter(r => ids.includes(r.id)) : all;
    if (!list.length) { toast('No games to export yet.'); return false; }
    const stamp = new Date().toISOString().slice(0, 10), text = recJsonl(list);
    const base = ids && ids.length === 1 ? `spellslinger-game-${ids[0]}` : `spellslinger-games-${stamp}-${list.length}`;
    try {
        if (gz && typeof CompressionStream === 'function') recDownload(base + '.jsonl.gz', await recGzip(text));
        else recDownload(base + '.jsonl', new Blob([text], { type: 'application/x-ndjson' }));
        toast(`Saved ${list.length} game${list.length === 1 ? '' : 's'}. Nothing was sent anywhere.`);
        return true;
    } catch (e) { toast('Could not save the file.'); return false; }
}
function recView(id, mode) {
    const r = recById(id); if (!r) return recordsPanel();
    const text = recText(r, mode);
    showModal(`<div class="about"><h2>📋 Game record</h2>
        <p class="note">Nothing is sent anywhere. Press Copy, then paste it into a text or message.</p>
        <div class="row" style="gap:8px; flex-wrap:wrap; justify-content:center;"><button class="btn primary" onclick="recCopyId('${id}', '${mode}')">📋 Copy ${mode === 'full' ? 'full log' : 'short version'}</button>
        <button class="btn" onclick="recView('${id}', '${mode === 'full' ? 'short' : 'full'}')">${mode === 'full' ? 'Show the short version' : 'Show the full log (long)'}</button><button class="btn" onclick="recExport(['${id}'])">⬇ Export this game</button><button class="btn" onclick="recordsPanel()">← All games</button></div>
        <textarea id="recText" readonly style="width:100%; height:42vh; margin-top:10px; font-size:0.8em; background:var(--bg-inset); color:var(--text-primary); border:1px solid var(--border); border-radius:var(--radius-sm);">${esc(text)}</textarea>
        <p class="note">${text.length.toLocaleString()} characters${mode === 'full' ? '' : ' (the short version is meant for texting)'}.</p></div>`);
}
function recordsPanel() {
    recClearArmed = false;
    const list = store.get('gameRecords') || [];
    const mb = Math.max(0.1, list.reduce((a, r) => a + (r.bytes || 0), 0) / 1e6).toFixed(1);
    showModal(`<div class="about"><h2>📋 Game records</h2>
        <p class="about-lead">Every game you play against the computer (2 to 4 players) is saved here, on this device only: the play log, the choices you made, each deck, how the table looked at every turn and every decision, and whether you won. Nothing is sent anywhere. The newest ${REC_KEEP} games are kept.</p>
        <p class="note">To share one, open it, press Copy and paste it into a message. To hand over all of them, use Export: it saves one file with a game on each line, including the deck lists and the names on this device.</p>
        ${list.length ? `<div class="row" style="gap:8px; flex-wrap:wrap; justify-content:center; margin:8px 0;"><button class="btn primary" onclick="recExport(null)">⬇ Export all ${list.length} games (${mb} MB)</button>${typeof CompressionStream === 'function' ? '<button class="btn" onclick="recExport(null, true)">⬇ Export all, compressed (.gz)</button>' : ''}</div>` : ''}
        <div style="max-height:48vh; overflow:auto;">${list.length ? list.map(r => `<div class="about-card" style="margin:6px 0; text-align:left;"><strong>${r.result === 'won' ? '🏆' : r.result === 'draw' ? '🤝' : '💀'} ${esc((r.players.find(p => p.human) || r.players[0]).commander || 'Game')}</strong> <span class="note">${esc(r.date.slice(0, 10))} · ${r.seats} players · ${r.turns || '?'} turns${r.ev ? '' : ' · log only'}</span>
            <div class="row" style="gap:6px; margin-top:4px;"><button class="btn small primary" onclick="recCopyId('${r.id}', 'short')">📋 Copy</button><button class="btn small" onclick="recView('${r.id}', 'short')">View</button><button class="btn small" onclick="recExport(['${r.id}'])">⬇ Export</button><button class="btn small" onclick="recDelete('${r.id}')">Delete</button></div></div>`).join('') : '<p class="note">No games recorded yet. Play a game against the computer and it will show up here.</p>'}</div>
        <div class="actions">${list.length ? '<button class="btn" id="recClearBtn" onclick="recClear()">Delete all</button> ' : ''}<button class="btn primary" onclick="closeModal()">Close</button></div></div>`);
}
function recDelete(id) { store.set('gameRecords', (store.get('gameRecords') || []).filter(r => r.id !== id)); recordsPanel(); }
let recClearArmed = false;
function recClear() { if (!recClearArmed) { recClearArmed = true; const b = document.getElementById('recClearBtn'); if (b) b.textContent = 'Really delete all?'; return; } recClearArmed = false; store.set('gameRecords', []); recordsPanel(); }
