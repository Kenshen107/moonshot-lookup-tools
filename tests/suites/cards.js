// Card-by-card test. For every card in a group it prepares a board, puts the card in hand, lets the AI play
// two turns (cast it, use its abilities, attack, run its triggers) and checks that:
//   - nothing threw, no card is in two zones, no life/power is NaN
//   - the card reads as fully Automated (groups marked "must be 100%")
// Usage: node tests/suites/cards.js [group ...]      groups: verified, mirrodin, m10, welcome, starter, precon, or all
// Default: verified mirrodin m10. `--quick` runs only the verified decks.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, printResults, writeOut } = require('../lib/harness');
const BASELINE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'baseline.json'), 'utf8'));

const GROUPS = {
    verified: { must100: true, desc: 'every deck in VERIFIED_DECKS (Sandman, Brudiclad, Gitrog, Tyrox)' },
    mirrodin: { must100: true, desc: 'Mirrodin booster cards (set:mrd is:booster)' },
    m10: { must100: true, desc: 'Magic 2010 booster cards (set:m10 is:booster)' },
    welcome: { must100: true, desc: 'MTGJSON Welcome Decks (55 decks)' },
    starter: { must100: true, desc: 'MTGJSON Starter Kits (20 decks)' },
    precon: { must100: true, desc: 'every Ready precon that is not a Welcome Deck or Starter Kit (spellslinger/data/precon-ready.json)' }
};

const BODY = async function (group, mustBe100) {
    // ---- gather the cards ----
    let cards = [];
    if (group === 'verified') {
        for (const d of VERIFIED_DECKS) {
            const parsed = parseDeckText(d.text);
            const rows = await resolveDeckCards([...parsed.commander, ...parsed.main]);
            rows.forEach(r => r.card && cards.push(r.card));
        }
    } else if (group === 'mirrodin' || group === 'm10') {
        cards = await searchCards(`set:${group === 'm10' ? 'm10' : 'mrd'} is:booster`, 6, 'name');
    } else if (group === 'precon') {
        await loadPreconReady();
        const list = (await loadPreconList()).filter(p => preconIsReady(p) && !['Welcome Deck', 'Starter Kit'].includes(p.type));
        for (const p of list) {
            let d = null;
            for (let k = 0; k < 5 && !d; k++) { try { d = await loadPreconDeck(p); } catch (e) { await new Promise(r => setTimeout(r, 1500 * (k + 1))); } }
            if (!d) throw new Error(`could not load ${p.name}`);
            d.entries.forEach(e => cards.push(e.card));
        }
    } else if (group === 'welcome' || group === 'starter') {
        const list = (await loadPreconList()).filter(p => p.type === (group === 'welcome' ? 'Welcome Deck' : 'Starter Kit'));
        for (const p of list) {
            let d = null;
            for (let k = 0; k < 5 && !d; k++) { try { d = await loadPreconDeck(p); } catch (e) { await new Promise(r => setTimeout(r, 1500 * (k + 1))); } }
            if (!d) throw new Error(`could not load ${p.name}`);
            d.entries.forEach(e => cards.push(e.card));
        }
    }
    const seen = new Set(), uniq = [];
    cards.forEach(c => { if (c && !seen.has(c.name) && !isBasic(c)) { seen.add(c.name); uniq.push(c); } });
    await loadBasics();
    const mountain = [...CARDS.values()].find(c => c.name === 'Mountain') || CARDS.get(BASIC_IDS.R);
    const bear = (await T.cards(['Grizzly Bears', 'Hill Giant']));

    const failures = [], notFull = [];
    const A = await listToOppDeck('1 Tyrox, Saurid Tyrant\n98 Mountain', 'commander'), B = await listToOppDeck('1 Tyrox, Saurid Tyrant\n98 Mountain', 'commander');
    await newGame(A, B);
    let P0 = G.players[0], P1 = G.players[1];
    let i = 0;
    for (const c of uniq) {
        if (++i % 60 === 0) { await newGame(A, B); P0 = G.players[0]; P1 = G.players[1]; } // a fresh game now and then
        try {
            const r = rulesFor(c);
            if (r.support !== 'full') notFull.push(`${c.name} (${r.support}: ${(r.unhandled || []).join(' / ').slice(0, 120)})`);
            [P0, P1].forEach(P => { ['bf', 'hand', 'gy', 'exile'].forEach(z => P[z].splice(0)); P.life = 40; P.poison = 0; P.cmdDmg = 0; });
            G.stack.length = 0; G.attackers = []; G.blocks = {}; G.trigQ = []; G.over = false; G.mode = null; G.trigCount = 0;
            G.active = 0; G.turn = 6; G.phase = 'main1'; G.busy = false; G.extraCombat = 0; G.combatFired = false; window.lastResult = null;
            for (let k = 0; k < 9; k++) { const m = makeObj(mountain, 0); putOntoBattlefield(P0, m); m.sick = false; }
            for (const [P, nm] of [[P0, 'Grizzly Bears'], [P0, 'Hill Giant'], [P1, 'Grizzly Bears'], [P1, 'Hill Giant']]) { const o = makeObj(bear[nm], P.i); putOntoBattlefield(P, o); o.sick = false; }
            P0.hand.push(makeObj(c, 0));
            await aiTurn(P0);
            P0.bf.forEach(x => { x.sick = false; x.tapped = false; });
            G.turn = 8; G.phase = 'main1'; G.active = 0; G.extraCombat = 0; G.combatFired = false; G.over = false; G.trigCount = 0;
            await aiTurn(P0);
            const bad = T.invariants();
            if (bad.length) failures.push(`${c.name}: ${bad.join('; ')}`);
        } catch (e) { failures.push(`${c.name}: threw ${String(e && e.stack || e).slice(0, 200)}`); }
    }
    return { total: uniq.length, failures, notFull };
};

