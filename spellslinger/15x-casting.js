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
        } else if ((DRY_KINDS.has(e.t) || (e.t === 'cmd' && DRY_CMD.has(e.id) && !PRE_CMD[e.id])) && !e.target) {
            const picks = await slDryPicks(P, src, e);
            if (picks) { (out.tq = out.tq || {})[effects.indexOf(e)] = picks; any = true; }
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


// ---- The rest of the resolve-time picks, moved to cast time by a "dry run" (2026-11-15, owner: "move the remaining resolve-time picks to cast time too") ----
// For the effects below, a person is asked as the spell is cast / the ability is activated / the trigger goes on the stack: the effect is run once with every prompt answered
// by the person and then stopped at once (SlDryAbort), the game is put back from a checkpoint (so nothing the dry run did stays, and nothing it said is shown), and the
// answers are kept in order on the stack item (`multi.tq[effect index]`). When the effect really resolves, `pickCard` hands those answers back (a card that is no longer
// there is asked for again). The computer is never asked (it picks the same way at resolution).
class SlDryAbort extends Error { }
const DRY_KINDS = new Set(['emryMark', 'reaper', 'efreet', 'conscription', 'onceFuture', 'victimize', 'spry', 'druidPurify', 'zombieCopy']);
// CMD ids whose rules text says "target" and whose body picks a card (found by tests/dry_ids.py from rules/*.js and the 15*.js CMD bodies; rerun it after adding cards)
const DRY_CMD = new Set(['abuelo','alesha','augusta','aureliaEJ','auron','b_alesha','b_brago','b_emiel','b_eowyn','b_gonti','b_halana','b_inkeyes','b_ioreth','b_jaxis','b_lathiel','b_mina','b_phelia','b_varragoth','b_venser','b_xenagos','bounceSix','brightPalm','brinelin','bruna','bt_charge','bt_nesting','bt_oozeExile','bt_quest','bt_yaoGuai','bullAttack','burningSun','c_ardyn','c_betor','c_clav','c_gargos','c_gilraen','c_irma','c_lonis','c_lulu','c_nghathrod','c_olivia','c_raffine','c_rydia','c_sazh','c_szarel','c_xuifit','c_zur','carmen','cemeteryRecruit','clever','copyMaker','d_aerith','d_elena','d_horde','d_itzquinth','d_reyhan','d_rodolf','d_shrineGrow','d_terra','d_wrexial','destroyXTargets','dismantlingWave','doubleCountersMany','dragonlordAtarka','e_arcum','e_clique','e_colfenor','e_eowyn','e_evie','e_krile','e_layla','e_shabraz','e_silumgar','e_stiltzkin','emeria','excava','exileEachOpp','f_abigale','f_amy','f_archaic','f_barret','f_beorn','f_boone','f_brass','f_kamiz','f_lorthos','f_meneldor','f_panther','f_thancred','feralAppetite','filibuster','forceField','fr_invokeJustice','g_galina','g_ghen','g_heiko','g_legolas','g_omega','g_pharika','g_quistis','g_sierra','g_spider','g_tatyova','g_vaevictis','g_whiteMage','generalLeo','grub','guardianFaith','h_alora','h_azog','h_ignis','h_iroh','h_martha','h_mathas','h_mishraEm','h_obuun','h_quickbeam','h_rhys','h_sable','h_seifer','h_shiko','h_willowdusk','h_yosei','halana','havenReturn','heliodCounter','heliodRadiant','hg_gearhulk','hg_junker','hh_hideout','hh_sickbay','hraes','i_aziza','i_duke','i_extus','i_greasefang','i_jugan','i_kemba','i_kirri','i_nin','i_norika','i_owen','i_silas','i_sofia','i_tegan','i_tempestra','i_thor','invisibleWoman','j_ashling','j_doctor1','j_eutropia','j_orah','j_pia','j_toshiro','jenovaCombat','klothys','kudro','leinore','livaan','lockjaw','moseo','nilsCounters','oji','ojutaiSoW','orfeo','ot_eagle','ot_mystery','ot_nylaEnter','ot_othelm','ot_pursuitAttack','ot_reveillark','ot_shred','ot_soulStone','quintoriusCast','quintoriusExile','regrowCreature','reselectAttack','scalelord','scavengingOoze','scrapshooter','sd_gogo','sd_hulkling','shuffleGyBack','sidisiRegent','silkguardCounters','slobad','solomonFrogs','spiderIndia','surgeToVictory','sx_flockBounce','sx_grenzoGoad','tapTwo','td_blinkOwn','td_defiant','td_ktinga','td_martok','td_sevenLoot','td_tenor','td_tpring','td_troi','td_tuvok','td_uhura','technoReturn','theThing','theoden','timePlatform','tkAssimilateGy','tkBlastoneuron','tkChargeTarget','tkCommonGoal','tkCubeAssimilate','tkGyBottom','tkInnerI','tkKenrithReanimate','tkOldScientists2','tkOldScientists3','tkPureEnergy','tkReturnArtifactCreature','tkSaltVampire','tkWorfContractor','tkZero','totentanz','treebeard','triSentinel','twinflame','urdnan','urzaKroog','warsinger','winterSoldier','witchMoors','zemoAttack','zulAshur']);
{ const lg = log; log = function (m) { if (window.__DRY) return; return lg.apply(this, arguments); }; }
{ const tt = toast; toast = function () { if (window.__DRY) return; return tt.apply(this, arguments); }; }
{ const rg = renderGame; renderGame = function () { if (window.__DRY) return; return rg.apply(this, arguments); }; }
{ const ay = askYes; askYes = function () { if (window.__DRY) return Promise.reject(new SlDryAbort()); return ay.apply(this, arguments); }; }
{ const an = askNumber; askNumber = function () { if (window.__DRY) return Promise.reject(new SlDryAbort()); return an.apply(this, arguments); }; }
{
    const base = pickCard;
    pickCard = function (P, list, title, opts) {
        const d = window.__DRY;
        if (d) {
            if (d.replay.length) return Promise.resolve(d.replay.shift());
            return (window.__pickBase || base).apply(this, arguments).then(c => { d.picks.push(c || null); throw new SlDryAbort(); });
        }
        const q = G && G.curPickQ;
        if (q && q.length) { const c = q.shift(); if (c === null || (list && list.includes(c))) return Promise.resolve(c); }
        return (window.__pickBase || base).apply(this, arguments);
    };
}
// Collect a person's picks for one effect (called from preChoose); a failure of any kind just means "ask at resolution as before"
async function slDryPicks(P, src, e) {
    const picks = [];
    for (let guard = 0; guard < 6; guard++) {
        const ck = slCheckpoint(); if (!ck) return null;
        window.__DRY = { replay: picks.slice(), picks: [] };
        let done = false, aborted = false;
        try { await applyEffect(P, e, null, src); done = true; }
        catch (err) { if (err instanceof SlDryAbort) aborted = true; else { window.__DRY = null; slRestore(ck); return picks.length ? picks : null; } }
        const d = window.__DRY; window.__DRY = null; slRestore(ck);
        if (d.picks.length) picks.push(...d.picks);
        if (done || !aborted || !d.picks.length) break;
    }
    return picks.length ? picks : null;
}
// the stack item's resolution: hand each effect its own answers
{
    const base = resolveEffects;
    resolveEffects = async function () { try { return await base.apply(this, arguments); } finally { G.curPickQ = null; } };
}
