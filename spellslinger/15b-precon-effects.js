// =====================================================================
// Engine cases for the precon rounds (docs/spellslinger-precon-plan.md). applyEffect (06-engine.js) falls through to
// preconEffect for any effect type it has no case for. Add new effects here, and their wordings in rules/precons<N>.js.
// =====================================================================
function gainLifeFor(X, n) { if (n <= 0) return; X.life += n; log(`${X.name} ${you(X) ? 'gain' : 'gains'} ${n} life.`); fire('gainLife', { P: X, n }); }
async function preconEffect(P, e, t, src, O, name) {
    switch (e.t) {
        // Coercion, Thrull Surgeon: look at a hand, choose a card, that player discards it
        case 'coerce': {
            const X = (t && t.p) || O;
            log(`${P.name} ${you(P) ? 'look' : 'looks'} at ${you(X) ? 'your' : `${X.name}'s`} hand${you(P) ? `: ${X.hand.map(x => x.card.name).join(', ') || 'empty'}` : ''}.`);
            if (!X.hand.length) break;
            const pickable = X.hand.filter(x => rulesFor(x.card).kind !== 'land');
            const pool = pickable.length ? pickable : X.hand;
            const c = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : (await pickCard(P, X.hand, `${name}: choose a card, ${X.name === 'You' ? 'you' : X.name} discards it`, { required: true })) || pool[0];
            pull(X.hand, c); X.gy.push(c); discardMark([c]);
            log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${c.card.name}.`);
            break;
        }
        // Sleight of Hand / Telling Time / Ancestral Memories: look at the top n, sort them into hand / top / bottom / graveyard
        case 'lookSort': {
            const top = P.library.splice(-Math.min(e.n, P.library.length)).reverse(); // top card first
            if (!top.length) break;
            log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} card${top.length === 1 ? '' : 's'}${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
            const rank = x => aiKeepValue(P, x);
            const rest = top.slice();
            const take = async (k, label) => { for (let i = 0; i < k && rest.length; i++) { const c = P.isAI ? rest.slice().sort((a, b) => rank(b) - rank(a))[0] : (await pickCard(P, rest, `${name}: ${label}`, { required: true })) || rest[0]; pull(rest, c); yield_(c); } };
            const out = [];
            const yield_ = c => out.push(c);
            await take(e.hand || 0, 'put a card into your hand'); const toHand = out.splice(0);
            let toTop = [];
            if (e.top) { await take(e.top, 'put a card on top of your library'); toTop = out.splice(0); }
            toHand.forEach(c => P.hand.push(c));
            if (e.gy) { P.gy.push(...rest); rest.length = 0; }
            else rest.forEach(c => P.library.unshift(c)); // the rest on the bottom (the library's top is its end)
            toTop.forEach(c => P.library.push(c));
            log(`${P.name} ${you(P) ? 'put' : 'puts'} ${toHand.length} into ${you(P) ? 'your' : 'their'} hand.`);
            break;
        }
        case 'gainLastPower': if (G.lastPower) gainLifeFor(P, G.lastPower.n); break;
        case 'bottomdeck': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            G.lastPower = { P: G.players[x.owner], n: Math.max(0, pow(x)) }; G.lastTouN = Math.max(0, tou(x));
            log(`${x.card.name} is put on the bottom of its owner's library.`);
            const own = G.players[x.realOwner ?? x.owner];
            leaveBattlefield(x, 'library');
            const k = own.library.indexOf(x); if (k >= 0) { own.library.splice(k, 1); own.library.unshift(x); }
            break;
        }
        case 'gainLastTou': if (G.lastPower) gainLifeFor(G.lastPower.P, G.lastTouN || 0); break;
        case 'dmgPlayerCreatures': {
            const X = (t && t.p) || O;
            damage(X, e.n, src); X.bf.filter(isCreature).forEach(c => damage(c, e.m, src));
            log(`${name} deals ${e.n} damage to ${X.name} and ${e.m} to each creature they control.`);
            break;
        }
        case 'gainDrawTarget': { const X = (t && t.p) || P; gainLifeFor(X, e.n); drawCards(X, e.d); log(`${X.name} ${you(X) ? 'draw' : 'draws'} ${e.d} cards.`); break; }
        case 'tapNoFly': allPerms().filter(x => isCreature(x) && !has(x, 'flying')).forEach(x => { x.tapped = true; }); log(`${name}: all creatures without flying are tapped.`); break;
        case 'drawTappedOpp': { const X = (t && t.p) || O; const n = X.bf.filter(x => isCreature(x) && x.tapped).length; drawCards(P, n); log(`${P.name} ${you(P) ? 'draw' : 'draws'} ${n} card${n === 1 ? '' : 's'}.`); break; }
        case 'curfew': {
            for (const X of [P, O]) {
                const cs = X.bf.filter(isCreature); if (!cs.length) continue;
                const c = X.isAI ? cs.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : (await pickCard(X, cs, `${name}: return a creature you control to its owner's hand`, { required: true })) || cs[0];
                log(`${c.card.name} returns to its owner's hand.`); leaveBattlefield(c, 'hand');
            }
            break;
        }
        case 'sacAttacking': {
            const X = (t && t.p) || O;
            const n = e.condN && condOk(e.condN.cond, P, src) ? e.condN.n : e.n;
            for (let k = 0; k < n; k++) {
                const cs = X.bf.filter(x => isCreature(x) && (G.attackers || []).includes(x.uid)); if (!cs.length) break;
                const c = X.isAI ? cs.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : (await pickCard(X, cs, `${name}: sacrifice an attacking creature`, { required: true })) || cs[0];
                log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy');
            }
            break;
        }
        case 'eyeSpy': {
            const X = (t && t.p) || O; const c = X.library[X.library.length - 1]; if (!c) break;
            log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top card of ${you(X) ? 'your' : `${X.name}'s`} library${you(P) ? `: ${c.card.name}` : ''}.`);
            const good = aiKeepValue(X, c) >= 5;
            const yes = P.isAI ? (X === P ? !good : good) : await askYes(P, `${name}: ${c.card.name} is on top of ${you(X) ? 'your' : `${X.name}'s`} library. Put it into the graveyard?`, { card: c.card, yes: 'Graveyard', no: 'Leave it' });
            if (yes) { X.library.pop(); X.gy.push(c); log(`${c.card.name} is put into ${you(X) ? 'your' : `${X.name}'s`} graveyard.`); }
            break;
        }
        // Look at / reveal the top n, you may take a matching card into your hand, the rest to the graveyard or the bottom
        case 'digTake': {
            const top = P.library.splice(-Math.min(e.n, P.library.length)).reverse(); if (!top.length) break;
            const COL = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
            const fits = x => (e.color ? (x.card.colors || []).includes(COL[e.color]) : (e.kinds || []).some(k => k === 'land' ? rulesFor(x.card).kind === 'land' : isCreatureCard(x.card)));
            const opts = top.filter(fits);
            log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
            let take = null;
            if (opts.length) take = P.isAI ? opts.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : (await pickCard(P, opts, `${name}: take a card into your hand (or none)`, { optional: true })) || null;
            if (take) { pull(top, take); P.hand.push(take); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${take.card.name} into ${you(P) ? 'your' : 'their'} hand.`); }
            if (e.rest === 'gy') P.gy.push(...top); else shuffle(top).forEach(c => P.library.unshift(c));
            break;
        }
        case 'skipNext': { const X = (t && t.p) || O; X.skip = { turn: G.active === X.i ? G.turn + 2 : G.turn + 1, what: e.what }; log(`${X.name} ${you(X) ? 'skip' : 'skips'} ${e.what === 'combat' ? 'all combat phases' : 'the draw step'} of ${you(X) ? 'your' : 'their'} next turn.`); break; }
        case 'relentless': {
            const ut = P.bf.filter(x => isCreature(x) && x.tapped && (G.attackers || []).includes(x.uid));
            ut.forEach(x => { x.tapped = false; });
            G.extraCombat = (G.extraCombat || 0) + 1;
            log(`${P.name} untap${you(P) ? '' : 's'} ${ut.length} creature${ut.length === 1 ? '' : 's'} that attacked; there will be an additional combat phase.`);
            if (G.phase === 'main2' && !P.isAI && G.active === P.i && !G.over) { G.busy = false; await startExtraCombat(); }
            break;
        }
        case 'sacUnlessDiscardCreature': {
            const cs = P.hand.filter(x => isCreatureCard(x.card));
            const keep = cs.length && (P.isAI ? true : await askYes(P, `${name}: discard a creature card, or sacrifice it?`, { card: src.card, yes: 'Discard a creature', no: 'Sacrifice it' }));
            if (keep) { const c = P.isAI ? cs.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : (await pickCard(P, cs, `${name}: discard a creature card`, { required: true })) || cs[0]; pull(P.hand, c); P.gy.push(c); discardMark([c]); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${c.card.name}.`); }
            else if (onBf(src.uid)) { log(`${name} is sacrificed.`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy'); }
            break;
        }
        case 'bounceOthers': { const xs = P.bf.filter(x => isCreature(x) && x !== src); xs.forEach(x => { log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand'); }); break; }
        case 'returnGreenUpkeep': {
            const gs = P.bf.filter(x => isCreature(x) && (x.card.colors || []).includes('G')); if (!gs.length) break;
            const c = P.isAI ? gs.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : (await pickCard(P, gs, `${name}: return a green creature you control to its owner's hand`, { required: true })) || gs[0];
            log(`${c.card.name} returns to its owner's hand.`); leaveBattlefield(c, 'hand');
            break;
        }
        case 'returnNextUpkeep': {
            const X = G.players[src.owner];
            (G.delayed = G.delayed || []).push({ at: 'upkeep', own: true, P: X, after: G.turn, effects: [{ t: 'returnSelfGy', bf: true, tapped: true }], src, label: `${name}: returns at the beginning of its owner's next upkeep` });
            break;
        }
        case 'edictGreatest': {
            const V = O, cs = V.bf.filter(isCreature); if (!cs.length) break;
            const hi = Math.max(...cs.map(pow)), pool = cs.filter(x => pow(x) === hi);
            const f = (V.isAI || AUTOPLAY || pool.length === 1 ? null : await pickCard(V, pool, `${name}: sacrifice a creature with the greatest power`, { required: true })) || pool[0];
            log(`${V.name} ${you(V) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            break;
        }
        case 'sacLandsEach': { for (const X of G.players) await applyEffect(X, { t: 'sacLands', n: e.n }, null, { ...src, card: src.card, uid: -1, owner: X.i }); break; }
        case 'markForDeath': {
            if (!t || !t.o) break;
            t.o.tapped = false; G.onlyBlocker = { turn: G.turn, uid: t.o.uid };
            log(`${t.o.card.name} untaps; no other creature ${ctrl(t.o).name === 'You' ? 'you control' : `${ctrl(t.o).name} controls`} can block this turn.`);
            break;
        }
        case 'untapLast': (G.lastTargets || []).forEach(x => { if (x.o && onBf(x.o.uid)) x.o.tapped = false; }); break;
        case 'hunterInsight': if (t && t.o) { (G.hitWatch = G.hitWatch || []).push({ uid: t.o.uid, P, turn: G.turn }); log(`${t.o.card.name}: ${P.name} ${you(P) ? 'draw' : 'draws'} cards equal to the combat damage it deals to a player this turn.`); } break;
        case 'teamKwColor': { P.bf.filter(x => isCreature(x) && (x.card.colors || []).includes(e.color)).forEach(x => e.kw.forEach(k => { if (!x.tkw.includes(k)) x.tkw.push(k); })); log(`${name}: ${e.color === 'W' ? 'white' : e.color} creatures gain ${e.kw.join(', ')} until end of turn.`); break; }
        case 'counterbore': {
            const it = G.lastCountered; if (!it || it.kind !== 'spell') break;
            const X = it.P, nm = it.o.card.name; let n = 0;
            ['gy', 'hand', 'library'].forEach(z => { const keep = []; X[z].forEach(x => { if (x.card.name === nm) { X.exile.push(x); n++; } else keep.push(x); }); X[z].splice(0, X[z].length, ...keep); });
            if (n) log(`${name} exiles ${n} more ${nm} from ${X.name}'s graveyard, hand and library.`);
            break;
        }
        case 'drawHostCtl': { const h = src.attachedTo && onBf(src.attachedTo); if (h) { const X = G.players[h.owner]; drawCards(X, 1); log(`${X.name} ${you(X) ? 'draw' : 'draws'} an additional card.`); } break; }
        case 'lockLastLand': (G.lastTargets || []).forEach(x => { if (x.o && onBf(x.o.uid)) x.o.lockedBy = src.uid; }); break;
        case 'callWild': {
            const c = P.library[P.library.length - 1]; if (!c) break;
            log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name}.`);
            if (isCreatureCard(c.card)) { P.library.pop(); putOntoBattlefield(P, c); log(`${c.card.name} enters the battlefield.`); }
            else { P.library.pop(); P.gy.push(c); log(`${c.card.name} is put into the graveyard.`); }
            break;
        }
        case 'revealTopTarget': { const X = (t && t.p) || O; const c = X.library[X.library.length - 1]; if (c) log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} the top card of ${you(X) ? 'your' : 'their'} library: ${c.card.name}.`); break; }
        case 'preventSelf': P.prevent = { turn: G.turn, n: ((P.prevent && P.prevent.turn === G.turn) ? P.prevent.n : 0) + e.n }; log(`The next ${e.n} damage to ${P.name} this turn is prevented.`); break;
        case 'archon': P.archon = { turn: G.turn, n: ((P.archon && P.archon.turn === G.turn) ? P.archon.n : 0) + Math.max(0, e.n), src }; log(`${name}: the next ${e.n} damage to ${P.name} this turn is prevented and dealt to ${O.name}.`); break;
        case 'pumpCount': if (t && t.o) { const k = countFn(e.what)({ owner: P.i }); t.o.tp += k; t.o.tq += k; log(`${t.o.card.name} gets +${k}/+${k} until end of turn.`); } break;
        case 'regrowNonCN': {
            const pool = P.gy.filter(x => !isCreatureCard(x.card) && rulesFor(x.card).kind !== 'land'); if (!pool.length) break;
            const c = P.isAI ? pool.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : (await pickCard(P, pool, `${name}: return a noncreature, nonland card to your hand`, { required: true })) || pool[0];
            pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
            break;
        }
        case 'lifeToToughness': {
            const n = P.bf.filter(isCreature).reduce((a, x) => a + Math.max(0, tou(x)), 0);
            const yes = P.isAI ? n > P.life : await askYes(P, `${name}: set your life total to ${n}?`, { card: src.card });
            if (yes) { log(`${P.name}'s life total becomes ${n}.`); P.life = n; }
            break;
        }
        case 'regenHost': { const h = src.attachedTo && onBf(src.attachedTo); if (h) { h.regen = (h.regen || 0) + 1; log(`${h.card.name} gets a regeneration shield.`); } break; }
        case 'counterHost': { const h = src.attachedTo && onBf(src.attachedTo); const col = { red: 'R', black: 'B' }[e.color]; if (h && (h.card.colors || []).includes(col)) putCounters(h, 1, P); break; }
        case 'beastmaster': { const k = Math.max(0, pow(src)); P.bf.filter(c => isCreature(c) && c !== src).forEach(c => { c.tp += k; c.tq += k; }); log(`${name}: each other creature gets +${k}/+${k} until end of turn.`); break; }
        case 'untapType': { const xs = P.bf.filter(x => x !== src && hasType(x, e.type) && x.tapped); xs.forEach(x => { x.tapped = false; }); log(`${xs.length} other ${e.type}${xs.length === 1 ? '' : 's'} untap.`); break; }
        case 'deathgaze': {
            const hit = [];
            if (G.blocks[src.uid]) hit.push(...G.blocks[src.uid].map(onBf).filter(Boolean));
            Object.entries(G.blocks).forEach(([a, bs]) => { if (bs.includes(src.uid) && onBf(Number(a))) hit.push(onBf(Number(a))); });
            hit.filter(x => !(x.card.colors || []).includes('B')).forEach(x => { x.doomEnd = G.turn; log(`${x.card.name} will be destroyed at end of combat.`); });
            break;
        }
        case 'tabletChoose': {
            const cnt = { W: 0, U: 0, B: 0, R: 0, G: 0 };
            [...P.hand, ...P.bf, ...P.library].forEach(c => (c.card.colors || []).forEach(k => { if (cnt[k] !== undefined) cnt[k]++; }));
            src.chosenColors = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 2);
            log(`${name}: the chosen colors are ${src.chosenColors.join(' and ')}.`);
            break;
        }
        case 'tabletGain': { const c = G.lastCast; const n = c ? (src.chosenColors || []).filter(k => (c.card.colors || []).includes(k)).length : 0; gainLifeFor(P, n); break; }
        case 'gutterGrime': {
            src.ctr.slime = (src.ctr.slime || 0) + 1; const n = src.ctr.slime;
            log(`${name} gets a slime counter (${n}).`);
            await applyEffect(P, { t: 'token', n: 1, p: 0, q: 0, name: 'green Ooze', kw: [] }, null, src);
            const mine = P.bf.filter(x => x.token && /Ooze/.test(x.card.type + x.card.name) && x.slimeOf === undefined);
            mine.forEach(x => { x.slimeOf = src.uid; });
            P.bf.filter(x => x.slimeOf === src.uid).forEach(x => { x.counters = n; });
            break;
        }
        case 'pumpSelfLife': if (onBf(src.uid)) { const k = Math.max(0, P.life); src.tp += k; src.tq += k; log(`${name} gets +${k}/+${k} until end of turn.`); } break;
        case 'thicket': {
            const top = P.library.splice(-Math.min(5, P.library.length)).reverse(); if (!top.length) break;
            const basics = top.filter(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type));
            const keep = basics.length ? (P.isAI ? basics[0] : (await pickCard(P, basics, `${name}: reveal a basic land to put on top (or none)`, { optional: true })) || null) : null;
            if (keep) { pull(top, keep); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${keep.card.name} and ${you(P) ? 'put' : 'puts'} it on top of the library.`); }
            top.forEach(c => P.library.unshift(c));
            if (keep) P.library.push(keep);
            break;
        }
        case 'petrify': if (t && t.o && onBf(t.o.uid)) { t.o.ctr.petrification = (t.o.ctr.petrification || 0) + 1; log(`${t.o.card.name} gets a petrification counter: it has defender and its abilities can't be activated.`); } break;
        case 'fetchWeb': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            const web = [...P.gy, ...P.library].find(c => c.card.name === 'Arachnus Web'); if (!web) { log(`${name}: no Arachnus Web to find.`); break; }
            pull(P.gy, web); pull(P.library, web); putOntoBattlefield(P, web); web.attachedTo = x.uid;
            log(`${web.card.name} is put onto the battlefield attached to ${x.card.name}.`);
            break;
        }
        case 'bloodReckoning': { const n = (G.attackers || []).length * e.n; if (n > 0) { O.life -= n; log(`${O.name} ${you(O) ? 'lose' : 'loses'} ${n} life for attacking.`); fire('loseLife', { P: O, n }); } break; }
        default: break;
    }
}
function isCreatureCard(card) { return /\bCreature\b/.test(card.type || ''); }

