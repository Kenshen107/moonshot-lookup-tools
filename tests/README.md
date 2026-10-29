# Spellslinger Duels tests

Run these before every commit that touches `Spellslinger_Duels.html`. **Nothing that passed may start failing**, and the number of cards that read as Automated may never go down.

```
python3 tests/run_all.py            # the usual run, about 10 minutes
python3 tests/run_all.py --quick    # a smoke test, about 3 minutes
python3 tests/run_all.py --full     # everything (Welcome Decks, Starter Kits, ~100 games), about 40 minutes
python3 tests/run_all.py engine     # only one suite (engine, storage, redraw, cards, coverage, rules, games)
```

Results are also written to `tests/.out/*.json` (not committed).

## What is in here

| File | What it checks |
|---|---|
| `lab.js` | **The test lab** (not part of `run_all.py`): plays hundreds or thousands of AI-vs-AI games with no network at all. Cards come from `tests/data/cards_all.json` (only the fully Automated ones, per `baseline_full_cards.txt`), decks are random Commander or Modern decks built from them, every game has a seed so it can be replayed, and games run back to back in one page with drawing and the zero-length waits turned off (about 0.4 s a game, 8 games a second with 4 pages). Reports win rates by seat, game length, how games ended, hung games (no result in 15 s), thrown errors and broken invariants. `node tests/lab.js --n 1000 --conc 4 --kind mix` (kinds: commander, modern, mix), `--la/--lb easy\|normal\|hard` set each seat's AI level, `--players 2-4` pods (with `--styles none\|random\|<style>`: a different playstyle per seat by default in pods, and wins by style in the report), `--compare file.json` checks every seed against a saved result, `--seed` the first seed, `--timeout` ms, `--replay 123 --kind commander` replays one game and prints its log and, if it hung, what state it stopped in. Compare two versions of the AI on the same seeds: `GAME_ROOT=/path/to/older/worktree node tests/lab.js --n 1000` against the current one. Needs `cards_all.json` once (`python3 tests/fetch_cards.py`, which does use Scryfall). Results of the last run: `tests/.out/lab.json`. |
| `suites/pod.js` | 3- and 4-player pods: seats, "each opponent" effects, commander damage per commander, elimination, turn order skipping players who are out, the opponent strip at three widths (screenshots `tests/.out/pod-*.png`), and the Play tab's Table chips. |
| `suites/aideckmix.js` | Where the computer's Commander decks come from (60% saved decks and Ready precons, 40% EDHREC). Offline: the deck builders are stubbed. Checks the roll, the pool, the fallbacks, no repeated commanders, and how `startMatch` seats the Surprise me opponent and pod seats. |
| `suites/uldaros.js` | The Uldaros Theorix deck: 59 in-play checks of its new mill, clone, Impending, rad counter, manifest and copy effects. |
| `suites/cmdr.js` | The Commander precons of FDC and FRC (and shared staples): 206 in-play checks of the `cmd` effects, spec triggers, phasing, goad, mana riders and so on. |
| `suites/soc.js` | The Strixhaven (SOC) and Marvel (MSC) Commander precons: 138 in-play checks (Prepared, Class levels, graveyard events, Auras, Pests, X spells, Vibranium, the monarch, copies...). |
| `suites/lab.js` | Runs the test lab inside the normal run: 300 two-player games that must equal `baseline_lab2p.json` (same winners, lengths, endings) and 40 four-player pods that must all finish. |
| `suites/engine.js` | About 60 rule checks on a hand-built board: combat (first strike, double strike, deathtouch, trample, lifelink, menace, flying), state-based actions (0 toughness, damage, legend rule, poison, commander damage, empty library), casting and paying, commander tax, equipment, targeting (hexproof, protection), and the Tyrox deck's special cards (exert, extra combat, Rabblemaster, Goblin Guide, Embercleave, spectacle, Temur Battle Rage). Every check starts a brand-new game. |
| `suites/storage.js` | Saved data: an old localStorage save is copied into IndexedDB (and left as a backup, and not copied again), a 12MB save works, a save made just before a reload is kept, and without IndexedDB the game falls back to localStorage. |
| `suites/rules-snapshot.js` | A fingerprint of how the card reader reads every card (effects, triggers, costs, keywords, statics). Fails and lists the cards whose reading changed in any way, even if they stay Automated. Lets code be moved around with proof that nothing changed; `--update` saves a new baseline when a change is meant to alter some cards. |
| `suites/precons.js` | The Precon Library (groups, Ready badges, filters, playing against a Ready and a not-Ready deck) and the Precon Circuit in Campaign (lanes, first-win and repeat prizes, ticks). |
| `precon_audit.js` / `precon_audit.py` | Tool, not a test: how many of the 553 precons are fully Automated and which cards unlock the most; `--write` saves `spellslinger/data/precon-ready.json`. |
| `suites/modes.js` | Game modes: an old save becomes Campaign/Shop's, Sandbox starts fresh and never leaks, each mode's tabs (desktop and phone), refused views, the saved mode, Campaign deck-value limits. |
| `suites/layout.js` | A crowded table and hand at 360, 768 and 1280px: no sideways scroll, hand inside its dock and clear of the turn bar, rows on screen; screenshots in `tests/.out/`. |
| `suites/redraw.js` | Redraws: an unchanged game table or shop floor keeps the same page elements and does no fitting, a change rebuilds only its zone, resizing refits, a half-typed shop price survives. |
| `perf.js` | Not a test: times a busy game table and a full shop floor redrawing (`node tests/perf.js`). On 2026-10-08: table 17 -> 8 ms, shop floor 12.6 -> 0.2 ms. |
| `suites/cards.js` | Card by card: for each card in a group it puts the card in hand, lets the AI play two turns, and checks that nothing throws, no card is in two zones and nothing is NaN. It also checks that the card reads as fully Automated. Groups: `verified` (every deck in `VERIFIED_DECKS`), `mirrodin`, `m10`, `welcome`, `starter`. |
| `suites/coverage.js` | Reads every paper card from `tests/data/cards_all.json` and counts Automated / Partly / Not yet, also for the 1,000 most-played Commander cards. Fails if any card that was fully Automated in `baseline_full_cards.txt` no longer is, and lists which ones. |
| `suites/games.js` | Whole AI-vs-AI games (`?autoplay`): Modern themes, boss decks at each AI level, Commander (EDHREC average decks), Welcome Decks and Starter Kits, the verified Commander decks, and 8-seat drafts. Checks every game ends and nothing is broken at the end. |
| `reader_audit.js` | A tool, not a test: compares the old regex reader with the token reader sentence by sentence over every paper card (Phase 2c). |
| `card_status.js` | A tool, not a test: `node tests/card_status.js "Card name"` says whether the game reads the card and which lines it does not understand. `--deck file.txt` lists every card in a pasted list that is not fully Automated. |
| `card_status_back.js` | A tool: `node tests/card_status_back.js "Card name"...` reads the back face (prepared spell, adventure, modal double-faced card) of each card. |
| `parse_try.js` | A tool: `node tests/parse_try.js sentences.txt` (one effect sentence per line) prints the effects the card reader makes of each, or NO. |
| `fetch_cards.py` | Downloads every paper card from Scryfall into `tests/data/cards_all.json` (about 40MB, not committed) for the coverage test. |
| `baseline.json` | What the tests expect today: the coverage numbers, and cards that are known not to be fully Automated yet (`knownNotFull`). Update it in the same commit that improves a number. |
| `baseline_full_cards.txt` | The names of the cards that read as fully Automated at the last baseline. |

