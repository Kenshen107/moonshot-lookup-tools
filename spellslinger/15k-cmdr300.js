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
        applyEffect(P, { t: 'token', n: 1, p: 8, q: 8, name: 'blue Octopus', kw: [], named: 'Scion of the Deep', legendary: true }, null, src);
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

// ===== Batch 4 =====
async function discardChosen(P, why) { if (!P.hand.length) return null; noteDiscard(P, 1); const d = await chooseDiscard(P, why); pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`); return d; }
const OUTLAWS = ['Assassin', 'Mercenary', 'Pirate', 'Rogue', 'Warlock'];
async function mayPay(P, costStr, prompt, src, aiYes = true) {
    const cost = parseCost(costStr), plan = planPayment(P, cost);
    if (!plan) return false;
    const yes = (P.isAI || AUTOPLAY) ? aiYes : await askYes(P, prompt, { card: src.card });
    if (!yes) return false;
    planPayment(P, cost).forEach(y => tapSource(P, y));
    return true;
}
async function divideDamageAmong(P, src, total) {
    let left = total;
    const targets = () => foes(P).flatMap(F => F.bf).filter(x => isCreature(x) || /Planeswalker/.test(x.card.type));
    if (P.isAI || AUTOPLAY) {
        const dead = new Set();
        while (left > 0) {
            const ts = targets().filter(x => onBf(x.uid) && !dead.has(x)); if (!ts.length) break;
            const kill = ts.filter(x => tou(x) - x.dmg <= left).sort((a, b) => creatureValue(b) - creatureValue(a))[0] || ts.sort((a, b) => creatureValue(b) - creatureValue(a))[0];
            const d = Math.min(left, Math.max(1, tou(kill) - kill.dmg)); damage(kill, d, src); left -= d; dead.add(kill); log(`${src.card.name} deals ${d} damage to ${kill.card.name}.`);
        }
        return;
    }
    while (left > 0) {
        const ts = targets().filter(x => onBf(x.uid)); if (!ts.length) break;
        const c = await pickCard(P, ts, `${src.card.name}: choose a creature or planeswalker for damage (${left} left)`, { optional: true }); if (!c) break;
        const d = await askNumber(P, `${src.card.name}: damage to ${c.card.name} (${left} left)`, 1, left, Math.min(left, Math.max(1, tou(c) - c.dmg)), { card: src.card }); if (!d) break;
        damage(c, d, src); left -= d; log(`${src.card.name} deals ${d} damage to ${c.card.name}.`);
    }
}
Object.assign(TRIG_FN, {
    outlawHit: (o, ctx) => { if (!ctx.src || ctx.src.owner !== o.owner || !OUTLAWS.some(w => hasType(ctx.src, w))) return false; if (o.lastStep === ctx.step) return false; o.lastStep = ctx.step; return true; },
    pirateHit: (o, ctx) => { if (!ctx.src || ctx.src.owner !== o.owner || !hasType(ctx.src, 'Pirate')) return false; if (o.lastStepP === ctx.step) return false; o.lastStepP = ctx.step; return true; },
    saprolingHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Saproling'),
    historicHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && isCreature(ctx.src) && /\b(Artifact|Legendary|Saga)\b/.test(ctx.src.card.type),
    discardIslandPirateVehicle: (o, ctx) => ctx.P.i === o.owner && !!ctx.o && ctx.o.card && (/\bIsland\b/.test(ctx.o.card.type) || /\bPirate\b/.test(ctx.o.card.type) || /\bVehicle\b/.test(ctx.o.card.type)),
    anySecondDraw: (o, ctx) => ctx.n === 2,
    creatureEnteredLastTurn: (o, ctx) => (G.players[o.owner].crEnt || []).some(e => e.turn === G.turn - 1 && e.uid !== o.uid) && (G.ctxPlayerIsMine !== false),
    myLandfall: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    selfCounteredThisTurn: (o, ctx) => o.counterTurn === G.turn,
});
Object.assign(CMD_SCORE, { stellaLee: () => 4, klothys: () => 5, auron: () => 8, anowon: () => 4, ureniDmg: () => 8, looter: () => 2, phylath: () => 6, beregond: () => 4, vialSmasher: () => 4, eshki: () => 4, braidsConjurer: () => 5, szeras: () => 2, tappedTreasure: () => 2, geralf: () => 5, ramirez: () => 5, silumgar: () => 4, brinelin: () => 6, shelinda: () => 3, zegana: () => 3, ayli: () => 1, shroofus: () => 5, ambrosia: () => 2, hopeEstheim: () => 3, abuelo: () => 3, meloku: () => 4, flubs: () => 1, tori: () => 4, voja: () => 6, alesha: () => 6, rakdosShowstopper: () => 4, jirina: () => 1, leinore: () => 4, sidisiRegent: () => 5, tersa: () => 4, michiko: () => 3, thadaAdel: () => 4, monstrosityLake: () => 7, copyMaker: () => 7, wakka: () => 4 });
Object.assign(CMD, {
    stellaLee(P, e, t, src) { const c = P.library.pop(); if (c) exilePlayFrom(P, P, c, nextTurnOf(P)); },
    async klothys(P, e, t, src) {
        const all = G.players.flatMap(X => X.gy.map(c => ({ c, X }))); if (!all.length) return;
        let pick;
        if (P.isAI || AUTOPLAY) { const nl = all.filter(a => !/\bLand\b/.test(a.c.card.type)); pick = (nl.filter(a => a.X !== P).concat(nl)).concat(all)[0]; }
        else { const c = await pickCard(P, all.map(a => a.c), `${src.card.name}: exile target card from a graveyard`, { required: true }); pick = all.find(a => a.c === c) || all[0]; }
        pull(pick.X.gy, pick.c); pick.X.exile.push(pick.c); log(`${pick.c.card.name} is exiled from ${pick.X.name === 'You' ? 'your' : pick.X.name + "'s"} graveyard.`);
        if (/\bLand\b/.test(pick.c.card.type)) { const col = (P.isAI || AUTOPLAY) ? (P.hand.some(h => (h.card.colors || []).includes('G')) ? 'G' : 'R') : ['R', 'G'][await askMode(P, `${src.card.name}: add {R} or {G}`, ['{R}', '{G}'])]; P.pool = (P.pool || []).concat([col]); log(`${P.name} add${you(P) ? '' : 's'} {${col}}.`); }
        else { gainLifeFor(P, 2); foes(P).forEach(F => damage(F, 2, src)); }
    },
    async auron(P, e, t, src) {
        if (!onBf(src.uid)) return; putCounters(src, 1, P); log(`${src.card.name} gets a +1/+1 counter.`);
        const D = G.defender !== undefined && G.defender !== null && G.players[G.defender] ? G.players[G.defender] : opp(P);
        const pool = D.bf.filter(x => isCreature(x) && pow(x) < pow(src)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: exile target creature with power less than ${pow(src)}`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (x) { x.exiledBy = src.uid; leaveBattlefield(x, 'exile'); log(`${x.card.name} is exiled until ${src.card.name} leaves the battlefield.`); }
    },
    async anowon(P, e, t, src) {
        for (const X of G.players.filter(q => !q.out)) { const pool = X.bf.filter(x => isCreature(x) && !hasType(x, 'Vampire')); if (!pool.length) continue; const c = await chooseFrom(X, pool, `${src.card.name}: sacrifice a non-Vampire creature`, false); if (c) sacPerm(X, c); }
    },
    async ureniDmg(P, e, t, src) { const n = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length; if (n > 0) await divideDamageAmong(P, src, n); },
    async looter(P, e, t, src) {
        if (!P.hand.length) return;
        const ok = (P.isAI || AUTOPLAY) ? P.hand.some(c => aiKeepValue(P, c) < 3) : await askYes(P, `${src.card.name}: discard a card to draw a card?`, { card: src.card });
        if (!ok) return;
        if (await discardChosen(P, src.card.name)) drawCards(P, 1);
    },
    phylath(P, e, t, src) { const n = P.bf.filter(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type)).length; if (n > 0) applyEffect(P, { t: 'token', n, p: 0, q: 1, name: 'green Plant', kw: [] }, null, src); },
    beregond(P, e, t, src) { P.bf.filter(isCreature).forEach(x => { x.tp += 1; x.tq += 1; x.tkw.push('vigilance'); }); log('Creatures you control get +1/+1 and gain vigilance until end of turn.'); },
    vialSmasher(P, e, t, src) {
        const mv = (G.ctxRaw && G.ctxRaw.o && G.ctxRaw.o.card.cmc) || 0; const os = foes(P); if (!os.length || !mv) return;
        const F = os[rand(os.length)]; damage(F, mv, src); log(`${src.card.name} deals ${mv} damage to ${F.name}.`);
    },
    eshki(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; if (!onBf(src.uid)) return; putCounters(src, 1, P); log(`${src.card.name} gets a +1/+1 counter.`);
        const pw = sp ? Number(sp.card.power) || 0 : 0;
        if (pw >= 4) drawCards(P, 1);
        if (pw >= 6) foes(P).forEach(F => damage(F, Math.max(0, pow(src)), src));
    },
    async braidsConjurer(P, e, t, src) {
        const Q = G.players[G.active]; if (!Q || Q.out) return;
        const pool = Q.hand.filter(c => /\b(Artifact|Creature|Land)\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(Q, pool, `${src.card.name}: put an artifact, creature, or land card from your hand onto the battlefield?`, { optional: true });
        if (c) { pull(Q.hand, c); putOntoBattlefield(Q, c); if (/\bLand\b/.test(c.card.type)) fire('landfall', { o: c }); log(`${c.card.name} enters the battlefield.`); }
    },
    szeras(P, e, t, src) { const n = G.lastSacMv || 0; if (n > 0) { P.pool = (P.pool || []).concat(Array(n).fill('B')); log(`${P.name} add${you(P) ? '' : 's'} ${'{B}'.repeat(n)}.`); } },
    tappedTreasure(P, e, t, src) { const tk = makeArtifactToken(P, 'treasure'); if (tk) tk.tapped = true; },
    geralf(P, e, t, src) { const x = G.lastSacTou || 0; if (x > 0) applyEffect(P, { t: 'token', n: 1, p: x, q: x, name: 'blue Zombie', kw: [] }, null, src); },
    ramirez(P, e, t, src) { for (const H of hitList()) { const c = H.library.pop(); if (c) exilePlayFrom(P, H, c, 1e9); } },
    silumgar(P, e, t, src) { const D = G.defender !== undefined && G.defender !== null && G.players[G.defender] ? G.players[G.defender] : opp(P); D.bf.filter(isCreature).forEach(x => { x.tp -= 1; x.tq -= 1; }); log(`Creatures ${D.name === 'You' ? 'you control' : D.name + ' controls'} get -1/-1 until end of turn.`); },
    async brinelin(P, e, t, src) {
        const pool = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && x !== src && !has(x, 'hexproof') && (x.owner !== P.i || false));
        const mine = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && x.owner === P.i);
        const list = pool.concat(mine); if (!list.length) return;
        const x = (P.isAI || AUTOPLAY) ? pool.sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, list, `${src.card.name}: return target nonland permanent to its owner's hand?`, { optional: true });
        if (x && onBf(x.uid)) { leaveBattlefield(x, 'hand'); log(`${x.card.name} returns to its owner's hand.`); }
    },
    shelinda(P, e, t, src) { const x = G.ctxObj; if (!x || !onBf(x.uid) || !onBf(src.uid)) return; const tgt = pow(x) < pow(src) ? x : src; putCounters(tgt, 1, P); log(`${tgt.card.name} gets a +1/+1 counter.`); },
    zegana(P, e, t, src) { if (P.bf.some(x => x !== src && isCreature(x) && x.counters > 0)) drawCards(P, 1); },
    ayli(P, e, t, src) { const n = G.lastSacTou || 0; if (n > 0) gainLifeFor(P, n); },
    async shroofus(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Saproling', kw: [] }, null, src); },
    async ambrosia(P, e, t, src) { const pool = P.bf.filter(x => x !== src); if (!pool.length) return; const x = await pickOwn(P, pool, `${src.card.name}: return another permanent you control to its owner's hand?`, { optional: true, rank: (a, b) => permValue(a) - permValue(b) }); if (x && (!(P.isAI || AUTOPLAY) || x.token === false)) { leaveBattlefield(x, 'hand'); log(`${x.card.name} returns to its owner's hand.`); } },
    hopeEstheim(P, e, t, src) { const n = P.gainedTurn === G.turn ? (P.gainedAmt || 0) : 0; if (n > 0) foes(P).forEach(F => doMill(F, n)); },
    async abuelo(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && (isCreature(x) || /\bArtifact\b/.test(x.card.type))); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: exile another creature or artifact you control`, {}); if (!x) return;
        const own = G.players[x.owner]; leaveBattlefield(x, 'exile'); log(`${x.card.name} is exiled.`);
        atEndStep(() => { const y = own.exile.find(z => z.uid === x.uid); if (y) { pull(own.exile, y); putOntoBattlefield(own, y); } }, `${x.card.name} returns to the battlefield.`);
    },
    async meloku(P, e, t, src) {
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)); if (!lands.length) return;
        const l = await pickOwn(P, lands, `${src.card.name}: return a land you control to its owner's hand`, { rank: (a, b) => (b.tapped ? 1 : 0) - (a.tapped ? 1 : 0) });
        if (l) { leaveBattlefield(l, 'hand'); await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'blue Illusion', kw: ['flying'] }, null, src); }
    },
    async flubs(P, e, t, src) { if (!P.hand.length) drawCards(P, 1); else await discardChosen(P, src.card.name); },
    tori(P, e, t, src) {
        const at = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && x !== src);
        at.forEach(x => { x.tp += 1; x.tq += 1; if ((x.card.colors || []).includes('R')) x.tkw.push('trample'); if ((x.card.colors || []).includes('W')) x.tapped = false; });
        log(`${src.card.name}: the other attackers get +1/+1; red ones gain trample; white ones untap.`);
    },
    voja(P, e, t, src) { const el = P.bf.filter(x => hasType(x, 'Elf')).length, wo = P.bf.filter(x => hasType(x, 'Wolf')).length; if (el > 0) P.bf.filter(isCreature).forEach(x => putCounters(x, el, P)); if (wo > 0) drawCards(P, wo); },
    async alesha(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (Number(c.card.power) || 0) <= 2); if (!pool.length) return;
        if (!(await mayPay(P, '{W}{W}', `${src.card.name}: pay {W/B}{W/B} to return a creature card?`, src, true)) && !(await mayPay(P, '{B}{B}', 'pay', src, true)) && !(await mayPay(P, '{W}{B}', 'pay', src, true))) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with power 2 or less`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c, true); G.attackers.push(c.uid); log(`${c.card.name} returns tapped and attacking.`); }
    },
    rakdosShowstopper(P, e, t, src) { allPerms().filter(x => isCreature(x) && !['Demon', 'Devil', 'Imp'].some(w => hasType(x, w))).forEach(x => { if (rand(2) === 0) { log(`${x.card.name}: tails.`); if (!has(x, 'indestructible')) dieOrLeave(x, 'gy'); } }); },
    jirina(P, e, t, src) { P.bf.filter(x => isCreature(x) && hasType(x, 'Human')).forEach(x => { x.tkw.push('hexproof'); x.tkw.push('indestructible'); }); log('Humans you control gain hexproof and indestructible until end of turn.'); },
    async leinore(P, e, t, src) {
        const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: put a +1/+1 counter on up to one creature you control`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (x) putCounters(x, 1, P);
        if (new Set(P.bf.filter(isCreature).map(y => pow(y))).size >= 3) drawCards(P, 1);
    },
    async sidisiRegent(P, e, t, src) {
        const f = G.lastSacMv; if (f === undefined) return;
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) === f + 1); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${f + 1}`, {}); if (c) { pull(P.gy, c); putOntoBattlefield(P, c); log(`${c.card.name} returns to the battlefield.`); }
    },
    tersa(P, e, t, src) {
        if (!P.gy.length) return; const c = P.gy[rand(P.gy.length)]; pull(P.gy, c); P.exile.push(c); c.playUntil = G.turn; c.playAny = true;
        log(`${c.card.name} is exiled from ${you(P) ? 'your' : P.name + "'s"} graveyard at random; ${you(P) ? 'you' : 'they'} may play it this turn.`);
    },
    async michiko(P, e, t, src) {
        const s = G.ctxRaw && G.ctxRaw.src; const Q = s && G.players[s.owner]; if (!Q || Q.out || Q === P) return;
        const pool = Q.bf.filter(x => true); if (!pool.length) return; const c = await chooseFrom(Q, pool, `${src.card.name}: sacrifice a permanent`, false); if (c) sacPerm(Q, c);
    },
    thadaAdel(P, e, t, src) {
        for (const H of hitList()) { const i = H.library.findIndex(c => /\bArtifact\b/.test(c.card.type)); if (i >= 0) { const c = H.library.splice(i, 1)[0]; c.realOwner = H.i; c.owner = P.i; c.playUntil = G.turn; P.exile.push(c); log(`${c.card.name} is exiled; ${you(P) ? 'you' : 'they'} may play it this turn.`); } shuffle(H.library); }
    },
    async monstrosityLake(P, e, t, src) {
        if (!(await mayPay(P, '{5}', `${src.card.name}: pay {5} to tap all creatures your opponents control and stun them?`, src, true))) return;
        foes(P).flatMap(F => F.bf).filter(isCreature).forEach(x => { x.tapped = true; x.ctr.stun = (x.ctr.stun || 0) + 1; }); log('Creatures your opponents control are tapped and get stun counters.');
    },
    async copyMaker(P, e, t, src) {
        let base;
        if (e.mode === 'kiki') base = await pickOwn(P, P.bf.filter(x => isCreature(x) && !/\bLegendary\b/.test(x.card.type)), `${src.card.name}: copy a nonlegendary creature`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        else if (e.mode === 'feldon') base = await pickOwn(P, P.gy.filter(c => /\bCreature\b/.test(c.card.type)), `${src.card.name}: copy a creature card in your graveyard`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        else if (e.mode === 'saheeli') base = await pickOwn(P, P.bf.filter(x => x !== src && (isCreature(x) || /\bArtifact\b/.test(x.card.type))), `${src.card.name}: copy another creature or artifact`, { rank: (a, b) => permValue(b) - permValue(a) });
        else base = await pickOwn(P, P.bf.filter(x => x !== src && isCreature(x)), `${src.card.name}: copy another creature you control`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (!base) return;
        let card = { ...base.card };
        if (e.mode === 'feldon' || e.mode === 'saheeli') card.type = typeWith(card.type, null, false).replace(/^(Legendary )?/, '$1Artifact ').replace('Artifact Artifact', 'Artifact');
        if (e.mode === 'balloon') { card = { ...card, power: '1', toughness: '1', type: typeWith(card.type, 'Balloon', true), colors: [...new Set([...(card.colors || []), 'R'])] }; }
        const tok = tokenCopyOf(P, card, e.mode === 'balloon' ? { p: 1, q: 1 } : {});
        tok.tkw.push('haste'); if (e.mode === 'balloon') tok.tkw.push('flying');
        tok.sacAtEnd = G.turn; tok.sick = false;
    },
    wakka(P, e, t, src) { P.bf.filter(x => x !== src && isCreature(x)).forEach(x => putCounters(x, 1, P)); },
});
COUNT_EXTRA.push([/^(?:the number of )?permanent cards in your graveyard$/, () => o => G.players[o.owner].gy.filter(x => !/Instant|Sorcery/.test(x.card.type)).length]);

// ===== Batch 5 =====
Object.assign(TRIG_FN, {
    selfAndOtherAttack: (o, ctx) => (ctx.list || []).includes(o) && ctx.list.length >= 2,
    smallCreatureDies: (o, ctx) => { const x = ctx.o; if (!x || x.owner !== o.owner) return false; return true; },
    sameNameInGy: (o, ctx) => { const sp = ctx.o, Q = ctx.P; if (!sp || !Q || Q.i === o.owner) return false; if (!/\b(Creature|Planeswalker)\b/.test(sp.card.type)) return false; return Q.gy.some(c => c.card.name === sp.card.name); },
    markGyLeft: (o, ctx) => { if (ctx.P.i === o.owner) G.players[o.owner].gyLeftTurn = G.turn; return false; },
    gyLeftThisTurn: (o, ctx) => G.players[o.owner].gyLeftTurn === G.turn,
    firstEnchantment: (o, ctx) => { if (ctx.P.i !== o.owner || !/\bEnchantment\b/.test(ctx.o.card.type)) return false; if (ctx.P.enchCastTurn === G.turn) return false; ctx.P.enchCastTurn = G.turn; return true; },
    bairdCond: (o, ctx) => G.players[o.owner].bf.some(x => isCreature(x) && pow(x) > (Number(x.card.power) || 0)),
});
COND_EXTRA.push([/^an artifact entered the battlefield under your control this turn$/, () => P => (G.entered || []).some(e => e.turn === G.turn && e.owner === P.i && /\bArtifact\b/.test(e.o.card.type))]);
Object.assign(CMD_SCORE, { aveline: () => 4, baxter: () => 2, belakor: () => 5, oji: () => 4, slobad: () => 1, endure: () => 4, urdnan: () => 3, alenaMana: () => 2, arnyn: () => 3, hraes: () => 3, spiderIndia: () => 4, firja: () => 4, kolaghan: () => 1, orfeo: () => 4, jenson: () => 3, miara: () => 3, amzu: () => 4, erkenbrand: () => 3, gau: () => 3, leonardoBalance: () => 5, krydle: () => 3, smellerbee: () => 3, yisan: () => 6, generalLeo: () => 6, cosmicSpider: () => 4, aureliaEJ: () => 4, karrthus: () => 12, misterNegative: () => 3, bentonDraw: () => 2, gandalfGB: () => 3, nemataGG: () => 1, brion: () => 3, minwu: () => 3, grub: () => 4, harald: () => 5, kolvori: () => 5, hidetsugu: () => 4, narsetEM: () => 7, raphLeo: () => 6 });
Object.assign(CMD_AITARGET, { brion: (P, e, src, valid, c) => ({ p: c.O }), hidetsugu: (P, e, src, valid, c) => ({ p: c.O }) });
async function lookTopPick(P, n, test, why, src) {
    const top = []; for (let i = 0; i < n && P.library.length; i++) top.push(P.library.pop());
    const pool = top.filter(test); let got = null;
    if (pool.length) got = await pickOwn(P, pool, `${src.card.name}: ${why}`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
    if (got) { P.hand.push(got); log(`${P.name} reveal${you(P) ? '' : 's'} ${got.card.name} and put it into ${you(P) ? 'your' : 'their'} hand.`); }
    P.library.unshift(...shuffle(top.filter(c => c !== got)));
    return got;
}
Object.assign(CMD, {
    aveline(P, e, t, src) { const s = rawSrc(), n = (G.ctxRaw && G.ctxRaw.n) || 0; if (s && onBf(s.uid) && n > 0) { const got = putCounters(s, n, P); log(`${s.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } },
    baxter(P, e, t, src) { P.bf.filter(x => isCreature(x) && (x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0))).forEach(x => x.tkw.push('flying')); log('Each creature you control with a counter on it gains flying until end of turn.'); },
    belakor(P, e, t, src) { const x = P.bf.filter(y => isCreature(y) && hasType(y, 'Demon')).length; if (x > 0) { drawCards(P, x); P.life -= x; log(`${P.name} lose${you(P) ? '' : 's'} ${x} life.`); fire('loseLife', { P, n: x }); } },
    async oji(P, e, t, src) { const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: exile up to one creature you control, then return it`, { optional: true, rank: (a, b) => ((b.etbCount || 0) - (a.etbCount || 0)) || (Rx(b).etb.length - Rx(a).etb.length) }); if (x && ((!(P.isAI || AUTOPLAY)) || Rx(x).etb.length)) await applyEffect(P, { t: 'flicker' }, { o: x }, src); },
    async slobad(P, e, t, src) { const x = await pickOwn(P, P.bf.filter(y => /\bArtifact\b/.test(y.card.type)), `${src.card.name}: target artifact gains indestructible`, { rank: (a, b) => permValue(b) - permValue(a) }); if (x) { x.tkw.push('indestructible'); log(`${x.card.name} gains indestructible until end of turn.`); } },
    async endure(P, e, t, src) {
        const n = e.n || 1; const useCounters = onBf(src.uid) && ((P.isAI || AUTOPLAY) ? true : (await askMode(P, `${src.card.name} endures ${n}`, [`Put ${n} +1/+1 counters on ${src.card.name}`, `Create a ${n}/${n} white Spirit token`])) === 0);
        if (useCounters) { const got = putCounters(src, n, P); log(`${src.card.name} gets ${got} +1/+1 counters.`); } else await applyEffect(P, { t: 'token', n: 1, p: n, q: n, name: 'white Spirit', kw: [] }, null, src);
    },
    async urdnan(P, e, t, src) {
        const at = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && x.counters > 0); if (!at.length) return;
        const x = await pickOwn(P, at, `${src.card.name}: target attacking creature with a +1/+1 counter`, { rank: (a, b) => b.counters - a.counters });
        if (x) { x.tkw.push(x.counters >= 2 ? 'double strike' : 'first strike'); log(`${x.card.name} gains ${x.counters >= 2 ? 'double' : 'first'} strike until end of turn.`); }
    },
    alenaMana(P, e, t, src) { const n = Math.max(0, ...(G.entered || []).filter(en => en.turn === G.turn && en.owner === P.i && en.creature && onBf(en.o.uid)).map(en => pow(en.o)), 0); if (n > 0) { P.pool = (P.pool || []).concat(Array(n).fill('R')); log(`${P.name} add${you(P) ? '' : 's'} ${'{R}'.repeat(n)}.`); } },
    arnyn(P, e, t, src) {
        const l = G.ctxRaw && G.ctxRaw.lki; if (!l || !(l.pow <= 1 || l.tou <= 1)) return;
        foes(P).slice(0, 1).forEach(F => { F.life -= 2; log(`${F.name} lose${you(F) ? '' : 's'} 2 life.`); fire('loseLife', { P: F, n: 2 }); }); gainLifeFor(P, 2);
    },
    async hraes(P, e, t, src) { const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: target creature gets +1/+0 and can't be blocked`, { rank: (a, b) => pow(b) - pow(a) }); if (x) { x.tp += 1; x.tkw.push('unblockable'); log(`${x.card.name} gets +1/+0 and can't be blocked this turn.`); } },
    async spiderIndia(P, e, t, src) { const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: +1/+1 counter on a creature, it gains flying`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (x) { putCounters(x, 1, P); x.tkw.push('flying'); log(`${x.card.name} gets a +1/+1 counter and gains flying until end of turn.`); } },
    async firja(P, e, t, src) {
        const top = []; for (let i = 0; i < 3 && P.library.length; i++) top.push(P.library.pop()); if (!top.length) return;
        const c = await pickOwn(P, top, `${src.card.name}: put one into your hand (the rest go to the graveyard)`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }) || top[0];
        P.hand.push(c); top.filter(x => x !== c).forEach(x => P.gy.push(x)); log(`${P.name} put${you(P) ? '' : 's'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand and the rest into the graveyard.`);
    },
    kolaghan(P, e, t, src) { const Q = G.ctxRaw && G.ctxRaw.P; if (!Q || Q.out) return; Q.life -= 10; log(`${Q.name} lose${you(Q) ? '' : 's'} 10 life.`); fire('loseLife', { P: Q, n: 10 }); },
    async orfeo(P, e, t, src) { const x = await pickOwn(P, allPerms().filter(y => isCreature(y) && y.owner === P.i), `${src.card.name}: double target creature's power`, { rank: (a, b) => pow(b) - pow(a) }); if (x) { const n = pow(x); if (n > 0) { x.tp += n; log(`${x.card.name}'s power is doubled until end of turn.`); } } },
    jenson(P, e, t, src) { log(`${P.name} scry${you(P) ? '' : 's'} 1.`); const sp = G.ctxRaw && G.ctxRaw.o; if (sp && (sp.card.colors || []).length >= 5) applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'white Angel', kw: ['flying', 'vigilance'] }, null, src); },
    async miara(P, e, t, src) { if (P.life < 2) return; if (await mayPay(P, '{1}', `${src.card.name}: pay {1} and 1 life to draw a card?`, src, true)) { P.life -= 1; fire('loseLife', { P, n: 1 }); drawCards(P, 1); } },
    amzu(P, e, t, src) { const cards = P.gyLeftLast || []; const mv = Math.max(0, ...cards.map(c => c.card.cmc || 0)); applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'black green Insect', kw: [] }, null, src).then(() => { const tk = G.lastMade; if (tk && mv > 0) putCounters(tk, mv, P); }); },
    erkenbrand(P, e, t, src) { P.bf.filter(isCreature).forEach(x => { x.tp += 1; }); log('Creatures you control get +1/+0 until end of turn.'); },
    gau(P, e, t, src) { const n = Math.max(0, pow(src)); if (n > 0) foes(P).forEach(F => damage(F, n, src)); },
    leonardoBalance(P, e, t, src) { P.bf.filter(isCreature).forEach(x => putCounters(x, 1, P)); log('A +1/+1 counter on each creature you control.'); },
    krydle(P, e, t, src) { hitList().forEach(H => { H.life -= 1; fire('loseLife', { P: H, n: 1 }); doMill(H, 1); }); gainLifeFor(P, 1); log(`${P.name} scry${you(P) ? '' : 's'} 1.`); },
    async smellerbee(P, e, t, src) {
        const n = (G.attackers || []).length; if (!P.hand.length) return;
        const ok = (P.isAI || AUTOPLAY) ? n > P.hand.length : await askYes(P, `${src.card.name}: discard your hand and draw ${n} cards?`, { card: src.card });
        if (ok) { const k = P.hand.length; P.hand.splice(0).forEach(c => P.gy.push(c)); noteDiscard(P, k); drawCards(P, n); }
    },
    async yisan(P, e, t, src) {
        src.ctr.verse = (src.ctr.verse || 0) + 1; const mv = src.ctr.verse;
        const pool = P.library.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) === mv);
        if (pool.length) { const c = await pickOwn(P, pool, `${src.card.name}: search for a creature card with mana value ${mv}`, {}); if (c) { pull(P.library, c); putOntoBattlefield(P, c); log(`${c.card.name} enters the battlefield.`); } }
        shuffle(P.library);
    },
    async generalLeo(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= 3);
        if (pool.length) { const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value 3 or less`, { optional: true }); if (c) { pull(P.gy, c); putOntoBattlefield(P, c); } }
        const n = P.bf.filter(isCreature).length; if (onBf(src.uid) && n > 0) putCounters(src, n, P);
    },
    cosmicSpider(P, e, t, src) { P.bf.filter(x => x !== src && isCreature(x) && hasType(x, 'Spider')).forEach(x => x.tkw.push('flying', 'first strike', 'trample', 'lifelink', 'haste')); },
    async aureliaEJ(P, e, t, src) { const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: choose up to one creature you control`, { optional: true, rank: (a, b) => pow(b) - pow(a) }); if (!x) return; x.tp += 2; if ((x.card.colors || []).includes('R')) x.tkw.push('trample'); if ((x.card.colors || []).includes('W')) x.tkw.push('vigilance'); },
    async karrthus(P, e, t, src) { for (const x of allPerms().filter(y => isCreature(y) && hasType(y, 'Dragon') && y.owner !== P.i)) await applyEffect(P, { t: 'stealPerm' }, { o: x }, src); allPerms().filter(y => isCreature(y) && hasType(y, 'Dragon')).forEach(y => { y.tapped = false; }); log('All Dragons untap.'); },
    async misterNegative(P, e, t, src) {
        const F = foes(P).sort((a, b) => b.life - a.life)[0]; if (!F) return;
        const ok = (P.isAI || AUTOPLAY) ? F.life > P.life + 4 : await askYes(P, `${src.card.name}: exchange life totals with ${F.name}?`, { card: src.card });
        if (!ok) return; const a = P.life, b = F.life; P.life = b; F.life = a; log(`${P.name} and ${F.name} exchange life totals.`); if (b < a) drawCards(P, a - b);
    },
    bentonDraw(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0) { drawCards(P, n); hitList().forEach(H => drawCards(H, n)); } },
    gandalfGB(P, e, t, src) { if (onBf(src.uid)) { src.tp += 1; src.tq += 1; } foes(P).forEach(F => damage(F, 1, src)); },
    nemataGG(P, e, t, src) { P.bf.filter(x => isCreature(x) && hasType(x, 'Saproling')).forEach(x => { x.tp += 1; x.tq += 1; }); },
    brion(P, e, t, src) { const n = G.lastSacPow || 0; if (n > 0 && t && t.p) damage(t.p, n, src); },
    minwu(P, e, t, src) { P.bf.filter(x => isCreature(x) && hasType(x, 'Cleric')).forEach(x => putCounters(x, 1, P)); },
    async grub(P, e, t, src) { const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && hasType(c, 'Goblin')); if (!pool.length) return; const c = await pickOwn(P, pool, `${src.card.name}: return a Goblin card to your hand`, { optional: true }); if (c) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : P.name + "'s"} hand.`); } },
    async harald(P, e, t, src) { await lookTopPick(P, 5, c => hasType(c, 'Elf') || hasType(c, 'Warrior') || hasType(c, 'Tyvar') || /Tyvar/.test(c.card.name), 'reveal an Elf, Warrior, or Tyvar card', src); },
    async kolvori(P, e, t, src) { await lookTopPick(P, 6, c => /\bLegendary\b/.test(c.card.type) && /\bCreature\b/.test(c.card.type), 'reveal a legendary creature card', src); },
    async hidetsugu(P, e, t, src) {
        const c = P.library.pop(); if (!c) return; P.exile.push(c); log(`${c.card.name} is exiled from ${you(P) ? 'your' : P.name + "'s"} library.`);
        const mv = c.card.cmc || 0; if (t && t.p && mv > 0) { t.p.life -= mv; log(`${t.p.name} lose${you(t.p) ? '' : 's'} ${mv} life.`); fire('loseLife', { P: t.p, n: mv }); }
        if (/Instant|Sorcery/.test(c.card.type)) { const ok = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }); if (ok) await castFreeFrom(P, c, null); }
    },
    async narsetEM(P, e, t, src) {
        const top = []; for (let i = 0; i < 4 && P.library.length; i++) top.push(P.library.pop()); top.forEach(c => P.exile.push(c)); if (top.length) log(`${P.name} exile${you(P) ? '' : 's'} ${top.map(c => c.card.name).join(', ')}.`);
        for (const c of top) { if (/\bCreature\b/.test(c.card.type) || /\bLand\b/.test(c.card.type) || !P.exile.includes(c)) continue; const ok = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }); if (ok) await castFreeFrom(P, c, null); }
    },
    async raphLeo(P, e, t, src) {
        const at = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && x.tapped); at.slice(0, 2).forEach(x => { x.tapped = false; }); G.extraCombat = (G.extraCombat || 0) + 1;
        log(`${P.name} untap${you(P) ? '' : 's'} up to two attacking creatures; there will be an additional combat phase after this one.`);
    },
});

