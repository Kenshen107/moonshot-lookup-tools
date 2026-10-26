// 300 more commanders (2026-10-26): behavior checks for rules/cmdr300.js and 15k-cmdr300.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300_names.json'), 'utf8'));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Divination', 'Shock', 'Treasure Map', 'Giant Growth', 'Ancestral Recall', 'Dark Ritual', 'Goblin Guide', 'Shivan Dragon', 'Air Elemental', 'Wall of Omens', 'Bear Cub', 'Ornithopter', 'Black Lotus', 'Cultivate', 'Island', 'Terror', 'Doom Blade']);
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
            // (batches are added below this line)
            // ---- Batch 1 ----
            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [] }); };
            const sacrificeLog = [];
            { const [A, B] = await fresh(); const r = put(A, 'Ragavan, Nimble Pilferer'); B.library.length = 0; inLib(B, 'Island'); inLib(B, 'Shock'); const n0 = B.library.length; hit(r, [B]); await settle2();
              ok('Ragavan: a Treasure and the top card of that library may be cast this turn', A.bf.some(x => /Treasure/.test(x.card.type)) && B.library.length === n0 - 1 && A.exile.length === 1 && A.exile[0].playUntil === G.turn, [A.bf.map(x => x.card.name), A.exile.map(x => x.card.name)]); }
            { const [A, B] = await fresh(); put(A, 'Braids, Arisen Nightmare'); put(A, 'Grizzly Bears', { token: true }); put(B, 'Llanowar Elves', { token: true }); fire('end'); await settle2();
              ok('Braids: sacrifice a permanent; an opponent with a (cheap) creature sacrifices one too', !A.bf.some(x => x.token) && !B.bf.some(x => x.card.name === 'Llanowar Elves'), [A.bf.map(x => x.card.name), B.bf.map(x => x.card.name)]); }
            { const [A, B] = await fresh(); put(A, 'Braids, Arisen Nightmare'); put(A, 'Grizzly Bears', { token: true }); const h0 = A.hand.length; fire('end'); await settle2();
              ok('Braids: an opponent with nothing that shares a type loses 2 life and you draw', B.life === 18 && A.hand.length === h0 + 1, [B.life, A.hand.length - h0]); }
            { const [A] = await fresh(); put(A, 'Kutzil, Malamet Exemplar'); const b = put(A, 'Grizzly Bears'); const h0 = A.hand.length; fire('combatHitAny', { P: A, list: [b] }); await settle2(); const h1 = A.hand.length; b.counters = 1; fire('combatHitAny', { P: A, list: [b] }); await settle2();
              ok('Kutzil: draws only when a creature has more power than its base power', h1 === h0 && A.hand.length === h0 + 1, [h0, h1, A.hand.length]); }
            { const [A] = await fresh(); const m = put(A, 'Mondrak, Glory Dominus'); lands(A, 3); const a = put(A, 'Grizzly Bears'), b = put(A, 'Sol Ring'); await activate(A, m, acts(m)[0]); await settle2();
              ok('Mondrak: sacrifice two other artifacts and/or creatures for an indestructible counter', (m.ctr.indestructible || 0) === 1 && !onBf(a.uid) && !onBf(b.uid) && has(m, 'indestructible'), [m.ctr, A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const z = put(A, 'Zopandrel, Hunger Dominus'); lands(A, 2, 'Forest'); put(A, 'Grizzly Bears'); put(A, 'Hill Giant'); await activate(A, z, acts(z)[0]); await settle2();
              ok('Zopandrel: sacrifice two other creatures for an indestructible counter', (z.ctr.indestructible || 0) === 1 && A.bf.filter(isCreature).length === 1, [z.ctr, A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const u = put(A, 'Urza, Lord High Artificer'); lands(A, 5, 'Island'); A.library.length = 0; inLib(A, 'Plains'); await activate(A, u, acts(u).find(a => /\{5\}/.test(a.text))); await settle2();
              ok('Urza: exile the top card and play it this turn without paying', A.exile.length === 1 && A.exile[0].freeCast && A.exile[0].playUntil === G.turn, [A.exile.map(x => x.card.name)]); }
            { const [A] = await fresh(); const a = put(A, 'Aurelia, the Warleader'); const b = put(A, 'Grizzly Bears'); b.tapped = true; G.extraCombat = 0; fire('attacks', { list: [a] }); await settle2(); const n1 = G.extraCombat; fire('attacks', { list: [a] }); await settle2();
              ok('Aurelia: untaps your creatures and gives one extra combat, only the first time each turn', !b.tapped && n1 === 1 && G.extraCombat === 1, [b.tapped, n1, G.extraCombat]); }
            { const [A] = await fresh(); put(A, 'Karlach, Fury of Avernus'); const b = put(A, 'Grizzly Bears'); b.tapped = true; G.attackers = [b.uid]; G.extraCombat = 0; G.extraCombatOn = false; fire('attacks', { list: [b] }); await settle2();
              ok('Karlach: untaps attackers, first strike, an extra combat', !b.tapped && has(b, 'first strike') && G.extraCombat === 1, [b.tapped, G.extraCombat]); }
            { const [A] = await fresh(); put(A, 'Heliod, Sun-Crowned'); const b = put(A, 'Grizzly Bears'); fire('gainLife', { P: A, n: 2 }); await settle2(); ok('Heliod, Sun-Crowned: a +1/+1 counter when you gain life', A.bf.reduce((a, x) => a + x.counters, 0) === 1, A.bf.map(x => x.counters)); }
            { const [A] = await fresh(); const p = put(A, 'Anim Pakal, Thousandth Moon'); const b = put(A, 'Grizzly Bears'); fire('attacks', { list: [b] }); await settle2();
              ok('Anim Pakal: a counter on it and that many Gnomes, tapped and attacking', p.counters === 1 && A.bf.filter(x => /Gnome/.test(x.card.type)).length === 1, [p.counters, A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const n = put(A, 'Nezahal, Primal Tide'); for (let i = 0; i < 3; i++) inHand(A, 'Island'); await activate(A, n, acts(n).find(a => a.cost && a.cost.discard)); await settle2(); const gone = !onBf(n.uid) && A.exile.some(x => x.uid === n.uid); await runEndQueue(); await settle2();
              ok('Nezahal: exiled for three cards, back tapped at the end step', gone && onBf(n.uid) && n.tapped && A.hand.length >= 0, [gone, onBf(n.uid), A.hand.length]); }
            { const [A] = await fresh(); put(A, 'Vilis, Broker of Blood'); const h0 = A.hand.length; fire('loseLife', { P: A, n: 3 }); await settle2(); ok('Vilis: draw that many cards when you lose life', A.hand.length === h0 + 3, A.hand.length - h0); }
            { const [A, B] = await fresh(); const k = put(A, 'Koma, World-Eater'); hit(k, [B], 7); await settle2(); ok('Koma: four 3/3 Serpents named Koma\'s Coil', A.bf.filter(x => x.card.name === "Koma's Coil" && pow(x) === 3).length === 4, A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const e = put(A, 'Elenda, the Dusk Rose'); e.counters = 2; const p = pow(e); dieOrLeave(e, 'gy'); await settle2(); ok('Elenda: X 1/1 lifelink Vampires where X is its power', A.bf.filter(x => /Vampire/.test(x.card.type)).length === p && p >= 3, [p, A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); put(A, 'Mahadi, Emporium Master'); const x = put(A, 'Grizzly Bears'), y = put(A, 'Hill Giant'); dieOrLeave(x, 'gy'); dieOrLeave(y, 'gy'); await settle2(); fire('end'); await settle2();
              ok('Mahadi: a Treasure for each creature that died this turn', A.bf.filter(z => /Treasure/.test(z.card.type)).length === 2, A.bf.map(z => z.card.name)); }
            { const [A] = await fresh(); put(A, 'Atarka, World Render'); const d = put(A, 'Shivan Dragon'); const b = put(A, 'Grizzly Bears'); fire('attacks', { list: [d, b] }); await settle2(); ok('Atarka: an attacking Dragon gains double strike (not other creatures)', has(d, 'double strike') && !has(b, 'double strike'), [d.tkw, b.tkw]); }
            { const [A] = await fresh(); put(A, 'Miirym, Sentinel Wyrm'); const d = inHand(A, 'Shivan Dragon'); putOntoBattlefield(A, d); await settle2(); ok('Miirym: a token copy of another nontoken Dragon that enters', A.bf.filter(x => x.card.name === 'Shivan Dragon').length === 2 && A.bf.some(x => x.token && x.card.name === 'Shivan Dragon'), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Ganax, Astral Hunter'); const d = inHand(A, 'Shivan Dragon'); putOntoBattlefield(A, d); await settle2(); ok('Ganax: a Treasure when a Dragon enters', A.bf.some(x => /Treasure/.test(x.card.type)), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const j = put(A, 'Juri, Master of the Revue'); const t = put(A, 'Grizzly Bears', { token: true }); fire('sacrificed', { o: t }); await settle2(); ok('Juri: a +1/+1 counter whenever you sacrifice a permanent', j.counters === 1, j.counters); }
            { const [A] = await fresh(); put(A, "Trostani, Selesnya's Voice"); const l0 = A.life; const b = inHand(A, 'Serra Angel'); putOntoBattlefield(A, b); await settle2(); ok('Trostani: gain life equal to the toughness of another creature that enters', A.life === l0 + 4, A.life - l0); }
            { const [A] = await fresh(); const d = put(A, 'Dwynen, Gilt-Leaf Daen'); const e1 = put(A, 'Llanowar Elves'); G.attackers = [d.uid, e1.uid]; const l0 = A.life; fire('attacks', { list: [d, e1] }); await settle2(); ok('Dwynen: gain 1 life for each attacking Elf', A.life === l0 + 2, A.life - l0); }
            { const [A, B] = await fresh(); put(A, 'Edric, Spymaster of Trest'); const b = put(B, 'Grizzly Bears'); const h0 = B.hand.length; fire('hitPlayer', { src: b, n: 2, hit: [A] }); await settle2(); const none = B.hand.length === h0; const c = put(A, 'Hill Giant'); const a0 = A.hand.length; fire('hitPlayer', { src: c, n: 3, hit: [B] }); await settle2();
              ok("Edric: its controller draws when a creature hits one of Edric's opponents (not when it hits you)", none && A.hand.length === a0 + 1, [none, A.hand.length - a0]); }
            { const [A] = await fresh(); const t = put(A, 'Teval, the Balanced Scale'); A.gy.push(makeObj(have('Island'), 0)); for (let i = 0; i < 4; i++) inLib(A, 'Plains'); fire('attacks', { list: [t] }); await settle2(); ok('Teval: mill three, then a land from the graveyard returns tapped', A.bf.some(x => x.card.name === 'Island' && x.tapped) || A.bf.some(x => /\bLand\b/.test(x.card.type) && x.tapped && x.card.name !== 'Teval, the Balanced Scale'), A.bf.map(x => x.card.name)); }
            { const [A, B] = await fresh(); put(A, 'Kaervek the Merciless'); const sp = inHand(B, 'Serra Angel'); const l0 = B.life; fire('cast', { P: B, o: sp }); await settle2(); ok('Kaervek: damage equal to the mana value of an opponent\'s spell', B.life === l0 - 5, [B.life]); }
            { const [A, B] = await fresh(); put(A, 'Queen Marchesa'); G.monarch = B.i; G.active = 0; fire('upkeep'); await settle2(); ok('Queen Marchesa: an Assassin token at upkeep while an opponent is the monarch', A.bf.some(x => /Assassin/.test(x.card.type)), A.bf.map(x => x.card.name)); G.monarch = null; }
            { const [A] = await fresh(); const th = put(A, 'Thrakkus the Butcher'); const d = put(A, 'Shivan Dragon'); fire('attacks', { list: [th] }); await settle2(); ok('Thrakkus: doubles the power of each Dragon', pow(d) === 10, pow(d)); }
            { const [A, B] = await fresh(); const f = put(A, 'Fynn, the Fangbearer'); fire('hitPlayer', { src: f, n: 1, hit: [B] }); await settle2(); ok('Fynn: two poison counters from a deathtouch creature', B.poison === 2, B.poison); }
            { const [A] = await fresh(); put(A, 'Reyav, Master Smith'); const b = put(A, 'Grizzly Bears'); const eq = put(A, 'Sol Ring'); eq.attachedTo = b.uid; fire('attacks', { list: [b] }); await settle2(); ok('Reyav: an equipped or enchanted attacker gains double strike', has(b, 'double strike'), b.tkw); }
            { const [A] = await fresh(); put(A, 'Venat, Heart of Hydaelyn'); const lg = inHand(A, 'Kaervek the Merciless'); const h0 = A.hand.length; fire('cast', { P: A, o: lg }); await settle2(); fire('cast', { P: A, o: lg }); await settle2(); ok('Venat: draw when you cast a legendary spell, once each turn', A.hand.length === h0 + 1, A.hand.length - h0); }
            { const [A] = await fresh(); put(A, 'Jin-Gitaxias'); const sp = inHand(A, 'Shock'); const sp3 = inHand(A, 'Terror'); const h0 = A.hand.length; fire('cast', { P: A, o: sp }); await settle2(); const h1 = A.hand.length; sp.card = { ...sp.card, cmc: 3 }; fire('cast', { P: A, o: sp }); await settle2();
              ok('Jin-Gitaxias: draw when you cast a noncreature spell with mana value 3 or more', h1 === h0 && A.hand.length === h0 + 1, [h0, h1, A.hand.length]); void sp3; }
            { const [A, B] = await fresh(); const a = put(A, 'Arabella, Abandoned Doll'); put(A, 'Grizzly Bears'); put(A, 'Hill Giant'); const l0 = A.life; fire('attacks', { list: [a] }); await settle2(); ok('Arabella: X damage to each opponent and X life, X = creatures with power 2 or less', B.life === 18 && A.life === l0 + 2, [B.life, A.life]); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300', results, []);
    writeOut('cmdr300', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
