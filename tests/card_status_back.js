// Like card_status.js, but also reads the back face (prepared spell, adventure, MDFC) of each named card.
'use strict';
const { launch, openTestPage, installHelpers } = require('./lib/harness');
(async () => {
    const names = process.argv.slice(2);
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const rows = await page.evaluate(async t => {
        const parsed = parseDeckText(t);
        const res = await resolveDeckCards([...parsed.commander, ...parsed.main]);
        return res.filter(r => r.card && r.card.back).map(r => { const b = r.card.back, R = rulesFor(b); return { name: b.name, support: R.support, unhandled: R.unhandled || [] }; });
    }, names.map(n => '1 ' + n).join('\n'));
    rows.forEach(r => console.log(`${r.support.padEnd(8)} ${r.name}${r.unhandled.length ? '\n           not read: ' + r.unhandled.join('\n                     ') : ''}`));
    if (errors.length) console.log('PAGE ERRORS', errors);
    await h.close();
})();
