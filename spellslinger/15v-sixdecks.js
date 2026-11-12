// Spellslinger Duels - engine pieces for six owner decks (2026-11-12): Super-Skrull, Aurelia, the Law Above, Doc Samson, Plargg and Nassari,
// Rukarumel, Biologist and Astarion, the Decadent. Wordings: rules/sixdecks.js. CMD ids start with sx_.
// Approximations (nothing is marked Partly) are listed above each piece and in CLAUDE.md.

const sxHost = o => (o && o.attachedTo ? onBf(o.attachedTo) : null);
const sxSays = (P, s, t) => (you(P) ? s : t);
const sxAI = P => P.isAI || AUTOPLAY;
const sxLand = c => /\bLand\b/.test(c.card.type);
const sxPerm = c => !['instant', 'sorcery'].includes(Rx(c).kind);
const sxPool = (P, cols) => { P.pool = (P.pool || []).concat(cols); log(`${P.name} ${sxSays(P, 'add', 'adds')} ${cols.map(c => `{${c}}`).join('')} (until the step ends).`); };
const sxBestColor = P => (typeof bestPoolColor === 'function' ? bestPoolColor(P) : 'C') || 'C';
// Cards that reached a graveyard from the battlefield this turn (Wreck Hunter, Continue?)
{
    const base = leaveBattlefield;
    leaveBattlefield = function (o, zone) { if (o && G) o.sx_leftBf = G.turn; return base.apply(this, arguments); };
}
const sxFromBfThisTurn = c => c.sx_leftBf === G.turn || c.diedAtTurn === G.turn;

TRIG_FN.sx_any = () => true;
TRIG_FN.sx_myBlock = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner);
TRIG_FN.sx_atkN = (o, ctx, tr) => (ctx.list || []).length >= (tr.n || 3);
TRIG_FN.sx_mine3 = (o, ctx) => (ctx.list || []).filter(x => x.owner === o.owner).length >= 3;
TRIG_FN.sx_hostActive = o => o.hostPlayer !== undefined && G.active === o.hostPlayer;
TRIG_FN.sx_otherCreatureEnters = (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o);

COND_EXTRA.push(
    [/^sx: ~ has a storage counter$/, () => (P, o) => !!o && ((o.ctr && o.ctr.storage) || 0) > 0],
    [/^sx: ~ has two \+1\/\+1 counters$/, () => (P, o) => !!o && o.counters >= 2],
    [/^sx: your turn, host tapped, once$/, () => (P, o) => !!o && G.active === P.i && !!sxHost(o) && sxHost(o).tapped && o.sx_onceA !== G.turn],
    [/^sx: host white and untapped, once$/, () => (P, o) => !!o && !!sxHost(o) && !sxHost(o).tapped && (sxHost(o).card.colors || []).includes('W') && o.sx_onceB !== G.turn],
    [/^sx: host untapped$/, () => (P, o) => !!o && !!sxHost(o) && !sxHost(o).tapped && (!isCreature(sxHost(o)) || !sxHost(o).sick || has(sxHost(o), 'haste'))],
    [/^sx: host tapped$/, () => (P, o) => !!o && !!sxHost(o) && sxHost(o).tapped],
    [/^sx: has host$/, () => (P, o) => !!o && !!sxHost(o)]
);

// ---------- Activated abilities cost {2} less (Biomancer's Familiar, Training Grounds: creatures; Zirda: every non-mana ability) ----------
{
    const base = actCost;
    actCost = function (o, a) {
        const m = base.apply(this, arguments);
        if (!G || a.mana) return m;
        const X = G.players[ctrl(o) ? ctrl(o).i : o.owner]; if (!X) return m;
        let cut = 0;
        X.bf.forEach(s => { const r = Rx(s).sx_actLess; if (r && !lostAbilities(s) && (!r.creatures || isCreature(o))) cut += r.n; });
        if (!cut) return m;
        const total = ['W', 'U', 'B', 'R', 'G', 'C'].reduce((n, k) => n + (m[k] || 0), 0) + (m.generic || 0);
        if (total <= 1) return m;
        const coloured = total - (m.generic || 0);
        const gen = Math.max(coloured >= 1 ? 0 : 1, (m.generic || 0) - cut);
        return { ...m, generic: gen };
    };
}
// ---------- Doran: creature spells with toughness greater than power cost {1} less ----------
{
    const base = spellFits;
    spellFits = function (o, rd, from) {
        if (rd && rd.what === 'sx_toughGtPow') return Rx(o).kind === 'creature' && (Number(o.card.toughness) || 0) > (Number(o.card.power) || 0);
        return base.apply(this, arguments);
    };
}
// ---------- High Alert / The Kingpin of Crime: toughness as combat damage; defenders attack ----------
function sxToughDmg(o) {
    if (!G || !isCreature(o)) return false;
    const X = ctrl(o); if (!X) return false;
    if (X.bf.some(s => Rx(s).sx_toughDmg && !lostAbilities(s))) return true;
    return X.sx_toughTurn === G.turn && tou(o) > pow(o);
}
function sxDefAttack(o) {
    if (!G) return false;
    if (Rx(o).sx_monsterAttack && o.monstrous) return true; // Colossus of Akros
    const X = ctrl(o); return !!X && X.bf.some(s => Rx(s).sx_defAttack && !lostAbilities(s));
}
// ---------- Dynamic sizes: Anya, Elenda; Sword of the Paruns ----------
const sxHalfLife = X => X.life < (X.startLife || (G.players.length > 2 || G.format === 'commander' ? 40 : 20)) / 2;
{
    const base = staticBuffs;
    staticBuffs = function (o) {
        const b = base.apply(this, arguments);
        if (!G || !isCreature(o)) return b;
        const X = ctrl(o); if (!X) return b;
        const r = Rx(o);
        if (r.sx_dyn && !lostAbilities(o)) {
            if (r.sx_dyn === 'anya') { const k = foes(X).filter(sxHalfLife).length; b.p += 3 * k; b.q += 3 * k; if (k) b.kw.push('indestructible'); }
            if (r.sx_dyn === 'elenda') { const start = X.startLife || 40; if (X.life > start) { b.p += 1; b.q += 1; b.kw.push('menace'); } if (X.life >= start + 10) { b.p += 5; b.q += 5; } }
        }
        permsBy('sxParuns', a => !!Rx(a).sx_paruns).forEach(s => {
            if (ctrl(s) !== X || lostAbilities(s)) return;
            const h = sxHost(s); if (!h) return;
            if (h.tapped && o.tapped) b.p += 2;
            if (!h.tapped && !o.tapped) b.q += 2;
        });
        return b;
    };
}
// ---------- Gisela: double damage to opponents and their permanents, prevent half to you and yours ----------
{
    const base = damage;
    damage = function (target, n, src) {
        if (G && n > 0 && target) {
            const gis = permsBy('sxGisela', a => !!Rx(a).sx_gisela);
            const victim = gis.length ? (target.life !== undefined ? target : ctrl(target)) : null;
            if (victim) G.players.forEach(X => {
                if (X.out) return;
                gis.filter(s => ctrl(s) === X && !lostAbilities(s)).forEach(() => {
                    if (victim === X) n = Math.floor(n / 2);
                    else n = n * 2;
                });
            });
        }
        return base.call(this, target, n, src);
    };
}
// ---------- Basandra: no spells during combat ----------
{
    const base = canCastNow;
    canCastNow = function (P, o) {
        if (G && ['declareAttackers', 'declareBlocks', 'afterBlocks', 'combatDamage', 'combat'].includes(G.phase) && allPerms().some(s => Rx(s).sx_noCombatCast && !lostAbilities(s))) return false;
        return base.apply(this, arguments);
    };
}
// ---------- Hydra Broodmaster: X X/X Hydras when it becomes monstrous ----------
{
    const base = applyEffect;
    applyEffect = async function (P, e, t, src) {
        const was = src && src.monstrous;
        const r = await base.apply(this, arguments);
        if (e && e.t === 'monstrosity' && src && !was && src.monstrous && Rx(src).sx_broodmaster && !lostAbilities(src)) {
            const x = e.n || 0;
            if (x > 0) await base.call(this, P, { t: 'token', n: x, p: x, q: x, name: 'green Hydra', kw: [] }, null, src);
        }
        return r;
    };
}

