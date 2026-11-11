#!/usr/bin/env node
// AI spell-scoring audit (2026-11-11, owner: "start with the audit"): which fully Automated cards does the computer score at 0, so it would never choose to
// cast them? Every Automated non-land card is put in a computer player's hand on a neutral prepared board (9 mana, a few creatures each side, an artifact,
// an enchantment and a land on the other side, a creature in each graveyard, 40 life) and scored the way `aiBestPlay` does (`aiPickTarget`, `aiScore`,
// the removal reserve). Cards that score 0 are grouped by the kinds of effect they have, most-played (EDHREC) first.
//
//   node tests/ai_audit.js                 print the report, write tests/.out/ai_audit.json
//   node tests/ai_audit.js --list fog      list the zero-scored cards whose effects include "fog"
//   node tests/ai_audit.js --top 40        how many effect groups / cards to print
//
// A 0 here is not always a bug (a counterspell can't be scored without a spell on the stack; combat tricks are held; removal the reserve rule refuses), so
// the report separates cards the computer has some other way to cast (instants it answers with, tricks) from plain "never cast" ones.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, writeOut, ROOT } = require('./lib/harness');

const args = process.argv.slice(2);
const val = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const TOP = Number(val('top', 25)), LIST = val('list', null);

const INIT = async function () {
    const raw = await (await fetch('/tests/data/cards_all.json')).json();
    const pick = n => { const r = raw.find(c => c.name === n); const sc = slimCard(r); CARDS.set(sc.id, sc); return sc; };
    const bears = pick('Grizzly Bears'), giant = pick('Hill Giant'), angel = pick('Serra Angel'), solRing = pick('Sol Ring'), pacifism = pick('Pacifism'), mountain = pick('Mountain'), island = pick('Island');
    pick('Tyrox, Saurid Tyrant');
    const A0 = await listToOppDeck('1 Tyrox, Saurid Tyrant\n98 Mountain', 'commander');
    await newGame(A0, A0);
    const [A, B] = G.players; A.isAI = true; B.isAI = true;
    const put = (P, c) => { const o = makeObj(c, P.i); putOntoBattlefield(P, o); o.sick = false; return o; };
    T.clear(); G.turn = 8; G.firstTurn = false; G.active = 0; G.phase = 'main1'; G.busy = false; G.stack.length = 0; G.attackers = []; G.blocks = {};
    A.life = B.life = 40; A.hand.length = 0; A.library.length = 0; B.hand.length = 0; B.library.length = 0;
    for (let i = 0; i < 9; i++) put(A, mountain);
    for (let i = 0; i < 4; i++) put(B, island);
    put(A, bears); put(A, giant); put(B, bears); put(B, giant); put(B, angel); put(B, solRing); put(B, pacifism);
    A.gy.push(makeObj(angel, 0)); B.gy.push(makeObj(giant, 1));
    const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].map(n => pick(n));
    for (let i = 0; i < 5; i++) { A.hand.push(makeObj(bears, 0)); B.hand.push(makeObj(giant, 1)); }
    for (let i = 0; i < 3; i++) basics.forEach(b => { A.library.push(makeObj(b, 0)); B.library.push(makeObj(b, 1)); }); // a library with every basic land type, for the land fetchers
    A.library.push(makeObj(solRing, 0)); A.gy.push(makeObj(bears, 0)); B.gy.push(makeObj(angel, 1));
    window.__AUD = { raw, A, B, rows: [], threw: 0 };
    return raw.length;
};
const BATCH = async function (from, to) {
    const { raw, A, rows } = window.__AUD;
    const base = A.hand.length;
    for (let i = from; i < Math.min(to, raw.length); i++) {
        const c = raw[i];
        let sc, r;
        try { sc = slimCard(c); r = rulesFor(sc); } catch (e) { continue; }
        if (r.support !== 'full' || r.kind === 'land' || /\bBasic\b/.test(sc.type || '')) continue;
        try {
            const o = makeObj(sc, 0); A.hand.push(o);
            let best = 0;
            const tryScore = () => {
                const te = firstTargetEffect(o);
                const target = te ? aiPickTarget(A, te, o) : null;
                if (te && !target) return 0;
                let s = aiScore(A, o, target);
                if (target && target.o && target.o.owner !== A.i && isRemovalEffect(te) && !removalWorthIt(A, target.o)) s = 0;
                return s;
            };
            if (r.modes && r.modes.length) { r.modes.forEach((fx, k) => { o.mode = k; const s = tryScore(); if (s > best) best = s; }); }
            else best = tryScore();
            A.hand.length = base;
            const fx = (r.modes ? r.modes.flat() : []).concat(r.spell || [], r.etb || []);
            const kinds = [...new Set(fx.map(e => e.t === 'cmd' ? 'cmd:' + e.id : e.t))];
            rows.push({ name: sc.name, kind: r.kind, cmc: sc.cmc || 0, rank: c.edhrec_rank || 0, score: Math.round(best * 10) / 10, kinds, flash: !!r.flash, text: (sc.text || '').slice(0, 160) });
        } catch (e) { A.hand.length = base; window.__AUD.threw++; rows.push({ name: sc.name, kind: r.kind, rank: c.edhrec_rank || 0, score: null, kinds: [], err: String(e && e.message || e).slice(0, 120) }); }
    }
    return rows.length;
};

