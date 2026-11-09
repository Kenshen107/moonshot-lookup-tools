// Spellslinger Duels - engine pieces for five owner decks (2026-11-02): U.S. Agent, Kang the Conqueror, Lorehold the Historian, Jadzi and Torgaar.
// Wordings: rules/fivedecks.js (CMD ids start with fr_). Approximations (nothing is marked Partly): choices inside resolving abilities are made as they
// resolve; "target" lists for several targets (Morningtide's Light, Silver Surfer) are picked one at a time as the spell resolves; copies of abilities and
// spells (Echo, See Double) keep the original's targets unless a person is asked; "end the turn" skips the rest of the turn without running the end step's
// "until end of turn" cleanup twice; Elesh Norn's tax counts damage that was dealt-or-prevented before it checks.

const frOwner = x => G.players[x.realOwner ?? x.owner];
const frPick = async (P, pool, title, opts = {}) => {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort(opts.rank || ((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)))[0];
    return (await pickCard(P, pool, title, opts.optional ? { optional: true } : { required: true })) || (opts.optional ? null : pool[0]);
};
const frPickPlayer = async (P, title, pool) => { if (pool.length <= 1) return pool[0] || null; const w = await pickWord(P, title, pool.map(pl => pl.name)); return pool.find(pl => pl.name === w) || pool[0]; };
const frOpp = async (P, title) => {
    const fs = foes(P); if (fs.length <= 1) return fs[0] || null;
    if (P.isAI || AUTOPLAY) return fs.slice().sort((a, b) => a.life - b.life)[0];
    const w = await pickWord(P, title, fs.map(F => F.name)); return fs.find(F => F.name === w) || fs[0];
};
// An ETB-worthy creature or artifact, used by the computer to choose what to blink
const frEtbValue = x => (Rx(x).etb || []).length * 3 + (Rx(x).etbModes ? 3 : 0) + (x.token ? -6 : 0) + (isCreature(x) ? 0 : 1);
// Exile a permanent and bring it back at the next end step (or at once); a token is gone for good
function frBlinkPerm(P, x, o = {}) {
    if (!x || !onBf(x.uid)) return false;
    const X = frOwner(x);
    leaveBattlefield(x, 'exile');
    log(`${x.card.name} is exiled.`);
    if (!X.exile.includes(x)) return true;
    const back = () => { if (!X.exile.includes(x)) return; pull(X.exile, x); putOntoBattlefield(X, x, !!o.tapped || /\bLand\b/.test(x.card.type) && o.landTapped); if (o.counter) putCounters(x, o.counter, X); };
    atEndStep(back, `${x.card.name} returns to the battlefield.`);
    return true;
}
function frAttached(o) { return allPerms().filter(x => x.attachedTo === o.uid && /\b(?:Aura|Equipment)\b/.test(x.card.type)); }
function frModified(P) { return P.bf.filter(x => isCreature(x) && (x.counters !== 0 || Object.values(x.ctr || {}).some(v => v > 0) || allPerms().some(a => a.attachedTo === x.uid && (Rx(a).isEquipment || (a.owner === P.i && /\bAura\b/.test(a.card.type)))))); }

Object.assign(TRIG_FN, {
    fr_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    fr_myCycle: (o, ctx) => !!ctx.P && ctx.P.i === o.owner,
    fr_anyCycle: () => true,
    fr_castTargetsCreature: (o, ctx) => !!ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind) && !!ctx.target && !!ctx.target.o && isCreature(ctx.target.o),
    fr_castTargetsMyCreature: (o, ctx) => !!ctx.target && !!ctx.target.o && isCreature(ctx.target.o) && ctx.target.o.owner === o.owner,
    fr_anyCreatureHitsOpp: (o, ctx) => !!ctx.src && isCreature(ctx.src) && (ctx.hit || []).some(H => H.i !== o.owner)
});

