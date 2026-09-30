# Moonshot Games Lookup Tools

Card-lookup and reference tools for Magic: The Gathering and Pokémon, made for use at Moonshot Games (Noblesville, IN and Plainfield, IN). This is an independent project, not an official Moonshot Games tool.

Each tool is a single HTML file with no build step and no backend. It calls public data sources straight from the browser: Scryfall for cards and prices, MTGJSON for sealed products and price history, and EDHREC for Commander play data.

## Live site

- MTG tools: https://kenshen107.github.io/moonshot-lookup-tools/MTG_Lookup_Tool.html
- Pokémon lookup: https://kenshen107.github.io/moonshot-lookup-tools/Pokemon_Lookup_Tool.html
- Archenemy simulator: https://kenshen107.github.io/moonshot-lookup-tools/Archenemy_Simulator.html
- Planechase simulator: https://kenshen107.github.io/moonshot-lookup-tools/Planechase_Simulator.html
- Beginner guides & handouts: https://kenshen107.github.io/moonshot-lookup-tools/Beginner_Guides.html

## What's in the MTG tool

- **Card Lookup:** prices, printings, rules text, legality, price history and Commander play data for any card.
- **At the counter:** Buyer's Guide (card finder, land finder, full-art basics, price a deck), Products (what's in each sealed product, precon decklists and values), Buylist calculator, Market Watch (price spikes, ban changes, trending commanders, new-set demand), Pull List and the hotlist Case Map.
- **Rules & events:** Format Rules, Commander Brackets, Prerelease toolkit, Value Vintage and a Judge quick reference.
- **Learn & train:** Set Primer, Grading & Spotting Fakes, and a Card Quiz.

The **Beginner Guides** page has printable how-to-play and starter-checklist cards for Magic, Pokémon, Disney Lorcana, Riftbound and the Gundam Card Game, the Magic prerelease handouts, and a guide to the accessories a new player needs.

A GitHub Action (`.github/workflows/market-data.yml`) builds daily price-history files from MTGJSON and publishes them to the `market-data` branch.

## Local use

Open any `.html` file in a browser. No server is needed.

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
