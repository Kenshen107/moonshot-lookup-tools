// Computer spell scores, round 1 (2026-11-11): planeswalkers, ramp spells, rituals, Brainstorm, wheels, gain-control-until-end-of-turn and extra-combat spells
// used to score 0, so the computer never cast them (see tests/ai_audit.js). spellslinger/07l-spell-scores.js.
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
            const want = ['Island', 'Forest', 'Mountain', 'Plains', 'Swamp', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Hill Giant', 'Elspeth, Sun\'s Champion', 'Cultivate', 'Dark Ritual', 'Brainstorm', 'Wheel of Fortune', 'Act of Treason', 'Relentless Assault', 'Shivan Dragon', 'Craw Wurm'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            manaMode = 'auto';
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async (lands = 6, land = 'Forest') => {
                await newGame(mk(), mk()); T.clear(); G.turn = 6; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
                const [A, B] = G.players; A.isAI = true; B.isAI = true; A.life = B.life = 40;
                for (let i = 0; i < lands; i++) { const m = makeObj(C[land], 0); putOntoBattlefield(A, m); m.sick = false; }
                A.library.length = 0; for (let i = 0; i < 8; i++) { A.library.push(makeObj(C['Forest'], 0)); B.library.push(makeObj(C['Island'], 1)); }
                A.hand.length = 0; B.hand.length = 0;
                const put = (P, n) => { const o = makeObj(C[n], P.i); putOntoBattlefield(P, o); o.sick = false; return o; };
                const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
                return [A, B, put, give];
            };
            const score = (A, o) => { const te = firstTargetEffect(o); const t = te ? aiPickTarget(A, te, o) : null; return aiScore(A, o, t); };
            // planeswalker
            { const [A, B, put, give] = await fresh(6, 'Plains'); const e = give(A, "Elspeth, Sun's Champion");
              ok('a planeswalker scores like a good creature (13+)', score(A, e) >= 13, score(A, e));
              A.tune = { spellScores: 0 }; ok('with spellScores=0 it scores 0 again (the old behaviour)', score(A, e) === 0, score(A, e)); A.tune = null;
              await aiTurn(A); ok("the computer casts Elspeth, Sun's Champion", !A.hand.includes(e) && A.bf.includes(e), [A.hand.includes(e), A.bf.includes(e)]); }
            // ramp
            { const [A, B, put, give] = await fresh(3); const c = give(A, 'Cultivate'); give(A, 'Shivan Dragon'); const early = score(A, c);
              const [A2, B2, p2, g2] = await fresh(9); const c2 = g2(A2, 'Cultivate'); const late = score(A2, c2);
              ok('Cultivate scores well with few lands and something expensive stuck', early >= 12, early); ok('...and much less with nine lands', late < early && late <= 4, [early, late]);
              A.library.length = 0; ok('Cultivate with no basic land to fetch scores 0', score(A, c) === 0, score(A, c)); }
            // rituals
            { const [A, B, put, give] = await fresh(3); const d = give(A, 'Dark Ritual'); give(A, 'Shivan Dragon'); const withBig = score(A, d);
              const [A2, B2, p2, g2] = await fresh(3); const d2 = g2(A2, 'Dark Ritual'); g2(A2, 'Grizzly Bears'); const none = score(A2, d2);
              ok('Dark Ritual with 3 lands and a 6-drop in hand: not enough (Ritual nets +2)', withBig === 0, withBig);
              const [A3, B3, p3, g3] = await fresh(3); const d3 = g3(A3, 'Dark Ritual'); g3(A3, 'Craw Wurm'); ok('Dark Ritual lets 3 lands cast a 6-drop? no: Craw Wurm costs 6, needs 4 more than it has', score(A3, d3) === 0, score(A3, d3));
              const [A4, B4, p4, g4] = await fresh(4); const d4 = g4(A4, 'Dark Ritual'); g4(A4, 'Shivan Dragon'); const real = score(A4, d4);
              ok('Dark Ritual scores when it makes a stuck spell castable (4 lands, a 6-drop)', real > 0, real); ok('...but not with only small spells in hand', none === 0, none); }
            // card flow
            { const [A, B, put, give] = await fresh(6); const b = give(A, 'Brainstorm'); ok('Brainstorm scores with a small hand', score(A, b) >= 5, score(A, b));
              const w = give(A, 'Wheel of Fortune'); B.hand.push(makeObj(C['Hill Giant'], 1), makeObj(C['Hill Giant'], 1), makeObj(C['Hill Giant'], 1)); A.hand.splice(A.hand.indexOf(b), 1);
              ok('Wheel of Fortune scores when you are nearly empty-handed and they are not', score(A, w) >= 5, score(A, w));
              for (let i = 0; i < 5; i++) give(A, 'Grizzly Bears'); ok('...and not with a full hand', score(A, w) === 0, score(A, w)); }
            // gain control until end of turn
            { const [A, B, put, give] = await fresh(6); put(A, 'Hill Giant'); put(B, 'Hill Giant'); B.life = 6; const a = give(A, 'Act of Treason');
              ok('Act of Treason scores big when the stolen creature plus your attackers are lethal', score(A, a) >= 1000, score(A, a));
              B.life = 40; ok('...but not for a small hit', score(A, a) === 0, score(A, a)); }
            // extra combat
            { const [A, B, put, give] = await fresh(6); for (let i = 0; i < 3; i++) put(A, 'Shivan Dragon'); const ra = give(A, 'Relentless Assault');
              G.phase = 'main1'; ok('Relentless Assault is not cast before combat', score(A, ra) === 0, score(A, ra));
              G.phase = 'main2'; ok('...but is worth casting after combat with a big board', score(A, ra) >= 5, score(A, ra)); }
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('spellscores', results);
    writeOut('spellscores', r);
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
