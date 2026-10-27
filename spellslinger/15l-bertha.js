// Engine pieces for the Big Bertha deck (2026-10-27). Wordings are in rules/bertha.js; each odd card is a CMD entry (ids start with bt_).
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.
// Uses pickOwn / makeFractal (15d-cmdr-soc.js), c_earthbend (15-cmdr300c.js), tkNamedLands (15j-trek.js), sacPerm (15k-cmdr300.js).

const btAI = P => P.isAI || AUTOPLAY;
const btAnyCtr = o => o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0);
STATIC_FN.bt_plus = o => o.counters > 0;
Object.assign(TRIG_FN, {
    bt_myLand: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    bt_hostHit: (o, ctx) => !!o.attachedTo && !!ctx.src && ctx.src.uid === o.attachedTo && (ctx.hit || []).some(X => X.i !== ctx.src.owner),
    bt_oozeLeaves: (o, ctx) => { const x = ctx.o; return !!x && x.owner === o.owner && isCreature(x) && ((G.ctxRaw && G.ctxRaw.lki && G.ctxRaw.lki.counters) || x.counters || 0) > 0; },
    // a creature with flying attacks me or a planeswalker I control
    bt_flyAtkMe: (o, ctx) => (ctx.list || []).some(x => x.owner !== o.owner && has(x, 'flying') && btAttacksMine(x, o))
});
function btAttacksMine(x, o) {
    if (x.attackPW) { const pw = onBf(x.attackPW); if (pw) return pw.owner === o.owner; }
    if (G.players.length === 2) return x.owner !== o.owner;
    return (x.atkTo !== undefined ? x.atkTo : G.defender) === o.owner;
}
// Mana: Bighorner Rancher (greatest power among your creatures), Incubation Druid (three mana with a counter)
{
    const base = manaOf;
    manaOf = function (o) {
        const m = base.apply(this, arguments);
        if (!m || !G || !o.uid) return m;
        if (m.nGreat) { const n = Math.max(0, ...G.players[o.owner].bf.filter(isCreature).map(pow)); return n ? { ...m, n, colors: ['G'] } : null; }
        if (m.tripleCtr && m.n > 0 && o.counters > 0) return { ...m, n: 3 };
        return m;
    };
}
// Biophagus: the mana gives a creature spell an extra +1/+1 counter when it enters
MANA_RIDERS.btBio = function (P, o, srcPerm) { if (Rx(o).kind === 'creature') o.bt_extraCtr = (o.bt_extraCtr || 0) + 1; };
{
    const base = putOntoBattlefield;
    putOntoBattlefield = function (P, o, tapped) {
        const extra = o.bt_extraCtr; o.bt_extraCtr = 0;
        const r = base.apply(this, arguments);
        if (extra > 0 && onBf(o.uid)) { const got = putCounters(o, extra, P); log(`${o.card.name} enters with ${got} additional +1/+1 counter${got === 1 ? '' : 's'} (Genomic Enhancement).`); }
        return r;
    };
}
// Mutagen Man: activated abilities of artifact tokens cost {1} less
{
    const base = actCost;
    actCost = function (o, a) {
        const m = base.apply(this, arguments);
        if (!G || !o.token || !/\bArtifact\b/.test(o.card.type)) return m;
        const k = G.players[o.owner].bf.filter(x => Rx(x).tokenActLess && !lostAbilities(x)).length;
        return k ? { ...m, generic: Math.max(0, m.generic - k) } : m;
    };
}
// Voracious Brood: creature cards put into your graveyard from anywhere (watched after every state-based check)
function btBroodWatch() {
    if (!G) return;
    for (const P of G.players) {
        const broods = P.bf.filter(x => Rx(x).btBrood && !lostAbilities(x));
        if (!broods.length) { P.bt_seen = null; continue; }
        const now = P.gy.filter(c => /\bCreature\b/.test(c.card.type));
        if (!P.bt_seen) { P.bt_seen = new Set(now.map(c => c.uid)); continue; }
        const fresh = now.filter(c => !P.bt_seen.has(c.uid));
        P.bt_seen = new Set(now.map(c => c.uid));
        if (fresh.length) broods.forEach(b => { const got = putCounters(b, fresh.length, P); log(`${b.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (${fresh.length} creature card${fresh.length === 1 ? '' : 's'} hit the graveyard).`); });
    }
}
{
    const base = sba;
    sba = function () { const r = base.apply(this, arguments); btBroodWatch(); return r; };
}
{
    const base = settle;
    settle = async function () { const r = await base.apply(this, arguments); btBroodWatch(); return r; };
}

