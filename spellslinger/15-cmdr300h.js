// Spellslinger Duels - engine pieces for commander round 4, batch h (2026-10-26). Wordings are in rules/cmdr300h.js.
// Every global here starts with h_ (or is a CMD / TRIG_FN / STATIC_FN key starting with h_) so the other batches can't collide.
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.

const h_human = P => !(P.isAI || AUTOPLAY);
const h_gained = P => (P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0);
const h_lost = P => (P.lostTurn === G.turn ? P.lostN || 0 : 0);
const h_lose = (X, n) => { if (n <= 0 || X.out) return; X.life -= n; X.lostTurn = G.turn; X.lostN = (X.lostN && X.lostNTurn === G.turn ? X.lostN : 0) + n; X.lostNTurn = G.turn; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); };
const h_nctr = x => (x.counters > 0 ? x.counters : 0) + Object.entries(x.ctr || {}).filter(([k]) => k !== 'loyalty' && k !== 'defense').reduce((a, [, b]) => a + (b > 0 ? b : 0), 0);
const h_hexproofish = x => has(x, 'hexproof') || has(x, 'shroud');
// a creature on a battlefield I may target: mine, or an opponent's without hexproof / shroud
const h_targets = (P, test) => G.players.flatMap(X => X.bf.filter(x => isCreature(x) && (!test || test(x)) && (X === P || !h_hexproofish(x))));
// any target for damage: an opposing creature or a player; returns { o } or { p }
async function h_dmgTarget(P, src, n, title) {
    const cr = foes(P).flatMap(F => F.bf.filter(x => isCreature(x) && !h_hexproofish(x)));
    const opts = [...cr.map(x => ({ o: x, label: `${x.card.name} (${pow(x)}/${tou(x)})` })), ...foes(P).map(F => ({ p: F, label: F.name }))];
    if (!opts.length) return null;
    if (!h_human(P)) {
        const kill = cr.filter(x => tou(x) <= n).sort((a, b) => creatureValue(b) - creatureValue(a))[0];
        if (kill && creatureValue(kill) >= 4) return { o: kill };
        return { p: foes(P).sort((a, b) => a.life - b.life)[0] };
    }
    return opts[await askMode(P, `${src.card.name}: ${title}`, opts.map(x => x.label))] || opts[0];
}
function h_hit(t, n, src) { if (!t) return; if (t.p) { damage(t.p, n, src); } else if (t.o && onBf(t.o.uid)) damage(t.o, n, src); }
// The player my hitPlayer trigger's source hurt (not me)
const h_victims = (o, ctx) => (ctx.hit || []).map(H => G.players[H.i]).filter(F => F && F.i !== o.owner);
// turn bookkeeping on a player
function h_note(P, key, v) { const k = 'h_' + key; if (v === undefined) return P[k] && P[k].turn === G.turn ? P[k].v : undefined; P[k] = { turn: G.turn, v }; return v; }

// ---------- global wrappers (each calls the previous version) ----------
// Thantis, the Warweaver: all creatures attack each combat if able
const h_origForced = forcedAttack;
forcedAttack = function (o) { return h_origForced(o) || allPerms().some(a => Rx(a).h_thantis && !lostAbilities(a)); };
// Obzedat, Ghost Council: back from exile at the beginning of your next upkeep, with haste
const h_origSuspendTick = suspendTick;
suspendTick = async function (P) {
    const back = (P.h_back || []).splice(0);
    for (const c of back) {
        if (!P.exile.includes(c)) continue;
        pull(P.exile, c); putOntoBattlefield(P, c); c.sick = false; c.tkw.push('haste');
        log(`${c.card.name} returns to the battlefield with haste.`);
    }
    return h_origSuspendTick(P);
};

STATIC_FN.h_legendaryCreature = o => isCreature(o) && /\bLegendary\b/.test(o.card.type);

