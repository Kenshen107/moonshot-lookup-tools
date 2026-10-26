// Spellslinger Duels - rules pack: commander round 4, batch j (2026-10-26). Wordings only; engine pieces in 15-cmdr300j.js. Lines are matched whole, exactly as the reader prints them.
// Cait, Cage Brawler
clx("Whenever ~ attacks, you and defending player each draw a card, then discard a card. Put two +1/+1 counters on ~ if you discarded the card with the greatest mana value among those cards or tied for greatest.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_cait')] }); });
// Laurine, the Diversion
clx("{2}, Sacrifice an artifact or creature: Goad target creature.", (R, m, ctx) => { act(R, ctx.line, '{2}, Sacrifice an artifact or creature', [cmd('goadTarget', { target: 'creature', theirs: true, good: false })]); });
// Caparocti Sunborn
clx("Whenever ~ attacks, you may tap two untapped artifacts and/or creatures you control. If you do, discover 3.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_capar')] }); });
// Nicol Bolas
clx("Whenever ~ deals damage to an opponent, that player discards their hand.", (R, m, ctx) => { R.trig.push({ ev: 'hitPlayer', fn: 'j_selfHit', effects: [cmd('j_bolas')] }); });
// Urza, Powerstone Prodigy
clx("Whenever you discard one or more artifact cards, create a tapped Powerstone token. This ability triggers only once each turn.", (R, m, ctx) => { R.trig.push({ ev: 'discarded', fn: 'j_urzaDisc', effects: [cmd('j_urza')] }); });
// Tesak, Judith's Hellhound
clx("Creatures you control with counters on them have haste.", (R, m, ctx) => { R.statics.push({ other: false, fn: 'j_hasCounter', p: 0, q: 0, kw: ['haste'] }); });
// Atris, Oracle of Half-Truths
clx("When ~ enters, target opponent looks at the top three cards of your library and separates them into a face-down pile and a face-up pile. Put one pile into your hand and the other into your graveyard.", (R, m, ctx) => { R.etb.push(cmd('j_atris')); });
// Geist of Saint Traft
clx("Whenever ~ attacks, create a 4/4 white Angel creature token with flying that's tapped and attacking. Exile that token at end of combat.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_geist')] }); });
// Kydele, Chosen of Kruphix
clx("{T}: Add {C} for each card you've drawn this turn.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('j_kydele')]); });
// Shadowfax, Lord of Horses
clx("Whenever ~ attacks, you may put a creature card with lesser power from your hand onto the battlefield tapped and attacking.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_shadowfax')] }); });
// Rosnakht, Heir of Rohgahh
clx("Whenever you cast a spell that targets ~, create a 0/1 red Kobold creature token named Kobolds of Kher Keep.", (R, m, ctx) => { R.trig.push({ ev: 'cast', fn: 'targetsMe', who: 'any', filter: 'any', effects: [{ t: 'token', n: 1, p: 0, q: 1, name: 'red Kobold', kw: [] }] }); });
// Sally Pride, Lioness Leader
clx("When ~ enters, create X 2/2 red Mutant creature tokens, where X is the number of nontoken creatures you control.", (R, m, ctx) => { R.etb.push(cmd('j_sally')); });
// Jirina Kudro
clx("When ~ enters, create a 1/1 white Human Soldier creature token for each time you've cast a commander from the command zone this game.", (R, m, ctx) => { R.etb.push(cmd('j_jirina')); });
// Gregor, Shrewd Magistrate
clx("Whenever ~ deals combat damage to a player, draw cards equal to its power.", (R, m, ctx) => { R.trig.push({ ev: 'hitPlayer', fn: 'j_selfHit', effects: [cmd('j_gregor')] }); });
// Jet, Rebel Leader
clx("Whenever ~ attacks, look at the top five cards of your library. You may put a creature card with mana value 3 or less from among them onto the battlefield tapped and attacking. Put the rest on the bottom of your library in a random order.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_jet')] }); });
// Oyobi, Who Split the Heavens
clx("Whenever you cast a Spirit or Arcane spell, create a 3/3 white Spirit creature token with flying.", (R, m, ctx) => { R.trig.push({ ev: 'cast', fn: 'j_oyobi', filter: 'any', effects: [{ t: 'token', n: 1, p: 3, q: 3, name: 'white Spirit', kw: ['flying'] }] }); });
// Ryan Sinclair
clx("Whenever ~ attacks, exile cards from the top of your library until you exile a nonland card. You may cast the exiled card without paying its mana cost if it's a spell with mana value less than or equal to ~'s power. Put the exiled cards not cast this way on the bottom of your library in a random order.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_ryan')] }); });
// The First Doctor
clx("Whenever you cast a spell with cascade, put a +1/+1 counter on target artifact or creature.", (R, m, ctx) => { R.trig.push({ ev: 'cast', fn: 'j_cascadeCast', filter: 'any', effects: [cmd('j_doctor1')] }); });
// Psemilla, Meletian Poet
clx("Whenever you cast your first enchantment spell each turn, create a 2/2 white Nymph enchantment creature token.", (R, m, ctx) => { R.trig.push({ ev: 'cast', fn: 'j_psem', filter: 'any', effects: [cmd('j_psem')] }); });
// Rufus Shinra
clx("Whenever ~ attacks, if you don't control a creature named Darkstar, create Darkstar, a legendary 2/2 white and black Dog creature token.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_rufus')] }); });
// Toshiro Umezawa
clx("Whenever a creature an opponent controls dies, you may cast target instant card from your graveyard. If that spell would be put into a graveyard, exile it instead.", (R, m, ctx) => { R.trig.push({ ev: 'creatureDies', fn: 'j_oppCreatureDies', effects: [cmd('j_toshiro')] }); });
// Nath of the Gilt-Leaf
clx("At the beginning of your upkeep, you may have target opponent discard a card at random.", (R, m, ctx) => { R.trig.push({ ev: 'upkeep', fn: 'j_myUpkeep', effects: [cmd('j_nath')] }); });
// Captain Vargus Wrath
clx("Whenever ~ attacks, Pirates you control get +1/+1 until end of turn for each time you've cast a commander from the command zone this game.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_vargus')] }); });
// Jorn, God of Winter // Kaldring, the Rimestaff
clx("Whenever ~ attacks, untap each snow permanent you control.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_jorn')] }); });
// Ulasht, the Hate Seed
clx("~ enters with a +1/+1 counter on it for each other red creature you control and a +1/+1 counter on it for each other green creature you control.", (R, m, ctx) => { R.etbCountersPer = 'j_ulasht'; });
// Sami, Ship's Engineer
clx("At the beginning of your end step, if you control two or more tapped creatures, create a tapped 2/2 colorless Robot artifact creature token.", (R, m, ctx) => { R.trig.push({ ev: 'end', fn: 'j_myEnd', effects: [cmd('j_sami')] }); });
// Mai, Jaded Edge
clx("{3}: Put a double strike counter on ~.", (R, m, ctx) => { act(R, ctx.line, '{3}', [cmd('j_mai')]); });
// Rhino, Barreling Brute
clx("Whenever ~ attacks, if you've cast a spell with mana value 4 or greater this turn, draw a card.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_rhino')] }); R.trig.push({ ev: 'cast', fn: 'j_rhinoCast', filter: 'any', effects: [cmd('j_rhino')] }); });
// Karvanista, Loyal Lupari // Lupari Shield
clx("Whenever ~ attacks, put a +1/+1 counter on each Human you control.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_karvanista')] }); });
// Raff, Weatherlight Stalwart
clx("Whenever you cast an instant or sorcery spell, you may tap two untapped creatures you control. If you do, draw a card.", (R, m, ctx) => { R.trig.push({ ev: 'cast', fn: 'j_raffCast', filter: 'any', effects: [cmd('j_raff')] }); });
// Bosco, Just a Bear
clx("When ~ enters, create a Food token for each legendary creature you control.", (R, m, ctx) => { R.etb.push(cmd('j_bosco')); });
// Wilfred Mott
clx("At the beginning of your upkeep, put a time counter on ~. Then look at the top X cards of your library, where X is the number of time counters on ~. You may put a nonland permanent card with mana value 3 or less from among them onto the battlefield. Put the rest on the bottom of your library in a random order.", (R, m, ctx) => { R.trig.push({ ev: 'upkeep', fn: 'j_myUpkeep', effects: [cmd('j_wilfred')] }); });
// Nikara, Lair Scavenger
clx("Whenever another creature you control leaves the battlefield, if it had one or more counters on it, you draw a card and you lose 1 life.", (R, m, ctx) => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'j_nikara', effects: [cmd('j_nikara')] }); });
// Thorin, Company's Leader
clx("Whenever a Dwarf you control deals combat damage to a player or battle, create two Treasure tokens.", (R, m, ctx) => { R.trig.push({ ev: 'hitPlayer', fn: 'j_dwarfHit', effects: [cmd('j_thorin')] }); });
// Rulik Mons, Warren Chief
clx("Whenever ~ attacks, look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped. If you didn't put a card onto the battlefield this way, create a 1/1 red Goblin creature token.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_selfAttacks', effects: [cmd('j_rulik')] }); });
// The Thing, Ben Grimm
clx("Whenever one or more Heroes you control deal damage to a player, put two +1/+1 counters on ~.", (R, m, ctx) => { R.trig.push({ ev: 'hitPlayer', fn: 'j_heroHit', effects: [cmd('j_thing')] }); });
// Torsten, Founder of Benalia
clx("When ~ enters, reveal the top seven cards of your library. Put any number of creature and/or land cards from among them into your hand and the rest on the bottom of your library in a random order.", (R, m, ctx) => { R.etb.push(cmd('j_torsten')); });
// Mishra, Excavation Prodigy
clx("Whenever you discard one or more artifact cards, add {R}{R}. This ability triggers only once each turn.", (R, m, ctx) => { R.trig.push({ ev: 'discarded', fn: 'j_mishraDisc', effects: [cmd('j_mishra')] }); });
// Muzzio, Visionary Architect
clx("{3}{U}, {T}: Look at the top X cards of your library, where X is the greatest mana value among artifacts you control. You may put an artifact card from among them onto the battlefield. Put the rest on the bottom of your library in any order.", (R, m, ctx) => { act(R, ctx.line, '{3}{U}, {T}', [cmd('j_muzzio')]); });
// Eutropia the Twice-Favored
clx("Whenever an enchantment you control enters, put a +1/+1 counter on target creature. That creature gains flying until end of turn.", (R, m, ctx) => { R.trig.push({ ev: 'enters', fn: 'j_enchEnters', effects: [cmd('j_eutropia')] }); });
// Radagast, Wizard of Wilds
clx("Beasts and Birds you control have ward {1}.", (R, m, ctx) => { R.statics.push({ other: false, type: 'Beast', p: 0, q: 0, kw: ['ward:1'] }); R.statics.push({ other: false, type: 'Bird', p: 0, q: 0, kw: ['ward:1'] }); });
// Arjun, the Shifting Flame
clx("Whenever you cast a spell, put the cards in your hand on the bottom of your library in any order, then draw that many cards.", (R, m, ctx) => { R.trig.push({ ev: 'cast', fn: 'j_myCast', filter: 'any', effects: [cmd('j_arjun')] }); });
// Brigid, Hero of Kinsbaile
clx("{T}: ~ deals 2 damage to each attacking or blocking creature target player controls.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('j_brigid')]); });
// Pol Jamaar, Illusionist
clx("When ~ enters, choose a creature type. Draw a card for each creature you control of that type.", (R, m, ctx) => { R.etb.push(cmd('j_pol')); });
// Ashling, the Extinguisher
clx("Whenever ~ deals combat damage to a player, choose target creature that player controls. The player sacrifices that creature.", (R, m, ctx) => { R.trig.push({ ev: 'hitPlayer', fn: 'j_selfHit', effects: [cmd('j_ashling')] }); });
// Orah, Skyclave Hierophant
clx("Whenever ~ or another Cleric you control dies, return target Cleric card with lesser mana value from your graveyard to the battlefield.", (R, m, ctx) => { R.trig.push({ ev: 'creatureDies', fn: 'j_orahDies', effects: [cmd('j_orah')] }); });
// Vrestin, Menoptra Leader
clx("Whenever you attack with one or more Insects, put a +1/+1 counter on each of them.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_insects', effects: [cmd('j_vrestin')] }); });
// Kestia, the Cultivator
clx("Whenever an enchanted creature or enchantment creature you control attacks, draw a card.", (R, m, ctx) => { R.trig.push({ ev: 'attacks', fn: 'j_enchAttack', effects: [cmd('j_kestia')] }); });
// Pia Nalaar
clx("{1}{R}: Target artifact creature gets +1/+0 until end of turn.", (R, m, ctx) => { act(R, ctx.line, '{1}{R}', [cmd('j_pia')]); });
// Shizuko, Caller of Autumn
clx("At the beginning of each player's upkeep, that player adds {G}{G}{G}. Until end of turn, they don't lose this mana as steps and phases end.", (R, m, ctx) => { R.trig.push({ ev: 'upkeep', fn: 'j_anyUpkeep', effects: [cmd('j_shizuko')] }); });
// Vogar, Necropolis Tyrant
clx("Whenever another creature dies during your turn, put a +1/+1 counter on ~.", (R, m, ctx) => { R.trig.push({ ev: 'creatureDies', fn: 'j_vogar', effects: [cmd('j_vogar')] }); });
// Edea, Possessed Sorceress
clx("Whenever a creature you control but don't own dies, return it to the battlefield under its owner's control and you draw a card.", (R, m, ctx) => { R.trig.push({ ev: 'creatureDies', fn: 'j_edea', effects: [cmd('j_edea')] }); });
