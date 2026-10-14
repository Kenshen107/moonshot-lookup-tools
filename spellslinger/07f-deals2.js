// =====================================================================
// More complex deals (2026-10-15, owner: "sharing information, making more complex deals"; plan in docs/spellslinger-table-talk-plan.md).
// On top of Peace, Hands off and Gang up (07c-politics.js):
//   Peace for 3 turns      - peace that lasts three of the maker's turns.
//   Bounty                 - "if you hit them for 8 or knock them out, I give you a card" (the payer loses 2 life, the taker draws a card).
//   Restraint              - for 2 turns neither of us counters the other's spells or aims removal at the other's commander.
//   Tip for peace          - peace for a turn, and the bot tells you something it knows (07e-info.js; it may bluff).
//   Alliance               - a peace and a gang-up on a named player for 3 turns. Breaking it costs more trust and the whole table notices.
// A bot that says no may make a counter-offer (a smaller deal it would take). Worried bots, rich bots and bots that like you make offers of their own.
// Kingmaking: a bot that goes out and likes someone slides its hand across the table to them.
// No random numbers anywhere, so seeded games replay the same.
// =====================================================================
DEAL_TYPES.bounty = { name: 'Bounty', emoji: '💰', desc: 'If you hit the target for 8 or knock them out before my turn comes round again, I give you a card.' };
DEAL_TYPES.restraint = { name: 'Restraint', emoji: '⚖️', desc: "For two turns neither of us counters the other's spells or aims removal at the other's commander." };
const DEAL_KINDS = {
    peace3: { label: '🕊️ Peace x3', desc: 'Neither of us attacks the other for three of my turns.' },
    restraint: { label: '⚖️ Restraint', desc: DEAL_TYPES.restraint.desc },
    tipPeace: { label: '📣 Tip for peace', desc: "Peace for a turn, and you tell me something you know." },
    bounty: { label: '💰 Bounty…', desc: DEAL_TYPES.bounty.desc, needsTarget: true },
    alliance: { label: '🤝 Alliance…', desc: 'Peace and a gang-up on a named player for three turns. Breaking it costs a lot of trust.', needsTarget: true }
};
const hasRestraint = (i, j) => !!dealBetween(i, j, 'restraint');

// ---- Scoring ----
// How willing `bot` is when `from` asks for `kind` (x = the target for bounties and alliances). Peace is the base; each kind adjusts it.
function dealScore2(bot, from, kind, x) {
    const base = dealScore(bot, from, 'peace');
    if (base.score <= -90) return base;
    let s = base.score; const parts = { ...base.parts };
    const live = G.players.filter(P => !P.out);
    const mean = live.reduce((a, P) => a + podThreat(P), 0) / live.length;
    const X = x === undefined || x === null ? null : G.players[x];
    if (kind === 'peace3') { s -= 1; parts.longer = -1; }
    else if (kind === 'restraint') {
        const b = { control: 2, ramp: 1, midrange: 1, spellslinger: 0, tokens: 0, voltron: -1, aggro: -1 }[bot.aiStyle] || 0;
        s += b - 1; parts.style = b - 1;
    } else if (kind === 'tipPeace') { s += 0.5; }
    else if (kind === 'bounty' || kind === 'alliance') {
        if (!X || X.out || X === bot || X === from) return { score: -99, parts, reason: "That doesn't make sense." };
        const t = G.arch === X.i ? 3 : podThreat(X) > mean ? 1.5 : -2;
        s += t; parts.target = t;
        if (hasPeace(bot.i, X.i)) { s -= 5; parts.promised = -5; }
        if (kind === 'alliance') { const pact = dealScore(bot, from, 'pact', X.i); s = Math.min(s, pact.score) - 0.5; }
    }
    const worst = Object.entries(parts).sort((a, b) => a[1] - b[1])[0];
    const reason = !worst || worst[1] >= 0 ? 'Not this time.' : { trust: "I don't trust you.", grudge: `You went after me, ${nm(from)}.`, style: "That's not how I play.", tempted: "You're too easy a target right now.", target: "I don't see why they're the problem.", promised: 'I already gave my word to them.', longer: "That's too long to commit to." }[worst[0]] || 'Not this time.';
    return { score: s, parts, reason };
}
// A smaller deal the bot would take instead (or null)
function counterFor(bot, from, kind, x) {
    const tries = kind === 'alliance' ? [['pact', x], ['peace', null]]
        : kind === 'bounty' ? [['pact', x]]
        : kind === 'peace3' || kind === 'tipPeace' ? [['peace', null], ['spare', null]]
        : kind === 'restraint' ? [['spare', null], ['peace', null]]
        : [['spare', null]];
    for (const [type, tx] of tries) { if (dealBetween(from.i, bot.i, type)) continue; const r = dealScore(bot, from, type, tx === null ? undefined : tx); if (r.score >= 1) return { type, x: tx }; }
    return null;
}

