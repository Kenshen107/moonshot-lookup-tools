// Spellslinger Duels - engine pieces for the Hugh, First of Many food and mana-rock deck (2026-11-04). Wordings: rules/hughfood.js. CMD ids start with hh_.
// Approximations (nothing is marked Partly): choices inside resolving abilities (Pizzasaur's destroy target, Hidden Hideout's and Sickbay's creature)
// are made as they resolve; Norn's Annex asks a person ({W}, 2 life or not attacking, per creature); the computer pays {W} if it can, else 2 life above 6 life;
// suspect lasts until the creature leaves the battlefield and shows as a menace counter; Drafna's copy is a token copy of the artifact spell.

Object.assign(TRIG_FN, {
    hh_hostGains: (o, ctx) => { const h = onBf(o.attachedTo); return !!h && !!ctx.P && ctx.P.i === h.owner; },
    hh_oppNonbasic: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && !/\bBasic\b/.test(ctx.o.card.type)
});

// Baral's Expertise: up to three target artifacts and/or creatures
FR_MULTI.expertise = {
    title: 'return an artifact or creature',
    pool: P => allPerms().filter(x => (isCreature(x) || /\bArtifact\b/.test(x.card.type)) && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i)),
    max: () => 3,
    ai: (P, pool) => pool.filter(x => x.owner !== P.i && permValue(x) >= 3).sort((a, b) => permValue(b) - permValue(a))
};

