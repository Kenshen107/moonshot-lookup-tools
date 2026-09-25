# Moonshot Lookup Tools

Staff tools for Moonshot Games, used at work in both stores (Noblesville and Plainfield). Each tool is a single self-contained `.html` file with no build step. They call Scryfall's public API directly from the browser. Changes merged to `main` go live on GitHub Pages.

## Rules

- **Price and market tools are allowed** (the owner lifted the old no-speculation rule on 2026-09-25). Spike alerts, price trends, reprint warnings and trending cards are all fine. Always show where the numbers come from and how current they are, so staff know what they're looking at.
- **No new tabs, tools, or features without the owner's approval.** Build what was asked. If something extra seems useful, suggest it and wait for a yes before building it.
- **Don't remove or rework existing features without asking first.**
- **End every reply with these links**, so the owner always has them:
  - Branch: `https://github.com/Kenshen107/moonshot-lookup-tools/tree/<the branch you're working on>`
  - Main: https://github.com/Kenshen107/moonshot-lookup-tools/tree/main
  - Live site: https://kenshen107.github.io/moonshot-lookup-tools/MTG_Lookup_Tool.html
  - Live site (fresh copy): the live-site link plus `?v=<date and time, e.g. 202609231245>`. Use a new value every reply so the browser can't serve a cached copy.

## Working in this repo

- Keep each tool a single self-contained HTML file. Don't add frameworks, build steps, or a backend. The one exception is the daily market data job (see below), which the owner approved on 2026-09-25: it only produces data files, and the HTML stays a single file.
- In `MTG_Lookup_Tool.html`, tabs are driven by the `APP_VIEWS` table (each entry has an icon, a menu label and a one-line description). `NAV_GROUPS` puts every tool except Card Lookup into one of three groups (At the counter, Rules & events, Learn & train); the desktop menu bar, the phone bottom bar and the quick-jump search (`/` or Ctrl+K) are all built from these two tables. `QUICK_JUMP_EXTRAS` adds sub-tabs and sections to quick jump. The Buyer's Guide and Grading tabs use sub-tab tables (`BUYERS_GUIDE_SUBTABS`, `GUIDE_SUBTABS`). Reuse the existing helpers (card tiles, the card popup, the Moonshot store links `moonshotLinkHTML` / `moonshotBlockHTML`, `fetchScryfallSearchPage`) instead of writing new copies.
- Moonshot stock isn't checked live. Shopify doesn't let other sites read the store, and the free CORS relays that worked around that were unreliable, so the tool links to moonshotgamestore.com's own search instead. Don't bring back third-party relays. A live check would need a Shopify Storefront API token from the store admin.
- Scryfall search queries (otags especially) can't be guessed reliably. Mark anything not checked against live results as unverified or approximate, as the land-cycle data already does.
- Claude's cloud environment can reach `api.scryfall.com`, so check new or changed Scryfall queries against live results before shipping them. The Land Finder's fixed cycles use exact card-name lists (`LAND_CYCLE_CARDS`), checked live on 2026-09-24.

## Products tool (`MTG_Lookup_Tool.html`)

