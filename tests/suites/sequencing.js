// Sequencing (2026-10-28, part 5 of table sense): mulligans, land drops, rock planning, spending mana. See docs/spellslinger-table-sense.md section E.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const NAMES = ['Mountain', 'Forest', 'Island', 'Swamp', 'Plains', 'Grizzly Bears', 'Hill Giant', 'Wind Drake', 'Serra Angel', 'Sol Ring', 'Tranquil Cove', 'Giant Spider', 'Tyrox, Saurid Tyrant'];
const SETUP = async function ([n, NAMES]) {
    if (!window.LOCAL) {
        const raw = await (await fetch('/__cards.json')).json();
        window.LOCAL = {};
        raw.forEach(c => { if (NAMES.includes(c.name) && !window.LOCAL[c.name] && (c.type_line || '').length) { const sc = slimCard(c); CARDS.set(sc.id, sc); window.LOCAL[c.name] = sc; } });
    }
    const C = window.LOCAL;
    const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Mountain'], n: 99 }], source: 'test' });
    const decks = []; for (let i = 0; i < n; i++) decks.push(mk());
    await newGame(decks[0], decks[1], null, decks.slice(2));
    window.C = C;
    return G.players.length;
};
const RESET = function () {
    T.clear(); G.active = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.stack.length = 0; G.attackers = []; G.blocks = {};
    G.players.forEach(P => { P.isAI = true; P.aiLevel = 'normal'; P.aiStyle = null; P.tune = {}; P.life = 40; P.hand.length = 0; P.command.length = 0; P.landsPlayed = 0; P.mulligans = 0; P.grudge = {}; });
};

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const results = [];
    for (const players of [4, 2]) {
        await page.evaluate(SETUP, [players, NAMES]);
        const r = await page.evaluate(async ([resetSrc, players]) => {
            const out = [];
            try {
                const reset = eval('(' + resetSrc + ')');
                const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
                const [A] = G.players;
                const C = window.C;
                const hand = (P, names) => { P.hand.length = 0; names.forEach(n => P.hand.push(makeObj(C[n], P.i))); };
                const lands = (P, n, k) => { for (let i = 0; i < k; i++) T.put(P, C[n]); };
                if (players === 2) {
                    reset(); hand(A, ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain']);
                    ok('duel: sequencing is off (same as before)', !seqOn(A));
                    reset(); lands(A, 'Island', 2); hand(A, ['Island', 'Tranquil Cove', 'Grizzly Bears']);
                    const before = A.hand.filter(o => o.card.name === 'Island').length;
                    aiPlayLand(A);
                    ok('duel: the old land choice still plays the untapped land', A.bf.filter(o => o.card.name === 'Island').length === 3 && before === 1);
                    return out;
                }
                // ---- mulligans ----
                reset(); hand(A, ['Mountain', 'Grizzly Bears', 'Hill Giant', 'Hill Giant', 'Serra Angel', 'Serra Angel', 'Giant Spider']);
                ok('mulligan: a one-land hand', mulliganWanted(A));
                reset(); hand(A, ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Grizzly Bears']);
                ok('mulligan: six lands and one spell', mulliganWanted(A));
                reset(); hand(A, ['Mountain', 'Forest', 'Mountain', 'Grizzly Bears', 'Hill Giant', 'Hill Giant', 'Giant Spider']);
                ok('keep: three lands and a two-drop', !mulliganWanted(A));
                reset(); hand(A, ['Mountain', 'Forest', 'Hill Giant', 'Hill Giant', 'Giant Spider', 'Serra Angel', 'Serra Angel']);
                ok('mulligan: two lands and nothing cheap', mulliganWanted(A));
                reset(); hand(A, ['Mountain', 'Forest', 'Grizzly Bears', 'Grizzly Bears', 'Hill Giant', 'Hill Giant', 'Giant Spider']);
                ok('keep: two lands and two cheap plays', !mulliganWanted(A));
                reset(); hand(A, ['Island', 'Island', 'Island', 'Swamp', 'Grizzly Bears', 'Hill Giant', 'Giant Spider']);
                ok('mulligan: the lands cannot cast any of the spells', mulliganWanted(A));
                reset(); hand(A, ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Hill Giant', 'Serra Angel']);
                ok('mulligan: five lands and no early play', mulliganWanted(A));
                reset(); A.mulligans = 2; hand(A, ['Mountain', 'Grizzly Bears', 'Hill Giant', 'Hill Giant', 'Serra Angel', 'Serra Angel', 'Giant Spider']);
                ok('keep: after two mulligans it takes what it gets', !mulliganWanted(A));
                reset(); A.mulligans = 1; hand(A, ['Mountain', 'Forest', 'Hill Giant', 'Hill Giant', 'Giant Spider', 'Serra Angel', 'Serra Angel']);
                ok('keep: after one mulligan a two-lander is acceptable', !mulliganWanted(A));
                reset(); hand(A, ['Forest', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Grizzly Bears']);
                const b = mullBottomPick(A);
                ok('bottom: extra lands go first (' + b.card.name + ')', b.card.name === 'Mountain');
                reset(); hand(A, ['Mountain', 'Forest', 'Mountain', 'Grizzly Bears', 'Serra Angel', 'Hill Giant', 'Giant Spider']);
                ok('bottom: the spell the lands cannot cast goes first', ['Serra Angel'].includes(mullBottomPick(A).card.name), mullBottomPick(A).card.name);
                reset(); hand(A, ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain']);
                await aiMulligan(A);
                ok('aiMulligan: a seven-land hand is replaced (' + A.mulligans + ' taken, hand ' + A.hand.length + ')', A.mulligans >= 1 && A.hand.length === 7 - mullBottom(A));
                ok('aiMulligan: never more than two', A.mulligans <= 2);

                // ---- land drops ----
                reset(); lands(A, 'Island', 2); hand(A, ['Island', 'Tranquil Cove', 'Grizzly Bears']);
                aiPlayLand(A);
                ok('lands: with nothing to spend the extra mana on, it plays the tapped land', A.bf.some(o => o.card.name === 'Tranquil Cove'), A.bf.map(o => o.card.name));
                reset(); lands(A, 'Island', 2); hand(A, ['Island', 'Tranquil Cove', 'Wind Drake']);
                aiPlayLand(A);
                ok('lands: with a three-drop in hand it plays the untapped land', A.bf.filter(o => o.card.name === 'Island').length === 3 && !A.bf.some(o => o.card.name === 'Tranquil Cove'), A.bf.map(o => o.card.name));
                reset(); A.tune = { sequencing: 0 }; lands(A, 'Island', 2); hand(A, ['Island', 'Tranquil Cove', 'Grizzly Bears']);
                aiPlayLand(A);
                ok('lands: the knob turns it off', A.bf.filter(o => o.card.name === 'Island').length === 3);

                // ---- mana pieces ----
                reset(); lands(A, 'Mountain', 3); hand(A, ['Mountain', 'Sol Ring', 'Serra Angel']);
                const sr = A.hand.find(o => o.card.name === 'Sol Ring');
                const withBomb = aiScore(A, sr, null);
                hand(A, ['Mountain', 'Sol Ring', 'Grizzly Bears']); const sr2 = A.hand.find(o => o.card.name === 'Sol Ring');
                const without = aiScore(A, sr2, null);
                ok('rocks: Sol Ring is worth more when it makes next turn\'s 5-drop castable (' + withBomb + ' vs ' + without + ')', withBomb - without >= 3.9, [withBomb, without]);

                // ---- spending the turn's mana ----
                const mk = (cmc, s) => ({ o: { card: { cmc } }, s });
                const c3 = mk(3, 12), c2a = mk(2, 10), c2b = mk(2, 9.5);
                ok('mana: with 4 mana it starts with a 2-drop so both 2-drops fit', [c2a, c2b].includes(seqPick(A, [c3, c2a, c2b], 4)));
                ok('mana: with 3 mana it casts the 3-drop', seqPick(A, [c3, c2a, c2b], 3) === c3);
                ok('mana: a single play is just that play', seqPick(A, [c3], 4) === c3);
                ok('mana: with 7 mana the top play stays first', seqPick(A, [c3, c2a, c2b], 7) === c3);
                ok('no broken invariants', T.invariants().length === 0, T.invariants());
            } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 5)]); }
            return out;
        }, [RESET.toString(), players]);
        results.push(...formatChecks(r));
    }
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('sequencing', results, []);
    writeOut('sequencing', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
