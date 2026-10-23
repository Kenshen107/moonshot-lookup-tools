// Spellslinger Duels - random playable decks (2026-10-14, owner's request: "make the AI opponents build decks randomly from the pool of
// cards that we have built and automated ... Commander would be fun against a random deck that was playable").
// Every card in these decks reads as fully Automated (`rulesFor(card).support === 'full'`), so the computer never sits on a card it can't use.
// Commander: a random Automated legendary creature, then a shuffle of the most-played Automated cards in its colors (Scryfall, EDHREC order),
// shaped by type limits, plus nonbasic lands that make mana and basics split by color symbols. Modern: two random colors, the same idea with 4-ofs.
const RANDOM_CMD_CAPS = { creature: 27, instant: 11, sorcery: 11, artifact: 12, enchantment: 8, planeswalker: 0, battle: 0 };
const shuffled = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const isFullAuto = c => { const r = rulesFor(c); return r.support === 'full' && !isBasic(c); };
const colorQuery = ci => `id<=${ci.join('').toLowerCase() || 'c'}`;

async function pickRandomCommander() {
    const pool = (await searchCards('is:commander t:legendary t:creature game:paper f:commander -is:funny', 5, 'edhrec'))
        .filter(c => isFullAuto(c) && rulesFor(c).kind === 'creature' && c.ci.length >= 1 && c.ci.length <= 3 && c.cmc <= 7);
    if (!pool.length) throw new Error("Couldn't find a commander the game fully plays.");
    // Mostly the well-known ones, sometimes a deeper cut
    const top = pool.slice(0, Math.min(pool.length, 160)), rest = pool.slice(160);
    return Math.random() < 0.75 || !rest.length ? top[Math.floor(Math.random() * top.length)] : rest[Math.floor(Math.random() * rest.length)];
}

const pickOne = a => a[Math.floor(Math.random() * a.length)];
// A commander from a themed list: mostly the well-known ones, sometimes a deeper cut
const pickThemed = pool => { const top = pool.slice(0, Math.min(pool.length, 60)), rest = pool.slice(60); return Math.random() < 0.8 || !rest.length ? pickOne(top) : pickOne(rest); };