Object.assign(CMD, {
    // ===== Super-Skrull deck =====
    sx_freshAdapt(P, e, t) { if (t && t.o) { t.o.sx_freshAdapt = G.turn; log(`The next time ${t.o.card.name} adapts this turn, it adapts as though it had no +1/+1 counters.`); } },
    sx_blightPile(P, e, t, src) {
        const x = P.bf.filter(c => isCreature(c) && has(c, 'defender')).length;
        if (!x) { log(`${src.card.name}: no creatures with defender.`); return; }
        foes(P).forEach(F => { F.life -= x; F.lostTurn = G.turn; log(`${F.name} ${sxSays(F, 'lose', 'loses')} ${x} life.`); fire('loseLife', { P: F, n: x }); });
    },
    sx_doran(P, e, t, src) {
        const raw = G.ctxRaw || {};
        const list = (raw.list || []).filter(x => x.owner === P.i && onBf(x.uid));
        list.forEach(c => { const x = Math.abs(tou(c) - pow(c)); if (x) { c.tp += x; c.tq += x; log(`${c.card.name} gets +${x}/+${x} until end of turn (${src.card.name}).`); } });
    },
    async sx_kingpin(P, e, t, src) {
        if (P.life <= 2) return;
        const mine = P.bf.filter(c => isCreature(c) && tou(c) > pow(c) && (G.attackers || []).includes(c.uid));
        const yes = sxAI(P) ? mine.length > 0 && P.life > 8 : await askYes(P, `${src.card.name}: pay 2 life so your creatures with toughness greater than power deal damage equal to their toughness this turn?`, { card: src.card });
        if (!yes) return;
        P.life -= 2; P.lostTurn = G.turn; fire('loseLife', { P, n: 2 });
        P.sx_toughTurn = G.turn;
        log(`${P.name} ${sxSays(P, 'pay', 'pays')} 2 life: creatures with toughness greater than power assign combat damage equal to their toughness this turn.`);
    },
    async sx_noxious(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => ({ c, X })));
        if (!pool.length) return;
        let pick;
        if (sxAI(P)) { const own = pool.filter(p => p.X === P).sort((a, b) => (b.c.card.cmc || 0) - (a.c.card.cmc || 0)); pick = own[0] || pool[0]; }
        else { const c = await pickCard(P, pool.map(p => p.c), `${src.card.name}: put a card from a graveyard on top of its owner's library`, { required: true }); pick = pool.find(p => p.c === c); }
        if (!pick) return;
        pull(pick.X.gy, pick.c); pick.X.library.push(pick.c);
        log(`${pick.c.card.name} is put on top of ${pick.X.name}'s library.`);
    },
    sx_reap(P, e, t, src) {
        const x = Math.min(typeof e.x === 'number' ? e.x : typeof src.xVal === 'number' ? src.xVal : 0, P.gy.length);
        const got = shuffle(P.gy.filter(c => c !== src).slice()).slice(0, x);
        got.forEach(c => { pull(P.gy, c); P.hand.push(c); });
        log(`${P.name} ${sxSays(P, 'return', 'returns')} ${got.map(c => c.card.name).join(', ') || 'nothing'} at random to ${sxSays(P, 'your', 'their')} hand.`);
    },
    async sx_enchantSelf(P, e, t, src) { src.hostPlayer = P.i; log(`${src.card.name} enchants ${sxSays(P, 'you', P.name)}.`); },
    async sx_secondSun(P, e, t, src) {
        const X = G.players[src.hostPlayer]; if (!X || X.out) return;
        log(`${src.card.name}: an additional beginning phase for ${X.name}.`);
        X.bf.forEach(c => { if (c.tapped && !has(c, 'nountap')) c.tapped = false; });
        log(`${X.name} ${sxSays(X, 'untap', 'untaps')} ${sxSays(X, 'your', 'their')} permanents.`);
        fire('upkeep', {});
        drawCards(X, 1);
    },
    sx_wreckHunter(P, e, t, src) {
        const X = (t && t.p) || P;
        const n = X.gy.filter(c => !sxLand(c) && sxFromBfThisTurn(c)).length;
        for (let k = 0; k < n; k++) { const p = makeArtifactToken(P, 'powerstone'); p.tapped = true; }
        log(`${P.name} ${sxSays(P, 'create', 'creates')} ${n} tapped Powerstone token${n === 1 ? '' : 's'}.`);
    },

    // ===== Aurelia deck =====
    sx_draw1(P) { drawCards(P, 1); },
    sx_aurelia5(P, e, t, src) {
        foes(P).forEach(F => damage(F, 3, src));
        log(`${src.card.name} deals 3 damage to each opponent.`);
        gainLifeFor(P, 3);
    },
    async sx_cartHawk(P, e, t, src) {
        const raw = G.ctxRaw || {}, hit = (raw.hit || []).map(i => (typeof i === 'number' ? G.players[i] : i)).filter(Boolean);
        const lands = X => X.bf.filter(sxLand).length;
        if (!hit.some(X => lands(X) > lands(P)) || !onBf(src.uid)) return;
        leaveBattlefield(src, 'hand');
        log(`${src.card.name} returns to ${sxSays(P, 'your', `${P.name}'s`)} hand.`);
        const plains = P.library.filter(c => sxLand(c) && hasTypeCard(c, 'Plains'));
        if (!plains.length) return;
        const c = sxAI(P) ? plains[0] : await pickCard(P, plains, `${src.card.name}: put a Plains onto the battlefield tapped (or skip)`);
        if (c) { pull(P.library, c); putOntoBattlefield(P, c, true); log(`${P.name} ${sxSays(P, 'put', 'puts')} ${c.card.name} onto the battlefield tapped.`); }
        P.library = shuffle(P.library);
    },
    async sx_continue(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && sxFromBfThisTurn(c));
        if (!pool.length) { log(`${src.card.name}: no creature cards went to the graveyard from the battlefield this turn.`); return; }
        const picks = sxAI(P) ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)).slice(0, 4) : await jvPickSeveral(P, pool, `${src.card.name}: return a creature card`, 4, () => true);
        picks.forEach(c => reanimateFrom(P, P, c));
    },
    sx_avatarState(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        c.tkw.push('flying', 'first strike', 'lifelink', 'hexproof');
        log(`${c.card.name} becomes an Avatar and gains flying, first strike, lifelink and hexproof until end of turn.`);
    },
    async sx_phoenixBack(P, e, t, src) {
        if (!P.gy.includes(src)) return;
        const cost = parseCost(e.cost);
        if (!planPayment(P, cost, 0)) return;
        const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: pay ${e.cost} to return it from your graveyard tapped and attacking?`, { card: src.card });
        if (!yes) return;
        { const plan = planPayment(P, cost, 0); if (!plan) return; plan.forEach(y => tapSource(P, y)); }
        pull(P.gy, src);
        putOntoBattlefield(P, src, true);
        if (e.counter) putCounters(src, e.counter, P);
        const others = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i);
        if (!G.attackers.includes(src.uid)) G.attackers.push(src.uid);
        if (others[0] && others[0].atkTo !== undefined) src.atkTo = others[0].atkTo;
        src.attackedTurn = G.turn;
        log(`${src.card.name} returns to the battlefield tapped and attacking.`);
    },
    async sx_skiff(P, e, t, src) {
        const pool = P.gy.filter(c => /\b(Creature|Enchantment)\b/.test(c.card.type));
        if (!pool.length) return;
        const c = sxAI(P) ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${src.card.name}: return a creature or enchantment card to the battlefield`, { required: true });
        if (c) reanimateFrom(P, P, c);
    },
    sx_titanic(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0;
        if (onBf(src.uid)) { leaveBattlefield(src, 'gy'); fire('sacrificed', { o: src, P }); log(`${P.name} ${sxSays(P, 'sacrifice', 'sacrifices')} ${src.card.name}.`); }
        for (let k = 0; k < n; k++) makeArtifactToken(P, 'treasure');
        log(`${P.name} ${sxSays(P, 'create', 'creates')} ${n} Treasure token${n === 1 ? '' : 's'}.`);
    },
    async sx_nightDoctor(P, e, t, src) {
        const pool = P.gy.filter(c => /\bLegendary\b/.test(c.card.type) && /\bCreature\b/.test(c.card.type));
        if (!pool.length) return;
        const c = sxAI(P) ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${src.card.name}: return a legendary creature card to the battlefield`, { required: true });
        if (!c) return;
        reanimateFrom(P, P, c);
        const kinds = ['first strike', 'vigilance', 'lifelink'];
        let k = 'lifelink';
        if (!sxAI(P) && typeof askMode === 'function') { const i = await askMode(P, `${src.card.name}: which counter for ${c.card.name}?`, kinds); if (typeof i === 'number' && kinds[i]) k = kinds[i]; }
        if (onBf(c.uid)) { c.ctr = c.ctr || {}; c.ctr[k] = (c.ctr[k] || 0) + 1; log(`${c.card.name} gets a ${k} counter.`); }
    },
    sx_wingnut(P, e, t, src) {
        const others = (G.attackers || []).map(onBf).filter(x => x && x !== src);
        others.forEach(c => { c.tp += 1; });
        if (others.length) log(`Each other attacking creature gets +1/+0 until end of turn (${src.card.name}).`);
    },

    // ===== Doc Samson deck =====
    sx_blastZone(P, e, t, src) {
        const x = (src.ctr && src.ctr.charge) || 0;
        const hit = allPerms().filter(c => c !== src && !sxLand(c) && (c.card.cmc || 0) === x);
        hit.forEach(c => destroy(c, src.card.name));
        log(`${src.card.name} destroys each nonland permanent with mana value ${x} (${hit.length}).`);
    },
    sx_boonBoseiju(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const x = Math.max(0, ...P.bf.map(p => p.card.cmc || 0));
        c.tp += x; c.tq += x; c.tapped = false;
        log(`${c.card.name} gets +${x}/+${x} until end of turn and untaps.`);
    },
    sx_coalition(P, e, t, src) {
        const n = (src.ctr && src.ctr.charge) || 0; if (!n) return;
        src.ctr.charge = 0;
        sxPool(P, Array(n).fill(sxBestColor(P)));
    },
    sx_graftEnter(P, e, t, src) { if (onBf(src.uid)) { src.counters += e.n || 1; log(`${src.card.name} enters with a +1/+1 counter (graft).`); } },
    async sx_graftMove(P, e, t, src) {
        const to = G.ctxObj; if (!to || !onBf(to.uid) || !onBf(src.uid) || src.counters <= 0) return;
        const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: move a +1/+1 counter onto ${to.card.name}?`, { card: src.card });
        if (!yes) return;
        src.counters -= 1; putCounters(to, 1, P);
        log(`${src.card.name} moves a +1/+1 counter onto ${to.card.name} (graft).`);
    },
    async sx_storage(P, e, t, src) {
        const have = (src.ctr && src.ctr.storage) || 0; if (!have) return;
        let n = have;
        if (!sxAI(P)) { const v = await askNumber(P, `${src.card.name}: remove how many storage counters?`, 1, have, have, { card: src.card }); if (v === null) return; n = v; }
        src.ctr.storage -= n;
        sxPool(P, Array(n).fill('C'));
    },
    sx_automaton(P, e, t, src) { if (src.counters < 2) return; src.counters -= 2; log(`Two +1/+1 counters are removed from ${src.card.name}.`); drawCards(P, 1); },
    async sx_moxite(P, e, t, src) {
        const total = c => Math.max(0, c.counters) + Object.values(c.ctr || {}).reduce((a, v) => a + (v > 0 ? v : 0), 0);
        const from = P.bf.filter(c => (isCreature(c) || /\bArtifact\b/.test(c.card.type)) && total(c) > 0);
        if (!from.length) { log(`${src.card.name}: nothing has counters to remove.`); return; }
        const dest = P.bf.filter(c => isCreature(c) || /\bArtifact\b/.test(c.card.type));
        let s, x, d;
        if (sxAI(P)) {
            s = from.slice().sort((a, b) => total(b) - total(a))[0];
            x = total(s);
            d = dest.filter(c => c !== s && isCreature(c)).sort((a, b) => pow(b) - pow(a))[0] || dest.find(c => c !== s) || s;
        } else {
            s = await pickCard(P, from, `${src.card.name}: remove counters from`, { required: true }); if (!s) return;
            x = await askNumber(P, `${src.card.name}: remove how many counters from ${s.card.name}?`, 1, total(s), total(s), { card: src.card }); if (x === null) return;
            d = await pickCard(P, dest, `${src.card.name}: put ${x} counters on (a creature gets +1/+1 counters, an artifact charge counters)`, { required: true }); if (!d) return;
        }
        let left = x;
        const takeP = Math.min(left, Math.max(0, s.counters)); s.counters -= takeP; left -= takeP;
        for (const k of Object.keys(s.ctr || {})) { if (left <= 0) break; const tk = Math.min(left, s.ctr[k] || 0); s.ctr[k] -= tk; left -= tk; }
        if (isCreature(d)) putCounters(d, x, P); else { d.ctr = d.ctr || {}; d.ctr.charge = (d.ctr.charge || 0) + x; }
        log(`${src.card.name}: ${x} counters move from ${s.card.name} to ${d.card.name} (${isCreature(d) ? '+1/+1' : 'charge'}).`);
    },
    sx_untapHost(P, e, t, src) { const h = sxHost(src); src.sx_onceA = G.turn; if (h) { h.tapped = false; log(`${h.card.name} untaps.`); } },
    sx_chosenUntap(P, e, t, src) {
        const h = sxHost(src); src.sx_onceB = G.turn;
        if (h) { h.tapped = true; fire('tapped', { o: h }); }
        if (t && t.o && onBf(t.o.uid)) { t.o.tapped = false; log(`${t.o.card.name} untaps.`); }
    },
    sx_energyHit(P) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; P.energy = (P.energy || 0) + n; log(`${P.name} ${sxSays(P, 'get', 'gets')} ${n} energy.`); },
    sx_trident(P, e, t, src) {
        const h = sxHost(src); if (!h) return;
        const n = pow(h); h.tapped = true; fire('tapped', { o: h });
        src.attachedTo = null;
        const X = (t && t.p) || opp(P);
        damage(X, n, h);
        log(`${h.card.name} deals ${n} damage to ${X.name} (${src.card.name}).`);
    },
    sx_whipTap(P, e, t, src) {
        const h = sxHost(src); if (!h) return;
        h.tapped = true; fire('tapped', { o: h });
        if (t && t.o && onBf(t.o.uid)) { t.o.tapped = true; fire('tapped', { o: t.o }); log(`${t.o.card.name} is tapped.`); }
    },
    async sx_whipDiscover(P, e, t, src) {
        const h = sxHost(src); if (!h) return;
        h.tapped = true; fire('tapped', { o: h });
        await cascade(P, src, 10);
    },
    async sx_toggleHost(P, e, t, src) {
        const h = sxHost(src); if (!h) return;
        const tapIt = sxAI(P) ? !h.tapped && G.active !== P.i : await askYes(P, `${src.card.name}: ${h.tapped ? 'untap' : 'tap'} ${h.card.name}?`, { card: src.card });
        if (sxAI(P) && !tapIt && h.tapped) { h.tapped = false; log(`${h.card.name} untaps.`); return; }
        if (!tapIt) return;
        h.tapped = !h.tapped; if (h.tapped) fire('tapped', { o: h });
        log(`${h.card.name} ${h.tapped ? 'taps' : 'untaps'}.`);
    },
    async sx_sabertooth(P, e, t, src) {
        const pool = P.bf.filter(c => isCreature(c) && c !== src);
        if (!pool.length) return;
        const c = sxAI(P) ? pool.slice().sort((a, b) => (Rx(b).etb.length ? 1 : 0) - (Rx(a).etb.length ? 1 : 0) || pow(a) - pow(b))[0] : await pickCard(P, pool, `${src.card.name}: return another creature you control to your hand (or skip)`);
        if (!c) return;
        leaveBattlefield(c, 'hand');
        log(`${c.card.name} returns to ${sxSays(P, 'your', `${P.name}'s`)} hand.`);
        if (onBf(src.uid)) { src.tkw.push('indestructible'); log(`${src.card.name} gains indestructible until end of turn.`); }
    },
    async sx_aesir1(P, e, t, src) {
        const pool = P.gy.filter(sxPerm);
        if (!pool.length) return;
        const c = sxAI(P) ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${src.card.name}: exile a permanent card from your graveyard`, { required: true });
        if (!c) return;
        pull(P.gy, c); P.exile.push(c); src.sx_exiled = c.uid; src.sx_exiledMv = c.card.cmc || 0;
        log(`${P.name} ${sxSays(P, 'exile', 'exiles')} ${c.card.name}.`);
        gainLifeFor(P, c.card.cmc || 0);
    },
    sx_aesir2(P, e, t, src) { const c = t && t.o; const n = src.sx_exiledMv || 0; if (c && onBf(c.uid) && n) { putCounters(c, n, P); log(`${c.card.name} gets ${n} +1/+1 counters.`); } },
    sx_aesir3(P, e, t, src) {
        const c = P.exile.find(x => x.uid === src.sx_exiled);
        if (c) { pull(P.exile, c); P.hand.push(c); log(`${c.card.name} returns to ${sxSays(P, 'your', `${P.name}'s`)} hand.`); }
        if (onBf(src.uid)) { src.sx_bounceSaga = true; leaveBattlefield(src, 'hand'); log(`${src.card.name} returns to ${sxSays(P, 'your', `${P.name}'s`)} hand.`); }
    },
    sx_mantle(P, e, t, src) {
        const h = sxHost(src); if (!h || !h.tapped) return;
        h.tapped = false; h.tp += 2; h.tq += 2;
        log(`${h.card.name} untaps and gets +2/+2 until end of turn (${src.card.name}).`);
    }
});
// The Saga leaves when its last chapter returns it: don't sacrifice a Saga that already left
function hasTypeCard(c, ty) { return new RegExp(`\\b${ty}\\b`).test(c.card.type); }

Object.assign(CMD_SCORE, {
    sx_blightPile: P => P.bf.filter(c => isCreature(c) && has(c, 'defender')).length * 2,
    sx_noxious: () => 2, sx_reap: P => (P.gy.length >= 3 ? 6 : 1), sx_enchantSelf: () => 6, sx_wreckHunter: () => 1,
    sx_continue: P => P.gy.filter(c => /\bCreature\b/.test(c.card.type) && sxFromBfThisTurn(c)).length * 4,
    sx_avatarState: () => 3, sx_skiff: P => (P.gy.some(c => /\b(Creature|Enchantment)\b/.test(c.card.type)) ? 6 : 0),
    sx_boonBoseiju: () => 3, sx_blastZone: () => 1, sx_moxite: () => 2, sx_sabertooth: () => 0, sx_storage: () => 0, sx_automaton: () => 3
});

// =====================================================================
// Plargg and Nassari, Rukarumel and Astarion decks
// =====================================================================
const SX_NONCREATURE_SUBS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Desert', 'Gate', 'Locus', 'Lair', 'Sphere', 'Urza\'s', 'Mine', 'Tower', 'Power-Plant', 'Cave', 'Town', 'Aura', 'Equipment', 'Vehicle', 'Saga', 'Clue', 'Treasure', 'Food', 'Blood', 'Gold', 'Powerstone', 'Map', 'Incubator', 'Class', 'Case', 'Room', 'Shrine', 'Curse', 'Background', 'Role', 'Cartouche', 'Rune', 'Shard', 'Fortification', 'Attraction', 'Contraption', 'Spacecraft', 'Planet']);
const sxCreatureTypeWord = ty => !!ty && /^[A-Z][a-z'-]+$/.test(ty) && !SX_NONCREATURE_SUBS.has(ty) && !['Creature', 'Artifact', 'Enchantment', 'Land', 'Instant', 'Sorcery', 'Planeswalker', 'Battle', 'Legendary', 'Basic', 'Snow', 'Token', 'Tribal', 'Kindred'].includes(ty);
const sxIsCreatureThing = o => (o.card && /\bCreature\b/.test(o.card.type)) || (G && isCreature(o));
const sxController = o => (G && onBf(o.uid) ? ctrl(o) : G ? G.players[o.owner] : null);
// Every creature type (Maskwood Nexus), the chosen type (Rukarumel), all / no creature types until end of turn (Amoeboid Changeling, Mirror Entity)
{
    const base = hasType;
    hasType = function (o, type) {
        if (G && o && o.card && sxCreatureTypeWord(type) && sxIsCreatureThing(o)) {
            if (o.sx_noTypes === G.turn) return false;
            if (o.sx_allTypes === G.turn) return true;
            const src = permsBy('sxTypes', a => !!(Rx(a).sx_maskwood || Rx(a).sx_rukarumel));
            const X = src.length ? sxController(o) : null;
            if (X) for (const s of src) {
                const r = Rx(s); if (ctrl(s) !== X || lostAbilities(s)) continue;
                if (r.sx_maskwood) return true;
                if (r.sx_rukarumel && s.chosenType === type && (!o.token || /\bSliver\b/.test(o.card.type))) return true;
            }
        }
        return base.apply(this, arguments);
    };
}
// Moritte of the Frost: a copy of a permanent you control, legendary and snow, two more counters and changeling if a creature
{
    const baseM = cloneMatches;
    cloneMatches = function (x, what, P) { if (what === 'permanent you control') return x.owner === P.i; return baseM.apply(this, arguments); };
    const baseE = enterAsCopy;
    enterAsCopy = async function (P, o, cl) {
        const r = await baseE.apply(this, arguments);
        if (cl && cl.sx_moritte && o.copyOf) {
            let type = o.card.type;
            if (!/\bSnow\b/.test(type)) type = type.replace(/^(Legendary )?/, '$1Snow ');
            if (!/\bLegendary\b/.test(type)) type = `Legendary ${type}`;
            let text = o.card.text || '';
            if (/\bCreature\b/.test(type)) { o.counters += 2; if (!/^Changeling$/m.test(text)) text = `${text}\nChangeling`.trim(); }
            o.card = { ...o.card, type, text }; o._r = null;
            log(`${o.card.name} is legendary and snow${/\bCreature\b/.test(type) ? ', with two more +1/+1 counters and changeling' : ''} (${o.copyOf.name}).`);
        }
        return r;
    };
}
// Springleaf Parade: creature tokens tap for any color
{
    const base = manaOf;
    manaOf = function (o) {
        const m = base.apply(this, arguments);
        if (m || !G || !o || !o.token || !isCreature(o)) return m;
        const X = ctrl(o);
        return X && X.bf.some(s => Rx(s).sx_tokenMana && !lostAbilities(s)) ? { colors: [...COLORS], n: 1 } : m;
    };
}
// Keywords for everything: Avatar of Slaughter (double strike), Smoke Bomb (shroud), Crystalline / Ward Sliver (Slivers), Colossus of Akros (trample while monstrous)
{
    const base = staticBuffs;
    staticBuffs = function (o) {
        const b = base.apply(this, arguments);
        if (!G || !isCreature(o)) return b;
        for (const s of permsBy('sxAllKw', a => !!(Rx(a).sx_allDouble || Rx(a).sx_allShroud || Rx(a).sx_sliverKw))) {
            const r = Rx(s); if (lostAbilities(s)) continue;
            if (r.sx_allDouble) b.kw.push('double strike');
            if (r.sx_allShroud) b.kw.push('shroud');
            if (r.sx_sliverKw && hasType(o, 'Sliver')) { if (r.sx_sliverKw === 'chosenColor') { if (s.chosenColor) b.kw.push(`pro:${s.chosenColor}`); } else b.kw.push(r.sx_sliverKw); }
        }
        if (Rx(o).sx_monsterAttack && o.monstrous && !lostAbilities(o)) b.kw.push('trample');
        return b;
    };
}
// Elenda: hexproof from instants; extra target kinds (abilities, permanent spells, spells or abilities)
{
    const base = validTargets;
    validTargets = function (P, e, src) {
        let out = base.apply(this, arguments);
        if (e.target === 'sx_myAbility') out = G.stack.filter(it => it.kind !== 'spell' && !it.copy && it.P === P).map(item => ({ item }));
        if (e.target === 'sx_myPermSpell') out = G.stack.filter(it => it.kind === 'spell' && it.P === P && sxPerm(it.o)).map(item => ({ item }));
        if (e.target === 'sx_spellOrAbility') out = G.stack.filter(it => !(src && it.o === src)).map(item => ({ item }));
        if (src && Rx(src).kind === 'instant') out = out.filter(x => !(x.o && Rx(x.o).sx_hexInstants && !lostAbilities(x.o) && ctrl(x.o) !== P));
        return out;
    };
}
// Where a spell was cast from (Nalfeshnee, Spider-Verse)
{
    const base = castSpell;
    castSpell = async function (P, o) {
        if (G && o) o.sx_castZone = P.exile.includes(o) ? 'exile' : P.hand.includes(o) ? 'hand' : P.gy.includes(o) ? 'gy' : (P.command || []).includes(o) ? 'command' : P.library.includes(o) ? 'library' : 'other';
        return base.apply(this, arguments);
    };
}
const SX_OUTLAWS = ['Assassin', 'Mercenary', 'Pirate', 'Rogue', 'Warlock'];
async function sxCopyStackSpell(P, it, haste, sac) {
    if (!it || !G.stack.includes(it)) return;
    if (sxPerm(it.o)) G.stack.push({ id: stackSeq++, kind: 'trigger', o: it.o, P, target: null, effects: [cmd('sx_tokenFromSpell', { haste, sac })], name: `${it.o.card.name} (copy)`, copy: true });
    else await copySpellItem(P, it, { retarget: true });
    log(`${it.o.card.name} is copied.`);
}
{
    const base = fire;
    fire = function (ev, ctx = {}) {
        const r = base.apply(this, arguments);
        if (!G || G.over) return r;
        // Annihilator: the defending player sacrifices N permanents
        if (ev === 'attacks' && ctx.list) ctx.list.forEach(a => {
            const n = (Rx(a).sx_annih && !lostAbilities(a) ? Rx(a).sx_annih : 0) + (a.sx_annihTurn === G.turn ? 1 : 0);
            if (n > 0) (G.trigQ = G.trigQ || []).push({ P: ctrl(a), o: a, effects: [cmd('sx_annihilate', { n })], ctx: a });
        });
        // Senu: comes back from exile attacking when a legendary creature of yours isn't blocked
        if (ev === 'unblocked' && ctx.o && /\bLegendary\b/.test(ctx.o.card.type)) {
            const X = ctrl(ctx.o); if (X) X.exile.filter(c => Rx(c).sx_senu).forEach(c => (G.trigQ = G.trigQ || []).push({ P: X, o: c, effects: [cmd('sx_senu')], ctx: ctx.o }));
        }
        // Virulent Sliver: poisonous 1 for every Sliver
        if (ev === 'hitPlayer' && ctx.src && hasType(ctx.src, 'Sliver')) {
            const k = allPerms().filter(s => Rx(s).sx_virulent && !lostAbilities(s)).reduce((a, s) => a + Rx(s).sx_virulent, 0);
            if (k) (ctx.hit || []).map(i => (typeof i === 'number' ? G.players[i] : i)).filter(Boolean).forEach(X => { X.poison = (X.poison || 0) + k; log(`${X.name} ${sxSays(X, 'get', 'gets')} ${k} poison counter${k === 1 ? '' : 's'} (poisonous).`); });
        }
        // Koth's emblem: a Mountain you control enters
        if (ev === 'landfall' && ctx.o && hasType(ctx.o, 'Mountain')) { const X = G.players[ctx.o.owner]; for (let k = 0; k < (X.sx_koth || 0); k++) (G.trigQ = G.trigQ || []).push({ P: X, o: ctx.o, effects: [cmd('sx_kothBurn', { target: 'any' })] }); }
        // Chandra's emblems: 1 damage at the beginning of your upkeep
        if (ev === 'upkeep') { const X = G.players[G.active]; if (X && X.sx_chandra && !X.out) { damage(X, X.sx_chandra, null); log(`Chandra's emblem${X.sx_chandra > 1 ? 's deal' : ' deals'} ${X.sx_chandra} damage to ${X.name}.`); } }
        // Copies of spells: Nalfeshnee (cast from exile), Spider-Verse (cast from anywhere but your hand, once a turn), Double Down (outlaw spells)
        if (ev === 'cast' && ctx.o && ctx.P) {
            const P = ctx.P, o = ctx.o, it = G.stack.find(x => x.kind === 'spell' && x.o === o);
            if (it) {
                P.bf.forEach(s => {
                    const r = Rx(s); if (lostAbilities(s)) return;
                    if (r.sx_copyExile === 'nalfeshnee' && o.sx_castZone === 'exile') (G.trigQ = G.trigQ || []).push({ P, o: s, effects: [cmd('sx_copyCast', { haste: true, sac: true, it: it.id })] });
                    if (r.sx_copyExile === 'spiderverse' && o.sx_castZone && o.sx_castZone !== 'hand' && P.sx_spiderTurn !== G.turn) (G.trigQ = G.trigQ || []).push({ P, o: s, effects: [cmd('sx_copyCast', { haste: true, may: 'spider', it: it.id })] });
                    if (r.sx_doubleDown && SX_OUTLAWS.some(ty => hasType(o, ty))) (G.trigQ = G.trigQ || []).push({ P, o: s, effects: [cmd('sx_copyCast', { it: it.id })] });
                });
            }
        }
        return r;
    };
}
// Fear of Burning Alive: noncombat damage to an opponent from your source, with four or more card types in your graveyard
{
    const base = damage;
    damage = function (target, n, src) {
        const r = base.apply(this, arguments);
        if (G && n > 0 && target && target.life !== undefined && src && src.card && !G.inCombatDamage && permsBy('sxFear', a => !!Rx(a).sx_fearBurn).length) {
            const X = ctrl(src) || G.players[src.owner];
            if (X && X !== target && foes(X).includes(target)) {
                const types = new Set(); X.gy.forEach(c => ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery', 'Battle', 'Kindred'].forEach(w => { if (new RegExp(`\\b${w}\\b`).test(c.card.type)) types.add(w); }));
                if (types.size >= 4) X.bf.filter(s => Rx(s).sx_fearBurn && !lostAbilities(s)).forEach(s => (G.trigQ = G.trigQ || []).push({ P: X, o: s, effects: [cmd('sx_fearHit', { n, victim: target.i })] }));
            }
        }
        return r;
    };
}
// Urabrask, Heretic Praetor: the next draw this turn is exiled instead (playable this turn)
{
    const base = drawCards;
    drawCards = function (P, n, quiet) {
        if (G && P && P.sx_urabrask === G.turn && n > 0 && P.library.length) {
            P.sx_urabrask = 0;
            const c = P.library.pop(); P.exile.push(c); c.playUntil = G.turn;
            log(`${P.name} ${sxSays(P, 'exile', 'exiles')} ${c.card.name} instead of drawing it (Urabrask) and may play it this turn.`);
            n -= 1; if (n <= 0) return;
        }
        return base.call(this, P, n, quiet);
    };
}
// Maximum Carnage: every creature attacks each combat until its controller's next turn
{
    const base = forcedAttack;
    forcedAttack = function (o) { return base.apply(this, arguments) || (!!G && G.players.some(X => X.sx_carnageUntil > G.turn) && isCreature(o)); };
}
TRIG_FN.sx_chosenEnters = (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o) && !!o.chosenType && hasType(ctx.o, o.chosenType);
TRIG_FN.sx_castMyr = (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && hasType(ctx.o, 'Myr');
COND_EXTRA.push([/^sx: your turn$/, () => P => G.active === P.i]);

Object.assign(CMD, {
    // ----- Plargg and Nassari -----
    async sx_annihilate(P, e, t, src) {
        const D = (src.atkTo !== undefined && G.players[src.atkTo]) || (typeof defOf === 'function' && defOf(src)) || opp(P);
        if (!D || D.out || D === P) return;
        const pool = D.bf.slice(); const n = Math.min(e.n || 1, pool.length); if (!n) return;
        const picks = await chooseSacN(D, pool, n, `Annihilator ${e.n}`);
        picks.forEach(x => { if (onBf(x.uid)) { leaveBattlefield(x, 'gy'); fire('sacrificed', { o: x, P: D }); } });
        log(`${D.name} ${sxSays(D, 'sacrifice', 'sacrifices')} ${picks.map(x => x.card.name).join(', ')} (annihilator ${e.n}).`);
    },
    sx_alexios(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const X = G.players[G.active]; if (!X || X.out) return;
        if (ctrl(src) !== X) giveControl(src, X);
        src.tapped = false; putCounters(src, 1, X); src.tkw.push('haste'); src.sick = false;
        log(`${X.name} ${sxSays(X, 'gain', 'gains')} control of ${src.card.name}; it untaps, gets a +1/+1 counter and haste.`);
    },
    sx_chandraEmblem(P) { foes(P).forEach(F => { F.sx_chandra = (F.sx_chandra || 0) + 1; }); log(`Each opponent gets an emblem: "At the beginning of your upkeep, this emblem deals 1 damage to you."`); },
    sx_chandraSweep(P, e, t, src) { const hit = allPerms().filter(c => isCreature(c) && !hasType(c, 'Elemental')); hit.forEach(c => damage(c, 3, src)); log(`${src.card.name} deals 3 damage to each non-Elemental creature.`); },
    sx_chandraX(P, e, t, src) { const c = t && t.o; const x = typeof e.x === 'number' ? e.x : 0; if (!c || !onBf(c.uid) || x <= 0) return; c.exileOnDeath = G.turn; damage(c, x, src); log(`${src.card.name} deals ${x} damage to ${c.card.name}.`); },
    sx_hostDraws(P, e, t, src) { const X = G.players[src.hostPlayer]; if (X && !X.out) { log(`${src.card.name}: ${X.name} ${sxSays(X, 'draw', 'draws')} two additional cards.`); drawCards(X, e.n || 2); } },
    sx_hostDiscards(P, e, t, src) {
        const X = G.players[src.hostPlayer]; if (!X || X.out || !X.hand.length) return;
        const cards = X.hand.splice(0);
        cards.forEach(c => { X.gy.push(c); c.gyTurn = G.turn; c.discardTurn = G.turn; fire('discarded', { P: X, o: c }); });
        log(`${X.name} ${sxSays(X, 'discard', 'discards')} ${sxSays(X, 'your', 'their')} hand (${cards.length}).`);
    },
    async sx_retarget(P, e, t, src) { const it = t && t.item; if (!it || !G.stack.includes(it)) return; if (typeof frRetargetItem === 'function') await frRetargetItem(P, it, src); },
    async sx_copyAny(P, e, t, src) {
        const it = t && t.item; if (!it || !G.stack.includes(it)) return;
        if (it.kind === 'spell') { if (['instant', 'sorcery'].includes(Rx(it.o).kind)) await copySpellItem(P, it, { retarget: true }); return; }
        await CMD.fr_echo(P, e, t, src);
    },
    sx_fanatic(P, e, t, src) { const n = devotion(P, ['R']); if (!n) return; foes(P).forEach(F => damage(F, n, src)); log(`${src.card.name} deals ${n} damage to each opponent (devotion to red).`); },
    async sx_fearHit(P, e, t, src) {
        const X = G.players[e.victim]; if (!X) return;
        const pool = X.bf.filter(c => isCreature(c) && !has(c, 'shroud') && !has(c, 'hexproof'));
        if (!pool.length) return;
        const c = sxAI(P) ? pool.slice().sort((a, b) => (tou(a) - a.dmg <= e.n ? -100 : 0) - (tou(b) - b.dmg <= e.n ? -100 : 0) || creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: deal ${e.n} damage to a creature ${X.name} controls`, { required: true });
        if (c) { damage(c, e.n, src); log(`${src.card.name} deals ${e.n} damage to ${c.card.name}.`); }
    },
    async sx_havocEater(P, e, t, src) {
        let total = 0;
        for (const F of foes(P)) {
            const pool = F.bf.filter(c => isCreature(c) && !has(c, 'shroud') && !has(c, 'hexproof'));
            if (!pool.length) continue;
            const c = sxAI(P) ? pool.slice().sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, pool, `${src.card.name}: goad up to one creature ${F.name} controls`);
            if (!c) continue;
            goad(c, P.i, G.turn + G.players.filter(y => !y.out).length); total += Math.max(0, pow(c));
        }
        if (total && onBf(src.uid)) { putCounters(src, total, P); log(`${src.card.name} gets ${total} +1/+1 counters.`); }
    },
    async sx_taskmaster(P, e, t, src) {
        for (const F of foes(P)) {
            const pool = F.bf.filter(c => isCreature(c) && !has(c, 'shroud') && !has(c, 'hexproof'));
            if (!pool.length) continue;
            const c = sxAI(P) ? pool.slice().sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, pool, `${src.card.name}: gain control of up to one creature ${F.name} controls`);
            if (!c) continue;
            await applyEffect(P, { t: 'steal' }, { o: c }, src);
            if (onBf(c.uid)) { c.tapped = false; c.tkw.push('trample', 'haste'); c.sx_annihTurn = G.turn; }
        }
    },
    sx_kothEmblem(P) { P.sx_koth = (P.sx_koth || 0) + 1; log(`${P.name} ${sxSays(P, 'get', 'gets')} an emblem: "Whenever a Mountain you control enters, this emblem deals 4 damage to any target."`); },
    sx_kothBurn(P, e, t, src) {
        if (!t) return;
        if (t.p) { damage(t.p, 4, null); log(`Koth's emblem deals 4 damage to ${t.p.name}.`); }
        else if (t.o && onBf(t.o.uid)) { damage(t.o, 4, null); log(`Koth's emblem deals 4 damage to ${t.o.card.name}.`); }
    },
    sx_copyPermSpell(P, e, t, src) { const it = t && t.item; if (!it || !G.stack.includes(it)) return; G.stack.push({ id: stackSeq++, kind: 'trigger', o: it.o, P, target: null, effects: [cmd('sx_tokenFromSpell', {})], name: `${it.o.card.name} (copy)`, copy: true }); log(`${src.card.name} copies ${it.o.card.name}.`); },
    sx_tokenFromSpell(P, e, t, src) {
        const tok = tokenCopyOf(P, src.front || src.card);
        if (!tok) return;
        if (e.haste) tok.tkw.push('haste');
        if (e.sac) tok.sacAtEnd = G.turn;
    },
    async sx_copyCast(P, e, t, src) {
        const it = G.stack.find(x => x.id === e.it); if (!it) return;
        if (e.may === 'spider') {
            if (P.sx_spiderTurn === G.turn) return;
            const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: copy ${it.o.card.name}?`, { card: it.o.card });
            if (!yes) return; P.sx_spiderTurn = G.turn;
        }
        await sxCopyStackSpell(P, it, !!e.haste, !!e.sac);
    },
    sx_carnage(P) { P.sx_carnageUntil = G.turn + G.players.filter(y => !y.out).length; log(`Until ${P.name}'s next turn, each creature attacks each combat if able.`); },
    async sx_planetary(P, e, t, src) {
        for (const X of G.players.filter(y => !y.out)) {
            const lands = X.bf.filter(sxLand);
            if (lands.length <= 6) continue;
            let keep;
            if (X.isAI || AUTOPLAY) keep = lands.slice().sort((a, b) => (manaOf(b) ? manaOf(b).colors.length : 0) - (manaOf(a) ? manaOf(a).colors.length : 0)).slice(0, 6);
            else keep = await jvPickSeveral(X, lands, `${src.card.name}: choose a land to keep (six in all)`, 6, () => true);
            if (keep.length < 6) keep = keep.concat(lands.filter(l => !keep.includes(l)).slice(0, 6 - keep.length));
            const gone = lands.filter(l => !keep.includes(l));
            gone.forEach(l => { leaveBattlefield(l, 'gy'); fire('sacrificed', { o: l, P: X }); });
            log(`${X.name} ${sxSays(X, 'sacrifice', 'sacrifices')} ${gone.length} land${gone.length === 1 ? '' : 's'}.`);
        }
        allPerms().filter(isCreature).forEach(c => damage(c, 6, src));
        log(`${src.card.name} deals 6 damage to each creature.`);
    },
    async sx_mammoth(P, e, t, src) {
        const x = typeof e.x === 'number' ? e.x : 0; if (x <= 0) return;
        const pool = allPerms().filter(c => /\bArtifact\b/.test(c.card.type) && !has(c, 'shroud') && !(has(c, 'hexproof') && c.owner !== P.i));
        const picks = sxAI(P) ? pool.filter(c => c.owner !== P.i).sort((a, b) => permValue(b) - permValue(a)).slice(0, x) : await jvPickSeveral(P, pool, `${src.card.name}: destroy an artifact`, x, () => true);
        picks.forEach(c => destroy(c, src.card.name));
    },
    sx_stolen(P, e, t, src) { foes(P).forEach(F => { const c = F.library.pop(); if (c) exilePlayFrom(P, F, c, G.turn); }); },
    sx_fireCrystal(P, e, t, src) { const c = t && t.o; if (!c || !onBf(c.uid)) return; const tok = tokenCopyOf(P, c.card); if (tok) tok.sacAtEnd = G.turn; },
    sx_urabrask() { const X = G.players[G.active]; if (X && !X.out) X.sx_urabrask = G.turn; },
    async sx_forge(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.ctr.oil = (src.ctr.oil || 0) + 1; const x = src.ctr.oil;
        log(`${src.card.name} gets an oil counter (${x}).`);
        const before = new Set(P.bf.map(c => c.uid));
        await applyEffect(P, { t: 'token', n: 1, p: x, q: 1, name: 'red Phyrexian Horror', kw: ['trample', 'haste'] }, null, src);
        P.bf.filter(c => !before.has(c.uid) && c.token).forEach(c => { c.sacAtEnd = G.turn; });
    },
    async sx_wand(P, e, t, src) {
        const roll = 1 + rand(20), x = roll >= 20 ? 3 : roll >= 10 ? 2 : 1;
        log(`${src.card.name}: ${P.name} ${sxSays(P, 'roll', 'rolls')} ${roll} (X is ${x}).`);
        const found = [];
        for (const F of foes(P)) {
            const rest = [];
            while (F.library.length) { const c = F.library.pop(); if (/\b(Instant|Sorcery)\b/.test(c.card.type)) { found.push({ c, F }); break; } rest.push(c); }
            F.library.push(...rest); F.library = shuffle(F.library);
        }
        found.forEach(({ c, F }) => exilePlayFrom(P, F, c, G.turn));
        let left = x;
        for (const { c } of found) {
            if (left <= 0) break;
            if (!Rx(c).spell && !Rx(c).modes) continue;
            const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card });
            if (!yes) continue;
            left--; await castFreeFrom(P, c);
        }
    },
    async sx_wildSurge(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const X = ctrl(c); const types = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].filter(w => new RegExp(`\\b${w}\\b`).test(c.card.type));
        destroy(c, src.card.name);
        if (!X || X.out) return;
        const rest = []; let hit = null;
        while (X.library.length) { const y = X.library.pop(); if (sxPerm(y) && types.some(w => new RegExp(`\\b${w}\\b`).test(y.card.type))) { hit = y; break; } rest.push(y); }
        if (rest.length) X.library.unshift(...shuffle(rest));
        if (hit) { putOntoBattlefield(X, hit); log(`${X.name} ${sxSays(X, 'reveal', 'reveals')} ${hit.card.name} and ${sxSays(X, 'put', 'puts')} it onto the battlefield.`); }
    },

    // ----- Rukarumel -----
    sx_allTypes(P, e, t) { if (t && t.o) { t.o.sx_allTypes = G.turn; t.o.sx_noTypes = 0; log(`${t.o.card.name} gains all creature types until end of turn.`); } },
    sx_noTypes(P, e, t) { if (t && t.o) { t.o.sx_noTypes = G.turn; t.o.sx_allTypes = 0; log(`${t.o.card.name} loses all creature types until end of turn.`); } },
    sx_selfCounter(P, e, t, src) { if (onBf(src.uid)) { putCounters(src, 1, P); log(`${src.card.name} gets a +1/+1 counter.`); } },
    sx_spiritDragons(P, e, t, src) {
        const dragons = P.bf.filter(c => isCreature(c) && hasType(c, 'Dragon'));
        const used = new Set();
        COLORS.forEach(col => {
            const fit = dragons.filter(d => (d.card.colors || []).includes(col));
            if (!fit.length) return;
            const d = fit.find(x => !used.has(x.uid)) || fit[0];
            used.add(d.uid); putCounters(d, 1, P);
        });
        if (used.size) log(`${src.card.name}: +1/+1 counters on ${used.size} Dragon${used.size === 1 ? '' : 's'}.`);
        if (used.size >= 5) applyEffect(P, { t: 'winGame' }, null, src);
    },
    sx_capricious(P, e, t, src) { const c = P.library.pop(); if (!c) return; P.exile.push(c); c.playUntil = G.turn; if (typeof exiledOwn === 'function') exiledOwn(P); log(`${P.name} ${sxSays(P, 'exile', 'exiles')} ${c.card.name} and may play it this turn.`); },
    async sx_flockBounce(P, e, t, src) {
        const pool = P.bf.filter(c => isCreature(c) && c !== src);
        if (!pool.length) return;
        const c = sxAI(P) ? pool.filter(x => !x.token && Rx(x).etb.length && (x.card.cmc || 0) <= 4).sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0] : await pickCard(P, pool, `${src.card.name}: return up to one other creature you control to your hand`);
        if (!c) return;
        leaveBattlefield(c, 'hand'); log(`${c.card.name} returns to ${sxSays(P, 'your', `${P.name}'s`)} hand.`);
    },
    async sx_formless(P, e, t, src) { const x = P.gy.filter(sxLand).length; await applyEffect(P, { t: 'token', n: 1, p: x, q: x, name: 'colorless Shapeshifter', kw: ['changeling', 'deathtouch'] }, null, src); },
    async sx_gathering(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        const ty = src.chosenType;
        if (ty && hasType(c, ty)) {
            const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: reveal ${c.card.name} and put it into your hand?`, { card: c.card });
            if (yes) { P.library.pop(); P.hand.push(c); log(`${P.name} ${sxSays(P, 'reveal', 'reveals')} ${c.card.name} and ${sxSays(P, 'put', 'puts')} it into ${sxSays(P, 'your', 'their')} hand.`); return; }
        }
        const toGy = sxAI(P) ? sxLand(c) && P.bf.filter(sxLand).length >= 6 : await askYes(P, `${src.card.name}: put ${c.card.name} into your graveyard?`, { card: c.card, yes: 'Graveyard', no: 'Leave it' });
        if (toGy) { P.library.pop(); P.gy.push(c); c.gyTurn = G.turn; log(`${P.name} ${sxSays(P, 'put', 'puts')} ${c.card.name} into ${sxSays(P, 'your', 'their')} graveyard.`); }
    },
    async sx_daleks(P, e, t, src) {
        const n = (src.ctr && src.ctr.lore) || 1;
        await applyEffect(P, { t: 'token', n, p: 3, q: 3, name: 'black Dalek', artifact: true, kw: ['menace'] }, null, src);
    },
    async sx_dalekEnd(P, e, t, src) {
        const daleks = allPerms().filter(c => isCreature(c) && hasType(c, 'Dalek'));
        const others = allPerms().filter(c => isCreature(c) && !hasType(c, 'Dalek'));
        const theirs = others.filter(c => ctrl(c) !== P).reduce((a, c) => a + creatureValue(c), 0), mine = others.filter(c => ctrl(c) === P).reduce((a, c) => a + creatureValue(c), 0);
        let mode = sxAI(P) ? (theirs > mine + 6 ? 1 : 0) : await askMode(P, `${src.card.name}: choose one`, ['Destroy all Daleks; each opponent loses life equal to their total power', 'Destroy all non-Dalek creatures']);
        if (mode === 1) { others.forEach(c => destroy(c, src.card.name)); log(`${src.card.name} destroys all non-Dalek creatures.`); return; }
        const powr = daleks.reduce((a, c) => a + Math.max(0, pow(c)), 0);
        daleks.forEach(c => destroy(c, src.card.name));
        const died = daleks.filter(c => !onBf(c.uid)).reduce((a, c) => a + Math.max(0, Number(c.card.power) || 3), 0) || powr;
        foes(P).forEach(F => { F.life -= died; F.lostTurn = G.turn; fire('loseLife', { P: F, n: died }); });
        log(`${src.card.name}: each opponent loses ${died} life.`);
    },
    sx_mirrorEntity(P, e, t, src) {
        const x = typeof e.x === 'number' ? e.x : 0;
        P.bf.filter(isCreature).forEach(c => { c.baseSet = { turn: G.turn, p: x, q: x }; c.sx_allTypes = G.turn; });
        log(`Creatures ${sxSays(P, 'you control', `${P.name} controls`)} have base power and toughness ${x}/${x} and all creature types until end of turn.`);
    },
    sx_mutavault(P, e, t, src) {
        const card = { id: `token-mutavault-${uidSeq}`, name: 'Mutavault', fullName: 'Mutavault token', cost: '', cmc: 0, type: 'Token Land', text: '{T}: Add {C}.\n{1}: Until end of turn, ~ becomes a 2/2 creature with all creature types. It\'s still a land.', colors: [], ci: [], img: null, imgS: null, legal: {} };
        const o = makeObj(card, P.i, { token: true, sick: false }); o.tapped = true; o.enteredTurn = G.turn; P.bf.push(o);
        log(`${P.name} ${sxSays(P, 'create', 'creates')} a tapped Mutavault token.`);
        fire('landfall', { o });
    },
    async sx_risenReef(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        if (sxLand(c)) {
            const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: put ${c.card.name} onto the battlefield tapped?`, { card: c.card, yes: 'Battlefield', no: 'Hand' });
            if (yes) { P.library.pop(); putOntoBattlefield(P, c, true); log(`${P.name} ${sxSays(P, 'put', 'puts')} ${c.card.name} onto the battlefield tapped.`); return; }
        }
        P.library.pop(); P.hand.push(c); log(`${P.name} ${sxSays(P, 'put', 'puts')} the top card of ${sxSays(P, 'your', 'their')} library into ${sxSays(P, 'your', 'their')} hand.`);
    },
    async sx_percher(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => ({ c, X })));
        let picks;
        if (sxAI(P)) picks = pool.filter(p => p.X !== P).sort((a, b) => (b.c.card.cmc || 0) - (a.c.card.cmc || 0)).slice(0, 2);
        else { const got = await jvPickSeveral(P, pool.map(p => p.c), `${src.card.name}: exile a card from a graveyard`, 2, () => true); picks = got.map(c => pool.find(p => p.c === c)).filter(Boolean); }
        picks.forEach(p => { pull(p.X.gy, p.c); p.X.exile.push(p.c); log(`${p.c.card.name} is exiled from ${p.X.name}'s graveyard.`); });
        gainLifeFor(P, 3);
    },
    async sx_myrToken(P, e, t, src) { await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Myr', artifact: true, kw: [] }, null, src); },
    sx_untapMyr(P) { const ms = P.bf.filter(c => isCreature(c) && hasType(c, 'Myr') && c.tapped); ms.forEach(c => { c.tapped = false; }); if (ms.length) log(`Each Myr ${sxSays(P, 'you control', `${P.name} controls`)} untaps.`); },
    sx_myrCounters(P) { const ms = P.bf.filter(c => isCreature(c) && hasType(c, 'Myr')); ms.forEach(c => putCounters(c, 3, P)); log(`Each Myr ${sxSays(P, 'you control', `${P.name} controls`)} gets three +1/+1 counters.`); },

    // ----- Astarion -----
    sx_appropriate(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const X = G.players[c.realOwner ?? c.owner];
        leaveBattlefield(c, 'exile');
        if (c.token) return;
        const H = G.players.find(y => y.exile.includes(c)) || X;
        if (H) { pull(H.exile, c); exilePlayFrom(P, H, c, Infinity); }
    },
    async sx_bloodTribute(P, e, t, src) {
        const F = (t && t.p) || opp(P); if (!F || F === P) return;
        const n = Math.ceil(Math.max(0, F.life) / 2);
        let kicked = false;
        const vamp = P.bf.find(c => isCreature(c) && hasType(c, 'Vampire') && !c.tapped);
        if (vamp && Rx(src).sx_vampKicker) kicked = sxAI(P) ? true : await askYes(P, `${src.card.name}: tap ${vamp.card.name} to kick it (you gain the life lost)?`, { card: src.card });
        if (kicked) { vamp.tapped = true; fire('tapped', { o: vamp }); }
        F.life -= n; F.lostTurn = G.turn; fire('loseLife', { P: F, n });
        log(`${F.name} ${sxSays(F, 'lose', 'loses')} ${n} life (${src.card.name}${kicked ? ', kicked' : ''}).`);
        if (kicked && n) gainLifeFor(P, n);
    },
    async sx_crypt(P, e, t, src) { const n = (src.ctr && src.ctr.corpse) || 0; if (n) await applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'black Zombie', kw: ['decayed'] }, null, src); },
    sx_persistVamps(P) { const vs = P.bf.filter(c => isCreature(c) && !c.token && hasType(c, 'Vampire')); vs.forEach(c => c.tkw.push('persist')); log(`Each nontoken Vampire ${sxSays(P, 'you control', `${P.name} controls`)} gains persist until end of turn.`); },
    sx_essencePulse(P, e, t, src) {
        gainLifeFor(P, 2);
        const x = P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0;
        if (!x) return;
        allPerms().filter(isCreature).forEach(c => { c.tp -= x; c.tq -= x; });
        log(`Each creature gets -${x}/-${x} until end of turn (${src.card.name}).`);
    },
    async sx_lantern(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        if (sxLand(c)) {
            const yes = sxAI(P) ? true : await askYes(P, `${src.card.name}: put ${c.card.name} onto the battlefield tapped?`, { card: c.card });
            if (yes) { P.library.pop(); putOntoBattlefield(P, c, true); log(`${P.name} ${sxSays(P, 'put', 'puts')} ${c.card.name} onto the battlefield tapped.`); return; }
        }
        const bottom = sxAI(P) ? !sxLand(c) && (c.card.cmc || 0) > 5 : await askYes(P, `${src.card.name}: put ${c.card.name} on the bottom of your library?`, { card: c.card, yes: 'Bottom', no: 'Leave it on top' });
        if (bottom) { P.library.pop(); P.library.unshift(c); log(`${P.name} ${sxSays(P, 'put', 'puts')} the top card on the bottom.`); }
    },
    async sx_march(P, e, t, src) { if (devotion(P, ['W', 'B']) < 7) return; await applyEffect(P, { t: 'token', n: 1, p: 4, q: 3, name: 'white and black Vampire Demon', kw: ['flying'] }, null, src); },
    async sx_dreadSac(P, e, t, src) {
        const F = (t && t.p) || opp(P); if (!F || F === P) return;
        const pool = F.bf.filter(isCreature); const n = Math.ceil(pool.length / 2); if (!n) return;
        const picks = await chooseSacN(F, pool, n, src.card.name);
        picks.forEach(x => { if (onBf(x.uid)) { leaveBattlefield(x, 'gy'); fire('sacrificed', { o: x, P: F }); } });
        log(`${F.name} ${sxSays(F, 'sacrifice', 'sacrifices')} ${picks.map(x => x.card.name).join(', ')}.`);
    },
    async sx_dreadDiscard(P, e, t, src) {
        const F = (t && t.p) || opp(P); if (!F || F === P) return;
        const n = Math.ceil(F.hand.length / 2);
        for (let k = 0; k < n && F.hand.length; k++) {
            const c = (F.isAI || AUTOPLAY) ? F.hand.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0] : await pickCard(F, F.hand.slice(), `${src.card.name}: discard a card (${k + 1} of ${n})`, { required: true });
            if (!c) break;
            pull(F.hand, c); F.gy.push(c); c.gyTurn = G.turn; c.discardTurn = G.turn; fire('discarded', { P: F, o: c });
            log(`${F.name} ${sxSays(F, 'discard', 'discards')} ${c.card.name}.`);
        }
    },
    sx_dreadLife(P, e, t, src) { const F = (t && t.p) || opp(P); if (!F || F === P) return; const n = Math.ceil(Math.max(0, F.life) / 2); F.life -= n; F.lostTurn = G.turn; fire('loseLife', { P: F, n }); log(`${F.name} ${sxSays(F, 'lose', 'loses')} ${n} life.`); },
    sx_senu(P, e, t, src) {
        if (!P.exile.includes(src)) return;
        pull(P.exile, src); putOntoBattlefield(P, src, true);
        const host = G.ctxObj;
        if (!G.attackers.includes(src.uid)) G.attackers.push(src.uid);
        if (host && host.atkTo !== undefined) src.atkTo = host.atkTo;
        src.attackedTurn = G.turn;
        log(`${src.card.name} returns from exile attacking.`);
    },
    sx_untapSelf(P, e, t, src) { if (onBf(src.uid)) src.tapped = false; }
});
Object.assign(CMD_SCORE, {
    sx_chandraEmblem: () => 4, sx_chandraSweep: P => allPerms().filter(c => isCreature(c) && ctrl(c) !== P && tou(c) <= 3).length * 3 - P.bf.filter(c => isCreature(c) && tou(c) <= 3).length * 3,
    sx_fanatic: P => devotion(P, ['R']) * 1.5, sx_havocEater: () => 6, sx_taskmaster: () => 6, sx_planetary: P => allPerms().filter(c => isCreature(c) && ctrl(c) !== P).length * 3 - P.bf.filter(isCreature).length * 3,
    sx_wildSurge: () => 4, sx_retarget: () => 0, sx_copyAny: () => 0, sx_formless: P => P.gy.filter(sxLand).length * 2, sx_astarion: () => 1,
    sx_appropriate: () => 6, sx_bloodTribute: P => Math.ceil(Math.max(0, opp(P).life) / 2), sx_essencePulse: P => allPerms().filter(c => isCreature(c) && ctrl(c) !== P && tou(c) <= 2).length * 3 - P.bf.filter(c => isCreature(c) && tou(c) <= 2).length * 3,
    sx_dreadSac: () => 6, sx_dreadDiscard: () => 3, sx_dreadLife: P => Math.ceil(Math.max(0, opp(P).life) / 4), sx_percher: () => 2, sx_flockBounce: () => 1
});

