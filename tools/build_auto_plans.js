// Builds spellslinger/data/auto-plans.json: for each commander, the cards EDHREC says that commander's decks play far more than other decks (synergy), as an "engine" list the
// computer plays sooner (2026-11-19, owner: "do all four" of the EDHREC ideas; see CLAUDE.md "EDHREC synergy").
// Usage: node tools/build_auto_plans.js [--max 400]        (needs the network; about 2 to 3 minutes; run again whenever you want fresher numbers)
// Commanders: EDHREC's top commanders of the last two years and this week, the commanders of tests/decks/*.txt (the owner's decks), then the "similar commanders" of those, until --max.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const maxArg = process.argv.indexOf('--max'); const MAX = maxArg > 0 ? +process.argv[maxArg + 1] : 400;
const slug = name => String(name).split(' // ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’",.!?:]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch (e) { /* retry */ } await sleep(800 * (i + 1)); } return null; }
const handPlanned = new Set(); // commanders that already have a hand-written plan are skipped
{ const src = fs.readFileSync(path.join(ROOT, 'spellslinger', '15y-ai-plans.js'), 'utf8'); const i = src.indexOf('const DECK_PLANS'); (src.slice(i).match(/^    '([^']+)': \{/gm) || []).forEach(l => handPlanned.add(l.replace(/^    '/, '').replace(/': \{$/, ''))); }

// the plan: permanents (creatures, enchantments, artifacts, planeswalkers) with synergy 0.25+ that at least a fifth of the commander's decks play
const ENGINE_TAGS = /^(creatures|enchantments|utilityartifacts|manaartifacts|planeswalkers|highliftcards|newcards|topcards)$/;
function planFrom(json) {
    const lists = (json.container && json.container.json_dict && json.container.json_dict.cardlists) || [];
    const seen = new Map();
    for (const l of lists) {
        if (!ENGINE_TAGS.test(l.tag || '')) continue;
        for (const v of l.cardviews || []) {
            if (!v.potential_decks || v.potential_decks < 20) continue;
            const rate = v.num_decks / v.potential_decks, syn = v.synergy || 0;
            if (syn < 0.25 || rate < 0.2) continue;
            // highliftcards / newcards / topcards hold cards of every type: keep them only when the card is also in a permanent list, or the page has none of that type
            const k = v.name; const cur = seen.get(k);
            if (!cur || syn > cur.syn) seen.set(k, { name: v.name, syn, rate, tag: l.tag });
        }
    }
    const typed = new Set(); lists.forEach(l => { if (/^(creatures|enchantments|utilityartifacts|manaartifacts|planeswalkers)$/.test(l.tag || '')) (l.cardviews || []).forEach(v => typed.add(v.name)); });
    const out = [...seen.values()].filter(x => typed.has(x.name) || /^(creatures|enchantments|utilityartifacts|manaartifacts|planeswalkers)$/.test(x.tag)).sort((a, b) => b.syn * b.rate - a.syn * a.rate);
    return out.slice(0, 14).map(x => x.name);
}
function deckCommanders() {
    const out = [];
    for (const f of fs.readdirSync(path.join(ROOT, 'tests', 'decks'))) {
        const blocks = fs.readFileSync(path.join(ROOT, 'tests', 'decks', f), 'utf8').replace(/\r/g, '').trim().split(/\n\s*\n/);
        const last = blocks[blocks.length - 1].split('\n').map(l => l.replace(/^\d+\s+/, '').replace(/\s*\(.*$/, '').trim()).filter(Boolean);
        if (last.length <= 3) last.forEach(n => out.push(n));
    }
    return out;
}
(async () => {
    const queue = [], seenSlug = new Set();
    const add = n => { const s = slug(n); if (!s || seenSlug.has(s)) return; seenSlug.add(s); queue.push(n); };
    for (const p of ['year', 'week']) { const j = await get(`https://json.edhrec.com/pages/commanders/${p}.json`); ((j && j.container && j.container.json_dict && j.container.json_dict.cardlists) || []).forEach(l => (l.cardviews || []).forEach(v => add(v.name))); }
    deckCommanders().forEach(add);
    const plans = {}; let done = 0, skipped = 0, missing = 0;
    for (let qi = 0; qi < queue.length && done < MAX; qi++) {
        const name = queue[qi];
        const j = await get(`https://json.edhrec.com/pages/commanders/${slug(name)}.json`); await sleep(220);
        if (!j) { missing++; continue; }
        const cname = (j.container && j.container.json_dict && j.container.json_dict.card && j.container.json_dict.card.name) || name;
        (Array.isArray(j.similar) ? j.similar : []).forEach(x => add(typeof x === 'string' ? x : (x && x.name)));
        done++;
        if (handPlanned.has(cname)) { skipped++; continue; }
        const engine = planFrom(j);
        if (engine.length >= 4) plans[cname] = engine;
    }
    const out = { built: new Date().toISOString().slice(0, 10), source: 'EDHREC json.edhrec.com/pages/commanders (synergy 0.25+, played by 20%+ of decks)', commanders: done, plans };
    fs.writeFileSync(path.join(ROOT, 'spellslinger', 'data', 'auto-plans.json'), JSON.stringify(out));
    console.log(`${done} commanders read (${missing} without a page, ${skipped} with a hand-written plan), ${Object.keys(plans).length} auto plans written (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
})();
