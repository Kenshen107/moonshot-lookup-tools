// Play tab: pick a deck TYPE, then a deck of that type, and see opponents of the same type (a fair match-up).
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });
    const mk = (name, format) => ({ name, format, cards: { 'x': 1 }, commander: null });
    profile.decks = [mk('Cmd A', 'commander'), mk('Cmd B', 'commander'), mk('Mod A', 'modern'), mk('Cas A', 'casual'), mk('Cas B', 'casual'), mk('Lim A', 'limited')];
    showView('play');
    PLAYSEL.type = null; $('playDeck').value = '0';
    renderPlayView(); await new Promise(r => setTimeout(r, 300));
    const chips = () => [...document.querySelectorAll('#deckPick .chip')].map(c => c.textContent.trim());
    ok('a chip for each deck type, with counts', chips().length === 4 && /Commander \(2\)/.test(chips()[0]) && /Casual \(2\)/.test(chips().join()), chips());
    const tiles = () => [...document.querySelectorAll('#deckPick .deck-pick .opp')].map(c => c.querySelector('strong').textContent);
    ok('only decks of the chosen type are listed', tiles().join() === 'Cmd A,Cmd B', tiles());
    playPickType('casual'); await new Promise(r => setTimeout(r, 300));
    ok('choosing Casual lists the Casual decks and selects the first', tiles().join() === 'Cas A,Cas B' && profile.decks[$('playDeck').value].name === 'Cas A', [tiles(), $('playDeck').value]);
    await new Promise(r => setTimeout(r, 2500));
    ok('the opponent heading names the type', /Casual decks/.test($('oppHead').textContent), $('oppHead').textContent);
    const opps = () => [...document.querySelectorAll('#oppList .opp-grid .opp')];
    ok('Casual decks face precons, not Modern themes', opps().length > 20 && !opps().some(o => /Mono-/.test(o.textContent)), opps().length);
    oppSel('kind', 'Welcome Deck'); await new Promise(r => setTimeout(r, 1500));
    ok('the precon type chips narrow the list', opps().length > 5 && opps().every(o => /Welcome Deck/.test(o.textContent)), opps().length);
    opps()[0].click(); await new Promise(r => setTimeout(r, 1500));
    ok('picking a precon marks it', chosenOpponent && chosenOpponent.type === 'precon', chosenOpponent);
    playPickType('modern'); await new Promise(r => setTimeout(r, 1500));
    ok('switching type clears an opponent of the wrong kind', chosenOpponent === null, chosenOpponent);
    ok('Modern decks face the themed decks', opps().length === MODERN_THEMES.length, opps().length);
    playPickType('casual'); await new Promise(r => setTimeout(r, 1500));
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'playpicker');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const shots = path.join(ROOT, 'tests', '.out'); fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'playpicker.png') });
    const good = printResults('playpicker', results, errors);
    writeOut('playpicker', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
