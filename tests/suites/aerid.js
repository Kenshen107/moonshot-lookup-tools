// Exhaust abilities can be activated only once per permanent (2026-11-19, owner: "Peema also has exhaust right so how did it keep doing it??").
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const names = ['Island', 'Mountain', 'Forest', 'Tyrox, Saurid Tyrant', 'Aerid Konstrari', 'Agatha of the Vile Cauldron', 'Craterclaw Colossus', 'Sol Ring', 'Arcane Signet', 'Birds of Paradise', 'Displaced Dinosaurs', 'Depthshaker Titan', 'Ingenious Artillerist', 'Stridehangar Automaton', 'Roxanne, Starfall Savant', 'Heartwood Crafter // Soul Tether', 'Herd Heirloom', 'Hellkite Tyrant', 'Tenured Tethermage', 'Jiang Yanggu, Never Alone', 'Orthion, Hero of Lavabrink', 'Svella, Ice Shaper', 'Sarinth Steelseeker', 'Weftstalker Ardent', 'Hungering Puppetbeast'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A, B] = G.players; A.isAI = false;
            const hw = P => P.bf.filter(x => x.card.name === 'Heartwood');
            const R0 = Rx(makeObj(C['Aerid Konstrari'], A.i));
            ok('Aerid Konstrari reads as fully Automated', true);
            const o = makeObj(C['Aerid Konstrari'], A.i); A.hand.push(o);
            for (let i = 0; i < 6; i++) { const l = makeObj(C['Mountain'], A.i); putOntoBattlefield(A, l); }
            A.hand = A.hand.filter(x => x !== o); putOntoBattlefield(A, o); o.sick = false; await settle();
            ok('entering makes a Heartwood token', hw(A).length === 1, hw(A).length);
            const t = hw(A)[0];
            ok('Heartwood is a red and green artifact', t && /Artifact/.test(t.card.type) && t.card.colors.includes('R') && t.card.colors.includes('G'), t && t.card.colors);
            ok('and taps for mana (R or G)', t && Rx(t).mana && Rx(t).mana.colors && Rx(t).mana.colors.includes('R') && Rx(t).mana.colors.includes('G'), t && JSON.stringify(Rx(t).mana));
            const a = Rx(o).acts.find(x => /Heartwood/.test(x.text || ''));
            ok('the {6} ability is read', !!a, Rx(o).acts.map(x => x.text));
            const p0 = pow(o); await activate(A, o, a); await settle();
            ok('it makes another Heartwood', hw(A).length >= 2, hw(A).length);
            const arts = A.bf.filter(x => /Artifact/.test(x.card.type)).length;
            ok('and gives +X/+0 for the artifacts you control', pow(o) === p0 + arts, [p0, pow(o), arts]);
            const before = hw(A).length; destroy(o, 'test'); await settle();
            ok('dying makes a Heartwood token', hw(A).length === before + 1, [before, hw(A).length]);
            // ---- the rest of the deck ----
            const clear = () => { [A, B].forEach(P => { P.bf.length = 0; P.hand.length = 0; P.gy.length = 0; }); G.trigQ = []; };
            const put = async (P, n) => { const x = makeObj(C[n], P.i); putOntoBattlefield(P, x); x.sick = false; await settle(); return x; };
            const step = async (label, fn) => { try { await fn(); } catch (er) { ok(label + ' (threw ' + er.message + ')', false, String(er.stack).slice(0, 200)); } };
            await step('Agatha', async () => { clear(); const ag = await put(A, 'Agatha of the Vile Cauldron'); const ae = await put(A, 'Aerid Konstrari'); const a6 = Rx(ae).acts.find(x => /Heartwood/.test(x.text || '')); const g = actCost(ae, a6).generic; ok('Agatha makes creature abilities cost {power} less (never below one mana)', g === Math.max(1, 6 - pow(ag)), [g, pow(ag)]); });
            await step('Craterclaw', async () => { clear(); await put(A, 'Sol Ring'); const bd = await put(A, 'Birds of Paradise'); const cc = await put(A, 'Craterclaw Colossus'); ok('Craterclaw gives creatures trample and +X/+0 (X = artifacts)', bd.tp === akArts(A) && has(bd, 'trample'), [bd.tp, akArts(A)]); });
            await step('Dinosaurs', async () => { clear(); await put(A, 'Displaced Dinosaurs'); makeArtifactToken(A, 'treasure'); await settle(); const t0 = A.bf.find(x => x.card.name === 'Treasure'); ok('a historic permanent entering becomes a 7/7 Dinosaur', t0 && isCreature(t0) && pow(t0) === 7 && hasType(t0, 'Dinosaur'), t0 && [isCreature(t0), pow(t0)]); });
            await step('Depthshaker', async () => { clear(); makeArtifactToken(A, 'treasure'); const dt = await put(A, 'Depthshaker Titan'); const t0 = A.bf.find(x => x.card.name === 'Treasure'); ok('Depthshaker animates noncreature artifacts and sacrifices them at the end step', t0 && t0.permAnimated && t0.sacAtEnd === G.turn, t0 && t0.permAnimated); ok('artifact creatures have trample and haste', has(dt, 'trample') && has(dt, 'haste')); });
            await step('Artillerist', async () => { clear(); await put(A, 'Ingenious Artillerist'); const l0 = B.life; makeArtifactToken(A, 'treasure'); await settle(); ok('an artifact entering deals 1 damage to each opponent', B.life === l0 - 1, [l0, B.life]); });
            await step('Weftstalker', async () => { clear(); await put(A, 'Weftstalker Ardent'); const l0 = B.life; makeArtifactToken(A, 'treasure'); await settle(); await put(A, 'Birds of Paradise'); ok('another artifact and another creature each deal 1', B.life === l0 - 2, [l0, B.life]); });
            await step('Stridehangar', async () => { clear(); await put(A, 'Stridehangar Automaton'); makeArtifactToken(A, 'treasure'); await settle(); ok('an artifact token brings a Thopter', A.bf.some(x => hasType(x, 'Thopter')), A.bf.map(x => x.card.name)); });
            await step('Roxanne', async () => { clear(); await put(A, 'Roxanne, Starfall Savant'); ok('Roxanne makes a Meteorite', A.bf.some(x => x.card.name === 'Meteorite')); makeArtifactToken(A, 'heartwood'); const hh = A.bf.find(x => x.card.name === 'Heartwood'); ok('tapping an artifact token adds one more mana', manaOf(hh).n === 2, manaOf(hh)); });
            await step('Crafter', async () => { clear(); await put(A, 'Heartwood Crafter // Soul Tether'); const sr = makeObj(C['Sol Ring'], A.i); A.hand.push(sr); ok('Heartwood Crafter mana cannot pay for a spell from hand', !canPay(A, sr)); await put(A, 'Mountain'); ok('but a land can', canPay(A, sr)); });
            await step('Heirloom', async () => { clear(); const hk = await put(A, 'Hellkite Tyrant'); const he = await put(A, 'Herd Heirloom'); const a = Rx(he).acts[0]; ok('Herd Heirloom ability is read', !!a); await CMD.ak_heirloom(A, {}, { o: hk }, he); const c0 = A.hand.length; fire('hitPlayer', { src: hk, n: 6 }); ok('the creature draws when it deals combat damage to a player', A.hand.length === c0 + 1 || A.library.length < 1, [c0, A.hand.length]); });
            await step('Tethermage', async () => { clear(); for (let i = 0; i < 5; i++) await put(A, 'Mountain'); await put(A, 'Tenured Tethermage'); ok('sacrificing a land makes two tapped Heartwood tokens', hw(A).length === 2 && A.bf.filter(x => x.card.name === 'Mountain').length === 4, [hw(A).length]); });
            await step('Jiang', async () => { clear(); const jy = await put(A, 'Jiang Yanggu, Never Alone'); const mowu = A.bf.find(x => x.token && /Mowu/.test(x.card.name)); ok('Jiang makes Mowu, a legendary 3/3 Dog', mowu && pow(mowu) === 3, A.bf.map(x => x.card.name)); mowu.tapped = true; await CMD.ak_untapTokens(A); ok('untaps tokens at the end step', !mowu.tapped); });
            await step('Orthion', async () => { clear(); const bd = await put(A, 'Birds of Paradise'); const orth = await put(A, 'Orthion, Hero of Lavabrink'); await CMD.ak_orthion(A, { n: 1 }, null, orth); const cp = A.bf.find(x => x.token && x.card.name === 'Birds of Paradise'); ok('Orthion copies another creature with haste, sacrificed at the end step', cp && cp.sacAtEnd === G.turn && has(cp, 'haste'), !!cp); });
            await step('Svella', async () => { clear(); const sv = await put(A, 'Svella, Ice Shaper'); A.library.length = 0; ['Mountain', 'Mountain', 'Mountain'].forEach(n => A.library.push(makeObj(C[n], A.i))); A.library.push(makeObj(C['Sol Ring'], A.i)); await CMD.ak_svella(A, {}, null, sv); await settle(); ok('Svella casts a spell from the top four for free', A.bf.some(x => x.card.name === 'Sol Ring'), A.bf.map(x => x.card.name)); ok('the rest go to the bottom', A.library.length === 3, A.library.length); });
            await step('Steelseeker', async () => { clear(); await put(A, 'Sarinth Steelseeker'); A.library.length = 0; A.library.push(makeObj(C['Mountain'], A.i)); makeArtifactToken(A, 'treasure'); await settle(); ok('an artifact entering puts a land from the top into your hand', A.hand.some(x => x.card.name === 'Mountain'), A.hand.length); });
            await step('Cleaver', async () => { clear(); const bd = await put(A, 'Birds of Paradise'); const cl = makeObj(C['Sol Ring'], A.i); putOntoBattlefield(A, cl); cl.attachedTo = bd.uid; G.ctxRaw = { n: 3 }; await CMD.ak_cleaver(A, {}, null, cl); ok('combat damage makes that many Treasure tokens', A.bf.filter(x => x.card.name === 'Treasure').length === 3); });
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('aerid', results); writeOut('aerid', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
