// Commander round 4, batch j (2026-10-26): behavior checks for rules/cmdr300j.js and 15-cmdr300j.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300j_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300j_names.json'), 'utf8'));
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
            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };
            const castEv = (P, o) => { o.castFromHand = G.turn; fire('cast', { o, P }); };
            const atk = async o => { G.attackers = [o.uid]; fire('attacks', { list: [o] }); await settle2(); };
            const nm = (P, n) => P.bf.filter(x => x.card.name === n);
            // Nicol Bolas
            { const [A, B] = await fresh(); const b = put(A, 'Nicol Bolas'); inHand(B, 'Hill Giant'); inHand(B, 'Shock'); hit(b, [B]); await settle2();
              ok('Nicol Bolas: the damaged opponent discards their hand', B.hand.length === 0 && B.gy.length >= 2, [B.hand.length, B.gy.length]); }
            { const [A, B] = await fresh(); const b = put(A, 'Nicol Bolas'); const g = put(A, 'Grizzly Bears'); inHand(B, 'Hill Giant'); hit(g, [B]); await settle2();
              ok('Nicol Bolas: only damage dealt by Bolas himself matters', B.hand.length === 1, B.hand.length); }
            // Laurine
            { const [A, B] = await fresh(); const l = put(A, 'Laurine, the Diversion'); lands(A, 2); const fod = put(A, 'Grizzly Bears'); const bg = put(B, 'Hill Giant'); await activate(A, l, acts(l)[0]); await settle2();
              ok('Laurine, the Diversion: {2} and sacrificing an artifact or creature goads a creature', (!onBf(fod.uid) || !onBf(l.uid)) && isGoaded(bg), [onBf(fod.uid) ? 'bears alive' : 'bears gone', onBf(l.uid) ? 'laurine alive' : 'laurine gone', isGoaded(bg)]); }
            // Caparocti
            { const [A] = await fresh(); const c = put(A, 'Caparocti Sunborn'); const x = put(A, 'Grizzly Bears'); const y = put(A, 'Hill Giant'); x.tapped = false; y.tapped = false; inLib(A, 'Llanowar Elves'); await atk(c); await settle2();
              ok('Caparocti Sunborn: taps two untapped permanents and discovers 3', x.tapped && y.tapped, [x.tapped, y.tapped, A.hand.map(z => z.card.name), A.bf.map(z => z.card.name)]); }
            { const [A] = await fresh(); const c = put(A, 'Caparocti Sunborn'); const x = put(A, 'Grizzly Bears'); x.tapped = false; await atk(c);
              ok('Caparocti Sunborn: needs two untapped artifacts or creatures', !x.tapped, x.tapped); }
            // Urza, Powerstone Prodigy
            { const [A] = await fresh(); put(A, 'Urza, Powerstone Prodigy'); const a1 = makeObj(have('Sol Ring'), 0), a2 = makeObj(have('Sol Ring'), 0); fire('discarded', { P: A, o: a1 }); fire('discarded', { P: A, o: a2 }); await settle2(); const ps = nm(A, 'Powerstone');
              ok('Urza, Powerstone Prodigy: one tapped Powerstone for artifact discards, once each turn', ps.length === 1 && ps[0].tapped, [ps.length, ps[0] && ps[0].tapped]); }
            { const [A] = await fresh(); put(A, 'Urza, Powerstone Prodigy'); fire('discarded', { P: A, o: makeObj(have('Hill Giant'), 0) }); await settle2();
              ok('Urza, Powerstone Prodigy: nothing for a nonartifact discard', nm(A, 'Powerstone').length === 0, nm(A, 'Powerstone').length); }
            // Tesak
            { const [A] = await fresh(); put(A, 'Tesak, Judith\'s Hellhound'); const c = put(A, 'Grizzly Bears'); const d = put(A, 'Hill Giant'); c.sick = true; d.sick = true; c.counters = 1;
              ok('Tesak, Judith\'s Hellhound: creatures with counters have haste (others do not)', has(c, 'haste') && !has(d, 'haste'), [has(c, 'haste'), has(d, 'haste')]); }
            // Atris
            { const [A, B] = await fresh(); A.library.length = 0; inLib(A, 'Island'); inLib(A, 'Island'); inLib(A, 'Shivan Dragon'); const o = inHand(A, 'Atris, Oracle of Half-Truths'); const h0 = A.hand.length; putOntoBattlefield(A, o); await settle2();
              ok('Atris, Oracle of Half-Truths: one pile goes to hand and the other to the graveyard', A.gy.length + (A.hand.length - (h0 - 1)) === 3 && A.hand.length > h0 - 1 && A.gy.length > 0, [A.hand.length - h0 + 1, A.gy.length]); }
            // Geist of Saint Traft
            { const [A, B] = await fresh(); const g = put(A, 'Geist of Saint Traft'); await atk(g); const an = nm(A, 'Angel')[0];
              ok('Geist of Saint Traft: a 4/4 flying Angel enters tapped and attacking', !!an && pow(an) === 4 && has(an, 'flying') && an.tapped && G.attackers.includes(an.uid), [!!an, an && pow(an)]);
              if (an) { allPerms().filter(x => x.sacEndCombat).forEach(x => dieOrLeave(x, 'gy')); await settle2(); } ok('Geist of Saint Traft: the Angel is gone at end of combat', !nm(A, 'Angel').length, nm(A, 'Angel').length); }
            // Kydele
            { const [A] = await fresh(); const k = put(A, 'Kydele, Chosen of Kruphix'); drawCards(A, 2); await activate(A, k, acts(k)[0]); await settle2();
              ok('Kydele, Chosen of Kruphix: adds {C} for each card drawn this turn', (A.pool || []).filter(x => x === 'C').length === 2, A.pool); }
            // Shadowfax
            { const [A] = await fresh(); const s = put(A, 'Shadowfax, Lord of Horses'); const bear = inHand(A, 'Grizzly Bears'); const big = inHand(A, 'Shivan Dragon'); await atk(s);
              ok('Shadowfax, Lord of Horses: a creature with lesser power enters tapped and attacking', A.bf.includes(bear) && bear.tapped && G.attackers.includes(bear.uid) && !A.bf.includes(big), [A.bf.map(x => x.card.name)]); }
            // Rosnakht
            { const [A, B] = await fresh(); const r = put(A, 'Rosnakht, Heir of Rohgahh'); fire('cast', { o: makeObj(have('Giant Growth'), 0), P: A, target: { o: r } }); await settle2();
              ok('Rosnakht, Heir of Rohgahh: casting a spell that targets it makes a 0/1 Kobold', A.bf.filter(x => x.token).length === 1, A.bf.map(x => x.card.name)); }
            // Sally Pride
            { const [A] = await fresh(); put(A, 'Grizzly Bears'); put(A, 'Hill Giant'); syn(A, 'Ornithopter', 'Token Artifact Creature — Thopter', {}, { token: true }); const s = inHand(A, 'Sally Pride, Lioness Leader'); putOntoBattlefield(A, s); await settle2();
              ok('Sally Pride: makes X 2/2 Mutants, X = nontoken creatures (itself included)', A.bf.filter(x => x.token && pow(x) === 2).length === 3, A.bf.filter(x => x.token).map(x => x.card.name + pow(x))); }
            // Jirina
            { const [A] = await fresh(); A.tax = 2; const j = inHand(A, 'Jirina Kudro'); putOntoBattlefield(A, j); await settle2();
              ok('Jirina Kudro: a 1/1 Human Soldier for each commander cast from the command zone', A.bf.filter(x => x.token).length === 2, A.bf.filter(x => x.token).length); }
            // Gregor
            { const [A, B] = await fresh(); const g = put(A, 'Gregor, Shrewd Magistrate'); const h0 = A.hand.length; A.library.push(...Array(5).fill(0).map(() => makeObj(have('Island'), 0))); hit(g, [B]); await settle2();
              ok('Gregor, Shrewd Magistrate: draws cards equal to its power on combat damage to a player', A.hand.length - h0 === pow(g), [A.hand.length - h0, pow(g)]); }
            // Jet
            { const [A] = await fresh(); const j = put(A, 'Jet, Rebel Leader'); const c = inLib(A, 'Grizzly Bears'); inLib(A, 'Shivan Dragon'); await atk(j);
              ok('Jet, Rebel Leader: a creature with mana value 3 or less enters tapped and attacking', A.bf.includes(c) && c.tapped && G.attackers.includes(c.uid), [A.bf.map(x => x.card.name)]); }
            // Oyobi
            { const [A] = await fresh(); put(A, 'Oyobi, Who Split the Heavens'); castEv(A, synHand(A, 'Divination', 'Sorcery — Arcane')); castEv(A, inHand(A, 'Divination')); await settle2(); const t = A.bf.filter(x => x.token);
              ok('Oyobi, Who Split the Heavens: Spirit or Arcane spells make 3/3 flying Spirits (others do not)', t.length === 1 && pow(t[0]) === 3 && has(t[0], 'flying'), t.length); }
            // Ryan Sinclair
            { const [A] = await fresh(); const r = put(A, 'Ryan Sinclair'); inLib(A, 'Hill Giant'); const bolt = inLib(A, 'Lightning Bolt'); inLib(A, 'Island'); const B = G.players[1]; await atk(r);
              ok('Ryan Sinclair: exiles until a nonland card and casts it free if its mana value is low enough', B.life < 20 && !A.library.includes(bolt), [B.life, A.exile.map(x => x.card.name)]); }
            // First Doctor
            { const [A] = await fresh(); put(A, 'The First Doctor'); const bear = put(A, 'Grizzly Bears'); const spl = inHand(A, 'Divination'); Rx(spl).kw.add('cascade'); fire('cast', { o: spl, P: A }); await settle2();
              ok('The First Doctor: a spell with cascade puts a +1/+1 counter on an artifact or creature', A.bf.some(x => x.counters >= 1), A.bf.map(x => x.counters)); }
            // Psemilla
            { const [A] = await fresh(); put(A, 'Psemilla, Meletian Poet'); castEv(A, synHand(A, 'Rhystic Study', 'Enchantment')); castEv(A, synHand(A, 'Rhystic Study', 'Enchantment')); await settle2(); const n = nm(A, 'Nymph');
              ok('Psemilla, Meletian Poet: the first enchantment spell each turn makes a 2/2 Nymph', n.length === 1 && pow(n[0]) === 2, n.length); }
            // Rufus Shinra
            { const [A] = await fresh(); const r = put(A, 'Rufus Shinra'); await atk(r); await atk(r);
              ok('Rufus Shinra: creates Darkstar only if you control no creature named Darkstar', nm(A, 'Darkstar').length === 1, nm(A, 'Darkstar').length); }
            // Toshiro
            { const [A, B] = await fresh(); put(A, 'Toshiro Umezawa'); lands(A, 1, 'Mountain'); inGy(A, 'Lightning Bolt'); const v = put(B, 'Hill Giant'); dieOrLeave(v, 'gy'); await settle2();
              ok('Toshiro Umezawa: an opponent creature dying lets you cast an instant from your graveyard', B.life === 17 && !A.gy.some(x => x.card.name === 'Lightning Bolt'), [B.life, A.gy.map(x => x.card.name)]); }
            // Nath
            { const [A, B] = await fresh(); put(A, 'Nath of the Gilt-Leaf'); inHand(B, 'Hill Giant'); fire('upkeep'); await settle2();
              ok('Nath of the Gilt-Leaf: at your upkeep target opponent discards a card at random', B.hand.length === 0 && B.gy.length === 1, [B.hand.length, B.gy.length]); }
            // Vargus
            { const [A] = await fresh(); A.tax = 2; const v = put(A, 'Captain Vargus Wrath'); const p = syn(A, 'Grizzly Bears', 'Creature — Pirate'); const o = put(A, 'Hill Giant'); const p0 = pow(p), o0 = pow(o); await atk(v);
              ok('Captain Vargus Wrath: Pirates get +1/+1 for each time a commander was cast from the command zone', pow(p) === p0 + 2 && pow(o) === o0, [pow(p) - p0, pow(o) - o0]); }
            // Jorn
            { const [A] = await fresh(); const j = put(A, 'Jorn, God of Winter'); const s = syn(A, 'Island', 'Basic Snow Land — Island'); s.tapped = true; const n = put(A, 'Island'); n.tapped = true; await atk(j);
              ok('Jorn, God of Winter: attacking untaps each snow permanent you control', !s.tapped && n.tapped, [s.tapped, n.tapped]); }
            // Ulasht
            { const [A] = await fresh(); syn(A, 'Goblin Guide', 'Creature — Goblin', { colors: ['R'] }); syn(A, 'Llanowar Elves', 'Creature — Elf', { colors: ['G'] }); syn(A, 'Hill Giant', 'Creature — Giant', { colors: ['R', 'G'] }); const u = inHand(A, 'Ulasht, the Hate Seed'); await castFreeFrom(A, u); await settle2();
              ok('Ulasht, the Hate Seed: enters with a counter for each other red creature and each other green creature', u.counters === 4, u.counters); }
            // Sami
            { const [A] = await fresh(); put(A, 'Sami, Ship\'s Engineer'); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); a.tapped = true; b.tapped = true; fire('end'); await settle2(); const r = nm(A, 'Robot');
              ok('Sami, Ship\'s Engineer: with two or more tapped creatures, a tapped 2/2 Robot appears at the end step', r.length === 1 && r[0].tapped && pow(r[0]) === 2, r.length); }
            { const [A] = await fresh(); put(A, 'Sami, Ship\'s Engineer'); fire('end'); await settle2();
              ok('Sami, Ship\'s Engineer: no Robot without two tapped creatures', nm(A, 'Robot').length === 0, nm(A, 'Robot').length); }
            // Mai
            { const [A] = await fresh(); const m = put(A, 'Mai, Jaded Edge'); lands(A, 3, 'Mountain'); await activate(A, m, acts(m)[0]); await settle2();
              ok('Mai, Jaded Edge: {3} puts a double strike counter on it, giving double strike', has(m, 'double strike'), m.ctr); }
            // Rhino
            { const [A] = await fresh(); const r = put(A, 'Rhino, Barreling Brute'); castEv(A, inHand(A, 'Shivan Dragon')); const h0 = A.hand.length; await atk(r);
              ok('Rhino, Barreling Brute: draws on attack after casting a spell with mana value 4 or greater', A.hand.length === h0 + 1, [h0, A.hand.length]); }
            { const [A] = await fresh(); const r = put(A, 'Rhino, Barreling Brute'); castEv(A, inHand(A, 'Shock')); const h0 = A.hand.length; await atk(r);
              ok('Rhino, Barreling Brute: no card after only cheap spells', A.hand.length === h0, [h0, A.hand.length]); }
            // Karvanista
            { const [A] = await fresh(); const k = put(A, 'Karvanista, Loyal Lupari'); const h = syn(A, 'Grizzly Bears', 'Creature — Human'); const o = put(A, 'Hill Giant'); await atk(k);
              ok('Karvanista: a +1/+1 counter on each Human you control on attack', h.counters === 1 && o.counters === 0, [h.counters, o.counters]); }
            // Raff
            { const [A] = await fresh(); put(A, 'Raff, Weatherlight Stalwart'); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); castEv(A, inHand(A, 'Shock')); await settle2(); const tapped = A.bf.filter(x => x.tapped && x !== a && x !== b).length;
              ok('Raff, Weatherlight Stalwart: casting an instant lets you tap two creatures to draw', A.hand.length === h0 + 2 && A.bf.filter(x => x.tapped).length === 2, [h0, A.hand.length, A.bf.filter(x => x.tapped).length]); }
            // Bosco
            { const [A] = await fresh(); syn(A, 'Grizzly Bears', 'Legendary Creature — Bear'); syn(A, 'Hill Giant', 'Legendary Creature — Giant'); const b = inHand(A, 'Bosco, Just a Bear'); putOntoBattlefield(A, b); await settle2();
              ok('Bosco, Just a Bear: a Food for each legendary creature you control (itself included)', nm(A, 'Food').length === 3, nm(A, 'Food').length); }
            // Wilfred Mott
            { const [A] = await fresh(); const w = put(A, 'Wilfred Mott'); const bears = inLib(A, 'Grizzly Bears'); fire('upkeep'); await settle2();
              ok('Wilfred Mott: a time counter at upkeep and a cheap permanent from the top enters', (w.ctr.time || 0) === 1 && A.bf.includes(bears), [w.ctr, A.bf.map(x => x.card.name)]); }
            // Nikara
            { const [A] = await fresh(); put(A, 'Nikara, Lair Scavenger'); const c = put(A, 'Grizzly Bears'); c.counters = 1; const plain = put(A, 'Hill Giant'); const h0 = A.hand.length; dieOrLeave(c, 'gy'); await settle2(); const a = A.hand.length; dieOrLeave(plain, 'gy'); await settle2();
              ok('Nikara, Lair Scavenger: a creature with counters leaving draws a card and costs 1 life (plain ones do not)', a === h0 + 1 && A.hand.length === a && A.life === 19, [h0, a, A.hand.length, A.life]); }
            // Thorin
            { const [A, B] = await fresh(); put(A, 'Thorin, Company\'s Leader'); const d = syn(A, 'Grizzly Bears', 'Creature — Dwarf'); const o = put(A, 'Hill Giant'); hit(o, [B]); await settle2(); const n0 = nm(A, 'Treasure').length; hit(d, [B]); await settle2();
              ok('Thorin, Company\'s Leader: a Dwarf that hits a player makes two Treasures (other creatures do not)', n0 === 0 && nm(A, 'Treasure').length === 2, [n0, nm(A, 'Treasure').length]); }
            // Rulik Mons
            { const [A] = await fresh(); const r = put(A, 'Rulik Mons, Warren Chief'); const land = inLib(A, 'Forest'); await atk(r);
              ok('Rulik Mons, Warren Chief: a land from the top enters tapped', A.bf.includes(land) && land.tapped && !A.bf.some(x => x.token), [A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const r = put(A, 'Rulik Mons, Warren Chief'); inLib(A, 'Hill Giant'); await atk(r);
              ok('Rulik Mons, Warren Chief: otherwise a 1/1 red Goblin', A.bf.filter(x => x.token).length === 1, A.bf.map(x => x.card.name)); }
            // The Thing
            { const [A, B] = await fresh(); const t = put(A, 'The Thing, Ben Grimm'); const h = syn(A, 'Grizzly Bears', 'Creature — Human Hero'); const o = put(A, 'Hill Giant'); hit(o, [B]); await settle2(); const c0 = t.counters; hit(h, [B]); await settle2();
              ok('The Thing, Ben Grimm: two +1/+1 counters when a Hero you control damages a player', c0 === 0 && t.counters === 2, [c0, t.counters]); }
            // Torsten
            { const [A] = await fresh(); A.library.length = 0; for (let i = 0; i < 4; i++) inLib(A, 'Island'); const g = inLib(A, 'Grizzly Bears'); const dv = inLib(A, 'Divination'); inLib(A, 'Shock'); const t = inHand(A, 'Torsten, Founder of Benalia'); putOntoBattlefield(A, t); await settle2();
              ok('Torsten, Founder of Benalia: creature and land cards among the top seven go to hand, the rest to the bottom', A.hand.includes(g) && A.hand.filter(x => x.card.name === 'Island').length === 4 && !A.hand.includes(dv) && A.library.includes(dv), [A.hand.map(x => x.card.name), A.library.length]); }
            // Mishra
            { const [A] = await fresh(); put(A, 'Mishra, Excavation Prodigy'); fire('discarded', { P: A, o: makeObj(have('Sol Ring'), 0) }); fire('discarded', { P: A, o: makeObj(have('Sol Ring'), 0) }); await settle2();
              ok('Mishra, Excavation Prodigy: artifact discards add {R}{R} once each turn', (A.pool || []).filter(x => x === 'R').length === 2, A.pool); }
            // Muzzio
            { const [A] = await fresh(); const m = put(A, 'Muzzio, Visionary Architect'); syn(A, 'Sol Ring', 'Artifact', { cmc: 3 }); lands(A, 4, 'Island'); const sr = inLib(A, 'Sol Ring'); inLib(A, 'Island'); await activate(A, m, acts(m)[0]); await settle2();
              ok('Muzzio, Visionary Architect: look at the top X, an artifact card enters', A.bf.includes(sr), [A.bf.map(x => x.card.name)]); }
            // Eutropia
            { const [A] = await fresh(); const e = put(A, 'Eutropia the Twice-Favored'); const c = put(A, 'Grizzly Bears'); fire('enters', { o: syn(A, 'Rhystic Study', 'Enchantment') }); await settle2();
              ok('Eutropia the Twice-Favored: an enchantment entering puts a +1/+1 counter on a creature and gives it flying', A.bf.filter(isCreature).some(x => x.counters >= 1 && has(x, 'flying')), A.bf.map(x => x.counters)); }
            // Radagast
            { const [A] = await fresh(); put(A, 'Radagast, Wizard of Wilds'); const b = syn(A, 'Grizzly Bears', 'Creature — Bear'); const bd = syn(A, 'Hill Giant', 'Creature — Bird'); const g = put(A, 'Serra Angel');
              ok('Radagast, Wizard of Wilds: Beasts and Birds have ward 1 (a Bear does not)', buffsOn(bd).kw.includes('ward:1') && !buffsOn(g).kw.includes('ward:1'), [buffsOn(bd).kw, buffsOn(g).kw]); }
            // Arjun
            { const [A] = await fresh(); put(A, 'Arjun, the Shifting Flame'); inHand(A, 'Hill Giant'); inHand(A, 'Shock'); const h0 = A.hand.length; for (let i = 0; i < 3; i++) A.library.push(makeObj(have('Island'), 0)); castEv(A, inHand(A, 'Divination')); await settle2();
              ok('Arjun, the Shifting Flame: casting a spell puts your hand on the bottom and draws that many', A.hand.length === h0 + 1, [h0, A.hand.length]); }
            // Brigid
            { const [A, B] = await fresh(); const br = put(A, 'Brigid, Hero of Kinsbaile'); const at = put(B, 'Hill Giant'); const idle = put(B, 'Grizzly Bears'); G.attackers = [at.uid]; await activate(A, br, acts(br)[0]); await settle2();
              ok('Brigid, Hero of Kinsbaile: 2 damage to each attacking creature the player controls (not idle ones)', at.dmg === 2 && idle.dmg === 0, [at.dmg, idle.dmg]); }
            // Pol Jamaar
            { const [A] = await fresh(); syn(A, 'Grizzly Bears', 'Creature — Wizard'); syn(A, 'Hill Giant', 'Creature — Wizard'); const h0 = A.hand.length; A.library.push(...Array(5).fill(0).map(() => makeObj(have('Island'), 0))); const p = inHand(A, 'Pol Jamaar, Illusionist'); putOntoBattlefield(A, p); await settle2();
              ok('Pol Jamaar, Illusionist: draws a card for each creature of the chosen type', A.hand.length - h0 >= 2, A.hand.length - h0); }
            // Ashling
            { const [A, B] = await fresh(); const a = put(A, 'Ashling, the Extinguisher'); put(B, 'Grizzly Bears'); const big = put(B, 'Hill Giant'); hit(a, [B]); await settle2();
              ok('Ashling, the Extinguisher: the damaged player sacrifices a creature', B.bf.filter(isCreature).length === 1, B.bf.map(x => x.card.name)); }
            // Orah
            { const [A] = await fresh(); const o = syn(A, 'Hill Giant', 'Legendary Creature — Dwarf Cleric', { cmc: 4 }); const small = inGy(A, 'Grizzly Bears'); small.card = { ...small.card, type: 'Creature — Cleric', cmc: 2 }; const big = inGy(A, 'Shivan Dragon'); big.card = { ...big.card, type: 'Creature — Cleric', cmc: 6 };
              Object.defineProperty(o.card, 'name', { value: 'Orah, Skyclave Hierophant' }); put(A, 'Orah, Skyclave Hierophant'); const c = syn(A, 'Llanowar Elves', 'Creature — Cleric', { cmc: 3 }); dieOrLeave(c, 'gy'); await settle2();
              ok('Orah, Skyclave Hierophant: a dying Cleric returns a Cleric with lesser mana value', A.bf.includes(small) && !A.bf.includes(big), [A.bf.map(x => x.card.name)]); }
            // Vrestin
            { const [A] = await fresh(); put(A, 'Vrestin, Menoptra Leader'); const i = syn(A, 'Grizzly Bears', 'Creature — Insect'); const o = put(A, 'Hill Giant'); fire('attacks', { list: [i, o] }); await settle2();
              ok('Vrestin, Menoptra Leader: each attacking Insect gets a +1/+1 counter', i.counters === 1 && o.counters === 0, [i.counters, o.counters]); }
            // Kestia
            { const [A] = await fresh(); put(A, 'Kestia, the Cultivator'); const e = syn(A, 'Grizzly Bears', 'Enchantment Creature — Bear'); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); fire('attacks', { list: [e] }); await settle2();
              ok('Kestia, the Cultivator: an enchantment creature attacking draws a card', A.hand.length === h0 + 1, [h0, A.hand.length]); }
            { const [A] = await fresh(); put(A, 'Kestia, the Cultivator'); const o = put(A, 'Grizzly Bears'); const h0 = A.hand.length; fire('attacks', { list: [o] }); await settle2();
              ok('Kestia, the Cultivator: a plain attacker draws nothing', A.hand.length === h0, A.hand.length); }
            // Pia Nalaar
            { const [A] = await fresh(); const p = put(A, 'Pia Nalaar'); const art = syn(A, 'Ornithopter', 'Artifact Creature — Thopter'); lands(A, 2, 'Mountain'); await settle2(); const before = A.bf.reduce((s, x) => s + x.tp, 0); await activate(A, p, acts(p)[0]); await settle2();
              ok('Pia Nalaar: {1}{R} gives an artifact creature +1/+0 until end of turn', A.bf.reduce((s, x) => s + x.tp, 0) === before + 1 && A.bf.some(x => x.tp === 1 && /\bArtifact\b/.test(x.card.type)), [before, A.bf.map(x => x.tp)]); }
            // Shizuko
            { const [A, B] = await fresh(); put(A, 'Shizuko, Caller of Autumn'); fire('upkeep'); await settle2(); const a = (A.pool || []).filter(x => x === 'G').length; G.active = 1; fire('upkeep'); await settle2(); const b = (B.pool || []).filter(x => x === 'G').length;
              ok('Shizuko, Caller of Autumn: each player adds {G}{G}{G} at their own upkeep', a === 3 && b === 3, [a, b]); }
            // Vogar
            { const [A, B] = await fresh(); const v = put(A, 'Vogar, Necropolis Tyrant'); const x = put(B, 'Hill Giant'); dieOrLeave(x, 'gy'); await settle2(); const c1 = v.counters; G.active = 1; const y = put(A, 'Grizzly Bears'); dieOrLeave(y, 'gy'); await settle2();
              ok('Vogar, Necropolis Tyrant: another creature dying on your turn gives a +1/+1 counter (not on other turns)', c1 === 1 && v.counters === 1, [c1, v.counters]); }
            // Cait
            { const [A, B] = await fresh(); const c = put(A, 'Cait, Cage Brawler'); inHand(A, 'Island'); A.library.push(makeObj(have('Island'), 0)); B.library.push(makeObj(have('Hill Giant'), 1)); await atk(c);
              ok('Cait, Cage Brawler: both draw then discard; the highest discard (or a tie) gives it two +1/+1 counters', c.counters === 0 || c.counters === 2, c.counters); }
            // Edea
            { const [A, B] = await fresh(); put(A, 'Edea, Possessed Sorceress'); const s = put(B, 'Hill Giant'); s.realOwner = 1; s.owner = 0; B.bf.splice(B.bf.indexOf(s), 1); A.bf.push(s); const h0 = A.hand.length; A.library.push(makeObj(have('Island'), 0)); dieOrLeave(s, 'gy'); await settle2();
              ok('Edea, Possessed Sorceress: a creature you control but don\'t own returns to its owner and you draw', B.bf.some(x => x.card.name === 'Hill Giant') && A.hand.length === h0 + 1, [B.bf.map(x => x.card.name), A.hand.length - h0]); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300j', results, []);
    writeOut('cmdr300j', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
