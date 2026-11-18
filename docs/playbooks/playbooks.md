# Playbooks mined from game records

Generated 2026-11-18 by `node tests/playbook.js` from 17 games. Draft numbers for reviewing by hand; small samples mean low confidence.

## Nog, Ambitious Cadet  (4 games: 4 won, 0 lost)
Human:  lands by turn 5 6.8, by turn 8 12.5 · spells/turn 0.9 · first attack on own turn 4.5 · attacks on 70% of turns after 4 · 10.1 creatures per attack · 12.5 combat damage/turn · 1 abilities/turn
Computer on the same commander (60 games, lab): lands by 5 5.5, by 8 9.2 · spells/turn 1.2 · first attack 7.3 · attacks on 44% of turns after 4 · 5 per attack · 0 damage/turn · 0.5 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: Nog, Ambitious Cadet (2/4)
  turn 3: Weather Maker (1/4), Retreat to Hagra (1/4), Nog, Ambitious Cadet (1/4), Jake Sisko, War Correspondent (1/4)
  turn 4: Nog, Ambitious Cadet (1/4)
  turn 5: Jake Sisko, War Correspondent (2/4), Mole Man, Moloid Master (1/4), Bloodghast (1/4), Chocobo Racetrack (1/4)
  turn 6: Titania, Protector of Argoth (1/4), Rampaging Baloths (1/4), The Gitrog Monster (1/4)
Cast in most of the wins (no losses to compare): Nog, Ambitious Cadet (4/4 wins, 0/0 losses); Jake Sisko, War Correspondent (3/4 wins, 0/0 losses); In Garruk's Wake (2/4 wins, 0/0 losses); Rise of the Dark Realms (2/4 wins, 0/0 losses); Retreat to Hagra (2/4 wins, 0/0 losses); Mole Man, Moloid Master (2/4 wins, 0/0 losses); Sapling Nursery (2/4 wins, 0/0 losses); The Gitrog Monster (2/4 wins, 0/0 losses); Icetill Explorer (2/4 wins, 0/0 losses)
Abilities used most: Fabled Passage x15, Nog, Ambitious Cadet x13, Artificial Anomaly x3, Temporal Anomaly x3, Emergence Zone x2, Clue x2, Exploration Broodship x2, Volatile Fault x2
Won on turn 42 (19 attackers; last casts: Rise of the Dark Realms); 35 (30 attackers; last casts: Sapling Nursery, Retreat to Kazandu); 49 (14 attackers; last casts: -); 44 (0 attackers; last casts: -)
Suggestions for the computer (low confidence below ~5 games):
  - the human attacks on 70% of turns after turn 4, the computer on 44%: let this deck's plan attack more (a higher `atk` or lower `hold` for its playstyle)
  - the human sends 10.1 creatures per attack against the computer's 5: all-in swings are part of the plan
  - the human has 1.3 more lands by turn 5: the computer should value land drops (and land ramp) higher for this deck
  - the human uses 0.5 more abilities a turn: look at which abilities the computer skips
