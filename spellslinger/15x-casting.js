// Spellslinger Duels - two rules fixes (2026-11-15, owner):
// 1. Targets are chosen as part of casting a spell, activating an ability or putting a trigger on the stack (CR 601.2c, 602.2b, 603.3d), not when it resolves.
//    `preChoose` asks a person for the targets that used to be picked at resolution: "Return target ... card from your graveyard" (the `regrow` effect) and the cards in
//    PRE_CMD. The picks travel on the stack item as `multi` (the same channel "any number of target ..." uses) and the effect reads them back as G.curMulti.
// 2. Going to combat can be cancelled: a checkpoint is taken before the beginning of combat, and cancelling the attack puts every beginning-of-combat trigger and
//    ability (and the mana pool, tokens, counters, draws, log lines) back as they were.

// ---- Checkpoint (a shallow copy of everything the game state is made of, restored in place so every reference stays valid) ----
const CK_KEEP = new Set(['card', 'front', 'back', 'fdCard', '_r']);
const ckIsPlain = v => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
function ckVal(k, v) {
    if (Array.isArray(v)) return { arr: v, a: v.slice() };
    if (v instanceof Set) return { set: v, s: new Set(v) };
    if (v instanceof Map) return { map: v, m: new Map(v) };
    if (!CK_KEEP.has(k) && ckIsPlain(v)) return { ref: v, copy: Object.assign({}, v) };
    return { v };
}
function ckObj(o) { const s = {}; for (const k of Object.keys(o)) s[k] = ckVal(k, o[k]); return s; }
function ckRestoreObj(o, snap) {
    for (const k of Object.keys(o)) if (!(k in snap)) delete o[k];
    for (const [k, e] of Object.entries(snap)) {
        if (e.arr) { e.arr.length = 0; if (e.a.length) e.arr.push(...e.a); o[k] = e.arr; }
        else if (e.set) { e.set.clear(); e.s.forEach(x => e.set.add(x)); o[k] = e.set; }
        else if (e.map) { e.map.clear(); e.m.forEach((x, y) => e.map.set(y, x)); o[k] = e.map; }
        else if (e.ref) { for (const kk of Object.keys(e.ref)) if (!(kk in e.copy)) delete e.ref[kk]; Object.assign(e.ref, e.copy); o[k] = e.ref; }
        else o[k] = e.v;
    }
}
const CK_ZONES = ['bf', 'hand', 'gy', 'exile', 'library', 'command', 'phased'];
function slCheckpoint() {
    if (!G || !G.players) return null;
    const objs = new Map();
    G.players.forEach(P => CK_ZONES.forEach(z => (P[z] || []).forEach(o => { if (o && typeof o === 'object' && !objs.has(o)) objs.set(o, ckObj(o)); })));
    return {
        G: ckObj(G), players: G.players.map(P => ({ P, snap: ckObj(P) })), objs, log: (typeof LOG !== 'undefined' && Array.isArray(LOG)) ? LOG.length : null,
        gplayers: G.players.slice()
    };
}
function slRestore(cp) {
    if (!cp) return false;
    ckRestoreObj(G, cp.G); // (G.players is one of its arrays, restored in place)
    cp.players.forEach(x => ckRestoreObj(x.P, x.snap));
    cp.objs.forEach((snap, o) => ckRestoreObj(o, snap));
    if (cp.log !== null && typeof LOG !== 'undefined' && Array.isArray(LOG)) LOG.length = Math.min(LOG.length, cp.log);
    permVer++; attVer++; // the battlefield and attachment caches
    return true;
}

