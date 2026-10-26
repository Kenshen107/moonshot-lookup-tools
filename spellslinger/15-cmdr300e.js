// Spellslinger Duels - engine pieces for commander round 3, batch e (2026-10-26). Wordings are in rules/cmdr300e.js.
// Every global here starts with e_ (or is a CMD / TRIG_FN / STATIC_FN key starting with e_) so the other batches can't collide.

const e_human = P => !(P.isAI || AUTOPLAY);
const e_lose = (X, n) => { if (n <= 0 || X.out) return; X.life -= n; X.lostTurn = G.turn; X.lostN = (X.lostTurn === G.turn ? X.lostN || 0 : 0) + n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); };
async function e_oppOf(P, src, why) {
    const fs = foes(P); if (!fs.length) return null;
    if (fs.length === 1 || !e_human(P)) return fs.slice().sort((a, b) => a.life - b.life)[0];
    return fs[await askMode(P, `${src.card.name}: ${why}`, fs.map(f => f.name))] || fs[0];
}
async function e_search(P, test, title, src, how) {
    const pool = P.library.filter(test);
    if (!pool.length) { log(`${P.name} ${you(P) ? 'search' : 'searches'} their library and find${you(P) ? '' : 's'} nothing.`); shuffleLib(P); return null; }
    const x = await pickOwn(P, pool, `${src.card.name}: ${title}`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
    if (x) { pull(P.library, x); if (how === 'bf') putOntoBattlefield(P, x); else P.hand.push(x); }
    shuffleLib(P);
    return x;
}
const e_isMine = (o, x) => !!x && x.owner === o.owner;
const e_pestTypes = ['Pest', 'Bat', 'Insect', 'Snake', 'Spider'];
const e_isPest = x => e_pestTypes.some(w => hasType(x, w));
const e_nctr = x => (x.counters > 0 ? x.counters : 0) + Object.values(x.ctr || {}).reduce((a, b) => a + (b > 0 ? b : 0), 0);
const e_hasCtr = x => e_nctr(x) > 0;

// ----- global wrappers -----
// Alisaie Leveilleur: the second spell you cast each turn costs {2} less (a cost reducer with a made-up filter)
const e_origSpellFits = spellFits;
spellFits = function (o, rd, from) {
    if (rd.what === 'e_second') { const Q = G.players[o.owner]; return (Q.castTurn === G.turn ? (Q.castN || 0) : 0) === 1; }
    return e_origSpellFits(o, rd, from);
};
// Pir, Imaginative Rascal: one more +1/+1 counter on a permanent your team controls
const e_origPutCounters = putCounters;
putCounters = function (o, n, by) {
    if (o && n > 0 && onBf(o.uid)) { const X = G.players[o.owner]; if (X.bf.some(a => Rx(a).e_pir && !lostAbilities(a))) n += 1; }
    return e_origPutCounters(o, n, by);
};
// Raphael, the Muscle: double all damage that creatures you control with counters on them would deal
const e_origDamage = damage;
damage = function (target, n, src) {
    if (n > 0 && src && src.card && src.uid !== undefined && isCreature(src) && onBfQuick(src) && e_hasCtr(src)) {
        const X = G.players[src.owner]; if (X && X.bf.some(a => Rx(a).e_muscle && !lostAbilities(a))) { n *= 2; }
    }
    return e_origDamage(target, n, src);
};

Object.assign(TRIG_FN, {
    e_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    e_selfAttacksPlus2: (o, ctx) => (ctx.list || []).includes(o) && (ctx.list || []).filter(x => x.owner === o.owner).length >= 3,
    e_mineAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    e_dragonAttacks: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Dragon')),
    e_commanderAttacks: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && x.isCommander),
    e_aloneSW: (o, ctx) => (ctx.list || []).length === 1 && ctx.list[0].owner === o.owner && (hasType(ctx.list[0], 'Samurai') || hasType(ctx.list[0], 'Warrior')),
    e_artifactEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bArtifact\b/.test(ctx.o.card.type),
    e_assassinHits: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Assassin') && (ctx.hit || []).some(H => H.i !== o.owner),
    e_pirateHits: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Pirate') && (ctx.hit || []).some(H => H.i !== o.owner),
    e_newcomerHits: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && ctx.src.enteredTurn === G.turn && (ctx.hit || []).some(H => H.i !== o.owner),
    e_selfHits: (o, ctx) => ctx.src === o && (ctx.hit || []).some(H => H.i !== o.owner),
    e_myTokenMade: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !G.e_mut,
    e_myCounters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o) && (ctx.n || 0) > 0,
    e_myGain: (o, ctx) => !!ctx.P && ctx.P.i === o.owner,
    e_myInstSorcHand: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind) && ctx.o.castFromHand === G.turn,
    e_myNoncreatureCast: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && Rx(ctx.o).kind !== 'creature' && Rx(ctx.o).kind !== 'land' && o.e_krile !== G.turn,
    e_myInstSorc: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind),
    e_stormCast: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && ctx.P.e_storm === G.turn && !!ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind),
    e_castWhileAttacking: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && (G.attackers || []).includes(o.uid) && !!ctx.o,
    e_myCreatureTargeted: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o) && ctx.by !== undefined && ctx.by !== o.owner,
    e_selfTargeted: (o, ctx) => ctx.o === o && ctx.by !== undefined && ctx.by !== o.owner,
    e_selfOrMineDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && !!(ctx.lki || ctx.o),
    e_markDied: (o, ctx) => { if (ctx.o && ctx.o.owner === o.owner) { G.players[o.owner].e_died = G.turn; } return false; },
    e_discardMine: (o, ctx) => !!ctx.P && ctx.P.i === o.owner
});
STATIC_FN.e_pest = o => e_isPest(o);
STATIC_FN.e_taborax = o => o.card.name === "Taborax, Hope's Demise" && o.counters >= 5;
COND_EXTRA.push(
    [/^you control four or more Foods$/, () => P => P.bf.filter(x => hasType(x, 'Food')).length >= 4],
    [/^you have 111 or more life$/, () => P => P.life >= 111]
);

