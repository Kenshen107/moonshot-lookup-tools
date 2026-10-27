// Second commanders (2026-10-27): Partner, Partner with, Friends forever, Father & Son, Background, Doctor's companion.
// Card data comes live from Scryfall; the list is tests/decks/samut-driving-force.txt.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = ['Thrasios, Triton Hero','Tymna the Weaver','Pir, Imaginative Rascal','Toothy, Imaginary Friend','Othelm, Sigardian Outcast',"Wernog, Rider's Chaplain",'Wilson, Refined Grizzly','Raised by Giants','Kratos, Stoic Father','Atreus, Impulsive Son','The Second Doctor','Ace, Fearless Rebel','Grizzly Bears','Hill Giant','Sol Ring'];
    // the Othelm deck's cards come with the verified list
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest']);
            manaMode = 'auto';
            window.pickCard = async (P, list) => list[0];
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; A.isAI = true; B.isAI = true; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 20; i++) { A.library.push(makeObj(have('Island'), 0)); B.library.push(makeObj(have('Island'), 1)); } A.life = 20; B.life = 20; return [A, B]; };
            const put = (P, n, extra) => T.put(P, have(n), extra);
            const inGy = (P, n) => { const o = makeObj(have(n), P.i); P.gy.push(o); return o; };
            const inHand = (P, n) => { const o = makeObj(have(n), P.i); P.hand.push(o); return o; };
            const inLib = (P, n) => { const o = makeObj(have(n), P.i); P.library.push(o); return o; };
            const lands = (P, k, n = 'Plains') => { for (let i = 0; i < k; i++) T.put(P, have(n)); };
            const settle2 = async () => { await settle(); await settle(); };
            const spell = async (P, o, t) => { o.kicked = !!(t && t.kicked); await resolveEffects(P, spellEffects(o), t && t.target ? t.target : null, o); await settle2(); };
            const acts = o => Rx(o).acts || [];

            // ---- TESTS ----
            const kind = (a, b) => pairKind(have(a), have(b));
            // which pairs are legal
            ok('Partner: Thrasios and Tymna', kind('Thrasios, Triton Hero', 'Tymna the Weaver') === 'Partner', kind('Thrasios, Triton Hero', 'Tymna the Weaver'));
            ok('Partner with: Pir and Toothy', kind('Pir, Imaginative Rascal', 'Toothy, Imaginary Friend') === 'Partner with', kind('Pir, Imaginative Rascal', 'Toothy, Imaginary Friend'));
            ok('Partner with: not with another partner', kind('Pir, Imaginative Rascal', 'Tymna the Weaver') === null, kind('Pir, Imaginative Rascal', 'Tymna the Weaver'));
            ok('Friends forever: Othelm and Wernog', /Friends forever/.test(kind('Othelm, Sigardian Outcast', "Wernog, Rider's Chaplain") || ''), kind('Othelm, Sigardian Outcast', "Wernog, Rider's Chaplain"));
            ok('Father & Son: Kratos and Atreus', /Father & Son/i.test(kind('Kratos, Stoic Father', 'Atreus, Impulsive Son') || ''), kind('Kratos, Stoic Father', 'Atreus, Impulsive Son'));
            ok('Different Partner kinds do not pair', kind('Thrasios, Triton Hero', 'Othelm, Sigardian Outcast') === null && kind('Othelm, Sigardian Outcast', 'Kratos, Stoic Father') === null, 0);
            ok('Background: Wilson and Raised by Giants', kind('Wilson, Refined Grizzly', 'Raised by Giants') === 'Choose a Background', kind('Wilson, Refined Grizzly', 'Raised by Giants'));
            ok('Background: a Background is not a commander by itself', !canBeCommander(have('Raised by Giants')), 0);
            ok("Doctor's companion: the Second Doctor and Ace", kind('The Second Doctor', 'Ace, Fearless Rebel') === "Doctor's companion", [kind('The Second Doctor', 'Ace, Fearless Rebel'), have('The Second Doctor').type]);
            ok('A card does not pair with itself or with ordinary cards', kind('Wilson, Refined Grizzly', 'Wilson, Refined Grizzly') === null && kind('Wilson, Refined Grizzly', 'Grizzly Bears') === null, 0);
            // deck colors and rules
            const mk = (c1, c2, extra) => ({ id: 'x', name: 'x', format: 'commander', cards: {}, commander: have(c1).id, commander2: c2 ? have(c2).id : null, starter: true, ...extra });
            { const d = mk('Thrasios, Triton Hero', 'Tymna the Weaver'); const ci = deckCi(d); ok('Deck colors are both commanders\' together', ['G', 'U', 'W', 'B'].every(c => ci.includes(c)) && ci.length === 4, ci); ok('Both commanders count toward the 100', deckCount(d) === 2, deckCount(d)); }
            { const d = mk('Thrasios, Triton Hero', 'Othelm, Sigardian Outcast'); ok('An illegal pair is a problem', deckProblems(d).some(p => /can't lead a deck together/.test(p)), deckProblems(d).slice(0, 3)); }
            { const d = mk('Wilson, Refined Grizzly', 'Raised by Giants'); ok('A legal pair is no problem', !deckProblems(d).some(p => /together|can't be a commander/.test(p)), deckProblems(d).slice(0, 3)); }
            // builder
            {
                const d = { id: 'b', name: 'b', format: 'commander', cards: { [have('Raised by Giants').id]: 1, [have('Tymna the Weaver').id]: 1 }, commander: have('Thrasios, Triton Hero').id, commander2: null, starter: true };
                editing = d;
                setSecondCommander(have('Tymna the Weaver').id);
                ok('Builder: a partner becomes the second commander and leaves the main deck', d.commander2 === have('Tymna the Weaver').id && !d.cards[have('Tymna the Weaver').id], [d.commander2, d.cards]);
                setSecondCommander(have('Raised by Giants').id);
                ok('Builder: a Background that does not pair is refused', d.commander2 === have('Tymna the Weaver').id, d.commander2);
                unsetCommander(have('Tymna the Weaver').id);
                ok('Builder: removing the second commander puts it back in the main deck', !d.commander2 && d.cards[have('Tymna the Weaver').id] === 1, [d.commander2, d.cards]);
                setCommander(have('Wilson, Refined Grizzly').id); setCommander(have('Raised by Giants').id);
                ok('Builder: making a Background "commander" puts it in the second slot', d.commander === have('Wilson, Refined Grizzly').id && d.commander2 === have('Raised by Giants').id, [d.commander, d.commander2]);
                editing = null;
            }
            // a pasted list: the partner in the list becomes the second commander
            {
                const g = await listToOppDeck("1 Thrasios, Triton Hero\n1 Tymna the Weaver\n" + '1 Sol Ring\n1 Grizzly Bears\n1 Hill Giant\n\n1 Thrasios, Triton Hero\n', 'commander');
                ok('Pasted list: the partner in the 99 is found as the second commander', g.commander && g.commander2 && g.commander2.name === 'Tymna the Weaver', [g.commander && g.commander.name, g.commander2 && g.commander2.name]);
            }
            // the verified Othelm and Wernog deck has both commanders
            {
                const v = VERIFIED_DECKS.find(x => x.key === 'othelm');
                const gen = await listToOppDeck(v.text, 'commander');
                ok('Othelm and Wernog deck: both are commanders', gen.commander && gen.commander2 && [gen.commander.name, gen.commander2.name].sort().join('|') === "Othelm, Sigardian Outcast|Wernog, Rider's Chaplain", [gen.commander && gen.commander.name, gen.commander2 && gen.commander2.name]);
                const deck = generatedToDeck(gen, 'x');
                ok('Othelm and Wernog deck: exactly 100 cards with no problems', deckCount(deck) === 100 && deckProblems(deck).length === 0, [deckCount(deck), deckProblems(deck).slice(0, 3)]);
            }
            // the game: both start in the command zone, with their own tax and commander damage
            {
                const mkDeck = () => ({ name: 'two', format: 'commander', commander: have('Thrasios, Triton Hero'), commander2: have('Tymna the Weaver'), entries: [{ card: have('Plains'), n: 40 }] });
                const [A, B] = await T.newGame();
                const P = makePlayer(0, 'Two', mkDeck(), true);
                ok('Game: both commanders start in the command zone', P.command.length === 2 && P.command.every(c => c.isCommander), P.command.map(c => c.card.name));
                ok('Game: the second one has its own slot', P.command[0].cmdSlot === 0 && P.command[1].cmdSlot === 1, P.command.map(c => c.cmdSlot));
                P.cmdCastN[0] = 1; P.tax = 1;
                const c0 = P.command[0], c1 = P.command[1];
                ok('Tax: only the commander cast before costs more', extraCost(P, c0) === 2 && extraCost(P, c1) === 0, [extraCost(P, c0), extraCost(P, c1)]);
                ok('Colors: identity is both commanders\' together', cmdrIdentity(P).length === 4, cmdrIdentity(P));
            }
            // commander damage is counted per commander
            {
                const [A, B] = await fresh();
                const mkDeck = () => ({ name: 'two', format: 'commander', commander: have('Thrasios, Triton Hero'), commander2: have('Tymna the Weaver'), entries: [{ card: have('Plains'), n: 40 }] });
                const P2 = makePlayer(1, 'Two', mkDeck(), true); G.players[1] = P2; G.format = 'commander';
                const a = makeObj(have('Hill Giant'), 0, { isCommander: true, cmdSlot: 0 }), b = makeObj(have('Grizzly Bears'), 0, { isCommander: true, cmdSlot: 1 });
                A.bf.push(a, b);
                damage(P2, 12, a); damage(P2, 12, b);
                ok('Commander damage: 12 from each of two commanders is not 21', P2.cmdDmg === 12 && P2.life > 0 && !G.players[1].out, [P2.cmdDmg, P2.cmdBy]);
                damage(P2, 9, a);
                ok('Commander damage: 21 from one of them is lethal', P2.cmdDmg === 21, P2.cmdDmg);
            }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('partners', results, []);
    writeOut('partners', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
