// Commander round 2, batch g (2026-10-26): behavior checks for rules/cmdr300g.js and 15-cmdr300g.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300g_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300g_names.json'), 'utf8'));
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
            const syn = (P, n, type, extra, objExtra) => T.put(P, { ...have(n), type, ...(extra || {}) }, objExtra);
            const synHand = (P, n, type, extra) => { const o = makeObj({ ...have(n), type, ...(extra || {}) }, P.i); P.hand.push(o); return o; };
            const mkLand = (P, n) => { for (let i = 0; i < n; i++) syn(P, 'Island', 'Land'); };
            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };
            const castEv = (P, o) => { o.castFromHand = G.turn; fire('cast', { o, P }); };
            // Abaddon the Despoiler
            { const [A, B] = await fresh(); put(A, 'Abaddon the Despoiler'); B.lostTurn = G.turn; B.lostN = 5; const bears = inHand(A, 'Grizzly Bears'); inLib(A, 'Llanowar Elves'); castEv(A, bears); await settle2();
              ok('Abaddon the Despoiler: a spell cast from hand with mana value up to the life opponents lost this turn has cascade', A.bf.some(x => x.card.name === 'Llanowar Elves'), A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); put(A, 'Abaddon the Despoiler'); const bears = inHand(A, 'Grizzly Bears'); inLib(A, 'Llanowar Elves'); castEv(A, bears); await settle2();
              ok('Abaddon the Despoiler: no cascade when opponents have lost no life', !A.bf.some(x => x.card.name === 'Llanowar Elves'), A.bf.map(x => x.card.name)); }
            // Veronica + Junk
            { const [A] = await fresh(); put(A, 'Veronica, Dissident Scribe'); fire('discarded', { P: A, o: makeObj(have('Grizzly Bears'), 0) }); fire('discarded', { P: A, o: makeObj(have('Hill Giant'), 0) }); await settle2(); const n1 = A.bf.filter(x => x.card.name === 'Junk').length;
              G.turn++; fire('discarded', { P: A, o: makeObj(have('Island'), 0) }); await settle2(); const n2 = A.bf.filter(x => x.card.name === 'Junk').length;
              ok('Veronica, Dissident Scribe: one Junk token for the first nonland discard each turn (a land does nothing)', n1 === 1 && n2 === 1, [n1, n2]); }
            { const [A] = await fresh(); applyEffect(A, { t: 'artToken', kind: 'junk', n: 1 }, null, { card: { name: 'x' } }); await settle2(); const j = A.bf.find(x => x.card.name === 'Junk'); const top = inLib(A, 'Hill Giant'); await activate(A, j, acts(j)[0]); await settle2();
              ok('Junk token: sacrifice it to exile the top card and play it this turn', !onBf(j.uid) && A.exile.includes(top) && top.playUntil === G.turn, [A.exile.length, top.playUntil]); }
            // Xavier Sal
            { const [A] = await fresh(); const x = put(A, 'Xavier Sal, Infested Captain'); const b = put(A, 'Grizzly Bears'); b.counters = 1; applyEffect(A, { t: 'token', n: 1, p: 1, q: 1, name: 'white Soldier', kw: [] }, null, x); await settle2(); const n0 = A.bf.filter(y => y.token).length; await activate(A, x, acts(x)[0]); await settle2();
              ok('Xavier Sal, Infested Captain: removes a counter from another permanent and populates', b.counters === 0 && A.bf.filter(y => y.token).length === n0 + 1, [b.counters, n0, A.bf.filter(y => y.token).length]); }
            // Tawnos
            { const [A] = await fresh(); put(A, 'Tawnos, the Toymaker'); const o = synHand(A, 'Grizzly Bears', 'Creature — Beast'); castEv(A, o); await settle2();
              ok('Tawnos, the Toymaker: casting a Beast makes a token copy that is also an artifact', A.bf.some(x => x.token && x.card.name === 'Grizzly Bears' && /Artifact/.test(x.card.type)), A.bf.map(x => x.card.type)); }
            { const [A] = await fresh(); put(A, 'Tawnos, the Toymaker'); castEv(A, inHand(A, 'Hill Giant')); await settle2();
              ok('Tawnos, the Toymaker: a creature that is not a Beast or Bird is not copied', !A.bf.some(x => x.token), A.bf.length); }
            // Strago and Relm
            { const [A, B] = await fresh(); const s = put(A, 'Strago and Relm'); lands(A, 3, 'Mountain'); B.library.push(makeObj(have('Grizzly Bears'), 1)); await activate(A, s, acts(s)[0]); await settle2();
              const bear = A.bf.find(x => x.card.name === 'Grizzly Bears'); const hasteNow = !!bear && (has(bear, 'haste') || bear.tkw.includes('haste')); await runEndQueue(); await settle2();
              ok('Strago and Relm: casts the exiled creature free with haste and sacrifices it at the end step', !!bear && hasteNow && !A.bf.some(x => x.card.name === 'Grizzly Bears'), [!!bear, hasteNow]); }
            // Quistis Trepe
            { const [A, B] = await fresh(); lands(A, 1, 'Mountain'); inGy(A, 'Lightning Bolt'); const q = inHand(A, 'Quistis Trepe'); putOntoBattlefield(A, q); await settle2();
              ok('Quistis Trepe: casts an instant from a graveyard (paying its cost) and exiles it afterwards', B.life < 20 && !A.gy.some(x => x.card.name === 'Lightning Bolt'), [B.life, A.gy.map(x => x.card.name), A.exile.map(x => x.card.name)]); }
            // Kothophed
            { const [A, B] = await fresh(); put(A, 'Kothophed, Soul Hoarder'); const g = put(B, 'Hill Giant'); const mine = put(A, 'Grizzly Bears'); const h0 = A.hand.length; dieOrLeave(mine, 'gy'); await settle2(); const a = A.hand.length; dieOrLeave(g, 'gy'); await settle2();
              ok('Kothophed, Soul Hoarder: draws and loses 1 life when another player\'s permanent is put into a graveyard (not your own)', a === h0 && A.hand.length === h0 + 1 && A.life === 19, [h0, a, A.hand.length, A.life]); }
            // Mabel
            { const [A] = await fresh(); const m = inHand(A, 'Mabel, Heir to Cragflame'); putOntoBattlefield(A, m); await settle2(); const c = A.bf.find(x => x.card.name === 'Cragflame');
              ok('Mabel, Heir to Cragflame: creates the Cragflame Equipment token, which reads as automated', !!c && /Equipment/.test(c.card.type) && Rx(c).support === 'full', [!!c, c && Rx(c).support, c && Rx(c).unhandled]); }
            // Shirei
            { const [A] = await fresh(); put(A, 'Shirei, Shizo\'s Caretaker'); const s = syn(A, 'Grizzly Bears', 'Creature — Bear', { power: '1', toughness: '1' }); const big = put(A, 'Hill Giant'); dieOrLeave(s, 'gy'); dieOrLeave(big, 'gy'); await settle2(); await runEndQueue(); await settle2();
              ok('Shirei, Shizo\'s Caretaker: a creature with power 1 or less returns at the next end step (bigger ones do not)', A.bf.includes(s) && !A.bf.includes(big), [A.bf.map(x => x.card.name)]); }
            // Niv-Mizzet Reborn
            { const [A] = await fresh(); A.library.length = 0; const wu = makeObj({ ...have('Island'), type: 'Creature', colors: ['W', 'U'], cmc: 2 }, 0), br = makeObj({ ...have('Island'), type: 'Creature', colors: ['B', 'R'], cmc: 2 }, 0), w = makeObj({ ...have('Island'), type: 'Creature', colors: ['W'], cmc: 1 }, 0);
              A.library.push(...[w, wu, br].map(x => x)); for (let i = 0; i < 6; i++) A.library.push(makeObj(have('Island'), 0)); const n = inHand(A, 'Niv-Mizzet Reborn'); const h0 = A.hand.length; putOntoBattlefield(A, n); await settle2();
              ok('Niv-Mizzet Reborn: puts one card of each exact color pair among the top ten into your hand', A.hand.includes(wu) && A.hand.includes(br) && !A.hand.includes(w), [A.hand.length - h0, A.hand.includes(wu), A.hand.includes(br), A.hand.includes(w)]); }
            // Jason Bright
            { const [A] = await fresh(); put(A, 'Jason Bright, Glowing Prophet'); const z = syn(A, 'Grizzly Bears', 'Creature — Zombie'); z.counters = 1; const z2 = syn(A, 'Grizzly Bears', 'Creature — Zombie'); const h0 = A.hand.length; dieOrLeave(z2, 'gy'); await settle2(); const a = A.hand.length; dieOrLeave(z, 'gy'); await settle2();
              ok('Jason Bright: draws when a Zombie dies with power different from its base power (not otherwise)', a === h0 && A.hand.length === h0 + 1, [h0, a, A.hand.length]); }
            // Vito
            { const [A, B] = await fresh(); const v = put(A, 'Vito, Fanatic of Aclazotz'); const f = [put(A, 'Grizzly Bears'), put(A, 'Grizzly Bears'), put(A, 'Grizzly Bears')]; const l0 = A.life;
              for (let i = 0; i < 3; i++) { fire('sacrificed', { o: f[i] }); await settle2(); if (i === 0) var g1 = A.life; if (i === 1) var b2 = B.life; }
              ok('Vito, Fanatic of Aclazotz: first sacrifice gains 2, second drains each opponent 2, third makes a 4/3 flying Vampire Demon', g1 === l0 + 2 && b2 === 18 && A.bf.some(x => x.token && pow(x) === 4 && tou(x) === 3), [g1, b2, A.bf.map(x => x.card.name)]); }
            // Omega
            { const [A, B] = await fresh(); mkLand(A, 2); const g = put(B, 'Hill Giant'); const l0 = A.life; const o = inHand(A, 'Omega, Heartless Evolution'); putOntoBattlefield(A, o); await settle2();
              ok('Omega, Heartless Evolution: taps an opponent\'s permanent with X stun counters and you gain X life (X = nonbasic lands)', g.tapped && g.ctr.stun === 2 && A.life === l0 + 2, [g.tapped, g.ctr.stun, A.life - l0]); }
            // Yidris
            { const [A, B] = await fresh(); const y = put(A, 'Yidris, Maelstrom Wielder'); hit(y, [B]); await settle2(); const bears = inHand(A, 'Grizzly Bears'); inLib(A, 'Llanowar Elves'); castEv(A, bears); await settle2();
              ok('Yidris, Maelstrom Wielder: after combat damage, spells cast from hand this turn gain cascade', A.bf.some(x => x.card.name === 'Llanowar Elves'), A.bf.map(x => x.card.name)); }
            // Edgar
            { const [A] = await fresh(); put(A, 'Edgar, King of Figaro'); let all = true; for (let i = 0; i < 20; i++) { A.g_flipTurn = undefined; if (!flipCoin(A)) all = false; }
              const [A2] = await fresh(); let lost = false; for (let i = 0; i < 40; i++) { A2.g_flipTurn = undefined; if (!flipCoin(A2)) lost = true; }
              ok('Edgar, King of Figaro: the first coin flip each turn is always won (a normal flip can lose)', all && lost, [all, lost]); }
            // Hawkeye
            { const [A, B] = await fresh(); const h = put(A, 'Hawkeye, Young Avenger'); const s = put(A, 'Grizzly Bears'); damage(B, 2, s); const noncombat = 20 - B.life; B.life = 20; G.inCombatDamage = true; damage(B, 2, s); G.inCombatDamage = false; const combat = 20 - B.life;
              ok('Hawkeye, Young Avenger: noncombat damage to an opponent is increased by his power (combat damage is not)', noncombat === 2 + pow(h) && combat === 2, [noncombat, combat, pow(h)]); }
            // Nashi
            { const [A, B] = await fresh(); const n = put(A, 'Nashi, Searcher in the Dark'); A.library.length = 0; const leg = makeObj({ ...have('Island'), type: 'Legendary Creature — Cat' }, 0); A.library.push(leg, makeObj(have('Island'), 0), makeObj(have('Island'), 0)); hit(n, [B], 3); await settle2();
              const got = A.hand.includes(leg) && n.counters === 0;
              A.library.length = 0; A.library.push(makeObj(have('Island'), 0), makeObj(have('Island'), 0)); hit(n, [B], 2); await settle2();
              ok('Nashi, Searcher in the Dark: mills that many, may take legendary or enchantment cards, otherwise gets a +1/+1 counter', got && n.counters === 1, [got, n.counters]); }
            // Dogmeat
            { const [A, B] = await fresh(); put(A, 'Dogmeat, Ever Loyal'); const b = put(A, 'Grizzly Bears'); const plain = put(A, 'Grizzly Bears'); fire('attacks', { list: [plain] }); await settle2(); const n0 = A.bf.filter(x => x.card.name === 'Junk').length;
              const eq = syn(A, 'Sol Ring', 'Artifact — Equipment'); eq.attachedTo = b.uid; fire('attacks', { list: [b] }); await settle2();
              ok('Dogmeat, Ever Loyal: a Junk token when an equipped or enchanted creature of yours attacks', n0 === 0 && A.bf.filter(x => x.card.name === 'Junk').length === 1, [n0, A.bf.filter(x => x.card.name === 'Junk').length]); }
            // Vaevictis Asmadi
            { const [A, B] = await fresh(); const v = put(A, 'Vaevictis Asmadi, the Dire'); put(A, 'Plains'); const g = put(B, 'Hill Giant'); fire('attacks', { list: [v] }); await settle2();
              ok('Vaevictis Asmadi: each player sacrifices a chosen permanent and reveals the top card, putting it onto the battlefield if it is a permanent', B.gy.includes(g) && B.bf.some(x => x.card.name === 'Island') && A.bf.some(x => x.card.name === 'Island'), [B.gy.length, B.bf.map(x => x.card.name), A.bf.map(x => x.card.name)]); }
            // Sin
            { const [A] = await fresh(); const s = put(A, 'Sin, Spira\'s Punishment'); inGy(A, 'Island'); inGy(A, 'Grizzly Bears'); const r0 = Math.random; Math.random = () => 0; await CMD.g_sin(A, {}, null, s); Math.random = r0; await settle2();
              ok('Sin, Spira\'s Punishment: exiles a permanent card at random, makes a tapped token copy, and repeats for lands', A.bf.filter(x => x.token && x.card.name === 'Island' && x.tapped).length === 1 && A.bf.some(x => x.token && x.card.name === 'Grizzly Bears') && A.gy.length === 0, [A.bf.map(x => x.card.name), A.gy.length]); }
            // Baba Lysaga
            { const [A, B] = await fresh(); const b = put(A, 'Baba Lysaga, Night Witch'); put(A, 'Plains'); put(A, 'Grizzly Bears'); put(A, 'Sol Ring'); const l0 = A.life, h0 = A.hand.length; await activate(A, b, acts(b)[0]); await settle2();
              ok('Baba Lysaga, Night Witch: sacrificing three permanents of three card types drains 3, gains 3 and draws three', B.life === 17 && A.life === l0 + 3 && A.hand.length === h0 + 3, [B.life, A.life - l0, A.hand.length - h0]); }
            // Atemsis
            { const [A, B] = await fresh(); const a = put(A, 'Atemsis, All-Seeing'); A.hand.length = 0; for (let c = 0; c < 5; c++) A.hand.push(makeObj({ ...have('Island'), cmc: c }, 0)); hit(a, [B]); await settle2(); const safe = !B.out && !G.over;
              A.hand.push(makeObj({ ...have('Island'), cmc: 5 }, 0)); hit(a, [B]); await settle2();
              ok('Atemsis, All-Seeing: the damaged player loses the game when your revealed hand has six different mana values', safe && (B.out || G.over), [safe, B.out, G.over]); }
            // Legolas
            { const [A, B] = await fresh(); const l = put(A, 'Legolas, Master Archer'); l.counters = 3; const t = put(B, 'Grizzly Bears'); fire('targeted', { o: t, by: 0 }); await settle2();
              ok('Legolas, Master Archer: when you target a creature you don\'t control it deals damage equal to its power to a creature', !onBf(t.uid), [B.bf.map(x => x.card.name)]); }
            // Sarah Jane Smith: reads as fully automated
            { const c = have('Sarah Jane Smith'); ok('Sarah Jane Smith: reads as fully automated', Rx(makeObj(c, 0)).support === 'full', Rx(makeObj(c, 0)).unhandled); }
            // Aphelia
            { const [A, B] = await fresh(); const a = put(A, 'Aphelia, Viper Whisperer'); lands(A, 3, 'Swamp'); lands(A, 2, 'Plains'); const sn = syn(A, 'Grizzly Bears', 'Creature — Snake'); hit(sn, [B]); await settle2(); const b0 = B.life; await activate(A, a, acts(a)[0]); await settle2(); hit(sn, [B]); await settle2();
              ok('Aphelia, Viper Whisperer: after {4}{B}, a Snake that hits a player makes them lose half their life, rounded up', b0 === 20 && B.life === 10, [b0, B.life]); }
            // Tatyova
            { const [A] = await fresh(); put(A, 'Tatyova, Steward of Tides'); lands(A, 6); put(A, 'Plains'); await settle2(); const made = A.bf.filter(x => gIsLand(x) && isCreature(x));
              ok('Tatyova, Steward of Tides: with seven lands a land becomes a 3/3 Elemental creature with haste', made.length === 1 && pow(made[0]) === 3 && tou(made[0]) === 3, made.map(x => pow(x))); }
            // Unesh
            { const [A, B] = await fresh(); A.library.length = 0; ['Plains', 'Island', 'Hill Giant', 'Grizzly Bears'].forEach(n => inLib(A, n)); const n0 = A.hand.length + A.gy.length; const u = inHand(A, 'Unesh, Criosphinx Sovereign'); const n1 = A.hand.length; putOntoBattlefield(A, u); await settle2();
              ok('Unesh, Criosphinx Sovereign: reveals four cards, an opponent splits them into two piles, you take one pile to hand and the other to the graveyard', (A.hand.length + A.gy.length) === n0 + 4 - 1 + 0 + 1 - 1 + 1 - 0 && A.library.length === 0 && A.gy.length >= 1, [A.hand.length, A.gy.length, A.library.length]); }
            // Ghen
            { const [A] = await fresh(); const g = put(A, 'Ghen, Arcanum Weaver'); lands(A, 1, 'Mountain'); lands(A, 1, 'Plains'); lands(A, 1, 'Swamp'); const e1 = syn(A, 'Grizzly Bears', 'Enchantment', { power: undefined }); const e2 = makeObj({ ...have('Grizzly Bears'), type: 'Enchantment' }, 0); A.gy.push(e2); await activate(A, g, acts(g)[0]); await settle2();
              ok('Ghen, Arcanum Weaver: sacrifices an enchantment to return an enchantment card from the graveyard to the battlefield', A.bf.includes(e2) && A.gy.includes(e1), [A.bf.length, A.gy.length]); }
            // The Destined Black Mage
            { const [A, B] = await fresh(); put(A, 'The Destined Black Mage'); castEv(A, inHand(A, 'Lightning Bolt')); await settle2(); const a = B.life; castEv(A, inHand(A, 'Grizzly Bears')); await settle2(); const b = B.life;
              ['Cleric', 'Rogue', 'Warrior', 'Wizard'].forEach(w => syn(A, 'Grizzly Bears', 'Creature — ' + w)); castEv(A, inHand(A, 'Divination')); await settle2();
              ok('The Destined Black Mage: 1 damage to each opponent per noncreature spell, 3 with a full party', a === 19 && b === 19 && B.life === 16, [a, b, B.life]); }
            // Sierra
            { const [A] = await fresh(); const s = put(A, 'Sierra, Nuka\'s Biggest Fan'); s.ctr.quest = 3; const b = put(A, 'Grizzly Bears'); const p0 = pow(s) + pow(b); applyEffect(A, { t: 'artToken', kind: 'food', n: 1 }, null, s); await settle2(); const f = A.bf.find(x => x.card.name === 'Food'); fire('sacrificed', { o: f }); await settle2();
              ok('Sierra, Nuka\'s Biggest Fan: sacrificing a Food gives a creature +X/+X where X is her quest counters', pow(s) + pow(b) === p0 + 3, [pow(s) + pow(b), p0]); }
            // Pharika
            { const [A, B] = await fresh(); const p = put(A, 'Pharika, God of Affliction'); lands(A, 1, 'Swamp'); lands(A, 1, 'Forest'); const g = makeObj(have('Hill Giant'), 1); B.gy.push(g); await activate(A, p, acts(p)[0]); await settle2();
              ok('Pharika, God of Affliction: exiles a creature card from a graveyard and its owner gets a 1/1 deathtouch Snake', B.exile.includes(g) && B.bf.some(x => x.token && pow(x) === 1 && has(x, 'deathtouch')), [B.exile.length, B.bf.map(x => x.card.name)]); }
            // Iron Man
            { const [A] = await fresh(); put(A, 'Iron Man, Bleeding Edge'); const r = inHand(A, 'Sol Ring'); castEv(A, r); await settle2(); const n1 = A.bf.filter(x => x.token && x.card.name === 'Sol Ring').length; castEv(A, inHand(A, 'Sol Ring')); await settle2();
              ok('Iron Man, Bleeding Edge: copies an artifact spell you cast, once each turn', n1 === 1 && A.bf.filter(x => x.token && x.card.name === 'Sol Ring').length === 1, [n1]); }
            // Kethek
            { const [A] = await fresh(); const k = put(A, 'Kethek, Crucible Goliath'); const g = syn(A, 'Hill Giant', 'Creature — Giant', { power: '0', toughness: '1', cmc: 4 }); A.library.length = 0; A.library.push(makeObj(have('Island'), 0)); const b = inLib(A, 'Grizzly Bears'); fire('end'); await settle2();
              ok('Kethek, Crucible Goliath: at the end step you may sacrifice another creature to put a nonlegendary creature with lesser mana value onto the battlefield', A.gy.includes(g) && A.bf.includes(b), [A.gy.length, A.bf.map(x => x.card.name)]); }
            // Ukkima
            { const [A, B] = await fresh(); const u = put(A, 'Ukkima, Stalking Shadow'); const X = pow(u); const l0 = A.life; leaveBattlefield(u, 'gy'); await settle2();
              ok('Ukkima, Stalking Shadow: when it leaves it deals X damage to a player and you gain X life (X = its power)', X > 0 && B.life === 20 - X && A.life === l0 + X, [X, B.life, A.life - l0]); }
            // Empress Galina
            { const [A, B] = await fresh(); const g = put(A, 'Empress Galina'); lands(A, 2, 'Island'); const l = syn(B, 'Hill Giant', 'Legendary Creature — Giant'); await activate(A, g, acts(g)[0]); await settle2();
              ok('Empress Galina: gains control of target legendary permanent', A.bf.includes(l) && l.owner === 0, [A.bf.map(x => x.card.name)]); }
            // Garna
            { const [A] = await fresh(); const d = put(A, 'Grizzly Bears'); dieOrLeave(d, 'gy'); const old = inGy(A, 'Hill Giant'); const g = inHand(A, 'Garna, the Bloodflame'); putOntoBattlefield(A, g); await settle2();
              ok('Garna, the Bloodflame: returns creature cards put into your graveyard this turn to hand (not older ones)', A.hand.includes(d) && !A.hand.includes(old) && A.gy.includes(old), [A.hand.map(x => x.card.name)]); }
            // Anowon
            { const [A, B] = await fresh(); put(A, 'Anowon, the Ruin Thief'); const r = syn(A, 'Grizzly Bears', 'Creature — Rogue'); B.library.length = 0; B.library.push(makeObj(have('Island'), 1), makeObj(have('Grizzly Bears'), 1), makeObj(have('Island'), 1)); const h0 = A.hand.length; hit(r, [B], 2); await settle2();
              ok('Anowon, the Ruin Thief: a Rogue\'s combat damage mills that many cards and you draw if a creature was milled', B.gy.length === 2 && A.hand.length === h0 + 1, [B.gy.length, A.hand.length - h0]); }
            // The Destined White Mage
            { const [A] = await fresh(); put(A, 'The Destined White Mage'); put(A, 'Grizzly Bears'); const sum = () => A.bf.reduce((a, x) => a + x.counters, 0); fire('gainLife', { P: A, n: 2 }); await settle2(); const one = sum();
              ['Cleric', 'Rogue', 'Warrior', 'Wizard'].forEach(w => syn(A, 'Hill Giant', 'Creature — ' + w)); fire('gainLife', { P: A, n: 2 }); await settle2();
              ok('The Destined White Mage: gaining life puts a +1/+1 counter on a creature, three with a full party', one === 1 && sum() === 4, [one, sum()]); }
            // Sensational Spider-Man
            { const [A, B] = await fresh(); const s = put(A, 'Sensational Spider-Man'); const g = put(B, 'Hill Giant'); G.defender = 1; fire('attacks', { list: [s] }); await settle2(); const one = g.tapped && g.ctr.stun === 1;
              const mine = put(A, 'Grizzly Bears'); mine.ctr.stun = 2; const h0 = A.hand.length; fire('attacks', { list: [s] }); await settle2();
              ok('Sensational Spider-Man: taps a creature and stuns it, then removes up to three stun counters (its controller draws that many)', one && mine.ctr.stun === 0 && A.hand.length === h0 + 2, [one, mine.ctr.stun, A.hand.length - h0]); }
            // Dwalin
            { const [A] = await fresh(); const eq = syn(A, 'Sol Ring', 'Artifact — Equipment'); const d = inHand(A, 'Dwalin, Weaponmaster'); putOntoBattlefield(A, d); await settle2(); const a = eq.ctr.hone; fire('attacks', { list: [d] }); await settle2();
              ok('Dwalin, Weaponmaster: a hone counter on each Equipment you control when it enters and when it attacks', a === 1 && eq.ctr.hone === 2, [a, eq.ctr.hone]); }
            // Bilbo
            { const [A] = await fresh(); put(A, 'Bilbo, Fellow Conspirator'); applyEffect(A, { t: 'artToken', kind: 'food', n: 1 }, null, { card: { name: 'x' } }); await settle2();
              ok('Bilbo, Fellow Conspirator: creating a Food token also creates a Treasure token', A.bf.filter(x => x.card.name === 'Food').length === 1 && A.bf.filter(x => x.card.name === 'Treasure').length === 1, A.bf.map(x => x.card.name)); }
            // Norin
            { const [A, B] = await fresh(); put(A, 'Norin, Swift Survivalist'); const b = put(A, 'Grizzly Bears'); const g = put(B, 'Hill Giant'); G.blocks = { [b.uid]: [g.uid] }; fire('blocked', { o: b }); await settle2();
              ok('Norin, Swift Survivalist: a blocked creature may be exiled and played from exile this turn', !onBf(b.uid) && A.exile.includes(b) && b.playUntil === G.turn, [A.exile.length, b.playUntil]); }
            // Heiko Yamazaki
            { const [A] = await fresh(); put(A, 'Heiko Yamazaki, the General'); lands(A, 1, 'Plains'); const sam = syn(A, 'Grizzly Bears', 'Creature — Samurai'); inGy(A, 'Sol Ring'); fire('attacks', { list: [sam] }); await settle2();
              ok('Heiko Yamazaki, the General: a Samurai or Warrior attacking alone lets you cast an artifact card from your graveyard', A.bf.some(x => x.card.name === 'Sol Ring'), A.bf.map(x => x.card.name)); }
            // Eleventh Doctor
            { const [A, B] = await fresh(); const d = put(A, 'The Eleventh Doctor'); A.hand.length = 0; const c = inHand(A, 'Hill Giant'); hit(d, [B]); await settle2();
              ok('The Eleventh Doctor: exiles a card from hand with time counters equal to its mana value (suspended)', A.exile.includes(c) && c.ctr.time === 4 && c.suspended, [A.exile.length, c.ctr.time]); }
            // Sivriss
            { const [A, B] = await fresh(); const s = put(A, 'Sivriss, Nightmare Speaker'); put(A, 'Grizzly Bears'); const top = inLib(A, 'Serra Angel'); const h0 = A.hand.length; await activate(A, s, acts(s)[0]); await settle2();
              ok('Sivriss, Nightmare Speaker: mills a card per opponent and returns it to hand unless that player pays 3 life', (A.hand.includes(top) && B.life === 20) || (A.gy.includes(top) && B.life === 17), [A.hand.length - h0, B.life]); }
            // Mirri the Cursed
            { const [A, B] = await fresh(); const m = put(A, 'Mirri the Cursed'); const t = put(B, 'Hill Giant'); G.inCombatDamage = true; damage(t, 1, m); G.inCombatDamage = false; await settle2(); const a = m.counters; damage(t, 1, m); await settle2();
              ok('Mirri the Cursed: a +1/+1 counter when it deals combat damage to a creature (not noncombat)', a === 1 && m.counters === 1, [a, m.counters]); }
            // The Sentry
            { const [A, B] = await fresh(); const s = inHand(A, 'The Sentry, Golden Guardian'); putOntoBattlefield(A, s); await settle2(); const v = B.bf.find(x => x.card.name === 'The Void');
              ok('The Sentry, Golden Guardian: target opponent creates The Void, a 5/5 flying indestructible token that must attack', !!v && pow(v) === 5 && has(v, 'flying') && has(v, 'indestructible') && Rx(v).support === 'full', [!!v, v && pow(v), v && Rx(v).support]); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300g', results, []);
    writeOut('cmdr300g', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
