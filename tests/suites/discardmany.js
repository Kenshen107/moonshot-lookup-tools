// Hand-size discard in one panel (spellslinger/15zk-discard-many.js)
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: path.join(ROOT, 'tests', '.cache', 'discardmany') });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        const C = await T.cards(['Forest', 'Grizzly Bears', 'Hill Giant']);
        const [A] = await T.newGame(); T.clear(); A.isAI = false; window.__DISCARD_UI = true;
        A.hand.length = 0;
        for (let i = 0; i < 6; i++) A.hand.push(makeObj(C['Forest'], 0));
        for (let i = 0; i < 3; i++) A.hand.push(makeObj(C['Grizzly Bears'], 0));
        A.hand.push(makeObj(C['Hill Giant'], 0)); // 10 cards: discard 3
        const pr = pickDiscardMany(A, 3);
        await new Promise(r => setTimeout(r, 100));
        const okBtn = () => document.getElementById('ddOk');
        ok('panel lists 3 different cards, Discard locked', document.querySelectorAll('#ddBody .row').length >= 3 && okBtn().disabled, document.getElementById('ddBody').innerText.slice(0, 120));
        __ddStep(2, 1); __ddStep(2, 1); await new Promise(r => setTimeout(r, 20));
        ok('two chosen: still locked', okBtn().disabled);
        __ddStep(1, 1); await new Promise(r => setTimeout(r, 20));
        ok('three chosen: unlocked, and a fourth + is blocked', !okBtn().disabled && [...document.querySelectorAll('#ddBody button')].filter(b => b.textContent.trim() === '+').every(b => b.disabled));
        __ddOk(); const got = await pr;
        ok('returns exactly 3 cards from the hand', got.length === 3 && got.every(o => A.hand.includes(o)), got.map(o => o.card.name));
        const pr2 = pickDiscardMany(A, 2); await new Promise(r => setTimeout(r, 50)); __ddAuto(); await new Promise(r => setTimeout(r, 20)); __ddOk(); const g2 = await pr2;
        ok('Pick for me takes the most expensive', g2.length === 2 && g2[0].card.name === 'Hill Giant', g2.map(o => o.card.name));
        // through the end-of-turn path
        A.hand.length = 0; for (let i = 0; i < 12; i++) A.hand.push(makeObj(C['Forest'], 0));
        G.active = 0; G.over = false; let asked = 0; window.__pickBase = async () => { asked++; return null; };
        const et = endTurn(A); await new Promise(r => setTimeout(r, 200));
        const open = !!document.getElementById('ddBody');
        if (open) { __ddAuto(); await new Promise(r => setTimeout(r, 20)); __ddOk(); }
        await Promise.race([et, new Promise(r => setTimeout(r, 1500))]);
        ok('end of turn asks once with one panel, no per-card prompts', open && asked === 0 && A.hand.length === 7, [open, asked, A.hand.length]);
        return out;
    });
    const results = formatChecks(raw); const good = printResults('discardmany', results, errors); writeOut('discardmany', { results, errors }); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error('ERR', String(e).slice(0, 500)); process.exit(2); });