Object.assign(TRIG_FN, {
    h_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    h_mineAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    h_sacClue: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Clue'),
    h_selfHits: (o, ctx) => ctx.src === o && h_victims(o, ctx).length > 0,
    h_selfHitsFirst: (o, ctx) => { if (ctx.src !== o || !h_victims(o, ctx).length) return false; if (o.h_hitTurn === G.turn) return false; o.h_hitTurn = G.turn; return true; },
    // Estinien: remember who ~ or a Dragon of mine dealt combat damage to this turn (no effect of its own)
    h_estNote: (o, ctx) => { if (ctx.src && ctx.src.owner === o.owner && (ctx.src === o || hasType(ctx.src, 'Dragon'))) { const P = G.players[o.owner]; const s = h_note(P, 'est') || []; h_victims(o, ctx).forEach(F => { if (!s.includes(F.i)) s.push(F.i); }); h_note(P, 'est', s); } return false; },
    h_myMain2: (o, ctx) => G.active === o.owner,
    h_mathasDies: (o, ctx) => !!ctx.lki && !!(ctx.lki.ctr || {}).bounty,
    h_newcomerHits: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && ctx.src.enteredTurn === G.turn && (ctx.hit || []).some(H => H.i !== o.owner),
    h_mineLeaves: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    h_markLeft: (o, ctx) => { if (ctx.o && ctx.o.owner === o.owner) h_note(G.players[o.owner], 'left', true); return false; },
    h_leftThisTurn: (o, ctx) => h_note(G.players[o.owner], 'left') === true && G.active === o.owner,
    h_auraEquipLeaves: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\b(Aura|Equipment)\b/.test(ctx.o.card.type),
    h_artifactAttackers: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && isCreature(x) && /\bArtifact\b/.test(x.card.type)),
    h_dealtDmg: (o, ctx) => ctx.o === o,
    h_mntEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ['Mutant', 'Ninja', 'Turtle'].some(t => hasType(ctx.o, t)),
    h_myAttackerDies: (o, ctx) => { const x = ctx.o; if (!x || x.owner !== o.owner) return false; return (G.attackers || []).includes(x.uid); },
    h_gainedEnd: (o, ctx) => h_gained(G.players[o.owner]) > 0,
    h_otherEnters: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o),
    h_legendaryAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && /\bLegendary\b/.test(x.card.type)),
    h_blueNoncreature: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && Rx(ctx.o).kind !== 'creature' && Rx(ctx.o).kind !== 'land' && /\{[^}]*U[^}]*\}/.test(ctx.o.card.cost || ''),
    h_myInstSorc: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind),
    h_myCreatureCast: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && Rx(ctx.o).kind === 'creature',
    h_eshki: (o, ctx) => { const P = G.players[o.owner]; const nc = P.nonCreatureNTurn === G.turn ? P.nonCreatureN : 0; const all = P.castTurn === G.turn ? P.castN || 0 : 0; return nc > 0 && all - nc > 0; },
    h_selfCounters: (o, ctx) => ctx.o === o && (ctx.n || 0) > 0,
    h_selfDies: (o, ctx) => ctx.o === o,
    h_hasAttackOpp: (o, ctx) => (ctx.list || []).includes(o) && foes(G.players[o.owner]).length > 0,
    h_mysterioLeaves: (o, ctx) => ctx.o === o,
    h_myNontokenEnd: (o, ctx) => G.active === o.owner
});

Object.assign(CMD_SCORE, { h_shredder: () => 7, h_martha: () => 2, h_bebop: () => 4, h_estinien: () => 4, h_mishraEm: () => 7, h_yosei: () => 8, h_krav: () => 3, h_daxos: () => 5, h_mathas: () => 3, h_mathasDraw: () => 0, h_mirko: () => 3, h_seifer: () => 6, h_hulk: () => 6, h_vela: () => 2, h_lulu: () => 4, h_tiana: () => 2, h_willowdusk: () => 3, h_ignis: () => 2, h_aloy: () => 6, h_phabine: () => 6, h_raphael: () => 8, h_coulson: () => 3, h_quickbeam: () => 5, h_obzedat: () => 2, h_tuya: () => 3, h_eshki: () => 4, h_alora: () => 5, h_april: () => 2, h_karador: () => 6, h_obuun: () => 4, h_hobbits: () => 6, h_goro: () => 8, h_tivash: () => 5, h_krang: () => 3, h_olivia: () => 3, h_fifth: () => 5, h_interceptor: () => 4, h_roalesk: () => 3, h_namor: () => 4, h_arni: () => 5, h_sable: () => 2, h_mysterio: () => 7, h_jareth: () => 2, h_doom: () => 4, h_hidetsugu: () => 5, h_azog: () => 8, h_lonis: () => 3, h_rhys: () => 2, h_shiko: () => 6, h_wasitora: () => 6, h_jadzi: () => 6, h_donal: () => 5, h_iroh: () => 2 });

