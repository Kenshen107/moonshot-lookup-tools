// A person's commander in a graveyard (owner's report, 2026-11-17: "if your commander is in the graveyard and then gets exiled or is
// reanimated by an opponent you would have the choice to put it in the command zone"). When another player's effect that touches graveyards
// is about to resolve, the commander's owner is asked once more, even if they already left it there. (An exile of the graveyard already asks
// afterwards; this adds the question before a reanimation or theft takes it.)
'use strict';
(function () {
    const prev = applyEffect;
    applyEffect = async function (P, e, t, src, ...rest) {
        try {
            if (G && !G.over && e && /gy|graveyard|reanim|conscription/i.test(JSON.stringify(e, (k, v) => (k === 'ctx' || typeof v === 'function' ? undefined : v)))) {
                for (const X of G.players) {
                    if (X === P || X.isAI || X.out) continue;
                    for (const o of X.gy.filter(c => c.isCommander)) {
                        const yes = await askYes(X, `${P.name === 'You' ? 'You' : P.name}'s ${src && src.card ? src.card.name : 'effect'} is about to affect ${you(X) ? 'your' : X.name + "'s"} graveyard, where ${o.card.name} is. Put it into the command zone first?`, { card: o.card, yes: 'Command zone', no: 'Leave it' });
                        if (yes && X.gy.includes(o)) { pull(X.gy, o); X.command.push(o); log(`${o.card.name} returns to the command zone (rule 903.9a).`); }
                    }
                }
            }
        } catch (err) { /* never block the effect */ }
        return prev.call(this, P, e, t, src, ...rest);
    };
})();