Object.assign(CMD, {
    // ---- blink ----
    async fr_blinkEnd(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        if (e.notSelf && x === src) return;
        if (e.filter === 'nontoken creature' && x.token) return;
        frBlinkPerm(P, x, {});
    },
    async fr_blinkNow(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        if (e.notSelf && x === src) return;
        if (e.nonPilot && hasType(x, 'Pilot')) return;
        if (e.filter === 'nonland permanent' && /\bLand\b/.test(x.card.type)) return;
        const wasPirate = hasType(x, 'Pirate');
        await applyEffect(P, { t: 'flicker' }, { o: x }, src);
        if (e.counter && onBf(x.uid)) putCounters(x, e.counter, P);
        if (e.pirateDraw && wasPirate) drawCards(P, 1);
    },
    // Airbend: exile it; its owner may cast it for {2} for as long as it stays exiled
    fr_airbend(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const X = frOwner(x);
        leaveBattlefield(x, 'exile');
        if (X.exile.includes(x)) { x.playUntil = 1e9; x.airbentCost = true; log(`${x.card.name} is airbent: ${X.name === 'You' ? 'you' : X.name} may cast it for {2}.`); }
    },
    async fr_morningtide(P, e, t, src) {
        const pool = allPerms().filter(isCreature).filter(x => !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i));
        const chosen = [];
        if (P.isAI || AUTOPLAY) pool.filter(x => x.owner === P.i && (frEtbValue(x) >= 3 || foes(P).some(F => F.bf.some(isCreature)) && false)).forEach(x => chosen.push(x));
        else for (;;) { const left = pool.filter(x => !chosen.includes(x)); if (!left.length) break; const x = await pickCard(P, left, `${src.card.name}: exile a creature (or stop)`, { optional: true }); if (!x) break; chosen.push(x); }
        chosen.forEach(x => frBlinkPerm(P, x, { tapped: true }));
    },
    fr_shieldYou(P, e, t, src) { P.dmgShield = G.turn + Math.max(2, G.players.filter(X => !X.out).length); log(`${P.name} ${you(P) ? 'are' : 'is'} protected from damage until ${you(P) ? 'your' : 'their'} next turn.`); },
    async fr_surfer(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src);
        const chosen = [];
        if (P.isAI || AUTOPLAY) pool.filter(x => frEtbValue(x) >= 3).forEach(x => chosen.push(x));
        else for (;;) { const left = pool.filter(x => !chosen.includes(x)); if (!left.length) break; const x = await pickCard(P, left, `${src.card.name}: exile another permanent you control (or stop)`, { optional: true }); if (!x) break; chosen.push(x); }
        chosen.forEach(x => frBlinkPerm(P, x, { landTapped: true }));
    },
    // ---- equipment ----
    fr_sturdy(P, e, t, src) {
        const card = { id: `token-sturdy-${uidSeq}`, name: 'Sturdy Shield', fullName: 'Sturdy Shield token', cost: '', cmc: 0, type: 'Token Artifact — Equipment', text: 'Equipped creature gets +1/+2.\nEquip {2}', colors: [], ci: [], img: null, imgS: null, legal: {} };
        const o = makeObj(card, P.i, { token: true, sick: false });
        P.bf.push(o); if (onBf(src.uid)) o.attachedTo = src.uid;
        log(`${P.name} ${you(P) ? 'create' : 'creates'} a Sturdy Shield Equipment token and attach${you(P) ? '' : 'es'} it to ${src.card.name}.`);
        fire('enters', { o }); if (typeof tokenMade === 'function') tokenMade(P);
    },
    async fr_attachAll(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = P.bf.filter(x => x !== src && x.attachedTo !== src.uid && (/\bEquipment\b/.test(x.card.type) || (!e.equipOnly && /\bAura\b/.test(x.card.type))));
        if (!pool.length) return;
        if (!(P.isAI || AUTOPLAY) && !await askYes(P, `${src.card.name}: attach ${pool.length} Aura / Equipment you control to it?`, { card: src.card })) return;
        pool.forEach(x => { x.attachedTo = src.uid; });
        log(`${P.name} ${you(P) ? 'attach' : 'attaches'} ${pool.map(x => x.card.name).join(', ')} to ${src.card.name}.`);
    },
    async fr_ardenn(P, e, t, src) {
        const pool = P.bf.filter(x => /\b(?:Aura|Equipment)\b/.test(x.card.type)); if (!pool.length) return;
        const hosts = P.bf.filter(isCreature); if (!hosts.length) return;
        if (!(P.isAI || AUTOPLAY) && !await askYes(P, `${src.card.name}: attach your Auras and Equipment to a creature?`, { card: src.card })) return;
        const host = await frPick(P, hosts, `${src.card.name}: attach them to which creature?`, { rank: (a, b) => (pow(b) + tou(b)) - (pow(a) + tou(a)) });
        if (!host) return;
        pool.forEach(x => { if (x !== host) x.attachedTo = host.uid; });
        log(`${P.name} ${you(P) ? 'attach' : 'attaches'} ${pool.map(x => x.card.name).join(', ')} to ${host.card.name}.`);
    },
    fr_mantle(P, e, t, src) {
        const host = onBf(src.attachedTo); if (!host) return;
        const back = P.gy.filter(x => /\b(?:Aura|Equipment)\b/.test(x.card.type));
        back.forEach(x => { putOntoBattlefield(P, x, false); x.attachedTo = host.uid; });
        if (back.length) log(`${back.map(x => x.card.name).join(', ')} return${back.length === 1 ? 's' : ''} attached to ${host.card.name}.`);
    },
    // ---- the U.S. Agent deck ----
    async fr_farTraveler(P, e, t, src) {
        const cmdrs = P.bf.filter(x => x.isCommander && x.owner === P.i && isCreature(x));
        for (let k = 0; k < cmdrs.length; k++) {
            const pool = P.bf.filter(x => isCreature(x) && x.tapped);
            const x = await frPick(P, pool, `${src.card.name}: exile up to one tapped creature you control, then return it`, { optional: true, rank: (a, b) => frEtbValue(b) - frEtbValue(a) });
            if (x && ((!(P.isAI || AUTOPLAY)) || frEtbValue(x) >= 3)) await applyEffect(P, { t: 'flicker' }, { o: x }, src);
        }
    },
    fr_realmbreaker1: async function (P, e, t, src) {
        const X = await frOpp(P, `${src.card.name}: target opponent`); if (!X) return;
        doMill(X, 3);
        const lands = X.gy.filter(c => /\bLand\b/.test(c.card.type));
        const l = await frPick(P, lands, `${src.card.name}: put a land card from ${X.name === 'You' ? 'your' : `${X.name}'s`} graveyard onto the battlefield`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (!l) return;
        pull(X.gy, l); l.realOwner = l.owner; putOntoBattlefield(P, l, true); l.exileIfLeaves = true;
        log(`${l.card.name} enters under ${P.name}'s control tapped (it is exiled if it would leave).`);
    },
    async fr_realmbreaker2(P, e, t, src) {
        const found = P.library.filter(c => hasType(c, 'Praetor'));
        found.forEach(c => { pull(P.library, c); putOntoBattlefield(P, c, false); });
        P.library = shuffle(P.library);
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${found.length} Praetor${found.length === 1 ? '' : 's'} onto the battlefield.`);
    },
    fr_pileup(P, e, t, src) {
        const hit = allPerms().filter(x => isCreature(x) || hasType(x, 'Vehicle'));
        hit.forEach(x => x.tkw.push('-indestructible'));
        log(`${src ? src.card.name : 'Spectacular Pileup'}: all creatures and Vehicles lose indestructible, then are destroyed (${hit.length}).`);
        hit.forEach(x => { if (onBf(x.uid)) destroy(x); });
    },
    async fr_unforgiving(P, e, t, src) {
        const X = frModified(P).length;
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= X);
        const c = await frPick(P, pool, `${src.card.name}: return a creature card with mana value ${X} or less`);
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c, false); }
    },
    fr_deathtouchCounter(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; x.ctr.deathtouch = (x.ctr.deathtouch || 0) + 1; log(`${x.card.name} gets a deathtouch counter.`); },
    async fr_gix(P, e, t, src) {
        const raw = G.ctxRaw || {}; const c = raw.src; if (!c || c.owner === undefined) return;
        const X = G.players[c.owner]; if (X.out || X.life < 2) return;
        const yes = (X.isAI || AUTOPLAY) ? X.life > 8 : await askYes(X, `${src.card.name}: pay 1 life to draw a card?`, { card: src.card });
        if (!yes) return;
        X.life -= 1; log(`${X.name} ${you(X) ? 'pay' : 'pays'} 1 life and ${you(X) ? 'draw' : 'draws'} a card.`);
        drawCards(X, 1);
    },
    async fr_gixUlt(P, e, t, src) {
        const mx = P.hand.length; if (!mx) return;
        const x = (P.isAI || AUTOPLAY) ? Math.min(mx, 3) : await askNumber(P, `${src.card.name}: discard how many cards?`, 0, mx, mx, { card: src.card.name ? src.card : undefined, ok: 'Discard' });
        if (!x) return;
        const O = await frOpp(P, `${src.card.name}: target opponent`); if (!O) return;
        for (let k = 0; k < x && P.hand.length; k++) { const d = await chooseDiscard(P, src.card.name); if (!d) break; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; }
        const got = O.library.splice(-Math.min(x, O.library.length)).reverse();
        got.forEach(c => { c.realOwner = c.owner; c.owner = P.i; c.playUntil = 1e9; c.freeCast = true; P.exile.push(c); });
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top ${got.length} card${got.length === 1 ? '' : 's'} of ${O.name === 'You' ? 'your' : `${O.name}'s`} library and may play them free.`);
    },
    // ---- the Kang deck ----
    fr_destroyIfBiggest(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; if (allPerms().some(y => y !== x && isCreature(y) && pow(y) > pow(x))) { log(`${x.card.name} isn't destroyed: another creature has greater power.`); return; } destroy(x); },
    fr_commit(P, e, t, src) {
        if (!t) return;
        if (t.item) { const it = t.item; if (!G.stack.includes(it)) return; pull(G.stack, it); const X = G.players[it.o.owner]; resetObj(it.o); X.library.splice(Math.max(0, X.library.length - 1), 0, it.o); log(`${it.name} is put into its owner's library second from the top.`); return; }
        const x = t.o; if (!x || !onBf(x.uid)) return; const X = frOwner(x);
        leaveBattlefield(x, 'exile'); if (!X.exile.includes(x)) return;
        pull(X.exile, x); resetObj(x); X.library.splice(Math.max(0, X.library.length - 1), 0, x);
        log(`${x.card.name} is put into its owner's library second from the top.`);
    },
    fr_endTurn(P, e, t, src) {
        G.endTurnAt = G.turn;
        const rest = G.stack.splice(0);
        rest.forEach(it => { if (it.kind === 'spell' && it.o) moveSpellCard(it.o, 'exile'); });
        log(`The turn ends: ${rest.length} other spell${rest.length === 1 ? '' : 's'} and abilit${rest.length === 1 ? 'y' : 'ies'} on the stack ${rest.length === 1 ? 'is' : 'are'} exiled.`);
        const act = G.players[G.active];
        if (!act.isAI && !G.hotseat && !AUTOPLAY) {
            let tries = 0; const go = () => { if (G.endTurnAt !== G.turn || G.over) return; if ((G.busy || G.stack.length || G.mode) && tries++ < 40) { setTimeout(go, 150); return; } if (G.phase !== 'end') endTurn(act); };
            setTimeout(go, 150);
        }
    },
    async fr_donnie(P, e, t, src) {
        const human = !(P.isAI || AUTOPLAY);
        const gy = pl => pl.gy.filter(c => /Artifact|Instant|Sorcery/.test(c.card.type));
        const players = G.players.filter(pl => !pl.out);
        const mode1 = human ? await askYes(P, `${src.card.name}: choose the first mode (a player draws two cards)?`, { card: src.card, yes: 'Draw two', no: 'Skip' }) : true;
        const ok2 = players.some(pl => gy(pl).length);
        const mode2 = ok2 ? (human ? await askYes(P, `${src.card.name}: choose the second mode (a different player returns an artifact, instant or sorcery card)?`, { card: src.card, yes: 'Return a card', no: 'Skip' }) : true) : false;
        let drawer = null, returner = null;
        if (mode1) drawer = human ? await frPickPlayer(P, `${src.card.name}: who draws two cards?`, players) : P;
        if (mode2) { const cands = players.filter(pl => pl !== drawer && gy(pl).length); returner = human ? await frPickPlayer(P, `${src.card.name}: a different player returns a card`, cands) : (cands.includes(P) ? P : cands[0]) || null; }
        if (drawer) drawCards(drawer, 2);
        if (returner) { const c = await frPick(returner, gy(returner), `${src.card.name}: return an artifact, instant, or sorcery card from your graveyard to your hand`); if (c) { pull(returner.gy, c); returner.hand.push(c); log(`${c.card.name} returns to ${returner.name === 'You' ? 'your' : `${returner.name}'s`} hand.`); } }
    },
    fr_copyCreature(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) tokenCopyOf(P, x.card); },
    fr_echo(P, e, t, src) {
        const it = t && t.item; if (!it || !G.stack.includes(it)) return;
        G.stack.push({ ...it, id: stackSeq++, copy: true, also: undefined, key: null });
        log(`${src.card.name}: ${it.name} is copied.`);
    },
    fr_copyHero(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) frTokenCopyAs(P, x, 'Hero', 4, 4); },
    fr_copyCoward(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid)) frTokenCopyAs(P, x, 'Coward', 2, 2); },
    async fr_herbie(P, e, t, src) {
        drawCards(P, 1);
        const lands = P.hand.filter(c => Rx(c).kind === 'land'); if (!lands.length) return;
        const l = await frPick(P, lands, `${src.card.name}: put a land card from your hand onto the battlefield tapped`, { optional: true });
        if (l) { pull(P.hand, l); putOntoBattlefield(P, l, true); }
    },
    async fr_retarget(P, e, t, src) {
        const it = t && t.item; if (!it || it.kind !== 'spell' || !G.stack.includes(it)) return;
        await frRetargetItem(P, it, src);
    },
    async fr_copySpell(P, e, t, src) {
        const it = t && t.item; if (!it || it.kind !== 'spell' || !G.stack.includes(it)) return;
        if (!e.anySpell && !['instant', 'sorcery'].includes(Rx(it.o).kind)) return;
        await copySpellItem(P, it, { retarget: true });
    },
    async fr_phaseOutX(P, e, t, src) {
        const x = G.curX || 0; if (x <= 0) return;
        const pool = allPerms().filter(isCreature);
        const chosen = [];
        if (P.isAI || AUTOPLAY) pool.filter(c => foes(P).includes(G.players[c.owner])).sort((a, b) => creatureValue(b) - creatureValue(a)).slice(0, x).forEach(c => chosen.push(c));
        else for (let k = 0; k < x; k++) { const left = pool.filter(c => !chosen.includes(c)); if (!left.length) break; const c = await pickCard(P, left, `${src.card.name}: phase out a creature (${k + 1} of up to ${x})`, { optional: true }); if (!c) break; chosen.push(c); }
        chosen.forEach(c => phaseOut(c));
    },
    fr_msMarvel(P, e, t, src) { drawCards(P, 1); if (onBf(src.uid)) { src.bpHand = G.turn; log(`${src.card.name}'s base power is equal to the cards in ${P.name === 'You' ? 'your' : `${P.name}'s`} hand until end of turn.`); } },
    fr_brawler(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        putCounters(x, 4, P);
        ['flying', 'vigilance', 'trample', 'lifelink'].forEach(k => { x.ctr[k] = (x.ctr[k] || 0) + 1; });
        log(`${x.card.name} gets four +1/+1 counters and flying, vigilance, trample and lifelink counters.`);
    },
    async fr_vision(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (!src.visionPicked || src.visionPicked.turn !== G.turn) src.visionPicked = { turn: G.turn, set: [] };
        const all = ['Solar Beam: double strike', 'Density Control: indestructible', 'Technopathy: draw a card'];
        const left = all.filter(w => !src.visionPicked.set.includes(w)); if (!left.length) return;
        let w = left[left.length - 1];
        if (!(P.isAI || AUTOPLAY)) w = await pickWord(P, `${src.card.name}: choose one that hasn't been chosen this turn`, left);
        else if (left.includes(all[2]) && P.hand.length < 4) w = all[2]; else if (left.includes(all[1])) w = all[1]; else w = left[0];
        src.visionPicked.set.push(w);
        if (w === all[0]) { src.tkw.push('double strike'); log(`${src.card.name} gains double strike until end of turn.`); }
        else if (w === all[1]) { src.tkw.push('indestructible'); log(`${src.card.name} gains indestructible until end of turn.`); }
        else drawCards(P, 1);
    },
    fr_wasp(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        x.tapped = true; x.noAbilBy = src.uid;
        log(`${x.card.name} is tapped and loses all abilities for as long as ${src.card.name} remains on the battlefield.`);
    },
    async fr_turnabout(P, e, t, src) {
        const pl = t && t.p; if (!pl) return;
        const kinds = ['artifact', 'creature', 'land'];
        let kind, untap;
        if (P.isAI || AUTOPLAY) { const mine = pl === P; kind = mine ? 'land' : 'creature'; untap = mine; }
        else { kind = await pickWord(P, `${src.card.name}: choose artifact, creature, or land`, kinds); untap = await askYes(P, `${src.card.name}: untap tapped ${kind}s (Yes) or tap untapped ${kind}s (No)?`, { card: src.card, yes: 'Untap them', no: 'Tap them' }); }
        const hit = pl.bf.filter(x => kind === 'creature' ? isCreature(x) : kind === 'land' ? /\bLand\b/.test(x.card.type) : /\bArtifact\b/.test(x.card.type));
        hit.forEach(x => { if (untap) x.tapped = false; else x.tapped = true; });
        log(`${src.card.name}: ${untap ? 'untap' : 'tap'} all ${kind}s ${pl.name === 'You' ? 'you control' : `${pl.name} controls`}.`);
    },
    fr_inventive(P, e, t, src) {
        const c = P.gy.filter(x => /\bArtifact\b/.test(x.card.type)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
        if (c) { pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${P.name === 'You' ? 'your' : `${P.name}'s`} hand.`); } else drawCards(P, 1);
    }
});
// A token copy that is "not legendary and a <subtype> in addition to its other types", with set power and toughness
function frTokenCopyAs(P, x, sub, p, q) {
    let ty = x.card.type.replace(/\bLegendary\s+/, '');
    ty = ty.includes(' — ') ? `${ty} ${sub}` : `${ty} — ${sub}`;
    tokenCopyOf(P, { ...x.card, type: ty, power: String(p), toughness: String(q) }, { p, q });
}
async function frRetargetItem(P, it, src) {
    const te = firstTargetEffect(it.o); if (!te) return;
    const valid = validTargets(it.P, te, it.o); if (!valid.length) return;
    let pick;
    if (P.isAI || AUTOPLAY) pick = (it.P === P ? aiPickTarget(P, te, it.o, valid) : valid.find(v => v.o && v.o.owner === it.P.i) || valid[0]) || valid[0];
    else { const names = valid.map(v => targetName(v)); const w = await pickWord(P, `${src.card.name}: choose a new target for ${it.name}`, names); pick = valid[names.indexOf(w)] || valid[0]; }
    it.target = pick; log(`${it.name} now targets ${targetName(pick)}.`);
}

// ---- Elesh Norn, Mother of Machines / Panharmonicon / Elesh Norn's damage tax ----
function frNoEnterTrig(o) { return !!G && !!o && o.owner !== undefined && allPerms().some(a => Rx(a).noOppEnterTrig && !lostAbilities(a) && a.owner !== o.owner); }
function frPanBoost(o) { if (!G || !o || !o.card || !(isCreature(o) || /\bArtifact\b/.test(o.card.type))) return 0; return allPerms().filter(a => a.owner === o.owner && Rx(a).panharmonicon && !lostAbilities(a)).length; }
(function () {
    const g = cmdExtraTriggers;
    cmdExtraTriggers = function (ev, o, tr, ctx) {
        let k = g.apply(this, arguments);
        const entering = (ev === 'enters' || ev === 'landfall' || ev === 'selfEnters') && ctx && ctx.o && (isCreature(ctx.o) || /\bArtifact\b/.test(ctx.o.card.type));
        if (entering) k += allPerms().filter(a => a.owner === o.owner && Rx(a).panharmonicon && !lostAbilities(a)).length;
        return k;
    };
    const d = damage;
    damage = function (target, n, src) {
        const own = target && (target.life !== undefined ? target : (target.card && target.uid !== undefined ? G.players[target.owner] : null));
        if (own && own.dmgShield && G.turn < own.dmgShield && n > 0 && G.noPrevent !== G.turn && (target.life !== undefined)) { log(`Damage to ${own.name === 'You' ? 'you' : own.name} is prevented (Morningtide's Light).`); return; }
        const r = d.apply(this, arguments);
        if (n > 0 && own && src && src.card && src.uid !== undefined && G.players[src.owner] && src.owner !== own.i) {
            allPerms().filter(a => a.owner === own.i && Rx(a).eleshTax && !lostAbilities(a)).forEach(a => (G.trigQ = G.trigQ || []).push({ P: own, o: a, effects: [cmd('fr_eleshTax')], raw: { src } }));
        }
        return r;
    };
    const m = manaOf;
    manaOf = function (o) {
        const r = m.apply(this, arguments);
        if (r && r.drawnN) { const P = G.players[o.owner]; return { ...r, n: P.drawTurn === G.turn ? (P.drawN || 0) : 0 }; }
        return r;
    };
    const dc = drawCards;
    drawCards = function (P, n, quiet) {
        if (G && n > 0 && !G.inDrawStep && G.phase !== 'setup' && P.reedTurn !== G.turn && P.bf.some(a => Rx(a).reedDraw && !lostAbilities(a))) { P.reedTurn = G.turn; log('(Reed Richards: draw four cards instead.)'); n = n - 1 + 4; }
        return dc.call(this, P, n, quiet);
    };
    const am = aiMain;
    aiMain = async function (P) { if (G && G.endTurnAt === G.turn) return; return am.apply(this, arguments); };
    const ac = aiChooseAttackers;
    aiChooseAttackers = function (P) { if (G && G.endTurnAt === G.turn) return []; return ac.apply(this, arguments); };
})();
Object.assign(CMD, {
    async fr_eleshTax(P, e, t, src) {
        const c = G.ctxRaw && G.ctxRaw.src; if (!c) return;
        const X = G.players[c.owner]; if (!X || X.out) return;
        const plan = planPayment(X, parseCost('{1}'));
        const pay = plan && ((X.isAI || AUTOPLAY) ? X.life <= 8 || X.hand.length > 3 : await askYes(X, `${src.card.name}: pay {1} or lose 2 life?`, { card: src.card, yes: 'Pay {1}', no: 'Lose 2 life' }));
        if (pay) { plan.forEach(s => tapSource(X, s)); log(`${X.name} ${you(X) ? 'pay' : 'pays'} {1}.`); return; }
        await applyEffect(X, { t: 'lose', n: 2 }, null, src);
    }
});
Object.assign(CMD_SCORE, { fr_journey: P => { const n = P.hand.filter(c => Rx(c).kind === 'land').length; return n >= 2 ? 4 + n * 2 : 0; }, fr_blinkEnd: () => 1, fr_blinkNow: P => (P.bf.some(x => frEtbValue(x) >= 3) ? 6 : 0), fr_endTurn: P => (foes(P).reduce((a, F) => a + F.bf.filter(isCreature).length, 0) > P.bf.filter(isCreature).length + 2 ? 6 : 0), fr_commit: () => 4, fr_phaseOutX: () => 3, fr_pileup: P => { const d = foes(P).reduce((a, F) => a + F.bf.filter(isCreature).reduce((s, x) => s + permValue(x), 0), 0) - P.bf.filter(isCreature).reduce((s, x) => s + permValue(x), 0); return d > 6 ? d : 0; } });
// AI: blink the creature or artifact whose enter-the-battlefield ability is worth the most; never one of the other side's
Object.assign(CMD_AITARGET, {
    fr_blinkEnd: (P, e, src, valid) => { const mine = valid.filter(v => v.o && v.o.owner === P.i).sort((a, b) => frEtbValue(b.o) - frEtbValue(a.o))[0]; return mine && frEtbValue(mine.o) >= 3 ? mine : null; },
    fr_blinkNow: (P, e, src, valid) => { const mine = valid.filter(v => v.o && v.o.owner === P.i).sort((a, b) => frEtbValue(b.o) - frEtbValue(a.o))[0]; return mine && (frEtbValue(mine.o) >= 3 || e.counter) ? mine : null; }
});

// ================= Lorehold, the Historian / Jadzi / Torgaar decks =================
const FR_UNEARTH_ACT = { cost: { mana: parseCost('{3}'), tap: false }, effects: [{ t: 'unearth' }], text: 'Unearth {3} (granted by Ghost Ark)' };
function frMiracle(o) {
    if (!G || !o || o.owner === undefined) return null;
    if (!['instant', 'sorcery'].includes(Rx(o).kind)) return null;
    const P = G.players[o.owner];
    return P && P.bf.some(a => Rx(a).grantMiracle && !lostAbilities(a)) ? parseCost('{2}') : null; // Lorehold, the Historian
}
// Sneak (Splinter's Technique): return an unblocked attacker you control to hand as you cast it during the declare blockers step
function frSneakAttackers(P) { return P.bf.filter(x => G.attackers.includes(x.uid) && !Object.values(G.blocks || {}).flat().includes(x.uid) && !Object.keys(G.blocks || {}).includes(String(x.uid)) ? true : G.attackers.includes(x.uid) && !(G.blocks && G.blocks[x.uid] && G.blocks[x.uid].length)); }
async function frSneakReturn(P, o) {
    const pool = frSneakAttackers(P); if (!pool.length) return;
    const x = await frPick(P, pool, `${o.card.name}: return an unblocked attacker you control to your hand (sneak)`, { rank: (a, b) => (a.card.cmc || 0) - (b.card.cmc || 0) });
    if (x) { G.attackers = G.attackers.filter(u => u !== x.uid); leaveBattlefield(x, 'hand'); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${x.card.name} to hand (sneak).`); }
}
// The computer sacrifices tokens and 1-power creatures to make an expensive Torgaar castable
function frAiSac(P, o) {
    const fodder = P.bf.filter(x => isCreature(x) && (x.token || pow(x) <= 1) && !x.isCommander).sort((a, b) => creatureValue(a) - creatureValue(b));
    o.sacN = 0; o.sacList = [];
    for (let k = 0; k < fodder.length; k++) { if (planPayment(P, totalCost(P, o), extraCost(P, o), null, { convoke: hasConvoke(o) })) break; o.sacList.push(fodder[k]); o.sacN = o.sacList.length; }
    if (!planPayment(P, totalCost(P, o), extraCost(P, o), null, { convoke: hasConvoke(o) })) { o.sacN = 0; o.sacList = []; }
}
COND_EXTRA.push(
    [/^artifacts you control have two or more \+1\/\+1 counters among them$/, () => P => P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).reduce((a, x) => a + Math.max(0, x.counters), 0) >= 2],
    [/^your graveyard has historic cards with total mana value 30 or greater$/, () => P => P.gy.filter(c => /Artifact|Legendary|Saga/.test(c.card.type)).reduce((a, c) => a + (c.card.cmc || 0), 0) >= 30],
    [/^each player has 10 or less life$/, () => P => G.players.filter(X => !X.out).every(X => X.life <= 10)],
    [/^you control a land$/, () => P => P.bf.some(x => /\bLand\b/.test(x.card.type))],
    [/^~ has 20 or more charge counters$/, () => (P, o) => !!o && ((o.ctr && o.ctr.charge) || 0) >= 20],
    [/^you have a creature to craft with$/, () => P => P.bf.some(isCreature) || P.gy.some(c => /\bCreature\b/.test(c.card.type))]
);
Object.assign(TRIG_FN, {
    fr_selfDies: (o, ctx) => ctx.o === o,
    fr_levelThree: (o, ctx) => ctx.o === o && ctx.lvl === 3,
    fr_selfCrewed: (o, ctx) => ctx.o === o,
    fr_enforcerAlone: (o, ctx) => (ctx.list || []).length === 1 && (ctx.list[0] === o || (ctx.list[0].isCommander && ctx.list[0].owner === o.owner)),
    fr_nontokenArtCreatureOrVehicle: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && !ctx.o.token && ((isCreature(ctx.o) && /\bArtifact\b/.test(ctx.o.card.type)) || hasType(ctx.o, 'Vehicle')),
    fr_hostHitsPlayer: (o, ctx) => !!ctx.src && ctx.src.uid === o.attachedTo && (ctx.hit || []).some(H => H.i !== o.owner),
    fr_creatureHurtsMe: (o, ctx) => !!ctx.src && isCreature(ctx.src) && !!ctx.P && ctx.P.i === o.owner,
    fr_curseEnter: (o, ctx) => o.hostPlayer !== undefined && !!ctx.o && isCreature(ctx.o) && ctx.o.owner === o.hostPlayer
});
// Count creatures that died this turn (Tallyman of Nurgle) and the Rabid Attack "when this dies, draw" gift
(function () {
    const f = fire;
    fire = function (ev, ctx) {
        if (G && ctx && ctx.o && (ev === 'dies' || ev === 'creatureDies') && isCreature(ctx.o)) {
            if (ev === 'dies') { if (!G.frDied || G.frDied.turn !== G.turn) G.frDied = { turn: G.turn, n: 0 }; G.frDied.n++; if (ctx.o.frDieDraw === G.turn) { const X = G.players[ctx.o.owner]; (G.trigQ = G.trigQ || []).push({ P: X, o: ctx.o, effects: [{ t: 'draw', n: 1 }] }); } }
        }
        return f.apply(this, arguments);
    };
    const cf = typeof cmdForcedAttackers === 'function' ? cmdForcedAttackers : null;
    if (cf) cmdForcedAttackers = function (P) { return [...new Set([...cf.apply(this, arguments), ...P.bf.filter(x => x.frForceAtk === G.turn && canAttackWith(x))])]; };
})();
const frBasicTypes = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
const frHist = c => /Artifact|Legendary|Saga/.test(c.card.type);
// "Discard any number of cards, then draw that many plus one" (Brass's Tunnel-Grinder, Colossus of the Blood Age, and Valakut Awakening's bottom variant)
async function frWheel(P, src, bottom) {
    const human = !(P.isAI || AUTOPLAY);
    let chosen = [];
    if (human) { const left = P.hand.slice(); for (;;) { if (!left.length) break; const x = await pickCard(P, left, `${src.card.name}: ${bottom ? 'put a card on the bottom of your library' : 'discard a card'} (or stop)`, { optional: true }); if (!x) break; chosen.push(x); left.splice(left.indexOf(x), 1); } }
    else chosen = P.hand.slice().sort((a, b) => aiKeepValue(P, a) - aiKeepValue(P, b)).filter(c => aiKeepValue(P, c) < 3).slice(0, 3);
    chosen.forEach(c => { pull(P.hand, c); if (bottom) P.library.unshift(c); else { P.gy.push(c); c.discardTurn = G.turn; } });
    if (chosen.length && !bottom) noteDiscard(P, chosen.length);
    log(`${P.name} ${you(P) ? (bottom ? 'put' : 'discard') : (bottom ? 'puts' : 'discards')} ${chosen.length} card${chosen.length === 1 ? '' : 's'}${bottom ? ' on the bottom of the library' : ''}.`);
    drawCards(P, chosen.length + 1);
}
// Pick up to `limit` objects from a pool, one at a time (people choose, the computer takes `ai`)
async function frPickMany(P, pool, title, limit, ai) {
    if (P.isAI || AUTOPLAY) return ai.slice(0, limit);
    const out = []; const left = pool.slice();
    for (let k = 0; k < limit && left.length; k++) { const x = await pickCard(P, left, `${title} (${k + 1} of up to ${limit})`, { optional: true }); if (!x) break; out.push(x); left.splice(left.indexOf(x), 1); }
    return out;
}
Object.assign(CMD, {
    fr_surveyor(P, e, t, src) {
        const Q = opp(P); if (P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= Q.bf.filter(x => /\bLand\b/.test(x.card.type)).length) return;
        const pl = P.library.find(c => /\bBasic\b/.test(c.card.type) && hasType(c, 'Plains')); if (!pl) { P.library = shuffle(P.library); return; }
        pull(P.library, pl); putOntoBattlefield(P, pl, true); P.library = shuffle(P.library);
    },
    fr_rats(P, e, t, src) { const n = foes(P).length; if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'black Rat', kw: [] }, null, src); },
    fr_brassBounty(P, e, t, src) { const n = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length; for (let k = 0; k < n; k++) makeArtifactToken(P, 'treasure'); log(`${P.name} ${you(P) ? 'create' : 'creates'} ${n} Treasure token${n === 1 ? '' : 's'}.`); },
    async fr_wheelPlus(P, e, t, src) { await frWheel(P, src, false); },
    async fr_valakut(P, e, t, src) { await frWheel(P, src, true); },
    fr_bore(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const descended = P.gy.some(c => /Artifact|Creature|Enchantment|Land|Planeswalker|Battle/.test(c.card.type) && (c.discardTurn === G.turn || c.diedAtTurn === G.turn || c.gyTurn === G.turn));
        if (!descended) return;
        src.ctr.bore = (src.ctr.bore || 0) + 1; log(`${src.card.name} gets a bore counter (${src.ctr.bore}).`);
        if (src.ctr.bore >= 3) { src.ctr.bore = 0; applyEffect(P, { t: 'transform' }, null, src); }
    },
    fr_brilliant(P, e, t, src) { const back = P.gy.filter(c => /Artifact|Enchantment/.test(c.card.type)); back.forEach(c => putOntoBattlefield(P, c, false)); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${back.length} artifact and enchantment card${back.length === 1 ? '' : 's'} to the battlefield.`); },
    async fr_gearhulk(P, e, t, src) {
        const keep = new Set();
        for (const X of G.players.filter(pl => !pl.out)) {
            for (const kind of ['Artifact', 'Creature', 'Enchantment', 'Planeswalker']) {
                const pool = X.bf.filter(x => !/\bLand\b/.test(x.card.type) && (kind === 'Creature' ? isCreature(x) : new RegExp(`\\b${kind}\\b`).test(x.card.type)) && !keep.has(x));
                if (!pool.length) continue;
                const pick = await chooseFrom(X, pool.slice(), `${src.card.name}: choose ${kind === 'Artifact' || kind === 'Enchantment' ? 'an' : 'a'} ${kind.toLowerCase()} to keep`, false);
                // chooseFrom gives up the least valuable one for the computer; here a computer keeps the MOST valuable
                const best = (X.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => permValue(b) - permValue(a))[0] : pick;
                if (best) keep.add(best);
            }
        }
        const lose = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !keep.has(x));
        lose.forEach(x => { if (onBf(x.uid)) { fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); } });
        log(`${src.card.name}: ${lose.length} permanents are sacrificed.`);
    },
    async fr_chaotic(P, e, t, src) {
        const kinds = ['Artifact', 'Creature', 'Enchantment', 'Planeswalker', 'Land'];
        const exiled = [];
        for (const kind of kinds) {
            const pool = allPerms().filter(x => (kind === 'Creature' ? isCreature(x) : new RegExp(`\\b${kind}\\b`).test(x.card.type)) && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i));
            if (!pool.length) continue;
            let x = null;
            if (P.isAI || AUTOPLAY) { const theirs = pool.filter(y => y.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0]; const mine = pool.filter(y => y.owner === P.i && permValue(y) <= 2 && !/\bLand\b/.test(y.card.type) && !y.isCommander).sort((a, b) => permValue(a) - permValue(b))[0]; x = theirs && kind !== 'Land' ? theirs : mine || null; }
            else x = await pickCard(P, pool, `${src.card.name}: exile up to one ${kind.toLowerCase()}`, { optional: true });
            if (x) exiled.push([x, kind]);
        }
        for (const [x, kind] of exiled) {
            if (!onBf(x.uid)) continue;
            const X = G.players[x.owner]; const types = x.card.type.split(' — ')[0].split(' ').filter(w => ['Artifact', 'Creature', 'Enchantment', 'Planeswalker', 'Land', 'Battle'].includes(w));
            leaveBattlefield(x, 'exile'); log(`${x.card.name} is exiled.`);
            let found = null; const revealed = [];
            while (X.library.length) { const c = X.library.pop(); if (types.some(ty => new RegExp(`\\b${ty}\\b`).test(c.card.type))) { found = c; break; } revealed.push(c); }
            X.library.unshift(...revealed); X.library = shuffle(X.library);
            if (found) putOntoBattlefield(X, found, false); else log(`${X.name} ${you(X) ? 'have' : 'has'} no card to put onto the battlefield.`);
        }
    },
    fr_tutorDiscardRandom(P, e, t, src) {
        const c = P.library.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
        if (c) { pull(P.library, c); P.hand.push(c); log(`${P.name} ${you(P) ? 'search' : 'searches'} for ${c.card.name}.`); }
        P.library = shuffle(P.library);
        if (P.hand.length) { const d = P.hand[Math.floor(Math.random() * P.hand.length)]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name} at random.`); }
    },
    fr_ghostArk(P, e, t, src) { const n = P.gy.filter(c => /\bArtifact\b/.test(c.card.type) && /\bCreature\b/.test(c.card.type)); n.forEach(c => { c.grantUnearthTurn = G.turn; }); if (n.length) log(`${n.length} artifact creature card${n.length === 1 ? '' : 's'} in your graveyard gain unearth {3} until end of turn.`); },
    async fr_invokeJustice(P, e, t, src) {
        const c = await frPick(P, P.gy.filter(x => !/Instant|Sorcery/.test(x.card.type)), `${src.card.name}: return a permanent card from your graveyard to the battlefield`);
        if (c) { pull(P.gy, c); putOntoBattlefield(P, c, false); }
        let X = P; if (!(P.isAI || AUTOPLAY)) X = await frPickPlayer(P, `${src.card.name}: distribute four +1/+1 counters among creatures and Vehicles of which player?`, G.players.filter(pl => !pl.out)) || P;
        const pool = X.bf.filter(x => isCreature(x) || hasType(x, 'Vehicle')); if (!pool.length) return;
        for (let k = 0; k < 4; k++) { const x = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (pow(b) + tou(b)) - (pow(a) + tou(a)))[0] : await pickCard(P, pool, `${src.card.name}: put a +1/+1 counter on (${k + 1} of 4)`, { required: true }); if (x) putCounters(x, 1, P); }
    },
    fr_ironSpider(P, e, t, src) { const hit = P.bf.filter(x => (isCreature(x) && /\bArtifact\b/.test(x.card.type)) || hasType(x, 'Vehicle')); hit.forEach(x => putCounters(x, 1, P)); log(`${hit.length} artifact creature${hit.length === 1 ? '' : 's'} and Vehicles get a +1/+1 counter.`); },
    fr_ironDraw(P, e, t, src) {
        let need = 2; const pool = P.bf.filter(x => /\bArtifact\b/.test(x.card.type) && x.counters > 0).sort((a, b) => a.counters - b.counters);
        for (const x of pool) { while (need > 0 && x.counters > 0) { x.counters--; need--; } }
        if (need === 0) { log(`${P.name} ${you(P) ? 'remove' : 'removes'} two +1/+1 counters from artifacts.`); drawCards(P, 1); }
    },
    async fr_returnArtifact(P, e, t, src) { const c = await frPick(P, P.gy.filter(x => /\bArtifact\b/.test(x.card.type)), `${src.card.name}: return an artifact card to the battlefield`); if (c) { pull(P.gy, c); putOntoBattlefield(P, c, false); } },
    fr_rampagerCombat(P, e, t, src) { if (!onBf(src.uid)) return; const fs = foes(P); if (!fs.length) return; src.frForceAtk = G.turn; const F = fs[Math.floor(Math.random() * fs.length)]; src.atkTo = F.i; log(`${src.card.name} must attack ${F.name === 'You' ? 'you' : F.name} this combat if able.`); },
    fr_rampagerDies(P, e, t, src) { const fs = foes(P); if (!fs.length) return; const F = fs[Math.floor(Math.random() * fs.length)]; damage(F, 4, src); },
    fr_necron(P, e, t, src) {
        const milled = doMill(P, 3) || []; const n = milled.filter(c => /\bCreature\b/.test(c.card.type)).length;
        if (n) applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'black Necron Warrior', kw: [], artifact: true }, null, src);
    },
    fr_pupu(P, e, t, src) { if (!onBf(src.uid)) return; const n = P.bf.filter(x => hasType(x, 'Town')).length; src.baseSet = { turn: G.turn, p: n, q: Number(src.card.toughness) || 0 }; log(`${src.card.name}'s base power becomes ${n} until end of turn.`); },
    async fr_reunion(P, e, t, src) {
        let budget = 10; const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (Number(c.card.power) || 0) <= budget); const got = [];
        if (P.isAI || AUTOPLAY) { for (const c of pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))) { const pw = Number(c.card.power) || 0; if (pw <= budget) { got.push(c); budget -= pw; } } }
        else { const left = pool.slice(); for (;;) { const ok = left.filter(c => (Number(c.card.power) || 0) <= budget); if (!ok.length) break; const c = await pickCard(P, ok, `${src.card.name}: return a creature card (total power left: ${budget})`, { optional: true }); if (!c) break; got.push(c); budget -= Number(c.card.power) || 0; left.splice(left.indexOf(c), 1); } }
        got.forEach(c => { pull(P.gy, c); putOntoBattlefield(P, c, false); });
        src.exileAfter = true;
    },
    fr_oracle(P, e, t, src) { const O = foes(P).sort((a, b) => b.hand.length - a.hand.length)[0]; if (O && O.hand.length > P.hand.length) drawCards(P, O.hand.length - P.hand.length); },
    async fr_snort(P, e, t, src) {
        const order = [P, ...foes(P)]; const did = [];
        for (const X of order) {
            const yes = (X.isAI || AUTOPLAY) ? X.hand.length <= 3 : await askYes(X, `${src.card.name}: discard your hand and draw five cards?`, { card: src.card, yes: 'Discard and draw five', no: 'Keep my hand' });
            if (!yes) continue;
            X.hand.splice(0).forEach(c => { X.gy.push(c); c.discardTurn = G.turn; }); drawCards(X, 5); did.push(X);
        }
        did.filter(X => X !== P).forEach(X => damage(X, 5, src));
    },
    fr_stormOfSouls(P, e, t, src) {
        const back = P.gy.filter(c => /\bCreature\b/.test(c.card.type));
        back.forEach(c => { putOntoBattlefield(P, c, false); c.baseForever = { p: 1, q: 1 }; c.addedTypes = [...(c.addedTypes || []), 'Spirit']; c.ctr.flying = (c.ctr.flying || 0) + 1; });
        src.exileAfter = true; log(`${back.length} creature card${back.length === 1 ? '' : 's'} return as 1/1 Spirits with flying.`);
    },
    fr_bahamut(P, e, t, src) { const n = P.bf.filter(x => x !== src).reduce((a, x) => a + (x.card.cmc || 0), 0); foes(P).forEach(F => damage(F, n, src)); },
    fr_knights(P, e, t, src) { P.bf.filter(x => isCreature(x) && x !== src).forEach(x => { x.tp += 2; x.tq += 2; x.ctr.indestructible = (x.ctr.indestructible || 0) + 1; }); log('Other creatures you control get +2/+2 until end of turn and an indestructible counter.'); },
    async fr_kujata(P, e, t, src) {
        if (!P.hand.length) { drawCards(P, 2); return; }
        const d = await chooseDiscard(P, src.card.name); if (!d) { drawCards(P, 2); return; }
        pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); drawCards(P, 2);
        const n = d.card.cmc || 0; foes(P).forEach(F => damage(F, n, src));
    },
    fr_triadEmblem(P, e, t, src) {
        let need = 30; const out = []; for (const c of P.gy.filter(frHist).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))) { if (need <= 0) break; out.push(c); need -= c.card.cmc || 0; }
        if (need > 0) return; out.forEach(c => { pull(P.gy, c); P.exile.push(c); });
        (P.emblems = P.emblems || []).push('frNine'); log(`${P.name} ${you(P) ? 'get' : 'gets'} an emblem: creatures you control have base power and toughness 9/9.`);
    },
    fr_tripleTriad(P, e, t, src) {
        const exiled = G.players.filter(X => !X.out && X.library.length).map(X => ({ X, c: X.library.pop() }));
        exiled.forEach(({ X, c }) => { c.realOwner = X.i; });
        const mine = exiled.find(r => r.X === P); const mv = mine ? (mine.c.card.cmc || 0) : -1;
        exiled.forEach(({ X, c }) => { const ok = X === P || (c.card.cmc || 0) < mv; if (ok) { c.owner = P.i; c.playUntil = G.turn; c.freeCast = true; P.exile.push(c); } else X.exile.push(c); });
        log(`Each player exiles the top card of their library: ${exiled.map(r => r.c.card.name).join(', ')}.`);
    },
    async fr_tuneUp(P, e, t, src) {
        const c = await frPick(P, P.gy.filter(x => /\bArtifact\b/.test(x.card.type)), `${src.card.name}: return an artifact card to the battlefield`); if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c, false);
        if (hasType(c, 'Vehicle') && onBf(c.uid)) { c.permAnimated = { p: Number(c.card.power) || 0, q: Number(c.card.toughness) || 0 }; log(`${c.card.name} becomes an artifact creature.`); }
    },
    // ---- Jadzi ----
    async fr_archway(P, e, t, src) {
        const l = await frBounceLand(P, src, () => true); if (l && l !== src && hasType(l, 'Desert')) await applyEffect(P, { t: 'surveil', n: 1 }, null, src);
    },
    async fr_karoo(P, e, t, src) {
        const pool = P.bf.filter(x => hasType(x, e.land) && !x.tapped && x !== src);
        const l = pool.length ? ((P.isAI || AUTOPLAY) ? pool[0] : await pickCard(P, pool, `${src.card.name}: return an untapped ${e.land} you control to hand (or sacrifice it)`, { optional: true })) : null;
        if (l) { leaveBattlefield(l, 'hand'); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${l.card.name} to hand.`); }
        else if (onBf(src.uid)) { log(`${src.card.name} is sacrificed.`); fire('sacrificed', { o: src }); dieOrLeave(src, 'gy'); }
    },
    async fr_doppelgang(P, e, t, src) {
        const x = G.curX || 0; if (x <= 0) return;
        const pool = allPerms().filter(y => !has(y, 'shroud') && !(has(y, 'hexproof') && y.owner !== P.i));
        const chosen = await frPickMany(P, pool, `${src.card.name}: choose a permanent`, x, pool.filter(y => y.owner === P.i).sort((a, b) => permValue(b) - permValue(a)));
        chosen.forEach(y => { for (let k = 0; k < x; k++) tokenCopyOf(P, y.card); });
    },
    fr_hydro(P, e, t, src) {
        const it = t && t.item; if (!it || it.kind !== 'spell' || !G.stack.includes(it) || !onBf(src.uid)) return;
        if (!it.target || it.target.p) { if (!it.target || !it.target.o) return; }
        const te = firstTargetEffect(it.o); if (!te) return;
        if (!validTargets(it.P, te, it.o).some(v => v.o === src)) { log(`${src.card.name} can't be the new target of ${it.name}.`); return; }
        it.target = { o: src }; log(`${it.name} now targets ${src.card.name}.`);
    },
    fr_sphinx(P, e, t, src) {
        const O = foes(P).sort((a, b) => b.library.length - a.library.length)[0]; if (!O) return;
        for (let k = 0; k < 20; k++) {
            const m = doMill(O, 2) || []; const nl = m.filter(c => !/\bLand\b/.test(c.card.type));
            if (!(nl.length === 2 && (nl[0].card.colors || []).some(c => (nl[1].card.colors || []).includes(c)))) break;
        }
    },
    async fr_wonderscape(P, e, t, src) {
        const l = await frBounceLand(P, src, () => true); if (!l) return;
        drawCards(P, 1);
        const nonbasic = (l.card.type.split(' — ')[1] || '').split(' ').filter(Boolean).some(w => !frBasicTypes.includes(w));
        if (!nonbasic && P.hand.length) { const d = await chooseDiscard(P, src.card.name); if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); } }
    },
    // ---- Torgaar ----
    fr_torgaar(P, e, t, src) { const pl = t && t.p; if (!pl) return; pl.life = Math.floor((pl.startLife || 20) / 2); log(`${pl.name === 'You' ? 'Your' : `${pl.name}'s`} life total becomes ${pl.life}.`); },
    async fr_vendetta(P, e, t, src) {
        const O = await frOpp(P, `${src.card.name}: target opponent`); if (!O) return;
        const known = [...new Set([...O.bf, ...O.gy, ...O.exile].map(x => x.card.name))];
        let name;
        if (P.isAI || AUTOPLAY) { const cnt = {}; [...O.hand, ...O.library].forEach(c => { cnt[c.card.name] = (cnt[c.card.name] || 0) + 1; }); name = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
        else name = known.length ? await pickWord(P, `${src.card.name}: choose a card name`, known) : null;
        if (!name) return;
        let n = 0; for (const zone of [O.gy, O.hand, O.library]) { for (const c of zone.slice()) { if (n >= 4) break; if (c.card.name === name) { pull(zone, c); O.exile.push(c); n++; } } }
        O.library = shuffle(O.library); log(`${P.name} ${you(P) ? 'name' : 'names'} ${name}: ${n} card${n === 1 ? '' : 's'} exiled.`);
    },
    async fr_anotherChance(P, e, t, src) {
        if (P.library.length > 2 && ((P.isAI || AUTOPLAY) ? P.gy.filter(c => /\bCreature\b/.test(c.card.type)).length < 2 : await askYes(P, `${src.card.name}: mill two cards?`, { card: src.card }))) doMill(P, 2);
        const got = await frPickMany(P, P.gy.filter(c => /\bCreature\b/.test(c.card.type)), `${src.card.name}: return a creature card to your hand`, 2, P.gy.filter(c => /\bCreature\b/.test(c.card.type)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)));
        got.forEach(c => { pull(P.gy, c); P.hand.push(c); });
    },
    fr_corpseAugur(P, e, t, src) { const pl = t && t.p; if (!pl) return; const n = pl.gy.filter(c => /\bCreature\b/.test(c.card.type)).length; if (n) { drawCards(P, n); P.life -= n; log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${n} life.`); } },
    async fr_court(P, e, t, src) {
        const monarch = G.monarch === P.i; const lose = monarch ? 6 : 3, disc = monarch ? 2 : 1;
        for (const F of foes(P)) {
            const can = F.hand.length >= disc;
            const pay = can && ((F.isAI || AUTOPLAY) ? F.hand.length > 3 || F.life <= lose + 3 : await askYes(F, `${src.card.name}: discard ${disc} card${disc === 1 ? '' : 's'} instead of losing ${lose} life?`, { card: src.card, yes: `Discard ${disc}`, no: `Lose ${lose} life` }));
            if (pay) { for (let k = 0; k < disc; k++) { const d = await chooseDiscard(F, src.card.name); if (d) { pull(F.hand, d); F.gy.push(d); d.discardTurn = G.turn; noteDiscard(F, 1); } } }
            else { F.life -= lose; log(`${F.name} ${you(F) ? 'lose' : 'loses'} ${lose} life.`); }
        }
    },
    async fr_disciple(P, e, t, src) {
        const both = P.life === 13 && ((P.isAI || AUTOPLAY) || await askYes(P, `${src.card.name}: choose both modes?`, { card: src.card, yes: 'Both', no: 'Just one' }));
        let m1 = both, m2 = both;
        if (!both) { if (P.isAI || AUTOPLAY) { m1 = P.life > 4; m2 = !m1; } else { m1 = await askYes(P, `${src.card.name}: draw a card and lose 1 life (Yes) or exile an opponent's graveyard and make them lose 1 life (No)?`, { card: src.card, yes: 'Draw a card', no: 'Exile graveyard' }); m2 = !m1; } }
        if (m1) { drawCards(P, 1); P.life -= 1; }
        if (m2) { const O = foes(P).sort((a, b) => b.gy.length - a.gy.length)[0]; if (O) { O.gy.splice(0).forEach(c => O.exile.push(c)); O.life -= 1; log(`${O.name === 'You' ? 'Your' : `${O.name}'s`} graveyard is exiled and ${O.name === 'You' ? 'you lose' : `${O.name} loses`} 1 life.`); } }
    },
    async fr_finale(P, e, t, src) {
        const x = G.curX || 0;
        const pool = allPerms().filter(c => isCreature(c) && tou(c) <= x && !has(c, 'shroud') && !(has(c, 'hexproof') && c.owner !== P.i));
        const ai = pool.filter(c => c.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a));
        const chosen = await frPickMany(P, pool, `${src.card.name}: destroy a creature with toughness ${x} or less`, 3, ai);
        chosen.forEach(c => { if (onBf(c.uid)) destroy(c); });
        if (x >= 10) { const back = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); back.forEach(c => putOntoBattlefield(P, c, false)); }
    },
    async fr_footChopper(P, e, t, src) {
        const host = onBf(src.attachedTo); if (!host) return;
        const yes = (P.isAI || AUTOPLAY) ? pow(host) >= 4 : await askYes(P, `${src.card.name}: sacrifice ${host.card.name} to draw ${pow(host)} cards?`, { card: src.card });
        if (!yes) return; const n = pow(host); fire('sacrificed', { o: host }); dieOrLeave(host, 'gy'); drawCards(P, n);
    },
    async fr_intimidation(P, e, t, src) {
        const O = await frOpp(P, `${src.card.name}: target opponent`); if (!O) return;
        const pool = O.hand.filter(c => /Artifact|Creature/.test(c.card.type)); log(`${O.name} reveals ${O.hand.length ? O.hand.map(c => c.card.name).join(', ') : 'no cards'}.`);
        const c = await frPick(P, pool, `${src.card.name}: choose an artifact or creature card to exile`); if (c) { pull(O.hand, c); O.exile.push(c); log(`${c.card.name} is exiled.`); }
    },
    fr_noMercy(P, e, t, src) { const raw = G.ctxRaw || {}; const c = raw.src; if (c && onBf(c.uid)) destroy(c); },
    async fr_rabid(P, e, t, src) {
        const pool = P.bf.filter(isCreature);
        const chosen = await frPickMany(P, pool, `${src.card.name}: choose a creature`, pool.length, pool);
        chosen.forEach(c => { c.tp += 1; c.frDieDraw = G.turn; });
        log(`${chosen.length} creature${chosen.length === 1 ? ' gets' : 's get'} +1/+0 and "when this creature dies, draw a card" until end of turn.`);
    },
    async fr_pest(P, e, t, src) {
        for (const F of foes(P)) { if (!F.hand.length) continue; const d = await chooseDiscard(F, src.card.name); if (d) { pull(F.hand, d); F.gy.push(d); d.discardTurn = G.turn; noteDiscard(F, 1); } }
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'black Pest', kw: [], text: 'Whenever ~ attacks, you gain 1 life.' }, null, src);
    },
    fr_tallyman(P, e, t, src) {
        const n = G.frDied && G.frDied.turn === G.turn ? G.frDied.n : 0; if (!n) return;
        if (n >= 7) { drawCards(P, 7); P.life -= 7; } else { drawCards(P, 1); P.life -= 1; }
    },
    async fr_elevator(P, e, t, src) {
        const n = (src.ctr && src.ctr.charge) || 0; if (n <= 0) return;
        const cols = ['W', 'U', 'B', 'R', 'G']; let c = cols[Math.floor(Math.random() * 0)] || 'B';
        if (!(P.isAI || AUTOPLAY)) { const w = await pickWord(P, `${src.card.name}: choose a color`, cols.map(k => COLOR_NAMES[k])); c = cols.find(k => COLOR_NAMES[k] === w) || c; }
        else if (typeof bestPoolColor === 'function') c = bestPoolColor(P) || c;
        P.pool = (P.pool || []).concat(Array(n).fill(c)); log(`${P.name} add${you(P) ? '' : 's'} ${('{' + c + '}').repeat(Math.min(n, 12))}.`);
    },
    async fr_craft(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = [...P.bf.filter(x => isCreature(x) && x !== src), ...P.gy.filter(c => /\bCreature\b/.test(c.card.type))];
        const x = await frPick(P, pool, `${src.card.name}: exile a creature you control or a creature card from your graveyard (craft)`, { rank: (a, b) => creatureValue(a) - creatureValue(b) }); if (!x) return;
        if (onBf(x.uid)) leaveBattlefield(x, 'exile'); else { pull(P.gy, x); P.exile.push(x); }
        log(`${x.card.name} is exiled (craft).`);
        await applyEffect(P, { t: 'exileReturnTransformed' }, null, src);
    },
    async fr_transpose(P, e, t, src) {
        drawCards(P, 1); if (P.hand.length) { const d = await chooseDiscard(P, src.card.name); if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); } }
        P.life -= 1; log(`${P.name} ${you(P) ? 'lose' : 'loses'} 1 life.`);
        if (src.castFromHand === G.turn) await applyEffect(P, { t: 'token', n: 1, p: 0, q: 1, name: 'black Wizard', kw: [], text: 'Whenever you cast a noncreature spell, ~ deals 1 damage to each opponent.' }, null, src);
    },
    fr_curseTick(P, e, t, src) { const pl = G.players[src.hostPlayer]; if (!pl || pl.out) return; pl.life -= 1; P.life += 1; log(`${pl.name} ${you(pl) ? 'lose' : 'loses'} 1 life and ${P.name} ${you(P) ? 'gain' : 'gains'} 1 life (${src.card.name}).`); },
    fr_hermit(P, e, t, src) { const n = devotion(P, ['B']); if (n > 0) applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Squirrel', kw: [] }, null, src); },
    async fr_necromancer(P, e, t, src) {
        if (P.gy.length < 2 || !P.gy.some(c => /\bCreature\b/.test(c.card.type))) return;
        const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: exile two cards from your graveyard to return a creature card?`, { card: src.card });
        if (!yes) return;
        const target = await frPick(P, P.gy.filter(c => /\bCreature\b/.test(c.card.type)), `${src.card.name}: return which creature card?`); if (!target) return;
        const fodder = P.gy.filter(c => c !== target).sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0));
        const two = (P.isAI || AUTOPLAY) ? fodder.slice(0, 2) : await frPickMany(P, fodder, `${src.card.name}: exile a card from your graveyard`, 2, fodder);
        if (two.length < 2) return; two.forEach(c => { pull(P.gy, c); P.exile.push(c); });
        pull(P.gy, target); putOntoBattlefield(P, target, false);
    },
    async fr_zuko(P, e, t, src) {
        const c = await frPick(P, P.gy.filter(x => /\bCreature\b/.test(x.card.type)), `${src.card.name}: return a creature card from your graveyard`); if (!c) return;
        pull(P.gy, c); if (src.kicked) putOntoBattlefield(P, c, true); else { P.hand.push(c); log(`${c.card.name} returns to hand.`); }
    }
});
async function frBounceLand(P, src, filt) {
    const ls = P.bf.filter(x => /\bLand\b/.test(x.card.type) && filt(x)).sort((a, b) => (b.tapped - a.tapped) || (isBasic(b.card) - isBasic(a.card)) || ((a === src) - (b === src)));
    if (!ls.length) return null;
    const l = (P.isAI || AUTOPLAY || ls.length === 1) ? ls[0] : await pickCard(P, ls, `${src.card.name}: choose a land to return to your hand`, { required: true });
    if (l) { leaveBattlefield(l, 'hand'); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${l.card.name} to hand.`); }
    return l || null;
}

