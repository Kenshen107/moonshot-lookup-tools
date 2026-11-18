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
        const WANT = ['Sword of the Paruns', "Nature's Chosen", 'Boon of Boseiju', 'Staff of Domination', 'Ring of Three Wishes', 'Surestrike Trident', 'Astral Cornucopia', 'Kami of Whispered Hopes', 'Centaur Glade', "Rishkar's Expertise", 'Doc Samson, Super Psychiatrist', 'The Aesir Escape Valhalla', 'The First Iroan Games', 'Origin of the Hulk', 'Grizzly Bears', 'Forest', 'Hill Giant', 'Sol Ring'];
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
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('samsondeck', results, []);
    writeOut('samsondeck', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
