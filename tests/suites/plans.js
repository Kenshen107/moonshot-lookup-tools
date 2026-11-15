// Computer game plans and ability guards (2026-11-15, spellslinger/15y-ai-plans.js): Mutavault animates once per turn, Doc Samson's loop fires and gives mana, payoffs wait for
// the engine, engine pieces score higher, plans can be turned off, the engine creature stays home. Cards come from the offline card file.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const NAMES = ['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Mutavault', 'Firdoch Core', 'Doc Samson, Super Psychiatrist', 'Staff of Domination', 'Umbral Mantle', 'Hardened Scales',
    'Hydra Broodmaster', 'Maturation Chamber', 'Aetheric Amplifier', 'Dal R\'El, Augment Orphan', 'Sol Ring', 'Kalonian Hydra', 'Hill Giant'];
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
              await planGoOff(A); ok('going off puts 16 mana in the pool and logs the loop', (A.pool || []).length >= 16 && G.log.some(l => /loops/.test(l)) && A.planLoopTurn === G.turn, [(A.pool || []).length]); }
            { const [A, B] = await fresh(); const s = put(A, 'Doc Samson, Super Psychiatrist'); s.isCommander = true; A.planKey = undefined; const m = put(A, 'Umbral Mantle'); lands(A, 'Forest', 6); m.attachedTo = s.uid;
              const lp = DECK_PLANS['Doc Samson, Super Psychiatrist'].loops[0].online(A); ok('Samson loop is online with the Umbral Mantle attached at power 3+', !!lp && lp.pump === 20, [pow(s), lp && lp.pump]); }
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
