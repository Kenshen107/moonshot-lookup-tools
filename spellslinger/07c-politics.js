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
        const A = G.players[G.arch];
        const caller = live.find(P => P !== A && P.isAI);
        log(`${A.name} is pulling ahead - the table starts to focus on them.`);
        if (caller) botSay(caller, 'worried', `${you(A) ? 'You are' : `${A.name.split(',')[0]} is`} getting out of hand. Somebody has to deal with that.`);
    }
}

// ---- Moods ----
function botMood(P) {
    if (P.out) return { mood: 'out', why: 'knocked out' };
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
function talkOn() { return !AUTOPLAY && !(typeof window !== 'undefined' && window.__LAB) && !!G && !G.over && !G.hotseat && !$('game').classList.contains('hidden'); }
// A bot says something: it goes in the log, and a bubble with its mood pops up near the top of the table.
// `key` limits repeats: the same bot says the same kind of thing at most once every few turns.
function botSay(P, mood, text, key) {
    if (!P || P.out || !P.isAI || !G) return;
    const k = `${P.i}:${key || mood}`;
    if (key !== null && talkSeen.get(k) !== undefined && G.turn - talkSeen.get(k) < 6) return;
    talkSeen.set(k, G.turn);
    const m = MOODS[mood] || MOODS.calm;
    G.log.push(`${m.emoji} ${P.name.split(',')[0]}: "${text}"`);
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
    el.innerHTML = `<span class="tb-emoji" aria-hidden="true">${m.emoji}</span><span class="tb-body"><strong>${esc(P.name.split(',')[0])}</strong> <em>is feeling ${esc(m.name)}</em><br>${esc(text)}</span>`;
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
    const LINES = {
        worried: ['I\'m in trouble here.', 'This is getting dangerous for me.'],
        angry: ['I won\'t forget that.', 'You keep coming after me. Noted.'],
        smug: ['Looks like somebody else is the problem now.', 'I\'m happy to watch this.']
    };
    const a = LINES[mood]; if (!a) return;
    botSay(P, mood, a[(G.turn + P.i) % a.length], `mood-${mood}`);
}
// Your attack, a bot's answer
function politicsAttacked(att, def, n) {
    if (!def || !def.isAI || def.out || att === def) return;
    const g = (def.grudge && def.grudge[att.i]) || 0;
    const who = you(att) ? 'you' : att.name.split(',')[0];
    if (g >= 6) botSay(def, 'angry', `That's twice now, ${who}. I'm remembering this.`, `hit${att.i}`);
    else botSay(def, 'annoyed', `Really, ${who}? Fine. We'll see how that goes.`, `hit${att.i}`);
}
function politicsTargeted(P, victim) {
    if (!victim || victim === P || victim.out) return;
    victim.grudge = victim.grudge || {};
    victim.grudge[P.i] = (victim.grudge[P.i] || 0) + 2;
    if (victim.isAI) botSay(victim, 'annoyed', `${you(P) ? 'You' : P.name.split(',')[0]} just went after my stuff.`, `spell${P.i}`);
}
// Called at the start of every turn in a pod
function politicsTick(P) {
    if (!G || G.players.length < 3) return;
    updateArchenemy();
    G.players.forEach(moodCheck);
}
