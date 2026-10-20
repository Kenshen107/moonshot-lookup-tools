// =====================================================================
// Characters that play differently, taunts and compliments, a draw offer and revenge pacts between bots
// (2026-10-20, owner's go-ahead on the personality audit: "1, 3, 4, 5, 6, 7"; the vote cards are in rules/votes.js and 15g-votes.js).
//  - Habits (`CHARACTER_HABITS`): each named bot has its own taste in deals and its own loyalty. They change how a bot scores a deal (`dealScore`,
//    `dealScore2` are wrapped, so every deal path sees them), whether it keeps a peace when it could finish someone (`charBreaksPeace`, read by
//    `podPickDefender`), and how hard a broken deal lands (Leo takes it personally).
//  - Taunts and compliments (`emote`): buttons in the 🤝 Deals dialog. A taunt adds to a bot's grudge (and salt), a compliment adds a little trust.
//  - Draw offer (`offerDraw`): after the game has gone long enough every bot decides whether it would take a draw; all yes ends the game as a draw.
//  - Revenge pacts (`botPacts`): a bot with a big grudge asks a friendly bot to gang up on whoever hurt it, so the table has politics of its own.
// Nothing here uses random numbers, so seeded lab games replay exactly.
// =====================================================================
const CHARACTER_HABITS = {
    greg:   { peace: 1, spare: 1, forgive: 0.5, loyal: 1, flatter: 1 },                     // friendly, forgives fast, keeps his word
    marcus: { pact: 1, restraint: 1, loyal: 0.7, flatter: 0.5 },                           // cold: pacts against threats, breaks a peace only for lethal
    sarah:  { tipPeace: 1, alliance: 0.5, loyal: 0.9, flatter: 1.5 },                      // chatty, loves a deal with a story
    leo:    { grudgeMul: 1.5, loyal: 0.9, flatter: 1 },                                    // takes betrayal personally
    trevor: { peace: 0.5, restraint: 1, loyal: 1, flatter: 0 },                            // never breaks a deal, unmoved by flattery
    sam:    { peace: -1, pact: 1, alliance: 1, loyal: 0.3, flatter: 1 },                   // impatient: loves a gang-up, breaks a peace to hit big
    arthur: { alliance: 1, respect: true, loyal: 0.6, flatter: 2 },                        // won't deal with small fry, loves respect
    brenda: { spare: 1, restraint: 1, loyal: 0.8, flatter: 1 },                            // thrifty: no waste, no wasted removal
    luke:   { all: 1, loyal: 0.2, flatter: 0 }                                             // says yes to anything and breaks it when it pays
};
const habit = P => (P && P.char && CHARACTER_HABITS[P.char.key]) || null;

// ---- Deals: each character's own taste ----
function charAdjust(r, bot, from, type) {
    const h = habit(bot);
    if (!h || r.score <= -90) return r;
    const parts = { ...r.parts };
    let d = (h[type] || 0) + (h.all || 0);
    const grudge = (bot.grudge && bot.grudge[from.i]) || 0;
    if (h.forgive) d += grudge * 0.4 * h.forgive;                    // undo part of the grudge penalty
    if (h.grudgeMul) d -= grudge * 0.4 * (h.grudgeMul - 1);          // hold it longer
    if (h.respect && (type === 'peace' || type === 'spare')) {
        const live = G.players.filter(X => !X.out);
        const mean = live.reduce((a, X) => a + podThreat(X), 0) / live.length;
        if (podThreat(from) < mean * 0.5 && botMood(bot).mood !== 'worried') { parts.respect = -3; d -= 3; }
    }
    if (d) parts.character = d;
    const worst = Object.entries(parts).sort((a, b) => a[1] - b[1])[0];
    const reason = worst && worst[0] === 'respect' ? "I don't deal with small fry." : r.reason;
    return { ...r, score: r.score + d, parts, reason };
}
{
    const baseScore = dealScore;
    dealScore = function (bot, from, type, x) { return charAdjust(baseScore.apply(this, arguments), bot, from, type); };
    const baseScore2 = dealScore2;
    dealScore2 = function (bot, from, kind, x) {
        const r = baseScore2.apply(this, arguments), h = habit(bot);
        if (!h || r.score <= -90 || !['restraint', 'tipPeace', 'alliance'].includes(kind) || !h[kind]) return r;
        return { ...r, score: r.score + h[kind], parts: { ...r.parts, character: (r.parts.character || 0) + h[kind] } };
    };
}
// A bot that isn't loyal breaks a peace when the hit is lethal (or, for the least loyal, nearly lethal). Greg, Trevor and the careful ones keep their word.
function charBreaksPeace(P, F, power, open) {
    const h = habit(P);
    if (!h || h.loyal >= 0.8 || !open) return false;
    if (F.life <= power) return h.loyal <= 0.7;
    return h.loyal <= 0.3 && F.life <= power * 1.5;
}
// Leo remembers a betrayal for longer
{
    const baseBreak = breakDeal;
    breakDeal = function (d, by, why) {
        const was = d.over;
        baseBreak.apply(this, arguments);
        if (was) return;
        const other = G.players[d.a === by ? d.b : d.a], h = habit(other);
        if (h && h.grudgeMul && other.grudge) other.grudge[by] = (other.grudge[by] || 0) + 2;
    };
}

