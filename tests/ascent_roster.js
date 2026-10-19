// Builds spellslinger/data/ascent-roster.json: the card pool for Planeswalker's Ascent (a slower format: vanilla creatures,
// creatures with simple keywords, simple draw / removal / bounce spells, basic and tapped dual lands).
//   node tests/ascent_roster.js          write the file and print the counts
// Every card must read as fully Automated by the game's own card reader. Rarity and tier are set here by strength, not by Magic's printing.
'use strict';
const fs = require('fs'), path = require('path');
const { launch, openTestPage, installHelpers, ROOT } = require('./lib/harness');

const SIMPLE_KW = ['flying', 'first strike', 'trample', 'vigilance', 'reach', 'haste', 'defender', 'deathtouch', 'lifelink', 'menace', 'double strike', 'hexproof', 'indestructible', 'flash', 'shroud', 'fear', 'prowess', 'swampwalk', 'forestwalk', 'islandwalk', 'mountainwalk', 'plainswalk'];
const KW_VALUE = { flash: .5, shroud: 1, fear: 1, prowess: .75, swampwalk: .5, forestwalk: .5, islandwalk: .5, mountainwalk: .5, plainswalk: .5, flying: 1.5, 'first strike': 1, trample: .75, vigilance: .5, reach: .5, haste: .75, defender: -1.5, deathtouch: 1.5, lifelink: 1, menace: 1, 'double strike': 3, hexproof: 1.5, indestructible: 2.5 };
const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

