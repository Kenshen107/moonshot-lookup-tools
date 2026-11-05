// Astonishing Spider-Man discard deck (2026-11-05): behaviour checks for the new cards (rules/spiderman.js, 15t-spiderman.js) and that the deck reads as fully Automated. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = ['astonishing-spider-man'];
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Opt', 'Thran Dynamo', 'Sol Ring']);
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
            const v = VERIFIED_DECKS.find(x => x.key === 'spiderman');
            { const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck); ok('Spider-Man deck: no deck problems', probs.length === 0, probs.slice(0, 3)); }



            reset(); { const sp = put(A, 'Astonishing Spider-Man'); A.hand.length = 0; for (let i = 0; i < 3; i++) give(A, 'Mountain'); for (let i = 0; i < 10; i++) lib(A, 'Island'); G.attackers = [sp.uid]; await CMD.hs_wheelAttack(A, {}, null, sp); await settle2();
              ok('Astonishing Spider-Man: discards the hand and draws that many', A.hand.length === 3 && A.gy.filter(c => c.card.name === 'Mountain').length === 3, [A.hand.length, A.gy.length]); }
            reset(); { A.hand.length = 0; for (let i = 0; i < 3; i++) give(A, 'Mountain'); A.discardTurn = G.turn; A.discardN = 2; await CMD.hs_wheelMine(A, {}, null, null);
              ok('Change of Fortune: draws for every card discarded this turn (earlier ones count)', A.hand.length === 5, A.hand.length); }
            reset(); { const mk = put(A, 'Marauding Mako'); const sk = put(A, 'Scrounging Skyray'); const gb = put(A, 'Glint-Horn Buccaneer'); const ar = put(A, 'Magmakin Artillerist'); const mr = put(A, 'Mystic Redaction'); const ivo = put(A, 'Ivora, Insatiable Heir'); await settle2();
              B.life = 40; const lb = B.library.length; A.hand.length = 0; give(A, 'Mountain'); give(A, 'Mountain'); await CMD.hs_wheelMine(A, {}, null, null); await settle2(); await settle2();
              ok('Discard payoffs: Mako and Skyray get a counter per card', mk.counters === 2 && sk.counters === 2, [mk.counters, sk.counters]);
              ok('Discard payoffs: Glint-Horn (1) and Artillerist (1) each hit the opponent per card', B.life === 40 - 2 - 2, B.life);
              ok('Discard payoffs: Mystic Redaction mills two per card and Ivora gets counters', lb - B.library.length === 4 && ivo.counters === 2, [lb - B.library.length, ivo.counters]); }
            reset(); { const sm = put(A, 'Spider-Man, New Champion'); B.life = 40; const fl = put(A, 'Flameblade Adept'); A.hand.length = 0; give(A, 'Mountain'); await CMD.hs_wheelMine(A, {}, null, null); await settle2(); await settle2();
              ok('Spider-Man, New Champion and Flameblade Adept react to a discard', pow(fl) === (Number(fl.card.power) || 0) + 1 && (B.life === 39 || A.life === 39 || G.players.some(X => X.bf.some(o => o.dmg > 0))), [pow(fl), B.life]); }
            reset(); { const ch = put(A, 'Captain Howler, Sea Scourge'); const bear = put(A, 'Grizzly Bears'); await CMD.hs_howler(A, {}, { o: bear }, ch); const h0 = A.hand.length; fire('hitPlayer', { src: bear, n: 2, hit: [B] }); ok('Captain Howler: +2/+0 and a card when the creature hits a player', pow(bear) === 4 && A.hand.length === h0 + 1, [pow(bear), A.hand.length - h0]);
              ok('Captain Howler: ward {2} and 2 life', Rx(ch).ward === 2 && Rx(ch).wardBothLife === 2, [Rx(ch).ward, Rx(ch).wardBothLife]); }
            reset(); { A.hand.length = 0; A.energy = 0; for (let i = 0; i < 6; i++) lib(A, 'Island'); give(A, 'Mountain'); const rc = give(A, 'Rush of Inspiration'); await CMD.hs_rush(A, {}, null, rc); ok('Rush of Inspiration: draws two, then discards one at random without {E}{E}', A.hand.length === 3 && A.gy.length === 1, [A.hand.length, A.gy.length]); }
            reset(); { A.hand.length = 0; A.energy = 2; for (let i = 0; i < 6; i++) lib(A, 'Island'); const rc = give(A, 'Rush of Inspiration'); await CMD.hs_rush(A, {}, null, rc); ok('Rush of Inspiration: paying {E}{E} keeps both cards', A.hand.length === 3 && A.energy === 0, [A.hand.length, A.energy]); }
            reset(); { const md = give(A, 'Memory Deluge'); md.manaSpent = 4; A.library.length = 0; ['Island', 'Mountain', 'Sol Ring', 'Lightning Bolt', 'Island', 'Island'].forEach(n => lib(A, n)); A.hand.length = 0; await CMD.hs_deluge(A, {}, null, md); ok('Memory Deluge: two of the top four to hand, the rest to the bottom', A.hand.length === 2 && A.library.length === 4, [A.hand.length, A.library.length]); }
            reset(); { const fb = put(A, 'Flame Blitz'); ok('Flame Blitz reads (end step damage to planeswalkers)', (Rx(fb).trig || []).some(x => x.ev === 'end'), []); }
            reset(); { const it = give(A, 'Imaginary Threats'); const g = put(B, 'Grizzly Bears'); g.tapped = true; await CMD.hs_threats(A, {}, { p: B }, it); ok('Imaginary Threats: must attack and won\'t untap', g.mustAttackTurn === G.turn && g.skipUntap === true, [g.mustAttackTurn, g.skipUntap]); }
            reset(); { const os = put(A, 'Ominous Seas'); for (let i = 0; i < 8; i++) await CMD.hs_seas(A, {}, null, os); const ac = (Rx(os).acts || []).find(a => a.cost && a.cost.removeNamedN); ok('Ominous Seas: counts up to 8 and has the Kraken ability', os.ctr.foreshadow === 8 && !!ac, [os.ctr.foreshadow, !!ac]); }
            reset(); { const ub = put(A, 'Underworld Breach'); const bolt = toGy(A, 'Lightning Bolt'); const land = toGy(A, 'Mountain'); await settle2(); ok('Underworld Breach: nonland cards in the graveyard get escape, lands do not, and it ends when Breach leaves', !!Rx(bolt).escape && Rx(bolt).escape.n === 3 && !Rx(land).escape, [!!Rx(bolt).escape, !!Rx(land).escape]);
              dieOrLeave(ub, 'gy'); await settle2(); ok('Underworld Breach: the grant is removed once it leaves', !Rx(bolt).escape, [!!Rx(bolt).escape]); }
            reset(); { const cr = give(A, 'Mirrorshell Crab'); ok('Mirrorshell Crab: has an ability usable from the hand', (Rx(cr).handActs || []).length === 1, [(Rx(cr).handActs || []).length]); }
            reset(); { const nb = give(A, 'Nimble Obstructionist'); ok('Nimble Obstructionist: cycling trigger counters an ability', !!Rx(nb).cycleTrig && Rx(nb).cycleTrig[0].t === 'counter', [Rx(nb).cycleTrig]); }
            reset(); { const pp = give(A, 'Path of the Pyromancer'); A.hand.length = 0; give(A, 'Mountain'); give(A, 'Mountain'); for (let i = 0; i < 6; i++) lib(A, 'Island'); await CMD.hs_pyromancer(A, {}, null, pp); ok('Path of the Pyromancer: {R} for each discarded and draws that many plus one', A.pool.filter(c => c === 'R').length === 2 && A.hand.length === 3, [A.pool, A.hand.length]); }
            reset(); { G.attackers = []; ok('No broken invariants', T.invariants().length === 0, T.invariants()); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS, [RUSH]]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('spiderman', results, []);
    writeOut('spiderman', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
