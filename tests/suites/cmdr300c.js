// Commander round 2, batch c (2026-10-26): behavior checks for rules/cmdr300c.js and 15-cmdr300c.js.
// Card data comes live from Scryfall (the set is new and the offline card file doesn't have it all); the names are in tests/data/cmdr300c_names.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cmdr300c_names.json'), 'utf8'));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Divination', 'Shock', 'Treasure Map', 'Giant Growth', 'Ancestral Recall', 'Dark Ritual', 'Goblin Guide', 'Shivan Dragon', 'Air Elemental', 'Wall of Omens', 'Bear Cub', 'Ornithopter', 'Black Lotus', 'Cultivate', 'Island', 'Terror', 'Doom Blade', 'Bonesplitter', 'Lightning Greaves', 'Swords to Plowshares', 'Mountain', 'Elvish Mystic']);
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
            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };

            // ---- Chunk 1 ----
            { const [A] = await fresh(); const f = put(A, 'Fain, the Broker'); f.sick = false; const b = put(A, 'Grizzly Bears'); b.counters = 1; await activate(A, f, acts(f).find(a => /Remove a counter/.test(a.text))); await settle2();
              ok('Fain, the Broker: remove a counter from a creature, make a Treasure', b.counters === 0 && A.bf.some(x => /Treasure/.test(x.card.type)), [b.counters, A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const f = put(A, "O'aka, Traveling Merchant"); f.sick = false; const b = put(A, 'Sol Ring'); b.ctr.charge = 1; const h0 = A.hand.length; await activate(A, f, acts(f).find(a => /Remove a counter/.test(a.text))); await settle2();
              ok("O'aka: remove a counter from a nonland permanent, draw a card", b.ctr.charge === 0 && A.hand.length === h0 + 1, [b.ctr, A.hand.length - h0]); }
            { const [A, B] = await fresh(); put(A, 'Ardyn, the Usurper'); B.gy.push(makeObj(have('Hill Giant'), 1)); fire('combat'); await settle2(); const d = A.bf.find(x => x.token && /Demon/.test(x.card.type));
              ok('Ardyn: a 5/5 black Demon copy of a creature card exiled from a graveyard', d && pow(d) === 5 && (d.card.colors || []).includes('B') && !B.gy.length && d.card.name === 'Hill Giant', [A.bf.map(x => x.card.name), d && d.card.type]); }
            { const [A, B] = await fresh(); put(A, 'Lulu, Stern Guardian'); const g = put(B, 'Hill Giant'); G.defender = A.i; fire('attacks', { list: [g] }); await settle2(); ok('Lulu, Stern Guardian: a stun counter on a creature attacking you', g.ctr.stun === 1, g.ctr); }
            { const [A, B] = await fresh(); const k = put(A, 'Kaalia of the Vast'); const d = inHand(A, 'Shivan Dragon'); G.defender = B.i; G.attackers = [k.uid]; fire('attacks', { list: [k] }); await settle2(); ok('Kaalia of the Vast: a Dragon from hand enters tapped and attacking', onBf(d.uid) && d.tapped && G.attackers.includes(d.uid), [onBf(d.uid), d.tapped]); }
            { const [A] = await fresh(); const n = put(A, 'Nylea, Keen-Eyed'); n.sick = false; lands(A, 3, 'Forest'); inLib(A, 'Hill Giant'); const h0 = A.hand.length; await activate(A, n, acts(n).find(a => /Reveal/.test(a.text))); await settle2();
              ok('Nylea, Keen-Eyed: a revealed creature card goes to hand', A.hand.length === h0 + 1 && A.hand[A.hand.length - 1].card.name === 'Hill Giant', A.hand.map(x => x.card.name)); }
            { const [A] = await fresh(); const n = put(A, 'Nylea, Keen-Eyed'); n.sick = false; lands(A, 3, 'Forest'); inLib(A, 'Shock'); await activate(A, n, acts(n).find(a => /Reveal/.test(a.text))); await settle2();
              ok('Nylea, Keen-Eyed: a revealed noncreature card may go to the graveyard', A.gy.some(x => x.card.name === 'Shock'), A.gy.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Hakbal of the Surging Soul'); const m = put(A, 'Bear Cub'); m.card = { ...m.card, type: 'Creature — Merfolk' }; const h0 = A.hand.length; fire('combat'); await settle2(); ok('Hakbal of the Surging Soul: each Merfolk (Hakbal too) explores', A.hand.length === h0 + 2, [A.hand.length - h0, m.counters]); }
            { const [A, B] = await fresh(); const n = put(A, 'Neheb, Dreadhorde Champion'); lands(A, 5); inHand(A, 'Island'); inHand(A, 'Island'); hit(n, [B]); await settle2();
              ok('Neheb, Dreadhorde Champion: discard, draw that many, add that much {R} until end of turn', A.hand.length === 2 && A.gy.length === 2 && (A.pool || []).filter(x => x === 'R').length === 2 && A.keepPoolTurn === G.turn, [A.hand.length, A.gy.length, A.pool]); }
            { const [A] = await fresh(); const t = put(A, 'Thalia and The Gitrog Monster'); put(A, 'Grizzly Bears'); const h0 = A.hand.length, n0 = A.bf.length; G.attackers = [t.uid]; fire('attacks', { list: [t] }); await settle2(); ok('Thalia and The Gitrog Monster: sacrifice a creature or land, then draw', A.bf.length === n0 - 1 && A.hand.length === h0 + 1, [A.bf.length, n0, A.hand.length - h0]); }
            { const [A] = await fresh(); const s = put(A, 'Szarel, Genesis Shepherd'); const v = put(A, 'Hill Giant'); G.active = A.i; fire('sacrificed', { o: makeObj(have('Grizzly Bears'), A.i) }); await settle2(); ok("Szarel, Genesis Shepherd: counters equal to Szarel's power on another creature", v.counters === pow(s) && pow(s) > 0, [v.counters, pow(s)]); }
            { const [A] = await fresh(); const a = put(A, 'Alphinaud Leveilleur'); const b = put(A, 'Toothy, Imaginary Friend'); ok('Partner with: reads as Automated', Rx(a).support === 'full' && Rx(b).support === 'full', [Rx(a).support, Rx(b).support]); }
            { const [A] = await fresh(); const m = put(A, 'Amalia Benavides Aguirre'); const h = put(A, 'Hill Giant'); const h0 = A.hand.length; fire('gainLife', { P: A, n: 2 }); await settle2(); ok('Amalia Benavides Aguirre: gaining life explores (and does not wipe below 20 power)', (A.hand.length === h0 + 1 || m.counters > 0) && onBf(h.uid), [A.hand.length - h0, m.counters]); }
            { const [A] = await fresh(); const m = put(A, 'Amalia Benavides Aguirre'); const h = put(A, 'Hill Giant'); m.counters = 20 - (Number(m.card.power) || 0); fire('gainLife', { P: A, n: 2 }); await settle2(); ok('Amalia Benavides Aguirre: exactly 20 power destroys all other creatures', !onBf(h.uid) && onBf(m.uid), [pow(m), onBf(h.uid)]); }
            { const [A, B] = await fresh(); put(A, 'Omnath, Locus of Creation'); const l1 = put(A, 'Forest'), l2 = put(A, 'Forest'), l3 = put(A, 'Forest'); A.pool = []; const life0 = A.life; fire('landfall', { o: l1 }); await settle2(); const g1 = A.life - life0; fire('landfall', { o: l2 }); await settle2(); const p2 = (A.pool || []).length; fire('landfall', { o: l3 }); await settle2();
              ok('Omnath, Locus of Creation: 4 life, then {R}{G}{W}{U}, then 4 damage to each opponent', g1 === 4 && p2 === 4 && B.life === 16, [g1, p2, B.life]); }
            { const [A, B] = await fresh(); const o = put(A, 'Ob Nixilis, Captive Kingpin'); inLib(A, 'Island'); fire('loseLife', { P: B, n: 2 }); await settle2(); const c0 = o.counters; fire('loseLife', { P: B, n: 1 }); await settle2(); ok('Ob Nixilis, Captive Kingpin: only exactly 1 life gives a counter and an exiled card to play', c0 === 0 && o.counters === 1 && A.exile.length === 1, [c0, o.counters, A.exile.length]); }
            { const [A] = await fresh(); const r = put(A, 'Raffine, Scheming Seer'); const b = put(A, 'Grizzly Bears'); const n0 = A.library.length; fire('attacks', { list: [r, b] }); await settle2(); ok('Raffine, Scheming Seer: an attacker connives X (X = attackers)', A.library.length === n0 - 2, [A.library.length, n0]); }
            { const [A] = await fresh(); put(A, 'Atla Palani, Nest Tender'); const egg = put(A, 'Bear Cub', { token: true }); egg.card = { ...egg.card, type: 'Token Creature — Egg' }; A.library.length = 0; inLib(A, 'Island'); inLib(A, 'Hill Giant'); inLib(A, 'Island'); fire('creatureDies', { o: egg }); await settle2(); ok('Atla Palani: an Egg dies, reveal until a creature and put it onto the battlefield', A.bf.some(x => x.card.name === 'Hill Giant') && A.library.length === 2, [A.bf.map(x => x.card.name), A.library.length]); }
            { const [A] = await fresh(); const g = put(A, 'Gilgamesh, Master-at-Arms'); A.library.length = 0; for (let i = 0; i < 5; i++) inLib(A, 'Island'); inLib(A, 'Bonesplitter'); fire('attacks', { list: [g] }); await settle2(); const e = A.bf.find(x => x.card.name === 'Bonesplitter'); ok('Gilgamesh: Equipment from the top six onto the battlefield, attached to a Samurai', e && e.attachedTo === g.uid && A.library.length === 5, [e && e.attachedTo, g.uid, A.library.length]); }
            { const [A, B] = await fresh(); put(A, 'Xyris, the Writhing Storm'); B.drawTurn = -1; G.inDrawStep = true; fire('draw', { P: B }); await settle2(); const n1 = A.bf.filter(x => /Snake/.test(x.card.name)).length; G.inDrawStep = false; fire('draw', { P: B }); await settle2(); ok('Xyris: a Snake for each card drawn except the first in the draw step', n1 === 0 && A.bf.filter(x => /Snake/.test(x.card.name)).length === 1, [n1, A.bf.map(x => x.card.name)]); }
            { const [A, B] = await fresh(); const b = put(A, 'Breeches, Brazen Plunderer'); B.library.length = 0; inLib(B, 'Shock'); fire('hitPlayer', { src: b, n: 1, hit: [B], step: 1 }); await settle2(); ok('Breeches, Brazen Plunderer: exile the top card of the opponent hit; play it this turn', A.exile.length === 1 && A.exile[0].card.name === 'Shock' && A.exile[0].playUntil === G.turn, [A.exile.map(x => x.card.name)]); }
            { const [A, B] = await fresh(); const s = put(A, 'Slinn Voda, the Rising Deep'); s.kicked = true; const m = put(A, 'Bear Cub'); m.card = { ...m.card, type: 'Creature — Merfolk' }; const hg = put(B, 'Hill Giant'); const gb = put(A, 'Grizzly Bears'); await resolveEffects(A, Rx(s).etb, null, s); await settle2();
              ok('Slinn Voda: kicked, return all creatures except Merfolk/Krakens/Leviathans/Octopuses/Serpents', !onBf(hg.uid) && !onBf(gb.uid) && onBf(m.uid) && B.hand.some(x => x.card.name === 'Hill Giant'), [onBf(hg.uid), onBf(gb.uid), onBf(m.uid)]); }
            { const [A] = await fresh(); const s = put(A, 'Slinn Voda, the Rising Deep'); const gb = put(A, 'Grizzly Bears'); await resolveEffects(A, Rx(s).etb, null, s); await settle2(); ok('Slinn Voda: not kicked does nothing', onBf(gb.uid)); }
            { const [A, B] = await fresh(); const w = put(A, 'Winota, Joiner of Forces'); const bear = put(A, 'Grizzly Bears'); A.library.length = 0; const hu = inLib(A, 'Bear Cub'); hu.card = { ...hu.card, type: 'Creature — Human' }; inLib(A, 'Island'); G.attackers = [bear.uid]; G.defender = B.i; fire('attacks', { list: [bear] }); await settle2();
              ok('Winota, Joiner of Forces: a non-Human attacks; a Human from the top six enters tapped and attacking, indestructible', onBf(hu.uid) && hu.tapped && G.attackers.includes(hu.uid) && has(hu, 'indestructible') && A.library.length === 1, [onBf(hu.uid), hu.tapped, A.library.length]); }
            { const [A, B] = await fresh(); const z = put(A, 'Zara, Renegade Recruiter'); const gi = makeObj(have('Hill Giant'), B.i); B.hand.push(gi); G.defender = B.i; G.attackers = [z.uid]; fire('attacks', { list: [z] }); await settle2(); const mid = onBf(gi.uid) && gi.tapped && gi.owner === A.i && G.attackers.includes(gi.uid); await runEndQueue(); await settle2();
              ok("Zara, Renegade Recruiter: steal a creature from the defender's hand to attack; it goes home at the end step", mid && !onBf(gi.uid) && B.hand.includes(gi), [mid, onBf(gi.uid), B.hand.map(x => x.card.name)]); }
            { const [A] = await fresh(); const r = put(A, 'Old Rutstein'); A.library.length = 0; inLib(A, 'Shock'); inLib(A, 'Hill Giant'); inLib(A, 'Plains'); fire('upkeep'); await settle2(); fire('upkeep'); await settle2(); fire('upkeep'); await settle2();
              ok('Old Rutstein: mill a card; land = Treasure, creature = Insect, other = Blood', A.bf.some(x => /Treasure/.test(x.card.type)) && A.bf.some(x => /Insect/.test(x.card.name + x.card.type)) && A.bf.some(x => /Blood/.test(x.card.type)), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); const g = put(A, "Go-Shintai of Life's Origin"); fire('enters', { o: g }); await settle2(); const t = A.bf.find(x => x.token && /Shrine/.test(x.card.type)); ok("Go-Shintai of Life's Origin: a 1/1 Shrine enchantment creature token when a Shrine enters", t && /Enchantment/.test(t.card.type) && pow(t) === 1, A.bf.map(x => x.card.type)); }
            { const [A, B] = await fresh(); const s = put(A, 'Sazh Katzroy'); G.attackers = [s.uid]; fire('attacks', { list: [s] }); await settle2(); ok('Sazh Katzroy: a +1/+1 counter on a creature, then double its counters', A.bf.some(x => x.counters === 2), A.bf.map(x => x.counters)); }
            { const [A] = await fresh(); put(A, 'Mole Man, Moloid Master'); fire('landfall', { o: put(A, 'Forest') }); await settle2(); ok('Mole Man, Moloid Master: a land enters, make a Moloid', A.bf.some(x => x.token && /Moloid/.test(x.card.name)), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Torgal, A Fine Hound'); for (let i = 0; i < 2; i++) { const w = put(A, 'Bear Cub'); w.card = { ...w.card, type: 'Creature — Wolf' }; } const hu = inHand(A, 'Grizzly Bears'); hu.card = { ...hu.card, type: 'Creature — Human' }; fire('cast', { P: A, o: hu }); await settle2(); putOntoBattlefield(A, hu); await settle2(); ok('Torgal, A Fine Hound: the first Human creature spell enters with a counter per Dog/Wolf (Torgal is a Dog)', hu.counters === 3, hu.counters); }
            { const [A] = await fresh(); put(A, "Betor, Ancestor's Voice"); const b = put(A, 'Hill Giant'); A.gy.push(makeObj(have('Grizzly Bears'), A.i)); A.gainedTurn = G.turn; A.gainedAmt = 3; A.lostTurn = G.turn; A.lostN = 2; fire('end'); await settle2(); ok("Betor, Ancestor's Voice: counters equal to life gained; return a creature with mana value up to life lost", b.counters === 3 && A.bf.some(x => x.card.name === 'Grizzly Bears'), [b.counters, A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const r = put(A, 'Rhys the Redeemed'); r.sick = false; lands(A, 6, 'Forest'); put(A, 'Grizzly Bears', { token: true }); put(A, 'Hill Giant'); await activate(A, r, acts(r).find(a => /\{4\}/.test(a.text))); await settle2(); ok('Rhys the Redeemed: a copy of each creature token you control', A.bf.filter(x => x.token && x.card.name === 'Grizzly Bears').length === 2 && A.bf.filter(x => x.card.name === 'Hill Giant').length === 1, A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Elanor Gardner'); inLib(A, 'Forest'); A.library.unshift(makeObj(have('Island'), A.i)); const f = makeArtifactToken(A, 'food'); fire('sacrificed', { o: f }); await settle2(); fire('end'); await settle2(); ok('Elanor Gardner: sacrificed a Food this turn, fetch a basic land tapped', A.bf.some(x => /Basic Land/.test(x.card.type) && x.tapped), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Elanor Gardner'); inLib(A, 'Forest'); fire('end'); await settle2(); ok('Elanor Gardner: no Food sacrificed, no land', !A.bf.some(x => x.card.name === 'Forest')); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr300c', results, []);
    writeOut('cmdr300c', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
