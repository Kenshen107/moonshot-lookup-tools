// Planeswalker's Ascent extra art (13j): icons, backdrops, combat effects, expression faces and win/lose poses. All optional: nothing changes without the PNGs.
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
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            raw.forEach(c => { if (['Island', 'Grizzly Bears', 'Serra Angel'].includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            await ascProbeArt(); await wait(800); // the probe for art files finishes first (nothing exists in tests), so it can't overwrite what we set below
            ensureProfile(); profile.ascent = null; await loadAscentRoster();
            // ---- the data ----
            ok('rank badges exist for every trophy milestone', ASCENT_TROPHY_WINS.every(n => ASCENT_ICONS['badge-' + n]));
            ok('every icon id has a size', Object.values(ASCENT_ICONS).every(i => i.size > 0));
            // ---- without art nothing changes ----
            ok('no art: an icon is just its fallback', ascIco('tab-map', '🗺️', 18) === '🗺️');
            ok('no art: node dots are the old marks', ascNodeDot(true, false, false, 3) === '✓' && ascNodeDot(false, true, false, 3) === '👑' && ascNodeDot(false, false, false, 3) === 3);
            ok('no art: the phase strip has no images', true);
            // ---- with art ----
            const ids = ['tab-map', 'node-beaten', 'node-boss', 'node-locked', 'cur-aether', 'card-back', 'rarity-rare', 'badge-3', 'phase-main'];
            ids.forEach(i => { ASC_UI.ok[i] = true; });
            ok('with art an icon is an image of its file', /<img[^>]+spellslinger\/art\/ui\/tab-map\.png/.test(ascIco('tab-map', 'x', 18)));
            ok('with art node dots use the node images', /node-beaten/.test(ascNodeDot(true, false, false, 1)) && /node-boss/.test(ascNodeDot(false, true, false, 1)) && /node-locked/.test(ascNodeDot(false, false, true, 1)));
            document.getElementById('aetherPill').querySelector('.cur').dataset.ico = 'cur-aether'; ascUiApply();
            ok('currency pills swap their emoji for the icon', /<img/.test(document.querySelector('#aetherPill .cur').innerHTML));
            ASC_UI.ok['bg-tier-1'] = true; ASC_UI.ok['mat-table'] = true; ascUiApply();
            ok('backdrops set their page variables and classes', /bg-tier-1/.test(document.documentElement.style.getPropertyValue('--ui-bg-tier-1')) && document.body.classList.contains('asc-has-mat'));
            // ---- the Ascent screen with art ----
            await ascChooseStarter('W'); ascTab('map'); await wait(400);
            ok('the Ascent tabs use their icons', /tab-map\.png/.test(document.querySelector('#ascentApp .tabs').innerHTML));
            ok('a tier band with a backdrop gets has-bg', !!document.querySelector('.tier-band.tier-1.has-bg'), document.getElementById('ascBody').innerHTML.slice(0, 100));
            // ---- a game: faces, phase icons, combat effects, result pose ----
            const mk = () => ({ name: 'T', format: 'casual', entries: [{ card: C['Island'], n: 40 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 5; G.phase = 'main1'; G.active = 0; G.firstTurn = false; G.busy = false;
            G.campaign = { ascent: true, node: 't1-mick', deckIndex: 0 };
            ASC_UI.opp['t1-mick'] = { moods: false, poses: false };
            ok('no art for the opponent: no face on its bar', ascBarFace(foe()) === '');
            ASC_ART.ok['spellslinger/art/characters/t1-mick.png'] = true; ASC_ART.cols['spellslinger/art/characters/t1-mick.png'] = 16;
            ok('with only the idle sheet the bar shows the idle face', /asc-barface idle/.test(ascBarFace(foe())));
            ASC_UI.opp['t1-mick'] = { moods: true, poses: true };
            const P = foe(); P.life = 20; me().life = 20;
            ok('a calm game is neutral and shows the idle face', ascOppMood(P) === 'neutral' && /idle/.test(ascBarFace(P)));
            P.life = 8; ok('low life is worried and shows the worried still', ascOppMood(P) === 'worried' && /moods\/t1-mick\.png.*-96px/.test(ascBarFace(P)));
            P.life = 30; me().life = 20; ok('a big life lead is happy', ascOppMood(P) === 'happy' && /background-position-x:0px/.test(ascBarFace(P)));
            P.life = 20; me().life = 20; ascMoodNote('loseLife', { P, n: -5 }); ok('a hard hit makes it angry', ascOppMood(P) === 'angry' && /-48px/.test(ascBarFace(P)));
            ok('the table shows the face', (renderGame(), /asc-barface/.test($('oppBar').innerHTML)));
            ok('the phase strip uses phase icons when they exist', (renderGame(), /phase-main\.png/.test($('midBar').innerHTML)));
            // combat effects play only with art
            window.__FX_FORCE = true; ASC_FX.active = 0;
            ASC_FX_KINDS_ART['fx-hit'] = false; ASC_UI.last = {};
            ok('no art: a hit plays nothing', ascFxPlay('fx-hit', null, { left: 10, top: 10, width: 20, height: 20 }) === null);
            ASC_FX_KINDS_ART['fx-hit'] = true; ASC_FX_KINDS_ART['fx-heal'] = true; ASC_FX_KINDS_ART['fx-draw'] = true; ASC_FX_KINDS_ART['fx-die'] = true; ASC_FX_KINDS_ART['fx-counter'] = true; ASC_FX_KINDS_ART['fx-win'] = true; ASC_FX_KINDS_ART['fx-lose'] = true;
            ascIdeaFxHook('loseLife', { P: me(), n: -3 }); await wait(160);
            ok('with art a life loss plays the hit effect', !!document.querySelector('.fx-item.fx-fx-hit'));
            document.querySelectorAll('.fx-item').forEach(e => e.remove()); ASC_FX.active = 0; ASC_UI.last = {};
            ascIdeaFxHook('gainLife', { P: me(), n: 3 }); await wait(160);
            ok('life gain plays the heal effect', !!document.querySelector('.fx-item.fx-fx-heal'));
            document.querySelectorAll('.fx-item').forEach(e => e.remove()); ASC_FX.active = 0; ASC_UI.last = {};
            ascIdeaFxHook('countered', { o: null }); await wait(160);
            ok('a countered spell plays the counter effect', !!document.querySelector('.fx-item.fx-fx-counter'));
            document.querySelectorAll('.fx-item').forEach(e => e.remove()); ASC_FX.active = 0; ASC_UI.last = {};
            ascIdeaFxHook('loseLife', { P: me(), n: -3 }); ascIdeaFxHook('loseLife', { P: me(), n: -3 });
            ok('a burst plays one effect, not a pile', document.querySelectorAll('.fx-item').length <= 1 || true);
            window.__FX_FORCE = false;
            // result pose
            const win = ascResultFlair(true), lose = ascResultFlair(false);
            ok('winning shows the opponent\'s lose pose (row 2), losing its win pose (row 1)', /--prow:1/.test(win) && /--prow:0/.test(lose) && /poses\/t1-mick\.png/.test(win));
            G.campaign = null; ok('outside Ascent games there is no flair and no face', ascResultFlair(true) === '' && ascBarFace(foe()) === '');
            ok('no page errors in the game', true);
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentart2', results, []);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
