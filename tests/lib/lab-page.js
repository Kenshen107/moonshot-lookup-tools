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
    // Which waiting function is still pending when a game hangs (for the hang report)
    L.pending = {};
    ['askYes', 'askNumber', 'pickCard', 'pickMode', 'pickModes', 'pickScry', 'actDrain', 'settle', 'offerPriority', 'handTo', 'humanPay', 'runStack', 'activate', 'castSpell'].forEach(n => {
        const f = window[n]; if (typeof f !== 'function') return;
        window[n] = function (...a) { L.pending[n] = (L.pending[n] || 0) + 1; const r = f.apply(this, a); Promise.resolve(r).finally(() => { L.pending[n]--; }); return r; };
    });
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

    L.commanderDeck = style => {
        const commander = pickOf(cmdPool());
        const ci = commander.ci;
        const cand = L.auto.filter(c => c.legal.commander === 'legal' && c.id !== commander.id && inCI(c, ci) && rulesFor(c).kind !== 'land' && c.cmc < 7);
        const pool = style ? styleSort(style, shuf(cand), 3, rnd) : shuf(cand);
        const caps = style ? PLAYSTYLES[style].caps : CAPS;
        const lands = shuf(L.auto.filter(c => c.legal.commander === 'legal' && inCI(c, ci) && /Land/.test(c.type) && rulesFor(c).mana)).slice(0, ci.length > 1 ? 8 : 3);
        const picked = [], counts = {}, seen = new Set();
        for (const c of pool) {
            if (picked.length >= 62) break;
            const k = rulesFor(c).kind;
            if (seen.has(c.fullName) || (counts[k] || 0) >= (caps[k] ?? 6)) continue;
            seen.add(c.fullName); counts[k] = (counts[k] || 0) + 1; picked.push(c);
        }
        if (picked.length < 62) for (const c of pool) { if (picked.length >= 62) break; if (!seen.has(c.fullName)) { seen.add(c.fullName); picked.push(c); } } // relaxed fill
        const entries = [...picked.map(card => ({ card, n: 1 })), ...lands.map(card => ({ card, n: 1 }))];
        const split = landSplit(entries, ci, 99 - entries.length);
        Object.entries(split).forEach(([col, n]) => { if (n > 0 && L.basics[col]) entries.push({ card: CARDS.get(L.basics[col]), n }); });
        return { name: `${commander.name} (lab)`, format: 'commander', commander, entries, source: 'lab', aiStyle: style || null };
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

    // ---- Political decks (for finding fun pods): the cards a theme likes, read from card text ----
    const T_ = (re, w) => [new RegExp(re, 'i'), w];
    L.THEMES = {
        fort: { name: 'Pillow Fort', style: 'control', caps: { creature: 18, instant: 8, sorcery: 6, artifact: 12, enchantment: 16 },
            w: [T_("can't attack you|attack you or a planeswalker|creatures can't attack|can't attack unless", 8), T_('\\bdefender\\b', 2), T_('gain \\d+ life', 1.5), T_('draw (a|two|three) cards?', 1.5), T_("prevent all (combat )?damage|fog", 3), T_('\\bhexproof\\b|\\bprotection from\\b', 1.5), T_('enters? tapped|doesn\\u2019t untap|tap target', 1)],
            cmd: T_("can't attack|defender|gain \\d+ life|draw", 1) },
        thief: { name: 'Thief', style: 'aggro', caps: { creature: 26, instant: 8, sorcery: 14, artifact: 6, enchantment: 6 },
            w: [T_('gain control of (target|up to)', 8), T_('\\bhaste\\b', 2), T_('sacrifice (it|that creature|those creatures)|until end of turn', 1.5), T_('exchange control', 6), T_('copy target', 2), T_('untap (it|that creature|target creature)', 2)],
            cmd: T_('gain control|haste|steal', 1) },
        hug: { name: 'Group Hug', style: 'ramp', caps: { creature: 22, instant: 6, sorcery: 12, artifact: 14, enchantment: 10 },
            w: [T_('each player (draws|may|gains|puts|untaps|creates)', 6), T_('monarch', 8), T_('\\bvote\\b|tempting offer|council', 6), T_('target (player|opponent) (draws|gains|creates)', 3), T_('add (one|two|\\{)', 2), T_('search your library for [^.]*land', 1.5)],
            cmd: T_('each player|monarch|draws? a card', 1) },
        drain: { name: 'Table Drain', style: 'midrange', caps: { creature: 24, instant: 10, sorcery: 10, artifact: 8, enchantment: 10 },
            w: [T_('each opponent loses', 6), T_('deals? \\d+ damage to each opponent', 6), T_('whenever an opponent', 3), T_('gain \\d+ life', 1), T_('each opponent (sacrifices|discards)', 4), T_('drain|life equal to', 2)],
            cmd: T_('each opponent|whenever an opponent', 1) },
        assassin: { name: 'Edict & Removal', style: 'control', caps: { creature: 18, instant: 14, sorcery: 14, artifact: 6, enchantment: 6 },
            w: [T_('(each|target) opponent sacrifices|sacrifices a creature|choose an opponent', 7), T_('destroy target (creature|permanent)', 4), T_('exile target (creature|permanent)', 4), T_('deals? \\d+ damage to (target|any target)', 2), T_('target creature gets -\\d+/-\\d+', 3)],
            cmd: T_('destroy|sacrifice|exile', 1) },
        bully: { name: 'Big Bully', style: 'voltron', caps: { creature: 28, instant: 6, sorcery: 6, artifact: 12, enchantment: 10 },
            w: [T_('\\b(trample|menace|flying)\\b', 2.5), T_('\\bhaste\\b', 2), T_('equipped creature|enchanted creature gets \\+', 4), T_('gets? \\+\\d+/\\+\\d+', 1.5), T_("must be blocked|can\\u2019t be blocked|can't be blocked", 3)],
            cmd: T_('trample|haste|menace|flying', 1) }
    };
    L.THEME_KEYS = Object.keys(L.THEMES);
    L.themeFit = (th, c) => { const t = String(c.text || ''); return th.w.reduce((a, [re, w]) => a + (re.test(t) ? w : 0), 0); };
    L.themeDeck = key => {
        const th = L.THEMES[key];
        // The commander: a legendary creature in 1-3 colors whose text fits, from the best few dozen
        const cands = cmdPool().map(c => ({ c, k: L.themeFit(th, c) + (th.cmd[0].test(c.text || '') ? 3 : 0) + rnd() * 2 })).sort((a, b) => b.k - a.k).slice(0, 40).map(x => x.c);
        const commander = pickOf(cands), ci = commander.ci;
        const cand = L.auto.filter(c => c.legal.commander === 'legal' && c.id !== commander.id && inCI(c, ci) && rulesFor(c).kind !== 'land' && c.cmc < 7);
        const pool = cand.map(c => ({ c, k: L.themeFit(th, c) + (styleFit(th.style, c) * 0.4) + rnd() * 3 })).sort((a, b) => b.k - a.k).map(x => x.c);
        const lands = shuf(L.auto.filter(c => c.legal.commander === 'legal' && inCI(c, ci) && /Land/.test(c.type) && rulesFor(c).mana)).slice(0, ci.length > 1 ? 8 : 3);
        const picked = [], counts = {}, seen = new Set();
        for (const c of pool) { if (picked.length >= 62) break; const k = rulesFor(c).kind; if (seen.has(c.fullName) || (counts[k] || 0) >= (th.caps[k] ?? 6)) continue; seen.add(c.fullName); counts[k] = (counts[k] || 0) + 1; picked.push(c); }
        for (const c of pool) { if (picked.length >= 62) break; if (!seen.has(c.fullName)) { seen.add(c.fullName); picked.push(c); } }
        const entries = [...picked.map(card => ({ card, n: 1 })), ...lands.map(card => ({ card, n: 1 }))];
        const split = landSplit(entries, ci, 99 - entries.length);
        Object.entries(split).forEach(([col, n]) => { if (n > 0 && L.basics[col]) entries.push({ card: CARDS.get(L.basics[col]), n }); });
        return { name: `${commander.name} (${th.name})`, format: 'commander', commander, entries, source: 'lab', aiStyle: th.style, theme: key };
    };

    // A fixed decklist for seat A (lab.js --decka file.txt): "N Name" lines, the commander in the last block. Cards come from the offline pool by name.
    L.listDeck = text => {
        const byName = new Map(); L.pool.forEach(c => { if (!byName.has(c.fullName)) byName.set(c.fullName, c); if (!byName.has(c.name)) byName.set(c.name, c); });
        const blocks = text.trim().split(/\n\s*\n/), entries = [];
        let commander = null;
        const read = (blk, isCmd) => blk.split('\n').forEach(l => { const m = l.match(/^(\d+)\s+(.+)$/); if (!m) return; const c = byName.get(m[2].trim()); if (!c) throw new Error('deck: unknown card ' + m[2]); if (isCmd) commander = c; else entries.push({ card: c, n: Number(m[1]) }); });
        read(blocks[0], false); if (blocks[1]) read(blocks[1], true);
        const sm = text.match(/^\s*(?:#|\/\/)\s*style:\s*(\w+)/m); // an optional first line "# style: aggro" picks the playstyle (default control)
        return { name: `${commander ? commander.name : 'List'} (list)`, format: 'commander', commander, entries, source: 'lab', aiStyle: sm ? sm[1] : 'control' };
    };

    // One game. opts: { seed, kind: 'commander'|'modern', la, lb, timeout }. Returns a plain result object.
    L.play = async opts => {
        console.log('LABSEED ' + opts.seed);
        seeded(opts.seed); Math.random = rnd;
        const t0 = performance.now();
        const out = { seed: opts.seed };
        const errs = [];
        const onErr = e => errs.push(String(e.message || e));
        window.addEventListener('error', onErr);
        try {
            const kind = opts.kind === 'mix' ? (opts.seed % 2 ? 'modern' : 'commander') : opts.kind; out.kind = kind;
            const build = kind === 'modern' ? L.modernDeck : L.commanderDeck;
            // Styles: 'none' (the old way), 'random' (a different style for every seat) or one style name for every seat
            const n = opts.players || 2, mode = opts.styles || (n > 2 ? 'random' : 'none');
            // the style draw uses its own generator (hashed from the seed) so neighbouring seeds don't line styles up with seats
            const hs = (opts.seed * 2654435761) >>> 0; let hseed = hs;
            const hrnd = () => { hseed = (hseed + 0x6D2B79F5) >>> 0; let t = hseed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
            const hshuf = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(hrnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
            const styles = mode === 'none' ? Array(n).fill(null) : mode === 'random' ? hshuf(PLAYSTYLE_KEYS).slice(0, n) : Array(n).fill(mode);
            out.styles = styles;
            let A, B, more;
            if (kind === 'ascent') {
                // Planeswalker's Ascent: two opponents' decks from the roster (seed picks the pair, and each seat's tier sets its AI level)
                await loadAscentRoster();
                const i = opts.seed % ASCENT_OPPONENTS.length, j = (i + 1 + Math.floor(opts.seed / ASCENT_OPPONENTS.length) % (ASCENT_OPPONENTS.length - 1)) % ASCENT_OPPONENTS.length;
                const mk = o => { const d = ascentDeckEntries(o.name, ascentOpponentDeck(o)); d.aiStyle = o.style; return d; };
                A = mk(ASCENT_OPPONENTS[i]); B = mk(ASCENT_OPPONENTS[j]); more = [];
                out.styles = [A.aiStyle, B.aiStyle];
            } else if (opts.themes) {
                // Political decks: 'random' = a different theme at every seat, or a list like fort,thief,hug,drain
                const keys = opts.themes === 'random' ? hshuf(L.THEME_KEYS).slice(0, n) : String(opts.themes).split(',');
                out.themes = keys.slice(0, n);
                const ds = out.themes.map(k => L.themeDeck(k));
                A = ds[0]; B = ds[1]; more = ds.slice(2);
                out.styles = ds.map(d => d.aiStyle);
            } else {
                A = build(styles[0]); B = build(styles[1]);
                more = Array.from({ length: Math.max(0, n - 2) }, (_, k) => build(styles[2 + k]));
            }
            if (opts.deckA) { A = L.listDeck(opts.deckA); out.styles[0] = A.aiStyle || null; }
            A.aiLevel = opts.la || 'normal'; B.aiLevel = opts.lb || 'normal';
            more.forEach(d => { d.aiLevel = opts.lb || 'normal'; });
            out.cmds = [A, B, ...more].map(d => d.commander ? d.commander.name : d.name);
            out.a = A.commander ? A.commander.name : A.name; out.b = B.commander ? B.commander.name : B.name;
            if (more.length) out.pod = [A, B, ...more].map(d => d.commander ? d.commander.name : d.name);
            window.lastResult = null; L.pending = {};
            // A probe for the fixed decklist at seat A (lab.js --decka): at the start of each of A's turns, how much mana A could spend, how many cards it has seen, and what it has in play
            let unprobe = null;
            if (opts.deckA) {
                out.probe = []; const of = window.fire; let lastKey = '';
                window.fire = function (ev, ctx) {
                    if (ev === 'main1' && G && G.players && G.active === 0 && G.players[0] && `${G.turn}` !== lastKey) {
                        lastKey = `${G.turn}`; const Q = G.players[0];
                        let m = 0; try { while (m < 30 && planPayment(Q, parseCost(''), m + 1)) m++; } catch (e) { m = -1; }
                        out.probe.push({ t: out.probe.length + 1, mana: m, hand: Q.hand.length, lib: Q.library.length, lands: Q.bf.filter(x => /\bLand\b/.test(x.card.type)).length, rocks: Q.bf.filter(x => !/\bLand\b/.test(x.card.type) && manaOf(x)).length, creatures: Q.bf.filter(isCreature).length, life: Q.life });
                    }
                    if (ev === 'combat' && G && G.active === 0 && out.probe.length && !out.probe[out.probe.length - 1].cap) { // mana the player could use this turn: every untapped-or-tapped mana source it has in play now (summoning-sick creatures can't tap)
                        const Q = G.players[0]; let cap = 0;
                        for (const x of Q.bf) { const mo = typeof manaOf === 'function' ? manaOf(x) : null; if (!mo) continue; if (isCreature(x) && x.sick) continue; cap += mo.n || 1; }
                        const pr = out.probe[out.probe.length - 1]; pr.cap = cap;
                        pr.landsC = Q.bf.filter(x => /\bLand\b/.test(x.card.type)).length; pr.rocksC = Q.bf.filter(x => !/\bLand\b/.test(x.card.type) && manaOf(x)).length;
                        pr.rocksHand = Q.hand.filter(x => !/\bLand\b/.test(x.card.type) && Rx(x).mana).length; pr.rocksUnspent = Q.hand.filter(x => !/\bLand\b/.test(x.card.type) && Rx(x).mana && (x.card.cmc || 0) <= cap).length; pr.untappedMana = Q.bf.filter(x => !x.tapped && manaOf(x)).reduce((a, x) => a + ((manaOf(x) || {}).n || 1), 0); pr.landsHand = Q.hand.filter(x => /\bLand\b/.test(x.card.type)).length;
                    }
                    return of.apply(this, arguments);
                };
                unprobe = () => { window.fire = of; };
            }
            await newGame(A, B, null, more);
            const limit = opts.timeout || 60000;
            while (!window.lastResult && performance.now() - t0 < limit) await new Promise(r => setTimeout(r, 0));
            if (!window.lastResult) { out.hang = true; out.alive = G.players.map(P => P.out ? 'x' : P.life).join(','); out.turn = G.turn; out.phase = G.phase; out.diag = { pending: Object.entries(L.pending).filter(e => e[1] > 0).map(e => e.join(':')).join(','), active: G.active, busy: G.busy, mode: G.mode && G.mode.type, stack: G.stack.length, running: G.stackRunning, hand: G.players.map(P => P.hand.length), last: G.log.slice(-4) }; G.over = true; }
            else Object.assign(out, window.lastResult);
            if (opts.watch) { // a card with one enters-the-battlefield trigger: more triggers than entries means it fired twice (lab.js --watch "Card Name")
                const lines = G.log.map(l => l.text || l), name = opts.watch;
                const trig = lines.filter(l => l === `${name}'s ability triggers.`).length;
                const ent = lines.filter(l => l.startsWith(`${name} enters the battlefield`) || l.includes(`as a copy of ${name}`) || l.includes(`token copy of ${name}`) || l.startsWith(`${name} enters as a copy`)).length;
                if (trig > ent) out.watch = { name, trig, ent };
            }
            if (unprobe) unprobe();
            out.bad = T.invariants(); if (G.dealStats) out.deals = G.dealStats; if (G.pol) out.pol = G.pol;
            if (out.bad.length) out.zones = G.players.map(P => ['hand', 'bf', 'gy', 'exile', 'library', 'command'].map(z => z + ':' + (P[z] || []).filter(x => x.isCommander).length).join(' '));
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
