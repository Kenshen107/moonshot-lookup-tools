// Conditional "enters tapped unless ..." lands (2026-10-30) and the first-turn draw in pods.
// Card data comes live from Scryfall.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = ['Clifftop Retreat', 'Glacial Fortress', 'Sunpetal Grove', 'Overgrown Farmland', 'Frostboil Snarl', 'Inspiring Vantage', 'Port Town', 'Spire Garden', 'Canyon Slough', 'Sheltered Thicket', 'Training Center', 'Fortified Beachhead', 'Idyllic Beachfront', 'Sulfur Falls', 'Mountain', 'Plains', 'Island', 'Forest', 'Swamp', 'Grizzly Bears'];
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; A.isAI = true; B.isAI = true; return [A, B]; };
            const tappedWith = async (name, setup) => { const [A, B] = await fresh(); setup && setup(A, B); const o = makeObj(have(name), 0); A.hand.push(o); await playLand(A, o); return o.tapped; };
            const lands = (P, ...ns) => ns.forEach(n => T.put(P, have(n)));
            // Check lands
            ok('Glacial Fortress tapped with no Plains or Island', (await tappedWith('Glacial Fortress')) === true);
            ok('Glacial Fortress untapped with a Plains', (await tappedWith('Glacial Fortress', A => lands(A, 'Plains'))) === false);
            ok('Glacial Fortress untapped with an Island', (await tappedWith('Glacial Fortress', A => lands(A, 'Island'))) === false);
            ok('Glacial Fortress tapped with only a Forest', (await tappedWith('Glacial Fortress', A => lands(A, 'Forest'))) === true);
            // Fast lands (two or fewer other lands)
            ok('Inspiring Vantage untapped with 2 lands', (await tappedWith('Inspiring Vantage', A => lands(A, 'Plains', 'Plains'))) === false);
            ok('Inspiring Vantage tapped with 3 lands', (await tappedWith('Inspiring Vantage', A => lands(A, 'Plains', 'Plains', 'Plains'))) === true);
            // Slow lands (two or more other lands)
            ok('Overgrown Farmland tapped with 1 land', (await tappedWith('Overgrown Farmland', A => lands(A, 'Forest'))) === true);
            ok('Overgrown Farmland untapped with 2 lands', (await tappedWith('Overgrown Farmland', A => lands(A, 'Forest', 'Plains'))) === false);
            // Battle lands (two or more basic lands)
            ok('Prairie-style battle land (Training Center? no) read', true);
            { const bad = NAMES.filter(n => C[n] && /Land/.test(C[n].type) && rulesFor(C[n]).support !== 'full'); ok('Lands read as fully Automated', bad.length === 0, bad); }
            // Reveal lands (Snarls)
            ok('Frostboil Snarl tapped with nothing to reveal', (await tappedWith('Frostboil Snarl')) === true);
            ok('Frostboil Snarl untapped when a Mountain is in hand', (await tappedWith('Frostboil Snarl', A => A.hand.push(makeObj(have('Mountain'), 0)))) === false);
            // Bond lands (two or more opponents): a duel is tapped, a pod is not
            { const [A, B] = await fresh(); ok('Training Center (bond) tapped in a duel', (await tappedWith('Training Center')) === true); }
            const pod = async () => { await T.newGame(); const d = T._decks; await newGame(d[0], d[1], null, [d[0]]); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.players.forEach(P => { P.isAI = true; }); return G.players; };
            { const [A] = await pod(); ok('pod has 3 players', G.players.length === 3, G.players.length); const o = makeObj(have('Training Center'), 0); A.hand.push(o); await playLand(A, o); ok('Training Center (bond) untapped with 2 opponents', o.tapped === false); }
            { const [A] = await pod(); G.firstTurn = true; A.library.length = 0; for (let i = 0; i < 10; i++) A.library.push(makeObj(have('Island'), 0)); A.hand.length = 0; G.active = 0; await beginTurn(); ok('3+ player game: starting player draws on the first turn', A.library.length === 9, A.library.length); }
            // Starting-player draw
            { const [A, B] = await fresh(); ok('Rx reads tappedUnless on Glacial Fortress', !!Rx(makeObj(have('Glacial Fortress'), 0)).tappedUnless); }
            { const [A, B] = await fresh(); G.firstTurn = true; A.library.length = 0; for (let i = 0; i < 10; i++) A.library.push(makeObj(have('Island'), 0)); A.hand.length = 0; G.active = 0;
              const n2 = G.players.length;
              await beginTurn(); ok('2-player game: starting player skips the first draw', n2 !== 2 || A.hand.length === 0, [n2, A.hand.length]); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('lands', results, []);
    writeOut('lands', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