// Trigger conditions used by the precon rounds (TRIG_FN is read by trigMatches in 15-rules-conditions.js)
Object.assign(TRIG_FN, {
    anotherPow: (o, ctx, tr) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o) && pow(ctx.o) >= (tr.minPow || 0),
    oppAttacks: (o, ctx) => G.active !== o.owner && (ctx.list || []).some(x => x.owner !== o.owner),
    castRed: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && (ctx.o.card.colors || []).includes('R'),
    mountainEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bMountain\b/.test(ctx.o.card.type),
    selfManaTap: (o, ctx) => ctx.o === o && !!ctx.mana,
    fromGyMine: (o, ctx) => !!ctx.fromGy && !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o),
    myNontokenDies: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && !ctx.o.token,
    selfBlocked: (o, ctx) => ctx.o === o,
    dgBlocks: (o, ctx) => (ctx.list || []).includes(o),
    phoenix: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !!ctx.src && ctx.src.owner === o.owner && (ctx.src.card.colors || []).includes('R') && (ctx.src.uid === undefined ? ['instant', 'sorcery'].includes(Rx(ctx.src).kind) : Rx(ctx.src).kind === 'planeswalker'),
    webEnd: (o, ctx) => { const h = o.attachedTo && onBf(o.attachedTo); return !!h && pow(h) >= 4; },
    tabletCast: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && (o.chosenColors || []).some(c => (ctx.o.card.colors || []).includes(c)),
    selfToGy: (o, ctx) => ctx.o === o,
    ergRaiders: (o, ctx) => G.active === o.owner && !o.tapped && !o.sick // approximation: it didn't attack if it is still untapped
});

