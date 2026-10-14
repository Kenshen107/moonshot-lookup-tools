// =====================================================================
// Engine cases for the Uldaros Theorix deck (2026-10-15, owner's request: make every card in the deck playable).
// Mill, "reveal until a land", exile-until-mana-value, rad counters, manifest, clone exceptions, Impending, Uldaros's copies.
// Wordings are in rules/uldaros.js. preconEffect (15b-precon-effects.js) falls through to uldEffect for these effect types.
// =====================================================================

// ---- Milling (701.17) ----
// The Water Crystal: "If an opponent would mill one or more cards, they mill that many plus four instead."
function millBonusFor(X) {
    return allPerms().filter(o => o.owner !== X.i && Rx(o).millPlus && !lostAbilities(o)).reduce((s, o) => s + Rx(o).millPlus, 0);
}
function doMill(X, n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return [];
    n += millBonusFor(X);
    const milled = X.library.splice(-Math.min(n, X.library.length)).reverse();
    X.gy.push(...milled);
    log(`${X.name} ${you(X) ? 'mill' : 'mills'} ${milled.length}${milled.length ? `: ${milled.map(x => x.card.name).slice(0, 6).join(', ')}${milled.length > 6 ? ', ...' : ''}` : ''}.`);
    if (milled.length) fire('milled', { P: X, cards: milled });
    return milled;
}
// "Reveal cards from the top of the library until N land cards are revealed; put all of them into the graveyard" (not milling: no bonus)
function revealUntilLands(X, n) {
    const got = [];
    let lands = 0;
    while (X.library.length && lands < n) {
        const c = X.library.pop();
        got.push(c);
        if (Rx(c).kind === 'land' || /\bLand\b/.test(c.card.type)) lands++;
    }
    X.gy.push(...got);
    log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${got.length} card${got.length === 1 ? '' : 's'} (${lands} land${lands === 1 ? '' : 's'}) and ${you(X) ? 'put' : 'puts'} them into ${you(X) ? 'your' : 'their'} graveyard.`);
    if (got.length) fire('milled', { P: X, cards: got });
    return got;
}
// ---- Rad counters (727): at the start of your precombat main, mill that many; each nonland card costs 1 life and a rad counter ----
function addRad(X, n) { if (n <= 0) return; X.rad = (X.rad || 0) + n; log(`${X.name} ${you(X) ? 'get' : 'gets'} ${n} rad counter${n === 1 ? '' : 's'}.`); }
async function radTick(P) {
    if (!(P.rad > 0) || G.over) return;
    const milled = doMill(P, P.rad);
    const k = milled.filter(c => !/\bLand\b/.test(c.card.type)).length;
    if (k > 0) {
        P.life -= k; P.rad = Math.max(0, P.rad - k);
        log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${k} life and ${k} rad counter${k === 1 ? '' : 's'} (${P.rad} left).`);
        fire('loseLife', { P, n: k });
    }
}
// ---- Manifest (701.34): the top card goes onto the battlefield face down as a 2/2; a creature card turns up for its mana cost ----
function manifestTop(X) {
    const x = X.library.pop();
    if (!x) return null;
    resetObj(x);
    x.fdCard = x.card; x.card = faceDownCard(false); x.manifest = true;
    x.owner = X.i; x.enteredTurn = G.turn;
    X.bf.push(x);
    log(`${X.name} ${you(X) ? 'manifest' : 'manifests'} the top card of ${you(X) ? 'your' : 'their'} library.`);
    fire('enters', { o: x });
    return x;
}
// A manifested creature card can be turned up for its mana cost (cost used by canTurnUp / turnFaceUp)
function fdTurnCost(o) {
    if (!o.fdCard) return null;
    const m = Rx({ card: o.fdCard }).morph;
    if (m) return m;
    return o.manifest && /\bCreature\b/.test(o.fdCard.type) ? Rx({ card: o.fdCard }).cost : null;
}
// ---- Take a card from any graveyard onto the battlefield under your control ----
function reanimateFrom(P, X, x) {
    pull(X.gy, x);
    resetObj(x);
    if (X !== P) { x.realOwner = x.owner; x.owner = P.i; }
    x.enteredTurn = G.turn;
    P.bf.push(x);
    log(`${x.card.name} enters the battlefield under ${you(P) ? 'your' : `${P.name}'s`} control.`);
    fire('enters', { o: x });
    if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: x, effects: Rx(x).etb });
}
function gyOwnerOf(x) { return G.players.find(X => X.gy.includes(x)); }
const ULD_TYPES = ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker', 'Battle'];