// `style` (a key of PLAYSTYLES, 07b-playstyles.js) shapes the card choices; with none, one that fits the theme is picked so every opponent has a way of playing.
// `themeArg` (04f-deck-themes.js): a theme key or theme to force, 'none' for the old unthemed shuffle, or nothing for a random theme.
async function buildRandomCommanderDeck(commander, style, themeArg) {
    await loadBasics();
    const styleGiven = !!style, forced = themeArg && themeArg !== 'none' ? themeArg : null;
    let theme = themeArg === 'none' ? null : pickDeckTheme(style, forced);
    let themedCards = [];
    const tried = [];
    try {
    for (let attempt = 0; attempt < 4 && theme; attempt++) {
        tried.push(theme.key);
        let c = commander;
        if (!c) { const cs = await themeCommanders(theme); c = cs.length ? pickThemed(cs) : await pickRandomCommander(); }
        const tc = await themeCards(theme, c.ci.filter(x => BASIC_IDS[x]), c);
        if (tc.length >= theme.min || (forced && attempt >= 1 && tc.length >= 3)) { commander = c; themedCards = tc; break; }
        if (forced) continue; // a forced theme gets another commander
        theme = pickDeckTheme(style, null, tried);
    }
    } catch (e) { console.warn('Deck theme lookup failed, building an unthemed deck:', e); theme = null; themedCards = []; } // Scryfall unreachable or busy: the old shuffle still works
    if (themedCards.length < 3) theme = null;
    style = styleGiven ? style : theme ? pickOne(theme.styles) : PLAYSTYLE_KEYS[Math.floor(Math.random() * PLAYSTYLE_KEYS.length)];
    commander = commander || await pickRandomCommander();
    const ci = commander.ci.filter(c => BASIC_IDS[c]);
    const q = `f:commander game:paper ${colorQuery(ci)} -is:commander -is:funny`;
    const [spellPool, landPool] = await Promise.all([
        searchCards(`${q} -t:land`, 4, 'edhrec'),
        searchCards(`${q} t:land -t:basic`, 2, 'edhrec')
    ]);
    const spells = styleSort(style, shuffled(spellPool.filter(c => isFullAuto(c) && c.id !== commander.id && rulesFor(c).kind !== 'land').slice(0, 330)));
    const caps = PLAYSTYLES[style].caps;
    const picked = [], counts = {}, seen = new Set();
    let big = 0;
    const take = (c, relaxed, capsUsed) => {
        const k = rulesFor(c).kind, cp = capsUsed || caps;
        if (seen.has(c.fullName)) return false;
        if (!relaxed && (counts[k] || 0) >= (cp[k] ?? RANDOM_CMD_CAPS[k] ?? 6)) return false;
        if (c.cmc >= 7) { if (big >= 2) return false; big++; }
        seen.add(c.fullName); counts[k] = (counts[k] || 0) + 1; picked.push(c);
        return true;
    };
    const SPELLS = 62;
    // The theme's own cards first (the most-played ones, shuffled), a little over the style's usual type limits
    let themed = 0;
    if (theme) {
        const capsT = Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, v + 8]));
        for (const c of shuffled(themedCards.slice(0, 160))) { if (themed >= theme.take || picked.length >= SPELLS) break; if (take(c, false, capsT)) themed++; }
    }
    for (const c of spells) { if (picked.length >= SPELLS) break; take(c, false); }
    for (const c of spells) { if (picked.length >= SPELLS) break; take(c, true); }
    // Nonbasic lands that make mana (a handful; the rest are basics)
    const mana = shuffled(landPool.filter(c => isFullAuto(c) && rulesFor(c).mana).slice(0, 30)).slice(0, ci.length > 1 ? 9 : 3);
    const entries = [...picked.map(card => ({ card, n: 1 })), ...mana.map(card => ({ card, n: 1 }))];
    const basicCount = 99 - entries.length;
    const split = landSplit(entries, ci, basicCount);
    Object.entries(split).forEach(([col, n]) => { if (n > 0 && BASIC_IDS[col]) entries.push({ card: CARDS.get(BASIC_IDS[col]), n }); });
    const tinfo = theme ? { key: theme.key, name: theme.name, emoji: theme.emoji, cards: themed } : null;
    return { name: `${commander.name} (${theme ? theme.name : 'random'})`, format: 'commander', commander, entries, swapped: 0, aiStyle: style, theme: tinfo,
        source: `random ${PLAYSTYLES[style].name}${theme ? ` ${theme.name} (${themed} theme cards)` : ''} deck: every card is fully automated` };
}

