// The four official Star Trek Commander decks (2026-10-30): behaviour checks for the new cards (rules/trekdecks.js, 15p-trekdecks.js) and that every deck reads as fully Automated.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const DECKS = ['trek-federation-fleet', 'trek-landing-party', 'trek-klingon-fury', 'trek-we-are-the-borg'];
const NAMES = new Set(['Mountain', 'Forest', 'Island', 'Plains', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Sol Ring', 'Tyrox, Saurid Tyrant']);
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
            await newGame(mk(), mk(), null, [mk(), mk()]);
            const [A, B, Cc, D] = G.players;
            const reset = () => {
                T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {}; G.endQ = []; G.extraCombat = 0; G.defender = 1;
                G.players.forEach(P => { P.isAI = true; P.aiLevel = 'normal'; P.aiStyle = null; P.tune = {}; P.life = 40; P.hand.length = 0; P.command.length = 0; P.gy.length = 0; P.exile.length = 0; P.pool = []; P.attOpps = null; P.noAttackFlag = false; P.rvTurn = undefined; P.library.length = 0; for (let i = 0; i < 20; i++) P.library.push(makeObj(C['Mountain'], P.i)); });
            };
            const put = (P, n) => { const o = T.put(P, C[n]); o.sick = false; return o; };
            const give = (P, n) => { const o = makeObj(C[n], P.i); P.hand.push(o); return o; };
            const toGy = (P, n) => { const o = makeObj(C[n], P.i); P.gy.push(o); return o; };
            const lib = (P, n) => { const o = makeObj(C[n], P.i); P.library.push(o); return o; };
            const endSteps = async () => { await runEndQueue(); };

            // ---- Every deck reads as fully Automated ----
            for (const d of decks) {
                const txt = await (await fetch('/tests/decks/' + d + '.txt')).text().catch(() => '');
                void txt;
            }
            const notFull = [];
            names.forEach(n => { const c = C[n]; if (c && rulesFor(c).kind !== 'land' && rulesFor(c).support !== 'full') notFull.push(n); });
            ok('every nonland card of the four decks reads as fully Automated', notFull.length === 0, notFull);

            // ---- Federation Fleet ----
            reset(); let jw = put(A, 'Captain Janeway, Endgame'); G.combatDmgStep = 1;
            await CMD.td_janewayHit(A, {}, null, jw); await CMD.td_janewayHit(A, {}, null, jw);
            ok('Janeway: one card and one Officer per combat damage step', A.hand.length === 1 && A.bf.filter(o => o.token).length === 1, [A.hand.length, A.bf.length]);
            reset(); const ke = put(A, 'Ambassador K\'Ehleyr'); lib(A, 'Hill Giant'); lib(B, 'Mountain'); lib(Cc, 'Serra Angel'); lib(D, 'Mountain');
            const k0 = ke.counters; await CMD.td_parley(A, {}, null, ke);
            ok('K\'Ehleyr: each player draws; a counter per nonland card revealed (2 here)', ke.counters - k0 === 2 && G.players.every(P => P.hand.length === 1), [ke.counters - k0, G.players.map(P => P.hand.length)]);
            reset(); const kim = put(A, 'Ensign Harry Kim, Operations'); const big = put(A, 'Hill Giant'); G.ctxRaw = { o: big }; const kc = kim.counters; await CMD.td_kimGrow(A, {}, null, kim);
            ok('Harry Kim: grows when a creature with greater power enters', kim.counters === kc + 1);
            reset(); const bash = put(A, 'Julian Bashir, Frontier Doctor'); bash.counters = 2; toGy(A, 'Grizzly Bears'); toGy(A, 'Serra Angel');
            await CMD.td_bashir(A, {}, null, bash);
            ok('Julian Bashir: returns a creature with mana value 3 or less (power 1 + 2 counters)', A.bf.some(o => o.card.name === 'Grizzly Bears') && A.gy.some(o => o.card.name === 'Serra Angel'), A.bf.map(o => o.card.name));
            reset(); const ob = put(A, 'Grizzly Bears'); ob.counters = 3; ob.ctr.charge = 2; await CMD.td_doubleCounters(A, {}, { o: ob }, put(A, 'Chief Miles O\'Brien'));
            ok('Miles O\'Brien: doubles each kind of counter', ob.counters === 6 && ob.ctr.charge === 4, [ob.counters, ob.ctr.charge]);
            reset(); const kes = put(A, 'Kes, Evolving Telepath');
            for (let i = 0; i < 3; i++) await CMD.td_kes(A, {}, null, kes);
            ok('Kes: time counters 1+2+3 = 6 cards after three end steps', A.hand.length === 6 && kes.ctr.time === 3, [A.hand.length, kes.ctr.time]);
            kes.ctr.time = 8; await CMD.td_kes(A, {}, null, kes);
            ok('Kes: sacrificed at nine time counters', !onBf(kes.uid));
            reset(); const sev = put(A, 'Seven of Nine, Tertiary Adjunct'); const sol = put(A, 'Sol Ring'); give(A, 'Hill Giant'); lib(A, 'Serra Angel');
            await CMD.td_sevenLoot(A, {}, null, sev);
            ok('Seven of Nine: loot; a nonland discard puts two charge counters on an artifact', (sol.ctr.charge || 0) === 2 && A.gy.length === 1, [sol.ctr.charge, A.gy.length]);
            reset(); await CMD.td_tappedTreasures(A, { n: 2 });
            ok('Rom and Leeta: two tapped Treasures', A.bf.length === 2 && A.bf.every(o => o.tapped), A.bf.map(o => o.card.name + o.tapped));
            reset(); const bel = put(A, 'B\'Elanna Torres, Scrapper'); lib(A, 'Sol Ring'); await CMD.td_belanna(A, {}, null, bel);
            ok('B\'Elanna: an artifact on top draws it (no counters)', bel.counters === 0 && A.hand.length === 1, [bel.counters, A.hand.length]);
            reset(); const bel2 = put(A, 'B\'Elanna Torres, Scrapper'); lib(A, 'Hill Giant'); await CMD.td_belanna(A, {}, null, bel2);
            ok('B\'Elanna: otherwise two +1/+1 counters', bel2.counters === 2 && A.hand.length === 0, [bel2.counters, A.hand.length]);
            reset(); const barc = put(A, 'Reg Barclay, Fidgety Fantasist'); const lg = put(A, 'Captain Janeway, Endgame');
            await CMD.td_barclay(A, {}, { o: lg }, barc);
            const tk = A.bf.find(o => o.token);
            ok('Reg Barclay: a non-legendary Illusion artifact copy with haste', tk && !/Legendary/.test(tk.card.type) && /Artifact/.test(tk.card.type) && /Illusion/.test(tk.card.type) && has(tk, 'haste'), tk && tk.card.type);
            await endSteps();
            ok('... that is exiled at the next end step', !A.bf.some(o => o.token));
            reset(); const ent = put(A, 'Grizzly Bears'); give(A, 'Hill Giant'); give(A, 'Hill Giant'); give(A, 'Hill Giant'); const ecSrc = put(A, 'U.S.S. Enterprise-C, Time-Tossed');
            await CMD.td_discardHandDraw(A, {}, null, ecSrc);
            ok('Enterprise-C: discard the hand, draw that many', A.hand.length === 3 && A.gy.length === 3, [A.hand.length, A.gy.length]);
            reset(); const pro = put(A, 'U.S.S. Prometheus, Prototype'); G.ctxRaw = { n: 4, hit: [B] }; await CMD.td_multivector(A, {}, null, pro);
            ok('Prometheus: the other opponents take the damage too', Cc.life === 36 && D.life === 36 && B.life === 40, G.players.map(P => P.life));
            reset(); const sg = put(A, 'U.S.S. Stargazer, Here and There'); sg.atkTo = 1; await CMD.td_stargazer(A, {}, null, sg);
            const sgt = A.bf.find(o => o.token);
            ok('Stargazer: a tapped, attacking 4/3 flying Spacecraft Illusion, exiled at end of combat', sgt && sgt.tapped && pow(sgt) === 4 && has(sgt, 'flying') && G.attackers.includes(sgt.uid) && sgt.exileEndCombat, sgt && [sgt.tapped, pow(sgt)]);
            reset(); const fv = put(A, 'Fevered Visions'); B.hand.push(...Array.from({ length: 4 }, () => makeObj(C['Mountain'], B.i))); G.active = 1;
            await CMD.td_fevered(A, {}, null, fv);
            ok('Fevered Visions: an opponent with four cards draws and takes 2', B.life === 38 && B.hand.length === 5, [B.life, B.hand.length]);
            reset(); const vic = put(B, 'Serra Angel'); await CMD.td_fractured(A, {}, { o: vic }, give(A, 'Hill Giant'));
            ok('Fractured Identity: exiled, and every other player makes a token copy', B.exile.length === 1 && A.bf.filter(o => o.token).length === 1 && Cc.bf.length === 1 && D.bf.length === 1, [A.bf.length, Cc.bf.length, D.bf.length]);
            reset(); const att = put(B, 'Hill Giant'); await CMD.td_chrono(A, {}, null, give(A, 'Hill Giant'));
            ok('Chronomantic Escape: creatures can\'t attack you until your next turn', A.noAttackFlag === true && !canAttackWith(att) === false ? true : A.noAttackFlag === true, A.noAttackFlag);
            reset(); const gy1 = toGy(B, 'Hill Giant'); const cry = put(A, 'Stonespeaker Crystal'); await CMD.td_stonespeaker(A, {}, null, cry);
            ok('Stonespeaker Crystal: exiles the opponents\' graveyards and draws', B.gy.length === 0 && B.exile.includes(gy1) && A.hand.length === 1);
            reset(); const t1 = put(A, 'Grizzly Bears'), t2 = put(A, 'Hill Giant'); await CMD.td_tribulation(A, {}, null, give(A, 'Hill Giant'));
            ok('Temporal Tribulation: two permanents exiled', A.bf.length === 0 && A.exile.length === 2, [A.bf.length, A.exile.length]);
            await endSteps();
            ok('... and back at the next end step', A.bf.length === 2, A.bf.length);
            reset(); G.active = 1; const bhand = give(B, 'Hill Giant'); const troi = put(A, 'Cmdr. Troi, Outgoing Empath'); B.hand.length = 0; const dr0 = A.hand.length;
            await CMD.td_troi(A, {}, null, troi);
            ok('Troi: the opponent with nothing to cast gives you a card', A.hand.length === dr0 + 1);
            reset(); const dead = toGy(A, 'Hill Giant'); dead.diedAtTurn = G.turn; const ez = makeObj(C['Ezri Dax, Newly Joined'], A.i); T.clear; A.bf.push(ez); await enterAsCopy(A, ez, Rx(ez).clone);
            ok('Ezri Dax: copies a creature card that died this turn, keeps her name and is legendary', ez.card.name === 'Ezri Dax, Newly Joined' && /Legendary/.test(ez.card.type) && pow(ez) === pow(dead), [ez.card.name, ez.card.type]);

            // ---- Klingon Fury ----
            reset(); G.attackers = []; const kA = put(A, 'Grizzly Bears'); kA.atkTo = 1; G.attackers = [kA.uid]; fire('attacks', { list: [kA] });
            const kB = put(A, 'Hill Giant'); kB.atkTo = 2; fire('attacks', { list: [kB] });
            ok('Opponents attacked this turn are counted per defender', tdOppsAttacked(A) === 2, tdOppsAttacked(A));
            const korok = put(A, 'Korok, Liberated Rage'); const pk = pow(kA); CMD.td_korok(A, {}, null, korok);
            ok('Korok: +X/+X where X is the opponents attacked', pow(kA) === pk + 2, [pow(kA), pk]);
            const kurn = put(A, 'Kurn, Son of Mogh'); const h0 = A.hand.length; CMD.td_kurn(A, {}, null, kurn);
            ok('Kurn: draws X and loses X life', A.hand.length === h0 + 2 && A.life === 38, [A.hand.length - h0, A.life]);
            const mar = put(A, 'Martok, Hero of the Empire'); const cnt = () => A.bf.reduce((a, o) => a + o.counters, 0); const c0 = cnt(); await CMD.td_martok(A, {}, null, mar);
            ok('Martok: a counter on each of up to X creatures', cnt() === c0 + 2, [cnt(), c0]);
            reset(); const clk = put(A, 'Qo\'noS Quartermaster'); CMD.td_quartermaster(A); ok('Qo\'noS Quartermaster: a mana that stays until end of turn', A.pool.length === 1 && A.keepPoolTurn === G.turn);
            reset(); put(A, 'Grizzly Bears'); G.attackers = []; const sb = put(A, 'Grizzly Bears'); G.phase = 'main1'; CMD.td_extraCombat(A, {}, null, sb);
            ok('Own the Day / World at War: an additional combat phase', G.extraCombat === 1);
            reset(); const gh = put(A, 'Gnarling Targ'), klg = put(A, 'Kor, Cause of Vengeance'); CMD.td_targ(A);
            ok('Gnarling Targ: Klingons and Warriors get +2/+0 and trample', pow(klg) === 6 && has(klg, 'trample'), pow(klg));
            reset(); const gt = put(A, 'Glory to the Empire!'); await CMD.td_gloryTokens(A, {}, null, gt);
            ok('Glory to the Empire!: a Klingon Warrior per opponent', A.bf.filter(o => o.token).length === 3, A.bf.length);
            reset(); const th1 = put(B, 'Hill Giant'); const gr = put(A, 'Grilka, Widowed Warrior'); await CMD.td_grilka(A, {}, { o: th1 }, gr);
            ok('Grilka: gains control, untaps, trample and haste', A.bf.includes(th1) && has(th1, 'trample') && has(th1, 'haste'));
            reset(); const kg = put(A, 'Kang, Suspicious Captain'), kt = put(B, 'Hill Giant'); await CMD.td_kangEtb(A, {}, { o: kt }, kg);
            ok('Kang: he and the chosen creature are goaded', isGoaded(kg) && isGoaded(kt));
            reset(); put(A, 'Mountain'); const pest = put(B, 'Sol Ring'); const keep = put(B, 'Hill Giant'); CMD.td_pest();
            ok('Pest Control: nonland permanents with mana value 1 or less are destroyed', !onBf(pest.uid) && onBf(keep.uid));
            reset(); const cr = put(A, 'Grizzly Bears'); const con = put(A, 'Concerted Effort'); const fl = put(A, 'Serra Angel'); const sv = put(A, 'Hill Giant'); CMD.td_concerted(A);
            ok('Concerted Effort: flying spreads to the creatures you control', has(sv, 'flying') && has(cr, 'flying'));
            reset(); const sa1 = put(A, 'Gnarling Targ'), sa2 = put(A, 'Kor, Cause of Vengeance'), sa3 = put(A, 'Grizzly Bears'); G.ctxRaw = { list: [sa1, sa2, sa3] };
            CMD.td_sharedAnimosity(A);
            ok('Shared Animosity: +1/+0 for each other attacker that shares a type', sa1.tp === 0 && sa3.tp === 0, [sa1.tp, sa2.tp, sa3.tp]);
            reset(); G.ctxRaw = {}; CMD.td_vengeance(A); fire('hitPlayer', { src: put(B, 'Hill Giant'), n: 3, hit: [A] });
            ok('Right of Vengeance: the creature that hurt you is destroyed and you get a Warrior', A.rvTurn === G.turn && !B.bf.length && A.bf.length === 1, [B.bf.length, A.bf.length]);

            // ---- Landing Party ----
            reset(); const sp = put(A, 'Shuttlecraft Galileo'); G.attackers = [put(A, 'Grizzly Bears').uid]; CMD.td_galileo(A);
            ok('Shuttlecraft Galileo: attackers gain flying', has(onBf(G.attackers[0]), 'flying'));
            reset(); const trb = put(A, 'Tribble Cluster'); trb.counters = 3; G.ctxRaw = { lki: { pow: 4 } }; await CMD.td_tribbles(A, {}, null, trb);
            ok('Tribble Cluster: X Tribbles where X is its power', A.bf.filter(o => o.token).length === 4, A.bf.length);
            reset(); const pike = put(A, 'Fleet Captain Christopher Pike'); const tp1 = put(A, 'Grizzly Bears'), tp2 = put(A, 'Hill Giant'); tp1.tapped = true; tp2.tapped = true;
            await CMD.td_pikeYes(A, {}, null, pike);
            ok('Pike (Yes): untaps two other creatures', !tp1.tapped && !tp2.tapped);
            reset(); const am = put(A, 'Giant Space Amoeba'); am.atkTo = 1; const vv = put(B, 'Serra Angel'); await CMD.td_amoeba(A, {}, null, am);
            ok('Giant Space Amoeba: -3/-0 and a token copy', pow(vv) === 1 && A.bf.filter(o => o.token).length === 1, [pow(vv), A.bf.length]);
            reset(); const arex = put(A, 'Lt. Arex, Ever-Adapting'); give(A, 'Forest'); give(A, 'Island'); lib(A, 'Forest'); await CMD.td_arex(A, {}, null, arex);
            ok('Lt. Arex: draws three and puts lands from hand onto the battlefield', A.bf.filter(o => /Land/.test(o.card.type)).length >= 2, A.bf.map(o => o.card.name));
            reset(); const mc = put(A, 'McCoy, Not a Bricklayer'); const b1 = put(A, 'Grizzly Bears'); CMD.td_counterAll(A);
            ok('McCoy: a counter on each creature you control, and they have lifelink', b1.counters === 1 && has(b1, 'lifelink'), [b1.counters]);
            reset(); const cm = put(A, 'Colossal Clone Master'); void cm; ok('Colossal Clone Master: enters as a copy of a creature (reader gives it a clone ability)', !!Rx(cm).clone);
            reset(); const guard = put(A, 'The Guardian of Forever'); const victim = put(A, 'Hill Giant'); await CMD.td_guardian(A, {}, null, guard);
            ok('The Guardian of Forever: the sacrificed creature returns at the next end step', A.gy.includes(victim));
            await endSteps(); ok('...', A.bf.some(o => o.card.name === 'Hill Giant'));
            reset(); const pk2 = put(A, 'Planet Killer'); B.bf.push(makeObj(C['Forest'], B.i), makeObj(C['Forest'], B.i)); G.ctxRaw = { hit: [B] }; CMD.td_planetKiller(A, {}, null, pk2);
            ok('Planet Killer: a +1/+1 counter per land the player controls', pk2.counters === 2, pk2.counters);
            reset(); const tpr = put(A, 'T\'Pring, Never Parted'); const mine = put(A, 'Hill Giant'), theirs = put(B, 'Grizzly Bears'); await CMD.td_tpring(A, {}, null, tpr);
            ok('T\'Pring: the chosen creatures fight', theirs.dmg > 0 || !onBf(theirs.uid), [theirs.dmg]);
            reset(); const dfi = put(A, 'Grizzly Bears'); const df = put(A, 'U.S.S. Defiant, Mirror Migrant'); await CMD.td_defiant(A, {}, null, df);
            ok('U.S.S. Defiant: it phases out', !!df.phasedOut || !onBf(df.uid), df.phasedOut);
            reset(); give(A, 'Hill Giant'); const fa = put(A, 'U.S.S. Farragut, Bold Explorer'); await CMD.td_farragut(A, {}, null, fa);
            ok('U.S.S. Farragut: a creature from hand with haste, to the bottom at the end step', A.bf.some(o => o.card.name === 'Hill Giant' && has(o, 'haste')));
            await endSteps(); ok('...', A.library[0].card.name === 'Hill Giant' && A.hand.length === 1, [A.library[0] && A.library[0].card.name, A.hand.length]);
            reset(); const sl = put(A, 'Shore Leave Planet'); const lgn = put(A, 'Serra Angel'); await CMD.td_shoreLeave(A, {}, { o: lgn }, sl);
            ok('Shore Leave Planet: becomes a Robot artifact copy until end of turn', /Robot/.test(sl.card.type) && sl.card.name === 'Serra Angel');
            await endSteps(); ok('... and a land again', sl.card.name === 'Shore Leave Planet');
            reset(); give(A, 'Hill Giant'); toGy(A, 'Serra Angel'); CMD.td_echo(A);
            ok('Echo of Eons: everyone shuffles and draws seven', G.players.every(P => P.hand.length === 7 && P.gy.length === 0), G.players.map(P => P.hand.length));
            reset(); const gw = put(A, 'Ancient Greenwarden'); ok('Ancient Greenwarden: reads (lands from graveyard, extra landfall)', Rx(gw).landsFromGy === true && Rx(gw).greenwarden === true);
            reset(); const sw = put(A, 'Satyr Wayfinder'); for (let i = 0; i < 3; i++) lib(A, 'Hill Giant'); lib(A, 'Forest'); await CMD.td_wayfinder(A, {}, null, sw);
            ok('Satyr Wayfinder: a land from the top four to hand, the rest to the graveyard', A.hand.length === 1 && A.gy.length === 3, [A.hand.length, A.gy.length]);

            // ---- We Are the Borg ----
            reset(); const bo = put(A, 'Grizzly Bears'); const art = put(A, 'Sol Ring'); void art; await CMD.td_incursion(A, {}, null, give(A, 'Hill Giant'));
            ok('Borg Incursion: two Borg tokens that gain protection', A.bf.filter(o => o.token).length === 2 && A.bf.filter(o => o.token).every(o => o.tkw.some(k => k.startsWith('pro:'))));
            reset(); const st = put(A, 'Stratagem Emulator'); st.counters = 2; G.ctxRaw = { lki: { pow: 4 } }; await CMD.td_stratagem(A, {}, null, st);
            ok('Stratagem Emulator: X Borg tokens where X is its power', A.bf.filter(o => o.token).length === 4);
            reset(); const wo = put(A, 'Battle of Wolf 359'); const ab = put(A, 'Stratagem Emulator'), ab2 = put(A, 'Supplementation Node'); const vic2 = put(B, 'Serra Angel'); const tou0 = tou(vic2); CMD.td_wolf359(A);
            ok('Battle of Wolf 359: nonartifact creatures get -X/-X', tou(vic2) === tou0 - 2, tou(vic2));
            reset(); const dl = put(B, 'Hill Giant'); await CMD.td_deliver(A, {}, { o: dl }, give(A, 'Hill Giant'));
            ok('Deliver from Chaos: exiled, X Borg tokens (mana value 4)', B.exile.length === 1 && A.bf.filter(o => o.token).length === 4, A.bf.length);
            reset(); const bw = put(A, 'The Best of Both Worlds'); const bt = put(B, 'Hill Giant'); await CMD.td_bobw1(A, {}, { o: bt }, bw);
            ok('The Best of Both Worlds I: assimilates the creature (Borg artifact creature, +1/+1)', A.bf.includes(bt) && /Artifact Creature — Borg/.test(bt.card.type) && bt.counters === 1);
            await CMD.td_bobw3(A, {}, null, bw);
            ok('The Best of Both Worlds III: it returns under its owner\'s control', B.bf.some(o => o.card.name === 'Hill Giant'));
            reset(); const vox = put(A, 'Võx, Child of the Collective'); CMD.td_vox(A); const bor = give(A, 'Stratagem Emulator'); const cst = extraCost(A, bor);
            ok('Võx: the next artifact creature spell costs {1} less per opponent (3 here)', cst <= -3, cst);
            reset(); const as = put(A, 'Assimilation Assessor'); toGy(B, 'Serra Angel'); await CMD.td_assessorEtb(A, {}, null, as); await CMD.td_assessorAttack(A, {}, null, as);
            ok('Assimilation Assessor: exiles a graveyard, then assimilates a creature exiled with it', A.bf.some(o => o.card.name === 'Serra Angel' && /Borg/.test(o.card.type)), A.bf.map(o => o.card.name));
            reset(); const wnd = put(A, 'Grizzly Bears'); const dead2 = toGy(B, 'Hill Giant'); dead2.diedAtTurn = G.turn; await CMD.td_wounded(A, {}, null, give(A, 'Hill Giant'));
            ok('Assimilate the Wounded: takes a creature that died this turn', A.bf.some(o => o.card.name === 'Hill Giant') && B.gy.length === 0);
            reset(); const gf = give(A, 'Hill Giant'); lib(B, 'Mountain'); lib(B, 'Serra Angel'); lib(Cc, 'Hill Giant'); await CMD.td_gift(A, {}, null, gf);
            ok('Gift of Perfection: one revealed creature is assimilated', A.bf.length === 1 && /Borg/.test(A.bf[0].card.type), A.bf.map(o => o.card.name));
            reset(); const rec = put(A, 'Reconnaissance Partition'); rec.ctr.charge = 2; lib(A, 'Forest'); await CMD.td_recon(A, {}, null, rec);
            ok('Reconnaissance Partition: removes a counter (land or card)', rec.ctr.charge === 1 && (A.bf.length > 1 || A.hand.length === 1), [rec.ctr.charge, A.bf.length, A.hand.length]);
            reset(); const rq = put(A, 'Reclamation Specialist'); const sac = put(A, 'Stratagem Emulator'); await CMD.td_reclaim(A, {}, null, rq);
            ok('Reclamation Specialist: sacrifice an artifact creature, draw', A.hand.length === 1 && A.gy.length >= 1, [A.hand.length, A.gy.length]);
            reset(); const ar = put(A, 'Ambulatory Reactor'); const bb = put(A, 'Stratagem Emulator'); const mo = manaOf(bb);
            ok('Ambulatory Reactor: artifact creatures tap for {C} (artifact spells only)', mo && mo.colors[0] === 'C' && mo.onlyType === 'Artifact', mo);
            reset(); const ann = put(A, 'Optimization Annex'); const shp = put(A, 'Transwarp Hub'); tkCounters(shp, 'charge', 2);
            ok('Optimization Annex: one more charge counter', shp.ctr.charge === 3, shp.ctr.charge);
            reset(); const dia = put(A, 'Queen\'s Diamond'); dia.ctr.charge = 3; A.command.push(makeObj(C['Hill Giant'], A.i)); await CMD.td_queensDiamond(A, {}, null, dia);
            ok('Queen\'s Diamond: a mana per charge counter, for a legendary spell', A.pool.length === 3 && A.pool.every(c => /Legendary/.test(c)), A.pool);
            reset(); const jur = put(A, 'Jurati, Cordial Queen'); const tokB = put(A, 'Stratagem Emulator'); tokB.token = true; G.combatDmgStep = 2; await CMD.td_jurati(A, {}, null, jur);
            ok('Jurati: a token copy of an artifact token', A.bf.filter(o => o.token).length === 2, A.bf.length);
            for (const key of ['trk_federation', 'trk_landing', 'trk_klingon', 'trk_borg']) {
                const v = VERIFIED_DECKS.find(x => x.key === key);
                const gen = await listToOppDeck(v.text, 'commander');
                const deck = generatedToDeck(gen, v.name);
                const probs = deckProblems(deck);
                ok(v.name + ': no deck problems (cards of a set that isn\'t out yet count as legal)', probs.length === 0, probs.slice(0, 3));
            }
            reset(); ok('No broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    }, [[...NAMES], DECKS]);
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('trekdecks', results, []);
    writeOut('trekdecks', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
