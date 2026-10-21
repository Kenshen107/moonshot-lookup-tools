// =====================================================================
// Politics in a pod (2026-10-14, owner's request: "add some politics to mimic real human game play ... a bot's feelings pop up on screen
// just like in a real game"). Three parts:
//  - the archenemy: once one player is clearly ahead, the table turns on them (`updateArchenemy`, read by `podPickDefender` and `aiHoldBack`);
//  - table talk: bots say why they do things (`botSay`) and the game log keeps it;
//  - feelings: every bot has a mood (`botMood`: angry, worried, smug, nervous, calm...) shown on its chip, and a speech bubble pops up on screen when it changes or speaks.
// Nothing here uses random numbers, and talk does nothing in autoplay and lab games, so the lab's seeded games stay replayable.
// =====================================================================
const MOODS = {
    angry: { emoji: '😠', name: 'angry' }, annoyed: { emoji: '😒', name: 'annoyed' }, worried: { emoji: '😰', name: 'worried' },
    smug: { emoji: '😏', name: 'confident' }, nervous: { emoji: '😬', name: 'nervous' }, scheming: { emoji: '🤔', name: 'plotting' },
    determined: { emoji: '😤', name: 'determined' }, calm: { emoji: '😌', name: 'calm' }, cheerful: { emoji: '😄', name: 'cheerful' }, nerdy: { emoji: '🤓', name: 'focused' },
    impressed: { emoji: '🤩', name: 'impressed' }, salty: { emoji: '🧂', name: 'salty' },
    out: { emoji: '💀', name: 'out of the game' }
};
// What each playstyle feels when nothing is going on
const STYLE_MOOD = { aggro: 'determined', control: 'scheming', midrange: 'calm', ramp: 'calm', tokens: 'cheerful', voltron: 'determined', spellslinger: 'nerdy' };

// ---- The archenemy: whoever is far ahead of the table ----
function updateArchenemy() {
    if (!G || G.players.length < 3) return;
    const live = G.players.filter(P => !P.out);
    if (live.length < 3) { G.arch = null; return; }
    const th = Object.fromEntries(live.map(P => [P.i, podThreat(P)]));
    const leader = live.slice().sort((a, b) => th[b.i] - th[a.i] || a.i - b.i)[0];
    const mean = F => live.filter(P => P !== F).reduce((a, P) => a + th[P.i], 0) / (live.length - 1);
    const was = G.arch;
    const keep = was != null && !G.players[was].out && th[was] > mean(G.players[was]) * 1.1 + 1;
    const start = th[leader.i] > mean(leader) * 1.35 + 3;
    G.arch = keep ? was : start ? leader.i : null;
    if (G.arch !== was && G.arch != null) {
        pol().arch++;
        const A = G.players[G.arch];
        const caller = live.find(P => P !== A && P.isAI);
        log(`${A.name} is pulling ahead - the table starts to focus on them.`);
        if (caller) say(caller, 'archenemy', 'worried', { foe: you(A) ? 'You' : who(A) });
    }
}

// ---- Moods ----
function botMood(P) {
    if (P.out) return { mood: 'out', why: 'knocked out' };
    if (typeof saltyMood === 'function' && saltyMood(P)) return { mood: 'salty', why: `${who(P)} is salty (${Math.round(P.salt)}): the table has been rough on them` };
    const st = styleOf(P);
    const foeList = foes(P);
    const incoming = foeList.flatMap(F => F.bf.filter(isCreature)).reduce((a, o) => a + Math.max(0, pow(o)), 0);
    const grudge = P.grudge || {};
    const angryAt = Object.entries(grudge).sort((a, b) => b[1] - a[1]).map(([i, n]) => ({ F: G.players[i], n })).find(x => x.F && !x.F.out);
    if (P.life <= 8 || (P.life <= 15 && incoming >= P.life * 0.6)) return { mood: 'worried', why: `${P.life} life and ${incoming} power on the other boards` };
    if (angryAt && angryAt.n >= 6) return { mood: 'angry', why: `${angryAt.F.name.split(',')[0]} has hurt them (${angryAt.n} damage and spells)` };
    if (G.arch === P.i) return { mood: 'worried', why: 'the table is focusing on them' };
    if (G.arch != null && G.arch !== P.i && P.life >= 20) return { mood: 'smug', why: `${G.players[G.arch].name.split(',')[0]} is taking the heat` };
    return { mood: STYLE_MOOD[P.aiStyle] || 'calm', why: st ? `${st.name} style, nothing special going on` : 'nothing special going on' };
}

