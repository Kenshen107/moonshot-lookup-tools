// Random playable decks: every card fully Automated, legal, the right size and colors; and the "Surprise me" opponent tile on the Play tab.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });
    const info = d => {
        const cards = {}; d.entries.forEach(e => { cards[e.card.id] = (cards[e.card.id] || 0) + e.n; });
        const deck = { name: d.name, format: d.format, cards, commander: d.commander ? d.commander.id : null, starter: true };
        const nonAuto = d.entries.filter(e => !isBasic(e.card) && rulesFor(e.card).support !== 'full').map(e => e.card.name);
        return { deck, count: deckCount(deck), problems: deckProblems(deck), nonAuto, lands: d.entries.filter(e => rulesFor(e.card).kind === 'land').reduce((a, e) => a + e.n, 0) };
    };
    const names = [];
    for (let i = 0; i < 4; i++) {
        const d = await buildRandomCommanderDeck();
        const r = info(d); names.push(d.commander.name);
        ok(`random Commander deck ${i + 1} (${d.commander.name}): 100 cards, no deck problems`, r.count === 100 && r.problems.length === 0, [r.count, r.problems.slice(0, 3)]);
        ok(`... and every card is fully automated`, r.nonAuto.length === 0 && rulesFor(d.commander).support === 'full', r.nonAuto.slice(0, 5));
        ok(`... with a sane land count (30 to 42)`, r.lands >= 30 && r.lands <= 42, r.lands);
    }
    ok('the random commanders differ', new Set(names).size >= 3, names);
    for (let i = 0; i < 2; i++) {
        const d = await buildRandomModernDeck();
        const r = info(d);
        ok(`random Modern deck ${i + 1} (${d.name}): 60 cards, legal`, r.count === 60 && r.problems.length === 0, [r.count, r.problems.slice(0, 3)]);
        ok('... and every card is fully automated', r.nonAuto.length === 0, r.nonAuto.slice(0, 5));
        ok('... with 20 to 28 lands', r.lands >= 20 && r.lands <= 28, r.lands);
    }
    // The Play tab offers it
    const mk = (name, format) => ({ name, format, cards: { x: 1 }, commander: null });
    profile.decks = [mk('Cmd', 'commander'), mk('Mod', 'modern')];
    showView('play'); PLAYSEL.type = null; $('playDeck').value = '0'; renderPlayView();
    await new Promise(r => setTimeout(r, 2500));
    ok('a Commander deck sees the "Surprise me" tile', /Surprise me/.test($('oppList').textContent) && /random playable Commander/.test($('oppList').textContent));
    chooseOpponent({ type: 'random', fmt: 'commander', name: 'Random playable deck' }); await new Promise(r => setTimeout(r, 1500));
    ok('choosing it marks it', chosenOpponent && chosenOpponent.type === 'random');
    playPickType('modern'); await new Promise(r => setTimeout(r, 1200));
    ok('switching to a Modern deck drops a Commander-only random pick', chosenOpponent === null);
    ok('a Modern deck sees its own random tile', /random playable Modern/.test($('oppList').textContent));
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'randomdeck');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    page.on('requestfailed', r => console.log('request failed:', r.method(), r.url().slice(0, 200), r.failure() && r.failure().errorText));
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const shots = path.join(ROOT, 'tests', '.out'); fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'randomdeck.png') });
    const good = printResults('randomdeck', results, errors);
    writeOut('randomdeck', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
