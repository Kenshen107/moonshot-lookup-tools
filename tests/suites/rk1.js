// Behaviour checks for card round rk1 (2026-11-27): the most-played cards the game did not fully read.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'rk1_names.json'), 'utf8'));
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const BODY = fs.readFileSync(path.join(__dirname, 'rk1.cases.js'), 'utf8');
    const r = await page.evaluate(async ([names, body]) => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const want = new Set(names.concat(['Island', 'Mountain', 'Forest', 'Plains', 'Swamp', 'Grizzly Bears', 'Sol Ring', 'Birds of Paradise', 'Llanowar Elves', 'Shock', 'Counterspell', 'Lightning Bolt']));
            raw.forEach(c => { if (want.has(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Grizzly Bears'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A, B] = G.players; A.isAI = false;
            const clear = () => { [A, B].forEach(P => { P.bf.length = 0; P.hand.length = 0; P.gy.length = 0; P.exile.length = 0; P.pool = []; }); G.trigQ = []; G.stack.length = 0; };
            const put = async (P, n, o2) => { if (!C[n]) throw new Error('no card ' + n); const x = makeObj(C[n], P.i, o2); putOntoBattlefield(P, x); x.sick = false; await settle(); return x; };
            const hand = (P, n) => { const x = makeObj(C[n], P.i); P.hand.push(x); return x; };
            const step = async (label, fn) => { try { clear(); await fn(); } catch (er) { ok(label + ' (threw ' + er.message + ')', false, String(er.stack).slice(0, 300)); } };
            const act0 = o => Rx(o).acts[0];
            const lands = async (P, n, name = 'Island') => { for (let i = 0; i < n; i++) await put(P, name); };
            const AF = Object.getPrototypeOf(async function () {}).constructor;
            const run = new AF('ok', 'step', 'put', 'hand', 'clear', 'C', 'A', 'B', 'lands', 'act0', 'G', body);
            await run(ok, step, put, hand, clear, C, A, B, lands, act0, G);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    }, [NAMES, BODY]);
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('rk1', results); writeOut('rk1', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
