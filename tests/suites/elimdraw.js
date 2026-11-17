// Pod record 2026-11-17 (owner pasted a 4-player game): (1) a player who had left the game kept "drawing" from Flumph (and logged "can't draw - the library is
// empty"); (2) Flumph ("you and target opponent each draw") made EVERY opponent draw; (3) a gang-up deal outlived the player who made it, so Doc Samson
// offered peace while still "in" a pact against the person and then "broke" it; (4) the computer cast Boon of Boseiju (a helpful pump) on the person's creature.
'use strict';
const path = require('path');
const fs = require('fs');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    const check = (label, ok, detail) => results.push(...formatChecks([[label, ok, detail]]));
    await page.evaluate(async () => {
        const raw = await (await fetch('/__cards.json')).json();
        window.LOCAL = {};
        raw.forEach(c => { if (['Mountain', 'Grizzly Bears', 'Hill Giant', 'Syphon Mind', 'Tyrox, Saurid Tyrant', 'Flumph', 'Boon of Boseiju'].includes(c.name) && !window.LOCAL[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS[sc.id] = sc; window.LOCAL[c.name] = sc; } });
        const C = window.LOCAL;
        const mk = () => ({ name: 'Tyrox (test)', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }, { card: C['Syphon Mind'], n: 1 }], source: 'test' });
        await newGame(mk(), mk(), null, [mk(), mk()]);
        G.active = 0; G.turn = 5; G.phase = 'main1'; G.busy = false; G.firstTurn = false; T.clear();
        G.players.forEach((P, i) => { P.name = 'Seat' + (i + 1); }); // the test decks share a name, so tell the seats apart in the log
    });
    let r = await page.evaluate(async () => {
        const [A, B, Cc, D] = G.players, C = window.LOCAL;
        // 2. "you and target opponent each draw": the person and the ONE chosen opponent, nobody else
        const before = G.players.map(P => P.hand.length), src = makeObj(C['Flumph'], A.i);
        await applyEffect(A, { t: 'drawYouOpp', n: 1, target: 'player', oppOnly: true }, { p: Cc }, src);
        const after = G.players.map(P => P.hand.length);
        const read = JSON.stringify(rulesFor(C['Flumph']));
        // 1. a player who has left draws nothing and logs nothing
        eliminate(B, 'test');
        const logN = G.log.length, lib = B.library.length;
        drawCards(B, 1);
        await applyEffect(A, { t: 'drawAll', n: 1 }, null, src);
        const bad = G.log.slice(logN).map(l => l.text || l).filter(t => t.includes(B.name) && /draw/.test(t));
        // 3. deals with a player who is gone end
        G.deals = [{ type: 'pact', a: 1, b: 3, x: 0, over: false }, { type: 'peace', a: 2, b: 3, over: false }];
        eliminate(D, 'test2');
        return { dHand: after.map((n, i) => n - before[i]), read: /drawYouOpp/.test(read) && !/"drawAll"/.test(read), libSame: B.library.length === lib, bad, pact: G.deals[0].over, peace: G.deals[1].over };
    });
    check('Flumph: you and the one chosen opponent draw, nobody else', r.dHand.join() === '1,0,1,0', r.dHand);
    check('Flumph is read as "you and target opponent", not "each player"', r.read);
    check('a player who has left the game draws nothing and logs nothing', r.libSame && r.bad.length === 0, r);
    check('deals with a player who left end with them (a pact made by or against them, a peace with them)', r.pact && r.peace, r);
    // 4. the computer puts a helpful effect on its own creature
    r = await page.evaluate(async () => {
        await newGame(...(() => { const C = window.LOCAL; const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }, { card: C['Syphon Mind'], n: 1 }], source: 'test' }); return [mk(), mk()]; })());
        G.active = 1; G.turn = 5; G.phase = 'main1'; G.busy = false; T.clear();
        const [A, B] = G.players, C = window.LOCAL;
        const mine = T.put(B, C['Hill Giant']), theirs = T.put(A, C['Grizzly Bears']);
        const e = { t: 'cmd', id: 'sx_boonBoseiju', target: 'creature', good: true };
        const pick = aiPickTarget(B, e, makeObj(C['Boon of Boseiju'], B.i));
        return { owner: pick && pick.o && pick.o.owner, mineOwner: B.i };
    });
    check("the computer puts Boon of Boseiju on its own creature, not the person's", r.owner === r.mineOwner, r);
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    const ok = printResults('elimdraw', results, errors);
    writeOut('elimdraw', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
