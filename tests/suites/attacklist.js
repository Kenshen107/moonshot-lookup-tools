// Choose attackers from a list (2026-10-28): on a phone with a big board every creature can be picked, even the ones hidden under others.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
const NAMES = ['Mountain', 'Forest', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Tyrox, Saurid Tyrant'];

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    for (const [w, hgt] of [[360, 740], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: hgt });
        const r = await page.evaluate(async ([NAMES, w]) => {
            const out = [];
            try {
                const ok = (label, cond, detail) => out.push([label + ` (${w}px)`, !!cond, detail]);
                if (!window.LOCAL) {
                    const raw = await (await fetch('/__cards.json')).json();
                    window.LOCAL = {};
                    raw.forEach(c => { if (NAMES.includes(c.name) && !window.LOCAL[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); window.LOCAL[c.name] = sc; } });
                }
                const C = window.LOCAL;
                const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
                await newGame(mk(), mk());
                T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.view = 0;
                const A = G.players[0];
                const mkc = (n, k) => { for (let i = 0; i < k; i++) { const o = T.put(A, C[n]); o.sick = false; } };
                mkc('Grizzly Bears', 9); mkc('Hill Giant', 3); mkc('Serra Angel', 2);
                G.mode = { type: 'attack', sel: new Set() };
                renderGame();
                const total = A.bf.filter(canAttackWith).length;
                const btn = document.querySelector('button[onclick="attackSheet()"]');
                ok('the Choose attackers button is in the action bar', !!btn, total);
                attackSheet();
                const rows = document.querySelectorAll('.atk-row').length;
                ok('identical creatures share a row (3 kinds, ' + total + ' creatures)', rows === 3, rows);
                atkListAll(true);
                ok('Everyone selects all ' + total, G.mode.sel.size === total, G.mode.sel.size);
                atkListSet(0, 2);
                const first = window.__atkGroups[0];
                ok('the stepper sets how many of a kind attack', first.filter(o => G.mode.sel.has(o.uid)).length === 2, first.length);
                atkListAll(false);
                ok('None clears the selection', G.mode.sel.size === 0);
                atkListSet(1, 9);
                const g1 = window.__atkGroups[1];
                ok('the stepper never goes past the number of creatures', g1.filter(o => G.mode.sel.has(o.uid)).length === g1.length);
                const box = document.querySelector('.modal .box'), br = box.getBoundingClientRect();
                ok('the list fits the screen width', br.left >= 0 && br.right <= window.innerWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1, [br.left, br.right, window.innerWidth, document.documentElement.scrollWidth]);
                ok('the list fits the screen height', br.top >= 0 && br.bottom <= window.innerHeight + 1, [br.top, br.bottom, window.innerHeight]);
                const doneBtn = [...document.querySelectorAll('.modal button')].find(b => /Attack now/.test(b.textContent));
                const db = doneBtn.getBoundingClientRect();
                ok('the Attack now button is on screen', db.bottom <= window.innerHeight + 1 && db.top >= 0, [db.top, db.bottom]);
                closeModal();
                ok('closing keeps the selection', G.mode.sel.size === g1.length);
                // a creature that must attack stays selected
                const forced = A.bf.find(o => o.card.name === 'Hill Giant'); forced.mustAtk = true;
                ok('no broken invariants', T.invariants().length === 0, T.invariants());
            } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
            return out;
        }, [NAMES, w]);
        results.push(...formatChecks(r));
    }
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('attacklist', results, []);
    writeOut('attacklist', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
