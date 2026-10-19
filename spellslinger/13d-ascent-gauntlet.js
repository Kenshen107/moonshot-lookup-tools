// Planeswalker's Ascent, part 2: the opponents, their decks, signature cards, prizes and progress (plan: docs/spellslinger-ascent-plan.md).
// Three tiers of five opponents and a Planeswalker boss. Every opponent is the same each time you meet them: the deck is built from the
// roster (13c-ascent.js) with a seeded random generator, so the farming targets stay put. The screen that shows all this comes in the next step.
const ASCENT_TIERS = [
    { tier: 1, key: 'locals', icon: '🏡', name: 'The Locals', level: 'easy', desc: 'Slow decks: vanilla creatures and plain keywords.', maxTier: 1 },
    { tier: 2, key: 'grinders', icon: '🎲', name: 'Friday Grinders', level: 'normal', desc: 'Real archetypes, tapped duals and a few spells.', maxTier: 2 },
    { tier: 3, key: 'pro', icon: '🏆', name: 'The Pro Circuit', level: 'hard', desc: 'The best simple cards in the pool, played well.', maxTier: 3 }
];
// name, colors, archetype, style. The last of each tier is the Planeswalker boss.
const ASCENT_OPPONENTS = [
    { id: 't1-mick', tier: 1, name: 'Mossback Mick', colors: 'G', arch: 'stomp', style: 'midrange', blurb: 'Big green bodies, no tricks.' },
    { id: 't1-annie', tier: 1, name: 'Candle Annie', colors: 'W', arch: 'weenie', style: 'aggro', blurb: 'Lots of little white creatures.' },
    { id: 't1-tess', tier: 1, name: 'Tidepool Tess', colors: 'U', arch: 'fliers', style: 'tokens', blurb: 'Every creature flies. Bring reach.' },
    { id: 't1-gus', tier: 1, name: 'Gravedigger Gus', colors: 'B', arch: 'value', style: 'midrange', blurb: 'Deathtouch and life gain.' },
    { id: 't1-cal', tier: 1, name: 'Cinder Cal', colors: 'R', arch: 'burn', style: 'aggro', blurb: 'Haste, then burn to the face.' },
    { id: 't1-boss', tier: 1, name: 'Greg the Stomper', colors: 'GW', arch: 'stomp', style: 'midrange', boss: true, blurb: 'Boss. The biggest things the Locals have ever seen.' },
    { id: 't2-sasha', tier: 2, name: 'Skyline Sasha', colors: 'UW', arch: 'fliers', style: 'tokens', blurb: 'Fliers with tricks to protect them.' },
    { id: 't2-ike', tier: 2, name: 'Ironhide Ike', colors: 'RW', arch: 'weenie', style: 'aggro', blurb: 'First strike and pump spells.' },
    { id: 't2-marcus', tier: 2, name: 'Marsh Marcus', colors: 'BG', arch: 'value', style: 'midrange', blurb: 'Deathtouch, lifelink and removal.' },
    { id: 't2-sarah', tier: 2, name: 'Spellsmith Sarah', colors: 'UR', arch: 'burn', style: 'spellslinger', blurb: 'Burn, draw and a few fliers.' },
    { id: 't2-leo', tier: 2, name: 'Tangle Leo', colors: 'GU', arch: 'tempo', style: 'midrange', blurb: 'Reach, bounce and big finishers.' },
    { id: 't2-boss', tier: 2, name: 'Marcus the Warden', colors: 'UB', arch: 'control', style: 'control', boss: true, blurb: 'Boss. Removal, bounce and card draw.' },
    { id: 't3-brenda', tier: 3, name: 'Dread Brenda', colors: 'BR', arch: 'burn', style: 'aggro', blurb: 'Fast, mean and full of burn.' },
    { id: 't3-trevor', tier: 3, name: 'Titan Trevor', colors: 'G', arch: 'stomp', style: 'voltron', blurb: 'The biggest trampling creatures.' },
    { id: 't3-sam', tier: 3, name: 'Wallbuilder Sam', colors: 'W', arch: 'control', style: 'control', blurb: 'Lifelink, big toughness, removal.' },
    { id: 't3-luke', tier: 3, name: 'Bounce Luke', colors: 'U', arch: 'tempo', style: 'control', blurb: 'Bounce everything, win in the air.' },
    { id: 't3-arthur', tier: 3, name: 'Arthur the Whale', colors: 'RG', arch: 'stomp', style: 'voltron', blurb: 'Huge red and green monsters.' },
    { id: 't3-boss', tier: 3, name: 'Sarah, Storm Walker', colors: 'UR', arch: 'burn', style: 'spellslinger', boss: true, blurb: 'Boss. The best burn, fliers and tricks in the pool.' }
];
const ASCENT_OPP = Object.fromEntries(ASCENT_OPPONENTS.map(o => [o.id, o]));
const ASCENT_DECK_SIZE = 40, ASCENT_LANDS = 17;
const ASCENT_PRIZE = { win: { play: 1 }, boss: { play: 2, collector: 1 }, lossAether: 5, weakDeckLossAether: 15, weakDeckRares: 3, lossStreakPack: 2, sigRepeatChance: 0.35 };

