// Rules snapshot: for every paper card, a fingerprint of everything the card reader (`rulesFor`) makes of it:
// the support level, the effects, triggers, costs, keywords, statics and so on.
// Any change in how any card is read, even one that keeps it "fully Automated", shows up here, so code can be
// moved around (Phase 2 of docs/spellslinger-overhaul-plan.md) with proof that no card changed.
//
//   node tests/suites/rules-snapshot.js             compare with tests/baseline_rules.tsv.gz; lists the cards that changed
//   node tests/suites/rules-snapshot.js --update    save today's fingerprints as the new baseline (do this when a rules
//                                                   change is meant to change how some cards are read, and say which)
// Needs tests/data/cards_all.json (python3 tests/fetch_cards.py). Names are unique, so each line is "name<TAB>fingerprint".
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { launch, openTestPage, installHelpers, printResults, writeOut, ROOT } = require('../lib/harness');

const FILE = path.join(__dirname, '..', 'baseline_rules.tsv.gz');

const BODY = async function () {
    const res = await fetch('/tests/data/cards_all.json');
    if (!res.ok) throw new Error('tests/data/cards_all.json is missing - run: python3 tests/fetch_cards.py');
    const cards = await res.json();
    // A stable text for any value: sets sorted, functions by their source, regexes by their pattern, undefined dropped
    const seen = new WeakSet();
    const canon = v => {
        if (v === null || typeof v !== 'object') return typeof v === 'function' ? 'fn:' + v.toString() : typeof v === 'undefined' ? undefined : v;
        if (v instanceof RegExp) return 're:' + v.toString();
        if (v instanceof Set) return { __set: [...v].map(canon).sort() };
        if (v instanceof Map) return { __map: [...v].map(([k, x]) => [canon(k), canon(x)]).sort() };
        if (seen.has(v)) return '[circular]';
        seen.add(v);
        const out = Array.isArray(v) ? v.map(canon) : Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])]));
        seen.delete(v);
        return out;
    };
    const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
    const lines = [];
    for (const c of cards) {
        let fp;
        try { fp = fnv(JSON.stringify(canon(rulesFor(slimCard(c))))); } catch (e) { fp = 'ERROR:' + String(e).slice(0, 40); }
        lines.push(c.name + '\t' + fp);
    }
    return lines;
};

async function main() {
    const update = process.argv.includes('--update');
    if (!fs.existsSync(path.join(ROOT, 'tests', 'data', 'cards_all.json'))) { console.error('tests/data/cards_all.json is missing. Run: python3 tests/fetch_cards.py'); process.exit(2); }
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const t0 = Date.now();
    const lines = await page.evaluate(`(${BODY.toString()})()`);
    console.log(`fingerprinted ${lines.length} cards in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const errs = lines.filter(l => l.includes('\tERROR:'));
    if (update) {
        fs.writeFileSync(FILE, zlib.gzipSync(lines.join('\n') + '\n', { level: 9 }));
        console.log(`baseline saved: ${path.relative(ROOT, FILE)} (${(fs.statSync(FILE).size / 1000).toFixed(0)} KB)`);
        await h.close();
        return;
    }
    const results = [];
    if (!fs.existsSync(FILE)) results.push({ label: 'a rules snapshot baseline exists (run with --update to make one)', ok: false });
    else {
        const was = new Map(zlib.gunzipSync(fs.readFileSync(FILE)).toString().split('\n').filter(Boolean).map(l => l.split('\t')));
        const now = new Map(lines.map(l => l.split('\t')));
        const changed = [...was].filter(([n, f]) => now.has(n) && now.get(n) !== f).map(([n]) => n);
        const gone = [...was.keys()].filter(n => !now.has(n));
        results.push({ label: `no card is read differently than in the baseline (${was.size} cards)`, ok: changed.length === 0, detail: changed.length ? `${changed.length} changed: ${JSON.stringify(changed.slice(0, 30))}` : undefined });
        results.push({ label: 'the card reader threw on no card', ok: errs.length === 0, detail: errs.length ? JSON.stringify(errs.slice(0, 5)) : undefined });
        const added = [...now.keys()].filter(n => !was.has(n));
        if (added.length) console.log(`  ${added.length} cards are new since the baseline (not compared)${gone.length ? `, ${gone.length} are gone` : ''}`);
    }
    const good = printResults('rules-snapshot', results, errors);
    writeOut('rules-snapshot', { count: lines.length });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
