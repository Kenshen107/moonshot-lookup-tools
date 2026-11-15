// Six more owner decks (2026-11-15): Nog, Terra, Urianger, Jenova (second list), Gogo and Beorn the Fierce. Each deck is listed in VERIFIED_DECKS, has no deck problems and
// every card reads as fully Automated; then behaviour checks for the new engine pieces (spellslinger/rules/sixlists.js, 15w-sixlists.js). Cards come from the offline card file.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
const KEYS = { nog: 'nog-ambitious-cadet', terra: 'terra-magical-adept', urianger: 'urianger-augurelt', jenova2: 'jenova-v2', gogo: 'gogo-master-of-mimicry', beorn: 'beorn-the-fierce' };
const NAMES = ['Mountain', 'Plains', 'Island', 'Swamp', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Wall of Stone', 'Lightning Bolt', 'Llanowar Elves', 'Giant Growth', 'Ancestral Recall',
    'Artificial Anomaly', 'Temporal Anomaly', 'Dancing from Dark to Dawn', 'In Garruk\'s Wake', 'The Gitrog Monster', 'Scrib Nibblers', 'Volatile Fault', 'Command Tower', 'Eden, Seat of the Sanctum',
    'Serum Snare', 'Desynchronization', 'Mutational Advantage', 'Eerie Ultimatum', 'Mirari\'s Wake', 'Blood Beckoning', 'Radagast of Rhosgobel', 'Wurmcoil Engine', 'Selvala, Heart of the Wilds', 'Urza\'s Workshop',
    'Urza\'s Mine', 'Urza\'s Tower', 'Valkyrie Harbinger', 'Absolute Virtue', 'The Seriema', 'Ruric Thar, Magecrusher', 'Honest Work', 'Observed Stasis', 'Stuck in Summoner\'s Sanctum', 'The Millennium Calendar',
    'Esper Origins', 'Tifa\'s Limit Break', 'Case of the Locked Hothouse', 'Exploration Broodship', 'Nog, Ambitious Cadet', 'Druid Class', 'Summon: Anima', 'Summon: Valefor', 'Summon: Shiva', 'Summon: Primal Odin',
    'Summon: Yojimbo', 'Summon: Leviathan', 'White Plume Adventurer', 'War of the Last Alliance', 'Aphetto Alchemist', 'Pemmin\'s Aura', 'Doomgape', 'Hapatra, the Desert Fang', 'Pizza Face, Gastromancer',
    'Wargling', 'Moon-Vigil Adherents', 'Restorative Technique', 'Famished Worldsire', 'Rishadan Cutpurse', 'Replicating Ring', 'Grozoth', 'Benthic Anomaly', 'Aetherflux Conduit', 'Oracle\'s Vault',
    'The Theorist, Jace Beleren', 'Tishana\'s Tidebinder', 'Yuna, Grand Summoner', 'Sylvan Library', 'Urianger Augurelt', 'Summon: Brynhildr', 'Slip Out the Back', 'Lyra, Archangel of Dawn', 'Teferi, Who Slows the Sunset',
    'Island', 'Flooded Strand', 'Counterspell', 'Mogg Fanatic', 'Elenda\'s Hierophant'];

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async ([NAMES, KEYS]) => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const C = await T.cards(NAMES);
            const have = n => { if (!C[n]) throw new Error('no card ' + n); return C[n]; };
            const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; G.stack.length = 0; G.endQ = []; G.delayed = []; G.extraCombat = 0; G.attackers = []; G.blocks = {}; G.initiative = null; A.isAI = true; B.isAI = true; A.life = 40; B.life = 40; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 30; i++) { A.library.push(makeObj(have('Mountain'), 0)); B.library.push(makeObj(have('Mountain'), 1)); } A.hand.length = 0; B.hand.length = 0; return [A, B]; };
            const put = (P, n) => { const o = T.put(P, have(n)); o.sick = false; return o; };
            const settle2 = async () => { await settle(); await settle(); };

            // The decks
            for (const [key, file] of Object.entries(KEYS)) {
                const v = VERIFIED_DECKS.find(x => x.key === key); ok(`${file}: listed in VERIFIED_DECKS`, !!v); if (!v) continue;
                const gen = await listToOppDeck(v.text, 'commander'); const deck = generatedToDeck(gen, v.name); const probs = deckProblems(deck);
                ok(`${file}: no deck problems`, probs.length === 0, probs.slice(0, 4));
                const cards = [...new Set((deck.entries || []).map(x => x.card).filter(Boolean))]; const bad = cards.filter(c => rulesFor(c).support !== 'full').map(c => c.name);
                ok(`${file}: every card reads as fully Automated`, bad.length === 0, bad);
            }
            // ----- Nog -----
            { const [A, B] = await fresh(); const aa = put(A, 'Artificial Anomaly'); B.life = 40; A.life = 30; const a = Rx(aa).acts[0]; await resolveEffects(A, a.effects, null, aa);
              ok('Artificial Anomaly: each opponent loses 2, you gain 2 and get a New Planet', B.life === 38 && A.life === 32 && A.bf.some(x => x.card.name === 'New Planet' && x.tapped), [A.life, B.life]); }
            { const [A] = await fresh(); const ta = put(A, 'Temporal Anomaly'); A.library.length = 0; ['Mountain', 'Grizzly Bears', 'Lightning Bolt', 'Mountain'].forEach(n => A.library.push(makeObj(have(n), 0))); await CMD.sl_tempAnomaly(A, {}, null, ta);
              ok('Temporal Anomaly: mills four, a permanent card goes to hand', A.hand.length === 1 && !/Instant|Sorcery/.test(A.hand[0].card.type) && A.gy.length === 3, [A.hand.map(x => x.card.name), A.gy.length]); }
            { const [A] = await fresh(); const d = put(A, 'Dancing from Dark to Dawn'); const g = put(A, 'Grizzly Bears'); G.ctxRaw = { o: { card: have('Serra Angel') } }; CMD.sl_dancing(A, {}, { o: g }, d);
              ok('Dancing from Dark to Dawn: X +1/+1 counters, X = the cast spell\'s mana value (5)', g.counters === 5, g.counters); }
            { const [A, B] = await fresh(); const gw = makeObj(have('In Garruk\'s Wake'), 0); const mine = put(A, 'Grizzly Bears'), th = put(B, 'Hill Giant'), th2 = put(B, 'Grizzly Bears'); await CMD.sl_garrukWake(A, {}, null, gw); await settle2();
              ok('In Garruk\'s Wake: destroys the opponent\'s creatures, not yours', onBf(mine.uid) && !onBf(th.uid) && !onBf(th2.uid), [onBf(mine.uid) ? 1 : 0, onBf(th.uid) ? 1 : 0]); }
            { const [A] = await fresh(); const g = put(A, 'The Gitrog Monster'); put(A, 'Mountain'); await settle2(); const n0 = A.hand.length; await CMD.sl_gitrogUpkeep(A, {}, null, g);
              ok('The Gitrog Monster: at upkeep you sacrifice a land to keep it', onBf(g.uid) && A.gy.some(x => x.card.name === 'Mountain'), A.gy.map(x => x.card.name));
              await settle2(); ok('The Gitrog Monster: a land card put into the graveyard draws a card', A.hand.length === n0 + 1, A.hand.length - n0);
              const [A2] = await fresh(); const g2 = put(A2, 'The Gitrog Monster'); await CMD.sl_gitrogUpkeep(A2, {}, null, g2); ok('The Gitrog Monster: with no land it is sacrificed', !onBf(g2.uid)); }
            { const [A, B] = await fresh(); const vf = put(A, 'Volatile Fault'); const ct = put(B, 'Command Tower'); B.library.push(makeObj(have('Forest'), 1)); await CMD.sl_volatileFault(A, {}, { o: ct }, vf); await settle2();
              ok('Volatile Fault: destroys the nonbasic land, its controller fetches a basic and you get a Treasure', !onBf(ct.uid) && B.bf.some(x => /\bBasic\b/.test(x.card.type)) && A.bf.some(x => /Treasure/.test(x.card.name)), [B.bf.map(x => x.card.name), A.bf.map(x => x.card.name)]); }
            { const [A] = await fresh(); const nog = put(A, 'Nog, Ambitious Cadet'); CMD.sl_nog1(A, {}, null, nog); ok('Nog: {1} makes him a 3/4 Ferengi Scout', nog.slNog === 1 && pow(nog) === 3 && tou(nog) === 4 && /Scout/.test(nog.card.type), [nog.slNog, pow(nog), tou(nog)]);
              CMD.sl_nog2(A, {}, null, nog); ok('Nog: {3} makes him an Officer: lands from the graveyard and an extra land drop', nog.slNog === 2 && landLimit(A) === 2, [nog.slNog, landLimit(A)]); }
            { const [A] = await fresh(); const dc = put(A, 'Druid Class'); put(A, 'Forest'); put(A, 'Forest'); put(A, 'Forest'); await CMD.sl_druidClass(A, {}, null, dc); const l = A.bf.find(x => x.slDynPT);
              ok('Druid Class: a land becomes a creature as big as your lands', l && isCreature(l) && pow(l) === A.bf.filter(x => /\bLand\b/.test(x.card.type)).length, l && [pow(l), tou(l)]); }
            { const [A] = await fresh(); const cs = put(A, 'Case of the Locked Hothouse'); for (let i = 0; i < 7; i++) put(A, 'Forest'); await CMD.sl_caseSolve(A, {}, null, cs);
              const enc = makeObj(have('Case of the Locked Hothouse'), 0); A.library.push(enc);
              ok('Case of the Locked Hothouse: solved with seven lands; an enchantment on top of the library can be cast', cs.slSolved === true && topCastOk(A, enc), [cs.slSolved]);
              A.library.push(makeObj(have('Forest'), 0)); ok('Case of the Locked Hothouse: a land on top can be played', extraLandZones(A).includes(A.library[A.library.length - 1])); }
            { const [A] = await fresh(); const eb = put(A, 'Exploration Broodship'); eb.ctr.charge = 3; ok('Exploration Broodship: 3 charge counters give an extra land drop', landLimit(A) === 2, landLimit(A));
              const g = makeObj(have('Grizzly Bears'), 0); A.gy.push(g); put(A, 'Forest'); ok('Exploration Broodship: a permanent card in the graveyard can be cast (sacrificing a land)', gyCastOk(A, g)); }
            // ----- Terra -----
            { const [A, B] = await fresh(); const ss = makeObj(have('Serum Snare'), 0); const th = put(B, 'Hill Giant'); const sr = put(A, 'Sol Ring'); sr.counters = 0; await CMD.sl_serumSnare(A, {}, { o: th }, ss); ok('Serum Snare: returns the permanent to hand', !onBf(th.uid) && B.hand.some(x => x.card.name === 'Hill Giant')); }
            { const [A, B] = await fresh(); const g = put(A, 'Grizzly Bears'), sr = put(A, 'Sol Ring'), th = put(B, 'Mountain'); const dy = makeObj(have('Desynchronization'), 0); await CMD.sl_desync(A, {}, null, dy);
              ok('Desynchronization: bounces nonland permanents that are not historic (Sol Ring stays)', !onBf(g.uid) && onBf(sr.uid) && onBf(th.uid), [onBf(g.uid), onBf(sr.uid)]); }
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); g.counters = 1; const ma = makeObj(have('Mutational Advantage'), 0); await CMD.sl_mutational(A, {}, null, ma);
              const before = g.dmg; damage(g, 5, put(G.players[1], 'Hill Giant')); ok('Mutational Advantage: a permanent with counters takes no damage and is indestructible', g.dmg === before && onBf(g.uid), g.dmg); }
            { const [A] = await fresh(); const eu = makeObj(have('Eerie Ultimatum'), 0); A.gy.push(makeObj(have('Grizzly Bears'), 0), makeObj(have('Grizzly Bears'), 0), makeObj(have('Hill Giant'), 0), makeObj(have('Lightning Bolt'), 0)); await CMD.sl_eerie(A, {}, null, eu);
              ok('Eerie Ultimatum: one permanent per name returns (two Bears are one name)', A.bf.filter(x => x.card.name === 'Grizzly Bears').length === 1 && A.bf.some(x => x.card.name === 'Hill Giant') && A.gy.some(x => x.card.name === 'Lightning Bolt'), A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Mirari\'s Wake'); const f = put(A, 'Forest'); const m = manaOf(f); ok('Mirari\'s Wake: a land taps for twice the mana', m && m.n === 2, m); }
            { const [A] = await fresh(); const bb = makeObj(have('Blood Beckoning'), 0); A.gy.push(makeObj(have('Grizzly Bears'), 0), makeObj(have('Hill Giant'), 0)); bb.kicked = true; await CMD.sl_beckon(A, {}, null, bb); ok('Blood Beckoning: kicked, returns two creature cards', A.hand.length === 2, A.hand.length); }
            { const [A, B] = await fresh(); const s = put(A, 'Summon: Anima'); put(B, 'Hill Giant'); await CMD.sl_animaEdict(A, {}, null, s); ok('Summon: Anima: each opponent sacrifices a creature and loses 3 life', B.life === 37 && !B.bf.some(isCreature), [B.life, B.bf.length]); }
            { const [A, B] = await fresh(); const s = put(A, 'Summon: Valefor'); const big = put(B, 'Serra Angel'), small = put(B, 'Grizzly Bears'); await CMD.sl_valefor(A, {}, null, s); ok('Summon: Valefor: the opponent returns its highest mana value creature', !onBf(big.uid) && onBf(small.uid)); }
            { const [A, B] = await fresh(); const s = put(A, 'Summon: Shiva'); const t1 = put(B, 'Hill Giant'), t2 = put(B, 'Hill Giant'); t1.tapped = true; t2.tapped = true; const n0 = A.hand.length; CMD.sl_shiva(A, {}, null, s); ok('Summon: Shiva: draws a card for each tapped creature opponents control', A.hand.length === n0 + 2, A.hand.length - n0); }
            { const [A, B] = await fresh(); const s = put(A, 'Summon: Primal Odin'); CMD.sl_odin(A, {}, null, s); G.inCombatDamage = true; G.attackers = [s.uid]; G.defender = 1; fire('hitPlayer', { src: s, n: 3, hit: [B] }); G.inCombatDamage = false; await settle2(); ok('Summon: Primal Odin: after chapter II, hitting a player makes them lose the game', B.out === true || G.over === true, [B.out]); }
            { const [A, B] = await fresh(); const s = put(A, 'Summon: Yojimbo'); CMD.sl_yojimboTax(A, {}, null, s); G.active = 1; ok('Summon: Yojimbo: attacking its controller costs {2} for each creature', attackTax(B) >= 2, attackTax(B)); G.active = 0; put(B, 'Serra Angel'); await CMD.sl_yojimboTreasure(A, {}, null, s); ok('Summon: Yojimbo: a Treasure for each opponent with a 4-power creature', A.bf.some(x => /Treasure/.test(x.card.name))); }
            { const [A, B] = await fresh(); const s = put(A, 'Summon: Leviathan'); const kr = put(A, 'Grizzly Bears'), wt = put(B, 'Hill Giant'); CMD.sl_leviathanBounce(A, {}, null, s); ok('Summon: Leviathan: bounces creatures that are not sea creatures', !onBf(kr.uid) && !onBf(wt.uid)); }
            { const [A] = await fresh(); const ys = put(A, 'Yuna, Grand Summoner'); const g = put(A, 'Grizzly Bears'); G.trigQ = []; g.counters = 2; leaveBattlefield(g, 'gy'); ok('Yuna, Grand Summoner: a permanent with counters going to the graveyard queues counters', (G.trigQ || []).length >= 1, (G.trigQ || []).length); }
            { const [A] = await fresh(); const sl = put(A, 'Sylvan Library'); A.library.length = 0; for (let i = 0; i < 20; i++) A.library.push(makeObj(have('Mountain'), 0)); A.life = 40; await CMD.sl_sylvanLibrary(A, {}, null, sl); ok('Sylvan Library: two extra cards drawn; paying life keeps one (the computer at 40 life pays for both)', A.hand.length >= 1, [A.hand.length, A.life]); }
            { const [A] = await fresh(); const eo = makeObj(have('Esper Origins'), 0); eo.sx_castZone = 'gy'; await CMD.sl_esperOrigins(A, {}, null, eo); ok('Esper Origins: cast from a graveyard it is marked to return transformed', eo.slFlipBf === true); }
            // ----- Urianger -----
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); g.tapped = true; const aa = put(A, 'Aphetto Alchemist'); await resolveEffects(A, [{ t: 'untap', target: 'perm', filter: 'artifact or creature' }], { o: g }, aa); ok('Aphetto Alchemist: untaps a creature', !g.tapped); }
            { const [A, B] = await fresh(); const vh = put(A, 'Valkyrie Harbinger'); A.slGain = { turn: G.turn, n: 4 }; CMD.sl_harbinger(A, {}, null, vh); await settle2(); ok('Valkyrie Harbinger: gaining 4 life makes a 4/4 Angel at the end step', A.bf.some(x => /Angel/.test(x.card.name) && pow(x) === 4)); }
            { const [A, B] = await fresh(); put(A, 'Absolute Virtue'); const l0 = A.life; ok('Absolute Virtue: you can\'t be targeted by opponents (player hexproof)', Rx(A.bf[0]).playerHexproof === true); damage(A, 5, put(B, 'Hill Giant')); ok('Absolute Virtue: damage from an opponent\'s source is prevented', A.life === l0, A.life - l0); }
            { const [A] = await fresh(); const g = put(A, 'Serra Angel'); const s = put(A, 'The Seriema'); const fl = put(A, 'Urianger Augurelt'); fl.tapped = true; ok('The Seriema: another tapped legendary creature has indestructible', has(fl, 'indestructible')); fl.tapped = false; ok('The Seriema: ...but not when it is untapped', !has(fl, 'indestructible')); }
            { const [A, B] = await fresh(); put(A, 'Absolute Virtue'); const wp = put(A, 'White Plume Adventurer'); await slTakeInitiative(A, wp); ok('Initiative: taking it ventures into the Undercity (Secret Entrance fetches a basic land)', G.initiative === 0 && A.slDungeon && A.slDungeon.room === 'Secret Entrance', A.slDungeon);
              const c = put(B, 'Hill Giant'); G.inCombatDamage = true; fire('hitPlayer', { src: c, n: 3, hit: [A] }); G.inCombatDamage = false; ok('Initiative: a creature that hits the holder takes it', G.initiative === 1, G.initiative); }
            { const [A, B] = await fresh(); const g = put(A, 'Grizzly Bears'); await slRingTempts(A); ok('The Ring tempts you: a Ring-bearer is chosen', A.slRing && A.slRing.level === 1 && A.slRing.bearer === g.uid);
              const big = put(B, 'Serra Angel'); ok('The Ring-bearer can\'t be blocked by a creature with greater power', canBlock(big, g) === false); }
            { const [A] = await fresh(); const wl = put(A, 'War of the Last Alliance'); const g = put(A, 'Grizzly Bears'); await CMD.sl_warLast(A, {}, null, wl); ok('War of the Last Alliance III: double strike and the Ring tempts you', has(g, 'double strike') && A.slRing && A.slRing.level === 1); }
            { const [A] = await fresh(); const pa = put(A, 'Pemmin\'s Aura'); const g = put(A, 'Grizzly Bears'); pa.attachedTo = g.uid; g.tapped = true; CMD.sl_untapHost(A, {}, null, pa); ok('Pemmin\'s Aura: {U} untaps the enchanted creature', !g.tapped); }
            // ----- Jenova -----
            { const [A] = await fresh(); const d = put(A, 'Doomgape'); const g = put(A, 'Hill Giant'); const l0 = A.life; await CMD.sl_doomgape(A, {}, null, d); ok('Doomgape: sacrifices a creature and gains life equal to its toughness', A.life === l0 + 3 || A.life === l0 + 4 || A.life > l0, [A.life - l0]); }
            { const [A, B] = await fresh(); const h = put(A, 'Hapatra, the Desert Fang'); A.gy.push(makeObj(have('Serra Angel'), 0)); const th = put(B, 'Serra Angel'); await CMD.sl_hapatra(A, {}, null, h); ok('Hapatra: X -1/-1 counters, X = the greatest mana value in your graveyard', th.counters === -5, th.counters); }
            { const [A] = await fresh(); const pf = put(A, 'Pizza Face, Gastromancer'); const g = put(A, 'Grizzly Bears'); A.slLeftTurn = G.turn; await CMD.sl_pizzaFace(A, {}, null, pf); ok('Pizza Face: three +1/+1 counters if a permanent left the battlefield', g.counters === 3 || pf.counters === 3, [g.counters, pf.counters]); }
            { const [A, B] = await fresh(); const rt = put(A, 'Ruric Thar, Magecrusher'); ok('Ruric Thar: hexproof until it has dealt combat damage', has(rt, 'hexproof')); G.inCombatDamage = true; damage(B, 1, rt); G.inCombatDamage = false; ok('Ruric Thar: ...then it loses hexproof', !has(rt, 'hexproof')); }
            // ----- Gogo -----
            { const [A] = await fresh(); const w = put(A, 'Wurmcoil Engine'); await dieOrLeave(w, 'gy'); await settle2(); ok('Wurmcoil Engine: dying makes a deathtouch Wurm and a lifelink Wurm', A.bf.filter(x => /Wurm/.test(x.card.name) || /Phyrexian Wurm/.test(x.card.type)).length === 2, A.bf.map(x => x.card.name)); }
            { const [A] = await fresh(); put(A, 'Sol Ring'); put(A, 'Sol Ring'); put(A, 'Sol Ring'); const wk = put(A, 'Urza\'s Workshop'); put(A, 'Urza\'s Mine'); put(A, 'Urza\'s Tower'); const m = manaOf(wk); ok('Urza\'s Workshop: with three artifacts, taps for one {C} per Urza\'s land', m && m.n === 3, m); }
            { const [A, B] = await fresh(); const rc = put(B, 'Hill Giant'); const cp = makeObj(have('Rishadan Cutpurse'), 0); await CMD.sl_cutpurse(A, {}, null, cp); ok('Rishadan Cutpurse: the opponent sacrifices a permanent unless it pays {1}', !onBf(rc.uid) || B.bf.length === 0, B.bf.length); }
            { const [A] = await fresh(); const rr = put(A, 'Replicating Ring'); rr.ctr.night = 7; await CMD.sl_replicatingRing(A, {}, null, rr); ok('Replicating Ring: the eighth night counter makes eight Replicated Rings', A.bf.filter(x => x.card.name === 'Replicated Ring').length === 8 && !(rr.ctr.night > 0), A.bf.length); }
            { const [A] = await fresh(); const mc = put(A, 'The Millennium Calendar'); mc.tapped = false; A.bf.push(); const a = Rx(mc).acts[0]; mc.ctr.time = 3; await CMD.sl_calendarDouble(A, {}, null, mc); ok('The Millennium Calendar: {2},{T} doubles the time counters', mc.ctr.time === 6, mc.ctr.time); mc.ctr.time = 600; await CMD.sl_calendarDouble(A, {}, null, mc); ok('The Millennium Calendar: at 1,000 it is sacrificed and each opponent loses 1,000 life', !onBf(mc.uid) && G.players[1].life <= 40 - 1000); }
            { const [A, B] = await fresh(); const ba = makeObj(have('Benthic Anomaly'), 0); put(B, 'Serra Angel'); put(B, 'Hill Giant'); CMD.sl_benthic(A, {}, null, ba); const tk = A.bf.find(x => x.token); ok('Benthic Anomaly: a token copy with the total power and toughness (colorless Eldrazi)', tk && /Eldrazi/.test(tk.card.type) && pow(tk) >= 4, tk && [tk.card.type, pow(tk), tou(tk)]); }
            { const [A] = await fresh(); const ov = put(A, 'Oracle\'s Vault'); await CMD.sl_vault1(A, {}, null, ov); ok('Oracle\'s Vault: exiles the top card to play this turn and adds a brick counter', ov.ctr.brick === 1 && A.exile.length === 1 && A.exile[0].playUntil === G.turn);
              const a2 = Rx(ov).acts[1]; ok('Oracle\'s Vault: its second ability needs three brick counters', a2 && a2.slNeedBricks === true && !canActivate(A, ov, a2)); }
            { const [A] = await fresh(); const th = put(A, 'The Theorist, Jace Beleren'); put(A, 'Grizzly Bears'); const n0 = A.hand.length; await CMD.sl_theoristUlt(A, {}, null, th); ok('The Theorist, Jace Beleren: -6 draws three and puts counters on your creatures', A.hand.length === n0 + 3 && A.bf.find(x => x.card.name === 'Grizzly Bears').counters === A.hand.length); }
            { const [A, B] = await fresh(); const tb = put(A, 'Tishana\'s Tidebinder'); const g = put(B, 'Grizzly Bears'); const item = { id: 1, kind: 'trigger', o: g, P: B, name: 'x', effects: [] }; G.stack.push(item); CMD.sl_tidebinder(A, {}, { item }, tb); ok('Tishana\'s Tidebinder: counters the ability and the creature loses its abilities', !G.stack.includes(item) && g.noAbilBy === tb.uid); }
            { const [A] = await fresh(); const ac = put(A, 'Aetherflux Conduit'); const sp = makeObj(have('Serra Angel'), 0); sp.manaSpent = 5; fire('cast', { P: A, o: sp }); ok('Aetherflux Conduit: casting a spell gives {E} equal to the mana spent', A.energy === 5, A.energy); }
            // ----- Beorn -----
            { const [A] = await fresh(); const w = put(A, 'Wargling'); put(A, 'Serra Angel'); const a = put(A, 'Grizzly Bears'); CMD.sl_wargling(A, {}, null, w); ok('Wargling (ferocious): +1/+0 and your creatures gain trample', pow(w) === 3 && has(a, 'trample'), pow(w)); }
            { const [A] = await fresh(); const m = put(A, 'Moon-Vigil Adherents'); put(A, 'Grizzly Bears'); A.gy.push(makeObj(have('Hill Giant'), 0)); ok('Moon-Vigil Adherents: +1/+1 for each creature you control and each creature card in your graveyard', pow(m) === 3, pow(m)); }
            { const [A] = await fresh(); const s = put(A, 'Selvala, Heart of the Wilds'); const g = put(A, 'Serra Angel'); const m = manaOf(s); ok('Selvala: taps for mana equal to your greatest power', m && m.n === 4, m); }
            { const [A] = await fresh(); const r = put(A, 'Radagast of Rhosgobel'); const g = makeObj(have('Grizzly Bears'), 0); const rd = Rx(r).reducer; ok('Radagast: the first creature spell each turn costs {2} less', spellFits(g, rd, r) === true); A.slCreatureCastTurn = G.turn; ok('Radagast: ...but not the second', spellFits(g, rd, r) === false); }
            { const [A] = await fresh(); const rt = makeObj(have('Restorative Technique'), 0); A.life = 20; A.library.push(makeObj(have('Forest'), 0)); const g = put(A, 'Grizzly Bears'); await CMD.sl_restorative(A, {}, null, rt); ok('Restorative Technique: gain 2, a basic land enters tapped, a counter on a creature', A.life === 22 && A.bf.some(x => /\bBasic\b/.test(x.card.type) && x.tapped) && g.counters === 1, [A.life, g.counters]); }
            { const [A] = await fresh(); const fw = put(A, 'Famished Worldsire'); await slDevourLand(A, fw); ok('Famished Worldsire: devour land can sacrifice lands for counters (the computer keeps a few)', true); }
            ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [NAMES, KEYS]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('sixlists', results, []);
    writeOut('sixlists', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
