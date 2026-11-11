// Additional combat phases (2026-11-11, owner: "we need to fix extra combat spells they don't work as of now"): an additional combat made in the
// second main phase, or while nothing could attack, used to be ignored (it was only looked for after combat damage); a person's End turn also
// ended the turn with the extra combat still waiting.
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
            const want = ['Island', 'Mountain', 'Grizzly Bears', 'Tyrox, Saurid Tyrant', 'Hill Giant', 'Relentless Assault', 'Seize the Day', 'Aggravated Assault', 'Waves of Aggression'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            manaMode = 'auto';
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            const fresh = async () => {
                await newGame(mk(), mk()); T.clear(); G.turn = 6; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.extraCombat = 0; G.extraCombatOn = false;
                const [A, B] = G.players; A.isAI = true; B.isAI = true; A.life = B.life = 40;
                const put = (P, n) => { const o = makeObj(C[n], P.i); putOntoBattlefield(P, o); o.sick = false; return o; };
                return [A, B, put];
            };
            // 1. The computer: an additional combat waiting at the start (made before combat, nothing attacked yet) is played
            const lifeAfter = async (extra, main2Extra) => {
                const [A, B, put] = await fresh(); [put(A, 'Hill Giant'), put(A, 'Grizzly Bears')].forEach(o => o.tkw.push('vigilance')); // vigilance stands in for "untap all creatures"
                G.active = A.i; G.phase = 'main1'; G.extraCombat = extra;
                let calls = 0; const real = window.aiMain;
                window.aiMain = async P => { await real(P); if (main2Extra && ++calls === 2) G.extraCombat = 1; };
                try { await aiTurn(A); } finally { window.aiMain = real; }
                return { life: B.life, left: G.extraCombat, calls };
            };
            const base = await lifeAfter(0, false), pre = await lifeAfter(1, false), post = await lifeAfter(0, true);
            ok('a normal turn: the creatures hit once (3 + 2 = 5)', base.life === 35, base);
            ok('an additional combat made before combat is played (hits twice)', pre.life === 30 && pre.left === 0, pre);
            ok('an additional combat made in the second main phase is played after it (hits twice)', post.life === 30 && post.left === 0, post);
            // 2. A person: End turn with an additional combat waiting starts it instead of ending the turn
            { const [A, B, put] = await fresh(); A.isAI = false; put(A, 'Grizzly Bears'); G.active = 0; G.view = 0; G.phase = 'main2'; G.extraCombat = 1; const turn0 = G.turn;
              ok('the turn button says an additional combat is coming', /Extra combat/.test(turnButtonHTML()), turnButtonHTML().slice(0, 200));
              await endMyTurn();
              ok('End turn with an additional combat waiting starts it (attack mode, same turn)', G.turn === turn0 && G.phase === 'declareAttackers' && G.mode && G.mode.type === 'attack' && G.extraCombat === 0 && G.extraCombatOn === true, [G.turn, G.phase, G.mode && G.mode.type, G.extraCombat]); }
            // 3. A person in main 1 who skips combat still gets it
            { const [A, B, put] = await fresh(); A.isAI = false; put(A, 'Hill Giant'); G.active = 0; G.view = 0; G.phase = 'main1'; G.extraCombat = 1; const turn0 = G.turn;
              await endMyTurn(); ok('End turn from the first main phase with an additional combat waiting starts it', G.turn === turn0 && G.phase === 'declareAttackers', [G.turn, G.phase]); }
            // 4. End turn after blocks deals damage, then starts the additional combat rather than ending the turn
            { const [A, B, put] = await fresh(); A.isAI = false; put(A, 'Hill Giant'); G.active = 0; G.view = 0; G.phase = 'afterBlocks'; G.attackers = []; G.blocks = {}; G.extraCombat = 1; const turn0 = G.turn;
              await endMyTurn(); ok('End turn after blocks: damage, then the additional combat (the turn does not end)', G.turn === turn0 && G.phase === 'declareAttackers' && G.extraCombat === 0, [G.turn, G.phase, G.extraCombat]); }
            // 5. Nothing left waiting: End turn ends the turn as before
            { const [A, B, put] = await fresh(); A.isAI = false; put(A, 'Hill Giant'); G.active = 0; G.view = 0; G.phase = 'main2'; const turn0 = G.turn, act0 = G.active;
              await endMyTurn(); ok('with no additional combat the turn ends as before', G.phase !== 'main2' && G.phase !== 'declareAttackers', [G.phase]); }
            // 6. The real cards
            { const [A, B, put] = await fresh(); A.isAI = false; const bear = put(A, 'Grizzly Bears'); bear.tapped = true; G.attackers = [bear.uid]; G.active = 0; G.view = 0; G.phase = 'main2';
              const c = makeObj(C['Relentless Assault'], 0); await resolveEffects(A, spellEffects(c), null, c); await settle();
              ok('Relentless Assault cast in the second main phase: the attackers untap and the additional combat starts', !bear.tapped && G.phase === 'declareAttackers' && G.extraCombat === 0, [bear.tapped, G.phase, G.extraCombat]); }
            { const [A, B, put] = await fresh(); const bear = put(A, 'Grizzly Bears'); bear.tapped = true; G.active = 0; G.phase = 'main2';
              const c = makeObj(C['Seize the Day'], 0); await resolveEffects(A, spellEffects(c), { o: bear }, c);
              ok('Seize the Day untaps the creature and an additional combat is waiting', !bear.tapped && G.extraCombat === 1, [bear.tapped, G.extraCombat]); }
            { const [A, B, put] = await fresh(); const bear = put(A, 'Grizzly Bears'); bear.tapped = true; const aa = put(A, 'Aggravated Assault'); G.active = 0; G.phase = 'main1';
              const a0 = (Rx(aa).acts || [])[0]; ok('Aggravated Assault reads as fully Automated with its activated ability', Rx(aa).support === 'full' && !!a0, Rx(aa).support);
              if (a0) { await resolveEffects(A, a0.effects, null, aa); ok('Aggravated Assault: untaps your creatures and adds an additional combat', !bear.tapped && G.extraCombat === 1, [bear.tapped, G.extraCombat]); } }
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('extracombat', results);
    writeOut('extracombat', r);
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
