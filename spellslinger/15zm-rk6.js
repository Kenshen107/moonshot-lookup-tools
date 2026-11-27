// Spellslinger Duels - engine pieces for card round rk6 (2026-11-27). CMD ids start with rk6_. Wordings are in rules/rk6.js.
// Choices inside resolving spells are made as they resolve (the codebase's usual approximation); a person always gets the prompt, the computer a rule.
const rk6H = P => (window.__RK6H ? !P.isAI : !(P.isAI || AUTOPLAY)); // a person gets prompts (window.__RK6H lets tests ask for them under autoplay)
async function rk6Pick(P, pool, prompt, score, optional) {
    if (!pool.length) return null;
    if (!rk6H(P)) return (await pickCard(P, pool, prompt, { required: !optional })) || (optional ? null : pool[0]);
    return pool.slice().sort((a, b) => score(b) - score(a))[0];
}
const rk6Land = x => /\bLand\b/.test(x.card.type);
const rk6Art = x => /\bArtifact\b/.test(x.card.type);
const rk6Lose = (X, n, why) => { if (n <= 0) return; X.life -= n; G.lastLost = n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life${why ? ` (${why})` : ''}.`); };
const rk6Types = P => { const m = {}; allPerms().filter(isCreature).forEach(c => ((c.card.type.split(' — ')[1] || '').split(' ').filter(Boolean)).concat(c.addedTypes || []).forEach(w => { m[w] = (m[w] || 0) + 1; })); return m; };
function rk6TokenN(P, n) { return n * tokenMult(P); }
const rk6Elemental = n => ({ t: 'token', n, p: 1, q: 1, name: 'red Elemental', kw: ['haste'] });
Object.assign(ART_TOKENS, { gold: ART_TOKENS.gold || { name: 'Gold', text: 'Sacrifice this artifact: Add one mana of any color.' } });

// ---- generic wrappers ----
{   // temporary "loses all abilities" (Sudden Spoiling, Oko): o.rk6NoAbil is the turn number, or 1e9 for good
    const la = lostAbilities;
    lostAbilities = function (o) { return !!(o && G && o.rk6NoAbil && (o.rk6NoAbil === 1e9 || o.rk6NoAbil === G.turn)) || la.apply(this, arguments); };
    // Orim's Chant: a player who can't cast spells this turn, and nobody attacks when it was kicked
    const ccn = canCastNow;
    canCastNow = function (P, o) { if (P && P.rk6NoCast === G.turn) return false; return ccn.apply(this, arguments); };
    { const cca = cmdCantAttack; cmdCantAttack = function (o) { if (G && G.rk6NoAtk === G.turn) return true; return cca.apply(this, arguments); }; }
    // Supernatural Stamina: returns to the battlefield tapped when it dies this turn
    const dol = dieOrLeave;
    dieOrLeave = function (o, zone) {
        const back = o && o.rk6Return === G.turn && zone === 'gy' && !o.token && onBf(o.uid);
        const X = back ? G.players[o.realOwner ?? o.owner] : null;
        const r = dol.apply(this, arguments);
        if (back && X && X.gy.includes(o)) { putOntoBattlefield(X, o, true); log(`${o.card.name} returns to the battlefield tapped (Supernatural Stamina).`); }
        return r;
    };
    // additional cost: discard two cards (Cathartic Reunion)
    const aco = addCostOk; addCostOk = function (P, o) { const a = Rx(o).addCost; if (a && a.rk6Discard2) return P.hand.filter(x => x !== o).length >= 2; return aco.apply(this, arguments); };
    const pac = payAddCost;
    payAddCost = async function (P, o) {
        const a = Rx(o).addCost;
        if (a && a.rk6Discard2) {
            const others = P.hand.filter(x => x !== o); const out = [];
            for (let k = 0; k < 2; k++) { const left = others.filter(x => !out.includes(x)); const d = rk6H(P) ? ((await pickCard(P, left, `${o.card.name}: discard a card (${k + 1} of 2)`, { required: true })) || left[0]) : left.sort((x, y) => aiKeepValue(P, x) - aiKeepValue(P, y))[0]; out.push(d); }
            out.forEach(d => { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; }); noteDiscard(P, 2);
            log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${out.map(d => d.card.name).join(' and ')} to cast ${o.card.name}.`);
            return;
        }
        return pac.apply(this, arguments);
    };
    // Stolen creatures (Insurrection) go home with the turn: the engine already returns stolenTurn creatures at the end of turn
}

