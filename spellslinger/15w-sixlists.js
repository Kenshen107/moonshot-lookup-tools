// Spellslinger Duels - engine pieces for six more owner decks (2026-11-15): Nog, Terra, Urianger, Jenova (second list), Gogo, Beorn the Fierce.
// Wordings: rules/sixlists.js. CMD ids start with sl_. Approximations (nothing is marked Partly) are noted at each piece.
// "Target" choices inside a resolving spell are made as it resolves (the usual approximation); a person always gets the pick.

const slIsPerm = c => !/\b(Instant|Sorcery)\b/.test(c.card.type);
async function slPickFrom(P, pool, prompt, required) {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
    return await pickCard(P, pool, prompt, { required: !!required });
}

// The Gitrog Monster: whenever land cards are put into your graveyard from anywhere, draw a card (watched after every state-based check, like Voracious Brood)
function slGitrogWatch() {
    if (!G) return;
    for (const P of G.players) {
        const g = P.bf.filter(x => Rx(x).slGitrogDraw && !lostAbilities(x));
        const now = P.gy.filter(c => /\bLand\b/.test(c.card.type));
        if (!g.length) { P.sl_seen = null; continue; }
        if (!P.sl_seen) { P.sl_seen = new Set(now.map(c => c.uid)); continue; }
        const fresh = now.filter(c => !P.sl_seen.has(c.uid));
        P.sl_seen = new Set(now.map(c => c.uid));
        if (fresh.length) { log(`${g[0].card.name}: ${fresh.length} land card${fresh.length === 1 ? '' : 's'} went to ${you(P) ? 'your' : 'their'} graveyard, so ${P.name} ${you(P) ? 'draw' : 'draws'} a card.`); drawCards(P, 1); }
    }
}
{ const base = sba; sba = function () { const r = base.apply(this, arguments); slGitrogWatch(); return r; }; }
{ const base = settle; settle = async function () { const r = await base.apply(this, arguments); slGitrogWatch(); return r; }; }

Object.assign(CMD, {
    // Temporal Anomaly: mill four, a permanent card from among them to hand
    async sl_tempAnomaly(P, e, t, src) {
        const milled = doMill(P, 4); const pool = milled.filter(c => P.gy.includes(c) && slIsPerm(c));
        const c = pool.length ? await slPickFrom(P, pool, `${src.card.name}: put a permanent card into your hand (or none)`, false) : null;
        if (c) { pull(P.gy, c); P.hand.push(c); log(`${P.name} put${you(P) ? '' : 's'} ${c.card.name} into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Dancing from Dark to Dawn: X = the cast spell's mana value
    sl_dancing(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const mv = sp ? sp.card.cmc || 0 : 0; const x = t && t.o; if (mv > 0 && x && onBf(x.uid)) { const got = putCounters(x, mv, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } },
    // Eden: mill two, then you may sacrifice it; if you do, return another permanent card from your graveyard to your hand
    async sl_eden(P, e, t, src) {
        doMill(P, 2);
        if (!onBf(src.uid)) return;
        const pool = P.gy.filter(c => slIsPerm(c));
        if (!pool.length) return;
        const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: sacrifice it to return a permanent card from your graveyard to your hand?`, { card: src.card });
        if (!yes) return;
        leaveBattlefield(src, 'gy'); log(`${P.name} sacrifice${you(P) ? '' : 's'} ${src.card.name}.`);
        const c = await slPickFrom(P, pool, `${src.card.name}: return a permanent card to your hand`, true);
        if (c) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // In Garruk's Wake
    async sl_garrukWake(P, e, t, src) { allPerms().filter(o => o.owner !== P.i && (isCreature(o) || isPlaneswalker(o))).forEach(o => destroy(o, src.card.name)); },
    // Scrib Nibblers
    sl_scrib(P, e, t, src) {
        const X = t && t.p; if (!X || !X.library.length) return;
        const c = X.library.pop(); X.exile.push(c); log(`${c.card.name} is exiled from the top of ${X.name}'s library.`);
        if (/\bLand\b/.test(c.card.type)) gainLifeFor(P, 1);
    },
    // The Gitrog Monster: sacrifice it unless you sacrifice a land
    async sl_gitrogUpkeep(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type));
        let pay = false;
        if (lands.length) pay = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: sacrifice a land? (Otherwise it is sacrificed.)`, { card: src.card, yes: 'Sacrifice a land', no: 'Sacrifice it' });
        if (pay) { const f = await chooseSac(P, src, 'land', src.card.name); if (f) { leaveBattlefield(f, 'gy'); log(`${P.name} sacrifice${you(P) ? '' : 's'} ${f.card.name}.`); return; } }
        leaveBattlefield(src, 'gy'); log(`${P.name} sacrifice${you(P) ? '' : 's'} ${src.card.name}.`);
    },
    // Volatile Fault: destroy the land, its controller may fetch a basic (onto the battlefield untapped), you get a Treasure
    async sl_volatileFault(P, e, t, src) {
        const x = t && t.o;
        if (x && onBf(x.uid)) {
            const X = G.players[x.owner]; destroy(x, src.card.name);
            const basics = X.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type));
            if (basics.length) {
                const go = (X.isAI || AUTOPLAY) ? true : await askYes(X, `${src.card.name}: search your library for a basic land card and put it onto the battlefield?`, { card: src.card });
                if (go) { const c = (X.isAI || AUTOPLAY) ? basics[0] : (await pickCard(X, basics, 'Choose a basic land card', { required: true })) || basics[0]; pull(X.library, c); shuffle(X.library); resetObj(c); c.enteredTurn = G.turn; X.bf.push(c); fire('enters', { o: c }); fire('landfall', { o: c }); log(`${X.name} put${you(X) ? '' : 's'} ${c.card.name} onto the battlefield.`); }
            }
        }
        await applyEffect(P, { t: 'artToken', kind: 'treasure', n: 1 }, null, src);
    },
    // Sapling Nursery: Treefolk and Forests you control gain indestructible until end of turn
    sl_nursery(P, e, t, src) { P.bf.filter(x => hasType(x, 'Treefolk') || hasType(x, 'Forest')).forEach(x => { x.tkw.push('indestructible'); }); log('Treefolk and Forests gain indestructible until end of turn.'); },

    // Serum Snare
    async sl_serumSnare(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const mv = x.card.cmc || 0; leaveBattlefield(x, 'hand'); log(`${x.card.name} returns to its owner's hand.`); if (mv <= 3) await applyEffect(P, { t: 'proliferate' }, null, src); },
    // Desynchronization
    sl_desync(P, e, t, src) {
        allPerms().filter(o => !/\bLand\b/.test(o.card.type) && !/\b(Artifact|Saga)\b|Legendary/.test(o.card.type)).forEach(o => { leaveBattlefield(o, 'hand'); });
        log('Each nonland permanent that is not historic returns to its owner\'s hand.');
    },
    // Eerie Ultimatum: any number of permanent cards with different names
    async sl_eerie(P, e, t, src) {
        const byName = new Map(); P.gy.filter(slIsPerm).forEach(c => { if (!byName.has(c.card.name)) byName.set(c.card.name, c); });
        let pool = [...byName.values()];
        if (P.isAI || AUTOPLAY) { pool.forEach(c => reanimateFrom(P, P, c)); return; }
        while (pool.length) {
            const c = await pickCard(P, pool, `${src.card.name}: return a permanent card with a different name (or stop)`, { required: false });
            if (!c) break; reanimateFrom(P, P, c); pool = pool.filter(x => x.card.name !== c.card.name && P.gy.includes(x));
        }
    },
    // Blood Beckoning
    async sl_beckon(P, e, t, src) {
        const n = src.kicked ? 2 : 1;
        for (let k = 0; k < n; k++) {
            const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
            const c = await slPickFrom(P, pool, `${src.card.name}: return a creature card to your hand`, true);
            if (c) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
        }
    },
    // Mutational Advantage
    async sl_mutational(P, e, t, src) {
        const hasCtr = o => o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0);
        P.bf.filter(hasCtr).forEach(o => { o.tkw.push('hexproof', 'indestructible'); o.slPreventTurn = G.turn; });
        log('Permanents you control with counters gain hexproof and indestructible until end of turn, and damage to them is prevented.');
        await applyEffect(P, { t: 'proliferate' }, null, src);
    },

    // Fatestitcher: tap or untap another target permanent (yours untap, others tap)
    async sl_tapOrUntap(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const untap = (P.isAI || AUTOPLAY) ? x.owner === P.i : await askYes(P, `${src.card.name}: tap or untap ${x.card.name}?`, { card: x.card, yes: 'Untap it', no: 'Tap it' }); x.tapped = !untap; log(`${x.card.name} ${untap ? 'untaps' : 'is tapped'}.`); },
    // Freed from the Real, Pemmin's Aura
    sl_untapHost(P, e, t, src) { const h = G.players.flatMap(X => X.bf).find(x => x.uid === src.attachedTo); if (h) { h.tapped = false; log(`${h.card.name} untaps.`); } },
    async sl_pemmin(P, e, t, src) {
        const h = G.players.flatMap(X => X.bf).find(x => x.uid === src.attachedTo); if (!h) return;
        const up = (P.isAI || AUTOPLAY) ? (h.owner === P.i ? tou(h) > 1 && pow(h) < tou(h) : false) : await askYes(P, `${src.card.name}: +1/-1 or -1/+1?`, { card: src.card, yes: '+1/-1', no: '-1/+1' });
        if (up) { h.tp += 1; h.tq -= 1; } else { h.tp -= 1; h.tq += 1; }
        log(`${h.card.name} gets ${up ? '+1/-1' : '-1/+1'} until end of turn.`);
    },
    // Slip Out the Back
    sl_slipOut(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; putCounters(x, 1, P); phaseOut(x); },
    sl_phaseOutTarget(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) phaseOut(x); },
    // Lyra, Archangel of Dawn: a counter on each Angel you control when you gain life
    sl_lyra(P, e, t, src) { P.bf.filter(x => hasType(x, 'Angel')).forEach(x => putCounters(x, 1, P)); },
    // Elenda's Hierophant: X Vampires, X = its power
    async sl_hierophant(P, e, t, src) {
        const x = Math.max(0, (G.ctxRaw && G.ctxRaw.lki ? G.ctxRaw.lki.power : undefined) !== undefined ? G.ctxRaw.lki.power : (src.card && Number(src.card.power)) || 0);
        if (x > 0) await applyEffect(P, { t: 'token', n: x, p: 1, q: 1, name: 'white Vampire', kw: ['lifelink'] }, null, src);
    },
    // Ultimate Magic: Holy
    sl_ultimateHoly(P, e, t, src) {
        P.bf.forEach(o => { o.tkw.push('indestructible'); });
        if (src.sx_castZone === 'exile') { P.slPreventTurn = G.turn; log('All damage that would be dealt to you this turn is prevented.'); }
    },

    // Doomgape: sacrifice a creature, gain life equal to its toughness
    async sl_doomgape(P, e, t, src) {
        const f = await chooseSac(P, src, 'creature', src.card.name); if (!f) return;
        const n = Math.max(0, tou(f)); leaveBattlefield(f, 'gy'); log(`${P.name} sacrifice${you(P) ? '' : 's'} ${f.card.name}.`); gainLifeFor(P, n);
    },
    // Hapatra: X -1/-1 counters on up to one target creature each opponent controls (X = greatest mana value in your graveyard)
    async sl_hapatra(P, e, t, src) {
        const x = Math.max(0, ...P.gy.map(c => c.card.cmc || 0));
        if (!x) return;
        for (const F of foes(P)) {
            const pool = F.bf.filter(isCreature).filter(c => !has(c, 'hexproof') && !has(c, 'shroud')); if (!pool.length) continue;
            const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put ${x} -1/-1 counters on a creature ${F.name} controls (or none)`, { required: false });
            if (c) { c.counters -= x; log(`${c.card.name} gets ${x} -1/-1 counters.`); }
        }
    },

    // High Tide: until end of turn, a land tapped for {U} adds an additional {U}
    sl_highTide(P, e, t, src) { G.slHighTide = G.turn; log('Until end of turn, Islands tapped for mana add an additional {U}.'); },

    // Restorative Technique
    async sl_restorative(P, e, t, src) {
        gainLifeFor(P, 2);
        const b = P.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type));
        if (b.length) { const c = b[0]; pull(P.library, c); shuffle(P.library); resetObj(c); c.enteredTurn = G.turn; c.tapped = true; P.bf.push(c); fire('enters', { o: c }); fire('landfall', { o: c }); log(`${c.card.name} enters tapped.`); }
        const pool = P.bf.filter(isCreature).filter(c => !has(c, 'hexproof') || c.owner === P.i); if (!pool.length) return;
        const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put a +1/+1 counter on up to one creature`, { required: false });
        if (c) putCounters(c, 1, P);
    },
    // Seismic Sense: look at the top X (X = lands you control), a creature or land card to hand, the rest on the bottom in random order
    async sl_seismic(P, e, t, src) {
        const x = P.bf.filter(o => /\bLand\b/.test(o.card.type)).length; const top = P.library.splice(Math.max(0, P.library.length - x), x).reverse(); if (!top.length) return;
        const pool = top.filter(c => /\b(Creature|Land)\b/.test(c.card.type));
        const c = pool.length ? await slPickFrom(P, pool, `${src.card.name}: reveal a creature or land card to put into your hand (or none)`, false) : null;
        if (c) { top.splice(top.indexOf(c), 1); P.hand.push(c); log(`${P.name} reveal${you(P) ? '' : 's'} ${c.card.name} and put${you(P) ? '' : 's'} it into ${you(P) ? 'your' : 'their'} hand.`); }
        shuffle(top).forEach(k => P.library.unshift(k));
    }
});
Object.assign(CMD_SCORE, { sl_tempAnomaly: () => 3, sl_dancing: () => 4, sl_eden: () => 3, sl_garrukWake: P => Math.min(20, 3 * foes(P).reduce((n, F) => n + F.bf.filter(isCreature).length, 0) - 2 * P.bf.filter(isCreature).length), sl_scrib: () => 1, sl_gitrogUpkeep: () => 0, sl_volatileFault: () => 2, sl_nursery: () => 2, sl_serumSnare: () => 4, sl_desync: () => 4, sl_eerie: P => Math.min(14, P.gy.filter(slIsPerm).length * 2), sl_beckon: () => 4, sl_mutational: () => 3, sl_tapOrUntap: () => 1, sl_slipOut: () => 3, sl_ultimateHoly: () => 3, sl_restorative: () => 4, sl_seismic: () => 4, sl_highTide: () => 2 });