async function main() {
    const args = process.argv.slice(2);
    let groups = args.filter(a => !a.startsWith('--'));
    if (args.includes('--quick')) groups = ['verified'];
    if (!groups.length) groups = ['verified', 'mirrodin', 'm10'];
    if (groups.includes('all')) groups = Object.keys(GROUPS);
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    let allGood = true; const report = {};
    for (const g of groups) {
        if (!GROUPS[g]) { console.log('unknown group', g); allGood = false; continue; }
        const t0 = Date.now();
        const r = await page.evaluate(`(${BODY.toString()})(${JSON.stringify(g)}, ${GROUPS[g].must100})`);
        // Cards already known not to be fully Automated (tests/baseline.json) don't fail the run; new ones do
        const known = (BASELINE.knownNotFull || {})[g] || [];
        const nameOf = x => x.replace(/ \(.*$/, '');
        const fresh = r.notFull.filter(x => !known.includes(nameOf(x)));
        const fixed = known.filter(k => !r.notFull.some(x => nameOf(x) === k));
        if (known.length && r.notFull.length - fresh.length) console.log(`   known and not fixed yet: ${known.filter(k => r.notFull.some(x => nameOf(x) === k)).join(', ')}`);
        if (fixed.length) console.log(`   now fully Automated, remove from tests/baseline.json: ${fixed.join(', ')}`);
        const results = [
            { label: `${g}: ${r.total} cards played without errors (${GROUPS[g].desc})`, ok: r.failures.length === 0, detail: r.failures.length ? JSON.stringify(r.failures.slice(0, 8)) : undefined },
            { label: `${g}: every card reads as fully Automated (except the known ones)`, ok: !GROUPS[g].must100 || fresh.length === 0, detail: fresh.length ? JSON.stringify(fresh.slice(0, 8)) : undefined }
        ];
        console.log(`-- ${g} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
        if (!printResults(g, results)) allGood = false;
        report[g] = r;
    }
    if (errors.length) { console.log('PAGE ERRORS', errors.slice(0, 5)); allGood = false; }
    writeOut('cards', report);
    await h.close();
    process.exit(allGood ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
