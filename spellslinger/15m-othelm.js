// Engine pieces for the Othelm / Wernog deck (2026-10-27). Wordings are in rules/othelm.js; each odd card is a CMD entry (ids start with ot_).
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.
// Uses pickOwn (15d-cmdr-soc.js), chooseFoeTarget (15i-jenova.js), sacPerm (15k-cmdr300.js), gLose (15-cmdr300g.js), nextTurnOf (15d-cmdr-shared.js), j_drawN (15-cmdr300j.js).

const otAI = P => P.isAI || AUTOPLAY;
const otFoes = P => foes(P).filter(x => !x.out);
const otClue = X => makeArtifactToken(X, 'clue');
// Sacrifices this turn (Havengul Laboratory, Obsessive Pursuit): counted as the event fires, so triggers see the new total
{
    const base = fire;
    fire = function (ev, ctx) {
        if (ev === 'sacrificed' && ctx && ctx.o && G) {
            const X = G.players[ctx.o.owner];
            if (X) { const t = X.ot_sac && X.ot_sac.turn === G.turn ? X.ot_sac : (X.ot_sac = { turn: G.turn, perms: 0, clues: 0 }); t.perms++; if (hasType(ctx.o, 'Clue')) t.clues++; }
        }
        return base.apply(this, arguments);
    };
}
const otSacT = X => (X.ot_sac && X.ot_sac.turn === G.turn ? X.ot_sac : { perms: 0, clues: 0 });
COND_EXTRA.push([/^you have drawn two or more cards this turn$/, () => P => P.j_drawT === G.turn && P.j_drawN >= 2]);
Object.assign(TRIG_FN, {
    ot_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    ot_selfBlocks: (o, ctx) => (ctx.list || []).includes(o),
    ot_iAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    ot_threeClues: (o, ctx) => otSacT(G.players[o.owner]).clues >= 3,
    ot_myCommanderEnters: (o, ctx) => !!ctx.o && ctx.o.isCommander && ctx.o.owner === o.owner && isCreature(ctx.o),
    ot_selfTransformed: (o, ctx) => !!ctx.o && ctx.o === o,
    ot_mysteryLeft: (o, ctx) => !!ctx.o && !!o.ot_mysteryCreature && ctx.o.uid === o.ot_mysteryCreature,
    ot_harnessed: (o, ctx) => !!o.ot_harnessed && G.active === o.owner
});
// Noble Heritage: protection from a player (damage to that player's target is prevented until the turn number stored)
{
    const base = damage;
    damage = function (target, n, src) {
        if (G && target && target.life !== undefined && target.ot_protFrom && src && src.owner !== undefined && target.ot_protFrom[src.owner] > G.turn) { log(`The damage from ${src.card ? src.card.name : 'that source'} is prevented (protection from ${G.players[src.owner].name}).`); return; }
        return base.apply(this, arguments);
    };
}
const otAskPlayerYes = async (X, msg, card) => (otAI(X) ? true : askYes(X, msg, { card }));
const otWorst = (pool, rank) => pool.slice().sort(rank)[0];

