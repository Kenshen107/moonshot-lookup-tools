// Table layout (Phase 3): a crowded hand and board at phone, tablet and desktop widths.
// Checks: no sideways page scroll, every hand card inside the hand dock, the hand never covers the turn bar,
// creature and land rows stay inside the table. Screenshots go to tests/.out/layout-<width>-<hand>.png.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const SIZES = [[360, 740], [768, 1024], [1280, 800]];
const HANDS = [7, 12, 20];

const SETUP = async function (handN) {
    const C = await T.cards(['Mountain', 'Grizzly Bears', 'Hill Giant', 'Lightning Bolt', 'Bonesplitter']);
    const [P0, P1] = await T.newGame();
    T.clear();
    for (const P of [P0, P1]) {
        for (let i = 0; i < 15; i++) T.put(P, C['Mountain']);
        for (let i = 0; i < 20; i++) T.put(P, C[i % 2 ? 'Grizzly Bears' : 'Hill Giant']);
    }
    const bears = P0.bf.filter(o => o.card.name === 'Grizzly Bears');
    const eq = T.put(P0, C['Bonesplitter']); eq.attachedTo = bears[0].uid;
    for (let i = 0; i < handN; i++) P0.hand.push(makeObj(C[['Lightning Bolt', 'Hill Giant', 'Mountain'][i % 3]], 0));
    G.active = 0; G.phase = 'main1';
    $('game').classList.remove('hidden');
    renderGame(); fitTable();
};
const MEASURE = function () {
    const r = el => el.getBoundingClientRect();
    const dock = r(document.querySelector('.dock')), hand = r($('hand')), mid = r($('midBar'));
    const cards = [...document.querySelectorAll('#hand .hc')].map(r);
    const out = { scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth, vw: innerWidth };
    out.handOut = cards.filter(c => c.right > hand.right + 1 || c.left < hand.left - 1).length;
    out.coversBar = cards.filter(c => c.top < mid.bottom && c.bottom > mid.top && c.right > mid.left && c.left < mid.right).length;
    out.n = cards.length;
    const rows = ['meSide', 'oppSide'].flatMap(id => [...$(id).querySelectorAll('.lane')]);
    out.laneOut = rows.filter(l => { const a = r(l); return a.right > innerWidth + 1 || a.left < -1; }).length;
    out.laneKids = rows.map(l => [...l.children].filter(c => { const a = r(c); return a.right > innerWidth + 1 || a.left < -1; }).length).reduce((a, b) => a + b, 0);
    return out;
};

