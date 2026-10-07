// Redraws (Phase 1c): the game table and the shop floor only touch the page when something changed.
//   - an unchanged redraw keeps the very same page elements (hover, scroll and typing survive) and skips the fitting
//   - a change rebuilds just the zone that changed
//   - resizing the window still refits the table
//   - a half-typed price or counteroffer in the shop is kept
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    const C = await T.cards(['Mountain', 'Grizzly Bears', 'Hill Giant', 'Lightning Bolt']);
    const [P0, P1] = await T.newGame();
    T.clear();
    for (const P of [P0, P1]) { for (let i = 0; i < 4; i++) T.put(P, C['Mountain']); T.put(P, C['Grizzly Bears']); P.hand.push(makeObj(C['Lightning Bolt'], P.i), makeObj(C['Hill Giant'], P.i)); }
    $('game').classList.remove('hidden');
    renderGame();
    const first = id => $(id).firstElementChild;

    // ---- the game table ----
    let fits = 0; const realFit = fitTable; fitTable = function () { fits++; return realFit.apply(this, arguments); };
    const mine = [first('meSide'), first('oppSide'), first('hand'), first('midBar')];
    renderGame();
    ok('an unchanged redraw keeps every zone\'s elements', mine.every((el, i) => el === [first('meSide'), first('oppSide'), first('hand'), first('midBar')][i]));
    ok('an unchanged redraw does no fitting', fits === 0, fits);
    const oppSideEl = first('oppSide'), handEl = first('hand');
    P0.hand.push(makeObj(C['Lightning Bolt'], 0));
    renderGame();
    ok('a new card in hand rebuilds only the hand', first('hand') !== handEl && first('oppSide') === oppSideEl);
    ok('and the table is fitted again', fits === 1, fits);
    ok('the hand label follows', $('handCount').textContent === `Hand · ${P0.hand.length}`);
    const bear = P1.bf.find(o => o.card.name === 'Grizzly Bears'); bear.counters = 2;
    renderGame();
    ok('a counter on an opposing creature rebuilds the opponent\'s side', first('oppSide') !== oppSideEl);
    const before = fits;
    window.dispatchEvent(new Event('resize'));
    ok('resizing the window refits the table', fits === before + 1, fits - before);
    // a new game shows the new game's board
    const [Q0] = await T.newGame(); T.clear(); T.put(Q0, C['Hill Giant']); Q0.hand.push(makeObj(C['Mountain'], 0));
    $('game').classList.remove('hidden'); renderGame();
    ok('a new game redraws its own board', $('meSide').innerHTML.includes('Hill Giant') && $('hand').innerHTML.includes('Mountain') && !$('hand').innerHTML.includes('Lightning Bolt'));
    fitTable = realFit;

    // ---- the shop ----
    $('game').classList.add('hidden');
    showView('shop'); ensureShopDay();
    const ids = [C['Lightning Bolt'].id, C['Hill Giant'].id];
    profile.displayCase = ids.map((id, i) => ({ id, condition: 'M', foil: 0, serial: 0, askingPrice: 2 + i }));
    renderShop();
    const caseEl = first('shopCase'), vaultEl = first('shopVault');
    const inp = document.querySelector('#shopCase .ask-in'); inp.value = '9.99'; inp.focus();
    renderShopFloor();
    ok('an unchanged shop floor keeps its elements', first('shopCase') === caseEl && first('shopVault') === vaultEl);
    ok('a half-typed asking price is kept', document.querySelector('#shopCase .ask-in').value === '9.99' && document.activeElement === document.querySelector('#shopCase .ask-in'));
    const clockBefore = $('shopHead').innerHTML;
    profile.shopToday.timeLeft -= 3000;
    renderShopFloor();
    ok('the clock updates', $('shopHead').innerHTML !== clockBefore);
    profile.displayCase[0].askingPrice = 7.5;
    renderShopFloor();
    ok('a changed price rebuilds the case', first('shopCase') !== caseEl && document.querySelector('#shopCase .ask-in').value === '7.50');
    shopLog('test line'); renderShopFloor();
    ok('the log shows a new line', $('shopLog').innerHTML.includes('test line'));
    return out;
};

async function main() {
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('redraw', results, errors);
    writeOut('redraw', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