// Hunter's Insight: a creature you chose draws you cards equal to the combat damage it deals to a player this turn
function preconHitWatch(ctx) {
    (G.hitWatch || []).filter(w => w.turn === G.turn && ctx.src && w.uid === ctx.src.uid && ctx.n > 0).forEach(w => { drawCards(w.P, ctx.n); log(`${w.P.name} ${you(w.P) ? 'draw' : 'draws'} ${ctx.n} card${ctx.n === 1 ? '' : 's'} (Hunter's Insight).`); });
}

// ---- Replacement and prevention effects (called first thing in damage(); returns the damage that still gets through) ----
function preconDamage(target, n, src) {
    if (!G) return n;
    const isP = target.life !== undefined, isPerm = !isP && !!target.card && target.uid !== undefined;
    const owner = isP ? target : isPerm ? G.players[target.owner] : null;
    if (G.noPrevent !== G.turn) {
        if (isPerm && Rx(target).preventSelf && !lostAbilities(target)) { log(`Damage to ${target.card.name} is prevented.`); return 0; }
        if (isPerm && Rx(target).blockersHarmless && !lostAbilities(target) && G.inCombatDamage && src && (G.blocks[target.uid] || []).includes(src.uid)) { log(`Combat damage to ${target.card.name} by a blocker is prevented.`); return 0; }
        // Ghostly Possession: combat damage dealt to and by the enchanted creature
        if (G.inCombatDamage) {
            const gp = allPerms().find(a => Rx(a).ghostly && !lostAbilities(a) && a.attachedTo && ((isPerm && target.uid === a.attachedTo) || (src && src.uid === a.attachedTo)));
            if (gp) { log(`Combat damage is prevented (${gp.card.name}).`); return 0; }
        }
        // Vigor: damage to your other creatures becomes +1/+1 counters
        if (isPerm && isCreature(target)) {
            const vg = owner.bf.find(a => a !== target && Rx(a).vigor && !lostAbilities(a));
            if (vg) { log(`${vg.card.name} prevents ${n} damage to ${target.card.name}, which gets ${n} +1/+1 counter${n === 1 ? '' : 's'}.`); putCounters(target, n, owner); return 0; }
        }
        if (isP) {
            // Pariah: the damage is dealt to the enchanted creature instead
            const pa = allPerms().find(a => Rx(a).pariah && !lostAbilities(a) && a.owner === owner.i && a.attachedTo && onBf(a.attachedTo));
            if (pa) { const host = onBf(pa.attachedTo); log(`${pa.card.name}: the damage is dealt to ${host.card.name} instead.`); damage(host, n, src); return 0; }
            const ua = owner.bf.filter(a => Rx(a).urzaArmor && !lostAbilities(a)).length;
            if (ua) { n -= ua; log(`Urza's Armor prevents ${ua} damage.`); if (n <= 0) return 0; }
            // Vengeful Archon: {X}: prevent the next X damage to you; it deals that much to target player
            if (owner.archon && owner.archon.turn === G.turn && owner.archon.n > 0) {
                const k = Math.min(n, owner.archon.n); owner.archon.n -= k; n -= k;
                log(`${owner.archon.src.card.name} prevents ${k} damage and deals ${k} damage to ${G.players[1 - owner.i].name}.`);
                damage(G.players[1 - owner.i], k, owner.archon.src);
                if (n <= 0) return 0;
            }
        }
    }
    // Furnace of Rath: double damage from every source
    const fur = allPerms().filter(a => Rx(a).furnace && !lostAbilities(a)).length;
    if (fur) n *= 2 ** fur;
    return n;
}
// ---- Extra conditions, static filters and block restrictions ----
COND_EXTRA.push(
    [/^it was kicked$/, () => (P, o) => !!o && !!o.kicked],
    [/^you have been attacked this step$/, () => P => G.active !== P.i && G.phase === 'declareBlocks' && (G.attackers || []).length > 0],
    [/^it is your main phase before combat$/, () => P => G.active === P.i && G.phase === 'main1' && !G.combatFired],
    [/^you control two or more ([A-Z][a-z]+)s$/, m => P => P.bf.filter(x => hasType(x, m[1])).length >= 2],
    [/^you control an? ([A-Z][a-z]+) creature$/, m => P => P.bf.some(x => isCreature(x) && hasType(x, m[1]))],
    [/^~ is enchanted$/, () => (P, o) => !!o && allPerms().some(a => a.attachedTo === o.uid)],
    [/^an? (artifact|creature|land|instant|sorcery|enchantment) card is in your graveyard$/, m => P => P.gy.some(x => new RegExp(`\\b${m[1]}\\b`, 'i').test(x.card.type))]
);
Object.assign(STATIC_FN, {
    black: o => (o.card.colors || []).includes('B'),
    nonblack: o => !(o.card.colors || []).includes('B')
});
Object.assign(BLOCK_FN, {
    wallOrFlying: b => hasType(b, 'Wall') || has(b, 'flying'),
    notWall: b => !hasType(b, 'Wall')
});

