// MTG tool: the Realm background, pixel lettering and seasonal frames (2026-10-21). Standalone (the page is opened from disk, nothing is fetched):
//   node tests/mtg_fx.js
'use strict';
const path = require('path');
const { chromium } = (() => { for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean)) { try { return require(m); } catch (e) { /* next */ } } throw new Error('Playwright not found; set PLAYWRIGHT_MODULE'); })();
const PAGE = 'file://' + path.resolve(__dirname, '..', 'MTG_Lookup_Tool.html');
(async () => {
    const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
    const results = [], ok = (l, c, d) => results.push([l, !!c, d]), errs = [];
    const open = async (q, w = 1280, h = 800) => { const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on('pageerror', e => errs.push(String(e).slice(0, 200))); await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort()); await p.goto(PAGE + q); await p.waitForTimeout(1800); return p; };
    const p = await open('?realm=castle&theme=wonderland');
    const lv = await p.evaluate(async () => {
        const out = {}; const set = l => { document.documentElement.setAttribute('data-fx', l); pxFlairRefresh(); };
        set('full'); out.full = { realm: getComputedStyle(document.getElementById('fxRealm')).display, letters: !!document.querySelector('#pageTitle .px-letters'), frame: !!getComputedStyle(document.documentElement).getPropertyValue('--px-panel-frame').trim(), banner: !!getComputedStyle(document.documentElement).getPropertyValue('--px-banner-frame').trim() };
        set('subtle'); out.subtle = { realm: getComputedStyle(document.getElementById('fxRealm')).display, letters: !!document.querySelector('#pageTitle .px-letters') };
        set('off'); out.off = { realm: getComputedStyle(document.getElementById('fxRealm')).display, letters: !!document.querySelector('#pageTitle .px-letters'), title: document.getElementById('pageTitle').textContent.trim() };
        set('full'); switchGame(Object.keys(APP_VIEWS)[1]); await new Promise(r => setTimeout(r, 300)); out.switched = (document.querySelector('#pageTitle .px-letters') || { getAttribute: () => '' }).getAttribute('aria-label');
        return out;
    });
    ok('Full shows the Realm, lettering and frames', lv.full.realm === 'block' && lv.full.letters && lv.full.frame && lv.full.banner, lv.full);
    ok('Subtle keeps lettering and frames but not the Realm', lv.subtle.realm === 'none' && lv.subtle.letters, lv.subtle);
    ok('Off is plain: the title text comes back', lv.off.realm === 'none' && !lv.off.letters && /MTG Card Lookup/.test(lv.off.title), lv.off);
    ok('switching tabs re-letters the title and keeps its text for screen readers', !!lv.switched && lv.switched.length > 3, lv.switched);
    const biomes = await p.evaluate(() => { const names = []; pxrSize(); REALM.pal = pxrPal(); for (let i = 0; i < 4; i++) { const L = pxrBuildBiome(REALM.biomes[i], REALM.pal, REALM.W, REALM.H, i); const c = document.createElement('canvas'); c.width = REALM.W; c.height = REALM.H; pxrDrawBiome(c.getContext('2d'), L, 30000 + i * 7000, REALM.W, REALM.H); names.push(c.getContext('2d').getImageData(5, 5, 1, 1).data[3] === 255); } return names; });
    ok('all four biomes build and paint', biomes.every(Boolean), biomes);
    const perf = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 40; i++) pxrPaint(40000 + i * 41); return (performance.now() - t0) / 40; });
    ok('a Realm frame paints in under 4 ms', perf < 4, perf.toFixed(2) + ' ms');
    const art = await p.evaluate(async () => {
        const img = (w, h, col) => new Promise(res => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, w, h); const i = new Image(); i.onload = () => res(i); i.src = c.toDataURL(); });
        PX.letterImg.gold = await img(36 * 32, 32, '#d4a017'); const cv = pxlCanvas('AB 1', { fx: null });
        PX.art['frame-panel-default'] = true; document.documentElement.setAttribute('data-theme', ''); pxfRefresh();
        REALM.art['castle-far'] = await img(320, 180, '#335577'); REALM.cur = 0; REALM.built = null; pxrPaint(performance.now());
        return { cell: cv.dataset.cell, w: cv.width, frame: getComputedStyle(document.documentElement).getPropertyValue('--px-panel-frame').trim().slice(0, 36) };
    });
    ok('generated art replaces the drawn lettering, frame and Realm layer when present', art.cell === '1' && art.w > 0 && /frame-panel-default/.test(art.frame), art);
    const cd = await p.evaluate(async () => {
        const set = l => { document.documentElement.setAttribute('data-fx', l); pxFlairRefresh(); };
        const out = {}; set('full'); await new Promise(r => setTimeout(r, 200));
        const vis = () => { const c = document.getElementById('cardy'); return !!c && getComputedStyle(c).display !== 'none'; };
        out.full = vis(); cardySay('Hello <b>there</b>', { stay: true }); await new Promise(r => setTimeout(r, 400));
        const b = document.getElementById('cardyBubble'); out.bubble = !b.hidden && !b.querySelector('b'); cardyClose(); out.closed = b.hidden;
        cardySet(false); out.hidden = !vis() && localStorage.getItem('cardyOff') === '1'; cardySet(true); out.back = vis();
        set('subtle'); out.subtle = vis(); set('off'); out.off = !vis(); set('full'); // off = true means Cardy is hidden at Off
        return out;
    });
    ok('Cardy shows at Full and Subtle, not Off; the bubble escapes text; hiding is remembered', cd.full && cd.subtle && cd.off && cd.bubble && cd.closed && cd.hidden && cd.back, cd);
    await p.mouse.move(100, 100); await p.mouse.move(300, 220, { steps: 10 });
    ok('the cursor trail draws while the mouse moves (Full)', await p.evaluate(() => !!document.getElementById('pxTrail') && TRAIL.pts.length > 0));
    await p.context().close();
    const ph = await open('?theme=halloween', 360, 740);
    const m = await ph.evaluate(() => { switchGame(Object.keys(APP_VIEWS)[1]); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    ok('no sideways scroll at 360px', m.sw <= m.cw, m);
    ok('no page errors', errs.length === 0, errs.slice(0, 3));
    results.forEach(([l, c, d]) => console.log(`${c ? 'PASS' : 'FAIL'} ${l}${c ? '' : ' ' + JSON.stringify(d)}`));
    const bad = results.filter(r => !r[1]).length; console.log(`mtg_fx: ${results.length - bad}/${results.length} passed`);
    await b.close(); process.exit(bad ? 1 : 0);
})();
