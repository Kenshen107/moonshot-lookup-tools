// Engine pieces for the four official Star Trek Commander decks (2026-10-30; wordings: rules/trekdecks.js). CMD ids start with td_.
// Same habits as the other rounds: a person gets pick screens, the computer takes the best; choices inside a resolving spell are made as it resolves.
// Approximations are listed per card in the section headers. Helpers come from 15j-trek.js (tk*) and 15d-cmdr-*.js.

const tdCreatureCard = x => /\bCreature\b/.test(x.card.type);
const tdCtx = () => (G.ctxRaw || {});
const tdPool = async (P, pool, title, opts = {}) => {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort((a, b) => (opts.worst ? creatureValue(a) - creatureValue(b) : tkBest(a, b)))[0];
    return await pickCard(P, pool, title, opts.optional ? { optional: true } : { required: true });
};
// Delayed effect at the beginning of the next end step
const tdAtEnd = (fn, label) => atEndStep(fn, label);
// Counters on any permanent: +1/+1 and named
const tdCounterTotal = o => (o.counters > 0 ? o.counters : 0) + Object.entries(o.ctr || {}).reduce((a, [k, v]) => a + (k === 'loyalty' ? 0 : Math.max(0, v)), 0);

// Creatures that died this turn: stamp the card when a creature dies (Ezri Dax and Voq copy "put there from the battlefield this turn")
(function () {
    const f = fire;
    fire = function (ev, ctx) {
        if (ev === 'creatureDies' && ctx && ctx.o) { ctx.o.diedAtTurn = G.turn; }
        return f.apply(this, arguments);
    };
})();
const tdDiedThisTurn = x => x.diedAtTurn === G.turn;
const tdFakeSrc = P => ({ card: { name: 'Klingon Warrior', id: 'td-src', type: 'Token' }, uid: -1, owner: P.i });

// ---- Entering as a copy of a card in a graveyard (Ezri Dax: yours, died this turn; Voq: any graveyard) ----
(function () {
    const orig = enterAsCopy;
    enterAsCopy = async function (P, o, cl) {
        if (!cl || !cl.gy) return orig.apply(this, arguments);
        const pool = (cl.gy === 'diedThisTurn' ? P.gy : G.players.flatMap(X => X.gy)).filter(x => x !== o && tdCreatureCard(x) && (cl.gy !== 'diedThisTurn' || tdDiedThisTurn(x)));
        if (!pool.length) return;
        const best = pool.slice().sort((a, b) => permValue(b) - permValue(a))[0];
        let pick = (P.isAI || AUTOPLAY) ? (permValue(best) > permValue(o) ? best : null) : await pickCard(P, pool, `${o.card.name}: enter as a copy of a creature card in a graveyard (or none)`, { optional: true });
        if (!pick) return;
        let type = pick.card.type;
        if (cl.makeLegendary && !/\bLegendary\b/.test(type)) type = `Legendary ${type}`;
        if (cl.addSub) { const subs = cl.addSub.split(' ').filter(w => !new RegExp(`\\b${w}\\b`).test(type)); if (subs.length) type = /—/.test(type) ? `${type} ${subs.join(' ')}` : `${type} — ${subs.join(' ')}`; }
        let text = pick.card.text || '';
        if (cl.addKw) text = `${cl.addKw}\n${text}`.trim();
        o.copyOf = o.card;
        o.card = { ...pick.card, id: `${pick.card.id}-copy${uidSeq}`, type, text, ...(cl.keepName ? { name: cl.keepName } : {}) };
        log(`${o.copyOf.name} enters as a copy of ${pick.card.name} from a graveyard${cl.keepName ? ` (named ${cl.keepName})` : ''} (rule 707.9).`);
    };
})();

