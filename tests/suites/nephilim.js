// Nephilim changeling tribal deck (2026-11-19): behaviour checks for the new cards (rules/neph.js, 15zh-neph.js) and that the deck reads as fully Automated. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = ['nephilim-changeling'];
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Opt', 'Archaeomancer', 'Thran Dynamo', 'Sol Ring']);
DECKS.forEach(d => fs.readFileSync(path.join(ROOT, 'tests', 'decks', d + '.txt'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\d+ (.+)$/); if (m) NAMES.add(m[1]); }));

// Sickbay (Star Trek, released 2026-11-13) is newer than the offline card file, so its Scryfall entry is kept here
// Rush of Inspiration (a two-faced card) is newer than the offline card file, so its front face is kept here
const RUSH = {"id": "70a25a3a-c12a-49d3-8a91-a108dfa9d3c5", "name": "Rush of Inspiration", "mana_cost": "{1}{U/R}{U/R}", "cmc": 3.0, "type_line": "Instant", "oracle_text": "Draw two cards. Then discard a card at random unless you pay {E}{E} (two energy counters).", "power": null, "toughness": null, "colors": ["R", "U"], "color_identity": ["R", "U"], "layout": "normal", "rarity": "uncommon", "set": "mh3", "set_name": "Modern Horizons 3", "collector_number": "257", "released_at": "2024-06-14", "keywords": [], "legalities": {"standard": "not_legal", "future": "not_legal", "historic": "legal", "timeless": "legal", "gladiator": "legal", "pioneer": "not_legal", "modern": "legal", "legacy": "legal", "pauper": "not_legal", "vintage": "legal", "penny": "not_legal", "commander": "legal", "oathbreaker": "legal", "standardbrawl": "not_legal", "brawl": "legal", "competitivebrawl": "legal", "alchemy": "not_legal", "paupercommander": "not_legal", "duel": "legal", "oldschool": "not_legal", "premodern": "not_legal", "predh": "not_legal", "tlr": "legal"}};
const _UNUSED_SICKBAY = {"id": "05735357-3cca-42be-a3ae-5b4fc1fd5f47", "name": "Sickbay", "mana_cost": "{5}", "cmc": 5.0, "type_line": "Artifact", "oracle_text": "Whenever a creature you control enters, you gain 1 life.\nAt the beginning of combat on your turn, put X +1/+1 counters on target creature you control, where X is one plus the amount of life you gained this turn.", "power": null, "toughness": null, "colors": [], "color_identity": [], "layout": "normal", "rarity": "uncommon", "set": "trk", "set_name": "Star Trek", "collector_number": "268", "released_at": "2026-11-13", "keywords": [], "legalities": {"standard": "not_legal", "future": "legal", "historic": "not_legal", "timeless": "not_legal", "gladiator": "not_legal", "pioneer": "not_legal", "modern": "not_legal", "legacy": "not_legal", "pauper": "not_legal", "vintage": "not_legal", "penny": "not_legal", "commander": "not_legal", "oathbreaker": "not_legal", "standardbrawl": "not_legal", "brawl": "not_legal", "competitivebrawl": "not_legal", "alchemy": "not_legal", "paupercommander": "not_legal", "duel": "not_legal", "oldschool": "not_legal", "premodern": "not_legal", "predh": "not_legal", "tlr": "not_legal"}};
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
            ok('every nonland card of the deck reads as fully Automated', notFull.length === 0, notFull);
            const v = VERIFIED_DECKS.find(x => x.key === 'nephilim');
            ok('Nephilim deck is a preset', !!v, []);
            { const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck); ok('Nephilim deck: no deck problems', probs.length === 0, probs.slice(0, 3)); }
            reset(); { const ep = put(A, 'Nephilim Epochal'); const o2 = put(A, 'Dune-Brood Nephilim'); const w = put(A, 'Woodland Changeling'); await settle2();
              ok('Nephilim Epochal: each Nephilim gets +1/+1 for each other Nephilim (changelings count)', pow(ep) === (Number(ep.card.power) || 0) + 2, [pow(ep), Number(ep.card.power)]);
              const mono = put(B, 'Grizzly Bears'); ok('Nephilim Epochal: monocolored creatures can\'t block a Nephilim', canBlock(mono, o2) === false, []); }
            reset(); { const src = put(A, 'Nephilim Epochal'); A.library.length = 0; lib(A, 'Island'); lib(A, 'Glint-Eye Nephilim'); A.hand.length = 0; await CMD.nf_tutor(A, {}, null, src); ok('Nephilim Epochal: tutors a Nephilim card to hand', A.hand.some(c => c.card.name === 'Glint-Eye Nephilim'), [A.hand.length]); }
            reset(); { const ar = put(A, 'Archaeomancer'); toGy(A, 'Opt'); A.hand.length = 0; const fl = give(A, 'Flicker'); await CMD.nf_flicker(A, {}, null, fl); await settle2(); await settle2(); ok('Flicker: blinks a permanent with an enters trigger', A.bf.some(x => x.card.name === 'Archaeomancer'), [A.bf.length]); }
            reset(); { const c1 = put(A, 'Grizzly Bears'); const es = give(A, 'Echocasting Symposium'); const n0 = A.bf.length; await CMD.nf_echo(A, {}, null, es); ok('Echocasting Symposium: a token copy of the creature', A.bf.length === n0 + 1 && A.bf.filter(x => x.token && x.card.name === 'Grizzly Bears').length === 1, [A.bf.length]); }
            reset(); { const bear = put(A, 'Grizzly Bears'); const ll = give(A, 'Legion Leadership'); await CMD.nf_legion(A, {}, { o: bear }, ll); ok('Legion Leadership: doubles power and gives first strike', pow(bear) === 4 && bear.tkw.includes('first strike'), [pow(bear)]); }
            reset(); { const ley = put(A, 'Leyline of the Guildpact'); const bear = put(A, 'Grizzly Bears'); await settle2(); ok('Leyline of the Guildpact: nonland permanents are all colors', (bear.card.colors || []).length === 5, [bear.card.colors]); dieOrLeave(ley, 'gy'); await settle2(); ok('Leyline of the Guildpact: colors return when it leaves', (bear.card.colors || []).length !== 5, [bear.card.colors]); }
            reset(); { for (let i = 0; i < 6; i++) put(A, 'Forest'); const wt = put(A, 'The World Tree'); const f = A.bf.find(x => x.card.name === 'Forest'); await settle2(); const m = manaOf(f); ok('The World Tree: with six lands, lands tap for any color', m && m.colors.length === 5, [m && m.colors]); }
            reset(); { const w = put(A, 'Witch-Maw Nephilim'); w.counters = 20; await CMD.nf_witch(A, {}, null, w); ok('Witch-Maw Nephilim: trample with power 10 or more', w.tkw.includes('trample'), []); }
            reset(); { const y = put(A, 'Yore-Tiller Nephilim'); const dead = toGy(A, 'Grizzly Bears'); G.attackers = [y.uid]; await CMD.nf_yore(A, {}, null, y); ok('Yore-Tiller Nephilim: returns a creature tapped and attacking', A.bf.some(x => x.uid === dead.uid && x.tapped) && G.attackers.includes(dead.uid), []); }
            reset(); { const fg = put(A, 'Felidar Guardian'); const ar = put(A, 'Archaeomancer'); toGy(A, 'Opt'); await CMD.nf_blinkOwn(A, {}, null, fg); await settle2(); ok('Felidar Guardian: blinks another permanent', A.bf.some(x => x.card.name === 'Archaeomancer'), []); }
            reset(); { const oc = put(A, 'Orcrist, Goblin-cleaver'); put(A, 'Changeling Wayfinder'); put(A, 'Woodland Changeling'); const t0 = A.bf.filter(x => /Treasure/.test(x.card.name)).length; await CMD.nf_orcrist(A, {}, null, oc); await settle2(); ok('Orcrist: a Treasure for each creature of the chosen type', A.bf.filter(x => /Treasure/.test(x.card.name)).length - t0 === 2, [A.bf.filter(x => /Treasure/.test(x.card.name)).length]); }
            reset(); { const ov = put(A, 'Orvar, the All-Form'); const bear = put(A, 'Grizzly Bears'); const n0 = A.bf.filter(x => x.token).length; await CMD.nf_orvar(A, { uid: bear.uid }, null, ov); ok('Orvar: token copy of the targeted permanent', A.bf.filter(x => x.token && x.card.name === 'Grizzly Bears').length === 1, []); }
            reset(); { const ct = give(A, 'Chronicle of Victory'); ok('Chronicle of Victory: cast trigger for the chosen type reads', (Rx(ct).trig || []).some(x => x.ev === 'cast' && x.filter === 'chosenType'), []); }
            reset(); { const it = put(A, 'Ink-Treader Nephilim'); ok('Ink-Treader Nephilim reads', !!Rx(it).nfInk, []); }
            reset(); { G.attackers = []; ok('No broken invariants', T.invariants().length === 0, T.invariants()); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS, [RUSH]]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('nephilim', results, []);
    writeOut('nephilim', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