// Modal trigger halves (Grenzo, Glissa, Astarion)
const sxHitPlayer = () => ((G.ctxRaw && G.ctxRaw.hit) || []).map(i => (typeof i === 'number' ? G.players[i] : i)).filter(Boolean)[0];
const sxLostThisTurn = F => (F.lostTurn === G.turn ? F.lostN || 0 : 0);
Object.assign(CMD, {
    async sx_grenzoGoad(P, e, t, src) {
        const X = sxHitPlayer(); if (!X || X.out) return;
        const crs = X.bf.filter(c => isCreature(c) && !has(c, 'shroud') && !has(c, 'hexproof'));
        if (!crs.length) return;
        const c = sxAI(P) ? crs.slice().sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, crs, `${src.card.name}: goad a creature ${X.name} controls`, { required: true });
        if (c) goad(c, P.i, G.turn + G.players.filter(y => !y.out).length);
    },
    sx_grenzoExile(P, e, t, src) { const X = sxHitPlayer(); if (!X || X.out) return; const c = X.library.pop(); if (c) exilePlayFrom(P, X, c, G.turn); },
    async sx_glissaInc(P, e, t, src) { for (let k = 0; k < 2; k++) { G.lastWipeN = 2; await CMD.incubate(P, {}, null, src); } },
    async sx_glissaTr(P) { for (const c of P.bf.filter(x => x.incubatorN > 0)) await CMD.incubatorTransform(P, {}, null, c); },
    sx_glissaKw(P) { P.bf.filter(c => isCreature(c) && hasType(c, 'Phyrexian')).forEach(c => c.tkw.push('first strike', 'deathtouch')); log(`Phyrexians ${sxSays(P, 'you control', `${P.name} controls`)} gain first strike and deathtouch until end of turn.`); },
    sx_astarionLose(P, e, t, src) {
        const F = (t && t.p) || foes(P).slice().sort((a, b) => sxLostThisTurn(b) - sxLostThisTurn(a))[0]; if (!F || F === P) return;
        const n = sxLostThisTurn(F); if (!n) { log(`${F.name} lost no life this turn.`); return; }
        F.life -= n; F.lostTurn = G.turn; fire('loseLife', { P: F, n }); log(`${F.name} ${sxSays(F, 'lose', 'loses')} ${n} life (${src.card.name}).`);
    },
    sx_astarionGain(P) { const n = P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0; if (n) gainLifeFor(P, n); }
});
Object.assign(CMD_SCORE, {
    sx_grenzoGoad: () => 2, sx_grenzoExile: () => 3,
    sx_glissaInc: () => 5, sx_glissaTr: P => P.bf.filter(x => x.incubatorN > 0).length * 3, sx_glissaKw: P => P.bf.filter(c => isCreature(c) && hasType(c, 'Phyrexian')).length * 1.5,
    sx_astarionLose: P => Math.max(0, ...foes(P).map(sxLostThisTurn)), sx_astarionGain: P => (P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0)
});
