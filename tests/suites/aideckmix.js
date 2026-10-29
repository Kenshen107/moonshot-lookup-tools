// Where the computer's Commander decks come from (2026-10-28, owner: "have the ai use my user made decks and precons 60% of the time and edhrec the other 40%").
// Offline: no card data and no network. The deck builders (saved deck, Ready precon, EDHREC build, themed fallback) are stubbed with made-up decks,
// so these checks cover the REAL roll (`aiDeckSource`), pool (`aiOwnPool`), fallbacks and no-repeat-commander rule (`buildAiCommanderDeck`),
// and how `startMatch` seats the Surprise me opponent and pod seats 3 and 4. What the stubs hide (that a real EDHREC build is 100 cards, that a
// real precon loads) is covered by suites/randomdeck.js and suites/games.js, which need the network.
'use strict';
const path = require('path');
const fs = require('fs');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });

    // ---- made-up cards and deck builders ----
    const mkCard = n => ({ id: 'id-' + n, name: n, ci: [], cmc: 3, type: 'Legendary Creature', cost: '' });
    const mkDeck = (cmdrName, source, extra) => { const c = mkCard(cmdrName); return { name: cmdrName, format: 'commander', commander: c, entries: [{ card: mkCard('Filler for ' + cmdrName), n: 99 }], source, ...extra }; };
    let counter = 0, lastEdh = null, calls = { saved: 0, precon: 0, edhrec: 0, fallback: [], modern: 0, theme: [] }, edhFails = false;
    const reset = () => { counter = 0; lastEdh = null; calls = { saved: 0, precon: 0, edhrec: 0, fallback: [], modern: 0, theme: [] }; edhFails = false; };
    const real = { savedToOppDeck, verifiedToOppDeck, pickRandomCommander, buildEdhrecRandomDeck, buildRandomCommanderDeck, buildRandomModernDeck, inferStyle, aiOwnPool, aiDeckSource, cardsByIds, loadBasics, deckToEntries, newGame };
    savedToOppDeck = async (who, idx) => { calls.saved++; const prof = who === accounts.current ? profile : null, d = prof.decks[idx]; return mkDeck(CARDS.get(d.commander).name, `${who}'s saved deck`); };
    verifiedToOppDeck = async key => { calls.precon++; return mkDeck('Precon ' + key, 'fully working deck (checked test)'); };
    pickRandomCommander = async () => { if (edhFails) throw new Error('EDHREC down'); lastEdh = mkCard('Edh ' + (++counter)); return lastEdh; };
    buildEdhrecRandomDeck = async () => { calls.edhrec++; return mkDeck(lastEdh.name, "random build from EDHREC's test cards"); };
    buildRandomCommanderDeck = async (c, style, theme) => { (theme ? calls.theme : calls.fallback).push(style || theme || null); return mkDeck('Fallback ' + (calls.fallback.length + calls.theme.length), 'random themed deck', { aiStyle: style || 'midrange' }); };
    buildRandomModernDeck = async () => { calls.modern++; return { name: 'Modern random', format: 'modern', commander: null, entries: [], source: 'random modern' }; };
    inferStyle = () => 'midrange';
    cardsByIds = async () => {}; loadBasics = async () => {};
    const restore = () => { Object.assign(globalThis, real); };

    // A player's saved decks: one full Commander deck (the player's own), another full one, a Modern deck, a short Commander deck
    CARDS.set('p1', mkCard('Player Cmdr')); CARDS.set('s2', mkCard('Saved Two'));
    const full = (cmd) => ({ name: 'Deck ' + cmd, format: 'commander', cards: { fillerA: 99 }, commander: cmd });
    profile.decks = [full('p1'), full('s2'), { name: 'A Modern deck', format: 'modern', cards: { fillerA: 60 }, commander: null }, { name: 'Short', format: 'commander', cards: { fillerA: 10 }, commander: 'p1' }];

    // ---- the roll ----
    ok('the roll: 0 and 0.59 pick your own decks, 0.6 and 0.99 pick EDHREC', aiDeckSource(5, 0) === 'own' && aiDeckSource(5, 0.59) === 'own' && aiDeckSource(5, 0.6) === 'edhrec' && aiDeckSource(5, 0.99) === 'edhrec');
    ok('with nothing in the pool the roll always goes to EDHREC', aiDeckSource(0, 0) === 'edhrec' && aiDeckSource(0, 0.3) === 'edhrec');
    let own = 0; for (let i = 0; i < 20000; i++) if (aiDeckSource(5) === 'own') own++;
    ok('20,000 real rolls land near 60% (58 to 62%)', own >= 11600 && own <= 12400, own / 200 + '%');

    // ---- the pool ----
    const pool = aiOwnPool(), saved = pool.filter(x => x.kind === 'saved'), precons = pool.filter(x => x.kind === 'precon');
    ok('the pool holds the two full saved Commander decks, not the Modern one or the short one', saved.length === 2 && saved.map(x => x.idx).join() === '0,1', saved.map(x => x.label));
    ok('... and every Ready Commander precon (VERIFIED_DECKS)', precons.length === VERIFIED_DECKS.length && precons.length > 10, precons.length);

    // ---- buildAiCommanderDeck: 60/40 through the real function ----
    reset();
    let tally = { own: 0, edhrec: 0, fallback: 0 };
    for (let i = 0; i < 2000; i++) { const d = await buildAiCommanderDeck(); tally[d.aiPick]++; }
    ok('2,000 builds: 55 to 65% saved decks or precons, the rest EDHREC, no fallbacks', tally.own >= 1100 && tally.own <= 1300 && tally.fallback === 0 && tally.own + tally.edhrec === 2000, tally);
    ok('... and the saved decks and precons are both used', calls.saved > 20 && calls.precon > 200, [calls.saved, calls.precon]);
    reset();
    aiOwnPool = () => [];
    let allEdh = true; for (let i = 0; i < 50; i++) { const d = await buildAiCommanderDeck(); if (d.aiPick !== 'edhrec') allEdh = false; }
    ok('an empty pool goes to EDHREC every time', allEdh && calls.edhrec === 50, calls.edhrec);
    reset(); edhFails = true;
    const d0 = await buildAiCommanderDeck({ style: 'tokens' });
    ok('an empty pool with EDHREC down still starts: the old themed random deck, in the seat\'s playstyle', d0.aiPick === 'fallback' && calls.fallback[0] === 'tokens', [d0.aiPick, calls.fallback]);
    aiOwnPool = real.aiOwnPool;
    reset(); edhFails = true;
    tally = { own: 0, edhrec: 0, fallback: 0 }; for (let i = 0; i < 300; i++) { const d = await buildAiCommanderDeck(); tally[d.aiPick]++; }
    ok('with EDHREC down the pool covers it: no EDHREC decks, and the themed fallback only when four rolls in a row miss (about 3%)', tally.edhrec === 0 && tally.own > 270 && tally.fallback < 25, tally);

    // ---- no repeated commanders ----
    reset();
    const everyOwn = new Set(['saved two', 'player cmdr', ...VERIFIED_DECKS.map(v => ('precon ' + v.key).toLowerCase())]);
    let bad = 0, kinds = { own: 0, edhrec: 0, fallback: 0 };
    for (let i = 0; i < 100; i++) { const d = await buildAiCommanderDeck({ avoid: everyOwn }); kinds[d.aiPick]++; if (everyOwn.has(d.commander.name.toLowerCase())) bad++; }
    ok('when every saved deck and precon commander is already at the table, none is rolled and EDHREC covers it (no themed fallback)', kinds.own === 0 && kinds.fallback === 0 && kinds.edhrec === 100 && bad === 0, kinds);
    reset();
    const some = new Set(['saved two', 'precon sandman']); bad = 0;
    for (let i = 0; i < 300; i++) { const d = await buildAiCommanderDeck({ avoid: some }); if (some.has(d.commander.name.toLowerCase())) bad++; }
    ok('a commander at the table is never rolled again (300 builds)', bad === 0, bad);

    // ---- startMatch: the Surprise me opponent and pod seats 3 and 4 ----
    let started = null;
    newGame = async (mine, opp, friend, more) => { started = { opp, more }; };
    deckToEntries = d => ({ name: d.name });
    $('playDeck').innerHTML = '<option value="0">x</option>'; $('playDeck').value = '0';
    chosenOpponent = { type: 'random', fmt: 'commander', name: 'Random playable deck' };
    const savedTheme = randomThemeChoice, savedPod = podSize; randomThemeChoice = ''; podSize = 4;
    let distinct = true, seatsOk = true, playerCmdrBack = 0, sources = { own: 0, edhrec: 0, fallback: 0 };
    reset();
    for (let i = 0; i < 60; i++) {
        started = null; await startMatch(true);
        if (!started || started.more.length !== 2) { seatsOk = false; continue; }
        const decks = [started.opp, ...started.more], names = decks.map(d => d.commander.name.toLowerCase());
        if (new Set(names).size !== 3) distinct = false;
        if (names.includes('player cmdr')) playerCmdrBack++;
        decks.forEach(d => sources[d.aiPick || 'none'] = (sources[d.aiPick || 'none'] || 0) + 1);
    }
    ok('a 4-player game seats the opponent and two more rolled decks (60 games)', seatsOk);
    ok('... all three AI commanders differ, and none is the player\'s own commander', distinct && playerCmdrBack === 0, [distinct, playerCmdrBack]);
    ok('... every AI seat was rolled (no unrolled "none" decks), about 60% own', !sources.none && sources.own >= 80 && sources.own <= 140, sources);
    reset(); podSize = 3; started = null; await startMatch(true);
    ok('a 3-player game seats one extra rolled deck', started && started.more.length === 1 && !!started.more[0].aiPick && !!started.opp.aiPick, started && started.more.length);
    reset(); podSize = 2; started = null; await startMatch(true);
    ok('a 1v1 Surprise me is still rolled and has no extra seats', started && started.more.length === 0 && !!started.opp.aiPick, started && started.opp.aiPick);
    reset(); podSize = 4; randomThemeChoice = 'tokens'; started = null; await startMatch(true);
    ok('a theme picked by hand for Surprise me skips the roll for that opponent (seats 3 and 4 still roll)', calls.theme.length === 1 && calls.theme[0] === 'tokens' && !started.opp.aiPick && started.more.every(d => !!d.aiPick), [calls.theme, started.opp.aiPick]);
    randomThemeChoice = '';
    // Opponents you pick yourself are never rolled
    reset(); podSize = 2; chosenOpponent = { type: 'saved', who: accounts.current, idx: 1, fmt: 'commander', name: 'Deck s2' }; started = null; await startMatch(true);
    ok('a saved deck you pick as the opponent is played as it is (no roll)', calls.saved === 1 && calls.precon === 0 && calls.edhrec === 0 && !started.opp.aiPick, calls);
    reset(); podSize = 3; started = null; await startMatch(true);
    ok('... and in a pod the other seat is rolled around it, never repeating its commander', started.more.length === 1 && started.more[0].commander.name.toLowerCase() !== 'saved two' && !!started.more[0].aiPick, started.more[0] && started.more[0].commander.name);
    // A Modern deck: the Modern random opponent is untouched and there are no pod seats
    reset(); podSize = 4; profile.decks = [{ name: 'Mod', format: 'modern', cards: { fillerA: 60 }, commander: null }]; chosenOpponent = { type: 'random', fmt: 'modern', name: 'Random playable deck' }; started = null; await startMatch(true);
    ok('a Modern deck against Surprise me still gets the Modern random deck and no pod seats', calls.modern === 1 && started.more.length === 0 && !started.opp.aiPick, [calls.modern, started.more.length]);

    randomThemeChoice = savedTheme; podSize = savedPod; chosenOpponent = null; restore();
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'aideckmix');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('aideckmix', results, errors);
    writeOut('aideckmix', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
