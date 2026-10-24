// Engine pieces for the Star Trek cards (TRK, TRC, SDS), 2026-10-24, owner's request: make the current Star Trek cards playable.
// Wordings: rules/trek.js. Like the other rounds, choices inside a resolving spell are made as it resolves (a person gets pick screens, the computer takes the best).

// ---- Counts and conditions ----
const tkLands = P => P.bf.filter(x => /\bLand\b/.test(x.card.type));
// "differently named lands you control" (Strange new worlds and friends)
const tkNamedLands = P => new Set(tkLands(P).map(x => x.card.name)).size;
// "creature types among non-Borg creatures you control" (Federation)
function tkFedTypes(P) {
    const s = new Set();
    P.bf.filter(x => isCreature(x) && !hasType(x, 'Borg')).forEach(x => {
        const m = (x.card.type || '').match(/—\s*(.+)$/);
        (m ? m[1].split(/\s+/) : []).concat(x.addedTypes || []).filter(Boolean).forEach(w => s.add(w));
        if (Rx(x).kw && Rx(x).kw.has && Rx(x).kw.has('changeling')) s.add('*');
    });
    return s.size;
}
COUNT_EXTRA.push(
    [/^(?:the number of )?differently named lands you control$/, () => o => tkNamedLands(G.players[o.owner])],
    [/^(?:the number of )?creature types among non-Borg creatures you control$/, () => o => tkFedTypes(G.players[o.owner])],
    [/^(?:the number of )?artifact creatures you control$/, () => o => G.players[o.owner].bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)).length],
    [/^(?:the number of )?dilemmas you've faced this turn$/, () => o => { const P = G.players[o.owner]; return P.dilemmaTurn === G.turn ? (P.dilemmaN || 0) : 0; }],
    [/^(?:the number of )?Officers you control$/, () => o => G.players[o.owner].bf.filter(x => hasType(x, 'Officer')).length],
    [/^(?:the number of )?charge counters on ~$/, () => o => (o.ctr && o.ctr.charge) || 0]
);
COND_EXTRA.push(
    [/^it has (\d+) or more charge counters on it$/, m => (P, o) => ((o.ctr && o.ctr.charge) || 0) >= Number(m[1])],
    [/^you control an untapped creature other than ~$/, () => (P, o) => P.bf.some(x => x !== o && isCreature(x) && !x.tapped)],
    [/^you control a permanent with a counter on it$/, () => P => P.bf.some(x => x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0))],
    [/^~ isn't a creature$/, () => (P, o) => !isCreature(o)],
    [/^you control six or more differently named lands$/, () => P => tkNamedLands(P) >= 6]
);

// ---- Counters of every kind (charge, quest, promotion...): the "put twice that many" and "plus one" replacements ----
// Dr. Joseph M'Benga (twice, on creatures you control), Lt. Cmdr. Geordi La Forge (charge counters on artifacts), Brad Boimler (one more of each kind until end of turn)
function tkCounterMult(o, kind, n) {
    if (!G || !o || n <= 0) return n;
    const X = G.players[o.owner];
    let k = n;
    if (X.bf.some(a => Rx(a).geordi && !lostAbilities(a)) && kind === 'charge' && /\bArtifact\b/.test(o.card.type)) k *= 2;
    if (isCreature(o) && X.bf.some(a => Rx(a).mbenga && !lostAbilities(a))) k *= 2;
    if (X.boimlerTurn === G.turn) k += 1;
    return k;
}
function tkCounters(o, kind, n) {
    if (!o || !onBf(o.uid) || n <= 0) return 0;
    n = tkCounterMult(o, kind, n);
    o.ctr[kind] = (o.ctr[kind] || 0) + n;
    log(`${o.card.name} gets ${n} ${kind} counter${n === 1 ? '' : 's'}.`);
    if (kind === 'charge') fire('chargePut', { o, n });
    return n;
}
TRIG_FN.selfCharge = (o, ctx) => ctx.o === o;

// ---- Station (Spacecraft) ----
// Tap another creature you control: put charge counters equal to its power on this Spacecraft. Only as a sorcery. At the top threshold it is an artifact creature.
const stationCreature = o => { const R = Rx(o); return !!R.stationAt && !!o.ctr && (o.ctr.charge || 0) >= R.stationAt; };
const tkIsShip = o => hasType(o, 'Spacecraft');
// Tapping a creature as a cost (Station, and cards that tap creatures)
async function tkTapCreature(P, src, title, pool) {
    const list = (pool || P.bf.filter(x => x !== src && isCreature(x) && !x.tapped));
    if (!list.length) return null;
    const pick = (P.isAI || AUTOPLAY) ? list.slice().sort((a, b) => (creatureValue(a) - creatureValue(b)) || (pow(a) - pow(b)))[0] : await pickCard(P, list, title, { required: true });
    const x = pick || list[0];
    x.tapped = true; fire('tapped', { o: x });
    return x;
}
const CMD_TK = {
    // Station: the computer taps the creature that adds the most counters it needs (the most powerful one that doesn't overshoot, else the biggest)
    async tkStation(P, e, t, src) {
        const need = Math.max(1, ...[0].concat((Rx(src).stationTiers || []).filter(k => k > (src.ctr.charge || 0)).slice(0, 1))) - (src.ctr.charge || 0);
        const pool = P.bf.filter(x => x !== src && isCreature(x) && !x.tapped);
        if (!pool.length) return;
        let x;
        if (P.isAI || AUTOPLAY) {
            x = pool.slice().sort((a, b) => { const fa = pow(a) >= need ? 0 : 1, fb = pow(b) >= need ? 0 : 1; return (fa - fb) || (fa ? pow(b) - pow(a) : (creatureValue(a) - creatureValue(b))); })[0];
        } else x = await pickCard(P, pool, `${src.card.name}: tap another creature to station (adds charge counters equal to its power)`, { required: true }) || pool[0];
        x.tapped = true; fire('tapped', { o: x });
        log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${x.card.name} to station ${src.card.name}.`);
        tkCounters(src, 'charge', Math.max(0, pow(x)));
    }
};
Object.assign(CMD, CMD_TK);
Object.assign(CMD_SCORE, { tkStation: (P, e, t, src) => (P.bf.some(x => x !== src && isCreature(x) && !x.tapped && pow(x) > 0) ? ((src.ctr.charge || 0) < Math.max(0, ...(Rx(src).stationTiers || [0])) ? 6 : 0) : 0) });

// ---- Dilemmas: a player faces a dilemma whenever they choose one or more modes for a spell or ability ----
(function () {
    const orig = pickModes;
    pickModes = function (P, R, modes, src) {
        return orig(P, R, modes, src).then(i => { if (i !== null && i !== undefined) tkDilemma(P, src); return i; });
    };
})();
function tkDilemma(P, src) {
    if (!G || !P) return;
    if (P.dilemmaTurn !== G.turn) { P.dilemmaTurn = G.turn; P.dilemmaN = 0; }
    P.dilemmaN++;
    fire('dilemma', { P, o: src && src.card ? src : null });
}
TRIG_FN.myDilemma = (o, ctx) => ctx.P && ctx.P.i === o.owner;

Object.assign(CMD, {
    tkCharge(P, e, t, src) { tkCounters(src, 'charge', e.n); },
    // Warp Core: two charge counters on target Spacecraft (a person picks; the computer helps its own ship closest to a threshold)
    async tkChargeTarget(P, e, t, src) {
        const ships = allPerms().filter(tkIsShip);
        if (!ships.length) { log(`${src.card.name}: there is no Spacecraft to charge.`); return; }
        const mine = ships.filter(x => x.owner === P.i);
        let x;
        if (P.isAI || AUTOPLAY) x = (mine.length ? mine : ships).slice().sort((a, b) => ((stationCreature(a) ? 1 : 0) - (stationCreature(b) ? 1 : 0)) || ((b.ctr.charge || 0) - (a.ctr.charge || 0)))[0];
        else x = await pickCard(P, ships, `${src.card.name}: put charge counters on a Spacecraft`, { required: true }) || ships[0];
        tkCounters(x, 'charge', e.n);
    },
    async tkExilePlay(P, e, t, src) { await applyEffect(P, { t: 'exileTop', n: 1, play: 0 }, null, src); },
    // Return a creature card with mana value 4 or less from your graveyard to the battlefield with a finality counter (U.S.S. Reliant)
    async tkFinality(P, e, t, src) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type) && (x.card.cmc || 0) <= 4);
        const pick = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value 4 or less to the battlefield`, { optional: false });
        if (!pick) return;
        putOntoBattlefield(P, pick); pick.ctr.finality = 1;
        log(`${pick.card.name} returns with a finality counter.`);
    }
});
Object.assign(CMD_SCORE, { tkCharge: () => 3, tkChargeTarget: P => (allPerms().some(x => tkIsShip(x) && x.owner === P.i) ? 5 : 0), tkExilePlay: () => 4, tkFinality: P => (P.gy.some(x => /\bCreature\b/.test(x.card.type) && (x.card.cmc || 0) <= 4) ? 6 : 0) });


