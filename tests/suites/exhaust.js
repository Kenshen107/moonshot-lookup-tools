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
            const names = ['Island', 'Tyrox, Saurid Tyrant', 'Peema Trailblazer'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A] = G.players; A.isAI = false; // (the computer's own guard on Peema would also say no)
            const o = makeObj(C['Peema Trailblazer'], A.i); putOntoBattlefield(A, o); o.sick = false;
            const a = Rx(o).acts.find(x => /Pay six/.test(x.text || '') || /\{E\}/.test(x.text || ''));
            ok('the exhaust ability is read as once only', a && a.onceEver, a && a.text);
            A.energy = 20;
            ok('it can be activated at first', canActivate(A, o, a));
            await activate(A, o, a); await settle();
            A.energy = 20;
            ok('and not a second time', !canActivate(A, o, a));
            resetObj(o);
            ok('a new permanent (after leaving and returning) can use it again', canActivate(A, o, a));
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('exhaust', results); writeOut('exhaust', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
