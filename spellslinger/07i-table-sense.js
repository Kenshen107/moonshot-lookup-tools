// =====================================================================
// Table sense (2026-10-28, owner: "improve the bot interaction ... robust just like a real game of magic", then "build C, B and A in that order").
// Three habits real players have that the bots lacked. How it all works is written up in docs/spellslinger-table-sense.md.
//   C  Let somebody else answer it  - in a pod a bot doesn't spend its removal or wrath on a threat that isn't aimed at it while another player is
//                                     more exposed; it waits a few rounds, and answers at once when the threat becomes its own problem.
//   B  Tricks after blocks          - both the attacker and the defenders cast pump spells and instant removal once blocks are declared, and an
//                                     attacker goes into a bad block when it holds the trick that wins it (and swings for lethal with a pump).
//   A  Mana up                      - a bot with a counterspell or a trick keeps that much mana untapped through its own main phases, and other bots
//                                     read open mana: a small attacker doesn't walk into an untapped blocker while the owner has mana and cards.
// Everything is a deterministic function of the board (no random numbers), so seeded lab games replay. It runs in pods (3 or 4 players) and not in
// duels unless AI_TUNE.duels is set, so two-player results stay as they were. Each habit has a knob in AI_TUNE (the lab can turn it off per seat with
// `--tune "patience=0"` and so on): patience (rounds a bot waits, 0 = off), holdMana, trickWindow, trickAtk, fear, duels.
// =====================================================================
Object.assign(AI_TUNE, { patience: 2, holdMana: 1, trickWindow: 1, trickAtk: 1, fear: 1, duels: 0 });

const tsSmart = P => !!P && !P.out && P.isAI && P.aiLevel !== 'easy' && !P.aiRand;
const tsOn = P => tsSmart(P) && !!G && (G.players.length > 2 || !!tn(P, 'duels'));
const tsPol = k => { const p = pol(); p.ts = p.ts || {}; p.ts[k] = (p.ts[k] || 0) + 1; };
const tsOpenMana = X => X.bf.filter(o => !o.tapped && Rx(o).mana).length;

// ---- shared reading of the cards in a hand ----
// A pump spell: an instant that gives a creature +p/+q or keywords until end of turn, for the player who casts it
const trickOf = o => { const r = Rx(o); return r.kind === 'instant' ? (r.spell || []).find(e => e.t === 'pump' && e.good && e.target === 'creature') || null : null; };
const isCounterSpell = o => Rx(o).kind === 'instant' && (Rx(o).spell || []).some(e => e.t === 'counter');
// An instant that kills a creature: { e, kills(x) }
function removalOf(P, o) {
    const r = Rx(o);
    if (r.kind !== 'instant') return null;
    const e = (r.spell || []).find(x => ['destroy', 'exile'].includes(x.t) || (x.t === 'dmg' && ['creature', 'any'].includes(x.target)));
    if (!e) return null;
    const kills = x => e.t === 'exile' || (e.t === 'destroy' && !has(x, 'indestructible')) || (e.t === 'dmg' && e.n >= tou(x) - x.dmg);
    return { e, kills };
}
const targetOk = (P, e, src, x) => validTargets(P, e, src).some(v => v.o && v.o.uid === x.uid);

