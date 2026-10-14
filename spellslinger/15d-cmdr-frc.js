// Engine pieces for the Multiverse Reforged deck (FRC). Wordings: rules/cmdr.js.
Object.assign(TRIG_FN, {
    hitMonarchMe: (o, ctx) => G.monarch === o.owner && !!ctx.src && ctx.src.owner !== o.owner && (G.players.length === 2 || G.defender === o.owner),
    sphinxAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Sphinx')),
    bigZombieTokens: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && x.token && hasType(x, 'Zombie') && pow(x) >= 6)
});
const cardTypes = ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery'];
Object.assign(CMD, {
    // Nissa, Leyline Tamer: draw; the first time each turn also put the next creature card from the library onto the battlefield
    async nissaLandfall(P, e, t, src) {
        drawCards(P, 1);
        src.nissaTurn = src.nissaTurn && src.nissaTurn.turn === G.turn ? src.nissaTurn : { turn: G.turn, n: 0 };
        if (++src.nissaTurn.n !== 1) return;
        const seen = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (isCreatureCard(c.card)) { hit = c; break; } seen.push(c); }
        shuffle(seen).forEach(c => P.library.unshift(c));
        if (hit) { putOntoBattlefield(P, hit); if (Rx(hit).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: hit, effects: Rx(hit).etb }); }
    },
    // Dack Fayden, Helping Hand: reveal until X creature cards (X = opponents), they enter goaded, and each opponent gets one
    async dackFayden(P, e, t, src, O, name) {
        const opps = oppsOf(P), got = [], seen = [];
        while (P.library.length && got.length < opps.length) { const c = P.library.pop(); (isCreatureCard(c.card) ? got : seen).push(c); }
        seen.forEach(c => P.library.unshift(c)); shuffle(P.library);
        const left = opps.slice();
        for (const c of got) {
            putOntoBattlefield(P, c); if (Rx(c).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: c, effects: Rx(c).etb });
            goad(c, P.i);
            const pick = left.length === 1 ? left[0] : (P.isAI || AUTOPLAY ? left.slice().sort((a, b) => b.life - a.life)[0] : opps[(await askMode(P, `${name}: which opponent gets ${c.card.name}?`, left.map(x => x.name)))] || left[0]);
            pull(left, pick);
            giveControl(c, pick); log(`${pick.name} gains control of ${c.card.name}.`);
        }
    },
    async obNixilis(P, e, t, src) { const hit = oppsOf(P).flatMap(F => F.bf.filter(c => isCreature(c) && c.tapped)); let n = 0; hit.forEach(c => { if (!has(c, 'indestructible')) { dieOrLeave(c, 'gy'); n++; } }); log(`${src.card.name} destroys ${n} tapped creature${n === 1 ? '' : 's'}.`); if (n) gainLifeFor(P, n); },
    // Teferi's Reproach
    async teferisReproach(P, e, t, src, O) {
        const X = t && t.p ? t.p : O; const until = nextTurnOf(X);
        X.protAll = until; X.lifeLock = until;
        log(`${X.name} ${you(X) ? 'gain' : 'gains'} protection from everything, and ${you(X) ? 'your' : 'their'} life total can't change, until ${you(X) ? 'your' : 'their'} next turn.`);
        X.bf.filter(c => !/\bLand\b/.test(c.card.type) && !c.attachedTo).forEach(phaseOut);
    },
    // Avacyn, Angel of Horror: it comes back at the beginning of the next end step
    async returnAtEnd(P, e, t, src) {
        const x = G.ctxObj; if (!x || x.token) return;
        atEndStep(async () => { const own = G.players[x.realOwner ?? x.owner]; if (own.gy.includes(x)) reanimateFrom(P, own, x); }, `${x.card.name} returns at the beginning of the end step.`);
    },
    // Jhoira, Weatherlight Corsair: steal the first historic permanent from the opponent's library
    async jhoiraSteal(P, e, t, src, O, name) {
        const X = t && t.p ? t.p : O; const rest = []; let hit = null;
        while (X.library.length) { const c = X.library.pop(); if (/\b(?:Artifact|Legendary|Saga)\b/.test(c.card.type) && Rx(c).kind !== 'land' || (/\bLegendary\b/.test(c.card.type) && /\bLand\b/.test(c.card.type) === false && false)) { hit = c; break; } rest.push(c); }
        rest.forEach(c => X.library.unshift(c)); shuffle(X.library);
        if (!hit) { log(`${X.name} reveals no historic permanent.`); return; }
        log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${hit.card.name}.`);
        resetObj(hit); hit.realOwner = X.i; hit.owner = P.i; hit.enteredTurn = G.turn; P.bf.push(hit);
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${hit.card.name} onto the battlefield under ${you(P) ? 'your' : 'their'} control.`);
        fire('enters', { o: hit }); if (Rx(hit).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: hit, effects: Rx(hit).etb });
        const mv = hit.card.cmc || 0; if (mv) { P.life -= mv; log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${mv} life.`); }
    },
    // Venser, Fervent Forger
    async venserSpell(P, e, t, src) { if (t && t.item) { await applyEffect(P, { t: 'copySpell', target: 'spell', filter: 'instant or sorcery' }, t, src); await applyEffect(P, { t: 'copySpell', target: 'spell', filter: 'instant or sorcery' }, t, src); } },
    async venserCopies(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        for (let k = 0; k < 2; k++) { const tok = tokenCopyOf(P, x.card); tok.tkw.push('haste'); tok.sick = false; tok.sacAtEnd = G.turn; }
    },
    // Niv-Mizzet, Ghost Counsel: pay that much life to draw that many cards
    async nivDraw(P, e, t, src, O, name) {
        const n = G.ctxRaw && G.ctxRaw.n; if (!n || n <= 0 || P.life <= n) return;
        if (!(P.isAI ? P.life > n + 12 : await askYes(P, `${name}: pay ${n} life to draw ${n} card${n === 1 ? '' : 's'}?`, { card: src.card }))) return;
        P.life -= n; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${n} life.`); drawCards(P, n);
    },
    // Tamiyo, Upriser Crowned
    async tamiyoStun(P, e, t, src) { const x = G.ctxRaw && G.ctxRaw.src; if (x && onBf(x.uid)) { x.tapped = true; x.ctr.stun = (x.ctr.stun || 0) + 1; log(`${x.card.name} is tapped and gets a stun counter.`); } },
    // The Ur-Sphinx: each player mills that many; you may cast a milled card for each player
    async sphinxAttack(P, e, t, src, O, name) {
        const n = G.attackers.map(onBf).filter(a => a && a.owner === P.i && hasType(a, 'Sphinx')).length; if (!n) return;
        const milled = new Map();
        for (const X of G.players.filter(y => !y.out)) milled.set(X, doMill(X, n));
        for (const [X, cards] of milled) {
            const pool = cards.filter(c => X.gy.includes(c) && Rx(c).kind !== 'land' && Rx(c).support !== 'none'); if (!pool.length) continue;
            const pick = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: cast a card ${X === P ? 'you' : X.name} milled without paying its mana cost (or none)`, { optional: true });
            if (pick) await castFreeFrom(P, pick);
        }
    },
    // Ginger, Queen of Sweets: Gingerbrute tokens
    async gingerbrute(P, e, t, src) {
        const card = { id: `token-ginger-${uidSeq}`, name: 'Gingerbrute', fullName: 'Gingerbrute token', cost: '', cmc: 1, type: 'Token Artifact Creature — Food Golem', text: 'Haste\n{1}: ~ can\'t be blocked this turn except by creatures with haste.\n{2}, {T}, Sacrifice ~: You gain 3 life.', power: '1', toughness: '1', colors: [], ci: [], img: null, imgS: null, legal: {} };
        const tok = makeObj(card, P.i, { token: true }); P.bf.push(tok); G.lastMade = tok; log(`${P.name} ${you(P) ? 'create' : 'creates'} a Gingerbrute token.`); fire('enters', { o: tok }); tokenMade(P); fire('creatureTokenMade', { P });
    },
    async gingerEvade(P, e, t, src) { src.evadeHaste = G.turn; log(`${src.card.name} can't be blocked this turn except by creatures with haste.`); },
    async emblemSun(P) { (P.emblems = P.emblems || []).push('sunsChampion'); log(`${P.name} ${you(P) ? 'get' : 'gets'} an emblem: creatures ${you(P) ? 'you control' : 'they control'} get +2/+2 and have flying.`); },
    // Serra's Emissary: choose a card type
    async emissaryChoose(P, e, t, src, O, name) {
        let ty = 'Creature';
        if (!(P.isAI || AUTOPLAY)) ty = cardTypes[await askMode(P, `${name}: choose a card type (you and your creatures get protection from it)`, cardTypes)] || 'Creature';
        src.chosenCardType = ty; log(`${name}: ${ty} chosen.`);
    },
    // Sunfall: Incubate X (an Incubator token with X +1/+1 counters; {2}: transform it)
    async incubate(P, e, t, src) {
        const x = G.lastWipeN || 0; if (x <= 0) return;
        const card = { id: `token-incubator-${uidSeq}`, name: 'Incubator', fullName: 'Incubator token', cost: '', cmc: 0, type: 'Token Artifact — Incubator', text: '{2}: Transform this token.', colors: [], ci: [], img: null, imgS: null, legal: {} };
        const tok = makeObj(card, P.i, { token: true, sick: false }); tok.counters = 0; tok.incubatorN = x; P.bf.push(tok); tok.ctr.incubate = x; log(`${P.name} ${you(P) ? 'incubate' : 'incubates'} ${x}.`); fire('enters', { o: tok }); tokenMade(P);
    },
    async incubatorTransform(P, e, t, src) {
        if (!onBf(src.uid) || !src.incubatorN) return;
        const x = src.incubatorN; src.card = { ...src.card, name: 'Phyrexian Token', fullName: 'Phyrexian token', type: 'Token Artifact Creature — Phyrexian', text: '', power: '0', toughness: '0', colors: [], ci: [], id: `token-phyrexian-${uidSeq++}` };
        src.counters += x; src.incubatorN = 0; delete src.ctr.incubate; src.sick = true; log(`${src.card.name} transforms into a ${x}/${x} Phyrexian artifact creature.`);
    },
    async whiteSunsTwilight(P, e, t, src) {
        const x = e.n || 0; gainLifeFor(P, x);
        const before = allPerms().filter(isCreature);
        if (x > 0) await applyEffect(P, { t: 'token', n: x, p: 1, q: 1, name: 'colorless Phyrexian Mite', artifact: true, kw: [], text: 'Toxic 1\n~ can\'t block.' }, null, src);
        if (x >= 5) before.forEach(c => { if (c !== src && !has(c, 'indestructible')) dieOrLeave(c, 'gy'); });
    },
    async massPolymorph(P) {
        const mine = P.bf.filter(isCreature); const n = mine.length;
        mine.forEach(c => { log(`${c.card.name} is exiled.`); leaveBattlefield(c, 'exile'); });
        await CMD.revealCreaturesToBf(P, n);
    },
    async syntheticDestiny(P, e, t, src) {
        const mine = P.bf.filter(isCreature); const n = mine.length;
        mine.forEach(c => { log(`${c.card.name} is exiled.`); leaveBattlefield(c, 'exile'); });
        atEndStep(async () => { await CMD.revealCreaturesToBf(P, n); }, `${src.card.name}: the creatures return at the beginning of the end step.`);
    },
    async revealCreaturesToBf(P, n) {
        const got = [], rest = [];
        while (P.library.length && got.length < n) { const c = P.library.pop(); (isCreatureCard(c.card) ? got : rest).push(c); }
        rest.forEach(c => P.library.unshift(c)); shuffle(P.library);
        got.forEach(c => { putOntoBattlefield(P, c); if (Rx(c).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: c, effects: Rx(c).etb }); });
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${got.length} creature card${got.length === 1 ? '' : 's'} onto the battlefield.`);
    },
    async occultEpiphany(P, e, t, src, O, name) {
        const x = e.n || 0; if (x > 0) drawCards(P, x);
        const out = [];
        for (let k = 0; k < x && P.hand.length; k++) { const c = P.isAI || AUTOPLAY ? P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : (await pickCard(P, P.hand, `${name}: discard a card (${k + 1} of ${x})`, { required: true })) || P.hand[0]; pull(P.hand, c); P.gy.push(c); c.discardTurn = G.turn; out.push(c); }
        if (out.length) noteDiscard(P, out.length);
        const kinds = new Set(out.flatMap(c => cardTypes.filter(ty => cardTypeOf(c.card, ty))));
        if (kinds.size) await applyEffect(P, { t: 'token', n: kinds.size, p: 1, q: 1, name: 'white Spirit', kw: ['flying'] }, null, src);
    },
    async sharkCast(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const mv = sp ? sp.card.cmc || 0 : 0; if (mv > 0) await applyEffect(P, { t: 'token', n: 1, p: mv, q: mv, name: 'blue Shark', kw: ['flying'] }, null, src); },
    async sharkCycle(P, e, t, src) { const x = e.x || 0; await applyEffect(P, { t: 'token', n: 1, p: x, q: x, name: 'blue Shark', kw: ['flying'] }, null, src); },
    async archfiendEnd(P, e, t, src) { oppsOf(P).forEach(F => { if (F.lostTurn === G.turn && F.lostN > 0) { F.life -= F.lostN; log(`${src.card.name} makes ${F.name} lose ${F.lostN} more life.`); } }); },
    async archonCruelty(P, e, t, src, O, name) {
        const X = t && t.p ? t.p : O;
        const pool = X.bf.filter(x => isCreature(x) || isPlaneswalker(x));
        if (pool.length) { const c = X.isAI || AUTOPLAY ? pool.slice().sort((a, b) => permValue(a) - permValue(b))[0] : (await pickCard(X, pool, `${name}: sacrifice a creature or planeswalker`, { required: true })) || pool[0]; log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); }
        await applyEffect(P, { t: 'discard', n: 1 }, { p: X }, src); X.life -= 3; log(`${X.name} ${you(X) ? 'lose' : 'loses'} 3 life.`);
        drawCards(P, 1); gainLifeFor(P, 3);
    },
    async zombieLifelink(P) { G.attackers.map(onBf).filter(a => a && a.owner === P.i && a.token && hasType(a, 'Zombie') && pow(a) >= 6).forEach(a => { a.tkw.push('lifelink'); log(`${a.card.name} gains lifelink until end of turn.`); }); },
    async siegeJeskai(P, e, t, src) { if (src.word !== 'Jeskai') return; await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'red Goblin', kw: [], tkw: ['lifelink', 'haste'] }, null, src); },
    async restlessAnimate(P, e, t, src) { if (!onBf(src.uid)) return; const fs = G.active === P.i; src.animated = { turn: G.turn, p: 2, q: 1, kw: fs ? ['first strike'] : [] }; log(`${src.card.name} becomes a 2/1 Elemental creature until end of turn${fs ? ' with first strike' : ''}.`); },
    // Plan for All Outcomes: the owner chooses the top or bottom of their library
    async topOrBottom(P, e, t, src, O, name) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const own = G.players[x.realOwner ?? x.owner]; const top = own.isAI ? permValue(x) >= 4 : await askYes(own, `${name}: put ${x.card.name} on the top of your library? (Cancel = bottom)`, { card: x.card, yes: 'Top', no: 'Bottom' });
        leaveBattlefield(x, 'library'); if (!x.token) { const i = own.library.indexOf(x); if (i >= 0) { own.library.splice(i, 1); if (top) own.library.push(x); else own.library.unshift(x); } }
        log(`${x.card.name} is put on the ${top ? 'top' : 'bottom'} of ${own.name === 'You' ? 'your' : `${own.name}'s`} library.`);
    },
    async empower(P, e) { empowerJace(P, e.n || 1); },
    async bounceSpellOrCreature(P, e, t, src) { if (!t) return; if (t.item) await applyEffect(P, { t: 'bounceSpell' }, t, src); else if (t.o && onBf(t.o.uid)) await applyEffect(P, { t: 'bounce' }, t, src); },
    async bottomFromHand(P) { if (!P.hand.length) return; const c = P.isAI || AUTOPLAY ? P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : (await pickCard(P, P.hand, 'Put a card from your hand on the bottom of your library', { required: true })) || P.hand[0]; pull(P.hand, c); P.library.unshift(c); log(`${P.name} ${you(P) ? 'put' : 'puts'} a card on the bottom of ${you(P) ? 'your' : 'their'} library.`); },
    async jaceMinus3(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        leaveBattlefield(x, 'exile'); log(`${x.card.name} is exiled.`);
        const rest = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (isCreatureCard(c.card) || /\bPlaneswalker\b/.test(c.card.type)) { hit = c; break; } rest.push(c); }
        shuffle(rest).forEach(c => P.library.unshift(c));
        if (hit) { putOntoBattlefield(P, hit); if (Rx(hit).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: hit, effects: Rx(hit).etb }); }
    },
    async jaceTax(P, e, t, src) {
        const X = G.players[G.active]; if (X === P || X.out) return;
        const cost = { ...parseCost(''), generic: 2 }; const plan = planPayment(X, cost);
        const pay = plan && (X.isAI || AUTOPLAY ? X.bf.some(canAttackWith) : await askYes(X, `${src.card.name}: pay {2} so your creatures can attack ${P.name === 'You' ? 'your' : `${P.name}'s`} Jaces this turn?`, { card: src.card }));
        if (pay) { plan.forEach(s => tapSource(X, s)); log(`${X.name} ${you(X) ? 'pay' : 'pays'} {2}.`); } else { G.jaceNoAttack = { turn: G.turn, player: X.i, by: P.i }; log(`${X.name}'s creatures can't attack ${P.name === 'You' ? 'your' : `${P.name}'s`} Jaces this turn.`); }
    }
});
