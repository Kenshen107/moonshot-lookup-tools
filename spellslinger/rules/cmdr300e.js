// Spellslinger Duels - rules pack: commander round 3, batch e (2026-10-26). Wordings only; engine pieces in 15-cmdr300e.js.
// Uses cl / clx / cmd / act from rules/cmdr.js.
// Ilharg, the Raze-Boar
clx("Whenever ~ attacks, you may put a creature card from your hand onto the battlefield tapped and attacking. Return that creature to your hand at the beginning of the next end step.", R => { R.trig.push({ ev: 'attacks', fn: 'e_selfAttacks', effects: [cmd('e_ilharg')] }); });
// Alisaie Leveilleur
clx("The second spell you cast each turn costs {2} less to cast.", R => { R.reducer = { n: 2, what: 'e_second' }; });
// Fire Lord Azula
clx("Whenever you cast a spell while ~ is attacking, copy that spell. You may choose new targets for the copy.", R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'e_castWhileAttacking', filter: 'any', effects: [cmd('e_azula')] }); });
// Pippin, Warden of Isengard
clx("{T}, Sacrifice four Foods: Other creatures you control get +3/+3 and gain haste until end of turn. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('e_pippin')], a => { a.sorcery = true; a.onlyIf = 'you control four or more Foods'; }); });
// God-Eternal Rhonas
clx("When ~ enters, double the power of each other creature you control until end of turn. Those creatures gain vigilance until end of turn.", R => { R.etb.push(cmd('e_rhonas')); });
// Merry, Warden of Isengard
clx("Whenever one or more artifacts you control enter, create a 1/1 white Soldier creature token with lifelink. This ability triggers only once each turn.", R => { R.trig.push({ ev: 'enters', fn: 'e_artifactEnters', once: 'e_merry', effects: [{ t: 'token', n: 1, p: 1, q: 1, name: 'white Soldier', kw: ['lifelink'] }] }); });
// Pir, Imaginative Rascal
clx("If one or more counters would be put on a permanent your team controls, that many plus one of each of those kinds of counters are put on that permanent instead.", R => { R.e_pir = true; });
// Shabraz, the Skyshark
clx("{W/U}: Target Human gains flying until end of turn.", (R, m, ctx) => { act(R, ctx.line, '{W}', [cmd('e_shabraz')]); });
// Layla Hassan
clx("When ~ enters and whenever one or more Assassins you control deal combat damage to a player, return target historic card from your graveyard to your hand.", R => { R.etb.push(cmd('e_layla')); R.trig.push({ ev: 'hitPlayer', fn: 'e_assassinHits', effects: [cmd('e_layla')] }); });
// Anrakyr the Traveller
clx("Whenever ~ attacks, you may cast an artifact spell from your hand or graveyard by paying life equal to its mana value rather than paying its mana cost.", R => { R.trig.push({ ev: 'attacks', fn: 'e_selfAttacks', effects: [cmd('e_anrakyr')] }); });
// Keleth, Sunmane Familiar
clx("Whenever a commander you control attacks, put a +1/+1 counter on it.", R => { R.trig.push({ ev: 'attacks', fn: 'e_commanderAttacks', effects: [cmd('e_keleth')] }); });
// Mishra, Claimed by Gix
clx("Whenever you attack, each opponent loses X life and you gain X life, where X is the number of attacking creatures. If ~ and a creature named Phyrexian Dragon Engine are attacking, and you both own and control them, exile them, then meld them into ~, Lost to Phyrexia. It enters tapped and attacking.", R => { R.trig.push({ ev: 'attacks', fn: 'e_mineAttack', effects: [cmd('e_mishra')] }); });
// Arcum Dagsson
clx("{T}: Target artifact creature's controller sacrifices it. That player may search their library for a noncreature artifact card, put it onto the battlefield, then shuffle.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('e_arcum')]); });
// Dragonlord Silumgar
clx("When ~ enters, gain control of target creature or planeswalker for as long as you control ~.", R => { R.etb.push(cmd('e_silumgar')); R.trig.push({ ev: 'leaves', fn: 'e_selfLeaves', effects: [cmd('e_silumgarBack')] }); });
// Adéwalé, Breaker of Chains
clx("When ~ enters, reveal the top six cards of your library. Put an Assassin, Pirate, or Vehicle card from among them into your hand and the rest on the bottom of your library in a random order.", R => { R.etb.push(cmd('e_adewale')); });
// Ishkanah, Grafwidow
clx("{6}{B}: Target opponent loses 1 life for each Spider you control.", (R, m, ctx) => { act(R, ctx.line, '{6}{B}', [cmd('e_ishkanah')]); });
// Evie Frye
clx("{1}, {T}: Draw a card, then discard a card. When you discard a creature card this way, target creature you control can't be blocked this turn.", (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('e_evie')]); });
// Stiltzkin, Moogle Merchant
clx("{2}, {T}: Target opponent gains control of another target permanent you control. If they do, you draw a card.", (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('e_stiltzkin')]); });
// Kolaghan, the Storm's Fury
clx("Whenever a Dragon you control attacks, creatures you control get +1/+0 until end of turn.", R => { R.trig.push({ ev: 'attacks', fn: 'e_dragonAttacks', effects: [cmd('e_kolaghan')] }); });
// Taborax, Hope's Demise
clx("~ has lifelink as long as it has five or more +1/+1 counters on it.", R => { R.statics.push({ other: false, fn: 'e_taborax', p: 0, q: 0, kw: ['lifelink'] }); });
// Wyleth, Soul of Steel
clx("Whenever ~ attacks, draw a card for each Aura and Equipment attached to it.", R => { R.trig.push({ ev: 'attacks', fn: 'e_selfAttacks', effects: [cmd('e_wyleth')] }); });
// Francisco, Fowl Marauder
clx("Whenever one or more Pirates you control deal damage to a player, ~ explores.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'e_pirateHits', effects: [cmd('e_francisco')] }); });
// Aatchik, Emerald Radian
clx("When ~ enters, create a 1/1 green Insect creature token for each artifact and/or creature card in your graveyard.", R => { R.etb.push(cmd('e_aatchik')); });
// Donatello, the Brains
clx("If one or more tokens would be created under your control, those tokens plus a Mutagen token are created instead.", R => { R.trig.push({ ev: 'tokenMade', fn: 'e_myTokenMade', effects: [cmd('e_donatello')] }); });
// Kaalia, Zenith Seeker
clx("When ~ enters, look at the top six cards of your library. You may reveal an Angel card, a Demon card, and/or a Dragon card from among them and put them into your hand. Put the rest on the bottom of your library in a random order.", R => { R.etb.push(cmd('e_kaaliaZ')); });
// Gut, True Soul Zealot
clx("Whenever you attack, you may sacrifice another creature or an artifact. If you do, create a 4/1 black Skeleton creature token with menace that's tapped and attacking.", R => { R.trig.push({ ev: 'attacks', fn: 'e_mineAttack', effects: [cmd('e_gut')] }); });
// Imskir Iron-Eater
clx("When ~ enters, you draw X cards and you lose X life, where X is half the number of artifacts you control, rounded down.", R => { R.etb.push(cmd('e_imskir')); });
// Lily Bowen, Raging Grandma
clx("At the beginning of your upkeep, double the number of +1/+1 counters on ~ if its power is 16 or less. Otherwise, remove all but one +1/+1 counter from it, then you gain 1 life for each +1/+1 counter removed this way.", R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('e_lily')] }); });
// Raiyuu, Storm's Edge
clx("Whenever a Samurai or Warrior you control attacks alone, untap it. If it's the first combat phase of the turn, there is an additional combat phase after this phase.", R => { R.trig.push({ ev: 'attacks', fn: 'e_aloneSW', effects: [cmd('e_raiyuu')] }); });
// Samut, Vizier of Naktamun
clx("Whenever a creature you control deals combat damage to a player, if that creature entered this turn, draw a card.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'e_newcomerHits', effects: [cmd('e_samut')] }); });
// Vendilion Clique
clx("When ~ enters, look at target player's hand. You may choose a nonland card from it. If you do, that player reveals the chosen card, puts it on the bottom of their library, then draws a card.", R => { R.etb.push(cmd('e_clique')); });
// Quandrix, the Proof
clx("Instant and sorcery spells you cast from your hand have cascade.", R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'e_myInstSorcHand', filter: 'any', effects: [cmd('cascadeCast')] }); });
// Bilbo, Birthday Celebrant
clx("{2}{W}{B}{G}, {T}, Exile ~: Search your library for any number of creature cards, put them onto the battlefield, then shuffle. Activate only if you have 111 or more life.", (R, m, ctx) => { act(R, ctx.line, '{2}{W}{B}{G}, {T}', [cmd('e_bilbo')], a => { a.onlyIf = 'you have 111 or more life'; }); });
// Krile Baldesion
clx("Whenever you cast a noncreature spell, you may return target creature card with mana value equal to that spell's mana value from your graveyard to your hand. Do this only once each turn.", R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'e_myNoncreatureCast', filter: 'any', effects: [cmd('e_krile')] }); });
// Storm, Force of Nature
clx("Whenever ~ deals combat damage to a player, the next instant or sorcery spell you cast this turn has storm.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'e_selfHits', effects: [cmd('e_stormSet')] }); R.trig.push({ ev: 'cast', who: 'any', fn: 'e_stormCast', filter: 'any', effects: [cmd('e_stormCast')] }); });
// Mikey & Leo, Chaos & Order
clx("Whenever you put a counter on a creature you control, draw a card. This ability triggers only once each turn.", R => { R.trig.push({ ev: 'counters', fn: 'e_myCounters', once: 'e_mikey', effects: [cmd('e_mikey')] }); });
// Colfenor, the Last Yew
clx("Whenever ~ or another creature you control dies, return up to one other target creature card with lesser toughness from your graveyard to your hand.", R => { R.trig.push({ ev: 'creatureDies', fn: 'e_selfOrMineDies', effects: [cmd('e_colfenor')] }); });
// Ayara, Widow of the Realm // Ayara, Furnace Queen
clx("{T}, Sacrifice another creature or artifact: ~ deals X damage to target opponent or battle and you gain X life, where X is the sacrificed permanent's mana value.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('e_ayara')], a => { a.cost.sacPerm = 'another creature or artifact'; }); });
// Mr. Foxglove
clx("Whenever ~ attacks, draw cards equal to the number of cards in defending player's hand minus the number of cards in your hand. If you didn't draw cards this way, you may put a creature card from your hand onto the battlefield.", R => { R.trig.push({ ev: 'attacks', fn: 'e_selfAttacks', effects: [cmd('e_foxglove')] }); });
// Surrak, Elusive Hunter
clx("Whenever a creature you control or a creature spell you control becomes the target of a spell or ability an opponent controls, draw a card.", R => { R.trig.push({ ev: 'targeted', fn: 'e_myCreatureTargeted', effects: [cmd('e_surrak')] }); });
// Denethor, Ruling Steward
clx("At the beginning of your end step, if a creature died under your control this turn, create a 1/1 white Human Soldier creature token.", R => { R.trig.push({ ev: 'creatureDies', fn: 'e_markDied', effects: [cmd('e_surrak')] }); R.trig.push({ ev: 'end', who: 'your', effects: [cmd('e_denethor')] }); });
// Blech, Loafing Pest
clx("Whenever you gain life, put a +1/+1 counter on each Pest, Bat, Insect, Snake, and Spider you control.", R => { R.trig.push({ ev: 'gainLife', fn: 'e_myGain', effects: [cmd('e_blech')] }); });
// Paladin Elizabeth Taggerdy
clx("Whenever ~ and at least two other creatures attack, draw a card, then you may put a creature card with mana value X or less from your hand onto the battlefield tapped and attacking, where X is ~'s power.", R => { R.trig.push({ ev: 'attacks', fn: 'e_selfAttacksPlus2', effects: [cmd('e_elizabeth')] }); });
// Demonlord Belzenlok
clx("When ~ enters, exile cards from the top of your library until you exile a nonland card, then put that card into your hand. If the card's mana value is 4 or greater, repeat this process. ~ deals 1 damage to you for each card put into your hand this way.", R => { R.etb.push(cmd('e_belzenlok')); });
// Casey Jones, Back Alley Brute
clx("Whenever you put one or more +1/+1 counters on a creature you control, ~ deals that much damage to target opponent.", R => { R.trig.push({ ev: 'counters', fn: 'e_myCounters', effects: [cmd('e_casey')] }); });
// Prime Speaker Vannifar
clx("{T}, Sacrifice another creature: Search your library for a creature card with mana value equal to 1 plus the sacrificed creature's mana value, put that card onto the battlefield, then shuffle. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('e_vannifar')], a => { a.sorcery = true; a.cost.sacPerm = 'another creature'; }); });
// Blex, Vexing Pest // Search for Blex
clx("Other Pests, Bats, Insects, Snakes, and Spiders you control get +1/+1.", R => { R.statics.push({ other: true, fn: 'e_pest', p: 1, q: 1, kw: [] }); });
// Mog, Moogle Warrior
clx("At the beginning of your end step, each player may discard a card. Each player who discarded a card this way draws a card. If a creature card was discarded this way, you create a 1/2 white Moogle creature token with lifelink. Then if a noncreature card was discarded this way, put a +1/+1 counter on each Moogle you control.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('e_mog')] }); });
// Paladin Danse, Steel Maverick
clx("Exile ~: Each creature you control that's an artifact or Human gains indestructible until end of turn.", (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('e_danse')]); });
// Altanak, the Thrice-Called
clx("Whenever ~ becomes the target of a spell or ability an opponent controls, draw a card.", R => { R.trig.push({ ev: 'targeted', fn: 'e_selfTargeted', effects: [cmd('e_altanak')] }); });
// Siegfried, Famed Swordsman
clx("When ~ enters, mill three cards. Then put X +1/+1 counters on ~, where X is twice the number of creature cards in your graveyard.", R => { R.etb.push(cmd('e_siegfried')); });
// Qala, Ajani's Pridemate
clx("Whenever ~ attacks, other attacking creatures you control get +X/+0 until end of turn, where X is the number of counters on ~.", R => { R.trig.push({ ev: 'attacks', fn: 'e_selfAttacks', effects: [cmd('e_qala')] }); });
// Raphael, the Muscle
clx("Double all damage that creatures you control with counters on them would deal.", R => { R.e_muscle = true; });
// Éowyn, Lady of Rohan
clx("At the beginning of combat on your turn, target creature gains your choice of first strike or vigilance until end of turn. If that creature is equipped, it gains first strike and vigilance until end of turn instead.", R => { R.trig.push({ ev: 'combat', who: 'your', effects: [cmd('e_eowyn')] }); });
