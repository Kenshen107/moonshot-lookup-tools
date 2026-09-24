# Moonshot Lookup Tools

Staff tools for Moonshot Games, used at work in both stores (Noblesville and Plainfield). Each tool is a single self-contained `.html` file with no build step. They call Scryfall's public API directly from the browser. Changes merged to `main` go live on GitHub Pages.

## Rules

- **No price speculation, ever.** Don't add features that predict, rank, or suggest which cards will go up in value, or anything that frames cards as investments. Showing current market prices is fine. Guessing at future prices is not. This applies to the whole repo.
- **No new tabs, tools, or features without the owner's approval.** Build what was asked. If something extra seems useful, suggest it and wait for a yes before building it.
- **Don't remove or rework existing features without asking first.**
- **End every reply with these links**, so the owner always has them:
  - Branch: `https://github.com/Kenshen107/moonshot-lookup-tools/tree/<the branch you're working on>`
  - Main: https://github.com/Kenshen107/moonshot-lookup-tools/tree/main
  - Live site: https://kenshen107.github.io/moonshot-lookup-tools/MTG_Lookup_Tool.html
  - Live site (fresh copy): the live-site link plus `?v=<date and time, e.g. 202609231245>`. Use a new value every reply so the browser can't serve a cached copy.

## Working in this repo

- Keep each tool a single self-contained HTML file. Don't add frameworks, build steps, or a backend.
- In `MTG_Lookup_Tool.html`, tabs are driven by the `APP_VIEWS` table (each entry has an icon, a menu label and a one-line description). `NAV_GROUPS` puts every tool except Card Lookup into one of three groups (At the counter, Rules & events, Learn & train); the desktop menu bar, the phone bottom bar and the quick-jump search (`/` or Ctrl+K) are all built from these two tables. `QUICK_JUMP_EXTRAS` adds sub-tabs and sections to quick jump. The Buyer's Guide and Grading tabs use sub-tab tables (`BUYERS_GUIDE_SUBTABS`, `GUIDE_SUBTABS`). Reuse the existing helpers (card tiles, the card popup, the Moonshot store links `moonshotLinkHTML` / `moonshotBlockHTML`, `fetchScryfallSearchPage`) instead of writing new copies.
- Moonshot stock isn't checked live. Shopify doesn't let other sites read the store, and the free CORS relays that worked around that were unreliable, so the tool links to moonshotgamestore.com's own search instead. Don't bring back third-party relays. A live check would need a Shopify Storefront API token from the store admin.
- Scryfall search queries (otags especially) can't be guessed reliably. Mark anything not checked against live results as unverified or approximate, as the land-cycle data already does.
- Claude's cloud environment can reach `api.scryfall.com`, so check new or changed Scryfall queries against live results before shipping them. The Land Finder's fixed cycles use exact card-name lists (`LAND_CYCLE_CARDS`), checked live on 2026-09-24.

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
| Christmas | _not built yet — next up_ | |
