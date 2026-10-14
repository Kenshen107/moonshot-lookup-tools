// Frequency sweep: which unread sentence shapes keep the most cards from being fully Automated?
//   node tests/sweep.js [N]        prints the top N shapes (default 80) and saves tests/.out/sweep.json
// A "shape" is an unread line with numbers, mana costs and card-specific names blurred. "alone" counts cards where
// that shape is the ONLY unread line, i.e. building it makes the card Automated by itself.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');
const BODY = async function () {
    const cards = await (await fetch('/tests/data/cards_all.json')).json();
    const rows = [];
    for (const c of cards) {
        const r = rulesFor(slimCard(c));
        if (r.support === 'full') continue;
        rows.push({ n: c.name, rk: c.edhrec_rank || 0, s: r.support, u: (r.unhandled || []).slice(0, 12), t: c.type_line || '' });
    }
    return rows;
};
(async () => {
    const top = Number(process.argv[2]) || 80;
    const h = await launch();
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const rows = await page.evaluate(`(${BODY.toString()})()`);
    await h.close();
    const blur = l => l.replace(/\{[^}]+\}/g, '{M}').replace(/\b\d+\b/g, 'N').replace(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|X)\b(?= (?:\+1|-1|card|creature|damage|life|counter|token|land))/gi, 'N')
        .replace(/\b(white|blue|black|red|green)\b/gi, 'COLOR').replace(/\s+/g, ' ').trim();
    const map = new Map();
    for (const r of rows) {
        const shapes = [...new Set(r.u.map(blur))];
        for (const sh of shapes) {
            if (!map.has(sh)) map.set(sh, { shape: sh, cards: 0, alone: 0, aloneRanked: 0, ex: [] });
            const e = map.get(sh);
            e.cards++;
            if (shapes.length === 1) { e.alone++; if (r.rk && r.rk < 5000) e.aloneRanked++; }
            if (e.ex.length < 3) e.ex.push(r.n);
        }
    }
    const list = [...map.values()].sort((a, b) => b.alone - a.alone || b.cards - a.cards);
    fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tests', '.out', 'sweep.json'), JSON.stringify({ rows, list: list.slice(0, 2000) }));
    console.log(`${rows.length} cards not fully Automated, ${list.length} distinct unread shapes`);
    list.slice(0, top).forEach((e, i) => console.log(`${String(i + 1).padStart(3)}. alone ${String(e.alone).padStart(4)} (top5k ${String(e.aloneRanked).padStart(3)}) all ${String(e.cards).padStart(4)}  ${e.shape.slice(0, 110)}  [${e.ex.join('; ')}]`));
})();
