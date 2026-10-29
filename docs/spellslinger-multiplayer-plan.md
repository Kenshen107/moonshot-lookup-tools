# Spellslinger Duels: 4-player Commander and AI playstyles (plan, 2026-10-14)

Owner's request: "build out 4 player commander. With AI to match playstyles, closer intelligence to what we had discussed before. Develop playstyles and assign those to bot opponents that may be playing decks that mimic that play style."

## Defaults (change any of these on the owner's word)
- **Free-for-all**, you + 3 computer players, 40 life, 21 commander damage from any one commander, last player standing wins. (Team formats such as Two-Headed Giant are a later add-on.)
- Turn order is seat order, clockwise; the starting player is random. Priority and "each opponent" follow the Comprehensive Rules (APNAP order; 800s multiplayer rules, 903 Commander).
- Rewards: 250 coins for a Commander pod win (2-player stays 200), 40 for a loss, 100 for finishing second (owner can change).
- The 2-player game must behave exactly as today. Every phase ends with `tests/run_all.py` and a 1,000-game lab run showing no new hangs.

## What the engine assumes today (measured 2026-10-14)
`G.players` is a pair and `opp(P)` is `players[1 - P.i]`: 34 `opp(` calls (21 engine, 8 AI, 5 conditions), about 30 `1 - x.i` spots, 126 `.i ?` ternaries, `foe()` 19 uses, the table draws one opposing side, combat has one defender, blocks come from one player, and "each opponent" effects hit one player.

## Phases
1. **Pods in the lab (no engine change).** Lab can already seed games; add a `players` count to `LAB.play` so the same harness measures 4-seat games as soon as the engine allows them. Baseline: 2-player win rates and hangs.
2. **N-player engine core.**
   - `G.players` of 2-4; `opp(P)` stays (the next living opponent, so old 2-player code is untouched) and new `foes(P)` returns all living opponents; `each opponent` effects loop over `foes`.
   - Elimination: a player who loses leaves (their permanents go, their spells and abilities on the stack stop), the game ends when one is left. 800.4 rules for leaving the game.
   - Combat: each attacker chooses a defending player (`o.attacking = playerIndex`); blockers come from the player attacked; first/double strike and trample per defender; commander damage tracked per commander.
   - Turn and priority order across N players; `you()` / hotseat stays 2-player only.
   - Targeting: "target opponent" asks, "target player" any; counterspells and responses go around the table.
   - Win/lose invariants in the lab: exactly one winner, all cards in one zone.
3. **Table UI.** Three opponent bars with life, commander damage and a mini board each; the active opponent's board larger, tap a bar to zoom to that board; attackers choose which opponent they hit; phone layout shows opponents as a tab strip. Play tab: "4-player pod" chip, choose three opponents or "Surprise me" for all three.
4. **Playstyles.** A `PLAYSTYLES` table; each bot gets `P.style` (and a name from `PERSONALITIES` where one fits) with weights the AI already reads in `aiScore`, `aiChooseAttackers`, `aiChooseBlocks`, `aiPickTarget`:
   - **Aggro** (attacks early, burns face, ignores defence), **Control** (holds counters/removal, trades, plays the long game), **Midrange** (value creatures, attacks when ahead), **Ramp/Big stuff**, **Tokens/Go-wide**, **Voltron** (equips/auras on the commander, protects it), **Combo-ish/Spellslinger** (draws, casts many spells), **Stax/Tax** (only what the engine reads), **Politician/Group hug** (helps whoever is behind, avoids being the target).
   - **Decks that match:** each style maps to a deck recipe (EDHREC themes for a commander, or Scryfall tags such as `otag:` ramp/removal/token-generator, with the type limits `RANDOM_CMD_CAPS` replaced by style limits: aggro = more cheap creatures, control = more instants and removal, and so on). A style can also be assigned to a "Surprise me" random deck by scoring the cards that were picked.
   - **Update 2026-10-28:** the computer seats no longer always get a themed random deck: each rolls 60% a saved Commander deck or Ready precon and 40% an EDHREC build, with the themed deck as the fallback (see "Where the computer's Commander decks come from" in `CLAUDE.md`).
5. **Multiplayer intelligence** (the list discussed earlier, now with a table to play on):
   - **Threat assessment:** who is winning (board power, cards in hand, life, commander on board); attack the leader, not the weakest, unless the style says otherwise; don't kill a player who is about to be killed by someone else if a combat trick matters.
   - **Politics-lite:** remember who attacked or removed this bot (revenge weight), avoid becoming the biggest threat early (hold back a bomb, a "don't be the archenemy" rule), a group-hug style spreads help.
   - **Race math and hold-back:** keep blockers back when the next opponent's attack would be lethal; count damage from all opponents' untapped creatures.
   - **Combat tricks, turn sequencing** (cast creatures after attacking when the trick is held; removal before combat), better mulligans, commander-specific play.
   - **Difficulty levels** scale how many of these a bot uses (easy ignores threat assessment).
6. **Measure.** Lab pods of 4 with every style against every other: win rates should be within a believable band (no style wins more than about 40% or less than about 10% over 1,000 pods), games should end (median 12 to 20 turns per player), zero hangs. Old-vs-new AI on the same seeds proves each intelligence step.

## Order of work and size
Phase 2 is the big one (the engine's two-player assumptions are everywhere), then 3 (table), then 4 and 5 in small steps, each shippable and tested. Phases 1 and 2 first; nothing player-visible changes until phase 3.

## Open questions for the owner (defaults above if no answer)
1. Free-for-all only, or also two-vs-two teams later?
2. Rewards for 2nd/3rd place?
3. Should the campaign get a 4-player tier, or is this Sandbox only for now?

## Status (2026-10-14)
- **Done:** phase 1 (lab pods), phase 2 (engine core, one defending player per combat), phase 3 (table strip, Play tab chips), phase 4 (7 playstyles with matching decks, assigned to every opponent), and the first part of phase 5 (threat-based defender choice, revenge memory, hold-back in pods, removal bias to the leader, block and attack eagerness by style). See CLAUDE.md for details.
- **Lab, 700 pods:** 0 hangs; wins by style 14% (aggro) to 39% (voltron).
- **Still to do:** combat tricks and turn sequencing for the AI, better mulligans, difficulty levels that switch these on or off, splitting attackers between opponents, a pod in Campaign, balancing Aggro / Spellslinger up and Voltron down, a Politician style (needs group-hug cards the engine reads), real "target opponent" choices, team formats.

- **2026-10-14 (later):** archenemy, table talk, bot moods with speech bubbles, the pod free mulligan, play-by-play popups in pods, and deals (peace, hands off, gang up; bots offer them too) are built. Still open: combat tricks and turn sequencing, difficulty levels for the smart play, a Politician style, splitting attackers, a pod in Campaign, team formats.
