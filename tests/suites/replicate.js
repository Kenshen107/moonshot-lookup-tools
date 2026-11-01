// Replicate (CR 702.56, 2026-11-01): Hugh, First of Many gives artifact spells replicate {2}{U}. The cost is part of the spell's total cost,
// the copies go on the stack, and a copy of a permanent spell becomes a token. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
const NAMES = ['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Sol Ring', 'Lightning Bolt', 'Hugh, First of Many', 'Tyrox, Saurid Tyrant'];

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async names => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json();
            const C = {};
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
            await newGame(mk(), mk(), null, [mk()]);
            const [A, B] = G.players;
            const reset = () => {
                T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {}; G.endQ = [];
                G.players.forEach(P => { P.isAI = true; P.aiLevel = 'normal'; P.tune = {}; P.life = 40; P.hand.length = 0; P.command.length = 0; P.gy.length = 0; P.exile.length = 0; P.pool = []; P.library.length = 0; for (let i = 0; i < 30; i++) P.library.push(makeObj(C['Island'], P.i)); });
            };
            const put = (P, n) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const drain = async () => { for (let k = 0; k < 20 && G.stack.length; k++) await resolveTop(); await settle(); };
            const noSettle = async fn => { const real = settle; settle = async () => {}; try { await fn(); } finally { settle = real; } };
            const count = (P, n) => P.bf.filter(o => o.card.name === n).length;

            reset(); put(A, 'Hugh, First of Many');
            { const sr = give(A, 'Sol Ring'), bolt = give(A, 'Lightning Bolt');
              ok('Hugh grants replicate to an artifact spell', !!repCostOf(A, sr));
              ok('Hugh does not grant replicate to a non-artifact spell', !repCostOf(A, bolt));
              const base = costTotal(totalCost(A, sr)); sr.repN = 2; const withRep = costTotal(totalCost(A, sr)); sr.repN = 0;
              ok('replicate twice adds {2}{U} twice to the total cost', withRep - base === 6, [base, withRep]); }
            reset(); put(A, 'Hugh, First of Many'); for (let i = 0; i < 7; i++) put(A, 'Island');
            { const sr = give(A, 'Sol Ring'); ok('maxRep with 7 Islands and a {1} spell is 2', maxRep(A, sr) === 2, maxRep(A, sr));
              sr.repN = 2; await noSettle(() => castSpell(A, sr));
              ok('the copies are on the stack with the spell (not already on the battlefield)', G.stack.filter(it => it.copy).length === 2 && count(A, 'Sol Ring') === 0, [G.stack.length, count(A, 'Sol Ring')]);
              ok('all 7 Islands were tapped for the total cost', A.bf.filter(o => o.card.name === 'Island' && o.tapped).length === 7);
              await drain();
              ok('after resolving: one Sol Ring and two token copies', count(A, 'Sol Ring') === 3 && A.bf.filter(o => o.card.name === 'Sol Ring' && o.token).length === 2, A.bf.map(o => o.card.name + (o.token ? '*' : ''))); }
            reset(); put(A, 'Hugh, First of Many'); for (let i = 0; i < 4; i++) put(A, 'Island');
            { const sr = give(A, 'Sol Ring'); ok('maxRep with 4 Islands is 1 (no cap of 3, no over-paying)', maxRep(A, sr) === 1, maxRep(A, sr));
              sr.repN = 0; await castSpell(A, sr); await drain();
              ok('paying replicate zero times makes no copies', count(A, 'Sol Ring') === 1); }
            reset(); put(A, 'Hugh, First of Many'); for (let i = 0; i < 13; i++) put(A, 'Island');
            { const sr = give(A, 'Sol Ring'); sr.repN = 4; await castSpell(A, sr); await drain(); ok('no cap of three: four payments make four copies', count(A, 'Sol Ring') === 5, count(A, 'Sol Ring')); }
            reset(); put(A, 'Hugh, First of Many'); for (let i = 0; i < 7; i++) put(A, 'Island');
            { const sr = give(A, 'Sol Ring'); sr.repN = 2; await noSettle(() => castSpell(A, sr)); const top = G.stack.find(it => it.kind === 'spell');
              pull(G.stack, top); moveSpellCard(top.o, 'gy'); await drain();
              ok('copies survive the original being countered', A.bf.filter(o => o.card.name === 'Sol Ring' && o.token).length === 2, A.bf.map(o => o.card.name)); }
            reset(); ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('replicate', results, []);
    writeOut('replicate', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
