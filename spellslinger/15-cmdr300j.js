// Engine pieces for commander round 4, batch j (2026-10-26). Wordings are in rules/cmdr300j.js; each odd card is a CMD entry (ids start with j_).
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.
// Reuses gOpp / gMakeToken / gLose / gCastFromGy from 15-cmdr300g.js.

const jAI = P => P.isAI || AUTOPLAY;
const jCtr = o => o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0);
const jIsCreatureCard = c => /\bCreature\b/.test(c.card.type);
const jTopGone = (P, cards) => P.library.unshift(...shuffle(cards.slice())); // the rest go on the bottom in a random order
// A creature enters tapped and attacking (attack target copied from the attacker that caused it)
function jEnterAttacking(P, c, src) {
    putOntoBattlefield(P, c, true); G.attackers.push(c.uid); if (src && src.atkTo !== undefined) c.atkTo = src.atkTo;
    log(`${c.card.name} enters tapped and attacking.`);
}
// Cards drawn this turn (Kydele)
{
    const base = drawCards;
    drawCards = function (P, n, quiet) {
        const before = P.hand.length; const r = base.apply(this, arguments);
        const got = P.hand.length - before;
        if (got > 0 && G) { if (P.j_drawT !== G.turn) { P.j_drawT = G.turn; P.j_drawN = 0; } P.j_drawN += got; }
        return r;
    };
}
STATIC_FN.j_hasCounter = o => jCtr(o);
COUNT_EXTRA.push([/^j_ulasht$/, () => o => G.players[o.owner].bf.filter(x => x !== o && isCreature(x) && ((x.card.colors || []).includes('R') || (x.card.colors || []).includes('G'))).reduce((s, x) => s + ((x.card.colors || []).includes('R') ? 1 : 0) + ((x.card.colors || []).includes('G') ? 1 : 0), 0)]);

Object.assign(TRIG_FN, {
    j_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    j_urzaDisc: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && /\bArtifact\b/.test(ctx.o.card.type) && ctx.P.j_discT !== G.turn && (ctx.P.j_discT = G.turn) > 0,
    j_mishraDisc: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && /\bArtifact\b/.test(ctx.o.card.type) && ctx.P.j_discT2 !== G.turn && (ctx.P.j_discT2 = G.turn) > 0,
    j_oyobi: (o, ctx) => ctx.P.i === o.owner && /\b(Spirit|Arcane)\b/.test(ctx.o.card.type),
    j_psem: (o, ctx) => ctx.P.i === o.owner && /\bEnchantment\b/.test(ctx.o.card.type) && ctx.P.j_psemT !== G.turn && (ctx.P.j_psemT = G.turn) > 0,
    j_oppCreatureDies: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner,
    j_myUpkeep: (o, ctx) => G.active === o.owner,
    j_anyUpkeep: (o, ctx) => true,
    j_myEnd: (o, ctx) => G.active === o.owner,
    j_rhinoCast: (o, ctx) => { if (ctx.P.i === o.owner && (ctx.o.card.cmc || 0) >= 4) ctx.P.j_bigCast = G.turn; return false; },
    j_raffCast: (o, ctx) => ctx.P.i === o.owner && /\b(Instant|Sorcery)\b/.test(ctx.o.card.type),
    j_nikara: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && /\bCreature\b/.test(ctx.o.card.type) && ((ctx.o.lastCounters || 0) > 0 || ctx.o.counters > 0 || Object.values(ctx.o.ctr || {}).some(v => v > 0)),
    j_dwarfHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Dwarf') && (ctx.hit || []).some(X => X.i !== o.owner),
    j_heroHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Hero') && (ctx.hit || []).some(X => X.i !== o.owner),
    j_selfHit: (o, ctx) => ctx.src === o && (ctx.hit || []).some(X => X.i !== o.owner),
    j_enchEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bEnchantment\b/.test(ctx.o.card.type),
    j_myCast: (o, ctx) => ctx.P.i === o.owner,
    j_cascadeCast: (o, ctx) => ctx.P.i === o.owner && Rx(ctx.o).kw.has('cascade'),
    j_orahDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Cleric'),
    j_insects: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Insect')),
    j_enchAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && (/\bEnchantment\b/.test(x.card.type) || allPerms().some(a => a.attachedTo === x.uid && /\bAura\b/.test(a.card.type)))),
    j_vogar: (o, ctx) => G.active === o.owner && !!ctx.o && ctx.o !== o,
    j_edea: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ctx.o.realOwner !== undefined && ctx.o.realOwner !== o.owner && !ctx.o.token && ((ctx.o.j_edeaOwner = ctx.o.realOwner) !== undefined)
});
Object.assign(CMD_SCORE, { j_bolas: () => 6, j_capar: () => 5, j_geist: () => 7, j_kydele: () => 3, j_shadowfax: () => 8, j_sally: () => 6, j_jirina: () => 3, j_gregor: () => 6, j_jet: () => 7, j_ryan: () => 6, j_rufus: () => 4, j_toshiro: () => 5, j_nath: () => 3, j_vargus: () => 4, j_jorn: () => 3, j_sami: () => 4, j_mai: () => 5, j_rhino: () => 3, j_karvanista: () => 4, j_raff: () => 3, j_bosco: () => 3, j_wilfred: () => 5, j_nikara: () => 3, j_rulik: () => 5, j_torsten: () => 6, j_mishra: () => 2, j_muzzio: () => 6, j_eutropia: () => 4, j_arjun: () => 4, j_brigid: () => 5, j_pol: () => 5, j_ashling: () => 7, j_orah: () => 6, j_vrestin: () => 5, j_kestia: () => 3, j_pia: () => 3, j_shizuko: () => 4, j_vogar: () => 3, j_cait: () => 4, j_doctor1: () => 3, j_atris: () => 5, j_urza: () => 3, j_edea: () => 5 });

