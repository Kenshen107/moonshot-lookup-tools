// The computer doesn't replay a bounce land that can only return itself (2026-11-25 pod record: Jadzi never cast a spell in 34 turns).
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
            const names = ['Island', 'Forest', 'Tyrox, Saurid Tyrant', 'Simic Growth Chamber'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A] = G.players; A.isAI = true;
            const fresh = () => { A.bf.length = 0; A.hand.length = 0; A.landsPlayed = 0; };
            fresh(); A.hand.push(makeObj(C['Simic Growth Chamber'], A.i), makeObj(C['Forest'], A.i));
            ok('the card reads as a bounce land', (Rx(A.hand[0]).etb || []).some(e => e.t === 'bounceOwnLand'));
            aiPlayLand(A); await settle();
            ok('with no land out it plays the Forest, not the bounce land', A.bf.length === 1 && A.bf[0].card.name === 'Forest', A.bf.map(x => x.card.name));
            fresh(); A.hand.push(makeObj(C['Simic Growth Chamber'], A.i));
            aiPlayLand(A); await settle();
            ok('with only the bounce land in hand and no land out it waits', A.bf.length === 0 && A.hand.length === 1, A.bf.map(x => x.card.name));
            fresh(); const f = makeObj(C['Forest'], A.i); putOntoBattlefield(A, f); A.hand.push(makeObj(C['Simic Growth Chamber'], A.i));
            aiPlayLand(A); await settle();
            ok('with a land out it plays the bounce land and returns the other land, not itself', A.bf.length === 1 && A.bf[0].card.name === 'Simic Growth Chamber' && A.hand.some(x => x.card.name === 'Forest'), [A.bf.map(x => x.card.name), A.hand.map(x => x.card.name)]);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('bounceland', results); writeOut('bounceland', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
