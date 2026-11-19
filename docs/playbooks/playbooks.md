# Playbooks mined from game records

Generated 2026-11-19 by `node tests/playbook.js` from 34 games. 0 new games added this run, 17 already known; 34 kept in all (2026-10-26 to 2026-11-18). The playbooks are rebuilt from every game kept in `games.jsonl.gz`, so they get more reliable as games are added. Draft numbers for reviewing by hand; small samples mean low confidence.

## Grizzlegom, Hurloon Hero  (6 games: 3 won, 3 lost)
Human:  lands by turn 5 4.5, by turn 8 8 · spells/turn 1 · first attack on own turn 5.2 · attacks on 64% of turns after 4 · 1.7 creatures per attack · 6.7 combat damage/turn · 0.2 abilities/turn
  in wins: first attack 4.7, 2.5/attack, 1.5 spells/turn, lands by 5 5.7   |  in losses: first attack 6, 0.9/attack, 0.6 spells/turn, lands by 5 3.3
Computer on the same commander (1 game): lands by 5 6, by 8 13 · spells/turn 1.1 · first attack 8 · attacks on 40% of turns after 4 · 2 per attack · 0 damage/turn · 0.1 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: Studious First-Year (1/3), Lavaspur Boots (1/3)
  turn 3: Atalan Jackal (1/3), Loot, Exuberant Explorer (1/3)
  turn 4: Harrow (1/3), Summon: Fenrir (1/3), The Earth King (1/3), U.S.S. Voyager, Lone Wanderer (1/3)
  turn 5: Grizzlegom, Hurloon Hero (2/3)
  turn 6: Garruk's Uprising (1/3), Sutina, Speaker of the Tajuru (1/3), Grizzlegom, Hurloon Hero (1/3), Ulvenwald Hydra (1/3)
Cast in the wins more than in the losses: Summon: Fenrir (2/3 wins, 0/3 losses); Ulvenwald Hydra (2/3 wins, 0/3 losses); Timeless Witness (2/3 wins, 0/3 losses); Lavaspur Boots (2/3 wins, 0/3 losses); The Earth King (2/3 wins, 0/3 losses); Grizzlegom, Hurloon Hero (3/3 wins, 2/3 losses); Garruk's Uprising (2/3 wins, 1/3 losses); Troop of Ponies (2/3 wins, 1/3 losses)
Abilities used most: The Holodeck x4, U.S.S. Voyager, Lone Wanderer x3, Studious First-Year x1, Loot, Exuberant Explorer x1, Troop of Ponies x1
Won on turn 35 (1 attackers; last casts: Timeless Witness, Ulvenwald Hydra); 35 (14 attackers; last casts: Tromp the Domains, Travel Through Caradhras, Tromp the Domains); 38 (2 attackers; last casts: Grizzlegom, Hurloon Hero)
Suggestions for the computer (low confidence below ~5 games):
  - the human attacks on 64% of turns after turn 4, the computer on 40%: let this deck's plan attack more (a higher `atk` or lower `hold` for its playstyle)
