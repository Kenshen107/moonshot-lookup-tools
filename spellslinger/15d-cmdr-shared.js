// Engine pieces for the staples shared by several of the new Commander precons (Path of Ancestry, Fabled Passage, Toxic Deluge, ...).
// Wordings: rules/cmdr.js.
// ---- End-step queue: things that happen "at the beginning of the next end step" ----
function atEndStep(fn, label) { (G.endQ = G.endQ || []).push({ fn, label }); }
async function runEndQueue() { const q = (G.endQ || []).splice(0); for (const it of q) { if (it.label) log(it.label); await it.fn(); } }
// ---- Mana riders: "When that mana is spent to cast ..." (Path of Ancestry, Study Hall) ----
const MANA_RIDERS = {
    pathAncestry(P, o, srcPerm) {
        if (Rx(o).kind !== 'creature') return;
        const cmdrs = [...P.command, ...P.bf].filter(x => x.isCommander && x.owner === P.i);
        const types = c => (c.card.type.split(' — ')[1] || '').split(' ').filter(Boolean);
        if (!cmdrs.some(c => types(c).some(w => hasType(o, w)))) return;
        (G.trigQ = G.trigQ || []).push({ P, o: srcPerm, effects: [{ t: 'scry', n: 1 }] });
    },
    studyHall(P, o, srcPerm) {
        if (!o.isCommander) return;
        (G.trigQ = G.trigQ || []).push({ P, o: srcPerm || o, effects: [cmd('scryCommanderCasts')] });
    }
};
function manaRiders(P, o, plan) {
    plan.forEach(x => {
        if (x.pool) { const k = String(x.color).split(':')[0].split('!')[1]; if (k && MANA_RIDERS[k]) MANA_RIDERS[k](P, o, o); return; }
        const m = manaOf(x); if (m && m.rider && MANA_RIDERS[m.rider]) MANA_RIDERS[m.rider](P, o, x);
    });
}
// ---- Becoming a copy until end of turn (Cursed Mirror, Mirage Mirror) ----
function becomeCopyEOT(src, x, opts = {}) {
    src.copyOf = src.copyOf || src.card; src.copyTurn = G.turn;
    src.card = { ...x.card, id: `${x.card.id}-copy${uidSeq++}`, ...(opts.keepName ? { name: src.copyOf.name } : {}) };
    if (opts.haste) { (src.tkw = src.tkw || []).push('haste'); src.sick = false; }
    log(`${src.copyOf.name} becomes a copy of ${x.card.name} until end of turn${opts.haste ? ', with haste' : ''}.`);
}
// Turn number of this player's next turn (for "until the end of your next turn")
function nextTurnOf(P) { const n = G.players.length; const d = (P.i - G.active + n) % n; return G.turn + (d || n); }
// ---- Choosing X for "pay X life" (Toxic Deluge) ----
async function chooseLifeX(P, o) {
    const max = Math.max(0, P.life - 1);
    if (P.isAI || AUTOPLAY) {
        let best = 0, bestScore = 0;
        for (let x = 1; x <= Math.min(max, 12); x++) {
            let sc = -x * 0.8;
            allPerms().filter(isCreature).forEach(c => { if (tou(c) <= x) sc += (c.owner === P.i ? -1 : 1) * creatureValue(c); });
            if (sc > bestScore) { bestScore = sc; best = x; }
        }
        return best;
    }
    const n = await askNumber(P, `${o.card.name}: pay how much life? All creatures get -X/-X until end of turn.`, 0, max, Math.min(max, 3), { card: o.card, ok: 'Pay' });
    return n === null ? 0 : n;
}
Object.assign(CMD, {
    // Fabled Passage: after the search (a fetchLand effect), untap the land if you control four or more lands
    async untapFetchedIf4(P) {
        const l = G.lastFetched; if (!l || !onBf(l.uid)) return;
        if (P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= 4) { l.tapped = false; log(`${l.card.name} untaps.`); }
    },
    async scryCommanderCasts(P) { const n = commanderCasts(P); if (n > 0) await applyEffect(P, { t: 'scry', n }, null, null); },
    // "Whenever you discard a card, you may exile that card from your graveyard (and play it)": Currency Converter, Containment Construct, Moonstone
    async exileDiscarded(P, e, t, src, O, name) {
        const x = G.ctxObj; if (!x || !P.gy.includes(x)) return;
        if (!(P.isAI || await askYes(P, `${name}: exile ${x.card.name} from your graveyard?`, { card: x.card, yes: 'Exile it', no: 'Leave it' }))) return;
        pull(P.gy, x); P.exile.push(x);
        log(`${x.card.name} is exiled from ${you(P) ? 'your' : `${P.name}'s`} graveyard.`);
        if (e.play === 'turn') { x.playUntil = G.turn; x.playAny = true; log(`${P.name} ${you(P) ? 'may' : 'may'} play ${x.card.name} this turn.`); }
        else if (e.play === 'nextTurn') { x.playUntil = nextTurnOf(P); x.playAny = true; log(`${P.name} ${you(P) ? 'may' : 'may'} play ${x.card.name} until the end of ${you(P) ? 'your' : 'their'} next turn.`); }
        else if (e.keep && src) { src.exiledWith = src.exiledWith || []; src.exiledWith.push(x); }
    },
    // Currency Converter: put a card exiled with it into its owner's graveyard; a land makes a Treasure, a nonland card a 2/2 Rogue
    async converterTick(P, e, t, src) {
        const pool = (src.exiledWith || []).filter(x => G.players.some(X => X.exile.includes(x)));
        if (!pool.length) return;
        const pick = P.isAI ? pool[0] : await pickCard(P, pool, `${src.card.name}: put a card exiled with it into its owner's graveyard`, { required: true }) || pool[0];
        const owner = G.players.find(X => X.exile.includes(pick)); pull(owner.exile, pick); owner.gy.push(pick); src.exiledWith = src.exiledWith.filter(x => x !== pick);
        log(`${pick.card.name} is put into ${owner.name === 'You' ? 'your' : `${owner.name}'s`} graveyard.`);
        if (/\bLand\b/.test(pick.card.type)) await applyEffect(P, { t: 'artToken', n: 1, kind: 'treasure' }, null, src);
        else await applyEffect(P, { t: 'token', n: 1, p: 2, q: 2, name: 'black Rogue', kw: [] }, null, src);
    },
    // Cursed Mirror: as it enters, it may become a copy of a creature until end of turn, with haste
    async cursedMirror(P, e, t, src, O, name) {
        const pool = allPerms().filter(x => x !== src && isCreature(x));
        if (!pool.length || !onBf(src.uid)) return;
        const best = pool.slice().sort((a, b) => permValue(b) - permValue(a))[0];
        const pick = P.isAI ? (permValue(best) >= 4 ? best : null) : await pickCard(P, pool, `${name}: become a copy of a creature until end of turn (or none)`, { optional: true });
        if (pick) becomeCopyEOT(src, pick, { haste: true });
    },
    // Mirage Mirror: {2}: becomes a copy of target artifact, creature, enchantment or land until end of turn
    async mirageMirror(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(src.uid) || x === src) return;
        becomeCopyEOT(src, x, {});
    },
    // Gift of Immortality: the creature comes back; the Aura follows at the next end step, attached to it
    async giftImmortality(P, e, t, src) {
        const x = G.ctxObj; if (!x || x.token) return;
        const own = G.players[x.realOwner ?? x.owner];
        if (!own.gy.includes(x)) return;
        reanimateFrom(own, own, x);
        const aura = src, auraOwner = G.players[aura.realOwner ?? aura.owner];
        atEndStep(async () => {
            if (!auraOwner.gy.includes(aura) || !onBf(x.uid)) return;
            pull(auraOwner.gy, aura); resetObj(aura); aura.owner = auraOwner.i; aura.enteredTurn = G.turn; auraOwner.bf.push(aura); aura.attachedTo = x.uid;
            log(`${aura.card.name} returns to the battlefield attached to ${x.card.name}.`);
            fire('enters', { o: aura });
        }, `${aura.card.name} returns at the beginning of the end step.`);
    },
    // Promise of Loyalty: each player keeps one creature (a vow counter) and sacrifices the rest; those creatures can't attack you
    async promiseOfLoyalty(P, e, t, src) {
        for (const X of G.players.filter(y => !y.out)) {
            const cs = X.bf.filter(isCreature); if (!cs.length) continue;
            const keep = X.isAI || AUTOPLAY || cs.length === 1 ? cs.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : (await pickCard(X, cs, `${src.card.name}: choose a creature to keep (you sacrifice the rest)`, { required: true })) || cs[0];
            for (const c of cs.filter(c => c !== keep)) { log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); }
            keep.ctr.vow = (keep.ctr.vow || 0) + 1; keep.vowBy = P.i;
            log(`${keep.card.name} gets a vow counter: it can't attack ${P.name === 'You' ? 'you' : P.name} or ${P.name === 'You' ? 'your' : 'their'} planeswalkers.`);
        }
    },
    // Tragic Arrogance: you choose an artifact, a creature, an enchantment and a planeswalker for each player; everything else nonland is sacrificed
    async tragicArrogance(P, e, t, src, O, name) {
        const keep = new Set();
        for (const X of G.players.filter(y => !y.out)) {
            for (const ty of ['Artifact', 'Creature', 'Enchantment', 'Planeswalker']) {
                const pool = X.bf.filter(x => (ty === 'Creature' ? isCreature(x) : new RegExp(`\\b${ty}\\b`).test(x.card.type)) && !keep.has(x));
                if (!pool.length) continue;
                let pick;
                if (pool.length === 1) pick = pool[0];
                else if (P.isAI || AUTOPLAY) pick = pool.slice().sort((a, b) => (X === P ? -1 : 1) * (permValue(b) - permValue(a)) * (X === P ? 1 : -1))[0];
                else pick = (await pickCard(P, pool, `${name}: choose ${/^[AEIOU]/.test(ty) ? 'an' : 'a'} ${ty.toLowerCase()} ${X === P ? 'you control' : `${X.name} controls`} to keep`, { required: true })) || pool[0];
                if (X === P || !(P.isAI || AUTOPLAY)) keep.add(pick); else keep.add(pool.slice().sort((a, b) => permValue(a) - permValue(b))[0]); // the computer keeps your worst permanent of each type for the others
            }
        }
        const doomed = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !keep.has(x) && !x.attachedTo);
        const doomedAll = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !keep.has(x));
        log(`${name}: ${doomedAll.length} permanent${doomedAll.length === 1 ? '' : 's'} sacrificed.`);
        for (const x of doomedAll) { if (!onBf(x.uid)) continue; fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); }
    },
    // Expressive Iteration: look at the top three; one to hand, one to the bottom, one exiled (playable this turn)
    async expressiveIteration(P, e, t, src, O, name) {
        const top = P.library.splice(-Math.min(3, P.library.length)).reverse();
        if (!top.length) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
        const rest = top.slice();
        const choose = async (what, best) => { const c = rest.length === 1 ? rest[0] : (P.isAI || AUTOPLAY) ? rest.slice().sort((a, b) => best * (aiKeepValue(P, b) - aiKeepValue(P, a)))[0] : await pickCard(P, rest, `${name}: choose a card to ${what}`, { required: true }) || rest[0]; pull(rest, c); return c; };
        const hand = await choose('put into your hand', 1);
        if (rest.length) { const bottom = await choose('put on the bottom of your library', -1); P.library.unshift(bottom); }
        if (rest.length) { const ex = rest.pop(); P.exile.push(ex); ex.playUntil = G.turn; ex.playAny = true; log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${ex.card.name}; ${you(P) ? 'you' : 'they'} may play it this turn.`); }
        P.hand.push(hand);
    },
    // Toxic Deluge: all creatures get -X/-X until end of turn (X is the life paid)
    async toxicDeluge(P, e, t, src) { const x = G.curX || 0; if (x > 0) await applyEffect(P, { t: 'allPump', p: -x, q: -x }, null, src); }
});
// Promise of Loyalty: a creature with a vow counter can't attack the player who cast it (or their planeswalkers)
function cmdCantAttack(o) { return !!(o.ctr && o.ctr.vow > 0 && o.vowBy !== undefined && G && G.players.length === 2 && o.vowBy !== o.owner); }
function cmdAttackFilter(P, list) {
    if (!G || G.defender == null) return list;
    return list.filter(o => !(o.ctr && o.ctr.vow > 0 && o.vowBy === G.defender && o.vowBy !== o.owner));
}
