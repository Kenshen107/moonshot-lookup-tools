// Stay quiet (D) 2026-10-28, part of table sense. Table sense: C let somebody else answer it, B combat tricks after blocks, A mana up. See docs/spellslinger-table-sense.md.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const NAMES = ['Mountain', 'Forest', 'Island', 'Plains', 'Grizzly Bears', 'Hill Giant', 'Giant Growth', 'Counterspell', 'Terror', 'Swamp', 'Wrath of God', 'Serra Angel', 'Wall of Wood', 'Tyrox, Saurid Tyrant'];
const SETUP = async function ([n, NAMES]) {
    if (!window.LOCAL) {
        const raw = await (await fetch('/__cards.json')).json();
        window.LOCAL = {};
        raw.forEach(c => { if (NAMES.includes(c.name) && !window.LOCAL[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); window.LOCAL[c.name] = sc; } });
    }
    const C = window.LOCAL;
    const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
    const decks = []; for (let i = 0; i < n; i++) decks.push(mk());
    await newGame(decks[0], decks[1], null, decks.slice(2));
    window.C = C;
    return G.players.length;
};
const RESET = function () {
    T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {};
    G.players.forEach(P => { P.isAI = true; P.aiLevel = 'normal'; P.aiStyle = null; P.tune = {}; P.life = 40; P.hand.length = 0; P.command.length = 0; P.landsPlayed = 9; P.patWait = {}; P.patSaid = {}; P.holdSig = ''; P.holdRun = 0; P.holdTurn = -1; P.grudge = {}; P.cmdBy = {}; });
    G.arch = null;
};

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    await page.evaluate(SETUP, [4, NAMES]);
    const r = await page.evaluate(async ([resetSrc]) => {
        const out = [];
        try {
            const reset = eval('(' + resetSrc + ')');
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const [A, B, Cc, D] = G.players;
            const C = window.C;
            const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const lands = (P, n, k) => { for (let i = 0; i < k; i++) T.put(P, C[n]); };
            const creature = (P, n) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const picked = P => { P.tmCache = {}; P.leaderCache = null; const p = aiBestPlay(P); return p ? p.o.card.name : null; };

            // ---------------- C. Let somebody else answer it ----------------
            reset(); lands(A, 'Swamp', 2); lands(A, 'Island', 2); give(A, 'Terror'); creature(B, 'Hill Giant'); Cc.life = 40;
            A.tune = { patience: 0 };
            ok('C: with patience off the bot kills a 3/3 right away', picked(A) === 'Terror', picked(A));
            A.tune = {}; A.patWait = {}; A.patSaid = {};
            ok('C: with patience on it holds Terror on a threat that is not its problem (healthy, nobody else in danger)', picked(A) === null, picked(A));
            Cc.life = 5; A.patWait = {};
            ok('C: ... still holds when another player is more exposed', picked(A) === null, picked(A));
            A.life = 10; A.patWait = {};
            ok('C: ... answers at once when the bot itself is low', picked(A) === 'Terror', picked(A));
            A.life = 40; A.patWait = {}; A.grudge = { [B.i]: 8 };
            ok('C: ... answers at once when that player has been hurting it (grudge)', picked(A) === 'Terror', picked(A));
            A.grudge = {}; A.patWait = {}; picked(A); G.turn += 9; // 2 rounds of 4 players = 8 turns
            ok('C: ... and answers after waiting two full rounds', picked(A) === 'Terror', picked(A));
            reset(); lands(A, 'Swamp', 2); lands(A, 'Island', 2); give(A, 'Terror'); creature(B, 'Hill Giant'); creature(B, 'Hill Giant'); creature(B, 'Hill Giant'); creature(B, 'Hill Giant'); creature(B, 'Hill Giant');
            ok('C: ... and answers when the player is about to win (lethal range)', picked(A) === 'Terror', picked(A));
            reset(); lands(A, 'Plains', 4); give(A, 'Wrath of God'); creature(B, 'Hill Giant'); creature(B, 'Hill Giant'); creature(B, 'Hill Giant');
            A.tune = { patience: 0 };
            ok('C: with patience off the bot sweeps three Hill Giants', picked(A) === 'Wrath of God', picked(A));
            A.tune = {}; A.patWait = {}; A.patSaid = {};
            ok('C: with patience on it waits for somebody else to sweep', picked(A) === null, picked(A));
            A.life = 9; A.patWait = {};
            ok('C: ... and sweeps when it is the one in danger', picked(A) === 'Wrath of God', picked(A));

            // ---------------- A. Mana up ----------------
            reset(); lands(A, 'Forest', 3); creature(A, 'Grizzly Bears'); give(A, 'Giant Growth');
            ok('A: a trick in hand and a creature on the board keeps 1 mana up', tableReserve(A) === 1, tableReserve(A));
            A.holdTurn = -1; A.holdRun = 0; A.holdSig = ''; A.tune = { holdMana: 0 };
            ok('A: the knob turns it off', tableReserve(A) === 0);
            reset(); lands(A, 'Forest', 3); give(A, 'Giant Growth');
            ok('A: no creature, nothing to trick: no reserve', tableReserve(A) === 0);
            reset(); lands(A, 'Island', 4); give(A, 'Counterspell'); B.hand.push(makeObj(C['Mountain'], B.i));
            ok('A: a counterspell with 4 lands and a foe holding cards keeps 2 mana up', tableReserve(A) === 2, tableReserve(A));
            reset(); lands(A, 'Island', 3); give(A, 'Counterspell'); B.hand.push(makeObj(C['Mountain'], B.i));
            ok('A: ... but not with 3 lands', tableReserve(A) === 0);
            reset(); lands(A, 'Forest', 3); lands(A, 'Mountain', 1); creature(A, 'Grizzly Bears'); give(A, 'Giant Growth'); give(A, 'Hill Giant');
            ok('A: with 3 lands, a trick in hand and Hill Giant (3) it does not cast the Giant', picked(A) !== 'Hill Giant', picked(A));
            A.tune = { holdMana: 0 }; A.holdTurn = -1;
            ok('A: with the knob off it casts Hill Giant', picked(A) === 'Hill Giant', picked(A));
            reset(); lands(A, 'Forest', 3); creature(A, 'Grizzly Bears'); give(A, 'Giant Growth');
            const seen = []; for (let t = 0; t < 8; t++) { G.turn = 8 + t * 4; seen.push(tableReserve(A)); }
            ok('A: after three turns of holding the same trick it spends the mana once', seen.includes(0) && seen.includes(1), seen);
            reset(); G.players.splice(2); lands(A, 'Forest', 3); creature(A, 'Grizzly Bears'); give(A, 'Giant Growth');
            ok('A: not in a duel (the two-player results stay as they were)', tableReserve(A) === 0);
            window.__dropped = [Cc, D];

            // ---------------- A. Fear: reading open mana ----------------
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [RESET.toString()]);
    const results = formatChecks(r);
    // The rest needs a fresh four-player game (the duel check above removed two seats)
    await page.evaluate(SETUP, [4, NAMES]);
    const r2 = await page.evaluate(async ([resetSrc]) => {
        const out = [];
        try {
            const reset = eval('(' + resetSrc + ')');
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const [A, B, Cc, D] = G.players;
            const C = window.C;
            const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const lands = (P, n, k) => { for (let i = 0; i < k; i++) T.put(P, C[n]); };
            const creature = (P, n) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const picked = P => { P.tmCache = {}; P.leaderCache = null; const p = aiBestPlay(P); return p ? p.o.card.name : null; };
            const cast = o => G.stack.some(i => i.o === o) || !G.players.some(P => P.hand.includes(o));

            // A: reading open mana
            reset(); const bears = creature(A, 'Grizzly Bears'); const wall = creature(B, 'Wall of Wood'); G.defender = B.i;
            B.hand.push(makeObj(C['Mountain'], B.i));
            ok('fear baseline: a 2/2 attacks into a 0/3 wall when the owner has no open mana', aiChooseAttackers(A).includes(bears), aiChooseAttackers(A).map(o => o.card.name));
            lands(B, 'Forest', 2);
            ok('fear: ... but not when the wall\'s owner has two open lands and a card in hand', !aiChooseAttackers(A).includes(bears), aiChooseAttackers(A).map(o => o.card.name));
            A.tune = { fear: 0 };
            ok('fear: the knob turns it off', aiChooseAttackers(A).includes(bears));
            A.tune = {}; B.hand.length = 0;
            ok('fear: ... and an empty hand shows nothing', aiChooseAttackers(A).includes(bears));

            // B: attacking into a bad block with a trick
            reset(); const bears2 = creature(A, 'Grizzly Bears'); creature(B, 'Hill Giant'); G.defender = B.i; lands(A, 'Forest', 2);
            ok('trick attack baseline: a 2/2 does not attack into an untapped 3/3', !aiChooseAttackers(A).includes(bears2));
            give(A, 'Giant Growth');
            ok('trick attack: ... but does when it holds Giant Growth with the mana up', aiChooseAttackers(A).includes(bears2), aiChooseAttackers(A).map(o => o.card.name));
            A.tune = { trickAtk: 0 };
            ok('trick attack: the knob turns it off', !aiChooseAttackers(A).includes(bears2));

            // B: the window after blocks - the attacker's trick
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i;
            const b3 = creature(A, 'Grizzly Bears'), hg3 = creature(B, 'Hill Giant'); lands(A, 'Forest', 2);
            const gg = give(A, 'Giant Growth'); G.attackers = [b3.uid]; G.blocks = { [b3.uid]: [hg3.uid] };
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: the attacker casts Giant Growth on its blocked Grizzly Bears', !A.hand.includes(gg) && pow(b3) === 5, [pow(b3), A.hand.length]);
            ok('window: ... and the bears survive combat damage', (() => { combatDamage(A); return onBf(b3.uid) && !onBf(hg3.uid); })());

            // B: the defender's trick
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i;
            const hg4 = creature(A, 'Hill Giant'), b4 = creature(B, 'Grizzly Bears'); lands(B, 'Forest', 2);
            const gg2 = give(B, 'Giant Growth'); G.attackers = [hg4.uid]; G.blocks = { [hg4.uid]: [b4.uid] };
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: the defender pumps its blocking Grizzly Bears', !B.hand.includes(gg2) && pow(b4) === 5, [pow(b4)]);

            // B: nothing to gain, nothing cast
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i;
            const hg5 = creature(A, 'Hill Giant'), b5 = creature(B, 'Grizzly Bears'); lands(A, 'Forest', 2);
            const gg3 = give(A, 'Giant Growth'); G.attackers = [hg5.uid]; G.blocks = { [hg5.uid]: [b5.uid] };
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: a 3/3 that already beats its blocker keeps its trick', A.hand.includes(gg3) && pow(hg5) === 3, [pow(hg5)]);
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i;
            const hg6 = creature(A, 'Hill Giant'); lands(A, 'Forest', 2); const gg4 = give(A, 'Giant Growth'); G.attackers = [hg6.uid]; G.blocks = {};
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: an unblocked attacker that is not lethal keeps its trick', A.hand.includes(gg4));
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i; B.life = 5;
            const bears7 = creature(A, 'Grizzly Bears'); lands(A, 'Forest', 2); const gg5 = give(A, 'Giant Growth'); G.attackers = [bears7.uid]; G.blocks = {};
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: an unblocked 2/2 against a player on 5 life gets Giant Growth for the kill', !A.hand.includes(gg5) && pow(bears7) === 5, [pow(bears7)]);

            // B: instant removal on the blocker
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i;
            const bears8 = creature(A, 'Grizzly Bears'), hg8 = creature(B, 'Hill Giant'); lands(A, 'Island', 1); lands(A, 'Swamp', 1);
            const terror = give(A, 'Terror'); G.attackers = [bears8.uid]; G.blocks = { [bears8.uid]: [hg8.uid] };
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: Terror on the blocker that would kill the attacker', !A.hand.includes(terror) && !onBf(hg8.uid), [A.hand.length, !!onBf(hg8.uid)]);

            // ---------------- D. Stay quiet ----------------
            const atkNames = P => aiChooseAttackers(P).map(o => o.card.name);
            reset(); A.aiStyle = 'control'; const q1 = creature(A, 'Hill Giant'); G.defender = B.i;
            ok('D: a control bot hiding does not attack a player who has not hurt it', atkNames(A).length === 0, atkNames(A));
            A.aiStyle = 'aggro'; A.quietWas = undefined;
            ok('D: ... an aggro bot does', atkNames(A).includes('Hill Giant'), atkNames(A));
            A.aiStyle = 'control'; A.tune = { quiet: 0 };
            ok('D: the knob turns it off', atkNames(A).includes('Hill Giant'));
            A.aiStyle = 'aggro'; A.tune = { quiet: 2 };
            ok('D: quiet=2 makes every bot quiet', atkNames(A).length === 0, atkNames(A));
            A.aiStyle = 'control'; A.tune = {}; A.life = 10;
            ok('D: reveals when it is in trouble (12 life or less)', atkNames(A).includes('Hill Giant'), atkNames(A));
            A.life = 40; B.life = 8; creature(A, 'Hill Giant'); creature(A, 'Hill Giant');
            ok('D: reveals when it can finish somebody', atkNames(A).length >= 2, atkNames(A));
            B.life = 40; A.bf.splice(1);
            ok('D: hiding again once nobody is in reach', atkNames(A).length === 0, atkNames(A));
            G.turn = 100;
            ok('D: reveals when the game has gone on long enough', atkNames(A).includes('Hill Giant'), atkNames(A));
            G.turn = 8; A.grudge = {};
            // development: the big play waits while near the top
            reset(); A.aiStyle = 'control'; lands(A, 'Plains', 5); creature(A, 'Hill Giant'); give(A, 'Serra Angel');
            ok('D: a hiding bot at the top of the table holds its 5-drop (' + podThreat(A).toFixed(1) + ' vs ' + podThreat(B).toFixed(1) + ')', picked(A) === null, picked(A));
            reset(); A.aiStyle = 'control'; lands(A, 'Plains', 5); creature(A, 'Hill Giant'); give(A, 'Serra Angel'); for (let i = 0; i < 6; i++) creature(B, 'Hill Giant');
            ok('D: ... but casts it when somebody else is far ahead', picked(A) === 'Serra Angel', picked(A));
            reset(); A.aiStyle = 'aggro'; lands(A, 'Plains', 5); creature(A, 'Hill Giant'); give(A, 'Serra Angel');
            ok('D: ... and a non-quiet bot casts it', picked(A) === 'Serra Angel', picked(A));
            // deals
            reset(); A.aiStyle = 'control'; const dq = dealScore(A, B, 'peace').score; A.aiStyle = 'aggro'; const dn = dealScore(A, B, 'peace').score;
            ok('D: a quiet bot likes a peace deal a little more', dq - dn >= 0.99, [dq, dn]);

            // Off switch, easy bots, duels
            reset(); G.phase = 'declareBlocks'; G.active = 0; G.defender = B.i; A.tune = { trickWindow: 0 };
            const b9 = creature(A, 'Grizzly Bears'), hg9 = creature(B, 'Hill Giant'); lands(A, 'Forest', 2); const gg9 = give(A, 'Giant Growth'); G.attackers = [b9.uid]; G.blocks = { [b9.uid]: [hg9.uid] };
            G.busy = true; await aiCombatTricks(); await settle();
            ok('window: the trickWindow knob turns it off', A.hand.includes(gg9));
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [RESET.toString()]);
    results.push(...formatChecks(r2));
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('tablesense', results, []);
    writeOut('tablesense', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
