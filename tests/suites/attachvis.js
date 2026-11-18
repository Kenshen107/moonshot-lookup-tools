// Equipment and Auras on a creature stay readable on phones (2026-11-19, owner: "I can't see equipment equipped to a creature"):
// compact tiles and cards show a named chip for each attachment, and the Board overview lists attached permanents.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    for (const [w, ht] of [[360, 740], [412, 915], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: ht });
        const r = await page.evaluate(async () => {
            const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
            try {
                const raw = await (await fetch('/__cards.json')).json(); const C = {};
                const names = ['Island', 'Tyrox, Saurid Tyrant', 'Grizzly Bears', 'Hill Giant', 'Sword of the Paruns', 'Umbral Mantle', 'Pacifism'];
                raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
                const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
                await newGame(mk(), mk()); T.clear(); G.turn = 7; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
                const [A] = G.players; A.isAI = false;
                const put = (n) => { const o = makeObj(C[n], A.i); putOntoBattlefield(A, o); o.sick = false; return o; };
                const bears = put('Grizzly Bears'); const gi = put('Hill Giant');
                const sw = put('Sword of the Paruns'); sw.attachedTo = bears.uid;
                const mantle = put('Umbral Mantle'); mantle.attachedTo = bears.uid;
                const pac = put('Pacifism'); pac.attachedTo = gi.uid;
                for (let i = 0; i < 20; i++) put('Hill Giant'); // crowd the row so tiles go compact
                $('game').classList.remove('hidden');
                for (const style of ['open', 'classic']) {
                    setBoardStyle(style); renderGame(); fitTable();
                    const chips = [...document.querySelectorAll('#meSide .att-chip')];
                    const vis = chips.filter(c => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return r.width > 20 && r.height > 8 && cs.visibility !== 'hidden' && c.offsetParent; });
                    ok(`${style}: 3 attachment chips exist`, chips.length === 3, chips.length);
                    ok(`${style}: at least the compact/phone chips are visible (${vis.length})`, innerWidth >= 600 && !document.querySelector('#meSide .lane.compact') ? true : vis.length === 3, vis.map(c => c.textContent));
                    ok(`${style}: chip names the equipment`, chips.some(c => /Sword of the Paruns/.test(c.textContent)) && chips.some(c => /Pacifism/.test(c.textContent)));
                }
                setBoardStyle('open'); renderGame(); fitTable();
                const compact = !!document.querySelector('#meSide .lane.compact');
                if (compact) { const c = document.querySelector('#meSide .att-chip'); ok('chip is tappable', c && c.onclick, null); }
                boardOverview(0);
                const txt = document.querySelector('.ov-body, #boardOv, .modal')?.innerText || document.body.innerText;
                ok('Board overview lists the attached Sword', /Sword of the Paruns/.test(txt) && /Equipment and Auras \(attached\)/.test(txt), txt.slice(0, 200));
                ok('Board overview says what it is attached to', /on Grizzly Bears/.test(txt), null);
                const sx = document.documentElement.scrollWidth - document.documentElement.clientWidth;
                ok('no sideways scroll', sx <= 0, sx);
            } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 400)]); }
            return out;
        });
        results.push(...formatChecks(r.map(([l, o, d]) => [`${w}px: ${l}`, o, d])));
    }
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('attachvis', results); writeOut('attachvis', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
