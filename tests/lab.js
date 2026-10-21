// Test lab: play hundreds or thousands of AI-vs-AI games with NO network (no Scryfall, MTGJSON or EDHREC).
// Every card comes from tests/data/cards_all.json, decks are random but fully Automated, each game has a seed so it can be replayed.
// Usage: node tests/lab.js [--n 500] [--kind commander|modern|mix] [--seed 1] [--conc 4] [--la normal] [--lb normal] [--show-bad]
//   Compare two AI versions: GAME_ROOT=/path/to/older/worktree node tests/lab.js --n 500   (same seeds, same decks)
//   Replay one game with the full log: node tests/lab.js --replay 123 --kind commander
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, ROOT } = require('./lib/harness');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const CHUNK = Number(arg('chunk', 4));
const N = Number(arg('n', 200)), KIND = arg('kind', 'mix'), SEED = Number(arg('seed', 1)), CONC = arg('conc', 3) === 'auto' ? Math.min(require('os').cpus().length, 6) : Number(arg('conc', 3));
const LEVELS = arg('levels', null), MAXTURNS = Number(arg('maxturns', 150)), STATS = arg('stats', 'on') !== 'off', SWEEP = arg('sweep', null), PATCH = arg('patch', null), OUTFILE = arg('out', null), TUNE = arg('tune', null), DECKS = arg('decks', null);
const LA = arg('la', 'normal'), LB = arg('lb', 'normal'), TMO = Number(arg('timeout', 15000)), PLAYERS = Number(arg('players', 2)), STYLES = arg('styles', null), THEMES = arg('themes', null), WATCH = arg('watch', null), DECKA = arg('decka', null) ? require('fs').readFileSync(arg('decka', null), 'utf8') : null, REPLAY = arg('replay', null);

async function openLab(h) {
    await h.ctx.addInitScript(() => { window.__LAB = true; });
    if (process.env.LAB_PAIR) await h.ctx.addInitScript(p => { window.__PAIR = p; }, process.env.LAB_PAIR); // ascent: 'W,t1-mick' = the W starter deck against that opponent
    await h.ctx.route(/api\.scryfall\.com|mtgjson\.com|edhrec\.com|data\.scryfall\.io/, route => route.abort());
    const cardsFile = path.join(ROOT, 'tests', 'data', 'cards_all.json');
    if (!fs.existsSync(cardsFile)) throw new Error('tests/data/cards_all.json is missing: run python3 tests/fetch_cards.py once (needs Scryfall)');
    await h.ctx.route('http://spellslinger.test/__lab/cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(cardsFile) }));
    const page = await h.ctx.newPage();
    const errors = [];
    if (process.env.LAB_TRACE) page.on('console', m => { if (/^LABSEED/.test(m.text())) require('fs').appendFileSync(process.env.LAB_TRACE, m.text() + '\n'); }); // the last seed started shows which game hung a page
    page.on('pageerror', e => errors.push(String(e.stack || e.message || e).split('\n').slice(0, 4).join(' | ')));
    await page.goto(`${h.server.url}/Spellslinger_Duels.html?autoplay&format=none`);
    await page.waitForFunction(() => typeof autoTest === 'function' && typeof parseTrigger === 'function' && typeof preconEffect === 'function', null, { timeout: 30000 });
    await page.addScriptTag({ path: path.join(__dirname, 'lib', 'lab-page.js') });
    // the invariant check the other suites use
    await page.evaluate(() => { window.T = { invariants() {
        const bad = [], seen = new Set();
        G.players.forEach(P => ['hand', 'bf', 'gy', 'exile', 'library', 'command'].forEach(z => (P[z] || []).forEach(x => { if (seen.has(x.uid)) bad.push('duplicate ' + x.card.name); seen.add(x.uid); })));
        G.players.forEach(P => { if (isNaN(P.life)) bad.push('NaN life ' + P.name); });
        allPerms().filter(isCreature).forEach(x => { if (isNaN(pow(x)) || isNaN(tou(x))) bad.push('NaN P/T ' + x.card.name); });
        return bad;
    } }; });
    const info = await page.evaluate(async () => { const raw = await (await fetch('/__lab/cards.json')).json(); const names = (await (await fetch('/tests/baseline_full_cards.txt')).text()).split('\n').map(x => x.trim()).filter(Boolean); return LAB.load(raw, names); });
    return { page, errors, info };
}

// --profile: a CPU profile of the first page's games; prints where the time goes (self time per function, and per game file)
const PROFILE = !!arg('profile', false);
function profileTop(profile) {
    const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
    const dt = profile.timeDeltas; let total = 0;
    profile.samples.forEach((id, i) => { const d = dt[i] || 0; total += d; self.set(id, (self.get(id) || 0) + d); });
    const byFn = {}, byFile = {};
    for (const [id, t] of self) { const n = byId.get(id), f = n.callFrame, k = `${f.functionName || '(anonymous)'} ${(f.url || '').split('/').pop()}:${f.lineNumber + 1}`; byFn[k] = (byFn[k] || 0) + t; const fk = (f.url || '(native)').split('/').pop() || '(native)'; byFile[fk] = (byFile[fk] || 0) + t; }
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, t]) => `  ${(100 * t / total).toFixed(1).padStart(5)}%  ${k}`).join('\n');
    fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tests', '.out', 'lab.cpuprofile'), JSON.stringify(profile));
    console.log(`\nWhere the time goes (page 1, ${(total / 1e6).toFixed(1)}s sampled):\nBy function:\n${top(byFn)}\nBy file:\n${top(byFile)}\n(full profile: tests/.out/lab.cpuprofile, open in Chrome DevTools)`);
}

