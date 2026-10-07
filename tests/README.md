# Spellslinger Duels tests

Run these before every commit that touches `Spellslinger_Duels.html`. **Nothing that passed may start failing**, and the number of cards that read as Automated may never go down.

```
python3 tests/run_all.py            # the usual run, about 10 minutes
python3 tests/run_all.py --quick    # a smoke test, about 3 minutes
python3 tests/run_all.py --full     # everything (Welcome Decks, Starter Kits, ~100 games), about 40 minutes
python3 tests/run_all.py engine     # only one suite (engine, storage, redraw, cards, coverage, games)
```

Results are also written to `tests/.out/*.json` (not committed).

## What is in here

| File | What it checks |
|---|---|
| `suites/engine.js` | About 60 rule checks on a hand-built board: combat (first strike, double strike, deathtouch, trample, lifelink, menace, flying), state-based actions (0 toughness, damage, legend rule, poison, commander damage, empty library), casting and paying, commander tax, equipment, targeting (hexproof, protection), and the Tyrox deck's special cards (exert, extra combat, Rabblemaster, Goblin Guide, Embercleave, spectacle, Temur Battle Rage). Every check starts a brand-new game. |
| `suites/storage.js` | Saved data: an old localStorage save is copied into IndexedDB (and left as a backup, and not copied again), a 12MB save works, a save made just before a reload is kept, and without IndexedDB the game falls back to localStorage. |
| `suites/redraw.js` | Redraws: an unchanged game table or shop floor keeps the same page elements and does no fitting, a change rebuilds only its zone, resizing refits, a half-typed shop price survives. |
| `perf.js` | Not a test: times a busy game table and a full shop floor redrawing (`node tests/perf.js`). On 2026-10-08: table 17 -> 8 ms, shop floor 12.6 -> 0.2 ms. |
| `suites/cards.js` | Card by card: for each card in a group it puts the card in hand, lets the AI play two turns, and checks that nothing throws, no card is in two zones and nothing is NaN. It also checks that the card reads as fully Automated. Groups: `verified` (every deck in `VERIFIED_DECKS`), `mirrodin`, `m10`, `welcome`, `starter`. |
| `suites/coverage.js` | Reads every paper card from `tests/data/cards_all.json` and counts Automated / Partly / Not yet, also for the 1,000 most-played Commander cards. Fails if any card that was fully Automated in `baseline_full_cards.txt` no longer is, and lists which ones. |
| `suites/games.js` | Whole AI-vs-AI games (`?autoplay`): Modern themes, boss decks at each AI level, Commander (EDHREC average decks), Welcome Decks and Starter Kits, the verified Commander decks, and 8-seat drafts. Checks every game ends and nothing is broken at the end. |
| `card_status.js` | A tool, not a test: `node tests/card_status.js "Card name"` says whether the game reads the card and which lines it does not understand. `--deck file.txt` lists every card in a pasted list that is not fully Automated. |
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