COND_EXTRA.push(
    [/^you control creatures with two or more \+1\/\+1 counters among them$/, () => P => P.bf.filter(isCreature).reduce((a, x) => a + Math.max(0, x.counters), 0) >= 2],
    [/^you control an untapped creature$/, () => P => P.bf.some(x => isCreature(x) && !x.tapped)],
    [/^you control a Spacecraft$/, () => P => P.bf.some(x => hasType(x, 'Spacecraft'))],
    [/^it is an opponent's turn$/, () => P => G.active !== P.i],
    [/^it has 1 or more counters on it$/, () => (P, o) => o.counters > 0 || Object.entries(o.ctr || {}).some(([k, v]) => k !== 'loyalty' && v > 0)],
    [/^you control an artifact creature$/, () => P => P.bf.some(x => isCreature(x) && /\bArtifact\b/.test(x.card.type))],
    [/^you control another nontoken creature$/, () => (P, o) => P.bf.some(x => isCreature(x) && !x.token && x !== o)]
);

// ================= Federation Fleet =================
Object.assign(CMD, {
    // Captain Janeway: one trigger for every combat damage step in which Officers hurt a player
    async td_janewayHit(P, e, t, src) {
        const key = `${G.turn}:${G.combatDmgStep || 0}`;
        if (src.jwKey === key) return;
        src.jwKey = key;
        drawCards(P, 1);
        await tkOfficers(P, 1, src);
    },
    async td_tapUnblockable(P, e, t, src) {
        const x = await tkTapCreature(P, src, `${src.card.name}: tap an untapped creature you control`, P.bf.filter(c => isCreature(c) && !c.tapped));
        if (!x) return;
        src.tkw.push('unblockable'); log(`${src.card.name} can't be blocked this turn.`);
    },
    // Ambassador K'Ehleyr: each player reveals the top card, then draws a card; a counter for each nonland card revealed
    async td_parley(P, e, t, src) {
        let n = 0;
        for (const X of G.players.filter(p => !p.out)) {
            const top = X.library[X.library.length - 1];
            if (top) { log(`${X.name} ${you(X) ? 'reveal' : 'reveals'} ${top.card.name}.`); if (!/\bLand\b/.test(top.card.type)) n++; }
            drawCards(X, 1);
        }
        if (n && onBf(src.uid)) putCounters(src, n, P);
    },
    // Ensign Harry Kim
    async td_kimGrow(P, e, t, src) {
        const x = tdCtx().o || G.ctxObj;
        if (!x || !onBf(src.uid) || !(pow(x) > pow(src))) return;
        putCounters(src, 1, P);
    },
    async td_removeCountersDraw(P, e, t, src) {
        let need = 2;
        for (const x of P.bf.filter(isCreature)) { while (need > 0 && x.counters > 0) { x.counters--; need--; } if (need <= 0) break; }
        if (need > 0) return;
        drawCards(P, 1); log('Two +1/+1 counters are removed from creatures: draw a card.');
    },
    // Julian Bashir: return a creature card with mana value X or less (X = his power) from your graveyard to the battlefield
    async td_bashir(P, e, t, src) {
        const X = Math.max(0, pow(src));
        const pool = P.gy.filter(x => tdCreatureCard(x) && (x.card.cmc || 0) <= X);
        const pick = await tdPool(P, pool, `${src.card.name}: return a creature card with mana value ${X} or less to the battlefield`);
        if (pick) { putOntoBattlefield(P, pick); log(`${pick.card.name} returns to the battlefield.`); }
    },
    // Miles O'Brien: double the number of each kind of counter on target artifact or creature you control
    async td_doubleCounters(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        if (x.counters > 0) putCounters(x, x.counters, P);
        for (const k of Object.keys(x.ctr || {})) if (k !== 'loyalty' && x.ctr[k] > 0) { x.ctr[k] *= 2; log(`${x.card.name}: ${k} counters doubled (${x.ctr[k]}).`); }
    },
    // Kes: time counter, draw X cards (X = time counters), sacrifice at nine
    async td_kes(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.ctr.time = (src.ctr.time || 0) + 1;
        log(`${src.card.name} gets a time counter (${src.ctr.time}).`);
        drawCards(P, src.ctr.time);
        if (src.ctr.time >= 9) { log(`${src.card.name} is sacrificed.`); tkSacrifice(P, src); }
    },
    // Seven of Nine: loot; a nonland discard puts two charge counters on up to one artifact
    async td_sevenLoot(P, e, t, src) {
        drawCards(P, 1);
        if (!P.hand.length) return;
        const d = await chooseDiscard(P, src.card.name);
        if (!d) return;
        pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1);
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`);
        if (!/\bLand\b/.test(d.card.type)) {
            const arts = allPerms().filter(x => /\bArtifact\b/.test(x.card.type));
            if (!arts.length) return;
            const mine = arts.filter(x => x.owner === P.i);
            const pick = (P.isAI || AUTOPLAY) ? (mine.length ? mine : arts).slice().sort((a, b) => ((a === src ? 1 : 0) - (b === src ? 1 : 0)) || ((tkIsShip(b) ? 1 : 0) - (tkIsShip(a) ? 1 : 0)) || ((stationCreature(a) ? 1 : 0) - (stationCreature(b) ? 1 : 0)) || ((b.ctr.charge || 0) - (a.ctr.charge || 0)))[0]
                : await pickCard(P, arts, `${src.card.name}: put two charge counters on up to one target artifact`, { optional: true });
            if (pick) tkCounters(pick, 'charge', 2);
        }
    },
    // Rom and Leeta: tapped Treasures
    async td_tappedTreasures(P, e, t, src) {
        const before = new Set(P.bf);
        await applyEffect(P, { t: 'artToken', n: e.n, kind: 'treasure' }, null, src || { card: { name: 'Treasure', id: 'td-treasure', type: 'Token' }, uid: -1, owner: P.i });
        P.bf.filter(x => !before.has(x)).forEach(x => { x.tapped = true; });
    },
    // B'Elanna Torres: surveil 2, then you may reveal the top card; draw if it's an artifact, else two +1/+1 counters on her
    async td_belanna(P, e, t, src) {
        await applyChoiceEffect(P, { t: 'surveil', n: 2 }, src, null);
        const top = P.library[P.library.length - 1];
        let drew = false;
        if (top) {
            const reveal = P.isAI || AUTOPLAY ? true : await askYes(P, `${src.card.name}: reveal the top card of your library (${top.card.name})?`, { card: top.card });
            if (reveal) { log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name}.`); if (/\bArtifact\b/.test(top.card.type)) { drawCards(P, 1); drew = true; } }
        }
        if (!drew && onBf(src.uid)) putCounters(src, 2, P);
    },
    // Cmdr. Troi: the opponent whose turn it is may cast a spell from their hand for free; if they do you copy it, if not you draw
    async td_troi(P, e, t, src) {
        const A = G.players[G.active];
        if (!A || A === P || A.out) return;
        const pool = A.hand.filter(o => Rx(o).kind !== 'land' && Rx(o).support !== 'none' && ['instant', 'sorcery', 'creature', 'artifact', 'enchantment', 'planeswalker'].includes(Rx(o).kind));
        let c = null;
        if (pool.length) {
            if (A.isAI || AUTOPLAY) { c = pool.slice().sort((a, b) => aiScore(A, b, null) - aiScore(A, a, null))[0]; if (!(aiScore(A, c, null) > 0)) c = null; }
            else if (await askYes(A, `${src.card.name}: cast a spell from your hand without paying its mana cost? (${P.name} copies it)`, { card: src.card })) c = await pickCard(A, pool, 'Cast which spell for free?', { required: true });
        }
        if (!c) { log(`${A.name} ${you(A) ? "don't" : "doesn't"} cast a spell: ${P.name} ${you(P) ? 'draw' : 'draws'} a card.`); drawCards(P, 1); return; }
        const ok = await castFreeFrom(A, c);
        if (!ok) { drawCards(P, 1); return; }
        const item = G.stack.slice().reverse().find(i => i.o === c);
        if (item && (spellEffects(c).length)) await copySpellItem(P, item, { retarget: true });
    },
    // Reg Barclay: a non-legendary Illusion artifact copy of another creature you control, with haste, exiled at the next end step
    async td_barclay(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        let type = x.card.type.replace(/Legendary /, '');
        if (!/\bArtifact\b/.test(type)) type = type.replace(/^/, 'Artifact ');
        if (!/\bIllusion\b/.test(type)) type = /—/.test(type) ? `${type} Illusion` : `${type} — Illusion`;
        const tok = tokenCopyOf(P, { ...x.card, type });
        tok.tkw.push('haste'); tok.sick = false;
        tdAtEnd(() => { if (onBf(tok.uid)) { log(`${tok.card.name} token is exiled.`); leaveBattlefield(tok, 'exile'); } }, `${tok.card.name} token is exiled (Reg Barclay).`);
    },
    // Unification
    async td_unification1(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const owner = G.players[x.owner];
        drawCards(owner, 2);
        if (!x.token) { leaveBattlefield(x, 'library'); pull(owner.library, x); owner.library.splice(rand(owner.library.length + 1), 0, x); log(`${x.card.name} is shuffled into ${owner.name}'s library.`); }
        else leaveBattlefield(x, 'gy');
    },
    async td_unification2(P, e, t, src) {
        const pool = [...P.hand, ...P.gy].filter(x => /\bSpacecraft\b/.test(x.card.type));
        if (!pool.length) return;
        const pick = (P.isAI || AUTOPLAY) ? pool.slice().sort(tkBest)[0] : await pickCard(P, pool, `${src.card.name}: put a Spacecraft card from your hand or graveyard onto the battlefield (or none)`, { optional: true });
        if (pick) { putOntoBattlefield(P, pick); log(`${pick.card.name} is put onto the battlefield.`); }
    },
    async td_unification3(P, e, t, src) {
        drawCards(P, 2);
        const O = t && t.p ? t.p : opp(P);
        if (O && O !== P) drawCards(O, 2);
    },
    // U.S.S. Enterprise-C: may discard your hand; draw a card for each card discarded
    async td_discardHandDraw(P, e, t, src) {
        if (!P.hand.length) return;
        if (!(P.isAI || AUTOPLAY)) { if (!await askYes(P, `${src.card.name}: discard your hand and draw that many cards?`, { card: src.card })) return; }
        else if (P.hand.length < 3) return;
        const n = P.hand.length;
        noteDiscard(P, n);
        P.hand.splice(0).forEach(c => { P.gy.push(c); c.discardTurn = G.turn; });
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${n} card${n === 1 ? '' : 's'}.`);
        drawCards(P, n);
    },
    // U.S.S. Prometheus: it deals that much damage to each other opponent
    async td_multivector(P, e, t, src) {
        const c = tdCtx(), n = c.n || 0, hit = (c.hit || []).map(h => h.i);
        if (!n) return;
        foes(P).filter(F => !hit.includes(F.i)).forEach(F => damage(F, n, src));
    },
    // U.S.S. Stargazer: a tapped and attacking 4/3 token, exiled at end of combat
    async td_stargazer(P, e, t, src) {
        const before = new Set(P.bf);
        await applyEffect(P, { t: 'token', n: 1, p: 4, q: 3, name: 'colorless Spacecraft Illusion', kw: ['flying'], artifact: true, attacking: true }, null, src);
        P.bf.filter(x => !before.has(x)).forEach(tok => { tok.card = { ...tok.card, type: 'Artifact Creature — Spacecraft Illusion' }; tok.exileEndCombat = true; if (G.players.length > 2 && src.atkTo !== undefined) tok.atkTo = src.atkTo; });
    },
    // Fevered Visions
    async td_fevered(P, e, t, src) {
        const X = G.players[G.active];
        if (!X || X.out) return;
        drawCards(X, 1);
        if (X.i !== P.i && X.hand.length >= 4) { damage(X, 2, src); log(`${src.card.name} deals 2 damage to ${X.name}.`); }
    },
    // Fractured Identity: exile target nonland permanent; each player other than its controller creates a token copy
    async td_fractured(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const ctl = G.players[x.owner], card = x.card;
        log(`${x.card.name} is exiled.`); leaveBattlefield(x, 'exile');
        for (const Y of G.players.filter(p => !p.out && p.i !== ctl.i)) tokenCopyOf(Y, card);
    },
    // Chronomantic Escape: creatures can't attack you until your next turn; the card is exiled with three time counters (suspend rules)
    async td_chrono(P, e, t, src) {
        P.noAttackFlag = true;
        src.chronoPending = true;
        log(`Creatures can't attack ${P.name} until ${P.name}'s next turn.`);
    },
    // Stonespeaker Crystal: exile any number of target players' graveyards, then draw a card
    async td_stonespeaker(P, e, t, src) {
        const targets = (P.isAI || AUTOPLAY) ? foes(P) : await pickPlayers(P, `${src.card.name}: choose players whose graveyards are exiled`, G.players.filter(p => !p.out), foes(P));
        for (const X of targets || []) { const n = X.gy.length; X.gy.splice(0).forEach(c => X.exile.push(c)); if (n) log(`${X.name}'s graveyard (${n} cards) is exiled.`); }
        drawCards(P, 1);
    }
});
Object.assign(CMD, {
    // Temporal Tribulation: exile two target permanents you control; they return at the beginning of the next end step (tokens don't)
    async td_tribulation(P, e, t, src) {
        const chosen = [];
        for (let k = 0; k < 2; k++) {
            const pool = P.bf.filter(x => !chosen.includes(x));
            if (!pool.length) break;
            const pick = await tdPool(P, pool, `${src.card.name}: exile a permanent you control (${k + 1} of 2)`, { worst: false });
            if (!pick) break;
            chosen.push(pick);
        }
        chosen.forEach(x => { log(`${x.card.name} is exiled.`); leaveBattlefield(x, 'exile'); });
        tdAtEnd(() => { chosen.filter(x => !x.token).forEach(x => { const own = G.players[x.owner]; if (own.exile.includes(x)) { pull(own.exile, x); putOntoBattlefield(own, x); log(`${x.card.name} returns to the battlefield.`); } }); }, `${src.card.name}: the exiled permanents return.`);
    }
});
Object.assign(CMD_SCORE, { td_tribulation: () => 3, td_janewayHit: () => 5, td_tapUnblockable: () => 1, td_parley: () => 4, td_kimGrow: () => 3, td_removeCountersDraw: () => 2, td_bashir: P => (P.gy.some(tdCreatureCard) ? 6 : 0), td_doubleCounters: () => 5, td_kes: () => 6, td_sevenLoot: () => 3, td_tappedTreasures: () => 4, td_belanna: () => 4, td_troi: () => 3, td_barclay: () => 5, td_unification1: () => 3, td_unification2: P => ([...P.hand, ...P.gy].some(x => /\bSpacecraft\b/.test(x.card.type)) ? 6 : 0), td_unification3: () => 4, td_discardHandDraw: () => 1, td_multivector: () => 4, td_stargazer: () => 5, td_fevered: () => 3, td_fractured: () => 7, td_chrono: () => 6, td_stonespeaker: () => 2 });