function stripReminder(s) { return s.replace(/\([^)]*\)/g, '').trim(); }
// Reads a creature's whole text: plain keywords plus a few simple abilities (mana dorks, enters / dies effects, firebreathing).
// Returns { kws, tags, bonus } or null when any line is something else.
const ABILITY_RULES = [
    [/^\{T\}: Add \{[WUBRGC]\}\.$/, 'mana', 3],
    [/^\{T\}: Add \{[WUBRG]\}\{[WUBRG]\}\.$/, 'mana2', 4.5],
    [/^\{T\}: Add one mana of any color\.$/, 'anymana', 5],
    [/^When ~ enters, you gain \d life\.$/, 'etb-life', 1],
    [/^When ~ enters, draw a card\.$/, 'etb-draw', 2.5],
    [/^When ~ enters, scry \d\.$/, 'etb-scry', 0.5],
    [/^When ~ enters, each opponent discards a card\.$/, 'etb-discard', 1.5],
    [/^When ~ enters, each opponent loses \d life\.$/, 'etb-drain', 1.5],
    [/^When ~ enters, target creature gets \+\d\/\+\d until end of turn\.$/, 'etb-pump', 1],
    [/^When ~ enters, put a \+1\/\+1 counter on target creature\.$/, 'etb-counter', 1.5],
    [/^When ~ enters, ~ deals \d damage to (any target|target creature)\.$/, 'etb-burn', 2.5],
    [/^When ~ dies, you gain \d life\.$/, 'die-life', 0.75],
    [/^When ~ dies, draw a card\.$/, 'die-draw', 2],
    [/^(\{\d\})?(\{[WUBRG]\})+: ~ gets \+\d\/\+\d until end of turn\.$/, 'pump-ability', 1.5],
    [/^\{[WUBRG]\}: Regenerate ~\.$/, 'regenerate', 1],
    // tokens and team boosts (white's plan: wide boards plus anthems)
    [/^When ~ enters, create (a|an|two) \d\/\d [A-Za-z ]+ creature tokens?( with (flying|vigilance|lifelink|first strike))?\.$/, 'etb-token', 2.5],
    [/^Other creatures you control get \+1\/\+1\.$/, 'lord', 5],
    [/^Other creatures you control get \+[01]\/\+[01]\.$/, 'lord-small', 2.5],
    [/^Other (Soldier|Knight|Human|Spirit|Cleric|Warrior|Kithkin|Merfolk|Wizard|Faerie|Pirate|Bird|Illusion|Sphinx|Drake|Rogue) creatures you control get \+1\/\+1\.$/, 'tribal-lord', 2],
    // blue's tools: evasion, tempo and card flow
    [/^~ can't be blocked\.$/, 'unblockable', 3],
    [/^Whenever ~ deals combat damage to a player, (you may )?draw a card\.$/, 'hit-draw', 3],
    [/^When ~ enters, return target creature to its owner's hand\.$/, 'etb-bounce', 3],
    [/^When ~ enters, tap target creature\.$/, 'etb-tap', 1.5],
    [/^When ~ enters, draw a card, then discard a card\.$/, 'etb-loot', 1.5],
    [/^Other creatures you control have (vigilance|first strike|lifelink|flying)\.$/, 'grant-lord', 2.5]
];
function readCreatureText(c) {
    const lines = stripReminder(c.oracle_text || '').replace(new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~').replace(/\bthis creature\b/gi, '~').split('\n').map(l => l.trim()).filter(Boolean);
    const kws = [], tags = []; let bonus = 0;
    for (const l of lines) {
        const parts = l.toLowerCase().replace(/\.$/, '').split(/\s*,\s*/);
        if (parts.every(p => SIMPLE_KW.includes(p))) { kws.push(...parts); continue; }
        const rule = ABILITY_RULES.find(([re]) => re.test(l));
        if (!rule) return null;
        tags.push(rule[1]); bonus += rule[2];
    }
    if (tags.length > 2) return null;
    return { kws, tags, bonus };
}
function kwOnly(text) { return null; } // (older name, no longer used)
// A plain mana rock: an artifact that only taps for mana
function readRock(c) {
    if (c.type_line !== 'Artifact' || c.cmc < 1 || c.cmc > 4) return null;
    const t = stripReminder(c.oracle_text || '').trim();
    const ok = [/^\{T\}: Add \{C\}\.$/, /^\{T\}: Add \{C\}\{C\}\.$/, /^\{T\}: Add one mana of any color\.$/];
    const i = ok.findIndex(re => re.test(t));
    return i < 0 ? null : { tag: ['mana', 'mana2', 'anymana'][i] };
}

// one-effect spells written plainly; returns { kind, n } or null
function simpleSpell(c) {
    const t = stripReminder(c.oracle_text || '').replace(/\n+/g, ' ').trim(), name = c.name;
    const tl = c.type_line;
    let m;
    // permanents that boost the whole team (anthems) or give it a keyword
    if (/^Enchantment$/.test(tl)) {
        if ((m = t.match(/^(Creatures you control|White creatures you control) get \+(\d)\/\+(\d)\.$/))) return { kind: 'anthem', n: +m[2] + +m[3], perm: true };
        if ((m = t.match(/^Creatures you control have (first strike|vigilance|lifelink|flying)\.$/))) return { kind: 'grant', n: m[1] === 'flying' ? 3 : m[1] === 'vigilance' ? 1 : 2, perm: true };
        return null;
    }
    if (!/^(Instant|Sorcery)$/.test(tl)) return null;
    // token makers: Create <N> <P>/<T> ... creature tokens (optionally with one keyword)
    if ((m = t.match(/^Create (a|an|two|three|four) (\d)\/(\d) [A-Za-z ]+ creature tokens?( with (flying|vigilance|lifelink|first strike))?\.$/))) {
        const cnt = { a: 1, an: 1, two: 2, three: 3, four: 4 }[m[1]];
        return { kind: 'tokens', n: +(cnt * ((+m[2] + +m[3]) * 0.9 + (m[5] ? 1 : 0))).toFixed(1) };
    }
    if ((m = t.match(/^Counter target (spell|creature spell|noncreature spell)( unless its controller pays \{(\d)\})?\.$/))) return { kind: 'counter', n: m[3] ? +m[3] : m[1] === 'spell' ? 9 : 8 };
    if (/^Return target creature to its owner's hand\. Draw a card\.$/.test(t)) return { kind: 'bounce', n: 1 };
    if (/^Tap target creature\. It doesn't untap during its controller's next untap step\.$/.test(t)) return { kind: 'tap', n: 2 };
    if (/^Tap target creature\.$/.test(t)) return { kind: 'tap', n: 1 };
    if ((m = t.match(/^Destroy target (attacking |tapped )?creature with (power|toughness) (\d) or greater\.$/))) return { kind: 'destroy', n: 1 };
    if (/^Exile target (attacking |tapped |attacking or blocking )creature\.$/.test(t)) return { kind: 'exile', n: 1 };
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
        [/^Search your library for a basic land card, put it onto the battlefield tapped, then shuffle\.$/, 'ramp', () => 0],
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
            const rd = readCreatureText(c);
            if (!rd) continue;
            const { kws, tags, bonus } = rd;
            const p = +c.power, t = +c.toughness;
            const impact = p + t + 1.6 * kws.reduce((a, k) => a + (KW_VALUE[k] || 0), 0) + bonus + (c.cmc >= 5 ? 1 : 0), power = impact * 0.6 + (impact - 2 * c.cmc) * 0.4;
            const kind = tags.some(x => x === 'anymana') ? 'anydork' : tags.some(x => ['lord', 'lord-small', 'tribal-lord', 'grant-lord'].includes(x)) ? 'lord' : tags.some(x => ['unblockable', 'hit-draw', 'etb-bounce', 'etb-tap', 'etb-loot'].includes(x)) ? 'tempocreature' : tags.includes('etb-token') ? 'tokencreature' : tags.some(x => x.startsWith('mana')) ? 'dork' : tags.length ? 'ability' : kws.length ? 'keyword' : 'vanilla';
            pool.push({ ...base, type: 'creature', kind, pt: `${p}/${t}`, kws, tags, power: +power.toFixed(2) });
            continue;
        }
        const rock = readRock(c);
        if (rock) { pool.push({ ...base, type: 'spell', kind: 'rock', tags: [rock.tag], n: 0, power: +((rock.tag === 'anymana' ? 6 : rock.tag === 'mana2' ? 7 : 4) - c.cmc * 0.5).toFixed(2) }); continue; }
        const sp = simpleSpell(c);
        if (sp && c.cmc <= 6) {
            const w = { tokens: sp.n, anthem: 3 + sp.n * 2.5, grant: 1.5 + sp.n, draw: sp.n * 2, destroy: 5 - (sp.n ? 1 : 0), exile: 5.5 - (sp.n ? 1 : 0), bounce: 2 + sp.n * 2, counter: sp.n >= 8 ? (sp.n === 9 ? 5 : 3.5) : 1.5 + sp.n * 0.4, tap: 1 + sp.n * 0.7, burn: sp.n * 1.5, pump: 1 + sp.n * .3, teamPump: 2 + sp.n, life: 1, shrink: sp.n * 1.2, recur: 3, ramp: 3 }[sp.kind];
            pool.push({ ...base, type: 'spell', kind: sp.kind, n: sp.n, perm: !!sp.perm, power: +(w - c.cmc * 0.5).toFixed(2) });
        }
    }
    // ---- Trophy pool: cards far stronger than anything in a pack. Earned only by winning many games against one opponent. ----
    // Any fully Automated card in at most two colors that is among the most played in Commander (EDHREC rank) and is not already in the roster.
    // Auras, Sagas, Classes, Equipment, Vehicles, planeswalkers and battles are left out to keep them simple. Not used by the computer opponents.
    const inPool = new Set(pool.map(c => c.id));
    const TROPHY_MAX_RANK = 1200;
    const trophies = [];
    for (const c of best.values()) {
        if (inPool.has(c.id) || (c.color_identity || []).length > 2 || !c.edhrec_rank || c.edhrec_rank > TROPHY_MAX_RANK) continue;
        if (/Land|Token|Aura|Saga|Class|Equipment|Vehicle|Planeswalker|Battle|Conspiracy|Attraction/.test(c.type_line)) continue;
        if (/\{[^}]*\/[^}]*\}/.test(c.mana_cost || '') || c.cmc > 9) continue;
        const colors = (c.color_identity || []).join('');
        const base = { id: c.id, name: c.name, cost: c.mana_cost || '', cmc: c.cmc, colors };
        const rankPower = 30 - 4 * Math.log10(c.edhrec_rank);
        if (/Creature/.test(c.type_line)) {
            if (!/^\d+$/.test(c.power) || !/^\d+$/.test(c.toughness)) continue;
            trophies.push({ ...base, type: 'creature', kind: 'trophy', pt: `${c.power}/${c.toughness}`, kws: c.keywords || [], tags: [], power: +(rankPower + (+c.power + +c.toughness) * 0.1).toFixed(2), legendary: /Legendary/.test(c.type_line) });
        } else if (/^(Instant|Sorcery|Artifact|Enchantment)( —.*)?$/.test(c.type_line)) {
            trophies.push({ ...base, type: 'spell', kind: 'trophy', n: 0, tags: [], power: +rankPower.toFixed(2), permanent: /Artifact|Enchantment/.test(c.type_line) });
        }
    }
    trophies.sort((a, b) => b.power - a.power || a.name.localeCompare(b.name));
    trophies.forEach(c => { c.rarity = 'trophy'; c.tier = 3; });
    console.log('trophy cards', trophies.length, '(creatures', trophies.filter(c => c.type === 'creature').length + ')');
    const trophyByColor = {}; trophies.forEach(c => { const k = c.colors || 'C'; trophyByColor[k] = (trophyByColor[k] || 0) + 1; });
    console.log('trophy colors', trophyByColor);
    // rarity and tier by strength. Rarity is ranked inside each type and color group (so every color has its own rares and mythics):
    // top 8% mythic, next 18% rare, next 30% uncommon, the rest common. Tier is ranked inside the type: top quarter tier 3, next 40% tier 2.
    const byGroup = {}, byType = {};
    pool.filter(c => c.type !== 'land').forEach(c => {
        (byGroup[c.type + '|' + (c.colors[0] || 'C')] = byGroup[c.type + '|' + (c.colors[0] || 'C')] || []).push(c);
        (byType[c.type] = byType[c.type] || []).push(c);
    });
    const rank = arr => { arr.sort((a, b) => a.power - b.power || a.name.localeCompare(b.name)); return arr.map((c, i) => [c, i / (arr.length - 1 || 1)]); };
    for (const arr of Object.values(byGroup)) for (const [c, q] of rank(arr)) c.rarity = q > .92 ? 'mythic' : q > .74 ? 'rare' : q > .44 ? 'uncommon' : 'common';
    for (const arr of Object.values(byType)) for (const [c, q] of rank(arr)) c.tier = q > .75 ? 3 : q > .35 ? 2 : 1;
    // mana makers are never in the Locals' decks, and universal ones are for the top league
    pool.forEach(c => { if (['dork', 'rock'].includes(c.kind) && c.tier < 2) c.tier = 2; if ((c.kind === 'anydork' || (c.kind === 'rock' && c.tags[0] !== 'mana')) && c.tier < 3) c.tier = 3; });
    pool.filter(c => c.type === 'land').forEach(c => { c.rarity = c.kind === 'basic' ? 'basic' : 'uncommon'; c.tier = c.kind === 'basic' ? 1 : 2; });
    pool.push(...trophies);
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
