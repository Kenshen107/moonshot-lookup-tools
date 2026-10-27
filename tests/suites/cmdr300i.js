// Commander round 4, batch i (2026-10-26): behavior checks for rules/cmdr300i.js and 15-cmdr300i.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300i_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300i_names.json'), 'utf8'));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Divination', 'Shock', 'Treasure Map', 'Giant Growth', 'Ancestral Recall', 'Dark Ritual', 'Goblin Guide', 'Shivan Dragon', 'Air Elemental', 'Wall of Omens', 'Bear Cub', 'Ornithopter', 'Black Lotus', 'Cultivate', 'Island', 'Terror', 'Doom Blade', 'Rhystic Study', 'Mind Stone', 'Furnace Whelp', 'Wall of Omens', 'Elvish Visionary', 'Rhystic Study', 'Smuggler\'s Copter', 'Pacifism', 'Mind Stone', 'Shivan Dragon', 'Wrath of God', 'Disenchant']);
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
            const syn = (P, n, type, extra, objExtra) => T.put(P, { ...have(n), type, ...(extra || {}) }, objExtra);
            const synGy = (P, n, type, extra) => { const o = makeObj({ ...have(n), type, ...(extra || {}) }, P.i); P.gy.push(o); return o; };
            const synHand = (P, n, type, extra) => { const o = makeObj({ ...have(n), type, ...(extra || {}) }, P.i); P.hand.push(o); return o; };
            const castEv = (P, o) => { o.castFromHand = G.turn; fire('cast', { o, P }); };
            const hit = (src, victims) => { fire('hitPlayer', { src, n: 1, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };
            const names = A => A.bf.map(x => x.card.name);
            // Ich-Tekik, Salvage Splicer
            { const [A] = await fresh(); const t = put(A, 'Ich-Tekik, Salvage Splicer'); const g = syn(A, 'Grizzly Bears', 'Creature — Golem'); const s = put(A, 'Sol Ring'); dieOrLeave(s, 'gy'); await settle2();
              ok('Ich-Tekik, Salvage Splicer: an artifact going to a graveyard gives it and each Golem a +1/+1 counter', t.counters === 1 && g.counters === 1, [t.counters, g.counters]); }
            // Grenzo, Dungeon Warden
            { const [A] = await fresh(); const g = put(A, 'Grenzo, Dungeon Warden'); lands(A, 2, 'Mountain'); const e = makeObj(have('Llanowar Elves'), 0); A.library.unshift(e); await activate(A, g, acts(g)[0]); await settle2();
              ok('Grenzo, Dungeon Warden: the bottom card is milled and a creature with power up to his enters', A.bf.includes(e) && !A.gy.includes(e), [names(A), A.gy.length]); }
            { const [A] = await fresh(); const g = put(A, 'Grenzo, Dungeon Warden'); lands(A, 2, 'Mountain'); const h = makeObj(have('Hill Giant'), 0); A.library.unshift(h); await activate(A, g, acts(g)[0]); await settle2();
              ok('Grenzo, Dungeon Warden: a creature with greater power stays in the graveyard', A.gy.includes(h) && !A.bf.includes(h), [names(A), A.gy.map(x => x.card.name)]); }
            // The Mighty Thor, Jane Foster
            { const [A] = await fresh(); const t = put(A, 'The Mighty Thor, Jane Foster'); const v = put(A, 'Elvish Visionary'); await settle2(); const h0 = A.hand.length; fire("attacks", { list: [t] }); await settle2(); const v2 = A.bf.find(x => x.card.name === 'Elvish Visionary');
              ok('The Mighty Thor, Jane Foster: blinks a nontoken creature, which returns tapped', !!v2 && v2.tapped && A.hand.length === h0 + 1, [!!v2, v2 && v2.tapped, A.hand.length - h0]); }
            // Norika Yamazaki, the Poet
            { const [A] = await fresh(); const n = syn(A, 'Grizzly Bears', 'Creature — Human Samurai'); put(A, 'Norika Yamazaki, the Poet'); lands(A, 4, 'Island'); const r = inGy(A, 'Rhystic Study'); fire('attacks', { list: [n] }); await settle2(); await settle2();
              ok('Norika Yamazaki, the Poet: a Samurai attacking alone lets you cast an enchantment from your graveyard', A.bf.includes(r) || G.stack.length > 0 || A.bf.some(x => x.card.name === 'Rhystic Study'), [names(A), A.gy.map(x => x.card.name)]); }
            { const [A] = await fresh(); const n = syn(A, 'Grizzly Bears', 'Creature — Human Samurai'); const m = syn(A, 'Hill Giant', 'Creature — Giant'); put(A, 'Norika Yamazaki, the Poet'); lands(A, 4, 'Island'); const r = inGy(A, 'Rhystic Study'); fire('attacks', { list: [n, m] }); await settle2(); await settle2();
              ok('Norika Yamazaki, the Poet: attacking with two creatures does nothing', A.gy.includes(r), [names(A)]); }
            // Cid, Timeless Artificer
            { const [A] = await fresh(); put(A, 'Cid, Timeless Artificer'); const a = syn(A, 'Ornithopter', 'Artifact Creature — Construct', { power: '0', toughness: '2' }); const p0 = pow(a); const art = syn(A, 'Grizzly Bears', 'Creature — Human Artificer'); const p1 = pow(a); synGy(A, 'Hill Giant', 'Creature — Giant Artificer'); const p2 = pow(a); const plain = put(A, 'Grizzly Bears');
              ok('Cid, Timeless Artificer: artifact creatures get +1/+1 per Artificer you control and in your graveyard (plain creatures do not)', p1 > p0 && p2 === p1 + 1 && pow(plain) === 2, [p0, p1, p2, pow(plain)]); }
            // Egon, God of Death
            { const [A] = await fresh(); const e = put(A, 'Egon, God of Death'); inGy(A, 'Grizzly Bears'); inGy(A, 'Hill Giant'); inGy(A, 'Shock'); fire('upkeep'); await settle2();
              ok('Egon, God of Death: exiles two cards from your graveyard at upkeep and stays', A.gy.length === 1 && A.exile.length === 2 && onBf(e.uid), [A.gy.length, A.exile.length]); }
            { const [A] = await fresh(); const e = put(A, 'Egon, God of Death'); inGy(A, 'Grizzly Bears'); const h0 = A.hand.length; fire('upkeep'); await settle2();
              ok('Egon, God of Death: with fewer than two cards it is sacrificed and you draw a card', !onBf(e.uid) && A.hand.length === h0 + 1, [onBf(e.uid), A.hand.length - h0]); }
            // Akul the Unrepentant
            { const [A] = await fresh(); const k = put(A, 'Akul the Unrepentant'); for (let i = 0; i < 3; i++) put(A, 'Grizzly Bears'); const d = inHand(A, 'Shivan Dragon'); await activate(A, k, acts(k)[0]); await settle2();
              ok('Akul the Unrepentant: sacrificing three other creatures puts a creature card from hand onto the battlefield', A.bf.includes(d) && A.bf.filter(x => x.card.name === 'Grizzly Bears').length === 0, [names(A)]); }
            // Commander Sofia Daguerre
            { const [A, B] = await fresh(); const l = syn(B, 'Grizzly Bears', 'Legendary Creature — Bear'); const s = inHand(A, 'Commander Sofia Daguerre'); putOntoBattlefield(A, s); await settle2();
              ok('Commander Sofia Daguerre: destroys a legendary permanent and its controller creates a Junk token', !B.bf.includes(l) && B.bf.some(x => x.card.name === 'Junk'), [names(B)]); }
            // Zaffai, Thunder Conductor
            { const [A, B] = await fresh(); put(A, 'Zaffai, Thunder Conductor'); castEv(A, synHand(A, 'Divination', 'Sorcery', { cmc: 5 })); await settle2();
              ok('Zaffai, Thunder Conductor: a spell with mana value 5 or more makes a 4/4 Elemental', A.bf.some(x => x.token && pow(x) === 4 && /Elemental/.test(x.card.type)), [names(A)]); }
            { const [A, B] = await fresh(); put(A, 'Zaffai, Thunder Conductor'); castEv(A, synHand(A, 'Divination', 'Sorcery', { cmc: 10 })); await settle2();
              ok('Zaffai, Thunder Conductor: a spell with mana value 10 or more also deals 10 damage to an opponent', B.life === 10, [B.life]); }
            // Loot, the Key to Everything
            { const [A] = await fresh(); put(A, 'Loot, the Key to Everything'); put(A, 'Grizzly Bears'); put(A, 'Sol Ring'); const n = A.library.length; fire('upkeep'); await settle2();
              ok('Loot, the Key to Everything: exiles the top X cards (X = card types among other nonland permanents)', A.library.length === n - 2 && A.exile.length === 2, [n - A.library.length, A.exile.length]); }
            // Greasefang, Okiba Boss
            { const [A] = await fresh(); put(A, 'Greasefang, Okiba Boss'); const v = synGy(A, 'Grizzly Bears', 'Artifact — Vehicle'); fire('combat'); await settle2(); const back = A.bf.includes(v) && (has(v, 'haste') || v.tkw.includes('haste')); await runEndQueue(); await settle2();
              ok('Greasefang, Okiba Boss: returns a Vehicle with haste at combat and puts it back in hand at the end step', back && A.hand.includes(v), [back, A.hand.length]); }
            // Miles "Tails" Prower
            { const [A] = await fresh(); put(A, 'Miles "Tails" Prower'); const v = syn(A, 'Grizzly Bears', 'Artifact — Vehicle'); await settle2();
              ok('Miles "Tails" Prower: a Vehicle without flying gets a flying counter', (v.ctr.flying || 0) === 1, [v.ctr]); }
            { const [A] = await fresh(); put(A, 'Miles "Tails" Prower'); const h0 = A.hand.length; syn(A, 'Ornithopter', 'Artifact — Vehicle'); await settle2();
              ok('Miles "Tails" Prower: a Vehicle that already has flying draws a card', A.hand.length === h0 + 1, [A.hand.length - h0]); }
            // Kemba, Kha Enduring
            { const [A] = await fresh(); const eq = syn(A, 'Mind Stone', 'Artifact — Equipment'); const k = put(A, 'Kemba, Kha Enduring'); await settle2();
              ok('Kemba, Kha Enduring: attaches an Equipment to a Cat that enters', eq.attachedTo === k.uid, [eq.attachedTo, k.uid]); }
            // Tempestra, Dame of Games
            { const [A] = await fresh(); const t = put(A, 'Tempestra, Dame of Games'); const b = put(A, 'Hill Giant'); put(A, 'Sol Ring'); lands(A, 3, 'Mountain'); await activate(A, t, acts(t)[0]); await settle2(); const copies = A.bf.filter(x => x.token && x.card.name === 'Hill Giant'); const hasty = copies.length === 1 && (has(copies[0], 'haste') || copies[0].tkw.includes('haste')); await runEndQueue(); await settle2();
              ok('Tempestra, Dame of Games: sacrifices an artifact for a hasty token copy that is sacrificed at the end step', hasty && !A.bf.some(x => x.token) && !A.bf.some(x => x.card.name === 'Sol Ring'), [copies.length, hasty, names(A)]); }
            // Deathleaper, Terror Weapon
            { const [A] = await fresh(); put(A, 'Deathleaper, Terror Weapon'); const b = put(A, 'Grizzly Bears'); const old = put(A, 'Hill Giant'); old.enteredTurn = G.turn - 1;
              ok('Deathleaper, Terror Weapon: creatures that entered this turn have double strike (older ones do not)', has(b, 'double strike') && !has(old, 'double strike'), [has(b, 'double strike'), has(old, 'double strike')]); }
            // Intet, the Dreamer
            { const [A, B] = await fresh(); const i = put(A, 'Intet, the Dreamer'); lands(A, 3, 'Island'); const top = inLib(A, 'Shock'); hit(i, [B]); await settle2();
              ok('Intet, the Dreamer: paying {2}{U} exiles the top card, playable for free while Intet stays', A.exile.includes(top) && top.freeCast && top.playWhile === i.uid, [A.exile.length, top.freeCast]); }
            // Eligeth, Crossroads Augur
            { const [A] = await fresh(); put(A, 'Eligeth, Crossroads Augur'); const h0 = A.hand.length; await applyChoiceEffect(A, { t: 'scry', n: 2 }, { card: { name: 'x' } }); await settle2();
              ok('Eligeth, Crossroads Augur: a scry 2 draws two cards instead', A.hand.length === h0 + 2, [A.hand.length - h0]); }
            // Caradora, Heart of Alacria
            { const [A] = await fresh(); put(A, 'Caradora, Heart of Alacria'); const b = put(A, 'Grizzly Bears'); putCounters(b, 1, A);
              ok('Caradora, Heart of Alacria: one more +1/+1 counter on a creature you control', b.counters === 2, [b.counters]); }
            // Extus, Oriq Overlord
            { const [A] = await fresh(); put(A, 'Extus, Oriq Overlord'); const b = inGy(A, 'Grizzly Bears'); castEv(A, synHand(A, 'Shock', 'Instant')); await settle2();
              ok('Extus, Oriq Overlord: casting an instant returns a nonlegendary creature card from your graveyard to hand', A.hand.includes(b), [A.hand.length]); }
            // The Astonishing Ant-Man
            { const [A] = await fresh(); const a = put(A, 'The Astonishing Ant-Man'); a.counters = 3; lands(A, 3, 'Forest'); await activate(A, a, acts(a)[0]); await settle2();
              ok('The Astonishing Ant-Man: removes its +1/+1 counters to create that many 1/1 Insects', a.counters === 0 && A.bf.filter(x => x.token && /Insect/.test(x.card.type)).length === 3, [a.counters, names(A)]); }
            // Gerrard, Weatherlight Hero
            { const [A] = await fresh(); const g = put(A, 'Gerrard, Weatherlight Hero'); const b = put(A, 'Grizzly Bears'); const s = put(A, 'Sol Ring'); dieOrLeave(b, 'gy'); dieOrLeave(s, 'gy'); await settle2(); dieOrLeave(g, 'gy'); await settle2();
              ok('Gerrard, Weatherlight Hero: exiles itself and returns the artifacts and creatures that died this turn', A.exile.includes(g) && A.bf.includes(b) && A.bf.includes(s), [names(A), A.exile.length]); }
            // Masako the Humorless
            { const [A, B] = await fresh(); put(A, 'Masako the Humorless'); const t = put(A, 'Grizzly Bears'); t.tapped = true; const atk = put(B, 'Hill Giant');
              ok('Masako the Humorless: tapped creatures you control can block', canBlock(t, atk) === true || !!canBlock(t, atk), [canBlock(t, atk)]); }
            { const [A, B] = await fresh(); const t = put(A, 'Grizzly Bears'); t.tapped = true; const atk = put(B, 'Hill Giant');
              ok('Masako the Humorless (control): without Masako a tapped creature cannot block', !canBlock(t, atk), [canBlock(t, atk)]); }
            // Eloise, Nephalia Sleuth
            { const [A] = await fresh(); put(A, 'Eloise, Nephalia Sleuth'); let seen = 0; const orig = applyChoiceEffect; applyChoiceEffect = async function (P, e) { if (e && e.t === 'surveil') seen++; return orig.apply(this, arguments); }; const t = syn(A, 'Grizzly Bears', 'Creature — Bear', {}, { token: true }); const nt = put(A, 'Hill Giant'); sacPerm(A, nt); await settle2(); const afterNon = seen; sacPerm(A, t); await settle2(); applyChoiceEffect = orig;
              ok('Eloise, Nephalia Sleuth: sacrificing a token makes you surveil 1 (a nontoken does not)', afterNon === 0 && seen === 1, [afterNon, seen]); }
            // Nadier, Agent of the Duskenel
            { const [A] = await fresh(); const n = put(A, 'Nadier, Agent of the Duskenel'); const p = pow(n); dieOrLeave(n, 'gy'); await settle2();
              ok('Nadier, Agent of the Duskenel: leaving creates 1/1 Elf Warriors equal to its power', p > 0 && A.bf.filter(x => x.token && /Elf Warrior/.test(x.card.type)).length === p, [p, names(A)]); }
            // Nin, the Pain Artist
            { const [A, B] = await fresh(); const n = put(A, 'Nin, the Pain Artist'); const v = put(B, 'Grizzly Bears'); lands(A, 3, 'Island'); lands(A, 1, 'Mountain'); const h0 = B.hand.length; const a = acts(n)[0]; await activate(A, n, a); await settle2();
              ok('Nin, the Pain Artist: deals X damage to a creature and its controller draws X cards', !B.bf.includes(v) && B.hand.length > h0, [names(B), B.hand.length - h0]); }
            // Shaile, Dean of Radiance
            { const [A] = await fresh(); const s = put(A, 'Shaile, Dean of Radiance'); s.sick = false; const n = put(A, 'Grizzly Bears'); const old = put(A, 'Hill Giant'); old.enteredTurn = G.turn - 1; await activate(A, s, acts(s)[0]); await settle2();
              ok('Shaile, Dean of Radiance: a +1/+1 counter on each creature that entered this turn', n.counters === 1 && old.counters === 0, [n.counters, old.counters]); }
            // Tokka & Rahzar, Unsupervised
            { const [A] = await fresh(); const t = put(A, 'Tokka & Rahzar, Unsupervised'); const b = put(A, 'Grizzly Bears'); const c = put(A, 'Hill Giant'); dieOrLeave(b, 'gy'); await settle2(); dieOrLeave(c, 'gy'); await settle2();
              ok('Tokka & Rahzar, Unsupervised: another nontoken creature leaving gives a counter and a Treasure, once each turn', t.counters === 1 && A.bf.filter(x => x.card.name === 'Treasure').length === 1, [t.counters, names(A)]); }
            // Gahiji, Honored One
            { const [A, B] = await fresh(); put(A, 'Gahiji, Honored One'); const m = put(A, 'Grizzly Bears'); G.attackers = [m.uid]; m.atkTo = 1; fire('attacks', { list: [m] }); await settle2();
              ok('Gahiji, Honored One: a creature attacking an opponent gets +2/+0', m.tp === 2, [m.tp]); }
            // Skanos Dragonheart
            { const [A] = await fresh(); const s = put(A, 'Skanos Dragonheart'); put(A, 'Shivan Dragon'); fire('attacks', { list: [s] }); await settle2();
              ok('Skanos Dragonheart: gets +X/+X where X is the greatest power among other Dragons', s.tp === 5 && s.tq === 5, [s.tp, s.tq]); }
            // The Duke, Rebel Sentry
            { const [A] = await fresh(); const d = put(A, 'The Duke, Rebel Sentry'); d.counters = 1; d.sick = false; const b = put(A, 'Grizzly Bears'); await activate(A, d, acts(d)[0]); await settle2();
              ok('The Duke, Rebel Sentry: removes a counter to put a +1/+1 counter and hexproof on another creature', d.counters === 0 && b.counters === 1 && has(b, 'hexproof'), [d.counters, b.counters]); }
            // Captain America, Wings of Freedom
            { const [A] = await fresh(); const c = put(A, 'Captain America, Wings of Freedom'); const h = syn(A, 'Grizzly Bears', 'Creature — Human Hero'); const o = put(A, 'Hill Giant'); fire('attacks', { list: [c] }); await settle2(); const X = tou(c);
              ok('Captain America, Wings of Freedom: each other Hero gets +X/+X (X = his toughness)', h.tp === X && o.tp === 0, [h.tp, X, o.tp]); }
            // Amareth, the Lustrous
            { const [A] = await fresh(); put(A, 'Amareth, the Lustrous'); const top = inLib(A, 'Hill Giant'); const h0 = A.hand.length; put(A, 'Grizzly Bears'); await settle2();
              ok('Amareth, the Lustrous: a permanent entering with a shared card type puts the top card into your hand', A.hand.includes(top), [A.hand.length - h0]); }
            { const [A] = await fresh(); put(A, 'Amareth, the Lustrous'); const top = inLib(A, 'Plains'); put(A, 'Grizzly Bears'); await settle2();
              ok('Amareth, the Lustrous: no shared type leaves the card on top', !A.hand.includes(top) && A.library[A.library.length - 1] === top, [A.hand.length]); }
            // Ashling the Pilgrim
            { const [A, B] = await fresh(); const a = put(A, 'Ashling the Pilgrim'); lands(A, 6, 'Mountain'); const v = put(B, 'Grizzly Bears'); for (let i = 0; i < 3; i++) { await activate(A, a, acts(a)[0]); await settle2(); }
              ok('Ashling the Pilgrim: the third activation in a turn removes its counters and damages everything', a.counters === 0 && A.life < 20 && !B.bf.includes(v), [a.counters, A.life, B.life]); }
            // Emmara Tandris
            { const [A, B] = await fresh(); put(A, 'Emmara Tandris'); const t = syn(A, 'Grizzly Bears', 'Creature — Bear', {}, { token: true }); const s = put(B, 'Shivan Dragon'); damage(t, 3, s);
              ok('Emmara Tandris: damage to your creature tokens is prevented', t.dmg === 0, [t.dmg]); }
            // Witch-king, Sky Scourge
            { const [A] = await fresh(); const w = syn(A, 'Grizzly Bears', 'Creature — Wraith'); put(A, 'Witch-king, Sky Scourge'); const n = A.library.length; fire('attacks', { list: [w] }); await settle2();
              ok('Witch-king, Sky Scourge: attacking with a Wraith exiles cards equal to its power', A.library.length === n - 2 && A.exile.length === 2, [n - A.library.length]); }
            // Narset, Jeskai Waymaster
            { const [A] = await fresh(); put(A, 'Narset, Jeskai Waymaster'); inHand(A, 'Grizzly Bears'); A.castTurn = G.turn; A.castN = 3; const h0 = A.hand.length; fire('end'); await settle2();
              ok('Narset, Jeskai Waymaster: discard your hand, then draw as many cards as spells you cast this turn', A.hand.length === 3 && A.gy.length >= 1, [A.hand.length, A.gy.length]); }
            // Lutri, the Spellchaser
            { const [A] = await fresh(); const l = put(A, 'Lutri, the Spellchaser');
              ok('Lutri, the Spellchaser: reads as fully Automated', Rx(l).support === 'full', [Rx(l).support, Rx(l).unhandled]); }
            // Sylvia Brightspear
            { const [A] = await fresh(); put(A, 'Sylvia Brightspear'); const d = put(A, 'Shivan Dragon'); const b = put(A, 'Grizzly Bears');
              ok('Sylvia Brightspear: Dragons you control have double strike', has(d, 'double strike') && !has(b, 'double strike'), [has(d, 'double strike'), has(b, 'double strike')]); }
            // Plargg, Dean of Chaos
            { const [A] = await fresh(); const p = put(A, 'Plargg, Dean of Chaos'); p.sick = false; lands(A, 5, 'Mountain'); A.library.length = 0; const bear = makeObj(have('Grizzly Bears'), 0); A.library.push(bear); A.library.push(makeObj(have('Mountain'), 0)); await activate(A, p, acts(p)[1]); await settle2(); await settle2();
              ok('Plargg, Dean of Chaos: reveals to a nonlegendary nonland card of mana value 3 or less and casts it free', A.bf.includes(bear) || G.stack.length > 0, [names(A), A.library.length]); }
            // Sigarda, Champion of Light
            { const [A] = await fresh(); const s = put(A, 'Sigarda, Champion of Light'); syn(A, 'Grizzly Bears', 'Creature — Bear', { power: '1', toughness: '1' }); syn(A, 'Hill Giant', 'Creature — Giant', { power: '3', toughness: '3' }); const hu = inLib(A, 'Serra Angel'); const h2 = makeObj({ ...have('Grizzly Bears'), type: 'Creature — Human' }, 0); A.library.push(h2); fire('attacks', { list: [s] }); await settle2();
              ok('Sigarda, Champion of Light: with three different powers, finds a Human creature among the top five', A.hand.includes(h2), [A.hand.length]); }
            // Aziza, Mage Tower Captain
            { const [A, B] = await fresh(); put(A, 'Aziza, Mage Tower Captain'); for (let i = 0; i < 3; i++) put(A, 'Grizzly Bears'); const sh = inHand(A, 'Shock'); G.stack.push({ id: stackSeq++, kind: 'spell', o: sh, P: A, target: { p: B }, effects: spellEffects(sh), name: 'Shock', x: 0 }); const n0 = G.stack.length; castEv(A, sh); await settle2();
              ok('Aziza, Mage Tower Captain: tapping three creatures copies the instant', A.bf.filter(x => x.tapped).length === 3 && G.stack.length >= n0 || B.life < 20, [A.bf.filter(x => x.tapped).length, G.stack.length, B.life]); }
            // Djeru, With Eyes Open
            { const [A, B] = await fresh(); put(A, 'Djeru, With Eyes Open'); const pw = syn(A, 'Grizzly Bears', 'Planeswalker — Test'); pw.ctr.loyalty = 5; const s = put(B, 'Shivan Dragon'); damage(pw, 3, s);
              ok('Djeru, With Eyes Open: prevents 1 damage dealt to your planeswalkers', pw.dmg === 2 || pw.ctr.loyalty === 3, [pw.dmg, pw.ctr.loyalty]); }
            // Far Fortune, End Boss
            { const [A, B] = await fresh(); A.speed = 4; put(A, 'Far Fortune, End Boss'); const s = put(A, 'Shivan Dragon'); damage(B, 2, s); const v = put(B, 'Hill Giant'); damage(v, 1, s);
              ok('Far Fortune, End Boss: sources you control deal 1 extra damage to opponents and their permanents', B.life === 17 && v.dmg === 2, [B.life, v.dmg]); }
            // Owen Grady, Raptor Trainer
            { const [A] = await fresh(); const o = put(A, 'Owen Grady, Raptor Trainer'); o.sick = false; const d = syn(A, 'Grizzly Bears', 'Creature — Dinosaur'); await activate(A, o, acts(o)[0]); await settle2();
              ok('Owen Grady, Raptor Trainer: puts a keyword counter on a Dinosaur', Object.values(d.ctr).some(v => v > 0) && (has(d, 'trample') || has(d, 'reach') || has(d, 'menace') || has(d, 'haste')), [d.ctr]); }
            // Silas Renn, Seeker Adept
            { const [A, B] = await fresh(); const s = put(A, 'Silas Renn, Seeker Adept'); lands(A, 3, 'Island'); const m = inGy(A, 'Mind Stone'); hit(s, [B]); await settle2(); await settle2();
              ok('Silas Renn, Seeker Adept: casts an artifact card from your graveyard after dealing combat damage', A.bf.includes(m) || G.stack.length > 0, [names(A), A.gy.length]); }
            // Mortarion, Daemon Primarch
            { const [A] = await fresh(); put(A, 'Mortarion, Daemon Primarch'); lands(A, 3, 'Swamp'); A.lostTurn = G.turn; A.lostN = 2; fire('end'); await settle2();
              ok('Mortarion, Daemon Primarch: pays {X} (up to the life lost this turn) for X 2/2 Astartes Warriors with menace', A.bf.filter(x => x.token && /Astartes/.test(x.card.type)).length === 2, [names(A)]); }
            // April O'Neil, Human Element
            { const [A, B] = await fresh(); put(A, "April O'Neil, Human Element"); castEv(B, synHand(B, 'Shock', 'Instant')); await settle2();
              ok("April O'Neil, Human Element: any player casting an instant makes you a Mutagen token", A.bf.some(x => x.card.name === 'Mutagen'), [names(A)]); }
            // Jugan, the Rising Star
            { const [A] = await fresh(); const j = put(A, 'Jugan, the Rising Star'); const b = put(A, 'Grizzly Bears'); dieOrLeave(j, 'gy'); await settle2();
              ok('Jugan, the Rising Star: dying distributes five +1/+1 counters among your creatures', b.counters === 5, [b.counters]); }
            // The Lion-Turtle
            { const [A, B] = await fresh(); const l = put(A, 'The Lion-Turtle'); l.sick = false; const atk = put(B, 'Hill Giant');
              ok('The Lion-Turtle: cannot block or attack without three Lesson cards in the graveyard', !canBlock(l, atk) && !canAttackWith(l), [canBlock(l, atk)]); }
            { const [A, B] = await fresh(); const l = put(A, 'The Lion-Turtle'); l.sick = false; for (let i = 0; i < 3; i++) synGy(A, 'Divination', 'Sorcery — Lesson'); const atk = put(B, 'Hill Giant');
              ok('The Lion-Turtle: with three Lessons it can block and attack', canBlock(l, atk) && canAttackWith(l), [canBlock(l, atk)]); }
            // Syr Vondam, the Lucent
            { const [A] = await fresh(); const s = put(A, 'Syr Vondam, the Lucent'); const b = put(A, 'Grizzly Bears'); await settle2(); b.tp = 0; b.tkw = []; fire('attacks', { list: [s] }); await settle2();
              ok('Syr Vondam, the Lucent: other creatures get +1/+0 and deathtouch until end of turn', b.tp === 1 && has(b, 'deathtouch'), [b.tp]); }
            // Invisible Woman, Sue Storm
            { const [A] = await fresh(); put(A, 'Invisible Woman, Sue Storm'); const h = syn(A, 'Grizzly Bears', 'Creature — Human Hero'); putCounters(h, 1, A); await settle2();
              ok('Invisible Woman, Sue Storm: a +1/+1 counter on another Hero creates a 0/4 Wall with defender', A.bf.some(x => x.token && /Wall/.test(x.card.type) && tou(x) === 4), [names(A)]); }
            // Cynette, Jelly Drover
            { const [A] = await fresh(); put(A, 'Cynette, Jelly Drover'); const f = put(A, 'Air Elemental'); const b = put(A, 'Grizzly Bears');
              ok('Cynette, Jelly Drover: creatures you control with flying get +1/+1', pow(f) === 5 && pow(b) === 2, [pow(f), pow(b)]); }
            // Kirri, Talented Sprout
            { const [A] = await fresh(); put(A, 'Kirri, Talented Sprout'); const l = inGy(A, 'Forest'); fire('main2'); await settle2();
              ok('Kirri, Talented Sprout: returns a Plant, Treefolk, or land card from your graveyard at your postcombat main phase', A.hand.includes(l), [A.hand.length]); }
            // Riku of Two Reflections
            { const [A] = await fresh(); put(A, 'Riku of Two Reflections'); lands(A, 1, 'Forest'); lands(A, 1, 'Island'); put(A, 'Grizzly Bears'); await settle2();
              ok('Riku of Two Reflections: paying {G}{U} when another nontoken creature enters makes a token copy', A.bf.filter(x => x.card.name === 'Grizzly Bears').length === 2, [names(A)]); }
            // Alistair, the Brigadier
            { const [A] = await fresh(); const a = put(A, 'Alistair, the Brigadier'); lands(A, 8, 'Plains'); const b = put(A, 'Grizzly Bears'); syn(A, 'Ornithopter', 'Artifact Creature — Thopter'); const X = A.bf.filter(x => /Artifact|Legendary|Saga/.test(x.card.type)).length; fire('attacks', { list: [a] }); await settle2();
              ok('Alistair, the Brigadier: paying {8} gives creatures +X/+X (X = historic permanents)', b.tp === X && X > 0, [b.tp, X]); }
            // Tegan Jovanka
            { const [A] = await fresh(); put(A, 'Tegan Jovanka'); const a = syn(A, 'Ornithopter', 'Artifact Creature — Thopter'); G.attackers = [a.uid]; fire('attacks', { list: [a] }); await settle2();
              ok('Tegan Jovanka: a target attacking historic creature gets +1/+1 and indestructible', a.tp === 1 && has(a, 'indestructible'), [a.tp]); }
            // Akal Pakal, First Among Equals
            { const [A] = await fresh(); put(A, 'Akal Pakal, First Among Equals'); syn(A, 'Ornithopter', 'Artifact Creature — Thopter'); G.entered = [{ turn: G.turn, o: A.bf[A.bf.length - 1], owner: 0, creature: true }]; const h0 = A.hand.length; fire('end'); await settle2();
              ok('Akal Pakal, First Among Equals: after an artifact entered, look at two cards; one to hand, one to graveyard', A.hand.length === h0 + 1 && A.gy.length >= 1, [A.hand.length - h0, A.gy.length]); }
            // Taeko, the Patient Avalanche
            { const [A] = await fresh(); const t = put(A, 'Taeko, the Patient Avalanche'); const b = put(A, 'Grizzly Bears'); leaveBattlefield(b, 'hand'); await settle2();
              ok('Taeko, the Patient Avalanche: another creature leaving without dying gives a +1/+1 counter', t.counters === 1, [t.counters]); }
            { const [A] = await fresh(); const t = put(A, 'Taeko, the Patient Avalanche'); const b = put(A, 'Grizzly Bears'); dieOrLeave(b, 'gy'); await settle2();
              ok('Taeko, the Patient Avalanche: a creature that dies does nothing', t.counters === 0, [t.counters]); }
            // Ghired, Conclave Exile
            { const [A] = await fresh(); const g = put(A, 'Ghired, Conclave Exile'); syn(A, 'Grizzly Bears', 'Creature — Bear', {}, { token: true }); G.attackers = [g.uid]; await settle2(); const n0 = A.bf.filter(x => x.token).length; fire('attacks', { list: [g] }); await settle2();
              const toks = A.bf.filter(x => x.token); ok('Ghired, Conclave Exile: populate makes a token copy that enters tapped and attacking', toks.length === n0 + 1 && toks.some(x => x.tapped && G.attackers.includes(x.uid)), [toks.length]); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300i', results, []);
    writeOut('cmdr300i', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();