## Setting up

- **Node and Playwright for Node.** In Claude's cloud environment Playwright is installed at `/opt/node22/lib/node_modules/playwright` and Chromium at `/opt/pw-browsers/chromium`; the tests find both. Elsewhere set `PLAYWRIGHT_MODULE=/path/to/node_modules/playwright` and `PW_CHROMIUM=/path/to/chromium`.
- **No web server is needed.** The tests answer the browser's requests for `http://spellslinger.test/...` straight from the repo's files (the sandbox's proxy also catches `127.0.0.1`, so a local server does not work there). Card pictures and fonts are blocked in the tests, which makes them much faster.
- **Network.** The tests call Scryfall, MTGJSON and EDHREC for real, through the proxy when `HTTPS_PROXY` is set. A rate-limited or dropped request is retried. Cards are cached in the test browser profile (`tests/.cache/`, not committed), so a second run is faster. Claude's cloud environment cannot reach `data.scryfall.io`, so `fetch_cards.py` pages through the search API instead (about 200 requests).
- **Test mode.** Tests that build their own board open the game with `window.__TEST` set. The served copy of the game is patched in memory (the repo's files are never changed) so that no turn starts by itself and `?autoplay` does not start its own background game. The patches are plain text matches in `lib/harness.js` (`patch()`) and are applied to every served `.html` and `.js` file, so they keep working now that the game is split into `spellslinger/*.js`; if code moves again, check that they still match.
- **Another checkout.** `GAME_ROOT=/path/to/older/worktree python3 tests/run_all.py engine` runs the same tests against another copy of the game, for example `git worktree add /tmp/old <commit>`. Use it to see whether a change broke something.
- Run suites one at a time: they share one browser profile (`TEST_PROFILE=name` gives a suite its own).

## Known problems the tests report

- **Chalice of the Void** reads as "Not yet", although CLAUDE.md says all of Mirrodin is Automated. It is listed under `knownNotFull` in `baseline.json` so the run passes; remove it from that list when the card is fixed.

## Political decks (2026-10-14)
`node tests/lab.js --players 4 --kind commander --themes random --n 800` seats six themed Commander decks (`L.THEMES`); `node tests/political_report.js` scores pods for fun (deals, betrayals, archenemy changes, talk, comebacks, length). Results: `docs/spellslinger-political-decks.md`. `G.pol` holds the counters.

`node tests/lab.js --decka list.txt` seats a fixed decklist ("N Name" lines, the commander in the last block, cards from the offline pool) at seat A against random decks.

## Lab v2: fast pods, data and tuning (2026-10-20)

- **Speed.** The engine's hottest helpers were rewritten (`allPerms()` keeps its list until a battlefield changes, `Rx`, `buffsOn`, `lostAbilities`): a 4-player game takes about 35% less time and 2-player results are identical (`suites/lab.js` checks that). Pages load once and take games from one shared queue (`--chunk 4`), so a slow game never leaves other pages idle. `--conc auto` uses every core (up to 6). About 2.3 four-player games a second on 4 cores; the 20 seconds at the start is the card reader loading about 14,500 Automated cards (no pictures are ever loaded).
- **`--profile`** prints where the time goes (per function and per file) and saves `tests/.out/lab.cpuprofile` for Chrome DevTools. Look here first when the lab feels slow.
- **Data.** Every game now records, per seat, casts, creatures and spells cast, lands, attacks, combat damage, creatures lost, turns as the table's target and a snapshot at the start of each own combat (turn, life, mana available, hand, creatures, board power, lands, players left), plus deck numbers (lands, average mana value, mana makers, card draw, removal), who was eliminated when, and split attacks. One game per line goes to `tests/.out/lab.jsonl` (`--out file` to move it). `--stats off` skips the collection.
- **`node tests/lab_report.js [file]`** (no browser, instant) reads that file: wins by seat, playstyle and AI level; **what separates winners from the others** (effect sizes over deck and in-game numbers); the mana curve of winners vs others; attack habits per playstyle; when players are knocked out; long games; commanders with 6+ games.
- **Random baseline.** `--levels normal,random,random,random` sets each seat's AI level (normal, hard, easy, random). `random` plays random castable spells, attacks with a random half of its creatures, blocks at random and picks a random target player: the floor the real AI has to beat. 2026-10-20 (200 pods): the normal AI seat won **49%** against three random seats (17% each; fair share is 25%), so there is a lot left to gain.
- **Sweeps.** `--sweep "PLAYSTYLES.aggro.atk=0.3,0.6,0.9"` plays the same seeds and decks once per value and prints one row per value (that style's win rate with a ± margin, median length, hung and stalled games, every style's rate); the value is restored afterwards. `--patch "code"` runs a statement in every page before the games (any global, e.g. `PLAYSTYLES.control.hold = 0.5`). Use at least 400 games per value: 100 games give about ±9 points.
- **`--maxturns N`** (default 150) ends a game that goes on too long and counts it as stalled instead of waiting for the timeout.
- **`--tune "key=value"`** (and `--sweep "tune.key=a,b,c"`) changes `AI_TUNE` numbers for seat A only (`holdShare`, `stallTurn`, `stallRatio`, `targetMode`, `ignoreArch`; `tn(P, key)` in `07b-playstyles.js`), so seat A's win rate against three default seats shows whether a change helps. 1,500 games per value gives about ±2 points.
- **`--decks ranked`** builds the lab's Commander decks from the 260 most played cards (EDHREC rank) in the colors instead of from every legal card: decks look like real ones, and popular cards find engine bugs fast (five hangs in 600 pods on 2026-10-20, all fixed). The default stays random decks so the saved baselines still apply.
- Hang reports now include the stack, mode and priority and any unhandled promise rejection (the usual cause of a game that stops with nothing pending). `--replay N` takes the same `--levels`, `--tune` and `--decks` options.
- **2026-10-20 findings.** The knobs we guessed at do not move results: `holdShare` (1 to 0.15), aggro attack eagerness (0 to 2.5) and who a player attacks (threat, weakest, revenge or the style default) are all within noise at 1,200-1,500 games per value. When a creature can attack, aggro, tokens and voltron already attack 97-99% of those turns; low attack counts come from not having creatures (control: able attackers on only 40% of its turns). The style win rates mostly follow the deck builder (random decks make low-curve Aggro and Spellslinger lists weak), so tune play with `--decks ranked`, and compare against the random baseline.
- **Ablation: which skill matters (2026-10-20).** `--levels r:atk,normal,normal,normal` makes seat A random in only some skills (`r:cast`, `r:atk`, `r:blk`, `r:def` for picking a target player, joined with `+`, e.g. `r:atk+blk`); `random` is all of them. Seat A against three normal AIs, 1,200 realistic pods each (fair share 25%, margin about ±2.4): normal 22.8%, random casting **24.3%**, random attacks 19.3%, random blocks 20.2%, random choice of who to attack 20.6%. So combat decisions are worth about 2-4 points each, and the order and choice of spells to cast is worth **nothing measurable**: the AI already casts everything it can afford (only about 1.3 mana is left untapped at the end of a turn, and a castable spell is left in hand on 3-18% of turns, mostly Control holding removal on purpose). Sweeps of the cast scores (`creatureBase`, `rockScore`, `equipScore`) and of how picky it is with removal (`thOff`) changed nothing either (1,200 games per value, all within 1 point). `lab_report.js` now prints the end-of-turn waste table (unspent mana, castable spells left, cards and lands in hand).


## Deck themes (2026-10-20)

`python3 tests/theme_names.py` (from the repo root, about 3 minutes, needs api.scryfall.com) fetches each deck theme's Scryfall query in EDHREC order into `tests/.out/theme_names.json` and `tests/data/theme_names.json` (both git-ignored). Then:
- `node tests/theme_audit.js`: how many of each theme's tagged cards the game fully plays.
- `node tests/theme_sweep.js group-hug politics ...`: the unread sentences that block the most cards of those themes.
- `node tests/lab.js --kind commander --players 4 --themes tagged --n 200`: a different tagged theme at every seat (`--themes tag:infect,tag:toxic,tag:proliferate,tag:group-hug` names them); the report adds "Wins by theme". Needs `tests/data/theme_names.json`.
- `node tests/suites/themes.js` (in `run_all.py`): the theme table and live builds (skipped when Scryfall can't be reached). `politics3.js` covers the group hug, kingmaking, goad and poison cards.