// ===== batch 2 =====
const SL_LEVI = ['Kraken', 'Leviathan', 'Merfolk', 'Octopus', 'Serpent'];
TRIG_FN.sl_otherCreatureEnters = (o, ctx) => !!ctx.o && ctx.o !== o && isCreature(ctx.o);
TRIG_FN.sl_myNontokenDies = (o, ctx) => { const d = ctx.o; if (!d || d.owner !== o.owner || d.token || o.slPartTurn === G.turn) return false; o.slPartTurn = G.turn; return true; };
{
    const base = fire;
    fire = function (ev, ctx) {
        const r = base.apply(this, arguments);
        try {
            if (ev === 'gainLife' && ctx && ctx.P) { const X = ctx.P; if (X.slGain && X.slGain.turn === G.turn) X.slGain.n += ctx.n || 0; else X.slGain = { turn: G.turn, n: ctx.n || 0 }; }
            if (ev === 'cast' && ctx && ctx.P && ctx.o && /\bCreature\b/.test(ctx.o.card.type)) ctx.P.slCreatureCastTurn = G.turn;
            if (ev === 'attacks' && ctx && ctx.list) G.players.forEach(X => { if (X.slLevi === G.turn) { const n = ctx.list.filter(x => x.owner === X.i && SL_LEVI.some(ty => hasType(x, ty))).length; if (n) { log(`${X.name} draw${you(X) ? '' : 's'} ${n} card${n === 1 ? '' : 's'} (Summon: Leviathan).`); drawCards(X, n); } } });
            if (ev === 'hitPlayer' && ctx && ctx.src && ctx.src.slOdin && ctx.hit) ctx.hit.filter(X => X && X.life !== undefined && !X.out).forEach(X => { eliminate(X, `${ctx.src.card.name}: dealt combat damage to ${X.name}.`); const left = G.players.filter(p => !p.out); if (left.length <= 1 && !G.over) endGame(left.length ? left[0].i : null, `${X.name} lost the game to ${ctx.src.card.name}.`); });
        } catch (err) { /* never break a game for a log line */ }
        return r;
    };
}
{
    const base = manaOf;
    manaOf = function (o) {
        const m = base.apply(this, arguments);
        if (!m) return m;
        const X = G && G.players[o.owner];
        if (m.slWorkshop && X) {
            if (X.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length < 3) return null;
            const n = X.bf.filter(x => /^Urza's/.test(x.card.name) || Rx(x).slPlanarNexus).length;
            return n ? { ...m, n, fixed: true } : null;
        }
        if (m.slGreatest && X) { const g = Math.max(0, ...X.bf.filter(isCreature).map(pow)); return g > 0 ? { ...m, n: g } : null; }
        return m;
    };
}
{
    const base = attackTax;
    attackTax = function (P) {
        let n = base.apply(this, arguments);
        const D = opp(P);
        if (D && D.slYojimbo && G.turn < D.slYojimbo.turn + G.players.filter(x => !x.out).length && G.active !== D.i) n += 2;
        return n;
    };
}
Object.assign(CMD, {
    async sl_animaEdict(P, e, t, src) {
        for (const F of foes(P)) {
            if (F.bf.some(isCreature)) { const f = await chooseSac(F, src, 'creature', src.card.name); if (f) { leaveBattlefield(f, 'gy'); log(`${F.name} sacrifice${you(F) ? '' : 's'} ${f.card.name}.`); } }
            F.life -= 3; F.lostTurn = G.turn; log(`${F.name} ${you(F) ? 'lose' : 'loses'} 3 life.`);
        }
    },
    sl_ramuh(P, e, t, src) { const x = t && t.o; const n = P.gy.filter(c => !/\b(Creature|Land)\b/.test(c.card.type)).length; if (x && onBf(x.uid) && n > 0) damage(x, n, src); },
    async sl_valefor(P, e, t, src) {
        for (const F of foes(P)) {
            const cs = F.bf.filter(isCreature); if (!cs.length) continue;
            const mx = Math.max(...cs.map(c => c.card.cmc || 0)); const cands = cs.filter(c => (c.card.cmc || 0) === mx);
            const c = cands.length > 1 && !(F.isAI || AUTOPLAY) ? await pickCard(F, cands, `${src.card.name}: choose a creature with the greatest mana value`, { required: true }) : cands.sort((a, b) => permValue(a) - permValue(b))[0];
            if (c) { leaveBattlefield(c, 'hand'); log(`${c.card.name} returns to its owner's hand.`); }
        }
    },
    sl_shiva(P, e, t, src) { const n = foes(P).reduce((a, F) => a + F.bf.filter(x => isCreature(x) && x.tapped).length, 0); if (n) drawCards(P, n); },
    sl_leviathanBounce(P, e, t, src) { allPerms().filter(o => isCreature(o) && !SL_LEVI.some(ty => hasType(o, ty))).forEach(o => leaveBattlefield(o, 'hand')); log('Each creature that isn\'t a Kraken, Leviathan, Merfolk, Octopus, or Serpent returns to its owner\'s hand.'); },
    sl_leviathanDraw(P, e, t, src) { P.slLevi = G.turn; },
    sl_odin(P, e, t, src) { if (onBf(src.uid)) { src.slOdin = true; log(`${src.card.name} gains "Whenever it deals combat damage to a player, that player loses the game."`); } },
    sl_yojimboTax(P, e, t, src) { P.slYojimbo = { turn: G.turn }; log('Until your next turn, creatures can\'t attack you unless their controller pays {2} for each of them.'); },
    async sl_yojimboTreasure(P, e, t, src) { const n = foes(P).filter(F => F.bf.some(c => isCreature(c) && pow(c) >= 4)).length; if (n) await applyEffect(P, { t: 'artToken', kind: 'treasure', n }, null, src); },
    async sl_magus(P, e, t, src) {
        const k = rand(3);
        const mine = P.bf.filter(isCreature);
        const pickMine = async lbl => (!mine.length ? null : (P.isAI || AUTOPLAY) ? mine.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, mine, lbl, { required: true }));
        if (k === 0) { const c = await pickMine(`${src.card.name}: put three +1/+1 counters on a creature`); if (c) { putCounters(c, 3, P); } }
        else if (k === 1) { const c = await pickMine(`${src.card.name}: put a shield counter on a creature`); if (c) { c.ctr.shield = (c.ctr.shield || 0) + 1; log(`${c.card.name} gets a shield counter.`); } gainLifeFor(P, 3); }
        else {
            const foesC = foes(P).flatMap(F => F.bf.filter(isCreature)).filter(c => !has(c, 'hexproof') && !has(c, 'shroud'));
            const c = !foesC.length || !onBf(src.uid) ? null : (P.isAI || AUTOPLAY) ? foesC.filter(x => tou(x) <= pow(src)).sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, foesC, `${src.card.name} fights up to one creature an opponent controls`, { required: false });
            if (c) { log(`${src.card.name} fights ${c.card.name}.`); damage(c, pow(src), src); damage(src, pow(c), c); }
        }
    },
    sl_harbinger(P, e, t, src) { if (P.slGain && P.slGain.turn === G.turn && P.slGain.n >= 4) applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'white Angel', kw: ['flying', 'vigilance'] }, null, src); },
    // Talon Gates of Madara: put it from your hand onto the battlefield
    sl_talonGates(P, e, t, src) { if (!P.hand.includes(src)) return; pull(P.hand, src); putOntoBattlefield(P, src, false); log(`${src.card.name} is put onto the battlefield.`); },
    async sl_horizon(P, e, t, src) {
        const lands = P.hand.filter(c => /\bLand\b/.test(c.card.type)); if (!lands.length) return;
        const c = (P.isAI || AUTOPLAY) ? lands[0] : await pickCard(P, lands, `${src.card.name}: put a land card from your hand onto the battlefield tapped (or none)`, { required: false });
        if (c) { pull(P.hand, c); putOntoBattlefield(P, c, true); fire('landfall', { o: c }); log(`${c.card.name} enters tapped.`); }
    },
    async sl_navOrb(P, e, t, src) {
        const pool = () => P.library.filter(c => (/\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type)) || /\bGate\b/.test(c.card.type));
        const got = [];
        for (let k = 0; k < 2; k++) { const p = pool().filter(c => !got.includes(c)); if (!p.length) break; const c = (P.isAI || AUTOPLAY) ? p[0] : await pickCard(P, p, `${src.card.name}: choose a basic land or Gate card (${k + 1} of 2)`, { required: false }); if (!c) break; got.push(c); }
        if (!got.length) { shuffle(P.library); return; }
        const first = got[0]; pull(P.library, first); resetObj(first); first.tapped = true; first.enteredTurn = G.turn; P.bf.push(first); fire('enters', { o: first }); fire('landfall', { o: first });
        if (got[1]) { pull(P.library, got[1]); P.hand.push(got[1]); }
        shuffle(P.library); log(`${P.name} fetch${you(P) ? '' : 'es'} ${got.map(c => c.card.name).join(' and ')}.`);
    },
    sl_wargling(P, e, t, src) { if (!onBf(src.uid) || !P.bf.some(x => isCreature(x) && pow(x) >= 4)) return; src.tp += 1; P.bf.filter(isCreature).forEach(x => x.tkw.push('trample')); log(`${src.card.name} gets +1/+0 and creatures you control gain trample until end of turn.`); },
    async sl_selvalaDraw(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || !onBf(x.uid) || !isCreature(x)) return;
        if (!allPerms().filter(c => isCreature(c) && c !== x).every(c => pow(x) > pow(c))) return;
        const X = G.players[x.owner]; const yes = (X.isAI || AUTOPLAY) ? true : await askYes(X, `${src.card.name}: draw a card?`, { card: src.card });
        if (yes) { log(`${X.name} ${you(X) ? 'draw' : 'draws'} a card.`); drawCards(X, 1); }
    },
    sl_partFriendship(P, e, t, src) {
        let i = P.library.length - 1; while (i >= 0 && !/\bCreature\b/.test(P.library[i].card.type)) i--;
        const revealed = P.library.splice(Math.max(0, i), P.library.length - Math.max(0, i)); // i < 0: the whole library is revealed
        const found = i >= 0 ? revealed.shift() : null; // the creature card is the first (deepest) of the revealed cards
        const lands = P.bf.filter(o => /\bLand\b/.test(o.card.type)).length;
        shuffle(revealed).forEach(c => P.library.unshift(c));
        if (!found) { log('No creature card is revealed.'); return; }
        log(`${P.name} reveal${you(P) ? '' : 's'} ${found.card.name}.`);
        if ((found.card.cmc || 0) <= lands) { P.library.push(found); reanimateFromLib(P, P, found); } else { P.hand.push(found); log(`${found.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    sl_scalePT(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; const k = e.k || 2; x.tp += pow(x) * (k - 1); x.tq += tou(x) * (k - 1); log(`${x.card.name} gets its power and toughness ${k === 2 ? 'doubled' : 'tripled'} until end of turn.`); },
    async sl_bindLife(P, e, t, src) {
        const milled = doMill(P, 7); const pool = milled.filter(c => P.gy.includes(c) && /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
        const c = await slPickFrom(P, pool, `${src.card.name}: put a creature card from among them onto the battlefield`, true); if (c) reanimateFrom(P, P, c);
    }
});
Object.assign(CMD_SCORE, { sl_animaEdict: () => 6, sl_ramuh: () => 4, sl_valefor: () => 4, sl_shiva: () => 3, sl_leviathanBounce: () => 2, sl_magus: () => 4, sl_scalePT: () => 3, sl_bindLife: () => 6, sl_partFriendship: () => 4, sl_navOrb: () => 2, sl_horizon: () => 2, sl_wargling: () => 2 });

// ===== batch 3 =====
const slCtrs = o => Math.max(0, o.counters || 0) + Object.values(o.ctr || {}).reduce((a, v) => a + (v > 0 ? v : 0), 0);
TRIG_FN.sl_hostAttacks = (o, ctx) => !!o.attachedTo && (ctx.list || []).some(x => x.uid === o.attachedTo);
MANA_RIDERS.slYuna = function (P, o, srcPerm) { if (Rx(o).kind === 'creature') o.bt_extraCtr = (o.bt_extraCtr || 0) + 2; };
// Specs may now ask for "creature too" (Yuna, Hope of Spira: enchantment creatures)
{ const sm = specMatch; specMatch = function (spec, o, x, ctx) { if (spec && spec.alsoCreature && x && !isCreature(x)) return false; return sm.apply(this, arguments); }; }
// Yuna, Grand Summoner / Pizza Face: remember what left the battlefield
{
    const base = leaveBattlefield;
    leaveBattlefield = function (o, zone) {
        const owner = o && G && o.owner !== undefined ? G.players[o.owner] : null;
        const n = o && !o.token ? slCtrs(o) : 0;
        if (owner && o.uid !== undefined && onBf(o.uid)) owner.slLeftTurn = G.turn;
        const r = base.apply(this, arguments);
        if (owner && n > 0 && owner.gy.includes(o)) owner.bf.filter(y => Rx(y).slYunaGy && y !== o && !lostAbilities(y)).forEach(y => (G.trigQ = G.trigQ || []).push({ P: owner, o: y, effects: [cmd('sl_yunaCounters', { n })] }));
        return r;
    };
}
// Aura: its activated abilities can't be activated (Stuck in Summoner's Sanctum)
{
    const base = canActivate;
    canActivate = function (P, o, a) { if (o && o.uid !== undefined && attachmentsOf(o.uid).some(x => Rx(x).slNoActs)) return false; return base.apply(this, arguments); };
}
// The Millennium Calendar: permanents untapped in your untap step add time counters (watched at the start of your first main phase)
{
    const base = mesmeric; // called once at the end of each untap step with the number of permanents that untapped
    mesmeric = function (X, n) { const r = base.apply(this, arguments); if (n > 0 && X) X.bf.filter(x => Rx(x).slCalendar && !lostAbilities(x)).forEach(x => { x.ctr.time = (x.ctr.time || 0) + n; log(`${x.card.name} gets ${n} time counter${n === 1 ? '' : 's'}.`); slCalendarCheck(x); }); return r; };
}
function slCalendarCheck(o) { if (Rx(o).slCalendarWin && (o.ctr.time || 0) >= 1000 && onBf(o.uid)) { const P = G.players[o.owner]; leaveBattlefield(o, 'gy'); foes(P).forEach(F => { F.life -= 1000; log(`${F.name} loses 1000 life.`); }); } }
// Famished Worldsire: devour land 3 (sacrifice any number of lands as it enters; three +1/+1 counters for each)
{
    const base = putOntoBattlefield;
    putOntoBattlefield = function (P, o, tapped) { const r = base.apply(this, arguments); slDevourLand(P, o); return r; };
}
async function slDevourLand(P, o) {
    if (!o || !Rx(o).slDevourLand || !onBf(o.uid)) return;
    const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type));
    let n = 0;
    if (P.isAI || AUTOPLAY) n = Math.min(lands.length, Math.max(0, lands.filter(x => x.tapped).length - 0, lands.length - 5)); else { n = await askNumber(P, `${o.card.name}: sacrifice how many lands? (three +1/+1 counters for each)`, 0, lands.length, 0, { card: o.card }); }
    if (!n) return;
    const fs = await chooseSacN(P, lands, n, o.card.name); fs.forEach(f => { leaveBattlefield(f, 'gy'); });
    putCounters(o, 3 * fs.length, P); log(`${o.card.name} devours ${fs.length} land${fs.length === 1 ? '' : 's'} and gets ${3 * fs.length} +1/+1 counters.`);
}
Object.assign(CMD, {
    // Esper Origins
    async sl_esperOrigins(P, e, t, src) { await applyEffect(P, { t: 'surveil', n: 2 }, null, src); gainLifeFor(P, 2); if (src.sx_castZone === 'gy') src.slFlipBf = true; },
    sl_maduin1(P, e, t, src) { const c = P.library[P.library.length - 1]; if (!c) return; log(`${P.name} reveal${you(P) ? '' : 's'} ${c.card.name}.`); if (slIsPerm(c)) { P.library.pop(); P.hand.push(c); log(`${c.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); } },
    sl_maduin3(P, e, t, src) { P.bf.filter(x => isCreature(x) && x !== src).forEach(x => { x.tp += 2; x.tq += 2; x.tkw.push('trample'); }); log('Other creatures you control get +2/+2 and gain trample until end of turn.'); },
    sl_stampede(P, e, t, src) { P.bf.filter(x => isCreature(x) && x !== src).forEach(x => { x.tp += 1; }); log('Other creatures you control get +1/+0 until end of turn.'); },
    // Yuna, Grand Summoner: +1/+1 counters equal to the counters the permanent had
    async sl_yunaCounters(P, e, t, src) {
        const pool = P.bf.filter(isCreature).filter(c => !has(c, 'shroud')); if (!pool.length || !e.n) return;
        const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put ${e.n} +1/+1 counters on a creature (or none)`, { required: false });
        if (c) { const got = putCounters(c, e.n, P); log(`${c.card.name} gets ${got} +1/+1 counters.`); }
    },
    // Yuna, Hope of Spira
    async sl_yunaReturn(P, e, t, src) {
        const pool = P.gy.filter(c => /\bEnchantment\b/.test(c.card.type)); if (!pool.length) return;
        const c = await slPickFrom(P, pool, `${src.card.name}: return an enchantment card from your graveyard (or none)`, false); if (!c) return;
        reanimateFrom(P, P, c); c.ctr.finality = 1; log(`${c.card.name} gets a finality counter.`);
    },
    // Summoner's Grimoire
    async sl_grimoire(P, e, t, src) {
        const host = G.players.flatMap(X => X.bf).find(x => x.uid === src.attachedTo); if (!host) return;
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
        const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${src.card.name}: put a creature card from your hand onto the battlefield (or none)`, { required: false });
        if (!c) return;
        const ench = /\bEnchantment\b/.test(c.card.type);
        pull(P.hand, c); putOntoBattlefield(P, c, ench);
        if (ench) { (G.attackers = G.attackers || []).push(c.uid); c.atkTo = host.atkTo; log(`${c.card.name} enters tapped and attacking.`); }
    },
    // Pizza Face, Gastromancer
    async sl_pizzaFace(P, e, t, src) {
        if (P.slLeftTurn !== G.turn) return;
        const pool = allPerms().filter(x => x !== src && x.owner === P.i && (isCreature(x) || /\bArtifact\b/.test(x.card.type)) && !has(x, 'shroud'));
        if (!pool.length) return;
        const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (isCreature(b) - isCreature(a)) || creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put three +1/+1 counters on up to one other artifact or creature`, { required: false });
        if (!c) return;
        if (!isCreature(c)) { c.card = { ...c.card, type: c.card.type.replace(/^(.*?)(—|$)/, (m0, a, b) => `${a.trim()} Creature ${b}`).replace(/\s+/g, ' ') + (/—/.test(c.card.type) ? ' Mutant' : ' — Mutant'), power: '0', toughness: '0' }; c.pizzaMutant = true; }
        putCounters(c, 3, P); log(`${c.card.name} gets three +1/+1 counters.`);
    },
    // Famished Worldsire
    async sl_worldsire(P, e, t, src) {
        const x = Math.max(0, pow(src)); const top = P.library.splice(Math.max(0, P.library.length - x), x).reverse(); if (!top.length) return;
        const lands = top.filter(c => /\bLand\b/.test(c.card.type)); const rest = top.filter(c => !lands.includes(c));
        let take = lands;
        if (!(P.isAI || AUTOPLAY) && lands.length) { take = []; let left = lands.slice(); while (left.length) { const c = await pickCard(P, left, `${src.card.name}: put a land onto the battlefield tapped (or stop)`, { required: false }); if (!c) break; take.push(c); left = left.filter(y => y !== c); } rest.push(...lands.filter(c => !take.includes(c))); }
        take.forEach(c => { resetObj(c); c.tapped = true; c.enteredTurn = G.turn; P.bf.push(c); fire('enters', { o: c }); fire('landfall', { o: c }); });
        rest.forEach(c => P.library.unshift(c)); shuffle(P.library); log(`${src.card.name}: ${take.length} land${take.length === 1 ? '' : 's'} enter tapped.`);
    },
    // Rishadan Cutpurse
    async sl_cutpurse(P, e, t, src) {
        for (const F of foes(P)) {
            const pay = F.isAI || AUTOPLAY ? !!planPayment(F, parseCost('{1}'), 0, null, {}) : (!!planPayment(F, parseCost('{1}'), 0, null, {}) && await askYes(F, `${src.card.name}: pay {1}? (Otherwise sacrifice a permanent.)`, { card: src.card, yes: 'Pay {1}', no: 'Sacrifice a permanent' }));
            if (pay) { const plan = planPayment(F, parseCost('{1}'), 0, null, {}); if (plan) plan.forEach(x => tapSource(F, x)); log(`${F.name} pay${you(F) ? '' : 's'} {1}.`); continue; }
            const pool = F.bf.slice(); if (!pool.length) continue;
            const f = (F.isAI || AUTOPLAY) ? pool.slice().sort((x, y) => permValue(x) - permValue(y))[0] : await pickCard(F, pool, `${src.card.name}: choose a permanent to sacrifice`, { required: true }); if (f) { leaveBattlefield(f, 'gy'); log(`${F.name} sacrifice${you(F) ? '' : 's'} ${f.card.name}.`); }
        }
    },
    // Replicating Ring
    async sl_replicatingRing(P, e, t, src) {
        if (!onBf(src.uid)) return; src.ctr.night = (src.ctr.night || 0) + 1;
        if (src.ctr.night >= 8) {
            src.ctr.night = 0;
            for (let k = 0; k < 8; k++) slMakeRing(P);
        }
    },
    // The Millennium Calendar
    sl_calendarDouble(P, e, t, src) { if (!onBf(src.uid)) return; src.ctr.time = (src.ctr.time || 0) * 2; log(`${src.card.name} has ${src.ctr.time} time counters.`); slCalendarCheck(src); },
    async sl_grozothSearch(P, e, t, src) {
        const pool = P.library.filter(c => (c.card.cmc || 0) === 9); if (!pool.length) { shuffle(P.library); return; }
        const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: search your library for cards with mana value 9?`, { card: src.card }); if (!yes) return;
        pool.forEach(c => { pull(P.library, c); P.hand.push(c); }); shuffle(P.library); log(`${P.name} put${you(P) ? '' : 's'} ${pool.map(c => c.card.name).join(', ')} into ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Extravagant Replication
    async sl_extravRepl(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && !/\bLand\b/.test(x.card.type) && !has(x, 'shroud')); if (!pool.length) return;
        const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: create a token copy of a nonland permanent`, { required: false });
        if (c && typeof tokenCopyOf === 'function') { tokenCopyOf(P, c.card, {}); log(`${P.name} create${you(P) ? '' : 's'} a token that's a copy of ${c.card.name}.`); }
    },
    // Stuck in Summoner's Sanctum / Honest Work / Observed Stasis
    sl_tapHost(P, e, t, src) { const h = G.players.flatMap(X => X.bf).find(x => x.uid === src.attachedTo); if (h) { h.tapped = true; log(`${h.card.name} is tapped.`); } },
    sl_tapRemoveCounters(P, e, t, src) { G.slHumbleOn = true; const h = G.players.flatMap(X => X.bf).find(x => x.uid === src.attachedTo); if (!h) return; h.tapped = true; h.counters = 0; h.ctr = {}; log(`${h.card.name} is tapped and loses all counters.`); },
    sl_observedStasis(P, e, t, src) {
        const h = G.players.flatMap(X => X.bf).find(x => x.uid === src.attachedTo); if (!h) return;
        G.attackers = (G.attackers || []).filter(u => u !== h.uid); if (G.blocks) delete G.blocks[h.uid];
        const X = G.players[h.owner]; const n = X.bf.filter(x => isCreature(x) && x.tapped).length; log(`${h.card.name} is removed from combat.`); if (n) drawCards(P, n);
    }
});
// A Replicated Ring token (a snow artifact that taps for any color)
function slMakeRing(P) {
    const card = { id: `token-ring-${uidSeq}`, name: 'Replicated Ring', fullName: 'Replicated Ring', cost: '', cmc: 0, type: 'Snow Artifact', text: '{T}: Add one mana of any color.', colors: [], ci: [], img: null, imgS: null, legal: {} };
    const o = makeObj(card, P.i, { token: true }); P.bf.push(o); fire('enters', { o }); tokenMade(P);
}
Object.assign(CMD_SCORE, { sl_esperOrigins: () => 4, sl_sylvanLibrary: () => 1, sl_yunaReturn: () => 2, sl_pizzaFace: () => 2, sl_worldsire: () => 4, sl_cutpurse: () => 5, sl_replicatingRing: () => 1, sl_extravRepl: () => 3, sl_grozothSearch: () => 5 });