// =====================================================================
// C. Let somebody else answer it
// =====================================================================
// Is F's threat P's problem right now? Yes when somebody is about to die, P is low, F has been hitting P, or P is the player F's board points at most.
function threatIsMine(P, F) {
    if (winThreat(F)) return true; // somebody is about to lose: waiting is how a table loses
    if (P.life <= 12) return true;
    if (P.grudge && (P.grudge[F.i] || 0) >= 6) return true;
    if (P.cmdBy && (P.cmdBy[F.i] || 0) >= 10) return true;
    const pw = F.bf.filter(isCreature).reduce((a, o) => a + Math.max(0, pow(o)), 0);
    if (pw <= 0) return false;
    const ex = X => pw / Math.max(1, X.life); // how much of its life F's board represents to X
    const others = foes(F).filter(X => X !== P && !X.out);
    return ex(P) >= Math.max(0, ...others.map(ex)) && pw >= P.life * 0.3;
}
// Should P hold its answer to F's permanent (or wrath) for now? `key` identifies the thing being waited on, so the wait is counted from the first time.
function podWaits(P, F, key) {
    if (!tsOn(P) || G.players.length < 3 || !F || F === P || F.out) return false;
    const rounds = tn(P, 'patience');
    if (!(rounds > 0)) return false;
    const live = G.players.filter(X => !X.out);
    if (live.length < 3 || threatIsMine(P, F)) return false;
    P.patWait = P.patWait || {};
    if (P.patWait[key] === undefined) P.patWait[key] = G.turn;
    if (G.turn - P.patWait[key] >= rounds * live.length) return false; // it has waited long enough: answer it
    P.patSaid = P.patSaid || {};
    if (!P.patSaid[key]) {
        P.patSaid[key] = true;
        tsPol('waits');
        botSay(P, 'calm', `${F.name.split(',')[0]} is a problem, but not mine yet. I'll see who deals with it.`, 'patience');
    }
    return true;
}
const _removalWorthIt = removalWorthIt;
removalWorthIt = function (P, o) {
    const worth = _removalWorthIt(P, o);
    if (!worth || o.owner === P.i) return worth;
    const F = G.players[o.owner];
    return !podWaits(P, F, 'perm:' + o.uid);
};
// A wrath waits the same way: the bot lets the player who is losing to the leader be the one who sweeps
const isWipeSpell = o => (Rx(o).spell || []).some(e => e.t === 'wipe' || e.t === 'massBounce');
const _aiScore = aiScore;
aiScore = function (P, o, target) {
    const s = _aiScore(P, o, target);
    if (s > 0 && tsOn(P) && G.players.length > 2 && isWipeSpell(o)) {
        const leader = foes(P).slice().sort((a, b) => podThreat(b) - podThreat(a) || a.i - b.i)[0];
        if (leader && podWaits(P, leader, 'wipe:' + leader.i)) return 0;
    }
    return s;
};

// =====================================================================
// A. Mana up
// =====================================================================
// How much mana a bot keeps untapped through a main phase. 0 means it spends freely.
function tableReserve(P) {
    if (!tsOn(P) || !(tn(P, 'holdMana') > 0) || G.active !== P.i || P.hand.length >= 7) return 0;
    const cap = P.bf.filter(o => Rx(o).mana).length;
    const hasCreature = P.bf.some(isCreature);
    const held = P.hand.filter(o => (isCounterSpell(o) && cap >= 4 && foes(P).some(F => F.hand.length)) || (trickOf(o) && cap >= 3 && hasCreature));
    if (!held.length) { P.holdSig = ''; P.holdRun = 0; return 0; }
    const sig = held.map(o => o.uid).sort().join(',');
    if (P.holdTurn !== G.turn) { P.holdTurn = G.turn; P.holdRun = sig === P.holdSig ? (P.holdRun || 0) + 1 : 1; P.holdSig = sig; tsPol('holds'); }
    if (P.holdRun % 4 === 0) return 0; // nothing came of it three turns running: spend the mana this turn
    return Math.min(...held.map(o => o.card.cmc || 0));
}
// Other bots read the board: open mana plus cards in hand means a trick or a counter is possible
const showsMana = D => !!D && tsOpenMana(D) >= 2 && D.hand.length >= 1;