// ---- Making them ----
function makeDealKind(from, to, kind, x) {
    if (kind === 'peace3') return makeDeal(from, to, 'peace', null, { len: 3 });
    if (kind === 'restraint') return makeDeal(from, to, 'restraint', null, { len: 2 });
    if (kind === 'bounty') return makeDeal(from, to, 'bounty', x, { len: 3, extra: { progress: 0 } });
    if (kind === 'tipPeace') {
        const d = makeDeal(from, to, 'peace');
        // the bot tells the person something (if the bot is the one giving it)
        const giver = to.isAI ? to : from.isAI ? from : null, getter = giver === to ? from : to;
        if (giver && !getter.isAI) { giver.lastTip = G.turn; if (!makeTip(giver, getter)) say(giver, 'askUnsure', 'calm', {}, null); }
        return d;
    }
    if (kind === 'alliance') {
        const peace = makeDeal(from, to, 'peace', null, { len: 3, extra: { alliance: true } });
        const pact = makeDeal(from, to, 'pact', x, { len: 3, extra: { alliance: true, link: true } });
        G.dealStats.made -= 1; // an alliance is one deal, not two
        return peace;
    }
}
// `from` asks `to` for a kind of deal. A bot answers at once: { ok, reason, counter? }.
function proposeDeal2(from, to, kind, x) {
    if (!to || to.out || from.out || from === to) return { ok: false, reason: 'No.' };
    if (!(to.isAI)) return { ok: false, reason: 'No.' };
    const r = dealScore2(to, from, kind, x);
    if (r.score >= 1) {
        makeDealKind(from, to, kind, x);
        say(to, kind === 'tipPeace' ? 'infoDeal' : kind === 'alliance' ? 'allianceOffer' : 'peaceYes', 'calm', { foe: nm(from), card: x != null ? who(G.players[x]) : '' }, null);
        return { ok: true, reason: '' };
    }
    dealStats().declined++;
    const counter = counterFor(to, from, kind, x);
    if (counter) say(to, 'counterOffer', 'scheming', { foe: nm(from), card: counter.x != null ? who(G.players[counter.x]) : '' }, null);
    else botSay(to, 'annoyed', r.reason, null);
    return { ok: false, reason: r.reason, counter };
}