// ===== batch 4 =====
TRIG_FN.sl_attacksMe = (o, ctx) => (ctx.list || []).some(x => x.owner !== o.owner && (x.atkTo == null || x.atkTo === o.owner));
TRIG_FN.sl_nogTapped = (o, ctx) => ctx.o === o && (o.slNog || 0) >= 1;
TRIG_FN.sl_level3 = (o, ctx) => ctx.o === o && ctx.lvl === 3;
{ const sm = stackMatches; stackMatches = function (it, filter) { if (filter === 'slAbility') return it.kind === 'trigger'; return sm.apply(this, arguments); }; }
// Casting: Aetherflux Conduit energy, Urianger's life, Brynhildr's haste, G.F. Cerberus's copies, Good King Mog's token copies
{
    const base = fire;
    fire = function (ev, ctx) {
        const r = base.apply(this, arguments);
        try {
            if (ev === 'cast' && ctx && ctx.P && ctx.o) {
                const P = ctx.P, o = ctx.o, k = Rx(o).kind;
                P.bf.filter(x => Rx(x).slConduit && !lostAbilities(x)).forEach(() => { const n = o.manaSpent !== undefined ? o.manaSpent : (o.card.cmc || 0); if (n > 0) { P.energy = (P.energy || 0) + n; log(`${P.name} get${you(P) ? '' : 's'} ${n} {E} (Aetherflux Conduit).`); } });
                if (o.sx_castZone === 'exile' && P.bf.some(x => Rx(x).slUrianger && !lostAbilities(x))) { log('Urianger Augurelt: a spell was cast from exile.'); gainLifeFor(P, 2); }
                if (k === 'creature' && P.slHasteNext === G.turn) { P.slHasteNext = 0; o.hasteOnEnter = G.turn; log(`${o.card.name} will have haste (Summon: Brynhildr).`); }
                if ((k === 'instant' || k === 'sorcery') && P.slCerb && P.slCerb.turn === G.turn) { const c = P.slCerb; P.slCerb = null; for (let i = 0; i < c.n; i++) (G.trigQ = G.trigQ || []).push({ P, o: c.o, effects: [cmd('sl_cerberusCopy')] }); }
                if (k === 'creature' && P.slYunaNext === G.turn) { P.slYunaNext = 0; o.bt_extraCtr = (o.bt_extraCtr || 0) + 2; log(`${o.card.name} enters with two additional +1/+1 counters (Yuna).`); }
                if (k !== 'creature' && P.slMog && P.slMog.turn === G.turn) { const tok = P.bf.filter(x => x.token && !/\bSaga\b/.test(x.card.type)).sort((a, b) => permValue(b) - permValue(a))[0]; if (tok) (G.trigQ = G.trigQ || []).push({ P, o: P.slMog.o, effects: [{ t: 'tokenCopyCard', card: tok.card }] }); }
            }
            // Initiative: a creature that deals combat damage to the player with the initiative steals it
            if (ev === 'hitPlayer' && ctx && ctx.src && ctx.hit && G.initiative !== undefined && G.initiative !== null) ctx.hit.forEach(X => { if (X && X.life !== undefined && X.i === G.initiative && ctx.src.owner !== X.i && !G.players[ctx.src.owner].out) { slTakeInitiative(G.players[ctx.src.owner], ctx.src); } });
            // The Ring: level 2 loots when the ring-bearer attacks; level 4 drains
            if (ev === 'attacks' && ctx && ctx.list) ctx.list.forEach(x => { const R0 = G.players[x.owner].slRing; if (R0 && R0.bearer === x.uid && R0.level >= 2) { const X = G.players[x.owner]; drawCards(X, 1); if (X.hand.length) { const d = X.hand.slice().sort((a, b) => aiKeepValue(X, a) - aiKeepValue(X, b))[0]; pull(X.hand, d); X.gy.push(d); d.discardTurn = G.turn; noteDiscard(X, 1); log(`${X.name} draw${you(X) ? '' : 's'} a card and discard${you(X) ? '' : 's'} ${d.card.name} (the Ring).`); } } });
            if (ev === 'hitPlayer' && ctx && ctx.src) { const R0 = G.players[ctx.src.owner].slRing; if (R0 && R0.bearer === ctx.src.uid && R0.level >= 4) { const X = G.players[ctx.src.owner]; foes(X).forEach(F => { F.life -= 3; log(`${F.name} loses 3 life (the Ring).`); }); } }
            if (ev === 'blocked' && ctx && ctx.o) { const R0 = G.players[ctx.o.owner].slRing; if (R0 && R0.bearer === ctx.o.uid && R0.level >= 3) (G.blocks[ctx.o.uid] || []).map(onBf).filter(Boolean).forEach(b => { b.sacEndCombat = true; }); }
        } catch (err) { /* never break a game for a side effect */ }
        return r;
    };
}
// The ring-bearer can't be blocked by creatures with greater power
{ const cb = canBlock; canBlock = function (b, atk) { if (atk && G && G.players[atk.owner] && G.players[atk.owner].slRing && G.players[atk.owner].slRing.bearer === atk.uid && pow(b) > pow(atk)) return false; return cb.apply(this, arguments); }; }
// Urianger: cards exiled with him cost {2} less while he lets you play them; foretold cards (Ethereal Valkyrie) cost their reduced foretell cost on a later turn
{
    const base = costOf;
    costOf = function (P, o) {
        const c = base.apply(this, arguments);
        if (!c || !G || !o) return c;
        if (o.slUriCut === G.turn && P.exile.includes(o)) return { ...c, generic: Math.max(0, (c.generic || 0) - 2) };
        if (o.slForeCost && o.slForeTurn < G.turn && P.exile.includes(o)) return { ...o.slForeCost };
        return c;
    };
}
{ const base = canCastNow; canCastNow = function (P, o) { if (o && G && o.slForeTurn === G.turn && P.exile.includes(o)) return false; return base.apply(this, arguments); }; }
{ const base = canActivate; canActivate = function (P, o, a) { if (a && a.slNeedBricks && ((o.ctr && o.ctr.brick) || 0) < 3) return false; return base.apply(this, arguments); }; }
{ const base = playLand; playLand = async function (P, o) { const fromEx = P && P.exile.includes(o); const r = await base.apply(this, arguments); if (fromEx && P.bf.some(x => Rx(x).slUrianger && !lostAbilities(x))) { log('Urianger Augurelt: a land was played from exile.'); gainLifeFor(P, 2); } return r; }; }
// Teferi, Who Slows the Sunset's emblem (at each opponent's untap step) 
{
    const base = mesmeric;
    mesmeric = function (X, n) {
        const r = base.apply(this, arguments);
        G.players.filter(Y => Y !== X && !Y.out && Y.slTeferi).forEach(Y => { Y.bf.forEach(o => { o.tapped = false; }); log(`${Y.name} untap${you(Y) ? '' : 's'} all permanents (Teferi's emblem) and draw${you(Y) ? '' : 's'} a card.`); drawCards(Y, 1); });
        return r;
    };
}
// Nog's Officer form: lands from your graveyard and an extra land drop
{
    const lz = extraLandZones; extraLandZones = function (P) { const out = lz.apply(this, arguments); if (P.bf.some(x => (x.slNog || 0) >= 2 && !lostAbilities(x))) P.gy.filter(x => Rx(x).kind === 'land').forEach(x => { if (!out.includes(x)) out.push(x); }); return out; };
    const ll = landLimit; landLimit = function (P) { return ll.apply(this, arguments) + (P.bf.some(x => (x.slNog || 0) >= 2 && !lostAbilities(x)) ? 1 : 0); };
}
// Druid Class: a land that is as big as the number of lands you control
{ const bp = basePT; basePT = function (o, which) { if (o && o.slDynPT && G) return G.players[o.owner].bf.filter(x => /\bLand\b/.test(x.card.type)).length; return bp.apply(this, arguments); }; }

