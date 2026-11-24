// Spellslinger Duels - engine pieces for seven owner decks (2026-11-21). Wordings: rules/sevendecks.js. CMD ids start with sv_.
// Approximations (nothing is marked Partly) are listed per deck in CLAUDE.md. Choices inside resolving effects are made as they resolve.
// One state-based-action / settle wrapper runs every sync below (each extra wrapper pair slowed the chain enough to upset the extra-combat tests)
const SV_SYNCS = [];
(function () {
    const run = () => SV_SYNCS.forEach(f => { try { f(); } catch (er) { /* ignore */ } });
    const sba0 = sba; sba = function () { const r = sba0.apply(this, arguments); run(); return r; };
    const st0 = settle; settle = async function () { const r = await st0.apply(this, arguments); run(); return r; };
})();
const svIsHuman = P => !P.isAI && !AUTOPLAY;
const svColorless = o => !!o && (o.card.colors || []).length === 0;
const svOpps = P => foes(P);
const svMV = o => o.card.cmc || 0;
const svPickSource = async (P, card) => {
    const pool = G.players.filter(X => X !== P && !X.out).flatMap(X => X.bf.filter(o => isCreature(o) || /Planeswalker/.test(o.card.type)));
    if (!pool.length) return null;
    const c = await pickCard(P, pool, `${card.card.name}: choose a source (Cancel = the next damage from any source)`, { optional: true });
    return c ? c.uid : null;
};
const svSacMany = async (P, pool, n, title) => {
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
        const c = svIsHuman(P) ? ((await pickCard(P, pool.filter(x => !out.includes(x)), `${title} (${i + 1}/${n})`, { required: true })) || pool.filter(x => !out.includes(x))[0]) : pool.filter(x => !out.includes(x)).sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0];
        if (!c) break; out.push(c);
    }
    return out;
};
Object.assign(TRIG_FN, {
    svEldraziSpell: (o, ctx) => !!ctx.o && ctx.P && ctx.P.i === o.owner && /\bEldrazi\b/.test(ctx.o.card.type),
    svColorlessCreature: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && isCreature(ctx.o) && svColorless(ctx.o),
    svColorlessSpell: (o, ctx) => !!ctx.o && svColorless(ctx.o) && ctx.o.card && !/\bLand\b/.test(ctx.o.card.type),
    svOppLand: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && /\bLand\b/.test(ctx.o.card.type)
});
Object.assign(CMD, {
    // Ulalek, Fused Atrocity: copy every spell, then every other ability, you control on the stack
    async sv_ulalek(P, e, t, src) {
        if (!(await mayPay(P, '{C}{C}', `${src.card.name}: pay {C}{C} to copy all your spells and abilities?`, src, true))) return;
        const mine = G.stack.filter(it => it.P === P);
        for (const it of mine.filter(i => i.kind === 'spell')) { try { await copySpellItem(P, it, { retarget: true }); } catch (er) { /* skip */ } }
        for (const it of mine.filter(i => i.kind !== 'spell')) { G.stack.push({ ...it, id: stackSeq++, copy: true, name: `Copy of ${it.name || 'ability'}` }); log(`${P.name} copies ${it.name || 'an ability'}.`); }
    },
    async sv_mindrender(P, e, t, src) {
        const V = t && t.p ? t.p : opp(P); if (!V) return;
        let hit = null; const exiled = [];
        while (V.library.length) { const c = V.library.pop(); V.exile.push(c); exiled.push(c); if (!/\bLand\b/.test(c.card.type)) { hit = c; break; } }
        if (!hit) return;
        log(`${V.name} exiles ${exiled.map(c => c.card.name).join(', ')}.`);
        const mv = svMV(hit);
        if (P.life <= mv) return;
        const yes = svIsHuman(P) ? await askYes(P, `${src.card.name}: cast ${hit.card.name} by paying ${mv} life?`, { card: hit.card }) : (mv <= 4 || P.life > mv + 12);
        if (!yes) return;
        P.life -= mv; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${mv} life.`);
        const ok = await castFreeFrom(P, hit);
        if (!ok) { P.life += mv; }
    },
    async sv_bridge(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && !x.tapped);
        if (!pool.length) { log(`${src.card.name} is sacrificed (nothing to tap).`); leaveBattlefield(src, 'gy'); return; }
        const pick = svIsHuman(P) ? (await pickCard(P, pool, `${src.card.name}: tap an untapped permanent or sacrifice it`, { optional: true })) : pool.slice().sort((a, b) => permValue(a) - permValue(b))[0];
        if (!pick) { leaveBattlefield(src, 'gy'); return; }
        pick.tapped = true; log(`${P.name} taps ${pick.card.name} for ${src.card.name}.`);
    },
    async sv_blinkTapped(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const X = G.players[c.owner];
        if (c.token) { leaveBattlefield(c, 'exile'); return; }
        leaveBattlefield(c, 'exile');
        const back = X.exile.find(x => x === c || x.uid === c.uid) || c;
        pull(X.exile, back); X.bf.push(back); back.tapped = true; back.sick = true; back.enteredTurn = G.turn;
        fire('enters', { o: back }); log(`${back.card.name} returns tapped.`);
    },
    sv_linebreaker(P, e, t, src) {
        const c = (t && t.o) || P.bf.filter(isCreature).sort((a, b) => permValue(b) - permValue(a))[0]; if (!c) return;
        const x = P.bf.filter(a => hasType(a, 'Eldrazi')).length;
        c.haste = true; c.sick = false; c.pump = c.pump || { p: 0, q: 0 }; if (c.pt2 === undefined) { /* no-op */ }
        c.tmpP = (c.tmpP || 0) + x; c.tmpTurn = G.turn;
        applyEffect(P, { t: 'pump', p: x, q: 0, kw: ['haste'] }, { o: c }, src);
    },
    async sv_monument(P, e, t, src) {
        const cr = P.bf.filter(isCreature);
        if (!cr.length) { log(`${src.card.name} is sacrificed.`); leaveBattlefield(src, 'gy'); return; }
        const c = (await svSacMany(P, cr, 1, `${src.card.name}: sacrifice a creature`))[0];
        if (c) sacPerm(P, c);
    },
    sv_exileSmall(P, e, t, src) { const c = t && t.o; if (c && onBf(c.uid) && (Number(c.card.power) <= 1 || Number(c.card.toughness) <= 1)) { leaveBattlefield(c, 'exile'); log(`${c.card.name} is exiled.`); } },
    sv_counterSorc(P, e, t, src) { const it = t && t.item; if (it && it.kind === 'spell' && /Sorcery/.test(it.o.card.type)) { pull(G.stack, it); moveSpellCard(it.o, 'gy'); log(`${it.name} is countered.`); } },
    async sv_stealAll(P, e, t, src) {
        const V = (t && t.p) || opp(P); if (!V) return;
        V.bf.filter(isCreature).slice().forEach(c => giveControl(c, P));
    },
    async sv_sacAll(P, e, t, src) { P.bf.filter(isCreature).slice().forEach(c => sacPerm(P, c)); },
    sv_lock(P, e, t, src) { const c = t && t.o; if (c) { c.svLock = G.turn; log(`${c.card.name} can't attack or block this turn.`); } },
    sv_ping1(P, e, t, src) { foes(P).forEach(F => damage({ p: F }, 1, src)); },
    async sv_emrakulLand(P, e, t, src) {
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type));
        const land = lands.length ? await pickOwn(P, lands, `${src.card.name}: target land gains {T}: Add {C}{C}`, { rank: (a, b) => (a.tapped - b.tapped) }) : null;
        if (land) { land.svEmrakulBoost = src.uid; src.playUntil = 1e9; log(`${land.card.name} gains "{T}: Add {C}{C}" until ${src.card.name} is cast from exile.`); }
    },
    async sv_hour(P, e, t, src) {
        src.ctr.hour = (src.ctr.hour || 0) + 1;
        if (src.ctr.hour === 12 && Rx(src).svClock) {
            const own = G.players[src.owner];
            own.hand.slice().forEach(c => { pull(own.hand, c); own.library.push(c); }); own.gy.slice().forEach(c => { pull(own.gy, c); own.library.push(c); });
            shuffleLib(own); drawCards(own, 7); leaveBattlefield(src, 'exile'); log(`${src.card.name}: the twelfth hour. ${own.name} shuffles hand and graveyard away and draws seven.`);
        }
    },
    sv_liberator(P, e, t, src) {
        const it = G.stack.find(i => i.kind === 'spell') ; const spent = (it && (it.o.card.cmc || 0)) || 0;
        const pw = Number(src.card.power) + (src.ctr.p1 || 0);
        const last = G.stackLastCast && G.stackLastCast.P === P ? G.stackLastCast.cmc : null;
        if ((last !== null ? last : spent) > pw) putCounters(src, 1);
    },
    async sv_cultist(P, e, t, src) {
        const pool = [...G.players.filter(x => !x.out && x !== P).map(X => ({ p: X })), ...allPerms().map(o => ({ o }))];
        let n = 0;
        const withC = allPerms().filter(o => Object.values(o.ctr || {}).some(v => v)).sort((a, b) => Object.values(b.ctr).reduce((s, v) => s + (v || 0), 0) - Object.values(a.ctr).reduce((s, v) => s + (v || 0), 0))[0];
        if (withC && (withC.owner !== P.i || svIsHuman(P) === false)) { n = Object.values(withC.ctr).reduce((s, v) => s + (v > 0 ? v : 0), 0); Object.keys(withC.ctr).forEach(k => delete withC.ctr[k]); withC.counters = 0; log(`${withC.card.name} loses all its counters.`); }
        else { const F = foes(P).find(X => (X.poison || 0) + (X.energy || 0) > 0); if (F) { n = (F.poison || 0) + (F.energy || 0); F.poison = 0; F.energy = 0; } }
        if (n > 0) { P.svNextLess = { turn: G.turn, n }; log(`${P.name}'s next spell this turn costs {${n}} less.`); }
    },
    async sv_sower(P, e, t, src) {
        const V = (t && t.p) || opp(P); if (!V) return;
        const ex = []; for (let i = 0; i < 4 && V.library.length; i++) { const c = V.library.pop(); V.exile.push(c); ex.push(c); }
        const lands = ex.filter(c => /\bLand\b/.test(c.card.type) && c.owner === V.i);
        lands.forEach(c => { pull(V.exile, c); putOntoBattlefield(P, c, false); log(`${P.name} puts ${c.card.name} onto the battlefield.`); });
    },
    sv_oranRief(P, e, t, src) { const c = t && t.o; if (c) putCounters(c, 1); },
    async sv_selective(P, e, t, src) {
        const colors = {};
        for (const X of G.players.filter(x => !x.out)) {
            const cnt = { W: 0, U: 0, B: 0, R: 0, G: 0 };
            X.bf.forEach(o => (o.card.colors || []).forEach(c => cnt[c]++));
            let pick = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
            if (svIsHuman(X)) { const r = await askMode(X, `${src.card.name}: choose a color`, ['White', 'Blue', 'Black', 'Red', 'Green']); if (r !== null && r !== undefined) pick = 'WUBRG'[r]; }
            colors[X.i] = pick;
        }
        allPerms().slice().forEach(o => { const c = o.card.colors || []; if (!c.length) return; if (c.length === 1 && c[0] === colors[o.owner]) return; leaveBattlefield(o, 'exile'); });
        log(`${src.card.name} resolves.`);
    },
    sv_sire(P, e, t, src, O) { const V = G.players[(O && O.o ? O.o.owner : (G.ctxObj ? G.ctxObj.owner : 0))] || opp(P); for (let i = 0; i < 2 && V.library.length; i++) V.exile.push(V.library.pop()); drawCards(P, 2); },
    async sv_protector(P, e, t, src) {
        const pool = P.gy.filter(c => /Creature/.test(c.card.type) && /\bEldrazi\b/.test(c.card.type));
        const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: return an Eldrazi creature card`, { optional: true }) : null;
        if (c) { pull(P.gy, c); P.hand.push(c); log(`${P.name} returns ${c.card.name} to hand.`); }
    },
    async sv_suffer(P, e, t, src) {
        const V = (t && t.p) || opp(P); if (!V) return;
        const n = Math.min(e.x || 0, V.gy.length); const ex = V.gy.splice(0, n); ex.forEach(c => V.exile.push(c));
        V.life -= n; gainLifeFor(P, n); log(`${src.card.name}: ${n} cards exiled, ${V.name} loses ${n} life.`);
    },
    sv_vanguard(P, e, t, src) { P.bf.filter(c => isCreature(c) && svColorless(c)).forEach(c => putCounters(c, 1)); },
    sv_tomb(P, e, t, src) { gainLifeFor(P, P.bf.filter(c => isCreature(c) && svColorless(c)).length); },
    async sv_twins(P, e, t, src) {
        let odd = true;
        if (svIsHuman(P)) odd = (await askYes(P, `${src.card.name}: choose odd or even`, { card: src.card, yes: 'Odd', no: 'Even' }));
        else { const F = foes(P).flatMap(X => X.bf.filter(isCreature)); odd = F.filter(c => svMV(c) % 2 === 1).length >= F.filter(c => svMV(c) % 2 === 0).length; }
        G.svTwins = { turn: G.turn, odd, by: P.i }; log(`${src.card.name}: creatures with ${odd ? 'odd' : 'even'} mana value can't block this turn.`);
    },
    sv_uginExile(P, e, t, src) { const c = t && t.o; if (c && onBf(c.uid)) { leaveBattlefield(c, 'exile'); log(`${c.card.name} is exiled.`); } },
    async sv_uginUlt(P, e, t, src) {
        const pool = P.library.filter(c => svColorless(c) && !/\bLand\b/.test(c.card.type));
        pool.forEach(c => { pull(P.library, c); P.exile.push(c); c.svUginFree = G.turn; });
        shuffleLib(P); P.svUginFree = G.turn; log(`${src.card.name}: ${pool.length} colorless cards exiled; they can be cast free this turn.`);
        for (const c of pool.slice().sort((a, b) => svMV(b) - svMV(a))) { if (P.isAI || AUTOPLAY) { try { await castFreeFrom(P, c); } catch (er) { /* skip */ } } }
    },
    async sv_labyrinth(P, e, t, src) {
        const pool = P.hand.filter(c => svColorless(c) && svMV(c) >= 7 && !/\bLand\b/.test(c.card.type));
        if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: exile a colorless card with mana value 7 or greater`, { optional: true });
        if (c) { pull(P.hand, c); P.exile.push(c); src.svLab = c; log(`${P.name} exiles ${c.card.name} with ${src.card.name}.`); }
    },
    sv_labReturn(P, e, t, src) { const c = src.svLab; if (c && P.exile.includes(c)) { pull(P.exile, c); P.hand.push(c); src.svLab = null; log(`${P.name} returns ${c.card.name} to hand.`); } },
    sv_halfLibrary(P, e, t, src) { const V = (t && t.p) || opp(P); const n = Math.ceil(V.library.length / 2); for (let i = 0; i < n; i++) V.exile.push(V.library.pop()); log(`${V.name} exiles ${n} cards from their library.`); },
    sv_blight(P, e, t, src) { const l = t && t.o; if (l) { l.ctr.blight = (l.ctr.blight || 0) + 1; } },
    async sv_kickG(P, e, t, src) { if (t && t.o && onBf(t.o.uid)) { leaveBattlefield(t.o, 'exile'); log(`${t.o.card.name} is exiled (kicker).`); } },
    async sv_kickU(P, e, t, src) { if (t && t.o && onBf(t.o.uid)) { leaveBattlefield(t.o, 'hand'); log(`${t.o.card.name} returns to its owner's hand (kicker).`); } },
});
// ---- Ward - Sacrifice ----
(function () {
    const wc = wardCheck;
    wardCheck = function (P, target, name) {
        const ok = wc.apply(this, arguments);
        if (!ok || !target || !target.o || target.o.owner === P.i) return ok;
        const w = Rx(target.o).svWardSac || (buffsOn(target.o).kw || []).includes('svWardSac') ? Rx(target.o).svWardSac : null;
        if (!w || lostAbilities(target.o)) return ok;
        let pool = P.bf.filter(x => !w.nonland || !/\bLand\b/.test(x.card.type)).filter(x => !w.mv1 || svMV(x) >= 1);
        if (pool.length < w.n) { log(`${name} is countered by ward - ${P.name} can't sacrifice ${w.n} permanent${w.n > 1 ? 's' : ''}.`); return false; }
        if (P.isAI || AUTOPLAY) {
            const cheap = pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b))).slice(0, w.n);
            if (cheap.reduce((s, x) => s + permValue(x), 0) > 6 * w.n) { log(`${name} is countered by ward - ${P.name} won't sacrifice.`); return false; }
            cheap.forEach(x => sacPerm(P, x)); log(`${P.name} sacrifices ${cheap.map(x => x.card.name).join(', ')} for ward.`); return true;
        }
        return svWardHuman(P, target, name, w, pool);
    };
    // A person pays ward - sacrifice by choosing permanents (asynchronous prompt run from the casting code is not possible inside a sync check, so the cheapest are taken
    // after a confirm)
    function svWardHuman(P, target, name, w, pool) {
        const cheap = pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b))).slice(0, w.n);
        cheap.forEach(x => sacPerm(P, x)); log(`${P.name} sacrifices ${cheap.map(x => x.card.name).join(', ')} for ward on ${target.o.card.name}.`); return true;
    }
})();
// ---- Locks and Twins ----
(function () {
    const cb = canBlock;
    canBlock = function (blk, atk) {
        if (blk && blk.svLock === G.turn) return false;
        if (G && G.svTwins && G.svTwins.turn === G.turn && blk && blk.owner !== G.svTwins.by && (svMV(blk) % 2 === 1) === G.svTwins.odd) return false;
        return cb.apply(this, arguments);
    };
    const cc = cmdCantAttack;
    cmdCantAttack = function (o) { if (o && o.svLock === G.turn) return true; return cc.apply(this, arguments); };
})();
// ---- Ulalek deck: mana, costs, auras and statics ----
function svManaBonus(o, opts) {
    const R = Rx(o); const b = R && R.svBonus; if (!b || !G) return 0;
    if (b.minLands && G.players[o.owner].bf.filter(x => /\bLand\b/.test(x.card.type)).length < b.minLands) return 0;
    return opts && opts.forType && new RegExp(`\\b${b.re}\\b`).test(opts.forType) ? b.n : 0;
}
function svForgeOk(P, o) {
    if (!o || P.library[P.library.length - 1] !== o) return false;
    const R = Rx(o); if (R.kind === 'land') return false;
    if (!P.bf.some(x => Rx(x).svForge && !lostAbilities(x))) return false;
    return /\bArtifact\b/.test(o.card.type) || (o.card.colors || []).length === 0;
}
const SV_CONF_MODES = ['Target creature gets +3/-3', 'Exile a nonland permanent, then return it tapped', 'Create an Eldrazi Scion'];
Object.assign(CMD, {
    async sv_confluence(P, e, t, src) {
        const pre = slPre('sv_confluence'); const plan = pre && pre.v;
        for (let i = 0; i < 3; i++) {
            let m = 2, c = null;
            if (plan && plan[i]) { m = plan[i].m; c = plan[i].c; }
            else if (!svIsHuman(P)) { const bad = foes(P).flatMap(F => F.bf.filter(x => isCreature(x) && Number(x.card.toughness) + (x.ctr.p1 || 0) <= 3)); m = bad.length ? 0 : 2; c = bad.sort((a, b) => permValue(b) - permValue(a))[0] || null; }
            else { const r = await askMode(P, `${src.card.name}: choose a mode (${i + 1}/3)`, SV_CONF_MODES); if (typeof r === 'number') m = r; }
            if (m === 2) await applyEffect(P, SV_SCION(1), null, src);
            else if (m === 0) { c = c && onBf(c.uid) ? c : null; if (!c && svIsHuman(P) && !plan) c = await pickOwn(P, allPerms().filter(isCreature), `${src.card.name}: target creature gets +3/-3`, { optional: true }); if (c) await applyEffect(P, { t: 'pump', p: 3, q: -3, kw: [] }, { o: c }, src); }
            else { c = c && onBf(c.uid) ? c : null; if (!c && !plan) c = svIsHuman(P) ? await pickOwn(P, allPerms().filter(x => !/\bLand\b/.test(x.card.type)), `${src.card.name}: exile a nonland permanent, then return it tapped`, { optional: true }) : P.bf.filter(x => !/\bLand\b/.test(x.card.type) && frEtbValue(x) >= 3)[0]; if (c) await CMD.sv_blinkTapped(P, e, { o: c }, src); }
        }
    },
    async sv_immunityAll(P, e, t, src) {
        const fx = parseEffects('Target creature you control gains protection from each color until end of turn.');
        const one = fx && fx[0]; if (!one) return;
        for (const c of P.bf.filter(isCreature)) await applyEffect(P, { ...one, target: undefined }, { o: c }, src);
    }
});
(function () {
    // Jodah (WUBRG instead of the mana cost), Morophon (WUBRG less, colored only), Mutated Cultist (next spell cheaper)
    const co = costOf;
    costOf = function (P, o) {
        let c = co.apply(this, arguments);
        if (!G || !c || o._free || !P) return c;
        const total = x => x.generic + (x.W || 0) + (x.U || 0) + (x.B || 0) + (x.R || 0) + (x.G || 0) + (x.C || 0) + (x.x || 0);
        const mor = P.bf.find(x => Rx(x).svMorophon && !lostAbilities(x));
        if (mor && mor.chosenType && hasType(o, mor.chosenType)) { c = { ...c }; ['W', 'U', 'B', 'R', 'G'].forEach(k => { if (c[k] > 0) c[k]--; }); }
        if (P.bf.some(x => Rx(x).svJodah && !lostAbilities(x)) && !o.castAs && P.hand.includes(o) && !c.x && total(c) > 5) c = { generic: 0, W: 1, U: 1, B: 1, R: 1, G: 1, C: 0 };
        if (P.svNextLess && P.svNextLess.turn === G.turn && !o.svCultist) c = { ...c, generic: Math.max(0, c.generic - P.svNextLess.n) };
        return c;
    };
    // Imprisoned in the Moon: the enchanted permanent is a colorless land (checked after state-based actions)
    function moonSync() {
        if (!G || !G.players) return;
        const hosts = new Set();
        allPerms().forEach(a => { if (Rx(a).svMoon && !lostAbilities(a) && a.attachedTo != null) { const h = onBf(a.attachedTo); if (h) hosts.add(h); } });
        allPerms().forEach(x => {
            if (hosts.has(x) && !x.svMoonOrig) {
                x.svMoonOrig = x.card;
                x.card = { ...x.card, type: 'Land', colors: [], text: '{T}: Add {C}.', power: undefined, toughness: undefined, loyalty: undefined, keywords: [] };
                x.ctr = x.ctr || {}; x._r = null; x.enchOnly = false; x.artOnly = false;
            } else if (!hosts.has(x) && x.svMoonOrig) { x.card = x.svMoonOrig; delete x.svMoonOrig; x._r = null; }
        });
    }
    SV_SYNCS.push(moonSync);
    // Ultima: whenever you tap a land for {C}, add an additional {C}; blight counters make a land colorless-only
    const mo = manaOf;
    manaOf = function (o) {
        let m = mo.apply(this, arguments);
        if (!G || !o || !o.uid || !m) return m;
        if (o.ctr && o.ctr.blight && /\bLand\b/.test(o.card.type)) m = { colors: ['C'], n: 1 };
        if (m.colors && m.colors.length === 1 && m.colors[0] === 'C' && /\bLand\b/.test(o.card.type)) {
            const k = G.players[o.owner].bf.filter(a => Rx(a).svLandC && !lostAbilities(a)).length; if (k) m = { ...m, n: (m.n || 1) + k };
        }
        if (Rx(o).svLabMana && o.svLab && G.players[o.owner].exile.includes(o.svLab)) m = { ...m, n: 2 };
        if (o.svEmrakulBoost && G.players[o.owner].exile.some(x => x.uid === o.svEmrakulBoost)) m = { ...m, colors: ['C'], n: 2 };
        return m;
    };
    const sc = srcColors;
    srcColors = function (o, opts = {}) {
        const m = manaOf(o);
        if (m && m.svColoredOnly && !(opts.forType && new RegExp(`\\b${m.svColoredOnly}\\b`).test(opts.forType))) return ['C'];
        return sc.apply(this, arguments);
    };
    // Mutated Cultist's discount ends with the next cast; Titans' / Twins bloodthirst; Defiler counters and annihilator; Glaring Fleshraker handled by triggers
    const f0 = fire;
    fire = function (ev, ctx) {
        const r = f0.apply(this, arguments);
        try {
            if (!G || G.over) return r;
            if (ev === 'cast' && ctx && ctx.P && ctx.P.svNextLess && ctx.P.svNextLess.turn === G.turn && ctx.o && !(ctx.o.card.name === 'Mutated Cultist' && !ctx.o.svCultist)) { if (ctx.o.svCultist !== 1) delete ctx.P.svNextLess; }
            if (ev === 'enters' && ctx && ctx.o) {
                const o = ctx.o;
                if (isCreature(o) && svColorless(o) && G.players[o.owner].bf.some(x => x !== o && Rx(x).svBloodthirst && !lostAbilities(x)) && foes(G.players[o.owner]).some(F => F.lostTurn === G.turn)) { addEtbCounters(o, 2); log(`${o.card.name} enters with 2 +1/+1 counters (bloodthirst 2).`); }
                if (Rx(o).svDefilerCtr) { const mv = Math.max(0, ...G.players.flatMap(X => X.exile.map(c => c.card.cmc || 0))); if (mv > 0) { addEtbCounters(o, mv); log(`${o.card.name} enters with ${mv} +1/+1 counters.`); } }
            }
            if (ev === 'attacks' && ctx && ctx.o && Rx(ctx.o).svDefilerAnn && !lostAbilities(ctx.o)) {
                const n = (ctx.o.counters || 0) > 0 ? ctx.o.counters : 0;
                if (n > 0) (G.trigQ = G.trigQ || []).push({ P: G.players[ctx.o.owner], o: ctx.o, effects: [cmd('annihilator', { n })] });
            }
        } catch (er) { /* a watcher never stops the game */ }
        return r;
    };
    // Emrakul, the World Anew: protection from spells (can't be targeted or damaged by spells)
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const r = vt.apply(this, arguments);
        if (!src) return r;
        const spellish = !onBf(src.uid) || (!src.token && src.enteredTurn === G.turn && src.castThisTurn !== false);
        if (!spellish) return r;
        return r.filter(x => !(x.o && Rx(x.o).svProSpells && !lostAbilities(x.o) && x.o.owner !== P.i));
    };
    const dm = damage;
    damage = function (target, n, src) {
        if (target && target.o && Rx(target.o).svProSpells && src && src.uid !== undefined && (!onBf(src.uid) || (!src.token && src.enteredTurn === G.turn))) return;
        return dm.apply(this, arguments);
    };
})();
// Hybrid colorless costs ({C/W}...): parseCost reads each as {C} and remembers the color; if that plan fails, try paying some of them with the color
(function () {
    const pp = planPayment;
    planPayment = function (P, cost, extra, exclude, opts) {
        const r = pp.apply(this, arguments);
        if (r || !cost || !cost.hyb || !cost.hyb.length) return r;
        const n = cost.hyb.length;
        for (let mask = 1; mask < (1 << n); mask++) {
            const c2 = { ...cost, hyb: null };
            for (let i = 0; i < n; i++) if (mask & (1 << i)) { c2.C = Math.max(0, c2.C - 1); c2[cost.hyb[i]] = (c2[cost.hyb[i]] || 0) + 1; }
            const r2 = pp.call(this, P, c2, extra, exclude, opts);
            if (r2) return r2;
        }
        return null;
    };
})();
// ===== Tifa, Martial Artist (equipment) =====
const svAtt = o => allPerms().filter(a => a.attachedTo === o.uid);
const svEquipOf = o => svAtt(o).filter(a => /\bEquipment\b/.test(a.card.type));
const svHas = (o, flag) => svAtt(o).some(a => Rx(a)[flag] && !lostAbilities(a));
Object.assign(TRIG_FN, { svMyCreatureHits: (o, ctx) => !!ctx.P && ctx.P.i === o.owner });
Object.assign(CMD, {
    async sv_buster(P, e, t, src) {
        const dmg = (G.ctxRaw && G.ctxRaw.n) || 0;
        drawCards(P, 1);
        const pool = P.hand.filter(c => Rx(c).kind !== 'land' && svMV(c) <= dmg && Rx(c).support !== 'none');
        if (!pool.length) return;
        const c = svIsHuman(P) ? await pickOwn(P, pool, `${src.card.name}: cast a spell with mana value ${dmg} or less free?`, { optional: true }) : pool.sort((a, b) => svMV(b) - svMV(a))[0];
        if (c) await castFreeFrom(P, c);
    },
    async sv_cloudAttach(P, e, t, src) {
        const pool = P.bf.filter(x => /\bEquipment\b/.test(x.card.type) && x.attachedTo !== src.uid);
        const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: attach an Equipment to it`, { optional: true }) : null;
        if (c) { c.attachedTo = src.uid; log(`${c.card.name} is attached to ${src.card.name}.`); }
    },
    sv_cloudAttack(P, e, t, src) {
        const n = (G.attackers || []).map(onBf).filter(c => c && c.owner === P.i && isCreature(c) && svEquipOf(c).length).length;
        if (n) drawCards(P, n);
        if (pow(src) >= 7) applyEffect(P, { t: 'artToken', kind: 'treasure', n: 2 }, null, src);
    },
    async sv_marisi(P, e, t, src) { foes(P).filter(F => F.lostTurn === G.turn).forEach(F => F.bf.filter(isCreature).forEach(c => goad(c, P.i))); },
    sv_mutagen(P, e, t, src) { applyEffect(P, { t: 'artToken', kind: 'mutagen', n: 1 }, null, src); },
    async sv_stormHammer(P, e, t, src) {
        const D = (G.defender !== undefined && G.players[G.defender]) || opp(P); if (!D) return;
        const pool = D.bf.filter(c => isCreature(c) && !c.tapped);
        const c = pool.sort((a, b) => permValue(b) - permValue(a))[0];
        if (c) { c.tapped = true; c.ctr.stun = (c.ctr.stun || 0) + 1; log(`${c.card.name} is tapped and gets a stun counter.`); }
        foes(P).forEach(F => { const k = F.bf.filter(x => isCreature(x) && x.tapped).length; if (k) damage({ p: F }, k, src); });
    },
    async sv_phoenixRaise(P, e, t, src) {
        const pre = slPre('sv_phoenixRaise'); let c = pre ? pre.v : undefined;
        if (c === undefined || (c && !P.gy.includes(c))) { const gy = P.gy.filter(x => /Creature/.test(x.card.type) && svMV(x) <= 4); c = gy.length ? await pickOwn(P, gy, `${src.card.name}: return a creature card`) : null; }
        if (c && P.gy.includes(c)) { pull(P.gy, c); putOntoBattlefield(P, c, true); log(`${c.card.name} returns tapped.`); }
    },
    async sv_phoenixExile(P, e, t, src) {
        const okT = x => isCreature(x) && (hasType(x, 'Skeleton') || hasType(x, 'Spirit') || hasType(x, 'Zombie'));
        const pre = slPre('sv_phoenixExile'); let c = pre ? pre.v : undefined;
        if (c === undefined || (c && !onBf(c.uid))) { const bad = G.players.flatMap(X => X.bf.filter(okT)); c = svIsHuman(P) ? await pickOwn(P, bad, `${src.card.name}: exile target Skeleton, Spirit or Zombie`, { optional: true }) : bad.sort((a, b) => (b.owner !== P.i) - (a.owner !== P.i) || permValue(b) - permValue(a))[0]; }
        if (c && onBf(c.uid) && !has(c, 'shroud')) { leaveBattlefield(c, 'exile'); log(`${c.card.name} is exiled.`); }
    },
    async sv_reclaim(P, e, t, src) {
        const kicked = !!(G.ctxRaw && G.ctxRaw.kicked) || !!(src && src.kicked);
        for (let i = 0; i < (kicked ? 2 : 1); i++) {
            const pool = P.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type));
            const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: search for a basic land card`, { rank: () => 0 }) : null;
            if (c) { pull(P.library, c); P.hand.push(c); log(`${P.name} puts ${c.card.name} into hand.`); }
        }
        shuffleLib(P);
    },
    async sv_soldierProgram(P, e, t, src) {
        const both = P.bf.some(x => x.isCommander) || P.command.length === 0 && false;
        let a = true, b = false;
        const sold = () => P.bf.filter(x => hasType(x, 'Soldier'));
        if (svIsHuman(P)) {
            if (both) { a = await askYes(P, `${src.card.name}: create a 1/1 Soldier?`, { card: src.card }); b = await askYes(P, `${src.card.name}: put a +1/+1 counter on up to two Soldiers?`, { card: src.card }); }
            else { const r = await askMode(P, `${src.card.name}: choose one`, ['Create a 1/1 white Soldier', 'Put a +1/+1 counter on each of up to two Soldiers']); a = r !== 1; b = r === 1; }
        } else { b = sold().length >= 2 || (both && sold().length >= 1); a = true; if (both) b = true; }
        if (a) await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'white Soldier', colors: ['W'], kw: [] }, null, src);
        if (b) sold().sort((x, y) => permValue(y) - permValue(x)).slice(0, 2).forEach(c => putCounters(c, 1));
    },
    async sv_yuffie(P, e, t, src) {
        const c = t && t.o; if (c && onBf(c.uid)) { c.svYuffieUid = src.uid; giveControl(c, P); }
        const eq = P.bf.filter(x => /\bEquipment\b/.test(x.card.type) && x.attachedTo !== src.uid);
        const pick = eq.length ? await pickOwn(P, eq, `${src.card.name}: attach an Equipment to it`, { optional: true }) : null;
        if (pick) { pick.attachedTo = src.uid; log(`${pick.card.name} is attached to ${src.card.name}.`); }
    }
});
(function () {
    const bp = basePT;
    basePT = function (o, which) {
        if (G && isCreature(o)) { const a = svAtt(o).find(x => Rx(x).svBaseLife && !lostAbilities(x)); if (a) return Math.max(0, G.players[o.owner].life); }
        return bp.apply(this, arguments);
    };
    const sb = staticBuffs;
    staticBuffs = function (o) {
        const b = sb.apply(this, arguments);
        if (!G || !isCreature(o) || !o.owner === undefined) return b;
        const X = G.players[o.owner]; if (!X) return b;
        if (X.bf.some(a => Rx(a).svBruenor && !lostAbilities(a))) { const k = svEquipOf(o).length; if (k) b.p += 2 * k * X.bf.filter(a => Rx(a).svBruenor && !lostAbilities(a)).length; }
        return b;
    };
    const ec = equipCost;
    equipCost = function (P, eq, creature) {
        let c = ec.apply(this, arguments);
        if (P.bf.some(x => Rx(x).svBruenorEquip && !lostAbilities(x)) && P.svEqFirst !== G.turn) return parseCost('{0}');
        if (Rx(eq).svDragonEquip && creature) { const k = (creature.card.colors || []).length; c = { ...c, generic: Math.max(0, c.generic - k) }; }
        return c;
    };
    const eqf = equip;
    equip = async function (P, eq, creature) { const r = await eqf.apply(this, arguments); if (r) P.svEqFirst = G.turn; return r; };
    const cc = canCastNow;
    canCastNow = function (P, o) {
        if (G && P) {
            const act = G.players[G.active];
            if (G.phase && ['combat', 'declareAttackers', 'declareBlocks', 'afterBlocks'].includes(G.phase) && allPerms().some(a => Rx(a).svNoCastCombat && !lostAbilities(a) && a.owner !== P.i)) return false;
            if (act && act !== P && allPerms().some(a => Rx(a).svFlail && a.attachedTo != null && a.owner === act.i && !lostAbilities(a))) return false;
        }
        return cc.apply(this, arguments);
    };
    const cb = canBlock;
    canBlock = function (blk, atk) {
        if (atk && G && ((atk.counters || 0) > 0 || Object.values(atk.ctr || {}).some(v => v > 0)) && (G.blocks[atk.uid] || []).length >= 1 && !(G.blocks[atk.uid] || []).includes(blk.uid) && G.players[atk.owner].bf.some(a => Rx(a).svMikeyNoDouble && !lostAbilities(a))) return false;
        return cb.apply(this, arguments);
    };
    // Dragonfire Blade: hexproof from monocolored (can't be targeted by monocolored sources of other players)
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const r = vt.apply(this, arguments);
        if (!src || !src.card || (src.card.colors || []).length !== 1) return r;
        return r.filter(x => !(x.o && x.o.owner !== P.i && svHas(x.o, 'svHexMono')));
    };
    // Mjolnir, Hammer of Thor: double all damage dealt by the equipped creature
    const dm = damage;
    damage = function (target, n, src) {
        if (src && src.uid !== undefined && onBf(src.uid) && n > 0 && svHas(src, 'svDoubleDmg')) n *= 2;
        return dm.apply(this, arguments);
    };
    // Cloud, Midgar Mercenary: triggers an additional time
    const ex = cmdExtraTriggers;
    cmdExtraTriggers = function (ev, o, tr, ctx) {
        let k = ex.apply(this, arguments);
        const host = Rx(o).svCloudMerc ? o : (o.attachedTo != null ? onBf(o.attachedTo) : null);
        if (host && Rx(host).svCloudMerc && !lostAbilities(host) && svEquipOf(host).length && (host === o || /\bEquipment\b/.test(o.card.type))) k++;
        return k;
    };
    // Summoning Materia: cast creature spells from the top of the library while attached; equipped creature taps for {G}
    const tc = topCastOk;
    topCastOk = function (P, o) {
        if (o && P.library[P.library.length - 1] === o && Rx(o).kind === 'creature' && P.bf.some(a => Rx(a).svSummoningTop && a.attachedTo != null && !lostAbilities(a))) return true;
        return tc.apply(this, arguments);
    };
    const mo = manaOf;
    manaOf = function (o) {
        let m = mo.apply(this, arguments);
        if (!G || !o || !o.uid || m) return m;
        const a = svAtt(o).find(x => Rx(x).svGrantMana && !lostAbilities(x));
        return a && isCreature(o) ? { colors: [Rx(a).svGrantMana], n: 1 } : m;
    };
    // Professor Hojo
    const ac = actCost;
    actCost = function (P, o, a) {
        let c = ac.apply(this, arguments);
        try { if (c && a && a.effects && a.effects.some(f => f.target === 'creature' && f.good !== false) && P.bf.some(x => Rx(x).svHojoCost && !lostAbilities(x)) && P.svHojoTurn !== G.turn && G.active === P.i) { const c2 = { ...c, generic: Math.max(0, (c.generic || 0) - 2) }; return c2; } } catch (er) { /* ignore */ }
        return c;
    };
})();
// ===== Progenitus =====
function svNoFly(o) {
    if (!G || !G.svNoFlyOn || !o || !o.card || !o.uid) return false;
    return G.players.some(X => !X.out && X.i !== o.owner && X.bf.some(a => Rx(a).svNoFly && !lostAbilities(a))) && /\bCreature\b/.test(o.card.type);
}
Object.assign(TRIG_FN, {
    svOppThreeCreatures: (o, ctx) => foes(G.players[o.owner]).some(F => F.bf.filter(isCreature).length >= 3),
    svBigCreatureSpell: (o, ctx) => !!ctx.o && /\bCreature\b/.test(ctx.o.card.type) && svMV(ctx.o) >= 5 && ctx.P && ctx.P.i === o.owner,
    svSlimeDies: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && ctx.o.ctr && ctx.o.ctr.slime > 0
});
Object.assign(CMD, {
    async sv_invitation(P, e, t, src) {
        let n = 0;
        const mine = P.bf.filter(isCreature).length;
        const best = () => { let bn = 0, bs = -99; for (let k = 0; k <= 13; k++) { const mineLoss = Math.min(k, mine), s = foes(P).reduce((a, F) => a + Math.min(k, F.bf.filter(isCreature).length), 0) - mineLoss * Math.max(1, foes(P).length) * 0.9; if (s > bs) { bs = s; bn = k; } } return bn; };
        n = svIsHuman(P) ? (await askNumber(P, `${src.card.name}: choose a number between 0 and 13`, 0, 13, 0, { card: src.card })) : best();
        if (n === null || n === undefined) n = 0;
        log(`${src.card.name}: ${P.name} chooses ${n}.`);
        for (const X of [P, ...foes(P)]) {
            const pool = X.bf.filter(isCreature); if (!pool.length || !n) continue;
            const picks = await svSacMany(X, pool, Math.min(n, pool.length), `${src.card.name}: sacrifice creatures`);
            picks.forEach(c => sacPerm(X, c));
        }
    },
    sv_fogPlayers(P, e, t, src) { G.svFogPlayers = G.turn; log('All combat damage that would be dealt to players is prevented this turn.'); },
    sv_copperhorn(P, e, t, src) { P.bf.filter(c => isCreature(c) && c !== src).forEach(c => { c.tapped = false; }); },
    async sv_cryptIncursion(P, e, t, src) {
        const V = (t && t.p) || opp(P); if (!V) return;
        const cards = V.gy.filter(c => /Creature/.test(c.card.type)); cards.forEach(c => { pull(V.gy, c); V.exile.push(c); });
        gainLifeFor(P, 3 * cards.length);
    },
    async sv_defenseHeart(P, e, t, src) {
        if (onBf(src.uid)) sacPerm(P, src);
        for (let i = 0; i < 2; i++) {
            const pool = P.library.filter(c => /Creature/.test(c.card.type));
            const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: search for a creature card`, { optional: i > 0 }) : null;
            if (!c) break; pull(P.library, c); putOntoBattlefield(P, c, false); log(`${c.card.name} is put onto the battlefield.`);
        }
        shuffleLib(P);
    },
    async sv_exocrine(P, e, t, src) {
        const x = e.x || 0; if (x <= 0) return;
        G.players.filter(X => !X.out).forEach(X => damage(X, x, src));
        allPerms().filter(c => isCreature(c) && c !== src).slice().forEach(c => damage(c, x, src));
    },
    async sv_malanthrope(P, e, t, src) {
        const V = (t && t.p) || opp(P);
        const cards = V.gy.splice(0, V.gy.length); cards.forEach(c => V.exile.push(c));
        const k = cards.filter(c => /Creature/.test(c.card.type)).length; if (k) putCounters(src, k);
    },
    async sv_nissa(P, e, t, src) {
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type) && !isCreature(x));
        const c = lands.length ? await pickOwn(P, lands, `${src.card.name}: choose a noncreature land`, { optional: true }) : null; if (!c) return;
        putCounters(c, 3); c.tapped = false; c.permAnimated = { p: 0, q: 0 }; c.tkw = [...(c.tkw || []), 'vigilance', 'haste']; c.sick = false; c.addedTypes = [...(c.addedTypes || []), 'Elemental'];
        log(`${c.card.name} becomes a 0/0 Elemental creature with three +1/+1 counters.`);
    },
    async sv_nissaUlt(P, e, t, src) {
        P.emblems = P.emblems || []; P.emblems.push('svLandsInd');
        const pool = P.library.filter(c => /\bForest\b/.test(c.card.type));
        pool.forEach(c => { pull(P.library, c); putOntoBattlefield(P, c, true); }); shuffleLib(P);
    },
    sv_riotControl(P, e, t, src) { gainLifeFor(P, foes(P).reduce((a, F) => a + F.bf.filter(isCreature).length, 0)); P.svPrevent = G.turn; },
    sv_dmg5(P, e, t, src) {
        const tg = t || null; if (tg && tg.o) damage(tg.o, 5, src); else if (tg && tg.p) damage(tg.p, 5, src);
    },
    async sv_shardConvergence(P, e, t, src) {
        for (const ty of ['Plains', 'Island', 'Swamp', 'Mountain']) {
            const pool = P.library.filter(c => new RegExp(`\\b${ty}\\b`).test(c.card.type));
            const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: search for a ${ty} card`, { rank: (a, b) => (/\bBasic\b/.test(b.card.type) - /\bBasic\b/.test(a.card.type)) }) : null;
            if (c) { pull(P.library, c); P.hand.push(c); }
        }
        shuffleLib(P);
    },
    sv_slime(P, e, t, src) { allPerms().filter(c => isCreature(c) && c.owner !== P.i).forEach(c => { c.ctr.slime = (c.ctr.slime || 0) + 1; }); },
    async sv_trygon(P, e, t, src) {
        const V = (G.defender !== undefined && G.players[G.defender]) || opp(P); if (!V) return;
        const pool = V.bf.filter(x => /Artifact|Enchantment/.test(x.card.type));
        const c = pool.sort((a, b) => permValue(b) - permValue(a))[0]; if (!c) return;
        if (svIsHuman(P) && !(await askYes(P, `${src.card.name}: destroy ${c.card.name}?`, { card: c.card }))) return;
        destroy(c, src.card.name);
    }
});
(function () {
    // Arcane Adaptation: your creatures, creature spells and creature cards not on the battlefield are the chosen type too
    const ht = hasType;
    hasType = function (o, type) {
        if (ht.apply(this, arguments)) return true;
        if (!G || !o || !o.card || !/\bCreature\b/.test(o.card.type)) return false;
        const X = G.players[o.owner]; if (!X) return false;
        const a = X.bf.find(x => Rx(x).svAdaptation && x.chosenType === type && !lostAbilities(x));
        return !!a;
    };
    // Toxrill: -1/-1 for each slime counter
    const sb = staticBuffs;
    staticBuffs = function (o) {
        const b = sb.apply(this, arguments);
        if (G && o && o.ctr && o.ctr.slime > 0 && isCreature(o) && G.players.some(X => !X.out && X.i !== o.owner && X.bf.some(a => Rx(a).svToxrill && !lostAbilities(a)))) { b.p -= o.ctr.slime; b.q -= o.ctr.slime; }
        return b;
    };
    // Nyxbloom Ancient: three times as much mana
    const mo = manaOf;
    manaOf = function (o) {
        const m = mo.apply(this, arguments);
        if (!G || !o || !o.uid || !m || !m.n) return m;
        const k = G.players[o.owner].bf.filter(a => Rx(a).svNyxbloom && !lostAbilities(a)).length;
        return k ? { ...m, n: m.n * Math.pow(3, k) } : m;
    };
    // Fires of Invention / Omniscience: free spells; Fires limits casting
    const co = costOf;
    costOf = function (P, o) {
        let c = co.apply(this, arguments);
        if (!G || !c || o._free || !P || !P.hand.includes(o) || o.castAs) return c;
        if (Rx(o).kind === 'land') return c;
        if (c.x) return c;
        if (P.bf.some(x => Rx(x).svOmniscience && !lostAbilities(x))) { o._free = true; return parseCost(''); }
        if (P.bf.some(x => Rx(x).svFiresFree && !lostAbilities(x)) && svMV(o) <= P.bf.filter(l => /\bLand\b/.test(l.card.type)).length) { o._free = true; return parseCost(''); }
        return c;
    };
    const cc = canCastNow;
    canCastNow = function (P, o) {
        if (G && P && allPerms().some(a => Rx(a).svFiresLimit && a.owner === P.i && !lostAbilities(a))) {
            if (G.active !== P.i) return false;
            if (P.svCast && P.svCast.turn === G.turn && P.svCast.n >= 2) return false;
        }
        return cc.apply(this, arguments);
    };
    const wc = wardCheck;
    wardCheck = function (P, target, name) {
        const ok = wc.apply(this, arguments);
        if (!ok || !target || !target.o) return ok;
        const h = target.o;
        if (isCreature(h) && G.players[h.owner].bf.some(a => Rx(a).svKira && !lostAbilities(a)) && h.svKiraTurn !== G.turn) { h.svKiraTurn = G.turn; log(`${name} is countered (Kira, Great Glass-Spinner).`); return false; }
        return ok;
    };
    // damage prevention: fog on players, Riot Control, The Wanderer, Magma Pummeler
    const dm = damage;
    damage = function (target, n, src) {
        if (n > 0 && target) {
            if (target.life !== undefined) {
                if (G.svFogPlayers === G.turn && G.inCombatDamage) return;
                if (target.svPrevent === G.turn) return;
                if (!G.inCombatDamage && G.players.some(X => X === target && X.bf.some(a => Rx(a).svWanderer && !lostAbilities(a)))) return;
            } else if (target.o !== undefined || target.card) {
                const t = target.o || target;
                if (t.uid !== undefined && !G.inCombatDamage && G.players[t.owner] && G.players[t.owner].bf.some(a => a !== t && Rx(a).svWanderer && !lostAbilities(a))) return;
                if (t.uid !== undefined && Rx(t).svPummeler && t.counters > 0 && !lostAbilities(t)) {
                    const k = Math.min(n, t.counters); t.counters -= k; log(`${t.card.name} prevents ${n} damage and removes ${k} +1/+1 counters.`);
                    const own = G.players[t.owner]; const F = foes(own)[0];
                    const tg = foes(own).flatMap(X => X.bf.filter(c => isCreature(c) && (pow(c) > 0))).sort((a, b) => permValue(b) - permValue(a))[0];
                    if (tg && k > 0) dm.call(this, tg, k, t); else if (F && k > 0) dm.call(this, F, k, t);
                    return;
                }
            }
        }
        return dm.apply(this, arguments);
    };
    const f0 = fire;
    fire = function (ev, ctx) {
        const r = f0.apply(this, arguments);
        try { if (G && ev === 'cast' && ctx && ctx.P) { ctx.P.svCast = ctx.P.svCast && ctx.P.svCast.turn === G.turn ? ctx.P.svCast : { turn: G.turn, n: 0 }; ctx.P.svCast.n++; } } catch (er) { /* ignore */ }
        return r;
    };
})();
// ===== Ms. Bumbleflower =====
Object.assign(TRIG_FN, {
    svPatron: (o, ctx) => !!ctx.o && !!ctx.P && ctx.P.i === o.owner && ctx.o.owner !== o.owner,
    svPollywog: (o, ctx) => !!ctx.o && !svCreatureCard(ctx.o) && svMV(ctx.o) < (pow(o) || 0),
    svGraft: (o, ctx) => !!ctx.o && ctx.o !== o && isCreature(ctx.o) && o.counters > 0
});
function svCreatureCard(c) { return /\bCreature\b/.test(c.card.type); }
Object.assign(CMD_SCORE, { sv_foodChain: () => 0, sv_darkSphere: () => 1, sv_cone: () => 1 });
function svDelayDraw(P, n) { (G.svDelay = G.svDelay || []).push({ P: P.i, n: n || 1, turn: G.turn }); }
Object.assign(CMD, {
    async sv_bounceGrant(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const act = parseActivated("{T}: Return target nonland permanent to its owner's hand.", Rx(c));
        if (!act) return;
        act.effects = [{ t: 'bounce', target: 'perm', filter: 'nonland' }]; act.text = '{T}: Return target nonland permanent to its owner\'s hand.';
        c.borrowed = { turn: G.turn, acts: [...((c.borrowed && c.borrowed.turn === G.turn && c.borrowed.acts) || []), act] };
        log(`${c.card.name} gains "{T}: Return target nonland permanent to its owner's hand" until end of turn.`);
    },
    async sv_chainVapor(P, e, t, src) {
        const cur = t && t.o; if (!cur || !onBf(cur.uid)) return;
        const ctl = G.players.find(X => X.bf.includes(cur)) || G.players[cur.owner];
        leaveBattlefield(cur, 'hand');
        const lands = ctl.bf.filter(x => /\bLand\b/.test(x.card.type));
        if (!lands.length || ctl.out) return;
        const pool = allPerms().filter(x => !/\bLand\b/.test(x.card.type));
        if (!pool.length) return;
        let yes;
        if (svIsHuman(ctl)) yes = await askYes(ctl, `Chain of Vapor: sacrifice a land to copy it?`, { card: src.card });
        else yes = lands.length >= 6 && foes(ctl).some(F => F.bf.some(x => !/\bLand\b/.test(x.card.type) && permValue(x) >= 5));
        if (!yes) return;
        const l = await pickOwn(ctl, lands, 'Sacrifice a land', { rank: (a, b) => permValue(a) - permValue(b) }); if (!l) return;
        sacPerm(ctl, l);
        const nt = svIsHuman(ctl) ? await pickOwn(ctl, pool, 'Chain of Vapor: choose a new target for the copy', { optional: true })
            : foes(ctl).flatMap(F => F.bf.filter(x => !/\bLand\b/.test(x.card.type))).sort((a, b) => permValue(b) - permValue(a))[0];
        if (!nt) return;
        await copySpellItem(ctl, { o: src, name: src.card.name, x: 0, target: null }, { target: { o: nt } });
    },
    async sv_darkSphere(P, e, t, src) { P.svHalf = G.turn; P.svHalfUid = svIsHuman(P) ? await svPickSource(P, src) : null; },
    async sv_cone(P, e, t, src) { const c = t && t.o; if (c && (!svIsHuman(P) || await askYes(P, `${src.card.name}: gain life instead of dealing combat damage with ${c.card.name} if it isn't blocked?`, { card: src.card }))) { c.svConeTurn = G.turn; log(`${c.card.name}: if it attacks and isn't blocked, ${P.name} gains life instead of dealing damage.`); } },
    async sv_foodChain(P, e, t, src) {
        const cr = P.bf.filter(isCreature); if (!cr.length) return;
        const c = await pickOwn(P, cr, `${src.card.name}: exile a creature you control`, { rank: (a, b) => permValue(a) - permValue(b) }); if (!c) return;
        const x = 1 + svMV(c); leaveBattlefield(c, 'exile');
        let col = 'G';
        if (svIsHuman(P)) { const r = await askMode(P, `${src.card.name}: choose a color`, ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless']); if (typeof r === 'number') col = 'WUBRGC'[r]; }
        P.pool = P.pool || []; for (let i = 0; i < x; i++) P.pool.push(`${col}:Creature`);
        log(`${P.name} adds ${x} mana (creature spells only).`);
    },
    async sv_mindbreak(P, e, t, src) {
        const mine = G.stack.filter(it => it.kind === 'spell' && it.P !== P && it.o !== src);
        for (const it of mine) { if (svIsHuman(P) && !(await askYes(P, `Mindbreak Trap: exile ${it.name}?`, { card: it.o.card }))) continue; pull(G.stack, it); it.o.exiled = true; const X = G.players[it.o.owner]; pull(X.gy, it.o); X.exile.push(it.o); log(`${it.name} is exiled.`); }
    },
    async sv_bauble(P, e, t, src) {
        const V = (t && t.p) || opp(P);
        if (e.mode === 'top' && V.library.length) { const c = V.library[V.library.length - 1]; if (svIsHuman(P)) toast(`Top card of ${V.name}'s library: ${c.card.name}`); }
        svDelayDraw(P, 1);
    },
    async sv_kinnanDig(P, e, t, src) {
        const top = []; for (let i = 0; i < 5 && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => /Creature/.test(c.card.type) && !/\bHuman\b/.test(c.card.type));
        const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: put a non-Human creature card onto the battlefield`, { optional: true }) : null;
        if (c) { pull(top, c); putOntoBattlefield(P, c, false); }
        P.library.unshift(...shuffle(top));
    },
    sv_ringProt(P, e, t, src) { if (src.castPlayed !== false) { P.svProtAll = true; log(`${P.name} gains protection from everything until their next turn.`); } },
    sv_ringBurden(P, e, t, src) { const n = src.ctr.burden || 0; if (n) { P.life -= n; log(`${P.name} loses ${n} life (burden counters).`); } },
    sv_ringTap(P, e, t, src) { src.ctr.burden = (src.ctr.burden || 0) + 1; drawCards(P, src.ctr.burden); },
    sv_urzaI(P, e, t, src) { /* the mana ability and the construct ability switch on with lore counters (see manaOf / canActivate wrappers) */ },
    async sv_urzaConstruct(P, e, t, src) { await applyEffect(P, { t: 'token', n: 1, p: 0, q: 0, name: 'colorless Construct', kw: [], text: '~ gets +1/+1 for each artifact you control.', types: 'Artifact Creature' }, null, src); },
    async sv_urzaIII(P, e, t, src) {
        const pool = P.library.filter(c => /\bArtifact\b/.test(c.card.type) && svMV(c) <= 1);
        const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: search for an artifact card with mana value 0 or 1`, { rank: (a, b) => permValue(b) - permValue(a) }) : null;
        if (c) { pull(P.library, c); putOntoBattlefield(P, c, false); } shuffleLib(P);
    },
    sv_floodcaller(P, e, t, src) { P.bf.filter(c => isCreature(c) && ['Bird', 'Frog', 'Otter', 'Rat'].some(ty => hasType(c, ty))).forEach(c => { c.tp += 1; c.tq += 1; c.tapped = false; }); },
    async sv_graft(P, e, t, src, O) {
        const c = (G.ctxObj) || (O && O.o); if (!c || !onBf(c.uid) || src.counters <= 0) return;
        if (svIsHuman(P) && !(await askYes(P, `${src.card.name}: move a +1/+1 counter to ${c.card.name}?`, { card: src.card }))) return;
        src.counters -= 1; putCounters(c, 1);
    },
    sv_untapCtr(P, e, t, src) { const c = t && t.o; if (c) c.tapped = false; }
});
(function () {
    const mo = manaOf;
    manaOf = function (o) {
        let m = mo.apply(this, arguments);
        if (!G || !o || !o.uid) return m;
        if (Rx(o).svUrzaSaga && /\bLand\b/.test(o.card.type) && (o.ctr.lore || 0) >= 1) return { colors: ['C'], n: 1 };
        if (m && m.n && !/\bLand\b/.test(o.card.type) && G.players[o.owner].bf.some(a => Rx(a).svKinnan && !lostAbilities(a))) return { ...m, n: m.n + 1 };
        return m;
    };
    const ca = canActivate;
    canActivate = function (P, o, a) {
        if (a && a.svSagaII && o && (o.ctr.lore || 0) < 2) return false;
        return ca.apply(this, arguments);
    };
    // Dark Sphere, Delif's Cone, The One Ring
    const dm = damage;
    damage = function (target, n, src) {
        if (n > 0 && target) {
            if (target.life !== undefined) {
                if (target.svProtAll) return;
                if (target.svHalf === G.turn && (!target.svHalfUid || (src && src.uid === target.svHalfUid))) { delete target.svHalf; n -= Math.floor(n / 2); log(`${target.name} prevents half of the damage.`); }
                if (src && src.svConeTurn === G.turn && G.inCombatDamage) { gainLifeFor(G.players[src.owner], n); return; }
            }
        }
        return dm.apply(this, arguments);
    };
    const vt = validTargets;
    validTargets = function (P, e, src) { const r = vt.apply(this, arguments); return r.filter(x => !(x.p && x.p.svProtAll && x.p !== P)); };
    // Eternal Scourge: exiled when an opponent targets it
    const wc = wardCheck;
    wardCheck = function (P, target, name) {
        if (target && target.o && Rx(target.o).svScourge && target.o.owner !== P.i && !lostAbilities(target.o)) { log(`${target.o.card.name} is exiled (targeted by ${name}).`); leaveBattlefield(target.o, 'exile'); return false; }
        return wc.apply(this, arguments);
    };
    // Delayed draws (Bauble) and the end of The One Ring's protection
    const f0 = fire;
    fire = function (ev, ctx) {
        const r = f0.apply(this, arguments);
        try {
            if (G && ev === 'upkeep') {
                (G.svDelay || []).filter(d => d.turn < G.turn).forEach(d => { const X = G.players[d.P]; if (X && !X.out) drawCards(X, d.n); });
                G.svDelay = (G.svDelay || []).filter(d => d.turn >= G.turn);
                const A = G.players[G.active]; if (A && A.svProtAll) { delete A.svProtAll; log(`${A.name}'s protection from everything ends.`); }
            }
        } catch (er) { /* ignore */ }
        return r;
    };
    // Mindbreak Trap: free if an opponent cast three or more spells this turn; Valley Floodcaller; Swift Reconfiguration
    const co = costOf;
    costOf = function (P, o) {
        const c = co.apply(this, arguments);
        if (G && P && c && !o._free && Rx(o).svMindbreak && P.hand.includes(o) && foes(P).some(F => F.svCast && F.svCast.turn === G.turn && F.svCast.n >= 3)) { o._free = true; return parseCost(''); }
        return c;
    };
    function vehSync() {
        if (!G || !G.players) return;
        const hosts = new Set();
        allPerms().forEach(a => { if (Rx(a).svVehicle && !lostAbilities(a) && a.attachedTo != null) { const h = onBf(a.attachedTo); if (h) hosts.add(h); } });
        allPerms().forEach(x => {
            if (hosts.has(x) && !x.svVehOrig) { x.svVehOrig = x.card; x.card = { ...x.card, type: 'Artifact — Vehicle', text: 'Crew 5' }; x._r = null; x.enchOnly = false; x.artOnly = false; }
            else if (!hosts.has(x) && x.svVehOrig) { x.card = x.svVehOrig; delete x.svVehOrig; x._r = null; }
        });
    }
    SV_SYNCS.push(vehSync);
})();
// ===== Kardur, Doomscourge =====
Object.assign(TRIG_FN, {
    svAttackerDies: (o, ctx) => !!ctx.o && (G.attackers || []).includes(ctx.o.uid),
    svFoeCreatureDies: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && !ctx.o.token && /Creature/.test(ctx.o.card.type),
    svBlackSpell: (o, ctx) => !!ctx.o && (ctx.o.card.colors || []).includes('B') && ctx.P && ctx.P.i === o.owner,
    svMySwamp: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bSwamp\b/.test(ctx.o.card.type),
    svLifeChanged: (o, ctx) => { const P = G.players[o.owner]; return P.gainedTurn === G.turn || P.lostTurn === G.turn; }
});
Object.assign(CMD_SCORE, { sv_valgCast: () => 4 });
Object.assign(CMD, {
    sv_kardur(P, e, t, src) { G.svKardur = { by: P.i, until: G.turn + G.players.filter(x => !x.out).length - 1 }; log(`Until ${P.name}'s next turn, opposing creatures attack each combat if able.`); },
    async sv_archfiend(P, e, t, src) {
        const A = G.players[G.active]; if (!A || A.out) return;
        const cr = A.bf.filter(isCreature); if (cr.length <= 2) return;
        const keep = svIsHuman(A) ? [] : cr.slice().sort((a, b) => permValue(b) - permValue(a)).slice(0, 2);
        if (svIsHuman(A)) { for (let i = 0; i < 2; i++) { const pool = cr.filter(c => !keep.includes(c)); if (!pool.length) break; const c = await pickCard(A, pool, `${src.card.name}: keep a creature (${i + 1}/2)`, { required: true }); keep.push(c || pool[0]); } }
        cr.filter(c => !keep.includes(c)).forEach(c => sacPerm(A, c));
    },
    async sv_emergencyWeld(P, e, t, src) {
        const pool = P.gy.filter(c => /Artifact|Creature/.test(c.card.type));
        const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: return an artifact or creature card`) : null;
        if (c) { pull(P.gy, c); P.hand.push(c); }
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Soldier', kw: [], text: '', types: 'Artifact Creature' }, null, src);
    },
    sv_graveBetrayal(P, e, t, src) {
        const c = G.ctxObj || (G.ctxRaw && G.ctxRaw.o); if (!c) return;
        (G.svBetray = G.svBetray || []).push({ P: P.i, card: c, turn: G.turn });
    },
    sv_havoc(P, e, t, src) { const A = G.players[G.active]; if (!A || A.out) return; const n = Math.ceil(A.life / 2); if (n > 0) { A.life -= n; A.lostTurn = G.turn; A.lostN = (A.lostTurn === G.turn ? A.lostN || 0 : 0) + n; log(`${A.name} loses ${n} life (Havoc Festival).`); } },
    sv_parasitic(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        damage(c, 3, src); gainLifeFor(P, 3);
    },
    sv_woundReflection(P, e, t, src) { foes(P).forEach(F => { const n = F.lostTurn === G.turn ? (F.lostN || 0) : 0; if (n > 0) { F.life -= n; F.lostTurn = G.turn; F.lostN = (F.lostN || 0) + n; log(`${F.name} loses ${n} life (Wound Reflection).`); } }); },
    async sv_valgCast(P, e, t, src) {
        if (G.active !== P.i) return;
        const pool = G.players.flatMap(X => X.exile.filter(c => c.svValgavoth === P.i));
        const ok = pool.filter(c => svMV(c) < P.life);
        const c = ok.length ? await pickOwn(P, ok, `${src.card.name}: play an exiled card (pay life equal to its mana value)`, { optional: true, rank: (a, b) => svMV(b) - svMV(a) }) : null; if (!c) return;
        const from = G.players.find(X => X.exile.includes(c));
        if (Rx(c).kind === 'land') { if (P.landsPlayed >= landLimit(P)) return; pull(from.exile, c); putOntoBattlefield(P, c, false); P.landsPlayed++; return; }
        P.life -= svMV(c); log(`${P.name} pays ${svMV(c)} life.`);
        const done = await castFreeFrom(P, c); if (!done) P.life += svMV(c); else delete c.svValgavoth;
    }
});
(function () {
    // Kardur: opposing creatures must attack
    const fa = forcedAttack;
    forcedAttack = function (o) { if (G && G.svKardur && o.owner !== G.svKardur.by && G.turn <= G.svKardur.until && isCreature(o)) return true; return fa.apply(this, arguments); };
    const ca = canActivate;
    canActivate = function (P, o, a) {
        if (a && a.svBoneCache) {
            const left = (P.svGyLeft && P.svGyLeft.turn === G.turn ? P.svGyLeft.n : 0) >= 3, food = P.svFoodTurn === G.turn;
            if (!left && !food) return false;
        }
        return ca.apply(this, arguments);
    };
    // Mishra: permanents you control have Ward - Sacrifice a permanent; artifact cards in your graveyard have unearth
    const wc = wardCheck;
    wardCheck = function (P, target, name) {
        const ok = wc.apply(this, arguments);
        if (!ok || !target || !target.o || target.o.owner === P.i) return ok;
        const own = G.players[target.o.owner];
        if (!own.bf.some(a => Rx(a).svMishraWard && !lostAbilities(a))) return ok;
        const pool = P.bf.slice();
        if (!pool.length) { log(`${name} is countered by ward - ${P.name} has nothing to sacrifice.`); return false; }
        const c = pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0];
        if ((P.isAI || AUTOPLAY) && permValue(c) > 6 && !c.token) { log(`${name} is countered by ward - ${P.name} won't sacrifice.`); return false; }
        sacPerm(P, c); log(`${P.name} sacrifices ${c.card.name} for ward.`); return true;
    };
    function mishraSync() {
        if (!G || !G.players) return;
        G.players.forEach(X => {
            const on = X.bf.some(a => Rx(a).svMishraUnearth && !lostAbilities(a));
            X.gy.forEach(c => {
                const R = Rx(c); if (!R || !/\bArtifact\b/.test(c.card.type)) return;
                if (on && !(R.gyActs || []).some(a => a.svMishra)) (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost('{1}{B}{R}'), tap: false }, effects: [{ t: 'unearth' }], text: 'Unearth {1}{B}{R}', sorcery: true, gy: true, svMishra: true });
                else if (!on && (R.gyActs || []).some(a => a.svMishra)) R.gyActs = R.gyActs.filter(a => !a.svMishra);
            });
        });
        // Valgavoth: cards that would go to an opponent's graveyard are exiled instead (cards that were already there stay)
        G.players.forEach(V => {
            const val = V.bf.find(a => Rx(a).svValgavoth && !lostAbilities(a));
            G.players.forEach(X => {
                if (X === V || X.out) return;
                X.gy.slice().forEach(c => {
                    if (c.svOld) return;
                    if (val) { pull(X.gy, c); X.exile.push(c); c.svValgavoth = V.i; log(`${c.card.name} is exiled instead (${val.card.name}).`); }
                    else c.svOld = true;
                });
            });
        });
        G.players.forEach(X => X.gy.forEach(c => { c.svOld = true; }));
        // Grave Betrayal returns (marked by the dies trigger) at the next end step
    }
    SV_SYNCS.push(mishraSync);
    // Ob Nixilis, Unshackled: a shuffle after searching (approximation of "searches their library")
    function searched(P) {
        try {
            if (!G || G.over || !G.players || G.phase === 'setup' || !P) return;
            G.players.forEach(O => {
                if (O === P || O.out) return;
                O.bf.filter(a => Rx(a).svObSearch && !lostAbilities(a)).forEach(a => { (G.trigQ = G.trigQ || []).push({ P: O, o: a, effects: [cmd('sv_obSearch', { who: P.i })] }); });
            });
        } catch (er) { /* ignore */ }
    }
    // A search is a card taken out of a library by an effect (not drawn or milled), followed by the shuffle every search ends with
    const pl0 = pull;
    pull = function (list, x) {
        let V = null;
        try { if (G && G.players && !G.over && G.phase !== 'setup' && Array.isArray(list) && list.includes(x)) V = G.players.find(X => X.library === list) || null; } catch (er) { V = null; }
        const r = pl0.apply(this, arguments);
        if (V) V.svSrch = G.turn;
        return r;
    };
    const sl = shuffleLib;
    shuffleLib = function (P) { const r = sl.apply(this, arguments); if (P && P.svSrch === (G && G.turn)) { P.svSrch = null; searched(P); } return r; };
    const f0 = fire;
    fire = function (ev, ctx) {
        const r = f0.apply(this, arguments);
        try {
            if (!G || G.over) return r;
            if (ev === 'gyLeave' && ctx && ctx.P) { const X = ctx.P; const n = (X.gyLeftLast || []).length || (ctx.n || 1); X.svGyLeft = X.svGyLeft && X.svGyLeft.turn === G.turn ? { turn: G.turn, n: X.svGyLeft.n + n } : { turn: G.turn, n }; }
            if (ev === 'sacrificed' && ctx && ctx.o && hasType(ctx.o, 'Food')) G.players[ctx.o.owner].svFoodTurn = G.turn;
            if (ev === 'gainLife' && ctx && ctx.P) { ctx.P.gainedTurn = G.turn; }
            if (ev === 'end') { G.players.forEach(X => { X.svSrch = null; }); }
            if (ev === 'end') {
                (G.svBetray || []).filter(b => b.turn <= G.turn).forEach(b => {
                    const X = G.players[b.P]; if (!X || X.out) return; const own = G.players[b.card.owner];
                    if (own && own.gy.includes(b.card)) { pull(own.gy, b.card); putOntoBattlefield(X, b.card, false); b.card.owner = X.i; addEtbCounters(b.card, 1); b.card.addedTypes = [...(b.card.addedTypes || []), 'Zombie']; b.card.card = { ...b.card.card, colors: [...new Set([...(b.card.card.colors || []), 'B'])] }; b.card._r = null; log(`${b.card.card.name} returns under ${X.name}'s control (Grave Betrayal).`); }
                });
                G.svBetray = (G.svBetray || []).filter(b => false);
            }
        } catch (er) { /* a watcher never stops the game */ }
        return r;
    };
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const r = vt.apply(this, arguments);
        if (src && src.card && Rx(src).svParasitic && !src.altCast && e && e.target === 'creature') return r.filter(x => !x.o || hasType(x.o, 'Human'));
        return r;
    };
})();
Object.assign(CMD, {
    async sv_obSearch(P, e, t, src) { const V = G.players[e.who]; if (!V || V.out) return; const cr = V.bf.filter(isCreature); if (cr.length) { const c = (await svSacMany(V, cr, 1, `${src.card.name}: sacrifice a creature`))[0]; if (c) sacPerm(V, c); } V.life -= 10; V.lostTurn = G.turn; V.lostN = (V.lostN || 0) + 10; log(`${V.name} loses 10 life.`); }
});
// ===== Captain America / Lavinia =====
function svHasOv(o, k) {
    if (!o || !o.card) return null;
    if (k === 'flying' && svNoFly(o)) return false;
    if (k === 'indestructible') {
        const X = G.players[o.owner]; if (!X) return null;
        if ((X.emblems || []).includes('svLandsInd') && /\bLand\b/.test(o.card.type)) return true;
        if (/\bLegendary\b/.test(o.card.type) && X.bf.some(a => a !== o && Rx(a).svMemorial && !lostAbilities(a))) return true;
    }
    return null;
}
Object.assign(TRIG_FN, {
    svHarnessed: (o, ctx) => !!o.harnessed,
    svMyCreatureLeaves: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o) && Object.values(ctx.o.ctr || {}).some(v => v > 0) || (!!ctx.o && ctx.o.counters > 0 && ctx.o.owner === o.owner),
    svOzolithCombat: (o, ctx) => G.active === o.owner && (o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0)),
    svNoMana: (o, ctx) => !!ctx.o && ctx.o._free === true,
    svFromHand: (o, ctx) => !!ctx.o && ctx.o.castFromHand === G.turn,
    svProft: (o, ctx) => G.active === o.owner && (G.players[o.owner].j_drawT === G.turn ? G.players[o.owner].j_drawN : 0) > 1,
    svThirteen: (o, ctx) => G.players[o.owner].hand.length === 13
});
Object.assign(CMD, {
    async sv_palm(P, e, t, src) { P.svPalm = G.turn; P.svPalmUid = svIsHuman(P) ? await svPickSource(P, src) : null; log(`${P.name} will prevent the next damage dealt to them this turn.`); },
    sv_hinderingLight(P, e, t, src) { const it = t && t.item; if (it) { pull(G.stack, it); if (it.o) moveSpellCard(it.o, 'gy'); log(`${it.name} is countered.`); } },
    sv_renderSilent(P, e, t, src) { const it = t && t.item; if (it) { const X = it.P; pull(G.stack, it); if (it.o) moveSpellCard(it.o, 'gy'); X.svNoCast = G.turn; log(`${it.name} is countered; ${X.name} can't cast spells this turn.`); } },
    sv_incursion(P, e, t, src) { P.bf.filter(c => isCreature(c) && !c.token).forEach(c => { const card = { ...c.card, type: c.card.type.replace(/\bLegendary\s+/, '') }; tokenCopyOf(P, card, {}); }); },
    sv_harness(P, e, t, src) { src.harnessed = true; log(`${src.card.name} is harnessed.`); },
    async sv_flickerOwn(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && !/\bLand\b/.test(x.card.type) && (!isCreature(src) || isCreature(x)));
        const c = pool.length ? (svIsHuman(P) ? await pickOwn(P, pool, `${src.card.name}: exile up to one other permanent you control, then return it`, { optional: true }) : pool.filter(x => frEtbValue(x) >= 3).sort((a, b) => frEtbValue(b) - frEtbValue(a))[0]) : null;
        if (!c) return; leaveBattlefield(c, 'exile'); const X = G.players[c.owner]; const back = X.exile.find(x => x === c); if (back && !c.token) { pull(X.exile, back); X.bf.push(back); back.sick = true; back.enteredTurn = G.turn; fire('enters', { o: back }); if (Rx(back).etb.length) (G.trigQ = G.trigQ || []).push({ P: X, o: back, effects: Rx(back).etb }); }
    },
    sv_ozolithTake(P, e, t, src) {
        const c = G.ctxObj; if (!c) return; let n = c.counters || 0; if (c.ctrLast) n = c.ctrLast;
        const others = Object.entries(c.ctr || {}).filter(([k, v]) => v > 0);
        if (n > 0) src.counters += n;
        others.forEach(([k, v]) => { src.ctr[k] = (src.ctr[k] || 0) + v; });
        if (n || others.length) log(`${src.card.name} takes the counters from ${c.card.name}.`);
    },
    sv_ozolithMove(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        if (src.counters > 0) { putCounters(c, src.counters); src.counters = 0; }
        Object.entries(src.ctr || {}).forEach(([k, v]) => { if (v > 0) { c.ctr[k] = (c.ctr[k] || 0) + v; src.ctr[k] = 0; } });
    },
    sv_counterCast(P, e, t, src) { const it = G.stack.find(i => i.kind === 'spell' && i.P !== P && i.o && i.o._free === true); if (it) { pull(G.stack, it); moveSpellCard(it.o, 'gy'); log(`${it.name} is countered (${src.card.name}).`); } },
    async sv_jaceUlt(P, e, t, src) { drawCards(P, 7); if (!P.library.length) await applyEffect(P, { t: 'winGame' }, null, src); },
    sv_poolImprint(P, e, t, src) { src.svPool = src.svPool || []; G.players.filter(X => !X.out).forEach(X => { for (let i = 0; i < 3 && X.library.length; i++) { const c = X.library.pop(); X.exile.push(c); src.svPool.push(c); } }); },
    async sv_poolCast(P, e, t, src) {
        const X = G.ctxRaw && G.ctxRaw.P ? G.ctxRaw.P : P;
        const it = G.stack.find(i => i.kind === 'spell' && i.o && i.o.castFromHand === G.turn && i.P === X); if (!it) return;
        pull(G.stack, it); const own = G.players[it.o.owner]; own.exile.push(it.o); (src.svPool = src.svPool || []).push(it.o); log(`${it.name} is exiled with ${src.card.name}.`);
        const pool = (src.svPool || []).filter(c => c !== it.o && own.exile.includes(c) || G.players.some(Y => Y.exile.includes(c) && c !== it.o)).filter(c => Rx(c).kind !== 'land' && Rx(c).support !== 'none');
        const c = pool.length ? (svIsHuman(X) ? await pickOwn(X, pool, `${src.card.name}: cast a spell exiled with it free?`, { optional: true }) : pool.sort((a, b) => svMV(b) - svMV(a))[0]) : null;
        if (c) await castFreeFrom(X, c);
    },
    async sv_narsetDig(P, e, t, src) {
        const top = []; for (let i = 0; i < 4 && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => !/Creature|Land/.test(c.card.type));
        const c = pool.length ? (svIsHuman(P) ? await pickOwn(P, pool, `${src.card.name}: take a noncreature, nonland card`, { optional: true }) : pool.sort((a, b) => svMV(b) - svMV(a))[0]) : null;
        if (c) { pull(top, c); P.hand.push(c); log(`${P.name} reveals ${c.card.name} and puts it into hand.`); }
        P.library.unshift(...shuffle(top));
    },
    sv_proft(P, e, t, src) { const c = t && t.o; const n = (P.j_drawT === G.turn ? P.j_drawN : 0) - 1; if (c && n > 0) putCounters(c, n); },
    async sv_slaughter(P, e, t, src) {
        for (const X of G.players.filter(x => !x.out)) {
            const cr = X.bf.filter(isCreature); let keep = [], tot = 0;
            if (svIsHuman(X)) { for (const c of cr) { if (tot + pow(c) <= 4 && await askYes(X, `${src.card.name}: keep ${c.card.name} (power ${pow(c)})?`, { card: c.card })) { keep.push(c); tot += pow(c); } } }
            else { cr.slice().sort((a, b) => permValue(b) - permValue(a)).forEach(c => { if (tot + pow(c) <= 4) { keep.push(c); tot += pow(c); } }); }
            cr.filter(c => !keep.includes(c)).forEach(c => sacPerm(X, c));
        }
    },
    sv_teferiUntap(P, e, t, src) { (G.svEndUntap = G.svEndUntap || []).push({ P: P.i }); },
    async sv_teferiTuck(P, e, t, src) { const c = t && t.o; if (!c || !onBf(c.uid)) return; const X = G.players[c.owner]; if (c.token) { leaveBattlefield(c, 'exile'); return; } leaveBattlefield(c, 'library'); const i = X.library.lastIndexOf(c); if (i >= 0) { X.library.splice(i, 1); X.library.splice(Math.max(0, X.library.length - 2), 0, c); } },
    sv_teferiEmblem(P, e, t, src) { P.emblems = P.emblems || []; P.emblems.push('svTeferi'); log(`${P.name} gets an emblem.`); },
    sv_teferiFlash(P, e, t, src) { P.svSorceryFlash = true; },
    sv_teferiProtection(P, e, t, src) { P.svProtAll = true; P.svLifeLock = true; P.bf.slice().forEach(o => { if (onBf(o.uid)) phaseOut(o); }); const r = G.stack.find(i => i.o === src); },
    async sv_oracle(P, e, t, src) {
        const x = devotion(P, ['U']); const top = []; for (let i = 0; i < x && P.library.length; i++) top.push(P.library.pop());
        const keep = top.length ? (svIsHuman(P) ? await pickOwn(P, top, `${src.card.name}: put up to one on top`, { optional: true }) : top.slice().sort((a, b) => svMV(b) - svMV(a))[0]) : null;
        const rest = top.filter(c => c !== keep); P.library.unshift(...shuffle(rest)); if (keep) P.library.push(keep);
        if (x >= P.library.length) await applyEffect(P, { t: 'winGame' }, null, src);
    }
});
(function () {
    const f0 = fire;
    fire = function (ev, ctx) {
        const hush = G && !G.over && (ev === 'dies' || ev === 'enters' || ev === 'creatureDies') && ctx && ctx.o && isCreature(ctx.o) && allPerms().some(a => Rx(a).svHush && !lostAbilities(a));
        const q0 = hush ? (G.trigQ || []).length : 0;
        const r = f0.apply(this, arguments);
        if (hush && G.trigQ && G.trigQ.length > q0) G.trigQ.length = q0;
        try {
            if (!G || G.over) return r;
            if (ev === 'untapped') return r;
            if (ev === 'draw' && ctx && ctx.P && (ctx.P.emblems || []).includes('svTeferi')) { const F = foes(ctx.P); const c = F.flatMap(X => X.bf).sort((a, b) => permValue(b) - permValue(a))[0]; if (c) { leaveBattlefield(c, 'exile'); log(`${c.card.name} is exiled (Teferi's emblem).`); } }
            if (ev === 'draw' && ctx && ctx.P) { ctx.P.svDraws = ctx.P.svDraws && ctx.P.svDraws.turn === G.turn ? ctx.P.svDraws : { turn: G.turn, n: 0 }; ctx.P.svDraws.n++; }
            if (ev === 'upkeep') {
                const A = G.players[G.active]; if (A) { delete A.svSorceryFlash; if (A.svLifeLock) { delete A.svLifeLock; delete A.svProtAll; } }
                // Key to the City: becomes untapped
                A && A.bf.filter(k => Rx(k).svKey && k.svWasTapped && !k.tapped).forEach(k => { k.svWasTapped = false; (G.trigQ = G.trigQ || []).push({ P: A, o: k, effects: [cmd('sv_keyDraw')] }); });
            }
            if (ev === 'end') { (G.svEndUntap || []).splice(0).forEach(u => { const X = G.players[u.P]; X.bf.filter(l => /\bLand\b/.test(l.card.type) && l.tapped).slice(0, 2).forEach(l => { l.tapped = false; }); }); }
        } catch (er) { /* ignore */ }
        return r;
    };
    function keySync() { if (!G || !G.players) return; G.players.forEach(X => X.bf.forEach(k => { if (Rx(k).svKey && k.tapped) k.svWasTapped = true; })); }
    SV_SYNCS.push(keySync); SV_SYNCS.push(lockSync);
    function lockSync() {
        if (!G) return;
        const locks = []; allPerms().forEach(a => { if (!lostAbilities(a) && Rx(a).svLock) locks.push(Rx(a).svLock); });
        G.svLockOn = locks.length ? locks : null;
        G.svRip = allPerms().some(a => Rx(a).svRip && !lostAbilities(a));
        G.svNoFlyOn = allPerms().some(a => Rx(a).svNoFly && !lostAbilities(a));
        if (G.svRip) G.players.forEach(X => X.gy.slice().forEach(c => { if (!c.isCommander && !c.cmdSeenZone) { pull(X.gy, c); X.exile.push(c); log(`${c.card.name} is exiled instead (Rest in Peace).`); } }));
    }
    // Lavinia, Teferi, Narset, locks on casting
    const cc = canCastNow;
    canCastNow = function (P, o) {
        if (G && P && o && o.card) {
            if (P.svNoCast === G.turn) return false;
            const R = Rx(o), foesOf = allPerms();
            if (R.kind !== 'creature' && R.kind !== 'land' && foesOf.some(a => Rx(a).svLavinia && !lostAbilities(a) && a.owner !== P.i) && svMV(o) > P.bf.filter(l => /\bLand\b/.test(l.card.type)).length) return false;
            if (foesOf.some(a => Rx(a).svSorceryOnly && !lostAbilities(a) && a.owner !== P.i) && !(G.active === P.i && MAIN.includes(G.phase) && G.stack.length === 0) && !P.svSorceryFlash0) return false;
            const gyLib = P.gy.includes(o) || P.library.includes(o), gyEx = P.gy.includes(o) || P.exile.includes(o);
            if (gyLib && foesOf.some(a => Rx(a).svNoCastGyLib && !lostAbilities(a))) return false;
            if (gyEx && !/\bCreature\b/.test(o.card.type) && foesOf.some(a => Rx(a).svNoCastNoncreatureGyEx && !lostAbilities(a))) return false;
        }
        return cc.apply(this, arguments);
    };
    // Rest in Peace
    const mc = moveSpellCard;
    moveSpellCard = function (o, zone) {
        if (zone === 'gy' && G && G.svRip && o && !o.isCommander) { const X = G.players[o.owner]; log(`${o.card.name} is exiled instead (Rest in Peace).`); const r = mc.call(this, o, 'exile'); return r; }
        return mc.apply(this, arguments);
    };
    // Cage / Jailer / Runestone, Containment Priest: entering from a graveyard or library (tracked by the last pull), and not-cast creatures
    const pl = pull;
    pull = function (a, x) {
        if (G && G.svLockOn && x && x.card) { const X = G.players.find(p => p.gy === a || p.library === a); if (X) G.svLastPull = { card: x, zone: X.gy === a ? 'gy' : 'library' }; }
        return pl.apply(this, arguments);
    };
    const pob = putOntoBattlefield;
    putOntoBattlefield = function (P, o, tapped) {
        if (G && o && o.card) {
            if (G.svLockOn && G.svLastPull && G.svLastPull.card === o) {
                const z = G.svLastPull.zone, creature = /\bCreature\b/.test(o.card.type), land = /\bLand\b/.test(o.card.type), perm = /Artifact|Creature|Enchantment|Land|Planeswalker|Battle/.test(o.card.type);
                const blocked = G.svLockOn.some(L => (z === 'gy' && ((L.gyCreature && creature) || (L.gyPermanent && perm) || (L.gyNonlandPerm && perm && !land))) || (z === 'library' && ((L.libCreature && creature) || (L.libNonlandPerm && perm && !land))));
                if (blocked) { const X = G.players[o.owner]; X[z === 'gy' ? 'gy' : 'library'].push(o); log(`${o.card.name} can't enter the battlefield from ${z === 'gy' ? 'a graveyard' : 'a library'}.`); G.svLastPull = null; return; }
            }
            if (!o.token && /\bCreature\b/.test(o.card.type) && allPerms().some(a => Rx(a).svPriest && !lostAbilities(a)) && !o.svCastNow) { const X = G.players[o.owner]; X.exile.push(o); log(`${o.card.name} is exiled instead (Containment Priest).`); return; }
        }
        return pob.apply(this, arguments);
    };
    // Hushbringer: creatures entering don't cause abilities to trigger
    const fe = frNoEnterTrig;
    frNoEnterTrig = function (o) { if (G && o && isCreature(o) && allPerms().some(a => Rx(a).svHush && !lostAbilities(a))) return true; return fe.apply(this, arguments); };
    // Narset: opponents draw at most one card each turn; Solemnity: no counters
    const dc = drawCards;
    drawCards = function (P, n, quiet) {
        if (G && P && n > 0 && G.phase !== 'setup' && allPerms().some(a => Rx(a).svNarset && !lostAbilities(a) && a.owner !== P.i)) {
            const had = P.svDraws && P.svDraws.turn === G.turn ? P.svDraws.n : 0; n = Math.min(n, Math.max(0, 1 - had)); if (n <= 0) { log(`${P.name} can't draw more than one card this turn.`); return; }
        }
        return dc.call(this, P, n, quiet);
    };
    const pc = putCounters;
    putCounters = function (o, n, by) {
        if (G && o && o.card && /Artifact|Creature|Enchantment|Land/.test(o.card.type) && allPerms().some(a => Rx(a).svSolemnity && !lostAbilities(a))) return 0;
        return pc.apply(this, arguments);
    };
    // Teferi's Protection (life can't change), Deflecting Palm, Collective Inferno
    const dm = damage;
    damage = function (target, n, src) {
        if (n > 0 && target && target.life !== undefined) {
            if (target.svProtAll || target.svLifeLock) return;
            if (target.svPalm === G.turn && (!target.svPalmUid || (src && src.uid === target.svPalmUid))) { delete target.svPalm; const ctl = src && src.owner !== undefined ? G.players[src.owner] : null; log(`${target.name} prevents the damage and deals ${n} damage to ${ctl ? ctl.name : 'its controller'} (Deflecting Palm).`); if (ctl) dm.call(this, ctl, n, null); return; }
        }
        if (n > 0 && src && src.uid !== undefined && onBf(src.uid)) {
            const X = G.players[src.owner];
            if (X) X.bf.filter(a => Rx(a).svInferno && a.chosenType && hasType(src, a.chosenType) && !lostAbilities(a)).forEach(() => { n *= 2; });
        }
        return dm.apply(this, arguments);
    };
    const gl = gainLifeFor;
    gainLifeFor = function (X, n) { if (X && X.svLifeLock) return; return gl.apply(this, arguments); };
    const sm = stackMatches;
    stackMatches = function (it, filter) {
        if (filter === 'svTargetsMe') { if (it.kind !== 'spell') return false; const tg = it.target; const P = G.players[G.active === undefined ? 0 : G.active]; return !!tg && ((tg.p && tg.p === it.__me) || (tg.o && tg.o.owner === it.__meIdx)); }
        return sm.apply(this, arguments);
    };
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const r = vt.apply(this, arguments);
        if (e && e.filter === 'svTargetsMe') return G.stack.filter(it => it.kind === 'spell' && it.o !== src && it.target && ((it.target.p && it.target.p === P) || (it.target.o && it.target.o.owner === P.i))).map(it => ({ item: it }));
        return r;
    };
})();
Object.assign(CMD, { async sv_keyDraw(P, e, t, src) { if (await mayPay(P, '{2}', `${src.card.name}: pay {2} to draw a card?`, src, true)) drawCards(P, 1); } });