// ===== Batch 6 =====
function maxHandSize(P) {
    let m = 7;
    for (const x of allPerms()) {
        if (x.owner === P.i || lostAbilities(x)) continue;
        const R = Rx(x);
        if (R.oppHandReduce) m -= R.oppHandReduce;
        if (R.oppHandWinter) { const X = G.players[x.owner]; const ty = new Set(); X.gy.forEach(c => ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery', 'Battle', 'Kindred'].forEach(w => { if (new RegExp(`\\b${w}\\b`).test(c.card.type)) ty.add(w); })); if (ty.size >= 4) m = Math.min(m, 7 - ty.size); }
    }
    return Math.max(0, m);
}
Object.assign(TRIG_FN, {
    myCreatureAlone: (o, ctx) => (ctx.list || []).length === 1 && ctx.list[0].owner === o.owner,
    twoCreaturesEntered: (o, ctx) => (G.entered || []).filter(e => e.turn === G.turn && e.owner === o.owner && e.creature).length >= 2,
    anyCreatureSacrificed: (o, ctx) => !!ctx.o && isCreature(ctx.o) || !!ctx.o && /\bCreature\b/.test(ctx.o.card.type),
    counterCreatureHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && ctx.src.counters > 0 && (ctx.step === undefined || (o.lastStepC !== ctx.step && ((o.lastStepC = ctx.step), true))),
    myNontokenLeaves: (o, ctx) => !!ctx.o && !ctx.o.token && ctx.o.owner === o.owner && /\bCreature\b/.test(ctx.o.card.type),
    selfTappedScry: (o, ctx) => ctx.P.i === o.owner && o.tapped,
    hasteAttacker: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && has(x, 'haste')),
    selfNoncombatDamage: (o, ctx) => ctx.o === o && !G.inCombatDamage,
    bigAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && pow(x) >= 4),
    diedWithCounter: (o, ctx) => !!ctx.o && (ctx.o === o || ctx.o.owner === o.owner) && (ctx.o.counters > 0 || (ctx.o.lastCounters || 0) > 0),
    threeArtifactsEntered: (o, ctx) => (G.entered || []).filter(e => e.turn === G.turn && e.owner === o.owner && /\bArtifact\b/.test(e.o.card.type)).length >= 3,
    fourCreaturesInGy: (o, ctx) => G.players[o.owner].gy.filter(c => /\bCreature\b/.test(c.card.type)).length >= 4,
    artifactOrLesson: (o, ctx) => ctx.P.i === o.owner && /\b(Artifact|Lesson)\b/.test(ctx.o.card.type),
});
COND_EXTRA.push(
    [/^you control three or more artifacts$/, () => P => P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length >= 3],
    [/^you control a creature with a \+1\/\+1 counter on it$/, () => P => P.bf.some(x => isCreature(x) && x.counters > 0)]
);
Object.assign(CMD_SCORE, { spiderNoir: () => 4, piandao: () => 4, verix: () => 7, felothar: () => 5, grunn: () => 4, kemba: () => 4, aangKatara: () => 6, tolsimir: () => 4, livaan: () => 3, smaug: () => 4, ojutaiSoW: () => 4, bolster2: () => 4, jorKadeenFG: () => 4, slurrk: () => 4, brightPalm: () => 4, viconia: () => 4, ghave: () => 3, prossh: () => 5, eivor: () => 5, shantotto: () => 4, madameNull: () => 3, piru: () => 5, totentanz: () => 2, valduk: () => 5, yennett: () => 4 });
const putSpec = (P, name, p, q, kw, extra) => applyEffect(P, { t: 'token', n: 1, p, q, name, kw: kw || [], ...(extra || {}) }, null, G.players[P.i].bf[0] || { card: { name: 'effect' } });
Object.assign(CMD, {
    pumpSelf(P, e, t, src) { if (onBf(src.uid)) { src.tp += e.p || 0; src.tq += e.q || 0; log(`${src.card.name} gets +${e.p || 0}/+${e.q || 0} until end of turn.`); } },
    async spiderNoir(P, e, t, src) { const x = (G.ctxRaw && G.ctxRaw.list && G.ctxRaw.list[0]) || null; if (x && onBf(x.uid)) { putCounters(x, 1, P); log(`${P.name} surveil${you(P) ? '' : 's'} ${x.counters}.`); } },
    async piandao(P, e, t, src) { await lookTopPick(P, 4, c => hasType(c, 'Ally') || /\bEquipment\b/.test(c.card.type) || /\bLesson\b/.test(c.card.type), 'reveal an Ally, Equipment, or Lesson card', src); },
    verix(P, e, t, src) { if (src.kicked || src.wasKicked) applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'red Dragon', kw: ['flying'], named: 'Karox Bladewing', legendary: true }, null, src); },
    async felothar(P, e, t, src) {
        const pool = P.bf.filter(x => !/\bLand\b/.test(x.card.type)); if (!pool.length) return;
        const f = (P.isAI || AUTOPLAY) ? pool.filter(x => x.token || permValue(x) <= 2)[0] : await pickOwn(P, pool, `${src.card.name}: sacrifice a nonland permanent?`, { optional: true });
        if (!f) return; sacPerm(P, f); P.bf.filter(isCreature).forEach(x => putCounters(x, 1, P));
    },
    grunn(P, e, t, src) { if (!onBf(src.uid)) return; src.tp += pow(src); src.tq += tou(src); log(`${src.card.name}'s power and toughness are doubled until end of turn.`); },
    kemba(P, e, t, src) { const n = allPerms().filter(a => a.attachedTo === src.uid && /\bEquipment\b/.test(a.card.type)).length; if (n > 0) applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'white Cat', kw: [] }, null, src); },
    aangKatara(P, e, t, src) { const n = P.bf.filter(x => x.tapped && (isCreature(x) || /\bArtifact\b/.test(x.card.type))).length; if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'white Ally', kw: [] }, null, src); },
    tolsimir(P, e, t, src) { if (P.bf.some(x => x.token && x.card.name === 'Voja')) return; applyEffect(P, { t: 'token', n: 1, p: 2, q: 2, name: 'green white Wolf', kw: [], named: 'Voja', legendary: true }, null, src); },
    async livaan(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: target creature gets +X/+0`, { rank: (a, b) => pow(b) - pow(a) }); if (x && sp) { x.tp += sp.card.cmc || 0; log(`${x.card.name} gets +${sp.card.cmc || 0}/+0 until end of turn.`); } },
    smaug(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || G.ctxCount || 0; if (n > 0) applyEffect(P, { t: 'artToken', kind: 'treasure', n }, null, src); },
    async ojutaiSoW(P, e, t, src) { const pool = foes(P).flatMap(F => F.bf).filter(x => !/\bLand\b/.test(x.card.type)); const x = (P.isAI || AUTOPLAY) ? pool.sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: tap target nonland permanent`, { optional: true }); if (x) { x.tapped = true; x.skipUntap = true; log(`${x.card.name} is tapped and won't untap during its controller's next untap step.`); } },
    bolster2(P, e, t, src) { const cs = P.bf.filter(isCreature); if (!cs.length) return; const w = cs.sort((a, b) => tou(a) - tou(b))[0]; putCounters(w, 2, P); log(`${w.card.name} gets two +1/+1 counters (bolster 2).`); },
    jorKadeenFG(P, e, t, src) { const n = P.bf.filter(x => isCreature(x) && allPerms().some(a => a.attachedTo === x.uid && /\bEquipment\b/.test(a.card.type))).length; if (!onBf(src.uid)) return; src.tp += n; src.tq += n; if (pow(src) >= 4) drawCards(P, 1); },
    slurrk(P, e, t, src) { P.bf.filter(x => isCreature(x) && x.counters > 0).forEach(x => putCounters(x, 1, P)); },
    async brightPalm(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x.counters > 0); const x = await pickOwn(P, pool, `${src.card.name}: double the +1/+1 counters on a creature`, { rank: (a, b) => b.counters - a.counters });
        if (x) { putCounters(x, x.counters, P); x.smallCantBlock = G.turn; log(`${x.card.name}'s counters are doubled.`); }
    },
    viconia(P, e, t, src) { const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return; const c = pool[rand(pool.length)]; pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : P.name + "'s"} hand at random.`); },
    ghave(P, e, t, src) { const x = P.bf.find(y => isCreature(y) && y.counters > 0); if (!x) return; x.counters -= 1; log(`A +1/+1 counter is removed from ${x.card.name}.`); applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'green Saproling', kw: [] }, null, src); },
    prossh(P, e, t, src) { const x = src.card.cmc || 0; if (x > 0) applyEffect(P, { t: 'token', n: x, p: 0, q: 1, name: 'red Kobold', kw: [], named: 'Kobolds of Kher Keep' }, null, src); },
    async eivor(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n <= 0) return; const milled = doMill(P, n);
        const saga = milled.find(c => /\bSaga\b/.test(c.card.type)), land = milled.find(c => /\bLand\b/.test(c.card.type));
        for (const c of [saga, land]) if (c && P.gy.includes(c)) { pull(P.gy, c); putOntoBattlefield(P, c); if (/\bLand\b/.test(c.card.type)) fire('landfall', { o: c }); log(`${c.card.name} enters the battlefield.`); }
    },
    shantotto(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const x = sp ? (sp.card.cmc || 0) : 0; if (onBf(src.uid)) src.tp += x; if (x >= 4) drawCards(P, 1); },
    async madameNull(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return; const n = Math.max(0, pow(x)); if (n <= 0 || P.life <= n) return;
        const ok = (P.isAI || AUTOPLAY) ? P.life > n * 3 : await askYes(P, `${src.card.name}: pay ${n} life to put ${n} +1/+1 counters on ${x.card.name}?`, { card: src.card });
        if (ok) { P.life -= n; fire('loseLife', { P, n }); putCounters(x, n, P); }
    },
    piru(P, e, t, src) { allPerms().filter(x => isCreature(x) && !/\bLegendary\b/.test(x.card.type)).forEach(x => damage(x, 7, src)); },
    async totentanz(P, e, t, src) { const pool = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && hasType(x, 'Rat')); const x = await pickOwn(P, pool, `${src.card.name}: target attacking Rat gains deathtouch`, {}); if (x) x.tkw.push('deathtouch'); },
    valduk(P, e, t, src) { const n = allPerms().filter(a => a.attachedTo === src.uid && /\b(Aura|Equipment)\b/.test(a.card.type)).length; if (n <= 0) return; applyEffect(P, { t: 'token', n, p: 3, q: 1, name: 'red Elemental', kw: ['trample', 'haste'], sacEnd: true }, null, src); },
    async yennett(P, e, t, src) {
        const top = P.library[P.library.length - 1]; if (!top) return; log(`${P.name} reveal${you(P) ? '' : 's'} ${top.card.name}.`);
        if ((top.card.cmc || 0) % 2 === 1 && !/\bLand\b/.test(top.card.type)) { const ok = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${top.card.name} without paying its mana cost?`, { card: top.card }); if (ok && await castFreeFrom(P, top, null)) return; }
        drawCards(P, 1);
    },
});