// =====================================================================
// B. Combat tricks
// =====================================================================
// What happens when attacker `a` is blocked by `bs`; `mod` = { uid, p, q, kw } pumps one creature. { aDies, killed: blockers that die }.
function simCombat(a, bs, mod) {
    const P_ = o => pow(o) + (mod && mod.uid === o.uid ? mod.p : 0);
    const T_ = o => tou(o) + (mod && mod.uid === o.uid ? mod.q : 0);
    const K_ = (o, k) => has(o, k) || !!(mod && mod.uid === o.uid && (mod.kw || []).includes(k));
    const fs = o => K_(o, 'first strike') || K_(o, 'double strike');
    const pick = alive => { // the attacker assigns its damage to the weakest blockers first
        let budget = P_(a);
        const out = [];
        for (const b of alive.slice().sort((x, y) => T_(x) - T_(y))) {
            if (K_(b, 'indestructible') || protFrom(b, a)) continue;
            const need = K_(a, 'deathtouch') ? 1 : Math.max(1, T_(b) - b.dmg);
            if (budget >= need) { budget -= need; out.push(b); }
        }
        return out;
    };
    const hurts = list => { const dealt = list.reduce((s, b) => s + Math.max(0, P_(b)), 0); return !K_(a, 'indestructible') && dealt > 0 && !protFrom(a, list[0]) && (list.some(b => K_(b, 'deathtouch') && P_(b) > 0) || dealt >= T_(a) - a.dmg); };
    let alive = bs.slice(), killed = [];
    const firstStrikers = bs.filter(fs);
    if (!fs(a) && firstStrikers.length && hurts(firstStrikers)) return { aDies: true, killed: [] }; // dies before it strikes
    if (fs(a)) { killed = pick(alive); alive = alive.filter(b => !killed.includes(b)); }
    const aDies = alive.length ? hurts(alive) : false;
    if (!fs(a)) killed = pick(alive);
    return { aDies, killed };
}
// The attacker's side of that outcome in creature value: what it kills minus what it loses
const combatScore = (a, r) => r.killed.reduce((s, b) => s + creatureValue(b), 0) - (r.aDies ? creatureValue(a) : 0);

// One trick or removal spell for P, if some blocked fight is worth it. Returns true when it cast something.
async function aiOneTrick(P) {
    const tricks = P.hand.filter(o => trickOf(o) && canCastNow(P, o) && canPay(P, o));
    const kills = P.hand.filter(o => removalOf(P, o) && canCastNow(P, o) && canPay(P, o));
    if (!tricks.length && !kills.length) return false;
    const atks = G.attackers.map(onBf).filter(Boolean);
    let best = null;
    const offer = (gain, o, target, why) => { if (gain >= 3 && (!best || gain > best.gain)) best = { gain, o, target, why }; };
    let unblockedMine = 0;
    for (const a of atks) {
        const bs = (G.blocks[a.uid] || []).map(onBf).filter(Boolean);
        const mineAtk = P.bf.includes(a);
        const Dp = G.players[a.atkTo !== undefined ? a.atkTo : G.defender];
        if (!bs.length) { if (mineAtk && Dp) unblockedMine += dmgVs(a, Dp); continue; }
        const base = simCombat(a, bs, null), sBase = combatScore(a, base);
        const mine = mineAtk ? [a] : bs.filter(b => P.bf.includes(b));
        for (const t of tricks) {
            const pe = trickOf(t);
            for (const c of mine) {
                if (!targetOk(P, pe, t, c)) continue;
                const s2 = combatScore(a, simCombat(a, bs, { uid: c.uid, p: pe.p, q: pe.q, kw: pe.kw || [] }));
                offer(mineAtk ? s2 - sBase : sBase - s2, t, { o: c }, 'trick');
            }
        }
        for (const k of kills) {
            const { e, kills: kl } = removalOf(P, k);
            // the other side's creatures in this fight: blockers when P attacked, the attacker when P is blocking
            const theirs = mineAtk ? bs : [a];
            for (const x of theirs) {
                if (!kl(x) || !targetOk(P, e, k, x)) continue;
                let gain;
                if (mineAtk) gain = combatScore(a, simCombat(a, bs.filter(b => b !== x), null)) + creatureValue(x) - sBase;
                else gain = sBase + creatureValue(x); // the defender's view: the attacker's score disappears and the attacker dies
                const saves = mineAtk ? base.aDies : base.killed.length > 0;
                if (saves || removalWorthIt(P, x)) offer(gain, k, { o: x }, 'removal');
            }
        }
    }
    // A pump on an unblocked attacker that turns a hit into the kill
    if (unblockedMine > 0) {
        for (const t of tricks) {
            const pe = trickOf(t);
            for (const a of atks.filter(x => P.bf.includes(x) && !(G.blocks[x.uid] || []).length)) {
                const Dp = G.players[a.atkTo !== undefined ? a.atkTo : G.defender];
                if (!Dp || !targetOk(P, pe, t, a)) continue;
                const total = atks.filter(x => P.bf.includes(x) && !(G.blocks[x.uid] || []).length && (x.atkTo === undefined ? G.defender : x.atkTo) === Dp.i).reduce((s, x) => s + dmgVs(x, Dp), 0);
                if (total < Dp.life && total + Math.max(0, pe.p) * (has(a, 'double strike') ? 2 : 1) >= Dp.life) offer(30, t, { o: a }, 'lethal');
            }
        }
    }
    if (!best) return false;
    tsPol(best.why === 'removal' ? 'combatRemoval' : 'tricks');
    await pause(400);
    return !!(await castSpell(P, best.o, best.target));
}
// After blocks are declared: the attacking player gets priority first, then the others in turn order (CR 117.3)
async function aiCombatTricks() {
    if (!G || G.over || !G.attackers || !G.attackers.length) return;
    const order = [G.players[G.active], ...G.players.filter(p => p.i !== G.active && !p.out)];
    const phase = G.phase;
    for (const P of order) {
        if (!tsOn(P) || !tn(P, 'trickWindow') || P.out) continue;
        for (let k = 0; k < 2 && !G.over; k++) {
            G.phase = P.i === G.active ? 'afterBlocks' : 'declareBlocks'; // the phases canCastNow allows an instant in, for the attacker and for the others
            if (!(await aiOneTrick(P))) break;
            await settle();
        }
    }
    G.phase = phase;
}
// Hook: the blocks step, once every defender has chosen
const _chooseBlocksAll = chooseBlocksAll;
chooseBlocksAll = async function (P, opts) {
    const ok = await _chooseBlocksAll(P, opts);
    if (ok && !G.over && typeof G.blocks === 'object') await aiCombatTricks();
    return ok && !G.over;
};

