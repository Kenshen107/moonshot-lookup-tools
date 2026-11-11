// Open board (2026-11-12, owner's MTG Arena screenshots): piles, art-first cards, one mat with a life medallion, a short stack and a phase rail,
// behind a toggle (Open board / Classic board, saved per device). spellslinger/08d-open-board.js and the end of styles.css.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    for (const [w, ht] of [[360, 740], [412, 915], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: ht });
        const r = await page.evaluate(async () => {
            const out = [];
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            try {
                const raw = await (await fetch('/__cards.json')).json(); const C = {};
                const names = ['Forest', 'Island', 'Tyrox, Saurid Tyrant', 'Grizzly Bears', 'Hill Giant', 'Llanowar Elves', "Teferi's Tutelage"];
                raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
                const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
                await newGame(mk(), mk()); T.clear(); G.turn = 7; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
                const [A, B] = G.players; A.isAI = false; B.isAI = true;
                const put = (P, n, extra) => { const o = makeObj(C[n], P.i); putOntoBattlefield(P, o); o.sick = false; Object.assign(o, extra || {}); return o; };
                for (let i = 0; i < 4; i++) put(A, 'Forest'); for (let i = 0; i < 3; i++) put(A, 'Island');
                // a Forest of another printing still joins the Forest pile
                const other = { ...C['Forest'], id: C['Forest'].id + '-alt' }; CARDS.set(other.id, other); const alt = makeObj(other, 0); putOntoBattlefield(A, alt); alt.sick = false;
                put(A, 'Llanowar Elves'); put(A, 'Llanowar Elves'); put(A, 'Hill Giant');
                const tut = put(A, "Teferi's Tutelage");
                $('game').classList.remove('hidden');
                setBoardStyle('open'); renderGame(); fitTable();
                ok('open board is on by default (class on #game)', $('game').classList.contains('open-board'));
                const pileOf = name => [...document.querySelectorAll('#meSide .perm')].filter(e => e.title.startsWith(name)).map(e => (e.querySelector('.pile-n') || {}).textContent || '×1');
                ok('lands pile by name, whatever the printing (5 Forests in one pile)', pileOf('Forest').join() === '×5', pileOf('Forest'));
                ok('identical creatures pile from 2 (Llanowar Elves ×2)', pileOf('Llanowar Elves').join() === '×2', pileOf('Llanowar Elves'));
                const life = document.querySelector('#meBar .life');
                ok('life is a round medallion with just the number', getComputedStyle(life).borderRadius === '50%' && getComputedStyle(life.querySelector('.lh')).display === 'none' && life.innerText.trim() === String(A.life), [getComputedStyle(life).borderRadius, life.innerText]);
                const img = document.querySelector('#meSide .perm img, #meSide .perm .noimg');
                ok('board cards are art-first (wider than tall)', img && img.getBoundingClientRect().width >= img.getBoundingClientRect().height, img && [img.getBoundingClientRect().width, img.getBoundingClientRect().height]);
                const rail = document.querySelector('#midBar .phase-strip.rail');
                ok('the phase strip is an icon rail that names only the current step', rail && rail.querySelector('li.now .rail-name') && rail.querySelector('li.now .rail-name').textContent === 'Main 1' && rail.querySelectorAll('.rail-name').length === 1, rail && rail.textContent.replace(/\s+/g, ' '));
                for (let i = 0; i < 5; i++) G.stack.push({ id: 900 + i, kind: 'trigger', o: tut, P: A, effects: [], name: "Teferi's Tutelage's ability" });
                renderGame();
                ok('a long stack shows only the top item and "+4 more"', document.querySelectorAll('#midBar .stack-item').length === 1 && /\+4 more/.test(($('midBar').querySelector('.stack-more') || {}).textContent || ''), document.querySelectorAll('#midBar .stack-item').length);
                stackSheet(); ok('"+N more" lists every stack item', document.querySelectorAll('#sheetHost .menu-list .btn').length === 5); closeSheet();
                const sx = document.documentElement.scrollWidth - document.documentElement.clientWidth;
                ok('no sideways scroll', sx <= 0, sx);
                // the menus carry the toggle
                gameMenu(); ok('the game menu has the Open / Classic board switch', /Classic board/.test(($('sheetHost') || {}).textContent || '')); closeSheet();
                setBoardStyle('classic');
                ok('classic: the class is off', !$('game').classList.contains('open-board'));
                ok('classic: the whole stack shows again', document.querySelectorAll('#midBar .stack-item').length === 5);
                ok('classic: the text phase strip is back', !document.querySelector('#midBar .phase-strip.rail') && !!document.querySelector('#midBar .phase-strip li.now'));
                ok('classic: lands of different printings are separate again', pileOf('Forest').length === 2, pileOf('Forest'));
                ok('the choice is saved on the device', store.get('boardStyle') === 'classic');
                setBoardStyle('open'); G.stack.length = 0;
            } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
            return out;
        });
        results.push(...formatChecks(r.map(([l, o, d]) => [`${w}px: ${l}`, o, d])));
    }
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('openboard', results);
    writeOut('openboard', results);
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
