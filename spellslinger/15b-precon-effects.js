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
        case 'gainLastTou': if (e.you) gainLifeFor(P, G.lastTouN || 0); else if (G.lastPower) gainLifeFor(G.lastPower.P, G.lastTouN || 0); break;
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
            const fits = x => (e.color ? (x.card.colors || []).includes(COL[e.color]) : (e.kinds || []).some(k => k === 'land' ? rulesFor(x.card).kind === 'land' : isCreatureCard(x.card) && (e.maxPow === undefined || Number(x.card.power) <= e.maxPow)));
            const opts = top.filter(fits);
            log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
            let take = null;
            if (opts.length) take = P.isAI ? opts.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : (await pickCard(P, opts, `${name}: take a card into your hand (or none)`, { optional: true })) || null;
            if (take) { pull(top, take); P.hand.push(take); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${take.card.name} into ${you(P) ? 'your' : 'their'} hand.`); }
            if (e.both) { const land = top.find(x => rulesFor(x.card).kind === 'land'); if (land && (!take || isCreatureCard(take.card))) { pull(top, land); P.hand.push(land); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${land.card.name} into ${you(P) ? 'your' : 'their'} hand.`); } }
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
        case 'madnessCast': {
            const x = src, X = G.players[x.owner];
            if (!X.exile.includes(x)) break;
            x.castAs = 'madness';
            let go = canPay(X, x);
            if (go && !X.isAI) go = await askYes(X, `Madness: cast ${x.card.name} for ${costSymbols(Rx(x).madness)}? (Otherwise it goes to your graveyard.)`, { card: x.card });
            let ok = false;
            if (go) {
                if (Rx(x).modes) x.mode = (await pickModes(X, Rx(x), Rx(x).modes, x)) ?? 0;
                const te = firstTargetEffect(x);
                const target = te ? await chooseTarget(X, te, x, false) : null;
                if (!(te && !target) && payFor(X, x)) {
                    pull(X.exile, x); x.castFromHand = 0; x.kicked = false; x.kickN = 0;
                    G.stack.push({ id: stackSeq++, kind: 'spell', o: x, P: X, target, name: x.card.name, x: 0 });
                    log(`${X.name} ${you(X) ? 'cast' : 'casts'} ${x.card.name} for its madness cost.`);
                    fire('cast', { o: x, P: X }); ok = true;
                }
            }
            x.castAs = null;
            if (!ok) { pull(X.exile, x); X.gy.push(x); log(`${x.card.name} is put into the graveyard.`); }
            break;
        }
        case 'embalmCopy': { const { _r, ...c } = src.front || src.card; tokenCopyOf(P, { ...c, colors: ['W'], type: /—/.test(c.type) ? `${c.type} Zombie` : `${c.type} — Zombie`, cost: '', cmc: 0 }); break; }
        case 'transmute': {
            const mv = (src.front || src.card).cmc || 0;
            const pool = P.library.filter(x => (x.card.cmc || 0) === mv);
            const pick = pool.length ? (P.isAI ? pool.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, pool, `${name}: search for a card with mana value ${mv} (transmute)`)) : null;
            if (pick) { pull(P.library, pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'search' : 'searches'} for a card with mana value ${mv}${you(P) ? ` (${pick.card.name})` : ''}.`); }
            shuffle(P.library);
            break;
        }
        case 'enlist': {
            if (!onBf(src.uid)) break;
            const ok = P.bf.filter(x => isCreature(x) && x !== src && !x.tapped && !x.sick && !(G.attackers || []).includes(x.uid));
            if (!ok.length) break;
            const pick = P.isAI ? ok.slice().sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, ok, `${name}: enlist - tap a creature that isn't attacking to add its power`);
            if (pick && (!P.isAI || pow(pick) >= 1)) { pick.tapped = true; src.tp += pow(pick); log(`${src.card.name} enlists ${pick.card.name} (+${pow(pick)}/+0).`); }
            break;
        }
        case 'payCounter': {
            if (!onBf(src.uid)) break;
            const plan = planPayment(P, e.cost);
            const yes = plan && (P.isAI || AUTOPLAY ? true : await askYes(P, `${src.card.name}: pay ${costSymbols(e.cost)} to put a +1/+1 counter on it?`, { card: src.card }));
            if (yes) { plan.forEach(x => tapSource(P, x)); putCounters(src, 1, P); log(`${src.card.name} gets a +1/+1 counter.`); }
            break;
        }
        case 'squadCopies': { if (!onBf(src.uid)) break; for (let k = 0; k < (src.kickN || 0); k++) tokenCopyOf(P, src.front || src.card); break; }
        case 'lairBounce': {
            const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type) && !/\bLair\b/.test(x.card.type) && x !== src);
            const pick = lands.length ? (P.isAI ? lands.slice().sort((a, b) => (b.tapped - a.tapped) || (isBasic(b.card) - isBasic(a.card)))[0] : await pickCard(P, lands, `${name}: return a non-Lair land to hand, or skip to sacrifice it`)) : null;
            if (pick) { leaveBattlefield(pick, 'hand'); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${pick.card.name} to hand.`); }
            else if (onBf(src.uid)) { log(`${src.card.name} is sacrificed.`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy'); }
            break;
        }
        case 'bolster': {
            const cs = P.bf.filter(isCreature);
            if (!cs.length) break;
            const low = Math.min(...cs.map(x => tou(x)));
            const pool = cs.filter(x => tou(x) === low);
            const pick = pool.length === 1 || P.isAI ? pool.sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${name}: bolster ${e.n} - choose among your creatures with least toughness`, { required: true });
            if (pick) { const got = putCounters(pick, e.n, P); log(`${pick.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (bolster).`); }
            break;
        }
        case 'support': {
            let pool = P.bf.filter(x => isCreature(x) && x !== src);
            for (let k = 0; k < e.n && pool.length; k++) {
                const pick = P.isAI ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${name}: support ${e.n} - put a +1/+1 counter on another creature (${k + 1} of ${e.n}; skip to stop)`);
                if (!pick) break;
                putCounters(pick, 1, P); log(`${pick.card.name} gets a +1/+1 counter (support).`); pool = pool.filter(x => x !== pick);
            }
            break;
        }
        case 'selfDmg': { const x = t && t.o; if (!x || !onBf(x.uid)) break; damage(x, Math.max(0, pow(x)), x); log(`${x.card.name} deals ${Math.max(0, pow(x))} damage to itself.`); break; }
        case 'hostKw': { const h = src.attachedTo && onBf(src.attachedTo); if (h) { h.tkw.push(...e.kw); log(`${h.card.name} gains ${e.kw.join(', ')} until end of turn.`); } break; }
        case 'dmgAttackers': { (G.attackers || []).map(onBf).filter(Boolean).forEach(a => damage(a, e.n, src)); log(`${name} deals ${e.n} damage to each attacking creature.`); break; }
        case 'discardDraw': { const n = P.hand.length; P.hand.splice(0).forEach(c => { P.gy.push(c); c.discardTurn = G.turn; }); drawCards(P, n); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${n} cards and ${you(P) ? 'draw' : 'draws'} ${n}.`); break; }
        case 'shuffleGy': { const X = (t && t.p) || P; X.library.push(...X.gy.splice(0)); shuffle(X.library); log(`${X.name} ${you(X) ? 'shuffle' : 'shuffles'} their graveyard into their library.`); break; }
        case 'monstrosity': { if (!onBf(src.uid) || src.monstrous) break; src.monstrous = true; const got = putCounters(src, e.n, P); log(`${src.card.name} becomes monstrous (${got} +1/+1 counters).`); break; }
        case 'delayedDraw': { (G.delayed = G.delayed || []).push({ at: 'upkeep', own: false, P, after: G.turn, effects: [{ t: 'draw', n: e.n }], src, label: `${name}: ${P.name} draws ${e.n === 1 ? 'a card' : e.n + ' cards'} at the beginning of the next upkeep.` }); log(`${name}: you'll draw at the beginning of the next turn's upkeep.`); break; }
        case 'renown': { if (!onBf(src.uid) || src.renowned) break; src.renowned = true; const got = putCounters(src, e.n, P); log(`${src.card.name} becomes renowned (${got} +1/+1 counter${got === 1 ? '' : 's'}).`); break; }
        case 'modular': {
            const n = G.lastModular || 0; if (!n) break;
            const pool = P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type) && x !== src);
            if (!pool.length) break;
            const pick = P.isAI ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${name}: put its ${n} +1/+1 counter${n === 1 ? '' : 's'} on an artifact creature (modular)`);
            if (pick) { const got = putCounters(pick, n, P); log(`${pick.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (modular).`); }
            break;
        }
        case 'mentor': {
            if (!onBf(src.uid)) break;
            const pool = (G.attackers || []).map(onBf).filter(x => x && x.owner === src.owner && x !== src && pow(x) < pow(src));
            if (!pool.length) break;
            const pick = P.isAI ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : (pool.length === 1 ? pool[0] : await pickCard(P, pool, `${name}: mentor - put a +1/+1 counter on an attacking creature with lesser power`));
            if (pick) { putCounters(pick, 1, P); log(`${pick.card.name} gets a +1/+1 counter (mentor).`); }
            break;
        }
        case 'rampage': {
            if (!onBf(src.uid)) break;
            const extra = Math.max(0, (G.blocks[src.uid] || []).length - (e.all ? 0 : 1));
            if (extra) { src.tp += e.n * extra; src.tq += e.n * extra; log(`${src.card.name} gets +${e.n * extra}/+${e.n * extra} (rampage ${e.n}).`); }
            break;
        }
        case 'upkeepPay': {
            if (!onBf(src.uid)) break;
            const plan = planPayment(P, e.cost);
            const pay = plan && (P.isAI || AUTOPLAY ? creatureValue(src) >= 3 || P.hand.filter(h => Rx(h).kind !== 'land').length <= 1 : await askYes(P, `Upkeep: pay ${costSymbols(e.cost)} to keep ${src.card.name}? (Otherwise it is sacrificed.)`, { card: src.card }));
            if (pay) { plan.forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} to keep ${src.card.name}.`); }
            else { log(`${src.card.name} is sacrificed (upkeep cost not paid).`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy'); }
            break;
        }
        case 'exploreSelf': {
            if (!onBf(src.uid)) break;
            const top = P.library[P.library.length - 1];
            if (!top) { putCounters(src, 1, P); log(`${src.card.name} explores: no card, +1/+1 counter.`); break; }
            if (Rx(top).kind === 'land') { P.library.pop(); P.hand.push(top); log(`${src.card.name} explores: ${top.card.name} is a land and goes to hand.`); }
            else {
                putCounters(src, 1, P);
                const keep = P.isAI ? (top.card.cmc || 0) <= 2 : await askYes(P, `${src.card.name} explores: ${top.card.name} is not a land (+1/+1 counter). Keep it on top?`, { card: top.card, yes: 'Keep on top', no: 'Put in graveyard' });
                if (!keep) { P.library.pop(); P.gy.push(top); log(`${top.card.name} goes to the graveyard.`); } else log(`${src.card.name} explores: ${top.card.name} stays on top, +1/+1 counter.`);
            }
            break;
        }
        case 'returnOwn': {
            const pool = P.bf.filter(x => isCreature(x) && (!e.colors || (x.card.colors || []).some(c => e.colors.includes(c))));
            if (!pool.length) break;
            const pick = P.isAI ? pool.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : await pickCard(P, pool, `${name}: return a creature you control to its owner's hand`, { required: true });
            if (pick) { log(`${pick.card.name} returns to its owner's hand.`); leaveBattlefield(pick, 'hand'); }
            break;
        }
        case 'flankingHit': {
            if (!onBf(src.uid)) break;
            for (const u of (G.blocks[src.uid] || [])) { const b = onBf(u); if (b && !has(b, 'flanking')) { b.tp -= 1; b.tq -= 1; log(`${b.card.name} gets -1/-1 until end of turn (flanking).`); } }
            break;
        }
        case 'fadeTick': {
            if (!onBf(src.uid)) break;
            const k = e.kind;
            if ((src.ctr[k] || 0) > 0) { src.ctr[k]--; log(`${src.card.name}: a ${k} counter is removed (${src.ctr[k]} left).`); if (k === 'time' && src.ctr[k] === 0) { log(`${src.card.name} vanishes.`); dieOrLeave(src, 'gy'); } }
            else { log(`${src.card.name} fades away.`); dieOrLeave(src, 'gy'); }
            break;
        }
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
        case 'ctlDrawsCountered': { const it = G.lastCountered; if (it && it.P) { drawCards(it.P, 1); log(`${it.P.name} ${you(it.P) ? 'draw' : 'draws'} a card.`); } break; }
        case 'exhaustion': { const X = (t && t.p) || O; X.bf.filter(x => isCreature(x) || /\bLand\b/.test(x.card.type)).forEach(x => { x.skipUntap = true; }); log(`${X.name}'s creatures and lands won't untap during their next untap step.`); break; }
        case 'pumpFilter': { const col = e.filter === 'nonblack' ? x => !(x.card.colors || []).includes('B') : () => true; allPerms().filter(x => isCreature(x) && col(x)).forEach(x => { x.tp += e.p; x.tq += e.q; }); log(`${name}: nonblack creatures get ${e.p}/${e.q} until end of turn.`); break; }
        case 'wipeFilter': { const hit = allPerms().filter(x => isCreature(x) && (e.filter === 'flying' ? has(x, 'flying') : !(x.card.colors || []).includes('W'))); log(`${name}: destroy all nonwhite creatures (${hit.length}).`); hit.forEach(x => destroy(x)); break; }
        case 'edictDestroy': { const V = O, cs = V.bf.filter(isCreature); if (!cs.length) break; const c = V.isAI || AUTOPLAY || cs.length === 1 ? cs.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : (await pickCard(V, cs, `${name}: choose a creature to be destroyed`, { required: true })) || cs[0]; destroy(c); break; }
        case 'regrowCreature': { const pool = P.gy.filter(x => isCreatureCard(x.card)); if (!pool.length) break; const c = P.isAI ? pool.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : (await pickCard(P, pool, `${name}: return a creature card to your hand`, { required: true })) || pool[0]; pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); break; }
        case 'battleCry': { (G.attackers || []).map(onBf).filter(x => x && x !== src && x.owner === src.owner).forEach(x => { x.tp += 1; }); log(`${name}: each other attacking creature gets +1/+0 (battle cry).`); break; }
        case 'counterAttackers': (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i).forEach(x => putCounters(x, 1, P)); log(`${name}: each attacking creature gets a +1/+1 counter.`); break;
        case 'meglonoth': { const k = Math.max(0, pow(src)); Object.entries(G.blocks).forEach(([a, bs]) => { const atk = onBf(Number(a)); if (atk && bs.includes(src.uid)) { const X = G.players[atk.owner]; damage(X, k, src); log(`${name} deals ${k} damage to ${X.name}.`); } }); break; }
        case 'hostDiesLose': { const x = G.ctxObj || null; const k = x ? Math.max(0, tou(x)) : 0; const who = x ? G.players[x.owner] : O; if (k) { who.life -= k; log(`${who.name} ${you(who) ? 'lose' : 'loses'} ${k} life.`); fire('loseLife', { P: who, n: k }); } break; }
        case 'millCaster': { const X = G.lastCast ? G.players[G.lastCast.owner] === undefined ? O : G.players[1 - P.i] : O; const m = X.library.splice(-e.n).reverse(); X.gy.push(...m); log(`${X.name} ${you(X) ? 'mill' : 'mills'} ${m.length}.`); break; }
        case 'lootTarget': { const X = (t && t.p) || P; drawCards(X, 1); if (X.hand.length) { const d = X.isAI ? X.hand.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b))[0] : (await pickCard(X, X.hand, `${name}: discard a card`, { required: true })) || X.hand[0]; pull(X.hand, d); X.gy.push(d); discardMark([d]); log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${d.card.name}.`); } break; }
        case 'sacUnlessForests': { const fs = P.bf.filter(x => /\bForest\b/.test(x.card.type) && x !== src); if (fs.length >= 3 && (P.isAI || await askYes(P, `${name}: sacrifice three Forests (or sacrifice it)?`, { card: src.card }))) { fs.slice(0, 3).forEach(x => { fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); }); log(`${P.name} sacrifices three Forests.`); } else if (onBf(src.uid)) { log(`${name} is sacrificed.`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy'); } break; }
        case 'wumpus': { const X = O; const cs = X.hand.filter(x => isCreatureCard(x.card)); if (!cs.length) break; const c = X.isAI ? cs.slice().sort((a, b) => aiKeepValue(X, b) - aiKeepValue(X, a))[0] : await askYes(X, `${name}: put a creature card from your hand onto the battlefield?`, { card: src.card }) ? ((await pickCard(X, cs, `${name}: put a creature card onto the battlefield`, { required: true })) || cs[0]) : null; if (c) { pull(X.hand, c); putOntoBattlefield(X, c); log(`${X.name} puts ${c.card.name} onto the battlefield.`); } break; }
        case 'singeMind': { const X = (t && t.p) || O; if (!X.hand.length) break; const c = X.hand[rand(X.hand.length)]; const k = c.card.cmc || 0; log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${c.card.name} and ${you(X) ? 'lose' : 'loses'} ${k} life.`); X.life -= k; fire('loseLife', { P: X, n: k }); break; }
        case 'copShield': P.cop = P.cop && P.cop.turn === G.turn ? P.cop : { turn: G.turn }; P.cop[e.color] = (P.cop[e.color] || 0) + 1; log(`${name}: the next ${e.color} source's damage to ${P.name} this turn is prevented.`); break;
        case 'reaverBurn': { const n = (src.ctr && src.ctr.charge) || 0; if (n > 0) { damage(O, n, src); log(`${name} deals ${n} damage to ${O.name}.`); } break; }
        case 'bloodReckoning': { const n = (G.attackers || []).length * e.n; if (n > 0) { O.life -= n; log(`${O.name} ${you(O) ? 'lose' : 'loses'} ${n} life for attacking.`); fire('loseLife', { P: O, n }); } break; }
        default: break;
    }
}
function isCreatureCard(card) { return /\bCreature\b/.test(card.type || ''); }

