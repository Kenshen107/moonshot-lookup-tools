// A spell whose target gains hexproof in response fizzles (rule 608.2b), and destroy logs read "X is destroyed by <card>" (2026-11-19, from the owner's pod record).
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
            const names = ['Island', 'Forest', 'Tyrox, Saurid Tyrant', 'Swords to Plowshares', 'Grizzly Bears', 'Hill Giant'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A, B] = G.players; A.isAI = true; B.isAI = true;
            const put = (P, n) => { const o = makeObj(C[n], P.i); putOntoBattlefield(P, o); o.sick = false; return o; };
            const bears = put(B, 'Grizzly Bears'), giant = put(B, 'Hill Giant');
            const L = []; const lg = window.log; window.log = (...a) => { L.push(String(a[0])); return lg(...a); };
            destroy(giant, "In Garruk's Wake");
            ok('destroy with a card name reads "is destroyed by <card>"', L.some(m => /Hill Giant is destroyed by In Garruk's Wake/.test(m)), L);
            // a target that gained hexproof before resolution fizzles
            const item = { kind: 'spell', P: A, o: makeObj(C['Swords to Plowshares'], A.i), name: 'Swords to Plowshares', target: { o: bears } };
            ok('a legal target stays legal', targetStillOk(item.target, item));
            Rx(bears).slHexNoDmg = true; // hexproof until it deals damage: the same flag has() reads
            ok('the target is no longer legal once it has hexproof', has(bears, 'hexproof') && !targetStillOk(item.target, item));
            const mine = { kind: 'spell', P: B, o: item.o, name: 'x', target: { o: bears } };
            ok('hexproof does not stop its own controller', targetStillOk(mine.target, mine));
            window.log = lg;
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('fizzle', results); writeOut('fizzle', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
