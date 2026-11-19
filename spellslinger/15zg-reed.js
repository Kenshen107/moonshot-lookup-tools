// Spellslinger Duels - engine pieces for the Reed Richards, Smartest Man deck (2026-11-19). Wordings: rules/reed.js. CMD ids start with rr_.
// Approximations (nothing is marked Partly): choices inside resolving spells (Illusionist's Stratagem, Trade the Helm) are made as they resolve;
// Curse of Surveillance lets a person pick the drawing players (the computer picks only itself); Curse of Verbosity draws once per attack
// declaration at the enchanted player; mana spent for Uncover the Moon-Letters is the spell's mana value.

TRIG_FN.rr_myDiscard = (o, ctx) => !!ctx.P && ctx.P.i === o.owner;
TRIG_FN.rr_myDraw = (o, ctx) => !ctx.P || ctx.P.i === o.owner;
(function () {
    const sm = stackMatches;
    stackMatches = function (it, filter) {
        if (filter === 'rrActivated') return it.kind === 'trigger' && !!it.ability;
        if (filter === 'rrActivatedNoPW') return it.kind === 'trigger' && !!it.ability && !!it.o && !isPlaneswalker(it.o);
        return sm.apply(this, arguments);
    };
    const cm = cloneMatches;
    cloneMatches = function (x, what, P) { if (what === 'artifact or creature you control') return x.owner === P.i && (/\bArtifact\b/.test(x.card.type) || isCreature(x)); return cm.apply(this, arguments); };
    const ca = canActivate;
    canActivate = function (P, o, a) { if (o && o.rrNoAct === G.turn && !(a && a.mana)) return false; return ca.apply(this, arguments); };
    // Confounding Conundrum (lands entering) and Curse of Verbosity (attacks)
    const f = fire;
    fire = function (ev, ctx = {}) {
        const r = f.apply(this, arguments);
        try {
            if (G && !G.over && ev === 'landfall' && ctx.o) {
                const X = G.players[ctx.o.owner];
                if (X) {
                    const L = X.rrLands && X.rrLands.turn === G.turn ? X.rrLands : (X.rrLands = { turn: G.turn, n: 0 });
                    L.n++;
                    if (L.n >= 2) allPerms().filter(s => Rx(s).rrConundrum && !lostAbilities(s) && s.owner !== X.i).forEach(s => (G.trigQ = G.trigQ || []).push({ P: G.players[s.owner], o: s, effects: [cmd('rr_conundrum', { vic: X.i })] }));
                }
            }
            if (G && !G.over && ev === 'attacks' && ctx.list && ctx.list.length) {
                allPerms().filter(s => Rx(s).rrVerbosity && !lostAbilities(s) && s.hostPlayer !== undefined).forEach(s => {
                    const owner = G.players[s.owner], at = ctx.list.filter(a => (a.atkTo !== undefined ? a.atkTo : G.defender) === s.hostPlayer);
                    if (!at.length || !owner || owner.out) return;
                    const drawers = [owner.i, ...new Set(at.map(a => a.owner).filter(i => i !== owner.i))];
                    (G.trigQ = G.trigQ || []).push({ P: owner, o: s, effects: [cmd('rr_verbose', { who: drawers })] });
                });
            }
        } catch (err) { /* never let a watcher stop the game */ }
        return r;
    };
})();

// An immediate blink: exiled and straight back (a token is gone for good)
function rrBlinkNow(x) {
    if (!x || !onBf(x.uid)) return;
    const X = G.players[x.realOwner ?? x.owner];
    leaveBattlefield(x, 'exile');
    log(`${x.card.name} is exiled.`);
    if (X && X.exile.includes(x)) { pull(X.exile, x); putOntoBattlefield(X, x, false); log(`${x.card.name} returns to the battlefield.`); }
}