// Trigger conditions used by the precon rounds (TRIG_FN is read by trigMatches in 15-rules-conditions.js)
STATIC_FN.flying = o => has(o, 'flying');
BLOCK_FN.notArtifact = b => !/\bArtifact\b/.test(b.card.type);
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
    selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    myAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    anotherCreature: (o, ctx) => !!ctx.o && ctx.o !== o && isCreature(ctx.o),
    oppCast: (o, ctx) => ctx.P.i !== o.owner,
    hostDies: (o, ctx) => !!ctx.o && ctx.o.uid === o.attachedTo,
    castColorG: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && (ctx.o.card.colors || []).includes('G'),
    castColorU: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && (ctx.o.card.colors || []).includes('U'),
    forestEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bForest\b/.test(ctx.o.card.type),
    islandEnters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bIsland\b/.test(ctx.o.card.type),
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
            if (owner.cop && owner.cop.turn === G.turn && src && src.card) { const k = Object.keys(owner.cop).find(c => c !== 'turn' && owner.cop[c] > 0 && (src.card.colors || []).includes(c)); if (k) { owner.cop[k]--; log(`Damage from ${src.card.name} to ${owner.name} is prevented.`); return 0; } }
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
    [/^you control a permanent named (.+?)(?: or a permanent named (.+))?$/, m => P => P.bf.some(x => x.card.name === m[1] || (m[2] && x.card.name === m[2]))],
    [/^an opponent controls an? (Island|Swamp|Forest|Mountain|Plains)$/, m => P => G.players[1 - P.i].bf.some(x => hasType(x, m[1]))],
    [/^a library has (\w+) or fewer cards in it$/, m => () => G.players.some(X => X.library.length <= num(m[1]))],
    [/^you control an? ([A-Z][a-z]+) planeswalker$/, m => P => P.bf.some(x => isPlaneswalker(x) && hasType(x, m[1]))],
    [/^there are two or more instant and\/or sorcery cards in your graveyard$/, () => P => P.gy.filter(x => /Instant|Sorcery/.test(x.card.type)).length >= 2],
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
COUNT_EXTRA.push([/^(twice )?the number of times (?:it|~|this creature) was kicked$/, m => o => (o.kickN || 0) * (m[1] ? 2 : 1)]);
COUNT_EXTRA.push([/^(?:the number of )?(white|blue|black|red|green) permanents you control$/, m => o => G.players[o.owner].bf.filter(x => (x.card.colors || []).includes({ white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[1]])).length]);
// Sweep round 1: lords by color, "can't be blocked by ..." limits, keyword triggers
STATIC_FN.hasPlus = o => o.counters > 0;
for (const c of ['W', 'U', 'B', 'R', 'G']) { STATIC_FN['c_' + c] = o => (o.card.colors || []).includes(c); BLOCK_FN['not_' + c] = b => !(b.card.colors || []).includes(c); }
for (let n = 1; n <= 8; n++) BLOCK_FN['powLt' + n] = b => pow(b) < n;
BLOCK_FN.powGeAtk = (b, atk) => pow(b) >= pow(atk);
Object.assign(TRIG_FN, {
    renown: (o, ctx) => ctx.src === o && !o.renowned,
    modular: (o, ctx) => { if (ctx.o !== o) return false; G.lastModular = Math.max(0, o.counters); return true; },
    selfDies: (o, ctx) => ctx.o === o,
    allyEnters: (o, ctx) => ctx.o.owner === o.owner && hasType(ctx.o, 'Ally'),
    targetsMe: (o, ctx) => ctx.P.i === o.owner && !!ctx.target && ctx.target.o === o,
    selfTurned: (o, ctx) => ctx.o === o,
    selfHit: (o, ctx) => ctx.src === o,
    training: (o, ctx) => ctx.list.includes(o) && ctx.list.some(x => x !== o && x.owner === o.owner && pow(x) > pow(o)),
    dethrone: (o, ctx) => ctx.list.includes(o) && G.players[1 - o.owner].life >= G.players[o.owner].life
});
Object.assign(BLOCKER_FN, { noPow2: (b, atk) => pow(atk) < 2 });
Object.assign(BLOCK_FN, {
    wallOrFlying: b => hasType(b, 'Wall') || has(b, 'flying'),
    notWall: b => !hasType(b, 'Wall')
});

