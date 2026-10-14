# Political decks: test results (2026-10-14)

Owner's request: "run some sandbox test games and come up with some decks that are fun political interactions that are entertaining for real people. We just need test games and interactions."

**How it was run:** `node tests/lab.js --n 800 --conc 5 --kind commander --players 4 --themes random --seed 1000`, then `node tests/political_report.js`. Six themed deck builders (`L.THEMES` in `tests/lib/lab-page.js`) pick a commander and shape 99 cards by card-text weights; each pod seats four different themes. All 800 pods finished: 0 hangs, 0 errors, 0 broken invariants; seats 24.6 / 26.6 / 23.5 / 25.1%; median 48 total turns.

**Fun score** (`tests/political_report.js`): deals made (up to 8), betrayals x3, archenemy changes x2, table-talk lines, a comeback winner (ranked last by threat after turn 12), a game of 40-70 total turns, minus early eliminations. Rough measure only; a person should still judge.

## What makes a pod fun (top 10% of pods vs all)
| Part | Top 10% | All |
|---|---|---|
| Betrayals (deals broken) | 6.1 | 2.7 |
| Archenemy changes | 8.8 | 6.3 |
| Comeback win | 6.0 | 4.5 |
| Table talk | 2.7 | 1.7 |

Betrayal is the biggest difference: the best pods have 3-5 broken deals and the lead changes hands 4-7 times. Early eliminations were rare (0.1 a pod), so they aren't a problem.

## Themes
| Theme | Style | Fun | Win rate per seat |
|---|---|---|---|
| Edict & Removal (assassin) | control | 27.6 | 15% |
| Pillow Fort (fort) | control | 27.1 | 23% |
| Group Hug (hug) | ramp | 26.4 | 18% |
| Table Drain (drain) | midrange | 26.3 | **56%** |
| Big Bully (bully) | voltron | 25.8 | 27% |
| Thief (thief) | aggro | 25.6 | **11%** |

- Assassin and Fort add the most politics (people argue over who to kill and who to leave alone).
- **Table Drain is too strong** (56%): "each opponent loses" effects don't care who you made peace with. Thief is too weak (11%): the engine reads few steal effects, and aggro attacks get blocked by deals.
- Best pod mixes: assassin + bully + fort + hug (29.7) and assassin + drain + fort + hug (29.5).

## Commanders worth building around
Highest fun in their pods (12+ games): Yahenni, Undying Partisan (31.0), Sheoldred, Whispering One (30.7, wins 45%), Adeline, Resplendent Cathar (30.5), Hercules, Prince of Power (30.3), Obyra, Dreaming Duelist (30.0), Asmodeus the Archfiend (29.6, but 0% wins: a fun loser).

## Best moments
Seed 1000 (fun 52): Rakka Mar, Madame Masque, Asmodeus the Archfiend, Slash. 17 deals, 5 broken, 5 archenemy changes, 62 turns. Asmodeus and Madame Masque traded peace deals turn after turn; each broke it by attacking the same turn, said "You gave me your word", and Madame Masque finally killed Asmodeus with 15 combat damage on a deal Asmodeus had just been betrayed under. Replay: `node tests/lab.js --replay 1000 --kind commander --players 4 --themes random`. Others: 1176 (90 turns, 18 deals, 7 archenemy changes), 1096, 1642, 1707.

## Findings to act on (not built; each needs the owner's yes)
1. A bot that breaks a deal logs two grudge lines in a row ("You gave me your word" then "That's twice now"). Cut the second when it fires on the same turn.
2. Table Drain needs a counterweight: bots should treat "each opponent loses life" decks as a threat sooner (`podThreat`).
3. Thief decks need steal effects the engine can run (Threaten-style, Control Magic).
4. Serial deal-breaking between two bots can go on for many turns; a trust floor (stop offering peace to someone who broke it twice) would make betrayals feel like consequences.

## Fixes built after the first run (owner said yes to all four, 2026-10-14)
1. **One grudge line per betrayal:** the "That's twice now" line is skipped on the turn a bot already said "You gave me your word" (`_betrayedTurn`).
2. **Drain is a threat sooner:** `podThreat` adds 3 per permanent (up to 5) that drains every opponent (`drainThreat`, `DRAIN_RE`). Table Drain's win rate went from 56% to 40% (800 pods, same seeds).
3. **Thief:** the engine already runs 41 Commander-legal steal cards (Act of Treason style, Dominate, Mind Flayer and so on), so the first finding was wrong about that. Thief's low win rate (11% to 13% now) is mostly because Aggro is the weakest style overall (13%). No steal-card change was made; tuning Aggro is a separate job.
4. **Trust floor:** a bot that has been betrayed twice (trust -6 or lower) refuses every deal from that player ("You've broken your word twice. No more deals."), and doesn't offer them peace.

After the fixes: 0 hangs, 0 errors, 0 broken invariants; about 10 deals a game, 8.7 kept, 1.0 broken; wins by style midrange 40%, voltron 36%, ramp 21%, control 20%, aggro 13%. Fun scores barely moved (26.5 to 26.9). The 2-player lab baseline is unchanged.
