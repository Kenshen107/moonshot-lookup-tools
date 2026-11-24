# Playbook findings (hand-written; `playbooks.md` is rebuilt by `tests/playbook.js`, this file is not)

## Pod of 2026-11-24: Doc Samson (person) vs Hugh, Othelm and Odric (computer), won on turn 30 (own turn 8)
Added to `games.jsonl.gz` as a condensed copy (the 80 Goblin Cannon activations keep no targets). Doc Samson now has 5 games (3 won, 2 lost) in `playbooks.md`.

**How the win went**
- Turns 3-19 (own turns 1-6): a land every turn, small creatures (Cankerbloom, Gamma Grotesque, Sazh Katzroy), Samson himself on turn 19. Spells per own turn 1.8 (14 spells in 8 turns).
- Turn 23 and 27: Sazh Katzroy doubled counters. Turn 23 put them on Samson (5 then 11 counters) while he stayed home, so the 20 damage came from the other attackers. Turn 27 put them on Leatherhead (17 counters) and an Ornithopter of Paradise chump-blocked it: counters need evasion or trample to matter.
- Turn 27: Ring of Three Wishes ({5}, T, remove a counter) fetched **Staff of Domination**.
- Turn 30: Staff, then Gyre Sage (taps for its power) = a loop (offered by `genericLoop`, accepted), infinite mana, Staff draws, Rishkar's Expertise drew 22 and cast **Goblin Cannon** free, and 80 activations of Goblin Cannon killed Hugh and Othelm in one turn. Goblin Cannon is in 3 of 3 Samson wins.

**What the table did**
- Only 8 attacks in 30 turns by the three computer seats (4 / 1 / 3); the person took 12 damage all game. Two of the three were Ramp bots (Hugh, Othelm), which are "stay quiet" (`07j-stay-quiet.js`): they don't attack players who haven't hurt them and sit on big permanents, so a pod with two Ramp seats is passive. Odric (aggro) attacked with Odric alone (4 a turn) because the rest of its board was tiny: it played 4 lands in 7 turns and cast 8 spells.
- The table pressure went to the lifegain deck: Odric reached 46 life by turn 19, was the archenemy, took 20 from the person on turn 23 and 30 from Hugh on turn 28. The person (28 life) was never the target. Being second-biggest while a lifelinker leads is the safest seat.
- Hugh cast Cyberdrive Awakener on turn 20 (Mind Stone and Ancient Den become 4/4 creatures until end of turn) and then didn't attack: animate-then-attack is a miss for a quiet bot.
- Peace was offered by Othelm on turn 29 and kept (it attacked Hugh instead). The bots can't see a combo in hand, so peace with a combo player costs them nothing they know about.

**What the person did better than the computer (numbers in `playbooks.md`, low confidence at 5 games)**: 2.5 spells a turn against 1.3, 4.9 abilities a turn against 0.2, and a finish that turns infinite mana into a kill.

## Leads, in the order I'd do them (none built; each is the owner's call)
1. **Goblin Cannon as a second finisher for the computer's Samson plan.** `DECK_PLANS['Doc Samson, Super Psychiatrist']` ends only with Surestrike Trident (`tridentKill`). The person's wins used Goblin Cannon; with infinite mana the computer should kill every opponent the same way (one activation per life point, capped by the activation limit `INF_ACT_CAP` of 60, so it would need that cap lifted for this one finisher).
2. **A number box for repeatable activations.** Goblin Cannon asked "Activate it again (N so far)?" and a target 80 times, about 160 taps. With infinite mana the prompt could be "How many times?" with a split of targets. (Interface change: ask first.)
3. **Two Ramp bots make a pod passive.** When random pod seats are drawn, avoid two quiet styles at once, or let a quiet bot attack when nobody else has.
4. **Animated artifacts and creatures-until-end-of-turn.** Check whether `aiChooseAttackers` counts permanents animated this turn (Cyberdrive Awakener, Mutavault-style) or whether stay-quiet held Hugh back; the record can't tell them apart.
5. **Low land counts for bots**: Odric 4 lands in 7 turns, Hugh 5. Worth a look at the opening-hand and mulligan choices (`mulliganWanted`) for these two decks with a land-count probe over 100 seeded pods.
