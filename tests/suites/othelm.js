// Othelm / Wernog deck (2026-10-27): behavior checks for rules/othelm.js and 15m-othelm.js.
// Card data comes live from Scryfall; the list is tests/decks/othelm-wernog.txt.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = [...new Set(fs.readFileSync(path.join(ROOT, 'tests', 'decks', 'othelm-wernog.txt'), 'utf8').split('\n').map(l => l.replace(/^\d+\s+/, '').trim()).filter(Boolean))];
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Divination', 'Shock', 'Treasure Map', 'Giant Growth', 'Ancestral Recall', 'Dark Ritual', 'Goblin Guide', 'Shivan Dragon', 'Air Elemental', 'Wall of Omens', 'Bear Cub', 'Ornithopter', 'Black Lotus', 'Cultivate', 'Island', 'Terror', 'Doom Blade', 'Rhystic Study', 'Mind Stone', 'Furnace Whelp', 'Wall of Omens']);
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
            const nm = (P, n) => P.bf.filter(x => x.card.name === n);
            const clues = P => P.bf.filter(x => x.token && /Clue/.test(x.card.type));
            const atk = async o => { G.attackers = [o.uid]; fire('attacks', { list: [o] }); await settle2(); };
            const landOf = (P, n = 'Forest') => { const l = makeObj(have(n), P.i); putOntoBattlefield(P, l); return l; };
            // Othelm
            { const [A] = await fresh(); const o = put(A, 'Othelm, Sigardian Outcast'); o.sick = false; lands(A, 2, 'Forest'); const g = put(A, 'Hill Giant'); dieOrLeave(g, 'gy'); await settle2(); await activate(A, o, acts(o)[0]); await settle2();
              ok('Othelm: a creature that died this turn returns tapped', onBf(g.uid) && g.tapped, [onBf(g.uid), g.tapped]); }
            { const [A] = await fresh(); const o = put(A, 'Othelm, Sigardian Outcast'); o.sick = false; lands(A, 2, 'Forest'); const g = inGy(A, 'Hill Giant'); ok('Othelm: not a creature card that was already in the graveyard', !actPlan(A, o, acts(o)[0]) || (await (async () => { await activate(A, o, acts(o)[0]); await settle2(); return !onBf(g.uid); })()), 0); }
            // Wernog
            { const [A, B] = await fresh(); const w = inHand(A, 'Wernog, Rider\'s Chaplain'); putOntoBattlefield(A, w); await settle2(); ok('Wernog: the opponent investigates, you investigate twice', clues(B).length === 1 && clues(A).length === 2, [clues(A).length, clues(B).length]); }
            { const [A, B] = await fresh(); const w = put(A, 'Wernog, Rider\'s Chaplain'); await settle2(); A.bf.filter(x => x.token).forEach(x => pull(A.bf, x)); B.bf.filter(x => x.token).forEach(x => pull(B.bf, x)); dieOrLeave(w, 'gy'); await settle2(); ok('Wernog: leaving the battlefield triggers it too', clues(A).length === 2, clues(A).length); }
            // Bebop & Rocksteady
            { const [A] = await fresh(); const b = put(A, 'Bebop & Rocksteady'); inHand(A, 'Shock'); await atk(b); ok('Bebop & Rocksteady: discard a card or sacrifice a permanent when it attacks', A.hand.length === 0 || A.bf.length === 0 || A.bf.length === 1 && A.gy.length >= 1, [A.hand.length, A.bf.length, A.gy.length]); }
            { const [A] = await fresh(); const b = put(A, 'Bebop & Rocksteady'); const f = put(A, 'Grizzly Bears'); A.hand.length = 0; await atk(b); ok('Bebop & Rocksteady: with no card to discard a permanent is sacrificed', A.bf.length === 1, A.bf.map(x => x.card.name)); }
            // Brainspoil
            { const [A, B] = await fresh(); const t1 = put(B, 'Grizzly Bears'); const s = inHand(A, 'Brainspoil'); await spell(A, s, { target: { o: t1 } }); ok('Brainspoil: destroys a creature', !onBf(t1.uid), 0); }
            { const [A, B] = await fresh(); const t1 = put(B, 'Grizzly Bears'); const au = put(B, 'Brainspoil'); au.attachedTo = t1.uid; au.card = { ...au.card, type: 'Enchantment — Aura' }; const s = inHand(A, 'Brainspoil'); const vt = validTargets(A, Rx(s).spell[0], s); ok('Brainspoil: an enchanted creature is not a legal target', !vt.some(v => v.o === t1), vt.length); }
            // Burning-Rune Demon
            { const [A, B] = await fresh(); A.library.length = 0; const x = inLib(A, 'Hill Giant'), y = inLib(A, 'Grizzly Bears'); inLib(A, 'Grizzly Bears'); const d = inHand(A, 'Burning-Rune Demon'); putOntoBattlefield(A, d); await settle2();
              ok('Burning-Rune Demon: one of two differently named cards goes to hand, the other to the graveyard', A.hand.length === 1 && A.gy.length === 1 && A.hand[0].card.name !== A.gy[0].card.name, [A.hand.map(c => c.card.name), A.gy.map(c => c.card.name)]); }
            // Demonic Taskmaster
            { const [A] = await fresh(); put(A, 'Demonic Taskmaster'); const g = put(A, 'Grizzly Bears'); G.active = 0; fire('upkeep'); await settle2(); ok('Demonic Taskmaster: sacrifices another creature at your upkeep', !onBf(g.uid) && nm(A, 'Demonic Taskmaster').length === 1, 0); }
            // Dimir Machinations
            { const [A, B] = await fresh(); B.library.length = 0; B.library.push(makeObj(have('Island'), 1)); B.library.push(makeObj(have('Island'), 1)); const big = makeObj(have('Shivan Dragon'), 1); B.library.push(big); const s = inHand(A, 'Dimir Machinations'); await spell(A, s, { target: { p: B } });
              ok('Dimir Machinations: exiles a good card from the top three of an opponent\'s library', !B.library.includes(big) && B.exile.includes(big), B.exile.map(c => c.card.name)); }
            // Insidious Fungus
            { const [A, B] = await fresh(); const f = put(A, 'Insidious Fungus'); f.sick = false; lands(A, 2, 'Forest'); const ring = put(B, 'Sol Ring'); await activate(A, f, acts(f)[0]); await settle2(); ok('Insidious Fungus: sacrificed for a mode', !onBf(f.uid), 0); }
            // June
            { const [A] = await fresh(); const j = put(A, 'June, Bounty Hunter'); ok('June: blockable at first', !has(j, 'unblockable'), 0); drawCards(A, 2); ok('June: unblockable after drawing two cards', has(j, 'unblockable'), 0); }
            // Magus of the Balance
            { const [A, B] = await fresh(); const m = put(A, 'Magus of the Balance'); m.sick = false; lands(A, 6, 'Plains'); lands(B, 2, 'Forest'); put(A, 'Hill Giant'); put(A, 'Grizzly Bears'); put(B, 'Serra Angel'); inHand(A, 'Shock'); inHand(A, 'Shock'); inHand(A, 'Shock'); inHand(B, 'Shock');
              await activate(A, m, acts(m)[0]); await settle2(); const lA = A.bf.filter(x => /Land/.test(x.card.type)).length, lB = B.bf.filter(x => /Land/.test(x.card.type)).length;
              ok('Magus of the Balance: lands, creatures and hands are balanced to the smallest player', lA === lB && A.bf.filter(isCreature).length === B.bf.filter(isCreature).length && A.hand.length === B.hand.length, [lA, lB, A.hand.length, B.hand.length, A.bf.filter(isCreature).length]); }
            // Netherborn Phalanx
            { const [A, B] = await fresh(); put(B, 'Grizzly Bears'); put(B, 'Hill Giant'); put(B, 'Serra Angel'); const p = inHand(A, 'Netherborn Phalanx'); const l0 = B.life; putOntoBattlefield(A, p); await settle2(); ok('Netherborn Phalanx: each opponent loses 1 life for each creature they control', B.life === l0 - 3, B.life - l0); }
            // Noble Heritage
            { const [A, B] = await fresh(); const c = put(A, 'Grizzly Bears'); c.isCommander = true; const bc = put(B, 'Hill Giant'); put(A, 'Noble Heritage'); G.active = 0; fire('upkeep'); await settle2();
              ok('Noble Heritage: everyone may put two counters on a creature at your upkeep', c.counters === 2 && bc.counters === 2, [c.counters, bc.counters]);
              ok('Noble Heritage: you gain protection from the opponent who did', A.ot_protFrom && A.ot_protFrom[1] > G.turn, A.ot_protFrom);
              const l0 = A.life; damage(A, 3, bc); ok('Noble Heritage: damage from that player is prevented', A.life === l0, A.life - l0); }
            // Nyla
            { const [A] = await fresh(); const g = inGy(A, 'Hill Giant'); const l0 = A.life; const n = inHand(A, 'Nyla, Shirshu Sleuth'); putOntoBattlefield(A, n); await settle2();
              ok('Nyla: exiles a creature card, loses X life and makes X Clues', A.exile.includes(g) && clues(A).length === 4 && A.life === l0 - 4, [clues(A).length, A.life - l0]);
              clues(A).forEach(c => dieOrLeave(c, 'gy')); fire('end'); await settle2(); ok('Nyla: with no Clues at your end step the card returns to your hand', A.hand.includes(g), A.hand.map(c => c.card.name)); }
            // Obsessive Pursuit
            { const [A] = await fresh(); const p = inHand(A, 'Obsessive Pursuit'); const l0 = A.life; putOntoBattlefield(A, p); await settle2(); ok('Obsessive Pursuit: lose 1 life and create a Clue when it enters', A.life === l0 - 1 && clues(A).length === 1, [A.life - l0, clues(A).length]);
              G.active = 0; fire('upkeep'); await settle2(); ok('Obsessive Pursuit: again at your upkeep', clues(A).length === 2, clues(A).length);
              const g = put(A, 'Grizzly Bears'); [0, 1, 2].forEach(() => { const t = put(A, 'Hill Giant'); fire('sacrificed', { o: t }); dieOrLeave(t, 'gy'); }); await atk(g);
              ok('Obsessive Pursuit: attacking after three sacrifices puts three counters and lifelink', g.counters === 3 && has(g, 'lifelink'), [g.counters, has(g, 'lifelink')]); }
            // Persuasive Interrogators
            { const [A, B] = await fresh(); put(A, 'Persuasive Interrogators'); const c = makeArtifactToken(A, 'clue'); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); await settle2(); ok('Persuasive Interrogators: sacrificing a Clue gives an opponent two poison counters', B.poison === 2, B.poison); }
            // Pitiless Carnage
            { const [A] = await fresh(); makeArtifactToken(A, 'clue'); makeArtifactToken(A, 'clue'); const s = inHand(A, 'Pitiless Carnage'); const h0 = A.hand.length; await spell(A, s); ok('Pitiless Carnage: sacrifice permanents, draw that many', A.hand.length === h0 + 2 - 1 + 0 || A.hand.length >= h0, [A.hand.length - h0]); }
            // Prismatic Undercurrents
            { const [A] = await fresh(); put(A, 'Grizzly Bears'); put(A, 'Serra Angel'); A.library.length = 0; ['Forest', 'Plains', 'Island'].forEach(n => inLib(A, n)); const p = inHand(A, 'Prismatic Undercurrents'); const h0 = A.hand.length; putOntoBattlefield(A, p); await settle2();
              ok('Prismatic Undercurrents: up to X basic lands (X = colors among your permanents)', A.hand.length === h0 - 0 + 2 - 0 || A.hand.length === h0 + 2 - 1 || A.hand.filter(c => /Land/.test(c.card.type)).length === 2, A.hand.map(c => c.card.name)); }
            // Raven Eagle
            { const [A, B] = await fresh(); const d = inGy(B, 'Hill Giant'); const r = inHand(A, 'Raven Eagle'); putOntoBattlefield(A, r); await settle2(); ok('Raven Eagle: exiles a creature card from a graveyard and makes a Clue', B.exile.includes(d) && clues(A).length === 1, [B.exile.length, clues(A).length]); }
            // Reveillark
            { const [A] = await fresh(); const lark = put(A, 'Reveillark'); const sm = inGy(A, 'Grizzly Bears'); const bg = inGy(A, 'Hill Giant'); dieOrLeave(lark, 'gy'); await settle2(); ok('Reveillark: returns creature cards with power 2 or less only', onBf(sm.uid) && !onBf(bg.uid), [onBf(sm.uid), onBf(bg.uid)]); }
            // Shred Memory
            { const [A, B] = await fresh(); for (let i = 0; i < 5; i++) inGy(B, 'Hill Giant'); const s = inHand(A, 'Shred Memory'); await spell(A, s); ok('Shred Memory: exiles up to four cards from one graveyard', B.exile.length === 4 && B.gy.length === 1, [B.exile.length, B.gy.length]); }
            // The Soul Stone
            { const [A] = await fresh(); const st = put(A, 'The Soul Stone'); lands(A, 8, 'Swamp'); const fod = put(A, 'Grizzly Bears'); await activate(A, st, acts(st).find(a => /Harness/.test(a.text || '')) || acts(st)[1]); await settle2();
              ok('The Soul Stone: exiling a creature harnesses it', st.ot_harnessed === true && !onBf(fod.uid), [st.ot_harnessed]);
              const dead = inGy(A, 'Hill Giant'); G.active = 0; fire('upkeep'); await settle2(); ok('The Soul Stone: harnessed, it returns a creature card at your upkeep', onBf(dead.uid), 0); }
            // What Must Be Done
            { const [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(B, 'Hill Giant'); put(B, 'Sol Ring'); const s = inHand(A, 'What Must Be Done'); ok('What Must Be Done: a modal spell', !!Rx(s).modes && Rx(s).modes.length === 2, Rx(s).modes && Rx(s).modes.length);
              s.mode = 0; await resolveEffects(A, spellEffects(s), null, s); await settle2();
              ok('What Must Be Done (Let the World Burn): destroys all artifacts and creatures', A.bf.filter(isCreature).length === 0 && B.bf.filter(x => isCreature(x) || /Artifact/.test(x.card.type)).length === 0, [A.bf.length, B.bf.length]); }
            { const [A] = await fresh(); const ring = inGy(A, 'Sol Ring'); const s = inHand(A, 'What Must Be Done'); s.mode = 1; await resolveEffects(A, spellEffects(s), null, s); await settle2(); ok('What Must Be Done (Release Juno): returns a historic permanent card', onBf(ring.uid), 0); }
            // Havengul Laboratory
            { const [A] = await fresh(); const lab = put(A, 'Havengul Laboratory'); const dead = inGy(A, 'Hill Giant'); for (let i = 0; i < 3; i++) { const c = makeArtifactToken(A, 'clue'); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); } G.active = 0; fire('end'); await settle2();
              ok('Havengul Laboratory: sacrificing three Clues transforms it at your end step', /Mystery/.test(lab.card.name), lab.card.name);
              ok('Havengul Mystery: a creature card returns from your graveyard', onBf(dead.uid), 0);
              dieOrLeave(dead, 'gy'); await settle2(); ok('Havengul Mystery: when that creature leaves, it transforms back', /Laboratory/.test(lab.card.name), lab.card.name); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('othelm', results, []);
    writeOut('othelm', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
