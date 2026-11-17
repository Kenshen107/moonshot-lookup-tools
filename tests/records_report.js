// Reads game records exported from Spellslinger Duels (📋 Game records -> Export, a .jsonl or .jsonl.gz file with one game per line, or a folder of them)
// or saved by the lab (LAB_RECORD=1 node tests/lab.js ... writes tests/.out/lab-records.jsonl), and reports what the games say:
// who wins, how long games last, and how people and the computer differ when they attack, block and cast.
// Usage: node tests/records_report.js <file-or-folder> [more files...]        (default: tests/.out/lab-records.jsonl)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

function readAll(args) {
    const files = [];
    const add = p => { if (!fs.existsSync(p)) { console.error('Not found: ' + p); return; } const st = fs.statSync(p); if (st.isDirectory()) fs.readdirSync(p).sort().forEach(f => /\.jsonl(\.gz)?$/.test(f) && add(path.join(p, f))); else files.push(p); };
    (args.length ? args : [path.join(__dirname, '.out', 'lab-records.jsonl')]).forEach(add);
    const games = [], seen = new Set();
    for (const f of files) {
        let text = fs.readFileSync(f); if (/\.gz$/.test(f)) text = zlib.gunzipSync(text);
        for (const line of text.toString('utf8').split('\n')) {
            if (!line.trim()) continue;
            try { const g = JSON.parse(line); const k = g.id || g.date + g.seed; if (seen.has(k)) continue; seen.add(k); games.push(g); } catch (e) { console.error(`Skipped a line in ${f}: ${e.message}`); }
        }
    }
    return games;
}
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
const count = s => { const m = /x(\d+)$/.exec(s); return m ? +m[1] : 1; };
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

const games = readAll(process.argv.slice(2));
if (!games.length) { console.log('No games found.'); process.exit(0); }
const v2 = games.filter(g => g.ev && g.ev.length);
console.log(`${games.length} games (${v2.length} with decision data, ${games.length - v2.length} log only)`);
const bySeats = {}, byKind = {}, byResult = {}; let turns = 0;
games.forEach(g => { bump(bySeats, g.seats + ' players'); bump(byKind, g.kind || '?'); bump(byResult, g.result || '?'); turns += g.turns || 0; });
console.log('Sizes:', JSON.stringify(bySeats), ' Formats:', JSON.stringify(byKind), ' Results for the person:', JSON.stringify(byResult));
console.log(`Average length: ${(turns / games.length).toFixed(1)} turns`);

// Wins by playstyle and by commander (fair share is 1 / seats)
const style = {}, cmdr = {};
games.forEach(g => g.players.forEach(p => {
    const s = p.style || (p.human ? 'person' : 'none'), win = g.winner === p.seat;
    style[s] = style[s] || { w: 0, n: 0 }; style[s].n++; if (win) style[s].w++;
    if (p.commander) { cmdr[p.commander] = cmdr[p.commander] || { w: 0, n: 0 }; cmdr[p.commander].n++; if (win) cmdr[p.commander].w++; }
}));
console.log('\nWins by playstyle (the person counts as "person"):');
Object.entries(style).sort((a, b) => b[1].n - a[1].n).forEach(([k, x]) => console.log(`  ${k.padEnd(14)} ${pct(x.w, x.n).padStart(6)}  (${x.w}/${x.n})`));
console.log('Commanders with the most games:');
Object.entries(cmdr).sort((a, b) => b[1].n - a[1].n).slice(0, 8).forEach(([k, x]) => console.log(`  ${k.slice(0, 40).padEnd(40)} ${pct(x.w, x.n).padStart(6)}  (${x.w}/${x.n})`));

if (v2.length) {
    // Attacks, blocks and casts, split by who decided (a person or the computer)
    const A = { person: { able: 0, sent: 0, n: 0 }, computer: { able: 0, sent: 0, n: 0 } };
    const B = { person: { atk: 0, blocked: 0 }, computer: { atk: 0, blocked: 0 } };
    const C = { person: { casts: 0, turns: 0, lands: 0 }, computer: { casts: 0, turns: 0, lands: 0 } };
    const pick = { n: 0, top: 0, gap: 0 }, prompts = {};
    const castWin = {}, castAll = {};
    v2.forEach(g => g.ev.forEach(e => {
        const who = e.ai ? 'computer' : 'person';
        if (e.e === 'turn') C[who].turns++;
        else if (e.e === 'dec') {
            if (e.k === 'attack') { A[who].n++; A[who].able += (e.able || []).reduce((a, s) => a + count(s), 0); A[who].sent += (e.atk || []).length; }
            else if (e.k === 'block') (e.blocks || []).forEach(b => { const d = e.defenderAI && e.defenderAI[b.to] ? 'computer' : 'person'; B[d].atk++; if (b.by && b.by.length) B[d].blocked++; });
            else if (e.k === 'cast') { C[who].casts++; castAll[e.card] = (castAll[e.card] || 0) + 1; if (g.winner === e.s) castWin[e.card] = (castWin[e.card] || 0) + 1; if (e.options && e.options.length > 1) { pick.n++; const sorted = e.options.slice().sort((a, b) => b.s - a.s); if (e.options.find(o => o.picked) === sorted[0]) pick.top++; pick.gap += sorted[0].s - sorted[1].s; } }
            else if (e.k === 'land') C[who].lands++;
            else if (e.k === 'prompt') { const k = (e.prompt || '').slice(0, 60); prompts[k] = prompts[k] || { n: 0, yes: 0 }; prompts[k].n++; if (e.choice === 'yes') prompts[k].yes++; }
        }
    }));
    console.log('\nWhen attacking (creatures sent out of the creatures that could attack):');
    ['person', 'computer'].forEach(w => console.log(`  ${w.padEnd(9)} ${pct(A[w].sent, A[w].able).padStart(6)}   over ${A[w].n} attack steps`));
    console.log('When defending (attackers that were blocked):');
    ['person', 'computer'].forEach(w => console.log(`  ${w.padEnd(9)} ${pct(B[w].blocked, B[w].atk).padStart(6)}   over ${B[w].atk} attackers`));
    console.log('Per turn started (spells cast, lands played):');
    ['person', 'computer'].forEach(w => console.log(`  ${w.padEnd(9)} ${(C[w].casts / Math.max(1, C[w].turns)).toFixed(2)} spells, ${(C[w].lands / Math.max(1, C[w].turns)).toFixed(2)} lands   (${C[w].turns} turns)`));
    if (pick.n) console.log(`The computer took its highest-scored play ${pct(pick.top, pick.n)} of ${pick.n} choices (average lead over the next play ${(pick.gap / pick.n).toFixed(1)}).`);
    const lift = Object.keys(castAll).filter(k => castAll[k] >= 5).map(k => [k, (castWin[k] || 0) / castAll[k], castAll[k]]).sort((a, b) => b[1] - a[1]);
    if (lift.length) { console.log('Cards cast 5+ times, by share of casts made by the winner:'); lift.slice(0, 6).forEach(([k, r, n]) => console.log(`  ${k.slice(0, 40).padEnd(40)} ${pct(r, 1).padStart(6)} of ${n}`)); }
    const pr = Object.entries(prompts).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    if (pr.length) { console.log('Questions a person answered most (share of yes):'); pr.forEach(([k, x]) => console.log(`  ${k.padEnd(60)} ${pct(x.yes, x.n).padStart(6)} of ${x.n}`)); }
}
