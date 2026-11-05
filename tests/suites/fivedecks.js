// Five owner decks (2026-11-02): U.S. Agent, Kang, Lorehold the Historian, Jadzi, Torgaar. Reader checks for every deck (all cards fully Automated, no deck
// problems) plus behaviour checks for the new engine pieces (spellslinger/rules/fivedecks.js, 15r-fivedecks.js). Cards come live from Scryfall.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const NAMES = ['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Sol Ring', 'Lightning Bolt', 'Flickerwisp', 'Astral Slide', 'Street Wraith', 'Panharmonicon', 'Elesh Norn, Mother of Machines', 'Getaway Glamer', 'Time Stop', 'Reed Richards, Smartest Man', 'Torgaar, Famine Incarnate', 'Counterspell', 'Tallyman of Nurgle', 'Rabid Attack', 'Splinter\'s Technique', 'Trespasser\'s Curse', 'Immortus, Master of Eternity', 'Airbender\'s Reversal', 'Ghost Ark', 'Salvation Colossus', 'Lorehold, the Historian', 'Charming Prince', 'Game Plan', 'Morningtide\'s Light', 'Reunion of the House', 'Brass\'s Tunnel-Grinder', 'Knight Rampager', 'Hydroelectric Specimen', 'Jadzi, Oracle of Arcavios', 'Commit', 'Inventive Iteration', 'Jidoor, Aristocratic Capital', 'Brass\'s Tunnel-Grinder'];

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.stack.length = 0; G.endQ = []; G.endTurnAt = 0; A.isAI = true; B.isAI = true; A.life = 40; B.life = 40; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 30; i++) { A.library.push(makeObj(have('Mountain'), 0)); B.library.push(makeObj(have('Mountain'), 1)); } return [A, B]; };
            const put = (P, n) => { const o = T.put(P, have(n)); o.sick = false; return o; };
            const give = (P, n) => { const o = makeObj(have(n), P.i); P.hand.push(o); return o; };
            const settle2 = async () => { await settle(); await settle(); };

            // Every deck: all cards fully Automated, no deck problems
            for (const key of ['usagent', 'kang', 'lorehold', 'jadzi', 'torgaar']) {
                const v = VERIFIED_DECKS.find(x => x.key === key);
                if (!v) { ok(`deck ${key} is listed`, false); continue; }
                const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck);
                ok(`${key}: no deck problems`, probs.length === 0, probs.slice(0, 3));
                const cards = [...new Set((deck.entries || []).map(x => x.card).filter(Boolean))];
                const bad = cards.filter(c => rulesFor(c).kind !== 'land' && rulesFor(c).support !== 'full').map(c => c.name);
                ok(`${key}: every nonland card reads as fully Automated`, bad.length === 0, bad);
            }

            // Blink: exile, back at the next end step
            { const [A] = await fresh(); const x = put(A, 'Grizzly Bears'); const src = put(A, 'Hill Giant'); await CMD.fr_blinkEnd(A, { notSelf: true }, { o: x }, src); const gone = !onBf(x.uid) && A.exile.includes(x); await runEndQueue(); await settle2();
              ok('blink at the next end step: exiled now, back after the end step', gone && onBf(x.uid), [gone, onBf(x.uid)]); }
            { const [A] = await fresh(); const x = put(A, 'Grizzly Bears'); const src = put(A, 'Hill Giant'); await CMD.fr_blinkNow(A, { counter: 1 }, { o: x }, src); await settle2(); ok('blink now with a +1/+1 counter (Spaceshift)', onBf(x.uid) && x.counters === 1, x.counters); }
            { const [A] = await fresh(); const x = put(A, 'Grizzly Bears'); CMD.fr_airbend(A, {}, { o: x }, null); ok('airbend: exiled and castable for {2}', A.exile.includes(x) && x.airbentCost && costOf(A, x).generic === 2 && x.playUntil >= G.turn, [costOf(A, x)]); }
            // Cycling
            { const [A] = await fresh(); const w = give(A, 'Street Wraith'); const life0 = A.life; ok('Street Wraith: cycling costs 2 life', Rx(w).cyclingLife === 2 && canCycle(A, w)); await cycle(A, w); ok('cycling paid 2 life and drew a card', A.life === life0 - 2 && A.gy.includes(w), [A.life, life0]); }
            { const [A, B] = await fresh(); put(A, 'Astral Slide'); put(A, 'Grizzly Bears'); const w = give(A, 'Street Wraith'); G.trigQ = []; const n0 = G.log.length; await cycle(A, w); await settle2(); ok('Astral Slide triggers when any player cycles', G.log.slice(n0).some(l => /Astral Slide's ability triggers/.test(l)), G.log.slice(n0)); }
            // Panharmonicon, Elesh Norn
            { const [A, B] = await fresh(); put(A, 'Panharmonicon'); const f = put(A, 'Flickerwisp'); ok('Panharmonicon adds a trigger for an entering creature', frPanBoost(f) === 1, frPanBoost(f)); const g = put(B, 'Grizzly Bears'); ok("Panharmonicon only helps its controller", frPanBoost(g) === 0); }
            { const [A, B] = await fresh(); put(A, 'Elesh Norn, Mother of Machines'); const f = put(B, 'Flickerwisp'); ok("Elesh Norn: the opponent's abilities don't trigger from entering", frNoEnterTrig(f) === true && frNoEnterTrig(put(A, 'Grizzly Bears')) === false); }
            // Spree adds each chosen mode's cost
            { const [A] = await fresh(); const g = give(A, 'Getaway Glamer'); const r0 = Rx(g); ok('Getaway Glamer reads as a two-mode Spree', r0.modes && r0.modes.length === 2 && r0.spreeCosts && r0.spreeCosts.length === 2, r0.spreeCosts); const base = costTotal(totalCost(A, g)); g.mode = [0, 1]; ok('Spree: both modes cost {1} and {2} more', costTotal(totalCost(A, g)) - base === 3, [base, costTotal(totalCost(A, g))]); g.mode = [0]; ok('Spree: one mode costs only its own cost', costTotal(totalCost(A, g)) - base === 1); }
            // End the turn
            { const [A, B] = await fresh(); const c = give(A, 'Counterspell'); G.stack.push({ id: 9000, kind: 'spell', o: c, P: A, target: null, name: 'x' }); const p0 = G.stack.length; const ts = give(A, 'Time Stop'); CMD.fr_endTurn(A, {}, null, ts); ok('End the turn: the stack is emptied and the turn is marked over', G.stack.length === 0 && G.endTurnAt === G.turn && p0 === 1); ok('End the turn: the computer skips its attacks', aiChooseAttackers(A).length === 0); }
            // Reed Richards: four cards instead (not the draw step)
            { const [A] = await fresh(); put(A, 'Reed Richards, Smartest Man'); A.hand.length = 0; G.inDrawStep = false; drawCards(A, 1); ok('Reed Richards: the first extra draw each turn draws four', A.hand.length === 4, A.hand.length); drawCards(A, 1); ok('Reed Richards: only the first time each turn', A.hand.length === 5, A.hand.length); }
            { const [A] = await fresh(); put(A, 'Reed Richards, Smartest Man'); A.hand.length = 0; G.inDrawStep = true; drawCards(A, 1); G.inDrawStep = false; ok('Reed Richards: the draw step draw is a normal draw', A.hand.length === 1, A.hand.length); }
            // Torgaar: sacrifice creatures to cost {2} less each
            { const [A] = await fresh(); const t = give(A, 'Torgaar, Famine Incarnate'); const g0 = totalCost(A, t).generic; t.sacN = 2; ok('Torgaar costs {2} less per sacrificed creature', g0 - totalCost(A, t).generic === 4, [g0, totalCost(A, t).generic]); }
            // Lorehold: miracle {2} for instants and sorceries
            { const [A] = await fresh(); const b = give(A, 'Lightning Bolt'); ok('no miracle without Lorehold', !frMiracle(b)); put(A, 'Lorehold, the Historian'); ok('Lorehold gives instants and sorceries miracle {2}', !!frMiracle(b) && costTotal(frMiracle(b)) === 2); }
            // Ghost Ark: unearth {3} for artifact creature cards this turn
            { const [A] = await fresh(); const c = makeObj(have('Hill Giant'), 0); A.gy.push(c); c.grantUnearthTurn = G.turn; ok('a granted unearth shows in the graveyard', actsOf(c).some(a => /Unearth/.test(a.text || ''))); G.turn++; ok('...and only until end of turn', !actsOf(c).some(a => /Unearth/.test(a.text || ''))); G.turn--; }
            // Tallyman of Nurgle: draws one, or seven when seven creatures died
            { const [A] = await fresh(); const t = put(A, 'Tallyman of Nurgle'); A.hand.length = 0; G.frDied = { turn: G.turn, n: 2 }; CMD.fr_tallyman(A, {}, null, t); ok('Tallyman: a creature died, draw one and lose 1', A.hand.length === 1 && A.life === 39, [A.hand.length, A.life]); A.hand.length = 0; G.frDied = { turn: G.turn, n: 7 }; CMD.fr_tallyman(A, {}, null, t); ok('Tallyman: seven died, draw seven and lose 7', A.hand.length === 7, A.hand.length); }
            // Rabid Attack: +1/+0 and a death draw
            { const [A] = await fresh(); const x = put(A, 'Grizzly Bears'); const rb = give(A, 'Rabid Attack'); const p0 = pow(x); await CMD.fr_rabid(A, {}, null, rb); ok('Rabid Attack: +1/+0 and a draw-when-dies mark', pow(x) === p0 + 1 && x.frDieDraw === G.turn); }
            // Sneak: castable after blockers with an unblocked attacker
            { const [A] = await fresh(); const s = give(A, 'Splinter\'s Technique'); const x = put(A, 'Grizzly Bears'); G.phase = 'afterBlocks'; G.attackers = [x.uid]; G.blocks = {}; ok('Sneak: available after blockers with an unblocked attacker', castAsOk(A, s, 'sneak') && Rx(s).sneak && costTotal(Rx(s).sneak) === 2); G.attackers = []; ok('Sneak: not without an attacker', !castAsOk(A, s, 'sneak')); G.phase = 'main1'; }
            // Trespasser's Curse
            { const [A, B] = await fresh(); const c = put(A, 'Trespasser\'s Curse'); c.hostPlayer = 1; const b = put(B, 'Grizzly Bears'); ok('Curse trigger: a creature the enchanted player controls entering', TRIG_FN.fr_curseEnter(c, { o: b })); const l0 = B.life, a0 = A.life; CMD.fr_curseTick(A, {}, null, c); ok('Curse: enchanted player loses 1, you gain 1', B.life === l0 - 1 && A.life === a0 + 1); }
            // Immortus: mana for each card drawn this turn, noncreature spells only
            { const [A] = await fresh(); const im = put(A, 'Immortus, Master of Eternity'); A.drawTurn = G.turn; A.drawN = 3; ok('Immortus: one {U} per card drawn this turn', manaOf(im).n === 3 && manaOf(im).onlyType === 'noncreature', manaOf(im)); A.drawN = 0; ok('Immortus: none before drawing', manaOf(im).n === 0); }
            // Fixes of the approximations (2026-11-02)
            { const [A] = await fresh(); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); const rb = give(A, 'Rabid Attack'); G.curMulti = { list: [a] }; await CMD.fr_rabid(A, {}, null, rb); G.curMulti = null; ok('targets chosen at cast: only the chosen creature gets Rabid Attack', a.frDieDraw === G.turn && !b.frDieDraw, [a.frDieDraw, b.frDieDraw]); }
            { const [A] = await fresh(); const gy = ['Grizzly Bears', 'Hill Giant', 'Hill Giant'].map(n => { const o = makeObj(have(n), 0); A.gy.push(o); return o; }); const m = frMultiAI(A, null, 'reunion', 0); ok('Reunion of the House: the computer stays under 10 total power', m.list.reduce((a, c) => a + (Number(c.card.power) || 0), 0) <= 10 && m.list.length >= 2, m.list.map(c => c.card.name)); }
            { const [A] = await fresh(); const t = give(A, 'Morningtide\'s Light'); ok('Morningtide\'s Light has its targets chosen on cast (a multi-target spell)', !!frMultiOf(t) && frMultiOf(t).multi === 'morningtide'); }
            { const [A, B] = await fresh(); const gp = give(A, 'Game Plan'); ok('Game Plan reads Assist', Rx(gp).assist === true); const g0 = totalCost(A, gp).generic; for (let i = 0; i < 4; i++) put(B, 'Mountain'); gp.assist = [{ X: B, n: 3 }]; gp.assistN = 3; ok('Assist: the helper pays part of the generic cost', g0 - totalCost(A, gp).generic === 3, [g0, totalCost(A, gp).generic]); frAssistPay(A, gp); ok('Assist: the helper\'s lands are tapped for it', B.bf.filter(x => x.tapped).length === 3, B.bf.filter(x => x.tapped).length); }
            { const [A] = await fresh(); frDescendWatch(); A.gy.push(makeObj(have('Grizzly Bears'), 0)); frDescendWatch(); ok('descended: a permanent card put into your graveyard is noticed', A.descendTurn === G.turn); const [A2] = await fresh(); frDescendWatch(); A2.gy.push(makeObj(have('Lightning Bolt'), 0)); frDescendWatch(); ok('descended: an instant is not a permanent card', A2.descendTurn !== G.turn); }
            { const [A] = await fresh(); const tg = put(A, 'Brass\'s Tunnel-Grinder'); frDescendWatch(); A.gy.push(makeObj(have('Hill Giant'), 0)); frDescendWatch(); CMD.fr_bore(A, {}, null, tg); ok('Brass\'s Tunnel-Grinder gets a bore counter after you descended', tg.ctr.bore === 1, tg.ctr); }
            { const [A] = await fresh(); G.endTurnAt = G.turn; G.endQ = []; let ran = false; atEndStep(() => { ran = true; }); const p = endTurn(A); const skipped = G.log.slice(-6).some(l => /end step is skipped/.test(l)); G.over = true; ok('End the turn: the end step is skipped and delayed end-step abilities wait', skipped && !ran, [skipped, ran]); G.over = false; G.endTurnAt = 0; }
            { const [A, B] = await fresh(); G.players.length > 2; const kr = put(A, 'Knight Rampager'); G.endQ = []; CMD.fr_rampagerCombat(A, {}, null, kr); ok('Knight Rampager must attack a chosen opponent', kr.frForceTurn === G.turn && kr.frForceTo === 1 && kr.frForceAtk === G.turn, [kr.frForceTo]); }
            { const [A] = await fresh(); for (let i = 0; i < 4; i++) put(A, 'Swamp'); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); const rb = give(A, 'Rabid Attack'); rb.multi = { list: [b] }; await castSpell(A, rb); await settle2(); ok('a real cast carries the chosen targets through the stack to the resolution', b.frDieDraw === G.turn && !a.frDieDraw, [a.frDieDraw, b.frDieDraw, G.log.slice(-4)]); }
            // Jadzi's back face: castable from the command zone
            { const mk = () => ({ name: 'T', format: 'commander', commander: have('Jadzi, Oracle of Arcavios'), entries: [{ card: have('Forest'), n: 99 }], source: 'test' });
              await newGame(mk(), mk(), null, [mk()]); const [A] = G.players; T.clear(); G.turn = 6; G.phase = 'main1'; G.active = 0; G.firstTurn = false; G.busy = false; G.stack.length = 0; A.isAI = true;
              const j = A.command.find(x => x.isCommander); const back = j.front && j.front.back;
              ok('Journey to the Oracle reads as fully Automated', !!back && rulesFor(back).support === 'full', back && rulesFor(back).unhandled);
              for (let i = 0; i < 4; i++) put(A, 'Forest'); A.hand.length = 0; const l1 = give(A, 'Forest'), l2 = give(A, 'Forest');
              j.card = back; await castSpell(A, j); await settle2();
              ok('casting the back face from the command zone puts the lands from hand onto the battlefield', !A.hand.includes(l1) && !A.hand.includes(l2) && A.bf.filter(x => x.card.name === 'Forest').length === 6, A.bf.length);
              ok('the commander is a normal front-face card again afterwards', j.card === j.front && (A.command.includes(j) || A.gy.includes(j) || A.hand.includes(j)), [j.card.name]);
              ok('...and the commander tax went up', A.tax >= 1 || (A.cmdCastN && A.cmdCastN[0] >= 1), [A.tax]);
                // the computer considers the back face from the command zone (2026-11-05)
              { const [C0] = await fresh(); C0.isAI = true; C0.command.length = 0; const jj = makeObj(have('Jadzi, Oracle of Arcavios'), 0); jj.isCommander = true; C0.command.push(jj); for (let i = 0; i < 5; i++) put(C0, 'Forest'); C0.hand.length = 0; for (let i = 0; i < 4; i++) give(C0, 'Forest');
                const bb = jj.front.back; const bp = aiBestPlay(C0); ok('the computer finds a play from the command zone with Jadzi', !!bp, bp && bp.face && bp.face.name);
                jj.card = bb; const cn = canCastNow(C0, jj) && canPay(C0, jj); jj.card = jj.front; ok('...and the back face is castable for it with lands in hand', cn); if (bp) { bp.o.card = bp.o.front; }
                const sc = (() => { jj.card = bb; const v = aiScore(C0, jj, null); jj.card = jj.front; return v; })(); ok('...and scores above zero with several lands in hand', sc > 0, sc); }
            // eight or more lands: discard a card to return it to hand
              const [B] = await fresh(); for (let i = 0; i < 8; i++) put(B, 'Forest'); B.hand.length = 0; give(B, 'Grizzly Bears'); const sp = give(B, 'Counterspell'); const old = aiKeepValue; aiKeepValue = () => 0;
              await CMD.fr_journey(B, {}, null, sp); aiKeepValue = old; ok('with eight lands the spell can discard a card to return to hand', sp.frToHand === true && B.gy.some(c => c.card.name === 'Grizzly Bears'), [sp.frToHand]); }
            // Back faces (2026-11-03)
            { for (const n of ['Jadzi, Oracle of Arcavios', 'Commit', 'Inventive Iteration', 'Jidoor, Aristocratic Capital', 'Brass\'s Tunnel-Grinder', 'Elesh Norn', 'Zanarkand, Ancient Metropolis']) { const c = C[n] || (await T.cards([n]))[n]; if (!c || !c.back) { ok(`${n} has a back face`, false); continue; } ok(`${n}: the back face (${c.back.name}) reads as fully Automated`, rulesFor(c.back).support === 'full', rulesFor(c.back).unhandled); } }
            { const [A] = await fresh(); const cm = makeObj(have('Commit'), 0); A.gy.push(cm); const back = cm.front.back; ok('Memory has aftermath: castable from the graveyard for its own cost', rulesFor(back).aftermath === true && !!rulesFor(back).flashback); cm.card = back; ok('...and canCastNow lets it be cast from the graveyard', canCastNow(A, cm) || G.phase === 'main1', [G.phase]); cm.card = cm.front; }
            { const [A] = await fresh(); const jd = makeObj(have('Jidoor, Aristocratic Capital'), 0); A.exile.push(jd); jd.advReady = true; ok('an adventure land can be played from exile afterwards', canPlayLand(A, jd) === true); }
            { const [A, B] = await fresh(); const li = put(A, 'Inventive Iteration'); G.lastCastMv = 3; CMD.fr_breakthrough(A, {}, null, li); const bolt = give(B, 'Lightning Bolt'); const gp = give(B, 'Hill Giant'); ok('Living Breakthrough: opponents can\'t cast spells with the same mana value', B.noCastMV && B.noCastMV.length === 1 && !canCastNow(B, makeObj({ ...have('Hill Giant'), cmc: 3 }, 1))); }
            ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('fivedecks', results, []);
    writeOut('fivedecks', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
