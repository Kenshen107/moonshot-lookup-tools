// =====================================================================
// Reactions (2026-11-18, owner: more dialogue that invokes emotion): the bots comment on their own game too - going first, low life, a nearly empty library,
// the commander arriving, a huge spell, a big swing, a sweeper, an infinite-mana loop - and every few turns something small in whatever mood they are in.
// The lines are in 07d3e-voices-reactions.js. Like the rest of the talk there are no random numbers, and nothing is said in autoplay, the lab or games on one device.
// =====================================================================
const reactFirst = n => String(n || '').split(',')[0];
function reactTurn(P) {
    if (!G || !P || !P.isAI || P.out || G.players.length < 3) return;
    if (G.turn === 1 && G.active === P.i && !P.rFirst) { P.rFirst = true; say(P, 'goFirst', 'cheerful', {}, 'goFirst'); }
    if (P.life <= 15 && !P.rLow1) { P.rLow1 = true; say(P, 'lowLife', 'worried', { life: P.life }, 'lowLife'); }
    if (P.life <= 6 && !P.rLow2) { P.rLow2 = true; say(P, 'nearDeath', 'nervous', { life: P.life }, 'nearDeath'); }
    if (P.library.length <= 10 && !P.rDeck) { P.rDeck = true; say(P, 'deckLow', 'worried', { n: P.library.length }, 'deckLow'); }
    // a small remark every eighth turn or so, in the mood the bot is in
    if (G.turn > 4 && (G.turn + P.i * 3) % 8 === 0) {
        const m = typeof saltyMood === 'function' && saltyMood(P) ? 'salty' : (typeof botMood === 'function' ? botMood(P).mood : 'calm');
        const mood = ['cheerful', 'worried', 'smug', 'salty'].includes(m) ? m : (m === 'nervous' || m === 'angry' ? 'worried' : 'calm');
        say(P, 'idle', mood, { n: G.players.filter(X => !X.out).length }, 'idle');
    }
}
{
    const bts = banterTurnStart;
    banterTurnStart = function (P) {
        const r = bts.apply(this, arguments);
        try { reactTurn(P); } catch (err) { /* talk never breaks a game */ }
        return r;
    };
    const f = fire;
    fire = function (ev, ctx) {
        try {
            if (G && !G.over && G.players.length > 2 && ctx) {
                if (ev === 'cast' && ctx.P && ctx.P.isAI && ctx.o) {
                    const P = ctx.P, c = ctx.o.card;
                    if (ctx.o.isCommander && !P.rCmd) { P.rCmd = true; say(P, 'cmdCast', 'cheerful', { card: reactFirst(c.name) }, 'cmdCast'); }
                    else if (((c.cmc || 0) >= 7 || (ctx.o.xVal || 0) >= 6) && !/\bLand\b/.test(c.type || '')) say(P, 'selfBig', 'smug', { card: reactFirst(c.name), n: c.cmc || ctx.o.xVal }, 'selfBig');
                }
                if (ev === 'attacks' && ctx.list && ctx.list.length >= 4) {
                    const P = G.players[ctx.list[0].owner];
                    if (P && P.isAI) say(P, 'swing', 'determined', { n: ctx.list.length }, 'swing');
                }
            }
        } catch (err) { /* talk never breaks a game */ }
        return f.apply(this, arguments);
    };
    const ae = applyEffect;
    applyEffect = async function (P, e) {
        const r = await ae.apply(this, arguments);
        try { if (G && !G.over && G.players.length > 2 && e && e.t === 'wipe' && P && P.isAI && /creature/.test(e.what || 'creature')) say(P, 'wrathCast', 'smug', {}, 'wrathCast'); } catch (err) { /* talk never breaks a game */ }
        return r;
    };
}