// ---- "Creatures can't attack you until your next turn" (Chronomantic Escape) ----
(function () {
    const bt = beginTurn;
    beginTurn = async function () { const P = G && G.players[G.active]; if (P) P.noAttackFlag = false; return bt.apply(this, arguments); };
    const cca = typeof cmdCantAttack === 'function' ? cmdCantAttack : () => false;
    cmdCantAttack = function (o) {
        if (cca(o)) return true;
        const P = G && G.players[o.owner];
        if (!P || !P.bf.includes(o)) return false;
        const fs = foes(P);
        return fs.length > 0 && fs.every(F => F.noAttackFlag); // every opponent is protected
    };
    const keep = d => (d && d.noAttackFlag ? null : d);
    if (typeof podPickDefender === 'function') { const f = podPickDefender; podPickDefender = function (P) { const d = f.apply(this, arguments); return d && d.noAttackFlag ? (foes(P).filter(F => !F.noAttackFlag).sort((a, b) => a.life - b.life)[0] || null) : d; }; }
    if (typeof aiPickDefender === 'function') { const f = aiPickDefender; aiPickDefender = function (P) { const d = f.apply(this, arguments); return d && d.noAttackFlag ? (foes(P).filter(F => !F.noAttackFlag).sort((a, b) => a.life - b.life)[0] || null) : d; }; }
    if (typeof choosePodTargets === 'function') { const f = choosePodTargets; choosePodTargets = function (sel, foesList, pws) { return f.call(this, sel, foesList.filter(F => !F.noAttackFlag), pws); }; }
    void keep;
})();

// ---- Tuvok: when he enters during the declare attackers step, up to two attacking creatures may be sent at another player or permanent ----
Object.assign(CMD, {
    async td_tuvok(P, e, t, src) {
        if (!G.attackers.length || !['declareBlocks', 'declareAttackers'].includes(G.phase)) return;
        const atks = G.attackers.map(onBf).filter(Boolean);
        const chosen = [];
        for (let k = 0; k < 2; k++) {
            const pool = atks.filter(a => !chosen.includes(a));
            if (!pool.length) break;
            let a;
            if (P.isAI || AUTOPLAY) a = pool.find(x => x.owner !== P.i && (x.atkTo === P.i || (x.atkTo === undefined && G.defender === P.i)));
            else a = await pickCard(P, pool, `${src.card.name}: choose an attacking creature to reselect (or none)`, { optional: true });
            if (!a) break;
            chosen.push(a);
            const owner = G.players[a.owner];
            const cur = a.atkTo !== undefined ? a.atkTo : G.defender;
            const others = foes(owner).filter(F => F.i !== cur && !F.noAttackFlag);
            if (!others.length) { log(`${a.card.name} has nothing else to attack.`); continue; }
            let pickF;
            if (P.isAI || AUTOPLAY) pickF = a.owner === P.i ? null : others.slice().sort((x, y) => x.life - y.life)[0];
            else { const ch = others.length === 1 ? others : await pickPlayers(P, `${src.card.name}: who does ${a.card.name} attack now? (none keeps it as is)`, others, []); pickF = (ch && ch[0]) || null; }
            if (pickF) { a.atkTo = pickF.i; delete a.attackPW; log(`${a.card.name} now attacks ${pickF.name} (${src.card.name}).`); }
        }
    }
});
Object.assign(CMD_SCORE, { td_tuvok: () => 2 });

// ================= Klingon Fury =================
// ---- Opponents attacked this turn (Battlefront) and who attacked this turn ----
function tdNoteAttack(list) {
    (list || []).forEach(x => {
        const P = G.players[x.owner]; if (!P) return;
        const d = x.atkTo !== undefined ? x.atkTo : (G.defender !== undefined && G.defender !== null ? G.defender : opp(P).i);
        if (!P.attOpps || P.attOpps.turn !== G.turn) P.attOpps = { turn: G.turn, set: new Set() };
        P.attOpps.set.add(d);
        x.atkTurn = G.turn;
    });
}
const tdOppsAttacked = P => (P.attOpps && P.attOpps.turn === G.turn ? P.attOpps.set.size : 0);
COUNT_EXTRA.push([/^(?:the number of )?opponents you attacked this turn$/, () => o => tdOppsAttacked(G.players[o.owner])]);
TRIG_FN.anyAttack = (o, ctx) => (ctx.list || []).length > 0;
const tdKlingonOrWarrior = x => isCreature(x) && (hasType(x, 'Klingon') || hasType(x, 'Warrior') || (x.addedTypes || []).some(w => w === 'Klingon' || w === 'Warrior'));
const tdTypesOf = x => { const m = (x.card.type || '').match(/—\s*(.+)$/); return (m ? m[1].split(/\s+/) : []).concat(x.addedTypes || []).filter(Boolean); };
const tdKlingonToken = n => ({ t: 'token', n, p: 2, q: 1, name: 'red Klingon Warrior', kw: ['haste'] });

// ---- Hooks on events: attacks, Right of Vengeance, Grilka's Treasures, Kang's goad ending ----
(function () {
    const f = fire;
    fire = function (ev, ctx) {
        if (ev === 'attacks' && ctx) tdNoteAttack(ctx.list);
        if (ev === 'hitPlayer' && ctx && ctx.src) {
            const src = ctx.src;
            (ctx.hit || []).forEach(H => {
                if (H.rvTurn === G.turn && src.owner !== H.i && onBf(src.uid)) {
                    log(`${src.card.name} dealt combat damage to ${H.name}: it is destroyed (Right of Vengeance).`);
                    if (!has(src, 'indestructible')) dieOrLeave(src, 'gy');
                    applyEffect(H, tdKlingonToken(1), null, tdFakeSrc(H));
                }
            });
            if (src.grilkaTreasure && src.stolenTurn === G.turn && (ctx.n || 0) > 0) {
                const ctl = G.players[src.owner];
                CMD.td_tappedTreasures(ctl, { n: ctx.n });
            }
        }
        const r = f.apply(this, arguments);
        if (ev === 'leaves' || ev === 'dies' || ev === 'combat') tdPurgeKang();
        return r;
    };
})();
function tdPurgeKang() {
    allPerms().forEach(x => {
        if (x.goaded && x.goaded.kangUid) {
            const k = onBf(x.goaded.kangUid);
            if (!k || k.owner !== x.goaded.by) { delete x.goaded; }
        }
    });
}

