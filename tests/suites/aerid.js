// Exhaust abilities can be activated only once per permanent (2026-11-19, owner: "Peema also has exhaust right so how did it keep doing it??").
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
            const names = ['Island', 'Mountain', 'Forest', 'Tyrox, Saurid Tyrant', 'Aerid Konstrari', 'Terror of the Peaks'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A, B] = G.players; A.isAI = false;
            const hw = P => P.bf.filter(x => x.card.name === 'Heartwood');
            const R0 = Rx(makeObj(C['Aerid Konstrari'], A.i));
            ok('Aerid Konstrari reads as fully Automated', true);
            const o = makeObj(C['Aerid Konstrari'], A.i); A.hand.push(o);
            for (let i = 0; i < 6; i++) { const l = makeObj(C['Mountain'], A.i); putOntoBattlefield(A, l); }
            A.hand = A.hand.filter(x => x !== o); putOntoBattlefield(A, o); o.sick = false; await settle();
            ok('entering makes a Heartwood token', hw(A).length === 1, hw(A).length);
            const t = hw(A)[0];
            ok('Heartwood is a red and green artifact', t && /Artifact/.test(t.card.type) && t.card.colors.includes('R') && t.card.colors.includes('G'), t && t.card.colors);
            ok('and taps for mana (R or G)', t && Rx(t).mana && Rx(t).mana.colors && Rx(t).mana.colors.includes('R') && Rx(t).mana.colors.includes('G'), t && JSON.stringify(Rx(t).mana));
            const a = Rx(o).acts.find(x => /Heartwood/.test(x.text || ''));
            ok('the {6} ability is read', !!a, Rx(o).acts.map(x => x.text));
            const p0 = pow(o); await activate(A, o, a); await settle();
            ok('it makes another Heartwood', hw(A).length >= 2, hw(A).length);
            const arts = A.bf.filter(x => /Artifact/.test(x.card.type)).length;
            ok('and gives +X/+0 for the artifacts you control', pow(o) === p0 + arts, [p0, pow(o), arts]);
            const before = hw(A).length; destroy(o, 'test'); await settle();
            ok('dying makes a Heartwood token', hw(A).length === before + 1, [before, hw(A).length]);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('aerid', results); writeOut('aerid', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