Sealed product data (what's in each box, bundle, deck and kit) comes live from MTGJSON (`mtgjson.com/api/v5/SetList.json.gz`, which browsers can read directly). Commander decklists come from the per-set files (`<CODE>.json.gz`), loaded only when a decklist is opened. Photos come from TCGplayer's image CDN via each product's `tcgplayerProductId`. Buy-a-Box and Bundle promos come from Scryfall. Nothing is hand-maintained, so new sets show up on their own.

## EDHREC data (`MTG_Lookup_Tool.html`)

Commander play data comes live from EDHREC's JSON feed (`json.edhrec.com/pages/...`, which browsers can read directly). EDHREC has no official API, so every EDHREC panel is optional. If a page is missing or the feed changes, the panel shows nothing and the rest of the app keeps working. Always credit EDHREC with a link, as the panels already do. EDHREC's trend data (such as its weekly top commanders) may be used. Don't use EDHREC's prices. Prices come from Scryfall at the cheapest paper printing (`cheapestPrintings`, which uses `prefer:usd-low`).

- **Card Lookup:** "Commander play" shows how often the card is played and the commanders that play it most. For commanders, "Build around this commander" shows the bracket split, themes, card lists, similar commanders, and EDHREC's budget deck priced at the cheapest copies.
- **Card popup:** "Build around this commander" opens Card Lookup with that guide expanded.
- **Products:** "Upgrade this deck" on precon decklists shows the most-played and best-synergy cards for the deck's commander that aren't in the precon.
- **Brackets tab:** the card checker, and the deck checker when the list has a Commander heading or tag, show which bracket EDHREC players build that commander at.
- **Land Finder (Buyer's Guide):** a three-step guide. (1) Start from a commander or pick colors, (2) choose how many nonbasic lands to buy, (3) pick a Good / Better / Best package (`LAND_TIERS`), or type a custom budget. For Commander, lands are ranked by EDHREC's land page for the color identity (`EDHREC_LAND_PAGES`, all 32 checked 2026-09-25). With a commander, its own decks' land lists count first, and step 2 suggests its average nonbasic land count. Better and Best skip lands that always enter tapped unless nothing else fits. Popular EDHREC lands that no cycle search finds are added as "Other popular land". Other formats keep Scryfall's popularity order and show no EDHREC numbers.

## Market data and Market Watch (`MTG_Lookup_Tool.html`)

Scryfall only has today's prices, so price history comes from a GitHub Action (`.github/workflows/market-data.yml`) that runs twice a day, at 13:23 and 20:47 UTC. It runs twice because GitHub skips or delays scheduled runs on busy hours, and MTGJSON's daily prices land at varying times; a run on unchanged prices is harmless. It can also be started by hand (workflow_dispatch). It runs `tools/build_market_data.py`, which downloads MTGJSON's 90-day price history (`AllPrices.json.gz`) and its card, ID and legality CSVs, then publishes small JSON files to the `market-data` branch. The branch is replaced each run, one commit with no history, so the repo doesn't grow. The site reads the files from `raw.githubusercontent.com/Kenshen107/moonshot-lookup-tools/market-data/` (`MARKET_DATA_BASE`). If they're missing, every panel that uses them says so, and the rest keeps working.

- `meta.json` holds the price date, the weekly dates and the daily dates.
- `history/<first 2 chars of Scryfall id>.json` holds TCGplayer market prices per printing and finish, for printings that reached $1: 14 weekly points (`n`, `f`, `e`, about 90 days) and 31 daily points for the last 30 days (`dn`, `df`, `de`, added 2026-09-25). Other stores for the same printing: `ck<f>` / `mp<f>` hold Card Kingdom / Mana Pool retail as [now, 7 days ago, 30 days ago], and `kb<f>` holds Card Kingdom's buylist as weekly points. A store price more than 2 days old counts as not listed. Read it with `priceHistoryFor(id)`, `finishHistory(history, key)`, `priceTrend(points, steps)` and `priceTrendDays(fh, days)`. The last one uses the daily points when they exist and falls back to weekly.
- `spikes.json` lists printings of $2+ that rose at least $1 and 15% over 1, 3 or 7 days, with Card Kingdom and Mana Pool retail for the same printing (`ck`, `mp`: [now, 1, 3, 7 days ago]).
- `buylist-spikes.json` lists printings Card Kingdom's buylist pays $1+ for, up at least $0.50 and 15%, and higher than a week ago (their buylist often dips and comes back). Capped at 3,000.
- `bans.json` holds the current banned/restricted cards per format, plus a log of changes found by comparing against the previous run. The log starts empty; tracking began 2026-09-25.

Where the data is used:

- **Market Watch tab** (`MARKET_SUBTABS`, under At the counter):
  - Price Spikes. A "Show" dropdown switches between retail price jumps (TCGplayer) and Card Kingdom buylist increases. Filters cover window, jump range, current price range, finish and promos, plus "Hide cards from before 2003" (on by default, using Scryfall's set release dates) and, for retail, "Only if another store is up too" (on by default). That last filter keeps a jump only when Card Kingdom or Mana Pool raised the same printing 10%+ over the same window and that store's price is within 2× of TCGplayer's; each confirming store shows a ✓ badge. It uses ranges rather than "at least" because old, thinly traded cards swing by big dollar amounts and would fill an "at least" list.
  - Ban Watch (ban log, with EDHREC decks and commanders affected and price trend).
  - Trending Commanders (EDHREC `commanders/week`, with each commander's most-used cards priced).
  - New Set Tracker (EDHREC `sets/<code>`, the set's most-played new cards and commanders).
  - Pulled by New Sets (`MKT_PULLED_*`): the older cards a new or upcoming set's commanders pull into decks. It covers upcoming sets (EDHREC tracks previewed cards before release) and sets released in the last 90 days. For the set's 15 most-built new commanders it reads each commander's EDHREC page and keeps cards those decks play at least 15 points more than other decks (EDHREC's synergy). It leaves out the set's own cards, basic lands and EDHREC's 100 most-played staples (`top/year`). "New decks" is the card's share of each commander's decks times that commander's deck count, added up. The default sort, "Most tied to the new set", multiplies that by the card's best synergy so niche pieces rank above generic ones like shock lands. Rows show the driving commanders, the cheapest copy, and a 30-day trend from the market data. It all runs in the browser; no data job changes.
- **Card Lookup:** the price panel's "Other stores" table shows what Card Kingdom and Mana Pool sell the printing for, and what Card Kingdom pays (its buylist), each with a 30-day change. "Price movement" in the price panel charts the printing on screen for each finish (a 30-day daily or 90-day weekly toggle), with its price range and 7/30/90-day changes. The All Printings table has a "30 days" column, filled in as each printing's history loads.
- **Buylist:** typing a card name shows its 30- and 90-day trend at the cheapest printing. A move of 15% or more gets an "offer lower" or "don't offer too little" note. It also shows what Card Kingdom pays for that printing, with its 30-day trend, as a benchmark. A printing in the last 45 days, or an upcoming one (Scryfall includes previewed cards), shows a reprint warning. Values are still typed by hand.
- **Products:** "Box value: open it or sell it sealed?" computes each booster type's expected card value from MTGJSON's booster sheets and today's Scryfall prices. It shows the total, a "sellable" figure (cards $1+), chase cards, and a comparison against a sealed price staff type in. There's no free source for sealed prices or their history, so there's no sealed trend.
- **Buyer's Guide → Price a Deck:** a pasted list is priced at the cheapest copies, with the total, a 30-day trend per card and a count of rising cards.

## Prerelease tab (`MTG_Lookup_Tool.html`)

The 🎟️ Prerelease tab (under Rules & events, `PRERELEASE_SUBTABS`) works on one set at a time. The set picker lists every set MTGJSON has a prerelease kit for (`subtype: 'prerelease_kit'` in SetList, loaded with `loadProductsData`; Return to Ravnica, 2012, onward), so Masters sets and Mystery Booster Commander, which have no prerelease, stay out. Scryfall expansions and core sets from 120 days back to 120 days ahead are listed too, in case MTGJSON hasn't added a new set's kit yet or can't be reached. It's grouped: Coming up, Out now (last 120 days), and Older sets (for running a prerelease with leftover kits). New sets appear on their own, and sets move to Older after 120 days. It defaults to the next upcoming set; a link can choose the set with `?set=<code>`.

- **Mechanics & Rulings:** for quick judge calls. It shows each mechanic with a plain-English explanation, key rulings and every card that uses it, plus a lookup for any card in the set. Card text comes live from Scryfall. Scryfall only adds official rulings at release, so they appear automatically from release day on. Before that, the hand-written notes in `PRERELEASE_SET_NOTES` cover them. Every set's own mechanics are also found automatically (`prereleaseMechanics`):
  - **What counts:** any non-evergreen keyword on 3+ of the set's cards (`EVERGREEN_KEYWORDS`, `PR_KEYWORD_SKIP`), plus card types that work like mechanics (`PR_MECHANIC_TYPES`: Adventure, Saga, Class, Case, Room, Battle, Spacecraft).
  - **Cycling family:** it's sorted per card (`prCardMechanicKeywords`), so a Forestcycling card counts as Landcycling, not Cycling.
  - **New vs Returning:** set by asking Scryfall how many paper cards had the mechanic before the set's release date. 3 or fewer (`PR_NEW_MECHANIC_MAX_PRIOR`) counts as New, because previews and promos sometimes print one early. New mechanics come first, then the rest by card count.
  - **Explanations:** `PR_MECHANIC_GLOSSARY` (plain English for common and recent mechanics, written with N where the number varies), else the most common reminder text on the set's cards. Ability words without reminder text (Celebration, Eerie) use the condition part of the card text.
  - **Checked on 2026-09-25** against FIN, KTK, MOM, WOE, DSK, BLB, OTJ, LCI, NEO, ONE, DMU, SNC, TDM and FRA. Add glossary entries for new sets' mechanics when the reminder text is card-specific.
- **Hot Cards:** the set's most-played new cards (EDHREC `sets/<code>`), plus the older cards its commanders pull in (the same data as Market Watch → Pulled by New Sets), priced at the cheapest copies.
- **Sealed Helper:** players tap the cards they opened; the − on a tile (or in the pool list, which starts open) takes one out. The pool is saved in the browser (`prSealedPool:<code>`). It counts each color's cards, creatures, removal, interaction, protection, draw, ramp and rares (plus evasive creatures for the suggested pair), suggests the best two colors, and splits 17 lands by mana symbols.
  - **What each card does** comes from Scryfall's community card tags (`PR_ROLE_TAGS`, loaded per set by `loadPrereleaseRoleTags`): removal = `creature-removal` minus `bounce`; interaction = counterspell, bounce, tapper, discard; protection = `protection` or `protects-creature`; draw = `card-advantage` minus `loot` and `rummage` (cycling-only cards are dropped too); ramp = `ramp`. They work for any set, including new mechanics (e.g. Lander tokens), and were already filled in for Reality Fracture a week before release. A card also counts for removal, interaction or draw when its text matches the pattern (`PR_REMOVAL_RE`, `PR_INTERACTION_RE`, `PR_DRAW_RE`), since those rarely misfire. For a role with no tags in the set yet, the patterns alone are used (plus `PR_PROTECTION_RE` and `PR_RAMP_RE`), and the page says so. Evasion = Flying, Menace (and similar keywords) or "can't be blocked".
  - The patterns were scored against the tags across ten sets (WOE, MKM, OTJ, BLB, DSK, FDN, DFT, TDM, EOE, FRA) on 2026-09-25 (right when they fire / share of tagged cards found): removal 98% / 78%, draw 98% / 66%, interaction 88% / 72%, ramp 87% / 65%, protection 82% / 62%. If you change a pattern, rerun that check.
  - **Pair scores** (`PR_PAIR_WEIGHTS`) follow the usual sealed priorities: BREAD (Bombs, Removal, Evasion, Aggro, Duds) and Draftsim's sealed guide (bombs, removal, fixing, curve, creatures, card advantage, then tricks and interaction). Each playable counts 1, plus rare/mythic 1.5 (the likeliest bombs), removal 1.5, evasion / ramp / draw 0.5 each, and interaction / protection 0.25 each. The page states the weights.
  - Warnings: fewer than 22 playables, fewer than 13 creatures (most decks want 15-17), or fewer than 4 cards costing 2 or less. Curve advice follows Frank Karsten's sealed template (about four 2-drops, five 3s, three 4s and three 5+, with 17 lands).
- **Deck-Building Card:** a handout printed 4 per letter page. Each card is exactly a quarter sheet (4.25in × 5.5in), printed with no page margin so the dashed cut lines are the page's center lines, with 0.2in padding to keep text off the printer's unprintable edge.
  - **One universal card for every set** (owner's choice, 2026-09-25). Only the set name in the header and the QR link change. `defaultPrereleaseCardHTML` holds:
    - the 40/17/23 recipe, the 4 build steps and the splash tip
    - "Playing your games" (5 play tips)
    - "Good to know" (shuffle and offer a cut; call a judge), next to a small QR code to the set's Mechanics & Rulings page (`?set=<code>#prerelease/mechanics`, from api.qrserver.com)
    - the "just tips" line
    - the footer: "Use while building - put it away during games." plus the store line
    - Wizards' full Fan Content Policy notice (`PR_FAN_CONTENT_NOTICE`, titled "Moonshot Prerelease Guide")
  - **It no longer uses** `PRERELEASE_SET_NOTES` card lines or the theme table. The themes still feed the Sealed Helper.
  - **Fan Content Policy:** always keep the full notice. Never add Wizards logos, card art, set symbols or mana symbol art, never say "official", and hand the card out free.
  - **Tournament rules:** keep the "put it away during games" line, because players can't use outside notes during games.
  - **Editing:** the preview can be edited by clicking. Edits are saved in the browser (`prDeckCardV2:<code>`; the v2 key drops edits made to the old set-specific card), and "Reset to default" undoes them.
  - **Sizing:** `fitPrereleaseCard()` sets the text to the largest size that fits (the card's styles are in em), so the card always fills its quarter page, even after edits.
  - **Printing:** the print sheets use a named `@page prsheet` with no margin, so printing other pages keeps normal margins.
- **Table QR:** a sign, 2 per page (each half the page), linking to `?set=<code>#prerelease/mechanics`. The QR image comes from api.qrserver.com (goqr.me).
- Printing goes through `printPrereleaseSheet()`, which builds `#prPrintArea`, hides everything else with print CSS, and removes it afterward.

**Theme table (`PRERELEASE_PAIR_THEMES`):** the color-pair themes for every set from Zendikar Rising (2020) on, plus Khans of Tarkir. They were written from the archetype sections of Draftsim's draft and sealed guides on 2026-09-25. Keys are color pairs (`WU`); three-color sets list their clans or families (`WBG`). Sets with only five archetypes (Strixhaven, Spider-Man, The Hobbit…) list five. The Sealed Helper's "This pair's plan" reads it (the printed card is universal and doesn't), and `PRERELEASE_SET_NOTES` themes take priority when a set has both. Sets from before 2020 (other than KTK), plus IKO, M21, CLB and Star Trek, aren't in it yet. **Add every new set** from Draftsim's `mtg-<code>-draft-archetypes` article (usually out before the prerelease) or its sealed guide. A monthly Claude routine (the 2nd of each month, 8:48am Indiana time) does this automatically. It finds upcoming and recent sets missing from the table, adds their themes (and glossary entries for new mechanics whose reminder text is card-specific), and opens a PR for the owner to approve. If Draftsim hasn't posted yet, it just reports which sets are still waiting.

**For each new set,** add an entry to `PRERELEASE_SET_NOTES`:
- mechanics: `match`, `text`, `rulings`, `isNew` (the `cardName` / `card` lines are no longer used, since the handout is universal)
- `themes` for the 10 color pairs
- `kit`
- `checked`: today's date

Sources: the set's release notes and Wizards' archetype descriptions (draftsim.com quotes them; the environment can reach draftsim.com but not www.draftsim.com). Check the mechanics against live Scryfall cards.

## Commander Brackets tab (`MTG_Lookup_Tool.html`)

The bracket rules are written out by hand, because Wizards publishes them as articles, not data. Everything else on the tab comes live from Scryfall: the Game Changers list, the Commander banned list, and the mass-land-denial / extra-turn tags used by the checkers. When Wizards posts a bracket or banned-list update:

- Update `BRACKET_INFO` and `BRACKET_COMPARE` if the bracket rules changed.
- Add the update to the top of `BRACKET_HISTORY` and set `BRACKETS_RULES_AS_OF` (the update's date and link, plus today's date as `lastChecked`).
- Update `GAME_CHANGER_GROUPS` (sort each card into a group) and `GAME_CHANGER_REASONS` (a one-line reason) so they match Scryfall's `is:gamechanger` list exactly. If they don't match, the page shows a "list has changed" warning.

## Seasonal themes (`MTG_Lookup_Tool.html`)

The site's colors all come from the design tokens in the `:root` CSS block. A seasonal theme is an `html[data-theme="..."]` block that overrides some of them. The schedule script in `<head>` (`SEASONAL_THEMES` / `SEASONAL_SCHEDULES`) decides which theme is on, by the device's local date, repeating every year. Outside any season there's no `data-theme`, so the site uses the original look. Staff can switch a season off on their own device with the "Switch to classic look" button. Add `?theme=<key>` to the URL to preview any theme.

### Original ("OG") theme — keep these, never edit them for a season

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--brand` | `#1777a1` (Moonshot teal) | | `--text-primary` | `#e0e0e0` |
| `--brand-light` | `#3aa3d1` | | `--text-secondary` | `#909090` |
| `--bg-canvas` | `#1a1a1a` | | `--text-muted` | `#707070` |
| `--bg-panel` | `#2a2a2a` | | `--text-heading` | `#ffffff` |
| `--bg-panel-raised` | `#333333` | | `--border` | `#404040` |
| `--bg-inset` | `#1a1a1a` | | `--border-subtle` | `#333333` |
| `--color-link` | `#6cb2ff` | | `--color-success` | `#7ee787` |

### Season log

| Season | Dates (every year) | Themes |
|---|---|---|
| Fall / Halloween | Sept 22 – Oct 31 | Wednesdays: 🧹 Witching Wednesday (`witching`). Fridays: 🦇 Spooky Friday (`spooky`). Oct 31: 🎃 Halloween Night (`halloween`). Other days are picked at random from 🍂 Autumn Harvest (`harvest`), 🎃 Pumpkin Patch (`pumpkin`) and 🌕 Harvest Moon (`harvestmoon`). The pick is seeded by the date, so everyone sees the same theme all day, and the same theme never shows two days in a row. |
| Black Friday | Day after Thanksgiving (4th Thursday of November + 1) | 🛍️ Black Friday (`blackfriday`), a one-day theme. The date is worked out each year. |
| Winter / Christmas | Dec 1 – Jan 1 | Dec 24: 🎅 Christmas Eve (`christmaseve`). Dec 25: 🎄 Christmas Day (`christmas`). Dec 31: 🎆 New Year's Eve (`newyearseve`). Jan 1: 🥳 New Year's Day (`newyear`). Fridays: 🎁 Festive Friday (`festive`). Sundays: ☃️ Snow Day Sunday (`snowday`). Other days are picked at random from ❄️ Winter Wonderland (`wonderland`), 🎄 Evergreen (`evergreen`), 🍪 Cookies & Cocoa (`cocoa`) and ✨ Twinkle Lights (`twinkle`), with the same rules as fall. |

### Holidays and observances

Holiday themes (`HOLIDAYS` in the `<head>` script) take priority over the fall and winter rotation on their day. The only exceptions are a season's own special days (Christmas Eve/Day, New Year's Eve/Day), which win. Each holiday shows a one-line note under the page title saying what the day is, even in the classic look. Days of remembrance (Memorial Day, Veterans Day) use muted colors and no decorations. If two holidays land on the same day, the one listed first in `HOLIDAYS` wins.

| Group | Days |
|---|---|
| US federal | MLK Jr. Day (3rd Mon Jan), Presidents' Day (3rd Mon Feb), Memorial Day (last Mon May), Juneteenth (Jun 19), Independence Day (Jul 4), Labor Day (1st Mon Sep), Indigenous Peoples' Day (2nd Mon Oct), Veterans Day (Nov 11), Thanksgiving (4th Thu Nov) |
| World cultural & religious | Lunar New Year, Holi, Nowruz (Mar 21, the UN's International Day of Nowruz), Passover (first full day), Eid al-Fitr, Eid al-Adha, Diwali, Hanukkah (all 8 days) |
| Popular US days | Valentine's Day, Pi Day, St. Patrick's Day, Easter (calculated), Earth Day, Mother's Day (2nd Sun May), Father's Day (3rd Sun Jun) |
| UN observances | International Women's Day (Mar 8), International Day of Peace (Sep 21), World Kindness Day (Nov 13), Human Rights Day (Dec 10) |
| Store | Magic's Birthday (Aug 5 - Alpha released 1993) |

Holidays on lunar or lunisolar calendars use `HOLIDAY_DATE_TABLES`, which covers 2026-2030 (checked 2026-09-24). **Extend it before 2031.** Recheck Diwali 2030 nearer the time, because sources were a day apart.
