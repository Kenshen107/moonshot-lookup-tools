# Spellslinger Duels overhaul plan

Status: **Phases 0, 1a, 1b, 1c, 2a (parse side), 2b and 2c done (2026-10-08); 3 onward not started** (written 2026-10-08 from the owner's request). Each step is meant to be one Claude session. Read this whole file before starting a step, do only that step, and don't merge until the owner says so.

## Owner's goals

Fix scaling issues, make the game table's layout stable, and divide the game into three modes:
- **Sandbox:** free testing.
- **Campaign:** progression.
- **Shop Simulator:** running the shop.

The owner also asked for the single file to be split into modules, and for the card reader to move away from the long `EFFECTS` regex list.

## Decisions the owner must make first

Ask about any that are still open before starting a step that depends on it. Record the answers here.

1. **Splitting the file.** CLAUDE.md says every tool is "a single self-contained `.html` file". Plain multiple files work on GitHub Pages with no build step and no framework, so the split is allowed only with the owner's OK. Update CLAUDE.md when it happens. Keep `Spellslinger_Duels.html` as the page address so links and bookmarks still work. *Answer: yes, split into several files (owner, 2026-10-08).*
2. **The card reader is migrated step by step, not rewritten in one go.** About 37% of all cards, and every finished set, deck and draft, depend on the current reader. *Answer:*
3. **What "Shop is separate from Campaign decks" means.** Pick one. *Answer:*
   - (a) One collection; only coins and win/loss records are kept per mode.
   - (b) Separate collections: a card opened in the Shop can't be played in the Campaign.
4. **Existing saves.** Proposed: Dustyn's and Ovid's current coins, cards and decks become their Campaign/Shop save, and Sandbox starts fresh. *Answer:*
5. **"Lock deck-building by campaign progress."** For example: only cards you own, only precons you've unlocked, or a deck-value cap per tier. The Campaign already has $50+ / $100+ value rules per tier. *Answer:*

## Rules every step follows

- **Testing:**
  - Run `tests/run_all.py` (from Phase 0) before every commit. Nothing that passed may start failing.
  - Coverage must never go down: the number of cards reading as Automated.
  - These stay at 100%: the Welcome Decks, Starter Kits, Mirrodin, Magic 2010, and the Sandman, Brudiclad and Gitrog decks.
- **Design rules:** keep the existing ones from CLAUDE.md:
  - design tokens for colors
  - no Moonshot branding, and no links to or from the other tools
  - no new features without the owner's approval
  - Wizards' Fan Content Policy notice in the footer
- **Branch and merging:** commit and push to the working branch, open no PR, and merge only when the owner asks.
- **Notes:** update CLAUDE.md (or `docs/`) with what changed, in the same plain style.

## Phase 0: Set up so other sessions can work safely (first)

**Phase 0 result (2026-10-08):** the old test scripts could not be added, because they were lost with the sessions that wrote them (they only lived in temporary folders). `tests/` was rebuilt from scratch instead: see `tests/README.md`. It has about 60 engine rule checks, a card-by-card test (verified decks, Mirrodin, Magic 2010, Welcome Decks, Starter Kits), a coverage measurement with a baseline of which cards read as Automated, AI-vs-AI games, `run_all.py`, `fetch_cards.py` and `card_status.js`. The numbers in the old suites (66, 40, 36 ...) no longer apply. The history sections were moved to `docs/spellslinger-history.md` and CLAUDE.md went from about 150KB to about 100KB. Findings: Chalice of the Void reads as Not yet although CLAUDE.md said all of Mirrodin was Automated (listed in `tests/baseline.json`); the older alternative-cost cards (Force of Negation, Snuff Out) never check their "if" condition (noted in the history file).

Until now the test scripts lived only in a temporary scratch folder, not in the repo. A new session can't tell whether it broke something without them. They're Python and Playwright, with JS check files.

1. Add them under `tests/`:
   - **Rule-check suites:** Mirrodin (66), Magic 2010 (66), Gitrog (40), Sandman (36), Brudiclad (43), top-1000 (47, 43, 60), Starter Kits (44), audit (43).
   - **Card-by-card tests:** Mirrodin, Magic 2010, Welcome Decks, Starter Kits, and the three Commander decks.
   - **Coverage checks:** Welcome Decks, Starter Kits, and the all-cards measurement for `CARD_COVERAGE`.
   - **Game runs:** autoplay and the 8-seat draft runs (`?autoplay&format=draft&set=...`).
   - **Card status:** the "which line isn't read" tool.
2. Add `tests/run_all.py` to run them all, and `tests/README.md` explaining:
   - start a local server: `python3 -m http.server 8974 --bind 127.0.0.1` in the repo root
   - Playwright uses the installed Chromium at `/opt/pw-browsers/chromium`
   - use the proxy settings when Scryfall or MTGJSON is needed
3. Add `tests/fetch_cards.py`. It downloads Scryfall's oracle-cards bulk data and writes the slim all-cards file the tests use (about 39MB). Don't commit the data file; add it to `.gitignore`.
4. Shorten CLAUDE.md: move the long round-by-round history ("Rules round 2-6", the Welcome Decks, Starter Kits, top-1000, owner's decks, Mirrodin and Magic 2010 rounds) into `docs/spellslinger-history.md`. Keep the rules, data sources, key function names and a pointer. Every session reads CLAUDE.md, so this saves tokens on every session.

**Done when:** `tests/run_all.py` passes on the current code.

## Phase 1: Split the file, without changing behavior

### 1a: Mechanical split

Cut the existing script into files in the order it runs now, as plain `<script src>` files. Don't use JavaScript modules: module scope would hide the shared global names (`G`, `profile`, `CARDS` and many functions) that every part uses.

- `Spellslinger_Duels.html`: the shell and containers, at the same address
- `spellslinger/styles.css`: all CSS
- `spellslinger/api.js`: `sfFetch`, Scryfall card loading and the card cache, MTGJSON (packs, precons, `DeckList`, `SetList`), EDHREC
- `spellslinger/state.js`: accounts, profiles, `saveProfile`, collection and copies, shop and distributor data
- `spellslinger/parser.js`: `rulesFor`, `parseEffects`, `EFFECTS`, `TRIGGERS`, `parseActivated`, `parseCond` / `buildCond`, `countFn`, `cardFits`, `permMatches`
- `spellslinger/engine.js`: turns, stack, priority, combat, `damage`, `sba`, `applyEffect`, `applyChoiceEffect`, triggers (`fire`, `settle`)
- `spellslinger/ai.js`: `aiBestPlay`, `aiPickTarget`, `scoreEffects`, attacks and blocks, `aiTurn`
- `spellslinger/draft.js`: the booster draft
- `spellslinger/shop.js`: shop, distributor, grading, pack reveal
- `spellslinger/app.js`: views, rendering, the game table, popups, deck builder, play-by-play

**Done when:**
- every test passes unchanged
- the page loads with no errors on desktop and phone
- an existing save still loads

Update the test harness if it loads the page differently.

**Phase 1a result (2026-10-08):** done as a pure cut, with no code moved or edited. `Spellslinger_Duels.html` keeps the markup (338 lines); `spellslinger/styles.css` has the CSS; the script became `spellslinger/01-core.js` to `16-startup.js`, cut at the section banners the code already had and kept in its original order (the joined files are byte for byte the old script). The files are therefore named by what each section holds, not by the plan's list (`api`, `state`, `parser`, `engine`, `ai`, `draft`, `shop`, `app`): the old script mixes those topics (for example the trigger code sits after the shop), and regrouping them means moving code, which is for Phase 2a and later. Checked: `tests/run_all.py` passes, the page loads with no errors at 1280px and 390px, and a save made by the old single-file version loads with the same coins, cash and decks.

### 1b: IndexedDB storage

The game reads the profile instantly in hundreds of places, so don't make every read async.

- Load everything from IndexedDB once at startup into memory. Keep reads in memory, and save to IndexedDB in the background. A tiny wrapper is enough; no library is needed.
- One-time move: copy the existing `duels:*` save keys from localStorage into IndexedDB, and keep the old keys as a backup until a later cleanup.
- Move the card cache (`duels:cards`) first, since it's the part that hits the 5MB limit.
- Keep the current save-failure handling (`saveProfile`, `trimCardCache`) as a fallback when IndexedDB isn't available, such as some private windows.

**Done when:** an old save loads correctly, a large collection saves and reloads, and the tests pass.

**Phase 1b result (2026-10-08):** `spellslinger/00-storage.js` replaces the `store` object. All saved values (profiles, accounts, the card cache and the MTGJSON caches, settings) are in IndexedDB, loaded into memory once before the game's scripts run (`loadGame` in the HTML adds them after the load), so every `store.get` is still synchronous. Writes are queued and sent in the background. On the first run the old `duels:*` localStorage keys are copied across and left as a backup; if IndexedDB is unavailable the game uses localStorage as before. The card cache was not moved first, because every key moved together. New suite `tests/suites/storage.js` (18 checks): migration from a real old-style save, no second migration, the localStorage backup untouched, a 12MB save, removal, a save made right before a reload, and the fallback. Not done: deleting the old localStorage keys (a later cleanup), and syncing two open tabs.

### 1c: Faster redraws (only where it matters)

Don't rewrite all the `.innerHTML` code; it's safe as long as text goes through `esc()`. Change only the parts that redraw constantly, so they update just what changed:
- the game table (`renderGame`, `sideHTML`, the hand)
- the shop floor's one-second refresh

**Done when:** the tests pass, and a long game and a shop day feel no slower.

**Phase 1c result (2026-10-08):** `setHTML` (skip a redraw whose HTML is unchanged) is used for the game table's six zones and the shop floor's panels, and `fitTable` runs only when something changed or the window changed. Measured with `tests/perf.js` (24 creatures, 14 lands and 12 cards in hand a side; a case of 40 cards): table redraw 17 ms to 8 ms, shop floor 12.6 ms to 0.2 ms. A side effect is that a half-typed price in the shop no longer loses focus. The remaining 8 ms of a table redraw is building the HTML (the hand's "can I cast this" checks are the biggest part); it wasn't changed, because caching those checks risks showing a card as castable when it isn't. New suite `tests/suites/redraw.js` (13 checks).

## Phase 2: Card reader, migrated gradually

### 2a: Move special-case rules into their own files

The code already marks them with comments: "Mirrodin (2026-10-08)", "Magic 2010 (2026-10-08)", "Gitrog deck", "Brudiclad deck", "Sandman deck", "Starter kits (2026-10-06)", "Top-1000 round 2", "Welcome decks".

- Each becomes a file such as `spellslinger/rules/mirrodin.js` that registers its wordings, triggers, per-line rules and effect handlers through one `registerRules({...})` function.
- The core reader keeps only the general rules.

**Done when:** coverage numbers and every test match exactly what they were before.

**Phase 2a result (2026-10-08, the parse side):** the round-specific wordings moved out of the card reader into `spellslinger/rules/*.js` packs: 11 `EFFECTS` blocks and 5 `TRIGGERS` blocks (data entries) and 14 blocks of `rulesFor`'s line loop (converted to functions with a small context object, found with the TypeScript parser and checked mechanically). `02-card-reader.js` went from 1,772 to about 750 lines. A new safety net, `tests/suites/rules-snapshot.js`, fingerprints how all 34,142 paper cards are read; after the move not one card reads differently (a first attempt did change 168, and the snapshot named them: a `lines:` block had been attached to the wrong pack). **Not moved:** the `applyEffect` cases (about 270 of them), the AI scoring cases, the `parseCond` additions and the sentence rewrites at the top of `parseEffects`. They don't stand in the way of Phase 2b (that is about reading text), the comment markers for them aren't reliable about which round a case belongs to (the Tyrox marker, for one, covers cases of other rounds after it), and moving them is a long, mostly cosmetic change. Do it later if wanted, case by case, using the snapshot and the card-by-card tests.

**Phase 2b result (2026-10-08, first slice):** `spellslinger/02b-token-reader.js` reads a "target ..." phrase by pieces (`parseTargetPhrase`: types, non-types, colors, attacking/blocking/tapped, you/opponent controls, power/toughness/mana value limits, with/without a keyword) into a filter object carried as the string `sf:<json>`, which `permMatches` hands to `structMatch`. Shapes: destroy / exile target X, return target X to its owner's hand, and ~ deals N damage to target creature X. It runs **only after every regex in `EFFECTS` failed** (hook in `parseEffects`), so no card that was read before reads differently: the snapshot showed 131 changed cards, all previously-unread ones, and coverage went 12,250 -> 12,350 Automated with none lost. Baselines updated; an engine check proves Cast Down only targets the nonlegendary creature. **Not done yet (2c):** draw / gain / lose N, create tokens, counters and pump shapes, and promoting the new reader ahead of the old regexes (then deleting regexes it fully covers).

### 2b: A token-based reader for the most common shapes

It splits a sentence into its parts (action, amount, target with filters, condition) and handles the common shapes:
- deal N damage to TARGET
- destroy / exile / return TARGET
- draw / gain / lose N
- create tokens
- counters
- pump effects

It runs before the old regex list, and the old list stays as the fallback.

### 2c: Measure after each batch

Rerun the coverage measurement and the card-by-card tests. The Automated count must not drop. Remove a regex rule only when the new reader handles every card that used it; the coverage tool lists exactly which cards those are.

**Phase 2c result (2026-10-08):** coverage and the card-by-card tests were rerun after each batch (12,250 -> 12,380 Automated, none lost; Home's `CARD_COVERAGE` now shows 12,380 of 34,142). A new tool, `node tests/reader_audit.js`, compares what the old regexes and the token reader make of each of 38,391 distinct sentences on paper cards. They overlap on only 266 sentences (the old list is far wider: 1,192 sentences only it reads, 63 only the token reader), and on those they agree on 264; the other 2 are old card-specific rewrites (Parting Gust, Teferi's Time Twist). 25 of the 27 overlapping regexes are fully covered. **Decision: no regex was removed.** The old regexes give creature targets as `target: 'creature'` while the token reader gives `'perm'` with a filter, and the AI's target scoring and the engine's picker treat those differently, so deleting them would change play for cards that read fine today. If the owner wants the old list thinned later, do it by making the token reader emit the same shapes first, then delete one regex at a time with the snapshot as proof.

## Phase 3: Table layout fixes

1. **Z-index scale.** Put every layer in tokens on `:root`, then replace the hard-coded numbers. Example names: `--z-board`, `--z-table-ui`, `--z-hand`, `--z-act-banner`, `--z-peek`, `--z-sheet`, `--z-modal`, `--z-jackpot`, `--z-cover`, `--z-toast`.
   - Today's values: deck builder bar 20, the play-by-play panel (`act-banner`) 60, card preview and playtest menu 70, phone sheets 80, popups 90, jackpot 92, confetti and one-device cover 95, toasts 100.
   - Also check stack items and the in-game choice panels (`askYes` / `askNumber`).
2. **Hand.** Rework `fitHand` and the hand-dock CSS:
   - overlap grows with hand size
   - the hand never goes past its container or covers the action bar
   - the card under the pointer pops above the others

   Test 7, 12 and 20 cards at 360px, 768px and 1280px wide.
3. **Board.** Rework `fitTable` / `fitSide` and `.lane.creatures.crowded`:
   - use grid or flex with a minimum readable card width, and cascade instead of overflowing
   - keep land piles (`groupPerms`) inside their row

   Test 20+ creatures, 15 lands, and Auras and Equipment attached.

**Done when:** screenshots at each width show nothing clipped or overlapping, with:
- the play-by-play running
- a choice panel open
- three items on the stack

## Phase 4: Three game modes (after the owner's decisions 3-5)

- **Mode switch:** a top-level picker, Sandbox / Campaign / Shop Simulator, saved per player. Each mode shows only its own tabs on the desktop tab row and the phone bottom bar (`MORE_VIEWS` / the bottom nav).
- **Sandbox:**
  - **Tabs:** Packs, Decks, Play (themes, Commander, Welcome Decks, friend on this device), Draft, Playtest, Rules.
  - **Its own save.** Its coins and win/loss records never count toward Campaign or Shop.
  - **Test buttons:** the test-build buttons (＋ Add coins, ＋ Add cash, Start over) move here.
- **Campaign:**
  - **Contents:** the map (`CAMPAIGN_TIERS`, `campaignNodes`, `campaignProgress`) and the precon opponents.
  - **Deck rules:** deck-building rules follow campaign progress (decision 5).
  - **Records:** wins and coins are kept for this mode.
- **Shop Simulator:**
  - **Contents:** the Shop, Distributor, Stockroom and Grading, plus the day loop with rent.
  - **Inventory:** the case and bulk bin stay apart from playable decks. Cards in the case already leave the collection; under decision 3 option (b) the Shop also gets its own collection.
- **Saves:** apply decision 4 to existing players, in both IndexedDB and memory.

**Done when:** a game or action in each mode changes only that mode's save. Test by comparing the saves before and after.

## Ready-to-paste prompts (one session each)

- **Phase 0:** "Read docs/spellslinger-overhaul-plan.md and do Phase 0 only: add the test suites under tests/ with run_all.py, a README and fetch_cards.py, and move the history sections out of CLAUDE.md into docs/spellslinger-history.md. Don't change game code. Run the tests, commit and push. Don't merge."
- **Phase 1a:** "Read docs/spellslinger-overhaul-plan.md and do Phase 1a only: split Spellslinger_Duels.html into the listed files as plain scripts in the same order, with no behavior changes. tests/run_all.py must pass, and check a page load on desktop and phone. Update CLAUDE.md. Commit and push. Don't merge."
- **Phase 1b, 1c, 2a, 2b, 2c, 3 and 4:** the same pattern. "Read the plan, do step X only, run tests/run_all.py, update the notes, commit and push, don't merge." For Phase 4, first check that decisions 3-5 are answered in this file.
