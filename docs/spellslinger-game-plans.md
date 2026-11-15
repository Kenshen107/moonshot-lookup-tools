# Spellslinger Duels: computer game plans

Written 2026-11-15 (owner: "some of the decks need a game plan to understand what is the win con"). Code: `spellslinger/15y-ai-plans.js` (`DECK_PLANS`, by commander name), tests `tests/suites/plans.js`, audit `node tests/ability_audit.js`.

A plan changes how the **computer** plays the deck: engine cards are cast sooner, payoffs wait until the engine runs, the engine creature stays home, equipment goes on the right creature, and combos get a loop that gives a large pool of mana for the turn (marked 🔁 in the log). People play their own decks as they like. Only Doc Samson has a loop so far; the other plans are about order (what to cast first, what to hold).

## Doc Samson, Super Psychiatrist

Combo: Doc Samson taps for mana equal to his power. With an untapper (Staff of Domination: {3},{T} untap, {1} untap itself; or Umbral Mantle: {3},{Q} +2/+2) and power 5 (or 3 with the Mantle) every tap makes more than it costs: infinite mana. Cast and activate everything, then attack with a huge Samson or Kalonian Hydra.

## Hugh, First of Many

Replicate every cheap artifact: rocks first, then pay for copies of Gearhulks, Vehicles and the Cyber-Controller. Big artifacts come down late, with lots of mana.

## Kang the Conqueror

Extra turns and "end the turn": Kang copies and flickers value, Time Stop and Discontinuity end the turn while Hurkyl's Final Meditation and Panharmonicon double up. Ramp, then chain turns.

## Gogo, Master of Mimicry

Copy and ramp: Urza lands and rocks make mana, Replicating Ring, Aetherflux Conduit, Extravagant Replication and Kang copy the best thing on the table; Wurmcoil Engine and Conduit end games.

## Astonishing Spider-Man

Discard and wheel: Spider-Man discards the hand and draws it back; every discard pays off in damage (Glint-Horn Buccaneer, Magmakin Artillerist, Cool but Rude) and Underworld Breach / Teferi's Tutelage turn it into a win.

## Astarion, the Decadent

Drain: gain or drain once, then Astarion doubles it at end step. Gray Merchant, Exsanguinate and Blood Tribute with a board of lifelinkers finish.

## Aurelia, the Law Above

Go wide: attack with three or more creatures so Aurelia draws, five and she burns the table. Phoenixes come back attacking, Gisela doubles the damage.

## Grizzlegom, Hurloon Hero

Domain: land after land, every basic land type you control makes Grizzlegom's attack trigger count for more. Ramp, fix, attack with a huge Grizzlegom.

## Super-Skrull

Defenders: build walls (Super-Skrull makes 0/4 Walls), then High Alert, Doran or The Kingpin of Crime turn toughness into damage and the walls attack.

## Jadzi, Oracle of Arcavios

Bounce-land value and copies: Jadzi, Tatyova and bounce lands draw cards; Genesis Wave, Temporal Cascade and Doppelgang convert mana into a board; Tutelages punish a big hand.

## Torgaar, Famine Incarnate

Sacrifice and recursion: fill the graveyard, sacrifice creatures (Torgaar halves every life total, Exsanguinate and Finale finish) and rebuy them with Midnight Reaper and Reassembling Skeleton.

## Nog, Ambitious Cadet

Lands and the graveyard: grow Nog from Rogue to Scout to Officer (extra land drops, lands from the graveyard), Gitrog and landfall draw cards, Planet tokens and recursion refill the table.

## Rukarumel, Biologist

Typal: Rukarumel makes every nontoken creature the chosen type, so Slivers, changelings, Herald's Horn and Mirror Entity all work together; go wide and pump.

## U.S. Agent, John Walker

Blink and Equipment: Panharmonicon and Elesh Norn double enters triggers, Astral Slide and Flickerwisp flicker them, Auras and Equipment stay on the right creature.

## Lorehold, the Historian

Miracle: every instant and sorcery has miracle {2}. Draw big spells (Gearhulks, mass recursion) at the top of the library with mana ready.

## Plargg and Nassari

Chaos: cast spells from every library, goad everything (Disrupt Decorum, Grenzo), copy spells cast from exile and let the Eldrazi annihilate the table.

## Jenova, Ancient Calamity

Graveyard, sacrifice and Mutants: mill and sacrifice to fill the graveyard, then reanimate and put counters on Mutants; Ruric Thar, Doomgape and Hapatra end games.

## Terra, Magical Adept

Summon sagas: five colors of mana (Chromatic Lantern, Yuna, Sylvan Library), then Final Fantasy Summon sagas and recursion every turn.

## Urianger Augurelt

Angels and the initiative: ramp into Lyra, Archangel of Thune and Absolute Virtue; Urianger plays cards from exile; untappers keep mana flowing.

## Beorn the Fierce

Mana dorks into big green creatures: Famished Worldsire, Wargling and Selvala, then attack with the biggest bears.

## Big Bertha

Mutant counters: grow creatures with +1/+1 counters and mana from the biggest creature, then trample over the table.

## Othelm, Sigardian Outcast

Abzan Clues and recursion: sacrifice Clues and creatures for value, bring everything back and drain.

## Samut, Hazoret's Champion

Red ramp into bombs: rocks, rituals and Skullclamp / Wheel of Fortune draw, then Terror of the Peaks, Goldspan Dragon, Inferno Titan and Embercleave with 7 or 8 mana.

## Samut, the Driving Force

Speed: start your engines, hit opponents to raise speed to max, then Paradigm and Mercenary payoffs and extra combats.

## Odric, Lunarch Marshal

Keyword sharing: Odric gives every creature the keywords any creature has; build a board of different keywords and attack.

## Jean-Luc Picard, Luminary

Officers, Spacecraft and card draw: station the Spacecraft, draw with Seek, and attack with Officers.

## Worf, Defiant Commander

Battlefront: attack several opponents at once for Klingon payoffs, Warrior tokens and goad.

## Commander Spock

Exploration: differently named lands, Strange new worlds and landfall.

## The Borg Queen

Assimilate creatures, make Borg tokens and build Spacecraft, then overwhelm with the assimilated board.

The Gishath, Uldaros, Tyrant, Tyrox, Sandman and Gitrog lists have no plan yet and play as before: a playstyle and the usual card scores.
