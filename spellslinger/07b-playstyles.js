// =====================================================================
// Playstyles (2026-10-14, owner's request: "develop playstyles and assign those to bot opponents that may be playing decks that mimic
// that play style"). A style is a small table of numbers the AI reads (how eagerly it attacks and blocks, which cards it likes to cast,
// who it attacks in a pod) and a deck recipe (`styleFit`, `STYLE_CAPS`) so a bot of that style plays a deck that looks the part.
// `deck.aiStyle` (key of PLAYSTYLES) is copied to `P.aiStyle` by makePlayer. A player with no style plays exactly as before.
// =====================================================================
const PLAYSTYLES = {
    aggro:       { name: 'Aggro', emoji: '🔥', desc: 'Cheap creatures, haste and burn; attacks early and often, rarely chump blocks.',
        atk: 1.5, blk: -1, hold: 0.9, target: 'weak',
        w: { creature: 2, haste: 3.5, cheap: 2, top: -3, burn: 3, removal: 0.5, draw: -0.5, ramp: -1.5, evasive: 1, counter: -2, equip: 1 },
        caps: { creature: 34, instant: 8, sorcery: 8, artifact: 6, enchantment: 4 } },
    control:     { name: 'Control', emoji: '🛡️', desc: 'Removal, counterspells and card draw; holds mana up, trades, wins late.',
        atk: -1, blk: 1, hold: 0.55, target: 'threat',
        w: { creature: -0.5, finisher: 1, removal: 3, counter: 3, draw: 2.5, ramp: 0.5, lifegain: 1, haste: -1, cheap: 0 },
        caps: { creature: 14, instant: 16, sorcery: 12, artifact: 10, enchantment: 8 } },
    midrange:    { name: 'Midrange', emoji: '⚖️', desc: 'Solid creatures and removal; attacks when it is ahead, blocks well.',
        atk: 0, blk: 0.5, hold: 0.75, target: 'threat',
        w: { creature: 1.5, removal: 1.5, draw: 1, ramp: 0.5, evasive: 0.5 },
        caps: { creature: 27, instant: 11, sorcery: 11, artifact: 12, enchantment: 8 } },
    ramp:        { name: 'Ramp', emoji: '🌳', desc: 'Mana creatures and rocks into big spells; slow start, huge finish.',
        atk: -0.5, blk: 0.5, hold: 0.7, target: 'threat',
        w: { ramp: 4, big: 2, creature: 0.5, draw: 1, cheap: -0.5, haste: -0.5 },
        caps: { creature: 22, instant: 6, sorcery: 14, artifact: 12, enchantment: 6 } },
    tokens:      { name: 'Tokens', emoji: '🐜', desc: 'Lots of small bodies and anthems; goes wide.',
        atk: 0.5, blk: 0, hold: 0.8, target: 'weak',
        w: { token: 4, anthem: 3, creature: 0.5, cheap: 0.5, evasive: 0.5 },
        caps: { creature: 26, instant: 6, sorcery: 8, artifact: 8, enchantment: 14 } },
    voltron:     { name: 'Voltron', emoji: '⚔️', desc: 'Equipment and auras on one big, protected creature.',
        atk: 0.5, blk: 0, hold: 0.7, target: 'revenge',
        w: { equip: 3, evasive: 1.5, haste: 1, protect: 2, pump: 1.5, creature: 0.5 },
        caps: { creature: 26, instant: 8, sorcery: 6, artifact: 12, enchantment: 10 } },
    spellslinger:{ name: 'Spellslinger', emoji: '🪄', desc: 'Instants and sorceries, cheap spells and card draw.',
        atk: -0.5, blk: 0, hold: 0.7, target: 'revenge',
        w: { spell: 3, draw: 2, cheap: 1, creature: -0.5, counter: 1.5, burn: 1 },
        caps: { creature: 12, instant: 18, sorcery: 16, artifact: 8, enchantment: 6 } }
};
const PLAYSTYLE_KEYS = Object.keys(PLAYSTYLES);
const styleOf = P => (P && P.aiStyle && PLAYSTYLES[P.aiStyle]) || null;

