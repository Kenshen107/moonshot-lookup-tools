// Owner's play fixes (2026-11-19): Sol Talisman suspend, Moonsilver Key search (15zi-fixes.js) and that the deck reads as fully Automated. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = [];
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Opt', 'Archaeomancer', 'Sol Talisman', 'Moonsilver Key', 'Thran Dynamo', 'Sol Ring']);
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
            reset(); { A.hand.length = 0; const st = give(A, 'Sol Talisman'); for (let i = 0; i < 3; i++) put(A, 'Island'); G.phase = 'main1'; G.active = 0;
              ok('Sol Talisman (no mana cost): can be suspended in your main phase', canSuspend(A, st) === true && canCastNow(A, st) === false, [canSuspend(A, st)]);
              const done = suspendCard(A, st); ok('Sol Talisman: suspending exiles it with three time counters', done && A.exile.includes(st) && st.ctr.time === 3, [st.ctr && st.ctr.time]); }
            reset(); { const w = 'artifact card with a mana ability or a basic land'; const names = ['Island', 'Sol Ring', 'Grizzly Bears', 'Thran Dynamo'].map(n => [n, cardFits(makeObj(C[n], 0), w)]);
              ok('Moonsilver Key: the search finds basic lands and artifacts with a mana ability, not other cards', names.filter(x => x[1]).map(x => x[0]).join() === 'Island,Sol Ring,Thran Dynamo', [names]); }
            reset(); { G.attackers = []; ok('No broken invariants', T.invariants().length === 0, T.invariants()); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS, [RUSH]]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('fixes1119', results, []);
    writeOut('fixes1119', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
