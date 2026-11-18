// The table reacts when a computer player starts an infinite-mana loop (2026-11-18, dialogue overhaul): the looper says comboGo, the next bot panics.
// Loaded after 15y-ai-plans.js, which defines giveInfiniteMana; the lines are in 07d3e-voices-reactions.js.
{
    const gim = giveInfiniteMana;
    giveInfiniteMana = function (P) {
        const r = gim.apply(this, arguments);
        try {
            if (G && !G.over && G.players.length > 2) {
                if (P.isAI) say(P, 'comboGo', 'smug', {}, 'comboGo');
                const watcher = G.players.filter(X => X.isAI && !X.out && X !== P).sort((a, b) => ((a.i - P.i + 8) % 8) - ((b.i - P.i + 8) % 8))[0];
                if (watcher) say(watcher, 'comboPanic', 'nervous', { foe: you(P) ? 'you' : who(P) }, 'comboPanic');
            }
        } catch (err) { /* talk never breaks a game */ }
        return r;
    };
}