// ---- Table talk and the speech bubble ----
const talkSeen = new Map();
// Counters for the test lab: how political a game was (talk lines, archenemy swings, who hit whom, who was last at the table and when players left)
const pol = () => (G.pol = G.pol || { talk: 0, arch: 0, hits: {}, worst: {}, outAt: [], steals: 0 });
function talkOn() { return !AUTOPLAY && !(typeof window !== 'undefined' && window.__LAB) && !!G && !G.over && !G.hotseat && !$('game').classList.contains('hidden'); }
// A bot says something: it goes in the log, and a bubble with its mood pops up near the top of the table.
// `key` limits repeats: the same bot says the same kind of thing at most once every few turns.
function botSay(P, mood, text, key) {
    if (!P || P.out || !P.isAI || !G) return;
    const k = `${P.i}:${key || mood}`;
    if (key !== null && talkSeen.get(k) !== undefined && G.turn - talkSeen.get(k) < 6) return;
    talkSeen.set(k, G.turn);
    pol().talk++;
    const m = MOODS[mood] || MOODS.calm;
    G.log.push(`${m.emoji} ${who(P)}: "${text}"`);
    if (G.log.length > 80) G.log.shift();
    if (!talkOn()) return;
    P.lastMood = mood;
    showBubble(P, mood, text);
}
function showBubble(P, mood, text) {
    const host = $('talkLayer');
    if (!host) return;
    const m = MOODS[mood] || MOODS.calm;
    const el = document.createElement('div');
    el.className = 'talk-bubble';
    el.innerHTML = `<span class="tb-emoji" aria-hidden="true">${m.emoji}</span><span class="tb-body"><strong>${esc(who(P))}</strong> <em>is feeling ${esc(m.name)}</em><br>${esc(text)}</span>`;
    el.onclick = () => el.remove();
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600); }, 5200);
    renderGame();
}
// The mood on a bot's chip changes with the game; show a bubble when it changes to something worth saying
function moodCheck(P) {
    if (!P.isAI || P.out) return;
    const { mood, why } = botMood(P);
    const before = P.mood;
    P.mood = mood;
    if (mood === before || mood === 'calm' || mood === STYLE_MOOD[P.aiStyle]) return;
    if (['worried', 'angry', 'smug'].includes(mood)) say(P, mood, mood, {}, `mood-${mood}`);
}
// Your attack, a bot's answer
function politicsAttacked(att, def, n) {
    dealsOnAttack(att, def);
    if (att && def) { const h = pol().hits; const k = `${att.i}>${def.i}`; h[k] = (h[k] || 0) + 1; }
    if (!def || !def.isAI || def.out || att === def) return;
    const g = (def.grudge && def.grudge[att.i]) || 0;
    const foe = you(att) ? 'you' : who(att);
    if (def._betrayedTurn === G.turn) return; // the betrayal line already said it
    if (g >= 6) say(def, 'hitAgain', 'angry', { foe }, `hit${att.i}`);
    else say(def, 'hit', 'annoyed', { foe, n: n || '' }, `hit${att.i}`);
}
function politicsTargeted(P, victim, obj) {
    if (!victim || victim === P || victim.out) return;
    dealsOnTarget(P, victim);
    if (typeof restraintOnTarget === 'function') restraintOnTarget(P, victim, obj);
    victim.grudge = victim.grudge || {};
    victim.grudge[P.i] = (victim.grudge[P.i] || 0) + 2;
    banterTargeted(P, victim);
    if (victim.isAI) say(victim, 'spellAtMine', 'annoyed', { foe: you(P) ? 'you' : who(P) }, `spell${P.i}`);
}
// Called at the start of every turn in a pod
function politicsTick(P) {
    if (!G || G.players.length < 3) return;
    updateArchenemy();
    banterTurnStart(P);
    if (typeof infoTick === 'function') infoTick(P);
    G.players.forEach(moodCheck);
    if (G.turn >= 12) { const live = G.players.filter(X => !X.out).sort((a, b) => podThreat(b) - podThreat(a)); live.forEach((X, r) => { if (r === live.length - 1 && live.length > 2) pol().worst[X.i] = G.turn; }); }
}