// ---- The Undercity (initiative) and the Ring ----
const SL_UNDER = { 'Secret Entrance': ['Forge', 'Lost Well'], 'Forge': ['Trap!', 'Arena'], 'Lost Well': ['Arena', 'Stash'], 'Trap!': ['Archives'], 'Arena': ['Archives', 'Catacombs'], 'Stash': ['Catacombs'], 'Archives': ['Throne of the Dead Three'], 'Catacombs': ['Throne of the Dead Three'], 'Throne of the Dead Three': [] };
async function slVenture(P) {
    const d = P.slDungeon;
    let room;
    if (!d || d.done) room = 'Secret Entrance';
    else { const nx = SL_UNDER[d.room]; room = nx.length === 1 || P.isAI || AUTOPLAY ? nx[0] : ((await askYes(P, `Venture into the Undercity: go to ${nx[0]} or ${nx[1]}?`, { yes: nx[0], no: nx[1] })) ? nx[0] : nx[1]); }
    P.slDungeon = { room, done: room === 'Throne of the Dead Three' };
    log(`${P.name} venture${you(P) ? '' : 's'} into the Undercity: ${room}.`);
    const mine = P.bf.filter(isCreature).sort((a, b) => creatureValue(b) - creatureValue(a));
    switch (room) {
        case 'Secret Entrance': { const b = P.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type))[0]; if (b) { pull(P.library, b); P.hand.push(b); shuffle(P.library); log(`${P.name} put${you(P) ? '' : 's'} ${b.card.name} into ${you(P) ? 'your' : 'their'} hand.`); } break; }
        case 'Forge': { const c = mine.length > 1 && !(P.isAI || AUTOPLAY) ? await pickCard(P, mine, 'Forge: put two +1/+1 counters on a creature you control', { required: true }) : mine[0]; if (c) putCounters(c, 2, P); break; }
        case 'Lost Well': await applyEffect(P, { t: 'scry', n: 2 }, null, G.initSrc || mine[0] || P.bf[0]); break;
        case 'Trap!': { const fs = foes(P).slice().sort((a, b) => a.life - b.life); const F = fs.length > 1 && !(P.isAI || AUTOPLAY) ? (await askYes(P, `Trap!: ${fs[0].name} loses 5 life? (Otherwise ${fs[1].name}.)`, { yes: fs[0].name, no: fs[1].name }) ? fs[0] : fs[1]) : fs[0]; if (F) { F.life -= 5; F.lostTurn = G.turn; log(`${F.name} loses 5 life.`); } break; }
        case 'Arena': { const cs = foes(P).flatMap(F => F.bf.filter(isCreature)).sort((a, b) => creatureValue(b) - creatureValue(a)); const c = cs.length > 1 && !(P.isAI || AUTOPLAY) ? await pickCard(P, cs, 'Arena: goad a creature', { required: true }) : cs[0]; if (c) goad(c, P.i, nextTurnOf(P)); break; }
        case 'Stash': await applyEffect(P, { t: 'artToken', kind: 'treasure', n: 1 }, null, mine[0] || P.bf[0]); break;
        case 'Archives': drawCards(P, 1); break;
        case 'Catacombs': await applyEffect(P, { t: 'token', n: 1, p: 4, q: 1, name: 'black Skeleton', kw: ['menace'] }, null, mine[0] || P.bf[0]); break;
        case 'Throne of the Dead Three': {
            const top = P.library.splice(Math.max(0, P.library.length - 10), 10).reverse(); const cr = top.filter(c => /\bCreature\b/.test(c.card.type)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
            top.filter(c => c !== cr).forEach(c => P.library.unshift(c));
            if (cr) { P.library.push(cr); reanimateFromLib(P, P, cr); putCounters(cr, 3, P); cr.tkw.push('hexproof'); log(`${cr.card.name} enters with three +1/+1 counters and hexproof until your next turn.`); }
            P.slCompleted = (P.slCompleted || 0) + 1; break;
        }
    }
}
function slTakeInitiative(P, src) {
    G.initiative = P.i; G.initSrc = src || G.initSrc; log(`${P.name} take${you(P) ? '' : 's'} the initiative.`);
    G.delayed = (G.delayed || []).filter(d => !(d.label === 'Initiative' && d.P === P));
    (G.delayed = G.delayed || []).push({ at: 'upkeep', own: true, P, after: G.turn, effects: [cmd('sl_initiativeUpkeep')], src: src || P.bf[0], label: 'Initiative' });
    return slVenture(P);
}
async function slRingTempts(P) {
    const r = P.slRing = P.slRing || { level: 0, bearer: null };
    r.level = Math.min(4, r.level + 1); log(`The Ring tempts ${P.name} (level ${r.level}).`);
    const cs = P.bf.filter(isCreature); if (!cs.length) return;
    const c = (P.isAI || AUTOPLAY || cs.length === 1) ? cs.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, cs, 'The Ring tempts you: choose your Ring-bearer', { required: true });
    r.bearer = (c || cs[0]).uid; log(`${(c || cs[0]).card.name} is ${P.name}'s Ring-bearer.`);
}
Object.assign(CMD, {
    sl_brynExile(P, e, t, src) { const c = P.library.pop(); if (!c) return; P.exile.push(c); c.slBryn = src.uid; c.playUntil = G.turn; log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name}; ${you(P) ? 'you' : 'they'} may play it this turn.`); },
    sl_brynPlay(P, e, t, src) { P.exile.filter(c => c.slBryn === src.uid).forEach(c => { c.playUntil = G.turn; }); },
    sl_brynHaste(P, e, t, src) { P.slHasteNext = G.turn; },
    sl_valiExile(P, e, t, src) {
        G.players.forEach(X => { const c = X.gy.filter(y => /\b(Instant|Sorcery)\b/.test(y.card.type)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0]; if (c) { pull(X.gy, c); c.realOwner = c.owner; c.owner = P.i; c.slVali = src.uid; c.playUntil = -1; c.anyMana = true; P.exile.push(c); log(`${c.card.name} is exiled with ${src.card.name}.`); } });
    },
    sl_valiMana(P, e, t, src) { const n = src.ctr.lore || 0; if (n > 0) { P.pool = (P.pool || []).concat(Array.from({ length: n }, () => 'R')); log(`${P.name} add${you(P) ? '' : 's'} ${n} {R}.`); } P.exile.filter(c => c.slVali === src.uid).forEach(c => { c.playUntil = G.turn; }); },
    sl_cerberus(P, e, t, src) { P.slCerb = { turn: G.turn, n: e.n || 1, o: src }; },
    sl_mogCopies(P, e, t, src) { P.slMog = { turn: G.turn, o: src }; },
    sl_mogCounters(P, e, t, src) { P.bf.filter(x => x !== src && isCreature(x) && hasType(x, 'Moogle')).forEach(x => putCounters(x, 2, P)); },
    // Urianger Augurelt
    async sl_urianger1(P, e, t, src) {
        const c = P.library[P.library.length - 1]; if (!c) return;
        const yes = (P.isAI || AUTOPLAY) ? !/\bCreature\b/.test(c.card.type) || (c.card.cmc || 0) <= 4 : await askYes(P, `${src.card.name}: look at the top card of your library (${c.card.name}). Exile it face down?`, { card: c.card, yes: 'Exile it', no: 'Leave it' });
        if (yes) { P.library.pop(); P.exile.push(c); c.slUri = src.uid; c.playUntil = -1; log(`${P.name} exile${you(P) ? '' : 's'} a card face down with ${src.card.name}.`); }
    },
    sl_urianger2(P, e, t, src) { P.exile.filter(c => c.slUri === src.uid).forEach(c => { c.playUntil = G.turn; c.slUriCut = G.turn; }); },
    async sl_valkyrie(P, e, t, src) {
        drawCards(P, 1); if (!P.hand.length) return;
        const c = (P.isAI || AUTOPLAY) ? P.hand.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)).find(x => (x.card.cmc || 0) >= 3) || P.hand.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, P.hand, `${src.card.name}: exile a card from your hand face down (it becomes foretold)`, { required: true });
        if (!c) return; pull(P.hand, c); P.exile.push(c); c.foretoldTurn = G.turn; c.slForeTurn = G.turn; c.playUntil = 1e9;
        const full = parseCost(c.card.cost || ''); const cut = { ...full, generic: Math.max(0, (full.generic || 0) - 2) }; if ((full.generic || 0) < 2) { let rest = 2 - (full.generic || 0); cut.generic = 0; for (const k of ['W', 'U', 'B', 'R', 'G', 'C']) { while (rest > 0 && cut[k] > 0) { cut[k]--; rest--; } } }
        c.slForeCost = cut; log(`${P.name} exile${you(P) ? '' : 's'} a card face down; it becomes foretold.`);
    },
    sl_collectTap(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) { x.tapped = true; log(`${x.card.name} is tapped.`); } },
    async sl_teferiPlus(P, e, t, src) {
        const kinds = [o => /\bArtifact\b/.test(o.card.type), o => isCreature(o), o => /\bLand\b/.test(o.card.type)];
        for (const k of kinds) {
            const pool = allPerms().filter(k).filter(o => o.owner === P.i ? o.tapped : (!o.tapped && !has(o, 'shroud') && !has(o, 'hexproof')));
            if (!pool.length) continue;
            const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => ((b.owner === P.i) - (a.owner === P.i)) || permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: choose a permanent to untap (yours) or tap (an opponent's), or none`, { required: false });
            if (c) { c.tapped = c.owner !== P.i; log(`${c.card.name} ${c.tapped ? 'is tapped' : 'untaps'}.`); }
        }
        gainLifeFor(P, 2);
    },
    sl_teferiEmblem(P, e, t, src) { P.slTeferi = true; log(`${P.name} get${you(P) ? '' : 's'} an emblem: untap all permanents during each opponent's untap step and draw a card during each opponent's draw step.`); },
    async sl_warLast(P, e, t, src) { P.bf.filter(isCreature).forEach(x => x.tkw.push('double strike')); log('Creatures you control gain double strike until end of turn.'); await slRingTempts(P); },
    async sl_takeInitiative(P, e, t, src) { await slTakeInitiative(P, src); },
    async sl_initiativeUpkeep(P, e, t, src) { if (G.initiative !== P.i) return; await slVenture(P); G.delayed = (G.delayed || []).filter(d => !(d.label === 'Initiative' && d.P === P)); G.delayed.push({ at: 'upkeep', own: true, P, after: G.turn, effects: [cmd('sl_initiativeUpkeep')], src: src || P.bf[0], label: 'Initiative' }); },
    sl_plumeUntap(P, e, t, src) {
        if (G.active === P.i || !onBf(src.uid)) return;
        const tapped = P.bf.filter(x => isCreature(x) && x.tapped); if (!tapped.length) return;
        if ((P.slCompleted || 0) > 0) { tapped.forEach(x => { x.tapped = false; }); log(`${P.name} untap${you(P) ? '' : 's'} all ${you(P) ? 'their' : 'their'} creatures.`); } else { const c = tapped.sort((a, b) => creatureValue(b) - creatureValue(a))[0]; c.tapped = false; log(`${c.card.name} untaps.`); }
    },
    // Gogo
    async sl_conduit(P, e, t, src) {
        drawCards(P, 7);
        for (const c of P.hand.filter(x => !/\bLand\b/.test(x.card.type)).slice()) {
            if (!P.hand.includes(c)) continue;
            const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card, yes: 'Cast it', no: 'Keep it' });
            if (yes) await castFreeAuto(P, c);
        }
    },
    async sl_amplifier(P, e, t, src) {
        const cands = P.bf.filter(x => slCtrs(x) > 0);
        const modeOwn = (P.isAI || AUTOPLAY) ? !cands.length && ((P.energy || 0) > 0 || (P.rad || 0) < 0) : await askYes(P, `${src.card.name}: double the counters you have (energy)? Otherwise double the counters on a permanent.`, { card: src.card, yes: 'Mine', no: 'A permanent' });
        if (modeOwn) { P.energy = (P.energy || 0) * 2; log(`${P.name} now ${you(P) ? 'have' : 'has'} ${P.energy} {E}.`); return; }
        const pool = allPerms().filter(x => slCtrs(x) > 0 && !has(x, 'shroud')); if (!pool.length) return;
        const c = (P.isAI || AUTOPLAY) ? pool.filter(x => x.owner === P.i).sort((a, b) => slCtrs(b) - slCtrs(a))[0] || null : await pickCard(P, pool, `${src.card.name}: double the counters on a permanent`, { required: false });
        if (!c) return; if (c.counters > 0) c.counters *= 2; Object.keys(c.ctr || {}).forEach(k => { if (c.ctr[k] > 0) c.ctr[k] *= 2; }); log(`The counters on ${c.card.name} are doubled.`);
    },
    async sl_benthic(P, e, t, src) {
        const picks = []; for (const F of foes(P)) { const cs = F.bf.filter(isCreature).sort((a, b) => creatureValue(b) - creatureValue(a)); if (!cs.length) continue; picks.push(cs.length > 1 && !(P.isAI || AUTOPLAY) ? await pickCard(P, cs, `${src.card.name}: choose a creature ${F.name} controls`, { required: true }) : cs[0]); } if (!picks.length) return;
        const tp = picks.reduce((a, c) => a + Math.max(0, pow(c)), 0), tq = picks.reduce((a, c) => a + Math.max(0, tou(c)), 0);
        const best = (P.isAI || AUTOPLAY || picks.length === 1) ? picks.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, picks, `${src.card.name}: choose which one to copy`, { required: true });
        const tok = tokenCopyOf(P, { ...best.card, colors: [], ci: [], type: 'Creature — Eldrazi' }, { p: tp, q: tq }); if (tok) log(`${tok.card.name} is a colorless Eldrazi ${tp}/${tq}.`);
    },
    async sl_fishing(P, e, t, src) {
        const X = (G.ctxRaw && G.ctxRaw.hit || []).find(y => y && y.life !== undefined && y !== P); if (!X || !X.library.length) return;
        const c = X.library.pop(); X.exile.push(c); log(`${c.card.name} is exiled from the top of ${X.name}'s library.`);
        let took = false;
        if (slIsPerm(c)) { const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: put ${c.card.name} onto the battlefield under your control?`, { card: c.card }); if (yes) { pull(X.exile, c); c.realOwner = c.owner; c.owner = P.i; putOntoBattlefield(P, c, false); took = true; } }
        if (!took) await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'blue Fish', kw: [] }, null, src);
    },
    sl_copyPerm(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) tokenCopyOf(P, x.card); },
    sl_vault1(P, e, t, src) { const c = P.library.pop(); if (!onBf(src.uid)) return; src.ctr.brick = (src.ctr.brick || 0) + 1; if (!c) return; P.exile.push(c); c.playUntil = G.turn; log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name}; ${you(P) ? 'you' : 'they'} may play it this turn.`); },
    sl_vault2(P, e, t, src) { const c = P.library.pop(); if (!c) return; P.exile.push(c); c.playUntil = G.turn; c.freeCast = true; log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name}; ${you(P) ? 'you' : 'they'} may play it this turn without paying its mana cost.`); },
    async sl_struggleChoose(P, e, t, src) { const bro = (P.isAI || AUTOPLAY) ? foes(P).length === 1 && false : await askYes(P, `${src.card.name}: choose Brotherhood (each opponent draws, you draw for each) or Enclave (rad counters)?`, { card: src.card, yes: 'Brotherhood', no: 'Enclave' }); src.slMode = bro ? 'brotherhood' : 'enclave'; log(`${src.card.name}: ${src.slMode === 'brotherhood' ? 'Brotherhood' : 'Enclave'}.`); },
    sl_brotherhood(P, e, t, src) { if (src.slMode !== 'brotherhood') return; let n = 0; foes(P).forEach(F => { drawCards(F, 1); n++; }); if (n) drawCards(P, n); },
    sl_enclave(P, e, t, src) {
        if (src.slMode !== 'enclave') return; const list = (G.ctxRaw && G.ctxRaw.list) || G.attackers.map(onBf).filter(Boolean);
        const by = new Map(); list.filter(x => x.owner !== src.owner && (x.atkTo == null || x.atkTo === src.owner)).forEach(x => by.set(x.owner, (by.get(x.owner) || 0) + 1)); by.forEach((n, i) => addRad(G.players[i], 2 * n));
    },
    sl_theoristDraw(P, e, t, src) { if (G.active === P.i || !onBf(src.uid)) return; drawCards(P, 1); },
    async sl_theoristBounce(P, e, t, src) {
        for (const F of foes(P)) {
            const pool = F.bf.filter(x => (isCreature(x) || /\bArtifact\b/.test(x.card.type)) && !has(x, 'hexproof') && !has(x, 'shroud'));
            if (!pool.length) continue;
            const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: return up to one artifact or creature ${F.name} controls to its owner's hand`, { required: false });
            if (c) { leaveBattlefield(c, 'hand'); log(`${c.card.name} returns to its owner's hand.`); }
        }
    },
    sl_theoristUlt(P, e, t, src) { drawCards(P, 3); const x = P.hand.length; P.bf.filter(isCreature).forEach(c => putCounters(c, x, P)); log(`Each creature you control gets ${x} +1/+1 counters.`); },
    sl_tidebinder(P, e, t, src) {
        const it = t && t.item; if (!it) return; pull(G.stack, it); log(`${it.name || 'An ability'} is countered.`);
        const o = it.o; if (o && onBf(o.uid) && (isCreature(o) || /\b(Artifact|Planeswalker)\b/.test(o.card.type))) { o.noAbilBy = src.uid; log(`${o.card.name} loses all abilities for as long as ${src.card.name} remains on the battlefield.`); }
    },
    // Nog
    sl_nog1(P, e, t, src) { if (!onBf(src.uid) || (src.slNog || 0) !== 0 || !hasType(src, 'Rogue')) return; src.slNog = 1; src.card = { ...src.card, type: src.card.type.replace(/\bRogue\b/, 'Ferengi Scout'), power: '3', toughness: '4' }; log(`${src.card.name} becomes a Ferengi Scout 3/4.`); },
    sl_nog2(P, e, t, src) { if (!onBf(src.uid) || src.slNog !== 1) return; src.slNog = 2; src.card = { ...src.card, type: src.card.type.replace(/\bScout\b/, 'Officer') }; log(`${src.card.name} becomes a Ferengi Officer.`); },
    // Druid Class (level 3)
    async sl_druidClass(P, e, t, src) {
        const pool = P.bf.filter(x => /\bLand\b/.test(x.card.type) && !has(x, 'shroud')); if (!pool.length) return;
        const c = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (a.tapped - b.tapped) || permValue(a) - permValue(b))[0] : await pickCard(P, pool, `${src.card.name}: target land you control becomes a creature`, { required: true });
        if (!c) return; c.slDynPT = true; c.card = { ...c.card, type: /Creature/.test(c.card.type) ? c.card.type : c.card.type.replace(/\bLand\b/, 'Land Creature'), power: '0', toughness: '0' }; c.tkw.push('haste'); c.sick = false; log(`${c.card.name} becomes a creature with haste (as big as your number of lands).`);
    }
});
Object.assign(CMD_SCORE, { sl_brynExile: () => 4, sl_valiExile: () => 3, sl_conduit: () => 10, sl_amplifier: () => 3, sl_benthic: () => 6, sl_tidebinder: () => 5, sl_theoristBounce: () => 4, sl_theoristUlt: () => 6, sl_teferiPlus: () => 4, sl_urianger1: () => 2, sl_valkyrie: () => 3, sl_druidClass: () => 5, sl_vault1: () => 2, sl_vault2: () => 4, sl_nog1: () => 3, sl_nog2: () => 3 });

