// Spellslinger Duels - engine pieces for card round rk1 (2026-11-27). CMD ids start with rk1_. Wordings are in rules/rk1.js.
// ---- helpers ----
const rk1AI = P => P.isAI || AUTOPLAY;
const rk1Lose = (X, n) => { if (!(n > 0) || X.out) return; X.life -= n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); };
const rk1Lands = P => P.bf.filter(x => /\bLand\b/.test(x.card.type));
const rk1Tx = (P, you_, me, them) => (you(P) ? me : them);
// A person picks from a list (or "none" when optional); the computer takes the best by score
async function rk1Pick(P, pool, prompt, score, optional) {
    if (!pool.length) return null;
    if (rk1AI(P)) return pool.slice().sort((a, b) => score(b) - score(a))[0];
    return (await pickCard(P, pool, prompt, { required: !optional })) || (optional ? null : pool[0]);
}
// Move a card from where it is onto the battlefield (all the usual enters events happen)
function rk1PutBf(P, o, tapped) { putOntoBattlefield(P, o, tapped); return o; }
// A Role token (Wicked Role) attached to a creature
function rk1MakeRole(P, host) {
    const card = { id: `token-role-${uidSeq}`, name: 'Wicked Role', fullName: 'Wicked Role token', cost: '', cmc: 0, type: 'Token Enchantment — Aura Role', text: 'Enchant creature\nEnchanted creature gets +1/+1.', colors: ['B'], ci: ['B'], img: null, set: 'wot' };
    const tok = makeObj(card, P.i, { token: true }); P.bf.push(tok); tok.attachedTo = host.uid; tok.rk1Wicked = true;
    log(`${P.name} ${you(P) ? 'create' : 'creates'} a Wicked Role token attached to ${host.card.name}.`);
    fire('enters', { o: tok }); tokenMade(P);
    return tok;
}
// ---- Dauthi Voidwalker: cards that would go to an opponent's graveyard are exiled with a void counter ----
function rk1VoidApplies(o) {
    if (!G || !o || o.token) return false;
    const X = G.players[o.realOwner ?? o.owner]; if (!X) return false;
    return allPerms().some(a => Rx(a).rk1Void && !lostAbilities(a) && a.owner !== X.i);
}
function rk1VoidMark(o) {
    if (!o || !o.rk1VoidNext) return; o.rk1VoidNext = false;
    const X = G.players.find(p => p.exile.includes(o)); if (!X) return;
    o.ctr = o.ctr || {}; o.ctr.void = 1; o.rk1gy = true;
    log(`${o.card.name} is exiled with a void counter on it instead of going to ${X.name === 'You' ? 'your' : `${X.name}'s`} graveyard (Dauthi Voidwalker).`);
}
{
    const lb = leaveBattlefield;
    leaveBattlefield = function (o, zone) {
        if (G && o && o.card && zone === 'gy' && onBf(o.uid)) {
            if (rk1VoidApplies(o)) { o.rk1VoidNext = true; const r = lb.call(this, o, 'exile'); rk1VoidMark(o); return r; }
            // Wicked Role: when the Aura is put into a graveyard from the battlefield, each opponent loses 1 life
            if (o.rk1Wicked) { const X = G.players[o.owner]; (G.trigQ = G.trigQ || []).push({ P: X, o, effects: [{ t: 'cmd', id: 'rk1_wicked' }] }); }
        }
        return lb.apply(this, arguments);
    };
    const dol = dieOrLeave;
    dieOrLeave = function (o, zone) {
        if (G && o && o.card && zone === 'gy' && !o.token && onBf(o.uid) && rk1VoidApplies(o)) { zone = 'exile'; o.rk1VoidNext = true; const r = dol.call(this, o, zone); rk1VoidMark(o); return r; }
        const fx = G && o && o.card && zone === 'gy' && onBf(o.uid) && isCreature(o) && o.rk1DiesFx && o.rk1DiesFx.turn === G.turn ? o.rk1DiesFx : null;
        const r = dol.apply(this, arguments);
        if (fx && !o.token && G.players[o.owner].gy.includes(o)) (G.trigQ = G.trigQ || []).push({ P: G.players[o.owner], o, effects: [{ t: 'cmd', id: 'rk1_diesReturn', fx }] });
        return r;
    };
    const mc = moveSpellCard;
    moveSpellCard = function (o, zone) {
        if (G && zone === 'gy' && o && !o.token && rk1VoidApplies(o)) { o.rk1VoidNext = true; const r = mc.call(this, o, 'exile'); rk1VoidMark(o); return r; }
        return mc.apply(this, arguments);
    };
    // everything else that reaches a graveyard (discards, mill, ...) is caught by a sweep after state-based actions
    SV_SYNCS.push(function rk1VoidSync() {
        if (!G || !G.players) return;
        if (allPerms().some(a => Rx(a).rk1Void && !lostAbilities(a))) {
            G.players.forEach(X => X.gy.slice().forEach(c => { if (!c.rk1gy && !c.token && !c.isCommander && rk1VoidApplies(c)) { pull(X.gy, c); X.exile.push(c); c.rk1VoidNext = true; rk1VoidMark(c); } }));
        }
    });
    const f0 = fire;
    fire = function (ev, ctx) {
        if (ev === 'enters' && ctx && ctx.o && G && Rx(ctx.o).rk1Void) G.players.forEach(X => X.gy.forEach(c => { c.rk1gy = true; })); // what was already in graveyards stays there
        return f0.apply(this, arguments);
    };
}
// Stamp cards already in graveyards when a Voidwalker is not out, lazily, so only new arrivals count
// ---- Utopia Sprawl: the enchanted Forest adds one more mana of the chosen color ----
{
    const mo = manaOf;
    manaOf = function (o) {
        const m = mo.apply(this, arguments);
        if (!m || !G || !o || !o.uid || !/\bLand\b/.test(o.card.type)) return m;
        const a = allPerms().find(x => x.attachedTo === o.uid && Rx(x).rk1Sprawl && !lostAbilities(x));
        if (!a || !a.chosenColor || !m.colors) return m;
        const cols = [...new Set([...m.colors, a.chosenColor])];
        return { ...m, n: (m.n || 1) + 1, colors: cols, fixed: cols.length > 1 ? true : m.fixed, extra: [...(m.extra || []), a.chosenColor] };
    };
}
// ---- Realmwalker: creature spells of the chosen type from the top of the library ----
{
    const tc = topCastOk;
    topCastOk = function (P, o) {
        if (tc.apply(this, arguments)) return true;
        if (!o || Rx(o).kind !== 'creature' || P.library[P.library.length - 1] !== o) return false;
        return P.bf.some(x => Rx(x).rk1TopChosen && !lostAbilities(x) && x.chosenType && hasType(o, x.chosenType));
    };
}
// ---- Kaya's Ghostform: when the enchanted permanent dies or is exiled, it returns under the Aura's controller ----
{
    const lb2 = leaveBattlefield;
    leaveBattlefield = function (o, zone) {
        if (G && o && o.card && (zone === 'gy' || zone === 'exile') && !o.token && onBf(o.uid)) {
            const auras = allPerms().filter(a => a.attachedTo === o.uid && Rx(a).rk1Ghostform && !lostAbilities(a));
            if (auras.length) {
                const r = lb2.apply(this, arguments);
                auras.forEach(a => (G.trigQ = G.trigQ || []).push({ P: G.players[a.owner], o: a, effects: [{ t: 'cmd', id: 'rk1_ghostform' }], ctx: o }));
                return r;
            }
        }
        return lb2.apply(this, arguments);
    };
}
Object.assign(CMD, {
    // Nykthos: choose a color, add mana equal to devotion to it
    async rk1_nykthos(P, e, t, src) {
        const dev = c => devotion(P, [c]);
        let c;
        if (rk1AI(P)) c = COLORS.slice().sort((a, b) => dev(b) - dev(a))[0];
        else c = COLORS[await askMode(P, `${src.card.name}: choose a color (you add mana equal to your devotion to it)`, COLORS.map(k => `${COLOR_NAMES[k]} (devotion ${dev(k)})`))];
        const n = dev(c);
        P.pool = (P.pool || []).concat(Array(n).fill(c));
        log(`${P.name} ${you(P) ? 'choose' : 'chooses'} ${COLOR_NAMES[c]} and ${you(P) ? 'add' : 'adds'} ${'{' + c + '}'.repeat(1)}${n > 1 ? ' x' + n : ''} (devotion ${n}).`);
    },
    // Dauthi Voidwalker: play an exiled card with a void counter for free this turn
    async rk1_voidPlay(P, e, t, src) {
        const pool = foes(P).flatMap(X => X.exile.filter(c => c.ctr && c.ctr.void > 0 && !c.isCommander));
        const pick = await rk1Pick(P, pool, `${src.card.name}: choose an exiled card with a void counter (you may play it this turn without paying its mana cost)`, c => (c.card.cmc || 0) + (Rx(c).support === 'none' ? -50 : 0), true);
        if (!pick) { log(`${src.card.name}: no exiled card with a void counter.`); return; }
        const X = G.players.find(p => p.exile.includes(pick));
        pull(X.exile, pick); pick.realOwner = X.i; pick.owner = P.i; pick.freeCast = true; pick.playUntil = G.turn; pick.playAny = true; pick.rk1VoidBack = X.i; P.exile.push(pick);
        log(`${P.name} ${you(P) ? 'may' : 'may'} play ${pick.card.name} this turn without paying its mana cost.`);
        atEndStep(() => { if (P.exile.includes(pick) && pick.rk1VoidBack !== undefined) { const B = G.players[pick.rk1VoidBack]; pull(P.exile, pick); pick.owner = B.i; delete pick.realOwner; pick.freeCast = false; pick.playUntil = -1; B.exile.push(pick); log(`${pick.card.name} stays exiled.`); } }, null);
        if (rk1AI(P) && Rx(pick).kind !== 'land') await castFreeFrom(P, pick, undefined) || await castFreeAuto(P, pick);
    },
    // Liquimetal Torque: the permanent becomes an artifact until end of turn
    rk1_torque(P, e, t, src) {
        const o = t && t.o; if (!o || !onBf(o.uid)) return;
        if (/\bArtifact\b/.test(o.card.type)) { log(`${o.card.name} is already an artifact.`); return; }
        if (!o.dcCardBack) o.dcCardBack = o.card;
        o.card = { ...o.card, type: o.card.type.replace(/^((?:Token |Legendary |Basic |Snow )*)/, '$1Artifact ') };
        log(`${o.card.name} becomes an artifact in addition to its other types until end of turn.`);
    },
    // Thespian's Stage: becomes a copy of the target land, except it has this ability
    rk1_stage(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(src.uid) || x === src) return;
        const line = '{2}, {T}: ~ becomes a copy of target land, except it has this ability.';
        const base = src.copyOf || src.card; src.copyOf = src.copyOf || src.card; delete src.copyTurn;
        const nc = { ...x.card, id: `${x.card.id}-stage${uidSeq++}`, text: (x.card.text ? x.card.text + '\n' : '') + line };
        delete nc._r; src.card = nc; src.rk1StageBase = base;
        log(`${base.name} becomes a copy of ${x.card.name}, except it has this ability.`);
    },
    // Kaya's Ghostform: return the card to the battlefield under the Aura's controller
    async rk1_ghostform(P, e, t, src) {
        const x = G.ctxObj; if (!x || x.token) return;
        const from = G.players.find(X => X.gy.includes(x) || X.exile.includes(x)); if (!from) return;
        const zone = from.gy.includes(x) ? 'gy' : 'exile';
        pull(from[zone], x); resetObj(x); if (from !== P) { x.realOwner = x.owner; x.owner = P.i; }
        x.enteredTurn = G.turn; P.bf.push(x);
        log(`${x.card.name} returns to the battlefield under ${you(P) ? 'your' : `${P.name}'s`} control (Kaya's Ghostform).`);
        fire('enters', { o: x }); if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: x, effects: Rx(x).etb });
    },
    // Stoneforge Mystic
    async rk1_stoneforge(P, e, t, src) {
        const pool = P.hand.filter(c => /\bEquipment\b/.test(c.card.type));
        const x = await rk1Pick(P, pool, `${src.card.name}: put an Equipment card from your hand onto the battlefield (or none)`, c => c.card.cmc || 0, true);
        if (!x) return;
        rk1PutBf(P, x, false);
    },
    // Not Dead After All, Fake Your Own Death
    rk1_returnDies(P, e, t, src) {
        const o = t && t.o; if (!o || !onBf(o.uid)) return;
        if (e.pump) o.tp += e.pump;
        o.rk1DiesFx = { turn: G.turn, role: !!e.role, treasure: !!e.treasure, by: P.i };
        log(`${o.card.name} ${e.pump ? `gets +${e.pump}/+0 and ` : ''}gains "When this creature dies, return it to the battlefield tapped" until end of turn.`);
    },
    async rk1_diesReturn(P, e, t, src) {
        const x = src, fx = e.fx || x.rk1DiesFx; if (!x || !fx) return;
        const Q = G.players[x.owner]; if (!Q.gy.includes(x)) return;
        pull(Q.gy, x); resetObj(x); x.enteredTurn = G.turn; x.tapped = true; Q.bf.push(x);
        log(`${x.card.name} returns to the battlefield tapped.`);
        fire('enters', { o: x }); if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P: Q, o: x, effects: Rx(x).etb });
        if (fx.role) rk1MakeRole(Q, x);
        if (fx.treasure) { const C = G.players[fx.by]; await applyEffect(C, { t: 'artToken', kind: 'treasure', n: 1 }, null, x); }
    },
    rk1_wicked(P, e, t, src) { foes(P).forEach(F => rk1Lose(F, 1)); log(`Wicked Role: each opponent loses 1 life.`); }
});
Object.assign(CMD_SCORE, { rk1_nykthos: () => 0, rk1_voidPlay: () => 5, rk1_torque: () => 0, rk1_stage: () => 0, rk1_stoneforge: P => P.hand.some(c => /\bEquipment\b/.test(c.card.type)) ? 6 : 0, rk1_returnDies: () => 4 });
// ===== Batch 2 =====
// ---- extra trigger filters and conditions ----
Object.assign(TRIG_FN, {
    rk1MoraugLand: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && G.active === o.owner && ['main1', 'main2'].includes(G.phase),
    rk1MoraugComb: (o, ctx) => G.active === o.owner && G.extraCombatOn === true && (G.rk1UntapNext || 0) > 0,
    rk1HostAttacksFirst: (o, ctx) => G.extraCombatOn !== true && (ctx.list || []).some(x => x.uid === o.attachedTo),
    rk1MilledLands: (o, ctx) => { const ok = !!ctx.P && ctx.P.i === o.owner && (ctx.cards || []).some(c => /\bLand\b/.test(c.card.type)); if (ok) o.rk1Milled = (ctx.cards || []).slice(); return ok; },
    rk1OppEnd: (o, ctx) => G.active !== o.owner
});
COND_EXTRA.push(
    [/^the active player controls more creatures than you$/, () => P => { const A = G.players[G.active]; return A !== P && A.bf.filter(isCreature).length > P.bf.filter(isCreature).length; }],
    [/^the active player controls more lands than you$/, () => P => { const A = G.players[G.active]; return A !== P && rk1Lands(A).length > rk1Lands(P).length; }]
);
// ---- Archway of Innovation: the next spell you cast this turn has improvise ----
{
    const pp = planPayment;
    planPayment = function (P, cost, extra, exclude, opts) {
        if (G && P && P.rk1Improv === G.turn && opts && opts.spellKind && !opts.improvise) opts = { ...opts, improvise: true };
        return pp.call(this, P, cost, extra, exclude, opts);
    };
    const f1 = fire;
    fire = function (ev, ctx) {
        if (ev === 'cast' && ctx && ctx.P && ctx.P.rk1Improv === G.turn) ctx.P.rk1Improv = 0;
        // Moraug: count each attack
        if (ev === 'attacks' && ctx && ctx.list) ctx.list.forEach(x => { x.rk1Atk = x.rk1Atk && x.rk1Atk.turn === G.turn ? { turn: G.turn, n: x.rk1Atk.n + 1 } : { turn: G.turn, n: 1 }; });
        return f1.apply(this, arguments);
    };
    const sb = staticBuffs;
    staticBuffs = function (o) {
        const b = sb.apply(this, arguments);
        if (!G || !o || !o.card || !isCreature(o) || !o.rk1Atk || o.rk1Atk.turn !== G.turn) return b;
        const k = G.players[o.owner].bf.filter(a => Rx(a).rk1Moraug && !lostAbilities(a)).length;
        if (k) b.p += o.rk1Atk.n * k;
        return b;
    };
}
// ---- K'rrik: pay 2 life instead of {B} ----
{
    const pp = planPayment;
    planPayment = function (P, cost, extra, exclude, opts) {
        const r = pp.apply(this, arguments);
        if (r || !G || !P || !cost || !(cost.B > 0) || (opts && opts.poolOnly) || !P.bf.some(a => Rx(a).rk1Krrik && !lostAbilities(a))) return r;
        for (let k = 1; k <= cost.B; k++) {
            if (P.life <= 2 * k) break;
            const r2 = pp.call(this, P, { ...cost, B: cost.B - k }, extra, exclude, opts);
            if (r2) return [...r2, { pool: true, rk1Life: 2 * k, color: 'B!life' }];
        }
        return r;
    };
    const ts = tapSource;
    tapSource = function (P, s) {
        if (s && s.rk1Life) { P.life -= s.rk1Life; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${s.rk1Life} life rather than pay {B}${s.rk1Life > 2 ? ' x' + s.rk1Life / 2 : ''} (K'rrik).`); fire('loseLife', { P, n: s.rk1Life }); return; }
        return ts.apply(this, arguments);
    };
}
// ---- Skrelv: hexproof from a color, toxic 1, can't be blocked by creatures of that color ----
{
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const out = vt.apply(this, arguments);
        if (!src || !src.card) return out;
        const cols = src.card.colors || [];
        return out.filter(v => !(v.o && v.o.rk1HexFrom && v.o.rk1HexFrom.turn === G.turn && v.o.owner !== P.i && cols.includes(v.o.rk1HexFrom.color)));
    };
    const cb = canBlock;
    canBlock = function (b, atk) {
        if (G && atk && atk.rk1NoBlk && atk.rk1NoBlk.turn === G.turn) {
            const nb = atk.rk1NoBlk;
            if (nb.color && (b.card.colors || []).includes(nb.color)) return false;
            if (nb.player !== undefined && b.owner === nb.player) return false;
        }
        return cb.apply(this, arguments);
    };
    const f2 = fire;
    fire = function (ev, ctx) {
        if (ev === 'hitPlayer' && ctx && ctx.src && ctx.src.rk1Toxic === G.turn) (ctx.hit || []).forEach(H => { if (H && H.life !== undefined) { H.poison = (H.poison || 0) + 1; log(`${ctx.src.card.name}: toxic 1 (${H.name} ${you(H) ? 'have' : 'has'} ${H.poison} poison).`); } });
        return f2.apply(this, arguments);
    };
}
// ---- Tarrian's Soulcleaver: other artifacts and creatures going to a graveyard feed the equipped creature; Ulamog shuffles graveyards in ----
{
    const lb3 = leaveBattlefield;
    leaveBattlefield = function (o, zone) {
        if (G && o && o.card && zone === 'gy' && onBf(o.uid) && (isCreature(o) || /\bArtifact\b/.test(o.card.type))) {
            allPerms().forEach(a => { if (a !== o && Rx(a).rk1Cleaver && !lostAbilities(a) && a.attachedTo && onBf(a.attachedTo) && a.attachedTo !== o.uid) (G.trigQ = G.trigQ || []).push({ P: G.players[a.owner], o: a, effects: [cmd('rk1_cleaverCtr')] }); });
        }
        return lb3.apply(this, arguments);
    };
    SV_SYNCS.push(function rk1UlamogSync() {
        if (!G || !G.players) return;
        const now = new Set(); const fresh = [];
        G.players.forEach(X => X.gy.forEach(c => { if (Rx(c).rk1Ulamog) { now.add(c.uid); if (!(G.rk1UlSeen || new Set()).has(c.uid)) fresh.push([X, c]); } }));
        G.rk1UlSeen = now;
        fresh.forEach(([X, c]) => (G.trigQ = G.trigQ || []).push({ P: G.players[c.owner], o: c, effects: [cmd('rk1_ulamogShuffle')] }));
    });
}
Object.assign(CMD, {
    // add mana for each thing you control / have
    rk1_manaPer(P, e, t, src) {
        let n = 0;
        if (e.what === 'creature') n = P.bf.filter(isCreature).length;
        else if (e.what === 'artifact') n = P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length;
        else if (e.what === 'blackCreatureGy') n = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.colors || []).includes('B')).length;
        P.pool = (P.pool || []).concat(Array(n).fill(e.color));
        log(`${P.name} ${you(P) ? 'add' : 'adds'} ${n} {${e.color}}.`);
    },
    rk1_improvNext(P) { P.rk1Improv = G.turn; log(`The next spell ${P.name} ${you(P) ? 'cast' : 'casts'} this turn has improvise.`); },
    rk1_moraugExtra(P, e, t, src) { G.extraCombat = (G.extraCombat || 0) + 1; G.rk1UntapNext = (G.rk1UntapNext || 0) + 1; log(`There will be an additional combat phase after this phase (${src.card.name}).`); },
    rk1_moraugUntap(P, e, t, src) { G.rk1UntapNext = Math.max(0, (G.rk1UntapNext || 0) - 1); const ts = P.bf.filter(x => isCreature(x) && x.tapped); ts.forEach(x => { x.tapped = false; }); log(`${P.name} untap${you(P) ? '' : 's'} all creatures (${src.card.name}).`); },
    rk1_genji(P, e, t, src) {
        const h = onBf(src.attachedTo); if (h) h.tapped = false;
        G.extraCombat = (G.extraCombat || 0) + 1;
        log(`${h ? h.card.name : 'The equipped creature'} untaps; there will be an additional combat phase after this one (${src.card.name}).`);
    },
    async rk1_skrelv(P, e, t, src) {
        const o = t && t.o; if (!o || !onBf(o.uid)) return;
        const cnt = {}; allPerms().forEach(x => { if (x.owner !== P.i && isCreature(x)) (x.card.colors || []).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }); });
        let c;
        if (rk1AI(P)) c = COLORS.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0];
        else c = COLORS[await askMode(P, `${src.card.name}: choose a color`, COLORS.map(k => COLOR_NAMES[k]))];
        o.rk1Toxic = G.turn; o.rk1HexFrom = { turn: G.turn, color: c }; o.rk1NoBlk = { turn: G.turn, color: c };
        log(`${o.card.name} gains toxic 1 and hexproof from ${COLOR_NAMES[c]} until end of turn, and can't be blocked by ${COLOR_NAMES[c]} creatures.`);
    },
    async rk1_blackGate(P, e, t, src) {
        const o = t && t.o; if (!o || !onBf(o.uid)) return;
        const live = G.players.filter(X => !X.out); const top = Math.max(...live.map(X => X.life));
        const pool = live.filter(X => X.life === top);
        let X = pool[0];
        if (pool.length > 1) { if (rk1AI(P)) X = pool.find(p => p !== P) || pool[0]; else { const i = await askMode(P, `${src.card.name}: choose a player with the most life`, pool.map(p => `${p.name} (${p.life} life)`)); X = pool[i]; } }
        o.rk1NoBlk = { turn: G.turn, player: X.i };
        log(`${o.card.name} can't be blocked by creatures ${X.name === 'You' ? 'you control' : X.name + ' controls'} this turn.`);
    },
    rk1_cleaverCtr(P, e, t, src) { const h = onBf(src.attachedTo); if (h && isCreature(h)) { const got = putCounters(h, 1, P); log(`${h.card.name} gets ${got} +1/+1 counter (${src.card.name}).`); } },
    rk1_untapCtx(P, e, t, src) { const x = G.ctxObj; if (x && onBf(x.uid) && x.tapped) { x.tapped = false; log(`${x.card.name} untaps (${src.card.name}).`); } },
    rk1_shredder(P, e, t, src) {
        const cards = (src.rk1Milled || []).filter(c => /\bLand\b/.test(c.card.type) && P.gy.includes(c));
        cards.forEach(c => { putOntoBattlefield(P, c, true); });
        if (cards.length) log(`${cards.map(c => c.card.name).join(', ')} enter${cards.length === 1 ? 's' : ''} the battlefield tapped (${src.card.name}).`);
    },
    async rk1_keeperLand(P, e, t, src) {
        const pool = P.library.filter(c => /\bPlains\b/.test(c.card.type) && /\bBasic\b/.test(c.card.type));
        const yes = pool.length && (rk1AI(P) || await askYes(P, `${src.card.name}: search for a basic Plains?`, { card: src.card }));
        if (!yes) return;
        const c = pool[0]; putOntoBattlefield(P, c, true); shuffle(P.library);
        log(`${P.name} ${you(P) ? 'search' : 'searches'} for a basic Plains and ${you(P) ? 'put' : 'puts'} it onto the battlefield tapped.`);
    },
    async rk1_palantir(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.ctr.influence = (src.ctr.influence || 0) + 1; const X = src.ctr.influence;
        log(`${src.card.name} gets an influence counter (${X}).`);
        await applyEffect(P, { t: 'scry', n: 2 }, null, src);
        const opps = foes(P); if (!opps.length) return;
        let Q = opps.slice().sort((a, b) => a.life - b.life)[0];
        if (!rk1AI(P) && opps.length > 1) { const i = await askMode(P, `${src.card.name}: choose a target opponent`, opps.map(p => `${p.name} (${p.life} life)`)); Q = opps[i]; }
        const letDraw = Q.isAI || AUTOPLAY ? Q.life <= X * 2.2 * 2 || P.library.length <= X : await askYes(Q, `${src.card.name}: let ${P.name === 'You' ? 'them' : P.name} draw a card? (Otherwise they mill ${X} and you lose life equal to the total mana value)`, { card: src.card, yes: 'Let them draw', no: 'No: they mill' });
        if (letDraw) { drawCards(P, 1); log(`${Q.name} ${you(Q) ? 'let' : 'lets'} ${P.name} draw a card.`); return; }
        const milled = doMill(P, X); const mv = milled.reduce((a, c) => a + (c.card.cmc || 0), 0);
        if (mv > 0) { Q.life -= mv; log(`${Q.name} ${you(Q) ? 'lose' : 'loses'} ${mv} life (${src.card.name}).`); fire('loseLife', { P: Q, n: mv }); }
    },
    async rk1_carpet(P, e, t, src) {
        const opps = foes(P); if (!opps.length) return;
        const isl = X => X.bf.filter(x => hasType(x, 'Island')).length;
        let Q = opps.slice().sort((a, b) => isl(b) - isl(a))[0];
        if (!rk1AI(P) && opps.length > 1) { const i = await askMode(P, `${src.card.name}: choose a target opponent (Islands)`, opps.map(p => `${p.name} (${isl(p)} Islands)`)); Q = opps[i]; }
        const n = isl(Q); if (n <= 0) return;
        let c;
        if (rk1AI(P)) { const cnt = {}; P.hand.forEach(h => COLORS.forEach(k => { cnt[k] = (cnt[k] || 0) + (Rx(h).cost[k] || 0); })); c = COLORS.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0]; }
        else { if (!(await askYes(P, `${src.card.name}: add ${n} mana of one color?`, { card: src.card }))) return; c = COLORS[await askMode(P, `${src.card.name}: choose a color for ${n} mana`, COLORS.map(k => COLOR_NAMES[k]))]; }
        P.pool = (P.pool || []).concat(Array(n).fill(c));
        log(`${P.name} ${you(P) ? 'add' : 'adds'} ${n} {${c}} (${src.card.name}).`);
    },
    rk1_ulamogShuffle(P, e, t, src) {
        const X = G.players[src.owner]; const n = X.gy.length; if (!n) return;
        X.library.push(...X.gy.splice(0)); shuffle(X.library);
        log(`${X.name} shuffle${you(X) ? '' : 's'} ${you(X) ? 'your' : 'their'} graveyard into ${you(X) ? 'your' : 'their'} library (${src.card.name}).`);
        fire('shuffled', { P: X });
    }
});
Object.assign(CMD_SCORE, { rk1_manaPer: () => 0, rk1_improvNext: () => 0, rk1_moraugExtra: () => 0, rk1_genji: () => 0, rk1_skrelv: () => 3, rk1_blackGate: () => 3, rk1_palantir: () => 0, rk1_carpet: () => 0 });
