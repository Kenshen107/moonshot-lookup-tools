// Which cards does the game read, and which lines does it not understand?
//   node tests/card_status.js "Chalice of the Void" "Goblin Guide"
//   node tests/card_status.js --deck deck.txt          (a pasted decklist file: lists every card that is not fully Automated)
// Compare with an older checkout:  GAME_ROOT=/path/to/worktree node tests/card_status.js "Card name"
'use strict';
const fs = require('fs');
const { launch, openTestPage, installHelpers } = require('./lib/harness');
(async () => {
    const args = process.argv.slice(2);
    let text;
    const di = args.indexOf('--deck');
    if (di >= 0) text = fs.readFileSync(args[di + 1], 'utf8');
    else text = args.map(n => '1 ' + n).join('\n');
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const rows = await page.evaluate(async t => {
        const parsed = parseDeckText(t);
        const all = [...parsed.commander, ...parsed.main];
        const res = await resolveDeckCards(all);
        return res.map((r, i) => r.card ? { name: r.card.name, support: rulesFor(r.card).support, unhandled: rulesFor(r.card).unhandled || [], why: rulesFor(r.card).why || '' } : { name: all[i].name, support: 'NOT FOUND', unhandled: [] });
    }, text);
    const show = di >= 0 ? rows.filter(r => r.support !== 'full') : rows;
    show.forEach(r => console.log(`${r.support.padEnd(8)} ${r.name}${r.unhandled.length ? '\n           not read: ' + r.unhandled.join('\n                     ') : ''}`));
    if (di >= 0) console.log(`${rows.length - show.length} of ${rows.length} cards are fully Automated`);
    if (errors.length) console.log('PAGE ERRORS', errors);
    await h.close();
})();
