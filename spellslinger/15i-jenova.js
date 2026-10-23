// Engine pieces for the Jenova, Ancient Calamity deck (2026-10-21, owner's request: make the whole list playable). Wordings: rules/jenova.js.
// Like the other deck rounds, choices inside a resolving spell are made as it resolves (a person gets pick screens, the computer takes the best).
const jvCreatureCard = x => /\bCreature\b/.test(x.card.type);
const jvPermanentCard = x => !['instant', 'sorcery'].includes(Rx(x).kind);
const jvBestMv = (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) || (Number(b.card.power) || 0) - (Number(a.card.power) || 0);

// Several cards one at a time, each optional after the first "at least" ones; `ok(card, chosen)` filters what can still be picked
async function jvPickSeveral(P, pool, title, max, ok) {
    const chosen = [];
    for (let k = 0; k < max; k++) {
        const left = pool.filter(x => !chosen.includes(x) && (!ok || ok(x, chosen)));
        if (!left.length) break;
        const pick = (P.isAI || AUTOPLAY) ? left.slice().sort(jvBestMv)[0] : await pickCard(P, left, `${title} (${k + 1} of up to ${max}; skip to stop)`, {});
        if (!pick) break;
        chosen.push(pick);
    }
    return chosen;
}
// Cards returned from your graveyard to the battlefield (resets them, runs enters triggers)
function jvReanimateAll(P, cards) { cards.forEach(c => { if (P.gy.includes(c)) putOntoBattlefield(P, c); }); }
// Blight N: put N -1/-1 counters on a creature you control (a person picks, the computer takes its weakest)
async function jvBlight(P, n, src) {
    const pool = P.bf.filter(isCreature);
    if (!pool.length) return;
    const pick = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : await pickCard(P, pool, `${src ? src.card.name : 'Blight'}: put ${n} -1/-1 counters on a creature you control`, { required: true }) || pool[0];
    pick.counters -= n; log(`${pick.card.name} gets ${n} -1/-1 counters (blight ${n}).`);
}

