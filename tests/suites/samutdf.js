// Samut, the Driving Force deck (2026-10-27): behavior checks for rules/samutdf.js and 15n-samutdf.js.
// Card data comes live from Scryfall; the list is tests/decks/samut-driving-force.txt.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const NAMES = [...new Set(fs.readFileSync(path.join(ROOT, 'tests', 'decks', 'samut-driving-force.txt'), 'utf8').split('\n').map(l => l.replace(/^\d+\s+/, '').trim()).filter(Boolean))];
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async NAMES => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards([...NAMES, 'Shivan Dragon', 'Vnwxt, Verbose Host', 'Hill Giant', 'Grizzly Bears', 'Island', 'Plains', 'Forest', 'Lightning Bolt', 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Sol Ring', 'Lightning Bolt', 'Counterspell', 'Divination', 'Shock', 'Treasure Map', 'Giant Growth', 'Ancestral Recall', 'Dark Ritual', 'Goblin Guide', 'Shivan Dragon', 'Air Elemental', 'Wall of Omens', 'Bear Cub', 'Ornithopter', 'Black Lotus', 'Cultivate', 'Island', 'Terror', 'Doom Blade', 'Rhystic Study', 'Mind Stone', 'Furnace Whelp', 'Wall of Omens']);
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
            const loseOpp = (B, n) => { B.life -= n; fire('loseLife', { P: B, n }); };
            // speed
            { const [A, B] = await fresh(); ok('speed starts at 0', !A.speed, A.speed);
              const h = put(A, 'Hazoret, Godseeker'); await settle2(); ok('Start your engines!: entering sets speed to 1', A.speed === 1, A.speed);
              loseOpp(B, 1); ok('speed rises to 2 when an opponent loses life on your turn', A.speed === 2, A.speed);
              loseOpp(B, 1); ok('speed rises only once per turn', A.speed === 2, A.speed);
              G.turn++; loseOpp(B, 1); G.turn++; loseOpp(B, 1); ok('speed stops at 4 (max speed)', A.speed === 4, A.speed);
              G.turn++; loseOpp(B, 1); ok('speed never goes past 4', A.speed === 4, A.speed); }
            // Samut: other creatures get +X/+0
            { const [A] = await fresh(); const s = put(A, 'Samut, the Driving Force'); const g = put(A, 'Grizzly Bears'); A.speed = 3; ok('Samut: other creatures get +X/+0 where X is speed', pow(g) === 5 && pow(s) === Number(s.card.power), [pow(g), pow(s)]);
              A.speed = 0; ok('Samut: no bonus at speed 0', pow(g) === 2, pow(g)); }
            // Samut: noncreature spells cost X less
            { const [A] = await fresh(); put(A, 'Samut, the Driving Force'); A.speed = 2; const sp = inHand(A, 'Congregate'); const base = Rx(sp).cost; ok('Samut: noncreature spells cost {X} less (speed 2)', costOf(A, sp) !== undefined && totalCost(A, sp).generic === Math.max(0, (parseCost(sp.card.cost).generic || 0) - 2), [totalCost(A, sp)]); }
            // Hazoret
            { const [A] = await fresh(); const h = put(A, 'Hazoret, Godseeker'); h.sick = false; A.speed = 1; ok('Hazoret: cannot attack below max speed', !canAttackWith(h), 0); A.speed = 4; ok('Hazoret: can attack at max speed', canAttackWith(h), 0); }
            // Racers' Scoreboard: max speed only
            { const [A] = await fresh(); put(A, "Racers' Scoreboard"); const g = inHand(A, 'Grizzly Bears'); const c0 = totalCost(A, g); A.speed = 4; const c1 = totalCost(A, g); ok("Racers' Scoreboard: spells cost {1} less only at max speed", c1.generic === c0.generic - 1, [c0, c1]); }
            // Burnout Bashtronaut: double strike at max speed
            { const [A] = await fresh(); const b = put(A, 'Burnout Bashtronaut'); ok('Burnout Bashtronaut: no double strike below max speed', !has(b, 'double strike'), 0); A.speed = 4; ok('Burnout Bashtronaut: double strike at max speed', has(b, 'double strike'), 0); }
            // Angelic Sell-Sword
            { const [A] = await fresh(); const a = put(A, 'Angelic Sell-Sword'); a.sick = false; a.counters = 6; const n = A.hand.length; A.library.push(makeObj(have('Plains'), 0)); await atk(a); ok('Angelic Sell-Sword: draws when it attacks with power 6+', A.hand.length === n + 1, [A.hand.length, n]); }
            { const [A] = await fresh(); const a = put(A, 'Angelic Sell-Sword'); a.sick = false; const n = A.hand.length; await atk(a); ok('Angelic Sell-Sword: no draw below power 6', A.hand.length === n, 0); }
            // Decree of Savagery cycling
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); const d = inHand(A, 'Decree of Savagery'); ok('Decree of Savagery: has a cycle trigger', !!Rx(d).cycleTrig, 0); }
            // Elixir
            { const [A] = await fresh(); inGy(A, 'Hill Giant'); inGy(A, 'Grizzly Bears'); inGy(A, 'Plains'); const life = A.life, lib = A.library.length; await CMD.sd_elixir(A); ok('Elixir: nonland cards shuffle into the library, gain that much life', A.gy.length === 1 && A.library.length === lib + 2 && A.life === life + 2, [A.gy.length, A.library.length - lib, A.life - life]); }
            // Gogo
            { const [A] = await fresh(); const g = put(A, 'Gogo, Mysterious Mime'); g.sick = false; const d = put(A, 'Shivan Dragon'); d.sick = false; fire('combat'); await settle2();
              ok('Gogo: becomes a copy of another creature, keeps its name', g.card.name.startsWith('Gogo') && has(g, 'flying') && pow(g) === 7, [g.card.name, pow(g)]);
              ok('Gogo: the other creature gets +2/+0 and both must attack', pow(d) === 7 && g.mustAttackTurn === G.turn && d.mustAttackTurn === G.turn, [pow(d)]); }
            // Howlsquad Heavy
            { const [A] = await fresh(); put(A, 'Howlsquad Heavy'); fire('combat'); await settle2(); const gob = nm(A, 'Goblin token'); ok('Howlsquad Heavy: makes a Goblin that must attack', gob.length === 1 && gob[0].mustAttackTurn === G.turn, gob.length); }
            // Hulkling
            { const [A] = await fresh(); const h = put(A, 'Hulkling, Young Avenger'); const d = put(A, 'Shivan Dragon'); const s = inHand(A, 'Congregate'); fire('cast', { P: A, o: s }); await settle2();
              ok('Hulkling: a noncreature spell makes it a 4/4 flier copy', h.card.name.startsWith('Hulkling') && pow(h) === 4 && tou(h) === 4 && has(h, 'flying'), [h.card.name, pow(h), tou(h)]); }
            // Oviya
            { const [A] = await fresh(); const o = put(A, 'Oviya, Automech Artisan'); o.sick = false; const r = inHand(A, 'Rolling Hamsphere'); const g = inHand(A, 'Grizzly Bears'); await CMD.sd_oviya(A, {}, {}, o); await settle2();
              ok('Oviya: puts a creature or Vehicle card from hand onto the battlefield', A.hand.length === 1 && A.bf.filter(x => x.card.name === 'Grizzly Bears' || x.card.name === 'Rolling Hamsphere').length === 1, A.hand.length); }
            // Oviya: trample for attackers
            { const [A, B] = await fresh(); put(A, 'Oviya, Automech Artisan'); const g = put(A, 'Grizzly Bears'); g.sick = false; G.attackers = [g.uid]; ok('Oviya: attacking creatures have trample', has(g, 'trample'), 0); G.attackers = []; ok('Oviya: not when not attacking', !has(g, 'trample'), 0); }
            // Parhelion II
            { const [A] = await fresh(); const p = put(A, 'Parhelion II'); p.sick = false; await atk(p); const an = A.bf.filter(x => /Angel/.test(x.card.name)); ok('Parhelion II: two attacking 4/4 Angel tokens', an.length === 2 && an.every(x => pow(x) === 4 && G.attackers.includes(x.uid)), an.length); }
            // Point the Way
            { const [A] = await fresh(); A.speed = 3; for (let i = 0; i < 4; i++) A.library.push(makeObj(have('Forest'), 0)); const pw = put(A, 'Point the Way'); lands(A, 4, 'Forest'); const n = A.bf.filter(x => /Basic Land/.test(x.card.type)).length; await activate(A, pw, acts(pw)[0]); await settle2(); ok('Point the Way: fetches X basic lands, X = speed', A.bf.filter(x => /Basic Land/.test(x.card.type)).length === n + 3, A.bf.filter(x => /Basic Land/.test(x.card.type)).length - n); }
            // Threefold Thunderhulk
            { const [A] = await fresh(); const th = inHand(A, 'Threefold Thunderhulk'); pull(A.hand, th); G.stack.push({ P: A, o: th, kind: 'spell' }); await resolveTop(); await settle2(); const gn = A.bf.filter(x => x.token && /Gnome/.test(x.card.name + x.card.type)); ok('Threefold Thunderhulk: Gnome tokens equal to its power on entering', gn.length === pow(th) && gn.length > 0, [gn.length, pow(th)]); }
            // We Ride at Dawn
            { const [A] = await fresh(); put(A, 'We Ride at Dawn'); const l = inHand(A, 'Adeline, Resplendent Cathar'); ok('We Ride at Dawn: legendary creature spells have convoke', hasConvoke(l), 0); const g = inHand(A, 'Grizzly Bears'); ok('We Ride at Dawn: not other spells', !hasConvoke(g), 0); }
            { const [A] = await fresh(); const w = put(A, 'We Ride at Dawn'); const ad = put(A, 'Adeline, Resplendent Cathar'); ad.isCommander = true; ad.sick = false; await atk(ad); ok('We Ride at Dawn: commander attacks make a Mercenary', nm(A, 'red Mercenary token').length + nm(A, 'Mercenary token').length === 1, A.bf.map(x => x.card.name)); }
            // Form a Posse / Forth Eorlingas
            { const [A] = await fresh(); const s = inHand(A, 'Form a Posse'); s.xPaid = 3; await resolveEffects(A, withX(spellEffects(s), 3), null, s); await settle2(); ok('Form a Posse: X Mercenary tokens', A.bf.filter(x => x.token).length === 3, A.bf.filter(x => x.token).length); }
            { const [A, B] = await fresh(); const s = inHand(A, 'Forth Eorlingas!'); await resolveEffects(A, withX(spellEffects(s), 2), null, s); await settle2(); const k = A.bf.filter(x => x.token); ok('Forth Eorlingas!: X 2/2 Knights with trample and haste', k.length === 2 && k.every(x => pow(x) === 2 && has(x, 'trample') && has(x, 'haste')), k.length);
              fire('combatHitAny', { P: A, list: k }); ok('Forth Eorlingas!: combat damage makes you the monarch', G.monarch === A.i, G.monarch); }
            // Devastating Onslaught
            { const [A] = await fresh(); const g = put(A, 'Shivan Dragon'); const s = inHand(A, 'Devastating Onslaught'); await resolveEffects(A, withX(spellEffects(s), 2), { o: g }, s); await settle2(); const cp = A.bf.filter(x => x.token && x.card.name === 'Shivan Dragon'); ok('Devastating Onslaught: X hasty token copies', cp.length === 2 && cp.every(x => has(x, 'haste') && x.sacAtEnd === G.turn), cp.length); }
            // Become the Avalanche
            { const [A] = await fresh(); put(A, 'Shivan Dragon'); put(A, 'Hill Giant'); for (let i = 0; i < 3; i++) A.library.push(makeObj(have('Plains'), 0)); A.hand.length = 0; const s = inHand(A, 'Become the Avalanche'); pull(A.hand, s); await resolveEffects(A, spellEffects(s), null, s); await settle2(); ok('Become the Avalanche: draws per power-4 creature, then +X/+X', A.hand.length === 1 && pow(A.bf.find(x => x.card.name === 'Hill Giant')) === 3 + 1, [A.hand.length]); }
            // Borrowed Knowledge
            { const [A, B] = await fresh(); for (let i = 0; i < 3; i++) inHand(B, 'Plains'); for (let i = 0; i < 6; i++) A.library.push(makeObj(have('Plains'), 0)); A.hand.length = 0; for (let i = 0; i < 2; i++) inHand(A, 'Island'); const s = inHand(A, 'Borrowed Knowledge'); pull(A.hand, s); s.mode = 0; await resolveEffects(A, spellEffects(s), null, s); await settle2(); ok("Borrowed Knowledge: discard, then draw cards equal to the opponent's hand", A.hand.length === 3 && A.gy.length >= 2, [A.hand.length, A.gy.length]); }
            { const [A] = await fresh(); for (let i = 0; i < 6; i++) A.library.push(makeObj(have('Plains'), 0)); A.hand.length = 0; for (let i = 0; i < 4; i++) inHand(A, 'Island'); const s = inHand(A, 'Borrowed Knowledge'); pull(A.hand, s); s.mode = 1; await resolveEffects(A, spellEffects(s), null, s); await settle2(); ok('Borrowed Knowledge: draw as many as you discarded', A.hand.length === 4, A.hand.length); }
            // Congregate
            { const [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(B, 'Hill Giant'); const life = B.life; const s = inHand(A, 'Congregate'); await resolveEffects(A, spellEffects(s), { p: B }, s); await settle2(); ok('Congregate: target player gains 2 life per creature', B.life === life + 4, B.life - life); }
            // Jaheira's Respite
            { const [A, B] = await fresh(); for (let i = 0; i < 4; i++) A.library.push(makeObj(have('Forest'), 0)); const a1 = put(B, 'Grizzly Bears'), a2 = put(B, 'Hill Giant'); G.attackers = [a1.uid, a2.uid]; const n = A.bf.length; const s = inHand(A, "Jaheira's Respite"); await resolveEffects(A, spellEffects(s), null, s); await settle2(); ok("Jaheira's Respite: fetches a basic land per creature attacking you", A.bf.length === n + 2, A.bf.length - n); }
            // Treacherous Terrain
            { const [A, B] = await fresh(); lands(B, 4, 'Plains'); const life = B.life; const s = inHand(A, 'Treacherous Terrain'); await resolveEffects(A, spellEffects(s), null, s); await settle2(); ok('Treacherous Terrain: damage equal to lands they control', B.life === life - 4, B.life - life); }
            // Paradigm and Improvisation Capstone
            { const [A] = await fresh(); const s = inHand(A, 'Improvisation Capstone'); ok('Improvisation Capstone: paradigm is read', !!Rx(s).paradigm, 0); A.library.length = 0; for (let i = 0; i < 6; i++) A.library.push(makeObj(have('Plains'), 0)); A.library.push(makeObj(have('Hill Giant'), 0)); A.library.push(makeObj(have('Lightning Bolt'), 0));
              pull(A.hand, s); G.stack.push({ P: A, o: s, kind: 'spell' }); await resolveTop(); await settle2();
              ok('Paradigm: the spell is exiled after resolving', A.exile.includes(s) && s.paradigmP === 0, [A.exile.length]);
              fire('main1'); await settle2(); ok('Paradigm: a free copy is cast at the start of your first main phase', A.exile.filter(x => x.card.name === 'Improvisation Capstone').length === 1 && A.exile.includes(s), 0); }
            // Max-speed mana abilities replace the card's own only at max speed
            { const [A] = await fresh(); const r = put(A, 'Muraganda Raceway'); const e = put(A, 'Endrider Catalyzer'); ok('Muraganda Raceway: one mana below max speed', manaOf(r) && manaOf(r).n === 1, manaOf(r)); ok('Endrider Catalyzer: no mana below max speed', !manaOf(e), manaOf(e)); A.speed = 4; ok('Muraganda Raceway: {C}{C} at max speed', manaOf(r) && manaOf(r).n === 2, manaOf(r)); ok('Endrider Catalyzer: {R}{R} at max speed', manaOf(e) && manaOf(e).n === 2 && manaOf(e).colors.includes('R'), manaOf(e)); }
            // Other max-speed flags are switched on only at max speed
            { const [A] = await fresh(); put(A, 'Vnwxt, Verbose Host'); for (let i = 0; i < 6; i++) A.library.push(makeObj(have('Plains'), 0)); A.hand.length = 0; drawCards(A, 1); const a = A.hand.length; A.hand.length = 0; A.speed = 4; drawCards(A, 1); ok('Vnwxt: draws two instead of one only at max speed', a === 1 && A.hand.length === 2, [a, A.hand.length]); }
            // Hazoret / Samut sanity: whole deck reads
            { const [A] = await fresh(); const bad = NAMES.filter(n => C[n] && rulesFor(C[n]).support !== 'full'); ok('Every card in the deck is fully Automated', bad.length === 0, bad); }
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('samutdf', results, []);
    writeOut('samutdf', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