async function uldEffect(P, e, t, src, O, name) {
    switch (e.t) {
        // "Each opponent mills N cards" (a number, half their library, or a count worked out already); kicked Maddening Cacophony mills half instead
        case 'millFoes': {
            let n = e.n;
            if (e.kickedHalf && src && src.kicked) n = Math.ceil(O.library.length / 2);
            doMill(O, n);
            break;
        }
        case 'millSelf': doMill(P, e.n); break;
        // Terisian Mindbreaker (up), Singularity Rupture (down)
        case 'millHalf': case 'millHalfFoes': {
            const X = e.who === 'self' ? P : O;
            doMill(X, e.down ? Math.floor(X.library.length / 2) : Math.ceil(X.library.length / 2));
            break;
        }
        case 'millUntilLands': case 'revealLandsOne': revealUntilLands(O, e.n === 'X' ? (G.curX || 0) : e.n); break;
        // Trepanation Blade: the attacker gets +1/+0 for each card revealed
        case 'bladeReveal': {
            const got = revealUntilLands(O, 1);
            if (src && onBf(src.uid)) { const eq = allPerms().find(x => x.uid === src.attachedTo); const who = eq || src; who.tp += got.length; log(`${who.card.name} gets +${got.length}/+0 until end of turn.`); }
            break;
        }
        // Dream Harvest / Tasha's Hideous Laughter: exile from the top until the total mana value reaches N
        case 'exileUntilMv': {
            const got = [];
            let total = 0;
            while (O.library.length && total < e.mv) { const c = O.library.pop(); got.push(c); total += c.card.cmc || 0; }
            got.forEach(c => { O.exile.push(c); });
            log(`${O.name} ${you(O) ? 'exile' : 'exiles'} ${got.length} card${got.length === 1 ? '' : 's'} from the top of ${you(O) ? 'your' : 'their'} library (total mana value ${total}).`);
            if (e.cast) {
                for (const c of got.slice()) {
                    if (G.over || !O.exile.includes(c) || Rx(c).kind === 'land' || Rx(c).support === 'none') continue;
                    const te = firstTargetEffect(c);
                    if (te && !validTargets(P, te, c).length) continue;
                    const yes = P.isAI || AUTOPLAY ? true : await askYes(P, `${name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card, yes: 'Cast it', no: 'Skip' });
                    if (!yes) continue;
                    pull(O.exile, c);
                    c.realOwner = c.owner; c.owner = P.i;
                    P.exile.push(c);
                    const ok = await castFreeNow(P, c, P.exile);
                    if (!ok) { pull(P.exile, c); O.exile.push(c); c.owner = c.realOwner; }
                    else c.realOwner = c.realOwner ?? O.i;
                }
            }
            break;
        }
        // Nuclear Fallout: each creature gets twice -X/-X until end of turn; each player gets X rad counters
        case 'fallout': {
            const k = e.n === 'X' ? (G.curX || 0) : Number(e.n) || 0;
            allPerms().filter(isCreature).forEach(c => { c.tp -= 2 * k; c.tq -= 2 * k; });
            log(`${name}: each creature gets -${2 * k}/-${2 * k} until end of turn.`);
            G.players.filter(X => !X.out).forEach(X => addRad(X, k));
            sba();
            break;
        }
        // Syphon Mind: each other player discards a card; you draw a card for each discarded this way
        case 'syphon': {
            let n = 0;
            for (const X of foes(P)) {
                if (!X.hand.length) continue;
                const d = await chooseDiscard(X, name);
                if (!d) continue;
                pull(X.hand, d); X.gy.push(d); discardMark([d]);
                log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${d.card.name}.`);
                n++;
            }
            if (n) drawCards(P, n);
            break;
        }
        // Reality Shift: exile target creature (done by the effect before this one); its controller manifests
        case 'manifestCtrl': { const X = (G.lastPower && G.lastPower.P) || O; manifestTop(X); break; }
        // Doomsday Excruciator: if it was cast, each player exiles all but the bottom six cards of their library face down
        case 'doomsday': {
            G.players.filter(X => !X.out).forEach(X => {
                const keep = X.library.splice(0, Math.min(6, X.library.length)); // the bottom of the library is its start
                const gone = X.library.splice(0);
                X.library.push(...keep);
                X.exile.push(...gone);
                log(`${X.name} ${you(X) ? 'exile' : 'exiles'} all but the bottom ${keep.length} cards of ${you(X) ? 'your' : 'their'} library (${gone.length} cards).`);
            });
            break;
        }
        // Extract from Darkness: each player mills two; then you put a creature card from a graveyard onto the battlefield under your control
        case 'extractDark': {
            G.players.filter(X => !X.out).forEach(X => doMill(X, 2));
            const pool = G.players.flatMap(X => X.gy.filter(x => /\bCreature\b/.test(x.card.type)));
            if (!pool.length) break;
            const pickC = P.isAI ? pool.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, pool, `${name}: put a creature card from a graveyard onto the battlefield`, { required: true });
            if (pickC) reanimateFrom(P, gyOwnerOf(pickC) || P, pickC);
            break;
        }
        // Breach the Multiverse: each player mills ten; for each player, a creature or planeswalker from their graveyard comes to you; your creatures become Phyrexians
        case 'breach': {
            G.players.filter(X => !X.out).forEach(X => doMill(X, 10));
            for (const X of G.players.filter(Y => !Y.out)) {
                const pool = X.gy.filter(x => /\b(Creature|Planeswalker)\b/.test(x.card.type));
                if (!pool.length) continue;
                const c = P.isAI ? pool.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, pool, `${name}: choose a creature or planeswalker card in ${you(X) ? 'your' : `${X.name}'s`} graveyard`, { required: true });
                if (c) reanimateFrom(P, X, c);
            }
            P.bf.filter(isCreature).forEach(c => { if (!/\bPhyrexian\b/.test(c.card.type)) c.card = { ...c.card, type: /—/.test(c.card.type) ? `${c.card.type} Phyrexian` : `${c.card.type} — Phyrexian` }; });
            log(`${name}: each creature ${you(P) ? 'you control' : `${P.name} controls`} becomes a Phyrexian.`);
            break;
        }
        // Ripples of Undeath: mill three, then you may pay {1} and 3 life to put a card from among them into your hand
        case 'ripples': {
            const milled = doMill(P, 3);
            if (!milled.length || P.life <= 3) break;
            const plan = planPayment(P, parseCost('{1}'));
            if (!plan) break;
            const yes = P.isAI || AUTOPLAY ? milled.some(c => aiKeepValue(P, c) >= 3) && P.life > 8 : await askYes(P, `${name}: pay {1} and 3 life to put a card from among the milled cards into your hand?`, { card: src.card });
            if (!yes) break;
            plan.forEach(x => tapSource(P, x));
            P.life -= 3; fire('loseLife', { P, n: 3 });
            const c = P.isAI || AUTOPLAY ? milled.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, milled, `${name}: put a card into your hand`, { required: true });
            if (c && P.gy.includes(c)) { pull(P.gy, c); P.hand.push(c); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand (paid {1} and 3 life).`); }
            break;
        }
        // Overlord of the Balemurk: after milling, you may return a non-Avatar creature card or a planeswalker card from your graveyard to your hand
        case 'overlordReturn': {
            const pool = P.gy.filter(x => (/\bCreature\b/.test(x.card.type) && !/\bAvatar\b/.test(x.card.type)) || /\bPlaneswalker\b/.test(x.card.type));
            if (!pool.length) break;
            const c = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, pool, `${name}: return a non-Avatar creature or a planeswalker card to your hand (or skip)`);
            if (c) { pull(P.gy, c); P.hand.push(c); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${c.card.name} to ${you(P) ? 'your' : 'their'} hand.`); }
            break;
        }
        // Fraying Sanity (an Aura on a player): it enchants an opponent; at each end step that player mills as many cards as went to their graveyard this turn
        case 'enchantPlayer': {
            const fs = foes(P);
            if (!fs.length) break;
            let X = fs[0];
            if (!P.isAI && !AUTOPLAY && fs.length > 1) { X = (await pickPlayer(P, fs, `${name}: enchant`)) || X; }
            else X = fs.slice().sort((a, b) => b.library.length - a.library.length)[0];
            src.hostPlayer = X.i;
            log(`${name} enchants ${you(X) ? 'you' : X.name}.`);
            break;
        }
        case 'frayTick': {
            if (src.hostPlayer === undefined) break;
            const X = G.players[src.hostPlayer];
            if (!X || X.out) break;
            const n = (X.gyIn && X.gyIn.turn === G.turn) ? X.gyIn.n : 0;
            if (n > 0) doMill(X, n);
            break;
        }
        // Thief of Sanity: look at the top three cards of that player's library, exile one face down, put the rest into their graveyard; you may cast it
        case 'thief': {
            const X = O;
            const top = X.library.splice(-Math.min(3, X.library.length)).reverse();
            if (!top.length) break;
            log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} card${top.length === 1 ? '' : 's'} of ${you(X) ? 'your' : `${X.name}'s`} library${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
            const keepV = c => (Rx(c).kind === 'land' ? 0.5 : 1 + (c.card.cmc || 0)) + (Rx(c).support === 'none' ? -5 : 0);
            const c = P.isAI || AUTOPLAY ? top.slice().sort((a, b) => keepV(b) - keepV(a))[0] : await pickCard(P, top, `${name}: exile a card face down (you may cast it)`, { required: true });
            const rest = top.filter(x => x !== c);
            X.gy.push(...rest);
            if (c) {
                c.realOwner = c.owner; c.owner = P.i; c.playUntil = 1e9; c.anyMana = true;
                P.exile.push(c);
                log(`${P.name} ${you(P) ? 'exile' : 'exiles'} a card face down; ${you(P) ? 'you' : 'they'} may cast it for as long as it stays exiled.`);
            }
            if (rest.length) fire('milled', { P: X, cards: rest });
            break;
        }
        // Uldaros Theorix: exile up to one nonland card of each type from your graveyard, copy them, cast copies worth 6 or less in all for free
        case 'uldaros': {
            const chosen = [];
            for (const ty of ULD_TYPES) {
                const re = new RegExp(`\\b${ty}\\b`);
                const cands = P.gy.filter(x => !chosen.includes(x) && !/\bLand\b/.test(x.card.type) && re.test(x.card.type));
                if (!cands.length) continue;
                const c = P.isAI || AUTOPLAY
                    ? cands.filter(x => Rx(x).support !== 'none' && (x.card.cmc || 0) <= 6).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0]
                    : await pickCard(P, cands, `${name}: exile a${ty === 'Artifact' || ty === 'Enchantment' || ty === 'Instant' ? 'n' : ''} ${ty.toLowerCase()} card from your graveyard (or skip)`);
                if (c) chosen.push(c);
            }
            if (!chosen.length) { log(`${name}: no cards to exile.`); break; }
            chosen.forEach(c => { pull(P.gy, c); P.exile.push(c); });
            log(`${name}: ${P.name} ${you(P) ? 'exile' : 'exiles'} ${chosen.map(c => c.card.name).join(', ')} from ${you(P) ? 'your' : 'their'} graveyard and copies them.`);
            let left = 6;
            const copies = chosen.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0));
            const castable = c => Rx(c).support !== 'none' && ['instant', 'sorcery', 'creature', 'artifact', 'enchantment', 'planeswalker', 'battle', 'other'].includes(Rx(c).kind) && !Rx(c).isAura;
            while (left >= 0 && !G.over) {
                const fit = copies.filter(c => (c.card.cmc || 0) <= left && castable(c));
                if (!fit.length) break;
                const c = P.isAI || AUTOPLAY ? fit[0] : await pickCard(P, fit, `${name}: cast a copy for free (${left} mana value left), or stop`);
                if (!c) break;
                copies.splice(copies.indexOf(c), 1);
                left -= c.card.cmc || 0;
                const k = Rx(c).kind;
                if (k === 'instant' || k === 'sorcery') {
                    G.stack.push({ id: stackSeq++, kind: 'trigger', o: c, P, target: null, effects: spellEffects(c), name: `${c.card.name} (copy, cast free)`, copy: true });
                    log(`${P.name} ${you(P) ? 'cast' : 'casts'} a copy of ${c.card.name} without paying its mana cost.`);
                } else {
                    log(`${P.name} ${you(P) ? 'cast' : 'casts'} a copy of ${c.card.name} without paying its mana cost.`);
                    tokenCopyOf(P, c.card);
                }
            }
            break;
        }
        // Golbez, Crystal Collector: at your end step with four or more artifacts, return a creature card from your graveyard to your hand; with eight or more, each opponent loses life equal to its power
        case 'golbez': {
            const arts = P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length;
            if (arts < 4) break;
            const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type));
            if (!pool.length) break;
            const c = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => (Number(b.card.power) || 0) - (Number(a.card.power) || 0))[0] : await pickCard(P, pool, `${name}: return a creature card from your graveyard to your hand`, { required: true });
            if (!c) break;
            pull(P.gy, c); P.hand.push(c);
            log(`${P.name} ${you(P) ? 'return' : 'returns'} ${c.card.name} to ${you(P) ? 'your' : 'their'} hand.`);
            if (P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length >= 8) {
                const n = Math.max(0, Number(c.card.power) || 0);
                if (n > 0) foes(P).forEach(F => { F.life -= n; log(`${F.name} ${you(F) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: F, n }); });
            }
            break;
        }
        // Joo Dee, One of Many: surveil 1, create a token copy of this creature, then sacrifice an artifact or creature
        case 'jooDee': {
            await applyEffect(P, { t: 'surveil', n: 1 }, null, src);
            const model = onBf(src.uid) ? src : null;
            const tok = tokenCopyOf(P, (model || src).card);
            const all = P.bf.filter(x => (isCreature(x) || /\bArtifact\b/.test(x.card.type)));
            const fodder = all.filter(x => x !== tok).length ? all.filter(x => x !== tok) : all;
            if (!fodder.length) break;
            const cheap = x => (isCreature(x) ? creatureValue(x) + (x.token ? -1 : 0) : 0.5);
            const c = P.isAI || AUTOPLAY ? fodder.slice().sort((a, b) => cheap(a) - cheap(b))[0] : await pickCard(P, fodder, `${name}: sacrifice an artifact or creature`, { required: true });
            if (c) { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); }
            break;
        }
        default: break;
    }
}
// Choose one of several players (Fraying Sanity). Returns the player or null.
async function pickPlayer(P, list, title) {
    for (let i = 0; i < list.length - 1; i++) if (await askYes(P, `${title} ${list[i].name}?`, { yes: 'Yes', no: 'Next player' })) return list[i];
    return list[list.length - 1] || null;
}
['millFoes', 'millHalfFoes', 'millUntilLands', 'exileUntilMv'].forEach(k => EACH_OPP_EFFECTS.add(k));

// Rad counters: the beginning of each player's precombat main phase (beginTurn calls radTick)
// Cards put into a graveyard this turn from anywhere (Fraying Sanity): every graveyard counts its own pushes
function trackGraveyard(P) {
    const orig = P.gy.push;
    P.gy.push = function (...cards) {
        if (G && cards.length) { if (!P.gyIn || P.gyIn.turn !== G.turn) P.gyIn = { turn: G.turn, n: 0 }; P.gyIn.n += cards.length; }
        return orig.apply(this, cards);
    };
}

// ---- Hooks the rules pack uses ----
COUNT_EXTRA.push([/^(?:the number of )?cards in your opponents' graveyards$/, () => o => foes(G.players[o.owner]).reduce((s, F) => s + F.gy.length, 0)]);
COND_EXTRA.push([/^~ was cast$/, () => (P, o) => !!o && !!o.wasCast]);
// Trepanation Blade: "whenever equipped creature attacks"
TRIG_FN.hostAttack = (o, ctx) => !!o.attachedTo && !!ctx.list && ctx.list.some(x => x.uid === o.attachedTo);

// How much the computer likes each of these effects (07-ai.js scoreEffects); undefined = not one of ours
function uldScore(P, e, O, target) {
    const lib = O.library.length;
    switch (e.t) {
        case 'millFoes': return 2 + (Number(e.n) || 0) * 0.3 + (lib <= (Number(e.n) || 0) ? 1000 : 0) + (e.kickedHalf ? 2 : 0);
        case 'millHalf': case 'millHalfFoes': return 2 + lib * 0.15;
        case 'millUntilLands': case 'revealLandsOne': return 3;
        case 'exileUntilMv': return 4 + (e.cast ? 4 : 0) + (lib < 12 ? 3 : 0);
        case 'fallout': { const theirs = allPerms().filter(c => isCreature(c) && c.owner !== P.i).reduce((a, c) => a + creatureValue(c), 0), ours = P.bf.filter(isCreature).reduce((a, c) => a + creatureValue(c), 0); return theirs - ours > 6 ? theirs - ours : 1; }
        case 'syphon': return O.hand.length ? 4 + O.hand.length : 0;
        case 'manifestCtrl': return 0;
        case 'doomsday': return O.library.length < P.library.length ? 3 : 0;
        case 'extractDark': return G.players.some(X => X.gy.some(x => /\bCreature\b/.test(x.card.type))) ? 8 : 2;
        case 'breach': return 8;
        case 'ripples': case 'overlordReturn': return 2;
        case 'millSelf': return -1;
        case 'enchantPlayer': return 3;
        case 'frayTick': return 1;
        case 'thief': return 5;
        case 'uldaros': return P.gy.some(x => !/\bLand\b/.test(x.card.type)) ? 8 : 0;
        case 'golbez': return 3;
        case 'jooDee': return 3;
        case 'bladeReveal': return 1;
    }
    return undefined;
}
