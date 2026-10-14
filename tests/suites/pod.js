// 3- and 4-player pods (free-for-all Commander, 2026-10-14): seats, elimination, each-opponent effects, commander damage per source,
// attacking one opponent, turn order skipping players who are out, and the pod strip on the table at phone, tablet and desktop widths.
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

    // Politics, moods, free mulligan, play-by-play in pods
    await page.evaluate(SETUP, 4);
    r = await page.evaluate(async () => {
        T.clear();
        const [A, B, Cc, D] = G.players;
        for (let i = 0; i < 7; i++) T.put(Cc, C['Hill Giant']);
        T.put(B, C['Grizzly Bears']); T.put(D, C['Grizzly Bears']);
        G.active = 0; G.defender = null; G.turn = 12;
        updateArchenemy();
        const arch = G.arch, pick = podPickDefender(A).i, pickB = podPickDefender(B).i;
        B.aiStyle = 'aggro'; D.life = 6; const aggroPick = podPickDefender(B).i; B.aiStyle = null; D.life = 40;
        Cc.bf.length = 0; updateArchenemy(); const after = G.arch;
        B.life = 5; const worried = botMood(B).mood; B.life = 40;
        B.grudge = { 0: 9 }; const angry = botMood(B).mood; B.grudge = {};
        const before = G.log.length; botSay(B, 'angry', 'I will remember that.', 'test'); const said = G.log.length - before;
        botSay(B, 'angry', 'again', 'test'); const repeat = G.log.length - before;
        G.players.forEach(X => { X.mulligans = 0; });
        const mb = [1, 2].map(n => { A.mulligans = n; return mullBottom(A); });
        G.players.length = 2; A.mulligans = 1; const mb2 = mullBottom(A);
        return { arch, pick, pickB, aggroPick, after, worried, angry, said, repeat, mb, mb2, act: String(actOn).includes('length === 2') };
    });
    check('one player far ahead becomes the archenemy', r.arch === 2, r.arch);
    check('every bot attacks the archenemy', r.pick === 2 && r.pickB === 2, { a: r.pick, b: r.pickB });
    check('an aggro bot still finishes a nearly dead player first', r.aggroPick === 3, r.aggroPick);
    check('the archenemy label goes away when the lead does', r.after === null, r.after);
    check('a bot at 5 life feels worried, one with a big grudge feels angry', r.worried === 'worried' && r.angry === 'angry', { w: r.worried, a: r.angry });
    check('a bot speaks once and not again right away', r.said === 1 && r.repeat === 1, { said: r.said, repeat: r.repeat });
    check('in a pod the first mulligan is free (0 on the bottom), the second puts 1; a duel puts 1', r.mb[0] === 0 && r.mb[1] === 1 && r.mb2 === 1, { pod: r.mb, duel: r.mb2 });
    check('the play-by-play popups are on in pods too (not only duels)', !r.act, r.act);
    check('the speech bubble shows the bot, its feeling and the line', await page.evaluate(() => { showBubble(G.players[1], 'worried', 'Test line'); const t = document.querySelector('#talkLayer .talk-bubble'); return !!t && /feeling worried/.test(t.textContent) && /Test line/.test(t.textContent); }), '');

    // Deals
    await page.evaluate(SETUP, 4);
    r = await page.evaluate(async () => {
        const out = {};
        G.players.length = 4; G.players.forEach(P => { P.out = false; P.life = 40; P.grudge = {}; P.trust = {}; P.bf.length = 0; P.aiStyle = 'midrange'; P.isAI = true; });
        G.deals = []; G.dealStats = null; G.rep = {}; G.arch = null; G.turn = 20; G.active = 0;
        const [A, B, Cc, D] = G.players;
        // 1. a calm bot says yes to peace, an aggro bot with a grudge says no
        const ok = proposeDeal(A, B, 'peace');
        out.accepted = ok.ok && hasPeace(0, 1);
        D.aiStyle = 'aggro'; D.grudge = { 0: 9 };
        const no = proposeDeal(A, D, 'peace');
        out.declined = !no.ok && !hasPeace(0, 3) && /went after me|trust|play/i.test(no.reason);
        // 2. a bot at peace with you does not pick you as its target, and keeps its word even with lethal (not aggro)
        A.life = 3; T.put(B, C['Hill Giant']); B.bf[0].sick = false;
        G.defender = null; out.picksOther = podPickDefender(B).i !== 0;
        // 3. an aggro bot at peace with you breaks it for lethal
        B.aiStyle = 'aggro'; out.aggroLethal = podPickDefender(B).i === 0;
        B.aiStyle = 'midrange'; A.life = 40;
        // 4. attacking a peace partner breaks it: trust and reputation drop, the partner remembers
        G.log.length = 0;
        dealsOnAttack(A, B);
        out.broken = !hasPeace(0, 1) && B.trust[0] === -3 && G.rep[0] === -1 && B.grudge[0] >= 4 && G.dealStats.broken === 1;
        // 5. a later ask is judged harder
        out.lowerScore = dealScore(B, A, 'peace').score < dealScore(Cc, A, 'peace').score;
        // 6. spare: spells cannot target a spare partner's permanents (bot target filter)
        proposeDeal(A, Cc, 'spare');
        const dude = T.put(Cc, C['Hill Giant']);
        const t = aiPickTarget(A, { t: 'destroy', target: 'creature' }, null, [{ o: dude }, { o: T.put(D, C['Grizzly Bears']) }]);
        out.spare = t && t.o.owner === 3;
        // 7. a pact names the target
        proposeDeal(A, Cc, 'pact', 3);
        out.pact = !!pactTarget(Cc) && pactTarget(Cc).i === 3;
        // 8. deals run out when the maker's next turn starts
        const d = G.deals.find(x => x.type === 'spare'); d.turn = 1; d.owner = 0; G.turn = 30; expireDeals(A);
        out.expired = !G.deals.find(x => x === d) && G.dealStats.kept >= 1;
        return out;
    });
    check('a calm bot agrees to peace; an aggro bot you have hurt says no, and why', r.accepted && r.declined, r);
    check('a bot at peace with you attacks someone else, even with a chance at lethal (unless it plays Aggro)', r.picksOther && r.aggroLethal, r);
    check('breaking a deal costs trust with that bot and reputation with everyone', r.broken, r);
    check('a player who broke a deal is judged harder next time', r.lowerScore, r);
    check('a hands-off deal keeps a bot from targeting that player\'s permanents', r.spare, r);
    check('a gang-up pact names who the bot attacks', r.pact, r);
    check('deals run out on the maker\'s next turn and count as kept', r.expired, r);

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
            const chips = [...document.querySelectorAll('.pod-chip')].filter(c => !/Deals/.test(c.textContent));
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
