// Shadow audit for Phase 2c: for every sentence on every paper card, compare what the old EFFECTS regexes make of it
// with what the token reader (02b-token-reader.js) makes of it. Not a pass/fail test: it prints how many sentences both
// read the same, differently, and which old regexes are fully covered by the token reader.
//   node tests/reader_audit.js
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');
const BODY = async function () {
    const cards = await (await fetch('/tests/data/cards_all.json')).json();
    const seen = new Map();
    for (const c of cards) {
        const text = (c.oracle_text || (c.card_faces || []).map(f => f.oracle_text).join('\n') || '').replace(/\([^)]*\)/g, '');
        const nm = c.name.split(' // ')[0];
        for (const line of text.split('\n')) for (let s of line.split(/\.\s+/)) {
            s = s.trim().replace(/\.$/, '').replace(new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~').replace(/^you may /i, '');
            if (s.length > 6 && s.length < 120 && !seen.has(s)) seen.set(s, c.name);
        }
    }
    const key = h => h ? JSON.stringify([h.t, h.target, h.n, h.p, h.q, (h.kw || []).join(',')]) : null;
    const stat = { sentences: seen.size, bothRead: 0, same: 0, differ: 0, onlyNew: 0, onlyOld: 0 };
    const differ = [], byRegex = new Map();
    for (const [s, card] of seen) {
        let oldHit = null, idx = -1;
        for (let i = 0; i < EFFECTS.length; i++) { const m = s.match(EFFECTS[i][0]) || s.toLowerCase().match(EFFECTS[i][0]); if (m) { const h = EFFECTS[i][1](m); if (h) { oldHit = h; idx = i; break; } } }
        const nu = tokenReadSentence(s);
        if (oldHit && nu) {
            stat.bothRead++;
            const o = Array.isArray(oldHit) ? null : oldHit;
            // "same" = same effect and same numbers; the filter is compared by asking which of a test set of permanents match is too heavy, so the effect shape decides
            const eq = o && o.t === nu.t && (o.n === nu.n) && o.p === nu.p && o.q === nu.q;
            const r = byRegex.get(idx) || { src: String(EFFECTS[idx][0]).slice(0, 110), same: 0, differ: 0 };
            if (eq) { stat.same++; r.same++; } else { stat.differ++; r.differ++; if (differ.length < 15) differ.push([s, card, JSON.stringify(oldHit).slice(0, 120), JSON.stringify(nu).slice(0, 120)]); }
            byRegex.set(idx, r);
        } else if (nu) stat.onlyNew++;
        else if (oldHit) stat.onlyOld++;
    }
    return { stat, differ, covered: [...byRegex.values()].filter(r => r.differ === 0).length, total: [...byRegex.values()].length, sample: [...byRegex.values()].filter(r => r.differ === 0).slice(0, 12) };
};
(async () => {
    const h = await launch();
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(`(${BODY.toString()})()`);
    console.log(JSON.stringify(r.stat));
    console.log(`old regexes whose every shared sentence the token reader reads the same way: ${r.covered} of ${r.total} that overlap`);
    r.sample.forEach(x => console.log('  covered:', x.src, x.same));
    r.differ.forEach(d => console.log('  differs:', d.join(' | ')));
    await h.close();
})().catch(e => { console.error(e); process.exit(2); });
