// Engine pieces for the Marvel Commander precons (MSC). Wordings: rules/soc.js (the "Marvel Commander precons" part).
const isModified = o => o.counters > 0 || Object.entries(o.ctr || {}).some(([k, v]) => k !== 'loyalty' && k !== 'defense' && v > 0) || allPerms().some(a => a.attachedTo === o.uid);
const heroOf = x => hasType(x, 'Hero');
TRIG_FN.capLegend = (o, ctx) => { const x = ctx.o; if (!x || x.owner !== o.owner || !isCreature(x) || G.active !== o.owner || x.tapUntapTurn === G.turn) return false; x.tapUntapTurn = G.turn; return true; };
TRIG_FN.marvelCounters = (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o) && !hasType(ctx.o, 'Kree') && (ctx.n || 0) > 0;
TRIG_FN.folkHero = (o, ctx) => {
    if (!ctx.o || ctx.P.i !== o.owner) return false;
    const types = (ctx.o.card.type.split(' — ')[1] || '').split(' ').filter(Boolean);
    if (!types.length) return false;
    return G.players[o.owner].bf.some(c => c.isCommander && isCreature(c) && (c.card.type.split(' — ')[1] || '').split(' ').some(t => types.includes(t)));
};
TRIG_FN.hawkeyeKill = (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && !!ctx.o.dmgBy && ctx.o.dmgBy[o.uid] === G.turn;
TRIG_FN.commanderHit = (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && !!ctx.src.isCommander;
TRIG_FN.commanderAttackFromGy = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && x.isCommander);
TRIG_FN.attackWithTwo = (o, ctx) => { const mine = (ctx.list || []).filter(x => x.owner === o.owner); return mine.length === 2 && mine.length === (ctx.list || []).length; };
TRIG_FN.loveHit = (o, ctx) => !!ctx.src && ctx.src.loveMark === G.turn && ctx.src.owner === o.owner;
TRIG_FN.tenthCounter = (o, ctx) => ctx.o === o && o.counters >= 10 && !o.tenthDone && (o.tenthDone = true);
TRIG_FN.heroBlocked = (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && heroOf(ctx.o) && ((G.blocks[ctx.o.uid] || []).length > 0);
TRIG_FN.notTheirTurn = (o, ctx) => ctx.P.i !== G.active;
Object.assign(CMD_SCORE, { digHero: () => 3 });
Object.assign(CMD, {
    async heroFromHand(P, e, t, src) {
        const pool = P.hand.filter(x => /\bCreature\b/.test(x.card.type) && heroOf(x));
        const pick = await pickOwn(P, pool, `${src.card.name}: put a Hero creature card from your hand onto the battlefield (or none)`, { optional: true });
        if (pick) putOntoBattlefield(P, pick);
    },
    async digHero(P, e, t, src) { await digInto(P, e.n, x => heroOf(x), 'reveal a Hero card to put into your hand', src); },
    untapCtx() { const x = G.ctxObj; if (x && onBf(x.uid) && x.tapped) { x.tapped = false; log(`${x.card.name} untaps.`); } },
    capTeam(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return;
        x.tkw.push('vigilance', 'haste'); x.sick = false;
        putCounters(x, 1, P); if (onBf(src.uid)) putCounters(src, 1, P);
        log(`${x.card.name} gains vigilance and haste and gets a +1/+1 counter, and so does ${src.card.name}.`);
    },
    copyCounters(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0 && onBf(src.uid)) { const got = putCounters(src, n, P); log(`${src.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} too.`); } },
    async falconBirds(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0;
        if (n > 0) await applyEffect(P, TOKEN(n, 1, 1, 'white Bird', ['flying']), null, src);
        if (onBf(src.uid)) putCounters(src, 1, P);
    },
    firebirdBoost(P, e, t, src) { const x = Math.max(0, pow(src)); G.attackers.map(u => onBf(u)).filter(a => a && a !== src && a.owner === P.i).forEach(a => { a.tp += x; }); if (x) log(`Other attacking creatures get +${x}/+0 until end of turn.`); },
    herculesCounters(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0 && onBf(src.uid)) { const got = putCounters(src, n, P); log(`${src.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } },
    async attachSelfToCtx(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(src.uid) || !onBf(x.uid) || x.owner !== P.i) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: attach it to ${x.card.name}?`, { card: src.card }))) return;
        src.attachedTo = x.uid; log(`${src.card.name} is attached to ${x.card.name}.`);
    },
    async heroicSacrifice(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        P.hsRedirect = { turn: G.turn, uid: x.uid };
        log(`All damage that would be dealt to ${you(P) ? 'you' : P.name} and ${you(P) ? 'your' : 'their'} creatures is dealt to ${x.card.name} instead this turn.`);
    },
    async heroicSacrificeDies(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.counters) || 0;
        if (t && t.o && onBf(t.o.uid) && n > 0) { putCounters(t.o, n, P); log(`${t.o.card.name} gets ${n} +1/+1 counter${n === 1 ? '' : 's'}.`); }
        drawCards(P, 1);
    },
    modifiedAttackers(P, e, t, src) {
        const list = G.attackers.map(u => onBf(u)).filter(a => a && a.owner === P.i && (e.self || a !== src) && isModified(a));
        list.forEach(a => a.tkw.push(...e.kw));
        if (list.length) log(`${list.map(a => a.card.name).join(', ')} gain${list.length === 1 ? 's' : ''} ${e.kw.join(', ')} until end of turn.`);
    },
    async jocastaReturn(P, e, t, src) {
        if (!P.gy.includes(src)) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: return it to the battlefield tapped and attacking?`, { card: src.card }))) return;
        reanimateFrom(P, P, src); src.tapped = true; if (!G.attackers.includes(src.uid)) G.attackers.push(src.uid);
    },
    loveBattlefield(P, e, t, src) {
        const mine = G.attackers.map(u => onBf(u)).filter(a => a && a.owner === P.i);
        mine.forEach(a => { a.tkw.push('first strike'); a.loveMark = G.turn; });
        drawCards(P, 1); log(`${mine.map(a => a.card.name).join(' and ')} gain first strike until end of turn; ${P.name} ${you(P) ? 'draw' : 'draws'} a card.`);
    },
    loveCounter(P) { /* the creature that dealt damage is the event's source */ const x = G.ctxRaw && G.ctxRaw.src; if (x && onBf(x.uid)) { putCounters(x, 1, P); log(`${x.card.name} gets a +1/+1 counter.`); } },
    photonMana(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n <= 0) return;
        const col = bestPoolColor(P);
        P.pool = (P.pool || []).concat(Array(n).fill(col)); P.keepPoolTurn = G.turn;
        log(`${P.name} ${you(P) ? 'add' : 'adds'} ${n} {${col}} (it stays until end of turn).`);
    },
    drawDamage(P) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0) drawCards(P, n); },
    rescuePepper(P, e, t, src) {
        const x = t && t.o; if (!x || x === src || !onBf(x.uid)) return;
        const art = /\bArtifact\b/.test(x.card.type);
        log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand');
        if (art && onBf(src.uid)) putCounters(src, 1, P);
    },
    async scarletWitch(P, e, t, src) {
        const top = P.library.splice(Math.max(0, P.library.length - 2)).reverse();
        top.forEach(c => { P.exile.push(c); });
        src.exiledWith = [...(src.exiledWith || []), ...top];
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library face down.`);
        exiledOwn(P);
        const pool = (src.exiledWith || []).filter(x => P.exile.includes(x) && Rx(x).support !== 'none' && Rx(x).kind !== 'land' && (heroOf(x) || Rx(x).kind !== 'creature'));
        const pick = await pickOwn(P, pool, `${src.card.name}: cast a Hero or noncreature spell exiled with it without paying its mana cost (or none)`, { optional: true });
        if (pick) await castFreeAuto(P, pick);
    },
    shangChi(P) { drawCards(P, 5); gainLifeFor(P, 5); },
    sheHulk(P, e, t, src) { const hero = G.ctxObj; const n = hero ? (G.blocks[hero.uid] || []).length : 0; if (hero && onBf(hero.uid) && n > 0) { const got = putCounters(hero, n, P); log(`${hero.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } },
    async speedTrick(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        if (!(await optionalCost(P, { t: 'optPay', cost: parseCost('{1}') }, src))) return;
        x.hasteBlockOnly = G.turn; log(`${x.card.name} can't be blocked this turn except by creatures with haste.`);
    },
    phaseOutSelf(P, e, t, src) { if (onBf(src.uid)) phaseOut(src); },
    async westCoast(P, e, t, src) {
        drawCards(P, e.n);
        if (e.n < 5) return;
        const pool = P.hand.filter(x => heroOf(x) && Rx(x).kind !== 'land' && Rx(x).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: cast a Hero spell from your hand without paying its mana cost (or none)`, { optional: true });
        if (pick) await castFreeAuto(P, pick);
    },
    async winterSoldier(P, e, t, src) {
        const X = Math.max(0, pow(src));
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type) && (x.card.cmc || 0) <= X);
        const pick = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${X} or less to the battlefield`, { optional: true });
        if (!pick) return;
        reanimateFrom(P, P, pick);
        if (heroOf(pick)) putCounters(pick, 1, P);
    }
});
Object.assign(CMD, {
    async dismantlingWave(P, e, t, src) {
        for (const F of oppsOf(P)) {
            const pool = F.bf.filter(x => /Artifact|Enchantment/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
            const pick = await pickOwn(P, pool, `${src.card.name}: destroy an artifact or enchantment ${F.name} controls (or none)`, { optional: true, rank: (a, b) => permValue(b) - permValue(a) });
            if (pick && !has(pick, 'indestructible')) { log(`${pick.card.name} is destroyed.`); dieOrLeave(pick, 'gy'); }
        }
    }
});

// ===== Doom Prevails =====
TRIG_FN.attackEnchanted = (o, ctx) => { const a = (ctx.list || [])[0]; return !!a && a.owner === o.owner && o.hostPlayer !== undefined && gAttackDefender(a.owner) === o.hostPlayer; };
TRIG_FN.attackedMe = (o, ctx) => { const a = (ctx.list || [])[0]; return !!a && a.owner !== o.owner && gAttackDefender(a.owner) === o.owner; };
TRIG_FN.discardedLand = (o, ctx) => ctx.P.i === o.owner && !!ctx.o && /\bLand\b/.test(ctx.o.card.type);
TRIG_FN.myConnive = (o, ctx) => !!ctx.o && ctx.o.owner === o.owner;
TRIG_FN.villainsHit = (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Villain'));
TRIG_FN.goadedHit = (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => isGoaded(x));
TRIG_FN.ladyLoki = (o, ctx) => ctx.P.i === o.owner && !!ctx.o && (['instant', 'sorcery'].includes(Rx(ctx.o).kind) || hasType(ctx.o, 'Villain'));
TRIG_FN.oppFirstNoncreature = (o, ctx) => { const Q = ctx.P; if (Q.i === o.owner || !ctx.o) return false; const k = Q.nonCreatureCasts && Q.nonCreatureCasts.turn === G.turn ? Q.nonCreatureCasts.n : 0; Q.nonCreatureCasts = { turn: G.turn, n: k + 1 }; return k === 0; };
TRIG_FN.miracleFirst = (o, ctx) => ctx.P.i === o.owner && ctx.n === 1 && !!ctx.o && !/\bLand\b/.test(ctx.o.card.type);
// A spell cast from a zone while its controller pays its normal mana cost, in the middle of something resolving (Helmut Zemo)
async function castPaying(P, o) {
    if (!canPay(P, o)) return false;
    const te = firstTargetEffect(o); let target;
    if (te) {
        const valid = validTargets(P, te, o); if (!valid.length) return false;
        if (P.isAI || AUTOPLAY) target = aiPickTarget(P, te, o, valid); else { const saved = G.mode; target = await chooseTarget(P, te, o, true); G.mode = saved; }
        if (!target) return false;
    }
    return castSpell(P, o, target);
}
Object.assign(CMD, {
    ultronDestroy(P, e, t, src) {
        oppsOf(P).forEach(F => { const pool = F.bf.filter(x => isCreature(x) && !/\bArtifact\b/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src)); const pick = pool.sort((a, b) => creatureValue(b) - creatureValue(a))[0]; if (pick && !has(pick, 'indestructible')) { log(`${pick.card.name} is destroyed.`); dieOrLeave(pick, 'gy'); } });
    },
    async robotPerOpp(P, e, t, src) { const n = oppsOf(P).length; if (n) await applyEffect(P, ROBOT(n), null, src); },
    ultronChapter3(P) { const l = P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)); l.forEach(x => { x.tkw.push('deathtouch'); putCounters(x, 1, P); }); log(`Artifact creatures you control gain deathtouch and get a +1/+1 counter.`); },
    async archnemesisHit(P, e, t, src) { const X = G.players[src.hostPlayer]; if (!X) return; X.life -= 2; X.lostTurn = G.turn; fire('loseLife', { P: X, n: 2 }); log(`${X.name} loses 2 life (Archnemesis).`); drawCards(P, 1); gainLifeFor(P, 2); },
    async archnemesisMove(P, e, t, src) {
        const a = G.ctxRaw && G.ctxRaw.list && G.ctxRaw.list[0]; if (!a) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: attach it to ${G.players[a.owner].name}?`, { card: src.card }))) return;
        src.hostPlayer = a.owner; log(`${src.card.name} now enchants ${G.players[a.owner].name}.`);
    },
    async conniveCtx(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: have ${x.card.name} connive?`, { card: x.card }))) return;
        await applyChoiceEffect(P, { t: 'connive', target: 'creature' }, src, { o: x });
    },
    async batroc(P, e, t, src) {
        const k = src.kickN || 0; if (!k) return;
        const x = Math.max(0, pow(src)); const hits = [];
        for (let i = 0; i < k; i++) {
            const valid = validTargets(P, { t: 'dmg', target: 'any' }, src).filter(v => !hits.some(h => sameTarget(h, v)));
            if (!valid.length) break;
            let pick;
            if (P.isAI || AUTOPLAY) pick = aiPickTarget(P, { t: 'dmg', n: x, target: 'any' }, src, valid);
            else { const saved = G.mode; pick = await chooseTarget(P, { t: 'dmg', n: x, target: 'any', optional: true }, src, true); G.mode = saved; }
            if (!pick || hits.some(h => sameTarget(h, pick))) break; hits.push(pick);
        }
        hits.forEach(h => damage(h.o || h.p, x, src));
        if (hits.length) log(`${src.card.name} deals ${x} damage to ${hits.map(burnTargetName).join(', ')}.`);
    },
    async blackMarket(P, e, t, src) {
        const MODES = ['Sell Contraband — Create a Treasure token. You lose 1 life.', 'Buy Information — Draw a card. You lose 2 life.', 'Hire a Mercenary — Create a 3/2 Shapeshifter with changeling. You lose 3 life.'];
        const picks = [];
        if (P.isAI || AUTOPLAY) { if (P.life > 6) picks.push(0); if (P.life > 8) picks.push(1); if (P.life > 12) picks.push(2); }
        else for (let k = 0; k < 3; k++) { const left = [0, 1, 2].filter(i => !picks.includes(i)); const labels = left.map(i => MODES[i]); const r = await askMode(P, `${src.card.name}: choose a mode (${picks.length} chosen)`, picks.length ? [...labels, 'Done'] : labels); if (r >= left.length) break; picks.push(left[r]); }
        for (const m of picks.sort()) {
            if (m === 0) { makeArtifactToken(P, 'treasure'); tokenMade(P); P.life -= 1; log(`${P.name} ${you(P) ? 'create' : 'creates'} a Treasure and ${you(P) ? 'lose' : 'loses'} 1 life.`); }
            else if (m === 1) { drawCards(P, 1); P.life -= 2; log(`${P.name} ${you(P) ? 'draw' : 'draws'} a card and ${you(P) ? 'lose' : 'loses'} 2 life.`); }
            else { await applyEffect(P, { t: 'token', n: 1, p: 3, q: 2, name: 'colorless Shapeshifter', kw: ['changeling'] }, null, src); P.life -= 3; log(`${P.name} ${you(P) ? 'lose' : 'loses'} 3 life.`); }
            P.lostTurn = G.turn;
        }
    },
    async damoclesChoice(P, e, t, src) {
        const F = G.defender != null ? G.players[G.defender] : opp(P);
        const pool = F.bf.filter(x => isCreature(x) && !x.token);
        let sac;
        if (!pool.length) sac = false; else if (F.isAI || AUTOPLAY) sac = F.life <= 8 || pool.some(x => creatureValue(x) < 3); else sac = (await askMode(F, `${src.card.name}: a villainous choice`, ['Sacrifice a nontoken creature', 'Lose 2 life and let them draw two cards'])) === 0;
        if (sac) { const pick = await chooseFrom(F, pool, `${src.card.name}: sacrifice a nontoken creature`); if (pick) { fire('sacrificed', { o: pick }); log(`${F.name} ${you(F) ? 'sacrifice' : 'sacrifices'} ${pick.card.name}.`); dieOrLeave(pick, 'gy'); return; } }
        F.life -= 2; F.lostTurn = G.turn; fire('loseLife', { P: F, n: 2 }); drawCards(P, 2); log(`${F.name} loses 2 life and ${P.name} draws two cards.`);
    },
    loseOpps(P, e) { foes(P).forEach(F => { F.life -= e.n; F.lostTurn = G.turn; fire('loseLife', { P: F, n: e.n }); }); log(`Each opponent loses ${e.n} life.`); },
    async doomCombat(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; x.tkw.push('menace'); await applyChoiceEffect(P, { t: 'connive', target: 'creature' }, src, { o: x }); },
    async timePlatform(P, e, t, src) {
        const pool = P.gy.filter(x => !/\bLand\b/.test(x.card.type) && Rx(x).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: exile a nonland card from your graveyard with two time counters on it`, { optional: false, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (!pick) return;
        pull(P.gy, pick); P.exile.push(pick); pick.ctr = pick.ctr || {}; pick.ctr.time = 2; pick.suspended = true;
        log(`${pick.card.name} is exiled with two time counters${Rx(pick).suspend ? '' : ' and gains suspend'}.`); exiledOwn(P);
    },
    async hydraRanks(P, e, t, src) { const n = oppsOf(P).length; if (n) await applyEffect(P, { t: 'token', n, p: 2, q: 1, name: 'black Villain', kw: ['menace'] }, null, src); },
    async hydraReturn(P, e, t, src) {
        if (!P.gy.includes(src) || !planPayment(P, parseCost('{1}{B}'))) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: pay {1}{B} to return it to your hand?`, { card: src.card }))) return;
        planPayment(P, parseCost('{1}{B}')).forEach(x => tapSource(P, x)); pull(P.gy, src); P.hand.push(src); log(`${src.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    async extractPower(P, e, t, src) {
        for (const X of G.players.filter(y => !y.out)) {
            const c = X.library.pop(); if (!c) continue;
            if (X !== P) { c.realOwner = X.i; c.owner = P.i; }
            c.playUntil = 1e9; c.playAny = true; c.freeCast = true; P.exile.push(c);
        }
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top card of each library face down; they can be played without paying their mana costs.`);
        exiledOwn(P);
    },
    async gloriousPurposeTick(P, e, t, src) {
        const x = G.ctxObj; if (x && onBf(x.uid)) putCounters(x, 1, P);
        src.ctr.plan = (src.ctr.plan || 0) + 1; log(`${src.card.name} gets a plan counter (${src.ctr.plan}).`);
        if (src.ctr.plan === 6 && onBf(src.uid)) {
            log(`${src.card.name} is sacrificed.`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy');
            const top = P.library.splice(Math.max(0, P.library.length - 4)).reverse(); top.forEach(c => P.exile.push(c));
            for (const c of top.filter(c => Rx(c).kind !== 'land' && Rx(c).support !== 'none')) { if (P.exile.includes(c) && (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }))) await castFreeAuto(P, c); }
            top.filter(c => P.exile.includes(c)).forEach(c => { pull(P.exile, c); P.hand.push(c); });
        }
    },
    async zemoAttack(P, e, t, src) {
        const X = Math.max(0, pow(src));
        const pool = P.gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind) && (x.card.cmc || 0) <= X && Rx(x).support !== 'none' && canPay(P, x));
        const pick = await pickOwn(P, pool, `${src.card.name}: cast an instant or sorcery card with mana value ${X} or less from your graveyard (or none)`, { optional: true });
        if (!pick) return;
        pick.exileAfter = true;
        if (await castPaying(P, pick)) putCounters(src, 1, P); else pick.exileAfter = false;
    },
    ironMonger(P) { P.bf.filter(x => isCreature(x) && hasType(x, 'Villain')).forEach(x => putCounters(x, 1, P)); },
    async ultronRobot(P, e, t, src) { if (await optionalCost(P, { t: 'optPay', cost: parseCost('{1}') }, src)) await applyEffect(P, ROBOT(1), null, src); },
    async kangDynasty12(P, e, t, src) {
        for (const F of oppsOf(P)) {
            const pool = F.bf.filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud'));
            const pick = await pickOwn(P, pool, `${src.card.name}: tap up to one creature ${F.name} controls and goad it`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
            if (!pick) continue;
            pick.tapped = true; goad(pick, P.i, nextTurnOf(P)); pick.kangDraw = { by: P.i, until: nextTurnOf(P) };
        }
    },
    kangDynasty3(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const n = P.hand.length; x.tp += n; x.tq += n; x.tkw.push('unblockable'); log(`${x.card.name} gets +${n}/+${n} and can't be blocked this turn.`); },
    async kangPrime(P, e, t, src) {
        const seen = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); P.exile.push(c); if (!/\bLand\b/.test(c.card.type)) { hit = c; break; } seen.push(c); }
        if (!hit) return;
        hit.ctr = hit.ctr || {}; hit.ctr.time = 2; hit.suspended = true;
        log(`${hit.card.name} is exiled with two time counters${Rx(hit).suspend ? '' : ' and gains suspend'}.`); exiledOwn(P);
    },
    killmongerBoost(P, e, t, src) { const D = G.defender != null ? G.players[G.defender] : opp(P); const n = D.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length; if (n && onBf(src.uid)) { src.tp += n; log(`${src.card.name} gets +${n}/+0 until end of turn.`); } },
    klawIndestructible(P, e, t, src) { if (onBf(src.uid)) src.tkw.push('indestructible'); },
    async klawExile(P, e, t, src) {
        const D = G.defender != null ? G.players[G.defender] : opp(P);
        const c = D.library.pop(); if (!c) return;
        c.realOwner = D.i; c.owner = P.i; c.playUntil = 1e9; c.playAny = true; c.anyMana = true; P.exile.push(c);
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top card of ${D.name === 'You' ? 'your' : `${D.name}'s`} library face down; it can be played.`); exiledOwn(P);
    },
    async ladyLoki(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const item = sp && G.stack.find(it => it.o === sp && it.kind === 'spell'); if (!item) return;
        pull(G.stack, item); P.exile.push(sp); sp.card = sp.front || sp.card;
        log(`${sp.card.name} is exiled.`);
        const seen = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); P.exile.push(c); if (!/\bLand\b/.test(c.card.type)) { hit = c; break; } seen.push(c); }
        if (!hit) return;
        const d = Math.abs((sp.card.cmc || 0) - (hit.card.cmc || 0));
        foes(P).forEach(F => damage(F, d, src)); log(`${src.card.name} deals ${d} damage to each opponent.`);
        if (Rx(hit).support !== 'none' && (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${hit.card.name} without paying its mana cost?`, { card: hit.card }))) await castFreeAuto(P, hit);
    },
    async convokersConnive(P, e, t, src) {
        for (const c of (src.convokers || []).filter(x => onBf(x.uid))) await applyChoiceEffect(P, { t: 'connive', target: 'creature' }, src, { o: c });
    },
    async livingLaser(P, e, t, src) {
        const n = P.discardTurn === G.turn ? P.discardN || 0 : 0;
        for (let k = 0; k < n; k++) { const tok = tokenCopyOf(P, { ...src.card, type: src.card.type.replace(/\bLegendary /, '') }); tok.tapped = true; tok.exileAtEnd = G.turn; if (!G.attackers.includes(tok.uid)) G.attackers.push(tok.uid); }
        if (n) log(`${n} tapped and attacking token cop${n === 1 ? 'y' : 'ies'} of ${src.card.name}.`);
    },
    async lokiScepter(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        await applyEffect(P, { t: 'steal' }, { o: x }, src);
        x.card = { ...x.card, type: typeWithV(x.card.type, 'Villain') }; x.copyOf = x.copyOf || x.card; x.copyTurn = G.turn;
        x.tapped = false; x.sick = false; log(`${x.card.name} is a Villain until end of turn.`);
    },
    async lokiDeceiver(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const card = { ...x.card, type: typeWithV(x.card.type.replace(/\bLegendary /, ''), 'Illusion') };
        const tok = tokenCopyOf(P, card); tok.tapped = true; tok.sacAtEnd = G.turn; if (!G.attackers.includes(tok.uid)) G.attackers.push(tok.uid);
    },
    async miracle0(P, e, t, src) {
        const c = G.ctxObj; if (!c || !P.hand.includes(c) || Rx(c).support === 'none') return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${c.card.name} for {0} (miracle)?`, { card: c.card }))) return;
        await castFreeAuto(P, c);
    },
    progenitorFlash(P, e, t, src) { P.flashNext = { turn: G.turn, type: src.chosenType }; log(`The next ${src.chosenType || 'chosen type'} spell ${you(P) ? 'you cast' : P.name + ' casts'} this turn can be cast as though it had flash.`); },
    async puppetGoad(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; goad(x, P.i, nextTurnOf(P)); x.tkw.push('cantblock'); log(`${x.card.name} is goaded and can't block this turn.`); },
    async stiltMan(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const until = nextTurnOf(P);
        const real = x.realOwner ?? x.owner; giveControl(x, P); x.cantBeSacrificed = until;
        (G.endAt = G.endAt || []).push({ turn: until, fn: () => { const y = onBf(x.uid); if (y && y.owner !== real) { giveControl(y, G.players[real]); y.sick = false; } x.cantBeSacrificed = 0; } });
    },
    async superiorFoes(P, e, t, src) {
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: exile the top card of your library to play?`, { card: src.card }))) return;
        const c = P.library.pop(); if (!c) return;
        (src.foesExiled || []).forEach(x => { if (P.exile.includes(x)) x.playUntil = -1; });
        c.playUntil = 1e9; c.playAny = true; P.exile.push(c); src.foesExiled = [c];
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${c.card.name}; ${you(P) ? 'you' : 'they'} may play it.`); exiledOwn(P);
    },
    frightfulFour(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const Q = G.ctxRaw && G.ctxRaw.P; if (!sp || !Q) return; const n = sp.card.cmc || 0; Q.life -= n; Q.lostTurn = G.turn; fire('loseLife', { P: Q, n }); log(`${Q.name} loses ${n} life.`); },
    async titanLittjara(P, e, t, src) {
        const types = (src.card.type.split(' — ')[1] || '').split(' ').filter(Boolean);
        const n = P.bf.filter(x => x !== src && isCreature(x) && (x.card.type.split(' — ')[1] || '').split(' ').some(w => types.includes(w))).length;
        if (!n || !P.library.length) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: draw ${n} card${n === 1 ? '' : 's'} (then discard a card)?`, { card: src.card }))) return;
        drawCards(P, n);
        const d = await pickOwn(P, P.hand, `${src.card.name}: discard a card`, { rank: (a, b) => aiKeepValue(P, a) - aiKeepValue(P, b) });
        if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`); }
    },
    titaniaMelee(P, e, t, src) {
        G.attackers.map(u => onBf(u)).filter(a => a && a.owner === P.i && a !== src && !/\bMelee\b/.test(a.card.text || '')).forEach(a => { a.tp += 1; a.tq += 1; });
        log('Other attacking creatures get +1/+1 (melee).');
    },
    async triSentinel(P, e, t, src) {
        for (const F of oppsOf(P)) {
            const pool = F.bf.filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
            const pick = await pickOwn(P, pool, `${src.card.name}: deal 3 damage to up to one creature ${F.name} controls`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
            if (pick) { damage(pick, 3, src); log(`${src.card.name} deals 3 damage to ${pick.card.name}.`); }
        }
    },
    async typhoidMary(P, e, t, src) {
        const labels = ['Mary — Create a Treasure token.', `${src.card.name.split(',')[0]} — Draw a card.`, 'Bloody Mary — Each opponent loses 2 life and you gain 2 life.'];
        let m;
        if (P.discardTurn === G.turn && P.discardN > 0) m = P.isAI || AUTOPLAY ? 1 : await askMode(P, `${src.card.name}: choose one`, labels); else m = rand(3);
        if (m === 0) { makeArtifactToken(P, 'treasure'); tokenMade(P); log(`${P.name} ${you(P) ? 'create' : 'creates'} a Treasure token.`); }
        else if (m === 1) drawCards(P, 1);
        else { foes(P).forEach(F => { F.life -= 2; F.lostTurn = G.turn; fire('loseLife', { P: F, n: 2 }); }); gainLifeFor(P, 2); log('Each opponent loses 2 life and you gain 2 life.'); }
    }
});
function typeWithV(type, sub) { const [l, r] = type.split(' — '); const subs = r ? r.split(' ') : []; if (!subs.includes(sub)) subs.push(sub); return `${l} — ${subs.join(' ')}`; }
Object.assign(CMD, { async conniveTarget(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) await applyChoiceEffect(P, { t: 'connive', target: 'creature' }, src, { o: x }); } });

