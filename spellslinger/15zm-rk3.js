// Spellslinger Duels - engine pieces for card round rk3 (2026-11-27). CMD ids start with rk3_. Wordings are in rules/rk3.js.
const rk3Human = P => !P.isAI && !AUTOPLAY;
const rk3Pr = (P, c) => `${P.name} ${you(P) ? c[0] : c[1]}`;
// life loss with the events other cards watch
function rk3Lose(X, n, src) { if (n <= 0 || X.out) return; X.life -= n; X.lostTurn = G.turn; X.lostN = (X.lostN && X.lostNTurn === G.turn ? X.lostN : 0) + n; X.lostNTurn = G.turn; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); }
// pay generic mana in the middle of resolving something; false when it can't be paid
function rk3PayGeneric(P, n) { if (n <= 0) return true; const plan = planPayment(P, { ...parseCost(''), generic: n }); if (!plan) return false; plan.forEach(x => tapSource(P, x)); log(`${rk3Pr(P, ['You pay', 'pays'])} {${n}}.`); return true; }
function rk3MaxPay(P, cap) { let k = 0; while (k < cap && planPayment(P, { ...parseCost(''), generic: k + 1 })) k++; return k; }
const rk3IsCreatureCard = c => /\bCreature\b/.test(c.card.type);
// ---- watchers ----
// creature cards that reach a graveyard (and whether they came from the battlefield), watched after every state-based check (like Voracious Brood)
function rk3GyWatch() {
    if (!G || G.over) return;
    if (!allPerms().some(o => Rx(o).rk3GyWatch && !lostAbilities(o))) { G.players.forEach(P => { P.rk3Seen = null; }); G.rk3Died = null; return; }
    for (const P of G.players) {
        const now = P.gy.filter(rk3IsCreatureCard);
        if (!P.rk3Seen) { P.rk3Seen = new Set(now.map(c => c.uid)); continue; }
        const fresh = now.filter(c => !P.rk3Seen.has(c.uid));
        P.rk3Seen = new Set(now.map(c => c.uid));
        fresh.forEach(c => fire('rk3GyIn', { P, o: c, fromBf: !!(G.rk3Died && G.rk3Died.has(c.uid)) }));
    }
    G.rk3Died = new Set();
}
{
    const f0 = fire;
    fire = function (ev, ctx) { if (ev === 'creatureDies' && ctx && ctx.o && G) (G.rk3Died = G.rk3Died || new Set()).add(ctx.o.uid); return f0.apply(this, arguments); };
    const b1 = sba; sba = function () { const r = b1.apply(this, arguments); rk3GyWatch(); return r; };
    const b2 = settle; settle = async function () { const r = await b2.apply(this, arguments); rk3GyWatch(); if (G && G.trigQ && G.trigQ.length && !G.over) await b2.apply(this, arguments); return r; };
    // a library search of any kind (Archivist of Oghma)
    const ace = applyChoiceEffect;
    applyChoiceEffect = async function (P, e) { const r = await ace.apply(this, arguments); if (e && ['tutor', 'fetchLand', 'tutorNamed', 'eachFetchBasic'].includes(e.t)) fire('rk3Search', { P }); return r; };
}
// a search helper for the cards of this round: the player (or computer) picks one card matching `pred` from the library
async function rk3Search(P, src, pred, prompt, opts = {}) {
    const pool = P.library.filter(pred);
    let pick = null;
    if (pool.length) pick = rk3Human(P) ? await pickCard(P, pool, prompt, { required: false }) : pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
    if (pick) pull(P.library, pick);
    libShuffle(P); fire('rk3Search', { P });
    if (!pick) { log(`${P.name} ${you(P) ? 'find' : 'finds'} nothing.`); return null; }
    return pick;
}
// a creature that can be chosen as a target of P's spell or ability (hexproof / shroud / protection are respected)
const rk3Targetable = (P, x) => onBf(x.uid) && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i);
// "any target": a creature or a player; a person chooses, the computer takes what it can kill, else the best face
async function rk3AnyTarget(P, src, prompt, dmg, exclude) {
    const cs = allPerms().filter(x => isCreature(x) && x !== exclude && rk3Targetable(P, x));
    const ps = G.players.filter(X => !X.out);
    if (rk3Human(P)) {
        const opts = [...cs.map(x => `${x.card.name} (${ctrl(x) === P ? 'yours' : ctrl(x).name}, ${pow(x)}/${tou(x)})`), ...ps.map(X => X === P ? 'You' : X.name)];
        const i = await askMode(P, prompt, opts); if (i === null || i === undefined) return null;
        return i < cs.length ? { o: cs[i] } : { p: ps[i - cs.length] };
    }
    const kills = cs.filter(x => x.owner !== P.i && tou(x) - x.dmg <= dmg).sort((a, b) => creatureValue(b) - creatureValue(a));
    if (kills[0]) return { o: kills[0] };
    const fs = foes(P); const low = fs.slice().sort((a, b) => a.life - b.life)[0];
    return low ? { p: low } : null;
}
const rk3Hit = (t, n, src) => { if (!t || n <= 0) return; const X = t.o || t.p; damage(X, n, src); log(`${src.card.name} deals ${n} damage to ${t.o ? t.o.card.name : t.p.name}.`); };
const rk3AddAnyMana = async (P, src, n = 1) => { for (let k = 0; k < n; k++) { let c = bestPoolColor(P); if (rk3Human(P)) { const cols = ['W', 'U', 'B', 'R', 'G']; const i = await askMode(P, `${src.card.name}: add one mana of any color`, ['White', 'Blue', 'Black', 'Red', 'Green']); c = cols[i] || c; } P.pool = (P.pool || []).concat([c]); log(`${rk3Pr(P, ['You add', 'adds'])} {${c}}.`); } };
const rk3Treasures = P => P.bf.filter(x => /\bTreasure\b/.test(x.card.type));
// costs that need a number chosen first ("Sacrifice X Treasures"): asked just before the ability is activated
{
    const a0 = activate;
    activate = async function (P, o, a, presetTarget, presetX) {
        if (a && a.rk3SacTreasures) {
            if (!canActivate(P, o, a)) return false;
            const have = rk3Treasures(P); const mx = have.length; if (!mx) return false;
            let x;
            if (rk3Human(P)) { x = await askNumber(P, `${o.card.name}: sacrifice how many Treasures? (X)`, 1, mx, Math.min(mx, 2), { card: o.card, ok: 'Activate' }); if (!x || x < 1) return false; }
            else { const best = Math.max(0, ...allPerms().filter(c => isCreature(c) && c.owner !== P.i && rk3Targetable(P, c)).map(c => tou(c) - c.dmg)); x = Math.min(mx, best); if (x < 1) return false; }
            const a2 = { ...a, effects: a.effects.map(e => ({ ...e, x })), rk3SacTreasures: false, rk3Sacked: x };
            const ok = await a0.call(this, P, o, a2, presetTarget, presetX);
            if (ok) { rk3Treasures(P).sort((p, q) => (p.tapped ? -1 : 0) - (q.tapped ? -1 : 0)).slice(0, x).forEach(f => { fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); }); log(`${rk3Pr(P, ['You sacrifice', 'sacrifices'])} ${x} Treasure${x === 1 ? '' : 's'}.`); }
            return ok;
        }
        return a0.apply(this, arguments);
    };
    const c0 = canActivate;
    canActivate = function (P, o, a) { if (a && a.rk3SacTreasures && !rk3Treasures(P).length) return false; if (a && a.rk3Can && !a.rk3Can(P, o)) return false; return c0.apply(this, arguments); };
}
// Obscuring Haze: damage from creatures an opponent of the caster controls is prevented this turn
{
    const d0 = damage;
    damage = function (target, n, src) {
        if (G && G.rk3Haze && G.rk3Haze.turn === G.turn && src && src.card && src.uid !== undefined && isCreature(src) && src.owner !== G.rk3Haze.by && G.noPrevent !== G.turn) { log(`${n} damage from ${src.card.name} is prevented (Obscuring Haze).`); return; }
        return d0.apply(this, arguments);
    };
}
Object.assign(TRIG_FN, {
    rk3Another: (o, ctx) => !!ctx.o && ctx.o !== o,
    rk3GyInElse: (o, ctx) => !ctx.fromBf,
    rk3KonradLeft: (o, ctx) => { if (ctx.P.i !== o.owner) return false; const n = (ctx.P.gyLeftLast || []).filter(rk3IsCreatureCard).length; o.rk3KonradN = n; return n > 0; },
    rk3AnyDraw: () => true,
    rk3OppSearch: (o, ctx) => ctx.P.i !== o.owner,
});
Object.assign(CMD_SCORE, { rk3_terra: () => 3, rk3_well: () => 3, rk3_hireling: () => 6, rk3_empath: () => 5, rk3_trophy: () => 4, rk3_harvest: () => 7, rk3_entish: () => 6, rk3_parting: () => 6, rk3_haze: () => 0, rk3_soulsFire: () => 6, rk3_wisps: () => 2 });
Object.assign(CMD, {
    rk3_konradLeft(P, e, t, src) { const n = src.rk3KonradN || 1; return applyEffect(P, { t: 'dmgOpp', n }, null, src); },
    async rk3_terra(P, e, t, src) {
        const n = G.ctxRaw && G.ctxRaw.n; if (!n || n <= 0 || src.rk3TerraTurn === G.turn) return;
        const yes = rk3Human(P) ? await askYes(P, `${src.card.name}: draw ${n} card${n === 1 ? '' : 's'}? (only once each turn)`, { card: src.card }) : true;
        if (!yes) return;
        src.rk3TerraTurn = G.turn; drawCards(P, n);
    },
    async rk3_well(P, e, t, src) {
        const n = G.ctxRaw && G.ctxRaw.n; if (!n || n <= 0) return;
        const mx = rk3MaxPay(P, n); if (mx <= 0) return;
        let x = 0;
        if (rk3Human(P)) { x = await askNumber(P, `${src.card.name}: pay {X} (X up to ${Math.min(n, mx)}) to draw X cards?`, 0, Math.min(n, mx), Math.min(n, mx), { card: src.card, ok: 'Pay' }); x = x || 0; }
        else x = G.active !== P.i || G.phase === 'main2' || G.phase === 'end' ? Math.min(n, mx) : 0;
        if (x > 0 && rk3PayGeneric(P, x)) drawCards(P, x);
    },
    // Grim Hireling: -X/-X (X Treasures were sacrificed)
    async rk3_hireling(P, e, t, src) {
        const x = e.x || 0; const c = t && t.o; if (!c || !onBf(c.uid) || x <= 0) return;
        c.tp -= x; c.tq -= x; log(`${c.card.name} gets -${x}/-${x} until end of turn.`); sba();
    },
    async rk3_empath(P, e, t, src) {
        if (!P.library.some(c => rk3IsCreatureCard(c) && (c.card.cmc || 0) >= 6)) { libShuffleAfterSearch(P); return; }
        if (rk3Human(P) && !(await askYes(P, `${src.card.name}: search your library for a creature card with mana value 6 or greater?`, { card: src.card }))) return;
        const c = await rk3Search(P, src, x => rk3IsCreatureCard(x) && (x.card.cmc || 0) >= 6, `${src.card.name}: choose a creature card with mana value 6 or greater`);
        if (c) { P.hand.push(c); log(`${rk3Pr(P, ['You reveal', 'reveals'])} ${c.card.name} and ${you(P) ? 'put it' : 'puts it'} into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async rk3_trophy(P, e, t, src) {
        if (rk3Human(P) && !(await askYes(P, `${src.card.name}: search your library for an artifact card with mana value 3?`, { card: src.card }))) return;
        const c = await rk3Search(P, src, x => /\bArtifact\b/.test(x.card.type) && (x.card.cmc || 0) === 3, `${src.card.name}: choose an artifact card with mana value 3`);
        if (c) { P.hand.push(c); log(`${rk3Pr(P, ['You reveal', 'reveals'])} ${c.card.name} and ${you(P) ? 'put it' : 'puts it'} into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Harvest Season: up to X basic lands (X = tapped creatures you control) onto the battlefield tapped
    async rk3_harvest(P, e, t, src) { await rk3FetchBasics(P, src, P.bf.filter(x => isCreature(x) && x.tapped).length); },
    // Entish Restoration: sacrifice a land, then two basic lands (three with a creature of power 4 or more)
    async rk3_entish(P, e, t, src) {
        const l = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length ? await chooseSac(P, src, 'land', src.card.name) : null;
        if (l) { fire('sacrificed', { o: l }); dieOrLeave(l, 'gy'); log(`${rk3Pr(P, ['You sacrifice', 'sacrifices'])} ${l.card.name}.`); }
        await rk3FetchBasics(P, src, P.bf.some(x => isCreature(x) && pow(x) >= 4) ? 3 : 2);
    },
    // Final Parting: search for two cards, one to hand and the other to the graveyard
    async rk3_parting(P, e, t, src) {
        const picks = [];
        for (let k = 0; k < 2; k++) {
            const pool = P.library.filter(x => !picks.includes(x)); if (!pool.length) break;
            const c = rk3Human(P) ? await pickCard(P, pool, `${src.card.name}: choose card ${k + 1} of 2`, { required: true }) : pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) || (a.card.cmc || 0))[k === 0 ? 0 : Math.min(1, pool.length - 1)];
            if (c) picks.push(c);
        }
        let toHand = picks[0], toGy = picks[1];
        if (picks.length === 2 && rk3Human(P)) { const i = await askMode(P, `${src.card.name}: which one goes into your hand?`, picks.map(c => c.card.name)); toHand = picks[i] || picks[0]; toGy = picks[1 - (picks.indexOf(toHand))]; }
        picks.forEach(c => pull(P.library, c));
        libShuffle(P); fire('rk3Search', { P });
        if (toHand) { P.hand.push(toHand); log(`${rk3Pr(P, ['You put', 'puts'])} ${you(P) ? toHand.card.name : 'a card'} into ${you(P) ? 'your' : 'their'} hand.`); }
        if (toGy) { P.gy.push(toGy); log(`${rk3Pr(P, ['You put', 'puts'])} ${toGy.card.name} into ${you(P) ? 'your' : 'their'} graveyard.`); }
    },
    async rk3_visions(P, e, t, src) { const X = G.ctxRaw && G.ctxRaw.P; if (X && !X.out) { damage(X, 1, src); log(`${src.card.name} deals 1 damage to ${X.name}.`); } },
    rk3_haze(P, e, t, src) { G.rk3Haze = { turn: G.turn, by: P.i }; log(`Damage from creatures ${you(P) ? 'your opponents control' : 'the other players control'} is prevented this turn.`); },
    // Necropotence: exile the top card face down; it goes to your hand at the beginning of your next end step
    async rk3_necro(P, e, t, src) {
        const c = P.library.pop(); if (!c) return;
        c.faceDown = true; P.exile.push(c); log(`${rk3Pr(P, ['You exile', 'exiles'])} the top card of ${you(P) ? 'your' : 'their'} library face down.`);
        const back = () => { if (P.exile.includes(c)) { pull(P.exile, c); c.faceDown = false; P.hand.push(c); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${you(P) ? c.card.name : 'the exiled card'} into ${you(P) ? 'your' : 'their'} hand (Necropotence).`); } };
        if (G.active === P.i && G.phase !== 'end') (G.endQ = G.endQ || []).push({ fn: back });
        else { const n = G.players.length; (G.endAt = G.endAt || []).push({ turn: G.turn + ((P.i - G.active + n) % n || n), fn: back }); }
    },
    async rk3_soulsFire(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const n = pow(c); const tg = await rk3AnyTarget(P, src, `${src.card.name}: ${c.card.name} deals ${n} damage to which target?`, n);
        if (tg) { damage(tg.o || tg.p, n, c); log(`${c.card.name} deals ${n} damage to ${tg.o ? tg.o.card.name : tg.p.name}.`); }
    },
    rk3_wisps(P, e, t, src) { const c = t && t.o; if (!c || !onBf(c.uid)) return; if (!c.dcCardBack) c.dcCardBack = c.card; c.card = { ...c.card, colors: ['R'] }; c.tkw.push('haste'); c.sick = false; log(`${c.card.name} becomes red and gains haste until end of turn.`); },
});
// up to n basic lands from the library onto the battlefield tapped
async function rk3FetchBasics(P, src, n) {
    const got = [];
    for (let k = 0; k < n; k++) {
        const pool = P.library.filter(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type) && !got.includes(x)); if (!pool.length) break;
        const c = rk3Human(P) ? await pickCard(P, pool, `${src.card.name}: choose a basic land (${k + 1} of ${n}; skip to stop)`, { required: false }) : pool[0];
        if (!c) break; got.push(c); pull(P.library, c);
    }
    libShuffle(P); fire('rk3Search', { P });
    for (const c of got) { resetObj(c); c.tapped = true; P.bf.push(c); fire('landfall', { o: c }); }
    log(`${P.name} ${you(P) ? 'put' : 'puts'} ${got.length} basic land${got.length === 1 ? '' : 's'} onto the battlefield tapped.`);
}
function libShuffleAfterSearch(P) { libShuffle(P); fire('rk3Search', { P }); }
