// Painted icons, sleeves, mats and drake faces from Antigravity's Batch 2 (2026-11-28): wired in through ascIco (13j-ascent-ui-art.js).
// Checks, with the art served: the menus get their nav icons, the turn rail its phase icons, keyword badges (also ward, toxic,
// protection) the kw- art, seat moods and zones their icons; the mats use their painted pictures (the tall one on a portrait screen).
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    await h.ctx.route(/spellslinger\.test\/.*spellslinger\/art\/.*\.(png|jpg)/, r => {
        const f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, ''));
        if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
        r.fulfill({ status: 200, contentType: /\.png$/.test(f) ? 'image/png' : 'image/jpeg', body: fs.readFileSync(f) });
    });
    const { page, errors } = await openTestPage(h.ctx, h.server, 'format=none');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(() => typeof companionSync === 'function' && !!window.__UI_LAB, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            closeModal(); ASC_ART.probed = false; await ascProbeArt();
            const missing = UI_BATCH2_ICONS.filter(k => !ASC_UI.ok[k]);
            ok('every Batch 2 icon loads', missing.length === 0, missing);
            ok('the Home tab shows the painted home icon', !!document.querySelector('#tab-home > img.asc-ico[src$="nav-home.png"]'));
            ok('the Locker button shows its icon', !!document.querySelector('#lockerBtn > img.asc-ico[src$="nav-locker.png"]'));
            ascUiApply(); ok('applying twice adds no second icon', document.querySelectorAll('#tab-home > img.asc-ico').length === 1);
            await window.__UI_LAB.spawn('keywords'); renderGame();
            ok('keyword badges use the painted art', document.querySelectorAll('#game .kw-ico.has-art img').length > 0);
            ok('the turn rail uses phase icons', !!document.querySelector('.phase-strip.rail img.asc-ico[src*="phase-"]'));
            ok('the library pile uses the zone icon', !!document.querySelector('#game img.asc-ico[src$="zone-library.png"]'));
            const A = G.players[0], c = A.bf.find(isCreature);
            c.tkw.push('ward:2'); renderGame();
            ok('a ward:2 creature gets the ward badge', !!document.querySelector(`#game [data-uid="${c.uid}"] .kw-ward`) || /kw-ward/.test(kwBadgesHTML(c)), kwBadgesHTML(c));
            ok('a mood maps to a painted face', /mood-worried\.png/.test(moodIco('nervous')) && /mood-salty\.png/.test(moodIco('salty')));
            ok('a loyalty counter uses its icon', /ctr-loyalty\.png/.test(counterIco('loyalty')) && !/img/.test(counterIco('oil')));
            await window.__UI_LAB.spawn('pod'); setArenaMat('island'); renderGame();
            const bg = getComputedStyle(document.getElementById('game')).backgroundImage;
            ok('the Island mat shows its painting', /mats\/island\/base\.jpg/.test(bg), bg.slice(0, 200));
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r);
    await page.setViewportSize({ width: 412, height: 900 }); await page.waitForTimeout(300);
    const r2 = await page.evaluate(() => { const bg = getComputedStyle(document.getElementById('game')).backgroundImage; return [['a portrait screen uses the tall mat picture', /mats\/island\/base-phone\.jpg/.test(bg), bg.slice(0, 200)], ['no sideways scroll at 412px', document.documentElement.scrollWidth <= innerWidth + 1, document.documentElement.scrollWidth]]; });
    results.push(...formatChecks(r2), ...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('uiicons', results); writeOut('uiicons', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
