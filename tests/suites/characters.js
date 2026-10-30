// Character habits, taunts and compliments, the draw offer, revenge pacts between bots, remembered rivalries and the Tap all lands button (2026-10-20).
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const want = ['Island', 'Mountain', 'Grizzly Bears', 'Serra Angel', 'Tyrox, Saurid Tyrant', 'Counterspell', 'Lightning Bolt', 'Terror', 'Divination'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const fresh = async (chars) => {
                const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
                const ds = [mk(), mk(), mk(), mk()]; ds[1].aiStyle = 'control'; ds[2].aiStyle = 'aggro'; ds[3].aiStyle = 'ramp';
                await newGame(ds[0], ds[1], null, ds.slice(2)); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.dealsAlways = true;
                G.players.forEach((P, i) => { P.life = 40; P.salt = 0; P.said = 0; P.name = ['You', 'Alpha', 'Bravo', 'Charlie'][i] + ', test'; P.library.length = 0; for (let k = 0; k < 30; k++) P.library.push(makeObj(C['Island'], i)); });
                G.players[0].isAI = false;
                G.players.forEach(P => { delete P.char; });
                assignCharacters();
                if (chars) chars.forEach((k, i) => { if (k) G.players[i + 1].char = { key: k, ...CHARACTERS[k] }; });
                G.cool = G.players.map(() => 0); G.deals = []; G.tips = []; G.reliable = {}; G.askUsed = null; G.arch = null;
                return G.players;
            };
            const lines = () => G.log.map(l => l.text || l);
            const lands = (P, n, name) => { for (let i = 0; i < n; i++) T.put(P, C[name]); };

            // ---- Tap all lands ----
            let [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            lands(A, 3, 'Island'); lands(A, 2, 'Mountain');
            tapAllLands();
            ok('Tap all lands floats the mana from every single-color land', A.pool.length === 5 && A.bf.filter(o => o.tapped).length === 5, { pool: A.pool.length });
            ok('the button exists on the page', !!document.getElementById('tapAllBtn'));
            // ---- Deals: character taste ----
            [A, B, Cc, D] = await fresh(['arthur', 'luke', 'sam']);
            T.put(B, C['Serra Angel']); T.put(B, C['Serra Angel']); T.put(Cc, C['Serra Angel']); T.put(Cc, C['Serra Angel']); T.put(D, C['Serra Angel']); T.put(D, C['Serra Angel']);
            const small = proposeDeal(A, B, 'peace');
            const arthurSmall = dealScore(B, A, 'peace');
            ok('Arthur will not deal with small fry', arthurSmall.parts.respect === -3 && arthurSmall.reason === "I don't deal with small fry.", arthurSmall);
            const lukeScore = dealScore(Cc, A, 'peace'), samScore = dealScore(D, A, 'peace');
            ok('Luke leans yes (+1 on everything), Sam leans no on peace (-1) and yes on a gang-up', lukeScore.parts.character === 1 && samScore.parts.character === -1 && dealScore(D, A, 'pact', Cc.i).parts.character === 1, { l: lukeScore.parts.character, s: samScore.parts.character, p: dealScore(D, A, 'pact', Cc.i).parts });
            // ---- loyalty ----
            [A, B, Cc, D] = await fresh(['greg', 'sam', 'trevor']);
            ok('Greg never breaks a peace', charBreaksPeace(G.players[1], A, 99, true) === false);
            A.life = 8; ok('Sam breaks a peace for lethal and for a big hit, only when the way is open', charBreaksPeace(G.players[2], A, 10, true) === true && charBreaksPeace(G.players[2], A, 6, true) === true && charBreaksPeace(G.players[2], A, 10, false) === false);
            ok('Trevor never breaks one', charBreaksPeace(G.players[3], A, 99, true) === false);
            // ---- Leo remembers ----
            [A, B, Cc, D] = await fresh(['leo', 'greg', 'sam']);
            const leo = G.players[1], gr = G.players[2]; leo.grudge = {}; gr.grudge = {}; breakDeal(makeDeal(A, leo, 'peace'), A.i, 'test'); breakDeal(makeDeal(A, gr, 'peace'), A.i, 'test');
            ok('a betrayed Leo holds a bigger grudge than Greg does (2 more)', leo.grudge[A.i] === gr.grudge[A.i] + 2, { leo: leo.grudge[A.i], greg: gr.grudge[A.i] });
            // ---- taunts and compliments ----
            [A, B, Cc, D] = await fresh(['sam', 'trevor', 'arthur']);
            const sam = G.players[1];
            emote(1, 'taunt');
            ok('a taunt adds grudge (more from a salty character)', sam.grudge[A.i] >= 1.5 * 1.5, sam.grudge[A.i]);
            const g1 = sam.grudge[A.i]; emote(1, 'taunt');
            ok('the same bot will not react twice in a row', sam.grudge[A.i] === g1);
            emote(2, 'compliment');
            ok('a compliment adds no trust with Trevor', !(G.players[2].trust && G.players[2].trust[A.i]));
            emote(3, 'compliment');
            ok('a compliment adds trust with Arthur (he loves it)', G.players[3].trust[A.i] === 1, G.players[3].trust[A.i]);
            ok('the Deals dialog has the buttons and the table feed', (() => { makeDeal(Cc, D, 'peace'); dealDialog(); const h = document.getElementById('modalHost').innerHTML; closeModal(); return /Taunt/.test(h) && /Compliment/.test(h) && /Elsewhere at the table/.test(h) && /Offer a draw/.test(h); })());
            // ---- draw offer ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            G.turn = 4; offerDraw();
            ok('a draw cannot be offered too early', !G.over && !drawAllowed());
            G.turn = 30; G.players.forEach(P => { P.life = 8; });
            const wins0 = profile.wins, loss0 = profile.losses;
            offerDraw();
            ok('when everyone agrees the game ends as a draw', G.over === true && window.lastResult && window.lastResult.winner === null, window.lastResult);
            ok('a draw is neither a win nor a loss', profile.wins === wins0 && profile.losses === loss0, { w: profile.wins - wins0, l: profile.losses - loss0 });
            closeModal();
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); G.turn = 30;
            T.put(D, C['Serra Angel']); T.put(D, C['Serra Angel']); D.life = 40; A.life = 40; B.life = 40; Cc.life = 40;
            G.players.forEach(P => { P.life = 40; });
            offerDraw();
            ok('a bot that is clearly ahead refuses and says so', !G.over && lines().some(l => /No draw/.test(l)), lines().slice(-2));
            // ---- revenge pacts between bots ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const bot1 = G.players[1], bot2 = G.players[2], bot3 = G.players[3];
            bot1.grudge = { [bot3.i]: 8 }; bot2.trust = { [bot1.i]: 3 };
            botPacts(bot1);
            const pact = (G.deals || []).find(x => x.type === 'pact' && x.x === bot3.i);
            ok('a bot with a big grudge asks a friendly bot to gang up on who hurt it', !!pact && ((pact.a === bot1.i && pact.b === bot2.i) || (pact.a === bot2.i && pact.b === bot1.i)), G.deals);
            // ---- remembered rivals ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            profile.rivals = { greg: { grudge: 0, respect: 2, games: 3, trust: 2 }, marcus: { grudge: 2, respect: 0, games: 2, trust: 0 } };
            G.players[1].trust = {}; await banterStart();
            ok('a bot you got on with starts out trusting you', (G.players[1].trust[A.i] || 0) >= 1.5, G.players[1].trust);
            ok('a rival still starts salty', G.players[2].salt >= 2, G.players[2].salt);
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('characters', results, []);
    writeOut('characters', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
