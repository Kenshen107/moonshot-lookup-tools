// Engine pieces for the 300-commanders round (2026-10-26). Wordings are in rules/cmdr300.js; each odd card is a CMD entry.

const sacPerm = (P, f) => { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); };
const hitList = () => (G.ctxRaw && G.ctxRaw.hit) || [];
const rawSrc = () => (G.ctxRaw && G.ctxRaw.src) || null;
// A card from a player's library into exile that `P` may play (or cast) until `until`
function exilePlayFrom(P, H, c, until) { c.realOwner = H.i; c.owner = P.i; c.playUntil = until; P.exile.push(c); log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name} from ${H.name === 'You' ? 'your' : H.name + "'s"} library; ${you(P) ? 'you' : 'they'} may ${/\bLand\b/.test(c.card.type) ? 'play' : 'cast'} it ${until === G.turn ? 'this turn' : 'for as long as it remains exiled'}.`); }
const permTypes = o => ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker'].filter(w => w === 'Creature' ? isCreature(o) : new RegExp(`\\b${w}\\b`).test(o.card.type));

Object.assign(TRIG_FN, {
    kutzil: (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && pow(x) > (Number(x.card.power) || 0)),
    selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    anyAttackMine: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner) && G.extraCombatOn !== true,
    nonGnomeAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && !hasType(x, 'Gnome')),
    cmdrHitsOpp: (o, ctx) => !!ctx.src && ctx.src.isCommander && ctx.src.owner === o.owner && (ctx.hit || []).some(H => H.i !== o.owner) && G.players.filter(X => X.i !== o.owner && !X.out).length > 1,
    mySacrifice: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    edric: (o, ctx) => !!ctx.src && (ctx.hit || []).some(H => H.i !== o.owner) && ctx.src.owner !== undefined,
    deathtouchHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && has(ctx.src, 'deathtouch'),
    modifiedAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && allPerms().some(a => a.attachedTo === x.uid)),
});
COND_EXTRA.push(
    [/^it is the first combat phase of the turn$/, () => P => !G.extraCombatOn],
    [/^an opponent is the monarch$/, () => P => G.monarch !== null && G.monarch !== undefined && G.monarch !== P.i]
);
Object.assign(CMD_AITARGET, {
    kaervek: (P, e, src, valid, c) => { const mv = (G.ctxRaw && G.ctxRaw.o && G.ctxRaw.o.card.cmc) || 0; const kill = c.byValue(c.theirs.filter(v => isCreature(v.o) && tou(v.o) - v.o.dmg <= mv))[0]; if (kill && c.O.life > mv) return kill; return { p: c.O }; },
});
Object.assign(CMD_SCORE, { ragavan: () => 6, braids: P => (P.bf.length > 3 ? 4 : 0), urza5: () => 6, extraCombatUntap: () => 6, karlach: () => 6, heliodCounter: () => 3, animPakal: () => 6, vilis: () => 4, kediss: () => 4, koma: () => 9, elenda: () => 4, mahadi: () => 3, atarka: () => 3, miirym: () => 7, trostani: () => 2, dwynen: () => 2, edric: () => 2, teval: () => 3, kaervek: () => 5, thrakkus: () => 4, fynn: () => 3, reyav: () => 3, arabella: () => 4, indestructCounter: () => 2 });
Object.assign(CMD, {
    // Ragavan: a Treasure, and the top card of the player's library may be cast this turn
    async ragavan(P, e, t, src) {
        makeArtifactToken(P, 'treasure'); log(`${P.name} ${you(P) ? 'create' : 'creates'} a Treasure token.`);
        for (const H of hitList()) { const c = H.library.pop(); if (c) exilePlayFrom(P, H, c, G.turn); }
    },
    // Braids, Arisen Nightmare
    async braids(P, e, t, src) {
        const pool = P.bf.filter(x => permTypes(x).length);
        if (!pool.length) return;
        const pay = (P.isAI || AUTOPLAY) ? pool.filter(x => x.token || permValue(x) <= 3).sort((a, b) => permValue(a) - permValue(b))[0] : await pickOwn(P, pool, `${src.card.name}: sacrifice an artifact, creature, enchantment, land, or planeswalker?`, { optional: true });
        if (!pay) return;
        const types = permTypes(pay); sacPerm(P, pay);
        for (const F of foes(P)) {
            const share = F.bf.filter(x => permTypes(x).some(w => types.includes(w)));
            let sacked = false;
            if (share.length) {
                const cheap = share.slice().sort((a, b) => permValue(a) - permValue(b))[0];
                const ok = (F.isAI || AUTOPLAY) ? permValue(cheap) <= 3 : await askYes(F, `${src.card.name}: sacrifice a permanent that shares a card type with ${pay.card.name}? (Otherwise you lose 2 life and ${P.name} draws a card.)`, { card: src.card });
                if (ok) { const c = (F.isAI || AUTOPLAY) ? cheap : await chooseFrom(F, share, `${src.card.name}: sacrifice a permanent`, false); if (c) { sacPerm(F, c); sacked = true; } }
            }
            if (!sacked) { F.life -= 2; log(`${F.name} ${you(F) ? 'lose' : 'loses'} 2 life and ${P.name} ${you(P) ? 'draw' : 'draws'} a card.`); fire('loseLife', { P: F, n: 2 }); drawCards(P, 1); }
        }
    },
    indestructCounter(P, e, t, src) { if (!onBf(src.uid)) return; src.ctr.indestructible = (src.ctr.indestructible || 0) + 1; log(`${src.card.name} gets an indestructible counter.`); },
    // Urza, Lord High Artificer
    urza5(P, e, t, src) {
        shuffle(P.library);
        const c = P.library.pop(); if (!c) return;
        c.freeCast = true; c.playUntil = G.turn; P.exile.push(c);
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${c.card.name}; ${you(P) ? 'you' : 'they'} may play it this turn without paying its mana cost.`);
    },
    extraCombatUntap(P, e, t, src) {
        const ut = P.bf.filter(x => isCreature(x) && x.tapped && x !== src); ut.forEach(x => { x.tapped = false; });
        G.extraCombat = (G.extraCombat || 0) + 1;
        log(`${P.name} untap${you(P) ? '' : 's'} ${ut.length} creature${ut.length === 1 ? '' : 's'}; there will be an additional combat phase after this one.`);
    },
    karlach(P, e, t, src) {
        const atk = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i);
        atk.forEach(x => { x.tapped = false; x.tkw.push('first strike'); });
        G.extraCombat = (G.extraCombat || 0) + 1;
        log(`${P.name} untap${you(P) ? '' : 's'} the attacking creatures; they gain first strike, and there will be an additional combat phase after this one.`);
    },
    async heliodCounter(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) || /Enchantment/.test(x.card.type));
        const x = await pickOwn(P, pool, `${src.card.name}: put a +1/+1 counter on a creature or enchantment you control`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (x) { const got = putCounters(x, 1, P); log(`${x.card.name} gets ${got} +1/+1 counter.`); }
    },
    animPakal(P, e, t, src) {
        if (!onBf(src.uid)) return;
        putCounters(src, 1, P);
        const n = Math.max(0, src.counters || 0);
        log(`${src.card.name} gets a +1/+1 counter.`);
        if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'colorless Gnome', kw: [], artifact: true, tapped: true, attacking: true }, null, src);
    },
    nezahal(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const owner = G.players[src.owner];
        leaveBattlefield(src, 'exile');
        atEndStep(() => { const x = owner.exile.find(y => y.uid === src.uid); if (x) { pull(owner.exile, x); putOntoBattlefield(owner, x, true); } }, `${src.card.name} returns to the battlefield tapped.`);
        log(`${src.card.name} is exiled.`);
    },
    vilis(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || G.ctxCount || 0; if (n > 0) drawCards(P, n); },
    kediss(P, e, t, src) {
        const raw = G.ctxRaw || {}; const n = raw.n || 0, hit = raw.hit || [];
        if (!n) return;
        foes(P).filter(F => !hit.includes(F)).forEach(F => { F.life -= n; log(`${src.card.name} deals ${n} damage to ${F.name}.`); fire('playerDamaged', { P: F, n }); fire('loseLife', { P: F, n }); });
    },
    koma(P, e, t, src) { applyEffect(P, { t: 'token', n: 4, p: 3, q: 3, name: 'blue Serpent', kw: [], named: "Koma's Coil" }, null, src); },
    elenda(P, e, t, src) { const x = Math.max(0, (G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.pow : pow(src))); if (x > 0) applyEffect(P, { t: 'token', n: x, p: 1, q: 1, name: 'white Vampire', kw: ['lifelink'] }, null, src); },
    mahadi(P, e, t, src) { const n = G.diedN && G.diedN.turn === G.turn ? G.diedN.n : 0; if (n > 0) applyEffect(P, { t: 'artToken', kind: 'treasure', n }, null, src); },
    atarka(P, e, t, src) { (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.owner === P.i && hasType(x, 'Dragon')).forEach(x => { x.tkw.push('double strike'); log(`${x.card.name} gains double strike until end of turn.`); }); },
    miirym(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return;
        const c = { ...x.card, type: x.card.type.replace(/\bLegendary\s+/, '') };
        tokenCopyOf(P, c);
    },
    trostani(P, e, t, src) { const x = G.ctxObj; if (!x) return; const n = Math.max(0, tou(x)); if (n > 0) gainLifeFor(P, n); },
    dwynen(P, e, t, src) { const n = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && hasType(x, 'Elf')).length; if (n > 0) gainLifeFor(P, n); },
    edric(P, e, t, src) {
        const s = rawSrc(); if (!s) return;
        const C = G.players[s.owner]; if (!C || C.out) return;
        const ok = (C.isAI || AUTOPLAY) ? true : askYes(C, `${src.card.name}: draw a card?`, { card: src.card });
        Promise.resolve(ok).then(y => { if (y) drawCards(C, 1); });
    },
    async teval(P, e, t, src) {
        const lands = P.gy.filter(x => /\bLand\b/.test(x.card.type)); if (!lands.length) return;
        const x = await pickOwn(P, lands, `${src.card.name}: return a land card from your graveyard to the battlefield tapped?`, { optional: true });
        if (x) { pull(P.gy, x); putOntoBattlefield(P, x, true); log(`${x.card.name} returns to the battlefield tapped.`); fire('landfall', { o: x }); }
    },
    kaervek(P, e, t, src) {
        const mv = (G.ctxRaw && G.ctxRaw.o && G.ctxRaw.o.card.cmc) || 0; if (!mv || !t) return;
        if (t.p) { t.p.life -= mv; log(`${src.card.name} deals ${mv} damage to ${t.p.name}.`); fire('playerDamaged', { P: t.p, n: mv }); fire('loseLife', { P: t.p, n: mv }); }
        else if (t.o && onBf(t.o.uid)) { damage(t.o, mv, src); log(`${src.card.name} deals ${mv} damage to ${t.o.card.name}.`); }
    },
    thrakkus(P, e, t, src) { P.bf.filter(x => isCreature(x) && hasType(x, 'Dragon')).forEach(x => { const n = pow(x); if (n > 0) { x.tp += n; log(`${x.card.name} gets +${n}/+0 until end of turn.`); } }); },
    fynn(P, e, t, src) { (hitList()).forEach(H => { H.poison += 2; log(`${H.name} ${you(H) ? 'get' : 'gets'} two poison counters.`); }); },
    reyav(P, e, t, src) { (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.owner === P.i && allPerms().some(a => a.attachedTo === x.uid)).forEach(x => { x.tkw.push('double strike'); log(`${x.card.name} gains double strike until end of turn.`); }); },
    arabella(P, e, t, src) {
        const n = P.bf.filter(x => isCreature(x) && pow(x) <= 2).length; if (!n) return;
        foes(P).forEach(F => { F.life -= n; fire('playerDamaged', { P: F, n }); fire('loseLife', { P: F, n }); });
        log(`${src.card.name} deals ${n} damage to each opponent.`); gainLifeFor(P, n);
    },
});