// ---- Taunts and compliments ----
const EMOTE_GAP = 4; // turns before the same bot will react again
function emoteReady(B) { return G.turn - (B.emoteAt ?? -99) >= EMOTE_GAP; }
function emote(i, kind) {
    const v = me(), B = G && G.players[i];
    if (!G || G.over || !B || B.out || !B.isAI || !v || v.out) return;
    if (!emoteReady(B)) { toast(`${nm(B)} is not in the mood to talk again yet.`); return; }
    B.emoteAt = G.turn;
    const h = habit(B), ch = B.char || { salt: 1 };
    closeModal();
    if (kind === 'taunt') {
        B.grudge = B.grudge || {};
        B.grudge[v.i] = (B.grudge[v.i] || 0) + 1.5 * ch.salt;
        saltAdd(B, v, 'taunt', 1, { quiet: true });
        log(`😏 You taunt ${who(B)}.`);
        say(B, 'tauntReply', ch.salt >= 1 ? 'angry' : 'smug', { foe: 'you' }, null);
    } else {
        const up = 0.5 * (h ? h.flatter : 1);
        B.trust = B.trust || {};
        B.trust[v.i] = Math.min(4, (B.trust[v.i] || 0) + up);
        B.salt = Math.max(0, (B.salt || 0) - 1);
        log(`👏 You compliment ${who(B)}.`);
        say(B, 'complimentReply', up > 0 ? 'cheerful' : 'scheming', { foe: 'you' }, null);
    }
    renderGame();
}
function emoteButtonsHTML(B) {
    const ready = emoteReady(B);
    return `<button class="btn small" ${ready ? '' : 'disabled'} title="Taunt ${esc(who(B))}: they will remember it, and may come after you." onclick="emote(${B.i}, 'taunt')">😏 Taunt</button><button class="btn small" ${ready ? '' : 'disabled'} title="Compliment ${esc(who(B))}: a little trust, a little less salt." onclick="emote(${B.i}, 'compliment')">👏 Compliment</button>`;
}

// ---- A draw offer ----
const drawAllowed = () => !!G && !G.over && G.players.length >= 3 && G.turn >= 6 * G.players.filter(P => !P.out).length;
function drawAnswer(P) {
    const live = G.players.filter(X => !X.out);
    const mean = live.reduce((a, X) => a + podThreat(X), 0) / live.length;
    const worried = botMood(P).mood === 'worried', weak = podThreat(P) < mean * 0.75 || P.life <= 10, stalled = G.turn >= 12 * live.length;
    const yes = worried || weak || stalled;
    const why = worried ? 'worried' : weak ? 'behind' : stalled ? 'long' : 'ahead';
    return { yes, why };
}
function offerDraw() {
    if (!G || G.over) return;
    closeModal();
    if (!drawAllowed()) { toast('Too early for a draw: every player needs about six turns first.'); return; }
    const v = me();
    log('🤝 You offer the table a draw.');
    const answers = G.players.filter(P => P !== v && !P.out).map(P => ({ P, ...drawAnswer(P) }));
    answers.forEach(a => say(a.P, a.yes ? 'drawYes' : 'drawNo', a.yes ? 'calm' : 'smug', { foe: 'you' }, null));
    const no = answers.filter(a => !a.yes);
    if (no.length) { log(`🤝 No draw: ${no.map(a => who(a.P)).join(', ')} want${no.length === 1 ? 's' : ''} to play on.`); toast(`No draw: ${no.map(a => who(a.P)).join(', ')} want${no.length === 1 ? 's' : ''} to play on.`); renderGame(); return; }
    log('🤝 Everyone agrees to a draw.');
    endGame(null, 'All players agreed to a draw.');
}
function drawButtonHTML() {
    const ok = drawAllowed();
    return `<button class="btn" ${ok ? '' : 'disabled'} title="${ok ? 'Ask every bot if they would end the game as a draw.' : 'Draws can be offered once every player has had about six turns.'}" onclick="offerDraw()">🏳️ Offer a draw</button>`;
}

