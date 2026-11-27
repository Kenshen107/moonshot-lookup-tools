// Spellslinger Duels - engine pieces for card round rk4 (2026-11-27). CMD ids start with rk4_. Wordings are in rules/rk4.js.
'use strict';
// ---- helpers ----
const rkNum = w => nw(w);
const rkMine = (P, f) => P.bf.filter(f);
const rkSelf = (P, src) => (src && onBf(src.uid)) ? src : null;
// The computer takes the best by `rank`; a person chooses (optional = may decline)
async function rkPick(P, pool, title, rank, optional) {
    if (!pool.length) return null;
    return pickOwn(P, pool, title, { optional: !!optional, rank });
}
Object.assign(TRIG_FN, {
    rk4_oppDrawExtra: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !G.inDrawStep,
    rk4_tapMana: (o, ctx) => !!ctx.mana && ctx.o === o,
    rk4_broodDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && !ctx.o.token && !has(ctx.o, 'flying'),
    rk4_myRing: (o, ctx) => !!ctx.P && ctx.P.i === o.owner
});
COND_EXTRA.push(
    [/^there are (\w+) or more creatures on the battlefield$/, m => () => allPerms().filter(isCreature).length >= rkNum(m[1])],
    [/^you attacked with (\w+) or more creatures this turn$/, m => P => !!P.rk4Atk && P.rk4Atk.turn === G.turn && P.rk4Atk.n >= rkNum(m[1])]
);
{   // record how many creatures a player attacked with (Windbrisk Heights); the next spell that can't be countered (Mistrise Village); the last permanent sacrificed (Goblin Engineer)
    const f0 = fire;
    fire = function (ev, ctx) {
        if (G && ctx) {
            if (ev === 'attacks' && ctx.list && ctx.list.length) { const P = G.players[ctx.list[0].owner]; if (P) P.rk4Atk = { turn: G.turn, n: Math.max(ctx.list.length, P.rk4Atk && P.rk4Atk.turn === G.turn ? P.rk4Atk.n : 0) }; }
            if (ev === 'cast' && ctx.P && ctx.o && ctx.P.rk4NoCtr === G.turn) { ctx.o.noCounter = true; ctx.P.rk4NoCtr = null; log(`${ctx.o.card.name} can't be countered.`); }
            if (ev === 'sacrificed' && ctx.o) G.rk4LastSac = ctx.o;
        }
        return f0.apply(this, arguments);
    };
}
{   // "Twice that many tokens / counters" from another player's Primal Vigor too
    const tm = tokenMult;
    tokenMult = function (P) { let k = tm.apply(this, arguments); G.players.forEach(X => { if (X !== P) k *= 2 ** X.bf.filter(a => Rx(a).rk4TokDoubleAll && !lostAbilities(a)).length; }); return k; };
    const ce = counterExtra;
    counterExtra = function (o, n, kind) {
        let b = ce.apply(this, arguments);
        if ((kind || '+1/+1') === '+1/+1' && isCreature(o)) G.players.forEach(X => { if (X.i !== o.owner) X.bf.forEach(a => { if (Rx(a).rk4CtrDoubleAll && !lostAbilities(a)) b = (n + b) * 2 - n; }); });
        return b;
    };
}
{   // can't-be-prevented damage (Frenzied Baloth: combat damage; Sunspine Lynx: all damage): the engine's own "G.noPrevent === this turn" switch
    const d0 = damage;
    damage = function (target, n, src) {
        if (!G || G.noPrevent === G.turn) return d0.apply(this, arguments);
        const all = allPerms().some(a => Rx(a).rk4NoPrevent && !lostAbilities(a)), comb = G.inCombatDamage && allPerms().some(a => Rx(a).rk4NoPrevCombat && !lostAbilities(a));
        if (!all && !comb) return d0.apply(this, arguments);
        G.noPrevent = G.turn;
        try { return d0.apply(this, arguments); } finally { G.noPrevent = null; }
    };
}
{   // counter-a-spell-or-ability filters of Siren Stormtamer and Dawn Charm
    const vt = validTargets;
    validTargets = function (P, e, src) {
        if (e.target === 'spell' && /^rk4_targets/.test(e.filter || '')) {
            return G.stack.filter(it => it.target && (e.filter === 'rk4_targetsMe' ? (it.kind === 'spell' && !!it.target.p && it.target.p === P) : (it.kind === 'spell' || it.kind === 'trigger') && ((it.target.p && it.target.p === P) || (it.target.o && it.target.o.owner === P.i && (isCreature(it.target.o))))) && it.P !== P).map(item => ({ item }));
        }
        return vt.apply(this, arguments);
    };
}
{   // The Ring tempts you: an event for Nazgul
    const rt = slRingTempts;
    slRingTempts = async function (P) { await rt.apply(this, arguments); fire('ringTempts', { P }); };
}
Object.assign(CMD_SCORE, { rk4_wishclaw: () => 3, rk4_noCounter: () => 0, rk4_lastMarch: (P) => 6 + Math.min(6, P.hand.filter(x => /\bCreature\b/.test(x.card.type)).length), rk4_ring: () => 4, rk4_engineer: () => 3 });
Object.assign(CMD, {
    rk4_noCounter(P, e, t, src) { P.rk4NoCtr = G.turn; log(`The next spell ${P.name} cast${you(P) ? '' : 's'} this turn can't be countered.`); },
    async rk4_wishclaw(P, e, t, src) {
        const c = await dcSearch(P, () => true, `${src.card.name}: search your library for a card`, { optional: false, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { P.hand.push(c); log(`${P.name} search${you(P) ? '' : 'es'} their library and ${you(P) ? 'put' : 'puts'} ${you(P) ? c.card.name : 'a card'} into ${you(P) ? 'your' : 'their'} hand.`); } else log(`${P.name} find${you(P) ? '' : 's'} nothing.`);
        if (!onBf(src.uid)) return;
        const X = await pickRecipient(P, { opp: true }, src);
        if (X) giveControl(src, X);
    },
    async rk4_orchard(P, e, t, src) {
        const X = await pickRecipient(P, { opp: true }, src);
        if (X) await applyEffect(X, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Spirit', kw: [] }, null, src);
    },
    async rk4_ring(P) { await slRingTempts(P); },
    async rk4_lastMarch(P, e, t, src) {
        const n = Math.max(0, ...P.bf.filter(isCreature).map(tou));
        if (n > 0) drawCards(P, n);
        const pool = () => P.hand.filter(x => /\bCreature\b/.test(x.card.type));
        if (P.isAI || AUTOPLAY) { pool().forEach(x => putOntoBattlefield(P, x, false)); return; }
        for (;;) {
            const p = pool(); if (!p.length) break;
            const x = await pickCard(P, p, `${src.card.name}: put a creature card from your hand onto the battlefield (Cancel to stop)`, { optional: true });
            if (!x) break;
            putOntoBattlefield(P, x, false);
        }
    },
    async rk4_portal(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.filter(x => /\bCreature\b/.test(x.card.type)));
        const x = await rkPick(P, pool, `${src.card.name}: put a creature card from a graveyard onto the battlefield`, (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0));
        if (!x) return;
        const from = G.players[x.owner]; x.realOwner = x.owner;
        putOntoBattlefield(P, x, false); x.addedTypes = [...(x.addedTypes || []), 'Phyrexian'];
        log(`${x.card.name} is a Phyrexian in addition to its other types.`);
    },
    async rk4_priest(P, e, t, src) {
        const x = G.ctxObj; if (!x) return; const X = G.players[x.owner]; if (!X || X.out) return;
        const yes = P.isAI || AUTOPLAY ? true : await askYes(P, `${src.card.name}: have ${X.name} lose 1 life?`, { card: src.card, yes: 'Yes', no: 'No' });
        if (!yes) return;
        X.life -= 1; log(`${X.name} lose${you(X) ? '' : 's'} 1 life (${src.card.name}).`); fire('loseLife', { P: X, n: 1 });
    },
    rk4_brood(P, e, t, src) {
        const x = G.ctxObj; if (!x) return; const O = G.players[x.owner];
        if (!O.gy.includes(x)) return;
        putOntoBattlefield(O, x, false); x.ctr = x.ctr || {}; addNamedCounter(x, 'flying', 1);
        log(`${x.card.name} returns to the battlefield with a flying counter on it.`);
    },
    async rk4_engineer(P, e, t, src) {
        const sac = G.rk4LastSac;
        const pool = P.gy.filter(x => /\bArtifact\b/.test(x.card.type) && (x.card.cmc || 0) <= 3 && x !== sac);
        const x = await rkPick(P, pool, `${src.card.name}: return an artifact card with mana value 3 or less from your graveyard to the battlefield`, (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0));
        if (x) putOntoBattlefield(P, x, false); else log(`${src.card.name}: no artifact card to return.`);
    },
    async rk4_balefire(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (!n) return;
        const h = G.ctxRaw && G.ctxRaw.hit && G.ctxRaw.hit[0]; const X = (h && h.life !== undefined ? h : null) || (h !== undefined && typeof h === 'number' ? G.players[h] : null) || opp(P);
        const hit = allPerms().filter(c => isCreature(c) && c.owner === X.i);
        log(`${src.card.name} deals ${n} damage to each creature ${X.name} controls.`);
        hit.forEach(c => damage(c, n, src)); await settle();
    },
    rk4_novelist(P, e, t, src) {
        if (!onBf(src.uid)) return;
        putCounters(src, 1, P); P.pool = (P.pool || []).concat(['R']); log(`${P.name} add${you(P) ? '' : 's'} {R}.`);
    }
});
{   // Chromatic Orrery: mana can be spent as though it were mana of any color, so colored symbols are paid like generic ones ({C} still needs colorless mana)
    const pp = planPayment;
    planPayment = function (P, cost) {
        if (G && P && cost && P.bf.some(a => Rx(a).rk4AnyColorSpend && !lostAbilities(a))) {
            const c = { ...cost }; let g = c.generic || 0;
            ['W', 'U', 'B', 'R', 'G'].forEach(k => { g += c[k] || 0; c[k] = 0; });
            c.generic = g;
            const a = Array.from(arguments); a[1] = c;
            return pp.apply(this, a);
        }
        return pp.apply(this, arguments);
    };
}
// A second target chosen as the spell resolves (accepted approximation: the first one is the spell's own target)
async function rkTarget(P, e, src) {
    const valid = validTargets(P, e, src); if (!valid.length) return null;
    if (P.isAI || AUTOPLAY) return aiPickTarget(P, e, src, valid) || valid[0];
    return await chooseTarget(P, e, src, false);
}
COND_EXTRA.push([/^it is combat on your turn$/, () => P => G.active === P.i && ['beginning', 'declareAttackers', 'declareBlocks', 'afterBlocks', 'combat', 'combatDamage'].includes(G.phase)]);
{   // "All creatures lose all abilities until end of turn" (Final Showdown)
    const la = lostAbilities;
    lostAbilities = function (o) { return !!(o && G && o.rk4NoAbil === G.turn) || la.apply(this, arguments); };
}
{   // Legolas's Quick Reflexes: the creature deals damage equal to its power when it becomes tapped; Twinferno: copy the next instant or sorcery
    const f1 = fire;
    fire = function (ev, ctx) {
        const r = f1.apply(this, arguments);
        if (G && ctx) {
            if (ev === 'tapped' && ctx.o && ctx.o.rk4Legolas === G.turn && onBf(ctx.o.uid)) (G.trigQ = G.trigQ || []).push({ P: G.players[ctx.o.owner], o: ctx.o, effects: [{ t: 'dmg', n: Math.max(0, pow(ctx.o)), target: 'creature', good: false }] });
            if (ev === 'cast' && ctx.P && ctx.o && ctx.P.rk4Twin === G.turn && ['instant', 'sorcery'].includes(Rx(ctx.o).kind)) { ctx.P.rk4Twin = null; (G.trigQ = G.trigQ || []).push({ P: ctx.P, o: ctx.o, ctxObj: ctx.o, effects: [cmd('rk4_copyStackSpell')] }); }
        }
        return r;
    };
}
Object.assign(CMD_SCORE, { rk4_archSearch: () => 5, rk4_archdruid: () => 8, rk4_waveGoodbye: P => { const mine = P.bf.filter(c => isCreature(c) && !(c.counters > 0)).length, theirs = allPerms().filter(c => isCreature(c) && c.owner !== P.i && !(c.counters > 0)).length; return theirs - mine >= 2 ? 3 + theirs - mine : 0; }, rk4_darkDeal: P => (P.hand.length <= 1 ? 0 : -1), rk4_bloodMoney: P => { const mine = P.bf.filter(isCreature).length, theirs = allPerms().filter(c => isCreature(c) && c.owner !== P.i).length; return theirs - mine >= 2 ? 6 + theirs - mine : 0; }, rk4_vraskaFall: () => 6, rk4_olivia: P => { const v = P.bf.filter(c => hasType(c, 'Vampire')).length; return v ? 4 + v : 0; }, rk4_beacon: P => (P.life >= 15 ? 5 : 2), rk4_aetherspouts: () => (G.attackers && G.attackers.length ? 5 : 0), rk4_kabira: () => 5, rk4_neoform: () => 6, rk4_legolas: () => 3, rk4_twinfernoCopy: () => 3, rk4_teamDS: () => 5, rk4_loseAbilities: () => 0, rk4_chooseIndestr: () => 2 });
Object.assign(CMD, {
    async rk4_archSearch(P, e, t, src, O, name) {
        const pool = P.library.filter(x => /\b(Creature|Land)\b/.test(x.card.type));
        const x = await rkPick(P, pool, `${name}: search for a creature or land card`, (a, b) => (/\bCreature\b/.test(b.card.type) ? 1 : 0) * 10 + (b.card.cmc || 0) - ((/\bCreature\b/.test(a.card.type) ? 1 : 0) * 10 + (a.card.cmc || 0)), true);
        if (x) { pull(P.library, x); log(`${P.name} reveal${you(P) ? '' : 's'} ${x.card.name}.`); if (/\bLand\b/.test(x.card.type)) putOntoBattlefield(P, x, true); else P.hand.push(x); }
        shuffle(P.library);
    },
    async rk4_archdruid(P, e, t, src, O, name) {
        const mine = await rkTarget(P, { t: 'pump', target: 'creature', mine: true, good: true }, src);
        if (!mine || !mine.o) { log(`${name}: no creature to target.`); return; }
        putCounters(mine.o, 1, P);
        const theirs = await rkTarget(P, { t: 'dmg', target: 'creature', theirs: true, good: false }, src);
        if (!theirs || !theirs.o) return;
        log(`${mine.o.card.name} deals ${pow(mine.o)} damage to ${theirs.o.card.name}.`); damage(theirs.o, pow(mine.o), mine.o); await settle();
    },
    async rk4_chooseIndestr(P, e, t, src, O, name) {
        const pool = P.bf.filter(isCreature);
        const x = await rkPick(P, pool, `${name}: choose a creature you control (it gains indestructible)`, (a, b) => creatureValue(b) - creatureValue(a));
        if (x) { x.tkw.push('indestructible'); log(`${x.card.name} gains indestructible until end of turn.`); }
    },
    rk4_legolas(P, e, t, src) {
        const o = t && t.o; if (!o) return;
        o.tapped = false; o.tkw.push('reach', 'hexproof'); o.rk4Legolas = G.turn;
        log(`${o.card.name} untaps and gains reach, hexproof and "Whenever this creature becomes tapped, it deals damage equal to its power to any target" until end of turn.`);
    },
    rk4_loseAbilities() { allPerms().filter(isCreature).forEach(c => { c.rk4NoAbil = G.turn; }); log('All creatures lose all abilities until end of turn.'); },
    rk4_twinfernoCopy(P) { P.rk4Twin = G.turn; log(`${P.name}'s next instant or sorcery spell this turn will be copied.`); },
    async rk4_copyStackSpell(P) {
        const it = G.stack.find(i => i.kind === 'spell' && i.o === G.ctxObj); if (!it) return;
        await copySpellItem(P, it, { retarget: true });
    },
    rk4_teamDS(P) { P.bf.filter(isCreature).forEach(c => c.tkw.push('double strike')); log('Creatures you control gain double strike until end of turn.'); },
    rk4_pipCounter(P, e, t, src) { const h = src.attachedTo && onBf(src.attachedTo); if (h) { putCounters(h, 1, P); log(`${h.card.name} gets a +1/+1 counter.`); } },
    async rk4_untapTwoLands(P, e, t, src, O, name) {
        const lands = allPerms().filter(x => /\bLand\b/.test(x.card.type) && x.tapped && (x.owner === P.i || !(P.isAI || AUTOPLAY)));
        let n = 0;
        for (let k = 0; k < 2; k++) {
            const pool = lands.filter(x => x.tapped); if (!pool.length) break;
            const x = (P.isAI || AUTOPLAY) ? pool.filter(l => l.owner === P.i)[0] : await pickCard(P, pool, `${name}: untap up to two target lands (${k + 1} of 2; Cancel to stop)`, { optional: true });
            if (!x) break; x.tapped = false; n++;
        }
        if (n) log(`${P.name} untap${you(P) ? '' : 's'} ${n} land${n === 1 ? '' : 's'}.`);
    },
    rk4_waveGoodbye(P, e, t, src) {
        const list = allPerms().filter(c => isCreature(c) && !(c.counters > 0));
        list.forEach(c => { log(`${c.card.name} returns to its owner's hand.`); leaveBattlefield(c, 'hand'); });
    },
    rk4_darkDeal(P) {
        const order = G.players.filter(X => !X.out); // the active player first is not required: the discards and draws happen as a whole
        const counts = order.map(X => { const gone = X.hand.splice(0); X.gy.push(...gone); discardMark(gone); log(`${X.name} discard${you(X) ? '' : 's'} ${gone.length} card${gone.length === 1 ? '' : 's'}.`); return gone.length; });
        order.forEach((X, i) => { if (counts[i] > 1) drawCards(X, counts[i] - 1); });
    },
    async rk4_bloodMoney(P, e, t, src, O, name) {
        const list = allPerms().filter(isCreature);
        list.forEach(c => destroy(c, name)); await settle();
        const n = list.filter(c => !c.token && G.players[c.owner].gy.includes(c)).length;
        if (n > 0) await applyEffect(P, { t: 'artToken', kind: 'treasure', n, tapped: true }, null, src);
    },
    async rk4_vraskaFall(P, e, t, src, O, name) {
        for (const V of foes(P)) {
            const pool = V.bf.filter(x => isCreature(x) || Rx(x).kind === 'planeswalker');
            if (pool.length) {
                const f = await chooseFrom(V, pool, `${name}: choose a creature or planeswalker to sacrifice`, false) || pool[0];
                log(`${V.name} ${you(V) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            }
            V.poison = (V.poison || 0) + 1; log(`${V.name} ${you(V) ? 'get' : 'gets'} a poison counter (${V.poison}).`);
        }
        await settle();
    },
    rk4_olivia(P) {
        const x = P.bf.filter(c => hasType(c, 'Vampire')).length;
        allPerms().filter(c => isCreature(c) && !hasType(c, 'Vampire')).forEach(c => { c.tp -= x; c.tq -= x; });
        log(`Each non-Vampire creature gets -${x}/-${x} until end of turn.`);
    },
    rk4_beacon(P, e, t, src) {
        const X = t && t.p; if (!X) return;
        gainLifeFor(X, Math.max(0, X.life)); src.shuffleIn = true;
    },
    async rk4_aetherspouts(P, e, t, src, O, name) {
        for (const u of (G.attackers || []).slice()) {
            const c = onBf(u); if (!c) continue; const Q = G.players[c.owner];
            const top = (Q.isAI || AUTOPLAY) ? creatureValue(c) >= 5 : (await askMode(Q, `${name}: where does ${c.card.name} go?`, ['Top of your library', 'Bottom of your library'])) === 0;
            leaveBattlefield(c, 'library');
            if (!top && Q.library.includes(c)) { pull(Q.library, c); Q.library.unshift(c); }
            log(`${c.card.name} is put on the ${top ? 'top' : 'bottom'} of ${Q.name === 'You' ? 'your' : `${Q.name}'s`} library.`);
        }
        G.attackers = [];
    },
    async rk4_kabira(P, e, t, src) {
        if (!t || !t.o) return; const n = P.bf.filter(isCreature).length;
        log(`${src.card.name} deals ${n} damage to ${t.o.card.name}.`); damage(t.o, n, src); await settle();
    },
    async rk4_neoform(P, e, t, src, O, name) {
        const sac = G.rk4LastSac; if (!sac) { log(`${name}: nothing was sacrificed.`); return; }
        const mv = (sac.card.cmc || 0) + 1;
        const x = await rkPick(P, P.library.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) === mv), `${name}: search for a creature card with mana value ${mv}`, (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0), true);
        if (x) { pull(P.library, x); putOntoBattlefield(P, x, false); putCounters(x, 1, P); }
        shuffle(P.library);
    },
    rk4_lastRetMinus() { }
});
{   // Persist: the returned creature gets a -1/-1 counter
    const ae = applyEffect;
    applyEffect = async function (P, e, t, src, O, name) {
        if (e && e.rk4Minus) G.lastReturned = null;
        const r = await ae.apply(this, arguments);
        if (e && e.rk4Minus && G.lastReturned && onBf(G.lastReturned.uid)) { G.lastReturned.counters -= 1; log(`${G.lastReturned.card.name} gets a -1/-1 counter.`); }
        return r;
    };
}
