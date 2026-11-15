// Two rules fixes (2026-11-15, owner): targets are chosen as part of casting (not when the spell resolves), and cancelling out of combat back to the first main
// phase walks every beginning-of-combat trigger and ability back. spellslinger/15x-casting.js
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const NAMES = ['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Goblin Rabblemaster', 'Raise Dead', 'Blood Beckoning', 'Hapatra, the Desert Fang', 'Druid Class', 'Restorative Technique', 'Gravedigger'];
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async ([NAMES]) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.view = 0; G.busy = false; G.stack.length = 0; G.endQ = []; G.delayed = []; G.attackers = []; G.blocks = {}; A.isAI = true; B.isAI = true; A.life = 40; B.life = 40; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 30; i++) { A.library.push(makeObj(have('Mountain'), 0)); B.library.push(makeObj(have('Mountain'), 1)); } A.hand.length = 0; B.hand.length = 0; return [A, B]; };
            const put = (P, n) => { const o = T.put(P, have(n)); o.sick = false; return o; };
            const settle2 = async () => { await settle(); await settle(); };
            window.__PRE_FORCE = true;
            const realPick = window.pickCard; let calls = [];
            const stubPick = pickIdx => { window.__pickBase = async (P, pool, prompt, opts) => { calls.push({ prompt, stack: G.stack.length, n: pool.length, bf: G.players[0].bf.map(c => c.card.name) }); return pool[Math.min(pickIdx, pool.length - 1)] || null; }; };

            // ----- Checkpoint -----
            { const [A, B] = await fresh(); const g = put(A, 'Grizzly Bears'); A.hand.push(makeObj(have('Hill Giant'), 0)); A.pool = ['R', 'R']; const ck = slCheckpoint();
              const tok = put(A, 'Hill Giant'); g.counters = 3; g.tapped = true; g.ctr.shield = 2; g.tkw.push('haste'); drawCards(A, 2); A.life = 12; A.pool = []; A.library.pop(); log('a line'); G.slx = 1; A.gy.push(makeObj(have('Serra Angel'), 0));
              slRestore(ck);
              ok('Checkpoint: zones are back (battlefield, hand, library, graveyard)', A.bf.length === 1 && A.bf[0] === g && A.hand.length === 1 && A.library.length === 30 && A.gy.length === 0, [A.bf.length, A.hand.length, A.library.length, A.gy.length]);
              ok('Checkpoint: counters, tapped state, keywords, life and mana pool are back', g.counters === 0 && !g.tapped && !g.ctr.shield && g.tkw.length === 0 && A.life === 40 && A.pool.length === 2, [g.counters, g.tapped, A.life, A.pool]);
              ok('Checkpoint: new fields are removed and the battlefield cache is fresh', G.slx === undefined && allPerms().length === 1, allPerms().length); }
            // ----- Cancelling combat -----
            { const [A, B] = await fresh(); A.isAI = false; const rm = put(A, 'Goblin Rabblemaster'); const gb = put(A, 'Grizzly Bears'); A.pool = ['R']; const before = A.bf.length;
              await goToCombat(); await settle2(); const during = A.bf.length;
              ok('Going to combat fires the beginning-of-combat trigger (Rabblemaster makes a Goblin) and opens the attack step', during === before + 1 && G.phase === 'declareAttackers', [before, during, G.phase]);
              cancelAttack(); await settle2();
              ok('Cancelling the attack walks it back: the Goblin token is gone, mana pool is back, we are in main phase 1 and combat can start again', A.bf.length === before && G.phase === 'main1' && G.combatFired === false && A.pool.length === 1, [A.bf.length, G.phase, G.combatFired, A.pool]);
              await goToCombat(); await settle2(); ok('Going to combat again fires the trigger once more (one Goblin, not two)', A.bf.filter(x => x.token).length === 1, A.bf.filter(x => x.token).length);
              cancelAttack(); }
            // ----- Targets are chosen as the spell is cast -----
            { const [A, B] = await fresh(); A.isAI = false; const rd = makeObj(have('Raise Dead'), 0); A.gy.push(makeObj(have('Grizzly Bears'), 0), makeObj(have('Serra Angel'), 0)); calls = []; stubPick(1);
              const pc = await preChoose(A, rd, spellEffects(rd)); ok('Raise Dead: the card is chosen at cast time (before it is on the stack) as a target', pc && pc.pre.length === 1 && pc.pre[0].card.name === 'Serra Angel' && calls.length === 1 && calls[0].stack === 0, [calls.length, pc && pc.pre.length]);
              G.curMulti = pc; calls = []; await applyChoiceEffect(A, spellEffects(rd)[0], rd); G.curMulti = null;
              ok('Raise Dead: resolving it uses that choice and asks nothing more', calls.length === 0 && A.hand.some(x => x.card.name === 'Serra Angel') && !A.hand.some(x => x.card.name === 'Grizzly Bears'), [calls.length, A.hand.map(x => x.card.name)]);
              // the target leaves before it resolves: it does nothing
              const pc2 = await preChoose(A, rd, spellEffects(rd)); const goner = pc2.pre[0]; A.gy.splice(A.gy.indexOf(goner), 1); G.curMulti = pc2; A.hand.length = 0; calls = []; await applyChoiceEffect(A, spellEffects(rd)[0], rd); G.curMulti = null;
              ok('Raise Dead: if the chosen card has left the graveyard it does nothing (and asks nothing)', calls.length === 0 && A.hand.length === 0, [calls.length, A.hand.length]); }
            { const [A, B] = await fresh(); A.isAI = false; const bb = makeObj(have('Blood Beckoning'), 0); bb.kicked = true; A.gy.push(makeObj(have('Grizzly Bears'), 0), makeObj(have('Hill Giant'), 0), makeObj(have('Serra Angel'), 0)); calls = []; stubPick(0);
              const pc = await preChoose(A, bb, [cmd('sl_beckon')]); ok('Blood Beckoning (kicked): two creature cards are chosen at cast time', pc && pc.cmd.sl_beckon.length === 2 && calls.length === 2 && calls.every(c => c.stack === 0), calls.length);
              G.curMulti = pc; calls = []; await CMD.sl_beckon(A, {}, null, bb); G.curMulti = null; ok('Blood Beckoning: resolving returns exactly those two and asks nothing', calls.length === 0 && A.hand.length === 2, [calls.length, A.hand.length]); }
            { const [A, B] = await fresh(); A.isAI = false; const ha = put(A, 'Hapatra, the Desert Fang'); const t1 = put(B, 'Serra Angel'); put(B, 'Hill Giant'); A.gy.push(makeObj(have('Serra Angel'), 0)); calls = []; stubPick(0);
              const pc = await preChoose(A, ha, [cmd('sl_hapatra')]); ok('Hapatra: the target creature is chosen as the trigger goes on the stack', pc && calls.length === 1 && calls[0].stack === 0 && pc.cmd.sl_hapatra[B.i], calls.length);
              G.curMulti = pc; calls = []; await CMD.sl_hapatra(A, {}, null, ha); G.curMulti = null; ok('Hapatra: resolving puts the counters on the chosen creature without asking again', calls.length === 0 && Object.values(pc.cmd.sl_hapatra)[0].counters === -5, calls.length); }
            { const [A, B] = await fresh(); A.isAI = false; manaMode = 'auto'; const rd = makeObj(have('Raise Dead'), 0); A.hand.push(rd); put(A, 'Swamp'); put(A, 'Swamp'); A.gy.push(makeObj(have('Grizzly Bears'), 0), makeObj(have('Serra Angel'), 0)); calls = []; stubPick(1);
              await humanCast(rd.uid); await settle2();
              ok('Casting Raise Dead as a person: the graveyard card is asked for once, during the cast (nothing on the stack yet), and not again when it resolves', calls.length === 1 && calls[0].stack === 0 && A.hand.some(x => x.card.name === 'Serra Angel') && !A.hand.some(x => x.card.name === 'Grizzly Bears'), [calls.length, calls[0] && calls[0].stack, A.hand.map(x => x.card.name)]); }
            { const [A, B] = await fresh(); const rd = makeObj(have('Raise Dead'), 0); A.gy.push(makeObj(have('Grizzly Bears'), 0)); A.isAI = true; calls = []; stubPick(0); const pc = await preChoose(A, rd, spellEffects(rd)); ok('The computer is not asked (it picks the same way at resolution)', pc === null && calls.length === 0); }
            // ----- The dry run: the remaining resolve-time picks happen at cast time -----
            { const [A, B] = await fresh(); A.isAI = false; const src = makeObj(have('Raise Dead'), 0); A.gy.push(makeObj(have('Grizzly Bears'), 0)); B.gy.push(makeObj(have('Serra Angel'), 0), makeObj(have('Hill Giant'), 0)); calls = []; stubPick(1);
              const logs0 = G.log.length, gy0 = A.gy.length + B.gy.length, ex0 = A.exile.length + B.exile.length;
              const pc = await preChoose(A, src, [{ t: 'reaper' }]); ok('Dry run: a "choose a creature card from a graveyard" effect asks the person at cast time, once', pc && pc.tq && pc.tq[0].length === 1 && calls.length === 1 && calls[0].stack === 0, [calls.length, pc && pc.tq]);
              ok('Dry run: nothing it did stays (cards, log) after the checkpoint is restored', A.gy.length + B.gy.length === gy0 && A.exile.length + B.exile.length === ex0 && G.log.length === logs0, [A.gy.length + B.gy.length, G.log.length - logs0]);
              const chosen = pc.tq[0][0]; G.curMulti = pc; G.curPickQ = pc.tq[0].slice(); calls = []; await applyEffect(A, { t: 'reaper' }, null, src); G.curPickQ = null; G.curMulti = null;
              ok('Dry run: resolving exiles exactly the card chosen at cast time and asks nothing more', calls.length === 0 && (A.exile.includes(chosen) || B.exile.includes(chosen)), [calls.length, chosen && chosen.card.name]); }
            // ----- "When ~ enters" targets are not chosen when the creature spell is cast, only when it enters -----
            { const [A, B] = await fresh(); A.isAI = false; manaMode = 'auto'; const gd = makeObj(have('Gravedigger'), 0); A.hand.push(gd); for (let i = 0; i < 4; i++) put(A, 'Swamp'); A.gy.push(makeObj(have('Serra Angel'), 0)); calls = []; stubPick(0);
              await humanCast(gd.uid); const atCast = calls.length; const stackAtCast = calls[0] ? calls[0].stack : null; await settle2();
              ok('Gravedigger: its "when this enters" target is asked only once the creature is on the battlefield (as the trigger goes on the stack), not when the spell is cast', calls.length === 1 && calls[0].bf.includes('Gravedigger') && calls[0].stack === 0 && A.hand.some(x => x.card.name === 'Serra Angel'), [calls.length, calls[0] && calls[0].bf, calls[0] && calls[0].stack]); }
            // ----- Every DRY_CMD id: a dry run never throws and never leaves anything behind -----
            { const [A, B] = await fresh(); A.isAI = false; const src = put(A, 'Grizzly Bears'); put(A, 'Serra Angel'); put(B, 'Hill Giant'); put(B, 'Grizzly Bears');
              ['Serra Angel', 'Hill Giant', 'Raise Dead', 'Grizzly Bears'].forEach(n => { A.gy.push(makeObj(have(n), 0)); B.gy.push(makeObj(have(n), 1)); A.hand.push(makeObj(have(n), 0)); });
              stubPick(0); const sig = () => JSON.stringify([A.bf.length, A.hand.length, A.gy.length, A.library.length, A.exile.length, B.bf.length, B.gy.length, B.hand.length, B.library.length, B.exile.length, A.life, B.life, G.log.length, G.stack.length, (A.pool || []).length, A.bf.map(x => x.counters + ':' + x.tapped)]);
              const before = sig(); const bad = []; let asked = 0;
              for (const id of DRY_CMD) { calls = []; try { await preChoose(A, src, [{ t: 'cmd', id }]); } catch (err) { bad.push(id + ': ' + err.message); } if (calls.length) asked++; if (sig() !== before) { bad.push(id + ': changed the game'); break; } }
              ok(`Dry run over all ${DRY_CMD.size} cast-time pick CMDs: none throws or changes the game (${asked} of them asked for a pick here)`, bad.length === 0 && window.__DRY == null, bad.slice(0, 5)); }
            window.__pickBase = null;
            ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [NAMES]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('casting', results, []);
    writeOut('casting', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
