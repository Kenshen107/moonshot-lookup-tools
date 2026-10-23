// How many cards that can lead a Commander deck read as Automated / Partly / Not yet.
//   node tests/commander_coverage.js [--list]     (--list prints the names that still need work, most-played first)
'use strict';
const { launch, openTestPage, installHelpers } = require('./lib/harness');
const BODY = async function () {
    const cards = await (await fetch('/tests/data/cards_all.json')).json();
    const out = [];
    for (const c of cards) {
        const tl = c.type_line || '', tx = c.oracle_text || '';
        const can = (/Legendary/.test(tl) && /Creature/.test(tl)) || /can be your commander/i.test(tx);
        if (!can || (c.legalities && c.legalities.commander === 'banned')) continue;
        const r = rulesFor(slimCard(c));
        out.push([c.name, r.support === 'full' ? 'f' : r.support === 'partial' ? 'p' : 'n', c.edhrec_rank || 999999, (c.color_identity || []).length]);
    }
    return out;
};
(async () => {
    const h = await launch();
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const d = await page.evaluate(`(${BODY.toString()})()`);
    const n = ch => d.filter(x => x[1] === ch).length, top = d.filter(x => x[2] <= 1500);
    console.log(`Commanders: ${d.length}; Automated ${n('f')}, Partly ${n('p')}, Not yet ${n('n')}`);
    console.log(`Most-played 1,500 of them (EDHREC rank): ${top.length}; Automated ${top.filter(x => x[1] === 'f').length}, Partly ${top.filter(x => x[1] === 'p').length}, Not yet ${top.filter(x => x[1] === 'n').length}`);
    if (process.argv.includes('--list')) console.log(d.filter(x => x[1] !== 'f').sort((a, b) => a[2] - b[2]).slice(0, 60).map(x => `${x[2]} ${x[0]} (${x[1]})`).join('\n'));
    await h.close ? h.close() : (h.browser && h.browser.close());
    process.exit(0);
})();
