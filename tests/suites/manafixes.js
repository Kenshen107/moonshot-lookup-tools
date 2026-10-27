// Mana fixes (2026-10-28): Howling Mine and Kami of the Crescent Moon, Yavimaya, Cradle of Growth, Signets.
// Card data comes live from Scryfall; the list is tests/decks/samut-driving-force.txt.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = ['Howling Mine','Kami of the Crescent Moon','Yavimaya, Cradle of Growth','Azorius Signet','Boros Signet','Grizzly Bears','Command Tower','Sol Ring','Mountain'];
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
            const drawN = (P) => P.hand.length;
            // Howling Mine and Kami: the active player draws an additional card
            { const [A, B] = await fresh(); for (const P of [A, B]) for (let i = 0; i < 8; i++) P.library.push(makeObj(have('Plains'), P.i));
              const hm = put(A, 'Howling Mine');
              A.hand.length = 0; B.hand.length = 0;
              G.active = 0; fire('upkeep'); await settle2(); ok('Howling Mine: its controller draws an additional card on their turn', A.hand.length === 1 && B.hand.length === 0, [A.hand.length, B.hand.length]);
              G.active = 1; fire('upkeep'); await settle2(); ok("Howling Mine: the opponent draws an additional card on theirs", B.hand.length === 1, [A.hand.length, B.hand.length]);
              hm.tapped = true; fire('upkeep'); await settle2(); ok('Howling Mine: nothing while it is tapped', B.hand.length === 1, B.hand.length); }
            { const [A, B] = await fresh(); for (const P of [A, B]) for (let i = 0; i < 8; i++) P.library.push(makeObj(have('Plains'), P.i));
              put(A, 'Kami of the Crescent Moon'); A.hand.length = 0; B.hand.length = 0;
              G.active = 1; fire('upkeep'); await settle2(); ok("Kami of the Crescent Moon: the opponent draws an additional card in their draw step", B.hand.length === 1 && A.hand.length === 0, [A.hand.length, B.hand.length]);
              G.active = 0; fire('upkeep'); await settle2(); ok('Kami of the Crescent Moon: and its controller in theirs', A.hand.length === 1, A.hand.length); }
            // Yavimaya
            { const [A, B] = await fresh(); const m = put(A, 'Mountain' in C ? 'Mountain' : 'Plains'); const pl = put(B, 'Plains'); const cmd = put(A, 'Command Tower');
              ok('Before Yavimaya: a Plains makes no green', !manaOf(pl).colors.includes('G'), manaOf(pl));
              put(A, 'Yavimaya, Cradle of Growth');
              ok('Yavimaya: every land (yours and theirs) can tap for {G}', manaOf(pl).colors.includes('G') && manaOf(pl).colors.includes('W') && manaOf(m).colors.includes('G') && manaOf(m).colors.length === 2, [manaOf(pl), manaOf(m)]);
              ok('Yavimaya: a Plains can pay {G}{G}... with two lands', !!planPayment(A, parseCost('{G}{G}')) , 0);
              ok('Yavimaya: not artifacts', !manaOf(put(A, 'Grizzly Bears')), 0); }
            // Signets
            { const [A] = await fresh(); const sig = put(A, 'Azorius Signet'); const pl = put(A, 'Plains');
              ok('Signet is a mana source that costs {1}', manaOf(sig) && manaOf(sig).fee === 1 && manaOf(sig).n === 2 && manaOf(sig).colors.includes('W') && manaOf(sig).colors.includes('U'), manaOf(sig));
                            const p2 = planPayment(A, parseCost('{W}{U}'));
              ok('A Signet and one Plains can pay {U}', !!planPayment(A, parseCost('{U}')), 0);
              ok('A Signet and one Plains pay {W}{U} (Plains pays the {1}, the Signet makes both)', !!p2 && p2.includes(sig) && p2.includes(pl), p2 && p2.map(o => o.card.name));
              const pl2 = put(A, 'Plains');
              ok('Signet + two Plains: {1}{W}{U} is payable', !!planPayment(A, parseCost('{1}{W}{U}')), 0);
              ok('Signet + two Plains: {2}{W}{U} (4 mana) is not', !planPayment(A, parseCost('{2}{W}{U}')), 0);
              const sig2 = put(A, 'Boros Signet'); put(A, 'Plains'); put(A, 'Plains');
              ok('Two Signets and four lands: more mana than lands', !!planPayment(A, parseCost('{4}{R}{U}')), 0); }
            { const [A] = await fresh(); const sig = put(A, 'Azorius Signet'); sig.sick = false;
              ok('A lone Signet pays nothing', !planPayment(A, parseCost('{1}')), 0);
              G.view = 0; A.pool = [];
              tapForMana(sig.uid); ok('By hand: with no mana floating the Signet does not tap', !sig.tapped && (A.pool || []).length === 0, [sig.tapped, A.pool]);
              A.pool = ['W']; tapForMana(sig.uid); ok('By hand: with {W} floating the Signet uses it up and adds {W}{U}', sig.tapped && A.pool.length === 2 && A.pool.includes('W') && A.pool.includes('U'), A.pool); }
            // Whole-deck check that nothing else broke
            { const [A] = await fresh(); const bad = NAMES.filter(n => C[n] && rulesFor(C[n]).support !== 'full'); ok('The cards read as fully Automated', bad.length === 0, bad); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('manafixes', results, []);
    writeOut('manafixes', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
