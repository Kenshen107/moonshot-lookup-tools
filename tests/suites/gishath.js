// Gishath, Sun's Avatar deck (2026-10-15): behavior checks for the cards added for it (rules/gishath.js, 15e-gishath.js).
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
            const byName = new Map(raw.map(c => [c.name, c])); raw.forEach(c => { if (c.name.includes(' // ')) { const f = c.name.split(' // ')[0]; if (!byName.has(f)) byName.set(f, c); } });
            const need = n => { if (!C[n]) { const c = byName.get(n); if (!c) throw new Error('no card ' + n); const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; } return C[n]; };
            ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Lightning Bolt'].forEach(need);
            manaMode = 'auto';
            window.pickCard = async (P, list) => list[0];
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async (humanA = false) => { await newGame(mk(), mk()); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; const [A, B] = G.players; A.isAI = true; B.isAI = true; if (humanA) A.isAI = false; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 20; i++) { A.library.push(makeObj(C['Island'], 0)); B.library.push(makeObj(C['Island'], 1)); } return [A, B]; };
            const put = (P, n, extra) => { need(n); return T.put(P, C[n], extra); };
            const lands = (P, k, n = 'Plains') => { need(n); for (let i = 0; i < k; i++) T.put(P, C[n]); };
            const settle2 = async () => { await settle(); await settle(); };
            const logged = () => G.log.map(l => l.text || l).join('\n');

            const dinoNames = ['Giant Cindermaw', 'Rampaging Brontodon', 'Rampaging Ferocidon', "Burning Sun's Avatar", "Wakening Sun's Avatar", 'Regal Behemoth', 'Marauding Raptor', 'Ghalta and Mavren', 'Scytheclaw Raptor', "Gishath, Sun's Avatar", 'Terminus', 'Eldritch Evolution', 'Virtue of Strength', "Nature's Rhythm", 'Rebuff the Wicked', 'Zacama, Primal Calamity', "Don't Move", 'The Skullspore Nexus', 'Titanoth Rex', 'Bonehoard Dracosaur', 'Pantlaza, Sun-Favored', 'Etali, Primal Conqueror', 'Savage Order', 'Ghalta, Stampede Tyrant', 'Roaming Throne', 'Feat of Resistance'];
            dinoNames.forEach(need);
            const bury = (P, n) => { for (let i = 0; i < n; i++) P.library.push(makeObj(C['Island'], P.i)); };
            { // Gishath: reveal that many cards, Dinosaurs onto the battlefield, the rest to the bottom
                let [A, B] = await fresh(); const g = put(A, "Gishath, Sun's Avatar");
                A.library.length = 0; bury(A, 6); [C['Giant Cindermaw'], C['Island'], C['Rampaging Brontodon']].forEach(c => A.library.push(makeObj(c, 0)));
                const n0 = A.library.length; fire('hitPlayer', { src: g, n: 3 }); await settle2();
                ok('Gishath: both revealed Dinosaurs enter', A.bf.some(x => x.card.name === 'Giant Cindermaw') && A.bf.some(x => x.card.name === 'Rampaging Brontodon'), A.bf.map(x => x.card.name));
                ok('Gishath: the rest goes to the bottom', A.library.length === n0 - 2 && A.library[0].card.name === 'Island', [A.library.length, n0]);
            }
            { // Players can't gain life
                let [A, B] = await fresh(); A.life = 10; await applyEffect(A, { t: 'gain', n: 5 }, null, put(A, 'Grizzly Bears'));
                ok('Life gain works normally', A.life === 15, A.life);
                const cm = put(B, 'Giant Cindermaw'); await applyEffect(A, { t: 'gain', n: 5 }, null, cm); A.life += 3;
                ok("Giant Cindermaw: players can't gain life", A.life === 15, A.life);
                gainLifeFor(A, 4); ok('Giant Cindermaw stops other gain routes too', A.life === 15, A.life);
                A.life -= 2; ok('Losing life still works', A.life === 13, A.life);
                leaveBattlefield(cm, 'gy'); await applyEffect(A, { t: 'gain', n: 2 }, null, put(A, 'Grizzly Bears')); ok('Gain works again once it is gone', A.life === 15, A.life);
                const f = put(A, 'Rampaging Ferocidon'); A.life = 5; gainLifeFor(A, 3); ok("Rampaging Ferocidon: players can't gain life", A.life === 5, A.life);
            }
            { // Feat of Resistance
                let [A, B] = await fresh(); const bears = put(A, 'Grizzly Bears'); const feat = makeObj(C['Feat of Resistance'], 0); A.hand.push(feat); B.hand.push(makeObj(C['Lightning Bolt'], 1));
                lands(A, 2, 'Plains'); ok('Feat of Resistance: castable on a creature', canCastNow(A, feat) && canPay(A, feat));
                await castSpell(A, feat, { o: bears }); await settle2();
                ok('Feat of Resistance: +1/+1 counter and protection', bears.counters === 1 && bears.tkw.some(k => /^pro:/.test(k)), [bears.counters, bears.tkw]);
            }
            { // Scytheclaw Raptor
                let [A, B] = await fresh(); put(A, 'Scytheclaw Raptor'); G.active = 0; A.life = B.life = 20;
                fire('cast', { P: B, o: makeObj(C['Lightning Bolt'], 1) }); await settle2(); ok("Scytheclaw Raptor: a spell cast on someone else's turn deals 4 to its caster", B.life === 16, B.life);
                fire('cast', { P: A, o: makeObj(C['Lightning Bolt'], 0) }); await settle2(); ok('Scytheclaw Raptor: a spell on its caster\'s own turn does nothing', A.life === 20, A.life);
            }
            { // Burning Sun's Avatar
                let [A, B] = await fresh(); B.life = 20; const bb = put(B, 'Grizzly Bears'); put(A, "Burning Sun's Avatar"); await settle2();
                ok("Burning Sun's Avatar: 3 to the opponent", B.life === 17, B.life); ok('and 3 to a creature', !B.bf.includes(bb), B.bf.map(x => x.card.name));
            }
            { // Terminus and miracle
                let [A, B] = await fresh(); put(A, 'Grizzly Bears'); put(B, 'Grizzly Bears'); const tok = put(B, 'Giant Cindermaw');
                await applyEffect(A, { t: 'cmd', id: 'terminus' }, null, makeObj(C['Terminus'], 0));
                ok('Terminus: all creatures leave the battlefield', !A.bf.some(isCreature) && !B.bf.some(isCreature));
                ok('Terminus: they are at the bottom of their owners\' libraries', A.library[0].card.name === 'Grizzly Bears' && B.library[0].card.name !== 'Island' || B.library.slice(0, 2).some(x => x.card.name === 'Grizzly Bears'), [A.library[0].card.name, B.library.slice(0, 2).map(x => x.card.name)]);
                [A, B] = await fresh(); const t = makeObj(C['Terminus'], 0); A.library.push(t); put(B, 'Grizzly Bears'); put(B, 'Grizzly Bears'); put(B, 'Giant Cindermaw'); lands(A, 1, 'Plains');
                drawCards(A, 1); await settle2();
                ok('Terminus: miracle cast for {W} wipes the board', !B.bf.some(isCreature) && A.gy.includes(t), [B.bf.length, A.gy.map(x => x.card.name)]);
                [A, B] = await fresh(); const t2 = makeObj(C['Terminus'], 0); A.library.push(t2); lands(A, 1, 'Plains'); A.library.push(makeObj(C['Island'], 0)); drawCards(A, 2); await settle2();
                ok('Terminus: no miracle when it is not the first card drawn', A.hand.includes(t2), A.hand.map(x => x.card.name));
            }
            { // Wakening Sun's Avatar
                let [A, B] = await fresh(); const ba = put(A, 'Grizzly Bears'); const bb = put(B, 'Grizzly Bears'); const dino = put(B, 'Giant Cindermaw');
                const w = makeObj(C["Wakening Sun's Avatar"], 0); w.wasCast = true; w.castFromHand = G.turn; A.bf.push(w); w.sick = false; fire('enters', { o: w }); G.trigQ.push({ P: A, o: w, effects: Rx(w).etb }); await settle2();
                ok("Wakening Sun's Avatar: non-Dinosaurs are destroyed", !A.bf.includes(ba) && !B.bf.includes(bb) && B.bf.includes(dino) && A.bf.includes(w), [A.bf.map(x => x.card.name), B.bf.map(x => x.card.name)]);
                [A, B] = await fresh(); const bb2 = put(B, 'Grizzly Bears'); put(A, "Wakening Sun's Avatar"); await settle2(); ok("Wakening Sun's Avatar: put onto the battlefield without being cast, nothing happens", B.bf.includes(bb2));
            }
            { // Regal Behemoth and Virtue of Strength
                let [A, B] = await fresh(); const f = put(A, 'Forest'); G.monarch = null; ok('Forest: one mana', manaOf(f).n === 1, manaOf(f));
                put(A, 'Regal Behemoth'); ok('Regal Behemoth: no bonus when you are not the monarch', manaOf(f).n === 1);
                G.monarch = 0; const m = manaOf(f); ok('Regal Behemoth: the monarch\'s land adds one more mana of any color', m.n === 2 && m.colors.includes('R') && m.colors.includes('G'), m);
                G.monarch = 1; ok("Regal Behemoth: not when the other player is the monarch", manaOf(f).n === 1);
                [A, B] = await fresh(); const f2 = put(A, 'Forest'); put(A, 'Virtue of Strength'); ok('Virtue of Strength: a basic land makes three times as much', manaOf(f2).n === 3, manaOf(f2));
                const f3 = put(B, 'Forest'); ok('Virtue of Strength: only your lands', manaOf(f3).n === 1);
            }
            { // Marauding Raptor
                let [A, B] = await fresh(); const r = put(A, 'Marauding Raptor'); const p0 = pow(r); const d = put(A, 'Giant Cindermaw'); await settle2();
                ok('Marauding Raptor: 2 damage to the entering Dinosaur and +2/+0', d.dmg === 2 && pow(r) === p0 + 2, [d.dmg, pow(r), p0]);
                const bears = put(A, 'Grizzly Bears'); await settle2(); ok('Marauding Raptor: a non-Dinosaur takes 2 (and dies) with no bonus', !A.bf.includes(bears) && pow(r) === p0 + 2, pow(r));
            }
            { // Ghalta and Mavren
                let [A, B] = await fresh(); const gm = put(A, 'Ghalta and Mavren'); const b = put(A, 'Grizzly Bears'); G.attackers = [gm.uid, b.uid]; gm.tapped = b.tapped = true;
                fire('attacks', { list: [gm, b] }); await settle2();
                const tk = A.bf.find(x => x.token && /Dinosaur/.test(x.card.type));
                ok('Ghalta and Mavren: a tapped and attacking X/X Dinosaur with trample', !!tk && pow(tk) === 2 && tk.tapped && G.attackers.includes(tk.uid) && has(tk, 'trample'), tk && [pow(tk), tk.tapped]);
                await CMD.mavrenVamp(A, {}, null, gm); ok('Ghalta and Mavren: Vampires with lifelink', A.bf.filter(x => x.token && /Vampire/.test(x.card.type)).length >= 1);
            }
            { // Eldritch Evolution
                let [A, B] = await fresh(); const bears = put(A, 'Grizzly Bears'); lands(A, 3, 'Forest'); const ev = makeObj(C['Eldritch Evolution'], 0); A.hand.push(ev); A.library.push(makeObj(C['Giant Cindermaw'], 0), makeObj(C['Rampaging Brontodon'], 0));
                ok('Eldritch Evolution: castable', canCastNow(A, ev) && canPay(A, ev)); await castSpell(A, ev, null); await settle2();
                ok('Eldritch Evolution: sacrificed the creature and found one with mana value 4 or less', !A.bf.includes(bears) && A.bf.some(x => x.card.name === 'Giant Cindermaw'), A.bf.map(x => x.card.name));
                ok('Eldritch Evolution: the spell is exiled', A.exile.includes(ev) && !A.gy.includes(ev));
            }
            { // Nature's Rhythm: harmonize
                let [A, B] = await fresh(); const nr = makeObj(C["Nature's Rhythm"], 0); A.gy.push(nr); const big = put(A, 'Giant Cindermaw'); lands(A, 4, 'Forest'); A.library.push(makeObj(C['Grizzly Bears'], 0)); nr.xVal = 2;
                ok("Nature's Rhythm: castable from the graveyard when a creature pays the generic part", canCastNow(A, nr) && canPay(A, nr), [canCastNow(A, nr), canPay(A, nr)]);
                await castSpell(A, nr, null); await settle2();
                ok("Nature's Rhythm: tapped the creature, found a creature, and exiled itself", big.tapped && A.bf.some(x => x.card.name === 'Grizzly Bears') && A.exile.includes(nr), [big.tapped, A.bf.map(x => x.card.name), A.exile.map(x => x.card.name)]);
            }
            { // Rebuff the Wicked
                let [A, B] = await fresh(); const bears = put(A, 'Grizzly Bears'); const bolt = makeObj(C['Lightning Bolt'], 1); B.hand.push(bolt); lands(B, 1, 'Mountain'); G.stack.push({ id: 98, kind: 'spell', o: bolt, P: B, target: { o: bears } });
                const rb = makeObj(C['Rebuff the Wicked'], 0); const te = { t: 'counter', target: 'spell', filter: 'targetsMine' };
                ok('Rebuff the Wicked: can target a spell aimed at your permanent', validTargets(A, te, rb).some(v => v.item && v.item.o === bolt), validTargets(A, te, rb).length);
                G.stack.length = 0; const ob = put(B, 'Grizzly Bears'); G.stack.push({ id: 99, kind: 'spell', o: bolt, P: B, target: { o: ob } });
                ok('Rebuff the Wicked: not a spell aimed at their own permanent', !validTargets(A, te, rb).some(v => v.item && v.item.o === bolt));
            }
            { // Zacama
                let [A, B] = await fresh(); lands(A, 3, 'Forest'); A.bf.forEach(x => { x.tapped = true; }); const z = makeObj(C['Zacama, Primal Calamity'], 0); z.wasCast = true; A.bf.push(z); G.trigQ.push({ P: A, o: z, effects: Rx(z).etb }); await settle2();
                ok('Zacama: untaps all your lands when cast', A.bf.filter(x => /Land/.test(x.card.type)).every(x => !x.tapped));
            }
            { // Don't Move
                let [A, B] = await fresh(); const t1 = put(B, 'Grizzly Bears', { tapped: true }); const u1 = put(B, 'Grizzly Bears'); const mine = put(A, 'Grizzly Bears', { tapped: true });
                await applyEffect(A, { t: 'cmd', id: 'dontMove' }, null, makeObj(C["Don't Move"], 0)); sba();
                ok("Don't Move: destroys tapped creatures (both sides)", !B.bf.includes(t1) && B.bf.includes(u1) && !A.bf.includes(mine));
                u1.tapped = true; sba(); ok("Don't Move: a creature that becomes tapped is destroyed", !B.bf.includes(u1));
                G.turn += 2; G.active = 0; sba(); const n1 = put(B, 'Grizzly Bears', { tapped: true }); sba(); ok("Don't Move: ends at the start of your next turn", B.bf.includes(n1) && !G.dontMove);
            }
            { // The Skullspore Nexus
                let [A, B] = await fresh(); const nx = put(A, 'The Skullspore Nexus'); put(A, 'Grizzly Bears'); put(A, 'Giant Cindermaw');
                await applyEffect(B, { t: 'wipe', how: 'destroy', what: 'creatures' }, null, makeObj(C['Terminus'], 1)); await settle2();
                const tk = A.bf.find(x => x.token && /Fungus/.test(x.card.type)); ok('The Skullspore Nexus: one token with the total power', A.bf.filter(x => x.token && /Fungus/.test(x.card.type)).length === 1 && !!tk && pow(tk) === 6, tk && [pow(tk), tou(tk)]);
                const a = put(A, 'Grizzly Bears'); lands(A, 2, 'Forest'); const ab = actsOf(nx).find(x => /Double target creature/.test(x.text)); ok('The Skullspore Nexus: has the double-power ability', !!ab);
                G.phase = 'main1'; if (ab) { await activate(A, nx, ab, { o: a }); await settle2(); } ok('The Skullspore Nexus: doubles power', pow(a) === 4, pow(a));
            }
            { // Titanoth Rex
                let [A, B] = await fresh(); const tr = makeObj(C['Titanoth Rex'], 0); A.hand.push(tr); lands(A, 2, 'Forest'); const bears = put(A, 'Grizzly Bears'); G.phase = 'main1';
                ok('Titanoth Rex: can cycle', canCycle(A, tr)); await cycle(A, tr); await settle2();
                ok('Titanoth Rex: a trample counter on the target creature', bears.ctr.trample === 1 && has(bears, 'trample'), bears.ctr);
            }
            { // Bonehoard Dracosaur
                let [A, B] = await fresh(); put(A, 'Bonehoard Dracosaur'); A.library.push(makeObj(C['Island'], 0), makeObj(C['Grizzly Bears'], 0)); const n0 = A.library.length; fire('upkeep', { P: A }); await settle2();
                ok('Bonehoard Dracosaur: exiles two cards you may play', A.library.length === n0 - 2 && A.exile.filter(x => x.playUntil === G.turn).length === 2, A.exile.length);
                ok('Bonehoard Dracosaur: a 3/1 Dinosaur and a Treasure', A.bf.some(x => x.token && /Dinosaur/.test(x.card.type) && pow(x) === 3) && A.bf.some(x => x.token && /Treasure/.test(x.card.type)), A.bf.map(x => x.card.name));
            }
            { // Pantlaza
                let [A, B] = await fresh(); put(A, 'Pantlaza, Sun-Favored'); A.library.push(makeObj(C['Grizzly Bears'], 0)); await settle2();
                ok('Pantlaza: discovers when it enters (finds the Bears)', A.bf.some(x => x.card.name === 'Grizzly Bears') || A.hand.some(x => x.card.name === 'Grizzly Bears'), [A.bf.map(x => x.card.name), A.hand.map(x => x.card.name)]);
                const n0 = A.library.length; put(A, 'Giant Cindermaw'); await settle2(); ok('Pantlaza: only once each turn', A.library.length === n0, [A.library.length, n0]);
            }
            { // Etali, Primal Conqueror
                let [A, B] = await fresh(); A.library.push(makeObj(C['Grizzly Bears'], 0)); B.library.push(makeObj(C['Giant Cindermaw'], 1)); put(A, 'Etali, Primal Conqueror'); await settle2();
                ok('Etali, Primal Conqueror: casts the exiled spells for free', A.bf.some(x => x.card.name === 'Grizzly Bears') && A.bf.some(x => x.card.name === 'Giant Cindermaw'), A.bf.map(x => x.card.name));
            }
            { // Savage Order
                let [A, B] = await fresh(); const big = put(A, 'Rampaging Brontodon'); lands(A, 4, 'Forest'); const so = makeObj(C['Savage Order'], 0); A.hand.push(so); A.library.push(makeObj(C['Giant Cindermaw'], 0));
                ok('Savage Order: castable with a big creature to sacrifice', canCastNow(A, so) && canPay(A, so)); await castSpell(A, so, null); await settle2();
                const d = A.bf.find(x => x.card.name === 'Giant Cindermaw'); ok('Savage Order: sacrificed the creature and fetched a Dinosaur', !A.bf.includes(big) && !!d, A.bf.map(x => x.card.name));
                ok('Savage Order: it is indestructible until your next turn', !!d && has(d, 'indestructible')); G.turn += 2; ok('Savage Order: ... and no longer after that', !!d && !has(d, 'indestructible'));
                [A, B] = await fresh(); put(A, 'Grizzly Bears'); lands(A, 4, 'Forest'); const so2 = makeObj(C['Savage Order'], 0); A.hand.push(so2); ok('Savage Order: not castable without a creature of power 4 or more', !(canCastNow(A, so2) && canPay(A, so2)));
            }
            { // Ghalta, Stampede Tyrant
                let [A, B] = await fresh(); A.hand.length = 0; A.hand.push(makeObj(C['Grizzly Bears'], 0), makeObj(C['Giant Cindermaw'], 0), makeObj(C['Lightning Bolt'], 0)); put(A, 'Ghalta, Stampede Tyrant'); await settle2();
                ok('Ghalta, Stampede Tyrant: puts the creature cards from your hand onto the battlefield', A.bf.some(x => x.card.name === 'Grizzly Bears') && A.bf.some(x => x.card.name === 'Giant Cindermaw') && A.hand.length === 1, [A.bf.map(x => x.card.name), A.hand.length]);
            }
            { // Roaming Throne
                let [A, B] = await fresh(); B.life = 20; const th = put(A, 'Roaming Throne'); th.chosenType = 'Dinosaur'; put(A, "Burning Sun's Avatar"); await settle2();
                ok('Roaming Throne: a Dinosaur\'s enters trigger happens twice', B.life === 14, B.life);
                [A, B] = await fresh(); B.life = 20; put(A, "Burning Sun's Avatar"); await settle2(); ok('Without Roaming Throne it happens once', B.life === 17, B.life);
            }

        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('gishath', results, []);
    writeOut('gishath', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
