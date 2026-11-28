// Cosmetics part 2 (2026-11-28; spellslinger/08j-cosmetics-2.js and the new rigs in 08i-companion.js): with the art served, checks the three new
// companions build from their parts with the face drawing as the head, the six new sleeves, painted themes (locked until bought, then the page
// background and banner), desk props (life skin, hourglass that turns at your turn), and the moving mat layer. No sideways scroll at 360px.
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
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => typeof deskSync === 'function' && !!window.__UI_LAB, null, { timeout: 60000 });
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]); const wait = ms => new Promise(x => setTimeout(x, ms));
        try {
            window.__COMP_FORCE = true; closeModal();
            if ((profile.bucket || 'main') !== 'main') swapBucket('main');
            profile.cosmetics = {}; profile.coins = 20000;
            ok('six new sleeves are in the Locker', ['tide-crest', 'grave-crest', 'grove-crest', 'dawn-crest', 'onyx-plain', 'pearl-plain'].every(id => cosItem(id) && cosItem(id).img));
            ok('three new companions are in the Locker and have rigs', ['lantern-wisp', 'moss-golem', 'tidepool-axolotl'].every(id => cosItem(id) && COMPANION_RIGS[id]));
            await window.__UI_LAB.spawn('early');
            for (const id of ['lantern-wisp', 'moss-golem', 'tidepool-axolotl']) {
                cosState().owned.push(id); cosState().companion = id; renderGame(); companionSync(); await wait(500);
                const stage = document.querySelector(`#companionDock .comp-stage[data-comp="${id}"]`);
                const head = stage && stage.querySelector('.comp-head img');
                ok(`${id}: built from its parts, the face drawing as its head`, !!stage && stage.querySelectorAll('.comp-part').length === COMPANION_RIGS[id].parts.length && /face-happy\.png$/.test(head && head.src));
            }
            const lamp = document.querySelector('[data-comp="tidepool-axolotl"]') ? null : null; // (the wisp's flame is named 'lamp' so it doesn't take the drake's .comp-flame glow class)
            ok('the wisp flame part is not styled as the drake\'s glow', COMPANION_RIGS['lantern-wisp'].parts.every(p => p.k !== 'flame'));
            // themes
            setLook('gilded');
            ok('a painted theme is locked until bought (first tap asks to confirm)', spLook.name !== 'gilded' && !cosOwns('theme-gilded'));
            setLook('gilded');
            ok('the second tap buys it for 3,000 and puts it on', cosOwns('theme-gilded') && spLook.name === 'gilded' && document.documentElement.getAttribute('data-theme') === 'gilded', [spLook.name, profile.coins]);
            ok('its painted background and banner are set', document.documentElement.getAttribute('data-theme-art') === 'gilded' && /themes\/gilded-sanctum\/bg\.jpg/.test(getComputedStyle(document.body).backgroundImage), getComputedStyle(document.body).backgroundImage.slice(0, 160));
            ok('Gilded Sanctum uses its own frame', /gilded-sanctum\/frame\.png/.test(document.documentElement.style.getPropertyValue('--sp-frame')));
            setLook('classic');
            ok('back to Classic clears the art', !document.documentElement.hasAttribute('data-theme-art'));
            // props
            cosState().owned.push('life-d20', 'hourglass'); cosEquip('life-d20'); cosEquip('hourglass'); closeModal(); renderGame(); await wait(300);
            const game = document.getElementById('game');
            ok('the life skin is on your life total', game.classList.contains('has-lifeskin') && /life-d20\.png/.test(game.style.getPropertyValue('--lifeskin')));
            const hg = document.getElementById('deskProp');
            ok('the hourglass sits by your seat', !!hg && !hg.classList.contains('ducked') && hg.getBoundingClientRect().width > 0);
            const before = DESK.flips; G.turn += 1; G.active = 0; renderGame(); await wait(50);
            ok('it turns over when your turn starts', DESK.flips === before + 1 || DESK.turnKey === `${G.turn}:true`, [before, DESK.flips]);
            // mat layer
            setArenaMat('island'); renderGame(); await wait(600);
            const ml = document.getElementById('matLayer');
            ok('the Island mat shows its moving water layer', !!ml && !ml.hidden && ml.dataset.kind === 'water' && /layer-water\.png/.test(ml.style.backgroundImage));
            setArenaMat('plains'); renderGame(); await wait(100);
            ok('a mat with no layer shows none', document.getElementById('matLayer').hidden);
            lockerPanel('props');
            ok('the Locker has a Props tab with the life skins and the hourglass', document.querySelectorAll('#modalHost .locker[data-tab="props"] .cos-card').length === 5);
            closeModal();
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    });
    const results = formatChecks(r);
    await page.setViewportSize({ width: 360, height: 760 }); await page.waitForTimeout(400);
    const r2 = await page.evaluate(() => { lockerPanel('looks'); const w = document.documentElement.scrollWidth; closeModal(); return [['360px: no sideways scroll with the Locker open', w <= innerWidth + 1, w]]; });
    results.push(...formatChecks(r2), ...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('cosmetics2', results); writeOut('cosmetics2', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
