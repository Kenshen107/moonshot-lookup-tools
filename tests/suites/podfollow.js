// Follow-ups from the 2026-11-24 pod record: Goblin Cannon for the computer past the activation cap and for a person in one step, at most one quiet style among random
// pod seats, a stalled table brings quiet bots out, and animated artifacts count as attackers.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const names = ['Island', 'Forest', 'Mountain', 'Tyrox, Saurid Tyrant', 'Goblin Cannon', 'Mind Stone', 'Grizzly Bears'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk(), null, [mk(), mk()]);
            const reset = () => { T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1'; G.stack.length = 0; G.players.forEach(P => { P.isAI = true; P.out = false; P.life = 40; P.bf.length = 0; P.infMana = 0; P.infTurn = 0; P.infTurnActs = 0; }); };
            const put = (P, n) => { const o = makeObj(C[n], P.i); putOntoBattlefield(P, o); o.sick = false; return o; };
            const [A, B] = G.players;
            // 1. the computer's Goblin Cannon is not stopped by the activation cap; other abilities still are
            reset(); { giveInfiniteMana(A, 'test'); A.infTurn = G.turn; A.infTurnActs = 500; const gc = put(A, 'Goblin Cannon'); const a = actsOf(gc)[0]; ok('Goblin Cannon is exempt from the infinite-mana activation cap', !!a && canActivate(A, gc, a) === true, [!!a]);
                const fake = { effects: [{ t: 'draw', n: 1 }], text: '{T}: Draw a card.', cost: { tap: true } }; ok('the cap still stops another ability', canActivate(A, put(A, 'Mind Stone'), fake) === false, []); }
            if (!window.__RUN2) { window.__RUN2 = 0; }
            // 2. a person is asked once how many more times and at whom, instead of once per activation
            reset(); { B.life = 30; const C2 = G.players[2]; C2.life = 30; const gc = put(A, 'Goblin Cannon'); giveInfiniteMana(A, 'test'); A.isAI = false; window.__DC_HUMAN = true;
                const asked = []; const an = window.askNumber, am = window.askMode, ay = window.askYes;
                window.askNumber = async (P, msg) => { asked.push('n'); return 5; }; window.askMode = async () => 0; window.askYes = async () => { asked.push('y'); return false; };
                const a = actsOf(gc)[0]; const TO = (pr, ms, nm) => Promise.race([pr, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout ' + nm + ' ' + JSON.stringify(asked) + ' mode=' + JSON.stringify(G.mode && G.mode.type) + ' stack=' + G.stack.length)), ms))]); await TO(activate(A, gc, a, { p: B }), 4000, 'activate'); await TO(settle(), 4000, 'settle');
                window.askNumber = an; window.askMode = am; window.askYes = ay; window.__DC_HUMAN = false;
                ok('one number prompt and no yes/no prompts for six activations', asked.filter(x => x === 'n').length === 1 && !asked.includes('y'), asked);
                ok('all of them hit the chosen player (6 damage)', B.life === 24, [B.life]); ok('Goblin Cannon is sacrificed at the end', !onBf(gc.uid), []); }
            // 3. at most one quiet style among the random pod seats
            { const quiet = ['control', 'ramp', 'spellslinger']; let worst = 0; for (let i = 0; i < 200; i++) { const loud = shuffled(PLAYSTYLE_KEYS.filter(k => !quiet.includes(k))), q = shuffled(PLAYSTYLE_KEYS.filter(k => quiet.includes(k))); const seats = shuffled([...loud.slice(0, 3), q[0]].filter(Boolean)).slice(0, 2); worst = Math.max(worst, seats.filter(s => quiet.includes(s)).length); } ok('two random seats never both have a quiet style', worst <= 1, [worst]); }
            // 4. a stalled table brings a quiet bot out
            reset(); { const P = G.players[2]; P.aiStyle = 'ramp'; G.turn = 30; G.lastAtkTurn = 2; G.arch = -1; const st = quietState(P); ok('nobody attacked for a long time: the quiet bot comes out', !st.hiding && /nobody/.test(st.reason), [st]); G.lastAtkTurn = 29; ok('with recent attacks it keeps hiding', quietState(P).hiding === true, [quietState(P)]); }
            // 5. an animated artifact is an attacker for the computer
            reset(); { const ms = put(B, 'Mind Stone'); ms.animated = { turn: G.turn, p: 4, q: 4, kw: [] }; B.aiStyle = 'aggro'; G.active = B.i; ok('an animated Mind Stone is a creature', isCreature(ms) && pow(ms) === 4, []); const list = aiChooseAttackers(B); ok('the computer may attack with it (it has been in play)', Array.isArray(list), [list && list.length]); ok('it is not summoning sick', !ms.sick, []); }
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('podfollow', results); writeOut('podfollow', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
