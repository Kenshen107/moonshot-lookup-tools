// Hugh food and mana-rock deck (2026-11-04): behaviour checks for the new cards (rules/hughfood.js, 15s-hughfood.js) and that the deck reads as fully Automated. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = ['hugh-food'];
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Opt', 'Thran Dynamo']);
DECKS.forEach(d => fs.readFileSync(path.join(ROOT, 'tests', 'decks', d + '.txt'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\d+ (.+)$/); if (m) NAMES.add(m[1]); }));

// Sickbay (Star Trek, released 2026-11-13) is newer than the offline card file, so its Scryfall entry is kept here
const SICKBAY = {"id": "05735357-3cca-42be-a3ae-5b4fc1fd5f47", "name": "Sickbay", "mana_cost": "{5}", "cmc": 5.0, "type_line": "Artifact", "oracle_text": "Whenever a creature you control enters, you gain 1 life.\nAt the beginning of combat on your turn, put X +1/+1 counters on target creature you control, where X is one plus the amount of life you gained this turn.", "power": null, "toughness": null, "colors": [], "color_identity": [], "layout": "normal", "rarity": "uncommon", "set": "trk", "set_name": "Star Trek", "collector_number": "268", "released_at": "2026-11-13", "keywords": [], "legalities": {"standard": "not_legal", "future": "legal", "historic": "not_legal", "timeless": "not_legal", "gladiator": "not_legal", "pioneer": "not_legal", "modern": "not_legal", "legacy": "not_legal", "pauper": "not_legal", "vintage": "not_legal", "penny": "not_legal", "commander": "not_legal", "oathbreaker": "not_legal", "standardbrawl": "not_legal", "brawl": "not_legal", "competitivebrawl": "not_legal", "alchemy": "not_legal", "paupercommander": "not_legal", "duel": "not_legal", "oldschool": "not_legal", "premodern": "not_legal", "predh": "not_legal", "tlr": "not_legal"}};
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
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const missing = names.filter(n => !C[n] && !/^(Plains|Island|Swamp|Mountain|Forest)$/.test(n));
            ok('every card of the four decks is in the offline card file (' + missing.length + ' missing)', missing.length === 0, missing.slice(0, 8));
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
            await newGame(mk(), mk(), null, [mk()]);
            const [A, B] = G.players;
            const reset = () => {
                T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {}; G.endQ = []; G.extraCombat = 0; G.defender = 1; G.hgPrevArt = null; G.attackers = []; G.monarch = null;
                G.players.forEach(P => { P.isAI = true; P.aiLevel = 'normal'; P.aiStyle = null; P.tune = {}; P.life = 40; P.hand.length = 0; P.command.length = 0; P.gy.length = 0; P.exile.length = 0; P.pool = []; P.library.length = 0; for (let i = 0; i < 30; i++) P.library.push(makeObj(C['Island'], P.i)); });
            };
            const put = (P, n) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const toGy = (P, n) => { const o = makeObj(C[n], P.i); P.gy.push(o); return o; };
            const lib = (P, n) => { const o = makeObj(C[n], P.i); P.library.push(o); return o; };
            const settle2 = async () => { await settle(); await settle(); };

            const notFull = [];
            names.forEach(n => { const c = C[n]; if (c && rulesFor(c).kind !== 'land' && rulesFor(c).support !== 'full') notFull.push(n); });
            ok('every nonland card of the deck reads as fully Automated', notFull.length === 0, notFull);
            const v = VERIFIED_DECKS.find(x => x.key === 'hughfood');
            { const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck); ok('Hugh food deck: no deck problems', probs.length === 0, probs.slice(0, 3)); }


            reset(); { const b = put(A, 'Barbed Servitor'); CMD.hh_suspect(A, {}, null, b); ok('Barbed Servitor: suspected = menace and can\'t block', has(b, 'menace') && !canBlock(b, put(B, 'Grizzly Bears')), [has(b, 'menace')]); }
            reset(); { const x = put(B, 'Serra Angel'); const y = put(B, 'Sol Ring'); const z = put(A, 'Grizzly Bears'); const ex = give(A, 'Baral\'s Expertise'); G.curMulti = { list: [x, y, z] }; await CMD.hh_expertise(A, {}, null, ex); G.curMulti = null; await settle2();
              ok('Baral\'s Expertise: three targets return to hand', B.hand.some(o => o.card.name === 'Serra Angel') && B.hand.some(o => o.card.name === 'Sol Ring') && A.hand.some(o => o.card.name === 'Grizzly Bears') && !onBf(x.uid), [B.hand.length, A.hand.length]); }
            reset(); { const ce = put(A, 'Cosmos Elixir'); A.life = 41; const h0 = A.hand.length; A.library.push(makeObj(C['Island'], A.i)); CMD.hh_elixir(A, {}, null, ce); const drew = A.hand.length === h0 + 1;
              A.life = 30; CMD.hh_elixir(A, {}, null, ce); ok('Cosmos Elixir: draws above starting life, otherwise gains 2', drew && A.life === 32, [drew, A.life]); }
            reset(); { const bl = put(B, 'Grizzly Bears'); G.attackers = [bl.uid]; await CMD.hh_desculpt(A, {}, { o: bl }, put(A, 'Sol Ring')); await settle2();
              const drone = A.bf.find(o => /Drone/.test(o.card.name) || /Drone/.test(o.card.type)); ok('Desculpting Blast: bounces, and an attacker leaves a flying Drone that can block only fliers', B.hand.some(o => o.card.name === 'Grizzly Bears') && drone && has(drone, 'flying') && has(drone, 'blockflyonly') && /Artifact/.test(drone.card.type), [drone && drone.card.type, drone && [...Rx(drone).kw]]); }
            reset(); { const bl = put(B, 'Grizzly Bears'); G.attackers = []; await CMD.hh_desculpt(A, {}, { o: bl }, put(A, 'Sol Ring')); await settle2(); ok('Desculpting Blast: a non-attacker leaves no Drone', !A.bf.some(o => /Drone/.test(o.card.type)), A.bf.map(o => o.card.name)); }
            reset(); { const pz = put(A, 'Dimension X Pizzasaur'); const mine = put(A, 'Grizzly Bears'); const foe = put(B, 'Hill Giant'); await CMD.hh_pizza(A, {}, { o: mine }, pz); await settle2();
              ok('Dimension X Pizzasaur: two counters on the target, then destroys a creature with mana value up to the counters', mine.counters === 2 && !onBf(foe.uid), [mine.counters, onBf(foe.uid) ? 'alive' : 'dead']); }
            reset(); { const dr = put(A, 'Drafna, Founder of Lat-Nam'); const sr = makeObj(C['Sol Ring'], A.i); const item = { id: 9001, kind: 'spell', o: sr, P: A, target: null, name: 'Sol Ring' }; G.stack.push(item);
              const valid = validTargets(A, { t: 'cmd', target: 'spell', filter: 'hhArtifactMine' }, dr); const n0 = G.stack.length; CMD.hh_drafna(A, {}, { item }, dr);
              const foeSpell = { id: 9002, kind: 'spell', o: makeObj(C['Sol Ring'], B.i), P: B, target: null, name: 'Sol Ring' }; G.stack.push(foeSpell); const valid2 = validTargets(A, { t: 'cmd', target: 'spell', filter: 'hhArtifactMine' }, dr); G.stack.pop();
              ok('Drafna: copies your artifact spell; only your own artifact spells are targets', valid.some(x => x.item === item) && G.stack.length === n0 + 1 && !valid2.some(x => x.item === foeSpell), [valid.length, G.stack.length - n0, valid2.length]);
              const cp = G.stack[G.stack.length - 1]; G.stack.splice(G.stack.indexOf(item), 1); await resolveTop(); await settle2(); ok('Drafna: the copy resolves as a token', A.bf.some(o => o.card.name === 'Sol Ring' && o.token), A.bf.map(o => o.card.name + (o.token ? ' (token)' : ''))); }
            reset(); { const pan = put(A, 'Field-Tested Frying Pan'); await settle2(); const hal = A.bf.find(o => /Halfling/.test(o.card.name) || /Halfling/.test(o.card.type));
              ok('Frying Pan: a Food, a 1/1 Halfling, and the Equipment attached to it', A.bf.some(o => /Food/.test(o.card.type)) && hal && pan.attachedTo === hal.uid && pow(hal) === 1, [A.bf.map(o => o.card.type + ':' + o.uid), pan.attachedTo, hal && hal.uid]);
              G.ctxRaw = { n: 3 }; CMD.hh_panBoost(A, {}, null, pan); G.ctxRaw = null; ok('Frying Pan: the equipped creature gets +X/+X when you gain X life', pow(hal) === 4, pow(hal));
              ok('Frying Pan trigger only fires for the equipped creature\'s controller', TRIG_FN.hh_hostGains(pan, { P: A }) && !TRIG_FN.hh_hostGains(pan, { P: B }), []); }
            reset(); { put(B, 'God-Pharaoh\'s Statue'); const sr = makeObj(C['Sol Ring'], A.i); const base = totalCost ? totalCost(A, sr) : null; reset(); const sr2 = makeObj(C['Sol Ring'], A.i); const base2 = totalCost(A, sr2);
              put(A, 'God-Pharaoh\'s Statue'); const sr3 = makeObj(C['Sol Ring'], B.i); const taxed = spellTaxFor(B, sr3); const mine = spellTaxFor(A, sr2); ok('God-Pharaoh\'s Statue: opponents\' spells cost {2} more, yours do not', taxed === 2 && mine === 0, [taxed, mine]); }
            reset(); { const h = put(A, 'Hall of Tagsin'); CMD.hh_tappedStone(A, {}, null, h); const ps = A.bf.find(o => /Powerstone/.test(o.card.type)); ok('Hall of Tagsin: a tapped Powerstone token', ps && ps.tapped, A.bf.map(o => o.card.name)); }
            reset(); { const hh = put(A, 'Hidden Hideout'); const a1 = put(A, 'Grizzly Bears'); const a2 = put(A, 'Hill Giant'); a2.counters = 1; await CMD.hh_hideout(A, {}, null, hh); ok('Hidden Hideout: lifelink goes to a creature with a counter', has(a2, 'lifelink') && !has(a1, 'lifelink'), [has(a1, 'lifelink'), has(a2, 'lifelink')]); }
            reset(); { const it = put(A, 'Ivory Tower'); A.hand.length = 0; for (let i = 0; i < 7; i++) give(A, 'Mountain'); const l0 = A.life; CMD.hh_tower(A, {}, null, it); const up = A.life - l0; A.hand.length = 0; for (let i = 0; i < 3; i++) give(A, 'Mountain'); const l1 = A.life; CMD.hh_tower(A, {}, null, it);
              ok('Ivory Tower: gains cards in hand minus 4 (never negative)', up === 3 && A.life === l1, [up, A.life - l1]); }
            reset(); { const lb = toGy(A, 'Lembas'); CMD.hh_lembas(A, {}, null, lb); ok('Lembas: shuffled into its owner\'s library', !A.gy.includes(lb) && A.library.includes(lb), [A.gy.length]);
              const lb2 = put(A, 'Lembas'); dieOrLeave(lb2, 'gy'); await settle2(); ok('Lembas: dying from the battlefield triggers the shuffle', A.library.some(o => o.card.name === 'Lembas') && !A.gy.some(o => o.card.name === 'Lembas'), [A.gy.map(o => o.card.name)]); }
            reset(); { put(B, 'Norn\'s Annex'); const atk = put(A, 'Grizzly Bears'); const atk2 = put(A, 'Hill Giant'); A.life = 20; put(A, 'Plains'); const life0 = A.life; declareAttackers(A, [atk, atk2]); await settle2();
              ok('Norn\'s Annex: each attacker costs {W} or 2 life', G.attackers.length === 2 && (life0 - A.life) === 2, [G.attackers.length, life0 - A.life]); }
            reset(); { put(B, 'Norn\'s Annex'); const atk = put(A, 'Grizzly Bears'); A.life = 5; declareAttackers(A, [atk]); ok('Norn\'s Annex: a player at low life with no {W} cannot attack', G.attackers.length === 0 && A.life === 5, [G.attackers.length, A.life]); }
            reset(); { const pp = put(A, 'Paradise Plume'); pp.chosenColor = 'R'; const m = manaOf(pp); ok('Paradise Plume: taps for the chosen color', m && m.colors.length === 1 && m.colors[0] === 'R', m);
              const bolt = makeObj(C['Lightning Bolt'], B.i); const tr = Rx(pp).trig.find(x => x.ev === 'cast'); ok('Paradise Plume: triggers on any player\'s spell of the chosen color', !!tr && tr.who === 'any' && tr.filter === 'chosenColor', tr); }
            reset(); { const s1 = put(A, 'Powerstone Shard'); const m1 = manaOf(s1); const s2 = put(A, 'Powerstone Shard'); const m2 = manaOf(s1); ok('Powerstone Shard: adds {C} for each Shard you control', m1.n === 1 && m2.n === 2, [m1.n, m2.n]); }
            reset(); { const sb = put(A, 'Sickbay'); const bear = put(A, 'Grizzly Bears'); A.gainedTurn = G.turn; A.gainedAmt = 4; await CMD.hh_sickbay(A, {}, null, sb); ok('Sickbay: one plus the life gained this turn in counters', bear.counters === 5, bear.counters); }
            reset(); { const sr = put(A, 'Skyclave Relic'); sr.kicked = true; CMD.hh_relic(A, {}, null, sr); const copies = A.bf.filter(o => o.card.name === 'Skyclave Relic' && o.token); const sr2 = put(A, 'Skyclave Relic'); const n0 = A.bf.length; CMD.hh_relic(A, {}, null, sr2);
              ok('Skyclave Relic: kicked makes two tapped token copies, unkicked none', copies.length === 2 && copies.every(o => o.tapped) && A.bf.length === n0, [copies.length, A.bf.length - n0]); }
            reset(); { const ss = put(A, 'Spectrum Sentinel'); const multi = makeObj(C['Serra Angel'], B.i); multi.card = { ...multi.card, colors: ['W', 'U'] }; ok('Spectrum Sentinel: protection from multicolored', has(ss, 'pro:multicolored') && protFrom(ss, multi), [...Rx(ss).kw]);
              const land = put(B, 'Exotic Orchard'); const basic = put(B, 'Mountain'); ok('Spectrum Sentinel: triggers on nonbasic opposing lands only', TRIG_FN.hh_oppNonbasic(ss, { o: land }) && !TRIG_FN.hh_oppNonbasic(ss, { o: basic }) && !TRIG_FN.hh_oppNonbasic(ss, { o: put(A, 'Exotic Orchard') }), []); }
            reset(); { const sp = put(A, 'Sphinx of the Revelation'); G.ctxRaw = { n: 4 }; CMD.hh_sphinx(A, {}, null, sp); G.ctxRaw = null; ok('Sphinx of the Revelation: gets that many energy', A.energy === 4, A.energy);
              A.energy = 3; const r = Rx(sp); ok('Sphinx of the Revelation: its draw ability reads', (r.acts || []).length >= 1, (r.acts || []).length); }
            reset(); { G.attackers = []; ok('No broken invariants', T.invariants().length === 0, T.invariants()); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS, [SICKBAY]]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('hughfood', results, []);
    writeOut('hughfood', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
