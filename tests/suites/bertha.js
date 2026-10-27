// Big Bertha deck (2026-10-27): behavior checks for rules/bertha.js and 15l-bertha.js.
// Card data comes live from Scryfall; the list is tests/decks/big-bertha.txt.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = [...new Set(fs.readFileSync(path.join(ROOT, 'tests', 'decks', 'big-bertha.txt'), 'utf8').split('\n').map(l => l.replace(/^\d+\s+/, '').trim()).filter(Boolean))];
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
            const nm = (P, n) => P.bf.filter(x => x.card.name === n);
            const atk = async o => { G.attackers = [o.uid]; fire('attacks', { list: [o] }); await settle2(); };
            const hit = (src, victims, n = 1) => { fire('hitPlayer', { src, n, hit: victims || [], step: (G.combatDmgStep = (G.combatDmgStep || 0) + 1) }); };
            const landOf = (P, n = 'Forest') => { const l = makeObj(have(n), P.i); putOntoBattlefield(P, l); return l; };
            // Big Mother Mouser
            { const [A] = await fresh(); const m = put(A, 'Big Mother Mouser'); putCounters(m, 3, A); dieOrLeave(m, 'gy'); await settle2();
              ok('Big Mother Mouser: a Robot token for each +1/+1 counter when it dies', nm(A, 'Robot token').length === 3 || A.bf.filter(x => x.token).length === 3, A.bf.map(x => x.card.name)); }
            // Bighorner Rancher
            { const [A] = await fresh(); const r = put(A, 'Bighorner Rancher'); put(A, 'Hill Giant'); ok('Bighorner Rancher: adds {G} equal to the greatest power among your creatures', manaOf(r).n === 3 && manaOf(r).colors[0] === 'G', manaOf(r)); }
            // Biophagus
            { const [A] = await fresh(); const bio = put(A, 'Biophagus'); const g = inHand(A, 'Grizzly Bears'); manaRiders(A, g, [bio]); putOntoBattlefield(A, g); await settle2();
              ok('Biophagus: mana spent on a creature spell gives it an extra +1/+1 counter', g.counters === 1, g.counters); 
              const h = inHand(A, 'Hill Giant'); putOntoBattlefield(A, h); ok('Biophagus: only the creature that was paid with that mana', h.counters === 0, h.counters); }
            // Bushmaster
            { const [A] = await fresh(); put(A, 'Bushmaster, Coiled Henchman'); const g = put(A, 'Grizzly Bears'); const h = put(A, 'Hill Giant'); putCounters(g, 1, A);
              ok('Bushmaster: other creatures with +1/+1 counters have deathtouch', has(g, 'deathtouch') && !has(h, 'deathtouch'), [has(g, 'deathtouch'), has(h, 'deathtouch')]); }
            // Emil and Training Regimen
            { const [A] = await fresh(); put(A, 'Emil, Vastlands Roamer'); const g = put(A, 'Grizzly Bears'); ok('Emil: creatures without counters have no trample', !has(g, 'trample'), 0); putCounters(g, 1, A); ok('Emil: creatures with +1/+1 counters have trample', has(g, 'trample'), 0); }
            { const [A] = await fresh(); put(A, 'Training Regimen'); const g = put(A, 'Grizzly Bears'); putCounters(g, 1, A); ok('Training Regimen: creatures with +1/+1 counters have trample', has(g, 'trample'), 0); }
            { const [A] = await fresh(); const e = put(A, 'Emil, Vastlands Roamer'); ['Forest', 'Island', 'Swamp', 'Mountain', 'Plains'].forEach(n => landOf(A, n)); landOf(A, 'Forest'); await activate(A, e, acts(e)[0]); await settle2();
              const f = A.bf.find(x => x.token && /Fractal/.test(x.card.type)); ok('Emil: a Fractal with a counter for each differently named land', f && f.counters === 5, f && f.counters); }
            // Claim the Kingdom
            { const [A] = await fresh(); const c = put(A, 'Claim the Kingdom'); const g = put(A, 'Grizzly Bears'); for (let i = 0; i < 3; i++) { landOf(A); await settle2(); }
              ok('Claim the Kingdom: each land adds a +1/+1 counter and a plan counter', g.counters === 3 && c.ctr.plan === 3, [g.counters, c.ctr.plan]);
              landOf(A); await settle2();
              ok('Claim the Kingdom: the fourth plan counter sacrifices it and gives an indestructible counter', !onBf(c.uid) && g.ctr.indestructible === 1 && g.counters === 4, [onBf(c.uid), g.ctr.indestructible, g.counters]); }
            // Earthbender Ascension
            { const [A] = await fresh(); const f = landOf(A); const e = inHand(A, 'Earthbender Ascension'); const n0 = A.bf.filter(x => /Land/.test(x.card.type)).length; putOntoBattlefield(A, e); await settle2();
              ok('Earthbender Ascension: earthbend 2 and a basic land onto the battlefield tapped', f.counters === 2 && isCreature(f) && A.bf.filter(x => /Land/.test(x.card.type)).length === n0 + 1, [f.counters, isCreature(f), A.bf.length]);
              const g = put(A, 'Grizzly Bears'); for (let i = 0; i < 3; i++) { landOf(A); await settle2(); }
              ok('Earthbender Ascension: quest counters build up', e.ctr.quest >= 3, e.ctr.quest);
              const before = A.bf.reduce((s, x) => s + (x.counters || 0), 0); landOf(A); await settle2();
              ok('Earthbender Ascension: at four quest counters a creature gets a +1/+1 counter and trample', e.ctr.quest >= 4 && A.bf.reduce((s, x) => s + (x.counters || 0), 0) === before + 1 && A.bf.some(x => x.tkw.includes('trample')), [e.ctr.quest, before]); }
            // Fangs of Kalonia
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); putCounters(g, 2, A); const f = inHand(A, 'Fangs of Kalonia'); await spell(A, f, { target: { o: g } });
              ok('Fangs of Kalonia: a counter, then double (2 becomes 6)', g.counters === 6, g.counters); }
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); const h = put(A, 'Hill Giant'); const f = inHand(A, 'Fangs of Kalonia'); ok('Fangs of Kalonia: has an overload', !!Rx(f).overload, 0);
              await resolveEffects(A, Rx(f).overload.spell, null, f); await settle2(); ok('Fangs of Kalonia (overload): every creature you control gets a counter, doubled', g.counters === 2 && h.counters === 2, [g.counters, h.counters]); }
            // Fertilid
            { const [A] = await fresh(); const f = put(A, 'Fertilid'); putCounters(f, 2, A); lands(A, 2, 'Forest'); const n0 = A.bf.filter(x => /Land/.test(x.card.type)).length; await activate(A, f, acts(f)[0]); await settle2();
              ok('Fertilid: remove a counter, a basic land comes in tapped', f.counters === 1 && A.bf.filter(x => /Land/.test(x.card.type)).length === n0 + 1, [f.counters, A.bf.length]); }
            // Gamma Grotesque
            { const [A] = await fresh(); const g = put(A, 'Gamma Grotesque'); put(A, 'Grizzly Bears'); lands(A, 6, 'Forest'); g.enteredTurn = 1; const h0 = A.hand.length; await activate(A, g, acts(g)[0]); await settle2();
              ok('Gamma Grotesque: three counters, then a card for each creature with a counter', g.counters === 3 && A.hand.length === h0 + 1, [g.counters, A.hand.length - h0]);
              lands(A, 6, 'Forest'); ok('Gamma Grotesque: the power-up works only once', !actPlan(A, g, acts(g)[0]), 0); }
            // Incubation Druid
            { const [A] = await fresh(); const d = put(A, 'Incubation Druid'); landOf(A, 'Forest'); landOf(A, 'Island'); const m = manaOf(d);
              ok('Incubation Druid: one mana of a type a land could produce', m.n === 1 && m.colors.includes('G') && m.colors.includes('U'), m); putCounters(d, 1, A); ok('Incubation Druid: three mana with a +1/+1 counter', manaOf(d).n === 3, manaOf(d)); }
            // Ka-Zar
            { const [A] = await fresh(); const k = inHand(A, 'Ka-Zar of the Savage Land'); putOntoBattlefield(A, k); await settle2(); const z = A.bf.find(x => x.token && x.card.name === 'Zabu');
              ok('Ka-Zar: Zabu, a legendary 2/2 Cat', z && pow(z) === 2 && /Legendary/.test(z.card.type), z && z.card.type); landOf(A); await settle2(); ok('Ka-Zar: Zabu grows with landfall', z && z.counters === 1, z && z.counters); }
            // Mutagen Man and The Ooze
            { const [A] = await fresh(); const m = inHand(A, 'Mutagen Man, Living Ooze'); m.xVal = 3; putOntoBattlefield(A, m); await settle2(); const toks = A.bf.filter(x => x.token && /Mutagen/.test(x.card.name));
              ok('Mutagen Man: X Mutagen tokens', toks.length === 3, toks.length); ok('Mutagen Man: artifact tokens\' abilities cost {1} less', actCost(toks[0], acts(toks[0])[0]).generic === 0, actCost(toks[0], acts(toks[0])[0])); }
            { const [A] = await fresh(); const t = makeArtifactToken(A, 'mutagen'); ok('Mutagen without Mutagen Man costs {1}', actCost(t, acts(t)[0]).generic === 1, actCost(t, acts(t)[0])); }
            { const [A, B] = await fresh(); const o = put(A, 'The Ooze'); const g = put(A, 'Grizzly Bears'); putCounters(g, 3, A); dieOrLeave(g, 'gy'); await settle2();
              ok('The Ooze: a Mutagen for each +1/+1 counter on a creature that left', A.bf.filter(x => x.token && /Mutagen/.test(x.card.name)).length === 3, A.bf.map(x => x.card.name));
              const dead = inGy(B, 'Hill Giant'); const n0 = A.bf.filter(x => x.token).length; await activate(A, o, acts(o)[0]); await settle2();
              ok('The Ooze: exile a card from a graveyard and make a Mutagen', A.bf.filter(x => x.token).length === n0 + 1 && !B.gy.includes(dead) && B.exile.includes(dead), [A.bf.filter(x => x.token).length - n0, B.gy.length, B.exile.length]); }
            // Nesting Grounds
            { const [A] = await fresh(); const n = put(A, 'Nesting Grounds'); lands(A, 1, 'Forest'); const g = put(A, 'Grizzly Bears'); const h = put(A, 'Hill Giant'); putCounters(g, 2, A); await activate(A, n, acts(n)[0]); await settle2();
              ok('Nesting Grounds: moves a counter from one permanent to another', g.counters + h.counters === 2 && h.counters === 1, [g.counters, h.counters]); }
            // Palazzo Archers
            { const [A, B] = await fresh(); const a = put(A, 'Palazzo Archers'); const f = put(B, 'Air Elemental'); G.active = 1; await atk(f);
              ok('Palazzo Archers: damage equal to its power to an attacking flier', f.dmg === 2 || !onBf(f.uid), f.dmg); 
              const g = put(B, 'Hill Giant'); f.dmg = 0; await atk(g); ok('Palazzo Archers: nothing happens for a non-flier', !g.dmg, g.dmg); }
            // Power Fist
            { const [A, B] = await fresh(); const e = put(A, 'Power Fist'); const g = put(A, 'Grizzly Bears'); e.attachedTo = g.uid; hit(g, [B], 4); await settle2();
              ok('Power Fist: trample, and counters equal to the combat damage to a player', has(g, 'trample') && g.counters === 4, [has(g, 'trample'), g.counters]); }
            // Railway Brawler
            { const [A] = await fresh(); put(A, 'Railway Brawler'); const h = inHand(A, 'Hill Giant'); putOntoBattlefield(A, h); await settle2(); ok('Railway Brawler: another creature enters with counters equal to its power', h.counters === 3, h.counters); }
            // Rampaging Yao Guai
            { const [A, B] = await fresh(); const s = put(B, 'Sol Ring'); const r = put(B, 'Rhystic Study'); const y = inHand(A, 'Rampaging Yao Guai'); y.xVal = 4; putOntoBattlefield(A, y); await settle2();
              ok('Rampaging Yao Guai: destroys artifacts and enchantments with total mana value X or less', !onBf(s.uid) && !onBf(r.uid), [onBf(s.uid), onBf(r.uid)]); }
            { const [A, B] = await fresh(); const s = put(B, 'Sol Ring'); const r = put(B, 'Rhystic Study'); const y = inHand(A, 'Rampaging Yao Guai'); y.xVal = 3; putOntoBattlefield(A, y); await settle2();
              ok('Rampaging Yao Guai: total mana value never goes over X', (onBf(s.uid) ? 1 : 0) + (onBf(r.uid) ? 1 : 0) === 1 || !onBf(s.uid) && !onBf(r.uid) === false, [onBf(s.uid), onBf(r.uid)]); }
            // Study the Classics
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); putCounters(g, 1, A); const s = inHand(A, 'Study the Classics'); const l0 = A.life; await spell(A, s, { target: { o: g } });
              ok('Study the Classics: a counter, double (1 becomes 4), gain life equal to the counters', g.counters === 4 && A.life === l0 + 4, [g.counters, A.life - l0]); }
            // Synchronized Charge
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); const h = put(A, 'Hill Giant'); const o = put(A, 'Air Elemental'); const s = inHand(A, 'Synchronized Charge'); await spell(A, s);
              ok('Synchronized Charge: two counters, and creatures with counters get vigilance and trample', g.counters + h.counters + o.counters === 2 && A.bf.filter(x => isCreature(x) && (x.counters > 0)).every(x => has(x, 'vigilance') && has(x, 'trample')) && A.bf.filter(x => isCreature(x) && (x.counters > 0)).length >= 1, [g.counters, h.counters, o.counters]); }
            // Voracious Brood
            { const [A] = await fresh(); const b = put(A, 'Voracious Brood'); await settle2(); const c = put(A, 'Grizzly Bears'); dieOrLeave(c, 'gy'); await settle2();
              ok('Voracious Brood: a counter when a creature card hits your graveyard', b.counters === 1, b.counters);
              const d = put(A, 'Hill Giant'); const e2 = put(A, 'Grizzly Bears'); dieOrLeave(d, 'gy'); dieOrLeave(e2, 'gy'); await settle2(); ok('Voracious Brood: two creatures at once give two counters', b.counters === 3, b.counters); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('bertha', results, []);
    writeOut('bertha', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
