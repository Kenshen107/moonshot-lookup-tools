// Engine pieces for the Gishath, Sun's Avatar deck (2026-10-15, owner's request). Wordings: rules/gishath.js.
// Dinosaurs, "players can't gain life", Miracle, Harmonize, Roaming Throne's doubling and a handful of one-off cards.
const KW_COUNTERS = new Set(['trample', 'flying', 'first strike', 'double strike', 'deathtouch', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'vigilance']); // keyword counters (Titanoth Rex)
// "Players can't gain life" (Giant Cindermaw, Rampaging Ferocidon)
function noLifeGainActive() { return !!G && !!G.players && allPerms().some(a => Rx(a).noLifeGain && !lostAbilities(a)); }
// Roaming Throne: a triggered ability of another creature of the chosen type triggers an additional time (one extra per Throne)
function throneBoost(o) {
    if (!G || !o || !o.card || !isCreature(o)) return 0;
    return allPerms().filter(a => a !== o && a.owner === o.owner && Rx(a).throne && !lostAbilities(a) && a.chosenType && hasType(o, a.chosenType)).length;
}
// Harmonize (Nature's Rhythm): tap a creature you control to pay generic mana equal to its power
function harmonizeCreature(P) { return P.bf.filter(c => isCreature(c) && !c.tapped && pow(c) > 0).sort((a, b) => pow(b) - pow(a))[0] || null; }
function harmonizeCut(P) { const c = harmonizeCreature(P); return c ? pow(c) : 0; }
// Miracle (702.94): the first card you draw each turn may be cast for its miracle cost
async function runMiracle(P, o) {
    if (!G || G.over || !P.hand.includes(o) || o.miracleTurn !== G.turn) return;
    o.castAs = 'miracle'; const can = canPay(P, o); o.castAs = null;
    if (!can) return;
    let yes;
    if (P.isAI || AUTOPLAY) yes = scoreEffects(P, spellEffects(o), null, o) > 2;
    else yes = await askYes(P, `You drew ${o.card.name} as your first card this turn. Cast it for its miracle cost?`, { card: o.card, yes: 'Cast it (miracle)', no: 'Keep it' });
    if (!yes) return;
    log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${o.card.name} and ${you(P) ? 'cast' : 'casts'} it for its miracle cost.`);
    const te = firstTargetEffect(o); let target;
    if (te) {
        const valid = validTargets(P, te, o); if (!valid.length) return;
        if (P.isAI || AUTOPLAY) target = aiPickTarget(P, te, o, valid); else { const saved = G.mode; target = await chooseTarget(P, te, o, true); G.mode = saved; }
        if (!target) return;
    }
    o.castAs = 'miracle';
    const done = await castSpell(P, o, target);
    if (!done) o.castAs = null;
}
function dinoLibrary(P) { return P.library.filter(c => Rx(c).kind === 'creature' && hasType(c, 'Dinosaur')); }
function shuffleLib(P) { P.library = shuffle(P.library); }
Object.assign(CMD_SCORE, {
    terminus: P => { const d = foes(P).reduce((a, F) => a + F.bf.filter(isCreature).reduce((s, x) => s + permValue(x), 0), 0) - P.bf.filter(isCreature).reduce((s, x) => s + permValue(x), 0); return d > 6 ? d : 0; },
    dontMove: P => { const theirs = foes(P).reduce((a, F) => a + F.bf.filter(c => isCreature(c) && c.tapped).reduce((s, x) => s + permValue(x), 0), 0); const mine = P.bf.filter(c => isCreature(c) && c.tapped).reduce((s, x) => s + permValue(x), 0); return theirs - mine > 4 ? theirs - mine : 0; },
    wakeningSun: P => { const d = foes(P).reduce((a, F) => a + F.bf.filter(c => isCreature(c) && !hasType(c, 'Dinosaur')).reduce((s, x) => s + permValue(x), 0), 0) - P.bf.filter(c => isCreature(c) && !hasType(c, 'Dinosaur')).reduce((s, x) => s + permValue(x), 0); return 2 + (d > 0 ? d : 0); },
    eldritchEvo: P => (P.library.some(c => Rx(c).kind === 'creature' && (c.card.cmc || 0) >= 4) && P.bf.some(isCreature) ? 5 : 0),
    savageOrder: P => (dinoLibrary(P).length && P.bf.some(c => isCreature(c) && pow(c) >= 4) ? 7 : 0),
    feat: () => 3,
    burningSun: () => 6,
    mavrenDino: (P, e, t, src) => Math.max(0, ...G.attackers.map(onBf).filter(c => c && c !== src && c.owner === P.i).map(pow)),
    mavrenVamp: (P, e, t, src) => G.attackers.map(onBf).filter(c => c && c !== src && c.owner === P.i).length * 0.8,
    doublePower: () => 3
});
Object.assign(CMD, {
    // Gishath: reveal that many cards, put any number of Dinosaur creature cards from among them onto the battlefield, the rest on the bottom in a random order
    async gishath(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0;
        const top = P.library.splice(-Math.min(n, P.library.length)).reverse();
        if (!top.length) return;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.map(c => c.card.name).join(', ')}.`);
        const dinos = top.filter(c => Rx(c).kind === 'creature' && hasType(c, 'Dinosaur'));
        let chosen = dinos.slice();
        if (!(P.isAI || AUTOPLAY)) {
            chosen = []; const pool = dinos.slice();
            while (pool.length) { const pick = await pickOwn(P, pool, `${src.card.name}: put a Dinosaur onto the battlefield`, { optional: true }); if (!pick) break; chosen.push(pick); pull(pool, pick); }
        }
        const rest = shuffle(top.filter(c => !chosen.includes(c)));
        P.library.unshift(...rest);
        if (rest.length) log(`${rest.length} card${rest.length === 1 ? '' : 's'} go${rest.length === 1 ? 'es' : ''} on the bottom of ${you(P) ? 'your' : `${P.name}'s`} library.`);
        chosen.forEach(c => putOntoBattlefield(P, c));
    },
    // Feat of Resistance: a +1/+1 counter and protection from the color of your choice
    async feat(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        await applyEffect(P, { t: 'counters', n: 1 }, t, src);
        await applyEffect(P, { t: 'protChoice' }, t, src);
    },
    // Scytheclaw Raptor
    scytheclaw(P, e, t, src) { const C = G.ctxRaw && G.ctxRaw.P; if (C && onBf(src.uid)) damage(C, 4, src); },
    // Burning Sun's Avatar: 3 to target opponent and 3 to up to one target creature
    async burningSun(P, e, t, src) {
        const F = foes(P).sort((a, b) => a.life - b.life)[0];
        if (F) damage(F, 3, src);
        const pool = allPerms().filter(c => isCreature(c) && !has(c, 'shroud') && !(has(c, 'hexproof') && c.owner !== P.i) && !protFrom(c, src));
        let pick;
        if (P.isAI || AUTOPLAY) pick = pool.filter(c => c.owner !== P.i).sort((a, b) => permValue(b) - permValue(a)).find(c => tou(c) - c.dmg <= 3) || pool.filter(c => c.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0];
        else pick = await pickOwn(P, pool, `${src.card.name}: 3 damage to up to one target creature`, { optional: true, rank: (a, b) => permValue(b) - permValue(a) });
        if (pick) damage(pick, 3, src);
    },
    // Terminus: all creatures go to the bottom of their owners' libraries
    terminus(P, e, t, src) {
        const hit = allPerms().filter(isCreature);
        log(`${src.card.name}: ${hit.length} creature${hit.length === 1 ? '' : 's'} go${hit.length === 1 ? 'es' : ''} to the bottom of their owners' libraries.`);
        hit.forEach(c => {
            const X = G.players[c.owner];
            leaveBattlefield(c, 'library');
            const i = X.library.lastIndexOf(c);
            if (i >= 0) { X.library.splice(i, 1); X.library.unshift(c); }
        });
    },
    // Wakening Sun's Avatar: destroy all non-Dinosaur creatures
    wakeningSun(P, e, t, src) {
        const hit = allPerms().filter(c => isCreature(c) && !hasType(c, 'Dinosaur'));
        log(`${src.card.name}: destroy all non-Dinosaur creatures (${hit.length}).`);
        hit.forEach(c => destroy(c));
    },
    // Zacama, Primal Calamity: untap all lands you control
    untapLands(P, e, t, src) { const l = P.bf.filter(x => /\bLand\b/.test(x.card.type) && x.tapped); l.forEach(x => { x.tapped = false; }); log(`${P.name} ${you(P) ? 'untap' : 'untaps'} ${l.length} land${l.length === 1 ? '' : 's'}.`); },
    // Marauding Raptor
    maraudRaptor(P, e, t, src) {
        const it = G.ctxObj;
        if (!it || !onBf(it.uid) || !onBf(src.uid) || !isCreature(it)) return;
        const before = it.dmg;
        damage(it, 2, src);
        if (it.dmg > before && hasType(it, 'Dinosaur')) { src.tp += 2; log(`${src.card.name} gets +2/+0 until end of turn.`); }
    },
    // Ghalta and Mavren: whenever you attack, choose one
    async mavrenDino(P, e, t, src) {
        const others = G.attackers.map(onBf).filter(c => c && c !== src && c.owner === P.i);
        const x = Math.max(0, ...others.map(pow));
        const before = P.bf.length;
        await applyEffect(P, { t: 'token', n: 1, p: x, q: x, name: 'green Dinosaur', kw: ['trample'] }, null, src);
        P.bf.slice(before).forEach(tk => { tk.tapped = true; if (!G.attackers.includes(tk.uid)) G.attackers.push(tk.uid); });
        log(`A tapped and attacking ${x}/${x} Dinosaur token joins the attack.`);
    },
    async mavrenVamp(P, e, t, src) {
        const x = G.attackers.map(onBf).filter(c => c && c !== src && c.owner === P.i).length;
        if (x > 0) await applyEffect(P, { t: 'token', n: x, p: 1, q: 1, name: 'white Vampire', kw: ['lifelink'] }, null, src);
    },
    // Eldritch Evolution: search for a creature with mana value 2 more than the sacrificed creature's
    async eldritchEvo(P, e, t, src) {
        const mv = 2 + (G.lastSacMv || 0);
        const pool = P.library.filter(c => Rx(c).kind === 'creature' && (c.card.cmc || 0) <= mv);
        const pick = await pickOwn(P, pool, `${src.card.name}: search for a creature card with mana value ${mv} or less`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        log(`${P.name} ${you(P) ? 'search' : 'searches'} ${you(P) ? 'your' : 'their'} library for a creature card (mana value ${mv} or less).`);
        if (pick) putOntoBattlefield(P, pick);
        shuffleLib(P);
    },
    // Savage Order: put a Dinosaur onto the battlefield; it gains indestructible until your next turn
    async savageOrder(P, e, t, src) {
        const pool = dinoLibrary(P);
        const pick = await pickOwn(P, pool, `${src.card.name}: search for a Dinosaur creature card`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        log(`${P.name} ${you(P) ? 'search' : 'searches'} ${you(P) ? 'your' : 'their'} library for a Dinosaur creature card.`);
        if (pick) { putOntoBattlefield(P, pick); pick.indUntil = G.turn + G.players.length - 1; log(`${pick.card.name} gains indestructible until ${you(P) ? 'your' : `${P.name}'s`} next turn.`); }
        shuffleLib(P);
    },
    // Don't Move: destroy all tapped creatures; until your next turn, a creature that becomes tapped is destroyed
    dontMove(P, e, t, src) {
        const hit = allPerms().filter(c => isCreature(c) && c.tapped);
        log(`${src.card.name}: destroy all tapped creatures (${hit.length}).`);
        hit.forEach(c => destroy(c));
        G.dontMove = { by: P.i, turn: G.turn };
    },
    // The Skullspore Nexus: one token for all the nontoken creatures that died together
    async nexusToken(P, e, t, src) {
        const p = src.nexusPend; src.nexusPend = null;
        const total = Math.max(0, p ? p.total : 0);
        await applyEffect(P, { t: 'token', n: 1, p: total, q: total, name: 'green Fungus Dinosaur', kw: [] }, null, src);
    },
    doublePower(P, e, t, src) { if (!t || !t.o || !onBf(t.o.uid)) return; const n = pow(t.o); if (n > 0) { t.o.tp += n; log(`${t.o.card.name}'s power is doubled until end of turn (+${n}).`); } },
    // Titanoth Rex: a trample counter
    trampleCounter(P, e, t, src) { if (!t || !t.o || !onBf(t.o.uid)) return; t.o.ctr.trample = (t.o.ctr.trample || 0) + 1; log(`${t.o.card.name} gets a trample counter.`); },
    // Bonehoard Dracosaur: exile the top two cards, play them this turn; a land makes a 3/1 Dinosaur, a nonland card a Treasure
    async bonehoard(P, e, t, src) {
        let land = false, nonland = false;
        for (let k = 0; k < 2; k++) {
            const x = P.library.pop(); if (!x) break;
            P.exile.push(x); x.playUntil = G.turn; x.playAny = true;
            if (/\bLand\b/.test(x.card.type)) land = true; else nonland = true;
            log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${x.card.name} from the top of ${you(P) ? 'your' : 'their'} library; ${you(P) ? 'you' : 'they'} may play it this turn.`);
        }
        exiledOwn(P);
        if (land) await applyEffect(P, { t: 'token', n: 1, p: 3, q: 1, name: 'red Dinosaur', kw: [] }, null, src);
        if (nonland) await applyEffect(P, { t: 'artToken', n: 1, kind: 'treasure' }, null, src);
    },
    // Pantlaza: discover X, where X is the entering creature's toughness
    async pantlaza(P, e, t, src) {
        const c = G.ctxObj; if (!c) return;
        const x = Math.max(0, tou(c));
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: discover ${x}?`, { card: src.card }))) return;
        await cascade(P, src, x);
    },
    // Etali, Primal Conqueror: each player exiles until a nonland card; cast any number of them free
    async etaliConq(P, e, t, src) {
        const hits = [];
        for (const X of G.players.filter(y => !y.out)) {
            const got = []; let hit = null;
            while (X.library.length) { const c = X.library.pop(); X.exile.push(c); got.push(c); if (nonlandCard(c.card)) { hit = c; break; } }
            if (got.length) log(`${X.name} ${you(X) ? 'exile' : 'exiles'} ${got.map(c => c.card.name).join(', ')}.`);
            if (hit) hits.push(hit);
        }
        let pool = hits.slice();
        for (;;) {
            pool = pool.filter(c => G.players.some(X => X.exile.includes(c)) && Rx(c).support !== 'none' && Rx(c).kind !== 'land');
            if (!pool.length) break;
            const pick = await pickOwn(P, pool, `${src.card.name}: cast a spell without paying its mana cost`, { optional: true });
            if (!pick) break;
            pull(pool, pick);
            const holder = G.players.find(X => X.exile.includes(pick)); if (holder && holder !== P) { pull(holder.exile, pick); P.exile.push(pick); }
            await castFreeFrom(P, pick);
        }
    },
    // Ghalta, Stampede Tyrant: put any number of creature cards from your hand onto the battlefield
    async ghaltaPut(P, e, t, src) {
        let pool = P.hand.filter(c => Rx(c).kind === 'creature');
        if (P.isAI || AUTOPLAY) { pool.forEach(c => putOntoBattlefield(P, c)); return; }
        while (pool.length) {
            const pick = await pickOwn(P, pool, `${src.card.name}: put a creature card from your hand onto the battlefield`, { optional: true });
            if (!pick) break;
            pull(pool, pick); putOntoBattlefield(P, pick);
        }
    }
});
// The Skullspore Nexus: collect the power of every nontoken creature of yours that dies in the same batch
TRIG_FN.nexusDies = (o, ctx) => {
    const x = ctx.o;
    if (!x || x.owner !== o.owner || x.token || !isCreature(x)) return false;
    const p = o.nexusPend;
    if (p && p.turn === G.turn) { p.total += pow(x); return false; }
    o.nexusPend = { turn: G.turn, total: pow(x) };
    return true;
};
TRIG_FN.youAttack = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner);
