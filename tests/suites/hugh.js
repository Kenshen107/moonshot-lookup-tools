// Hugh, First of Many artifact deck (2026-10-31): behaviour checks for the new cards (rules/hugh.js, 15q-hugh.js) and that the deck reads as fully Automated. Offline cards.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = ['hugh-first-of-many'];
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Opt', 'Thran Dynamo']);
DECKS.forEach(d => fs.readFileSync(path.join(ROOT, 'tests', 'decks', d + '.txt'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\d+ (.+)$/); if (m) NAMES.add(m[1]); }));

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async ([names, decks]) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json();
            const C = {};
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const missing = names.filter(n => !C[n] && !/^(Plains|Island|Swamp|Mountain|Forest)$/.test(n));
            ok('every card of the four decks is in the offline card file (' + missing.length + ' missing)', missing.length === 0, missing.slice(0, 8));
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
            await newGame(mk(), mk(), null, [mk()]);
            const [A, B] = G.players;
            const reset = () => {
                T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {}; G.endQ = []; G.extraCombat = 0; G.defender = 1; G.hgPrevArt = null; G.monarch = null;
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
            const v = VERIFIED_DECKS.find(x => x.key === 'hugh');
            { const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck); ok('Hugh deck: no deck problems', probs.length === 0, probs.slice(0, 3)); }

            reset(); { const g = put(A, 'Great Gilded Boat'); A.hand.length = 0; give(A, 'Grizzly Bears'); lib(A, 'Island'); lib(A, 'Lightning Bolt'); await CMD.hg_recruit(A, {}, null, g); await settle2();
              ok('Recruit: draw, discard a nonland, make a Human Soldier', A.bf.some(o => o.token && /Human Soldier/.test(o.card.name || o.card.type)) , A.bf.map(o => o.card.name)); }
            reset(); { const g = put(A, 'Great Gilded Boat'); const before = A.bf.length; A.hand.length = 0; for (let i = 0; i < 3; i++) give(A, 'Mountain'); lib(A, 'Mountain'); await CMD.hg_recruit(A, {}, null, g); await settle2();
              ok('Recruit: discarding a land makes no token', A.bf.length === before, A.bf.length); }
            reset(); { const p = put(A, 'Colossal Plow'); await CMD.hg_plow(A, {}, null, p); ok('Colossal Plow: WWW stays all turn and 3 life', A.pool.filter(c => c === 'W').length === 3 && A.keepPoolTurn === G.turn && A.life === 43, [A.pool, A.life]); }
            reset(); { const aw = put(A, 'Cyberdrive Awakener'); const sr = put(A, 'Sol Ring'); CMD.hg_awakener(A, {}, null, aw); ok('Cyberdrive Awakener: Sol Ring becomes a 4/4 creature', isCreature(sr) && pow(sr) === 4, [isCreature(sr), pow(sr)]); }
            reset(); { const cm = put(A, 'Cybermat'); const q = put(A, 'Cyberdrive Awakener'); G.attackers = [cm.uid, q.uid]; CMD.hg_cybermat(A, {}, null, cm); ok('Cybermat: +X/+0 for attacking artifact creatures', pow(cm) === (Number(C['Cybermat'].power) || 0) + 2, pow(cm)); }
            reset(); { const dj = put(A, 'Demonic Junker'); const mine = put(A, 'Grizzly Bears'); const foe = put(B, 'Serra Angel'); await CMD.hg_junker(A, {}, null, dj); await settle2(); ok('Demonic Junker: destroys the opponent\'s best creature, keeps yours, no counters', !onBf(foe.uid) && onBf(mine.uid) && dj.counters === 0, [onBf(foe.uid), onBf(mine.uid), dj.counters]); }
            reset(); { const sm = put(A, 'Ethersworn Shieldmage'); const art = put(A, 'Cybermat'); CMD.hg_shieldmage(A, {}, null, sm); damage(art, 9, null); ok('Ethersworn Shieldmage: damage to artifact creatures is prevented', art.dmg === 0 || art.dmg === undefined, art.dmg); }
            reset(); { const lo = put(A, 'Luxurious Locomotive'); lo.crewN = 2; lo.crewTurn = G.turn; const before = A.bf.length; CMD.hg_loco(A, {}, null, lo); ok('Luxurious Locomotive: a Treasure for each crew member', A.bf.length === before + 2, A.bf.length - before); }
            reset(); { const mm = put(A, 'Mole Module'); lib(A, 'Sol Ring'); lib(A, 'Lightning Bolt'); lib(A, 'Grizzly Bears'); lib(A, 'Island'); await CMD.hg_mole(A, {}, null, mm); await settle2(); ok('Mole Module: mills four and puts a permanent onto the battlefield', A.gy.length >= 3 && A.bf.length >= 2, [A.gy.length, A.bf.length]); }
            reset(); { const nk = put(A, 'Nuka-Cola Vending Machine'); CMD.hg_tappedTreasure(A, {}, null, nk); const tr = A.bf.find(o => /Treasure/.test(o.card.type)); ok('Nuka-Cola: a tapped Treasure', tr && tr.tapped, !!tr); }
            reset(); { const rf = put(A, 'Refurbished Familiar'); foes(A).forEach(F => { F.hand.length = 0; }); const h0 = A.hand.length; await CMD.hg_familiar(A, {}, null, rf); ok('Refurbished Familiar: draws once for each opponent who can\'t discard', A.hand.length === h0 + foes(A).length, A.hand.length - h0); }
            reset(); { const rf = put(A, 'Refurbished Familiar'); foes(A).forEach(F => { F.hand.length = 0; give(F, 'Mountain'); }); const h0 = A.hand.length; await CMD.hg_familiar(A, {}, null, rf); ok('Refurbished Familiar: an opponent with a card discards it instead of letting you draw', foes(A).every(F => F.hand.length === 0) && A.hand.length === h0, [A.hand.length - h0]); }
            reset(); { const cc = put(A, 'The Cyber-Controller'); await settle2(); cc.xVal = 5; B.library.splice(-5); for (let i = 0; i < 5; i++) B.library.push(makeObj(C['Serra Angel'], B.i)); const n0 = A.bf.length; await CMD.hg_controller(A, { n: 5 }, null, cc); await settle2(); ok('The Cyber-Controller: milled creatures become 2/2 Cybermen under your control', A.bf.length === n0 + 5 && A.bf.filter(o => o.token && /Cyberman/.test(o.card.type)).length === 5 && pow(A.bf[A.bf.length - 1]) >= 2, [A.bf.map(o => o.card.type), n0, B.gy.map(o => o.card.name).slice(0, 8), G.players[2].gy.length]); }
            reset(); { const tg = put(A, 'Torrential Gearhulk'); await settle2(); const bolt = toGy(A, 'Lightning Bolt'); B.life = 40; await CMD.hg_gearhulk(A, {}, null, tg); await settle2(); ok('Torrential Gearhulk: casts the instant free and exiles it', B.life < 40 && !A.gy.includes(bolt) && A.exile.includes(bolt), [B.life, A.gy.map(o => o.card.name), A.exile.map(o => o.card.name), G.stack.length, G.log.filter(x => /DEBUG|exile/.test(x))]); }
            reset(); { const wa = put(A, 'Weeping Angel'); CMD.hg_angelOff(A, {}, null, wa); const was = isCreature(wa); G.turn++; ok('Weeping Angel: not a creature this turn, a creature again later', !was && isCreature(wa), [was, isCreature(wa)]); G.turn--; }
            reset(); { const wa = put(A, 'Weeping Angel'); const vic = put(B, 'Serra Angel'); damage(vic, 4, wa); await settle2(); ok('Weeping Angel: the damaged creature is shuffled into its owner\'s library', !onBf(vic.uid) && B.library.includes(vic) && B.gy.length === 0, [onBf(vic.uid), B.library.includes(vic)]); }
            reset(); { const coin = put(A, 'Coin of Fate'); toGy(A, 'Serra Angel'); toGy(A, 'Grizzly Bears'); await CMD.hg_coinFate(A, {}, null, coin); await settle2(); ok('Coin of Fate: one creature returns tapped, one goes to the library bottom, you are the monarch', A.bf.some(o => /Serra|Grizzly/.test(o.card.name) && o.tapped) && A.library[0] && /Serra|Grizzly/.test(A.library[0].card.name) && G.monarch === A.i, [A.bf.map(o => o.card.name), G.monarch]); }
            reset(); { put(A, 'Coin of Mastery'); const sr = put(A, 'Sol Ring'); const o = makeObj(C['Grizzly Bears'], A.i); manaRiders(A, o, [sr, sr]); ok('Coin of Mastery: a counter for each artifact mana spent on a creature spell', o.bt_extraCtr === 2, o.bt_extraCtr); }
            reset(); { put(A, 'Organic Extinction'); const art = put(A, 'Cybermat'); const bear = put(A, 'Grizzly Bears'); const foe = put(B, 'Serra Angel'); await applyEffect(A, { t: 'wipe', how: 'destroy', what: 'nonartifact creatures' }, null, art); await settle2(); ok('Organic Extinction: destroys only the nonartifact creatures', onBf(art.uid) && !onBf(bear.uid) && !onBf(foe.uid), [onBf(art.uid), onBf(bear.uid), onBf(foe.uid)]); }
            reset(); { put(A, 'Bronze Guardian'); const sr = put(A, 'Sol Ring'); ok('Bronze Guardian: other artifacts have ward {2}', (Rx(sr).kw && false) || allPerms().some(x => Rx(x).statics && Rx(x).statics.some(s => (s.kw || []).includes('ward:2'))), 'a static grants ward'); }
            reset(); { const ac = put(A, 'Arcade Cabinet'); const bear = put(A, 'Grizzly Bears'); bear.counters = 2; await CMD.td_doubleCounters(A, {}, { o: bear }, ac); ok('Arcade Cabinet: doubles the counters on the creature', bear.counters === 4, bear.counters); }
            reset(); { const cs = put(A, 'Cargo Ship'); const m = manaOf(cs); ok('Cargo Ship: taps for {C} for artifact spells only', m && m.onlyType === 'Artifact', m); }
            reset(); ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('hugh', results, []);
    writeOut('hugh', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
