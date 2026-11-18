// Playbook mining (2026-11-19, owner: "learn from how I, a human, play the game to give the bots better strategic value ... do 1 and 2").
// Reads game records exported from Spellslinger Duels (📋 Game records -> Export all games: .jsonl or .jsonl.gz) and works from each game's play-by-play log,
// so old records without decision data count too.
//   1. A PLAYBOOK for every deck the person played: record, how fast the lands come, what gets cast on each of the first turns in the games won, which cards
//      show up more in wins than losses, the abilities used, how the games were finished, and a plan skeleton (`DECK_PLANS` style) to review by hand.
//   2. HUMAN vs COMPUTER on the same commander: when a bot played the same commander in another seat, the same numbers side by side (when the first attack
//      comes, how many creatures go, damage per turn, spells per turn), plus a suggestion for the computer's attack habits where they differ.
// Usage: node tests/playbook.js <file-or-folder> [more...] [--md docs/playbooks]    (writes one markdown file per deck when --md is given, always tests/.out/playbook.json)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const args = process.argv.slice(2); let mdDir = null;
const mi = args.indexOf('--md'); if (mi >= 0) { mdDir = args[mi + 1]; args.splice(mi, 2); }
let botFiles = []; for (let bi = args.indexOf('--bots'); bi >= 0; bi = args.indexOf('--bots')) { botFiles.push(args[bi + 1]); args.splice(bi, 2); } // lab records (LAB_RECORD=1 node tests/lab.js ...): the computer's baseline for a deck
function readAll(list) {
    const files = [];
    const add = p => { if (!fs.existsSync(p)) { console.error('Not found: ' + p); return; } const st = fs.statSync(p); if (st.isDirectory()) fs.readdirSync(p).sort().forEach(f => /\.jsonl(\.gz)?$/.test(f) && files.push(path.join(p, f))); else files.push(p); };
    list.forEach(add);
    const games = [], seen = new Set();
    for (const f of files) {
        let text = fs.readFileSync(f); if (/\.gz$/.test(f)) text = zlib.gunzipSync(text);
        for (const line of text.toString('utf8').split('\n')) { if (!line.trim()) continue; try { const g = JSON.parse(line); const k = g.id || g.date; if (seen.has(k)) continue; seen.add(k); games.push(g); } catch (e) { /* skip */ } }
    }
    return games;
}
const games = readAll(args);
const botGames = readAll(botFiles);
if (!games.length) { console.log('No games found. Usage: node tests/playbook.js <export.jsonl> [--md docs/playbooks]'); process.exit(0); }

// ---------- reading one game's log ----------
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function parseGame(g) {
    const log = g.log || [];
    const names = g.players.map(p => p.human ? 'You' : (p.commander || p.name));
    const turnRe = /^— Turn (\d+): (.+?)'?s? ?turn —$/;
    const own = {}; names.forEach((n, i) => { own[i] = { n: 0, turns: [] }; });
    const actorOf = line => { for (let i = 0; i < names.length; i++) { const n = names[i]; if (line.startsWith(n + ' ')) return i; } return -1; };
    // every card name seen in a cast / play / enter line, so an attack list like "Doc Samson, Super Psychiatrist, Goliath" can be split
    const known = new Set(g.players.map(p => p.commander).filter(Boolean));
    log.forEach(l => { let m; if ((m = /^(?:.+?) (?:casts?|plays?) (.+?)(?: targeting .*| \(.*\)| without paying.*)?\.$/.exec(l))) known.add(m[1]); if ((m = /^(.+?) enters the battlefield/.exec(l))) known.add(m[1]); });
    const knownList = [...known].sort((a, b) => b.length - a.length);
    const splitList = s => { const out = []; let rest = s.trim(); while (rest) { const k = knownList.find(n => rest === n || rest.startsWith(n + ', ') || rest.startsWith(n + ' and ')); if (k) { out.push(k); rest = rest.slice(k.length).replace(/^(?:, | and )/, ''); } else { const m = /^(.+?)(?:, | and |$)/.exec(rest); out.push(m[1]); rest = rest.slice(m[0].length); } } return out; };
    const turns = []; let cur = null, actor = -1;
    for (const l of log) {
        const t = turnRe.exec(l);
        if (t) {
            const who = /^your$/.test(t[2]) ? names.indexOf('You') : names.findIndex(n => t[2].startsWith(n));
            actor = who; cur = { n: +t[1], who, lands: [], casts: [], acts: [], attacks: [], dmg: {}, abilities: [] }; turns.push(cur);
            if (who >= 0) { own[who].n++; cur.k = own[who].n; own[who].turns.push(cur); }
            continue;
        }
        if (!cur) continue;
        const who = actorOf(l); let m;
        if (who === cur.who) {
            const rest = l.slice(names[who].length + 1);
            if ((m = /^plays? (.+?)(?: \(tapped\))?\.$/.exec(rest))) cur.lands.push(m[1]);
            else if ((m = /^casts? (.+?)(?: targeting .*| \((?:kicked|X=\d+|commander tax \d+)[^)]*\)| without paying.*)?\.$/.exec(rest))) cur.casts.push(m[1]);
            else if ((m = /^activates? (.+?): /.exec(rest))) cur.abilities.push(m[1]);
            else if ((m = /^attacks? with (.+)\.$/.exec(rest))) cur.attacks.push(splitList(m[1]));
        }
        if ((m = /^(.+?) takes? (\d+) combat damage\.$/.exec(l))) { const v = names.findIndex(n => m[1] === n || (n === 'You' && m[1] === 'You')); if (v >= 0 && v !== cur.who) cur.dmg[v] = (cur.dmg[v] || 0) + +m[2]; }
    }
    return { g, names, turns, own };
}