// ---- Bounties ----
function bountyProgress(target, src, n) {
    (G.deals || []).filter(d => !d.over && d.type === 'bounty' && d.x === target.i && G.players[d.b] && src.owner === d.b).forEach(d => {
        d.progress = (d.progress || 0) + n;
        if (d.progress >= 8) payBounty(d, `hit ${nm(target)} for ${d.progress}`);
    });
}
function bountyOnOut(P) {
    (G.deals || []).filter(d => !d.over && d.type === 'bounty' && d.x === P.i && G.active === d.b).forEach(d => payBounty(d, `knocked out ${nm(P)}`));
}
function payBounty(d, why) {
    if (d.over) return;
    d.over = true; dealStats().kept++;
    const payer = G.players[d.a], taker = G.players[d.b];
    payer.life -= 2; drawCards(taker, 1);
    log(`💰 Bounty paid: ${nm(taker)} ${why}. ${nm(payer)} ${you(payer) ? 'lose' : 'loses'} 2 life and ${nm(taker)} ${you(taker) ? 'draw' : 'draws'} a card.`);
    [payer, taker].forEach(P => { const o = P === payer ? taker : payer; P.trust = P.trust || {}; P.trust[o.i] = (P.trust[o.i] || 0) + 1; });
    if (payer.isAI) say(payer, 'bountyPaid', 'cheerful', { foe: nm(taker) }, null);
}
// Called when a deal runs out (return true when the ending was already described)
function dealExpired(d) {
    if (d.type === 'bounty') { log(`💰 The bounty on ${nm(G.players[d.x])} ran out: nobody collected.`); return true; }
    if (d.alliance) {
        if (d.link) return true; // the pact half: the peace half says how it ended
        dealStats().kept++;
        const A = G.players[d.a], B = G.players[d.b];
        [A, B].forEach(P => { const o = P === A ? B : A; P.trust = P.trust || {}; P.trust[o.i] = (P.trust[o.i] || 0) + 2; });
        log(`🤝 The alliance between ${nm(A)} and ${nm(B)} is over - both kept their word.`);
        return true;
    }
    return false;
}
// ---- Restraint ----
function restraintOnTarget(P, victim, obj) {
    if (!obj || !obj.isCommander) return;
    const d = dealBetween(P.i, victim.i, 'restraint');
    if (d) breakDeal(d, P.i, "aimed removal at the other's commander");
}
function restraintOnCounter(P, victim) {
    const d = victim && dealBetween(P.i, victim.i, 'restraint');
    if (d) breakDeal(d, P.i, 'countered a spell');
}
{
    const origApply2 = applyEffect;
    applyEffect = async function (P, e, t, src) {
        const before = e.t === 'counter' ? G.lastCountered : null;
        const r = await origApply2.apply(this, arguments);
        if (e.t === 'counter' && G && G.players.length > 2 && G.lastCountered && G.lastCountered !== before) restraintOnCounter(P, G.lastCountered.P);
        return r;
    };
}

// ---- The dialog: more deals ----
function moreDealsHTML(B) {
    return Object.entries(DEAL_KINDS).map(([k, d]) => `<button class="btn small" title="${esc(d.desc)}" onclick="${d.needsTarget ? `dealDialog2('target', ${B.i}, '${k}')` : `dealAsk2(${B.i}, '${k}')`}">${d.label}</button>`).join('');
}
function dealDialog2(step, to, kind) {
    const v = me();
    const others = G.players.filter(P => P !== v && P !== G.players[to] && !P.out);
    showModal(`<h2>${DEAL_KINDS[kind].label.replace('…', '')} with ${esc(nm(G.players[to]))}</h2><p class="note">${esc(DEAL_KINDS[kind].desc)} Who is it against?</p>
        <div class="row" style="flex-wrap:wrap; gap:8px;">${others.map(O => `<button class="btn" onclick="dealAsk2(${to}, '${kind}', ${O.i})">${esc(nm(O))}</button>`).join('')}</div>
        <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="dealDialog()">Back</button></div>`);
}
function dealAsk2(i, kind, x) {
    const v = me(), bot = G.players[i];
    const r = proposeDeal2(v, bot, kind, x);
    closeModal(); renderGame();
    if (r.ok) { toast(`${nm(bot)} agrees.`); return; }
    if (r.counter) {
        const c = r.counter, t = DEAL_TYPES[c.type];
        showModal(`<h2>${esc(nm(bot))} says no, but...</h2><p>${esc(r.reason)}</p><p>They offer <b>${t.emoji} ${esc(t.name)}</b>${c.x != null ? ` against ${esc(nm(G.players[c.x]))}` : ''}: ${esc(t.desc)}</p>
            <div class="row" style="justify-content:center; gap:8px; margin-top:10px;"><button class="btn primary" onclick="acceptCounter(${i}, '${c.type}', ${c.x === null || c.x === undefined ? 'null' : c.x})">Accept</button><button class="btn" onclick="closeModal()">No thanks</button></div>`);
    } else toast(`${nm(bot)} says no: ${r.reason}`);
}
function acceptCounter(i, type, x) {
    closeModal();
    makeDeal(me(), G.players[i], type, x === null ? undefined : x);
    toast(`Deal made with ${nm(G.players[i])}.`); renderGame();
}

