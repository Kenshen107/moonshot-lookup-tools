# Table sense: how the bots behave like players at a real table

Added 2026-10-28 at the owner's request ("improve the bot interaction ... robust just like a real game of magic", then "build C, B and A in that order and start to document how it all works intricately"). Code: `spellslinger/07i-table-sense.js` (loaded right after `07h-deal-tension.js`). Tests: `tests/suites/tablesense.js`. This file is the long version; CLAUDE.md has the short one.

## Why these three

The research (Commander strategy writers, bluffing and priority discussions, and what the existing bots lacked) kept coming back to three habits that separate a table of people from a table of scripts:

1. **Nobody wants to be the one who answers the threat.** Answering usually costs the answerer a card and helps everyone else. People wait until the threat is theirs. (This is C.)
2. **The real fight happens after blocks.** Tricks and instant removal are cast when blockers are declared, and the possibility of one changes which attacks are made at all. (This is B.)
3. **Open mana is information.** Holding mana up says "I might have it", and opponents behave differently because of it. (This is A.)

The lab had already shown that *what* the bots cast matters little (random casting costs nothing; see `tests/README.md`, "Card use") while attacks, blocks and target choice each cost 2 to 4 points when randomized. So all three habits are about combat, targets and timing, not about card choice.

## Ground rules (they apply to all three)

- **Pods only by default.** Everything runs when the game has 3 or 4 players. Duels are unchanged unless `AI_TUNE.duels` is set, so `tests/baseline_lab2p.json` still matches exactly. (`tsOn(P)` is the one gate.)
- **Smart bots only.** `tsSmart(P)`: an AI seat, level normal or hard (not `easy`), not a lab "random" baseline seat (`P.aiRand`).
- **No random numbers.** Every decision is a function of the board, so seeded lab games replay exactly. The talk lines also use no random numbers.
- **Only actions bluff.** A bot never says something false about the board. It can leave mana up, attack, or hold a card; it doesn't lie. (The older `07e-info.js` bluffs are separate, per-character and about *information* deals.)
- **Every habit has a knob** in `AI_TUNE` (`07b-playstyles.js` holds the table; `07i` adds its keys). A seat's own `P.tune` wins. The lab can switch a habit off for seat A only: `node tests/lab.js --players 4 --kind commander --tune "patience=0,holdMana=0"`.

| Knob | Default | Meaning |
|---|---|---|
| `patience` | 2 | Rounds a bot waits before answering a threat that is not its problem (0 = off). A round is one turn for every living player. |
| `holdMana` | 1 | Keep mana up for a counterspell or a trick (0 = off). |
| `trickWindow` | 1 | Cast tricks and instant removal after blocks (0 = off). |
| `trickAtk` | 1 | Attack into a bad block when a trick wins it (0 = off). |
| `fear` | 1 | Hold small attackers back from open mana (0 = off). |
| `duels` | 0 | 1 = also use all of this in two-player games. |

## C. Let somebody else answer it

**What it does.** A bot with removal does not spend it on another player's permanent just because the permanent is good. If the threat isn't its problem and another player is at least as exposed, it waits. After waiting `patience` rounds (default 2, so 8 turns in a 4-player pod), or the moment the threat becomes its problem, it answers.

**Where it hooks in.**
- `removalWorthIt(P, o)` is wrapped. The old test (is the target worth the card?) runs first; if it says yes and the permanent belongs to another player, `podWaits` can still say "not yet". `aiBestPlay` already zeroes the score of a removal spell whose target fails `removalWorthIt`, so the bot casts something else.
- `aiScore(P, o, target)` is wrapped for board wipes (`wipe`, `massBounce` effects). The wipe waits on the leader (the foe with the highest `podThreat`).

**`threatIsMine(P, F)`: when it stops waiting.** It returns true (answer now) if any of these holds:
1. `winThreat(F)` is non-null: F can kill somebody next turn (lethal range, commander damage 14+, poison 7+). A table that waits then loses.
2. P is at 12 life or less.
3. P holds a grudge of 6+ against F (F has been hurting it).
4. F has dealt P 10+ commander damage.
5. F's combined creature power is at least 30% of P's life **and** P is at least as exposed as every other opponent of F (`power / life` ratio).

A permanent with no creature power behind it (an enchantment engine, say) is therefore waited on until one of 1 to 4 happens or the patience runs out.

**Bookkeeping.** `P.patWait[key]` records the turn the bot first wanted to answer `key` (`perm:<uid>` or `wipe:<seat>`); `P.patSaid[key]` makes it say its line once ("X is a problem, but not mine yet. I'll see who deals with it.", through `botSay`, key `patience`, at most once every 6 turns). Lab counter: `pol().ts.waits`.

**Known simplifications.**
- Only removal spells and wipes wait; activated-ability removal doesn't.
- The bot can't see whether another player *has* an answer; it only reasons about who is more exposed.
- A bot can't tell it's the only one with an answer, so a table of four patient bots can all wait. The patience cap and the "somebody is about to win" rule are what end that.

## B. Combat tricks after blocks

**What it does.** Once blockers are declared, the attacking player gets priority first, then the others in turn order (CR 117.3). Each smart bot in that order looks at every blocked fight and casts the one trick or removal spell with the biggest gain (at most 2 per bot per window), then re-looks.

