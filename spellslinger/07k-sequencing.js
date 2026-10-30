// =====================================================================
// Sequencing (2026-10-28, owner: "Let's do part 5", chosen: multi-turn sequencing). Real players plan the next turn or two:
//   - Mulligans: look at the hand (lands, colors, whether it does anything by turn 3), not just the land count, and choose what goes on the bottom.
//   - Land drops: play the tapped land on a turn when the mana wouldn't be used anyway, and the untapped one when it lets you cast something.
//   - Mana pieces: cast the rock or dork that makes next turn's big spell castable.
//   - Spending mana: pick the pair of spells that uses the turn's mana best instead of always starting with the single highest-scored one.
// Same gate as the rest of table sense (`tsOn`: pods, smart bots; `AI_TUNE.duels` for duels) and its own knob `AI_TUNE.sequencing` (0 = off).
// `AI_TUNE.maxMulls` is the most mulligans a bot takes (default 2). No random numbers. Write-up: docs/spellslinger-table-sense.md, section E.
// =====================================================================
Object.assign(AI_TUNE, { sequencing: 1, maxMulls: 2 });
const seqOn = P => tsOn(P) && tn(P, 'sequencing') > 0;
const isLandCard = o => Rx(o).kind === 'land';
const cmcOf = o => o.card.cmc || 0;

// ---------------- Mulligans ----------------
function handColors(lands) {
    const s = new Set();
    lands.forEach(l => { const m = Rx(l).mana; if (m) m.colors.forEach(c => s.add(c)); });
    return s;
}
const colorOkFor = (o, cols) => COLORS.every(c => !(Rx(o).cost[c] > 0) || cols.has(c));
// Should the bot mulligan this opening hand (the seven it just drew)?
function mulliganWanted(P) {
    if (P.mulligans >= tn(P, 'maxMulls')) return false;
    const lands = P.hand.filter(isLandCard), spells = P.hand.filter(o => !isLandCard(o));
    const n = P.hand.length, L = lands.length, cols = handColors(lands);
    if (L <= 1 || L >= n - 1) return true;                      // nothing to cast with, or nothing to cast
    if (P.mulligans >= 1) return false;                          // after one mulligan, take any hand with 2 to 5 lands
    const early = spells.filter(o => cmcOf(o) <= 3 && colorOkFor(o, cols)).length;
    const cheap = spells.filter(o => cmcOf(o) <= 2 && colorOkFor(o, cols)).length;
    if (L === 2 && cheap < 2) return true;                       // two lands need cheap plays to get going
    if (L >= 5 && early === 0) return true;                      // flooded and nothing to do
    if (!spells.some(o => colorOkFor(o, cols))) return true;     // the lands can't cast any of it
    return false;
}
// What goes on the bottom (London mulligan): extra lands, spells the lands can't cast, the most expensive spells
function mullBottomPick(P) {
    const lands = P.hand.filter(isLandCard), cols = handColors(lands);
    const value = new Map();
    lands.forEach((l, i) => value.set(l, i < 3 ? 5 : i === 3 ? 3 : 0.5));
    P.hand.filter(o => !isLandCard(o)).forEach(o => value.set(o, (colorOkFor(o, cols) ? 2 : -2) + (cmcOf(o) <= 3 ? 1.5 : cmcOf(o) <= 5 ? 0.5 : -1)));
    return P.hand.slice().sort((a, b) => value.get(a) - value.get(b))[0] || null;
}
async function aiMulligan(P) {
    let took = 0;
    while (mulliganWanted(P)) {
        P.mulligans++; took++;
        P.library.push(...P.hand.splice(0));
        shuffle(P.library);
        drawCards(P, 7, true);
    }
    for (let i = 0; i < mullBottom(P); i++) { const b = mullBottomPick(P); if (!b) break; pull(P.hand, b); P.library.unshift(b); }
    if (took) {
        log(`${P.name} ${took > 1 ? `mulligans ${took} times` : 'takes a mulligan'} and keeps ${P.hand.length}.`);
        if (G.players.length > 2) say(P, 'mulligan', 'nervous', {}, null);
    }
}

// ---------------- Land drops ----------------
const _aiPlayLand_s = aiPlayLand;
aiPlayLand = function (P) {
    if (!seqOn(P) || P.landsPlayed >= landLimit(P)) return _aiPlayLand_s(P);
    const lands = [...P.hand, ...P.exile.filter(x => x.playUntil >= G.turn), ...extraLandZones(P)].filter(isLandCard);
    if (!lands.length) return _aiPlayLand_s(P);
    const N = manaCapacity(P);
    const costs = P.hand.filter(o => !isLandCard(o)).map(cmcOf).sort((a, b) => a - b);
    // Does this land's mana get used this turn? A spell that costs exactly one more than we have, or two spells that fit together only with it.
    const needsMana = costs.some(c => c === N + 1) || (costs.length >= 2 && costs[0] + costs[1] === N + 1);
    const have = new Set(P.bf.filter(o => Rx(o).mana).flatMap(o => Rx(o).mana.colors));
    const want = new Set(P.hand.filter(o => !isLandCard(o)).flatMap(o => COLORS.filter(c => Rx(o).cost[c] > 0)));
    const score = l => (Rx(l).mana ? Rx(l).mana.colors.filter(c => want.has(c) && !have.has(c)).length * 3 + Rx(l).mana.colors.filter(c => want.has(c)).length : 0)
        - (Rx(l).entersTapped ? (needsMana ? 4 : -1.5) : 0); // a tapped land costs nothing on a turn the mana wouldn't be used
    const land = lands.sort((a, b) => score(b) - score(a))[0];
    tsPol('landChoices');
    playLand(P, land);
};

// ---------------- Mana pieces that make next turn's play ----------------
const _aiScore_s = aiScore;
aiScore = function (P, o, target) {
    const s = _aiScore_s(P, o, target);
    if (!(s > 0) || !seqOn(P) || P.aiStyle === 'ramp') return s;
    const r = Rx(o);
    if (isLandCard(o) || !r.mana) return s;
    const n = r.mana.n || 1;
    const cap1 = manaCapacity(P) + (P.hand.some(isLandCard) ? 1 : 0);   // next turn's mana without it
    const enables = P.hand.some(c => c !== o && !isLandCard(c) && cmcOf(c) > cap1 && cmcOf(c) <= cap1 + n);
    if (enables) { tsPol('rockPlans'); return s + 4; }
    return s;
};

// ---------------- Spending the turn's mana ----------------
// cands = castable plays { o, s, ... }; mana = what the bot has to spend. Picks the play that belongs to the best combination of plays that fit together.
function seqPick(P, cands, mana) {
    const sorted = cands.slice().sort((a, b) => b.s - a.s);
    if (sorted.length < 2 || !(mana > 0)) return sorted[0];
    const top = sorted.slice(0, 8);
    let best = null;
    for (let m = 1; m < (1 << top.length); m++) {
        let cost = 0, val = 0;
        const set = [];
        for (let i = 0; i < top.length; i++) if (m & (1 << i)) { cost += cmcOf(top[i].o); val += top[i].s; set.push(top[i]); }
        if (cost > mana) continue;
        val += 0.5 * cost;                                  // a little credit for using the mana
        if (!best || val > best.val + 1e-9) best = { val, set };
    }
    if (!best || best.set[0] === sorted[0]) return sorted[0];
    tsPol('seqPicks');
    return best.set.slice().sort((a, b) => b.s - a.s)[0];
}
