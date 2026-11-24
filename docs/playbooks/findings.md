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

## Leads from that pod, and what became of them (2026-11-24, owner: "Build all references")
1. **Goblin Cannon for the computer's Samson plan:** it already finished with Cannon activations (added 2026-11-18); the real gap was the 60-activation cap for infinite-mana turns, which would have stopped it after 60. Goblin Cannon is now exempt (`15y-ai-plans.js`). The earlier note here saying the plan ended only with the Trident was wrong.
2. **"How many times" box:** a person now gets one prompt after the first activation, how many more times (up to 400 with infinite mana), and at whom (one player or "choose each one"), instead of a yes and a target for every activation (`15zb-cores.js`).
3. **Two quiet seats:** random pod seats now take at most one Control / Ramp / Spellslinger style between them and the first opponent (`06-engine.js`), and a quiet bot comes out when nobody at a pod has attacked for three rounds (`quietStall`, `07j-stay-quiet.js`; `G.lastAtkTurn`). Chosen decks are never changed.
4. **Animated artifacts:** checked, nothing to fix: an animated Mind Stone is a creature with its power, is not summoning sick and is offered to the attack code; Hugh not attacking on turn 20 was the stay-quiet trait.
5. **Bot land counts:** measured, no problem: 60 four-player pods with Hugh at seat A (seed 1..60) won 66.7%, with 5.85 mana by turn 5 for winners against 4.82 for the rest. The 4-lands-in-7-turns Odric game looks like a bad draw, not a habit; rerun with `--decka tests/decks/odric-lunarch-marshal.txt` if it keeps showing up.
Tests: `tests/suites/podfollow.js` (12 checks, in the fast run).
