// Spellslinger Duels - rules pack: seven owner decks (2026-11-21): Ulalek, Tifa, Progenitus, Ms. Bumbleflower, Kardur, Captain America, Lavinia.
// Wordings only; engine pieces are in 15zj-sevendecks.js (CMD ids start with sv_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text uses the reader's "~" form; "97" stands for X.
const SV_SCION = n => ({ t: 'token', n, p: 1, q: 1, name: 'colorless Eldrazi Scion', kw: [], text: 'Sacrifice ~: Add {C}.' });
const SV_SPAWN = n => ({ t: 'token', n, p: 0, q: 1, name: 'colorless Eldrazi Spawn', kw: [], text: 'Sacrifice ~: Add {C}.' });
const SV_NUMW = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };
CMD_REWRITES.push([/Create (a|one|two|three|four|five) 1\/1 colorless Eldrazi Scion creature tokens?\. (?:They|It) (?:have|has) "Sacrifice ~: Add \{C\}\."/gi, (m, n) => `§svScion${SV_NUMW[n.toLowerCase()]}.`]);
CMD_REWRITES.push([/Create (a|one|two|three|four|five) 0\/1 colorless Eldrazi Spawn creature tokens?\. (?:They|It) (?:have|has) "Sacrifice ~: Add \{C\}\."/gi, (m, n) => `§svSpawn${SV_NUMW[n.toLowerCase()]}.`]);
registerRules({
    name: 'sevendecks',
    effects: [
        [/^§svScion(\d)$/, m => SV_SCION(+m[1])],
        [/^§svSpawn(\d)$/, m => SV_SPAWN(+m[1])],
        [/^exile target creature with power or toughness 1 or less$/i, () => cmd('sv_exileSmall', { target: 'creature' })],
        [/^counter target sorcery spell$/i, () => cmd('sv_counterSorc', { target: 'spell' })],
        [/^return target creature card with mana value 4 or less from your graveyard to the battlefield tapped$/i, () => cmd('sv_phoenixRaise')],
        [/^exile target skeleton, spirit, or zombie$/i, () => cmd('sv_phoenixExile')]
    ]
});
cl(/^Choose three\. You may choose the same mode more than once\.$/, (R, m, ctx) => { let k = ctx.li + 1; while (k < ctx.lines.length && /^•/.test(ctx.lines[k])) k++; R.spell = [cmd('sv_confluence')]; ctx.li = k - 1; return true; });
// ===== Ulalek, Fused Atrocity =====
clx('Whenever you cast an Eldrazi spell, you may pay {C}{C}. If you do, copy all spells you control, then copy all other activated and triggered abilities you control. You may choose new targets for the copies.', R => { R.trig.push({ ev: 'cast', filter: 'any', fn: 'svEldraziSpell', effects: [cmd('sv_ulalek')] }); });
clx('Whenever ~ deals combat damage to a player, that player exiles cards from the top of their library until they exile a nonland card. You may cast that card by paying life equal to the spell\'s mana value rather than paying its mana cost.', R => { R.trig.push({ ev: 'hitPlayer', host: true, effects: [cmd('sv_mindrender')] }); });
clx('When ~ enters, sacrifice it unless you tap an untapped permanent you control.', R => { R.etb.push(cmd('sv_bridge')); });
clx('Sacrifice an Eldrazi Scion: Tap target creature.', (R, m, ctx) => { act(R, ctx.line, '{0}', [{ t: 'tap', target: 'creature' }], a => { a.cost.sacPerm = 'Scion'; }); });
clx('{2}{C}: Exile another target creature, then return it to the battlefield tapped under its owner\'s control.', (R, m, ctx) => { act(R, ctx.line, '{2}{C}', [cmd('sv_blinkTapped', { target: 'creature', filter: 'other' })]); });
clx('At the beginning of combat on your turn, target creature you control gains haste and gets +X/+0 until end of turn, where X is the number of Eldrazi you control.', R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('sv_linebreaker', { target: 'creature', filter: 'mine' })] }); });
clx('At the beginning of your upkeep, sacrifice a creature. If you can\'t, sacrifice ~.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sv_monument')] }); });
clx('Overload {4}{C}', R => { R.overload = { cost: parseCost('{4}{C}'), spell: [cmd('sv_immunityAll')], text: 'Overload {4}{C}' }; });
clx('Ward—Sacrifice three permanents.', R => { R.svWardSac = { n: 3 }; });
clx('Ward—Sacrifice two permanents.', R => { R.svWardSac = { n: 2 }; });
clx('Ward—Sacrifice a permanent with mana value 1 or greater.', R => { R.svWardSac = { n: 1, mv1: true }; });
clx('Ward—Sacrifice a permanent.', R => { R.svWardSac = { n: 1 }; });
clx('Ward—Sacrifice three nonland permanents.', R => { R.svWardSac = { n: 3, nonland: true }; });
clx('{3}, Exile ~ from your hand: Target land gains "{T}: Add {C}{C}" until ~ is cast from exile. You may cast ~ for as long as it remains exiled.', (R, m, ctx) => { act(R, ctx.line, '{3}, Exile ~ from your hand', [cmd('sv_emrakulLand')]); R.svEmrakulCastExile = true; });
clx('When you cast ~, gain control of all creatures target player controls.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_stealAll', { target: 'player', filter: 'opp' })]); });
clx('Flying, protection from spells and from permanents that were cast this turn', R => { R.kw.add('flying'); R.svProSpells = true; });
clx('When ~ leaves the battlefield, sacrifice all creatures you control.', R => { R.trig.push({ ev: 'leaves', effects: [cmd('sv_sacAll')] }); });
clx('Madness—Pay six {C}.', R => { R.madness = parseCost('{C}{C}{C}{C}{C}{C}'); });
clx('{C}, {T}: Target creature can\'t attack or block this turn.', (R, m, ctx) => { act(R, ctx.line, '{C}, {T}', [cmd('sv_lock', { target: 'creature' })]); });
clx('Whenever another colorless creature you control enters, ~ deals 1 damage to each opponent.', R => { R.trig.push({ ev: 'enters', another: true, ctxTarget: true, fn: 'svColorlessCreature', effects: [cmd('sv_ping1')] }); });
clx('Enchant creature, land, or planeswalker', R => { R.aura = true; R.auraTarget = 'creature, land or planeswalker'; });
clx('Enchanted permanent is a colorless land with "{T}: Add {C}" and loses all other card types and abilities.', R => { R.svMoon = true; });
clx('You may pay {W}{U}{B}{R}{G} rather than pay the mana cost for spells you cast.', R => { R.svJodah = true; });
clx('{2}{U}: Put an hour counter on ~.', (R, m, ctx) => { act(R, ctx.line, '{2}{U}', [cmd('sv_hour')]); });
clx('At the beginning of each upkeep, put an hour counter on ~.', R => { R.trig.push({ ev: 'upkeep', who: 'each', effects: [cmd('sv_hour')] }); });
clx('When the twelfth hour counter is put on ~, shuffle your hand and graveyard into your library, then draw seven cards. Exile ~.', R => { R.svClock = true; });
clx('You may cast colorless spells and artifact spells as though they had flash.', R => { R.flashTypes = ['Artifact']; R.svFlashColorless = true; });
clx('Whenever you cast a spell, if the amount of mana spent to cast that spell is greater than ~\'s power, put a +1/+1 counter on ~.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'your', effects: [cmd('sv_liberator')] }); });
clx('Spells of the chosen type you cast cost {W}{U}{B}{R}{G} less to cast. This effect reduces only the amount of colored mana you pay.', R => { R.svMorophon = true; });
clx('When you cast ~, remove all counters from up to one target permanent or opponent. The next spell you cast this turn costs {1} less to cast for each counter removed this way.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_cultist')]); });
clx('You may cast artifact spells and colorless spells from the top of your library.', R => { R.svForge = true; });
clx('When you cast ~, target opponent exiles the top four cards of their library, then you may put any number of land cards that player owns from exile onto the battlefield under your control.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_sower')]); });
clx('{T}: Put a +1/+1 counter on target colorless creature that entered this turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sv_oranRief', { target: 'creature', filter: 'colorlessEntered' })]); });
clx('Each player chooses a color. Then exile each permanent unless it\'s colorless or it\'s only the color its controller chose.', R => { R.spell = [cmd('sv_selective')]; });
clx('Whenever a land an opponent controls enters, that player exiles the top two cards of their library and you draw two cards.', R => { R.trig.push({ ev: 'enters', who: 'any', fn: 'svOppLand', effects: [cmd('sv_sire')] }); });
clx('At the beginning of your end step, return up to one target Eldrazi creature card from your graveyard to your hand. Create two 1/1 colorless Eldrazi Scion creature tokens with "Sacrifice ~: Add {C}."', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('sv_protector'), SV_SCION(2)] }); });
clx('{6}, {T}, Sacrifice ~: Create three 1/1 colorless Eldrazi Scion creature tokens. They have "Sacrifice ~: Add {C}."', (R, m, ctx) => { act(R, ctx.line, '{6}, {T}, Sacrifice ~', [SV_SCION(3)]); });
clx('Exile 97 target cards from target player\'s graveyard. For each card exiled this way, that player loses 1 life and you gain 1 life.', R => { R.spell = [cmd('sv_suffer', { x: 97, target: 'player' })]; });
clx('When you cast ~ and whenever ~ attacks, put a +1/+1 counter on each colorless creature you control.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_vanguard')]); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('sv_vanguard')] }); });
clx('{2}, {T}: You gain 1 life for each colorless creature you control.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('sv_tomb')]); });
clx('Whenever you attack, choose odd or even. Creatures with mana value of that quality can\'t block this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'anyAttackMine', once: 'twins', effects: [cmd('sv_twins')] }); });
clx('Each other colorless creature you control has bloodthirst 2.', R => { R.svBloodthirst = true; });
clx('When you cast ~, exile up to one target permanent that\'s one or more colors.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_uginExile', { target: 'perm', filter: 'colored' })]); });
clx('Whenever you cast a colorless spell, exile up to one target permanent that\'s one or more colors.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'your', fn: 'svColorlessSpell', effects: [cmd('sv_uginExile', { target: 'perm', filter: 'colored' })] }); });
clx('−11: Search your library for any number of colorless nonland cards, exile them, then shuffle. Until end of turn, you may cast those cards without paying their mana costs.', (R, m, ctx) => { R.acts.push({ loyalty: -11, effects: [cmd('sv_uginUlt')], text: ctx.line, sorcery: true }); });
clx('When ~ enters, you may exile a colorless card with mana value 7 or greater from your hand.', R => { R.etb.push(cmd('sv_labyrinth')); });
clx('{T}: Add {C}. If a card is exiled with ~, add {C}{C} instead.', R => { R.mana = { colors: ['C'], n: 1 }; R.svLabMana = true; });
clx('{T}: Return the exiled card to its owner\'s hand.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sv_labReturn')]); });
clx('When you cast ~, target opponent exiles the top half of their library, rounded up.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_halfLibrary')]); });
clx('~ enters with a number of +1/+1 counters on it equal to the greatest mana value among cards in exile.', R => { R.svDefilerCtr = true; });
clx('~ has annihilator X, where X is the number of +1/+1 counters on it.', R => { R.svDefilerAnn = true; });
clx('Whenever ~ attacks, put a blight counter on target land. For as long as that land has a blight counter on it, it loses all land types and abilities and has "{T}: Add {C}."', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('sv_blight', { target: 'perm', filter: 'land' })] }); });
clx('Whenever you tap a land for {C}, add an additional {C}.', R => { R.svLandC = true; });
clx('Kicker {G} and/or {1}{U}', R => { R.svKickers = true; });
clx('When you cast ~, if it was kicked with its {G} kicker, exile target artifact or enchantment an opponent controls.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_kickG', { target: 'perm', filter: 'artifact or enchantment', needFlag: 'svKickG' })]); });
clx('When you cast ~, if it was kicked with its {1}{U} kicker, return target creature an opponent controls to its owner\'s hand.', R => { (R.castTrig = R.castTrig || []).push(...[cmd('sv_kickU', { target: 'creature', filter: 'opp', needFlag: 'svKickU' })]); });
clx('{T}, Pay 1 life: Add one mana of any color. Spend this mana only to cast a spell with devoid.', R => { R.mana = { colors: ['C', 'W', 'U', 'B', 'R', 'G'], n: 1, pain: { colors: ['W', 'U', 'B', 'R', 'G'], life: 1 }, svColoredOnly: 'Devoid' }; });
clx('{T}: Add {C}{C}. Spend this mana only to cast colorless Eldrazi spells or activate abilities of colorless Eldrazi.', R => { R.svBonus = { n: 1, re: 'ColorlessEldrazi' }; });
clx('{T}: Add {C}{C}. Spend this mana only to cast colorless spells. Activate only if you control seven or more lands.', R => { R.svBonus = { n: 1, re: 'Colorless', minLands: 7 }; });
clx('When ~ enters, create two 1/1 colorless Eldrazi Scion creature tokens. They have "Sacrifice ~: Add {C}."', R => { R.etb.push(SV_SCION(2)); });
clx('Create five 0/1 colorless Eldrazi Spawn creature tokens. They have "Sacrifice ~: Add {C}."', R => { R.spell = [SV_SPAWN(5)]; });
// ===== Tifa, Martial Artist (equipment) =====
clx('Equipped creature has base power and toughness X/X, where X is your life total.', R => { R.svBaseLife = true; });
clx('Each creature you control gets +2/+0 for each Equipment attached to it.', R => { R.svBruenor = true; });
clx('You may pay {0} rather than pay the equip cost of the first equip ability you activate each turn.', R => { R.svBruenorEquip = true; });
clx('Whenever equipped creature deals combat damage to a player, draw a card, then you may cast a spell from your hand with mana value less than or equal to that damage without paying its mana cost.', R => { R.trig.push({ ev: 'hitPlayer', host: true, effects: [cmd('sv_buster')] }); });
clx('When ~ enters, attach up to one target Equipment you control to it.', R => { R.etb.push(cmd('sv_cloudAttach')); });
clx('Whenever ~ attacks, draw a card for each equipped attacking creature you control. Then if ~ has power 7 or greater, create two Treasure tokens.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('sv_cloudAttack')] }); });
clx('As long as ~ is equipped, if a triggered ability of ~ or an Equipment attached to it triggers, that ability triggers an additional time.', R => { R.svCloudMerc = true; });
clx('As long as ~ is attached to a creature, your opponents can\'t cast spells during your turn.', R => { R.svFlail = true; });
clx('Equipped creature gets +2/+2 and has hexproof from monocolored.', R => { R.buff = { p: 2, q: 2, kw: [] }; R.svHexMono = true; });
clx('Equip {4}. This ability costs {1} less to activate for each color of the creature it targets.', R => { R.equip = parseCost('{4}'); R.equipText = '{4}'; R.svDragonEquip = true; });
clx('Your opponents can\'t cast spells during combat.', R => { R.svNoCastCombat = true; });
clx('Whenever a creature you control deals combat damage to a player, goad each creature that player controls.', R => { R.trig.push({ ev: 'combatHitAny', fn: 'svMyCreatureHits', effects: [cmd('sv_marisi')] }); });
clx('Each creature you control with a counter on it can\'t be blocked by more than one creature.', R => { R.svMikeyNoDouble = true; });
clx('Whenever ~ enters or attacks, create a Mutagen token.', R => { R.etb.push(cmd('sv_mutagen')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('sv_mutagen')] }); });
clx('Double all damage equipped creature would deal.', R => { R.svDoubleDmg = true; });
clx('Equip worthy {1}', R => { R.equipCheap = { type: 'worthy', cost: parseCost('{1}') }; R.equip = parseCost('{1}'); R.equipOnly = 'worthy'; R.equipText = '{1}'; });
clx('Whenever equipped creature attacks, tap target creature defending player controls and put a stun counter on it. Then ~ deals damage to each opponent equal to the number of tapped creatures that opponent controls.', R => { R.trig.push({ ev: 'attacks', host: true, effects: [cmd('sv_stormHammer')] }); });
clx('All creatures able to block equipped creature do so.', R => { R.buff = { p: 0, q: 0, kw: ['lure'] }; });
clx('Sneak {2}{G}', R => { R.sneak = parseCost('{2}{G}'); });
clx('The first activated ability you activate during your turn that targets a creature you control costs {2} less to activate.', R => { R.svHojoCost = true; });
clx('Whenever one or more creatures you control become the target of an activated ability, draw a card. This ability triggers only once each turn.', R => { R.svHojoDraw = true; });
clx('Equipped creature can\'t be blocked except by Walls.', R => { R.buff = { p: 0, q: 0, kw: ['blockonly:Wall'] }; });
clx('Search your library for a basic land card, reveal it, put it into your hand, then shuffle. If ~ was kicked, search your library for two basic land cards instead of one.', R => { R.spell = [cmd('sv_reclaim')]; });
clx('At the beginning of combat on your turn, choose one. If you control a commander, you may choose both instead.', (R, m, ctx) => { let k = ctx.li + 1; while (k < ctx.lines.length && /^•/.test(ctx.lines[k])) k++; R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('sv_soldierProgram')] }); ctx.li = k - 1; return true; });
clx('As long as ~ is attached to a creature, you may cast creature spells from the top of your library.', R => { R.svSummoningTop = true; });
clx('Equipped creature gets +2/+2 and has vigilance and "{T}: Add {G}."', R => { R.buff = { p: 2, q: 2, kw: ['vigilance'] }; R.svGrantMana = 'G'; });
clx('Equipped creature gets +1/+1 for each Aura and Equipment attached to it and has ward {2}.', R => { R.buff = { p: 0, q: 0, kw: ['ward:2'] }; R.buffPerAttached = { p: 1, q: 1 }; });
clx('Equipped creature has base power and toughness 7/7 and can\'t be blocked by creatures with power 2 or less.', R => { R.buffBase = { p: 7, q: 7 }; R.buff = { p: 0, q: 0, kw: ['blockpowgt:2'] }; });
clx('When ~ enters, gain control of target noncreature artifact for as long as you control ~. Then you may attach an Equipment you control to ~.', R => { R.etb.push(cmd('sv_yuffie', { target: 'perm', filter: 'noncreature artifact' })); });
// ===== Progenitus (five-color) =====
clx('Creatures you control are the chosen type in addition to their other types. The same is true for creature spells you control and creature cards you own that aren\'t on the battlefield.', R => { R.svAdaptation = true; });
clx('Creatures your opponents control lose flying and can\'t have or gain flying.', R => { R.svNoFly = true; });
clx('Choose a number between 0 and 13. Each player sacrifices that many creatures of their choice.', R => { R.spell = [cmd('sv_invitation')]; });
clx('Prevent all combat damage that would be dealt to players this turn.', R => { R.spell = [cmd('sv_fogPlayers')]; });
clx('Whenever ~ attacks, untap each other creature you control.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('sv_copperhorn')] }); });
clx('Exile all creature cards from target player\'s graveyard. You gain 3 life for each card exiled this way.', R => { R.spell = [cmd('sv_cryptIncursion', { target: 'player' })]; });
clx('At the beginning of your upkeep, if an opponent controls three or more creatures, sacrifice ~, search your library for up to two creature cards, put those cards onto the battlefield, then shuffle.', R => { R.trig.push({ ev: 'upkeep', who: 'your', fn: 'svOppThreeCreatures', effects: [cmd('sv_defenseHeart')] }); });
CMD_REWRITES.push([/When ~ enters, it deals X damage to each player and each other creature\./g, 'When ~ enters, it deals 97 damage to each player and each other creature.']);
clx('When ~ enters, it deals 97 damage to each player and each other creature.', R => { R.etb.push(cmd('sv_exocrine', { x: 97 })); });
clx('You can cast spells only during your turn and you can cast no more than two spells each turn.', R => { R.svFiresLimit = true; });
clx('You may cast spells with mana value less than or equal to the number of lands you control without paying their mana costs.', R => { R.svFiresFree = true; });
clx('Creatures you control have "Whenever ~ becomes the target of a spell or ability for the first time each turn, counter that spell or ability."', R => { R.svKira = true; });
clx('If damage would be dealt to ~ while it has a +1/+1 counter on it, prevent that damage and remove that many +1/+1 counters from it. When one or more counters are removed from ~ this way, it deals that much damage to any target.', R => { R.svPummeler = true; });
clx('When ~ enters, exile target player\'s graveyard. Put a +1/+1 counter on ~ for each creature card exiled this way.', R => { R.etb.push(cmd('sv_malanthrope')); });
clx('+1: Put three +1/+1 counters on up to one target noncreature land you control. Untap it. It becomes a 0/0 Elemental creature with vigilance and haste that\'s still a land.', (R, m, ctx) => { R.acts.push({ loyalty: 1, effects: [cmd('sv_nissa')], text: ctx.line, sorcery: true }); });
clx('−8: You get an emblem with "Lands you control have indestructible." Search your library for any number of Forest cards, put them onto the battlefield tapped, then shuffle.', (R, m, ctx) => { R.acts.push({ loyalty: -8, effects: [cmd('sv_nissaUlt')], text: ctx.line, sorcery: true }); });
clx('If you tap a permanent for mana, it produces three times as much of that mana instead.', R => { R.svNyxbloom = true; });
clx('You may cast spells from your hand without paying their mana costs.', R => { R.svOmniscience = true; });
clx('You gain 1 life for each creature your opponents control. Prevent all damage that would be dealt to you this turn.', R => { R.spell = [cmd('sv_riotControl')]; });
clx('Whenever you cast a creature spell with mana value 5 or greater, ~ deals 5 damage to any target.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'your', fn: 'svBigCreatureSpell', effects: [cmd('sv_dmg5', { target: 'any', good: false })] }); });
clx('Search your library for a Plains card, an Island card, a Swamp card, and a Mountain card. Reveal those cards, put them into your hand, then shuffle.', R => { R.spell = [cmd('sv_shardConvergence')]; });
clx('Prevent all noncombat damage that would be dealt to you and other permanents you control.', R => { R.svWanderer = true; });
clx('At the beginning of each end step, put a slime counter on each creature you don\'t control.', R => { R.trig.push({ ev: 'end', who: 'each', effects: [cmd('sv_slime')] }); });
clx('Creatures you don\'t control get -1/-1 for each slime counter on them.', R => { R.svToxrill = true; });
clx('Whenever a creature you don\'t control with a slime counter on it dies, create a 1/1 black Slug creature token.', R => { R.trig.push({ ev: 'dies', who: 'any', fn: 'svSlimeDies', effects: [{ t: 'token', n: 1, p: 1, q: 1, name: 'black Slug', colors: ['B'], kw: [] }] }); });
clx('Whenever ~ deals combat damage to a player, you may destroy target artifact or enchantment that player controls.', R => { R.trig.push({ ev: 'hitPlayer', host: true, effects: [cmd('sv_trygon')] }); });
// ===== Ms. Bumbleflower (five-color) =====
clx('Until end of turn, target creature gains "{T}: Return target nonland permanent to its owner\'s hand."', R => { R.spell = [cmd('sv_bounceGrant', { target: 'creature' })]; });
clx('Return target nonland permanent to its owner\'s hand. Then that permanent\'s controller may sacrifice a land of their choice. If the player does, they may copy ~ and may choose a new target for that copy.', R => { R.spell = [cmd('sv_chainVapor', { target: 'perm', filter: 'nonland' })]; });
clx('{T}, Sacrifice ~: The next time a source of your choice would deal damage to you this turn, prevent half that damage, rounded down.', (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('sv_darkSphere')]); });
clx('{T}, Sacrifice ~: This turn, when target creature you control attacks and isn\'t blocked, you may gain life equal to its power. If you do, it assigns no combat damage this turn.', (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('sv_cone', { target: 'creature', filter: 'mine' })]); });
clx('When ~ becomes the target of a spell or ability an opponent controls, exile ~.', R => { R.svScourge = true; });
clx('Exile a creature you control: Add X mana of any one color, where X is 1 plus the exiled creature\'s mana value. Spend this mana only to cast creature spells.', (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('sv_foodChain')]); });
clx('Whenever you put one or more counters on a creature you don\'t control, draw a card.', R => { R.trig.push({ ev: 'counters', fn: 'svPatron', effects: [{ t: 'draw', n: 1 }] }); });
clx('If an opponent cast three or more spells this turn, you may pay {0} rather than pay ~\'s mana cost.', R => { R.svMindbreak = true; });
clx('Exile any number of target spells.', R => { R.spell = [cmd('sv_mindbreak')]; });
clx('{T}, Sacrifice ~: Look at the top card of target player\'s library. Draw a card at the beginning of the next turn\'s upkeep.', (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('sv_bauble', { mode: 'top' })]); });
clx('{T}, Sacrifice ~: Look at a card at random in target player\'s hand. You draw a card at the beginning of the next turn\'s upkeep.', (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('sv_bauble', { mode: 'hand' })]); });
clx('If ~ would enter, you may discard a land card instead. If you do, put ~ onto the battlefield. If you don\'t, put it into its owner\'s graveyard.', R => { R.svMoxRepl = true; });
clx('Whenever an opponent casts a noncreature spell with mana value less than ~\'s power, draw a card.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'opp', fn: 'svPollywog', effects: [{ t: 'draw', n: 1 }] }); });
clx('Whenever you tap a nonland permanent for mana, add one mana of any type that permanent produced.', R => { R.svKinnan = true; });
clx('{5}{G}{U}: Look at the top five cards of your library. You may put a non-Human creature card from among them onto the battlefield. Put the rest on the bottom of your library in a random order.', (R, m, ctx) => { act(R, ctx.line, '{5}{G}{U}', [cmd('sv_kinnanDig')]); });
clx('Enchant creature or Vehicle', R => { R.aura = true; });
clx('Enchanted permanent is a Vehicle artifact with crew 5 and it loses all other card types.', R => { R.svVehicle = true; });
clx('When ~ enters, if you cast it, you gain protection from everything until your next turn.', R => { R.etb.push(cmd('sv_ringProt')); });
clx('At the beginning of your upkeep, you lose 1 life for each burden counter on ~.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sv_ringBurden')] }); });
clx('{T}: Put a burden counter on ~, then draw a card for each burden counter on ~.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sv_ringTap')]); });
clx('I — ~ gains "{T}: Add {C}."', R => { R.svUrzaSaga = true; R.saga = R.saga || {}; R.saga[1] = [cmd('sv_urzaI')]; });
clx('II — ~ gains "{2}, {T}: Create a 0/0 colorless Construct artifact creature token with \'~ gets +1/+1 for each artifact you control.\'"', R => { R.svUrzaSaga = true; R.saga = R.saga || {}; R.saga[2] = [cmd('sv_urzaI')]; R.acts.push({ ...parseActivated('{2}, {T}: Draw a card.', R), effects: [cmd('sv_urzaConstruct')], text: 'Urza construct', svSagaII: true }); });
clx('III — Search your library for an artifact card with mana cost {0} or {1}, put it onto the battlefield, then shuffle.', R => { R.svUrzaSaga = true; R.saga = R.saga || {}; R.saga[3] = [cmd('sv_urzaIII')]; });
clx('You may cast noncreature spells as though they had flash.', R => { R.svFlashNonCreature = true; });
clx('Whenever you cast a noncreature spell, Birds, Frogs, Otters, and Rats you control get +1/+1 until end of turn. Untap them.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', who: 'your', effects: [cmd('sv_floodcaller')] }); });
clx('Graft 2', R => { R.etbCounters = 2; R.trig.push({ ev: 'enters', who: 'any', another: true, ctxTarget: true, fn: 'svGraft', effects: [cmd('sv_graft')] }); });
clx('{1}{U}: Untap target creature with a +1/+1 counter on it.', (R, m, ctx) => { act(R, ctx.line, '{1}{U}', [cmd('sv_untapCtr', { target: 'creature' })]); });
// ===== Kardur, Doomscourge =====
clx('When ~ enters, until your next turn, creatures your opponents control attack each combat if able and attack a player other than you if able.', R => { R.etb.push(cmd('sv_kardur')); });
clx('Whenever an attacking creature dies, each opponent loses 1 life and you gain 1 life.', R => { R.trig.push({ ev: 'dies', who: 'any', fn: 'svAttackerDies', effects: [{ t: 'drain', n: 1 }] }); });
clx('At the beginning of each opponent\'s end step, that player chooses up to two creatures they control, then sacrifices the rest.', R => { R.trig.push({ ev: 'end', who: 'opp', effects: [cmd('sv_archfiend')] }); });
clx('{T}, Pay 1 life: Draw a card. Activate only if three or more cards left your graveyard this turn or if you\'ve sacrificed a Food this turn.', (R, m, ctx) => { act(R, ctx.line, '{T}, Pay 1 life', [{ t: 'draw', n: 1 }], a => { a.svBoneCache = true; }); });
clx('Return target artifact or creature card from your graveyard to your hand. Create a 1/1 colorless Soldier artifact creature token.', R => { R.spell = [cmd('sv_emergencyWeld')]; });
clx('Whenever a creature you don\'t control dies, return it to the battlefield under your control with an additional +1/+1 counter on it at the beginning of the next end step. That creature is a black Zombie in addition to its other colors and types.', R => { R.trig.push({ ev: 'dies', who: 'any', fn: 'svFoeCreatureDies', effects: [cmd('sv_graveBetrayal')] }); });
clx('At the beginning of each player\'s upkeep, that player loses half their life, rounded up.', R => { R.trig.push({ ev: 'upkeep', who: 'each', effects: [cmd('sv_havoc')] }); });
clx('Permanents you control have "Ward—Sacrifice a permanent."', R => { R.svMishraWard = true; });
clx('Each artifact card in your graveyard has unearth {1}{B}{R}.', R => { R.svMishraUnearth = true; });
clx('Whenever an opponent searches their library, that player sacrifices a creature of their choice and loses 10 life.', R => { R.svObSearch = true; });
clx('Cleave {1}{B}{B}', R => { R.alt = { mana: parseCost('{1}{B}{B}'), life: 0, exile: null, cond: null, text: 'cast it for its cleave cost' }; R.svParasitic = true; });
clx('~ deals 3 damage to target [Human] creature. You gain 3 life.', R => { R.spell = [cmd('sv_parasitic', { target: 'creature' })]; });
clx('Whenever you cast a black spell or a Swamp you control enters, you gain 1 life.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'your', fn: 'svBlackSpell', effects: [{ t: 'gain', n: 1 }] }); R.trig.push({ ev: 'enters', who: 'your', ctxTarget: true, fn: 'svMySwamp', effects: [{ t: 'gain', n: 1 }] }); });
clx('At the beginning of your end step, if you gained or lost life this turn, surveil 1.', R => { R.trig.push({ ev: 'end', who: 'your', fn: 'svLifeChanged', effects: [{ t: 'surveil', n: 1 }] }); });
clx('If a card you didn\'t control would be put into an opponent\'s graveyard from anywhere, exile it instead.', R => { R.svValgavoth = true; });
clx('During your turn, you may play cards exiled with ~. If you cast a spell this way, pay life equal to its mana value rather than pay its mana cost.', (R, m, ctx) => { R.svValgCast = true; act(R, ctx.line, '{0}', [cmd('sv_valgCast')]); });
clx('At the beginning of each end step, each opponent loses life equal to the life they lost this turn.', R => { R.trig.push({ ev: 'end', who: 'each', effects: [cmd('sv_woundReflection')] }); });
// ===== Captain America, Team Leader =====
clx('As this enchantment enters, choose a creature type.', R => { R.chooseType = true; });
clx('Double all damage that sources you control of the chosen type would deal.', R => { R.svInferno = true; });
clx('The next time a source of your choice would deal damage to you this turn, prevent that damage. If damage is prevented this way, ~ deals that much damage to that source\'s controller.', R => { R.spell = [cmd('sv_palm')]; });
clx('Counter target spell that targets you or a permanent you control.', R => { R.spell = [cmd('sv_hinderingLight', { target: 'spell', filter: 'svTargetsMe' })]; });
clx('Whenever ~ becomes untapped, you may pay {2}. If you do, draw a card.', R => { R.svKey = true; });
clx('For each nontoken creature you control, create a token that\'s a copy of that creature, except it isn\'t legendary.', R => { R.spell = [cmd('sv_incursion')]; });
clx('Counter target spell. Its controller can\'t cast spells this turn.', R => { R.spell = [cmd('sv_renderSilent', { target: 'spell' })]; });
clx('{5}{W}, {T}: Harness ~.', (R, m, ctx) => { act(R, ctx.line, '{5}{W}, {T}', [cmd('sv_harness')]); });
clx('∞ — At the beginning of your end step, exile up to one other target nonland permanent you control, then return that card to the battlefield under its owner\'s control.', R => { R.trig.push({ ev: 'end', who: 'your', fn: 'svHarnessed', effects: [cmd('sv_flickerOwn')] }); });
clx('Whenever a creature you control leaves the battlefield, if it had counters on it, put those counters on ~.', R => { R.trig.push({ ev: 'leaves', who: 'your', fn: 'svMyCreatureLeaves', effects: [cmd('sv_ozolithTake')] }); });
clx('At the beginning of combat on your turn, if ~ has counters on it, you may move all counters from ~ onto target creature.', R => { R.trig.push({ ev: 'combat', fn: 'svOzolithCombat', effects: [cmd('sv_ozolithMove', { target: 'creature', filter: 'mine' })] }); });
// ===== Lavinia, Azorius Renegade =====
clx('Each opponent can\'t cast noncreature spells with mana value greater than the number of lands that player controls.', R => { R.svLavinia = true; });
clx('Whenever an opponent casts a spell, if no mana was spent to cast it, counter that spell.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'opp', fn: 'svNoMana', effects: [cmd('sv_counterCast')] }); });
clx('Destroy all artifacts, creatures, and enchantments.', R => { R.spell = [{ t: 'wipe', how: 'destroy', what: 'artifacts, creatures, and enchantments' }]; });
clx('Other legendary permanents you control have indestructible.', R => { R.svMemorial = true; });
clx('If a nontoken creature would enter and it wasn\'t cast, exile it instead.', R => { R.svPriest = true; });
clx('Creature cards in graveyards and libraries can\'t enter the battlefield.', R => { R.svLock = { gyCreature: true, libCreature: true }; });
clx('Players can\'t cast spells from graveyards or libraries.', R => { R.svNoCastGyLib = true; });
clx('Creatures entering or dying don\'t cause abilities to trigger.', R => { R.svHush = true; });
clx('−8: Draw seven cards. Then if your library has no cards in it, you win the game.', (R, m, ctx) => { R.acts.push({ loyalty: -8, effects: [cmd('sv_jaceUlt')], text: ctx.line, sorcery: true }); });
clx('When ~ enters, each player exiles the top three cards of their library.', R => { R.etb.push(cmd('sv_poolImprint')); });
clx('Whenever a player casts a spell from their hand, that player exiles it. If the player does, they may cast a spell from among other cards exiled with ~ without paying its mana cost.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'any', fn: 'svFromHand', effects: [cmd('sv_poolCast')] }); });
clx('Each opponent can\'t draw more than one card each turn.', R => { R.svNarset = true; });
clx('At the beginning of combat on your turn, if you\'ve drawn more than one card this turn, put X +1/+1 counters on target creature you control, where X is the number of cards you\'ve drawn this turn minus one.', R => { R.trig.push({ ev: 'combat', fn: 'svProft', effects: [cmd('sv_proft', { target: 'creature', filter: 'mine' })] }); });
clx('If a card or token would be put into a graveyard from anywhere, exile it instead.', R => { R.svRip = true; });
clx('Each player chooses any number of creatures they control with total power 4 or less, then sacrifices all other creatures they control.', R => { R.spell = [cmd('sv_slaughter')]; });
clx('Players can\'t get counters.', R => { R.svSolemnity = true; });
clx('Counters can\'t be put on artifacts, creatures, enchantments, or lands.', R => { R.svSolemnity = true; });
clx('Permanent cards in graveyards can\'t enter the battlefield.', R => { R.svLock = { gyPermanent: true }; });
clx('Players can\'t cast noncreature spells from graveyards or exile.', R => { R.svNoCastNoncreatureGyEx = true; });
clx('+1: Draw a card. At the beginning of the next end step, untap up to two lands.', (R, m, ctx) => { R.acts.push({ loyalty: 1, effects: [{ t: 'draw', n: 1 }, cmd('sv_teferiUntap')], text: ctx.line, sorcery: true }); });
clx('−3: Put target nonland permanent into its owner\'s library third from the top.', (R, m, ctx) => { R.acts.push({ loyalty: -3, effects: [cmd('sv_teferiTuck', { target: 'perm', filter: 'nonland' })], text: ctx.line, sorcery: true }); });
clx('−8: You get an emblem with "Whenever you draw a card, exile target permanent an opponent controls."', (R, m, ctx) => { R.acts.push({ loyalty: -8, effects: [cmd('sv_teferiEmblem')], text: ctx.line, sorcery: true }); });
clx('Creature cards you own that aren\'t on the battlefield have flash.', R => { R.svFlashCreatures = true; });
clx('Each opponent can cast spells only any time they could cast a sorcery.', R => { R.svSorceryOnly = true; });
clx('+1: Until your next turn, you may cast sorcery spells as though they had flash.', (R, m, ctx) => { R.acts.push({ loyalty: 1, effects: [cmd('sv_teferiFlash')], text: ctx.line, sorcery: true }); });
clx('Until your next turn, your life total can\'t change and you gain protection from everything. All permanents you control phase out.', R => { R.spell = [cmd('sv_teferiProtection')]; });
clx('At the beginning of your end step, exile up to one other target creature you control, then return that card to the battlefield under your control.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('sv_flickerOwn')] }); });
clx('{3}{U}: Tap another target creature.', (R, m, ctx) => { act(R, ctx.line, '{3}{U}', [{ t: 'tap', target: 'creature' }]); });
clx('When ~ enters, look at the top X cards of your library, where X is your devotion to blue. Put up to one of them on top of your library and the rest on the bottom of your library in a random order. If X is greater than or equal to the number of cards in your library, you win the game.', R => { R.etb.push(cmd('sv_oracle')); });
clx('At the beginning of your upkeep, if you have exactly thirteen cards in your hand, you win the game.', R => { R.trig.push({ ev: 'upkeep', who: 'your', fn: 'svThirteen', effects: [{ t: 'winGame' }] }); });
clx('Nonland permanent cards in graveyards and libraries can\'t enter the battlefield.', R => { R.svLock = { gyNonlandPerm: true, libNonlandPerm: true }; });
clx('−2: Look at the top four cards of your library. You may reveal a noncreature, nonland card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.', (R, m, ctx) => { R.acts.push({ loyalty: -2, effects: [cmd('sv_narsetDig')], text: ctx.line, sorcery: true }); });

// Aerid Konstrari
clx('When ~ enters or dies, create a Heartwood token.', R => { R.etb.push({ t: 'artToken', kind: 'heartwood', n: 1 }); R.trig.push({ ev: 'dies', effects: [{ t: 'artToken', kind: 'heartwood', n: 1 }] }); });
clx('{6}: Create a Heartwood token. Then ~ gets +X/+0 until end of turn, where X is the number of artifacts you control.', (R, m, ctx) => { act(R, ctx.line, '{6}', [cmd('sv_heartwoodPump')]); });

// ===== Aerid Konstrari deck (2026-11-25, owner pasted a Gruul artifacts / Heartwood list) =====
registerRules({
    name: 'aerid',
    effects: [
        [/^create a Heartwood token$/i, () => ({ t: 'artToken', kind: 'heartwood', n: 1 })],
        [/^create a token that's a copy of target non-Saga token you control$/i, () => cmd('ak_copyToken')],
        [/^creatures you control gain trample and get \+X\/\+0 until end of turn, where X is the number of artifacts you control$/i, () => cmd('ak_crater')],
        [/^you may sacrifice a land\. If you do, create two tapped Heartwood tokens$/i, () => cmd('ak_tethermage')],
        [/^create Mowu, a legendary 3\/3 green Dog creature token$/i, () => ({ t: 'token', n: 1, p: 3, q: 3, name: 'green Dog', kw: [], legendary: true, named: 'Mowu' })],
        [/^any number of target noncreature artifacts you control become 3\/3 artifact creatures\. Sacrifice them at the beginning of the next end step$/i, () => cmd('ak_depthshaker')]
    ]
});
// Agatha of the Vile Cauldron
clx('Activated abilities of creatures you control cost {X} less to activate, where X is ~\'s power. This effect can\'t reduce the mana in that cost to less than one mana.', R => { R.sx_actLess = { n: s => Math.max(0, pow(s)), creatures: true }; });
clx('{4}{R}{G}: Other creatures you control get +1/+1 and gain trample and haste until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{4}{R}{G}', [cmd('ak_agatha')]); });
// Depthshaker Titan
clx('Each artifact creature you control has melee, trample, and haste.', R => { R.statics.push({ other: false, type: 'Artifact', p: 0, q: 0, kw: ['melee', 'trample', 'haste'] }); });
// Displaced Dinosaurs
clx('As a historic permanent you control enters, it becomes a 7/7 Dinosaur creature in addition to its other types.', R => { R.trig.push(SPEC('enters', { ctl: 'you' }, { effects: [cmd('ak_dino')] })); });
// Heartwood Crafter and Woodwork Prodigy (prepared)
clx('{T}: Add {C}. This mana can\'t be spent to cast spells from your hand.', R => { R.mana = { colors: ['C'], n: 1, onlyType: 'NotHand' }; });
// Herd Heirloom
clx('{T}: Until end of turn, target creature you control with power 4 or greater gains trample and "Whenever ~ deals combat damage to a player, draw a card."', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('ak_heirloom', { target: 'creature', mine: true, good: true, minPow: 4 })]); });
// Hungering Puppetbeast
clx('{1}, Sacrifice another artifact: Put a +1/+1 counter on ~. It gains your choice of trample, hexproof, or haste until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('ak_puppet')], a => { a.cost.sacPerm = 'another artifact'; }); });
// Ingenious Artillerist, Weftstalker Ardent
clx('Whenever one or more artifacts you control enter, ~ deals that much damage to each opponent.', R => { R.trig.push(SPEC('enters', { ctl: 'you', type: 'Artifact' }, { effects: [{ t: 'dmgOpp', n: 1 }] })); });
clx('Whenever another creature or artifact you control enters, ~ deals 1 damage to each opponent.', R => { R.trig.push(SPEC('enters', { ctl: 'you', type: 'Creature', another: true }, { effects: [{ t: 'dmgOpp', n: 1 }] })); R.trig.push(SPEC('enters', { ctl: 'you', type: 'Artifact', noncreature: true, another: true }, { effects: [{ t: 'dmgOpp', n: 1 }] })); });
// Jiang Yanggu
clx('At the beginning of your end step, untap all tokens you control.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('ak_untapTokens')] }); });
// Orthion
clx('{1}{R}, {T}: Create a token that\'s a copy of another target creature you control. It gains haste. Sacrifice it at the beginning of the next end step. Activate only as a sorcery.', (R, m, ctx) => { act(R, ctx.line, '{1}{R}, {T}', [cmd('ak_orthion', { n: 1 })], a => { a.sorcery = true; }); });
clx('{6}{R}{R}{R}, {T}: Create five tokens that are copies of another target creature you control. They gain haste. Sacrifice them at the beginning of the next end step. Activate only as a sorcery.', (R, m, ctx) => { act(R, ctx.line, '{6}{R}{R}{R}, {T}', [cmd('ak_orthion', { n: 5 })], a => { a.sorcery = true; }); });
// Roxanne, Starfall Savant
clx('Whenever ~ enters or attacks, create a tapped colorless artifact token named Meteorite with "When ~ enters, it deals 2 damage to any target" and "{T}: Add one mana of any color."', R => { R.etb.push(cmd('ak_meteorite')); R.trig.push({ ev: 'attacks', effects: [cmd('ak_meteorite')] }); });
clx('Whenever you tap an artifact token for mana, add one mana of any type that artifact token produced.', R => { R.akRoxanne = true; });
// Sarinth Steelseeker
clx('Whenever an artifact you control enters, look at the top card of your library. If it\'s a land card, you may reveal it and put it into your hand. If you don\'t put the card into your hand, you may put it into your graveyard.', R => { R.trig.push(SPEC('enters', { ctl: 'you', type: 'Artifact' }, { effects: [cmd('ak_steelseeker')] })); });
// Stridehangar Automaton
clx('If one or more artifact tokens would be created under your control, those tokens plus an additional 1/1 colorless Thopter artifact creature token with flying are created instead.', R => { R.akThopter = true; });
// Svella, Ice Shaper
clx('{3}, {T}: Create a colorless snow artifact token named Icy Manalith with "{T}: Add one mana of any color."', (R, m, ctx) => { act(R, ctx.line, '{3}, {T}', [{ t: 'artToken', kind: 'manalith', n: 1 }]); });
clx('{6}{R}{G}, {T}: Look at the top four cards of your library. You may cast a spell from among them without paying its mana cost. Put the rest on the bottom of your library in a random order.', (R, m, ctx) => { act(R, ctx.line, '{6}{R}{G}, {T}', [cmd('ak_svella')]); });
// The Reaver Cleaver
clx('Equipped creature gets +1/+1 and has trample and "Whenever ~ deals combat damage to a player or planeswalker, create that many Treasure tokens."', R => { R.buff = { p: 1, q: 1, kw: ['trample'] }; R.trig.push({ ev: 'hitPlayer', fn: 'bt_hostHit', host: true, effects: [cmd('ak_cleaver')] }); });
clx('When ~ enters, any number of target noncreature artifacts you control become 3/3 artifact creatures. Sacrifice them at the beginning of the next end step.', R => { R.etb.push(cmd('ak_depthshaker')); });
clx('When ~ enters, you may sacrifice a land. If you do, create two tapped Heartwood tokens.', R => { R.etb.push(cmd('ak_tethermage')); });
clx('At the beginning of your upkeep, if ~ isn\'t prepared, it becomes prepared.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('prepare')] }); });
