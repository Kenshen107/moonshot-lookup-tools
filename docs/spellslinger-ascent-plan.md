# Planeswalker's Ascent (Campaign rebuild)

Owner's request 2026-10-18: rebuild the Campaign as a single-player gauntlet with tiered AI, authentic-feeling packs, targeted farming and a crafting economy. Decisions: replace the old ladder and Precon Circuit; packs follow the owner's 14-slot table exactly; Aether and crafting in Campaign only (own currency); a custom card roster of vanilla creatures, keyword creatures and simple spells, as many cards as can be found; its own deck lists, separate from Sandbox.

## Roster (done: step 1)
`node tests/ascent_roster.js` writes `spellslinger/data/ascent-roster.json` (1,032 cards on 2026-10-18): every card reads as fully Automated; creatures with no text or only plain keywords (314 vanilla, 446 keyword), one-effect draw / destroy / exile / bounce / burn / shrink / pump spells, 15 tapped dual lands and the 5 basics. At most two colors. Rarity (common / uncommon / rare / mythic) and tier (1-3) are set by strength inside each group, not by Magic's printing. Add a wording to `simpleSpell` to widen the pool, then rerun.

## Build steps
2. (done 2026-10-18, `spellslinger/13c-ascent.js`, `tests/suites/ascent.js`) Pack generator: the 14-slot Play Booster from the roster (6 commons, 3 uncommons, rare with 1-in-7 mythic, foil, wildcard, basic, list slot), Collector Booster for boss wins.
3. (core done with step 2: `ascentAddCards`, `craftAscentCard`, `dustAscentCard`; the screen comes with step 5) Aether and crafting: 5th copy dusts, craft costs by rarity, Campaign only.
4. (done 2026-10-18: `spellslinger/13d-ascent-gauntlet.js`, `tests/suites/ascentdecks.js`, lab `--kind ascent`; rarity rebalanced to about 8% mythic) Gauntlet: three tiers of five matches plus a Planeswalker boss; each AI gets a themed deck from the roster and a signature "grind" card set only it drops.
5. Campaign screen, saved progress, own deck list (Campaign decks separate from Sandbox).
6. Tests (lab games with roster decks, pack odds, crafting), About log, CLAUDE.md.

## Card upgrades (owner's request 2026-10-18)
Every owned copy can carry up to 2 upgrades (3 on a mythic): keywords, one stat boost, one simple trigger for creatures; a cantrip or 3 life for spells. Per copy (four Bears can all differ). Paid with Aether and/or by feeding in spare plain copies of the same card (each covers 2x its dust value). Swapping or removing costs a quarter of the old upgrade's price. Built in `spellslinger/13e-ascent-upgrades.js`: an upgraded copy plays as its own card whose text has the upgrade written in, so the card reader needs no new rules. The deck editor and upgrade screen come with step 5.
