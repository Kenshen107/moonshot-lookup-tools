// Spellslinger Duels - rules pack: commander round 2, batch b (2026-10-26). Wordings only; engine pieces in 15-cmdr300b.js. Lines are matched whole, exactly as the reader prints them.

// Knuckles the Echidna
clx("At the beginning of your upkeep, if you control thirty or more artifacts, you win the game.", R => { R.trig.push({ ev: 'upkeep', who: 'your', cond: 'you control thirty or more artifacts', effects: [cmd('b_win')] }); });
// The Gaffer
clx("At the beginning of each end step, if you gained 3 or more life this turn, draw a card.", R => { R.trig.push({ ev: 'end', who: 'each', cond: 'you gained three or more life this turn', effects: [{ t: 'draw', n: 1 }] }); });
// Massacre Girl, Known Killer
clx("Whenever a creature an opponent controls dies, if its toughness was less than 1, draw a card.", R => { R.trig.push({ ev: 'creatureDies', fn: 'b_foeDiesZeroTou', effects: [{ t: 'draw', n: 1 }] }); });
// Alesha, Who Laughs at Fate
clx("At the beginning of your end step, if you attacked this turn, return target creature card with mana value less than or equal to ~'s power from your graveyard to the battlefield.", R => { R.trig.push({ ev: 'end', who: 'your', cond: 'you attacked this turn', effects: [cmd('b_alesha')] }); });
// The Locust God
clx("When ~ dies, return it to its owner's hand at the beginning of the next end step.", R => { R.trig.push({ ev: 'dies', effects: [cmd('b_locust')] }); });
// Electro, Assaulting Battery
clx("When ~ leaves the battlefield, you may pay {X}. When you do, ~ deals X damage to target player.", R => { R.trig.push({ ev: 'leaves', effects: [cmd('b_electro')] }); });
// Arwen, Weaver of Hope
clx("Each other creature you control enters with a number of additional +1/+1 counters on it equal to ~'s toughness.", R => { R.trig.push({ ev: 'enters', another: true, ctxTarget: true, effects: [cmd('b_arwen')] }); });
// Kazuul, Tyrant of the Cliffs
clx("Whenever a creature an opponent controls attacks, if you're the defending player, create a 3/3 red Ogre creature token unless that creature's controller pays {3}.", R => { R.trig.push({ ev: 'attacks', fn: 'b_kazuul', effects: [cmd('b_kazuul')] }); });
// Inti, Seneschal of the Sun
clx("Whenever you discard one or more cards, exile the top card of your library. You may play that card until your next end step.", R => { R.trig.push({ ev: 'discarded', fn: 'b_myDiscard', effects: [cmd('b_inti')] }); });
// Venser, Shaper Savant
clx("When ~ enters, return target spell or permanent to its owner's hand.", R => { R.etb.push(cmd('b_venser')); });
// Grazilaxx, Illithid Scholar
clx("Whenever a creature you control becomes blocked, you may return it to its owner's hand.", R => { R.trig.push({ ev: 'blocked', fn: 'b_myBlocked', effects: [cmd('b_grazilaxx')] }); });
// Halana and Alena, Partners
clx("At the beginning of combat on your turn, put X +1/+1 counters on another target creature you control, where X is ~'s power. That creature gains haste until end of turn.", R => { R.trig.push({ ev: 'combat', effects: [cmd('b_halana')] }); });
// Xenagos, God of Revels
clx("At the beginning of combat on your turn, another target creature you control gains haste and gets +X/+X until end of turn, where X is that creature's power.", R => { R.trig.push({ ev: 'combat', effects: [cmd('b_xenagos')] }); });
// Selvala, Explorer Returned
clx("{T}: Each player reveals the top card of their library. For each nonland card revealed this way, add {G} and you gain 1 life. Then each player draws a card.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('b_selvala')]); });
// Klauth, Unrivaled Ancient
clx("Whenever ~ attacks, add X mana in any combination of colors, where X is the total power of attacking creatures. Spend this mana only to cast spells. Until end of turn, you don't lose this mana as steps and phases end.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_klauth')] }); });
// Ioreth of the Healing House
clx("{T}: Untap two other target legendary creatures.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('b_ioreth')]); });
// God-Eternal Oketra
clx("When ~ dies or is put into exile from the battlefield, you may put it into its owner's library third from the top.", R => { R.trig.push({ ev: 'leaves', effects: [cmd('b_oketra')] }); });
// Ureni of the Unwritten
clx("Whenever ~ enters or attacks, look at the top eight cards of your library. You may put a Dragon creature card from among them onto the battlefield. Put the rest on the bottom of your library in a random order.", R => { R.etb.push(cmd('b_ureni')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_ureni')] }); });
// The Lord of Pain
clx("Whenever a player casts their first spell each turn, choose another target player. ~ deals damage equal to that spell's mana value to the chosen player.", R => { R.trig.push({ ev: 'cast', fn: 'b_firstSpell', who: 'any', effects: [cmd('b_lop')] }); });
// Kona, Rescue Beastie
clx("At the beginning of your second main phase, if ~ is tapped, you may put a permanent card from your hand onto the battlefield.", R => { R.trig.push({ ev: 'main2', fn: 'b_main2Tapped', effects: [cmd('b_kona')] }); });
// Rev, Tithe Extractor
clx("Whenever one or more creatures you control deal combat damage to a player, create a Treasure token, then look at the top card of that player's library and exile it face down. You may cast that card for as long as it remains exiled.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'b_revHit', effects: [cmd('b_rev')] }); });
// Sovereign Okinec Ahau
clx("Whenever ~ attacks, for each creature you control with power greater than that creature's base power, put a number of +1/+1 counters on that creature equal to the difference.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_okinec')] }); });
// Ratadrabik of Urborg
clx("Whenever another legendary creature you control dies, create a token that's a copy of that creature, except it's not legendary and it's a 2/2 black Zombie in addition to its other colors and types.", R => { R.trig.push({ ev: 'creatureDies', fn: 'b_legendDies', effects: [cmd('b_rat')] }); });
// Zur the Enchanter
clx("Whenever Zur attacks, you may search your library for an enchantment card with mana value 3 or less, put it onto the battlefield, then shuffle.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_zur')] }); });
// Kefka, Court Mage // Kefka, Ruler of Ruin
clx("Whenever ~ enters or attacks, each player discards a card. Then you draw a card for each card type among cards discarded this way.", R => { R.etb.push(cmd('b_kefka')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_kefka')] }); });
// Oswald Fiddlebender
clx("{W}, {T}, Sacrifice an artifact: Search your library for an artifact card with mana value equal to 1 plus the sacrificed artifact's mana value, put it onto the battlefield, then shuffle. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{W}, {T}, Sacrifice an artifact', [cmd('b_oswald')], a => { a.sorcery = true; }); });
// Otharri, Suns' Glory
clx("Whenever ~ attacks, you get an experience counter. Then create a 2/2 red Rebel creature token that's tapped and attacking for each experience counter you have.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_otharri')] }); });
// Ink-Eyes, Servant of Oni
clx("Whenever ~ deals combat damage to a player, you may put target creature card from that player's graveyard onto the battlefield under your control.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('b_inkeyes')] }); });
// Tiamat
clx("When ~ enters, if you cast it, search your library for up to five Dragon cards not named ~ that each have different names, reveal them, put them into your hand, then shuffle.", R => { R.etb.push(cmd('b_tiamat')); });
// Heartless Hidetsugu
clx("{T}: ~ deals damage to each player equal to half that player's life total, rounded down.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('b_hidetsugu')]); });
// Malcolm, Keen-Eyed Navigator
clx("Whenever one or more Pirates you control deal damage to your opponents, you create a Treasure token for each opponent dealt damage.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'pirateHit', effects: [cmd('b_malcolmK')] }); });
// Fandaniel, Telophoroi Ascian
clx("At the beginning of your end step, each opponent may sacrifice a nontoken creature of their choice. Each opponent who doesn't loses 2 life for each instant and sorcery card in your graveyard.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('b_fandaniel')] }); });
// Rakdos, Patron of Chaos
clx("At the beginning of your end step, target opponent may sacrifice two nonland, nontoken permanents of their choice. If they don't, you draw two cards.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('b_rakdosPatron')] }); });
// Mendicant Core, Guidelight
clx("Whenever you cast an artifact spell, you may pay {1}. If you do, copy it.", R => { R.trig.push(SPEC('cast', { ctl: 'you', type: 'Artifact' }, { effects: [cmd('b_mendicant')] })); });
// Lathiel, the Bounteous Dawn
clx("At the beginning of each end step, if you gained life this turn, distribute up to that many +1/+1 counters among any number of other target creatures.", R => { R.trig.push({ ev: 'end', who: 'each', cond: 'you gained life this turn', effects: [cmd('b_lathiel')] }); });
// Clive, Ifrit's Dominant // Ifrit, Warden of Inferno
clx("When ~ enters, you may discard your hand, then draw cards equal to your devotion to red.", R => { R.etb.push(cmd('b_clive')); });
// Neheb, the Eternal
clx("At the beginning of each of your postcombat main phases, add {R} for each 1 life your opponents have lost this turn.", R => { R.trig.push({ ev: 'main2', fn: 'b_main2Mine', effects: [cmd('b_neheb')] }); });
// Ashling, Flame Dancer
clx("Whenever you cast or copy an instant or sorcery spell, discard a card, then draw a card. If this is the second time this ability has resolved this turn, ~ deals 2 damage to each opponent and each creature they control. If it's the third time, add {R}{R}{R}{R}.", R => { R.trig.push({ ev: 'cast', filter: 'instant or sorcery', effects: [cmd('b_ashling')] }); });
// Malcolm, Alluring Scoundrel
clx("Whenever ~ deals combat damage to a player, put a chorus counter on it. Draw a card, then discard a card. If there are four or more chorus counters on ~, you may cast the discarded card without paying its mana cost.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('b_malcolmA')] }); });
// Phelia, Exuberant Shepherd
clx("Whenever ~ attacks, exile up to one other target nonland permanent. At the beginning of the next end step, return that card to the battlefield under its owner's control. If it entered under your control, put a +1/+1 counter on ~.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('b_phelia')] }); });
// Jaxis, the Troublemaker
clx("{R}, {T}, Discard a card: Create a token that's a copy of another target creature you control. It gains haste and \"When ~ dies, draw a card.\" Sacrifice it at the beginning of the next end step. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{R}, {T}, Discard a card', [cmd('b_jaxis')], a => { a.sorcery = true; }); });
// Tergrid, God of Fright // Tergrid's Lantern
clx("Whenever an opponent sacrifices a nontoken permanent or discards a permanent card, you may put that card from a graveyard onto the battlefield under your control.", R => { R.trig.push({ ev: 'sacrificed', fn: 'b_foeSacNontoken', effects: [cmd('b_tergrid')] }); R.trig.push({ ev: 'discarded', fn: 'b_foeDiscardPerm', effects: [cmd('b_tergrid')] }); });
// Titania, Protector of Argoth
clx("Whenever a land you control is put into a graveyard from the battlefield, create a 5/3 green Elemental creature token.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'b_landLeaves', effects: [cmd('b_titania')] }); });
// Shalai, Voice of Plenty
clx("You, planeswalkers you control, and other creatures you control have hexproof.", R => { R.statics.push({ other: true, type: null, p: 0, q: 0, kw: ['hexproof'] }); });
// Freyalise, Llanowar's Fury
clx("−6: Draw a card for each green creature you control.", (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('b_freyalise')]); });
// Emiel the Blessed
clx("{3}: Exile another target creature you control, then return it to the battlefield under its owner's control.", (R, m, ctx) => { act(R, ctx.line, '{3}', [cmd('b_emiel')]); });
// The Unagi of Kyoshi Island
clx("Ward—Waterbend {4}.", R => { R.ward = 4; });
// Gríma, Saruman's Footman
clx("Whenever ~ deals combat damage to a player, that player exiles cards from the top of their library until they exile an instant or sorcery card. You may cast that card without paying its mana cost. Then that player puts the exiled cards that weren't cast this way on the bottom of their library in a random order.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('b_grima')] }); });
// Gonti, Lord of Luxury
clx("When ~ enters, look at the top four cards of target opponent's library, exile one of them face down, then put the rest on the bottom of that library in a random order. You may cast that card for as long as it remains exiled, and mana of any type can be spent to cast that spell.", R => { R.etb.push(cmd('b_gonti')); });
// Nissa, Resurgent Animist
clx("Whenever a land you control enters, add one mana of any color. Then if this is the second time this ability has resolved this turn, reveal cards from the top of your library until you reveal an Elf or Elemental card. Put that card into your hand and the rest on the bottom of your library in a random order.", R => { R.trig.push({ ev: 'landfall', fn: 'b_myLandfall', effects: [cmd('b_nissa')] }); });
// Varragoth, Bloodsky Sire
clx("{1}{B}: Target player searches their library for a card, then shuffles and puts that card on top.", (R, m, ctx) => { act(R, ctx.line, '{1}{B}', [cmd('b_varragoth')]); });
// Eladamri, Korvecdal
clx("{G}, {T}, Tap two untapped creatures you control: Reveal a card from your hand or the top card of your library. If you reveal a creature card this way, put it onto the battlefield. Activate only during your turn.", (R, m, ctx) => { act(R, ctx.line, '{G}, {T}, Tap two untapped creatures you control', [cmd('b_eladamri')], a => { a.yourTurn = true; }); });
// Mina and Denn, Wildborn
clx("{R}{G}, Return a land you control to its owner's hand: Target creature gains trample until end of turn.", (R, m, ctx) => { act(R, ctx.line, '{R}{G}', [cmd('b_mina')], a => { a.cost.returnLands = 1; }); });
// Baird, Steward of Argive
clx("Creatures can't attack you or planeswalkers you control unless their controller pays {1} for each of those creatures.", R => { R.attackTax = 1; });
// Linvala, Keeper of Silence
clx("Activated abilities of creatures your opponents control can't be activated.", R => { R.b_linvala = true; });
// Massacre Girl
clx("When ~ enters, each other creature gets -1/-1 until end of turn. Whenever a creature dies this turn, each creature other than ~ gets -1/-1 until end of turn.", R => { R.etb.push(cmd('b_massacreGirl')); });
// Brago, King Eternal
clx("Whenever ~ deals combat damage to a player, exile any number of target nonland permanents you control, then return those cards to the battlefield under their owner's control.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('b_brago')] }); });
// Éowyn, Fearless Knight
clx("When ~ enters, exile target creature an opponent controls with greater power. Legendary creatures you control gain protection from each of that creature's colors until end of turn.", R => { R.etb.push(cmd('b_eowyn')); });
// Iroas, God of Victory
clx("Prevent all damage that would be dealt to attacking creatures you control.", R => { R.b_iroas = true; });
// Lae'zel, Vlaakith's Champion
clx("If you would put one or more counters on a creature or planeswalker you control or on yourself, put that many plus one of each of those kinds of counters on that permanent or player instead.", R => { R.counterBonus = ['Creature']; });
// Squee, the Immortal
clx("You may cast ~ from your graveyard or from exile.", R => { R.gyCast = { life: 0, discard: 0, exile: false }; });
// Thalisse, Reverent Medium
clx("At the beginning of each end step, create X 1/1 white Spirit creature tokens with flying, where X is the number of tokens you created this turn.", R => { R.trig.push({ ev: 'end', who: 'each', effects: [cmd('b_thalisse')] }); });
// Gluntch, the Bestower
clx("At the beginning of your end step, choose a player. They put two +1/+1 counters on a creature they control. Choose a second player to draw a card. Then choose a third player to create two Treasure tokens.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('b_gluntch')] }); });
