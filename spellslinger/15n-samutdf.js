// Engine pieces for the Samut, the Driving Force deck (2026-10-27). Wordings are in rules/samutdf.js; each odd card is a CMD entry (ids start with sd_).
// Speed is a real counter (P.speed, 0 to 4): "Start your engines!" sets it to 1, and it rises by 1 once on each of your turns when an opponent loses life.
// "Max speed —" lines are marked by the card reader (maxSpeed / the condition "you have max speed"). Choices inside resolving spells are made as they resolve.
// Uses pickOwn (15d-cmdr-soc.js), castCopyFree / castFreeAuto, chooseFoeTarget (15i-jenova.js), becomeCopyEOT (15d-cmdr-shared.js), gainLifeFor, tokenCopyOf.

const sdAI = P => P.isAI || AUTOPLAY;
const sdSpeed = P => P.speed || 0;
COND_EXTRA.push([/^you have max speed$/, () => P => sdSpeed(P) >= 4]);

// ---- speed ----
{
    const base = fire;
    fire = function (ev, ctx) {
        const r = base.apply(this, arguments);
        if (!G || G.over) return r;
        if (ev === 'enters' && ctx && ctx.o && Rx(ctx.o).startEngines) {
            const X = G.players[ctx.o.owner];
            if (X && !sdSpeed(X)) { X.speed = 1; log(`${X.name} start${you(X) ? '' : 's'} their engines: speed 1.`); }
        }
        if ((ev === 'loseLife' || ev === 'playerDamaged') && ctx && ctx.P && (ctx.n || 0) > 0 && G.active !== undefined && G.active !== null) {
            const A = G.players[G.active];
            if (A && ctx.P !== A && !ctx.P.out && sdSpeed(A) > 0 && sdSpeed(A) < 4 && A.speedTurn !== G.turn) {
                A.speed = sdSpeed(A) + 1; A.speedTurn = G.turn;
                log(`${A.name}'s speed increases to ${A.speed}${A.speed >= 4 ? ' (max speed)' : ''}.`);
            }
        }
        // Forth Eorlingas!: until end of turn, combat damage to a player makes you the monarch
        if (ev === 'combatHitAny' && ctx && ctx.P && G.players.some(X => X.sdMonarchTurn === G.turn)) {
            const X = G.players[G.active];
            if (X && X.sdMonarchTurn === G.turn && G.monarch !== X.i) { G.monarch = X.i; log(`${X.name} ${you(X) ? 'become' : 'becomes'} the monarch (Forth Eorlingas!).`); }
        }
        // Paradigm: at the start of your first main phase, offer a free copy of each of your paradigm cards in exile
        if (ev === 'main1') {
            const X = G.players[G.active];
            if (X && !X.out) X.exile.filter(c => c.paradigmP === X.i).forEach(c => (G.trigQ = G.trigQ || []).push({ P: X, o: c, effects: [{ t: 'cmd', id: 'sd_paradigm' }] }));
        }
        return r;
    };
}
// dynamic numbers
{
    const base = dynN;
    dynN = function (P, e, source) {
        if (e && e.nFrom === 'sdSpeed') return sdSpeed(P);
        if (e && e.nFrom === 'sdAtkMe') return (G.attackers || []).map(u => onBf(u)).filter(x => x && x.owner !== P.i && (x.atkTo === undefined || x.atkTo === null || x.atkTo === P.i)).length;
        return base.apply(this, arguments);
    };
}
// abilities and triggers that only work at max speed
{
    const baseTrig = trigMatches;
    trigMatches = function (tr, ev, o, ctx) {
        if (tr.maxSpeed && sdSpeed(G.players[o.owner]) < 4) return false;
        return baseTrig.apply(this, arguments);
    };
    const baseCan = canActivate;
    canActivate = function (P, o, a) {
        if (a && a.maxSpeed && sdSpeed(P) < 4) return false;
        return baseCan.apply(this, arguments);
    };
}
// Legendary creature spells have convoke (We Ride at Dawn)
function hasConvoke(o) {
    if (Rx(o).kw.has('convoke')) return true;
    return !!G && Rx(o).kind === 'creature' && /Legendary/.test(o.card.type) && G.players[o.owner].bf.some(a => Rx(a).convokeLegend && !lostAbilities(a));
}

Object.assign(TRIG_FN, {
    sd_selfAttacksBig: (o, ctx) => (ctx.list || []).includes(o) && pow(o) >= 6,
    sd_selfAttacksAny: (o, ctx) => (ctx.list || []).includes(o),
    sd_myCombat: (o, ctx) => G.active === o.owner,
    sd_myNoncreatureCast: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && !/Creature/.test(ctx.o.card.type),
    sd_myCommanderAttacks: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && x.isCommander)
});
STATIC_FN.sd_atkOpp = o => (G.attackers || []).includes(o.uid) && o.owner !== undefined && (o.atkTo === undefined || o.atkTo === null || o.atkTo !== o.owner);

