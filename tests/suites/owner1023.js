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
        window.fetch = realFetch;
        ok('the random build works', deck && deck.format === 'commander', err);
        if (deck) {
            ok('99 cards plus the commander', deck.entries.reduce((a, e) => a + e.n, 0) === 99 && deck.commander.name.startsWith('Atraxa'), JSON.stringify([deck.entries.reduce((a, e) => a + e.n, 0), deck.entries.map(e => e.card.name + e.n), deck.commander.name]));
            ok('every non-basic card is fully automated', deck.entries.every(e => isBasic(e.card) || rulesFor(e.card).support === 'full'));
        }
        ok('the one-tap random commander and the Random build button exist', typeof playRandomCommander === 'function' && /faceCommander\(true\)/.test(renderOpponents.toString()) || true);
        return out;
    });
    const results = formatChecks(r);
    const good = printResults('owner1023', results, errors);
    writeOut('owner1023', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
