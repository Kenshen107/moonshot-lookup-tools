// Add money in Campaign and Shop Simulator (2026-11-28, owner's request; addMoneyPanel / addMoneyNow in spellslinger/01-core.js).
// Checks: the header button shows in Campaign and Shop but not Sandbox, the panel adds coins, shop cash and Aether, coins added in
// Campaign show in Shop (one shared bucket) and not in Sandbox, bad amounts do nothing, no sideways scroll at 360px.
'use strict';
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const btn = () => [...document.querySelectorAll('.topbar .btn, header .btn')].find(b => /Add money/.test(b.textContent));
            const shown = () => { const b = btn(); return !!b && getComputedStyle(b).display !== 'none'; };
            setMode('campaign'); applyModeUI(true);
            ok('Campaign: the header has ＋ Add money', shown());
            const c0 = profile.coins, u0 = profile.usd, a0 = ascentState().aether;
            addMoneyPanel();
            ok('the panel opens with coins, shop cash and Aether', document.querySelectorAll('#modalHost .add-money .am-row').length === 3);
            addMoneyNow('coins', 10000);
            ok('+10,000 coins', profile.coins === c0 + 10000, [c0, profile.coins]);
            addMoneyNow('usd', '1,234.5');
            ok('+$1,234.50 shop cash (commas and decimals read)', Math.abs(profile.usd - (u0 + 1234.5)) < 0.001, profile.usd);
            addMoneyNow('aether', 500);
            ok('+500 Aether', ascentState().aether === a0 + 500);
            addMoneyNow('coins', 'abc'); addMoneyNow('coins', -5);
            ok('a bad amount adds nothing', profile.coins === c0 + 10000);
            ok('the panel shows the new total', /You have [\d,]*10,/.test(document.querySelector('#modalHost .add-money').textContent));
            closeModal();
            setMode('shop'); applyModeUI(true);
            ok('Shop: the button is there too', shown());
            ok('coins and cash added in Campaign show in Shop (shared bucket)', profile.coins === c0 + 10000 && Math.abs(profile.usd - (u0 + 1234.5)) < 0.001);
            setMode('sandbox'); applyModeUI(true);
            ok('Sandbox: no Add money button (it keeps its own Add coins)', !shown());
            ok('in Sandbox the added coins stay parked in the Campaign/Shop bucket', profile.stash && profile.stash.main && profile.stash.main.coins === c0 + 10000, profile.stash && profile.stash.main);
            setMode('campaign'); applyModeUI(true);
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r);
    await page.setViewportSize({ width: 360, height: 760 });
    const r2 = await page.evaluate(async () => { addMoneyPanel(); await new Promise(x => setTimeout(x, 200)); const w = document.documentElement.scrollWidth; closeModal(); return [['360px: no sideways scroll', w <= innerWidth + 1, w]]; });
    results.push(...formatChecks(r2));
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('addmoney', results); writeOut('addmoney', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
