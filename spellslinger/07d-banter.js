// =====================================================================
// Table talk, salt and cool plays (2026-10-15, owner: "a salt reaction and a cool factor for unique decks ... more things the ai can say";
// plan in docs/spellslinger-table-talk-plan.md). The lines are in 07d-lines.js.
//  - Characters: every bot in a pod is one of nine named players (Greg, Marcus, ...) with a voice, a salt level and a habit of bluffing (`CHARACTERS`).
//  - Salt: nasty plays (land destruction, sweepers, counters, mill, theft, extra turns, a dead commander, a broken deal, being targeted again and again) add
//    salt to the player they hit (`saltAdd`). Salt makes a bot complain, then jab, then rage and refuse deals for a while; it fades a little each turn.
//  - Cool: unusual decks (`deckTags`), big plays, clones of another player's creature, reanimation, old cards and comebacks make the table impressed (`coolAdd`).
//    A person earns a few "style points" coins for it at the end of the game (`banterEnd`).
//  - Rivalries are remembered with the player's profile (`profile.rivals`), so a bot can say "last game you milled me out".
// Like the rest of the politics, nothing here uses random numbers and talk is off in the lab and autoplay games, so seeded games replay exactly.
// =====================================================================
const who = P => (P && P.char ? P.char.name : P ? P.name.split(',')[0] : '');
const SALT_TIERS = [0, 2, 5, 9];
const COOL_COINS = 10, COOL_COINS_MAX = 50;

function fillLine(t, ctx) { return String(t).replace(/\{(\w+)\}/g, (m, k) => (ctx && ctx[k] !== undefined ? ctx[k] : m)); }
// One line for an event, picked without random numbers: the character's own lines most of the time, then the shared ones
function pickLine(P, event, ctx = {}) {
    const t = TALK[event];
    if (!t) return null;
    const own = (P.char && t[P.char.key]) || [], gen = t._ || [];
    P.said = (P.said || 0) + 1;
    const h = ((G.turn * 31 + P.i * 17 + P.said * 7 + event.length * 13) >>> 0);
    const pool = [...gen, ...own, ...own]; // the character's own lines count double
    if (!pool.length) return null;
    return fillLine(pool[h % pool.length], { me: (P.name || '').split(',')[0], ...ctx });
}
// A bot says a line for an event (it also goes in the log; the bubble shows only in a real game)
function say(P, event, mood, ctx, key) {
    if (!P || !P.isAI || P.out || !G) return false;
    const text = pickLine(P, event, ctx);
    if (!text) return false;
    botSay(P, mood || 'calm', text, key === undefined ? event : key);
    return true;
}

// ---- Characters ----
// Each bot gets a character that suits its playstyle (the first unused one from the style's list), the same way every game
function assignCharacters() {
    const taken = new Set();
    G.players.filter(P => P.isAI && !P.char).forEach(P => {
        const style = P.aiStyle || 'midrange';
        let key = Object.keys(CHARACTERS).find(k => !taken.has(k) && CHARACTERS[k].prefer.includes(style));
        if (!key) key = Object.keys(CHARACTERS).find(k => !taken.has(k));
        taken.add(key);
        P.char = { key, ...CHARACTERS[key] };
    });
}

// ---- What a deck is about ----
function deckTags(P) {
    const cards = [...P.library, ...P.hand, ...P.bf, ...P.gy, ...P.exile, ...P.command].filter(o => !/\bLand\b/.test(o.card.type));
    const counts = DECK_TAGS.map(([tag, re, need]) => [tag, cards.filter(o => re.test(String((o.card && o.card.text) || ''))).length, need]);
    const tags = counts.filter(([, n, need]) => n >= need).sort((a, b) => b[1] / b[2] - a[1] / a[2]).map(x => x[0]);
    if (cards.filter(o => (o.card.cmc || 0) >= 6).length >= 6) tags.push('big');
    return tags;
}
const UNUSUAL_TAGS = ['mill', 'clones', 'reanimator'];

