// Planeswalker's Ascent characters, dialogue, placeholder art and in-game effects; Campaign mode keeps everything to itself.
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
        try {
            const raw = await (await fetch('/__cards.json')).json();
            ensureProfile(); profile.ascent = null;
            await loadAscentRoster();
            const byName = n => slimCard(raw.find(c => c.name === n));
            // ---- characters ----
            ok('every opponent has a character with intro, win, lose, taunt and tip lines', ASCENT_OPPONENTS.every(o => { const c = ASCENT_CHAR[o.id]; return c && c.name === o.name && ['intro', 'win', 'lose', 'taunt'].every(k => [].concat(c.lines[k] || []).length >= 1) && c.lines.tip && c.look && c.palette; }));
            ok('there are 4 helper characters, one for each tab', ['npc-guide', 'npc-packmaster', 'npc-smith', 'npc-deckwright'].every(id => ASCENT_CHAR[id] && ASCENT_CHAR[id].role === 'npc'));
            ok('character ids are unique', new Set(ASCENT_CHARACTERS.map(c => c.id)).size === ASCENT_CHARACTERS.length);
            // ---- effects: which kind plays when ----
            const mk = (name, extra) => ({ card: { ...byName(name), ...(extra || {}) }, uid: 1 });
            const kinds = {
                'Plains': 'land-W', 'Island': 'land-U', 'Swamp': 'land-B', 'Mountain': 'land-R', 'Forest': 'land-G', 'Command Tower': 'land-nonbasic', 'Watery Grave': 'land-nonbasic',
                'Serra Angel': 'creature-W', 'Air Elemental': 'creature-U', 'Gray Ogre': 'creature-R', 'Grizzly Bears': 'creature-G', 'Hypnotic Specter': 'creature-B', 'Juggernaut': 'creature-colorless', 'Golgari Charm': null, 'Rakdos Cackler': 'creature-multi'
            };
            const bad = [];
            for (const [n, k] of Object.entries(kinds)) { const c = raw.find(x => x.name === n); if (!c) continue; const got = ascFxKindFor('enters', { o: mk(n) }); if (got !== k) bad.push(`${n}: ${got} (wanted ${k})`); }
            ok('lands and creatures pick the right effect when they enter', bad.length === 0, bad);
            ok('a token plays no effect', ascFxKindFor('enters', { o: { card: byName('Grizzly Bears'), token: true, uid: 2 } }) === null);
            const spells = { 'Lightning Bolt': 'spell-instant', 'Wrath of God': 'spell-sorcery', 'Sol Ring': 'spell-artifact', 'Pacifism': 'spell-enchantment', 'Jace Beleren': 'spell-planeswalker', 'Grizzly Bears': null, 'Forest': null };
            const badS = [];
            for (const [n, k] of Object.entries(spells)) { if (!raw.find(x => x.name === n)) continue; const got = ascFxKindFor('cast', { o: mk(n) }); if (got !== k) badS.push(`${n}: ${got} (wanted ${k})`); }
            ok('each kind of non-creature spell picks its own effect when cast (creatures and lands do not)', badS.length === 0, badS);
            ok('every effect kind has a spec with size, frames and a prompt', Object.values(ASCENT_FX).every(f => f.size && f.frames && f.fps && f.prompt));
            const allKinds = ['land-W', 'land-U', 'land-B', 'land-R', 'land-G', 'land-nonbasic', 'creature-W', 'creature-U', 'creature-B', 'creature-R', 'creature-G', 'creature-colorless', 'creature-multi', 'spell-instant', 'spell-sorcery', 'spell-artifact', 'spell-enchantment', 'spell-planeswalker', 'spell-battle'];
            ok('all 19 requested effects exist', allKinds.every(k => ASCENT_FX[k]) && Object.keys(ASCENT_FX).length === 19);

            // ---- playing an effect ----
            ensureProfile();
            const deck = { name: 'T', format: 'limited', entries: [{ card: byName('Forest'), n: 40 }], source: 'test' };
            await newGame(deck, { ...deck, name: 'U' });
            window.__FX_FORCE = true;
            ascFxPlay('land-G', null); ASC_FX.active = 0;
            await new Promise(r => setTimeout(r, 200));
            ok('an effect appears over the table and uses the placeholder without art', document.querySelectorAll('.fx-item.ph[data-kind="land-G"]').length === 1);
            await new Promise(r => setTimeout(r, 1300));
            ok('and is removed when it finishes', document.querySelectorAll('.fx-item').length === 0);
            ASC_FX.active = 0; document.querySelectorAll('.fx-item').forEach(n => n.remove());
            fire('enters', { o: G.players[0].library[0] });
            await new Promise(r => setTimeout(r, 250));
            ok('the engine hook plays the land effect when a real land enters', document.querySelectorAll('.fx-item[data-kind="land-G"]').length === 1);
            await new Promise(r => setTimeout(r, 1300));
            ASC_FX_KINDS_ART['creature-multi'] = true; ASC_FX.active = 0;
            ascFxPlay('creature-multi', null);
            await new Promise(r => setTimeout(r, 200));
            const sp = document.querySelector('.fx-item.sprite');
            ok('with an art file present the strip is played with one step per frame', sp && /spellslinger\/art\/fx\/creature-multi\.png/.test(sp.style.backgroundImage) && sp.style.getPropertyValue('--frames') === String(ASCENT_FX['creature-multi'].frames), sp && sp.getAttribute('style'));
            await new Promise(r => setTimeout(r, 1500));
            ASC_FX_KINDS_ART['creature-multi'] = false; ASC_FX.active = 0;
            window.__FX_FORCE = false;
            ok('the hook plays nothing when effects are not enabled (tests, the lab, reduced motion)', (() => { const n = document.querySelectorAll('.fx-item').length; ascFxHook('enters', { o: { card: byName('Forest'), uid: 5 } }); return document.querySelectorAll('.fx-item').length === n; })());
            ok('a broken effect call never throws', (() => { try { ascFxPlay('nonsense', 99); ascFxPlay('land-W', 123456); return true; } catch (e) { return false; } })());
            leaveGame();

            // ---- portraits and dialogue on screen ----
            showView('campaign'); await renderAscent();
            await ascChooseStarter('R'); ASC.tab = 'map'; await renderAscent();
            ok('the map shows the guide talking, as a placeholder portrait', document.querySelectorAll('#ascBody .asc-npc .asc-portrait.ph.talk').length === 1);
            ascSelectOpp('t1-cal'); await ascOppPanel();
            ok('an opponent panel shows their portrait, an intro line and a tip', document.querySelectorAll('#ascOpp .asc-portrait').length === 1 && ASCENT_CHAR['t1-cal'].lines.intro.some(l => $('ascOpp').textContent.includes(l)) && $('ascOpp').textContent.includes(ASCENT_CHAR['t1-cal'].lines.tip));
            ASC_ART.ok['spellslinger/art/characters/t1-cal.png'] = true; ascSelectOpp('t1-cal'); await ascOppPanel();
            ok('with a sprite file the portrait is the animated sheet', !!document.querySelector('#ascOpp .asc-portrait.sprite'));
            ASC_ART.ok['spellslinger/art/characters/t1-cal.png'] = false;
            ascPlay('t1-cal'); await new Promise(r => setTimeout(r, 50));
            ok('Battle first shows the opponent talking, with Let us play and Not yet', /Let's play/.test($('modalHost').textContent) && /Not yet/.test($('modalHost').textContent) && !!$('modalHost').querySelector('.asc-portrait'));
            closeModal();
            G = { campaign: { ascent: true, node: 't1-cal', tier: 1, name: 'Cinder Cal' } };
            const win = ascentResult(true), lose = ascentResult(false);
            ok('the result lines quote the opponent', win.includes('Cinder Cal') && win.includes('“') && lose.includes('Cinder Cal'), [win, lose]);
            G = null;

            // ---- Campaign mode keeps everything to itself ----
            setMode('campaign', { quiet: true }); applyModeUI(true);
            const tabs = VIEWS.filter(k => !$(`tab-${k}`).classList.contains('hidden'));
            ok('Campaign mode has only Home, Campaign and Rules tabs', JSON.stringify(tabs) === JSON.stringify(['home', 'campaign', 'rules']), tabs);
            ok('Campaign shows Aether, not coins or shop cash', !$('aetherPill').classList.contains('hidden') && $('coinPill').classList.contains('hidden') && $('cashPill').classList.contains('hidden'));
            ok('the Aether pill shows the Aether', $('aetherCount').textContent === ascentState().aether.toLocaleString() || (renderCoins(), $('aetherCount').textContent === ascentState().aether.toLocaleString()));
            setMode('sandbox', { quiet: true }); applyModeUI(true);
            ok('Sandbox still shows coins and no Aether', $('aetherPill').classList.contains('hidden') && !$('coinPill').classList.contains('hidden'));
            setMode('campaign', { quiet: true });
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentart', results, []);
    await h.close();
})();
