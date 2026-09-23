# Moonshot Lookup Tools

Staff tools for Moonshot Games, used at work in both stores (Noblesville and Plainfield). Each tool is a single self-contained `.html` file with no build step. They call Scryfall's public API directly from the browser. Changes merged to `main` go live on GitHub Pages.

## Rules

- **No price speculation, ever.** Don't add features that predict, rank, or suggest which cards will go up in value, or anything that frames cards as investments. Showing current market prices is fine. Guessing at future prices is not. This applies to the whole repo.
- **No new tabs, tools, or features without the owner's approval.** Build what was asked. If something extra seems useful, suggest it and wait for a yes before building it.
- **Don't remove or rework existing features without asking first.**

## Working in this repo

- Keep each tool a single self-contained HTML file. Don't add frameworks, build steps, or a backend.
- In `MTG_Lookup_Tool.html`, tabs are driven by the `APP_VIEWS` table. The Buyer's Guide and Grading tabs use sub-tab tables (`BUYERS_GUIDE_SUBTABS`, `GUIDE_SUBTABS`). Reuse the existing helpers (card tiles, the card popup, Moonshot stock checks, `fetchScryfallSearchPage`) instead of writing new copies.
- Scryfall search queries (otags especially) can't be guessed reliably. Mark anything not checked against live results as unverified or approximate, as the land-cycle data already does.
