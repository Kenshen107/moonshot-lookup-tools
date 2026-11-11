#!/usr/bin/env node
// The standard check (2026-11-11, owner: "make a standard test run that all decks must pass and singles entered so we aren't building new labs every time").
// One script, the same checks for any decklist or any single cards, offline (cards come from tests/data/cards_all.json):
//
//   node tests/check.js tests/decks/hugh-food.txt            one or more deck files ("N Name" lines, the commander in the last block)
//   node tests/check.js --all-decks                          every tests/decks/*.txt plus every deck in VERIFIED_DECKS
//   node tests/check.js --builtin --key sandman              one built-in deck by its key (--builtin --list-builtin prints the keys)
//   node tests/check.js --builtin                            only the VERIFIED_DECKS that have no list file (run_all.py --cards runs each file, then this)
//   node tests/check.js --cards "Sol Ring|Hulkling"          single cards (| or newline between names), or --cards-file names.txt
//   node tests/check.js deck.txt --pods 12                   more pods in the games step (default 8; --quick 4)
//   node tests/check.js deck.txt --no-games                  skip the games step (the cards steps take about 15 seconds)
//
// Every deck must pass:  1 every card is found in the offline card file   2 it imports as a legal deck (no deckProblems)
//                        3 every card reads as fully Automated (the unread lines are listed)
//                        4 every different card is played by the AI for two turns on a prepared board: nothing throws, no card is in two zones, no NaN
//                        5 the deck plays N four-player pods at seat A against random decks: 0 hangs, 0 errors, 0 broken invariants (tests/lab.js --decka)
// Every single card must pass steps 1, 3 and 4. A deck built for a new commander needs no new suite: run this, then (if you want behaviour
// checks for the new engine pieces) write the one-off suite as before.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');

const args = process.argv.slice(2);
const flag = k => args.includes('--' + k);
const val = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const PODS = Number(val('pods', flag('quick') ? 4 : 8));
const NO_GAMES = flag('no-games');
const files = args.filter((a, i) => !a.startsWith('--') && !['--pods', '--cards', '--cards-file', '--key'].includes(args[i - 1]));