// ---- Start of the game ----
async function banterStart() {
    if (!G || G.players.length < 3 || G.hotseat) return;
    assignCharacters();
    G.tags = G.players.map(P => deckTags(P));
    G.cool = G.players.map(() => 0);
    G.saltSeen = {};
    const human = G.players.find(P => !P.isAI);
    const bots = G.players.filter(P => P.isAI);
    bots.forEach((P, k) => { if (k < 2) say(P, 'intro', 'cheerful', {}, null); });
    if (!human) return;
    const tag = (G.tags[human.i] || [])[0];
    const first = bots[0];
    const cmdName = (([...human.command, ...human.bf, ...human.hand, ...human.library].find(o => o.isCommander) || {}).card || {}).name || human.deckName || 'that deck';
    if (tag && first) say(first, `meet:${tag}`, 'scheming', { foe: 'You', cmd: cmdName.split(',')[0] }, null);
    if (tag && UNUSUAL_TAGS.includes(tag) && bots[1]) { coolBump(human, 'deck'); say(bots[1], 'cool:deck', 'impressed', { foe: 'you' }, null); }
    // rivalries from earlier games
    const rivals = (typeof profile === 'object' && profile && profile.rivals) || {};
    bots.forEach(P => {
        const r = rivals[P.char && P.char.key];
        if (!r) return;
        if (r.grudge >= 1) say(P, 'rival', 'angry', { foe: 'you' }, null);
        else if (r.respect >= 1) say(P, 'friendlyRival', 'cheerful', { foe: 'you' }, null);
        if (r.grudge >= 1) { P.salt = Math.min(3, r.grudge); P.grudge = P.grudge || {}; P.grudge[human.i] = (P.grudge[human.i] || 0) + Math.min(4, r.grudge * 2); }
    });
}

// ---- Salt ----
const saltTier = n => SALT_TIERS.filter(t => n >= t).length - 1;
function saltAdd(V, culprit, kind, amount, ctx = {}) {
    if (!V || !culprit || V === culprit || V.out || !G) return;
    const before = V.salt || 0, quiet = ctx.quiet;
    V.salt = before + amount * (V.char ? V.char.salt : 1);
    pol().salt = (pol().salt || 0) + 1;
    (G.saltLog = G.saltLog || []).push({ turn: G.turn, victim: V.i, culprit: culprit.i, kind });
    V.grudge = V.grudge || {}; V.grudge[culprit.i] = (V.grudge[culprit.i] || 0) + Math.ceil(amount);
    if (!V.isAI || quiet) return;
    const foe = you(culprit) ? 'you' : who(culprit);
    const tier = saltTier(V.salt), was = saltTier(before);
    say(V, `salt:${kind}`, tier >= 2 ? 'salty' : 'annoyed', { foe, n: ctx.n }, `salt-${kind}`);
    if (tier >= 2 && was < 2) say(V, 'salt:jab', 'salty', { foe }, 'jab');
    if (tier >= 3 && was < 3) { V.noDealsUntil = G.turn + 8; say(V, 'salt:rage', 'salty', { foe }, 'rage'); }
}
function saltDecay(P) { if (P.salt > 0) P.salt = Math.max(0, P.salt - 0.75); }
const tableSalt = () => Math.round(G.players.filter(P => P.isAI && !P.out).reduce((a, P) => a + (P.salt || 0), 0));
const saltyMood = P => (P.salt || 0) >= SALT_TIERS[2];

// ---- Cool ----
function coolBump(actor, kind) {
    if (!G || !actor) return;
    G.cool = G.cool || G.players.map(() => 0);
    G.cool[actor.i]++;
    pol().cool = (pol().cool || 0) + 1;
    (G.coolLog = G.coolLog || []).push({ turn: G.turn, actor: actor.i, kind });
}
// The table reacts to a cool play: one other bot (the next seat that can talk) is impressed
function coolAdd(actor, kind, ctx = {}) {
    if (!G || !actor || actor.out) return;
    coolBump(actor, kind);
    const bot = G.players.filter(P => P.isAI && !P.out && P !== actor).sort((a, b) => ((a.i - actor.i + 8) % 8) - ((b.i - actor.i + 8) % 8))[0];
    if (bot) say(bot, `cool:${kind}`, 'impressed', { foe: you(actor) ? 'you' : who(actor), n: ctx.n, card: ctx.card }, `cool-${kind}`);
}

