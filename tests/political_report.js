// Scores themed 4-player pods for "fun politics" and aggregates by theme, commander and pairing.
// Usage: node tests/lab.js --players 4 --kind commander --themes random --n 800 ; node tests/political_report.js [tests/.out/lab.json]
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync(process.argv[2] || 'tests/.out/lab.json', 'utf8')).filter(r => r && r.winner != null && r.pol);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function fun(r) {
  const d = r.deals || { made: 0, broken: 0 }, p = r.pol, parts = {};
  parts.deals = Math.min(d.made, 8) * 1;
  parts.betrayal = Math.min(d.broken, 4) * 3;
  parts.archenemy = Math.min(p.arch, 5) * 2;
  parts.talk = Math.min(p.talk, 60) / 6;
  const w = r.winner, last = p.worst && p.worst[w] != null; // winner was ranked last by threat after turn 12
  parts.comeback = last ? 6 : 0;
  const t = r.turns; // total turns (all seats)
  parts.length = t >= 40 && t <= 70 ? 6 : t >= 32 && t <= 90 ? 2 : -4;
  const early = (p.outAt || []).filter(x => x < 16).length;
  parts.early = -4 * early;
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}
rows.forEach(r => Object.assign(r, { f: fun(r) }));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const group = (key) => { const m = {}; rows.forEach(r => key(r).forEach(k => (m[k] = m[k] || []).push(r))); return m; };
const fmt = (n) => n.toFixed(1);
console.log(`Pods: ${rows.length}   mean fun ${fmt(avg(rows.map(r => r.f.total)))}`);
console.log('\nBy theme (mean fun, win rate per seat of that theme):');
const byTheme = group(r => r.themes);
Object.entries(byTheme).map(([k, v]) => {
  let seats = 0, wins = 0; v.forEach(r => r.themes.forEach((t, i) => { if (t === k) { seats++; if (r.winner === i) wins++; } }));
  return [k, avg(v.map(r => r.f.total)), wins / seats, v.length];
}).sort((a, b) => b[1] - a[1]).forEach(([k, f, w, n]) => console.log(`  ${k.padEnd(9)} fun ${fmt(f)}  wins ${(w * 100).toFixed(0)}%  (${n} pods)`));
console.log('\nBy commander (>=12 appearances) mean fun of pods they are in, and their win rate:');
const byCmd = group(r => r.cmds);
Object.entries(byCmd).filter(([, v]) => v.length >= 12).map(([k, v]) => {
  let seats = 0, wins = 0; v.forEach(r => r.cmds.forEach((c, i) => { if (c === k) { seats++; if (r.winner === i) wins++; } }));
  return [k, avg(v.map(r => r.f.total)), wins / seats, v.length, v[0].themes[v[0].cmds.indexOf(k)]];
}).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, f, w, n, t]) => console.log(`  ${k.padEnd(36)} [${t}] fun ${fmt(f)} wins ${(w * 100).toFixed(0)}% (${n})`));
console.log('\nBy theme set at the table (sorted theme combo):');
const byCombo = group(r => [r.themes.slice().sort().join('+')]);
Object.entries(byCombo).filter(([, v]) => v.length >= 8).map(([k, v]) => [k, avg(v.map(r => r.f.total)), v.length])
  .sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, f, n]) => console.log(`  ${k.padEnd(42)} fun ${fmt(f)} (${n})`));
console.log('\nMean score parts, top 10% vs all:');
const sorted = rows.slice().sort((a, b) => b.f.total - a.f.total), top = sorted.slice(0, Math.ceil(rows.length / 10));
Object.keys(rows[0].f.parts).forEach(k => console.log(`  ${k.padEnd(10)} top ${fmt(avg(top.map(r => r.f.parts[k])))}  all ${fmt(avg(rows.map(r => r.f.parts[k])))}`));
console.log('\nFunniest 5 pods (seed, themes, commanders, winner, turns, deals, broken, archenemy changes):');
sorted.slice(0, 5).forEach(r => console.log(`  seed ${r.seed} fun ${fmt(r.f.total)} ${r.themes.join('/')} :: ${r.cmds.join(' | ')} :: winner ${r.cmds[r.winner]} T${r.turns} deals ${r.deals.made} broken ${r.deals.broken} arch ${r.pol.arch}`));
