// Commander round 2, batch b (2026-10-26): behavior checks for rules/cmdr300b.js and 15-cmdr300b.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300b_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300b_names.json'), 'utf8'));
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
            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };
            { const [A] = await fresh(); put(A, 'Knuckles the Echidna'); for (let i = 0; i < 29; i++) put(A, 'Ornithopter'); G.active = 0; fire('upkeep'); await settle2(); const noWin = !G.over; put(A, 'Ornithopter'); put(A, 'Ornithopter'); fire('upkeep'); await settle2();
              ok('Knuckles the Echidna: you win at upkeep with thirty or more artifacts (not before)', noWin && G.over, [noWin, G.over, A.bf.length]); }
            { const [A] = await fresh(); put(A, 'The Gaffer'); const h0 = A.hand.length; fire('gainLife', { P: A, n: 2 }); fire('end'); await settle2(); const a = A.hand.length; fire('gainLife', { P: A, n: 1 }); fire('end'); await settle2();
              ok('The Gaffer: draws at an end step only if you gained 3 or more life this turn', a === h0 && A.hand.length === h0 + 1, [h0, a, A.hand.length]); }
            { const [A, B] = await fresh(); put(A, 'Massacre Girl, Known Killer'); const g = put(B, 'Hill Giant'); const h0 = A.hand.length; g.tq = -3; dieOrLeave(g, 'gy'); await settle2(); const g2 = put(B, 'Hill Giant'); dieOrLeave(g2, 'gy'); await settle2();
              ok('Massacre Girl, Known Killer: draws when an opponent\'s creature dies with toughness less than 1 (only then)', A.hand.length === h0 + 1, A.hand.length - h0); }
            { const [A] = await fresh(); put(A, 'Alesha, Who Laughs at Fate'); inGy(A, 'Grizzly Bears'); inGy(A, 'Serra Angel'); A.attackedTurn = G.turn; fire('end'); await settle2();
              ok('Alesha, Who Laughs at Fate: returns a creature with mana value up to her power at the end step after attacking', A.bf.some(x => x.card.name === 'Grizzly Bears') && !A.bf.some(x => x.card.name === 'Serra Angel'), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const l = put(A, 'The Locust God'); dieOrLeave(l, 'gy'); await settle2(); const inGyNow = A.gy.includes(l); await runEndQueue(); await settle2();
              ok('The Locust God: returns to its owner\'s hand at the next end step after dying', inGyNow && A.hand.includes(l) && !A.gy.includes(l), [inGyNow, A.hand.length]); }
            { const [A, B] = await fresh(); const e = put(A, 'Electro, Assaulting Battery'); lands(A, 3); B.life = 2; leaveBattlefield(e, 'gy'); await settle2();
              ok('Electro: pays {X} when it leaves and deals X damage to a player', B.life <= 0 || G.over, [B.life, G.over]); }
            { const [A] = await fresh(); const w = put(A, 'Arwen, Weaver of Hope'); const b = inHand(A, 'Grizzly Bears'); putOntoBattlefield(A, b); await settle2();
              ok('Arwen, Weaver of Hope: another creature that enters gets +1/+1 counters equal to her toughness', b.counters === tou(w) && tou(w) > 0, [b.counters, tou(w)]); }
            { const [A, B] = await fresh(); put(A, 'Kazuul, Tyrant of the Cliffs'); const x = put(B, 'Grizzly Bears'); fire('attacks', { list: [x] }); await settle2(); const ogres = A.bf.filter(o => o.token && /Ogre/.test(o.card.type)).length; lands(B, 3); fire('attacks', { list: [x] }); await settle2();
              ok('Kazuul: an attacker\'s controller makes you a 3/3 Ogre unless they pay {3}', ogres === 1 && A.bf.filter(o => o.token && /Ogre/.test(o.card.type)).length === 1 && B.bf.filter(o => /Plains/.test(o.card.name) && o.tapped).length === 3, [ogres, A.bf.length]); }
            { const [A] = await fresh(); put(A, 'Inti, Seneschal of the Sun'); const c = makeObj(have('Island'), 0); const e0 = A.exile.length; fire('discarded', { P: A, o: c }); await settle2();
              ok('Inti, Seneschal of the Sun: exile the top card when you discard; you may play it', A.exile.length === e0 + 1 && A.exile[A.exile.length - 1].playUntil >= G.turn, [A.exile.length]); }
            { const [A, B] = await fresh(); const v = inHand(A, 'Venser, Shaper Savant'); const g = put(B, 'Hill Giant'); putOntoBattlefield(A, v); await settle2();
              ok('Venser, Shaper Savant: returns target permanent to its owner\'s hand when it enters', !onBf(g.uid) && B.hand.includes(g), [B.hand.length]); }
            { const [A, B] = await fresh(); put(A, 'Grazilaxx, Illithid Scholar'); const x = put(A, 'Grizzly Bears'); const y = put(B, 'Hill Giant'); G.blocks = { [x.uid]: [y.uid] }; fire('blocked', { o: x }); await settle2();
              ok('Grazilaxx: a creature of yours that becomes blocked may return to hand (the computer does when it would die)', !onBf(x.uid) && A.hand.includes(x), A.hand.length); }
            { const [A] = await fresh(); const h = put(A, 'Halana and Alena, Partners'); const b = put(A, 'Grizzly Bears'); fire('combat'); await settle2();
              ok('Halana and Alena: X +1/+1 counters and haste on another creature at the beginning of combat', b.counters === pow(h) - 0 + 0 && b.counters > 0 && has(b, 'haste'), [b.counters, pow(h)]); }
            { const [A] = await fresh(); put(A, 'Xenagos, God of Revels'); const b = put(A, 'Grizzly Bears'); fire('combat'); await settle2();
              ok('Xenagos, God of Revels: another creature gains haste and +X/+X where X is its power', pow(b) === 4 && has(b, 'haste'), [pow(b)]); }
            { const [A, B] = await fresh(); const s = put(A, 'Selvala, Explorer Returned'); s.sick = false; inLib(A, 'Hill Giant'); A.pool = []; const l0 = A.life, h0 = A.hand.length, hb = B.hand.length; await activate(A, s, acts(s)[0]); await settle2();
              ok('Selvala, Explorer Returned: {G} and 1 life for each nonland revealed, then everyone draws', A.pool.filter(c => c === 'G').length === 1 && A.life === l0 + 1 && A.hand.length === h0 + 1 && B.hand.length === hb + 1, [A.pool, A.life, A.hand.length - h0, B.hand.length - hb]); }
            { const [A] = await fresh(); const k = put(A, 'Klauth, Unrivaled Ancient'); const b = put(A, 'Grizzly Bears'); G.attackers = [k.uid, b.uid]; A.pool = []; fire('attacks', { list: [k, b] }); await settle2();
              ok('Klauth: adds mana equal to the total power of attacking creatures, kept until end of turn', A.pool.length === pow(k) + pow(b) && A.keepPoolTurn === G.turn, [A.pool.length, pow(k), pow(b)]); }
            { const [A] = await fresh(); const i = put(A, 'Ioreth of the Healing House'); i.sick = false; const a = put(A, 'Alesha, Who Laughs at Fate'), b = put(A, 'Ureni of the Unwritten'); a.tapped = true; b.tapped = true; await activate(A, i, acts(i).find(x => /legendary/.test(x.text))); await settle2();
              ok('Ioreth: untaps two other legendary creatures', !a.tapped && !b.tapped, [a.tapped, b.tapped]); }
            { const [A] = await fresh(); const o = put(A, 'God-Eternal Oketra'); dieOrLeave(o, 'gy'); await settle2(); const L = A.library;
              ok('God-Eternal Oketra: when it dies it goes into its owner\'s library third from the top', L[L.length - 3] === o && !A.gy.includes(o), [L.indexOf(o), L.length]); }
            { const [A] = await fresh(); inLib(A, 'Shivan Dragon'); const u = inHand(A, 'Ureni of the Unwritten'); putOntoBattlefield(A, u); await settle2();
              ok('Ureni of the Unwritten: puts a Dragon from the top eight cards onto the battlefield when it enters', A.bf.some(x => x.card.name === 'Shivan Dragon'), A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); put(A, 'The Lord of Pain'); const sp = inHand(B, 'Serra Angel'); fire('cast', { P: B, o: sp }); await settle2(); const l1 = A.life; const sp2 = inHand(B, 'Serra Angel'); fire('cast', { P: B, o: sp2 }); await settle2();
              ok('The Lord of Pain: damage equal to the mana value of a player\'s first spell each turn (only the first)', l1 === 15 && A.life === 15, [l1, A.life]); }
            { const [A] = await fresh(); const k = put(A, 'Kona, Rescue Beastie'); k.tapped = true; inHand(A, 'Hill Giant'); inHand(A, 'Shock'); G.active = 0; fire('main2'); await settle2();
              ok('Kona, Rescue Beastie: if tapped at the second main phase, put a permanent card from your hand onto the battlefield', A.bf.some(x => x.card.name === 'Hill Giant') && A.hand.some(x => x.card.name === 'Shock'), A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); put(A, 'Neheb, the Eternal'); B.lostTurn = G.turn; B.lostN = 3; A.pool = []; fire('main2'); await settle2();
              ok('Neheb, the Eternal: adds {R} for each life your opponents lost this turn at the second main phase', A.pool.filter(c => c === 'R').length === 3, A.pool); }
            { const [A, B] = await fresh(); const r = put(A, 'Rev, Tithe Extractor'); const n0 = B.library.length; hit(r, [B], 2); await settle2();
              ok('Rev, Tithe Extractor: a Treasure, and the top card of that library is exiled for you to cast', A.bf.some(x => /Treasure/.test(x.card.type)) && B.library.length === n0 - 1 && A.exile.some(x => x.playUntil > G.turn), [B.library.length, A.exile.length]); }
            { const [A] = await fresh(); const s = put(A, 'Sovereign Okinec Ahau'); const b = put(A, 'Grizzly Bears'); b.counters = 2; fire('attacks', { list: [s] }); await settle2();
              ok('Sovereign Okinec Ahau: +1/+1 counters equal to each creature\'s power above its base', b.counters === 4, b.counters); }
            { const [A] = await fresh(); put(A, 'Ratadrabik of Urborg'); const l = put(A, 'Alesha, Who Laughs at Fate'); dieOrLeave(l, 'gy'); await settle2(); const t = A.bf.find(x => x.token && x.card.name === 'Alesha, Who Laughs at Fate');
              ok('Ratadrabik of Urborg: a nonlegendary 2/2 black Zombie token copy of another legendary creature that dies', !!t && !/Legendary/.test(t.card.type) && /Zombie/.test(t.card.type) && pow(t) === 2, t && [t.card.type, pow(t)]); }
            { const [A] = await fresh(); const z = put(A, 'Zur the Enchanter'); inLib(A, 'Rhystic Study'); fire('attacks', { list: [z] }); await settle2();
              ok('Zur the Enchanter: searches for an enchantment with mana value 3 or less when it attacks', A.bf.some(x => x.card.name === 'Rhystic Study'), A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); inHand(A, 'Lightning Bolt'); inHand(B, 'Hill Giant'); const k = inHand(A, 'Kefka, Court Mage'); const h0 = A.hand.length - 1; A.hand.splice(A.hand.indexOf(k), 1); putOntoBattlefield(A, k); await settle2();
              ok('Kefka, Court Mage: each player discards, then you draw a card for each card type discarded', A.gy.length === 1 && B.gy.length === 1 && A.hand.length === h0 - 1 + 2, [A.gy.length, B.gy.length, A.hand.length, h0]); }
            { const [A] = await fresh(); const o = put(A, 'Oswald Fiddlebender'); o.sick = false; lands(A, 1); put(A, 'Sol Ring'); inLib(A, 'Mind Stone'); await activate(A, o, acts(o)[0]); await settle2();
              ok('Oswald Fiddlebender: sacrifice an artifact to fetch one with mana value 1 higher', A.bf.some(x => x.card.name === 'Mind Stone') && !A.bf.some(x => x.card.name === 'Sol Ring'), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const o = put(A, 'Otharri, Suns\' Glory'); G.attackers = [o.uid]; fire('attacks', { list: [o] }); await settle2(); const a = A.bf.filter(x => /Rebel/.test(x.card.type)).length; G.attackers = [o.uid]; fire('attacks', { list: [o] }); await settle2();
              ok('Otharri: an experience counter, then a tapped and attacking Rebel for each counter', A.exp === 2 && a === 1 && A.bf.filter(x => /Rebel/.test(x.card.type)).length === 3, [A.exp, a]); }
            { const [A, B] = await fresh(); const k = put(A, 'Ink-Eyes, Servant of Oni'); const g = makeObj(have('Hill Giant'), 1); B.gy.push(g); hit(k, [B]); await settle2();
              ok('Ink-Eyes: put a creature card from the damaged player\'s graveyard onto the battlefield under your control', A.bf.some(x => x.uid === g.uid) && !B.gy.includes(g), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); inLib(A, 'Furnace Whelp'); inLib(A, 'Shivan Dragon'); const t = inHand(A, 'Tiamat'); A.hand.splice(A.hand.indexOf(t), 1); putOntoBattlefield(A, t); t.castFromHand = G.turn; await settle2();
              ok('Tiamat: when cast, fetches up to five Dragon cards with different names', A.hand.some(x => x.card.name === 'Furnace Whelp') && A.hand.some(x => x.card.name === 'Shivan Dragon'), A.hand.map(x => x.card.name)); }
            { const [A, B] = await fresh(); const h = put(A, 'Heartless Hidetsugu'); h.sick = false; B.life = 11; A.life = 20; await activate(A, h, acts(h)[0]); await settle2();
              ok('Heartless Hidetsugu: damage to each player equal to half their life, rounded down', A.life === 10 && B.life === 6, [A.life, B.life]); }
            { const [A, B] = await fresh(); const m = put(A, 'Malcolm, Keen-Eyed Navigator'); hit(m, [B]); await settle2();
              ok('Malcolm, Keen-Eyed Navigator: a Treasure when a Pirate you control damages an opponent', A.bf.filter(x => /Treasure/.test(x.card.type)).length === 1, A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); put(A, 'Fandaniel, Telophoroi Ascian'); inGy(A, 'Shock'); inGy(A, 'Lightning Bolt'); fire('end'); await settle2();
              ok('Fandaniel: an opponent with no creature to sacrifice loses 2 life for each instant and sorcery in your graveyard', B.life === 16, B.life); }
            { const [A] = await fresh(); put(A, 'Rakdos, Patron of Chaos'); const h0 = A.hand.length; fire('end'); await settle2();
              ok('Rakdos, Patron of Chaos: you draw two if the opponent doesn\'t sacrifice two permanents', A.hand.length === h0 + 2, A.hand.length - h0); }
            { const [A] = await fresh(); A.speed = 4; put(A, 'Mendicant Core, Guidelight'); lands(A, 3); const sr = inHand(A, 'Sol Ring'); await castSpell(A, sr); await settle2(); await settle2(); await settle2();
              ok('Mendicant Core: pay {1} when you cast an artifact spell to copy it', A.bf.filter(x => x.card.name === 'Sol Ring').length === 2, A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Lathiel, the Bounteous Dawn'); const b = put(A, 'Grizzly Bears'); fire('gainLife', { P: A, n: 4 }); fire('end'); await settle2();
              ok('Lathiel: distributes +1/+1 counters equal to the life you gained at the end step', b.counters === 4, b.counters); }
            { const [A] = await fresh(); inHand(A, 'Island'); const c = inHand(A, 'Clive, Ifrit\'s Dominant'); A.hand.splice(A.hand.indexOf(c), 1); const d = devotion(A, ['R']); putOntoBattlefield(A, c); await settle2(); const dev = devotion(A, ['R']);
              ok('Clive, Ifrit\'s Dominant: may discard your hand, then draw cards equal to your devotion to red', A.gy.length === 1 && A.hand.length === dev, [A.gy.length, A.hand.length, dev, d]); }
            { const [A, B] = await fresh(); put(A, 'Ashling, Flame Dancer'); const g = put(B, 'Hill Giant'); for (let i = 0; i < 4; i++) inHand(A, 'Island'); const sp = inHand(A, 'Shock'); A.pool = [];
              fire('cast', { P: A, o: sp }); await settle2(); const a = B.life; fire('cast', { P: A, o: sp }); await settle2(); const b = B.life; fire('cast', { P: A, o: sp }); await settle2();
              ok('Ashling, Flame Dancer: loot each time; the second also deals 2 to each opponent and their creatures; the third adds {R}{R}{R}{R}', a === 20 && b === 18 && g.dmg === 2 && A.pool.filter(c => c === 'R').length === 4, [a, b, g.dmg, A.pool]); }
            { const [A, B] = await fresh(); const m = put(A, 'Malcolm, Alluring Scoundrel'); inHand(A, 'Island'); const h0 = A.hand.length; hit(m, [B]); await settle2();
              ok('Malcolm, Alluring Scoundrel: a chorus counter, then draw a card and discard a card', m.ctr.chorus === 1 && A.hand.length === h0 && A.gy.length === 1, [m.ctr, A.hand.length - h0]); }
            { const [A, B] = await fresh(); const p = put(A, 'Phelia, Exuberant Shepherd'); const g = put(B, 'Hill Giant'); fire('attacks', { list: [p] }); await settle2(); const gone = !onBf(g.uid) && B.exile.includes(g); await runEndQueue(); await settle2();
              ok('Phelia, Exuberant Shepherd: exiles a permanent when it attacks and returns it at the end step', gone && onBf(g.uid) && p.counters === 0, [gone, onBf(g.uid), p.counters]); }
            { const [A] = await fresh(); const j = put(A, 'Jaxis, the Troublemaker'); j.sick = false; lands(A, 1, 'Mountain'); const b = put(A, 'Grizzly Bears'); inHand(A, 'Island'); await activate(A, j, acts(j)[0]); await settle2(); const t = A.bf.find(x => x.token && x.card.name === 'Grizzly Bears'); const had = !!t && has(t, 'haste'); await runEndQueue(); await settle2();
              ok('Jaxis, the Troublemaker: a hasty token copy of another creature, sacrificed at the end step', had && !onBf(t.uid), [had]); }
            { const [A, B] = await fresh(); put(A, 'Tergrid, God of Fright'); const g = put(B, 'Hill Giant'); sacPerm(B, g); await settle2(); const a = A.bf.some(x => x.uid === g.uid); const h = inHand(B, 'Serra Angel'); pull(B.hand, h); B.gy.push(h); h.discardTurn = G.turn; fire('discarded', { P: B, o: h }); await settle2();
              ok('Tergrid: takes a nontoken permanent an opponent sacrifices or a permanent card they discard', a && A.bf.some(x => x.uid === h.uid), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Titania, Protector of Argoth'); const f = put(A, 'Forest'); leaveBattlefield(f, 'gy'); await settle2(); const e = A.bf.find(x => /Elemental/.test(x.card.type));
              ok('Titania, Protector of Argoth: a 5/3 Elemental when a land you control goes to the graveyard', !!e && pow(e) === 5 && tou(e) === 3, e && [pow(e), tou(e)]); }
            { const [A] = await fresh(); const s = put(A, 'Shalai, Voice of Plenty'); const b = put(A, 'Grizzly Bears'); ok('Shalai, Voice of Plenty: other creatures you control have hexproof (creatures only here)', has(b, 'hexproof') && !has(s, 'hexproof'), [has(b, 'hexproof')]); }
            { const [A] = await fresh(); const f = put(A, 'Freyalise, Llanowar\'s Fury'); f.ctr.loyalty = 7; f.pwReady = true; put(A, 'Grizzly Bears'); put(A, 'Llanowar Elves'); put(A, 'Hill Giant'); const h0 = A.hand.length; const a = acts(f).find(x => /Draw a card for each green creature/.test(x.text)); await activate(A, f, a); await settle2();
              ok('Freyalise, Llanowar\'s Fury: -6 draws a card for each green creature you control', !!a && A.hand.length === h0 + 2, [!!a, A.hand.length - h0]); }
            { const [A] = await fresh(); const e = put(A, 'Emiel the Blessed'); e.sick = false; lands(A, 3); put(A, 'Wall of Omens'); await settle2(); const h0 = A.hand.length; const a = acts(e).find(x => /\{3\}: Exile/.test(x.text)); await activate(A, e, a); await settle2();
              ok('Emiel the Blessed: {3} exiles another creature you control and returns it (its enter ability triggers again)', !!a && A.hand.length === h0 + 1, [!!a, A.hand.length - h0]); }
            { const [A] = await fresh(); const u = put(A, 'The Unagi of Kyoshi Island'); ok('The Unagi of Kyoshi Island: ward (waterbend {4} counted as {4})', Rx(u).ward === 4, Rx(u).ward); }
            { const [A, B] = await fresh(); const g = put(A, 'Gríma, Saruman\'s Footman'); inLib(B, 'Lightning Bolt'); inLib(B, 'Island'); hit(g, [B]); await settle2();
              ok('Gríma, Saruman\'s Footman: exiles from the top until an instant or sorcery, which you cast free; the rest go to the bottom', (A.gy.some(x => x.card.name === 'Lightning Bolt') || B.life < 20 || B.gy.some(x => x.card.name === 'Lightning Bolt')) && !B.exile.some(x => x.card.name === 'Island'), [A.gy.length, B.life, B.exile.map(x => x.card.name)]); }
            { const [A, B] = await fresh(); const g = inHand(A, 'Gonti, Lord of Luxury'); A.hand.splice(A.hand.indexOf(g), 1); inLib(B, 'Shock'); putOntoBattlefield(A, g); await settle2();
              ok('Gonti, Lord of Luxury: exiles a nonland card from the top four of an opponent\'s library that you may cast', A.exile.some(x => x.card.name === 'Shock' && x.playUntil > G.turn), A.exile.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Nissa, Resurgent Animist'); inLib(A, 'Llanowar Elves'); A.pool = []; const f1 = inHand(A, 'Forest'); A.hand.splice(A.hand.indexOf(f1), 1); putOntoBattlefield(A, f1); await settle2(); const a = A.pool.length; const f2 = inHand(A, 'Forest'); A.hand.splice(A.hand.indexOf(f2), 1); putOntoBattlefield(A, f2); await settle2();
              ok('Nissa, Resurgent Animist: mana on each land; the second time also reveals to an Elf or Elemental', a === 1 && A.pool.length === 2 && A.hand.some(x => x.card.name === 'Llanowar Elves'), [a, A.pool.length, A.hand.map(x => x.card.name)]); }
            { const [A] = await fresh(); const v = put(A, 'Varragoth, Bloodsky Sire'); v.sick = false; lands(A, 2, 'Swamp'); A.library.unshift(makeObj(have('Serra Angel'), 0)); const a = acts(v).find(x => /\{1\}\{B\}: Target player searches/.test(x.text)); await activate(A, v, a); await settle2();
              ok('Varragoth: {1}{B} - a player searches their library and puts a card on top', !!a && A.library[A.library.length - 1].card.name === 'Serra Angel', [!!a, A.library[A.library.length - 1].card.name]); }
            { const [A] = await fresh(); const e = put(A, 'Eladamri, Korvecdal'); e.sick = false; lands(A, 1, 'Forest'); const b = put(A, 'Grizzly Bears'), c = put(A, 'Hill Giant'); b.sick = false; c.sick = false; inHand(A, 'Serra Angel'); await activate(A, e, acts(e).find(x => /Tap two untapped/.test(x.text))); await settle2();
              ok('Eladamri, Korvecdal: tap two creatures to put a creature card from your hand onto the battlefield', A.bf.some(x => x.card.name === 'Serra Angel') && b.tapped && c.tapped, [A.bf.map(x => x.card.name), b.tapped, c.tapped]); }
            { const [A] = await fresh(); const m = put(A, 'Mina and Denn, Wildborn'); lands(A, 1, 'Mountain'); lands(A, 1, 'Forest'); lands(A, 1, 'Forest'); const b = put(A, 'Grizzly Bears'); const l0 = A.hand.length; const a = acts(m).find(x => /Return a land/.test(x.text)); await activate(A, m, a); await settle2();
              ok('Mina and Denn: {R}{G}, return a land: target creature gains trample', !!a && A.bf.some(x => x.tkw.includes('trample')) && A.hand.length === l0 + 1, [!!a, A.bf.map(x => x.tkw), A.hand.length - l0]); }
            { const [A] = await fresh(); const b = put(A, 'Baird, Steward of Argive'); ok('Baird, Steward of Argive: creatures can\'t attack you unless their controller pays {1} each', Rx(b).attackTax === 1, Rx(b).attackTax); }
            { const [A, B] = await fresh(); G.active = 1; const d = put(B, 'Shivan Dragon'); d.sick = false; lands(B, 2, 'Mountain'); const act0 = acts(d)[0]; const before = canActivate(B, d, act0); put(A, 'Linvala, Keeper of Silence'); const after = canActivate(B, d, act0);
              ok('Linvala, Keeper of Silence: activated abilities of opponents\' creatures can\'t be activated', before === true && after === false, [before, after]); }
            { const [A, B] = await fresh(); const g = put(B, 'Hill Giant'); const mg = inHand(A, 'Massacre Girl'); A.hand.splice(A.hand.indexOf(mg), 1); const cub = put(B, 'Bear Cub'); putOntoBattlefield(A, mg); await settle2(); const a = pow(g); dieOrLeave(cub, 'gy'); await settle2();
              ok('Massacre Girl: each other creature gets -1/-1, then again whenever a creature dies this turn', a === 2 && pow(g) === 1 && onBf(mg.uid), [a, pow(g)]); }
            { const [A, B] = await fresh(); const br = put(A, 'Brago, King Eternal'); put(A, 'Wall of Omens'); await settle2(); const h0 = A.hand.length; hit(br, [B]); await settle2();
              ok('Brago, King Eternal: exiles and returns your nonland permanents (their enter abilities trigger again)', A.hand.length === h0 + 1, A.hand.length - h0); }
            { const [A, B] = await fresh(); const x = put(B, 'Serra Angel'); const e = inHand(A, 'Éowyn, Fearless Knight'); A.hand.splice(A.hand.indexOf(e), 1); putOntoBattlefield(A, e); await settle2();
              ok('Éowyn, Fearless Knight: exiles an opponent\'s creature with greater power; legendary creatures gain protection from its colors', !onBf(x.uid) && B.exile.includes(x) && e.tkw.includes('pro:W'), [B.exile.length, e.tkw]); }
            { const [A] = await fresh(); put(A, 'Iroas, God of Victory'); const b = put(A, 'Grizzly Bears'), c = put(A, 'Hill Giant'); G.attackers = [b.uid]; damage(b, 2, c); damage(c, 1, b); G.attackers = [];
              ok('Iroas, God of Victory: prevents all damage to your attacking creatures (not to others)', b.dmg === 0 && c.dmg === 1, [b.dmg, c.dmg]); }
            { const [A] = await fresh(); put(A, 'Lae\'zel, Vlaakith\'s Champion'); const b = put(A, 'Grizzly Bears'); const got = putCounters(b, 1, A); ok('Lae\'zel: +1/+1 counters you would put on a creature get one more (creatures only)', got === 2 && b.counters === 2, [got, b.counters]); }
            { const [A] = await fresh(); const s = makeObj(have('Squee, the Immortal'), 0); A.gy.push(s); lands(A, 5, 'Mountain'); ok('Squee, the Immortal: can be cast from your graveyard', canCastNow(A, s), [Rx(s).gyCast]); }
            { const [A] = await fresh(); put(A, 'Thalisse, Reverent Medium'); await applyEffect(A, { t: 'token', n: 2, p: 1, q: 1, name: 'white Soldier', kw: [] }, null, A.bf[0]); fire('end'); await settle2();
              ok('Thalisse, Reverent Medium: at each end step a 1/1 flying Spirit for each token you created this turn', A.bf.filter(x => /Spirit/.test(x.card.type)).length >= 2, A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); put(A, 'Gluntch, the Bestower'); const b = put(A, 'Grizzly Bears'); const hb = B.hand.length; fire('end'); await settle2();
              ok('Gluntch, the Bestower: counters for one player\'s creature, a card for another player (different players)', A.bf.reduce((a, x) => a + x.counters, 0) === 2 && B.hand.length === hb + 1, [A.bf.map(x => x.counters), B.hand.length - hb]); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300b', results, []);
    writeOut('cmdr300b', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
