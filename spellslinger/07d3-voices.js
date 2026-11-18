// =====================================================================
// Voices (2026-11-18, owner: "more robust voice prompts, emotions ... structured better ... some of them read horribly ... fun, unique, invoke emotion").
// The bots' lines are written one character at a time with `addVoice(who, { event: lines })`. A character's lines for an event are either
//     event: ["a line", "another line"]                  every mood
//     event: { '*': [...], salty: [...], worried: [...] }   '*' is every mood, the others only while the bot feels that way
// `addVoice('_', ...)` is the shared voice any bot can fall back on. Moods are the ones in 07c-politics.js (cheerful, calm, annoyed, salty, worried, smug,
// nervous, scheming, determined, impressed, angry, nerdy). A bot says its own lines first (07d-banter.js `pickLine`) and never repeats one from its last twelve.
// Placeholders: {foe} the person it is about (a name, or "you"), {foeIs} {foeWas} {foeHas} {foeDoes} {foePoss} (verbs and "'s" that follow {foe}, correct for both),
// {me} the speaker's commander, {card} a card or player, {n} a number, {cmd} a commander name, {life} its life, {turn} the turn number.
// The voice rules for each character, and the checks every line has to pass, are in docs/spellslinger-dialogue-voices.md and tests/suites/dialogue.js.
// =====================================================================
function addVoice(who, events) {
    for (const [ev, v] of Object.entries(events)) {
        const t = TALK[ev] = TALK[ev] || {};
        if (Array.isArray(v)) t[who] = v;
        else for (const [mood, lines] of Object.entries(v)) t[mood === '*' ? who : `${who}@${mood}`] = lines;
    }
}