// ===== Batch 2 =====
function spellTaxFor(P, o) {
    let tax = 0;
    for (const x of allPerms()) {
        const st = Rx(x).spellTax; if (!st || lostAbilities(x)) continue;
        if (st.who === 'opp' && x.owner === P.i) continue;
        if (st.what === 'noncreature' && Rx(o).kind === 'creature') continue;
        if (st.what === 'targetsMyCommander' && !(o._tgt && o._tgt.o && o._tgt.o.isCommander && o._tgt.o.owner === x.owner)) continue;
        tax += st.n;
    }
    return tax;
}
Object.assign(TRIG_FN, {
    nivDamage: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && ctx.P.i !== o.owner && !G.inCombatDamage,
    oppFirstLoss: (o, ctx) => { if (ctx.P.i === o.owner || G.active !== ctx.P.i) return false; o.fl = o.fl || {}; if (o.fl[ctx.P.i] === G.turn) return false; o.fl[ctx.P.i] = G.turn; return true; },
    castNotFromHand: (o, ctx) => ctx.P.i === o.owner && ctx.o.castFromHand !== G.turn,
    zurgoLeaves: (o, ctx) => { const x = ctx.o; if (!x || !x.token || x.owner !== o.owner || !/\bCreature\b/.test(x.card.type)) return false; x._wasAtk = (G.attackers || []).includes(x.uid); return true; },
    ownedCreatureDies: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.card && !ctx.o.token && (ctx.o.realOwner !== undefined ? ctx.o.realOwner : ctx.o.owner) === o.owner,
    milledCreature: (o, ctx) => (ctx.cards || []).some(c => /\bCreature\b/.test(c.card.type)),
});
COND_EXTRA.push([/^you(?:'ve| have) cast two or more noncreature spells this turn$/, () => P => P.nonCreatureNTurn === G.turn && P.nonCreatureN >= 2]);
Object.assign(CMD_SCORE, { liesa: () => 3, aerithDies: () => 4, kwain: () => 1, drawCtx: () => 3, bruna: () => 8, alandra: () => 4, thrasios: () => 3, cascadeCast: () => 8, betor: () => 3, zurgo: () => 2, athreos: () => 4, carmen: () => 5, heliodRadiant: () => 4, doubleCountersMany: () => 4, mogis: () => 3 });
Object.assign(CMD_AITARGET, {
    athreos: (P, e, src, valid, c) => ({ p: c.O }),
    mogis: () => null,
});
Object.assign(CMD, {
    liesa(P, e, t, src) {
        const c = G.ctxRaw && G.ctxRaw.o; if (!c) return;
        atEndStep(() => { const own = G.players[c.owner]; if (own && own.gy.includes(c)) { pull(own.gy, c); own.hand.push(c); log(`${c.card.name} returns to its owner's hand (${src.card.name}).`); } });
    },
    aerithDies(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.counters : 0; if (!(x > 0)) return;
        P.bf.filter(y => isCreature(y) && /\bLegendary\b/.test(y.card.type)).forEach(y => { putCounters(y, x, P); log(`${y.card.name} gets ${x} +1/+1 counter${x === 1 ? '' : 's'}.`); });
    },
    async kwain(P, e, t, src) {
        const drew = [];
        for (const X of G.players.filter(q => !q.out)) {
            const yes = (X.isAI || AUTOPLAY) ? true : await askYes(X, `${src.card.name}: draw a card? (You gain 1 life if you do.)`, { card: src.card });
            if (yes) { drawCards(X, 1); drew.push(X); }
        }
        drew.forEach(X => gainLifeFor(X, 1));
    },
    drawCtx(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || G.ctxCount || 0; if (n > 0) drawCards(P, n); },
    async bruna(P, e, t, src) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type) && (hasType(x, 'Angel') || hasType(x, 'Human')));
        if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: return an Angel or Human creature card from your graveyard to the battlefield?`, { optional: true });
        if (x) { pull(P.gy, x); putOntoBattlefield(P, x); log(`${x.card.name} returns to the battlefield.`); }
    },
    alandra(P, e, t, src) {
        const x = P.hand.length; if (x <= 0) return;
        P.bf.filter(y => isCreature(y) && (y === src || hasType(y, 'Drake'))).forEach(y => { y.tp += x; y.tq += x; });
        log(`${src.card.name} and the Drakes get +${x}/+${x} until end of turn.`);
    },
    async thrasios(P, e, t, src) {
        log(`${P.name} scry${you(P) ? '' : 's'} 1.`);
        const top = P.library[P.library.length - 1]; if (!top) return;
        log(`${P.name} reveal${you(P) ? '' : 's'} ${top.card.name}.`);
        if (/\bLand\b/.test(top.card.type)) { P.library.pop(); putOntoBattlefield(P, top, true); fire('landfall', { o: top }); log(`${top.card.name} enters the battlefield tapped.`); }
        else drawCards(P, 1);
    },
    async cascadeCast(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; if (sp) await cascade(P, sp); },
    async betor(P, e, t, src) {
        const tt = () => P.bf.filter(isCreature).reduce((a, x) => a + Math.max(0, tou(x)), 0);
        if (tt() >= 10) drawCards(P, 1); else return;
        if (tt() >= 20) { P.bf.filter(isCreature).forEach(x => { x.tapped = false; }); log(`${P.name} untap${you(P) ? '' : 's'} each creature.`); } else return;
        if (tt() >= 40) foes(P).forEach(F => { const n = Math.ceil(F.life / 2); F.life -= n; log(`${F.name} lose${you(F) ? '' : 's'} ${n} life.`); fire('loseLife', { P: F, n }); });
    },
    zurgo(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x) return;
        if (x._wasAtk) drawCards(P, 1); else foes(P).forEach(F => { F.life -= 1; log(`${F.name} lose${you(F) ? '' : 's'} 1 life.`); fire('loseLife', { P: F, n: 1 }); });
    },
    async athreos(P, e, t, src) {
        const c = G.ctxRaw && G.ctxRaw.o; const Q = t && t.p; if (!c || !Q) return;
        const own = G.players[c.realOwner !== undefined ? c.realOwner : c.owner];
        const pays = (Q.isAI || AUTOPLAY) ? Q.life > 12 : await askYes(Q, `${src.card.name}: pay 3 life so ${c.card.name} stays in the graveyard?`, { card: src.card });
        if (pays && Q.life >= 3) { Q.life -= 3; log(`${Q.name} pay${you(Q) ? '' : 's'} 3 life.`); fire('loseLife', { P: Q, n: 3 }); return; }
        if (own.gy.includes(c)) { pull(own.gy, c); own.hand.push(c); log(`${c.card.name} returns to ${you(own) ? 'your' : own.name + "'s"} hand.`); }
    },
    async carmen(P, e, t, src) {
        const mv = Math.max(0, pow(src));
        const pool = P.gy.filter(x => (x.card.cmc || 0) <= mv && !/Instant|Sorcery/.test(x.card.type));
        if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: return a permanent card with mana value ${mv} or less to the battlefield?`, { optional: true });
        if (x) { pull(P.gy, x); putOntoBattlefield(P, x); log(`${x.card.name} returns to the battlefield.`); }
    },
    async heliodRadiant(P, e, t, src) {
        const pool = P.gy.filter(x => /\bEnchantment\b/.test(x.card.type) && !/\bGod\b/.test(x.card.type));
        if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: return an enchantment card to your hand`, { optional: true });
        if (x) { pull(P.gy, x); P.hand.push(x); log(`${x.card.name} returns to ${you(P) ? 'your' : P.name + "'s"} hand.`); }
    },
    async doubleCountersMany(P, e, t, src) {
        const pool = P.bf.filter(x => e.kinds === 'any' ? (isCreature(x) || /Artifact|\bLand\b/.test(x.card.type)) : (isCreature(x) || /Artifact/.test(x.card.type))).filter(x => x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0));
        const picked = [];
        for (let k = 0; k < (e.n || 1) && pool.length; k++) {
            const left = pool.filter(x => !picked.includes(x));
            if (!left.length) break;
            const x = await pickOwn(P, left, `${src.card.name}: double the counters on a permanent`, { optional: k > 0, rank: (a, b) => (b.counters + Object.values(b.ctr || {}).reduce((s, v) => s + v, 0)) - (a.counters + Object.values(a.ctr || {}).reduce((s, v) => s + v, 0)) });
            if (!x) break; picked.push(x);
        }
        picked.forEach(x => { if (x.counters > 0) putCounters(x, x.counters, P); Object.keys(x.ctr || {}).forEach(k => { if (x.ctr[k] > 0) x.ctr[k] *= 2; }); log(`The counters on ${x.card.name} are doubled.`); });
    },
    async mogis(P, e, t, src) {
        const Q = G.players[G.active]; if (!Q || Q.i === P.i || Q.out) return;
        const crs = Q.bf.filter(isCreature);
        let sac = false;
        if (crs.length) {
            const cheap = crs.slice().sort((a, b) => permValue(a) - permValue(b))[0];
            const ok = (Q.isAI || AUTOPLAY) ? (permValue(cheap) <= 2 || Q.life <= 4 && false) : await askYes(Q, `${src.card.name}: sacrifice a creature? (Otherwise it deals 2 damage to you.)`, { card: src.card });
            if (ok) { const c = (Q.isAI || AUTOPLAY) ? cheap : await chooseFrom(Q, crs, `${src.card.name}: sacrifice a creature`, false); if (c) { sacPerm(Q, c); sac = true; } }
        }
        if (!sac) { damage(Q, 2, src); log(`${src.card.name} deals 2 damage to ${Q.name}.`); }
    },
});

// ===== Batch 3 =====
const yarokBoost = o => (o.card && !o.token ? 0 : 0) + (G.players[o.owner].bf.filter(a => Rx(a).doubleEnter && !lostAbilities(a)).length);
const lostThisTurn = X => (X.lostTurn === G.turn ? X.lostN || 0 : 0);
Object.assign(TRIG_FN, {
    myMilledCreature: (o, ctx) => ctx.P.i === o.owner && (ctx.cards || []).some(c => /\bCreature\b/.test(c.card.type)),
    myCreatureDiesAtk: (o, ctx) => { const x = ctx.o; if (!x || x === o || x.owner !== o.owner) return false; x._wasAtk = (G.attackers || []).includes(x.uid); return true; },
    castEnchantFromHand: (o, ctx) => ctx.P.i === o.owner && /\bEnchantment\b/.test(ctx.o.card.type) && ctx.o.castFromHand === G.turn,
    myCreatureHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner,
    nontokenVampireAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && !x.token && hasType(x, 'Vampire')),
    oppLost3: (o, ctx) => foes(G.players[o.owner]).some(F => lostThisTurn(F) >= 3),
    selfHitsOpp: (o, ctx) => ctx.src === o && pow(o) >= 7 && (ctx.hit || []).some(H => H.i !== o.owner),
    counterOnMine: (o, ctx) => ctx.P.i === o.owner && !!ctx.o && isCreature(ctx.o),
    anyLand: (o, ctx) => !!ctx.o,
    myMain2: (o, ctx) => G.active === o.owner,
    gainedLifeTurn: (o, ctx) => G.players[o.owner].gainedTurn === G.turn && (G.players[o.owner].gainedAmt || 0) > 0,
    adventureOrDragon: (o, ctx) => ctx.P.i === o.owner && !!ctx.o && (hasType(ctx.o, 'Dragon') || /\bAdventure\b/.test(ctx.o.card.type) || !!(Rx(ctx.o).adventure)),
    myIllusionDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Illusion'),
    myTokenMade: (o, ctx) => ctx.P.i === o.owner,
    humanEnteredTurn: (o, ctx) => G.active === o.owner && (G.entered || []).some(e => e.turn === G.turn && e.owner === o.owner && e.creature && e.o !== o && hasType(e.o, 'Human')),
    dealtToMe: (o, ctx) => ctx.P.i === o.owner && ctx.n > 0,
    myNontokenDies: (o, ctx) => { const x = ctx.o; if (!x || x.token || x.owner !== o.owner) return false; const lki = x.ctr || {}; return (x.counters > 0 || Object.values(lki).some(v => v > 0)); },
    discardedThisTurn: (o, ctx) => G.discardedTurn === G.turn,
});
COND_EXTRA.push([/^you have seven or more cards in your graveyard$/, () => P => P.gy.length >= 7]);
Object.assign(CMD_SCORE, { drawSacPow: () => 3, treebeard: () => 4, untapSelf: () => 1, atraxaGU: () => 8, kioraScion: () => 9, severina: () => 4, garna: () => 2, cadira: () => 5, papalymo: () => 4, muxus: () => 7, vincent: () => 3, beza: () => 6, aragorn: () => 4, shalaiHallar: () => 3, zoZu: () => 2, tymna: () => 3, moseo: () => 5, lozhan: () => 4, minn: () => 4, urzaKroog: () => 3, purphoros: () => 5, belladonna: () => 2, eowynShield: () => 6, dragonlordAtarka: () => 9, darien: () => 4, theoden: () => 3, hajar: () => 1, felisa: () => 4, braidsCabal: () => 2, eomer: () => 7, mai: () => 1, seizan: () => 2, jazal: () => 6, ikra: () => 2 });
Object.assign(CMD_AITARGET, {
    aragorn: (P, e, src, valid, c) => c.byValue(c.theirs.filter(v => isCreature(v.o)))[0] || null,
    shalaiHallar: (P, e, src, valid, c) => ({ p: c.O }),
    lozhan: (P, e, src, valid, c) => { const mv = (G.ctxRaw && G.ctxRaw.o && G.ctxRaw.o.card.cmc) || 0; const ok = valid.filter(v => !(v.o && v.o.isCommander)); const kill = c.byValue(ok.filter(v => v.o && v.o.owner !== P.i && isCreature(v.o) && tou(v.o) - v.o.dmg <= mv))[0]; return kill || ok.find(v => v.p && v.p !== P) || null; },
    eomer: (P, e, src, valid, c) => { const n = Math.max(0, pow(src)); const kill = c.byValue(c.theirs.filter(v => isCreature(v.o) && tou(v.o) - v.o.dmg <= n))[0]; return kill || { p: c.O }; },
});
const permCardsOfTypes = (X, re) => X.bf.filter(o => re.test(o.card.type));
Object.assign(CMD, {
    drawSacPow(P, e, t, src) { const n = G.lastSacPow || 0; if (n > 0) drawCards(P, n); },
    async treebeard(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || G.ctxCount || 0; if (!(n > 0)) return;
        const pool = P.bf.filter(x => isCreature(x) && (hasType(x, 'Halfling') || hasType(x, 'Treefolk')));
        const x = await pickOwn(P, pool, `${src.card.name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on a Halfling or Treefolk`, {});
        if (x) { const got = putCounters(x, n, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); }
    },
    untapSelf(P, e, t, src) { if (onBf(src.uid)) { src.tapped = false; log(`${src.card.name} untaps.`); } },
    async atraxaGU(P, e, t, src) {
        const top = []; for (let i = 0; i < 10 && P.library.length; i++) top.push(P.library.pop());
        log(`${P.name} reveal${you(P) ? '' : 's'} ${top.length} cards: ${top.map(c => c.card.name).join(', ')}.`);
        const types = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery'];
        const taken = [];
        for (const ty of types) {
            const cands = top.filter(c => !taken.includes(c) && new RegExp(`\\b${ty}\\b`).test(c.card.type));
            if (!cands.length) continue;
            const c = (P.isAI || AUTOPLAY) ? cands.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickOwn(P, cands, `${src.card.name}: put a ${ty} card into your hand?`, { optional: true });
            if (c) { taken.push(c); P.hand.push(c); log(`${c.card.name} goes to ${you(P) ? 'your' : P.name + "'s"} hand.`); }
        }
        const rest = shuffle(top.filter(c => !taken.includes(c))); P.library.unshift(...rest);
    },
    kioraScion(P, e, t, src) {
        if (P.bf.some(x => x.token && x.card.name === 'Scion of the Deep')) return;
        applyEffect(P, { t: 'token', n: 1, p: 8, q: 8, name: 'blue Octopus', kw: [], named: 'Scion of the Deep' }, null, src);
    },
    severina(P, e, t, src) { const x = (G.attackers || []).map(onBf).filter(y => y && y !== src && y.owner === P.i).length; if (x <= 0) return; foes(P).forEach(F => { F.life -= x; log(`${F.name} lose${you(F) ? '' : 's'} ${x} life.`); fire('loseLife', { P: F, n: x }); }); },
    garna(P, e, t, src) { const x = G.ctxRaw && G.ctxRaw.o; if (!x) return; if (x._wasAtk) drawCards(P, 1); else foes(P).forEach(F => { damage(F, 1, src); }); },
    cadira(P, e, t, src) { const n = P.bf.filter(x => x.token).length; if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'white Rabbit', kw: [] }, null, src); },
    async papalymo(P, e, t, src) {
        for (const F of foes(P)) { if (lostThisTurn(F) <= 0) continue; const crs = F.bf.filter(isCreature); if (!crs.length) continue; const mx = Math.max(...crs.map(x => pow(x))); const pool = crs.filter(x => pow(x) === mx); const c = await chooseFrom(F, pool, `${src.card.name}: sacrifice a creature with the greatest power`, false); if (c) sacPerm(F, c); }
    },
    muxus(P, e, t, src) {
        const top = []; for (let i = 0; i < 6 && P.library.length; i++) top.push(P.library.pop());
        const gobs = top.filter(c => /\bCreature\b/.test(c.card.type) && hasType(c, 'Goblin') && (c.card.cmc || 0) <= 5);
        log(`${P.name} reveal${you(P) ? '' : 's'} ${top.map(c => c.card.name).join(', ')}.`);
        gobs.forEach(c => { putOntoBattlefield(P, c); });
        P.library.unshift(...shuffle(top.filter(c => !gobs.includes(c))));
    },
    vincent(P, e, t, src) { const raw = G.ctxRaw || {}; const n = raw.n || 0; if (!n || pow(src) < 7) return; foes(P).filter(F => !(raw.hit || []).includes(F)).forEach(F => { damage(F, n, src); }); },
    beza(P, e, t, src) {
        const lands = X => X.bf.filter(o => /\bLand\b/.test(o.card.type)).length, crs = X => X.bf.filter(isCreature).length, os = foes(P);
        if (os.some(F => lands(F) > lands(P))) makeArtifactToken(P, 'treasure');
        if (os.some(F => F.life > P.life)) gainLifeFor(P, 4);
        if (os.some(F => crs(F) > crs(P))) applyEffect(P, { t: 'token', n: 2, p: 1, q: 1, name: 'blue Fish', kw: [] }, null, src);
        if (os.some(F => F.hand.length > P.hand.length)) drawCards(P, 1);
    },
    aragorn(P, e, t, src) {
        if (G.monarch === P.i) { allPerms().filter(isCreature).forEach(x => { x.cantBlockUntil = G.turn; }); log('Creatures can\'t block this turn (the monarch).'); return; }
        if (t && t.o && onBf(t.o.uid)) { t.o.cantBlockUntil = G.turn; log(`${t.o.card.name} can't block this turn.`); }
    },
    shalaiHallar(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || G.ctxCount || 0; if (n > 0 && t && t.p) damage(t.p, n, src); },
    zoZu(P, e, t, src) { const x = G.ctxRaw && G.ctxRaw.o; if (!x) return; const Q = G.players[x.owner]; if (Q && !Q.out) damage(Q, 2, src); },
    async tymna(P, e, t, src) {
        const X = foes(P).filter(F => F.combatHitTurn === G.turn).length; if (X <= 0 || P.life <= X) return;
        const ok = (P.isAI || AUTOPLAY) ? P.life > X * 5 : await askYes(P, `${src.card.name}: pay ${X} life to draw ${X} card${X === 1 ? '' : 's'}?`, { card: src.card });
        if (ok) { P.life -= X; log(`${P.name} pay${you(P) ? '' : 's'} ${X} life.`); fire('loseLife', { P, n: X }); drawCards(P, X); }
    },
    async moseo(P, e, t, src) {
        const X = P.gainedTurn === G.turn ? (P.gainedAmt || 0) : 0; if (X <= 0) return;
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= X); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${X} or less to the battlefield`, { optional: true });
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c); log(`${c.card.name} returns to the battlefield.`); }
    },
    lozhan(P, e, t, src) {
        const mv = (G.ctxRaw && G.ctxRaw.o && G.ctxRaw.o.card.cmc) || 0; if (!mv || !t) return;
        if (t.o && t.o.isCommander) return;
        if (t.p) damage(t.p, mv, src); else if (t.o && onBf(t.o.uid)) damage(t.o, mv, src);
    },
    async minn(P, e, t, src) {
        const dead = G.ctxRaw && G.ctxRaw.o; const pw = G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.pow : 0; if (!dead) return;
        const pool = P.hand.filter(c => !/Instant|Sorcery/.test(c.card.type) && (c.card.cmc || 0) <= pw); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: put a permanent card with mana value ${pw} or less from your hand onto the battlefield?`, { optional: true });
        if (c) { pull(P.hand, c); putOntoBattlefield(P, c); log(`${c.card.name} enters the battlefield.`); }
    },
    async urzaKroog(P, e, t, src) {
        const arts = P.bf.filter(x => /\bArtifact\b/.test(x.card.type)); if (!arts.length) return;
        const x = (t && t.o && onBf(t.o.uid)) ? t.o : await pickOwn(P, arts, `${src.card.name}: copy which artifact?`, {});
        if (!x) return;
        const c = { ...x.card, type: typeWith(x.card.type, 'Soldier', true), power: '1', toughness: '1' };
        tokenCopyOf(P, c, { p: 1, q: 1 });
    },
    async purphoros(P, e, t, src) {
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type) && ((c.card.colors || []).includes('R') || /\bArtifact\b/.test(c.card.type)));
        if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: put a red or artifact creature card from your hand onto the battlefield? (Sacrifice it at end of turn.)`, { optional: true });
        if (!c) return;
        pull(P.hand, c); putOntoBattlefield(P, c);
        atEndStep(() => { if (onBf(c.uid)) sacPerm(P, c); }, `${c.card.name} is sacrificed.`);
    },
    belladonna(P, e, t, src) {
        src.tokN = src.tokTurn === G.turn ? src.tokN + 1 : 1; src.tokTurn = G.turn;
        if (src.tokN === 1) gainLifeFor(P, 1);
        else if (src.tokN === 2) drawCards(P, 1);
        else if (src.tokN === 3) P.bf.filter(isCreature).forEach(x => putCounters(x, 1, P));
    },
    eowynShield(P, e, t, src) {
        applyEffect(P, { t: 'token', n: 2, p: 2, q: 2, name: 'red Human Knight', kw: ['trample', 'haste'] }, null, src);
        if (P.bf.filter(x => isCreature(x) && hasType(x, 'Human')).length >= 6) drawCards(P, 1);
    },
    async dragonlordAtarka(P, e, t, src) {
        let left = 5;
        const targets = () => foes(P).flatMap(F => F.bf).filter(x => isCreature(x) || /Planeswalker/.test(x.card.type));
        if (P.isAI || AUTOPLAY) {
            const dead = new Set();
            while (left > 0) {
                const ts = targets().filter(x => onBf(x.uid) && !dead.has(x)); if (!ts.length) break;
                const kill = ts.filter(x => tou(x) - x.dmg <= left).sort((a, b) => creatureValue(b) - creatureValue(a))[0] || ts.sort((a, b) => creatureValue(b) - creatureValue(a))[0];
                const d = Math.min(left, Math.max(1, tou(kill) - kill.dmg)); damage(kill, d, src); left -= d; if (d >= tou(kill) - kill.dmg + d) dead.add(kill); dead.add(kill); log(`${src.card.name} deals ${d} damage to ${kill.card.name}.`);
            }
            return;
        }
        while (left > 0) {
            const ts = targets().filter(x => onBf(x.uid)); if (!ts.length) break;
            const c = await pickCard(P, ts, `${src.card.name}: choose a creature or planeswalker for damage (${left} left)`, { optional: true }); if (!c) break;
            const d = await askNumber(P, `${src.card.name}: damage to ${c.card.name} (${left} left)`, 1, left, Math.min(left, Math.max(1, tou(c) - c.dmg)), { card: src.card }); if (!d) break;
            damage(c, d, src); left -= d; log(`${src.card.name} deals ${d} damage to ${c.card.name}.`);
        }
    },
    async darien(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || G.ctxCount || 0; if (n <= 0) return;
        const ok = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: create ${n} 1/1 Soldier token${n === 1 ? '' : 's'}?`, { card: src.card });
        if (ok) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'white Soldier', kw: [] }, null, src);
    },
    async theoden(P, e, t, src) {
        const pool = P.bf.filter(isCreature); const x = await pickOwn(P, pool, `${src.card.name}: target creature gains double strike`, { rank: (a, b) => pow(b) - pow(a) });
        if (x) { x.tkw.push('double strike'); log(`${x.card.name} gains double strike until end of turn.`); }
    },
    hajar(P, e, t, src) { P.bf.filter(x => isCreature(x) && /\bLegendary\b/.test(x.card.type)).forEach(x => { x.tp += 1; x.tkw.push('indestructible'); }); log('Legendary creatures get +1/+0 and indestructible until end of turn.'); },
    felisa(P, e, t, src) {
        const l = G.ctxRaw && G.ctxRaw.lki; if (!l) return;
        const n = Math.max(0, l.counters || 0) + Object.values(l.ctr || {}).reduce((a, v) => a + (v > 0 ? v : 0), 0);
        if (n > 0) applyEffect(P, { t: 'token', n, p: 2, q: 1, name: 'white black Inkling', kw: ['flying'], tapped: true }, null, src);
    },
    async braidsCabal(P, e, t, src) {
        const Q = G.players[G.active]; if (!Q || Q.out) return;
        const pool = Q.bf.filter(o => isCreature(o) || /\bArtifact\b/.test(o.card.type) || /\bLand\b/.test(o.card.type));
        const c = await chooseFrom(Q, pool, `${src.card.name}: sacrifice an artifact, creature, or land`, false); if (c) sacPerm(Q, c);
    },
    seizan(P, e, t, src) { const Q = G.players[G.active]; if (!Q || Q.out) return; Q.life -= 2; log(`${Q.name} lose${you(Q) ? '' : 's'} 2 life and draw${you(Q) ? '' : 's'} two cards.`); fire('loseLife', { P: Q, n: 2 }); drawCards(Q, 2); },
    jazal(P, e, t, src) { const at = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i); const x = at.length; if (x <= 0) return; at.forEach(y => { y.tp += x; y.tq += x; }); log(`Attacking creatures you control get +${x}/+${x} until end of turn.`); },
    ikra(P, e, t, src) { const s = rawSrc(); if (s) { const n = Math.max(0, tou(s)); if (n > 0) gainLifeFor(P, n); } },
    async eomer(P, e, t, src) {
        let who = P;
        if (!(P.isAI || AUTOPLAY) && G.players.filter(x => !x.out).length > 1) { const others = G.players.filter(x => !x.out); const i = await askMode(P, `${src.card.name}: which player becomes the monarch?`, others.map(x => x.name)); who = others[i] || P; }
        G.monarch = who.i; log(`${who.name} ${you(who) ? 'become' : 'becomes'} the monarch.`);
        const n = Math.max(0, pow(src)); if (n > 0 && t) { if (t.p) damage(t.p, n, src); else if (t.o && onBf(t.o.uid)) damage(t.o, n, src); }
    },
    mai(P, e, t, src) { const Q = G.ctxRaw && G.ctxRaw.P; if (!Q || Q.out) return; Q.life -= 2; log(`${Q.name} lose${you(Q) ? '' : 's'} 2 life.`); fire('loseLife', { P: Q, n: 2 }); },
});
// Thalia, Heretic Cathar: creatures and nonbasic lands your opponents control enter tapped
const oppEnterTappedHook = o => { if (!o || !o.card) return; const isC = isCreature(o), isNL = /\bLand\b/.test(o.card.type) && !/\bBasic\b/.test(o.card.type); if (!isC && !isNL) return; if (G.players.some(X => X.i !== o.owner && X.bf.some(a => Rx(a).oppEnterTapped && !lostAbilities(a)))) o.tapped = true; };