const sdBest = (pool, rank) => pool.slice().sort(rank)[0];
Object.assign(CMD_SCORE, { sd_eorlingas: () => 6, sd_onslaught: () => 6, sd_avalanche: () => 6, sd_borrowA: () => 2, sd_borrowB: () => 2, sd_congregate: () => 2, sd_terrain: () => 5, sd_capstone: () => 6, sd_gogo: () => 0, sd_howlsquad: () => 0, sd_hulkling: () => 0, sd_oviya: () => 3, sd_thunderhulk: () => 0, sd_elixir: () => 1, sd_paradigm: () => 0 });
Object.assign(CMD, {
    // Forth Eorlingas!: X 2/2 Knights with trample and haste; combat damage to a player this turn makes you the monarch
    async sd_eorlingas(P, e, t, src) {
        await applyEffect(P, { t: 'token', n: e.n || 0, p: 2, q: 2, name: 'red Human Knight', kw: ['trample', 'haste'] }, null, src);
        P.sdMonarchTurn = G.turn;
    },
    // Devastating Onslaught: X hasty token copies of an artifact or creature you control, sacrificed at the next end step
    async sd_onslaught(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        for (let k = 0; k < (e.n || 0); k++) { const tok = tokenCopyOf(P, x.card); tok.tkw.push('haste'); tok.sick = false; tok.sacAtEnd = G.turn; }
    },
    // Become the Avalanche: draw for each creature with power 4+, then creatures get +X/+X where X is your hand size
    async sd_avalanche(P) {
        const n = P.bf.filter(x => isCreature(x) && pow(x) >= 4).length;
        if (n > 0) drawCards(P, n);
        const X = P.hand.length;
        P.bf.filter(isCreature).forEach(x => { x.tp += X; x.tq += X; });
        log(`Creatures ${you(P) ? 'you control' : `${P.name} controls`} get +${X}/+${X} until end of turn.`);
    },
    // Borrowed Knowledge: discard your hand, then draw cards equal to the opponent's hand / the cards discarded
    async sd_borrowA(P, e, t, src) {
        const O = await chooseFoeTarget(P, `${src && src.card ? src.card.name : 'Borrowed Knowledge'}: choose a target opponent`);
        const n = O ? O.hand.length : 0;
        sdDiscardHand(P);
        if (n > 0) drawCards(P, n);
    },
    async sd_borrowB(P) { const n = sdDiscardHand(P); if (n > 0) drawCards(P, n); },
    // Congregate: target player gains 2 life for each creature on the battlefield
    sd_congregate(P, e, t) { const X = (t && t.p) || P; const n = allPerms().filter(isCreature).length; gainLifeFor(X, 2 * n); },
    // Treacherous Terrain: damage to each opponent equal to the number of lands they control
    sd_terrain(P, e, t, src) {
        foes(P).filter(F => !F.out).forEach(F => { const n = F.bf.filter(x => /\bLand\b/.test(x.card.type)).length; if (n > 0) damage(F, n, src); });
    },
    // Improvisation Capstone: exile from the top until the total mana value is 4+, then cast any of them free
    async sd_capstone(P, e, t, src) {
        const got = []; let tot = 0;
        while (tot < 4 && P.library.length) { const c = P.library.pop(); P.exile.push(c); got.push(c); tot += c.card.cmc || 0; }
        log(`${P.name} exile${you(P) ? '' : 's'} ${got.map(c => c.card.name).join(', ') || 'nothing'} from the top of the library.`);
        for (const c of got) {
            if (!P.exile.includes(c) || Rx(c).kind === 'land') continue;
            const yes = sdAI(P) ? true : await askYes(P, `${src && src.card ? src.card.name : 'Improvisation Capstone'}: cast ${c.card.name} without paying its mana cost?`, { card: c.card });
            if (yes) await castFreeAuto(P, c);
        }
    },
    // Elixir: shuffle your nonland cards from the graveyard into the library, gain that much life
    sd_elixir(P) {
        const cards = P.gy.filter(c => !/\bLand\b/.test(c.card.type));
        cards.forEach(c => { pull(P.gy, c); P.library.push(c); });
        shuffle(P.library);
        log(`${P.name} shuffle${you(P) ? '' : 's'} ${cards.length} cards from the graveyard into the library.`);
        if (cards.length) gainLifeFor(P, cards.length);
    },
    // Gogo: copy another creature you control until end of turn, +2/+0, haste, both attack
    async sd_gogo(P, e, t, src) {
        if (!src || !onBf(src.uid)) return;
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        if (!pool.length) return;
        if (!sdAI(P) && !(await askYes(P, `${src.card.name}: become a copy of another creature you control until end of turn?`, { card: src.card }))) return;
        const x = await pickOwn(P, pool, `${src.card.name}: copy which creature?`, { rank: (a, b) => pow(b) - pow(a) });
        if (!x) return;
        becomeCopyEOT(src, x, { keepName: true, haste: true });
        src.tp += 2; x.tp += 2;
        x.tkw.push('haste'); x.sick = false;
        src.mustAttackTurn = G.turn; x.mustAttackTurn = G.turn;
        log(`${src.card.name} and ${x.card.name} each get +2/+0 and haste and must attack.`);
    },
    // Howlsquad Heavy: a 1/1 Goblin each combat that attacks if able
    async sd_howlsquad(P, e, t, src) {
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'red Goblin', kw: [] }, null, src);
        if (G.lastMade) G.lastMade.mustAttackTurn = G.turn;
    },
    // Hulkling: a copy of another creature, 4/4 with flying and this ability, until end of turn
    async sd_hulkling(P, e, t, src) {
        if (!src || !onBf(src.uid)) return;
        const pool = allPerms().filter(x => isCreature(x) && x !== src && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i));
        if (!pool.length) return;
        const x = sdAI(P) ? sdBest(pool, (a, b) => creatureValue(b) - creatureValue(a)) : await pickOwn(P, pool, `${src.card.name}: become a copy of up to one other creature`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (!x) return;
        const orig = src.copyOf || src.card;
        becomeCopyEOT(src, x, { keepName: true });
        const line = ((orig.text || '').split('\n').find(l => /^Whenever you cast a noncreature spell/.test(l))) || '';
        src.card = { ...src.card, power: '4', toughness: '4', text: [src.card.text, line].filter(Boolean).join('\n') };
        src.tkw.push('flying');
    },
    // Oviya: put a creature or Vehicle card from hand onto the battlefield (two +1/+1 counters if it's an artifact)
    async sd_oviya(P, e, t, src) {
        const pool = P.hand.filter(c => /Creature|Vehicle/.test(c.card.type));
        if (!pool.length) return;
        const pick = await pickOwn(P, pool, `${src && src.card ? src.card.name : 'Oviya'}: put a creature or Vehicle card onto the battlefield`, { optional: true });
        if (!pick) return;
        pull(P.hand, pick); putOntoBattlefield(P, pick);
        if (/Artifact/.test(pick.card.type)) putCounters(pick, 2, P);
    },
    // Threefold Thunderhulk: Gnome artifact tokens equal to its power
    async sd_thunderhulk(P, e, t, src) {
        const n = src && onBf(src.uid) ? Math.max(0, pow(src)) : 0;
        if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'colorless Gnome', artifact: true, kw: [] }, null, src);
    },
    // Paradigm: copy and cast it free
    async sd_paradigm(P, e, t, src) {
        if (!src || !P.exile.includes(src) || src.paradigmP !== P.i) return;
        const yes = sdAI(P) ? true : await askYes(P, `${src.card.name} (paradigm): cast a copy without paying its mana cost?`, { card: src.card });
        if (yes) await castCopyFree(P, src.card);
    }
});
function sdDiscardHand(P) {
    const cards = P.hand.slice();
    cards.forEach(c => { pull(P.hand, c); P.gy.push(c); c.discardTurn = G.turn; });
    if (cards.length) { noteDiscard(P, cards.length); log(`${P.name} discard${you(P) ? '' : 's'} ${cards.length === 1 ? cards[0].card.name : `${cards.length} cards`}.`); }
    return cards.length;
}
// A mana ability printed after "Max speed —" replaces the card's own mana ability only at max speed (the reader stores it as msMana)
{
    const base = manaOf;
    manaOf = function (x) {
        const r = x && Rx(x);
        if (r && r.msMana && G && G.players[x.owner]) {
            if (sdSpeed(G.players[x.owner]) >= 4) { const save = r.mana; r.mana = r.msMana; try { return base.apply(this, arguments); } finally { r.mana = save; } }
            if (!r.mana) return null;
        }
        return base.apply(this, arguments);
    };
}
// Flags printed after "Max speed —" that the reader keeps in R.msProps are switched on only while the permanent's owner has max speed
function msView(o, r) {
    const X = G && G.players[o.owner];
    const on = !!X && sdSpeed(X) >= 4;
    if (r.msOn !== on) { for (const k in r.msProps) { if (on) r[k] = r.msProps[k]; else delete r[k]; } r.msOn = on; }
    return r;
}
