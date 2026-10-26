// Spellslinger Duels - engine pieces for commander round 2, batch c (2026-10-26). Wordings are in rules/cmdr300c.js.
// Every global here starts with c_ (or is a CMD / TRIG_FN key starting with c_) so the other batches can't collide.

const c_hasCtr = o => o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0);
function c_removeOneCtr(o) { if (o.counters > 0) { o.counters--; return true; } const k = Object.keys(o.ctr || {}).find(k2 => o.ctr[k2] > 0); if (k) { o.ctr[k]--; return true; } return false; }
// Remove a counter from one of P's permanents in `pool` (the cost of Fain, O'aka)
async function c_payCtr(P, pool, why) {
    const c = pool.filter(c_hasCtr); if (!c.length) return null;
    const x = await pickOwn(P, c, why, { rank: (a, b) => (a.token ? -1 : 0) - (b.token ? -1 : 0) || (a.counters || 0) - (b.counters || 0) });
    if (!x || !c_removeOneCtr(x)) return null;
    log(`A counter is removed from ${x.card.name}.`); return x;
}
const c_attacksPlayer = (x, i) => (x.atkTo !== undefined ? x.atkTo === i : (G.defender !== undefined && G.defender !== null ? G.defender === i : G.players.length === 2));
const c_ctxList = () => (G.ctxRaw && G.ctxRaw.list) || [];
const c_isMine = (o, x) => !!x && x.owner === o.owner;
function c_bottomRandom(P, cards) { shuffle(cards); P.library.unshift(...cards); }
// Look at the top n cards: put the ones `take` accepts onto the battlefield (tapped / attacking optional); the rest go to the bottom in a random order
async function c_lookPut(P, n, test, src, opts = {}) {
    const top = []; for (let i = 0; i < n && P.library.length; i++) top.push(P.library.pop());
    log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library.`);
    const ok = top.filter(test); const rest = top.filter(c => !ok.includes(c)); const put = [];
    if (opts.one) {
        let pick = null;
        if (ok.length) pick = await pickOwn(P, ok, `${src.card.name}: put a card onto the battlefield?`, { optional: true });
        ok.forEach(c => { if (c !== pick) rest.push(c); });
        if (pick) put.push(pick);
    } else put.push(...ok);
    c_bottomRandom(P, rest);
    return put;
}

Object.assign(TRIG_FN, {
    c_attacksMe: (o, ctx) => (ctx.list || []).some(x => x.owner !== o.owner && c_attacksPlayer(x, o.owner)),
    c_anyAttackNonHuman: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && !hasType(x, 'Human')),
    c_sacOtherNontoken: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ctx.o !== o && !ctx.o.token && G.active === o.owner,
    c_foodSac: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bFood\b/.test(ctx.o.card.type),
    c_oppLose1: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && ctx.n === 1,
    c_oppDrawExtra: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !(G.inDrawStep && ctx.n === 1),
    c_eggDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Egg'),
    c_landEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    c_pirateHits: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Pirate') && (ctx.hit || []).some(H => H.i !== o.owner),
    c_shrineEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && !ctx.o.token && hasType(ctx.o, 'Shrine'),
    c_catDies: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && hasType(ctx.o, 'Cat'),
    c_nontokenDies: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && !ctx.o.token,
    c_firstHuman: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && Rx(ctx.o).kind === 'creature' && hasType(ctx.o, 'Human') && ctx.P.c_humanTurn !== G.turn,
    c_firstSpell: (o, ctx) => ctx.P.i === o.owner && ctx.P.castN === 1,
    c_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    c_nonHumanEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ctx.o !== o && !ctx.o.token && isCreature(ctx.o),
    c_anyAttacks: () => true
});
COND_EXTRA.push(
    [/^you control a creature with a counter on it$/, () => P => P.bf.some(x => isCreature(x) && c_hasCtr(x))],
    [/^you control a nonland permanent with a counter on it$/, () => P => P.bf.some(x => !/\bLand\b/.test(x.card.type) && c_hasCtr(x))]
);
STATIC_FN.c_isCommander = o => !!o.isCommander;
STATIC_FN.c_historic = o => /Artifact|Legendary|Saga/.test(o.card.type);
STATIC_FN.c_tapped = o => !!o.tapped;

Object.assign(CMD_SCORE, { c_fain: () => 3, c_oaka: () => 3, c_ardyn: () => 7, c_lulu: () => 4, c_kaalia: () => 9, c_nylea: () => 2, c_hakbal: () => 3, c_neheb: () => 3, c_thalia: () => 1, c_szarel: () => 3, c_amalia: () => 3, c_omnath: () => 4, c_obnix: () => 3, c_raffine: () => 3, c_atla: () => 6, c_gilgamesh: () => 6, c_xyris: () => 3, c_breeches: () => 4, c_slinn: () => 5, c_winota: () => 8, c_zara: () => 8, c_rutstein: () => 3, c_shrine: () => 3, c_sazh: () => 4, c_moloid: () => 3, c_torgal: () => 2, c_betor: () => 4, c_rhys: () => 7, c_elanor: () => 4 });
Object.assign(CMD, {
    // Fain, the Broker: remove a counter from a creature you control; Treasure
    async c_fain(P, e, t, src) { if (await c_payCtr(P, P.bf.filter(isCreature), `${src.card.name}: remove a counter from a creature you control`)) { makeArtifactToken(P, 'treasure'); log(`${P.name} ${you(P) ? 'create' : 'creates'} a Treasure token.`); } },
    async c_oaka(P, e, t, src) { if (await c_payCtr(P, P.bf.filter(x => !/\bLand\b/.test(x.card.type)), `${src.card.name}: remove a counter from a nonland permanent you control`)) drawCards(P, 1); },
    // Ardyn: exile a creature card from a graveyard; a 5/5 black Demon copy
    async c_ardyn(P, e, t, src) {
        const pool = []; G.players.forEach(X => X.gy.filter(c => /\bCreature\b/.test(c.card.type)).forEach(c => pool.push(c)));
        if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: exile a creature card from a graveyard?`, { optional: true }); if (!c) return;
        G.players.forEach(X => pull(X.gy, c)); c.exiledBy2 = src.uid; P.exile.push(c);
        log(`${c.card.name} is exiled from a graveyard.`);
        const ty = c.card.type.replace(/\s—.*$/, '') + ' — Demon';
        tokenCopyOf(P, { ...c.card, type: ty, colors: ['B'] }, { p: 5, q: 5 });
    },
    // Lulu, Stern Guardian: stun counter on a creature attacking you
    async c_lulu(P, e, t, src) {
        const list = c_ctxList().filter(x => onBf(x.uid) && x.owner !== P.i && c_attacksPlayer(x, P.i)); if (!list.length) return;
        const x = (P.isAI || AUTOPLAY) ? list.slice().sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, list, `${src.card.name}: put a stun counter on a creature attacking you`, { required: true }) || list[0];
        x.ctr.stun = (x.ctr.stun || 0) + 1; log(`${x.card.name} gets a stun counter.`);
    },
    // Kaalia of the Vast
    async c_kaalia(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type) && ['Angel', 'Demon', 'Dragon'].some(w => new RegExp(`\\b${w}\\b`).test(c.card.type)));
        const c = await pickOwn(P, pool, `${src.card.name}: put an Angel, Demon or Dragon onto the battlefield attacking?`, { optional: true }); if (!c) return;
        putOntoBattlefield(P, c, true); G.attackers.push(c.uid); if (src.atkTo !== undefined) c.atkTo = src.atkTo;
        log(`${c.card.name} enters tapped and attacking.`);
    },
    async c_nylea(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name}.`);
        if (/\bCreature\b/.test(c.card.type)) { P.library.pop(); P.hand.push(c); return; }
        const yes = (P.isAI || AUTOPLAY) ? !/\bLand\b/.test(c.card.type) : await askYes(P, `${src.card.name}: put ${c.card.name} into your graveyard?`, { card: c.card });
        if (yes) { P.library.pop(); P.gy.push(c); log(`${c.card.name} is put into the graveyard.`); }
    },
    async c_hakbal(P, e, t, src) { for (const x of P.bf.filter(y => isCreature(y) && hasType(y, 'Merfolk'))) await applyEffect(P, { t: 'exploreSelf' }, null, x); },
    // Neheb, Dreadhorde Champion
    async c_neheb(P, e, t, src) {
        if (!P.hand.length) return;
        let n;
        if (P.isAI || AUTOPLAY) n = Math.min(P.hand.filter(c => /\bLand\b/.test(c.card.type)).length, P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= 5 ? 3 : 0);
        else n = await askNumber(P, `${src.card.name}: discard how many cards (draw that many, add that much {R})?`, 0, P.hand.length, 0, { card: src.card });
        if (!n) return;
        for (let i = 0; i < n; i++) { const d = (P.isAI || AUTOPLAY) ? P.hand.filter(c => /\bLand\b/.test(c.card.type))[0] : null; if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; } else await discardChosen(P, `${src.card.name}: discard a card`); }
        drawCards(P, n);
        P.pool = (P.pool || []).concat(Array(n).fill('R')); P.keepPoolTurn = G.turn; log(`${P.name} add${you(P) ? '' : 's'} ${'{R}'.repeat(Math.min(n, 12))} (it stays until end of turn).`);
    },
    // Thalia and The Gitrog Monster: sacrifice a creature or land, then draw
    async c_thalia(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) || /\bLand\b/.test(x.card.type)); if (!pool.length) return;
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
        const v = x => /\bLand\b/.test(x.card.type) ? (lands >= 5 ? 1 : 6) : (x.token ? 0.5 : permValue(x));
        const x = await pickOwn(P, pool, `${src.card.name}: sacrifice a creature or land`, { rank: (a, b) => v(a) - v(b) });
        if (x) sacPerm(P, x);
        drawCards(P, 1);
    },
    // Szarel: +1/+1 counters equal to Szarel's power on another creature
    async c_szarel(P, e, t, src) {
        const n = pow(src); if (n <= 0) return;
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        const x = await pickOwn(P, pool, `${src.card.name}: put ${n} +1/+1 counters on another creature?`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (x) { const got = putCounters(x, n, P); log(`${x.card.name} gets ${got} +1/+1 counters.`); }
    },
    // Amalia Benavides Aguirre
    async c_amalia(P, e, t, src) {
        if (!onBf(src.uid)) return;
        await applyEffect(P, { t: 'exploreSelf' }, null, src);
        if (onBf(src.uid) && pow(src) === 20) { log(`${src.card.name} has exactly 20 power!`); allPerms().filter(x => x !== src && isCreature(x)).forEach(x => destroy(x)); }
    },
    // Omnath, Locus of Creation: the first, second and third land each turn
    async c_omnath(P, e, t, src) {
        P.c_omn = P.c_omnTurn === G.turn ? P.c_omn + 1 : 1; P.c_omnTurn = G.turn;
        if (P.c_omn === 1) gainLifeFor(P, 4);
        else if (P.c_omn === 2) { P.pool = (P.pool || []).concat(['R', 'G', 'W', 'U']); log(`${P.name} add${you(P) ? '' : 's'} {R}{G}{W}{U}.`); }
        else if (P.c_omn === 3) {
            foes(P).forEach(F => { damage(F, 4, src); });
            allPerms().filter(x => isPlaneswalker(x) && x.owner !== P.i).forEach(x => damage(x, 4, src));
        }
    },
    // Ob Nixilis, Captive Kingpin: an opponent loses exactly 1 life
    async c_obnix(P, e, t, src) {
        if (onBf(src.uid)) { const got = putCounters(src, 1, P); log(`${src.card.name} gets ${got} +1/+1 counter.`); }
        const c = P.library.pop(); if (!c) return;
        c.realOwner = P.i; c.owner = P.i; c.playUntil = G.turn + G.players.length; P.exile.push(c);
        log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name}; ${you(P) ? 'you' : 'they'} may play it until the end of ${you(P) ? 'your' : 'their'} next turn.`);
    },
    // Raffine, Scheming Seer: an attacking creature connives X
    async c_raffine(P, e, t, src) {
        const list = c_ctxList().filter(x => onBf(x.uid) && x.owner === P.i); if (!list.length) return;
        const x = await pickOwn(P, list, `${src.card.name}: target attacking creature connives ${list.length}`, { rank: (a, b) => creatureValue(a) - creatureValue(b) });
        if (!x) return;
        for (let i = 0; i < list.length; i++) await applyChoiceEffect(P, { t: 'connive', target: 'creature' }, src, { o: x });
    },
    // Atla Palani: an Egg dies; reveal until a creature card, put it onto the battlefield
    async c_atla(P, e, t, src) {
        const skipped = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (/\bCreature\b/.test(c.card.type)) { hit = c; break; } skipped.push(c); }
        c_bottomRandom(P, skipped);
        if (hit) { log(`${P.name} reveal${you(P) ? '' : 's'} ${hit.card.name}.`); putOntoBattlefield(P, hit, false); }
    },
    // Gilgamesh, Master-at-Arms: Equipment from the top six; attach one to a Samurai
    async c_gilgamesh(P, e, t, src) {
        const put = await c_lookPut(P, 6, c => /\bEquipment\b/.test(c.card.type), src);
        const eq = []; for (const c of put) { putOntoBattlefield(P, c, false); eq.push(c); }
        if (eq.length) {
            const sam = P.bf.filter(x => isCreature(x) && hasType(x, 'Samurai'));
            if (sam.length) {
                const q = await pickOwn(P, eq, `${src.card.name}: attach one to a Samurai?`, { optional: true });
                if (q) { const s = await pickOwn(P, sam, `${q.card.name}: attach to which Samurai?`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (s) { q.attachedTo = s.uid; log(`${q.card.name} is attached to ${s.card.name}.`); } }
            }
        }
    },
    // Xyris
    c_xyris(P, e, t, src) { applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'green Snake', kw: [] }, null, src); },
    // Breeches, Brazen Plunderer: exile the top card of each opponent hit
    c_breeches(P, e, t, src) { const hit = hitList().filter(H => H.i !== P.i); for (const H of hit) { const c = H.library.pop(); if (c) exilePlayFrom(P, H, c, G.turn); } },
    // Slinn Voda: if kicked, return all creatures except Merfolk, Krakens, Leviathans, Octopuses and Serpents
    c_slinn(P, e, t, src) {
        if (!src.kicked) return;
        const ex = ['Merfolk', 'Kraken', 'Leviathan', 'Octopus', 'Serpent'];
        allPerms().filter(x => isCreature(x) && !ex.some(w => hasType(x, w))).forEach(x => { log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand'); });
    },
    // Winota
    async c_winota(P, e, t, src) {
        const put = await c_lookPut(P, 6, c => /\bCreature\b/.test(c.card.type) && /\bHuman\b/.test(c.card.type), src, { one: true });
        for (const c of put) { putOntoBattlefield(P, c, true); G.attackers.push(c.uid); c.indUntil = G.turn; if (src.atkTo !== undefined) c.atkTo = src.atkTo; log(`${c.card.name} enters tapped and attacking, indestructible until end of turn.`); }
    },
    // Zara, Renegade Recruiter
    async c_zara(P, e, t, src) {
        const D = G.players[G.defender] && G.defender !== P.i ? G.players[G.defender] : opp(P); if (!D) return;
        const pool = D.hand.filter(c => /\bCreature\b/.test(c.card.type));
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at ${D.name === 'You' ? 'your' : D.name + "'s"} hand.`);
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature from their hand onto the battlefield attacking?`, { optional: true }); if (!c) return;
        pull(D.hand, c); putOntoBattlefield(P, c, true); c.realOwner = D.i; G.attackers.push(c.uid); c.atkTo = D.i;
        atEndStep(() => { const x = onBf(c.uid); if (x) leaveBattlefield(x, 'hand'); }, `${c.card.name} returns to its owner's hand.`);
    },
    // Old Rutstein
    c_rutstein(P, e, t, src) {
        const c = P.library.pop(); if (!c) return;
        P.gy.push(c); log(`${P.name} mill${you(P) ? '' : 's'} ${c.card.name}.`); fire('milled', { P, cards: [c] });
        if (/\bLand\b/.test(c.card.type)) makeArtifactToken(P, 'treasure');
        else if (/\bCreature\b/.test(c.card.type)) applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'green Insect', kw: [] }, null, src);
        else makeArtifactToken(P, 'blood');
    },
    c_shrine(P, e, t, src) {
        const card = { id: `token-shrine-${uidSeq}`, name: 'Shrine token', fullName: 'Shrine token', cost: '', cmc: 0, type: 'Token Enchantment Creature — Shrine', text: '', power: '1', toughness: '1', colors: [], ci: [], img: null, imgS: null, legal: {} };
        const tok = makeObj(card, P.i, { token: true }); P.bf.push(tok); G.lastMade = tok; log(`${P.name} ${you(P) ? 'create' : 'creates'} a 1/1 colorless Shrine enchantment creature token.`);
        fire('enters', { o: tok }); tokenMade(P); fire('creatureTokenMade', { P });
    },
    // Sazh Katzroy: a +1/+1 counter, then double the counters
    async c_sazh(P, e, t, src) {
        const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: put a +1/+1 counter on a creature, then double its counters`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        putCounters(x, 1, P); const n = x.counters; if (n > 0) putCounters(x, n, P);
        log(`${x.card.name} now has ${x.counters} +1/+1 counters.`);
    },
    // Mole Man, Moloid Master
    c_moloid(P, e, t, src) { applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'green Minion', kw: [], named: 'Moloid', text: 'Whenever ~ attacks, you may mill a card.' }, null, src); },
    // Torgal: the first Human creature spell enters with a +1/+1 counter for each Dog and/or Wolf
    c_torgal(P, e, t, src) { const o = G.ctxRaw && G.ctxRaw.o; if (!o) return; P.c_humanTurn = G.turn; o.c_extraCtr = P.bf.filter(x => hasType(x, 'Dog') || hasType(x, 'Wolf')).length; },
    c_torgalEnters(P, e, t, src) { const x = G.ctxObj; if (x && x.c_extraCtr > 0 && onBf(x.uid)) { const got = putCounters(x, x.c_extraCtr, P); log(`${x.card.name} enters with ${got} additional +1/+1 counters.`); x.c_extraCtr = 0; } },
    // Betor, Ancestor's Voice
    async c_betor(P, e, t, src) {
        const gained = P.gainedTurn === G.turn ? (P.gainedAmt || 0) : 0, lost = P.lostTurn === G.turn ? (P.lostN || 0) : 0;
        if (gained > 0) { const x = await pickOwn(P, P.bf.filter(y => isCreature(y) && y !== src), `${src.card.name}: put ${gained} +1/+1 counters on another creature?`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (x) { const got = putCounters(x, gained, P); log(`${x.card.name} gets ${got} +1/+1 counters.`); } }
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= lost);
        if (pool.length) { const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${lost} or less`, { optional: true }); if (c) { pull(P.gy, c); putOntoBattlefield(P, c, false); } }
    },
    // Rhys the Redeemed: a copy of each creature token you control
    c_rhys(P, e, t, src) { P.bf.filter(x => x.token && isCreature(x)).forEach(x => tokenCopyOf(P, x.card)); },
    // Elanor Gardner
    c_markFood(P, e, t, src) { P.c_foodTurn = G.turn; },
    async c_elanor(P, e, t, src) {
        if (P.c_foodTurn !== G.turn) return;
        const basics = P.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type)); if (!basics.length) { shuffle(P.library); return; }
        const names = []; const uniq = basics.filter(c => !names.includes(c.card.name) && names.push(c.card.name));
        const have = n => P.bf.filter(x => x.card.name === n).length;
        const c = await pickOwn(P, uniq, `${src.card.name}: search for a basic land card?`, { optional: true, rank: (a, b) => have(a.card.name) - have(b.card.name) });
        if (c) { pull(P.library, c); putOntoBattlefield(P, c, true); }
        shuffle(P.library);
    }
});
Object.assign(TRIG_FN, {
    c_mineAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    c_ownEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ctx.o.c_extraCtr > 0 && isCreature(ctx.o)
});