// ---- Trophies: very strong cards won only by beating one opponent many times ----
const ASCENT_TROPHY_WINS = [3, 6, 10, 15, 20, 25, 30, 40, 50, 75];
// Each opponent has ten, in its colors, never in packs and never played by the computer. Tier 3 opponents hold the strongest. Same every time.
function ascentTrophies() {
    if (ASCENT.trophies) return ASCENT.trophies;
    const all = ASCENT.roster.filter(c => c.rarity === 'trophy').sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
    const taken = new Set(), out = {};
    for (const opp of ASCENT_OPPONENTS) {
        const fits = all.filter(c => ascentFits(c, opp.colors) && !taken.has(c.id));
        const lo = [0.15, 0.3, 0.45][opp.tier - 1] + (opp.boss ? 0.1 : 0), hi = Math.min(1, [0.55, 0.75, 1][opp.tier - 1] + (opp.boss ? 0.1 : 0));
        const picks = [];
        ASCENT_TROPHY_WINS.forEach((w, i) => {
            const want = Math.round((lo + (hi - lo) * i / (ASCENT_TROPHY_WINS.length - 1)) * (fits.length - 1));
            for (let d = 0; d < fits.length; d++) for (const j of [want + d, want - d]) { const c = fits[j]; if (c && !taken.has(c.id)) { taken.add(c.id); picks.push(c.id); d = fits.length; break; } }
        });
        out[opp.id] = picks;
    }
    ASCENT.trophies = out;
    return out;
}
function ascentTrophyOwner(id) {
    const t = ascentTrophies();
    for (const [oppId, ids] of Object.entries(t)) { const i = ids.indexOf(id); if (i >= 0) return { oppId, wins: ASCENT_TROPHY_WINS[i], index: i }; }
    return null;
}
function ascentWins(oppId) { const st = ascentState(); return (st.wins && st.wins[oppId]) || 0; }

