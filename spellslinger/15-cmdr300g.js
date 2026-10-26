// Engine pieces for commander round 3, batch g (2026-10-26). Wordings are in rules/cmdr300g.js; each odd card is a CMD entry (ids start with g_).
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.

const gAI = P => P.isAI || AUTOPLAY;
const gHurt = (X, n, src) => { if (n <= 0 || X.out) return; X.life -= n; log(`${src.card.name} deals ${n} damage to ${X.name}.`); fire('playerDamaged', { P: X, n }); fire('loseLife', { P: X, n }); };
const gLose = (X, n) => { if (n <= 0 || X.out) return; X.life -= n; X.lostTurn = G.turn; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); };
async function gOpp(P, title) {
    const fs = foes(P); if (fs.length <= 1) return fs[0] || null;
    if (gAI(P)) return fs.slice().sort((a, b) => a.life - b.life)[0];
    const i = await askMode(P, title, fs.map(f => f.name)); return fs[i] || fs[0];
}
const gIsLand = o => /\bLand\b/.test(o.card.type);
const gHasCtr = o => o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0);
function gRemoveCtr(o) { if (o.counters > 0) { o.counters--; return true; } const k = Object.keys(o.ctr || {}).find(k2 => o.ctr[k2] > 0); if (k) { o.ctr[k]--; return true; } return false; }
// Make a token with its own rules text (Cragflame)
function gMakeToken(P, name, type, text, colors) {
    const card = { id: `token-${name}-${uidSeq}`, name, fullName: `${name} token`, cost: '', cmc: 0, type, text, colors: colors || [], ci: colors || [], img: null, imgS: null, legal: {} };
    const o = makeObj(card, P.i, { token: true, sick: false });
    P.bf.push(o); log(`${P.name} ${you(P) ? 'create' : 'creates'} ${name}.`); fire('enters', { o }); tokenMade(P);
    return o;
}
// "Full party": a Cleric, a Rogue, a Warrior and a Wizard among your creatures
const G_PARTY = ['Cleric', 'Rogue', 'Warrior', 'Wizard'];
const gParty = P => G_PARTY.filter(w => P.bf.some(x => isCreature(x) && hasType(x, w))).length;
// Cast a card from a graveyard (it is exiled first so the game lets it be cast this turn)
async function gCastFromGy(P, H, c, src, exileAfter) {
    pull(H.gy, c); exilePlayFrom(P, H, c, G.turn);
    if (exileAfter) c.exileAfter = true;
    const ok = await castPaying(P, c);
    if (!ok && P.exile.includes(c)) { pull(P.exile, c); c.exileAfter = false; delete c.playUntil; H.gy.push(c); if (c.realOwner !== undefined) { c.owner = c.realOwner; delete c.realOwner; } log(`${c.card.name} can't be cast and returns to the graveyard.`); }
    return ok;
}

if (!ART_TOKENS.junk) Object.assign(ART_TOKENS, { junk: { name: 'Junk', text: '{T}, Sacrifice this artifact: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.' } });