Object.assign(CMD, {
    // Kor: you may sacrifice another creature; if you do, draw a card, then Klingons and Warriors get +2/+2
    async td_kor(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        if (!pool.length) return;
        let f;
        if (P.isAI || AUTOPLAY) { const cheap = pool.filter(x => x.token || creatureValue(x) < 3).sort((a, b) => creatureValue(a) - creatureValue(b))[0]; f = cheap || null; }
        else f = await pickCard(P, pool, `${src.card.name}: sacrifice another creature to draw a card and give Klingons and Warriors +2/+2? (or none)`, { optional: true });
        if (!f) return;
        tkSacrifice(P, f);
        drawCards(P, 1);
        P.bf.filter(tdKlingonOrWarrior).forEach(x => { x.tp += 2; x.tq += 2; });
        log('Klingons and Warriors you control get +2/+2 until end of turn.');
    },
    td_lifelinkAll(P) { P.bf.filter(isCreature).forEach(x => x.tkw.push('lifelink')); log('Creatures you control gain lifelink until end of turn.'); },
    td_korok(P, e, t, src) { const X = tdOppsAttacked(P); if (X <= 0) return; P.bf.filter(isCreature).forEach(x => { x.tp += X; x.tq += X; }); log(`Creatures you control get +${X}/+${X} until end of turn.`); },
    async td_martok(P, e, t, src) {
        const X = tdOppsAttacked(P); if (X <= 0) return;
        const pool = P.bf.filter(isCreature);
        const chosen = [];
        for (let k = 0; k < X && chosen.length < pool.length; k++) {
            const rest = pool.filter(x => !chosen.includes(x));
            const pick = (P.isAI || AUTOPLAY) ? rest.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, rest, `${src.card.name}: put a +1/+1 counter on a creature (${k + 1} of up to ${X})`, { optional: true });
            if (!pick) break;
            chosen.push(pick);
        }
        chosen.forEach(x => putCounters(x, 1, P));
    },
    // Merciful Mandate: untap all your creatures; in a combat phase you may end the combat phase
    async td_mandate(P, e, t, src) {
        P.bf.filter(isCreature).forEach(x => { x.tapped = false; });
        log(`${P.name} untap${you(P) ? '' : 's'} all creatures.`);
        const inCombat = ['declareAttackers', 'declareBlocks', 'afterBlocks', 'combatDamage'].includes(G.phase) && (G.attackers || []).length;
        if (!inCombat) return;
        const end = (P.isAI || AUTOPLAY) ? (G.active !== P.i) : await askYes(P, `${src.card.name}: end the combat phase?`, { card: src.card });
        if (end) { G.attackers = []; G.blocks = {}; log('The combat phase ends: all attackers and blockers are removed from combat.'); }
    },
    td_vengeance(P) { P.rvTurn = G.turn; log(`Until end of turn, a creature that deals combat damage to ${P.name} is destroyed and ${P.name} gets a 2/1 Klingon Warrior.`); },
    td_deathtouchAll(P, e, t, src) { P.bf.filter(x => isCreature(x) && x !== src).forEach(x => x.tkw.push('deathtouch')); log('Other creatures you control gain deathtouch until end of turn.'); },
    td_kurn(P, e, t, src) { const X = tdOppsAttacked(P); if (X <= 0) return; drawCards(P, X); P.life -= X; fire('loseLife', { P, n: X }); log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${X} life.`); },
    async td_promise(P, e, t, src) {
        const pool = P.bf.filter(tdKlingonOrWarrior);
        const back = P.gy.filter(x => tdCreatureCard(x) && (hasType(x, 'Klingon') || hasType(x, 'Warrior')));
        if (!pool.length) return;
        let f;
        if (P.isAI || AUTOPLAY) f = back.length >= 2 ? pool.slice().sort((a, b) => (a.token ? -5 : 0) + creatureValue(a) - ((b.token ? -5 : 0) + creatureValue(b)))[0] : null;
        else f = await pickCard(P, pool, `${src.card.name}: sacrifice a Klingon or Warrior to return the others from your graveyard? (or none)`, { optional: true });
        if (!f) return;
        tkSacrifice(P, f);
        P.gy.filter(x => tdCreatureCard(x) && (hasType(x, 'Klingon') || hasType(x, 'Warrior')) && x !== f).forEach(x => { putOntoBattlefield(P, x); log(`${x.card.name} returns to the battlefield.`); });
    },
    // The Beacon of Kahless
    async td_beacon(P, e, t, src) {
        const X = tdOppsAttacked(P); if (X <= 0) return;
        const cols = ['W', 'U', 'B', 'R', 'G'];
        let c = (typeof bestPoolColor === 'function' && bestPoolColor(P)) || 'R'; if (!cols.includes(c)) c = 'R';
        if (!(P.isAI || AUTOPLAY)) { const w = await pickWord(P, `${src.card.name}: choose a color`, cols.map(k => COLOR_NAMES[k])); c = cols.find(k => COLOR_NAMES[k] === w) || c; }
        await applyEffect(P, { t: 'addMana', fromN: true, n: X, color: c }, null, src);
    },
    // Galvanizing Tenor: goad up to X target creatures
    async td_tenor(P, e, t, src) {
        const X = tdOppsAttacked(P); if (X <= 0) return;
        const pool = allPerms().filter(x => isCreature(x) && x.owner !== P.i && !has(x, 'hexproof') && !has(x, 'shroud'));
        const chosen = [];
        for (let k = 0; k < X && chosen.length < pool.length; k++) {
            const rest = pool.filter(x => !chosen.includes(x));
            const pick = (P.isAI || AUTOPLAY) ? rest.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, rest, `${src.card.name}: goad a creature (${k + 1} of up to ${X})`, { optional: true });
            if (!pick) break;
            chosen.push(pick);
        }
        chosen.forEach(x => goad(x, P.i, nextTurnOf(P)));
    },
    async td_gloryTokens(P, e, t, src) { const n = foes(P).length; if (n > 0) await applyEffect(P, tdKlingonToken(n), null, src); },
    // Melee: each attacking creature gets +1/+1 for each opponent attacked this combat
    td_melee(P, e, t, src) {
        const list = (tdCtx().list || []).filter(x => x.owner === P.i);
        const n = new Set(list.map(x => (x.atkTo !== undefined ? x.atkTo : (G.defender !== undefined && G.defender !== null ? G.defender : opp(P).i)))).size;
        if (n <= 0) return;
        list.forEach(x => { x.tp += n; x.tq += n; });
        log(`Attacking creatures get +${n}/+${n} (melee).`);
    },
    td_targ(P) { P.bf.filter(tdKlingonOrWarrior).forEach(x => { x.tp += 2; x.tkw.push('trample'); }); log('Klingons and Warriors you control get +2/+0 and gain trample until end of turn.'); },
    // Grilka: gain control of target creature an opponent controls until end of turn; untap, trample, haste, Treasures when it hits
    async td_grilka(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const F = G.players[x.owner]; if (F === P) return;
        pull(F.bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = P.i; x.tapped = false; x.sick = false; x.stolenTurn = G.turn; P.bf.push(x);
        x.tkw.push('trample', 'haste'); x.grilkaTreasure = true;
        log(`${P.name} gains control of ${x.card.name} until end of turn; it untaps and gains trample and haste.`);
    },
    // Kang: he and the chosen creature are goaded for as long as you control him
    async td_kangEtb(P, e, t, src) {
        const x = t && t.o;
        goad(src, P.i, Infinity); src.goaded.kangUid = src.uid;
        if (x && onBf(x.uid)) { goad(x, P.i, Infinity); x.goaded.kangUid = src.uid; }
    },
    // Own the Day / World at War: untap the creatures that attacked this turn; an additional combat phase follows (it comes after the combat that is going on)
    td_extraCombat(P, e, t, src) {
        P.bf.filter(x => isCreature(x) && x.atkTurn === G.turn && x.tapped).forEach(x => { x.tapped = false; });
        if (['main2', 'end'].includes(G.phase)) { log('It is too late for an additional combat phase this turn.'); return; }
        G.extraCombat = (G.extraCombat || 0) + 1;
        log(`${P.name} untap${you(P) ? '' : 's'} the creatures that attacked; there will be an additional combat phase.`);
    },
    // Qo'noS Quartermaster: one mana of any color that stays until end of turn
    td_quartermaster(P) {
        const cols = ['W', 'U', 'B', 'R', 'G'];
        const c = (typeof bestPoolColor === 'function' && bestPoolColor(P)) || 'R';
        P.pool = (P.pool || []).concat([cols.includes(c) ? c : 'R']); P.keepPoolTurn = G.turn;
        log(`${P.name} add${you(P) ? '' : 's'} {${cols.includes(c) ? c : 'R'}} (it stays until end of turn).`);
    },
    // Alexander, Ship's Fool
    async td_alexander(P, e, t, src) {
        let X = 0;
        for (const Y of G.players.filter(p => !p.out)) {
            const top = Y.library[Y.library.length - 1];
            if (top) { log(`${Y.name} ${you(Y) ? 'reveal' : 'reveals'} ${top.card.name}.`); X = Math.max(X, top.card.cmc || 0); }
            drawCards(Y, 1);
        }
        const fs = foes(P);
        if (!fs.length) return;
        const F = fs[rand(fs.length)];
        damage(F, X, src); log(`${src.card.name} deals ${X} damage to ${F.name}.`);
    },
    async td_curzonDies(P, e, t, src) {
        const pool = P.hand.filter(x => tdCreatureCard(x) && (x.card.cmc || 0) <= 3);
        const pick = await tdPool(P, pool, `${src.card.name}: put a creature card with mana value 3 or less from your hand onto the battlefield (or none)`, { optional: true });
        if (pick) { putOntoBattlefield(P, pick); log(`${pick.card.name} is put onto the battlefield.`); }
    },
    async td_riteAscension(P, e, t, src) {
        const X = tdOppsAttacked(P); if (X <= 0) return;
        const before = new Set(P.bf);
        await applyEffect(P, { ...tdKlingonToken(X), attacking: true }, null, src);
        const def = [...(P.attOpps ? P.attOpps.set : [])][0];
        P.bf.filter(x => !before.has(x)).forEach(tok => { tok.tapped = true; if (G.players.length > 2 && def !== undefined) tok.atkTo = def; });
    },
    async td_sinsIII(P, e, t, src) {
        const X0 = t && t.p ? t.p : opp(P);
        const n = X0.gy.filter(tdCreatureCard).length;
        X0.gy.splice(0).forEach(c => X0.exile.push(c));
        log(`${X0.name}'s graveyard is exiled (${n} creature card${n === 1 ? '' : 's'}).`);
        foes(P).forEach(F => { F.life -= n; fire('loseLife', { P: F, n }); log(`${F.name} loses ${n} life.`); });
    },
    async td_ktinga(P, e, t, src) {
        const pool = P.bf.filter(tdKlingonOrWarrior);
        const chosen = [];
        for (let k = 0; k < 2 && chosen.length < pool.length; k++) {
            const rest = pool.filter(x => !chosen.includes(x));
            const pick = (P.isAI || AUTOPLAY) ? rest.filter(x => !x.tapped || G.attackers.includes(x.uid)).sort((a, b) => pow(b) - pow(a))[0] : await pickCard(P, rest, `${src.card.name}: choose a Klingon or Warrior to gain flying (${k + 1} of up to 2)`, { optional: true });
            if (!pick) break;
            chosen.push(pick);
        }
        chosen.forEach(x => x.tkw.push('flying'));
        if (chosen.length) log(`${chosen.map(x => x.card.name).join(' and ')} gain flying until end of turn.`);
    },
    td_concerted(P) {
        ['flying', 'fear', 'first strike', 'double strike', 'trample', 'vigilance'].forEach(kw => {
            if (P.bf.some(x => isCreature(x) && has(x, kw))) { P.bf.filter(isCreature).forEach(x => { if (!has(x, kw)) x.tkw.push(kw); }); log(`Creatures you control gain ${kw} until end of turn.`); }
        });
    },
    async td_duelist(P, e, t, src) {
        if (G.active !== P.i) return;
        const mine = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i && !has(x, 'double strike')).sort((a, b) => pow(b) - pow(a));
        if (!mine.length) return;
        if (!(P.isAI || AUTOPLAY) && !(await askYes(P, `${src.card.name}: give ${mine[0].card.name} double strike?`, { card: mine[0].card }))) return;
        mine[0].tkw.push('double strike'); log(`${mine[0].card.name} gains double strike until end of turn.`);
    },
    td_sharedAnimosity(P) {
        const list = (tdCtx().list || []).filter(x => x.owner === P.i);
        list.forEach(x => {
            const ts = tdTypesOf(x); const chg = has(x, 'changeling');
            const n = list.filter(y => y !== x && (chg || has(y, 'changeling') || tdTypesOf(y).some(w => ts.includes(w)))).length;
            if (n > 0) { x.tp += n; log(`${x.card.name} gets +${n}/+0 (Shared Animosity).`); }
        });
    },
    // Painful Truths (converge): the number of colors of mana the lands you control could have produced for it (at most three: the spell costs {2}{B})
    td_painful(P, e, t, src) {
        const cols = new Set(); P.bf.forEach(x => { const m = manaOf(x); if (m && m.colors) m.colors.forEach(c => { if ('WUBRG'.includes(c)) cols.add(c); }); });
        const X = Math.max(1, Math.min(3, cols.size));
        drawCards(P, X); P.life -= X; fire('loseLife', { P, n: X }); log(`${P.name} ${you(P) ? 'draw' : 'draws'} ${X} card${X === 1 ? '' : 's'} and ${you(P) ? 'lose' : 'loses'} ${X} life.`);
    },
    td_pest() { allPerms().filter(x => !/\bLand\b/.test(x.card.type) && (x.card.cmc || 0) <= 1).forEach(x => { if (!has(x, 'indestructible')) { log(`${x.card.name} is destroyed.`); dieOrLeave(x, 'gy'); } }); },
    async td_swordLS(P, e, t, src) {
        const pool = P.gy.filter(tdCreatureCard);
        const pick = await tdPool(P, pool, `${src.card.name}: return a creature card from your graveyard to your hand (or none)`, { optional: true });
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${P.name}'s hand.`); }
    },
    async td_returnToDust(P, e, t, src) {
        const x = t && t.o;
        if (x && onBf(x.uid)) { log(`${x.card.name} is exiled.`); leaveBattlefield(x, 'exile'); }
        if (!['main1', 'main2'].includes(G.phase) || G.active !== P.i) return;
        const pool = allPerms().filter(y => y !== x && /Artifact|Enchantment/.test(y.card.type) && !has(y, 'hexproof') && !has(y, 'shroud'));
        const pick = (P.isAI || AUTOPLAY) ? pool.filter(y => y.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: exile up to one other artifact or enchantment`, { optional: true });
        if (pick) { log(`${pick.card.name} is exiled.`); leaveBattlefield(pick, 'exile'); }
    }
});
Object.assign(CMD_SCORE, { td_kor: P => (P.bf.some(x => x.token) ? 3 : 0), td_lifelinkAll: () => 2, td_korok: () => 5, td_martok: () => 5, td_mandate: () => 2, td_vengeance: () => 3, td_deathtouchAll: () => 2, td_kurn: () => 4, td_promise: P => (P.gy.filter(x => tdCreatureCard(x) && (hasType(x, 'Klingon') || hasType(x, 'Warrior'))).length >= 2 ? 6 : 0), td_beacon: () => 3, td_tenor: () => 4, td_gloryTokens: () => 5, td_melee: () => 3, td_targ: () => 4, td_grilka: () => 6, td_kangEtb: () => 5, td_extraCombat: P => (G.phase === 'main1' && P.bf.some(x => isCreature(x) && !x.sick) ? 7 : 0), td_quartermaster: () => 2, td_alexander: () => 3, td_curzonDies: () => 3, td_riteAscension: () => 5, td_sinsIII: () => 4, td_ktinga: () => 3, td_concerted: () => 2, td_duelist: () => 3, td_sharedAnimosity: () => 3, td_painful: () => 5, td_pest: P => (allPerms().filter(x => !/\bLand\b/.test(x.card.type) && (x.card.cmc || 0) <= 1 && x.owner !== P.i).length > P.bf.filter(x => !/\bLand\b/.test(x.card.type) && (x.card.cmc || 0) <= 1).length ? 6 : 0), td_swordLS: () => 3, td_returnToDust: () => 6 });

// ---- Sacrifice a "nonland permanent" as an additional cost (Rite of Oblivion) ----
(function () {
    const sf = sacFodder, sc = sacCandidates;
    sacCandidates = function (P, src, kind) { return kind === 'nonland permanent' ? P.bf.filter(x => !/\bLand\b/.test(x.card.type) && x !== src) : sc.apply(this, arguments); };
    sacFodder = function (P, src, kind) { return kind === 'nonland permanent' ? (sacCandidates(P, src, kind).sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0] || null) : sf.apply(this, arguments); };
})();

// ================= Landing Party =================
const tdCoven = P => new Set(P.bf.filter(isCreature).map(x => pow(x))).size >= 3;
const tdBottomRandom = (X, cards) => { shuffle(cards); cards.forEach(c => X.library.unshift(c)); };
// Return the creature types of a card's type line
Object.assign(CMD, {
    // Balance of Terror I: destroy up to one other target artifact or enchantment
    async td_balanceDestroy(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid) && x !== src && !has(x, 'indestructible')) { log(`${x.card.name} is destroyed.`); dieOrLeave(x, 'gy'); } },
    // Balance of Terror II & III / Chief Kyle: exile up to one other permanent you control (a creature for Kyle); it returns at the beginning of the next end step
    async td_blinkOwn(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && (!e.creature || isCreature(x)));
        if (!pool.length) return;
        let x;
        if (P.isAI || AUTOPLAY) { x = pool.filter(y => !y.token && ((y.ctr && y.ctr.charge === undefined) || true) && (Rx(y).etb || []).length).sort((a, b) => permValue(b) - permValue(a))[0] || null; }
        else x = await pickCard(P, pool, `${src.card.name}: exile up to one other permanent you control (it returns at the next end step)`, { optional: true });
        if (!x || x.token) { if (x && x.token) { /* a token exiled doesn't return */ } else return; }
        log(`${x.card.name} is exiled.`); leaveBattlefield(x, 'exile');
        if (x.token) return;
        tdAtEnd(() => { const own = G.players[x.owner]; if (own.exile.includes(x)) { pull(own.exile, x); putOntoBattlefield(own, x); log(`${x.card.name} returns to the battlefield.`); } }, `${x.card.name} returns to the battlefield.`);
    },
    // Shuttlecraft Galileo: up to seven target attacking creatures gain flying
    td_galileo(P) { (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i).slice(0, 7).forEach(x => x.tkw.push('flying')); log('Up to seven attacking creatures gain flying until end of turn.'); },
    // Tribble Cluster: X 1/1 Tribble tokens that can't block, X = its power
    async td_tribbles(P, e, t, src) {
        const X = Math.max(0, (G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.pow : pow(src)));
        if (X > 0) await applyEffect(P, { t: 'token', n: X, p: 1, q: 1, name: 'white Tribble', kw: [], text: 'This token can\'t block.' }, null, src);
    },
    // Fleet Captain Christopher Pike
    async td_pikeYes(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src && x.tapped);
        const chosen = (P.isAI || AUTOPLAY) ? pool.sort((a, b) => creatureValue(b) - creatureValue(a)).slice(0, 2) : await tdPickN(P, P.bf.filter(x => isCreature(x) && x !== src), 2, `${src.card.name}: untap two other target creatures`);
        chosen.forEach(x => { x.tapped = false; });
        if (chosen.length) log(`${chosen.map(x => x.card.name).join(' and ')} untap.`);
    },
    async td_pikeNo(P, e, t, src) {
        const pool = allPerms().filter(x => isCreature(x) && x !== src && !x.tapped && x.owner !== P.i);
        const chosen = (P.isAI || AUTOPLAY) ? pool.sort((a, b) => creatureValue(b) - creatureValue(a)).slice(0, 2) : await tdPickN(P, allPerms().filter(x => isCreature(x) && x !== src && !x.tapped), 2, `${src.card.name}: tap two other target creatures`);
        chosen.forEach(x => { x.tapped = true; fire('tapped', { o: x }); });
        if (chosen.length) log(`${chosen.map(x => x.card.name).join(' and ')} become tapped.`);
    },
    // Giant Space Amoeba: -3/-0 on a defender's creature, then a token copy of it
    async td_amoeba(P, e, t, src) {
        const def = G.players[src.atkTo !== undefined ? src.atkTo : (G.defender !== undefined ? G.defender : opp(P).i)];
        const pool = def ? def.bf.filter(x => isCreature(x) && !has(x, 'hexproof') && !has(x, 'shroud')) : [];
        const x = pool.length ? await tdPool(P, pool, `${src.card.name}: choose a creature the defending player controls (-3/-0)`) : null;
        if (x) { x.tp -= 3; log(`${x.card.name} gets -3/-0 until end of turn.`); }
        if (onBf(src.uid)) tokenCopyOf(P, src.front && src.card === src.front ? src.front : src.card);
    },
    // Lieutenant Nyota Uhura
    async td_uhura(P, e, t, src) {
        const fs = foes(P).filter(F => F.library.length);
        if (!fs.length) return;
        const F = (P.isAI || AUTOPLAY) ? fs.slice().sort((a, b) => b.library.length - a.library.length)[0] : (fs.length === 1 ? fs[0] : (await pickPlayers(P, `${src.card.name}: choose a target opponent`, fs, [fs[0]]))[0] || fs[0]);
        const X = tkNamedLands(P);
        const seen = F.library.splice(-X).reverse();
        seen.forEach(c => F.exile.push(c));
        log(`${F.name} exiles the top ${seen.length} card${seen.length === 1 ? '' : 's'} of their library.`);
        const cands = seen.filter(c => ['instant', 'sorcery'].includes(Rx(c).kind) && Rx(c).support !== 'none');
        if (cands.length) {
            let pick;
            if (P.isAI || AUTOPLAY) pick = cands.slice().sort((a, b) => aiScore(P, b, null) - aiScore(P, a, null))[0];
            else pick = await pickCard(P, cands, `${src.card.name}: cast an instant or sorcery from among them without paying its mana cost (or none)`, { optional: true });
            if (pick) await castFreeAuto(P, pick);
        }
        const rest = seen.filter(c => F.exile.includes(c));
        rest.forEach(c => pull(F.exile, c)); tdBottomRandom(F, rest);
    },
    // Janice Rand: +1/+1 counter on the commander, then reveal until a land: onto the battlefield tapped, the rest to the bottom
    async td_rand(P, e, t, src) {
        const x = tdCtx().o || G.ctxObj;
        const cmdr = x && x.isCommander ? x : ((tdCtx().list || []).find(y => y.isCommander && y.owner === P.i));
        if (cmdr && onBf(cmdr.uid)) putCounters(cmdr, 1, P);
        const seen = [];
        let land = null;
        while (P.library.length) { const c = P.library.pop(); if (Rx(c).kind === 'land') { land = c; break; } seen.push(c); }
        if (land) { putOntoBattlefield(P, land, true); land.tapped = true; log(`${land.card.name} is put onto the battlefield tapped.`); }
        tdBottomRandom(P, seen);
    },
    td_explore(P, e, t, src) { if (onBf(src.uid)) return applyEffect(P, { t: 'explore' }, { o: src }, src); },
    // Chief Montgomery Scott
    async td_scott(P, e, t, src) {
        const pool = P.hand.filter(x => /\bCreature\b|\bSpacecraft\b/.test(x.card.type));
        const pick = await tdPool(P, pool, `${src.card.name}: put a creature or Spacecraft card from your hand onto the battlefield (or none)`, { optional: true });
        if (!pick) return;
        const X = tkNamedLands(P);
        putOntoBattlefield(P, pick);
        if (/\bSpacecraft\b/.test(pick.card.type)) tkCounters(pick, 'charge', X); else if (isCreature(pick)) putCounters(pick, X, P);
        log(`${pick.card.name} is put onto the battlefield with ${X} additional counter${X === 1 ? '' : 's'}.`);
    },
    // Lt. Arex: draw three; put up to three lands from hand onto the battlefield tapped
    async td_arex(P, e, t, src) { drawCards(P, 3); await CMD.td_putLands(P, { n: 3 }, null, src); },
    async td_putLands(P, e, t, src) {
        for (let k = 0; k < (e.n || 1); k++) {
            const pool = P.hand.filter(x => Rx(x).kind === 'land');
            if (!pool.length) break;
            const pick = (P.isAI || AUTOPLAY) ? pool[0] : await pickCard(P, pool, `${src.card.name}: put a land card from your hand onto the battlefield tapped (${k + 1} of ${e.n || 1}, or none)`, { optional: true });
            if (!pick) break;
            putOntoBattlefield(P, pick); pick.tapped = true;
            log(`${pick.card.name} is put onto the battlefield tapped.`);
        }
    },
    td_counterAll(P) { P.bf.filter(isCreature).forEach(x => putCounters(x, 1, P)); log('A +1/+1 counter is put on each creature you control.'); },
    // T'Pring: choose another creature you control and one an opponent controls; they may fight; a creature that fought dies this turn: draw
    async td_tpring(P, e, t, src) {
        const mine = P.bf.filter(x => isCreature(x) && x !== src), theirs = allPerms().filter(x => isCreature(x) && x.owner !== P.i && !has(x, 'hexproof') && !has(x, 'shroud'));
        if (!mine.length || !theirs.length) return;
        let a, b;
        if (P.isAI || AUTOPLAY) {
            const pairs = []; mine.forEach(m => theirs.forEach(th => pairs.push({ m, th, s: (tou(th) - th.dmg <= pow(m) ? creatureValue(th) : 0) - (tou(m) - m.dmg <= pow(th) ? creatureValue(m) : 0) })));
            pairs.sort((x, y) => y.s - x.s); if (pairs[0].s <= 0) return; a = pairs[0].m; b = pairs[0].th;
        } else {
            a = await pickCard(P, mine, `${src.card.name}: choose another creature you control (or none)`, { optional: true }); if (!a) return;
            b = await pickCard(P, theirs, `${src.card.name}: choose a creature an opponent controls to fight ${a.card.name}`, { required: true });
            if (!await askYes(P, `${a.card.name} fights ${b.card.name}?`, { card: a.card })) return;
        }
        log(`${a.card.name} fights ${b.card.name}.`);
        const pa = Math.max(0, pow(a)), pb = Math.max(0, pow(b));
        damage(b, pa, a); damage(a, pb, b);
        a.foughtTurn = b.foughtTurn = G.turn; a.foughtBy = b.foughtBy = P.i;
    },
    // The Guardian of Forever: sacrifice another nontoken creature; it returns at the next end step
    async td_guardian(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && !x.token && x !== src);
        if (!pool.length) return;
        const f = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (Rx(b).etb || []).length - (Rx(a).etb || []).length || creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: sacrifice another nontoken creature (it returns at the next end step)`, { required: true });
        if (!f) return;
        tkSacrifice(P, f);
        tdAtEnd(() => { const own = G.players[f.owner]; if (own.gy.includes(f)) { pull(own.gy, f); putOntoBattlefield(own, f); log(`${f.card.name} returns to the battlefield.`); } }, `${f.card.name} returns to the battlefield.`);
    },
    async td_chargeArtifact(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) tkCounters(x, 'charge', 2); },
    // Planet Killer
    td_planetKiller(P, e, t, src) {
        const hit = (tdCtx().hit || [])[0]; if (!hit) return;
        const n = hit.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
        if (n > 0 && onBf(src.uid)) putCounters(src, n, P);
    },
    // S.S. Botany Bay: each opponent exiles a card from their graveyard (with it); you may exile one from yours
    async td_botanyBay(P, e, t, src) {
        src.exiledWith = src.exiledWith || [];
        for (const F of foes(P)) {
            const pool = F.gy.slice();
            if (!pool.length) continue;
            const pick = (F.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (tdCreatureCard(a) ? 1 : 0) - (tdCreatureCard(b) ? 1 : 0) || tkBest(b, a))[0] : await pickCard(F, pool, `${src.card.name}: exile a card from your graveyard`, { required: true });
            if (pick) { pull(F.gy, pick); F.exile.push(pick); src.exiledWith.push(pick); log(`${F.name} exiles ${pick.card.name} from their graveyard.`); }
        }
        const mine = P.gy.filter(tdCreatureCard);
        if (mine.length) {
            const pick = (P.isAI || AUTOPLAY) ? mine.slice().sort(tkBest)[0] : await pickCard(P, P.gy, `${src.card.name}: you may exile a card from your graveyard (or none)`, { optional: true });
            if (pick) { pull(P.gy, pick); P.exile.push(pick); src.exiledWith.push(pick); log(`${P.name} exiles ${pick.card.name} from their graveyard.`); }
        }
    },
    async td_botanyReturn(P, e, t, src) {
        const back = (src.exiledWith || []).filter(c => tdCreatureCard(c) && c.owner === P.i && G.players[c.owner].exile.includes(c));
        back.forEach(c => { pull(G.players[c.owner].exile, c); putOntoBattlefield(P, c); log(`${c.card.name} returns to the battlefield.`); });
        src.exiledWith = (src.exiledWith || []).filter(c => !back.includes(c));
    },
    // U.S.S. Defiant: it and up to one target creature you control phase out
    async td_defiant(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        const x = pool.length && !(P.isAI || AUTOPLAY) ? await pickCard(P, pool, `${src.card.name}: choose up to one creature you control to phase out with it`, { optional: true }) : null;
        if (typeof phaseOut === 'function') { phaseOut(src); if (x && onBf(x.uid)) phaseOut(x); }
    },
    // U.S.S. Farragut: put a creature card from your hand onto the battlefield with haste; at the next end step put it on the bottom of your library and draw
    async td_farragut(P, e, t, src) {
        const pool = P.hand.filter(tdCreatureCard);
        const pick = await tdPool(P, pool, `${src.card.name}: put a creature card from your hand onto the battlefield (it goes to the bottom of your library at the next end step; or none)`, { optional: true });
        if (!pick) return;
        putOntoBattlefield(P, pick); pick.tkw.push('haste'); pick.sick = false;
        log(`${pick.card.name} is put onto the battlefield with haste.`);
        tdAtEnd(() => { if (onBf(pick.uid)) { leaveBattlefield(pick, 'library'); pull(P.library, pick); P.library.unshift(pick); log(`${pick.card.name} is put on the bottom of ${P.name}'s library.`); drawCards(P, 1); } }, `${pick.card.name} goes to the bottom of the library.`);
    },
    // Shore Leave Planet: becomes a copy of target creature you control until end of turn (not legendary, a Robot artifact)
    async td_shoreLeave(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid) || !onBf(src.uid)) return;
        const orig = src.card;
        let type = x.card.type.replace(/Legendary /, '');
        if (!/\bArtifact\b/.test(type)) type = `Artifact ${type}`;
        if (!/\bRobot\b/.test(type)) type = /—/.test(type) ? `${type} Robot` : `${type} — Robot`;
        src.copyOfLand = orig; src.card = { ...x.card, id: `${x.card.id}-copy${uidSeq}`, type };
        src.sick = false;
        log(`${orig.name} becomes a copy of ${x.card.name} until end of turn.`);
        tdAtEnd(() => { if (src.copyOfLand) { src.card = src.copyOfLand; delete src.copyOfLand; } }, `${orig.name} stops being a copy.`);
    },
    // Echo of Eons: each player shuffles hand and graveyard into library, then draws seven
    td_echo(P) {
        G.players.filter(p => !p.out).forEach(X => {
            const n = X.hand.length + X.gy.length;
            X.hand.splice(0).concat(X.gy.splice(0)).forEach(c => { c.card = c.front || c.card; X.library.push(c); });
            shuffle(X.library);
            drawCards(X, 7);
            log(`${X.name} shuffles ${n} card${n === 1 ? '' : 's'} into their library and draws seven.`);
        });
    },
    // Satyr Wayfinder
    async td_wayfinder(P, e, t, src) {
        const seen = []; for (let k = 0; k < 4 && P.library.length; k++) seen.push(P.library.pop());
        const lands = seen.filter(c => Rx(c).kind === 'land');
        const pick = lands.length ? await tdPool(P, lands, `${src.card.name}: put a land card from among them into your hand (or none)`, { optional: true }) : null;
        if (pick) { P.hand.push(pick); log(`${pick.card.name} is put into ${P.name}'s hand.`); }
        seen.filter(c => c !== pick).forEach(c => P.gy.push(c));
        log(`${P.name} puts ${seen.length - (pick ? 1 : 0)} card${seen.length - (pick ? 1 : 0) === 1 ? '' : 's'} into their graveyard.`);
    }
});
// Pick up to n creatures (a person picks one at a time; the computer's choice is made by its callers)
async function tdPickN(P, pool, n, title) {
    const out = [];
    for (let k = 0; k < n; k++) {
        const rest = pool.filter(x => !out.includes(x));
        if (!rest.length) break;
        const pick = await pickCard(P, rest, `${title} (${k + 1} of ${n})`, { optional: true });
        if (!pick) break;
        out.push(pick);
    }
    return out;
}
Object.assign(CMD_SCORE, { td_balanceDestroy: () => 4, td_blinkOwn: P => (P.bf.some(x => !x.token && (Rx(x).etb || []).length) ? 3 : 0), td_galileo: () => 3, td_tribbles: () => 3, td_pikeYes: P => (P.bf.filter(x => isCreature(x) && x.tapped).length >= 2 ? 3 : 0), td_pikeNo: () => 3, td_amoeba: () => 6, td_uhura: () => 4, td_rand: () => 5, td_explore: () => 3, td_scott: P => (P.hand.some(x => /\bCreature\b|\bSpacecraft\b/.test(x.card.type)) ? 6 : 0), td_arex: () => 7, td_putLands: () => 2, td_counterAll: () => 5, td_tpring: () => 6, td_guardian: () => 2, td_chargeArtifact: () => 3, td_planetKiller: () => 4, td_botanyBay: () => 3, td_botanyReturn: () => 5, td_defiant: () => 2, td_farragut: () => 3, td_shoreLeave: () => 1, td_echo: P => (P.hand.length <= 2 ? 6 : 0), td_wayfinder: () => 3 });

