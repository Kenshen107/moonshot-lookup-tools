// Spellslinger Duels - engine pieces for card round rk2 (2026-11-27). CMD ids start with rk2_. Wordings are in rules/rk2.js.
// a person chooses; the computer takes the best by score
async function rk2Pick(P, pool, prompt, score, optional) {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort((a, b) => score(b) - score(a))[0];
    return (await pickCard(P, pool, prompt, { required: !optional })) || (optional ? null : pool[0]);
}
const rk2Yes = async (P, src, msg, aiYes, yes, no) => (P.isAI || AUTOPLAY) ? !!aiYes : askYes(P, msg, { card: src && src.card, yes: yes || 'Yes', no: no || 'No' });
const rk2Cols = o => (o.card.colors || []);
const rk2Mine = (P, f) => P.bf.filter(f);
const rk2Foes = P => foes(P);
// ---- "hexproof until end of turn" for permanents of every type and for players (Dawn's Truce, Veil of Summer) ----
// o.rk2Hex / P.rk2Hex = { turn, cols } (cols null = hexproof, else hexproof from those colors only)
function rk2HexBlocks(owner, holder, src) {
    const h = holder && holder.rk2Hex; if (!h || h.turn !== G.turn) return false;
    return !h.cols || (src && src.card && rk2Cols(src).some(c => h.cols.includes(c)));
}
{
    const vt = validTargets;
    validTargets = function (P, e, src) {
        const out = vt.apply(this, arguments);
        return out.filter(v => {
            if (v.o) {
                const own = G.players[v.o.owner];
                if (own !== P && rk2HexBlocks(own, v.o, src && src.card ? { owner: P.i, card: src.card } : { owner: P.i })) return false;
                if (/\bEnchantment\b/.test(v.o.card.type) && rk2EnchShroud(v.o)) return false;
            } else if (v.p && v.p !== P && rk2HexBlocks(v.p, v.p, src && src.card ? { owner: P.i, card: src.card } : { owner: P.i })) return false;
            return true;
        });
    };
    const ts = targetStillOk;
    targetStillOk = function (t, item) {
        if (!ts.apply(this, arguments)) return false;
        if (t && t.o && item && item.P) {
            const own = G.players[t.o.owner];
            if (own !== item.P && rk2HexBlocks(own, t.o, { owner: item.P.i, card: item.o && item.o.card })) return false;
            if (/\bEnchantment\b/.test(t.o.card.type) && rk2EnchShroud(t.o)) return false;
        } else if (t && t.p && item && item.P && t.p !== item.P && rk2HexBlocks(t.p, t.p, { owner: item.P.i, card: item.o && item.o.card })) return false;
        return true;
    };
}
// Sterling Grove / Greater Auramancy: other enchantments you control have shroud
function rk2EnchShroud(o) { return G.players[o.owner].bf.some(a => a !== o && Rx(a).rk2EnchShroud && !lostAbilities(a)); }
// ---- tracking: spells cast this turn (Veil of Summer) ----
{
    const f0 = fire;
    fire = function (ev, ctx) {
        if (ev === 'cast' && ctx && ctx.o && ctx.P && ctx.P.rk2Uncounter === G.turn) ctx.o.noCounter = true;
        return f0.apply(this, arguments);
    };
}
Object.assign(CMD, {
    // Three Tree City
    async rk2_threeTree(P, e, t, src) {
        const ty = chosenTypeOf(src);
        const n = P.bf.filter(x => isCreature(x) && hasType(x, ty)).length;
        const cols = ['W', 'U', 'B', 'R', 'G'];
        let c;
        if (P.isAI || AUTOPLAY) { const need = {}; cols.forEach(k => { need[k] = 0; }); P.hand.forEach(h => cols.forEach(k => { need[k] += ((Rx(h).cost || {})[k] || 0); })); c = cols.slice().sort((a, b) => need[b] - need[a])[0]; }
        else c = cols[await askMode(P, `${src.card.name}: choose a color`, ['White', 'Blue', 'Black', 'Red', 'Green'])] || 'G';
        P.pool = (P.pool || []).concat(Array(n).fill(c));
        log(`${P.name} ${you(P) ? 'add' : 'adds'} ${n} {${c}} (${n} ${ty}${n === 1 ? '' : 's'}).`);
    },
    // Dawn's Truce
    async rk2_dawnTruce(P, e, t, src) {
        const promised = !!src.giftPromised; if (promised) await giftDraw(P, src);
        P.rk2Hex = { turn: G.turn, cols: null };
        P.bf.forEach(x => { x.rk2Hex = { turn: G.turn, cols: null }; x.tkw.push('hexproof'); if (promised) x.tkw.push('indestructible'); });
        log(`${P.name} and ${you(P) ? 'your' : 'their'} permanents gain hexproof${promised ? ' and indestructible' : ''} until end of turn.`);
    },
    // Bident of Thassa
    rk2_bident(P) {
        const cs = foes(P).flatMap(F => F.bf.filter(isCreature));
        cs.forEach(c => { c.mustAttackTurn = G.turn; });
        log(`${cs.length} creature${cs.length === 1 ? '' : 's'} ${P.name}'s opponents control attack this turn if able.`);
    },
    // Veil of Summer
    rk2_veil(P, e, t, src) {
        if (foes(P).some(F => F.castColorsTurn === G.turn && F.castColors && (F.castColors.has('U') || F.castColors.has('B')))) { drawCards(P, 1); }
        P.rk2Uncounter = G.turn;
        G.stack.filter(it => it.kind === 'spell' && it.P === P).forEach(it => { it.o.noCounter = true; });
        P.rk2Hex = { turn: G.turn, cols: ['U', 'B'] };
        P.bf.forEach(x => { x.rk2Hex = { turn: G.turn, cols: ['U', 'B'] }; });
        log(`${P.name}: spells can't be countered this turn; ${you(P) ? 'you and your' : 'they and their'} permanents have hexproof from blue and from black.`);
    }
});
Object.assign(CMD_SCORE, { rk2_threeTree: P => (P.hand.some(h => (h.card.cmc || 0) > availableMana(P)) ? 3 : 0), rk2_dawnTruce: () => 0, rk2_bident: P => foes(P).some(F => F.bf.filter(isCreature).length >= 2) ? 1 : 0, rk2_veil: () => 0 });

