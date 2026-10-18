// Builds spellslinger/data/ascent-roster.json: the card pool for Planeswalker's Ascent (a slower format: vanilla creatures,
// creatures with simple keywords, simple draw / removal / bounce spells, basic and tapped dual lands).
//   node tests/ascent_roster.js          write the file and print the counts
// Every card must read as fully Automated by the game's own card reader. Rarity and tier are set here by strength, not by Magic's printing.
'use strict';
const fs = require('fs'), path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');

const SIMPLE_KW = ['flying', 'first strike', 'trample', 'vigilance', 'reach', 'haste', 'defender', 'deathtouch', 'lifelink', 'menace', 'double strike', 'hexproof', 'indestructible'];
const KW_VALUE = { flying: 1.5, 'first strike': 1, trample: .75, vigilance: .5, reach: .5, haste: .75, defender: -1.5, deathtouch: 1.5, lifelink: 1, menace: 1, 'double strike': 3, hexproof: 1.5, indestructible: 2.5 };
const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

function stripReminder(s) { return s.replace(/\([^)]*\)/g, '').trim(); }
function kwOnly(text) {
    const lines = stripReminder(text).split('\n').map(l => l.trim()).filter(Boolean);
    const kws = [];
    for (const l of lines) {
        const parts = l.toLowerCase().replace(/\.$/, '').split(/\s*,\s*/);
        if (!parts.every(p => SIMPLE_KW.includes(p))) return null;
        kws.push(...parts);
    }
    return kws;
}
// one-effect spells written plainly; returns { kind, n } or null
function simpleSpell(c) {
    const t = stripReminder(c.oracle_text || '').replace(/\n+/g, ' ').trim(), name = c.name;
    const tl = c.type_line;
    if (!/^(Instant|Sorcery)$/.test(tl)) return null;
    let m;
    if ((m = t.match(/^Draw (a|two|three) cards?\.$/))) return { kind: 'draw', n: { a: 1, two: 2, three: 3 }[m[1]] };
    if (/^Destroy target creature\.$/.test(t)) return { kind: 'destroy', n: 0 };
    if (/^Destroy target nonblack creature\.$/.test(t) || /^Destroy target nonartifact, nonblack creature\.$/.test(t)) return { kind: 'destroy', n: 0 };
    if (/^Exile target creature\.$/.test(t)) return { kind: 'exile', n: 0 };
    if (/^Return target creature to its owner's hand\.$/.test(t)) return { kind: 'bounce', n: 0 };
    const T = t.replace(name, '~');
    const R = [
        [/^~ deals (\d) damage to (any target|target creature|target attacking or blocking creature|target creature or planeswalker)\.( If (that creature|a creature dealt damage this way) would die this turn, exile it instead\.)?$/, 'burn', m => +m[1]],
        [/^~ deals (\d) damage to (any target|target creature) and you gain \d life\.$/, 'burn', m => +m[1] + 1],
        [/^Target creature gets -(\d)\/-(\d) until end of turn\.$/, 'shrink', m => +m[1]],
        [/^Target creature gets -(\d)\/-(\d) until end of turn\. Draw a card\.$/, 'shrink', m => +m[1] + 1],
        [/^Target creature gets \+(\d)\/\+(\d) until end of turn\.$/, 'pump', m => +m[1]],
        [/^Target creature gets \+(\d)\/\+(\d) and gains (trample|first strike|reach|vigilance|haste|lifelink|deathtouch) until end of turn\.$/, 'pump', m => +m[1] + 0.5],
        [/^Target creature gets \+(\d)\/\+(\d) until end of turn\. Draw a card\.$/, 'pump', m => +m[1] + 1],
        [/^Creatures you control get \+(\d)\/\+(\d) until end of turn\.$/, 'teamPump', m => +m[1]],
        [/^Draw (a|two|three) cards?\.$/, 'draw', m => ({ a: 1, two: 2, three: 3 })[m[1]]],
        [/^Draw (two|three) cards, then discard a card\.$/, 'draw', m => ({ two: 2, three: 3 })[m[1]] - 0.5],
        [/^Destroy target (nonblack |nonartifact, nonblack |tapped |attacking |blocking |attacking or blocking |nonwhite |nonred |nongreen |nonblue |white |blue |black |red |green )?creature\.$/, 'destroy', () => 0],
        [/^Exile target creature\.$/, 'exile', () => 0],
        [/^Return target creature to its owner's hand\.$/, 'bounce', () => 0],
        [/^Put target creature on top of its owner's library\.$/, 'bounce', () => 0],
        [/^Return target creature card from your graveyard to your hand\.$/, 'recur', () => 0],
        [/^You gain (\d) life\.$/, 'life', m => +m[1]],
        [/^Target player draws (two|three) cards and loses (\d) life\.$/, 'draw', m => ({ two: 2, three: 3 })[m[1]] - 0.5]
    ];
    for (const [re, kind, f] of R) { const m2 = T.match(re); if (m2) return { kind, n: f(m2) }; }
    return null;
}
function simpleLand(c) {
    if (!/^(Basic )?Land( — .+)?$/.test(c.type_line)) return null;
    const t = stripReminder(c.oracle_text || '').replace(/\n+/g, ' ');
    if (BASICS.includes(c.name)) return { kind: 'basic' };
    if (/^[A-Za-z' ]+ enters tapped\. \{T\}: Add \{[WUBRG]\} or \{[WUBRG]\}\.$/.test(t)) return { kind: 'tapdual' };
    return null;
}

(async () => {
    const h = await launch();
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const sup = await page.evaluate(async () => {
        const cards = await (await fetch('/tests/data/cards_all.json')).json();
        return cards.map(c => rulesFor(slimCard(c)).support === 'full' ? 1 : 0).join('');
    });
    await h.close();
    const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json'), 'utf8'));
    const best = new Map(); // one printing per name: newest regular-frame printing
    cards.forEach((c, i) => {
        if (sup[i] !== '1') return;
        if (!c.legalities || c.legalities.commander !== 'legal') return; // keeps Un-sets and joke cards out
        if (c.layout !== 'normal') return;
        const old = best.get(c.name);
        if (!old || c.released_at > old.released_at) best.set(c.name, c);
    });
    const pool = [];
    for (const c of best.values()) {
        const colors = (c.color_identity || []).join('');
        if ((c.color_identity || []).length > 2) continue;
        const base = { id: c.id, name: c.name, cost: c.mana_cost || '', cmc: c.cmc, colors };
        const land = simpleLand(c);
        if (land) { pool.push({ ...base, type: 'land', kind: land.kind, power: 0 }); continue; }
        if (/Creature/.test(c.type_line) && !/Legendary|Token|Tribal|Vehicle|Artifact Land/.test(c.type_line) && c.power !== undefined && /^\d+$/.test(c.power) && /^\d+$/.test(c.toughness)) {
            if (/\{[^}]*\/[^}]*\}|\{X\}/.test(c.mana_cost || '')) continue; // hybrid and X costs
            const kws = c.oracle_text ? kwOnly(c.oracle_text) : [];
            if (kws === null) continue;
            const p = +c.power, t = +c.toughness;
            const impact = p + t + 1.6 * kws.reduce((a, k) => a + (KW_VALUE[k] || 0), 0) + (c.cmc >= 5 ? 1 : 0), power = impact * 0.6 + (impact - 2 * c.cmc) * 0.4;
            pool.push({ ...base, type: 'creature', kind: kws.length ? 'keyword' : 'vanilla', pt: `${p}/${t}`, kws, power: +power.toFixed(2) });
            continue;
        }
        const sp = simpleSpell(c);
        if (sp && c.cmc <= 6) {
            const w = { draw: sp.n * 2, destroy: 5, exile: 5.5, bounce: 2, burn: sp.n * 1.5, pump: 1 + sp.n * .3, teamPump: 2 + sp.n, life: 1, shrink: sp.n * 1.2, recur: 3 }[sp.kind];
            pool.push({ ...base, type: 'spell', kind: sp.kind, n: sp.n, power: +(w - c.cmc * 0.5).toFixed(2) });
        }
    }
    // rarity and tier by strength inside each group (percentiles), not Magic's own rarity
    const groups = {};
    pool.filter(c => c.type !== 'land').forEach(c => (groups[c.type] = groups[c.type] || []).push(c));
    for (const arr of Object.values(groups)) {
        arr.sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
        arr.forEach((c, i) => {
            const q = i / (arr.length - 1 || 1);
            c.rarity = q > .97 ? 'mythic' : q > .83 ? 'rare' : q > .55 ? 'uncommon' : 'common';
            c.tier = q > .75 ? 3 : q > .35 ? 2 : 1;
        });
    }
    pool.filter(c => c.type === 'land').forEach(c => { c.rarity = c.kind === 'basic' ? 'basic' : 'uncommon'; c.tier = c.kind === 'basic' ? 1 : 2; });
    pool.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const out = { made: new Date().toISOString().slice(0, 10), note: 'Planeswalkers Ascent roster. Rarity and tier are set by strength (tests/ascent_roster.js), not Magic\'s printing.', cards: pool };
    fs.writeFileSync(path.join(ROOT, 'spellslinger', 'data', 'ascent-roster.json'), JSON.stringify(out));
    const by = {};
    pool.forEach(c => { const k = `${c.type}/${c.kind}`; by[k] = (by[k] || 0) + 1; });
    console.log('total', pool.length, by);
    const col = {}; pool.filter(c => c.type === 'creature').forEach(c => { const k = c.colors || 'C'; col[k] = (col[k] || 0) + 1; });
    console.log('creature colors', col);
    const rar = {}; pool.forEach(c => { const k = c.type + ' ' + c.rarity + ' T' + c.tier; rar[k] = (rar[k] || 0) + 1; });
    console.log(rar);
})();