// ---- Morph (702.37): a face-down 2/2 for {3}; pay the morph cost any time you have priority to turn it face up ----
function faceDownCard(ward) {
    return { id: 'facedown', name: 'Face-down creature', fullName: 'Face-down creature', cost: '', cmc: 0, type: 'Creature', text: ward ? 'Ward {2}' : '', power: '2', toughness: '2', colors: [], ci: [], img: null, imgS: null, rarity: 'common', set: '', num: '', layout: 'normal', legal: {}, usd: null, frame: [], released: null, v: 3 };
}
function canTurnUp(P, o) { return !!o.fdCard && onBf(o.uid) && o.owner === P.i && !!Rx({ card: o.fdCard }).morph && !!planPayment(P, Rx({ card: o.fdCard }).morph); }
function turnFaceUp(P, o) {
    const R = Rx({ card: o.fdCard });
    const plan = planPayment(P, R.morph);
    if (!plan) return false;
    plan.forEach(x => tapSource(P, x));
    o.card = o.fdCard; delete o.fdCard;
    log(`${P.name} ${you(P) ? 'turn' : 'turns'} ${o.card.name} face up.`);
    if (R.megamorph) { putCounters(o, 1, P); log(`${o.card.name} gets a +1/+1 counter (megamorph).`); }
    fire('turnedUp', { o });
    renderGame();
    return true;
}
async function humanTurnUp(uid) {
    const o = findObj(uid), P = me();
    closeSheet();
    if (!o || !canTurnUp(P, o)) { toast('Not enough mana to turn it face up.'); return; }
    turnFaceUp(P, o);
    await settle();
}
// ---- Ninjutsu (702.49): after blockers, return an unblocked attacker to hand; the ninja enters tapped and attacking ----
function ninjaTargets(P) { return (G.attackers || []).map(onBf).filter(a => a && a.owner === P.i && !(G.blocks[a.uid] || []).length); }
function canNinjutsu(P, o) { return !!Rx(o).ninjutsu && P.hand.includes(o) && G.active === P.i && G.phase === 'afterBlocks' && ninjaTargets(P).length > 0 && !!planPayment(P, Rx(o).ninjutsu); }
function doNinjutsu(P, o, att) {
    const plan = planPayment(P, Rx(o).ninjutsu);
    if (!plan || !att || !onBf(att.uid)) return false;
    plan.forEach(x => tapSource(P, x));
    log(`${P.name} ${you(P) ? 'activate' : 'activates'} ninjutsu: ${att.card.name} returns to hand and ${o.card.name} enters attacking.`);
    const pw = att.attackPW;
    G.attackers = G.attackers.filter(u => u !== att.uid);
    leaveBattlefield(att, 'hand');
    pull(P.hand, o); resetObj(o); o.tapped = true; o.sick = true;
    if (pw !== undefined) o.attackPW = pw;
    P.bf.push(o); G.attackers.push(o.uid);
    fire('enters', { o });
    if (Rx(o).etb.length) (G.trigQ = G.trigQ || []).push({ P, o, effects: Rx(o).etb });
    renderGame();
    return true;
}
async function humanNinjutsu(uid) {
    const o = findObj(uid), P = me();
    closeSheet();
    if (!o || !canNinjutsu(P, o)) { toast('Ninjutsu needs an unblocked attacker, after blockers are declared, and the mana.'); return; }
    const t = ninjaTargets(P);
    const att = t.length === 1 ? t[0] : await pickCard(P, t, `Ninjutsu: return which unblocked attacker to your hand?`, { required: true });
    if (att) { doNinjutsu(P, o, att); await settle(); }
}
async function aiNinjutsu(P) {
    for (const o of P.hand.filter(x => Rx(x).ninjutsu && canNinjutsu(P, x))) {
        const t = ninjaTargets(P).sort((a, b) => creatureValue(a) - creatureValue(b))[0];
        if (t && creatureValue(o) >= creatureValue(t) && doNinjutsu(P, o, t)) { await pause(400); break; }
    }
}
// ---- Plot (702.170): exile it from hand for the plot cost (sorcery speed); on a later turn cast it free ----
function canPlot(P, o) { return !!Rx(o).plot && P.hand.includes(o) && G.active === P.i && MAIN.includes(G.phase) && !G.stack.length && !G.over; }
function canPayPlot(P, o) { return !!planPayment(P, Rx(o).plot); }
function plotCard(P, o) {
    const plan = planPayment(P, Rx(o).plot);
    if (!plan) return false;
    plan.forEach(x => tapSource(P, x));
    pull(P.hand, o); P.exile.push(o); o.plotTurn = G.turn; o.playUntil = 1e9; o.freeCast = true;
    log(`${P.name} ${you(P) ? 'plot' : 'plots'} ${o.card.name}: it can be cast free on a later turn.`);
    renderGame();
    return true;
}
async function humanPlot(uid) {
    const o = findObj(uid), P = me();
    closeSheet();
    if (!o || !canPlot(P, o)) { toast('Plot at sorcery speed: in your main phase.'); return; }
    if (!canPayPlot(P, o)) { toast('Not enough mana.'); return; }
    plotCard(P, o);
}
// ---- Leylines: begin the game with it on the battlefield ----
async function leylineStart(P) {
    for (const o of P.hand.filter(x => Rx(x).leyline)) {
        const yes = P.isAI || AUTOPLAY ? true : await askYes(P, `${o.card.name} is in your opening hand: begin the game with it on the battlefield?`, { card: o.card });
        if (yes) { pull(P.hand, o); putOntoBattlefield(P, o, false); log(`${P.name} ${you(P) ? 'begin' : 'begins'} the game with ${o.card.name} on the battlefield.`); }
    }
}
// ---- Devour (702.82): as it enters, sacrifice any number of other creatures; it gets N +1/+1 counters for each ----
async function devourChoice(P, o, n) {
    const pool = P.bf.filter(x => isCreature(x) && x !== o);
    if (!pool.length) return;
    let eaten = 0;
    if (P.isAI || AUTOPLAY) {
        for (const x of pool.filter(y => y.token || creatureValue(y) <= 1.5).slice(0, 3)) { fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); eaten++; }
    } else {
        for (let guard = 0; guard < 20; guard++) {
            const left = P.bf.filter(x => isCreature(x) && x !== o);
            if (!left.length) break;
            const pick = await pickCard(P, left, `${o.card.name}: sacrifice a creature to devour it (${n} counter${n === 1 ? '' : 's'} each) - or skip`);
            if (!pick) break;
            fire('sacrificed', { o: pick }); dieOrLeave(pick, 'gy'); eaten++;
        }
    }
    if (eaten) { const got = putCounters(o, n * eaten, P); log(`${o.card.name} devours ${eaten} creature${eaten === 1 ? '' : 's'} and gets ${got} +1/+1 counters.`); }
}
// ---- Suspend (702.62): exile from hand with time counters; at each of your upkeeps remove one; the last one casts it free ----
function canSuspend(P, o) { return !!Rx(o).suspend && P.hand.includes(o) && !G.over && canCastNow(P, o); }
function canPaySuspend(P, o) { return !!planPayment(P, Rx(o).suspend.cost); }
function suspendCard(P, o) {
    const plan = planPayment(P, Rx(o).suspend.cost);
    if (!plan) return false;
    plan.forEach(x => tapSource(P, x));
    pull(P.hand, o); o.ctr = o.ctr || {}; o.ctr.time = Rx(o).suspend.n; o.suspended = true; P.exile.push(o);
    log(`${P.name} ${you(P) ? 'suspend' : 'suspends'} ${o.card.name} (${Rx(o).suspend.n}).`);
    renderGame();
    return true;
}
async function humanSuspend(uid) {
    const o = findObj(uid), P = me();
    closeSheet();
    if (!o || !canSuspend(P, o)) { toast("You can't suspend that right now."); return; }
    if (!canPaySuspend(P, o)) { toast('Not enough mana.'); return; }
    suspendCard(P, o);
}
async function suspendTick(P) {
    for (const o of P.exile.filter(x => x.suspended && x.ctr && x.ctr.time > 0)) {
        o.ctr.time--;
        log(`${o.card.name}: a time counter is removed (${o.ctr.time} left).`);
        if (o.ctr.time > 0) continue;
        o.suspended = false; o.suspHaste = true;
        log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${o.card.name} from suspend.`);
        const ok = Rx(o).kind === 'land' ? false : await castFreeNow(P, o, P.exile);
        if (!ok) { o.suspHaste = false; log(`${o.card.name} has no target - it stays in exile.`); }
    }
}
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