// "Copy target artifact spell you control": only your own artifact spells are targets
(function () {
    const sm = stackMatches;
    stackMatches = function (it, filter) { if (filter === 'hhArtifactMine') return it.kind === 'spell' && /\bArtifact\b/.test(it.o.card.type); return sm.apply(this, arguments); };
    const vt = validTargets;
    validTargets = function (P, e, src) { const r = vt.apply(this, arguments); return e && e.filter === 'hhArtifactMine' ? r.filter(x => x.item && x.item.P === P) : r; };
    // suspected creatures can't block
    const cb = canBlock;
    canBlock = function (b, atk) { if (b && b.suspected) return false; return cb.apply(this, arguments); };
    // Powerstone Shard taps for {C} for each artifact you control with its name
    const mo = manaOf;
    manaOf = function (o) {
        const m = mo.apply(this, arguments);
        if (m && o && o.uid && G && Rx(o).hhShard) { const n = G.players[o.owner].bf.filter(x => x.card.name === o.card.name).length; return n ? { ...m, n, fixed: true } : null; }
        return m;
    };
    // Norn's Annex: {W/P} for each creature that attacks its controller. A person chooses {W}, 2 life or not attacking (hhAnnexAsk, before attackers are declared); the computer pays {W} if it can, else 2 life above 6 life
    const da = declareAttackers;
    declareAttackers = function (P, list) {
        if (G && list && list.length) {
            const keep = [];
            for (const o of list.slice().sort((a, b) => pow(b) - pow(a))) {
                const k = o.annexPaid === G.turn ? 0 : hhAnnexCount(P, o);
                let ok = true;
                for (let i = 0; i < k && ok; i++) {
                    const plan = planPayment(P, parseCost('{W}'));
                    if (plan) { plan.forEach(s => tapSource(P, s)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} {W} for ${o.card.name} to attack (Norn's Annex).`); }
                    else if (P.life > 6) { P.life -= 2; P.lostTurn = G.turn; fire('loseLife', { P, n: 2 }); log(`${P.name} ${you(P) ? 'pay' : 'pays'} 2 life for ${o.card.name} to attack (Norn's Annex).`); }
                    else { ok = false; log(`${o.card.name} can't attack - ${P.name} can't pay for Norn's Annex.`); }
                }
                if (ok) keep.push(o);
            }
            list = list.filter(o => keep.includes(o));
        }
        return da.apply(this, [P, list].concat([].slice.call(arguments, 2)));
    };
})();


// Norn's Annex helpers: how many {W/P} an attacker owes, and the choice a person makes for each
function hhAnnexCount(P, o) {
    const D = G.players.length === 2 ? opp(P) : G.players[o.atkTo != null ? o.atkTo : (G.defender != null ? G.defender : opp(P).i)];
    return D ? D.bf.filter(x => Rx(x).annexTax && !lostAbilities(x)).length : 0;
}
async function hhAnnexAsk(P, sel) {
    if (P.isAI || !sel || !sel.length) return;
    for (const o of sel.slice()) {
        const k = hhAnnexCount(P, o); let ok = true;
        for (let i = 0; i < k && ok; i++) {
            const canW = !!planPayment(P, parseCost('{W}')), canLife = P.life >= 2;
            const labels = [], acts = [];
            if (canW) { labels.push('Pay {W}'); acts.push('w'); }
            if (canLife) { labels.push('Pay 2 life'); acts.push('l'); }
            labels.push(`Don't attack with ${o.card.name}`); acts.push('n');
            const pick = acts[await askMode(P, `Norn's Annex: ${o.card.name} needs {W/P} to attack`, labels)];
            if (pick === 'w') { planPayment(P, parseCost('{W}')).forEach(s => tapSource(P, s)); log(`${P.name} pay {W} for ${o.card.name} to attack (Norn's Annex).`); }
            else if (pick === 'l') { P.life -= 2; P.lostTurn = G.turn; fire('loseLife', { P, n: 2 }); log(`${P.name} pay 2 life for ${o.card.name} to attack (Norn's Annex).`); }
            else ok = false;
        }
        if (ok) o.annexPaid = G.turn; else sel.splice(sel.indexOf(o), 1);
    }
}

Object.assign(CMD, {
    // Barbed Servitor: suspected = menace and can't block, until it leaves the battlefield
    hh_suspect(P, e, t, src) { if (!onBf(src.uid)) return; src.suspected = true; src.ctr.menace = 1; log(`${src.card.name} is suspected (menace, can't block).`); },
    // Baral's Expertise
    async hh_expertise(P, e, t, src) {
        const m = await frMulti(P, src, 'expertise', 0);
        for (const x of (m.list || []).filter(y => onBf(y.uid))) { G.lastBounced = x.owner; G.lastMv = x.card.cmc || 0; log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand'); }
    },
    // Cosmos Elixir
    hh_elixir(P, e, t, src) { if (P.life > (P.startLife || 20)) drawCards(P, 1); else gainLifeFor(P, 2); },
    // Desculpting Blast
    async hh_desculpt(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const atk = (G.attackers || []).includes(x.uid);
        G.lastBounced = x.owner; G.lastMv = x.card.cmc || 0; log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand');
        if (atk) await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Drone', kw: ['flying'], artifact: true, text: 'This token can block only creatures with flying.' }, null, src);
    },
    // Dimension X Pizzasaur: two +1/+1 counters on target creature, then destroy a creature with mana value up to the number of counters you control
    async hh_pizza(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const got = putCounters(x, 2, P); log(`${x.card.name} gets ${got} +1/+1 counters.`);
        const n = P.bf.reduce((s, c) => s + Math.max(0, c.counters || 0) + Object.entries(c.ctr || {}).filter(([k]) => k !== 'menace').reduce((a, [, v]) => a + (v > 0 ? v : 0), 0), 0);
        const pool = allPerms().filter(c => isCreature(c) && (c.card.cmc || 0) <= n && !has(c, 'shroud') && !(has(c, 'hexproof') && c.owner !== P.i));
        if (!pool.length) return;
        let pick = null;
        if (P.isAI || AUTOPLAY) pick = pool.filter(c => c.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a))[0] || null;
        else pick = await pickCard(P, pool, `${src.card.name}: destroy up to one creature with mana value ${n} or less`, { required: false });
        if (pick) { log(`${src.card.name}: ${pick.card.name} is destroyed.`); destroy(pick, src); await settle(); }
    },
    // Drafna, Founder of Lat-Nam: copy an artifact spell you control (the copy becomes a token)
    hh_drafna(P, e, t, src) {
        const it = t && t.item; if (!it || it.kind !== 'spell' || !G.stack.includes(it) || !/\bArtifact\b/.test(it.o.card.type)) return;
        G.stack.push({ id: stackSeq++, kind: 'trigger', o: it.o, P, target: null, effects: [{ t: 'cmd', id: 'repToken' }], name: `${it.o.card.name} (copy)`, copy: true });
        log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${it.o.card.name}.`);
    },
    // Field-Tested Frying Pan
    async hh_pan(P, e, t, src) {
        makeArtifactToken(P, 'food');
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white Halfling', kw: [] }, null, src);
        const tok = G.lastMade;
        if (tok && onBf(tok.uid) && onBf(src.uid)) { src.attachedTo = tok.uid; log(`${src.card.name} is attached to ${tok.card.name}.`); }
    },
    hh_panBoost(P, e, t, src) {
        const h = onBf(src.attachedTo); const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (!h || n <= 0) return;
        h.tp += n; h.tq += n; log(`${h.card.name} gets +${n}/+${n} until end of turn.`);
    },
    // Hall of Tagsin
    hh_tappedStone(P, e, t, src) { const p = makeArtifactToken(P, 'powerstone'); p.tapped = true; log(`${P.name} ${you(P) ? 'create' : 'creates'} a tapped Powerstone token.`); },
    // Hidden Hideout
    async hh_hideout(P, e, t, src) {
        const pool = P.bf.filter(c => isCreature(c) && ((c.counters || 0) !== 0 || Object.entries(c.ctr || {}).some(([k, v]) => k !== 'menace' && v > 0)));
        const x = await pickOwn(P, pool, `${src.card.name}: target creature you control with a counter on it gains lifelink`, { rank: (a, b) => pow(b) - pow(a) });
        if (x) { x.tkw.push('lifelink'); log(`${x.card.name} gains lifelink until end of turn.`); }
    },
    // Ivory Tower
    hh_tower(P, e, t, src) { const x = P.hand.length - 4; if (x > 0) gainLifeFor(P, x); },
    // Lembas
    hh_lembas(P, e, t, src) { if (!src || !P.gy.includes(src)) return; pull(P.gy, src); P.library.push(src); P.library = shuffle(P.library); log(`${src.card.name} is shuffled into ${P.name === 'You' ? 'your' : `${P.name}'s`} library.`); },
    // Sickbay
    async hh_sickbay(P, e, t, src) {
        const x = 1 + (P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0);
        const c = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: put ${x} +1/+1 counter${x === 1 ? '' : 's'} on a creature you control`, { rank: (a, b) => pow(b) - pow(a) });
        if (c) { const got = putCounters(c, x, P); log(`${c.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); }
    },
    // Skyclave Relic
    hh_relic(P, e, t, src) {
        if (!src || !src.kicked) return;
        for (let i = 0; i < 2; i++) { const tok = tokenCopyOf(P, src.front && src.card === src.front ? src.front : src.card); if (tok) tok.tapped = true; }
    },
    // Sphinx of the Revelation
    hh_sphinx(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n <= 0) return; P.energy = (P.energy || 0) + n; log(`${P.name} ${you(P) ? 'get' : 'gets'} ${n} energy (${P.energy}).`); }
});
Object.assign(CMD_SCORE, { hh_suspect: () => 0, hh_expertise: () => 6, hh_elixir: () => 3, hh_desculpt: () => 5, hh_pizza: () => 7, hh_drafna: () => 5, hh_pan: () => 4, hh_panBoost: () => 2, hh_tappedStone: () => 1, hh_hideout: () => 1, hh_tower: () => 1, hh_lembas: () => 1, hh_sickbay: () => 3, hh_relic: () => 4, hh_sphinx: () => 1 });
