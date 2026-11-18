// Spellslinger Duels - activated mana abilities count as mana sources (2026-11-18, owner: "anything that taps for mana is a mana ability and should be usable
// when paying for a spell ... Doc Samson I have to tap before hand, Empowered Autogenerator is also not reading").
// The card reader turns plain "{T}: Add {G}" lines into R.mana, which is what planPayment, manual tapping and the computer's mana count read. Lines whose amount
// depends on something ("{T}: Add X mana of any one color, where X is ~'s power", "{T}: Put a charge counter on ~. Add X mana of any one color, where X is the
// number of charge counters") were read as ordinary activated abilities, so they were never offered while paying and the player had to activate them first.
// Here they are described as mana sources too (manaOf), and tapping one in a payment does what the ability does besides the mana (tapSource).
// Eligible: the cost is only {T} (and life); no target; the effects are one addMana plus counters put on the card itself; no timing or condition limits.

const MA_STATIC = new WeakMap();
const MA_COST_KEYS = ['mana', 'tap', 'sacSelf', 'life', 'discard', 'mill', 'removeNamed', 'tapOther', 'sacPerm', 'exileSelf', 'discardHand'];
const MA_SIDE = ['namedCounter', 'gain', 'dmgYou', 'millSelf', 'roll', 'draw', 'scry', 'delayedDraw'];
function maStaticAct(o) {
    const R = Rx(o), acts = R.acts;
    if (!acts || !acts.length) return null;
    if (MA_STATIC.has(acts)) return MA_STATIC.get(acts);
    let found = null;
    for (const a of acts) {
        const c = a.cost || {}, eff = a.effects || [];
        if (!c.tap || c.discard || (c.mana && (c.mana.generic || c.mana.x || ['W', 'U', 'B', 'R', 'G', 'C'].some(k => c.mana[k])))) continue;
        if (Object.keys(c).some(k => c[k] && !MA_COST_KEYS.includes(k))) continue;
        if (a.sorcery || a.loyalty !== undefined || a.upkeepOnly || a.yourTurn || a.stationMin || a.once || a.onceEver || a.maxTurn || a.manaLike || a.lessIf) continue;
        const adds = eff.filter(e => e.t === 'addMana');
        if (adds.length !== 1 || eff.some(e => e.t !== 'addMana' && !(MA_SIDE.includes(e.t) && !e.target && !(e.t === 'namedCounter' && !e.kind)))) continue;
        const e = adds[0];
        if (e.opts || e.fromN || e.limit || e.any === 'X') continue;
        found = a; break;
    }
    MA_STATIC.set(acts, found);
    return found;
}
// What the ability would make right now: { colors, n, fixed, maAct, ... } or null (a condition fails, a cost can't be paid, or it makes nothing)
function manaActOf(o) {
    try {
        if (!G || !o || !o.uid || lostAbilities(o)) return null;
        const a = maStaticAct(o); if (!a) return null;
        const P = G.players[o.owner], c = a.cost, e = a.effects.find(x => x.t === 'addMana');
        if (a.onlyIf && !condOk(a.onlyIf, P, o)) return null;
        if (c.mill && P.library.length < c.mill) return null;
        if (c.removeNamed && !((o.ctr[c.removeNamed] || 0) > 0)) return null;
        if (c.tapOther && !tapFodder(P, o, c.tapOther)) return null;
        if (c.sacPerm && !sacFodder(P, o, c.sacPerm)) return null;
        let colors = COLORS.slice(), fixed = false, n = 0;
        // counters the ability puts on itself first (Empowered Autogenerator's charge counter), with the replacement effects that change them
        const side = a.effects.filter(x => x.t === 'namedCounter').map(x => ({ kind: x.kind, n: x.n + (typeof counterExtra === 'function' ? counterExtra(o, x.n, x.kind) : 0) }));
        const removed = c.removeNamed ? 1 : 0; // a counter removed as a cost (Sphere of the Suns) is gone before "the number of counters" is counted
        if (e.anyPow) n = Math.max(0, pow(o));
        else if (e.nCount) { n = countFn(e.nCount)(o); const m = String(e.nCount).match(/(\w+) counters?/); if (m) { side.filter(s => s.kind === m[1]).forEach(s => { n += s.n; }); if (c.removeNamed === m[1]) n -= removed; } }
        else if (e.anyN) n = Math.max(0, e.n || 0);
        else if (e.any) { n = e.any; if (e.identity) { const id = cmdrIdentity(P).filter(x => COLORS.includes(x)); if (id.length) colors = id; } }
        else if (e.choice) { n = 1; colors = e.choice.filter(x => COLORS.includes(x)); fixed = false; }
        else if (e.mana) { n = e.mana.length; colors = [...new Set(e.mana.map(x => x[0]))]; fixed = colors.length > 1; }
        else if (e.count && e.color) { n = countFn(e.count)(o); colors = [e.color]; fixed = true; if (/counters?/.test(e.count)) { const m2 = String(e.count).match(/(\w+) counters?/); if (m2 && c.removeNamed === m2[1]) n -= removed; } }
        else return null;
        if (!(n > 0) || !colors.length) return null;
        const d = { colors, n, fixed, maAct: a };
        if (e.only) d.only = e.only;
        if (e.rider) d.rider = e.rider;
        if (c.life) d.life = c.life;
        if (c.sacSelf) d.sac = true;
        return d;
    } catch (err) { return null; }
}
// Tapping such a source in a payment does the rest of the ability too: its other costs, then its other effects (counters, life, mill...)
function maOtherCosts(P, s, a, pre) {
    const c = a.cost;
    if (c.tapOther) { const x = (pre && pre.tapOther && onBf(pre.tapOther.uid) && !pre.tapOther.tapped) ? pre.tapOther : tapFodder(P, s, c.tapOther); if (x) { x.tapped = true; fire('tapped', { o: x }); log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${x.card.name} for ${s.card.name}.`); } }
    if (c.sacPerm) { const x = (pre && pre.sac && onBf(pre.sac.uid)) ? pre.sac : sacFodder(P, s, c.sacPerm); if (x) { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${x.card.name}.`); fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); } }
    if (c.mill) doMill(P, c.mill);
    if (c.removeNamed) { s.ctr[c.removeNamed]--; log(`A ${c.removeNamed} counter is removed from ${s.card.name}.`); }
    if (c.discardHand) { const n = P.hand.length; P.hand.forEach(x => { x.discardTurn = G.turn; }); P.gy.push(...P.hand.splice(0)); noteDiscard(P, n); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${n === 1 ? 'a card' : `${n} cards`} (the whole hand).`); }
}
{
    const base = manaOf;
    manaOf = function (o) {
        const m = base.apply(this, arguments);
        return m || manaActOf(o);
    };
    const tap = tapSource;
    tapSource = function (P, s) {
        const m = s && !s.pool && !s.tapped && !Rx(s).mana ? manaActOf(s) : null;
        if (m && m.maAct) {
            const pre = s._maChoice; s._maChoice = null;
            maOtherCosts(P, s, m.maAct, pre);
            const r = tap.apply(this, arguments);
            const a = m.maAct;
            if (a.cost.exileSelf && onBf(s.uid)) { log(`${s.card.name} is exiled for mana.`); leaveBattlefield(s, 'exile'); }
            a.effects.filter(x => x.t === 'namedCounter').forEach(x => { if (!onBf(s.uid)) return; const k = addNamedCounter(s, x.kind, x.n); log(`${s.card.name} gets ${k} ${x.kind} counter${k === 1 ? '' : 's'}.`); });
            const rest = a.effects.filter(x => x.t !== 'addMana' && x.t !== 'namedCounter');
            if (rest.length) Promise.resolve(resolveEffects(P, rest, null, s)).catch(() => {});
            return r;
        }
        return tap.apply(this, arguments);
    };
    // By hand, a person chooses what is sacrificed or tapped for the cost (the automatic payment takes the least valuable)
    const byHand = tapForMana;
    tapForMana = function (uid, color) {
        const P = me(), o = onBf(uid);
        const m = o && !Rx(o).mana ? manaActOf(o) : null;
        if (!m || !m.maAct || P.isAI || !(m.maAct.cost.sacPerm || m.maAct.cost.tapOther)) return byHand.apply(this, arguments);
        const c = m.maAct.cost, args = arguments;
        (async () => {
            const pre = {};
            if (c.sacPerm) { const pool = sacCandidates(P, o, c.sacPerm); if (pool.length > 1) pre.sac = await pickCard(P, pool, `${o.card.name}: choose what to sacrifice`, { required: true }); }
            if (c.tapOther) { const pool = P.bf.filter(x => !x.tapped && x !== o && (/^[A-Z]/.test(c.tapOther) ? hasType(x, c.tapOther) : c.tapOther === 'artifact' ? /\bArtifact\b/.test(x.card.type) : isCreature(x))); if (pool.length > 1) pre.tapOther = await pickCard(P, pool, `${o.card.name}: choose what to tap`, { required: true }); }
            o._maChoice = pre;
            byHand.apply(this, args);
        })();
    };
}
