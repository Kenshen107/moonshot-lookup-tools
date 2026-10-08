// =====================================================================
// The game. Players are G.players[0] (you) and [1] (the opponent).
// Objects ("o") are cards in play or in a zone: { uid, card, owner, ... }.
// Simplifications for this base model: no stack (spells resolve at once),
// instants can be cast in your main phases, after blocks on your attack,
// and while blocking; triggered abilities other than "when this enters"
// aren't automated.
// =====================================================================
let G = null;
let uidSeq = 1;
const AUTOPLAY = new URLSearchParams(location.search).has('autoplay'); // testing: the game plays both sides

function makeObj(card, owner, extra) {
    // counters: net +1/+1 (negative = -1/-1; the two cancel, rule 704.5q); ctr: other named counters
    return Object.assign({ uid: uidSeq++, card, front: card, owner, tapped: false, sick: true, dmg: 0, counters: 0, ctr: {}, tp: 0, tq: 0, tkw: [], attachedTo: null, dt: false, token: false, isCommander: false }, extra || {});
}
const Rx = o => rulesFor(o.card);
// The player holding the device (G.view; always 0 except in a pass-and-play game) and the other one
const me = () => G.players[G.view || 0];
const foe = () => G.players[1 - (G.view || 0)];
const you = P => !!P && P.i === 0 && !(G && G.hotseat);
const opp = P => G.players[1 - P.i];
const allPerms = () => [...G.players[0].bf, ...G.players[1].bf];
const onBf = uid => allPerms().find(o => o.uid === uid) || null;
function findObj(uid) {
    const onStack = G.stack.find(it => it.kind === 'spell' && it.o.uid === uid);
    if (onStack) return onStack.o;
    for (const P of G.players) for (const z of ['bf', 'hand', 'command', 'gy', 'exile']) { const o = P[z].find(x => x.uid === uid); if (o) return o; }
    return null;
}
const ctrl = o => G.players[o.owner];
const isCreature = o => !o.enchOnly && !(o.bestowed && o.attachedTo) && (marchCreature(o) || !!o.permAnimated || (Rx(o).kind === 'creature' && !(Rx(o).selfCond && Rx(o).selfCond.some(c => c.notCreature && !!G && condOk(c.cond, ctrl(o), o)))) || (!!G && (o.crewed === G.turn || (!!o.animated && o.animated.turn === G.turn))));
function buffsOn(o) {
    const b = { p: 0, q: 0, kw: [] };
    allPerms().forEach(a => {
        if (a.attachedTo !== o.uid || !(Rx(a).buff || Rx(a).buffCond)) return;
        const R = Rx(a);
        if (R.buffCond && condOk(R.buffCond.cond, ctrl(a), a)) b.kw.push(...R.buffCond.kw);
        if (!R.buff) return;
        b.p += R.buff.p; b.q += R.buff.q; b.kw.push(...R.buff.kw);
        if (R.buffPer) { const k = countFn(R.buffPer.what)(R.buffPer.host ? o : a); b.p += R.buffPer.p * k; b.q += R.buffPer.q * k; }
    });
    const st = staticBuffs(o);
    b.p += st.p; b.q += st.q; b.kw.push(...st.kw);
    // Magic 2010: Coat of Arms (each one counts), Relentless Rats
    if (G && isCreature(o)) {
        const coats = allPerms().filter(a => Rx(a).coatOfArms && !lostAbilities(a)).length;
        if (coats) { const mine = creatureTypesOf(o); const k = mine.length ? allPerms().filter(x => x !== o && isCreature(x) && (Rx(x).kw.has('changeling') || Rx(o).kw.has('changeling') || creatureTypesOf(x).some(ty => mine.includes(ty)))).length : 0; b.p += k * coats; b.q += k * coats; }
        if (Rx(o).namedBuff && !lostAbilities(o)) { const k = allPerms().filter(x => x !== o && isCreature(x) && x.card.name === o.card.name).length; b.p += k; b.q += k; }
    }
    if (!lostAbilities(o)) for (const c of Rx(o).selfCond || []) if (!c.notCreature && !c.base && condOk(c.cond, ctrl(o), o)) { b.p += c.p; b.q += c.q; b.kw.push(...c.kw); }
    return b;
}
function creatureTypesOf(o) { const m = (o.card.type || '').match(/—\s*(.+)$/); return m && /Creature/.test(o.card.type) ? m[1].split(/\s+/).filter(Boolean) : []; }
// Convincing Mirage: the basic land type is chosen as it enters; the game picks it (a shortcut):
// a color the land's controller doesn't use if it's their land, else the one they need most
function mirageColor(aura, land) {
    if (aura.chosenLandColor) return aura.chosenLandColor;
    const X = G.players[land.owner], need = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    [...X.hand, ...X.bf, ...X.library].forEach(c => (c.card.colors || []).forEach(k => { if (need[k] !== undefined) need[k]++; }));
    const order = Object.keys(need).sort((a, b) => need[a] - need[b]);
    aura.chosenLandColor = aura.owner !== land.owner ? order[0] : order[order.length - 1];
    log(`${aura.card.name}: the chosen land type is ${{ W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' }[aura.chosenLandColor]}.`);
    return aura.chosenLandColor;
}
// Pithing Needle: the name is chosen as it enters (you pick from the opponent's permanents with activated abilities)
async function needleName(P, o) {
    const pool = opp(P).bf.filter(x => actsOf(x).some(a => !a.effects.every(e => e.t === 'addMana')));
    const uniq = pool.filter((x, i) => pool.findIndex(y => y.card.name === x.card.name) === i);
    let pick = null;
    if (P.isAI || AUTOPLAY) pick = uniq.sort((a, b) => permValue(b) - permValue(a))[0] || null;
    else pick = await pickCard(P, uniq, `${o.card.name}: choose a card name (their activated abilities can't be used)`);
    o.needleName = pick ? pick.card.name : null;
    log(`${o.card.name}: ${pick ? `the chosen name is ${pick.card.name}` : 'no card name was chosen'}.`);
}
const needled = (o, a) => !!G && !a.effects.every(e => e.t === 'addMana') && allPerms().some(n => Rx(n).needle && n.needleName && n.needleName === o.card.name && !lostAbilities(n));
function onBfQuick(o) { const X = G.players[o.owner]; return !!X && X.bf.includes(o); }
// March of the Machines: noncreature artifacts on the battlefield are creatures (P/T = mana value)
function marchCreature(o) { return !!G && !!G.marchOn && o.uid !== undefined && /\bArtifact\b/.test(o.card.type) && Rx(o).kind !== 'creature' && onBfQuick(o); }
function basePT(o, which) {
    const R = Rx(o);
    if (G && G.marchOn && R.kind !== 'creature' && /\bArtifact\b/.test(o.card.type) && !o.permAnimated) return o.card.cmc || 0; // March of the Machines
    if (o.permAnimated && o.permAnimated.life && G) return Math.max(0, G.players[o.owner].life); // Ajani Goldmane's Avatar
    if (o.permAnimated && o.permAnimated.p !== undefined) return o.permAnimated[which];
    if (R.duplicant && o.imprinted && /Creature/.test(o.imprinted.card.type)) return Number(which === 'p' ? o.imprinted.card.power : o.imprinted.card.toughness) || 0;
    if (G) { const st = allPerms().find(a => a.attachedTo === o.uid && Rx(a).buffBase); if (st) return Rx(st).buffBase[which]; }
    if (o.animated && G && o.animated.turn === G.turn) return o.animated[which];
    if (o.baseSet && G && o.baseSet.turn === G.turn) return o.baseSet[which];
    if (o.permAnimated && G) return countFn(o.permAnimated.what)(o);
    const baseSet = (R.selfCond || []).find(c => c.base && G && condOk(c.cond, ctrl(o), o));
    let v = baseSet ? baseSet.base[which] : R.cdaSet && R.cdaSet[which] ? countFn(R.cdaSet[which])(o) + (which === 'q' ? R.cdaSet.qPlus || 0 : 0) : Number(which === 'p' ? o.card.power : o.card.toughness) || 0;
    if (R.cdaAdd) v += R.cdaAdd[which] * countFn(R.cdaAdd.what)(o);
    return v;
}
const pow = o => basePT(o, 'p') + o.counters + o.tp + buffsOn(o).p;
const tou = o => basePT(o, 'q') + o.counters + o.tq + buffsOn(o).q;
const has = (o, k) => ((k === 'indestructible' && o.tkw.includes('-indestructible')) || (k === 'flying' && !!G && allPerms().some(a => a.attachedTo === o.uid && Rx(a).buff && Rx(a).buff.kw.includes('-flying')))) ? false : (!!G && o.uid !== undefined && G.players[o.owner] && G.players[o.owner].bf.some(a => a !== o && Rx(a).permKw && Rx(a).permKw.includes(k) && !lostAbilities(a))) || (k === 'indestructible' && o.aegisBy && (() => { const a = onBf(o.aegisBy); return a && a.owner === o.owner; })()) || (Rx(o).kw.has(k) && !lostAbilities(o)) || o.tkw.includes(k) || (!!o.animated && !!G && o.animated.turn === G.turn && o.animated.kw.includes(k)) || buffsOn(o).kw.includes(k);
const lockedOut = o => !!o.lockedBy && (() => { const a = onBf(o.lockedBy); return !!a && a.owner === o.owner; })();
const canAttackWith = o => isCreature(o) && !o.tapped && !preconCantAttack(o) && !(Rx(o).attackNeedsLand && !G.players[1 - ctrl(o).i].bf.some(l => hasType(l, Rx(o).attackNeedsLand))) && (!o.sick || has(o, 'haste')) && !has(o, 'defender') && !has(o, 'cantattack') && !(o.detainedUntil > G.turn) && !lockedOut(o) && !(Rx(o).attackCond && !lostAbilities(o) && !condOk(Rx(o).attackCond, ctrl(o), o));

function log(msg) {
    G.log.push(msg);
    showActBanner(msg);
    if (G.log.length > 80) G.log.shift();
    const el = $('log');
    if (el) {
        el.innerHTML = G.log.slice(-40).map(l => `<div>${esc(l).replace(/rule (\d{3}\.\d+[a-z]?)/g, (m, n) => `<a href="#" onclick="openRule('${n}'); return false;">rule ${n}</a>`)}</div>`).join('');
        el.scrollTop = el.scrollHeight;
    }
}
const pause = ms => sleep(AUTOPLAY ? 0 : ms);

// ---- Setup ----
function makePlayer(i, name, deck, isAI) {
    const P = { i, name, isAI, life: FORMATS[deck.format].life, library: [], hand: [], bf: [], gy: [], exile: [], command: [],
        landsPlayed: 0, tax: 0, cmdDmg: 0, deckName: deck.name, source: deck.source || '', drewEmpty: false, mulligans: 0,
        aiLevel: deck.aiLevel || 'normal', aiStyle: deck.aiStyle || null, poison: 0, energy: 0, exp: 0 };
    deck.entries.forEach(e => { for (let k = 0; k < e.n; k++) P.library.push(makeObj(e.card, i)); });
    shuffle(P.library);
    if (deck.commander) {
        const c = makeObj(deck.commander, i, { isCommander: true });
        P.command.push(c);
        P.commanderUid = c.uid;
    }
    return P;
}

function deckToEntries(deck) {
    return {
        name: deck.name, format: deck.format, commander: deck.commander ? CARDS.get(deck.commander) : null,
        entries: Object.entries(deck.cards).map(([id, n]) => ({ card: CARDS.get(id), n })).filter(e => e.card)
    };
}

async function startMatch(again) {
    const deck = profile.decks[$('playDeck').value];
    if (!deck) { toast('Pick a deck first.'); return; }
    if (!chosenOpponent) { toast('Pick an opponent first.'); return; }
    const probs = deckProblems(deck);
    if (probs.length && !again && !startMatch.forced) {
        showModal(`<h2>This deck has things to fix</h2><p class="note">${probs.slice(0, 6).map(esc).join('<br>')}</p>
            <div class="row" style="justify-content:center; margin-top:12px;"><button class="btn primary" onclick="startMatch.forced = true; closeModal(); startMatch();">Play anyway</button><button class="btn" onclick="closeModal()">Go back</button></div>`);
        return;
    }
    startMatch.forced = false;
    showModal('<h2>Shuffling up...</h2><p class="loading">Building your opponent\'s deck from live card data...</p>');
    try {
        await cardsByIds([...Object.keys(deck.cards), deck.commander].filter(Boolean));
        let oppDeck;
        if (chosenOpponent.type === 'theme') {
            const theme = MODERN_THEMES.find(t => t.key === chosenOpponent.key);
            oppDeck = await buildThemeDeck(theme);
            oppDeck.source = 'Scryfall theme deck';
        } else if (chosenOpponent.type === 'list') {
            oppDeck = chosenOpponent.gen;
        } else if (chosenOpponent.type === 'verified') {
            const v = VERIFIED_DECKS.find(x => x.key === chosenOpponent.key);
            oppDeck = await listToOppDeck(v.text, 'commander');
            oppDeck.source = `fully working deck (checked ${v.checked})`;
        } else {
            oppDeck = await buildCommanderDeck(chosenOpponent.key);
            oppDeck.source = `EDHREC average deck${oppDeck.swapped ? `, ${oppDeck.swapped} cards swapped for lands` : ''}`;
        }
        closeModal();
        newGame(deckToEntries(deck), oppDeck);
    } catch (e) {
        console.error(e);
        showModal(`<h2>Couldn't start</h2><p class="warn">${esc(e.message)}</p><div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">OK</button></div>`);
    }
}

async function newGame(myDeck, oppDeck, friend) {
    uidSeq = 1;
    actReset();
    G = { format: myDeck.format, players: [], active: 0, turn: 1, phase: 'setup', log: [], attackers: [], blocks: {}, mode: null, over: false, busy: true,
        stack: [], stackRunning: false, priority: null, campaign: oppDeck.campaign || null, view: 0, hotseat: friend || null, draftRound: oppDeck.draftRound };
    G.players = friend ? [makePlayer(0, friend.accounts[0], myDeck, false), makePlayer(1, friend.accounts[1], oppDeck, false)]
        : [makePlayer(0, 'You', myDeck, AUTOPLAY), makePlayer(1, oppDeck.commander ? oppDeck.commander.name : oppDeck.name, oppDeck, true)];
    $('game').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    log(`${FORMATS[G.format].name} game: ${myDeck.name} vs ${oppDeck.name}${oppDeck.source ? ` (${oppDeck.source})` : ''}.`);
    G.players.forEach(P => drawCards(P, 7, true));
    renderGame();
    await handTo(G.players[0]); await mulligan(G.players[0]);
    await handTo(G.players[1]); await mulligan(G.players[1]);
    G.active = rand(2);
    log(`${G.players[G.active].name} ${you(G.players[G.active]) ? 'go' : 'goes'} first (coin flip).`);
    G.firstTurn = true;
    beginTurn();
}

// London mulligan: draw seven, then put one card on the bottom for each mulligan.
async function mulligan(P) {
    if (P.isAI) {
        let lands = P.hand.filter(o => Rx(o).kind === 'land').length;
        if ((lands < 2 || lands > 5) && P.mulligans === 0) {
            P.mulligans = 1;
            P.library.push(...P.hand.splice(0));
            shuffle(P.library);
            drawCards(P, 7, true);
            const nonland = P.hand.filter(o => Rx(o).kind !== 'land').sort((a, b) => b.card.cmc - a.card.cmc);
            const bottom = nonland[0] || P.hand[0];
            pull(P.hand, bottom);
            P.library.unshift(bottom);
            log(`${P.name} mulligans to 6.`);
        }
        return;
    }
    while (true) {
        const choice = await new Promise(resolve => {
            showModal(`<h2>Your opening hand</h2>
                <p class="note">${P.mulligans ? `Mulligan ${P.mulligans}: you'll put ${P.mulligans} card${P.mulligans === 1 ? '' : 's'} on the bottom if you keep.` : 'Keep these seven, or shuffle and draw a new seven (and put one on the bottom).'}</p>
                <div class="hand mull-hand">${P.hand.map(o => `<span class="hc">${o.card.imgS || o.card.img ? `<img src="${o.card.imgS || o.card.img}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}</span>`).join('')}</div>
                <div class="mull-actions"><button class="btn primary" id="keepBtn">✔ Keep ${P.hand.length - P.mulligans}</button><button class="btn" id="mullBtn" ${P.mulligans >= 4 ? 'disabled' : ''}>↻ Mulligan</button></div>`);
            $('keepBtn').onclick = () => resolve('keep');
            $('mullBtn').onclick = () => resolve('mull');
        });
        if (choice === 'keep') break;
        P.mulligans++;
        P.library.push(...P.hand.splice(0));
        shuffle(P.library);
        drawCards(P, 7, true);
    }
    if (P.mulligans) {
        const picked = new Set();
        await new Promise(resolve => {
            const draw = () => {
                showModal(`<h2>Put ${P.mulligans} on the bottom</h2><p class="note">Tap cards to choose (${picked.size}/${P.mulligans}).</p>
                    <div class="hand mull-hand">${P.hand.map(o => `<button class="hc${picked.has(o.uid) ? ' chosen' : ''}" data-uid="${o.uid}">${o.card.imgS || o.card.img ? `<img src="${o.card.imgS || o.card.img}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}</button>`).join('')}</div>
                    <div class="mull-actions"><button class="btn primary" id="bottomBtn" ${picked.size === P.mulligans ? '' : 'disabled'}>Done</button></div>`);
                document.querySelectorAll('#modalHost .hc').forEach(b => b.onclick = () => {
                    const u = Number(b.dataset.uid);
                    if (picked.has(u)) picked.delete(u); else if (picked.size < P.mulligans) picked.add(u);
                    draw();
                });
                $('bottomBtn').onclick = resolve;
            };
            draw();
        });
        P.hand.filter(o => picked.has(o.uid)).forEach(o => { pull(P.hand, o); P.library.unshift(o); });
        log(`You mulligan to ${P.hand.length}.`);
    }
    closeModal();
}

// ---- Zones ----
// +1/+1 counters put on a permanent (Mauhúr adds one more to Armies, Goblins and Orcs)
function putCounters(o, n, by) {
    if (!o || n <= 0 || !onBf(o.uid)) return 0;
    const X = G.players[o.owner];
    let bonus = X.bf.filter(a => (Rx(a).counterBonus || []).some(ty => hasType(o, ty))).length;
    // Hardened Scales (+1), Doubling Season / Branching Evolution (x2)
    X.bf.forEach(a => { const cm = Rx(a).counterMod; if (!cm || lostAbilities(a)) return; if (cm.what === 'creature' && !isCreature(o)) return; if (cm.what === 'artifact or creature' && !isCreature(o) && !/Artifact/.test(o.card.type)) return; const t = (n + bonus) * cm.times + cm.plus; bonus = t - n; });
    o.counters += n + bonus;
    X.counterTurn = G.turn;
    fire('counters', { P: by || X, o });
    return n + bonus;
}
// Doubling Season, Anointed Procession: tokens made are doubled for each
function tokenMult(P) { return 2 ** P.bf.filter(a => Rx(a).tokenDouble && !lostAbilities(a)).length; }
// A token was created: "whenever you create a token" and Peregrin Took's extra Food
function tokenMade(P, quiet) {
    P.tokenTurn = G.turn;
    fire('tokenMade', { P });
    if (G.makingFood) return;
    const n = P.bf.filter(a => Rx(a).extraFood).length;
    if (!n) return;
    G.makingFood = true;
    for (let k = 0; k < n; k++) makeArtifactToken(P, 'food');
    G.makingFood = false;
    if (!quiet) log(`${P.name} ${you(P) ? 'create' : 'creates'} ${n === 1 ? 'an extra Food token' : `${n} extra Food tokens`} (Peregrin Took).`);
}
// A token copy of a card (offspring, Relm's Sketching, Alania's copy of a creature spell)
function tokenCopyOf(P, card, opts = {}) {
    const c = { ...card, id: `token-${uidSeq}`, name: card.name, fullName: `${card.name} (token)` };
    if (opts.p !== undefined) { c.power = String(opts.p); c.toughness = String(opts.q); }
    const tok = makeObj(c, P.i, { token: true });
    P.bf.push(tok);
    G.lastMade = tok;
    log(`${P.name} ${you(P) ? 'create' : 'creates'} a token copy of ${card.name}${opts.p !== undefined ? ` (${opts.p}/${opts.q})` : ''}.`);
    fire('enters', { o: tok });
    if (Rx(tok).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: tok, effects: Rx(tok).etb });
    tokenMade(P);
    return tok;
}
function drawCards(P, n, quiet) {
    const sf = G && G.phase !== 'setup' && allPerms().some(x => Rx(x).sharedFate && !lostAbilities(x));
    if (sf) {
        const O = G.players[1 - P.i];
        for (let k = 0; k < n; k++) { const c = O.library.pop(); if (!c) break; c.realOwner = O.i; c.owner = P.i; c.playUntil = 1e9; P.exile.push(c); }
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${n === 1 ? 'the top card' : `the top ${n} cards`} of ${O.name === 'You' ? 'your' : `${O.name}'s`} library face down instead of drawing (Shared Fate).`);
        return;
    }
    // Asmodeus: "If you would draw a card, exile the top card of your library face down instead"
    const asmo = P.bf.find(a => Rx(a).drawExile && !lostAbilities(a));
    if (asmo && G.phase !== 'setup') {
        for (let k = 0; k < n; k++) { const o = P.library.pop(); if (!o) { P.drewEmpty = true; break; } o.exiledBy2 = asmo.uid; P.exile.push(o); }
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${n === 1 ? 'the top card' : `the top ${n} cards`} face down instead of drawing (${asmo.card.name}).`);
        return;
    }
    // "If you would draw a card except the first one you draw in each of your draw steps, draw two instead"
    if (G && G.phase !== 'setup' && !G.inDrawStep) { const dd = P.bf.filter(a => Rx(a).doubleDraw && !lostAbilities(a)).length; if (dd) { const before = n; n = n * 2 ** dd; log(`${P.name} ${you(P) ? 'draw' : 'draws'} ${n} instead of ${before} (${P.bf.find(a => Rx(a).doubleDraw).card.name}).`); } }
    for (let k = 0; k < n; k++) {
        const o = P.library.pop();
        if (!o && P.bf.some(a => Rx(a).labMan && !lostAbilities(a)) && G.phase !== 'setup') { log(`${P.name} would draw from an empty library and ${you(P) ? 'win' : 'wins'} instead (Laboratory Maniac).`); endGame(P.i, `${you(P) ? 'You' : P.name} drew from an empty library with a "win instead" card out.`); return; }
        if (!o) { P.drewEmpty = true; log(`${P.name} can't draw - the library is empty!`); break; }
        P.hand.push(o);
    }
    if (!quiet) log(`${P.name} ${you(P) ? 'draw' : 'draws'} ${n === 1 ? 'a card' : `${n} cards`}.`);
    if (G.phase !== 'setup') for (let k = 0; k < n; k++) fire('draw', { P });
}
function removeFromZones(o) {
    for (const P of G.players) for (const z of ['bf', 'hand', 'command', 'gy', 'exile', 'library']) {
        const i = P[z].indexOf(o);
        if (i >= 0) { P[z].splice(i, 1); return; }
    }
}
function resetObj(o) { Object.assign(o, { enchOnly: false, tapped: false, sick: true, dmg: 0, counters: 0, ctr: {}, tp: 0, tq: 0, tkw: [], attachedTo: null, dt: false, kicked: false, sagaDone: false, bestowed: false, blitzed: false, warpExile: 0, saddledTurn: 0, saddlers: null }); }
// A commander that would go to the graveyard or exile goes back to the command zone.
function leaveBattlefield(o, zone) {
    const wasOn = !!(G && onBf(o.uid));
    if (wasOn && zone === 'gy' && !o.token && /\bArtifact\b/.test(o.card.type) && (G.players[o.realOwner ?? o.owner].emblems || []).includes('artifactReturn')) o.returnAtEnd = true;
    // Unearth (702.84): exiled instead if it would leave the battlefield
    if (wasOn && o.unearthed) { zone = 'exile'; delete o.unearthed; delete o.exileAtEnd; log(`${o.card.name} is exiled (unearth).`); }
    if (wasOn && o.copyOf) { o.card = o.copyOf; delete o.copyOf; delete o.copyTurn; }
    if (wasOn) {
        // Things that last "for as long as you control ~"
        G.players.forEach(X => X.exile.filter(x => x.playWhile === o.uid).forEach(x => { x.playUntil = -1; delete x.playWhile; }));
        allPerms().filter(x => x.stolenBy === o.uid).forEach(x => {
            const from = G.players[x.owner], back = G.players[x.realOwner ?? x.owner];
            pull(from.bf, x); x.owner = back.i; delete x.realOwner; delete x.stolenBy; back.bf.push(x);
            log(`${x.card.name} goes back to ${you(back) ? 'you' : back.name}.`);
        });
    }
    if (wasOn) { o.lastPow = isCreature(o) ? pow(o) : 0; }
    if (wasOn) allPerms().filter(x => x.permAnimated && x.permAnimated.whileSrc === o.uid).forEach(x => { delete x.permAnimated; log(`${x.card.name} is no longer a creature.`); }); // Awakener Druid
    if (wasOn) { o.lastCounters = Math.max(0, o.counters); if ((Rx(o).trig || []).some(t => t.ev === 'leaves') || (o.token && allPerms().some(a => (Rx(a).trig || []).some(t => t.ev === 'leaves' && t.tokenMine)))) fire('leaves', { o }); }
    if (wasOn && zone === 'gy' && /Artifact/.test(o.card.type)) fire('artifactToGy', { o }); // Disciple of the Vault
    // Cards it exiled "until it leaves the battlefield" come back (610.3)
    if (wasOn) G.players.forEach(X => X.exile.filter(x => x.exiledBy === o.uid).forEach(x => {
        pull(X.exile, x); delete x.exiledBy; resetObj(x); X.bf.push(x);
        log(`${x.card.name} returns to the battlefield.`); fire('enters', { o: x });
        if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: x, effects: Rx(x).etb });
    }));
    removeFromZones(o);
    if (o.front) o.card = o.front; // a transformed card is its front face in every other zone (711.8)
    // "When ~ is put into a graveyard from the battlefield" fires once it's there (below)
    if (wasOn && zone === 'gy' && !o.token && (Rx(o).trig || []).some(t => t.ev === 'toGy')) (G.toGyQ = G.toGyQ || []).push(o);
    if (o.realOwner !== undefined) { o.owner = o.realOwner; delete o.realOwner; delete o.stolenTurn; }
    resetObj(o);
    const P = G.players[o.owner];
    if (o.token) return;
    if (o.isCommander && zone !== 'hand') { P.command.push(o); log(`${o.card.name} returns to the command zone.`); return; }
    P[zone].push(o);
    if (wasOn && zone === 'gy') o.toGyTurn = G.turn;
    if (G && G.toGyQ && G.toGyQ.includes(o)) { G.toGyQ = G.toGyQ.filter(x => x !== o); fire('toGy', { o }); }
}
function destroy(o, why) {
    if (has(o, 'indestructible')) { log(`${o.card.name} is indestructible.`); return; }
    if (o.regen) { o.regen--; o.tapped = true; o.dmg = 0; G.attackers = G.attackers.filter(u => u !== o.uid); log(`${o.card.name} regenerates (rule 701.19).`); return; }
    log(`${o.card.name} ${why || 'is destroyed'}.`);
    dieOrLeave(o, 'gy');
}

const isPlaneswalker = o => !!o && !!o.card && Rx(o).kind === 'planeswalker' && !isCreature(o);
const isBattle = o => !!o && !!o.card && Rx(o).kind === 'battle';
function damage(target, n, src) {
    if (n <= 0) return;
    n = preconDamage(target, n, src); if (n <= 0) return; // replacement and prevention effects of the precon rounds (15b-precon-effects.js)
    // ---- Magic 2010 (2026-10-08): Safe Passage, Harm's Way, Guardian Seraph, Magebane Armor, Protean Hydra ----
    const tgtP = target.life !== undefined ? target : (target.card && target.uid !== undefined && G.players[target.owner]) || null;
    const oppSrc = !!(src && src.card && src.uid !== undefined && G.players[src.owner] && tgtP && src.owner !== tgtP.i);
    if (tgtP && tgtP.safeTurn === G.turn && G.noPrevent !== G.turn && (target.life !== undefined || isCreature(target))) { log(`Damage to ${target.card ? target.card.name : target.name} is prevented (Safe Passage).`); return; }
    if (tgtP && oppSrc && tgtP.harmsWay && tgtP.harmsWay.turn === G.turn && tgtP.harmsWay.n > 0 && G.noPrevent !== G.turn) {
        const hw = tgtP.harmsWay, k = Math.min(n, hw.n), to = hw.t.p || (hw.t.o && onBf(hw.t.o.uid));
        hw.n -= k; n -= k;
        log(`Harm's Way: ${k} damage from ${src.card.name} is dealt to ${to ? (to.card ? to.card.name : to.name) : 'nothing'} instead.`);
        if (to) damage(to, k, src);
        if (n <= 0) return;
    }
    if (target.life !== undefined && oppSrc && G.noPrevent !== G.turn) { const k = target.bf.filter(x => Rx(x).seraph && !lostAbilities(x)).length; if (k) { n -= k; log(`Guardian Seraph prevents ${Math.min(k, n + k)} damage.`); if (n <= 0) return; } }
    if (target.card && !G.inCombatDamage && has(target, 'nononcombat') && G.noPrevent !== G.turn) { log(`Noncombat damage to ${target.card.name} is prevented.`); return; }
    if (target.card && Rx(target).protean && !lostAbilities(target) && G.noPrevent !== G.turn) {
        const k = Math.min(n, Math.max(0, target.counters));
        target.counters -= k; if (k) target.proteanDue = (target.proteanDue || 0) + 2 * k;
        log(`${target.card.name} prevents ${n} damage${k ? ` and loses ${k} +1/+1 counter${k === 1 ? '' : 's'}` : ''}.`);
        return;
    }
    // ---- Mirrodin (2026-10-08): Awe Strike, Mourner's Shield, Pearl Shard, Sphere of Purity ----
    if (src && src.aweStrike && src.aweStrike.turn === G.turn) { const by = G.players[src.aweStrike.by]; delete src.aweStrike; by.life += n; log(`${src.card.name}'s damage is prevented; ${by.name} ${you(by) ? 'gain' : 'gains'} ${n} life (Awe Strike).`); fire('gainLife', { P: by, n }); return; }
    if (src && src.noDmgTurn === G.turn) { log(`Damage from ${src.card.name} is prevented.`); return; }
    if (target.prevent && target.prevent.turn === G.turn && target.prevent.n > 0) { const k = Math.min(n, target.prevent.n); target.prevent.n -= k; n -= k; log(`${k} damage to ${target.card ? target.card.name : target.name} is prevented.`); if (n <= 0) return; }
    if (target.life !== undefined && src && src.card && /Artifact/.test(src.card.type)) { const sp = target.bf.filter(x => Rx(x).sphere && !lostAbilities(x)).length; if (sp) { n -= sp; log(`Sphere of Purity prevents ${sp} damage.`); if (n <= 0) return; } }
    if (target.card && has(target, 'preventdmg') && G.noPrevent !== G.turn) { log(`Damage to ${target.card.name} is prevented.`); return; }
    // Fiery Emancipation, Torbran, Dictate of the Twin Gods: more damage from your sources
    if (src && src.card && src.uid !== undefined && G.players[src.owner]) {
        const S = G.players[src.owner], tOwner = target.life !== undefined ? target.i : target.owner, toOpp = tOwner !== S.i;
        S.bf.forEach(a => { const dp = Rx(a).dmgPlus; if (dp && toOpp && !lostAbilities(a) && (src.card.colors || []).includes(dp.color)) n += dp.n; });
        S.bf.forEach(a => { const dm = Rx(a).dmgMult; if (dm && (!dm.oppOnly || toOpp) && !lostAbilities(a)) n *= dm.n; });
    }
    // Calamity Bearer: damage from a Giant source you control is doubled
    if (src && src.card && src.uid !== undefined && G.players[src.owner]) { const k = G.players[src.owner].bf.filter(a => Rx(a).doubleType && hasType(src, Rx(a).doubleType) && !lostAbilities(a)).length; if (k) { n *= 2 ** k; log(`${src.card.name}'s damage is doubled.`); } }
    // Ironscale Hydra: combat damage from a creature is prevented and becomes a +1/+1 counter
    if (target.card && G.inCombatDamage && Rx(target).combatShield && !lostAbilities(target) && src && src.card && isCreature(src) && G.noPrevent !== G.turn) { log(`${target.card.name} prevents the damage and gets a +1/+1 counter.`); putCounters(target, 1); return; }
    if (src && src.card && src.uid !== undefined && onBf(src.uid)) fire('dealsDamage', { src, n, o: target.card ? target : null, P: target.life !== undefined ? target : null });
    if (target.life !== undefined) fire('playerDamaged', { P: target, n, src });
    if (target.card && src && src.uid !== undefined) { target.dmgBy = target.dmgBy || {}; target.dmgBy[src.uid] = G.turn; }
    if (target.card && isCreature(target)) fire('dealtDamage', { o: target, n });
    if (target.life !== undefined) target.lostTurn = G.turn;
    if (target.life !== undefined && G.inCombatDamage && src && src.uid !== undefined) { if (!src.hitTurn || src.hitTurn.turn !== G.turn) src.hitTurn = { turn: G.turn, players: [] }; if (!src.hitTurn.players.includes(target.i)) src.hitTurn.players.push(target.i); }
    if (target.card && protFrom(target, src)) { log(`${target.card.name} has protection - the damage from ${src.card.name} is prevented.`); return; }
    const infect = src && src.card && has(src, 'infect'), wither = src && src.card && has(src, 'wither');
    if (target.life !== undefined) {
        // Infect: damage to a player is given as poison counters (702.90b)
        if (infect) target.poison += n; else target.life -= n;
        if (src && src.isCommander && G.format === 'commander' && isCreature(src)) target.cmdDmg += n;
    } else if (isPlaneswalker(target)) {
        target.ctr.loyalty = (target.ctr.loyalty || 0) - n; // damage to a planeswalker removes loyalty (120.3c)
        log(`${target.card.name} loses ${n} loyalty.`);
    } else if (isBattle(target)) {
        target.ctr.defense = (target.ctr.defense || 0) - n; // damage to a battle removes defense counters (120.3h)
        log(`${target.card.name} loses ${n} defense (${Math.max(0, target.ctr.defense)} left).`);
    } else {
        // Infect and wither: damage to a creature is -1/-1 counters (702.80a, 702.90b)
        if (infect || wither) target.counters -= n; else target.dmg += n;
        if (src && src.card && has(src, 'deathtouch')) target.dt = true;
    }
    if (src && src.card && isCreature(src) && has(src, 'lifelink')) { n += lifeGainBonus(ctrl(src)); ctrl(src).life += n; fire('gainLife', { P: ctrl(src), n }); }
}

// State-based actions: lethal damage, 0 toughness, loose Auras, losing.
function sba() {
    if (!G || G.over) return;
    lifeWatch();
    discardWatch();
    let changed = true, rounds = 0;
    while (changed && rounds++ < 100) { // a guard against a loop of deaths and returns
        changed = false;
        for (const o of allPerms()) {
            if (isCreature(o)) {
                const t = tou(o);
                if (t <= 0) { log(`${o.card.name} dies (0 toughness).`); dieOrLeave(o, 'gy'); changed = true; continue; }
                if ((o.dmg >= t || (o.dt && o.dmg > 0)) && !has(o, 'indestructible')) {
                    if (o.regen) { o.regen--; o.tapped = true; o.dmg = 0; o.dt = false; log(`${o.card.name} regenerates (rule 701.19).`); changed = true; continue; }
                    log(`${o.card.name} dies.`); dieOrLeave(o, 'gy'); changed = true; continue;
                }
            }
            if (Rx(o).kind === 'planeswalker' && !isCreature(o) && (o.ctr.loyalty || 0) <= 0 && o.pwReady) { log(`${o.card.name} has no loyalty left and goes to the graveyard (rule 704.5i).`); leaveBattlefield(o, 'gy'); changed = true; continue; }
            if (o.sagaDone && !G.stack.some(it => it.o === o) && !(G.trigQ || []).some(q => q.o === o)) { log(`${o.card.name} is sacrificed - its last chapter is done (rule 714.4).`); leaveBattlefield(o, 'gy'); changed = true; continue; }
            if (Rx(o).isAura && !onBf(o.attachedTo)) { log(`${o.card.name} goes to the graveyard.`); leaveBattlefield(o, 'gy'); changed = true; }
            // Bestow (702.103f): an unattached bestowed Aura becomes a creature again
            if (o.bestowed && !onBf(o.attachedTo)) { o.bestowed = false; o.attachedTo = null; log(`${o.card.name} is no longer attached and becomes a creature again (rule 702.103f).`); changed = true; continue; }
            // A battle with no defense counters is defeated (704.5v); a Siege is exiled and cast transformed (310.11)
            if (isBattle(o) && o.ctr.defense !== undefined && o.ctr.defense <= 0) {
                const X = G.players[o.owner];
                log(`${o.card.name} is defeated (rule 704.5v) and exiled.`);
                leaveBattlefield(o, 'exile');
                if (X.exile.includes(o) && o.front && o.front.back) (G.trigQ = G.trigQ || []).push({ P: X, o, effects: [{ t: 'castBattleBack' }] });
                changed = true; continue;
            }
            if (Rx(o).isEquipment && o.attachedTo && !onBf(o.attachedTo)) o.attachedTo = null;
        }
        // 704.5j the legend rule: two legendary permanents with the same name under one
        // player - one goes to the graveyard. The game keeps the newest (your commander first).
        for (const P of G.players) {
            const byName = new Map();
            P.bf.filter(o => Rx(o).legendary).forEach(o => { const k = o.card.name; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(o); });
            for (const [name, list] of byName) {
                if (list.length < 2) continue;
                const keep = list.find(o => o.isCommander) || list[list.length - 1];
                list.filter(o => o !== keep).forEach(o => { log(`${name}: legend rule - ${P.name} ${you(P) ? 'keep' : 'keeps'} one, the other goes to the graveyard (rule 704.5j).`); dieOrLeave(o, 'gy'); });
                changed = true;
            }
        }
    }
    G.marchOn = allPerms().some(x => Rx(x).march && !lostAbilities(x));
    const lost = G.players.filter(P => (P.life <= 0 || P.drewEmpty || P.poison >= 10 || (G.format === 'commander' && P.cmdDmg >= 21)) && !P.bf.some(x => Rx(x).cantLose && !lostAbilities(x)));
    if (lost.length) {
        const P = lost[0];
        const you = P.i === 0 && !G.hotseat;
        const reason = P.life <= 0 ? `${you ? 'You are' : `${P.name} is`} at ${P.life} life.`
            : P.drewEmpty ? `${you ? 'You have' : `${P.name} has`} no cards left to draw.`
            : P.poison >= 10 ? `${you ? 'You have' : `${P.name} has`} 10 poison counters (rule 704.5c).`
            : `${you ? 'You' : P.name} took 21 commander damage.`;
        endGame(lost.length === 2 ? null : 1 - P.i, lost.length === 2 ? 'Both players lost at the same time.' : reason);
    }
}

// ---- Mana ----
// A permanent's mana ability ("Target land gains '{T}: Add {G}{G}{G}' until end of turn" overrides it)
function manaOf(o) {
    if (o.tempMana && G && o.tempMana.turn === G.turn) return { colors: ['G'], n: 3, fixed: true };
    const R = Rx(o);
    let m = R.mana;
    if (!G || !o.uid) return m;
    if (o.ctr && o.ctr.flood > 0 && /\bLand\b/.test(o.card.type)) return { colors: ['U'], n: 1 }; // an Island while it has a flood counter
    if (m && m.nPow) { const n = Math.max(0, pow(o)); return n ? { ...m, n, fixed: true, colors: ['G'] } : null; } // Viridian Joiner
    if (m && m.imprintColors) { const cs = o.imprinted ? (o.imprinted.card.colors || []).filter(c => COLORS.includes(c)) : []; return cs.length ? { ...m, colors: cs } : null; } // Chrome Mox
    if (m && /\bLand\b/.test(o.card.type)) { const lens = allPerms().filter(l => Rx(l).lens && l.imprinted && l.imprinted.card.name === o.card.name && !lostAbilities(l)).length; if (lens) m = { ...m, n: (m.n || 1) + lens }; } // Extraplanar Lens
    const X = G.players[o.owner];
    // Cryptolith Rite, Enduring Vitality: creatures tap for any color
    if (!m && isCreature(o) && X.bf.some(a => Rx(a).creatureMana && !lostAbilities(a))) return { colors: [...COLORS], n: 1 };
    // Rishkar (creatures with counters) and Jaheira (tokens): "{T}: Add {G}"
    if (!m && isCreature(o) && ((o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0)) && X.bf.some(a => Rx(a).counterMana && !lostAbilities(a)))) return { colors: [X.bf.find(a => Rx(a).counterMana).card && Rx(X.bf.find(a => Rx(a).counterMana)).counterMana], n: 1 };
    if (!m && o.token && X.bf.some(a => Rx(a).tokenMana && !lostAbilities(a))) return { colors: [Rx(X.bf.find(a => Rx(a).tokenMana)).tokenMana], n: 1 };
    if (!m) return m;
    if (o.token && /Treasure/.test(o.card.type) && m.sac && X.bf.some(a => Rx(a).bigTreasure && !lostAbilities(a))) m = { ...m, n: 2 };
    if (m.chosen) { const cols = [...new Set([m.base, o.chosenColor].filter(Boolean))]; return { ...m, colors: cols.length ? cols : ['C'] }; }
    if (m.among) { const cols = amongColors(X, m.among); return { ...m, colors: cols, n: m.each ? cols.length : cols.length ? 1 : 0, fixed: !!m.each }; }
    // Exotic Orchard / Fellwar Stone / Reflecting Pool: the colors those lands could make right now (none: it makes nothing)
    if (m.like) {
        const lands = (m.like === 'opp' ? G.players[1 - X.i].bf : X.bf.filter(a => a !== o)).filter(a => /\bLand\b/.test(a.card.type));
        const cols = [...new Set(lands.flatMap(a => { const lm = Rx(a).mana; return lm && !lm.like ? lm.colors : []; }))].filter(c => m.like === 'mine' || c !== 'C');
        return { ...m, colors: cols, n: cols.length ? 1 : 0 };
    }
    const isLand = /\bLand\b/.test(o.card.type);
    // Urza's Tower: more mana with the full set (Tron)
    if (m.tron && m.tron.need.every(nm => X.bf.some(a => a.card.name === nm))) m = { ...m, n: m.tron.n };
    // Verge lands: the second color only with the right land types
    if (R.condMana && X.bf.some(a => R.condMana.types.some(t => hasType(a, t)))) m = { ...m, colors: [...new Set([...m.colors, R.condMana.color])] };
    if (isLand) {
        if (X.bf.some(a => Rx(a).landsAnyColor && !lostAbilities(a))) m = { ...m, colors: [...COLORS], fixed: false };
        X.bf.forEach(a => { const ty = Rx(a).landTypeMine; if (ty && !lostAbilities(a)) { const c = LAND_COLOR[ty]; if (c && !m.colors.includes(c)) m = { ...m, colors: [...m.colors.filter(x => x !== 'C'), c], fixed: false }; } });
        allPerms().forEach(a => { const ty = Rx(a).landTypeAll; if (ty && !lostAbilities(a)) { const c = LAND_COLOR[ty]; if (c && !m.colors.includes(c)) m = { ...m, colors: [...m.colors.filter(x => x !== 'C'), c] }; } });
        // Crypt Ghast, Mana Reflection-style: an additional mana
        const extra = [];
        X.bf.forEach(a => { const ex = Rx(a).extraMana; if (ex && !lostAbilities(a) && ((ex.host && a.attachedTo === o.uid) || (ex.type && hasType(o, ex.type)) || ex.all)) extra.push(ex.color === 'any' ? m.colors[0] : ex.color); });
        if (extra.length) m = { ...m, n: m.n + extra.length, extra };
    }
    return m;
}
// "any color among legendary creatures and planeswalkers you control" (Mox Amber), "... among permanents you control" (Bloom Tender)
function amongColors(X, what) {
    const fits = what === 'permanents' ? () => true : what === 'legendary permanents' ? x => /\bLegendary\b/.test(x.card.type) : x => /\bLegendary\b/.test(x.card.type) && (isCreature(x) || isPlaneswalker(x));
    return COLORS.filter(c => X.bf.some(x => fits(x) && (x.card.colors || []).includes(c)));
}
const LAND_COLOR = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
function manaSources(P) {
    return P.bf.filter(o => !o.tapped && manaOf(o) && manaOf(o).n > 0 && !(isCreature(o) && o.sick && !has(o, 'haste')));
}
function availableMana(P) { return manaSources(P).reduce((a, o) => a + manaOf(o).n, 0) + (P.pool || []).length; }
function emptyPools() { if (G) G.players.forEach(P => { if (P.pool && P.pool.length) P.pool = []; }); }
// Which sources to tap for a cost: colored symbols first (scarcest color
// first, least flexible source first), then generic from what's left.
// Pays from the mana pool first, then lands and other sources; painlands
// cost life only when they make a colored mana; convoke lets creatures help.
// Mana limited to legendary spells or creature spells of the chosen type (Cavern of Souls): other spells get only the free colors
function limitOk(o, lim, opts) {
    const t = opts.forType || '';
    if (lim.test === 'legendary') return !!opts.spellKind && /\bLegendary\b/.test(t);
    const ok = /\bCreature\b/.test(t) && new RegExp(`\\b${chosenTypeOf(o)}\\b`).test(t);
    return ok && (opts.spellKind === 'creature' || (!opts.spellKind && lim.test === 'chosenOrAbil'));
}
function srcColors(o, opts = {}) { const m = manaOf(o); return m && m.limit && !limitOk(o, m.limit, opts) ? [...new Set([...m.limit.free, ...(m.limit.among ? amongColors(G.players[o.owner], m.limit.among) : [])])] : landColorsOf(o); }
function limitTag(o) { const l = manaOf(o).limit; return l.test === 'legendary' ? 'Legendary' : chosenTypeOf(o); }
function landColorsOf(o) {
    if (o.tempMana && G && o.tempMana.turn === G.turn) return ['G'];
    const aura = allPerms().find(a => a.attachedTo === o.uid && Rx(a).landBecomes);
    if (aura && Rx(aura).landBecomes === 'chosen') return [mirageColor(aura, o)];
    return aura ? [Rx(aura).landBecomes] : manaOf(o).colors;
}
function planPayment(P, cost, extra = 0, exclude = null, opts = {}) {
    const real = opts.poolOnly ? [] : manaSources(P).filter(o => o !== exclude);
    const srcs = [
        ...(P.pool || []).filter(c => !c.includes(':') || (opts.forType && new RegExp(`\\b${c.split(':')[1]}\\b`).test(opts.forType))).map(c => ({ o: { pool: true, color: c }, colors: [c[0]], n: 1, rank: -2 })),
        ...real.filter(o => (!manaOf(o).only || (opts.spellKind && manaOf(o).only.split(' or ').includes(opts.spellKind))) && (!manaOf(o).onlyType || (opts.forType && new RegExp(`\\b${manaOf(o).onlyType}\\b`).test(opts.forType)))).map(o => ({ o, colors: srcColors(o, opts), n: manaOf(o).n, pain: manaOf(o).pain, rank: 0 })).filter(s => s.colors.length),
        ...(opts.improvise && !opts.poolOnly ? P.bf.filter(a => /Artifact/.test(a.card.type) && !a.tapped && !real.includes(a)).map(a => ({ o: a, colors: [], n: 1, rank: 2 })) : []),
        ...(opts.convoke && !opts.poolOnly ? P.bf.filter(c => isCreature(c) && !c.tapped && !real.includes(c)).map(c => ({ o: c, colors: (c.card.colors || []).filter(x => COLORS.includes(x)), n: 1, rank: 2 })) : [])
    ];
    const need = [];
    ['W', 'U', 'B', 'R', 'G', 'C'].forEach(c => { for (let i = 0; i < cost[c]; i++) need.push(c); });
    need.sort((a, b) => srcs.filter(s => s.colors.includes(a)).length - srcs.filter(s => s.colors.includes(b)).length);
    const used = [];
    const painFor = (s, c) => (s.pain && s.pain.colors.includes(c) ? 1 : 0);
    const assign = k => {
        if (k === need.length) return true;
        const cands = srcs.filter(s => !used.includes(s) && s.colors.includes(need[k])).sort((a, b) => (a.rank - b.rank) || (painFor(a, need[k]) - painFor(b, need[k])) || (a.colors.length - b.colors.length));
        for (const s of cands) { used.push(s); s.payColor = need[k]; if (assign(k + 1)) return true; used.pop(); }
        return false;
    };
    if (!assign(0)) return null;
    let generic = cost.generic + extra;
    // Colored symbols paid by a source that makes 2+ mana leave the rest for generic
    used.forEach(s => { if (s.n > 1) generic -= (s.n - 1); });
    const rest = srcs.filter(s => !used.includes(s)).sort((a, b) => (a.rank - b.rank) || (b.n - a.n) || (a.colors.length - b.colors.length));
    const chosen = [...used];
    for (const s of rest) { if (generic <= 0) break; s.payColor = null; chosen.push(s); generic -= s.n; }
    if (generic > 0) return null;
    chosen.forEach(s => { if (!s.o.pool) s.o._payColor = s.payColor; });
    return chosen.map(s => s.o);
}
function extraCost(P, o) { return o.isCommander && P.command.includes(o) ? P.tax * 2 : 0; }
// X spells need X of at least 1; xVal is the X chosen for this cast
// Flashback (702.34): from the graveyard, for the flashback cost
// Gitrog deck: other ways to cast (o.castAs)
function lockerOk(P, o) { return P.lockerTurn === G.turn && P.gy.includes(o) && Rx(o).kind === 'creature' && P.gy.filter(x => x !== o).length >= (P.lockerN || 4); }
function energyAltN(P) { const a = P.bf.find(x => Rx(x).energyAlt && !lostAbilities(x)); return a ? Rx(a).energyAlt : 0; }
function energyAltOk(P, o) { const n = energyAltN(P); return !!n && (P.energy || 0) >= n && P.hand.includes(o) && !['instant', 'sorcery'].includes(Rx(o).kind) && !Rx(o).cost.x; }
function pitTop(P) { const top = P.library[P.library.length - 1]; return top && P.bf.some(x => Rx(x).castTopSac && !lostAbilities(x)) && Rx(top).kind !== 'land' && P.bf.some(x => !/\bLand\b/.test(x.card.type)) ? top : null; }
function castAsOk(P, o, mode) {
    const R = Rx(o);
    if (mode === 'warp') return !!R.warp && P.hand.includes(o);
    if (mode === 'bestow') return !!R.bestow && P.hand.includes(o);
    if (mode === 'blitz') return !!R.blitz && (P.hand.includes(o) || (R.blitzGy && P.gy.includes(o))) && P.life > R.blitz.life;
    if (mode === 'energy') return energyAltOk(P, o);
    if (mode === 'escape') return lockerOk(P, o);
    return false;
}
function costOf(P, o) {
    const R = Rx(o);
    if (o.castAs && castAsOk(P, o, o.castAs)) {
        o._delve = 0; o._free = o.castAs === 'energy';
        if (o.castAs === 'warp') return { ...R.warp };
        if (o.castAs === 'bestow') return { ...R.bestow };
        if (o.castAs === 'blitz') return { ...R.blitz.cost };
        if (o.castAs === 'energy') return parseCost('');
        if (o.castAs === 'escape') return { ...P.lockerCost };
    }
    if (o.overloaded && R.overload) { o._free = false; o._delve = 0; return { ...R.overload.cost }; }
    if (o.altCast && R.alt && P.hand.includes(o)) { o._free = false; o._delve = 0; return { ...R.alt.mana }; }
    if (o.foretoldTurn && R.foretell && P.exile.includes(o)) { o._free = false; o._delve = 0; return { ...R.foretell }; } // foretell (702.143)
    if (o.evoked && R.evoke && P.hand.includes(o)) { o._free = false; o._delve = 0; return { ...R.evoke }; }
    if (o.freeCast && P.exile.includes(o)) { o._free = true; return parseCost(''); }
    o._free = !!(R.freeIf && P.hand.includes(o) && condOk(R.freeIf, P, o));
    if (o._free) return parseCost('');
    const freerun = R.freerun && P.freerunTurn === G.turn && P.hand.includes(o) && costTotal(R.freerun) < costTotal(R.cost);
    const base = P.gy.includes(o) && R.flashback ? R.flashback : P.gy.includes(o) && R.mayhem ? R.mayhem : o.webSlinging && R.webSling ? R.webSling.cost : freerun ? R.freerun : R.cost;
    let cut = 0;
    if (R.affinity || P.nextAffinityTurn === G.turn) cut += P.bf.filter(x => /Artifact/.test(x.card.type)).length; // affinity for artifacts (702.41); Saheeli's +1
    if (R.costLess) cut += R.costLess.n * countFn(R.costLess.what)(o);
    if (R.costLessX === 'historic') cut += P.bf.filter(x => /\b(?:Artifact|Legendary|Saga)\b/.test(x.card.type)).reduce((a, x) => a + (x.card.cmc || 0), 0);
    else if (R.costLessX) { const ps = P.bf.filter(isCreature).map(x => Math.max(0, pow(x))); cut += R.costLessX === 'total power' ? ps.reduce((a, b) => a + b, 0) : Math.max(0, ...ps); }
    if (R.costLessIf && condOk(R.costLessIf.cond, P, o)) cut += R.costLessIf.n;
    if (R.costLessTgt && (o._tgt ? tgtFits(o._tgt, R.costLessTgt.what, P) : !o._noTgtYet && firstTargetEffect(o) && validTargets(P, firstTargetEffect(o), o).some(v => tgtFits(v, R.costLessTgt.what, P)))) cut += R.costLessTgt.n;
    P.bf.forEach(x => { const rd = Rx(x).reducer; if (rd && spellFits(o, rd, x)) cut += rd.n; });
    let generic = Math.max(0, base.generic - cut);
    if (/Artifact/.test(o.card.type)) { const hum = allPerms().filter(x => Rx(x).hum && !lostAbilities(x)).length; if (hum) generic += hum * P.bf.filter(x => /Artifact/.test(x.card.type)).length; } // Hum of the Radix
    if ((R.kind === 'creature' && P.bf.some(x => Rx(x).anyManaCreatures)) || (o.anyMana && P.exile.includes(o))) { const colored = ['W', 'U', 'B', 'R', 'G'].reduce((a, c) => a + (base[c] || 0), 0); return { ...base, W: 0, U: 0, B: 0, R: 0, G: 0, generic: generic + colored }; }
    o._delve = 0;
    if (R.kw.has('delve')) { o._delve = Math.min(P.gy.filter(x => x !== o).length, generic); generic -= o._delve; } // delve (702.66)
    return { ...base, generic };
}
// "costs {3} less if it targets a tapped creature" / "... a Spider" / "... an attacking creature"
function tgtFits(t, what, P) {
    const x = t && t.o;
    if (!x) return false;
    const w = what.replace(/^(?:a|an) /, '');
    if (w === 'tapped creature') return isCreature(x) && x.tapped;
    if (w === 'attacking creature') return G.attackers.includes(x.uid);
    if (w === 'attacking nontoken creature') return G.attackers.includes(x.uid) && !x.token;
    if (w === 'creature that was dealt damage this turn') return isCreature(x) && x.dmg > 0;
    let m;
    if ((m = w.match(/^([A-Z][a-z]+)( you control)?$/))) return hasType(x, m[1]) && (!m[2] || x.owner === P.i);
    return false;
}
// "Villain spells you cast cost {1} less", "Instant and sorcery spells ...", "Creature spells with power 4 or greater ..."
function spellFits(o, rd, from) {
    const k = Rx(o).kind, t = o.card.type;
    let m;
    if ((m = rd.what.match(/^color:([WUBRG]+)(:creature)?$/))) return (!m[2] || k === 'creature') && (o.card.colors || []).some(c => m[1].includes(c));
    if (rd.what === 'chosenType') return k === 'creature' && !!from && !!from.chosenType && hasType(o, from.chosenType);
    if (rd.what === 'chosenCardType') return !!from && !!from.chosenCardType && new RegExp(`\\b${from.chosenCardType}\\b`, 'i').test(o.card.type);
    if (rd.what === 'Instant and sorcery') return k === 'instant' || k === 'sorcery';
    if (rd.what === 'Creature') return k === 'creature' && (Number(o.card.power) || 0) >= rd.minPow;
    if (rd.what === 'Artifact' || rd.what === 'Enchantment') return new RegExp(rd.what).test(t);
    return new RegExp(`\\b${rd.what}\\b`).test(t);
}
const payOpts = o => ({ improvise: Rx(o).kw.has('improvise') || (!/Artifact/.test(o.card.type) && !!G && G.players[o.owner].bf.some(a => Rx(a).improviseAll)), convoke: Rx(o).kw.has('convoke'), spellKind: Rx(o).kind, forType: o.card.type });
function altExileCard(P, o) { const a = Rx(o).alt; return a && a.exile ? P.hand.filter(x => x !== o && (x.card.colors || []).includes(a.exile)).sort((x, y) => aiKeepValue(P, x) - aiKeepValue(P, y))[0] || null : null; }
function altOk(P, o) {
    const a = Rx(o).alt;
    return !!a && P.hand.includes(o) && (!a.cond || condOk(a.cond, P, o)) && (!a.life || P.life > a.life) && (!a.exile || !!altExileCard(P, o));
}
function canPay(P, o) { return (!o.altCast || altOk(P, o)) && addCostOk(P, o) && !!planPayment(P, costOf(P, o), extraCost(P, o) + (costOf(P, o).x ? xMult(o) : 0), null, payOpts(o)); }
function canKick(P, o) { const k = Rx(o).kicker; if (!k) return false; if (Rx(o).kickSac && P.bf.filter(x => /\bLand\b/.test(x.card.type)).length < Rx(o).kickSac.n + (P.isAI ? 2 : 0)) return false; const was = o.kicked; o.kicked = true; const ok = !!planPayment(P, totalCost(P, o), extraCost(P, o) + (costOf(P, o).x ? 1 : 0), null, { convoke: Rx(o).kw.has('convoke') }); o.kicked = was; return ok; }
// "As an additional cost to cast ~, sacrifice a creature / discard a card / pay N life"
function addCostOk(P, o) {
    const a = Rx(o).addCost;
    if (!a) return true;
    if (a.returnLand) return P.bf.some(x => /\bLand\b/.test(x.card.type));
    if (a.sac && a.orPay) return !!sacFodder(P, o, a.sac) || !!planPayment(P, a.orPay, costTotal(costOf(P, o)));
    if (a.sac && a.orDiscard) return !!sacFodder(P, o, a.sac) || P.hand.filter(x => x !== o).length >= 1;
    if (a.sac) return !!sacFodder(P, o, a.sac);
    if (a.discard && a.orLife) return P.hand.filter(x => x !== o).length >= 1 || P.life > a.orLife;
    if (a.discard) return P.hand.filter(x => x !== o).length >= 1;
    if (a.life) return P.life > a.life;
    return true;
}
// Yes/no and number questions asked while a spell or ability resolves, shown as
// an in-game choice (2026-10-06, owner's request; they were browser pop-ups).
// They wait for the answer, so the functions that ask are async. In a game on
// one device the table is handed to the player who has to answer first.
function choiceCardHTML(card) { return card && (card.imgS || card.img) ? `<img class="ask-card" src="${card.img || card.imgS}" alt="${esc(card.name)}">` : ''; }
function askYes(P, msg, opts = {}) {
    if (AUTOPLAY && !G?.hotseat) return Promise.resolve(opts.auto ?? true);
    if (G && G.hotseat && P && G.view !== P.i) return handTo(P).then(() => askYes(P, msg, opts));
    if (actBusy()) return actDrain().then(() => askYes(P, msg, opts));
    // "... (Cancel = it enters tapped.)" names the No answer
    const m = msg.match(/^(.*?)\s*\(Cancel = ([^)]+?)\.?\)\s*$/);
    const q = m ? m[1] : msg;
    const yes = opts.yes || 'Yes', no = opts.no || (m ? m[2].replace(/^./, c => c.toUpperCase()) : 'No');
    return new Promise(resolve => {
        window.__ask = v => { closeModal(); window.__ask = null; renderGame(); resolve(v); };
        showModal(`<div class="ask" role="dialog" aria-label="Choose">${choiceCardHTML(opts.card)}<div class="ask-body">
            ${G && G.hotseat && P ? `<div class="lane-label">${esc(P.name)} decides</div>` : ''}
            <h2>${esc(q)}</h2>
            <div class="ask-actions"><button class="btn primary" id="askYes" onclick="__ask(true)">${esc(yes)}</button><button class="btn" id="askNo" onclick="__ask(false)">${esc(no)}</button></div></div></div>`);
    });
}
// A number from min to max (null = cancelled)
function askNumber(P, msg, min, max, def, opts = {}) {
    if (AUTOPLAY && !G?.hotseat) return Promise.resolve(def);
    if (G && G.hotseat && P && G.view !== P.i) return handTo(P).then(() => askNumber(P, msg, min, max, def, opts));
    if (actBusy()) return actDrain().then(() => askNumber(P, msg, min, max, def, opts));
    let v = Math.max(min, Math.min(max, def ?? max));
    return new Promise(resolve => {
        const show = () => { $('askNum').textContent = v; $('askMinus').disabled = v <= min; $('askPlus').disabled = v >= max; };
        window.__askStep = d => { v = Math.max(min, Math.min(max, d === 'min' ? min : d === 'max' ? max : v + d)); show(); };
        window.__ask = ok => { closeModal(); window.__ask = null; renderGame(); resolve(ok ? v : null); };
        showModal(`<div class="ask" role="dialog" aria-label="Choose a number">${choiceCardHTML(opts.card)}<div class="ask-body">
            ${G && G.hotseat && P ? `<div class="lane-label">${esc(P.name)} decides</div>` : ''}
            <h2>${esc(msg)}</h2>
            <div class="ask-num"><button class="btn" onclick="__askStep('min')" aria-label="Fewest">${min}</button><button class="btn" id="askMinus" onclick="__askStep(-1)" aria-label="One less">−</button>
                <output id="askNum" aria-live="polite">${v}</output>
                <button class="btn" id="askPlus" onclick="__askStep(1)" aria-label="One more">+</button><button class="btn" onclick="__askStep('max')" aria-label="Most">${max}</button></div>
            <div class="ask-actions"><button class="btn primary" id="askYes" onclick="__ask(true)">✔ ${esc(opts.ok || 'Choose')}</button>${opts.noCancel ? '' : '<button class="btn" id="askNo" onclick="__ask(false)">Cancel</button>'}</div></div></div>`);
        show();
    });
}
async function payAddCost(P, o) {
    if (o.kicked && Rx(o).kickSac) { const ks = Rx(o).kickSac; const ls = await chooseSacN(P, P.bf.filter(x => /\bLand\b/.test(x.card.type)), ks.n, `${o.card.name} (entwine)`); ls.forEach(l => { fire('sacrificed', { o: l }); dieOrLeave(l, 'gy'); }); log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${ls.length} lands (entwine).`); }
    if (o.altCast && Rx(o).alt) {
        const al = Rx(o).alt, x = al.exile ? altExileCard(P, o) : null;
        if (al.life) P.life -= al.life;
        if (x) { pull(P.hand, x); P.exile.push(x); }
        log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${o.card.name} for its alternative cost${al.life ? `, paying ${al.life} life` : ''}${x ? ` and exiling ${x.card.name} from hand` : ''} (rule 118.9).`);
        o.altCast = false;
    }
    const a = Rx(o).addCost;
    if (!a) return;
    if (a.returnLand) { const l = P.bf.filter(x => /\bLand\b/.test(x.card.type)).sort((x, y) => (y.tapped - x.tapped))[0]; leaveBattlefield(l, 'hand'); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${l.card.name} to hand to cast ${o.card.name}.`); return; }
    if (a.sac && a.orPay) {
        const f = sacFodder(P, o, a.sac), plan = planPayment(P, a.orPay);
        const sac = f && (!plan || (P.isAI ? f.token || permValue(f) < 3 : await askYes(P, `${o.card.name}: sacrifice ${/^[aeiou]/.test(a.sac) ? 'an' : 'a'} ${a.sac}? (Cancel = pay the extra mana instead)`, { card: o.card, yes: 'Sacrifice', no: 'Pay the mana' })));
        if (!sac && plan) { plan.forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} the extra cost for ${o.card.name}.`); return; }
    }
    if (a.sac && a.orDiscard) {
        const f = sacFodder(P, o, a.sac), others = P.hand.filter(x => x !== o);
        const sac = f && (!others.length || (P.isAI ? f.token || permValue(f) < 2 : await askYes(P, `${o.card.name}: sacrifice ${/^[aeiou]/.test(a.sac) ? 'an' : 'a'} ${a.sac}? (Cancel = discard a card instead)`, { card: o.card, yes: 'Sacrifice', no: 'Discard a card' })));
        if (!sac) { const d = (P.isAI || AUTOPLAY ? null : await pickCard(P, others, `${o.card.name}: discard a card`)) || others.sort((x, y) => aiKeepValue(P, x) - aiKeepValue(P, y))[0]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} to cast ${o.card.name}.`); return; }
    }
    if (a.sac) { const f = await chooseSac(P, o, a.sac, o.card.name); G.lastSacMv = f.card.cmc || 0; G.lastSacPow = Math.max(0, pow(f)); G.lastSacTou = Math.max(0, tou(f)); G.lastSacLegend = /Legendary/.test(f.card.type); fire('sacrificed', { o: f }); log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name} to cast ${o.card.name}.`); dieOrLeave(f, 'gy'); }
    if (a.discard && a.orLife) {
        const others = P.hand.filter(x => x !== o);
        const life = !others.length || (P.life > a.orLife && (P.isAI ? P.life > 10 : !(await askYes(P, `${o.card.name}: discard a card? (Cancel = pay ${a.orLife} life instead)`, { card: o.card, yes: 'Discard a card', no: `Pay ${a.orLife} life` }))));
        if (life) { P.life -= a.orLife; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${a.orLife} life to cast ${o.card.name}.`); return; }
    }
    if (a.discard) { const d = P.hand.filter(x => x !== o).sort((x, y) => aiKeepValue(P, x) - aiKeepValue(P, y))[0]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} to cast ${o.card.name}.`); }
    if (a.life) { P.life -= a.life; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${a.life} life to cast ${o.card.name}.`); }
}
const xMult = o => Rx(o).cost.xn || 1;
function maxX(P, o) {
    let x = 0; while (x < 30 && planPayment(P, costOf(P, o), extraCost(P, o) + (x + 1) * xMult(o), null, { convoke: Rx(o).kw.has('convoke') })) x++;
    if (Rx(o).xBlackOnly) { const b = manaSources(P).filter(s => !s.tapped && manaOf(s) && manaOf(s).colors.includes('B')).reduce((a, s) => a + (manaOf(s).n || 1), 0) + (P.pool || []).filter(c => c[0] === 'B').length; x = Math.min(x, Math.max(0, b - (Rx(o).cost.B || 0))); } // Consume Spirit
    if (Rx(o).xFromTarget && o._tgt && o._tgt.o) x = Math.min(x, o._tgt.o.card.cmc || 0);
    return x;
}
function totalCost(P, o) {
    const c = { ...costOf(P, o) };
    if (o.kicked && Rx(o).kicker) Object.keys(Rx(o).kicker).forEach(k => { if (typeof c[k] === 'number') c[k] += Rx(o).kicker[k]; });
    return c;
}
function payFor(P, o) {
    const plan = planPayment(P, totalCost(P, o), extraCost(P, o) + (costOf(P, o).x ? (o.xVal || 0) * xMult(o) : 0), null, payOpts(o));
    if (!plan) return false;
    // Carnelian Orb: its mana gives a Dragon creature spell haste
    if (Rx(o).kind === 'creature' && /\bDragon\b/.test(o.card.type) && plan.some(x => !x.pool && Rx(x).mana && Rx(x).mana.hasteDragon)) o.hasteOnEnter = G.turn;
    o.convokedN = plan.filter(x => !x.pool && isCreature(x) && !manaOf(x)).length;
    // Cavern of Souls / Delighted Halfling: a spell paid with their limited mana can't be countered
    o.noCounter = plan.some(x => (!x.pool && manaOf(x) && manaOf(x).limit && manaOf(x).limit.uncounter && limitOk(x, manaOf(x).limit, payOpts(o)) && !manaOf(x).limit.free.includes(x._payColor)) || (x.pool && x.color.includes(':') && P.uncTags && P.uncTags.has(x.color.split(':')[1])));
    o.greenSpent = plan.filter(x => (x.pool ? x.color[0] === 'G' : (x._payColor === 'G' || (!x._payColor && manaOf(x) && manaOf(x).colors.includes('G'))))).length; // adamant
    plan.forEach(s => tapSource(P, s));
    if (o._delve) {
        const gone = P.gy.filter(x => x !== o).sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0)).slice(0, o._delve);
        gone.forEach(x => { pull(P.gy, x); P.exile.push(x); });
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${gone.length} card${gone.length === 1 ? '' : 's'} from the graveyard (delve).`);
    }
    return true;
}

// ---- Tapping your own mana (owner's request, 2026-10-06) ----
// Manual (the default): when you cast or activate, you tap the lands and
// other mana sources you want; their mana goes to your mana pool and pays
// the cost (rule 601.2g-h). "Auto-pay the rest" picks for you. Auto mode is
// the old behavior. Mana you tap outside a payment floats until the step ends.
let manaMode = store.get('manaMode', 'manual');
function setManaMode(v) { manaMode = v; store.set('manaMode', v); applyManaMode(); renderGame(); }
function applyManaMode() { document.querySelectorAll('.seg [data-mm]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mm === manaMode))); }
const manual = P => !P.isAI && !AUTOPLAY && manaMode === 'manual';
function poolCovers(P, cost, extra, opts) { return !!planPayment(P, cost, extra, null, { ...opts, poolOnly: true }); }
// What the pool still lacks: colored symbols first, then generic
function stillNeeded(P, cost, extra, opts = {}) {
    const pool = (P.pool || []).filter(c => !c.includes(':') || (opts.forType && new RegExp(`\\b(?:${c.split(':')[1]})\\b`).test(opts.forType))).map(c => c[0]);
    const out = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    ['W', 'U', 'B', 'R', 'G', 'C'].forEach(c => { for (let i = 0; i < (cost[c] || 0); i++) { const k = pool.indexOf(c); if (k >= 0) pool.splice(k, 1); else out[c]++; } });
    out.generic = Math.max(0, (cost.generic || 0) + (extra || 0) - pool.length);
    return out;
}
function costSymbols(c) {
    const s = (c.generic ? `{${c.generic}}` : '') + ['W', 'U', 'B', 'R', 'G', 'C'].map(k => `{${k}}`.repeat(c[k] || 0)).join('');
    return s || '{0}';
}
function pipsHTML(syms) { return syms.map(c => `<span class="pip ${c[0]}" title="${c[0]}"></span>`).join(''); }
// Can this source help with what's still needed?
function helpsPay(P, o) {
    const m = G.mode;
    if (!m || m.type !== 'pay' || o === m.exclude || !manaSources(P).includes(o)) return false;
    const need = stillNeeded(P, m.cost, m.extra, m.opts);
    return need.generic > 0 || landColorsOf(o).some(c => need[c] > 0);
}
// Tap one of your mana sources for one color (asks which, when it makes several)
function tapForMana(uid, color) {
    const P = me(), o = onBf(uid);
    closeSheet();
    if (!G || G.over || !o || o.owner !== G.view || !manaSources(P).includes(o)) return;
    const m = manaOf(o), cols = landColorsOf(o);
    if (!color && !m.fixed && cols.length > 1) { pickManaColor(o, cols); return; }
    const pick = color || cols[0];
    const added = m.extra ? [...Array(m.n - m.extra.length).fill(pick), ...m.extra] : m.fixed ? (cols.length === m.n ? cols.slice() : Array(m.n).fill(cols[0])) : Array(m.n).fill(pick);
    const lfree = m.limit ? srcColors(o, {}) : [];
    const tag = m.only ? `:${m.only.split(' or ').map(w => w[0].toUpperCase() + w.slice(1)).join('|')}` : m.onlyType ? `:${m.onlyType}` : m.limit && !lfree.includes(pick) ? `:${limitTag(o)}` : '';
    if (m.limit && m.limit.uncounter && tag) (P.uncTags = P.uncTags || new Set()).add(tag.slice(1));
    const lifeBefore = P.life;
    o._payColor = pick;
    tapSource(P, o);
    const pool = added.map(c => c + tag);
    P.pool = (P.pool || []).concat(pool);
    const pay = G.mode && G.mode.type === 'pay' ? G.mode : null;
    if (pay) pay.taps.push({ o, pool, life: lifeBefore - P.life, sac: !onBf(o.uid) });
    else log(`You tap ${o.card.name} for ${added.map(c => `{${c}}`).join('')} (it stays in your mana pool until the step ends).`);
    if (pay && poolCovers(P, pay.cost, pay.extra, pay.opts)) { pay.done(true); return; }
    renderGame();
}
function pickManaColor(o, cols) {
    const NAMES = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
    const pay = G.mode && G.mode.type === 'pay' ? G.mode : null;
    const need = pay ? stillNeeded(me(), pay.cost, pay.extra, pay.opts) : null;
    showModal(`<h2>Tap ${esc(o.card.name)} for…</h2><div class="row" style="justify-content:center; gap:8px; flex-wrap:wrap;">${cols.map(c => `<button class="btn${need && need[c] ? ' primary' : ''}" onclick="closeModal(); tapForMana(${o.uid}, '${c}')"><span class="pip ${c}"></span> ${NAMES[c]}</button>`).join('')}</div>
        ${need ? `<p class="note" style="text-align:center;">Still needed: ${esc(costSymbols(need))}</p>` : ''}<div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Cancel</button></div>`);
}
// Wait for the player to tap enough mana. Resolves true to go on (the
// pool then pays first), false if they cancel (their taps are undone).
function humanPay(P, cost, extra, opts, label) {
    if (!manual(P) || poolCovers(P, cost, extra, opts)) return Promise.resolve(true);
    if (!planPayment(P, cost, extra, opts.exclude || null, opts)) return Promise.resolve(true); // the payment step reports it
    const prev = G.mode;
    return new Promise(resolve => {
        G.mode = { type: 'pay', who: P.i, cost, extra: extra || 0, opts, label, exclude: opts.exclude || null, taps: [], done: ok => { if (G.mode && G.mode.type === 'pay') G.mode = prev; renderGame(); resolve(ok); } };
        renderGame();
    });
}
function autoPayRest() { const m = G.mode; if (m && m.type === 'pay') m.done(true); }
function cancelPay() {
    const m = G.mode, P = me();
    if (!m || m.type !== 'pay') return;
    m.taps.forEach(t => {
        if (t.sac) return; // a sacrificed source can't come back; its mana stays in your pool
        t.pool.forEach(c => { const i = P.pool.indexOf(c); if (i >= 0) P.pool.splice(i, 1); });
        if (onBf(t.o.uid)) t.o.tapped = false;
        P.life += t.life;
    });
    m.done(false);
}

// ---- Timing ----
const MAIN = ['main1', 'main2'];
function canCastNow(P, o) {
    const r = Rx(o);
    if (G.over || r.support === 'none' || r.kind === 'land') return false;
    if (gyTargetMissing(P, r.spell, o)) return false;
    if (r.castCond && !condOk(r.castCond, P, o)) return false; // "Cast this spell only ..." (Defiant Stand, Feast of Blood)
    if (preconCantCast(P)) return false; // Angelic Arbiter
    // Silence and friends; Grand Abolisher-style "your opponents can't cast spells during your turn"
    if (P.noMoreSpellsTurn === G.turn) return false; // Conduit of Worlds
    if (r.kind === 'creature' && P.bf.some(x => Rx(x).noCreatureSpells && !lostAbilities(x))) return false; // Grid Monitor
    if ((G.castBy || [0, 0])[P.i] >= 1 && allPerms().some(x => Rx(x).ruleOfLaw && !lostAbilities(x))) return false; // Rule of Law
    if (P.skip && P.skip.turn === G.turn && P.skip.what === 'main' && G.active === P.i && MAIN.includes(G.phase) && r.kind !== 'instant' && !r.flash) return false; // Fatespinner
    const emry = P.gy.includes(o) && o.gyCastTurn === G.turn;
    if (P.silenced && P.silenced.turn === G.turn && (!P.silenced.noncreature || r.kind !== 'creature')) return false;
    if (G.active !== P.i && G.players[G.active].bf.some(x => Rx(x).noCastOnMyTurn && !lostAbilities(x))) return false;
    if (!P.hand.includes(o) && opp(P).bf.some(x => Rx(x).handOnly && !lostAbilities(x))) return false;
    const flash = !!r.flash || P.flashTurn === G.turn || P.bf.some(x => !lostAbilities(x) && (Rx(x).flashAll || (Rx(x).flashTypes && Rx(x).flashTypes.some(ty => new RegExp(`\\b${ty}\\b`).test(o.card.type)))));
    const fromTop = (r.kind === 'creature' && P.library[P.library.length - 1] === o && P.bf.some(x => Rx(x).castTopCreatures)) || pitTop(P) === o;
    if (o.castAs && !castAsOk(P, o, o.castAs)) return false;
    const otherZone = (o.castAs === 'blitz' && P.gy.includes(o)) || o.castAs === 'escape' || (P.exile.includes(o) && o.warpedTurn && o.warpedTurn < G.turn);
    if (!fromTop && !emry && !otherZone && !P.hand.includes(o) && !P.command.includes(o) && !(P.gy.includes(o) && (r.flashback || mayhemOk(P, o) || gyCastOk(P, o) || (r.gyCast && P.life > r.gyCast.life && P.hand.length >= r.gyCast.discard))) && !(P.exile.includes(o) && (o.playUntil >= G.turn || (o.advReady && o.card === o.front) || (o.foretoldTurn && o.foretoldTurn < G.turn && r.foretell)))) return false;
    // While something is on the stack, only the player holding priority can
    // cast, and only instant-speed spells (CR 117.1a, 307.1).
    if (G.stack.length || G.priority !== null) return (r.kind === 'instant' || flash) && G.priority === P.i;
    if (r.kind === 'instant' || flash || (r.kind === 'sorcery' && P.bf.some(x => Rx(x).sorceryFlash && !lostAbilities(x)))) { // Hypersonic Dragon: sorceries as though they had flash
        if (G.active === P.i) return [...MAIN, 'afterBlocks'].includes(G.phase);
        return G.phase === 'declareBlocks';
    }
    return G.active === P.i && MAIN.includes(G.phase);
}
function landLimit(P) { if (P.skip && P.skip.turn === G.turn && P.skip.what === 'main') return 0; return 1 + P.bf.reduce((a, x) => a + (Rx(x).extraLand || 0), 0) + (P.extraLandTurn === G.turn ? P.extraLandN || 1 : 0); }
function canPlayLand(P, o) { return Rx(o).kind === 'land' && G.active === P.i && MAIN.includes(G.phase) && P.landsPlayed < landLimit(P) && (P.hand.includes(o) || (P.exile.includes(o) && o.playUntil >= G.turn) || extraLandZones(P).includes(o)) && !G.over; }
// Crucible of Worlds (lands from your graveyard), Courser-style (lands from the top of your library)
function extraLandZones(P) {
    const out = [];
    if (P.bf.some(x => Rx(x).landsFromGy && !lostAbilities(x))) out.push(...P.gy.filter(x => Rx(x).kind === 'land'));
    const top = P.library[P.library.length - 1];
    if (top && Rx(top).kind === 'land' && P.bf.some(x => Rx(x).landsFromTop && !lostAbilities(x))) out.push(top);
    return out;
}

// ---- Targets ----
const TARGETED = ['any', 'creature', 'player', 'spell', 'perm'];
function needsTarget(e) { return TARGETED.includes(e.target); }
function firstTargetEffect(o) {
    const r = Rx(o);
    if (r.isAura && r.auraTarget) return { t: 'aura', target: 'perm', filter: r.auraTarget, good: !r.buffBad, mine: false };
    if (r.isAura && r.auraLand) return { t: 'aura', target: 'perm', filter: 'land', good: !r.landBecomes && !r.trig.some(x => x.ev === 'tapped'), mine: false };
    if (r.isAura) return { t: 'aura', target: 'creature', good: !r.buffBad && (r.buff.p + r.buff.q) >= 0, mine: !!r.auraMine };
    if (o.castAs === 'bestow' && r.bestow) return { t: 'aura', target: 'creature', good: !r.buffLose };
    return spellEffects(o).find(needsTarget) || null;
}
// Protection (702.16): can't be targeted, blocked, damaged or enchanted by what it's protected from
function cmdrIdentity(P) { const c = [...P.command, ...allPerms()].find(x => x.isCommander && x.owner === P.i); return c ? (c.card.ci || c.card.colors || []) : []; }
function protFrom(o, src) {
    if (!o || !src || !src.card || !o.card) return false;
    if (Rx(o).mirrorPro && o.imprinted && !lostAbilities(o) && ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery', 'Battle'].some(k => new RegExp(`\\b${k}\\b`).test(o.imprinted.card.type) && new RegExp(`\\b${k}\\b`).test(src.card.type))) return true;
    const cols = src.card.colors || [];
    if ((Rx(o).proTypes || []).some(t => hasType(src, t)) && !lostAbilities(o)) return true;
    if (G && cols.length && allPerms().some(a => a.attachedTo === o.uid && Rx(a).plateProt) && cols.some(c => !cmdrIdentity(G.players[o.owner]).includes(c))) return true;
    return (has(o, 'pro:everything')) || cols.some(c => has(o, `pro:${c}`))
        || (has(o, 'pro:creatures') && /Creature/.test(src.card.type)) || (has(o, 'pro:artifacts') && /Artifact/.test(src.card.type));
}
function validTargets(P, e, src) {
    const out = [];
    const creatures = allPerms().filter(isCreature).filter(c => !has(c, 'shroud') && !(has(c, 'hexproof') && c.owner !== P.i) && !protFrom(c, src));
    if (e.target === 'any' || e.target === 'creature') out.push(...creatures.filter(o => (!e.mine || o.owner === P.i) && !(e.theirs && o.owner === P.i) && !(e.notSelf && o === src) && (!e.only || permMatches(o, e.only, P)) && (!e.powLtSrc || pow(o) < pow(src)) && (!e.withCounters || o.counters > 0)).map(o => ({ o })));
    if (e.target === 'any') out.push(...allPerms().filter(o => isPlaneswalker(o) && !has(o, 'shroud') && !(has(o, 'hexproof') && o.owner !== P.i) && !protFrom(o, src)).map(o => ({ o })));
    if (e.target === 'perm') out.push(...allPerms().filter(o => !(e.notSelf && o === src) && permMatches(o, e.filter, P) && !has(o, 'shroud') && !(has(o, 'hexproof') && o.owner !== P.i) && !protFrom(o, src)).map(o => ({ o })));
    if (e.target === 'any' || e.target === 'player') out.push(...G.players.filter(p => !(e.oppOnly && p === P) && !(p !== P && p.bf.some(a => Rx(a).playerHexproof && !lostAbilities(a)))).map(p => ({ p })));
    if (e.target === 'spell') out.push(...G.stack.filter(it => stackMatches(it, e.filter) && !(e.filter === 'notMine' && it.P === P)).map(item => ({ item })));
    return out;
}
function stackMatches(it, filter) {
    if (filter === 'artifactAbility') return it.kind === 'trigger' && !!it.ability && !!it.o && /Artifact/.test(it.o.card.type);
    if (filter === 'ability') return it.kind === 'trigger';
    if (filter === 'spellOrAbility') return it.kind === 'trigger' || it.kind === 'spell';
    if (/^small\d+$/.test(filter)) { const n = +filter.slice(5); return it.kind === 'spell' && Rx(it.o).kind === 'creature' && (Number(it.o.card.power) <= n || Number(it.o.card.toughness) <= n); }
    if (filter === 'instant') return it.kind === 'spell' && Rx(it.o).kind === 'instant';
    if (filter === 'sorcery') return it.kind === 'spell' && Rx(it.o).kind === 'sorcery';
    if (filter === 'creature or sorcery') return it.kind === 'spell' && (Rx(it.o).kind === 'creature' || Rx(it.o).kind === 'sorcery');
    if (filter === 'targetsCreature') return it.kind === 'spell' && !!it.target && !!it.target.o && isCreature(it.target.o);
    if (/^mv=\d+$/.test(filter)) return it.kind === 'spell' && (it.o.card.cmc || 0) === +filter.slice(3);
    if (filter === 'notMine') return it.kind === 'spell';
    if (filter === 'enchantment, instant, or sorcery') return it.kind === 'spell' && (/Enchantment/.test(it.o.card.type) || ['instant', 'sorcery'].includes(Rx(it.o).kind));
    if (COLOR_WORDS[filter]) return it.kind === 'spell' && (it.o.card.colors || []).includes(COLOR_WORDS[filter]);
    { const cm = filter.match(/^(white|blue|black|red|green) or (white|blue|black|red|green)$/); if (cm) return it.kind === 'spell' && [cm[1], cm[2]].some(c => (it.o.card.colors || []).includes(COLOR_WORDS[c])); } // Flashfreeze
    if (it.kind !== 'spell') return false;
    const k = Rx(it.o).kind;
    return filter === 'any' || (filter === 'creature' && k === 'creature') || (filter === 'noncreature' && k !== 'creature')
        || (filter === 'instant or sorcery' && (k === 'instant' || k === 'sorcery')) || (filter === 'artifact or enchantment' && (k === 'artifact' || k === 'enchantment'));
}
function sameTarget(a, b) {
    if (!a || !b) return false;
    if (a.item) return !!b.item && a.item.id === b.item.id;
    return a.o ? !!b.o && a.o.uid === b.o.uid : !!b.p && a.p.i === b.p.i;
}
// A target is still legal if it's still there (CR 608.2b): a permanent on
// the battlefield, a spell or ability on the stack, a player in the game.
function targetStillOk(t) { return t.p ? true : t.item ? G.stack.includes(t.item) : !!onBf(t.o.uid); }

function chooseTarget(P, e, source, cancelable, exclude = []) {
    const valid = validTargets(P, e, source).filter(v => !exclude.some(x => sameTarget(x, v)));
    if (!valid.length) return Promise.resolve(null);
    if (P.isAI) return Promise.resolve(aiPickTarget(P, e, source, valid) || (cancelable ? null : valid[0]));
    return new Promise(resolve => {
        G.mode = { type: 'target', who: P.i, e, source, valid, cancelable, resolve };
        renderGame();
    });
}
function pickTarget(t) {
    const m = G.mode;
    if (!m || m.type !== 'target') return;
    if (!m.valid.some(v => sameTarget(v, t))) { toast('That isn\'t a legal target.'); return; }
    G.mode = null;
    m.resolve(t);
}
function cancelTarget() {
    const m = G.mode;
    if (!m || m.type !== 'target' || !m.cancelable) return;
    G.mode = null;
    m.resolve(null);
    renderGame();
}

// ---- Casting and playing ----
// "You may have ~ enter as a copy of ..." (707.2, 707.9b-c: the exceptions are part of the copy)
function cloneMatches(x, what, P) {
    const art = /\bArtifact\b/.test(x.card.type), cre = isCreature(x);
    if (what === 'artifact or creature') return art || cre;
    if (what === 'artifact') return art;
    if (what === 'creature') return cre;
    if (what === 'land') return /\bLand\b/.test(x.card.type);
    if (what === 'creature you control') return cre && x.owner === P.i;
    if (what === 'creature or planeswalker you control') return (cre || isPlaneswalker(x)) && x.owner === P.i;
    return false;
}
async function enterAsCopy(P, o, cl) {
    const pool = allPerms().filter(x => x !== o && cloneMatches(x, cl.what, P));
    if (!pool.length) return;
    const best = pool.slice().sort((a, b) => permValue(b) - permValue(a))[0];
    const pick = P.isAI ? (best.owner !== P.i || !/\bLegendary\b/.test(best.card.type) || cl.notLegendary ? best : pool.find(x => x.owner !== P.i || !/\bLegendary\b/.test(x.card.type)) || null) : await pickCard(P, pool, `${o.card.name}: enter as a copy of ${/^[aeiou]/.test(cl.what) ? 'an' : 'a'} ${cl.what}, or skip`);
    if (!pick) return;
    let type = pick.card.type;
    if (cl.addType && !new RegExp(`\\b${cl.addType}\\b`).test(type)) type = type.replace(/^(Legendary )?/, `$1${cl.addType} `);
    if (cl.notLegendary) type = type.replace(/\bLegendary /, '');
    o.copyOf = o.card;
    o.card = { ...(pick.copyOf ? pick.card : pick.card), id: `${pick.card.id}-copy${uidSeq}`, type };
    if (cl.plusOne && isCreature(o)) o.counters += 1;
    if (Rx(o).kind === 'planeswalker') { o.ctr.loyalty = (Number(o.card.loyalty) || 0) + (cl.plusOne ? 1 : 0); o.pwReady = true; }
    log(`${o.copyOf.name} enters as a copy of ${pick.card.name}${cl.addType ? ` (also an ${cl.addType.toLowerCase()})` : ''}${cl.notLegendary ? ', not legendary' : ''}${cl.plusOne && isCreature(o) ? ', with an extra +1/+1 counter' : ''} (rule 707.9).`);
}
// "As ~ enters, choose a color": the color most of your cards are (Thriving lands: other than their own)
function pickChosenColor(P, not) {
    const cnt = {};
    [...P.bf, ...P.hand, ...P.library].forEach(x => (x.card.colors || []).forEach(c => { if (c !== not) cnt[c] = (cnt[c] || 0) + 1; }));
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || COLORS.find(c => c !== not);
}
async function playLand(P, o) {
    const fromExile = P.exile.includes(o);
    removeFromZones(o);
    if (fromExile && o.playDmg) { const n = o.playDmg; delete o.playDmg; G.players.forEach(X => damage(X, n, onBf(o.playDmgSrc) || o)); log(`${o.card.name} was played from exile: ${n} damage to each player.`); }
    P.landsPlayed++;
    resetObj(o);
    o.tapped = !!Rx(o).entersTapped;
    const rv = Rx(o).revealTypes;
    if (rv) { const show = P.hand.find(h => rv.some(t => new RegExp(`\\b${t}\\b`).test(h.card.type))); o.tapped = !show; if (show) log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${show.card.name}.`); }
    const sl = Rx(o).shockLife;
    if (sl) {
        let pay = false;
        if (P.life > sl) {
            if (P.isAI) { const lands = P.bf.filter(x => Rx(x).kind === 'land').length + 1; pay = P.life > sl + 4 && P.hand.some(h => Rx(h).kind !== 'land' && Rx(h).support !== 'none' && (h.card.cmc || 0) === lands); }
            else pay = await askYes(P, `${o.card.name}: pay ${sl} life so it enters untapped? (Cancel = it enters tapped.)`, { card: o.card });
        }
        if (pay) { P.life -= sl; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${sl} life for ${o.card.name}.`); } else o.tapped = true;
    }
    if (Rx(o).chooseColor) { o.chosenColor = pickChosenColor(P, Rx(o).chooseColorNot); log(`${o.card.name}: chosen color ${COLOR_NAMES[o.chosenColor]}.`); }
    if (o.tapped && landsUntappedFor(P)) o.tapped = false;
    const cl = Rx(o).clone;
    if (cl && cl.what === 'land') { const was = o.card.name; await enterAsCopy(P, o, cl); if (o.copyOf && cl.tapped) o.tapped = true; if (o.copyOf) log(`(${was} entered as ${o.card.name}.)`); }
    P.bf.push(o);
    log(`${P.name} ${you(P) ? 'play' : 'plays'} ${o.card.name}${o.tapped ? ' (tapped)' : ''}.`);
    fire('landfall', { o });
}

// ---- The stack (CR 405) ----
// Casting puts a spell on the stack (601.2); "when this enters" abilities
// trigger and go on the stack too (603.3), with their targets chosen then
// (603.3d). After something goes on the stack, the other player gets the
// chance to respond (117.3c-117.4, simplified: the player who acted passes).
// When both pass, the top item resolves (608.1); a spell or ability whose
// target is gone doesn't resolve (608.2b). Lands, combat damage and
// state-based actions don't use the stack (305.1, 510, 704.3).
let stackSeq = 1;

function webSlingFodder(P) { return P.bf.filter(x => isCreature(x) && x.tapped).sort((a, b) => (Rx(b).etb.length - Rx(a).etb.length) || (a.card.cmc - b.card.cmc))[0] || null; }
async function humanWebSling(uid) {
    const o = findObj(uid);
    if (!o || !Rx(o).webSling) return;
    if (!webSlingFodder(me())) { closeSheet(); toast('Web-slinging needs a tapped creature you control to return.'); return; }
    o.webSlinging = true;
    if (!canPay(me(), o)) { o.webSlinging = false; closeSheet(); toast('Not enough mana.'); return; }
    await humanCast(uid);
    if (me().hand.includes(o)) o.webSlinging = false;
}
async function castSpell(P, o, presetTarget) {
    o._tgt = presetTarget;
    if (o.teamworked) { const crew = teamworkCrew(P, o); if (crew) { crew.forEach(c => { c.tapped = true; }); log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${crew.map(c => c.card.name).join(', ')} for teamwork.`); } else o.teamworked = false; }
    o.castFromHand = P.hand.includes(o) ? G.turn : 0;
    const fromCommand = P.command.includes(o);
    const fromExile = P.exile.includes(o);
    const gyCast = P.gy.includes(o) && !!Rx(o).gyCast && !Rx(o).flashback;
    const flashback = P.gy.includes(o) && !gyCast && !(Rx(o).gyCastIf && !Rx(o).flashback);
    if (o.webSlinging && !webSlingFodder(P)) o.webSlinging = false;
    const castAs = o.castAs && castAsOk(P, o, o.castAs) ? o.castAs : null;
    const pitCast = P.library.includes(o) && pitTop(P) === o && !(Rx(o).kind === 'creature' && P.bf.some(x => Rx(x).castTopCreatures));
    if (!payFor(P, o)) { o._tgt = null; return false; }
    o.castAs = null;
    if (o._tgt && o._tgt.o) fire('targeted', { o: o._tgt.o, by: P.i });
    if (castAs === 'blitz' && Rx(o).blitz.life) { P.life -= Rx(o).blitz.life; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${Rx(o).blitz.life} life (blitz).`); }
    if (castAs === 'energy') { P.energy -= energyAltN(P); log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${energyAltN(P)} energy instead of the mana cost.`); }
    if (castAs === 'escape') { const gone = P.gy.filter(x => x !== o).sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b)).slice(0, P.lockerN || 4); gone.forEach(x => { pull(P.gy, x); P.exile.push(x); }); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${gone.length} other cards from the graveyard (escape).`); }
    if (pitCast) {
        const pool = P.bf.filter(x => !/\bLand\b/.test(x.card.type));
        const f = (P.isAI ? null : await pickCard(P, pool, `${o.card.name}: sacrifice a nonland permanent (Into the Pit)`)) || pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0];
        if (f) { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name} to cast ${o.card.name} from the top of the library.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); }
    }
    { const tt = o._tgt && o._tgt.o && o._tgt.o.owner !== P.i ? Rx(o._tgt.o).targetTaxLife : 0; if (tt) { P.life -= tt; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${tt} life to target ${o._tgt.o.card.name}.`); } }
    o._tgt = null;
    if (o.webSlinging) { const f = webSlingFodder(P); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${f.card.name} to hand (web-slinging).`); leaveBattlefield(f, 'hand'); o.webSlinging = false; }
    await payAddCost(P, o);
    if (gyCast) {
        const gc = Rx(o).gyCast;
        P.life -= gc.life;
        const d = P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0];
        if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); }
        log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${gc.life} life${d ? ` and ${you(P) ? 'discard' : 'discards'} ${d.card.name}` : ''} to cast ${o.card.name} from the graveyard.`);
        if (gc.exile) o.exileAfter = true; // jump-start
    }
    if (fromExile && o.playDmg) { const n = o.playDmg; delete o.playDmg; G.players.forEach(X => damage(X, n, onBf(o.playDmgSrc) || o)); log(`${o.card.name} was played from exile: ${n} damage to each player.`); }
    o.flashedBack = flashback;
    o.castFromExile = fromExile;
    if (P.nextAffinityTurn === G.turn) P.nextAffinityTurn = 0;
    if (o.gyCastTurn === G.turn) o.gyCastTurn = 0;
    if (fromExile) o.warpedTurn = 0;
    o.castPow = Math.max(0, ...P.bf.filter(isCreature).map(pow)); // "greatest power among creatures you controlled as you cast ~"
    if (Rx(o).kind === 'creature' && P.nextCreatureCounter === G.turn) { o.extraEnterCounter = 1; P.nextCreatureCounter = 0; } // Summon: Fenrir II
    removeFromZones(o);
    if (fromCommand) P.tax++;
    const item = { id: stackSeq++, kind: 'spell', o, P, target: presetTarget, name: o.card.name, x: Rx(o).cost.x || (castAs === 'warp' && Rx(o).warp.x) || (castAs === 'bestow' && Rx(o).bestow.x) ? (o.xVal || 0) : undefined, kicked: !!o.kicked, castAs };
    if (castAs) log(`(${o.card.name} is cast with ${castAs === 'energy' ? 'energy' : castAs}.)`);
    G.stack.push(item);
    log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${o.card.name}${item.kicked ? ' (kicked)' : ''}${o._free ? ' without paying its mana cost' : ''}${item.x !== undefined ? ` (X=${item.x})` : ''}${presetTarget ? ` targeting ${targetName(presetTarget)}` : ''}${fromCommand && P.tax > 1 ? ` (commander tax ${(P.tax - 1) * 2})` : ''}.`);
    if (!wardCheck(P, presetTarget, o.card.name)) { pull(G.stack, item); moveSpellCard(o, 'gy'); renderGame(); return true; }
    (G.castNames = (G.castNames || []).filter(c => c.turn === G.turn)).push({ turn: G.turn, p: P.i, name: o.card.name }); // Grim Reminder
    // Chalice of the Void: counter a spell with mana value equal to its charge counters
    allPerms().filter(x => Rx(x).chalice && !lostAbilities(x) && (x.ctr.charge || 0) === (o.card.cmc || 0)).forEach(x => { G.stack.push({ id: stackSeq++, kind: 'trigger', o: x, P: G.players[x.owner], target: { item }, effects: [{ t: 'counter', target: 'spell', filter: 'any' }], name: `${x.card.name}'s ability` }); log(`${x.card.name} triggers (mana value ${o.card.cmc || 0}).`); });
    G.castThisTurn = (G.castThisTurn || 0) + 1;
    (G.castBy = G.castBy || [0, 0])[P.i]++;
    // "When you cast ~" triggers go on the stack above the spell (Hydroid Krasis)
    if (Rx(o).castTrig) G.stack.push({ id: stackSeq++, kind: 'trigger', o, P, target: null, effects: withX(Rx(o).castTrig, item.x), name: `${o.card.name}'s cast trigger` });
    fire('cast', { P, o });
    // Storm (702.40): a copy for each spell cast before it this turn
    if (Rx(o).kw.has('storm') && G.castThisTurn > 1) {
        const n = G.castThisTurn - 1;
        for (let k = 0; k < n; k++) G.stack.push({ id: stackSeq++, kind: 'trigger', o, P, target: null, effects: withX(spellEffects(o), item.x), name: `${o.card.name} (storm copy)`, copy: true });
        log(`Storm: ${n} cop${n === 1 ? 'y' : 'ies'} of ${o.card.name}.`);
    }
    // Cascade (702.85): exile until a cheaper nonland card, cast it free
    if (Rx(o).kw.has('cascade')) await cascade(P, o);
    // Demonstrate (702.144): you may copy it; then an opponent copies it too
    if (Rx(o).demonstrate) {
        const Q = opp(P), best = X => Math.max(0, ...X.gy.map(x => x.card.cmc || 0));
        const yes = P.isAI ? best(P) >= best(Q) : await askYes(P, `Demonstrate: copy ${o.card.name}? (If you do, ${Q.name} copies it too.)`, { card: o.card, yes: 'Copy it', no: 'No copy' });
        if (yes) {
            const fx = spellEffects(o).filter(e => e.t !== 'exileSelf');
            G.stack.push({ id: stackSeq++, kind: 'trigger', o, P, target: null, effects: fx, name: `Copy of ${o.card.name}`, copy: true });
            G.stack.push({ id: stackSeq++, kind: 'trigger', o, P: Q, target: null, effects: fx, name: `${Q.name}'s copy of ${o.card.name}`, copy: true });
            log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${o.card.name}, and ${Q.name} ${you(Q) ? 'copy' : 'copies'} it too (demonstrate).`);
        }
    }
    renderGame();
    await settle();
    return true;
}

// Triggered "when this enters" abilities go on the stack (603.3). Targets
// are chosen now; with no legal target the ability is removed (603.3d).
async function putTriggers(P, source, effects, ctxObj, ctxCount, raw) {
    const te = effects.find(e => needsTarget(e) && !e.late);
    let target = null;
    if (te && te.ctx) { if (!ctxObj || !onBf(ctxObj.uid)) { log(`${source.card.name}'s ability has nothing to affect.`); return; } target = { o: ctxObj }; }
    else if (te) {
        target = await chooseTarget(P, te, source, false);
        if (!target) { log(`${source.card.name}'s ability has no legal target and is removed from the stack (rule 603.3d).`); return; }
    }
    G.stack.push({ id: stackSeq++, kind: 'trigger', o: source, P, target, effects, name: `${source.card.name}'s ability`, ctxObj, ctxCount, raw });
    if (target && target.o && !(te && te.ctx)) fire('targeted', { o: target.o, by: P.i }); // Magic 2010: Illusionary Servant, Ice Cage
    log(`${source.card.name}'s ability triggers${target ? ` ${te && te.ctx ? 'for' : 'targeting'} ${targetName(target)}` : ''}.`);
    renderGame();
}

// Resolve the stack until it's empty, offering responses each time.
async function runStack() {
    if (G.stackRunning) return; // an outer loop is already working through it
    G.stackRunning = true;
    try {
        // Comprehensive Rules 117.3b-c and 117.4: whoever casts a spell gets
        // priority next, and the top of the stack resolves only once both
        // players pass in a row; after it resolves, the active player gets
        // priority first. Like Arena, a player auto-passes on their own spell
        // or ability, so in practice the other player is asked.
        let holder = null, passes = 0, offers = 0;
        while (G.stack.length && !G.over) {
            const top = G.stack[G.stack.length - 1];
            if (holder === null) { holder = top.P; passes = 0; } // 117.3c: the caster first
            // A loop guard: after 200 responses in one go, everyone passes
            if (++offers === 200) log('That\'s a lot of responses - the stack now resolves without more.');
            if (offers < 200 && await offerPriority(holder, top)) { holder = null; continue; } // they responded: the new top goes first
            if (++passes < 2) { holder = opp(holder); continue; }
            await resolveTop();
            await flushTriggers();
            await pause(300);
            holder = G.players[G.active]; passes = 0; // 117.3b
        }
    } finally {
        G.stackRunning = false;
        G.priority = null;
        renderGame();
    }
}

// Give a player priority to respond to the top of the stack. Returns true
// if they cast something.
async function offerPriority(P, top) {
    if (top.P === P) return false; // auto-pass on your own spell or ability
    if (G.stack.some(it => it.kind === 'spell' && Rx(it.o).splitSecond)) return false; // split second (702.61)
    const castable = [...P.hand, ...P.command].filter(o => { G.priority = P.i; const ok = canCastNow(P, o) && canPay(P, o); return ok; });
    if (!castable.length) { G.priority = null; return false; } // nothing they could do: pass automatically
    G.priority = P.i;
    if (P.isAI) {
        const r = aiRespond(P, top);
        if (!r) { G.priority = null; return false; }
        await pause(400);
        G.priority = null;
        await castSpellAsResponse(P, r.o, r.target);
        return true;
    }
    const prevMode = G.mode && G.mode.type !== 'respond' ? G.mode : null;
    const prevBusy = G.busy;
    await actDrain();
    G.busy = false;
    const acted = await new Promise(resolve => { G.mode = { type: 'respond', who: P.i, item: top, resolve }; renderGame(); });
    G.mode = prevMode;
    G.busy = prevBusy;
    G.priority = null;
    return acted;
}
async function castSpellAsResponse(P, o, target) {
    G.priority = P.i;
    const ok = canCastNow(P, o) && canPay(P, o);
    G.priority = null;
    if (ok) await castSpell(P, o, target);
}
function passPriority() {
    const m = G.mode;
    if (m && m.type === 'respond') m.resolve(false);
}

async function resolveTop() {
    const item = G.stack.pop();
    if (!item) return;
    renderGame();
    if (item.target && !targetStillOk(item.target) && item.castAs === 'bestow') { item.target = null; log(`${item.name}'s creature is gone - it enters as a creature (rule 702.103e).`); }
    if (item.target && !targetStillOk(item.target)) {
        log(`${item.name} doesn't resolve - its target is gone (rule 608.2b).`);
        if (item.kind === 'spell') moveSpellCard(item.o, 'gy');
        return;
    }
    if (item.kind === 'trigger') {
        G.ctxObj = item.ctxObj || null; G.ctxCount = item.ctxCount || 0; G.ctxRaw = item.raw || null;
        { G.resMap = G.resMap || new Map(); const per = G.resMap.get(item.effects) || {}; G.resMap.set(item.effects, per); const k = item.o ? item.o.uid : 0; per[k] = per[k] && per[k].turn === G.turn ? { turn: G.turn, n: per[k].n + 1 } : { turn: G.turn, n: 1 }; G.resolveN = per[k].n; }
        await resolveEffects(item.P, item.effects, item.target, item.o);
        G.ctxObj = null;
    } else {
        const o = item.o, r = Rx(o);
        G.curX = item.x || 0;
        if (r.kind === 'instant' || r.kind === 'sorcery') {
            await resolveEffects(item.P, withX(spellEffects(o), item.x), item.target, o);
            // An adventure goes on an adventure: exile, and the creature can be cast from there (715.4)
            if (o.front && o.front.layout === 'adventure' && o.card !== o.front && !o.flashedBack) {
                o.card = o.front; resetObj(o); o.advReady = true; G.players[o.owner].exile.push(o);
                log(`${o.card.name} goes on an adventure (exiled; you can cast the creature later).`);
            } else if (r.cipher && item.P.bf.some(isCreature) && !o.flashedBack) {
                // Cipher (702.99): exile it encoded on a creature you control
                const host = item.P.isAI ? item.P.bf.filter(isCreature).sort((a, b) => (has(b, 'flying') || has(b, 'unblockable') ? 5 : 0) + pow(b) - ((has(a, 'flying') || has(a, 'unblockable') ? 5 : 0) + pow(a)))[0]
                    : await pickCard(item.P, item.P.bf.filter(isCreature), `${o.card.name}: encode it on a creature (cipher), or skip`);
                if (host) { host.ciphered = [...(host.ciphered || []), o.front || o.card]; o.card = o.front || o.card; resetObj(o); item.P.exile.push(o); log(`${o.card.name} is encoded on ${host.card.name} (cipher).`); }
                else moveSpellCard(o, 'gy');
            } else moveSpellCard(o, 'gy');
        } else {
            const mode = o.mode, face = o.card, evoked = o.evoked;
            delete o.evoked;
            resetObj(o);
            o.card = face;
            o.advReady = false;
            o.kicked = item.kicked;
            item.P.bf.push(o);
            if (r.isAura && item.target && item.target.o) o.attachedTo = item.target.o.uid;
            if (r.auraSteal && item.target && item.target.o && item.target.o.owner !== item.P.i) { const x = item.target.o; pull(G.players[x.owner].bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = item.P.i; x.stolenBy = o.uid; x.sick = true; item.P.bf.push(x); log(`${item.P.name} ${you(item.P) ? 'gain' : 'gains'} control of ${x.card.name} (${o.card.name}).`); }
            if (item.castAs === 'bestow' && item.target && item.target.o) { o.bestowed = true; o.attachedTo = item.target.o.uid; log(`${o.card.name} enters as an Aura on ${item.target.o.card.name} (bestow).`); }
            if (item.castAs === 'warp') o.warpExile = G.turn;
            if (item.castAs === 'blitz') { o.blitzed = true; o.tkw.push('haste'); o.sacAtEnd = G.turn; }
            if (r.kind === 'battle') { const d = Number(o.card.defense); o.ctr.defense = d >= 0 && !isNaN(d) ? d : 4; }
            if (r.alsoLand && !/\bLand\b/.test(o.card.type)) o.card = { ...o.card, type: `Land ${o.card.type}` };
            { const et = opp(item.P).bf.find(x => Rx(x).oppEnterTapped && !lostAbilities(x)); if (et && (r.kind === 'creature' || (Rx(et).oppEnterTapped !== 'creature' && /Artifact/.test(o.card.type)))) { o.tapped = true; log(`${o.card.name} enters tapped (${et.card.name}).`); } }
            if (r.etbCounters) o.counters += r.etbCounters === 'X' ? (item.x || 0) : r.etbCounters === 'spent' ? costTotal(r.cost) + (item.x || 0) * (r.cost.xn || 1) : r.etbCounters;
            if (r.etbNamedX) o.ctr[r.etbNamedX] = item.x || 0;
            // Ravenous: X +1/+1 counters, and a card if X is 5 or more
            if (r.ravenous && (item.x || 0) >= 5) (G.trigQ = G.trigQ || []).push({ P: item.P, o, effects: [{ t: 'draw', n: 1 }] });
            if (r.kickCounters && o.kicked) o.counters += r.kickCounters;
            if (r.convokeCounters && o.convokedN) o.counters += r.convokeCounters * o.convokedN;
            if (r.etbCountersIf && condOk(r.etbCountersIf.cond, item.P, o)) o.counters += r.etbCountersIf.n;
            if (r.etbCountersPer) o.counters += countFn(r.etbCountersPer)(o);
            if (o.extraEnterCounter) { o.counters += o.extraEnterCounter; o.extraEnterCounter = 0; }
            // Mockingbird: enter as a copy of a creature with mana value up to the mana spent (X + 1), a Bird with flying
            if (r.cloneX) {
                const spent = (item.x || 0) + costTotal({ ...r.cost, x: 0 });
                const pool = allPerms().filter(x => isCreature(x) && (x.card.cmc || 0) <= spent && !x.token);
                const pick = pool.length ? (item.P.isAI ? pool.sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(item.P, pool, `${o.card.name}: enter as a copy of a creature (mana value ${spent} or less), or skip`)) : null;
                if (pick) { o.copyOf = o.card; o.card = { ...pick.card, id: `${pick.card.id}-copy${uidSeq}`, type: /\bBird\b/.test(pick.card.type) ? pick.card.type : `${pick.card.type} Bird`, text: `Flying\n${pick.card.text || ''}` }; log(`${o.copyOf.name} enters as a copy of ${pick.card.name} (a Bird with flying).`); }
            }
            if (r.clone) await enterAsCopy(item.P, o, r.clone);
            if (r.saga) { o.ctr.lore = 1; sagaChapter(item.P, o); }
            if (r.chooseType) { o.chosenType = commonType(item.P); log(`${o.card.name}: chosen creature type ${o.chosenType}.`); }
            if (r.needle) await needleName(item.P, o);
            if (r.chooseCardType) { o.chosenCardType = commonCardType(item.P); log(`${o.card.name}: chosen card type ${o.chosenCardType}.`); }
            o.enteredTurn = G.turn;
            if (o.hasteOnEnter === G.turn) { o.tkw.push('haste'); log(`${o.card.name} gains haste (Dragon mana).`); }
            if (r.chooseColor) { o.chosenColor = pickChosenColor(item.P, r.chooseColorNot); log(`${o.card.name}: chosen color ${COLOR_NAMES[o.chosenColor]}.`); }
            if (r.etbNamedN) { o.ctr[r.etbNamedN.kind] = r.etbNamedN.n; log(`${o.card.name} enters with ${r.etbNamedN.n} ${r.etbNamedN.kind} counters.`); }
            if (r.etbNamed) { const n = countFn(r.etbNamed.what)(o); o.ctr[r.etbNamed.kind] = n; log(`${o.card.name} enters with ${n} ${r.etbNamed.kind} counter${n === 1 ? '' : 's'}.`); }
            if (r.kw.has('unleash') && (item.P.isAI ? item.P.aiStyle !== 'control' : await askYes(item.P, `Unleash ${o.card.name}? It enters with a +1/+1 counter but can't block while it has one.`, { card: o.card }))) { o.counters += 1; log(`${o.card.name} is unleashed (+1/+1 counter; it can't block).`); }
            // Riot (702.136): a +1/+1 counter or haste
            if (isCreature(o) && (Rx(o).kw.has('riot') || (!o.token && item.P.bf.some(x => x !== o && Rx(x).riotAll && !lostAbilities(x))))) {
                const haste = item.P.isAI ? (MAIN.includes(G.phase) && G.active === item.P.i && G.phase !== 'main2') : await askYes(item.P, `${o.card.name} has riot: give it haste? (Cancel = a +1/+1 counter instead)`, { card: o.card, yes: 'Haste', no: '+1/+1 counter' });
                if (haste) { o.tkw.push('haste'); o.riotHaste = true; log(`${o.card.name} gains haste (riot).`); } else { putCounters(o, 1); log(`${o.card.name} enters with a +1/+1 counter (riot).`); }
            }
            if (Rx(o).kind === 'planeswalker' && !o.ctr.loyalty) { o.ctr.loyalty = Number(o.card.loyalty) || 0; o.pwReady = true; }
            log(`${o.card.name} enters the battlefield${o.counters > 0 ? ` with ${o.counters} +1/+1 counter${o.counters === 1 ? '' : 's'}` : ''}.`);
            fire('enters', { o });
            if (r.offspring && o.kicked) (G.trigQ = G.trigQ || []).push({ P: item.P, o, effects: [{ t: 'offspringCopy' }] });
            if (evoked) { log(`${o.card.name} was evoked - it will be sacrificed (rule 702.74).`); G.stack.push({ id: stackSeq++, kind: 'trigger', o, P: item.P, target: null, effects: [{ t: 'sacSelf' }], name: `${o.card.name}'s evoke` }); }
            if (r.echo) o.echoDue = true;
            if (Rx(o).etb.length) await putTriggers(item.P, o, withX(Rx(o).etb, item.x));
            if (r.etbModes) { const i = await pickModes(item.P, r, r.etbModes, o); if (i !== null) await putTriggers(item.P, o, [].concat(i).flatMap(k => r.etbModes[k])); }
            o.mode = mode;
        }
    }
    sba();
    renderGame();
}

// A spell card leaving the stack: to its owner's graveyard, or a commander
// to the command zone (903.9a).
// A card put onto the battlefield by an effect (not cast): "enters" abilities still trigger
function putOntoBattlefield(P, o, tapped) {
    removeFromZones(o);
    resetObj(o);
    o.owner = P.i;
    o.tapped = !!tapped;
    o.enteredTurn = G.turn;
    P.bf.push(o);
    log(`${o.card.name} enters the battlefield${tapped ? ' tapped' : ''}.`);
    if (Rx(o).kind === 'land') { fire('landfall', { o }); return; }
    if (Rx(o).kind === 'planeswalker') { o.ctr.loyalty = Number(o.card.loyalty) || 0; o.pwReady = true; }
    if (isBattle(o)) { const d = Number(o.card.defense); o.ctr.defense = d >= 0 && !isNaN(d) ? d : 4; }
    if (Rx(o).chooseType) o.chosenType = commonType(P);
    if (Rx(o).chooseCardType) o.chosenCardType = commonCardType(P);
    if (Rx(o).etbNamedN) o.ctr[Rx(o).etbNamedN.kind] = Rx(o).etbNamedN.n;
    if (Rx(o).needle) needleName(P, o);
    fire('enters', { o });
    if (Rx(o).etb.length) (G.trigQ = G.trigQ || []).push({ P, o, effects: Rx(o).etb });
}
function moveSpellCard(o, zone) {
    if (o.realOwner !== undefined) { o.owner = o.realOwner; delete o.realOwner; }
    const owner = G.players[o.owner];
    if (o.exileAfter) { o.exileAfter = false; zone = 'exile'; }
    if (o.shuffleIn) { o.shuffleIn = false; resetObj(o); if (o.front) o.card = o.front; owner.library.splice(rand(owner.library.length + 1), 0, o); log(`${o.card.name} is shuffled into its owner's library.`); return; }
    if (o.flashedBack) { o.flashedBack = false; zone = 'exile'; log(`${o.card.name} is exiled (flashback).`); }
    // Rebound (702.88): cast from your hand, it's exiled and you may cast it again at your next upkeep
    if (zone === 'gy' && Rx(o).rebound && o.castFromHand === G.turn && !o.isCommander) { zone = 'exile'; (G.delayed = G.delayed || []).push({ at: 'upkeep', own: true, P: owner, after: G.turn, effects: [{ t: 'reboundCast', uid: o.uid }], src: o, label: `${o.card.name}: rebound` }); log(`${o.card.name} is exiled (rebound).`); }
    o.overloaded = false;
    if (o.front) o.card = o.front;
    resetObj(o);
    if (o.isCommander) { owner.command.push(o); log(`${o.card.name} returns to the command zone.`); }
    else owner[zone].push(o);
}

function targetName(t) { return t.p ? (you(t.p) ? 'you' : t.p.name) : t.item ? t.item.name : t.o.card.name; }

// Numbers that are worked out when the effect resolves ("equal to the number of creatures you control")
function dynN(P, e, source) {
    const base = source && source.owner === P.i && onBf(source.uid) ? source : { owner: P.i };
    if (e.nCount) return (e.per || 1) * countFn(e.nCount)(base);
    switch (e.nFrom) {
        case 'sacPow': return G.lastSacPow || 0;
        case 'oppHand': return opp(P).hand.length;
        case 'lastCardPow': return G.lastCardPow || 0;
        case 'lastPT': { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; return x ? Math.max(0, pow(x)) + Math.max(0, tou(x)) : 0; }
        case 'attackers': return G.attackers.length;
        case 'discardedTurn': return P.discardTurn === G.turn ? P.discardN || 0 : 0;
        case 'greatestPower': return Math.max(0, ...P.bf.filter(isCreature).map(pow));
        case 'greatestPowerNonHuman': return Math.max(0, ...P.bf.filter(x => isCreature(x) && !hasType(x, 'Human')).map(pow));
        case 'lastTou': { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; return x && !onBf(x.uid) ? Math.max(0, Number(x.card.toughness) || 0) : 0; }
        case 'lastRoll': return G.lastRoll || 0;
        case 'ctxCount': return G.ctxCount || 0;
        case 'sacTou': return G.lastSacTou || 0;
        case 'castPow': return Math.max(0, (source && source.castPow) || 0);
        case 'castPow2': return 2 * Math.max(0, (source && source.castPow) || 0);
        case 'lastCardMv': return G.lastCardMv || 0;
        case 'ctxPow': { const x = G.ctxObj; return x ? Math.max(0, onBf(x.uid) ? pow(x) : (x.lastPow || Number(x.card.power) || 0)) : 0; }
        case 'srcLastCounters': return (source && (onBf(source.uid) ? Math.max(0, source.counters) : source.lastCounters)) || 0;
        case 'srcLastPow': return Math.max(0, (source && (onBf(source.uid) ? pow(source) : source.lastPow)) || 0);
        case 'srcPow': return Math.max(0, source && onBf(source.uid) ? pow(source) : 0);
        case 'armyPow': return G.lastArmyPow || 0;
        case 'handPlusOne': return P.hand.length + 1;
        case 'commonTypeCount': { const ty = commonType(P); return P.bf.filter(x => hasType(x, ty)).length; }
        case 'countersCreatures': return P.bf.filter(x => isCreature(x) && x.counters > 0).length;
        case 'creaturesAll': return allPerms().filter(isCreature).length;
        case 'lastWipeN': return G.lastWipeN || 0;
        case 'greatestTouOther': return Math.max(0, ...P.bf.filter(x => isCreature(x) && x !== source).map(tou));
        case 'lastMv': return G.lastMv || 0;
        case 'lastEdictN': return G.lastEdictN || 0;
        case 'lastLost': return G.lastLost || 0;
        case 'myCasts': return (G.castBy || [0, 0])[P.i];
        case 'sacMv': return G.lastSacMv || 0;
        case 'lastCastMv': return (G.lastCast && G.lastCast.card.cmc) || 0;
        case 'bigAttackers': return G.attackers.map(onBf).filter(x => x && x.owner === P.i && pow(x) >= 4).length;
    }
    if (/^devotion:/.test(e.nFrom || '')) return devotion(P, [e.nFrom.slice(9)]);
    return e.n;
}
async function resolveEffects(P, effects, presetTarget, source) {
    G.lastDo = true;
    let usedPreset = false;
    const resTargets = [];
    for (let e of effects) {
        if (G.over) return;
        if ((e.ifDo && !G.lastDo) || (e.ifDont && G.lastDo)) continue;
        if (e.cond && !condOk(e.cond, P, source)) continue;
        if (e.condNot && condOk(e.condNot, P, source)) continue;
        if (e.alt && condOk(e.alt.cond, P, source)) e = { ...e.alt.e, ifDo: e.ifDo, ifDont: e.ifDont };
        if (e.condN && !needsTarget(e) && condOk(e.condN.cond, P, source)) e = { ...e, n: e.condN.n };
        if (['optPay', 'optLife', 'optSac', 'discardSelf'].includes(e.t) && (e.may || e.t !== 'discardSelf')) { G.lastDo = await optionalCost(P, e, source); continue; }
        if (e.kicked && !(source && source.kicked)) continue;
        if (e.kickedN !== undefined && source && source.kicked) e = { ...e, n: e.kickedN };
        // "unless that player pays {1}" (Rhystic Study style): the opponent chooses
        if (e.unless) {
            const un = e.unless === 'pow' ? Math.max(0, source && onBf(source.uid) ? pow(source) : Number(source.card.power) || 0) : e.unless;
            const Q = G.players[1 - P.i], cost = { ...parseCost(''), generic: un }, plan = planPayment(Q, cost);
            if (plan && (Q.isAI ? Q.hand.length < 3 || un <= 1 : await askYes(Q, `${source.card.name}: pay {${un}} to stop it?`, { card: source.card }))) { plan.forEach(x => tapSource(Q, x)); if (un) log(`${Q.name} ${you(Q) ? 'pay' : 'pays'} {${un}}.`); continue; }
        }
        if (e.t === 'modal') { const i = await pickModes(P, { modeN: { min: e.min ?? 1, max: e.n || 1 } }, e.modes, source); if (i !== null) await resolveEffects(P, [].concat(i).flatMap(k => e.modes[k]), null, source); continue; }
        if (e.kickedP && source && source.kicked) e = { ...e, p: e.kickedP.p, q: e.kickedP.q };
        if (e.t === 'optOppDraw') { G.lastDo = await optionalCost(P, e, source); continue; }
        if (e.nCount || e.nFrom) e = { ...e, n: dynN(P, e, source) * (e.nFrom && e.per && e.t !== 'pump' && typeof e.per === 'number' ? e.per : 1) };
        if (e.kickedN !== undefined && e.t === 'tokenCopy' && source && source.kicked) e = { ...e, times: e.kickedN };
        if (e.perCtx && e.t === 'pump') e = { ...e, p: e.p * (G.ctxCount || 0), q: e.q * (G.ctxCount || 0) };
        if (e.per && e.t === 'pump') { const k = countFn(e.per)({ owner: P.i }); e = { ...e, p: e.p * k, q: e.q * k }; }
        if (e.pFrom) e = { ...e, p: dynN(P, { nFrom: e.pFrom }, source) };
        if (e.pqFrom) { const k = dynN(P, { nFrom: e.pqFrom }, source); e = { ...e, p: k, q: k }; }
        if (e.pqHand) e = { ...e, p: P.hand.length, q: P.hand.length };
        let target = null;
        if (e.target === 'last') {
            target = (G.lastTargets || [])[0];
            if (!target || !targetStillOk(target)) continue;
            await applyEffect(P, e, target, source);
            sba(); renderGame();
            continue;
        }
        if (needsTarget(e)) {
            // The target chosen on casting goes with the first targeted effect; later ones choose now ("another target")
            if (!usedPreset && presetTarget && validTargets(P, e, source).some(v => sameTarget(v, presetTarget))) { target = presetTarget; usedPreset = true; }
            if (!target) target = await chooseTarget(P, e, source, !!e.optional, e.notPrev ? resTargets : []);
            if (!target) { if (!e.optional) log(`${source.card.name}: no legal target.`); continue; }
            if (!targetStillOk(target)) { log(`${source.card.name}'s target is gone.`); continue; }
            resTargets.push(target);
        }
        if (e.condN && needsTarget(e) && target) { const was = G.lastTargets; G.lastTargets = [target]; if (condOk(e.condN.cond, P, source)) e = { ...e, n: e.condN.n }; G.lastTargets = was; }
        if (e.div && target) {
            const chosen = await divideTargets(P, e, target, source);
            const amts = await splitDamage(P, e.n, chosen, e.t === 'counters' ? '+1/+1 counters' : 'Damage');
            for (let i = 0; i < chosen.length; i++) if (amts[i] > 0 && targetStillOk(chosen[i])) await applyEffect(P, { ...e, n: amts[i] }, chosen[i], source);
            G.lastTargets = chosen;
            sba(); renderGame();
            continue;
        }
        if (['reorderTop', 'fetchLand', 'tutor', 'regrow', 'brainstorm', 'cultivate', 'dig', 'scry', 'surveil', 'discardPick', 'millPick', 'keepTop', 'populate', 'connive', 'etali', 'digLand', 'topLandOrHand', 'consumingTide', 'gollum', 'pumpChoice', 'becomeCopy', 'tutorNamed', 'castFreeHand', 'reboundCast'].includes(e.t)) await applyChoiceEffect(P, e, source, target);
        else await applyEffect(P, e, target, source);
        if (target && e.t !== 'biteDmg' && e.t !== 'fightLast') G.lastTargets = [target];
        // "up to N targets": choose the others now, one at a time (you can stop)
        if (e.multi && target) {
            const chosen = G.lastTargets = [target];
            for (let k = 1; k < e.multi && !G.over; k++) {
                const more = await chooseTarget(P, e, source, true, chosen);
                if (!more || !targetStillOk(more)) break;
                chosen.push(more);
                await applyEffect(P, e, more, source);
            }
        }
        sba();
        renderGame();
    }
}
// Divided damage: the targets (the AI plans them all; you add more one at a time)
async function divideTargets(P, e, first, src) {
    const max = Math.min(e.div, e.n);
    if (P.isAI && e.t === 'counters') {
        const mine = validTargets(P, e, src).filter(v => v.o && v.o.owner === P.i).sort((a, b) => creatureValue(b.o) - creatureValue(a.o));
        return mine.slice(0, Math.max(1, Math.min(max, mine.length))).length ? mine.slice(0, Math.max(1, Math.min(max, mine.length))) : [first];
    }
    if (P.isAI) {
        const valid = validTargets(P, e, src), O = opp(P);
        const kills = valid.filter(v => v.o && v.o.owner !== P.i && isCreature(v.o) && !has(v.o, 'indestructible')).sort((a, b) => creatureValue(b.o) - creatureValue(a.o));
        const out = []; let left = e.n;
        for (const v of kills) { const need = Math.max(1, tou(v.o) - v.o.dmg); if (need <= left && out.length < max) { out.push(v); left -= need; } }
        if ((left > 0 || !out.length) && out.length < max && valid.some(v => v.p === O)) out.push({ p: O });
        return out.length ? out : [first];
    }
    const chosen = [first];
    while (chosen.length < max && !G.over) {
        const more = await chooseTarget(P, e, src, true, chosen);
        if (!more || !targetStillOk(more)) break;
        chosen.push(more);
    }
    return chosen;
}
// Each target gets at least 1 (601.2d). The AI gives creatures lethal damage first; you type the split.
async function splitDamage(P, n, targets, what = 'Damage') {
    if (targets.length === 1) return [n];
    const amts = targets.map(() => 1);
    let left = n - targets.length;
    if (P.isAI && what !== 'Damage') { for (let k = 0; left > 0; k = (k + 1) % targets.length, left--) amts[k]++; return amts; }
    if (P.isAI) {
        targets.forEach((t, i) => { if (t.o && left > 0) { const add = Math.min(left, Math.max(0, tou(t.o) - t.o.dmg - 1)); amts[i] += add; left -= add; } });
        const face = targets.findIndex(t => t.p); amts[face >= 0 ? face : 0] += left;
        return amts;
    }
    for (let i = 0; i < targets.length - 1; i++) {
        const most = left + 1;
        const v = await askNumber(P, `${what} for ${targetName(targets[i])}? (the rest goes to the next target)`, 1, most, 1, { noCancel: true, ok: 'Assign' });
        const got = v >= 1 && v <= most ? v : 1;
        amts[i] = got; left -= got - 1;
    }
    amts[targets.length - 1] = 1 + left;
    return amts;
}
// Effects that pick a card from your library or graveyard
const BASIC_TYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
function landFits(o, what) {
    const t = o.card.type;
    if (!/\bLand\b/.test(t)) return false;
    if (what === 'land') return true;
    if (what === 'basic land') return /\bBasic\b/.test(t);
    const basic = what.startsWith('basic ');
    const types = what.replace(/^basic /, '').split(' or ').map(x => x[0].toUpperCase() + x.slice(1));
    return (!basic || /\bBasic\b/.test(t)) && types.some(x => new RegExp(`\\b${x}\\b`).test(t));
}
function cardFits(o, what) {
    const k = rulesFor(o.card).kind, t = o.card.type;
    let m;
    if ((m = what.match(/^(.+) mvge(\d+)$/))) return cardFits(o, m[1]) && (o.card.cmc || 0) >= +m[2];
    if ((m = what.match(/^(.+) mv(\d+)$/))) return cardFits(o, m[1]) && (o.card.cmc || 0) <= +m[2];
    if ((m = what.match(/^(white|blue|black|red|green) (.+)$/))) return (o.card.colors || []).includes(COLOR_WORDS[m[1]]) && cardFits(o, m[2]);
    if ((m = what.match(/^(.+) pow(\d+)$/))) return cardFits(o, m[1]) && (Number(o.card.power) || 0) <= +m[2];
    if (/ or /.test(what) && !/, /.test(what) && !['instant or sorcery', 'artifact or enchantment', 'creature or planeswalker'].includes(what)) return what.split(' or ').some(w => cardFits(o, w));
    switch (what) {
        case 'card': return true;
        case 'nonland': return k !== 'land';
        case 'nonartifact nonland': return k !== 'land' && !/Artifact/.test(t); // Chrome Mox
        case 'noncreature': return !/Creature/.test(t);
        case 'legendary': return /Legendary/.test(t);
        case 'creature': return /Creature/.test(t);
        case 'instant': return k === 'instant';
        case 'sorcery': return k === 'sorcery';
        case 'instant or sorcery': return k === 'instant' || k === 'sorcery';
        case 'artifact': return /Artifact/.test(t);
        case 'enchantment': return /Enchantment/.test(t);
        case 'artifact or enchantment': return /Artifact|Enchantment/.test(t);
        case 'land': return /\bLand\b/.test(t);
        case 'permanent': return !['instant', 'sorcery'].includes(k);
        case 'nonland permanent': return !['instant', 'sorcery', 'land'].includes(k);
        case 'creature or planeswalker': return /Creature|Planeswalker/.test(t);
    }
    // Two-word kinds (2026-10-08, owner's report: Skeleton Shard found no "artifact creature card"):
    // "artifact creature", "legendary creature", "colorless creature", "dragon creature", "snow land"
    if ((m = what.match(/^([a-z]+) (creature|land|artifact|enchantment|permanent|card)$/i)) && !/^non/i.test(m[1])) {
        const q = m[1].toLowerCase();
        if (!cardFits(o, m[2].toLowerCase())) return false;
        if (['artifact', 'enchantment', 'legendary', 'snow', 'basic', 'land', 'creature', 'tribal', 'kindred'].includes(q)) return new RegExp(`\\b${q}\\b`, 'i').test(t);
        if (q === 'colorless') return !(o.card.colors || []).length;
        if (COLOR_WORDS[q]) return (o.card.colors || []).includes(COLOR_WORDS[q]);
        return new RegExp(`\\b${q}\\b`, 'i').test(t.split(' — ')[1] || '');
    }
    // A list: "Aura, God or Demigod"
    if (/, /.test(what)) return what.split(/,\s*(?:or\s+)?|\s+or\s+/).filter(Boolean).some(w => cardFits(o, w));
    // A creature type ("Dragon", "Villain", "Elf", "Aura", "Spider Hero")
    return /^[a-z]+(?: [a-z]+)?$/i.test(what) && what.split(' ').every(w => new RegExp(`\\b${w}\\b`, 'i').test(t.split(' — ')[1] || ''));
}
function wipeMatches(o, what, P) {
    if (/ you don't control$/.test(what) && what !== "creatures you don't control") return o.owner !== P.i && wipeMatches(o, what.replace(/ you don't control$/, ''), P);
    if (what === 'permanents') return true;
    switch (what) {
        case 'creatures': case 'other creatures': return isCreature(o);
        case 'artifacts': return /Artifact/.test(o.card.type);
        case 'enchantments': return /Enchantment/.test(o.card.type);
        case 'artifacts and enchantments': return /Artifact|Enchantment/.test(o.card.type);
        case 'nonland permanents': return !/\bLand\b/.test(o.card.type);
        case "creatures you don't control": case 'creatures your opponents control': return isCreature(o) && o.owner !== P.i;
        case 'nontoken creatures': return isCreature(o) && !o.token;
        case 'lands': return /\bLand\b/.test(o.card.type);
        case 'tapped creatures': return isCreature(o) && o.tapped;
        case 'attacking creatures': return G.attackers.includes(o.uid);
        case 'planeswalkers': return isPlaneswalker(o);
        case 'nonartifact, nonblack creatures': return isCreature(o) && !/Artifact/.test(o.card.type) && !(o.card.colors || []).includes('B');
        case 'battles': return isBattle(o);
        case 'legendary creatures': return isCreature(o) && /\bLegendary\b/.test(o.card.type);
        case 'nonlegendary creatures': return isCreature(o) && !/\bLegendary\b/.test(o.card.type);
    }
    let m0 = what.match(/^nonland permanents with mana value (\d+) or less$/);
    if (m0) return !/\bLand\b/.test(o.card.type) && (o.card.cmc || 0) <= +m0[1];
    let m = what.match(/creatures with (power|mana value) (\w+) or (less|greater)/);
    if (m) { const v = m[1] === 'power' ? (isCreature(o) ? pow(o) : -1) : (o.card.cmc || 0); return isCreature(o) && (m[3] === 'less' ? v <= num(m[2]) : v >= num(m[2])); }
    return false;
}
// How much the AI wants to keep a card in hand (lowest gets discarded)
function aiKeepValue(P, o) {
    const r = Rx(o);
    if (r.kind === 'land') return P.bf.filter(x => Rx(x).kind === 'land').length >= 6 ? 0 : 5;
    return 3 + (o.card.cmc || 0) * 0.5 - (r.support === 'none' ? 4 : 0);
}
async function applyChoiceEffect(P, e, src, t) {
    // Ponder, Sensei's Divining Top: look at the top N and put them back in any order (top-1000 round 2)
    if (e.t === 'reorderTop') {
        const top = P.library.slice(-e.n).reverse(); // top first
        if (!top.length) return;
        let order;
        if (P.isAI) order = top.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a));
        else {
            order = [];
            const left = top.slice();
            while (left.length > 1) {
                const pick = await pickCard(P, left, `${src.card.name}: choose the card to put ${order.length ? 'next' : 'on top'} (${order.length + 1} of ${top.length})`);
                const x = pick || left[0];
                order.push(x); pull(left, x);
            }
            order.push(...left);
        }
        P.library.splice(-top.length, top.length, ...order.slice().reverse());
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} card${top.length === 1 ? '' : 's'} and ${you(P) ? 'put' : 'puts'} them back${you(P) ? ` (${order.map(x => x.card.name).join(', ')}, top first)` : ''}.`);
        return;
    }
    // ---- Starter kits (2026-10-06) ----
    if (e.t === 'digLand') {
        const top = P.library.splice(-e.n).reverse();
        const pick = await pickCard(P, top.filter(x => /\bLand\b/.test(x.card.type)), `${src.card.name}: you may put a land onto the battlefield tapped (the rest go to the bottom)`);
        if (pick) { resetObj(pick); pick.tapped = true; P.bf.push(pick); fire('landfall', { o: pick }); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} onto the battlefield tapped.`); }
        P.library.unshift(...shuffle(top.filter(x => x !== pick)));
        return;
    }
    if (e.t === 'topLandOrHand') {
        const top = P.library[P.library.length - 1];
        if (!top) return;
        if (/\bLand\b/.test(top.card.type)) {
            if (P.isAI || await askYes(P, `${src.card.name}: put ${top.card.name} onto the battlefield tapped? (Cancel = leave it on top.)`, { card: src.card })) { P.library.pop(); resetObj(top); top.tapped = true; P.bf.push(top); fire('landfall', { o: top }); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${top.card.name} onto the battlefield tapped.`); }
        } else { P.library.pop(); P.hand.push(top); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${you(P) ? top.card.name : 'the top card'} into ${you(P) ? 'your' : 'their'} hand.`); }
        return;
    }
    if (e.t === 'tutorNamed') {
        const want = e.name === '~' ? src.card.name : e.name;
        const zones = e.gy ? [P.gy, P.library] : [P.library];
        let found = null, zone = null;
        for (const z of zones) { found = z.find(x => x.card.name === want); if (found) { zone = z; break; } }
        if (found) { pull(zone, found); P.hand.push(found); log(`${P.name} ${you(P) ? 'find' : 'finds'} ${want} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand.`); }
        else log(`${P.name} ${you(P) ? 'find' : 'finds'} no ${want}.`);
        if (zone === P.library || !found) shuffle(P.library);
        return;
    }
    if (e.t === 'pumpChoice') {
        if (!onBf(src.uid)) return;
        let k;
        if (P.isAI) {
            const O = opp(P), atk = G.attackers.includes(src.uid), blocking = Object.values(G.blocks).some(bs => bs.includes(src.uid));
            k = blocking || (atk && (G.blocks[src.uid] || []).length) ? e.kws.find(x => x === 'deathtouch') : atk && !O.bf.some(c => isCreature(c) && (has(c, 'flying') || has(c, 'reach'))) ? e.kws.find(x => x === 'flying') : e.kws.find(x => x === 'lifelink');
            k = k || e.kws[0];
        } else {
            const i = await pickMode(P, e.kws.map(() => []), { card: { name: src.card.name, text: e.kws.map(x => `• ${x}`).join('\n') } });
            if (i === null || i < 0) return;
            k = e.kws[i];
        }
        src.tkw.push(k);
        log(`${src.card.name} gains ${k} until end of turn.`);
        return;
    }
    if (e.t === 'becomeCopy') {
        const x = G.ctxObj;
        if (!x || !onBf(src.uid) || !onBf(x.uid) || x === src) return;
        if (!(P.isAI || await askYes(P, `${src.card.name}: become a copy of ${x.card.name} until end of turn?`, { card: src.card }))) return;
        src.copyOf = src.copyOf || src.card; src.copyTurn = G.turn;
        src.card = { ...x.card, id: `${x.card.id}-copy${uidSeq}`, name: src.copyOf.name, type: /Legendary/.test(x.card.type) ? x.card.type : `Legendary ${x.card.type}` };
        log(`${src.copyOf.name} becomes a copy of ${x.card.name} until end of turn.`);
        return;
    }
    if (e.t === 'consumingTide') {
        // Each player keeps one nonland permanent; the rest go back to hand
        const keep = [];
        for (const X of G.players) {
            const mine = X.bf.filter(x => !/\bLand\b/.test(x.card.type) && !x.attachedTo);
            if (!mine.length) continue;
            const pick = X.isAI ? mine.sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(X, mine, `${src.card.name}: choose a nonland permanent to keep`) || mine[0];
            keep.push(pick);
        }
        const back = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !keep.includes(x) && !(x.attachedTo && keep.some(k => k.uid === x.attachedTo)));
        log(`${src.card.name}: ${keep.map(k => k.card.name).join(' and ') || 'nothing'} ${keep.length === 1 ? 'stays' : 'stay'}; ${back.length} permanent${back.length === 1 ? '' : 's'} return${back.length === 1 ? 's' : ''} to hand.`);
        back.forEach(x => leaveBattlefield(x, 'hand'));
        const more = G.players.filter(X => X !== P && X.hand.length > P.hand.length).length;
        if (more) drawCards(P, more);
        return;
    }
    if (e.t === 'gollum') {
        // Look at the top two, keep the order, name land or nonland; the opponent guesses
        const O = opp(P), top2 = P.library.slice(-2).reverse();
        if (!top2.length || !onBf(src.uid)) return;
        const isLand = x => /\bLand\b/.test(x.card.type);
        const kind = P.isAI ? (isLand(top2[0]) ? 'land' : 'nonland') : (await askYes(P, `${src.card.name}: the top card is ${top2[0].card.name}${top2[1] ? ` (then ${top2[1].card.name})` : ''}. Choose land or nonland.`, { card: src.card, yes: 'Land', no: 'Nonland' }) ? 'land' : 'nonland');
        const guess = O.isAI ? (Math.random() < 0.4 ? 'land' : 'nonland') : (await askYes(O, `${P.name} chose land or nonland for the top card of their library. Your guess?`, { card: src.card, yes: 'Land', no: 'Nonland' }) ? 'land' : 'nonland');
        const top = P.library[P.library.length - 1];
        const actual = isLand(top) ? 'land' : 'nonland';
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name} (${actual}); ${O.name} guessed ${guess}.`);
        if ((guess === kind) === (kind === actual) && guess === kind) { G.attackers = G.attackers.filter(u => u !== src.uid); log(`${O.name} guessed right - ${src.card.name} is removed from combat.`); }
        else { drawCards(P, 1); src.tkw.push('unblockable'); log(`${src.card.name} can't be blocked this turn.`); }
        return;
    }
    if (e.t === 'etali') {
        // Etali: exile the top card of each library, then cast any of the spells free
        const exiled = G.players.map(X => { const c = X.library.pop(); if (c) X.exile.push(c); return c; }).filter(Boolean);
        log(`${src.card.name} exiles ${exiled.map(c => c.card.name).join(', ') || 'nothing'}.`);
        for (const x of exiled) {
            const r = Rx(x);
            if (r.kind === 'land' || r.support === 'none') continue;
            if (!(P.isAI ? aiScore(P, x, firstTargetEffect(x) ? aiPickTarget(P, firstTargetEffect(x), x) : null) > 0 || r.kind === 'creature' : await askYes(P, `${src.card.name}: cast ${x.card.name} without paying its mana cost?`, { card: src.card }))) continue;
            const X = G.players.find(Y => Y.exile.includes(x)); pull(X.exile, x);
            if (X !== P) { x.realOwner = x.owner; x.owner = P.i; }
            if (r.modes) x.mode = (await pickModes(P, r, r.modes, x)) ?? 0;
            const te = firstTargetEffect(x);
            const tg = te ? await chooseTarget(P, te, x, false) : null;
            if (te && !tg) { X.exile.push(x); continue; }
            G.stack.push({ id: stackSeq++, kind: 'spell', o: x, P, target: tg, name: x.card.name, x: 0 });
            log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${x.card.name} without paying its mana cost.`);
        }
        return;
    }
    if (e.t === 'connive') {
        // Connive (701.50): draw, then discard; a nonland discard puts a +1/+1 counter on it
        const who = e.target === 'self' ? (onBf(src.uid) ? src : null) : t && t.o;
        const owner = who ? G.players[who.owner] : P;
        drawCards(owner, 1);
        const d = owner.isAI ? owner.hand.slice().sort((a, b) => aiKeepValue(owner, a) - aiKeepValue(owner, b))[0] : await pickCard(owner, owner.hand, `${who ? who.card.name : src.card.name} connives: choose a card to discard`) || owner.hand[0];
        if (d) { pull(owner.hand, d); owner.gy.push(d); noteDiscard(owner, 1); d.discardTurn = G.turn; log(`${owner.name} ${you(owner) ? 'discard' : 'discards'} ${d.card.name}.`); }
        if (who && d && Rx(d).kind !== 'land' && onBf(who.uid)) { who.counters++; log(`${who.card.name} connives and gets a +1/+1 counter.`); }
        return;
    }
    if (e.t === 'millPick') {
        const milled = P.library.splice(-e.n).reverse();
        P.gy.push(...milled);
        log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.length}${milled.length ? `: ${milled.map(x => x.card.name).join(', ')}` : ''}.`);
        const pick = await pickCard(P, milled.filter(x => cardFits(x, e.what)), `${src.card.name}: you may put a ${e.what} card into your hand`);
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} into ${you(P) ? 'your' : 'their'} hand.`); }
        return;
    }
    if (e.t === 'keepTop') {
        const top = P.library.splice(-e.n).reverse();
        const pick = await pickCard(P, top, `${src.card.name}: you may put one card back on top (the rest go to your graveyard)`);
        P.gy.push(...top.filter(x => x !== pick));
        if (pick) P.library.push(pick);
        log(`${P.name} ${you(P) ? 'keep' : 'keeps'} ${pick ? 'one card' : 'nothing'} on top and ${you(P) ? 'put' : 'puts'} ${top.length - (pick ? 1 : 0)} into the graveyard.`);
        return;
    }
    if (e.t === 'populate') {
        // Populate (701.36): copy a creature token you control
        const toks = P.bf.filter(x => x.token && isCreature(x));
        const pick = toks.length > 1 ? await pickCard(P, toks.slice().sort((a, b) => creatureValue(b) - creatureValue(a)), `${src.card.name}: populate - choose a token to copy`) : toks[0];
        if (!pick) { log('Populate: no creature token to copy.'); return; }
        const tok = makeObj({ ...pick.card, id: `token-${uidSeq}` }, P.i, { token: true });
        P.bf.push(tok);
        log(`${P.name} ${you(P) ? 'populate' : 'populates'}: a copy of ${pick.card.name}.`);
        fire('enters', { o: tok });
        tokenMade(P);
        return;
    }
    if (e.t === 'discardPick') {
        const O = opp(P);
        const fits = x => e.what.split(' ').filter(w => w !== 'or').every(w => w.startsWith('mvge') ? (x.card.cmc || 0) >= Number(w.slice(4)) : w.startsWith('mv') ? (x.card.cmc || 0) <= Number(w.slice(2)) : w.startsWith('non') ? !cardFits(x, w.slice(3)) : cardFits(x, w));
        log(`${O.name} ${you(O) ? 'reveal' : 'reveals'} ${you(O) ? 'your' : 'their'} hand: ${O.hand.map(x => x.card.name).join(', ') || 'nothing'}.`);
        const pick = await pickCard(P, O.hand.filter(fits), `${src.card.name}: choose a card for ${O.name === 'You' ? 'you' : O.name} to discard`);
        if (pick) { pull(O.hand, pick); O.gy.push(pick); pick.discardTurn = G.turn; log(`${O.name} ${you(O) ? 'discard' : 'discards'} ${pick.card.name}.`); }
        return;
    }
    if (e.t === 'scry' || e.t === 'surveil') {
        const top = P.library.slice(-e.n).reverse(); // top card first
        if (!top.length) return;
        if (e.t === 'scry') fire('scry', { P, n: top.length });
        const keep = await pickScry(P, top, e.t === 'surveil', src);
        top.forEach(o => pull(P.library, o));
        const kept = top.filter((o, i) => keep[i]), away = top.filter((o, i) => !keep[i]);
        if (e.t === 'surveil') P.gy.push(...away); else P.library.unshift(...away);
        P.library.push(...kept.reverse());
        log(`${P.name} ${you(P) ? e.t : e.t === 'scry' ? 'scries' : 'surveils'} ${e.n}: ${kept.length} on top, ${away.length} ${e.t === 'surveil' ? 'to the graveyard' : 'to the bottom'}.`);
        return;
    }
    if (e.t === 'dig') {
        const top = P.library.splice(-e.n).reverse();
        const pool = top.filter(x => e.what.split(' or ').some(w => cardFits(x, w)));
        const kept = [];
        for (let k = 0; k < (e.keep || 1); k++) {
            const pick = await pickCard(P, pool.filter(x => !kept.includes(x)), `${src.card.name}: choose a card for your hand${e.keep > 1 ? ` (${k + 1} of ${e.keep})` : ''} (the rest go to the bottom)`);
            if (!pick) break;
            kept.push(pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${you(P) ? pick.card.name : 'a card'} into ${you(P) ? 'your' : 'their'} hand.`);
        }
        P.library.unshift(...shuffle(top.filter(x => !kept.includes(x))));
        return;
    }
    if (e.t === 'castFreeHand') {
        // Rishkar's Expertise: cast a spell from your hand free
        const pool = P.hand.filter(x => x !== src && Rx(x).kind !== 'land' && Rx(x).support !== 'none' && (x.card.cmc || 0) <= e.mv && (!firstTargetEffect(x) || validTargets(P, firstTargetEffect(x), x).length));
        const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${src.card.name}: cast a spell with mana value ${e.mv} or less free (or None)`);
        if (pick) await castFreeNow(P, pick, P.hand);
        return;
    }
    if (e.t === 'reboundCast') {
        const x = P.exile.find(c => c.uid === e.uid);
        if (!x || (!P.isAI && !(await askYes(P, `Rebound: cast ${x.card.name} from exile without paying its mana cost?`, { card: x.card })))) return;
        if (!(await castFreeNow(P, x, P.exile))) log(`${x.card.name} has no target - it stays in exile.`);
        return;
    }
    if (e.t === 'brainstorm') {
        drawCards(P, 3);
        for (let k = 0; k < 2 && P.hand.length; k++) {
            const pick = P.isAI ? P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : await pickCard(P, P.hand, `${src.card.name}: put a card back on top (${k + 1} of 2)`) || P.hand[0];
            pull(P.hand, pick);
            P.library.push(pick); // the top of the library is the end of the array
        }
        log(`${P.name} ${you(P) ? 'put' : 'puts'} two cards back on top.`);
        return;
    }
    if (e.t === 'cultivate') {
        for (const toBf of [true, false]) {
            const pool = P.library.filter(x => landFits(x, 'basic land'));
            const pick = await pickCard(P, pool, `${src.card.name}: choose a basic land ${toBf ? 'for the battlefield (tapped)' : 'for your hand'}`);
            if (!pick) break;
            pull(P.library, pick);
            resetObj(pick);
            if (toBf) { pick.tapped = true; P.bf.push(pick); fire('landfall', { o: pick }); } else P.hand.push(pick);
            log(`${P.name} ${you(P) ? 'search' : 'searches'} for ${pick.card.name} (${toBf ? 'battlefield, tapped' : 'hand'}).`);
        }
        shuffle(P.library);
        return;
    }
    if (e.t === 'fetchLand') {
        let firstPick = null;
        for (let k = 0; k < e.n; k++) {
            // Myriad Landscape: the second land shares a land type with the first
            const pool = P.library.filter(x => landFits(x, e.what) && (!e.sameType || !firstPick || ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].some(ty => hasType(x, ty) && hasType(firstPick, ty))));
            const pick = await pickCard(P, pool, `${src.card.name}: choose a land`);
            if (!pick) break;
            firstPick = firstPick || pick;
            pull(P.library, pick);
            resetObj(pick);
            if (e.bf) { pick.tapped = !!e.tapped || !!Rx(pick).entersTapped; P.bf.push(pick); fire('landfall', { o: pick }); }
            else if (e.top) { shuffle(P.library); P.library.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} on top of the library.`); return; }
            else P.hand.push(pick);
            log(`${P.name} ${you(P) ? 'search' : 'searches'} for ${pick.card.name} and ${e.bf ? `${you(P) ? 'put' : 'puts'} it onto the battlefield${pick.tapped ? ' tapped' : ''}` : `${you(P) ? 'put' : 'puts'} it in hand`}.`);
        }
        shuffle(P.library);
    } else if (e.t === 'tutor') {
        const got = [];
        for (let k = 0; k < (e.n || 1); k++) {
            const pool = [...P.library, ...(e.gyToo ? P.gy : [])].filter(x => cardFits(x, e.what) && !got.includes(x));
            const pick = await pickCard(P, pool, `${src.card.name}: choose a card${e.n > 1 ? ` (${k + 1} of ${e.n}; skip to stop)` : ''}`);
            if (!pick) break;
            got.push(pick); removeFromZones(pick);
        }
        shuffle(P.library);
        got.forEach(pick => {
            if (e.top) { P.library.push(pick); log(`${P.name} ${you(P) ? 'search' : 'searches'} for a card and ${you(P) ? 'put' : 'puts'} it on top of the library${you(P) ? ` (${pick.card.name})` : ''}.`); }
            else if (e.bf) putOntoBattlefield(P, pick, false);
            else if (e.toGy) { P.gy.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} into the graveyard.`); }
            else { P.hand.push(pick); log(`${P.name} ${you(P) ? 'search' : 'searches'} for a card${you(P) ? ` (${pick.card.name})` : ''} and ${you(P) ? 'put' : 'puts'} it in hand.`); }
        });
    } else if (e.t === 'regrow') {
      for (let k = 0; k < (e.count || 1); k++) {
        const gys = e.anyGy ? [P, opp(P)] : [P];
        const pool = gys.flatMap(X => X.gy).filter(x => cardFits(x, e.what) && !(e.notSelf && x === src));
        const pick = await pickCard(P, pool, `${src.card.name}: choose a card from ${e.anyGy ? 'a' : 'your'} graveyard${e.count > 1 ? ` (${k + 1} of ${e.count}; skip to stop)` : ''}`, { required: !e.may && !(e.count > 1) });
        if (!pick) break;
        G.lastCardPow = Number(pick.card.power) || 0;
        G.lastCardMv = pick.card.cmc || 0;
        if (e.anyGy && !e.bf && !P.gy.includes(pick)) { const X = G.players[pick.owner]; pull(X.gy, pick); X.hand.push(pick); log(`${pick.card.name} returns to ${X.name === 'You' ? 'your' : `${X.name}'s`} hand.`); continue; }
        if (pick && e.top) { pull(P.gy, pick); P.library.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} on top of ${you(P) ? 'your' : 'their'} library.`); continue; }
        if (pick) {
            // From whichever graveyard holds it (an opponent's too)
            const from = gys.find(X => X.gy.includes(pick)) || P;
            pull(from.gy, pick);
            if ((e.bf || (e.bfIf && condOk(e.bfIf, P, src))) && !['instant', 'sorcery'].includes(Rx(pick).kind)) { G.lastMv = pick.card.cmc || 0; if (from !== P) { pick.realOwner = pick.owner; pick.owner = P.i; } resetObj(pick); if (e.tapped) pick.tapped = true; P.bf.push(pick); G.lastReturned = pick; if (e.counters) pick.counters += e.counters; log(`${pick.card.name} returns to the battlefield${e.tapped ? ' tapped' : ''}${e.counters ? ` with ${e.counters} additional +1/+1 counters` : ''}.`); fire(Rx(pick).kind === 'land' ? 'landfall' : 'enters', { o: pick }); if (Rx(pick).etb.length) await putTriggers(P, pick, Rx(pick).etb); }
            else { P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : `${P.name}'s`} hand.`); }
        }
      }
    }
}
function discardMark(cards) { cards.forEach(c => { if (c) c.discardTurn = G.turn; }); }
// ---- Mirrodin (2026-10-08) helpers ----
// A permanent changes controller for good (Loxodon Peacekeeper, Jinxed Choker, Confusion in the Ranks)
function giveControl(o, X) {
    if (!onBf(o.uid) || o.owner === X.i) return;
    const real = o.realOwner ?? o.owner;
    pull(G.players[o.owner].bf, o);
    if (X.i === real) delete o.realOwner; else o.realOwner = real;
    o.owner = X.i; o.sick = true;
    X.bf.push(o);
    log(`${X.name} ${you(X) ? 'gain' : 'gains'} control of ${o.card.name}.`);
}
// A library shuffled by a spell or ability (Psychogenic Probe)
function libShuffle(P) { shuffle(P.library); if (G && G.phase !== 'setup') fire('shuffled', { P }); }
// A coin flip; Krark's Thumb flips two and keeps the better one
function flipCoin(P) {
    const thumbs = P.bf.filter(x => Rx(x).thumb && !lostAbilities(x)).length;
    let won = Math.random() < 0.5;
    for (let k = 0; k < thumbs && !won; k++) won = Math.random() < 0.5;
    return won;
}
// Mesmeric Orb: permanents that untap make their controller mill
function mesmeric(X, n) {
    const orbs = allPerms().filter(x => Rx(x).mesmeric && !lostAbilities(x)).length;
    if (!orbs || !n) return;
    const milled = X.library.splice(-n * orbs).reverse();
    X.gy.push(...milled);
    if (milled.length) log(`${X.name} ${you(X) ? 'mill' : 'mills'} ${milled.length} (Mesmeric Orb).`);
}
const dampingOn = () => !!G && allPerms().some(x => Rx(x).damping && !lostAbilities(x));
// "Remove a counter from a permanent you control" (Power Conduit): a named counter first, else a +1/+1 counter
async function removeAnyCounter(P, src) {
    const pool = P.bf.filter(x => x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0));
    if (!pool.length) return false;
    const x = P.isAI ? pool.sort((a, b) => (Object.values(b.ctr).some(v => v > 0) ? 1 : 0) - (Object.values(a.ctr).some(v => v > 0) ? 1 : 0))[0] : await pickCard(P, pool, `${src.card.name}: remove a counter from a permanent you control`) || pool[0];
    const named = Object.keys(x.ctr || {}).find(k => x.ctr[k] > 0 && k !== 'loyalty') || (x.ctr.loyalty > 0 && x.counters <= 0 ? 'loyalty' : null);
    if (named && !(x.counters > 0 && !P.isAI && await askYes(P, `Remove a +1/+1 counter from ${x.card.name}? (Cancel = a ${named} counter)`, { card: x.card, yes: '+1/+1 counter', no: `${named} counter` }))) { x.ctr[named]--; log(`A ${named} counter is removed from ${x.card.name}.`); }
    else { x.counters--; log(`A +1/+1 counter is removed from ${x.card.name}.`); }
    return true;
}
// The creatures fighting this one: its blockers if it's attacking, the attackers it blocks if it's blocking (Magic 2010)
function combatPartners(o) {
    const asAtk = (G.blocks[o.uid] || []).map(onBf).filter(Boolean);
    const asBlk = Object.entries(G.blocks).filter(([, bs]) => bs.includes(o.uid)).map(([a]) => onBf(Number(a))).filter(Boolean);
    return [...asAtk, ...asBlk];
}
function noteDiscard(P, n) { if (P.discardTurn !== G.turn) { P.discardTurn = G.turn; P.discardN = 0; } P.discardN += n; }

async function applyEffect(P, e, t, src) {
    const O = opp(P);
    const name = src.card.name;
    switch (e.t) {
        case 'dmg':
            if (e.artN && t && t.o && isCreature(t.o) && /Artifact/.test(t.o.card.type)) e = { ...e, n: e.artN }; // Electrostatic Bolt
            if (t && t.o) { if (e.exileDies) t.o.exileOnDeath = G.turn; if (e.noIndestr) t.o.tkw.push('-indestructible'); }
            if (e.excessTreasure && t && t.o && isCreature(t.o)) { const over = Math.max(0, e.n - Math.max(0, tou(t.o) - t.o.dmg)); damage(t.o, e.n, src); log(`${name} deals ${e.n} to ${t.o.card.name}.`); if (over) { for (let k = 0; k < over; k++) makeArtifactToken(P, 'treasure').tapped = true; log(`${P.name} ${you(P) ? 'create' : 'creates'} ${over} tapped Treasure token${over === 1 ? '' : 's'}.`); tokenMade(P); } break; }
            if (e.excess && t && t.o && isCreature(t.o)) {
                const lethal = Math.max(0, tou(t.o) - t.o.dmg), over = e.n - lethal, X = ctrl(t.o);
                damage(t.o, Math.min(e.n, lethal), src); log(`${name} deals ${Math.min(e.n, lethal)} to ${t.o.card.name}.`);
                if (over > 0) { damage(X, over, src); log(`${name} deals ${over} excess damage to ${X.name}.`); }
                break;
            }
            if (e.target === 'opponents') { damage(O, e.n, src); log(`${name} deals ${e.n} to ${O.name}.`); }
            else if (e.target === 'everyone' || e.target === 'players' || e.target === 'oppAll') {
                const cs = e.target === 'players' ? [] : allPerms().filter(c => isCreature(c) && (e.target === 'everyone' || c.owner !== P.i));
                cs.forEach(c => damage(c, e.n, src));
                (e.target === 'oppAll' ? [O] : G.players).forEach(X => damage(X, e.n, src));
                log(`${name} deals ${e.n} to ${e.target === 'oppAll' ? `${O.name} and each creature they control` : e.target === 'players' ? 'each player' : 'each creature and each player'}.`);
            }
            else if (e.target === 'allCreatures' || e.target === 'oppCreatures' || e.target === 'flyingCreatures' || e.target === 'groundCreatures') {
                allPerms().filter(isCreature).filter(c => (e.target === 'allCreatures' || (e.target === 'oppCreatures' ? c.owner !== P.i : e.target === 'flyingCreatures' ? has(c, 'flying') : !has(c, 'flying')))).forEach(c => damage(c, e.n, src));
                log(`${name} deals ${e.n} to each ${e.target === 'allCreatures' ? '' : 'opposing '}creature.`);
            } else { damage(t.p || t.o, e.n, src); log(`${name} deals ${e.n} to ${targetName(t)}.`); }
            break;
        case 'destroy': { G.lastTouN = Math.max(0, tou(t.o)); G.lastPower = { P: G.players[t.o.owner], n: Math.max(0, pow(t.o)) }; G.lastMv = t.o.card.cmc || 0; const ctl = G.players[t.o.owner], nb = /\bLand\b/.test(t.o.card.type) && !/\bBasic\b/.test(t.o.card.type); if (e.noRegen) t.o.regen = 0; destroy(t.o); if (e.nonbasicDmg && nb) { damage(ctl, e.nonbasicDmg, src); log(`${name} deals ${e.nonbasicDmg} damage to ${ctl.name === 'You' ? 'you' : ctl.name}.`); } break; }
        case 'exile': {
            G.lastPower = { P: G.players[t.o.owner], n: Math.max(0, pow(t.o)) };
            if (e.ctrlToken) await applyEffect(G.players[t.o.owner], { t: 'token', n: 1, p: e.ctrlToken.p, q: e.ctrlToken.q, name: e.ctrlToken.name, kw: [] }, null, src);
            const until = (e.until || Rx(src).leaveReturn) && onBf(src.uid);
            log(`${t.o.card.name} is exiled${until ? ` until ${src.card.name} leaves the battlefield` : ''}.`);
            leaveBattlefield(t.o, 'exile');
            if (until && !t.o.token) t.o.exiledBy = src.uid;
            break;
        }
        case 'lifeFromPower': if (G.lastPower) { G.lastPower.P.life += G.lastPower.n; log(`${G.lastPower.P.name} ${you(G.lastPower.P) ? 'gain' : 'gains'} ${G.lastPower.n} life.`); } break;
        case 'discardSelf': noteDiscard(P, Math.min(e.n, P.hand.length)); for (let k = 0; k < e.n && P.hand.length; k++) { const d = P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`); } break;
        case 'bounce':
            if (e.topIfAttacking && G.attackers.includes(t.o.uid) && (P.isAI || await askYes(P, `Put ${t.o.card.name} on top of its owner's library instead?`, { card: t.o.card }))) { leaveBattlefield(t.o, 'library'); log(`${t.o.card.name} is put on top of its owner's library.`); break; }
            G.lastBounced = t.o.owner; G.lastMv = t.o.card.cmc || 0;
            log(`${t.o.card.name} returns to its owner's hand.`); leaveBattlefield(t.o, 'hand'); break;
        case 'topdeck': log(`${t.o.card.name} is put on top of its owner's library.`); leaveBattlefield(t.o, 'library'); break;
        case 'gainAll': G.players.forEach(X => { X.life += e.n; fire('gainLife', { P: X, n: e.n }); }); log(`Each player gains ${e.n} life.`); break;
        case 'lastCtrlLose': if (G.lastPower) { G.lastPower.P.life -= e.n; log(`${G.lastPower.P.name} ${you(G.lastPower.P) ? 'lose' : 'loses'} ${e.n} life.`); if (e.gain) { P.life += e.gain; log(`${P.name} ${you(P) ? 'gain' : 'gains'} ${e.gain} life.`); fire('gainLife', { P }); } } break;
        case 'lastCtrlDmg': { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; const X = x ? G.players[x.realOwner ?? x.owner] : O; damage(X, e.n, src); log(`${name} deals ${e.n} to ${X.name}.`); break; }
        case 'markMine': break;
        case 'lastCtrlFetch': {
            const X = G.lastPower ? G.lastPower.P : O;
            const land = X.library.find(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type));
            if (land && (X.isAI || await askYes(X, `Search your library for a basic land (${land.card.name}) and put it onto the battlefield${e.tapped ? ' tapped' : ''}?`, { card: land.card }))) {
                pull(X.library, land); resetObj(land); land.tapped = !!e.tapped; X.bf.push(land); fire('landfall', { o: land });
                log(`${X.name} ${you(X) ? 'search' : 'searches'} for ${land.card.name}${e.tapped ? ' (tapped)' : ''}.`);
            }
            shuffle(X.library);
            break;
        }
        case 'eachFetchBasic': G.players.forEach(X => { const land = X.library.find(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type)); if (land) { pull(X.library, land); resetObj(land); X.bf.push(land); fire('landfall', { o: land }); log(`${X.name} ${you(X) ? 'search' : 'searches'} for ${land.card.name}.`); } shuffle(X.library); }); break;
        case 'lastCtrlGain': { const X = G.lastPower ? G.lastPower.P : O; X.life += e.n; log(`${X.name} ${you(X) ? 'gain' : 'gains'} ${e.n} life.`); fire('gainLife', { P: X, n: e.n }); break; }
        case 'delayedManaDrain': (G.delayed = G.delayed || []).push({ at: 'main', P, after: G.turn, effects: [{ t: 'addMana', mana: Array(G.lastMv || 0).fill('C') }], src, label: `${name}: add {C} equal to the countered spell's mana value` }); break;
        case 'delayedDraw': { const X = e.who === 'lastCtrl' ? (G.lastPower ? G.lastPower.P : O) : P; (G.delayed = G.delayed || []).push({ at: 'upkeep', P: X, after: G.turn, effects: [{ t: 'draw', n: e.n }], src, label: `${name}: ${X.name} ${you(X) ? 'draw' : 'draws'} ${e.n}` }); break; }
        case 'discardSelfRandom': for (let k = 0; k < e.n && P.hand.length; k++) { const d = P.hand.splice(rand(P.hand.length), 1)[0]; P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} at random.`); } break;
        case 'wheel': {
            const counts = G.players.map(X => { const n = X.hand.length; X.hand.forEach(c => { c.discardTurn = G.turn; }); X.gy.push(...X.hand.splice(0)); noteDiscard(X, n); return n; });
            const n = e.n === 'most' ? Math.max(...counts) : e.n;
            log(`Each player discards their hand and draws ${n}.`);
            G.players.forEach(X => drawCards(X, n));
            break;
        }
        case 'noMaxHandForever': P.noMaxHand = true; log(`${P.name} ${you(P) ? 'have' : 'has'} no maximum hand size for the rest of the game.`); break;
        case 'putLandFromHand': { G.lastPutLand = null; const l = P.hand.filter(x => Rx(x).kind === 'land' && (!e.what || landFits(x, e.what))).sort((a, b) => hasType(b, 'Cave') - hasType(a, 'Cave'))[0]; if (l) G.lastPutLand = l; if (l && (P.isAI || await askYes(P, `${name}: put ${l.card.name} onto the battlefield?`, { card: src && src.card }))) { pull(P.hand, l); resetObj(l); l.tapped = !!Rx(l).entersTapped; P.bf.push(l); fire('landfall', { o: l }); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${l.card.name} onto the battlefield.`); } break; }
        case 'oppDraws': drawCards(O, e.n); break;
        case 'wipeNotType': {
            const ty = commonType(P);
            const hit = allPerms().filter(x => isCreature(x) && !hasType(x, ty));
            log(`${name}: chosen type ${ty}; ${e.how === 'destroy' ? 'destroy' : 'return'} ${hit.length} creature${hit.length === 1 ? '' : 's'}.`);
            hit.forEach(x => { if (e.how === 'destroy') { if (!has(x, 'indestructible')) dieOrLeave(x, 'gy'); } else leaveBattlefield(x, 'hand'); });
            break;
        }
        case 'livingDeath': {
            const back = G.players.map(X => { const cs = X.gy.filter(x => /Creature/.test(x.card.type)); cs.forEach(x => { pull(X.gy, x); X.exile.push(x); }); return cs; });
            G.players.forEach(X => X.bf.filter(isCreature).forEach(x => dieOrLeave(x, 'gy')));
            G.players.forEach((X, i) => back[i].forEach(x => { pull(X.exile, x); resetObj(x); X.bf.push(x); fire('enters', { o: x }); if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: x, effects: Rx(x).etb }); }));
            log(`${name}: ${back[0].length + back[1].length} creature card${back[0].length + back[1].length === 1 ? '' : 's'} return to the battlefield.`);
            break;
        }
        case 'riseDark': {
            const got = G.players.flatMap(X => X.gy.filter(x => /Creature/.test(x.card.type)).map(x => [X, x]));
            got.forEach(([X, x]) => { pull(X.gy, x); resetObj(x); if (X !== P) { x.realOwner = x.owner; x.owner = P.i; } P.bf.push(x); fire('enters', { o: x }); if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: x, effects: Rx(x).etb }); });
            log(`${name}: ${got.length} creature${got.length === 1 ? '' : 's'} enter under ${you(P) ? 'your' : `${P.name}'s`} control.`);
            break;
        }
        case 'landsFromGy': { const ls = P.gy.filter(x => /\bLand\b/.test(x.card.type)); ls.forEach(x => { pull(P.gy, x); resetObj(x); x.tapped = true; P.bf.push(x); fire('landfall', { o: x }); }); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${ls.length} land${ls.length === 1 ? '' : 's'} to the battlefield tapped.`); break; }
        case 'untapNonland': P.bf.filter(x => !/\bLand\b/.test(x.card.type)).forEach(x => { x.tapped = false; }); log(`${P.name} ${you(P) ? 'untap' : 'untaps'} all nonland permanents.`); break;
        case 'ignition': { const x = t.o; if (!x || !onBf(x.uid)) break; const n = Math.max(0, pow(x)); allPerms().filter(c => isCreature(c) && c !== x).forEach(c => damage(c, n, x)); damage(O, n, x); log(`${x.card.name} deals ${n} damage to each other creature and ${O.name}.`); break; }
        case 'flicker': {
            const x = t.o; if (!x || !onBf(x.uid)) break;
            const X = G.players[x.realOwner ?? x.owner];
            leaveBattlefield(x, 'exile');
            if (!X.exile.includes(x)) break; // a token is gone
            pull(X.exile, x); resetObj(x); x.sick = true; X.bf.push(x); G.lastTargets = [{ o: x }];
            log(`${x.card.name} is exiled and returns to the battlefield.`);
            fire('enters', { o: x });
            if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: x, effects: Rx(x).etb });
            break;
        }
        case 'countersLastIfType': { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; if (x && onBf(x.uid) && hasType(x, e.type)) putCounters(x, e.n, P); break; }
        case 'copyEachToken': { const toks = P.bf.filter(x => x.token); toks.forEach(x => tokenCopyOf(P, x.card)); break; }
        case 'silence': O.silenced = { turn: G.turn, noncreature: !!e.noncreature }; log(`${O.name} can't cast ${e.noncreature ? 'noncreature ' : ''}spells this turn.`); break;
        case 'amass': {
            // Amass (701.44): counters on an Army you control, making a 0/0 Orc Army token first if you have none
            let army = P.bf.find(x => isCreature(x) && hasType(x, 'Army'));
            if (!army) {
                const card = { id: `token-${uidSeq}`, name: `${e.type} Army token`, fullName: `${e.type} Army token`, cost: '', cmc: 0, type: `Token Creature — ${e.type} Army`, text: '', power: '0', toughness: '0', colors: ['B'], ci: ['B'], img: null, imgS: null, legal: {} };
                army = makeObj(card, P.i, { token: true }); P.bf.push(army); G.lastMade = army;
                log(`${P.name} ${you(P) ? 'create' : 'creates'} a 0/0 ${e.type} Army token.`);
                fire('enters', { o: army }); tokenMade(P, true);
            }
            const got = putCounters(army, e.n, P);
            G.lastArmyPow = pow(army); G.lastDo = true;
            log(`${P.name} ${you(P) ? 'amass' : 'amasses'} ${e.type}s ${e.n}: ${army.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (now ${pow(army)}/${tou(army)}).`);
            break;
        }
        case 'countersMade': if (G.lastMade && onBf(G.lastMade.uid)) { const got = putCounters(G.lastMade, e.n, P); log(`${G.lastMade.card.name} gets ${got} +1/+1 counters.`); } break;
        case 'doubleCounters': { const x = e.target === 'self' ? src : t && t.o; if (x && onBf(x.uid) && x.counters > 0) { const n = x.counters; putCounters(x, n, P); log(`${x.card.name}'s +1/+1 counters are doubled.`); } break; }
        case 'removeCounterSelf': if (onBf(src.uid) && src.counters > 0) { src.counters--; G.lastDo = true; log(`${name}: a +1/+1 counter is removed.`); } else G.lastDo = false; break;
        case 'freeze': if (t.o) { t.o.skipUntap = true; log(`${t.o.card.name} won't untap during its controller's next untap step.`); } break;
        case 'bounceSpell': {
            const it = t.item, i = G.stack.indexOf(it);
            if (i < 0 || it.kind !== 'spell') break;
            G.stack.splice(i, 1); const x = it.o; if (x.front) x.card = x.front; resetObj(x);
            if (x.token) break;
            G.players[x.owner].hand.push(x); log(`${it.name} returns to its owner's hand.`);
            break;
        }
        case 'lockReturned': if (G.lastReturned && onBf(G.lastReturned.uid) && onBf(src.uid)) { G.lastReturned.lockedBy = src.uid; log(`${G.lastReturned.card.name} can't attack or block while ${you(P) ? 'you control' : `${P.name} controls`} ${name}.`); } break;
        case 'exileGyMine': {
            const pool = P.gy.filter(x => cardFits(x, e.what)).sort((a, b) => creatureValueCard(b) - creatureValueCard(a));
            const x = pool[0];
            if (x) { pull(P.gy, x); x.exiledBy3 = src.uid; P.exile.push(x); log(`${name} exiles ${x.card.name} from the graveyard.`); }
            break;
        }
        case 'returnExiledByMe': {
            const back = P.exile.filter(x => x.exiledBy3 === src.uid);
            back.forEach(x => { pull(P.exile, x); delete x.exiledBy3; resetObj(x); if (!['instant', 'sorcery'].includes(Rx(x).kind)) { P.bf.push(x); fire('enters', { o: x }); if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: x, effects: Rx(x).etb }); } else P.gy.push(x); });
            log(`${back.length ? back.map(x => x.card.name).join(', ') : 'Nothing'} ${back.length === 1 ? 'returns' : 'return'} to the battlefield.`);
            break;
        }
        case 'asmoReturn': {
            const back = P.exile.filter(x => x.exiledBy2 === src.uid);
            back.forEach(x => { pull(P.exile, x); delete x.exiledBy2; P.hand.push(x); });
            P.life -= back.length;
            log(`${P.name} ${you(P) ? 'put' : 'puts'} ${back.length} card${back.length === 1 ? '' : 's'} into ${you(P) ? 'your' : 'their'} hand and ${you(P) ? 'lose' : 'loses'} ${back.length} life.`);
            break;
        }
        case 'selfToLibrary': {
            const X = G.players[src.owner];
            const zone = onBf(src.uid) ? null : X.gy.includes(src) ? 'gy' : null;
            if (onBf(src.uid)) leaveBattlefield(src, 'library');
            else if (zone) pull(X.gy, src);
            else break;
            const li = X.library.indexOf(src); if (li >= 0) X.library.splice(li, 1);
            if (e.pos === 'bottom') X.library.unshift(src); else X.library.splice(Math.max(0, X.library.length - (e.pos - 1)), 0, src);
            log(`${name} is put into its owner's library ${e.pos === 'bottom' ? 'on the bottom' : 'fifth from the top'}.`);
            break;
        }
        case 'copyLastCast': {
            const it = G.stack.slice().reverse().find(x => x.kind === 'spell' && x.o === G.lastCast);
            if (!it) break;
            const r = Rx(it.o);
            if (r.kind === 'instant' || r.kind === 'sorcery') G.stack.push({ id: stackSeq++, kind: 'trigger', o: it.o, P, target: it.target, effects: withX(spellEffects(it.o), it.x), name: `Copy of ${it.name}`, copy: true });
            else G.stack.push({ id: stackSeq++, kind: 'trigger', o: src, P, target: null, effects: [{ t: 'tokenCopyCard', card: it.o.card }], name: `Copy of ${it.name}`, copy: true });
            log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${it.name}.`);
            break;
        }
        case 'tokenCopyCard': tokenCopyOf(P, e.card); break;
        case 'offspringCopy': tokenCopyOf(P, src.copyOf || src.card, { p: 1, q: 1 }); break;
        case 'tokenCopy': if (t.o) for (let k = 0; k < (e.times || 1); k++) { const c = e.addType && !new RegExp(`\\b${e.addType}\\b`).test(t.o.card.type) ? { ...t.o.card, type: t.o.card.type.replace(/^(Legendary )?/, `$1${e.addType} `) } : e.flying ? { ...t.o.card, type: t.o.card.type.replace(/Legendary /, ''), text: `Flying\n${t.o.card.text || ''}` } : t.o.card; tokenCopyOf(P, c); } break;
        case 'arni': if (onBf(src.uid)) { const p = 1 + Math.max(0, ...P.bf.filter(x => isCreature(x) && x !== src).map(pow)); src.baseSet = { turn: G.turn, p, q: basePT(src, 'q') }; log(`${name}'s base power becomes ${p} until end of turn.`); } break;
        case 'stealWhile': {
            const x = t.o;
            if (!x || x.owner === P.i || !onBf(src.uid)) break;
            pull(G.players[x.owner].bf, x);
            x.realOwner = x.realOwner ?? x.owner; x.owner = P.i; x.stolenBy = src.uid; x.sick = true;
            P.bf.push(x);
            log(`${P.name} ${you(P) ? 'gain' : 'gains'} control of ${x.card.name} for as long as ${you(P) ? 'you control' : `${P.name} controls`} ${name}.`);
            break;
        }
        case 'landMana': if (t.o) { t.o.tempMana = { turn: G.turn }; log(`${t.o.card.name} taps for {G}{G}{G} this turn.`); } break;
        case 'exileHost': { const h = src.attachedTo && onBf(src.attachedTo); if (h) { log(`${h.card.name} is exiled.`); leaveBattlefield(h, 'exile'); } break; }
        case 'setBaseOtherAttacker': { const x = G.attackers.map(onBf).find(a => a && a !== src && a.owner === P.i); if (x) { x.baseSet = { turn: G.turn, p: e.p, q: e.q }; log(`${x.card.name}'s base power and toughness become ${e.p}/${e.q} until end of turn.`); } break; }
        case 'eternalize': {
            const c = src.front || src.card;
            tokenCopyOf(G.players[src.owner], { ...c, type: /\bZombie\b/.test(c.type) ? c.type : `${c.type} Zombie`, colors: ['B'], cost: '' }, { p: 4, q: 4 });
            break;
        }
        case 'unearth': {
            const X = G.players[src.owner];
            if (!X.gy.includes(src)) break;
            pull(X.gy, src); resetObj(src); X.bf.push(src);
            src.tkw.push('haste'); src.unearthed = true; src.exileAtEnd = G.turn;
            log(`${name} returns to the battlefield with haste (unearth).`);
            fire('enters', { o: src });
            if (Rx(src).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: src, effects: Rx(src).etb });
            break;
        }
        case 'revealToLand': {
            const shown = [];
            let land = null;
            while (P.library.length) { const x = P.library.pop(); if (/\bLand\b/.test(x.card.type)) { land = x; break; } shown.push(x); }
            if (land) { resetObj(land); land.tapped = true; P.bf.push(land); fire('landfall', { o: land }); }
            P.library.unshift(...shuffle(shown));
            log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${shown.length + (land ? 1 : 0)} card${shown.length + (land ? 1 : 0) === 1 ? '' : 's'}${land ? ` and ${you(P) ? 'put' : 'puts'} ${land.card.name} onto the battlefield tapped` : ''}.`);
            break;
        }
        case 'peer': {
            const X = t.p || P;
            const n = Math.ceil(X.library.length / 2), l = Math.ceil(X.life / 2);
            drawCards(X, n); X.life -= l;
            log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${l} life (half, rounded up).`);
            break;
        }
        case 'attachSelfToMade': if (onBf(src.uid) && G.lastMade && onBf(G.lastMade.uid)) { src.attachedTo = G.lastMade.uid; log(`${name} is attached to ${G.lastMade.card.name}.`); } break;
        case 'attachSelf': if (onBf(src.uid) && t.o && onBf(t.o.uid)) { src.attachedTo = t.o.uid; log(`${name} is attached to ${t.o.card.name}.`); } break;
        case 'attachEquipToSelf': if (onBf(src.uid) && t.o && onBf(t.o.uid)) { t.o.attachedTo = src.uid; log(`${t.o.card.name} is attached to ${name}.`); } break;
        case 'attachAllEquip': {
            if (!t.o || !onBf(t.o.uid)) break;
            const eqs = P.bf.filter(x => Rx(x).isEquipment && x.attachedTo !== t.o.uid);
            if (!eqs.length || !(P.isAI || await askYes(P, `${name}: attach ${eqs.length === 1 ? eqs[0].card.name : `all ${eqs.length} Equipment`} to ${t.o.card.name}?`, { card: src && src.card }))) break;
            eqs.forEach(x => { x.attachedTo = t.o.uid; });
            log(`${eqs.map(x => x.card.name).join(', ')} ${eqs.length === 1 ? 'is' : 'are'} attached to ${t.o.card.name}.`);
            break;
        }
        case 'destroyAttachedEquip': allPerms().filter(x => x.attachedTo === t.o.uid && Rx(x).isEquipment).forEach(x => destroy(x)); break;
        case 'baseFromSrc': if (onBf(src.uid) && t.o) { t.o.baseSet = { turn: G.turn, p: pow(src), q: tou(src) }; log(`${t.o.card.name} becomes ${pow(src)}/${tou(src)} until end of turn.`); } break;
        case 'permAnimate': if (onBf(src.uid)) { src.permAnimated = { what: e.what }; log(`${name} becomes a creature with power and toughness equal to ${e.what.replace(/^the number of /, 'the number of ')}.`); } break;
        case 'exileGyCreaturesCastable': {
            const got = O.gy.filter(x => /Creature/.test(x.card.type));
            got.forEach(x => { pull(O.gy, x); x.realOwner = x.owner; x.owner = P.i; x.playUntil = 1e9; x.anyMana = true; P.exile.push(x); });
            log(`${name} exiles ${got.length} creature card${got.length === 1 ? '' : 's'} from ${O.name === 'You' ? 'your' : `${O.name}'s`} graveyard - ${P.name === 'You' ? 'you' : P.name} may cast them.`);
            break;
        }
        case 'noop': break;
        case 'dmgBlockers': Object.entries(G.blocks).filter(([a]) => Number(a) === src.uid).flatMap(([, bs]) => bs).map(onBf).filter(Boolean).forEach(b => { damage(b, e.n, src); log(`${name} deals ${e.n} to ${b.card.name}.`); }); break;
        case 'detain': { const until = G.active === P.i ? G.turn + 2 : G.turn + 1; t.o.detainedUntil = until; log(`${t.o.card.name} is detained (it can't attack, block or use abilities until ${you(P) ? 'your' : `${P.name}'s`} next turn).`); break; }
        case 'setBase': t.o.baseSet = { turn: G.turn, p: e.p, q: e.q }; t.o.tkw.push(...e.kw); if (!isCreature(t.o)) t.o.animated = { turn: G.turn, p: e.p, q: e.q, kw: e.kw }; log(`${t.o.card.name} has base power and toughness ${e.p}/${e.q} until end of turn.`); break;
        case 'animateTarget': t.o.animated = { turn: G.turn, p: e.p, q: e.q, kw: e.kw }; log(`${t.o.card.name} becomes a ${e.p}/${e.q} creature until end of turn.`); break;
        case 'punisherSac': {
            const fod = O.bf.filter(isCreature).sort((a, b) => permValue(a) - permValue(b))[0];
            const sac = fod && (O.isAI ? permValue(fod) < e.n || O.life <= e.n : await askYes(O, `${name}: sacrifice ${fod.card.name}? (Cancel = take ${e.n} damage)`, { card: src && src.card }));
            if (sac) { log(`${O.name} ${you(O) ? 'sacrifice' : 'sacrifices'} ${fod.card.name}.`); dieOrLeave(fod, 'gy'); } else { damage(O, e.n, src); log(`${name} deals ${e.n} to ${O.name}.`); }
            break;
        }
        case 'smallHitDraw': P.drawOnSmallHit = G.turn; log(`This turn, ${you(P) ? 'your' : `${P.name}'s`} creatures with power 2 or less draw a card when they hit a player.`); break;
        case 'handToBottom': if (P.hand.length) { const d = P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0]; pull(P.hand, d); P.library.unshift(d); log(`${P.name} ${you(P) ? 'put' : 'puts'} a card on the bottom of the library.`); } break;
        case 'removeNamed': if (onBf(src.uid) && (src.ctr[e.kind] || 0) > 0) { src.ctr[e.kind]--; G.lastDo = true; log(`${name}: a ${e.kind} counter is removed.`); } else G.lastDo = false; break;
        case 'removeAnyCounter': { const x = P.bf.find(c => c.counters > 0 || Object.values(c.ctr || {}).some(v => v > 0)); if (x) { if (x.counters > 0) x.counters--; else { const k = Object.keys(x.ctr).find(k2 => x.ctr[k2] > 0); x.ctr[k]--; } G.lastDo = true; log(`A counter is removed from ${x.card.name}.`); } else G.lastDo = false; break; }
        case 'revealTop': { const top = P.library[P.library.length - 1]; G.revealed = top || null; if (top) log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name}.`); break; }
        case 'aegis': t.o.aegisBy = src.uid; log(`${t.o.card.name} gains indestructible for as long as ${you(P) ? 'you control' : `${P.name} controls`} ${name}.`); break;
        case 'attachEquipLast': { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; const eq = P.bf.find(a => Rx(a).isEquipment && a.attachedTo !== (x && x.uid)); if (x && eq && onBf(x.uid)) { eq.attachedTo = x.uid; log(`${eq.card.name} is attached to ${x.card.name}.`); } break; }
        case 'tapTypeDraw': {
            const ty = PLURAL_TYPES[e.type] || e.type;
            const cands = P.bf.filter(x => isCreature(x) && !x.tapped && hasType(x, ty) && !G.attackers.includes(x.uid));
            const n = cands.length && (P.isAI || await askYes(P, `${name}: tap ${cands.length} untapped ${e.type}${cands.length === 1 ? '' : 's'} to draw ${cands.length}?`, { card: src && src.card })) ? cands.length : 0;
            cands.slice(0, n).forEach(x => { x.tapped = true; });
            if (n) drawCards(P, n);
            break;
        }
        case 'odric': {
            const team = P.bf.filter(isCreature);
            const kws = ['first strike', 'flying', 'deathtouch', 'double strike', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'skulk', 'trample', 'vigilance'].filter(k => team.some(c => has(c, k)));
            team.forEach(c => c.tkw.push(...kws));
            if (kws.length) log(`${name}: creatures ${you(P) ? 'you control' : `${P.name} controls`} gain ${kws.join(', ')} until end of turn.`);
            break;
        }
        case 'exchange': {
            const mine = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o, theirs = t.o;
            if (!mine || !theirs || !onBf(mine.uid) || !onBf(theirs.uid)) break;
            const share = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker'].some(k => mine.card.type.includes(k) && theirs.card.type.includes(k));
            if (!share) { log('They don\'t share a card type - nothing happens.'); break; }
            const A = ctrl(mine), B = ctrl(theirs);
            pull(A.bf, mine); pull(B.bf, theirs);
            mine.owner = B.i; theirs.owner = A.i; A.bf.push(theirs); B.bf.push(mine);
            log(`${A.name} and ${B.name} exchange control of ${mine.card.name} and ${theirs.card.name}.`);
            break;
        }
        case 'extort': {
            // Extort (702.101): pay {W/B} - each opponent loses 1 life and you gain 1
            const plan = planPayment(P, { ...parseCost(''), W: 1 }) || planPayment(P, { ...parseCost(''), B: 1 });
            if (!plan || !(P.isAI ? P.hand.filter(x => canPay(P, x)).length === 0 || plan.length > 0 && G.phase !== 'main1' : await askYes(P, `${name}: extort - pay {W/B} to drain 1?`, { card: src && src.card }))) break;
            plan.forEach(x => tapSource(P, x));
            O.life -= 1; P.life += 1; fire('gainLife', { P, n: 1 });
            log(`${name} extorts: ${O.name} ${you(O) ? 'lose' : 'loses'} 1 life and ${P.name} ${you(P) ? 'gain' : 'gains'} 1.`);
            break;
        }
        case 'evolve': {
            const x = G.ctxObj;
            if (!x || !onBf(src.uid) || x === src) break;
            if (pow(x) > pow(src) || tou(x) > tou(src)) { src.counters++; log(`${name} evolves (+1/+1 counter).`); }
            break;
        }
        case 'returnSelfGy': {
            const X = G.players[src.owner];
            if (!X.gy.includes(src)) break;
            pull(X.gy, src);
            if (e.bf) { resetObj(src); src.tapped = !!e.tapped; X.bf.push(src); log(`${name} returns to the battlefield${e.tapped ? ' tapped' : ''}.`); fire('enters', { o: src }); if (Rx(src).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: src, effects: Rx(src).etb }); }
            else { X.hand.push(src); log(`${name} returns to ${you(X) ? 'your' : `${X.name}'s`} hand.`); }
            break;
        }
        case 'tapHost': { const h = src.attachedTo && onBf(src.attachedTo); if (h) { h.tapped = true; log(`${h.card.name} is tapped.`); } break; } // just the target, for the next effect ("target creature you control deals damage...")
        case 'biteDmg': case 'powDmg': {
            const from = e.t === 'powDmg' && Rx(src).kind === 'creature' ? src : G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o;
            if (!from || (e.t === 'biteDmg' && !onBf(from.uid))) break;
            const n = Math.max(0, pow(from)) * (e.mult || 1);
            const to = t.p || t.o;
            G.lastExcess = t.o && isCreature(t.o) ? Math.max(0, n - Math.max(0, tou(t.o) - t.o.dmg)) : 0; // Contest of Claws
            damage(to, n, from); log(`${from.card.name} deals ${n} damage to ${targetName(t)}.`);
            break;
        }
        case 'fightLast': {
            const champ = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o;
            if (!champ || !onBf(champ.uid) || !onBf(t.o.uid)) break;
            log(`${champ.card.name} fights ${t.o.card.name}.`);
            damage(t.o, pow(champ), champ); damage(champ, pow(t.o), t.o);
            break;
        }
        case 'counterPowDmg': if (G.lastCountered && G.lastCountered.kind === 'spell') { const n = Number(G.lastCountered.o.card.power) || 0, X = G.lastCountered.P; damage(X, n, src); log(`${name} deals ${n} to ${X.name}.`); } break;
        case 'oppPump': O.bf.filter(isCreature).forEach(c => { c.tp += e.p; c.tq += e.q; }); log(`Creatures ${O.name === 'You' ? 'you control' : `${O.name} controls`} get ${e.p >= 0 ? '+' : ''}${e.p}/${e.q >= 0 ? '+' : ''}${e.q} until end of turn.`); break;
        case 'doublePower': P.bf.filter(isCreature).forEach(c => { c.tp += Math.max(0, pow(c)); }); log('Each creature\'s power is doubled until end of turn.'); break;
        case 'groundCantBlock': allPerms().filter(c => isCreature(c) && !has(c, 'flying')).forEach(c => c.tkw.push('cantblock')); log('Creatures without flying can\'t block this turn.'); break;
        case 'lastAllKw': (G.lastTargets || []).forEach(x => { if (x.o && onBf(x.o.uid)) x.o.tkw.push(...e.kw); }); break;
        case 'moveCounters': { const from = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; if (from && onBf(from.uid) && from.counters > 0) { t.o.counters += from.counters; log(`${from.counters} +1/+1 counter${from.counters === 1 ? '' : 's'} move from ${from.card.name} to ${t.o.card.name}.`); from.counters = 0; } break; }
        case 'revealHand': log(`${O.name} ${you(O) ? 'reveal' : 'reveals'} ${you(O) ? 'your' : 'their'} hand: ${O.hand.map(x => x.card.name).join(', ') || 'nothing'}.`); break;
        case 'millToLand': {
            const X = G.lastPower ? G.lastPower.P : O, gone = [];
            while (X.library.length) { const c = X.library.pop(); gone.push(c); X.gy.push(c); if (/\bLand\b/.test(c.card.type)) break; }
            log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${gone.length} card${gone.length === 1 ? '' : 's'} to a land and ${you(X) ? 'put' : 'puts'} them into the graveyard.`);
            break;
        }
        case 'fogSelf': P.fogSelf = G.turn; log(`Combat damage that would be dealt to ${P.name === 'You' ? 'you' : P.name} this turn is prevented.`); break;
        case 'fogNoCounters': G.fogNoCounters = G.turn; log('Combat damage from creatures with no +1/+1 counters is prevented this turn.'); break;
        case 'draw': drawCards(P, e.n); break;
        case 'gain': if (e.caveOnly && !(G.lastPutLand && hasType(G.lastPutLand, 'Cave'))) break; if (e.n <= 0) break; e = { ...e, n: e.n + lifeGainBonus(P) }; P.life += e.n; log(`${P.name} ${you(P) ? 'gain' : 'gains'} ${e.n} life.`); fire('gainLife', { P, n: e.n }); break;
        // ---- Top-1000 round 2 (2026-10-07) ----
        case 'minusCounters': { const x = t && t.o; if (!x || !onBf(x.uid)) break; x.counters -= e.n; log(`${x.card.name} gets ${e.n === 1 ? 'a -1/-1 counter' : `${e.n} -1/-1 counters`}.`); break; }
        case 'doubleCountersAll': { const hit = P.bf.filter(c => isCreature(c) && c.counters > 0); hit.forEach(c => putCounters(c, c.counters, P)); log(`${name}: +1/+1 counters doubled on ${hit.length ? hit.map(c => c.card.name).join(', ') : 'nothing'}.`); break; }
        case 'sacColored': G.players.forEach(X => { const hit = X.bf.filter(x => (x.card.colors || []).length); if (hit.length) log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${hit.map(x => x.card.name).join(', ')}.`); hit.forEach(x => { fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); }); }); break;
        case 'exileGraveyards': G.players.forEach(X => { X.exile.push(...X.gy.splice(0)); }); log(`${name}: all graveyards are exiled.`); break;
        case 'doubleTeam': P.bf.filter(isCreature).forEach(c => { c.tp += pow(c); c.tq += tou(c); }); log(`${name}: creatures ${you(P) ? 'you control' : `${P.name} controls`} double their power and toughness until end of turn.`); break;
        case 'adapt': if (src && onBf(src.uid) && src.counters <= 0) { putCounters(src, e.n, P); log(`${src.card.name} adapts: ${e.n} +1/+1 counters.`); } else log(`${name}: it already has +1/+1 counters, so adapt does nothing.`); break;
        case 'eachLoses': G.players.forEach(X => { X.life -= e.n; }); log(`Each player loses ${e.n} life.`); break;
        case 'selfToTop': if (src && onBf(src.uid)) { leaveBattlefield(src, 'library'); log(`${src.card.name} is put on top of ${you(P) ? 'your' : `${P.name}'s`} library.`); } break;
        case 'sacLands': { const ls = await chooseSacN(P, P.bf.filter(x => /\bLand\b/.test(x.card.type) && x !== src), e.n, name); const pick = ls.length < e.n && src && /\bLand\b/.test(src.card.type) ? [...ls, src] : ls; if (pick.length) log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${pick.map(x => x.card.name).join(', ')}.`); pick.forEach(x => { fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); }); break; }
        case 'roll': { const rolls = Array.from({ length: e.dice || 1 }, () => 1 + rand(e.sides)); G.lastRoll = rolls.reduce((a, b) => a + b, 0); log(`${P.name} ${you(P) ? 'roll' : 'rolls'} ${e.dice ? `${e.dice}d${e.sides}: ${rolls.join(' + ')} = ${G.lastRoll}` : `a d${e.sides}: ${G.lastRoll}`}.`); break; }
        case 'fightSelf': { const x = t && t.o; if (!x || !src || !onBf(src.uid) || !onBf(x.uid)) break; const a = Math.max(0, pow(src)), b = Math.max(0, pow(x)); damage(x, a, src); damage(src, b, x); log(`${src.card.name} fights ${x.card.name}.`); break; }
        case 'attachCtx': { const eq = G.ctxObj, x = t && t.o; if (!eq || !x || !onBf(eq.uid) || !Rx(eq).isEquipment) break; eq.attachedTo = x.uid; log(`${eq.card.name} is attached to ${x.card.name}.`); break; }
        case 'tributeTree': { const x = G.ctxObj; if (!x || !onBf(x.uid)) break; if (pow(x) >= 3) drawCards(P, 1); else { putCounters(x, 2, P); log(`${x.card.name} gets two +1/+1 counters.`); } break; }
        case 'heraldHorn': { const top = P.library[P.library.length - 1]; if (!top) break; const ty = chosenTypeOf(src); if (/Creature/.test(top.card.type) && hasType(top, ty) && (P.isAI || await askYes(P, `${name}: put ${top.card.name} (a ${ty}) from the top of your library into your hand?`, { card: top.card }))) { P.library.pop(); P.hand.push(top); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand.`); } else log(`${name}: ${P.isAI || !you(P) ? 'the top card stays.' : `the top card is ${top.card.name}.`}`); break; }
        case 'fabricate': if (src && onBf(src.uid) && (P.isAI ? isCreature(src) : await askYes(P, `Fabricate ${e.n}: put ${e.n} +1/+1 counter${e.n === 1 ? '' : 's'} on ${src.card.name}?`, { card: src.card, no: `Make ${e.n === 1 ? 'a 1/1 Servo' : `${e.n} 1/1 Servos`} instead` }))) { putCounters(src, e.n, P); log(`${src.card.name}: fabricate, ${e.n} +1/+1 counter${e.n === 1 ? '' : 's'}.`); } else await applyEffect(P, { t: 'token', n: e.n, p: 1, q: 1, name: 'colorless Servo', artifact: true, kw: [] }, null, src); break;
        case 'loseSelf': P.life -= e.n; log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${e.n} life.`); break;
        case 'drain': O.life -= e.n; G.lastLost = e.n; log(`${O.name} ${you(O) ? 'lose' : 'loses'} ${e.n} life.`); break;
        case 'discard':
            for (let k = 0; k < e.n && O.hand.length; k++) { const d = O.hand.splice(rand(O.hand.length), 1)[0]; O.gy.push(d); d.discardTurn = G.turn; discardByOpp(d, P); log(`${O.name} ${you(O) ? 'discard' : 'discards'} ${d.card.name} (at random).`); }
            break;
        case 'mill': {
            const milled = O.library.splice(-e.n).reverse();
            O.gy.push(...milled);
            log(`${O.name} ${you(O) ? 'mill' : 'mills'} ${milled.length}${milled.length ? `: ${milled.map(x => x.card.name).join(', ')}` : ''}.`);
            break;
        }
        case 'pump':
            if (e.target === 'self') { if (!onBf(src.uid)) break; t = { o: src }; }
            if (e.exileDies) t.o.exileOnDeath = G.turn;
            t.o.tp += e.p; t.o.tq += e.q; t.o.tkw.push(...e.kw);
            log(`${t.o.card.name} gets ${e.p >= 0 ? '+' : ''}${e.p}/${e.q >= 0 ? '+' : ''}${e.q}${e.kw.length ? ` and ${e.kw.join(', ')}` : ''} until end of turn.`);
            break;
        case 'token':
            if (e.forLastCtrl) { const X = G.lastPower ? G.lastPower.P : O; await applyEffect(X, { ...e, forLastCtrl: false }, null, src); break; }
            if (tokenMult(P) > 1 && !e.doubled) { await applyEffect(P, { ...e, n: e.n * tokenMult(P), doubled: true }, t, src); break; }
            const madeNow = [];
            for (let k = 0; k < e.n; k++) {
                const words = e.name.split(' ');
                const colors = words.filter(w => Object.values(COLOR_NAMES).includes(w)).map(w => Object.keys(COLOR_NAMES).find(k2 => COLOR_NAMES[k2] === w));
                const sub = words.filter(w => !Object.values(COLOR_NAMES).includes(w) && w !== 'and' && w !== 'colorless').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Creature';
                const card = { id: `token-${uidSeq}`, name: e.named || `${sub} token`, fullName: e.named || `${sub} token`, cost: '', cmc: 0, type: `Token ${e.artifact ? 'Artifact ' : ''}Creature — ${sub}`, text: [e.kw.map(k2 => k2[0].toUpperCase() + k2.slice(1)).join(', '), e.text || ''].filter(Boolean).join('\n'), power: String(e.p), toughness: String(e.q), colors, ci: colors, img: null, imgS: null, legal: {} };
                const tok = makeObj(card, P.i, { token: true });
                if (e.tkw) tok.tkw.push(...e.tkw);
                P.bf.push(tok);
                G.lastMade = tok;
                madeNow.push(tok);
                fire('enters', { o: tok });
            }
            log(`${P.name} ${you(P) ? 'create' : 'creates'} ${e.n} ${e.p}/${e.q} ${e.named || e.name} token${e.n === 1 ? '' : 's'}${e.attacking ? ', tapped and attacking' : ''}.`);
            if (e.attacking) madeNow.forEach(tk => { tk.tapped = true; if (!G.attackers.includes(tk.uid)) G.attackers.push(tk.uid); });
            if (e.sacEndCombat) madeNow.forEach(tk => { tk.sacEndCombat = true; });
            if (e.sacEnd) madeNow.forEach(tk => { tk.sacAtEnd = G.turn; });
            tokenMade(P);
            break;
        case 'counters': {
            const target = e.target === 'self' ? src : t.o;
            if (!onBf(target.uid)) break;
            const got = putCounters(target, e.n, P);
            log(`${target.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`);
            // Backup (702.165): another creature also gets the abilities printed below it until end of turn
            if (e.backup && target !== src) { target.tkw.push(...(Rx(src).backupKw || [])); if ((Rx(src).backupKw || []).length) log(`${target.card.name} gains ${Rx(src).backupKw.join(', ')} until end of turn (backup).`); }
            break;
        }
        case 'tap': { t.o.tapped = true; const st = e.stun === true ? 1 : e.stun || 0; if (st) t.o.ctr.stun = (t.o.ctr.stun || 0) + st; log(`${t.o.card.name} is tapped${st ? ` and gets ${st === 1 ? 'a stun counter' : `${st} stun counters`}` : ''}.`); break; }
        case 'untap': t.o.tapped = false; log(`${t.o.card.name} untaps.`); break;
        case 'animate': if (onBf(src.uid)) { src.animated = { turn: G.turn, p: e.p, q: e.q, kw: e.kw }; log(`${src.card.name} becomes a ${e.p}/${e.q} creature until end of turn.`); } break;
        case 'exileTop': {
            const got = P.library.splice(-e.n).reverse();
            got.forEach(x => { P.exile.push(x); if (e.play !== undefined) x.playUntil = G.turn + e.play; if (e.playWhile) x.playWhile = src.uid; if (e.playDmg) { x.playDmg = e.playDmg; x.playDmgSrc = src.uid; } });
            log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${got.map(x => x.card.name).join(', ') || 'nothing'} from the top of the library${e.play !== undefined ? ` (playable ${e.play ? 'until the end of the next turn' : 'this turn'})` : ''}.`);
            break;
        }
        case 'extraTurn': G.extra = G.extra || [0, 0]; G.extra[P.i]++; log(`${P.name} will take an extra turn after this one.`); break;
        case 'transform': {
            if (!onBf(src.uid) || !src.front || !src.front.back) break;
            const was = src.card.name;
            src.card = src.card === src.front ? src.front.back : src.front;
            log(`${was} transforms into ${src.card.name}.`);
            break;
        }
        case 'revealTransform': {
            const top = P.library[P.library.length - 1];
            if (!top || !onBf(src.uid) || !src.front || !src.front.back) break;
            if (cardFits(top, e.what)) { log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name}.`); const was = src.card.name; src.card = src.card === src.front ? src.front.back : src.front; log(`${was} transforms into ${src.card.name}.`); }
            break;
        }
        case 'exileReturnTransformed': {
            if (!onBf(src.uid) || !src.front || !src.front.back) break;
            leaveBattlefield(src, 'exile');
            const X = G.players[src.owner];
            pull(X.exile, src);
            resetObj(src);
            src.card = src.front.back;
            X.bf.push(src);
            log(`${src.front.name} returns transformed as ${src.card.name}.`);
            fire('enters', { o: src });
            if (Rx(src).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: src, effects: Rx(src).etb });
            break;
        }
        case 'untapLands': P.bf.filter(x => /\bLand\b/.test(x.card.type)).forEach(x => { x.tapped = false; }); log(`${P.name} ${you(P) ? 'untap' : 'untaps'} all lands.`); break;
        case 'freezeLast': (G.lastTargets || []).forEach(x => { if (x.o && onBf(x.o.uid)) { x.o.skipUntap = true; } }); log(`${(G.lastTargets || []).filter(x => x.o).map(x => x.o.card.name).join(', ')} won't untap next time.`); break;
        case 'protChoice': {
            const cnt = {};
            O.bf.concat(O.hand).forEach(x => (x.card.colors || []).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }));
            const c = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'R';
            t.o.tkw.push(`pro:${c}`);
            log(`${t.o.card.name} gains protection from ${COLOR_NAMES[c]} until end of turn.`);
            break;
        }
        case 'untapSelf': if (onBf(src.uid)) { src.tapped = false; log(`${src.card.name} untaps.`); } break;
        case 'exileSelf': if (onBf(src.uid)) { log(`${src.card.name} is exiled.`); leaveBattlefield(src, 'exile'); } else if (['instant', 'sorcery'].includes(Rx(src).kind)) src.exileAfter = true; break;
        case 'namedCounter': if (onBf(src.uid)) { src.ctr[e.kind] = (src.ctr[e.kind] || 0) + e.n; log(`${src.card.name} gets ${e.n} ${e.kind} counter${e.n === 1 ? '' : 's'}.`); } break;
        case 'regen': if (onBf(src.uid)) { src.regen = (src.regen || 0) + 1; log(`${src.card.name} gets a regeneration shield.`); } break;
        case 'millSelf': { const milled = P.library.splice(-e.n).reverse(); P.gy.push(...milled); log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.length}.`); break; }
        case 'allPump': allPerms().filter(isCreature).forEach(c => { c.tp += e.p; c.tq += e.q; }); log(`All creatures get ${e.p >= 0 ? '+' : ''}${e.p}/${e.q >= 0 ? '+' : ''}${e.q} until end of turn.`); break;
        case 'fog': if (G.noPrevent === G.turn) { log('Damage can\'t be prevented this turn.'); break; } G.fog = G.turn; log('All combat damage this turn will be prevented.'); break;
        case 'untapLandsN': { const ls = P.bf.filter(x => x.tapped && /\bLand\b/.test(x.card.type)).slice(0, e.n); ls.forEach(x => { x.tapped = false; }); log(`${P.name} ${you(P) ? 'untap' : 'untaps'} ${ls.length} land${ls.length === 1 ? '' : 's'}.`); break; }
        case 'extraLand': P.extraLandTurn = G.turn; log(`${P.name} may play an additional land this turn.`); break;
        case 'bounceOwnLand': {
            // Karoo lands: return a land (a tapped one, the cheapest kind, first)
            const ls = P.bf.filter(x => /\bLand\b/.test(x.card.type)).sort((a, b) => (b.tapped - a.tapped) || (isBasic(b.card) - isBasic(a.card)) || ((a === src) - (b === src)));
            const l = ls[0];
            if (l) { leaveBattlefield(l, 'hand'); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${l.card.name} to hand.`); }
            break;
        }
        case 'tapAll': allPerms().filter(x => isCreature(x) && (e.who === 'all' || x.owner !== P.i)).forEach(x => { x.tapped = true; }); log(`${e.who === 'all' ? 'All creatures are' : `${G.players[1 - P.i].name}'s creatures are`} tapped.`); break;
        case 'noPrevent': G.noPrevent = G.turn; if (G.fog === G.turn) G.fog = null; log('Damage can\'t be prevented this turn.'); break;
        case 'exileGy': { const n = e.all ? O.gy.length : Math.min(e.n || 1, O.gy.length); const gone = O.gy.splice(0, n); O.exile.push(...gone); log(`${name} exiles ${gone.length ? gone.map(x => x.card.name).join(', ') : 'nothing'} from ${O.name}'s graveyard.`); break; }
        case 'steal': {
            // Threaten effects: you control it until end of turn, untapped and with haste
            const x = t.o;
            if (x.owner === P.i) break;
            pull(G.players[x.owner].bf, x);
            x.realOwner = x.realOwner ?? x.owner;
            x.owner = P.i; x.tapped = false; x.tkw.push('haste'); x.stolenTurn = G.turn;
            P.bf.push(x);
            log(`${P.name} ${you(P) ? 'gain' : 'gains'} control of ${x.card.name} until end of turn.`);
            break;
        }
        case 'wipe': {
            const hit = allPerms().filter(x => wipeMatches(x, e.what, P));
            log(`${name}: ${e.how === 'exile' ? 'exile' : 'destroy'} all ${e.what} (${hit.length}).`);
            G.lastWipeN = 0;
            hit.forEach(x => { if (e.how === 'exile') { leaveBattlefield(x, 'exile'); G.lastWipeN++; } else if (!has(x, 'indestructible')) { if (e.noRegen) x.regen = 0; if (x.regen) destroy(x); else { dieOrLeave(x, 'gy'); G.lastWipeN++; } } }); // regeneration shields work unless "can't be regenerated"
            break;
        }
        case 'creaturesHitOwners': allPerms().filter(isCreature).forEach(c => damage(ctrl(c), e.n, c)); log(`Each creature deals ${e.n} damage to its controller.`); break;
        case 'massBounce': {
            const hit = allPerms().filter(x => wipeMatches(x, e.what, P));
            log(`${name}: return all ${e.what} to their owners' hands (${hit.length}).`);
            hit.forEach(x => leaveBattlefield(x, 'hand'));
            break;
        }
        case 'teamPump':
            if (e.other) { P.bf.filter(c => isCreature(c) && c !== src).forEach(c => { c.tp += e.p; c.tq += e.q; c.tkw.push(...e.kw); }); log(`Other creatures ${P.name === 'You' ? 'you control' : `${P.name} controls`} get +${e.p}/+${e.q} until end of turn.`); break; }
            if (e.xFrom) { const x = e.xFrom === 'greatestPower' ? Math.max(0, ...P.bf.filter(isCreature).map(pow)) : P.bf.filter(isCreature).length; e = { ...e, p: x, q: x }; }
            P.bf.filter(c => isCreature(c) && (!e.type || hasType(c, e.type)) && !(e.notType && hasType(c, e.notType)) && (!e.attacking || G.attackers.includes(c.uid)) && (!e.minPow || pow(c) >= e.minPow) && (!e.withCounter || c.counters > 0)).forEach(c => { c.tp += e.p; c.tq += e.q; c.tkw.push(...e.kw); });
            log(`Creatures ${P.name === 'You' ? 'you control' : `${P.name} controls`} get +${e.p}/+${e.q}${e.kw.length ? ` and ${e.kw.join(', ')}` : ''} until end of turn.`);
            break;
        case 'teamCounters': {
            const hit = P.bf.filter(c => isCreature(c) && (!e.withCounter || c.counters > 0) && (!e.attacking || G.attackers.includes(c.uid)) && !(e.other && c === src) && (!e.tokenOr || c.token || hasType(c, e.tokenOr)) && (!e.type || hasType(c, e.type)));
            hit.forEach(c => putCounters(c, e.n, P));
            log(`${hit.length ? hit.map(c => c.card.name).join(', ') : 'Nothing'} ${hit.length === 1 ? 'gets' : 'get'} ${e.n} +1/+1 counter${e.n === 1 ? '' : 's'}.`);
            break;
        }
        case 'proliferate':
            allPerms().forEach(x => { if (x.counters > 0 && x.owner === P.i) x.counters++; else if (x.counters < 0 && x.owner !== P.i) x.counters--; Object.keys(x.ctr || {}).forEach(k => { if (x.owner === P.i) x.ctr[k]++; }); });
            if (O.poison) O.poison++;
            log(`${P.name} ${you(P) ? 'proliferate' : 'proliferates'}.`);
            break;
        case 'edict': {
            const victims = e.who === 'each player' ? G.players : [O];
            G.lastEdictN = 0;
            G.edictDid = [true, true];
            for (const V of victims) {
                G.edictDid[V.i] = false;
                let pool = V.bf.filter(x => e.what === 'creature' || e.what === 'creature or planeswalker' ? isCreature(x) || Rx(x).kind === 'planeswalker' : permMatches(x, e.what, V)).sort((a, b) => permValue(a) - permValue(b));
                if (e.leastPow && pool.length) { const lo = Math.min(...pool.filter(isCreature).map(pow)); pool = pool.filter(x => isCreature(x) && pow(x) === lo); }
                if (!pool.length) continue;
                // Each player chooses what they sacrifice (701.21a)
                const f = (V.isAI || AUTOPLAY || pool.length === 1 ? null : await pickCard(V, pool, `${name}: choose what to sacrifice`, { required: true })) || pool[0];
                G.edictDid[V.i] = true; log(`${V.name} ${you(V) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); G.lastEdictN++; fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            }
            break;
        }
        case 'loot': {
            drawCards(P, e.n);
            noteDiscard(P, Math.min(e.d, P.hand.length));
            for (let k = 0; k < e.d && P.hand.length; k++) { const d = P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`); }
            break;
        }
        case 'drawAll': G.players.forEach(X => drawCards(X, e.n)); break;
        // ---- X spells (2026-10-06) ----
        case 'shuffleSelfIn': src.shuffleIn = true; break;
        // ---- Landfall (2026-10-06) ----
        case 'tokenCopySelf': if (onBf(src.uid) || src.card) { if (tokenMult(P) > 1 && !e.doubled) { for (let k = 0; k < tokenMult(P); k++) tokenCopyOf(P, src.front || src.card); } else tokenCopyOf(P, src.front || src.card); } break;
        case 'tapOrUntap': if (t && t.o) { t.o.tapped = t.o.owner === P.i ? false : true; log(`${t.o.card.name} is ${t.o.tapped ? 'tapped' : 'untapped'}.`); } break;
        case 'doublePow': { const c = e.target === 'self' ? (onBf(src.uid) ? src : null) : t && t.o; if (c) { const add = Math.max(0, pow(c)); c.tp += add; log(`${c.card.name}'s power is doubled (+${add}/+0) until end of turn.`); } break; }
        case 'hostPump': { const h = src.attachedTo && onBf(src.attachedTo); if (h) { h.tp += e.p; h.tq += e.q; log(`${h.card.name} gets +${e.p}/+${e.q} until end of turn.`); } break; }
        case 'animateLand': if (t && t.o) { t.o.animated = { turn: G.turn, p: e.p, q: e.q, kw: e.kw }; t.o.sick = false; log(`${t.o.card.name} becomes a ${e.p}/${e.q} creature until end of turn.`); } break;
        case 'baseSelf': if (onBf(src.uid)) { src.baseSet = { turn: G.turn, p: e.p, q: e.q }; log(`${src.card.name} is ${e.p}/${e.q} until end of turn.`); } break;
        case 'energy': P.energy = (P.energy || 0) + e.n; log(`${P.name} ${you(P) ? 'get' : 'gets'} ${e.n} energy (${P.energy}).`); break;
        case 'exileMadeAtEnd': if (G.lastMade) G.lastMade.exileAtEnd = G.turn; break;
        case 'topCreatureElseGy': { const top = P.library[P.library.length - 1]; if (!top) break; if (/Creature/.test(top.card.type)) { P.library.pop(); P.hand.push(top); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name} and ${you(P) ? 'put' : 'puts'} it in hand.`); } else if (P.isAI || AUTOPLAY ? Rx(top).kind !== 'land' : await askYes(P, `${name}: put ${top.card.name} into your graveyard? (Cancel = leave it on top.)`, { card: src && src.card })) { P.library.pop(); P.gy.push(top); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${top.card.name} into the graveyard.`); } break; }
        case 'massReanimate': { const back = P.gy.filter(x => cardFits(x, e.what)); back.forEach(x => putOntoBattlefield(P, x, false)); log(`${back.length} card${back.length === 1 ? '' : 's'} return to the battlefield.`); break; }
        case 'millAll': G.players.forEach(X => { const milled = X.library.splice(-e.n).reverse(); X.gy.push(...milled); log(`${X.name} ${you(X) ? 'mill' : 'mills'} ${milled.length}.`); }); break;
        case 'edictN': for (let k = 0; k < e.n; k++) await applyEffect(P, { t: 'edict', who: e.who || 'each player', what: 'creature' }, null, src); break;
        case 'dmgSweep': {
            const hit = allPerms().filter(c => isCreature(c) && (e.filt === 'all' || (e.filt === 'noFly' ? !has(c, 'flying') : e.filt === 'fly' ? has(c, 'flying') : !/Artifact/.test(c.card.type))));
            hit.forEach(c => damage(c, e.n, src));
            if (e.players) G.players.forEach(X => damage(X, e.n, src));
            log(`${name} deals ${e.n} damage to ${hit.length} creature${hit.length === 1 ? '' : 's'}${e.players ? ' and each player' : ''}.`);
            break;
        }
        case 'minusEach': allPerms().filter(isCreature).forEach(c => { c.counters -= e.n; }); log(`Each creature gets ${e.n} -1/-1 counter${e.n === 1 ? '' : 's'}.`); break;
        case 'stealPerm': { const from = G.players[t.o.owner]; if (from === P) break; pull(from.bf, t.o); t.o.realOwner = t.o.realOwner ?? t.o.owner; t.o.owner = P.i; t.o.sick = true; P.bf.push(t.o); log(`${P.name} ${you(P) ? 'gain' : 'gains'} control of ${t.o.card.name}.`); break; }
        // ---- Top-1000 round (2026-10-06) ----
        case 'discardIfNoSac': G.players.forEach(X => { if ((G.edictDid || [true, true])[X.i] || !X.hand.length) return; const d = X.hand.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b))[0]; pull(X.hand, d); X.gy.push(d); d.discardTurn = G.turn; noteDiscard(X, 1); log(`${X.name} couldn't sacrifice, so ${you(X) ? 'discard' : 'discards'} ${d.card.name}.`); }); break;
        case 'lootAll': G.players.forEach(X => { drawCards(X, 1); if (!X.hand.length) return; const d = X.hand.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b))[0]; pull(X.hand, d); X.gy.push(d); d.discardTurn = G.turn; noteDiscard(X, 1); log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${d.card.name}.`); }); break;
        case 'ctxPowDmg': { const from = G.ctxObj && onBf(G.ctxObj.uid) ? G.ctxObj : src; const n = Math.max(0, pow(from)); if (!n || !t) break; damage(t.p || t.o, n, from); log(`${from.card.name} deals ${n} damage to ${targetName(t)}.`); break; }
        case 'cmdToHand': { const c = P.command.find(x => x.isCommander); if (c) { pull(P.command, c); P.hand.push(c); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand from the command zone.`); } break; }
        case 'foodOrTreasure': { const needMana = P.hand.some(h => Rx(h).kind !== 'land' && !canPay(P, h)); const kind = P.isAI || AUTOPLAY ? (needMana || P.life > 12 ? 'treasure' : 'food') : (await askYes(P, `${name}: create a Treasure token? (Cancel = a Food token.)`, { card: src && src.card }) ? 'treasure' : 'food'); applyEffect(P, { t: 'artToken', n: 1, kind }, null, src); break; }
        case 'activeDraws': drawCards(G.players[G.active], e.n); break;
        case 'enduring': { const X = G.players[src.owner]; if (!X.gy.includes(src)) break; pull(X.gy, src); resetObj(src); src.enchOnly = true; X.bf.push(src); log(`${src.card.name} returns to the battlefield as an enchantment (it's not a creature).`); fire('enters', { o: src }); break; }
        case 'loseAll': G.players.forEach(X => { X.life -= e.n; }); log(`Each player loses ${e.n} life.`); break;
        case 'discardAll': G.players.forEach(X => { for (let k = 0; k < e.n && X.hand.length; k++) { const d = X.hand.splice(rand(X.hand.length), 1)[0]; X.gy.push(d); d.discardTurn = G.turn; log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${d.card.name} (at random).`); } }); break;
        case 'artToken': if (e.forLastCtrl) { await applyEffect(G.lastPower ? G.lastPower.P : O, { ...e, forLastCtrl: false }, null, src); break; } if (e.n <= 0) break;
            if (!e.doubled && (tokenMult(P) > 1 || (e.kind === 'treasure' && P.bf.some(a => Rx(a).extraTreasure)))) { await applyEffect(P, { ...e, n: e.n * tokenMult(P) + (e.kind === 'treasure' ? P.bf.filter(a => Rx(a).extraTreasure && !lostAbilities(a)).length : 0), doubled: true }, t, src); break; }
            { const mf = ['clue', 'food', 'treasure'].includes(e.kind) && !e.mf ? P.bf.filter(a => Rx(a).manufactor && !lostAbilities(a)).length : 0; if (mf) { for (const k2 of ['clue', 'food', 'treasure']) await applyEffect(P, { ...e, kind: k2, n: e.n * 3 ** (mf - 1), mf: true, doubled: true }, t, src); break; } }
            for (let k = 0; k < e.n; k++) { G.lastMade = makeArtifactToken(P, e.kind); if (e.tapped) G.lastMade.tapped = true; } log(`${P.name} ${you(P) ? 'create' : 'creates'} ${e.n} ${ART_TOKENS[e.kind].name} token${e.n === 1 ? '' : 's'}.`); tokenMade(P); break;
        case 'selfBounce':
            if (onBf(src.uid)) { log(`${src.card.name} returns to its owner's hand.`); leaveBattlefield(src, 'hand'); }
            else { const owner = G.players[src.owner]; if (owner.gy.includes(src)) { pull(owner.gy, src); owner.hand.push(src); log(`${src.card.name} returns to ${you(owner) ? 'your' : `${owner.name}'s`} hand.`); } }
            break;
        case 'sacSelf': if (onBf(src.uid)) { log(`${src.card.name} is sacrificed.`); dieOrLeave(src, 'gy'); } break;
        case 'fight': {
            const champ = e.self ? (onBf(src.uid) ? src : null) : P.bf.filter(isCreature).sort((a, b) => pow(b) - pow(a))[0];
            if (!champ || !onBf(t.o.uid)) { log(`${name}: nothing to fight with.`); break; }
            log(`${champ.card.name} fights ${t.o.card.name}.`);
            damage(t.o, pow(champ), champ);
            damage(champ, pow(t.o), t.o);
            break;
        }
        case 'addMana': {
            let cols = e.fromN ? Array(Math.max(0, e.n || 0)).fill(e.color) : e.opts ? e.opts.slice().sort((a, b) => b.reduce((n, c) => n + (c === bestPoolColor(P) ? 2 : bestPoolColor(P, a.concat(b)) === c ? 1 : 0), 0) - a.reduce((n, c) => n + (c === bestPoolColor(P) ? 2 : bestPoolColor(P, a.concat(b)) === c ? 1 : 0), 0))[0].slice() : e.mana || (e.count ? Array(countFn(e.count)(src)).fill(e.color) : e.choice ? Array(e.each ? Math.max(0, e.n || 0) : 1).fill(bestPoolColor(P, e.choice)) : Array(e.anyPow ? Math.max(0, pow(src)) : e.anyN ? Math.max(0, e.n || 0) : e.any).fill(bestPoolColor(P)));
            if (e.only) cols = cols.map(c => `${c}:${e.only}`);
            P.pool = (P.pool || []).concat(cols);
            log(`${P.name} ${you(P) ? 'add' : 'adds'} ${cols.map(c => `{${c[0]}}`).join('')}${e.only ? ` (only for ${e.only} spells and abilities)` : ''} (until the step ends).`);
            break;
        }
        case 'discover': await cascade(P, src, e.n); break;
        // ---- Brudiclad deck (2026-10-07) ----
        case 'dmgOpp': if (e.n > 0) { damage(O, e.n, src); log(`${name} deals ${e.n} damage to ${O.name === 'You' ? 'you' : O.name}.`); } break;
        case 'emryMark': { const pool = P.gy.filter(x => /\bArtifact\b/.test(x.card.type) && Rx(x).support !== 'none'); const pick = P.isAI ? pool.filter(x => canPay(P, x)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] || pool[0] : await pickCard(P, pool, `${name}: choose an artifact card you may cast from your graveyard this turn`); if (pick) { pick.gyCastTurn = G.turn; log(`${P.name} may cast ${pick.card.name} from the graveyard this turn.`); } break; }
        case 'reshape': {
            const shown = []; let hit = null;
            while (P.library.length) { const x = P.library.pop(); shown.push(x); if (/\bArtifact\b/.test(x.card.type)) { hit = x; break; } }
            if (hit) { pull(shown, hit); putOntoBattlefield(P, hit, false); if (Rx(hit).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: hit, effects: Rx(hit).etb }); }
            P.library.unshift(...shuffle(shown));
            const n = shown.length + (hit ? 1 : 0);
            damage(P, n, src); log(`${name} reveals ${n} card${n === 1 ? '' : 's'}${hit ? ` and puts ${hit.card.name} onto the battlefield` : ''}; it deals ${n} damage to ${P.name === 'You' ? 'you' : P.name}.`);
            break;
        }
        case 'brudiclad': {
            const toks = P.bf.filter(x => x.token);
            if (toks.length < 2) break;
            const v = x => (isCreature(x) ? creatureValue(x) : permValue(x));
            let pick = null;
            if (P.isAI) { let best = 0; toks.forEach(c => { const gain = toks.reduce((a, x) => a + (x === c ? 0 : v(c) - v(x)), 0); if (gain > best) { best = gain; pick = c; } }); }
            else pick = await pickCard(P, toks, `${name}: choose a token; every other token you control becomes a copy of it (or None)`);
            if (!pick) break;
            const card = pick.card;
            toks.filter(x => x !== pick).forEach(x => { x.copyOf = x.copyOf || x.card; x.card = { ...card, id: `${card.id}-copy${uidSeq++}` }; });
            log(`Every other token ${P.name} ${you(P) ? 'control' : 'controls'} becomes a copy of ${card.name}.`);
            break;
        }
        case 'chaosWarp': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            const owner = G.players[x.realOwner ?? x.owner];
            leaveBattlefield(x, 'library');
            if (!x.token && !owner.library.includes(x) && !x.isCommander) owner.library.push(x);
            shuffle(owner.library);
            log(`${x.card.name} is shuffled into ${owner.name === 'You' ? 'your' : `${owner.name}'s`} library.`);
            const top = owner.library[owner.library.length - 1];
            if (top) { log(`${owner.name} ${you(owner) ? 'reveal' : 'reveals'} ${top.card.name}.`); if (!['instant', 'sorcery'].includes(Rx(top).kind)) { putOntoBattlefield(owner, top, false); if (Rx(top).etb.length) (G.trigQ = G.trigQ || []).push({ P: owner, o: top, effects: Rx(top).etb }); } }
            break;
        }
        case 'gearhulk': {
            const Q = O, top3 = P.library.slice(-3), mv = top3.reduce((a, x) => a + (x.card.cmc || 0), 0);
            const letDraw = Q.isAI ? Q.life <= 10 : await askYes(Q, `${name}: let ${P.name} draw three cards? (Cancel = ${P.name} mills three and you take damage equal to their total mana value)`, { card: src.card, yes: 'Let them draw', no: 'Take the damage' });
            if (letDraw) { drawCards(P, 3); log(`${Q.name} ${you(Q) ? 'let' : 'lets'} ${P.name} draw three cards.`); }
            else { const milled = P.library.splice(-3).reverse(); P.gy.push(...milled); log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.map(x => x.card.name).join(', ')}.`); damage(Q, mv, src); log(`${name} deals ${mv} damage to ${Q.name === 'You' ? 'you' : Q.name}.`); }
            break;
        }
        case 'factFiction': {
            const five = P.library.splice(-5).reverse();
            if (!five.length) break;
            // The opponent splits them: the best card alone against the rest
            const val = x => aiKeepValue(P, x);
            const sorted = five.slice().sort((a, b) => val(b) - val(a));
            const pileA = [sorted[0]], pileB = sorted.slice(1);
            log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${five.map(x => x.card.name).join(', ')}; ${O.name} ${you(O) ? 'split' : 'splits'} them: ${pileA[0].card.name} | the other ${pileB.length}.`);
            const takeA = P.isAI ? val(pileA[0]) > pileB.reduce((a, x) => a + val(x), 0) * 0.6 : await askYes(P, `${name}: take ${pileA[0].card.name} alone? (Cancel = take the other ${pileB.length}: ${pileB.map(x => x.card.name).join(', ')})`, { card: pileA[0].card, yes: `Take ${pileA[0].card.name}`, no: `Take the ${pileB.length}` });
            const take = takeA ? pileA : pileB, rest = takeA ? pileB : pileA;
            P.hand.push(...take); P.gy.push(...rest);
            log(`${P.name} ${you(P) ? 'take' : 'takes'} ${take.length} card${take.length === 1 ? '' : 's'}.`);
            break;
        }
        case 'payCopyCtx': {
            const x = G.ctxObj; if (!x) break;
            const cost = parseCost(e.cost), plan = planPayment(P, cost);
            if (!plan) break;
            const yes = P.isAI ? (isCreature(x) ? creatureValue(x) >= 2 : permValue(x) >= 2) : await askYes(P, `${name}: pay ${e.cost} to make a token copy of ${x.card.name}?`, { card: x.card });
            if (!yes) break;
            planPayment(P, cost).forEach(y => tapSource(P, y));
            const tok = tokenCopyOf(P, x.front && x.card === x.front ? x.front : x.card);
            if (e.haste) { tok.tkw.push('haste'); tok.exileAtEnd = G.turn; }
            break;
        }
        case 'darettiSwap': {
            const arts = P.bf.filter(x => /\bArtifact\b/.test(x.card.type));
            const back = P.gy.filter(x => /\bArtifact\b/.test(x.card.type));
            if (!arts.length) break;
            const sac = P.isAI ? arts.sort((a, b) => permValue(a) - permValue(b))[0] : await pickCard(P, arts, `${name}: sacrifice an artifact`) || arts[0];
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${sac.card.name}.`); fire('sacrificed', { o: sac }); dieOrLeave(sac, 'gy');
            const pool = back.length ? back : P.gy.filter(x => /\bArtifact\b/.test(x.card.type));
            const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return an artifact card to the battlefield`);
            if (pick) { putOntoBattlefield(P, pick, false); if (Rx(pick).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: pick, effects: Rx(pick).etb }); }
            break;
        }
        case 'tempt': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            tokenCopyOf(P, x.card);
            const take = O.isAI ? creatureValue(x) >= 4 : await askYes(O, `${name} (tempting offer): make your own token copy of ${x.card.name}? (If you do, ${P.name} gets another one.)`, { card: x.card });
            if (take) { tokenCopyOf(O, x.card); tokenCopyOf(P, x.card); log(`${O.name} ${you(O) ? 'accept' : 'accepts'} the offer.`); }
            break;
        }
        case 'reflection': if (t && t.o) { G.reflection = { card: t.o.card, turn: G.turn }; log(`The next creatures or planeswalkers to enter this turn enter as copies of ${t.o.card.name}.`); } break;
        case 'treasureMap': {
            await applyChoiceEffect(P, { t: 'scry', n: 1 }, src);
            if (!onBf(src.uid)) break;
            src.ctr.landmark = (src.ctr.landmark || 0) + 1;
            log(`${name} gets a landmark counter (${src.ctr.landmark}).`);
            if (src.ctr.landmark >= 3) { src.ctr.landmark = 0; await applyEffect(P, { t: 'transform' }, null, src); await applyEffect(P, { t: 'artToken', n: 3, kind: 'treasure' }, null, src); }
            break;
        }
        case 'battlesphere': {
            if (!onBf(src.uid)) break;
            const myr = P.bf.filter(x => x !== src && !x.tapped && isCreature(x) && hasType(x, 'Myr') && !G.attackers.includes(x.uid));
            const n = P.isAI ? myr.length : (myr.length ? await askNumber(P, `${name}: tap how many untapped Myr?`, 0, myr.length, myr.length, { card: src.card, noCancel: true }) : 0);
            if (!n) break;
            myr.slice(0, n).forEach(x => { x.tapped = true; });
            src.tp += n;
            damage(O, n, src);
            log(`${name} taps ${n} Myr, gets +${n}/+0 and deals ${n} damage to ${O.name === 'You' ? 'you' : O.name}.`);
            break;
        }
        case 'bounceAllOf': { const X = t && t.p; if (!X) break; const xs = X.bf.filter(x => !/\bLand\b/.test(x.card.type)); xs.forEach(x => { leaveBattlefield(x, 'hand'); if (x.token) pull(G.players[x.realOwner ?? x.owner].hand, x); }); log(`${xs.length} nonland permanent${xs.length === 1 ? '' : 's'} return to ${X.name === 'You' ? 'your' : `${X.name}'s`} hand.`); break; }
        case 'dmgCreaturesPws': { allPerms().filter(x => isCreature(x) || isPlaneswalker(x)).forEach(x => damage(x, e.n, src)); log(`${name} deals ${e.n} damage to each creature and each planeswalker.`); break; }
        case 'commandersHome': { const X = t && t.p; if (!X) break; X.bf.filter(x => x.isCommander).forEach(x => leaveBattlefield(x, 'exile')); break; }
        case 'putFromHand': { const pool = P.hand.filter(x => cardFits(x, e.what)); const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: put an ${e.what} card from your hand onto the battlefield (or None)`); if (pick) { putOntoBattlefield(P, pick, false); if (Rx(pick).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: pick, effects: Rx(pick).etb }); } break; }
        case 'imprintHand': { const pool = P.hand.filter(x => cardFits(x, e.what)); const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: exile an ${e.what} card from your hand (or None)`); if (pick && onBf(src.uid)) { pull(P.hand, pick); P.exile.push(pick); src.imprinted = pick; log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${pick.card.name} with ${name}.`); } break; }
        case 'imprintCopy': if (src.imprinted) tokenCopyOf(P, src.imprinted.card); break;
        case 'vatImprint': {
            const x = G.ctxObj; const owner = x && G.players[x.realOwner ?? x.owner];
            if (!x || !owner || !owner.gy.includes(x) || !onBf(src.uid)) break;
            const yes = P.isAI ? !src.imprinted || creatureValue(x) > creatureValue(src.imprinted) : await askYes(P, `${name}: exile ${x.card.name} with it${src.imprinted ? ` (${src.imprinted.card.name} goes back to its graveyard)` : ''}?`, { card: x.card });
            if (!yes) break;
            if (src.imprinted) { const old = src.imprinted, ow = G.players[old.realOwner ?? old.owner]; if (pull(ow.exile, old) !== false) ow.gy.push(old); }
            pull(owner.gy, x); owner.exile.push(x); src.imprinted = x;
            log(`${name} exiles ${x.card.name}.`);
            break;
        }
        case 'vatCopy': if (src.imprinted) { const tok = tokenCopyOf(P, src.imprinted.card); tok.tkw.push('haste'); tok.exileAtEnd = G.turn; } break;
        case 'windfallMay': for (const X of [P, O]) { const yes = X.isAI ? X.hand.length <= 3 : await askYes(X, `${name}: discard your hand (${X.hand.length}) and draw seven?`, { card: src.card }); if (yes) { const n = X.hand.length; discardMark(X.hand); X.gy.push(...X.hand.splice(0)); noteDiscard(X, n); drawCards(X, e.n); log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${n} and ${you(X) ? 'draw' : 'draws'} ${e.n}.`); } } break;
        case 'discardDrawUpTo': {
            const out = [];
            for (let k = 0; k < e.n && P.hand.length; k++) {
                const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
                const pick = P.isAI ? P.hand.filter(x => !out.includes(x) && (Rx(x).kind === 'land' ? lands >= 6 : (x.card.cmc || 0) > lands + 3)).sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : await pickCard(P, P.hand.filter(x => !out.includes(x)), `${name}: discard a card (${k + 1} of ${e.n}; None to stop)`);
                if (!pick) break;
                out.push(pick);
            }
            out.forEach(x => { pull(P.hand, x); P.gy.push(x); x.discardTurn = G.turn; });
            if (out.length) { noteDiscard(P, out.length); drawCards(P, out.length); }
            log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${out.length} and ${you(P) ? 'draw' : 'draws'} ${out.length}.`);
            break;
        }
        case 'emblem': (P.emblems = P.emblems || []).push(e.kind); log(`${P.name} ${you(P) ? 'get' : 'gets'} an emblem: artifacts that go to ${you(P) ? 'your' : 'their'} graveyard from the battlefield return at the next end step.`); break;
        case 'nextAffinity': P.nextAffinityTurn = G.turn; log(`The next spell ${P.name} ${you(P) ? 'cast' : 'casts'} this turn has affinity for artifacts.`); break;
        case 'copyEachArtifact': { const arts = P.bf.filter(x => /\bArtifact\b/.test(x.card.type)); arts.forEach(x => { const tok = tokenCopyOf(P, x.card); tok.tkw.push('haste'); tok.exileAtEnd = G.turn; }); break; }
        case 'stealArtifacts': { const xs = O.bf.filter(x => /\bArtifact\b/.test(x.card.type)); xs.forEach(x => { pull(O.bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = P.i; x.sick = true; if (x.attachedTo) x.attachedTo = null; P.bf.push(x); }); log(`${P.name} ${you(P) ? 'gain' : 'gains'} control of ${xs.length} artifact${xs.length === 1 ? '' : 's'}.`); break; }
        case 'winGame': if (O.bf.some(x => Rx(x).cantLose && !lostAbilities(x))) { log(`${O.name} can't lose the game (Platinum Angel).`); break; } endGame(P.i, `${P.name} ${you(P) ? 'win' : 'wins'} with ${name}.`); break;
        case 'nabArtifact': { const x = G.ctxObj; if (!x || !onBf(x.uid) || x.owner === P.i) break; pull(G.players[x.owner].bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = P.i; x.nabbedUntil = G.active === P.i ? G.turn + 2 : G.turn + 1; P.bf.push(x); log(`${P.name} ${you(P) ? 'gain' : 'gains'} control of ${x.card.name} until the end of ${you(P) ? 'your' : 'their'} next turn.`); break; }
        case 'hellkiteWipe': { const hit = src.hitTurn && src.hitTurn.turn === G.turn ? src.hitTurn.players : []; const xs = hit.flatMap(pi => G.players[pi].bf.filter(x => !/\bLand\b/.test(x.card.type) && (x.card.cmc || 0) === e.n)); xs.forEach(x => destroy(x)); log(`${name} destroys ${xs.length} permanent${xs.length === 1 ? '' : 's'} with mana value ${e.n}.`); break; }
        case 'dmgPartners': case 'freezePartners': {
            const foes = combatPartners(src);
            for (const x of foes) {
                if (e.t === 'dmgPartners') { damage(x, e.n, src); log(`${name} deals ${e.n} damage to ${x.card.name}.`); }
                else { x.skipUntap = true; log(`${x.card.name} doesn't untap during its controller's next untap step.`); }
            }
            break;
        }
        case 'mustAttackT': if (t && t.o) { t.o.mustAttackTurn = G.turn; log(`${t.o.card.name} attacks this turn if able.`); } break;
        case 'reaper': {
            const pool = G.players.flatMap(X => X.gy.filter(c => /Creature/.test(c.card.type)));
            const pick = P.isAI ? pool.sort((a, b) => (a.owner === P.i) - (b.owner === P.i) || (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: exile a creature card from a graveyard`, { required: true });
            if (!pick) { log(`${name}: there's no creature card in a graveyard.`); break; }
            const X = G.players.find(Y => Y.gy.includes(pick)); pull(X.gy, pick); X.exile.push(pick);
            log(`${name} exiles ${pick.card.name}.`);
            await applyEffect(P, { t: 'token', n: 1, p: 2, q: 2, name: 'black zombie', kw: [] }, null, src);
            break;
        }
        case 'pumpHost': { const h = src.attachedTo && onBf(src.attachedTo); if (!h) break; h.tp += e.p; h.tq += e.q; log(`${h.card.name} gets ${e.p >= 0 ? '+' : ''}${e.p}/${e.q >= 0 ? '+' : ''}${e.q} until end of turn.`); break; }
        case 'dmgYou': damage(P, e.n, src); log(`${name} deals ${e.n} damage to ${you(P) ? 'you' : P.name}.`); break;
        case 'stoneGiant': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            if (!(tou(x) < pow(src))) { log(`${x.card.name}'s toughness isn't less than ${name}'s power, so nothing happens.`); break; }
            x.tkw.push('flying'); x.destroyAtEnd = G.turn;
            log(`${x.card.name} gains flying until end of turn; it will be destroyed at the beginning of the next end step.`);
            break;
        }
        case 'wildHunt': {
            const x = t && t.o, wolves = P.bf.filter(w => isCreature(w) && !w.tapped && hasType(w, 'Wolf'));
            wolves.forEach(w => { w.tapped = true; fire('tapped', { o: w }); });
            if (!x || !onBf(x.uid) || !wolves.length) { log(`${name} taps ${wolves.length} Wolves.`); break; }
            const back = Math.max(0, pow(x));
            wolves.forEach(w => damage(x, Math.max(0, pow(w)), w));
            log(`${wolves.length} Wolves deal ${wolves.reduce((a, w) => a + Math.max(0, pow(w)), 0)} damage to ${x.card.name}.`);
            // Its controller divides its damage among the Wolves: kill as many as it can, smallest first
            let left = back;
            for (const w of wolves.slice().sort((a, b) => (tou(a) - a.dmg) - (tou(b) - b.dmg))) { if (left <= 0) break; const k = Math.min(left, Math.max(1, tou(w) - w.dmg)); damage(w, k, x); left -= k; log(`${x.card.name} deals ${k} damage to ${w.card.name}.`); }
            break;
        }
        case 'mirrorFate': {
            const pool = P.exile.filter(c => (c.realOwner ?? c.owner) === P.i && !c.faceDown);
            const chosen = [];
            if (P.isAI) chosen.push(...pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)).slice(0, 7));
            else for (let k = 0; k < 7; k++) { const left = pool.filter(c => !chosen.includes(c)); const c = await pickCard(P, left, `${name}: choose an exiled card to put on top of your library (${k + 1} of up to 7; None to stop)`); if (!c) break; chosen.push(c); }
            const lib = P.library.splice(0); P.exile.push(...lib);
            chosen.forEach(c => pull(P.exile, c)); P.library.push(...chosen);
            log(`${name}: ${you(P) ? 'you exile your library and put' : `${P.name} exiles their library and puts`} ${chosen.length} chosen card${chosen.length === 1 ? '' : 's'} on top.`);
            break;
        }
        case 'djinnWish': {
            const c = P.library[P.library.length - 1]; if (!c) break;
            log(`${name} reveals ${c.card.name}.`);
            const isLand = Rx(c).kind === 'land', canLand = isLand && G.active === P.i && P.landsPlayed < landLimit(P);
            const castable = !isLand && (!firstTargetEffect(c) || validTargets(P, firstTargetEffect(c), c).length > 0);
            let yes = false;
            if (canLand || castable) yes = P.isAI ? true : await askYes(P, `${name}: ${isLand ? 'play' : 'cast'} ${c.card.name} without paying its mana cost? (Cancel = exile it.)`, { card: c.card });
            if (yes && canLand) { pull(P.library, c); P.hand.push(c); await playLand(P, c); break; }
            if (yes && castable && await castFreeNow(P, c, P.library)) break;
            pull(P.library, c); P.exile.push(c); log(`${c.card.name} is exiled.`);
            break;
        }
        case 'dmgPlayerAndCreatures': { const X = O; damage(X, e.n, src); X.bf.filter(isCreature).forEach(c => damage(c, e.n, src)); log(`${name} deals ${e.n} damage to ${X.name} and each creature they control.`); break; }
        case 'lifeAvatar': {
            await applyEffect(P, { t: 'token', n: 1, p: 0, q: 0, name: 'white avatar', kw: [] }, null, src);
            const tk = G.lastMade; if (tk) { tk.permAnimated = { life: true }; log(`The Avatar's power and toughness are each equal to ${you(P) ? 'your' : `${P.name}'s`} life total.`); }
            break;
        }
        case 'animateWhile': { const x = t && t.o; if (!x || !onBf(src.uid)) break; x.permAnimated = { p: e.p, q: e.q, whileSrc: src.uid }; log(`${x.card.name} becomes a ${e.p}/${e.q} creature for as long as ${name} remains on the battlefield.`); break; }
        case 'efreet': {
            const own = P.bf.filter(x => !/\bLand\b/.test(x.card.type) && !has(x, 'shroud')), theirs = O.bf.filter(x => !/\bLand\b/.test(x.card.type) && !has(x, 'shroud') && !has(x, 'hexproof') && !protFrom(x, src));
            if (!own.length) { log(`${name}'s ability has no legal target.`); break; }
            const mineT = P.isAI ? own.slice().sort((a, b) => permValue(a) - permValue(b))[0] : await pickCard(P, own, `${name}: choose a nonland permanent you control`, { required: true });
            const theirsT = [];
            if (P.isAI) theirsT.push(...theirs.slice().sort((a, b) => permValue(b) - permValue(a)).slice(0, 2));
            else for (let k = 0; k < 2; k++) { const c = await pickCard(P, theirs.filter(x => !theirsT.includes(x)), `${name}: choose up to two nonland permanents you don't control (${k + 1} of 2; None to stop)`); if (!c) break; theirsT.push(c); }
            const all = [mineT, ...theirsT].filter(Boolean), hit = all[rand(all.length)];
            log(`${name} destroys one of ${all.map(x => x.card.name).join(', ')} at random: ${hit.card.name}.`);
            destroy(hit);
            break;
        }
        case 'hiveMind': {
            const raw = G.ctxRaw, it = raw && G.stack.find(x => x.kind === 'spell' && x.o === raw.o);
            if (!it) break;
            const X = opp(it.P), fx = withX(spellEffects(it.o), it.x), te = fx.find(needsTarget);
            const tg = te ? await chooseTarget(X, te, it.o, false) : null;
            if (te && !tg) { log(`${X.name} can't copy ${it.name} - there's no legal target.`); break; }
            G.stack.push({ id: stackSeq++, kind: 'trigger', o: it.o, P: X, target: tg, effects: fx, name: `Copy of ${it.name}`, copy: true });
            log(`${X.name} ${you(X) ? 'copy' : 'copies'} ${it.name} (Hive Mind)${tg ? `, targeting ${targetName(tg)}` : ''}.`);
            break;
        }
        case 'lurking': {
            const c = P.library[P.library.length - 1]; if (!c) break;
            log(`${name} reveals ${c.card.name}.`);
            if (/Creature/.test(c.card.type)) { putOntoBattlefield(P, c, false); break; }
            const bottom = P.isAI ? (Rx(c).kind === 'land' && P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= 5) || (c.card.cmc || 0) > 5 : await askYes(P, `${name}: put ${c.card.name} on the bottom of your library?`, { card: c.card, yes: 'Bottom', no: 'Keep on top' });
            if (bottom) { pull(P.library, c); P.library.unshift(c); log(`${c.card.name} goes on the bottom.`); }
            break;
        }
        case 'sphinxAmb': {
            const X = O; if (!X.library.length) break;
            const creatures = X.library.filter(c => /Creature/.test(c.card.type)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0));
            const pick = P.isAI ? (creatures[1] || creatures[0] || X.library[0]) : await pickCard(P, X.library.slice().sort((a, b) => a.card.name.localeCompare(b.card.name)), `${name}: search ${X.name === 'You' ? 'your' : `${X.name}'s`} library for a card`, { required: true });
            let named = null;
            if (X.isAI || AUTOPLAY) named = creatures[0] ? creatures[0].card.name : null;
            else { const names = creatures.filter((c, i) => creatures.findIndex(y => y.card.name === c.card.name) === i); const n = await pickCard(X, names, `${name}: name a card (if they found a creature with another name, they get it)`, { required: true }); named = n ? n.card.name : null; }
            log(`${X.name} ${you(X) ? 'name' : 'names'} ${named || 'nothing'}.`);
            if (pick && /Creature/.test(pick.card.type) && pick.card.name !== named) {
                const yes = P.isAI || await askYes(P, `${name}: put ${pick.card.name} onto the battlefield under your control?`, { card: pick.card });
                if (yes) { pull(X.library, pick); putOntoBattlefield(P, pick, false); pick.realOwner = X.i; log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} onto the battlefield.`); }
            } else if (pick) log(`${pick.card.name} stays in the library.`);
            shuffle(X.library); fire('libShuffle', { P: X });
            break;
        }
        case 'xathrid': {
            const pool = P.bf.filter(x => isCreature(x) && x !== src);
            if (!pool.length) { if (onBf(src.uid)) { src.tapped = true; fire('tapped', { o: src }); } P.life -= 7; log(`${P.name} can't sacrifice a creature: ${name} taps and ${you(P) ? 'you lose' : `${P.name} loses`} 7 life.`); break; }
            const f = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : await pickCard(P, pool, `${name}: sacrifice a creature other than ${name}`, { required: true });
            const n = Math.max(0, pow(f));
            fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            O.life -= n; log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}; ${O.name === 'You' ? 'you lose' : `${O.name} loses`} ${n} life.`);
            break;
        }
        case 'destroySelf': if (onBf(src.uid)) destroy(src); break;
        // ---- Magic 2010 (2026-10-08) ----
        case 'harmsWay': if (t) { P.harmsWay = { turn: G.turn, n: e.n, t }; log(`${name}: the next ${e.n} damage an opponent's source would deal to ${you(P) ? 'you or your' : `${P.name} or their`} permanents this turn is dealt to ${t.p ? t.p.name : t.o.card.name} instead.`); } break;
        case 'safePassage': if (G.noPrevent === G.turn) { log('Damage can\'t be prevented this turn.'); break; } P.safeTurn = G.turn; log(`All damage to ${you(P) ? 'you and creatures you control' : `${P.name} and their creatures`} is prevented this turn.`); break;
        case 'hauntingEchoes': {
            const X = O, gone = X.gy.filter(x => !isBasic(x.card));
            gone.forEach(x => { pull(X.gy, x); X.exile.push(x); });
            const names = new Set(gone.map(x => x.card.name)), lib = X.library.filter(x => names.has(x.card.name));
            lib.forEach(x => { pull(X.library, x); X.exile.push(x); });
            shuffle(X.library); fire('libShuffle', { P: X });
            log(`${name} exiles ${gone.length} card${gone.length === 1 ? '' : 's'} from ${X.name === 'You' ? 'your' : `${X.name}'s`} graveyard and ${lib.length} with the same names from their library.`);
            break;
        }
        case 'openVaults':
            for (const X of G.players) for (const x of X.gy.filter(c => /Artifact|Enchantment/.test(c.card.type) && !/Aura/.test(c.card.type))) { pull(X.gy, x); putOntoBattlefield(X, x, false); }
            break;
        case 'polymorph': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            const X = ctrl(x); x.regen = 0; destroy(x);
            if (onBf(x.uid)) break; // indestructible
            const shown = [];
            while (X.library.length) { const c = X.library.pop(); if (/Creature/.test(c.card.type)) { putOntoBattlefield(X, c, false); log(`${X.name === 'You' ? 'You reveal' : `${X.name} reveals`} ${shown.length} card${shown.length === 1 ? '' : 's'}, then ${c.card.name}.`); break; } shown.push(c); }
            X.library.push(...shown); shuffle(X.library);
            break;
        }
        case 'zombify': {
            const x = G.lastReturned; if (!x || !onBf(x.uid)) break;
            if (!x.front) x.front = x.card;
            x.card = { ...x.card, type: /—/.test(x.card.type) ? `${x.card.type} Zombie` : `${x.card.type} — Zombie`, colors: [...new Set([...(x.card.colors || []), 'B'])], _r: undefined };
            log(`${x.card.name} is a black Zombie in addition to its other colors and types.`);
            break;
        }
        case 'millHalf': { const k = Math.floor(O.library.length / 2); const milled = O.library.splice(O.library.length - k).reverse(); O.gy.push(...milled); log(`${O.name} ${you(O) ? 'mill' : 'mills'} ${k} (half their library).`); break; }
        case 'warpWorld': {
            const order = G.players.map(X => { const own = allPerms().filter(o => (o.realOwner ?? o.owner) === X.i); return { X, n: own.length, own }; });
            for (const { own } of order) for (const o of own) { leaveBattlefield(o, 'library'); }
            for (const { X, own } of order) {
                const nonTok = own.filter(o => !o.token && !o.isCommander).length;
                shuffle(X.library);
                const shown = X.library.splice(Math.max(0, X.library.length - nonTok));
                const first = shown.filter(c => /Artifact|Creature|\bLand\b/.test(c.card.type) && !/Aura/.test(c.card.type));
                first.forEach(c => putOntoBattlefield(X, c, false));
                const ench = shown.filter(c => !first.includes(c) && /Enchantment/.test(c.card.type) && !/Aura/.test(c.card.type));
                ench.forEach(c => putOntoBattlefield(X, c, false));
                const rest = shown.filter(c => !first.includes(c) && !ench.includes(c));
                X.library.unshift(...rest);
                log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${shown.length} cards and ${you(X) ? 'put' : 'puts'} ${first.length + ench.length} onto the battlefield.`);
            }
            break;
        }
        // ---- Mirrodin (2026-10-08) ----
        case 'detonate': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            if ((x.card.cmc || 0) !== e.n) { log(`${name}: ${x.card.name}'s mana value isn't ${e.n}, so nothing happens.`); break; }
            const ctl = G.players[x.owner];
            x.regen = 0; destroy(x);
            damage(ctl, e.n, src); log(`${name} deals ${e.n} damage to ${ctl.name === 'You' ? 'you' : ctl.name}.`);
            break;
        }
        case 'sacFling': {
            const pool = P.bf.filter(isCreature);
            if (!pool.length) break;
            const f = (P.isAI ? pool.slice().sort((a, b) => (a.stolenTurn === G.turn ? -50 : 0) + creatureValue(a) - pow(a) - ((b.stolenTurn === G.turn ? -50 : 0) + creatureValue(b) - pow(b)))[0] : await pickCard(P, pool, `${name}: sacrifice a creature`)) || pool[0];
            const n = Math.max(0, pow(f));
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            if (t && targetStillOk(t)) { damage(t.p || t.o, n, src); log(`${name} deals ${n} damage to ${targetName(t)}.`); }
            break;
        }
        case 'augur': {
            const X = (t && t.p) || P;
            drawCards(X, 1);
            if (!X.hand.length) break;
            const d = X.isAI ? (X.hand.find(x => /Artifact/.test(x.card.type) && X === P && aiKeepValue(X, x) < 5) || X.hand.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b))[0]) : await pickCard(X, X.hand, `${name}: discard a card`) || X.hand[0];
            pull(X.hand, d); X.gy.push(d); d.discardTurn = G.turn; noteDiscard(X, 1);
            log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${d.card.name}.`);
            if (/Artifact/.test(d.card.type) && onBf(src.uid)) { src.tapped = false; log(`${name} untaps.`); }
            break;
        }
        case 'revealArt': { const c = P.library.pop(); if (!c) break; log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name}.`); if (/Artifact/.test(c.card.type)) P.hand.push(c); else P.gy.push(c); break; }
        case 'tajNar': {
            const mx = (() => { let x = 0; while (x < 20 && planPayment(P, parseCost(''), x + 1)) x++; return x; })();
            const fits = P.library.filter(x => /\bEquipment\b/.test(x.card.type));
            if (!fits.length || !mx) { if (!fits.length) libShuffle(P); break; }
            const want = Math.max(...fits.map(x => x.card.cmc || 0));
            const X = P.isAI ? Math.min(mx, want) : await askNumber(P, `${name}: pay {X} to search for an Equipment with mana value X or less? (0 = don't pay)`, 0, mx, Math.min(mx, want), { card: src.card, noCancel: true });
            if (!X) break;
            planPayment(P, parseCost(''), X).forEach(s => tapSource(P, s));
            const pool = fits.filter(x => (x.card.cmc || 0) <= X);
            const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: choose an Equipment (mana value ${X} or less)`);
            if (pick) putOntoBattlefield(P, pick, false);
            libShuffle(P);
            break;
        }
        case 'prisonImprint': {
            const X = (t && t.p) || O;
            const pool = X.hand.filter(x => Rx(x).kind !== 'land');
            if (!pool.length) { log(`${X.name} ${you(X) ? 'have' : 'has'} no nonland card.`); break; }
            log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${X.hand.map(x => x.card.name).join(', ')}.`);
            const pick = P.isAI ? pool.sort((a, b) => aiKeepValue(X, b) - aiKeepValue(X, a))[0] : await pickCard(P, pool, `${name}: exile a nonland card`) || pool[0];
            pull(X.hand, pick); X.exile.push(pick); if (onBf(src.uid)) src.imprinted = pick;
            log(`${name} exiles ${pick.card.name}.`);
            break;
        }
        case 'rustElem': {
            const pool = P.bf.filter(x => x !== src && /Artifact/.test(x.card.type));
            if (pool.length) { const f = P.isAI ? pool.sort((a, b) => permValue(a) - permValue(b))[0] : await pickCard(P, pool, `${name}: sacrifice another artifact`) || pool[0]; log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); }
            else if (onBf(src.uid)) { src.tapped = true; P.life -= 4; log(`${name} is tapped and ${P.name} ${you(P) ? 'lose' : 'loses'} 4 life.`); }
            break;
        }
        case 'peacekeeper': { const low = Math.min(...G.players.map(X => X.life)); const lows = G.players.filter(X => X.life === low); const to = lows.includes(P) && lows.length > 1 ? (P.isAI ? O : P) : lows[0]; if (to !== P && onBf(src.uid)) giveControl(src, to); break; }
        case 'coils': {
            const n = src.ctr.charge || 0;
            if (n < 5 || !onBf(src.uid)) break;
            src.ctr.charge = 0;
            const before = new Set(P.bf);
            await applyEffect(P, { t: 'token', n, p: 3, q: 1, name: 'red elemental', kw: ['haste'] }, null, src);
            P.bf.filter(x => !before.has(x) && x.token).forEach(x => { x.exileAtEnd = G.turn; });
            break;
        }
        case 'crown': if (P.handAtStart === 0) drawCards(P, 1); else { damage(P, 1, src); log(`${name} deals 1 damage to ${P.name === 'You' ? 'you' : P.name}.`); } break;
        case 'timesift': {
            for (let round = 0; round < 10; round++) {
                const shown = G.players.map(X => { const c = X.library.pop(); if (c) X.exile.push(c); return c; });
                log(`Timesifter: ${G.players.map((X, i) => `${X.name} ${shown[i] ? shown[i].card.name : 'nothing'}`).join(', ')}.`);
                const mv = shown.map(c => (c ? c.card.cmc || 0 : -1));
                if (mv[0] === mv[1]) { if (!shown.some(Boolean)) break; continue; }
                const w = mv[0] > mv[1] ? 0 : 1;
                G.extra = G.extra || [0, 0]; G.extra[w]++;
                log(`${G.players[w].name} ${you(G.players[w]) ? 'take' : 'takes'} an extra turn after this one.`);
                break;
            }
            break;
        }
        case 'gateAether': {
            const X = G.players[G.active], c = X.library[X.library.length - 1];
            if (!c) break;
            log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${c.card.name}.`);
            if (/Artifact|Creature|Enchantment|\bLand\b/.test(c.card.type) && Rx(c).support !== 'none') { const yes = X.isAI ? true : await askYes(X, `${name}: put ${c.card.name} onto the battlefield?`, { card: c.card }); if (yes) putOntoBattlefield(X, c, false); }
            break;
        }
        case 'fatespin': {
            const X = G.players[G.active];
            const opts = ['draw', 'main', 'combat'];
            let pick;
            if (X.isAI) pick = X.bf.some(canAttackWith) && X.hand.length > 2 ? 'draw' : X.hand.filter(x => Rx(x).kind !== 'land').length ? 'combat' : 'main';
            else { const i = await pickMode(X, [[], [], []], { card: { ...src.card, text: '• Skip your draw step\n• Skip your main phases\n• Skip your combat phase' } }); pick = opts[i >= 0 ? i : 0]; }
            X.skip = { turn: G.turn, what: pick };
            log(`${X.name} ${you(X) ? 'skip' : 'skips'} ${pick === 'draw' ? 'the draw step' : pick === 'main' ? 'the main phases' : 'combat'} this turn (Fatespinner).`);
            break;
        }
        case 'floodLand': {
            const X = G.players[G.active];
            const pool = X.bf.filter(x => /\bLand\b/.test(x.card.type) && !hasType(x, 'Island'));
            if (!pool.length) break;
            const l = X.isAI ? pool.sort((a, b) => (Rx(b).mana ? 0 : 1) - (Rx(a).mana ? 0 : 1) || (a.tapped - b.tapped))[0] : await pickCard(X, pool, `${name}: put a flood counter on a non-Island land (it becomes an Island)`) || pool[0];
            l.ctr.flood = (l.ctr.flood || 0) + 1;
            log(`${l.card.name} gets a flood counter and is an Island.`);
            break;
        }
        case 'unflood': { const lands = allPerms().filter(x => /\bLand\b/.test(x.card.type)); if (lands.length && lands.every(x => hasType(x, 'Island'))) { lands.forEach(x => { delete x.ctr.flood; }); log('All flood counters are removed.'); } break; }
        case 'gambit': {
            let wins = 0;
            while (true) {
                const won = flipCoin(P);
                if (!won) { wins = 0; log(`${P.name} ${you(P) ? 'lose' : 'loses'} a flip - ${name} has no effect.`); break; }
                wins++;
                log(`${P.name} ${you(P) ? 'win' : 'wins'} flip ${wins}.`);
                if (wins >= 3) break;
                const go = P.isAI ? (wins === 1 && O.life <= 6) || (wins === 2 && P.hand.length < 3) : await askYes(P, `${name}: you've won ${wins} flip${wins === 1 ? '' : 's'}. Flip again? (Losing a flip means no effect.)`, { card: src.card, yes: 'Flip again', no: 'Stop' });
                if (!go) break;
            }
            if (wins >= 1 && t && targetStillOk(t)) { damage(t.o, 3, src); log(`${name} deals 3 damage to ${t.o.card.name}.`); }
            if (wins >= 2) { damage(O, 6, src); log(`${name} deals 6 damage to ${O.name === 'You' ? 'you' : O.name}.`); }
            if (wins >= 3) { drawCards(P, 9); P.bf.filter(x => /\bLand\b/.test(x.card.type)).forEach(x => { x.tapped = false; }); }
            break;
        }
        case 'spoils': {
            const names = [...new Set(P.library.map(x => x.card.name))];
            if (!names.length) break;
            let nm;
            if (P.isAI) nm = P.library.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0].card.name;
            else { const pool = names.map(n => P.library.find(x => x.card.name === n)); const c = await pickCard(P, pool, `${name}: name a card`); nm = (c || pool[0]).card.name; }
            log(`${P.name} ${you(P) ? 'name' : 'names'} ${nm}.`);
            const ex = [];
            while (P.library.length) { const c = P.library.pop(); if (c.card.name === nm) { P.hand.push(c); log(`${P.name} ${you(P) ? 'find' : 'finds'} ${nm}.`); break; } ex.push(c); }
            P.exile.push(...ex); P.life -= ex.length;
            log(`${ex.length} card${ex.length === 1 ? ' is' : 's are'} exiled; ${P.name} ${you(P) ? 'lose' : 'loses'} ${ex.length} life.`);
            break;
        }
        case 'grimReminder': {
            const pool = P.library.filter(x => Rx(x).kind !== 'land');
            const cast = (G.castNames || []).filter(c => c.turn === G.turn && c.p !== P.i).map(c => c.name);
            const pick = P.isAI ? pool.find(x => cast.includes(x.card.name)) || pool.sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, pool, `${name}: choose a nonland card to reveal and put into your hand`);
            if (pick) { pull(P.library, pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${pick.card.name}.`); if (cast.includes(pick.card.name)) { O.life -= 6; log(`${O.name} cast ${pick.card.name} this turn and ${you(O) ? 'lose' : 'loses'} 6 life.`); } }
            libShuffle(P);
            break;
        }
        case 'charbelcher': {
            const shown = []; let land = null;
            while (P.library.length) { const c = P.library.pop(); if (/\bLand\b/.test(c.card.type)) { land = c; break; } shown.push(c); }
            let n = shown.length; if (land && hasType(land, 'Mountain')) n *= 2;
            log(`${name} reveals ${shown.length} nonland card${shown.length === 1 ? '' : 's'}${land ? ` and ${land.card.name}` : ''}.`);
            P.library.unshift(...shown, ...(land ? [land] : []));
            if (t && targetStillOk(t) && n) { damage(t.p || t.o, n, src); log(`${name} deals ${n} damage to ${targetName(t)}.`); }
            break;
        }
        case 'pendulum': {
            // You name a card; the opponent guesses whether it's in your hand. You draw if they guess wrong and you reveal.
            const inHand = P.hand.length > 0 && (P.isAI ? Math.random() < 0.5 : true);
            const guessIn = O.isAI ? Math.random() < 0.5 : await askYes(O, `${name}: ${P.name} named a card. Is it in their hand?`, { card: src.card, yes: 'In their hand', no: 'Not in their hand' });
            log(`${O.name} ${you(O) ? 'guess' : 'guesses'} the card is ${guessIn ? '' : 'not '}in ${P.name}'s hand.`);
            if (guessIn !== inHand) { log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} the hand - wrong guess.`); drawCards(P, 1); }
            else log('Right guess - no card.');
            break;
        }
        case 'incubator': {
            const arts = P.library.filter(x => /Artifact/.test(x.card.type));
            arts.forEach(x => pull(P.library, x)); P.exile.push(...arts);
            libShuffle(P);
            if (arts.length) await applyEffect(P, { t: 'token', n: arts.length, p: 1, q: 1, name: 'colorless myr', kw: [], artifact: true }, null, src);
            break;
        }
        case 'fateCounter': if (t && t.o) { t.o.ctr.fate = (t.o.ctr.fate || 0) + 1; log(`${t.o.card.name} gets a fate counter.`); } break;
        case 'oStone': { const xs = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !(x.ctr.fate > 0)); xs.forEach(x => destroy(x)); allPerms().forEach(x => { delete x.ctr.fate; }); log(`${name} destroys ${xs.length} nonland permanent${xs.length === 1 ? '' : 's'}.`); break; }
        case 'proteus': {
            const x = t && t.o; if (!x || !onBf(x.uid)) break;
            const X = G.players[x.owner], owner = G.players[x.realOwner ?? x.owner];
            leaveBattlefield(x, 'library');
            if (!x.token && !owner.library.includes(x)) owner.library.unshift(x);
            const shown = []; let hit = null;
            while (X.library.length) { const c = X.library.pop(); if (/Creature/.test(c.card.type) && c !== x) { hit = c; break; } shown.push(c); }
            X.library.unshift(...shown);
            if (hit) putOntoBattlefield(X, hit, false);
            log(`${x.card.name} goes to the bottom of its owner's library${hit ? `; ${hit.card.name} enters` : ''}.`);
            break;
        }
        case 'castImprintCopy': {
            const c = src.imprinted; if (!c) break;
            const fx = rulesFor(c.card).spell || [];
            const yes = P.isAI ? true : await askYes(P, `${name}: cast a copy of ${c.card.name} without paying its mana cost?`, { card: c.card });
            if (yes) { G.stack.push({ id: stackSeq++, kind: 'trigger', o: src, P, target: null, effects: fx, name: `Copy of ${c.card.name}`, copy: true }); log(`${P.name} ${you(P) ? 'cast' : 'casts'} a copy of ${c.card.name}.`); fire('cast', { P, o: c }); }
            break;
        }
        case 'nimDevour': {
            const X = G.players[src.owner];
            if (!X.gy.includes(src)) break;
            putOntoBattlefield(X, src, false);
            const pool = X.bf.filter(isCreature);
            const f = (X.isAI ? pool.filter(x => x !== src).sort((a, b) => creatureValue(a) - creatureValue(b))[0] : await pickCard(X, pool, `${name}: sacrifice a creature`)) || src;
            log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            break;
        }
        case 'secondSunrise': for (const X of G.players) { const back = X.gy.filter(x => x.toGyTurn === G.turn && /Artifact|Creature|Enchantment|\bLand\b/.test(x.card.type)); back.forEach(x => putOntoBattlefield(X, x, false)); } break;
        case 'timetwister': for (const X of G.players) { X.library.push(...X.hand.splice(0), ...X.gy.splice(0)); libShuffle(X); log(`${X.name} ${you(X) ? 'shuffle' : 'shuffles'} hand and graveyard into the library.`); } break;
        case 'aweStrike': if (t && t.o) { t.o.aweStrike = { turn: G.turn, by: P.i }; log(`The next time ${t.o.card.name} would deal damage this turn, it's prevented.`); } break;
        case 'warElemental': if (!G.players.some(X => X !== P && X.lostTurn === G.turn) && onBf(src.uid)) { log(`No opponent was dealt damage this turn - ${name} is sacrificed.`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy'); } break;
        case 'discardUnlessArt': {
            const X = (t && t.p) || P;
            if (!X.hand.length) break;
            const arts = X.hand.filter(x => /Artifact/.test(x.card.type));
            const worst = l => l.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b));
            let out;
            if (X.isAI) { const two = worst(X.hand).slice(0, e.n); const art = worst(arts)[0]; out = art && (two.length < e.n || aiKeepValue(X, art) <= two.reduce((a, x) => a + aiKeepValue(X, x), 0)) ? [art] : two; }
            else if (arts.length && await askYes(X, `${name}: discard an artifact card instead of ${e.n} cards?`, { card: src.card, yes: 'Discard an artifact', no: `Discard ${e.n}` })) out = [await pickCard(X, arts, 'Discard an artifact card') || arts[0]];
            else { out = []; for (let k = 0; k < e.n && X.hand.length > out.length; k++) { const c = await pickCard(X, X.hand.filter(x => !out.includes(x)), `Discard a card (${k + 1} of ${e.n})`); out.push(c || X.hand.find(x => !out.includes(x))); } }
            out.forEach(c => { pull(X.hand, c); X.gy.push(c); c.discardTurn = G.turn; });
            noteDiscard(X, out.length);
            log(`${X.name} ${you(X) ? 'discard' : 'discards'} ${out.map(c => c.card.name).join(', ')}.`);
            break;
        }
        case 'toTop': { const x = t && t.o; if (!x) break; const owner = G.players[x.realOwner ?? x.owner]; leaveBattlefield(x, 'library'); if (!x.token && !owner.library.includes(x)) owner.library.push(x); log(`${x.card.name} goes on top of its owner's library.`); break; }
        case 'toBottomOwn': { const x = t && t.o; if (!x) break; const owner = G.players[x.realOwner ?? x.owner]; leaveBattlefield(x, 'library'); if (!x.token && !owner.library.includes(x)) owner.library.unshift(x); log(`${x.card.name} goes to the bottom of its owner's library.`); break; }
        case 'regenTarget': if (t && t.o) { t.o.regen = (t.o.regen || 0) + 1; log(`${t.o.card.name} gets a regeneration shield.`); } break;
        case 'regenAll': P.bf.filter(isCreature).forEach(x => { x.regen = (x.regen || 0) + 1; }); log(`Each creature ${P.name} ${you(P) ? 'control' : 'controls'} gets a regeneration shield.`); break;
        case 'exileLibrary': { const n = P.library.length; P.exile.push(...P.library.splice(0)); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${n} cards from the library.`); break; }
        case 'shuffleSelf': libShuffle(P); log(`${P.name} ${you(P) ? 'shuffle' : 'shuffles'} the library.`); break;
        case 'untapAllMine': { const xs = P.bf.filter(x => isCreature(x) && x.tapped); xs.forEach(x => { x.tapped = false; }); mesmeric(P, xs.length); log(`${P.name}'s creatures untap.`); break; }
        case 'extraLands': P.extraLandTurn = G.turn; P.extraLandN = e.n; log(`${P.name} may play ${e.n} additional lands this turn.`); break;
        case 'putFromHandN': for (let k = 0; k < e.n; k++) { const pool = P.hand.filter(x => cardFits(x, e.what)); const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: put a ${e.what} card from your hand onto the battlefield (${k + 1} of up to ${e.n}; None to stop)`); if (!pick) break; putOntoBattlefield(P, pick, false); } break;
        case 'lookHand': { const X = (t && t.p) || O; log(`${P.name} ${you(P) ? 'look' : 'looks'} at ${X.name === 'You' ? 'your' : `${X.name}'s`} hand${you(P) ? `: ${X.hand.map(x => x.card.name).join(', ') || 'empty'}` : ''}.`); break; }
        case 'exileGyCard': { const X = (t && t.p) || O; if (!X.gy.length) break; const c = X.isAI ? X.gy.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0] : await pickCard(X, X.gy, `${name}: exile a card from your graveyard`) || X.gy[0]; pull(X.gy, c); X.exile.push(c); log(`${X.name} ${you(X) ? 'exile' : 'exiles'} ${c.card.name} from the graveyard.`); break; }
        case 'unattachEquip': if (t && t.o) { const eq = allPerms().filter(a => a.attachedTo === t.o.uid && /\bEquipment\b/.test(a.card.type)); eq.forEach(a => { a.attachedTo = null; }); log(`${eq.length} Equipment ${eq.length === 1 ? 'is' : 'are'} unattached from ${t.o.card.name}.`); } break;
        case 'oppHandToTop': { const X = (t && t.p) || O; if (!X.hand.length) break; const c = X.isAI ? X.hand.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b))[0] : await pickCard(X, X.hand, `${name}: put a card from your hand on top of your library`) || X.hand[0]; pull(X.hand, c); X.library.push(c); log(`${X.name} ${you(X) ? 'put' : 'puts'} a card from hand on top of the library.`); break; }
        case 'noUntapNext': { const X = (t && t.p) || O; X.bf.filter(isCreature).forEach(x => { x.skipUntap = true; }); log(`${X.name}'s creatures don't untap during the next untap step.`); break; }
        case 'mustAttackAll': { const X = (t && t.p) || O; X.mustAttackTurn = G.turn + (G.active === X.i ? 0 : 1); log(`Creatures ${X.name} ${you(X) ? 'control' : 'controls'} attack ${G.active === X.i ? 'this' : 'next'} turn if able.`); break; }
        case 'exileWithEquip': { const x = t && t.o; if (!x) break; const eq = allPerms().filter(a => a.attachedTo === x.uid && /\bEquipment\b/.test(a.card.type)); [x, ...eq].forEach(y => leaveBattlefield(y, 'exile')); log(`${name} exiles ${x.card.name}${eq.length ? ` and ${eq.map(a => a.card.name).join(', ')}` : ''}.`); break; }
        case 'exileImprint': { const x = t && t.o; if (!x || !onBf(x.uid)) break; leaveBattlefield(x, 'exile'); if (onBf(src.uid)) src.imprinted = x; log(`${name} exiles ${x.card.name}.`); break; }
        case 'helixImprint': {
            const gyOf = G.players.map(X => X.gy.filter(x => Rx(x).kind === 'sorcery'));
            const i = gyOf[O.i].length >= 2 && (!P.isAI || gyOf[O.i].length >= gyOf[P.i].length) ? O.i : gyOf[P.i].length >= 2 ? P.i : -1;
            if (i < 0) { log(`${name}: no graveyard has two sorcery cards.`); break; }
            const X = G.players[i], pool = gyOf[i];
            const a = P.isAI ? pool.sort((x, y) => (y.card.cmc || 0) - (x.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: exile a sorcery card (1 of 2)`) || pool[0];
            const b = P.isAI ? pool.filter(x => x !== a)[0] : await pickCard(P, pool.filter(x => x !== a), `${name}: exile a sorcery card (2 of 2)`) || pool.find(x => x !== a);
            [a, b].forEach(x => { pull(X.gy, x); X.exile.push(x); });
            if (onBf(src.uid)) src.helix = [a.card, b.card];
            log(`${name} exiles ${a.card.name} and ${b.card.name}.`);
            break;
        }
        case 'helixCopy': {
            const cast = G.ctxRaw && G.ctxRaw.o;
            if (!src.helix || !cast) break;
            const other = src.helix.find(c => c.name !== cast.card.name);
            if (!other) break;
            const yes = P.isAI ? true : await askYes(P, `${name}: cast a copy of ${other.name} without paying its mana cost?`, { card: other });
            if (yes) { G.stack.push({ id: stackSeq++, kind: 'trigger', o: src, P, target: null, effects: rulesFor(other).spell || [], name: `Copy of ${other.name}`, copy: true }); log(`${P.name} ${you(P) ? 'cast' : 'casts'} a copy of ${other.name}.`); }
            break;
        }
        case 'attachAllEquipAll': if (onBf(src.uid)) { const eq = allPerms().filter(a => /\bEquipment\b/.test(a.card.type)); eq.forEach(a => { a.attachedTo = src.uid; }); if (eq.length) log(`${eq.map(a => a.card.name).join(', ')} ${eq.length === 1 ? 'is' : 'are'} attached to ${name}.`); } break;
        case 'dmgSelfCharge': { const n = src.ctr.charge || 0; if (n) { damage(P, n, src); log(`${name} deals ${n} damage to ${P.name === 'You' ? 'you' : P.name}.`); } break; }
        case 'chokerPass': if (onBf(src.uid)) { giveControl(src, O); src.ctr.charge = (src.ctr.charge || 0) + 1; log(`${name} gets a charge counter (${src.ctr.charge}).`); } break;
        case 'chokerAdjust': {
            if (!onBf(src.uid)) break;
            const ctl = G.players[src.owner];
            const add = P.isAI ? ctl !== P : await askYes(P, `${name}: put a charge counter on it? (Cancel = remove one)`, { card: src.card, yes: 'Put one', no: 'Remove one' });
            if (add) src.ctr.charge = (src.ctr.charge || 0) + 1; else src.ctr.charge = Math.max(0, (src.ctr.charge || 0) - 1);
            log(`${name} now has ${src.ctr.charge} charge counter${src.ctr.charge === 1 ? '' : 's'}.`);
            break;
        }
        case 'mindslave': { const X = (t && t.p) || O; X.slavedTurn = { by: P.i, from: G.turn }; log(`${P.name} will control ${X.name}'s next turn (Mindslaver).`); break; }
        case 'hostCtlLose': { const h = src.attachedTo && onBf(src.attachedTo); const X = h ? G.players[h.owner] : null; if (X) { X.life -= e.n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${e.n} life (${name}).`); } break; }
        case 'activeSacArt': { const X = G.players[G.active]; const pool = X.bf.filter(x => /Artifact/.test(x.card.type)); if (!pool.length) break; const f = X.isAI ? pool.sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0] : await pickCard(X, pool, `${name}: sacrifice an artifact`) || pool[0]; log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); break; }
        case 'urnMana': { const X = G.players[G.active]; const n = X.bf.filter(x => /Artifact/.test(x.card.type)).length; X.pool = X.pool || []; for (let k = 0; k < n; k++) X.pool.push('C'); if (n) log(`${X.name} ${you(X) ? 'add' : 'adds'} {C}×${n} (${name}).`); break; }
        case 'cullLowest': {
            const xs = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i));
            if (!xs.length) break;
            const low = Math.min(...xs.map(x => x.card.cmc || 0)), tie = xs.filter(x => (x.card.cmc || 0) === low);
            const pick = P.isAI ? tie.sort((a, b) => (a.owner === P.i) - (b.owner === P.i) || permValue(b) - permValue(a))[0] : await pickCard(P, tie, `${name}: destroy a nonland permanent with the lowest mana value (${low})`) || tie[0];
            destroy(pick);
            break;
        }
        case 'exileCtx': { const x = G.ctxObj; if (x && onBf(x.uid)) { leaveBattlefield(x, 'exile'); log(`${name} exiles ${x.card.name}.`); } break; }
        case 'ctxCtlLoseN': { const x = G.ctxObj, n = G.ctxCount || 0; if (x && n) { const X = G.players[x.owner]; X.life -= n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life (${name}).`); } break; }
        case 'destroyBlockers': { const bs = (G.blocks[src.uid] || []).map(onBf).filter(b => b && (e.filter !== 'artifact creature' || /Artifact/.test(b.card.type))); bs.forEach(b => destroy(b)); break; }
        case 'destroyCombatPair': {
            const h = src.attachedTo && onBf(src.attachedTo); if (!h) break;
            const partners = (G.combatPairs || []).filter(x => x.turn === G.turn && (x.a === h.uid || x.b === h.uid)).map(x => onBf(x.a === h.uid ? x.b : x.a)).filter(Boolean);
            if (!partners.length) break;
            [h, ...partners].forEach(x => { if (onBf(x.uid)) destroy(x); });
            break;
        }
        case 'regrowNamed': { const c = P.gy.find(x => x.card.name === src.card.name && x !== src); const yes = c && (P.isAI || await askYes(P, `${name}: return ${c.card.name} from your graveyard to your hand?`, { card: c.card })); if (yes) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : `${P.name}'s`} hand.`); } break; }
        case 'worldslay': { const xs = allPerms().filter(x => x !== src); xs.forEach(x => destroy(x)); log(`${name} destroys ${xs.length} permanents.`); break; }
        case 'casterMana': { const X = (G.ctxRaw && G.ctxRaw.P) || P; X.pool = X.pool || []; X.pool.push(e.color); log(`${X.name} ${you(X) ? 'add' : 'adds'} {${e.color}} (${name}).`); break; }
        case 'dmgCtxPlayer': { const X = G.ctxRaw && G.ctxRaw.P; if (X) { damage(X, e.n, src); log(`${name} deals ${e.n} damage to ${X.name === 'You' ? 'you' : X.name}.`); } break; }
        case 'confusion': {
            const x = G.ctxObj; if (!x || !onBf(x.uid)) break;
            const X = G.players[x.owner], Y = G.players[1 - X.i];
            const kinds = ['Artifact', 'Creature', 'Enchantment'].filter(k => new RegExp(`\\b${k}\\b`).test(x.card.type));
            const pool = Y.bf.filter(y => kinds.some(k => new RegExp(`\\b${k}\\b`).test(y.card.type)) && !has(y, 'shroud') && !(has(y, 'hexproof')));
            if (!pool.length) break;
            const pick = X.isAI ? pool.sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(X, pool, `Confusion in the Ranks: exchange ${x.card.name} for a permanent of the same type`) || pool[0];
            giveControl(x, Y); giveControl(pick, X);
            log(`${x.card.name} and ${pick.card.name} change controllers.`);
            break;
        }
        case 'borrowActs': if (t && t.o && onBf(src.uid)) { src.borrowed = { turn: G.turn, acts: actsOf(t.o).filter(a => !a.loyalty) }; log(`${name} gains ${t.o.card.name}'s activated abilities until end of turn.`); } break;
        case 'razorBarrier': {
            if (!t || !t.o) break;
            const cols = COLORS.filter(c => O.bf.some(x => (x.card.colors || []).includes(c)));
            const arts = O.bf.filter(x => /Artifact/.test(x.card.type)).length;
            let k;
            if (P.isAI) k = arts > O.bf.filter(x => (x.card.colors || []).includes(cols[0])).length ? 'artifacts' : cols[0] || 'artifacts';
            else { const i = await pickMode(P, [[], ...COLORS.map(() => [])], { card: { ...src.card, text: ['• Artifacts', ...COLORS.map(c => `• ${COLOR_NAMES[c]}`)].join('\n') } }); k = i <= 0 ? 'artifacts' : COLORS[i - 1]; }
            t.o.tkw.push(k === 'artifacts' ? 'pro:artifacts' : `pro:${k}`);
            log(`${t.o.card.name} gains protection from ${k === 'artifacts' ? 'artifacts' : COLOR_NAMES[k]} until end of turn.`);
            break;
        }
        case 'preventNext': { const x = t && (t.p || t.o); if (x) { x.prevent = { turn: G.turn, n: ((x.prevent && x.prevent.turn === G.turn) ? x.prevent.n : 0) + e.n }; log(`The next ${e.n} damage to ${targetName(t)} this turn is prevented.`); } break; }
        case 'mournerShield': {
            const ex = src.imprinted; if (!ex) break;
            const cols = ex.card.colors || [];
            const pool = O.bf.filter(x => (x.card.colors || []).some(c => cols.includes(c)));
            if (!pool.length) { log(`${name}: no source shares a color with ${ex.card.name}.`); break; }
            const pick = P.isAI ? pool.sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, pool, `${name}: prevent all damage from a source this turn`) || pool[0];
            pick.noDmgTurn = G.turn; log(`All damage ${pick.card.name} would deal this turn is prevented.`);
            break;
        }
        case 'permAnimatePT': if (onBf(src.uid)) { src.permAnimated = { p: e.p, q: e.q }; src.card = { ...src.card, type: /Creature/.test(src.card.type) ? src.card.type : `${src.card.type.replace(/^(Land)/, 'Artifact Creature Land')} — Elemental` }; log(`${name} becomes a ${e.p}/${e.q} Elemental artifact creature that's still a land.`); } break;
        case 'dmgAttackersNoFly': { const xs = G.attackers.map(onBf).filter(x => x && !has(x, 'flying')); xs.forEach(x => damage(x, e.n, src)); log(`${name} deals ${e.n} damage to each attacking creature without flying (${xs.length}).`); break; }
        case 'exileUntilLeaves': { const x = t && t.o; if (!x || !onBf(x.uid) || !onBf(src.uid)) break; leaveBattlefield(x, 'exile'); const X = G.players[x.owner]; if (X.exile.includes(x)) x.exiledBy = src.uid; log(`${name} exiles ${x.card.name}.`); break; }
        case 'glissa': { const x = t && t.o; if (!x) break; const unspent = (P.pool || []).length; if ((x.card.cmc || 0) === unspent) destroy(x); else log(`${name}: ${x.card.name}'s mana value isn't ${unspent} (your unspent mana).`); break; }
        case 'namedCounterTarget': if (t && t.o) { t.o.ctr[e.kind] = (t.o.ctr[e.kind] || 0) + e.n; log(`${t.o.card.name} gets a ${e.kind} counter.`); } break;
        case 'loyaltyFracture': {
            const h = src.attachedTo && onBf(src.attachedTo), by = G.ctxRaw && G.ctxRaw.by;
            if (!h || by === undefined || by === h.owner) break;
            giveControl(h, G.players[by]);
            log(`${G.players[by].name} ${you(G.players[by]) ? 'gain' : 'gains'} control of ${h.card.name} (Fractured Loyalty).`);
            break;
        }
        case 'scytheReturn': {
            const c = G.players.flatMap(X => X.gy).find(x => x.uid === e.uid);
            if (!c || !onBf(src.uid)) break;
            const was = c.owner;
            putOntoBattlefield(P, c, false);
            if (was !== P.i) c.realOwner = was;
            src.attachedTo = c.uid;
            log(`${c.card.name} returns under ${P.name}'s control, and ${name} is attached to it.`);
            break;
        }
        // ---- Gitrog deck (2026-10-08) ----
        case 'blackSun': { const xs = allPerms().filter(x => isCreature(x) && (x.card.cmc || 0) <= e.n); log(`${name}: ${xs.length} creature${xs.length === 1 ? '' : 's'} with mana value ${e.n} or less lose all abilities and are destroyed.`); xs.forEach(x => { if (onBf(x.uid)) dieOrLeave(x, 'gy'); }); break; }
        case 'espers': {
            const got = []; G.players.filter(X => X !== P).forEach(X => { got.push(...X.gy.filter(x => /Creature/.test(x.card.type))); X.exile.push(...X.gy.splice(0)); });
            log(`${name} exiles ${O.name === 'You' ? 'your' : `${O.name}'s`} graveyard.`);
            const pick = P.isAI ? got.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, got, `${name}: choose a creature card exiled this way (a token copy that's only an artifact), or None`);
            if (pick) { const c = pick.front || pick.card; tokenCopyOf(P, { ...c, type: 'Artifact', power: undefined, toughness: undefined }); }
            break;
        }
        case 'thrinax': P.thrinaxN = P.thrinaxTurn === G.turn ? (P.thrinaxN || 0) + 1 : 1; P.thrinaxTurn = G.turn; log(`Until end of turn, whenever a nontoken creature ${P.name} ${you(P) ? 'control' : 'controls'} dies, ${you(P) ? 'you create' : 'they create'} Saprolings equal to its power.`); break;
        case 'emissary': {
            const cs = P.bf.filter(isCreature).length;
            const myVote = P.isAI ? (cs >= 3 ? 'security' : 'profit') : (await askYes(P, `${name}: vote for profit (2 Treasures per profit vote) or security (+1/+1 counters on each of your creatures per security vote)?`, { card: src.card, yes: 'Profit', no: 'Security' }) ? 'profit' : 'security');
            const oppVote = O.isAI ? (cs > 2 ? 'profit' : 'security') : (await askYes(O, `${name}: vote for profit (${P.name} gets 2 Treasures) or security (+1/+1 counters on each of ${P.name}'s creatures)?`, { card: src.card, yes: 'Profit', no: 'Security' }) ? 'profit' : 'security');
            const votes = [myVote, oppVote], profit = votes.filter(v => v === 'profit').length, sec = 2 - profit;
            log(`Votes: ${P.name} ${myVote}, ${O.name} ${oppVote}.`);
            if (profit) await applyEffect(P, { t: 'artToken', n: 2 * profit, kind: 'treasure' }, null, src);
            if (sec) P.bf.filter(isCreature).forEach(x => putCounters(x, sec, P));
            if (sec) log(`Each creature ${P.name} ${you(P) ? 'control' : 'controls'} gets ${sec} +1/+1 counter${sec === 1 ? '' : 's'}.`);
            break;
        }
        case 'willow': {
            const pool = P.bf.filter(x => x !== src && (isCreature(x) || x.token));
            const foes = O.bf.filter(x => isCreature(x) && !has(x, 'shroud') && !has(x, 'hexproof') && !protFrom(x, src));
            if (!pool.length || !foes.length) break;
            const f0 = pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0];
            const f = P.isAI ? (foes.some(x => tou(x) - x.dmg <= 2 && creatureValue(x) > permValue(f0)) ? f0 : null) : await pickCard(P, pool, `${name}: sacrifice another creature or a token (or None)`);
            if (!f) break;
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            const te = { t: 'pump', target: 'creature', theirs: true, good: false, p: -2, q: -2, kw: [] };
            const tt = await chooseTarget(P, te, src, false);
            if (tt && targetStillOk(tt)) await applyEffect(P, te, tt, src);
            break;
        }
        case 'shadowThrow': {
            const pool = P.bf.filter(x => x !== src && !/\bLand\b/.test(x.card.type));
            if (!pool.length) break;
            const f0 = pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - (a.card.cmc || 0) - ((b.token ? -5 : 0) + permValue(b) - (b.card.cmc || 0)))[0];
            const f = P.isAI ? (permValue(f0) <= 4 || O.life <= (f0.card.cmc || 0) ? f0 : null) : await pickCard(P, pool, `${name}: sacrifice another nonland permanent (or None)`);
            if (!f) break;
            const mv = f.card.cmc || 0;
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, isCreature(f) ? 'gy' : 'gy');
            drawCards(P, 2);
            G.players.filter(X => X !== P).forEach(X => { X.life -= mv; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${mv} life.`); });
            break;
        }
        case 'gitrogRide': {
            const pool = src.saddledTurn === G.turn ? (src.saddlers || []).map(onBf).filter(x => x && x.owner === P.i && isCreature(x)) : [];
            if (!pool.length) break;
            const f = P.isAI ? pool.sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, pool, `${name}: sacrifice a creature that saddled it (draw cards and put lands onto the battlefield), or None`);
            if (!f) break;
            const X = Math.max(0, pow(f));
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name} (power ${X}).`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            drawCards(P, X);
            for (let k = 0; k < X; k++) {
                const lands = P.hand.filter(x => Rx(x).kind === 'land');
                const l = P.isAI ? lands[0] : await pickCard(P, lands, `${name}: put a land card from your hand onto the battlefield tapped (${k + 1} of up to ${X}; None to stop)`);
                if (!l) break;
                putOntoBattlefield(P, l, true);
            }
            break;
        }
        case 'conscription': {
            const pool = G.players.filter(X => X !== P).flatMap(X => X.gy.filter(x => /Creature/.test(x.card.type) && Rx(x).kind === 'creature'));
            const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: choose a creature card from an opponent's graveyard`);
            if (!pick) break;
            const X = G.players[pick.owner];
            putOntoBattlefield(P, pick, true); pick.realOwner = X.i;
            X.exile.push(...X.gy.splice(0));
            log(`${X.name === 'You' ? 'Your' : `${X.name}'s`} graveyard is exiled.`);
            break;
        }
        case 'onceFuture': {
            const adamant = (src.greenSpent || 0) >= 3;
            const first = await pickCard(P, P.gy.filter(x => x !== src), `${name}: return a card from your graveyard to your hand`);
            if (first) { pull(P.gy, first); P.hand.push(first); log(`${first.card.name} returns to ${you(P) ? 'your' : `${P.name}'s`} hand.`); }
            const second = await pickCard(P, P.gy.filter(x => x !== src), `${name}: ${adamant ? 'return another card to your hand' : 'put another card on top of your library'} (or None)`);
            if (second) { pull(P.gy, second); if (adamant) { P.hand.push(second); log(`${second.card.name} returns to hand too (adamant).`); } else { P.library.push(second); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${second.card.name} on top of the library.`); } }
            src.exileAfter = true;
            break;
        }
        case 'rejoin': {
            const milled = P.library.splice(-3).reverse(); P.gy.push(...milled);
            log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.map(x => x.card.name).join(', ') || 'nothing'}.`);
            const pool = P.gy.filter(x => Rx(x).kind === 'creature');
            if (!pool.length) break;
            // The opponent chooses (the weakest)
            const pick = O.isAI ? pool.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0] : (await pickCard(O, pool, `${name}: choose a creature card in ${P.name}'s graveyard for them to return`)) || pool[0];
            putOntoBattlefield(P, pick, false);
            break;
        }
        case 'exileGyGain': { const X = t && t.p; if (!X) break; const n = X.gy.length; X.exile.push(...X.gy.splice(0)); if (n) { P.life += n; fire('gainLife', { P, n }); } log(`${name} exiles ${n} card${n === 1 ? '' : 's'} from ${X.name === 'You' ? 'your' : `${X.name}'s`} graveyard; ${P.name} ${you(P) ? 'gain' : 'gains'} ${n} life.`); break; }
        case 'upheaval': {
            let left = P.gy.filter(x => /Creature/.test(x.card.type)).length;
            const mine = () => P.bf.filter(x => isCreature(x) && !has(x, 'shroud'));
            if (!left || !mine().length) break;
            if (P.isAI) { const best = mine().sort((a, b) => creatureValue(b) - creatureValue(a))[0]; const got = putCounters(best, left, P); log(`${best.card.name} gets ${got} +1/+1 counters.`); break; }
            while (left > 0 && mine().length) {
                const c = await pickCard(P, mine(), `${name}: choose a creature for +1/+1 counters (${left} left)`);
                if (!c) break;
                const n = await askNumber(P, `How many of the ${left} counters on ${c.card.name}?`, 1, left, left, { card: c.card, noCancel: true });
                const got = putCounters(c, n || 1, P); log(`${c.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`);
                left -= n || 1;
            }
            break;
        }
        case 'victimize': {
            const chosen = [];
            for (let k = 0; k < 2; k++) { const pool = P.gy.filter(x => Rx(x).kind === 'creature' && !chosen.includes(x)); const c = await pickCard(P, pool, `${name}: choose a creature card in your graveyard (${k + 1} of 2)`); if (c) chosen.push(c); }
            const pool = P.bf.filter(isCreature);
            if (!pool.length) { log(`${name}: no creature to sacrifice.`); break; }
            const f = (P.isAI ? null : await pickCard(P, pool, `${name}: sacrifice a creature`)) || sacFodder(P, src, 'creature');
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
            chosen.filter(x => P.gy.includes(x)).forEach(x => putOntoBattlefield(P, x, true));
            break;
        }
        case 'powDoubleN': { if (!t || !t.o) break; const p = Math.max(0, pow(t.o)), k = Math.min(Number(e.n) || 0, 20), add = p * (2 ** k - 1); t.o.tp += add; log(`${t.o.card.name}'s power is doubled ${k} time${k === 1 ? '' : 's'} (+${add}/+0).`); break; }
        case 'oppLoseCounters': G.players.filter(X => X !== P).forEach(X => { X.poison = 0; X.energy = 0; X.exp = 0; log(`${X.name} ${you(X) ? 'lose' : 'loses'} all counters.`); }); break;
        case 'removeAllCounters': if (t && t.o) { t.o.counters = 0; t.o.ctr = {}; log(`All counters are removed from ${t.o.card.name}.`); } break;
        case 'oppExileTop': G.players.filter(X => X !== P).forEach(X => { const got = X.library.splice(-e.n).reverse(); X.exile.push(...got); log(`${X.name} ${you(X) ? 'exile' : 'exiles'} the top ${got.length} card${got.length === 1 ? '' : 's'} of the library.`); }); break;
        case 'grantEscape': P.lockerTurn = G.turn; P.lockerCost = parseCost(e.cost); P.lockerN = e.n; log(`Until end of turn, creature cards in ${you(P) ? 'your' : `${P.name}'s`} graveyard have escape ${e.cost} (exile ${e.n} other cards).`); break;
        case 'castBattleBack': {
            const X = G.players[src.owner];
            if (!X.exile.includes(src) || !src.front || !src.front.back) break;
            src.card = src.front.back;
            log(`${X.name} ${you(X) ? 'cast' : 'casts'} ${src.card.name} transformed, without paying its mana cost (rule 310.11).`);
            src.freeCast = true;
            const ok = await castSpell(X, src, null);
            src.freeCast = false;
            if (!ok) src.card = src.front;
            break;
        }
        // ---- Sandman deck (2026-10-07) ----
        case 'discoverExcess': if ((G.lastExcess || 0) > 0) await cascade(P, src, G.lastExcess); break;
        case 'drawPowTarget': if (t && t.o) drawCards(P, Math.max(0, pow(t.o))); break;
        case 'nextCreatureCounter': P.nextCreatureCounter = G.turn; log(`The next creature spell ${P.name} ${you(P) ? 'cast' : 'casts'} this turn enters with an extra +1/+1 counter.`); break;
        case 'returnSelfHandGy': { const X = G.players[src.owner]; if (X.gy.includes(src)) { pull(X.gy, src); X.hand.push(src); log(`${name} returns to ${you(X) ? 'your' : `${X.name}'s`} hand.`); } break; }
        case 'animateLands': { const ls = P.bf.filter(x => /\bLand\b/.test(x.card.type)); ls.forEach(x => { x.animated = { turn: G.turn, p: e.p, q: e.q, kw: [] }; }); log(`${P.name}'s ${ls.length} lands become ${e.p}/${e.q} creatures until end of turn.`); break; }
        case 'encore': { const tok = tokenCopyOf(P, src.front || src.card); tok.tkw.push('haste'); tok.sacAtEnd = G.turn; tok.mustAttackTurn = G.turn; log(`${tok.card.name} (encore) has haste, attacks this turn if able and is sacrificed at the end step.`); break; }
        case 'spry': {
            const cs = P.bf.filter(isCreature);
            if (cs.length < 2) { log(`${name}: you need two creatures.`); break; }
            const byPow = cs.slice().sort((x, y) => pow(y) - pow(x));
            let a = P.isAI ? byPow[0] : await pickCard(P, cs, `${name}: choose the first creature`);
            a = a || byPow[0];
            let b = P.isAI ? byPow[byPow.length - 1] : await pickCard(P, cs.filter(x => x !== a), `${name}: choose the second creature`);
            b = b || byPow.filter(x => x !== a).pop();
            const X = Math.abs(pow(a) - pow(b));
            drawCards(P, X);
            [a, b].forEach(c => { c.tp += X; c.tq += X; c.tkw.push('trample'); });
            log(`${a.card.name} and ${b.card.name} get +${X}/+${X} and trample; ${P.name} ${you(P) ? 'draw' : 'draws'} ${X}.`);
            break;
        }
        case 'genesis': {
            const n = Math.max(0, e.n || 0);
            const top = P.library.splice(Math.max(0, P.library.length - n)).reverse();
            log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.length} card${top.length === 1 ? '' : 's'}.`);
            const put = top.filter(x => !['instant', 'sorcery'].includes(Rx(x).kind) && (x.card.cmc || 0) <= n);
            for (const x of put) { putOntoBattlefield(P, x, false); if (Rx(x).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: x, effects: Rx(x).etb }); }
            top.filter(x => !put.includes(x)).forEach(x => P.gy.push(x));
            log(`${put.length} permanent${put.length === 1 ? '' : 's'} enter the battlefield; ${top.length - put.length} go to the graveyard.`);
            break;
        }
        // ---- Tyrox deck (2026-10-08) ----
        case 'goblinGuide': { // Goblin Guide: the defending player reveals their top card and takes it if it's a land
            const top = O.library[O.library.length - 1];
            if (!top) { log(`${name}: ${O.name} ${you(O) ? 'have' : 'has'} no cards in the library.`); break; }
            log(`${O.name} ${you(O) ? 'reveal' : 'reveals'} ${top.card.name}.`);
            if (/\bLand\b/.test(top.card.type)) { O.library.pop(); O.hand.push(top); log(`It's a land: ${O.name} puts it into ${you(O) ? 'your' : 'their'} hand.`); }
            break;
        }
        case 'celebrant': { // Combat Celebrant: untap the other creatures, then an additional combat phase
            const ut = P.bf.filter(x => isCreature(x) && x !== src && x.tapped);
            ut.forEach(x => { x.tapped = false; });
            G.extraCombat = (G.extraCombat || 0) + 1;
            log(`${P.name} untap${you(P) ? '' : 's'} ${ut.length} other creature${ut.length === 1 ? '' : 's'}; there will be an additional combat phase after this one.`);
            break;
        }
        case 'rabble': { // Goblin Rabblemaster: +1/+0 for each other attacking Goblin
            const n = (G.attackers || []).map(onBf).filter(x => x && x !== src && x.owner === src.owner && hasType(x, 'Goblin')).length;
            if (n) { src.tp += n; log(`${name} gets +${n}/+0 until end of turn.`); }
            break;
        }
        case 'druidPurify': {
            const pool = O.bf.filter(x => /\b(?:Artifact|Enchantment)\b/.test(x.card.type));
            const pick = P.isAI ? pool.sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${name}: choose an artifact or enchantment you don't control to destroy (or None)`);
            if (pick) { log(`${P.name} ${you(P) ? 'choose' : 'chooses'} ${pick.card.name}.`); destroy(pick); }
            else log(`${name}: nothing chosen.`);
            break;
        }
        case 'feedPack': {
            const pool = P.bf.filter(x => isCreature(x) && !x.token);
            const pick = P.isAI ? pool.filter(x => tou(x) >= 4 && !x.isCommander && creatureValue(x) <= tou(x) * 2).sort((a, b) => tou(b) - tou(a))[0] : await pickCard(P, pool, `${name}: sacrifice a nontoken creature for 2/2 Wolves equal to its toughness (or None)`);
            if (!pick) break;
            const n = Math.max(0, tou(pick));
            log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${pick.card.name}.`);
            fire('sacrificed', { o: pick }); dieOrLeave(pick, 'gy');
            if (n) await applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'green wolf', kw: [] }, null, src);
            break;
        }
        case 'colossus': {
            for (let k = 0; k < 40; k++) {
                const lands = P.hand.filter(x => Rx(x).kind === 'land');
                if (!lands.length) break;
                const pick = P.isAI ? lands[0] : await pickCard(P, lands, `${name}: put a land onto the battlefield tapped and draw a card (or None to stop)`);
                if (!pick) break;
                pull(P.hand, pick); resetObj(pick); pick.tapped = true; P.bf.push(pick);
                log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} onto the battlefield tapped and ${you(P) ? 'draw' : 'draws'} a card.`);
                fire('landfall', { o: pick });
                drawCards(P, 1);
            }
            break;
        }
        case 'millLands': {
            const n = G.ctxCount || 0;
            const milled = P.library.splice(Math.max(0, P.library.length - n)).reverse();
            P.gy.push(...milled);
            const lands = milled.filter(x => /\bLand\b/.test(x.card.type));
            lands.forEach(x => { pull(P.gy, x); resetObj(x); x.tapped = true; P.bf.push(x); fire('landfall', { o: x }); });
            log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.length} and ${you(P) ? 'put' : 'puts'} ${lands.length} land${lands.length === 1 ? '' : 's'} onto the battlefield tapped.`);
            break;
        }
        case 'zombieCopy': {
            const pool = P.gy.filter(x => /Creature/.test(x.card.type) && (x.card.cmc || 0) === e.n);
            const pick = P.isAI ? pool.sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${name}: exile a creature card with mana value ${e.n}`);
            if (!pick) { log(`${name}: no creature card with mana value ${e.n}.`); break; }
            pull(P.gy, pick); P.exile.push(pick);
            const card = pick.front || pick.card;
            tokenCopyOf(P, { ...card, type: `${card.type.split('—')[0].trim()} — Zombie`, colors: ['B'] }, { p: 4, q: 4 });
            break;
        }
        case 'conduit': {
            if ((G.castBy || [0, 0])[P.i] > 0) { log(`${name}: ${P.name} already cast a spell this turn.`); break; }
            const pool = P.gy.filter(x => !['instant', 'sorcery', 'land'].includes(Rx(x).kind) && Rx(x).support !== 'none' && canPay(P, x));
            const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: cast a permanent card from your graveyard (or None)`);
            if (!pick) break;
            const te = firstTargetEffect(pick), tg = te ? await chooseTarget(P, te, pick, true) : null;
            if (te && !tg) break;
            if (!payFor(P, pick)) break;
            pull(P.gy, pick);
            G.stack.push({ id: stackSeq++, kind: 'spell', o: pick, P, target: tg, name: pick.card.name, x: 0 });
            (G.castBy = G.castBy || [0, 0])[P.i]++; G.castThisTurn = (G.castThisTurn || 0) + 1;
            P.noMoreSpellsTurn = G.turn;
            log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${pick.card.name} from the graveyard and can't cast more spells this turn.`);
            fire('cast', { P, o: pick });
            break;
        }
        case 'regrowBudget': {
            let left = G.lastRoll || 0;
            for (let k = 0; k < 60; k++) {
                const pool = P.gy.filter(x => x !== src && (x.card.cmc || 0) <= left);
                if (!pool.length) break;
                const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return a card (mana value ${left} or less left; None to stop)`);
                if (!pick) break;
                left -= pick.card.cmc || 0;
                pull(P.gy, pick); P.hand.push(pick);
                log(`${pick.card.name} returns to ${you(P) ? 'your' : `${P.name}'s`} hand.`);
            }
            break;
        }
        case 'caradhras': {
            // Council's dilemma, two players: each votes once
            const Q = O, bestGy = Math.max(0, ...P.gy.map(x => x.card.cmc || 0)), hasBasic = P.library.some(x => landFits(x, 'basic land'));
            const mine = P.isAI ? (hasBasic && P.bf.filter(x => /\bLand\b/.test(x.card.type)).length < 8 ? 'Redhorn Pass' : 'Mines of Moria') : (await askYes(P, `${name}: vote Redhorn Pass (a basic land onto the battlefield)? (Cancel = Mines of Moria: return a card from your graveyard)`, { card: src.card, yes: 'Redhorn Pass', no: 'Mines of Moria' })) ? 'Redhorn Pass' : 'Mines of Moria';
            const theirs = Q.isAI ? (bestGy >= 4 ? 'Redhorn Pass' : 'Mines of Moria') : (await askYes(Q, `${name}: ${P.name} asks for votes. Vote Redhorn Pass? (Cancel = Mines of Moria)`, { card: src.card, yes: 'Redhorn Pass', no: 'Mines of Moria' })) ? 'Redhorn Pass' : 'Mines of Moria';
            log(`Votes: ${P.name} - ${mine}; ${Q.name} - ${theirs}.`);
            const votes = [mine, theirs];
            for (const v of votes.filter(x => x === 'Redhorn Pass')) { void v; await applyChoiceEffect(P, { t: 'fetchLand', n: 1, what: 'basic land', bf: true, tapped: true }, src); }
            for (const v of votes.filter(x => x === 'Mines of Moria')) { void v; await applyChoiceEffect(P, { t: 'regrow', what: 'card' }, src); }
            break;
        }
        case 'countersEntered': { const xs = P.bf.filter(x => isCreature(x) && (x.card.colors || []).includes(e.color) && (G.entered || []).some(en => en.turn === G.turn && en.o === x)); xs.forEach(x => putCounters(x, 1)); log(`${xs.length} creature${xs.length === 1 ? '' : 's'} get a +1/+1 counter.`); break; }
        case 'flashTurn': P.flashTurn = G.turn; log(`${P.name} may cast spells as though they had flash this turn.`); break;
        case 'monarch': G.monarch = P.i; log(`${P.name} ${you(P) ? 'become' : 'becomes'} the monarch.`); break;
        case 'copySpell': {
            const it = t.item;
            if (!G.stack.includes(it) || it.kind !== 'spell') break;
            G.stack.push({ id: stackSeq++, kind: 'trigger', o: it.o, P, target: null, effects: withX(spellEffects(it.o), it.x), name: `Copy of ${it.name}`, copy: true });
            log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${it.name}.`);
            break;
        }
        case 'counter': {
            const it = t.item;
            const i = G.stack.indexOf(it);
            if (i < 0) break;
            const unless = e.unlessFrom === 'myArtifacts' ? P.bf.filter(x => /Artifact/.test(x.card.type)).length : e.unlessFrom ? Math.max(0, ...P.bf.filter(isCreature).map(pow)) : e.unless;
            if (unless) {
                const plan = planPayment(it.P, { generic: unless, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
                if (plan) { plan.forEach(x => tapSource(it.P, x)); log(`${it.P.name} ${you(it.P) ? 'pay' : 'pays'} {${unless}}, so ${it.name} isn't countered.`); break; }
            }
            if (it.kind === 'spell' && (Rx(it.o).uncounterable || it.o.noCounter || it.P.bf.some(x => { const u = Rx(x).spellsUncounterable; return u && !lostAbilities(x) && (u === 'all' || (u === 'creature' && Rx(it.o).kind === 'creature')); }))) { log(`${it.name} can't be countered.`); break; }
            if (it.kind === 'spell' && ['instant', 'sorcery'].includes(Rx(it.o).kind) && it.P.bf.some(x => Rx(x).protectSpells)) { log(`${it.name} can't be countered.`); break; }
            G.lastCountered = it; G.lastPower = { P: it.P, n: 0 }; G.lastMv = it.o.card.cmc || 0;
            G.stack.splice(i, 1);
            log(`${it.name} is countered (rule 701.6a).`);
            if (it.kind === 'spell' && e.exileCast && !['instant', 'sorcery'].includes(Rx(it.o).kind)) {
                const x = it.o; moveSpellCard(x, 'exile');
                const X = G.players[x.owner]; pull(X.exile, x);
                x.realOwner = x.owner; x.owner = P.i; x.playUntil = 1e9; x.freeCast = true; P.exile.push(x);
                log(`${x.card.name} is exiled - ${P.name === 'You' ? 'you' : P.name} may cast it free.`);
            } else if (it.kind === 'spell') moveSpellCard(it.o, e.exileIt ? 'exile' : 'gy');
            break;
        }
        default: await preconEffect(P, e, t, src, O, name); // the precon rounds (15b-precon-effects.js)
    }
}

// Equip: sorcery speed, pay the Equip cost, attach to your creature.
// The Equip cost to pay: "Equip Halfling {1}", minus "Equip abilities you activate cost {1} less"
// "Equip legendary creature {3}", "Equip commander {3}", "Equip Knight {1}"
function equipFits(c, type) { return type === 'legendary creature' ? /\bLegendary\b/.test(c.card.type) : type === 'commander' ? !!c.isCommander : hasType(c, type); }
function equipOk(eq, c) { const only = Rx(eq).equipOnly; return !dampingOn() && (!only || equipFits(c, only)); }
function equipCost(P, eq, creature) {
    const cheap = Rx(eq).equipCheap;
    // Puresteel Paladin: equip {0} with metalcraft
    if (P.bf.some(x => Rx(x).equipZeroIf && !lostAbilities(x) && condOk(Rx(x).equipZeroIf, P, x))) return parseCost('{0}');
    const c = cheap && creature && equipFits(creature, cheap.type) && planPayment(P, cheap.cost, 0, null, { forType: eq.card.type }) ? cheap.cost : Rx(eq).equip;
    const cut = P.bf.reduce((a, x) => a + (Rx(x).equipLess || 0), 0) + (creature ? Rx(creature).equipLessSelf || 0 : 0);
    return cut ? { ...c, generic: Math.max(0, c.generic - cut) } : c;
}
async function equip(P, eq, creature) {
    if (!equipOk(eq, creature)) return false;
    if (Rx(eq).equipLife) { if (P.life <= Rx(eq).equipLife) return false; P.life -= Rx(eq).equipLife; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${Rx(eq).equipLife} life to equip ${eq.card.name}.`); }
    const cost = equipCost(P, eq, creature);
    const plan = planPayment(P, cost, 0, null, { forType: eq.card.type });
    if (!plan) return false;
    plan.forEach(s => tapSource(P, s));
    eq.attachedTo = creature.uid;
    log(`${P.name} ${you(P) ? 'equip' : 'equips'} ${eq.card.name} to ${creature.card.name}.`);
    renderGame();
    return true;
}

// ---- Combat ----
function canBlock(b, atk) {
    if (!isCreature(b) || b.tapped || has(b, 'cantblock')) return false;
    if (Rx(atk).spy && !lostAbilities(atk) && ctrl(b).bf.some(x => /Artifact/.test(x.card.type))) return false; // Neurok Spy
    if (auraTaxOn(b) && !planPayment(ctrl(b), parseCost(''), auraTaxOn(b))) return false; // Oppressive Rays: it can only block if its controller can pay
    if (Rx(b).protoTax && b.counters > 0 && !planPayment(ctrl(b), parseCost(''), b.counters)) return false; // Myr Prototype
    if (b.detainedUntil > G.turn || lockedOut(b)) return false;
    if (has(b, 'unleash') && b.counters > 0) return false; // unleash (702.98)
    if (Rx(b).blockCond && !condOk(Rx(b).blockCond, ctrl(b), b)) return false;
    if (G.onlyBlocker && G.onlyBlocker.turn === G.turn && b.uid !== G.onlyBlocker.uid && onBf(G.onlyBlocker.uid) && ctrl(onBf(G.onlyBlocker.uid)) === ctrl(b)) return false; // Mark for Death
    for (const f of Rx(b).blockerFns || []) if (!lostAbilities(b) && !BLOCKER_FN[f](b, atk)) return false; // Ironclaw Orcs
    for (const f of Rx(atk).blockFns || []) if (!lostAbilities(atk) && !BLOCK_FN[f](b, atk)) return false; // Elven Riders, Bog Rats
    if (has(b, 'blockflyonly') && !has(atk, 'flying')) return false;
    if (has(atk, 'blockflyreach') && !has(b, 'flying') && !has(b, 'reach')) return false;
    for (const k of [...Rx(atk).kw, ...atk.tkw]) {
        let m;
        if ((m = k.match(/^blockonly:(\w+)$/)) && !hasType(b, m[1])) return false;
        if ((m = k.match(/^blockonlycolor:(\w)$/)) && !(b.card.colors || []).includes(m[1])) return false; // Dread Warlock
        if ((m = k.match(/^blockpowgt:(\d+)$/)) && pow(b) <= +m[1]) return false;
    }
    if (protFrom(atk, b)) return false;
    if (has(atk, 'unblockable')) return false;
    // Lambholt Pacifist-style: "Creatures with power less than ~'s power can't block creatures you control"
    if (ctrl(atk).bf.some(a => Rx(a).lambholt && !lostAbilities(a) && pow(b) < pow(a))) return false;
    if (has(atk, 'flying') && !has(b, 'flying') && !has(b, 'reach')) return false;
    if (has(atk, 'shadow') !== has(b, 'shadow')) return false; // 702.28b
    if (has(atk, 'horsemanship') && !has(b, 'horsemanship')) return false;
    if (has(atk, 'fear') && !(/Artifact/.test(b.card.type) || (b.card.colors || []).includes('B'))) return false;
    if (has(atk, 'intimidate') && !(/Artifact/.test(b.card.type) || (b.card.colors || []).some(c => (atk.card.colors || []).includes(c)))) return false;
    if (has(atk, 'skulk') && pow(b) > pow(atk)) return false;
    for (const [kw, land] of [['swampwalk', 'Swamp'], ['islandwalk', 'Island'], ['forestwalk', 'Forest'], ['mountainwalk', 'Mountain'], ['plainswalk', 'Plains']])
        if (has(atk, kw) && ctrl(b).bf.some(l => new RegExp(`\\b${land}\\b`).test(l.card.type))) return false;
    if (has(atk, 'nonbasic landwalk') && ctrl(b).bf.some(l => /\bLand\b/.test(l.card.type) && !/\bBasic\b/.test(l.card.type))) return false;
    return true;
}
// Ghostly Prison, Propaganda: {2} (or {X}) for each creature attacking you
function attackTax(P) {
    return opp(P).bf.reduce((a, x) => { const t = Rx(x).attackTax; if (!t || lostAbilities(x)) return a; return a + (t === 'enchantments' ? opp(P).bf.filter(e => /Enchantment/.test(e.card.type)).length : t); }, 0);
}
function declareAttackers(P, list) {
    if (list.length === 1 && has(list[0], 'notalone')) { log(`${list[0].card.name} can't attack alone.`); list = []; }
    const tax = list.length ? attackTax(P) : 0;
    if (tax) {
        let n = list.length;
        while (n > 0 && !planPayment(P, parseCost(''), tax * n)) n--;
        if (n < list.length) { log(`${P.name} can only pay the attack tax for ${n} creature${n === 1 ? '' : 's'}.`); list = list.slice().sort((a, b) => pow(b) - pow(a)).slice(0, n); }
        if (n) { planPayment(P, parseCost(''), tax * n).forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} {${tax * n}} to attack.`); }
    }
    // Myr Prototype: pay {1} for each +1/+1 counter to attack
    list = list.filter(o => { if (!Rx(o).protoTax || o.counters <= 0) return true; const plan = planPayment(P, parseCost(''), o.counters); if (!plan) { log(`${o.card.name} can't attack - ${P.name} can't pay {${o.counters}}.`); return false; } plan.forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} {${o.counters}} for ${o.card.name} to attack.`); return true; });
    list = list.filter(o => { const t = auraTaxOn(o); if (!t) return true; const plan = planPayment(P, parseCost(''), t); if (!plan) { log(`${o.card.name} can't attack - ${P.name} can't pay {${t}}.`); return false; } plan.forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} {${t}} for ${o.card.name} to attack.`); return true; });
    G.attackedN = { turn: G.turn, p: P.i, n: list.length };
    G.attackers = list.map(o => o.uid);
    list.forEach(o => { o.attackedTurn = G.turn; });
    list.forEach(o => { if (!has(o, 'vigilance')) { o.tapped = true; fire('tapped', { o }); } });
    G.blocks = {};
    log(`${P.name} ${you(P) ? 'attack' : 'attacks'} with ${list.map(o => `${o.card.name}${o.attackPW && onBf(o.attackPW) ? ` (at ${onBf(o.attackPW).card.name})` : ''}`).join(', ')}.`);
    // Exalted: a creature attacking alone gets +1/+1 for each exalted instance (702.83)
    if (list.length === 1) { const n = P.bf.filter(o => has(o, 'exalted')).length; if (n) { list[0].tp += n; list[0].tq += n; log(`Exalted: ${list[0].card.name} gets +${n}/+${n} until end of turn.`); } }
    fire('attacks', { list });
}
// Blocking rules checked once blocks are set: menace, "three or more", "no more than one",
// "can't block alone", and lure ("all creatures able to block it do so", 509.1c)
function fireBlocked() {
    // Myr Prototype: pay {1} for each +1/+1 counter to block
    Object.values(G.blocks).flat().map(onBf).filter(b => b && Rx(b).protoTax && b.counters > 0).forEach(b => { const plan = planPayment(ctrl(b), parseCost(''), b.counters); if (plan) { plan.forEach(x => tapSource(ctrl(b), x)); log(`${ctrl(b).name} ${you(ctrl(b)) ? 'pay' : 'pays'} {${b.counters}} for ${b.card.name} to block.`); } else Object.keys(G.blocks).forEach(k => { G.blocks[k] = G.blocks[k].filter(u => u !== b.uid); }); });
    G.combatPairs = (G.combatPairs || []).filter(x => x.turn === G.turn);
    Object.entries(G.blocks).forEach(([a, bs]) => bs.forEach(b => G.combatPairs.push({ turn: G.turn, a: Number(a), b })));
    G.attackers.map(onBf).filter(o => o && (G.blocks[o.uid] || []).length).forEach(o => fire('blocked', { o }));
    G.attackers.map(onBf).filter(o => o && !(G.blocks[o.uid] || []).length).forEach(o => fire('unblocked', { o }));
}
function fixMenace() {
    preconLure();
    Object.entries(G.blocks).forEach(([a, bs]) => {
        const atk = onBf(Number(a));
        if (atk && has(atk, 'menace') && bs.length === 1) { delete G.blocks[a]; log(`${atk.card.name} has menace - it can't be blocked by just one creature.`); }
        else if (atk && has(atk, 'minblock3') && bs.length < 3) { delete G.blocks[a]; log(`${atk.card.name} can't be blocked except by three or more creatures.`); }
        else if (atk && (has(atk, 'maxoneblock') || G.players[atk.owner].bf.some(a => Rx(a).bigOneBlock && pow(atk) >= Rx(a).bigOneBlock && !lostAbilities(a))) && bs.length > 1) { G.blocks[a] = bs.slice(0, 1); log(`${atk.card.name} can't be blocked by more than one creature.`); }
    });
    // "Must be blocked this turn if able": one creature able to block it does
    G.attackers.map(onBf).filter(o => o && has(o, 'mustbeblocked') && !(G.blocks[o.uid] || []).length).forEach(atk => {
        const D = G.players[1 - atk.owner];
        const free = D.bf.find(b => canBlock(b, atk) && !Object.values(G.blocks).some(bs => bs.includes(b.uid)));
        if (free) { (G.blocks[atk.uid] = G.blocks[atk.uid] || []).push(free.uid); log(`${free.card.name} must block ${atk.card.name}.`); }
    });
    const lure = G.attackers.map(onBf).find(o => o && has(o, 'lure'));
    if (lure) {
        const D = G.players[1 - lure.owner];
        D.bf.filter(b => canBlock(b, lure)).forEach(b => {
            if ((G.blocks[lure.uid] || []).includes(b.uid)) return;
            Object.keys(G.blocks).forEach(k => { G.blocks[k] = G.blocks[k].filter(u => u !== b.uid); if (!G.blocks[k].length) delete G.blocks[k]; });
            (G.blocks[lure.uid] = G.blocks[lure.uid] || []).push(b.uid);
        });
        if ((G.blocks[lure.uid] || []).length) log(`Every creature able to block ${lure.card.name} does.`);
    }
    const blockers = [...new Set(Object.values(G.blocks).flat())];
    if (blockers.length === 1 && has(onBf(blockers[0]) || { card: { name: '' }, tkw: [] }, 'notalone')) { G.blocks = {}; log(`${onBf(blockers[0]).card.name} can't block alone.`); }
}
function combatDamage(A) {
    const D = opp(A);
    const atks = G.attackers.map(onBf).filter(Boolean);
    const blockersOf = atk => (G.blocks[atk.uid] || []).map(onBf).filter(Boolean);
    const everyone = [...atks, ...atks.flatMap(blockersOf)];
    const firstStep = everyone.some(o => has(o, 'first strike') || has(o, 'double strike'));
    for (const step of firstStep ? ['first', 'regular'] : ['regular']) {
        const deals = o => !firstStep || (step === 'first' ? (has(o, 'first strike') || has(o, 'double strike')) : (!has(o, 'first strike') || has(o, 'double strike')));
        const events = [];
        const left = {};
        for (const atk of atks) {
            if (!onBf(atk.uid)) continue;
            const blocked = (G.blocks[atk.uid] || []).length > 0;
            const blks = blockersOf(atk);
            if (deals(atk)) {
                let dmg = pow(atk);
                if (dmg > 0) {
                    const pw = atk.attackPW && onBf(atk.attackPW);
                    if (!blocked) events.push([atk, pw && (isPlaneswalker(pw) || isBattle(pw)) ? pw : D, dmg]);
                    else {
                        blks.forEach((b, i) => {
                            if (dmg <= 0) return;
                            const lethal = has(atk, 'deathtouch') ? 1 : Math.max(0, tou(b) - b.dmg);
                            const give = (i === blks.length - 1 && !has(atk, 'trample')) ? dmg : Math.min(dmg, lethal);
                            if (give > 0) events.push([atk, b, give]);
                            dmg -= give;
                        });
                        if (dmg > 0 && has(atk, 'trample')) { const pw = atk.attackPW && onBf(atk.attackPW); events.push([atk, pw && (isPlaneswalker(pw) || isBattle(pw)) ? pw : D, dmg]); }
                    }
                }
            }
            blks.forEach(b => {
                if (!deals(b) || pow(b) <= 0) return;
                const many = Object.values(G.blocks).filter(bs => bs.includes(b.uid)).length;
                if (many < 2) { events.push([b, atk, pow(b)]); return; }
                // A blocker on two attackers splits its damage: lethal to the first, the rest to the next (510.1c)
                left[b.uid] = left[b.uid] ?? pow(b);
                const give = Math.min(left[b.uid], Math.max(1, tou(atk) - atk.dmg));
                if (give > 0) { events.push([b, atk, give]); left[b.uid] -= give; }
            });
        }
        const toPlayer = events.filter(([, t]) => t.life !== undefined).reduce((a, [, , n]) => a + n, 0);
        if (G.fog === G.turn) { if (events.length) log('Combat damage is prevented.'); events.length = 0; }
        if (G.noPrevent !== G.turn) {
            const keep = events.filter(([src, t]) => !(t.life !== undefined && t.fogSelf === G.turn) && !(G.fogNoCounters === G.turn && src.counters <= 0) && !has(src, 'nocombatdmg') && !(t.card && has(t, 'nocombatdmg')));
            if (keep.length < events.length) { log('Some combat damage is prevented.'); events.splice(0, events.length, ...keep); }
        }
        G.inCombatDamage = true;
        events.forEach(([src, t, n]) => damage(t, n, src));
        G.inCombatDamage = false;
        // Freerunning (702.173): an Assassin or commander dealt combat damage to a player this turn
        events.filter(([src, t]) => t.life !== undefined && (hasType(src, 'Assassin') || src.isCommander)).forEach(([src]) => { G.players[src.owner].freerunTurn = G.turn; });
        [...new Set(events.filter(([, t]) => t.life !== undefined).map(([src]) => src))].forEach(src => {
            if (G.monarch === D.i && src.owner !== D.i) { G.monarch = src.owner; log(`${G.players[src.owner].name} ${you(G.players[src.owner]) ? 'become' : 'becomes'} the monarch.`); }
            if (Rx(src).toxic) { D.poison += Rx(src).toxic; log(`${src.card.name}: toxic ${Rx(src).toxic} (${D.name} ${you(D) ? 'have' : 'has'} ${D.poison} poison).`); }
            fire('hitPlayer', { src, n: events.filter(([s2, t]) => s2 === src && t.life !== undefined).reduce((a, [, , n]) => a + n, 0) });
        });
        if (toPlayer) { log(`${D.name} ${you(D) ? 'take' : 'takes'} ${toPlayer} combat damage.`); D.combatHitTurn = G.turn; }
        if (toPlayer) fire('combatHitAny', { P: A, list: [...new Set(events.filter(([, t]) => t.life !== undefined).map(([src]) => src))] });
        // Cipher (702.99): a creature with an encoded spell casts a copy when it hits a player
        events.filter(([src, t]) => t.life !== undefined && src.ciphered && src.ciphered.length).forEach(([src]) => src.ciphered.forEach(c => { (G.trigQ = G.trigQ || []).push({ P: A, o: src, effects: rulesFor(c).spell || [] }); log(`${src.card.name} casts a copy of ${c.name} (cipher).`); }));
        // Subira: until end of turn, small creatures that hit draw a card
        if (A.drawOnSmallHit === G.turn) events.filter(([src, t]) => t.life !== undefined && pow(src) <= 2).forEach(() => drawCards(A, 1));
        sba();
        if (G.over) return;
    }
    atks.forEach(a => { delete a.attackPW; });
    [...new Set([...G.attackers, ...Object.values(G.blocks || {}).flat()])].map(onBf).filter(x => x && Rx(x).clockwork && x.counters > 0 && !lostAbilities(x)).forEach(x => { x.counters--; log(`${x.card.name} loses a +1/+1 counter (end of combat).`); });
    allPerms().filter(o => o.sacEndCombat).forEach(o => { log(`${o.card.name} is sacrificed at end of combat.`); dieOrLeave(o, 'gy'); });
    G.attackers = [];
    G.blocks = {};
}

// ---- Turns ----
async function beginTurn() {
    if (G.over) return;
    const P = G.players[G.active];
    G.phase = 'beginning';
    P.landsPlayed = 0;
    opp(P).bf.forEach(o => { if (o.tapped && grantsOn(o).some(g => g.untapEach)) { o.tapped = false; } });
    // Seedborn Muse, Unwinding Clock: untap during each other player's untap step
    opp(P).bf.filter(a => Rx(a).untapOthers && !lostAbilities(a)).forEach(a => { const w = Rx(a).untapOthers; opp(P).bf.forEach(o => { if (w === '~' ? o === a : w === 'all artifacts' ? /Artifact/.test(o.card.type) : true) o.tapped = false; }); });
    P.handAtStart = P.hand.length;
    const wasTapped = P.bf.filter(o => o.tapped);
    P.bf.forEach(o => { if (o.skipUntap) { o.skipUntap = false; } else if (o.tapped && (o.ctr.stun || 0) > 0) { o.ctr.stun--; log(`${o.card.name} stays tapped (a stun counter is removed).`); } else if (!has(o, 'nountap') && !(o.lockedBy && onBf(o.lockedBy) && onBf(o.lockedBy).tapped) && !(Rx(o).mayNotUntap && o.tapped && allPerms().some(l => l.lockedBy === o.uid))) o.tapped = false; o.sick = false; });
    mesmeric(P, wasTapped.filter(o => !o.tapped).length);
    // Mindslaver: this turn is played by its controller (the computer plays it against this player's interest)
    if (P.slavedTurn && P.slavedTurn.from < G.turn) { P.slaved = P.slavedTurn; delete P.slavedTurn; log(`${G.players[P.slaved.by].name} ${you(G.players[P.slaved.by]) ? 'control' : 'controls'} ${P.name}'s turn (Mindslaver).`); }
    G.trigCount = 0;
    G.combatFired = false; G.extraCombat = 0; G.extraCombatOn = false;
    G.castThisTurn = 0;
    G.lastCastBy = G.castBy || [0, 0];
    G.castBy = [0, 0];
    emptyPools();
    log(`— Turn ${G.turn}: ${you(P) ? 'your' : `${P.name}'s`} turn —`);
    G.phase = 'upkeep';
    await runDelayed('upkeep', P);
    // Echo (702.30): pay its echo cost at your next upkeep, or sacrifice it
    for (const o of P.bf.filter(x => x.echoDue && Rx(x).echo)) {
        o.echoDue = false;
        const plan = planPayment(P, Rx(o).echo);
        const pay = plan && (P.isAI || AUTOPLAY ? P.hand.filter(h => Rx(h).kind !== 'land').length <= 2 || creatureValue(o) >= 4 : await askYes(P, `Echo: pay ${costSymbols(Rx(o).echo)} to keep ${o.card.name}? (Cancel = sacrifice it.)`, { card: o.card }));
        if (pay) { plan.forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} the echo for ${o.card.name}.`); }
        else { log(`${P.name} ${you(P) ? "don't" : "doesn't"} pay the echo - ${o.card.name} is sacrificed.`); fire('sacrificed', { o }); dieOrLeave(o, 'gy'); }
    }
    // Cumulative upkeep (702.24): an age counter, then pay for each or sacrifice it
    for (const o of P.bf.filter(x => Rx(x).cumUpkeep && !lostAbilities(x))) {
        o.ctr.age = (o.ctr.age || 0) + 1;
        const n = o.ctr.age, c = Rx(o).cumUpkeep, cost = { ...c };
        ['generic', 'W', 'U', 'B', 'R', 'G', 'C'].forEach(k => { cost[k] = (c[k] || 0) * n; });
        const plan = planPayment(P, cost);
        const pay = plan && (P.isAI || AUTOPLAY ? n <= 3 && availableMana(P) - costTotal(cost) >= 2 : await askYes(P, `Cumulative upkeep: pay ${costSymbols(cost)} to keep ${o.card.name} (${n} age counter${n === 1 ? '' : 's'})? (Cancel = sacrifice it.)`, { card: o.card }));
        if (pay) { plan.forEach(x => tapSource(P, x)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${costSymbols(cost)} cumulative upkeep for ${o.card.name}.`); }
        else { log(`${P.name} ${you(P) ? "don't" : "doesn't"} pay the cumulative upkeep - ${o.card.name} is sacrificed.`); fire('sacrificed', { o }); dieOrLeave(o, 'gy'); }
    }
    fire('upkeep');
    await settle();
    if (G.over) return;
    await upkeepGyActs(P);
    if (G.over) return;
    const skipDraw = P.skip && P.skip.turn === G.turn && P.skip.what === 'draw';
    if (!G.firstTurn && !skipDraw) { G.inDrawStep = true; drawCards(P, 1, P.i === 1); G.inDrawStep = false; }
    G.firstTurn = false;
    // Sagas get a lore counter at the start of the precombat main phase (714.3b)
    P.bf.filter(o => Rx(o).saga && !o.sagaDone).forEach(o => { o.ctr.lore = (o.ctr.lore || 0) + 1; sagaChapter(P, o); });
    await settle();
    if (G.over) return;
    sba();
    if (G.over) return;
    G.phase = 'main1';
    await runDelayed('main', P);
    fire('main1');
    await settle();
    if (G.over) return;
    G.busy = P.isAI || !!P.slaved;
    renderGame();
    if (P.slaved) { await slavedTurn(P); return; }
    if (P.isAI) await aiTurn(P);
}
// Abilities that work only during your upkeep (Grim Reminder, Nim Devourer): offered then
async function upkeepGyActs(P) {
    for (const o of P.gy.slice()) {
        for (const a of (Rx(o).gyActs || []).filter(x => x.upkeepOnly)) {
            if (!P.gy.includes(o) || !canActivate(P, o, a)) continue;
            const yes = P.isAI || AUTOPLAY ? (a.effects.some(e => e.t === 'nimDevour') ? P.bf.some(x => isCreature(x) && creatureValue(x) < 3) : true) : await askYes(P, `Upkeep: ${o.card.name} - ${a.text.replace(/~/g, o.card.name)}?`, { card: o.card });
            if (yes) { await activate(P, o, a); await settle(); }
        }
    }
}
// A turn under Mindslaver: its controller makes the choices. The computer plays it against the player:
// lands are played, nothing is cast, every creature attacks.
async function slavedTurn(P) {
    const by = G.players[P.slaved.by];
    delete P.slaved;
    aiPlayLand(P);
    await settle();
    if (G.over) return;
    G.phase = 'combat';
    fire('combat'); await settle();
    const atk = P.bf.filter(canAttackWith);
    if (atk.length && !(P.skip && P.skip.turn === G.turn && P.skip.what === 'combat')) {
        G.phase = 'declareAttackers'; declareAttackers(P, atk); await settle(); if (G.over) return;
        G.phase = 'declareBlocks';
        const D = opp(P);
        G.blocks = D.isAI ? aiChooseBlocks(D, P) : {};
        if (!D.isAI && D.bf.some(o => isCreature(o) && !o.tapped)) { G.busy = false; await new Promise(resolve => { G.mode = { type: 'block', who: D.i, picked: null, resolve }; renderGame(); }); G.busy = true; }
        fixMenace(); fireBlocked(); logBlocks(); await settle(); if (G.over) return;
        await combatDamage(P); await settle(); if (G.over) return;
    }
    log(`${by.name} ${you(by) ? 'end' : 'ends'} ${P.name}'s turn.`);
    await endTurn(P);
}

// Delayed triggers: "at the beginning of the next turn's upkeep", "at the beginning of your next main phase"
async function runDelayed(at, active) {
    const due = (G.delayed || []).filter(d => d.at === at && d.after < G.turn && ((at === 'upkeep' && !d.own) || d.P === active));
    if (!due.length) return;
    G.delayed = G.delayed.filter(d => !due.includes(d));
    for (const d of due) { log(d.label); for (const e of d.effects) { if (e.t === 'reboundCast') await applyChoiceEffect(d.P, e, d.src, null); else await applyEffect(d.P, e, null, d.src); } }
}
async function endTurn(P) {
    if (G.over || G.active !== P.i) return;
    G.mode = null;
    G.phase = 'end';
    emptyPools();
    if (G.monarch === P.i) { log(`${P.name} ${you(P) ? 'are' : 'is'} the monarch and ${you(P) ? 'draw' : 'draws'} a card (rule 724.2).`); drawCards(P, 1); }
    fire('end');
    await settle();
    if (G.over) return;
    allPerms().filter(o => o.sacAtEnd === G.turn).forEach(o => { log(`${o.card.name} is sacrificed at the end of the turn.`); dieOrLeave(o, 'gy'); });
    // Magic 2010: Stone Giant's flier is destroyed; Protean Hydra gets its counters back
    allPerms().filter(o => o.destroyAtEnd === G.turn).forEach(o => { delete o.destroyAtEnd; destroy(o, 'is destroyed (Stone Giant)'); });
    allPerms().filter(o => o.proteanDue > 0).forEach(o => { const k = o.proteanDue; o.proteanDue = 0; putCounters(o, k); log(`${o.card.name} gets ${k} +1/+1 counters.`); });
    sba();
    // Daretti's emblem; Treasure Nabber's borrowed artifacts go back
    G.players.forEach(X => X.gy.filter(o => o.returnAtEnd).forEach(o => { o.returnAtEnd = false; log(`${o.card.name} returns to the battlefield (Daretti's emblem).`); putOntoBattlefield(X, o, false); }));
    allPerms().filter(o => o.nabbedUntil === G.turn).forEach(o => { const from = G.players[o.owner], to = G.players[o.realOwner]; pull(from.bf, o); o.owner = o.realOwner; delete o.realOwner; delete o.nabbedUntil; to.bf.push(o); log(`${o.card.name} returns to ${to.name}.`); });
    allPerms().filter(o => o.exileAtEnd === G.turn).forEach(o => { leaveBattlefield(o, 'exile'); });
    allPerms().filter(o => o.warpExile === G.turn).forEach(o => { log(`${o.card.name} is exiled (warp); it can be cast from exile on a later turn.`); leaveBattlefield(o, 'exile'); if (G.players[o.owner].exile.includes(o)) o.warpedTurn = G.turn; });
    allPerms().filter(o => o.copyOf && o.copyTurn === G.turn).forEach(o => { o.card = o.copyOf; delete o.copyOf; delete o.copyTurn; log(`${o.card.name} is itself again.`); });
    while (P.hand.length > 7 && !P.noMaxHand && !P.bf.some(x => Rx(x).noMaxHand)) {
        const d = P.hand.slice().sort((a, b) => b.card.cmc - a.card.cmc)[0];
        pull(P.hand, d);
        P.gy.push(d); d.discardTurn = G.turn;
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} (hand size).`);
    }
    if ((G.trigQ || []).length || P.gy.some(c => c.discardTurn === G.turn && c.discardSeen !== G.turn)) { discardWatch(); await settle(); if (G.over) return; } // Megrim on hand-size discards
    allPerms().forEach(o => { o.dmg = 0; o.dt = false; o.tp = 0; o.tq = 0; o.tkw = []; o.regen = 0; });
    // Stolen creatures go back (threaten effects end, 514.2)
    allPerms().filter(o => o.realOwner !== undefined && o.stolenTurn !== undefined).forEach(o => {
        pull(G.players[o.owner].bf, o);
        o.owner = o.realOwner; delete o.realOwner; delete o.stolenTurn;
        G.players[o.owner].bf.push(o);
        log(`${o.card.name} goes back to ${you(G.players[o.owner]) ? 'you' : G.players[o.owner].name}.`);
    });
    G.extra = G.extra || [0, 0];
    if (G.extra[P.i] > 0) { G.extra[P.i]--; log(`${P.name} ${you(P) ? 'take' : 'takes'} an extra turn.`); }
    else G.active = 1 - G.active;
    G.turn++;
    await pause(250);
    beginTurn();
}

// ---- Your actions ----
async function humanCast(uid) {
    const P = me();
    const o = findObj(uid);
    closeSheet();
    if (G.mode && G.mode.type === 'pay') { toast('Finish paying first (or Cancel).'); return; }
    const responding = G.mode && G.mode.type === 'respond' ? G.mode : null;
    if (!o || G.busy && !(G.mode && (G.mode.type === 'block' || responding))) return;
    if (!canCastNow(P, o)) { toast(G.stack.length ? 'Only instants (and flash) while something is on the stack.' : 'You can\'t cast that right now.'); return; }
    if (!canPay(P, o)) { toast('Not enough mana.'); return; }
    const savedMode = G.mode;
    o.teamworked = false;
    if (Rx(o).teamwork && teamworkCrew(P, o)) o.teamworked = await askYes(P, `${o.card.name}: use teamwork (tap creatures with total power ${Rx(o).teamwork}) to choose both modes?`, { card: o.card });
    if (Rx(o).modes) {
        const i = await pickModes(P, Rx(o), Rx(o).modes, o);
        G.mode = savedMode;
        if (i === null) { renderGame(); return; }
        o.mode = i;
    }
    o.kicked = false;
    if (Rx(o).kicker && canKick(P, o)) o.kicked = await askYes(P, Rx(o).offspring ? `Pay offspring for ${o.card.name}? (A 1/1 token copy of it enters too.)` : Rx(o).entwine ? `Pay the entwine cost ${costSymbols(Rx(o).kicker)} for ${o.card.name}? (You get both modes.)` : `Pay the kicker cost for ${o.card.name}?`, { card: o.card });
    if (Rx(o).cost.x && !Rx(o).xFromTarget) {
        const mx = maxX(P, o);
        const v = await askNumber(P, `Choose X for ${o.card.name}`, 1, mx, mx, { card: o.card, ok: 'Cast' });
        if (!(v >= 1 && v <= mx)) { renderGame(); return; }
        o.xVal = v;
    }
    let target = null;
    const te = firstTargetEffect(o);
    if (te) {
        if (!validTargets(P, te, o).length) { toast('There\'s nothing to target.'); return; }
        target = await chooseTarget(P, te, o, true);
        G.mode = savedMode;
        if (!target) { renderGame(); return; }
        if (Rx(o).isAura && !target.o) { toast('Auras go on creatures.'); renderGame(); return; }
        if (Rx(o).xFromTarget && target.o) o.xVal = target.o.card.cmc || 0;
    }
    // You tap the mana yourself (manual mode); the target counts for cost reductions
    o._tgt = target;
    const paid = await humanPay(P, totalCost(P, o), extraCost(P, o) + (costOf(P, o).x ? (o.xVal || 0) * xMult(o) : 0), payOpts(o), o.card.name);
    o._tgt = null;
    G.mode = savedMode;
    if (!paid) { renderGame(); return; }
    if (responding) {
        // Our response goes on the stack; the stack loop carries on from there
        G.mode = null;
        G.priority = null;
        await castSpellAsResponse(P, o, target);
        responding.resolve(true);
        return;
    }
    G.busy = true;
    await castSpell(P, o, target);
    G.busy = G.players[G.active].isAI && !(G.mode && G.mode.type === 'block');
    renderGame();
}
// Cast the other half: a modal double-faced card's back, an adventure, a split card's right half
async function humanCastBack(uid) {
    const o = findObj(uid);
    if (!o || !o.front || !o.front.back) return;
    o.card = o.front.back;
    if (rulesFor(o.card).kind === 'land') { if (!canPlayLand(me(), o)) { o.card = o.front; toast('You can only play one land a turn, in your main phase.'); closeSheet(); return; } humanPlayLand(uid); return; }
    await humanCast(uid);
    if (me().hand.includes(o)) o.card = o.front; // not cast after all
}
// Foretell (702.143): during your turn, pay {2} and exile the card face down; cast it on a later turn for its foretell cost
async function humanForetell(uid) {
    const o = findObj(uid), P = me();
    closeSheet();
    if (!o || !P.hand.includes(o) || !Rx(o).foretell || G.active !== P.i) return;
    const cost = parseCost('{2}');
    if (!planPayment(P, cost)) { toast('Not enough mana to foretell.'); return; }
    if (manual(P) && !(await humanPay(P, cost, 0, {}, `Foretell ${o.card.name}`))) { renderGame(); return; }
    const plan = planPayment(P, cost); if (plan) plan.forEach(x => tapSource(P, x));
    pull(P.hand, o); P.exile.push(o); o.foretoldTurn = G.turn;
    log(`${P.name} ${you(P) ? 'foretell' : 'foretells'} a card (exiled face down).`);
    renderGame();
}
async function humanCastAlt(uid) {
    const o = findObj(uid);
    if (!o) return;
    o.altCast = true;
    if (!canCastNow(me(), o) || !canPay(me(), o)) { o.altCast = false; closeSheet(); toast(`Can't ${Rx(o).alt.text} right now.`); return; }
    await humanCast(uid);
    if (me().hand.includes(o)) o.altCast = false;
}
async function humanCastAs(uid, md) {
    const o = findObj(uid);
    if (!o) return;
    o.castAs = md;
    if (!canCastNow(me(), o) || !canPay(me(), o)) { o.castAs = null; closeSheet(); toast('You can\'t cast it that way right now.'); return; }
    await humanCast(uid);
    o.castAs = null;
}
async function humanCastEvoke(uid) {
    const o = findObj(uid);
    if (!o) return;
    o.evoked = true;
    if (!canCastNow(me(), o) || !canPay(me(), o)) { o.evoked = false; closeSheet(); toast('Not enough mana to evoke.'); return; }
    await humanCast(uid);
    if (me().hand.includes(o)) o.evoked = false; // not cast after all
}
async function humanCastOverload(uid) {
    const o = findObj(uid);
    if (!o) return;
    o.overloaded = true;
    if (!canPay(me(), o)) { o.overloaded = false; closeSheet(); toast('Not enough mana to overload.'); return; }
    await humanCast(uid);
    if (me().hand.includes(o)) o.overloaded = false; // not cast after all
}
async function humanPlayLand(uid) {
    const o = findObj(uid);
    closeSheet();
    if (!o || !canPlayLand(me(), o)) { toast('You can only play one land a turn, in your main phase.'); return; }
    G.busy = true;
    await playLand(me(), o);
    renderGame();
    settle().then(() => { G.busy = false; renderGame(); });
}
async function humanEquip(uid) {
    closeSheet();
    const eq = onBf(uid);
    const P = me();
    if (!eq || G.active !== G.view || !MAIN.includes(G.phase)) { toast('Equip at sorcery speed: in your main phase.'); return; }
    const mine = P.bf.filter(c => isCreature(c) && equipOk(eq, c));
    if (!mine.length) { toast(Rx(eq).equipOnly ? `${eq.card.name} can only equip a ${Rx(eq).equipOnly}.` : 'You have no creature to equip.'); return; }
    if (!planPayment(P, equipCost(P, eq, null), 0, null, { forType: eq.card.type }) && !mine.some(c => planPayment(P, equipCost(P, eq, c), 0, null, { forType: eq.card.type }))) { toast('Not enough mana to equip.'); return; }
    const t = await chooseTarget(P, { target: 'creature', ...(Rx(eq).equipOnly === 'legendary creature' ? { only: 'legendary creature' } : {}) }, eq, true);
    if (!t || !t.o || t.o.owner !== G.view) { if (t) toast('Equip your own creature.'); renderGame(); return; }
    if (!equipOk(eq, t.o)) { toast(`${eq.card.name} can only equip a ${Rx(eq).equipOnly}.`); renderGame(); return; }
    if (!(await humanPay(P, equipCost(P, eq, t.o), 0, { forType: eq.card.type }, `Equip ${eq.card.name}`))) return;
    await equip(P, eq, t.o);
}
// Creatures that must attack if able: "attacks each combat", a one-turn order, or Goblin Rabblemaster's Goblins
function forcedAttack(o) {
    return !!(Rx(o).mustAttack || o.mustAttackTurn === G.turn || (hasType(o, 'Goblin') && G.players[o.owner].bf.some(l => l !== o && Rx(l).forceGoblins && !lostAbilities(l))));
}
async function goToCombat() {
    if (G.active !== G.view || G.phase !== 'main1' || G.busy) return;
    if (me().skip && me().skip.turn === G.turn && me().skip.what === 'combat') { toast('You skip combat this turn (Fatespinner).'); return; }
    emptyPools();
    if (!G.combatFired) { G.combatFired = true; fire('combat'); G.busy = true; await settle(); G.busy = false; }
    if (!me().bf.some(canAttackWith)) { toast('None of your creatures can attack (summoning sickness, tapped or defender).'); return; }
    G.phase = 'declareAttackers';
    G.mode = { type: 'attack', sel: new Set(me().bf.filter(o => canAttackWith(o) && (forcedAttack(o) || me().mustAttackTurn === G.turn)).map(o => o.uid)) };
    renderGame();
}
// Each attacker attacks the player or one of their planeswalkers (508.1b)
function chooseAttackTargets(sel, pws) {
    sel.forEach(o => { delete o.attackPW; });
    return new Promise(resolve => {
        window.__atkT = (uid, v) => { const o = onBf(uid); if (o) { if (v) o.attackPW = Number(v); else delete o.attackPW; } };
        window.__atkOk = ok => { closeModal(); if (!ok) sel.forEach(o => { delete o.attackPW; }); resolve(ok); };
        showModal(`<h2>What does each creature attack?</h2><p class="note">You can attack ${esc(foe().name)}, their planeswalkers or the battles they protect. Damage to a planeswalker removes loyalty (rule 120.3c); damage to a battle removes defense counters (rule 120.3h).</p>
            <div class="row" style="flex-direction:column; align-items:stretch; gap:8px;">${sel.map(o => `<label class="row" style="justify-content:space-between; gap:8px;"><span>${esc(o.card.name)} (${pow(o)}/${tou(o)})</span>
            <select onchange="__atkT(${o.uid}, this.value)"><option value="">${esc(foe().name)}</option>${pws.map(w => `<option value="${w.uid}">${esc(w.card.name)} (${isBattle(w) ? `battle, defense ${w.ctr.defense || 0}` : `loyalty ${w.ctr.loyalty || 0}`})</option>`).join('')}</select></label>`).join('')}</div>
            <div class="row" style="justify-content:center; margin-top:10px; gap:8px;"><button class="btn" onclick="__atkOk(false)">Cancel</button><button class="btn primary" onclick="__atkOk(true)">Attack</button></div>`);
    });
}
function cancelAttack() { G.mode = null; G.phase = G.extraCombatOn ? 'main2' : 'main1'; renderGame(); }
async function confirmAttack() {
    const sel = [...G.mode.sel].map(onBf).filter(o => o && canAttackWith(o));
    me().bf.filter(o => canAttackWith(o) && forcedAttack(o) && !sel.includes(o)).forEach(o => sel.push(o)); // they must attack if able
    G.mode = null;
    if (!sel.length) { G.phase = G.extraCombatOn ? 'main2' : 'main1'; renderGame(); return; }
    const pws = [...foe().bf.filter(isPlaneswalker), ...me().bf.filter(isBattle)];
    if (pws.length) { const ok = await chooseAttackTargets(sel, pws); if (!ok) { G.phase = 'main1'; renderGame(); return; } }
    G.busy = true;
    declareAttackers(me(), sel);
    await exertChoices(me(), sel);
    G.phase = 'declareBlocks';
    renderGame();
    await pause(400);
    await settle();
    if (G.over) return;
    const att = me(), D = foe();
    if (D.isAI && D.aiLevel === 'hard') { await aiRemoveAttacker(D); if (G.over) return; }
    if (D.isAI) G.blocks = aiChooseBlocks(D, att);
    else if (D.bf.some(o => isCreature(o) && !o.tapped) || D.hand.some(o => canCastNow(D, o) && canPay(D, o))) {
        G.busy = false;
        await new Promise(resolve => { G.mode = { type: 'block', who: D.i, picked: null, resolve }; renderGame(); });
        G.busy = true;
        if (G.over) return;
    }
    fixMenace(); fireBlocked();
    logBlocks();
    fire('blocks', { list: Object.values(G.blocks).flat().map(onBf).filter(Boolean) });
    await settle();
    G.phase = 'afterBlocks';
    G.busy = false;
    renderGame();
}
function logBlocks() {
    const lines = Object.entries(G.blocks).filter(([a, bs]) => onBf(Number(a)) && bs.every(onBf))
        .map(([a, bs]) => `${bs.map(u => onBf(u).card.name).join(' and ')} ${bs.length > 1 ? 'block' : 'blocks'} ${onBf(Number(a)).card.name}`);
    log(lines.length ? `Blocks: ${lines.join('; ')}.` : 'No blocks.');
}
async function dealDamage() {
    if (G.phase !== 'afterBlocks' || G.active !== G.view) return;
    G.busy = true;
    combatDamage(me());
    await settle();
    if (!G.over && G.extraCombat > 0) { await startExtraCombat(); return; }
    G.phase = 'main2';
    G.busy = false;
    renderGame();
}
// Exert (701.43): you may exert a creature as it attacks; it won't untap during your next untap step
async function exertChoices(P, list) {
    for (const o of list) {
        if (!Rx(o).exert || lostAbilities(o) || !onBf(o.uid) || o.exertedTurn === G.turn || !(Rx(o).trig || []).some(t => t.ev === 'exerted')) continue;
        const yes = P.isAI || AUTOPLAY ? aiWantsExert(P, o) : await askYes(P, `Exert ${o.card.name}? It won't untap during your next untap step.`, { card: o.card, yes: 'Exert', no: "Don't" });
        if (!yes) continue;
        o.exertedTurn = G.turn; o.skipUntap = true;
        log(`${P.name} ${you(P) ? 'exert' : 'exerts'} ${o.card.name}.`);
        fire('exerted', { o });
    }
}
function aiWantsExert(P, o) {
    const eff = ((Rx(o).trig || []).find(t => t.ev === 'exerted') || { effects: [] }).effects[0];
    if (!eff) return false;
    if (eff.t === 'celebrant') return (G.attackers || []).map(onBf).some(x => x && x !== o && x.owner === o.owner);
    if (needsTarget(eff)) { const t = aiPickTarget(P, eff, o); return !!(t && t.o && creatureValue(t.o) >= 3); }
    return true;
}
// An additional combat phase (Combat Celebrant): beginning of combat triggers again, then attackers
async function startExtraCombat() {
    G.extraCombat--; G.extraCombatOn = true;
    log(`${me().name} ${G.hotseat ? 'gets' : 'get'} an additional combat phase.`);
    emptyPools();
    fire('combat'); await settle();
    G.busy = false;
    if (G.over) return;
    if (!me().bf.some(canAttackWith)) { toast('None of your creatures can attack in the additional combat.'); G.phase = 'main2'; renderGame(); return; }
    G.phase = 'declareAttackers';
    G.mode = { type: 'attack', sel: new Set(me().bf.filter(o => canAttackWith(o) && (forcedAttack(o) || me().mustAttackTurn === G.turn)).map(o => o.uid)) };
    renderGame();
}
// End turn works from any point of your turn where nothing is waiting on a
// choice: it skips an attack you're setting up, or deals combat damage first.
async function endMyTurn() {
    if (!G || G.active !== G.view || G.over) return;
    if (!['main1', 'main2', 'declareAttackers', 'afterBlocks'].includes(G.phase)) return; // the turn hasn't reached its main phase yet
    if (G.mode && G.mode.type === 'attack') { G.mode = null; G.phase = 'main1'; }
    if (G.busy || G.mode) { toast(G.mode ? 'Finish what you\'re choosing first.' : 'Wait for the current action to finish.'); return; }
    if (G.phase === 'afterBlocks') { await dealDamage(); if (G.over || G.active !== G.view) return; }
    endTurn(me());
}
function concede() {
    if (!G || G.over) return;
    if (!G.confirmConcede) { G.confirmConcede = true; toast('Click Concede again to concede the game.'); setTimeout(() => { if (G) G.confirmConcede = false; }, 4000); return; }
    log(`${G.hotseat ? me().name : 'You'} ${G.hotseat ? 'concedes' : 'concede'}.`);
    endGame(1 - G.view, G.hotseat ? `${me().name} conceded.` : 'You conceded.');
}
// Blocking: tap one of your creatures, then the attacker it blocks.
function confirmBlocks() {
    if (!G.mode || G.mode.type !== 'block') return;
    const resolve = G.mode.resolve;
    G.mode = null;
    resolve();
}

function permClick(uid) {
    if (!G || G.over) return;
    const o = onBf(uid);
    if (!o) return;
    const m = G.mode;
    if (m && m.type === 'target') { pickTarget({ o }); return; }
    if (m && m.type === 'pay') {
        if (o.owner === G.view && o !== m.exclude && manaSources(me()).includes(o)) tapForMana(uid);
        else toast(o.owner === G.view && o === m.exclude ? `${o.card.name} taps as part of this cost.` : 'Tap your untapped lands or other mana sources to pay.');
        return;
    }
    if (m && m.type === 'attack') {
        if (o.owner !== G.view || !canAttackWith(o)) { if (o.owner === G.view) toast(`${o.card.name} can't attack now.`); return; }
        if (m.sel.has(uid)) m.sel.delete(uid); else m.sel.add(uid);
        renderGame();
        return;
    }
    if (m && m.type === 'block') {
        if (o.owner === G.view && isCreature(o)) {
            const existing = Object.entries(G.blocks).find(([, bs]) => bs.includes(uid));
            const twice = (has(o, 'blockany') || (has(o, 'extrablock') && Object.values(G.blocks).filter(bs => bs.includes(uid)).length === 1)) && m.picked !== uid;
            if (existing && !twice) { G.blocks[existing[0]] = existing[1].filter(u => u !== uid); if (!G.blocks[existing[0]].length) delete G.blocks[existing[0]]; m.picked = null; renderGame(); return; }
            if (o.tapped) { toast(`${o.card.name} is tapped.`); return; }
            m.picked = m.picked === uid ? null : uid;
            renderGame();
            return;
        }
        if (o.owner === 1 && G.attackers.includes(uid) && m.picked) {
            const b = onBf(m.picked);
            if (!canBlock(b, o)) { toast(`${b.card.name} can't block ${o.card.name}${has(o, 'flying') ? ' (it has flying)' : ''}.`); return; }
            (G.blocks[uid] = G.blocks[uid] || []).push(m.picked);
            m.picked = null;
            renderGame();
            return;
        }
    }
    showGameCard(uid);
}

function showGameCard(uid) {
    const o = findObj(uid);
    if (!o) return;
    const P = me();
    const r = Rx(o);
    let actions = '';
    if (P.hand.includes(o) || P.command.includes(o) || (P.gy.includes(o) && (r.flashback || gyCastOk(P, o))) || (P.exile.includes(o) && (o.playUntil >= G.turn || o.advReady || (o.foretoldTurn && o.foretoldTurn < G.turn) || (o.warpedTurn && o.warpedTurn < G.turn))) || extraLandZones(P).includes(o) || pitTop(P) === o) {
        if (r.kind === 'land') actions = `<button class="btn primary" ${canPlayLand(P, o) ? '' : 'disabled'} onclick="humanPlayLand(${uid})">Play land</button>`;
        else {
            const ok = canCastNow(P, o) && canPay(P, o);
            const extra = extraCost(P, o);
            const why = r.support === 'none' ? r.why : !canCastNow(P, o) ? (r.kind === 'instant' || r.flash ? 'Instants: your main phases, after blocks on your attack, or while blocking.' : 'Cast this in your main phase.') : !canPay(P, o) ? 'Not enough mana.' : '';
            actions = `<button class="btn primary" ${ok ? '' : 'disabled'} onclick="humanCast(${uid})">${P.gy.includes(o) ? (r.flashback ? 'Cast with flashback' : 'Cast from graveyard') : `Cast ${esc(o.card.cost)}`}${extra ? ` + {${extra}} tax` : ''}</button>${why ? `<span class="note">${esc(why)}</span>` : ''}`;
        }
    } else if (P.bf.includes(o) && r.isEquipment && r.equip !== null) {
        actions = `<button class="btn primary" onclick="humanEquip(${uid})">Equip ${esc(r.equipText)}</button>`;
    }
    if (P.bf.includes(o) && manaSources(P).includes(o)) {
        const mm = manaOf(o), cols = landColorsOf(o);
        actions += mm.fixed ? `<button class="btn" onclick="tapForMana(${uid})">💧 Tap for ${pipsHTML(cols.length === mm.n ? cols : Array(mm.n).fill(cols[0]))}</button>`
            : cols.map(c => `<button class="btn" onclick="tapForMana(${uid}, '${c}')">💧 Tap for ${pipsHTML(Array(mm.n).fill(c))}</button>`).join('');
    }
    actions += abilityButtonsHTML(P, o);
    if (P.hand.includes(o) && o.front && o.front.back && ['modal_dfc', 'adventure', 'split'].includes(o.front.layout) && o.card === o.front) {
        const b = o.front.back, land = rulesFor(b).kind === 'land';
        actions += `<button class="btn" onclick="humanCastBack(${uid})" title="${esc(b.type)}: ${esc(b.text)}">${land ? `Play ${esc(b.name)} (land)` : `Cast ${esc(b.name)} ${esc(b.cost)}`}</button>`;
    }
    if (P.hand.includes(o) && r.foretell && G.active === P.i && !G.stack.length && planPayment(P, parseCost('{2}'))) actions += `<button class="btn" onclick="humanForetell(${uid})" title="Foretell: pay {2} and exile it face down; cast it on a later turn for ${esc(costSymbols(r.foretell))} (rule 702.143)">Foretell {2}</button>`;
    if (P.hand.includes(o) && r.alt && altOk(P, o)) actions += `<button class="btn" onclick="humanCastAlt(${uid})" title="Alternative cost: cast it without paying its mana cost (rule 118.9)">Cast: ${esc(r.alt.text)}</button>`;
    if (P.hand.includes(o) && r.evoke) actions += `<button class="btn" onclick="humanCastEvoke(${uid})" title="Evoke: cast it for its evoke cost; it's sacrificed when it enters (rule 702.74)">Evoke ${esc(costSymbols(r.evoke))}</button>`;
    for (const [md, label, tip] of [['warp', r.warp && `Warp ${costSymbols(r.warp)}`, 'Warp: cast it for its warp cost; it\'s exiled at the next end step and can be cast from exile on a later turn'], ['bestow', r.bestow && `Bestow ${costSymbols(r.bestow)}`, 'Bestow: cast it as an Aura on a creature; it becomes a creature again if that creature leaves (rule 702.103)'], ['blitz', r.blitz && `Blitz ${costSymbols(r.blitz.cost)}${r.blitz.life ? `, ${r.blitz.life} life` : ''}`, 'Blitz: haste, draw a card when it dies, sacrificed at the end step (rule 702.152)'], ['energy', `Pay ${energyAltN(P)} energy`, 'Cast it by paying energy instead of its mana cost'], ['escape', P.lockerCost && `Escape ${costSymbols(P.lockerCost)}, exile ${P.lockerN || 4}`, 'Escape: cast it from your graveyard (The Grim Captain\'s Locker)']]) {
        if (!label || !castAsOk(P, o, md)) continue;
        o.castAs = md; const ok = canCastNow(P, o) && canPay(P, o); o.castAs = null;
        actions += `<button class="btn" ${ok ? '' : 'disabled'} onclick="humanCastAs(${uid}, '${md}')" title="${esc(tip)}">${esc(label)}</button>`;
    }
    if (P.hand.includes(o) && r.overload) actions += `<button class="btn" onclick="humanCastOverload(${uid})" title="Overload: every &quot;target&quot; becomes &quot;each&quot; (rule 702.96)">Cast with overload ${esc(r.overload.text)}</button>`;
    if (o.front && o.front.back && o.front.layout === 'transform') actions += `<span class="note">Other face: <strong>${esc(o.card === o.front ? o.front.back.name : o.front.name)}</strong></span>`;
    const temp = o.tp || o.tq || o.tkw.length ? `, until end of turn ${[o.tp || o.tq ? `${o.tp >= 0 ? '+' : ''}${o.tp}/${o.tq >= 0 ? '+' : ''}${o.tq}` : '', ...o.tkw].filter(Boolean).join(', ')}` : '';
    const stats = isCreature(o) && onBf(uid) ? `<div class="note">Now: ${pow(o)}/${tou(o)}${o.dmg ? `, ${o.dmg} damage` : ''}${o.counters ? `, ${Math.abs(o.counters)} ${o.counters > 0 ? '+1/+1' : '-1/-1'} counter${Math.abs(o.counters) === 1 ? '' : 's'}` : ''}${temp}${o.sick && !has(o, 'haste') && o.owner === G.active ? ', summoning sick' : ''}</div>` : '';
    const tracker = onBf(uid) ? counterTrackerHTML(o) : '';
    $('sheetHost').innerHTML = `
        <div class="sheet-bg" onclick="if (event.target === this) closeSheet()">
            <div class="sheet" role="dialog" aria-label="${esc(o.card.name)}">
                <div>${o.card.img ? `<img src="${o.card.img}" alt="${esc(o.card.name)}">` : `<div class="otext">${esc(o.card.name)}</div>`}</div>
                <div><h3>${esc(o.card.fullName || o.card.name)}</h3>${cardTextHTML(o.card)}${stats}
                    <div>${o.token ? '<span class="note">Token</span>' : supportBadge(o.card)} <span class="note">${esc(r.why || '')}</span></div>
                    ${tracker}
                    <div id="kwHelp"></div>
                    <div class="actions">${actions}<button class="btn" onclick="closeSheet()">Close</button></div></div>
            </div>
        </div>`;
    fillKeywordHelp(o.card);
}

// ---- Game over ----
function endGame(winner, reason) {
    if (G.over) return;
    G.over = true;
    G.busy = true;
    actReset();
    G.mode = null;
    const won = winner === 0;
    let reward = 0;
    if (G.hotseat && !AUTOPLAY) { endFriendGame(winner, reason); return; }
    if (!AUTOPLAY) {
        if (G.campaign || G.draftRound !== undefined) { if (won) profile.wins++; else profile.losses++; }
        else {
            if (won) { reward = G.format === 'commander' ? REWARDS.winCommander : REWARDS.win; profile.wins++; }
            else { reward = REWARDS.loss; profile.losses++; }
            profile.coins += reward;
        }
        saveProfile();
    }
    const campLine = !AUTOPLAY && G.campaign && winner !== null ? campaignResult(won) : !AUTOPLAY && G.draftRound !== undefined ? draftResult(won) : '';
    log(`Game over: ${reason}`);
    window.lastResult = { winner, reason, turns: G.turn };
    renderGame();
    if (AUTOPLAY) return;
    showModal(`<h2>${winner === null ? '🤝 Draw' : won ? '🏆 You win!' : '💀 You lose'}</h2>
        <p>${esc(reason)}</p><p class="note">${G.turn} turns${G.campaign || G.draftRound !== undefined ? '' : ` · 🪙 +${reward} coins`}</p>${campLine ? `<p class="ok">${esc(campLine)}</p>` : ''}
        <div class="row" style="justify-content:center; margin-top:14px;">
            ${G.draftRound !== undefined ? '<button class="btn primary" onclick="closeModal(); leaveGame(); showView(\'draft\');">🃏 Back to the draft</button>' : G.campaign ? '<button class="btn primary" onclick="closeModal(); leaveGame(); showView(\'campaign\');">🗺️ Back to the map</button>' : '<button class="btn primary" onclick="closeModal(); leaveGame(); startMatch(true);">Play again</button>'}
            <button class="btn gold" onclick="closeModal(); leaveGame(); showView('packs');">🎴 Open packs</button>
            <button class="btn" onclick="closeModal(); leaveGame();">Back</button>
        </div>`);
}
// A pass-and-play game: each account gets its own win or loss and coins
function endFriendGame(winner, reason) {
    const lines = G.players.map(P => {
        const name = G.hotseat.accounts[P.i];
        const prof = name === accounts.current ? profile : store.get(`profile:${name}`, null);
        if (!prof) return '';
        const won = winner === P.i, coins = winner === null ? REWARDS.loss : won ? (G.format === 'commander' ? REWARDS.winCommander : REWARDS.win) : REWARDS.loss;
        if (won) prof.wins++; else prof.losses++;
        prof.coins += coins;
        if (prof === profile) saveProfile(); else store.set(`profile:${name}`, prof);
        return `${name}: ${won ? 'win' : winner === null ? 'draw' : 'loss'} · 🪙 +${coins}`;
    });
    log(`Game over: ${reason}`);
    window.lastResult = { winner, reason, turns: G.turn };
    renderGame();
    showModal(`<h2>${winner === null ? '🤝 Draw' : `🏆 ${esc(G.players[winner].name)} wins!`}</h2><p>${esc(reason)}</p><p class="note">${G.turn} turns<br>${lines.filter(Boolean).map(esc).join('<br>')}</p>
        <div class="row" style="justify-content:center; margin-top:14px;"><button class="btn primary" onclick="closeModal(); leaveGame(); showView('play');">⚔️ Back to Play</button><button class="btn" onclick="closeModal(); leaveGame();">Back</button></div>`);
}
function leaveGame() {
    $('game').classList.add('hidden');
    document.body.style.overflow = '';
    closeSheet();
    renderCoins();
}

