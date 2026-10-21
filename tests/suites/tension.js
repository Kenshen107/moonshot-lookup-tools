// Deal tension (2026-10-21): bots only deal when salt, power imbalance or an about-to-win threat gives a reason.
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
                await newGame(ds[0], ds[1], null, ds.slice(2)); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false;
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

            let [A, B, Cc, D] = await fresh(['greg', null, null]);
            const sc = (bot, from, type, x) => dealScore(bot, from, type, x);
            ok('calm table: no tension, so a deal is turned down', !dealTension(B, A).relevant && /nothing to deal over/.test(sc(B, A, 'peace').reason || ''), dealTension(B, A));
            ok('and a calm bot makes no offers', !dealsRelevant(B));
            B.salt = 5; ok('a salty bot has a reason to deal', dealTension(B, A).relevant);
            B.salt = 0; G.arch = B.i; ok('the archenemy has a reason', dealTension(B, A).relevant); G.arch = null;
            // a runaway: one player with far more board than the others together
            for (let i = 0; i < 6; i++) { const o = T.put(D, C['Serra Angel']); o.summoningSick = false; }
            ok('a runaway player is found', runawayPlayer() === D, podThreat(D));
            ok('everyone else now has tension', dealTension(B, A).relevant && dealTension(B, A).parts.runaway);
            const base = G.dealsAlways; G.dealsAlways = true; const p0 = sc(B, A, 'pact', D.i).score, q0 = sc(B, A, 'pact', Cc.i).score; G.dealsAlways = base;
            const p1 = sc(B, A, 'pact', D.i), q1 = sc(B, A, 'pact', Cc.i);
            ok('a gang-up on the runaway is tantalizing', p1.parts.tantalizing === 3 && !q1.parts.tantalizing, [p1.parts, q1.parts]);
            ok('so it scores above a pact on someone else', p1.score > q1.score);
            // about to win: D can kill A
            D.bf.length = 0; for (let i = 0; i < 6; i++) { const o = T.put(D, C['Serra Angel']); o.summoningSick = false; }
            A.life = 8; ok('a player about to be killed is spotted', !!winThreat(D) && winThreat(D).target === A);
            ok('the target feels it most', dealTension(A, B).parts.aboutToWin === 5);
            G.dealsAlways = true; ok('dealsAlways turns the gate off', dealsRelevant(Cc) && dealTension(Cc).relevant);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('tension', results, []);
    writeOut('tension', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
