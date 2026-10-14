// 3- and 4-player pods (free-for-all Commander, 2026-10-14): seats, elimination, each-opponent effects, commander damage per source,
// attacking one opponent, turn order skipping players who are out, and the pod strip on the table at phone, tablet and desktop widths.
'use strict';
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const SIZES = [[360, 740], [768, 1024], [1280, 800]];

const SETUP = async function (n) {
    const C = await T.cards(['Mountain', 'Grizzly Bears', 'Hill Giant', 'Syphon Mind']);
    const mk = () => listToOppDeck('1 Tyrox, Saurid Tyrant\n98 Mountain', 'commander');
    const decks = []; for (let i = 0; i < n; i++) decks.push(await mk());
    await newGame(decks[0], decks[1], null, decks.slice(2));
    G.active = 0; G.turn = 5; G.phase = 'main1'; G.busy = false; G.firstTurn = false;
    T.clear();
    window.C = C;
    return G.players.length;
};

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    const check = (label, ok, detail) => results.push(...formatChecks([[label, ok, detail]]));

    const count = await page.evaluate(SETUP, 4);
    check('a 4-player game has four seats', count === 4, count);

    // Each opponent
    let r = await page.evaluate(async () => {
        const [A, B, Cc, D] = G.players;
        const src = T.put(A, C['Grizzly Bears']);
        const before = G.players.map(P => P.life);
        await applyEffect(A, { t: 'drain', n: 3 }, null, src);
        return { before, after: G.players.map(P => P.life), lost: G.lastLost };
    });
    check('"each opponent loses 3" hits all three opponents and not the caster', r.after[0] === r.before[0] && [1, 2, 3].every(i => r.after[i] === r.before[i] - 3), r);
    check('the life lost is the total (for "gain life equal to the life lost")', r.lost === 9, r.lost);

    r = await page.evaluate(async () => {
        const [A] = G.players, src = T.put(A, C['Grizzly Bears']);
        const before = G.players.map(P => P.life);
        await applyEffect(A, { t: 'dmg', target: 'opponents', n: 2 }, null, src);
        return { before, after: G.players.map(P => P.life) };
    });
    check('"deals 2 damage to each opponent" hits all three', [1, 2, 3].every(i => r.after[i] === r.before[i] - 2) && r.after[0] === r.before[0], r);

    // Commander damage counts per commander
    r = await page.evaluate(() => {
        T.clear();
        const [A, B, Cc] = G.players;
        const a = A.command[0] || makeObj(CARDS.get([...CARDS.keys()][0]), 0);
        const ca = G.players[1].command[0], cc = G.players[2].command[0];
        ca.isCommander = true; cc.isCommander = true;
        G.format = 'commander';
        damage(A, 12, { ...ca, isCommander: true, owner: 1, card: ca.card, uid: ca.uid }); damage(A, 12, { ...cc, isCommander: true, owner: 2, card: cc.card, uid: cc.uid });
        return { by: { ...A.cmdBy }, dmg: A.cmdDmg, out: A.out };
    });
    check('commander damage is tracked per commander (12 + 12 from two commanders is not 24 from one)', r.by[1] === 12 && r.by[2] === 12 && r.dmg === 12 && !r.out, r);

    // Elimination
    r = await page.evaluate(async () => {
        T.clear();
        const [A, B, Cc, D] = G.players;
        T.put(B, C['Grizzly Bears']); T.put(B, C['Mountain']);
        B.life = 0; sba();
        const afterB = { bOut: B.out, bBf: B.bf.length, over: G.over, alive: G.players.filter(P => !P.out).length };
        Cc.life = -2; sba();
        const afterC = { cOut: Cc.out, over: G.over, alive: G.players.filter(P => !P.out).length };
        G.active = 0; G.turn = 9;
        const order = []; let seat = 0;
        for (let k = 0; k < 4; k++) { seat = seatAfter(seat).i; order.push(seat); }
        const oppOfA = opp(A).i;
        D.life = 0; sba();
        return { afterB, afterC, order, oppOfA, over: G.over, winner: window.lastResult && window.lastResult.winner };
    });
    check('a player at 0 life leaves the pod, their permanents go, and the game goes on', r.afterB.bOut && r.afterB.bBf === 0 && !r.afterB.over && r.afterB.alive === 3, r.afterB);
    check('a second player leaves; two remain and the game goes on', r.afterC.cOut && !r.afterC.over && r.afterC.alive === 2, r.afterC);
    check('turn order skips players who are out', JSON.stringify(r.order) === '[3,0,3,0]', r.order);
    check('opp() skips players who are out', r.oppOfA === 3, r.oppOfA);
    check('the last player standing wins', r.over && r.winner === 0, { over: r.over, winner: r.winner });

    // The table: chips, focus, layout at three widths
    const checks = [];
    for (const [w, hgt] of SIZES) {
        await page.setViewportSize({ width: w, height: hgt });
        await page.evaluate(SETUP, 4);
        const m = await page.evaluate(() => {
            const P = G.players;
            [1, 2, 3].forEach(i => { for (let k = 0; k < 6; k++) T.put(P[i], C['Hill Giant']); T.put(P[i], C['Mountain']); });
            T.put(P[0], C['Grizzly Bears']);
            G.active = 0; G.phase = 'main1'; G.focusPick = null;
            renderGame(); fitTable();
            const chips = [...document.querySelectorAll('.pod-chip')];
            const first = foe().i;
            podFocus(3);
            const after = foe().i;
            const onChip = document.querySelectorAll('.pod-chip.on').length;
            const r = el => el.getBoundingClientRect();
            const strip = r(document.querySelector('.pod-strip'));
            return { n: chips.length, first, after, onChip, scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth, stripRight: strip.right, vw: innerWidth, oppSideH: r($('oppSide')).height };
        });
        check(`${w}px: three opponent chips, tapping one shows that board`, m.n === 3 && m.after === 3 && m.onChip === 1, m);
        check(`${w}px: no sideways scroll and the strip fits`, m.scrollX <= 0 && m.stripRight <= m.vw + 1, m);
        check(`${w}px: the opponent's board keeps room`, m.oppSideH > 60, m.oppSideH);
        await page.screenshot({ path: path.join(ROOT, 'tests', '.out', `pod-${w}.png`) });
    }
    const chips = await page.evaluate(() => ({ cmd: (podChipsHTML({ format: 'commander' }).match(/setPodSize/g) || []).length, modern: podChipsHTML({ format: 'modern' }) }));
    check('the Play tab offers 1v1, 3 players and 4 players for Commander decks only', chips.cmd === 3 && chips.modern === '', chips);
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    const ok = printResults('pod', results, errors);
    writeOut('pod', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
