// =====================================================================
// Commander precons round (2026-10-15, owner's request: "fix up the last 4 sets worth of commander decks": Foundations-era FDC, FRC, SOC, MSC).
// Shared pieces: a generic trigger filter (`fn: 'spec'`), the `cmd` effect (one JS function per odd card, in CMD), and small helpers.
// Wordings are in rules/cmdr-*.js; the per-card engine code is in 15d-cmdr-*.js. preconEffect -> uldEffect -> cmdEffect.
// =====================================================================
const CMD = {};
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
    if (spec.color && !(x.card.colors || []).includes(spec.color)) return false;
    if (spec.minPow !== undefined && !(pow(x) >= spec.minPow)) return false;
    if (spec.mvMin !== undefined && !((x.card.cmc || 0) >= spec.mvMin)) return false;
    if (spec.hadCounters && !((x.lastCounters || 0) > 0 || Object.values(x.ctr || {}).some(v => v > 0) || (x.counters || 0) > 0)) return false;
    if (spec.commander && !x.isCommander) return false;
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
    return P.bf.some(x => { const c = Rx(x).castTopCreatures; return c && !lostAbilities(x) && (c === true || !c.minPow || Number(o.card.power) >= c.minPow); });
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