Object.assign(TRIG_FN, {
    g_abaddonCast: (o, ctx) => ctx.P.i === o.owner && G.active === o.owner && ctx.o.castFromHand === G.turn && (ctx.o.card.cmc || 0) <= foes(G.players[o.owner]).reduce((s, F) => s + lostThisTurn(F), 0),
    g_yidrisCast: (o, ctx) => ctx.P.i === o.owner && ctx.P.g_yid === G.turn && ctx.o.castFromHand === G.turn,
    g_veronica: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && !gIsLand(ctx.o) && ctx.P.g_vTurn !== G.turn && (ctx.P.g_vTurn = G.turn) > 0,
    g_dogAttacks: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && allPerms().some(a => a.attachedTo === x.uid)),
    g_tawCast: (o, ctx) => ctx.P.i === o.owner && Rx(ctx.o).kind === 'creature' && (hasType(ctx.o, 'Beast') || hasType(ctx.o, 'Bird')),
    g_ironCast: (o, ctx) => ctx.P.i === o.owner && /\bArtifact\b/.test(ctx.o.card.type) && ctx.P.g_ironTurn !== G.turn,
    g_kotho: (o, ctx) => !!ctx.o && !ctx.o.token && (ctx.o.realOwner ?? ctx.o.owner) !== o.owner && ctx.o !== o,
    g_shirei: (o, ctx) => !!ctx.o && !ctx.o.token && ctx.o.owner === o.owner && pow(ctx.o) <= 1,
    g_jason: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && (hasType(ctx.o, 'Zombie') || hasType(ctx.o, 'Mutant')) && String(pow(ctx.o)) !== String(ctx.o.card.power),
    g_mySac: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ctx.o !== o,
    g_mySacFood: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Food'),
    g_myLandfall: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && G.players[o.owner].bf.filter(gIsLand).length >= 7,
    g_myGain: (o, ctx) => !!ctx.P && ctx.P.i === o.owner,
    g_myNoncreatureCast: (o, ctx) => ctx.P.i === o.owner && Rx(ctx.o).kind !== 'creature',
    g_legTarget: (o, ctx) => ctx.by === o.owner && !!ctx.o && ctx.o.owner !== o.owner && isCreature(ctx.o),
    g_aphHit: (o, ctx) => {
        const P = G.players[o.owner]; if (P.g_aph !== G.turn || !ctx.src || ctx.src.owner !== o.owner || !(hasType(ctx.src, 'Gorgon') || hasType(ctx.src, 'Snake'))) return false;
        const v = (ctx.hit || []).filter(X => X !== P); if (!v.length) return false;
        o.g_aphDone = o.g_aphDone || {}; const key = ctx.step + ':' + v[0].i; if (o.g_aphDone[key]) return false; o.g_aphDone[key] = true; return true;
    },
    g_rogueHit: (o, ctx) => !!ctx.src && ctx.src.owner === o.owner && hasType(ctx.src, 'Rogue') && (ctx.hit || []).some(X => X.i !== o.owner),
    g_aloneAttack: (o, ctx) => (ctx.list || []).length === 1 && ctx.list[0].owner === o.owner && (hasType(ctx.list[0], 'Samurai') || hasType(ctx.list[0], 'Warrior')),
    g_sphinx: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner
});
Object.assign(CMD_SCORE, { g_vito: () => 4, g_omega: () => 6, g_nashi: () => 3, g_sin: () => 5, g_baba: () => 8, g_atemsis: () => 8, g_legolas: () => 6, g_galina: () => 9, g_kethek: () => 4, g_spider: () => 5, g_strago: () => 7, g_quistis: () => 5, g_unesh: () => 5, g_niv: () => 8, g_vaevictis: () => 7 });

