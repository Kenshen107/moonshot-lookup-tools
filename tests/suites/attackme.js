// "Whenever a creature attacks you or a planeswalker you control" (2026-11-16, owner's pod record: Revenge of Ravens fired for attacks at other players and
// made the wrong player lose life): one trigger for each creature that attacks THIS controller, and that creature's controller is the one who loses life.
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
            const want = ['Island', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Revenge of Ravens', 'Blood Reckoning', 'Kazuul, Tyrant of the Cliffs', 'Search the Premises', 'Isperia, Supreme Judge'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            manaMode = 'auto';
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async (n) => {
                const decks = []; for (let i = 0; i < n; i++) decks.push(mk());
                await newGame(decks[0], decks[1], null, decks.slice(2)); T.clear(); G.turn = 6; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0;
                G.players.forEach(P => { P.isAI = true; P.life = 40; });
                return G.players;
            };
            const attack = async (A, to, from) => { // from: [attacker player, [target player index per creature]]
                G.active = from[0]; G.phase = 'declareAttackers';
                const list = from[1].map(t => { const x = makeObj(C['Grizzly Bears'], from[0]); putOntoBattlefield(G.players[from[0]], x); x.sick = false; x.atkTo = t; return x; });
                G.attackers = list; G.defender = from[1][0];
                fire('attacks', { list }); await settle();
            };
            // Pod: P0 owns Revenge of Ravens. P1 sends two creatures at P0 and one at P2.
            let P = await fresh(4); const rr = makeObj(C['Revenge of Ravens'], 0); putOntoBattlefield(P[0], rr);
            await attack(P, null, [1, [0, 0, 2]]);
            ok('Revenge of Ravens: two creatures attack its controller, the attacker\'s controller loses 2 and the owner gains 2', P[1].life === 38 && P[0].life === 42, P.map(x => x.life));
            ok('nobody else loses life or gains it', P[2].life === 40 && P[3].life === 40, P.map(x => x.life));
            // Pod: the attackers all go at P2: nothing happens
            P = await fresh(4); putOntoBattlefield(P[0], makeObj(C['Revenge of Ravens'], 0));
            await attack(P, null, [1, [2, 2, 2]]);
            ok('an attack at another player does not trigger it at all', P.map(x => x.life).every(l => l === 40), P.map(x => x.life));
            // Blood Reckoning: only the creatures attacking its controller cost life, and it is the attacker's controller who pays
            P = await fresh(4); putOntoBattlefield(P[0], makeObj(C['Blood Reckoning'], 0));
            await attack(P, null, [2, [0, 3, 0]]);
            ok('Blood Reckoning: player 2 loses 2 (two creatures at player 0), the defender loses nothing', P[2].life === 38 && P[0].life === 40 && P[3].life === 40, P.map(x => x.life));
            // The same wording on other cards: one Clue and one draw for each attacking creature
            P = await fresh(4); putOntoBattlefield(P[0], makeObj(C['Search the Premises'], 0));
            await attack(P, null, [1, [0, 0, 2]]);
            ok('Search the Premises investigates once for each creature attacking its controller (2 Clues, not 1 or 3)', P[0].bf.filter(x => /Clue/.test(x.card.name)).length === 2, P[0].bf.map(x => x.card.name));
            P = await fresh(4); P[0].library.push(makeObj(C['Island'], 0), makeObj(C['Island'], 0), makeObj(C['Island'], 0)); putOntoBattlefield(P[0], makeObj(C['Isperia, Supreme Judge'], 0));
            const h0 = P[0].hand.length; await attack(P, null, [1, [0, 0, 2]]);
            ok('Isperia draws once for each creature attacking its controller', P[0].hand.length - h0 === 2, P[0].hand.length - h0);
            // Duel: one attacker at the owner
            P = await fresh(2); putOntoBattlefield(P[0], makeObj(C['Revenge of Ravens'], 0));
            await attack(P, null, [1, [0]]);
            ok('duel: the attacker loses 1 and the owner gains 1', P[1].life === 39 && P[0].life === 41, P.map(x => x.life));
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('attackme', results);
    writeOut('attackme', r);
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
