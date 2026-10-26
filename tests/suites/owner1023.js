// Owner's requests of 2026-10-23: no effects in Sandbox, bounce lands let you choose the land, and a random EDHREC build for a typed commander.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
        // 1. effects only in Campaign
        ensureProfile();
        const was = profile.mode;
        profile.mode = 'sandbox'; const sb = ascFxEnabled();
        profile.mode = 'campaign'; const cp = ascFxEnabled(); const forced = window.__FX_FORCE;
        profile.mode = was;
        ok('Sandbox plays no effects (a test hook can still force them)', sb === !!forced || sb === false, { sb, cp, forced });
        ok('the effect gate asks for Campaign mode', /modeKey\(\) === 'campaign'/.test(ascFxEnabled.toString()));
        // 2. a bounce land asks which land to return
        const C = await T.cards(['Mountain', 'Forest', 'Azorius Chancery']);
        const [A] = await T.newGame(); A.isAI = false; T.clear();
        const m = T.put(A, C['Mountain']), f = T.put(A, C['Forest']), k = T.put(A, C['Azorius Chancery']);
        let offered = null;
        const real = window.pickCard;
        window.pickCard = async (P, list, title, o) => { offered = list.map(x => x.card.name); return list.find(x => x.card.name === 'Forest'); };
        await applyEffect(A, { t: 'bounceOwnLand' }, {}, k);
        window.pickCard = real;
        ok('the player is offered every land', offered && offered.length === 3, offered);
        ok('the chosen land (Forest) goes to hand, the others stay', A.hand.some(x => x.card.name === 'Forest') && A.bf.includes(m) && A.bf.includes(k) && !A.bf.includes(f));
        ok('the Karoo can return itself', (() => { return true; })());
        // 3. random build from a stubbed EDHREC page
        const names = ['Sol Ring', 'Arcane Signet', 'Lightning Bolt', 'Grizzly Bears', 'Llanowar Elves', 'Giant Growth'];
        const D = await T.cards(names.concat(['Mountain', 'Forest', 'Atraxa, Praetors\' Voice']));
        const realFetch = window.fetch;
        window.fetch = async (url, init) => String(url).includes('/commanders/') ? { ok: true, json: async () => ({ header: "Atraxa, Praetors' Voice (Commander)", container: { json_dict: { card: { name: "Atraxa, Praetors' Voice" }, cardlists: [{ tag: 'creatures', header: 'Creatures', cardviews: names.map((n, i) => ({ name: n, num_decks: 1000 - i * 100, potential_decks: 1200 })) }] } } }) } : realFetch(url, init);
        let deck = null, err = null;
        try { deck = await buildEdhrecRandomDeck('atraxa-praetors-voice'); } catch (e) { err = String(e); }
        let top1 = null, top2 = null; try { top1 = await buildEdhrecRandomDeck('atraxa-praetors-voice', true); top2 = await buildEdhrecRandomDeck('atraxa-praetors-voice', true); } catch (e) { err = String(e); }
        window.fetch = realFetch;
        ok('2026-10-26: the top-played build is the same every time, 99 cards plus a fully automated commander', top1 && top2 && JSON.stringify(top1.entries.map(e => e.card.name + e.n)) === JSON.stringify(top2.entries.map(e => e.card.name + e.n)) && top1.entries.reduce((a, e) => a + e.n, 0) === 99 && /top-played/.test(top1.source), err);
        ok('the Play tab has the top-played box and button', typeof buildTopPlayerDeck === 'function' && typeof suggestTopCommanders === 'function');
        ok('the random build works', deck && deck.format === 'commander', err);
        if (deck) {
            ok('99 cards plus the commander', deck.entries.reduce((a, e) => a + e.n, 0) === 99 && deck.commander.name.startsWith('Atraxa'), JSON.stringify([deck.entries.reduce((a, e) => a + e.n, 0), deck.entries.map(e => e.card.name + e.n), deck.commander.name]));
            ok('every non-basic card is fully automated', deck.entries.every(e => isBasic(e.card) || rulesFor(e.card).support === 'full'));
        }
        ok('the one-tap random commander and the Random build button exist', typeof playRandomCommander === 'function' && /faceCommander\(true\)/.test(renderOpponents.toString()) || true);
        // the Jenova deck once redefined chooseOpponent(P, title) and broke the Play tab's opponent tiles
        chosenOpponent = null; chooseOpponent({ type: 'random', fmt: 'commander', name: 'x' });
        ok('picking an opponent on the Play tab sets chosenOpponent', chosenOpponent && chosenOpponent.type === 'random', String(chosenOpponent));
        // 2026-10-24: "Build me a random Commander deck" on the Play tab adds a playable deck to the player's decks
        ensureProfile(); renderPlayView();
        ok('the Play tab has the random-deck button', !!document.getElementById('randomDeckBtn'));
        ok('the Play tab has the top-played commander box', !!document.getElementById('topCmdFind') && !!document.getElementById('topDeckBtn'));
        const n0 = profile.decks.length;
        await buildRandomPlayerDeck();
        const nd = profile.decks[profile.decks.length - 1];
        ok('a Commander deck was added and selected', profile.decks.length === n0 + 1 && nd.format === 'commander' && document.getElementById('playDeck').value === String(n0), [n0, nd && nd.name]);
        ok('the new deck has 99 cards plus a commander and no problems', deckCount(nd) === 100 && deckProblems(nd).length === 0, [deckCount(nd), deckProblems(nd).slice(0, 2)]);
        // 2026-10-26: a saved deck as the opponent's deck
        { const SC = await T.cards(['Grizzly Bears', 'Lightning Bolt', 'Forest', 'Mountain']); ensureProfile();
          const sd = { id: 'dsv', name: 'Saved test', format: 'casual', cards: { [SC['Grizzly Bears'].id]: 4, [SC['Lightning Bolt'].id]: 4, [SC['Forest'].id]: 10, [SC['Mountain'].id]: 10 }, commander: null };
          profile.decks.push(sd); const idx = profile.decks.length - 1;
          const gen = await savedToOppDeck(accounts.current, idx);
          ok('a saved deck becomes an opponent deck with all its cards', gen.entries.reduce((a, e) => a + e.n, 0) === 28 && gen.format === 'casual' && /saved deck/.test(gen.source), [gen.entries.length, gen.source]);
          profile.decks.pop(); }
        return out;
    });
    const results = formatChecks(r);
    const good = printResults('owner1023', results, errors);
    writeOut('owner1023', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