Object.assign(CMD, {
    fr_sinkStupor(P, e, t, src) {
        if (!t) return;
        if (t.item) { const it = t.item; if (!G.stack.includes(it)) return; pull(G.stack, it); const X = G.players[it.o.owner]; resetObj(it.o); X.hand.push(it.o); log(`${it.name} is returned to its owner's hand.`); return; }
        const x = t.o; if (x && onBf(x.uid)) { leaveBattlefield(x, 'hand'); log(`${x.card.name} is returned to its owner's hand.`); }
    },
    async fr_stepBetween(P, e, t, src) {
        for (const X of [P, ...foes(P)]) {
            const yes = (X.isAI || AUTOPLAY) ? X.hand.length < 4 : await askYes(X, `${src.card.name}: shuffle your hand and graveyard into your library and draw seven cards?`, { card: src.card, yes: 'Shuffle and draw seven', no: 'Keep them' });
            if (!yes) continue;
            X.library.push(...X.hand.splice(0), ...X.gy.splice(0)); X.library = shuffle(X.library); drawCards(X, 7);
        }
        src.exileAfter = true;
    }
});

// ================= Fixes of the approximations (2026-11-02, owner: "Can fix the approximations?") =================
// ---- Type any card name (Ancient Vendetta) ----
function askName(P, msg, opts = {}) {
    if (AUTOPLAY && !(G && G.hotseat)) return Promise.resolve(opts.def ?? null);
    if (G && G.hotseat && P && G.view !== P.i) return handTo(P).then(() => askName(P, msg, opts));
    if (actBusy()) return actDrain().then(() => askName(P, msg, opts));
    return new Promise(resolve => {
        window.__ask = ok => { const v = ok ? String((document.getElementById('askNameBox') || {}).value || '').trim() : null; closeModal(); window.__ask = null; renderGame(); resolve(v || null); };
        const names = [...new Set([...CARDS.values()].map(c => c.name))].sort().slice(0, 4000);
        showModal(`<div class="ask" role="dialog" aria-label="Name a card">${choiceCardHTML(opts.card)}<div class="ask-body">
            ${G && G.hotseat && P ? `<div class="lane-label">${esc(P.name)} decides</div>` : ''}
            <h2>${esc(msg)}</h2>
            <input type="text" id="askNameBox" list="askNameList" autocomplete="off" placeholder="Type a card name" style="width:100%" onkeydown="if(event.key==='Enter')__ask(true)">
            <datalist id="askNameList">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
            <div class="ask-actions"><button class="btn primary" onclick="__ask(true)">✔ ${esc(opts.ok || 'Name it')}</button><button class="btn" onclick="__ask(false)">Cancel</button></div></div></div>`);
        setTimeout(() => { const b = document.getElementById('askNameBox'); if (b) b.focus(); }, 30);
    });
}
// ---- Assist: another person at the table pays part of the generic cost ----
async function frAssistAsk(P, o) {
    const gen = () => Math.max(0, (totalCost(P, o).generic || 0) + ((costOf(P, o).x ? (o.xVal || 0) * xMult(o) : 0)));
    for (const X of foes(P)) {
        if (X.isAI || AUTOPLAY) continue; // the computer never helps
        const free = (() => { let n = 0; while (n < 20 && planPayment(X, { ...parseCost('') }, n + 1)) n++; return n; })();
        const mx = Math.min(gen(), free); if (mx <= 0) continue;
        const n = await askNumber(X, `${o.card.name}: pay up to {${mx}} of its cost (assist)?`, 0, mx, 0, { card: o.card, ok: 'Pay' });
        if (n > 0) { o.assist.push({ X, n }); o.assistN += n; }
    }
}
function frAssistPay(P, o) {
    for (const a of o.assist) {
        const plan = planPayment(a.X, { ...parseCost('') }, a.n);
        if (plan) { plan.forEach(s => tapSource(a.X, s)); log(`${a.X.name} ${you(a.X) ? 'pay' : 'pays'} {${a.n}} of ${o.card.name}'s cost (assist).`); }
    }
}
// ---- "Any number of target ...": chosen as the spell is cast (or the ability goes on the stack), checked again as it resolves ----
const frLegalCreature = (P, x) => isCreature(x) && !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i);
const FR_MULTI = {
    morningtide: { title: 'exile a creature', pool: P => allPerms().filter(x => frLegalCreature(P, x)), max: () => Infinity, ai: (P, pool) => pool.filter(x => x.owner === P.i && frEtbValue(x) >= 3) },
    rabid: { title: 'choose a creature', pool: P => P.bf.filter(x => frLegalCreature(P, x)), max: () => Infinity, ai: (P, pool) => pool },
    reunion: { title: 'return a creature card', pool: P => P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (Number(c.card.power) || 0) <= 10), budget: c => Number(c.card.power) || 0, total: 10, max: () => Infinity, ai: (P, pool) => pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)) },
    doppel: { title: 'choose a permanent', pool: P => allPerms().filter(x => !has(x, 'shroud') && !(has(x, 'hexproof') && x.owner !== P.i)), max: x => x, ai: (P, pool) => pool.filter(y => y.owner === P.i).sort((a, b) => permValue(b) - permValue(a)) },
    finale: { title: 'destroy a creature', pool: (P, x) => allPerms().filter(c => frLegalCreature(P, c) && tou(c) <= x), max: () => 3, ai: (P, pool) => pool.filter(c => c.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a)) },
    phase: { title: 'phase out a creature', pool: P => allPerms().filter(c => frLegalCreature(P, c)), max: x => x, ai: (P, pool) => pool.filter(c => c.owner !== P.i).sort((a, b) => creatureValue(b) - creatureValue(a)) },
    surfer: { title: 'exile another permanent you control', pool: (P, x, src) => P.bf.filter(y => y !== src), max: () => Infinity, ai: (P, pool) => pool.filter(y => frEtbValue(y) >= 3) },
    mantle: { title: 'return an Aura or Equipment card', pool: P => P.gy.filter(c => /\b(?:Aura|Equipment)\b/.test(c.card.type)), max: () => Infinity, ai: (P, pool) => pool },
    equip: { title: 'attach an Equipment', pool: (P, x, src) => allPerms().filter(y => /\bEquipment\b/.test(y.card.type) && !(src && y.attachedTo === src.uid) && !has(y, 'shroud') && !(has(y, 'hexproof') && y.owner !== P.i)), max: () => Infinity, ai: (P, pool) => pool.filter(y => y.owner === P.i) }
};
function frMultiOf(o) { const r = Rx(o); return (r.spell || []).find(e => e && e.multi) || null; }
function frMultiAI(P, src, kind, x) {
    if (kind === 'invoke') { const c = P.gy.filter(k => !/Instant|Sorcery/.test(k.card.type)).sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] || null; return { card: c, player: P }; }
    if (kind === 'chaotic') {
        const list = [];
        for (const kd of ['Artifact', 'Creature', 'Enchantment', 'Planeswalker', 'Land']) {
            const pool = allPerms().filter(y => (kd === 'Creature' ? isCreature(y) : new RegExp(`\\b${kd}\\b`).test(y.card.type)) && !has(y, 'shroud') && !(has(y, 'hexproof') && y.owner !== P.i));
            const theirs = pool.filter(y => y.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0];
            const mine = pool.filter(y => y.owner === P.i && permValue(y) <= 2 && !/\bLand\b/.test(y.card.type) && !y.isCommander).sort((a, b) => permValue(a) - permValue(b))[0];
            const pick = theirs && kd !== 'Land' ? theirs : mine || null; if (pick) list.push(pick);
        }
        return { list };
    }
    const cfg = FR_MULTI[kind]; if (!cfg) return { list: [] };
    const pool = cfg.pool(P, x, src), max = cfg.max(x); let list = cfg.ai(P, pool);
    if (cfg.budget) { let left = cfg.total; list = list.filter(c => { const w = cfg.budget(c); if (w <= left) { left -= w; return true; } return false; }); }
    return { list: list.slice(0, Number.isFinite(max) ? max : undefined) };
}
async function frMultiChoose(P, src, kind, x) {
    if (P.isAI || AUTOPLAY) return frMultiAI(P, src, kind, x);
    const name = src && src.card ? src.card.name : 'Choose';
    if (kind === 'invoke') {
        const cards = P.gy.filter(k => !/Instant|Sorcery/.test(k.card.type));
        const card = cards.length ? await pickCard(P, cards, `${name}: choose a permanent card in your graveyard`, { required: true }) : null;
        const player = await frPickPlayer(P, `${name}: distribute four +1/+1 counters among creatures and Vehicles of which player?`, G.players.filter(pl => !pl.out)) || P;
        return { card, player };
    }
    if (kind === 'chaotic') {
        const list = [];
        for (const kd of ['Artifact', 'Creature', 'Enchantment', 'Planeswalker', 'Land']) {
            const pool = allPerms().filter(y => (kd === 'Creature' ? isCreature(y) : new RegExp(`\\b${kd}\\b`).test(y.card.type)) && !has(y, 'shroud') && !(has(y, 'hexproof') && y.owner !== P.i));
            if (!pool.length) continue;
            const pick = await pickCard(P, pool, `${name}: exile up to one ${kd.toLowerCase()}`, { optional: true }); if (pick) list.push(pick);
        }
        return { list };
    }
    const cfg = FR_MULTI[kind]; if (!cfg) return { list: [] };
    const out = []; let left = cfg.budget ? cfg.total : 0; const max = cfg.max(x); const pool = cfg.pool(P, x, src).slice();
    for (let k = 0; k < max && pool.length; k++) {
        const ok = cfg.budget ? pool.filter(c => cfg.budget(c) <= left) : pool; if (!ok.length) break;
        const c = await pickCard(P, ok, `${name}: ${cfg.title}${Number.isFinite(max) ? ` (${k + 1} of up to ${max})` : ' (or stop)'}${cfg.budget ? ` - total power left ${left}` : ''}`, { optional: true });
        if (!c) break; out.push(c); pool.splice(pool.indexOf(c), 1); if (cfg.budget) left -= cfg.budget(c);
    }
    return { list: out };
}
const frMulti = async (P, src, kind, x) => G.curMulti || await frMultiChoose(P, src, kind, x);
// ---- "Descended": a permanent card was put into your graveyard from anywhere this turn ----
function frDescendWatch() {
    if (!G || !G.players) return;
    G.players.forEach(P => {
        const seen = P.frGySeen;
        if (seen) P.gy.forEach(c => { if (!seen.has(c.uid) && /Artifact|Creature|Enchantment|Land|Planeswalker|Battle/.test(c.card.type)) P.descendTurn = G.turn; });
        P.frGySeen = new Set(P.gy.map(c => c.uid));
    });
}
(function () {
    const sb = sba; sba = function () { const r = sb.apply(this, arguments); frDescendWatch(); return r; };
    const st = settle; settle = async function () { const r = await st.apply(this, arguments); frDescendWatch(); return r; };
    // Knight Rampager: it attacks the chosen player (matters in a pod)
    const da = declareAttackers;
    declareAttackers = function (P, attackers) { (attackers || []).forEach(x => { if (x.frForceTurn === G.turn && x.frForceTo !== undefined && G.players[x.frForceTo] && !G.players[x.frForceTo].out && G.players.length > 2) { x.atkTo = x.frForceTo; delete x.attackPW; } }); return da.apply(this, arguments); };
})();
Object.assign(CMD, {
    fr_bore(P, e, t, src) {
        if (!onBf(src.uid) || P.descendTurn !== G.turn) return;
        src.ctr.bore = (src.ctr.bore || 0) + 1; log(`${src.card.name} gets a bore counter (${src.ctr.bore}).`);
        if (src.ctr.bore >= 3) { src.ctr.bore = 0; applyEffect(P, { t: 'transform' }, null, src); }
    },
    fr_rampagerCombat(P, e, t, src) {
        if (!onBf(src.uid)) return; const fs = foes(P); if (!fs.length) return;
        const F = fs[Math.floor(Math.random() * fs.length)]; src.frForceTurn = G.turn; src.frForceTo = F.i; src.frForceAtk = G.turn;
        log(`${src.card.name} must attack ${F.name === 'You' ? 'you' : F.name} this combat if able.`);
    },
    async fr_morningtide(P, e, t, src) { const m = await frMulti(P, src, 'morningtide', 0); (m.list || []).filter(x => onBf(x.uid)).forEach(x => frBlinkPerm(P, x, { tapped: true })); },
    async fr_surfer(P, e, t, src) { const m = await frMulti(P, src, 'surfer', 0); (m.list || []).filter(x => onBf(x.uid) && x !== src).forEach(x => frBlinkPerm(P, x, { landTapped: true })); },
    async fr_rabid(P, e, t, src) {
        const m = await frMulti(P, src, 'rabid', 0); const chosen = (m.list || []).filter(x => onBf(x.uid));
        chosen.forEach(c => { c.tp += 1; c.frDieDraw = G.turn; });
        log(`${chosen.length} creature${chosen.length === 1 ? ' gets' : 's get'} +1/+0 and "when this creature dies, draw a card" until end of turn.`);
    },
    async fr_reunion(P, e, t, src) {
        const m = await frMulti(P, src, 'reunion', 0); let budget = 10;
        (m.list || []).filter(c => P.gy.includes(c)).forEach(c => { const w = Number(c.card.power) || 0; if (w <= budget) { budget -= w; pull(P.gy, c); putOntoBattlefield(P, c, false); } });
        src.exileAfter = true;
    },
    async fr_doppelgang(P, e, t, src) {
        const x = G.curX || 0; if (x <= 0) return; const m = await frMulti(P, src, 'doppel', x);
        (m.list || []).filter(y => onBf(y.uid)).forEach(y => { for (let k = 0; k < x; k++) tokenCopyOf(P, y.card); });
    },
    async fr_finale(P, e, t, src) {
        const x = G.curX || 0; const m = await frMulti(P, src, 'finale', x);
        (m.list || []).filter(c => onBf(c.uid) && tou(c) <= x).forEach(c => destroy(c));
        if (x >= 10) { const back = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); back.forEach(c => putOntoBattlefield(P, c, false)); }
    },
    async fr_phaseOutX(P, e, t, src) { const x = G.curX || 0; if (x <= 0) return; const m = await frMulti(P, src, 'phase', x); (m.list || []).filter(c => onBf(c.uid)).forEach(c => phaseOut(c)); },
    async fr_mantle(P, e, t, src) {
        const host = onBf(src.attachedTo); if (!host) return; const m = await frMulti(P, src, 'mantle', 0);
        const back = (m.list || []).filter(x => P.gy.includes(x));
        back.forEach(x => { putOntoBattlefield(P, x, false); x.attachedTo = host.uid; });
        if (back.length) log(`${back.map(x => x.card.name).join(', ')} return${back.length === 1 ? 's' : ''} attached to ${host.card.name}.`);
    },
    async fr_attachAll(P, e, t, src) {
        if (!onBf(src.uid)) return;
        let pool;
        if (e.multi) { const m = await frMulti(P, src, e.multi, 0); pool = (m.list || []).filter(x => onBf(x.uid) && x !== src); }
        else {
            const all = P.bf.filter(x => x !== src && x.attachedTo !== src.uid && (/\bEquipment\b/.test(x.card.type) || (!e.equipOnly && /\bAura\b/.test(x.card.type))));
            pool = (P.isAI || AUTOPLAY) ? all : await frPickMany(P, all, `${src.card.name}: attach an Aura or Equipment you control to it`, all.length, all);
        }
        if (!pool.length) return;
        pool.forEach(x => { x.attachedTo = src.uid; });
        log(`${P.name} ${you(P) ? 'attach' : 'attaches'} ${pool.map(x => x.card.name).join(', ')} to ${src.card.name}.`);
    },
    async fr_chaotic(P, e, t, src) {
        const m = await frMulti(P, src, 'chaotic', 0);
        for (const x of (m.list || [])) {
            if (!onBf(x.uid)) continue;
            const X = G.players[x.owner]; const types = x.card.type.split(' — ')[0].split(' ').filter(w => ['Artifact', 'Creature', 'Enchantment', 'Planeswalker', 'Land', 'Battle'].includes(w));
            leaveBattlefield(x, 'exile'); log(`${x.card.name} is exiled.`);
            let found = null; const revealed = [];
            while (X.library.length) { const c = X.library.pop(); if (types.some(ty => new RegExp(`\\b${ty}\\b`).test(c.card.type))) { found = c; break; } revealed.push(c); }
            X.library.unshift(...revealed); X.library = shuffle(X.library);
            if (found) putOntoBattlefield(X, found, false); else log(`${X.name} ${you(X) ? 'have' : 'has'} no card to put onto the battlefield.`);
        }
    },
    async fr_invokeJustice(P, e, t, src) {
        const m = await frMulti(P, src, 'invoke', 0);
        if (m.card && P.gy.includes(m.card)) { pull(P.gy, m.card); putOntoBattlefield(P, m.card, false); }
        const X = m.player || P; const pool = X.bf.filter(x => isCreature(x) || hasType(x, 'Vehicle')); if (!pool.length) return;
        for (let k = 0; k < 4; k++) { const x = (P.isAI || AUTOPLAY) ? pool.slice().sort((a, b) => (pow(b) + tou(b)) - (pow(a) + tou(a)))[0] : await pickCard(P, pool, `${src.card.name}: put a +1/+1 counter on (${k + 1} of 4)`, { required: true }); if (x) putCounters(x, 1, P); }
    },
    async fr_vendetta(P, e, t, src) {
        const O = await frOpp(P, `${src.card.name}: target opponent`); if (!O) return;
        let name;
        if (P.isAI || AUTOPLAY) { const cnt = {}; [...O.hand, ...O.library].forEach(c => { cnt[c.card.name] = (cnt[c.card.name] || 0) + 1; }); name = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; }
        else name = await askName(P, `${src.card.name}: choose a card name`, { card: src.card });
        if (!name) return;
        const lc = name.toLowerCase(); let n = 0, said = name;
        for (const zone of [O.gy, O.hand, O.library]) { for (const c of zone.slice()) { if (n >= 4) break; if (c.card.name.toLowerCase() === lc) { said = c.card.name; pull(zone, c); O.exile.push(c); n++; } } }
        O.library = shuffle(O.library); log(`${P.name} ${you(P) ? 'name' : 'names'} ${said}: ${n} card${n === 1 ? '' : 's'} exiled.`);
    },
    async fr_echo(P, e, t, src) {
        const it = t && t.item; if (!it || !G.stack.includes(it)) return;
        const copy = { ...it, id: stackSeq++, copy: true, also: undefined, key: null };
        const te = (it.effects || []).find(x => needsTarget(x) && !x.late);
        if (te && !(P.isAI || AUTOPLAY)) {
            const valid = validTargets(P, te, it.o);
            if (valid.length > 1 && await askYes(P, `Copy of ${it.name}: choose a new target?`, { card: it.o.card, yes: 'New target', no: 'Same target' })) { const saved = G.mode; const pick = await chooseTarget(P, te, it.o, true); G.mode = saved; if (pick) copy.target = pick; }
        }
        G.stack.push(copy); log(`${src.card.name}: ${it.name} is copied.`);
    }
});

