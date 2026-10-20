// Attacking several opponents at once and the 👁 Board overview (2026-10-19, owner's request).
'use strict';
const path = require('path');
const fs = require('fs');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const SIZES = [[360, 740], [768, 1024], [1280, 800]];

// Offline: the few cards these checks need come from tests/data/cards_all.json (served as /__cards.json), not from Scryfall
const SETUP = async function (n) {
    if (!window.LOCAL) {
        const raw = await (await fetch('/__cards.json')).json();
        window.LOCAL = {};
        raw.forEach(c => { if (['Mountain', 'Grizzly Bears', 'Hill Giant', 'Syphon Mind', 'Tyrox, Saurid Tyrant'].includes(c.name) && !window.LOCAL[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); window.LOCAL[c.name] = sc; } });
    }
    const C = window.LOCAL;
    const mk = async () => ({ name: 'Tyrox (test)', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }, { card: C['Syphon Mind'], n: 1 }], source: 'test' });
    const decks = []; for (let i = 0; i < n; i++) decks.push(await mk());
    await newGame(decks[0], decks[1], null, decks.slice(2));
    G.active = 0; G.turn = 5; G.phase = 'main1'; G.busy = false; G.firstTurn = false;
    T.clear();
    window.C = C;
    return G.players.length;
};

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    const check = (label, ok, detail) => results.push(...formatChecks([[label, ok, detail]]));

    await page.evaluate(SETUP, 4);
    // 1. Attackers split between two opponents: each defender blocks only what comes at them, damage goes to the right player
    let r = await page.evaluate(async () => {
        const [A, B, Cc, D] = G.players; A.isAI = true; B.isAI = true; Cc.isAI = true; D.isAI = true;
        const a1 = T.put(A, C['Hill Giant']), a2 = T.put(A, C['Hill Giant']), a3 = T.put(A, C['Grizzly Bears']);
        [a1, a2, a3].forEach(o => { o.sick = false; });
        const bB = T.put(B, C['Hill Giant']); // B has a blocker, C has none
        B.life = Cc.life = D.life = 40;
        a1.atkTo = 1; a2.atkTo = 2; a3.atkTo = 2; G.defender = 1;
        declareAttackers(A, [a1, a2, a3]);
        const groups = attackGroups(A).map(g => ({ d: g.d, n: g.uids.length }));
        const ok = await chooseBlocksAll(A, {});
        const sameAttackers = G.attackers.length === 3;
        combatDamage(A);
        return { groups, ok, sameAttackers, lives: G.players.map(P => P.life), cleared: [a1, a2, a3].every(o => o.atkTo === undefined), defender: G.defender };
    });
    check('the attack makes one group per defender', r.groups.length === 2 && r.groups[0].d === 1 && r.groups[0].n === 1 && r.groups[1].d === 2 && r.groups[1].n === 2, r.groups);
    check('all attackers stay in the combat after the block steps', r.ok && r.sameAttackers, r);
    check('damage goes to the player each attacker was sent at', r.lives[2] === 40 - 3 - 2 && r.lives[3] === 40 && r.lives[0] === 40 && (r.lives[1] === 40 || r.lives[1] === 40 - 3), r.lives);
    check('the targets are cleared after combat', r.cleared, r);

    // 2. The computer sends enough attackers at a second player it can finish off
    r = await page.evaluate(async () => {
        await window.SETUPAGAIN?.();
        const [A, B, Cc, D] = G.players;
        const k = []; for (let i = 0; i < 4; i++) { const o = T.put(A, C['Hill Giant']); o.sick = false; k.push(o); }
        B.life = 40; Cc.life = 6; D.life = 40; G.defender = 1;
        aiAssignTargets(A, k);
        return k.map(o => o.atkTo);
    });
    check('a low-life player with no blockers gets enough attackers to die', r.filter(x => x === 2).length >= 2 && r.some(x => x === 1), r);

    // 3. The board overview
    for (const [w, hgt] of SIZES) {
        await page.setViewportSize({ width: w, height: hgt });
        await page.evaluate(SETUP, 4);
        const m = await page.evaluate(() => {
            const P = G.players;
            for (let k = 0; k < 24; k++) { const o = T.put(P[0], k % 2 ? C['Hill Giant'] : C['Grizzly Bears']); o.tapped = k % 5 === 0; }
            T.put(P[0], C['Mountain']);
            renderGame(); fitTable();
            OV.sel = null; boardOverview(0);
            const cnt1 = document.querySelectorAll('.ov-tile').length;
            ovPick(P[0].bf[1].uid);
            const detail = !!document.querySelector('.ov-detail img') || !!document.querySelector('.ov-detail .noimg');
            ovSet('mode', 'list');
            const rows = document.querySelectorAll('.ov-tile.row-tile').length;
            boardOverview(1);
            const tabs = document.querySelectorAll('.ov .btn.small').length;
            const box = document.querySelector('.modal .box').getBoundingClientRect();
            return { cnt1, detail, rows, tabs, scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth, boxW: box.width, vw: innerWidth };
        });
        check(`${w}px: the overview lists all 24 creatures`, m.cnt1 === 24, m);
        check(`${w}px: a tapped creature is read in the detail pane, the list view works, tabs switch players`, m.detail && m.rows === 24 && m.tabs >= 5, m);
        check(`${w}px: the overview fits (no sideways scroll)`, m.scrollX <= 0 && m.boxW <= m.vw, m);
        await page.screenshot({ path: path.join(ROOT, 'tests', '.out', `overview-${w}.png`) });
        await page.evaluate(() => closeModal());
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    const ok = printResults('multiattack', results, errors);
    writeOut('multiattack', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
