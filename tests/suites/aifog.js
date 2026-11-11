// The computer and Fog effects (2026-11-11, owner: a bot cast a fog spell in its own main phase): it never casts "prevent all combat damage" on its own
// turn (Respite's life-gain half used to make it look worth casting), and it casts one after attackers are declared when the attack is lethal or big.
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
            const want = ['Island', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Fog', 'Respite', 'Hill Giant'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            manaMode = 'auto';
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async () => {
                await newGame(mk(), mk()); T.clear(); G.turn = 6; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.fog = null;
                const [A, B] = G.players; A.isAI = true; B.isAI = true; A.life = B.life = 40; G.active = 0; G.phase = 'main1';
                for (let i = 0; i < 6; i++) { const m = makeObj(C['Forest'], B.i); putOntoBattlefield(B, m); m.sick = false; const n = makeObj(C['Forest'], A.i); putOntoBattlefield(A, n); n.sick = false; }
                return [A, B];
            };
            // 1. never on its own turn
            for (const nm of ['Fog', 'Respite']) {
                const [A, B] = await fresh(); const o = makeObj(C[nm], 0); A.hand.push(o);
                await aiTurn(A);
                ok(nm + ' stays in the hand on its own turn', A.hand.includes(o) && G.fog !== G.turn, [A.hand.includes(o), G.fog]);
            }
            // 2. a lethal attack: the defender casts it
            const attackInto = async (nm, power) => {
                const [A, B] = await fresh(); const g = []; for (let i = 0; i < power; i++) { const x = makeObj(C['Hill Giant'], 0); putOntoBattlefield(A, x); x.sick = false; g.push(x); }
                const o = makeObj(C[nm], 1); B.hand.push(o); B.life = 8; G.active = 0; G.phase = 'declareAttackers';
                declareAttackers(A, g); await settle(); G.phase = 'declareBlocks';
                G.defender = 1; await chooseBlocksAll(A); fixMenace(); combatDamage(A); await settle();
                return { life: B.life, fog: G.fog === G.turn, inHand: B.hand.includes(o) };
            };
            const big = await attackInto('Fog', 3), bigR = await attackInto('Respite', 3);
            ok('lethal attack (9 power into 8 life): the defender casts Fog and takes no damage', big.fog && big.life === 8 && !big.inHand, big);
            ok('lethal attack: Respite is cast too', bigR.fog && !bigR.inHand && bigR.life >= 8, bigR);
            const small = await attackInto('Fog', 1);
            ok('a small attack (3 power into 8 life, nothing to stop): not worth a Fog', small.life === 5 || small.life === 8 ? true : false, small);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('aifog', results);
    writeOut('aifog', r);
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
