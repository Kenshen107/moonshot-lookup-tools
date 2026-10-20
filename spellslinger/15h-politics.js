// =====================================================================
// Group hug, kingmaking and poison cards (2026-10-20). Wordings are in rules/politics.js.
//  - Truce, Tempt with ... (tempting offers: each opponent may take the same deal, and each one who does gives the caster another go), Horn of Greed,
//    Zenith Chronicler, Stormfist Crusader, Rites of Flourishing, Mana Flare and Heartbeat of Spring.
//  - Donating (Harmless Offering, Donate, Wrong Turn, Zedruu, Bazaar Trader, Humble Defector, Jinxed Idol and Ring): `giveControl`. A person chooses who gets the
//    permanent as the spell resolves; the computer gives a liability to whoever it likes least, and a bot that can no longer win (`isDoomed`, 07g-characters.js)
//    gives its best permanent to the player it trusts most: kingmaking.
//  - Goad (Disrupt Decorum, Coveted Peacock, Goblin Racketeer, Vengeful Ancestor, Agitator Ant) and poison (Swamp Mosquito, Grateful Apparition, Mite tokens).
// No random numbers, so seeded games replay.
// =====================================================================
const ctxRaw = () => (G && G.ctxRaw) || {};
// ---- Trigger filters ----
TRIG_FN.anyLandPlayed = () => true;
TRIG_FN.firstMulti = (o, ctx) => {
    if (!ctx.o || (ctx.o.card.colors || []).length < 2) return false;
    if (ctx.o.multiFirst === undefined) { ctx.o.multiFirst = ctx.P.multiTurn !== G.turn; ctx.P.multiTurn = G.turn; } // first multicolored spell this turn, decided once per spell
    return ctx.o.multiFirst;
};
if (!TRIG_FN.selfAttacks) TRIG_FN.selfAttacks = (o, ctx) => (ctx.list || []).includes(o);
TRIG_FN.goadedAttacks = (o, ctx) => (ctx.list || []).some(x => isGoaded(x));
TRIG_FN.selfUnblocked = (o, ctx) => ctx.o === o;
TRIG_FN.ownNontokenToGy = (o, ctx) => !!ctx.o && !ctx.o.token && ctx.o.owner === o.owner;

// ---- Giving permanents away ----
function giveControl(o, to) {
    const from = G.players[o.owner];
    if (!o || !onBf(o.uid) || !to || to.out || from === to) return false;
    pull(from.bf, o);
    o.realOwner = o.realOwner ?? o.owner; o.owner = to.i; delete o.stolenTurn; o.sick = true;
    to.bf.push(o);
    log(`${to.name} ${you(to) ? 'gain' : 'gains'} control of ${o.card.name}.`);
    return true;
}
const LIABILITY_RE = /deals? \d+ damage to you|you lose \d+ life|sacrifice .* at the beginning of your upkeep/i;
const isLiability = o => LIABILITY_RE.test(String((o.card && o.card.text) || ''));
// Who the computer gives something to
function donateRecipient(P, o, cands) {
    const rel = F => (F.i - P.i + G.players.length) % G.players.length;
    if (typeof isDoomed === 'function' && isDoomed(P) && !isLiability(o) && permValue(o) >= 5) return cands.slice().sort((a, b) => trustOf(P, b) - trustOf(P, a) || ((P.grudge || {})[a.i] || 0) - ((P.grudge || {})[b.i] || 0) || rel(a) - rel(b))[0]; // kingmaking
    return cands.slice().sort((a, b) => trustOf(P, a) - trustOf(P, b) || ((P.grudge || {})[b.i] || 0) - ((P.grudge || {})[a.i] || 0) || rel(a) - rel(b))[0]; // the one it likes least
}
async function pickRecipient(P, e, o) {
    const cands = e.opp === false ? [] : (e.opp ? foes(P) : G.players.filter(X => X !== P && !X.out));
    if (!cands.length) return null;
    if (P.isAI || AUTOPLAY) return donateRecipient(P, o, cands);
    if (cands.length === 1) return cands[0];
    const i = await askMode(P, `Who gains control of ${o.card.name}?`, cands.map(c => c.name));
    return cands[i] || cands[0];
}
// A permanent worth giving away: a liability, else (for a bot that has given up) its best permanent
function bestDonation(P) {
    const mine = P.bf.filter(x => !x.isCommander);
    const bad = mine.filter(isLiability)[0];
    if (bad) return bad;
    if (typeof isDoomed === 'function' && isDoomed(P)) return mine.slice().sort((a, b) => permValue(b) - permValue(a))[0] || null;
    return null;
}