Object.assign(CMD, {
    // ---- Bag of Holding ----
    rr_bagExile(P, e, t, src) {
        const c = G.ctxRaw && G.ctxRaw.o; if (!c || !P.gy.includes(c)) return;
        pull(P.gy, c); P.exile.push(c); (src.rrHeld = src.rrHeld || []).push(c);
        log(`${src.card.name} exiles ${c.card.name} from ${P.name}'s graveyard.`);
    },
    rr_bagReturn(P, e, t, src) {
        const held = (src.rrHeld || []).slice(); src.rrHeld = [];
        held.forEach(c => { const X = G.players[c.realOwner ?? c.owner]; if (X && X.exile.includes(c)) { pull(X.exile, c); X.hand.push(c); } });
        log(`${src.card.name}: ${held.length} card${held.length === 1 ? '' : 's'} returned to their owners' hands.`);
    },
    // ---- Confounding Conundrum ----
    async rr_conundrum(P, e, t, src) {
        const X = G.players[e.vic]; if (!X || X.out) return;
        const lands = X.bf.filter(x => /\bLand\b/.test(x.card.type)).sort((a, b) => (b.tapped - a.tapped) || (isBasic(b.card) - isBasic(a.card)));
        if (!lands.length) return;
        let l = lands[0];
        if (!X.isAI && !AUTOPLAY && lands.length > 1) l = (await pickCard(X, lands, `${src.card.name}: choose a land to return to your hand`, { required: true })) || l;
        leaveBattlefield(l, 'hand'); log(`${src.card.name}: ${X.name} ${you(X) ? 'return' : 'returns'} ${l.card.name} to hand.`);
    },
    // ---- Curses ----
    async rr_survey(P, e, t, src) {
        const X = G.players[src.hostPlayer]; if (!X || X.out) return;
        const n = allPerms().filter(c => c.hostPlayer === X.i && /\bCurse\b/.test(c.card.type)).length;
        const cands = G.players.filter(p => !p.out && p !== X); if (!n || !cands.length) return;
        let chosen = cands.includes(P) ? [P] : [];
        if (!P.isAI && !AUTOPLAY && cands.length > 1) chosen = await pickPlayers(P, `${src.card.name}: who draws ${n} card${n === 1 ? '' : 's'}?`, cands, [P.i]);
        chosen.forEach(p => { log(`${src.card.name}: ${p.name} ${you(p) ? 'draw' : 'draws'} ${n}.`); drawCards(p, n); });
    },
    rr_verbose(P, e, t, src) {
        (e.who || []).forEach(i => { const p = G.players[i]; if (p && !p.out) { log(`${src.card.name}: ${p.name} ${you(p) ? 'draw' : 'draws'} a card.`); drawCards(p, 1); } });
    },
    // ---- Illusionist's Stratagem ----
    async rr_stratagem(P, e, t, src) {
        const pool = P.bf.filter(isCreature);
        if (!pool.length) return;
        let chosen = [];
        if (!P.isAI && !AUTOPLAY) {
            for (let k = 0; k < 2; k++) {
                const left = pool.filter(x => !chosen.includes(x) && onBf(x.uid)); if (!left.length) break;
                const c = await pickCard(P, left, `${src.card.name}: exile up to two creatures you control (${k + 1} of 2)`); if (!c) break; chosen.push(c);
            }
        } else chosen = pool.filter(x => !x.token && frEtbValue(x) >= 3).sort((a, b) => frEtbValue(b) - frEtbValue(a)).slice(0, 2);
        chosen.forEach(rrBlinkNow);
    },
    // ---- Interdict ----
    rr_interdict(P, e, t, src) {
        const it = G.lastCountered;
        if (it && it.kind === 'trigger' && it.ability && it.o && !G.stack.includes(it)) { it.o.rrNoAct = G.turn; log(`${it.o.card.name}'s abilities can't be activated this turn.`); }
    },
    // ---- Jace's Erasure ----
    async rr_erasure(P, e, t, src) {
        const X = t && t.p; if (!X) return;
        if (!P.isAI && !AUTOPLAY && !(await askYes(P, `${src.card.name}: have ${X.name} mill a card?`, { card: src.card }))) return;
        if (P.isAI && X === P) return; // never mills itself
        doMill(X, 1);
    },
    // ---- Trade the Helm ----
    async rr_trade(P, e, t, src) {
        const ok = x => /\bArtifact\b/.test(x.card.type) || isCreature(x);
        const mine = P.bf.filter(ok), theirs = allPerms().filter(x => x.owner !== P.i && ok(x) && !has(x, 'shroud') && !has(x, 'hexproof'));
        if (!mine.length || !theirs.length) return;
        let a = mine.slice().sort((p, q) => permValue(p) - permValue(q))[0], b = theirs.slice().sort((p, q) => permValue(q) - permValue(p))[0];
        if (!P.isAI && !AUTOPLAY) {
            a = (await pickCard(P, mine, `${src.card.name}: choose a permanent you control to trade away`, { required: true })) || a;
            b = (await pickCard(P, theirs, `${src.card.name}: choose a permanent an opponent controls to take`, { required: true })) || b;
        }
        if (!a || !b || !onBf(a.uid) || !onBf(b.uid)) return;
        const A = ctrl(a), B = ctrl(b);
        giveControl(a, B); giveControl(b, A);
        log(`${src.card.name}: ${A.name} and ${B.name} exchange control of ${a.card.name} and ${b.card.name}.`);
    },
    // ---- Uncover the Moon-Letters ----
    async rr_moonLetters(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const x = sp ? sp.card.cmc || 0 : 0; if (x <= 0) return;
        if (P.isAI || AUTOPLAY ? P.library.length < x + 8 || P.hand.length > 3 : !(await askYes(P, `${src.card.name}: draw ${x} card${x === 1 ? '' : 's'}, then discard two?`, { card: src.card }))) return;
        drawCards(P, x);
        for (let k = 0; k < 2 && P.hand.length; k++) {
            if (P.isAI || AUTOPLAY) { const d = P.hand.slice().sort((p, q) => (p.card.cmc || 0) - (q.card.cmc || 0) || (Rx(p).kind === 'land') - (Rx(q).kind === 'land'))[0]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} discards ${d.card.name}.`); }
            else await discardChosen(P, `${src.card.name}: discard a card (${k + 1} of 2)`);
        }
    }
});