// ---- Hooks into the game ----
// Effects: salt from what a spell or ability did, read before and after it ran
const SALT_STEAL = new Set(['steal', 'stealWhile', 'stealPerm', 'nabArtifact', 'stealArtifacts']);
const creatureCounts = () => G.players.map(X => X.bf.filter(isCreature).length);
const landCounts = () => G.players.map(X => X.bf.filter(o => /\bLand\b/.test(o.card.type)).length);
{
    const origApply = applyEffect;
    applyEffect = async function (P, e, t, src) {
        if (!G || G.over || G.players.length < 3) return origApply.apply(this, arguments);
        const before = ['wipe', 'massBounce'].includes(e.t) || (e.t === 'dmg' && /Creatures$/.test(e.target || '')) ? creatureCounts() : null;
        const lands = e.t === 'wipe' && /\bland/.test(e.what || '') ? landCounts() : null;
        const counteredBefore = G.lastCountered;
        const tgtOwner = t && t.o ? t.o.owner : undefined;
        const tgtLand = t && t.o && /\bLand\b/.test(t.o.card.type) && e.t === 'destroy';
        const mills = e.t === 'mill' || e.t === 'millFoes';
        const r = await origApply.apply(this, arguments);
        if (before) G.players.forEach(X => { const lost = before[X.i] - X.bf.filter(isCreature).length; if (X !== P && lost >= 3) saltAdd(X, P, 'wrath', 3, { n: lost }); });
        if (lands) G.players.forEach(X => { const lost = lands[X.i] - X.bf.filter(o => /\bLand\b/.test(o.card.type)).length; if (X !== P && lost >= 2) saltAdd(X, P, 'land', 3, { n: lost }); });
        if (e.t === 'counter' && G.lastCountered && G.lastCountered !== counteredBefore && G.lastCountered.P !== P) saltAdd(G.lastCountered.P, P, 'counter', 2 + Math.min(3, (G.lastCountered.o && G.lastCountered.o.card.cmc || 0) / 3));
        if (tgtLand && tgtOwner !== undefined && tgtOwner !== P.i) saltAdd(G.players[tgtOwner], P, 'land', 3);
        if (SALT_STEAL.has(e.t) && tgtOwner !== undefined && tgtOwner !== P.i) { saltAdd(G.players[tgtOwner], P, 'steal', 3); if (!P.isAI) coolAdd(P, 'steal'); }
        if (e.t === 'extraTurn') G.players.filter(X => X !== P).forEach(X => saltAdd(X, P, 'turn', 1.5));
        return r;
    };
    const origFire = fire;
    fire = function (ev, ctx) {
        if (G && !G.over && G.players.length > 2) {
            if (ev === 'dies' && ctx && ctx.o && ctx.o.isCommander) {
                const V = G.players[ctx.o.owner], culprit = G.players.find(X => X !== V && !X.out && X.i === G.active) || G.players.find(X => X !== V && !X.out);
                V.cmdDeaths = (V.cmdDeaths || 0) + 1;
                saltAdd(V, culprit, 'cmd', V.cmdDeaths >= 2 ? 3 : 2);
            }
            if (ev === 'cast' && ctx && ctx.o && ctx.P) { banterCast(ctx.P, ctx.o); if (typeof noteSeen === 'function') noteSeen(ctx.P, ctx.o); }
        }
        return origFire.apply(this, arguments);
    };
}
// Big plays and old cards
function banterCast(P, o) {
    const c = o.card, big = (c.cmc || 0) >= 7 || (o.xVal || 0) >= 6 || (!P.isAI && (c.cmc || 0) >= 6);
    G.coolSeen = G.coolSeen || {};
    const k = `${P.i}:${c.name}`;
    if (G.coolSeen[k]) return;
    if (c.released && c.released < '2003-01-01' && (!P.isAI || (c.cmc || 0) >= 3)) { G.coolSeen[k] = true; coolAdd(P, 'old', { card: c.name }); return; }
    if (big && !P.isAI) { G.coolSeen[k] = true; coolAdd(P, 'big', { n: c.cmc || 0, card: c.name }); }
}
// Politics hooks (07c-politics.js calls these)
function banterTargeted(P, victim) {
    victim.targetedTurn = victim.targetedTurn && victim.targetedTurn.turn === G.turn ? victim.targetedTurn : { turn: G.turn, n: 0 };
    victim.targetedTurn.n++;
    if (victim.targetedTurn.n === 3) saltAdd(victim, P, 'target', 2);
}
function banterTurnStart(P) { if (G && G.players.length > 2) { saltDecay(P); G.low = G.low || {}; G.low[P.i] = Math.min(G.low[P.i] ?? 99, P.life); } }
function banterReanimate(P, from, o) { if (G && G.players.length > 2 && (!P.isAI || (o.card.cmc || 0) >= 5)) coolAdd(P, 'reanimate', { card: o.card.name }); }
function banterCopy(P, picked) { if (G && G.players.length > 2 && picked && picked.owner !== P.i && creatureValue(picked) >= 4) coolAdd(P, 'copy', { card: picked.card.name }); }
function banterMill(X, n, culprit) {
    if (!G || G.players.length < 3 || n < 8 || !X.isAI) return;
    const by = culprit || G.players.find(Y => Y !== X && !Y.out && Y.i === G.active) || G.players.find(Y => Y !== X && !Y.out);
    saltAdd(X, by, 'mill', 1.5 + Math.min(2, n / 10), { n });
}
// A bot that is too angry refuses deals for a while (read by dealScore)
const dealsRefused = P => !!P.noDealsUntil && G.turn < P.noDealsUntil;

