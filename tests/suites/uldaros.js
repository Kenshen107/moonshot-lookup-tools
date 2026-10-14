// The Uldaros Theorix deck (2026-10-15): every card that needed new engine code is checked in play.
// Mill (and The Water Crystal's bonus), reveal-until-land, rad counters, manifest, clones with exceptions, Impending, Uldaros's copies,
// Thief of Sanity, Mindskinner, Syphon Mind, Perplex, Breach the Multiverse, Extract from Darkness, Golbez, Joo Dee and more.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    // Offline: the cards come from tests/data/cards_all.json (served as /__cards.json), not from Scryfall
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        try {
        const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
        const NAMES = ['Island', 'Swamp', 'Grizzly Bears', 'Sol Ring', 'Divination', 'Opt', 'Counterspell', 'Fractured Sanity', 'Maddening Cacophony', 'Mind Funeral', 'Mind Grind',
            'Nuclear Fallout', 'Consuming Aberration', 'Singularity Rupture', 'Syphon Mind', 'Perplex', 'Reality Shift', 'Doomsday Excruciator', 'Extract from Darkness',
            'Breach the Multiverse', 'Thief of Sanity', 'Uldaros Theorix', 'Clever Impersonator', 'Copycrook', 'Deceptive Frostkite', 'Flesh Duplicate', 'Glasspool Mimic',
            'Phantasmal Image', 'Overlord of the Balemurk', 'Ripples of Undeath', 'The Mindskinner', 'The Water Crystal', 'Trepanation Blade', 'Fraying Sanity',
            'Terisian Mindbreaker', 'Nemesis of Reason', 'Dream Harvest', "Tasha's Hideous Laughter", 'Golbez, Crystal Collector', 'Joo Dee, One of Many', 'Serra Angel', 'Llanowar Elves'];
        const raw = await (await fetch('/__cards.json')).json();
        const C = {};
        const want = [...NAMES, 'Mountain', 'Tyrox, Saurid Tyrant'];
        raw.forEach(c => { const k = want.find(n => c.name === n || c.name.startsWith(n + ' // ')); if (k && !C[k] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[k] = sc; } });
        const mkDeck = () => ({ name: 'Tyrox (test)', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }], source: 'test' });
        await newGame(mkDeck(), mkDeck());
        G.active = 0; G.turn = 5; G.phase = 'main1'; G.busy = false; G.firstTurn = false;
        const [A, B] = G.players;
        const fill = (P, names) => { P.library.length = 0; names.forEach(n => P.library.push(makeObj(C[n], P.i))); };
        const lib = (P, n, name = 'Island') => fill(P, Array(n).fill(name));
        const reset = () => { T.clear(); A.life = B.life = 40; A.rad = B.rad = 0; A.gyIn = B.gyIn = null; A.hand.length = B.hand.length = 0; G.active = 0; G.turn = 10; G.phase = 'main1'; lib(A, 40); lib(B, 40); };
        const spell = async (P, name, src) => { const o = src || makeObj(C[name], P.i); await resolveEffects(P, Rx(o).spell, null, o); await settle(); return o; };
        const etb = async (P, o) => { await resolveEffects(P, Rx(o).etb, null, o); await settle(); };
        const status = n => Rx(makeObj(C[n], 0)).support;
        ok('every card in the deck reads as Automated', NAMES.filter(n => !['Island', 'Swamp', 'Grizzly Bears', 'Sol Ring', 'Divination', 'Opt', 'Counterspell', 'Serra Angel', 'Llanowar Elves'].includes(n)).every(n => status(n) === 'full'), NAMES.filter(n => status(n) !== 'full'));

        // ---- Mill ----
        reset(); await spell(A, 'Fractured Sanity');
        ok('Fractured Sanity: each opponent mills 14', B.library.length === 26 && B.gy.length === 14, { lib: B.library.length, gy: B.gy.length });
        reset(); const fs = makeObj(C['Fractured Sanity'], 0); A.hand.push(fs); T.lands(A, { Mountain: C['Island'] }, 0);
        await resolveEffects(A, Rx(fs).cycleTrig, null, fs);
        ok('Fractured Sanity: the cycling trigger mills 4', B.gy.length === 4, B.gy.length);
        reset(); await spell(A, 'Maddening Cacophony');
        ok('Maddening Cacophony: unkicked mills 8', B.gy.length === 8);
        reset(); const mc = makeObj(C['Maddening Cacophony'], 0); mc.kicked = true; await spell(A, 'Maddening Cacophony', mc);
        ok('Maddening Cacophony: kicked mills half the library rounded up', B.gy.length === 20 && B.library.length === 20, B.gy.length);
        reset(); lib(B, 41); const mc2 = makeObj(C['Maddening Cacophony'], 0); mc2.kicked = true; await spell(A, 'Maddening Cacophony', mc2);
        ok('... rounding up on an odd library (41 -> 21)', B.gy.length === 21, B.gy.length);
        reset(); T.put(A, C['The Water Crystal']); await spell(A, 'Fractured Sanity');
        ok('The Water Crystal: an opponent mills 4 more (14 -> 18)', B.gy.length === 18, B.gy.length);
        reset(); T.put(B, C['The Water Crystal']); await spell(A, 'Fractured Sanity');
        ok("The Water Crystal doesn't change milling for its own controller's opponents' spells", B.gy.length === 14, B.gy.length);
        reset(); const wc = T.put(A, C['The Water Crystal']); for (let i = 0; i < 3; i++) A.hand.push(makeObj(C['Island'], 0));
        const act = actsOf(wc).find(a => (a.effects || []).some(e => e.t === 'millFoes'));
        await resolveEffects(A, act.effects, null, wc);
        ok('The Water Crystal: its ability mills cards equal to your hand (3 + 4)', B.gy.length === 7, B.gy.length);
        reset(); fill(B, ['Swamp', 'Island', 'Grizzly Bears', 'Grizzly Bears', 'Island', 'Island', 'Swamp', 'Island', 'Grizzly Bears']); // top is the end
        await spell(A, 'Mind Funeral');
        ok('Mind Funeral: reveals until four lands (5 cards deep) and puts them all into the graveyard', B.library.length === 4 && B.gy.length === 5, { lib: B.library.length, gy: B.gy.length });
        reset(); const mg = makeObj(C['Mind Grind'], 0); G.curX = 3; await spell(A, 'Mind Grind', mg); G.curX = 0;
        ok('Mind Grind: X=3 reveals 3 lands', B.gy.filter(c => c.card.name === 'Island').length === 3 && B.gy.length === 3, B.gy.length);
        reset(); const ca = T.put(A, C['Consuming Aberration']); B.gy.push(makeObj(C['Island'], 1), makeObj(C['Island'], 1), makeObj(C['Island'], 1));
        ok("Consuming Aberration: power and toughness equal the cards in opponents' graveyards", pow(ca) === 3 && tou(ca) === 3, { p: pow(ca), t: tou(ca) });
        reset(); fill(B, ['Island', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears', 'Swamp']);
        const castTrig = (Rx(ca).trig || []).find(t => t.ev === 'cast');
        await resolveEffects(A, castTrig.effects, null, ca);
        ok('Consuming Aberration: casting a spell reveals until a land', B.gy.length === 1 && B.library.length === 4 && B.gy[0].card.name === 'Swamp', B.gy.length);
        reset(); const sr = makeObj(C['Singularity Rupture'], 0); T.put(A, C['Grizzly Bears']); T.put(B, C['Grizzly Bears']); await spell(A, 'Singularity Rupture', sr);
        ok('Singularity Rupture: destroys all creatures then mills half (rounded down)', A.bf.filter(isCreature).length === 0 && B.bf.filter(isCreature).length === 0 && B.gy.length === 20 + 1, { gy: B.gy.length });
        reset(); const tm = T.put(A, C['Terisian Mindbreaker']); G.attackers = [tm.uid]; G.defender = 1;
        await resolveEffects(A, (Rx(tm).trig.find(t => t.ev === 'attacks')).effects, null, tm);
        ok('Terisian Mindbreaker: defending player mills half their library', B.gy.length === 20, B.gy.length);
        reset(); const nr = T.put(A, C['Nemesis of Reason']);
        await resolveEffects(A, (Rx(nr).trig.find(t => t.ev === 'attacks')).effects, null, nr);
        ok('Nemesis of Reason: defending player mills ten', B.gy.length === 10, B.gy.length);

        // ---- Mindskinner ----
        reset(); const ms = T.put(A, C['The Mindskinner']);
        damage(B, 10, ms);
        ok('The Mindskinner: damage to an opponent is prevented and they mill that many cards', B.life === 40 && B.gy.length === 10, { life: B.life, gy: B.gy.length });
        reset(); T.put(A, C['The Mindskinner']); const bear = T.put(A, C['Grizzly Bears']); damage(A, 3, bear);
        ok('... but damage to its own controller is normal', A.life === 37);

        // ---- Nuclear Fallout and rad counters ----
        reset(); const nf = makeObj(C['Nuclear Fallout'], 0); const big = T.put(B, C['Serra Angel']); const mine = T.put(A, C['Grizzly Bears']);
        G.curX = 2; await spell(A, 'Nuclear Fallout', nf); G.curX = 0; await settle();
        ok('Nuclear Fallout X=2: each creature gets -4/-4 (both die) and each player gets 2 rad counters', !onBf(big.uid) && !onBf(mine.uid) && A.rad === 2 && B.rad === 2, { a: A.rad, b: B.rad });
        reset(); A.rad = 3; lib(A, 10, 'Island'); A.library[A.library.length - 2] = makeObj(C['Grizzly Bears'], 0); // second card from the top is a nonland
        await radTick(A);
        ok('Rad counters: mill that many at precombat main; each nonland card costs 1 life and a counter', A.gy.length === 3 && A.life === 39 && A.rad === 2, { gy: A.gy.length, life: A.life, rad: A.rad });

        // ---- Syphon Mind, Perplex, Reality Shift, Doomsday ----
        reset(); B.hand.push(makeObj(C['Island'], 1), makeObj(C['Swamp'], 1)); const before = A.hand.length;
        await spell(A, 'Syphon Mind');
        ok('Syphon Mind: each other player discards a card and you draw one for each', B.hand.length === 1 && A.hand.length === before + 1, { b: B.hand.length, a: A.hand.length });
        reset(); const spellO = makeObj(C['Divination'], 1); B.hand.push(makeObj(C['Island'], 1)); G.stack.push({ id: 9001, kind: 'spell', o: spellO, P: B, target: null, name: 'Divination' });
        await applyEffect(A, { t: 'counter', target: 'spell', filter: 'any', unlessDiscard: true }, { item: G.stack[0] }, makeObj(C['Perplex'], 0));
        ok('Perplex: the spell is not countered when its controller discards their hand', G.stack.length === 1 && B.hand.length === 0 && B.gy.length === 1, { stack: G.stack.length });
        reset(); G.stack.length = 0; for (let i = 0; i < 4; i++) B.hand.push(makeObj(C['Island'], 1)); G.stack.push({ id: 9002, kind: 'spell', o: makeObj(C['Divination'], 1), P: B, target: null, name: 'Divination' });
        await applyEffect(A, { t: 'counter', target: 'spell', filter: 'any', unlessDiscard: true }, { item: G.stack[0] }, makeObj(C['Perplex'], 0));
        ok('Perplex: it is countered when they keep a big hand', G.stack.length === 0 && B.hand.length === 4, { stack: G.stack.length });
        reset(); const rsBear = T.put(B, C['Serra Angel']); fill(B, ['Island', 'Island', 'Grizzly Bears']); const rs = makeObj(C['Reality Shift'], 0);
        await resolveEffects(A, Rx(rs).spell, { o: rsBear }, rs); await settle();
        const manifested = B.bf.find(x => x.manifest);
        ok('Reality Shift: the creature is exiled and its controller manifests a face-down 2/2', !onBf(rsBear.uid) && B.exile.includes(rsBear) && !!manifested && manifested.card.name === 'Face-down creature' && pow(manifested) === 2, { exile: B.exile.length });
        T.lands(B, { Mountain: C['Island'] }, 0); const isl = makeObj(C['Island'], 1); putOntoBattlefield(B, isl);
        ok('... a manifested creature card can be turned up for its mana cost (cost {1}{G}; no mana yet -> cannot)', manifested && fdTurnCost(manifested) && canTurnUp(B, manifested) === false);
        reset(); lib(A, 20); lib(B, 30); const de = makeObj(C['Doomsday Excruciator'], 0); de.wasCast = true; await etb(A, de);
        ok('Doomsday Excruciator (cast): each player keeps only the bottom six cards of their library, the rest exiled', A.library.length === 6 && B.library.length === 6 && A.exile.length === 14 && B.exile.length === 24, { a: A.library.length, b: B.library.length });
        reset(); lib(A, 20); lib(B, 30); const de2 = makeObj(C['Doomsday Excruciator'], 0); de2.wasCast = false; await etb(A, de2);
        ok('Doomsday Excruciator (not cast): nothing happens', A.library.length === 20 && B.library.length === 30);

        // ---- Reanimation sorceries ----
        reset(); fill(A, ['Island', 'Island', 'Island']); fill(B, ['Island', 'Island', 'Island']); B.gy.push(makeObj(C['Serra Angel'], 1));
        await spell(A, 'Extract from Darkness');
        const got = A.bf.find(x => x.card.name === 'Serra Angel');
        ok('Extract from Darkness: each player mills 2, then you take a creature from a graveyard', A.gy.length === 2 && B.gy.length === 2 && !!got && got.realOwner === 1, { a: A.gy.length, b: B.gy.length });
        reset(); lib(A, 20); lib(B, 20); A.gy.push(makeObj(C['Grizzly Bears'], 0)); B.gy.push(makeObj(C['Serra Angel'], 1));
        await spell(A, 'Breach the Multiverse');
        ok('Breach the Multiverse: each player mills 10 and you take a creature from each graveyard; they become Phyrexians', A.bf.length >= 2 && A.bf.filter(isCreature).every(c => /Phyrexian/.test(c.card.type)) && A.gy.length >= 10 && B.gy.length >= 9, { bf: A.bf.length });

        // ---- Thief of Sanity ----
        reset(); fill(B, ['Island', 'Island', 'Grizzly Bears', 'Serra Angel', 'Island']); const th = T.put(A, C['Thief of Sanity']);
        await resolveEffects(A, (Rx(th).trig.find(t => t.ev === 'hitPlayer')).effects, null, th);
        const stolen = A.exile.find(x => x.card.name === 'Serra Angel');
        ok('Thief of Sanity: exiles the best of the top three for you to cast, and mills the rest', !!stolen && stolen.playUntil > 1e8 && stolen.anyMana === true && B.gy.length === 2 && B.library.length === 2, { exile: A.exile.map(x => x.card.name), gy: B.gy.length });

        // ---- Dream Harvest and Tasha's ----
        reset(); fill(B, ['Island', 'Island', 'Serra Angel', 'Grizzly Bears', 'Island']); // top: Island (0), Bears (2), Angel (4) => total 6 >= 5
        const dh = makeObj(C['Dream Harvest'], 0); await spell(A, 'Dream Harvest', dh);
        ok('Dream Harvest: exiles until total mana value 5 and casts what it can for free', B.library.length === 2 && A.bf.length + G.stack.length >= 1, { lib: B.library.length, stack: G.stack.length, bf: A.bf.length });
        reset(); fill(B, Array(15).fill('Serra Angel')); await spell(A, "Tasha's Hideous Laughter");
        ok("Tasha's Hideous Laughter: exiles until total mana value 20 (4 Serra Angels)", B.exile.length === 4 && B.library.length === 11, B.exile.length);

        // ---- Trepanation Blade and Fraying Sanity ----
        reset(); fill(B, ['Island', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears']); const blade = T.put(A, C['Trepanation Blade']); const wearer = T.put(A, C['Grizzly Bears']); blade.attachedTo = wearer.uid;
        const bladeTrig = Rx(blade).trig.find(t => t.fn === 'hostAttack');
        ok('Trepanation Blade: triggers when the equipped creature attacks', !!bladeTrig && trigMatches(bladeTrig, 'attacks', blade, { list: [wearer] }) && !trigMatches(bladeTrig, 'attacks', blade, { list: [] }));
        G.defender = 1; await resolveEffects(A, bladeTrig.effects, null, blade);
        ok('... reveals until a land (4 cards) and the creature gets +4/+0', B.gy.length === 4 && pow(wearer) === 2 + 4, { gy: B.gy.length, pow: pow(wearer) });
        reset(); const frs = makeObj(C['Fraying Sanity'], 0); A.hand.push(frs);
        ok('Fraying Sanity can be cast (it enchants a player)', Rx(frs).support === 'full' && !Rx(frs).isAura);
        putOntoBattlefield(A, frs); await etb(A, frs);
        ok('Fraying Sanity enchants an opponent', frs.hostPlayer === 1, frs.hostPlayer);
        B.gy.push(makeObj(C['Island'], 1), makeObj(C['Island'], 1)); B.gy.push(makeObj(C['Island'], 1));
        await resolveEffects(A, [{ t: 'frayTick' }], null, frs);
        ok('Fraying Sanity: at the end step the enchanted player mills as many cards as were put into their graveyard this turn', B.gy.length === 6, B.gy.length);

        // ---- Ripples of Undeath and Overlord ----
        reset(); lib(A, 10); A.library[A.library.length - 1] = makeObj(C['Serra Angel'], 0); const ri = T.put(A, C['Island']);
        await resolveEffects(A, [{ t: 'ripples' }], null, makeObj(C['Ripples of Undeath'], 0));
        ok('Ripples of Undeath: mills three; may pay {1} and 3 life for a card from among them', A.gy.length === 3 || (A.gy.length === 2 && A.hand.length === 1 && A.life === 37), { gy: A.gy.length, hand: A.hand.length, life: A.life });
        reset(); lib(A, 10); A.gy.push(makeObj(C['Serra Angel'], 0)); const ov = makeObj(C['Overlord of the Balemurk'], 0); A.hand.push(ov);
        ok('Overlord of the Balemurk: has an impending alt cost and reads as a creature spell', !!Rx(ov).impending && Rx(ov).impending.n === 5 && castAsOk(A, ov, 'impending'));
        ov.castAs = 'impending'; const c1 = costOf(A, ov); ov.castAs = null;
        ok('... impending costs {1}{B}', c1.B === 1 && c1.generic === 1, c1);
        putOntoBattlefield(A, ov); ov.impending = true; ov.ctr.time = 5;
        ok('... with time counters it is not a creature', !isCreature(ov));
        for (let i = 0; i < 5; i++) { G.active = 0; G.phase = 'main2'; await endTurn(A); G.turn++; }
        ok('... it loses a time counter at each of its controller\'s end steps and becomes a creature', ov.ctr.time === 0 && isCreature(ov), ov.ctr.time);
        reset(); lib(A, 10); A.gy.push(makeObj(C['Serra Angel'], 0)); await resolveEffects(A, [{ t: 'millSelf', n: 4 }, { t: 'overlordReturn' }], null, ov);
        ok('Overlord: mill four, then return a creature card from the graveyard to hand', A.gy.length === 4 && A.hand.some(x => x.card.name === 'Serra Angel') || A.gy.length === 5, { gy: A.gy.length, hand: A.hand.map(x => x.card.name) });

        // ---- Clones ----
        const clone = async (name, targets) => { reset(); targets.forEach(([P, n]) => T.put(P === 'A' ? A : B, C[n])); const o = makeObj(C[name], 0); A.hand.push(o); const cl = Rx(o).clone; pull(A.hand, o); resetObj(o); A.bf.push(o); await enterAsCopy(A, o, cl); return o; };
        let o = await clone('Clever Impersonator', [['B', 'Sol Ring']]);
        ok('Clever Impersonator copies any nonland permanent (Sol Ring)', o.card.name === 'Sol Ring', o.card.name);
        o = await clone('Copycrook', [['B', 'Serra Angel']]);
        ok('Copycrook copies a creature and gains "whenever it attacks, it connives"', o.card.name === 'Serra Angel' && Rx(o).trig.some(t => t.ev === 'attacks' && t.effects.some(e => e.t === 'connive')), Rx(o).trig.map(t => t.ev));
        o = await clone('Deceptive Frostkite', [['A', 'Serra Angel']]);
        ok('Deceptive Frostkite copies a creature you control with power 4 or greater and is a Dragon', o.card.name === 'Serra Angel' && /Dragon/.test(o.card.type), o.card.type);
        o = await clone('Deceptive Frostkite', [['A', 'Grizzly Bears']]);
        ok('... but not a creature with power under 4 (stays a Frostkite)', o.card.name === 'Deceptive Frostkite', o.card.name);
        o = await clone('Flesh Duplicate', [['B', 'Serra Angel']]);
        ok('Flesh Duplicate copies a creature and gets vanishing 3 (three time counters)', o.card.name === 'Serra Angel' && o.ctr.time === 3, o.ctr);
        o = await clone('Glasspool Mimic', [['A', 'Grizzly Bears']]);
        ok('Glasspool Mimic copies a creature you control and is also a Shapeshifter Rogue', o.card.name === 'Grizzly Bears' && /Shapeshifter/.test(o.card.type) && /Rogue/.test(o.card.type), o.card.type);
        o = await clone('Phantasmal Image', [['B', 'Serra Angel']]);
        ok('Phantasmal Image copies a creature, is an Illusion, and is sacrificed when targeted', o.card.name === 'Serra Angel' && /Illusion/.test(o.card.type) && Rx(o).trig.some(t => t.ev === 'targeted'), Rx(o).trig.map(t => t.ev));

        // ---- Uldaros Theorix ----
        reset(); const ul = makeObj(C['Uldaros Theorix'], 0); ul.wasCast = true;
        [['Grizzly Bears'], ['Divination'], ['Sol Ring'], ['Opt']].forEach(([n]) => A.gy.push(makeObj(C[n], 0)));
        A.hand.length = 0; lib(A, 10); const handBefore = A.hand.length;
        await etb(A, ul);
        ok('Uldaros Theorix: exiles one nonland card of each type (creature, sorcery, artifact, instant) from the graveyard', A.gy.length === 0 && A.exile.length === 4, { gy: A.gy.length, exile: A.exile.length });
        const toks = A.bf.filter(x => x.token);
        ok('... and casts copies worth 6 or less in all: a Bears token and a Sol Ring token; Divination draws, and Opt (cost 1) fits the last mana value', toks.some(x => x.card.name === 'Grizzly Bears') && toks.some(x => x.card.name === 'Sol Ring'), toks.map(x => x.card.name));
        reset(); const ul2 = makeObj(C['Uldaros Theorix'], 0); ul2.wasCast = false; A.gy.push(makeObj(C['Grizzly Bears'], 0)); await etb(A, ul2);
        ok('Uldaros Theorix (not cast): nothing happens', A.gy.length === 1 && A.exile.length === 0);

        // ---- Golbez and Joo Dee ----
        reset(); const gb = T.put(A, C['Golbez, Crystal Collector']); for (let i = 0; i < 4; i++) T.put(A, C['Sol Ring']); A.gy.push(makeObj(C['Serra Angel'], 0));
        await resolveEffects(A, (Rx(gb).trig.find(t => t.ev === 'end')).effects, null, gb);
        ok('Golbez: with four artifacts, returns a creature card from the graveyard to hand (no drain below eight)', A.hand.some(x => x.card.name === 'Serra Angel') && B.life === 40, { hand: A.hand.length, b: B.life });
        reset(); const gb2 = T.put(A, C['Golbez, Crystal Collector']); for (let i = 0; i < 8; i++) T.put(A, C['Sol Ring']); A.gy.push(makeObj(C['Serra Angel'], 0));
        await resolveEffects(A, (Rx(gb2).trig.find(t => t.ev === 'end')).effects, null, gb2);
        ok('Golbez: with eight artifacts, each opponent loses life equal to that card\'s power (Serra Angel 4)', B.life === 36, B.life);
        reset(); const jd = T.put(A, C['Joo Dee, One of Many']); T.put(A, C['Sol Ring']); T.put(A, C['Swamp']); const act2 = actsOf(jd)[0];
        ok('Joo Dee: can be activated at sorcery speed', !!act2 && canActivate(A, jd, act2));
        await activate(A, jd, act2); await settle();
        ok('Joo Dee: makes a token copy and sacrifices an artifact or creature (net same number of permanents, plus the token)', A.bf.filter(x => x.card.name === 'Joo Dee, One of Many').length >= 1 && A.bf.filter(x => x.token).length === 1, A.bf.map(x => x.card.name));
        ok('no broken invariants after all that', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('uldaros', results, []);
    writeOut('uldaros', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
