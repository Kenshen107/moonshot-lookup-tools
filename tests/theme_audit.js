// Theme audit (2026-10-20): for each deck theme's Scryfall query, how many of the tagged cards does the game read as fully Automated?
// Usage: python3 tests/theme_names.py   (fetches Scryfall's EDHREC-ordered names per theme query into tests/.out/theme_names.json)
//        node tests/theme_audit.js      (prints the table; writes tests/.out/theme_audit.json)
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');

(async () => {
    const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', '.out', 'theme_names.json'), 'utf8'));
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const res = await page.evaluate(async names => {
        const raw = await (await fetch('/__cards.json')).json();
        const by = new Map();
        raw.forEach(c => { if (c.type_line && !by.has(c.name)) by.set(c.name, c); });
        const out = {};
        for (const [k, list] of Object.entries(names)) {
            const auto = [], blocked = [];
            for (const n of list) {
                const c = by.get(n);
                if (!c) continue;
                const sc = slimCard(c);
                const r = rulesFor(sc);
                if (r.support === 'full' && !isBasic(sc) && r.kind !== 'land') auto.push(n); else blocked.push(n);
            }
            out[k] = { total: list.length, auto: auto.length, autoNames: auto, blocked: blocked.slice(0, 12) };
        }
        return out;
    }, names);
    fs.writeFileSync(path.join(ROOT, 'tests', '.out', 'theme_audit.json'), JSON.stringify(res, null, 1));
    console.log('theme'.padEnd(20), 'tagged'.padStart(7), 'Automated'.padStart(10), '  top Automated');
    Object.entries(res).forEach(([k, v]) => console.log(k.padEnd(20), String(v.total).padStart(7), String(v.auto).padStart(10), '  ' + v.autoNames.slice(0, 6).join(', ')));
    await h.close();
})();
