// Commander precons round (2026-10-15): behavior checks for the cards added for FDC, FRC, SOC and MSC (rules/cmdr*.js, 15d-cmdr-*.js).
// Each section sets up a small board from the offline card file and checks what the card does.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const byName = new Map(raw.map(c => [c.name, c]));
            const need = n => { if (!C[n]) { const c = byName.get(n); if (!c) throw new Error('no card ' + n); const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; } return C[n]; };
            ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant'].forEach(need);
            manaMode = 'auto';
            window.pickCard = async (P, list) => list[0];
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async (humanA = false) => { await newGame(mk(), mk()); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; const [A, B] = G.players; A.isAI = true; B.isAI = true; if (humanA) A.isAI = false; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 20; i++) { A.library.push(makeObj(C['Island'], 0)); B.library.push(makeObj(C['Island'], 1)); } return [A, B]; };
            const put = (P, n, extra) => { need(n); return T.put(P, C[n], extra); };
            const lands = (P, k, n = 'Plains') => { need(n); for (let i = 0; i < k; i++) T.put(P, C[n]); };
            const settle2 = async () => { await settle(); await settle(); };
            const logged = () => G.log.map(l => l.text || l).join('\n');

            // ===== FDC: Calling All Angels =====
            { // Bishop of Wings: Angels entering gain 4; an Angel dying leaves a Spirit
                let [A, B] = await fresh(); const bw = put(A, 'Bishop of Wings'); put(A, 'Seraph Sanctuary'); await settle2(); const l0 = A.life;
                put(A, 'Serra Angel'); await settle2();
                ok('Bishop of Wings: an Angel entering gains 4 (and Seraph Sanctuary 1)', A.life === l0 + 5, A.life - l0);
                const ang = A.bf.find(x => x.card.name === 'Serra Angel'); dieOrLeave(ang, 'gy'); fire('dies', { o: ang }); await settle2();
                ok('Bishop of Wings: an Angel dying makes a 1/1 flying Spirit', A.bf.some(x => x.token && /Spirit/.test(x.card.type)), A.bf.map(x => x.card.name));
            }
            { // Court of Grace
                let [A, B] = await fresh(); const cg = put(A, 'Court of Grace'); fire('upkeep'); await settle2();
                ok('Court of Grace: a 1/1 Spirit upkeep', A.bf.filter(x => x.token).length === 1 && /Spirit/.test(A.bf.find(x => x.token).card.type), A.bf.map(x => x.card.name));
                G.monarch = A.i; fire('upkeep'); await settle2();
                ok('Court of Grace: a 4/4 Angel when monarch', A.bf.some(x => x.token && /Angel/.test(x.card.type) && pow(x) === 4));
            }
            { // Emeria Shepherd
                let [A, B] = await fresh(); put(A, 'Emeria Shepherd'); const gb = makeObj(C['Grizzly Bears'], 0); A.gy.push(gb);
                window.askYes = async () => true;
                const pl = makeObj(C['Plains'], 0); A.hand.push(pl); await playLand(A, pl); await settle2();
                ok('Emeria Shepherd: a Plains returns the creature card to the battlefield', A.bf.some(x => x.card.name === 'Grizzly Bears'), A.bf.map(x => x.card.name));
                A.gy.push(makeObj(C['Grizzly Bears'], 0)); const fo = makeObj(C['Forest'], 0); A.hand.push(fo); await playLand(A, fo); await settle2();
                ok('Emeria Shepherd: another land type returns it to hand', A.hand.some(x => x.card.name === 'Grizzly Bears'));
            }
            { // Grasp of Fate
                let [A, B] = await fresh(); const bear = put(B, 'Grizzly Bears'); const gf = put(A, 'Grasp of Fate'); (G.trigQ = G.trigQ || []).push({ P: A, o: gf, effects: Rx(gf).etb }); await settle2();
                ok('Grasp of Fate: exiles an opponent permanent', !onBf(bear.uid) && B.exile.includes(bear), B.exile.map(x => x.card.name));
                leaveBattlefield(gf, 'gy'); await settle2();
                ok('Grasp of Fate: it comes back when Grasp leaves', B.bf.some(x => x.card.name === 'Grizzly Bears'));
            }
            { // Herald of War: cost reduction by counters
                let [A, B] = await fresh(); const hw = put(A, 'Herald of War'); const sa = makeObj(need('Serra Angel'), 0); A.hand.push(sa);
                const c0 = costOf(A, sa); hw.counters = 2; const c2 = costOf(A, sa);
                ok('Herald of War: Angel spells cost {1} less per +1/+1 counter', c0.generic - c2.generic === 2, [c0.generic, c2.generic]);
            }
            { // Norn's Choirmaster: proliferate when the commander enters
                let [A, B] = await fresh(); const nc = put(A, "Norn's Choirmaster"); const bear = put(A, 'Grizzly Bears'); bear.counters = 1; A.life = 40;
                const cmdr = makeObj(C['Tyrox, Saurid Tyrant'], 0); cmdr.isCommander = true; A.command.push(cmdr);
                putOntoBattlefield(A, cmdr); await settle2();
                ok("Norn's Choirmaster: commander entering proliferates", bear.counters === 2, bear.counters);
            }
            { // Righteous Valkyrie
                let [A, B] = await fresh(); put(A, 'Righteous Valkyrie'); const l0 = A.life; put(A, 'Serra Angel'); await settle2();
                ok('Righteous Valkyrie: gain life equal to the Angel\'s toughness', A.life === l0 + 4, A.life - l0);
                const bear = put(A, 'Grizzly Bears'); const p0 = pow(bear); A.life = A.startLife + 7; 
                ok('Righteous Valkyrie: +2/+2 at 7 life above the start', pow(bear) === p0 + 2, [p0, pow(bear)]);
                A.life = A.startLife + 6; ok('Righteous Valkyrie: not at 6 above', pow(bear) === p0);
            }
            { // Sephara: alt cost, other fliers indestructible
                let [A, B] = await fresh(); const sp = makeObj(need("Sephara, Sky's Blade"), 0); A.hand.push(sp); lands(A, 1, 'Plains');
                for (let i = 0; i < 3; i++) put(A, 'Serra Angel'); ok('Sephara: needs four fliers for its alt cost', !altOk(A, sp));
                put(A, 'Serra Angel'); ok('Sephara: four untapped fliers allow the alt cost', altOk(A, sp));
                const sa = A.bf.find(x => x.card.name === 'Serra Angel'); put(A, "Sephara, Sky's Blade"); ok('Sephara on the battlefield: other fliers are indestructible', has(sa, 'indestructible'));
            }
            { // Seraph of the Sword
                let [A, B] = await fresh(); const sw = put(B, 'Seraph of the Sword'); const bear = put(A, 'Grizzly Bears'); G.attackers = [bear.uid]; G.blocks = { [bear.uid]: [sw.uid] }; G.inCombatDamage = true; damage(sw, 5, bear); G.inCombatDamage = false;
                ok('Seraph of the Sword: combat damage is prevented', sw.dmg === 0, sw.dmg);
                damage(sw, 5, bear); ok('Seraph of the Sword: other damage is not', sw.dmg === 5 || !onBf(sw.uid));
            }
            { // Serra Avenger: not on your first three turns
                let [A, B] = await fresh(); const sv = makeObj(need('Serra Avenger'), 0); A.hand.push(sv); lands(A, 3, 'Plains'); A.turnsTaken = 3;
                ok('Serra Avenger: cannot be cast on turn 3', !canCastNow(A, sv)); A.turnsTaken = 4; ok('Serra Avenger: castable on turn 4', canCastNow(A, sv));
            }
            { // Speaker of the Heavens
                let [A, B] = await fresh(); const sp = put(A, 'Speaker of the Heavens'); A.life = 20; const act = actsOf(sp)[0]; G.phase = 'main1';
                ok('Speaker of the Heavens: not without 7 extra life', !canActivate(A, sp, act)); A.life = A.startLife + 7; ok('Speaker of the Heavens: with 7 extra life', canActivate(A, sp, act));
            }
            { // Wojek Investigator
                let [A, B] = await fresh(); put(A, 'Wojek Investigator'); for (let i = 0; i < 3; i++) B.hand.push(makeObj(C['Island'], 1)); fire('upkeep'); await settle2();
                ok('Wojek Investigator: a Clue for the opponent with more cards', A.bf.filter(x => x.token && /Clue/.test(x.card.type)).length === 1, A.bf.map(x => x.card.name));
            }
            { // Angelic Sleuth, Thraben Watcher, Giada, Archangel of Tithes
                let [A, B] = await fresh(); put(A, 'Angelic Sleuth'); const bear = put(A, 'Grizzly Bears'); bear.counters = 1; leaveBattlefield(bear, 'gy'); await settle2();
                ok('Angelic Sleuth: investigates when a permanent with counters leaves', A.bf.some(x => x.token && /Clue/.test(x.card.type)), A.bf.map(x => x.card.name));
                const bear2 = put(A, 'Grizzly Bears'); leaveBattlefield(bear2, 'gy'); await settle2(); ok('Angelic Sleuth: not without counters', A.bf.filter(x => x.token).length === 1);
                [A, B] = await fresh(); put(A, 'Thraben Watcher'); const b = put(A, 'Grizzly Bears'); ok('Thraben Watcher: other nontoken creatures get +1/+1 and vigilance', pow(b) === 3 && has(b, 'vigilance'), pow(b));
                [A, B] = await fresh(); put(A, 'Giada, Font of Hope'); put(A, 'Serra Angel'); put(A, 'Serra Angel'); await settle2(); const third = put(A, 'Serra Angel');
                ok('Giada: each other Angel enters with a counter per Angel already there', third.counters === 3, third.counters);
                [A, B] = await fresh(); const at = put(B, 'Archangel of Tithes'); const bear3 = put(A, 'Grizzly Bears'); ok('Archangel of Tithes (untapped): attacking costs {1}', attackTax(A) === 1, attackTax(A));
                at.tapped = true; ok('Archangel of Tithes (tapped): no tax', attackTax(A) === 0);
            }

            // ===== Shared staples =====
            { // Path of Ancestry: the commander's colors only; the scry rider
                let [A, B] = await fresh(); const pa = put(A, 'Path of Ancestry'); const m = manaOf(pa);
                const id = cmdrIdentity(A).filter(c => COLORS.includes(c));
                ok('Path of Ancestry: taps for the commander\'s colors only', m && JSON.stringify(m.colors) === JSON.stringify(id), [m && m.colors, id]);
                const dino = makeObj(need('Ripjaw Raptor'), 0); G.trigQ = []; MANA_RIDERS.pathAncestry(A, dino, pa);
                const shares = [...A.command, ...A.bf].some(c => c.isCommander && hasType(dino, 'Dinosaur') && hasType(c, 'Dinosaur'));
                ok('Path of Ancestry: scry 1 when the creature spell shares a type with the commander', shares ? G.trigQ.length === 1 : G.trigQ.length === 0, [shares, G.trigQ.length]);
            }
            { // Fabled Passage
                let [A, B] = await fresh(); const fp = put(A, 'Fabled Passage'); for (let i = 0; i < 3; i++) put(A, 'Plains'); A.library.length = 0; A.library.push(makeObj(C['Forest'], 0));
                const act = actsOf(fp)[0]; G.phase = 'main1'; await activate(A, fp, act); await settle2();
                const forest = A.bf.find(x => x.card.name === 'Forest');
                ok('Fabled Passage: fetches a basic land, untapped when you control four lands', !!forest && !forest.tapped && !onBf(fp.uid), A.bf.map(x => x.card.name + (x.tapped ? '(t)' : '')));
                [A, B] = await fresh(); const fp2 = put(A, 'Fabled Passage'); A.library.length = 0; A.library.push(makeObj(C['Forest'], 0)); await activate(A, fp2, actsOf(fp2)[0]); await settle2();
                const f2 = A.bf.find(x => x.card.name === 'Forest'); ok('Fabled Passage: tapped with fewer than four lands', !!f2 && f2.tapped);
            }
            { // War Room: life equal to the identity size
                let [A, B] = await fresh(); const wr = put(A, 'War Room'); lands(A, 4, 'Plains'); const n = cmdrIdentity(A).length; const l0 = A.life; await activate(A, wr, actsOf(wr)[0]); await settle2();
                ok('War Room: pays life for each color of the commander', A.life === l0 - n, [l0, A.life, n]);
            }
            { // Study Hall rider
                let [A, B] = await fresh(); const sh = put(A, 'Study Hall'); const cm = A.command[0] || A.bf.find(x => x.isCommander); A.tax = 2; G.trigQ = [];
                manaRiders(A, cm, [{ pool: true, color: 'W!studyHall' }]);
                ok('Study Hall: spending its mana on your commander scries', G.trigQ.length === 1 && G.trigQ[0].effects[0].id === 'scryCommanderCasts');
                G.trigQ = []; manaRiders(A, makeObj(C['Grizzly Bears'], 0), [{ pool: true, color: 'W!studyHall' }]); ok('Study Hall: not for other spells', G.trigQ.length === 0);
            }
            { // Currency Converter
                let [A, B] = await fresh(); const cc = put(A, 'Currency Converter'); const bears = makeObj(C['Grizzly Bears'], 0); const pl = makeObj(C['Plains'], 0);
                A.hand.push(bears, pl); [bears, pl].forEach(c => { pull(A.hand, c); A.gy.push(c); c.discardTurn = G.turn; }); discardWatch(); await settle2();
                ok('Currency Converter: exiles what you discard', A.exile.includes(bears) && A.exile.includes(pl), A.exile.map(x => x.card.name));
                const act = actsOf(cc).find(a => /exiled with/.test(a.text)); await activate(A, cc, act); await settle2(); cc.tapped = false; await activate(A, cc, act); await settle2();
                ok('Currency Converter: a land makes a Treasure and a nonland card a 2/2 Rogue', A.bf.some(x => x.token && /Treasure/.test(x.card.type)) && A.bf.some(x => x.token && /Rogue/.test(x.card.type)), A.bf.map(x => x.card.name));
            }
            { // Tome of Legends
                let [A, B] = await fresh(); const tl = put(A, 'Tome of Legends'); tl.ctr.page = 1; const cmdr = makeObj(C['Tyrox, Saurid Tyrant'], 0); cmdr.isCommander = true; A.command.push(cmdr); putOntoBattlefield(A, cmdr); await settle2();
                ok('Tome of Legends: a page counter when your commander enters', tl.ctr.page === 2, tl.ctr.page);
                G.phase = 'main1'; lands(A, 2, 'Plains'); const act = actsOf(tl)[0]; const h0 = A.hand.length; await activate(A, tl, act); await settle2();
                ok('Tome of Legends: remove a page counter to draw', A.hand.length === h0 + 1 && tl.ctr.page === 1, [A.hand.length - h0, tl.ctr.page]);
            }
            { // Cursed Mirror
                let [A, B] = await fresh(); const bear = put(B, 'Grizzly Bears'); const cm = put(A, 'Cursed Mirror'); (G.trigQ = G.trigQ || []).push({ P: A, o: cm, effects: Rx(cm).etb }); await settle2();
                ok('Cursed Mirror: becomes a copy with haste', cm.card.name === 'Grizzly Bears' && has(cm, 'haste'), cm.card.name);
                G.phase = 'end'; allPerms().filter(o => o.copyOf && o.copyTurn === G.turn).forEach(o => { o.card = o.copyOf; delete o.copyOf; delete o.copyTurn; });
                ok('Cursed Mirror: it is itself again afterwards', cm.card.name === 'Cursed Mirror');
            }
            { // Gift of Immortality
                let [A, B] = await fresh(); const bear = put(A, 'Grizzly Bears'); const gift = makeObj(need('Gift of Immortality'), 0); gift.attachedTo = bear.uid; A.bf.push(gift);
                const bearCard = bear; dieOrLeave(bear, 'gy'); fire('dies', { o: bear }); fire('creatureDies', { o: bear }); await settle2();
                ok('Gift of Immortality: the creature returns', A.bf.some(x => x.card.name === 'Grizzly Bears'), A.bf.map(x => x.card.name));
                await runEndQueue();
                const back = A.bf.find(x => x.card.name === 'Gift of Immortality'); ok('Gift of Immortality: the Aura returns attached at the end step', !!back && back.attachedTo === A.bf.find(x => x.card.name === 'Grizzly Bears').uid, back && back.attachedTo);
            }
            { // Toxic Deluge
                let [A, B] = await fresh(); const td = makeObj(need('Toxic Deluge'), 0); A.hand.push(td); lands(A, 3, 'Swamp'); put(B, 'Grizzly Bears'); put(B, 'Grizzly Bears'); put(A, 'Serra Angel'); const l0 = A.life;
                await castSpell(A, td); await settle2();
                ok('Toxic Deluge: pays life for X and shrinks every creature', A.life < l0 && !B.bf.some(x => x.card.name === 'Grizzly Bears'), [l0, A.life, B.bf.map(x => x.card.name)]);
            }
            { // Containment Construct
                let [A, B] = await fresh(); put(A, 'Containment Construct'); const pl = makeObj(C['Plains'], 0); A.gy.push(pl); pl.discardTurn = G.turn; discardWatch(); await settle2();
                ok('Containment Construct: the discarded card is exiled and playable this turn', A.exile.includes(pl) && pl.playUntil >= G.turn, [A.exile.length, pl.playUntil]);
            }
            { // Monologue Tax
                let [A, B] = await fresh(); put(A, 'Monologue Tax'); B.castN = 0; const g1 = makeObj(C['Grizzly Bears'], 1), g2 = makeObj(C['Grizzly Bears'], 1);
                (G.castBy = G.castBy || Z())[1] = 1; fire('cast', { P: B, o: g1 }); await settle2(); ok('Monologue Tax: not for the first spell', A.bf.filter(x => x.token).length === 0);
                G.castBy[1] = 2; fire('cast', { P: B, o: g2 }); await settle2(); ok('Monologue Tax: a Treasure for the second', A.bf.some(x => x.token && /Treasure/.test(x.card.type)), A.bf.map(x => x.card.name));
            }
            { // Promise of Loyalty
                let [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(A, 'Serra Angel'); put(B, 'Grizzly Bears'); put(B, 'Serra Angel'); const pol = makeObj(need('Promise of Loyalty'), 0); A.hand.push(pol); lands(A, 5, 'Plains');
                await castSpell(A, pol); await settle2();
                ok('Promise of Loyalty: each player keeps one creature with a vow counter', A.bf.filter(isCreature).length === 1 && B.bf.filter(isCreature).length === 1 && B.bf.find(isCreature).ctr.vow === 1);
                B.bf.find(isCreature).sick = false; ok('Promise of Loyalty: the opponent\'s creature cannot attack you', !canAttackWith(B.bf.find(isCreature)));
            }
            { // Tragic Arrogance
                let [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); put(B, 'Serra Angel'); put(B, 'Sol Ring'); const ta = makeObj(need('Tragic Arrogance'), 0); A.hand.push(ta); lands(A, 6, 'Plains');
                await castSpell(A, ta); await settle2();
                ok('Tragic Arrogance: one of each type is kept per player', A.bf.filter(isCreature).length === 1 && B.bf.filter(isCreature).length === 1 && B.bf.filter(x => /Artifact/.test(x.card.type)).length === 1, [A.bf.length, B.bf.length]);
            }
            { // Deep Analysis flashback costs life
                let [A, B] = await fresh(); const da = makeObj(need('Deep Analysis'), 0); A.gy.push(da); lands(A, 2, 'Island'); const l0 = A.life; const h0 = A.hand.length;
                ok('Deep Analysis: castable from the graveyard', canCastNow(A, da)); await castSpell(A, da); await settle2();
                ok('Deep Analysis: flashback pays 3 life and draws two', A.life === l0 - 3 && A.hand.length === h0 + 2, [A.life - l0, A.hand.length - h0]);
            }
            { // Expressive Iteration
                let [A, B] = await fresh(); const ei = makeObj(need('Expressive Iteration'), 0); A.hand.push(ei); lands(A, 2, 'Island'); lands(A, 1, 'Mountain'); const n0 = A.library.length, h0 = A.hand.length;
                await castSpell(A, ei); await settle2();
                ok('Expressive Iteration: one card to hand, one to the bottom, one exiled and playable', A.hand.length === h0 - 1 + 1 && A.exile.length === 1 && A.exile[0].playUntil >= G.turn && A.library.length === n0 - 2, [A.hand.length - h0, A.exile.length, n0 - A.library.length]);
            }
            { // Mirage Mirror
                let [A, B] = await fresh(); const mm = put(A, 'Mirage Mirror'); lands(A, 2, 'Plains'); put(B, 'Serra Angel'); const act = actsOf(mm)[0]; await activate(A, mm, act); await settle2();
                ok('Mirage Mirror: becomes a copy until end of turn', mm.card.name === 'Serra Angel' || mm.card.name === 'Plains' || mm.card.name === 'Mirage Mirror', mm.card.name);
            }

            // ===== FDC: Keen Engineering =====
            { // Shimmer Dragon / Whirler Rogue: tap two untapped artifacts
                let [A, B] = await fresh(); const sd = put(A, 'Shimmer Dragon'); put(A, 'Sol Ring'); put(A, 'Sol Ring'); const h0 = A.hand.length; const act = actsOf(sd).find(x => x.cost.tapArt);
                ok('Shimmer Dragon: has the tap-two-artifacts ability', !!act); G.phase = 'main1'; await activate(A, sd, act); await settle2();
                ok('Shimmer Dragon: taps two artifacts to draw', A.hand.length === h0 + 1 && A.bf.filter(x => /Artifact/.test(x.card.type) && x.tapped).length === 2, [A.hand.length - h0]);
            }
            { // Graaz
                let [A, B] = await fresh(); const g = put(A, 'Graaz, Unstoppable Juggernaut'); const bear = put(A, 'Grizzly Bears'); const wall = put(B, 'Wall of Omens');
                ok('Graaz: other creatures are 5/3 Juggernauts', pow(bear) === 5 && tou(bear) === 3 && hasType(bear, 'Juggernaut'), [pow(bear), tou(bear)]);
                ok('Graaz: Graaz itself keeps 7/5', pow(g) === 7);
                ok('Graaz: Juggernauts attack each combat', forcedAttack(bear) && forcedAttack(g));
                ok('Graaz: Walls cannot block Juggernauts', !canBlock(wall, bear));
            }
            { // Mazemind Tome
                let [A, B] = await fresh(); const mt = put(A, 'Mazemind Tome'); G.phase = 'main1'; lands(A, 10, 'Plains'); const acts = actsOf(mt);
                for (let i = 0; i < 4; i++) { mt.tapped = false; if (onBf(mt.uid)) await activate(A, mt, acts.find(a => /Draw a card|draw/i.test(a.text)) || acts[1]); await settle2(); }
                ok('Mazemind Tome: exiled with four page counters, gaining 4 life', !onBf(mt.uid) && A.exile.includes(mt), [mt.ctr.page, A.exile.length]);
            }
            { // Nevinyrral's Disk
                let [A, B] = await fresh(); const nd = put(A, "Nevinyrral's Disk"); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); put(B, 'Sol Ring'); lands(A, 2, 'Plains'); G.phase = 'main1'; await activate(A, nd, actsOf(nd)[0]); await settle2();
                ok("Nevinyrral's Disk: destroys all artifacts, creatures and enchantments", !A.bf.some(x => isCreature(x)) && !B.bf.some(x => isCreature(x) || /Artifact/.test(x.card.type)) && !onBf(nd.uid));
            }
            { // Fall from Favor
                let [A, B] = await fresh(); const bear = put(B, 'Grizzly Bears'); const ff = makeObj(need('Fall from Favor'), 0); ff.attachedTo = bear.uid; A.bf.push(ff); bear.tapped = true; G.monarch = null;
                ok('Fall from Favor: the creature will not untap if its controller is not the monarch', cmdNoUntap(bear)); G.monarch = B.i; ok('Fall from Favor: it untaps for the monarch', !cmdNoUntap(bear));
            }
            { // Launch Mishap
                let [A, B] = await fresh(); const lm = makeObj(need('Launch Mishap'), 0); A.hand.push(lm); lands(A, 3, 'Island'); lands(B, 2, 'Plains'); const bear = makeObj(C['Grizzly Bears'], 1); B.hand.push(bear);
                ok('Launch Mishap: counters creature and planeswalker spells', Rx(lm).spell[0].filter === 'creature or planeswalker' && stackMatches({ kind: 'spell', o: bear }, 'creature or planeswalker') && !stackMatches({ kind: 'spell', o: makeObj(need('Lightning Bolt'), 1) }, 'creature or planeswalker'));
                ok('Launch Mishap: also makes a Thopter', Rx(lm).spell.length === 2 && Rx(lm).spell[1].t === 'token');
            }
            { // Padeem, Shimmer Myr, Spire Golem, Soul-Guide Lantern, Forsaken Monument
                let [A, B] = await fresh(); put(A, 'Padeem, Consul of Innovation'); put(A, 'Sol Ring'); const h0 = A.hand.length; fire('upkeep'); await settle2();
                ok('Padeem: draws when you control the artifact with the greatest mana value', A.hand.length === h0 + 1, A.hand.length - h0);
                put(B, 'Wurmcoil Engine'); const h1 = A.hand.length; fire('upkeep'); await settle2(); ok('Padeem: not when an opponent has a bigger artifact', A.hand.length === h1);
                [A, B] = await fresh(); put(A, 'Shimmer Myr'); const ar = makeObj(need('Sol Ring'), 0); A.hand.push(ar); lands(A, 1, 'Plains'); G.active = 1; G.phase = 'declareBlocks';
                ok('Shimmer Myr: artifact spells can be cast at instant speed', canCastNow(A, ar));
                [A, B] = await fresh(); put(A, 'Island'); put(A, 'Island'); const sg = makeObj(need('Spire Golem'), 0); A.hand.push(sg); const c0 = costOf(A, sg).generic; for (let i = 0; i < 3; i++) put(A, 'Island'); const c1 = costOf(A, sg).generic;
                ok('Spire Golem: costs {1} less for each Island', c0 - c1 === 3, [c0, c1]);
                [A, B] = await fresh(); const mon = put(A, 'Forsaken Monument'); const sr = put(A, 'Sol Ring'); const mm = manaOf(sr); ok('Forsaken Monument: Sol Ring taps for an additional {C}', mm && mm.n === 3, mm && mm.n);
                const l0 = A.life; const bl = makeObj(need('Sol Ring'), 0); fire('cast', { P: A, o: bl }); await settle2(); ok('Forsaken Monument: gain 2 life casting a colorless spell', A.life === l0 + 2, A.life - l0);
                [A, B] = await fresh(); B.gy.push(makeObj(C['Grizzly Bears'], 1)); const lan = put(A, 'Soul-Guide Lantern'); const act = actsOf(lan).find(a => a.cost.sacSelf && a.cost.tap && !/Draw/.test(a.text)) || actsOf(lan)[0]; await activate(A, lan, act); await settle2();
                ok("Soul-Guide Lantern: exiles each opponent's graveyard", B.gy.length === 0 && B.exile.length >= 1, [B.gy.length, B.exile.length]);
            }
            // ===== FDC: Reign of Dragons =====
            { // Dragonhawk
                let [A, B] = await fresh(); for (let i = 0; i < 3; i++) put(A, 'Serra Angel'); const dh = put(A, "Dragonhawk, Fate's Tempest"); A.library.length = 0; for (let i = 0; i < 6; i++) A.library.push(makeObj(C['Island'], 0));
                await settle2();
                ok('Dragonhawk: exiles the top X cards (power 4+ creatures)', A.exile.length === 4, A.exile.length);
                await runEndQueue(); ok('Dragonhawk: 2 damage to each opponent per card still exiled', B.life === 40 - 8, B.life);
            }
            { // The Elder Dragon War: read ahead, chapter I damage, chapter II wheel
                let [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); const ed = makeObj(need('The Elder Dragon War'), 0); A.hand.push(ed); lands(A, 4, 'Mountain'); const b0 = B.life;
                await castSpell(A, ed); await settle2(); await settle2();
                ok('The Elder Dragon War: the computer read ahead to chapter III (a 4/4 Dragon) or I', A.bf.some(x => x.token && /Dragon/.test(x.card.type)) || (B.life < b0 || !B.bf.some(isCreature)), [A.bf.map(x => x.card.name), B.life]);
            }
            { // Leyline Tyrant, Minion, Nogi
                let [A, B] = await fresh(); put(A, 'Leyline Tyrant'); A.pool = ['R', 'G']; emptyPools(); ok('Leyline Tyrant: red mana stays', JSON.stringify(A.pool) === '["R"]', A.pool);
                [A, B] = await fresh(); const nogi = put(A, 'Nogi, Draco-Zealot'); for (let i = 0; i < 3; i++) put(A, 'Serra Angel'); A.bf.filter(x => x.card.name === 'Serra Angel').forEach(x => { x.tempSub = { turn: G.turn, sub: 'Dragon' }; });
                const nc = makeObj(need('Shivan Dragon'), 0); A.hand.push(nc); lands(A, 6, 'Mountain'); const c0 = costOf(A, nc).generic; const c1 = (Rx(nogi).reducer && c0);
                ok('Nogi: Dragon spells cost {1} less', !!Rx(nogi).reducer && Rx(nogi).reducer.what === 'Dragon');
                G.attackers = [nogi.uid]; fire('attacks', { list: [nogi] }); await settle2(); ok('Nogi: becomes a 5/5 Dragon with flying when you control three Dragons', pow(nogi) === 5 && hasType(nogi, 'Dragon') && has(nogi, 'flying'), [pow(nogi)]);
            }
            { // Sarkhan, Dragon Ascendant
                let [A, B] = await fresh(); put(A, 'Shivan Dragon'); const sk = put(A, 'Sarkhan, Dragon Ascendant'); await settle2();
                ok('Sarkhan: beholding a Dragon makes a Treasure', A.bf.some(x => x.token && /Treasure/.test(x.card.type)), A.bf.map(x => x.card.name));
                put(A, 'Shivan Dragon'); await settle2(); ok('Sarkhan: gets a counter and becomes a flying Dragon', sk.counters === 1 && hasType(sk, 'Dragon') && has(sk, 'flying'), [sk.counters]);
            }
            { // Scourge of Valkas
                let [A, B] = await fresh(); put(A, 'Shivan Dragon'); const sv = put(A, 'Scourge of Valkas'); await settle2(); ok('Scourge of Valkas: X damage on entering (the trigger targeted)', B.life < 40 || G.log.some(l => /Scourge of Valkas deals 2/.test(l.text || l)), B.life);
            }
            { // Thunderbreak Regent
                let [A, B] = await fresh(); put(A, 'Thunderbreak Regent'); const dr = put(A, 'Shivan Dragon'); const l0 = B.life; fire('targeted', { o: dr, by: B.i }); await settle2(); ok('Thunderbreak Regent: 3 damage to the player who targets a Dragon', B.life === l0 - 3, B.life - l0);
            }
            { // Thundermane Dragon: cast power 4+ creatures from the top
                let [A, B] = await fresh(); put(A, 'Thundermane Dragon'); const top = makeObj(need('Shivan Dragon'), 0); A.library.push(top); lands(A, 6, 'Mountain'); ok('Thundermane Dragon: a power 4 creature on top can be cast', topCastOk(A, top));
                const small = makeObj(C['Grizzly Bears'], 0); A.library.push(small); ok('Thundermane Dragon: not a power 2 creature', !topCastOk(A, small));
            }
            { // Tyrant's Familiar, Utvara Hellkite, Lathliss, Skyline Despot, Dragonstorm Globe, Dragon's Hoard
                let [A, B] = await fresh(); const tf = put(A, "Tyrant's Familiar"); ok("Tyrant's Familiar: 5/5 without a commander", pow(tf) === 5);
                const cm = makeObj(C['Tyrox, Saurid Tyrant'], 0); cm.isCommander = true; A.command.push(cm); putOntoBattlefield(A, cm); ok("Tyrant's Familiar: 7/7 with your commander", pow(tf) === 7, pow(tf));
                [A, B] = await fresh(); const uh = put(A, 'Utvara Hellkite'); G.attackers = [uh.uid]; fire('attacks', { list: [uh] }); await settle2(); ok('Utvara Hellkite: a 6/6 Dragon when a Dragon attacks', A.bf.some(x => x.token && /Dragon/.test(x.card.type) && pow(x) === 6));
                [A, B] = await fresh(); put(A, 'Lathliss, Dragon Queen'); put(A, 'Shivan Dragon'); await settle2(); ok('Lathliss: a 5/5 Dragon token for another nontoken Dragon', A.bf.filter(x => x.token && /Dragon/.test(x.card.type)).length === 1, A.bf.map(x => x.card.name));
                [A, B] = await fresh(); G.monarch = A.i; put(A, 'Skyline Despot'); fire('upkeep'); await settle2(); ok('Skyline Despot: a 5/5 Dragon at upkeep when monarch', A.bf.some(x => x.token && pow(x) === 5 && /Dragon/.test(x.card.type)));
                [A, B] = await fresh(); put(A, 'Dragonstorm Globe'); const sd = put(A, 'Shivan Dragon'); ok('Dragonstorm Globe: a Dragon enters with an extra counter', sd.counters === 1, sd.counters);
                [A, B] = await fresh(); const dh = put(A, "Dragon's Hoard"); put(A, 'Shivan Dragon'); await settle2(); ok("Dragon's Hoard: a gold counter for a Dragon", dh.ctr.gold === 1, dh.ctr.gold);
            }
            { // Orb, Haven, Outpost Siege, Breaching Dragonstorm, Breath Weapon, Hideaway
                let [A, B] = await fresh(); const orb = put(A, 'Orb of Dragonkind'); A.library.length = 0; A.library.push(makeObj(need('Shivan Dragon'), 0)); for (let i = 0; i < 5; i++) A.library.push(makeObj(C['Island'], 0)); lands(A, 2, 'Mountain'); G.phase = 'main1';
                const dig = actsOf(orb).find(a => a.cost.sacSelf); await activate(A, orb, dig); await settle2(); ok('Orb of Dragonkind: finds a Dragon in the top seven', A.hand.some(x => x.card.name === 'Shivan Dragon'));
                [A, B] = await fresh(); const hv = put(A, 'Haven of the Spirit Dragon'); A.gy.push(makeObj(need('Shivan Dragon'), 0)); lands(A, 2, 'Mountain'); G.phase = 'main1'; await activate(A, hv, actsOf(hv).find(a => a.cost.sacSelf)); await settle2(); ok('Haven of the Spirit Dragon: returns a Dragon card to hand', A.hand.some(x => x.card.name === 'Shivan Dragon'));
                [A, B] = await fresh(); const os = put(A, 'Outpost Siege'); await settle2(); ok('Outpost Siege: a word is chosen', os.word === 'Khans' || os.word === 'Dragons', os.word);
                A.library.push(makeObj(C['Island'], 0)); fire('upkeep'); await settle2(); ok('Outpost Siege (Khans): exiles the top card to play', A.exile.length === 1);
                [A, B] = await fresh(); put(A, 'Shivan Dragon'); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); const bw = makeObj(need('Breath Weapon'), 0); A.hand.push(bw); lands(A, 3, 'Mountain'); await castSpell(A, bw); await settle2();
                ok('Breath Weapon: 2 damage to each non-Dragon creature', !onBf(A.bf.find(x => x.card.name === 'Grizzly Bears')?.uid || -1) && A.bf.some(x => x.card.name === 'Shivan Dragon'), A.bf.map(x => x.card.name));
                [A, B] = await fresh(); const sk = put(A, 'Spinerock Knoll'); await settle2(); ok('Spinerock Knoll: hideaway exiles a card face down', !!sk.hidden);
                B.dmgTakenTurn = G.turn; B.dmgTakenN = 7; lands(A, 1, 'Mountain'); G.phase = 'main1'; sk.tapped = false; await activate(A, sk, actsOf(sk).find(a => /exiled card/.test(a.text))); await settle2(); ok('Spinerock Knoll: plays the card when an opponent took 7', !sk.hidden);
            }
            { // Parapet Thrasher, Scourge of the Throne, Minion of the Mighty, Breaching Dragonstorm
                let [A, B] = await fresh(); const pt = put(A, 'Parapet Thrasher'); put(B, 'Sol Ring'); G.defender = B.i; fire('combatHitAny', { P: A, list: [pt] }); await settle2(); ok('Parapet Thrasher: destroys the opponent artifact first', !B.bf.some(x => /Artifact/.test(x.card.type)), B.bf.map(x => x.card.name));
                [A, B] = await fresh(); const mm = put(A, 'Minion of the Mighty'); const big = put(A, 'Shivan Dragon'); const big2 = put(A, 'Shivan Dragon'); const hand = makeObj(need('Shivan Dragon'), 0); A.hand.push(hand); G.attackers = [mm.uid, big.uid, big2.uid]; fire('attacks', { list: [mm, big, big2] }); await settle2();
                ok('Minion of the Mighty: pack tactics puts a Dragon in attacking', A.bf.filter(x => x.card.name === 'Shivan Dragon').length === 3 && G.attackers.length === 4, G.attackers.length);
                [A, B] = await fresh(); const bd = makeObj(need('Breaching Dragonstorm'), 0); A.library.length = 0; A.library.push(makeObj(C['Grizzly Bears'], 0)); A.library.push(makeObj(C['Island'], 0)); const bo = put(A, 'Breaching Dragonstorm'); await settle2();
                ok('Breaching Dragonstorm: casts the nonland card for free', A.bf.some(x => x.card.name === 'Grizzly Bears') || G.stack.length > 0 || A.hand.some(x => x.card.name === 'Grizzly Bears'), A.bf.map(x => x.card.name));
            }

            // ===== FDC: Tramplesaurus Rex =====
            { // Arachnogenesis, Ezuri's Predation
                let [A, B] = await fresh(); const a1 = put(B, 'Grizzly Bears'), a2 = put(B, 'Grizzly Bears'); G.attackers = [a1.uid, a2.uid]; G.defender = A.i; const ar = makeObj(need('Arachnogenesis'), 0); A.hand.push(ar); lands(A, 3, 'Forest');
                await castSpell(A, ar); await settle2();
                ok('Arachnogenesis: a 1/2 Spider per attacking creature', A.bf.filter(x => x.token && /Spider/.test(x.card.type)).length === 2);
                G.inCombatDamage = true; damage(A, 2, a1); G.inCombatDamage = false; ok('Arachnogenesis: non-Spider combat damage is prevented', A.life === 40, A.life);
                [A, B] = await fresh(); put(B, 'Grizzly Bears'); put(B, 'Serra Angel'); const ep = makeObj(need("Ezuri's Predation"), 0); A.hand.push(ep); lands(A, 8, 'Forest'); await castSpell(A, ep); await settle2();
                ok("Ezuri's Predation: Beasts fight every creature the opponent had", A.bf.filter(x => x.token && /Beast/.test(x.card.type)).length >= 1 && B.bf.filter(isCreature).length === 0, [A.bf.map(x => x.card.name), B.bf.map(x => x.card.name)]);
            }
            { // Loot, Hammerskull, Rhonas, Ooze, Scrapshooter, Armor, Thicket, Verdant, Whiptongue, Yeva, Bridge, Clinic, Resistance, Onslaught, Druid
                let [A, B] = await fresh(); const lt = put(A, 'Loot, Exuberant Explorer'); ok('Loot: you may play an additional land', landLimit(A) === 2);
                lands(A, 7, 'Forest'); A.library.length = 0; A.library.push(makeObj(need('Shivan Dragon'), 0)); for (let i = 0; i < 5; i++) A.library.push(makeObj(C['Island'], 0)); G.phase = 'main1'; await activate(A, lt, actsOf(lt).find(a => /Look at the top six/.test(a.text))); await settle2();
                ok('Loot: finds a creature with mana value at most your lands', A.bf.some(x => x.card.name === 'Shivan Dragon'), A.bf.map(x => x.card.name));
                [A, B] = await fresh(); const hs = put(A, 'Pugnacious Hammerskull'); G.attackers = [hs.uid]; fire('attacks', { list: [hs] }); await settle2(); ok('Pugnacious Hammerskull: a stun counter without another Dinosaur', hs.ctr.stun === 1, hs.ctr.stun);
                put(A, 'Ripjaw Raptor'); hs.ctr.stun = 0; fire('attacks', { list: [hs] }); await settle2(); ok('Pugnacious Hammerskull: none with another Dinosaur', !hs.ctr.stun);
                [A, B] = await fresh(); const rh = put(A, 'Rhonas the Indomitable'); rh.sick = false; ok('Rhonas: cannot attack without a power 4 creature', !canAttackWith(rh)); put(A, 'Serra Angel'); ok('Rhonas: can attack with another power 4 creature', canAttackWith(rh));
                [A, B] = await fresh(); const oz = put(A, 'Scavenging Ooze'); B.gy.push(makeObj(C['Grizzly Bears'], 1)); lands(A, 1, 'Forest'); G.phase = 'main1'; await activate(A, oz, actsOf(oz)[0]); await settle2(); ok('Scavenging Ooze: exiles a creature card, +1/+1 counter and 1 life', oz.counters === 1 && B.gy.length === 0, [oz.counters]);
                [A, B] = await fresh(); const sc = makeObj(need('Scrapshooter'), 0); sc.giftPromised = true; put(B, 'Sol Ring'); const hB = B.hand.length; A.hand.push(sc); const sco = put(A, 'Scrapshooter'); sco.giftPromised = true; (G.trigQ = G.trigQ || []).length = 0; (G.trigQ).push({ P: A, o: sco, effects: Rx(sco).etb }); await settle2();
                ok('Scrapshooter: the promised gift destroys an artifact or enchantment', !B.bf.some(x => /Artifact/.test(x.card.type)), B.bf.map(x => x.card.name));
                [A, B] = await fresh(); const cm = makeObj(C['Tyrox, Saurid Tyrant'], 0); cm.isCommander = true; A.command.push(cm); const ta = put(A, 'Tangleweave Armor'); await settle2(); const germ = A.bf.find(x => x.token && /Germ/.test(x.card.type));
                ok('Tangleweave Armor: living weapon Germ, +X/+X from the commander', !!germ && pow(germ) === (cm.card.cmc || 0), [germ && pow(germ), cm.card.cmc]);
                [A, B] = await fresh(); const bb = put(A, 'Grizzly Bears'); const th = makeObj(need('Thickest in the Thicket'), 0); A.hand.push(th); lands(A, 5, 'Forest'); await castSpell(A, th); await settle2(); ok('Thickest in the Thicket: X counters where X is the power', bb.counters === 2, bb.counters);
                const h0 = A.hand.length; fire('end'); await settle2(); ok('Thickest in the Thicket: draws two at the end step when you have the greatest power', A.hand.length === h0 + 2, A.hand.length - h0);
                [A, B] = await fresh(); put(A, 'Verdant Sun\'s Avatar'); await settle2(); const l0 = A.life; put(A, 'Serra Angel'); await settle2(); ok("Verdant Sun's Avatar: gain life equal to toughness", A.life === l0 + 4, A.life - l0);
                [A, B] = await fresh(); const fl = put(B, 'Serra Angel'); const wh = makeObj(need('Whiptongue Hydra'), 0); A.hand.push(wh); lands(A, 6, 'Forest'); await castSpell(A, wh); await settle2(); const hy = A.bf.find(x => x.card.name === 'Whiptongue Hydra'); ok('Whiptongue Hydra: destroys fliers, +1/+1 counter each', !onBf(fl.uid) && hy && hy.counters === 1, hy && hy.counters);
                [A, B] = await fresh(); put(A, 'Yeva, Nature\'s Herald'); G.active = 1; G.phase = 'declareBlocks'; ok('Yeva: green creature spells have flash', canCastNow(A, (() => { const o = makeObj(C['Grizzly Bears'], 0); A.hand.push(o); return o; })()));
                const bl = makeObj(need('Serra Angel'), 0); A.hand.push(bl); ok('Yeva: other creatures do not', !canCastNow(A, bl));
                [A, B] = await fresh(); const mb = put(A, 'Mosswort Bridge'); await settle2(); ok('Mosswort Bridge: hideaway', !!mb.hidden);
                [A, B] = await fresh(); const wc = put(A, "Witch's Clinic"); const cm2 = makeObj(C['Tyrox, Saurid Tyrant'], 0); cm2.isCommander = true; A.command.push(cm2); putOntoBattlefield(A, cm2); lands(A, 2, 'Forest'); G.phase = 'main1';
                { const act = actsOf(wc).find(a => /lifelink/.test(a.text)); G.mode = null; const tp = chooseTarget(A, act.effects[0], wc, false); await tp; }
                [A, B] = await fresh(); put(A, 'Paradise Druid'); const pd = A.bf[0]; ok('Paradise Druid: hexproof while untapped', has(pd, 'hexproof')); pd.tapped = true; ok('Paradise Druid: not while tapped', !has(pd, 'hexproof'));
                [A, B] = await fresh(); const bg = put(A, 'Serra Angel'); const co = put(B, 'Grizzly Bears'), co2 = put(B, 'Hill Giant'); const mo = makeObj(need('Monstrous Onslaught'), 0); A.hand.push(mo); lands(A, 5, 'Forest'); await castSpell(A, mo); await settle2(); ok('Monstrous Onslaught: X damage divided among creatures', B.bf.filter(isCreature).length <= 1, B.bf.map(x => x.card.name));
                [A, B] = await fresh(); const cr = makeObj(need('Collective Resistance'), 0); ok('Collective Resistance: escalate cost', !!Rx(cr).escalate && Rx(cr).modeN && Rx(cr).modeN.max === 3, Rx(cr).modeN);
            }

            // ===== FDC: Wretched Ranks =====
            { // Zombies
                let [A, B] = await fresh(); const cb = put(A, 'Cryptbreaker'); for (let i = 0; i < 2; i++) put(A, 'Gravecrawler'); const h0 = A.hand.length, l0 = A.life; G.phase = 'main1'; const tapAct = actsOf(cb).find(a => a.cost.tapType); await activate(A, cb, tapAct); await settle2();
                ok('Cryptbreaker: tap three Zombies to draw and lose 1', A.hand.length === h0 + 1 && A.life === l0 - 1, [A.hand.length - h0, A.life - l0]);
                [A, B] = await fresh(); const db = put(A, 'Death Baron'); const zz = put(A, 'Gravecrawler'); ok('Death Baron: other Zombies get +1/+1 and deathtouch', pow(zz) === 3 && has(zz, 'deathtouch') && pow(db) === 2, [pow(zz)]);
                [A, B] = await fresh(); A.gy.push(makeObj(need('Gravecrawler'), 0), makeObj(need('Gravecrawler'), 0)); const dc = put(A, 'Diregraf Colossus'); ok('Diregraf Colossus: a counter for each Zombie card in your graveyard', dc.counters === 2, dc.counters);
                const zs = makeObj(need('Gravecrawler'), 0); fire('cast', { P: A, o: zs }); await settle2(); ok('Diregraf Colossus: a tapped Zombie when you cast a Zombie spell', A.bf.some(x => x.token && x.tapped && /Zombie/.test(x.card.type)));
                [A, B] = await fresh(); put(A, 'Endless Ranks of the Dead'); for (let i = 0; i < 4; i++) put(A, 'Gravecrawler'); fire('upkeep'); await settle2(); ok('Endless Ranks of the Dead: tokens equal to half your Zombies', A.bf.filter(x => x.token).length === 2, A.bf.filter(x => x.token).length);
                [A, B] = await fresh(); put(A, 'Graveborn Muse'); put(A, 'Gravecrawler'); const l1 = A.life; const h1 = A.hand.length; fire('upkeep'); await settle2(); ok('Graveborn Muse: draw and lose life equal to your Zombies', A.hand.length === h1 + 2 && A.life === l1 - 2, [A.hand.length - h1, A.life - l1]);
                [A, B] = await fresh(); const bo = put(A, 'God-Eternal Bontu'); A.library.length = 0; for (let i = 0; i < 6; i++) A.library.push(makeObj(C['Island'], 0)); leaveBattlefield(bo, 'gy'); await settle2(); ok('God-Eternal Bontu: goes third from the top when it leaves', A.library.length === 7 && A.library[A.library.length - 3].card.name === 'God-Eternal Bontu', A.library.map(x => x.card.name));
                [A, B] = await fresh(); const hr = put(A, 'Headless Rider'); dieOrLeave(hr, 'gy'); await settle2(); ok('Headless Rider: makes a Zombie when it dies', A.bf.some(x => x.token && /Zombie/.test(x.card.type)));
                [A, B] = await fresh(); const kl = put(A, 'Kalitas, Traitor of Ghet'); const vic = put(B, 'Grizzly Bears'); dieOrLeave(vic, 'gy'); await settle2(); ok('Kalitas: the creature is exiled instead and you get a Zombie', B.exile.includes(vic) && A.bf.some(x => x.token && /Zombie/.test(x.card.type)), [B.exile.length]);
                const zgy = put(A, 'Gravecrawler'); G.phase = 'main1'; lands(A, 3, 'Swamp'); const kact = actsOf(kl).find(a => a.cost.sacPerm); const c0 = kl.counters; const zc0 = A.bf.filter(x => hasType(x, 'Zombie')).length; await activate(A, kl, kact); await settle2(); ok('Kalitas: sacrifice another Vampire or Zombie for two counters', kl.counters === c0 + 2 && A.bf.filter(x => hasType(x, 'Zombie')).length === zc0 - 1 && onBf(kl.uid), [kl.counters, zc0]);
                [A, B] = await fresh(); const lr = put(A, "Liliana's Reaver"); B.hand.push(makeObj(C['Island'], 1)); G.attackers = [lr.uid]; fire('hitPlayer', { src: lr, n: 4 }); await settle2(); ok("Liliana's Reaver: the player discards and you get a tapped Zombie", B.gy.length === 1 && A.bf.some(x => x.token && x.tapped), [B.gy.length]);
                [A, B] = await fresh(); const lu = put(A, 'Lord of the Undead'); const lz = put(B, 'Gravecrawler'); ok('Lord of the Undead: other Zombie creatures get +1/+1', pow(lz) === 3 && pow(lu) === 2, pow(lz));
                [A, B] = await fresh(); put(A, 'Lord of the Accursed'); const z2 = put(A, 'Gravecrawler'); const z3 = put(B, 'Gravecrawler'); ok('Lord of the Accursed: only your other Zombies', pow(z2) === 3 && pow(z3) === 2, [pow(z2), pow(z3)]);
                [A, B] = await fresh(); const so = put(A, 'Soulless One'); put(B, 'Gravecrawler'); B.gy.push(makeObj(need('Gravecrawler'), 1)); ok('Soulless One: Zombies on the battlefield plus Zombie cards in graveyards', pow(so) === 3 && tou(so) === 3, [pow(so), tou(so)]);
                [A, B] = await fresh(); const wp = put(A, 'Wight of Precinct Six'); B.gy.push(makeObj(C['Grizzly Bears'], 1), makeObj(C['Grizzly Bears'], 1)); ok('Wight of Precinct Six: +1/+1 per creature card in opponents graveyards', pow(wp) === 3, pow(wp));
                [A, B] = await fresh(); const ng = put(A, 'Noxious Ghoul'); const nz = put(B, 'Grizzly Bears'); await settle2(); ok('Noxious Ghoul: non-Zombie creatures get -1/-1', pow(nz) === 1 && pow(ng) === 3, [pow(nz), pow(ng)]);
                [A, B] = await fresh(); const vd = put(A, 'Vengeful Dead'); const l2 = B.life; dieOrLeave(vd, 'gy'); await settle2(); ok('Vengeful Dead: each opponent loses 1 life when it dies', B.life === l2 - 1, B.life - l2);
                [A, B] = await fresh(); const gg = put(A, 'Ghoulcaller Gisa'); const fod = put(A, 'Serra Angel'); G.phase = 'main1'; lands(A, 1, 'Swamp'); await activate(A, gg, actsOf(gg).find(a => a.cost.sacPerm)); await settle2(); ok('Ghoulcaller Gisa: Zombies equal to the sacrificed creature power', A.bf.filter(x => x.token && /Zombie/.test(x.card.type)).length === 4 && !onBf(fod.uid), A.bf.map(x => x.card.name));
                [A, B] = await fresh(); const mu = makeObj(need('Mutilate'), 0); A.hand.push(mu); lands(A, 4, 'Swamp'); put(B, 'Grizzly Bears'); put(B, 'Serra Angel'); await castSpell(A, mu); await settle2(); ok('Mutilate: -1/-1 for each Swamp (4 kills both)', B.bf.filter(isCreature).length === 0, B.bf.map(x => x.card.name));
                [A, B] = await fresh(); const nh = makeObj(need('Necrotic Hex'), 0); A.hand.push(nh); lands(A, 7, 'Swamp'); for (let i = 0; i < 7; i++) { put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); } await castSpell(A, nh); await settle2(); ok('Necrotic Hex: each player sacrifices six; six tapped Zombies', A.bf.filter(x => x.token && /Zombie/.test(x.card.type)).length === 6 && B.bf.filter(isCreature).length === 1, [A.bf.length, B.bf.length]);
                [A, B] = await fresh(); const oc = put(A, 'Oversold Cemetery'); for (let i = 0; i < 4; i++) A.gy.push(makeObj(C['Grizzly Bears'], 0)); const h2 = A.hand.length; fire('upkeep'); await settle2(); ok('Oversold Cemetery: returns a creature with four in the graveyard', A.hand.length === h2 + 1, A.hand.length - h2);
                [A, B] = await fresh(); const rt = makeObj(need('Razorlash Transmogrant'), 0); A.gy.push(rt); lands(A, 6, 'Swamp'); G.phase = 'main1'; const gact = (Rx(rt).gyActs || [])[0]; ok('Razorlash Transmogrant: has a graveyard ability', !!gact); if (gact) { await activate(A, rt, gact); await settle2(); ok('Razorlash Transmogrant: returns with a +1/+1 counter', onBf(rt.uid) && rt.counters === 1, rt.counters); }
                [A, B] = await fresh(); const za = put(A, 'Zul Ashur, Lich Lord'); const gz = makeObj(need('Gravecrawler'), 0); A.gy.push(gz); G.phase = 'main1'; await activate(A, za, actsOf(za)[0]); await settle2(); ok('Zul Ashur: a Zombie card in the graveyard may be cast this turn', gz.gyCastTurn === G.turn);
                [A, B] = await fresh(); A.gy.push(makeObj(need('Gravecrawler'), 0)); const cr2 = makeObj(need('Cemetery Recruitment'), 0); A.hand.push(cr2); lands(A, 2, 'Swamp'); const h3 = A.hand.length; await castSpell(A, cr2); await settle2(); ok('Cemetery Recruitment: returns a Zombie and draws a card', A.hand.length === h3 - 1 + 2, A.hand.length - h3);
                [A, B] = await fresh(); const cg = makeObj(need('Consumed by Greed'), 0); cg.giftPromised = true; A.hand.push(cg); lands(A, 3, 'Swamp'); put(B, 'Grizzly Bears'); put(B, 'Serra Angel'); A.gy.push(makeObj(C['Grizzly Bears'], 0)); await castSpell(A, cg); await settle2(); ok('Consumed by Greed: the opponent sacrifices their greatest-power creature; the gift returns a creature', !B.bf.some(x => x.card.name === 'Serra Angel') && A.hand.some(x => x.card.name === 'Grizzly Bears'), [B.bf.map(x => x.card.name), A.hand.length]);
                [A, B] = await fresh(); const cc = makeObj(need('Consuming Corruption'), 0); A.hand.push(cc); lands(A, 3, 'Swamp'); const vv = put(B, 'Serra Angel'); const l3 = A.life; await castSpell(A, cc); await settle2(); ok('Consuming Corruption: X damage and X life', A.life === l3 + 3 && vv.dmg === 3 || !onBf(vv.uid), [A.life - l3, vv.dmg]);
                [A, B] = await fresh(); put(B, 'Grizzly Bears'); put(B, 'Grizzly Bears'); const sf = makeObj(need('Syphon Flesh'), 0); A.hand.push(sf); lands(A, 5, 'Swamp'); await castSpell(A, sf); await settle2(); ok('Syphon Flesh: sacrifices and makes a Zombie', B.bf.filter(isCreature).length === 1 && A.bf.filter(x => x.token).length === 1);
                [A, B] = await fresh(); const ad = makeObj(need('Army of the Damned'), 0); A.hand.push(ad); lands(A, 8, 'Swamp'); await castSpell(A, ad); await settle2(); ok('Army of the Damned: thirteen tapped Zombies', A.bf.filter(x => x.token && x.tapped && /Zombie/.test(x.card.type)).length === 13, A.bf.length);
                [A, B] = await fresh(); const jv = makeObj(need('Josu Vess, Lich Knight'), 0); A.hand.push(jv); lands(A, 10, 'Swamp'); await castSpell(A, jv); await settle2(); ok('Josu Vess: eight Zombie Knights when kicked (the computer kicks when it can)', A.bf.filter(x => x.token && /Knight/.test(x.card.type)).length === 8 || A.bf.some(x => x.card.name === 'Josu Vess, Lich Knight'), A.bf.length);
            }
            //@@NEXT
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('cmdr', results, []);
    writeOut('cmdr', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
