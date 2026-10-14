// =====================================================================
// Information at the table (2026-10-15, owner: "information is part of playing, so sharing information"; plan in docs/spellslinger-table-talk-plan.md).
//  - Bots remember what they have seen (`noteSeen`) and know their own hand and the board.
//  - A friendly bot (or a worried one) volunteers a tip to the person: how many lands someone left open, who may be holding an answer, who the real threat is (`infoTick`).
//    Some characters bluff (`CHARACTERS[..].lie`): Luke and Marcus often, Trevor never. A bluff is always decided without random numbers, and bots lie less to players they trust.
//  - You can ask a bot a question from the 🗣️ Ask button (`askDialog`, `botAnswer`).
//  - Every tip and answer is checked later (`checkTips`, at that bot's next turn): the log says whether it held up, and the bot's reliability with you
//    (`G.reliable[seat]`) goes up or down. The strip shows "trusted" or "unreliable" once it is clear.
// =====================================================================
const TIP_GAP = 5; // turns between a bot's unprompted tips
const ASK_MAX = 2; // questions a person can ask per turn
const trustOf = (P, Q) => ((P.trust && P.trust[Q.i]) || 0) + ((G.rep && G.rep[Q.i]) || 0) * 0.5;

// ---- What is known ----
function noteSeen(P, o) {
    G.seen = G.seen || {};
    const s = G.seen[P.i] = G.seen[P.i] || { counters: 0, removal: 0, instants: 0, names: [] };
    const r = Rx(o);
    if (r.kind === 'instant' || r.flash) s.instants++;
    if ((r.spell || []).some(e => e.t === 'counter')) s.counters++;
    if ((r.spell || []).some(e => ['destroy', 'exile', 'dmg', 'bounce'].includes(e.t))) s.removal++;
    s.names.push(o.card.name); if (s.names.length > 12) s.names.shift();
}
const openMana = X => X.bf.filter(o => !o.tapped && (Rx(o).mana || /\bLand\b/.test(o.card.type))).length;
function holdsAnswer(X, kind) {
    return X.hand.some(o => {
        const r = Rx(o);
        if (!(r.kind === 'instant' || r.flash)) return false;
        if (kind === 'counter') return (r.spell || []).some(e => e.t === 'counter');
        if (kind === 'removal') return (r.spell || []).some(e => ['destroy', 'exile', 'dmg', 'bounce'].includes(e.t));
        return true;
    });
}
// Would this bot lie right now? Decided from the turn, the seat and a counter, so seeded games replay the same.
function wouldLie(bot, to) {
    const lie = bot.char ? bot.char.lie : 0;
    if (!lie) return false;
    const chance = lie * (trustOf(bot, to) >= 2 ? 0.3 : 1);
    G.infoN = (G.infoN || 0) + 1;
    return ((G.turn * 131 + bot.i * 17 + G.infoN * 29) % 100) / 100 < chance;
}

