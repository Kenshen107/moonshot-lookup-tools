// Spellslinger Duels - rules pack: commander round 3, batch g (2026-10-26). Wordings only; engine pieces in 15-cmdr300g.js. Lines are matched whole, exactly as the reader prints them.

// Abaddon the Despoiler
clx("During your turn, spells you cast from your hand with mana value X or less have cascade, where X is the total amount of life your opponents have lost this turn.", R => { R.trig.push({ ev: 'cast', fn: 'g_abaddonCast', filter: 'any', effects: [cmd('cascadeCast')] }); });
// Veronica, Dissident Scribe
clx("Whenever you discard one or more nonland cards for the first time each turn, create a Junk token.", R => { R.trig.push({ ev: 'discarded', fn: 'g_veronica', effects: [{ t: 'artToken', kind: 'junk', n: 1 }] }); });
// Xavier Sal, Infested Captain
clx("{T}, Remove a counter from another permanent you control: Populate. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('g_xavier')], a => { a.sorcery = true; }); });
// Tawnos, the Toymaker
clx("Whenever you cast a Beast or Bird creature spell, you may copy it, except the copy is an artifact in addition to its other types.", R => { R.trig.push({ ev: 'cast', fn: 'g_tawCast', filter: 'any', effects: [cmd('g_tawnos')] }); });
// Strago and Relm
clx("{2}{R}, {T}: Target opponent exiles cards from the top of their library until they exile an instant, sorcery, or creature card. You may cast that card without paying its mana cost. If you cast a creature spell this way, it gains haste and \"At the beginning of the end step, sacrifice ~.\" Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{2}{R}, {T}', [cmd('g_strago')], a => { a.sorcery = true; }); });
// Quistis Trepe
clx("When ~ enters, you may cast target instant or sorcery card from a graveyard, and mana of any type can be spent to cast that spell. If that spell would be put into a graveyard, exile it instead.", R => { R.etb.push(cmd('g_quistis')); });
// Kothophed, Soul Hoarder
clx("Whenever a permanent owned by another player is put into a graveyard from the battlefield, you draw a card and you lose 1 life.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'g_kotho', effects: [cmd('g_kotho')] }); });
// Mabel, Heir to Cragflame
clx("When ~ enters, create Cragflame, a legendary colorless Equipment artifact token with \"Equipped creature gets +1/+1 and has vigilance, trample, and haste\" and equip {2}.", R => { R.etb.push(cmd('g_mabel')); });
// Shirei, Shizo's Caretaker
clx("Whenever a creature with power 1 or less is put into your graveyard from the battlefield, you may return that card to the battlefield at the beginning of the next end step if ~ is still on the battlefield.", R => { R.trig.push({ ev: 'creatureDies', fn: 'g_shirei', effects: [cmd('g_shirei')] }); });
// Niv-Mizzet Reborn
clx("When ~ enters, reveal the top ten cards of your library. For each color pair, choose a card that's exactly those colors from among them. Put the chosen cards into your hand and the rest on the bottom of your library in a random order.", R => { R.etb.push(cmd('g_niv')); });
// Jason Bright, Glowing Prophet
clx("Whenever a Zombie or Mutant you control dies, if its power was different from its base power, draw a card.", R => { R.trig.push({ ev: 'creatureDies', fn: 'g_jason', effects: [cmd('g_jason')] }); });
// Vito, Fanatic of Aclazotz
clx("Whenever you sacrifice another permanent, you gain 2 life if this is the first time this ability has resolved this turn. If it's the second time, each opponent loses 2 life. If it's the third time, create a 4/3 white and black Vampire Demon creature token with flying.", R => { R.trig.push({ ev: 'sacrificed', fn: 'g_mySac', effects: [cmd('g_vito')] }); });
// Omega, Heartless Evolution
clx("When ~ enters, for each opponent, tap up to one target nonland permanent that opponent controls. Put X stun counters on each of those permanents and you gain X life, where X is the number of nonbasic lands you control.", R => { R.etb.push(cmd('g_omega')); });
// Yidris, Maelstrom Wielder
clx("Whenever ~ deals combat damage to a player, as you cast spells from your hand this turn, they gain cascade.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('g_yidris')] }); R.trig.push({ ev: 'cast', fn: 'g_yidrisCast', filter: 'any', effects: [cmd('cascadeCast')] }); });
// Edgar, King of Figaro
clx("The first time you flip one or more coins each turn, those coins come up heads and you win those flips.", R => { R.g_edgar = true; });
// Hawkeye, Young Avenger
clx("If a source you control would deal noncombat damage to an opponent or a permanent an opponent controls, instead it deals that much damage plus X, where X is ~'s power.", R => { R.g_hawkeye = true; });
// Nashi, Searcher in the Dark
clx("Whenever ~ deals combat damage to a player, you mill that many cards. You may put any number of legendary and/or enchantment cards from among them into your hand. If you put no cards into your hand this way, put a +1/+1 counter on ~.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('g_nashi')] }); });
// Dogmeat, Ever Loyal
clx("Whenever a creature you control that's enchanted or equipped attacks, create a Junk token.", R => { R.trig.push({ ev: 'attacks', fn: 'g_dogAttacks', effects: [cmd('g_dogmeat')] }); });
// Vaevictis Asmadi, the Dire
clx("Whenever ~ attacks, for each player, choose target permanent that player controls. Those players sacrifice those permanents. Each player who sacrificed a permanent this way reveals the top card of their library, then puts it onto the battlefield if it's a permanent card.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('g_vaevictis')] }); });
// Sin, Spira's Punishment
clx("Whenever ~ enters or attacks, exile a permanent card from your graveyard at random, then create a tapped token that's a copy of that card. If the exiled card is a land card, repeat this process.", R => { R.etb.push(cmd('g_sin')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('g_sin')] }); });
// Baba Lysaga, Night Witch
clx("{T}, Sacrifice up to three permanents: If there were three or more card types among the sacrificed permanents, each opponent loses 3 life, you gain 3 life, and you draw three cards.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('g_baba')]); });
// Atemsis, All-Seeing
clx("Whenever ~ deals damage to an opponent, you may reveal your hand. If cards with at least six different mana values are revealed this way, that player loses the game.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('g_atemsis')] }); });
// Legolas, Master Archer
clx("Whenever you cast a spell that targets a creature you don't control, ~ deals damage equal to its power to up to one target creature.", R => { R.trig.push({ ev: 'targeted', fn: 'g_legTarget', effects: [cmd('g_legolas')] }); });
// Sarah Jane Smith
clx("Doctor's companion", R => { });
// Aphelia, Viper Whisperer
clx("{4}{B}: Until end of turn, whenever one or more Gorgons and/or Snakes you control deal combat damage to a player, that player loses half their life, rounded up.", (R, m, ctx) => { act(R, ctx.line, '{4}{B}', [cmd('g_aphelia')]); R.trig.push({ ev: 'hitPlayer', fn: 'g_aphHit', effects: [cmd('g_aphHit')] }); });
// Tatyova, Steward of Tides
clx("Whenever a land you control enters, if you control seven or more lands, up to one target land you control becomes a 3/3 Elemental creature with haste. It's still a land.", R => { R.trig.push({ ev: 'landfall', fn: 'g_myLandfall', effects: [cmd('g_tatyova')] }); });
// Unesh, Criosphinx Sovereign
clx("Whenever ~ or another Sphinx you control enters, reveal the top four cards of your library. An opponent separates those cards into two piles. Put one pile into your hand and the other into your graveyard.", R => { R.trig.push(SPEC('enters', { ctl: 'you', sub: 'Sphinx' }, { effects: [cmd('g_unesh')] })); });
// Ghen, Arcanum Weaver
clx("{R}{W}{B}, {T}, Sacrifice an enchantment: Return target enchantment card from your graveyard to the battlefield.", (R, m, ctx) => { act(R, ctx.line, '{R}{W}{B}, {T}, Sacrifice an Enchantment', [cmd('g_ghen')]); });
// The Destined Black Mage
clx("Whenever you cast a noncreature spell, ~ deals 1 damage to each opponent. If you have a full party, it deals 3 damage to each opponent instead.", R => { R.trig.push({ ev: 'cast', fn: 'g_myNoncreatureCast', filter: 'any', effects: [cmd('g_blackMage')] }); });
// Sierra, Nuka's Biggest Fan
clx("Whenever you sacrifice a Food, target creature you control gets +X/+X until end of turn, where X is the number of quest counters on ~.", R => { R.trig.push({ ev: 'sacrificed', fn: 'g_mySacFood', effects: [cmd('g_sierra')] }); });
// Pharika, God of Affliction
clx("{B}{G}: Exile target creature card from a graveyard. Its owner creates a 1/1 black and green Snake enchantment creature token with deathtouch.", (R, m, ctx) => { act(R, ctx.line, '{B}{G}', [cmd('g_pharika')]); });
// Iron Man, Bleeding Edge
clx("Whenever you cast an artifact spell, you may copy it, except the copy isn't legendary. Do this only once each turn.", R => { R.trig.push({ ev: 'cast', fn: 'g_ironCast', filter: 'any', effects: [cmd('g_ironman')] }); });
// Kethek, Crucible Goliath
clx("At the beginning of your end step, you may sacrifice another creature. If you do, reveal cards from the top of your library until you reveal a nonlegendary creature card with lesser mana value, put it onto the battlefield, then put the rest on the bottom of your library in a random order.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('g_kethek')] }); });
// Ukkima, Stalking Shadow
clx("When ~ leaves the battlefield, it deals X damage to target player and you gain X life, where X is its power.", R => { R.trig.push({ ev: 'leaves', effects: [cmd('g_ukkima')] }); });
// Empress Galina
clx("{U}{U}, {T}: Gain control of target legendary permanent.", (R, m, ctx) => { act(R, ctx.line, '{U}{U}, {T}', [cmd('g_galina')]); });
// Garna, the Bloodflame
clx("When ~ enters, return to your hand all creature cards in your graveyard that were put there from anywhere this turn.", R => { R.etb.push(cmd('g_garna')); });
// Anowon, the Ruin Thief
clx("Whenever one or more Rogues you control deal combat damage to a player, that player mills a card for each 1 damage dealt to them. If the player mills at least one creature card this way, you draw a card.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'g_rogueHit', effects: [cmd('g_anowon')] }); });
// The Eleventh Doctor
clx("I. AM. TALKING! — Whenever ~ deals combat damage to a player, you may exile a card from your hand with a number of time counters on it equal to its mana value. If it doesn't have suspend, it gains suspend.", R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('g_doctor11')] }); });
// The Destined White Mage
clx("Whenever you gain life, put a +1/+1 counter on target creature you control. If you have a full party, put three +1/+1 counters on that creature instead.", R => { R.trig.push({ ev: 'gainLife', fn: 'g_myGain', effects: [cmd('g_whiteMage')] }); });
// Sivriss, Nightmare Speaker
clx("{T}, Sacrifice another creature or an artifact: For each opponent, you mill a card, then return that card from your graveyard to your hand unless that player pays 3 life.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('g_sivriss')], a => { a.cost.sacPerm = 'another creature or artifact'; }); });
// Sensational Spider-Man
clx("Whenever ~ attacks, tap target creature defending player controls and put a stun counter on it. Then you may remove up to three stun counters from among all permanents. Draw cards equal to the number of stun counters removed this way.", R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('g_spider')] }); });
// Heiko Yamazaki, the General
clx("Whenever a Samurai or Warrior you control attacks alone, you may cast target artifact card from your graveyard this turn.", R => { R.trig.push({ ev: 'attacks', fn: 'g_aloneAttack', effects: [cmd('g_heiko')] }); });
// Dwalin, Weaponmaster
clx("Whenever ~ enters or attacks, put a hone counter on each Equipment you control.", R => { R.etb.push(cmd('g_dwalin')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('g_dwalin')] }); });
// Mirri the Cursed
clx("Whenever ~ deals combat damage to a creature, put a +1/+1 counter on ~.", R => { R.trig.push({ ev: 'dealsDamage', fn: 'g_mirriHit', effects: [cmd('g_selfCounter')] }); });
// Bilbo, Fellow Conspirator
clx("If you would create a Food token, instead create a Food token and a Treasure token.", R => { R.g_bilbo = true; });
// Norin, Swift Survivalist
clx("Whenever a creature you control becomes blocked, you may exile it. You may play that card from exile this turn.", R => { R.trig.push({ ev: 'blocked', fn: 'b_myBlocked', effects: [cmd('g_norin')] }); });
// The Sentry, Golden Guardian
clx("When ~ enters, target opponent creates The Void, a legendary 5/5 black Horror Villain creature token with flying, indestructible, and \"The Void attacks each combat if able.\"", R => { R.etb.push(cmd('g_sentry')); });
// Junk token (Veronica, Dogmeat)
clx("{T}, Sacrifice this artifact: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice this artifact', [cmd('g_junk')], a => { a.sorcery = true; }); });
