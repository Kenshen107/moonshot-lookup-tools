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
