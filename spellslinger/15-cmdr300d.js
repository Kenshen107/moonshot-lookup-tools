// Spellslinger Duels - engine pieces for commander round 2 (batch d). Plain script, loaded after 15k-cmdr300.js. Use unique names (prefix them) so nothing overrides another file.

const dMine = P => P.bf.filter(isCreature);
const dIsAI = P => P.isAI || AUTOPLAY;
const dShrines = P => P.bf.filter(x => hasType(x, 'Shrine')).length;
const dLife = P => (P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0);
const dGyBack = (P, c) => { pull(P.gy, c); return c; };
// Exile `c` (from library of H) so P may cast it this turn without paying
function dFreeExile(P, H, c) { exilePlayFrom(P, H, c, G.turn); c.freeCast = true; }

Object.assign(TRIG_FN, {
    d_hitsMe: (o, ctx) => !!ctx.src && ctx.src.owner !== o.owner && (ctx.hit || []).some(H => H.i === o.owner),
    d_birdsAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Bird')),
    d_myTurn: (o, ctx) => G.active === o.owner,
    d_always: () => true,
    d_foeShrunkDies: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && !ctx.o.token && (ctx.o.counters || 0) < 0,
    d_firstOffTurn: (o, ctx) => { const P = ctx.P; if (!P || P.i !== o.owner || G.active === P.i) return false; if (P.offCastTurn === G.turn) return false; P.offCastTurn = G.turn; return true; },
    d_castX: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && !!Rx(ctx.o).cost.x,
    d_myCounteredDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && (ctx.o.counters || 0) > 0,
    d_suki: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && G.active === o.owner,
    d_clueFood: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && (hasType(ctx.o, 'Clue') || hasType(ctx.o, 'Food')),
});
COND_EXTRA.push(
    [/^there are four or more card types among cards in your graveyard$/, () => P => new Set(P.gy.flatMap(c => ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Instant', 'Sorcery', 'Battle', 'Kindred'].filter(w => new RegExp(`\\b${w}\\b`).test(c.card.type)))).size >= 4]
);
Object.assign(CMD_SCORE, { d_terra: () => 5, d_grimgrin: () => 8, d_aerith: () => 5, d_redDeath: () => 3, d_armix: () => 3, d_combustion: () => 5, d_inferno: () => 1 });

Object.assign(CMD, {
    async d_terra(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (Number(c.card.power) || 0) <= 3); if (!pool.length) return;
        if (!(await mayPay(P, '{2}', `${src.card.name}: pay {2} to return a creature card with power 3 or less from your graveyard to the battlefield tapped?`, src, true))) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with power 3 or less`, {}); if (!c) return;
        reanimateFrom(P, P, c); c.tapped = true;
    },
    async d_wrexial(P, e, t, src) {
        for (const H of hitList()) {
            const pool = H.gy.filter(c => /\b(Instant|Sorcery)\b/.test(c.card.type)); if (!pool.length) continue;
            const c = await pickOwn(P, pool, `${src.card.name}: cast an instant or sorcery card from ${H.name}'s graveyard without paying its mana cost?`, { optional: true }); if (!c) continue;
            pull(H.gy, c); c.realOwner = H.i; c.owner = P.i; c.freeCast = true; c.playUntil = G.turn; P.exile.push(c);
            log(`${P.name} may cast ${c.card.name} from ${H.name}'s graveyard without paying its mana cost.`);
        }
    },
    async d_cruelclaw(P, e, t, src) {
        let c = null; const skipped = [];
        while (P.library.length) { const x = P.library.pop(); if (/\bLand\b/.test(x.card.type)) { P.exile.push(x); skipped.push(x); continue; } c = x; break; }
        if (!c) return; P.exile.push(c); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${c.card.name}.`);
        if (!P.hand.length) return;
        const yes = dIsAI(P) ? true : await askYes(P, `${src.card.name}: discard a card to cast ${c.card.name} without paying its mana cost?`, { card: c.card });
        if (!yes) return;
        await discardChosen(P, `${src.card.name}: discard a card`); c.freeCast = true; c.playUntil = G.turn;
        log(`${P.name} may cast ${c.card.name} this turn.`);
    },
    d_kotis(P, e, t, src) {
        const X = (G.ctxRaw && G.ctxRaw.n) || 0; if (X <= 0) return;
        for (const H of hitList()) for (let i = 0; i < X && H.library.length; i++) { const c = H.library.pop(); if (!/\bLand\b/.test(c.card.type) && (c.card.cmc || 0) <= X) dFreeExile(P, H, c); else { H.exile.push(c); log(`${c.card.name} is exiled.`); } }
    },
    d_piper(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0) applyEffect(P, { t: 'artToken', kind: 'clue', n }, null, src); },
    d_elsha(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'white Monk', kw: ['prowess'] }, null, src); },
    d_bladewing(P, e, t, src) { const n = P.gy.filter(c => /\bCreature\b/.test(c.card.type)).length; if (n > 0) applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'black Zombie Knight', kw: ['menace'] }, null, src); },
    d_marcus(P, e, t, src) {
        const s = rawSrc(); if (!s || !onBf(s.uid)) return;
        if (s.counters > 0) drawCards(P, 1); else { const got = putCounters(s, 1, P); log(`${s.card.name} gets ${got} +1/+1 counter.`); }
    },
    async d_teysa(P, e, t, src) {
        const s = rawSrc(); if (s && onBf(s.uid)) { log(`${s.card.name} is destroyed (${src.card.name}).`); destroy(s); }
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white black Spirit', kw: ['flying'] }, null, src);
    },
    async d_grimgrin(P, e, t, src) {
        if (t && t.o && onBf(t.o.uid)) { log(`${src.card.name} destroys ${t.o.card.name}.`); destroy(t.o); }
        if (onBf(src.uid)) { const got = putCounters(src, 1, P); log(`${src.card.name} gets ${got} +1/+1 counter.`); }
    },
    async d_armix(P, e, t, src) {
        if (!P.hand.length || !t || !t.o || !onBf(t.o.uid)) return;
        const yes = dIsAI(P) ? P.hand.some(c => /\bLand\b/.test(c.card.type)) || P.hand.length > 5 : await askYes(P, `${src.card.name}: discard a card to give ${t.o.card.name} -X/-X?`, { card: src.card });
        if (!yes) return;
        await discardChosen(P, `${src.card.name}: discard a card`);
        const X = P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length + P.gy.filter(c => /\bArtifact\b/.test(c.card.type)).length;
        if (X > 0) { t.o.tp -= X; t.o.tq -= X; log(`${t.o.card.name} gets -${X}/-${X} until end of turn.`); await settle(); }
    },
    async d_combustion(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        const C = G.players[t.o.owner], n = Math.max(0, pow(src));
        const take = dIsAI(C) ? (C.life > n * 2 + 4) : await askYes(C, `${src.card.name}: let it deal ${n} damage to you instead of destroying ${t.o.card.name}?`, { card: src.card });
        if (take) { C.life -= n; log(`${src.card.name} deals ${n} damage to ${C.name}.`); fire('playerDamaged', { P: C, n }); fire('loseLife', { P: C, n }); }
        else { log(`${t.o.card.name} is destroyed (${src.card.name}).`); destroy(t.o); }
    },
    async d_djeru(P, e, t, src) {
        const top = []; for (let i = 0; i < 6 && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => /\bLegendary\b/.test(c.card.type) && /\bCreature\b/.test(c.card.type));
        const got = await pickOwn(P, pool, `${src.card.name}: exile a legendary creature card?`, { optional: true });
        if (got) { P.exile.push(got); got.freeCast = true; got.playUntil = G.turn; log(`${P.name} exile${you(P) ? '' : 's'} ${got.card.name}; it may be cast this turn without paying its mana cost.`); }
        P.library.unshift(...shuffle(top.filter(c => c !== got)));
    },
    d_sapling(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return; log(`${P.name} reveal${you(P) ? '' : 's'} ${c.card.name}.`);
        if (!/\bCreature\b/.test(c.card.type)) return;
        P.library.pop(); P.hand.push(c);
        const tg = Number(c.card.toughness) || 0, pw = Number(c.card.power) || 0;
        if (tg > 0) gainLifeFor(P, tg);
        if (pw > 0) { P.life -= pw; P.lostTurn = G.turn; P.lostN = (P.lostTurn === G.turn ? P.lostN || 0 : 0) + pw; log(`${P.name} lose${you(P) ? '' : 's'} ${pw} life.`); fire('loseLife', { P, n: pw }); }
    },
    async d_yusri(P, e, t, src) {
        const n = dIsAI(P) ? 3 : await askNumber(P, `${src.card.name}: choose a number between 1 and 5`, 1, 5, 3, { card: src.card, noCancel: true }); if (!n) return;
        let won = 0, lost = 0; for (let i = 0; i < n; i++) { if (rand(2) === 0) won++; else lost++; }
        log(`${src.card.name}: ${won} flip${won === 1 ? '' : 's'} won, ${lost} lost.`);
        if (won) drawCards(P, won);
        if (lost) { const d = lost * 2; P.life -= d; log(`${src.card.name} deals ${d} damage to ${P.name}.`); fire('playerDamaged', { P, n: d }); fire('loseLife', { P, n: d }); }
        if (won === 5) { P.hand.forEach(c => { c.freeCast = true; c.playUntil = G.turn; }); log(`${P.name} may cast spells from ${you(P) ? 'your' : 'their'} hand this turn without paying their mana costs.`); }
    },
    async d_radha(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.owner === P.i).length; if (n <= 0) return;
        let r = Math.ceil(n / 2);
        if (!dIsAI(P) && n > 1) r = await askNumber(P, `${src.card.name}: how many of the ${n} mana are {R}? (the rest are {G})`, 0, n, r, { card: src.card, noCancel: true });
        const pool = Array(r).fill('R').concat(Array(n - r).fill('G'));
        P.pool = (P.pool || []).concat(pool); P.keepPoolTurn = G.turn;
        log(`${P.name} add${you(P) ? '' : 's'} ${pool.map(c => '{' + c + '}').join('')} (it stays until end of turn).`);
    },
    async d_choco(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.owner === P.i && hasType(x, 'Bird')).length; if (n <= 0) return;
        const top = []; for (let i = 0; i < n && P.library.length; i++) top.push(P.library.pop());
        const got = await pickOwn(P, top, `${src.card.name}: put one of them into your hand?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (got) { P.hand.push(got); log(`${P.name} put${you(P) ? '' : 's'} ${got.card.name} into ${you(P) ? 'your' : 'their'} hand.`); }
        for (const c of top.filter(x => x !== got)) {
            if (/\bLand\b/.test(c.card.type)) { putOntoBattlefield(P, c, true); fire('landfall', { o: c }); log(`${c.card.name} enters the battlefield tapped.`); }
            else { P.gy.push(c); log(`${c.card.name} is put into the graveyard.`); }
        }
    },
    async d_drana(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && !/\bLegendary\b/.test(c.card.type)); if (!pool.length) return;
        const D = foes(P)[0] || P, c = await chooseFrom(D, pool.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0)), `${src.card.name}: choose a nonlegendary creature card in ${P.name}'s graveyard`, false);
        // the defending player picks the weakest (the computer) or whatever the human chooses
        const x = c || pool[0]; reanimateFrom(P, P, x); x.addedTypes = (x.addedTypes || []).concat('Vampire'); putCounters(x, 1, P);
    },
    async d_cait(P, e, t, src) {
        if (!P.library.length) return; fire('scry', { P });
        const c = P.library.pop(); exilePlayFrom(P, P, c, G.turn);
        const X = c.card.cmc || 0; const tgt = dMine(P).sort((a, b) => pow(b) - pow(a))[0];
        if (X > 0 && tgt) { tgt.tp += X; log(`${tgt.card.name} gets +${X}/+0 until end of turn.`); }
    },
    async d_aerith(P, e, t, src) {
        const X = dLife(P), pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card from your graveyard`, { required: true }); if (!c) return;
        if (X >= 7) reanimateFrom(P, P, c); else { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async d_rodolf(P, e, t, src) {
        const X = dLife(P); const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= X); if (!pool.length) return;
        if (!(await mayPay(P, '{1}{W}', `${src.card.name}: pay {1}{W/B}?`, src, true)) && !(await mayPay(P, '{1}{B}', 'pay', src, true))) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${X} or less`, {}); if (c) reanimateFrom(P, P, c);
    },
    async d_kynaios(P, e, t, src) {
        drawCards(P, 1);
        const didPut = {};
        for (const X of G.players.filter(q => !q.out)) {
            const lands = X.hand.filter(c => /\bLand\b/.test(c.card.type)); if (!lands.length) continue;
            const c = await pickOwn(X, lands, `${src.card.name}: put a land card from your hand onto the battlefield?`, { optional: true }); if (!c) continue;
            pull(X.hand, c); putOntoBattlefield(X, c); fire('landfall', { o: c }); didPut[X.i] = true; log(`${X.name} put${you(X) ? '' : 's'} ${c.card.name} onto the battlefield.`);
        }
        foes(P).filter(F => !didPut[F.i]).forEach(F => drawCards(F, 1));
    },
    d_kratos(P, e, t, src) {
        const X = G.active !== undefined ? G.players[G.active] : null; if (!X || X.out) return;
        const n = X.bf.filter(c => isCreature(c) && c.attackedTurn !== G.turn).length; if (n <= 0) return;
        X.life -= n; log(`${src.card.name} deals ${n} damage to ${X.name}.`); fire('playerDamaged', { P: X, n }); fire('loseLife', { P: X, n });
    },
    async d_shrineKill(P, e, t, src) {
        const X = dShrines(P); if (!X) return; if (!(await mayPay(P, '{1}', `${src.card.name}: pay {1} to destroy a creature with toughness ${X} or less?`, src, true))) return;
        const pool = allPerms().filter(c => isCreature(c) && tou(c) <= X && !has(c, 'hexproof') || false);
        const c = (dIsAI(P) ? pool.filter(c => c.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: destroy a creature with toughness ${X} or less`, { required: true }));
        if (c && onBf(c.uid)) { log(`${c.card.name} is destroyed (${src.card.name}).`); destroy(c); }
    },
    async d_shrineBurn(P, e, t, src) {
        const X = dShrines(P); if (!X) return; if (!(await mayPay(P, '{1}', `${src.card.name}: pay {1} to deal ${X} damage to target player?`, src, true))) return;
        const F = foes(P).sort((a, b) => a.life - b.life)[0]; const V = dIsAI(P) ? F : (foes(P).length > 1 ? foes(P)[await askMode(P, `${src.card.name}: target player`, foes(P).map(q => q.name))] : F); if (!V) return;
        V.life -= X; log(`${src.card.name} deals ${X} damage to ${V.name}.`); fire('playerDamaged', { P: V, n: X }); fire('loseLife', { P: V, n: X });
    },
    async d_shrineGrow(P, e, t, src) {
        const sh = P.bf.filter(x => hasType(x, 'Shrine')); if (!sh.length) return; if (!(await mayPay(P, '{1}', `${src.card.name}: pay {1} to put ${sh.length} +1/+1 counters on target Shrine?`, src, true))) return;
        const tgt = await pickOwn(P, sh, `${src.card.name}: target Shrine`, { required: true }); const got = putCounters(tgt, sh.length, P); log(`${tgt.card.name} gets ${got} +1/+1 counters.`);
    },
    async d_shrineMill(P, e, t, src) {
        const X = dShrines(P); if (!X) return; if (!(await mayPay(P, '{1}', `${src.card.name}: pay {1} so target player mills ${X} cards?`, src, true))) return;
        const V = dIsAI(P) ? (foes(P).sort((a, b) => b.library.length - a.library.length)[0] || P) : G.players[(await askMode(P, `${src.card.name}: target player`, G.players.filter(q => !q.out).map(q => q.name)))] || P; doMill(V, X);
    },
    async d_reaper(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x) return; const H = G.players[x.realOwner !== undefined ? x.realOwner : x.owner];
        const holder = G.players.find(q => q.gy.includes(x)); if (!holder) return;
        const yes = dIsAI(P) ? true : await askYes(P, `${src.card.name}: put ${x.card.name} onto the battlefield under your control?`, { card: x.card }); if (!yes) return;
        reanimateFrom(P, holder, x);
    },
    async d_nymris(P, e, t, src) {
        const top = []; for (let i = 0; i < 2 && P.library.length; i++) top.push(P.library.pop()); if (!top.length) return;
        const got = await pickOwn(P, top, `${src.card.name}: put one into your hand (the other goes to your graveyard)`, { required: true });
        top.forEach(c => { if (c === got) { P.hand.push(c); log(`${P.name} put${you(P) ? '' : 's'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand.`); } else { P.gy.push(c); log(`${c.card.name} is put into the graveyard.`); } });
    },
    async d_zaxara(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o, X = (sp && sp.xVal) || 0;
        const n0 = P.bf.length; await applyEffect(P, { t: 'token', n: 1, p: 0, q: 0, name: 'green Hydra', kw: [] }, null, src);
        const h = P.bf.slice(n0).find(x => x.token && /Hydra/.test(x.card.type + x.card.name)) || P.bf[P.bf.length - 1];
        if (h && X > 0) { const got = putCounters(h, X, P); log(`${h.card.name} gets ${got} +1/+1 counters.`); }
    },
    async d_graha(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o, X = (sp && sp.card.cmc) || 0; if (X <= 0 || P.life <= X) return;
        const yes = dIsAI(P) ? (P.life > X + 12) : await askYes(P, `${src.card.name}: pay ${X} life for a Hero token with ${X} +1/+1 counters?`, { card: src.card }); if (!yes) return;
        P.life -= X; log(`${P.name} pay${you(P) ? '' : 's'} ${X} life.`); fire('loseLife', { P, n: X });
        const n0 = P.bf.length; await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Hero', kw: [] }, null, src);
        const h = P.bf[P.bf.length - 1]; if (h && P.bf.length > n0) putCounters(h, X, P);
    },
    async d_reyhan(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.lki && G.ctxRaw.lki.counters) || 0; if (n <= 0) return;
        const pool = allPerms().filter(c => isCreature(c) && c !== (G.ctxRaw && G.ctxRaw.o) && !has(c, 'hexproof') || (isCreature(c) && c.owner === P.i)); if (!pool.length) return;
        const c = dIsAI(P) ? dMine(P).filter(x => x !== (G.ctxRaw && G.ctxRaw.o)).sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put ${n} +1/+1 counters on target creature?`, { optional: true });
        if (c && onBf(c.uid)) { const got = putCounters(c, n, P); log(`${c.card.name} gets ${got} +1/+1 counters.`); }
    },
    async d_elena(P, e, t, src) {
        const pool = P.gy.filter(c => /\b(Artifact|Legendary|Saga)\b/.test(c.card.type) && !/Assassin/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a historic card from your graveyard to your hand`, { required: true }); if (c) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async d_itzquinth(P, e, t, src) {
        const dinos = dMine(P).filter(x => hasType(x, 'Dinosaur') && pow(x) > 0); const foesC = allPerms().filter(x => isCreature(x) && x.owner !== P.i && !has(x, 'hexproof') && !has(x, 'shroud'));
        if (!dinos.length || !(foesC.length || dinos.length > 1)) return;
        if (!(await mayPay(P, '{2}', `${src.card.name}: pay {2} so a Dinosaur you control deals damage equal to its power to another target creature?`, src, true))) return;
        const d = await pickOwn(P, dinos, `${src.card.name}: choose a Dinosaur`, { rank: (a, b) => pow(b) - pow(a) }); if (!d) return;
        const pool = allPerms().filter(x => isCreature(x) && x !== d && !has(x, 'hexproof') && !has(x, 'shroud'));
        const tg = dIsAI(P) ? pool.filter(x => x.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: another target creature`, { required: true });
        if (tg) { damage(tg, pow(d), d); log(`${d.card.name} deals ${pow(d)} damage to ${tg.card.name}.`); }
    },
    async d_mouth(P, e, t, src) {
        let V = (t && t.p) || foes(P)[0] || P; if (dIsAI(P) && V === P && foes(P).length) V = foes(P).sort((a, b) => b.library.length - a.library.length)[0]; doMill(V, 3);
        const X = V.gy.filter(c => /\b(Instant|Sorcery)\b/.test(c.card.type)).length;
        await applyEffect(P, { t: 'amass', n: X, type: 'Orc' }, null, src);
    },
    async d_blackCat(P, e, t, src) {
        const V = (t && t.p) || foes(P)[0]; if (!V) return; const top = []; for (let i = 0; i < 9 && V.library.length; i++) top.push(V.library.pop());
        const mine = []; for (let k = 0; k < 2 && top.length; k++) { const c = await pickOwn(P, top, `${src.card.name}: exile a card`, { required: true }); if (!c) break; top.splice(top.indexOf(c), 1); mine.push(c); }
        mine.forEach(c => exilePlayFrom(P, V, c, 1e9)); V.library.unshift(...shuffle(top));
    },
    async d_inferno(P, e, t, src) {
        if (!onBf(src.uid)) return; const before = pow(src); src.tp += 1; log(`${src.card.name} gets +1/+0 until end of turn.`);
        if (before < 20 && pow(src) >= 20) {
            log(`${src.card.name} deals 20 damage to any target.`);
            if (dIsAI(P) && !(t && ((t.p && t.p !== P) || (t.o && t.o.owner !== P.i)))) t = null;
            if (t && t.p) { t.p.life -= 20; fire('playerDamaged', { P: t.p, n: 20 }); fire('loseLife', { P: t.p, n: 20 }); } else if (t && t.o && onBf(t.o.uid)) damage(t.o, 20, src); else { const F = foes(P).sort((a, b) => a.life - b.life)[0]; if (F) { F.life -= 20; fire('playerDamaged', { P: F, n: 20 }); fire('loseLife', { P: F, n: 20 }); } }
        }
    },
    async d_redDeath(P, e, t, src) {
        if (t && t.o && onBf(t.o.uid)) { await CMD.goadTarget(P, e, t, src); const C = G.players[t.o.owner]; drawCards(C, 1); }
        P.pool = (P.pool || []).concat(['R']); log(`${P.name} add${you(P) ? '' : 's'} {R}.`);
    },
    d_haldir(P, e, t, src) {
        const n = Math.max(0, src.counters || 0);
        P.bf.filter(x => isCreature(x) && x !== src && hasType(x, 'Elf')).forEach(x => { x.tkw.push('vigilance'); x.tp += n; x.tq += n; });
        log(`Other Elves you control gain vigilance and get +${n}/+${n} until end of turn.`);
    },
    async d_horde(P, e, t, src) {
        const pool = P.gy.filter(c => hasType(c, 'Elemental') || /Elemental/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: play an Elemental card from your graveyard without paying its mana cost`, { optional: true }); if (!c) return;
        pull(P.gy, c); c.freeCast = true; c.playUntil = G.turn; P.exile.push(c); log(`${P.name} may play ${c.card.name} without paying its mana cost.`);
    },
});