// ---- Tips ----
function pendingTip(t) { (G.tips = G.tips || []).push({ ...t, turn: G.turn, checked: false }); }
// One tip from `bot` to the person `to`, or null when there is nothing worth saying
function makeTip(bot, to) {
    const others = G.players.filter(X => X !== bot && !X.out);
    const subjects = others.filter(X => X !== to);
    const lie = wouldLie(bot, to);
    const hot = subjects.slice().sort((a, b) => podThreat(b) - podThreat(a))[0];
    // 1) a threat, when someone is far ahead
    if (G.arch != null && G.arch !== bot.i) {
        const real = G.players[G.arch], fake = subjects.filter(X => X !== real)[0] || real;
        const named = lie ? fake : real;
        say(bot, 'tipThreat', 'scheming', { card: you(named) ? 'You' : who(named), n: named.bf.filter(isCreature).reduce((a, o) => a + Math.max(0, pow(o)), 0), foe: 'you' }, 'tip');
        pendingTip({ from: bot.i, to: to.i, kind: 'threat', about: named.i, claim: true, truth: !lie });
        return true;
    }
    // 2) someone with an answer and mana open
    const holder = subjects.find(X => openMana(X) >= 2 && holdsAnswer(X, 'counter')) || subjects.find(X => openMana(X) >= 2 && holdsAnswer(X, 'removal'));
    const open = subjects.slice().sort((a, b) => openMana(b) - openMana(a))[0];
    if (holder || (lie && open && openMana(open) >= 2)) {
        const X = holder || open;
        say(bot, 'tipHold', 'scheming', { card: who(X), foe: 'you' }, 'tip');
        pendingTip({ from: bot.i, to: to.i, kind: 'hold', about: X.i, claim: true, truth: !!holder });
        return true;
    }
    // 3) lands left open (true unless it is a bluff, then one more than there are)
    if (open && openMana(open) >= 3) {
        const n = openMana(open) + (lie ? 2 : 0);
        say(bot, 'tipMana', 'scheming', { card: who(open), n, foe: 'you' }, 'tip');
        pendingTip({ from: bot.i, to: to.i, kind: 'mana', about: open.i, claim: n, truth: !lie, real: openMana(open) });
        return true;
    }
    return false;
}
// At the start of a bot's turn: a friendly or worried bot may tell the person something
function infoTick(P) {
    if (!G || G.players.length < 3 || !P.isAI || P.out || G.hotseat) return;
    checkTips(P);
    const human = G.players.find(X => !X.isAI && !X.out);
    if (!human || G.turn - (P.lastTip ?? -99) < TIP_GAP) return;
    const friendly = trustOf(P, human) >= 1 || hasPeace(P.i, human.i) || ((P.grudge && P.grudge[human.i]) || 0) < 3;
    const wantsHelp = botMood(P).mood === 'worried';
    if (!(friendly || wantsHelp) || dealsRefused(P)) return;
    if (makeTip(P, human)) P.lastTip = G.turn;
}
// Was an earlier tip or answer true? Checked at that bot's next turn; the log says so and the reliability moves
function checkTips(P) {
    (G.tips || []).filter(t => !t.checked && t.from === P.i && G.turn > t.turn).forEach(t => {
        t.checked = true;
        G.reliable = G.reliable || {};
        G.reliable[P.i] = (G.reliable[P.i] || 0) + (t.truth ? 1 : -2);
        const to = G.players[t.to];
        if (t.truth) { log(`✔ ${who(P)}'s ${t.kind === 'ask' ? 'answer' : 'tip'} held up.`); if ((P.char || {}).lie === 0 || t.turn % 2) say(P, 'tipTrue', 'cheerful', { foe: you(to) ? 'you' : who(to), card: who(G.players[t.about] || P) }, 'tipTrue'); }
        else { log(`✘ ${who(P)}'s ${t.kind === 'ask' ? 'answer' : 'tip'} was false.`); if (P.char && P.char.lie >= 0.25) say(P, 'tipLie', 'scheming', { foe: you(to) ? 'you' : who(to), card: who(G.players[t.about] || P) }, 'tipLie'); }
    });
}
const reliTag = X => { const r = (G.reliable || {})[X.i] || 0; return r >= 2 ? `<span class="reli ok" title="Their tips have held up">✔ trusted</span>` : r <= -2 ? `<span class="reli bad" title="Their tips or answers have been false">✘ unreliable</span>` : ''; };