// ===== The Fantastic Four =====
TRIG_FN.targetedByOpp = (o, ctx) => ctx.o === o && ctx.by !== undefined && ctx.by !== o.owner;
TRIG_FN.oppFirstSpell = (o, ctx) => ctx.P.i !== o.owner && ctx.P.castN === 1;
TRIG_FN.torchHit = (o, ctx) => !!ctx.src && ctx.src === o && o.torchTurn === G.turn && G.players.length > 2;
TRIG_FN.fourthNoncreature = (o, ctx) => ctx.P.i === o.owner && ctx.P.nonCreatureN === 4;
COUNT_EXTRA.push([/^the greatest mana value among noncreature permanents you control and noncreature cards in your graveyard$/, () => o => { const X = G.players[o.owner]; return Math.max(0, ...X.bf.filter(x => !isCreature(x) && x !== o).map(x => x.card.cmc || 0), ...X.gy.filter(x => !/\bCreature\b/.test(x.card.type)).map(x => x.card.cmc || 0)); }]);
async function payColorsOpt(P, src, text) {
    const cost = parseCost(text);
    if (!planPayment(P, cost)) return false;
    if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: pay ${text}?`, { card: src.card }))) return false;
    planPayment(P, cost).forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${text}.`); return true;
}
Object.assign(CMD, {
    aliciaReturn(P) { allPerms().filter(x => x.realOwner !== undefined && isCreature(x)).forEach(x => { const real = x.realOwner; if (G.players[real]) giveControl(x, G.players[real]); }); },
    async clever(P, e, t, src) {
        let pool = P.bf.filter(x => !/\bLand\b/.test(x.card.type) && !x.phasedOut); if (P.isAI || AUTOPLAY) return;
        for (;;) { if (!pool.length) break; const pick = await pickCard(P, pool, `${src.card.name}: phase out a nonland permanent you control (or stop)`, { optional: true }); if (!pick) break; phaseOut(pick); pool = pool.filter(x => x !== pick); }
    },
    crystalBurn(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const n = sp ? (sp.card.colors || []).length : 0; if (n) { foes(P).forEach(F => damage(F, n, src)); log(`${src.card.name} deals ${n} damage to each opponent.`); } },
    firstFamily(P, e, t, src) {
        const cols = new Set(); P.bf.forEach(x => (x.card.colors || []).forEach(c => cols.add(c)));
        if (P.castColorsTurn === G.turn) P.castColors.forEach(c => cols.add(c));
        const n = cols.size; drawCards(P, n); gainLifeFor(P, n);
    },
    flameOn(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const n = P.gy.filter(c => !/\bCreature\b|\bLand\b/.test(c.card.type)).length; if (n) putCounters(x, n, P); x.tkw.push('flying'); log(`${x.card.name} gets ${n} +1/+1 counters and flying until end of turn.`); },
    nextSpellCopy(P, e) { P.nextCastCopies = { turn: G.turn, n: e.n || 1 }; log('When you next cast an instant or sorcery spell this turn, it will be copied.'); },
    async genesisUltimatum(P, e, t, src) {
        const seen = P.library.splice(Math.max(0, P.library.length - 5)).reverse();
        const perms = seen.filter(x => !['instant', 'sorcery'].includes(Rx(x).kind));
        let chosen;
        if (P.isAI || AUTOPLAY) chosen = perms; else { chosen = []; let pool = perms.slice(); for (;;) { if (!pool.length) break; const pick = await pickCard(P, pool, `${src.card.name}: put a permanent card onto the battlefield (or stop)`, { optional: true }); if (!pick) break; chosen.push(pick); pool = pool.filter(x => x !== pick); } }
        chosen.forEach(x => { pull(seen, x); putOntoBattlefield(P, x); });
        seen.forEach(x => P.hand.push(x));
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${chosen.length} permanent${chosen.length === 1 ? '' : 's'} onto the battlefield and ${seen.length} card${seen.length === 1 ? '' : 's'} into ${you(P) ? 'your' : 'their'} hand.`);
        src.exileAfter = true;
    },
    async destroyArtAndEnch(P, e, t, src) {
        const kill = x => { if (x && onBf(x.uid) && !has(x, 'indestructible')) { log(`${x.card.name} is destroyed.`); dieOrLeave(x, 'gy'); } };
        kill(t && t.o);
        const pool = allPerms().filter(x => /Enchantment/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
        const pick = await pickOwn(P, pool, `${src.card.name}: destroy target enchantment`, { optional: true, rank: (a, b) => ((b.owner !== P.i) - (a.owner !== P.i)) || (permValue(b) - permValue(a)) });
        kill(pick);
    },
    async humanTorch(P, e, t, src) { if (await payColorsOpt(P, src, '{R}{G}{W}{U}')) { src.torchTurn = G.turn; log(`${src.card.name}'s combat damage is also dealt to each other opponent this turn.`); } },
    torchSplash(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; const D = G.defender != null ? G.players[G.defender] : null; foes(P).filter(F => F !== D).forEach(F => damage(F, n, src)); },
    async forceField(P, e, t, src) {
        let pool = P.bf.slice(); const chosen = [];
        if (P.isAI || AUTOPLAY) { chosen.push(...pool.sort((a, b) => permValue(b) - permValue(a)).slice(0, 4)); }
        else for (let k = 0; k < 4 && pool.length; k++) { const pick = await pickCard(P, pool, `${src.card.name}: choose a permanent (${k + 1} of up to 4)`, { optional: true }); if (!pick) break; chosen.push(pick); pool = pool.filter(x => x !== pick); }
        chosen.forEach(x => x.tkw.push('indestructible')); if (chosen.length) log(`${chosen.map(x => x.card.name).join(', ')} gain indestructible until end of turn.`);
    },
    async invisibleWoman(P, e, t, src) {
        if (!(await payColorsOpt(P, src, '{R}{G}{W}{U}'))) return;
        const pool = P.bf.filter(isCreature);
        const pick = await pickOwn(P, pool, `${src.card.name}: target creature gets +1/+0 for each creature you control and can't be blocked`, { rank: (a, b) => pow(b) - pow(a) });
        if (!pick) return; const n = pool.length; pick.tp += n; pick.tkw.push('unblockable'); log(`${pick.card.name} gets +${n}/+0 and can't be blocked this turn.`);
    },
    async lockjaw(P, e, t, src) {
        if (onBf(src.uid)) putCounters(src, 1, P);
        const mine = P.bf.filter(x => isCreature(x) && x !== src);
        const other = await pickOwn(P, mine, `${src.card.name}: up to one other creature can't be blocked`, { optional: true, rank: (a, b) => pow(b) - pow(a) });
        [src, other].filter(Boolean).forEach(x => x.tkw.push('unblockable')); log(`${[src, other].filter(Boolean).map(x => x.card.name).join(' and ')} can't be blocked this turn.`);
    },
    async mindsDilation(P, e, t, src) {
        const Q = G.ctxRaw && G.ctxRaw.P; if (!Q) return;
        const c = Q.library.pop(); if (!c) return;
        Q.exile.push(c); log(`${Q.name} ${you(Q) ? 'exile' : 'exiles'} ${c.card.name}.`);
        if (!/\bLand\b/.test(c.card.type) && Rx(c).support !== 'none' && (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }))) { pull(Q.exile, c); P.exile.push(c); c.realOwner = Q.i; c.owner = P.i; await castFreeAuto(P, c); }
    },
    async copyTrigger(P, e, t, src) {
        const it = t && t.item; if (!it || !G.stack.includes(it)) return;
        for (let k = 0; k < 2; k++) { G.stack.push({ ...it, id: stackSeq++, name: `Copy of ${it.name}`, copy: true }); log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${it.name}.`); }
    },
    namorBoost(P, e, t, src) {
        const D = G.defender != null ? G.players[G.defender] : opp(P);
        if (!(D && D.life > P.life)) return;
        G.attackers.map(u => onBf(u)).filter(a => a && a !== src && a.owner === P.i).forEach(a => { a.tp += 2; }); log('Other attacking creatures get +2/+0 until end of turn.');
    },
    async portalExile(P, e, t, src) {
        const pool = foes(P).flatMap(F => F.gy.map(c => ({ c, F })));
        if (!pool.length) return;
        let pick;
        if (P.isAI || AUTOPLAY) pick = pool.sort((a, b) => ((/\bCreature\b/.test(b.c.card.type) ? 1 : 0) - (/\bCreature\b/.test(a.c.card.type) ? 1 : 0)))[0];
        else { const c = await pickCard(P, pool.map(p => p.c), `${src.card.name}: exile a card from an opponent's graveyard`, { required: true }); pick = pool.find(p => p.c === c) || pool[0]; }
        pull(pick.F.gy, pick.c); pick.F.exile.push(pick.c); src.exiledWith = [...(src.exiledWith || []), pick.c];
        log(`${pick.c.card.name} is exiled with ${src.card.name}.`);
        if (/\bCreature\b/.test(pick.c.card.type)) drawCards(P, 1);
    },
    portalFlip(P, e, t, src) {
        const list = (src.exiledWith || []).filter(c => /\bCreature\b/.test(c.card.type) && G.players.some(X => X.exile.includes(c)));
        if (list.length < 4) return;
        if (flipCoin(P)) { log(`${P.name} ${you(P) ? 'win' : 'wins'} the flip.`); return; }
        log(`${P.name} ${you(P) ? 'lose' : 'loses'} the flip: ${src.card.name} is sacrificed.`);
        dieOrLeave(src, 'gy');
        const all = (src.exiledWith || []).filter(c => G.players.some(X => X.exile.includes(c))); const c = all[rand(all.length)];
        if (c) { const X = G.players.find(y => y.exile.includes(c)); pull(X.exile, c); G.players[c.realOwner ?? c.owner].hand.push(c); log(`${c.card.name} returns to its owner's hand.`); }
    },
    novaFlame(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        putCounters(x, e.n, P); const d = Math.max(0, pow(x));
        allPerms().filter(c => isCreature(c) && c !== x).forEach(c => damage(c, d, x)); log(`${x.card.name} deals ${d} damage to each other creature.`);
    },
    powerPack(P, e, t, src) {
        const pool = P.gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind)); if (!pool.length) return;
        const c = pool[rand(pool.length)]; pull(P.gy, c); P.exile.push(c); exiledOwn(P); src.packCard = c;
        (G.delayed = G.delayed || []).push({ at: 'upkeep', own: true, P, after: G.turn, effects: [{ t: 'cmd', id: 'powerPackCast' }], src, label: `${src.card.name}: cast ${c.card.name}?` });
        log(`${c.card.name} is exiled at random.`);
    },
    async powerPackCast(P, e, t, src) {
        const c = src.packCard; if (!c || !P.exile.includes(c)) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }))) return;
        c.exileAfter = true; await castFreeAuto(P, c);
    },
    async quantumCopy(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; tokenCopyOf(P, { ...x.card, type: x.card.type.replace(/\bLegendary /, '') }); },
    recurringInsight(P, e, t) { const X = t && t.p ? t.p : foes(P)[0]; if (X) drawCards(P, X.hand.length); },
    seizeTheDay(P, e, t) { const x = t && t.o; if (x && onBf(x.uid)) x.tapped = false; G.extraCombat = (G.extraCombat || 0) + 1; log('There will be an additional combat phase after this main phase.'); },
    surferMark(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const D = G.defender != null ? G.players[G.defender] : opp(P);
        x.forceAtkUntil = nextTurnOf(P); x.forceAtkAt = D.i; log(`${x.card.name} attacks ${D.name} each combat if able until the end of ${you(P) ? 'your' : 'their'} next turn.`);
    },
    taunt(P) { foes(P).flatMap(F => F.bf).filter(isCreature).forEach(x => { goad(x, P.i, nextTurnOf(P)); x.cantBlockUntil = nextTurnOf(P); }); log('Goaded: opposing creatures attack and can\'t block until your next turn.'); },
    async fantasticarAnimate(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: become an artifact creature until end of turn?`, { card: src.card }))) return;
        src.animated = { turn: G.turn, p: Number(src.card.power) || 4, q: Number(src.card.toughness) || 4, kw: [] }; src.sick = false; log(`${src.card.name} becomes a 4/4 artifact creature until end of turn.`);
    },
    async fantasticarConstructs(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: sacrifice it to create four 4/4 Constructs?`, { card: src.card }))) return;
        fire('sacrificed', { o: src }); dieOrLeave(src, 'gy');
        const before = P.bf.length; await applyEffect(P, { t: 'token', n: 4, p: 4, q: 4, name: 'colorless Construct', artifact: true, kw: ['flying'], tkw: ['haste'] }, null, src);
        P.bf.slice(before).forEach(x => { x.sick = false; });
    },
    async theThing(P, e, t, src) {
        if (!(await payColorsOpt(P, src, '{R}{G}{W}{U}'))) return;
        let pool = P.bf.filter(x => x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0)); const chosen = [];
        if (P.isAI || AUTOPLAY) chosen.push(...pool); else for (;;) { if (!pool.length) break; const pick = await pickCard(P, pool, `${src.card.name}: double the counters on a permanent (or stop)`, { optional: true }); if (!pick) break; chosen.push(pick); pool = pool.filter(x => x !== pick); }
        chosen.forEach(x => { if (x.counters > 0) putCounters(x, x.counters, P); Object.keys(x.ctr || {}).forEach(k => { if (k !== 'loyalty' && x.ctr[k] > 0) x.ctr[k] *= 2; }); });
        if (chosen.length) log(`The counters on ${chosen.map(x => x.card.name).join(', ')} are doubled.`);
    },
    ultimateNullification(P, e, t, src) {
        allPerms().filter(isCreature).forEach(c => { log(`${c.card.name} is exiled.`); leaveBattlefield(c, 'exile'); });
        G.players.forEach(X => { X.exile.push(...X.gy.splice(0)); });
        log('All graveyards are exiled.'); src.bottomIfGy = true;
    }
});
Object.assign(CMD, {
    counterEachOfPlayer(P, e, t) { const X = t && t.p ? t.p : P; X.bf.filter(isCreature).forEach(c => putCounters(c, 1, P)); log(`Each creature ${X.name} controls gets a +1/+1 counter.`); },
    async willieMail(P, e, t, src) {
        const D = G.defender != null ? G.players[G.defender] : opp(P);
        drawCards(P, 1);
        const yes = D.isAI || AUTOPLAY ? D.hand.length < 4 : await askYes(D, `${src.card.name}: draw a card? (You can't attack ${P.name} or their permanents during your next turn.)`, { card: src.card });
        if (!yes) return;
        drawCards(D, 1); D.noAttackVs = { against: P.i, until: nextTurnOf(D) }; log(`${D.name} can't attack ${P.name} or their permanents during their next turn.`);
    }
});

