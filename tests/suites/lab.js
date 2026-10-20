// Runs the offline test lab as part of the normal run: 300 two-player games that must come out exactly as in tests/baseline_lab2p.json
// (same seeds, same decks, same winners and lengths: any change in play shows up here), and 40 four-player pods that must all finish.
// A change that is meant to alter how games play: run `node tests/lab.js --n 1500 --seed 1` and copy the new results into baseline_lab2p.json.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const lab = path.join(__dirname, '..', 'lab.js');
const run = args => { const r = spawnSync('node', [lab, ...args], { encoding: 'utf8', timeout: 900000 }); process.stdout.write(r.stdout.split('\n').filter(l => !/^\d+\/\d+ games/.test(l)).slice(-14).join('\n') + '\n'); return r.status === 0; };
let ok = true;
console.log('== 300 two-player games against the baseline');
const a = run(['--n', '300', '--conc', '3', '--kind', 'mix', '--seed', '1', '--compare', path.join(__dirname, '..', 'baseline_lab2p.json')]);
console.log(`${a ? 'PASS' : 'FAIL'} two-player games match the baseline and none hang`);
console.log('== 40 four-player pods');
const b = run(['--n', '40', '--conc', '3', '--kind', 'commander', '--players', '4', '--seed', '1', '--timeout', '30000']);
console.log(`${b ? 'PASS' : 'FAIL'} four-player pods all finish with no errors`);
console.log('== 12 pods with a random-baseline table, then the report');
const c = run(['--n', '12', '--conc', '3', '--kind', 'commander', '--players', '4', '--seed', '1', '--levels', 'normal,random,random,random', '--timeout', '30000']);
const rep = spawnSync('node', [path.join(__dirname, '..', 'lab_report.js')], { encoding: 'utf8' });
const reportOk = rep.status === 0 && /Wins by AI level: .*random/.test(rep.stdout) && /What separates winners/.test(rep.stdout);
console.log(`${c && reportOk ? 'PASS' : 'FAIL'} random-level seats play, and the report reads the games`);
ok = a && b && c && reportOk;
console.log(`lab: ${(a ? 1 : 0) + (b ? 1 : 0) + (c && reportOk ? 1 : 0)}/3 passed`);
process.exit(ok ? 0 : 1);