(async () => {
    if (!fs.existsSync(path.join(ROOT, 'tests', 'data', 'cards_all.json'))) { console.error('tests/data/cards_all.json is missing. Run: python3 tests/fetch_cards.py'); process.exit(2); }
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const t0 = Date.now();
    const total = await page.evaluate(`(${INIT.toString()})()`);
    const STEP = 1500;
    for (let i = 0; i < total; i += STEP) {
        const n = await page.evaluate(`(${BATCH.toString()})(${i}, ${i + STEP})`);
        process.stdout.write(`\r${Math.min(i + STEP, total)}/${total} cards, ${n} scored, ${((Date.now() - t0) / 1000).toFixed(0)}s   `);
    }
    console.log('');
    const { rows, threw } = await page.evaluate(() => ({ rows: window.__AUD.rows, threw: window.__AUD.threw }));
    await h.close();
    const nonCreature = rows.filter(r => r.kind !== 'creature');
    const zero = rows.filter(r => r.score === 0);
    const zeroNc = zero.filter(r => r.kind !== 'creature');
    console.log(`Scored ${rows.length} fully Automated non-land cards in ${((Date.now() - t0) / 1000).toFixed(0)}s (${threw} threw while scoring).`);
    console.log(`Score 0 (never chosen on its own): ${zero.length} cards, of which ${zeroNc.length} are not creatures (${nonCreature.length} non-creature cards in all).`);
    const byKind = {}; zero.forEach(r => { byKind[r.kind] = (byKind[r.kind] || 0) + 1; });
    console.log('By card kind:', JSON.stringify(byKind));
    // the groups: first effect kind of each zero-scored card (or "none read")
    const groups = {};
    zero.forEach(r => { const k = r.kinds.length ? r.kinds.slice().sort().join('+') : '(no spell effect: abilities or triggers only)'; (groups[k] = groups[k] || []).push(r); });
    const single = {};
    zero.forEach(r => (r.kinds.length ? r.kinds : ['(none)']).forEach(k => { (single[k] = single[k] || []).push(r); }));
    const rankOf = r => (r.rank || 99999);
    const pop = list => list.filter(r => r.rank && r.rank <= 3000).length;
    if (LIST) {
        const l = zero.filter(r => r.kinds.some(k => k === LIST || k.includes(LIST))).sort((a, b) => rankOf(a) - rankOf(b));
        console.log(`\nZero-scored cards with an effect matching "${LIST}": ${l.length}`);
        l.slice(0, 80).forEach(r => console.log(`  ${String(r.rank || '-').padStart(6)}  ${r.name} (${r.kind}, ${r.kinds.join('+')}): ${r.text.replace(/\n/g, ' ').slice(0, 110)}`));
    } else {
        console.log(`\nEffect kinds that appear most among zero-scored cards (cards, of which in the 3,000 most-played):`);
        Object.entries(single).sort((a, b) => b[1].length - a[1].length).slice(0, TOP).forEach(([k, l]) => console.log(`  ${String(l.length).padStart(5)} ${String(pop(l)).padStart(4)}  ${k}   e.g. ${l.sort((a, b) => rankOf(a) - rankOf(b)).slice(0, 3).map(r => r.name).join('; ')}`));
        console.log(`\nMost-played zero-scored non-creature cards:`);
        zeroNc.sort((a, b) => rankOf(a) - rankOf(b)).slice(0, TOP * 2).forEach(r => console.log(`  ${String(r.rank || '-').padStart(6)}  ${r.name} (${r.kind}; ${r.kinds.join('+') || 'no spell effect'})${r.flash ? ' [flash]' : ''}`));
        const lows = nonCreature.filter(r => r.score > 0 && r.score < 3);
        console.log(`\nScored above 0 but under 3 (so a creature or rock nearly always wins instead): ${lows.length} non-creature cards`);
    }
    writeOut('ai_audit', { rows });
    process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
