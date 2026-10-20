// What the lab games say about how to play. Reads the one-game-per-line file tests/lab.js writes (tests/.out/lab.jsonl) and prints
// what separates winners from losers, how the AI levels and playstyles do, how fast people ramp, who dies first and how aggressive each style is.
// Usage: node tests/lab_report.js [file.jsonl]   (no browser: it takes a second)
'use strict';
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '.out', 'lab.jsonl');
const games = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(g => g.stats && !g.hang && !g.error);
const done = games.filter(g => g.winner !== null && g.winner !== undefined && !g.stalled), stalled = games.filter(g => g.stalled);
if (!done.length) { console.log('No finished games with stats in ' + file); process.exit(0); }
const n = done[0].stats.seats.length, pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-', f1 = x => (+x).toFixed(1), f2 = x => (+x).toFixed(2);
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const out = { file, games: games.length, finished: done.length, stalled: stalled.length };
console.log(`${games.length} games (${done.length} finished, ${stalled.length} stalled), ${n} players, median ${med(done.map(g => g.turns || g.turn))} turns\n`);

// 1. Seats, styles, levels
console.log('Wins by seat (turn order; fair share ' + (100 / n).toFixed(0) + '%): ' + Array.from({ length: n }, (_, i) => `${'ABCD'[i]} ${pct(done.filter(g => g.winner === i).length, done.length)}`).join('  '));
const by = (key) => { const t = {}; done.forEach(g => (g[key] || []).forEach((v, i) => { if (!v) return; const o = t[v] = t[v] || { g: 0, w: 0 }; o.g++; if (g.winner === i) o.w++; })); return t; };
const show = (title, t) => { const rows = Object.entries(t).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g); if (rows.length) console.log(`${title}: ` + rows.map(([k, o]) => `${k} ${pct(o.w, o.g)} (${o.w}/${o.g})`).join(', ')); out[title] = Object.fromEntries(rows); };
show('Wins by playstyle', by('styles')); show('Wins by AI level', by('levels'));

// 2. Winners vs the rest: seat-games as rows
const rows = [];
done.forEach(g => g.stats.seats.forEach((s, i) => {
    const d = (g.decks || [])[i] || {}, tl = s.tl, at = k => tl[Math.min(k, tl.length - 1)] || [], first = tl.length;
    const lastTurn = g.stats.elim.find(e => e.seat === i);
    rows.push({ win: g.winner === i ? 1 : 0, seat: i, style: (g.styles || [])[i] || '-', cmd: d.name,
        f: { 'deck: lands': d.lands, 'deck: average mana value': d.avgCmc, 'deck: mana makers': d.ramp, 'deck: card draw': d.draw, 'deck: removal': d.removal, 'deck: creatures': (d.kinds || {}).creature, 'deck: commander mana value': d.cmdCmc,
            'turn 3: mana': at(2)[2], 'turn 5: mana': at(4)[2], 'turn 8: mana': at(7)[2], 'turn 5: creatures': at(4)[4], 'turn 8: creatures': at(7)[4], 'turn 8: board power': at(7)[5], 'turn 5: cards in hand': at(4)[3], 'turn 5: lands': at(4)[6],
            'spells cast': s.cast, 'creatures cast': s.creat, 'noncreature spells cast': s.spell, 'attacks per own turn': first ? s.atk / first : 0, 'creatures per attack': s.atk ? s.atkC / s.atk : 0, 'combat damage dealt per own turn': first ? s.hit / first : 0, 'creatures lost': s.lost, 'turns as the table\'s target': s.arch,
            'own turns played': first }, died: lastTurn ? lastTurn.turn : null, hit: s.hit, first }); }));
const feats = Object.keys(rows[0].f), table = [];
feats.forEach(k => { const w = rows.filter(r => r.win && r.f[k] != null).map(r => r.f[k]), l = rows.filter(r => !r.win && r.f[k] != null).map(r => r.f[k]); if (w.length < 5 || l.length < 5) return; const all = rows.filter(r => r.f[k] != null).map(r => r.f[k]), s0 = sd(all) || 1; table.push({ k, w: mean(w), l: mean(l), d: (mean(w) - mean(l)) / s0 }); });
table.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log('\nWhat separates winners from the others (d = difference in standard deviations; about 0.2 small, 0.5 medium):');
table.forEach(t => console.log(`  ${t.k.padEnd(34)} winners ${f2(t.w).padStart(7)}   others ${f2(t.l).padStart(7)}   d ${t.d >= 0 ? '+' : ''}${f2(t.d)}`));
out.separators = table;