// the same numbers from a record's decision events (lab games and newer records have them): used for the computer baseline
function evMetrics(g, seat) {
    const ev = g.ev || []; const turnsOf = ev.filter(e => e.e === 'turn' && e.s === seat); if (!turnsOf.length) return null;
    const kOf = {}; turnsOf.forEach((e, i) => { kOf[e.t] = i + 1; });
    const mine = ev.filter(e => e.e === 'dec' && e.s === seat);
    const atk = mine.filter(e => e.k === 'attack' && e.atk && e.atk.length), lands = mine.filter(e => e.k === 'land'), casts = mine.filter(e => e.k === 'cast'), abil = mine.filter(e => e.k === 'ability');
    const n = turnsOf.length, late = turnsOf.filter((e, i) => i + 1 > 4).length;
    const atkTurns = new Set(atk.map(e => kOf[e.t])); const firstK = atk.length ? Math.min(...atk.map(e => kOf[e.t] || 99)) : null;
    return {
        turns: n, landsBy: k => lands.filter(e => (kOf[e.t] || 99) <= k).length, castsPerTurn: casts.length / n,
        firstAttack: firstK === 99 ? null : firstK, attackRate: late ? [...atkTurns].filter(k => k > 4).length / late : 0,
        perAttack: atk.length ? atk.reduce((a, e) => a + e.atk.length, 0) / atk.length : 0, dmgPerTurn: 0, abilitiesPerTurn: abil.length / n,
    };
}
const parsed = games.map(parseGame);

// ---------- per player numbers ----------
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const r1 = x => Math.round(x * 10) / 10;
function metricsFor(pg, seat) {
    const ts = pg.own[seat].turns; if (!ts.length) return null;
    const firstAtk = ts.find(t => t.attacks.length); const atkTurns = ts.filter(t => t.attacks.length);
    const dmgOf = t => Object.values(t.dmg).reduce((a, b) => a + b, 0);
    return {
        turns: ts.length,
        landsBy: k => ts.slice(0, k).reduce((n, t) => n + t.lands.length, 0),
        castsPerTurn: avg(ts.map(t => t.casts.length)),
        firstAttack: firstAtk ? firstAtk.k : null,
        attackRate: ts.length > 4 ? atkTurns.filter(t => t.k > 4).length / ts.filter(t => t.k > 4).length : 0, // share of turns after turn 4 with an attack
        perAttack: avg(atkTurns.map(t => t.attacks.reduce((n, a) => n + a.length, 0))),
        dmgPerTurn: avg(ts.map(dmgOf)),
        abilitiesPerTurn: avg(ts.map(t => t.abilities.length)),
    };
}
const summarize = list => { // list of metrics objects
    if (!list.length) return null;
    const pick = f => avg(list.map(f).filter(x => x !== null && x !== undefined));
    return { n: list.length, turns: r1(pick(m => m.turns)), lands5: r1(pick(m => m.landsBy(5))), lands8: r1(pick(m => m.landsBy(8))), casts: r1(pick(m => m.castsPerTurn)), firstAttack: r1(pick(m => m.firstAttack)), attackRate: Math.round(100 * pick(m => m.attackRate)), perAttack: r1(pick(m => m.perAttack)), dmg: r1(pick(m => m.dmgPerTurn)), abilities: r1(pick(m => m.abilitiesPerTurn)) };
};

