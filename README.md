# Moonshot Games Lookup Tools

Self-contained, single-file staff tools for Moonshot Games (Noblesville, IN & Plainfield, IN) — card lookup, format rules, judge reference, buylist calculator, set primer, card discovery, commander brackets, grading & fakes guide, pull list parser, and a hotlist case map.

No build step, no backend — everything is plain HTML/CSS/JS calling Scryfall's public API directly in the browser.

## Live site

Once GitHub Pages is enabled for this repo, the tools are at:
- `https://<your-username>.github.io/<repo-name>/MTG_Lookup_Tool.html`
- `https://<your-username>.github.io/<repo-name>/Pokemon_Lookup_Tool.html`
- `https://<your-username>.github.io/<repo-name>/Archenemy_Simulator.html`
- `https://<your-username>.github.io/<repo-name>/Planechase_Simulator.html`

## Local use

Just open any `.html` file directly in a browser — no server required.

## Archenemy Simulator

Loads every official Scheme card from Scryfall, lets you pick which ones to
include, then shuffles them into a scheme deck. Flip the top scheme each
archenemy turn — Ongoing Schemes stay in a dedicated play area until you
discard them (their text tells you when), regular schemes go straight to the
discard pile, and the deck auto-reshuffles from discard when it runs out.
Includes a general-purpose dice roller (d4–d20, coin flip) for house rules.

## Planechase Simulator

Loads every official Plane and Phenomenon card from Scryfall. Add one player
per person at the table — each gets their own shuffled planar deck and their
own planar zone, so multiple planes can be active around the table at the
same time. "Planeswalk" reveals the next card, auto-chaining through any
Phenomenon cards (which trigger and go to discard without becoming the
active plane) until a Plane card is turned face up. "Roll Planar Die"
simulates the real 6-sided planar/chaos die (1 face Planeswalk symbol, 1 face
Chaos symbol, 4 blank), and automatically triggers a planeswalk when the
Planeswalk face comes up.