// Hits: players that were hit this combat-damage event, other than the controller
const jHit = P => ((G.ctxRaw && G.ctxRaw.hit) || []).filter(X => X !== P && !X.out);
// Lowest-life or chosen opponent target for "target opponent/player"
Object.assign(CMD, {
    // Nicol Bolas: the damaged opponent discards their hand
    j_bolas(P, e, t, src) {
        for (const X of jHit(P)) {
            const n = X.hand.length; if (!n) continue;
            X.hand.forEach(c => { c.discardTurn = G.turn; }); X.gy.push(...X.hand.splice(0)); noteDiscard(X, n);
            log(`${X.name} ${you(X) ? 'discard' : 'discards'} their hand (${n} card${n === 1 ? '' : 's'}).`);
        }
    },
    // Caparocti Sunborn: tap two untapped artifacts and/or creatures to discover 3
    async j_capar(P, e, t, src) {
        const pool = P.bf.filter(x => !x.tapped && (isCreature(x) || /\bArtifact\b/.test(x.card.type)));
        if (pool.length < 2) return;
        const yes = jAI(P) ? pool.length >= 3 : await askYes(P, `${src.card.name}: tap two untapped artifacts and/or creatures to discover 3?`, { card: src.card });
        if (!yes) return;
        const cheap = pool.slice().sort((a, b) => permValue(a) - permValue(b));
        const a = jAI(P) ? cheap[0] : await pickOwn(P, pool, `${src.card.name}: tap the first one`, { rank: (x, y) => permValue(x) - permValue(y) });
        const rest = pool.filter(x => x !== a);
        const b = jAI(P) ? cheap.filter(x => x !== a)[0] : await pickOwn(P, rest, `${src.card.name}: tap the second one`, { rank: (x, y) => permValue(x) - permValue(y) });
        if (!a || !b) return;
        a.tapped = true; b.tapped = true; log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${a.card.name} and ${b.card.name}.`);
        await cascade(P, src, 3);
    },
    // Urza, Powerstone Prodigy
    j_urza(P, e, t, src) { const p = makeArtifactToken(P, 'powerstone'); p.tapped = true; log(`${P.name} ${you(P) ? 'create' : 'creates'} a tapped Powerstone token.`); },
    // Mishra, Excavation Prodigy
    j_mishra(P, e, t, src) { P.pool = (P.pool || []).concat(['R', 'R']); log(`${P.name} ${you(P) ? 'add' : 'adds'} {R}{R}.`); },
    // Geist of Saint Traft: a 4/4 flying Angel enters tapped and attacking, exiled at end of combat
    j_geist(P, e, t, src) {
        const tok = gMakeToken(P, 'Angel', 'Token Creature — Angel', 'Flying', ['W'], [4, 4]);
        tok.tapped = false; putAttacking(tok, src); tok.sacEndCombat = true;
    },
    // Kydele: add {C} for each card drawn this turn
    j_kydele(P, e, t, src) {
        const n = P.j_drawT === G.turn ? P.j_drawN : 0; if (!n) return;
        P.pool = (P.pool || []).concat(Array(n).fill('C')); log(`${P.name} ${you(P) ? 'add' : 'adds'} ${'{C}'.repeat(n)}.`);
    },
    // Shadowfax: a creature card with lesser power from hand enters tapped and attacking
    async j_shadowfax(P, e, t, src) {
        const pool = P.hand.filter(c => jIsCreatureCard(c) && Number(c.card.power) < pow(src));
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature card with lesser power onto the battlefield attacking?`, { optional: true }); if (!c) return;
        pull(P.hand, c); jEnterAttacking(P, c, src);
    },
    // Sally Pride: X 2/2 red Mutant tokens, X = nontoken creatures you control
    async j_sally(P, e, t, src) { const x = P.bf.filter(y => isCreature(y) && !y.token).length; if (x > 0) await applyEffect(P, { t: 'token', n: x, p: 2, q: 2, name: 'red Mutant', kw: [] }, null, src); },
    // Jirina Kudro: a 1/1 Human Soldier for each time you've cast a commander from the command zone
    async j_jirina(P, e, t, src) { const x = commanderCasts(P); if (x > 0) await applyEffect(P, { t: 'token', n: x, p: 1, q: 1, name: 'white Human Soldier', kw: [] }, null, src); },
    j_gregor(P, e, t, src) { if (onBf(src.uid) || true) drawCards(P, Math.max(0, pow(src))); },
    // Jet, Rebel Leader: look at the top five, a creature card with mana value 3 or less enters tapped and attacking
    async j_jet(P, e, t, src) {
        const top = []; for (let i = 0; i < 5 && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => jIsCreatureCard(c) && (c.card.cmc || 0) <= 3 && Rx(c).support !== 'none');
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature card with mana value 3 or less onto the battlefield attacking?`, { optional: true });
        jTopGone(P, top.filter(x => x !== c));
        if (c) jEnterAttacking(P, c, src);
    },
    // Ryan Sinclair: exile until a nonland card; cast it free if its mana value is at most his power
    async j_ryan(P, e, t, src) {
        const seen = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); seen.push(c); P.exile.push(c); if (!/\bLand\b/.test(c.card.type)) { hit = c; break; } }
        log(`${P.name} exile${you(P) ? '' : 's'} ${seen.map(c => c.card.name).join(', ')}.`);
        let cast = false;
        if (hit && Rx(hit).kind !== 'land' && (hit.card.cmc || 0) <= pow(src)) {
            const yes = jAI(P) ? true : await askYes(P, `${src.card.name}: cast ${hit.card.name} without paying its mana cost?`, { card: hit.card });
            if (yes) cast = !!(await castFreeFrom(P, hit));
        }
        const rest = seen.filter(c => !(cast && c === hit)).filter(c => P.exile.includes(c));
        rest.forEach(c => pull(P.exile, c)); jTopGone(P, rest);
    },
    // Rufus Shinra: Darkstar token if you don't control a creature named Darkstar
    j_rufus(P, e, t, src) {
        if (P.bf.some(x => x.card.name === 'Darkstar')) return;
        gMakeToken(P, 'Darkstar', 'Token Legendary Creature — Dog', '', ['W', 'B'], [2, 2]);
    },
    // Toshiro Umezawa: cast target instant card from your graveyard (exiled instead of going to the graveyard)
    async j_toshiro(P, e, t, src) {
        const pool = P.gy.filter(c => /\bInstant\b/.test(c.card.type) && Rx(c).support !== 'none' && canPay(P, c));
        const c = await pickOwn(P, pool, `${src.card.name}: cast an instant card from your graveyard?`, { optional: true }); if (!c) return;
        await gCastFromGy(P, P, c, src, true);
    },
    // Psemilla, Meletian Poet: a 2/2 white Nymph enchantment creature token
    j_psem(P, e, t, src) { gMakeToken(P, 'Nymph', 'Token Enchantment Creature — Nymph', '', ['W'], [2, 2]); },
    // Nath of the Gilt-Leaf: target opponent discards a card at random
    async j_nath(P, e, t, src) {
        const yes = jAI(P) ? true : await askYes(P, `${src.card.name}: have target opponent discard a card at random?`, { card: src.card }); if (!yes) return;
        const F = await gOpp(P, `${src.card.name}: which opponent discards a card at random?`); if (!F || !F.hand.length) return;
        const c = F.hand[rand(F.hand.length)]; pull(F.hand, c); F.gy.push(c); c.discardTurn = G.turn; noteDiscard(F, 1);
        log(`${F.name} ${you(F) ? 'discard' : 'discards'} ${c.card.name} at random.`);
    },
    // Captain Vargus Wrath: Pirates get +1/+1 for each time you've cast a commander from the command zone
    j_vargus(P, e, t, src) {
        const n = commanderCasts(P); if (!n) return;
        P.bf.filter(x => isCreature(x) && hasType(x, 'Pirate')).forEach(x => { x.tp += n; x.tq += n; });
        log(`Pirates ${P.name} ${you(P) ? 'control' : 'controls'} get +${n}/+${n} until end of turn.`);
    },
    // Jorn: untap each snow permanent you control
    j_jorn(P, e, t, src) { const s = P.bf.filter(x => /\bSnow\b/.test(x.card.type) && x.tapped); s.forEach(x => { x.tapped = false; }); if (s.length) log(`${P.name} untap${you(P) ? '' : 's'} ${s.length} snow permanent${s.length === 1 ? '' : 's'}.`); },
    // Sami, Ship's Engineer
    j_sami(P, e, t, src) {
        if (P.bf.filter(x => isCreature(x) && x.tapped).length < 2) return;
        const r = gMakeToken(P, 'Robot', 'Token Artifact Creature — Robot', '', [], [2, 2]); r.tapped = true;
    },
    // Mai, Jaded Edge: a double strike counter
    j_mai(P, e, t, src) { if (!onBf(src.uid)) return; src.ctr = src.ctr || {}; src.ctr['double strike'] = (src.ctr['double strike'] || 0) + 1; log(`${src.card.name} gets a double strike counter.`); },
    // Rhino, Barreling Brute: draw if you've cast a spell with mana value 4 or greater this turn
    j_rhino(P, e, t, src) { if (P.j_bigCast === G.turn) drawCards(P, 1); },
    // Karvanista: a +1/+1 counter on each Human you control
    j_karvanista(P, e, t, src) { P.bf.filter(x => isCreature(x) && hasType(x, 'Human')).forEach(x => putCounters(x, 1, P)); },
    // Raff, Weatherlight Stalwart: tap two untapped creatures to draw
    async j_raff(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && !x.tapped); if (pool.length < 2) return;
        const yes = jAI(P) ? G.active === P.i : await askYes(P, `${src.card.name}: tap two untapped creatures you control to draw a card?`, { card: src.card });
        if (!yes) return;
        const a = await pickOwn(P, pool, `${src.card.name}: tap the first creature`, { rank: (x, y) => permValue(x) - permValue(y) });
        const b = await pickOwn(P, pool.filter(x => x !== a), `${src.card.name}: tap the second creature`, { rank: (x, y) => permValue(x) - permValue(y) });
        if (!a || !b) return;
        a.tapped = true; b.tapped = true; log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${a.card.name} and ${b.card.name}.`); drawCards(P, 1);
    },
    // Bosco, Just a Bear: a Food for each legendary creature you control
    async j_bosco(P, e, t, src) { const n = P.bf.filter(x => isCreature(x) && /\bLegendary\b/.test(x.card.type)).length; if (n > 0) await applyEffect(P, { t: 'artToken', kind: 'food', n }, null, src); },
    // Wilfred Mott: a time counter, then look at that many cards and put a nonland permanent with mana value 3 or less onto the battlefield
    async j_wilfred(P, e, t, src) {
        if (!onBf(src.uid)) return; src.ctr = src.ctr || {}; src.ctr.time = (src.ctr.time || 0) + 1; const x = src.ctr.time;
        const top = []; for (let i = 0; i < x && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => !/\bLand\b/.test(c.card.type) && (c.card.cmc || 0) <= 3 && Rx(c).support !== 'none');
        const c = await pickOwn(P, pool, `${src.card.name}: put a nonland permanent with mana value 3 or less onto the battlefield?`, { optional: true });
        jTopGone(P, top.filter(y => y !== c));
        if (c) { putOntoBattlefield(P, c); log(`${c.card.name} enters the battlefield.`); }
    },
    // Nikara, Lair Scavenger
    j_nikara(P, e, t, src) { drawCards(P, 1); gLose(P, 1); },
    // Thorin, Company's Leader
    async j_thorin(P, e, t, src) { await applyEffect(P, { t: 'artToken', kind: 'treasure', n: 2 }, null, src); },
    // The Thing, Ben Grimm
    j_thing(P, e, t, src) { if (onBf(src.uid)) { const got = putCounters(src, 2, P); log(`${src.card.name} gets ${got} +1/+1 counters.`); } },
    // Rulik Mons: a land from the top enters tapped, otherwise a 1/1 Goblin
    async j_rulik(P, e, t, src) {
        const top = P.library[P.library.length - 1]; if (!top) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top card of ${you(P) ? 'your' : 'their'} library: ${top.card.name}.`);
        let put = false;
        if (/\bLand\b/.test(top.card.type)) {
            const yes = jAI(P) ? true : await askYes(P, `${src.card.name}: put ${top.card.name} onto the battlefield tapped?`, { card: top.card });
            if (yes) { P.library.pop(); putOntoBattlefield(P, top, true); put = true; log(`${top.card.name} enters tapped.`); }
        }
        if (!put) await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'red Goblin', kw: [] }, null, src);
    },
    // Torsten: reveal the top seven, creature and land cards to hand
    j_torsten(P, e, t, src) {
        const top = []; for (let i = 0; i < 7 && P.library.length; i++) top.push(P.library.pop());
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.map(c => c.card.name).join(', ')}.`);
        const take = top.filter(c => jIsCreatureCard(c) || /\bLand\b/.test(c.card.type));
        take.forEach(c => P.hand.push(c));
        if (take.length) log(`${P.name} put ${take.length} card${take.length === 1 ? '' : 's'} into ${you(P) ? 'your' : 'their'} hand.`);
        jTopGone(P, top.filter(c => !take.includes(c)));
    },
    // Muzzio: look at the top X (greatest mana value among your artifacts), an artifact onto the battlefield
    async j_muzzio(P, e, t, src) {
        const x = Math.max(0, ...P.bf.filter(y => /\bArtifact\b/.test(y.card.type)).map(y => y.card.cmc || 0)); if (!x) return;
        const top = []; for (let i = 0; i < x && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => /\bArtifact\b/.test(c.card.type) && Rx(c).support !== 'none');
        const c = await pickOwn(P, pool, `${src.card.name}: put an artifact card onto the battlefield?`, { optional: true });
        jTopGone(P, top.filter(y => y !== c));
        if (c) { putOntoBattlefield(P, c); log(`${c.card.name} enters the battlefield.`); }
    },
    // Eutropia the Twice-Favored: a +1/+1 counter on target creature, which gains flying until end of turn
    async j_eutropia(P, e, t, src) {
        const pool = allPerms().filter(isCreature); if (!pool.length) return;
        const mine = pool.filter(x => x.owner === P.i);
        const x = jAI(P) ? (mine.sort((a, b) => permValue(b) - permValue(a))[0] || pool[0]) : await pickOwn(P, pool, `${src.card.name}: put a +1/+1 counter on target creature`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (!x) return; putCounters(x, 1, P); x.tkw.push('flying'); log(`${x.card.name} gets a +1/+1 counter and gains flying until end of turn.`);
    },
    // Arjun, the Shifting Flame: put your hand on the bottom of your library, then draw that many
    j_arjun(P, e, t, src) {
        const n = P.hand.length; if (!n) return;
        P.library.unshift(...shuffle(P.hand.splice(0))); log(`${P.name} put ${n} card${n === 1 ? '' : 's'} from ${you(P) ? 'your' : 'their'} hand on the bottom of ${you(P) ? 'your' : 'their'} library, then draw${you(P) ? '' : 's'} that many.`);
        drawCards(P, n);
    },
    // Brigid, Hero of Kinsbaile: 2 damage to each attacking or blocking creature target player controls
    async j_brigid(P, e, t, src) {
        const F = await gOpp(P, `${src.card.name}: which player's attacking and blocking creatures take 2 damage?`); if (!F) return;
        const blockers = new Set(Object.values(G.blocks || {}).flat());
        const hit = F.bf.filter(x => isCreature(x) && ((G.attackers || []).includes(x.uid) || blockers.has(x.uid)));
        hit.forEach(x => damage(x, 2, src)); if (hit.length) log(`${src.card.name} deals 2 damage to each attacking or blocking creature ${F.name} controls.`);
    },
    // Pol Jamaar, Illusionist: choose a creature type, draw a card for each creature you control of that type
    async j_pol(P, e, t, src) {
        const types = {}; P.bf.filter(isCreature).forEach(x => ((x.card.type.split('—')[1] || '').trim().split(/\s+/).filter(Boolean)).forEach(w => { types[w] = (types[w] || 0) + 1; }));
        const names = Object.keys(types).sort((a, b) => types[b] - types[a]); if (!names.length) return;
        const ty = jAI(P) || names.length === 1 ? names[0] : names[await askMode(P, `${src.card.name}: choose a creature type`, names.map(w => `${w} (${types[w]})`))] || names[0];
        const n = P.bf.filter(x => isCreature(x) && hasType(x, ty)).length; log(`${P.name} ${you(P) ? 'choose' : 'chooses'} ${ty}.`); if (n) drawCards(P, n);
    },
    // Ashling, the Extinguisher: the player sacrifices a creature you choose
    async j_ashling(P, e, t, src) {
        for (const X of jHit(P)) {
            const pool = X.bf.filter(isCreature); if (!pool.length) continue;
            const c = await pickOwn(P, pool, `${src.card.name}: choose a creature ${X.name} controls; they sacrifice it`, { rank: (a, b) => permValue(b) - permValue(a) });
            if (c) sacPerm(X, c);
        }
    },
    // Orah, Skyclave Hierophant
    async j_orah(P, e, t, src) {
        const d = G.ctxRaw && G.ctxRaw.o; if (!d) return; const lim = d.card.cmc || 0;
        const pool = P.gy.filter(c => jIsCreatureCard(c) && /\bCleric\b/.test(c.card.type) && (c.card.cmc || 0) < lim && Rx(c).support !== 'none');
        const c = await pickOwn(P, pool, `${src.card.name}: return a Cleric card with lesser mana value to the battlefield`, { optional: false });
        if (!c) return; pull(P.gy, c); putOntoBattlefield(P, c); log(`${c.card.name} returns to the battlefield.`);
    },
    // Vrestin, Menoptra Leader: a +1/+1 counter on each attacking Insect
    j_vrestin(P, e, t, src) { ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner === P.i && hasType(x, 'Insect') && onBf(x.uid)).forEach(x => putCounters(x, 1, P)); },
    // Kestia, the Cultivator: draw a card for each enchanted creature or enchantment creature that attacks
    j_kestia(P, e, t, src) {
        const n = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner === P.i && (/\bEnchantment\b/.test(x.card.type) || allPerms().some(a => a.attachedTo === x.uid && /\bAura\b/.test(a.card.type)))).length;
        if (n) drawCards(P, n);
    },
    // Pia Nalaar: target artifact creature gets +1/+0 until end of turn
    async j_pia(P, e, t, src) {
        const pool = allPerms().filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)); if (!pool.length) return;
        const mine = pool.filter(x => x.owner === P.i);
        const x = jAI(P) ? (mine.sort((a, b) => permValue(b) - permValue(a))[0] || pool[0]) : await pickOwn(P, pool, `${src.card.name}: target artifact creature gets +1/+0`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (x) { x.tp += 1; log(`${x.card.name} gets +1/+0 until end of turn.`); }
    },
    // Shizuko, Caller of Autumn: the active player adds {G}{G}{G}, which stays until end of turn
    j_shizuko(P, e, t, src) {
        const X = G.players[G.active]; if (!X || X.out) return;
        X.pool = (X.pool || []).concat(['G', 'G', 'G']); X.keepPoolTurn = G.turn; log(`${X.name} ${you(X) ? 'add' : 'adds'} {G}{G}{G} (it stays until end of turn).`);
    },
    // Vogar, Necropolis Tyrant
    j_vogar(P, e, t, src) { if (onBf(src.uid)) { const got = putCounters(src, 1, P); log(`${src.card.name} gets ${got} +1/+1 counter.`); } },
    // Cait, Cage Brawler: you and the defending player each draw then discard; two counters if you discarded the highest mana value
    async j_cait(P, e, t, src) {
        const D = src.atkTo !== undefined ? G.players[src.atkTo] : opp(P); if (!D || D.out) return;
        drawCards(P, 1); drawCards(D, 1);
        const a = await discardChosen(P, `${src.card.name}: discard a card`);
        const b = await discardChosen(D, `${src.card.name}: discard a card`);
        const mine = a ? (a.card.cmc || 0) : -1, theirs = b ? (b.card.cmc || 0) : -1;
        if (a && mine >= theirs && onBf(src.uid)) { const got = putCounters(src, 2, P); log(`${src.card.name} gets ${got} +1/+1 counters.`); }
    },
    // The First Doctor: a +1/+1 counter on target artifact or creature when you cast a spell with cascade
    async j_doctor1(P, e, t, src) {
        const pool = allPerms().filter(x => isCreature(x) || /\bArtifact\b/.test(x.card.type)); if (!pool.length) return;
        const mine = pool.filter(x => x.owner === P.i);
        const x = jAI(P) ? (mine.sort((a, b) => permValue(b) - permValue(a))[0] || pool[0]) : await pickOwn(P, pool, `${src.card.name}: put a +1/+1 counter on target artifact or creature`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (x) { putCounters(x, 1, P); log(`${x.card.name} gets a +1/+1 counter.`); }
    },
    // Atris, Oracle of Half-Truths: target opponent separates the top three cards into a face-down and a face-up pile; one pile to hand, the other to graveyard
    async j_atris(P, e, t, src) {
        const top = []; for (let i = 0; i < 3 && P.library.length; i++) top.push(P.library.pop()); if (!top.length) return;
        const sorted = top.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0));
        const up = [sorted[0]], down = sorted.slice(1);
        const val = L => L.reduce((s, c) => s + 1 + (c.card.cmc || 0), 0);
        let pickUp;
        if (jAI(P)) pickUp = val(up) >= val(down); else pickUp = (await askMode(P, `${src.card.name}: choose a pile for your hand (the other goes to your graveyard)`, [`Face-up pile: ${up.map(c => c.card.name).join(', ')}`, `Face-down pile: ${down.length} card${down.length === 1 ? '' : 's'}`])) === 0;
        const keep = pickUp ? up : down, bin = pickUp ? down : up;
        keep.forEach(c => P.hand.push(c)); bin.forEach(c => P.gy.push(c));
        log(`${P.name} put ${keep.map(c => c.card.name).join(', ') || 'nothing'} into ${you(P) ? 'your' : 'their'} hand and ${bin.map(c => c.card.name).join(', ') || 'nothing'} into the graveyard.`);
    },
    // Edea, Possessed Sorceress: a creature you control but don't own dies; it returns under its owner's control and you draw
    j_edea(P, e, t, src) {
        const d = G.ctxRaw && G.ctxRaw.o; if (!d || d.j_edeaOwner === undefined) return;
        const H = G.players[d.j_edeaOwner]; delete d.j_edeaOwner; if (!H || !H.gy.includes(d)) return;
        pull(H.gy, d); d.owner = H.i; delete d.realOwner; putOntoBattlefield(H, d); log(`${d.card.name} returns to the battlefield under ${H.name === 'You' ? 'your' : H.name + "'s"} control.`); drawCards(P, 1);
    }
});
function putAttacking(c, src) { if (!G.attackers.includes(c.uid)) G.attackers.push(c.uid); c.tapped = true; if (src && src.atkTo !== undefined) c.atkTo = src.atkTo; log(`${c.card.name} is tapped and attacking.`); }