const out = { generated: new Date().toISOString().slice(0, 10), games: games.length, decks: {} };
const byDeck = {};
parsed.forEach(pg => { const hs = pg.g.players.findIndex(p => p.human); if (hs < 0) return; const c = pg.g.players[hs].commander || pg.g.players[hs].name; (byDeck[c] = byDeck[c] || []).push({ pg, hs, won: pg.g.winner === hs }); });

const topN = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const lines = [];
const say = s => { console.log(s); lines.push(s); };
for (const [deck, gs] of Object.entries(byDeck).sort((a, b) => b[1].length - a[1].length)) {
    const wins = gs.filter(x => x.won), losses = gs.filter(x => !x.won);
    const hm = gs.map(x => metricsFor(x.pg, x.hs)).filter(Boolean);
    const hmW = wins.map(x => metricsFor(x.pg, x.hs)).filter(Boolean), hmL = losses.map(x => metricsFor(x.pg, x.hs)).filter(Boolean);
    const rec = { deck, games: gs.length, wins: wins.length, human: summarize(hm), humanWins: summarize(hmW), humanLosses: summarize(hmL) };
    // what was cast on each of the first 6 own turns in the wins
    const openers = []; for (let k = 1; k <= 6; k++) { const c = {}; wins.forEach(x => (x.pg.own[x.hs].turns[k - 1] || { casts: [], lands: [] }).casts.forEach(n => c[n] = (c[n] || 0) + 1)); openers.push({ turn: k, top: topN(c, 4) }); }
    rec.openers = openers;
    // cards cast per game: win lift
    const perGame = x => new Set(x.pg.own[x.hs].turns.flatMap(t => t.casts));
    const seenW = {}, seenL = {}; wins.forEach(x => perGame(x).forEach(n => seenW[n] = (seenW[n] || 0) + 1)); losses.forEach(x => perGame(x).forEach(n => seenL[n] = (seenL[n] || 0) + 1));
    const lift = Object.keys(seenW).map(n => ({ n, w: seenW[n], l: seenL[n] || 0, rate: seenW[n] / Math.max(1, wins.length) - (seenL[n] || 0) / Math.max(1, losses.length || 1) })).filter(x => x.w >= Math.max(2, Math.ceil(wins.length / 2))).sort((a, b) => b.rate - a.rate);
    rec.winCards = lift.slice(0, 12);
    const ab = {}; gs.forEach(x => x.pg.own[x.hs].turns.forEach(t => t.abilities.forEach(a => ab[a] = (ab[a] || 0) + 1))); rec.abilities = topN(ab, 8);
    // how the games were won: the last own turn's attackers and the last casts
    rec.finishers = wins.map(x => { const ts = x.pg.own[x.hs].turns; const last = ts[ts.length - 1] || {}; return { turn: x.pg.g.turns, attackers: (last.attacks || []).flat().length, lastCasts: (last.casts || []).slice(-3) }; });
    // bots playing the same commander elsewhere
    const botList = []; parsed.forEach(pg => pg.g.players.forEach((p, i) => { if (!p.human && p.commander === deck && pg.g.players.filter(q => q.commander === deck && !q.human).length === 1) { const m = metricsFor(pg, i); if (m) botList.push(m); } }));
    rec.bot = summarize(botList);
    const labList = []; botGames.forEach(bg => bg.players.forEach((p, i) => { if (!p.human && p.commander === deck) { const m = evMetrics(bg, i); if (m) labList.push(m); } }));
    // for the computer baseline prefer the many lab games when there are any, else the few log-only ones
    rec.botLab = summarize(labList); if (rec.botLab && rec.botLab.n >= 5) rec.bot = rec.botLab;
    out.decks[deck] = rec;

    say(`\n## ${deck}  (${gs.length} game${gs.length === 1 ? '' : 's'}: ${wins.length} won, ${losses.length} lost)`);
    if (rec.human) say(`Human:  lands by turn 5 ${rec.human.lands5}, by turn 8 ${rec.human.lands8} · spells/turn ${rec.human.casts} · first attack on own turn ${rec.human.firstAttack} · attacks on ${rec.human.attackRate}% of turns after 4 · ${rec.human.perAttack} creatures per attack · ${rec.human.dmg} combat damage/turn · ${rec.human.abilities} abilities/turn`);
    if (rec.humanWins && rec.humanLosses) say(`  in wins: first attack ${rec.humanWins.firstAttack}, ${rec.humanWins.perAttack}/attack, ${rec.humanWins.casts} spells/turn, lands by 5 ${rec.humanWins.lands5}   |  in losses: first attack ${rec.humanLosses.firstAttack}, ${rec.humanLosses.perAttack}/attack, ${rec.humanLosses.casts} spells/turn, lands by 5 ${rec.humanLosses.lands5}`);
    if (rec.bot) say(`Computer on the same commander (${rec.bot.n} game${rec.bot.n === 1 ? '' : 's'}${rec.botLab && rec.bot === rec.botLab ? ', lab' : ''}): lands by 5 ${rec.bot.lands5}, by 8 ${rec.bot.lands8} · spells/turn ${rec.bot.casts} · first attack ${rec.bot.firstAttack} · attacks on ${rec.bot.attackRate}% of turns after 4 · ${rec.bot.perAttack} per attack · ${rec.bot.dmg} damage/turn · ${rec.bot.abilities} abilities/turn`);
    if (wins.length) { say('First turns in the games won:'); openers.forEach(o => say(`  turn ${o.turn}: ${o.top.map(([n, c]) => `${n} (${c}/${wins.length})`).join(', ') || '-'}`)); }
    if (rec.winCards.length) say((losses.length ? 'Cast in the wins more than in the losses: ' : 'Cast in most of the wins (no losses to compare): ') + rec.winCards.map(x => `${x.n} (${x.w}/${wins.length} wins, ${x.l}/${losses.length} losses)`).join('; '));
    if (rec.abilities.length) say('Abilities used most: ' + rec.abilities.map(([n, c]) => `${n} x${c}`).join(', '));
    if (rec.finishers.length) say('Won on turn ' + rec.finishers.map(f => `${f.turn} (${f.attackers} attackers; last casts: ${f.lastCasts.join(', ') || '-'})`).join('; '));
    // suggestions (only where there is a bot to compare to and the gap is real)
    const sug = [];
    if (rec.human && rec.bot) {
        if (rec.human.attackRate - rec.bot.attackRate >= 15) sug.push(`the human attacks on ${rec.human.attackRate}% of turns after turn 4, the computer on ${rec.bot.attackRate}%: let this deck's plan attack more (a higher \`atk\` or lower \`hold\` for its playstyle)`);
        if (rec.bot.attackRate - rec.human.attackRate >= 15) sug.push(`the computer attacks more often than the human (${rec.bot.attackRate}% against ${rec.human.attackRate}%): check it isn't throwing creatures away`);
        if (rec.human.perAttack >= rec.bot.perAttack * 1.4 && rec.human.perAttack - rec.bot.perAttack >= 1.5) sug.push(`the human sends ${rec.human.perAttack} creatures per attack against the computer's ${rec.bot.perAttack}: all-in swings are part of the plan`);
        if (rec.human.lands5 - rec.bot.lands5 >= 1) sug.push(`the human has ${r1(rec.human.lands5 - rec.bot.lands5)} more lands by turn 5: the computer should value land drops (and land ramp) higher for this deck`);
        if (rec.human.casts - rec.bot.casts >= 0.4) sug.push(`the human casts ${r1(rec.human.casts - rec.bot.casts)} more spells a turn: the computer leaves mana unused`);
        if (rec.human.abilities - rec.bot.abilities >= 0.4) sug.push(`the human uses ${r1(rec.human.abilities - rec.bot.abilities)} more abilities a turn: look at which abilities the computer skips`);
    }
    rec.suggestions = sug; if (sug.length) { say('Suggestions for the computer (low confidence below ~5 games):'); sug.forEach(s => say('  - ' + s)); }
    // plan skeleton
    if (wins.length >= 2 && rec.winCards.length) {
        const eng = rec.winCards.filter(x => x.rate > 0.2).slice(0, 8).map(x => x.n);
        say(`Plan skeleton (review before use):  '${deck}': { win: '<fill in how the wins ended>', engine: ${JSON.stringify(eng)}, payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },`);
        rec.planSkeleton = { engine: eng };
    }
}
fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '.out', 'playbook.json'), JSON.stringify(out, null, 1));
if (mdDir) {
    fs.mkdirSync(mdDir, { recursive: true });
    fs.writeFileSync(path.join(mdDir, 'playbooks.md'), `# Playbooks mined from game records\n\nGenerated ${out.generated} by \`node tests/playbook.js\` from ${games.length} games. Draft numbers for reviewing by hand; small samples mean low confidence.\n` + lines.join('\n') + '\n');
}
console.log(`\n(${games.length} games read; full data in tests/.out/playbook.json${mdDir ? '; markdown in ' + mdDir : ''})`);
