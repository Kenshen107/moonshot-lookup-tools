// Grizzlegom, Hurloon Hero domain / land deck (2026-11-09): reader checks for the deck (all cards fully Automated, no deck problems, Rulebreaker lands) plus
// behaviour checks for the new engine pieces (spellslinger/rules/grizzlegom.js, 15u-grizzlegom.js). Cards come live from Scryfall.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
const DECK = fs.readFileSync(path.join(ROOT, 'tests', 'decks', 'grizzlegom.txt'), 'utf8');
const NAMES = [...new Set(['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Lightning Bolt', 'Serra Angel', 'Hill Giant', 'Sol Ring',
    ...DECK.split('\n').map(l => (l.match(/^\d+ (.+)$/) || [])[1]).filter(Boolean)])];

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async ([NAMES, DECK]) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.stack.length = 0; G.endQ = []; G.extraCombat = 0; A.isAI = true; B.isAI = true; A.life = 40; B.life = 40; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 30; i++) { A.library.push(makeObj(have('Mountain'), 0)); B.library.push(makeObj(have('Mountain'), 1)); } return [A, B]; };
            const put = (P, n) => { const o = T.put(P, have(n)); o.sick = false; return o; };
            const give = (P, n) => { const o = makeObj(have(n), P.i); P.hand.push(o); return o; };
            const lib = (P, n) => { const o = makeObj(have(n), P.i); P.library.push(o); return o; };
            const settle2 = async () => { await settle(); await settle(); };

            // The deck: no problems (Rulebreaker lets lands ignore the color identity) and every nonland card is fully Automated
            { const v = VERIFIED_DECKS.find(x => x.key === 'grizzlegom'); ok('the deck is listed in VERIFIED_DECKS', !!v);
              const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck); ok('Grizzlegom deck: no deck problems', probs.length === 0, probs.slice(0, 4));
              const cards = [...new Set((deck.entries || []).map(x => x.card).filter(Boolean))]; const bad = cards.filter(c => rulesFor(c).kind !== 'land' && rulesFor(c).support !== 'full').map(c => c.name);
              ok('Grizzlegom deck: every nonland card reads as fully Automated', bad.length === 0, bad);
              const mk = (extra) => ({ name: 'T', format: 'commander', commander: have('Grizzlegom, Hurloon Hero').id, cards: { [have('Watery Grave').id]: 1, ...extra }, source: 'test' });
              ok('Rulebreaker: a white-blue-black land is fine', !deckProblems(mk({})).some(p => /outside/.test(p)), deckProblems(mk({})));
              ok('Rulebreaker only covers lands: Serra Angel is outside the colors', deckProblems(mk({ [have('Serra Angel').id]: 1 })).some(p => /Serra Angel is outside/.test(p))); }
            // Domain count and Fblthp's power
            { const [A] = await fresh(); put(A, 'Temple Garden'); put(A, 'Steam Vents'); const f = put(A, 'Fblthp, Knows the Way'); ok('basic land types among lands you control (Temple Garden + Steam Vents = 4)', pow(f) === 4, pow(f));
              put(A, 'Swamp'); ok('...and a Swamp makes five', pow(f) === 5, pow(f)); }
            // Grizzlegom's attack trigger: one effect per basic land type
            { const [A, B] = await fresh(); const gz = put(A, 'Grizzlegom, Hurloon Hero'); for (let i = 0; i < 2; i++) put(A, 'Plains'); put(A, 'Island'); for (let i = 0; i < 3; i++) put(A, 'Swamp'); for (let i = 0; i < 2; i++) put(A, 'Mountain'); put(A, 'Forest'); put(A, 'Temple Garden');
              const h0 = A.hand.length, c0 = gz.counters, soldiers0 = A.bf.filter(x => x.card.name === 'Soldier').length; await CMD.gz_grizzlegom(A, {}, null, gz); await settle2();
              ok('Grizzlegom: a Soldier for each Plains (Temple Garden counts)', A.bf.filter(x => x.token && /Soldier/.test(x.card.name)).length - soldiers0 === 3, A.bf.filter(x => x.token).length);
              ok('Grizzlegom: draws for each Island', A.hand.length - h0 === 1, A.hand.length - h0);
              ok('Grizzlegom: each opponent loses 1 per Swamp', B.life === 37, B.life);
              ok('Grizzlegom: +1/+1 counters per Mountain', gz.counters - c0 === 2, gz.counters - c0);
              ok('Grizzlegom: gain 1 per Forest (Temple Garden counts)', A.life === 42, A.life); }
            // Fblthp, Knows the Way
            { const [A] = await fresh(); A.library.length = 0; for (const n of ['Forest', 'Forest', 'Island', 'Plains', 'Mountain']) lib(A, n); A.hand.length = 0; const f = put(A, 'Fblthp, Knows the Way'); await CMD.gz_fblthp(A, { x: 3 }, null, f);
              ok('Fblthp: up to X basic lands with different names go to your hand', A.hand.length === 3 && new Set(A.hand.map(c => c.card.name)).size === 3, A.hand.map(c => c.card.name)); }
            // U.S.S. Voyager and Branching Timeline
            { const [A] = await fresh(); A.library.length = 0; for (const n of ['Mountain', 'Forest']) lib(A, n); lib(A, 'Grizzly Bears'); lib(A, 'Lightning Bolt'); lib(A, 'Sol Ring'); const n0 = A.library.length; const v = put(A, 'U.S.S. Voyager, Lone Wanderer'); const b0 = A.bf.length; CMD.gz_voyager(A, {}, null, v);
              ok('U.S.S. Voyager: two lands come in tapped (the library top is the end)', A.bf.length - b0 === 2 && A.bf.slice(-2).every(x => /Land/.test(x.card.type) && x.tapped), A.bf.slice(-2).map(x => x.card.name));
              ok('U.S.S. Voyager: the revealed spells go to the bottom', A.library.length === n0 - 2 && A.library.slice(0, 3).every(c => ['Sol Ring', 'Lightning Bolt', 'Grizzly Bears'].includes(c.card.name)), A.library.slice(0, 3).map(c => c.card.name)); }
            { const [A] = await fresh(); put(A, 'Forest'); put(A, 'Island'); put(A, 'Swamp'); A.library.length = 0; for (const n of ['Mountain', 'Mountain']) lib(A, n); lib(A, 'Lightning Bolt'); lib(A, 'Grizzly Bears'); lib(A, 'Sol Ring'); const s = give(A, 'Mountain'); const b0 = A.bf.length; CMD.gz_timeline(A, {}, null, s);
              const added = A.bf.slice(b0).map(x => x.card.name).sort(); ok('Branching Timeline: reveals one card per differently named land; permanents enter tapped', added.join() === 'Grizzly Bears,Sol Ring' && A.bf.slice(b0).every(x => x.tapped), added);
              ok('...and the instant goes to the bottom', A.library[0].card.name === 'Lightning Bolt' && A.library.length === 3, A.library.map(c => c.card.name)); }
            // Elemental Teachings
            { const [A, B] = await fresh(); A.library.length = 0; for (const n of ['Forest', 'Forest', 'Island', 'Steam Vents', 'Temple Garden']) lib(A, n); const s = give(A, 'Mountain'); const b0 = A.bf.length; await CMD.gz_teachings(A, {}, null, s);
              ok('Elemental Teachings: up to four lands with different names; two enter tapped and two go to the graveyard', A.bf.length - b0 === 2 && A.gy.length === 2 && A.bf.slice(b0).every(x => x.tapped), [A.bf.length - b0, A.gy.map(c => c.card.name)]);
              ok('...the opponent sends the best lands to the graveyard (nonbasics first)', A.gy.every(c => !/\bBasic\b/.test(c.card.type)), A.gy.map(c => c.card.name)); }
            // Escape to the Wilds, Summer Bloom, Through the Forest Gate, Tromp the Domains
            { const [A] = await fresh(); const e = give(A, 'Sol Ring'); const L0 = A.library.length; CMD.gz_escape(A, {}, null, e); ok('Escape to the Wilds: five cards exiled and playable until the end of your next turn', A.exile.length === 5 && A.library.length === L0 - 5 && A.exile.every(x => x.playUntil >= G.turn + 1), [A.exile.length, A.exile[0] && A.exile[0].playUntil]); }
            { const [A] = await fresh(); const l0 = landLimit(A); CMD.gz_summer(A); ok('Summer Bloom: three additional land plays', landLimit(A) === l0 + 3, [l0, landLimit(A)]); CMD.gz_summer(A); ok('...and two Summer Blooms stack', landLimit(A) === l0 + 6, landLimit(A)); }
            { const [A] = await fresh(); A.library.length = 0; for (let i = 0; i < 12; i++) lib(A, 'Grizzly Bears'); for (let i = 0; i < 4; i++) lib(A, 'Forest'); for (let i = 0; i < 6; i++) lib(A, 'Grizzly Bears'); const g = give(A, 'Sol Ring'); const b0 = A.bf.length, l0 = A.life; await CMD.gz_forestGate(A, {}, null, g);
              ok('Through the Forest Gate: the lands from the top twenty enter tapped and you gain 8', A.bf.length - b0 === 4 && A.bf.slice(b0).every(x => x.tapped && /Land/.test(x.card.type)) && A.life === l0 + 8, [A.bf.length - b0, A.life - l0]); ok('...and the rest stays in the library (shuffled)', A.library.length === 18, A.library.length); }
            { const [A] = await fresh(); put(A, 'Temple Garden'); put(A, 'Steam Vents'); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); const p0 = pow(a); CMD.gz_tromp(A); ok('Tromp the Domains: trample and +1/+1 per basic land type (4)', pow(a) === p0 + 4 && has(a, 'trample') && has(b, 'trample'), [pow(a) - p0]); }
            { const [A] = await fresh(); put(A, 'Forest'); put(A, 'Island'); const a = put(A, 'Grizzly Bears'); const p0 = pow(a); CMD.gz_weatherseed(A, {}, { o: a }, null); ok('The Weatherseed Treaty III: +X/+X and trample for the chosen creature', pow(a) === p0 + 2 && has(a, 'trample'), [pow(a) - p0]); }
            // Stable Wormhole's planet, Lavaspur Boots, Full Throttle
            { const [A] = await fresh(); const b0 = A.bf.length; CMD.gz_planet(A, {}, null, null); const pl = A.bf[A.bf.length - 1]; ok('Stable Wormhole: a tapped New Planet land token that taps for any color', A.bf.length === b0 + 1 && pl.card.name === 'New Planet' && pl.tapped && !!manaOf(pl) && /Land/.test(pl.card.type), [pl.card.name, !!manaOf(pl)]); }
            { const bt = have('Lavaspur Boots'); const R = rulesFor(bt); ok('Lavaspur Boots: +1/+0, haste and ward {1}', R.buff && R.buff.p === 1 && R.buff.kw.includes('haste') && R.buff.kw.includes('ward:1'), R.buff); }
            { const [A] = await fresh(); const ft = give(A, 'Full Throttle'); const x = put(A, 'Grizzly Bears'); x.tapped = true; x.attackedTurn = G.turn; CMD.gz_throttle(A); ok('Full Throttle: two additional combat phases', G.extraCombat === 2, G.extraCombat); fire('combat'); ok('...and the creatures that attacked untap at the beginning of each combat', !x.tapped, x.tapped); }
            // A real cast of Fblthp with X = 2 (the X reaches the enters trigger), and the attack triggers fire from a real attack
            { const [A] = await fresh(); A.library.length = 0; for (const n of ['Forest', 'Island', 'Plains', 'Mountain']) lib(A, n); for (let i = 0; i < 4; i++) put(A, 'Forest'); A.hand.length = 0; const f = give(A, 'Fblthp, Knows the Way'); f.xVal = 2; await castSpell(A, f); await settle2(); await settle2();
              ok('Fblthp cast with X=2 searches for two basic lands', onBf(f.uid) && A.hand.length === 2 && new Set(A.hand.map(c => c.card.name)).size === 2, [onBf(f.uid), A.hand.map(c => c.card.name)]); }
            { const [A, B] = await fresh(); const gz = put(A, 'Grizzlegom, Hurloon Hero'); put(A, 'Swamp'); put(A, 'Swamp'); put(A, 'Stable Wormhole'); const b0 = A.bf.length; G.phase = 'declareAttackers'; await declareAttackers(A, [gz]); await settle2(); await settle2();
              ok('Grizzlegom attacks: the opponent loses 1 life per Swamp', B.life === 38, B.life); ok('Stable Wormhole: attacking makes the New Planet', A.bf.some(x => x.card.name === 'New Planet'), A.bf.slice(b0).map(x => x.card.name)); }
            ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [NAMES, DECK]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('grizzlegom', results, []);
    writeOut('grizzlegom', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