function preconCantCast(P) { return !!G && P.attackedTurn === G.turn && G.players[1 - P.i].bf.some(a => Rx(a).arbiter && !lostAbilities(a)); }
function preconCantAttack(o) { if (!G) return false; if (o.ctr && o.ctr.petrification) return true; const P = G.players[o.owner]; return P.castTurn === G.turn && G.players[1 - P.i].bf.some(a => Rx(a).arbiter && !lostAbilities(a)); }
function lifeGainBonus(P) { return G ? P.bf.filter(a => Rx(a).vitality && !lostAbilities(a)).length : 0; }
// Guerrilla Tactics: a spell or ability an opponent controls makes you discard it
function discardByOpp(d, byP) {
    if (!d || !byP || byP === G.players[d.owner] || !Rx(d).discardPunish) return;
    (G.trigQ = G.trigQ || []).push({ P: G.players[d.owner], o: d, effects: Rx(d).discardPunish });
}
// Deathgazer: destroyed at end of combat
function preconEndCombat() {
    allPerms().filter(x => x.doomEnd === G.turn && isCreature(x)).forEach(x => { x.doomEnd = null; destroy(x); });
}
{ const origCombatDamage = combatDamage; combatDamage = function (A) { const r = origCombatDamage.apply(this, arguments); preconEndCombat(); return r; }; }

// Oppressive Rays: the {3} an enchanted creature must pay to attack or block
function auraTaxOn(o) { return G ? allPerms().filter(a => a.attachedTo === o.uid && Rx(a).raysTax && !lostAbilities(a)).reduce((s, a) => s + Rx(a).raysTax, 0) : 0; }
// Lure: every creature able to block the enchanted creature does
function preconLure() {
    G.attackers.map(onBf).filter(a => a && allPerms().some(x => x.attachedTo === a.uid && Rx(x).lure && !lostAbilities(x))).forEach(atk => {
        const D = G.players[1 - atk.owner];
        const must = D.bf.filter(b => isCreature(b) && canBlock(b, atk));
        if (!must.length) return;
        Object.keys(G.blocks).forEach(a => { G.blocks[a] = G.blocks[a].filter(u => !must.some(b => b.uid === u)); if (!G.blocks[a].length) delete G.blocks[a]; });
        G.blocks[atk.uid] = [...new Set([...(G.blocks[atk.uid] || []), ...must.map(b => b.uid)])];
        log(`${atk.card.name} is Lured: ${must.map(b => b.card.name).join(', ')} must block it.`);
    });
}