// =====================================================================
// Deals (2026-10-14, owner: "let's build out the deals"). Agreements between two players in a pod, kept for one round (until the player who
// made the deal starts their next turn):
//   peace - neither attacks the other.   spare - neither targets the other's permanents with spells and abilities.
//   pact  - both attack a named third player (x).
// A bot decides by its trust in the asker, what the asker did to it, how threatened it feels and its playstyle (`dealScore`; no random numbers).
// Bots keep their word (an Aggro bot breaks a peace when it has lethal). Breaking a deal costs trust with that bot and a little with everyone (`G.rep`).
// You make deals from the 🤝 Deals button in the opponent strip; worried bots and bots that are behind offer them to you and to each other.
// =====================================================================
const DEAL_TYPES = {
    peace: { name: 'Peace', emoji: '🕊️', desc: "Neither of us attacks the other until my next turn." },
    spare: { name: 'Hands off', emoji: '🤚', desc: "Neither of us targets the other's permanents with spells or abilities until my next turn." },
    pact: { name: 'Gang up', emoji: '🎯', desc: "We both attack the same third player until my next turn." }
};
function dealStats() { return G.dealStats || (G.dealStats = { made: 0, kept: 0, broken: 0, declined: 0 }); }
const dealsOf = i => (G.deals || []).filter(d => !d.over && (d.a === i || d.b === i));
const dealBetween = (i, j, type) => (G.deals || []).find(d => !d.over && d.type === type && ((d.a === i && d.b === j) || (d.a === j && d.b === i)));
const hasPeace = (i, j) => !!dealBetween(i, j, 'peace');
const hasSpare = (i, j) => !!dealBetween(i, j, 'spare');
// The third player a bot has promised to attack with a pact
function pactTarget(P) {
    const d = (G.deals || []).find(x => !x.over && (x.type === 'pact' && (x.a === P.i || x.b === P.i)) && x.x !== P.i && G.players[x.x] && !G.players[x.x].out);
    return d ? G.players[d.x] : null;
}
const nm = P => (you(P) ? 'you' : P.name.split(',')[0]);
// "Marcus (Guan Yu)": the character and the commander it plays, so a prompt or a texted record says which seat it means
const whoFull = P => (you(P) ? 'you' : P.char ? `${P.char.name} (${P.name.split(',')[0]})` : P.name.split(',')[0]);

function dealScore(bot, from, type, x) {
    const st = styleOf(bot);
    const trust = ((bot.trust && bot.trust[from.i]) || 0) + ((G.rep && G.rep[from.i]) || 0) * 0.5;
    const grudge = (bot.grudge && bot.grudge[from.i]) || 0;
    const live = G.players.filter(P => !P.out);
    const mean = live.reduce((a, P) => a + podThreat(P), 0) / live.length;
    const mood = botMood(bot).mood;
    // Burned twice (two broken deals): no more deals, from anyone who was betrayed
    if (dealsRefused(bot)) return { score: -99, parts: {}, reason: "I'm too angry to make deals right now." };
    if (bot.trust && bot.trust[from.i] <= -6) return { score: -99, parts: {}, reason: "You've broken your word twice. No more deals." };
    let s = 1 + 2 * trust - grudge * 0.4;
    const parts = { trust: 2 * trust, grudge: -grudge * 0.4 };
    if (type === 'peace' || type === 'spare') {
        const bias = { control: 2, ramp: 2, midrange: 1, spellslinger: 1, tokens: 0, voltron: -1, aggro: -2 }[bot.aiStyle] || 0;
        const b = type === 'spare' ? 1 + bias / 2 : bias;
        s += b; parts.style = b;
        if (mood === 'worried') { s += 3; parts.worried = 3; }
        if (G.arch === from.i) { s += 2; parts.threat = 2; }
        if (G.arch === bot.i) { s += 2; parts.threat = 2; }
        if (type === 'peace' && from.life <= 8) { s -= 3; parts.tempted = -3; } // a nearly dead player is a tempting target
    } else if (type === 'pact') {
        const X = G.players[x];
        if (!X || X.out || X === bot) return { score: -99, parts, reason: 'that doesn\'t make sense' };
        const t = G.arch === x ? 4 : podThreat(X) > mean ? 2 : -2;
        s += t + ((bot.grudge && bot.grudge[x]) || 0) * 0.3 - 0.2 * grudge; parts.target = t;
        if (hasPeace(bot.i, x)) { s -= 5; parts.promised = -5; }
    }
    // The biggest thing standing in the way is the reason when it says no
    const worst = Object.entries(parts).sort((a, b) => a[1] - b[1])[0];
    const reason = !worst || worst[1] >= 0 ? 'Not this time.' : { trust: "I don't trust you.", grudge: `You went after me, ${nm(from)}.`, style: "That's not how I play.", tempted: "You're too easy a target right now.", target: "I don't see why they're the problem.", promised: 'I already gave my word to them.' }[worst[0]];
    return { score: s, parts, reason };
}

