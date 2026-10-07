// Redraw timing (not a pass/fail test): how long the game table and the shop floor take to redraw.
//   node tests/perf.js
// Builds a busy board (24 creatures, 14 lands, 12 cards in hand a side) and calls renderGame() 200 times with nothing
// changed, then 200 times changing one thing; and renderShopFloor() 200 times with a full case and 6 customers.
'use strict';
const { launch, openTestPage, installHelpers } = require('./lib/harness');
(async () => {
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const C = await T.cards(['Mountain', 'Grizzly Bears', 'Hill Giant', 'Lightning Bolt', 'Shivan Dragon']);
        const [P0, P1] = await T.newGame();
        T.clear();
        for (const P of [P0, P1]) {
            for (let i = 0; i < 14; i++) T.put(P, C['Mountain']);
            for (let i = 0; i < 24; i++) T.put(P, C[['Grizzly Bears', 'Hill Giant', 'Shivan Dragon'][i % 3]]);
            for (let i = 0; i < 12; i++) P.hand.push(makeObj(C['Lightning Bolt'], P.i));
        }
        // each call is followed by a forced layout, so the numbers include what the browser does after the DOM changes
        const time = (n, fn) => { const t = performance.now(); for (let i = 0; i < n; i++) { fn(i); document.body.offsetHeight; } return (performance.now() - t) / n; };
        $('game').classList.remove('hidden');
        renderGame();
        const out = {};
        out.gameUnchangedMs = +time(200, () => renderGame()).toFixed(2);
        const bear = P0.bf.find(o => o.card.name === 'Grizzly Bears');
        out.gameOneChangeMs = +time(200, i => { bear.counters = i % 2; renderGame(); }).toFixed(2);
        // the shop floor
        showView('shop');
        ensureShopDay();
        const ids = Object.keys(C).filter(n => n !== 'Mountain').map(n => C[n].id);
        profile.displayCase = Array.from({ length: 40 }, (_, i) => ({ id: ids[i % ids.length], condition: 'M', foil: false, serial: false, askingPrice: 1 + i }));
        profile.bulkBox = ids.slice(0, 3);
        renderShop();
        out.shopFloorMs = +time(200, () => renderShopFloor()).toFixed(2);
        return out;
    });
    console.log(JSON.stringify(r), errors.length ? 'PAGE ERRORS ' + errors.slice(0, 2) : '');
    await h.close();
})();
