// =====================================================================
// Commander precons round (2026-10-15, owner's request: "fix up the last 4 sets worth of commander decks": Foundations-era FDC, FRC, SOC, MSC).
// Shared pieces: a generic trigger filter (`fn: 'spec'`), the `cmd` effect (one JS function per odd card, in CMD), and small helpers.
// Wordings are in rules/cmdr-*.js; the per-card engine code is in 15d-cmdr-*.js. preconEffect -> uldEffect -> cmdEffect.
// =====================================================================
const CMD = {};
const CMD_AITARGET = {}; // id -> (P, e, source, valid, { theirs, mine, O, byValue }) => the target the computer picks for a targeted cmd effect
const CMD_SCORE = {}; // id -> (P, e, target, src) => AI score of a cmd effect (0 when missing)
async function cmdEffect(P, e, t, src, O, name) {
    if (e.t !== 'cmd') return;
    const f = CMD[e.id];
    if (f) await f(P, e, t, src, O, name);
}
// ---- A trigger filter written as data: { ctl: 'you'|'opp'|'any', type: 'Creature', sub: ['Angel'], another, token, nontoken, legendary, color, nonland, minPow, hadCounters, mv } ----
function specMatch(spec, o, x, ctx) {
    if (!x || !x.card) return false;
    if (spec.another && x === o) return false;
    const who = ctx && ctx.P && ctx.P.i !== undefined && (ctx.cast || spec.byPlayer) ? ctx.P.i : x.owner;
    if (spec.ctl !== 'any') { const mine = who === o.owner; if (spec.ctl === 'opp' ? mine : !mine) return false; }
    const ty = x.card.type || '';
    if (spec.type) {
        const types = Array.isArray(spec.type) ? spec.type : [spec.type];
        if (!types.some(w => (w === 'Creature' ? (/\bCreature\b/.test(ty) || isCreature(x)) : new RegExp(`\\b${w}\\b`).test(ty)))) return false;
    }
    if (spec.sub && !(Array.isArray(spec.sub) ? spec.sub : [spec.sub]).some(w => hasType(x, w))) return false;
    if (spec.token && !x.token) return false;
    if (spec.nontoken && x.token) return false;
    if (spec.legendary && !/\bLegendary\b/.test(ty)) return false;
    if (spec.nonland && /\bLand\b/.test(ty)) return false;
    if (spec.noncreature && /\bCreature\b/.test(ty)) return false;
    if (spec.mvMax !== undefined && !((x.card.cmc || 0) <= spec.mvMax)) return false;
    if (spec.color && !(x.card.colors || []).includes(spec.color)) return false;
    if (spec.minPow !== undefined && !(pow(x) >= spec.minPow)) return false;
    if (spec.mvMin !== undefined && !((x.card.cmc || 0) >= spec.mvMin)) return false;
    if (spec.hadCounters && !((x.lastCounters || 0) > 0 || Object.values(x.ctr || {}).some(v => v > 0) || (x.counters || 0) > 0)) return false;
    if (spec.commander && !x.isCommander) return false;
    if (spec.attacking && !(G.attackers || []).includes(x.uid)) return false;
    if (spec.byOpp && !(ctx && ctx.by !== undefined && ctx.by !== o.owner)) return false;
    return true;
}
TRIG_FN.spec = (o, ctx, tr) => specMatch(tr.spec, o, ctx.o, ctx);
// Helpers
const ownerOf = o => G.players[o.owner];
const oppsOf = P => G.players.filter(X => X !== P && !X.out);
function cmdLog(P, verb1, verb3, rest) { log(`${P.name} ${you(P) ? verb1 : verb3} ${rest}`); }
// Times a player has cast their commander from the command zone (commander tax is 2 per cast, P.tax counts up from 1)
function commanderCasts(P) { return P.tax || 0; }
// ---- Conditions ----
COND_EXTRA.push(
    [/^an opponent has more life than you$/, () => P => foes(P).some(F => F.life > P.life)],
    [/^an opponent controls more creatures than you$/, () => P => foes(P).some(F => F.bf.filter(isCreature).length > P.bf.filter(isCreature).length)],
    [/^an opponent controls more lands than you$/, () => P => foes(P).some(F => F.bf.filter(x => /\bLand\b/.test(x.card.type)).length > P.bf.filter(x => /\bLand\b/.test(x.card.type)).length)],
    [/^you have at least (\d+) life more than your starting life total$/, m => P => P.life >= (P.startLife || 20) + Number(m[1])],
    [/^you control three or more lands with the same name$/, () => P => { const n = {}; P.bf.filter(x => /\bLand\b/.test(x.card.type)).forEach(x => { n[x.card.name] = (n[x.card.name] || 0) + 1; }); return Object.values(n).some(k => k >= 3); }],
    [/^you have taken more than three turns$/, () => P => (P.turnsTaken || 0) > 3],
    [/^you are the monarch$/, () => P => G.monarch === P.i],
    [/^you're the monarch$/, () => P => G.monarch === P.i]
);
// A choice among labelled options: resolves to the index picked (the first when the computer or an autoplay test decides)
function askMode(P, title, labels, opts = {}) {
    if (P.isAI || AUTOPLAY) return Promise.resolve(0);
    if (G && G.hotseat && G.view !== P.i) return handTo(P).then(() => askMode(P, title, labels, opts));
    return new Promise(resolve => {
        window.__askMode = i => { closeModal(); resolve(i); };
        showModal(`<h2>${esc(title)}</h2><div class="row" style="flex-direction:column; align-items:stretch; gap:8px;">${labels.map((l, i) => `<button class="btn" onclick="__askMode(${i})">${esc(l)}</button>`).join('')}</div>${opts.cancel ? '<div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="__askMode(-1)">None</button></div>' : ''}`);
    });
}
TRIG_FN.dragonAttacks = (o, ctx) => (ctx.list || []).some(x => specMatch({ sub: 'Dragon', type: 'Creature' }, o, x));
// ---- Casting creature spells from the top of the library (Thundermane Dragon: power 4 or greater; older cards: any creature) ----
function topCastOk(P, o) {
    if (!o || Rx(o).kind !== 'creature' || P.library[P.library.length - 1] !== o) return false;
    return P.bf.some(x => { const c = Rx(x).castTopCreatures; return c && !lostAbilities(x) && (c === true || (c.when ? c.when(o) : (!c.minPow || Number(o.card.power) >= c.minPow))); });
}
// ---- Read ahead (Sagas): choose a chapter to start on; only that chapter triggers ----
async function readAheadPick(P, o) {
    const last = Math.max(...Object.keys(Rx(o).saga).map(Number));
    let n = last;
    if (!(P.isAI || AUTOPLAY)) { const labels = Array.from({ length: last }, (_, i) => `Chapter ${['I', 'II', 'III', 'IV', 'V'][i]}`); n = 1 + (await askMode(P, `${o.card.name}: read ahead - choose a chapter to start on`, labels)); }
    else if (o.card.name === 'The Elder Dragon War') n = G.players.filter(X => X !== P).some(F => F.bf.filter(isCreature).length >= 2) && P.bf.filter(isCreature).length <= 1 ? 1 : 3;
    o.ctr.lore = n;
    log(`${P.name} ${you(P) ? 'read' : 'reads'} ahead: ${o.card.name} starts on chapter ${['I', 'II', 'III', 'IV', 'V'][n - 1]}.`);
}
// ---- Gift (Consumed by Greed, Scrapshooter): promise a card to an opponent for the bonus ----
function giftWanted(P, o) {
    const n = o.card.name;
    if (n === 'Consumed by Greed') return P.gy.some(x => /\bCreature\b/.test(x.card.type));
    if (n === 'Scrapshooter') return oppsOf(P).some(F => F.bf.some(x => /Artifact|Enchantment/.test(x.card.type)));
    return false;
}
async function giftDraw(P, o) {
    if (!o.giftPromised) return false;
    const F = oppsOf(P)[0]; if (!F) return false;
    drawCards(F, 1); log(`${F.name} ${you(F) ? 'draw' : 'draws'} a card (gift).`);
    return true;
}
// ---- More conditions and counts ----
COND_EXTRA.push(
    [/^you control another creature with power (\d+) or greater$/, m => (P, o) => P.bf.some(x => x !== o && isCreature(x) && pow(x) >= Number(m[1]))],
    [/^you have four or more creature cards in your graveyard$/, () => P => P.gy.filter(x => /\bCreature\b/.test(x.card.type)).length >= 4],
    [/^an opponent controls four or more nonbasic lands$/, () => P => foes(P).some(F => F.bf.filter(x => /\bLand\b/.test(x.card.type) && !/\bBasic\b/.test(x.card.type)).length >= 4)],
    [/^an opponent was dealt (\d+) or more damage this turn$/, m => P => foes(P).some(F => F.dmgTakenTurn === G.turn && (F.dmgTakenN || 0) >= Number(m[1]))],
    [/^creatures you control have total power (\d+) or greater$/, m => P => P.bf.filter(isCreature).reduce((a, x) => a + Math.max(0, pow(x)), 0) >= Number(m[1])],
    [/^you control (three|four|five|two|\d+) or more ([A-Z][a-z]+)s$/, m => P => P.bf.filter(x => hasType(x, m[2])).length >= (nw0(m[1]))],
    [/^you control the artifact with the greatest mana value or tied for the greatest mana value$/, () => P => { const arts = allPerms().filter(x => /\bArtifact\b/.test(x.card.type)); if (!arts.length) return false; const best = Math.max(...arts.map(x => x.card.cmc || 0)); return P.bf.some(x => /\bArtifact\b/.test(x.card.type) && (x.card.cmc || 0) === best); }]
);
function nw0(w) { return /^\d+$/.test(w) ? Number(w) : ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 })[w]; }
COUNT_EXTRA.push(
    [/^(?:the number of )?([A-Z][a-z]+) cards? in all graveyards$/, m => () => G.players.reduce((a, X) => a + X.gy.filter(x => hasType(x, m[1])).length, 0)],
    [/^(?:the number of )?creature cards? in your opponents' graveyards$/, () => o => foes(G.players[o.owner]).reduce((a, F) => a + F.gy.filter(x => /\bCreature\b/.test(x.card.type)).length, 0)]
);
// ---- Phasing (702.26): a permanent that phases out is treated as though it doesn't exist; it phases in before its controller untaps ----
function phaseOut(o) {
    if (!o || !onBf(o.uid)) return;
    const group = [o, ...allPerms().filter(a => a.attachedTo === o.uid)]; // Auras and Equipment phase out with it
    group.forEach(x => { const Y = G.players[x.owner]; pull(Y.bf, x); (Y.phased = Y.phased || []).push(x); x.phasedOut = true; });
    log(`${o.card.name} phases out.`);
}
function phaseInAll(P) {
    if (G.players.some(X => X.bf.some(a => a.noPhaseIn))) return; // The City on the Edge of Forever: permanents can't phase in
    const back = (P.phased || []).splice(0);
    back.forEach(x => { delete x.phasedOut; P.bf.push(x); });
    if (back.length) log(`${back.map(x => x.card.name).join(', ')} phase${back.length === 1 ? 's' : ''} in.`);
}
// ---- Goad (701.38): attacks each combat if able, and attacks a player other than the goader if able ----
function goad(o, by, until) { o.goaded = { by, until: until === undefined ? Infinity : until }; log(`${o.card.name} is goaded.`); }
const isGoaded = o => !!(G && o && ((o.goaded && G.turn < o.goaded.until && G.players[o.goaded.by] && !G.players[o.goaded.by].out) || (hasType(o, 'Tribble') && allPerms().some(a => Rx(a).tribbleGoad && !lostAbilities(a))) || allPerms().some(a => a.attachedTo === o.uid && Rx(a).goadsHost && !lostAbilities(a))));
const cmdNoMinus = o => !!G && isCreature(o) && G.players[o.owner].bf.some(a => Rx(a).noMinusCounters && !lostAbilities(a));
// Jace, Multiverse Architect: creatures that didn't pay can't attack his controller's Jaces this turn
const jaceNoAttack = (w, A) => !!G && !!G.jaceNoAttack && G.jaceNoAttack.turn === G.turn && G.jaceNoAttack.player === A.i && hasType(w, 'Jace') && w.owner === G.jaceNoAttack.by;
// Serra's Emissary: protection from a card type
const cardTypeOf = (card, ty) => new RegExp(`\\b${ty}\\b`).test(card.type || '');
function emissaryProtects(i, src) { return !!G && allPerms().some(a => a.owner === i && Rx(a).emissary && a.chosenCardType && cardTypeOf(src.card, a.chosenCardType) && !lostAbilities(a)); }
// Extra copies of a trigger (Windcrag Siege's Mardu mode, Annie Joins Up)
function cmdExtraTriggers(ev, o, tr, ctx) {
    let k = 0;
    allPerms().forEach(a => {
        if (a.owner !== o.owner || lostAbilities(a)) return;
        if (Rx(a).doubleAttackTrig && a.word === 'Mardu' && ev === 'attacks' && (ctx.list || []).length) k++; // a creature attacking causes the trigger
        if (Rx(a).doubleLegendTrig && /\bLegendary\b/.test(o.card.type) && isCreature(o)) k++;
        if (Rx(a).harmonic && (hasType(o, 'Shaman') || (hasType(o, 'Wizard') && o !== a))) k++; // Harmonic Prodigy
        if (Rx(a).veyran && ev === 'cast' && ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind)) k++; // Veyran: casting an instant or sorcery
    });
    allPerms().forEach(a => { // trigger doublers (2026-10-26): Teysa Karlov, Drivnod, Isshin, Wulfgar, Felix Five-Boots, Katara
        if (a.owner !== o.owner || lostAbilities(a)) return;
        const R = Rx(a);
        if (R.doubleDeath && (ev === 'dies' || ev === 'creatureDies') && ctx.o && isCreature(ctx.o)) k++;
        if (R.doubleAttackAny && ev === 'attacks' && (ctx.list || []).length) k++;
        if (R.doubleHit && (ev === 'hitPlayer' || ev === 'combatHitAny')) k++;
        if (R.doubleAlly && hasType(o, 'Ally')) k++;
        if (R.doubleEnter && (ev === 'enters' || ev === 'landfall')) k++;
    });
    k += throneBoost(o, true); // Roaming Throne
    if (typeof tkCrusherExtra === 'function') k += tkCrusherExtra(ev, o); // Dr. Crusher
    return k;
}
// Cast a card from a zone without paying its mana cost; returns true when it was cast
async function castFreeFrom(P, c, target) {
    const from = G.players.find(X => ['gy', 'exile', 'library', 'hand'].some(z => X[z].includes(c)));
    const zone = from ? ['gy', 'exile', 'library', 'hand'].find(z => from[z].includes(c)) : null;
    if (!from || Rx(c).kind === 'land' || Rx(c).support === 'none') return false;
    pull(from[zone], c); c.freeCast = true; c.playUntil = G.turn; P.exile.push(c);
    let cast = true;
    try { cast = await castSpell(P, c, target); } catch (er) { cast = false; }
    if (P.exile.includes(c)) { pull(P.exile, c); from[zone].push(c); c.freeCast = false; return false; }
    return true;
}
// Jace token (Plan for All Outcomes, Fatehold Charm): "empower Jace N" puts loyalty counters on your Jace token, making one first
function jaceToken(P) {
    let j = P.bf.find(x => x.token && hasType(x, 'Jace'));
    if (!j) {
        const card = { id: `token-jace-${uidSeq}`, name: 'Jace', fullName: 'Jace token', cost: '', cmc: 0, type: 'Token Legendary Planeswalker — Jace', text: '−1: Surveil 1\n−3: Draw a card.', loyalty: '0', colors: ['U'], ci: ['U'], img: null, imgS: null, legal: {} };
        j = makeObj(card, P.i, { token: true, sick: false }); P.bf.push(j); j.ctr.loyalty = 0; j.pwReady = true; fire('enters', { o: j }); tokenMade(P);
        log(`${P.name} ${you(P) ? 'create' : 'creates'} a Jace planeswalker token.`);
    }
    return j;
}
function empowerJace(P, n) { const j = jaceToken(P); j.ctr.loyalty = (j.ctr.loyalty || 0) + n; log(`${j.card.name} gets ${n} loyalty counter${n === 1 ? '' : 's'} (empower).`); }
COND_EXTRA.push(
    [/^you gained life this turn$/, () => P => P.gainedTurn === G.turn],
    [/^an opponent has three or more poison counters$/, () => P => foes(P).some(F => (F.poison || 0) >= 3)],
    [/^it is your turn$/, () => P => G.active === P.i]
);
COUNT_EXTRA.push([/^(?:the number of )?unspent mana you have$/, () => o => (G.players[o.owner].pool || []).length]);
STATIC_FN.toxicCreature = o => Rx(o).toxic > 0;
