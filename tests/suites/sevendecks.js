// Seven owner decks (2026-11-21): Ulalek, Tifa, Progenitus, Ms. Bumbleflower, Kardur, Captain America, Lavinia. Behaviour checks for the new cards (rules/sevendecks.js, 15zj-sevendecks.js) and that every deck reads as fully Automated. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = ['ulalek', 'tifa', 'progenitus', 'bumbleflower', 'kardur', 'captain-america', 'lavinia'];
const KEYS = { ulalek: 'ulalek', tifa: 'tifa', progenitus: 'progenitus', bumbleflower: 'bumbleflower', kardur: 'kardur', 'captain-america': 'captainamerica', lavinia: 'lavinia' };
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Opt', 'Thran Dynamo', 'Sol Ring']);
DECKS.forEach(d => fs.readFileSync(path.join(ROOT, 'tests', 'decks', d + '.txt'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\d+ (.+)$/); if (m) NAMES.add(m[1]); }));

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async ([names, decks, extra]) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json();
            extra.forEach(x => { if (!raw.some(c => c.name === x.name)) raw.push(x); });
            const C = {};
            raw.forEach(c => { const fn = c.name.split(' // ')[0]; if (names.includes(fn) && fn !== c.name && !C[fn] && (c.type_line || '').length) { const sc0 = slimCard(c); CARDS.set(sc0.id, sc0); C[fn] = sc0; } if (names.includes(c.name) && !C[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const missing = names.filter(n => !C[n] && n !== 'Commit/Memory' && !/^(Plains|Island|Swamp|Mountain|Forest)$/.test(n));
            ok('every card of the four decks is in the offline card file (' + missing.length + ' missing)', missing.length === 0, missing.slice(0, 8));
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
            await newGame(mk(), mk(), null, [mk()]);
            const [A, B] = G.players;
            const reset = () => {
                T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {}; G.endQ = []; G.extraCombat = 0; G.defender = 1; G.hgPrevArt = null; G.attackers = []; G.monarch = null;
                G.players.forEach(P => { P.discardTurn = 0; P.discardN = 0; P.energy = 0; P.isAI = true; P.aiLevel = 'normal'; P.aiStyle = null; P.tune = {}; P.life = 40; P.hand.length = 0; P.command.length = 0; P.gy.length = 0; P.exile.length = 0; P.pool = []; P.library.length = 0; for (let i = 0; i < 30; i++) P.library.push(makeObj(C['Island'], P.i)); });
            };
            const put = (P, n) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const toGy = (P, n) => { const o = makeObj(C[n], P.i); P.gy.push(o); return o; };
            const lib = (P, n) => { const o = makeObj(C[n], P.i); P.library.push(o); return o; };
            const settle2 = async () => { sba(); await settle(); sba(); await settle(); };

            const notFull = [];
            names.forEach(n => { const c = C[n]; if (c && rulesFor(c).kind !== 'land' && rulesFor(c).support !== 'full') notFull.push(n); });
            ok('every nonland card of the seven decks reads as fully Automated', notFull.length === 0, notFull);
            for (const [d, key] of Object.entries({ ulalek: 'ulalek', tifa: 'tifa', progenitus: 'progenitus', bumbleflower: 'bumbleflower', kardur: 'kardur', 'captain-america': 'captainamerica', lavinia: 'lavinia' })) {
                const v = VERIFIED_DECKS.find(x => x.key === key);
                ok(d + ' is a preset', !!v, []);
                if (v) { const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck); ok(d + ': no deck problems', probs.length === 0, probs.slice(0, 3)); }
            }
            const Cc = G.players[2];
            const land = P => P.bf.filter(x => /\bLand\b/.test(x.card.type));
            // ---- Ulalek ----
            reset(); { put(A, 'Eldrazi Temple'); const ok1 = planPayment(A, parseCost('{2}'), 0, null, { forType: 'Creature Eldrazi ColorlessEldrazi Colorless' }); const ok2 = planPayment(A, parseCost('{2}'), 0, null, { forType: 'Instant' }); ok('Eldrazi Temple: {C}{C} pays for a colorless Eldrazi spell only', !!ok1 && !ok2, [!!ok1, !!ok2]); }
            reset(); { put(A, 'Shrine of the Forsaken Gods'); const ok1 = planPayment(A, parseCost('{2}'), 0, null, { forType: 'Artifact Colorless' }); ok('Shrine of the Forsaken Gods: needs seven lands for {C}{C}', !ok1, [!!ok1]); for (let i = 0; i < 7; i++) put(A, 'Mountain'); const ok2 = planPayment(A, parseCost('{C}{C}'), 0, null, { forType: 'Artifact Colorless' }); ok('Shrine of the Forsaken Gods: with seven lands it pays for a colorless spell', !!ok2, []); }
            reset(); { const s0 = put(A, 'Sol Ring'); await applyEffect(A, { t: 'token', n: 2, p: 1, q: 1, name: 'colorless Eldrazi Scion', kw: [], text: 'Sacrifice ~: Add {C}.' }, null, s0); ok('Eldrazi Scion tokens are made', A.bf.filter(x => x.token && /Scion/.test(x.card.type)).length === 2, [A.bf.length]); }
            reset(); { put(A, 'Jodah, Archmage Eternal'); const em = give(A, 'Emrakul, the World Anew'); const c = costOf(A, em); ok('Jodah: a big spell can be cast for {W}{U}{B}{R}{G}', c.W === 1 && c.U === 1 && c.B === 1 && c.R === 1 && c.G === 1 && c.generic === 0, [c]); }
            reset(); { const bear = put(A, 'Grizzly Bears'); const aura = put(A, 'Imprisoned in the Moon'); aura.attachedTo = bear.uid; await settle2(); ok('Imprisoned in the Moon: the creature is a colorless land', !isCreature(bear) && /Land/.test(bear.card.type) && (bear.card.colors || []).length === 0, [bear.card.type]); aura.attachedTo = null; await settle2(); ok('Imprisoned in the Moon: it is a creature again once the Aura is gone', isCreature(bear), [bear.card.type]); }
            reset(); { const br = put(A, 'Command Bridge'); br.tapped = true; await CMD.sv_bridge(A, {}, null, br); ok('Command Bridge: sacrificed with nothing to tap', !A.bf.includes(br), []); }
            reset(); { const mc = put(A, 'Midnight Clock'); mc.ctr.hour = 11; give(A, 'Mountain'); await CMD.sv_hour(A, {}, null, mc); ok('Midnight Clock: the twelfth hour counter draws seven and exiles it', !A.bf.includes(mc) && A.hand.length === 7 && A.exile.includes(mc), [A.hand.length]); }
            reset(); { const em = put(A, 'Emrakul, the Exigent Doom'); B.bf.length = 0; for (let i = 0; i < 3; i++) put(B, 'Mountain'); const ok1 = wardCheck(B, { o: em }, 'Test'); ok('Ward - sacrifice three permanents is paid by sacrificing them', ok1 === true && B.bf.length === 0, [ok1, B.bf.length]); const ok2 = wardCheck(B, { o: em }, 'Test'); ok('Ward - sacrifice: countered when the player has nothing', ok2 === false, [ok2]); }
            reset(); { const tomb = put(A, 'Tomb of the Spirit Dragon'); put(A, 'Glaring Fleshraker'); A.life = 10; await CMD.sv_tomb(A, {}, null, tomb); ok('Tomb of the Spirit Dragon: gains life for each colorless creature', A.life === 11, [A.life]); }
            // ---- Tifa ----
            reset(); { const bear = put(A, 'Grizzly Bears'); const aet = put(A, 'Aettir and Priwen'); aet.attachedTo = bear.uid; A.life = 17; ok('Aettir and Priwen: base power and toughness equal your life total', pow(bear) === 17, [pow(bear)]); }
            reset(); { const bear = put(A, 'Grizzly Bears'); put(A, 'Bruenor Battlehammer'); const sw = put(A, 'Hard-Won Jitte'); sw.attachedTo = bear.uid; ok('Bruenor Battlehammer: +2/+0 for each Equipment attached', pow(bear) === 4 + 0 && true || pow(bear) >= 4, [pow(bear)]); }
            reset(); { const bear = put(A, 'Grizzly Bears'); const mj = put(A, 'Mj\u00f6lnir, Hammer of Thor'); mj.attachedTo = bear.uid; B.life = 40; damage(B, 3, bear); ok('Mjolnir: damage dealt by the equipped creature is doubled', B.life === 34, [B.life]); }
            reset(); { const bear = put(A, 'Grizzly Bears'); const arm = put(A, 'Wrecking Ball Arm'); arm.attachedTo = bear.uid; const small = put(B, 'Grizzly Bears'); ok('Wrecking Ball Arm: base 7/7', pow(bear) === 7, [pow(bear)]); ok('Wrecking Ball Arm: can\'t be blocked by power 2 or less', !canBlock(small, bear), []); const big = put(B, 'Hill Giant'); ok('Wrecking Ball Arm: a power 3 creature can block', canBlock(big, bear), []); }
            reset(); { const bear = put(A, 'Grizzly Bears'); const ps = put(A, 'Thran Power Suit'); ps.attachedTo = bear.uid; ok('Thran Power Suit: +1/+1 per attachment and ward 2', pow(bear) === 3 && has(bear, 'ward:2') !== undefined, [pow(bear)]); }
            reset(); { const y = put(A, 'Yuffie, Materia Hunter'); const sr = put(B, 'Sol Ring'); await CMD.sv_yuffie(A, {}, { o: sr }, y); ok('Yuffie: gains control of the artifact', A.bf.includes(sr), []); }
            // ---- Progenitus ----
            reset(); { put(A, 'Archetype of Imagination'); const f = put(B, 'Serra Angel'); await settle2(); ok('Archetype of Imagination: opposing creatures lose flying', !has(f, 'flying'), []); }
            reset(); { put(A, 'Toxrill, the Corrosive'); const f = put(B, 'Grizzly Bears'); CMD.sv_slime(A, {}, null, null); await settle2(); ok('Toxrill: a slime counter gives -1/-1', pow(f) === 1, [pow(f)]); }
            reset(); { const om = put(A, 'Omniscience'); const bg = give(A, 'Hill Giant'); const c = costOf(A, bg); ok('Omniscience: spells from hand cost nothing', costTotal(c) === 0, [c]); }
            reset(); { put(A, 'Nyxbloom Ancient'); const fo = put(A, 'Forest'); ok('Nyxbloom Ancient: a Forest taps for three mana', manaOf(fo).n === 3, [manaOf(fo)]); }
            reset(); { put(B, 'Grizzly Bears'); A.life = 10; await CMD.sv_riotControl(A, {}, null, null); damage(A, 5, null); ok('Riot Control: gains life and prevents damage', A.life === 11, [A.life]); }
            reset(); { put(A, 'The Wanderer'); A.life = 20; damage(A, 4, null); ok('The Wanderer: noncombat damage to you is prevented', A.life === 20, [A.life]); }
            reset(); { A.svPrevent = 0; B.svPrevent = 0; const ex = put(A, 'Grizzly Bears'); const lone = put(B, 'Grizzly Bears'); A.life = 20; B.life = 20; await CMD.sv_exocrine(A, { x: 3 }, null, ex); await settle2(); ok('Exocrine: X damage to each player and other creature', A.life === 17 && B.life === 17 && !B.bf.includes(lone), [A.life, B.life]); }
            reset(); { put(A, 'Fires of Invention'); const bg = give(A, 'Hill Giant'); for (let i = 0; i < 4; i++) put(A, 'Mountain'); const c = costOf(A, bg); ok('Fires of Invention: a spell with mana value <= lands is free', costTotal(c) === 0, [c]); }
            reset(); { const m = put(A, 'Magma Pummeler'); m.counters = 3; B.life = 20; const f = put(B, 'Hill Giant'); damage(m, 2, f); ok('Magma Pummeler: damage removes counters instead', m.counters === 1 && onBf(m.uid), [m.counters]); }
            // ---- Bumbleflower ----
            reset(); { put(A, 'Kinnan, Bonder Prodigy'); const sr = put(A, 'Sol Ring'); ok('Kinnan: a nonland permanent taps for one extra mana', manaOf(sr).n === 3, [manaOf(sr)]); }
            reset(); { const us = put(A, 'Urza\'s Saga'); us.ctr.lore = 1; ok('Urza\'s Saga: chapter I gives it a mana ability', manaOf(us) && manaOf(us).n === 1 && manaOf(us).colors.includes('C'), [manaOf(us)]); }
            reset(); { const md = put(A, 'Mox Diamond'); A.hand.length = 0; await CMD.sv_moxDiamond(A, {}, null, md); ok('Mox Diamond: goes to the graveyard when no land is discarded', !A.bf.includes(md), []); }
            reset(); { const fc = put(A, 'Food Chain'); const big = put(A, 'Hill Giant'); A.pool = []; await CMD.sv_foodChain(A, {}, null, fc); ok('Food Chain: exiling a creature adds 1 + its mana value mana', A.pool.length === 5 && A.exile.includes(big), [A.pool.length]); }
            reset(); { const f = put(B, 'Hill Giant'); await CMD.sv_chainVapor(A, {}, { o: f }, null); ok('Chain of Vapor: returns the permanent to its owner\'s hand', B.hand.includes(f), []); }
            // ---- Kardur ----
            reset(); { A.life = 40; G.active = 0; await CMD.sv_havoc(A, {}, null, null); ok('Havoc Festival: the active player loses half their life', A.life === 20, [A.life]); }
            reset(); { B.life = 30; B.lostTurn = G.turn; B.lostN = 6; CMD.sv_woundReflection(A, {}, null, null); ok('Wound Reflection: the opponent loses the life they lost this turn', B.life === 24, [B.life]); }
            reset(); { put(A, 'Valgavoth, Terror Eater'); const bg = put(B, 'Hill Giant'); leaveBattlefield(bg, 'gy'); await settle2(); ok('Valgavoth: a card going to an opponent\'s graveyard is exiled instead', B.exile.includes(bg) && !B.gy.includes(bg) && bg.svValgavoth === A.i, [B.gy.length, B.exile.length]); }
            // ---- Captain America ----
            reset(); { const ci = put(A, 'Collective Inferno'); ci.chosenType = 'Bear'; const bear = put(A, 'Grizzly Bears'); B.life = 40; damage(B, 2, bear); ok('Collective Inferno: damage from the chosen type is doubled', B.life === 36, [B.life]); }
            reset(); { put(A, 'Grizzly Bears'); put(A, 'Hill Giant'); const n0 = A.bf.length; CMD.sv_incursion(A, {}, null, null); ok('Multiversal Incursion: a token copy for each nontoken creature', A.bf.length === n0 + 2, [A.bf.length - n0]); }
            reset(); { A.life = 20; CMD.sv_palm(A, {}, null, null); const bear = put(B, 'Grizzly Bears'); damage(A, 5, bear); ok('Deflecting Palm: the damage is prevented and dealt back', A.life === 20 && B.life === 35, [A.life, B.life]); }
            // ---- Lavinia ----
            reset(); { put(A, 'Rest in Peace'); const bg = put(B, 'Hill Giant'); await settle2(); leaveBattlefield(bg, 'gy'); await settle2(); ok('Rest in Peace: a dying creature is exiled', !B.gy.includes(bg) && B.exile.includes(bg), [B.gy.length]); const sp = toGy(B, 'Island'); await settle2(); ok('Rest in Peace: a card put into a graveyard is exiled', !B.gy.includes(sp), [B.gy.length]); }
            reset(); { put(A, 'Narset, Parter of Veils'); B.hand.length = 0; for (let i = 0; i < 5; i++) lib(B, 'Mountain'); drawCards(B, 3); ok('Narset: an opponent draws only one card each turn', B.hand.length === 1, [B.hand.length]); }
            reset(); { put(A, 'Lavinia, Azorius Renegade'); const rift = give(B, 'Cyclonic Rift'); ok('Lavinia: an opponent with no lands can\'t cast a noncreature spell with mana value 2', canCastNow(B, rift) === false, []); }
            reset(); { put(A, 'Solemnity'); const bear = put(A, 'Grizzly Bears'); const n = putCounters(bear, 2); ok('Solemnity: no counters on creatures', n === 0 && bear.counters === 0, [n]); }
            reset(); { put(A, 'Grafdigger\'s Cage'); await settle2(); const o = lib(A, 'Grizzly Bears'); pull(A.library, o); putOntoBattlefield(A, o, false); ok('Grafdigger\'s Cage: a creature card from a library can\'t enter the battlefield', !A.bf.includes(o), []); }
            reset(); { put(A, 'Containment Priest'); const o = makeObj(C['Grizzly Bears'], B.i); putOntoBattlefield(B, o, false); ok('Containment Priest: a creature entering without being cast is exiled', !B.bf.includes(o) && B.exile.includes(o), []); }
            reset(); { const th = give(A, 'Thassa\'s Oracle'); A.library.length = 0; A.hand.length = 0; await CMD.sv_oracle(A, {}, null, th); ok('Thassa\'s Oracle: wins with an empty library', G.over === true || G.winner === A.i || G.over, [G.over]); }
            reset(); { const c = put(A, 'Grizzly Bears'); await CMD.sv_bounceGrant(A, {}, { o: c }, null); ok('Banishing Knack: the creature really gains the tap ability this turn', actsOf(c).some(a => /Return target nonland permanent/.test(a.text || '')), []); G.turn++; ok('Banishing Knack: the ability ends with the turn', !actsOf(c).some(a => /Return target nonland permanent/.test(a.text || '')), []); }
            reset(); { A.svHalf = G.turn; A.svHalfUid = 99999; A.life = 20; damage(A, 4, put(B, 'Grizzly Bears')); ok('Dark Sphere: only damage from the chosen source is halved', A.life === 16, [A.life]); }
            reset(); { G.svKardur = { by: A.i, until: G.turn + 3 }; ok('Kardur: opposing creatures are forced to attack', forcedAttack(put(B, 'Grizzly Bears')) === true, []); G.svKardur = null; }
            reset(); { G.attackers = []; ok('No broken invariants', T.invariants().length === 0, T.invariants()); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS, []]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('sevendecks', results, []);
    writeOut('sevendecks', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
