// Engine pieces for the Odric, Lunarch Marshal deck (2026-10-19, owner's request). Wordings: rules/odric.js.
// Shield counters, prevention turns and the player-hexproof turn are checked in 06-engine.js (damage, destroy, validTargets); the
// "indestructAll" emblem is checked in has(); Nyx Lotus's mana is worked out in manaOf (`devotionBest`).
TRIG_FN.odricAttack = (o, ctx) => !!ctx.list && ctx.list.includes(o) && ctx.list.length >= 4;
TRIG_FN.hostCombatToCreature = (o, ctx) => !!ctx.src && ctx.src.uid === o.attachedTo && !!G.inCombatDamage && !!ctx.o && isCreature(ctx.o);
STATIC_FN.firstStrike = o => has(o, 'first strike');
COND_EXTRA.push([/^you control a legendary creature or planeswalker$/, () => P => P.bf.some(x => /\bLegendary\b/.test(x.card.type) && (isCreature(x) || isPlaneswalker(x)))]);

// A short pick from a list of words (Elspeth Resplendent's counter): the computer takes the first, a person gets buttons
function pickWord(P, title, words) {
    if (P.isAI || AUTOPLAY) return Promise.resolve(words[0]);
    return new Promise(resolve => {
        window.__word = i => { closeModal(); resolve(words[i]); };
        showModal(`<h2>${esc(title)}</h2><div class="row" style="flex-direction:column; align-items:stretch; gap:8px;">${words.map((w, i) => `<button class="btn" onclick="__word(${i})">${esc(w)}</button>`).join('')}</div>`);
    });
}
const hasAnyPro = c => [...Rx(c).kw].some(k => /^pro/.test(k)) || c.tkw.some(k => /^pro:/.test(k));
const AKROMA_KW = ['flying', 'first strike', 'double strike', 'deathtouch', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance'];

// Odric, Master Tactician: while the trigger's effect lasts, the player who attacked picks every block (the game picks the ones that favor the attackers)
const odricActive = () => !!G && !!G.odric && G.odric.turn === G.turn;
function odricBlocks() {
    const A = G.players[G.odric.by], D = G.defender !== undefined && G.players[G.defender] ? G.players[G.defender] : opp(A);
    const attackers = G.attackers.map(onBf).filter(Boolean).sort((a, b) => pow(b) - pow(a));
    const blockers = D.bf.filter(b => isCreature(b) && !b.tapped).sort((a, b) => permValue(b) - permValue(a));
    G.blocks = {};
    const used = new Set(), ex = new Map();
    for (const b of blockers) {
        const pick = attackers.find(a => canBlock(b, a) && combatKills(a, b) && !combatKills(b, a) && !(G.blocks[a.uid] || []).length) || null;
        if (pick) { (G.blocks[pick.uid] = G.blocks[pick.uid] || []).push(b.uid); used.add(b.uid); }
    }
    log(`${A.name} ${you(A) ? 'choose' : 'chooses'} how ${D.name === 'You' ? 'your' : `${D.name}'s`} creatures block (Odric, Master Tactician): ${used.size ? `${used.size} block${used.size === 1 ? '' : 's'}` : 'no blocks'}.`);
}

Object.assign(CMD_SCORE, {
    loransEscape: () => 3, spontaneousFlight: () => 4, unbreakableFormation: P => (P.bf.filter(isCreature).length >= 2 ? 3 : 0),
    eerieInterference: P => (G.phase === 'declareBlocks' || G.phase === 'afterBlocks' ? 5 : 0), surgeOfSalvation: () => 0,
    ruinousBlast: P => { const val = X => X.bf.filter(x => !/\bLand\b/.test(x.card.type) && !/\bLegendary\b/.test(x.card.type)).reduce((s, x) => s + permValue(x), 0); const d = foes(P).reduce((a, F) => a + val(F), 0) - val(P); return d > 6 ? d : 0; },
    odricControl: () => 4, guardianPump: () => 3, akromaVision: () => 3, emblemIndestruct: () => 6,
    resplendentPlus: () => 5, resplendentMinus: () => 4, wandererPlus: () => 3, wandererMinus: P => { const mine = P.bf.filter(isCreature).length; const theirs = foes(P).reduce((a, F) => a + F.bf.filter(isCreature).length, 0); return theirs - mine >= 3 ? 7 : 0; }
});
Object.assign(CMD, {
    // Guardian of the Gateless
    guardianPump(P, e, t, src) {
        const n = Object.values(G.blocks).filter(bs => bs.includes(src.uid)).length;
        if (n > 0) { src.tp += n; src.tq += n; log(`${src.card.name} gets +${n}/+${n} until end of turn (blocking ${n}).`); }
    },
    // Akroma, Vision of Ixidor: each other creature you control gets +1/+1 for each of these it has (fixed when it resolves)
    akromaVision(P, e, t, src) {
        for (const c of P.bf.filter(x => isCreature(x) && x !== src)) {
            let n = AKROMA_KW.filter(k => has(c, k)).length;
            if (hasAnyPro(c)) n++;
            if (/\bPartner\b/.test(c.card.text || '')) n++;
            if (n > 0) { c.tp += n; c.tq += n; log(`${c.card.name} gets +${n}/+${n} until end of turn (${src.card.name}).`); }
        }
    },
    eerieInterference(P) { P.eerieTurn = G.turn; log(`All damage creatures would deal to ${P.name === 'You' ? 'you' : P.name} and ${P.name === 'You' ? 'your' : 'their'} creatures is prevented this turn.`); },
    surgeOfSalvation(P) {
        P.hexTurn = G.turn; P.surgeTurn = G.turn;
        P.bf.forEach(x => { if (!x.tkw.includes('hexproof')) x.tkw.push('hexproof'); });
        log(`${P.name === 'You' ? 'You and your' : `${P.name} and their`} permanents gain hexproof until end of turn; damage from black and red sources to ${P.name === 'You' ? 'your' : 'their'} creatures is prevented.`);
    },
    loransEscape(P, e, t, src) {
        if (t && t.o && onBf(t.o.uid)) { t.o.tkw.push('hexproof'); t.o.indUntil = G.turn; log(`${t.o.card.name} gains hexproof and indestructible until end of turn.`); }
        return applyEffect(P, { t: 'scry', n: 1 }, null, src);
    },
    spontaneousFlight(P, e, t) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        t.o.tp += 2; t.o.tq += 2; t.o.ctr.flying = (t.o.ctr.flying || 0) + 1;
        log(`${t.o.card.name} gets +2/+2 until end of turn and a flying counter.`);
    },
    unbreakableFormation(P) {
        const main = G.active === P.i && ['main1', 'main2', 'main'].includes(G.phase) || (typeof MAIN !== 'undefined' && G.active === P.i && MAIN.includes(G.phase));
        const mine = P.bf.filter(isCreature);
        mine.forEach(c => { c.indUntil = G.turn; });
        log(`Creatures ${P.name === 'You' ? 'you control' : `${P.name} controls`} gain indestructible until end of turn.`);
        if (main) { mine.forEach(c => { putCounters(c, 1, P); if (!c.tkw.includes('vigilance')) c.tkw.push('vigilance'); }); log('Addendum: each of them gets a +1/+1 counter and vigilance until end of turn.'); }
    },
    ruinousBlast(P) {
        const hit = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !/\bLegendary\b/.test(x.card.type));
        log(`Urza's Ruinous Blast exiles ${hit.length} nonlegendary nonland permanent${hit.length === 1 ? '' : 's'}.`);
        hit.forEach(x => { if (onBf(x.uid)) leaveBattlefield(x, 'exile'); });
    },
    // Odric, Master Tactician
    odricControl(P) { G.odric = { turn: G.turn, by: P.i }; log(`${P.name} ${you(P) ? 'choose' : 'chooses'} the blocks this combat (Odric, Master Tactician).`); },
    // Elspeth, Knight-Errant
    emblemIndestruct(P) { (P.emblems = P.emblems || []).push('indestructAll'); log(`${P.name} ${you(P) ? 'get' : 'gets'} an emblem: artifacts, creatures, enchantments and lands ${you(P) ? 'you control' : 'they control'} have indestructible.`); },
    // Elspeth Resplendent
    async resplendentPlus(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        const word = await pickWord(P, `${src.card.name}: choose a counter`, ['flying', 'first strike', 'lifelink', 'vigilance']);
        putCounters(t.o, 1, P);
        t.o.ctr[word] = (t.o.ctr[word] || 0) + 1;
        log(`${t.o.card.name} gets a +1/+1 counter and a ${word} counter.`);
    },
    async resplendentMinus(P, e, t, src) {
        const top = P.library.splice(-Math.min(7, P.library.length)).reverse();
        if (!top.length) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards${you(P) ? `: ${top.map(c => c.card.name).join(', ')}` : ''}.`);
        const pool = top.filter(c => Rx(c).kind !== 'instant' && Rx(c).kind !== 'sorcery' && !/Instant|Sorcery/.test(c.card.type) && (c.card.cmc || 0) <= 3);
        const pick = await pickOwn(P, pool, `${src.card.name}: put a permanent card (mana value 3 or less) onto the battlefield with a shield counter`, { optional: true });
        const rest = top.filter(c => c !== pick);
        if (pick) { putOntoBattlefield(P, pick, false); pick.ctr.shield = 1; log(`${pick.card.name} gets a shield counter.`); await settle(); }
        P.library.unshift(...shuffle(rest));
    },
    // The Eternal Wanderer
    wandererPlus(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        const x = t.o, X = G.players[x.realOwner ?? x.owner];
        leaveBattlefield(x, 'exile');
        if (!X.exile.includes(x)) return; // a token is gone for good
        (G.wanderQ = G.wanderQ || []).push({ o: x, owner: X.i, after: G.turn });
        log(`${x.card.name} is exiled; it returns at the beginning of ${X.name === 'You' ? 'your' : `${X.name}'s`} next end step.`);
    },
    async wandererMinus(P, e, t, src) {
        const keep = new Set();
        for (const X of G.players.filter(y => !y.out)) {
            const pool = X.bf.filter(isCreature);
            if (!pool.length) continue;
            let pick;
            if (pool.length === 1) pick = pool[0];
            else if (P.isAI || AUTOPLAY) pick = pool.slice().sort((a, b) => (X === P ? permValue(b) - permValue(a) : permValue(a) - permValue(b)))[0]; // keep my best; leave the others their worst
            else pick = (await pickCard(P, pool, `${src.card.name}: choose a creature ${X === P ? 'you control' : `${X.name} controls`} to keep`, { required: true })) || pool[0];
            keep.add(pick);
        }
        const doomed = allPerms().filter(x => isCreature(x) && !keep.has(x));
        log(`${src.card.name}: ${doomed.length} creature${doomed.length === 1 ? '' : 's'} sacrificed.`);
        for (const x of doomed) { if (!onBf(x.uid)) continue; fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); }
    }
});
// Return the Eternal Wanderer's exiled cards at the owner's next end step (called from runEndQueue)
function wandererReturns() {
    const due = (G.wanderQ || []).filter(w => w.owner === G.active && (w.after < G.turn || G.active === w.owner));
    G.wanderQ = (G.wanderQ || []).filter(w => !due.includes(w));
    for (const w of due) {
        const X = G.players[w.owner], x = w.o;
        if (!X.exile.includes(x)) continue;
        pull(X.exile, x); resetObj(x); x.sick = true; X.bf.push(x);
        log(`${x.card.name} returns to the battlefield.`);
        fire('enters', { o: x });
        if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: x, effects: Rx(x).etb });
    }
}
