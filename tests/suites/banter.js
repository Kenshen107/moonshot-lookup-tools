// Table talk, salt and cool (2026-10-15): characters, line picking, what makes a bot salty, what the table finds cool, deck themes, style points, the strip.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const want = ['Island', 'Swamp', 'Mountain', 'Grizzly Bears', 'Serra Angel', 'Tyrox, Saurid Tyrant', 'Wrath of God', 'Counterspell', 'Stone Rain', 'Fractured Sanity', 'Act of Treason', 'Lightning Bolt', 'Sol Ring', 'Mind Funeral', 'Divination'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const styles = ['aggro', 'control', 'ramp'];
            const fresh = async () => {
                const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
                const ds = [mk(), mk(), mk(), mk()]; ds[1].aiStyle = 'control'; ds[2].aiStyle = 'aggro'; ds[3].aiStyle = 'ramp';
                await newGame(ds[0], ds[1], null, ds.slice(2)); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false;
                G.players.forEach((P, i) => { P.life = 40; P.salt = 0; P.said = 0; P.name = ['You', 'Alpha', 'Bravo', 'Charlie'][i] + ', test'; });
                G.players[0].isAI = false; assignCharacters(); G.cool = G.players.map(() => 0);
                return G.players;
            };
            const lines = () => G.log.map(l => l.text || l);
            let [A, B, Cc, D] = await fresh();

            // ---- characters and lines ----
            ok('every bot gets a different named character that fits its style', new Set([B, Cc, D].map(P => P.char.key)).size === 3 && B.char.prefer.includes('control') && Cc.char.prefer.includes('aggro'), [B, Cc, D].map(P => P.char.key));
            const evs = Object.keys(TALK);
            ok('every event has shared lines', evs.every(e => (TALK[e]._ || []).length >= 1), evs.filter(e => !(TALK[e]._ || []).length));
            const allLines = evs.flatMap(e => Object.values(TALK[e]).flat());
            ok('there are lots of lines to say (over 300)', allLines.length > 300, allLines.length);
            ok('every character line names a real character', evs.every(e => Object.keys(TALK[e]).every(k => k === '_' || CHARACTERS[k])), evs.filter(e => Object.keys(TALK[e]).some(k => k !== '_' && !CHARACTERS[k])));
            ok('placeholders are only the known ones', allLines.every(l => (l.match(/\{(\w+)\}/g) || []).every(t => ['{foe}', '{me}', '{card}', '{n}', '{cmd}', '{tag}'].includes(t))));
            const l1 = pickLine(B, 'hit', { foe: 'you' }); B.said = 0; const l2 = pickLine(B, 'hit', { foe: 'you' });
            ok('a line is picked without random numbers (the same state gives the same line)', l1 === l2 && !/\{/.test(l1), l1);
            const seen = new Set(); for (let i = 0; i < 12; i++) { G.turn = 6 + i; seen.add(pickLine(B, 'hit', { foe: 'you' })); }
            ok('and the lines vary as the game goes on', seen.size >= 4, seen.size);

            // ---- salt ----
            [A, B, Cc, D] = await fresh();
            T.put(B, C['Grizzly Bears']); T.put(B, C['Serra Angel']); T.put(B, C['Grizzly Bears']); T.put(A, C['Grizzly Bears']);
            await applyEffect(A, { t: 'wipe', how: 'destroy', what: 'creatures' }, null, makeObj(C['Wrath of God'], 0));
            ok('a sweeper that kills three creatures makes that bot salty and it complains', B.salt >= 2 && lines().some(l => l.includes(who(B) + ':')), { salt: B.salt, said: lines().filter(l => /:/.test(l)).slice(-2) });
            ok('a sweeper that hit nobody else leaves the other bots calm', (Cc.salt || 0) === 0 && (D.salt || 0) === 0);
            [A, B, Cc, D] = await fresh();
            const cs = makeObj(C['Counterspell'], 0); const sp = makeObj(C['Divination'], 1); G.stack.push({ id: 7001, kind: 'spell', o: sp, P: B, target: null, name: 'Divination' });
            await applyEffect(A, { t: 'counter', target: 'spell', filter: 'any' }, { item: G.stack[0] }, cs);
            ok('a counterspell on a bot adds salt', B.salt > 0, B.salt);
            [A, B, Cc, D] = await fresh();
            const land = T.put(B, C['Island']); await applyEffect(A, { t: 'destroy', target: 'perm', filter: 'land' }, { o: land }, makeObj(C['Stone Rain'], 0));
            ok('destroying a bot\'s land adds salt', B.salt >= 2, B.salt);
            [A, B, Cc, D] = await fresh();
            B.library.length = 0; for (let i = 0; i < 30; i++) B.library.push(makeObj(C['Island'], 1));
            doMill(B, 14);
            ok('milling a bot for 14 adds salt', B.salt > 1, B.salt);
            [A, B, Cc, D] = await fresh();
            for (let i = 0; i < 3; i++) politicsTargeted(A, B);
            ok('being targeted three times in a turn adds salt', B.salt > 0 && lines().some(l => /:/.test(l)));
            [A, B, Cc, D] = await fresh();
            saltAdd(B, A, 'wrath', 6); saltAdd(B, A, 'land', 6); saltAdd(B, A, 'steal', 6);
            ok('enough salt makes a bot refuse deals (rage), with a reason', dealsRefused(B) && dealScore(B, A, 'peace').score < 0 && /angry/.test(dealScore(B, A, 'peace').reason), { until: B.noDealsUntil, mood: botMood(B).mood });
            ok('a salty bot shows the salt mood', botMood(B).mood === 'salty');
            const was = B.salt; banterTurnStart(B);
            ok('salt fades a little each turn', B.salt < was);
            G.turn += 9;
            ok('and the refusal runs out', !dealsRefused(B));

            // ---- cool ----
            [A, B, Cc, D] = await fresh();
            banterCast(A, { card: { name: 'Huge Spell', cmc: 8 }, xVal: 0 });
            ok('a big play by a person is cool and a bot is impressed', G.cool[0] === 1 && lines().some(l => l.includes('🤩')), lines().slice(-2));
            banterCast(A, { card: { name: 'Huge Spell', cmc: 8 }, xVal: 0 });
            ok('the same card is not counted twice', G.cool[0] === 1);
            banterCast(A, { card: { name: 'Black Lotus', cmc: 0, released: '1993-08-05' }, xVal: 0 });
            ok('an old card is cool', G.cool[0] === 2);
            const bearO = T.put(B, C['Serra Angel']); banterCopy(A, bearO);
            ok('copying another player\'s good creature is cool', G.cool[0] === 3);

            // ---- deck themes ----
            [A, B, Cc, D] = await fresh();
            const mill = ['Fractured Sanity', 'Mind Funeral']; for (let i = 0; i < 5; i++) A.library.push(makeObj({ ...C['Divination'], id: 'm' + i, text: 'Each opponent mills ten cards.' }, 0));
            ok('a deck full of mill is tagged as mill', deckTags(A).includes('mill'), deckTags(A));
            ok('a plain deck has no tag', deckTags(B).length === 0, deckTags(B));
            G.log.length = 0; await banterStart();
            ok('the table notices an unusual deck on turn one (a "meet" line and an impressed reaction)', lines().some(l => /mill|library|count your cards/i.test(l)) && lines().some(l => l.includes('🤩')), lines().slice(-5));

            // ---- the end of the game: style points ----
            [A, B, Cc, D] = await fresh(); A.isAI = false; G.cool[0] = 3; G.low = { 0: 20 }; B.salt = 7;
            const e = banterEnd(0);
            ok('a person earns style points for cool plays (3 x 10) and the report names the saltiest bot', e && e.bonus === 30 && e.html.includes(who(B)), e && e.bonus);
            G.cool[0] = 9; ok('the bonus is capped', banterEnd(0).bonus === 50);

            // ---- the strip ----
            [A, B, Cc, D] = await fresh(); B.salt = 4;
            const html = podStripHTML();
            ok('the opponent strip shows the character names, the salt on a salty bot and the table meters', html.includes(who(B)) && html.includes('🧂4') && html.includes('✨'), html.slice(0, 200));
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('banter', results, []);
    writeOut('banter', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
