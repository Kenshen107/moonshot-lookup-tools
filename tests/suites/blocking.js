// Blocking (2026-10-15, owner: "blocking is not working"). Was: instant-speed windows (2026-10-15, owner's reports): an activated ability counts as something you can do at instant speed
// (Sandman's graveyard ability), a person is asked at an opponent's end step, the computer flashes in Mithril Coat to save a legendary creature,
// and Accursed Marauder's enters trigger fires once however it gets onto the battlefield.
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
            const want = ['Island', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Hill Giant', 'Serra Angel', 'Multani, Yavimaya\'s Avatar'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            manaMode = 'auto';
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const scenario = async (n, label, mkDef) => {
                await newGame(mk(), mk(), null, n > 2 ? [mk(), mk()] : []); T.clear(); G.turn = 6; G.firstTurn = false; G.busy = false;
                const [A, ...rest] = G.players; A.isAI = false; rest.forEach(X => X.isAI = true);
                G.hotseat = null; G.view = 0;
                const B = rest[n > 2 ? 1 : 0]; G.defender = null;
                mkDef(A, B);
                G.active = B.i; G.phase = 'main1';
                const run = aiTurn(B);
                let seen = false, tries = 0;
                while (tries++ < 80) { await new Promise(r => setTimeout(r, 100)); if (G.mode && G.mode.type === 'block') { seen = true; break; } if (G.over) break; }
                ok(label + ': the person is asked to block', seen, { phase: G.phase, mode: G.mode && G.mode.type, attackers: G.attackers, log: G.log.slice(-4).map(l => l.text || l) });
                if (seen) { const bl = A.bf.find(isCreature); const at = onBf(G.attackers[0]); const r = G.mode.resolve;
                    ok(label + ': blocker could block', canBlock(bl, at));
                    permClick(bl.uid); permClick(at.uid); // tap your creature, then the attacker, as a person does
                    ok(label + ': tapping the creature and then the attacker sets the block', (G.blocks[at.uid] || []).includes(bl.uid), { blocks: G.blocks, attackerSeat: at.owner });
                    G.mode = null; r(); }
                await run; await settle();
            };
            const setup = (A, B) => { T.put(A, C['Grizzly Bears']); T.put(B, C['Hill Giant']); T.put(B, C['Hill Giant']); lands(B, 3, 'Forest'); };
            const lands = (P, k, name) => { for (let i = 0; i < k; i++) T.put(P, C[name]); };
            await scenario(2, 'duel', setup);
            await scenario(4, 'pod of 4 (attacker is seat 2)', setup);
            await scenario(3, 'pod of 3', setup);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('blocking', results, []);
    writeOut('blocking', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
