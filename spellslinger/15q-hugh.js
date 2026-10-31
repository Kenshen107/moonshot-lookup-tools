// Spellslinger Duels - engine pieces for the Hugh, First of Many artifact deck (2026-10-31). Wordings: rules/hugh.js. CMD ids start with hg_.
// Approximations (nothing is marked Partly): choices inside resolving abilities are made as they resolve; Cargo Ship's mana is limited to
// artifact spells (not abilities of artifact sources); Coin of Mastery counts one mana per artifact source in the payment; Cyberman creatures
// made by The Cyber-Controller are tokens (the milled cards stay in the graveyard's history, not face down); Coin of Fate's opponent
// picks the card by value (not asked of a person); Weeping Angel's "isn't a creature" lasts until the end of that turn.

Object.assign(TRIG_FN, {
    hg_selfHits: (o, ctx) => ctx.src === o && (ctx.hit || []).some(H => H.i !== o.owner),
    hg_myFood: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Food'),
    hg_oppCreatureCast: (o, ctx) => !!ctx.o && ctx.P && ctx.P.i !== o.owner && Rx(ctx.o).kind === 'creature'
});

const hgArtifactCreature = x => isCreature(x) && /\bArtifact\b/.test(x.card.type);

Object.assign(CMD, {
    // Recruit: draw a card, then discard a card; a nonland discard makes a 1/1 white Human Soldier
    async hg_recruit(P, e, t, src, O, name) {
        drawCards(P, 1);
        if (!P.hand.length) return;
        const d = await chooseDiscard(P, name || (src && src.card.name) || 'Recruit');
        if (!d) return;
        pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn;
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`);
        if (Rx(d).kind !== 'land') await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white Human Soldier', kw: [] }, null, src);
    },
    // Colossal Plow: {W}{W}{W} that stays until end of turn, and 3 life
    async hg_plow(P, e, t, src) {
        P.pool = (P.pool || []).concat(['W', 'W', 'W']); P.keepPoolTurn = G.turn;
        log(`${P.name} add${you(P) ? '' : 's'} {W}{W}{W} (it stays until end of turn).`);
        await applyEffect(P, { t: 'gain', n: 3 }, null, src);
    },
    // Cyberdrive Awakener
    hg_awakener(P, e, t, src) {
        for (const x of P.bf.filter(y => /\bArtifact\b/.test(y.card.type) && !isCreature(y))) { x.animated = { turn: G.turn, p: 4, q: 4, kw: [] }; log(`${x.card.name} becomes a 4/4 artifact creature until end of turn.`); }
    },
    // Cybermat
    hg_cybermat(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const n = G.attackers.map(onBf).filter(x => x && hgArtifactCreature(x)).length;
        src.tp += n; log(`${src.card.name} gets +${n}/+0 until end of turn.`);
    },
    // Demonic Junker: each player may have one of their creatures destroyed; two counters if one of yours died
    async hg_junker(P, e, t, src) {
        let mine = false;
        for (const X of G.players.filter(p => !p.out)) {
            const pool = X.bf.filter(isCreature);
            if (!pool.length) continue;
            let pick = null;
            if (P.isAI || AUTOPLAY) pick = X === P ? null : (() => { const b = pool.slice().sort((a, c) => creatureValue(c) - creatureValue(a))[0]; return creatureValue(b) >= 4 ? b : null; })();
            else pick = await pickCard(P, pool, `${src.card.name}: destroy up to one creature ${X === P ? 'you control' : `${X.name} controls`}`, { required: false });
            if (!pick) continue;
            const was = onBf(pick.uid); destroy(pick, src); await settle();
            if (X === P && was && !onBf(pick.uid)) mine = true;
        }
        if (mine && onBf(src.uid)) putCounters(src, 2, P);
    },
    // Ethersworn Shieldmage
    hg_shieldmage(P, e, t, src) { G.hgPrevArt = G.turn; log('All damage to artifact creatures is prevented this turn.'); },
    // Luxurious Locomotive
    hg_loco(P, e, t, src) {
        const n = src.crewTurn === G.turn ? src.crewN || 0 : 0;
        for (let i = 0; i < n; i++) makeArtifactToken(P, 'treasure');
        if (n) log(`${P.name} create${you(P) ? '' : 's'} ${n} Treasure token${n === 1 ? '' : 's'}.`);
    },
    // Mole Module: mill four, you may put a permanent card from among them onto the battlefield
    async hg_mole(P, e, t, src) {
        const before = P.gy.length; doMill(P, 4);
        const milled = P.gy.slice(before).filter(c => !/\b(?:Instant|Sorcery)\b/.test(c.card.type));
        if (!milled.length) return;
        const pick = (P.isAI || AUTOPLAY) ? milled.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, milled, `${src.card.name}: put a permanent card onto the battlefield?`, { required: false });
        if (pick) reanimateFrom(P, P, pick);
    },
    hg_tappedTreasure(P, e, t, src) { const o = makeArtifactToken(P, 'treasure'); if (o) o.tapped = true; },
    // Refurbished Familiar
    async hg_familiar(P, e, t, src) {
        let draws = 0;
        for (const F of foes(P)) {
            if (!F.hand.length) { draws++; continue; }
            const d = await chooseDiscard(F, src.card.name); if (!d) { draws++; continue; }
            pull(F.hand, d); F.gy.push(d); d.discardTurn = G.turn; log(`${F.name} ${you(F) ? 'discard' : 'discards'} ${d.card.name}.`);
        }
        if (draws) drawCards(P, draws);
    },
    // The Cyber-Controller: each opponent mills X; creature cards milled come under your control as 2/2 Cyberman artifact creatures
    async hg_controller(P, e, t, src) {
        const X = Number(e.n) || src.xVal || 0; if (!X) return;
        for (const F of foes(P)) {
            const before = F.gy.length; doMill(F, X);
            for (const c of F.gy.slice(before).filter(c => /\bCreature\b/.test(c.card.type))) {
                pull(F.gy, c);
                const card = { id: `cyberman-${uidSeq++}`, name: 'Cyberman', fullName: 'Cyberman token', cost: '', cmc: 0, type: 'Token Artifact Creature — Cyberman', text: '', power: '2', toughness: '2', colors: [], ci: [], img: null, imgS: null };
                const o = makeObj(card, P.i, { token: true });
                putOntoBattlefield(P, o);
            }
        }
        log(`${P.name} take${you(P) ? '' : 's'} the milled creatures as 2/2 Cyberman artifact creatures.`);
    },
    // Torrential Gearhulk
    async hg_gearhulk(P, e, t, src) {
        const pool = P.gy.filter(c => Rx(c).kind === 'instant' && Rx(c).support !== 'none'); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: cast an instant card from your graveyard without paying its mana cost?`, { optional: true }); if (!c) return;
        c.exileAfter = true; if (!await castFreeAuto(P, c)) c.exileAfter = false;
    },
    // Weeping Angel
    hg_angelOff(P, e, t, src) { if (onBf(src.uid)) { src.hgNotCr = G.turn; log(`${src.card.name} isn't a creature until end of turn.`); } },
    // Coin of Fate: exile two creature cards from your graveyard; an opponent picks one for the bottom, the other returns tapped; you become the monarch
    async hg_coinFate(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type));
        if (pool.length < 2) return;
        let two;
        if (P.isAI || AUTOPLAY) two = pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)).slice(0, 2);
        else { const a = await pickCard(P, pool, `${src.card.name}: exile the first creature card`, { required: true }); const b = await pickCard(P, pool.filter(x => x !== a), `${src.card.name}: exile the second creature card`, { required: true }); two = [a, b].filter(Boolean); }
        if (two.length < 2) return;
        two.forEach(c => { pull(P.gy, c); P.exile.push(c); });
        const opp = foes(P)[0] || P;
        const bottom = two.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0], back = two.find(c => c !== bottom);
        pull(P.exile, bottom); resetObj(bottom); P.library.unshift(bottom); log(`${opp.name} choose${opp === P ? '' : 's'} ${bottom.card.name}: it goes to the bottom of ${P.name}'s library.`);
        pull(P.exile, back); resetObj(back); back.tapped = true; back.enteredTurn = G.turn; P.bf.push(back); log(`${back.card.name} returns to the battlefield tapped.`); fire('enters', { o: back });
        if (Rx(back).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: back, effects: Rx(back).etb });
        G.monarch = P.i; log(`${P.name} ${you(P) ? 'become' : 'becomes'} the monarch.`);
    }
});
Object.assign(CMD_SCORE, { hg_recruit: () => 3, hg_plow: () => 5, hg_awakener: () => 2, hg_cybermat: () => 3, hg_junker: P => (foes(P).some(F => F.bf.some(isCreature)) ? 7 : 2), hg_shieldmage: () => 1, hg_loco: () => 3, hg_mole: () => 4, hg_tappedTreasure: () => 2, hg_familiar: () => 4, hg_controller: () => 8, hg_gearhulk: P => (P.gy.some(c => Rx(c).kind === 'instant') ? 7 : 0), hg_angelOff: () => 0, hg_coinFate: P => (P.gy.filter(c => /\bCreature\b/.test(c.card.type)).length >= 2 ? 7 : 0) });