// Runs inside the game page. input = { decks: [{ name, text }], singles: [names] }
const KNOWN = JSON.parse(fs.readFileSync(path.join(__dirname, 'check-known.json'), 'utf8'));
const BODY = async function (input) {
    const out = { decks: [], singles: null };
    const raw = await (await fetch('/__cards.json')).json();
    const byName = new Map();
    raw.forEach(c => { if (!c.name || !c.type_line) return; if (!byName.has(c.name)) byName.set(c.name, c); const f = c.name.split(' // ')[0]; if (!byName.has(f)) byName.set(f, c); });
    const cache = new Map();
    const get = n => {
        const r = byName.get(n.trim()) || byName.get(n.trim().split(' // ')[0]); if (!r) return null;
        if (!cache.has(r.id)) { const sc = slimCard(r); CARDS.set(sc.id, sc); cache.set(r.id, sc); }
        return cache.get(r.id);
    };
    await loadBasics();
    const mountain = get('Mountain') || CARDS.get(BASIC_IDS.R);
    const bears = get('Grizzly Bears'), giant = get('Hill Giant');
    const A = await listToOppDeck('1 Tyrox, Saurid Tyrant\n98 Mountain', 'commander'), B = await listToOppDeck('1 Tyrox, Saurid Tyrant\n98 Mountain', 'commander');
    // Step 4 for a list of cards: returns the ones that failed
    const playCards = async cards => {
        const failures = [];
        await newGame(A, B);
        let P0 = G.players[0], P1 = G.players[1], i = 0;
        for (const c of cards) {
            if (++i % 60 === 0) { await newGame(A, B); P0 = G.players[0]; P1 = G.players[1]; }
            try {
                [P0, P1].forEach(P => { ['bf', 'hand', 'gy', 'exile'].forEach(z => P[z].splice(0)); P.life = 40; P.poison = 0; P.cmdDmg = 0; });
                G.stack.length = 0; G.attackers = []; G.blocks = {}; G.trigQ = []; G.over = false; G.mode = null; G.trigCount = 0;
                G.active = 0; G.turn = 6; G.phase = 'main1'; G.busy = false; G.extraCombat = 0; G.combatFired = false; window.lastResult = null;
                for (let k = 0; k < 9; k++) { const m = makeObj(mountain, 0); putOntoBattlefield(P0, m); m.sick = false; }
                for (const [P, cc] of [[P0, bears], [P0, giant], [P1, bears], [P1, giant]]) { const o = makeObj(cc, P.i); putOntoBattlefield(P, o); o.sick = false; }
                P0.hand.push(makeObj(c, 0));
                await aiTurn(P0);
                P0.bf.forEach(x => { x.sick = false; x.tapped = false; });
                G.turn = 8; G.phase = 'main1'; G.active = 0; G.extraCombat = 0; G.combatFired = false; G.over = false; G.trigCount = 0;
                await aiTurn(P0);
                const bad = T.invariants();
                if (bad.length) failures.push(`${c.name}: ${bad.join('; ')}`);
            } catch (e) { failures.push(`${c.name}: threw ${String(e && e.stack || e).slice(0, 200)}`); }
        }
        return failures;
    };
    const unread = c => { const r = rulesFor(c); return r.support === 'full' ? null : `${c.name} (${r.support}: ${(r.unhandled || []).join(' / ').slice(0, 140)})`; };

    for (const d of input.decks) {
        const res = { name: d.name, checks: [] };
        const ck = (label, ok, detail) => res.checks.push({ label, ok: !!ok, detail });
        try {
            const parsed = parseDeckText(d.text);   // the game's own reader: the last short block (or *CMDR*) is the commander(s)
            const missing = [], entries = [], cmdrs = [];
            for (const r of parsed.commander) { const c = get(r.name); if (c) cmdrs.push(c); else missing.push(r.name); }
            for (const r of parsed.main) { if (!/[A-Za-z]/.test(r.name)) continue; /* a stray number line */ const c = get(r.name); if (c) entries.push({ card: c, n: r.n || r.count || 1 }); else missing.push(r.name); }
            const commander = cmdrs[0] || null;
            ck('1 every card is in the offline card file', missing.length === 0, missing);
            if (missing.length) { out.decks.push(res); continue; }
            const gen = { name: d.name, format: 'commander', commander, commander2: cmdrs[1] || null, entries, source: 'check' };
            const deck = generatedToDeck(gen, d.name);
            const probs = deckProblems(deck);
            const fresh = probs.filter(p => !(d.known || []).some(k => p.includes(k)));
            ck('2 it is a legal deck (no deckProblems)' + (probs.length > fresh.length ? ' - known problem(s) in tests/check-known.json: ' + probs.filter(p => !fresh.includes(p)).join('; ') : ''), fresh.length === 0, fresh.slice(0, 4));
            const cards = [...new Map([...(commander ? [{ card: commander }] : []), ...(cmdrs[1] ? [{ card: cmdrs[1] }] : []), ...gen.entries].map(e => [e.card.name, e.card])).values()].filter(c => !isBasic(c));
            const notFull = cards.map(unread).filter(Boolean);
            ck(`3 every card reads as fully Automated (${cards.length} different cards)`, notFull.length === 0, notFull.slice(0, 8));
            const fails = await playCards(cards);
            ck('4 every card is played for two turns with no error or broken card', fails.length === 0, fails.slice(0, 6));
        } catch (e) { ck('the check ran', false, String(e && e.stack || e).slice(0, 300)); }
        out.decks.push(res);
    }
    if (input.singles && input.singles.length) {
        const res = { checks: [] }; const ck = (label, ok, detail) => res.checks.push({ label, ok: !!ok, detail });
        const missing = [], cards = [];
        input.singles.forEach(n => { const c = get(n); if (c) cards.push(c); else missing.push(n); });
        ck('1 every card is in the offline card file', missing.length === 0, missing);
        const notFull = cards.map(unread).filter(Boolean);
        ck(`3 every card reads as fully Automated (${cards.length} cards)`, notFull.length === 0, notFull.slice(0, 12));
        const fails = await playCards(cards.filter(c => !isBasic(c)));
        ck('4 every card is played for two turns with no error or broken card', fails.length === 0, fails.slice(0, 8));
        out.singles = res;
    }
    out.verified = typeof VERIFIED_DECKS !== 'undefined' ? VERIFIED_DECKS.map(v => ({ key: v.key, name: v.name, text: v.text })) : [];
    return out;
};