// ================= batch 2 =================
const rk2Name = P => P.name;
const rk2Cards = (P, f) => P.gy.filter(f);
// Class levels: "When this Class becomes level N" (Wizard Class, Cleric Class)
TRIG_FN.rk2_lvl = (o, ctx, tr) => ctx.o === o && ctx.lvl === tr.lvlN;
// Reflections of Littjara: a spell of the chosen type is cast
TRIG_FN.rk2_chosenSpell = (o, ctx) => !!ctx.o && ctx.P && ctx.P.i === o.owner && (hasType(ctx.o, chosenTypeOf(o)));
// Simic Ascendancy: +1/+1 counters put on a creature you control
TRIG_FN.rk2_ctrMine = (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o) && (ctx.n || 0) > 0;
{
    const sm = stackMatches;
    stackMatches = function (it, filter) {
        if (filter === 'rk2ACP') return it.kind === 'spell' && /Artifact|Creature|Planeswalker/.test(it.o.card.type) || (it.kind === 'spell' && Rx(it.o).kind === 'creature');
        if (filter === 'rk2MV4') return it.kind === 'spell' && (it.o.card.cmc || 0) >= 4;
        return sm.apply(this, arguments);
    };
    // Flare of Fortitude: your life total can't change until end of turn
    window.rk2LockLife = function (P) {
        const cur = P.life, turn = G.turn, normal = Object.getOwnPropertyDescriptor(P, 'life');
        Object.defineProperty(P, 'life', { enumerable: true, configurable: true, get() { return cur; }, set(v) { if (G && G.turn !== turn) { Object.defineProperty(P, 'life', normal); P.life = v; } } });
    };
    // Solphim: noncombat damage a source you control would deal to an opponent or their permanent is doubled
    const d0 = damage;
    damage = function (target, n, src) {
        if (n > 0 && G && !G.inCombatDamage && src && src.owner !== undefined && G.players[src.owner]) {
            const SP = G.players[src.owner];
            const k = SP.bf.filter(x => Rx(x).rk2Solphim && !lostAbilities(x)).length;
            const theirs = target && (target.life !== undefined ? target !== SP : (target.card && target.owner !== src.owner));
            if (k && theirs) { n *= 2 ** k; log(`(Solphim doubles the damage: ${n}.)`); }
        }
        return d0.apply(this, [target, n].concat([].slice.call(arguments, 2)));
    };
    // costs that discard N cards ("Discard two cards"): chosen first, handed back if the ability is cancelled
    const ap = actPlan;
    actPlan = function (P, o, a) { if (a && a.rk2DiscardN && P.hand.filter(x => x !== o).length < a.rk2DiscardN) return null; return ap.apply(this, arguments); };
    const av = activate;
    activate = async function (P, o, a) {
        if (a && a.rk2DiscardN) {
            const chosen = [];
            for (let k = 0; k < a.rk2DiscardN; k++) {
                const pool = P.hand.filter(x => x !== o && !chosen.includes(x));
                const d = await rk2Pick(P, pool, `${o.card.name}: discard a card (${k + 1} of ${a.rk2DiscardN})`, x => -aiKeepValue(P, x));
                if (!d) { return false; }
                chosen.push(d);
            }
            chosen.forEach(d => { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; });
            const r = await av.apply(this, arguments);
            if (r === false) { chosen.forEach(d => { pull(P.gy, d); P.hand.push(d); d.discardTurn = 0; }); return r; }
            noteDiscard(P, chosen.length); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${chosen.map(d => d.card.name).join(' and ')}.`);
            return r;
        }
        return av.apply(this, arguments);
    };
    const mr = modeRange;
    modeRange = function (P, R, src) { const r = mr.apply(this, arguments); return R.rk2BothIf ? { min: r.min, max: R.rk2BothIf(P) ? 2 : 1 } : r; };
}
async function rk2Lose(P, n, src) { if (n > 0) { await applyEffect(P, { t: 'loseSelf', n }, null, src); fire('loseLife', { P, n }); } }
async function rk2Reanimate(P, card, src) { const owner = G.players.find(X => [X.gy, X.exile, X.library, X.hand].some(z => z.includes(card))); if (!owner) return null; putOntoBattlefield(P, card); await settle(); return card; }
Object.assign(CMD, {
    // Flare of Fortitude
    rk2_flare(P) {
        rk2LockLife(P);
        P.bf.forEach(x => { x.rk2Hex = { turn: G.turn, cols: null }; x.tkw.push('hexproof', 'indestructible'); });
        log(`${P.name}'s life total can't change this turn, and ${you(P) ? 'your' : 'their'} permanents gain hexproof and indestructible.`);
    },
    // Mizzix's Mastery (target card chosen as it resolves)
    async rk2_mizzix(P, e, t, src) {
        const isIS = x => ['instant', 'sorcery'].includes(Rx(x).kind);
        src.exileAfter = true;
        let list;
        if (e.all) list = P.gy.filter(isIS);
        else { const one = await rk2Pick(P, P.gy.filter(isIS), `${src.card.name}: exile an instant or sorcery card from your graveyard`, x => (x.card.cmc || 0) + (Rx(x).support === 'full' ? 5 : 0)); list = one ? [one] : []; }
        list.forEach(x => { pull(P.gy, x); P.exile.push(x); });
        if (list.length) log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${list.map(x => x.card.name).join(', ')} and copies ${list.length === 1 ? 'it' : 'them'}.`);
        let left = list.slice();
        while (left.length) {
            const x = (P.isAI || AUTOPLAY || left.length === 1) ? left[0] : await pickCard(P, left, `${src.card.name}: cast a copy of which card first?`, { required: true });
            left = left.filter(y => y !== x);
            const yes = await rk2Yes(P, x, `Cast a copy of ${x.card.name} without paying its mana cost?`, true, 'Cast the copy', 'No');
            if (yes) await castCopyFree(P, x.card);
        }
    },
    // Demonic Consultation
    async rk2_consult(P, e, t, src) {
        const name = await askName(P, `${src.card.name}: choose a card name`, { card: src.card, def: P.library.length ? P.library[0].card.name : null });
        const six = P.library.splice(-6).reverse(); P.exile.push(...six);
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top ${six.length} cards of ${you(P) ? 'your' : 'their'} library.`);
        const shown = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (name && c.card.name === name) { hit = c; break; } shown.push(c); }
        P.exile.push(...shown);
        if (hit) { P.hand.push(hit); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${hit.card.name} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand; the other revealed cards are exiled.`); }
        else log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${you(P) ? 'your' : 'their'} whole library and finds no "${name}".`);
    },
    // Strix Serenade (the Bird goes to the countered spell's controller)
    async rk2_birdFor(P, e, t, src) {
        const it = (t && t.item) || G.lastCountered; if (!it || !it.P) return;
        await applyEffect(it.P, { t: 'token', n: 1, p: 2, q: 2, name: 'blue Bird', kw: ['flying'] }, null, src);
    },
    // Damning Verdict
    rk2_verdict(P, e, t, src) {
        const doomed = allPerms().filter(c => isCreature(c) && !(c.counters !== 0 || Object.values(c.ctr || {}).some(v => v > 0)));
        doomed.forEach(c => destroy(c, src.card.name)); log(`${doomed.length} creature${doomed.length === 1 ? '' : 's'} with no counters ${doomed.length === 1 ? 'is' : 'are'} destroyed.`);
    },
    // Crux of Fate
    rk2_wipeDragons(P, e, t, src) {
        const doomed = allPerms().filter(c => isCreature(c) && (hasType(c, 'Dragon') === !e.non));
        doomed.forEach(c => destroy(c, src.card.name)); log(`${doomed.length} ${e.non ? 'non-Dragon' : 'Dragon'} creature${doomed.length === 1 ? '' : 's'} destroyed.`);
    },
    // Simic Ascendancy
    rk2_growth(P, e, t, src) { const n = (G.ctxRaw && G.ctxRaw.n) || 0; if (n > 0 && onBf(src.uid)) { addNamedCounter(src, 'growth', n); log(`${src.card.name} gets ${n} growth counter${n === 1 ? '' : 's'}.`); } },
    // Ad Nauseam
    async rk2_adNauseam(P, e, t, src) {
        for (let guard = 0; guard < 100; guard++) {
            const c = P.library.pop(); if (!c) { P.drewEmpty = true; return; }
            P.hand.push(c); const n = c.card.cmc || 0;
            log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${c.card.name} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand.`);
            await rk2Lose(P, n, src);
            if (P.life <= 0) return;
            const go = P.isAI || AUTOPLAY ? (P.life > 12 && P.library.length > 1 && guard < 6) : await askYes(P, `${src.card.name}: you have ${P.life} life. Reveal another card?`, { card: src.card, yes: 'Reveal another', no: 'Stop' });
            if (!go) return;
        }
    },
    // Glissa Sunslayer: remove up to three counters from target permanent
    async rk2_removeCounters(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const kinds = () => [...(x.counters > 0 ? [{ k: '+1/+1', n: x.counters }] : []), ...(x.counters < 0 ? [{ k: '-1/-1', n: -x.counters }] : []), ...Object.entries(x.ctr || {}).filter(([k, v]) => v > 0).map(([k, v]) => ({ k, n: v }))];
        let done = 0;
        for (let i = 0; i < (e.n || 3); i++) {
            const ks = kinds(); if (!ks.length) break;
            let pick;
            if (P.isAI || AUTOPLAY) { const mine = x.owner === P.i; pick = ks.slice().sort((a, b) => (mine ? (b.k === '-1/-1') - (a.k === '-1/-1') : (b.k === '+1/+1') - (a.k === '+1/+1') || b.n - a.n))[0]; }
            else { const m = await askMode(P, `${src.card.name}: remove a counter from ${x.card.name} (${done} of ${e.n || 3} so far)`, [...ks.map(c => `A ${c.k} counter (${c.n})`), 'Stop']); pick = ks[m]; if (!pick) break; }
            if (pick.k === '+1/+1') x.counters--; else if (pick.k === '-1/-1') x.counters++; else x.ctr[pick.k]--;
            done++;
        }
        if (done) log(`${done} counter${done === 1 ? '' : 's'} removed from ${x.card.name}.`);
    },
    // Cleric Class, level 3
    async rk2_clericL3(P, e, t, src) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type));
        const c = await rk2Pick(P, pool, `${src.card.name}: return a creature card from your graveyard to the battlefield`, x => (x.card.cmc || 0), true); if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c); await settle();
        const n = Math.max(0, tou(c)); if (n > 0) gainLifeFor(P, n);
    },
    // Ancient Silver Dragon
    rk2_silverDragon(P, e, t, src) {
        const d = rand(20) + 1; log(`${P.name} ${you(P) ? 'roll' : 'rolls'} a d20: ${d}.`);
        drawCards(P, d); P.noMaxHand = true; log(`${P.name} ${you(P) ? 'have' : 'has'} no maximum hand size for the rest of the game.`);
    },
    // Ouroboroid
    rk2_ouroboroid(P, e, t, src) {
        const x = Math.max(0, pow(src)); if (!x) return;
        P.bf.filter(isCreature).forEach(c => putCounters(c, x, P));
        log(`${P.name} puts ${x} +1/+1 counter${x === 1 ? '' : 's'} on each creature ${you(P) ? 'you control' : 'they control'}.`);
    }
});
Object.assign(CMD_SCORE, {
    rk2_flare: () => 0, rk2_mizzix: P => P.gy.some(x => ['instant', 'sorcery'].includes(Rx(x).kind) && Rx(x).support === 'full') ? 7 : 0, rk2_consult: () => 0, rk2_birdFor: () => 0,
    rk2_verdict: P => { const mine = P.bf.filter(c => isCreature(c) && !(c.counters || Object.values(c.ctr || {}).some(v => v > 0))).reduce((a, c) => a + creatureValue(c), 0); const th = foes(P).flatMap(F => F.bf).filter(c => isCreature(c) && !(c.counters || Object.values(c.ctr || {}).some(v => v > 0))).reduce((a, c) => a + creatureValue(c), 0); return th - mine > 6 ? th - mine : 0; },
    rk2_wipeDragons: (P, e) => 0, rk2_adNauseam: () => 0, rk2_removeCounters: () => 3, rk2_clericL3: () => 0, rk2_silverDragon: () => 0, rk2_ouroboroid: () => 0, rk2_growth: () => 0
});
