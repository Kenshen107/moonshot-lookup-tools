# Spellslinger Duels: voices and how the dialogue works

Written 2026-11-18 for the dialogue overhaul (owner: "more robust voice prompts, emotions, better structure ... fun, unique, invoke emotion").
The research behind it: [game-dialogue "barks" guidance](https://www.gamedeveloper.com/design/adding-life-to-worlds-with-dialogue-barks) (short lines that
confirm what happened, add personality or build tension), [how to write barks](https://howtowriteagame.substack.com/p/how-to-write-video-game-barks)
(a line should be unmistakably one character's, personality intensifies under pressure), and the Magic player types
([Timmy, Johnny, Spike, Vorthos, Melvin](https://www.thegamer.com/magic-the-gathering-player-type-guide-vorthos-spike-timmy-johnny-mel-explained/)),
which is where six of the nine characters come from.

## How a line is chosen

* Every line lives in `TALK[event]` (data: `spellslinger/07d3*.js`, written with `addVoice(who, { event: lines })`).
* A character's lines for an event are either a list (any mood) or `{ '*': [...], salty: [...], worried: [...] }`: the mood ones are used only while the bot feels that way.
  `_` is the shared voice any bot falls back on.
* `pickLine` (`07d-banter.js`): the character's own lines first (about four times in five), mood lines before plain ones, never one of the last twelve it said,
  and no random numbers (a seeded game replays the same talk).
* Placeholders: `{foe}` the player the line is about (a name or "you"), `{foeIs} {foeWas} {foeHas} {foeDoes} {foePoss}` (the verbs that follow it, right both ways),
  `{me}` the speaker's commander, `{card}` a card or player, `{n}`, `{cmd}`, `{life}`, `{turn}`. When the person is "you", `fillLine` drops a name used to address
  someone ("Come on, {foe}." becomes "Come on.") and fixes "you is / you has / you's".
* Events come from the game (`07c-politics.js`, `07d-banter.js`, `07e-info.js`, `07f-deals2.js`) and from the new reactions (`07d4-reactions.js`, `15ze-combo-talk.js`):
  going first, low life, near death, an almost empty library, the commander arriving, a huge spell, a big swing, a sweeper, an infinite-mana loop (the looper
  gloats, the next bot panics) and a small remark about every eighth turn in the bot's mood.

## The nine voices

| | Who | Sounds like | Never | When salty |
|---|---|---|---|---|
| Greg | friendly Timmy | warm, plain, laughs at himself, "buddy", "pal", loves a big dumb creature | cruel | goes quiet and hurt ("Okay. That stung.") |
| Marcus | cold Spike | short, exact, dry, numbers instead of feelings, "Noted." | an exclamation mark | more formal, never louder |
| Sarah | quirky Johnny | breathless, "wait wait", tangents, delighted by weird interactions | stays angry | sing-song ("Oh, that's lovely.") |
| Leo | Vorthos | narrates: story, chapter, page, curtain, hero, villain; the cards are characters | talks about mana math | operatic and tragic |
| Trevor | Melvin | counts out loud, "for the record", "technically", polite corrections | an exclamation mark, a lie | itemized ("Item one...") |
| Sam | speed-runner | short bursts, CAPS on the word that matters, wants to attack | patience | all exclamation marks |
| Arthur | the collector | pompous, prices, foils, "my collection", dismissive | says "cheap" | insulted, not angry ("I'll speak to someone.") |
| Brenda | budget builder | practical, thrift, proud of a quarter card, hates waste | brags about cost | it's about the money |
| Luke | trickster | grinning, sideways answers, innocent, compliments with a knife in them | answers straight | MORE cheerful |

## The checks every line passes (`tests/suites/dialogue.js`)

Rendered both with a name and with "you": no leftover `{placeholder}`, no "you is / you was / you has / you's", no stray address ("you,"), no double spaces, ends with
punctuation, 3 to 150 characters, no line twice, no two characters sharing a line, every `@mood` is a real mood, every character has its own line for every core
event and at least 90 lines, and the voice rules above (Marcus and Trevor never use "!", Sam and Sarah do, Leo stays in the story, Trevor counts, Brenda and Arthur
think about money). Add a line, run `node tests/suites/dialogue.js`.

## Adding to a voice

1. Open the character's block in `07d3a`, `07d3b` or `07d3c` (reactions: `07d3e`). Put new lines in the right event; use a `{ salty: [...] }` list for lines that only fit a mood.
2. Keep it to what that character would actually say. If another character could say it, rewrite it (the same test asks that).
3. Use the verb tokens after `{foe}` / `{card}` as the subject; avoid "{foe}'s" ("{foePoss}").
4. Run the dialogue suite and `tests/suites/banter.js`.

## Not done yet

* The Planeswalker's Ascent opponents (`spellslinger/13g-ascent-art-data.js`, 22 characters) still have their original two-line intro / win / lose / taunt sets;
  their taunts are not used in games yet.
* Per-theme "meet" lines are shared, not per character; deal-refusal reasons (`dealScore` messages) are still the plain wording.