Object.assign(CMD_SCORE, {
    dinaGuidance: P => (P.library.some(jvCreatureCard) ? 5 : 0), beholdSix: P => Math.min(10, P.gy.filter(jvCreatureCard).length * 3), agadeemX: P => (P.gy.filter(jvCreatureCard).length >= 2 ? 8 : 0),
    blightIfNotMain: () => 0, witchKing: P => (P.bf.some(isCreature) && foes(P).some(F => F.bf.some(isCreature)) ? 4 : 0), campfire: P => (P.command.length || P.gy.some(x => x.isCommander) ? 5 : 0), elixir: P => (P.life <= 15 ? 3 : 0),
    callDamageControl: P => (P.gy.length >= 2 ? 4 : 0), pleaReturn: P => (P.gy.some(jvCreatureCard) ? 4 : 0)
});
Object.assign(CMD, {
    // Dina's Guidance: a creature card from the library to your hand or your graveyard
    async dinaGuidance(P, e, t, src) {
        const pool = P.library.filter(jvCreatureCard);
        log(`${P.name} ${you(P) ? 'search' : 'searches'} ${you(P) ? 'your' : 'their'} library for a creature card.`);
        const pick = await pickOwn(P, pool, `${src.card.name}: search for a creature card`, { optional: true });
        if (pick) {
            pull(P.library, pick);
            const toHand = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: put ${pick.card.name} into your hand? (Cancel = graveyard)`, { card: pick.card, yes: 'Hand', no: 'Graveyard' });
            (toHand ? P.hand : P.gy).push(pick);
            log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} into ${you(P) ? 'your' : 'their'} ${toHand ? 'hand' : 'graveyard'}.`);
        }
        shuffleLib(P);
    },
    // Behold the Sinister Six!: up to six creature cards with different names
    async beholdSix(P, e, t, src) {
        const chosen = await jvPickSeveral(P, P.gy.filter(jvCreatureCard), `${src.card.name}: return creature cards`, 6, (x, ch) => !ch.some(c => c.card.name === x.card.name));
        jvReanimateAll(P, chosen);
        if (!chosen.length) log(`${src.card.name}: no creature cards returned.`);
    },
    // Agadeem's Awakening: any number of creature cards with different mana values X or less
    async agadeemX(P, e, t, src) {
        const X = G.curX || 0;
        const chosen = await jvPickSeveral(P, P.gy.filter(x => jvCreatureCard(x) && (x.card.cmc || 0) <= X), `${src.card.name}: return creature cards with different mana values (X = ${X})`, 99, (x, ch) => !ch.some(c => (c.card.cmc || 0) === (x.card.cmc || 0)));
        jvReanimateAll(P, chosen);
    },
    // Dose of Dawnglow: if it isn't your main phase, blight 2
    async blightIfNotMain(P, e, t, src) {
        const main = G.players[G.active] === P && (G.phase === 'main1' || G.phase === 'main2');
        if (!main) await jvBlight(P, 2, src);
    },
    // Rise of the Witch-king
    async witchKing(P, e, t, src) {
        const before = P.gy.length;
        await applyEffect(P, { t: 'edict', who: 'each player', what: 'creature' }, null, src);
        if (!G.edictDid || !G.edictDid[P.i]) return;
        const gone = P.gy[P.gy.length - 1];
        const pool = P.gy.filter(x => jvPermanentCard(x) && x !== gone && x !== src);
        void before;
        const pick = await pickOwn(P, pool, `${src.card.name}: return another permanent card from your graveyard to the battlefield (or none)`, { optional: true });
        if (pick) putOntoBattlefield(P, pick);
    },
    // Campfire: commanders you own go to your hand from the command zone and the graveyard; the graveyard is shuffled into the library; Campfire is exiled
    campfire(P, e, t, src) {
        if (P.gy.includes(src)) { pull(P.gy, src); G.players[src.owner].exile.push(src); }
        else if (onBf(src.uid)) leaveBattlefield(src, 'exile');
        for (const c of P.command.slice()) { pull(P.command, c); P.hand.push(c); log(`${c.card.name} goes from the command zone to ${you(P) ? 'your' : 'their'} hand.`); }
        for (const c of P.gy.filter(x => x.isCommander)) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} goes from the graveyard to ${you(P) ? 'your' : 'their'} hand.`); }
        P.library.push(...P.gy.splice(0)); P.library = shuffle(P.library);
        log(`${P.name} ${you(P) ? 'shuffle' : 'shuffles'} ${you(P) ? 'your' : 'their'} graveyard into ${you(P) ? 'your' : 'their'} library.`);
    },
    // Elixir of Immortality: it and your graveyard are shuffled into their owners' libraries (the life was gained by the effect before it)
    elixir(P, e, t, src) {
        if (onBf(src.uid)) leaveBattlefield(src, 'library');
        P.library.push(...P.gy.splice(0)); P.library = shuffle(P.library);
        log(`${P.name} ${you(P) ? 'shuffle' : 'shuffles'} Elixir of Immortality and ${you(P) ? 'your' : 'their'} graveyard into ${you(P) ? 'your' : 'their'} library.`);
    },
    // Call Damage Control: choose up to two kinds (artifact, creature, enchantment, land), return a card of each
    async callDamageControl(P, e, t, src) {
        const kinds = [['artifact', /\bArtifact\b/], ['creature', /\bCreature\b/], ['enchantment', /\bEnchantment\b/], ['land', /\bLand\b/]].filter(([, re]) => P.gy.some(x => re.test(x.card.type)));
        const taken = [];
        for (let k = 0; k < 2; k++) {
            const left = kinds.filter(([n]) => !taken.includes(n));
            const pool = P.gy.filter(x => left.some(([, re]) => re.test(x.card.type)));
            const pick = await pickOwn(P, pool, `${src.card.name}: return a card from your graveyard to your hand (${k + 1} of up to 2; skip to stop)`, { optional: k > 0 || !(P.isAI || AUTOPLAY) });
            if (!pick) break;
            const kind = left.find(([, re]) => re.test(pick.card.type));
            if (kind) taken.push(kind[0]);
            pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : `${P.name}'s`} hand.`);
        }
    },
    // Desperate Plea mode 1: return a creature card with power no greater than the sacrificed creature's
    async pleaReturn(P, e, t, src) {
        const lim = G.lastSacPow || 0;
        const pool = P.gy.filter(x => jvCreatureCard(x) && (Number(x.card.power) || 0) <= lim);
        const pick = await pickOwn(P, pool, `${src.card.name}: return a creature card with power ${lim} or less`, { optional: false });
        if (pick) putOntoBattlefield(P, pick);
    }
});