// T'Pring: a creature that fought this way dies this turn: its fight's owner draws a card (hooked on the death event)
(function () {
    const f = fire;
    fire = function (ev, ctx) {
        if (ev === 'creatureDies' && ctx && ctx.o && ctx.o.foughtTurn === G.turn && ctx.o.foughtBy !== undefined && G.players[ctx.o.foughtBy] && !G.players[ctx.o.foughtBy].out) {
            const Q = G.players[ctx.o.foughtBy];
            if (allPerms().some(a => a.owner === Q.i && /T'Pring/.test(a.card.name) || true)) { drawCards(Q, 1); log(`${Q.name} ${you(Q) ? 'draw' : 'draws'} a card (${ctx.o.card.name}, which fought, died).`); }
        }
        return f.apply(this, arguments);
    };
})();

// Ancient Greenwarden: a land entering causes a triggered ability of a permanent you control to trigger an additional time
(function () {
    const g = cmdExtraTriggers;
    cmdExtraTriggers = function (ev, o, tr, ctx) {
        let k = g.apply(this, arguments);
        const landEnter = (ev === 'landfall' || ev === 'enters' || ev === 'selfEnters') && ctx && ctx.o && /\bLand\b/.test(ctx.o.card.type);
        if (landEnter) allPerms().forEach(a => { if (a.owner === o.owner && Rx(a).greenwarden && !lostAbilities(a)) k++; });
        return k;
    };
})();

// Pavel Chekov: if you would draw a card, you may instead choose land or nonland and reveal cards until you reveal one of that kind
(function () {
    const d = drawCards;
    drawCards = function (P, n, opening) {
        if (opening === true || !P || !P.bf.some(a => Rx(a).chekovDraw && !lostAbilities(a)) || !(n > 0)) return d.apply(this, arguments);
        for (let k = 0; k < n; k++) {
            if (!P.library.length) { d.call(this, P, 1, opening); continue; }
            const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length, handLands = P.hand.filter(x => Rx(x).kind === 'land').length;
            const wantLand = handLands === 0 && lands < 5;
            const seen = []; let got = null;
            while (P.library.length) { const c = P.library.pop(); if ((Rx(c).kind === 'land') === wantLand) { got = c; break; } seen.push(c); }
            if (got) { P.hand.push(got); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} cards until ${got.card.name} (${wantLand ? 'land' : 'nonland'}): it goes into ${you(P) ? 'your' : 'their'} hand (Pavel Chekov).`); }
            tdBottomRandom(P, seen);
            if (!got && seen.length) { /* nothing of that kind: the revealed cards go to the bottom */ }
            fire('drew', { P, n: 1 });
        }
    };
})();

// ================= We Are the Borg =================
Object.assign(CMD, {
    async td_incursion(P, e, t, src) {
        await tkBorgs(P, 2, src);
        const cols = ['W', 'U', 'B', 'R', 'G'];
        let c;
        if (P.isAI || AUTOPLAY) { const tally = {}; foes(P).flatMap(F => F.bf).forEach(x => (x.card.colors || []).forEach(k => { tally[k] = (tally[k] || 0) + 1; })); c = cols.slice().sort((a, b) => (tally[b] || 0) - (tally[a] || 0))[0]; }
        else { const w = await pickWord(P, `${src.card.name}: choose a color`, cols.map(k => COLOR_NAMES[k])); c = cols.find(k => COLOR_NAMES[k] === w) || 'R'; }
        P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)).forEach(x => x.tkw.push(`pro:${c}`));
        log(`Artifact creatures you control gain protection from ${COLOR_NAMES[c]} until end of turn.`);
    },
    td_regen(P) { P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).forEach(x => x.tkw.push('hexproof', 'indestructible')); log('Artifacts you control gain hexproof and indestructible until end of turn.'); },
    async td_stratagem(P, e, t, src) { const X = Math.max(0, (G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.pow : pow(src))); await tkBorgs(P, X, src); },
    td_grow(P, e, t, src) { const x = tdCtx().src; if (x && onBf(x.uid)) putCounters(x, 1, P); },
    // Gift of Perfection: each opponent reveals until a creature card; assimilate one of them; the rest go to the bottom in random order
    async td_gift(P, e, t, src) {
        const revealed = [];
        for (const F of foes(P)) {
            const seen = [];
            while (F.library.length) { const c = F.library.pop(); seen.push(c); F.exile.push(c); if (tdCreatureCard(c)) { revealed.push({ F, c }); break; } }
            F._giftSeen = seen;
            if (seen.length) log(`${F.name} reveals ${seen.map(x => x.card.name).join(', ')}.`);
        }
        let pick = null;
        if (revealed.length) pick = (P.isAI || AUTOPLAY) ? revealed.slice().sort((a, b) => tkBest(a.c, b.c))[0] : revealed.length === 1 ? revealed[0] : revealed.find(r => r.c === (null)) || await (async () => { const c = await pickCard(P, revealed.map(r => r.c), `${src.card.name}: assimilate one of the creature cards`, { required: true }); return revealed.find(r => r.c === c); })();
        for (const F of foes(P)) {
            const rest = (F._giftSeen || []).filter(c => !pick || c !== pick.c);
            rest.forEach(c => pull(F.exile, c)); tdBottomRandom(F, rest);
            delete F._giftSeen;
        }
        if (pick) { pull(pick.F.exile, pick.c); tkAssimilate(P, pick.c); }
    },
    // Transwarp Hub: mill five, put up to two artifact cards into your hand
    async td_transwarp(P, e, t, src) {
        const milled = []; for (let k = 0; k < 5 && P.library.length; k++) milled.push(P.library.pop());
        milled.forEach(c => P.gy.push(c));
        log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${milled.length} card${milled.length === 1 ? '' : 's'}.`);
        const arts = milled.filter(c => /\bArtifact\b/.test(c.card.type));
        let chosen = [];
        if (P.isAI || AUTOPLAY) chosen = arts.slice().sort(tkBest).slice(0, 2);
        else chosen = await tdPickN(P, arts, 2, `${src.card.name}: put an artifact card from among them into your hand`);
        chosen.forEach(c => { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} is put into ${P.name}'s hand.`); });
    },
    // Võx: the next artifact creature spell and the next Spacecraft spell you cast this turn have undaunted
    td_vox(P) { P.voxTurn = G.turn; P.voxArt = true; P.voxShip = true; log('The next artifact creature spell and the next Spacecraft spell you cast this turn have undaunted.'); },
    // Assimilate the Wounded
    async td_wounded(P, e, t, src) {
        for (const F of foes(P)) {
            const pool = F.gy.filter(c => tdCreatureCard(c) && tdDiedThisTurn(c));
            const c = await tdPool(P, pool, `${src.card.name}: assimilate a creature card from ${F.name}'s graveyard that was put there from the battlefield this turn (or none)`, { optional: true });
            if (c) { pull(F.gy, c); tkAssimilate(P, c); }
        }
    },
    // Assimilation Assessor
    async td_assessorEtb(P, e, t, src) {
        const fs = foes(P).filter(F => F.gy.length); if (!fs.length) return;
        const F = (P.isAI || AUTOPLAY) ? fs.slice().sort((a, b) => b.gy.filter(tdCreatureCard).length - a.gy.filter(tdCreatureCard).length)[0] : (fs.length === 1 ? fs[0] : (await pickPlayers(P, `${src.card.name}: choose a target opponent`, fs, [fs[0]]))[0] || fs[0]);
        src.exiledWith = src.exiledWith || [];
        F.gy.splice(0).forEach(c => { F.exile.push(c); src.exiledWith.push(c); });
        log(`${F.name}'s graveyard is exiled.`);
    },
    async td_assessorAttack(P, e, t, src) {
        const pool = (src.exiledWith || []).filter(c => tdCreatureCard(c) && G.players.some(X => X.exile.includes(c)));
        const c = await tdPool(P, pool, `${src.card.name}: assimilate a creature card exiled with it`, { optional: false });
        if (!c) return;
        const own = G.players.find(X => X.exile.includes(c)); pull(own.exile, c); src.exiledWith = src.exiledWith.filter(x => x !== c);
        tkAssimilate(P, c);
    },
    // Battle of Wolf 359
    td_wolf359(P) {
        const X = P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)).length;
        if (X <= 0) return;
        allPerms().filter(x => isCreature(x) && !/\bArtifact\b/.test(x.card.type)).forEach(x => { x.tp -= X; x.tq -= X; });
        log(`Nonartifact creatures get -${X}/-${X} until end of turn.`);
    },
    // Extraction Integrant: a creature that blocks one of your artifact creatures gets -1/-1
    td_integrant(P) {
        Object.entries(G.blocks || {}).forEach(([a, bs]) => {
            const atk = onBf(Number(a));
            if (atk && atk.owner === P.i && /\bArtifact\b/.test(atk.card.type) && isCreature(atk)) bs.map(onBf).filter(Boolean).forEach(b => { b.tp -= 1; b.tq -= 1; log(`${b.card.name} gets -1/-1 until end of turn (it blocked ${atk.card.name}).`); });
        });
    },
    async td_reclaim(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type));
        if (!pool.length) return;
        const f = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (a.token ? -5 : 0) + creatureValue(a) - ((b.token ? -5 : 0) + creatureValue(b)))[0] : await pickCard(P, pool, `${src.card.name}: sacrifice an artifact creature`, { required: true });
        if (!f) return;
        tkSacrifice(P, f); drawCards(P, 1);
    },
    // The Best of Both Worlds
    async td_bobw1(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid) || /\bArtifact\b/.test(x.card.type)) return;
        const F = G.players[x.owner];
        pull(F.bf, x); x.realOwner = x.realOwner ?? x.owner; x.owner = P.i; x.sick = true; P.bf.push(x);
        x.card = { ...x.card, type: 'Artifact Creature — Borg' }; x.assimilated = true;
        putCounters(x, 1, P);
        src.bobwUid = x.uid; src.bobwObj = x;
        log(`${P.name} ${you(P) ? 'assimilate' : 'assimilates'} ${x.card.name}.`);
    },
    td_bobw2(P) { P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)).forEach(x => { x.tp += 2; x.tq += 2; }); log('Artifact creatures you control get +2/+2 until end of turn.'); },
    async td_bobw3(P, e, t, src) {
        const x = src.bobwObj; if (!x || !onBf(x.uid)) return;
        const own = G.players[x.realOwner ?? x.owner];
        leaveBattlefield(x, 'exile');
        if (x.token) return;
        pull(G.players[x.realOwner ?? x.owner].exile, x); x.owner = x.realOwner ?? x.owner; delete x.realOwner; delete x.assimilated;
        putOntoBattlefield(own, x);
        log(`${x.card.name} returns to the battlefield under its owner's control.`);
    },
    async td_deliver(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const mv = x.card.cmc || 0;
        log(`${x.card.name} is exiled.`); leaveBattlefield(x, 'exile');
        await tkBorgs(P, mv, src);
    },
    // Hugh: artifact spells you cast have replicate {2}{U} (approximation: the copies become tokens as the spell is cast)
    async td_replicate(P, e, t, src) {
        const c = tdCtx().o; if (!c || !c.card) return;
        const R = Rx(c); if (['instant', 'sorcery', 'land'].includes(R.kind)) return;
        const cost = { ...parseCost('{2}{U}') };
        let n = 0;
        while (n < 3) {
            const plan = planPayment(P, cost);
            if (!plan) break;
            if (!(P.isAI || AUTOPLAY)) { if (!await askYes(P, `${src.card.name}: pay {2}{U} to replicate ${c.card.name} (copy #${n + 1})?`, { card: src.card })) break; }
            else if (permValue(c) < 2 || (c.card.cmc || 0) > 5) break;
            plan.forEach(s => tapSource(P, s)); n++;
            tokenCopyOf(P, c.front && c.card === c.front ? c.front : c.card);
        }
        if (n) log(`${c.card.name} is replicated ${n} time${n === 1 ? '' : 's'}.`);
    },
    // Jurati: a token copy of target artifact token you control
    async td_jurati(P, e, t, src) {
        const key = `${G.turn}:${G.combatDmgStep || 0}`;
        if (src.juKey === key) return; src.juKey = key;
        const pool = P.bf.filter(x => x.token && /\bArtifact\b/.test(x.card.type));
        const x = await tdPool(P, pool, `${src.card.name}: create a token that's a copy of target artifact token you control`, { optional: true });
        if (x) tokenCopyOf(P, x.card);
    },
    // Queen's Diamond: one mana of a chosen color for each charge counter, to cast your commander (approximated as a legendary spell)
    async td_queensDiamond(P, e, t, src) {
        const n = (src.ctr && src.ctr.charge) || 0; if (n <= 0) return;
        const cols = ['W', 'U', 'B', 'R', 'G'];
        const cmdColors = new Set(P.command.filter(x => x.isCommander).flatMap(x => x.card.ci || x.card.colors || []));
        let c = cols.find(k => cmdColors.has(k)) || (typeof bestPoolColor === 'function' && bestPoolColor(P)) || 'G';
        if (!(P.isAI || AUTOPLAY)) { const w = await pickWord(P, `${src.card.name}: choose a color`, cols.map(k => COLOR_NAMES[k])); c = cols.find(k => COLOR_NAMES[k] === w) || c; }
        P.pool = (P.pool || []).concat(Array(n).fill(`${c}:Legendary`));
        log(`${P.name} add${you(P) ? '' : 's'} ${('{' + c + '}').repeat(n)} (only to cast ${you(P) ? 'your' : 'their'} commander).`);
    },
    // Reconnaissance Partition: remove a counter; search for a basic land (tapped) or draw a card
    async td_recon(P, e, t, src) {
        if (src.counters > 0) src.counters--; else if (src.ctr.charge > 0) src.ctr.charge--; else { const k = Object.keys(src.ctr || {}).find(q => src.ctr[q] > 0); if (!k) return; src.ctr[k]--; }
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
        const landMode = (P.isAI || AUTOPLAY) ? lands < 6 && P.library.some(x => Rx(x).kind === 'land' && /Basic/.test(x.card.type)) : await askYes(P, `${src.card.name}: search for a basic land (tapped)? (No: draw a card)`, { card: src.card, yes: 'Basic land', no: 'Draw a card' });
        if (landMode) await applyChoiceEffect(P, { t: 'fetchLand', n: 1, what: 'basic land', bf: true, tapped: true }, src, null); else drawCards(P, 1);
    }
});
Object.assign(CMD_SCORE, { td_incursion: () => 5, td_regen: () => 2, td_stratagem: () => 3, td_grow: () => 3, td_gift: () => 7, td_transwarp: () => 4, td_vox: () => 2, td_wounded: P => (foes(P).some(F => F.gy.some(c => tdCreatureCard(c) && tdDiedThisTurn(c))) ? 8 : 0), td_assessorEtb: () => 4, td_assessorAttack: () => 6, td_wolf359: P => { const X = P.bf.filter(x => isCreature(x) && /\bArtifact\b/.test(x.card.type)).length; return X >= 2 ? 7 : 0; }, td_integrant: () => 2, td_reclaim: () => 1, td_bobw1: () => 8, td_bobw2: () => 3, td_bobw3: () => 1, td_deliver: () => 7, td_replicate: () => 4, td_jurati: () => 4, td_queensDiamond: () => 3, td_recon: () => 3 });
TRIG_FN.anyBlocks = (o, ctx) => (ctx.list || []).length > 0;