// ===== Case of the Locked Hothouse (solved at your end step with seven or more lands) and Exploration Broodship (3+ charge counters) =====
const slHothouseOn = P => P.bf.some(x => Rx(x).slHothouseTop && x.slSolved && !lostAbilities(x));
const slBroodOn = P => P.bf.some(x => Rx(x).slBroodship && (x.ctr.charge || 0) >= Rx(x).slBroodship && !lostAbilities(x));
{
    const base = topCastOk;
    topCastOk = function (P, o) { if (base.apply(this, arguments)) return true; return !!o && Rx(o).kind === 'enchantment' && P.library[P.library.length - 1] === o && slHothouseOn(P); };
}
{
    const lz = extraLandZones;
    extraLandZones = function (P) { const out = lz.apply(this, arguments); const top = P.library[P.library.length - 1]; if (top && Rx(top).kind === 'land' && slHothouseOn(P) && !out.includes(top)) out.push(top); return out; };
    const ll = landLimit;
    landLimit = function (P) { return ll.apply(this, arguments) + (slBroodOn(P) ? 1 : 0); };
}
{
    const base = gyCastOk;
    gyCastOk = function (P, o) {
        if (base.apply(this, arguments)) return true;
        return !!o && P.gy.includes(o) && P.slBroodTurn !== G.turn && P.bf.some(x => Rx(x).slBroodshipGy && (x.ctr.charge || 0) >= (Rx(x).slBroodship || 3) && !lostAbilities(x)) && P.bf.some(x => /\bLand\b/.test(x.card.type)) && ['artifact', 'creature', 'enchantment', 'planeswalker', 'battle', 'other'].includes(Rx(o).kind);
    };
}
{
    const base = fire;
    fire = function (ev, ctx) {
        const r = base.apply(this, arguments);
        try {
            if (ev === 'cast' && ctx && ctx.P && ctx.o && ctx.o.sx_castZone === 'gy' && !Rx(ctx.o).flashback && ctx.P.slBroodTurn !== G.turn && slBroodOn(ctx.P) && ctx.P.bf.some(x => Rx(x).slBroodshipGy && (x.ctr.charge || 0) >= 3)) {
                const P = ctx.P; const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type));
                if (lands.length) { P.slBroodTurn = G.turn; const f = lands.sort((a, b) => (b.tapped - a.tapped) || permValue(a) - permValue(b))[0]; leaveBattlefield(f, 'gy'); log(`${P.name} sacrifice${you(P) ? '' : 's'} ${f.card.name} (Exploration Broodship).`); }
            }
        } catch (err) { /* ignore */ }
        return r;
    };
}
Object.assign(CMD, { sl_caseSolve(P, e, t, src) { if (src.slSolved || !onBf(src.uid)) return; if (P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= 7) { src.slSolved = true; log(`${src.card.name} is solved.`); } } });