// ---- Ask a bot ----
const QUESTIONS = [
    ['counter', 'Do you hold a counterspell?'],
    ['removal', 'Do you hold removal?'],
    ['threat', "Who's the biggest threat?"],
    ['attack', 'Will you attack me next turn?'],
    ['deal', 'Would you make peace with me?']
];
function askButtonHTML() { return `<button type="button" class="pod-chip" onclick="askDialog()" title="Ask a bot a question. They may lie, and the log tells you later whether they did."><b>🗣️ Ask</b></button>`; }
function askDialog() {
    if (!G || G.players.length < 3 || G.over) return;
    const v = me(), used = G.askUsed && G.askUsed.turn === G.turn ? G.askUsed.n : 0;
    const bots = G.players.filter(P => P !== v && !P.out && P.isAI);
    showModal(`<h2>🗣️ Ask a bot</h2>
        <p class="note">Bots answer from what they know, and some bluff. You can ask ${ASK_MAX} questions a turn (${ASK_MAX - used} left). After their next turn the log tells you whether the answer was true.</p>
        ${bots.map(B => `<div class="panel" style="margin:8px 0;"><div class="row"><b>${(MOODS[botMood(B).mood] || MOODS.calm).emoji} ${esc(who(B))}</b> <span class="note">${esc(B.char ? B.char.blurb : '')}</span> ${reliTag(B)}</div>
            <div class="row" style="flex-wrap:wrap; gap:6px; margin-top:6px;">${QUESTIONS.map(([q, label]) => `<button class="btn small" ${used >= ASK_MAX ? 'disabled' : ''} onclick="askBot(${B.i}, '${q}')">${esc(label)}</button>`).join('')}</div></div>`).join('')}
        <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="closeModal()">Close</button></div>`);
}
function askBot(i, q) {
    const bot = G.players[i], v = me();
    const used = G.askUsed && G.askUsed.turn === G.turn ? G.askUsed.n : 0;
    if (!bot || used >= ASK_MAX) { toast('No more questions this turn.'); return; }
    G.askUsed = { turn: G.turn, n: used + 1 };
    const a = botAnswer(bot, v, q);
    closeModal();
    log(`🗣️ You ask ${who(bot)}: ${QUESTIONS.find(x => x[0] === q)[1]}`);
    botSay(bot, a.mood, a.text, null);
    if (talkOn()) toast(`${who(bot)}: ${a.text}`);
    renderGame();
}
// The answer: { text, mood }. The truth is worked out first; a bluffing bot says the opposite.
function botAnswer(bot, to, q) {
    const lie = wouldLie(bot, to);
    const ctx = { foe: 'you' };
    let truth, text, kind = 'ask';
    if (q === 'counter' || q === 'removal') {
        truth = holdsAnswer(bot, q) && openMana(bot) >= 1;
        const says = lie ? !truth : truth;
        text = pickLine(bot, says ? 'askYes' : 'askNo', ctx);
        pendingTip({ from: bot.i, to: to.i, kind, about: bot.i, claim: says, truth: says === truth });
    } else if (q === 'threat') {
        const live = G.players.filter(X => X !== bot && !X.out).sort((a, b) => podThreat(b) - podThreat(a));
        const real = live[0], fake = live[1] || live[0];
        const named = lie ? fake : real;
        text = pickLine(bot, 'askThreat', { ...ctx, card: you(named) ? 'you' : who(named) });
        pendingTip({ from: bot.i, to: to.i, kind, about: named.i, claim: named.i, truth: !lie });
    } else if (q === 'attack') {
        const target = G.players.length > 2 ? podPickDefender(bot) : to;
        truth = bot.bf.some(o => isCreature(o) && pow(o) > 0) && !!target && target === to && !hasPeace(bot.i, to.i);
        const says = lie ? !truth : truth;
        text = pickLine(bot, says ? 'askYes' : 'askNo', ctx);
        pendingTip({ from: bot.i, to: to.i, kind, about: bot.i, claim: says, truth: says === truth });
    } else {
        const r = dealScore(bot, to, 'peace');
        text = r.score >= 1 ? pickLine(bot, 'peaceYes', ctx) + ' Ask me properly in the Deals menu.' : pickLine(bot, 'peaceNo', ctx) + ` (${r.reason})`;
    }
    return { text: text || pickLine(bot, 'askUnsure', ctx), mood: lie ? 'scheming' : 'calm' };
}
// Gossip: when a deal is broken, the other bots talk about it
function gossip(culprit, victim) {
    const talker = G.players.find(X => X.isAI && !X.out && X !== culprit && X !== victim);
    if (talker) say(talker, 'gossip', 'scheming', { foe: you(culprit) ? 'you' : who(culprit), card: you(victim) ? 'you' : who(victim) }, 'gossip');
}
