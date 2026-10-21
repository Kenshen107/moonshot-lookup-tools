// Which unread sentences keep the most cards of the chosen themes from being Automated? (2026-10-20)
//   node tests/theme_sweep.js group-hug politics donate goad monarch infect toxic proliferate
// Reads tests/.out/theme_names.json (python3 tests/theme_names.py). Lists unread lines by how many theme cards each one blocks.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');
(async () => {
    const want = process.argv.slice(2);
    const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', '.out', 'theme_names.json'), 'utf8'));
    const names = [...new Set(want.flatMap(k => all[k] || []))];
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const rows = await page.evaluate(async names => {
        const raw = await (await fetch('/__cards.json')).json();
        const by = new Map(); raw.forEach(c => { if (c.type_line && !by.has(c.name)) by.set(c.name, c); });
        const out = [];
        names.forEach((n, i) => { const c = by.get(n); if (!c) return; const r = rulesFor(slimCard(c)); if (r.support !== 'full') out.push({ n, i, u: (r.unhandled || []).slice(0, 12) }); });
        return out;
    }, names);
    await h.close();
    const blur = l => l.replace(/\{[^}]+\}/g, '{M}').replace(/\b\d+\b/g, 'N').replace(/\s+/g, ' ').trim();
    const map = new Map();
    rows.forEach(r => { const shapes = [...new Set(r.u.map(blur))]; shapes.forEach(s => { if (!map.has(s)) map.set(s, { s, cards: 0, alone: 0, ex: [] }); const e = map.get(s); e.cards++; if (shapes.length === 1) e.alone++; if (e.ex.length < 4) e.ex.push(r.n); }); });
    [...map.values()].sort((a, b) => b.alone - a.alone || b.cards - a.cards).slice(0, 45).forEach(e => console.log(`${String(e.alone).padStart(3)} alone / ${String(e.cards).padStart(3)}  ${e.s.slice(0, 150)}  [${e.ex.join('; ')}]`));
})();
