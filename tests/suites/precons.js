// Precon Library: grouping, readiness badges, filters, and starting a match against a precon (ready or not).
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });
    ok('the Precon Library is a Sandbox tab', modeAllows('precons') && !modeAllows('shop'));
    showView('precons');
    await new Promise(r => setTimeout(r, 4000));
    const groups = [...document.querySelectorAll('#plBody .pl-group')];
    ok('the library shows decks grouped by kind', groups.length >= 3, groups.map(g => g.querySelector('summary strong').textContent));
    ok('a note says how many precons are playable', /\d+ of \d+ precons are fully playable/.test($('plNote').textContent), $('plNote').textContent);
    ok('only ready decks show by default', !document.querySelector('#plBody .pl-warn'));
    plSetFilter('ready', false);
    await new Promise(r => setTimeout(r, 500));
    ok('turning the filter off shows decks with cards still to build', !!document.querySelector('#plBody .pl-warn'));
    ok('those say how many cards do not work yet', /⚠ \d+ cards? not fully working/.test(document.querySelector('#plBody .pl-warn').textContent), document.querySelector('#plBody .pl-warn').textContent.slice(0, 80));
    plSetFilter('type', 'Welcome Deck');
    await new Promise(r => setTimeout(r, 300));
    ok('the kind filter shows only that kind', document.querySelectorAll('#plBody .pl-group').length === 1);
    plSetFilter('q', 'zzzznomatch'); await new Promise(r => setTimeout(r, 200));
    ok('search with no match says so', /No precons match/.test($('plBody').textContent));
    plSetFilter('q', ''); plSetFilter('type', 'all'); plSetFilter('ready', true);
    await new Promise(r => setTimeout(r, 500));
    // play: a ready deck as the opponent, another ready deck as my own
    const list = await loadPreconList();
    const ready = list.filter(preconIsReady);
    ok('many precons are ready', ready.length >= 80, ready.length);
    plPick(ready[0].file); await new Promise(r => setTimeout(r, 400));
    ok('picking a deck enables Battle', !$('plStart').disabled && $('plStartNote').textContent.includes(ready[0].name), $('plStartNote').textContent);
    $('plMine').value = 'pc:' + ready[1].file;
    await startPreconMatch();
    ok('a match starts between two precons', !!G && G.players[0].library.length + G.players[0].hand.length >= 20 && G.players[1].library.length + G.players[1].hand.length >= 20);
    // an opponent that is not ready still starts, with unplayable cards swapped for lands
    G.over = true; leaveGame();
    const bad = list.find(p => !preconIsReady(p) && p.type === 'Intro Pack');
    plPick(bad.file); await new Promise(r => setTimeout(r, 400));
    $('plMine').value = 'pc:' + ready[1].file;
    await startPreconMatch();
    ok('a deck with cards still to build can be the opponent', !!G && G.players[1].library.length + G.players[1].hand.length >= 20);

    // ---- the Precon Circuit in Campaign ----
    G.over = true; leaveGame();
    setMode('campaign', { quiet: true }); showView('campaign');
    await new Promise(r => setTimeout(r, 5000));
    ok('the circuit has a lane for each kind with ready decks', document.querySelectorAll('#circuitBody .pl-group').length >= 3, [...document.querySelectorAll('#circuitBody summary strong')].map(x => x.textContent));
    ok('it says how many stops are beaten', /0 of \d+ stops beaten/.test($('circuitNote').textContent), $('circuitNote').textContent);
    const wd = ready.find(p => p.type === 'Welcome Deck');
    circuitPick(wd.file); await new Promise(r => setTimeout(r, 400));
    ok('picking a stop enables Battle', !$('circuitStart').disabled);
    $('circuitMine').value = 'pc:' + ready[1].file;
    const before = profile.coins;
    await startCircuitMatch();
    ok('the match is a circuit game at the lane\'s AI level', G && G.campaign && G.campaign.circuit && G.campaign.node === 'pc-' + wd.file && G.players[1].aiLevel === 'easy', G && G.campaign);
    ok('first win pays the lane prize and ticks the stop', campaignResult(true).includes('+20') && profile.coins === before + 20 && profile.campaignProgress.includes('pc-' + wd.file), profile.coins - before);
    ok('a repeat win pays 10', (campaignResult(true), profile.coins === before + 30));
    ok('a loss pays 5', (campaignResult(false), profile.coins === before + 35));
    G.over = true; leaveGame(); showView('campaign');
    await new Promise(r => setTimeout(r, 1500));
    ok('the beaten stop shows a tick', /✓/.test($('circuitBody').textContent));
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'precons');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('precons', results, errors);
    writeOut('precons', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
