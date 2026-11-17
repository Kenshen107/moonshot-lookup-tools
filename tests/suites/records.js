// Pod game records (2026-10-20): a 4-player game is recorded on the device (log, the person's choices, result) and can be copied as text.
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

    await page.evaluate(() => { window.__REC_FORCE = true; store.set('gameRecords', []); });
    await page.evaluate(SETUP, 4);
    let r = await page.evaluate(async () => {
        const [A] = G.players; A.isAI = false;
        log('— Turn 1: test —'); log('You cast Grizzly Bears.');
        const yes = await askYes(A, 'Kicker? <b>pay</b> {2}', {});
        const num = await askNumber(A, 'Choose X', 0, 5, 3, {});
        log('Hill Giant dies.'); log('some boring line');
        const before = (store.get('gameRecords') || []).length;
        endGame(1, 'Test wins by life');
        const list = store.get('gameRecords') || [];
        const rec = list[0];
        return { before, after: list.length, yes, hasChoice: !!rec && rec.log.some(l => /^» .* chose \[Kicker\?/.test(l)), hasPick: !!rec && rec.log.some(l => /chose \[Choose X\]: 3/.test(l)),
            players: rec && rec.players.length, result: rec && rec.result, human: rec && rec.humanSeat, short: rec && recText(rec, 'short'), full: rec && recText(rec, 'full'), btn: (() => { showModal('<h2>You lose</h2><p>x</p><div class="row"><button class="btn">Back</button></div>'); const ok = recAddCopyButton(list[0].id); return ok && !!document.querySelector('#modalHost button[onclick^="recCopyId"]'); })() };
    });
    check('a 4-player game with a person is saved when it ends', r.before === 0 && r.after === 1 && r.players === 4, r);
    check("the person's choices are recorded with the prompt and the answer", r.hasChoice && r.hasPick, r);
    check('the result is lost for the person when another seat wins', r.result === 'lost' && r.human === 0, [r.result, r.human]);
    check('the short text has the header, the choices and the key lines but not the noise', /^SPELLSLINGER POD RECORD v2 \(short\)/.test(r.short) && /Seat 1 \(the player\)/.test(r.short) && /» /.test(r.short) && /dies/.test(r.short) && !/boring/.test(r.short), r.short);
    check('the full text keeps every line', /boring/.test(r.full) && /\(full log\)/.test(r.full), r.full && r.full.length);
    check('the game-over screen has a Copy this game button', r.btn);
    r = await page.evaluate(async () => {
        recordsPanel();
        const listed = document.querySelectorAll('#modalHost .about-card').length;
        const id = store.get('gameRecords')[0].id; recView(id, 'short');
        const ta = document.getElementById('recText');
        let copied = null; const orig = navigator.clipboard; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { copied = t; return Promise.resolve(); } }, configurable: true }); } catch (e) { }
        recCopyId(id, 'short'); await new Promise(r => setTimeout(r, 50));
        return { listed, boxText: ta && ta.value.slice(0, 30), copied: copied && copied.slice(0, 30), copyTextOk: typeof recCopyText === 'function' };
    });
    check('the records panel lists the game and the viewer shows the text', r.listed === 1 && /SPELLSLINGER POD RECORD/.test(r.boxText || ''), r);
    check('Copy puts the text on the clipboard', /SPELLSLINGER POD RECORD/.test(r.copied || '') || r.copied === null, r);
    // 2-player games with a person are recorded too (2026-11-17); a game with no person at the table (the lab, autoplay) is not
    r = await page.evaluate(async () => {
        const C = window.C; const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }, { card: C['Syphon Mind'], n: 1 }], source: 'test' });
        window.__REC_FORCE = false;
        await newGame(mk(), mk()); G.players.forEach(P => { P.isAI = true; }); log('no person line');
        const none = G.rec ? G.rec.log.length : 0;
        window.__REC_FORCE = true; G.players[0].isAI = false; log('two player line');
        const some = G.rec ? G.rec.log.length : 0;
        return { none, some };
    });
    check('a game with no person at the table is not recorded', r.none === 0, r);
    check('a 2-player game with a person is recorded', r.some === 1, r);
    // Structured records: decklists, a snapshot per turn, decisions with their state, the computer's options, an export
    r = await page.evaluate(async () => {
        window.__REC_FORCE = true; store.set('gameRecords', []);
        const C = window.C; const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 98 }, { card: C['Syphon Mind'], n: 1 }], source: 'test' });
        await newGame(mk(), mk());
        const [A, B] = G.players; A.isAI = false; B.isAI = true;
        G.active = 0; G.turn = 5; G.phase = 'main1'; G.busy = false; G.firstTurn = false; T.clear();
        log('— Turn 5 —');
        const bears = T.put(A, C['Grizzly Bears']), giant = T.put(B, C['Hill Giant']);
        const land = makeObj(C['Mountain'], A.i); A.hand.push(land);
        await playLand(A, land);
        await askYes(A, 'Test question', {});
        declareAttackers(A, [bears]);
        G.blocks[bears.uid] = [giant.uid];
        combatDamage(A);
        eliminate(B, 'test reasons');
        G.recCands = { pick: giant, list: [{ c: 'Hill Giant', s: 5, tgt: null, picked: true }] };
        window.__recGameOver = true;
        endGame(0, 'Test wins');
        const rec = (store.get('gameRecords') || [])[0];
        const evs = rec.ev || [], kinds = evs.filter(e => e.e === 'dec').map(e => e.k);
        return { v: rec.v, decks: rec.players.map(p => p.deckList.length), kinds, landEv: evs.find(e => e.k === 'land'), prompt: evs.find(e => e.k === 'prompt'), atk: evs.find(e => e.k === 'attack'), blk: evs.find(e => e.k === 'block'), out: evs.find(e => e.e === 'out'),
            hasSnap: !!(evs.find(e => e.k === 'land') || {}).st, final: !!rec.final, bytes: rec.bytes > 0, summary: recText(rec, 'short').includes('Summary:') || recText(rec, 'short').includes('Spells cast'), title: recText(rec, 'short').split('\n')[0], jsonl: recJsonl([rec]).split('\n').filter(Boolean).length, parses: (() => { try { return JSON.parse(recJsonl([rec]).trim()).id === rec.id; } catch (e) { return false; } })() };
    });
    check('v2 records hold a decklist for every seat', r.v === 2 && r.decks.every(n => n >= 2), r);
    check('a land play, a prompt, attackers, blockers and an elimination are recorded as events', r.kinds.includes('land') && r.kinds.includes('prompt') && r.kinds.includes('attack') && r.kinds.includes('block') && !!r.out, r.kinds);
    check('a decision keeps the state it was made in', r.hasSnap && r.landEv && r.landEv.st && r.landEv.st.life.length === 2, r.landEv);
    check('the prompt event keeps the options and the answer', r.prompt && r.prompt.prompt === 'Test question' && r.prompt.opts.join() === 'yes,no' && !!r.prompt.choice, r.prompt);
    check('attackers and blockers name the creatures', r.atk && r.atk.atk[0].c === 'Grizzly Bears' && r.blk && r.blk.blocks[0].by[0] === 'Hill Giant', [r.atk, r.blk]);
    check('the final state and size are saved and the short text has a summary', r.final && r.bytes && r.summary && /GAME RECORD v2/.test(r.title), r.title);
    check('export is one game per line and every line parses', r.jsonl === 1 && r.parses, r);
    // The real download: Export all gives a .jsonl file with one game per line
    await page.evaluate(() => { recordsPanel(); });
    const dl = page.waitForEvent('download', { timeout: 8000 });
    await page.evaluate(() => recExport(null));
    const file = await dl; const txt = fs.readFileSync(await file.path(), 'utf8');
    check('Export all downloads a .jsonl file with the games', /\.jsonl$/.test(file.suggestedFilename()) && txt.trim().split('\n').every(l => { try { return !!JSON.parse(l).players; } catch (e) { return false; } }), file.suggestedFilename());
    const dl2 = page.waitForEvent('download', { timeout: 8000 });
    await page.evaluate(() => recExport(null, true));
    const f2 = await dl2; const gz = fs.readFileSync(await f2.path());
    check('the compressed export is a real gzip file', /\.jsonl\.gz$/.test(f2.suggestedFilename()) && gz[0] === 0x1f && gz[1] === 0x8b, f2.suggestedFilename());
    r = await page.evaluate(() => { recordsPanel(); const b = [...document.querySelectorAll('#modalHost button')].map(x => x.textContent); return { all: b.some(t => /Export all/.test(t)), one: b.some(t => /^⬇ Export$/.test(t)) }; });
    check('the panel has Export all and Export for each game', r.all && r.one, r);
    // phones and desktop: the panel fits
    for (const [w, hgt] of [[360, 740], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: hgt });
        const m = await page.evaluate(() => { recordsPanel(); const b = document.querySelector('#modalHost .box').getBoundingClientRect(); return { scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: b.width, vw: innerWidth }; });
        check(`${w}px: the records panel fits`, m.scrollX <= 0 && m.w <= m.vw, m);
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    const ok = printResults('records', results, errors);
    writeOut('records', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