// opts: { len: how many of the maker's turns it lasts (default 1), extra: more fields on the deal (the alliance flag) }
function makeDeal(a, b, type, x, opts = {}) {
    const d = { type, a: a.i, b: b.i, x: x === undefined ? null : x, owner: a.i, turn: G.turn, over: false, left: opts.len || 1, ...(opts.extra || {}) };
    (G.deals = G.deals || []).push(d);
    dealStats().made++;
    { const b = dealStats().by = dealStats().by || {}; b[type] = (b[type] || 0) + 1; }
    const until = d.left > 1 ? `for ${d.left} of ${nm(a)}${you(a) ? 'r' : "'s"} turns` : (G.active === a.i ? `for a full round, until ${nm(a)}${you(a) ? 'r' : "'s"} next turn` : `until ${nm(a)}${you(a) ? 'r' : "'s"} next turn`);
    log(`🤝 ${a.name.split(',')[0]} and ${b.name.split(',')[0]} make ${d.alliance ? 'an alliance ' : 'a '}${DEAL_TYPES[type].name.toLowerCase()} deal${type === 'pact' ? ` against ${G.players[x].name.split(',')[0]}` : ''} (${until}).`);
    return d;
}
// `from` proposes to `to`. A bot answers at once; the result is { ok, reason }.
function proposeDeal(from, to, type, x) {
    if (!to || to.out || from.out || from === to) return { ok: false, reason: 'No.' };
    if (dealBetween(from.i, to.i, type)) return { ok: false, reason: 'We already have that deal.' };
    const r = dealScore(to, from, type, x);
    if (r.score >= 1) {
        makeDeal(from, to, type, x);
        if (type === 'peace') say(to, 'peaceYes', 'calm', { foe: nm(from) }, null);
        else botSay(to, 'calm', `Deal. ${type === 'peace' ? "I won't attack you" : type === 'spare' ? "I'll leave your permanents alone" : `We'll go after ${nm(G.players[x])} together`} until ${from.i === 0 ? 'your' : `${nm(from)}'s`} next turn.`, null);
        return { ok: true, reason: '' };
    }
    dealStats().declined++;
    botSay(to, 'annoyed', `${r.reason}`, null);
    return { ok: false, reason: r.reason };
}
function breakDeal(d, by, why) {
    if (d.over) return;
    d.over = true; d.broken = by;
    dealStats().broken++;
    { const b = dealStats().brokenBy = dealStats().brokenBy || {}; b[d.type] = (b[d.type] || 0) + 1; }
    const other = G.players[d.a === by ? d.b : d.a], culprit = G.players[by];
    G.rep = G.rep || {}; G.rep[by] = (G.rep[by] || 0) - 1;
    other.trust = other.trust || {}; other.trust[by] = (other.trust[by] || 0) - 3;
    other.grudge = other.grudge || {}; other.grudge[by] = (other.grudge[by] || 0) + 4;
    log(`💔 ${nm(culprit) === 'you' ? 'You break' : `${nm(culprit)} breaks`} the ${DEAL_TYPES[d.type].name.toLowerCase()} deal with ${nm(other) === 'you' ? 'you' : nm(other)}${why ? ` (${why})` : ''}.`);
    other._betrayedTurn = G.turn;
    saltAdd(other, culprit, 'betray', 3, { quiet: true });
    if (typeof gossip === 'function') gossip(culprit, other);
    (G.deals || []).filter(x => x !== d && !x.over && x.alliance && ((x.a === d.a && x.b === d.b) || (x.a === d.b && x.b === d.a))).forEach(x => { x.over = true; }); // the other half of the alliance ends with it
    if (d.alliance) { other.trust[by] -= 2; G.rep[by] = (G.rep[by] || 0) - 1; log('💔 An alliance is broken: the whole table notices.'); }
    if (other.isAI) say(other, 'betrayed', 'angry', { foe: you(culprit) ? 'you' : who(culprit) }, `betray${by}`);
    if (culprit.isAI) say(culprit, 'betrayer', 'smug', { foe: you(other) ? 'you' : who(other) }, `betrayer${by}`);
}
// A deal runs out when the player who made it starts their next turn
function expireDeals(P) {
    (G.deals || []).forEach(d => {
        if (d.over || d.owner !== P.i || G.turn <= d.turn) return;
        if (d.left > 1) { d.left--; d.turn = G.turn; return; } // a longer deal runs another round
        d.over = true;
        if (typeof dealExpired === 'function' && dealExpired(d)) return; // bounties and the like say their own ending
        dealStats().kept++;
        [d.a, d.b].forEach(i => { const o = G.players[i === d.a ? d.b : d.a]; if (o) { G.players[i].trust = G.players[i].trust || {}; G.players[i].trust[o.i] = (G.players[i].trust[o.i] || 0) + 1; } });
        const A = G.players[d.a], B = G.players[d.b];
        log(`🤝 The ${DEAL_TYPES[d.type].name.toLowerCase()} deal between ${nm(A)} and ${nm(B)} is over - both kept their word.`);
    });
    G.deals = (G.deals || []).filter(d => !d.over);
}
// Attacks and spells that break a deal
function dealsOnAttack(att, def) {
    if (!def) return;
    const d = dealBetween(att.i, def.i, 'peace');
    if (d) breakDeal(d, att.i, 'attacked');
    const p = (G.deals || []).find(x => !x.over && x.type === 'pact' && (x.a === att.i || x.b === att.i) && x.x !== def.i);
    if (p && !hasPeace(att.i, def.i)) breakDeal(p, att.i, 'did not attack the target');
}
function dealsOnTarget(by, victim) {
    const d = dealBetween(by.i, victim.i, 'spare');
    if (d) breakDeal(d, by.i, 'targeted a permanent');
}
// Bots offer deals to each other and, when it is a person's table, to the person (a prompt)
async function dealsTick(P) {
    if (!G || G.players.length < 3 || P.out) return;
    expireDeals(P);
    if (!P.isAI || P.aiLevel === 'easy') return;
    if (typeof moreOffers === 'function') await moreOffers(P);
    const m = botMood(P).mood;
    const live = foes(P).filter(F => !hasPeace(P.i, F.i));
    if (!live.length) return;
    const meanT = G.players.filter(X => !X.out).reduce((a, X) => a + podThreat(X), 0) / G.players.filter(X => !X.out).length;
    const behind = podThreat(P) < meanT * 0.6;
    if (!(m === 'worried' || behind || G.arch === P.i)) return;
    // Ask whoever worries it most (the biggest board that isn't already at peace with it)
    const ask = live.slice().sort((a, b) => podThreat(b) - podThreat(a) || a.i - b.i)[0];
    if (G.dealAsk && G.turn - (G.dealAsk[P.i] ?? -99) < 8) return;
    (G.dealAsk = G.dealAsk || {})[P.i] = G.turn;
    if (!ask.isAI && talkOn()) {
        const yes = await askYes(ask, `${whoFull(P)} (${(MOODS[m] || MOODS.calm).emoji} ${(MOODS[m] || MOODS.calm).name}) offers peace: neither of you attacks the other until their next turn. Accept? You can still change your mind, but a broken deal is remembered.`, { card: P.command[0] && P.command[0].card, yes: 'Accept the deal', no: 'No deal' });
        if (yes) { makeDeal(P, ask, 'peace'); say(P, 'peaceYes', 'calm', { foe: 'you' }, null); }
        else { dealStats().declined++; say(P, 'peaceNo', 'annoyed', { foe: 'you' }, null); }
    } else {
        const r = dealScore(ask, P, 'peace');
        if (r.score >= 1) { makeDeal(P, ask, 'peace'); if (ask.isAI) say(ask, 'peaceYes', 'calm', { foe: nm(P) }, null); }
        else dealStats().declined++;
    }
}
// The 🤝 Deals dialog (you ask a bot)
function dealDialog(step, to, type) {
    if (!G || G.players.length < 3 || G.over) return;
    const v = me();
    const bots = G.players.filter(P => P !== v && !P.out && P.isAI);
    const active = dealsOf(v.i).map(d => { const o = G.players[d.a === v.i ? d.b : d.a]; return `<li>${DEAL_TYPES[d.type].emoji} ${DEAL_TYPES[d.type].name} with <b>${esc(nm(o))}</b>${d.type === 'pact' ? ` against <b>${esc(nm(G.players[d.x]))}</b>` : ''}</li>`; }).join('');
    if (step === 'target') {
        const others = G.players.filter(P => P !== v && P !== G.players[to] && !P.out);
        showModal(`<h2>${DEAL_TYPES.pact.emoji} Gang up with ${esc(nm(G.players[to]))}</h2><p class="note">Who should you both attack?</p><div class="row" style="flex-wrap:wrap; gap:8px;">${others.map(O => `<button class="btn" onclick="dealAsk(${to}, 'pact', ${O.i})">${esc(nm(O))}</button>`).join('')}</div><div class="row" style="margin-top:12px;"><button class="btn" onclick="dealDialog()">Back</button></div>`);
        return;
    }
    showModal(`<h2>🤝 Make a deal</h2>
        <p class="note">A deal lasts until your next turn. Break one and that player (and, a little, everyone) remembers. Bots decide from how much they trust you, what you did to them, how threatened they feel, and how they play.</p>
        ${active ? `<p><b>Active deals</b></p><ul>${active}</ul>` : ''}
        ${bots.map(B => `<div class="panel" style="margin:8px 0;"><div class="row"><b>${(MOODS[botMood(B).mood] || MOODS.calm).emoji} ${esc(nm(B))}</b> <span class="note">${esc(styleOf(B) ? styleOf(B).name : '')} · feeling ${esc((MOODS[botMood(B).mood] || MOODS.calm).name)}</span></div>
            <div class="row" style="flex-wrap:wrap; gap:6px; margin-top:6px;">${['peace', 'spare'].map(t => `<button class="btn small" title="${esc(DEAL_TYPES[t].desc)}" onclick="dealAsk(${B.i}, '${t}')">${DEAL_TYPES[t].emoji} ${DEAL_TYPES[t].name}</button>`).join('')}
            <button class="btn small" title="${esc(DEAL_TYPES.pact.desc)}" onclick="dealDialog('target', ${B.i})">${DEAL_TYPES.pact.emoji} ${DEAL_TYPES.pact.name}…</button>${typeof moreDealsHTML === 'function' ? moreDealsHTML(B) : ''}</div>
            ${typeof emoteButtonsHTML === 'function' ? `<div class="row" style="flex-wrap:wrap; gap:6px; margin-top:6px;">${emoteButtonsHTML(B)}</div>` : ''}</div>`).join('')}
        ${typeof tableDealsHTML === 'function' ? tableDealsHTML() : ''}
        <div class="row" style="justify-content:center; gap:8px; margin-top:10px;">${typeof drawButtonHTML === 'function' ? drawButtonHTML() : ''}<button class="btn" onclick="closeModal()">Close</button></div>`);
}
function dealAsk(i, type, x) {
    const r = proposeDeal(me(), G.players[i], type, x);
    closeModal();
    renderGame();
    if (!r.ok) toast(`${nm(G.players[i])} says no: ${r.reason}`);
    else toast(`${nm(G.players[i])} agrees.`);
}