// ===== Chunk 2 =====
Object.assign(TRIG_FN, {
    c_main2Mine: (o, ctx) => G.active === o.owner && G.players[o.owner].gainedTurn === G.turn && (G.players[o.owner].gainedAmt || 0) >= 3,
    c_bigHit: (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && pow(x) >= 7),
    c_calixHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && (ctx.src === o || allPerms().some(a => a.attachedTo === ctx.src.uid && a.owner === o.owner && /\bAura\b/.test(a.card.type) && a === o)) && (ctx.hit || []).some(H => H.i !== o.owner),
    c_calixHost: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && (ctx.src === o || allPerms().some(a => a.attachedTo === ctx.src.uid && a.owner === o.owner && /\bEnchantment\b/.test(a.card.type) && /\bAura\b/.test(a.card.type))) && (ctx.hit || []).some(H => H.i !== o.owner),
    c_myNontokenEntersOther: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && !ctx.o.token && isCreature(ctx.o),
    c_myInstSorc: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && ['instant', 'sorcery'].includes(Rx(ctx.o).kind),
    c_myNoncreatureBig: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && Rx(ctx.o).kind !== 'creature' && Rx(ctx.o).kind !== 'land' && (ctx.o.card.cmc || 0) >= 4,
    c_garnetAttack: (o, ctx) => (ctx.list || []).includes(o)
});
STATIC_FN.c_isCommander = o => !!o.isCommander;
Object.assign(CMD_SCORE, { c_gisa: () => 6, c_zur: () => 5, c_prismari: () => 8, c_rashmi: () => 5, c_krark: () => 4, c_danithaBH: () => 6, c_cayth: () => 4, c_transformMay: () => 5, c_lili: () => 6, c_edgar: () => 6, c_sorin: () => 6, c_ral: () => 3, c_terra: () => 3, c_emperor: () => 3, c_calix: () => 4, c_tifa: () => 8, c_roku: () => 7, c_garnet: () => 1, c_xuifit: () => 6, c_danithaNBL: () => 6 });
// Garnet: the computer keeps its Sagas as they are; a person is asked for each
async function c_garnetWants(P, src, s) { return (P.isAI || AUTOPLAY) ? false : await askYes(P, `${src.card.name}: remove a lore counter from ${s.card.name}?`, { card: s.card }); }
// Cast a creature card of a kind from the graveyard paying its mana cost (Gisa and Geralf, Danitha)
async function c_castFromGy(P, src, test, what) {
    const pool = P.gy.filter(x => test(x) && Rx(x).support !== 'none' && canPay(P, x));
    const pick = await pickOwn(P, pool, `${src.card.name}: cast ${what} from your graveyard`, { optional: true });
    if (!pick) { src.usedOnce = {}; (src.onceTurn = src.onceTurn || {}); log(`No ${what} to cast.`); return false; }
    return await castPaying(P, pick);
}
Object.assign(CMD, {
    async c_gisa(P, e, t, src) { await c_castFromGy(P, src, x => Rx(x).kind === 'creature' && hasType(x, 'Zombie'), 'a Zombie creature spell'); },
    async c_danithaNBL(P, e, t, src) { await c_castFromGy(P, src, x => /\b(Aura|Equipment)\b/.test(x.card.type), 'an Aura or Equipment spell'); },
    // Zur, Eternal Schemer: a non-Aura enchantment becomes a creature with base power and toughness equal to its mana value
    async c_zur(P, e, t, src) {
        const pool = P.bf.filter(x => /\bEnchantment\b/.test(x.card.type) && !/\bAura\b/.test(x.card.type) && !isCreature(x)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: target non-Aura enchantment becomes a creature`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!x) return;
        const mv = x.card.cmc || 0; x.permAnimated = { p: mv, q: mv }; log(`${x.card.name} becomes a ${mv}/${mv} creature in addition to its other types.`);
    },
    // Prismari, the Inspiration: instants and sorceries you cast have storm
    async c_prismari(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; if (!o) return;
        const item = G.stack.find(i => i.o === o && i.kind === 'spell'); const n = (G.castThisTurn || 1) - 1;
        if (!item || n <= 0 || Rx(o).kw.has('storm')) return;
        log(`Storm: ${n} cop${n === 1 ? 'y' : 'ies'} of ${o.card.name}.`);
        for (let k = 0; k < n; k++) await copySpellItem(P, item, { retarget: true });
    },
    // Rashmi, Eternities Crafter
    async c_rashmi(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        const cast = G.ctxRaw && G.ctxRaw.o; log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name}.`);
        if (Rx(c).kind !== 'land' && (c.card.cmc || 0) < ((cast && cast.card.cmc) || 0)) {
            const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card });
            if (yes && await castFreeAuto(P, c)) return;
        }
        if (P.library.includes(c)) { pull(P.library, c); P.hand.push(c); log(`${c.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Krark, the Thumbless
    async c_krark(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; const item = o && G.stack.find(i => i.o === o && i.kind === 'spell'); if (!item) return;
        const won = flipCoin(P); log(`${P.name} ${you(P) ? 'flip' : 'flips'} a coin for ${src.card.name} and ${won ? 'win' : 'lose'}${you(P) ? '' : 's'} the flip.`);
        if (won) await copySpellItem(P, item, { retarget: true });
        else { const i = G.stack.indexOf(item); if (i >= 0) { G.stack.splice(i, 1); if (o.front) o.card = o.front; resetObj(o); if (!o.token) { G.players[o.owner].hand.push(o); log(`${item.name} returns to its owner's hand.`); } } }
    },
    // Danitha Capashen, Benalia's Hope: an Aura or Equipment from hand or graveyard enters attached to it
    async c_danithaBH(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = [...P.hand, ...P.gy].filter(c => /\b(Aura|Equipment)\b/.test(c.card.type) && (/\bEquipment\b/.test(c.card.type) || (Rx(c).kind !== 'instant')));
        const c = await pickOwn(P, pool, `${src.card.name}: put an Aura or Equipment onto the battlefield attached to ${src.card.name}?`, { optional: true }); if (!c) return;
        putOntoBattlefield(P, c, false); c.attachedTo = src.uid; log(`${c.card.name} is attached to ${src.card.name}.`);
    },
    // Cayth, Famed Mechanist: other nontoken creatures have fabricate 1
    async c_cayth(P, e, t, src) { const x = G.ctxObj; if (x && onBf(x.uid)) await applyEffect(P, { t: 'fabricate', n: 1 }, null, x); },
    // "You may exile ~, then return it transformed" (Ajani)
    async c_transformMay(P, e, t, src) {
        if (!onBf(src.uid) || !src.front || !src.front.back) return;
        if (!(P.isAI || AUTOPLAY) && !(await askYes(P, `${src.card.name}: exile it and return it transformed?`, { card: src.card }))) return;
        await applyEffect(P, { t: 'exileReturnTransformed' }, null, src);
    },
    // Liliana, Heretical Healer: transform, and a 2/2 black Zombie
    async c_lili(P, e, t, src) { if (!onBf(src.uid) || !src.front || !src.front.back) return; await applyEffect(P, { t: 'exileReturnTransformed' }, null, src); await applyEffect(P, { t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: [] }, null, src); },
    async c_sorin(P, e, t, src) { if (!onBf(src.uid) || !src.front || !src.front.back) return; await applyEffect(P, { t: 'exileReturnTransformed' }, null, src); },
    // Edgar, Charmed Groom: returns from the graveyard transformed
    c_edgar(P, e, t, src) {
        const X = G.players[src.owner]; if (!X.gy.includes(src) || !src.front || !src.front.back) return;
        pull(X.gy, src); resetObj(src); src.card = src.front.back; src.enteredTurn = G.turn; X.bf.push(src);
        log(`${src.front.name} returns to the battlefield transformed as ${src.card.name}.`); fire('enters', { o: src });
        if (Rx(src).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: src, effects: Rx(src).etb });
    },
    // Ral, Monsoon Mage: flip a coin when you cast an instant or sorcery in your turn
    async c_ral(P, e, t, src) {
        if (G.active !== P.i || !onBf(src.uid)) return;
        const won = flipCoin(P); log(`${P.name} ${you(P) ? 'flip' : 'flips'} a coin for ${src.card.name} and ${won ? 'win' : 'lose'}${you(P) ? '' : 's'} the flip.`);
        if (!won) { damage(P, 1, src); return; }
        if (!src.front || !src.front.back) return;
        if (!(P.isAI || AUTOPLAY) && !(await askYes(P, `${src.card.name}: exile him and return him transformed?`, { card: src.card }))) return;
        await applyEffect(P, { t: 'exileReturnTransformed' }, null, src);
    },
    // Terra, Magical Adept: mill five, an enchantment card to hand
    async c_terra(P, e, t, src) {
        const before = P.gy.length; doMill(P, 5); const milled = P.gy.slice(before).filter(c => /\bEnchantment\b/.test(c.card.type)); if (!milled.length) return;
        const c = await pickOwn(P, milled, `${src.card.name}: put an enchantment card milled this way into your hand?`, { optional: true }); if (c) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // The Emperor of Palamecia: a counter for each noncreature spell with four or more mana; three counters transform it
    c_emperor(P, e, t, src) {
        if (!onBf(src.uid)) return; putCounters(src, 1, P); log(`${src.card.name} gets a +1/+1 counter.`);
        if (src.counters >= 3 && src.front && src.front.back && src.card === src.front) { src.card = src.front.back; log(`${src.front.name} transforms into ${src.card.name}.`); }
    },
    // Calix, Guided by Fate: a token copy of a nonlegendary enchantment you control (once each turn)
    async c_calix(P, e, t, src) {
        const pool = P.bf.filter(x => /\bEnchantment\b/.test(x.card.type) && !/Legendary/.test(x.card.type) && !x.token); if (!pool.length) { return; }
        const x = await pickOwn(P, pool, `${src.card.name}: create a token that's a copy of a nonlegendary enchantment?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (x) tokenCopyOf(P, x.card);
    },
    // Tifa, Martial Artist
    c_tifa(P, e, t, src) {
        const ut = P.bf.filter(x => isCreature(x) && x.tapped); ut.forEach(x => { x.tapped = false; });
        if (!G.extraCombatOn) { G.extraCombat = (G.extraCombat || 0) + 1; log(`${P.name} untap${you(P) ? '' : 's'} all creatures; there will be an additional combat phase after this one.`); } else log(`${P.name} untap${you(P) ? '' : 's'} all creatures.`);
    },
    // Avatar Roku, Firebender
    c_roku(P, e, t, src) { P.pool = (P.pool || []).concat(Array(6).fill('R')); P.keepPoolTurn = G.turn; log(`${P.name} add${you(P) ? '' : 's'} {R}{R}{R}{R}{R}{R} (it stays until end of combat).`); },
    // Garnet, Princess of Alexandria
    async c_garnet(P, e, t, src) {
        if (!onBf(src.uid)) return; let n = 0;
        for (const s of P.bf.filter(x => /\bSaga\b/.test(x.card.type) && (x.ctr.lore || 0) > 0)) {
            if (await c_garnetWants(P, src, s)) { s.ctr.lore--; n++; }
        }
        if (n > 0) { const got = putCounters(src, n, P); log(`${src.card.name} gets ${got} +1/+1 counters.`); }
    },
    // Xu-Ifit, Osteoharmonist: a creature card returns as a Skeleton with no abilities
    async c_xuifit(P, e, t, src) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card from your graveyard to the battlefield`, { optional: true }); if (!c) return;
        c.front = c.card; c.card = { ...c.card, text: '', type: c.card.type.replace(/\s—.*$/, '') + ' — Skeleton ' + (c.card.type.split('—')[1] || '').trim() };
        reanimateFrom(P, P, c); log(`${c.card.name} is a Skeleton with no abilities.`);
    }
});