// ---- Batch B: sacrifice, edicts, small pieces ----
const jvFoes = P => foes(P);
// Timed power / toughness changes ("until your next turn"): o.pt2 = { p, q, until } is in force while G.turn < until
function ptTimed(o, which) { const t = o.pt2; return t && G && G.turn < t.until ? t[which] : 0; }
// Sacrifice a permanent: fires the event, then it dies or is put into the graveyard
function jvSacrifice(P, x) { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${x.card.name}.`); fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); }
TRIG_FN.otherCreatureSacrificed = (o, ctx) => !!ctx.o && ctx.o !== o && isCreature(ctx.o);
TRIG_FN.archfiendDiscard = (o, ctx) => !!ctx.o && ctx.o !== o && ctx.P.i === o.owner;
COUNT_EXTRA.push([/^the number of creature and planeswalker cards in your graveyard$/, () => o => G.players[o.owner].gy.filter(x => /Creature|Planeswalker/.test(x.card.type)).length]);
COND_EXTRA.push([/^there are fewer than eight cards in your graveyard$/, () => P => P.gy.length < 8]);
COND_EXTRA.push([/^you control an artifact$/, () => P => P.bf.some(x => /\bArtifact\b/.test(x.card.type))]);

Object.assign(CMD_SCORE, {
    zeroPoint: P => { const mine = P.bf.filter(isCreature).length, theirs = foes(P).reduce((a, F) => a + F.bf.filter(isCreature).length, 0); return theirs - mine >= 3 && P.life > 12 ? 6 : 0; },
    flareEdict: P => (foes(P).some(F => F.bf.some(isCreature)) ? 6 : 0), winterEtb: () => 1, zodiarEtb: () => 0, technoEtb: () => 0, technoReturn: P => (P.gy.some(jvCreatureCard) ? 3 : 0),
    tbwDraw: P => (P.bf.filter(isCreature).length >= 3 ? 2 : 0), tbwReturn: () => 5, garrukMinus: () => 4, garrukSac: P => (P.bf.filter(isCreature).length >= 1 ? 3 : 0), garrukDiscard: P => (foes(P).some(F => F.hand.length >= 2) ? 4 : 0),
    strengthOfWill: () => 3, galufsAct: () => 3, troopPonies: P => (P.library.some(x => /\bBasic\b/.test(x.card.type)) ? 2 : 0), archfiendCounters: () => 5, triadMana: () => 1, selfCounter: () => 5
});
Object.assign(CMD, {
    // Zero Point Ballad: destroy every creature with toughness X or less, lose X life; with X 6 or more, take one of them back under your control
    async zeroPoint(P, e, t, src) {
        const X = G.curX || 0;
        const doomed = allPerms().filter(x => isCreature(x) && tou(x) <= X);
        const cards = [];
        for (const o of doomed) { if (!onBf(o.uid)) continue; const owner = G.players[o.owner]; destroy(o); if (!o.token && owner.gy.includes(o)) cards.push([owner, o]); }
        if (X > 0) { P.life -= X; log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${X} life.`); }
        if (X >= 6 && cards.length) {
            const pick = await pickOwn(P, cards.map(c => c[1]), `${src.card.name}: return a creature card put into a graveyard this way to the battlefield under your control`, { optional: false });
            const hit = cards.find(c => c[1] === pick);
            if (hit) reanimateFrom(P, hit[0], pick);
        }
    },
    // Flare of Malice: each opponent sacrifices their creature or planeswalker with the greatest mana value (they pick among ties)
    async flareEdict(P, e, t, src) {
        for (const F of foes(P)) {
            const pool = F.bf.filter(x => isCreature(x) || isPlaneswalker(x));
            if (!pool.length) continue;
            const hi = Math.max(...pool.map(x => x.card.cmc || 0));
            const top = pool.filter(x => (x.card.cmc || 0) === hi);
            const pick = top.length === 1 ? top[0] : await chooseFrom(F, top, `${src.card.name}: sacrifice a creature or planeswalker with the greatest mana value`);
            if (pick) jvSacrifice(F, pick);
        }
    },
    // Winter, Tormented Loner: you may sacrifice a creature or planeswalker; if you do, each opponent sacrifices a creature of their choice
    async winterEtb(P, e, t, src) {
        const pool = P.bf.filter(x => (isCreature(x) || isPlaneswalker(x)) && x !== src || x === src && false);
        if (!pool.length) return;
        const foeBest = Math.max(0, ...foes(P).flatMap(F => F.bf.filter(isCreature).map(x => permValue(x))));
        const cheap = pool.slice().sort((a, b) => permValue(a) - permValue(b))[0];
        const yes = (P.isAI || AUTOPLAY) ? (!!cheap && (cheap.token || permValue(cheap) < Math.max(3, foeBest - 1)) && foes(P).some(F => F.bf.some(isCreature))) : await askYes(P, `${src.card.name}: sacrifice a creature or planeswalker so each opponent sacrifices a creature?`, { card: src.card });
        if (!yes) return;
        const f = (P.isAI || AUTOPLAY) ? cheap : (await pickCard(P, pool, `${src.card.name}: choose a creature or planeswalker to sacrifice`, { required: true })) || cheap;
        jvSacrifice(P, f);
        for (const F of foes(P)) { const c = await chooseFrom(F, F.bf.filter(isCreature), `${src.card.name}: sacrifice a creature`); if (c) jvSacrifice(F, c); }
    },
    // Zodiark, Umbral God: each player sacrifices half their non-God creatures, rounded down
    async zodiarEtb(P, e, t, src) {
        for (const X of G.players.filter(x => !x.out)) {
            const pool = X.bf.filter(x => isCreature(x) && !hasType(x, 'God'));
            const n = Math.floor(pool.length / 2);
            if (!n) continue;
            const picks = await chooseSacN(X, pool, n, `${src.card.name}: sacrifice half your non-God creatures`);
            for (const x of picks) if (onBf(x.uid)) jvSacrifice(X, x);
        }
    },
    selfCounter(P, e, t, src) { if (onBf(src.uid)) { putCounters(src, 1, P); log(`${src.card.name} gets a +1/+1 counter.`); } },
    // Ruthless Technomancer: sacrifice another creature, create Treasures equal to its power
    async technoEtb(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        if (!pool.length) return;
        const cheap = pool.slice().sort((a, b) => permValue(a) - permValue(b))[0];
        const yes = (P.isAI || AUTOPLAY) ? (cheap.token || permValue(cheap) <= 3) && pow(cheap) >= 2 : await askYes(P, `${src.card.name}: sacrifice another creature to create Treasures equal to its power?`, { card: src.card });
        if (!yes) return;
        const f = (P.isAI || AUTOPLAY) ? cheap : (await pickCard(P, pool, `${src.card.name}: choose a creature to sacrifice`, { required: true })) || cheap;
        const n = Math.max(0, pow(f));
        jvSacrifice(P, f);
        if (n > 0) await applyEffect(P, { t: 'artToken', kind: 'treasure', n }, null, src);
    },
    // Ruthless Technomancer's ability: sacrifice X artifacts, return a creature card with power X or less (the choice is made as it resolves)
    async technoReturn(P, e, t, src) {
        const arts = P.bf.filter(x => /\bArtifact\b/.test(x.card.type));
        if (!arts.length) return;
        const pool = P.gy.filter(jvCreatureCard);
        if (!pool.length) return;
        let X;
        if (P.isAI || AUTOPLAY) { const best = pool.slice().sort((a, b) => permValueCard(b) - permValueCard(a)).find(c => (Number(c.card.power) || 0) <= arts.length) || null; if (!best) return; X = Math.max(1, Number(best.card.power) || 0); }
        else X = await askNumber(P, `${src.card.name}: sacrifice how many artifacts (X)?`, 1, arts.length, 1, { card: src.card, ok: 'Sacrifice' });
        if (!X) return;
        const fods = await chooseSacN(P, arts, X, `${src.card.name}: sacrifice ${X} artifacts`);
        fods.forEach(f => jvSacrifice(P, f));
        const ok = P.gy.filter(c => jvCreatureCard(c) && (Number(c.card.power) || 0) <= X);
        const pick = await pickOwn(P, ok, `${src.card.name}: return a creature card with power ${X} or less`, { optional: false });
        if (pick) putOntoBattlefield(P, pick);
    },
    // Tom, Bert, and William: draw cards equal to the sacrificed creature's power, then discard a card
    async tbwDraw(P, e, t, src) {
        const n = G.lastSacPow || 0;
        if (n > 0) drawCards(P, n);
        if (P.hand.length) { const d = await chooseDiscard(P, src.card.name); if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`); } }
    },
    // Tom, Bert, and William die as a creature: they return as an artifact that isn't a creature
    tbwReturn(P, e, t, src) {
        const X = G.players[src.owner];
        if (!X.gy.includes(src)) return;
        pull(X.gy, src); resetObj(src); src.artOnly = true; src.enteredTurn = G.turn; X.bf.push(src);
        log(`${src.card.name} return to the battlefield as an artifact (not a creature).`);
        fire('enters', { o: src });
    },
    // Garruk, Veiled Butcher
    garrukMinus(P, e, t, src) { const x = t && t.o && onBf(t.o.uid); if (!x) return; x.pt2 = { p: -4, q: -1, until: nextTurnOf(P) }; log(`${x.card.name} gets -4/-1 until ${you(P) ? 'your' : `${P.name}'s`} next turn.`); },
    async garrukSac(P, e, t, src) {
        await applyEffect(P, { t: 'edict', who: 'each player', what: 'creature' }, null, src);
        if (G.edictDid && G.edictDid[P.i]) await applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'green Beast', kw: ['trample'] }, null, src);
    },
    async garrukDiscard(P, e, t, src) {
        let missed = 0;
        for (const F of foes(P)) {
            let nonland = 0;
            for (let k = 0; k < 2 && F.hand.length; k++) {
                const d = await chooseDiscard(F, src.card.name);
                if (!d) break;
                pull(F.hand, d); F.gy.push(d); d.discardTurn = G.turn; log(`${F.name} ${you(F) ? 'discard' : 'discards'} ${d.card.name}.`);
                if (Rx(d).kind !== 'land') nonland++;
            }
            if (nonland < 2) missed++;
        }
        if (missed) drawCards(P, missed);
    },
    // Strength of Will: indestructible, and damage dealt to it becomes +1/+1 counters (checked in damage())
    strengthOfWill(P, e, t, src) { const x = t && t.o && onBf(t.o.uid); if (!x) return; x.tkw.push('indestructible'); x.willTurn = G.turn; log(`${x.card.name} gains indestructible and grows when dealt damage until end of turn.`); },
    // Galuf's Final Act: +1/+0, and when it dies this turn, +1/+1 counters equal to its power on up to one target creature (checked in dieOrLeave)
    galufsAct(P, e, t, src) { const x = t && t.o && onBf(t.o.uid); if (!x) return; x.tp += 1; x.galufTurn = G.turn; log(`${x.card.name} gets +1/+0 until end of turn.`); },
    async galufCounters(P, e, t, src) { const x = t && t.o && onBf(t.o.uid); if (!x || !e.amount) return; putCounters(x, e.amount, P); log(`${x.card.name} gets ${e.amount} +1/+1 counters.`); },
    // Troop of Ponies: up to two basic lands, one onto the battlefield tapped and the other into your hand
    async troopPonies(P, e, t, src) {
        const basics = P.library.filter(x => /\bBasic\b/.test(x.card.type));
        const picks = [];
        for (let k = 0; k < 2; k++) {
            const left = basics.filter(x => !picks.includes(x));
            if (!left.length) break;
            const pick = (P.isAI || AUTOPLAY) ? left[0] : await pickCard(P, left, `${src.card.name}: search for a basic land (${k + 1} of up to 2)`, {});
            if (!pick) break;
            picks.push(pick);
        }
        log(`${P.name} ${you(P) ? 'search' : 'searches'} ${you(P) ? 'your' : 'their'} library for up to two basic lands.`);
        if (picks[0]) putOntoBattlefield(P, picks[0], true);
        if (picks[1]) { pull(P.library, picks[1]); P.hand.push(picks[1]); }
        shuffleLib(P);
    },
    // Archfiend of Ifnir: a -1/-1 counter on each creature your opponents control
    archfiendCounters(P, e, t, src) {
        for (const F of foes(P)) for (const x of F.bf.filter(isCreature)) x.counters -= 1;
        log(`Each creature ${you(P) ? 'your opponents control' : "the other players control"} gets a -1/-1 counter (${src.card.name}).`);
    },
    // The Warring Triad: mill a card, add one mana of any color
    async triadMana(P, e, t, src) {
        doMill(P, 1);
        const colors = ['W', 'U', 'B', 'R', 'G'];
        const c = (P.isAI || AUTOPLAY) ? (colors.find(k => P.hand.some(h => (Rx(h).cost[k] || 0) > 0)) || 'B') : await pickWord(P, `${src.card.name}: add one mana of any color`, colors);
        P.pool = P.pool || []; P.pool.push(c); log(`${P.name} ${you(P) ? 'add' : 'adds'} {${c}} (${src.card.name}).`);
    }
});
function permValueCard(c) { return (Number(c.card.power) || 0) + (c.card.cmc || 0) * 0.5; }

// ---- Batch C: Mutants, counters, prepared creatures, Sephiroth ----
Object.assign(ART_TOKENS, { mutagen: { name: 'Mutagen', text: '{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery.' } });
TRIG_FN.myTurnCombat = (o, ctx) => G.active === o.owner;
TRIG_FN.mutantDiesMyTurn = (o, ctx) => { const x = ctx.o; if (!x || x.owner !== o.owner || G.active !== o.owner || !hasType(x, 'Mutant')) return false; x.diedPow = Math.max(0, pow(x)); return true; };
TRIG_FN.mutantAttacks = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Mutant'));
TRIG_FN.raidMain2 = (o, ctx) => G.active === o.owner && G.players[o.owner].attackedTurn === G.turn;
TRIG_FN.incrementCast = (o, ctx) => !!ctx.o && ctx.P.i === o.owner && (ctx.o.manaSpent || 0) > Math.min(pow(o), tou(o));
TRIG_FN.twoDied = (o, ctx) => !!G.diedN && G.diedN.turn === G.turn && G.diedN.n >= 2;
TRIG_FN.otherCreatureDies = (o, ctx) => !!ctx.o && ctx.o !== o;
// "becomes a Mutant in addition to its other types": a generic added type
// The second main phase starts once a turn
function fireMain2() { if (!G || G.main2Turn === G.turn) return; G.main2Turn = G.turn; fire('main2'); }
// Counters on a creature, whatever kind (Warden of the Grove)
const jvCounters = o => Math.max(0, o.counters || 0) + Object.values(o.ctr || {}).reduce((a, v) => a + Math.max(0, v), 0);
function weakestFoe(P) { return foes(P).slice().sort((a, b) => a.life - b.life)[0] || null; }
// "Target opponent": a person chooses when there is more than one (the computer takes the weakest)
async function chooseFoeTarget(P, title) {
    const fs = foes(P).filter(x => !x.out);
    if (fs.length <= 1 || P.isAI || AUTOPLAY) return weakestFoe(P);
    const w = await pickWord(P, title, fs.map(f => f.name));
    return fs.find(f => f.name === w) || weakestFoe(P);
}

Object.assign(CMD_SCORE, { jenovaCombat: () => 0, jenovaDraw: () => 0, x23: () => 0, doubleMutants: () => 0, michelangeloRaid: () => 3, sphereCounter: () => 0, endureEntered: () => 0, sephirothDies: () => 0 });
Object.assign(CMD, {
    // Jenova: +1/+1 counters equal to Jenova's power on up to one other creature, which becomes a Mutant
    async jenovaCombat(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const n = Math.max(0, pow(src));
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        if (!pool.length) return;
        const pick = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put ${n} +1/+1 counters on up to one other creature (it becomes a Mutant)`, {});
        if (!pick) return;
        if (n > 0) putCounters(pick, n, P);
        pick.addedTypes = pick.addedTypes || []; if (!pick.addedTypes.includes('Mutant')) pick.addedTypes.push('Mutant');
        log(`${pick.card.name} gets ${n} +1/+1 counters and becomes a Mutant (${src.card.name}).`);
    },
    // Whenever a Mutant you control dies during your turn, draw cards equal to its power
    jenovaDraw(P, e, t, src) { const x = G.ctxObj; const n = x ? (x.diedPow || 0) : 0; if (n > 0) { log(`${src.card.name}: ${x.card.name} was a Mutant that died on ${you(P) ? 'your' : 'their'} turn.`); drawCards(P, n); } },
    // X-23: +1/+1 counters on the Mutant that entered and on X-23
    x23(P, e, t, src) { const x = G.ctxObj; if (x && onBf(x.uid)) putCounters(x, 1, P); if (onBf(src.uid)) putCounters(src, 1, P); log(`${src.card.name} puts a +1/+1 counter on ${x ? x.card.name : 'the Mutant'} and on itself.`); },
    // Whenever a Mutant you control attacks, double its power until end of turn
    doubleMutants(P, e, t, src) {
        const list = (G.ctxRaw && G.ctxRaw.list) || G.attackers.map(onBf).filter(Boolean);
        for (const x of list) { if (!x || x.owner !== P.i || !onBf(x.uid) || !hasType(x, 'Mutant')) continue; const n = pow(x); if (n > 0) { x.tp += n; log(`${x.card.name}'s power is doubled until end of turn (+${n}).`); } }
    },
    // Michelangelo, the Heart: a +1/+1 counter on target creature and a Food token
    async michelangeloRaid(P, e, t, src) {
        if (t && t.o && onBf(t.o.uid)) putCounters(t.o, 1, P);
        await applyEffect(P, { t: 'artToken', kind: 'food', n: 1 }, null, src);
    },
    // Sphere Grid: a +1/+1 counter on the creature that dealt combat damage to a player
    sphereCounter(P, e, t, src) { const x = G.ctxRaw && G.ctxRaw.src; if (x && onBf(x.uid)) { putCounters(x, 1, P); log(`${x.card.name} gets a +1/+1 counter (${src.card.name}).`); } },
    // Warden of the Grove: the creature that entered endures X (X counters on it, or an X/X white Spirit)
    async endureEntered(P, e, t, src) {
        const x = G.ctxObj, X = jvCounters(src);
        if (!x || !onBf(x.uid) || X <= 0) return;
        const asCounters = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: ${x.card.name} endures ${X}: put ${X} +1/+1 counters on it? (Cancel = create a ${X}/${X} white Spirit instead)`, { card: x.card, yes: 'Counters', no: 'Spirit token' });
        if (asCounters) { putCounters(x, X, P); log(`${x.card.name} endures ${X} (${X} +1/+1 counters).`); }
        else await applyEffect(P, { t: 'token', n: 1, p: X, q: X, name: 'white Spirit', kw: [] }, null, src);
    },
    // Sephiroth, Fabled SOLDIER: drain 1; the fourth time this turn he transforms (Super Nova: an emblem with the same drain)
    async sephirothDies(P, e, t, src) {
        const O = await chooseFoeTarget(P, `${src.card.name}: choose a target opponent (they lose 1 life, you gain 1)`);
        if (O && !O.out) { O.life -= 1; log(`${O.name} ${you(O) ? 'lose' : 'loses'} 1 life.`); gainLifeFor(P, 1); }
        G.sephN = G.sephN && G.sephN.turn === G.turn && G.sephN.uid === src.uid ? { turn: G.turn, uid: src.uid, n: G.sephN.n + 1 } : { turn: G.turn, uid: src.uid, n: 1 };
        if (G.sephN.n === 4 && onBf(src.uid) && src.front && src.front.back && src.card === src.front) {
            (P.emblems = P.emblems || []).push('superNova'); log(`${P.name} ${you(P) ? 'get' : 'gets'} an emblem: whenever a creature dies, target opponent loses 1 life and you gain 1 life (Super Nova).`);
            await applyEffect(P, { t: 'transform' }, null, src);
        }
    },
    async superNovaDrain(P) { const O = await chooseFoeTarget(P, 'Super Nova: choose a target opponent (they lose 1 life, you gain 1)'); if (O && !O.out) { O.life -= 1; log(`${O.name} ${you(O) ? 'lose' : 'loses'} 1 life (Super Nova).`); gainLifeFor(P, 1); } }
});
// Super Nova emblems: each one drains whenever any creature dies
function superNovaWatch(ctx) {
    G.players.forEach(X => { if (X.out) return; (X.emblems || []).filter(k => k === 'superNova').forEach(() => (G.trigQ = G.trigQ || []).push({ P: X, o: { card: { name: 'Super Nova emblem' }, uid: -1 }, effects: [{ t: 'cmd', id: 'superNovaDrain' }] })); });
}

Object.assign(CMD_SCORE, { sephirothAttack: () => 0 });
Object.assign(CMD, {
    // Sephiroth, One-Winged Angel: sacrifice any number of other creatures, draw that many cards
    async sephirothAttack(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        if (!pool.length) return;
        const chosen = (P.isAI || AUTOPLAY) ? pool.filter(x => x.token || permValue(x) <= 1.5) : await jvPickSeveral(P, pool, `${src.card.name}: sacrifice other creatures to draw cards`, pool.length);
        for (const x of chosen) if (onBf(x.uid)) jvSacrifice(P, x);
        if (chosen.length) drawCards(P, chosen.length);
    }
});

// Wolverine, Claws Out: "you may have ~ assign his combat damage as though he weren't blocked". Combat damage is worked out without asking,
// so the choice is made by a rule: go to the player when it is lethal or when it can't kill the blockers anyway; otherwise kill the blockers.
function assignAsUnblocked(atk, blks, dmg, D) {
    if (atk.faceChoice && atk.faceChoice.turn === G.turn) return atk.faceChoice.v; // a person was asked when it became blocked
    if (D && D.life !== undefined && D.life <= dmg) return true;
    const need = blks.reduce((a, b) => a + Math.max(1, tou(b) - b.dmg), 0);
    return dmg < need || blks.every(b => creatureValue(b) < 2);
}

Object.assign(CMD_SCORE, { wolverineAsk: () => 0 });
Object.assign(CMD, {
    // Wolverine: a person chooses, when he becomes blocked, whether to assign his combat damage as though he weren't blocked
    async wolverineAsk(P, e, t, src) {
        if (P.isAI || AUTOPLAY || !onBf(src.uid)) return;
        const v = await askYes(P, `${src.card.name} is blocked: assign his combat damage as though he weren't blocked (to the player)?`, { card: src.card, yes: 'To the player', no: 'To the blockers' });
        src.faceChoice = { turn: G.turn, v: !!v };
    }
});
