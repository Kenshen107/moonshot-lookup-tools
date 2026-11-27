// Cosmetics Locker, sleeves and table companions (2026-11-27, Batch 1 of docs/spellslinger-asset-plan.md;
// spellslinger/04j-cosmetics.js, 08i-companion.js). Checks: the Locker's tabs, buying with the main bucket's coins (two taps, not enough
// coins, Sandbox coins don't pay), sleeves on the table (yours, per deck, the computer's own), the Ember Drake companion in a game (built
// from its parts, kept off the cards, reacting to life changes and the end of the game, removed when switched off), no sideways scroll
// at 360 and 1280px. Screenshots: tests/.out/cosmetics-*.png.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    // the harness blocks pictures; let the game's own art through so the companion can be built and the screenshots show it
    await h.ctx.route(/spellslinger\.test\/.*spellslinger\/art\/.*\.(png|jpg)/, r => {
        const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, '');
        const f = path.join(ROOT, rel);
        if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
        r.fulfill({ status: 200, contentType: /\.png$/.test(f) ? 'image/png' : 'image/jpeg', body: fs.readFileSync(f) });
    });
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const r1 = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            if ((profile.bucket || 'main') !== 'main') swapBucket('main');
            profile.cosmetics = {}; profile.coins = 1000;
            lookPanel();
            const lk = document.querySelector('#modalHost .locker');
            ok('the 🎨 button opens the Locker', !!lk);
            ok('it has 5 tabs (Looks, Sleeves, Playmats, Companions, Coming soon)', document.querySelectorAll('#modalHost .locker-tab').length === 5);
            ok('Looks tab shows the looks', !!document.querySelector('#modalHost .look-grid'));
            lockerPanel('mats'); ok('Playmats tab shows the battlefields', !!document.querySelector('#modalHost .mat-grid'));
            lockerPanel('sleeves'); ok('Sleeves tab shows every sleeve', document.querySelectorAll('#modalHost .cos-card').length === COSMETICS.filter(c => c.slot === 'sleeve').length);
            ok('a free sleeve is owned and in use', cosOwns('classic') && !!document.querySelector('#modalHost .cos-card.on[data-cos="classic"]'));
            cosBuy('ember-weave');
            ok('the first tap only asks to confirm', !cosOwns('ember-weave') && profile.coins === 1000 && /Tap again/.test(document.querySelector('#modalHost [data-cos="ember-weave"] .cos-buy').textContent));
            cosBuy('ember-weave');
            ok('the second tap buys it for 300 coins and puts it on', cosOwns('ember-weave') && profile.coins === 700 && cosState().sleeve === 'ember-weave', profile.coins);
            cosBuy('gilded-sanctum'); cosBuy('gilded-sanctum');
            ok('with 700 coins a 1,000-coin sleeve is not bought', !cosOwns('gilded-sanctum') && profile.coins === 700);
            // Sandbox coins don't pay; the main bucket's do, wherever they are parked
            swapBucket('sandbox'); profile.coins = 99999; profile.stash.main.coins = 1300;
            ok('in Sandbox the Locker shows the main bucket coins', cosCoins() === 1300);
            cosBuy('gilded-sanctum'); cosBuy('gilded-sanctum');
            ok('buying in Sandbox spends Campaign and Shop coins, not Sandbox coins', cosOwns('gilded-sanctum') && profile.stash.main.coins === 300 && profile.coins === 99999, [profile.stash.main.coins, profile.coins]);
            swapBucket('main'); profile.coins = 5000;
            cosEquip('ember-weave');
            cosBuy('ember-drake'); cosBuy('ember-drake');
            ok('the Ember Drake is bought and put on', cosOwns('ember-drake') && cosState().companion === 'ember-drake' && profile.coins === 4000, profile.coins);
            lockerPanel('companions');
            await new Promise(r => setTimeout(r, 400));
            ok('the Companions tab shows a live preview built from the parts', document.querySelectorAll('#modalHost .cos-comp .comp-stage .comp-part').length === 5);
            ok('the Locker has no sideways scroll at 1280px', document.documentElement.scrollWidth <= innerWidth + 1);
        } catch (e) { out.push(['locker threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r1);
    try { await page.screenshot({ path: path.join(ROOT, 'tests', '.out', 'cosmetics-locker-1280.png') }); } catch (e) { /* ignore */ }
    await page.setViewportSize({ width: 360, height: 760 });
    const r2 = await page.evaluate(async () => { lockerPanel('sleeves'); await new Promise(r => setTimeout(r, 200)); return [['the Locker has no sideways scroll at 360px', document.documentElement.scrollWidth <= innerWidth + 1, document.documentElement.scrollWidth]]; });
    results.push(...formatChecks(r2));
    try { await page.screenshot({ path: path.join(ROOT, 'tests', '.out', 'cosmetics-locker-360.png') }); } catch (e) { /* ignore */ }
    await page.setViewportSize({ width: 1280, height: 800 });
    const r3 = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            closeModal(); window.__COMP_FORCE = true;
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            ['Island', 'Forest', 'Tyrox, Saurid Tyrant', 'Grizzly Bears', 'Hill Giant'].forEach(n => { const c = raw.find(x => x.name === n && x.type_line); if (c) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[n] = sc; } });
            const mk = n => ({ name: n, format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk('My Deck'), mk('Their Deck')); T.clear(); G.turn = 7; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0;
            G.players[0].isAI = false; G.players[1].char = { key: 'marcus' };
            for (let k = 0; k < 6; k++) { const o = makeObj(C[k % 2 ? 'Hill Giant' : 'Grizzly Bears'], 0); putOntoBattlefield(G.players[0], o); o.sick = false; }
            for (let k = 0; k < 4; k++) G.players[0].hand.push(makeObj(C['Grizzly Bears'], 0));
            $('game').classList.remove('hidden'); setBoardStyle('open'); renderGame(); fitTable();
            await new Promise(r => setTimeout(r, 500));
            const myPile = document.querySelector('#meBar .pile-deck, #myBar .pile-deck') || [...document.querySelectorAll('.pile-deck')].find(e => !e.closest('#oppBar'));
            ok('your library pile wears your sleeve', myPile && myPile.dataset.sleeve === 'ember-weave', myPile && myPile.outerHTML.slice(0, 160));
            ok('the computer wears its own sleeve (Marcus: Tide Weave)', sleeveIdFor(G.players[1]) === 'tide-weave' && !!document.querySelector('[data-sleeve="tide-weave"]'));
            cosDeckSleeve('My Deck', 'gilded-sanctum');
            ok('a deck can have its own sleeve', sleeveIdFor(G.players[0]) === 'gilded-sanctum');
            cosDeckSleeve('My Deck', 'default'); ok('...and go back to the usual one', sleeveIdFor(G.players[0]) === 'ember-weave');
            companionSync();
            await new Promise(r => setTimeout(r, 600));
            const dock = document.getElementById('companionDock');
            ok('the companion is on the table', !!dock && dock.querySelectorAll('.comp-part').length === 5);
            const imgsOk = dock && [...dock.querySelectorAll('img')].every(i => i.complete && i.naturalWidth === 512);
            ok('all its parts loaded', imgsOk);
            const db = dock.getBoundingClientRect();
            const hit = [...document.querySelectorAll('#game .perm, #game .hc, #game .pile-deck, #game #turnBtn')].filter(e => { const b = e.getBoundingClientRect(); return b.width && !(b.right <= db.left || b.left >= db.right || b.bottom <= db.top || b.top >= db.bottom); }).map(e => e.className || e.id);
            ok('it does not cover cards, the hand, the library or the turn button', hit.length === 0, hit.slice(0, 4));
            ok('it found a free spot (not ducked out of sight)', !dock.classList.contains('ducked'));
            ok('it is inside the window', db.left >= 0 && db.bottom <= innerHeight && db.width > 60, [db.left, db.top, db.width, db.height]);
            const ctl = COMP.ctl; const wait = ms => new Promise(r => setTimeout(r, ms));
            G.players[0].life -= 3; await wait(150); ok('you lose life: it flinches', ctl.act && ctl.act.kind === 'hurt');
            await wait(900); G.players[1].life -= 4; await wait(150); ok('an opponent loses life: it cheers', ctl.act && ctl.act.kind === 'cheer');
            await wait(1400); G.players[0].life += 2; await wait(150); ok('you gain life: it is happy', ctl.act && ctl.act.kind === 'happy');
            await wait(1200); fire('cast', { P: G.players[0], o: G.players[0].hand[0] }); ok('you cast a spell: it perks up', ctl.act && ctl.act.kind === 'perk');
            await wait(1000); ctl.el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); ok('tapping it pets it', ctl.act && ctl.act.kind === 'happy');
            await wait(300);
            out.push(['__shot', true]);
        } catch (e) { out.push(['game threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    results.push(...formatChecks(r3.filter(x => x[0] !== '__shot')));
    try { await page.screenshot({ path: path.join(ROOT, 'tests', '.out', 'cosmetics-table-1280.png') }); } catch (e) { /* ignore */ }
    await page.setViewportSize({ width: 360, height: 760 });
    const r4 = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]); const wait = ms => new Promise(r => setTimeout(r, ms));
        try {
            renderGame(); fitTable(); await wait(500);
            const dock = document.getElementById('companionDock'), db = dock.getBoundingClientRect();
            const hit = [...document.querySelectorAll('#game .perm, #game .hc, #game #turnBtn')].filter(e => { const b = e.getBoundingClientRect(); return b.width && !(b.right <= db.left || b.left >= db.right || b.bottom <= db.top || b.top >= db.bottom); }).map(e => e.className || e.id);
            ok('360px: the companion is small and covers no cards, hand or turn button', db.width <= 80 && hit.length === 0, [db.width, hit.slice(0, 4)]);
            ok('360px: it found a free spot', !dock.classList.contains('ducked'));
            ok('360px: no sideways scroll', document.documentElement.scrollWidth <= innerWidth + 1);
            out.push(['__shot', true]);
        } catch (e) { out.push(['phone threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    results.push(...formatChecks(r4.filter(x => x[0] !== '__shot')));
    try { await page.screenshot({ path: path.join(ROOT, 'tests', '.out', 'cosmetics-table-360.png') }); } catch (e) { /* ignore */ }
    await page.setViewportSize({ width: 1280, height: 800 });
    const r5 = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]); const wait = ms => new Promise(r => setTimeout(r, ms));
        try {
            G.players.slice(1).forEach(P => { P.out = true; }); G.winner = G.players[0]; G.over = true; await wait(200);
            ok('you win: it celebrates', COMP.ctl && COMP.ctl.act && COMP.ctl.act.kind === 'win');
            G.over = false; cosEquip('none'); await wait(100);
            ok('switched off, it leaves the table', !document.getElementById('companionDock'));
            closeModal();
        } catch (e) { out.push(['end threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    results.push(...formatChecks(r5));
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('cosmetics', results); writeOut('cosmetics', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
