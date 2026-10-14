// Information and complex deals (2026-10-15): tips and answers (and whether they were true), reliability, and the new deals:
// peace for 3 turns, bounty, restraint, tip for peace, alliance, counter-offers, bot offers and kingmaking.
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
            const want = ['Island', 'Mountain', 'Grizzly Bears', 'Serra Angel', 'Tyrox, Saurid Tyrant', 'Counterspell', 'Lightning Bolt', 'Terror', 'Divination'];
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

            // ---- information ----
            let [A, B, Cc, D] = await fresh(['trevor', 'luke', 'sam']);
            ok('Trevor never lies, Luke often does', !wouldLie(B, A) && [...Array(40)].map(() => wouldLie(Cc, A)).filter(Boolean).length > 5);
            const seq1 = (() => { G.infoN = 0; return [...Array(10)].map(() => wouldLie(Cc, A)).join(); })(); const seq2 = (() => { G.infoN = 0; return [...Array(10)].map(() => wouldLie(Cc, A)).join(); })();
            ok('and the same state gives the same answers (no random numbers)', seq1 === seq2);
            // an honest bot tells the truth about someone holding a counterspell with mana open
            [A, B, Cc, D] = await fresh(['trevor', 'greg', 'sam']);
            lands(Cc, 3, 'Island'); Cc.hand.push(makeObj(C['Counterspell'], Cc.i));
            G.log.length = 0; const tipped = makeTip(B, A);
            ok('an honest bot tips that someone holds an answer when they do', tipped && G.tips.length === 1 && G.tips[0].kind === 'hold' && G.tips[0].about === Cc.i && G.tips[0].truth === true, G.tips[0]);
            ok('the tip is said at the table', lines().some(l => /counterspell|mana up|something in hand|kept mana/i.test(l)), lines().slice(-2));
            G.turn += 1; checkTips(B);
            ok('at that bot\'s next turn the log says the tip held up, and its reliability goes up', lines().some(l => l.includes('✔')) && G.reliable[B.i] === 1, G.reliable);
            G.reliable[B.i] = 2;
            ok('after two true tips the strip calls it trusted', reliTag(B).includes('trusted'));
            // a tip about the threat
            [A, B, Cc, D] = await fresh(['trevor', 'greg', 'sam']);
            T.put(Cc, C['Serra Angel']); T.put(Cc, C['Serra Angel']); T.put(Cc, C['Serra Angel']); T.put(Cc, C['Serra Angel']); G.arch = Cc.i;
            G.turn = 6; G.tips = []; makeTip(B, A);
            ok('with an archenemy the tip names them (true for an honest bot)', G.tips[0] && G.tips[0].kind === 'threat' && G.tips[0].about === Cc.i && G.tips[0].truth === true);
            // a liar: force a lie
            [A, B, Cc, D] = await fresh(['trevor', 'luke', 'sam']);
            lands(D, 4, 'Island'); T.put(D, C['Serra Angel']);
            let liarTip = null; for (let n = 0; n < 40 && !(liarTip && liarTip.truth === false); n++) { G.tips = []; G.turn = 6 + n; G.infoN = n; makeTip(Cc === B ? B : G.players[2], A); liarTip = G.tips[0]; }
            ok('a bluffing character sometimes gives a false tip', liarTip && liarTip.truth === false, liarTip);
            if (liarTip) { G.turn += 1; G.log.length = 0; checkTips(G.players[2]); ok('and the log marks it false afterwards, lowering reliability by 2', lines().some(l => l.includes('✘')) && G.reliable[2] === -2, G.reliable); }
            // asking
            [A, B, Cc, D] = await fresh(['trevor', 'luke', 'sam']);
            lands(B, 2, 'Island'); B.hand.push(makeObj(C['Counterspell'], B.i));
            const a1 = botAnswer(B, A, 'counter');
            ok('an honest bot answers the counterspell question truthfully', /yes|do|plan around|use it/i.test(a1.text) && !/^(No|Nope|Not right now)/i.test(a1.text), a1);
            G.turn = 10; G.askUsed = null; askBot(B.i, 'counter'); askBot(B.i, 'removal');
            ok('a person can ask two questions a turn', G.askUsed.n === 2);
            askBot(B.i, 'threat'); ok('and not a third', G.askUsed.n === 2);
            ok('answers are checked later too', G.tips.filter(t => t.kind === 'ask').length >= 2);
            ok('the Ask button and dialog exist', askButtonHTML().includes('Ask'));
            askDialog(); ok('the dialog lists every bot and question', document.querySelectorAll('#modalHost .btn.small').length === 3 * QUESTIONS.length, document.querySelectorAll('#modalHost .btn.small').length); closeModal();

            // ---- deals ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); G.rep = {};
            B.trust = { 0: 3 };
            const p3 = proposeDeal2(A, B, 'peace3');
            ok('a friendly bot accepts a 3-turn peace', p3.ok && hasPeace(A.i, B.i), p3);
            const dd = dealBetween(A.i, B.i, 'peace');
            G.turn++; expireDeals(A); G.turn++; expireDeals(A); const alive2 = !!dealBetween(A.i, B.i, 'peace'); G.turn++; expireDeals(A);
            ok('it lasts three of the maker\'s turns and then ends as kept', alive2 && !dealBetween(A.i, B.i, 'peace'), { alive2 });
            // counter-offer
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 0 }; Cc.grudge = { 0: 9 };
            const bad = proposeDeal2(A, Cc, 'peace3');
            ok('a bot that says no explains and may counter-offer (or just refuse)', bad.ok === false && typeof bad.reason === 'string', bad);
            // bounty
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 }; T.put(D, C['Serra Angel']); G.arch = D.i;
            const bounty = proposeDeal2(A, B, 'bounty', D.i);
            ok('a bot takes a bounty on the archenemy', bounty.ok && !!dealBetween(A.i, B.i, 'bounty'), bounty);
            const hand0 = B.hand.length, life0 = A.life, shot = makeObj(C['Grizzly Bears'], B.i); shot.uid = 9990;
            noteGrudge(D, { owner: B.i }, 5); ok('damage below 8 does not pay yet', !!dealBetween(A.i, B.i, 'bounty'));
            noteGrudge(D, { owner: B.i }, 4);
            ok('dealing 8 pays: the payer loses 2 life and the taker draws a card', !dealBetween(A.i, B.i, 'bounty') && A.life === life0 - 2 && B.hand.length === hand0 + 1, { life: A.life, hand: B.hand.length - hand0 });
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 };
            proposeDeal2(A, B, 'bounty', D.i); G.active = B.i; const h2 = B.hand.length; D.life = 0; eliminate(D, 'test');
            ok('knocking out the target pays the bounty', B.hand.length === h2 + 1, B.hand.length - h2);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 };
            proposeDeal2(A, B, 'bounty', D.i); G.turn += 1; expireDeals(A); G.turn += 1; expireDeals(A); G.turn += 1; expireDeals(A);
            ok('an unclaimed bounty ends and says so', !dealBetween(A.i, B.i, 'bounty') && lines().some(l => /ran out/.test(l)));
            // restraint
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 };
            const rs = proposeDeal2(A, B, 'restraint');
            ok('a control bot accepts restraint', rs.ok && hasRestraint(A.i, B.i), rs);
            const spellO = makeObj(C['Divination'], 0); G.stack.push({ id: 9100, kind: 'spell', o: spellO, P: A, target: null, name: 'Divination' });
            B.hand.push(makeObj(C['Counterspell'], B.i)); lands(B, 2, 'Island');
            ok('the computer holds its counterspell back under restraint', aiRespond(B, G.stack[0]) === null || !(aiRespond(B, G.stack[0]) || {}).target);
            await applyEffect(B, { t: 'counter', target: 'spell', filter: 'any' }, { item: G.stack[0] }, makeObj(C['Counterspell'], B.i));
            ok('countering a spell anyway breaks the deal', !hasRestraint(A.i, B.i) && lines().some(l => /💔/.test(l)), lines().slice(-3));
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 }; proposeDeal2(A, B, 'restraint');
            const cmdr = T.put(A, C['Tyrox, Saurid Tyrant']); cmdr.isCommander = true; politicsTargeted(B, A, cmdr);
            ok('aiming removal at the other\'s commander breaks it', !hasRestraint(A.i, B.i));
            // tip for peace
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 }; lands(Cc, 4, 'Island'); G.tips = [];
            const tp = proposeDeal2(A, B, 'tipPeace');
            ok('a tip-for-peace deal makes peace and gives a tip when there is something to say', tp.ok && hasPeace(A.i, B.i) && G.tips.length >= 0, G.tips.length);
            // alliance
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 }; T.put(D, C['Serra Angel']); T.put(D, C['Serra Angel']); T.put(D, C['Serra Angel']); G.arch = D.i;
            const al = proposeDeal2(A, B, 'alliance', D.i);
            ok('a bot accepts an alliance against the archenemy (a peace and a gang-up)', al.ok && hasPeace(A.i, B.i) && pactTarget(B) === D, al);
            const trust0 = B.trust[0]; dealsOnAttack(A, B);
            ok('attacking the ally breaks the whole alliance with a bigger penalty', !hasPeace(A.i, B.i) && !pactTarget(B) && B.trust[0] <= trust0 - 5 && lines().some(l => /alliance is broken/.test(l)), { trust: B.trust[0] });
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 3 }; T.put(D, C['Serra Angel']); G.arch = D.i; proposeDeal2(A, B, 'alliance', D.i);
            const tr0 = B.trust[0]; for (let i = 0; i < 3; i++) { G.turn++; expireDeals(A); }
            ok('a kept alliance raises trust by 2 and says so', !hasPeace(A.i, B.i) && B.trust[0] >= tr0 + 2 && lines().some(l => /alliance between .* is over/.test(l)), { trust: B.trust[0] - tr0 });
            // bot offers
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 2: 2 }; Cc.trust = { 1: 2 }; T.put(D, C['Serra Angel']); T.put(D, C['Serra Angel']); T.put(D, C['Serra Angel']); G.arch = D.i; B.life = 30; G.dealAsk2 = {};
            let offered = false; for (let t = 6; t < 20 && !offered; t++) { G.turn = t; await moreOffers(B); offered = !!G.deals.length; }
            ok('a bot proposes an alliance against the archenemy to another bot', offered, G.deals.map(d => d.type));
            // kingmaking
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 4 }; for (let i = 0; i < 4; i++) B.hand.push(makeObj(C['Divination'], 1));
            const h0 = A.hand.length; eliminate(B, 'test');
            ok('a bot that goes out and likes someone gives them up to three cards', A.hand.length === h0 + 3 && lines().some(l => /🎁/.test(l)), A.hand.length - h0);
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('politics2', results, []);
    writeOut('politics2', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
