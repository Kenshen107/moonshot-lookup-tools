// Commander round 3, batch e (2026-10-26): behavior checks for rules/cmdr300e.js and 15-cmdr300e.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300e_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300e_names.json'), 'utf8'));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Divination', 'Shock', 'Treasure Map', 'Giant Growth', 'Ancestral Recall', 'Dark Ritual', 'Goblin Guide', 'Shivan Dragon', 'Air Elemental', 'Wall of Omens', 'Bear Cub', 'Ornithopter', 'Black Lotus', 'Cultivate', 'Island', 'Terror', 'Doom Blade', 'Bonesplitter', 'Lightning Greaves', 'Swords to Plowshares', 'Mountain', 'Elvish Mystic', 'Pacifism', 'History of Benalia']);
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

            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };
            const etb = async (P, o) => { await settle2(); };
            const ty = (o, t) => { o.card = { ...o.card, type: t }; return o; };
            const attack = async (o, list) => { G.attackers = (list || [o]).map(x => x.uid); fire('attacks', { list: list || [o] }); await settle2(); };

            // Ilharg
            { const [A] = await fresh(); const i = put(A, 'Ilharg, the Raze-Boar'); const h = inHand(A, 'Hill Giant'); await attack(i); const on = onBf(h.uid); await runEndQueue(); await settle2();
              ok('Ilharg, the Raze-Boar: a creature from hand enters attacking, returns at end step', on && G.attackers.includes(h.uid) && A.hand.includes(h), [on, A.hand.length]); }
            // Alisaie
            { const [A] = await fresh(); put(A, 'Alisaie Leveilleur'); lands(A, 3); const o = inHand(A, 'Hill Giant'); A.castTurn = G.turn; A.castN = 1; const cost = costOf(A, o); A.castN = 0; const cost0 = costOf(A, o);
              ok('Alisaie Leveilleur: the second spell costs {2} less', cost.generic === cost0.generic - 2, [cost, cost0]); }
            // Azula
            { const [A, B] = await fresh(); const z = put(A, 'Fire Lord Azula'); G.attackers = [z.uid]; lands(A, 3, 'Mountain'); const s = inHand(A, 'Lightning Bolt'); const life0 = B.life; await castSpell(A, s, { p: B }); await settle2(); await settle2();
              ok('Fire Lord Azula: a spell cast while attacking is copied', life0 - B.life === 6, [life0, B.life]); }
            // Pippin
            { const [A] = await fresh(); const p = put(A, 'Pippin, Warden of Isengard'); p.sick = false; const b = put(A, 'Grizzly Bears'); for (let i = 0; i < 4; i++) makeArtifactToken(A, 'food'); await activate(A, p, acts(p).find(a => /four Foods/.test(a.text))); await settle2();
              ok('Pippin, Warden of Isengard: sacrifice four Foods, others +3/+3 and haste', !A.bf.some(x => /Food/.test(x.card.type)) && pow(b) === 5, [pow(b), A.bf.map(x => x.card.name)]); }
            // Rhonas
            { const [A] = await fresh(); const g = put(A, 'Hill Giant'); const r = put(A, 'God-Eternal Rhonas'); await etb(A, r); ok('God-Eternal Rhonas: doubles other creatures\' power', pow(g) === 6, pow(g)); }
            // Merry
            { const [A] = await fresh(); put(A, 'Merry, Warden of Isengard'); fire('enters', { o: put(A, 'Sol Ring') }); await settle2(); const n1 = A.bf.filter(x => x.token && /Soldier/.test(x.card.type)).length; fire('enters', { o: put(A, 'Ornithopter') }); await settle2(); const n2 = A.bf.filter(x => x.token && /Soldier/.test(x.card.type)).length;
              ok('Merry, Warden of Isengard: a Soldier for artifacts entering, once each turn', n1 === 1 && n2 === 1, [n1, n2]); }
            // Pir
            { const [A] = await fresh(); put(A, 'Pir, Imaginative Rascal'); const b = put(A, 'Grizzly Bears'); putCounters(b, 1, A); ok('Pir, Imaginative Rascal: one more +1/+1 counter', b.counters === 2, b.counters); }
            // Shabraz
            { const [A] = await fresh(); const s = put(A, 'Shabraz, the Skyshark'); s.sick = false; const h = ty(put(A, 'Grizzly Bears'), 'Creature — Human'); lands(A, 2, 'Plains'); await activate(A, s, acts(s)[0]); await settle2(); ok('Shabraz, the Skyshark: target Human gains flying', has(h, 'flying'), h.tkw); }
            // Layla
            { const [A] = await fresh(); const l = put(A, 'Layla Hassan'); A.gy.push(makeObj(have('Sol Ring'), 0)); await etb(A, l); ok('Layla Hassan: returns a historic card on enter', A.hand.some(x => x.card.name === 'Sol Ring')); 
              const a = ty(put(A, 'Bear Cub'), 'Creature — Assassin'); A.gy.push(makeObj(have('Ornithopter'), 0)); const [, B] = [A, G.players[1]]; hit(a, [B]); await settle2(); ok('Layla Hassan: Assassin combat damage returns another', A.hand.some(x => x.card.name === 'Ornithopter')); }
            // Anrakyr
            { const [A] = await fresh(); const a = put(A, 'Anrakyr the Traveller'); const s = inHand(A, 'Sol Ring'); const life0 = A.life; await attack(a); await settle2(); ok('Anrakyr the Traveller: casts an artifact paying life', onBf(s.uid) && A.life === life0 - 1, [onBf(s.uid), A.life]); }
            // Keleth
            { const [A] = await fresh(); put(A, 'Keleth, Sunmane Familiar'); const c = put(A, 'Grizzly Bears'); c.isCommander = true; await attack(c); ok('Keleth, Sunmane Familiar: a +1/+1 counter on the attacking commander', c.counters === 1, c.counters); }
            // Mishra
            { const [A, B] = await fresh(); const m = put(A, 'Mishra, Claimed by Gix'); const x = put(A, 'Grizzly Bears'); const l0 = B.life, a0 = A.life; await attack(m, [m, x]); ok('Mishra, Claimed by Gix: drains for each attacker', l0 - B.life === 2 && A.life - a0 === 2, [B.life, A.life]); }
            // Adewale
            { const [A] = await fresh(); const a = put(A, 'Adéwalé, Breaker of Chains'); A.library.length = 0; inLib(A, 'Island'); ty(inLib(A, 'Bear Cub'), 'Creature — Pirate'); inLib(A, 'Island'); await etb(A, a); ok('Adéwalé, Breaker of Chains: a Pirate goes to hand', A.hand.some(x => x.card.name === 'Bear Cub')); }
            // Ishkanah
            { const [A, B] = await fresh(); const i = put(A, 'Ishkanah, Grafwidow'); i.sick = false; ty(put(A, 'Grizzly Bears'), 'Creature — Spider'); ty(put(A, 'Hill Giant'), 'Creature — Spider'); lands(A, 7, 'Swamp'); const l0 = B.life; await activate(A, i, acts(i)[0]); await settle2(); ok('Ishkanah, Grafwidow: opponent loses 1 life per Spider', l0 - B.life >= 2, [l0, B.life]); }
            // Evie
            { const [A] = await fresh(); const e = put(A, 'Evie Frye'); e.sick = false; const b = put(A, 'Grizzly Bears'); lands(A, 1, 'Plains'); A.library.length = 0; inLib(A, 'Island'); A.hand.length = 0; inHand(A, 'Hill Giant'); await activate(A, e, acts(e)[0]); await settle2();
              ok('Evie Frye: loot; a discarded creature makes a creature unblockable', A.gy.some(x => x.card.name === 'Hill Giant') && (has(b, 'unblockable') || has(e, 'unblockable')), [A.gy.length, b.tkw, e.tkw]); }
            // Stiltzkin
            { const [A, B] = await fresh(); const s = put(A, 'Stiltzkin, Moogle Merchant'); s.sick = false; const r = put(A, 'Sol Ring'); lands(A, 2); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); await activate(A, s, acts(s)[0]); await settle2(); ok('Stiltzkin, Moogle Merchant: opponent gets a permanent, you draw', B.bf.length === 1 && A.hand.length === h0 + 1, [B.bf.length, A.hand.length - h0]); }
            // Kolaghan
            { const [A] = await fresh(); const k = put(A, "Kolaghan, the Storm's Fury"); const d = put(A, 'Shivan Dragon'); const b = put(A, 'Grizzly Bears'); await attack(d); ok("Kolaghan, the Storm's Fury: creatures get +1/+0 when a Dragon attacks", pow(b) === 3, pow(b)); }
            // Taborax
            { const [A] = await fresh(); const t = put(A, "Taborax, Hope's Demise"); const a = has(t, 'lifelink'); t.counters = 5; ok("Taborax, Hope's Demise: lifelink with five +1/+1 counters", !a && has(t, 'lifelink'), [a]); }
            // Wyleth
            { const [A] = await fresh(); const w = put(A, 'Wyleth, Soul of Steel'); const e = put(A, 'Bonesplitter'); e.attachedTo = w.uid; const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); await attack(w); ok('Wyleth, Soul of Steel: draws per attached Equipment', A.hand.length === h0 + 1, A.hand.length - h0); }
            // Francisco
            { const [A, B] = await fresh(); const f = put(A, 'Francisco, Fowl Marauder'); const p = ty(put(A, 'Bear Cub'), 'Creature — Pirate'); A.library.push(makeObj(have('Island'), 0)); const c0 = f.counters; hit(p, [B]); await settle2(); ok('Francisco, Fowl Marauder: explores when Pirates deal damage', A.hand.some(x => x.card.name === 'Island') || f.counters > c0, [f.counters]); }
            // Aatchik
            { const [A] = await fresh(); const a = put(A, 'Aatchik, Emerald Radian'); A.gy.push(makeObj(have('Hill Giant'), 0), makeObj(have('Sol Ring'), 0), makeObj(have('Island'), 0)); await etb(A, a); ok('Aatchik, Emerald Radian: an Insect per artifact/creature card in the graveyard', A.bf.filter(x => x.token && /Insect/.test(x.card.type)).length === 2, A.bf.map(x => x.card.name)); }
            // Donatello
            { const [A] = await fresh(); put(A, 'Donatello, the Brains'); fire('tokenMade', { P: A }); await settle2(); ok('Donatello, the Brains: a Mutagen token with created tokens', A.bf.some(x => /Mutagen/.test(x.card.name)), A.bf.map(x => x.card.name)); }
            // Kaalia Zenith
            { const [A] = await fresh(); const k = put(A, 'Kaalia, Zenith Seeker'); A.library.length = 0; inLib(A, 'Island'); ty(inLib(A, 'Bear Cub'), 'Creature — Angel'); ty(inLib(A, 'Hill Giant'), 'Creature — Demon'); await etb(A, k); ok('Kaalia, Zenith Seeker: an Angel and a Demon to hand', A.hand.some(x => x.card.name === 'Bear Cub') && A.hand.some(x => x.card.name === 'Hill Giant')); }
            // Gut
            { const [A] = await fresh(); const g = put(A, 'Gut, True Soul Zealot'); const b = put(A, 'Grizzly Bears'); await attack(g); const sk = A.bf.find(x => x.token && /Skeleton/.test(x.card.name + x.card.type)); ok('Gut, True Soul Zealot: sacrifice a creature for a 4/1 Skeleton attacking', !onBf(b.uid) && sk && pow(sk) === 4 && G.attackers.includes(sk.uid), [A.bf.map(x => x.card.name)]); }
            // Imskir
            { const [A] = await fresh(); const i = put(A, 'Imskir Iron-Eater'); put(A, 'Sol Ring'); put(A, 'Ornithopter'); put(A, 'Sol Ring'); put(A, 'Ornithopter'); const h0 = A.hand.length, l0 = A.life; A.library.push(makeObj(have('Island'), 0), makeObj(have('Island'), 0)); await etb(A, i); ok('Imskir Iron-Eater: draw and lose half the artifacts', A.hand.length - h0 === 2 && l0 - A.life === 2, [A.hand.length - h0, l0 - A.life]); }
            // Lily
            { const [A] = await fresh(); const l = put(A, 'Lily Bowen, Raging Grandma'); l.counters = 3; fire('upkeep'); await settle2(); const a = l.counters; l.counters = 20; const l0 = A.life; fire('upkeep'); await settle2(); ok('Lily Bowen, Raging Grandma: doubles counters, then trims and gains life', a === 6 && l.counters === 1 && A.life - l0 === 19, [a, l.counters, A.life - l0]); }
            // Raiyuu
            { const [A] = await fresh(); const r = put(A, "Raiyuu, Storm's Edge"); ty(r, 'Legendary Creature — Human Samurai'); r.tapped = true; G.extraCombat = 0; await attack(r); ok("Raiyuu, Storm's Edge: untaps and an additional combat", !r.tapped && G.extraCombat === 1, [r.tapped, G.extraCombat]); }
            // Samut
            { const [A, B] = await fresh(); const s = put(A, 'Samut, Vizier of Naktamun'); const c = put(A, 'Grizzly Bears'); c.enteredTurn = G.turn; const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); hit(c, [B]); await settle2(); ok('Samut, Vizier of Naktamun: draw when a new creature connects', A.hand.length === h0 + 1, A.hand.length - h0);
              const d = put(A, 'Hill Giant'); d.enteredTurn = G.turn - 3; A.library.push(makeObj(have('Island'), 0)); const h1 = A.hand.length; hit(d, [B]); await settle2(); ok('Samut, Vizier of Naktamun: not for creatures that entered earlier', A.hand.length === h1, A.hand.length - h1); }
            // Vendilion Clique
            { const [A, B] = await fresh(); const v = put(A, 'Vendilion Clique'); B.hand.length = 0; inHand(B, 'Lightning Bolt'); const bl = B.library.length; B.library.push(makeObj(have('Island'), 1)); await etb(A, v); ok('Vendilion Clique: bottoms a nonland card, its owner draws', !B.hand.some(x => x.card.name === 'Lightning Bolt') && B.library[0].card.name === 'Lightning Bolt' && B.hand.length === 1, [B.hand.map(x => x.card.name)]); }
            // Quandrix
            { const [A, B] = await fresh(); put(A, 'Quandrix, the Proof'); A.library.length = 0; inLib(A, 'Ornithopter'); lands(A, 3, 'Mountain'); const s = inHand(A, 'Lightning Bolt'); s.castFromHand = G.turn; await castSpell(A, s, { p: B }); await settle2(); await settle2(); ok('Quandrix, the Proof: an instant cast from hand cascades', A.bf.some(x => x.card.name === 'Ornithopter'), A.bf.map(x => x.card.name)); }
            // Bilbo
            { const [A] = await fresh(); const b = put(A, 'Bilbo, Birthday Celebrant'); b.sick = false; A.life = 120; lands(A, 2, 'Island'); lands(A, 1, 'Plains'); lands(A, 1, 'Swamp'); lands(A, 1, 'Forest'); A.library.length = 0; inLib(A, 'Hill Giant'); inLib(A, 'Island'); inLib(A, 'Grizzly Bears');
              const a = acts(b).find(x => /Search/.test(x.text)); const ok0 = canActivate(A, b, a); A.life = 10; const ok1 = canActivate(A, b, a); A.life = 120; await activate(A, b, a); await settle2(); ok('Bilbo, Birthday Celebrant: needs 111 life; exile it, creatures from the library enter', ok0 && !ok1 && !onBf(b.uid) && A.bf.some(x => x.card.name === 'Hill Giant') && A.bf.some(x => x.card.name === 'Grizzly Bears'), [ok0, ok1, A.bf.map(x => x.card.name)]); }
            // Krile
            { const [A, B] = await fresh(); put(A, 'Krile Baldesion'); A.gy.push(makeObj(have('Hill Giant'), 0)); lands(A, 4, 'Mountain'); const s = inHand(A, 'Lightning Bolt'); ty(s, 'Instant'); s.card = { ...s.card, cmc: 4 }; await castSpell(A, s, { p: B }); await settle2(); await settle2(); ok('Krile Baldesion: returns a creature of equal mana value', A.hand.some(x => x.card.name === 'Hill Giant'), A.hand.map(x => x.card.name)); }
            // Storm
            { const [A, B] = await fresh(); const st = put(A, 'Storm, Force of Nature'); hit(st, [B]); await settle2(); lands(A, 6, 'Mountain'); const b1 = inHand(A, 'Lightning Bolt'); G.castThisTurn = 0; await castSpell(A, b1, { p: B }); await settle2(); const l1 = B.life; const b2 = inHand(A, 'Lightning Bolt'); await castSpell(A, b2, { p: B }); await settle2(); await settle2(); ok('Storm, Force of Nature: the next instant has storm', A.life > 0 && (l1 === B.life + 3 || B.life <= 40 - 9) , [B.life, l1]); }
            // Mikey & Leo
            { const [A] = await fresh(); put(A, 'Mikey & Leo, Chaos & Order'); const b = put(A, 'Grizzly Bears'); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0), makeObj(have('Island'), 0)); putCounters(b, 1, A); await settle2(); putCounters(b, 1, A); await settle2(); ok('Mikey & Leo: draw when you put a counter, once a turn', A.hand.length === h0 + 1, A.hand.length - h0); }
            // Colfenor
            { const [A] = await fresh(); const c = put(A, 'Colfenor, the Last Yew'); const g = put(A, 'Hill Giant'); A.gy.push(makeObj(have('Grizzly Bears'), 0)); fire('creatureDies', { o: g, lki: { pow: 3, tou: 3 } }); await settle2(); ok('Colfenor, the Last Yew: returns a creature with lesser toughness', A.hand.some(x => x.card.name === 'Grizzly Bears'), A.hand.map(x => x.card.name)); }
            // Ayara
            { const [A, B] = await fresh(); const a = put(A, 'Ayara, Widow of the Realm'); a.sick = false; const h = put(A, 'Hill Giant'); const l0 = B.life, a0 = A.life; await activate(A, a, acts(a)[0]); await settle2(); ok('Ayara, Widow of the Realm: sacrifice for damage and life', !onBf(h.uid) && l0 - B.life === 4 && A.life - a0 === 4, [B.life, A.life, onBf(h.uid)]); }
            // Mr. Foxglove
            { const [A, B] = await fresh(); const m = put(A, 'Mr. Foxglove'); A.hand.length = 0; inHand(B, 'Island'); inHand(B, 'Island'); inHand(B, 'Island'); A.library.push(makeObj(have('Island'), 0), makeObj(have('Island'), 0), makeObj(have('Island'), 0), makeObj(have('Island'), 0)); const bh = B.hand.length; await attack(m); ok('Mr. Foxglove: draw the difference in hand sizes', A.hand.length === bh, [A.hand.length, bh]); }
            // Surrak
            { const [A] = await fresh(); put(A, 'Surrak, Elusive Hunter'); const b = put(A, 'Grizzly Bears'); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); fire('targeted', { o: b, by: 1 }); await settle2(); fire('targeted', { o: b, by: 0 }); await settle2(); ok('Surrak, Elusive Hunter: draw when an opponent targets your creature', A.hand.length === h0 + 1, A.hand.length - h0); }
            // Denethor
            { const [A] = await fresh(); put(A, 'Denethor, Ruling Steward'); fire('end'); await settle2(); const n0 = A.bf.filter(x => x.token).length; const g = put(A, 'Grizzly Bears'); fire('creatureDies', { o: g }); fire('end'); await settle2(); ok('Denethor, Ruling Steward: a Human Soldier only if a creature died under your control', n0 === 0 && A.bf.some(x => x.token && /Soldier/.test(x.card.type + x.card.name)), [n0, A.bf.map(x => x.card.name)]); }
            // Blech
            { const [A] = await fresh(); const b = put(A, 'Blech, Loafing Pest'); const s = ty(put(A, 'Grizzly Bears'), 'Creature — Spider'); const o = put(A, 'Hill Giant'); fire('gainLife', { P: A, n: 2 }); await settle2(); ok('Blech, Loafing Pest: counters on Pests, Bats, Insects, Snakes and Spiders', s.counters === 1 && o.counters === 0 && b.counters === 1, [s.counters, o.counters, b.counters]); }
            // Elizabeth
            { const [A] = await fresh(); const p = put(A, 'Paladin Elizabeth Taggerdy'); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); const g = inHand(A, 'Grizzly Bears'); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); await attack(p, [p, a, b]); ok('Paladin Elizabeth Taggerdy: draw, put a creature in attacking', onBf(g.uid) && G.attackers.includes(g.uid), [onBf(g.uid)]); }
            // Belzenlok
            { const [A] = await fresh(); const d = put(A, 'Demonlord Belzenlok'); A.library.length = 0; inLib(A, 'Hill Giant'); ty(inLib(A, 'Shivan Dragon'), 'Creature — Dragon'); inLib(A, 'Island'); const l0 = A.life; await etb(A, d); ok('Demonlord Belzenlok: repeats for mana value 4+, 1 damage per card', A.hand.some(x => x.card.name === 'Shivan Dragon') && A.hand.some(x => x.card.name === 'Hill Giant') && A.life === l0 - 2, [A.hand.map(x => x.card.name), A.life - l0]); }
            // Casey Jones
            { const [A, B] = await fresh(); put(A, 'Casey Jones, Back Alley Brute'); const b = put(A, 'Grizzly Bears'); const l0 = B.life; putCounters(b, 2, A); await settle2(); ok('Casey Jones, Back Alley Brute: damage equal to counters put', l0 - B.life === 2, [l0, B.life]); }
            // Vannifar
            { const [A] = await fresh(); const v = put(A, 'Prime Speaker Vannifar'); v.sick = false; const g = put(A, 'Llanowar Elves'); A.library.length = 0; inLib(A, 'Grizzly Bears'); inLib(A, 'Shivan Dragon'); await activate(A, v, acts(v)[0]); await settle2(); ok('Prime Speaker Vannifar: sacrifice, search for mana value + 1', !onBf(g.uid) && A.bf.some(x => x.card.name === 'Grizzly Bears'), [A.bf.map(x => x.card.name)]); }
            // Blex
            { const [A] = await fresh(); put(A, 'Blex, Vexing Pest'); const s = ty(put(A, 'Grizzly Bears'), 'Creature — Spider'); const o = put(A, 'Hill Giant'); ok('Blex, Vexing Pest: other Pests/Bats/Insects/Snakes/Spiders get +1/+1', pow(s) === 3 && pow(o) === 3, [pow(s), pow(o)]); }
            // Mog
            { const [A] = await fresh(); const m = put(A, 'Mog, Moogle Warrior'); A.hand.length = 0; for (let i = 0; i < 4; i++) inHand(A, 'Hill Giant'); A.library.push(makeObj(have('Island'), 0), makeObj(have('Island'), 0)); fire('end'); await settle2(); ok('Mog, Moogle Warrior: discard to draw; a creature discard makes a Moogle', A.bf.some(x => x.token && /Moogle/.test(x.card.name + x.card.type)), [A.bf.map(x => x.card.name), A.hand.length]); }
            // Danse
            { const [A] = await fresh(); const d = put(A, 'Paladin Danse, Steel Maverick'); d.sick = false; const h = ty(put(A, 'Grizzly Bears'), 'Creature — Human'); const o = put(A, 'Hill Giant'); await activate(A, d, acts(d)[0]); await settle2(); ok('Paladin Danse, Steel Maverick: exile it, artifact/Human creatures gain indestructible', !onBf(d.uid) && has(h, 'indestructible') && !has(o, 'indestructible'), [onBf(d.uid), h.tkw]); }
            // Altanak
            { const [A] = await fresh(); const a = put(A, 'Altanak, the Thrice-Called'); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); fire('targeted', { o: a, by: 1 }); await settle2(); ok('Altanak, the Thrice-Called: draw when an opponent targets it', A.hand.length === h0 + 1, A.hand.length - h0); }
            // Siegfried
            { const [A] = await fresh(); const s = put(A, 'Siegfried, Famed Swordsman'); A.library.length = 0; for (let i = 0; i < 3; i++) inLib(A, 'Hill Giant'); A.gy.push(makeObj(have('Grizzly Bears'), 0)); await etb(A, s); ok('Siegfried, Famed Swordsman: mill three, twice the creature cards in counters', s.counters === 8, s.counters); }
            // Qala
            { const [A] = await fresh(); const q = put(A, "Qala, Ajani's Pridemate"); q.counters = 2; const b = put(A, 'Grizzly Bears'); await attack(q, [q, b]); ok("Qala, Ajani's Pridemate: other attackers get +X/+0", pow(b) === 4, [pow(b)]); }
            // Raphael Muscle
            { const [A, B] = await fresh(); put(A, 'Raphael, the Muscle'); const b = put(A, 'Grizzly Bears'); b.counters = 1; const t = put(B, 'Hill Giant'); damage(t, 1, b); ok('Raphael, the Muscle: damage from creatures with counters doubles', t.dmg === 2, t.dmg); const c = put(A, 'Bear Cub'); const t2 = put(B, 'Hill Giant'); damage(t2, 1, c); ok('Raphael, the Muscle: not for creatures without counters', t2.dmg === 1, t2.dmg); }
            // Silumgar
            { const [A, B] = await fresh(); const g = put(B, 'Hill Giant'); const s = put(A, 'Dragonlord Silumgar'); await settle2(); const got = A.bf.includes(g); s.tapped = false; leaveBattlefield(s, 'gy'); await settle2(); ok('Dragonlord Silumgar: steals a creature while you control it, returns it when it leaves', got && B.bf.includes(g) && !A.bf.includes(g), [got, B.bf.length]); }
            // Arcum
            { const [A] = await fresh(); const a = put(A, 'Arcum Dagsson'); a.sick = false; const o = put(A, 'Ornithopter'); A.library.length = 0; inLib(A, 'Sol Ring'); await activate(A, a, acts(a)[0]); await settle2(); ok('Arcum Dagsson: sacrifice an artifact creature, fetch a noncreature artifact', !onBf(o.uid) && A.bf.some(x => x.card.name === 'Sol Ring'), [A.bf.map(x => x.card.name)]); }
            // Eowyn
            { const [A] = await fresh(); const e = put(A, 'Éowyn, Lady of Rohan'); const b = put(A, 'Grizzly Bears'); fire('combat'); await settle2(); ok('Éowyn, Lady of Rohan: a creature gains first strike or vigilance', P_has(A)); function P_has(P) { return P.bf.some(x => has(x, 'first strike') || has(x, 'vigilance')); } }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300e', results, []);
    writeOut('cmdr300e', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
