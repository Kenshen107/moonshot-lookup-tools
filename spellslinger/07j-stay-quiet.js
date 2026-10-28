// =====================================================================
// Stay quiet (2026-10-28, owner: "Build D, the stay-quiet trait"; idea D from the table-sense list). Write-up: docs/spellslinger-table-sense.md, section D.
// Real Commander players who want to win late don't volunteer to be the biggest threat: they don't attack people who haven't hurt them (every
// attack makes an enemy and a target), they hold back the one big play that would put them at the top of the table, and they reveal themselves
// when they can finish somebody, when they are in trouble anyway, or when the game has gone on long enough.
// Who is quiet: the Control, Ramp and Spellslinger styles, and the characters Marcus, Trevor and Sarah (`CHARACTER_HABITS[..].quiet`). The knob
// `AI_TUNE.quiet` is 1 = those bots, 0 = nobody, 2 = everybody (the lab uses 2 to measure it); `quietRounds` (default 9) is how many rounds it hides at most.
// Pods only (it uses the same gate as the rest of table sense, `tsOn`); no random numbers.
// =====================================================================
Object.assign(AI_TUNE, { quiet: 1, quietRounds: 9 });
Object.assign(CHARACTER_HABITS.marcus, { quiet: 1 });
Object.assign(CHARACTER_HABITS.trevor, { quiet: 1 });
Object.assign(CHARACTER_HABITS.sarah, { quiet: 1 });
const QUIET_STYLES = ['control', 'ramp', 'spellslinger'];

function isQuiet(P) {
    const k = tn(P, 'quiet');
    if (!(k > 0)) return false;
    if (k >= 2) return true;
    return QUIET_STYLES.includes(P.aiStyle) || !!(habit(P) && habit(P).quiet) || P.theme === 'pillowfort' || P.theme === 'stax';
}
// Is P still hiding right now? { hiding, reason } - reason says why it is not, when it has come out.
function quietState(P) {
    if (!tsOn(P) || !isQuiet(P)) return { hiding: false, reason: 'not quiet' };
    const live = G.players.filter(X => !X.out);
    if (live.length < 3) return { hiding: false, reason: 'only two players left' };
    if (winThreat(P)) return { hiding: false, reason: 'it can finish somebody' };
    if (P.life <= 12) return { hiding: false, reason: 'it is in trouble anyway' };
    if (G.arch === P.i) return { hiding: false, reason: 'the table is already after it' };
    if (G.turn >= tn(P, 'quietRounds') * live.length) return { hiding: false, reason: 'the game has gone on long enough' };
    return { hiding: true, reason: '' };
}
// Is P near the top of the table's threat ranking? Then adding to its board would give it away.
function nearTop(P) {
    const others = G.players.filter(X => !X.out && X !== P);
    return podThreat(P) >= 0.85 * Math.max(0, ...others.map(podThreat));
}

// Attacks: a quiet bot that is hiding only attacks creatures that must attack. It makes no enemies, and a bot at peace with the table stays that way.
const _aiChooseAttackers_q = aiChooseAttackers;
aiChooseAttackers = function (P) {
    const chosen = _aiChooseAttackers_q(P);
    const was = P.quietWas;
    const st = quietState(P);
    P.quietWas = st.hiding;
    if (was && !st.hiding && isQuiet(P) && tsOn(P)) { tsPol('reveals'); botSay(P, 'smug', 'Alright, enough sitting back.', 'reveal'); }
    if (!st.hiding || !chosen.length) return chosen;
    const must = chosen.filter(o => forcedAttack(o));
    if (must.length < chosen.length) {
        tsPol('quietNoAttack');
        if (!P.quietSaid) { P.quietSaid = true; botSay(P, 'calm', "I'm just building. Nothing to see here.", 'quiet'); }
    }
    return must;
};

// Development: while hiding and near the top, the one big play (5+ mana permanent) waits.
const _aiScore_q = aiScore;
aiScore = function (P, o, target) {
    const s = _aiScore_q(P, o, target);
    if (s > 0 && P.hand.length < 7 && ['creature', 'artifact', 'enchantment'].includes(Rx(o).kind) && (o.card.cmc || 0) >= 5 && quietState(P).hiding && nearTop(P)) {
        tsPol('quietHolds');
        return 0;
    }
    return s;
};

// A quiet bot likes a peace: it wants the table left alone
{
    const base = dealScore;
    dealScore = function (bot, from, type) {
        const r = base.apply(this, arguments);
        if (r.score <= -90 || !['peace', 'spare'].includes(type) || !tsOn(bot) || !isQuiet(bot)) return r;
        return { ...r, score: r.score + 1, parts: { ...r.parts, quiet: 1 } };
    };
}
