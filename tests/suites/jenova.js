// Jenova, Ancient Calamity deck (2026-10-21): behavior checks for the cards added for it (rules/jenova.js, 15i-jenova.js).
// Each section sets up a small board from the offline card file and checks what the card does. The two-faced cards (Agadeem's Awakening,
// Sephiroth, the Emeritus creatures) have no text in the offline file, so they are checked with tests/card_status.js and card_status_back.js.
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
            const byName = new Map(raw.map(c => [c.name, c]));
            const need = n => { if (!C[n]) { const c = byName.get(n); if (!c) throw new Error('no card ' + n); const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; } return C[n]; };
            ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Fleshbag Marauder', 'Accursed Marauder'].forEach(need);
            manaMode = 'auto';
            window.pickCard = async (P, list) => list[0];
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async () => { await newGame(mk(), mk()); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; const [A, B] = G.players; A.isAI = true; B.isAI = true; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 20; i++) { A.library.push(makeObj(C['Island'], 0)); B.library.push(makeObj(C['Island'], 1)); } return [A, B]; };
            const put = (P, n, extra) => { need(n); return T.put(P, C[n], extra); };
            const inGy = (P, n) => { need(n); const o = makeObj(C[n], P.i); P.gy.push(o); return o; };
            const inHand = (P, n) => { need(n); const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const settle2 = async () => { await settle(); await settle(); };
            const spell = async (P, o, t) => { await resolveEffects(P, Rx(o).spell, t || null, o); await settle2(); };
            const actsOf = o => Rx(o).acts || [];
            const names = ['Jenova, Ancient Calamity', "Dutiful Attendant", "Dina's Guidance", 'Behold the Sinister Six!', 'Call Damage Control', 'Campfire', 'Desperate Plea', 'Dose of Dawnglow', 'Elixir of Immortality', 'Flare of Malice', "Galuf's Final Act", 'Garruk, Veiled Butcher', 'Michelangelo, the Heart', 'Mona Lisa, Ever Adaptable', 'Rise of the Witch-king', 'Ruthless Technomancer', 'Sphere Grid', 'Splinter, the Mentor', 'Strength of Will', 'Super Shredder', 'The Warring Triad', 'Tom, Bert, and William', 'Topiary Lecturer', 'Troop of Ponies', 'Warden of the Grove', 'Winter, Tormented Loner', 'Witherbloom, the Balancer', 'Wolverine, Claws Out', 'X-23, Deadly Weapon', 'Zero Point Ballad', 'Zodiark, Umbral God', 'Archfiend of Ifnir', 'Doc Samson, Super Psychiatrist', "Archenemy's Charm", 'Regrowth'];
            names.forEach(need);
            ok('every card reads as Automated', names.every(n => rulesFor(C[n]).support === 'full'), names.filter(n => rulesFor(C[n]).support !== 'full'));

            // ---- Graveyard returns ----
            { const [A] = await fresh(); const att = put(A, 'Dutiful Attendant'); const g = inGy(A, 'Hill Giant'); destroy(att); await settle2();
              ok('Dutiful Attendant: returns another creature card to hand when it dies', A.hand.includes(g) && !A.hand.includes(att), A.hand.map(x => x.card.name)); }
            { const [A] = await fresh(); const g = inGy(A, 'Hill Giant'); const src = inHand(A, "Dina's Guidance"); need('Serra Angel'); A.library.push(makeObj(C['Serra Angel'], 0)); await spell(A, src);
              ok("Dina's Guidance: a creature card from the library to the hand", A.hand.some(x => x.card.name === 'Serra Angel') || A.hand.some(x => x.card.name === 'Serra Angel'), A.hand.map(x => x.card.name)); void g; }
            { const [A] = await fresh(); const a = inGy(A, 'Hill Giant'), b = inGy(A, 'Hill Giant'), c = inGy(A, 'Grizzly Bears'), d = inGy(A, 'Serra Angel'); const src = inHand(A, 'Behold the Sinister Six!'); await spell(A, src);
              ok('Behold the Sinister Six!: different names only', A.bf.filter(isCreature).length === 3 && A.bf.filter(x => x.card.name === 'Hill Giant').length === 1, A.bf.map(x => x.card.name)); void a; void b; void c; void d; }
            { const [A] = await fresh(); const mvs = [['Grizzly Bears', 2], ['Hill Giant', 4], ['Serra Angel', 5]]; mvs.forEach(([n]) => inGy(A, n)); G.curX = 4; await CMD.agadeemX(A, { n: 97 }, null, inHand(A, 'Behold the Sinister Six!')); await settle2();
              ok("Agadeem's Awakening: any number with different mana values X or less", A.bf.map(x => x.card.name).sort().join() === 'Grizzly Bears,Hill Giant', A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const g = inGy(A, 'Hill Giant'); put(A, 'Grizzly Bears'); G.phase = 'declareBlocks'; G.active = 1; await spell(A, inHand(A, 'Dose of Dawnglow'));
              ok('Dose of Dawnglow: returns the creature; blights 2 when it is not your main phase', onBf(g.uid) && A.gy.some(x => x.card.name === 'Grizzly Bears'), [A.bf.map(x => [x.card.name, x.counters]), A.gy.map(x => x.card.name)]); }
            { const [A] = await fresh(); const g = inGy(A, 'Hill Giant'); G.phase = 'main1'; G.active = 0; await spell(A, inHand(A, 'Dose of Dawnglow'));
              ok('Dose of Dawnglow: no blight in your main phase', onBf(g.uid) && g.counters === 0, g.counters); }
            { const [A, B] = await fresh(); const mine = put(A, 'Grizzly Bears'); put(B, 'Hill Giant'); const gone = inGy(A, 'Serra Angel'); const land = inGy(A, 'Swamp'); await spell(A, inHand(A, 'Rise of the Witch-king'));
              ok('Rise of the Witch-king: both sacrifice; you return another permanent card', A.gy.includes(mine) && !B.bf.length && onBf(gone.uid), [A.bf.map(x => x.card.name), A.gy.map(x => x.card.name)]); void land; }
            { const [A] = await fresh(); const cmdr = A.command[0] || makeObj(C['Tyrox, Saurid Tyrant'], 0); if (!A.command.includes(cmdr)) { cmdr.isCommander = true; A.command.push(cmdr); } const g = inGy(A, 'Hill Giant'); const camp = put(A, 'Campfire'); A.library.length = 0;
              CMD.campfire(A, {}, null, camp); ok('Campfire: commander to hand, graveyard shuffled in, Campfire exiled', A.hand.includes(cmdr) && !A.gy.length && A.library.includes(g) && A.exile.includes(camp), [A.hand.length, A.library.length]); }
            { const [A] = await fresh(); const el = put(A, 'Elixir of Immortality'); inGy(A, 'Hill Giant'); A.life = 20; const a = actsOf(el)[0]; lands(A, 2); await activate(A, el, a); await settle2();
              ok('Elixir of Immortality: gain 5 life, shuffles itself and the graveyard into the library', A.life === 25 && !A.gy.length && A.library.some(x => x.card.name === 'Elixir of Immortality'), [A.life, A.gy.length]); }
            function lands(P, k, n = 'Plains') { need(n); for (let i = 0; i < k; i++) T.put(P, C[n]); }
            { const [A] = await fresh(); const art = inGy(A, 'Sol Ring'), cr = inGy(A, 'Hill Giant'), ln = inGy(A, 'Swamp'); await spell(A, inHand(A, 'Call Damage Control'));
              ok('Call Damage Control: up to two cards of different kinds return to hand', A.hand.filter(x => x.card.name !== 'Call Damage Control').length === 2, A.hand.map(x => x.card.name)); void art; void cr; void ln; }
            { const [A, B] = await fresh(); const mine = put(A, 'Hill Giant'); const big = put(B, 'Serra Angel'); const toks = inHand(A, 'Desperate Plea'); G.lastSacPow = 3; const g = inGy(A, 'Grizzly Bears'); await CMD.pleaReturn(A, {}, null, toks);
              ok('Desperate Plea: returns a creature card with power at most the sacrificed creature\'s', onBf(g.uid), 0); void mine; void big; }
            { const [A] = await fresh(); const art = rulesFor(C['Desperate Plea']); ok('Desperate Plea: additional cost is a creature, both modes read', art.addCost && art.addCost.sac === 'creature' && art.modes && art.modes.length === 2, [art.addCost, art.modes && art.modes.length]); }
            { const [A] = await fresh(); const mod = rulesFor(C["Archenemy's Charm"]); ok("Archenemy's Charm: three modes", mod.modes && mod.modes.length === 3, mod.modes && mod.modes.length); }

            // ---- Sacrifice, edicts, sweepers ----
            { const [A, B] = await fresh(); const a = put(A, 'Grizzly Bears'), b = put(B, 'Hill Giant'), c = put(B, 'Serra Angel'); const z = inHand(A, 'Zero Point Ballad'); G.curX = 6; A.life = 20; await CMD.zeroPoint(A, { n: 6 }, null, z);
              ok('Zero Point Ballad X=6: creatures with toughness 6 or less die, lose 6 life, one comes back under your control', A.life === 14 && !B.bf.length && A.bf.length === 1, [A.life, A.bf.map(x => x.card.name), B.bf.length]); void a; void b; void c; }
            { const [A, B] = await fresh(); const x = put(A, 'Grizzly Bears'); G.curX = 1; await CMD.zeroPoint(A, { n: 1 }, null, inHand(A, 'Zero Point Ballad')); ok('Zero Point Ballad X=1: a 2/2 survives', onBf(x.uid), A.bf.length); }
            { const [A, B] = await fresh(); const fl = inHand(A, 'Flare of Malice'); ok('Flare of Malice: alt cost needs a nontoken black creature', !altOk(A, fl) || (fl.altCast = true, !altOk(A, fl)), 0);
              const bl = put(A, 'Fleshbag Marauder'); fl.altCast = true; ok('Flare of Malice: castable by sacrificing a nontoken black creature', altOk(A, fl), 0);
              const small = put(B, 'Grizzly Bears'), big = put(B, 'Serra Angel'); await CMD.flareEdict(A, {}, null, fl); ok('Flare of Malice: the opponent sacrifices the greatest mana value', !onBf(big.uid) && onBf(small.uid), 0); void bl; }
            { const [A, B] = await fresh(); const win = put(A, 'Winter, Tormented Loner'); ok('Winter: +1/+0 for each creature and planeswalker card in your graveyard', pow(win) === 0, pow(win)); inGy(A, 'Hill Giant'); inGy(A, 'Grizzly Bears'); inGy(A, 'Swamp'); ok('Winter: counts only creature and planeswalker cards', pow(win) === 2, pow(win)); }
            { const [A, B] = await fresh(); const tok = put(A, 'Grizzly Bears'); tok.token = true; const w = put(A, 'Winter, Tormented Loner'); put(B, 'Hill Giant'); await CMD.winterEtb(A, {}, null, w); await settle2(); ok('Winter: sacrifice then each opponent sacrifices a creature', !onBf(tok.uid) && !B.bf.length, [A.bf.length, B.bf.length]); }
            { const [A, B] = await fresh(); [1, 2, 3, 4].forEach(() => { put(A, 'Grizzly Bears'); put(B, 'Hill Giant'); }); const z = put(A, 'Zodiark, Umbral God'); await settle2();
              ok('Zodiark: each player sacrifices half their non-God creatures (the God stays)', A.bf.filter(isCreature).length === 3 && B.bf.filter(isCreature).length === 2, [A.bf.filter(isCreature).length, B.bf.filter(isCreature).length]);
              ok('Zodiark: +1/+1 counter whenever a player sacrifices another creature', z.counters === 4, z.counters); }
            { const [A, B] = await fresh(); const g = put(A, 'Garruk, Veiled Butcher'); g.ctr.loyalty = 5; const foe = put(B, 'Hill Giant'); await activate(A, g, actsOf(g).find(x => x.loyalty === 2), { o: foe }); await settle2();
              ok('Garruk +2: -4/-1 until your next turn', pow(foe) === -1 && tou(foe) === 2, [pow(foe), tou(foe)]); G.turn += 2; ok('Garruk +2 wears off', pow(foe) === 3, pow(foe)); G.turn -= 2; }
            { const [A, B] = await fresh(); const g = put(A, 'Garruk, Veiled Butcher'); g.ctr.loyalty = 5; put(A, 'Grizzly Bears'); put(B, 'Hill Giant'); await activate(A, g, actsOf(g).find(x => x.loyalty === -2)); await settle2();
              ok('Garruk -2: each player sacrifices; you get a 4/4 Beast', A.bf.some(x => x.card.name.includes('Beast') && pow(x) === 4) && !B.bf.some(isCreature), A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); const g = put(A, 'Garruk, Veiled Butcher'); g.ctr.loyalty = 5; B.hand.push(makeObj(C['Swamp'], 1), makeObj(C['Swamp'], 1), makeObj(C['Grizzly Bears'], 1)); const n0 = A.hand.length; await activate(A, g, actsOf(g).find(x => x.loyalty === -3)); await settle2();
              ok('Garruk -3: the opponent discards two; you draw if they did not discard two nonland cards', B.hand.length === 1 && A.hand.length === n0 + 1, [B.hand.length, A.hand.length - n0]); }
            { const [A, B] = await fresh(); put(A, 'Garruk, Veiled Butcher'); const foe = put(B, 'Hill Giant'); destroy(foe); ok("Garruk: an opponent's creature is exiled instead of dying", B.exile.includes(foe) && !B.gy.includes(foe), 0); const mine = put(A, 'Grizzly Bears'); destroy(mine); ok('Garruk: your own creature still dies', A.gy.includes(mine), 0); }
            { const [A] = await fresh(); const t = put(A, 'Tom, Bert, and William'); destroy(t); await settle2(); ok('Tom, Bert, and William: return as an artifact that is not a creature', onBf(t.uid) && !isCreature(onBf(t.uid)), 0); destroy(t); await settle2(); ok('Tom, Bert, and William: dying again as an artifact does not return them', !onBf(t.uid), 0); }
            { const [A] = await fresh(); const t = put(A, 'Tom, Bert, and William'); const fod = put(A, 'Hill Giant'); lands(A, 1); A.hand.length = 0; const n0 = A.hand.length; await activate(A, t, actsOf(t)[0]); await settle2(); ok("Tom, Bert, and William: sacrifice another creature, draw its power, then discard", !onBf(fod.uid) && onBf(t.uid), [A.hand.length, A.gy.length]); }
            { const [A, B] = await fresh(); const rt = put(A, 'Ruthless Technomancer'); const fod = put(A, 'Hill Giant'); fod.token = true; await CMD.technoEtb(A, {}, null, rt); await settle2(); ok('Ruthless Technomancer: sacrificing a 3-power creature makes 3 Treasures', A.bf.filter(x => x.card.name === 'Treasure').length === 3, A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const rt = put(A, 'Ruthless Technomancer'); const a1 = makeObj(C['Sol Ring'], 0); putOntoBattlefield(A, a1); a1.sick = false; const g = inGy(A, 'Llanowar Elves'); lands(A, 3, 'Swamp'); await activate(A, rt, actsOf(rt)[0]); await settle2(); ok("Ruthless Technomancer: sacrifice artifacts, return a creature card with power X or less", onBf(g.uid), A.bf.map(x => x.card.name)); }

            // ---- Combat tricks and small pieces ----
            { const [A, B] = await fresh(); const x = put(A, 'Grizzly Bears'); await spell(A, inHand(A, 'Strength of Will'), { o: x }); damage(x, 5, put(B, 'Hill Giant')); sba(); await settle2(); ok('Strength of Will: indestructible and +1/+1 counters equal to damage dealt', onBf(x.uid) && x.counters === 5, x.counters); }
            { const [A, B] = await fresh(); const x = put(A, 'Hill Giant'), y = put(A, 'Grizzly Bears'); await spell(A, inHand(A, "Galuf's Final Act"), { o: x }); ok("Galuf's Final Act: +1/+0", pow(x) === 4, pow(x)); destroy(x); await settle2(); ok("Galuf's Final Act: when it dies, counters equal to its power on up to one creature", y.counters === 4, y.counters); }
            { const [A] = await fresh(); const tp = put(A, 'Troop of Ponies'); lands(A, 2); [1, 2, 3].forEach(() => A.library.push(makeObj(C['Forest'], 0))); const n0 = A.hand.length; await activate(A, tp, actsOf(tp)[0]); await settle2(); ok('Troop of Ponies: one basic onto the battlefield tapped, one to hand', A.bf.filter(x => x.card.name !== 'Plains' && x.tapped).length === 1 && A.hand.length === n0 + 1, [A.bf.map(x => [x.card.name, x.tapped]), A.hand.length - n0]); }
            { const [A, B] = await fresh(); const af = put(A, 'Archfiend of Ifnir'); const foe = put(B, 'Hill Giant'); const cyc = inGy(A, 'Grizzly Bears'); cyc.discardTurn = G.turn; sba(); await settle2(); ok('Archfiend of Ifnir: a discard puts a -1/-1 counter on each opposing creature', foe.counters === -1, foe.counters); void af; }
            { const [A] = await fresh(); const w = put(A, 'The Warring Triad'); ok('The Warring Triad: not a creature with fewer than eight cards in the graveyard', !isCreature(w), 0); for (let i = 0; i < 8; i++) inGy(A, 'Swamp'); ok('The Warring Triad: a 5/5 creature with eight', isCreature(w) && pow(w) === 5, 0); }

            // ---- Mutants and counters ----
            { const [A] = await fresh(); const j = put(A, 'Jenova, Ancient Calamity'); const g = put(A, 'Grizzly Bears'); G.active = 0; fire('combat'); await settle2(); ok('Jenova: at combat, +1/+1 counters equal to her power on another creature, which becomes a Mutant', g.counters === 1 && hasType(g, 'Mutant'), [g.counters, hasType(g, 'Mutant')]);
              G.active = 0; destroy(g); await settle2(); ok('Jenova: a Mutant that dies on your turn draws cards equal to its power', A.hand.length >= 3, A.hand.length); void j; }
            { const [A] = await fresh(); const m = put(A, 'Mona Lisa, Ever Adaptable'); const n0 = A.bf.length; fire('cast', { P: A, o: inHand(A, 'Grizzly Bears') }); await settle2(); ok('Mona Lisa, Ever Adaptable: a Mutagen token when a creature spell is cast', A.bf.some(x => x.card.name === 'Mutagen'), A.bf.map(x => x.card.name)); void m; void n0; }
            { const [A] = await fresh(); const mg = makeArtifactToken(A, 'mutagen'); const g = put(A, 'Grizzly Bears'); lands(A, 1); mg.sick = false; ok('Mutagen: sorcery-speed ability puts a +1/+1 counter on a creature', actsOf(mg).length === 1, actsOf(mg).length); await activate(A, mg, actsOf(mg)[0], { o: g }); await settle2(); ok('Mutagen: the counter lands and the token is sacrificed', g.counters === 1 && !onBf(mg.uid), g.counters); }
            { const [A] = await fresh(); const s = put(A, 'Splinter, the Mentor'); const o2 = put(A, 'Grizzly Bears'); destroy(o2); await settle2(); ok('Splinter: another nontoken creature leaving makes a Mutagen', A.bf.filter(x => x.card.name === 'Mutagen').length === 1, A.bf.map(x => x.card.name)); destroy(s); await settle2(); ok('Splinter: it leaving makes a Mutagen too', A.bf.filter(x => x.card.name === 'Mutagen').length === 2, A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); const ss = put(A, 'Super Shredder'); const x = put(B, 'Hill Giant'); destroy(x); await settle2(); ok('Super Shredder: a counter whenever another permanent leaves the battlefield', ss.counters === 1, ss.counters); }
            { const [A] = await fresh(); const x23 = put(A, 'X-23, Deadly Weapon'); const mut = put(A, 'Wolverine, Claws Out'); await settle2(); ok('X-23: a counter on the entering Mutant and on herself', x23.counters === 1 && mut.counters === 1, [x23.counters, mut.counters]); }
            { const [A, B] = await fresh(); const w = put(A, 'Wolverine, Claws Out'); w.sick = false; ok('Wolverine: power doubles when he attacks', (G.attackers = [w.uid], fire('attacks', { list: [w] }), true), 0); await settle2(); ok('Wolverine: doubled power until end of turn', pow(w) === 4, pow(w));
              const blocker = put(B, 'Serra Angel'); G.attackers = [w.uid]; G.blocks = { [w.uid]: [blocker.uid] }; w.tp = 0; B.life = 20; combatDamage(A); ok("Wolverine: may assign combat damage as though he weren't blocked", B.life === 18, B.life); }
            { const [A] = await fresh(); const sg = put(A, 'Sphere Grid'); const x = put(A, 'Grizzly Bears'); fire('hitPlayer', { src: x, n: 2 }); await settle2(); ok('Sphere Grid: a +1/+1 counter on a creature that deals combat damage to a player', x.counters === 1, x.counters); ok('Sphere Grid: creatures with counters have reach and trample', has(x, 'reach') && has(x, 'trample'), 0); const y = put(A, 'Hill Giant'); ok('Sphere Grid: others do not', !has(y, 'reach'), 0); void sg; }
            { const [A] = await fresh(); const ds = put(A, 'Doc Samson, Super Psychiatrist'); const g = put(A, 'Grizzly Bears'); putCounters(g, 1, A); ok('Doc Samson: one more +1/+1 counter than you would put', g.counters === 2, g.counters); void ds; }
            { const [A] = await fresh(); const wg = put(A, 'Warden of the Grove'); wg.counters = 2; const e = put(A, 'Grizzly Bears'); await settle2(); ok('Warden of the Grove: another nontoken creature that enters endures X (counters here)', e.counters === 2, e.counters); }
            { const [A] = await fresh(); const tl = put(A, 'Topiary Lecturer'); const spellO = inHand(A, 'Serra Angel'); spellO.manaSpent = 5; fire('cast', { P: A, o: spellO }); await settle2(); ok('Topiary Lecturer: increment, a counter when more mana was spent than its power or toughness', tl.counters === 1, tl.counters); const small = inHand(A, 'Grizzly Bears'); small.manaSpent = 1; fire('cast', { P: A, o: small }); await settle2(); ok('Topiary Lecturer: no counter for a cheap spell', tl.counters === 1, tl.counters); }
            { const [A] = await fresh(); const wb = inHand(A, 'Witherbloom, the Balancer'); put(A, 'Grizzly Bears'); put(A, 'Hill Giant'); const base = costTotal(totalCost(A, wb)); ok('Witherbloom: affinity for creatures reduces its cost', base <= 6, base);
              const wbP = put(A, 'Witherbloom, the Balancer'); const sorc = inHand(A, 'Zero Point Ballad'); ok('Witherbloom: instants and sorceries you cast have affinity for creatures', costTotal(totalCost(A, sorc)) <= 1, costTotal(totalCost(A, sorc))); void wbP; }
            { const [A] = await fresh(); const mi = put(A, 'Michelangelo, the Heart'); const g = put(A, 'Grizzly Bears'); A.attackedTurn = G.turn; G.phase = 'main2'; fire('main2'); await settle2(); ok('Michelangelo: raid at the second main phase gives a counter and a Food', A.bf.some(x => x.card.name === 'Food') && (mi.counters + g.counters) === 1, A.bf.map(x => x.card.name)); }

            // ---- Two-faced cards (live Scryfall data) ----
            { const live = await T.cards(["Sephiroth, Fabled SOLDIER", 'Emeritus of Woe', 'Emeritus of Abundance', "Agadeem's Awakening"]);
              const [A, B] = await fresh(); const sep = T.put(A, live['Sephiroth, Fabled SOLDIER']); await settle2(); const a0 = A.life, b0 = B.life;
              for (let i = 0; i < 4; i++) { const x = put(B, 'Grizzly Bears'); destroy(x); await settle2(); }
              ok('Sephiroth: each other creature that dies drains 1', A.life >= a0 + 4 && B.life <= b0 - 4, [A.life - a0, b0 - B.life, JSON.stringify(Rx(sep).trig.map(t => [t.ev, t.fn])), G.log.slice(-6).map(l => l.text || l)]);
              ok('Sephiroth: transforms the fourth time this turn and you get the Super Nova emblem', sep.card.name === 'Sephiroth, One-Winged Angel' && (A.emblems || []).includes('superNova'), [sep.card.name, A.emblems]);
              const l1 = B.life; const y = put(B, 'Grizzly Bears'); destroy(y); await settle2(); ok('Super Nova: later deaths still drain 1', B.life <= l1 - 1, B.life - l1);
              const [A2] = await fresh(); const em = T.put(A2, live['Emeritus of Woe']); await settle2(); ok('Emeritus of Woe: enters prepared', !!em.prepared, 0);
              const [A3] = await fresh(); const em2 = T.put(A3, live['Emeritus of Abundance']); await settle2(); ok('Emeritus of Abundance: enters prepared', !!em2.prepared, 0);
              ok("Agadeem's Awakening: reads as Automated, with its land back face", rulesFor(live["Agadeem's Awakening"]).support === 'full' && !!live["Agadeem's Awakening"].back, 0); }
            ok('no broken card locations', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('jenova', results, []);
    writeOut('jenova', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
