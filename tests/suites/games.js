// Whole games, played by the AI on both sides (the game's ?autoplay mode), with the invariant check at the end:
// every card in one zone, no NaN life or power, a winner (or a draw) was reached, and no page errors.
// Usage: node tests/suites/games.js [--quick|--full] [kind ...]     kinds: modern boss commander precon verified draft
//   --quick  a few games of each kind (about 3 minutes)      default  a few more      --full  about 100 games
'use strict';
const { launch, installHelpers, printResults, writeOut } = require('../lib/harness');

const SLUGS = ['atraxa-praetors-voice', 'the-ur-dragon', 'krenko-mob-boss', 'edgar-markov', 'meren-of-clan-nel-toth', 'yuriko-the-tigers-shadow', 'kenrith-the-returned-king', 'muldrotha-the-gravetide'];
const THEMES = ['burn', 'stompy'];
const BOSSES = ['greg', 'marcus', 'sarah', 'leo', 'trevor', 'sam', 'arthur', 'brenda', 'luke'];

function plan(mode) {
    const n = mode === 'full' ? { modern: 20, boss: 18, commander: 24, precon: 16, verified: 12, draft: 4 } : mode === 'quick' ? { modern: 3, boss: 3, commander: 3, precon: 3, verified: 4, draft: 1 } : { modern: 6, boss: 6, commander: 6, precon: 6, verified: 8, draft: 2 };
    const games = [];
    for (let i = 0; i < n.modern; i++) games.push({ kind: 'modern', q: `format=modern&a=${THEMES[i % 2]}&b=${THEMES[(i + 1) % 2]}` });
    for (let i = 0; i < n.boss; i++) games.push({ kind: 'boss', q: `format=boss&a=${BOSSES[i % 9]}&b=${BOSSES[(i + 3) % 9]}&la=hard&lb=${['easy', 'normal', 'hard'][i % 3]}` });
    for (let i = 0; i < n.commander; i++) games.push({ kind: 'commander', q: `format=commander&a=${SLUGS[i % 8]}&b=${SLUGS[(i + 3) % 8]}` });
    for (let i = 0; i < n.precon; i++) games.push({ kind: 'precon', q: 'PRECON', i });
    for (let i = 0; i < n.verified; i++) games.push({ kind: 'verified', q: 'VERIFIED', i });
    for (let i = 0; i < n.draft; i++) games.push({ kind: 'draft', q: `format=draft&set=${['mrd', 'm10'][i % 2]}&a=${i % 8}&b=${(i + 3) % 8}` });
    return games;
}

async function playOne(ctx, base, game, extra) {
    let query = game.q;
    if (query === 'PRECON') { const [a, b] = extra.precons[game.i % extra.precons.length]; query = `format=precon&a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`; }
    if (query === 'VERIFIED') {
        const key = extra.verified[game.i % extra.verified.length];
        query = `format=list&b=${SLUGS[(game.i + 1) % 8]}`;
        game.deck = key;
    }
    let last = null;
    for (let attempt = 0; attempt < 4; attempt++) {
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e.message || e)));
        if (game.kind === 'verified') await page.addInitScript(t => { try { localStorage.setItem('duels:testListA', JSON.stringify(t)); } catch (e) { /* ignore */ } }, extra.verifiedText[game.deck]);
        try {
            await page.goto(`${base}/Spellslinger_Duels.html?autoplay&${query}`);
            await page.waitForFunction(() => window.lastResult, null, { timeout: 240000, polling: 500 });
            const r = await page.evaluate(() => window.lastResult);
            if (r.error && /Failed to fetch|NetworkError|429|timeout/i.test(r.error)) { last = { error: r.error }; await page.close(); await new Promise(res => setTimeout(res, 2500 * (attempt + 1))); continue; }
            if (r.error) { last = { error: r.error, errors }; await page.close(); break; }
            await installHelpers(page);
            const bad = await page.evaluate(() => T.invariants());
            await page.close({ runBeforeUnload: true });
            return { ...game, result: r, invariants: bad, errors };
        } catch (e) { last = { error: String(e).slice(0, 200), errors }; await page.close().catch(() => {}); }
    }
    return { ...game, ...last };
}

async function main() {
    const args = process.argv.slice(2);
    const mode = args.includes('--full') ? 'full' : args.includes('--quick') ? 'quick' : 'normal';
    const kinds = args.filter(a => !a.startsWith('--'));
    let games = plan(mode);
    if (kinds.length) games = games.filter(g => kinds.includes(g.kind));
    const h = await launch({ profileDir: undefined });
    // A page to look up the precons and verified decks to play
    const probe = await h.ctx.newPage();
    await probe.goto(`${h.server.url}/Spellslinger_Duels.html`);
    await probe.waitForFunction(() => typeof loadPreconList === 'function' && typeof VERIFIED_DECKS !== 'undefined');
    const extra = await probe.evaluate(async () => {
        let list = [];
        for (let k = 0; k < 5 && !list.length; k++) { try { list = await loadPreconList(); } catch (e) { await new Promise(r => setTimeout(r, 2000)); } }
        const pick = t => list.filter(p => p.type === t).map(p => p.file);
        const w = pick('Welcome Deck'), s = pick('Starter Kit'), pairs = [];
        for (let i = 0; i < 8; i++) pairs.push([w[(i * 7) % w.length], w[(i * 7 + 11) % w.length]]);
        for (let i = 0; i < 8; i++) pairs.push([s[(i * 3) % s.length], s[(i * 3 + 5) % s.length]]);
        return { precons: pairs, verified: VERIFIED_DECKS.map(d => d.key), verifiedText: Object.fromEntries(VERIFIED_DECKS.map(d => [d.key, d.text])) };
    });
    await probe.close();
    const out = [];
    const conc = Number(process.env.TEST_CONCURRENCY || 1);
    let next = 0;
    await Promise.all(Array.from({ length: conc }, async () => {
        while (next < games.length) {
            const g = games[next++];
            const r = await playOne(h.ctx, h.server.url, g, extra);
            out.push(r);
            process.stderr.write(`game ${out.length}/${games.length} ${g.kind} ${r.result ? r.result.turns + ' turns' : 'ERROR'}\n`);
        }
    }));
    const results = [];
    for (const kind of [...new Set(games.map(g => g.kind))]) {
        const mine = out.filter(g => g.kind === kind);
        const bad = mine.filter(g => !g.result || (g.invariants || []).length || (g.errors || []).length);
        results.push({ label: `${kind}: ${mine.length} games played to the end with no errors or broken cards`, ok: bad.length === 0,
            detail: bad.length ? JSON.stringify(bad.slice(0, 4).map(g => ({ q: g.q, error: g.error, inv: g.invariants, errors: g.errors && g.errors.slice(0, 2) }))) : `turns ${mine.map(g => g.result.turns).join(',')}` });
    }
    const good = printResults('games', results);
    writeOut('games', out);
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