// ---- Assimilate: put a creature card onto the battlefield under your control with a +1/+1 counter; it's a Borg artifact creature and loses all other creature types ----
function tkAssimilate(P, o) {
    if (!o) return null;
    const was = G.players.find(X => ['gy', 'exile', 'library', 'hand'].some(z => X[z].includes(o)));
    const from = o.owner;
    putOntoBattlefield(P, o);
    if (from !== P.i && o.realOwner === undefined) o.realOwner = from;
    o.card = { ...o.card, type: 'Artifact Creature — Borg' };
    o.assimilated = true;
    putCounters(o, 1, P);
    log(`${P.name} ${you(P) ? 'assimilate' : 'assimilates'} ${o.card.name} (a Borg artifact creature with a +1/+1 counter).`);
    void was;
    return o;
}
// Pay an optional generic cost: the computer pays whenever it can; a person is asked
async function tkPay(P, n, why, card) {
    const plan = planPayment(P, { ...parseCost(''), generic: n });
    if (!plan) return false;
    if (!(P.isAI || AUTOPLAY) && !(await askYes(P, why, { card }))) return false;
    plan.forEach(x => tapSource(P, x));
    return true;
}
const tkCreatureCard = x => /\bCreature\b/.test(x.card.type);
const tkBest = (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) || (Number(b.card.power) || 0) - (Number(a.card.power) || 0);
const tkOfficers = async (P, n, src) => { if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'red Officer', kw: [] }, null, src); };
const tkBorgs = async (P, n, src) => { if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'colorless Borg', kw: [], artifact: true }, null, src); };