// A typed commander's own random build (owner, 2026-10-23: "type in a deck and it builds a random deck from EDHREC"): every card
// EDHREC lists for the commander is drawn at random, weighted by how many of its decks play it, so popular cards show up often
// and no two builds match. Only fully automated cards are used; basics fill the rest by color symbols.
async function buildEdhrecRandomDeck(slug) {
    await loadBasics();
    const res = await fetch(`${EDH}/commanders/${slug}.json`);
    if (!res.ok) throw new Error('EDHREC has no page for that commander');
    const json = await res.json();
    const lists = (json.container && json.container.json_dict && json.container.json_dict.cardlists) || [];
    const cmdName = ((json.container.json_dict.card || {}).name) || (json.header || '').replace(/ \(.*$/, '');
    const seen = new Set(), pool = [];
    for (const l of lists) {
        if (/^(newcards|topcards|gamechangers)$/.test(l.tag || '')) continue; // repeats of cards listed in the other groups
        for (const v of l.cardviews || []) {
            const k = String(v.name).toLowerCase();
            if (seen.has(k) || !v.potential_decks) continue;
            seen.add(k); pool.push({ name: v.name, rate: v.num_decks / v.potential_decks, land: /land/.test(l.tag || '') });
        }
    }
    const byName = await cardsByNames([cmdName, ...pool.map(x => x.name)]);
    const commander = byName.get(String(cmdName).toLowerCase());
    if (!commander) throw new Error(`Couldn't find ${cmdName}`);
    const ci = commander.ci.filter(c => BASIC_IDS[c]);
    // weighted draw without repeats: the key -ln(u) / weight is smallest for heavy cards
    const draw = list => list.map(x => ({ x, k: -Math.log(1 - Math.random()) / Math.max(0.002, x.rate) })).sort((a, b) => a.k - b.k).map(o => o.x);
    const usable = pool.map(x => ({ ...x, card: byName.get(x.name.toLowerCase()) })).filter(x => x.card && x.card.id !== commander.id && isFullAuto(x.card) && !isBasic(x.card));
    const spells = draw(usable.filter(x => !x.land && rulesFor(x.card).kind !== 'land')).slice(0, 63);
    const lands = draw(usable.filter(x => x.land || rulesFor(x.card).kind === 'land').filter(x => rulesFor(x.card).mana)).slice(0, ci.length > 1 ? 10 : 4);
    const entries = [...spells, ...lands].map(x => ({ card: x.card, n: 1 }));
    // basics split by color symbols in the chosen cards (plus one each so no color of the identity is left without a land)
    const need = 99 - entries.length, split = {};
    const w = Object.fromEntries(ci.map(c => [c, 1 + entries.reduce((a, e) => a + (e.card.cost.split(`{${c}}`).length - 1), 0)]));
    const wt = Object.values(w).reduce((a, b) => a + b, 0);
    let left = need;
    ci.forEach(c => { split[c] = Math.floor(need * w[c] / wt); left -= split[c]; });
    for (let i = 0; left > 0 && ci.length; i++, left--) split[ci[i % ci.length]]++;
    Object.entries(split).forEach(([col, n]) => { if (n > 0 && BASIC_IDS[col]) entries.push({ card: CARDS.get(BASIC_IDS[col]), n }); });
    if (!ci.length) entries.push({ card: CARDS.get(BASIC_IDS.W), n: 99 - entries.reduce((a, e) => a + e.n, 0) });
    return { name: commander.name, format: 'commander', commander, entries, swapped: 0, source: `random build from EDHREC's ${commander.name} cards (${spells.length} spells and ${lands.length} nonbasic lands drawn by how often decks play them; every card is fully automated)` };
}

// Modern: two random colors, 24 lands, four-ofs of the most-played Automated cards
const RANDOM_MODERN_PAIRS = ['wu', 'wb', 'wr', 'wg', 'ub', 'ur', 'ug', 'br', 'bg', 'rg'];
async function buildRandomModernDeck() {
    await loadBasics();
    const pair = RANDOM_MODERN_PAIRS[Math.floor(Math.random() * RANDOM_MODERN_PAIRS.length)];
    const colors = pair.toUpperCase().split('');
    const q = `f:modern game:paper id<=${pair} -t:land cmc<=5 -is:funny`;
    const pool = shuffled((await searchCards(q, 4, 'edhrec')).filter(c => isFullAuto(c) && ['creature', 'instant', 'sorcery', 'artifact', 'enchantment'].includes(rulesFor(c).kind)).slice(0, 260));
    const entries = [];
    let total = 0;
    const kinds = {};
    for (const c of pool) {
        if (total >= 36) break;
        const k = rulesFor(c).kind;
        if ((kinds[k] || 0) >= (k === 'creature' ? 16 : 5)) continue;
        const n = Math.min(36 - total, c.cmc <= 2 ? 4 : c.cmc <= 4 ? 3 : 2);
        entries.push({ card: c, n }); total += n; kinds[k] = (kinds[k] || 0) + 1;
    }
    const split = landSplit(entries, colors, 60 - total);
    Object.entries(split).forEach(([col, n]) => { if (n > 0 && BASIC_IDS[col]) entries.push({ card: CARDS.get(BASIC_IDS[col]), n }); });
    return { name: `${colors.map(c => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' })[c]).join('-')} random`, format: 'modern', commander: null, entries, source: 'random playable deck: every card is fully automated' };
}