// ===== Chunk 3 =====
Object.assign(TRIG_FN, {
    c_discardCreature: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && /\bCreature\b/.test(ctx.o.card.type),
    c_main2Own: (o, ctx) => G.active === o.owner,
    c_myCreatureTargeted: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o) && ctx.by !== undefined,
    c_artifactEnters: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && !ctx.o.token && /\bArtifact\b/.test(ctx.o.card.type),
    c_equipmentEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && !ctx.o.token && /\bEquipment\b/.test(ctx.o.card.type),
    c_allyEnters: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o) && hasType(ctx.o, 'Ally'),
    c_earthDies: (o, ctx) => !!ctx.o && !!ctx.o.c_earthbent,
    c_recordMill: (o, ctx) => { if (ctx.P && ctx.P.i !== o.owner) (ctx.cards || []).forEach(c => { c.c_milledTurn = G.turn; }); return false; },
    c_selfAttacksFirebend: (o, ctx) => (ctx.list || []).includes(o)
});
Object.assign(CMD_SCORE, { c_hashaton: () => 5, c_florian: () => 6, c_gargos: () => 6, c_ultron: () => 5, c_firion: () => 4, c_firionSweep: () => 0, c_gilraen: () => 3, c_earthbend1: () => 5, c_kyoshi: () => 6, c_boulder: () => 6, c_firebend: () => 3, c_tivit: () => 5, c_nghathrod: () => 8, c_earthReturn: () => 4 });
// Earthbend N: a land you control becomes a 0/0 haste creature with N +1/+1 counters; when it dies it returns to the battlefield tapped
async function c_earthbend(P, n, src) {
    const pool = P.bf.filter(x => /\bLand\b/.test(x.card.type) && !isCreature(x)); if (!pool.length || n <= 0) return null;
    const x = await pickOwn(P, pool, `${src.card.name}: earthbend ${n} - target land you control`, { rank: (a, b) => (/\bBasic\b/.test(b.card.type) ? 1 : 0) - (/\bBasic\b/.test(a.card.type) ? 1 : 0) || (b.tapped ? 1 : 0) - (a.tapped ? 1 : 0) });
    if (!x) return null;
    x.permAnimated = { p: 0, q: 0 }; x.sick = false; x.c_earthbent = true; x.tkw.push('haste');
    const got = putCounters(x, n, P); log(`${x.card.name} becomes a 0/0 creature with haste that's still a land, with ${got} +1/+1 counters (earthbend ${n}).`);
    return x;
}
Object.assign(CMD, {
    c_noop() {},
    // Hashaton, Scarab's Fist
    async c_hashaton(P, e, t, src) {
        const c = G.ctxRaw && G.ctxRaw.o; if (!c || !P.gy.includes(c)) return;
        if (!await mayPay(P, '{2}{U}', `${src.card.name}: pay {2}{U} to create a tapped 4/4 black Zombie copy of ${c.card.name}?`, src)) return;
        const tok = tokenCopyOf(P, { ...c.card, colors: ['B'], type: c.card.type.replace(/\s—.*$/, '') + ' — Zombie' }, { p: 4, q: 4 }); tok.tapped = true;
    },
    // Florian, Voldaren Scion
    async c_florian(P, e, t, src) {
        const X = foes(P).reduce((a, F) => a + (F.lostTurn === G.turn ? (F.lostN || 0) : 0), 0); if (X <= 0) return;
        const top = []; for (let i = 0; i < X && P.library.length; i++) top.push(P.library.pop()); if (!top.length) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library.`);
        const pick = await pickOwn(P, top, `${src.card.name}: exile one of these cards; you may play it this turn`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        c_bottomRandom(P, top.filter(c => c !== pick));
        if (pick) exilePlayFrom(P, P, pick, G.turn);
    },
    // Gargos, Vicious Watcher: fights a creature you don't control
    async c_gargos(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = foes(P).flatMap(F => F.bf.filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud')));
        const good = pool.filter(x => pow(src) >= tou(x) - x.dmg && pow(x) < tou(src) - src.dmg);
        const x = await pickOwn(P, (P.isAI || AUTOPLAY) ? good : pool, `${src.card.name}: fight up to one target creature you don't control?`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        log(`${src.card.name} fights ${x.card.name}.`); damage(x, Math.max(0, pow(src)), src); damage(src, Math.max(0, pow(x)), x);
    },
    // Ultron, Artificial Malevolence
    async c_ultron(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return;
        if (!await mayPay(P, '{2}', `${src.card.name}: pay {2} to create a token copy of ${x.card.name}?`, src)) return;
        let card = x.card;
        if (!/\bCreature\b/.test(card.type)) card = { ...card, type: card.type.replace(/\bArtifact\b/, 'Artifact Creature').replace(/(\s—.*)?$/, m => (m ? m + ' Robot Villain' : ' — Robot Villain')), power: '2', toughness: '2' };
        tokenCopyOf(P, card);
    },
    // Firion, Wild Rose Warrior: a token copy of the Equipment with cheaper equip; sacrificed at the beginning of the next upkeep
    c_firion(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return;
        const tok = tokenCopyOf(P, { ...x.card, text: String(x.card.text || '').replace(/Equip (\{\d+\})(\{[^}]+\})*/g, (m, g) => m.replace(/Equip \{(\d+)\}/, (mm, k) => `Equip {${Math.max(0, +k - 2)}}`)) });
        tok.c_sacUpkeep = G.turn; log(`${tok.card.name}'s equip abilities cost {2} less; it is sacrificed at the beginning of the next upkeep.`);
    },
    c_firionSweep(P, e, t, src) { allPerms().filter(x => x.c_sacUpkeep !== undefined).forEach(x => { log(`${x.card.name} is sacrificed.`); sacPerm(G.players[x.owner], x); }); },
    // Gilraen, Dunedain Protector
    async c_gilraen(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: exile another target creature you control`, { rank: (a, b) => creatureValue(a) - creatureValue(b) }); if (!x) return;
        const tok = x.token, card = x;
        leaveBattlefield(x, 'exile'); log(`${x.card.name} is exiled.`);
        if (tok) return;
        const now = (P.isAI || AUTOPLAY) ? false : await askYes(P, `${src.card.name}: return ${x.card.name} to the battlefield now? (Otherwise it returns at the end step with a vigilance counter and a lifelink counter.)`, { card: x.card, yes: 'Return it now', no: 'At the end step, with counters' });
        const back = withCounters => { const O = G.players[card.owner]; if (!O.exile.includes(card)) return; pull(O.exile, card); putOntoBattlefield(O, card, false); if (withCounters) { card.ctr.vigilance = 1; card.ctr.lifelink = 1; log(`${card.card.name} gets a vigilance counter and a lifelink counter.`); } };
        if (now) back(false); else atEndStep(() => back(true), `${x.card.name} returns to the battlefield.`);
    },
    // Earthbend cards
    async c_earthbend1(P, e, t, src) { await c_earthbend(P, 1, src); },
    async c_kyoshi(P, e, t, src) { const x = await c_earthbend(P, 8, src); if (x) { x.tapped = false; log(`${x.card.name} untaps.`); } },
    async c_boulder(P, e, t, src) { await c_earthbend(P, P.bf.filter(x => isCreature(x) && pow(x) >= 4).length, src); },
    c_earthReturn(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || !x.c_earthbent) return; x.c_earthbent = false; delete x.permAnimated;
        const O = G.players[x.owner]; if (!O.gy.includes(x)) return;
        pull(O.gy, x); putOntoBattlefield(O, x, true); log(`${x.card.name} returns to the battlefield tapped (earthbend).`);
    },
    // Firebending N: whenever this creature attacks, add N {R} until end of combat
    c_firebend(P, e, t, src) { const n = e.n || 0; P.pool = (P.pool || []).concat(Array(n).fill('R')); P.keepPoolTurn = G.turn; log(`${P.name} add${you(P) ? '' : 's'} ${'{R}'.repeat(n)} (firebending ${n}).`); },
    // Tivit, Seller of Secrets: each player votes for evidence (investigate) or bribery (Treasure)
    async c_tivit(P, e, t, src) {
        if (!VOTE_DEFS.tivit) VOTE_DEFS.tivit = { name: 'Tivit, Seller of Secrets', options: [{ key: 'evidence', label: 'Evidence', desc: 'the caster investigates per evidence vote' }, { key: 'bribery', label: 'Bribery', desc: 'the caster creates a Treasure per bribery vote' }], value: (k, X, caster) => forCaster(k === 'evidence' ? 3 : 2, X, caster) };
        const r = await holdVote(P, src, 'tivit');
        for (let k = 0; k < r.counts[0]; k++) applyEffect(P, { t: 'artToken', n: 1, kind: 'clue' }, null, src);
        for (let k = 0; k < r.counts[1]; k++) makeArtifactToken(P, 'treasure');
    },
    // Captain N'ghathrod: an artifact or creature card put into an opponent's graveyard from their library this turn
    async c_nghathrod(P, e, t, src) {
        const pool = []; foes(P).forEach(F => F.gy.filter(c => c.c_milledTurn === G.turn && /\b(Artifact|Creature)\b/.test(c.card.type)).forEach(c => pool.push([F, c])));
        if (!pool.length) return;
        const c = await pickOwn(P, pool.map(a => a[1]), `${src.card.name}: put an artifact or creature card milled this turn onto the battlefield under your control`, { optional: true }); if (!c) return;
        const F = pool.find(a => a[1] === c)[0]; reanimateFrom(P, F, c);
    }
});

// ===== Chunk 4 =====
Object.assign(TRIG_FN, {
    c_zadaCast: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && ['instant', 'sorcery'].includes(Rx(ctx.o).kind),
    c_dealsOne: (o, ctx) => !!ctx.src && ctx.src !== o && ctx.src.owner === o.owner && ctx.n === 1,
    c_anyCast: () => true,
    c_oliviaWatch: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    c_clavDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && !!ctx.o.c_clav
});
Object.assign(CMD_SCORE, { c_zada: () => 6, c_irma: () => 4, c_ghyrson: () => 5, c_clav: () => 4, c_clavDies: () => 4, c_norin: () => 0, c_olivia: () => 8, c_oliviaSweep: () => 0 });
const C_IRMA_LINE = 'At the beginning of combat on your turn, ~ becomes a copy of up to one other target creature you control, except her name is Irma, Part-Time Mutant and she has this ability. Then put a +1/+1 counter on it.';
Object.assign(CMD, {
    // Zada, Hedron Grinder: a spell that targets only Zada is copied for each other creature you control it could target
    async c_zada(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; const item = o && G.stack.find(i => i.o === o && i.kind === 'spell'); if (!item || !item.target || !item.target.o || item.target.o.uid !== src.uid) return;
        const te = firstTargetEffect(o); if (!te) return;
        const valid = validTargets(P, te, o).filter(v => v.o && v.o !== src && v.o.owner === P.i && isCreature(v.o)); if (!valid.length) return;
        for (const v of valid) { log(`${src.card.name}: ${item.name} is copied for ${v.o.card.name}.`); await copySpellItem(P, item, { target: { o: v.o } }); }
    },
    // Irma, Part-Time Mutant: becomes a copy of another creature you control (keeping her name and this ability), then a +1/+1 counter
    async c_irma(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = P.bf.filter(x => isCreature(x) && x !== src && !x.c_isCopy);
        const x = await pickOwn(P, pool, `${src.card.name}: become a copy of up to one other creature you control?`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (x && (P.isAI || AUTOPLAY ? creatureValue(x) > creatureValue(src) : true)) {
            const name = src.card.name; src.copyOf = src.copyOf || src.card;
            src.card = { ...x.card, id: `${x.card.id}-irma${uidSeq++}`, name, fullName: name, text: `${String(x.card.text || '').replace(/~|\bthis creature\b/g, '~')}\n${C_IRMA_LINE}`, type: x.card.type.replace(/Legendary /, '') };
            log(`${name} becomes a copy of ${x.card.name}.`);
        }
        const got = putCounters(src, 1, P); log(`${src.card.name} gets ${got} +1/+1 counter.`);
    },
    // Ghyrson Starn, Kelermorph: another source you control deals exactly 1 damage; Ghyrson deals 2 to the same permanent or player
    c_ghyrson(P, e, t, src) {
        const raw = G.ctxRaw || {}; const tgt = raw.o || raw.P; if (!tgt || !onBf(src.uid)) return;
        if (tgt.card && !onBf(tgt.uid)) return;
        log(`${src.card.name} deals 2 damage to ${tgt.card ? tgt.card.name : tgt.name}.`); damage(tgt, 2, src);
    },
    // Clavileno, First of the Blessed: an attacking Vampire becomes a Demon and gains a death trigger
    async c_clav(P, e, t, src) {
        const pool = c_ctxList().filter(x => onBf(x.uid) && x.owner === P.i && hasType(x, 'Vampire') && !hasType(x, 'Demon')); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: target attacking Vampire becomes a Demon`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        x.card = { ...x.card, id: `${x.card.id}-demon${uidSeq++}`, type: x.card.type.replace(/(—.*)$/, m => m + ' Demon') }; x.c_clav = true;
        log(`${x.card.name} becomes a Demon in addition to its other types, and gains "When this creature dies, draw a card and create a tapped 4/3 white and black Vampire Demon creature token with flying."`);
    },
    async c_clavDies(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || !x.c_clav) return; x.c_clav = false;
        drawCards(P, 1); await applyEffect(P, { t: 'token', n: 1, p: 4, q: 3, name: 'white black Vampire Demon', kw: ['flying'], tapped: true }, null, src);
    },
    // Norin the Wary: exile it when a player casts a spell or a creature attacks; back at the next end step
    c_norin(P, e, t, src) {
        if (!onBf(src.uid)) return; const O = G.players[src.owner];
        leaveBattlefield(src, 'exile'); log(`${src.card.name} is exiled.`);
        atEndStep(() => { if (O.exile.includes(src)) { pull(O.exile, src); putOntoBattlefield(O, src, false); } }, `${src.card.name} returns to the battlefield.`);
    },
    // Olivia, Crimson Bride: a creature card returns tapped and attacking; it is exiled once you control no legendary Vampire
    async c_olivia(P, e, t, src) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type)); if (!pool.length || !onBf(src.uid)) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card from your graveyard to the battlefield tapped and attacking`, { optional: true }); if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c, true); G.attackers.push(c.uid); c.c_exileNoVamp = true; if (src.atkTo !== undefined) c.atkTo = src.atkTo;
        log(`${c.card.name} enters tapped and attacking.`);
    },
    c_oliviaSweep(P, e, t, src) {
        if (P.bf.some(x => isCreature(x) && /Legendary/.test(x.card.type) && hasType(x, 'Vampire'))) return;
        P.bf.filter(x => x.c_exileNoVamp).forEach(x => { x.c_exileNoVamp = false; log(`${x.card.name} is exiled (no legendary Vampire).`); leaveBattlefield(x, 'exile'); });
    }
});

// ===== Chunk 5: abilities with X =====
async function c_pickOpp(P, why) {
    const f = foes(P).slice().sort((a, b) => a.life - b.life); if (f.length <= 1) return f[0] || null;
    if (P.isAI || AUTOPLAY) return f[0];
    const i = await askMode(P, why, f.map(F => `${F.name} (${F.life} life)`)); return f[i] || f[0];
}
// An activated ability with X in its cost: effect carries "{X}" strings that withX fills in at activation
function c_actX(R, line, costText, effect, patch) { const a = parseActivated(`${costText}: Draw X cards.`, R); a.effects = [effect]; a.text = line; if (patch) patch(a); R.acts.push(a); return a; }
COND_EXTRA.push([/^you control a Clue$/, () => P => P.bf.some(x => /\bClue\b/.test(x.card.type))]);
{
    const c_dol = dieOrLeave;
    dieOrLeave = function (o, zone) { if (o && o.ctr && o.ctr.finality > 0 && zone === 'gy' && !o.token) { log(`${o.card.name} is exiled instead (finality counter).`); zone = 'exile'; } return c_dol(o, zone); };
}
Object.assign(CMD_SCORE, { c_rydia: () => 6, c_oona: () => 4, c_gogo: () => 3, c_lonis: () => 4, c_katara: () => 6 });
Object.assign(CMD, {
    // Rydia, Summoner of Mist: a Saga card with mana value X returns with a finality counter and haste
    async c_rydia(P, e, t, src) {
        const X = Number(e.x); const pool = P.gy.filter(c => /\bSaga\b/.test(c.card.type) && (c.card.cmc || 0) === X); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a Saga card with mana value ${X} from your graveyard`, { optional: true }); if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c, false); c.ctr.finality = 1; c.tkw.push('haste'); c.ctr.lore = 1; sagaChapter(P, c);
        log(`${c.card.name} gets a finality counter.`);
    },
    // Oona, Queen of the Fae
    async c_oona(P, e, t, src) {
        const X = Number(e.x); const F = await c_pickOpp(P, `${src.card.name}: target opponent`); if (!F || X <= 0) return;
        const COL = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
        const tally = {}; F.library.forEach(c => (c.card.colors || []).forEach(k => { tally[k] = (tally[k] || 0) + 1; }));
        let col = Object.keys(COL).sort((a, b) => (tally[b] || 0) - (tally[a] || 0))[0];
        if (!(P.isAI || AUTOPLAY)) { const i = await askMode(P, `${src.card.name}: choose a color`, Object.values(COL)); col = Object.keys(COL)[i] || col; }
        let n = 0; for (let i = 0; i < X && F.library.length; i++) { const c = F.library.pop(); F.exile.push(c); if ((c.card.colors || []).includes(col)) n++; log(`${F.name} exile${you(F) ? '' : 's'} ${c.card.name}.`); }
        if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'blue black Faerie Rogue', kw: ['flying'] }, null, src);
    },
    // Gogo, Master of Mimicry: copy an activated or triggered ability you control X times
    async c_gogo(P, e, t, src) {
        const X = Number(e.x); if (!(X > 0)) return;
        const items = G.stack.filter(it => it.kind === 'trigger' && it.P === P && it.o !== src && !it.copy); if (!items.length) return;
        let item = items[items.length - 1];
        if (!(P.isAI || AUTOPLAY) && items.length > 1) { const i = await askMode(P, `${src.card.name}: copy which ability?`, items.map(it => it.name || (it.o && it.o.card.name) || 'ability')); item = items[i] || item; }
        for (let k = 0; k < X; k++) G.stack.push({ ...item, id: stackSeq++, copy: true });
        log(`${src.card.name}: ${item.name || 'an ability'} is copied ${X} time${X === 1 ? '' : 's'}.`);
    },
    // Lonis, Cryptozoologist: sacrifice X Clues, reveal the top X cards of an opponent's library
    async c_lonis(P, e, t, src) {
        const clues = P.bf.filter(x => /\bClue\b/.test(x.card.type)); if (!clues.length) return;
        const F = await c_pickOpp(P, `${src.card.name}: target opponent`); if (!F) return;
        const X = (P.isAI || AUTOPLAY) ? Math.min(clues.length, 4) : await askNumber(P, `${src.card.name}: sacrifice how many Clues?`, 0, clues.length, Math.min(clues.length, 3), { card: src.card });
        if (!X) return; clues.slice(0, X).forEach(c => sacPerm(P, c));
        const top = []; for (let i = 0; i < X && F.library.length; i++) top.push(F.library.pop());
        log(`${F.name} reveal${you(F) ? '' : 's'} ${top.map(c => c.card.name).join(', ')}.`);
        const pool = top.filter(c => !/\bLand\b/.test(c.card.type) && (c.card.cmc || 0) <= X);
        const pick = await pickOwn(P, pool, `${src.card.name}: put a nonland permanent card with mana value ${X} or less onto the battlefield under your control`, { optional: true });
        const rest = top.filter(c => c !== pick); shuffle(rest); F.library.unshift(...rest);
        if (pick) reanimateFromLib(P, F, pick);
    },
    // Katara, Water Tribe's Hope: your creatures have base power and toughness X/X until end of turn
    c_katara(P, e, t, src) {
        const X = Number(e.x); if (!(X > 0) || G.active !== P.i) return;
        P.bf.filter(isCreature).forEach(x => { x.baseSet = { turn: G.turn, p: X, q: X }; }); log(`Creatures ${you(P) ? 'you control' : `${P.name} controls`} have base power and toughness ${X}/${X} until end of turn.`);
    }
});
// A card put onto the battlefield from another player's library
function reanimateFromLib(P, F, c) { pull(F.library, c); resetObj(c); if (F !== P) { c.realOwner = c.owner; c.owner = P.i; } c.enteredTurn = G.turn; P.bf.push(c); log(`${c.card.name} enters the battlefield under ${you(P) ? 'your' : `${P.name}'s`} control.`); fire('enters', { o: c }); if (Rx(c).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: c, effects: Rx(c).etb }); }

// ===== Chunk 6 =====
const c_belloOk = x => ((/\bArtifact\b/.test(x.card.type) && !/\bEquipment\b/.test(x.card.type)) || (/\bEnchantment\b/.test(x.card.type) && !/\bAura\b/.test(x.card.type))) && (x.card.cmc || 0) >= 4 && !isCreature(x);
Object.assign(TRIG_FN, {
    c_belloEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && G.active === o.owner && c_belloOk(ctx.o),
    c_belloHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && !!ctx.src.c_bello && (ctx.hit || []).some(H => H.i !== o.owner),
    c_faramirWatch: (o, ctx) => { (ctx.list || []).forEach(x => { if (x.owner !== o.owner && c_attacksPlayer(x, o.owner)) { const X = G.players[x.owner]; X.c_attackedFaramir = G.turn; } }); return false; },
    c_faramirEnd: (o, ctx) => { const P = G.players[o.owner]; return P.c_faramir !== undefined && P.c_faramir === G.active && G.active !== o.owner; }
});
Object.assign(CMD_SCORE, { c_belloOn: () => 0, c_belloOff: () => 0, c_belloOne: () => 0, c_belloDraw: () => 3, c_faramirChoose: () => 0, c_faramirEnd: () => 6, c_kefka: () => 8, c_locke: () => 5 });
function c_belloAnimate(x) {
    x.permAnimated = { p: 4, q: 4 }; x.c_bello = true; x.sick = false; x.tkw.push('indestructible', 'haste');
    log(`${x.card.name} becomes a 4/4 Elemental creature with indestructible and haste.`);
}
Object.assign(CMD, {
    // Bello, Bard of the Brambles: during your turn your big artifacts and enchantments are 4/4 Elemental creatures
    c_belloOn(P, e, t, src) { P.bf.filter(c_belloOk).forEach(c_belloAnimate); },
    c_belloOne(P, e, t, src) { const x = G.ctxObj; if (x && onBf(x.uid) && c_belloOk(x)) c_belloAnimate(x); },
    c_belloOff(P, e, t, src) { P.bf.filter(x => x.c_bello).forEach(x => { x.c_bello = false; delete x.permAnimated; log(`${x.card.name} stops being a creature.`); }); },
    c_belloDraw(P, e, t, src) { drawCards(P, 1); },
    // Faramir, Prince of Ithilien: choose an opponent; at their next end step, draw if they didn't attack you, else three Human Soldiers
    async c_faramirChoose(P, e, t, src) { const F = await c_pickOpp(P, `${src.card.name}: choose an opponent`); if (F) { P.c_faramir = F.i; F.c_attackedFaramir = -1; log(`${P.name} ${you(P) ? 'choose' : 'chooses'} ${F.name} (${src.card.name}).`); } },
    async c_faramirEnd(P, e, t, src) {
        const F = G.players[P.c_faramir]; P.c_faramir = undefined; if (!F) return;
        if (F.c_attackedFaramir === G.turn) await applyEffect(P, { t: 'token', n: 3, p: 1, q: 1, name: 'white Human Soldier', kw: [] }, null, src);
        else drawCards(P, 1);
    },
    // Kefka, Dancing Mad: exile a card at random from each opponent's graveyard and cast the spells for free; owners lose life equal to mana value
    async c_kefka(P, e, t, src) {
        const got = []; foes(P).forEach(F => { if (F.gy.length) { const c = F.gy.splice(rand(F.gy.length), 1)[0]; c.realOwner = F.i; F.exile.push(c); got.push([F, c]); log(`${c.card.name} is exiled from ${F.name === 'You' ? 'your' : F.name + "'s"} graveyard.`); } });
        for (const [F, c] of got) {
            if (Rx(c).kind === 'land' || Rx(c).support === 'none') continue;
            const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card });
            if (!yes) continue;
            const mv = c.card.cmc || 0;
            if (await castFreeAuto(P, c) && mv > 0) { F.life -= mv; log(`${F.name} ${you(F) ? 'lose' : 'loses'} ${mv} life.`); fire('loseLife', { P: F, n: mv }); }
        }
    },
    // Locke, Treasure Hunter: each player mills a card; a Treasure if a land was milled; you may cast a spell from among them
    async c_locke(P, e, t, src) {
        const milled = []; G.players.filter(X => !X.out).forEach(X => doMill(X, 1).forEach(c => milled.push([X, c])));
        if (milled.some(([X, c]) => /\bLand\b/.test(c.card.type))) { makeArtifactToken(P, 'treasure'); log(`${P.name} ${you(P) ? 'create' : 'creates'} a Treasure token.`); }
        const spells = milled.filter(([X, c]) => Rx(c).kind !== 'land' && Rx(c).support !== 'none'); if (!spells.length) return;
        for (const [X, c] of spells) { if (X !== P) { pull(X.gy, c); c.realOwner = X.i; c.owner = P.i; c.playUntil = G.turn; c.playAny = true; P.exile.push(c); } else c.gyCastTurn = G.turn; }
        log(`${P.name} may cast a spell from among the milled cards this turn.`);
    }
});
