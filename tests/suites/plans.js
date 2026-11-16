// Computer game plans and ability guards (2026-11-15, spellslinger/15y-ai-plans.js): Mutavault animates once per turn, Doc Samson's loop fires and gives mana, payoffs wait for
// the engine, engine pieces score higher, plans can be turned off, the engine creature stays home. Cards come from the offline card file.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const NAMES = ['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Mutavault', 'Firdoch Core', 'Doc Samson, Super Psychiatrist', 'Staff of Domination', 'Umbral Mantle', 'Hardened Scales',
    'Hydra Broodmaster', 'Maturation Chamber', 'Aetheric Amplifier', 'Dal R\'El, Augment Orphan', 'Sol Ring', 'Kalonian Hydra', 'Hill Giant', 'Super-Skrull', 'Urianger Augurelt', 'Serra Angel', 'Surestrike Trident'];
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async (NAMES) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 8; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.stack.length = 0; G.endQ = []; G.delayed = []; A.isAI = true; B.isAI = true; A.aiLevel = 'normal'; return [A, B]; };
            const put = (P, n) => { const o = T.put(P, have(n)); o.sick = false; return o; };
            const lands = (P, n, k) => { for (let i = 0; i < k; i++) T.put(P, have(n)); };
            const settle2 = async () => { await settle(); await settle(); };

            // Ability guards
            { const [A] = await fresh(); lands(A, 'Forest', 6); const m = put(A, 'Mutavault'); await aiUseAbilities(A); await settle2();
              const used = A.bf.filter(x => /Forest/.test(x.card.name) && x.tapped).length; ok('Mutavault: animated once, not every time ({1} spent once)', m.animated && m.animated.turn === G.turn && used <= 1, [used]); }
            { const [A] = await fresh(); lands(A, 'Forest', 6); const f = put(A, 'Maturation Chamber'); const t0 = A.bf.length; await aiUseAbilities(A); await settle2(); ok('Maturation Chamber: not used with no charge counters', A.bf.length === t0 && !f.tapped, [A.bf.length, t0]); }
            { const [A] = await fresh(); lands(A, 'Forest', 4); put(A, 'Aetheric Amplifier'); const g = put(A, 'Grizzly Bears'); await aiUseAbilities(A); await settle2(); ok('Aetheric Amplifier: not used with nothing to double', A.bf.filter(x => x.tapped && /Forest/.test(x.card.name)).length === 0); }
            { const [A] = await fresh(); lands(A, 'Forest', 4); const d = put(A, 'Dal R\'El, Augment Orphan'); A.hand.push(makeObj(have('Hill Giant'), A.i)); const n0 = A.bf.filter(x => /Land/.test(x.card.type)).length; await aiUseAbilities(A); await settle2(); ok('Dal R\'El: does not sacrifice lands early', A.bf.filter(x => /Land/.test(x.card.type)).length === n0); }

            // Plans: Doc Samson
            { const [A, B] = await fresh(); const c = makeObj(have('Doc Samson, Super Psychiatrist'), A.i, { isCommander: true }); A.command.length = 0; A.command.push(c); A.planKey = undefined;
              ok('plan found by commander name', planOf(A) && /Combo/.test(planOf(A).win), planOf(A) && planOf(A).win.slice(0, 20));
              ok('plan sets the deck\'s playstyle', A.aiStyle === 'ramp', A.aiStyle); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; putCounters(s, 4, A); const staff = put(A, 'Staff of Domination'); lands(A, 'Forest', 6);
              const lp = DECK_PLANS['Doc Samson, Super Psychiatrist'].loops[0].online(A);
              ok('Samson loop is online with Staff of Domination at power 5+', !!lp && pow(s) >= 5, [pow(s)]);
              s.tapped = true; ok('Samson loop needs Samson untapped', !DECK_PLANS['Doc Samson, Super Psychiatrist'].loops[0].online(A)); s.tapped = false; s.sick = true; ok('Samson loop needs him not summoning sick', !DECK_PLANS['Doc Samson, Super Psychiatrist'].loops[0].online(A)); s.sick = false;
              await planGoOff(A); ok('going off gives infinite mana for the turn and logs the loop', A.infMana === G.turn && G.log.some(l => /infinite mana/.test(l)) && A.planLoopTurn === G.turn, [A.infMana, (A.pool || []).length]);
              const n0 = A.pool.length; let paid = 0; for (let i = 0; i < 30; i++) { const plan = planPayment(A, parseCost('{3}{R}{G}{U}')); if (!plan) break; plan.forEach(x => tapSource(A, x)); paid++; }
              ok('the mana never runs out: 30 payments of {3}{R}{G}{U}, the pool is unchanged', paid === 30 && A.pool.length === n0, [paid, n0, A.pool.length]);
              ok('a cost far past the old 16-mana pool can be paid', !!planPayment(A, parseCost('{G}{G}{G}{G}{G}{G}{G}{G}{G}{G}{G}{G}{G}{G}{G}{20}')), []);
              G.turn++; emptyPools(); ok('the infinite mana ends with the turn', !infiniteNow(A) && (A.pool || []).length === 0, [(A.pool || []).length]); G.turn--; }
            { const [A, B] = await fresh(); A.isAI = false; const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; putCounters(s, 4, A); put(A, 'Staff of Domination');
              ok('a person is offered the loop when the combo is online', !!loopOfferFor(A) && A.loopAsked !== G.turn);
              await offerLoop(A); ok('saying yes to the offer gives a person infinite mana', A.infMana === G.turn && A.loopAsked === G.turn, [A.infMana]); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; const m = put(A, 'Umbral Mantle'); lands(A, 'Forest', 6); m.attachedTo = s.uid;
              const lp = DECK_PLANS['Doc Samson, Super Psychiatrist'].loops[0].online(A); ok('Samson loop is online with the Umbral Mantle attached at power 3+', !!lp && lp.pump === 999 && lp.infinite, [pow(s), lp && lp.pump]); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; put(A, 'Grizzly Bears'); lands(A, 'Forest', 6);
              ok('no loop without an untapper', !DECK_PLANS['Doc Samson, Super Psychiatrist'].loops[0].online(A)); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; put(A, 'Staff of Domination'); lands(A, 'Forest', 4); putCounters(s, 3, A);
              A.hand.push(makeObj(have('Hydra Broodmaster'), A.i)); A.hand.push(makeObj(have('Hardened Scales'), A.i)); A.hand.push(makeObj(have('Grizzly Bears'), A.i));
              const hs = A.hand.find(x => x.card.name === 'Hardened Scales'), hb = A.hand.find(x => x.card.name === 'Hydra Broodmaster');
              const on = aiScoreBase(A, hs); A.tune = { plans: 0 }; const off = aiScoreBase(A, hs); delete A.tune;
              ok('engine pieces (Hardened Scales) score higher with the plan', on >= off + 4, [on, off]); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; lands(A, 'Forest', 3);
              const hb = makeObj(have('Hydra Broodmaster'), A.i); A.hand.push(hb); const held = aiScoreBase(A, hb); A.tune = { plans: 0 }; const plain = aiScoreBase(A, hb); delete A.tune;
              ok('payoffs (Hydra Broodmaster) wait for the engine', held <= plain * 0.6 + 0.01, [held, plain]);
              lands(A, 'Forest', 6); put(A, 'Hardened Scales'); const ready = aiScoreBase(A, hb); ok('payoffs are cast once the engine runs', ready > held, [ready, held]); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; put(A, 'Grizzly Bears'); put(B, 'Hill Giant'); B.life = 40; s.sick = false;
              const ch = aiChooseAttackers(A); ok('the engine creature stays home unless the attack is lethal', !ch.some(o => o.card.name === 'Doc Samson, Super Psychiatrist'), ch.map(o => o.card.name)); }
            // Infinite mana wins: Samson + Staff of Domination + Surestrike Trident kills every opponent in a pod
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; putCounters(s, 4, A); put(A, 'Staff of Domination'); lands(A, 'Forest', 6);
              A.hand.push(makeObj(have('Surestrike Trident'), A.i)); for (let i = 0; i < 20; i++) { A.library.push(makeObj(have('Forest'), A.i)); B.library.push(makeObj(have('Forest'), B.i)); } B.life = 40; put(B, 'Grizzly Bears');
              await aiMain(A); await settle2();
              ok('infinite mana with Staff, Samson and a Trident in hand kills the opponent', B.life <= 0 || G.over || B.out, [B.life, G.over, B.out]); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; putCounters(s, 4, A); put(A, 'Staff of Domination'); lands(A, 'Forest', 6);
              for (let i = 0; i < 25; i++) A.library.push(makeObj(have('Forest'), A.i)); A.library.splice(A.library.length - 8, 0, makeObj(have('Surestrike Trident'), A.i)); B.life = 40; put(B, 'Grizzly Bears'); for (let i = 0; i < 20; i++) B.library.push(makeObj(have('Forest'), B.i));
              await aiMain(A); await settle2();
              ok('with the Trident buried in the library it draws with the Staff loop, casts it and wins', B.life <= 0 || G.over || B.out, [B.life, G.over, B.out, A.library.length]); }
            // Super-Skrull: mana goes into draw four first
            { const [A, B] = await fresh(); const sk = put(A, 'Super-Skrull'); sk.isCommander = true; A.planKey = undefined; lands(A, 'Island', 3); lands(A, 'Plains', 3); lands(A, 'Mountain', 3); for (let i = 0; i < 12; i++) A.library.push(makeObj(have('Forest'), A.i)); put(B, 'Grizzly Bears');
              const h0 = A.hand.length; await aiUseAbilities(A); await settle2();
              ok('Super-Skrull: with mana to spare the computer draws four before small removal', A.hand.length - h0 === 4 && B.bf.length === 1, [A.hand.length - h0, B.bf.length]);
              ok('Super-Skrull plan: ramp playstyle', A.aiStyle === 'ramp', A.aiStyle); }
            // Urianger: Play Arcanum first when cards wait in exile, Draw Arcanum afterwards
            { const [A, B] = await fresh(); const u = put(A, 'Urianger Augurelt'); u.isCommander = true; A.planKey = undefined; lands(A, 'Plains', 3); lands(A, 'Island', 2);
              const sa = makeObj(have('Serra Angel'), A.i); sa.slUri = u.uid; sa.playUntil = -1; A.exile.push(sa); for (let i = 0; i < 12; i++) A.library.push(makeObj(have('Forest'), A.i));
              await aiMain(A); await settle2();
              ok('Urianger: Play Arcanum, then Serra Angel (5 mana) is cast from exile for 3', u.tapped && A.bf.some(x => x.card.name === 'Serra Angel'), [u.tapped, A.bf.map(x => x.card.name).join()]);
              const [A2] = await fresh(); const u2 = put(A2, 'Urianger Augurelt'); u2.isCommander = true; A2.planKey = undefined; lands(A2, 'Plains', 3); for (let i = 0; i < 12; i++) A2.library.push(makeObj(have('Forest'), A2.i));
              const lib0 = A2.library.length; await aiMain(A2); await settle2();
              ok('Urianger: with nothing waiting he uses Draw Arcanum', u2.tapped && A2.exile.some(c => c.slUri === u2.uid) && A2.library.length === lib0 - 1, [u2.tapped, A2.exile.length, lib0 - A2.library.length]); }
            { const [A, B] = await fresh(); const x = put(A, 'Grizzly Bears'); A.planKey = undefined; ok('a deck with no plan is untouched', planOf(A) === null); }
        } catch (e) { out.push(['suite threw: ' + e.message, false, e.stack && e.stack.split('\n').slice(0, 3)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('plans', results, []);
    writeOut('plans', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
