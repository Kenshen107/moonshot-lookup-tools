// Planeswalker's Ascent screen: starter pick, map, packs, collection, upgrades, decks, starting a game; no sideways scroll at 360 / 768 / 1280.
'use strict';
const fs = require('fs'), path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch();
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    const run = async (label, fn) => { try { const r = await page.evaluate(fn); results.push(...formatChecks(r.map(([l, c, d]) => [l, c, d]))); } catch (e) { results.push(...formatChecks([[label + ' threw: ' + e.message.split('\n')[0], false]])); } };
    await run('setup', async () => {
        const raw = await (await fetch('/__cards.json')).json();
        ensureProfile(); profile.ascent = null; profile.mode = 'campaign';
        await loadAscentRoster();
        const ids = new Set(ASCENT.roster.map(c => c.id));
        raw.filter(c => ids.has(c.id)).forEach(c => CARDS.set(c.id, slimCard(c)));
        showView('campaign'); await renderAscent();
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        ok('before a starter is chosen the map offers the five colors', $('ascBody').textContent.includes('Choose your starter deck') && $('ascBody').querySelectorAll('.asc-colors button').length === 5);
        await ascChooseStarter('G');
        ok('choosing a starter moves to Packs with 3 Play Boosters', ASC.tab === 'packs' && ascentState().sealed.play === 3 && ascentState().decks.length === 1);
        ok('the old ladder is folded away, not removed', !!$('oldCampaign') && !$('oldCampaign').open && !!$('circuitBody'));
        return out;
    });
    await run('packs', async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        await ascOpenPack('play');
        ok('opening a pack shows 14 face-down cards', document.querySelectorAll('#ascReveal .asc-flip').length === 14 && document.querySelectorAll('#ascReveal .asc-flip.up').length === 0);
        ascFlip(0);
        ok('flipping a card shows it', document.querySelectorAll('#ascReveal .asc-flip.up').length === 1);
        ascFlipAll();
        ok('Flip all shows everything', document.querySelectorAll('#ascReveal .asc-flip.up').length === 14);
        ok('a pack was used up', ascentState().sealed.play === 2);
        ascTab('map');
        return out;
    });
    await run('map', async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        ok('the map has 18 opponents in three tiers and tiers 2 and 3 are locked', document.querySelectorAll('.trail-node').length === 18 && document.querySelectorAll('.tier-band.locked').length === 2);
        ascSelectOpp('t1-mick'); await ascOppPanel();
        ok('an opponent panel shows 3 signature cards and a Battle button', document.querySelectorAll('#ascOpp .asc-grid:not(.asc-trophies) .asc-tile').length === 3 && /Battle/.test($('ascOpp').textContent));
        ok('the opponent panel lists 10 trophies with their win counts', document.querySelectorAll('#ascOpp .asc-trophy').length === 10 && /3 wins/.test($('ascOpp').textContent));
        ascSelectOpp('t1-boss'); await ascOppPanel();
        ok('the boss is locked until the other five are beaten', $('ascOpp').querySelector('button.primary').disabled);
        return out;
    });
    await run('collection', async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        ascTab('coll'); await new Promise(r => setTimeout(r, 50));
        ok('the collection lists the cards I own', document.querySelectorAll('#ascBody .asc-tile').length > 5);
        ASC.owned = false; ascColl(); await new Promise(r => setTimeout(r, 50));
        ok('turning off "only cards I own" lists up to a page of the whole roster', document.querySelectorAll('#ascBody .asc-tile').length === 36);
        ASC.owned = true;
        const st = ascentState(), id = Object.keys(st.owned).find(i => ASCENT.byId.get(i).type === 'creature');
        ascCardDialog(id);
        ok('a card dialog lists my copies', document.querySelectorAll('.asc-copy').length === st.owned[id].c.length);
        const key = st.owned[id].c[0].k; st.aether = 500;
        ascUpgradeDialog(key);
        ok('the upgrade dialog lists upgrades with prices', document.querySelectorAll('.asc-uprow').length >= 10 && /✨/.test($('modalHost').textContent));
        const before = st.aether; ascBuyUpgrade(key, 'plus11');
        ok('buying an upgrade spends Aether and puts it on that copy', st.aether < before && st.owned[id].c[0].u.includes('plus11'));
        ascRemoveUpgrade(key, 0);
        ok('removing it costs a fee and frees the slot', st.owned[id].c[0].u.length === 0);
        ascCraft(Object.keys(st.owned).includes(id) ? ASCENT.roster.find(c => c.type === 'creature' && !st.owned[c.id]).id : id, false);
        ok('crafting adds a new card', Object.keys(st.owned).length > 1);
        closeModal();
        return out;
    });
    await run('decks', async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        ascTab('decks'); await new Promise(r => setTimeout(r, 80));
        const st = ascentState(), deck = st.decks[0];
        ok('the starter deck is ready to play', /Ready to play/.test($('ascBody').textContent), ascentDeckProblems(deck));
        const id = Object.keys(deck.cards).find(i => ASCENT.byId.get(i).type === 'creature'), n0 = deck.cards[id];
        ascDropCard(id);
        ok('removing a card shortens the deck and shows a problem', !deck.cards[id] && /Needs/.test($('ascBody').textContent));
        const key = st.owned[id].c[0].k; ascToggleCopy(key);
        ok('tapping a copy chip puts that copy back in', deck.cards[id] === 1 && deck.sel[id][0] === key);
        ascNewDeck();
        ok('a new deck is empty and selectable', st.decks.length === 2 && ASC.deck === 1);
        ASC.deck = 0; ascDecks();
        return out;
    });
    await run('play', async () => {
        const out = [], ok = (l, c, d) => out.push([l, !!c, d]);
        const st = ascentState(); ASC.deck = 0;
        const deck = st.decks[0]; ascentNormalizeDeck(deck);
        // restore a legal deck: add copies back until 40 with basics
        const total = Object.values(deck.cards).reduce((a, b) => a + b, 0);
        const basic = ASCENT.roster.find(c => c.kind === 'basic'); deck.cards[basic.id] = (deck.cards[basic.id] || 0) + (40 - total);
        ok('the deck is legal again', ascentDeckProblems(deck).length === 0, ascentDeckProblems(deck));
        // the "Shuffling up" panel must be closed BEFORE the game opens (the opening-hand panel replaces it; closing afterwards wiped it)
        let seen = null; const realNew = window.newGame; window.newGame = (...a) => { seen = $('modalHost').innerHTML; return realNew(...a); };
        showModal('<h2>Shuffling up...</h2>');
        await startAscentMatch('t1-mick', 0);
        window.newGame = realNew;
        ok('the shuffling panel is closed before the game starts, so the opening hand panel is not wiped', seen === '', seen);
        ok('a game started against the opponent with the Ascent campaign marker', G && G.campaign && G.campaign.ascent && G.campaign.node === 't1-mick' && G.players.length === 2, G && G.campaign);
        ok('the opponent plays its 40 cards', G.players[1].library.length + G.players[1].hand.length >= 33);
        return out;
    });
    for (const [w, hh] of [[360, 800], [768, 900], [1280, 900]]) {
        await page.setViewportSize({ width: w, height: hh });
        const r = await page.evaluate(async () => {
            leaveGame && leaveGame(); const o = [];
            for (const t of ['map', 'packs', 'coll', 'decks']) { showView('campaign'); ASC.tab = t; await renderAscent(); await new Promise(r => setTimeout(r, 60)); o.push([t, document.documentElement.scrollWidth - innerWidth]); }
            return o;
        }).catch(e => [['error ' + e.message.split('\n')[0], 999]]);
        results.push(...formatChecks([[`no sideways scroll at ${w}px (${r.map(x => x.join(':')).join(' ')})`, r.every(x => x[1] <= 1)]]));
    }
    // screenshots for a look by eye
    await page.setViewportSize({ width: 1280, height: 1000 });
    for (const t of ['map', 'packs', 'coll', 'decks']) {
        await page.evaluate(async t => { leaveGame && leaveGame(); showView('campaign'); ASC.tab = t; ASC.owned = true; await renderAscent(); await new Promise(r => setTimeout(r, 100)); }, t).catch(() => {});
        await page.screenshot({ path: path.join(ROOT, 'tests', '.out', `ascent-${t}.png`) }).catch(() => {});
    }
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('ascentui', results, []);
    await h.close();
})();