// ===== Wakanda Forever =====
TRIG_FN.jewelUnblocked = (o, ctx) => { const a = ctx.o; return !!a && a.owner !== o.owner && gAttackDefender(a.owner) === o.owner; };
TRIG_FN.artifactEnters = (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bArtifact\b/.test(ctx.o.card.type);
TRIG_FN.attacksMonarch = (o, ctx) => { const a = (ctx.list || [])[0]; if (!a) return false; const d = gAttackDefender(a.owner); return d != null && d !== o.owner && G.monarch === d; };
TRIG_FN.okoyeAttack = (o, ctx) => (ctx.list || []).some(x => x.okoyeMark === G.turn && G.monarch != null && gAttackDefender(x.owner) === G.monarch);
TRIG_FN.flierAttacksMe = (o, ctx) => (ctx.list || []).some(x => x.owner !== o.owner && has(x, 'flying') && gAttackDefender(x.owner) === o.owner);
TRIG_FN.artifactMv4 = (o, ctx) => !!ctx.o && ctx.P.i === o.owner && (ctx.o.card.cmc || 0) >= 4;
TRIG_FN.hostAttacksMonarch = (o, ctx) => { const h = onBf(o.attachedTo); return !!h && (ctx.list || []).includes(h) && G.monarch != null && gAttackDefender(h.owner) === G.monarch && G.monarch !== h.owner; };
Object.assign(CMD, {
    async copySelfIfCommander(P, e, t, src) {
        if (![...P.command, ...P.bf].some(x => x.isCommander && x.owner === P.i && P.bf.includes(x))) return;
        const item = G.stack.find(it => it.o === src && it.kind === 'spell'); if (!item) return;
        await copySpellItem(P, item, { retarget: true });
    },
    bastBoost(P, e, t) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const n = P.bf.filter(isCreature).length; x.tp += n; x.tq += n; log(`${x.card.name} gets +${n}/+${n} until end of turn.`); },
    async coveted(P, e, t, src) {
        const a = G.ctxObj; const A = a ? G.players[a.owner] : null; if (!A || !onBf(src.uid)) return;
        drawCards(A, 3); giveControl(src, A); src.tapped = false; log(`${A.name} draws three cards and gains control of ${src.card.name}.`);
    },
    legendIndestructible(P) { P.bf.filter(x => /Legendary/.test(x.card.type)).forEach(x => x.tkw.push('indestructible')); log('Legendary permanents you control gain indestructible until end of turn.'); },
    async fightThrone(P, e, t, src) {
        const mine = t && t.o; if (!mine || !onBf(mine.uid)) return;
        putCounters(mine, 1, P);
        const pool = foes(P).flatMap(F => F.bf).filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
        const them = await pickOwn(P, pool, `${src.card.name}: ${mine.card.name} fights a creature an opponent controls`, { rank: (a, b) => (pow(mine) >= tou(b) ? 1 : 0) * creatureValue(b) - (pow(mine) >= tou(a) ? 1 : 0) * creatureValue(a) });
        if (!them) return;
        log(`${mine.card.name} fights ${them.card.name}.`);
        damage(them, Math.max(0, pow(mine)), mine); damage(mine, Math.max(0, pow(them)), them);
        them.throneMark = { turn: G.turn, by: P.i };
        sba();
        if (!onBf(them.uid) && [...P.command, ...P.bf].some(x => x.isCommander && x.owner === P.i && P.bf.includes(x))) { G.monarch = P.i; log(`${P.name} ${you(P) ? 'become' : 'becomes'} the monarch.`); }
    },
    hatutCopies(P, e, t, src) { const n = commanderCasts(P); for (let k = 0; k < n; k++) tokenCopyOf(P, src.card); if (n) log(`${n} cop${n === 1 ? 'y' : 'ies'} of ${src.card.name}.`); },
    async heartShapedHerb(P, e, t, src) {
        const pool = P.bf.filter(isCreature);
        const pick = await pickOwn(P, pool, `${src.card.name}: sacrifice a creature to return it with three +1/+1 counters (or none)`, { optional: true, rank: (a, b) => creatureValue(a) - creatureValue(b) });
        if (!pick || pick.token) { if (pick) { fire('sacrificed', { o: pick }); dieOrLeave(pick, 'gy'); } return; }
        const home = G.players[pick.realOwner ?? pick.owner];
        fire('sacrificed', { o: pick }); dieOrLeave(pick, 'gy');
        if (home.gy.includes(pick)) { reanimateFrom(home, home, pick); putCounters(pick, 3, P); G.monarch = P.i; log(`${P.name} ${you(P) ? 'become' : 'becomes'} the monarch.`); }
    },
    helmOfHost(P, e, t, src) { const h = onBf(src.attachedTo); if (!h || !isCreature(h)) return; const tok = tokenCopyOf(P, { ...h.card, type: h.card.type.replace(/\bLegendary /, '') }); tok.tkw.push('haste'); tok.sick = false; },
    async kimoyoBeads(P, e, t, src) {
        src.beads = src.beads || [];
        const MODES = ['AV Bead — Draw a card.', 'Communication Bead — Create two 1/1 white Soldier creature tokens.', 'Prime Bead — You gain 3 life. Exile this artifact, then return it to the battlefield.'];
        const left = [0, 1, 2].filter(i => !src.beads.includes(i)); if (!left.length) return;
        const i = P.isAI || AUTOPLAY ? left[0] : left[await askMode(P, `${src.card.name}: choose one that hasn't been chosen`, left.map(k => MODES[k]))];
        src.beads.push(i);
        if (i === 0) drawCards(P, 1);
        else if (i === 1) await applyEffect(P, TOKEN(2, 1, 1, 'white Soldier'), null, src);
        else { gainLifeFor(P, 3); const home = G.players[src.owner]; leaveBattlefield(src, 'exile'); pull(home.exile, src); src.beads = []; putOntoBattlefield(home, src); }
    },
    async solomonFrogs(P, e, t, src) {
        if (!src.wasCast) return;
        for (const F of oppsOf(P)) {
            const pool = F.bf.filter(x => (x.card.cmc || 0) >= 3 && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
            const pick = await pickOwn(P, pool, `${src.card.name}: exile up to one permanent ${F.name} controls with mana value 3 or greater`, { optional: true, rank: (a, b) => permValue(b) - permValue(a) });
            if (pick) { log(`${pick.card.name} is exiled.`); leaveBattlefield(pick, 'exile'); drawCards(F, 1); }
        }
    },
    mbakuMonarch(P, e, t, src) { const F = oppsOf(P)[0]; if (F) { G.monarch = F.i; log(`${F.name} ${you(F) ? 'become' : 'becomes'} the monarch.`); } },
    mbakuBoost(P) { const list = (G.ctxRaw && G.ctxRaw.list) || []; list.forEach(a => { if (onBf(a.uid)) { a.tp += 1; a.tq += 1; a.tkw.push('trample'); } }); log('Attackers get +1/+1 and trample until end of turn (the monarch is attacked).'); },
    async nyamiShip(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        const perm = !['instant', 'sorcery'].includes(Rx(c).kind);
        if (perm && (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: put ${c.card.name} onto the battlefield? (Otherwise it goes to your hand.)`, { card: c.card, yes: 'Battlefield', no: 'Hand' }))) { P.library.pop(); putOntoBattlefield(P, c); }
        else { P.library.pop(); P.hand.push(c); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    okoyeMark(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; putCounters(x, 1, P); x.okoyeMark = G.turn; },
    okoyeBoost(P) { (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.okoyeMark === G.turn && onBf(x.uid)).forEach(x => { x.tkw.push('double strike', 'trample'); log(`${x.card.name} gains double strike and trample until end of turn.`); }); },
    async palaceJailer(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        log(`${x.card.name} is exiled until an opponent becomes the monarch.`);
        const home = x.realOwner ?? x.owner; leaveBattlefield(x, 'exile'); if (!x.token) x.jailedBy = src.owner; x.realOwner = home;
    },
    talonSoldiers: async function (P, e, t, src) { const n = Math.max(0, src.counters); if (n) await applyEffect(P, TOKEN(n, 1, 1, 'white Soldier'), null, src); },
    scourglass(P) { allPerms().filter(x => !/Artifact|\bLand\b/.test(x.card.type)).forEach(x => { if (!has(x, 'indestructible')) dieOrLeave(x, 'gy'); }); log('All permanents except artifacts and lands are destroyed.'); },
    stormBoost(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const n = Math.max(0, pow(src)); x.tkw.push('flying'); x.tp += n; log(`${x.card.name} gains flying and gets +${n}/+0 until end of turn.`); },
    stormSnipe(P, e, t, src) { const list = (G.ctxRaw && G.ctxRaw.list) || []; list.filter(x => x.owner !== P.i && has(x, 'flying') && onBf(x.uid)).forEach(x => { damage(x, Math.max(0, pow(src)), src); log(`${src.card.name} deals ${Math.max(0, pow(src))} damage to ${x.card.name}.`); }); },
    zuriCounters(P) { P.bf.filter(isCreature).forEach(c => putCounters(c, 1, P)); },
    monarchIfNone(P) { if (G.monarch == null) { G.monarch = P.i; log(`${P.name} ${you(P) ? 'become' : 'becomes'} the monarch.`); } },
    async wakandaForever(P, e, t, src) {
        const seen = P.library.splice(Math.max(0, P.library.length - 6)).reverse();
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${seen.map(c => c.card.name).join(', ')}.`);
        const perms = () => seen.filter(c => !['instant', 'sorcery'].includes(Rx(c).kind));
        const bf = await pickOwn(P, perms(), `${src.card.name}: put a permanent onto the battlefield with an indestructible counter (or none)`, { optional: true });
        if (bf) { pull(seen, bf); putOntoBattlefield(P, bf); bf.ctr.indestructible = 1; }
        const hand = await pickOwn(P, perms(), `${src.card.name}: put a permanent card into your hand (or none)`, { optional: true });
        if (hand) { pull(seen, hand); P.hand.push(hand); }
        seen.forEach(c => P.gy.push(c));
        log(`The rest are put into the graveyard.`);
    }
});