// What a card does, read from its text (cached per card id)
const FEATURES = new Map();
function cardFeatures(c) {
    let f = FEATURES.get(c.id);
    if (f) return f;
    const t = String(c.text || '').toLowerCase(), r = rulesFor(c), ty = String(c.type || '');
    const power = Number(c.power) || 0;
    f = {
        creature: r.kind === 'creature' ? 1 : 0, spell: r.kind === 'instant' || r.kind === 'sorcery' ? 1 : 0,
        haste: /\bhaste\b/.test(t) ? 1 : 0, cheap: r.kind !== 'land' && (c.cmc || 0) <= 3 ? 1 : 0, top: (c.cmc || 0) >= 6 ? 1 : 0,
        big: (c.cmc || 0) >= 5 || power >= 5 ? 1 : 0, finisher: r.kind === 'creature' && ((c.cmc || 0) >= 5 || power >= 5) ? 1 : 0,
        burn: /deals? \d+ damage to (any target|target player|each opponent|target creature or player)/.test(t) ? 1 : 0,
        removal: /(destroy|exile) target|deals? \d+ damage to (any target|target creature)|gets? -\d+\/-\d+|return target [^.]* to its owner's hand/.test(t) ? 1 : 0,
        draw: /draw (a|two|three|four|\d+) cards?/.test(t) ? 1 : 0, counter: /counter target/.test(t) ? 1 : 0,
        ramp: (r.kind !== 'land' && r.mana) || /search your library for [^.]*\bland\b/.test(t) ? 1 : 0,
        token: /create [^.]*token/.test(t) ? 1 : 0, anthem: /creatures you control get \+|other [a-z ]*creatures you control get \+/.test(t) ? 1 : 0,
        equip: /\b(Equipment|Aura)\b/.test(ty) ? 1 : 0, evasive: /\bflying\b|\bmenace\b|can't be blocked|\btrample\b/.test(t) ? 1 : 0,
        protect: /hexproof|indestructible|protection from|can't be countered/.test(t) ? 1 : 0, pump: /gets? \+\d+\/\+\d+|\+1\/\+1 counter/.test(t) ? 1 : 0,
        lifegain: /gain \d+ life/.test(t) ? 1 : 0
    };
    FEATURES.set(c.id, f);
    return f;
}
// How well a card suits a style (higher = better)
function styleFit(style, c) {
    const st = PLAYSTYLES[style];
    if (!st) return 0;
    const f = cardFeatures(c);
    let s = 0;
    for (const k in st.w) s += st.w[k] * (f[k] || 0);
    return s;
}
// Cards, best fit first with some randomness so decks differ (noise 0 = strictly by fit)
function styleSort(style, cards, noise = 3, rnd = Math.random) {
    return cards.map(c => ({ c, k: styleFit(style, c) + rnd() * noise })).sort((a, b) => b.k - a.k).map(x => x.c);
}
// The style a finished deck looks most like (for decks that were not built for one)
function inferStyle(entries) {
    const cards = entries.filter(e => e.card && !isBasic(e.card) && rulesFor(e.card).kind !== 'land');
    if (!cards.length) return 'midrange';
    let best = 'midrange', bs = -1e9;
    for (const k of PLAYSTYLE_KEYS) {
        const avg = cards.reduce((a, e) => a + styleFit(k, e.card) * (e.n || 1), 0) / cards.reduce((a, e) => a + (e.n || 1), 0);
        if (avg > bs) { bs = avg; best = k; }
    }
    return best;
}

