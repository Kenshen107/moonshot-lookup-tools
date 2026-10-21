// Deal tension (2026-10-21, owner: "deals should only be relevant when salt, high power or about to win seem relevant ... an opponent out valuing the
// whole table finds those kinds of deals more tantalizing"). Before this, bots made about 17 deals a game, most of them for no reason (a lab run of
// 120 pods). Now a bot only makes, accepts or offers a deal when something at the table gives it a reason:
//   salt      - it is annoyed (salt 2+, more at 5+), or it holds a real grudge against the other player;
//   power     - it is the archenemy, far behind, low on life, or one player out-values the whole table (a runaway: more power than everyone else combined);
//   about to win - somebody can kill a player next turn (lethal range, commander damage 14+, poison 7+ with infect or toxic on the board).
// Each reason adds to the bot's tension (`dealTension`). Under 2 the answer to any deal is "nothing to deal over right now" and the bot offers none.
// A gang-up on the runaway or on a player about to win is more tempting (+3), and so is peace for the runaway itself. `G.dealsAlways = true`
// turns the gate off (tests and debugging). No random numbers anywhere, so seeded games replay.
// =====================================================================
const DEAL_TENSION_MIN = 2;
function runawayPlayer() {
    if (!G || G.players.length < 3) return null;
    const live = G.players.filter(P => !P.out);
    if (live.length < 3) return null;
    const top = live.slice().sort((a, b) => podThreat(b) - podThreat(a) || a.i - b.i)[0];
    const others = live.filter(P => P !== top).reduce((a, P) => a + podThreat(P), 0);
    return podThreat(top) >= 12 && podThreat(top) > others ? top : null;
}
// Can X kill somebody next turn? { target, why } or null
function winThreat(X) {
    if (!X || X.out || !G) return null;
    const atk = X.bf.filter(canAttackWith);
    for (const F of foes(X)) {
        if (F.out) continue;
        const dmg = atk.reduce((a, o) => a + dmgVs(o, F), 0);
        if (dmg > 0 && dmg >= F.life * 0.8) return { target: F, why: 'in lethal range' };
        if (F.cmdBy && (F.cmdBy[X.i] || 0) >= 14) return { target: F, why: 'close to 21 commander damage' };
        if ((F.poison || 0) >= 7 && atk.some(o => poisonOf(o) > 0)) return { target: F, why: 'close to 10 poison' };
    }
    return null;
}
// How much reason `P` has to make a deal right now (the other player's name sharpens it a little when there is a grudge)
function dealTension(P, other) {
    const parts = {}, live = G.players.filter(X => !X.out);
    const salt = P.salt || 0;
    if (salt >= SALT_TIERS[2]) parts.salt = 2; else if (salt >= SALT_TIERS[1]) parts.salt = 1;
    if (other && P.grudge && (P.grudge[other.i] || 0) >= 6) parts.grudge = 1;
    const mean = live.reduce((a, X) => a + podThreat(X), 0) / Math.max(1, live.length);
    if (G.arch === P.i) parts.archenemy = 2;
    if (mean >= 6 && podThreat(P) < mean * 0.6) parts.behind = 1.5;
    if (P.life <= 10) parts.lowLife = 1;
    const R = runawayPlayer();
    if (R && R !== P) parts.runaway = 2; else if (R === P) parts.leader = 1.5;
    const wins = live.filter(X => X !== P).map(X => ({ X, w: winThreat(X) })).filter(o => o.w);
    if (wins.length) parts.aboutToWin = wins.some(o => o.w.target === P) ? 5 : 3;
    const score = Object.values(parts).reduce((a, b) => a + b, 0);
    return { score, parts, relevant: !!G.dealsAlways || score >= DEAL_TENSION_MIN };
}
const dealsRelevant = (P, other) => !!G && (G.players.length < 3 || dealTension(P, other).relevant);

// ---- The gate on every answer ----
{
    const baseDealScore = dealScore;
    dealScore = function (bot, from, type, x) {
        const r = baseDealScore.apply(this, arguments);
        if (r.score <= -90 || !G || G.dealsAlways || G.players.length < 3) return r;
        const t = dealTension(bot, from), parts = r.parts;
        if (!t.relevant) {
            parts.quiet = -6; r.score -= 6;
            r.reason = "There's nothing to deal over right now.";
            return r;
        }
        const adj = Math.min(3, t.score * 0.5);
        parts.tension = adj; r.score += adj;
        const R = runawayPlayer();
        if (type === 'pact') {
            const X = G.players[x];
            if (X && ((R && R === X) || winThreat(X))) { parts.tantalizing = 3; r.score += 3; } // a gang-up on whoever is running away with it
        } else if (R && R === bot) { parts.tantalizing = 1.5; r.score += 1.5; } // the leader wants to be left alone
        else if (R && R === from && (type === 'peace' || type === 'spare')) { parts.tantalizing = 1; r.score += 1; } // the table would like to take the leader's offer of peace
        return r;
    };
}
