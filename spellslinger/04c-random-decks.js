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

async function buildRandomCommanderDeck(commander) {
    await loadBasics();
    commander = commander || await pickRandomCommander();
    const ci = commander.ci.filter(c => BASIC_IDS[c]);
    const q = `f:commander game:paper ${colorQuery(ci)} -is:commander -is:funny`;
    const [spellPool, landPool] = await Promise.all([
        searchCards(`${q} -t:land`, 4, 'edhrec'),
        searchCards(`${q} t:land -t:basic`, 2, 'edhrec')
    ]);
    const spells = shuffled(spellPool.filter(c => isFullAuto(c) && c.id !== commander.id && rulesFor(c).kind !== 'land').slice(0, 330));
    const picked = [], counts = {}, seen = new Set();
    let big = 0;
    const take = (c, relaxed) => {
        const k = rulesFor(c).kind;
        if (seen.has(c.fullName)) return false;
        if (!relaxed && (counts[k] || 0) >= (RANDOM_CMD_CAPS[k] ?? 6)) return false;
        if (c.cmc >= 7) { if (big >= 2) return false; big++; }
        seen.add(c.fullName); counts[k] = (counts[k] || 0) + 1; picked.push(c);
        return true;
    };
    const SPELLS = 62;
    for (const c of spells) { if (picked.length >= SPELLS) break; take(c, false); }
    for (const c of spells) { if (picked.length >= SPELLS) break; take(c, true); }
    // Nonbasic lands that make mana (a handful; the rest are basics)
    const mana = shuffled(landPool.filter(c => isFullAuto(c) && rulesFor(c).mana).slice(0, 30)).slice(0, ci.length > 1 ? 9 : 3);
    const entries = [...picked.map(card => ({ card, n: 1 })), ...mana.map(card => ({ card, n: 1 }))];
    const basicCount = 99 - entries.length;
    const split = landSplit(entries, ci, basicCount);
    Object.entries(split).forEach(([col, n]) => { if (n > 0 && BASIC_IDS[col]) entries.push({ card: CARDS.get(BASIC_IDS[col]), n }); });
    return { name: `${commander.name} (random)`, format: 'commander', commander, entries, swapped: 0, source: 'random playable deck: every card is fully automated' };
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
