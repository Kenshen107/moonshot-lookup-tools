// Engine pieces for the draft sets round (2026-11-18): Magic 2011, 2012, 2013, Seventh to Tenth Edition, Core Set 2019, Foundations,
// Modern Masters 2017 and Return to Ravnica. Wordings are in rules/cores.js; each odd card is a CMD entry (ids start with dc_).
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.

const dcAI = P => P.isAI || AUTOPLAY;
const dcIsLand = o => /\bLand\b/.test(o.card.type);
const dcIsCreatureCard = c => /\bCreature\b/.test(c.card.type);
const dcName = (P, you2, other) => (you(P) ? you2 : other);
// Search a library for a card (the computer takes the best by `rank`), then shuffle; returns the card (still out of the library) or null
async function dcSearch(P, pred, title, opts = {}) {
    const pool = P.library.filter(pred);
    const c = await pickOwn(P, pool, title, { optional: opts.optional !== false, rank: opts.rank });
    if (c) pull(P.library, c);
    if (opts.noShuffle !== true) shuffle(P.library);
    return c || null;
}
const dcTopCard = P => P.library[P.library.length - 1] || null;
const dcOnTop = (P, c) => P.library.push(c);
const dcOnBottom = (P, c) => P.library.unshift(c);
// A player's creature cards in hand, strongest last (what the computer would discard first is the cheapest)
const dcCheapest = (a, b) => (a.card.cmc || 0) - (b.card.cmc || 0);

// ---- Shared hooks ----
{   // Damage dealt to a player this turn (and noncombat damage), for Bloodcrazed Goblin and Chandra's Spitfire
    const f = fire;
    fire = function (ev, ctx) { if (ev === 'playerDamaged' && ctx && ctx.P && G) { ctx.P.dcDmgTurn = G.turn; if (!G.inCombatDamage) ctx.P.dcNcTurn = G.turn; } return f.apply(this, arguments); };
}
{   // Can't be the target of blue or black spells (Autumn's Veil); nongreen spells or abilities from nongreen sources (Gaea's Revenge)
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const out = vt.apply(this, arguments);
        if (!src || !src.card || !G) return out;
        const cols = src.card.colors || [], spell = !onBf(src.uid), bu = spell && (cols.includes('U') || cols.includes('B')), nong = !cols.includes('G');
        if (!bu && !nong) return out;
        return out.filter(v => !(v.o && ((bu && isCreature(v.o) && G.players[v.o.owner].dcVeil === G.turn) || (nong && Rx(v.o).dcHexNonGreen && !lostAbilities(v.o)))));
    };
}
// Extra activation costs: tap N untapped permanents of a type (Captivating Vampire), discard a creature card (Fauna Shaman)
function dcExtraCostOk(P, o, a) {
    const c = a && a.cost; if (!c) return true;
    if (c.dcTapN && P.bf.filter(x => !x.tapped && hasType(x, c.dcTapN.sub)).length < c.dcTapN.n) return false;
    if (c.dcDiscard && !P.hand.some(x => x !== o && dcIsCreatureCard(x))) return false;
    return true;
}
async function dcPayExtra(P, o, a) {
    const c = a.cost, undo = [];
    if (c.dcTapN) {
        const pool = P.bf.filter(x => !x.tapped && hasType(x, c.dcTapN.sub)), got = [];
        for (let i = 0; i < c.dcTapN.n; i++) {
            const left = pool.filter(x => !got.includes(x));
            const x = await pickOwn(P, left, `${o.card.name}: tap an untapped ${c.dcTapN.sub} (${i + 1} of ${c.dcTapN.n})`, { rank: (p, q) => permValue(p) - permValue(q) });
            if (!x) break; got.push(x);
        }
        if (got.length < c.dcTapN.n) return null;
        got.forEach(x => { x.tapped = true; fire('tapped', { o: x }); undo.push(() => { x.tapped = false; }); });
        log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${got.map(x => x.card.name).join(', ')}.`);
    }
    if (c.dcDiscard) {
        const pool = P.hand.filter(x => x !== o && dcIsCreatureCard(x));
        const d = await pickOwn(P, pool, `${o.card.name}: discard a creature card`, { rank: (p, q) => dcCheapest(p, q) });
        if (!d) { undo.forEach(u => u()); return null; }
        pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); fire('discarded', { P, o: d });
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`);
        undo.push(() => { pull(P.gy, d); P.hand.push(d); });
    }
    return { undo: () => undo.forEach(u => u()) };
}
{
    const ca = canActivate;
    canActivate = function (P, o, a) { return dcExtraCostOk(P, o, a) && ca.apply(this, arguments); };
    const ac = activate;
    activate = async function (P, o, a, ...rest) {
        const extra = a && a.cost && (a.cost.dcTapN || a.cost.dcDiscard);
        const paid = extra ? await dcPayExtra(P, o, a) : null;
        if (extra && !paid) return false;
        const r = await ac.call(this, P, o, a, ...rest);
        if (!r && paid) paid.undo();
        return r;
    };
}

