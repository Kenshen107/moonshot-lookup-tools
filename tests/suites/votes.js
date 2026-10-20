// Character habits, taunts and compliments, the draw offer, revenge pacts between bots, remembered rivalries and the Tap all lands button (2026-10-20).
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
            const want = ['Island', 'Mountain', 'Grizzly Bears', 'Serra Angel', 'Tyrox, Saurid Tyrant', 'Counterspell', 'Lightning Bolt', 'Terror', 'Divination', "Council's Judgment", "Tyrant's Choice", 'Capital Punishment', 'Plea for Power', "Selvala's Stampede", 'Split Decision', 'Magister of Worth', 'Orchard Elemental', 'Coercive Portal', "Brago's Representative", 'Ballot Broker', 'Grudge Keeper', 'Model of Unity'];
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

            const friends = (A) => G.players.forEach(P => { if (P !== A) { P.trust = { [A.i]: 3 }; } });
            const run = async (id, A, extra) => applyEffect(A, cmd(id, extra || {}), null, T.put(A, C['Island']));
            // ---- the cards read as fully automated ----
            const names = ["Council's Judgment", "Tyrant's Choice", 'Capital Punishment', 'Plea for Power', "Selvala's Stampede", 'Split Decision', 'Magister of Worth', 'Orchard Elemental', 'Coercive Portal', "Brago's Representative", 'Ballot Broker', 'Grudge Keeper', 'Model of Unity'];
            ok('every voting card is read as fully automated', names.every(n => C[n] && rulesFor(C[n]).support === 'full'), names.filter(n => !C[n] || rulesFor(C[n]).support !== 'full'));
            // ---- Tyrant's Choice ----
            let [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            [B, Cc, D].forEach(F => T.put(F, C['Grizzly Bears']));
            G.log.length = 0; await run('voteTyrant', A);
            ok("opponents who don't like the caster vote for the lesser pain: torture wins and each loses 4 life", [B, Cc, D].every(F => F.life === 36) && B.bf.some(o => o.card.name === 'Grizzly Bears'), [B.life, Cc.life, D.life]);
            ok('every vote is in the log', lines().filter(l => /🗳️/.test(l)).length >= 5, lines().slice(-6));
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); [B, Cc, D].forEach(F => T.put(F, C['Grizzly Bears'])); friends(A);
            await run('voteTyrant', A);
            ok('players who like the caster vote with the caster: death wins and each opponent sacrifices a creature', [B, Cc, D].every(F => !F.bf.some(o => o.card.name === 'Grizzly Bears') && F.life === 40), [B.life, B.bf.length]);
            // ---- Capital Punishment ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); [B, Cc, D].forEach(F => { T.put(F, C['Grizzly Bears']); F.hand.push(makeObj(C['Divination'], F.i)); }); friends(A);
            const h0 = B.hand.length; await run('voteCapital', A);
            ok('Capital Punishment counts every vote (death sacrifices, taxes discards)', B.bf.every(o => o.card.name !== 'Grizzly Bears') || B.hand.length < h0, { bf: B.bf.length, hand: B.hand.length });
            // ---- Plea for Power ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A); G.extra = G.players.map(() => 0);
            await run('votePlea', A);
            ok('friends let the caster take the extra turn', G.extra[A.i] === 1, G.extra);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); G.extra = G.players.map(() => 0); const hh = A.hand.length;
            await run('votePlea', A);
            ok('a table that does not like the caster gives them the cards instead (knowledge wins 3 to 1)', G.extra[A.i] === 0 && A.hand.length === hh + 3, { extra: G.extra[A.i], hand: A.hand.length - hh });
            // ---- extra votes ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); T.put(A, C["Brago's Representative"]); T.put(B, C['Ballot Broker']);
            const vr = await holdVote(A, null, 'plea');
            ok("Brago's Representative and Ballot Broker each give their controller a second vote", vr.cast.filter(c => c.X === A).length === 2 && vr.cast.filter(c => c.X === B).length === 2 && vr.cast.length === 6, vr.cast.length);
            // ---- Grudge Keeper ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); T.put(A, C['Grudge Keeper']);
            const lives = G.players.map(P => P.life); await run('votePlea', A);
            ok('Grudge Keeper: each opponent who voted for a choice the keeper did not vote for loses 2 life', [B, Cc, D].every(F => F.life === 38) && A.life === 40, G.players.map(P => P.life));
            // ---- Council's Judgment ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            const angel = T.put(B, C['Serra Angel']); const bears = T.put(Cc, C['Grizzly Bears']); const mine = T.put(A, C['Serra Angel']);
            await run('voteJudgment', A);
            ok("Council's Judgment exiles the permanent the caster and their friends voted for, never the caster's own", !B.bf.includes(angel) && B.exile.includes(angel) && A.bf.includes(mine) && Cc.bf.includes(bears), { angelGone: !B.bf.includes(angel), bears: Cc.bf.includes(bears) });
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const a2 = T.put(B, C['Serra Angel']); T.put(Cc, C['Grizzly Bears']); T.put(D, C['Grizzly Bears']);
            await run('voteJudgment', A);
            ok('a split vote exiles every tied permanent (at least one thing leaves)', allPerms().filter(o => o.card.name !== 'Island' && o.owner !== A.i).length < 3, allPerms().length);
            // ---- Orchard Elemental ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            const orch = T.put(A, C['Orchard Elemental']); const life0 = A.life;
            await applyEffect(A, cmd('voteOrchard'), null, orch);
            ok('Orchard Elemental: four sprout votes put eight counters on it', orch.counters === 8 && A.life === life0, { c: orch.counters, life: A.life });
            // ---- Coercive Portal ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            const portal = T.put(A, C['Orchard Elemental']); const hp = A.hand.length;
            await applyEffect(A, cmd('voteCarnage'), null, portal);
            ok('Coercive Portal: friends vote homage and the controller draws a card', A.hand.length === hp + 1 && A.bf.includes(portal), A.hand.length - hp);
            // ---- Magister of Worth ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const mag = T.put(A, C['Serra Angel']); [B, Cc, D].forEach(F => T.put(F, C['Serra Angel']));
            await applyEffect(A, cmd('voteMagister'), null, mag);
            ok('Magister of Worth: a table full of creatures votes for condemnation and everything else dies', A.bf.includes(mag) && [B, Cc, D].every(F => !F.bf.some(o => o.card.name === 'Serra Angel')), G.players.map(P => P.bf.length));
            // ---- Split Decision ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            const sp = makeObj(C['Divination'], B.i); const item = { id: 9101, kind: 'spell', o: sp, P: B, target: null, name: 'Divination' }; G.stack.push(item);
            await applyEffect(A, cmd('voteSplit', { target: 'spell', filter: 'instant or sorcery' }), { item }, makeObj(C['Split Decision'], A.i));
            ok("Split Decision: friends back the caster's denial and the spell is countered", !G.stack.includes(item) || lines().some(l => /counter/i.test(l)), lines().slice(-3));
            // ---- Selvala's Stampede ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            for (let i = 0; i < 6; i++) A.library.push(makeObj(C['Serra Angel'], A.i));
            const libN = A.library.length; await run('voteStampede', A);
            ok("Selvala's Stampede puts creatures from the library onto the battlefield (wild votes) with no hang", A.bf.filter(o => o.card.name === 'Serra Angel').length >= 1 && A.library.length < libN, A.bf.length);
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('votes', results, []);
    writeOut('votes', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