// ---- Tempting offers ----
async function temptDo(X, kind, src) {
    const name = src && src.card ? src.card.name : 'Tempting offer';
    if (kind === 'discovery') {
        const lands = X.library.filter(c => /\bLand\b/.test(c.card.type));
        if (!lands.length) { X._searched = true; return; }
        const have = new Set(X.bf.flatMap(l => (Rx(l).mana && Rx(l).mana.colors) || []));
        const rank = c => ((Rx(c).mana && Rx(c).mana.colors) || []).filter(k => !have.has(k)).length * 2 + (Rx(c).mana ? 1 : 0) + (/\bBasic\b/.test(c.card.type) ? 0 : 0.5);
        const pick = X.isAI || AUTOPLAY ? lands.slice().sort((a, b) => rank(b) - rank(a))[0] : (await pickCard(X, lands, `${name}: search your library for a land card`, { required: true })) || lands[0];
        pull(X.library, pick); X._searched = true;
        reanimateFrom(X, X, pick);
    } else if (kind === 'bunnies') {
        drawCards(X, 1);
        await applyEffect(X, TOKEN(1, 1, 1, 'white Rabbit'), null, src);
    } else if (kind === 'glory') {
        X.bf.filter(isCreature).forEach(c => putCounters(c, 1, X));
        log(`${X.name} ${you(X) ? 'put' : 'puts'} a +1/+1 counter on each creature ${you(X) ? 'you control' : 'they control'}.`);
    } else if (kind === 'immortality') {
        const pool = X.gy.filter(c => /\bCreature\b/.test(c.card.type));
        const pick = await pickOwn(X, pool, `${name}: return a creature card from your graveyard to the battlefield`, { optional: false });
        if (pick) reanimateFrom(X, X, pick);
    }
}
const TEMPT_TEXT = { discovery: 'search your library for a land card and put it onto the battlefield', bunnies: 'draw a card and create a 1/1 Rabbit', glory: 'put a +1/+1 counter on each creature you control', immortality: 'return a creature card from your graveyard to the battlefield' };
function temptBenefit(X, kind) {
    if (kind === 'discovery') return X.library.some(c => /\bLand\b/.test(c.card.type));
    if (kind === 'glory') return X.bf.some(isCreature);
    if (kind === 'immortality') return X.gy.some(c => /\bCreature\b/.test(c.card.type));
    return true;
}
// A bot takes the offer when it gains something, unless the caster is the player the table fears and the bot doesn't like them
function botTempts(F, P, kind) { return temptBenefit(F, kind) && !(G.arch === P.i && !likesCaster(F, P)); }