Object.assign(CMD_SCORE, { tkOfficersDilemma: () => 3, tkDiscardUnless: () => -1, tkRenoTap: () => 2, tkBorgQuest: () => 3, tkSupport: () => 3, tkExploratory: () => 3, tkAssimilateGy: P => (G.players.some(X => X.gy.some(tkCreatureCard)) ? 7 : 0), tkBorgQueen: () => 6, tkCubeAssimilate: () => 6, tkBorgHit: () => 3, tkHiveDraw: () => 2, tkArtifactMenace: () => 2, tkCrystalline: P => (foes(P).reduce((a, F) => a + F.bf.filter(x => isCreature(x) && !/\bArtifact\b/.test(x.card.type)).length, 0) > P.bf.filter(x => isCreature(x) && !/\bArtifact\b/.test(x.card.type)).length + 1 ? 8 : 1), tkGainLands: () => 2, tkOfficersLands: () => 4, tkSevenDiscard: () => 0, tkHoshi: () => 4, tkSaavik: () => 6, tkArcherPump: () => 3, tkAcademyMana: () => 2, tkNewPlanet: () => 2 });
Object.assign(CMD, {
    async tkOfficersDilemma(P, e, t, src) { const n = P.dilemmaTurn === G.turn ? (P.dilemmaN || 0) : 0; if (n) await tkOfficers(P, n, src); },
    async tkDiscardUnless(P, e, t, src) { if (((src.ctr && src.ctr[e.kind]) || 0) < e.n) await applyEffect(P, { t: 'discardSelf', n: 1 }, null, src); else log(`${src.card.name} has ${e.n} or more ${e.kind} counters: no discard.`); },
    async tkRenoTap(P, e, t, src) { if (!onBf(src.uid)) return; if (pow(src) >= 4) await applyEffect(P, { t: 'draw', n: 1 }, null, src); else await applyEffect(P, { t: 'surveil', n: 1 }, null, src); },
    async tkBorgQuest(P, e, t, src) { await tkBorgs(P, (src.ctr.quest || 0) >= 6 ? 2 : 1, src); },
    async tkSupport(P, e, t, src) { const x = (G.ctxRaw && G.ctxRaw.o) || G.ctxObj; if (!x || !onBf(x.uid)) return; const n = (src.ctr.quest || 0) >= 5 ? 2 : 1; putCounters(x, n, P); log(`${x.card.name} gets ${n} +1/+1 counter${n === 1 ? '' : 's'} (${src.card.name}).`); },
    // Exploratory Mission: exile until a nonland card; you may play it this turn; with five quest counters add {R}{R}
    async tkExploratory(P, e, t, src) {
        let c = null;
        while (P.library.length) { const x = P.library.pop(); if (!/\bLand\b/.test(x.card.type)) { c = x; break; } P.exile.push(x); x.playUntil = -1; }
        if (c) { P.exile.push(c); c.playUntil = G.turn; log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${c.card.name} (playable this turn).`); }
        if ((src.ctr.quest || 0) >= 5) await applyEffect(P, { t: 'addMana', fromN: true, n: 2, color: 'R' }, null, src);
    },
    // Assimilate a creature card from a graveyard (Borg Queen, Death Is Irrelevant)
    async tkAssimilateGy(P, e, t, src) {
        const pool = G.players.filter(X => !e.theirs || X !== P).flatMap(X => X.gy.filter(tkCreatureCard));
        if (!pool.length) { log(`${src.card.name}: no creature card to assimilate.`); return; }
        const pick = (P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: assimilate a creature card`, { required: true }) || pool[0];
        tkAssimilate(P, pick);
    },
    // The Borg Queen: target opponent exiles cards from the top until a creature card; assimilate it; the rest go to the bottom in a random order
    async tkBorgQueen(P, e, t, src) {
        const F = await chooseFoeTarget(P, `${src.card.name}: choose an opponent`);
        if (!F) return;
        const rest = []; let hit = null;
        while (F.library.length) { const x = F.library.pop(); if (tkCreatureCard(x)) { hit = x; break; } rest.push(x); }
        shuffle(rest).forEach(x => F.library.unshift(x));
        if (hit) { F.exile.push(hit); tkAssimilate(P, hit); } else log(`${F.name} has no creature card to exile.`);
    },
    // Borg Cube: assimilate a creature card exiled with it; if you can't, exile up to one target creature
    async tkCubeAssimilate(P, e, t, src) {
        src.cubeCards = (src.cubeCards || []).filter(x => G.players.some(X => X.exile.includes(x)) && tkCreatureCard(x));
        if (src.cubeCards.length) {
            const pick = (P.isAI || AUTOPLAY) ? src.cubeCards.slice().sort(tkBest)[0] : await pickCard(P, src.cubeCards, `${src.card.name}: assimilate a creature card exiled with it`, { required: true }) || src.cubeCards[0];
            src.cubeCards = src.cubeCards.filter(x => x !== pick); tkAssimilate(P, pick); return;
        }
        const pool = allPerms().filter(x => isCreature(x) && x !== src);
        const mine = (P.isAI || AUTOPLAY) ? pool.filter(x => x.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: exile up to one target creature`, {});
        if (!mine) return;
        leaveBattlefield(mine, 'exile'); (src.cubeCards = src.cubeCards || []).push(mine);
        log(`${src.card.name} exiles ${mine.card.name}.`);
    },
    // Artifact creatures you control have "whenever this deals combat damage to a player, create a Borg" (Locutus, Antagonist Incorporator)
    async tkBorgHit(P, e, t, src) {
        const dealer = G.ctxRaw && G.ctxRaw.src; if (!dealer || dealer.owner !== P.i || !/\bArtifact\b/.test(dealer.card.type) || !isCreature(dealer)) return;
        if (e.pay && !(await tkPay(P, e.pay, `${dealer.card.name}: pay {${e.pay}} to create a 1/1 Borg artifact creature token?`, dealer.card))) return;
        await tkBorgs(P, 1, src);
    },
    async tkHiveDraw(P, e, t, src) {
        const dealer = G.ctxRaw && G.ctxRaw.src; if (!dealer || dealer.owner !== P.i || !/\bArtifact\b/.test(dealer.card.type) || !isCreature(dealer) || P.life < 2) return;
        if (!(P.isAI || AUTOPLAY) && !(await askYes(P, `${dealer.card.name}: pay 1 life to draw a card?`, { card: dealer.card }))) return;
        P.life -= 1; log(`${P.name} ${you(P) ? 'pay' : 'pays'} 1 life.`); drawCards(P, 1);
    },
    tkArtifactMenace(P, e, t, src) { P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)).forEach(x => { x.tkw.push('menace'); }); log('Artifact creatures gain menace until end of turn.'); },
    // Crystalline Entity: if you cast it, destroy all nonartifact creatures
    async tkCrystalline(P, e, t, src) {
        if (!src.wasCast) return;
        const dead = allPerms().filter(x => isCreature(x) && !/\bArtifact\b/.test(x.card.type));
        for (const x of dead) if (onBf(x.uid)) await applyEffect(P, { t: 'destroy', target: 'creature' }, { o: x }, src);
    },
    async tkGainLands(P, e, t, src) { const n = tkNamedLands(P); if (n > 0) await applyEffect(P, { t: 'gain', n }, null, src); },
    async tkOfficersLands(P, e, t, src) { await tkOfficers(P, tkNamedLands(P), src); },
    async tkSevenDiscard(P, e, t, src) { if (tkNamedLands(P) < 5) await applyEffect(P, { t: 'discardSelf', n: 1 }, null, src); },
    // Hoshi Sato: look at the top X cards, X = creature types among non-Borg creatures; one to hand, the rest on the bottom in a random order
    async tkHoshi(P, e, t, src) {
        const X = tkFedTypes(P); if (X <= 0) return;
        const seen = P.library.splice(-X).reverse();
        if (!seen.length) return;
        const pick = (P.isAI || AUTOPLAY) ? seen.slice().sort((a, b) => (Rx(b).kind !== 'land') - (Rx(a).kind !== 'land') || tkBest(a, b))[0] : await pickCard(P, seen, `${src.card.name}: put one into your hand (the rest go to the bottom)`, { required: true }) || seen[0];
        P.hand.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${you(P) ? pick.card.name : 'a card'} into ${you(P) ? 'your' : 'their'} hand.`);
        shuffle(seen.filter(x => x !== pick)).forEach(x => P.library.unshift(x));
    },
    // Saavik: X damage to target attacking or blocking creature an opponent controls
    async tkSaavik(P, e, t, src) {
        const X = tkFedTypes(P);
        const pool = foes(P).flatMap(F => F.bf).filter(x => isCreature(x) && ((G.attackers || []).includes(x.uid) || Object.values(G.blocks || {}).flat().includes(x.uid)));
        if (!pool.length || X <= 0) return;
        const x = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: ${X} damage to an attacking or blocking creature`, { required: true }) || pool[0];
        await applyEffect(P, { t: 'dmg', n: X, target: 'creature' }, { o: x }, src);
    },
    async tkArcherPump(P, e, t, src) { const X = tkFedTypes(P); const x = t && t.o; if (x && onBf(x.uid)) { x.tp += X; x.tq += X; log(`${x.card.name} gets +${X}/+${X} until end of turn.`); } },
    // Starfleet Academy: choose a color, add that much mana
    async tkAcademyMana(P, e, t, src) {
        const X = tkFedTypes(P); if (X <= 0) return;
        const cols = ['W', 'U', 'B', 'R', 'G'];
        const best = (typeof bestPoolColor === 'function' ? bestPoolColor(P) : null) || 'G';
        let c = cols.includes(best) ? best : 'G';
        if (!(P.isAI || AUTOPLAY)) { const w = await pickWord(P, `${src.card.name}: choose a color`, cols.map(k => COLOR_NAMES[k])); c = cols.find(k => COLOR_NAMES[k] === w) || c; }
        await applyEffect(P, { t: 'addMana', fromN: true, n: X, color: c }, null, src);
    },
    // Saurian Explorer: a tapped Planet land token named New Planet that taps for any color
    async tkNewPlanet(P, e, t, src) {
        const card = { id: `token-planet-${uidSeq}`, name: 'New Planet', fullName: 'New Planet', cost: '', cmc: 0, type: 'Land — Planet', text: '{T}: Add one mana of any color.', colors: [], ci: [], img: null, imgS: null, legal: {}, power: '', toughness: '' };
        const o = makeObj(card, P.i, { token: true }); o.tapped = true; P.bf.push(o); fire('enters', { o }); fire('landfall', { o }); tokenMade(P);
        log(`${P.name} ${you(P) ? 'create' : 'creates'} a tapped Planet land token named New Planet.`);
    }
});


// ===== Helpers for the cards below =====
const tkIsCreatureOrArt = x => isCreature(x) || /\bArtifact\b/.test(x.card.type);
// The player picks one of their own permanents or cards; the computer takes the lowest or highest value one
async function tkPickFrom(P, pool, title, opts = {}) {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort(opts.rank || ((a, b) => permValue(a) - permValue(b)))[0];
    return (await pickCard(P, pool, title, opts.optional ? {} : { required: true })) || (opts.optional ? null : pool[0]);
}
function tkSacrifice(P, f) { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); }
// Each opponent chooses something of theirs that matches and sacrifices it
async function tkEdictEach(P, match, src, label) {
    for (const F of foes(P)) {
        const pool = F.bf.filter(match).sort((a, b) => permValue(a) - permValue(b));
        if (!pool.length) continue;
        const f = (F.isAI || AUTOPLAY || pool.length === 1) ? pool[0] : (await pickCard(F, pool, `${src.card.name}: choose ${label} to sacrifice`, { required: true })) || pool[0];
        tkSacrifice(F, f);
    }
}
const tkTypesOf = card => ['Land', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'].filter(w => new RegExp(`\\b${w}\\b`).test(card.type || ''));
// Pick a target for "any target" damage: the computer kills the best creature it can, else hits the weakest opponent
async function tkDamageAny(P, n, src, title) {
    const cs = foes(P).flatMap(F => F.bf).filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud'));
    const fs = foes(P);
    if (P.isAI || AUTOPLAY) {
        const kill = cs.filter(x => tou(x) - x.dmg <= n).sort((a, b) => creatureValue(b) - creatureValue(a))[0];
        if (kill) { damage(kill, n, src); log(`${src.card.name} deals ${n} to ${kill.card.name}.`); return; }
        const F = fs.slice().sort((a, b) => a.life - b.life)[0]; if (F) { damage(F, n, src); log(`${src.card.name} deals ${n} to ${F.name}.`); }
        return;
    }
    const opts = [...fs.map(F => ({ label: F.name, F })), ...cs.map(x => ({ label: `${x.card.name} (${pow(x)}/${tou(x)})`, o: x }))];
    const w = await pickWord(P, title, opts.map(o => o.label));
    const pick = opts.find(o => o.label === w) || opts[0];
    if (pick.o) { damage(pick.o, n, src); log(`${src.card.name} deals ${n} to ${pick.o.card.name}.`); } else { damage(pick.F, n, src); log(`${src.card.name} deals ${n} to ${pick.F.name}.`); }
}

Object.assign(CMD, {
    // ---- All Good Things... ----
    async tkAllGood(P, e, t, src) {
        if (!P.hand.length) return;
        const c = (P.isAI || AUTOPLAY) ? P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : await pickCard(P, P.hand, `${src.card.name}: exile a card from your hand`, { required: true }) || P.hand[0];
        pull(P.hand, c); P.exile.push(c); (src.exiledCards = src.exiledCards || []).push(c);
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${you(P) ? c.card.name : 'a card'} from ${you(P) ? 'your' : 'their'} hand (${src.card.name}).`);
    },
    async tkAllGoodIV(P, e, t, src) {
        const cs = src.exiledCards || [];
        if (!cs.length) return;
        const shared = tkTypesOf(cs[0].card).filter(w => cs.every(c => new RegExp(`\\b${w}\\b`).test(c.card.type || '')));
        if (shared.length) await applyEffect(P, { t: 'gain', n: 10 }, null, src); else log(`The exiled cards don't share a card type.`);
    },
    // ---- Blastoneuron ----
    async tkBlastoneuron(P, e, t, src) {
        const pool = P.gy.filter(x => tkCreatureCard(x) && (x.card.cmc || 0) <= 3);
        const pick = await pickOwn(P, pool, `${src.card.name}: exile a creature card with mana value 3 or less from your graveyard`, { optional: true });
        if (!pick) return;
        pull(P.gy, pick); P.exile.push(pick);
        const tok = tokenCopyOf(P, pick.card); tok.tkw.push('haste'); tok.sacAtEnd = G.turn; tok.sick = false;
    },
    tkBoimler(P) { P.boimlerTurn = G.turn; log(`This turn, counters put on ${P.name === 'You' ? 'your' : `${P.name}'s`} permanents get one more of each kind.`); },
    tkBottomSelf(P, e, t, src) { removeFromZones(src); P.library.unshift(src); log(`${src.card.name} goes on the bottom of ${you(P) ? 'your' : 'their'} library.`); },
    async tkBurnham(P, e, t, src) {
        if (src.burnTurn !== G.turn) { src.burnTurn = G.turn; src.burnN = 0; }
        src.burnN++;
        await applyEffect(P, { t: 'dmg', n: 1, target: 'opponents' }, null, src);
        if (src.burnN === 2 && onBf(src.uid)) putCounters(src, 1, P);
    },
    async tkCaptainBoost(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        x.tp += 1; log(`${x.card.name} gets +1/+0 until end of turn.`);
        if (P.bf.filter(isCreature).reduce((a, y) => a + Math.max(0, pow(y)), 0) >= 8) { x.tkw.push('menace'); log(`${x.card.name} gains menace until end of turn.`); }
    },
    async tkCetiEel(P, e, t, src) {
        await applyEffect(P, { t: 'millSelf', n: 2 }, null, src);
        const n = P.gy.filter(x => tkCreatureCard(x) || /\bArtifact\b/.test(x.card.type)).length;
        if (n && onBf(src.uid)) putCounters(src, n, P);
    },
    async tkChairMana(P, e, t, src) {
        const X = Math.max(0, ...P.bf.filter(x => x.isCommander).map(x => x.card.cmc || 0));
        if (X <= 0) return;
        const cols = ['W', 'U', 'B', 'R', 'G'];
        let c = (typeof bestPoolColor === 'function' && bestPoolColor(P)) || 'G'; if (!cols.includes(c)) c = 'G';
        if (!(P.isAI || AUTOPLAY)) { const w = await pickWord(P, `${src.card.name}: choose a color`, cols.map(k => COLOR_NAMES[k])); c = cols.find(k => COLOR_NAMES[k] === w) || c; }
        await applyEffect(P, { t: 'addMana', fromN: true, n: X, color: c }, null, src);
    },
    async tkChangPump(P, e, t, src) { P.bf.filter(x => isCreature(x) && hasType(x, 'Klingon')).forEach(x => putCounters(x, 1, P)); log('Each Klingon gets a +1/+1 counter.'); },
    // Ensign Chekov: each opponent exiles the top X cards; choose a land among them; you may play it this turn
    async tkChekov(P, e, t, src) {
        const X = tkNamedLands(P); if (X <= 0) return;
        for (const F of foes(P)) {
            const seen = F.library.splice(-X).reverse(); seen.forEach(c => F.exile.push(c));
            log(`${F.name} ${you(F) ? 'exile' : 'exiles'} ${seen.length} card${seen.length === 1 ? '' : 's'} from the top of ${you(F) ? 'your' : 'their'} library.`);
            const lands = seen.filter(c => /\bLand\b/.test(c.card.type));
            const pick = await pickOwn(P, lands, `${src.card.name}: choose a land card exiled from ${F.name}'s library`, { optional: true, rank: (a, b) => (b.card.colors || []).length - (a.card.colors || []).length });
            if (pick) { pull(F.exile, pick); pick.realOwner = pick.owner; pick.owner = P.i; pick.playUntil = G.turn; P.exile.push(pick); log(`${P.name} may play ${pick.card.name} this turn.`); }
        }
    },
    // The City on the Edge of Forever
    async tkCityI(P, e, t, src) {
        allPerms().filter(x => isCreature(x) || /\bArtifact\b/.test(x.card.type)).forEach(x => { if (onBf(x.uid)) phaseOut(x); });
        await applyEffect(P, { t: 'token', n: 1, p: 0, q: 1, name: 'white Human', kw: [], text: 'Permanents can\'t phase in.' }, null, src);
        if (G.lastMade) G.lastMade.noPhaseIn = true;
    },
    async tkCityIII(P, e, t, src) {
        const pool = P.bf.filter(x => x.token && isCreature(x));
        if (!pool.length) { log('There is no creature token to sacrifice.'); return; }
        const f = (P.isAI || AUTOPLAY) ? (pool.find(x => x.noPhaseIn) || pool.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0]) : await pickCard(P, pool, `${src.card.name}: sacrifice a creature token`, { required: true }) || pool[0];
        tkSacrifice(P, f); await applyEffect(P, { t: 'gain', n: 5 }, null, src);
    },
    // There's Coffee in that Nebula
    async tkCoffee(P, e, t, src) {
        const seen = P.library.splice(-5).reverse();
        const ok = x => (/\bPlains\b/.test(x.card.type) || (!/\bLand\b/.test(x.card.type) && !/Instant|Sorcery/.test(x.card.type) && (x.card.cmc || 0) <= 3));
        const pool = seen.filter(ok);
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: put a card into your hand (the rest go to the bottom)`, {})) : null;
        if (pick) { P.hand.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${you(P) ? pick.card.name : 'a card'} into ${you(P) ? 'your' : 'their'} hand.`); }
        shuffle(seen.filter(x => x !== pick)).forEach(x => P.library.unshift(x));
    },
    async tkCommonGoal(P, e, t, src) {
        const mine = P.bf.filter(isCreature);
        const foesC = foes(P).flatMap(F => F.bf).filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud'));
        if (!mine.length || !foesC.length) return;
        const target = (P.isAI || AUTOPLAY) ? foesC.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, foesC, `${src.card.name}: choose a creature an opponent controls`, { required: true }) || foesC[0];
        const chosen = (P.isAI || AUTOPLAY) ? mine.slice().sort((a, b) => pow(b) - pow(a)).slice(0, 2) : await jvPickSeveral(P, mine, `${src.card.name}: creatures that deal damage`, 2, null);
        for (const c of chosen.length ? chosen : [mine[0]]) { const d = Math.max(0, pow(c)); if (d) { damage(target, d, c); log(`${c.card.name} deals ${d} to ${target.card.name}.`); } }
    },
    // Equipment
    tkCopyCommunicator(P, e, t, src) { tokenCopyOf(P, src.card); },
    async tkCommunicator(P, e, t, src) {
        const host = onBf(src.attachedTo); if (!host) return;
        const X = P.bf.filter(c => isCreature(c) && c !== host && allPerms().some(a => a.attachedTo === c.uid && hasType(a, 'Communicator'))).length;
        if (X <= 0) return;
        drawCards(P, X);
        const lands = P.hand.filter(x => /\bLand\b/.test(x.card.type));
        let k = 0;
        for (; k < X && lands.length;) {
            const l = (P.isAI || AUTOPLAY) ? lands.shift() : await pickCard(P, lands, `${src.card.name}: put a land card onto the battlefield tapped (${k + 1} of up to ${X})`, {});
            if (!l) break; lands.splice(lands.indexOf(l), 1); putOntoBattlefield(P, l, true); k++;
        }
    },
    async tkKahless(P, e, t, src) {
        const host = onBf(src.attachedTo); if (!host) return;
        const seen = P.library.splice(-5).reverse();
        const pool = seen.filter(x => tkCreatureCard(x) && (hasType(x, 'Klingon') || hasType(x, 'Warrior')));
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: put a Klingon or Warrior creature onto the battlefield`, {})) : null;
        if (pick) putOntoBattlefield(P, pick);
        shuffle(seen.filter(x => x !== pick)).forEach(x => P.library.unshift(x));
    },
    async tkExplosives(P, e, t, src) {
        const n = ((src.lkiCtr && src.lkiCtr.charge) ?? (src.ctr && src.ctr.charge)) || 0; // sunburst: counters for each color of mana spent: approximated by the colors in its cost
        const hit = allPerms().filter(x => x !== src && !/\bLand\b/.test(x.card.type) && (x.card.cmc || 0) === n);
        for (const x of hit) if (onBf(x.uid)) await applyEffect(P, { t: 'destroy', target: 'creature' }, { o: x }, src);
    },
    // Conqueror, Hit It, Spock and other ETBs
    async tkConqueror(P, e, t, src) {
        await applyEffect(P, { t: 'millSelf', n: 3 }, null, src);
        const lands = P.gy.filter(x => /\bLand\b/.test(x.card.type));
        const pick = await pickOwn(P, lands, `${src.card.name}: return a land card from your graveyard to your hand`, {});
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); } else await applyEffect(P, { t: 'artToken', n: 1, kind: 'treasure' }, null, src);
    },
    async tkHitIt(P, e, t, src) {
        const seen = P.library.splice(-5).reverse();
        const lands = seen.filter(x => /\bLand\b/.test(x.card.type));
        const pick = lands.length ? ((P.isAI || AUTOPLAY) ? lands[0] : await pickCard(P, lands, `${src.card.name}: put a land card onto the battlefield tapped`, {})) : null;
        seen.filter(x => x !== pick).forEach(x => P.gy.push(x));
        if (pick) putOntoBattlefield(P, pick, true);
    },
    async tkSpockLook(P, e, t, src) {
        const seen = P.library.splice(-4).reverse();
        const pool = seen.filter(x => !tkCreatureCard(x) && !/\bLand\b/.test(x.card.type));
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: reveal a noncreature, nonland card and put it into your hand`, {})) : null;
        if (pick) { P.hand.push(pick); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${pick.card.name} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand.`); }
        seen.filter(x => x !== pick).forEach(x => P.library.unshift(x));
    },
    async tkSaltVampire(P, e, t, src) {
        const F = await chooseFoeTarget(P, `${src.card.name}: choose an opponent`); if (!F) return;
        const pool = F.hand.filter(x => !/\bLand\b/.test(x.card.type));
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at ${F.name}'s hand.`);
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: choose a nonland card from ${F.name}'s hand`, {})) : null;
        if (pick) { pull(F.hand, pick); F.exile.push(pick); log(`${F.name} exiles ${pick.card.name}.`); drawCards(F, 1); }
    },
    async tkZero(P, e, t, src) {
        const F = await chooseFoeTarget(P, `${src.card.name}: choose an opponent`); if (!F) return;
        const pool = F.hand.filter(x => !/\bLand\b/.test(x.card.type));
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: exile a nonland card from ${F.name}'s hand`, {})) : null;
        if (!pick) return;
        pull(F.hand, pick); F.exile.push(pick); pick.zeroTax = 2; pick.playUntil = 1e9; pick.zeroOwner = F.i;
        log(`${F.name}'s ${pick.card.name} is exiled; its owner may play it (it costs {2} more).`);
    },
    async tkKhanEtb(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && tkIsCreatureOrArt(x));
        if (!pool.length) return;
        const f = (P.isAI || AUTOPLAY) ? (pool.filter(x => x.token || permValue(x) <= 3).sort((a, b) => permValue(a) - permValue(b))[0] || null) : await tkPickFrom(P, pool, `${src.card.name}: sacrifice another creature or artifact to draw two cards?`, { optional: true });
        if (!f) return;
        tkSacrifice(P, f); drawCards(P, 2);
    },
    async tkQ(P, e, t, src) {
        P.library = shuffle(P.library);
        let c = null;
        while (P.library.length) { const x = P.library.pop(); if (!/\bLand\b/.test(x.card.type)) { c = x; break; } P.exile.push(x); }
        if (c) { P.exile.push(c); c.qSrc = src.card; log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${c.card.name}.`); }
    },
    async tkMarooned(P, e, t, src) { const h = onBf(src.attachedTo); if (!h || h.tapped) return; if (await tkPay(P, 3, `${src.card.name}: pay {3} to tap enchanted ${h.card.name}?`, src.card)) { h.tapped = true; fire('tapped', { o: h }); log(`${h.card.name} is tapped.`); } },
    async tkPeace(P, e, t, src) {
        const A = G.players[G.active];
        if (!A || A.out) return;
        const ok = (A.isAI || AUTOPLAY) ? (A.library.length > 5 && (G.attackers.length === 0 || foes(A).length === 0 ? true : pow(A.bf.filter(isCreature)[0] || { }) === 0)) : await askYes(A, `${src.card.name}: draw a card? (You can't attack this turn.)`, { card: src.card, yes: 'Draw a card', no: 'No' });
        if (!ok) return;
        drawCards(A, 1); A.noAttackTurn = G.turn; src.ctr.peace = (src.ctr.peace || 0) + 1;
        log(`${A.name} can't attack this turn; ${src.card.name} gets a peace counter.`);
    },
    async tkKobayashi(P, e, t, src) {
        const modes = [['Hail', "Return up to one target creature an opponent controls with mana value 3 or less to its owner's hand"], ['Sensors', 'Draw two cards'], ['Transport', 'Create two 1/1 red Officer creature tokens'], ['Abandon Ship', 'You lose the game']];
        src.kobayashi = src.kobayashi || [];
        const left = modes.map((m, i) => i).filter(i => !src.kobayashi.includes(i));
        if (!left.length) { log('Every Kobayashi Maru option has been chosen.'); return; }
        let pick;
        if (P.isAI || AUTOPLAY) pick = [1, 2, 0, 3].find(i => left.includes(i)); // the computer avoids Abandon Ship until it must
        else pick = left[await askMode(P, `${src.card.name}: choose one that hasn't been chosen`, left.map(i => `${modes[i][0]} — ${modes[i][1]}`))];
        src.kobayashi.push(pick); tkDilemma(P, src); log(`${P.name} ${you(P) ? 'choose' : 'chooses'} ${modes[pick][0]}.`);
        if (pick === 0) {
            const cs = foes(P).flatMap(F => F.bf).filter(x => isCreature(x) && (x.card.cmc || 0) <= 3 && !has(x, 'hexproof'));
            const x = cs.length ? ((P.isAI || AUTOPLAY) ? cs.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, cs, `${src.card.name}: return a creature to its owner's hand`, {})) : null;
            if (x) { log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand'); }
        } else if (pick === 1) drawCards(P, 2);
        else if (pick === 2) await tkOfficers(P, 2, src);
        else await applyEffect(P, { t: 'loseSelf' }, null, src);
    },
    // ---- Kirk ----
    async tkKirkModes(P, e, t, src) {
        const labels = ['Discard a card, then draw a card', 'Create a 1/1 red Officer creature token', 'Creatures you control get +1/+0 until end of turn'];
        const more = !P.hand.length;
        let picks;
        if (P.isAI || AUTOPLAY) picks = more ? [0, 1, 2] : (P.bf.filter(isCreature).length >= 3 ? [2] : [1]);
        else {
            picks = [];
            const first = await askMode(P, `${src.card.name}: choose one${more ? ' or more' : ''}`, labels); picks.push(first);
            if (more) for (const i of [0, 1, 2]) if (i !== first && await askYes(P, `${src.card.name}: also choose "${labels[i]}"?`, { card: src.card })) picks.push(i);
        }
        tkDilemma(P, src);
        for (const i of picks.sort()) {
            if (i === 0) { await applyEffect(P, { t: 'loot', n: 1 }, null, src); }
            else if (i === 1) await tkOfficers(P, 1, src);
            else P.bf.filter(isCreature).forEach(x => { x.tp += 1; });
        }
    },
    async tkKirkSearch(P, e, t, src) {
        const isTarget = x => (/\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type)) || x.card.name === 'Starship Enterprise';
        const inLib = P.library.filter(isTarget), inGy = P.gy.filter(isTarget);
        const pool = [...inLib, ...inGy];
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? (pool.find(x => x.card.name === 'Starship Enterprise') || pool[0]) : await pickCard(P, pool, `${src.card.name}: choose a basic land card or Starship Enterprise (library or graveyard)`, {})) : null;
        if (pick) {
            const lib = P.library.includes(pick);
            removeFromZones(pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} into ${you(P) ? 'your' : 'their'} hand.`);
            if (lib) shuffleLib(P);
        } else if (inLib.length === 0) shuffleLib(P);
    },
    async tkExploreEntered(P, e, t, src) {
        const x = (G.ctxRaw && G.ctxRaw.o) || G.ctxObj; if (!x || !onBf(x.uid)) return;
        await applyEffect(P, { t: 'explore' }, { o: x }, x);
    },
    async tkSpock(P, e, t, src) {
        const top = P.library[P.library.length - 1]; if (!top) return;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name}.`);
        const X = tkNamedLands(P);
        if (/\bLand\b/.test(top.card.type)) {
            if (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: put ${top.card.name} onto the battlefield tapped?`, { card: top.card })) { P.library.pop(); putOntoBattlefield(P, top, true); }
        } else if ((top.card.cmc || 0) <= X && Rx(top).support !== 'none') {
            if (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${top.card.name} without paying its mana cost?`, { card: top.card })) await castFreeFrom(P, top);
        }
        if (P.library[P.library.length - 1] === top) drawCards(P, 1);
    },
    // ---- Counters and tokens ----
    async tkDoctorEmh(P, e, t, src) {
        const x = t && t.o; if (x && onBf(x.uid)) putCounters(x, 1, P);
        P.bf.filter(c => isCreature(c) && (c.counters > 0 || Object.values(c.ctr || {}).some(v => v > 0))).forEach(c => putCounters(c, 1, P));
    },
    async tkOBrienEtb(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && tkIsCreatureOrArt(x));
        const x = pool.length ? ((P.isAI || AUTOPLAY) ? null : await tkPickFrom(P, pool, `${src.card.name}: return up to one other creature or artifact you control to its owner's hand`, { optional: true })) : null;
        if (x) { log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand'); P.returnedTurn = G.turn; }
    },
    async tkGuinan(P, e, t, src) {
        const xs = P.bf.filter(x => isCreature(x) && x.enteredTurn === G.turn);
        xs.forEach(x => putCounters(x, 1, P));
        if (xs.length >= 2) drawCards(P, 1);
    },
    async tkDataDraw(P, e, t, src) {
        let need = 3;
        for (const x of P.bf.filter(isCreature)) { while (need > 0 && x.counters > 0) { x.counters--; need--; } for (const k of Object.keys(x.ctr || {})) while (need > 0 && x.ctr[k] > 0) { x.ctr[k]--; need--; } if (need <= 0) break; }
        if (need > 0) return;
        drawCards(P, 1); log('Three counters are removed from creatures: draw a card.');
    },
    async tkPicardPump(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const n = Math.max(0, pow(src)); x.tp += n; x.tq += n; log(`${x.card.name} gets +${n}/+${n} until end of turn.`); },
    async tkWorfCounter(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && !x.tapped && tkIsCreatureOrArt(x));
        if (pool.length < 2) return;
        const chosen = [];
        for (let k = 0; k < 2; k++) { const left = pool.filter(x => !chosen.includes(x)); const x = (P.isAI || AUTOPLAY) ? left.slice().sort((a, b) => permValue(a) - permValue(b))[0] : await pickCard(P, left, `${src.card.name}: tap an untapped artifact or creature (${k + 1} of 2)`, { required: true }) || left[0]; chosen.push(x); }
        chosen.forEach(x => { x.tapped = true; fire('tapped', { o: x }); });
        putCounters(src, 1, P);
    },
    async tkKrugePump(P, e, t, src) { (G.attackers || []).map(u => onBf(u)).filter(x => x && x.owner === P.i && hasType(x, 'Klingon')).forEach(x => { x.tp += 1; x.tq += 1; }); log('Attacking Klingons get +1/+1 until end of turn.'); },
    async tkGowron(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && isCreature(x));
        const f = await tkPickFrom(P, pool, `${src.card.name}: sacrifice another creature`, {});
        if (!f) return;
        const wasKlingon = hasType(f, 'Klingon');
        tkSacrifice(P, f); src.tkw.push('trample');
        if (wasKlingon) { drawCards(P, 1); P.life -= 1; log(`${P.name} ${you(P) ? 'draw' : 'draws'} a card and ${you(P) ? 'lose' : 'loses'} 1 life.`); }
    },
    async tkTribbles(P, e, t, src) {
        for (const X of G.players.filter(y => !y.out)) await applyEffect(X, { t: 'token', n: 2, p: 1, q: 1, name: 'white Tribble', kw: [], text: '~ can\'t block.' }, null, src);
    },
    async tkMariner(P, e, t, src) {
        src.ctr.promotion = (src.ctr.promotion || 0) + 1; log(`${src.card.name} gets a promotion counter.`);
        if (src.ctr.promotion >= 3) { src.ctr.promotion = 0; await applyEffect(P, { t: 'dmg', n: 2, target: 'opponents' }, null, src); }
    },
    async tkGyBottom(P, e, t, src) {
        const pick = await pickOwn(P, P.gy.filter(x => x !== src), `${src.card.name}: put a card from your graveyard on the bottom of your library`, { optional: false, rank: (a, b) => aiKeepValue(P, a) - aiKeepValue(P, b) });
        if (pick) { pull(P.gy, pick); P.library.unshift(pick); log(`${pick.card.name} goes on the bottom of ${you(P) ? 'your' : 'their'} library.`); }
    },
    async tkDahar(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && !/\bLand\b/.test(x.card.type));
        const f = (P.isAI || AUTOPLAY) ? (pool.filter(x => x.token || permValue(x) <= 2).sort((a, b) => permValue(a) - permValue(b))[0] || null) : await tkPickFrom(P, pool, `${src.card.name}: sacrifice another nonland permanent? (2 damage to any target)`, { optional: true });
        if (!f) return;
        tkSacrifice(P, f); await tkDamageAny(P, 2, src, `${src.card.name}: 2 damage to any target`);
    },
    // Replicator, Holodeck, Moonlight
    async tkReplicator(P, e, t, src) {
        const pool = P.bf.filter(x => x.token);
        const x = await tkPickFrom(P, pool, `${src.card.name}: copy a token you control`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (!x) return;
        const tok = tokenCopyOf(P, x.card); tok.tapped = true;
    },
    async tkHolodeck(P, e, t, src) {
        const pool = P.gy.filter(x => !['instant', 'sorcery'].includes(Rx(x).kind) && Rx(x).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: play a permanent card from your graveyard`, { optional: true });
        if (!pick) { src.usedOnce = {}; log('No permanent card to play.'); return; }
        if (Rx(pick).kind === 'land') { if (P.landsPlayed < landLimit(P)) { putOntoBattlefield(P, pick); P.landsPlayed++; } }
        else await castFreeFrom(P, pick);
    },
    async tkMoonlight3(P, e, t, src) {
        const pool = P.bf.filter(tkIsCreatureOrArt);
        const f = (P.isAI || AUTOPLAY) ? (pool.filter(x => x.token || permValue(x) <= 2).sort((a, b) => permValue(a) - permValue(b))[0] || null) : await tkPickFrom(P, pool, `${src.card.name}: sacrifice an artifact or creature to create two 2/2 Romulans?`, { optional: true });
        if (!f) return;
        tkSacrifice(P, f); await applyEffect(P, { t: 'token', n: 2, p: 2, q: 2, name: 'black Romulan', kw: [] }, null, src);
    },
    async tkEdictNontoken(P, e, t, src) { await tkEdictEach(P, x => isCreature(x) && !x.token, src, 'a nontoken creature'); },
    async tkEdictNontokenPerm(P, e, t, src) { await tkEdictEach(P, x => !x.token, src, 'a nontoken permanent'); },
    async tkShaka(P, e, t, src) { await tkEdictEach(P, x => !x.token && /Artifact|Enchantment/.test(x.card.type), src, 'a nontoken artifact or enchantment'); },
    async tkMinusOthers(P, e, t, src) { allPerms().filter(x => isCreature(x) && x !== src).forEach(x => { x.tp -= 1; x.tq -= 1; }); log('All other creatures get -1/-1 until end of turn.'); }
});


// ===== Spells =====
const tkLastCtrl = P => (G.lastPower ? G.lastPower.P : P);
Object.assign(CMD, {
    // 70,000 Light-Years from Home: the exiled permanent's controller may search for a basic land card and put it into their hand
    async tkFetchHandLastCtrl(P, e, t, src) {
        const X = tkLastCtrl(P);
        const lands = X.library.filter(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type));
        if (!lands.length) { shuffleLib(X); return; }
        const pick = (X.isAI || AUTOPLAY) ? lands[0] : await pickCard(X, lands, `${src.card.name}: search for a basic land card (or none)`, {});
        if (pick) { pull(X.library, pick); X.hand.push(pick); log(`${X.name} ${you(X) ? 'put' : 'puts'} a basic land card into ${you(X) ? 'your' : 'their'} hand.`); }
        shuffleLib(X);
    },
    // A Good Day to Die
    tkDeathDraw(P, e, t, src) { const x = t && t.o; if (!x) return; x.tkDeathDraw = G.turn; x.tkDeathDrawBy = P.i; log(`If ${x.card.name} dies this turn, ${P.name} will draw a card.`); },
    async tkGuidanceFailure(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const O = G.players[x.owner];
        const top = (O.isAI || AUTOPLAY) ? (O === P ? false : true) : await askYes(O, `${src.card.name}: put ${x.card.name} on top of your library? (Cancel = bottom)`, { card: x.card, yes: 'Top', no: 'Bottom' });
        leaveBattlefield(x, 'library'); // goes to the top
        if (!top) { pull(O.library, x); O.library.unshift(x); }
        log(`${x.card.name} is put on the ${top ? 'top' : 'bottom'} of its owner's library.`);
    },
    tkStunLast(P, e, t, src) { const x = t && t.o; if (!x) return; x.ctr.stun = (x.ctr.stun || 0) + e.n; log(`${x.card.name} gets ${e.n} stun counter${e.n === 1 ? '' : 's'}.`); },
    async tkDeepSpaceScan(P, e, t, src) { const n = tkNamedLands(P); if (n > 0) drawCards(P, n); },
    async tkDoubleLife(P, e, t, src) { const n = Math.max(0, P.life); if (n > 0) await applyEffect(P, { t: 'gain', n }, null, src); },
    tkDrawHand(P, e, t, src) { const n = P.hand.length; if (n) drawCards(P, n); },
    async tkEachLose(P, e, t, src) { G.players.filter(X => !X.out).forEach(X => { X.life -= e.n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${e.n} life.`); fire('loseLife', { P: X, n: e.n }); }); },
    async tkEjectKicked(P, e, t, src) { const x = t && t.o; if (x && src.kicked) { x.tp -= 4; x.tq -= 4; log(`${x.card.name} gets another -4/-4 (kicked).`); } },
    async tkFirstContact(P, e, t, src) { if ((G.castCount && G.castCount[P.i] === 1) || (P.castsAll === 1)) await applyEffect(P, { t: 'gain', n: 2 }, null, src); },
    async tkDoctorNot(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; putCounters(x, 1, P); x.tapped = false; x.tp += 1; x.tq += 1; x.tempSub = { turn: G.turn, sub: 'Doctor' }; log(`${x.card.name} untaps, gets +1/+1 and becomes a Doctor until end of turn.`); },
    // Join the Collective: destroy all creatures, then X 1/1 Borg tokens for the nonartifact creatures destroyed
    async tkJoinCollective(P, e, t, src) {
        const all = allPerms().filter(isCreature);
        let n = 0;
        for (const x of all) {
            if (!onBf(x.uid)) continue;
            const art = /\bArtifact\b/.test(x.card.type);
            const before = onBf(x.uid);
            await applyEffect(P, { t: 'destroy', target: 'creature' }, { o: x }, src);
            if (before && !onBf(x.uid) && !art) n++;
        }
        await tkBorgs(P, n, src);
    },
    async tkMirrorCopy(P, e, t, src) { if (src.kicked) return; const x = t && t.o; if (!x) return; const tok = tokenCopyOf(P, x.card); tok.tkw.push('menace'); },
    async tkMirrorKicked(P, e, t, src) {
        if (!src.kicked) return;
        const F = await chooseFoeTarget(P, `${src.card.name}: choose an opponent`); if (!F) return;
        for (const x of F.bf.filter(isCreature)) { const tok = tokenCopyOf(P, x.card); tok.tkw.push('menace'); }
    },
    async tkPureEnergy(P, e, t, src) {
        const cs = P.bf.filter(isCreature); const all = [...cs, ...foes(P).flatMap(F => F.bf.filter(x => isCreature(x) && !has(x, 'hexproof')))];
        if (!cs.length) return;
        const best = cs.slice().sort((a, b) => creatureValue(b) - creatureValue(a));
        if (P.isAI || AUTOPLAY) { putCounters(best[0], 1, P); putCounters(best[1] || best[0], 1, P); return; }
        const a = await pickCard(P, all, `${src.card.name}: first +1/+1 counter`, { required: true }) || best[0];
        const rest = all.filter(x => x !== a);
        const b = rest.length && await askYes(P, `${src.card.name}: put the second counter on a different creature?`, { card: src.card, yes: 'Different creature', no: `Same (${a.card.name})` }) ? (await pickCard(P, rest, `${src.card.name}: second +1/+1 counter`, { required: true }) || a) : a;
        putCounters(a, 1, P); putCounters(b, 1, P);
    },
    async tkShieldsUp(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; x.tkw.push('hexproof', 'indestructible'); if (isCreature(x)) putCounters(x, 1, P); log(`${x.card.name} gains hexproof and indestructible until end of turn.`); },
    async tkReturnArtifactCreature(P, e, t, src) {
        const pool = P.gy.filter(x => tkCreatureCard(x) && /\bArtifact\b/.test(x.card.type) && (x.card.cmc || 0) <= 3);
        const pick = await pickOwn(P, pool, `${src.card.name}: return an artifact creature card with mana value 3 or less to the battlefield`, { optional: false });
        if (pick) putOntoBattlefield(P, pick);
    },
    tkVgerShrink(P, e, t, src) { foes(P).flatMap(F => F.bf).filter(isCreature).forEach(x => { x.pt2 = { p: -1, q: 0, until: nextTurnOf(P) }; }); log('Creatures your opponents control get -1/-0 until your next turn.'); },
    // Wrath of Khan
    async tkWrathI(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        damage(x, 4, src); log(`${src.card.name} deals 4 damage to ${x.card.name}.`);
        if (onBf(x.uid)) { (G.nextCombatSteal = G.nextCombatSteal || []).push({ o: x, by: P.i, turn: G.turn }); log(`At the beginning of the next combat this turn, ${P.name} will gain control of ${x.card.name}.`); }
    },
    async tkWrathLoot(P, e, t, src) {
        if (!P.hand.length) return;
        const c = (P.isAI || AUTOPLAY) ? null : await pickCard(P, P.hand, `${src.card.name}: exile a card from your hand to draw a card (or none)`, {});
        if (!c) { if (!(P.isAI || AUTOPLAY)) return; const low = P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0]; if (aiKeepValue(P, low) > 3) return; pull(P.hand, low); P.exile.push(low); drawCards(P, 1); return; }
        pull(P.hand, c); P.exile.push(c); drawCards(P, 1);
    },
    // Those Old Scientists
    async tkOldScientists2(P, e, t, src) {
        const pool = P.gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind) || /\bArtifact\b/.test(x.card.type));
        const pick = await pickOwn(P, pool, `${src.card.name}: return an artifact, instant or sorcery card to your hand`, { optional: true });
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async tkOldScientists3(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => ({ X, c })));
        const chosen = [];
        for (let k = 0; k < 2; k++) {
            const left = pool.filter(p => !chosen.includes(p)); if (!left.length) break;
            let pick;
            if (P.isAI || AUTOPLAY) pick = k === 0 ? (left.filter(p => p.X !== P).sort((a, b) => tkBest(a.c, b.c))[0] || left.slice().sort((a, b) => aiKeepValue(P, a.c) - aiKeepValue(P, b.c))[0]) : (left.filter(p => p.X !== P).sort((a, b) => tkBest(a.c, b.c))[0] || null);
            else { const c = await pickCard(P, left.map(p => p.c), `${src.card.name}: choose up to two cards in graveyards (${k + 1} of 2; skip to stop)`, {}); pick = c ? left.find(p => p.c === c) : null; }
            if (!pick) break; chosen.push(pick);
        }
        const owners = new Set();
        chosen.forEach(({ X, c }) => { pull(X.gy, c); X.library.push(c); owners.add(X); });
        owners.forEach(X => shuffleLib(X)); if (chosen.length) log(`${chosen.length} card${chosen.length === 1 ? '' : 's'} from graveyards are shuffled into libraries.`);
    },
    // The Inner Light
    async tkInnerI(P, e, t, src) {
        const pool = P.gy.filter(x => tkCreatureCard(x) && (x.card.colors || []).some(c => c === 'G' || c === 'W'));
        const pick = await pickOwn(P, pool, `${src.card.name}: return a green or white creature card to the battlefield`, { optional: false });
        if (pick) putOntoBattlefield(P, pick);
    },
    tkInnerII(P, e, t, src) { const x = t && t.o; if (!x) return; x.innerLight = { turn: G.turn, by: P.i }; log(`Whenever ${x.card.name} deals combat damage to a player this turn, ${P.name} draws that many cards.`); },
    async tkInnerIII(P, e, t, src) { const n = Math.max(0, ...P.bf.filter(isCreature).map(pow)); if (n > 0) await applyEffect(P, { t: 'gain', n }, null, src); },
    // Captain Picard: search for a Spacecraft, with seven charge counters on it
    async tkPicardFetch(P, e, t, src) {
        const officers = P.bf.filter(x => hasType(x, 'Officer') && !x.tapped).slice(0, 7);
        if (officers.length < 7) return;
        officers.forEach(x => { x.tapped = true; fire('tapped', { o: x }); });
        const pool = P.library.filter(x => hasType(x, 'Spacecraft') || /Spacecraft/.test(x.card.type));
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: choose a Spacecraft card`, {})) : null;
        if (pick) { pull(P.library, pick); putOntoBattlefield(P, pick); tkCounters(pick, 'charge', 7); }
        shuffleLib(P);
    },
    // Jean-Luc Picard, Luminary: second card drawn each turn
    async tkLuminaryDraw(P, e, t, src) {
        const cs = P.bf.filter(x => isCreature(x) && x !== src);
        const c = await tkPickFrom(P, cs, `${src.card.name}: put a +1/+1 counter on up to one other creature`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (c) putCounters(c, 1, P);
        const ships = allPerms().filter(tkIsShip);
        const s = await tkPickFrom(P, ships, `${src.card.name}: put two charge counters on up to one Spacecraft`, { optional: true, rank: (a, b) => (a.owner === P.i ? 0 : 1) - (b.owner === P.i ? 0 : 1) || ((b.ctr.charge || 0) - (a.ctr.charge || 0)) });
        if (s) tkCounters(s, 'charge', 2);
    },
    // Worf, Intelligence Contractor: for each opponent, gain control of up to one creature with mana value 3 or less until end of turn
    async tkWorfContractor(P, e, t, src) {
        for (const F of foes(P)) {
            const pool = F.bf.filter(x => isCreature(x) && (x.card.cmc || 0) <= 3 && !has(x, 'hexproof') && !has(x, 'shroud'));
            const x = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: gain control of up to one of ${F.name}'s creatures with mana value 3 or less`, {})) : null;
            if (!x) continue;
            pull(F.bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = P.i; x.tapped = false; x.sick = false; x.stolenTurn = G.turn; P.bf.push(x);
            x.tkw.push('haste'); x.addedTypes = (x.addedTypes || []).concat('Warrior');
            log(`${P.name} gains control of ${x.card.name} until end of turn; it untaps and gains haste.`);
        }
    }
});
Object.assign(CMD_SCORE, { tkFetchHandLastCtrl: () => 1, tkDeathDraw: () => 2, tkGuidanceFailure: () => 5, tkStunLast: () => 2, tkDeepSpaceScan: P => Math.min(6, tkNamedLands(P)), tkDoubleLife: () => 4, tkDrawHand: P => Math.min(6, P.hand.length), tkEachLose: () => 0, tkJoinCollective: P => (foes(P).reduce((a, F) => a + F.bf.filter(isCreature).length, 0) > P.bf.filter(isCreature).length + 1 ? 9 : 1), tkMirrorCopy: () => 5, tkMirrorKicked: () => 8, tkPureEnergy: P => (P.bf.some(isCreature) ? 4 : 0), tkShieldsUp: () => 4, tkVgerShrink: () => 3, tkWrathI: () => 8, tkOldScientists2: P => (P.gy.length ? 3 : 0), tkInnerI: P => (P.gy.some(x => tkCreatureCard(x)) ? 6 : 0), tkLuminaryDraw: () => 2, tkWorfContractor: () => 6, tkMinusOthers: P => (foes(P).reduce((a, F) => a + F.bf.filter(x => isCreature(x) && tou(x) <= 1).length, 0) > P.bf.filter(x => isCreature(x) && tou(x) <= 1).length ? 5 : 0), tkShaka: () => 4, tkCommonGoal: P => (P.bf.some(isCreature) ? 6 : 0), tkCoffee: () => 3, tkEdictNontoken: () => 5, tkEdictNontokenPerm: () => 6 });


// ===== Beam me up: cast it from your graveyard for its beam me up cost by returning a creature you control to its owner's hand; then exile it =====
const tkMarooned = x => allPerms().some(a => a.attachedTo === x.uid && Rx(a).marooned);
function beamCostRaw(P, o) {
    const R = Rx(o);
    if (R.beam) return R.beam;
    if (G.active === P.i && MAIN.includes(G.phase) && P.bf.some(x => Rx(x).scotty && !lostAbilities(x)) && R.cost && Rx(o).kind !== 'land') return R.cost;
    return null;
}
const beamCandidates = (P, o) => P.bf.filter(x => isCreature(x) && !tkMarooned(x) && !(Rx(x).scotty && !Rx(o).beam));
function beamOk(P, o) { return P.gy.includes(o) && Rx(o).support !== 'none' && ['instant', 'sorcery'].includes(Rx(o).kind) && !!beamCostRaw(P, o) && beamCandidates(P, o).length > 0; }
function beamCost(P, o) { return { ...(beamCostRaw(P, o) || Rx(o).cost) }; }
async function beamReturn(P, o) {
    const pool = beamCandidates(P, o);
    const f = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : await pickCard(P, pool, `${o.card.name}: return a creature you control to its owner's hand (beam me up)`, { required: true }) || pool[0];
    if (f) { log(`${P.name} ${you(P) ? 'return' : 'returns'} ${f.card.name} to its owner's hand (beam me up).`); leaveBattlefield(f, 'hand'); P.returnedTurn = G.turn; }
    o.exileAfter = true;
}

// ===== Small rules that hook into the engine =====
TRIG_FN.hostAttacks = (o, ctx) => !!o.attachedTo && (ctx.list || []).some(x => x.uid === o.attachedTo);
TRIG_FN.artifactAttacks = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && /\bArtifact\b/.test(x.card.type) && isCreature(x));
TRIG_FN.myPlay = (o, ctx) => ctx.P && ctx.P.i === o.owner;
COND_EXTRA.push(
    [/^it has (\d+|twelve) or more peace counters on it$/, m => (P, o) => ((o.ctr && o.ctr.peace) || 0) >= (m[1] === 'twelve' ? 12 : Number(m[1]))],
    [/^you control seven or more untapped Officers$/, () => P => P.bf.filter(x => hasType(x, 'Officer') && !x.tapped).length >= 7],
    [/^you control seven or more differently named lands$/, () => P => tkNamedLands(P) >= 7],
    [/^you control two or more untapped artifacts and\/or creatures other than ~$/, () => (P, o) => P.bf.filter(x => x !== o && !x.tapped && tkIsCreatureOrArt(x)).length >= 2],
    [/^you control creatures with three or more counters among them$/, () => P => P.bf.filter(isCreature).reduce((a, x) => a + Math.max(0, x.counters) + Object.values(x.ctr || {}).reduce((s, v) => s + Math.max(0, v), 0), 0) >= 3],
    [/^a permanent was returned to your hand from the battlefield this turn$/, () => P => P.returnedTurn === G.turn],
    [/^it is your turn$/, () => P => G.active === P.i]
);
// Tribbles: goaded while the Tribble tormentor is on the battlefield; a goaded creature must attack
// (the generic goad rules read o.goaded / isGoaded)

// A creature that left to a graveyard this turn after A Good Day to Die
(function () {
    const orig = dieOrLeave;
    dieOrLeave = function (o, zone) {
        const dying = zone === 'gy' && onBf(o.uid) && isCreature(o);
        const mark = dying && o.tkDeathDraw === G.turn ? o.tkDeathDrawBy : null;
        // McCoy: another creature you control with a +1/+1 counter would be destroyed - remove all +1/+1 counters instead and heal it
        orig(o, zone);
        if (mark !== null && mark !== undefined) { const P = G.players[mark]; if (P && !P.out) { drawCards(P, 1); log(`${P.name} draws a card (A Good Day to Die).`); } }
    };
})();
// Kira Nerys: a creature that would enter while you control an attacking creature enters tapped and attacking; Inner Light draws
(function () {
    const orig = fire;
    fire = function (ev, ctx = {}) {
        if (G && !G.over) {
            if (ev === 'enters' && ctx.o && ctx.o.owner !== undefined && isCreature(ctx.o) && G.attackers && G.attackers.length) {
                const X = G.players[ctx.o.owner];
                if (X && X.bf.some(a => Rx(a).kira && !lostAbilities(a)) && G.attackers.some(u => { const a = onBf(u); return a && a.owner === ctx.o.owner && a !== ctx.o; }) && !G.attackers.includes(ctx.o.uid) && G.phase !== 'declare') { ctx.o.tapped = true; G.attackers.push(ctx.o.uid); log(`${ctx.o.card.name} enters tapped and attacking (Kira Nerys).`); }
            }
            if (ev === 'hitPlayer' && ctx.src && ctx.src.innerLight && ctx.src.innerLight.turn === G.turn && ctx.n > 0) { const P = G.players[ctx.src.innerLight.by]; if (P && !P.out) { drawCards(P, ctx.n); log(`${P.name} draws ${ctx.n} card${ctx.n === 1 ? '' : 's'} (The Inner Light).`); } }
        }
        if (ev === 'combat') tkCombatStart();
        return orig(ev, ctx);
    };
})();
// Hemmer: Spacecraft you control have hexproof during your turn
const tkHexproof = o => !!G && hasType(o, 'Spacecraft') && G.active === o.owner && G.players[o.owner].bf.some(a => Rx(a).hemmer && !lostAbilities(a));
// Dr. Crusher: lifegain triggers an extra time
const tkCrusherExtra = (ev, o) => (ev === 'gainLife' && G.players[o.owner].bf.some(a => Rx(a).crusher && !lostAbilities(a)) ? 1 : 0);
// Beginning of the next combat: Wrath of Khan's stolen creature
function tkCombatStart(P) {
    (G.nextCombatSteal || []).splice(0).forEach(s => {
        const x = s.o; if (!onBf(x.uid) || s.turn !== G.turn) return;
        const A = G.players[s.by]; if (!A || A.out || x.owner === s.by) return;
        pull(G.players[x.owner].bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = s.by; x.tapped = false; x.sick = false; x.stolenTurn = G.turn; x.tkw.push('haste'); A.bf.push(x);
        log(`${A.name} gains control of ${x.card.name} until end of turn; it untaps and gains haste.`);
    });
}

// Dr. McCoy: another creature you control with a +1/+1 counter that would be destroyed loses its +1/+1 counters and is healed instead
function tkMccoySave(o) {
    if (!isCreature(o) || o.counters <= 0) return false;
    if (!G.players[o.owner].bf.some(a => a !== o && Rx(a).mccoy && !lostAbilities(a))) return false;
    o.counters = 0; o.dmg = 0; log(`${o.card.name} loses its +1/+1 counters and is healed instead of being destroyed (Dr. McCoy).`);
    return true;
}
// Pet Sehlat can't attack alone; Peace in Our Time: a player who drew can't attack this turn
function tkAttackFilter(P, list) {
    if (P.noAttackTurn === G.turn) { if (list.length) log(`${P.name} can't attack this turn (Peace in Our Time).`); return []; }
    if (list.length === 1 && Rx(list[0]).cantAttackAlone) { log(`${list[0].card.name} can't attack alone.`); return []; }
    return list;
}

Object.assign(CMD, {
    async tkMirrorIntrusion(P, e, t, src) {
        const x = t && t.o; if (!x) return;
        if (src.kicked) {
            const F = G.players[x.owner];
            for (const c of F.bf.filter(isCreature)) { const tok = tokenCopyOf(P, c.card); tok.tkw.push('menace'); }
        } else { const tok = tokenCopyOf(P, x.card); tok.tkw.push('menace'); }
    },
    async tkSacDraw(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && tkIsCreatureOrArt(x));
        if (!pool.length) return;
        const f = (P.isAI || AUTOPLAY) ? (pool.filter(x => x.token || permValue(x) <= 2).sort((a, b) => permValue(a) - permValue(b))[0] || null) : await tkPickFrom(P, pool, `${src.card.name}: sacrifice another creature or artifact to draw a card?`, { optional: true });
        if (!f) return;
        tkSacrifice(P, f); drawCards(P, 1);
    },
    async tkSiskoCast(P, e, t, src) {
        const officers = P.bf.filter(x => hasType(x, 'Officer')).length;
        const seen = P.library.splice(-5).reverse(); seen.forEach(c => P.exile.push(c));
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${seen.length} cards from the top of ${you(P) ? 'your' : 'their'} library (${officers} Officer${officers === 1 ? '' : 's'}).`);
        for (const c of seen.filter(x => !/\bLand\b/.test(x.card.type) && (x.card.cmc || 0) <= officers && P.exile.includes(x))) {
            if (!(P.isAI || AUTOPLAY) && !(await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }))) continue;
            await castFreeFrom(P, c);
        }
    },
    async tkGrayAdira(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const c = { ...x.card, type: x.card.type.replace(/Legendary /, '') };
        const tok = tokenCopyOf(P, c); tok.tkw.push('haste'); tok.sick = false; tok.sacAtEnd = G.turn;
    },
    tkKenrithHaste(P) { allPerms().filter(isCreature).forEach(x => x.tkw.push('trample', 'haste')); log('All creatures gain trample and haste until end of turn.'); },
    async tkKenrithReanimate(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.filter(tkCreatureCard));
        const pick = pool.length ? ((P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: put a creature card from a graveyard onto the battlefield under its owner's control`, { required: true }) || pool[0]) : null;
        if (!pick) return;
        const owner = G.players[pick.owner]; putOntoBattlefield(owner, pick);
    },
    async tkDs9(P, e, t, src) {
        const seen = P.library.splice(-4).reverse();
        const perms = seen.filter(x => !['instant', 'sorcery'].includes(Rx(x).kind));
        seen.filter(x => !perms.includes(x)).forEach(x => P.exile.push(x));
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${seen.length} card${seen.length === 1 ? '' : 's'} from the top of ${you(P) ? 'your' : 'their'} library.`);
        perms.forEach(x => { P.exile.push(x); putOntoBattlefield(P, x); });
    },
    // Worf, Defiant Commander (battlefront): exile the top X cards, X = opponents attacked this turn; play them until the end of your next turn
    async tkBattlefront(P, e, t, src) {
        const defs = new Set((G.attackers || []).map(u => onBf(u)).filter(x => x && x.owner === P.i).map(x => (G.players.length > 2 && x.atkTo !== undefined ? x.atkTo : opp(P).i)));
        const X = defs.size; if (X <= 0) return;
        await applyEffect(P, { t: 'exileTop', n: X, play: 1 }, null, src);
    }
});
// Engineered Explosives: sunburst is approximated by the number of colors among your lands (at most X)
function tkSunburstColors(P) { const cols = new Set(); P.bf.filter(x => /\bLand\b/.test(x.card.type)).forEach(l => ((Rx(l).mana && Rx(l).mana.colors) || []).forEach(c => cols.add(c))); return Math.max(1, cols.size); }

// Nyota Uhura: choose a number between 0 and 10 as she enters (the computer picks the mana value the opponents' decks most often have; a person is asked)
async function tkChooseNumber(P, o, quick) {
    let n = 3;
    if (P.isAI || AUTOPLAY || quick) {
        const seen = foes(P).flatMap(F => [...F.hand.length ? [] : [], ...F.gy, ...F.bf, ...F.exile]).filter(x => !/\bLand\b/.test(x.card.type));
        const tally = {}; seen.forEach(x => { const k = Math.min(10, x.card.cmc || 0); tally[k] = (tally[k] || 0) + 1; });
        const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
        n = best ? Number(best[0]) : 3;
    } else {
        const v = await askNumber(P, `${o.card.name}: choose a number between 0 and 10`, 0, 10, 3, { card: o.card, noCancel: true });
        n = v === null || v === undefined ? 3 : v;
    }
    o.chosenNumber = n; log(`${o.card.name}: chosen number ${n}.`);
}