COND_EXTRA.push(
    [/^~ is attacking$/, () => (P, o) => !!o && G.attackers.includes(o.uid)],
    [/^an opponent has been dealt damage this turn$/, () => P => foes(P).some(F => F.dcDmgTurn === G.turn)],
    [/^there are five or more Islands on the battlefield$/, () => P => allPerms().filter(x => hasType(x, 'Island')).length >= 5]
);
Object.assign(TRIG_FN, {
    dc_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    dc_myUpkeep: (o, ctx) => G.active === o.owner,
    dc_oppNoncombat: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !G.inCombatDamage,
    dc_selfTargetedByOpp: (o, ctx) => ctx.o === o && ctx.by !== undefined && ctx.by !== o.owner
});

Object.assign(CMD, {
    // ===== Magic 2011 =====
    dc_veil(P, e, t, src) { P.dcVeil = G.turn; log(`${P.name} ${you(P) ? 'have' : 'has'} spells that can't be countered by blue or black spells, and creatures that can't be targeted by blue or black spells, this turn.`); },
    dc_captivating(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        giveControl(t.o, P);
        (t.o.addedTypes = t.o.addedTypes || []).push('Vampire');
        log(`${P.name} ${you(P) ? 'gain' : 'gains'} control of ${t.o.card.name}; it's a Vampire in addition to its other types.`);
    },
    dc_combust(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        const prev = G.noPrevent; G.noPrevent = G.turn;
        try { damage(t.o, 5, src); } finally { G.noPrevent = prev; }
    },
    // Conundrum Sphinx: every player names a card, then reveals the top card of their library
    async dc_conundrum(P, e, t, src) {
        for (const X of G.players.filter(p => !p.out)) {
            let name = null;
            if (dcAI(X)) { const pool = X.library.slice(0, -1).filter(c => !isBasic(c.card)); name = (pool.length ? pool[rand(pool.length)] : X.library[0] || { card: { name: '' } }).card.name; }
            else name = await askName(X, `${src.card.name}: name a card`, { card: src.card });
            const top = dcTopCard(X); if (!top) continue;
            const hit = !!name && top.card.name.toLowerCase() === String(name).toLowerCase();
            log(`${X.name} ${you(X) ? 'name' : 'names'} ${name || 'nothing'} and reveal${you(X) ? '' : 's'} ${top.card.name}.`);
            pull(X.library, top);
            if (hit) { X.hand.push(top); log(`${X.name} ${you(X) ? 'put' : 'puts'} it into ${you(X) ? 'your' : 'their'} hand.`); } else { dcOnBottom(X, top); log(`${X.name} ${you(X) ? 'put' : 'puts'} it on the bottom of ${you(X) ? 'your' : 'their'} library.`); }
        }
    },
    async dc_cyclops(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid) || !onBf(src.uid)) return;
        const yes = dcAI(P) ? pow(t.o) < tou(src) : await askYes(P, `${src.card.name}: deal ${pow(src)} damage to ${t.o.card.name}? It deals ${pow(t.o)} damage back.`, { card: src.card });
        if (!yes) return;
        const a = pow(src), b = pow(t.o);
        damage(t.o, a, src); damage(src, b, t.o);
        log(`${src.card.name} and ${t.o.card.name} fight.`);
    },
    // Dark Tutelage: the top card goes to your hand and you lose life equal to its mana value
    dc_tutelage(P, e, t, src) {
        const c = dcTopCard(P); if (!c) return;
        pull(P.library, c); P.hand.push(c);
        log(`${P.name} reveal${you(P) ? '' : 's'} ${c.card.name} and put${you(P) ? '' : 's'} it into ${you(P) ? 'your' : 'their'} hand.`);
        const n = c.card.cmc || 0; if (n > 0) gLose(P, n);
    },
    // Destructive Force: each player sacrifices five lands, then 5 damage to each creature
    async dc_destructiveForce(P, e, t, src) {
        for (const X of G.players.filter(p => !p.out)) {
            const pool = X.bf.filter(dcIsLand), n = Math.min(5, pool.length);
            const fs = await chooseSacN(X, pool, n, src.card.name);
            fs.forEach(l => { fire('sacrificed', { o: l }); dieOrLeave(l, 'gy'); });
            log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${fs.length} land${fs.length === 1 ? '' : 's'}.`);
        }
        allPerms().filter(isCreature).forEach(c => damage(c, 5, src));
        sba(); await settle();
    },
    async dc_fauna(P, e, t, src) {
        const c = await dcSearch(P, dcIsCreatureCard, `${src.card.name}: search for a creature card`, { optional: false, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { P.hand.push(c); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name} and put${you(P) ? '' : 's'} it into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Frost Titan: counter the spell or ability that targeted it unless its controller pays {2}
    async dc_frostTitan(P, e, t, src) {
        const it = src.dcLastTargeter; if (!it || !G.stack.includes(it)) return;
        await applyEffect(P, { t: 'counter', unless: 2 }, { item: it }, src);
    },
    dc_gargoyle(P, e, t, src) { if (!onBf(src.uid)) return; src.dcNoDefTurn = G.turn; src.tkw.push('flying'); log(`${src.card.name} loses defender and gains flying until end of turn.`); },
    // Hoarding Dragon: search for an artifact card and exile it; when the Dragon dies, the exiled card may go to its owner's hand
    async dc_hoardSearch(P, e, t, src) {
        const yes = dcAI(P) ? P.library.some(c => /\bArtifact\b/.test(c.card.type)) : await askYes(P, `${src.card.name}: search your library for an artifact card and exile it?`, { card: src.card });
        if (!yes) return;
        const c = await dcSearch(P, c2 => /\bArtifact\b/.test(c2.card.type), `${src.card.name}: choose an artifact card to exile`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { P.exile.push(c); src.dcExiled = c; log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name} with ${src.card.name}.`); }
    },
    async dc_hoardReturn(P, e, t, src) {
        const c = src.dcExiled; if (!c) return;
        const H = G.players[c.owner]; if (!H.exile.includes(c)) return;
        const yes = dcAI(P) ? true : await askYes(P, `${src.card.name}: put ${c.card.name} into its owner's hand?`, { card: c.card });
        if (!yes) return;
        pull(H.exile, c); H.hand.push(c); src.dcExiled = null; log(`${c.card.name} goes into ${H.name}'s hand.`);
    },
    // Hunters' Feast: any number of target players each gain 6 life
    async dc_feast(P, e, t, src) {
        const live = G.players.filter(p => !p.out);
        const chosen = dcAI(P) ? [P] : await pickPlayers(P, `${src.card.name}: choose any number of players to gain 6 life`, live, [P]);
        for (const X of chosen || []) gainLifeFor(X, 6);
    },
    // Incite: the creature becomes red until end of turn and attacks this turn if able
    dc_incite(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        const o = t.o;
        if (!o.dcCardBack) o.dcCardBack = o.card;
        o.card = { ...o.card, colors: ['R'] }; o.mustAttackTurn = G.turn;
        log(`${o.card.name} becomes red until end of turn and attacks this turn if able.`);
    }
});
Object.assign(CMD, {
    // Remnant of the Rising Star: pay {X}, put X +1/+1 counters on the creature that entered (the computer pays what it can spare, at most 6)
    async dc_remnantX(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || !onBf(x.uid)) return;
        let mx = 0; while (mx < 30 && planPayment(P, parseCost(''), mx + 1)) mx++;
        if (mx <= 0) return;
        const n = dcAI(P) ? Math.min(mx, 6) : await askNumber(P, `${src.card.name}: pay {X} to put X +1/+1 counters on ${x.card.name}?`, 0, mx, Math.min(mx, 3), { card: src.card });
        if (!n || n <= 0) return;
        planPayment(P, parseCost(''), n).forEach(y => tapSource(P, y));
        const got = putCounters(x, n, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (${src.card.name}).`);
    }
});
Object.assign(CMD_SCORE, {
    dc_remnantX: () => 3, dc_veil: () => 0, dc_combust: () => 8, dc_feast: () => 1, dc_incite: () => 0, dc_destructiveForce: () => 0
});

// ---- Goblin Cannon (owner, 2026-11-18): its sacrifice happens as the ability resolves, so with priority held it can be activated again and again ----
{
    const prev = activate;
    activate = async function (P, o, a, ...rest) {
        if (!(o && o.card.name === 'Goblin Cannon' && a && a.effects && a.effects.some(e => e.t === 'sacSelf') && !a.dcHeld)) return prev.call(this, P, o, a, ...rest);
        const a2 = { ...a, dcHeld: true, effects: a.effects.filter(e => e.t !== 'sacSelf') };
        const first = await prev.call(this, P, o, a2, ...rest);
        if (!first) return first;
        let n = 1;
        while (n < ((typeof infiniteNow === 'function' && infiniteNow(P)) ? 400 : 150) && !G.over && onBf(o.uid) && canActivate(P, o, a2)) {
            const live = foes(P).filter(F => !F.out && F.life > 0);
            if (!live.length) break;
            let again;
            if (dcAI(P) && !(typeof window !== 'undefined' && window.__DC_HUMAN && !P.isAI)) {
                const spare = P.bf.filter(x => !x.tapped && Rx(x).mana).length >> 1;
                again = (typeof infiniteNow === 'function' && infiniteNow(P)) || live.some(F => F.life <= n + spare);
            } else {
                // A person says how many more times, and at whom, in one step (2026-11-24, owner's pod record: 80 activations took about 160 taps)
                const cap = Math.min(((typeof infiniteNow === 'function' && infiniteNow(P)) ? 400 : 150) - n, 400);
                const more = await askNumber(P, `Goblin Cannon: its ability is on the stack and it isn't sacrificed until it resolves. Activate it how many more times (${n} so far)?`, 0, cap, 0, { card: o.card, ok: 'Activate', noCancel: true });
                if (!(more > 0)) break;
                let aim = null;
                if (live.length > 1) {
                    const r = await askMode(P, `Goblin Cannon: aim all ${more} at...`, [...live.map(F => `${F.name} (${F.life} life)`), 'Choose each one']);
                    if (typeof r === 'number' && r < live.length) aim = live[r];
                } else aim = live[0];
                let done = 0;
                for (; done < more && !G.over && onBf(o.uid) && canActivate(P, o, a2); done++) {
                    if (aim && (aim.out || aim.life <= 0)) { const alive = foes(P).filter(F => !F.out && F.life > 0); if (!alive.length) break; aim = alive[0]; }
                    if (!(await prev.call(this, P, o, a2, aim ? { p: aim } : undefined, ...rest.slice(1)))) break;
                }
                n += done;
                break;
            }
            if (!again) break;
            if (!(await prev.call(this, P, o, a2, ...rest))) break;
            n++;
        }
        if (n > 1) log(`${P.name} ${you(P) ? 'activate' : 'activates'} ${o.card.name} ${n} times before the first ability resolves.`);
        if (onBf(o.uid)) { log(`${o.card.name} is sacrificed.`); fire('sacrificed', { o }); dieOrLeave(o, 'gy'); await settle(); }
        return true;
    };
}