// Ethersworn Shieldmage: damage to artifact creatures is prevented this turn
{
    const base = damage;
    damage = function (target, n, src) {
        if (G && G.hgPrevArt === G.turn && target && target.card && hgArtifactCreature(target)) { if (n > 0) log(`The damage to ${target.card.name} is prevented.`); return; }
        // Weeping Angel: damage it would deal to a creature is prevented and that creature is shuffled into its owner's library
        if (G && src && src.card && target && target.card && n > 0 && Rx(src).weepingAngel && !lostAbilities(src) && isCreature(target) && onBf(target.uid)) {
            const X = G.players[target.owner]; log(`${src.card.name}'s damage is prevented: ${target.card.name} is shuffled into ${X.name}'s library.`);
            leaveBattlefield(target, 'library'); X.library = shuffle(X.library); return;
        }
        return base.apply(this, arguments);
    };
}
// Coin of Mastery: creatures you cast enter with an extra +1/+1 counter for each mana from an artifact source (reuses Biophagus's counter)
{
    const base = manaRiders;
    manaRiders = function (P, o, plan) {
        base.apply(this, arguments);
        if (Rx(o).kind !== 'creature') return;
        const coins = P.bf.filter(a => Rx(a).coinMastery && !lostAbilities(a)).length;
        if (!coins) return;
        const n = plan.filter(x => !x.pool && x.card && /\bArtifact\b/.test(x.card.type)).length;
        if (n) o.bt_extraCtr = (o.bt_extraCtr || 0) + n * coins;
    };
}
// Crew: remember how many creatures crewed a Vehicle (Luxurious Locomotive), and "activate only once each turn"