// ---- What the style changes in play ----
// A bonus (or penalty) on how much the AI wants to cast a card
function styleBonus(P, o) {
    const st = styleOf(P);
    if (!st) return 0;
    return 0.8 * styleFit(P.aiStyle, o.card);
}
// Attackers after the style has its say: aggro sends creatures that would trade, control keeps back anything that could die
function styleAttackers(P, base, cands, D) {
    const st = styleOf(P);
    if (!st || P.aiLevel === 'easy' || !st.atk) return base;
    const blockers = D.bf.filter(o => isCreature(o) && !o.tapped);
    const killers = a => blockers.filter(b => canBlock(b, a) && combatKills(b, a));
    if (st.atk > 0) {
        const extra = cands.filter(a => !base.includes(a) && (killers(a).length === 0 || killers(a).every(b => creatureValue(b) >= creatureValue(a) - 1.5 * st.atk) || cands.length > blockers.length + 1));
        return [...base, ...extra];
    }
    const total = base.reduce((s, a) => s + Math.max(0, pow(a)), 0);
    if (total >= D.life) return base; // lethal: everyone goes
    return base.filter(a => killers(a).length === 0 || !blockers.some(b => canBlock(b, a)));
}
// Threat on the table: what a player could do to the rest of us next turn, and how close they are to winning
function podThreat(F) {
    const creatures = F.bf.filter(isCreature);
    return creatures.reduce((a, o) => a + Math.max(0, pow(o)), 0) + creatures.length * 0.5 + F.bf.filter(o => !isCreature(o)).length * 0.25
        + (F.bf.some(o => o.isCommander) ? 2 : 0) + F.hand.length * 0.3 + Math.max(0, F.life - 40) * 0.1;
}
// 1v1 and pod: remember who hurt me
function noteGrudge(target, src, n) {
    if (!src || src.owner === undefined || !target || target.life === undefined || src.owner === target.i || !(n > 0)) return;
    target.grudge = target.grudge || {};
    target.grudge[src.owner] = (target.grudge[src.owner] || 0) + n;
}
// Which opponent to attack in a pod. Lethal on someone first; then by the style's habit.
function podPickDefender(P) {
    const fs = foes(P);
    const st = styleOf(P);
    const power = P.bf.filter(canAttackWith).reduce((a, o) => a + Math.max(0, pow(o)), 0);
    const open = F => !F.bf.some(o => isCreature(o) && !o.tapped);
    const lethal = fs.filter(F => F.life <= power && open(F)).sort((a, b) => a.life - b.life)[0];
    if (lethal) return lethal;
    const grudge = F => (P.grudge && P.grudge[F.i]) || 0;
    const rel = F => (F.i - P.i + G.players.length) % G.players.length; // ties go to whoever sits next to us (not always seat 0)
    const by = {
        threat: (a, b) => podThreat(b) - podThreat(a) || a.life - b.life || rel(a) - rel(b),
        weak: (a, b) => a.life - b.life || podThreat(b) - podThreat(a) || rel(a) - rel(b),
        revenge: (a, b) => grudge(b) - grudge(a) || podThreat(b) - podThreat(a) || rel(a) - rel(b)
    };
    return fs.slice().sort(by[(st && st.target) || 'threat'])[0];
}
// Pods: keep creatures home when the other players could kill us next turn. Each creature held back absorbs the biggest attacker.
function aiHoldBack(P, chosen, D) {
    if (G.players.length <= 2 || !chosen.length || P.aiLevel === 'easy') return chosen;
    if (chosen.reduce((s, a) => s + Math.max(0, pow(a)), 0) >= D.life && !D.bf.some(o => isCreature(o) && !o.tapped)) return chosen; // lethal
    const st = styleOf(P), factor = st ? st.hold : 0.75;
    const theirs = foes(P).flatMap(F => F.bf.filter(isCreature)).map(o => Math.max(0, pow(o))).sort((a, b) => b - a);
    let home = P.bf.filter(o => isCreature(o) && !o.tapped && !chosen.includes(o)).length;
    const through = () => theirs.slice(home).reduce((a, b) => a + b, 0);
    const keep = chosen.slice().sort((a, b) => creatureValue(b) - creatureValue(a));
    while (keep.length > 1 && through() >= P.life * factor) { keep.pop(); home++; }
    return keep;
}