Object.assign(CMD, {
    // ---------- Saw in Half ----------
    async rk6_saw(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const X = G.players[c.owner]; const p0 = Math.max(0, pow(c)), q0 = Math.max(0, tou(c)); const card = c.card;
        destroy(c, src);
        if (onBf(c.uid)) return;
        if (!(c.token || X.gy.includes(c))) return; // it didn't die (exiled or replaced)
        const k = 2 * tokenMult(X);
        for (let i = 0; i < k; i++) tokenCopyOf(X, card, { p: Math.ceil(p0 / 2), q: Math.ceil(q0 / 2) });
    },
    // ---------- Scapeshift ----------
    async rk6_scapeshift(P, e, t, src) {
        const lands = P.bf.filter(rk6Land); const inLib = P.library.filter(rk6Land).length;
        let n = rk6H(P) ? await askNumber(P, `${src.card.name}: sacrifice how many lands?`, 0, Math.min(lands.length, 40), Math.min(lands.length, inLib), { card: src.card, ok: 'Sacrifice' }) : (lands.length >= 6 ? Math.min(inLib, Math.floor(lands.length / 2)) : 0);
        n = Math.max(0, Math.min(n || 0, lands.length));
        const fs = n ? await chooseSacN(P, lands, n, src.card.name) : [];
        fs.forEach(f => { fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); });
        if (fs.length) log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${fs.length} land${fs.length === 1 ? '' : 's'}.`);
        const got = [];
        for (let i = 0; i < fs.length; i++) {
            const pool = P.library.filter(x => rk6Land(x) && !got.includes(x)); if (!pool.length) break;
            const c = await rk6Pick(P, pool, `${src.card.name}: search for a land card (${i + 1} of ${fs.length})`, x => (/\bBasic\b/.test(x.card.type) ? 0 : 2) + ((Rx(x).mana && Rx(x).mana.colors || []).length), true);
            if (!c) break; got.push(c);
        }
        got.forEach(c => putOntoBattlefield(P, c, true));
        libShuffle(P);
    },
    // ---------- Decree of Pain ----------
    rk6_decree(P, e, t, src) {
        let n = 0;
        allPerms().filter(isCreature).forEach(c => { if (!onBf(c.uid)) return; c.regen = 0; destroy(c, 'is destroyed (it can\'t be regenerated)'); if (!onBf(c.uid)) n++; });
        if (n) { log(`${P.name} ${you(P) ? 'draw' : 'draws'} ${n} card${n === 1 ? '' : 's'}.`); drawCards(P, n); }
    },
    rk6_decreeCycle(P) { allPerms().filter(isCreature).forEach(c => { c.tp -= 2; c.tq -= 2; }); log('All creatures get -2/-2 until end of turn.'); sba(); },
    // ---------- Natural Order ----------
    async rk6_natural(P, e, t, src) {
        const c = await rk6Pick(P, P.library.filter(x => isCreatureCard(x.card) && (x.card.colors || []).includes('G')), `${src.card.name}: search for a green creature card`, x => (x.card.cmc || 0) + (Number(x.card.power) || 0) * 0.3);
        if (c) putOntoBattlefield(P, c); else log(`${P.name} finds no green creature card.`);
        libShuffle(P);
    },
    // ---------- Orim's Chant ----------
    rk6_chant(P, e, t, src) {
        const V = t && t.p; if (!V) return;
        V.rk6NoCast = G.turn; log(`${V.name} can't cast spells this turn.`);
        if (src && src.kicked) { G.rk6NoAtk = G.turn; log('Creatures can\'t attack this turn.'); }
    },
    // ---------- Supernatural Stamina ----------
    rk6_stamina(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        c.tp += 2; c.rk6Return = G.turn; log(`${c.card.name} gets +2/+0 and gains "When this creature dies, return it to the battlefield tapped" until end of turn.`);
    },
    // ---------- Insurrection ----------
    rk6_insurrection(P) {
        const hit = allPerms().filter(isCreature);
        hit.forEach(c => { c.tapped = false; if (c.owner !== P.i) { pull(G.players[c.owner].bf, c); c.realOwner = c.realOwner ?? c.owner; c.owner = P.i; c.stolenTurn = G.turn; P.bf.push(c); } c.tkw.push('haste'); });
        log(`${P.name} ${you(P) ? 'untap' : 'untaps'} all creatures and ${you(P) ? 'gain' : 'gains'} control of them until end of turn. They gain haste.`);
    },
    // ---------- The Last Agni Kai ----------
    async rk6_agni(P, e, t, src) {
        const theirs = t && t.o; if (!theirs || !onBf(theirs.uid)) return;
        const mine = await rk6Pick(P, P.bf.filter(isCreature), `${src.card.name}: choose a creature you control to fight ${theirs.card.name}`, c => pow(c) * 2 + tou(c));
        if (!mine) { log(`${src.card.name}: you control no creature to fight with.`); return; }
        const room = Math.max(0, tou(theirs) - theirs.dmg); const dealt = pow(mine);
        log(`${mine.card.name} fights ${theirs.card.name}.`);
        damage(theirs, dealt, mine); damage(mine, pow(theirs), theirs);
        const excess = Math.max(0, dealt - room);
        if (excess > 0) { P.pool = (P.pool || []).concat(Array(excess).fill('R')); log(`${P.name} add${you(P) ? '' : 's'} ${excess} {R} (excess damage).`); }
        P.keepPoolTurn = G.turn; log(`${P.name} won't lose unspent mana as steps and phases end this turn.`);
    },
    // ---------- Sudden Spoiling ----------
    rk6_spoiling(P, e, t, src) {
        const V = t && t.p; if (!V) return;
        V.bf.filter(isCreature).forEach(c => { c.rk6NoAbil = G.turn; c.baseSet = { turn: G.turn, p: 0, q: 2 }; });
        log(`Creatures ${V.name} controls lose all abilities and have base power and toughness 0/2 until end of turn.`);
    },
    // ---------- Pact of the Serpent ----------
    async rk6_serpent(P, e, t, src) {
        const V = t && t.p; if (!V) return;
        const types = rk6Types(P); const names = Object.keys(types).sort((a, b) => V.bf.filter(c => isCreature(c) && hasType(c, b)).length - V.bf.filter(c => isCreature(c) && hasType(c, a)).length);
        if (!names.length) { log(`${src.card.name}: no creature types to choose.`); return; }
        let ty = names[0];
        if (rk6H(P)) { const i = await askMode(P, `${src.card.name}: choose a creature type`, names.map(n => `${n} (${V.bf.filter(c => isCreature(c) && hasType(c, n)).length} controlled by ${V.name})`)); ty = names[i] || names[0]; }
        const x = V.bf.filter(c => isCreature(c) && hasType(c, ty)).length;
        log(`${P.name} choose${you(P) ? '' : 's'} ${ty}: ${V.name} controls ${x}.`);
        if (x > 0) { drawCards(V, x); rk6Lose(V, x); }
    },
    // ---------- Winds of Change ----------
    rk6_winds(P) {
        G.players.filter(X => !X.out).forEach(X => { const n = X.hand.length; X.library.push(...X.hand.splice(0)); libShuffle(X); drawCards(X, n); log(`${X.name} ${you(X) ? 'shuffle' : 'shuffles'} ${n} card${n === 1 ? '' : 's'} into ${you(X) ? 'your' : 'their'} library and ${you(X) ? 'draw' : 'draws'} that many.`); });
    },
    // ---------- Infectious Inquiry ----------
    rk6_inquiry(P) { drawCards(P, 2); rk6Lose(P, 2); foes(P).forEach(F => { F.poison = (F.poison || 0) + 1; log(`${F.name} ${you(F) ? 'get' : 'gets'} a poison counter.`); }); },
    // ---------- Villainous Wealth ----------
    async rk6_wealth(P, e, t, src) {
        const V = t && t.p; if (!V) return; const x = G.curX || 0;
        const seen = V.library.splice(Math.max(0, V.library.length - x)).reverse(); seen.forEach(c => V.exile.push(c));
        log(`${V.name} exile${you(V) ? '' : 's'} the top ${seen.length} cards of ${you(V) ? 'your' : 'their'} library.`);
        let pool = seen.filter(c => !rk6Land(c) && (c.card.cmc || 0) <= x && Rx(c).support !== 'none');
        for (let g = 0; g < 80 && pool.length; g++) {
            const c = await rk6Pick(P, pool, `${src.card.name}: cast a spell without paying its mana cost (None to stop)`, c => (c.card.cmc || 0), true);
            if (!c) break; pool = pool.filter(y => y !== c);
            await castFreeAuto(P, c); await settle();
        }
    },
    // ---------- Tempt with Vengeance ----------
    async rk6_vengeance(P, e, t, src) {
        const x = G.curX || 0; if (x <= 0) return;
        await applyEffect(P, rk6Elemental(x), null, src); let took = 0;
        for (const F of foes(P)) {
            const yes = rk6H(F) ? await askYes(F, `${src.card.name}: ${P.name} offers you ${x} 1/1 red Elemental tokens with haste. If you take them, ${P.name} gets another ${x}. Take the deal?`, { card: src.card, yes: 'Take it', no: 'No thanks' }) : (typeof botTempts === 'function' ? botTempts(F, P, 'bunnies') : true);
            if (yes) { await applyEffect(F, rk6Elemental(x), null, src); took++; log(`${F.name} ${you(F) ? 'take' : 'takes'} the tempting offer.`); }
        }
        for (let i = 0; i < took; i++) await applyEffect(P, rk6Elemental(x), null, src);
    },
    // ---------- Artifact Mutation ----------
    async rk6_mutation(P, e, t, src) {
        const a = t && t.o; if (!a || !onBf(a.uid)) return; const mv = a.card.cmc || 0; a.regen = 0;
        destroy(a, src);
        if (mv > 0) await applyEffect(P, { t: 'token', n: mv, p: 1, q: 1, name: 'green Saproling', kw: [] }, null, src);
    },
    // ---------- Reckless Handling ----------
    async rk6_reckless(P, e, t, src) {
        const c = await rk6Pick(P, P.library.filter(x => rk6Art(x)), `${src.card.name}: search for an artifact card`, x => (x.card.cmc || 0), false);
        if (c) { pull(P.library, c); P.hand.push(c); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name} and put${you(P) ? '' : 's'} it into ${you(P) ? 'your' : 'their'} hand.`); }
        libShuffle(P);
        if (P.hand.length) { const d = P.hand[rand(P.hand.length)]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} at random.`); if (rk6Art(d)) foes(P).forEach(F => { damage(F, 2, src); log(`${src.card.name} deals 2 damage to ${F.name}.`); }); }
    },
    // ---------- Semester's End ----------
    async rk6_semester(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) || isPlaneswalker(x)); const chosen = [];
        if (rk6H(P)) { for (let g = 0; g < 30; g++) { const left = pool.filter(x => !chosen.includes(x)); if (!left.length) break; const c = await pickCard(P, left, `${src.card.name}: exile a creature or planeswalker you control (None to stop; ${chosen.length} chosen)`, { required: false }); if (!c) break; chosen.push(c); } }
        else pool.filter(x => isCreature(x) && (x.token ? false : (typeof frEtbValue === 'function' ? frEtbValue(x) >= 3 : x.counters < 0)) ).forEach(x => chosen.push(x));
        if (!chosen.length) return;
        chosen.forEach(c => leaveBattlefield(c, 'exile')); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${chosen.map(c => c.card.name).join(', ')}.`);
        atEndStep(() => { chosen.forEach(c => { const X = G.players.find(y => y.exile.includes(c)); if (!X) return; const own = G.players[c.realOwner ?? c.owner]; pull(X.exile, c); putOntoBattlefield(own, c); if (isCreature(c)) putCounters(c, 1, own); else if (isPlaneswalker(c)) c.ctr.loyalty = (c.ctr.loyalty || 0) + 1; }); }, `${src.card.name}: the exiled permanents return.`);
    },
    // ---------- Storm Herd ----------
    async rk6_stormherd(P, e, t, src) { const n = Math.max(0, P.life); if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'white Pegasus', kw: ['flying'] }, null, src); },
    // ---------- Price of Progress ----------
    rk6_progress(P, e, t, src) { G.players.filter(X => !X.out).forEach(X => { const n = 2 * X.bf.filter(l => rk6Land(l) && !/\bBasic\b/.test(l.card.type)).length; if (n) { damage(X, n, src); log(`${src.card.name} deals ${n} damage to ${X.name}.`); } }); },
    // ---------- Hell to Pay ----------
    async rk6_hell(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return; const x = G.curX || 0;
        const room = Math.max(0, tou(c) - c.dmg); damage(c, x, src); log(`${src.card.name} deals ${x} damage to ${c.card.name}.`);
        const ex = Math.max(0, x - room);
        if (ex > 0) await applyEffect(P, { t: 'artToken', kind: 'treasure', n: ex, tapped: true }, null, src);
    }
});
Object.assign(CMD_SCORE, {
    rk6_saw: P => 7, rk6_scapeshift: P => P.bf.filter(rk6Land).length >= 6 && P.library.filter(rk6Land).length >= 3 ? 5 : 0,
    rk6_decree: P => { const m = P.bf.filter(isCreature).reduce((s, c) => s + creatureValue(c), 0), th = foes(P).reduce((s, F) => s + F.bf.filter(isCreature).reduce((q, c) => q + creatureValue(c), 0), 0); return th - m >= 8 ? 14 : 0; },
    rk6_decreeCycle: () => 0, rk6_natural: P => P.library.some(x => isCreatureCard(x.card) && (x.card.colors || []).includes('G') && (x.card.cmc || 0) >= 6) ? 12 : 0,
    rk6_chant: P => 0, rk6_stamina: () => 0, rk6_insurrection: P => { const n = foes(P).reduce((s, F) => s + F.bf.filter(c => isCreature(c)).reduce((q, c) => q + pow(c), 0), 0) + P.bf.filter(isCreature).reduce((s, c) => s + pow(c), 0); return foes(P).some(F => n >= F.life) && G.phase === 'main1' ? 1000 : 0; },
    rk6_agni: P => P.bf.some(isCreature) ? 6 : 0, rk6_spoiling: () => 0, rk6_serpent: P => 5, rk6_winds: P => P.hand.length <= 2 && foes(P).some(F => F.hand.length >= 4) ? 6 : 0,
    rk6_inquiry: P => P.life > 8 ? 6 : 0, rk6_wealth: () => 18, rk6_vengeance: () => 8, rk6_mutation: P => foes(P).some(F => F.bf.some(rk6Art)) ? 6 : 0,
    rk6_reckless: P => P.library.some(rk6Art) ? 3 : 0, rk6_semester: () => 0, rk6_stormherd: P => P.life >= 8 ? 8 + P.life * 0.3 : 0, rk6_progress: P => { const f = foes(P).reduce((s, F) => s + F.bf.filter(l => rk6Land(l) && !/\bBasic\b/.test(l.card.type)).length, 0); const me = P.bf.filter(l => rk6Land(l) && !/\bBasic\b/.test(l.card.type)).length; return f * 2 > me * 2 + 3 ? 5 : 0; }, rk6_hell: () => 5
});
// ---------- Pact of Negation ----------
Object.assign(CMD, {
    rk6_pactDelay(P, e, t, src) {
        (G.delayed = G.delayed || []).push({ at: 'upkeep', own: true, P, after: G.turn, effects: [cmd('rk6_pactPay')], src, label: `${src.card.name}: ${P.name} must pay {3}{U}{U} now or lose the game.` });
    },
    rk6_pactPay(P, e, t, src) {
        const cost = parseCost('{3}{U}{U}'); const plan = planPayment(P, cost);
        if (plan) { plan.forEach(s => tapSource(P, s)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} {3}{U}{U} for ${src.card.name}.`); }
        else { log(`${P.name} can't pay {3}{U}{U} for ${src.card.name}, and ${you(P) ? 'lose' : 'loses'} the game.`); eliminate(P, `${you(P) ? 'You' : P.name} didn't pay for ${src.card.name}.`); }
    }
});
Object.assign(CMD_SCORE, { rk6_pactDelay: () => 0, rk6_pactPay: () => 0 });