async function main() {
    const h = await launch({ profileDir: path.join(ROOT, 'tests', '.cache', 'lab' + (process.env.TEST_PROFILE || '')) });
    const t0 = Date.now();
    if (REPLAY) {
        const { page, info, errors } = await openLab(h);
        if (process.env.LAB_PAUSE) { // a game that never returns (a synchronous loop): pause the page after N ms and print where it is
            const cdp = await h.ctx.newCDPSession(page);
            await cdp.send('Debugger.enable');
            const paused = new Promise(res => cdp.on('Debugger.paused', res));
            page.evaluate(([s, k, la, lb, tmo, pl, st, th, da, wa, lv, tu, dk]) => LAB.play({ seed: s, kind: k, la, lb, timeout: tmo, players: pl, styles: st, themes: th, deckA: da, watch: wa, levels: lv, tune: tu, decks: dk, maxTurns: 150 }), [Number(REPLAY), KIND, LA, LB, TMO, PLAYERS, STYLES, THEMES, DECKA, WATCH, LEVELS || null, TUNE, DECKS]).catch(() => {});
            await new Promise(r => setTimeout(r, Number(process.env.LAB_PAUSE)));
            await cdp.send('Debugger.pause');
            const ev = await paused;
            console.log(ev.callFrames.slice(0, 14).map(f => `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.location.lineNumber + 1}`).join('\n'));
            const info2 = await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: ev.callFrames[0].callFrameId, expression: process.env.LAB_EXPR || "G.players.map(p => p.bf.length + 'bf/' + p.gy.length + 'gy').join(' ') + ' T' + G.turn + ' :: ' + G.log.slice(-12).map(l => l.text || l).join(' | ')" }).catch(e => ({ result: { value: String(e) } }));
            console.log(info2.result.value);
            await h.close(); return;
        }
        const r = await page.evaluate(([s, k, la, lb, tmo, pl, st, th, da, wa, lv, tu, dk]) => LAB.play({ seed: s, kind: k, la, lb, timeout: tmo, players: pl, styles: st, themes: th, deckA: da, watch: wa, levels: lv, tune: tu, decks: dk, maxTurns: 150 }), [Number(REPLAY), KIND, LA, LB, TMO, PLAYERS, STYLES, THEMES, DECKA, WATCH, LEVELS || null, TUNE, DECKS]);
        console.log(JSON.stringify(r, null, 1));
        if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
        { const full = await page.evaluate(() => G.log.map(l => l.text || l).join('\n')); console.log(process.env.LAB_HEAD ? full.slice(0, Number(process.env.LAB_HEAD)) : full.slice(-6000)); } // LAB_HEAD=N prints the first N characters of the log instead of the last 6000
        await h.close(); return;
    }
    console.log(`Lab: ${N} games, kind ${KIND}, seeds ${SEED}..${SEED + N - 1}, ${CONC} pages, AI A=${LA} B=${LB}${LEVELS ? ', levels ' + LEVELS : ''}`);
    // Pages load in parallel and stay open; games come off one shared queue, so a fast page never waits for a slow one
    const pages = await Promise.all(Array.from({ length: CONC }, () => openLab(h)));
    console.log(`Loaded ${pages[0].info.cards} cards offline (${pages[0].info.automated} fully Automated) in ${pages[0].info.ms} ms`);
    const OPTS = { kind: KIND, la: LA, lb: LB, timeout: TMO, players: PLAYERS, styles: STYLES, themes: THEMES, deckA: DECKA, watch: WATCH, levels: LEVELS || null, tune: TUNE, decks: DECKS, maxTurns: MAXTURNS, stats: STATS };
    const pageErrors = () => pages.flatMap(p => p.errors);
    let cdp = null;
    if (PROFILE) { cdp = await h.ctx.newCDPSession(pages[0].page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    const runSet = async (patch, label) => {
        if (patch) await Promise.all(pages.map(p => p.page.evaluate(patch)));
        const all = []; let next = 0; const t1 = Date.now();
        await Promise.all(pages.map(async p => {
            while (next < N) {
                const from = SEED + next, n = Math.min(CHUNK, N - next); next += n;
                const rs = await p.page.evaluate(([f, c, o]) => LAB.batch(f, c, o), [from, n, OPTS]);
                all.push(...rs);
                process.stdout.write(`\r${label ? label + ': ' : ''}${all.length}/${N} games, ${((Date.now() - t1) / 1000).toFixed(0)}s   `);
            }
        }));
        console.log('');
        return all.sort((x, y) => x.seed - y.seed);
    };
    if (PATCH) { await Promise.all(pages.map(p => p.page.evaluate(PATCH))); console.log('Patched: ' + PATCH); }
    let all;
    if (SWEEP) {
        // --sweep "PLAYSTYLES.aggro.atk=0.3,0.6,0.9": the same seeds and decks for every value, one row per value (a paired comparison)
        const eq = SWEEP.indexOf('='), lhs = SWEEP.slice(0, eq), vals = SWEEP.slice(eq + 1).split(',');
        const seatTune = lhs.startsWith('tune.'); // --sweep "tune.holdShare=1,0.5": only seat A uses the value (the others keep the default)
        const orig = seatTune ? null : await pages[0].page.evaluate(l => JSON.stringify(eval(l)), lhs);
        const focus = (lhs.match(/PLAYSTYLES\.(\w+)/) || [])[1] || null;
        const rows = [];
        for (const v of vals) {
            if (seatTune) OPTS.tune = `${lhs.slice(5)}=${v}`;
            const rs = await runSet(seatTune ? null : `${lhs} = ${v}`, v);
            const done = rs.filter(r => r.winner !== undefined && !r.hang && !r.error);
            const tally = {}; done.forEach(r => (r.styles || []).forEach((st, i) => { if (!st) return; const t = tally[st] = tally[st] || { g: 0, w: 0 }; t.g++; if (r.winner === i) t.w++; }));
            const turns = done.map(r => r.turns || r.turn).sort((a, b) => a - b);
            rows.push({ v, done: done.length, seatA: done.filter(r => r.winner === 0).length, tally, med: turns[turns.length >> 1], hung: rs.filter(r => r.hang || r.error).length, stalled: rs.filter(r => r.stalled).length });
            all = rs;
        }
        if (!seatTune) await Promise.all(pages.map(p => p.page.evaluate(([l, o]) => { eval(l + ' = ' + o); }, [lhs, orig])));
        console.log(`\nSweep of ${lhs} (${N} games per value, same seeds; fair share ${(100 / PLAYERS).toFixed(0)}%):`);
        rows.forEach(r => { const t = focus && r.tally[focus]; const p = t ? t.w / t.g : null; console.log(`  ${String(r.v).padEnd(8)} seat A ${(100 * r.seatA / r.done).toFixed(1)}% ± ${(196 * Math.sqrt((r.seatA / r.done) * (1 - r.seatA / r.done) / r.done)).toFixed(1)} (${r.seatA}/${r.done}) ${focus ? `${focus} wins ${p === null ? '-' : (100 * p).toFixed(1) + '% ± ' + (196 * Math.sqrt(p * (1 - p) / t.g)).toFixed(1)} (${t ? t.w + '/' + t.g : 0})` : ''}  median ${r.med} turns, hung ${r.hung}, stalled ${r.stalled}   all: ${Object.entries(r.tally).sort((a, b) => b[1].w / b[1].g - a[1].w / a[1].g).map(([k, t]) => `${k} ${(100 * t.w / t.g).toFixed(0)}%`).join(' ')}`); });
    } else all = await runSet(null, '');
    if (cdp) { const { profile } = await cdp.send('Profiler.stop'); profileTop(profile); }
    report(all, pageErrors(), (Date.now() - t0) / 1000);
    await h.close();
}

function report(all, pageErrors, secs) {
    const done = all.filter(r => r.winner !== undefined && !r.hang && !r.error);
    const hung = all.filter(r => r.hang), err = all.filter(r => r.error), bad = all.filter(r => r.bad && r.bad.length), logged = all.filter(r => r.errors);
    const w0 = done.filter(r => r.winner === 0).length, w1 = done.filter(r => r.winner === 1).length, draws = done.filter(r => r.winner === null).length;
    const turns = done.map(r => r.turn || r.turns).sort((a, b) => a - b);
    const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;
    console.log(`\n${all.length} games in ${secs.toFixed(0)}s (${(all.length / secs).toFixed(1)}/s), avg ${avg(all.map(r => r.ms)).toFixed(0)} ms each`);
    const bySeat = [0, 1, 2, 3].map(i => done.filter(r => r.winner === i).length);
    if (PLAYERS > 2) console.log(`Finished ${done.length} pods: wins by seat ${bySeat.slice(0, PLAYERS).map((n, i) => `${'ABCD'[i]} ${n} (${(100 * n / Math.max(1, done.length)).toFixed(1)}%)`).join(', ')}, draws ${draws}`);
    else console.log(`Finished ${done.length}: seat A won ${w0} (${(100 * w0 / Math.max(1, done.length)).toFixed(1)}%), seat B won ${w1}, draws ${draws}`);
    console.log(`Turns: median ${turns[turns.length >> 1]}, p90 ${turns[Math.floor(turns.length * 0.9)]}, max ${turns[turns.length - 1]}`);
    if (done.some(r => r.themes && r.themes.length)) {
        // Wins per theme (deck themes or the text-based political decks): fair share is 1 / players
        const tally = {};
        done.forEach(r => (r.themes || []).forEach((k, i) => { const t = tally[k] = tally[k] || { games: 0, wins: 0 }; t.games++; if (r.winner === i) t.wins++; }));
        console.log('Wins by theme (fair share ' + (100 / PLAYERS).toFixed(0) + '%): ' + Object.entries(tally).sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games).map(([s, t]) => `${s} ${(100 * t.wins / t.games).toFixed(0)}% (${t.wins}/${t.games})`).join(', '));
    }
    if (done.some(r => r.styles && r.styles[0])) {
        // Wins per playstyle: a style appears in a game when a seat plays it; the fair share is 1 / players
        const tally = {};
        done.forEach(r => r.styles.forEach((s, i) => { const t = tally[s] = tally[s] || { games: 0, wins: 0 }; t.games++; if (r.winner === i) t.wins++; }));
        console.log('Wins by playstyle (fair share ' + (100 / PLAYERS).toFixed(0) + '%): ' + Object.entries(tally).sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games).map(([s, t]) => `${s} ${(100 * t.wins / t.games).toFixed(0)}% (${t.wins}/${t.games})`).join(', '));
    }
    const dl = done.filter(r => r.deals); if (dl.length) { const t = dl.reduce((a, r) => ({ made: a.made + r.deals.made, kept: a.kept + r.deals.kept, broken: a.broken + r.deals.broken, declined: a.declined + r.deals.declined }), { made: 0, kept: 0, broken: 0, declined: 0 }); console.log(`Deals per game: ${(t.made / done.length).toFixed(2)} made, ${(t.kept / done.length).toFixed(2)} kept, ${(t.broken / done.length).toFixed(2)} broken, ${(t.declined / done.length).toFixed(2)} declined`); }
    { const by = {}, br = {}; done.forEach(r => { Object.entries((r.deals && r.deals.by) || {}).forEach(([k, v]) => { by[k] = (by[k] || 0) + v; }); Object.entries((r.deals && r.deals.brokenBy) || {}).forEach(([k, v]) => { br[k] = (br[k] || 0) + v; }); }); if (Object.keys(by).length) console.log(`Deals by type (made / broken): ${Object.keys(by).map(k => `${k} ${by[k]}/${br[k] || 0}`).join(', ')}`); }
    { const pp = done.filter(r => r.pol); if (pp.length) { const m = k => (pp.reduce((a, r) => a + (r.pol[k] || 0), 0) / pp.length).toFixed(1); console.log(`Table talk per game: ${m('talk')} lines, ${m('salt')} salt events, ${m('cool')} cool plays, ${m('arch')} archenemy changes`); } }
    const reasons = {};
    done.forEach(r => { const k = /commander damage/.test(r.reason) ? 'commander damage' : /life/.test(r.reason) ? 'life total' : /library|draw/.test(r.reason) ? 'empty library' : /poison/.test(r.reason) ? 'poison' : String(r.reason).replace(/\d+/g, 'N').slice(0, 40); reasons[k] = (reasons[k] || 0) + 1; });
    console.log('Endings:', JSON.stringify(reasons));
    { const w = all.filter(r => r.watch); if (w.length) console.log(`WATCH: ${w.length} game(s) where the watched trigger fired more often than the card entered: seeds ${w.slice(0, 12).map(r => r.seed + ' ' + JSON.stringify(r.watch)).join('; ')}`); }
    console.log(`Hung (no result in time): ${hung.length}   Threw: ${err.length}   Broken invariants: ${bad.length}   Page errors during games: ${logged.length}   Page errors total: ${pageErrors.length}`);
    [...hung, ...err, ...bad, ...logged].slice(0, 12).forEach(r => console.log(`  seed ${r.seed} ${r.kind}: ${r.hang ? 'HUNG turn ' + r.turn + ' ' + r.phase : r.error || JSON.stringify(r.bad || r.errors)}  (${r.a} vs ${r.b})`));
    const uniq = {}; pageErrors.forEach(e => { const k = e; uniq[k] = (uniq[k] || 0) + 1; });
    Object.entries(uniq).forEach(([k, n]) => console.log(`  page error x${n}: ${k.slice(0, 400)}`));
    const slow = all.slice().sort((a, b) => b.ms - a.ms).slice(0, 3);
    console.log('Slowest:', slow.map(r => `seed ${r.seed} ${r.ms}ms`).join(', '));
    const cmp = arg('compare', null);
    if (cmp && cmp !== true) {
        // Same seeds, same decks: a refactor that should not change play must give the same winner, length and ending for every seed
        const base = JSON.parse(fs.readFileSync(cmp, 'utf8')), bySeed = Object.fromEntries(base.map(r => [r.seed, r]));
        const diff = all.filter(r => bySeed[r.seed] && (bySeed[r.seed].winner !== r.winner || bySeed[r.seed].turns !== r.turns || bySeed[r.seed].reason !== r.reason));
        console.log(`Compared with ${cmp}: ${all.filter(r => bySeed[r.seed]).length} seeds in both, ${diff.length} differ`);
        diff.slice(0, 8).forEach(r => console.log(`  seed ${r.seed}: was ${bySeed[r.seed].winner}/${bySeed[r.seed].turns} now ${r.winner}/${r.turns}`));
        if (diff.length) process.exitCode = 1;
    }
    fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tests', '.out', 'lab.json'), JSON.stringify(all));
    fs.writeFileSync(OUTFILE && OUTFILE !== true ? OUTFILE : path.join(ROOT, 'tests', '.out', 'lab.jsonl'), all.map(r => JSON.stringify(r)).join('\n') + '\n'); // one game per line, with the per-seat stats (tests/lab_report.js reads it)
    process.exitCode = hung.length || err.length || bad.length || logged.length ? 1 : 0;
}
main().catch(e => { console.error(e); process.exit(2); });
