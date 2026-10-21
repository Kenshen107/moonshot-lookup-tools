// =====================================================================
// Voting (2026-10-20, owner's go-ahead: "cards the bots can vote on"): Will of the council and Council's dilemma cards.
// Starting with the caster, every living player votes in turn order (`holdVote`). A person gets a prompt; a bot votes from `VOTE_DEFS[id].value`:
// each option is worth a number to the voter, and a bot that likes the caster (trust, a peace deal) votes the way the caster wants, so loyalties decide votes.
// "Brago's Representative" and "Ballot Broker" give a player an extra vote (`R.extraVote`); "Grudge Keeper" and "Model of Unity" react when voting ends (`R.voteWatch`).
// Wordings are in rules/votes.js. No random numbers, so seeded games replay.
// =====================================================================
const weakestCV = V => { const cs = V.bf.filter(isCreature); return cs.length ? Math.min(...cs.map(creatureValue)) : 0; };
const boardValue = (V, skip) => V.bf.filter(x => isCreature(x) && x !== skip).reduce((a, x) => a + creatureValue(x), 0) / 3;
const permBoard = V => V.bf.filter(x => !/\bLand\b/.test(x.card.type)).reduce((a, x) => a + permValue(x), 0) / 5;
const gyCreatures = V => V.gy.filter(x => /\bCreature\b/.test(x.card.type)).length;
const edictPain = V => Math.min(10, weakestCV(V) / 1.5);
const lifePain = (V, n) => n * 20 / Math.max(10, V.life) / 2;
// How a bot sees a vote the caster wants to win: for the caster it is a gain, for an opponent a loss
const forCaster = (g, X, caster) => (X === caster ? g : -g);
const VOTE_DEFS = {
    tyrant: { name: "Tyrant's Choice", options: [{ key: 'death', label: 'Death', desc: 'each opponent sacrifices a creature' }, { key: 'torture', label: 'Torture', desc: 'each opponent loses 4 life' }],
        value: (k, X, caster) => { const pain = V => (k === 'death' ? edictPain(V) : lifePain(V, 4)); return X === caster ? foes(caster).reduce((a, F) => a + pain(F), 0) : -pain(X); } },
    capital: { name: 'Capital Punishment', options: [{ key: 'death', label: 'Death', desc: 'each opponent sacrifices a creature per death vote' }, { key: 'taxes', label: 'Taxes', desc: 'each opponent discards a card per taxes vote' }],
        value: (k, X, caster) => { const pain = V => (k === 'death' ? edictPain(V) : (V.hand.length ? 3 : 0)); return X === caster ? foes(caster).reduce((a, F) => a + pain(F), 0) : -pain(X); } },
    plea: { name: 'Plea for Power', options: [{ key: 'time', label: 'Time', desc: 'the caster takes an extra turn' }, { key: 'knowledge', label: 'Knowledge', desc: 'the caster draws three cards' }],
        value: (k, X, caster) => forCaster(k === 'time' ? 9 : 6, X, caster) },
    stampede: { name: "Selvala's Stampede", options: [{ key: 'wild', label: 'Wild', desc: 'the caster puts a creature from their library onto the battlefield per wild vote' }, { key: 'free', label: 'Free', desc: 'the caster may put a permanent from hand onto the battlefield per free vote' }],
        value: (k, X, caster) => forCaster(k === 'wild' ? 5 : Math.min(5, caster.hand.filter(x => !/\b(Instant|Sorcery)\b/.test(x.card.type)).length * 2), X, caster) },
    split: { name: 'Split Decision', options: [{ key: 'denial', label: 'Denial', desc: 'counter the spell' }, { key: 'duplication', label: 'Duplication', desc: 'copy the spell' }],
        value: (k, X, caster, ctx) => { const sp = ctx && ctx.item && ctx.item.P; return k === 'denial' ? (X === caster ? 6 : X === sp ? -6 : 1) : (X === caster ? 3 : X === sp ? 3 : 0); } },
    magister: { name: 'Magister of Worth', neutral: true, options: [{ key: 'grace', label: 'Grace', desc: 'every player returns their creature cards from the graveyard to the battlefield' }, { key: 'condemnation', label: 'Condemnation', desc: 'destroy all other creatures' }],
        value: (k, X, caster, ctx) => { const others = G.players.filter(Y => Y !== X && !Y.out); return k === 'grace' ? 2 * gyCreatures(X) - 0.5 * others.reduce((a, Y) => a + gyCreatures(Y), 0) : (others.reduce((a, Y) => a + boardValue(Y, ctx && ctx.src), 0) - boardValue(X, ctx && ctx.src)); } },
    orchard: { name: 'Orchard Elemental', options: [{ key: 'sprout', label: 'Sprout', desc: 'two +1/+1 counters on the Elemental per sprout vote' }, { key: 'harvest', label: 'Harvest', desc: 'the caster gains 3 life per harvest vote' }],
        value: (k, X, caster) => forCaster(k === 'sprout' ? 4 : 3, X, caster) },
    carnage: { name: 'Coercive Portal', options: [{ key: 'carnage', label: 'Carnage', desc: 'sacrifice the Portal and destroy all nonland permanents' }, { key: 'homage', label: 'Homage', desc: 'the Portal controller draws a card' }],
        value: (k, X, caster) => k === 'homage' ? forCaster(1.5, X, caster) : (G.players.filter(Y => Y !== X && !Y.out).reduce((a, Y) => a + permBoard(Y), 0) - permBoard(X)) }
};
const voteOrder = P => { const live = G.players.filter(X => !X.out), i = live.indexOf(P); return i < 0 ? live : [...live.slice(i), ...live.slice(0, i)]; };
const voteCount = X => 1 + X.bf.filter(o => Rx(o).extraVote && !lostAbilities(o)).length;
const likesCaster = (voter, caster) => voter === caster || (typeof trustOf === 'function' && trustOf(voter, caster) >= 1) || (typeof hasPeace === 'function' && hasPeace(voter.i, caster.i));
function botVoteChoice(voter, caster, def, ctx) {
    const asX = !def.neutral && voter !== caster && likesCaster(voter, caster) ? caster : voter;
    let best = 0, bv = -Infinity;
    def.options.forEach((o, i) => { const v = def.value(o.key, asX, caster, ctx); if (v > bv + 1e-9) { bv = v; best = i; } });
    return best;
}
// Hold a vote between two options; resolves to { counts, cast: [{ X, idx }] }
async function holdVote(P, src, id, ctx = {}) {
    const def = VOTE_DEFS[id], name = src && src.card ? src.card.name : def.name;
    const counts = def.options.map(() => 0), cast = [];
    for (const X of voteOrder(P)) {
        const n = voteCount(X);
        for (let k = 0; k < n; k++) {
            let idx;
            if (X.isAI || AUTOPLAY) idx = botVoteChoice(X, P, def, { ...ctx, src });
            else idx = await askMode(X, `${name}: vote${n > 1 ? ` (${k + 1} of ${n})` : ''}`, def.options.map(o => `${o.label}: ${o.desc}`));
            counts[idx]++; cast.push({ X, idx });
            log(`\u{1F5F3}️ ${X.name} ${you(X) ? 'vote' : 'votes'} for ${def.options[idx].label}.`);
        }
    }
    log(`\u{1F5F3}️ ${name}: ${def.options.map((o, i) => `${o.label} ${counts[i]}`).join(', ')}.`);
    voteWatchers(cast);
    return { counts, cast };
}
// Grudge Keeper and Model of Unity: "whenever players finish voting"
function voteWatchers(cast) {
    allPerms().forEach(o => {
        const w = Rx(o).voteWatch;
        if (!w || lostAbilities(o)) return;
        const K = ctrl(o), mine = new Set(cast.filter(c => c.X === K).map(c => c.idx));
        if (w === 'grudge') {
            G.players.filter(X => X !== K && !X.out && cast.some(c => c.X === X && !mine.has(c.idx))).forEach(X => { X.life -= 2; log(`${o.card.name}: ${X.name} ${you(X) ? 'lose' : 'loses'} 2 life for voting against ${K.name}.`); });
        } else if (w === 'unity') {
            const who = [K, ...G.players.filter(X => X !== K && !X.out && cast.some(c => c.X === X && mine.has(c.idx)))];
            log(`${o.card.name}: ${who.map(X => X.name).join(', ')} may scry 2.`);
        }
    });
}
// A creature chosen by its controller to be sacrificed (edict)
async function voteEdict(V, name) {
    const pool = V.bf.filter(isCreature).sort((a, b) => permValue(a) - permValue(b));
    if (!pool.length) return;
    const f = (V.isAI || AUTOPLAY || pool.length === 1 ? null : await pickCard(V, pool, `${name}: choose a creature to sacrifice`, { required: true })) || pool[0];
    log(`${V.name} ${you(V) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy');
}
async function voteDiscard(V, name) {
    if (!V.hand.length) return;
    const d = await chooseDiscard(V, name); pull(V.hand, d); V.gy.push(d); d.discardTurn = G.turn; noteDiscard(V, 1);
    log(`${V.name} ${you(V) ? 'discard' : 'discards'} ${d.card.name}.`);
}
// Council's Judgment: every player votes for a nonland permanent the caster doesn't control; each one with the most votes (or tied) is exiled
async function councilJudgment(P, src, name) {
    const pool = allPerms().filter(x => ctrl(x) !== P && !/\bLand\b/.test(x.card.type));
    if (!pool.length) { log(`${name}: there is nothing to vote for.`); return; }
    const votes = new Map(); let casterPick = null;
    const score = (voter, x) => permValue(x) + (G.arch != null && ctrl(x).i === G.arch ? 3 : 0) - (ctrl(x) === voter ? 99 : 0) - (likesCaster(voter, ctrl(x)) && voter !== ctrl(x) ? 3 : 0);
    for (const X of voteOrder(P)) {
        for (let k = 0, n = voteCount(X); k < n; k++) {
            let pick;
            if (X.isAI || AUTOPLAY) {
                pick = X !== P && likesCaster(X, P) && casterPick && pool.includes(casterPick) ? casterPick : pool.slice().sort((a, b) => score(X, b) - score(X, a) || a.uid - b.uid)[0];
            } else pick = (await pickCard(X, pool, `${name}: vote for a nonland permanent ${P === X ? 'you' : P.name} doesn't control`, { required: true })) || pool[0];
            if (X === P && !casterPick) casterPick = pick;
            votes.set(pick, (votes.get(pick) || 0) + 1);
            log(`\u{1F5F3}️ ${X.name} ${you(X) ? 'vote' : 'votes'} for ${pick.card.name}.`);
        }
    }
    const top = Math.max(...votes.values());
    const hit = [...votes.entries()].filter(([, n]) => n === top).map(([x]) => x);
    log(`${name}: exile ${hit.map(x => x.card.name).join(', ')}.`);
    hit.forEach(x => { if (onBf(x.uid)) leaveBattlefield(x, 'exile'); });
}
Object.assign(CMD_SCORE, { voteJudgment: () => 9, voteTyrant: () => 6, voteCapital: () => 7, votePlea: () => 8, voteStampede: () => 8, voteSplit: () => 5, voteMagister: () => 2, voteOrchard: () => 3, voteCarnage: () => 1 });
Object.assign(CMD, {
    async voteJudgment(P, e, t, src, O, name) { await councilJudgment(P, src, name); },
    async voteTyrant(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'tyrant');
        if (r.counts[0] > r.counts[1]) { for (const F of foes(P)) await voteEdict(F, name); }
        else foes(P).forEach(F => { F.life -= 4; log(`${F.name} ${you(F) ? 'lose' : 'loses'} 4 life.`); });
    },
    async voteCapital(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'capital');
        for (const F of foes(P)) { for (let i = 0; i < r.counts[0]; i++) await voteEdict(F, name); for (let i = 0; i < r.counts[1]; i++) await voteDiscard(F, name); }
    },
    async votePlea(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'plea');
        if (r.counts[0] > r.counts[1]) { G.extra = G.extra || Z(); G.extra[P.i]++; log(`${P.name} will take an extra turn after this one.`); }
        else drawCards(P, 3);
    },
    async voteStampede(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'stampede');
        const revealed = [];
        for (let i = 0; i < r.counts[0]; i++) {
            let found = null;
            while (P.library.length && !found) { const c = P.library.pop(); if (/\bCreature\b/.test(c.card.type)) found = c; else revealed.push(c); }
            if (found) reanimateFrom(P, P, found);
        }
        P.library = shuffle([...P.library, ...revealed]);
        for (let i = 0; i < r.counts[1]; i++) {
            const pool = P.hand.filter(x => !/\b(Instant|Sorcery)\b/.test(x.card.type));
            const pick = await pickOwn(P, pool, `${name}: put a permanent card from your hand onto the battlefield`, { optional: true });
            if (pick) { pull(P.hand, pick); P.bf.push(pick); pick.enteredTurn = G.turn; log(`${pick.card.name} enters the battlefield under ${you(P) ? 'your' : `${P.name}'s`} control.`); fire('enters', { o: pick }); if (Rx(pick).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: pick, effects: Rx(pick).etb }); }
        }
    },
    async voteSplit(P, e, t, src, O, name) {
        const item = t && t.item;
        if (!item || !G.stack.includes(item)) { log(`${name}: its target is gone.`); return; }
        const r = await holdVote(P, src, 'split', { item });
        if (r.counts[0] > r.counts[1]) await applyEffect(P, { t: 'counter', target: 'spell', filter: 'any' }, t, src);
        else await copySpellItem(P, item, { retarget: true });
    },
    async voteMagister(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'magister');
        if (r.counts[0] > r.counts[1]) {
            for (const X of G.players.filter(Y => !Y.out)) X.gy.filter(x => /\bCreature\b/.test(x.card.type)).forEach(x => reanimateFrom(X, X, x));
        } else allPerms().filter(x => isCreature(x) && x !== src).forEach(x => destroy(x));
    },
    async voteOrchard(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'orchard');
        if (r.counts[0] && src && onBf(src.uid)) putCounters(src, 2 * r.counts[0], P);
        if (r.counts[1]) gainLifeFor(P, 3 * r.counts[1]);
    },
    async voteCarnage(P, e, t, src, O, name) {
        const r = await holdVote(P, src, 'carnage');
        if (r.counts[0] > r.counts[1]) {
            log(`${name}: carnage wins.`);
            if (src && onBf(src.uid)) dieOrLeave(src, 'gy');
            allPerms().filter(x => !/\bLand\b/.test(x.card.type)).forEach(x => { if (onBf(x.uid)) destroy(x); });
        } else drawCards(P, 1);
    }
});