Plan skeleton (review before use):  'Grizzlegom, Hurloon Hero': { win: '<fill in how the wins ended>', engine: ["Summon: Fenrir","Ulvenwald Hydra","Timeless Witness","Lavaspur Boots","The Earth King","Grizzlegom, Hurloon Hero","Garruk's Uprising","Troop of Ponies"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Doc Samson, Super Psychiatrist  (4 games: 2 won, 2 lost)
Human:  lands by turn 5 4.8, by turn 8 7.3 · spells/turn 2.6 · first attack on own turn 6.3 · attacks on 44% of turns after 4 · 2.7 creatures per attack · 50.6 combat damage/turn · 3.6 abilities/turn
  in wins: first attack 7.5, 3.8/attack, 3.9 spells/turn, lands by 5 5   |  in losses: first attack 5, 1.6/attack, 1.4 spells/turn, lands by 5 4.5
Computer on the same commander (9 games): lands by 5 4.3, by 8 6.1 · spells/turn 1.3 · first attack 3.4 · attacks on 54% of turns after 4 · 1.2 per attack · 1.5 damage/turn · 0.2 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: -
  turn 3: Kami of Whispered Hopes (1/2)
  turn 4: Doc Samson, Super Psychiatrist (1/2), Empowered Autogenerator (1/2)
  turn 5: Everflowing Chalice (1/2), Contagion Clasp (1/2), Doc Samson, Super Psychiatrist (1/2)
  turn 6: Empowered Autogenerator (1/2), Doc Samson, Super Psychiatrist (1/2), Hardened Scales (1/2), Kalonian Hydra (1/2)
Cast in the wins more than in the losses: Kami of Whispered Hopes (2/2 wins, 0/2 losses); Empowered Autogenerator (2/2 wins, 0/2 losses); Kalonian Hydra (2/2 wins, 0/2 losses); Goblin Cannon (2/2 wins, 0/2 losses); Temur Sabertooth (2/2 wins, 0/2 losses); The First Iroan Games (2/2 wins, 0/2 losses); Lavaspur Boots (2/2 wins, 0/2 losses); Swashbuckler's Whip (2/2 wins, 0/2 losses); Fangs of Kalonia (2/2 wins, 0/2 losses); Peema Trailblazer (2/2 wins, 0/2 losses); Lily Bowen, Raging Grandma (2/2 wins, 1/2 losses); Umbral Mantle (2/2 wins, 1/2 losses)
Abilities used most: Spike Feeder x26, Sword of the Paruns x22, Swashbuckler's Whip x19, Umbral Mantle x19, Staff of Domination x7, Empowered Autogenerator x5, Manifold Key x3, Surestrike Trident x3
Won on turn 31 (1 attackers; last casts: Goliath, Mass Manipulator, Umbral Mantle, Surestrike Trident); 29 (12 attackers; last casts: Gyre Sage, Fangs of Kalonia, Screaming Shield)
Suggestions for the computer (low confidence below ~5 games):
  - the human sends 2.7 creatures per attack against the computer's 1.2: all-in swings are part of the plan
  - the human casts 1.3 more spells a turn: the computer leaves mana unused
  - the human uses 3.4 more abilities a turn: look at which abilities the computer skips
Plan skeleton (review before use):  'Doc Samson, Super Psychiatrist': { win: '<fill in how the wins ended>', engine: ["Kami of Whispered Hopes","Empowered Autogenerator","Kalonian Hydra","Goblin Cannon","Temur Sabertooth","The First Iroan Games","Lavaspur Boots","Swashbuckler's Whip"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Nog, Ambitious Cadet  (4 games: 4 won, 0 lost)
Human:  lands by turn 5 6.8, by turn 8 12.5 · spells/turn 0.9 · first attack on own turn 4.5 · attacks on 70% of turns after 4 · 10.1 creatures per attack · 12.5 combat damage/turn · 1 abilities/turn
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
Plan skeleton (review before use):  'Nog, Ambitious Cadet': { win: '<fill in how the wins ended>', engine: ["Nog, Ambitious Cadet","Jake Sisko, War Correspondent","In Garruk's Wake","Rise of the Dark Realms","Retreat to Hagra","Mole Man, Moloid Master","Sapling Nursery","The Gitrog Monster"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Samut, the Driving Force  (4 games: 4 won, 0 lost)
Human:  lands by turn 5 5, by turn 8 7.5 · spells/turn 1 · first attack on own turn 5.8 · attacks on 70% of turns after 4 · 7.1 creatures per attack · 20.7 combat damage/turn · 0.1 abilities/turn
Computer on the same commander (1 game): lands by 5 5, by 8 8 · spells/turn 3.7 · first attack 7 · attacks on 60% of turns after 4 · 2.7 per attack · 6.4 damage/turn · 0.1 abilities/turn
First turns in the games won:
  turn 1: World Map (1/4)
  turn 2: Arcane Signet (1/4), Collector's Vault (1/4)
  turn 3: Brass Infiniscope (1/4), Daily Bugle Newspaper (1/4), We Ride at Dawn (1/4), Krenko, Tin Street Kingpin (1/4)
  turn 4: Samut, the Driving Force (1/4), We Ride at Dawn (1/4), Racers' Scoreboard (1/4), Daily Bugle Newspaper (1/4)
  turn 5: Collector's Vault (1/4)
  turn 6: Threefold Thunderhulk (1/4), Samut, the Driving Force (1/4), True Conviction (1/4)
Cast in most of the wins (no losses to compare): Samut, the Driving Force (4/4 wins, 0/0 losses); Brass Infiniscope (3/4 wins, 0/0 losses); Gogo, Mysterious Mime (3/4 wins, 0/0 losses); Daily Bugle Newspaper (2/4 wins, 0/0 losses); We Ride at Dawn (2/4 wins, 0/0 losses); World Map (2/4 wins, 0/0 losses); Racers' Scoreboard (2/4 wins, 0/0 losses); Forth Eorlingas! (2/4 wins, 0/0 losses); Rolling Hamsphere (2/4 wins, 0/0 losses); Restoration Seminar (2/4 wins, 0/0 losses); Collector's Vault (2/4 wins, 0/0 losses)
Abilities used most: Daily Bugle Newspaper x2, Collector's Vault x2, World Map x1
Won on turn 50 (30 attackers; last casts: Rolling Hamsphere, Restoration Seminar); 31 (14 attackers; last casts: Samut, the Driving Force, Gogo, Mysterious Mime); 37 (17 attackers; last casts: Oviya, Automech Artisan, Brass Infiniscope, Rolling Hamsphere); 45 (14 attackers; last casts: Restoration Seminar)
Suggestions for the computer (low confidence below ~5 games):
  - the human sends 7.1 creatures per attack against the computer's 2.7: all-in swings are part of the plan
Plan skeleton (review before use):  'Samut, the Driving Force': { win: '<fill in how the wins ended>', engine: ["Samut, the Driving Force","Brass Infiniscope","Gogo, Mysterious Mime","Daily Bugle Newspaper","We Ride at Dawn","World Map","Racers' Scoreboard","Forth Eorlingas!"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Aurelia, the Law Above  (2 games: 2 won, 0 lost)
Human:  lands by turn 5 5, by turn 8 6.5 · spells/turn 1.6 · first attack on own turn 4 · attacks on 90% of turns after 4 · 5 creatures per attack · 8.9 combat damage/turn · 0.1 abilities/turn
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
Plan skeleton (review before use):  'Aurelia, the Law Above': { win: '<fill in how the wins ended>', engine: ["Excava, the Risen Past","Aurelia, the Law Above","Sol Ring","Song of Totentanz","Adult Gold Dragon","Hobgoblin, Mantled Marauder","What Must Be Done"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Super-Skrull  (2 games: 0 won, 2 lost)
Human:  lands by turn 5 4, by turn 8 4.5 · spells/turn 0.4 · first attack on own turn 0 · attacks on 0% of turns after 4 · 0 creatures per attack · 0 combat damage/turn · 0.5 abilities/turn
Computer on the same commander (4 games): lands by 5 3.8, by 8 5.5 · spells/turn 0.8 · first attack 8 · attacks on 8% of turns after 4 · 1 per attack · 0.3 damage/turn · 0.3 abilities/turn
Abilities used most: Super-Skrull x3, Flooded Strand x1, Moonsilver Key x1

## Lorehold, the Historian  (2 games: 1 won, 1 lost)
Human:  lands by turn 5 2.5, by turn 8 4 · spells/turn 0.5 · first attack on own turn 6 · attacks on 40% of turns after 4 · 1.2 creatures per attack · 5.9 combat damage/turn · 0 abilities/turn
  in wins: first attack 6, 2.4/attack, 1.1 spells/turn, lands by 5 5   |  in losses: first attack 0, 0/attack, 0 spells/turn, lands by 5 0
First turns in the games won:
  turn 1: -
  turn 2: -
  turn 3: -
  turn 4: -
  turn 5: Breath of Life (1/1)
  turn 6: Lorehold, the Historian (1/1)
Abilities used most: The Capitoline Triad x1
Won on turn 48 (6 attackers; last casts: Valakut Awakening, Worn Powerstone, Snort)

## Torgaar, Famine Incarnate  (2 games: 0 won, 2 lost)
Human:  lands by turn 5 5, by turn 8 7 · spells/turn 1.5 · first attack on own turn 8.5 · attacks on 55% of turns after 4 · 2.6 creatures per attack · 1.6 combat damage/turn · 0.3 abilities/turn
Computer on the same commander (4 games): lands by 5 4, by 8 5.8 · spells/turn 0.8 · first attack 8.5 · attacks on 14% of turns after 4 · 0.8 per attack · 0.5 damage/turn · 0.1 abilities/turn
Abilities used most: Clue x5, Chalice of Life x4
Suggestions for the computer (low confidence below ~5 games):
  - the human attacks on 55% of turns after turn 4, the computer on 14%: let this deck's plan attack more (a higher `atk` or lower `hold` for its playstyle)
  - the human sends 2.6 creatures per attack against the computer's 0.8: all-in swings are part of the plan
  - the human has 1 more lands by turn 5: the computer should value land drops (and land ramp) higher for this deck
  - the human casts 0.7 more spells a turn: the computer leaves mana unused

## Astonishing Spider-Man  (2 games: 2 won, 0 lost)
Human:  lands by turn 5 4, by turn 8 7 · spells/turn 1.6 · first attack on own turn 3.5 · attacks on 68% of turns after 4 · 1.3 creatures per attack · 3.1 combat damage/turn · 0 abilities/turn
Computer on the same commander (3 games): lands by 5 3, by 8 4.3 · spells/turn 0.7 · first attack 6 · attacks on 28% of turns after 4 · 0.7 per attack · 0.5 damage/turn · 0.1 abilities/turn
First turns in the games won:
  turn 1: -
  turn 2: Pyretic Ritual (1/2), Glint-Horn Buccaneer (1/2)
  turn 3: Seething Song (1/2), Big Score (1/2)
  turn 4: Sphinx's Tutelage (1/2), Astonishing Spider-Man (1/2)
  turn 5: Misty Knight, Hero for Hire (1/2), Sol Ring (1/2), Chameleon, Master of Disguise (1/2)
  turn 6: Astonishing Spider-Man (1/2), Unexpected Windfall (1/2), Teferi's Ageless Insight (1/2)
Cast in most of the wins (no losses to compare): Pyretic Ritual (2/2 wins, 0/0 losses); Glint-Horn Buccaneer (2/2 wins, 0/0 losses); Astonishing Spider-Man (2/2 wins, 0/0 losses); Mystic Redaction (2/2 wins, 0/0 losses); Turnabout (2/2 wins, 0/0 losses); Teferi's Ageless Insight (2/2 wins, 0/0 losses)
Abilities used most: Collector's Vault x1
Won on turn 43 (3 attackers; last casts: Magmakin Artillerist, Teferi's Ageless Insight); 34 (0 attackers; last casts: Change of Fortune)
Suggestions for the computer (low confidence below ~5 games):
  - the human attacks on 68% of turns after turn 4, the computer on 28%: let this deck's plan attack more (a higher `atk` or lower `hold` for its playstyle)
  - the human has 1 more lands by turn 5: the computer should value land drops (and land ramp) higher for this deck
  - the human casts 0.9 more spells a turn: the computer leaves mana unused
Plan skeleton (review before use):  'Astonishing Spider-Man': { win: '<fill in how the wins ended>', engine: ["Pyretic Ritual","Glint-Horn Buccaneer","Astonishing Spider-Man","Mystic Redaction","Turnabout","Teferi's Ageless Insight"], payoff: [<the finishers above>], payoffNeed: 3, cmdr: 4 },

## Sandman, Shifting Scoundrel  (2 games: 0 won, 2 lost)
Computer on the same commander (6 games): lands by 5 4.2, by 8 6.3 · spells/turn 1 · first attack 4.6 · attacks on 57% of turns after 4 · 1.3 per attack · 3.4 damage/turn · 0.3 abilities/turn

## Plargg and Nassari  (1 game: 0 won, 1 lost)
Human:  lands by turn 5 3, by turn 8 6 · spells/turn 2.1 · first attack on own turn 6 · attacks on 83% of turns after 4 · 2 creatures per attack · 3.8 combat damage/turn · 0.4 abilities/turn
Abilities used most: Koth, Fire of Resistance x3, Burnished Hart x1

## Hugh, First of Many  (1 game: 0 won, 1 lost)
Human:  lands by turn 5 5, by turn 8 5 · spells/turn 1.5 · first attack on own turn 5 · attacks on 83% of turns after 4 · 2 creatures per attack · 3.4 combat damage/turn · 0 abilities/turn

## Rootha, Mercurial Artist  (1 game: 0 won, 1 lost)
Human:  lands by turn 5 5, by turn 8 8 · spells/turn 1.2 · first attack on own turn 0 · attacks on 0% of turns after 4 · 0 creatures per attack · 0 combat damage/turn · 0.2 abilities/turn
Abilities used most: Sensei's Divining Top x2

## Seizan, Perverter of Truth  (1 game: 0 won, 1 lost)
Human:  lands by turn 5 5, by turn 8 7 · spells/turn 1.3 · first attack on own turn 4 · attacks on 67% of turns after 4 · 1 creatures per attack · 1.4 combat damage/turn · 0.1 abilities/turn
Abilities used most: Negative Zone Portal x1
