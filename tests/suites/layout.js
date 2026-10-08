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
    const good = printResults('layout', results, errors);
    writeOut('layout', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