// ===== simplified things built out (2026-11-15, owner: "build them out and fix them") =====
// Cards drawn this turn are remembered (Sylvan Library may put back any two of them, the normal draw included)
{ const base = drawCards; drawCards = function (P, n, quiet) { const before = P.hand.length; const r = base.apply(this, arguments); if (G) P.hand.slice(before).forEach(c => { c.slDrawnTurn = G.turn; }); return r; }; }
// Sylvan Library, called right after the normal draw of your draw step (06-engine.js beginTurn)
async function slLibraryDrawStep(P) {
    for (const lib of P.bf.filter(x => Rx(x).slLibrary && !lostAbilities(x))) {
        const yes = (P.isAI || AUTOPLAY) ? P.library.length > 12 : await askYes(P, `${lib.card.name}: draw two additional cards?`, { card: lib.card });
        if (!yes) continue;
        drawCards(P, 2);
        const pool = () => P.hand.filter(c => c.slDrawnTurn === G.turn && !c.slLibDone);
        for (let k = 0; k < 2; k++) {
            const choices = pool(); if (!choices.length) break;
            const c = (P.isAI || AUTOPLAY) ? choices.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b))[0] : await pickCard(P, choices, `${lib.card.name}: choose a card drawn this turn (${k + 1} of 2); pay 4 life or put it on top of your library`, { required: true });
            if (!c) break; c.slLibDone = true;
            const canPay = P.life > 4;
            const pay = canPay && ((P.isAI || AUTOPLAY) ? (P.life >= 16 && aiKeepValue(P, c) >= 5) : await askYes(P, `${lib.card.name}: pay 4 life to keep ${c.card.name}? (Otherwise it goes on top of your library.)`, { card: c.card, yes: 'Pay 4 life', no: 'Put it back' }));
            if (pay) { P.life -= 4; log(`${P.name} pay${you(P) ? '' : 's'} 4 life to keep ${c.card.name}.`); } else { pull(P.hand, c); P.library.push(c); log(`${P.name} put${you(P) ? '' : 's'} ${you(P) ? 'a card' : 'a card'} on top of ${you(P) ? 'your' : 'their'} library.`); }
        }
        P.hand.forEach(c => { delete c.slLibDone; });
    }
}
// Yuna, Grand Summoner: tapping her for mana sets up "when you next cast a creature spell this turn" (by hand or in a payment plan)
{ const ts = tapSource; tapSource = function (P, s) { const r = ts.apply(this, arguments); if (s && !s.pool && s.card && Rx(s).slYunaTap) P.slYunaNext = G.turn; return r; }; }
{ const tf = tapForMana; tapForMana = function (uid, color) { const o = onBf(uid), was = o && o.tapped; const r = tf.apply(this, arguments); if (o && !was && o.tapped && Rx(o).slYunaTap) G.players[o.owner].slYunaNext = G.turn; return r; }; }
// Flash Photography: flash when it targets a permanent you control (outside sorcery timing the target must be yours)
{
    const vt = validTargets;
    validTargets = function (P, e, src) { const r = vt.apply(this, arguments); if (src && src.card && src.uid !== undefined && Rx(src).slFlashPhoto && e && e.target === 'perm' && !(G.active === P.i && MAIN.includes(G.phase) && !G.stack.length)) return r.filter(x => x.o && x.o.owner === P.i); return r; };
}
// Honest Work: the creature has "{T}: Add {C}" (for its controller) while the Aura is on it
{
    const base = manaOf;
    manaOf = function (o) { if (G && G.slHumbleOn && o && o.uid !== undefined && /Creature/.test(o.card.type) && attachmentsOf(o.uid).some(a => Rx(a).slHumbleMerchant)) return { colors: ['C'], n: 1 }; return base.apply(this, arguments); };
}
// Forensic Researcher: collect evidence 3 is a real cost, paid when the ability is activated
async function slCollectEvidence(P, n, src) {
    const total = c => P.gy.reduce((a, x) => a + (x.card.cmc || 0), 0);
    if (total() < n) return false;
    const chosen = []; let sum = 0;
    if (P.isAI || AUTOPLAY) { for (const c of P.gy.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))) { if (sum >= n) break; chosen.push(c); sum += c.card.cmc || 0; } }
    else { while (sum < n) { const left = P.gy.filter(x => !chosen.includes(x)); const c = await pickCard(P, left, `${src.card.name}: collect evidence ${n} (${sum} of ${n} so far)`, { required: false }); if (!c) return false; chosen.push(c); sum += c.card.cmc || 0; } }
    chosen.forEach(c => { pull(P.gy, c); P.exile.push(c); }); log(`${P.name} collect${you(P) ? '' : 's'} evidence ${n}: exile${you(P) ? '' : 's'} ${chosen.map(c => c.card.name).join(', ')}.`);
    return true;
}
{ const base = activate; activate = async function (P, o, a) { if (a && a.slCollect && !(await slCollectEvidence(P, a.slCollect, o))) return false; return base.apply(this, arguments); }; }
{ const base = canActivate; canActivate = function (P, o, a) { if (a && a.slCollect && P.gy.reduce((x, c) => x + (c.card.cmc || 0), 0) < a.slCollect) return false; return base.apply(this, arguments); }; }
Object.assign(CMD, {
    // G.F. Cerberus: copy the spell you just cast; you may choose new targets
    async sl_cerberusCopy(P, e, t, src) { const it = G.stack.slice().reverse().find(x => x.kind === 'spell' && x.o === G.lastCast); if (it) await copySpellItem(P, it, { retarget: true }); }
});
