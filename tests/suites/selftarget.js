// "Target player" effects can target yourself (2026-10-20, owner: Singularity Rupture): the player choice, the multi-player chooser and the effects that used to hit only opponents.
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
        raw.forEach(c => { if (['Mountain', 'Grizzly Bears', 'Hill Giant', 'Syphon Mind', 'Tyrox, Saurid Tyrant', 'Singularity Rupture'].includes(c.name) && !window.LOCAL[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); window.LOCAL[c.name] = sc; } });
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
    let r = await page.evaluate(async () => {
        const [A, B, Cc, D] = G.players; const rec = c => c.card.text;
        const sr = window.C['Singularity Rupture'] || null;
        const status = sr ? rulesFor(sr) : null;
        [A, B, Cc, D].forEach(P => { P.library.length = 0; for (let i = 0; i < 20; i++) P.library.push(makeObj(C['Mountain'], P.i)); });
        const src = T.put(A, C['Hill Giant']);
        await applyEffect(A, { t: 'millHalfChosen', down: true }, null, src);
        const afterAI = G.players.map(P => P.library.length);
        // a person picks themselves too
        A.isAI = false; window.__realAuto = AUTOPLAY;
        const lens0 = G.players.map(P => P.library.length);
        const pm = pickPlayers(A, 'Test: choose', G.players.filter(x => !x.out), [1, 2, 3]);
        const boxes = document.querySelectorAll('#modalHost input[name=pp]').length;
        const selfBox = document.querySelector('#modalHost input[name=pp][value="0"]');
        const preChecked = [...document.querySelectorAll('#modalHost input[name=pp]:checked')].map(i => i.value).join(',');
        selfBox.checked = true; document.querySelector('#modalHost button.primary').click();
        const picked = (await pm).map(x => x.i).join(',');
        return { read: status && status.support, afterAI, boxes, preChecked, picked, selfLabel: /Yourself/.test(document.body.innerHTML) || true };
    });
    check('Singularity Rupture reads as Automated', r.read === 'full', r.read);
    check('the computer mills every opponent (half down) and not itself without graveyard synergy', r.afterAI[0] === 20 && r.afterAI[1] === 10 && r.afterAI[2] === 10 && r.afterAI[3] === 10, r.afterAI);
    check('the chooser lists all four players, opponents ticked first', r.boxes === 4 && r.preChecked === '1,2,3', r);
    check('a person can tick themselves too', r.picked === '0,1,2,3', r.picked);
    r = await page.evaluate(async () => {
        const [A, B, Cc, D] = G.players; A.isAI = true;
        [A, B, Cc, D].forEach(P => { P.library.length = 0; for (let i = 0; i < 21; i++) P.library.push(makeObj(C['Mountain'], P.i)); P.life = 40; });
        const src = T.put(A, C['Hill Giant']);
        await applyEffect(A, { t: 'millHalf', down: true, target: 'player' }, { p: A }, src);
        const afterMill = G.players.map(P => P.library.length);
        await applyEffect(A, { t: 'drain', n: 3, target: 'player' }, { p: A }, src);
        const lives = G.players.map(P => P.life);
        await applyEffect(A, { t: 'drain', n: 4, target: 'player' }, { p: Cc }, src);
        const lives2 = G.players.map(P => P.life);
        return { afterMill, lives, lives2, tr: rulesFor(C['Mountain']) && 1 };
    });
    check('"target player mills half their library" hits only the chosen player, even yourself', r.afterMill[0] === 11 && r.afterMill[1] === 21 && r.afterMill[2] === 21, r.afterMill);
    check('"target player loses N life" hits only the chosen player (not every opponent)', r.lives[0] === 37 && r.lives[1] === 40 && r.lives[2] === 40 && r.lives2[2] === 36 && r.lives2[1] === 40, [r.lives, r.lives2]);
    r = await page.evaluate(() => { const [A] = G.players; const src = T.put(A, C['Hill Giant']); const burn = aiPickTarget(A, { t: 'dmg', n: 3, target: 'player' }, src), loot = aiPickTarget(A, { t: 'loot', n: 2, d: 2, target: 'player', good: true }, src); return { burn: burn && burn.p ? burn.p.i : null, loot: loot && loot.p ? loot.p.i : null }; });
    check('the computer burns an opponent, never itself, and loots itself', r.burn !== null && r.burn !== 0 && r.loot === 0, r);
    r = await page.evaluate(async () => { const t = rulesFor(window.C['Singularity Rupture']); return JSON.stringify(t.spell && t.spell.map(e => e.t)); });
    check('Singularity Rupture destroys all creatures, then lets you choose the players', r === '["wipe","millHalfChosen"]', r);
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    const ok = printResults('selftarget', results, errors);
    writeOut('selftarget', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
