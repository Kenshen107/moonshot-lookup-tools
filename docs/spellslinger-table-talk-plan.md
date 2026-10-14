# Table talk, information, salt and cool: a proposal (2026-10-15)

Owner's idea: information is part of playing, so bots should share it and trade it in more complex deals; they should get salty when a play is nasty and impressed when a deck is unique; and they should say a lot more. **Nothing here is built yet. It waits for the owner's yes** (CLAUDE.md: no new features without approval).

## What exists today (so this builds on it, not beside it)
- `07c-politics.js`: moods (`botMood`, `MOODS`), speech bubbles (`botSay`, one line per kind every 6 turns, a few dozen lines in all), the archenemy, and three deals (Peace, Hands off, Gang up) scored by `dealScore` from trust (`P.trust`, `G.rep`), grudge (`P.grudge`), playstyle and mood. A bot that has been betrayed twice refuses deals.
- Talk is off in the lab and uses no random numbers, so seeded games replay exactly. Keep that rule.

## 1. Information (the new currency)
Today bots know everything the engine knows and say nothing about it. Give them **knowledge that can be shared, traded and faked**.
- **What a bot knows** (`P.known[seat]`): cards it has seen (cast, revealed, milled, exiled face up), open mana at the end of a turn, who held a counter or removal last time, who tutored, and a rough "danger" guess from the opponent's hand size and untapped lands. Hidden cards stay hidden unless told.
- **Tips and warnings** (a bot speaks up unprompted when it's in its interest): "Ruby has three Islands open", "Don't swing, Greg kept a Fog", "Multani is one hit from lethal on you". Each tip is either true or, for some personalities, a **bluff**.
- **Ask a bot** (a 🗣️ menu on its chip): "Do you have a counterspell?", "Who's the biggest threat?", "What would it take for you to leave me alone?" A bot answers from what it knows, by mood and trust. Honest bots (Cheerful, Calm) mostly tell the truth; Control and Scheming bots hedge or bluff.
- **Trust in information** (`P.reliable[seat]`): a tip that proves true raises it, a caught lie lowers it, and it feeds `dealScore`. Players see a small "trusted / unreliable" tag on a chip.
- **Gossip**: bots pass on what they saw ("Ruby broke her word to Luke last turn"), so reputation (`G.rep`) spreads without the human present.

## 2. More complex deals
Existing deals last one turn and are all-or-nothing. Add:
- **Longer terms**: peace for 2 or 3 turns, or "until X dies".
- **Bounties**: "Whoever knocks X out gets a card from me" (a draw, a Treasure, or a life gift paid on the spot).
- **Trades of restraint**: "I won't counter your next spell if you leave my commander alone", "I hold my sweeper if you hold yours".
- **Info for peace**: "I'll tell you who has the removal if you skip me this turn" (the tip is delivered first, so it can be checked).
- **Alliance** (a named 2-on-1 or 3-on-1 with a shared target and a visible countdown; the leader of the alliance gets hit first if it falls apart).
- **Counter-offers**: a bot that says no may propose a smaller deal ("Not peace, but I'll go after Greg first"), and the player can haggle once.
- **Kingmaking and spite**: a bot that is about to lose may give its last resources to the player it likes, or burn a grudge target.
- Every deal still shows in the log (🤝 / 💔) and the Deals button; breaking one still costs trust.

## 3. Salt (the "salty reaction")
- **What counts as salty** (`SALT_EVENTS`, each with a weight): land destruction, mass removal, a counterspell on a key spell, stax / "can't" effects, extra turns, mill (a lot of it, your deck), stealing a permanent, a commander killed twice, being the target of three spells in a row, infinite-feeling loops, a lethal swing after a deal.
- **Salt per bot** (`P.salt`) rises on those events by weight, falls over time, and depends on a personality dial (some bots shrug, some stew).
- **Reactions escalate**: a sigh, a complaint, a jab at the player, then a grudge rule change (the bot ignores peace offers for a few turns) and a **rage line when it is knocked out**. A bot that is out can **kingmake**.
- **Table salt chip** and an end-of-game line: "Saltiest player: Ruby (14). Cause: 3 counterspells."
- **Mill gets its own lines**, since this deck type is the most likely to draw them.

## 4. The cool factor for unique decks
- **What counts as cool** (`COOL_EVENTS`): a deck with a clear theme the bots can name (mill, clones, tokens, reanimator, artifacts, big X spells), a rare or old card (Moxen, Alpha, foils, serialized), a big combo or a game-turning play (copying the table's best creature, stealing a bomb, reanimating from a graveyard, a surprise lethal), and a comeback from low life.
- **Bots notice**: they name the commander and the theme on turn one ("Uldaros Theorix, Dimir mill: I'm keeping my library close"), and give a **respect** reaction (a new "impressed" mood and lines) when something cool happens, even when it hurts them.
- **Signature lines per deck**: a short table of tags read from the cards (`deckTags`), so a mill deck draws mill lines, a clone deck draws clone jokes, and a Voltron deck draws "who is that equipped on".
- **Style points** (optional, owner's call): a small coin bonus or a badge for a cool game, shown on the result screen.

## 5. A lot more to say
- Lines move out of the code into a table keyed by **event x mood x personality x deck tag**, with 3 to 6 variants each, so nothing repeats quickly. Target: about 300 lines to start, written in the owner's voice if they want to add their own.
- **Characters**: reuse the nine shop personalities (Greg, Marcus, Sarah, Leo, Trevor, Sam, Arthur, Brenda, Luke) as pod bots, each with a voice (Greg is blunt and friendly, Marcus is cold and exact, Leo notices the art and flavor, Brenda counts every dollar). Their playstyle is already mapped to a style.
- **Memory between games** (optional): a rivalry is remembered ("You milled me last time"), saved with the player's profile.
- Rules kept: one bubble kind per 6 turns per bot, at most 3 on screen, nothing random in seeded games (variants are picked from the turn number and seat), and every line also goes in the log.

## Build order (each step is small and tested in the lab)
1. **Lines and characters** (section 5) plus the salt events (section 3): no rules change, only talk. Lowest risk, most visible.
2. **Cool detection** (section 4) and deck introductions.
3. **Information**: `P.known`, tips, warnings, the Ask menu, reliability.
4. **Complex deals** (section 2), built on the information step.
Each step gets tests in `tests/suites/pod.js`, a lab run (500 pods: 0 hangs, 2-player results unchanged, deals per game and win rates by style checked for drift), and a line in the About update log.

## Decisions for the owner
1. Should pod bots be the nine named shop characters, or keep generic names?
2. May bots **lie**? (It makes information a real game, but a person can be misled by a tip.)
3. Should rivalries and salt carry over between games for the same player?
4. Show salt and cool as meters on the table, or only through what the bots say?
5. Do cool games earn a reward (coins or a badge)?
6. Which step first? Recommended: 1, then 2, then 3, then 4.