// ---- Out of the game ----
function banterOut(P, reason) {
    if (!P.isAI || !G) return;
    const culprit = G.players.filter(X => !X.out && X !== P).sort((a, b) => ((P.grudge && P.grudge[b.i]) || 0) - ((P.grudge && P.grudge[a.i]) || 0))[0];
    const foe = culprit ? (you(culprit) ? 'you' : who(culprit)) : 'everyone';
    say(P, (P.salt || 0) >= SALT_TIERS[2] ? 'outSalty' : 'outGracious', (P.salt || 0) >= SALT_TIERS[2] ? 'salty' : 'cheerful', { foe }, null);
    // A bot that likes someone more than the person who knocked it out hands over what it can (kingmaking): the best creature it owns goes to its favorite
    const fav = G.players.filter(X => !X.out && X !== P).sort((a, b) => ((P.trust && P.trust[b.i]) || 0) - ((P.trust && P.trust[a.i]) || 0))[0];
    if (fav && ((P.trust && P.trust[fav.i]) || 0) >= 2) {
        say(P, 'kingmake', 'calm', { foe: you(fav) ? 'you' : who(fav) }, null);
        const gift = P.hand.splice(0, 3);
        if (gift.length) { fav.hand.push(...gift); log(`🎁 ${who(P)} slides ${gift.length} card${gift.length === 1 ? '' : 's'} from ${P.name.split(',')[0] === who(P) ? 'their' : 'their'} hand to ${you(fav) ? 'you' : who(fav)} on the way out.`); }
    }
}

// ---- End of the game ----
// Returns { bonus, html }: style points for a person, the saltiest bot, the coolest play, and what the bots say. Also updates rivalries.
function banterEnd(winner) {
    if (!G || G.players.length < 3 || G.hotseat) return null;
    const human = G.players.find(P => !P.isAI);
    if (!human) return null;
    const bots = G.players.filter(P => P.isAI);
    const salty = bots.slice().sort((a, b) => (b.salt || 0) - (a.salt || 0))[0];
    const cool = (G.cool || [])[human.i] || 0;
    // A comeback counts as cool
    if (winner === human.i && (G.low || {})[human.i] <= 6) { coolBump(human, 'comeback'); }
    const coolN = (G.cool || [])[human.i] || 0;
    const bonus = Math.min(COOL_COINS_MAX, coolN * COOL_COINS);
    const lines = [];
    const win = winner !== null ? G.players[winner] : null;
    bots.filter(P => P.char).slice(0, 2).forEach(P => {
        const ev = win && P === win ? 'win' : 'lose';
        const text = pickLine(P, ev, { foe: win ? (you(win) ? 'you' : who(win)) : 'everyone' });
        if (text) lines.push(`${who(P)}: "${text}"`);
    });
    // Rivalries
    if (typeof profile === 'object' && profile && !AUTOPLAY) {
        profile.rivals = profile.rivals || {};
        bots.forEach(P => {
            if (!P.char) return;
            const r = profile.rivals[P.char.key] = profile.rivals[P.char.key] || { grudge: 0, respect: 0, games: 0 };
            r.games++;
            const hurt = (P.salt || 0) >= SALT_TIERS[2] || ((P.grudge && P.grudge[human.i]) || 0) >= 8;
            if (hurt) r.grudge = Math.min(5, r.grudge + 1); else r.grudge = Math.max(0, r.grudge - 1);
            if (coolN >= 2 && !hurt) r.respect = Math.min(5, r.respect + 1);
            else if (hurt) r.respect = Math.max(0, r.respect - 1);
        });
    }
    const coolWhat = (G.coolLog || []).filter(c => c.actor === human.i).map(c => ({ old: 'an old card', big: 'a big play', copy: 'a clever copy', steal: 'a theft', reanimate: 'a reanimation', comeback: 'a comeback', deck: 'a deck with a theme' }[c.kind])).filter(Boolean);
    const html = `<div class="talk-report">
        ${lines.length ? `<p class="note">${lines.map(esc).join('<br>')}</p>` : ''}
        <p class="note">🧂 Saltiest: <b>${esc(salty ? who(salty) : 'nobody')}</b>${salty && (salty.salt || 0) >= 1 ? ` (${Math.round(salty.salt)})` : ''} · ✨ Cool plays: <b>${coolN}</b>${coolWhat.length ? ` (${esc([...new Set(coolWhat)].join(', '))})` : ''}${bonus ? ` · 🪙 +${bonus} style points` : ''}</p>
    </div>`;
    return { bonus, html, cool: coolN };
}