// ---- Offers from the bots ----
// A bot proposes something to the person (a prompt) or to another bot (decided by the same scoring)
async function offerKind(P, to, kind, x) {
    if (!to || to.out || (dealBetween(P.i, to.i, kind === 'peace3' || kind === 'tipPeace' ? 'peace' : kind) && kind !== 'bounty') || (kind === 'alliance' && hasPeace(P.i, to.i))) return false;
    const text = {
        peace3: `${who(P)} offers peace for three turns: neither of you attacks the other. Accept?`,
        restraint: `${who(P)} offers restraint for two turns: no counterspells between you and no removal at each other's commander. Accept?`,
        tipPeace: `${who(P)} offers a tip for peace: neither of you attacks the other this turn, and ${who(P)} tells you something it knows (it might bluff). Accept?`,
        bounty: `${who(P)} puts a bounty on ${x != null ? nm(G.players[x]) : 'someone'}: hit them for 8 or knock them out and ${who(P)} gives you a card (it costs ${who(P)} 2 life). Accept?`,
        alliance: `${who(P)} proposes an alliance against ${x != null ? nm(G.players[x]) : 'someone'}: peace between you and a gang-up on them for three turns. Breaking it costs a lot of trust. Accept?`
    }[kind];
    if (!to.isAI) {
        if (!talkOn()) return false;
        say(P, kind === 'tipPeace' ? 'infoDeal' : kind === 'alliance' ? 'allianceOffer' : kind === 'bounty' ? 'bountyOffer' : kind === 'restraint' ? 'tradeRestraint' : 'peaceOffer', 'scheming', { foe: 'you', card: x != null ? who(G.players[x]) : '' }, null);
        const yes = await askYes(to, text, { yes: 'Accept', no: 'No deal' });
        if (yes) { makeDealKind(P, to, kind, x); return true; }
        dealStats().declined++;
        return false;
    }
    const r = dealScore2(to, P, kind, x);
    if (r.score >= 1) { makeDealKind(P, to, kind, x); return true; }
    dealStats().declined++;
    return false;
}
async function moreOffers(P) {
    if (!G || G.players.length < 3 || P.out || dealsRefused(P) || G.hotseat) return;
    G.dealAsk2 = G.dealAsk2 || {};
    if (G.turn - (G.dealAsk2[P.i] ?? -99) < 6 || (G.turn + P.i) % 3 !== 0) return;
    const human = G.players.find(X => !X.isAI && !X.out);
    const live = G.players.filter(X => !X.out && X !== P);
    const arch = G.arch != null && G.arch !== P.i ? G.players[G.arch] : null;
    const m = botMood(P).mood, key = P.char ? P.char.key : '';
    const friends = live.filter(X => X !== arch && trustOf(P, X) >= 0 && !hasPeace(P.i, X.i)).sort((a, b) => trustOf(P, b) - trustOf(P, a));
    let done = false;
    // an alliance against whoever is far ahead
    if (arch && friends.length && P.life >= 10 && !(arch.i === P.i)) {
        const ally = (human && friends.includes(human) && trustOf(P, human) >= 1 ? human : friends[0]);
        done = await offerKind(P, ally, 'alliance', arch.i);
    }
    // a bounty from the rich and the generous
    else if (arch && ['arthur', 'brenda', 'luke', 'greg'].includes(key) && P.life > 8) {
        const taker = friends[0] || live.find(X => X !== arch);
        if (taker) done = await offerKind(P, taker, 'bounty', arch.i);
    }
    // restraint from a control bot that likes you
    else if (P.aiStyle === 'control' && human && trustOf(P, human) >= 1) done = await offerKind(P, human, 'restraint');
    // information for peace from a worried schemer
    else if (m === 'worried' && ['marcus', 'luke', 'trevor'].includes(key) && human && !hasPeace(P.i, human.i)) done = await offerKind(P, human, 'tipPeace');
    // longer peace from a worried bot
    else if (m === 'worried' && human && trustOf(P, human) >= 0 && !hasPeace(P.i, human.i)) done = await offerKind(P, human, 'peace3');
    if (done) G.dealAsk2[P.i] = G.turn;
    else if (arch || m === 'worried') G.dealAsk2[P.i] = G.turn - 3; // try again a little sooner
}