Plan skeleton (review before use):  'Nog, Ambitious Cadet': { win: '<fill in how the wins ended>', engine: ["Nog, Ambitious Cadet","Jake Sisko, War Correspondent","In Garruk's Wake","Rise of the Dark Realms","Retreat to Hagra","Mole Man, Moloid Master","Sapling Nursery","The Gitrog Monster"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Grizzlegom, Hurloon Hero  (3 games: 1 won, 2 lost)
Human:  lands by turn 5 3.3, by turn 8 5.7 · spells/turn 0.8 · first attack on own turn 5.5 · attacks on 33% of turns after 4 · 0.7 creatures per attack · 2.2 combat damage/turn · 0 abilities/turn
  in wins: first attack 3, 1/attack, 1.6 spells/turn, lands by 5 5   |  in losses: first attack 8, 0.5/attack, 0.4 spells/turn, lands by 5 2.5
Computer on the same commander (60 games, lab): lands by 5 5.2, by 8 8.1 · spells/turn 1.2 · first attack 8.5 · attacks on 41% of turns after 4 · 4.4 per attack · 0 damage/turn · 0.1 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: Studious First-Year (1/1)
  turn 3: Atalan Jackal (1/1)
  turn 4: Harrow (1/1), Summon: Fenrir (1/1)
  turn 5: Grizzlegom, Hurloon Hero (1/1)
  turn 6: Garruk's Uprising (1/1), Sutina, Speaker of the Tajuru (1/1)
Abilities used most: Studious First-Year x1
Won on turn 35 (1 attackers; last casts: Timeless Witness, Ulvenwald Hydra)

## Doc Samson, Super Psychiatrist  (2 games: 0 won, 2 lost)
Human:  lands by turn 5 4.5, by turn 8 6.5 · spells/turn 1.4 · first attack on own turn 5 · attacks on 50% of turns after 4 · 1.6 creatures per attack · 2.5 combat damage/turn · 0.4 abilities/turn
Computer on the same commander (60 games, lab): lands by 5 4.4, by 8 6.3 · spells/turn 2.8 · first attack 8.6 · attacks on 29% of turns after 4 · 1.6 per attack · 0 damage/turn · 2.5 abilities/turn
Abilities used most: Manifold Key x3, Astral Cornucopia x1, Moxite Refinery x1, Ring of Three Wishes x1, Magistrate's Scepter x1
Suggestions for the computer (low confidence below ~5 games):
  - the human attacks on 50% of turns after turn 4, the computer on 29%: let this deck's plan attack more (a higher `atk` or lower `hold` for its playstyle)

## Aurelia, the Law Above  (2 games: 2 won, 0 lost)
Human:  lands by turn 5 5, by turn 8 6.5 · spells/turn 1.6 · first attack on own turn 4 · attacks on 90% of turns after 4 · 5 creatures per attack · 8.9 combat damage/turn · 0.1 abilities/turn
Computer on the same commander (60 games, lab): lands by 5 4.6, by 8 6.9 · spells/turn 1.3 · first attack 7.5 · attacks on 55% of turns after 4 · 3.3 per attack · 0 damage/turn · 0.2 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: -
  turn 3: Inspiring Overseer (1/2)
  turn 4: PuPu UFO (1/2), Hobgoblin, Mantled Marauder (1/2)
  turn 5: Excava, the Risen Past (1/2), Adult Gold Dragon (1/2)
  turn 6: Flumph (1/2), RMS Titanic (1/2), Basandra, Battle Seraph (1/2)
Cast in most of the wins (no losses to compare): Excava, the Risen Past (2/2 wins, 0/0 losses); Aurelia, the Law Above (2/2 wins, 0/0 losses); Sol Ring (2/2 wins, 0/0 losses); Song of Totentanz (2/2 wins, 0/0 losses); Adult Gold Dragon (2/2 wins, 0/0 losses); Hobgoblin, Mantled Marauder (2/2 wins, 0/0 losses); What Must Be Done (2/2 wins, 0/0 losses)
Abilities used most: PuPu UFO x1, Joshua, Phoenix's Dominant x1
Won on turn 45 (26 attackers; last casts: Borrowed Knowledge, Thran Dynamo, What Must Be Done); 43 (3 attackers; last casts: Laughing Mad, Bitterthorn, Nissa's Animus, Warcry Phoenix)
Suggestions for the computer (low confidence below ~5 games):
  - the human attacks on 90% of turns after turn 4, the computer on 55%: let this deck's plan attack more (a higher `atk` or lower `hold` for its playstyle)
  - the human sends 5 creatures per attack against the computer's 3.3: all-in swings are part of the plan
Plan skeleton (review before use):  'Aurelia, the Law Above': { win: '<fill in how the wins ended>', engine: ["Excava, the Risen Past","Aurelia, the Law Above","Sol Ring","Song of Totentanz","Adult Gold Dragon","Hobgoblin, Mantled Marauder","What Must Be Done"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Super-Skrull  (2 games: 0 won, 2 lost)
Human:  lands by turn 5 4, by turn 8 4.5 · spells/turn 0.4 · first attack on own turn 0 · attacks on 0% of turns after 4 · 0 creatures per attack · 0 combat damage/turn · 0.5 abilities/turn
Computer on the same commander (60 games, lab): lands by 5 4.5, by 8 6.4 · spells/turn 1.7 · first attack 8.1 · attacks on 49% of turns after 4 · 2.4 per attack · 0 damage/turn · 0.9 abilities/turn
Abilities used most: Super-Skrull x3, Flooded Strand x1, Moonsilver Key x1
Suggestions for the computer (low confidence below ~5 games):
  - the computer attacks more often than the human (49% against 0%): check it isn't throwing creatures away

## Lorehold, the Historian  (2 games: 1 won, 1 lost)
Human:  lands by turn 5 2.5, by turn 8 4 · spells/turn 0.5 · first attack on own turn 6 · attacks on 40% of turns after 4 · 1.2 creatures per attack · 5.9 combat damage/turn · 0 abilities/turn
  in wins: first attack 6, 2.4/attack, 1.1 spells/turn, lands by 5 5   |  in losses: first attack 0, 0/attack, 0 spells/turn, lands by 5 0
Computer on the same commander (60 games, lab): lands by 5 4.6, by 8 6.8 · spells/turn 1 · first attack 8.8 · attacks on 44% of turns after 4 · 2.1 per attack · 0 damage/turn · 0.1 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: -
  turn 3: -
  turn 4: -
  turn 5: Breath of Life (1/1)
  turn 6: Lorehold, the Historian (1/1)
Abilities used most: The Capitoline Triad x1
Won on turn 48 (6 attackers; last casts: Valakut Awakening, Worn Powerstone, Snort)

## Samut, the Driving Force  (2 games: 2 won, 0 lost)
Human:  lands by turn 5 5, by turn 8 8 · spells/turn 0.7 · first attack on own turn 6.5 · attacks on 55% of turns after 4 · 9.7 creatures per attack · 15.5 combat damage/turn · 0 abilities/turn
Computer on the same commander (60 games, lab): lands by 5 4.7, by 8 6.6 · spells/turn 1.5 · first attack 7.2 · attacks on 59% of turns after 4 · 7.2 per attack · 0 damage/turn · 0.2 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: Arcane Signet (1/2)
  turn 3: Brass Infiniscope (1/2), Daily Bugle Newspaper (1/2)
  turn 4: Samut, the Driving Force (1/2), We Ride at Dawn (1/2)
  turn 5: -
  turn 6: Threefold Thunderhulk (1/2)
Cast in most of the wins (no losses to compare): Samut, the Driving Force (2/2 wins, 0/0 losses); Gogo, Mysterious Mime (2/2 wins, 0/0 losses); Forth Eorlingas! (2/2 wins, 0/0 losses)
Abilities used most: Daily Bugle Newspaper x1
Won on turn 50 (30 attackers; last casts: Rolling Hamsphere, Restoration Seminar); 31 (14 attackers; last casts: Samut, the Driving Force, Gogo, Mysterious Mime)
Plan skeleton (review before use):  'Samut, the Driving Force': { win: '<fill in how the wins ended>', engine: ["Samut, the Driving Force","Gogo, Mysterious Mime","Forth Eorlingas!"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },
