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
Object.assign(CMD_SCORE, { fr_blinkEnd: () => 1, fr_blinkNow: P => (P.bf.some(x => frEtbValue(x) >= 3) ? 6 : 0), fr_endTurn: P => (foes(P).reduce((a, F) => a + F.bf.filter(isCreature).length, 0) > P.bf.filter(isCreature).length + 2 ? 6 : 0), fr_commit: () => 4, fr_phaseOutX: () => 3, fr_pileup: P => { const d = foes(P).reduce((a, F) => a + F.bf.filter(isCreature).reduce((s, x) => s + permValue(x), 0), 0) - P.bf.filter(isCreature).reduce((s, x) => s + permValue(x), 0); return d > 6 ? d : 0; } });
// AI: blink the creature or artifact whose enter-the-battlefield ability is worth the most; never one of the other side's
Object.assign(CMD_AITARGET, {
    fr_blinkEnd: (P, e, src, valid) => { const mine = valid.filter(v => v.o && v.o.owner === P.i).sort((a, b) => frEtbValue(b.o) - frEtbValue(a.o))[0]; return mine && frEtbValue(mine.o) >= 3 ? mine : null; },
    fr_blinkNow: (P, e, src, valid) => { const mine = valid.filter(v => v.o && v.o.owner === P.i).sort((a, b) => frEtbValue(b.o) - frEtbValue(a.o))[0]; return mine && (frEtbValue(mine.o) >= 3 || e.counter) ? mine : null; }
});