// Optimization Annex: one more charge counter whenever charge counters are put on an artifact you control
(function () {
    const m = tkCounterMult;
    tkCounterMult = function (o, kind, n) {
        let k = m.apply(this, arguments);
        if (G && o && kind === 'charge' && n > 0 && /\bArtifact\b/.test(o.card.type) && G.players[o.owner].bf.some(a => Rx(a).annex && !lostAbilities(a))) k += 1;
        return k;
    };
})();
// Ambulatory Reactor: artifact creatures you control can tap for {C} (only for artifact spells and abilities of artifact sources)
(function () {
    const mo = manaOf;
    manaOf = function (o) {
        const base = mo.apply(this, arguments);
        if (base || !o || !o.card || !isCreature(o) || !/\bArtifact\b/.test(o.card.type)) return base;
        if (!G.players[o.owner].bf.some(a => Rx(a).reactor && !lostAbilities(a))) return base;
        if (o.sick && !has(o, 'haste')) return base;
        return { colors: ['C'], n: 1, onlyType: 'Artifact' };
    };
})();
// Võx: undaunted ({1} less for each opponent) on the next artifact creature spell and the next Spacecraft spell
(function () {
    const ec = extraCost;
    extraCost = function (P, o) {
        let c = ec.apply(this, arguments);
        if (P && P.voxTurn === G.turn && o && o.card && P.hand.includes(o)) {
            const n = foes(P).length;
            if (P.voxArt && /\bArtifact\b/.test(o.card.type) && /\bCreature\b/.test(o.card.type)) c -= n;
            else if (P.voxShip && /\bSpacecraft\b/.test(o.card.type)) c -= n;
        }
        return c;
    };
    const f = fire;
    fire = function (ev, ctx) {
        if (ev === 'cast' && ctx && ctx.o && ctx.P && ctx.P.voxTurn === G.turn) {
            const P = ctx.P;
            if (P.voxArt && /\bArtifact\b/.test(ctx.o.card.type) && /\bCreature\b/.test(ctx.o.card.type)) P.voxArt = false;
            else if (P.voxShip && /\bSpacecraft\b/.test(ctx.o.card.type)) P.voxShip = false;
        }
        return f.apply(this, arguments);
    };
})();
// The Immortal Sun: nobody can activate loyalty abilities
(function () {
    if (typeof canActivatePW === 'function') { const f = canActivatePW; canActivatePW = function () { return !allPerms().some(a => Rx(a).immortalSun && !lostAbilities(a)) && f.apply(this, arguments); }; }
})();
