// Precon readiness: how many of the game's 553 precons are made only of fully Automated cards, and which cards to fix first.
//   python3 tests/precon_audit.py     (once: downloads the decks into tests/.cache/precon_names.json)
//   node tests/precon_audit.js        prints readiness and the cards that unlock the most decks; writes tests/.out/precon_cards.json
//   node tests/precon_audit.js --write   also saves spellslinger/data/precon-ready.json (which decks are fully Automated), which the Precon Library reads
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');
const decks = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', '.cache', 'precon_names.json'), 'utf8'));
const BODY = async function (decks) {
    const cards = await (await fetch('/tests/data/cards_all.json')).json();
    const info = new Map(); const BAS = /^(Snow-Covered )?(Plains|Island|Swamp|Mountain|Forest)$|^Wastes$/;
    for (const c of cards) { const r = rulesFor(slimCard(c)); const v = { support: r.support, unhandled: r.unhandled || [], why: r.why || '', text: (c.oracle_text || (c.card_faces || []).map(f => f.oracle_text).join(' // ') || '').slice(0, 300), type: c.type_line }; info.set(c.name, v); const f = c.name.split(' // ')[0]; if (!info.has(f)) info.set(f, v); }
    const perCard = new Map(); const per = [];
    for (const [type, name, code, date, file, list] of decks) {
        const bad = new Set();
        for (const n of list) { if (BAS.test(n)) continue; const v = info.get(n) || info.get(n.split(' // ')[0]); if (!v || v.support !== 'full') bad.add(n); }
        per.push({ type, name, code, date, file, bad: [...bad] });
        for (const n of new Set(list)) { if (BAS.test(n)) continue; const v = info.get(n) || info.get(n.split(' // ')[0]); if (!v) continue; const e = perCard.get(n) || { name: n, support: v.support, unhandled: v.unhandled, why: v.why, text: v.text, type: v.type, decks: 0, deckNames: [] }; e.decks++; if (v.support !== 'full') perCard.set(n, e); }
    }
    const cardList = [...perCard.values()].filter(e => e.support !== 'full');
    return { per, cardList };
};
(async () => {
    const h = await launch(); const { page } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const { per, cardList } = await page.evaluate(`(${BODY.toString()})(${JSON.stringify(decks)})`);
    const ready = per.filter(p => !p.bad.length);
    console.log(`${ready.length} of ${per.length} precons are fully Automated; ${per.filter(p => p.bad.length && p.bad.length <= 3).length} more are within 3 cards.`);
    const byType = {};
    per.forEach(p => { const t = byType[p.type] = byType[p.type] || { n: 0, ready: 0 }; t.n++; if (!p.bad.length) t.ready++; });
    Object.entries(byType).forEach(([t, v]) => console.log(`  ${t}: ${v.ready}/${v.n}`));
    // marginal unlock: decks where this card is among the bad
    const unlock = new Map();
    per.forEach(p => p.bad.forEach(n => unlock.set(n, (unlock.get(n) || 0) + 1)));
    cardList.forEach(e => { e.unlock = unlock.get(e.name) || 0; });
    cardList.sort((a, b) => b.decks - a.decks);
    console.log(`${cardList.length} distinct cards are not fully Automated (${cardList.filter(e => e.support === 'none').length} can't be cast). Most-used:`);
    cardList.slice(0, 40).forEach(e => console.log(`  ${String(e.decks).padStart(3)} decks  ${e.support.padEnd(7)} ${e.name}${e.unhandled[0] ? '  <- ' + e.unhandled[0].slice(0, 80) : e.why ? '  (' + e.why.slice(0, 60) + ')' : ''}`));
    fs.mkdirSync(path.join(ROOT, 'tests', '.out'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tests', '.out', 'precon_cards.json'), JSON.stringify({ per, cardList }, null, 1));
    if (process.argv.includes('--write')) {
        const bad = {}, near = {};
        per.forEach(p => { if (p.bad.length) { bad[p.file] = p.bad.length; if (p.bad.length <= 3) near[p.file] = p.bad; } });
        fs.mkdirSync(path.join(ROOT, 'spellslinger', 'data'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'spellslinger', 'data', 'precon-ready.json'), JSON.stringify({ measured: new Date().toISOString().slice(0, 10), total: per.length, ready: per.length - Object.keys(bad).length, bad, near }));
        console.log('saved spellslinger/data/precon-ready.json');
    }
    await h.close();
})();
