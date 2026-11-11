// Grouped triggers and Spacecraft (2026-10-31): identical triggers from same-named permanents share one stack line; Spacecraft with printed power and toughness become creatures at their top tier.
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
            const raw = await (await fetch('/__cards.json')).json();
            const C = {};
            raw.forEach(c => { if (['Tyrox, Saurid Tyrant', 'Mountain', 'Scute Swarm', 'Starship Enterprise', 'Forest', "Teferi's Tutelage"].includes(c.name) && !C[c.name]) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
            await newGame(mk(), mk());
            const [A, B] = G.players;
            T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; A.isAI = true; B.isAI = true;
            // Spacecraft: every ship with printed power and toughness is a creature at its top tier
            const seen = new Set(), bad = [];
            for (const c of raw.filter(x => /Spacecraft/.test(x.type_line || '') && !/Token/.test(x.type_line))) {
                if (seen.has(c.name)) continue; seen.add(c.name);
                const sc = slimCard(c); CARDS.set(sc.id, sc); T.clear(); const o = T.put(A, sc); await settle(); const R = Rx(o);
                o.ctr.charge = Math.max(0, ...(R.stationTiers || [0]));
                const hasPT = Number.isFinite(parseFloat(sc.power));
                if (hasPT && !isCreature(o)) bad.push(c.name);
                if (!hasPT && isCreature(o)) bad.push(c.name + ' (should not be a creature)');
            }
            ok('every Spacecraft with printed P/T is an artifact creature at its top tier (' + seen.size + ' checked)', bad.length === 0, bad);
            window.__GROUP_TRIGGERS = true; // grouping is off in autoplay and the lab, so the test turns it on
            // Grouped triggers: three Scute Swarms and a land make one stack line
            T.clear(); G.stack.length = 0;
            const sw = [1, 2, 3].map(() => { const o = T.put(A, C['Scute Swarm']); o.sick = false; return o; });
            await settle(); await settle(); G.stack.length = 0; A.bf.filter(o => o.token).forEach(o => pull(A.bf, o));
            const n0 = A.bf.length;
            const land = makeObj(C['Forest'], A.i); A.hand.push(land);
            const p = playLand(A, land); await p;
            ok('three Scute Swarm triggers share one stack line', G.stack.filter(it => it.kind === 'trigger').length <= 1, G.stack.map(it => it.name));
            await settle(); await settle();
            ok('all three still resolve: three Insect tokens are made', A.bf.filter(o => o.token).length >= 3, A.bf.filter(o => o.token).length);
            // A crowd: twelve Swarms and a land make one stack line, twelve tokens and one summary log line
            T.clear(); G.stack.length = 0; G.log.length = 0;
            for (let i = 0; i < 12; i++) { const o = T.put(A, C['Scute Swarm']); o.sick = false; }
            await settle(); await settle(); G.stack.length = 0; A.bf.filter(o => o.token).forEach(o => pull(A.bf, o)); G.log.length = 0;
            const land2 = makeObj(C['Forest'], A.i); A.hand.push(land2); await playLand(A, land2); await flushTriggers();
            const lines = G.stack.filter(it => it.kind === 'trigger').length;
            await settle(); await settle();
            ok('twelve Scute Swarm triggers are one stack line', lines <= 1, lines);
            ok('they all resolve (twelve new tokens) with one summary line', A.bf.filter(o => o.token).length === 12 && G.log.filter(l => /triggers resolved/.test(l)).length === 1, [A.bf.filter(o => o.token).length, G.log.filter(l => /Scute Swarm/.test(l)).length]);
            // Teferi's Tutelage: six cards drawn make six triggers (one per drawn card) that merge into one line and still mill twelve (2026-11-11)
            T.clear(); G.stack.length = 0; G.log.length = 0; A.library.length = 0; A.gy.length = 0; B.library.length = 0; B.gy.length = 0;
            for (let i = 0; i < 40; i++) { A.library.push(makeObj(C['Mountain'], A.i)); B.library.push(makeObj(C['Mountain'], B.i)); }
            T.put(A, C["Teferi's Tutelage"]); await settle(); G.stack.length = 0; const lib0 = B.library.length;
            drawCards(A, 6); await flushTriggers();
            const tl = G.stack.filter(it => it.kind === 'trigger').length;
            ok("six cards drawn with Teferi's Tutelage: one stack line, not six", tl <= 1, [tl, G.stack.map(it => it.name)]);
            await settle(); await settle();
            ok('...and the six triggers still mill 12 cards from the opponent', B.library.length === lib0 - 12, [lib0, B.library.length]);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('stackgroup', results, []);
    writeOut('stackgroup', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
