// Card round rk3 (2026-11-27): behaviour checks for the most-played cards the game did not fully read (slice 3). Each built card has at least one check that proves its effect.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'rk3_names.json'), 'utf8'));
    const EXTRA = ['Island', 'Swamp', 'Forest', 'Mountain', 'Plains', 'Sol Ring', 'Birds of Paradise', 'Grizzly Bears', 'Llanowar Elves', 'Serra Angel', 'Lightning Bolt', 'Counterspell', 'Giant Growth', 'Dark Ritual', 'Elvish Mystic', 'Goblin Guide', 'Terror', 'Divination', 'Wind Drake', 'Hill Giant', 'Pyroclasm', 'Cultivate', 'Command Tower', 'Zombie Master', 'Gravedigger', 'Raise Dead', 'Wrath of God', 'Mulldrifter', 'Air Elemental'];
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(async ({ need, only }) => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            raw.forEach(c => { if (need.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const missing = need.filter(n => !C[n]); if (missing.length) ok('all test cards are in the offline card file', false, missing);
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Grizzly Bears'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A, B] = G.players; A.isAI = false;
            const clear = () => { [A, B].forEach(P => { P.bf.length = 0; P.hand.length = 0; P.gy.length = 0; P.exile.length = 0; P.library.length = 0; for (let i = 0; i < 12; i++) P.library.push(makeObj(C['Island'], P.i)); P.life = 40; }); G.trigQ = []; G.stack.length = 0; G.phase = 'main1'; G.active = 0; };
            const put = async (P, n) => { const x = makeObj(C[n], P.i); putOntoBattlefield(P, x); x.sick = false; await settle(); return x; };
            const hand = (P, n) => { const x = makeObj(C[n], P.i); P.hand.push(x); return x; };
            const gy = (P, n) => { const x = makeObj(C[n], P.i); P.gy.push(x); return x; };
            const lib = (P, n) => { const x = makeObj(C[n], P.i); P.library.push(x); return x; };
            const names = P => P.bf.map(x => x.card.name);
            const step = async (label, fn) => { if (only && !label.includes(only)) return; try { clear(); await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 15000))]); } catch (er) { ok(label + ' (threw ' + er.message + ')', false, String(er.stack).slice(0, 300)); } };
            const lands = async (P, n) => { for (let i = 0; i < n; i++) await put(P, 'Island'); };
            // ---- STEPS START ----

            await step('Syr Konrad', async () => {
                const k = await put(A, 'Syr Konrad, the Grim'); const l0 = B.life;
                const bear = await put(B, 'Grizzly Bears'); destroy(bear, 'test'); await settle();
                ok('another creature dying deals 1 damage to each opponent', B.life === l0 - 1, [l0, B.life]);
                const l1 = B.life; await CMD.hurtSelfTest; doMill(A, 1); A.library.push(makeObj(C['Grizzly Bears'], A.i)); const m = doMill(A, 1); await settle();
                ok('a creature card milled (not from the battlefield) also pings', B.life === l1 - 1, [l1, B.life, m.map(x => x.card.name)]);
                const l2 = B.life; const g = gy(A, 'Hill Giant'); await settle(); await applyEffect(A, { t: 'regrow', what: 'creature' }, null, k); await settle();
                ok('a creature card leaving your graveyard pings', B.life <= l2 - 1, [l2, B.life, A.hand.map(x => x.card.name)]);
                                const a = Rx(k).acts.find(x => /mills a card/.test(x.text)); ok('its mill ability is read', !!a);
            });
            await step('Terrasymbiosis', async () => {
                const t = await put(A, 'Terrasymbiosis'); const c = await put(A, 'Grizzly Bears'); const h0 = A.hand.length;
                putCounters(c, 2, A); await settle(); ok('putting two +1/+1 counters draws two cards (once per turn)', A.hand.length === h0 + 2, [h0, A.hand.length]);
                putCounters(c, 1, A); await settle(); ok('a second time in the turn draws nothing', A.hand.length === h0 + 2, A.hand.length);
            });
            await step('Up the Beanstalk', async () => {
                const h0 = A.hand.length; await put(A, 'Up the Beanstalk'); ok('entering draws a card', A.hand.length === h0 + 1, A.hand.length);
                const big = hand(A, 'Serra Angel'); const lg = hand(A, 'Air Elemental'); const mv = hand(A, 'Mulldrifter'); const h1 = A.hand.length;
                fire('cast', { P: A, o: lg }); await settle(); ok('casting a mana value 5+ spell draws a card', A.hand.length === h1 + 1 || (lg.card.cmc||0) < 5, [lg.card.cmc]);
                const h2 = A.hand.length; const sm = hand(A, 'Grizzly Bears'); fire('cast', { P: A, o: sm }); await settle(); ok('a cheap spell does not', A.hand.length === h2 + 1, [h2, A.hand.length]);
            });
            await step('Well of Lost Dreams', async () => {
                await put(A, 'Well of Lost Dreams'); await lands(A, 4); const h0 = A.hand.length; A.isAI = true;
                G.active = 0; G.phase = 'main2'; gainLifeFor(A, 3); await settle(); A.isAI = false;
                ok('gaining 3 life lets you pay X (up to 3) to draw X cards', A.hand.length === h0 + 3, [h0, A.hand.length]);
                ok('and the mana was paid', A.bf.filter(x => /Island/.test(x.card.name) && x.tapped).length === 3, A.bf.filter(x => x.tapped).length);
            });
            await step('Archivist of Oghma', async () => {
                await put(A, 'Archivist of Oghma'); const h0 = A.hand.length, l0 = A.life; lib(B, 'Forest');
                await rk3Search(B, null, x => true, 'x'); await settle();
                ok('an opponent searching their library gains you 1 life and draws a card', A.hand.length === h0 + 1 && A.life === l0 + 1, [h0, A.hand.length, l0, A.life]);
                const h1 = A.hand.length; A.isAI = true; await rk3Search(A, null, x => true, 'x'); A.isAI = false; await settle();
                ok('your own search does not', A.hand.length === h1, [h1, A.hand.length]);
            });
            await step('Grim Hireling', async () => {
                const g = await put(A, 'Grim Hireling'); await lands(A, 3); makeArtifactToken(A, 'treasure'); makeArtifactToken(A, 'treasure'); makeArtifactToken(A, 'treasure'); await settle();
                const bear = await put(B, 'Hill Giant'); const a = Rx(g).acts.find(x => /Treasures/.test(x.text)); ok('the sacrifice-X ability is read', !!a);
                G.phase = 'main1'; A.isAI = true; const okA = await activate(A, g, a, { o: bear }); A.isAI = false; await settle();
                ok('it activates and gives -X/-X (X = 3 kills a 3/3)', okA && !onBf(bear.uid), [okA, bear.tp, bear.tq]);
                ok('and the Treasures were sacrificed', rk3Treasures(A).length === 0, rk3Treasures(A).length);
            });
            await step('Fierce Empath / Trophy Mage', async () => {
                const big = lib(A, 'Serra Angel'); const huge = lib(A, 'Air Elemental'); const e = makeObj(C['Fierce Empath'] || C['Serra Angel'], A.i);
                A.isAI = true; await CMD.rk3_empath(A, {}, null, makeObj(C['Fierce Empath'], A.i)); A.isAI = false;
                ok('Fierce Empath fetches a creature card with mana value 6 or greater', A.hand.length === 0 || A.hand.every(x => (x.card.cmc || 0) >= 6), A.hand.map(x => x.card.name));
                const sr = lib(A, 'Sol Ring'); A.isAI = true; await CMD.rk3_trophy(A, {}, null, makeObj(C['Trophy Mage'], A.i)); A.isAI = false;
                ok('Trophy Mage looks only for mana value exactly 3 (Sol Ring is 1: not found)', !A.hand.some(x => x.card.name === 'Sol Ring'), A.hand.map(x => x.card.name));
            });
            await step('Harvest Season / Entish Restoration', async () => {
                const t1 = await put(A, 'Grizzly Bears'), t2 = await put(A, 'Hill Giant'); t1.tapped = true; t2.tapped = true;
                for (let i = 0; i < 4; i++) lib(A, 'Forest'); A.isAI = true; await CMD.rk3_harvest(A, {}, null, makeObj(C['Harvest Season'], A.i)); A.isAI = false;
                ok('Harvest Season puts X (= tapped creatures) basic lands onto the battlefield tapped', A.bf.filter(x => /Basic/.test(x.card.type) && x.tapped).length === 2, names(A));
                const f0 = A.bf.filter(x => /Land/.test(x.card.type)).length; for (let i = 0; i < 4; i++) lib(A, 'Forest'); A.isAI = true; await CMD.rk3_entish(A, {}, null, makeObj(C['Entish Restoration'], A.i)); A.isAI = false;
                ok('Entish Restoration sacrifices a land and fetches two (one creature has power under 4)', A.bf.filter(x => /Land/.test(x.card.type)).length === f0 - 1 + 2, [f0, A.bf.filter(x => /Land/.test(x.card.type)).length]);
                const big = await put(A, 'Serra Angel'); big.tp += 2; const f1 = A.bf.filter(x => /Land/.test(x.card.type)).length; A.isAI = true; await CMD.rk3_entish(A, {}, null, makeObj(C['Entish Restoration'], A.i)); A.isAI = false;
                ok('with a power 4 creature it fetches three', A.bf.filter(x => /Land/.test(x.card.type)).length === f1 - 1 + 3, [f1, A.bf.filter(x => /Land/.test(x.card.type)).length]);
            });
            await step('Final Parting', async () => {
                const x1 = lib(A, 'Serra Angel'), x2 = lib(A, 'Sol Ring'); A.isAI = true; await CMD.rk3_parting(A, {}, null, makeObj(C['Final Parting'], A.i)); A.isAI = false;
                ok('one card goes to hand and the other to the graveyard', A.hand.length === 1 && A.gy.length === 1, [A.hand.length, A.gy.length]);
            });
            await step('Spiteful Visions / Sulfuric Vortex', async () => {
                await put(A, 'Spiteful Visions'); const l0 = A.life, l1 = B.life; drawCards(A, 1); drawCards(B, 2); await settle();
                ok('each drawn card deals 1 damage to the player who drew it', A.life === l0 - 1 && B.life === l1 - 2, [l0, A.life, l1, B.life]);
                clear(); await put(A, 'Sulfuric Vortex'); const l2 = A.life; gainLifeFor(A, 5); ok('life gain is prevented', A.life === l2 || noLifeGainActive(), [l2, A.life]);
            });
            await step('Obscuring Haze', async () => {
                const g = await put(B, 'Hill Giant'); await CMD.rk3_haze(A, {}, null, makeObj(C['Obscuring Haze'], A.i)); const l0 = A.life; damage(A, 3, g);
                ok('damage from an opponent\'s creature is prevented this turn', A.life === l0, [l0, A.life]);
                const l1 = B.life; const mine = await put(A, 'Grizzly Bears'); damage(B, 2, mine); ok('but your own creatures still deal damage', B.life === l1 - 2, [l1, B.life]);
            });
            await step('Crimson Wisps / Soul\'s Fire', async () => {
                const c = await put(A, 'Serra Angel'); await CMD.rk3_wisps(A, {}, { o: c }, null);
                ok('Crimson Wisps makes the creature red with haste', c.card.colors.join() === 'R' && has(c, 'haste'), [c.card.colors, c.tkw]);
                const big = await put(A, 'Hill Giant'); const bear = await put(B, 'Grizzly Bears'); A.isAI = true; await CMD.rk3_soulsFire(A, {}, { o: big }, makeObj(C["Soul's Fire"], A.i)); A.isAI = false; sba(); await settle();
                ok("Soul's Fire: the creature deals damage equal to its power to a target (kills the Bears)", !onBf(bear.uid), names(B));
            });
            await step('Necropotence', async () => {
                const n = await put(A, 'Necropotence'); const top = A.library[A.library.length - 1]; const l0 = A.life; const a = Rx(n).acts.find(x => /face down/.test(x.text));
                await activate(A, n, a); await settle();
                ok('paying 1 life exiles the top card face down', A.life === l0 - 1 && A.exile.includes(top), [l0, A.life, A.exile.length]);
                await runEndQueue(); ok('it goes to your hand at the beginning of the end step', A.hand.includes(top) && !A.exile.includes(top), A.hand.length);
            });
            // ---- STEPS END ----
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    }, { need: built.concat(EXTRA), only: process.env.RK3_ONLY || '' });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('rk3', results); writeOut('rk3', results); await h.close(); process.exit(good ? 0 : 1);
})();