Object.assign(CMD, {
    // Shredder, Shadow Master: a tapped and attacking token copy for each other opponent, sacrificed at end of combat
    async h_shredder(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const at = src.atkTo !== undefined && src.atkTo !== null ? src.atkTo : G.defender;
        const others = foes(P).filter(F => F.i !== at); if (!others.length) return;
        for (const F of others) {
            const card = { ...src.card, type: (src.card.type || '').replace(/Legendary /, '') };
            const tok = tokenCopyOf(P, card); tok.tapped = true; tok.sick = false; tok.sacEndCombat = true; tok.atkTo = F.i;
            if (!(G.attackers || []).includes(tok.uid)) G.attackers.push(tok.uid);
            log(`${tok.card.name} enters tapped and attacking ${F.name}.`);
        }
    },
    // Martha Jones: ~ and up to one other target creature can't be blocked this turn
    async h_martha(P, e, t, src) {
        if (onBf(src.uid)) src.tkw.push('unblockable');
        const x = await pickOwn(P, h_targets(P, y => y !== src && y.owner === P.i), `${src.card.name}: up to one other target creature can't be blocked`, { optional: true, rank: (a, b) => pow(b) - pow(a) });
        if (x) x.tkw.push('unblockable');
        log(`${src.card.name}${x ? ` and ${x.card.name}` : ''} can't be blocked this turn.`);
    },
    // Bebop, Skull & Crossbones: draw X cards (X = counters on ~) and lose X life
    async h_bebop(P, e, t, src) {
        const X = h_nctr(src); if (X <= 0 || !onBf(src.uid)) return;
        const yes = h_human(P) ? await askYes(P, `${src.card.name}: draw ${X} card${X === 1 ? '' : 's'} and lose ${X} life?`, { card: src.card }) : P.life > X + 8;
        if (!yes) return;
        drawCards(P, X); h_lose(P, X);
    },
    // Estinien Varlineau: draw X and lose X, X = opponents dealt combat damage by ~ or a Dragon this turn
    h_estinien(P, e, t, src) {
        const s = h_note(P, 'est') || []; const X = s.length; if (X <= 0) return;
        drawCards(P, X); h_lose(P, X);
    },
    // Mishra, Eminent One: a hasty 4/4 Construct copy of a noncreature artifact, sacrificed at the next end step
    async h_mishraEm(P, e, t, src) {
        const pool = P.bf.filter(x => /\bArtifact\b/.test(x.card.type) && !isCreature(x));
        const x = await pickOwn(P, pool, `${src.card.name}: copy a noncreature artifact you control`, { rank: (a, b) => permValue(b) - permValue(a) }); if (!x) return;
        const sub = ((x.card.type.split(' — ')[1]) || '').trim();
        const card = { ...x.card, name: `${src.card.name.split(',')[0]}'s Warform`, type: `Artifact Creature — Construct${sub ? ' ' + sub : ''}`, power: '4', toughness: '4' };
        const tok = tokenCopyOf(P, card, { p: 4, q: 4 }); tok.tkw.push('haste'); tok.sick = false;
        atEndStep(() => { if (onBf(tok.uid)) dieOrLeave(tok, 'gy'); }, `${tok.card.name} is sacrificed.`);
    },
    // Yosei, the Morning Star: target player skips their next untap step; tap up to five of their permanents
    async h_yosei(P, e, t, src) {
        const fs = foes(P); if (!fs.length) return;
        const X = !h_human(P) || fs.length === 1 ? fs.slice().sort((a, b) => b.bf.length - a.bf.length)[0] : fs[await askMode(P, `${src.card.name}: target player skips their next untap step`, fs.map(f => f.name))] || fs[0];
        X.bf.forEach(x => { x.skipUntap = true; });
        let pool = X.bf.filter(x => !x.tapped && !h_hexproofish(x));
        for (let k = 0; k < 5 && pool.length; k++) {
            const x = await pickOwn(P, pool, `${src.card.name}: tap up to five target permanents (${k}/5)`, { optional: true, rank: (a, b) => permValue(b) - permValue(a) }); if (!x) break;
            pull(pool, x); x.tapped = true; fire('tapped', { o: x }); log(`${x.card.name} is tapped.`);
        }
        log(`${X.name} skips their next untap step.`);
    },
    // Krav, the Unredeemed: sacrifice X creatures; target player draws X cards and gains X life; X +1/+1 counters on ~
    async h_krav(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src || (x === src && false));
        const others = P.bf.filter(x => isCreature(x));
        const max = others.length; if (max <= 0) return;
        let X = h_human(P) ? await askNumber(P, `${src.card.name}: sacrifice how many creatures?`, 0, max, Math.min(2, max), { card: src.card }) : Math.min(max, others.filter(x => x !== src && creatureValue(x) < 3).length);
        if (!X) return;
        const chosen = await chooseSacN(P, others, X, src.card.name); X = chosen.length; if (!X) return;
        chosen.forEach(x => { fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); });
        const tp = P; drawCards(tp, X); gainLifeFor(tp, X);
        if (onBf(src.uid)) putCounters(src, X, P);
    },
    // Daxos of Meletis: exile the top card of that player's library; gain life equal to its mana value; you may cast it this turn
    h_daxos(P, e, t, src) {
        const F = h_victims(src, G.ctxRaw || {})[0] || foes(P)[0]; if (!F) return;
        const c = F.library.pop(); if (!c) return;
        exilePlayFrom(P, F, c, G.turn);
        const mv = c.card.cmc || 0; if (mv > 0) gainLifeFor(P, mv);
    },
    // Mathas, Fiend Seeker: a bounty counter on an opponent's creature
    async h_mathas(P, e, t, src) {
        const x = await pickOwn(P, foes(P).flatMap(F => F.bf.filter(c => isCreature(c) && !h_hexproofish(c) && !(c.ctr && c.ctr.bounty))), `${src.card.name}: put a bounty counter on target creature an opponent controls`, { rank: (a, b) => creatureValue(a) - creatureValue(b) });
        if (!x) return; x.ctr.bounty = 1; log(`${x.card.name} gets a bounty counter.`);
    },
    // a bountied creature died: each opponent of its controller draws a card and gains 2 life
    h_mathasDraw(P, e, t, src) {
        const dead = (G.ctxRaw || {}).o; if (!dead) return;
        const owner = G.players[dead.owner];
        G.players.filter(X => X !== owner && !X.out).forEach(X => { drawCards(X, 1); gainLifeFor(X, 2); });
    },
    // Mirko Vosk, Mind Drinker: that player reveals cards until four lands and puts them into their graveyard
    h_mirko(P, e, t, src) {
        for (const F of h_victims(src, G.ctxRaw || {})) {
            let lands = 0; const rev = [];
            while (F.library.length && lands < 4) { const c = F.library.pop(); rev.push(c); if (/\bLand\b/.test(c.card.type)) lands++; }
            F.gy.push(...rev); log(`${F.name} reveals ${rev.length} card${rev.length === 1 ? '' : 's'} and puts them into their graveyard.`);
            fire('milled', { P: F, n: rev.length });
        }
    },
    // Seifer Almasy: cast an instant or sorcery with mana value 3 or less from your graveyard for free; exile it afterwards
    async h_seifer(P, e, t, src) {
        const pool = P.gy.filter(c => ['instant', 'sorcery'].includes(Rx(c).kind) && (c.card.cmc || 0) <= 3 && Rx(c).support !== 'none');
        const c = await pickOwn(P, pool, `${src.card.name}: cast an instant or sorcery with mana value 3 or less from your graveyard without paying its mana cost?`, { optional: true }); if (!c) return;
        c.exileAfter = true; if (!await castFreeAuto(P, c)) c.exileAfter = false;
    },
    // Red Hulk: a +1/+1 counter, then damage equal to the number of +1/+1 counters to any other target
    async h_hulk(P, e, t, src) {
        if (!onBf(src.uid)) return;
        putCounters(src, 1, P); const n = Math.max(0, src.counters); if (n <= 0) return;
        const tg = await h_dmgTarget(P, src, n, `deal ${n} damage to any other target`);
        h_hit(tg, n, src);
    },
    // Vela the Night-Clad: each opponent loses 1 life
    h_vela(P, e, t, src) { foes(P).forEach(F => h_lose(F, 1)); },
    // Lulu, Loyal Hollyphant: a +1/+1 counter on each tapped creature you control, then untap them
    h_lulu(P, e, t, src) {
        const tp = P.bf.filter(x => isCreature(x) && x.tapped);
        tp.forEach(x => putCounters(x, 1, P)); tp.forEach(x => { x.tapped = false; }); if (tp.length) log(`${tp.length} creature${tp.length === 1 ? '' : 's'} get a +1/+1 counter and untap.`);
    },
    // Tiana, Ship's Caretaker: return the Aura or Equipment to hand at the next end step
    async h_tiana(P, e, t, src) {
        const dead = (G.ctxRaw || {}).o; if (!dead || !P.gy.includes(dead)) return;
        const yes = h_human(P) ? await askYes(P, `${src.card.name}: return ${dead.card.name} to your hand at the beginning of the next end step?`, { card: dead.card }) : true; if (!yes) return;
        atEndStep(() => { if (P.gy.includes(dead)) { pull(P.gy, dead); P.hand.push(dead); log(`${dead.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); } }, '');
    },
    // Willowdusk, Essence Seer: counters on another creature = the greater of life gained and life lost this turn
    async h_willowdusk(P, e, t, src) {
        const n = Math.max(h_gained(P), h_lost(P)); if (n <= 0) return;
        const x = await pickOwn(P, h_targets(P, y => y !== src && y.owner === P.i), `${src.card.name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on another target creature`, { rank: (a, b) => pow(b) - pow(a) }); if (!x) return;
        putCounters(x, n, P);
    },
    // Ignis Scientia: exile a card from a graveyard; a Food if it was a creature
    async h_ignis(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy);
        const c = await pickOwn(P, pool, `${src.card.name}: exile target card from a graveyard`, { rank: (a, b) => (G.players[a.owner] === P ? 1 : 0) - (G.players[b.owner] === P ? 1 : 0) || (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        const home = G.players.find(X => X.gy.includes(c)); pull(home.gy, c); home.exile.push(c); log(`${c.card.name} is exiled.`);
        if (/\bCreature\b/.test(c.card.type)) makeArtifactToken(P, 'food');
    },
    // Aloy, Savior of Meridian: discover X, X = greatest power among the attacking artifact creatures
    async h_aloy(P, e, t, src) {
        const l = ((G.ctxRaw || {}).list || []).filter(x => x.owner === P.i && isCreature(x) && /\bArtifact\b/.test(x.card.type));
        const X = Math.max(0, ...l.map(x => pow(x))); if (X <= 0) return;
        await cascade(P, src, X);
    },
    // Phabine, Boss's Confidant: every player reveals the top card; Citizens for lands, +1/+1 for nonlands; then each draws
    async h_phabine(P, e, t, src) {
        let lands = 0, non = 0;
        for (const X of G.players.filter(x => !x.out)) { const c = X.library[X.library.length - 1]; if (!c) continue; log(`${X.name} reveal${you(X) ? '' : 's'} ${c.card.name}.`); if (/\bLand\b/.test(c.card.type)) lands++; else non++; }
        if (lands > 0) await applyEffect(P, { t: 'token', n: lands, p: 1, q: 1, name: 'green and white Citizen', kw: [] }, null, src);
        if (non > 0) { P.bf.filter(isCreature).forEach(x => { x.tp += non; x.tq += non; }); log(`Creatures you control get +${non}/+${non} until end of turn.`); }
        G.players.filter(x => !x.out).forEach(X => drawCards(X, 1));
    },
    // Raphael, Tag Team Tough: untap all attacking creatures; an additional combat phase follows
    h_raphael(P, e, t, src) {
        (G.attackers || []).map(onBf).filter(Boolean).forEach(x => { x.tapped = false; });
        log('All attacking creatures untap.');
        if (!G.extraCombatOn) { G.extraCombat = (G.extraCombat || 0) + 1; log('There is an additional combat phase after this one.'); }
    },
    // Agent Phil Coulson: a +1/+1 counter on each other Hero you control
    h_coulson(P, e, t, src) { P.bf.filter(x => x !== src && isCreature(x) && hasType(x, 'Hero')).forEach(x => putCounters(x, 1, P)); },
    // Quickbeam, Upstart Ent: up to two target creatures each get +2/+2 and trample
    async h_quickbeam(P, e, t, src) {
        let pool = h_targets(P);
        for (let k = 0; k < 2 && pool.length; k++) {
            const x = await pickOwn(P, pool, `${src.card.name}: up to two target creatures get +2/+2 and trample (${k}/2)`, { optional: true, rank: (a, b) => (b.owner === P.i ? 1 : 0) - (a.owner === P.i ? 1 : 0) || pow(b) - pow(a) }); if (!x) break;
            pull(pool, x); x.tp += 2; x.tq += 2; x.tkw.push('trample'); log(`${x.card.name} gets +2/+2 and trample until end of turn.`);
        }
    },
    // Obzedat, Ghost Council: exile ~ now, back at your next upkeep with haste
    async h_obzedat(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const yes = h_human(P) ? await askYes(P, `${src.card.name}: exile it? It returns at the beginning of your next upkeep.`, { card: src.card }) : foes(P).some(F => F.life > 2);
        if (!yes) return;
        leaveBattlefield(src, 'exile'); (P.h_back = P.h_back || []).push(src);
        log(`${src.card.name} is exiled; it returns at the beginning of your next upkeep.`);
    },
    // Tuya Bearclaw: +X/+X, X = the greatest power among other creatures you control
    h_tuya(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const X = Math.max(0, ...P.bf.filter(x => x !== src && isCreature(x)).map(x => pow(x))); if (X <= 0) return;
        src.tp += X; src.tq += X; log(`${src.card.name} gets +${X}/+${X} until end of turn.`);
    },
    // Eshki Dragonclaw: draw a card and put two +1/+1 counters on ~
    h_eshki(P, e, t, src) { if (!onBf(src.uid)) return; drawCards(P, 1); putCounters(src, 2, P); },
    // Alora, Merry Thief: an attacking creature can't be blocked; it returns to hand at the next end step
    async h_alora(P, e, t, src) {
        const pool = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && isCreature(x));
        const x = await pickOwn(P, pool, `${src.card.name}: up to one target attacking creature can't be blocked this turn`, { optional: true, rank: (a, b) => pow(b) - pow(a) }); if (!x) return;
        x.tkw.push('unblockable'); log(`${x.card.name} can't be blocked this turn.`);
        atEndStep(() => { if (onBf(x.uid) && !x.token) { pull(P.bf, x); P.hand.push(x); fire('leaves', { o: x }); log(`${x.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); } else if (onBf(x.uid)) leaveBattlefield(x, 'gy'); }, '');
    },
    // Karador, Ghost Chieftain: once each turn, cast a creature spell from your graveyard
    async h_karador(P, e, t, src) { await c_castFromGy(P, src, x => Rx(x).kind === 'creature', 'a creature spell'); },
    // Obuun, Mul Daya Ancestor: a land becomes an X/X Elemental with trample and haste until end of turn
    async h_obuun(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type) && !isCreature(x));
        const x = await pickOwn(P, lands, `${src.card.name}: up to one target land you control becomes an X/X Elemental creature`, { optional: true, rank: (a, b) => (a.tapped ? 1 : 0) - (b.tapped ? 1 : 0) }); if (!x) return;
        const X = Math.max(0, pow(src));
        x.permAnimated = { p: X, q: X }; x.addedTypes = (x.addedTypes || []).concat(['Elemental']); x.tkw.push('trample', 'haste'); x.sick = false;
        atEndStep(() => { delete x.permAnimated; if (x.addedTypes) x.addedTypes = x.addedTypes.filter(y => y !== 'Elemental'); }, '');
        log(`${x.card.name} becomes a ${X}/${X} Elemental creature with trample and haste until end of turn.`);
    },
    // The Notary Hobbits: two token copies that aren't legendary (only when ~ isn't a token)
    h_hobbits(P, e, t, src) {
        if (src.token) return;
        for (let k = 0; k < 2; k++) tokenCopyOf(P, { ...src.card, type: (src.card.type || '').replace(/Legendary /, '') });
    },
    // Goro-Goro and Satoru: a 5/5 red Dragon Spirit with flying
    async h_goro(P, e, t, src) { await applyEffect(P, { t: 'token', n: 1, p: 5, q: 5, name: 'red Dragon Spirit', kw: ['flying'] }, null, src); },
    // Tivash, Gloom Summoner: pay X life, X = life gained this turn, for an X/X Demon flier
    async h_tivash(P, e, t, src) {
        const X = h_gained(P); if (X <= 0 || P.life <= X) return;
        const yes = h_human(P) ? await askYes(P, `${src.card.name}: pay ${X} life to create a ${X}/${X} black Demon with flying?`, { card: src.card }) : P.life > X + 10; if (!yes) return;
        h_lose(P, X); await applyEffect(P, { t: 'token', n: 1, p: X, q: X, name: 'black Demon', kw: ['flying'] }, null, src);
    },
    // Krang, Master Mind: draw cards equal to the difference from four
    h_krang(P, e, t, src) { const d = 4 - P.hand.length; if (d > 0) drawCards(P, d); },
    // Olivia, Mobilized for War: discard a card; the creature gets a +1/+1 counter, haste and becomes a Vampire
    async h_olivia(P, e, t, src) {
        const x = (G.ctxRaw || {}).o; if (!x || !onBf(x.uid) || !P.hand.length) return;
        const yes = h_human(P) ? await askYes(P, `${src.card.name}: discard a card to put a +1/+1 counter on ${x.card.name}, give it haste and make it a Vampire?`, { card: src.card }) : P.hand.length > 2 && pow(x) >= 2; if (!yes) return;
        if (h_human(P)) await discardChosen(P, `${src.card.name}: discard a card`); else { const c = P.hand.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0]; pull(P.hand, c); P.gy.push(c); log(`${P.name} discards ${c.card.name}.`); fire('discarded', { P, o: c }); }
        putCounters(x, 1, P); x.tkw.push('haste'); x.sick = false; x.addedTypes = (x.addedTypes || []).concat(['Vampire']);
    },
    // The Fifth Doctor: a +1/+1 counter on each creature that didn't attack or enter this turn, then untap them
    h_fifth(P, e, t, src) {
        const l = P.bf.filter(x => isCreature(x) && x.attackedTurn !== G.turn && x.enteredTurn !== G.turn);
        l.forEach(x => { putCounters(x, 1, P); x.tapped = false; }); if (l.length) log(`${l.length} creature${l.length === 1 ? '' : 's'} get a +1/+1 counter and untap.`);
    },
    // Interceptor, Shadow's Hound: pay {2}{B}; return ~ from your graveyard to the battlefield tapped and attacking
    async h_interceptor(P, e, t, src) {
        if (!P.gy.includes(src)) return;
        if (!await mayPay(P, '{2}{B}', `${src.card.name}: pay {2}{B} to return it to the battlefield tapped and attacking?`, src)) return;
        pull(P.gy, src); putOntoBattlefield(P, src, true); src.sick = false; if (!(G.attackers || []).includes(src.uid)) G.attackers.push(src.uid);
        const first = (G.ctxRaw && G.ctxRaw.list || []).find(x => x.atkTo !== undefined); if (first) src.atkTo = first.atkTo;
        log(`${src.card.name} returns to the battlefield tapped and attacking.`);
    },
    // Ares, God of War: return the attacking creature that died to its owner's hand
    h_aresBack(P, e, t, src) {
        const dead = (G.ctxRaw || {}).o; if (!dead) return; const home = G.players[dead.owner];
        if (home.gy.includes(dead)) { pull(home.gy, dead); home.hand.push(dead); log(`${dead.card.name} returns to ${you(home) ? 'your' : 'their'} hand.`); }
    },
    // Roalesk, Apex Hybrid: proliferate, then proliferate again
    async h_roalesk(P, e, t, src) { await applyEffect(P, { t: 'proliferate' }, null, src); await applyEffect(P, { t: 'proliferate' }, null, src); },
    // Namor the Sub-Mariner: a 1/1 blue Merfolk for each blue mana symbol in the spell's mana cost
    async h_namor(P, e, t, src) {
        const c = (G.ctxRaw || {}).o; if (!c) return;
        const n = ((c.card.cost || '').match(/\{[^}]*\}/g) || []).filter(s => /U/.test(s)).length; if (n <= 0) return;
        await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'blue Merfolk', kw: [] }, null, src);
    },
    // Arni Metalbrow: pay {1}{R}; put a creature with lesser mana value from hand onto the battlefield tapped and attacking
    async h_arni(P, e, t, src) {
        const atk = ((G.ctxRaw || {}).list || [])[0]; if (!atk) return;
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) < (atk.card.cmc || 0)); if (!pool.length) return;
        if (!await mayPay(P, '{1}{R}', `${src.card.name}: pay {1}{R} to put a creature card from your hand onto the battlefield tapped and attacking?`, src)) return;
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature card with mana value less than ${atk.card.cmc || 0} onto the battlefield tapped and attacking`, { optional: true }); if (!c) return;
        putOntoBattlefield(P, c, true); c.sick = false; G.attackers.push(c.uid); if (atk.atkTo !== undefined) c.atkTo = atk.atkTo;
        log(`${c.card.name} enters tapped and attacking.`);
    },
    // Silver Sable, Mercenary Leader: a modified creature you control gains lifelink until end of turn
    async h_sable(P, e, t, src) {
        const mod = x => isCreature(x) && x.owner === P.i && (h_nctr(x) > 0 || allPerms().some(a => a.attachedTo === x.uid));
        const x = await pickOwn(P, P.bf.filter(mod), `${src.card.name}: target modified creature gains lifelink`, { rank: (a, b) => pow(b) - pow(a) }); if (!x) return;
        x.tkw.push('lifelink'); log(`${x.card.name} gains lifelink until end of turn.`);
    },
    // Mysterio, Master of Illusion: a 3/3 Illusion Villain for each nontoken Villain you control; exiled when ~ leaves
    async h_mysterio(P, e, t, src) {
        const n = P.bf.filter(x => !x.token && hasType(x, 'Villain')).length; if (n <= 0) return;
        const before = P.bf.filter(x => x.token).map(x => x.uid);
        await applyEffect(P, { t: 'token', n, p: 3, q: 3, name: 'blue Illusion Villain', kw: [] }, null, src);
        P.bf.filter(x => x.token && !before.includes(x.uid) && hasType(x, 'Illusion')).forEach(x => { x.h_mysterio = src.uid; });
    },
    h_mysterioGone(P, e, t, src) {
        G.players.forEach(X => X.bf.filter(x => x.h_mysterio === src.uid).forEach(x => { log(`${x.card.name} is exiled.`); leaveBattlefield(x, 'exile'); }));
    },
    // Jareth, Leonine Titan: protection from a color of your choice until end of turn
    async h_jareth(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const cols = ['W', 'U', 'B', 'R', 'G']; const names = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
        let col;
        if (h_human(P)) { col = cols[await askMode(P, `${src.card.name}: protection from which color?`, cols.map(c => names[c]))] || 'W'; }
        else { const cnt = {}; foes(P).forEach(F => F.bf.concat(F.gy.length ? [] : []).forEach(x => (x.card.colors || []).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }))); col = cols.slice().sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0]; }
        src.tkw.push('pro:' + col); log(`${src.card.name} gains protection from ${names[col]} until end of turn.`);
    },
    // Doctor Doom, Unrivaled: draw a card and lose 1 life; if your library is empty, you win
    h_doom(P, e, t, src) {
        drawCards(P, 1); h_lose(P, 1);
        if (!P.library.length && !P.out) { log(`${P.name} ${you(P) ? 'have' : 'has'} no cards in their library: ${P.name} ${you(P) ? 'win' : 'wins'} the game!`); foes(P).forEach(F => { if (!F.out && typeof eliminate === 'function') eliminate(F, `${P.name} won with ${src.card.name}`); }); }
    },
    // Hidetsugu, Devouring Chaos: exile the top card, you may play it this turn; damage equal to a nonland card's mana value
    async h_hidetsugu(P, e, t, src) {
        const c = P.library.pop(); if (!c) return;
        exilePlayFrom(P, P, c, G.turn);
        if (!/\bLand\b/.test(c.card.type)) { const mv = c.card.cmc || 0; if (mv > 0) { const tg = await h_dmgTarget(P, src, mv, `deal ${mv} damage to any target`); h_hit(tg, mv, src); } }
    },
    // Azog, Moria's Ruin: destroy up to one other creature; its controller amasses Goblins X; if you controlled it, draw a card
    async h_azog(P, e, t, src) {
        const x = await pickOwn(P, h_targets(P, y => y !== src), `${src.card.name}: destroy up to one other target creature`, { optional: true, rank: (a, b) => (b.owner === P.i ? -1 : 1) * 1000 + creatureValue(b) - creatureValue(a) }); if (!x) return;
        const X = Math.max(0, pow(x)), home = G.players[x.owner];
        destroy(x, src.card.name); await settle();
        await applyEffect(home, { t: 'amass', n: X, type: 'Goblin' }, null, src);
        if (home === P) drawCards(P, 1);
    },
    // Lonis, Genetics Expert: investigate once for each counter put on ~
    async h_lonis(P, e, t, src) { const n = (G.ctxRaw || {}).n || 1; for (let k = 0; k < n; k++) makeArtifactToken(P, 'clue'); },
    // Rhys, the Evermore: remove any number of counters from target creature you control
    async h_rhys(P, e, t, src) {
        const x = await pickOwn(P, P.bf.filter(c => isCreature(c) && h_nctr(c) > 0), `${src.card.name}: remove counters from target creature you control`, { rank: (a, b) => (a.counters < 0 ? -1 : 1) - (b.counters < 0 ? -1 : 1) || h_nctr(b) - h_nctr(a) }); if (!x) return;
        if (x.counters < 0) { log(`${x.card.name} loses its -1/-1 counters.`); x.counters = 0; }
        const neg = Object.entries(x.ctr || {}).filter(([k, v]) => v > 0 && ['stun', 'shield', 'bounty', 'time', 'fade'].includes(k) === false); // other counters stay unless the player asks
        if (h_human(P) && x.counters > 0) { const n = await askNumber(P, `${src.card.name}: remove how many +1/+1 counters from ${x.card.name}?`, 0, x.counters, 0, { card: x.card }); if (n) { x.counters -= n; log(`${n} counter${n === 1 ? '' : 's'} removed from ${x.card.name}.`); } }
        void neg;
    },
    // Shiko, Paragon of the Way: exile a nonland card with mana value 3 or less from your graveyard, copy it, cast the copy free
    async h_shiko(P, e, t, src) {
        const pool = P.gy.filter(c => !/\bLand\b/.test(c.card.type) && (c.card.cmc || 0) <= 3 && Rx(c).support !== 'none');
        const c = await pickOwn(P, pool, `${src.card.name}: exile target nonland card with mana value 3 or less from your graveyard`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(P.gy, c); P.exile.push(c); log(`${c.card.name} is exiled.`);
        const copy = makeObj({ ...c.card, id: `copy-${uidSeq}` }, P.i); P.gy.push(copy); copy.h_copy = true;
        if (!await castFreeAuto(P, copy)) { pull(P.gy, copy); pull(P.exile, copy); }
        else if (copy.h_copy && !Rx(copy).kind) { /* resolved */ }
    },
    // Wasitora, Nekoru Queen: that player sacrifices a creature of their choice; if they can't, a 3/3 Cat Dragon flier
    async h_wasitora(P, e, t, src) {
        for (const F of h_victims(src, G.ctxRaw || {})) {
            const pool = F.bf.filter(isCreature);
            if (!pool.length) { await applyEffect(P, { t: 'token', n: 1, p: 3, q: 3, name: 'black red and green Cat Dragon', kw: ['flying'] }, null, src); continue; }
            const x = await chooseFrom(F, pool, `${src.card.name}: sacrifice a creature`, false) || pool[0]; sacPerm(F, x);
        }
    },
    // Jadzi, Oracle of Arcavios: reveal the top card; a nonland card may be cast for {1}, a land enters the battlefield
    async h_jadzi(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return; log(`${P.name} reveal${you(P) ? '' : 's'} ${c.card.name}.`);
        if (/\bLand\b/.test(c.card.type)) { P.library.pop(); putOntoBattlefield(P, c); return; }
        if (Rx(c).support === 'none') return;
        if (!await mayPay(P, '{1}', `${src.card.name}: cast ${c.card.name} by paying {1} rather than its mana cost?`, c)) return;
        P.library.pop(); P.exile.push(c); c.freeCast = true; c.playUntil = G.turn;
        if (!await castFreeAuto(P, c)) { if (P.exile.includes(c)) { pull(P.exile, c); P.library.push(c); } }
    },
    // Donal, Herald of Wings: copy a nonlegendary creature spell with flying once each turn; the copy is a 1/1 Spirit token
    async h_donal(P, e, t, src) {
        const c = (G.ctxRaw || {}).o; if (!c || P.h_donalTurn === G.turn) return;
        if (/\bLegendary\b/.test(c.card.type) || !has(c, 'flying') && !/\bflying\b/i.test(c.card.text || '')) return;
        const yes = h_human(P) ? await askYes(P, `${src.card.name}: copy ${c.card.name}? The copy is a 1/1 Spirit in addition to its other types.`, { card: c.card }) : true; if (!yes) return;
        P.h_donalTurn = G.turn;
        const card = { ...c.card, type: c.card.type.includes(' — ') ? c.card.type + ' Spirit' : c.card.type + ' — Spirit', power: '1', toughness: '1' };
        tokenCopyOf(P, card, { p: 1, q: 1 });
    },
    // Iroh, Tea Master: an opponent gains control of a permanent of yours; you get a 1/1 Ally with a counter per permanent you own they control
    async h_iroh(P, e, t, src) {
        const fs = foes(P); if (!fs.length) return;
        const pool = P.bf.filter(x => !x.token || true).filter(x => !h_hexproofish(x) || x.owner === P.i);
        const x = await pickOwn(P, pool, `${src.card.name}: target opponent gains control of target permanent you control`, { optional: true, rank: (a, b) => permValue(a) - permValue(b) }); if (!x) return;
        const F = !h_human(P) || fs.length === 1 ? fs.slice().sort((a, b) => a.life - b.life)[0] : fs[await askMode(P, `${src.card.name}: which opponent gains control?`, fs.map(f => f.name))] || fs[0];
        if (!giveControl(x, F)) return;
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white Ally', kw: [] }, null, src);
        const tok = G.lastMade; const owned = G.players.filter(X => X !== P).flatMap(X => X.bf.filter(y => (y.realOwner !== undefined ? y.realOwner : y.owner) === P.i && y.owner !== P.i)).length;
        if (tok && owned > 0) putCounters(tok, owned, P);
    }
});