Object.assign(CMD_SCORE, { e_ilharg: () => 8, e_rhonas: () => 6, e_shabraz: () => 2, e_layla: () => 4, e_anrakyr: () => 6, e_keleth: () => 4, e_mishra: () => 5, e_adewale: () => 5, e_ishkanah: () => 3, e_evie: () => 3, e_stiltzkin: () => 2, e_kolaghan: () => 5, e_wyleth: () => 4, e_francisco: () => 3, e_aatchik: () => 5, e_donatello: () => 3, e_kaaliaZ: () => 6, e_gut: () => 5, e_imskir: () => 4, e_lily: () => 4, e_raiyuu: () => 6, e_samut: () => 3, e_clique: () => 5, e_krile: () => 3, e_stormSet: () => 2, e_stormCast: () => 6, e_mikey: () => 3, e_colfenor: () => 4, e_ayara: () => 3, e_foxglove: () => 5, e_surrak: () => 2, e_denethor: () => 3, e_blech: () => 3, e_elizabeth: () => 6, e_belzenlok: () => 7, e_casey: () => 4, e_vannifar: () => 5, e_mog: () => 3, e_danse: () => 1, e_altanak: () => 2, e_siegfried: () => 6, e_qala: () => 4, e_eowyn: () => 3, e_bilbo: () => 8, e_azula: () => 6, e_pippin: () => 6 });