Object.assign(CMD, {
    // Junk token ability
    g_junk(P, e, t, src) {
        const c = P.library.pop(); if (!c) return;
        exilePlayFrom(P, P, c, G.turn);
    },
    g_dogmeat(P, e, t, src) {
        const n = (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.owner === P.i && allPerms().some(a => a.attachedTo === x.uid)).length;
        if (n) applyEffect(P, { t: 'artToken', kind: 'junk', n }, null, src);
    },
    g_yidris(P, e, t, src) { P.g_yid = G.turn; log(`Until end of turn, spells ${P.name} ${you(P) ? 'cast' : 'casts'} from hand gain cascade.`); },
    async g_tawnos(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; if (!sp) return;
        const yes = gAI(P) ? true : await askYes(P, `${src.card.name}: copy ${sp.card.name}? (the copy is an artifact too)`, { card: sp.card });
        if (!yes) return;
        tokenCopyOf(P, { ...sp.card, type: 'Artifact ' + sp.card.type });
    },
    async g_ironman(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; if (!sp || P.g_ironTurn === G.turn) return;
        const yes = gAI(P) ? true : await askYes(P, `${src.card.name}: copy ${sp.card.name}? (once each turn)`, { card: sp.card });
        if (!yes) return;
        P.g_ironTurn = G.turn;
        tokenCopyOf(P, { ...sp.card, type: sp.card.type.replace(/\bLegendary\s+/, '') });
    },
    g_kotho(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || x.token) return;
        const X = G.players[x.owner]; if (!X.gy.includes(x)) return;
        drawCards(P, 1); gLose(P, 1);
    },
    g_mabel(P, e, t, src) { gMakeToken(P, 'Cragflame', 'Token Legendary Artifact — Equipment', 'Equipped creature gets +1/+1 and has vigilance, trample, and haste.\nEquip {2}'); },
    async g_shirei(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || x.token) return;
        const X = G.players[x.owner]; if (!X.gy.includes(x)) return;
        const yes = gAI(P) ? true : await askYes(P, `${src.card.name}: return ${x.card.name} to the battlefield at the beginning of the next end step?`, { card: x.card });
        if (!yes) return;
        atEndStep(() => { if (onBf(src.uid) && X.gy.includes(x)) { pull(X.gy, x); putOntoBattlefield(X, x); log(`${x.card.name} returns to the battlefield (${src.card.name}).`); } }, src.card.name);
    },
    async g_niv(P, e, t, src) {
        const top = []; for (let i = 0; i < 10 && P.library.length; i++) top.push(P.library.pop());
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} the top ${top.length} cards: ${top.map(c => c.card.name).join(', ')}.`);
        const pairs = ['WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG']; const left = top.slice(); const got = [];
        for (const pr of pairs) {
            const pool = left.filter(c => { const cs = c.card.colors || []; return cs.length === 2 && cs.includes(pr[0]) && cs.includes(pr[1]); });
            if (!pool.length) continue;
            const x = pool.length === 1 && gAI(P) ? pool[0] : await pickOwn(P, pool, `${src.card.name}: choose a ${pr} card`, { optional: true });
            if (x) { pull(left, x); got.push(x); P.hand.push(x); }
        }
        if (got.length) log(`${P.name} put ${got.map(c => c.card.name).join(', ')} into ${you(P) ? 'your' : 'their'} hand.`);
        P.library.unshift(...shuffle(left));
    },
    g_jason(P, e, t, src) { drawCards(P, 1); },
    g_vito(P, e, t, src) {
        const k = src.g_vito && src.g_vito.turn === G.turn ? src.g_vito.n + 1 : 1; src.g_vito = { turn: G.turn, n: k };
        if (k === 1) gainLifeFor(P, 2);
        else if (k === 2) foes(P).forEach(F => gLose(F, 2));
        else if (k === 3) applyEffect(P, { t: 'token', n: 1, p: 4, q: 3, name: 'white and black Vampire Demon', kw: ['flying'] }, null, src);
    },
    async g_omega(P, e, t, src) {
        const X = P.bf.filter(a => gIsLand(a) && !/\bBasic\b/.test(a.card.type)).length; let any = false;
        for (const F of foes(P)) {
            const pool = F.bf.filter(a => !gIsLand(a));
            const x = await pickOwn(P, pool, `${src.card.name}: tap up to one target nonland permanent ${F.name} controls`, { optional: true, rank: (a, b) => permValue(b) - permValue(a) });
            if (!x) continue;
            x.tapped = true; x.ctr.stun = (x.ctr.stun || 0) + X; any = true; log(`${x.card.name} is tapped and gets ${X} stun counter${X === 1 ? '' : 's'}.`);
        }
        if (any && X > 0) gainLifeFor(P, X);
    },
    async g_nashi(P, e, t, src) {
        const n = G.ctxRaw && G.ctxRaw.n || 0; if (n <= 0) return;
        const before = P.gy.length; doMill(P, n); const milled = P.gy.slice(before);
        let took = 0;
        for (const c of milled) {
            if (!(/\bLegendary\b/.test(c.card.type) || /\bEnchantment\b/.test(c.card.type))) continue;
            const yes = gAI(P) ? true : await askYes(P, `${src.card.name}: put ${c.card.name} into your hand?`, { card: c.card });
            if (yes) { pull(P.gy, c); P.hand.push(c); took++; log(`${c.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
        }
        if (!took && onBf(src.uid)) putCounters(src, 1, P);
    },
    async g_sin(P, e, t, src) {
        for (let guard = 0; guard < 40; guard++) {
            const pool = P.gy.filter(c => /\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/.test(c.card.type)); if (!pool.length) return;
            const c = pool[Math.floor(Math.random() * pool.length)];
            pull(P.gy, c); P.exile.push(c); log(`${c.card.name} is exiled at random.`);
            const tok = tokenCopyOf(P, c.card); tok.tapped = true;
            if (!gIsLand(c)) return;
        }
    },
    async g_baba(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src || true); const chosen = [];
        const types = list => new Set(list.flatMap(x => permTypes(x)));
        if (gAI(P)) {
            const left = pool.slice().sort((a, b) => permValue(a) - permValue(b));
            while (chosen.length < 3) {
                const cur = types(chosen); const nx = left.find(x => !chosen.includes(x) && permTypes(x).some(w => !cur.has(w))); if (!nx) break;
                chosen.push(nx);
            }
            if (types(chosen).size < 3) { log(`${src.card.name}: no good sacrifice.`); return; }
        } else {
            for (let k = 0; k < 3; k++) {
                const x = await pickOwn(P, pool.filter(y => !chosen.includes(y)), `${src.card.name}: sacrifice a permanent (${k + 1}/3, up to three)`, { optional: true });
                if (!x) break; chosen.push(x);
            }
        }
        const ty = types(chosen).size;
        chosen.forEach(x => { if (onBf(x.uid)) sacPerm(P, x); });
        if (ty >= 3) { foes(P).forEach(F => gLose(F, 3)); gainLifeFor(P, 3); drawCards(P, 3); }
    },
    async g_atemsis(P, e, t, src) {
        const F = hitList().find(X => X !== P); if (!F || F.out) return;
        const distinct = new Set(P.hand.map(c => c.card.cmc || 0)).size;
        if (distinct < 6) { if (!gAI(P)) { const yes = await askYes(P, `${src.card.name}: reveal your hand? (${distinct} different mana values)`, {}); if (yes) log(`${P.name} reveals their hand: ${P.hand.map(c => c.card.name).join(', ')}.`); } return; }
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${distinct} different mana values (${src.card.name}).`);
        eliminate(F, `${src.card.name}: six different mana values were revealed.`);
    },
    async g_legolas(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pw = pow(src); const pool = G.players.flatMap(X => X.bf).filter(isCreature);
        let x;
        if (gAI(P)) { x = pool.filter(c => c.owner !== P.i && tou(c) - (c.dmg || 0) <= pw).sort((a, b) => creatureValue(b) - creatureValue(a))[0]; }
        else x = await pickOwn(P, pool, `${src.card.name}: deal ${pw} damage to up to one target creature`, { optional: true });
        if (x) damage(x, pw, src);
    },
    g_aphelia(P, e, t, src) { P.g_aph = G.turn; log(`Until end of turn, Gorgons and Snakes ${P.name} controls halve the life of players they hit.`); },
    g_aphHit(P, e, t, src) { const v = hitList().find(X => X !== P); if (v) gLose(v, Math.ceil(v.life / 2)); },
    async g_tatyova(P, e, t, src) {
        const pool = P.bf.filter(x => gIsLand(x) && !isCreature(x)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: target land becomes a 3/3 Elemental creature with haste`, { optional: true, rank: (a, b) => (a.tapped ? 1 : 0) - (b.tapped ? 1 : 0) });
        if (!x) return; x.permAnimated = { p: 3, q: 3 }; x.sick = false; x.tkw.push('haste'); log(`${x.card.name} becomes a 3/3 Elemental creature with haste. It's still a land.`);
    },
    async g_unesh(P, e, t, src) {
        const top = []; for (let i = 0; i < 4 && P.library.length; i++) top.push(P.library.pop()); if (!top.length) return;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.map(c => c.card.name).join(', ')}.`);
        const F = await gOpp(P, `${src.card.name}: which opponent separates the cards?`); const A = [], B = [];
        if (!F || gAI(F)) { top.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)).forEach((c, i) => ((i % 2) ? B : A).push(c)); }
        else { for (const c of top) { const yes = await askYes(F, `${src.card.name}: put ${c.card.name} in pile 1? (No = pile 2)`, { card: c.card }); (yes ? A : B).push(c); } }
        const val = L => L.reduce((s, c) => s + (c.card.cmc || 0) + 1, 0);
        let pickA = val(A) >= val(B);
        if (!gAI(P)) { const i = await askMode(P, `${src.card.name}: pile 1 = ${A.map(c => c.card.name).join(', ') || '(none)'}; pile 2 = ${B.map(c => c.card.name).join(', ') || '(none)'}. Which pile goes to your hand?`, ['Pile 1', 'Pile 2']); pickA = i === 0; }
        const hand = pickA ? A : B, gy = pickA ? B : A;
        P.hand.push(...hand); P.gy.push(...gy);
        log(`${P.name} put ${hand.length} card${hand.length === 1 ? '' : 's'} into ${you(P) ? 'your' : 'their'} hand and ${gy.length} into the graveyard.`);
    },
    async g_ghen(P, e, t, src) {
        const pool = P.gy.filter(c => /\bEnchantment\b/.test(c.card.type)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: return target enchantment card from your graveyard to the battlefield`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (x) { pull(P.gy, x); putOntoBattlefield(P, x); }
    },
    g_blackMage(P, e, t, src) {
        const n = gParty(P) >= 4 ? 3 : 1; foes(P).forEach(F => gHurt(F, n, src));
    },
    async g_sierra(P, e, t, src) {
        const X = (src.ctr && src.ctr.quest) || 0; const pool = P.bf.filter(isCreature); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: target creature you control gets +${X}/+${X}`, { rank: (a, b) => pow(b) - pow(a) });
        if (x) await applyEffect(P, { t: 'pump', p: X, q: X, kw: [] }, { o: x }, src);
    },
    async g_pharika(P, e, t, src) {
        const pool = []; G.players.forEach(H => H.gy.filter(c => /\bCreature\b/.test(c.card.type)).forEach(c => pool.push([H, c])));
        if (!pool.length) return;
        const cards = pool.map(p => p[1]);
        const c = await pickOwn(P, cards, `${src.card.name}: exile target creature card from a graveyard`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (!c) return; const H = pool.find(p => p[1] === c)[0];
        pull(H.gy, c); H.exile.push(c); log(`${c.card.name} is exiled from ${H.name === 'You' ? 'your' : H.name + "'s"} graveyard.`);
        await applyEffect(H, { t: 'token', n: 1, p: 1, q: 1, name: 'black and green Snake enchantment', kw: ['deathtouch'] }, null, src);
    },
    async g_kethek(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src); if (!pool.length) return;
        let x;
        if (gAI(P)) x = pool.filter(c => (c.card.cmc || 0) >= 3 && permValue(c) <= 5).sort((a, b) => permValue(a) - permValue(b))[0];
        else x = await pickOwn(P, pool, `${src.card.name}: sacrifice another creature? (cancel to skip)`, { optional: true });
        if (!x) return;
        const mv = x.card.cmc || 0; sacPerm(P, x);
        const rest = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (/\bCreature\b/.test(c.card.type) && !/\bLegendary\b/.test(c.card.type) && (c.card.cmc || 0) < mv) { hit = c; break; } rest.push(c); }
        P.library.unshift(...shuffle(rest));
        if (hit) { log(`${P.name} reveals ${hit.card.name}.`); putOntoBattlefield(P, hit); } else log(`${P.name} reveals no smaller nonlegendary creature.`);
    },
    async g_ukkima(P, e, t, src) {
        const X = Math.max(0, (G.ctxRaw && G.ctxRaw.lki && G.ctxRaw.lki.pow) || src.lastPow || 0); if (!X) return;
        const F = await gOpp(P, `${src.card.name}: deals ${X} damage to which player?`); if (!F) return;
        gHurt(F, X, src); gainLifeFor(P, X);
    },
    async g_galina(P, e, t, src) {
        const pool = allPerms().filter(x => x.owner !== P.i && /\bLegendary\b/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud')); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: gain control of target legendary permanent`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (x) giveControl(x, P);
    },
    g_garna(P, e, t, src) {
        const back = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && c.toGyTurn === G.turn);
        back.forEach(c => { pull(P.gy, c); P.hand.push(c); });
        if (back.length) log(`${back.map(c => c.card.name).join(', ')} return${back.length === 1 ? 's' : ''} to ${you(P) ? 'your' : 'their'} hand.`);
    },
    g_anowon(P, e, t, src) {
        const F = hitList().find(X => X !== P); const n = G.ctxRaw && G.ctxRaw.n || 0; if (!F || n <= 0) return;
        const before = F.gy.length; doMill(F, n); const milled = F.gy.slice(before);
        if (milled.some(c => /\bCreature\b/.test(c.card.type))) drawCards(P, 1);
    },
    async g_whiteMage(P, e, t, src) {
        const n = gParty(P) >= 4 ? 3 : 1; const pool = P.bf.filter(isCreature); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on target creature you control`, { rank: (a, b) => pow(b) - pow(a) });
        if (x) putCounters(x, n, P);
    },
    async g_spider(P, e, t, src) {
        const D = G.players[(G.ctxRaw && G.ctxRaw.list && G.ctxRaw.list[0] && G.ctxRaw.list[0].atkTo != null) ? G.ctxRaw.list[0].atkTo : (G.defender != null ? G.defender : foes(P)[0].i)] || foes(P)[0];
        const pool = D.bf.filter(isCreature);
        const x = await pickOwn(P, pool, `${src.card.name}: tap target creature ${D.name} controls and put a stun counter on it`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (x) { x.tapped = true; x.ctr.stun = (x.ctr.stun || 0) + 1; log(`${x.card.name} is tapped and gets a stun counter.`); }
        const mine = allPerms().filter(a => a.owner === P.i && (a.ctr.stun || 0) > 0 && a !== x), others = allPerms().filter(a => !(a.owner === P.i) && (a.ctr.stun || 0) > 0);
        const have = [...mine, ...others].reduce((s, a) => s + a.ctr.stun, 0); if (!have) return;
        let k;
        const own = mine.reduce((s, a) => s + a.ctr.stun, 0);
        if (gAI(P)) k = Math.min(3, own); else k = await askNumber(P, `${src.card.name}: remove up to three stun counters (draw a card for each)`, 0, Math.min(3, have), Math.min(3, own), { card: src.card }) || 0;
        let done = 0;
        for (const a of [...mine, ...others]) { while (done < k && a.ctr.stun > 0) { a.ctr.stun--; done++; } }
        if (done) { log(`${P.name} ${you(P) ? 'remove' : 'removes'} ${done} stun counter${done === 1 ? '' : 's'} and ${you(P) ? 'draw' : 'draws'}.`); drawCards(P, done); }
    },
    g_dwalin(P, e, t, src) {
        const eq = P.bf.filter(x => /\bEquipment\b/.test(x.card.type)); eq.forEach(x => { x.ctr.hone = (x.ctr.hone || 0) + 1; });
        if (eq.length) log(`Each Equipment ${P.name} controls gets a hone counter.`);
    },
    async g_norin(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || !onBf(x.uid) || x.owner !== P.i) return;
        const blockers = ((G.blocks && G.blocks[x.uid]) || []).map(onBf).filter(Boolean);
        const yes = gAI(P) ? (blockers.some(b => pow(b) >= tou(x)) && !has(x, 'indestructible')) : await askYes(P, `${src.card.name}: exile ${x.card.name}? You may play it this turn.`, { card: x.card });
        if (!yes) return;
        leaveBattlefield(x, 'exile'); if (P.exile.includes(x)) { x.playUntil = G.turn; log(`${P.name} may play ${x.card.name} from exile this turn.`); }
    },
    async g_strago(P, e, t, src) {
        const F = await gOpp(P, `${src.card.name}: which opponent exiles cards?`); if (!F) return;
        const exiled = []; let found = null;
        while (F.library.length) { const c = F.library.pop(); exiled.push(c); F.exile.push(c); if (/\b(Instant|Sorcery|Creature)\b/.test(c.card.type)) { found = c; break; } }
        log(`${F.name} exile${you(F) ? '' : 's'} ${exiled.length} card${exiled.length === 1 ? '' : 's'} from the top of ${you(F) ? 'your' : 'their'} library.`);
        if (found) {
            const yes = gAI(P) ? true : await askYes(P, `${src.card.name}: cast ${found.card.name} without paying its mana cost?`, { card: found.card });
            if (yes) {
                if (Rx(found).kind === 'creature') { found.suspHaste = true; atEndStep(() => { const x = onBf(found.uid); if (x) sacPerm(G.players[x.owner], x); }, src.card.name); }
                await castFreeFrom(P, found);
            }
        }
    },
    async g_quistis(P, e, t, src) {
        const pool = []; G.players.forEach(H => H.gy.filter(c => /\b(Instant|Sorcery)\b/.test(c.card.type) && Rx(c).support !== 'none' && canPay(P, c)).forEach(c => pool.push([H, c])));
        if (!pool.length) return;
        const c = await pickOwn(P, pool.map(p => p[1]), `${src.card.name}: cast an instant or sorcery card from a graveyard (mana of any type can be spent)`, { optional: true });
        if (c) await gCastFromGy(P, pool.find(p => p[1] === c)[0], c, src, true);
    },
    async g_heiko(P, e, t, src) {
        const pool = P.gy.filter(c => /\bArtifact\b/.test(c.card.type) && Rx(c).support !== 'none' && Rx(c).kind !== 'land' && canPay(P, c)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: cast target artifact card from your graveyard this turn`, { optional: true });
        if (c) await gCastFromGy(P, P, c, src, false);
    },
    async g_vaevictis(P, e, t, src) {
        const chosen = [];
        for (const X of G.players.filter(y => !y.out)) {
            const pool = X.bf.slice(); if (!pool.length) continue;
            const mine = X === P;
            const x = await pickOwn(P, pool, `${src.card.name}: choose target permanent ${X.name} controls`, { rank: mine ? (a, b) => permValue(a) - permValue(b) : (a, b) => permValue(b) - permValue(a) });
            if (x) chosen.push([X, x]);
        }
        for (const [X, x] of chosen) if (onBf(x.uid)) sacPerm(X, x);
        for (const [X] of chosen) {
            const c = X.library[X.library.length - 1]; if (!c) continue; log(`${X.name} reveal${you(X) ? '' : 's'} ${c.card.name}.`);
            if (!/\bInstant\b|\bSorcery\b/.test(c.card.type)) { pull(X.library, c); putOntoBattlefield(X, c); }
        }
    },
    async g_xavier(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && gHasCtr(x)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: remove a counter from another permanent you control`, { rank: (a, b) => permValue(a) - permValue(b) });
        if (!x || !gRemoveCtr(x)) return; log(`A counter is removed from ${x.card.name}.`);
        await applyChoiceEffect(P, { t: 'populate' }, src, null);
    }
});

// Edgar, King of Figaro: the first coin flip each turn is a win
const gFlip0 = flipCoin;
flipCoin = function (P) {
    const first = !!P && !!G && P.g_flipTurn !== G.turn; if (P && G) P.g_flipTurn = G.turn;
    if (first && P.bf && P.bf.some(a => Rx(a).g_edgar && !lostAbilities(a))) return true;
    return gFlip0.apply(this, arguments);
};
// Hawkeye, Young Avenger: noncombat damage to opponents' things is increased by his power
const gDamage0 = damage;
damage = function (target, n, src) {
    if (G && !G.inCombatDamage && target && src && src.card && src.uid !== undefined && G.players[src.owner]) {
        const S = G.players[src.owner], tOwner = target.life !== undefined ? target.i : target.owner;
        if (tOwner !== S.i && n > 0) S.bf.filter(a => Rx(a).g_hawkeye && !lostAbilities(a)).forEach(a => { n += Math.max(0, pow(a)); });
    }
    return gDamage0.call(this, target, n, src);
};
// Bilbo, Fellow Conspirator: a Food token also makes a Treasure token
const gMakeArt0 = makeArtifactToken;
makeArtifactToken = function (P, kind) {
    const o = gMakeArt0.apply(this, arguments);
    if (kind === 'food' && P.bf.some(a => Rx(a).g_bilbo && !lostAbilities(a))) { log('Bilbo, Fellow Conspirator: a Treasure token as well.'); gMakeArt0.call(this, P, 'treasure'); }
    return o;
};
