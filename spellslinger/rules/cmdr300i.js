// Spellslinger Duels - rules pack: commander round 4, batch i (2026-10-26). Wordings only; engine pieces in 15-cmdr300i.js.
// Uses cl / clx / cmd / act from rules/cmdr.js. Generated from the target list so every line is copied verbatim.
// Ich-Tekik, Salvage Splicer
clx("Whenever an artifact is put into a graveyard from the battlefield, put a +1/+1 counter on ~ and a +1/+1 counter on each Golem you control.", R => { R.trig.push({ ev: 'artifactToGy', fn: 'i_anyArtGy', effects: [cmd('i_ichtekik')] }); });
// Grenzo, Dungeon Warden
clx("{2}: Put the bottom card of your library into your graveyard. If it's a creature card with power less than or equal to ~'s power, put it onto the battlefield.", (R, m, ctx) => { act(R, ctx.line, '{2}', [cmd('i_grenzo')]); });
// The Mighty Thor, Jane Foster
clx("Whenever ~ attacks, exile up to one target nontoken artifact or creature, then return that card to the battlefield tapped under its owner's control.", R => { R.trig.push({ ev: 'attacks', fn: 'i_selfAttacks', effects: [cmd('i_thor')] }); });
// Norika Yamazaki, the Poet
clx("Whenever a Samurai or Warrior you control attacks alone, you may cast target enchantment card from your graveyard this turn.", R => { R.trig.push({ ev: 'attacks', fn: 'i_aloneSW', effects: [cmd('i_norika')] }); });
// Cid, Timeless Artificer
clx("Artifact creatures and Heroes you control get +1/+1 for each Artificer you control and each Artificer card in your graveyard.", R => { R.i_cid = true; });
// Egon, God of Death // Throne of Death
clx("At the beginning of your upkeep, exile two cards from your graveyard. If you can't, sacrifice ~ and draw a card.", R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('i_egon')] }); });
// Akul the Unrepentant
clx("Sacrifice three other creatures: You may put a creature card from your hand onto the battlefield. Activate only as a sorcery and only once each turn.", (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('i_akul')], a => { a.sorcery = true; a.once = true; a.cost.sacOthers = 3; }); });
// Commander Sofia Daguerre
clx("When ~ enters, destroy up to one target legendary permanent. That permanent's controller creates a Junk token.", R => { R.etb.push(cmd('i_sofia')); });
// Zaffai, Thunder Conductor
clx("Whenever you cast or copy an instant or sorcery spell, scry 1. If that spell's mana value is 5 or greater, create a 4/4 blue and red Elemental creature token. If that spell's mana value is 10 or greater, ~ deals 10 damage to an opponent chosen at random.", R => { R.trig.push({ ev: 'cast', fn: 'i_myInstSorc', effects: [cmd('i_zaffai')] }); });
// Loot, the Key to Everything
clx("At the beginning of your upkeep, exile the top X cards of your library, where X is the number of card types among other nonland permanents you control. You may play those cards this turn.", R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('i_loot')] }); });
// Greasefang, Okiba Boss
clx("At the beginning of combat on your turn, return target Vehicle card from your graveyard to the battlefield. It gains haste. Return it to its owner's hand at the beginning of your next end step.", R => { R.trig.push({ ev: 'combat', fn: 'i_myTurn', effects: [cmd('i_greasefang')] }); });
// Miles "Tails" Prower
clx("Whenever a Vehicle you control enters, draw a card if it has flying. Otherwise, put a flying counter on it.", R => { R.trig.push({ ev: 'enters', fn: 'i_myVehicle', effects: [cmd('i_miles')] }); });
// Kemba, Kha Enduring
clx("Whenever ~ or another Cat you control enters, attach up to one target Equipment you control to that creature.", R => { R.trig.push({ ev: 'enters', fn: 'i_myCat', effects: [cmd('i_kemba')] }); });
// Tempestra, Dame of Games
clx("{2}{R}, {T}, Sacrifice an artifact: Create a token that's a copy of another target creature you control, except it isn't legendary. It gains haste. Sacrifice it at the beginning of the next end step.", (R, m, ctx) => { act(R, ctx.line, '{2}{R}, {T}', [cmd('i_tempestra')], a => { a.cost.sacPerm = 'artifact'; }); });
// Deathleaper, Terror Weapon
clx("Creatures you control that entered this turn have double strike.", R => { R.statics.push({ other: false, fn: 'i_entered', p: 0, q: 0, kw: ['double strike'] }); });
// Intet, the Dreamer
clx("Whenever ~ deals combat damage to a player, you may pay {2}{U}. If you do, exile the top card of your library face down. You may look at that card for as long as it remains exiled. You may play that card without paying its mana cost for as long as ~ remains on the battlefield.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'i_selfHits', effects: [cmd('i_intet')] }); });
// Eligeth, Crossroads Augur
clx("If you would scry a number of cards, draw that many cards instead.", R => { R.i_eligeth = true; });
// Caradora, Heart of Alacria
clx("If one or more +1/+1 counters would be put on a creature or Vehicle you control, that many plus one +1/+1 counters are put on it instead.", R => { R.i_caradora = true; });
// Extus, Oriq Overlord // Awaken the Blood Avatar
clx("Whenever you cast or copy an instant or sorcery spell, return target nonlegendary creature card from your graveyard to your hand.", R => { R.trig.push({ ev: 'cast', fn: 'i_myInstSorc', effects: [cmd('i_extus')] }); });
// The Astonishing Ant-Man
clx("{2}{G}, {T}, Remove any number of +1/+1 counters from ~: Create that many 1/1 green Insect creature tokens.", (R, m, ctx) => { act(R, ctx.line, '{2}{G}, {T}', [cmd('i_antman')]); });
// Gerrard, Weatherlight Hero
clx("When ~ dies, exile it and return to the battlefield all artifact and creature cards in your graveyard that were put there from the battlefield this turn.", R => { R.trig.push({ ev: 'dies', effects: [cmd('i_gerrard')] }); });
// Masako the Humorless
clx("Tapped creatures you control can block as though they were untapped.", R => { R.i_masako = true; });
// Eloise, Nephalia Sleuth
clx("Whenever you sacrifice a token, surveil 1.", R => { R.trig.push({ ev: 'sacrificed', fn: 'i_mySacToken', effects: [{ t: 'surveil', n: 1 }] }); });
// Jasmine Boreal of the Seven
clx("Creatures you control with no abilities can't be blocked by creatures with abilities.", R => { R.i_jasmine = true; });
// Nadier, Agent of the Duskenel
clx("When ~ leaves the battlefield, create a number of 1/1 green Elf Warrior creature tokens equal to its power.", R => { R.trig.push({ ev: 'leaves', fn: 'i_selfLeaves', effects: [cmd('i_nadier')] }); });
// Nin, the Pain Artist
clx("{X}{U}{R}, {T}: ~ deals X damage to target creature. That creature's controller draws X cards.", (R, m, ctx) => { i_actX(R, ctx.line, '{X}{U}{R}, {T}', cmd('i_nin', { x: '{X}' })); });
// Shaile, Dean of Radiance // Embrose, Dean of Shadow
clx("{T}: Put a +1/+1 counter on each creature that entered the battlefield under your control this turn.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('i_shaile')]); });
// Tokka & Rahzar, Unsupervised
clx("Whenever another nontoken creature you control leaves the battlefield, put a +1/+1 counter on ~ and create a Treasure token. This ability triggers only once each turn.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'i_otherNontokenLeaves', once: 'i_tokka', effects: [cmd('i_tokka')] }); });
// Gahiji, Honored One
clx("Whenever a creature attacks one of your opponents or a planeswalker an opponent controls, that creature gets +2/+0 until end of turn.", R => { R.trig.push({ ev: 'attacks', fn: 'i_attackAtOpp', effects: [cmd('i_gahiji')] }); });
// Skanos Dragonheart
clx("Whenever ~ attacks, it gets +X/+X until end of turn, where X is the greatest power among other Dragons you control and Dragon cards in your graveyard.", R => { R.trig.push({ ev: 'attacks', fn: 'i_selfAttacks', effects: [cmd('i_skanos')] }); });
// The Duke, Rebel Sentry
clx("{T}, Remove a counter from ~: Put a +1/+1 counter on another target creature you control. It gains hexproof until end of turn.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('i_duke')]); });
// Captain America, Wings of Freedom
clx("Whenever ~ attacks, each other Hero you control gets +X/+X until end of turn, where X is ~'s toughness.", R => { R.trig.push({ ev: 'attacks', fn: 'i_selfAttacks', effects: [cmd('i_capAmerica')] }); });
// Amareth, the Lustrous
clx("Whenever another permanent you control enters, look at the top card of your library. If it shares a card type with that permanent, you may reveal that card and put it into your hand.", R => { R.trig.push({ ev: 'enters', fn: 'i_myOtherPerm', effects: [cmd('i_amareth')] }); });
// Ashling the Pilgrim
clx("{1}{R}: Put a +1/+1 counter on ~. If this is the third time this ability has resolved this turn, remove all +1/+1 counters from ~, and it deals that much damage to each creature and each player.", (R, m, ctx) => { act(R, ctx.line, '{1}{R}', [cmd('i_ashling')]); });
// Emmara Tandris
clx("Prevent all damage that would be dealt to creature tokens you control.", R => { R.i_emmara = true; });
// Witch-king, Sky Scourge
clx("Whenever you attack with one or more Wraiths, exile the top X cards of your library, where X is their total power. You may play those cards this turn.", R => { R.trig.push({ ev: 'attacks', fn: 'i_wraithAttack', effects: [cmd('i_witchKing')] }); });
// Narset, Jeskai Waymaster
clx("At the beginning of your end step, you may discard your hand. If you do, draw cards equal to the number of spells you've cast this turn.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('i_narset')] }); });
// Lutri, the Spellchaser
clx("Each nonland card in your starting deck has a different name.", R => { R.i_noop = true; });
// Sylvia Brightspear
clx("Dragons your team controls have double strike.", R => { R.statics.push({ other: false, type: 'Dragon', p: 0, q: 0, kw: ['double strike'] }); });
// Plargg, Dean of Chaos // Augusta, Dean of Order
clx("{4}{R}, {T}: Reveal cards from the top of your library until you reveal a nonlegendary, nonland card with mana value 3 or less. You may cast that card without paying its mana cost. Put all revealed cards not cast this way on the bottom of your library in a random order.", (R, m, ctx) => { act(R, ctx.line, '{4}{R}, {T}', [cmd('i_plargg')]); });
// Sigarda, Champion of Light
clx("Whenever ~ attacks, if you control three or more creatures with different powers, look at the top five cards of your library. You may reveal a Human creature card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", R => { R.trig.push({ ev: 'attacks', fn: 'i_sigardaAttacks', effects: [cmd('i_sigarda')] }); });
// Djeru, With Eyes Open
clx("If a source would deal damage to a planeswalker you control, prevent 1 of that damage.", R => { R.i_djeru = true; });
// Aziza, Mage Tower Captain
clx("Whenever you cast an instant or sorcery spell, you may tap three untapped creatures you control. If you do, copy that spell. You may choose new targets for the copy.", R => { R.trig.push({ ev: 'cast', fn: 'i_myInstSorc', effects: [cmd('i_aziza')] }); });
// Far Fortune, End Boss
clx("If a source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus 1 instead.", R => { R.i_farFortune = true; });
// Owen Grady, Raptor Trainer
clx("{T}: Put your choice of a reach, menace, trample, or haste counter on target Dinosaur. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('i_owen')], a => { a.sorcery = true; }); });
// Silas Renn, Seeker Adept
clx("Whenever ~ deals combat damage to a player, choose target artifact card in your graveyard. You may cast that card this turn.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'i_selfHits', effects: [cmd('i_silas')] }); });
// Mortarion, Daemon Primarch
clx("At the beginning of your end step, you may pay {X}. If you do, create X 2/2 black Astartes Warrior creature tokens with menace. X can't be greater than the amount of life you lost this turn.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('i_mortarion')] }); });
// April O'Neil, Human Element
clx("Whenever a player casts an artifact, instant, or sorcery spell, you create a Mutagen token.", R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'i_artInstSorcCast', effects: [cmd('i_april')] }); });
// Jugan, the Rising Star
clx("When ~ dies, you may distribute five +1/+1 counters among any number of target creatures.", R => { R.trig.push({ ev: 'dies', effects: [cmd('i_jugan')] }); });
// The Lion-Turtle
clx("~ can't attack or block unless there are three or more Lesson cards in your graveyard.", R => { R.attackCond = 'three or more Lesson cards are in your graveyard'; R.blockCond = 'three or more Lesson cards are in your graveyard'; });
// Syr Vondam, the Lucent
clx("Whenever ~ enters or attacks, other creatures you control get +1/+0 and gain deathtouch until end of turn.", R => { R.etb.push(cmd('i_syr')); R.trig.push({ ev: 'attacks', fn: 'i_selfAttacks', effects: [cmd('i_syr')] }); });
// Invisible Woman, Sue Storm
clx("Whenever you put one or more +1/+1 counters on one or more other Heroes you control, you may create a 0/4 colorless Wall creature token with defender.", R => { R.trig.push({ ev: 'counters', fn: 'i_heroCounters', effects: [cmd('i_invisible')] }); });
// Cynette, Jelly Drover
clx("Creatures you control with flying get +1/+1.", R => { R.statics.push({ other: false, fn: 'flying', p: 1, q: 1, kw: [] }); });
// Kirri, Talented Sprout
clx("At the beginning of each of your postcombat main phases, return target Plant, Treefolk, or land card from your graveyard to your hand.", R => { R.trig.push({ ev: 'main2', fn: 'i_myMain2', effects: [cmd('i_kirri')] }); });
// Riku of Two Reflections
clx("Whenever another nontoken creature you control enters, you may pay {G}{U}. If you do, create a token that's a copy of that creature.", R => { R.trig.push({ ev: 'enters', fn: 'i_myOtherNontokenCreature', effects: [cmd('i_riku')] }); });
// Alistair, the Brigadier
clx("Whenever ~ attacks, you may pay {8}. If you do, creatures you control get +X/+X until end of turn, where X is the number of historic permanents you control.", R => { R.trig.push({ ev: 'attacks', fn: 'i_selfAttacks', effects: [cmd('i_alistair')] }); });
// Tegan Jovanka
clx("Whenever you attack, target attacking historic creature gets +1/+1 and gains indestructible until end of turn.", R => { R.trig.push({ ev: 'attacks', fn: 'i_mineAttack', effects: [cmd('i_tegan')] }); });
// Akal Pakal, First Among Equals
clx("At the beginning of each player's end step, if an artifact entered the battlefield under your control this turn, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.", R => { R.trig.push({ ev: 'end', who: 'each', fn: 'i_artEnteredMine', effects: [cmd('i_akalPakal')] }); });
// Taeko, the Patient Avalanche
clx("Whenever another creature you control leaves the battlefield, if it didn't die, scry 1 and put a +1/+1 counter on ~.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'i_otherCreatureLeavesAlive', effects: [cmd('i_taeko')] }); });
// Ghired, Conclave Exile
clx("Whenever ~ attacks, populate. The token enters tapped and attacking.", R => { R.trig.push({ ev: 'attacks', fn: 'i_selfAttacks', effects: [cmd('i_ghired')] }); });
