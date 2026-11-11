// Pod seats: in a 3 or 4 player Commander game the owner can choose the deck for each extra seat (default: random every game).
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });
    const mk = (name, format) => ({ name, format, cards: { 'x': 1 }, commander: null });
    profile.decks = [mk('Cmd A', 'commander'), mk('Cmd B', 'commander')];
    showView('play'); PLAYSEL.type = 'commander'; $('playDeck').value = '0';
    podSeatPick = [];
    podSize = 2; renderPlayView(); await new Promise(r => setTimeout(r, 400));
    ok('no seat pickers in a duel', document.querySelectorAll('.pod-seat').length === 0);
    setPodSize(3); await new Promise(r => setTimeout(r, 400));
    ok('3 players: pickers for seat 2 and seat 3, both random', document.querySelectorAll('.pod-seat select').length === 2 && [...document.querySelectorAll('.pod-seat select')].every(x => x.value === 'random') && /Seat 2/.test(document.querySelector('.pod-seat').textContent) && chosenOpponent && chosenOpponent.type === 'random', chosenOpponent);
    setPodSize(4); await new Promise(r => setTimeout(r, 400));
    ok('4 players: pickers for seats 2, 3 and 4', document.querySelectorAll('.pod-seat select').length === 3);
    const sel = document.querySelectorAll('.pod-seat select')[1]; // seat 3
    ok('a seat 3 picker lists random, the fully working decks and your saved decks', sel.options.length >= 1 + VERIFIED_DECKS.length + 2 && [...sel.options].some(o => o.value === 'v|' + VERIFIED_DECKS[0].key) && [...sel.options].some(o => /^s\|/.test(o.value)), sel.options.length);
    sel.value = 'v|' + VERIFIED_DECKS[0].key; sel.dispatchEvent(new Event('change'));
    ok('choosing a deck is remembered', podSeatPick[0] === 'v|' + VERIFIED_DECKS[0].key && store.get('podSeatPick', [])[0] === podSeatPick[0], podSeatPick);
    setPodSize(4); await new Promise(r => setTimeout(r, 400));
    ok('the choice shows again after a redraw', document.querySelectorAll('.pod-seat select')[1].value === podSeatPick[0], document.querySelectorAll('.pod-seat select')[1].value);
    // Seat 2 works the same way: the drop-down sets the opponent, and a choice made in the tabs shows as "Chosen below"
    const s2 = document.querySelector('.pod-seat select');
    s2.value = 'v|' + VERIFIED_DECKS[1].key; s2.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 300));
    ok('choosing a deck for seat 2 sets the opponent', chosenOpponent && chosenOpponent.type === 'verified' && chosenOpponent.key === VERIFIED_DECKS[1].key && document.querySelector('.pod-seat select').value === 'v|' + VERIFIED_DECKS[1].key, chosenOpponent);
    chooseOpponent({ type: 'commander', key: 'atraxa-praetors-voice', name: 'Atraxa, Praetors\' Voice' }); await new Promise(r => setTimeout(r, 300));
    ok('an opponent chosen in the tabs shows in seat 2 as "Chosen below"', /Chosen below/.test(document.querySelector('.pod-seat select').textContent), document.querySelector('.pod-seat select').value);
    ok('no sideways scroll at this width', document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0);
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'podseats');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    await page.setViewportSize({ width: 412, height: 915 });
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const shots = path.join(ROOT, 'tests', '.out'); fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, 'podseats.png'), fullPage: true });
    const good = printResults('podseats', results, errors);
    writeOut('podseats', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
