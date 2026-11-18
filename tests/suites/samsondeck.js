// Doc Samson deck (owner, 2026-11-18): lore counters are counters (extra from Doc Samson, so two chapters at once), and the combo pieces the owner listed.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        const WANT = ['Everflowing Chalice', 'Spike Feeder', "Magistrate's Scepter", 'Screaming Shield', 'Temur Sabertooth', 'Gamma Grotesque', 'Goliath, Mass Manipulator', 'Jugan Defends the Temple // Remnant of the Rising Star','Sword of the Paruns', "Nature's Chosen", 'Boon of Boseiju', 'Staff of Domination', 'Ring of Three Wishes', 'Surestrike Trident', 'Astral Cornucopia', 'Kami of Whispered Hopes', 'Centaur Glade', "Rishkar's Expertise", 'Doc Samson, Super Psychiatrist', 'The Aesir Escape Valhalla', 'The First Iroan Games', 'Origin of the Hulk', 'Grizzly Bears', 'Forest', 'Hill Giant', 'Sol Ring'];
        const raw = await (await fetch('/__cards.json')).json(); const K = {};
        raw.forEach(c => { if (WANT.includes(c.name) && !K[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); K[c.name] = sc; } });
        window.pickCard = async (P, list) => list[0]; manaMode = 'auto';
        const fresh = async () => { const [A, B] = await T.newGame(); T.clear(); A.isAI = false; G.view = 0; G.active = 0; G.phase = 'main1'; return [A, B]; };
        // ---- sagas: lore counters get Doc Samson's extra counter, so two chapters trigger at once ----
        let [A, B] = await fresh(); T.put(A, K['Doc Samson, Super Psychiatrist']);
        const saga = T.put(A, K['The First Iroan Games']); saga.ctr.lore = 0; sagaLore(A, saga, 1);
        ok('with Doc Samson a Saga gets two lore counters at once', saga.ctr.lore === 2, saga.ctr.lore);
        ok('and chapters I and II both trigger', (G.trigQ || []).filter(q => q.o === saga).length === 2, (G.trigQ || []).length);
        ok('chapter I is put on last, so it resolves first', (G.trigQ || []).filter(q => q.o === saga)[0].effects === Rx(saga).saga[2], 0);
        // without him, one chapter at a time
        [A, B] = await fresh(); const s2 = T.put(A, K['The First Iroan Games']); s2.ctr.lore = 0; sagaLore(A, s2, 1);
        ok('without Doc Samson a Saga gets one lore counter', s2.ctr.lore === 1 && (G.trigQ || []).filter(q => q.o === s2).length === 1, s2.ctr.lore);
        // the last chapter ends the Saga; a bonus past the last chapter doesn't break anything
        [A, B] = await fresh(); T.put(A, K['Doc Samson, Super Psychiatrist']); const s3 = T.put(A, K['Origin of the Hulk']); s3.ctr.lore = 2; sagaLore(A, s3, 1);
        ok('a Saga pushed past its last chapter is marked done', s3.sagaDone === true, s3.ctr.lore);

        // ---- the combo pieces ----
        [A, B] = await fresh(); const sam = T.put(A, K['Doc Samson, Super Psychiatrist']); sam.sick = false; A.isAI = true; G.active = 0;
        const plan = DECK_PLANS['Doc Samson, Super Psychiatrist']; A.planKey = undefined;
        ok('no loop with Samson alone', !plan.loops[0].online(A), 0);
        const sword = T.put(A, K['Sword of the Paruns']); sword.attachedTo = sam.uid;
        ok('Sword of the Paruns on Doc Samson makes the loop (tapped he gets +2/+0)', !!plan.loops[0].online(A) && manaOf(sam).n === 5, manaOf(sam).n);
        [A, B] = await fresh(); const s5 = T.put(A, K['Doc Samson, Super Psychiatrist']); s5.sick = false; A.isAI = true;
        const kami = T.put(A, K['Kami of Whispered Hopes']); kami.sick = false; const sw2 = T.put(A, K['Sword of the Paruns']); sw2.attachedTo = kami.uid;
        ok('a small Kami of Whispered Hopes with the Sword is not a loop (1 + 2 mana for {3})', !plan.loops[0].online(A), 0);
        kami.counters = 2; ok('with two +1/+1 counters it is the same loop', !!plan.loops[0].online(A), 0);
        // Nature's Chosen / Boon: untap him and keep the mana
        [A, B] = await fresh(); A.isAI = true; const s6 = T.put(A, K['Doc Samson, Super Psychiatrist']); s6.sick = false;
        const nc = T.put(A, K["Nature's Chosen"]); nc.attachedTo = s6.uid;
        await samsonFloat(A);
        ok("Nature's Chosen: Samson taps for mana, untaps, and the mana stays in the pool", !s6.tapped && A.pool.filter(c => c[0] === 'G').length >= 3, A.pool);
        // Cornucopia is a mana source
        [A, B] = await fresh(); const cor = T.put(A, K['Astral Cornucopia']); cor.sick = false; cor.ctr.charge = 4;
        ok('Astral Cornucopia taps for mana per charge counter', manaOf(cor) && manaOf(cor).n === 4, manaOf(cor));
        // Centaur Glade stops at 24; draw-by-power spells never draw the library out
        [A, B] = await fresh(); A.isAI = true; A.planKey = undefined; T.put(A, K['Doc Samson, Super Psychiatrist']);
        const glade = T.put(A, K['Centaur Glade']); for (let i = 0; i < 24; i++) T.put(A, { ...K['Forest'], id: 'ctok' + i, name: 'Centaur token' }).token = true;
        ok('Centaur Glade is not used past 24 Centaurs', AI_ACT_GUARDS['Centaur Glade'](A, glade), 0);
        A.library.length = 0; for (let i = 0; i < 10; i++) A.library.push(makeObj(K['Forest'], 0)); const big = T.put(A, K['Doc Samson, Super Psychiatrist']); big.tp = 40; big.tq = 40;
        const rk = makeObj(K["Rishkar's Expertise"], 0); A.hand.push(rk);
        ok("the computer won't cast a draw-by-power spell that would draw its library out", !canCastNow(A, rk), 0);

        // ---- round 3 ----
        const setup = async () => { const [A2, B2] = await T.newGame(); T.clear(); A2.isAI = true; G.view = 0; G.active = 0; G.phase = 'main1'; A2.planKey = undefined; const sm = T.put(A2, K['Doc Samson, Super Psychiatrist']); sm.sick = false; for (let i = 0; i < 10; i++) { const f = T.put(A2, K['Forest']); f.sick = false; } return [A2, B2, sm]; };
        let [A3, B3, sam3] = await setup(); const sf = T.put(A3, K['Spike Feeder']); sf.counters = 3; const c0 = sam3.counters; await aiUseAbilities(A3); await settle();
        ok('the computer moves Spike Feeder\'s counters onto Doc Samson (each one counts twice)', sam3.counters - c0 === 6 && sf.counters === 0, [sam3.counters - c0, sf.counters]);
        [A3, B3, sam3] = await setup(); const sc = T.put(A3, K["Magistrate's Scepter"]); sc.sick = false;
        await DECK_PLANS['Doc Samson, Super Psychiatrist'].abilities(A3); await settle();
        ok("Magistrate's Scepter is charged with spare mana (two counters with Doc Samson)", sc.ctr.charge === 2 && sc.tapped, sc.ctr.charge);
        sc.tapped = false; await DECK_PLANS['Doc Samson, Super Psychiatrist'].abilities(A3); await settle();
        ok('and charged again: four counters', sc.ctr.charge === 4, sc.ctr.charge);
        sc.tapped = false; await DECK_PLANS['Doc Samson, Super Psychiatrist'].abilities(A3); await settle();
        ok('then the extra turn is taken (three counters removed)', sc.ctr.charge === 1, sc.ctr.charge);
        // Screaming Shield with infinite mana: every opponent mills out
        [A3, B3, sam3] = await setup(); A3.hand.push(makeObj(K['Screaming Shield'], 0)); giveInfiniteMana(A3, 'test'); G.players[1].library.length = 0; for (let i = 0; i < 30; i++) G.players[1].library.push(makeObj(K['Forest'], 1));
        const sw3 = T.put(A3, K['Sword of the Paruns']); sw3.attachedTo = sam3.uid;
        await DECK_PLANS['Doc Samson, Super Psychiatrist'].post(A3);
        ok("Screaming Shield: with infinite mana the opponent's library is milled away", G.players[1].library.length === 0 && A3.bf.some(x => x.card.name === 'Screaming Shield' && x.attachedTo === sam3.uid), G.players[1].library.length);
        // Temur Sabertooth resets Gamma Grotesque's power-up (and draws again)
        [A3, B3, sam3] = await setup(); giveInfiniteMana(A3, 'test'); const sab = T.put(A3, K['Temur Sabertooth']); sab.sick = false; const gg = T.put(A3, K['Gamma Grotesque']); gg.sick = false;
        A3.library.length = 0; for (let i = 0; i < 60; i++) A3.library.push(makeObj(K['Forest'], 0));
        const lib0 = A3.library.length; sam3.counters = 1; await DECK_PLANS['Doc Samson, Super Psychiatrist'].post(A3);
        ok('Sabertooth and Gamma Grotesque draw several times in a row with infinite mana', lib0 - A3.library.length >= 3, lib0 - A3.library.length);

        // counters a permanent enters with get Doc Samson's extra one too (found in the owner's game record: Ring of Three Wishes came in with 3 wish counters)
        [A3, B3, sam3] = await setup(); A3.isAI = false; A3.hand.length = 0; const ring = makeObj(K['Ring of Three Wishes'], 0); A3.hand.push(ring); G.view = 0; manaMode = 'auto';
        await castSpell(A3, ring, null); await settle();
        const rg = A3.bf.find(x => x.card.name === 'Ring of Three Wishes');
        ok('Ring of Three Wishes enters with 4 wish counters when Doc Samson is out', rg && rg.ctr.wish === 4, rg && rg.ctr.wish);

        // the computer doesn't cast Everflowing Chalice with no kicker (a dead card), and does when it can pay for one
        [A3, B3, sam3] = await setup(); A3.isAI = true; A3.hand.length = 0; T.clear(); A3.bf.length = 0; const ch = makeObj(K['Everflowing Chalice'], 0); A3.hand.push(ch); T.put(A3, K['Forest']).sick = false;
        ok('the computer holds Everflowing Chalice while it cannot pay for a kicker', !canCastNow(A3, ch), maxKick(A3, ch));
        for (let i = 0; i < 3; i++) T.put(A3, K['Forest']).sick = false;
        ok('and casts it once it can', canCastNow(A3, ch) && maxKick(A3, ch) >= 1, maxKick(A3, ch));
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('samsondeck', results, []);
    writeOut('samsondeck', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