Object.assign(CMD_SCORE, { bt_mouser: () => 3, bt_emil: () => 4, bt_plan: () => 2, bt_fangs: () => 6, bt_fangsAll: () => 8, bt_study: () => 6, bt_charge: () => 6, bt_yaoGuai: () => 5, bt_nesting: () => 1, bt_gamma: () => 5, bt_fertilid: () => 3, bt_ooze: () => 2, bt_brawler: () => 4, bt_powerFist: () => 3, bt_archers: () => 4, bt_earthbend: () => 4, bt_quest: () => 2, bt_mutagenMan: () => 5 });
Object.assign(CMD, {
    // Big Mother Mouser: a Robot for each +1/+1 counter it had
    bt_mouser(P, e, t, src) { const n = Math.max(0, (G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.counters : src.counters) || 0); if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'colorless Robot', artifact: true, kw: [] }, null, src); },
    // Emil: a Fractal with X counters, X = differently named lands
    async bt_emil(P, e, t, src) { await makeFractal(P, tkNamedLands(P), src); },
    // Claim the Kingdom: a plan counter; the fourth sacrifices it and gives a creature an indestructible counter
    async bt_plan(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.ctr.plan = (src.ctr.plan || 0) + 1; log(`${src.card.name} gets a plan counter (${src.ctr.plan}).`);
        if (src.ctr.plan === 4) {
            sacPerm(P, src);
            const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: put an indestructible counter on a creature you control`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
            if (x) { x.ctr.indestructible = (x.ctr.indestructible || 0) + 1; log(`${x.card.name} gets an indestructible counter.`); }
        }
    },
    // Earthbender Ascension: earthbend 2, then a tapped basic
    async bt_earthbend(P, e, t, src) { await c_earthbend(P, 2, src); await applyChoiceEffect(P, { t: 'fetchLand', n: 1, what: 'basic land', bf: true, tapped: true }, src); },
    // Earthbender Ascension: quest counters; at four or more each land adds a +1/+1 counter and trample
    async bt_quest(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.ctr.quest = (src.ctr.quest || 0) + 1; log(`${src.card.name} gets a quest counter (${src.ctr.quest}).`);
        if (src.ctr.quest >= 4) {
            const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: put a +1/+1 counter on a creature you control (it gains trample)`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
            if (x) { putCounters(x, 1, P); x.tkw.push('trample'); log(`${x.card.name} gets a +1/+1 counter and gains trample until end of turn.`); }
        }
    },
    // Fangs of Kalonia: a counter on the target, then double its +1/+1 counters
    bt_fangs(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; putCounters(x, 1, P); const d = Math.max(0, x.counters); if (d > 0) putCounters(x, d, P); log(`${x.card.name} now has ${x.counters} +1/+1 counters.`); },
    bt_fangsAll(P, e, t, src) { P.bf.filter(isCreature).forEach(x => { putCounters(x, 1, P); const d = Math.max(0, x.counters); if (d > 0) putCounters(x, d, P); log(`${x.card.name} now has ${x.counters} +1/+1 counters.`); }); },
    // Fertilid: remove a counter (paid as a cost), a player fetches a basic land tapped
    async bt_fertilid(P, e, t, src) {
        let who = P;
        if (!btAI(P) && G.players.length > 1) { const pool = G.players.filter(X => !X.out); if (pool.length > 1) { const names = pool.map(X => X.name); const i = await askMode(P, `${src.card.name}: which player searches for a basic land?`, names); if (i !== null && pool[i]) who = pool[i]; } }
        await applyChoiceEffect(who, { t: 'fetchLand', n: 1, what: 'basic land', bf: true, tapped: true }, src);
    },
    // Gamma Grotesque: after three counters, a card for each creature you control with a counter
    bt_gamma(P, e, t, src) { const n = P.bf.filter(x => isCreature(x) && btAnyCtr(x)).length; if (n > 0) drawCards(P, n); },
    // Mutagen Man: X Mutagen tokens
    bt_mutagenMan(P, e, t, src) { const x = src.xVal || 0; for (let i = 0; i < x; i++) makeArtifactToken(P, 'mutagen'); if (x > 0) log(`${P.name} ${you(P) ? 'create' : 'creates'} ${x} Mutagen token${x === 1 ? '' : 's'}.`); },
    // Nesting Grounds: move a counter from one of your permanents to another
    async bt_nesting(P, e, t, src) {
        const from = await pickOwn(P, P.bf.filter(btAnyCtr), `${src.card.name}: move a counter from which permanent you control?`, { rank: (a, b) => (b.counters || 0) - (a.counters || 0) });
        if (!from) return;
        const kinds = [...(from.counters > 0 ? ['+1/+1'] : []), ...Object.keys(from.ctr || {}).filter(k => from.ctr[k] > 0)];
        let kind = kinds[0];
        if (kinds.length > 1 && !btAI(P)) { const i = await askMode(P, `${src.card.name}: which counter?`, kinds); if (i !== null && kinds[i]) kind = kinds[i]; }
        const to = await pickOwn(P, P.bf.filter(x => x !== from && (kind !== '+1/+1' || isCreature(x))), `${src.card.name}: move it onto which other permanent you control?`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (!to) return;
        if (kind === '+1/+1') { from.counters--; putCounters(to, 1, P); } else { from.ctr[kind]--; to.ctr[kind] = (to.ctr[kind] || 0) + 1; }
        log(`${P.name} ${you(P) ? 'move' : 'moves'} a ${kind} counter from ${from.card.name} to ${to.card.name}.`);
    },
    // Palazzo Archers: damage equal to its power to each attacking flier
    bt_archers(P, e, t, src) { const n = pow(src); (G.ctxRaw && G.ctxRaw.list || []).filter(x => x.owner !== P.i && has(x, 'flying') && onBf(x.uid) && btAttacksMine(x, src)).forEach(x => damage(x, n, src)); },
    // Power Fist: counters equal to the combat damage dealt to a player
    bt_powerFist(P, e, t, src) { const h = onBf(src.attachedTo); const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (h && n > 0) { const got = putCounters(h, n, P); log(`${h.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (Power Fist).`); } },
    // Railway Brawler: counters equal to the entering creature's power
    bt_brawler(P, e, t, src) { const x = G.ctxRaw && G.ctxRaw.o; if (x && onBf(x.uid)) { const n = Math.max(0, pow(x)); if (n > 0) { const got = putCounters(x, n, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (Railway Brawler).`); } } },
    // Rampaging Yao Guai: destroy artifacts and/or enchantments with total mana value X or less
    async bt_yaoGuai(P, e, t, src) {
        let left = src.xVal || 0; let pool = allPerms().filter(x => x !== src && /\b(Artifact|Enchantment)\b/.test(x.card.type) && (x.card.cmc || 0) <= left);
        const dead = [];
        while (pool.length && left >= 0) {
            let x;
            if (btAI(P)) x = pool.filter(y => y.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0];
            else x = await pickCard(P, pool, `${src.card.name}: destroy an artifact or enchantment (${left} mana value left)`, { optional: true });
            if (!x) break;
            dead.push(x); left -= x.card.cmc || 0;
            pool = pool.filter(y => y !== x && (y.card.cmc || 0) <= left);
        }
        dead.forEach(x => { if (onBf(x.uid)) { log(`${src.card.name} destroys ${x.card.name}.`); destroy(x, src.card.name); } });
    },
    // Study the Classics: a counter, double, gain life equal to the counters
    bt_study(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; putCounters(x, 1, P); const d = Math.max(0, x.counters); if (d > 0) putCounters(x, d, P); const n = Math.max(0, x.counters); if (n > 0) { P.life += n; log(`${P.name} ${you(P) ? 'gain' : 'gains'} ${n} life.`); } },
    // Synchronized Charge: two counters among one or two of your creatures, then vigilance and trample for every creature with counters
    async bt_charge(P, e, t, src) {
        const pool = P.bf.filter(isCreature);
        if (pool.length) {
            const rank = (a, b) => creatureValue(b) - creatureValue(a);
            const a = await pickOwn(P, pool, `${src.card.name}: first +1/+1 counter goes on which creature?`, { rank });
            const b = pool.length > 1 ? await pickOwn(P, pool, `${src.card.name}: second +1/+1 counter goes on which creature? (the same one is fine)`, { rank: (x, y) => (x === a ? -1 : 0) - (y === a ? -1 : 0) || rank(x, y) }) : a;
            [a, b].forEach(x => { if (x && onBf(x.uid)) { const got = putCounters(x, 1, P); log(`${x.card.name} gets ${got} +1/+1 counter.`); } });
        }
        P.bf.filter(x => isCreature(x) && btAnyCtr(x)).forEach(x => { x.tkw.push('vigilance', 'trample'); });
    },
    // The Ooze: a Mutagen for each +1/+1 counter on the creature that left
    // The Ooze: exile a card from a graveyard (a person chooses; the computer takes the best card from an opponent's), then a Mutagen
    async bt_oozeExile(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => ({ c, X })));
        if (pool.length) {
            let pick;
            if (btAI(P)) pick = pool.slice().sort((a, b) => (b.X !== P ? 1 : 0) - (a.X !== P ? 1 : 0) || (b.c.card.cmc || 0) - (a.c.card.cmc || 0))[0];
            else { const c = await pickCard(P, pool.map(p => p.c), `${src.card.name}: exile a card from a graveyard`, { optional: true }); pick = pool.find(p => p.c === c); }
            if (pick) { pull(pick.X.gy, pick.c); pick.X.exile.push(pick.c); log(`${src.card.name} exiles ${pick.c.card.name} from ${pick.X.name}'s graveyard.`); }
        }
        makeArtifactToken(P, 'mutagen');
    },
    bt_ooze(P, e, t, src) { const n = Math.max(0, (G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.counters : 0) || 0); for (let i = 0; i < n; i++) makeArtifactToken(P, 'mutagen'); if (n > 0) log(`${P.name} ${you(P) ? 'create' : 'creates'} ${n} Mutagen token${n === 1 ? '' : 's'}.`); }
});