async function main() {
    const results = [];
    const shots = path.join(ROOT, 'tests', '.out');
    fs.mkdirSync(shots, { recursive: true });
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    for (const [w, ht] of SIZES) {
        await page.setViewportSize({ width: w, height: ht });
        for (const n of HANDS) {
            await page.evaluate(`(${SETUP.toString()})(${n})`);
            await page.waitForTimeout(250);
            const m = await page.evaluate(`(${MEASURE.toString()})()`);
            await page.screenshot({ path: path.join(shots, `layout-${w}-${n}.png`) });
            const tag = `${w}px wide, ${n} cards in hand`;
            results.push({ label: `${tag}: no sideways page scroll`, ok: m.scrollX <= 0, detail: JSON.stringify(m) });
            if (w > 600) results.push({ label: `${tag}: every hand card inside the hand dock`, ok: m.handOut === 0, detail: JSON.stringify({ out: m.handOut }) });
            results.push({ label: `${tag}: the hand does not cover the turn bar`, ok: m.coversBar === 0, detail: JSON.stringify({ covers: m.coversBar }) });
            results.push({ label: `${tag}: rows and their cards stay on screen`, ok: m.laneOut === 0 && m.laneKids === 0, detail: JSON.stringify({ lanes: m.laneOut, cards: m.laneKids }) });
        }
    }
    // Many identical tokens and a commander on a phone (2026-11-09, owner's screenshot: 16 Soldier tokens pushed the commander off the screen)
    await page.setViewportSize({ width: 412, height: 915 });
    const crowd = await page.evaluate(async () => {
        const C = await T.cards(['Plains', 'Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Savannah Lions']);
        const [A, B] = await T.newGame(); T.clear();
        for (let i = 0; i < 6; i++) T.put(A, C['Plains']);
        for (const n of ['Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Savannah Lions']) T.put(A, C[n]);
        const cmd = T.put(A, C['Hill Giant']); cmd.isCommander = true; cmd.counters = 3;
        for (let i = 0; i < 20; i++) await applyEffect(A, { t: 'token', n: 1, p: 1, q: 1, name: 'white Soldier', kw: [] }, null, cmd);
        G.active = 0; G.phase = 'main1'; $('game').classList.remove('hidden'); renderGame(); fitTable();
        await new Promise(r => setTimeout(r, 250));
        const kids = [...document.querySelectorAll('#meSide .lane.creatures > *')];
        const rect = k => k.getBoundingClientRect();
        const soldiers = kids.filter(k => /Soldier/.test(k.textContent));
        return { n: kids.length, soldierPiles: soldiers.length, first: kids[0] && /👑/.test(kids[0].textContent), out: kids.filter(k => rect(k).right > innerWidth + 1 || rect(k).left < -1).length, scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    results.push({ label: '412px wide, 20 identical tokens: they share one pile', ok: crowd.soldierPiles === 1, detail: JSON.stringify(crowd) });
    results.push({ label: '...the commander leads the row and every creature stays on screen', ok: crowd.first === true && crowd.out === 0 && crowd.scrollX <= 0, detail: JSON.stringify(crowd) });
    // Compact tiles (2026-11-10): a row too full for readable cards shows every creature as a tile that can be read and tapped
    for (const [w, ht] of [[360, 740], [412, 915], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: ht });
        const t = await page.evaluate(async () => {
            const names = ['Grizzly Bears', 'Hill Giant', 'Serra Angel', 'Llanowar Elves', 'Savannah Lions'];
            const C = await T.cards(['Plains', ...names]);
            const [A] = await T.newGame(); T.clear();
            for (let i = 0; i < 6; i++) T.put(A, C['Plains']);
            for (let i = 0; i < 26; i++) { const o = T.put(A, C[names[i % names.length]]); o.counters = i; } // 26 creatures that can't share a pile
            G.active = 0; G.phase = 'main1'; $('game').classList.remove('hidden'); renderGame(); fitTable();
            await new Promise(r => setTimeout(r, 250));
            const lane = document.querySelector('#meSide .lane.creatures'), kids = [...lane.children];
            const rect = k => k.getBoundingClientRect();
            const laneR = rect(lane);
            lane.scrollTop = lane.scrollHeight; const last = rect(kids[kids.length - 1]);
            const out = { compact: lane.classList.contains('compact'), n: kids.length, minW: Math.round(Math.min(...kids.map(k => rect(k).width))), minH: Math.round(Math.min(...kids.map(k => rect(k).height))),
                offX: kids.filter(k => rect(k).right > innerWidth + 1 || rect(k).left < -1).length, names: kids.filter(k => { const p = k.querySelector('.pname'); return p && getComputedStyle(p).display !== 'none' && p.textContent.trim(); }).length,
                lastReachable: last.bottom <= laneR.bottom + 2 && last.top >= laneR.top - 2, scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
            kids[kids.length - 1].querySelector('.perm, button.perm') ? kids[kids.length - 1].click() : kids[kids.length - 1].click();
            await new Promise(r => setTimeout(r, 150));
            out.sheet = !!document.querySelector('.sheet:not(.hidden), .modal:not(.hidden)');
            if (typeof closeSheet === 'function') closeSheet();
            return out;
        });
        const tag = `${w}px wide, 26 different creatures`;
        results.push({ label: `${tag}: the row becomes compact tiles`, ok: t.compact && t.n === 26, detail: JSON.stringify(t) });
        results.push({ label: `${tag}: every tile is on screen sideways, shows its name and is big enough to tap`, ok: t.offX === 0 && t.names === 26 && t.minW >= 88 && t.minH >= 44 && t.scrollX <= 0, detail: JSON.stringify(t) });
        results.push({ label: `${tag}: the last creature can be scrolled to and tapped`, ok: t.lastReachable && t.sheet, detail: JSON.stringify(t) });
    }
    const good = printResults('layout', results, errors);
    writeOut('layout', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
