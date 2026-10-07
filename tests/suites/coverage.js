// Coverage: how many paper cards read as Automated / Partly / Not yet, over every card in tests/data/cards_all.json
// (made by tests/fetch_cards.py), and over the 1,000 most-played Commander cards (lowest EDHREC rank).
//
//   node tests/suites/coverage.js             compare with the saved baseline: no card that was fully Automated may stop being so
//   node tests/suites/coverage.js --update    rewrite tests/baseline.json and tests/baseline_full_cards.txt with today's numbers
//
// CARD_COVERAGE in the game file is the number shown on Home; after a rules round, copy the printed numbers into it.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, printResults, writeOut, ROOT } = require('../lib/harness');

const BASE_FILE = path.join(__dirname, '..', 'baseline.json');
const FULL_FILE = path.join(__dirname, '..', 'baseline_full_cards.txt');

const BODY = async function () {
    const res = await fetch('/tests/data/cards_all.json');
    if (!res.ok) throw new Error('tests/data/cards_all.json is missing - run: python3 tests/fetch_cards.py');
    const cards = await res.json();
    const names = [], sup = [], rank = [];
    for (const c of cards) {
        const r = rulesFor(slimCard(c));
        names.push(c.name);
        sup.push(r.support === 'full' ? 'f' : r.support === 'partial' ? 'p' : 'n');
        rank.push(c.edhrec_rank || 0);
    }
    return { names, sup: sup.join(''), rank };
};

async function main() {
    const update = process.argv.includes('--update');
    if (!fs.existsSync(path.join(ROOT, 'tests', 'data', 'cards_all.json'))) { console.error('tests/data/cards_all.json is missing. Run: python3 tests/fetch_cards.py'); process.exit(2); }
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const t0 = Date.now();
    const d = await page.evaluate(`(${BODY.toString()})()`);
    const n = d.names.length;
    const count = (idx, ch) => idx.filter(i => d.sup[i] === ch).length;
    const all = [...Array(n).keys()];
    const top = all.filter(i => d.rank[i] > 0).sort((a, b) => d.rank[a] - d.rank[b]).slice(0, 1000);
    const now = { total: n, full: count(all, 'f'), partial: count(all, 'p'), none: count(all, 'n'), top1000: { full: count(top, 'f'), partial: count(top, 'p'), none: count(top, 'n') } };
    const fullNames = all.filter(i => d.sup[i] === 'f').map(i => d.names[i]).sort();
    console.log(`measured ${n} paper cards in ${((Date.now() - t0) / 1000).toFixed(0)}s:`);
    console.log(`  all cards: ${now.full} Automated, ${now.partial} Partly, ${now.none} Not yet (${(100 * now.full / n).toFixed(1)}% Automated, ${(100 * (now.full + now.partial) / n).toFixed(1)}% playable)`);
    console.log(`  top 1,000: ${now.top1000.full} Automated, ${now.top1000.partial} Partly, ${now.top1000.none} Not yet`);
    const base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'));
    if (update) {
        base.coverage = { measured: new Date().toISOString().slice(0, 10), ...now };
        fs.writeFileSync(BASE_FILE, JSON.stringify(base, null, 2) + '\n');
        fs.writeFileSync(FULL_FILE, fullNames.join('\n') + '\n');
        console.log('baseline updated.');
        await h.close();
        return;
    }
    const results = [];
    if (!base.coverage || !fs.existsSync(FULL_FILE)) {
        results.push({ label: 'a coverage baseline exists (run with --update to make one)', ok: false });
    } else {
        const was = new Set(fs.readFileSync(FULL_FILE, 'utf8').split('\n').filter(Boolean));
        const nowFull = new Set(fullNames);
        const present = new Set(d.names);
        const lost = [...was].filter(x => present.has(x) && !nowFull.has(x));
        const gained = [...nowFull].filter(x => !was.has(x));
        results.push({ label: `no card that was fully Automated stopped being so (${was.size} cards in the baseline)`, ok: lost.length === 0, detail: lost.length ? JSON.stringify(lost.slice(0, 25)) + (lost.length > 25 ? ` ...and ${lost.length - 25} more` : '') : undefined });
        results.push({ label: `Automated count did not go down (${base.coverage.full} -> ${now.full})`, ok: now.full >= base.coverage.full - (base.coverage.total > n ? base.coverage.total - n : 0) });
        if (gained.length) console.log(`  ${gained.length} cards are newly Automated; run --update to save the new baseline`);
    }
    const good = printResults('coverage', results, errors);
    writeOut('coverage', { now });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
