// Spellslinger Duels - engine pieces for card round rk5 (2026-11-27). CMD ids start with rk5_. Wordings are in rules/rk5.js.
// Choices inside resolving effects are made as they resolve (the accepted approximation); "may" / "target" always ask a person.
const RK5F = {}; // permanent filters ('rk5:<name>') read by the permMatches wrapper
const RK5S = {}; // stack filters ('rk5:<name>') read by the stackMatches wrapper
const rk5Human = P => !(P.isAI || AUTOPLAY);
const rk5Perms = key => allPerms().filter(x => Rx(x)[key] && !lostAbilities(x));
const rk5Lose = (X, n) => { if (!X || X.out || n <= 0) return; X.life -= n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); };
const rk5Types = P => { const s = new Set(); P.gy.forEach(c => ((c.card.type || '').split('—')[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Land|Planeswalker|Sorcery|Kindred|Tribal)\b/g) || []).forEach(t => s.add(t))); return s; };
async function rk5Search(P, test, title, src) {
    const pool = P.library.filter(test);
    if (!pool.length) { log(`${P.name} ${you(P) ? 'search' : 'searches'} ${you(P) ? 'your' : 'their'} library and ${you(P) ? 'find' : 'finds'} nothing.`); shuffleLib(P); return null; }
    const x = await pickOwn(P, pool, `${src.card.name}: ${title}`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
    if (x) { pull(P.library, x); P.hand.push(x); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${x.card.name} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand.`); }
    shuffleLib(P);
    return x;
}
// "Any target that isn't ..." the computer picks the best, a person chooses among players and creatures
async function rk5AnyTarget(P, title, n, srcObj, ok) {
    const cands = [];
    G.players.filter(X => !X.out).forEach(X => { cands.push({ p: X, s: X === P ? -50 : X.life <= n ? 100 : 20 - X.life / 5 }); allPerms().filter(c => c.owner === X.i && (isCreature(c) || isPlaneswalker(c)) && ok(c)).forEach(c => cands.push({ o: c, s: X === P ? -50 : tou(c) - c.dmg <= n ? 10 + creatureValue(c) : 1 })); });
    if (!cands.length) return null;
    if (!rk5Human(P)) return cands.sort((a, b) => b.s - a.s)[0];
    const players = cands.filter(c => c.p), objs = cands.filter(c => c.o).map(c => c.o);
    const mode = await askMode(P, title, [...players.map(c => `${c.p.name} (${c.p.life} life)`), ...(objs.length ? ['A creature or planeswalker...'] : [])]);
    if (mode < players.length) return players[mode];
    const c = await pickCard(P, objs, `${title}: choose one`, { required: true });
    return c ? { o: c } : null;
}

// ----- filters and wrappers -----
Object.assign(RK5F, {
    artEnchTheirs: (o, P) => o.owner !== P.i && /\b(Artifact|Enchantment)\b/.test(o.card.type),
    myHuman: (o, P) => o.owner === P.i && isCreature(o) && hasType(o, 'Human'),
    creatureMvLeGy: (o, P) => isCreature(o) && (o.card.cmc || 0) <= G.players[o.owner].gy.length
});
Object.assign(RK5S, { mvLeGy: it => it.kind === 'spell' && (it.o.card.cmc || 0) <= it.P.gy.length });
{
    const pm = permMatches;
    permMatches = function (o, f, P) { if (typeof f === 'string' && f.startsWith('rk5:')) { const fn = RK5F[f.slice(4)]; return !!fn && !!fn(o, P); } return pm.apply(this, arguments); };
    const sm = stackMatches;
    stackMatches = function (it, filter) { if (typeof filter === 'string' && filter.startsWith('rk5:')) { const fn = RK5S[filter.slice(4)]; return !!fn && !!fn(it); } return sm.apply(this, arguments); };
    // damage events carry their source (Phyrexian Obliterator)
    const d0 = damage;
    damage = function (target, n, src) { const prev = G && G.rk5Src; if (G) G.rk5Src = src; try { return d0.apply(this, arguments); } finally { if (G) G.rk5Src = prev; } };
    const f0 = fire;
    fire = function (ev, ctx) { if (ev === 'dealtDamage' && ctx && G && G.rk5Src && !ctx.src) ctx.src = G.rk5Src; return f0.apply(this, arguments); };
    // Helm of Awakening: every spell costs {1} less for every player
    const co = costOf;
    costOf = function (P, o) {
        const c = co.apply(this, arguments);
        if (!G || !c || !o || !o.card || Rx(o).kind === 'land') return c;
        const k = rk5Perms('rk5Helm').length; if (!k) return c;
        return { ...c, generic: Math.max(0, (c.generic || 0) - k) };
    };
    // Herald of Secret Streams: creatures with +1/+1 counters can't be blocked
    const cb = canBlock;
    canBlock = function (b, atk) { if (atk && G && atk.counters > 0 && G.players[atk.owner] && G.players[atk.owner].bf.some(x => Rx(x).rk5CounterUnblock && !lostAbilities(x))) return false; return cb.apply(this, arguments); };
    // Silver-Fur Master: ninjutsu costs {1} less
    const cn = canNinjutsu, dn = doNinjutsu;
    const withNinjaCut = (P, o, fn) => {
        const k = P.bf.filter(x => Rx(x).rk5NinjaCut && !lostAbilities(x)).length, R = Rx(o), orig = R.ninjutsu;
        if (!k || !orig) return fn();
        R.ninjutsu = { ...orig, generic: Math.max(0, (orig.generic || 0) - k) };
        try { return fn(); } finally { R.ninjutsu = orig; }
    };
    canNinjutsu = function (P, o) { return withNinjaCut(P, o, () => cn.call(this, P, o)); };
    doNinjutsu = function (P, o, att) { return withNinjaCut(P, o, () => dn.call(this, P, o, att)); };
    // Dragon's Rage Channeler: attacks each combat if able while delirious
    const fa = forcedAttack;
    forcedAttack = function (o) { if (Rx(o).rk5Drc && !lostAbilities(o) && rk5Types(G.players[o.owner]).size >= 4) return true; return fa.apply(this, arguments); };
}
COND_EXTRA.push([/^there are four or more card types among cards in your graveyard$/, () => P => rk5Types(P).size >= 4]);
STATIC_FN.rk5_ninjaRogue = o => hasType(o, 'Ninja') || hasType(o, 'Rogue');
Object.assign(TRIG_FN, {
    rk5_noMana: (o, ctx) => !!ctx.o && ctx.o.manaSpent === 0,
    rk5_oppDiscCreature: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !!ctx.o && /\bCreature\b/.test(ctx.o.card.type),
    rk5_oppDiscLand: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !!ctx.o && /\bLand\b/.test(ctx.o.card.type),
    rk5_oppDiscOther: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !!ctx.o && !/\b(Creature|Land)\b/.test(ctx.o.card.type),
    rk5_myDisc: (o, ctx) => !!ctx.P && ctx.P.i === o.owner,
    rk5_ninjaHit: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && (hasType(x, 'Ninja') || hasType(x, 'Rogue'))),
    rk5_myDragonHurt: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Dragon') && ctx.n > 0
});

Object.assign(CMD, {
    rk5_arsonist(P, e, t, src) { const Q = G.ctxRaw && G.ctxRaw.P; if (!Q || Q.out || !onBf(src.uid)) return; const n = Math.max(0, pow(src)); if (n > 0) { damage(Q, n, src); log(`${src.card.name} deals ${n} damage to ${Q.name}.`); } },
    async rk5_quandary(P, e, t, src) {
        const Q = G.ctxRaw && G.ctxRaw.P; if (!Q || Q.out) return;
        let pay = false;
        if (Q.hand.length) {
            if (rk5Human(Q)) pay = await askYes(Q, `${src.card.name}: discard a card? (Otherwise you lose 5 life.)`, { card: src.card, yes: 'Discard a card', no: 'Lose 5 life' });
            else pay = Q.life <= 12 || Math.min(...Q.hand.map(c => aiKeepValue(Q, c))) <= 3;
        }
        if (pay) await discardChosen(Q, `${src.card.name}`); else rk5Lose(Q, 5);
    },
    rk5_counterCast(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; const it = x && G.stack.find(s => s.kind === 'spell' && s.o === x);
        if (!it) return;
        log(`No mana was spent to cast ${it.name}: ${src.card.name} counters it.`);
        return applyEffect(P, { t: 'counter' }, { item: it }, src);
    },
    rk5_wasteMana(P) { P.pool = (P.pool || []).concat(['B', 'B']); log(`${P.name} ${you(P) ? 'add' : 'adds'} {B}{B} (until the step ends).`); },
    async rk5_monument(P, e, t, src) {
        const names = ['Draw a card', 'Create a Treasure token', 'Each opponent loses 3 life'];
        const done = src.rk5Chosen && src.rk5Chosen.turn === G.turn ? src.rk5Chosen.modes : [];
        const avail = [0, 1, 2].filter(i => !done.includes(i));
        if (!avail.length) return;
        let pick;
        if (rk5Human(P)) pick = avail[await askMode(P, `${src.card.name}: choose one that hasn't been chosen this turn`, avail.map(i => names[i]))];
        else pick = avail.includes(2) && foes(P).some(F => F.life <= 3) ? 2 : avail.includes(0) ? 0 : avail[0];
        if (pick === undefined) return;
        src.rk5Chosen = { turn: G.turn, modes: done.concat(pick) };
        log(`${src.card.name}: ${names[pick]}.`);
        if (pick === 0) drawCards(P, 1);
        else if (pick === 1) await applyEffect(P, { t: 'artToken', kind: 'treasure', n: 1 }, null, src);
        else foes(P).forEach(F => rk5Lose(F, 3));
    },
    rk5_axe(P, e, t, src) { const h = src.attachedTo && onBf(src.attachedTo); if (!h) return; const add = Math.max(0, pow(h)); h.tp += add; log(`${h.card.name}'s power is doubled (+${add}/+0) until end of turn.`); },
    rk5_hornet(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n <= 0) return; return applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Insect', kw: ['flying', 'deathtouch'] }, null, src); },
    rk5_destroyTarget(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) destroy(x, src.card.name); },
    rk5_koglaBounce(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid) || x.owner !== P.i) return;
        leaveBattlefield(x, 'hand'); log(`${x.card.name} returns to its owner's hand.`);
        if (onBf(src.uid)) { src.tkw.push('indestructible'); log(`${src.card.name} gains indestructible until end of turn.`); }
    },
    rk5_recruiter(P, e, t, src) { return rk5Search(P, c => /\bCreature\b/.test(c.card.type) && Number(c.card.toughness) <= 2, 'search for a creature card with toughness 2 or less', src); },
    rk5_trinket(P, e, t, src) { return rk5Search(P, c => /\bArtifact\b/.test(c.card.type) && (c.card.cmc || 0) <= 1, 'search for an artifact card with mana value 1 or less', src); },
    rk5_coiling(P, e, t, src) {
        const top = P.library[P.library.length - 1]; if (!top) return;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name}.`);
        pull(P.library, top);
        if (/\bLand\b/.test(top.card.type)) putOntoBattlefield(P, top); else { P.hand.push(top); log(`${top.card.name} is put into ${you(P) ? 'your' : P.name + "'s"} hand.`); }
    },
    async rk5_resto(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && !hasType(x, 'Angel') && !has(x, 'shroud'));
        if (!pool.length) return;
        const good = pool.filter(x => frEtbValue(x) >= 3).sort((a, b) => frEtbValue(b) - frEtbValue(a))[0];
        const x = rk5Human(P) ? await pickCard(P, pool, `${src.card.name}: exile a non-Angel creature you control, then return it? (Cancel to skip)`, { optional: true }) : good;
        if (x && onBf(x.uid)) await applyEffect(P, { t: 'flicker' }, { o: x }, src);
    },
    async rk5_eerie(P, e, t, src) {
        let pool = P.bf.filter(x => isCreature(x) && !has(x, 'shroud')); const chosen = [];
        if (rk5Human(P)) { for (let g = 0; g < 40; g++) { const left = pool.filter(x => !chosen.includes(x)); if (!left.length) break; const x = await pickCard(P, left, `${src.card.name}: exile a creature you control (Cancel when done)`, { optional: true }); if (!x) break; chosen.push(x); } }
        else pool.filter(x => !x.token && frEtbValue(x) >= 3).forEach(x => chosen.push(x));
        chosen.forEach(x => frBlinkPerm(P, x, {}));
        if (chosen.length) log(`${chosen.map(x => x.card.name).join(', ')} will return at the beginning of the next end step.`);
    },
    async rk5_edict(P, e, t, src) {
        const test = { nontoken: x => isCreature(x) && !x.token, token: x => isCreature(x) && x.token, planeswalker: x => isPlaneswalker(x) }[e.kind];
        for (const F of foes(P)) {
            const pool = F.bf.filter(test);
            if (!pool.length) { log(`${F.name} ${you(F) ? 'have' : 'has'} nothing to sacrifice.`); continue; }
            const x = await chooseFrom(F, pool, `${src.card.name}: sacrifice a ${e.kind === 'planeswalker' ? 'planeswalker' : e.kind === 'token' ? 'creature token' : 'nontoken creature'}`, false);
            if (x) sacPerm(F, x);
        }
    },
    async rk5_auraMutation(P, e, t, src) {
        const x = t && t.o; if (!x) return;
        const n = x.card.cmc || 0;
        if (onBf(x.uid)) destroy(x, src.card.name);
        if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Saproling', kw: [] }, null, src);
    },
    async rk5_obliterator(P, e, t, src) {
        const c = G.ctxRaw || {}, s = c.src, n = c.n || 0; if (!s || n <= 0 || s.owner === undefined) return;
        const X = G.players[s.owner]; if (!X || X.out) return;
        log(`${src.card.name}: ${X.name} must sacrifice ${n} permanent${n === 1 ? '' : 's'}.`);
        for (let i = 0; i < n; i++) {
            const pool = X.bf.slice(); if (!pool.length) break;
            const x = await chooseFrom(X, pool, `${src.card.name}: sacrifice a permanent (${n - i} left)`, false);
            if (x) sacPerm(X, x);
        }
    },
    async rk5_wrathfulDragon(P, e, t, src) {
        const c = G.ctxRaw || {}, d = c.o, n = c.n || 0; if (!d || n <= 0) return;
        const pick = await rk5AnyTarget(P, `${src.card.name}: deal ${n} damage to any target that isn't a Dragon`, n, d, x => !hasType(x, 'Dragon'));
        if (!pick) return;
        if (pick.p) { damage(pick.p, n, d); log(`${d.card.name} deals ${n} damage to ${pick.p.name}.`); }
        else if (pick.o && onBf(pick.o.uid)) { damage(pick.o, n, d); log(`${d.card.name} deals ${n} damage to ${pick.o.card.name}.`); }
    },
    async rk5_stubborn(P, e, t, src) {
        const it = t && t.item; if (!it || !G.stack.includes(it)) return;
        const fero = P.bf.some(x => isCreature(x) && pow(x) >= 4);
        return applyEffect(P, fero ? { t: 'counter' } : { t: 'counter', unless: 1 }, { item: it }, src);
    }
});
Object.assign(CMD_SCORE, {
    rk5_arsonist: () => 0, rk5_eerie: P => P.bf.some(x => !x.token && frEtbValue(x) >= 3) ? 4 : 0, rk5_edict: () => 6, rk5_auraMutation: () => 5
});