Object.assign(TRIG_FN, { e_selfLeaves: (o, ctx) => ctx.o === o });
Object.assign(CMD_SCORE, { e_silumgar: () => 9, e_silumgarBack: () => 0, e_arcum: () => 3 });
Object.assign(CMD, {
    // Dragonlord Silumgar: gain control of a creature or planeswalker for as long as you control ~
    async e_silumgar(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = foes(P).flatMap(F => F.bf.filter(x => (isCreature(x) || /\bPlaneswalker\b/.test(x.card.type)) && !has(x, 'hexproof') && !has(x, 'shroud')));
        const x = await pickOwn(P, pool, `${src.card.name}: gain control of target creature or planeswalker`, { rank: (a, b) => permValue(b) - permValue(a) }); if (!x) return;
        if (giveControl(x, P)) { x.e_stolenBy = src.uid; x.sick = true; }
    },
    e_silumgarBack(P, e, t, src) {
        G.players.forEach(X => X.bf.filter(x => x.e_stolenBy === src.uid).forEach(x => { delete x.e_stolenBy; const home = G.players[x.realOwner !== undefined ? x.realOwner : x.owner]; giveControl(x, home); log(`${home.name} regain${you(home) ? '' : 's'} control of ${x.card.name}.`); }));
    },
    // Arcum Dagsson: an artifact creature's controller sacrifices it and may search for a noncreature artifact
    async e_arcum(P, e, t, src) {
        const pool = G.players.flatMap(X => X.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type) && (X === P || (!has(x, 'hexproof') && !has(x, 'shroud')))));
        const x = await pickOwn(P, pool, `${src.card.name}: target artifact creature's controller sacrifices it`, { rank: (a, b) => (a.owner === P.i ? 1 : 0) - (b.owner === P.i ? 1 : 0) || permValue(b) - permValue(a) }); if (!x) return;
        const X = G.players[x.owner]; sacPerm(X, x);
        await e_search(X, c => /\bArtifact\b/.test(c.card.type) && !/\bCreature\b/.test(c.card.type), 'search for a noncreature artifact card', src, 'bf');
    },
    // Ilharg, the Raze-Boar: a creature from your hand enters tapped and attacking; it returns to your hand at the next end step
    async e_ilharg(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type));
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature card from your hand onto the battlefield tapped and attacking?`, { optional: true }); if (!c) return;
        putOntoBattlefield(P, c, true); G.attackers.push(c.uid); if (src.atkTo !== undefined) c.atkTo = src.atkTo;
        log(`${c.card.name} enters tapped and attacking.`);
        atEndStep(() => { if (onBf(c.uid)) { pull(P.bf, c); P.hand.push(c); } }, `${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Pippin, Warden of Isengard: sacrifice four Foods
    async e_pippin(P, e, t, src) {
        const foods = P.bf.filter(x => hasType(x, 'Food')); if (foods.length < 4) return;
        for (let k = 0; k < 4; k++) { const f = P.bf.filter(x => hasType(x, 'Food'))[0]; if (f) sacPerm(P, f); }
        P.bf.filter(x => isCreature(x) && x !== src).forEach(x => { x.tp += 3; x.tq += 3; x.tkw.push('haste'); x.sick = false; });
        log('Other creatures you control get +3/+3 and gain haste until end of turn.');
    },
    // God-Eternal Rhonas
    e_rhonas(P, e, t, src) {
        const others = P.bf.filter(x => isCreature(x) && x !== src);
        others.forEach(x => { const n = Math.max(0, pow(x)); x.tp += n; x.tkw.push('vigilance'); });
        log(`${P.name} ${you(P) ? 'double' : 'doubles'} the power of ${others.length} other creature${others.length === 1 ? '' : 's'}; they gain vigilance until end of turn.`);
    },
    // Shabraz, the Skyshark
    async e_shabraz(P, e, t, src) {
        const pool = G.players.flatMap(X => X.bf.filter(x => isCreature(x) && hasType(x, 'Human') && (X === P || (!has(x, 'hexproof') && !has(x, 'shroud')))));
        const x = await pickOwn(P, pool, `${src.card.name}: target Human gains flying`, { rank: (a, b) => (b.owner === P.i ? 1 : 0) - (a.owner === P.i ? 1 : 0) || pow(b) - pow(a) }); if (!x) return;
        x.tkw.push('flying'); log(`${x.card.name} gains flying until end of turn.`);
    },
    // Layla Hassan
    async e_layla(P, e, t, src) {
        const pool = P.gy.filter(c => /\b(?:Artifact|Legendary|Saga)\b/.test(c.card.type));
        const c = await pickOwn(P, pool, `${src.card.name}: return a historic card from your graveyard to your hand`, { optional: true }); if (!c) return;
        pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Anrakyr the Traveller: cast an artifact from hand or graveyard by paying life equal to its mana value
    async e_anrakyr(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = [...P.hand, ...P.gy].filter(c => /\bArtifact\b/.test(c.card.type) && !/\bLand\b/.test(c.card.type) && (c.card.cmc || 0) < P.life);
        const c = await pickOwn(P, pool, `${src.card.name}: cast an artifact spell by paying life equal to its mana value?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        const mv = c.card.cmc || 0;
        if (await castFreeFrom(P, c)) { e_lose(P, mv); }
    },
    // Keleth, Sunmane Familiar
    e_keleth(P, e, t, src) {
        const list = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner === P.i && x.isCommander && onBf(x.uid));
        list.forEach(x => { const got = putCounters(x, 1, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); });
    },
    // Mishra, Claimed by Gix (the meld is not modelled)
    e_mishra(P, e, t, src) {
        const n = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner === P.i).length; if (n <= 0) return;
        foes(P).forEach(F => e_lose(F, n)); gainLifeFor(P, n);
    },
    // Adewale, Breaker of Chains
    async e_adewale(P, e, t, src) { await lookTopPick(P, 6, c => /\b(?:Assassin|Pirate|Vehicle)\b/.test(c.card.type), 'put an Assassin, Pirate, or Vehicle card into your hand', src); },
    // Ishkanah, Grafwidow
    async e_ishkanah(P, e, t, src) {
        const X = await e_oppOf(P, src, 'target opponent loses 1 life for each Spider you control'); if (!X) return;
        e_lose(X, P.bf.filter(x => hasType(x, 'Spider')).length);
    },
    // Evie Frye: loot; a discarded creature makes a creature unblockable
    async e_evie(P, e, t, src) {
        drawCards(P, 1);
        const d = await discardChosen(P, `${src.card.name}: discard a card`); if (!d) return;
        if (!/\bCreature\b/.test(d.card.type)) return;
        const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: target creature you control can't be blocked this turn`, { rank: (a, b) => pow(b) - pow(a) }); if (!x) return;
        x.tkw.push('unblockable'); log(`${x.card.name} can't be blocked this turn.`);
    },
    // Stiltzkin, Moogle Merchant
    async e_stiltzkin(P, e, t, src) {
        const X = await e_oppOf(P, src, 'target opponent gains control of another permanent you control'); if (!X) return;
        const pool = P.bf.filter(x => x !== src); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: choose another target permanent you control`, { rank: (a, b) => permValue(a) - permValue(b) }); if (!x) return;
        if (giveControl(x, X)) drawCards(P, 1);
    },
    // Kolaghan, the Storm's Fury
    e_kolaghan(P, e, t, src) { P.bf.filter(isCreature).forEach(x => { x.tp += 1; }); log('Creatures you control get +1/+0 until end of turn.'); },
    // Wyleth, Soul of Steel
    e_wyleth(P, e, t, src) {
        const n = attachmentsOf(src.uid).filter(a => /\b(?:Aura|Equipment)\b/.test(a.card.type)).length;
        if (n > 0) drawCards(P, n);
    },
    // Francisco, Fowl Marauder
    async e_francisco(P, e, t, src) { if (onBf(src.uid)) await applyEffect(P, { t: 'exploreSelf' }, null, src); },
    // Aatchik, Emerald Radian
    async e_aatchik(P, e, t, src) {
        const n = P.gy.filter(c => /\b(?:Artifact|Creature)\b/.test(c.card.type)).length; if (n <= 0) return;
        await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Insect', kw: [] }, null, src);
    },
    // Donatello, the Brains
    e_donatello(P, e, t, src) { G.e_mut = true; makeArtifactToken(P, 'mutagen'); G.e_mut = false; log(`${P.name} ${you(P) ? 'create' : 'creates'} a Mutagen token.`); },
    // Kaalia, Zenith Seeker
    async e_kaaliaZ(P, e, t, src) {
        const top = []; for (let i = 0; i < 6 && P.library.length; i++) top.push(P.library.pop());
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library.`);
        for (const w of ['Angel', 'Demon', 'Dragon']) {
            const pool = top.filter(c => new RegExp(`\\b${w}\\b`).test(c.card.type)); if (!pool.length) continue;
            const c = await pickOwn(P, pool, `${src.card.name}: reveal ${w === 'Angel' ? 'an' : 'a'} ${w} card and put it into your hand?`, { optional: true }); if (!c) continue;
            pull(top, c); P.hand.push(c); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name} and put${you(P) ? '' : 's'} it into ${you(P) ? 'your' : 'their'} hand.`);
        }
        P.library.unshift(...shuffle(top));
    },
    // Gut, True Soul Zealot
    async e_gut(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && (isCreature(x) || /\bArtifact\b/.test(x.card.type)));
        const x = await pickOwn(P, pool, `${src.card.name}: sacrifice another creature or an artifact to create a 4/1 Skeleton tapped and attacking?`, { optional: true, rank: (a, b) => permValue(a) - permValue(b) }); if (!x) return;
        sacPerm(P, x);
        await applyEffect(P, { t: 'token', n: 1, p: 4, q: 1, name: 'black Skeleton', kw: ['menace'], tapped: true, attacking: true }, null, src);
    },
    // Imskir Iron-Eater
    e_imskir(P, e, t, src) {
        const x = Math.floor(P.bf.filter(a => /\bArtifact\b/.test(a.card.type)).length / 2); if (x <= 0) return;
        drawCards(P, x); e_lose(P, x);
    },
    // Lily Bowen, Raging Grandma
    e_lily(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (pow(src) <= 16) { if (src.counters > 0) { const got = putCounters(src, src.counters, P); log(`${src.card.name} doubles its +1/+1 counters (${got} added).`); } }
        else if (src.counters > 1) { const r = src.counters - 1; src.counters = 1; log(`${src.card.name} loses ${r} +1/+1 counters.`); gainLifeFor(P, r); }
    },
    // Raiyuu, Storm's Edge
    e_raiyuu(P, e, t, src) {
        const x = ((G.ctxRaw && G.ctxRaw.list) || [])[0]; if (!x) return;
        x.tapped = false; log(`${x.card.name} untaps.`);
        if (!G.extraCombatOn) { G.extraCombat = (G.extraCombat || 0) + 1; log('There is an additional combat phase after this one.'); }
    },
    // Samut, Vizier of Naktamun
    e_samut(P, e, t, src) { drawCards(P, 1); },
    // Vendilion Clique
    async e_clique(P, e, t, src) {
        const all = G.players.filter(X => !X.out);
        let X = P; if (all.length > 1) { if (e_human(P)) X = all[await askMode(P, `${src.card.name}: look at target player's hand`, all.map(y => y.name))] || foes(P)[0]; else X = foes(P).slice().sort((a, b) => b.hand.length - a.hand.length)[0]; }
        const pool = X.hand.filter(c => !/\bLand\b/.test(c.card.type)); if (!pool.length) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at ${X.name === 'You' ? 'your' : `${X.name}'s`} hand.`);
        const c = await pickOwn(P, pool, `${src.card.name}: choose a nonland card (it goes to the bottom of the library)`, { optional: true, rank: (a, b) => X === P ? (a.card.cmc || 0) - (b.card.cmc || 0) : (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(X.hand, c); X.library.unshift(c); log(`${X.name} ${you(X) ? 'put' : 'puts'} ${c.card.name} on the bottom of ${you(X) ? 'your' : 'their'} library and draw${you(X) ? '' : 's'} a card.`);
        drawCards(X, 1);
    },
    // Krile Baldesion
    async e_krile(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; if (!sp || src.e_krile === G.turn) return;
        const mv = sp.card.cmc || 0;
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) === mv);
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${mv} to your hand?`, { optional: true }); if (!c) return;
        src.e_krile = G.turn; pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Storm, Force of Nature
    e_stormSet(P, e, t, src) { P.e_storm = G.turn; log('The next instant or sorcery spell you cast this turn has storm.'); },
    async e_stormCast(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; if (!o) return; P.e_storm = 0;
        const item = G.stack.find(i => i.o === o && i.kind === 'spell'); const n = (G.castThisTurn || 1) - 1;
        if (!item || n <= 0 || Rx(o).kw.has('storm')) return;
        log(`Storm: ${n} cop${n === 1 ? 'y' : 'ies'} of ${o.card.name}.`);
        for (let k = 0; k < n; k++) await copySpellItem(P, item, { retarget: true });
    },
    // Fire Lord Azula: copy a spell cast while it is attacking
    async e_azula(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; if (!o) return;
        const item = G.stack.find(i => i.o === o && i.kind === 'spell'); if (!item) return;
        await copySpellItem(P, item, { retarget: true });
    },
    // Mikey & Leo, Chaos & Order
    e_mikey(P, e, t, src) { drawCards(P, 1); },
    // Colfenor, the Last Yew
    async e_colfenor(P, e, t, src) {
        const lki = G.ctxRaw && G.ctxRaw.lki, dead = G.ctxRaw && G.ctxRaw.o;
        const tough = lki && lki.tou !== undefined ? lki.tou : (dead ? Number(dead.card.toughness) || 0 : 0);
        const pool = P.gy.filter(c => c !== dead && /\bCreature\b/.test(c.card.type) && (Number(c.card.toughness) || 0) < tough);
        const c = await pickOwn(P, pool, `${src.card.name}: return up to one creature card with lesser toughness to your hand?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Ayara, Widow of the Realm
    async e_ayara(P, e, t, src) {
        const X = G.lastSacMv || 0; if (X <= 0) return;
        const F = await e_oppOf(P, src, `target opponent takes ${X} damage`); if (!F) return;
        damage(F, X, src); gainLifeFor(P, X);
    },
    // Mr. Foxglove
    async e_foxglove(P, e, t, src) {
        const F = opp(P); if (!F) return;
        const n = F.hand.length - P.hand.length;
        if (n > 0) { drawCards(P, n); return; }
        const c = await pickOwn(P, P.hand.filter(x => /\bCreature\b/.test(x.card.type)), `${src.card.name}: put a creature card from your hand onto the battlefield?`, { optional: true }); if (!c) return;
        putOntoBattlefield(P, c);
    },
    // Surrak, Elusive Hunter / Altanak, the Thrice-Called
    e_surrak(P, e, t, src) { drawCards(P, 1); },
    e_altanak(P, e, t, src) { drawCards(P, 1); },
    // Denethor, Ruling Steward
    async e_denethor(P, e, t, src) {
        if (P.e_died !== G.turn) return;
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white Human Soldier', kw: [] }, null, src);
    },
    // Blech, Loafing Pest
    e_blech(P, e, t, src) { P.bf.filter(e_isPest).forEach(x => putCounters(x, 1, P)); },
    // Paladin Elizabeth Taggerdy
    async e_elizabeth(P, e, t, src) {
        drawCards(P, 1); const X = Math.max(0, pow(src));
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= X);
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature card with mana value ${X} or less onto the battlefield tapped and attacking?`, { optional: true }); if (!c) return;
        putOntoBattlefield(P, c, true); G.attackers.push(c.uid); if (src.atkTo !== undefined) c.atkTo = src.atkTo;
        log(`${c.card.name} enters tapped and attacking.`);
    },
    // Demonlord Belzenlok
    e_belzenlok(P, e, t, src) {
        let got = 0;
        for (let guard = 0; guard < 60; guard++) {
            let c = null;
            while (P.library.length) { const x = P.library.pop(); if (/\bLand\b/.test(x.card.type)) P.exile.push(x); else { c = x; break; } }
            if (!c) break;
            P.hand.push(c); got++; log(`${P.name} put${you(P) ? '' : 's'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand.`);
            if ((c.card.cmc || 0) < 4) break;
        }
        if (got > 0) { damage(P, got, src); }
    },
    // Casey Jones, Back Alley Brute
    async e_casey(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n <= 0) return;
        const F = await e_oppOf(P, src, `target opponent takes ${n} damage`); if (F) damage(F, n, src);
    },
    // Prime Speaker Vannifar
    async e_vannifar(P, e, t, src) {
        const mv = (G.lastSacMv || 0) + 1;
        await e_search(P, c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) === mv, `search for a creature card with mana value ${mv}`, src, 'bf');
    },
    // Mog, Moogle Warrior
    async e_mog(P, e, t, src) {
        let creature = false, noncreature = false;
        for (const X of G.players.filter(y => !y.out)) {
            if (!X.hand.length) continue;
            let yes;
            if (e_human(X)) yes = await askYes(X, `${src.card.name}: discard a card to draw a card?`, { card: src.card });
            else yes = X.hand.length >= 4 || X.hand.some(c => /\bLand\b/.test(c.card.type)) && X.bf.filter(l => /\bLand\b/.test(l.card.type)).length >= 6;
            if (!yes) continue;
            const d = await discardChosen(X, `${src.card.name}: discard a card`); if (!d) continue;
            if (/\bCreature\b/.test(d.card.type)) creature = true; else noncreature = true;
            drawCards(X, 1);
        }
        if (creature) await applyEffect(P, { t: 'token', n: 1, p: 1, q: 2, name: 'white Moogle', kw: ['lifelink'] }, null, src);
        if (noncreature) P.bf.filter(x => hasType(x, 'Moogle')).forEach(x => putCounters(x, 1, P));
    },
    // Paladin Danse, Steel Maverick (exile ~ as the cost)
    e_danse(P, e, t, src) {
        if (onBf(src.uid)) { leaveBattlefield(src, 'exile'); log(`${src.card.name} is exiled.`); }
        const ok = P.bf.filter(x => isCreature(x) && (/\bArtifact\b/.test(x.card.type) || hasType(x, 'Human')));
        ok.forEach(x => x.tkw.push('indestructible')); log(`${ok.length} creature${ok.length === 1 ? '' : 's'} gain${ok.length === 1 ? 's' : ''} indestructible until end of turn.`);
    },
    // Siegfried, Famed Swordsman
    e_siegfried(P, e, t, src) {
        const milled = P.library.splice(-3).reverse(); P.gy.push(...milled); log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.length}.`);
        const x = 2 * P.gy.filter(c => /\bCreature\b/.test(c.card.type)).length;
        if (x > 0 && onBf(src.uid)) { const got = putCounters(src, x, P); log(`${src.card.name} gets ${got} +1/+1 counters.`); }
    },
    // Qala, Ajani's Pridemate
    e_qala(P, e, t, src) {
        const n = e_nctr(src); if (n <= 0) return;
        ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x !== src && x.owner === P.i && onBf(x.uid)).forEach(x => { x.tp += n; });
        log(`Other attacking creatures get +${n}/+0 until end of turn.`);
    },
    // Eowyn, Lady of Rohan
    async e_eowyn(P, e, t, src) {
        const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: target creature gains first strike or vigilance`, { rank: (a, b) => pow(b) - pow(a) }); if (!x) return;
        const eq = attachmentsOf(x.uid).some(a => /\bEquipment\b/.test(a.card.type));
        let first = true, vig = false;
        if (eq) vig = true;
        else if (e_human(P)) { const i = await askMode(P, `${src.card.name}: ${x.card.name} gains`, ['First strike', 'Vigilance']); if (i === 1) { first = false; vig = true; } }
        else if (has(x, 'first strike')) { first = false; vig = true; }
        if (first) x.tkw.push('first strike'); if (vig) x.tkw.push('vigilance');
        log(`${x.card.name} gains ${first ? 'first strike' : ''}${first && vig ? ' and ' : ''}${vig ? 'vigilance' : ''} until end of turn.`);
    },
    // Bilbo, Birthday Celebrant: exile ~, then any number of creature cards from the library onto the battlefield
    async e_bilbo(P, e, t, src) {
        if (onBf(src.uid)) { leaveBattlefield(src, 'exile'); log(`${src.card.name} is exiled.`); }
        const cs = P.library.filter(c => /\bCreature\b/.test(c.card.type));
        cs.forEach(c => { pull(P.library, c); putOntoBattlefield(P, c); });
        shuffleLib(P); log(`${P.name} put${you(P) ? '' : 's'} ${cs.length} creature card${cs.length === 1 ? '' : 's'} onto the battlefield.`);
    }
});
