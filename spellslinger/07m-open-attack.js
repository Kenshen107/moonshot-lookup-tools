// Open attack (2026-11-19, owner: "learn from how I, a human, play ... do 1 and 2"; numbers from `node tests/playbook.js` on the owner's records against the lab).
// The owner attacks on turn 3 to 6 and on 70 to 90 percent of turns after turn 4 with 5 to 10 creatures; the computer first attacked on its turn 7 to 9 and on 44 to 59 percent
// of turns. The reason is that `aiChooseAttackersFree` weighs every attacker against ONE defender (`opp(P)`), so a creature that is unsafe against that player stays home even
// when another opponent has no blockers. A person simply swings at whoever is open. With `AI_TUNE.openAttack` (pods only) every other opponent is checked the same way and
// a creature that is safe against one of them attacks that player (`o.openTo`, read by `aiAssignTargets`). The usual holds (stay quiet, plan protection, hold back) still apply.
AI_TUNE.openAttack = 0;
{
    const ac = aiChooseAttackers;
    aiChooseAttackers = function (P) {
        let chosen = ac.apply(this, arguments);
        if (P && P.bf) P.bf.forEach(o => { delete o.openTo; });
        if (!P || !P.isAI || P.aiLevel === 'easy' || G.players.length < 3 || !tn(P, 'openAttack') || !chosen) return chosen;
        if (typeof isQuiet === 'function' && isQuiet(P) && typeof quietState === 'function' && quietState(P).hiding) return chosen; // a stay-quiet deck keeps its word
        const main = G.defender, have = new Set(chosen), added = [];
        const pl = typeof planOf === 'function' ? planOf(P) : null;
        for (const F of foes(P)) {
            if (F.i === main || F.out || (typeof hasPeace === 'function' && hasPeace(P.i, F.i))) continue;
            let safe = [];
            G.defender = F.i; try { safe = aiChooseAttackersFree(P); } finally { G.defender = main; }
            for (const o of safe) {
                if (have.has(o) || !canAttackWith(o)) continue;
                if (pl && pl.protectSet && pl.protectSet.has(o.card.name)) continue; // a plan keeps this one home
                o.openTo = F.i; have.add(o); added.push(o);
            }
        }
        if (!added.length) return chosen;
        let all = [...chosen, ...added];
        if (typeof aiHoldBack === 'function') all = aiHoldBack(P, all, opp(P));
        added.forEach(o => { if (!all.includes(o)) delete o.openTo; });
        if (typeof plPol === 'function') plPol('openAttacks');
        return all;
    };
    const as = aiAssignTargets;
    aiAssignTargets = function (P, attackers) {
        const r = as.apply(this, arguments);
        (attackers || []).forEach(o => { if (o.openTo !== undefined) { const F = G.players[o.openTo]; if (F && !F.out) o.atkTo = o.openTo; } });
        return r;
    };
}
