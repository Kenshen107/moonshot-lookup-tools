// Infinite mana for any deck and no fixed cap on X / multikicker / replicate (2026-11-19, owner's request).
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
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const names = ['Island', 'Forest', 'Tyrox, Saurid Tyrant', 'Llanowar Elves', 'Staff of Domination', 'Sword of the Paruns', 'Everflowing Chalice', 'Astral Cornucopia', 'Fireball', 'Sol Ring'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A] = G.players;
            const put = n => { const o = makeObj(C[n], A.i); putOntoBattlefield(A, o); o.sick = false; return o; };
            // a dork that taps for six, Staff of Domination: the untap costs 4, so it is infinite
            const dork = put('Llanowar Elves'); Rx(dork).mana = { colors: ['G'], n: 6, fixed: true };
            ok('no loop without an untapper', !genericLoop(A));
            put('Staff of Domination');
            const g = genericLoop(A);
            ok('a creature making 6 with Staff of Domination is a loop', g && /Staff of Domination/.test(g.name), g && g.name);
            Rx(dork).mana = { colors: ['G'], n: 4, fixed: true };
            ok('a creature making only 4 is not (the untap costs 4)', !genericLoop(A));
            Rx(dork).mana = { colors: ['G'], n: 6, fixed: true };
            // a person is offered it; the computer takes it by itself
            A.isAI = false;
            const f = loopOfferFor(A); ok('a person is offered the loop', f && f.on.infinite, f);
            A.isAI = true; A.aiLevel = 'normal';
            await genericGoOff(A);
            ok('the computer goes infinite by itself', infiniteNow(A) && A.pool.length >= 90, A.pool.length);
            // no cap: X, multikicker
            for (let i = 0; i < 4; i++) put('Forest');
            const fb = makeObj(C['Fireball'], A.i); A.hand.push(fb); A.isAI = false;
            const mx = maxX(A, fb); ok('X can be far above 30 with infinite mana', mx > 500, mx);
            const ch = makeObj(C['Everflowing Chalice'], A.i); A.hand.push(ch);
            const mk2 = maxKick(A, ch); ok('multikicker is not capped at 20', mk2 > 500, mk2);
            A.isAI = true; ok('the computer keeps small caps', maxX(A, fb) <= 30 && maxKick(A, ch) <= 20, [maxX(A, fb), maxKick(A, ch)]);
            // without infinite mana the limit is the mana you really have
            A.infMana = 0; A.pool = []; A.isAI = false;
            for (let i = 0; i < 56; i++) put('Forest');
            const ac = makeObj(C['Astral Cornucopia'], A.i); A.hand.push(ac); const mx2 = maxX(A, ac); ok('with real mana X is exactly what you can pay (60 lands, XXX costs 3 each)', mx2 > 15 && mx2 < 30, mx2);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('infmana', results); writeOut('infmana', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