// ---- The commands ----
Object.assign(CMD_SCORE, { truce: () => 3, tempt: (P, e) => (temptBenefit(P, e.kind) ? 5 : 0), donate: (P, e, t) => (t && t.o && isLiability(t.o) ? 6 : (typeof isDoomed === 'function' && isDoomed(P) ? 5 : 0)), goadAllTheirs: P => (foes(P).flatMap(F => F.bf.filter(isCreature)).length >= 3 ? 6 : 1), goadTarget: () => 3 });
Object.assign(CMD, {
    async truce(P, e, t, src, O, name) {
        for (const X of voteOrder(P)) {
            let n = 2;
            if (!(X.isAI || AUTOPLAY)) n = (await askNumber(X, `${name}: draw up to two cards (each card you skip gains you 2 life)`, 0, 2, 2, { card: src && src.card })) ?? 2;
            if (n > 0) drawCards(X, n);
            if (n < 2) gainLifeFor(X, 2 * (2 - n));
        }
    },
    landOwnerDraws() { const l = ctxRaw().o; if (l) drawCards(G.players[l.owner], 1); },
    othersDrawCaster() { const C = ctxRaw().P; G.players.filter(X => X !== C && !X.out).forEach(X => drawCards(X, 1)); },
    allLose(P, e) { G.players.filter(X => !X.out).forEach(X => { X.life -= e.n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${e.n} life.`); }); },
    async tempt(P, e, t, src, O, name) {
        await temptDo(P, e.kind, src);
        const took = [];
        for (const F of foes(P)) {
            const yes = F.isAI || AUTOPLAY ? botTempts(F, P, e.kind) : await askYes(F, `${name}: ${P.name} offers you the same deal: ${TEMPT_TEXT[e.kind]}. If you take it, ${P.name} gets to do it again. Take the deal?`, { card: src && src.card, yes: 'Take it', no: 'No thanks' });
            if (yes) { await temptDo(F, e.kind, src); took.push(F); log(`${F.name} ${you(F) ? 'take' : 'takes'} the tempting offer.`); }
        }
        for (let i = 0; i < took.length; i++) await temptDo(P, e.kind, src);
        if (e.kind === 'discovery') G.players.forEach(X => { if (X._searched) { X.library = shuffle(X.library); delete X._searched; } });
    },
    async donate(P, e, t, src, O, name) {
        let o = t && t.o;
        if ((P.isAI || AUTOPLAY) && P.isAI) { const best = bestDonation(P); if (best) o = best; }
        if (!o || !onBf(o.uid) || o.owner !== P.i) { log(`${name}: nothing to give away.`); return; }
        const to = await pickRecipient(P, e, o);
        if (to) giveControl(o, to);
    },
    async donateSelf(P, e, t, src) { const to = await pickRecipient(P, { opp: true }, src); if (to && src && onBf(src.uid)) giveControl(src, to); },
    async defectorDraw(P, e, t, src) { drawCards(P, 2); const to = await pickRecipient(P, { opp: true }, src); if (to && src && onBf(src.uid)) giveControl(src, to); },
    zedruuUpkeep(P) { const x = allPerms().filter(o => (o.realOwner ?? o.owner) === P.i && o.owner !== P.i).length; if (x > 0) { gainLifeFor(P, x); drawCards(P, x); } },
    jinxedRingHurts(P, e, t, src) { if (src && onBf(src.uid)) damage(ctrl(src), 1, src); },
    goadAllTheirs(P) { foes(P).flatMap(F => F.bf.filter(isCreature)).forEach(x => goad(x, P.i, nextTurnOf(P))); },
    goadTarget(P, e, t) { const x = t && t.o; if (x && onBf(x.uid)) goad(x, P.i, nextTurnOf(P)); },
    goadedHurt() { (ctxRaw().list || []).filter(x => isGoaded(x)).forEach(x => damage(ctrl(x), 1, x)); },
    async agitatorEnd(P, e, t, src, O, name) {
        for (const X of voteOrder(P)) {
            const cs = X.bf.filter(isCreature);
            if (!cs.length) continue;
            const yes = X.isAI || AUTOPLAY ? (X === P || X.life > 15) : await askYes(X, `${name}: put two +1/+1 counters on a creature you control? It will be goaded: it must attack each combat, and not ${P.name}.`, { card: src && src.card, yes: 'Yes', no: 'No' });
            if (!yes) continue;
            const pick = X.isAI || AUTOPLAY ? cs.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : (await pickCard(X, cs, `${name}: choose a creature`, { required: true })) || cs[0];
            putCounters(pick, 2, X); goad(pick, P.i, nextTurnOf(P));
        }
    },
    poisonDefender(P, e, t, src) { const D = atkDef(src); if (D) { D.poison = (D.poison || 0) + 1; log(`${D.name} ${you(D) ? 'get' : 'gets'} a poison counter.`); } }
});