// A small seeded random generator, so an opponent's deck and signature cards never change
function ascentRng(seedText) {
    let h = 2166136261;
    for (const ch of seedText) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function ascentFits(c, colors) { return c.colors.split('').every(ch => colors.includes(ch)); }
// How well a card suits an archetype (higher is better); the card's own strength is added by the caller
function ascentArchScore(arch, c) {
    const kw = c.kws || [], has = k => kw.includes(k), [p, t] = (c.pt || '0/0').split('/').map(Number);
    let s = 0;
    if (c.type === 'creature') {
        if (c.kind === 'dork' || c.kind === 'anydork') s += { stomp: 3, tempo: 2.5, control: 2, value: 1.5, burn: 0.5, weenie: -1, fliers: 1 }[arch] || 0;
        const tg = c.tags || [];
        if (tg.includes('etb-draw') || tg.includes('die-draw')) s += { control: 1.5, tempo: 1.5, value: 1.5, fliers: 1 }[arch] || 0.5;
        if (tg.includes('etb-burn')) s += arch === 'burn' ? 2 : 0.5;
        if (c.kind === 'lord' || c.kind === 'tokencreature') s += { weenie: 3.5, fliers: 1.5, value: 1.5, tempo: 1, control: 0.5 }[arch] || 0;
        if (tg.includes('pump-ability')) s += ['stomp', 'burn', 'weenie'].includes(arch) ? 1 : 0;
        if (tg.includes('etb-life') || tg.includes('die-life') || tg.includes('etb-drain')) s += ['value', 'control'].includes(arch) ? 1 : 0;
        if (arch === 'stomp') s += (p + t) * 0.45 + (has('trample') ? 2 : 0) + (c.cmc >= 4 ? 1 : 0) - (c.cmc <= 2 ? 1.5 : 0);
        if (arch === 'weenie') s += (c.cmc <= 3 ? 2.5 : -2) + (has('first strike') || has('vigilance') || has('lifelink') ? 1.5 : 0);
        if (arch === 'fliers') s += (has('flying') ? 5 : -3) + (c.cmc <= 4 ? 1 : 0);
        if (arch === 'value') s += (has('deathtouch') ? 4 : 0) + (has('lifelink') ? 3 : 0) + t * 0.3;
        if (arch === 'burn') s += (has('haste') ? 3.5 : 0) + (c.cmc <= 3 ? 1.5 : -1) + p * 0.3;
        if (arch === 'control') s += t * 0.6 + (has('defender') ? 1 : 0) + (has('lifelink') ? 2 : 0) + (has('flying') ? 1 : 0);
        if (arch === 'tempo') s += (has('flying') ? 3 : 0) + (has('reach') ? 2 : 0) + (has('hexproof') ? 2 : 0) + (c.cmc <= 4 ? 1 : 0);
    } else {
        const k = c.kind;
        if (k === 'rock') return ({ stomp: 3, tempo: 2.5, control: 2, value: 1.5, burn: 0.5, weenie: 0, fliers: 1 }[arch] || 0) + 1;
        if (k === 'ramp') return ({ stomp: 3, tempo: 2, control: 1.5, value: 2 }[arch] || 0) + 0.5;
        const want = { stomp: { pump: 2, teamPump: 2, tokens: 1 }, weenie: { pump: 3, teamPump: 3, shrink: 1, tokens: 5, anthem: 5, grant: 2.5, destroy: 1, exile: 1 }, fliers: { pump: 3, bounce: 2, tokens: 2.5, anthem: 2.5, grant: 1.5 }, value: { destroy: 4, life: 2, draw: 2, recur: 3, exile: 4, tokens: 2 }, burn: { burn: 5, shrink: 3, draw: 2 }, control: { destroy: 5, exile: 5, bounce: 3, draw: 4, burn: 3, tokens: 1.5 }, tempo: { bounce: 5, draw: 3, pump: 1, shrink: 2, tokens: 1 } }[arch] || {};
        s += (want[k] || 0) - 1;
    }
    return s;
}
function ascentOpponentPool(opp) {
    const t = ASCENT_TIERS[opp.tier - 1];
    return ASCENT.roster.filter(c => c.type !== 'land' && c.rarity !== 'trophy' && c.tier <= t.maxTier && ascentFits(c, opp.colors));
}
// Signature cards: rare or mythic cards in the opponent's colors that only this opponent drops. Chosen once, never repeated across opponents.
function ascentSignatures() {
    if (ASCENT.sigs) return ASCENT.sigs;
    const sigs = {}, taken = new Set();
    for (const opp of ASCENT_OPPONENTS) {
        const rng = ascentRng('sig:' + opp.id), want = opp.boss ? 4 : 3;
        const t = ASCENT_TIERS[opp.tier - 1];
        // rare or mythic cards of the opponent's colors, up to one tier above its own (a signature can be a treat); uncommons only if the pool runs short
        const cand = rar => ASCENT.roster.filter(c => c.type !== 'land' && (opp.tier > 1 || opp.boss || c.type === 'creature') && rar.includes(c.rarity) && c.tier <= Math.min(3, opp.tier + 1) && ascentFits(c, opp.colors) && !taken.has(c.id));
        let pool = cand(['rare', 'mythic']);
        if (pool.length < want) pool = pool.concat(cand(['uncommon']).filter(c => c.tier >= opp.tier));
        pool = pool.map(c => ({ c, k: ascentArchScore(opp.arch, c) + c.power * 0.2 + (opp.boss && c.rarity === 'mythic' ? 3 : 0) + rng() * 2.5 })).sort((a, b) => b.k - a.k).map(x => x.c);
        // keep a mix: at least one non-creature when the pool has one
        const pick = pool.slice(0, want);
        sigs[opp.id] = pick.map(c => c.id);
        pick.forEach(c => taken.add(c.id));
    }
    ASCENT.sigs = sigs; ASCENT.sigSet = new Set(Object.values(sigs).flat());
    return sigs;
}
function ascentOwnerOf(id) { ascentSignatures(); return Object.keys(ASCENT.sigs).find(k => ASCENT.sigs[k].includes(id)) || null; }
// The 40-card deck an opponent plays: its signature cards (2 copies each), then the best-fitting cards of its tier.
function ascentOpponentDeck(opp) {
    const rng = ascentRng('deck:' + opp.id), sig = ascentSignatures()[opp.id].map(id => ASCENT.byId.get(id));
    const cards = {};
    let spellsLeft = ASCENT_DECK_SIZE - ASCENT_LANDS;
    const add = (c, n) => { n = Math.min(n, ASCENT_COPY_LIMIT - (cards[c.id] || 0), spellsLeft); if (n > 0) { cards[c.id] = (cards[c.id] || 0) + n; spellsLeft -= n; } };
    sig.forEach(c => add(c, c.rarity === 'mythic' ? 1 : 2));
    const pool = ascentOpponentPool(opp).filter(c => !ASCENT.sigSet.has(c.id))
        .map(c => ({ c, k: ascentArchScore(opp.arch, c) + c.power * 0.35 + rng() * 2 })).sort((a, b) => b.k - a.k).map(x => x.c);
    const maxSpells = opp.tier === 1 ? 2 : opp.tier === 2 ? 5 : 7;
    let spells = sig.filter(c => c.type === 'spell').reduce((a, c) => a + cards[c.id], 0);
    const curve = { low: 0, mid: 0, high: 0 }; // cmc <= 2, 3-4, 5+
    const bucket = c => c.cmc <= 2 ? 'low' : c.cmc <= 4 ? 'mid' : 'high', cap = { low: 8, mid: 9, high: 5 };
    sig.filter(c => c.type === 'creature').forEach(c => { curve[bucket(c)] += cards[c.id]; });
    for (const c of pool) {
        if (spellsLeft <= 0) break;
        if (c.type === 'spell') { if (spells >= maxSpells) continue; const n = Math.min(2, maxSpells - spells); const before = spellsLeft; add(c, n); spells += before - spellsLeft; continue; }
        const b = bucket(c); if (curve[b] >= cap[b]) continue;
        const want = c.cmc <= 3 ? 3 : c.cmc <= 5 ? 2 : 1, before = spellsLeft; add(c, Math.min(want, cap[b] - curve[b])); curve[b] += before - spellsLeft;
    }
    // a second pass without the curve caps fills any slots the first pass could not
    for (const c of pool) {
        if (spellsLeft <= 0) break;
        if (c.type === 'spell' ? spells >= maxSpells : false) continue;
        const before = spellsLeft; add(c, 1); if (c.type === 'spell') spells += before - spellsLeft;
    }
    // lands: tapped duals for two colors from tier 2, basics split by the colored symbols in the deck
    const cols = opp.colors.split(''), sym = {};
    cols.forEach(ch => { sym[ch] = 0.5; });
    Object.entries(cards).forEach(([id, n]) => { const c = ASCENT.byId.get(id); (c.cost.match(/\{([WUBRG])\}/g) || []).forEach(m => { sym[m[1]] = (sym[m[1]] || 0) + n; }); });
    let landsLeft = ASCENT_LANDS;
    if (cols.length === 2 && opp.tier >= 2) {
        const duals = ASCENT.roster.filter(c => c.kind === 'tapdual' && c.colors.length === 2 && cols.every(ch => c.colors.includes(ch)));
        const n = Math.min(opp.tier === 2 ? 3 : 4, landsLeft);
        for (let i = 0; i < n && duals.length; i++) { const d = duals[Math.floor(rng() * duals.length)]; if ((cards[d.id] || 0) < 1) { cards[d.id] = 1; landsLeft--; } }
    }
    const total = cols.reduce((a, ch) => a + sym[ch], 0), basics = {};
    ASCENT.roster.filter(c => c.kind === 'basic').forEach(c => { basics[{ Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' }[c.name]] = c; });
    let given = 0;
    cols.forEach((ch, i) => { const n = i === cols.length - 1 ? landsLeft - given : Math.round(landsLeft * sym[ch] / total); given += n; if (n > 0) cards[basics[ch].id] = (cards[basics[ch].id] || 0) + n; });
    return cards;
}
function ascentDeckEntries(name, cards) { return { name, format: 'limited', entries: Object.entries(cards).map(([id, n]) => ({ card: CARDS.get(id), n })).filter(e => e.card) }; }
async function buildAscentOpponent(oppId) {
    await loadAscentRoster();
    const opp = ASCENT_OPP[oppId], cards = ascentOpponentDeck(opp);
    await cardsByIds(Object.keys(cards));
    const lost = Object.keys(cards).filter(id => !CARDS.has(id));
    if (lost.length) throw new Error(`Could not load ${lost.length} of ${opp.name}'s cards from Scryfall. Try again in a moment.`);
    const d = ascentDeckEntries(opp.name, cards);
    d.aiLevel = ASCENT_TIERS[opp.tier - 1].level; d.aiStyle = opp.style; d.source = `Ascent: ${ASCENT_TIERS[opp.tier - 1].name}`;
    d.campaign = { ascent: true, node: opp.id, tier: opp.tier, name: opp.name, boss: !!opp.boss };
    return d;
}

// ---- Progress ----
function ascentBeaten(id) { return ascentState().progress.includes(id); }
function ascentTierOpen(tier) {
    if (tier === 1) return true;
    return ascentBeaten(`t${tier - 1}-boss`);
}
function ascentOpponentOpen(opp) {
    if (!ascentTierOpen(opp.tier)) return false;
    if (!opp.boss) return true;
    return ASCENT_OPPONENTS.filter(o => o.tier === opp.tier && !o.boss).every(o => ascentBeaten(o.id)); // the boss waits for the other five
}
// Starter: a one-color deck of tier-1 cards, 4 copies of the best, plus three free Play Boosters' worth of cards later via the pack box
// White starts with a plan, not just small bodies: token makers, an anthem (the cheapest team boost in white) and two cheap fliers.
// Lab check (100 games each, starter vs the easy opponent): W 89% vs Mick, 55% vs Annie, 72% vs Gus; without this help W won 47% / 20%.
function ascentStarterHelp(color) {
    if (color !== 'W') return [];
    const w = ASCENT.roster.filter(c => c.colors === 'W');
    const toks = w.filter(c => c.kind === 'tokens' && c.cmc <= 3 && c.rarity !== 'mythic').sort((a, b) => b.power - a.power || a.name.localeCompare(b.name));
    const anth = w.filter(c => c.kind === 'anthem').sort((a, b) => a.cmc - b.cmc || b.power - a.power || a.name.localeCompare(b.name));
    const fly = w.filter(c => c.type === 'creature' && c.rarity === 'uncommon' && (c.kws || []).includes('flying') && c.cmc <= 3 && !(c.tags || []).length).sort((a, b) => b.power - a.power || a.cmc - b.cmc || a.name.localeCompare(b.name));
    return [[toks[0], 3], [toks[1], 2], [anth[0], 2], [fly[0], 2], [fly[1], 2]].filter(x => x[0]);
}
// The cards of a starter deck (no state changed): { cards: id -> count, basicId }
function ascentStarterCards(color) {
    const rng = ascentRng('starter:' + color);
    const help = ascentStarterHelp(color);
    const pool = ASCENT.roster.filter(c => c.type !== 'land' && c.tier === 1 && c.rarity === 'common' && c.colors === color && !help.some(h => h[0].id === c.id))
        .map(c => ({ c, k: c.power + rng() * 2 })).sort((a, b) => b.k - a.k).map(x => x.c);
    const cards = {}; let left = ASCENT_DECK_SIZE - ASCENT_LANDS, spells = 0;
    help.forEach(([c, n]) => { cards[c.id] = n; left -= n; });
    for (const c of pool) { if (left <= 0) break; if (c.type === 'spell') { if (spells >= 2) continue; spells++; } const n = Math.min(c.cmc <= 3 ? 3 : 2, left); cards[c.id] = n; left -= n; }
    for (let pass = 0; pass < 2 && left > 0; pass++) for (const c of pool) { if (left <= 0) break; if (c.type === 'spell' || !cards[c.id] || cards[c.id] >= ASCENT_COPY_LIMIT) continue; cards[c.id]++; left--; } // top up the best creatures instead of piling on lands
    const basic = ASCENT.roster.find(c => c.kind === 'basic' && { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' }[color] === c.name);
    return { cards, basicId: basic.id };
}
function ascentStarter(color) {
    const st = ascentState();
    if (st.started) return null;
    const { cards, basicId } = ascentStarterCards(color);
    Object.entries(cards).forEach(([id, n]) => { const o = ascentOwnedEntry(id); for (let i = 0; i < n; i++) o.c.push(ascentNewCopy(false)); ascentSyncOwned(o); });
    cards[basicId] = ASCENT_LANDS;
    const deck = ascentNormalizeDeck({ name: 'Starter deck', cards });
    st.decks.push(deck); st.started = true; st.sealed = { play: 3, collector: 0 };
    return deck;
}
function ascentDeckProblems(deck) {
    const st = ascentState(), out = [];
    const total = Object.values(deck.cards).reduce((a, b) => a + b, 0);
    if (total < ASCENT_DECK_SIZE) out.push(`Needs ${ASCENT_DECK_SIZE} cards (has ${total}).`);
    for (const [id, n] of Object.entries(deck.cards)) {
        const c = ASCENT.byId.get(id);
        if (!c) { out.push('A card is not part of Ascent.'); continue; }
        if (c.kind === 'basic') continue;
        if (n > ASCENT_COPY_LIMIT) out.push(`${c.name}: at most ${ASCENT_COPY_LIMIT} copies.`);
        if (n > ((st.owned[id] || {}).n || 0)) out.push(`${c.name}: you own ${(st.owned[id] || {}).n || 0}.`);
    }
    return out;
}

// ---- Prizes ----
// Called when a game from the Ascent ends (campaignResult in 13-campaign.js hands over). Returns the line shown on the result screen.
// A rough deck: fewer than a few rare (or better) non-basic cards. Losing with one pays extra Aether so a new player keeps moving.
function ascentDeckIsRough(deck) {
    if (!deck) return true;
    let n = 0;
    for (const [id, k] of Object.entries(deck.cards)) { const c = ASCENT.byId.get(id); if (c && c.kind !== 'basic' && ['rare', 'mythic', 'trophy'].includes(c.rarity)) n += k; }
    return n < ASCENT_PRIZE.weakDeckRares;
}
function ascentResult(won) {
    const c = G.campaign, opp = ASCENT_OPP[c.node], st = ascentState();
    const quote = kind => (typeof ascLine === 'function' && ASCENT_CHAR[c.node]) ? `“${ascLine(c.node, kind)}” - ${opp.name}. ` : '';
    if (!won) {
        // a loss still pays: Aether (more while the deck is still rough) and a Play Booster after every second loss in a row
        const weak = ascentDeckIsRough(st.decks[c.deckIndex]), aether = weak ? ASCENT_PRIZE.weakDeckLossAether : ASCENT_PRIZE.lossAether;
        st.aether += aether;
        st.lossStreak = (st.lossStreak || 0) + 1;
        let pack = '';
        if (st.lossStreak >= ASCENT_PRIZE.lossStreakPack) { st.lossStreak = 0; st.sealed = st.sealed || { play: 0, collector: 0 }; st.sealed.play += 1; pack = ' and a Play Booster (two losses in a row)'; }
        saveProfile();
        return `${quote('lose')}Ascent: ${aether} Aether${pack} for trying.${weak ? ' (Extra Aether while your deck has fewer than ' + ASCENT_PRIZE.weakDeckRares + ' rare cards.)' : ''}`;
    }
    st.lossStreak = 0;
    const first = !st.progress.includes(c.node);
    if (first) st.progress.push(c.node);
    st.wins = st.wins || {}; st.wins[c.node] = (st.wins[c.node] || 0) + 1;
    const prize = opp.boss ? ASCENT_PRIZE.boss : ASCENT_PRIZE.win;
    st.sealed = st.sealed || { play: 0, collector: 0 };
    st.sealed.play += prize.play || 0; st.sealed.collector += prize.collector || 0;
    const parts = [`${prize.play || 0} Play Booster${(prize.play || 0) === 1 ? '' : 's'}`];
    if (prize.collector) parts.push(`${prize.collector} Collector Booster`);
    // a signature card of this opponent: the first win always, later wins sometimes
    const sigs = ascentSignatures()[c.node].filter(id => ((st.owned[id] || {}).n || 0) < ASCENT_COPY_LIMIT);
    if (sigs.length && (first || Math.random() < ASCENT_PRIZE.sigRepeatChance)) {
        const id = sigs[Math.floor(Math.random() * sigs.length)];
        ascentAddCards([{ id, foil: false }]);
        parts.push(`signature card ${ASCENT.byId.get(id).name}`);
    }
    // a trophy at each milestone of wins against this opponent
    const ti = ASCENT_TROPHY_WINS.indexOf(st.wins[c.node]);
    if (ti >= 0) { const tid = ascentTrophies()[c.node][ti]; if (tid) { ascentAddCards([{ id: tid, foil: false }]); parts.push(`🏆 TROPHY for ${st.wins[c.node]} wins: ${ASCENT.byId.get(tid).name}`); } }
    saveProfile();
    return `${quote('win')}Ascent: ${first ? 'beaten for the first time! ' : ''}${parts.join(', ')}.${first && opp.boss && opp.tier < 3 ? ` ${ASCENT_TIERS[opp.tier].name} is open.` : ''}`;
}
async function startAscentMatch(oppId, deckIndex = 0) {
    await loadAscentRoster();
    const st = ascentState(), deck = st.decks[deckIndex], opp = ASCENT_OPP[oppId];
    if (!deck || !opp) throw new Error('Pick a deck and an opponent.');
    const problems = ascentDeckProblems(deck);
    if (problems.length) throw new Error(problems[0]);
    if (!ascentOpponentOpen(opp)) throw new Error('That opponent is still locked.');
    await cardsByIds(Object.keys(deck.cards));
    const missing = Object.keys(deck.cards).filter(id => !CARDS.has(id));
    if (missing.length) throw new Error(`Could not load ${missing.length} of your cards from Scryfall. Try again in a moment.`);
    const mine = ascentDeckEntries(deck.name, ascentPlayableCards(deck)); // upgraded copies become their own cards (13e)
    const oppDeck = await buildAscentOpponent(oppId);
    oppDeck.campaign.deckIndex = deckIndex;
    closeModal(); // the "shuffling" panel must be gone before the game opens its own (opening hand) panel
    newGame(mine, oppDeck);
}
