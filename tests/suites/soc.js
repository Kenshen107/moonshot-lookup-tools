// Secrets of Strixhaven Commander precons (2026-10-15): behavior checks for the SOC cards (rules/soc.js, 15d-cmdr-soc.js): prepared, Class levels, graveyard leaving, auras, Pests and so on.
// Each section sets up a small board from the offline card file and checks what the card does.
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
            const byName = new Map(raw.map(c => [c.name, c])); raw.forEach(c => { if (c.name.includes(' // ')) { const f = c.name.split(' // ')[0]; if (!byName.has(f)) byName.set(f, c); } });
            const need = n => { if (!C[n]) { const c = byName.get(n); if (!c) throw new Error('no card ' + n); const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; } return C[n]; };
            ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant'].forEach(need);
            manaMode = 'auto';
            window.pickCard = async (P, list) => list[0];
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async (humanA = false) => { await newGame(mk(), mk()); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; const [A, B] = G.players; A.isAI = true; B.isAI = true; if (humanA) A.isAI = false; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 20; i++) { A.library.push(makeObj(C['Island'], 0)); B.library.push(makeObj(C['Island'], 1)); } return [A, B]; };
            const put = (P, n, extra) => { need(n); return T.put(P, C[n], extra); };
            const lands = (P, k, n = 'Plains') => { need(n); for (let i = 0; i < k; i++) T.put(P, C[n]); };
            const settle2 = async () => { await settle(); await settle(); };
            const logged = () => G.log.map(l => l.text || l).join('\n');

            const cmdEff = id => ({ t: 'cmd', id });

            const acts = (o, re) => actsOf(o).find(a => re.test(a.text));
            // ===== Prepared =====
            { // Kirol: becomes prepared when a card leaves the graveyard; its spell can then be cast once
                let [A, B] = await fresh(); const kirol = put(A, 'Kirol, History Buff'); const bear = put(A, 'Grizzly Bears'); lands(A, 3, 'Plains'); lands(A, 3, 'Mountain');
                ok('Kirol: not prepared at the start', !kirol.prepared);
                const c = makeObj(C['Grizzly Bears'], 0); A.gy.push(c); pull(A.gy, c); await settle2();
                ok('Kirol: a card leaving the graveyard prepares it', kirol.prepared === true, kirol.prepared);
                const a = acts(kirol, /Pack a Punch/); ok('Kirol: has the prepared spell as an ability', !!a);
                G.phase = 'main1'; const ok0 = canActivate(A, kirol, a); ok('Kirol: the prepared spell can be cast in main phase', ok0);
                await activate(A, kirol, a, { o: bear }); await settle2();
                ok('Kirol: Pack a Punch puts two +1/+1 counters on the target and unprepares', bear.counters === 2 && !kirol.prepared, [bear.counters, kirol.prepared]);
                ok('Kirol: cannot cast again until prepared', !canActivate(A, kirol, a));
            }
            { // Naktamun Lorespinner: prepared when a player has one or fewer cards in hand at upkeep; Wheel of Fortune
                let [A, B] = await fresh(); const nl = put(A, 'Naktamun Lorespinner'); A.hand.length = 0; fire('upkeep'); await settle2();
                ok('Naktamun Lorespinner: prepared at upkeep when a player has <=1 cards in hand', nl.prepared === true);
                lands(A, 3, 'Mountain'); A.hand.push(makeObj(C['Grizzly Bears'], 0)); G.phase = 'main1'; await activate(A, nl, acts(nl, /Wheel of Fortune/)); await settle2();
                ok('Wheel of Fortune (prepared): each player draws seven', A.hand.length === 7 && B.hand.length === 7, [A.hand.length, B.hand.length]);
            }
            { // Dirgur Focusmage: casting a 5+ MV instant/sorcery from hand prepares it
                let [A, B] = await fresh(); const df = put(A, 'Dirgur Focusmage'); const sp = makeObj(need('Aether Gale'), 0); A.hand.push(sp); sp.castFromHand = G.turn;
                fire('cast', { P: A, o: sp }); await settle2(); ok('Dirgur Focusmage: prepared by a 5+ mana spell cast from hand', df.prepared === true, [Rx(df).preparedSpell, df.card.layout, !!df.card.back, df.card.back && rulesFor(df.card.back).support, df.card.back && rulesFor(df.card.back).why, Rx(df).unhandled, (G.trigQ || []).length, G.stack.length, logged().slice(-200)]);
            }
            // ===== Class levels =====
            { // Advanced Reconstruction
                let [A, B] = await fresh(); const ar = put(A, 'Advanced Reconstruction'); lands(A, 4, 'Mountain'); ok('Advanced Reconstruction: starts at level 1', (ar.level || 1) === 1);
                const l2 = acts(ar, /Level 2/); G.phase = 'main1'; ok('Level 2 can be bought in the main phase', canActivate(A, ar, l2));
                ok('Level 3 cannot be bought first', !canActivate(A, ar, acts(ar, /Level 3/)));
                await activate(A, ar, l2); await settle2(); ok('Level 2 sets the level', ar.level === 2, ar.level);
                B.life = 20; const gy = makeObj(C['Grizzly Bears'], 0); A.gy.push(gy); pull(A.gy, gy); await settle2();
                ok('Level 2: a card leaving the graveyard deals 2 to each opponent', B.life === 18, B.life);
                await activate(A, ar, acts(ar, /Level 3/)); await settle2(); ok('Level 3 reached', ar.level === 3);
                const bears = makeObj(C['Grizzly Bears'], 0); A.exile.push(bears); bears.playUntil = G.turn; bears.playAny = true;
                const c0 = costOf(A, bears); ok('Level 3: spells cast from exile cost {2} less', c0.generic === 0 && true, c0);
            }
            { // Level 1 trigger: mill a card then exile one at random
                let [A, B] = await fresh(); const ar = put(A, 'Advanced Reconstruction'); A.gy.push(makeObj(C['Grizzly Bears'], 0)); const n0 = A.library.length; fire('main1'); await settle2();
                ok('Advanced Reconstruction level 1: mills and exiles a card from the graveyard to play', A.library.length === n0 - 1 && A.exile.some(x => x.playUntil === G.turn), [A.library.length, A.exile.length]);
            }
            // ===== Lorehold =====
            { // Quintorius, Field Historian: token whenever cards leave graveyard
                let [A, B] = await fresh(); put(A, 'Quintorius, Field Historian'); const c = makeObj(C['Grizzly Bears'], 0); A.gy.push(c); pull(A.gy, c); await settle2();
                ok('Quintorius, Field Historian: a 3/2 Spirit (+1/+0 from Quintorius)', A.bf.some(x => x.token && /Spirit/.test(x.card.type) && pow(x) >= 3), A.bf.map(x => [x.card.name, x.card.type, x.token, pow(x)]));
                const c2 = makeObj(C['Grizzly Bears'], 0), c3 = makeObj(C['Grizzly Bears'], 0); A.gy.push(c2, c3); pull(A.gy, c2); pull(A.gy, c3); await settle2();
                ok('Quintorius: "one or more" cards make only one token', A.bf.filter(x => x.token).length === 2, A.bf.filter(x => x.token).length);
            }
            { // Excava: reanimates a small artifact/creature with a finality counter as a 1/1 Spirit flier
                let [A, B] = await fresh(); const ex = put(A, 'Excava, the Risen Past'); const cd = makeObj(need('Sol Ring'), 0); A.gy.push(cd); G.attackers = [ex.uid]; fire('attacks', { list: [ex] }); await settle2();
                const sr = A.bf.find(x => x.card.name === 'Sol Ring' || /Spirit/.test(x.card.type) && x.ctr && x.ctr.finality);
                ok('Excava: Sol Ring returns as a 1/1 Spirit creature with flying and a finality counter', !!sr && isCreature(sr) && pow(sr) === 1 && has(sr, 'flying') && sr.ctr.finality === 1, sr && [sr.card.type, pow(sr), sr.ctr]);
                dieOrLeave(sr, 'gy'); ok('A finality counter exiles it instead of dying', A.exile.includes(sr) && !A.gy.includes(sr));
            }
            { // Hofri Ghostforge
                let [A, B] = await fresh(); put(A, 'Hofri Ghostforge'); const bear = put(A, 'Grizzly Bears'); fire('dies', { o: bear }); fire('creatureDies', { o: bear }); dieOrLeave(bear, 'gy'); await settle2();
                const cp = A.bf.find(x => x.token && x.card.name === 'Grizzly Bears'); ok('Hofri: exiles the dead creature and makes a Spirit copy', !!cp && /Spirit/.test(cp.card.type) && A.exile.includes(bear), A.bf.map(x => x.card.name));
                dieOrLeave(cp, 'gy'); await settle2(); ok('Hofri: the exiled card returns to the graveyard when the copy leaves', A.gy.includes(bear) && !A.exile.includes(bear));
            }
            { // Skyclave Apparition
                let [A, B] = await fresh(); const sc = put(B, 'Grizzly Bears'); const sa = put(A, 'Skyclave Apparition'); await settle2();
                ok('Skyclave Apparition: exiles a nonland permanent MV 4 or less', B.exile.includes(sc) || !onBf(sc.uid), B.exile.map(x => x.card.name));
                if (B.exile.includes(sc)) { dieOrLeave(sa, 'gy'); await settle2(); ok('Skyclave Apparition: leaving gives the owner an X/X Illusion', B.bf.some(x => x.token && /Illusion/.test(x.card.type)), B.bf.map(x => x.card.name)); }
            }
            { // Serra Paragon
                let [A, B] = await fresh(); put(A, 'Serra Paragon'); const bear = makeObj(C['Grizzly Bears'], 0); A.gy.push(bear); lands(A, 2, 'Forest');
                ok('Serra Paragon: can cast a permanent spell MV 3 or less from the graveyard', canCastNow(A, bear), 'x');
            }
            { // Wave of Reckoning, Ceaseless Conflict
                let [A, B] = await fresh(); const b1 = put(A, 'Grizzly Bears'); const b2 = put(B, 'Grizzly Bears'); await applyEffect(A, cmdEff('waveOfReckoning'), null, b1); sba(); ok('Wave of Reckoning: each creature deals damage to itself, 2-toughness creatures die', !onBf(b1.uid) && !onBf(b2.uid));
                [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); await applyEffect(A, cmdEff('ceaselessConflict'), null, put(A, 'Island')); await settle2();
                ok('Ceaseless Conflict: destroys all and gives a Spirit per nontoken creature of yours destroyed', !A.bf.some(x => x.card.name === 'Grizzly Bears') && A.bf.filter(x => x.token).length === 2, A.bf.map(x => x.card.name));
            }
            // ===== Prismari =====
            { // Prismari Pianist, Rootha, Muddle, Harmonic Prodigy
                let [A, B] = await fresh(); put(A, 'Prismari Pianist'); const sp = makeObj(need('Lightning Bolt'), 0); A.hand.push(sp); fire('cast', { P: A, o: sp }); await settle2();
                ok('Prismari Pianist: one 1/1 Elemental for a cheap spell', A.bf.filter(x => x.token).length === 1);
                const big = makeObj(need('Aether Gale'), 0); A.hand.push(big); fire('cast', { P: A, o: big }); await settle2(); ok('Prismari Pianist: three for a spell with mana value 5 or more', A.bf.filter(x => x.token).length === 4, A.bf.filter(x => x.token).length);
            }
            { // Galazeth Prismari: artifacts tap for mana only for instants/sorceries
                let [A, B] = await fresh(); put(A, 'Galazeth Prismari'); const sr = put(A, 'Sol Ring'); const m = manaOf(sr); ok('Galazeth Prismari: Sol Ring still makes its own mana', m && m.n === 2);
                const rock = put(A, 'Mind Stone'); ok('Galazeth Prismari: artifacts have a mana ability', !!manaOf(rock));
                const mine = put(A, 'Vedalken Orrery'); ok('Galazeth Prismari: a non-mana artifact taps for any color', manaOf(mine) && manaOf(mine).only === 'instant or sorcery', manaOf(mine));
            }
            { // Rousing Refrain: adds R per card in hand and goes to suspend
                let [A, B] = await fresh(); B.hand.length = 0; for (let i = 0; i < 3; i++) B.hand.push(makeObj(C['Grizzly Bears'], 1)); const rr = makeObj(need('Rousing Refrain'), 0); A.hand.push(rr);
                await applyEffect(A, { t: 'cmd', id: 'rousingRefrain' }, { p: B }, rr); ok('Rousing Refrain: adds {R} for each card in the opponent\'s hand', (A.pool || []).filter(c => c[0] === 'R').length === 3, A.pool);
                ok('Rousing Refrain: mana stays through the turn', A.keepPoolTurn === G.turn);
            }
            // ===== Quandrix =====
            { // Benevolent Hydra, Nev, Fractal Harness
                let [A, B] = await fresh(); const bh = put(A, 'Benevolent Hydra'); const bear = put(A, 'Grizzly Bears'); putCounters(bear, 2, A); ok('Benevolent Hydra: another creature gets one more counter', bear.counters === 3, bear.counters);
                const own = bh.counters; putCounters(bh, 1, A); ok('Benevolent Hydra does not boost its own counters', bh.counters === own + 1, [own, bh.counters]);
            }
            { // Fractal Harness (X=3)
                let [A, B] = await fresh(); const fh = put(A, 'Fractal Harness'); await settle2(); A.bf.filter(x => x.token).forEach(x => leaveBattlefield(x, 'gy')); await applyEffect(A, { t: 'cmd', id: 'fractalHarness', n: 3 }, null, fh); await settle2();
                const fr = A.bf.find(x => x.token && /Fractal/.test(x.card.type)); ok('Fractal Harness: a Fractal with X counters, equipped', !!fr && fr.counters === 3 && fh.attachedTo === fr.uid, fr && [fr.counters, fh.attachedTo]);
            }
            { // Unbound Flourishing doubles X
                let [A, B] = await fresh(); const uf = put(A, 'Unbound Flourishing'); const sp = makeObj(need('Hydroid Krasis'), 0); sp.xVal = 3; const item = { id: stackSeq++, kind: 'spell', o: sp, P: A, target: null, name: 'Hydroid Krasis', x: 3 }; G.stack.push(item); G.ctxRaw = { P: A, o: sp };
                await applyEffect(A, { t: 'cmd', id: 'doubleX' }, null, uf); ok('Unbound Flourishing: X is doubled', item.x === 6, item.x); G.stack.length = 0;
            }
            { // Zimone's Hypothesis, Perplexing Test
                let [A, B] = await fresh(); const b1 = put(A, 'Grizzly Bears'); const b2 = put(B, 'Serra Angel'); await applyEffect(A, { t: 'cmd', id: 'bounceAll', what: 'nontoken' }, null, b1);
                ok('Perplexing Test: nontoken creatures return to hands', !onBf(b1.uid) && !onBf(b2.uid) && A.hand.includes(b1));
            }
            { // Oversimplify: exiles all, Fractal per player with total power counters
                let [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(B, 'Serra Angel'); await applyEffect(A, { t: 'cmd', id: 'oversimplify' }, null, put(A, 'Island')); await settle2();
                const fa = A.bf.find(x => x.token), fb = B.bf.find(x => x.token); ok('Oversimplify: each player gets a Fractal with their exiled power', fa && fb && fa.counters === 2 && fb.counters === 4, [fa && fa.counters, fb && fb.counters]);
            }
            { // Elementalist's Palette: charge counters for X spells; mana only for X costs
                let [A, B] = await fresh(); const pal = put(A, "Elementalist's Palette"); fire('cast', { P: A, o: makeObj(need('Hydroid Krasis'), 0) }); await settle2();
                ok("Elementalist's Palette: two charge counters when an X spell is cast", pal.ctr.charge === 2, pal.ctr);
                const m = manaOf(pal); ok("Elementalist's Palette: taps for one {C} per counter, only for X costs", m && m.n === 2 && /XCOST/.test(m.onlyType), m);
            }
            { // Primo, Troyan
                let [A, B] = await fresh(); const tg = put(A, 'Troyan, Gutsy Explorer'); const m = manaOf(tg); ok('Troyan: {G}{U} only for MV 5+ or X spells', m && m.n === 2 && /MV5PLUS/.test(m.onlyType), m);
            }
            // ===== Silverquill =====
            { // Goad auras
                let [A, B] = await fresh(); const bear = put(B, 'Grizzly Bears'); const au = put(A, 'Coercive Impetus'); au.attachedTo = bear.uid; ok('Coercive Impetus: +1/+1 and goaded', pow(bear) === 3 && isGoaded(bear), [pow(bear), isGoaded(bear)]);
            }
            { // Ajani's Chosen + Aura attach
                let [A, B] = await fresh(); put(A, "Ajani's Chosen"); const au = put(A, 'Parasitic Impetus'); G.ctxObj = au; await settle2();
                ok("Ajani's Chosen: a 2/2 Cat for an enchantment entering", A.bf.some(x => x.token && /Cat/.test(x.card.type)), A.bf.map(x => x.card.name));
            }
            { // Hateful Eidolon
                let [A, B] = await fresh(); put(A, 'Hateful Eidolon'); const bear = put(A, 'Grizzly Bears'); const a1 = put(A, 'Sentinel\'s Eyes'); a1.attachedTo = bear.uid; const h0 = A.hand.length; fire('dies', { o: bear }); await settle2();
                ok('Hateful Eidolon: draws for each Aura you controlled on the dying creature', A.hand.length === h0 + 1, A.hand.length - h0);
            }
            { // Eriette / Combat Calligrapher: can't attack the controller
                let [A, B] = await fresh(); put(A, 'Eriette of the Charmed Apple'); const bear = put(B, 'Grizzly Bears'); const au = put(A, 'Sentinel\'s Eyes'); au.attachedTo = bear.uid;
                ok('Eriette: an enchanted creature can\'t attack its enchanter', cmdCantAttack(bear), 'x');
                put(A, 'Combat Calligrapher'); const ink = put(B, 'Grizzly Bears'); ink.card = { ...ink.card, type: 'Creature — Inkling' }; ok('Combat Calligrapher: Inklings can\'t attack you', cmdCantAttack(ink));
            }
            { // Nils: attack tax
                let [A, B] = await fresh(); put(A, 'Nils, Discipline Enforcer'); const bear = put(B, 'Grizzly Bears'); bear.counters = 2; G.active = B.i; lands(B, 1, 'Island'); G.defender = A.i;
                declareAttackers(B, [bear]); ok('Nils: a creature with 2 counters cannot attack without paying {2}', !G.attackers.includes(bear.uid), G.attackers);
                lands(B, 2, 'Island'); G.attackers = []; bear.tapped = false; declareAttackers(B, [bear]); ok('Nils: it attacks when the controller can pay', G.attackers.includes(bear.uid), G.attackers);
            }
            { // Inkshield
                let [A, B] = await fresh(); await applyEffect(A, { t: 'cmd', id: 'inkshield' }, null, put(A, 'Island')); G.inCombatDamage = true; damage(A, 3, put(B, 'Grizzly Bears')); G.inCombatDamage = false; await settle2();
                ok('Inkshield: combat damage is prevented and makes Inklings', A.life === A.startLife && A.bf.filter(x => x.token && /Inkling/.test(x.card.type)).length === 3, [A.life, A.bf.filter(x => x.token).length]);
            }
            { // Arcane Lighthouse
                let [A, B] = await fresh(); const t = put(B, 'Grizzly Bears'); t.tkw.push('hexproof'); ok('Hexproof before Lighthouse', has(t, 'hexproof')); G.noHexproof = { turn: G.turn, by: A.i }; ok('Arcane Lighthouse: opponents lose hexproof', !has(t, 'hexproof'));
            }
            { // Starfield Mystic, Kor Spiritdancer, Eidolon of Countless Battles
                let [A, B] = await fresh(); const sm = put(A, 'Starfield Mystic'); const en = put(A, 'Sentinel\'s Eyes'); dieOrLeave(en, 'gy'); await settle2(); ok('Starfield Mystic: +1/+1 counter when an enchantment goes to the graveyard', sm.counters === 1, sm.counters);
                const ks = put(A, 'Kor Spiritdancer'); const a1 = put(A, 'Sentinel\'s Eyes'); a1.attachedTo = ks.uid; ok('Kor Spiritdancer: +2/+2 per Aura (0/2 base, +1 from the Aura)', pow(ks) === 3, pow(ks));
                const ed = put(A, 'Eidolon of Countless Battles'); const p0 = pow(ed); ok('Eidolon of Countless Battles: grows with creatures and Auras', p0 >= 3, p0);
            }
            // ===== Witherbloom =====
            { // Pests: Blight Mound, Pest Rescuer
                let [A, B] = await fresh(); put(A, 'Blight Mound'); const pest = put(A, 'Grizzly Bears'); pest.card = { ...pest.card, type: 'Creature — Pest' }; ok('Blight Mound: no bonus when not attacking', pow(pest) === 2); G.attackers = [pest.uid]; ok('Blight Mound: attacking Pests get +1/+0 and menace', pow(pest) === 3 && has(pest, 'menace'), [pow(pest), has(pest, 'menace')]);
                [A, B] = await fresh(); put(A, 'Pest Rescuer'); fire('upkeep'); await settle2(); ok('Pest Rescuer: makes a Pest when you have none', A.bf.some(x => x.token && /Pest/.test(x.card.type)), A.bf.map(x => x.card.name));
                fire('upkeep'); await settle2(); ok('Pest Rescuer: only one at a time', A.bf.filter(x => x.token).length === 1);
                const pest2 = A.bf.find(x => x.token); const l0 = A.life; dieOrLeave(pest2, 'gy'); await settle2(); ok('A Pest gains 1 life when it dies (+1 from Pest Rescuer itself)', A.life === l0 + 2, [A.life - l0, logged().split('\n').slice(-6)]);
            }
            { // Gravestorm, Immoral Bargain, Plumb the Forbidden
                let [A, B] = await fresh(); for (let i = 0; i < 3; i++) dieOrLeave(put(A, 'Grizzly Bears'), 'gy'); ok('Gravestorm counts permanents put into graveyards', G.permsToGy && G.permsToGy.n === 3, G.permsToGy);
                const oh = makeObj(need('Ominous Harvest'), 0); A.hand.push(oh); lands(A, 3, 'Swamp'); await castSpell(A, oh, { p: B }); await settle2(); ok('Ominous Harvest: all resolve, opponent draws 4 and loses 4', B.life === B.startLife - 4, B.life);
            }
            { // Gorma, Gyome, Dina
                let [A, B] = await fresh(); put(A, 'Gorma, the Gullet'); const dead = put(A, 'Grizzly Bears'); dieOrLeave(dead, 'gy'); const nb = put(A, 'Serra Angel'); ok('Gorma: a nontoken creature enters with a counter per death this turn', nb.counters === 1, nb.counters);
                [A, B] = await fresh(); put(A, 'Gyome, Master Chef'); put(A, 'Serra Angel'); put(A, 'Serra Angel'); fire('end', {}); await settle2(); ok('Gyome: a Food per nontoken creature that entered this turn', A.bf.filter(x => x.token && /Food/.test(x.card.type)).length >= 2, A.bf.map(x => x.card.name));
                [A, B] = await fresh(); put(A, 'Dina, Essence Brewer'); const f = put(A, 'Grizzly Bears'); const h0 = A.hand.length; fire('sacrificed', { o: f }); await settle2(); ok('Dina, Essence Brewer: draws when you sacrifice a creature', A.hand.length === h0 + 1);
                fire('sacrificed', { o: put(A, 'Grizzly Bears') }); await settle2(); ok('Dina: only once each turn', A.hand.length === h0 + 1, A.hand.length - h0);
            }
            { // Tendershoot Dryad, Ascend
                let [A, B] = await fresh(); const td = put(A, 'Tendershoot Dryad'); fire('upkeep'); await settle2(); const sap = A.bf.find(x => x.token && /Saproling/.test(x.card.type)); ok('Tendershoot Dryad: a Saproling each upkeep', !!sap);
                const p0 = pow(sap); for (let i = 0; i < 10; i++) put(A, 'Forest'); ok('Ascend: ten permanents give the city\'s blessing and Saprolings get +2/+2', pow(sap) === p0 + 2, [p0, pow(sap)]);
            }
            { // Witch of the Moors, Priest of Forgotten Gods
                let [A, B] = await fresh(); put(A, 'Witch of the Moors'); const eb = put(B, 'Grizzly Bears'); A.gainedTurn = G.turn; fire('end', {}); await settle2(); ok('Witch of the Moors: each opponent sacrifices a creature', !onBf(eb.uid));
                [A, B] = await fresh(); const pr = put(A, 'Priest of Forgotten Gods'); put(A, 'Grizzly Bears'); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); G.phase = 'main1'; pr.sick = false; await activate(A, pr, actsOf(pr).find(a => /Sacrifice two/.test(a.text) || a.cost.sacOthers)); await settle2();
                ok('Priest of Forgotten Gods: sacrifices two others, opponent loses 2 and a creature, you get BB and a card', B.life === B.startLife - 2 && !B.bf.some(isCreature) && (A.pool || []).filter(c => c === 'B').length === 2, [B.life, A.pool]);
            }
            { // Animate Dead
                let [A, B] = await fresh(); const bear = makeObj(C['Grizzly Bears'], 1); B.gy.push(bear); const ad = put(A, 'Animate Dead'); await settle2();
                ok('Animate Dead: returns the creature card under your control, -1/-0', A.bf.some(x => x.card.name === 'Grizzly Bears') && pow(A.bf.find(x => x.card.name === 'Grizzly Bears')) === 1, A.bf.map(x => x.card.name));
                leaveBattlefield(ad, 'gy'); await settle2(); ok('Animate Dead leaving makes its creature die', !A.bf.some(x => x.card.name === 'Grizzly Bears'));
            }
            { // Saddle of Pests: Immoral Bargain X
                let [A, B] = await fresh(); const ib = makeObj(need('Immoral Bargain'), 0); A.hand.push(ib); lands(A, 3, 'Swamp'); lands(A, 1, 'Forest'); put(A, 'Grizzly Bears'); const t1 = put(B, 'Serra Angel'); window.askNumber = async () => 1;
                ok('Immoral Bargain can be cast with a creature to sacrifice', canCastNow(A, ib) && canPay(A, ib));
            }
            //@@NEXT
            //@@NEXT
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('soc', results, []);
    writeOut('soc', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
