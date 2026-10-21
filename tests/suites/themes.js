// Deck themes (2026-10-20): the theme table, and live builds of random Commander decks for chosen themes
// (Scryfall tags in EDHREC order, every card fully Automated, legal, right size). The live part is skipped when Scryfall can't be reached.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });
    // ---- the table ----
    ok('there are at least 45 themes', DECK_THEMES.length >= 45, DECK_THEMES.length);
    ok('keys are unique and every theme has a query, a name and styles', new Set(DECK_THEMES.map(t => t.key)).size === DECK_THEMES.length && DECK_THEMES.every(t => t.q && t.name && t.emoji && t.styles.length && t.styles.every(s => PLAYSTYLE_KEYS.includes(s)) && t.take >= t.min));
    ok('every playstyle has at least 8 themes that play as it', PLAYSTYLE_KEYS.every(s => DECK_THEMES.filter(t => t.styles.includes(s)).length >= 8), PLAYSTYLE_KEYS.map(s => s + ':' + DECK_THEMES.filter(t => t.styles.includes(s)).length).join(' '));
    ok('the wanted themes exist: group hug, politics, infect, toxic', ['group-hug', 'politics', 'infect', 'toxic'].every(k => deckThemeByKey(k)));
    ok('a style only gets themes that fit it', PLAYSTYLE_KEYS.every(s => [...Array(30)].every(() => pickDeckTheme(s).styles.includes(s))));
    ok('picking is varied', new Set([...Array(60)].map(() => pickDeckTheme().key)).size >= 15);
    ok('a forced theme is the one returned', pickDeckTheme('aggro', 'group-hug').key === 'group-hug');
    ok('the tribes carry their creature type', DECK_THEMES.filter(t => t.tribe).length >= 20 && deckThemeByKey('tribe-goblin').q.includes('t:goblin'));
    // The Play tab picker
    const html = randomThemeSelectHTML();
    ok('the Play tab theme picker lists every theme', DECK_THEMES.every(t => html.includes(`value="${t.key}"`)) && /Any theme/.test(html));
    // ---- live builds ----
    const probe = await searchCards('f:commander game:paper otag:group-hug', 1, 'edhrec').catch(() => []);
    if (!probe.length) { ok('SKIPPED live builds: Scryfall could not be reached', true); return out; }
    const info = d => {
        const cards = {}; d.entries.forEach(e => { cards[e.card.id] = (cards[e.card.id] || 0) + e.n; });
        const deck = { name: d.name, format: d.format, cards, commander: d.commander.id, starter: true };
        return { count: deckCount(deck), problems: deckProblems(deck), nonAuto: d.entries.filter(e => !isBasic(e.card) && rulesFor(e.card).support !== 'full').map(e => e.card.name) };
    };
    const textOf = d => d.entries.map(e => (e.card.text || '') + ' ' + (e.card.type || '')).join(' ');
    for (const key of ['group-hug', 'politics', 'infect', 'toxic', 'tribe-goblin', 'voltron']) {
        const d = await buildRandomCommanderDeck(null, undefined, key);
        const r = info(d);
        ok(`${key}: 100 cards, no deck problems, every card automated`, r.count === 100 && r.problems.length === 0 && r.nonAuto.length === 0, [d.name, r.count, r.problems.slice(0, 2), r.nonAuto.slice(0, 3)]);
        ok(`${key}: the deck says its theme and has theme cards`, d.theme && d.theme.key === key && d.theme.cards >= 4 && /theme cards/.test(d.source), d.theme);
        ok(`${key}: the style fits the theme`, deckThemeByKey(key).styles.includes(d.aiStyle), d.aiStyle);
        if (key === 'infect' || key === 'toxic') ok(`${key}: it really has poison cards`, (textOf(d).match(/infect|toxic|poison|proliferate/gi) || []).length >= 5, (textOf(d).match(/infect|toxic|poison|proliferate/gi) || []).length);
        if (key === 'tribe-goblin') ok('the goblin deck has goblins', d.entries.filter(e => /Goblin/.test(e.card.type)).length >= 8, d.entries.filter(e => /Goblin/.test(e.card.type)).length);
    }
    const seat = await buildRandomCommanderDeck(null, 'aggro');
    ok('a pod seat that is handed a style keeps it and gets a theme that fits', seat.aiStyle === 'aggro' && (!seat.theme || deckThemeByKey(seat.theme.key).styles.includes('aggro')), seat.theme);
    const plain = await buildRandomCommanderDeck(null, 'control', 'none');
    ok("'none' builds the old unthemed shuffle", !plain.theme && info(plain).count === 100);
    // A forced theme shows up in the game: the player's theme field
    const d = await buildRandomCommanderDeck(null, undefined, 'group-hug');
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'themes');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    page.on('requestfailed', r => console.log('request failed:', decodeURIComponent(r.url()).slice(0, 260), r.failure() && r.failure().errorText));
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('themes', results, errors);
    writeOut('themes', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
