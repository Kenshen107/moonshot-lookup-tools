// Spellslinger Duels - engine pieces for the Astonishing Spider-Man discard / wheel deck (2026-11-05). Wordings: rules/spiderman.js. CMD ids start with hs_.
// Approximations (nothing is marked Partly): "discard one or more cards" triggers fire once per card discarded (the totals are the same); Captain Howler's
// card draw is once for each time the pumped creature hits a player; Path of the Pyromancer's planar vote does nothing (there is no planar deck);
// Memory Deluge's mana spent is the card's mana value plus anything extra paid; Underworld Breach grants escape through each card's reading and
// the grant is removed when it leaves; Nimble Obstructionist and Mirrorshell Crab target any ability on the stack that isn't yours / any spell or ability.

TRIG_FN.hg_selfAttacksHS = (o, ctx) => (ctx.list || []).some(x => x.uid === o.uid);
(function () {
    const sm = stackMatches;
    stackMatches = function (it, filter) { if (filter === 'hsAbilityTheirs') return it.kind === 'trigger'; return sm.apply(this, arguments); };
    const vt = validTargets;
    validTargets = function (P, e, src) { const r = vt.apply(this, arguments); return e && e.filter === 'hsAbilityTheirs' ? r.filter(x => x.item && x.item.P !== P) : r; };
    // Captain Howler: ward -- {2} and 2 life
    const wc = wardCheck;
    wardCheck = function (P, target, name) {
        const ok = wc.apply(this, arguments);
        if (ok && target && target.o && target.o.owner !== P.i && Rx(target.o).wardBothLife) {
            const wl = Rx(target.o).wardBothLife;
            if (P.life > wl) { P.life -= wl; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${wl} life for ward on ${target.o.card.name}.`); return true; }
            log(`${name} is countered by ward - ${P.name} can't pay ${wl} life.`); return false;
        }
        return ok;
    };
    // Captain Howler: the pumped creature draws a card when it hits a player
    const f = fire;
    fire = function (ev, ctx) {
        const r = f.apply(this, arguments);
        if (ev === 'hitPlayer' && ctx && ctx.src && ctx.src.hsHowler && ctx.src.hsHowler.turn === G.turn) { const P = G.players[ctx.src.hsHowler.by]; if (P && !P.out) { log(`${ctx.src.card.name} hits a player: ${P.name} draws a card (Captain Howler).`); drawCards(P, 1); } }
        return r;
    };
    // Underworld Breach: every nonland card in your graveyard has escape (mana cost plus exile three other cards)
    function breachSync() {
        if (!G || !G.players) return;
        G.players.forEach(P => {
            const on = P.bf.some(x => Rx(x).hsBreach && !lostAbilities(x));
            P.gy.forEach(c => {
                const R = Rx(c); if (!R) return;
                if (on && R.kind !== 'land' && !R.escape) R.escape = { n: 3, cost: { ...R.cost }, hsGranted: true };
                else if (!on && R.escape && R.escape.hsGranted) delete R.escape;
            });
        });
    }
    const sb = sba; sba = function () { const r = sb.apply(this, arguments); breachSync(); return r; };
    const st = settle; settle = async function () { const r = await st.apply(this, arguments); breachSync(); return r; };
})();

// Discard your whole hand (a person has no choice to make)
function hsDiscardHand(P) {
    const n = P.hand.length; if (!n) return 0;
    P.hand.forEach(c => { c.discardTurn = G.turn; });
    P.gy.push(...P.hand.splice(0)); noteDiscard(P, n);
    log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${n} card${n === 1 ? '' : 's'} (their hand).`);
    return n;
}
const hsDiscardedNow = P => (P.discardTurn === G.turn ? P.discardN || 0 : 0);

Object.assign(CMD, {
    // Astonishing Spider-Man: whenever he attacks, you may discard your hand; if you do, draw a card for each card discarded this turn
    async hs_wheelAttack(P, e, t, src) {
        if (!P.hand.length) return;
        const yes = (P.isAI || AUTOPLAY) ? P.hand.length <= 3 : await askYes(P, `${src.card.name}: discard your hand (${P.hand.length} cards), then draw a card for each card you've discarded this turn?`, { card: src.card });
        if (!yes) return;
        hsDiscardHand(P); drawCards(P, hsDiscardedNow(P));
    },
    // Change of Fortune
    hs_wheelMine(P, e, t, src) { hsDiscardHand(P); drawCards(P, hsDiscardedNow(P)); },
    // Path of the Pyromancer
    hs_pyromancer(P, e, t, src) {
        const n = hsDiscardHand(P);
        P.pool = (P.pool || []).concat(Array.from({ length: n }, () => 'R')); log(`${P.name} add${you(P) ? '' : 's'} ${n} {R}.`);
        drawCards(P, n + 1);
        log('Planar vote: there is no planar deck here, so nothing happens.');
    },
    // Rush of Inspiration
    async hs_rush(P, e, t, src) {
        drawCards(P, 2);
        const canPay = (P.energy || 0) >= 2;
        const pay = canPay && ((P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: pay {E}{E} to keep your hand? (Otherwise discard a card at random.)`, { card: src.card, yes: 'Pay {E}{E}', no: 'Discard at random' }));
        if (pay) { P.energy -= 2; log(`${P.name} pay${you(P) ? '' : 's'} {E}{E}.`); return; }
        if (!P.hand.length) return;
        const d = P.hand.splice(rand(P.hand.length), 1)[0]; P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1);
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} (at random).`);
    },
    // Memory Deluge: look at the top X cards (X = mana spent), two to hand, the rest on the bottom in random order
    async hs_deluge(P, e, t, src) {
        const x = Math.max(1, src.manaSpent !== undefined ? src.manaSpent : (src.card.cmc || 0));
        const top = P.library.splice(Math.max(0, P.library.length - x), x).reverse();
        if (!top.length) return;
        const keep = [];
        for (let k = 0; k < 2 && top.length; k++) {
            let c;
            if (P.isAI || AUTOPLAY) c = top.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0];
            else c = await pickCard(P, top, `${src.card.name}: put ${k === 0 ? 'one' : 'a second'} of these into your hand`, { required: true });
            if (!c) c = top[0]; keep.push(c); top.splice(top.indexOf(c), 1);
        }
        keep.forEach(c => P.hand.push(c));
        shuffle(top).forEach(c => P.library.unshift(c));
        log(`${P.name} look${you(P) ? '' : 's'} at ${keep.length + top.length} cards, put ${keep.length} into hand and the rest on the bottom.`);
    },
    // Flame Blitz
    hs_blitz(P, e, t, src) { allPerms().filter(x => /\bPlaneswalker\b/.test(x.card.type)).forEach(x => damage(x, 5, src)); },
    // Captain Howler: +2/+0 for each card discarded; the creature draws on combat damage to a player
    hs_howler(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        x.tp += 2; x.hsHowler = { turn: G.turn, by: P.i }; log(`${x.card.name} gets +2/+0 until end of turn.`);
    },
    // Mystic Redaction
    hs_mill2(P, e, t, src) { foes(P).forEach(F => doMill(F, 2)); },
    // Ominous Seas
    hs_seas(P, e, t, src) { if (!onBf(src.uid)) return; src.ctr.foreshadow = (src.ctr.foreshadow || 0) + 1; },
    // Imaginary Threats: the target player's creatures attack, then don't untap
    hs_threats(P, e, t, src) {
        const X = t && t.p; if (!X) return;
        X.bf.filter(isCreature).forEach(c => { c.mustAttackTurn = G.turn; c.skipUntap = true; });
        log(`${X.name}'s creatures must attack this turn and won't untap in their next untap step.`);
    }
});
Object.assign(CMD_SCORE, { hs_wheelAttack: () => 4, hs_wheelMine: () => 5, hs_pyromancer: () => 5, hs_rush: () => 4, hs_deluge: () => 6, hs_blitz: () => 1, hs_howler: () => 3, hs_mill2: () => 1, hs_seas: () => 1, hs_threats: () => 5 });
