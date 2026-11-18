// EDHREC synergy badge and the "Fits the commander" panel in the deck builder (2026-11-19). Offline: the synergy numbers are set by hand.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const names = ['Nog, Ambitious Cadet', 'Lotus Cobra', 'Sol Ring', 'Zuran Orb', 'Forest', 'Swamp', 'Bloodghast'];
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            synSet('nog-ambitious-cadet', [['Lotus Cobra', 0.56, 0.6, 'creatures'], ['Zuran Orb', 0.45, 0.47, 'utilityartifacts'], ['Sol Ring', -0.21, 0.58, 'manaartifacts'], ['Bloodghast', 0.12, 0.3, 'creatures']]);
            editing = { name: 't', format: 'commander', commander: C['Nog, Ambitious Cadet'].id, cards: { [C['Sol Ring'].id]: 1, [C['Bloodghast'].id]: 1 }, starter: true };
            ok('a high-synergy card gets the green "on plan" badge', /mx-syn hi/.test(synBadge(C['Lotus Cobra'])) && /\.56/.test(synBadge(C['Lotus Cobra'])), synBadge(C['Lotus Cobra']));
            ok('a staple is marked generic (negative)', /mx-syn lo/.test(synBadge(C['Sol Ring'])) && /−\.21/.test(synBadge(C['Sol Ring'])), synBadge(C['Sol Ring']));
            ok('a middling card fits', /mx-syn mid/.test(synBadge(C['Bloodghast'])));
            ok('basic lands and the commander get no badge', synBadge(C['Forest']) === '' && synBadge(C['Nog, Ambitious Cadet'], true) === '');
            ok('the row of a deck card shows its badge', /mx-syn/.test(bxRowHTML(C['Sol Ring'], 1)));
            const miss = synMissing(editing).map(e => e.name);
            ok('the missing list holds the high-synergy cards not in the deck', miss.includes('Lotus Cobra') && miss.includes('Zuran Orb') && !miss.includes('Sol Ring') && !miss.includes('Bloodghast'), miss);
            const html = synPanelHTML(editing);
            ok('the panel says how many cards are on plan and lists the missing ones', /Fits the commander/.test(html) && /<b>0<\/b> of 2/.test(html) && /Lotus Cobra/.test(html), html.slice(0, 200));
            SYN.state = 'none'; SYN.map = null;
            ok('with no EDHREC data the panel and badges are empty', synPanelHTML(editing) === '' && synBadge(C['Lotus Cobra']) === '');
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('synbadge', results); writeOut('synbadge', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