Object.assign(CMD, {
    // Journey to the Oracle: put any number of land cards from your hand onto the battlefield; with eight or more lands you may discard a card to return it to hand
    async fr_journey(P, e, t, src) {
        const lands = P.hand.filter(c => Rx(c).kind === 'land');
        const put = await frPickMany(P, lands, `${src.card.name}: put a land card from your hand onto the battlefield`, lands.length, lands);
        put.forEach(l => { if (P.hand.includes(l)) { pull(P.hand, l); putOntoBattlefield(P, l, false); } });
        if (put.length) log(`${P.name} ${you(P) ? 'put' : 'puts'} ${put.length} land${put.length === 1 ? '' : 's'} onto the battlefield.`);
        if (P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= 8 && P.hand.length) {
            const yes = (P.isAI || AUTOPLAY) ? P.hand.some(c => aiKeepValue(P, c) < 3) : await askYes(P, `${src.card.name}: discard a card to return it to your hand?`, { card: src.card });
            if (yes) { const d = await chooseDiscard(P, src.card.name); if (d) { pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1); src.frToHand = true; log(`${src.card.name} returns to its owner's hand.`); } }
        }
    }
});

Object.assign(CMD, {
    fr_millHalf(P, e, t, src) { const X = t && t.p; if (!X) return; doMill(X, Math.floor(X.library.length / 2)); },
    async fr_heroLands(P, e, t, src) {
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Hero', kw: [] }, null, src);
        const tok = G.lastMade; const n = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
        if (tok && onBf(tok.uid) && n > 0) putCounters(tok, n, P);
    }
});

