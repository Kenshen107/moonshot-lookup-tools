// Spellslinger Duels - rules pack: commander round 4, batch h (2026-10-26). Wordings only; engine pieces in 15-cmdr300h.js.
// Uses cl / clx / cmd / act / SPEC from rules/cmdr.js. Most-played commanders of the batch first.
// K-9, Mark I
clx("As long as ~ is untapped, other legendary creatures you control have ward {1}.", R => { R.statics.push({ other: true, fn: 'h_legendaryCreature', p: 0, q: 0, kw: ['ward:1'], cond: '~ is untapped' }); });
// Shredder, Shadow Master
clx("Whenever ~ attacks a player, for each other opponent, create a token that's a copy of ~ tapped and attacking that player, except it isn't legendary. Sacrifice those tokens at end of combat.", R => { R.trig.push({ ev: 'attacks', fn: 'h_selfAttacks', effects: [cmd('h_shredder')] }); });
// Martha Jones
clx("Whenever you sacrifice a Clue, ~ and up to one other target creature can't be blocked this turn.", R => { R.trig.push({ ev: 'sacrificed', fn: 'h_sacClue', effects: [cmd('h_martha')] }); });
// Bebop, Skull & Crossbones
clx("Whenever ~ deals combat damage to a player, you may draw X cards, where X is the number of counters on ~. If you do, you lose X life.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_selfHits', effects: [cmd('h_bebop')] }); });
// Estinien Varlineau
clx("At the beginning of your second main phase, you draw X cards and lose X life, where X is the number of your opponents who were dealt combat damage by ~ or a Dragon this turn.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_estNote', effects: [] }); R.trig.push({ ev: 'main2', fn: 'h_myMain2', effects: [cmd('h_estinien')] }); });
// Mishra, Eminent One
clx("At the beginning of combat on your turn, create a token that's a copy of target noncreature artifact you control, except its name is ~'s Warform and it's a 4/4 Construct artifact creature in addition to its other types. It gains haste until end of turn. Sacrifice it at the beginning of the next end step.", R => { R.trig.push({ ev: 'combat', who: 'your', effects: [cmd('h_mishraEm')] }); });
// Yosei, the Morning Star
clx("When ~ dies, target player skips their next untap step. Tap up to five target permanents that player controls.", R => { R.trig.push({ ev: 'dies', effects: [cmd('h_yosei')] }); });
// Krav, the Unredeemed
clx("{B}, Sacrifice X creatures: Target player draws X cards and gains X life. Put X +1/+1 counters on ~.", (R, m, ctx) => { act(R, ctx.line, '{B}', [cmd('h_krav')]); });
// Daxos of Meletis
clx("Whenever ~ deals combat damage to a player, exile the top card of that player's library. You gain life equal to that card's mana value. Until end of turn, you may cast that card and you may spend mana as though it were mana of any color to cast that spell.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_selfHits', effects: [cmd('h_daxos')] }); });
// Mathas, Fiend Seeker
clx("At the beginning of your end step, put a bounty counter on target creature an opponent controls. For as long as that creature has a bounty counter on it, it has \"When ~ dies, each opponent draws a card and gains 2 life.\"", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('h_mathas')] }); R.trig.push({ ev: 'creatureDies', fn: 'h_mathasDies', effects: [cmd('h_mathasDraw')] }); });
// Mirko Vosk, Mind Drinker
clx("Whenever ~ deals combat damage to a player, that player reveals cards from the top of their library until they reveal four land cards, then puts those cards into their graveyard.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_selfHits', effects: [cmd('h_mirko')] }); });
// Seifer Almasy
clx("Whenever ~ deals combat damage to a player, you may cast target instant or sorcery card with mana value 3 or less from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_selfHits', effects: [cmd('h_seifer')] }); });
// Red Hulk
clx("Whenever ~ is dealt damage, put a +1/+1 counter on it. When you do, ~ deals damage equal to the number of +1/+1 counters on him to any other target.", R => { R.trig.push({ ev: 'dealtDamage', fn: 'h_dealtDmg', effects: [cmd('h_hulk')] }); });
// Vela the Night-Clad
clx("Whenever ~ or another creature you control leaves the battlefield, each opponent loses 1 life.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'h_mineLeaves', effects: [cmd('h_vela')] }); });
// Lulu, Loyal Hollyphant
clx("At the beginning of your end step, if a permanent you controlled left the battlefield this turn, put a +1/+1 counter on each tapped creature you control, then untap them.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'h_markLeft', effects: [] }); R.trig.push({ ev: 'end', who: 'your', fn: 'h_leftThisTurn', effects: [cmd('h_lulu')] }); });
// Tiana, Ship's Caretaker
clx("Whenever an Aura or Equipment you control is put into a graveyard from the battlefield, you may return that card to its owner's hand at the beginning of the next end step.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'h_auraEquipLeaves', effects: [cmd('h_tiana')] }); });
// Thantis, the Warweaver
clx("All creatures attack each combat if able.", R => { R.h_thantis = true; });
// Willowdusk, Essence Seer
clx("{1}, {T}: Choose another target creature. Put a number of +1/+1 counters on it equal to the amount of life you gained this turn or the amount of life you lost this turn, whichever is greater. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('h_willowdusk')], a => { a.sorcery = true; }); });
// Ignis Scientia
clx("I've Come Up with a New Recipe! — {1}{G}{U}, {T}: Exile target card from a graveyard. If a creature card was exiled this way, create a Food token.", (R, m, ctx) => { act(R, ctx.line, '{1}{G}{U}, {T}', [cmd('h_ignis')]); });
// Aloy, Savior of Meridian
clx("In You, All Things Are Possible — Whenever one or more artifact creatures you control attack, discover X, where X is the greatest power among them.", R => { R.trig.push({ ev: 'attacks', fn: 'h_artifactAttackers', effects: [cmd('h_aloy')] }); });
// Phabine, Boss's Confidant
clx("At the beginning of combat on your turn, each player reveals the top card of their library. For each land card revealed this way, you create a 1/1 green and white Citizen creature token. Then creatures you control get +1/+1 until end of turn for each nonland card revealed this way. Then each player draws a card.", R => { R.trig.push({ ev: 'combat', who: 'your', effects: [cmd('h_phabine')] }); });
// Zahur, Glory's Past
clx("Whenever a nontoken creature you control dies, create a tapped 2/2 black Zombie creature token.", R => { R.trig.push({ ev: 'creatureDies', another: true, mine: true, nontoken: true, effects: [{ t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: [], tapped: true }] }); });
// Raphael, Tag Team Tough
clx("Whenever ~ deals combat damage to a player for the first time each turn, untap all attacking creatures. After this combat phase, there is an additional combat phase.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_selfHitsFirst', effects: [cmd('h_raphael')] }); });
// Agent Phil Coulson
clx("{T}: Put a +1/+1 counter on each other Hero you control.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('h_coulson')]); });
// Quickbeam, Upstart Ent
clx("Whenever ~ or another Treefolk you control enters, up to two target creatures each get +2/+2 and gain trample until end of turn.", R => { R.trig.push(SPEC('enters', { ctl: 'you', sub: 'Treefolk' }, { effects: [cmd('h_quickbeam')] })); });
// Obzedat, Ghost Council
clx("At the beginning of your end step, you may exile ~. If you do, return it to the battlefield under its owner's control at the beginning of your next upkeep. It gains haste.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('h_obzedat')] }); });
// Tuya Bearclaw
clx("Whenever ~ attacks, it gets +X/+X until end of turn, where X is the greatest power among other creatures you control.", R => { R.trig.push({ ev: 'attacks', fn: 'h_selfAttacks', effects: [cmd('h_tuya')] }); });
// Eshki Dragonclaw
clx("At the beginning of combat on your turn, if you've cast both a creature spell and a noncreature spell this turn, draw a card and put two +1/+1 counters on ~.", R => { R.trig.push({ ev: 'combat', who: 'your', fn: 'h_eshki', effects: [cmd('h_eshki')] }); });
// Alora, Merry Thief
clx("Whenever you attack, up to one target attacking creature can't be blocked this turn. Return that creature to its owner's hand at the beginning of the next end step.", R => { R.trig.push({ ev: 'attacks', fn: 'h_mineAttack', effects: [cmd('h_alora')] }); });
// April O'Neil, Live on the Scene
clx("Whenever a Mutant, Ninja, or Turtle you control enters, investigate.", R => { R.trig.push({ ev: 'enters', fn: 'h_mntEnters', effects: [{ t: 'artToken', kind: 'clue', n: 1 }] }); });
// Karador, Ghost Chieftain
clx("Once during each of your turns, you may cast a creature spell from your graveyard.", (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('h_karador')], a => { a.once = true; a.onlyIf = 'it is your turn'; }); });
// Ares, God of War
clx("Whenever an attacking creature you control dies, return that card to its owner's hand.", R => { R.trig.push({ ev: 'creatureDies', fn: 'h_myAttackerDies', effects: [cmd('h_aresBack')] }); });
// Obuun, Mul Daya Ancestor
clx("At the beginning of combat on your turn, up to one target land you control becomes an X/X Elemental creature with trample and haste until end of turn, where X is ~'s power. It's still a land.", R => { R.trig.push({ ev: 'combat', who: 'your', effects: [cmd('h_obuun')] }); });
// The Notary Hobbits
clx("When ~ enter, if they're not a token, create two tokens that are copies of them, except the tokens aren't legendary.", R => { R.etb.push(cmd('h_hobbits')); });
// Goro-Goro and Satoru
clx("Whenever one or more creatures you control that entered this turn deal combat damage to a player, create a 5/5 red Dragon Spirit creature token with flying.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_newcomerHits', effects: [cmd('h_goro')] }); });
// Tivash, Gloom Summoner
clx("At the beginning of your end step, if you gained life this turn, you may pay X life, where X is the amount of life you gained this turn. If you do, create an X/X black Demon creature token with flying.", R => { R.trig.push({ ev: 'end', who: 'your', fn: 'h_gainedEnd', effects: [cmd('h_tivash')] }); });
// Krang, Master Mind
clx("When ~ enters, if you have fewer than four cards in hand, draw cards equal to the difference.", R => { R.etb.push(cmd('h_krang')); });
// Olivia, Mobilized for War
clx("Whenever another creature you control enters, you may discard a card. If you do, put a +1/+1 counter on that creature, it gains haste until end of turn, and it becomes a Vampire in addition to its other types.", R => { R.trig.push({ ev: 'enters', fn: 'h_otherEnters', effects: [cmd('h_olivia')] }); });
// The Fifth Doctor
clx("At the beginning of your end step, put a +1/+1 counter on each creature you control that didn't attack or enter this turn. Untap those creatures.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('h_fifth')] }); });
// Roalesk, Apex Hybrid
clx("When ~ dies, proliferate, then proliferate again.", R => { R.trig.push({ ev: 'dies', effects: [cmd('h_roalesk')] }); });
// Namor the Sub-Mariner
clx("Whenever you cast a noncreature spell with one or more blue mana symbols in its mana cost, create that many 1/1 blue Merfolk creature tokens.", R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'h_blueNoncreature', filter: 'any', effects: [cmd('h_namor')] }); });
// Arni Metalbrow
clx("Whenever a creature you control attacks or enters attacking, you may pay {1}{R}. If you do, you may put a creature card with mana value less than that creature's mana value from your hand onto the battlefield tapped and attacking.", R => { R.trig.push({ ev: 'attacks', fn: 'h_mineAttack', effects: [cmd('h_arni')] }); });
// Silver Sable, Mercenary Leader
clx("Whenever ~ attacks, target modified creature you control gains lifelink until end of turn.", R => { R.trig.push({ ev: 'attacks', fn: 'h_selfAttacks', effects: [cmd('h_sable')] }); });
// Mysterio, Master of Illusion
clx("When ~ enters, create a 3/3 blue Illusion Villain creature token for each nontoken Villain you control. Exile those tokens when ~ leaves the battlefield.", R => { R.etb.push(cmd('h_mysterio')); R.trig.push({ ev: 'leaves', fn: 'h_mysterioLeaves', effects: [cmd('h_mysterioGone')] }); });
// Jareth, Leonine Titan
clx("{W}: ~ gains protection from the color of your choice until end of turn.", (R, m, ctx) => { act(R, ctx.line, '{W}', [cmd('h_jareth')]); });
// Doctor Doom, Unrivaled
clx("{T}: You draw a card and lose 1 life. Then if your library has no cards in it, you win the game.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('h_doom')]); });
// Hidetsugu, Devouring Chaos
clx("{2}{R}, {T}: Exile the top card of your library. You may play that card this turn. When you exile a nonland card this way, ~ deals damage equal to the exiled card's mana value to any target.", (R, m, ctx) => { act(R, ctx.line, '{2}{R}, {T}', [cmd('h_hidetsugu')]); });
// Azog, Moria's Ruin
clx("When ~ enters, destroy up to one other target creature. Its controller amasses Goblins X, where X is that creature's power. If you controlled that creature, draw a card.", R => { R.etb.push(cmd('h_azog')); });
// Lonis, Genetics Expert
clx("Whenever one or more +1/+1 counters are put on ~, investigate that many times.", R => { R.trig.push({ ev: 'counters', fn: 'h_selfCounters', effects: [cmd('h_lonis')] }); });
// Rhys, the Evermore
clx("{W}, {T}: Remove any number of counters from target creature you control. Activate only as a sorcery.", (R, m, ctx) => { act(R, ctx.line, '{W}, {T}', [cmd('h_rhys')], a => { a.sorcery = true; }); });
// Shiko, Paragon of the Way
clx("When ~ enters, exile target nonland card with mana value 3 or less from your graveyard. Copy it, then you may cast the copy without paying its mana cost.", R => { R.etb.push(cmd('h_shiko')); });
// Wasitora, Nekoru Queen
clx("Whenever ~ deals combat damage to a player, that player sacrifices a creature of their choice. If the player can't, you create a 3/3 black, red, and green Cat Dragon creature token with flying.", R => { R.trig.push({ ev: 'hitPlayer', fn: 'h_selfHits', effects: [cmd('h_wasitora')] }); });
// Jadzi, Oracle of Arcavios // Journey to the Oracle
clx("Whenever you cast or copy an instant or sorcery spell, reveal the top card of your library. If it's a nonland card, you may cast it by paying {1} rather than paying its mana cost. If it's a land card, put it onto the battlefield.", R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'any', fn: 'h_myInstSorc', effects: [cmd('h_jadzi')] }); });
// Donal, Herald of Wings
clx("Whenever you cast a nonlegendary creature spell with flying, you may copy it, except the copy is a 1/1 Spirit in addition to its other types. Do this only once each turn.", R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'h_myCreatureCast', filter: 'any', effects: [cmd('h_donal')] }); });
// Iroh, Tea Master
clx("At the beginning of combat on your turn, you may have target opponent gain control of target permanent you control. When you do, create a 1/1 white Ally creature token. Put a +1/+1 counter on that token for each permanent you own that your opponents control.", R => { R.trig.push({ ev: 'combat', who: 'your', effects: [cmd('h_iroh')] }); });
// Mai and Zuko
clx("You may cast Ally spells and artifact spells as though they had flash.", R => { R.flashTypes = ['Ally', 'Artifact']; });