// ---- Revenge pacts between bots ----
{
    const baseTick = dealsTick;
    dealsTick = async function (P) { await baseTick.apply(this, arguments); botPacts(P); };
}
function botPacts(P) {
    if (!G || G.players.length < 3 || !P.isAI || P.out || P.aiLevel === 'easy' || G.over || (typeof dealsRefused === 'function' && dealsRefused(P))) return;
    G.botPact = G.botPact || {};
    if (G.turn - (G.botPact[P.i] ?? -99) < 6 || pactTarget(P)) return;
    const grudge = P.grudge || {};
    const X = foes(P).filter(F => (grudge[F.i] || 0) >= 6).sort((a, b) => grudge[b.i] - grudge[a.i] || a.i - b.i)[0];
    if (!X) return;
    const ally = foes(P).filter(F => F !== X && F.isAI && !F.out && !pactTarget(F)).map(F => ({ F, r: dealScore(F, P, 'pact', X.i) })).filter(o => o.r.score >= 1).sort((a, b) => b.r.score - a.r.score || a.F.i - b.F.i)[0];
    if (!ally) return;
    G.botPact[P.i] = G.turn;
    makeDeal(P, ally.F, 'pact', X.i);
    say(P, 'pactRevenge', 'angry', { foe: who(ally.F), card: nm(X) }, null);
}
// What the other players have agreed between themselves (shown in the Deals dialog)
function tableDealsHTML() {
    const v = me();
    const rows = (G.deals || []).filter(d => !d.over && d.a !== v.i && d.b !== v.i).map(d => {
        const A = G.players[d.a], B = G.players[d.b], t = DEAL_TYPES[d.type];
        return `<li>${t.emoji} ${esc(who(A))} and ${esc(who(B))}: ${esc(t.name)}${d.type === 'pact' && G.players[d.x] ? ` against <b>${esc(nm(G.players[d.x]))}</b>` : ''}</li>`;
    });
    return rows.length ? `<p><b>📰 Elsewhere at the table</b></p><ul>${rows.join('')}</ul>` : '';
}

// ---- What they say ----
Object.assign(TALK, {
    tauntReply: {
        _: ["Careful, {foe}.", "Funny. Remember that.", "Oh, it's like that?"],
        greg: ["Hey, that's not nice, {foe}.", "Okay, {foe}. Okay."], marcus: ["Noted, {foe}."], sarah: ["Ooh, a challenge!"], leo: ["That was uncalled for, {foe}."],
        trevor: ["I'm counting those, {foe}."], sam: ["Say that again, {foe}! I dare you!"], arthur: ["You'll regret that tone, {foe}."], brenda: ["Cheap talk, {foe}."], luke: ["Ha! Keep going, {foe}."]
    },
    complimentReply: {
        _: ["Thanks, {foe}.", "That's kind of you to say.", "I'll take that."],
        greg: ["Aw, thanks {foe}!"], marcus: ["Flattery. Noted."], sarah: ["You're sweet! I like you."], leo: ["That means something, {foe}."],
        trevor: ["That doesn't change the numbers, {foe}."], sam: ["Yeah! I know, right?!"], arthur: ["Finally, someone with taste."], brenda: ["Kind words are free, {foe}. I'll still watch my wallet."], luke: ["Nice try, {foe}. What do you want?"]
    },
    drawYes: {
        _: ["A draw works for me.", "Fine by me, {foe}.", "I'll take the draw."],
        greg: ["Sure, {foe}, a draw sounds fair."], marcus: ["Acceptable."], trevor: ["The numbers don't favour anyone. Agreed."], brenda: ["Saves everyone the trouble."]
    },
    drawNo: {
        _: ["No. I think I'm winning this.", "Not yet, {foe}.", "Let's play it out."],
        sam: ["A draw?! No way, I'm just getting started!"], arthur: ["A draw? I didn't come here to share."], luke: ["Why would I stop now?"], marcus: ["No. I have a plan."]
    },
    pactRevenge: {
        _: ["{foe}, {card} has it coming. Join me?", "Let's make {card} pay, {foe}."],
        sam: ["{foe}! {card} is mine! You in?!"], leo: ["{card} wronged me, {foe}. Help me."], greg: ["Hey {foe}, {card} was pretty rough on me. Want to team up?"], marcus: ["{foe}. {card}. Together."]
    }
});