// ---- Back faces: The Argent Etchings, Tecutlan, Living Breakthrough ----
MANA_RIDERS.frTecutlan = function (P, o, srcPerm) {
    if (['instant', 'sorcery', 'land'].includes(Rx(o).kind)) return;
    (G.trigQ = G.trigQ || []).push({ P, o: srcPerm || o, effects: [{ t: 'discover', n: o.card.cmc || 0 }] });
};
Object.assign(CMD, {
    async fr_etch1(P, e, t, src) {
        for (let k = 0; k < 5; k++) { G.lastWipeN = 2; await CMD.incubate(P, {}, null, src); }
        for (const tok of P.bf.filter(x => x.incubatorN)) await CMD.incubatorTransform(P, {}, null, tok);
    },
    async fr_etch3(P, e, t, src) {
        const hit = allPerms().filter(x => x !== src && !/Artifact|Land/.test(x.card.type) && !hasType(x, 'Phyrexian'));
        log(`${src.card.name}: destroy ${hit.length} permanents (not artifacts, lands or Phyrexians).`);
        hit.forEach(x => { if (onBf(x.uid)) destroy(x); });
        if (!onBf(src.uid) || !src.front) return;
        const X = G.players[src.owner]; leaveBattlefield(src, 'exile');
        if (X.exile.includes(src)) { pull(X.exile, src); src.card = src.front; putOntoBattlefield(X, src, false); }
    },
    // Living Breakthrough: opponents can't cast spells with the same mana value as a spell you cast, until your next turn
    fr_breakthrough(P, e, t, src) {
        const o = G.ctxObjCast || null; const mv = G.lastCastMv;
        if (mv === undefined) return;
        foes(P).forEach(F => { (F.noCastMV = (F.noCastMV || []).filter(x => G.turn < x.until)).push({ mv, until: G.turn + Math.max(2, G.players.filter(X => !X.out).length) }); });
        log(`${src.card.name}: opponents can't cast spells with mana value ${mv} until ${you(P) ? 'your' : `${P.name}'s`} next turn.`);
    }
});
(function () {
    const c = canCastNow;
    canCastNow = function (P, o) { if (P && o && P.noCastMV && P.noCastMV.some(x => G.turn < x.until && x.mv === (o.card.cmc || 0)) && Rx(o).kind !== 'land') return false; return c.apply(this, arguments); };
})();
