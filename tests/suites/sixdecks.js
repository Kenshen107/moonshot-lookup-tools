// Six owner decks (2026-11-12): Super-Skrull, Aurelia, the Law Above, Doc Samson, Plargg and Nassari, Rukarumel, Astarion. Reader checks for each deck
// (listed in VERIFIED_DECKS, no deck problems, every card fully Automated) plus behaviour checks for the new engine pieces
// (spellslinger/rules/sixdecks.js, 15v-sixdecks.js). Cards come live from Scryfall.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
const KEYS = { superskrull: 'super-skrull', aurelialaw: 'aurelia-law-above', docsamson: 'doc-samson', plargg: 'plargg-nassari', rukarumel: 'rukarumel', astarion: 'astarion' };
const NAMES = [...new Set(['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Lightning Bolt', 'Wall of Stone', 'Sliver Construct', 'Shivan Dragon',
    'Training Grounds', 'High Alert', 'Doran, Besieged by Time', 'Blight Pile', 'Sarinth Greatwurm', 'Gisela, Blade of Goldnight', 'Anya, Merciless Angel', 'Basandra, Battle Seraph',
    'Wingnut, Bat on the Belfry', 'Warcry Phoenix', 'Blast Zone', 'Mage-Ring Network', 'Sword of the Paruns', 'Hydra Broodmaster', 'Llanowar Reborn', 'Artisan of Kozilek', 'Avatar of Slaughter',
    'Chandra, Awakened Inferno', 'Fanatic of Mogis', 'Urabrask, Heretic Praetor', 'Planetary Annihilation', 'Wild Magic Surge', 'Rukarumel, Biologist', 'Maskwood Nexus', 'Crystalline Sliver',
    'Virulent Sliver', 'Springleaf Parade', 'Formless Genesis', 'Astarion, the Decadent', 'Blood Tribute', 'Essence Pulse', 'Elenda, Saint of Dusk', 'Smoke Bomb', 'Rush of Dread', 'Cloud Key',
    'Relic of Sauron', 'Interdimensional Web Watch', 'Counterspell', 'Alexios, Deimos of Kosmos', 'Molten Disaster', 'Abstruse Appropriation', 'Gemstone Caverns', 'Spider-Verse', 'Mindless Automaton', 'Moxite Refinery',
    'Noxious Revival', 'Hideous Taskmaster', 'Rooftop Percher', 'Shadow of the Second Sun', 'Maximum Carnage', 'Curse of Obsession'])];

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async ([NAMES, KEYS]) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.stack.length = 0; G.endQ = []; G.extraCombat = 0; G.attackers = []; G.blocks = {}; A.isAI = true; B.isAI = true; A.life = 40; B.life = 40; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 30; i++) { A.library.push(makeObj(have('Mountain'), 0)); B.library.push(makeObj(have('Mountain'), 1)); } A.hand.length = 0; B.hand.length = 0; return [A, B]; };
            const put = (P, n) => { const o = T.put(P, have(n)); o.sick = false; return o; };
            const settle2 = async () => { await settle(); await settle(); };
            const hit = async (A, list) => { G.attackers = list.map(x => x.uid); G.blocks = {}; G.defender = 1; list.forEach(x => { x.tapped = !has(x, 'vigilance'); }); fire('attacks', { list }); await settle2(); combatDamage(A); await settle2(); };

            // The decks
            for (const [key, file] of Object.entries(KEYS)) {
                const v = VERIFIED_DECKS.find(x => x.key === key); ok(`${file}: listed in VERIFIED_DECKS`, !!v); if (!v) continue;
                const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck);
                ok(`${file}: no deck problems`, probs.length === 0, probs.slice(0, 4));
                const cards = [...new Set((deck.entries || []).map(x => x.card).filter(Boolean))]; const bad = cards.filter(c => rulesFor(c).support !== 'full').map(c => c.name);
                ok(`${file}: every card reads as fully Automated`, bad.length === 0, bad);
            }
            // ----- Super-Skrull -----
            { const [A] = await fresh(); put(A, 'Training Grounds'); const ss = put(A, 'Sliver Construct');
              const a = { cost: { mana: parseCost('{2}{W}') }, text: 'x' }; const b = { cost: { mana: parseCost('{3}') }, text: 'y' };
              ok('Training Grounds: a creature ability costing {2}{W} costs {W}', actCost(ss, a).generic === 0 && actCost(ss, a).W === 1, actCost(ss, a));
              ok('Training Grounds: {3} becomes {1} (never below one mana)', actCost(ss, b).generic === 1, actCost(ss, b)); }
            { const [A, B] = await fresh(); put(A, 'High Alert'); const w = put(A, 'Wall of Stone');
              ok('High Alert: a creature with defender can attack', canAttackWith(w), w.card.name); await hit(A, [w]);
              ok('High Alert: Wall of Stone (0/8) deals damage equal to its toughness', B.life === 32, B.life); }
            { const [A] = await fresh(); put(A, 'Doran, Besieged by Time'); const w = put(A, 'Wall of Stone'); G.attackers = [w.uid]; fire('attacks', { list: [w] }); await settle2();
              ok('Doran: an attacking 0/8 gets +8/+8 until end of turn', pow(w) === 8 && tou(w) === 16, [pow(w), tou(w)]); }
            { const [A, B] = await fresh(); put(A, 'Wall of Stone'); put(A, 'Wall of Stone'); const bp = put(A, 'Blight Pile'); await CMD.sx_blightPile(A, {}, null, bp);
              ok('Blight Pile: each opponent loses 1 life per creature with defender (two walls and the Pile)', B.life === 37, B.life); }
            { const [A, B] = await fresh(); put(A, 'Sarinth Greatwurm'); const l = put(B, 'Forest'); fire('landfall', { o: l }); await settle2();
              ok('Sarinth Greatwurm: an opponent\'s land makes you a tapped Powerstone', A.bf.some(x => x.card.name === 'Powerstone' && x.tapped), A.bf.map(x => x.card.name)); }
            // ----- Aurelia -----
            { const [A, B] = await fresh(); put(A, 'Gisela, Blade of Goldnight'); damage(B, 3, null); damage(A, 5, null);
              ok('Gisela: 3 damage to an opponent becomes 6', B.life === 34, B.life); ok('Gisela: 5 damage to you becomes 2 (half prevented, rounded up)', A.life === 38, A.life); }
            { const [A, B] = await fresh(); const an = put(A, 'Anya, Merciless Angel'); const p0 = pow(an); B.life = 19;
              ok('Anya: +3/+3 and indestructible while an opponent is under half their starting life', pow(an) === p0 + 3 && has(an, 'indestructible'), [p0, pow(an)]); }
            { const [A] = await fresh(); put(A, 'Basandra, Battle Seraph'); const bolt = makeObj(have('Lightning Bolt'), 0); A.hand.push(bolt); put(A, 'Mountain'); G.phase = 'declareBlocks';
              ok('Basandra: no spells during combat', !canCastNow(A, bolt)); G.phase = 'main1'; ok('...but in a main phase the Bolt can be cast', canCastNow(A, bolt)); }
            { const [A] = await fresh(); const wn = put(A, 'Wingnut, Bat on the Belfry'); const g = put(A, 'Grizzly Bears'); G.attackers = [wn.uid, g.uid]; fire('attacks', { list: [wn, g] }); await settle2();
              ok('Wingnut: each other attacking creature gets +1/+0', pow(g) === 3, pow(g)); }
            { const [A] = await fresh(); const ph = makeObj(have('Warcry Phoenix'), 0); A.gy.push(ph); for (let i = 0; i < 3; i++) put(A, 'Mountain'); const list = [put(A, 'Grizzly Bears'), put(A, 'Grizzly Bears'), put(A, 'Hill Giant')];
              G.attackers = list.map(x => x.uid); G.defender = 1; fire('attacks', { list }); await settle2();
              ok('Warcry Phoenix: attacking with three creatures returns it tapped and attacking', onBf(ph.uid) && ph.tapped && G.attackers.includes(ph.uid), [!!onBf(ph.uid), A.gy.length]); }
            // ----- Doc Samson -----
            { const [A, B] = await fresh(); const bz = put(A, 'Blast Zone'); bz.ctr.charge = 2; const bears = put(B, 'Grizzly Bears'), giant = put(B, 'Hill Giant'); await CMD.sx_blastZone(A, {}, null, bz); await settle2();
              ok('Blast Zone: destroys the mana value 2 permanents only', !onBf(bears.uid) && !!onBf(giant.uid), [!!onBf(bears.uid), !!onBf(giant.uid)]); }
            { const [A] = await fresh(); const mr = put(A, 'Mage-Ring Network'); mr.ctr.storage = 3; A.pool = []; await CMD.sx_storage(A, {}, null, mr);
              ok('Mage-Ring Network: removing three storage counters adds {C}{C}{C}', A.pool.filter(c => c === 'C').length === 3 && mr.ctr.storage === 0, A.pool); }
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'), g2 = put(A, 'Hill Giant'); const sw = put(A, 'Sword of the Paruns'); sw.attachedTo = g.uid;
              ok('Sword of the Paruns: untapped creatures get +0/+2 while the equipped one is untapped', tou(g2) === 5, tou(g2));
              g.tapped = true; g2.tapped = true; ok('...and tapped creatures +2/+0 while it is tapped', pow(g2) === 5, pow(g2)); }
            { const [A] = await fresh(); const hb = put(A, 'Hydra Broodmaster'); await applyEffect(A, { t: 'monstrosity', n: 2 }, null, hb); await settle2();
              ok('Hydra Broodmaster: monstrosity 2 makes two 2/2 Hydras', A.bf.filter(x => x.token && /Hydra/.test(x.card.name) && pow(x) === 2).length === 2, A.bf.filter(x => x.token).map(x => `${x.card.name} ${pow(x)}`)); }
            { const [A] = await fresh(); const lr = put(A, 'Llanowar Reborn'); await settle2(); if (lr.counters < 1) await CMD.sx_graftEnter(A, { n: 1 }, null, lr); const g = put(A, 'Grizzly Bears'); fire('enters', { o: g }); await settle2();
              ok('Llanowar Reborn (graft): its +1/+1 counter moves onto a creature that enters', g.counters === 1 && lr.counters === 0, [g.counters, lr.counters]); }
            // ----- Plargg and Nassari -----
            { const [A, B] = await fresh(); const ak = put(A, 'Artisan of Kozilek'); put(B, 'Forest'); put(B, 'Forest'); put(B, 'Grizzly Bears'); const n0 = B.bf.length; G.attackers = [ak.uid]; G.defender = 1; fire('attacks', { list: [ak] }); await settle2();
              ok('Annihilator 2: the defending player sacrifices two permanents', B.bf.length === n0 - 2, [n0, B.bf.length]); }
            { const [A, B] = await fresh(); put(A, 'Avatar of Slaughter'); const g = put(B, 'Grizzly Bears');
              ok('Avatar of Slaughter: every creature has double strike and must attack', has(g, 'double strike') && forcedAttack(g)); }
            { const [A, B] = await fresh(); const ch = put(A, 'Chandra, Awakened Inferno'); await CMD.sx_chandraEmblem(A, {}, null, ch); G.active = 1; fire('upkeep', {}); await settle2();
              ok('Chandra +2: the opponent\'s emblem deals 1 damage at their upkeep', B.life === 39, B.life); }
            { const [A, B] = await fresh(); put(A, 'Mountain'); const f = put(A, 'Fanatic of Mogis'); await CMD.sx_fanatic(A, {}, null, f);
              ok('Fanatic of Mogis: damage equal to devotion to red (its own {R})', B.life === 39, B.life); }
            { const [A, B] = await fresh(); put(A, 'Urabrask, Heretic Praetor'); G.active = 1; fire('upkeep', {}); await settle2(); const h0 = B.hand.length, e0 = B.exile.length; drawCards(B, 1);
              ok('Urabrask: the opponent\'s next draw is exiled and playable this turn', B.hand.length === h0 && B.exile.length === e0 + 1 && B.exile[B.exile.length - 1].playUntil === G.turn, [B.hand.length - h0, B.exile.length - e0]); }
            { const [A, B] = await fresh(); for (let i = 0; i < 8; i++) { put(A, 'Mountain'); put(B, 'Forest'); } const g = put(B, 'Hill Giant'); const pa = makeObj(have('Planetary Annihilation'), 0); await CMD.sx_planetary(A, {}, null, pa); await settle2(); sba(); await settle2();
              ok('Planetary Annihilation: each player keeps six lands; 6 damage to each creature', A.bf.filter(x => /Land/.test(x.card.type)).length === 6 && B.bf.filter(x => /Land/.test(x.card.type)).length === 6 && !onBf(g.uid), [A.bf.length, B.bf.length]); }
            { const [A, B] = await fresh(); const g = put(B, 'Grizzly Bears'); B.library.push(makeObj(have('Hill Giant'), 1)); const ws = makeObj(have('Wild Magic Surge'), 0); await CMD.sx_wildSurge(A, {}, { o: g }, ws); await settle2();
              ok('Wild Magic Surge: destroys it; its controller reveals until a creature and puts it onto the battlefield', !onBf(g.uid) && B.bf.some(x => x.card.name === 'Hill Giant'), B.bf.map(x => x.card.name)); }
            // ----- Rukarumel -----
            { const [A] = await fresh(); const ru = put(A, 'Rukarumel, Biologist'); ru.chosenType = 'Dragon'; const g = put(A, 'Grizzly Bears'); const gH = makeObj(have('Grizzly Bears'), 0); A.hand.push(gH);
              ok('Rukarumel: your nontoken creatures are the chosen type', hasType(g, 'Dragon')); ok('...and so are creature cards you own elsewhere', hasType(gH, 'Dragon')); ok('...but not another type', !hasType(g, 'Elf')); }
            { const [A, B] = await fresh(); put(A, 'Maskwood Nexus'); const g = put(A, 'Grizzly Bears'), gB = put(B, 'Grizzly Bears');
              ok('Maskwood Nexus: your creatures are every creature type', hasType(g, 'Sliver') && hasType(g, 'Wizard')); ok('...not an opponent\'s', !hasType(gB, 'Sliver')); ok('...and a creature is still not a Plains', !hasType(g, 'Plains')); }
            { const [A, B] = await fresh(); put(A, 'Crystalline Sliver'); const s = put(B, 'Sliver Construct'); ok('Crystalline Sliver: all Slivers have shroud', has(s, 'shroud')); }
            { const [A, B] = await fresh(); put(A, 'Virulent Sliver'); const s = put(A, 'Sliver Construct'); await hit(A, [s]); ok('Virulent Sliver: a Sliver that hits gives a poison counter', (B.poison || 0) === 1, B.poison); }
            { const [A] = await fresh(); put(A, 'Springleaf Parade'); await applyEffect(A, { t: 'token', n: 1, p: 1, q: 1, name: 'green Elf', kw: [] }, null, A.bf[0]); const tok = A.bf.find(x => x.token);
              ok('Springleaf Parade: creature tokens tap for any color', !!tok && !!manaOf(tok) && manaOf(tok).colors.length === 5, tok && manaOf(tok)); }
            { const [A] = await fresh(); for (let i = 0; i < 3; i++) A.gy.push(makeObj(have('Forest'), 0)); const fg = makeObj(have('Formless Genesis'), 0); await CMD.sx_formless(A, {}, null, fg); const tok = A.bf.find(x => x.token);
              ok('Formless Genesis: an X/X changeling with deathtouch, X = lands in your graveyard', !!tok && pow(tok) === 3 && has(tok, 'deathtouch') && hasType(tok, 'Sliver'), tok && [pow(tok), tok.card.text]); }
            { const ck = rulesFor(have('Cloud Key')); ok('Cloud Key keeps its own card-type cost cut (the creature-type wording does not take it)', !ck.reducer || ck.reducer.what !== 'chosenType', ck.reducer); }
            // ----- Astarion -----
            { const [A, B] = await fresh(); const as = put(A, 'Astarion, the Decadent'); damage(B, 5, null); B.lostTurn = G.turn; await CMD.sx_astarionLose(A, {}, { p: B }, as);
              ok('Astarion (Feed): the opponent loses as much again as they lost this turn', B.life === 30, B.life); }
            { const [A, B] = await fresh(); const g = put(A, 'Grizzly Bears'); g.card = { ...g.card, type: 'Creature — Vampire' }; g._r = null; const bt = makeObj(have('Blood Tribute'), 0); A.hand.push(bt); await payAddCost(A, bt); ok('Blood Tribute: the kicker is paid as it is cast', bt.kicked === true && g.tapped, [bt.kicked, g.tapped]); await CMD.sx_bloodTribute(A, {}, { p: B }, bt);
              ok('Blood Tribute: the opponent loses half their life, rounded up', B.life === 20, B.life); ok('...kicked by tapping a Vampire: you gain that much', A.life === 60 && g.tapped, [A.life, g.tapped]); }
            { const [A, B] = await fresh(); const g = put(B, 'Grizzly Bears'); const ep = makeObj(have('Essence Pulse'), 0); await CMD.sx_essencePulse(A, {}, null, ep); await settle2(); sba(); await settle2();
              ok('Essence Pulse: gain 2, then each creature gets -2/-2', A.life === 42 && !onBf(g.uid), [A.life, !!onBf(g.uid)]); }
            { const [A] = await fresh(); const el = put(A, 'Elenda, Saint of Dusk'); const p0 = pow(el); A.startLife = 40; A.life = 41; const p1 = pow(el); A.life = 50; const p2 = pow(el);
              ok('Elenda: +1/+1 and menace above your starting life, another +5/+5 at 10 more', p1 === p0 + 1 && p2 === p0 + 6, [p0, p1, p2]); }
            { const [A, B] = await fresh(); put(A, 'Smoke Bomb'); const g = put(B, 'Grizzly Bears'); ok('Smoke Bomb: all creatures have shroud', has(g, 'shroud')); }
            { const rd = rulesFor(have('Rush of Dread')); ok('Rush of Dread: three Spree modes are read', rd.support === 'full' && rd.modes && rd.modes.length === 3, rd.unhandled); }

            // ----- The simplifications fixed -----
            { const [A] = await fresh(); put(A, 'Relic of Sauron'); const cs = makeObj(have('Counterspell'), 0); A.hand.push(cs);
              ok('Relic of Sauron: pays {U}{U} alone (two mana in any combination)', !!planPayment(A, parseCost('{U}{U}'), 0, null, payOpts(cs)));
              ok('...and {U}{B}', !!planPayment(A, parseCost('{U}{B}'), 0, null, {})); }
            { const [A, B] = await fresh(); put(A, 'Interdimensional Web Watch'); const g = makeObj(have('Grizzly Bears'), 0); A.hand.push(g);
              ok('Interdimensional Web Watch: its mana can\'t cast a spell from hand', !planPayment(A, costOf(A, g), 0, null, payOpts(g)));
              pull(A.hand, g); A.exile.push(g); ok('...but can cast one from exile', !!planPayment(A, costOf(A, g), 0, null, payOpts(g))); }
            { const [A, B] = await fresh(); const al = put(B, 'Alexios, Deimos of Kosmos'); al.realOwner = 0; giveControl(al, B) || (al.owner = 1);
              ok('Alexios: never offered as a sacrifice', !sacCandidates(B, null, 'creature').includes(al));
              ok('Alexios: can\'t attack its owner (the only opponent)', !canAttackWith(al)); }
            { const [A, B] = await fresh(); const md = makeObj(have('Molten Disaster'), 1); md.kicked = true; G.stack.push({ id: 999, kind: 'spell', o: md, P: B, kicked: true, name: 'Molten Disaster' }); put(A, 'Mountain'); const bolt = makeObj(have('Lightning Bolt'), 0); A.hand.push(bolt);
              ok('Molten Disaster kicked: split second stops spells', !canCastNow(A, bolt)); G.stack.length = 0; ok('...and only while it is on the stack', canCastNow(A, bolt)); }
            { const [A, B] = await fresh(); put(A, 'Mountain'); put(A, 'Mountain'); const cs = makeObj(have('Counterspell'), 1); exilePlayFrom(A, B, cs, G.turn); cs.sx_anyColor = G.turn;
              ok('Grenzo / Stolen Strategy: mana spent as though any color pays {U}{U} with Mountains', !!planPayment(A, costOf(A, cs), 0, null, payOpts(cs))); }
            { const [A, B] = await fresh(); put(A, 'Sol Ring'); const cs = makeObj(have('Counterspell'), 1); exilePlayFrom(A, B, cs, Infinity); cs.sx_colorlessAny = true;
              ok('Abstruse Appropriation: colorless mana pays the exiled card\'s colored cost', !!planPayment(A, costOf(A, cs), 0, null, payOpts(cs)));
              const cs2 = makeObj(have('Counterspell'), 0); A.hand.push(cs2); ok('...but not a card in hand', !planPayment(A, costOf(A, cs2), 0, null, payOpts(cs2))); }
            { const [A, B] = await fresh(); G.active = 0; B.hand.push(makeObj(have('Gemstone Caverns'), 1)); B.hand.push(makeObj(have('Grizzly Bears'), 1)); await sxOpeningHand(); const gc = B.bf.find(x => x.card.name === 'Gemstone Caverns');
              ok('Gemstone Caverns: the second player begins with it on the battlefield and a luck counter, exiling a card', !!gc && gc.ctr.luck === 1 && B.exile.length === 1, [!!gc, B.exile.length]);
              ok('...and with the luck counter it taps for any color', !!gc && manaOf(gc).colors.length === 5); }
            { const [A] = await fresh(); put(A, 'Spider-Verse'); const s1 = put(A, 'Gisela, Blade of Goldnight'), s2 = put(A, 'Gisela, Blade of Goldnight'); [s1, s2].forEach(x => { x.card = { ...x.card, type: 'Legendary Creature — Angel Spider' }; x._r = null; }); sba(); await settle2();
              ok('Spider-Verse: the legend rule doesn\'t apply to Spiders you control', !!onBf(s1.uid) && !!onBf(s2.uid)); }
            { const [A] = await fresh(); const ma = put(A, 'Mindless Automaton'); const a = Rx(ma).acts.find(x => /Remove two/.test(x.text)); ma.counters = 1;
              ok('Mindless Automaton: removing two +1/+1 counters is a cost (one is not enough)', !actPlan(A, ma, a)); ma.counters = 2; ok('...two is', !!actPlan(A, ma, a)); }
            { const [A] = await fresh(); put(A, 'Mountain'); put(A, 'Mountain'); const mx = put(A, 'Moxite Refinery'); const g = put(A, 'Grizzly Bears'); g.counters = 3; const h = put(A, 'Hill Giant'); const a = Rx(mx).acts.find(x => x.sx_moxite);
              await activate(A, mx, a); await settle2();
              ok('Moxite Refinery: the counters come off as it is activated and land on the target', g.counters === 0 && h.counters === 3, [g.counters, h.counters]); }
            { const [A, B] = await fresh(); A.gy.push(makeObj(have('Hill Giant'), 0)); B.gy.push(makeObj(have('Grizzly Bears'), 1)); const m = await sxMultiChoose(A, makeObj(have('Noxious Revival'), 0), 'sx_gy1');
              ok('Noxious Revival: the card is chosen as it is cast (any graveyard)', m.list.length === 1 && m.list[0].card.name === 'Hill Giant', m.list.map(c => c.card.name)); }
            { const [A, B] = await fresh(); const tm = makeObj(have('Hideous Taskmaster'), 0); G.trigQ = []; fire('cast', { P: A, o: tm });
              ok('Hideous Taskmaster: its cast trigger chooses targets as it goes on the stack', (G.trigQ || []).some(q => q.effects.some(x => x.multi === 'sx_eachOpp'))); G.trigQ = []; }
            { const [A] = await fresh(); const sh = put(A, 'Shadow of the Second Sun'); await CMD.sx_enchantChoose(A, {}, null, sh); ok('Shadow of the Second Sun: a player is chosen (the computer picks itself)', sh.hostPlayer === 0); }
            { const [A, B] = await fresh(); const cu = put(A, 'Curse of Obsession'); await CMD.sx_enchantChoose(A, { curse: true }, null, cu); ok('Curse of Obsession: a Curse goes on an opponent', cu.hostPlayer === 1, cu.hostPlayer); }
            ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [NAMES, KEYS]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('sixdecks', results, []);
    writeOut('sixdecks', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
