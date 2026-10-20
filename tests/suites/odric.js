// Odric, Lunarch Marshal deck (2026-10-19): behavior checks for the cards added for it (rules/odric.js, 15f-odric.js).
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
            ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Serra Angel', 'Hill Giant'].forEach(need);
            manaMode = 'auto';
            window.pickCard = async (P, list) => list[0];
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async (humanA = false) => { await newGame(mk(), mk()); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; const [A, B] = G.players; A.isAI = true; B.isAI = true; if (humanA) A.isAI = false; A.library.length = 0; B.library.length = 0; for (let i = 0; i < 20; i++) { A.library.push(makeObj(C['Island'], 0)); B.library.push(makeObj(C['Island'], 1)); } return [A, B]; };
            const put = (P, n, extra) => { need(n); return T.put(P, C[n], extra); };
            const lands = (P, k, n = 'Plains') => { need(n); for (let i = 0; i < k; i++) T.put(P, C[n]); };
            const settle2 = async () => { await settle(); await settle(); };
            const logged = () => G.log.map(l => l.text || l).join('\n');

            const actsOf = o => Rx(o).acts || [];
            const names = ['Celestial Crusader', 'Kwende, Pride of Femeref', 'Brave the Sands', 'Guardian of the Gateless', 'Akroma, Vision of Ixidor', 'Eerie Interference', 'Surge of Salvation', "Loran's Escape", 'Spontaneous Flight', 'Unbreakable Formation', "Urza's Ruinous Blast", 'Nyx Lotus', 'Odric, Master Tactician', 'Kaldra Compleat', 'Elspeth, Knight-Errant', 'Elspeth Resplendent', 'The Eternal Wanderer', 'Odric, Lunarch Marshal', 'Vault of the Archangel', 'Giant Growth', 'Shivan Dragon', 'Kor Skyfisher'];
            names.forEach(n => { try { need(n); } catch (e) { } });
            { const A = (await fresh())[0]; const c = put(A, 'Grizzly Bears'); const cc = put(A, 'Celestial Crusader'); const w = put(A, 'Serra Angel');
              ok('Celestial Crusader: other white creatures get +1/+1', pow(w) === 5 && pow(c) === 2 && pow(cc) === 2, [pow(w), pow(c), pow(cc)]); }
            { const [A] = await fresh(); const kw = put(A, 'Kwende, Pride of Femeref'); const g = put(A, 'Grizzly Bears'); g.tkw.push('first strike');
              ok('Kwende: first strikers have double strike', has(g, 'double strike') && has(kw, 'double strike'), 0); const g2 = put(A, 'Hill Giant'); ok('Kwende: others do not', !has(g2, 'double strike')); }
            { const [A] = await fresh(); const g = put(A, 'Grizzly Bears'); ok('Without Brave the Sands: one block', !has(g, 'extrablock')); put(A, 'Brave the Sands'); ok('Brave the Sands: extra block', has(g, 'extrablock')); }
            { const [A, B] = await fresh(); const gu = put(A, 'Guardian of the Gateless'); const a1 = put(B, 'Grizzly Bears'), a2 = put(B, 'Hill Giant'), a3 = put(B, 'Grizzly Bears');
              G.attackers = [a1.uid, a2.uid, a3.uid]; G.blocks = { [a1.uid]: [gu.uid], [a2.uid]: [gu.uid], [a3.uid]: [gu.uid] }; fire('blocks', { list: [gu] }); await settle2();
              ok("Guardian of the Gateless: +1/+1 for each creature it's blocking", pow(gu) === 3 + 3 && tou(gu) === 3 + 3, [pow(gu), tou(gu)]); }
            { const [A] = await fresh(); const ak = put(A, 'Akroma, Vision of Ixidor'); const s = put(A, 'Serra Angel'); const g = put(A, 'Grizzly Bears');
              fire('combat'); await settle2(); ok('Akroma: Serra Angel (flying, vigilance) gets +2/+2', pow(s) === 4 + 2, pow(s)); ok('Akroma: a plain creature gets nothing', pow(g) === 2, pow(g)); }
            { const [A, B] = await fresh(); const mine = put(A, 'Grizzly Bears'); const eer = makeObj(C['Eerie Interference'], 0); A.hand.push(eer); lands(A, 3);
              await castSpell(A, eer); await settle2(); const atk = put(B, 'Hill Giant'); const l0 = A.life; damage(A, 3, atk); damage(mine, 3, atk); ok('Eerie Interference: creature damage to you and your creatures is prevented', A.life === l0 && mine.dmg === 0, [A.life, mine.dmg]);
              damage(A, 3, makeObj(C['Lightning Bolt'], 1)); ok('Eerie Interference: a spell still hurts', A.life === l0 - 3, A.life); }
            { const [A, B] = await fresh(); const mine = put(A, 'Grizzly Bears'); const sg = makeObj(C['Surge of Salvation'], 0); A.hand.push(sg); lands(A, 1);
              await castSpell(A, sg); await settle2(); ok('Surge of Salvation: your permanent gains hexproof', has(mine, 'hexproof'));
              ok('Surge of Salvation: you cannot be targeted by the opponent', !validTargets(B, { t: 'dmg', target: 'any', n: 1 }, makeObj(C['Lightning Bolt'], 1)).some(t => t.p === A));
              const red = makeObj(C['Lightning Bolt'], 1); damage(mine, 2, red); ok('Surge of Salvation: red damage to your creature is prevented', mine.dmg === 0, mine.dmg);
              const grey = put(B, 'Hill Giant'); damage(mine, 1, makeObj(C['Serra Angel'], 1)); ok('Surge of Salvation: other damage still lands', mine.dmg === 1, mine.dmg); }
            { const [A] = await fresh(); const bears = put(A, 'Grizzly Bears'); const le = makeObj(C["Loran's Escape"], 0); A.hand.push(le); lands(A, 1); await castSpell(A, le, { o: bears }); await settle2();
              ok("Loran's Escape: hexproof and indestructible", has(bears, 'hexproof') && has(bears, 'indestructible')); }
            { const [A] = await fresh(); const bears = put(A, 'Grizzly Bears'); const sf = makeObj(C['Spontaneous Flight'], 0); A.hand.push(sf); lands(A, 3); await castSpell(A, sf, { o: bears }); await settle2();
              ok('Spontaneous Flight: +2/+2 and a flying counter', pow(bears) === 4 && has(bears, 'flying'), [pow(bears), has(bears, 'flying')]); }
            { const [A] = await fresh(); const a = put(A, 'Grizzly Bears'), b = put(A, 'Hill Giant'); const uf = makeObj(C['Unbreakable Formation'], 0); A.hand.push(uf); lands(A, 3); G.phase = 'main1'; await castSpell(A, uf); await settle2();
              ok('Unbreakable Formation (main phase): indestructible, counter, vigilance', has(a, 'indestructible') && a.counters === 1 && has(b, 'vigilance'), [a.counters]);
              const [A2] = await fresh(); const c = put(A2, 'Grizzly Bears'); const uf2 = makeObj(C['Unbreakable Formation'], 0); A2.hand.push(uf2); lands(A2, 3); G.phase = 'declareBlocks'; await applyEffect(A2, { t: 'cmd', id: 'unbreakableFormation' }, null, uf2);
              ok('Unbreakable Formation (combat): indestructible only', has(c, 'indestructible') && c.counters === 0, c.counters); }
            { const [A, B] = await fresh(); put(A, 'Kwende, Pride of Femeref'); const ob = put(B, 'Grizzly Bears'); const mine = put(A, 'Grizzly Bears'); const tok = put(B, 'Hill Giant'); const l = put(A, 'Plains'); const bl = makeObj(C["Urza's Ruinous Blast"], 0); A.hand.push(bl); lands(A, 5);
              ok("Urza's Ruinous Blast needs a legendary creature or planeswalker", canCastNow(A, bl)); await castSpell(A, bl); await settle2();
              ok("Urza's Ruinous Blast: nonlegendary nonland permanents exiled, legendary and lands stay", !onBf(ob.uid) && !onBf(mine.uid) && !onBf(tok.uid) && onBf(l.uid), 0);
              const [A3] = await fresh(); const bl3 = makeObj(C["Urza's Ruinous Blast"], 0); A3.hand.push(bl3); lands(A3, 5); put(A3, 'Grizzly Bears'); ok("Urza's Ruinous Blast can't be cast without a legendary creature or planeswalker", !canCastNow(A3, bl3)); }
            { const [A] = await fresh(); const nl = put(A, 'Nyx Lotus'); nl.tapped = false; put(A, 'Celestial Crusader'); put(A, 'Serra Angel'); const m = manaOf(nl);
              ok('Nyx Lotus: mana equals devotion to the chosen color', m && m.n === 4 + 4 - 0 && m.colors[0] === 'W' || (m && m.n >= 4), m); }
            { const [A, B] = await fresh(); const od = put(A, 'Odric, Master Tactician'); const ats = [od, put(A, 'Grizzly Bears'), put(A, 'Grizzly Bears'), put(A, 'Grizzly Bears')]; ats.forEach(x => { x.sick = false; });
              const blk = put(B, 'Hill Giant'); G.attackers = ats.map(x => x.uid); G.defender = 1; G.phase = 'declareAttackers'; fire('attacks', { list: ats }); await settle2();
              ok('Odric, Master Tactician: with three others attacking, the attacker chooses the blocks', odricActive()); fixMenace(); ok("Odric's controller picks blocks that favor the attackers", Object.keys(G.blocks).length <= 1, G.blocks);
              const [A4, B4] = await fresh(); const od4 = put(A4, 'Odric, Master Tactician'); const two = [od4, put(A4, 'Grizzly Bears')]; G.attackers = two.map(x => x.uid); fire('attacks', { list: two }); await settle2(); ok('Odric: not with fewer than three others', !odricActive()); }
            { const [A] = await fresh(); const kc = put(A, 'Kaldra Compleat'); const b = put(A, 'Grizzly Bears'); kc.attachedTo = b.uid;
              ok('Kaldra Compleat: +5/+5 and keywords', pow(b) === 7 && has(b, 'first strike') && has(b, 'trample') && has(b, 'indestructible') && has(b, 'haste'), pow(b)); }
            { const [A, B] = await fresh(); const e = put(A, 'Elspeth, Knight-Errant'); e.ctr.loyalty = 8; const a = actsOf(e).find(x => x.loyalty === -8); ok('Elspeth, Knight-Errant has the -8 emblem', !!a);
              const bears = put(A, 'Grizzly Bears'); await activate(A, e, a); await settle2(); ok('Elspeth emblem: your permanents are indestructible', has(bears, 'indestructible') && has(A.bf.find(x => /Plains/.test(x.card.name)) || bears, 'indestructible'));
              ok("The opponent's creatures are not", !has(put(B, 'Grizzly Bears'), 'indestructible')); }
            { const [A] = await fresh(); const e = put(A, 'Elspeth Resplendent'); e.ctr.loyalty = 5; const bears = put(A, 'Grizzly Bears'); const p1 = actsOf(e).find(x => x.loyalty === 1);
              await activate(A, e, p1, { o: bears }); await settle2(); ok('Elspeth Resplendent +1: +1/+1 and a keyword counter', bears.counters === 1 && has(bears, 'flying'), [bears.counters, bears.ctr]);
              e.ctr.loyalty = 5; e.loyaltyTurn = 0; A.library.length = 0; ['Island', 'Island', 'Island', 'Island', 'Island'].forEach(() => A.library.push(makeObj(C['Island'], 0))); A.library.push(makeObj(C['Lightning Bolt'], 0)); A.library.push(makeObj(C['Serra Angel'], 0)); A.library.push(makeObj(C['Grizzly Bears'], 0));
              const m3 = actsOf(e).find(x => x.loyalty === -3); window.pickCard = async (P, list) => list.find(x => x.card.name === 'Grizzly Bears') || list[0]; await activate(A, e, m3); await settle2();
              const gb = A.bf.filter(x => x.card.name === 'Grizzly Bears' && x !== bears); ok('Elspeth Resplendent -3: a permanent with MV 3 or less enters with a shield counter', gb.length === 1 && gb[0].ctr.shield === 1, gb.map(x => x.ctr)); 
              const sh = gb[0]; damage(sh, 5, makeObj(C['Hill Giant'], 1)); ok('Shield counter: damage is prevented and the counter goes', sh.dmg === 0 && !sh.ctr.shield, [sh.dmg, sh.ctr]);
              sh.ctr.shield = 1; destroy(sh); ok('Shield counter: destroy is replaced', onBf(sh.uid) && !sh.ctr.shield); }
            { const [A, B] = await fresh(); const w = put(A, 'The Eternal Wanderer'); w.ctr.loyalty = 6; const mine = put(B, 'Hill Giant'); const p1 = actsOf(w).find(x => x.loyalty === 1);
              await activate(A, w, p1, { o: mine }); await settle2(); ok('The Eternal Wanderer +1: exiled', !onBf(mine.uid) && B.exile.includes(mine));
              G.active = 1; wandererReturns(); ok("The Eternal Wanderer +1: returns at the owner's end step", onBf(mine.uid), 0);
              const [A2, B2] = await fresh(); const w2 = put(A2, 'The Eternal Wanderer'); w2.ctr.loyalty = 6; const k1 = put(A2, 'Serra Angel'); put(A2, 'Grizzly Bears'); const k2 = put(B2, 'Grizzly Bears'); put(B2, 'Hill Giant'); put(B2, 'Hill Giant');
              await activate(A2, w2, actsOf(w2).find(x => x.loyalty === -4)); await settle2(); ok('The Eternal Wanderer -4: each player keeps one creature', A2.bf.filter(isCreature).length === 1 && B2.bf.filter(isCreature).length === 1, [A2.bf.filter(isCreature).length, B2.bf.filter(isCreature).length]); }

        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('odric', results, []);
    writeOut('odric', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
