// Runs inside the game page (injected by tests/lab.js). Offline: every card comes from tests/data/cards_all.json,
// decks are built from it at random, and games are played back to back in this one page with a seeded random generator.
window.LAB = (() => {
    const L = {};
    // Seeded random numbers (mulberry32): the same seed replays the same game
    let seed = 1;
    const seeded = s => { seed = s >>> 0; };
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const realRandom = Math.random;
    const pickOf = a => a[Math.floor(rnd() * a.length)];
    const shuf = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

    // No drawing: the lab only needs the rules, not the table
    window.renderGame = () => {};
    window.log = msg => { G.log.push(msg); if (G.log.length > 400) G.log.shift(); };
    L.load = (raw, autoNames) => {
        const t0 = performance.now();
        L.pool = [];
        const ok = new Set(autoNames);
        // Only the cards the game fully plays (names from tests/baseline_full_cards.txt) plus basic lands: reading every card's rules takes half a minute
        for (const c of raw) {
            if (!ok.has(c.name) && !/^Basic Land/.test(c.type_line || '')) continue;
            const s = slimCard(c);
            CARDS.set(s.id, s);
            if (c.edhrec_rank) s.rank = c.edhrec_rank;
        }
        L.pool = [...CARDS.values()].filter(c => !c.id.endsWith('-b') && c.layout !== 'token');
        L.basics = {};
        for (const [col, name] of Object.entries(BASIC_FOR)) { const c = L.pool.find(x => x.name === name && isBasic(x) && !/Snow/.test(x.type)); if (c) { L.basics[col] = c.id; BASIC_IDS[col] = c.id; } }
        L.auto = L.pool.filter(c => !isBasic(c) && ok.has(c.fullName) && rulesFor(c).support === 'full');
        L.loadMs = Math.round(performance.now() - t0);
        return { cards: L.pool.length, automated: L.auto.length, ms: L.loadMs };
    };

    const cmdPool = () => L.cmdPool || (L.cmdPool = L.auto.filter(c => /Legendary/.test(c.type) && /Creature/.test(c.type) && rulesFor(c).kind === 'creature' && c.legal.commander === 'legal' && c.ci.length >= 1 && c.ci.length <= 3 && c.cmc <= 7));
    const inCI = (c, ci) => c.ci.every(x => ci.includes(x));
    const CAPS = { creature: 27, instant: 11, sorcery: 11, artifact: 12, enchantment: 8 };

    L.commanderDeck = () => {
        const commander = pickOf(cmdPool());
        const ci = commander.ci;
        const pool = shuf(L.auto.filter(c => c.legal.commander === 'legal' && c.id !== commander.id && inCI(c, ci) && rulesFor(c).kind !== 'land' && c.cmc < 7));
        const lands = shuf(L.auto.filter(c => c.legal.commander === 'legal' && inCI(c, ci) && /Land/.test(c.type) && rulesFor(c).mana)).slice(0, ci.length > 1 ? 8 : 3);
        const picked = [], counts = {}, seen = new Set();
        for (const c of pool) {
            if (picked.length >= 62) break;
            const k = rulesFor(c).kind;
            if (seen.has(c.fullName) || (counts[k] || 0) >= (CAPS[k] ?? 6)) continue;
            seen.add(c.fullName); counts[k] = (counts[k] || 0) + 1; picked.push(c);
        }
        const entries = [...picked.map(card => ({ card, n: 1 })), ...lands.map(card => ({ card, n: 1 }))];
        const split = landSplit(entries, ci, 99 - entries.length);
        Object.entries(split).forEach(([col, n]) => { if (n > 0 && L.basics[col]) entries.push({ card: CARDS.get(L.basics[col]), n }); });
        return { name: `${commander.name} (lab)`, format: 'commander', commander, entries, source: 'lab' };
    };
    const PAIRS = ['WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG'];
    L.modernDeck = () => {
        const colors = pickOf(PAIRS).split('');
        const pool = shuf(L.auto.filter(c => c.legal.modern === 'legal' && !/Land/.test(c.type) && c.cmc <= 5 && inCI(c, colors) && ['creature', 'instant', 'sorcery', 'artifact', 'enchantment'].includes(rulesFor(c).kind)));
        const entries = []; let total = 0; const kinds = {};
        for (const c of pool) {
            if (total >= 36) break;
            const k = rulesFor(c).kind;
            if ((kinds[k] || 0) >= (k === 'creature' ? 16 : 5)) continue;
            const n = Math.min(36 - total, c.cmc <= 2 ? 4 : c.cmc <= 4 ? 3 : 2);
            entries.push({ card: c, n }); total += n; kinds[k] = (kinds[k] || 0) + 1;
        }
        const split = landSplit(entries, colors, 60 - total);
        Object.entries(split).forEach(([col, n]) => { if (n > 0 && L.basics[col]) entries.push({ card: CARDS.get(L.basics[col]), n }); });
        return { name: colors.join('') + ' (lab)', format: 'modern', commander: null, entries, source: 'lab' };
    };

    // One game. opts: { seed, kind: 'commander'|'modern', la, lb, timeout }. Returns a plain result object.
    L.play = async opts => {
        seeded(opts.seed); Math.random = rnd;
        const t0 = performance.now();
        const out = { seed: opts.seed };
        const errs = [];
        const onErr = e => errs.push(String(e.message || e));
        window.addEventListener('error', onErr);
        try {
            const kind = opts.kind === 'mix' ? (opts.seed % 2 ? 'modern' : 'commander') : opts.kind; out.kind = kind;
            const build = kind === 'modern' ? L.modernDeck : L.commanderDeck;
            const A = build(), B = build();
            A.aiLevel = opts.la || 'normal'; B.aiLevel = opts.lb || 'normal';
            out.a = A.commander ? A.commander.name : A.name; out.b = B.commander ? B.commander.name : B.name;
            window.lastResult = null;
            await newGame(A, B);
            const limit = opts.timeout || 60000;
            while (!window.lastResult && performance.now() - t0 < limit) await new Promise(r => setTimeout(r, 0));
            if (!window.lastResult) { out.hang = true; out.turn = G.turn; out.phase = G.phase; out.diag = { active: G.active, busy: G.busy, mode: G.mode && G.mode.type, stack: G.stack.length, running: G.stackRunning, hand: G.players.map(P => P.hand.length), last: G.log.slice(-4) }; G.over = true; }
            else Object.assign(out, window.lastResult);
            out.bad = T.invariants();
        } catch (e) { out.error = String(e && e.stack || e).slice(0, 400); }
        window.removeEventListener('error', onErr);
        Math.random = realRandom;
        if (errs.length) out.errors = errs.slice(0, 3);
        out.ms = Math.round(performance.now() - t0);
        return out;
    };
    // Many games in a row
    L.batch = async (from, count, opts) => {
        const res = [];
        for (let i = 0; i < count; i++) res.push(await L.play({ ...opts, seed: from + i }));
        return res;
    };
    return L;
})();