// ---- Targets chosen as the spell is cast ----
const PRE_CMD = {}; // CMD id -> async (P, src, e) => the choice (false = the cast is cancelled); the CMD reads it back with slPre(id)
function slPre(id) { const m = G && G.curMulti; return m && m.cmd && Object.prototype.hasOwnProperty.call(m.cmd, id) ? { v: m.cmd[id] } : null; }
async function preChoose(P, src, effects) {
    if (!P || P.isAI || (AUTOPLAY && !window.__PRE_FORCE) || !effects) return null;
    const out = { pre: [], cmd: {}, list: [] }; let any = false;
    for (const e of effects) {
        if (!e) continue;
        if (e.t === 'regrow') {
            const gys = e.anyGy ? [P, opp(P)] : [P];
            const pool = gys.flatMap(X => X.gy).filter(x => cardFits(x, e.what) && !(e.notSelf && x === src));
            const need = !e.may && !(e.count > 1);
            for (let k = 0; k < (e.count || 1); k++) {
                const left = pool.filter(x => !out.pre.includes(x));
                const pick = left.length ? await pickCard(P, left, `${src.card.name}: choose a target card from ${e.anyGy ? 'a' : 'your'} graveyard${e.count > 1 ? ` (${k + 1} of ${e.count}; skip to stop)` : ''}`, { required: need }) : null;
                if (!pick && need) return false;
                out.pre.push(pick || null); any = true;
                if (!pick) break;
            }
        } else if (e.t === 'cmd' && PRE_CMD[e.id]) {
            const v = await PRE_CMD[e.id](P, src, e);
            if (v === false) return false;
            if (v !== undefined) { out.cmd[e.id] = v; any = true; }
        }
    }
    return any ? out : null;
}
// A small helper for the picks below: one optional (or required) card from a pool, for a person
const slAsk = (P, pool, prompt, required) => (pool.length ? pickCard(P, pool, prompt, { required: !!required }) : Promise.resolve(null));
const slLegal = (P, x) => x && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i);
Object.assign(PRE_CMD, {
    // Blood Beckoning: one creature card from your graveyard, two if it was kicked
    async sl_beckon(P, src) { const out = []; for (let k = 0; k < (src.kicked ? 2 : 1); k++) { const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && !out.includes(c)); if (!pool.length) break; const c = await slAsk(P, pool, `${src.card.name}: choose target creature card #${k + 1} in your graveyard`, true); out.push(c); } return out; },
    // Hapatra: up to one target creature each opponent controls
    async sl_hapatra(P, src) { const out = {}; for (const F of foes(P)) { const pool = F.bf.filter(c => isCreature(c) && slLegal(P, c)); out[F.i] = pool.length ? await slAsk(P, pool, `${src.card.name}: choose up to one target creature ${F.name} controls`, false) : null; } return out; },
    // Pizza Face: up to one other target artifact or creature (only when a permanent left the battlefield: the trigger's own condition)
    async sl_pizzaFace(P, src) { if (P.slLeftTurn !== G.turn) return undefined; const pool = allPerms().filter(x => x !== src && (isCreature(x) || /\bArtifact\b/.test(x.card.type)) && slLegal(P, x)); return await slAsk(P, pool, `${src.card.name}: choose up to one other target artifact or creature`, false); },
    // Restorative Technique: target player, then up to one target creature
    async sl_restorative(P, src) { const ps = G.players.filter(p => !p.out); let who = P; if (ps.length > 1) who = (await frPickPlayer(P, `${src.card.name}: choose target player`, ps)) || P; const pool = allPerms().filter(c => isCreature(c) && slLegal(P, c)); const c = await slAsk(P, pool, `${src.card.name}: choose up to one target creature for the +1/+1 counter`, false); return { who, creature: c }; },
    // Teferi: up to one target artifact, one creature and one land
    async sl_teferiPlus(P, src) { const kinds = [['artifact', o => /\bArtifact\b/.test(o.card.type)], ['creature', o => isCreature(o)], ['land', o => /\bLand\b/.test(o.card.type)]]; const out = []; for (const [nm, f] of kinds) { const pool = allPerms().filter(f).filter(o => slLegal(P, o)); const c = await slAsk(P, pool, `${src.card.name}: choose up to one target ${nm} (yours untaps, an opponent's is tapped)`, false); if (c) out.push(c); } return out; },
    // The Theorist, Jace Beleren: for each opponent, up to one target artifact or creature
    async sl_theoristBounce(P, src) { const out = {}; for (const F of foes(P)) { const pool = F.bf.filter(x => (isCreature(x) || /\bArtifact\b/.test(x.card.type)) && slLegal(P, x)); out[F.i] = pool.length ? await slAsk(P, pool, `${src.card.name}: choose up to one target artifact or creature ${F.name} controls`, false) : null; } return out; },
    // Druid Class (level 3): target land you control
    async sl_druidClass(P, src) { const pool = P.bf.filter(x => /\bLand\b/.test(x.card.type) && slLegal(P, x)); return pool.length ? await slAsk(P, pool, `${src.card.name}: choose target land you control`, true) : null; },
    // Yuna, Grand Summoner: target creature for the counters
    async sl_yunaCounters(P, src, e) { const pool = P.bf.filter(x => isCreature(x) && slLegal(P, x)); return pool.length ? await slAsk(P, pool, `${src.card.name}: choose target creature for ${e.n} +1/+1 counters (or none)`, false) : null; },
    // Summon: Magus Sisters: the mode is chosen at random as the chapter goes on the stack, then its target
    async sl_magus(P, src) {
        const k = rand(3); const mine = P.bf.filter(c => isCreature(c) && slLegal(P, c));
        if (k < 2) { const c = mine.length ? await slAsk(P, mine, `${src.card.name}: the random mode is ${k === 0 ? 'Combine Powers! (three +1/+1 counters)' : 'Defense! (a shield counter, gain 3 life)'}: choose target creature`, true) : null; return { k, c }; }
        const pool = allPerms().filter(c => isCreature(c) && c.owner !== P.i && slLegal(P, c)); const c = pool.length ? await slAsk(P, pool, `${src.card.name}: the random mode is Fight!: choose up to one target creature an opponent controls`, false) : null; return { k, c };
    },
    // Aetheric Amplifier: the mode and the permanent
    async sl_amplifier(P, src) { const yes = await askYes(P, `${src.card.name}: double the counters you have (energy)? Otherwise double the counters on a target permanent.`, { card: src.card, yes: 'Mine', no: 'A permanent' }); if (yes) return { own: true }; const pool = allPerms().filter(x => (x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0)) && slLegal(P, x)); const c = await slAsk(P, pool, `${src.card.name}: choose target permanent`, true); return { own: false, c }; }
});