**Where it hooks in.** `chooseBlocksAll` (the step where every defender chooses blocks, `06b-attack-targets.js`) is wrapped; after it returns, `aiCombatTricks()` runs. This covers the bot's own attacks (`aiTurn`) and a bot defending against a person or another bot. `G.phase` is set to `afterBlocks` for the active player and `declareBlocks` for the others while they cast, because those are the phases `canCastNow` allows an instant in; it is restored afterwards.

**The combat simulator `simCombat(a, bs, mod)`.** For one attacker `a` and the creatures blocking it `bs`, with an optional pump `mod = { uid, p, q, kw }` applied to one creature, it returns `{ aDies, killed }`:
- the attacker spreads its damage over the blockers weakest first (deathtouch needs 1 each);
- indestructible and protection are respected;
- first strike and double strike are handled by who strikes first: a first-strike blocker group that kills the attacker kills it before it deals damage; a first-striking attacker kills first and only the survivors hit back.
It does not model trample spillover, damage prevention, or several attackers sharing blockers. `combatScore(a, result)` is the attacker's view in creature value: the value of what it kills minus its own value if it dies.

**The decision `aiOneTrick(P)`.** For each blocked attacker:
- *Pump trick* (an instant that gives a creature +p/+q or keywords until end of turn, `trickOf`): try it on each of P's own creatures in that fight. Gain = how much better the combat score is for P's side. The attacker's owner wants the score up, the defender wants it down.
- *Instant removal* (`removalOf`: destroy, exile, or damage that kills): try each of the **other** side's creatures in the fight. It is cast when it saves the attacker or kills a blocker that is worth a card (`removalWorthIt`), and it still respects the patience rule above.
- *Lethal pump*: if one of P's attackers is unblocked and the unblocked damage plus the pump kills the player it is attacking, that wins outright (gain 30).
A spell is cast only if the gain is at least 3 (about one good creature), and only if the target is legal (`validTargets`, so hexproof is respected). `pol().ts.tricks` and `.combatRemoval` count them.

**Attacking into a bad block with the trick in hand.** `aiChooseAttackersFree` is wrapped. After the old logic picks attackers, it looks at the rest: with a castable pump in hand and the mana for it untapped, an attacker joins the attack if, for every untapped creature that could block it, the pumped attacker would survive. One trick backs one attacker, cheapest trick first, and the mana is counted. Counter: `trickAttacks`.

**Known simplifications.** One pump per fight is evaluated at a time (no stacking two tricks); the opponent's possible counterspell isn't weighed; sorcery-speed "tricks" and activated abilities (equip, Sandman-style) aren't used here; and the bot doesn't consider the trick's value for later fights.

## A. Mana up

**What it does (the holding side).** `tableReserve(P)`, read by `aiBestPlay`, is the amount of mana the bot refuses to spend on non-instants during its own main phases. It holds when it has:
- a **counterspell** (an instant with a `counter` effect), at least 4 mana sources, and some opponent holding cards: reserve its cost; or
- a **pump trick**, at least 3 mana sources, and a creature on the battlefield: reserve its cost.
The reserve is the cheapest such card's mana value. It is the same mechanism the control style already used (`reserve` in `aiBestPlay`); `tableReserve` only supplies a number when the old rule doesn't. It never holds with 7 or more cards in hand (it would discard). To avoid hoarding, every fourth consecutive turn it holds the *same* set of cards it spends the mana anyway (`P.holdRun`, `P.holdSig`). Counter: `holds`.

The held mana is what powers B on the opponents' turns (the lands stay untapped through their turn) and what lets `aiRespond` actually counter something.

**What it does (the reading side, "fear").** Also in the wrapped `aiChooseAttackersFree`: when the player being attacked shows mana (`showsMana`: 2 or more untapped mana sources and at least 1 card in hand), a small attacker (creature value 6.5 or less) that the old logic judged safe is held back if some untapped blocker wouldn't kill it, wouldn't die to it, but *would* kill it with +2/+2 (a typical trick). It doesn't apply to aggro styles, when the attack is lethal, or from turn 14 on (`stallTurn`, so boards don't freeze). Counter: `fear`.

**Known simplifications.** The bot reads open mana, not the opponent's actual hand, so a hand of lands scares it as much as a hand of tricks (that is the point of a bluff, and it works on bots and people alike). Mana held by *abilities* the bot activates later in the turn (`aiUseAbilities`) isn't accounted for.

## How to check it

- `node tests/suites/tablesense.js` (or `python3 tests/run_all.py tablesense`): 36 checks, one per habit and per switch, plus the duel guard.
- `node tests/lab.js --n 300 --conc 5 --kind commander --players 4` prints a "Table sense per game" line (answers put off, mana-up turns, tricks, combat removal, trick attacks, fear holds).
- A/B a habit on the same seeds: `--tune "patience=0"` turns it off for seat A only, so seat A's win rate against the 25% fair share is the measure. Turn it off for everybody with `--patch "AI_TUNE.patience=0"`.

## Not built (offered)

- **D, "stay quiet"**: a playstyle trait where a bot avoids being the top threat (holds back its biggest play, doesn't over-attack) until it can finish the game.
- Multi-turn sequencing (play the tapped land now so next turn has the mana), smarter mulligans, and the legend rule choice.
- Bluffing with **nothing** on purpose (leaving mana up on a turn the bot could have used it), and mana held for flash creatures at the end step.
- Using the same habits in duels (`AI_TUNE.duels = 1`; it needs the 2-player baseline re-saved).