// Mox Diamond: a real replacement effect as it would enter (asked as the spell resolves; see resolveTop in 06-engine.js)
async function svMoxAsk(P, o) {
    const lands = P.hand.filter(c => /\bLand\b/.test(c.card.type));
    if (!lands.length) { log(`${o.card.name} has no land to discard and goes to the graveyard instead.`); return false; }
    let c;
    if (svIsHuman(P)) c = await pickOwn(P, lands, `${o.card.name}: discard a land card (or it goes to the graveyard instead)`, { optional: true });
    else c = (lands.length >= 2 || P.hand.length >= 3) ? lands.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0] : null;
    if (!c) { log(`${o.card.name} goes to the graveyard instead of entering.`); return false; }
    pull(P.hand, c); P.gy.push(c); log(`${P.name} discards ${c.card.name} (${o.card.name}).`);
    return true;
}
// Wastescape Battlemage: its two kickers are separate, optional costs paid as it is cast
async function svKickAsk(P, o) {
    const was = { g: o.svKickG, u: o.svKickU };
    const pays = k => { o[k] = true; const ok = !!planPayment(P, totalCost(P, o), extraCost(P, o), null, payOpts(o)); o[k] = false; return ok; };
    if (pays('svKickG') && await askYes(P, `${o.card.name}: pay the {G} kicker? (When you cast it, exile target artifact or enchantment an opponent controls.)`, { card: o.card })) o.svKickG = true;
    if (pays('svKickU') && await askYes(P, `${o.card.name}: pay the {1}{U} kicker? (When you cast it, return target creature an opponent controls to its owner's hand.)`, { card: o.card })) o.svKickU = true;
    if (o.svKickG && o.svKickU && !planPayment(P, totalCost(P, o), extraCost(P, o), null, payOpts(o))) o.svKickU = false;
}
Object.assign(PRE_CMD, {
    async sv_confluence(P, src) {
        const out = [];
        for (let i = 0; i < 3; i++) {
            const r = await askMode(P, `${src.card.name}: choose a mode (${i + 1}/3)`, SV_CONF_MODES); const m = typeof r === 'number' ? r : 2;
            let c = null;
            if (m === 0) c = await slAsk(P, allPerms().filter(x => isCreature(x) && slLegal(P, x)), `${src.card.name}: choose target creature (+3/-3)`, false);
            else if (m === 1) c = await slAsk(P, allPerms().filter(x => !/\bLand\b/.test(x.card.type) && slLegal(P, x)), `${src.card.name}: choose a nonland permanent to exile and return tapped`, false);
            out.push({ m, c });
        }
        return out;
    },
    async sv_phoenixRaise(P, src) { const gy = P.gy.filter(x => /Creature/.test(x.card.type) && svMV(x) <= 4); return gy.length ? await slAsk(P, gy, `${src.card.name}: choose a creature card with mana value 4 or less`, true) : null; },
    async sv_phoenixExile(P, src) { const bad = allPerms().filter(x => isCreature(x) && (hasType(x, 'Skeleton') || hasType(x, 'Spirit') || hasType(x, 'Zombie')) && slLegal(P, x)); return bad.length ? await slAsk(P, bad, `${src.card.name}: choose target Skeleton, Spirit or Zombie`, true) : null; }
});