// Attackers: go into a bad block when the trick in hand wins it (B), and don't walk a small creature into open mana (A, read side)
const _aiChooseAttackersFree = aiChooseAttackersFree;
aiChooseAttackersFree = function (P) {
    let list = _aiChooseAttackersFree(P);
    if (!tsOn(P)) return list;
    const D = opp(P), cands = P.bf.filter(o => canAttackWith(o) && pow(o) > 0);
    const blockers = D.bf.filter(o => isCreature(o) && !o.tapped);
    // B: a trick backs one more attacker
    if (tn(P, 'trickAtk') && blockers.length) {
        let mana = tsOpenMana(P);
        const tricks = P.hand.filter(o => trickOf(o) && canCastNow(P, o) && canPay(P, o)).sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0));
        for (const a of cands.filter(x => !list.includes(x)).sort((x, y) => creatureValue(y) - creatureValue(x))) {
            const t = tricks.find(o => (o.card.cmc || 0) <= mana);
            if (!t) break;
            const pe = trickOf(t);
            const bl = blockers.filter(b => canBlock(b, a));
            if (!bl.length || !targetOk(P, pe, t, a)) continue;
            const mod = { uid: a.uid, p: pe.p, q: pe.q, kw: pe.kw || [] };
            if (bl.every(b => !simCombat(a, [b], mod).aDies)) { list = [...list, a]; mana -= t.card.cmc || 0; tricks.splice(tricks.indexOf(t), 1); tsPol('trickAttacks'); }
        }
    }
    // A: open mana and cards in hand make a small attacker's "safe" attack less safe
    const st = styleOf(P);
    if (tn(P, 'fear') && showsMana(D) && D !== P && !(st && st.atk > 0) && G.turn < tn(P, 'stallTurn')) {
        const through = list.reduce((s, a) => s + dmgVs(a, D), 0);
        if (through < D.life) {
            const scared = list.filter(a => creatureValue(a) <= 6.5 && blockers.some(b => canBlock(b, a) && !combatKills(b, a) && !combatKills(a, b) && pow(b) + 2 >= tou(a) - a.dmg));
            if (scared.length) { tsPol('fear'); list = list.filter(a => !scared.includes(a)); }
        }
    }
    return list;
};
