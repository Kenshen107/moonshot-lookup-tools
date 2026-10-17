// AI discipline (2026-10-17, owner's request: "more reserved with removal and interaction ... and make sure they understand reach can block flying").
// Removal is saved for real threats (unless the AI is under pressure), counterspells are saved for big plays, and reach is understood in attacks and blocks.
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
            ['Mountain', 'Island', 'Grizzly Bears', 'Hill Giant', 'Wind Drake', 'Giant Spider', 'Serra Angel', 'Lightning Bolt', 'Counterspell', 'Tyrox, Saurid Tyrant', 'Terror', 'Pillarfield Ox']
                .forEach(n => { const c = raw.find(x => x.name === n); if (!c) throw new Error('no card ' + n); const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }], source: 'test' });
            await newGame(mk(), mk());
            const [A, B] = G.players; A.isAI = true; B.isAI = true; A.aiLevel = 'normal'; B.aiLevel = 'normal';
            const setup = () => { T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; A.life = B.life = 40; A.hand.length = 0; B.hand.length = 0; A.command.length = 0; B.command.length = 0; G.stack.length = 0; A.landsPlayed = 9; };
            const fresh = (P, n, c) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const castsOn = (P, spell, tgt) => { const bolt = makeObj(C[spell], P.i); P.hand.push(bolt); for (let i = 0; i < 3; i++) T.put(P, C['Mountain']); const pick = aiBestPlay(P); const names = pick ? pick.o.card.name : null; window.__dbg = pick ? [names, pick.s, pick.target && pick.target.o && pick.target.o.card.name] : [canCastNow(P, bolt), canPay(P, bolt), firstTargetEffect(bolt), (() => { const te = firstTargetEffect(bolt); return te ? !!aiPickTarget(P, te, bolt) : null; })()]; return names === spell && pick.target && pick.target.o === tgt; };

            // ---- Removal is saved for a real threat ----
            setup(); const bears = fresh(B, 'Grizzly Bears');
            ok('a healthy AI does not burn a vanilla 2/2 (value ' + creatureValue(bears).toFixed(1) + ')', !castsOn(A, 'Lightning Bolt', bears));
            setup(); const giant = fresh(B, 'Hill Giant');
            ok('... but it does burn a 3/3 it can kill (value ' + creatureValue(giant).toFixed(1) + ')', castsOn(A, 'Lightning Bolt', giant), window.__dbg);
            setup(); const bears2 = fresh(B, 'Grizzly Bears'); A.life = 9;
            ok('... and under pressure (9 life) it will burn the 2/2', castsOn(A, 'Lightning Bolt', bears2));
            setup(); const ox = fresh(B, 'Pillarfield Ox');
            ok('Terror is not spent on a vanilla 2/4 at healthy life', !castsOn(A, 'Terror', ox));

            // ---- Counterspells are saved for the big plays ----
            setup(); for (let i = 0; i < 3; i++) T.put(B, C['Island']);
            const cs = makeObj(C['Counterspell'], B.i); B.hand.push(cs);
            const cheap = makeObj(C['Grizzly Bears'], A.i);
            const item1 = { P: A, kind: 'spell', o: cheap, target: null, uid: 1 }; G.stack.push(item1);
            G.priority = B.i; const resp1 = aiRespond(B, item1);
            ok('a healthy AI does not counter a vanilla 2/2', !resp1, resp1 && resp1.o.card.name);
            const big = makeObj(C['Serra Angel'], A.i);
            G.stack.length = 0; const item2 = { P: A, kind: 'spell', o: big, target: null, uid: 2 }; G.stack.push(item2);
            const resp2 = aiRespond(B, item2);
            ok('... but it counters a Serra Angel', !!resp2, stackThreat(item2, B));

            // ---- Reach blocks flying ----
            setup(); const drake = fresh(A, 'Wind Drake'); const spider = fresh(B, 'Giant Spider');
            ok('a reach creature can block a flier (engine)', canBlock(spider, drake));
            ok('the AI will not attack a 2/2 flier into an untapped 2/4 reach creature', !aiChooseAttackers(A).some(o => o.uid === drake.uid), aiChooseAttackers(A).map(o => o.card.name));
            G.attackers = [drake.uid]; T.put(B, C['Grizzly Bears']);
            const blocks = Object.values(aiChooseBlocks(B, A)).flat().map(u => onBf(u).card.name);
            ok('the AI blocks the flier with the reach creature, not the ground creature', blocks.length === 1 && blocks[0] === 'Giant Spider', blocks);
            setup(); const drake2 = fresh(A, 'Wind Drake'); fresh(B, 'Grizzly Bears');
            ok('a flier does attack past ground creatures with no reach', aiChooseAttackers(A).some(o => o.uid === drake2.uid));
            G.attackers = [drake2.uid];
            ok('and the AI cannot block it with a ground creature', Object.keys(aiChooseBlocks(B, A)).length === 0);
            setup(); const spider2 = fresh(B, 'Giant Spider'); const atk = fresh(A, 'Serra Angel'); atk.tkw.push('flying');
            ok('a reach creature is worth more when the other side has fliers', creatureValue(spider2) > (() => { A.bf.splice(A.bf.indexOf(atk), 1); return creatureValue(spider2); })());
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('aireserve', results, []);
    writeOut('aireserve', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