// 3. Ramp curve: mana at each own turn, winners vs others
console.log('\nMana available at the start of combat on each own turn (winners / others):');
const curve = []; for (let k = 0; k < 12; k++) { const w = rows.filter(r => r.win && r.first > k).map(r => r.f && 0), ww = [], ll = []; done.forEach(g => g.stats.seats.forEach((s, i) => { if (s.tl[k]) (g.winner === i ? ww : ll).push(s.tl[k][2]); })); if (ww.length > 3) curve.push(`T${k + 1} ${f1(mean(ww))}/${f1(mean(ll))}`); }
console.log('  ' + curve.join('   ')); out.curve = curve;

// 4. Style behaviour
console.log('\nPer playstyle: attacks per own turn / creatures per attack / combat damage per own turn / creatures lost / turns survived');
const st = {}; rows.forEach(r => { const o = st[r.style] = st[r.style] || { a: [], c: [], h: [], l: [], t: [], g: 0 }; o.a.push(r.f['attacks per own turn']); o.c.push(r.f['creatures per attack']); o.h.push(r.f['combat damage dealt per own turn']); o.l.push(r.f['creatures lost']); o.t.push(r.first); o.g++; });
Object.entries(st).forEach(([k, o]) => console.log(`  ${k.padEnd(13)} ${f2(mean(o.a))} / ${f1(mean(o.c))} / ${f1(mean(o.h))} / ${f1(mean(o.l))} / ${f1(mean(o.t))}   (${o.g} seats)`));

const ab = {}; rows.forEach((r, k) => { });
done.forEach(g => g.stats.seats.forEach((x, i) => { const k = (g.styles || [])[i] || '-', o = ab[k] = ab[k] || { turns: 0, able: 0, atk: 0, sum: 0, atkC: 0 }; o.turns += x.tl.length; o.able += x.able || 0; o.atk += x.atk; o.sum += x.ableSum || 0; o.atkC += x.atkC; }));
console.log('\nWhen a creature could attack: share of own turns with an able attacker / share of those turns that had an attack / able creatures sent (%)');
Object.entries(ab).forEach(([k, o]) => console.log(`  ${k.padEnd(13)} ${pct(o.able, o.turns)} / ${pct(o.atk, o.able)} / ${pct(o.atkC, o.sum)}`));

// 5. Eliminations
const firstOut = done.map(g => g.stats.elim[0]).filter(Boolean), outBy = {};
done.forEach(g => g.stats.elim.forEach(e => { const s = (g.styles || [])[e.seat] || '-'; (outBy[s] = outBy[s] || []).push(e.turn); }));
console.log(`\nFirst player out: median turn ${med(firstOut.map(e => e.turn))} (of ${med(done.map(g => g.turns || g.turn))} turns in the game). Median turn each style is knocked out: ` + Object.entries(outBy).map(([k, a]) => `${k} ${med(a)} (${a.length})`).join(', '));
console.log(`Split attacks (creatures sent at different players in one attack): ${f2(mean(done.map(g => g.stats.splits)))} per game. Endings: ` + JSON.stringify(done.reduce((a, g) => { const k = /commander damage/.test(g.reason) ? 'commander damage' : /life/.test(g.reason) ? 'life total' : /library|draw/.test(g.reason) ? 'empty library' : /poison/.test(g.reason) ? 'poison' : 'other'; a[k] = (a[k] || 0) + 1; return a; }, {})));
const long = done.filter(g => (g.turns || g.turn) > 80).length;
console.log(`Long games: ${long} over 80 turns (${pct(long, done.length)}), ${stalled.length} stalled out.`);

// 6. Commanders
const cm = {}; rows.forEach(r => { if (!r.cmd) return; const o = cm[r.cmd] = cm[r.cmd] || { g: 0, w: 0 }; o.g++; o.w += r.win; });
const cr = Object.entries(cm).filter(([, o]) => o.g >= 6).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g);
if (cr.length >= 10) console.log(`\nCommanders with 6+ games (noisy): best ${cr.slice(0, 5).map(([k, o]) => `${k} ${pct(o.w, o.g)} (${o.g})`).join(', ')}; worst ${cr.slice(-5).map(([k, o]) => `${k} ${pct(o.w, o.g)} (${o.g})`).join(', ')}`);
fs.writeFileSync(path.join(path.dirname(file), 'lab-report.json'), JSON.stringify(out, null, 1));
