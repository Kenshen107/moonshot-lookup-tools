// Instant-speed windows (2026-10-15, owner's reports): an activated ability counts as something you can do at instant speed
// (Sandman's graveyard ability), a person is asked at an opponent's end step, the computer flashes in Mithril Coat to save a legendary creature,
// and Accursed Marauder's enters trigger fires once however it gets onto the battlefield.
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
            const want = ['Forest', 'Island', 'Mountain', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Sandman, Shifting Scoundrel', 'Lightning Bolt', 'Mithril Coat', 'Accursed Marauder', 'Clever Impersonator', 'Copycrook', 'Uldaros Theorix', 'Swamp'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            window.__FORCE_WINDOWS = true;
            manaMode = 'auto'; // pay for abilities automatically in these checks
            window.pickCard = async (P, list) => list[0]; // and take the first choice offered
            const fresh = async () => { const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' }); await newGame(mk(), mk()); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false; return G.players; };
            const lands = (P, n, name) => { for (let i = 0; i < n; i++) T.put(P, C[name]); };

            // ---- Sandman: the graveyard ability is an instant-speed option ----
            let [A, B] = await fresh(); A.isAI = false; B.isAI = true;
            const sand = makeObj(C['Sandman, Shifting Scoundrel'], 0); A.gy.push(sand); A.gy.push(makeObj(C['Forest'], 0));
            G.active = 1; G.phase = 'main1';
            ok('with no mana, nothing to do', instantOptions(A) === false);
            lands(A, 5, 'Forest');
            ok("Sandman's graveyard ability counts as an instant-speed option on the opponent's turn", instantOptions(A) === true);
            const act = actsOf(sand)[0];
            ok('and it can be activated then (not only at sorcery speed)', !!act && !act.sorcery && (G.priority = A.i, canActivate(A, sand, act)));
            G.priority = null;
            // The opponent casts a spell: the person is asked, and can respond with the ability
            const bolt = makeObj(C['Lightning Bolt'], 1); B.hand.push(bolt); T.put(B, C['Mountain']);
            const stackP = castSpell(B, bolt, { p: A }); // B casts Bolt at A, then offers priority
            await new Promise(r => setTimeout(r, 300));
            const asked = G.mode && G.mode.type === 'respond';
            ok('a person with only an ability to use is asked when a spell is on the stack', asked, G.mode && G.mode.type);
            if (asked) { await humanActivate(sand.uid, 0); }
            await stackP; await settle(); await settle();
            ok('responding brings Sandman and a land back from the graveyard', A.bf.some(x => x.card.name === 'Sandman, Shifting Scoundrel') && A.bf.filter(x => x.card.name === 'Forest').length >= 6, A.bf.map(x => x.card.name));

            // ---- the end-step window ----
            [A, B] = await fresh(); A.isAI = false; B.isAI = true;
            const sand2 = makeObj(C['Sandman, Shifting Scoundrel'], 0); A.gy.push(sand2); A.gy.push(makeObj(C['Forest'], 0)); lands(A, 5, 'Forest');
            G.active = 1; G.phase = 'main2'; G.hotseat = null;
            const win = endStepWindow(B);
            await new Promise(r => setTimeout(r, 200));
            ok("at the opponent's end step a person who can still act is asked", G.mode && G.mode.type === 'respond' && G.mode.item.window === true, G.mode && G.mode.item);
            await humanActivate(sand2.uid, 0);
            await new Promise(r => setTimeout(r, 200));
            if (G.mode && G.mode.type === 'respond') passPriority();
            await win; await settle();
            ok('the ability worked in that window', A.bf.some(x => x.card.name === 'Sandman, Shifting Scoundrel'), A.bf.map(x => x.card.name));
            [A, B] = await fresh(); A.isAI = false; B.isAI = true; G.active = 1;
            const win2 = endStepWindow(B); await new Promise(r => setTimeout(r, 100));
            ok('nothing is asked when the person has nothing to do', !(G.mode && G.mode.type === 'respond'));
            await win2;

            // ---- Mithril Coat ----
            [A, B] = await fresh(); A.isAI = true; B.isAI = true;
            const lg = T.put(B, C['Tyrox, Saurid Tyrant']); const coat = makeObj(C['Mithril Coat'], 1); B.hand.push(coat); lands(B, 3, 'Island');
            const bolt2 = makeObj(C['Lightning Bolt'], 0); A.hand.push(bolt2); lands(A, 1, 'Mountain');
            await castSpell(A, bolt2, { o: lg }); await settle(); await settle();
            ok("the computer flashes in Mithril Coat to save its legendary creature from Lightning Bolt", !!onBf(lg.uid) && coat.attachedTo === lg.uid, { alive: !!onBf(lg.uid) });
            [A, B] = await fresh(); A.isAI = true; B.isAI = true;
            const nl = T.put(B, C['Grizzly Bears']); const coat2 = makeObj(C['Mithril Coat'], 1); B.hand.push(coat2); lands(B, 3, 'Island');
            const bolt3 = makeObj(C['Lightning Bolt'], 0); A.hand.push(bolt3); lands(A, 1, 'Mountain');
            await castSpell(A, bolt3, { o: nl }); await settle(); await settle();
            ok("it doesn't waste the Coat on a creature that isn't legendary (it can't attach there)", !onBf(nl.uid) && B.hand.includes(coat2));
            [A, B] = await fresh(); A.isAI = true; B.isAI = true;
            const lg3 = T.put(B, C['Tyrox, Saurid Tyrant']); const coat3 = T.put(B, C['Mithril Coat']); coat3.attachedTo = lg3.uid;
            ok('an equipped legend is indestructible (damage and destroy do nothing)', has(lg3, 'indestructible'));
            ok('Mithril Coat can be equipped for {3} (an Equipment ability)', !!Rx(coat3).equip && Rx(coat3).equip.generic === 3);

            // ---- Accursed Marauder: one trigger however it enters ----
            const sacCount = async setup => { [A, B] = await fresh(); A.isAI = true; B.isAI = true; T.put(A, C['Grizzly Bears']); T.put(B, C['Grizzly Bears']); G.log.length = 0; await setup(); await settle(); await settle(); return G.log.map(l => l.text || l).filter(l => /ability triggers/.test(l) && /Marauder/.test(l)).length; };
            ok('cast: the trigger fires once', await sacCount(async () => { const m = makeObj(C['Accursed Marauder'], 0); A.hand.push(m); lands(A, 3, 'Swamp'); await castSpell(A, m); }) === 1);
            ok('copied by Clever Impersonator: once', await sacCount(async () => { T.put(B, C['Accursed Marauder']); const m = makeObj(C['Clever Impersonator'], 0); A.hand.push(m); lands(A, 4, 'Island'); await castSpell(A, m); }) === 1);
            ok('copied by Copycrook: once', await sacCount(async () => { T.put(B, C['Accursed Marauder']); const m = makeObj(C['Copycrook'], 0); A.hand.push(m); lands(A, 4, 'Island'); await castSpell(A, m); }) === 1);
            ok('as a token copy from Uldaros Theorix: once', await sacCount(async () => { A.gy.push(makeObj(C['Accursed Marauder'], 0)); const u = makeObj(C['Uldaros Theorix'], 0); u.wasCast = true; await resolveEffects(A, Rx(u).etb, null, u); }) === 1);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('priority', results, []);
    writeOut('priority', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