async function main() {
    let decks = [];
    const readDeck = f => ({ name: path.basename(f, '.txt'), file: f, text: fs.readFileSync(f, 'utf8') });
    const dir = path.join(__dirname, 'decks');
    const fileDecks = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort().map(f => readDeck(path.join(dir, f)));
    if (flag('all-decks')) decks = fileDecks.slice();
    files.forEach(f => decks.push(readDeck(path.resolve(f))));
    let singles = [];
    if (val('cards', null)) singles = val('cards').split(/[|\n]/).map(s => s.trim()).filter(Boolean);
    if (val('cards-file', null)) singles = singles.concat(fs.readFileSync(val('cards-file'), 'utf8').split('\n').map(s => s.replace(/^\d+\s+/, '').trim()).filter(Boolean));
    if (!decks.length && !singles.length && !flag('all-decks') && !flag('builtin')) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 18).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(2); }
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    if (flag('all-decks') || flag('builtin')) {
        // the decks built into the game (Sandman, Brudiclad, the Tyrants...) that have no list file here
        const v = await page.evaluate(() => (typeof VERIFIED_DECKS !== 'undefined' ? VERIFIED_DECKS : []).map(x => ({ key: x.key, name: x.name, text: x.text })));
        const have = new Set(fileDecks.map(d => d.text.replace(/\s+/g, ' ').trim()));
        const rest = v.filter(x => !have.has(x.text.replace(/\s+/g, ' ').trim()));
        if (flag('list-builtin')) { console.log(rest.map(x => x.key).join(' ')); await h.close(); process.exit(0); }
        const only = val('key', null);
        rest.forEach(x => { if (!only || x.key === only) decks.push({ name: x.key || x.name, text: x.text }); });
    }
    const t0 = Date.now();
    const result = await page.evaluate(`(${BODY.toString()})(${JSON.stringify({ decks: decks.map(d => ({ name: d.name, text: d.text, known: KNOWN[d.name] || [] })), singles })})`);
    await h.close();
    let bad = 0;
    const show = res => res.checks.forEach(c => { console.log(`  ${c.ok ? 'PASS' : 'FAIL'} ${c.label}${c.ok || !c.detail || !c.detail.length ? '' : '\n       ' + JSON.stringify(c.detail).slice(0, 700)}`); if (!c.ok) bad++; });
    if (errors.length) { console.log('PAGE ERRORS', errors.slice(0, 3)); bad++; }
    const summary = [];
    for (let i = 0; i < result.decks.length; i++) {
        const r = result.decks[i], d = decks[i];
        console.log(`\n== ${r.name}`);
        show(r);
        let gamesOk = null;
        const cardsOk = r.checks.every(c => c.ok);
        if (!NO_GAMES && cardsOk) {
            let file = d.file;
            if (!file) { file = path.join(os.tmpdir(), `check-${String(d.name).replace(/\W+/g, '_')}.txt`); fs.writeFileSync(file, d.text); }
            const p = spawnSync('node', [path.join(__dirname, 'lab.js'), '--decka', file, '--n', String(PODS), '--players', '4', '--kind', 'commander', '--conc', '2'], { encoding: 'utf8', timeout: 900000 });
            const o = p.stdout || '';
            const line = (o.match(/Finished \d+ pods: [^\n]*/) || [''])[0], hung = (o.match(/Hung[^\n]*/) || [''])[0];
            gamesOk = p.status === 0;
            console.log(`  ${gamesOk ? 'PASS' : 'FAIL'} 5 ${PODS} four-player pods with this deck at seat A\n       ${line}\n       ${hung}`);
            if (!gamesOk) { bad++; console.log(o.split('\n').filter(l => /seed |page error|unknown card|Error/.test(l)).slice(0, 6).map(l => '       ' + l.slice(0, 300)).join('\n') + (p.stderr ? '\n       ' + String(p.stderr).slice(0, 300) : '')); }
        }
        summary.push([r.name, cardsOk && gamesOk !== false]);
    }
    if (result.singles) { console.log('\n== single cards'); show(result.singles); }
    console.log(`\n${result.decks.length} deck(s)${result.singles ? ' and the single cards' : ''} checked in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${bad ? bad + ' check(s) FAILED' : 'all passed'}${summary.filter(s => !s[1]).length ? ' (' + summary.filter(s => !s[1]).map(s => s[0]).join(', ') + ')' : ''}`);
    process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