Object.assign(CMD_SCORE, { ot_othelm: () => 3, ot_wernog: () => 4, ot_demon: () => 8, ot_machinations: () => 2, ot_fungusDraw: () => 3, ot_balance: () => 6, ot_phalanx: () => 3, ot_heritage: () => 3, ot_nylaEnter: () => 3, ot_eagle: () => 3, ot_reveillark: () => 7, ot_shred: () => 2, ot_harness: () => 2, ot_historic: () => 6, ot_carnage: () => 3, ot_prismatic: () => 5, ot_poison: () => 2 });
Object.assign(CMD, {
    // Othelm: a creature card that went to your graveyard from the battlefield this turn comes back tapped
    async ot_othelm(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && c.toGyTurn === G.turn);
        const c = await pickOwn(P, pool, `${src.card.name}: return which creature card to the battlefield tapped?`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c, true); }
    },
    // Wernog: each opponent may investigate, the rest lose 1 life, you investigate once plus once for each who did
    async ot_wernog(P, e, t, src) {
        let n = 1;
        for (const X of otFoes(P)) {
            if (await otAskPlayerYes(X, `${src.card.name}: investigate? (Otherwise you lose 1 life, and ${P.name} investigates one fewer time.)`, src.card)) { otClue(X); log(`${X.name} investigate${you(X) ? '' : 's'}.`); n++; }
            else gLose(X, 1);
        }
        for (let i = 0; i < n; i++) otClue(P);
        log(`${P.name} ${you(P) ? 'investigate' : 'investigates'} ${n} time${n === 1 ? '' : 's'}.`);
    },
    // Bebop & Rocksteady: discard a card or sacrifice a permanent
    async ot_bebop(P, e, t, src) {
        let discard = false;
        if (P.hand.length) discard = otAI(P) ? aiKeepValue(P, P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0]) < 4 : await askYes(P, `${src.card.name}: discard a card? (Otherwise sacrifice a permanent.)`, { card: src.card });
        if (discard) { const d = await discardChosen(P, src.card.name); if (d) return; }
        const pool = P.bf.slice();
        const x = otAI(P) ? otWorst(pool, (a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b))) : await pickOwn(P, pool, `${src.card.name}: sacrifice a permanent`, { rank: (a, b) => permValue(a) - permValue(b) });
        if (x) sacPerm(P, x);
    },
    // Burning-Rune Demon: two cards with different names, an opponent decides which you get
    async ot_demon(P, e, t, src) {
        const names = new Set(P.library.map(c => c.card.name)); if (names.size < 2) return;
        if (!otAI(P) && !await askYes(P, `${src.card.name}: search your library for two cards with different names?`, { card: src.card })) return;
        const pool = P.library.filter(c => c.card.name !== src.card.name);
        const a = await pickOwn(P, pool, `${src.card.name}: choose the first card`, { rank: (x, y) => (y.card.cmc || 0) - (x.card.cmc || 0) });
        if (!a) return;
        const b = await pickOwn(P, pool.filter(c => c.card.name !== a.card.name), `${src.card.name}: choose the second card (a different name)`, { rank: (x, y) => (y.card.cmc || 0) - (x.card.cmc || 0) });
        if (!b) return;
        const F = opp(P) || otFoes(P)[0];
        log(`${P.name} reveals ${a.card.name} and ${b.card.name}.`);
        let give = a, other = b;
        if (F && !otAI(F)) { const c = await pickCard(F, [a, b], `${src.card.name}: choose the card ${P.name} puts into their hand (the other goes to the graveyard)`, { required: true }); if (c) { give = c; other = c === a ? b : a; } }
        else if (F) { give = (a.card.cmc || 0) <= (b.card.cmc || 0) ? a : b; other = give === a ? b : a; }
        pull(P.library, give); pull(P.library, other); P.hand.push(give); P.gy.push(other); other.toGyTurn = undefined;
        log(`${give.card.name} goes to ${P.name}'s hand and ${other.card.name} to the graveyard.`);
        P.library = shuffle(P.library);
    },
    // Demonic Taskmaster: sacrifice a creature other than itself each upkeep
    async ot_taskmaster(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src); if (!pool.length) return;
        const x = otAI(P) ? otWorst(pool, (a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b))) : await pickOwn(P, pool, `${src.card.name}: sacrifice a creature other than ${src.card.name}`, { rank: (a, b) => permValue(a) - permValue(b) });
        if (x) sacPerm(P, x);
    },
    // Dimir Machinations: look at the top three cards of a player's library, exile any number, the rest go back
    async ot_machinations(P, e, t, src) {
        const X = (t && t.p) || P; const top = X.library.slice(-3).reverse(); // the library's top is the end of the array
        if (!top.length) return;
        for (const c of top) {
            const own = X === P;
            const exile = otAI(P) ? (!own && !/\bLand\b/.test(c.card.type) && (c.card.cmc || 0) >= 3) : await askYes(P, `${src.card.name}: exile ${c.card.name} from ${own ? 'your' : X.name + "'s"} library?`, { card: c.card });
            if (exile) { pull(X.library, c); X.exile.push(c); log(`${c.card.name} is exiled from the top of ${X.name}'s library.`); }
        }
    },
    // Insidious Fungus (third mode, after the draw): a land card from your hand may enter tapped
    async ot_fungusDraw(P, e, t, src) {
        drawCards(P, 1);
        const lands = P.hand.filter(c => /\bLand\b/.test(c.card.type)); if (!lands.length) return;
        if (!otAI(P) && !await askYes(P, `${src.card.name}: put a land card from your hand onto the battlefield tapped?`, { card: src.card })) return;
        const l = await pickOwn(P, lands, `${src.card.name}: which land?`, { rank: (a, b) => 0 }); if (l) { pull(P.hand, l); putOntoBattlefield(P, l, true); }
    },
    // Magus of the Balance: lands, hands and creatures are balanced to the smallest player
    async ot_balance(P, e, t, src) {
        const live = G.players.filter(x => !x.out);
        const cats = [
            { name: 'lands', pool: X => X.bf.filter(c => /\bLand\b/.test(c.card.type)), act: (X, c) => sacPerm(X, c), rank: (a, b) => permValue(a) - permValue(b) },
            { name: 'cards in hand', pool: X => X.hand.slice(), act: (X, c) => { pull(X.hand, c); X.gy.push(c); c.discardTurn = G.turn; log(`${X.name} discards ${c.card.name}.`); }, rank: (a, b) => aiKeepValue(P, a) - aiKeepValue(P, b) },
            { name: 'creatures', pool: X => X.bf.filter(isCreature), act: (X, c) => sacPerm(X, c), rank: (a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)) }
        ];
        for (const cat of cats) {
            const min = Math.min(...live.map(X => cat.pool(X).length));
            for (const X of live) {
                for (let pool = cat.pool(X); pool.length > min; pool = cat.pool(X)) {
                    const c = otAI(X) ? otWorst(pool, (a, b) => cat.rank(a, b)) : await pickCard(X, pool, `${src.card.name}: choose a ${cat.name.replace(/s$/, '')} to give up (keep ${min})`, { required: true });
                    cat.act(X, c || pool[0]);
                }
            }
        }
    },
    // Netherborn Phalanx: each opponent loses 1 life for each creature they control
    ot_phalanx(P, e, t, src) { otFoes(P).forEach(X => gLose(X, X.bf.filter(isCreature).length)); },
    // Noble Heritage: for each of your commander creatures, every player may put two counters on a creature; opponents who do give you protection from them
    async ot_heritage(P, e, t, src) {
        let n = P.bf.filter(x => x.isCommander && x.owner === P.i && isCreature(x)).length;
        if (e.enter) n = Math.min(n, 1);
        for (let k = 0; k < n; k++) {
            for (const X of G.players.filter(x => !x.out)) {
                const pool = X.bf.filter(isCreature); if (!pool.length) continue;
                if (!await otAskPlayerYes(X, `${src.card.name}: put two +1/+1 counters on a creature you control?${X === P ? '' : ` (${P.name} gains protection from you until their next turn.)`}`, src.card)) continue;
                const c = await pickOwn(X, pool, `${src.card.name}: put two +1/+1 counters on which creature?`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
                if (c) { const got = putCounters(c, 2, X); log(`${c.card.name} gets ${got} +1/+1 counters.`); }
                if (X !== P) { P.ot_protFrom = P.ot_protFrom || {}; P.ot_protFrom[X.i] = nextTurnOf(P); log(`${P.name} ${you(P) ? 'gain' : 'gains'} protection from ${X.name} until ${you(P) ? 'your' : 'their'} next turn.`); }
            }
        }
    },
    // Havengul Mystery: a creature card from your graveyard comes back; when it leaves, the land transforms back
    async ot_mystery(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type));
        const c = await pickOwn(P, pool, `${src.card.name}: return which creature card to the battlefield?`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c); src.ot_mysteryCreature = c.uid; }
    },
    // Nyla: exile a creature card from your graveyard, lose X life and make X Clues; at your end step with no Clues it comes home
    async ot_nylaEnter(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
        const c = otAI(P) ? pool.filter(x => (x.card.cmc || 0) <= 5).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickOwn(P, pool, `${src.card.name}: exile a creature card from your graveyard (or none)`, { optional: true });
        if (!c) return;
        const x = c.card.cmc || 0; pull(P.gy, c); P.exile.push(c); c.nylaBy = src.uid; log(`${src.card.name} exiles ${c.card.name}.`);
        gLose(P, x); for (let i = 0; i < x; i++) otClue(P);
    },
    ot_nylaEnd(P, e, t, src) {
        if (P.bf.some(x => hasType(x, 'Clue'))) return;
        const back = P.exile.filter(c => c.nylaBy === src.uid);
        const c = back.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
        if (c) { pull(P.exile, c); c.nylaBy = undefined; P.hand.push(c); log(`${c.card.name} returns to ${P.name}'s hand.`); }
    },
    // Obsessive Pursuit
    ot_pursuitClue(P, e, t, src) { P.life -= 1; log(`${P.name} ${you(P) ? 'lose' : 'loses'} 1 life.`); fire('loseLife', { P, n: 1 }); otClue(P); },
    async ot_pursuitAttack(P, e, t, src) {
        const x = otSacT(P).perms; if (x <= 0) return;
        const atk = (G.attackers || []).map(onBf).filter(o => o && o.owner === P.i);
        const c = await pickOwn(P, atk, `${src.card.name}: put ${x} +1/+1 counter${x === 1 ? '' : 's'} on which attacking creature?`, { rank: (a, b) => pow(b) - pow(a) });
        if (!c) return;
        const got = putCounters(c, x, P); log(`${c.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`);
        if (x >= 3) { c.tkw.push('lifelink'); log(`${c.card.name} gains lifelink until end of turn.`); }
    },
    // Persuasive Interrogators: two poison counters on a target opponent
    async ot_poison(P, e, t, src) { const O = await chooseFoeTarget(P, `${src.card.name}: which opponent gets two poison counters?`); if (O && !O.out) { O.poison = (O.poison || 0) + 2; log(`${O.name} ${you(O) ? 'get' : 'gets'} two poison counters (${O.poison}).`); } },
    // Pitiless Carnage: sacrifice any number of permanents, draw that many
    async ot_carnage(P, e, t, src) {
        let n = 0;
        if (otAI(P)) {
            const fodder = P.bf.filter(x => x.token || hasType(x, 'Clue') || (/\bLand\b/.test(x.card.type) && P.bf.filter(l => /\bLand\b/.test(l.card.type)).length > 6));
            const lands = P.bf.filter(l => /\bLand\b/.test(l.card.type)).length;
            let spare = Math.max(0, lands - 6);
            for (const x of fodder) { if (/\bLand\b/.test(x.card.type)) { if (spare <= 0) continue; spare--; } sacPerm(P, x); n++; }
        } else {
            for (;;) {
                const pool = P.bf.slice(); if (!pool.length) break;
                const x = await pickCard(P, pool, `${src.card.name}: sacrifice a permanent (${n} so far) - or none to finish`, { optional: true });
                if (!x) break; sacPerm(P, x); n++;
            }
        }
        if (n > 0) drawCards(P, n);
    },
    // Prismatic Undercurrents: up to X basic lands to your hand, X = colors among your permanents
    async ot_prismatic(P, e, t, src) {
        const cols = new Set(); P.bf.forEach(x => (x.card.colors || []).forEach(c => cols.add(c)));
        let x = cols.size; const got = [];
        while (x-- > 0) {
            const pool = P.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type) && !got.includes(c));
            if (!pool.length) break;
            const c = otAI(P) ? pool.find(l => !got.some(g => g.card.name === l.card.name)) || pool[0] : await pickCard(P, pool, `${src.card.name}: take a basic land (${x + 1} left)`, { optional: true });
            if (!c) break; got.push(c);
        }
        got.forEach(c => { pull(P.library, c); P.hand.push(c); });
        if (got.length) log(`${P.name} puts ${got.map(c => c.card.name).join(', ')} into their hand.`);
        P.library = shuffle(P.library);
    },
    // Raven Eagle: exile up to one card from a graveyard; a creature card makes a Clue
    async ot_eagle(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => ({ c, X })));
        if (!pool.length) return;
        let pick;
        if (otAI(P)) pick = pool.slice().sort((a, b) => (b.X !== P ? 1 : 0) - (a.X !== P ? 1 : 0) || (/\bCreature\b/.test(b.c.card.type) ? 1 : 0) - (/\bCreature\b/.test(a.c.card.type) ? 1 : 0))[0];
        else { const c = await pickCard(P, pool.map(p => p.c), `${src.card.name}: exile up to one card from a graveyard`, { optional: true }); pick = pool.find(p => p.c === c); }
        if (!pick) return;
        pull(pick.X.gy, pick.c); pick.X.exile.push(pick.c); log(`${src.card.name} exiles ${pick.c.card.name}.`);
        if (/\bCreature\b/.test(pick.c.card.type)) otClue(P);
    },
    // Reveillark: up to two creature cards with power 2 or less come back
    async ot_reveillark(P, e, t, src) {
        for (let k = 0; k < 2; k++) {
            const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (Number(c.card.power) || 0) <= 2);
            const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with power 2 or less to the battlefield (${2 - k} left)`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
            if (!c) break; pull(P.gy, c); putOntoBattlefield(P, c);
        }
    },
    // Shred Memory: exile up to four cards from one graveyard
    async ot_shred(P, e, t, src) {
        const owners = G.players.filter(X => X.gy.length);
        if (!owners.length) return;
        let X;
        if (otAI(P)) X = owners.filter(o => o !== P).sort((a, b) => b.gy.length - a.gy.length)[0] || owners[0];
        else if (owners.length === 1) X = owners[0];
        else { const w = await pickWord(P, `${src.card.name}: exile cards from whose graveyard?`, owners.map(o => o.name)); X = owners.find(o => o.name === w) || owners[0]; }
        const gone = [];
        for (let i = 0; i < 4; i++) {
            const pool = X.gy.filter(c => !gone.includes(c)); if (!pool.length) break;
            const c = otAI(P) ? (X === P ? null : pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0]) : await pickCard(P, pool, `${src.card.name}: exile a card from ${X.name}'s graveyard (${4 - i} left) - or none`, { optional: true });
            if (!c) break; gone.push(c);
        }
        gone.forEach(c => { pull(X.gy, c); X.exile.push(c); });
        if (gone.length) log(`${src.card.name} exiles ${gone.map(c => c.card.name).join(', ')} from ${X.name}'s graveyard.`);
    },
    // The Soul Stone: exile a creature you control to harness it; then each upkeep a creature card returns
    async ot_harness(P, e, t, src) {
        if (!onBf(src.uid) || src.ot_harnessed) return;
        const pool = P.bf.filter(isCreature); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: exile a creature you control`, { required: true, rank: (a, b) => permValue(a) - permValue(b) });
        if (!x) return;
        log(`${x.card.name} is exiled.`); removeFromZones(x); P.exile.push(x);
        src.ot_harnessed = true; log(`${src.card.name} is harnessed.`);
    },
    async ot_soulStone(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type));
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card from your graveyard to the battlefield`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c); }
    },
    // What Must Be Done, second mode: a historic permanent card comes back (a creature gets two more counters)
    async ot_historic(P, e, t, src) {
        const pool = P.gy.filter(c => /\bArtifact\b|\bLegendary\b|\bSaga\b/.test(c.card.type) && !/\b(Instant|Sorcery)\b/.test(c.card.type));
        const c = await pickOwn(P, pool, `${src.card.name}: return a historic permanent card from your graveyard`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c);
        if (onBf(c.uid) && isCreature(c)) { const got = putCounters(c, 2, P); log(`${c.card.name} gets ${got} additional +1/+1 counters.`); }
    }
});
