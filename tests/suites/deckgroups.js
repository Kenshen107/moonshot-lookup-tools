// Commander decks grouped by color (WUBRG), collapsible, with kind badges.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile(); setMode('sandbox', { quiet: true });
    ok('WUBRG key order', dgKey(['G', 'W', 'B']) === 'WBG' && dgKey([]) === '', dgKey(['G', 'W', 'B']));
    ok('official precon vs verified list', dgVerifiedKind(VERIFIED_DECKS.find(v => v.key === 'giada')) === 'official' && dgVerifiedKind(VERIFIED_DECKS.find(v => v.key === 'hugh')) === 'verified');
    ok('user decks are Yours, starters are Starter, a starter of a verified list keeps its kind',
        dgDeckKind({ name: 'My deck' }) === 'yours' && dgDeckKind({ name: 'x', starter: true }) === 'starter' && dgDeckKind({ name: 'Y', srcKey: 'giada' }) === 'official' && dgDeckKind({ name: 'Y', srcKey: 'hugh' }) === 'verified');
    const host = document.createElement('div'); host.id = 'dgHost'; document.body.appendChild(host);
    const items = [{ colors: ['G', 'W'], kind: 'yours', html: '<i class="t">A</i>' }, { colors: ['U'], kind: 'official', html: '<i class="t">B</i>' }, { colors: [], kind: 'verified', html: '<i class="t">C</i>' }, { colors: ['W', 'U', 'B', 'R', 'G'], kind: 'yours', html: '<i class="t">D</i>' }];
    host.innerHTML = dgView('t', () => items);
    const names = () => [...host.querySelectorAll('.dg-group strong')].map(e => e.textContent);
    ok('groups appear in WUBRG order', names().join('|') === 'Colorless|Blue|Selesnya (G W)|Five colors', names());
    ok('few decks: groups start open', [...host.querySelectorAll('.dg-group')].every(g => g.open));
    dgAll('t', false);
    ok('collapse all', [...host.querySelectorAll('.dg-group')].every(g => !g.open));
    dgAll('t', true);
    ok('expand all', [...host.querySelectorAll('.dg-group')].every(g => g.open));
    dgKind('t', 'yours');
    ok('kind filter keeps only yours', host.querySelectorAll('.t').length === 2, host.querySelectorAll('.t').length);
    dgClear('t'); dgCol('t', 'W');
    ok('color filter W: decks containing white', host.querySelectorAll('.t').length === 2, host.querySelectorAll('.t').length);
    dgCol('t', 'U');
    ok('W and U together: only the five-color deck', host.querySelectorAll('.t').length === 1);
    dgClear('t'); dgCol('t', 'C');
    ok('colorless filter', host.querySelectorAll('.t').length === 1 && /C/.test(host.querySelector('.t').textContent));
    ok('badge text', /Official precon/.test(dgBadge('official')) && /Yours/.test(dgBadge('yours')));
    // real lists
    const v = verifiedDecksHTML('chooseVerifiedOpp', null, 'rdy');
    const d = document.createElement('div'); d.innerHTML = v;
    ok('verified list: every deck shows once, with a badge', d.querySelectorAll('.opp').length === VERIFIED_DECKS.length && d.querySelectorAll('.opp .dg-badge').length === VERIFIED_DECKS.length, [d.querySelectorAll('.opp').length, VERIFIED_DECKS.length]);
    ok('official precons are badged', d.querySelectorAll('.k-official').length === VERIFIED_DECKS.filter(x => DG_OFFICIAL.has(x.key)).length && DG_OFFICIAL.size === 19);
    ok('every official key exists', [...DG_OFFICIAL].every(k => VERIFIED_DECKS.some(x => x.key === k)), [...DG_OFFICIAL].filter(k => !VERIFIED_DECKS.some(x => x.key === k)));
    // play tab grid
    const mk = (name, c) => ({ name, format: 'commander', cards: { x: 1 }, commander: null });
    profile.decks = [mk('Cmd A'), mk('Cmd B')]; showView('play'); PLAYSEL.type = 'commander'; renderPlayView(); await new Promise(r => setTimeout(r, 300));
    ok('play tab: commander decks are in a group with badges', document.querySelectorAll('#deckPick .dg-group .deck-pick .opp').length === 2 && document.querySelectorAll('#deckPick .opp .dg-badge').length === 2, document.getElementById('deckPick').innerHTML.slice(0, 200));
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'deckgroups');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('deckgroups', results, errors);
    writeOut('deckgroups', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
