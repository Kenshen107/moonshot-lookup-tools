// Pack looks: every pack tier has its own wrapper and opening animation; Ascent boosters tear open the same way; pixel art is optional.
'use strict';
const fs = require('fs'), path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch();
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        const wait = ms => new Promise(res => setTimeout(res, ms));
        try {
            const raw = await (await fetch('/__cards.json')).json();
            ensureProfile();
            const set = (code, released, type) => ({ code, releaseDate: released, type });
            const mk = (code, released, type, name) => ({ name: name || 'Play Booster', set: { ...set(code, released, type), name: code.toUpperCase() }, cards: [] });
            // ---- which look a pack gets ----
            const want = {
                'lea Alpha': [mk('lea', '1993-08-05', 'core'), 'power'], 'leb Beta': [mk('leb', '1993-10-04', 'core'), 'power'], '2ed Unlimited': [mk('2ed', '1993-12-01', 'core'), 'early'],
                'Mirage (1996)': [mk('mir', '1996-10-08', 'expansion'), 'vintage'], 'Onslaught (2002)': [mk('ons', '2002-10-07', 'expansion'), 'classic'],
                'Modern Masters': [mk('mma', '2013-06-07', 'masters'), 'masters'], 'Duskmourn play': [mk('dsk', '2024-09-27', 'expansion'), 'standard'],
                'Duskmourn collector': [mk('dsk', '2024-09-27', 'expansion', 'Collector Booster'), 'collector']
            };
            const bad = [];
            for (const [n, [p, k]] of Object.entries(want)) { const got = packLookKey(p); if (got !== k) bad.push(`${n}: ${got} (wanted ${k})`); }
            ok('each pack tier gets its own look', bad.length === 0, bad);
            ok('a box result (best hits) gets the gold collector look', packLookKey({ isHits: true, set: set('dsk', '2024-09-27', 'expansion') }) === 'collector');
            ok('seven looks, each with its own animation', Object.keys(PACK_LOOKS).length === 7 && new Set(Object.values(PACK_LOOKS).map(l => l.anim)).size === 7);
            ok('every look has a label, timing and art prompts', Object.values(PACK_LOOKS).every(l => l.label && l.ms[0] < l.ms[1] && l.wrap.length > 20 && l.open.length > 20));
            // ---- the reveal wrapper carries its look and opens with the matching animation ----
            const dsk = raw.filter(c => c.set === 'dsk' && c.rarity === 'common').slice(0, 3);
            const cards = dsk.map(c => ({ card: slimCard(c), foil: false, id: c.id }));
            const html = document.createElement('div'); html.id = 'packArea'; document.body.appendChild(html);
            renderPackReveal({ name: 'Collector Booster', set: set('dsk', '2024-09-27', 'expansion'), cards });
            const el = document.querySelector('#packArea .pack3d');
            ok('the reveal wrapper has the collector look', el && el.dataset.look === 'collector');
            ok('the wrapper still has a flap, a body and a burst layer', el && !!el.querySelector('.pk-flap') && !!el.querySelector('.pk-body') && !!el.querySelector('.pk-burst'));
            peelPack('packArea');
            ok('tearing it open starts the collector animation (burst)', el.classList.contains('peeling') && el.classList.contains('anim-burst'));
            await wait(PACK_LOOKS.collector.ms[1] + 400);
            ok('the card stack shows after the animation', !document.getElementById('ss-packArea').classList.contains('hidden') && el.classList.contains('hidden'));
            // each look names a different animation class
            const classes = [];
            for (const k of Object.keys(PACK_LOOKS)) {
                const area = document.createElement('div'); area.innerHTML = packWrapperHTML(k, 'TST', 't', 's'); const p = area.firstElementChild; document.body.appendChild(p);
                packTear(p); classes.push([...p.classList].find(c => c.startsWith('anim-'))); p.remove();
            }
            ok('every look opens with its own animation class', new Set(classes).size === 7, classes);
            // ---- optional pixel art ----
            const q = document.createElement('div'); q.innerHTML = packWrapperHTML('vintage', 'X', 't', 's'); const pe = q.firstElementChild;
            packApplyArt(pe, 'vintage');
            ok('without art files nothing changes', !pe.classList.contains('has-art') || PACK_ART.wrap.vintage);
            PACK_ART.wrap.vintage = true; PACK_ART.open.vintage = true; packApplyArt(pe, 'vintage');
            ok('with art files the wrapper uses the sprite and burst', pe.classList.contains('has-art') && pe.classList.contains('has-open') && /vintage\.png/.test(pe.style.getPropertyValue('--pk-art')) && /vintage-open\.png/.test(pe.style.getPropertyValue('--pk-open')));
            PACK_ART.wrap.vintage = false; PACK_ART.open.vintage = false;
            // ---- Ascent boosters tear open first ----
            ensureProfile(); profile.ascent = null; await loadAscentRoster();
            window.__PK_FORCE = true;
            const st = ascentState(); st.sealed = { play: 1, collector: 1 };
            const ids = (openAscentPack('play').picks || []).slice(0, 0);
            ASC.tab = 'packs'; $('ascBody') || (document.body.insertAdjacentHTML('beforeend', '<div id="ascBody"></div>'));
            await ascOpenPack('play');
            ok('an Ascent pack shows a wrapper to tear open, not the cards', !!document.querySelector('#ascReveal .pack3d') && !document.querySelector('#ascReveal .asc-flip'));
            ok('the Play Booster wrapper has the standard look and the Collector the gold one', document.querySelector('#ascReveal .pack3d').dataset.look === 'standard');
            ascTear();
            await wait(PACK_LOOKS.standard.ms[1] + 400);
            ok('after the tear the cards show face down', document.querySelectorAll('#ascReveal .asc-flip').length >= 10);
            await ascOpenPack('collector');
            ok('a Collector Booster uses the collector look', document.querySelector('#ascReveal .pack3d') && document.querySelector('#ascReveal .pack3d').dataset.look === 'collector');
            window.__PK_FORCE = false;
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('packlooks', results, []);
    await h.close();
})();
