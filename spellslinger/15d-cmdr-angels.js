// Engine pieces for the Calling All Angels deck (FDC). Wordings: rules/cmdr.js.
TRIG_FN.cmdrAttacks = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && x.isCommander);
// Replacement effects that put counters on a creature as it enters (Giada, Dragonstorm Globe, ...). Called from fire('enters').
function cmdEntersHooks(x) {
    if (!x || !isCreature(x)) return;
    allPerms().forEach(a => {
        const ep = Rx(a).entersPlus;
        if (!ep || lostAbilities(a) || a.owner !== x.owner || (ep.other && a === x)) return;
        if (ep.sub && !hasType(x, ep.sub)) return;
        const n = ep.perCount ? G.players[a.owner].bf.filter(y => y !== x && isCreature(y) && hasType(y, ep.perCount)).length : (ep.n || 1);
        if (n > 0) { x.counters += n; log(`${x.card.name} enters with ${n} additional +1/+1 counter${n === 1 ? '' : 's'} (${a.card.name}).`); }
    });
}
Object.assign(CMD, {
    // Court of Grace: a 1/1 Spirit, or a 4/4 Angel if you're the monarch
    async courtGrace(P, e, t, src) {
        if (G.monarch === P.i) await applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'white Angel', kw: ['flying'] }, null, src);
        else await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white Spirit', kw: ['flying'] }, null, src);
    },
    // Emeria Shepherd: a land entered; return a nonland permanent card from your graveyard (to the battlefield instead if the land is a Plains)
    async emeria(P, e, t, src, O, name) {
        const land = G.ctxObj;
        const pool = P.gy.filter(x => !/\bLand\b/.test(x.card.type) && /\b(?:Artifact|Creature|Enchantment|Planeswalker|Battle)\b/.test(x.card.type));
        if (!pool.length) return;
        const pick = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return a nonland permanent card from your graveyard`, { optional: true });
        if (!pick) return;
        const toBf = !!land && hasType(land, 'Plains') && (P.isAI || await askYes(P, `${name}: put ${pick.card.name} onto the battlefield instead of your hand?`, { card: pick.card, yes: 'Battlefield', no: 'Hand' }));
        if (toBf) reanimateFrom(P, P, pick); else { pull(P.gy, pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${pick.card.name} to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Grasp of Fate: exile up to one nonland permanent from each opponent until this leaves the battlefield
    async exileEachOpp(P, e, t, src) {
        for (const X of oppsOf(P)) {
            const pool = X.bf.filter(x => !/\bLand\b/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
            if (!pool.length) continue;
            const pick = P.isAI ? pool.slice().sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: exile a nonland permanent ${X.name} controls (or none)`, { optional: true });
            if (!pick) continue;
            log(`${pick.card.name} is exiled until ${src.card.name} leaves the battlefield.`);
            leaveBattlefield(pick, 'exile');
            if (!pick.token && onBf(src.uid)) pick.exiledBy = src.uid;
        }
    },
    async gainCtxTou(P) { const x = G.ctxObj; if (!x) return; gainLifeFor(P, Math.max(0, tou(x))); },
    async wojekInvestigate(P, e, t, src) {
        const n = oppsOf(P).filter(F => F.hand.length > P.hand.length).length;
        if (n > 0) await applyEffect(P, { t: 'artToken', n, kind: 'clue' }, null, src);
    }
});
