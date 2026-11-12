// Spellslinger Duels - rules pack: six owner decks (2026-11-12): Super-Skrull (Abzan + blue defenders / toughness), Aurelia, the Law Above
// (Boros angels and phoenixes), Doc Samson, Super Psychiatrist (mono-green counters), Plargg and Nassari (mono-red chaos), Rukarumel,
// Biologist (five-color changelings and Slivers) and Astarion, the Decadent (Orzhov life drain).
// Wordings only; engine pieces are in 15v-sixdecks.js (CMD ids start with sx_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text uses the reader's "~" form (this card's name and "this creature" both become "~"); "97" stands for X.
const SX = []; // [regex, effect] single-sentence readings
const sxRW = (re, id, fx) => { CMD_REWRITES.push([new RegExp(re.source, 'gi'), `§${id}.`]); SX.push([new RegExp(`^§${id}$`), () => fx]); };
const sxNop = () => {};
const sxBul = l => String(l || '').replace(/^•\s*/, ''); // a line that only matters outside a game (deck building) or is shown as an approximation

// ===================== Super-Skrull =====================
// Biomancer's Familiar, Training Grounds, Zirda: activated abilities cost {2} less (never below one mana)
clx('Activated abilities of creatures you control cost {2} less to activate. This effect can\'t reduce the mana in that cost to less than one mana.', R => { R.sx_actLess = { n: 2, creatures: true }; });
clx('Abilities you activate that aren\'t mana abilities cost {2} less to activate. This effect can\'t reduce the mana in that cost to less than one mana.', R => { R.sx_actLess = { n: 2 }; });
clx('Each permanent card in your starting deck has an activated ability.', sxNop); // Zirda's companion condition: deck building only
clx('{T}: The next time target creature adapts this turn, it adapts as though it had no +1/+1 counters on it.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sx_freshAdapt', { target: 'creature', mine: true, good: true })]); });
// Blight Pile
clx('{2}{B}, {T}: Each opponent loses X life, where X is the number of creatures with defender you control.', (R, m, ctx) => { act(R, ctx.line, '{2}{B}, {T}', [cmd('sx_blightPile')]); });
// Doran, Besieged by Time
clx('Each creature spell you cast with toughness greater than its power costs {1} less to cast.', R => { R.reducer = { what: 'sx_toughGtPow', n: 1 }; });
clx('Whenever a creature you control attacks or blocks, it gets +X/+X until end of turn, where X is the difference between its power and toughness.', R => { R.sx_doran = true; R.trig.push({ ev: 'attacks', fn: 'youAttack', effects: [cmd('sx_doran')] }); R.trig.push({ ev: 'blocks', fn: 'sx_myBlock', effects: [cmd('sx_doran')] }); });
// High Alert, The Kingpin of Crime: toughness assigns combat damage
clx('Each creature you control assigns combat damage equal to its toughness rather than its power.', R => { R.sx_toughDmg = true; });
clx('Creatures you control can attack as though they didn\'t have defender.', R => { R.sx_defAttack = true; });
clx('Whenever you attack, you may pay 2 life. If you do, until end of turn, creatures you control with toughness greater than their power assign combat damage equal to their toughness rather than their power.', R => { R.sx_kingpin = true; R.trig.push({ ev: 'attacks', fn: 'youAttack', effects: [cmd('sx_kingpin')] }); });
// Noxious Revival
clx('Put target card from a graveyard on top of its owner\'s library.', R => { R.spell = [cmd('sx_noxious', { multi: 'sx_gy1' })]; });
// Reap the Past
clx('Return 97 cards at random from your graveyard to your hand. Exile ~.', R => { R.spell = [cmd('sx_reap', { x: 97 }), { t: 'exileSelf' }]; });
// Relic of Sauron: two mana, each one blue, black or red (`combo`: a mix of colors; 15v-sixdecks.js)
clx('{T}: Add two mana in any combination of {U}, {B}, and/or {R}.', R => { R.mana = { colors: ['U', 'B', 'R'], n: 2, combo: true }; });
// Sarinth Greatwurm
clx('Whenever a land enters, create a tapped Powerstone token.', R => { R.trig.push({ ev: 'landfall', fn: 'sx_any', effects: [cmd('hh_tappedStone')] }); });
// Shadow of the Second Sun (enchants its caster: an extra untap, upkeep and draw after each of their second main phases)
clx('At the beginning of each of enchanted player\'s postcombat main phases, there is an additional beginning phase after this phase.', R => { R.etb.push(cmd('sx_enchantChoose', { mine: true })); R.trig.push({ ev: 'main2', fn: 'sx_hostActive', effects: [cmd('sx_secondSun')] }); });
// Victory Chimes (taps for {C}; giving it to another player is never useful to them, so it is yours)
clx('{T}: A player of your choice adds {C}.', R => { R.mana = { colors: ['C'], n: 1 }; });
// Wreck Hunter
clx('When ~ enters, choose target player. You create a tapped Powerstone token for each nonland card in that player\'s graveyard that was put there from the battlefield this turn.', R => { R.etb.push(cmd('sx_wreckHunter', { target: 'player' })); });
// Gemstone Caverns (printed as Glittering Caves of Aglarond): may start on the battlefield with a luck counter (sxOpeningHand); with one it taps for any color
clx('If ~ is in your opening hand and you\'re not the starting player, you may begin the game with ~ on the battlefield with a luck counter on it. If you do, exile a card from your hand.', R => { R.sx_gemstone = true; });
clx('{T}: Add {C}. If ~ has a luck counter on it, instead add one mana of any color.', R => { R.mana = { colors: ['C'], n: 1 }; R.sx_luckAny = true; });

// ===================== Aurelia, the Law Above =====================
clx('Whenever a player attacks with three or more creatures, you draw a card.', R => { R.trig.push({ ev: 'attacks', fn: 'sx_atkN', n: 3, effects: [cmd('sx_draw1')] }); });
clx('Whenever a player attacks with five or more creatures, ~ deals 3 damage to each of your opponents and you gain 3 life.', R => { R.trig.push({ ev: 'attacks', fn: 'sx_atkN', n: 5, effects: [cmd('sx_aurelia5')] }); });
// Anya, Merciless Angel
clx('~ gets +3/+3 for each opponent whose life total is less than half their starting life total.', R => { R.sx_dyn = 'anya'; });
clx('As long as an opponent\'s life total is less than half their starting life total, ~ has indestructible.', R => { R.sx_dyn = 'anya'; });
// Basandra, Battle Seraph
clx('Players can\'t cast spells during combat.', R => { R.sx_noCombatCast = true; });
clx('{R}: Target creature attacks this turn if able.', (R, m, ctx) => { act(R, ctx.line, '{R}', [{ t: 'mustAttackT', target: 'creature' }]); });
// Cartographer's Hawk
clx('When ~ deals combat damage to a player who controls more lands than you, return it to its owner\'s hand. If you do, you may search your library for a Plains card, put it onto the battlefield tapped, then shuffle.', R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('sx_cartHawk')] }); });
// Continue?
clx('Choose up to four target creature cards in your graveyard that were put there from the battlefield this turn. Return them to the battlefield.', R => { R.spell = [cmd('sx_continue', { multi: 'sx_continue' })]; });
// Enter the Avatar State
clx('Until end of turn, target creature you control becomes an Avatar in addition to its other types and gains flying, first strike, lifelink, and hexproof.', R => { R.spell = [cmd('sx_avatarState', { target: 'creature', mine: true, good: true })]; });
// Gisela, Blade of Goldnight
clx('If a source would deal damage to an opponent or a permanent an opponent controls, that source deals double that damage to that player or permanent instead.', R => { R.sx_gisela = true; });
clx('If a source would deal damage to you or a permanent you control, prevent half that damage, rounded up.', R => { R.sx_gisela = true; });
// Molten Disaster: kicked, it has split second (no spells or non-mana abilities while it is on the stack)
clx('If ~ was kicked, it has split second.', R => { R.sx_splitKicked = true; });
// Phoenix Chick, Warcry Phoenix: come back attacking from the graveyard
clx('Whenever you attack with three or more creatures, you may pay {R}{R}. If you do, return ~ from your graveyard to the battlefield tapped and attacking with a +1/+1 counter on it.', R => { (R.gyTrig = R.gyTrig || []).push({ ev: 'attacks', fn: 'sx_mine3', effects: [cmd('sx_phoenixBack', { cost: '{R}{R}', counter: 1 })] }); });
clx('Whenever you attack with three or more creatures, you may pay {2}{R}. If you do, return ~ from your graveyard to the battlefield tapped and attacking.', R => { (R.gyTrig = R.gyTrig || []).push({ ev: 'attacks', fn: 'sx_mine3', effects: [cmd('sx_phoenixBack', { cost: '{2}{R}', counter: 0 })] }); });
// Rescue Skiff
clx('When ~ enters, return target creature or enchantment card from your graveyard to the battlefield.', R => { R.etb.push(cmd('sx_skiff', { multi: 'sx_skiff' })); });
// RMS Titanic
clx('When ~ deals combat damage to a player, sacrifice it and create that many Treasure tokens.', R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('sx_titanic')] }); });
// The Night of the Doctor, chapter II
cl(/^II — Return target legendary creature card from your graveyard to the battlefield\. Put your choice of a first strike, vigilance, or lifelink counter on it\.$/, R => { R.saga = R.saga || {}; (R.saga[2] = R.saga[2] || []).push(cmd('sx_nightDoctor', { multi: 'sx_legendGy' })); });
// Wingnut, Bat on the Belfry
clx('Whenever ~ attacks, each other attacking creature gets +1/+0 until end of turn.', R => { R.trig.push({ ev: 'attacks', effects: [cmd('sx_wingnut')] }); });

// ===================== Doc Samson, Super Psychiatrist =====================
// Blast Zone
clx('~ enters with a charge counter on it.', R => { R.etbNamedN = { kind: 'charge', n: 1 }; });
clx('{3}, {T}, Sacrifice ~: Destroy each nonland permanent with mana value equal to the number of charge counters on ~.', (R, m, ctx) => { act(R, ctx.line, '{3}, {T}', [cmd('sx_blastZone')], a => { a.cost.sacSelf = true; a.sorcery = true; }); });
// Boon of Boseiju
clx('Target creature gets +X/+X until end of turn, where X is the greatest mana value among permanents you control. Untap it.', R => { R.spell = [cmd('sx_boonBoseiju', { target: 'creature', good: true })]; });
// Coalition Relic
clx('At the beginning of your first main phase, remove all charge counters from ~. Add one mana of any color for each charge counter removed this way.', R => { R.trig.push({ ev: 'main1', effects: [cmd('sx_coalition')] }); });
// Hydra Broodmaster
clx('When ~ becomes monstrous, create X X/X green Hydra creature tokens.', R => { R.sx_broodmaster = true; });
// Llanowar Reborn: Graft 1
clx('Graft 1', R => { R.etb.push(cmd('sx_graftEnter', { n: 1 })); R.trig.push({ ev: 'enters', fn: 'sx_otherCreatureEnters', effects: [cmd('sx_graftMove')] }); });
// Mage-Ring Network (storage counters)
clx('{1}, {T}: Put a storage counter on ~.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [{ t: 'namedCounter', n: 1, kind: 'storage' }]); });
clx('{T}, Remove any number of storage counters from ~: Add {C} for each storage counter removed this way.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sx_storage')], a => { a.onlyIf = 'sx: ~ has a storage counter'; }); });
// Magistrate's Scepter
clx('{T}, Remove three charge counters from ~: Take an extra turn after this one.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'extraTurn' }], a => { a.cost.removeNamedN = { kind: 'charge', n: 3 }; }); });
// Mindless Automaton (the two counters come off as it resolves)
clx('Remove two +1/+1 counters from ~: Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{0}', [{ t: 'draw', n: 1 }], a => { a.cost.removeP1 = 2; }); });
// Moxite Refinery (sorcery speed; the counters to move are chosen as it resolves)
clx('{2}, {T}, Remove X counters from an artifact or creature you control: Choose one. Activate only as a sorcery.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('sx_moxite')], a => { a.sorcery = true; a.sx_moxite = true; }); const k = ctx.li; if (/^• Put X charge counters on target artifact\.$/.test(ctx.lines[k + 1] || '')) ctx.li = k + 2; });
// Nature's Chosen
clx('{0}: Untap enchanted creature. Activate only during your turn and only once each turn.', (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('sx_untapHost')], a => { a.onlyIf = 'sx: your turn, host tapped, once'; }); });
clx('Tap enchanted creature: Untap target artifact, creature, or land. Activate only if enchanted creature is white and untapped and only once each turn.', (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('sx_chosenUntap', { target: 'perm', filter: 'artifact, creature, or land', mine: true, good: true })], a => { a.onlyIf = 'sx: host white and untapped, once'; }); });
// Peema Trailblazer
clx('Whenever ~ deals combat damage to a player, you get that many {E} .', R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('sx_energyHit')] }); });
clx('Whenever ~ deals combat damage to a player, you get that many {E}.', R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('sx_energyHit')] }); });
// Surestrike Trident (the granted ability is activated from the Equipment)
clx('Equipped creature has first strike and "{T}, Unattach ~: ~ deals damage equal to its power to target player or planeswalker."', (R, m, ctx) => { R.buff = { p: 0, q: 0, kw: ['first strike'] }; act(R, ctx.line, '{0}', [cmd('sx_trident', { target: 'player' })], a => { a.onlyIf = 'sx: host untapped'; }); });
// Swashbuckler's Whip
clx('Equipped creature has reach, "{2}, {T}: Tap target artifact or creature," and "{8}, {T}: Discover 10."', (R, m, ctx) => {
    R.buff = { p: 0, q: 0, kw: ['reach'] };
    act(R, ctx.line, '{2}', [cmd('sx_whipTap', { target: 'perm', filter: 'artifact or creature' })], a => { a.onlyIf = 'sx: host untapped'; });
    act(R, ctx.line, '{8}', [cmd('sx_whipDiscover')], a => { a.onlyIf = 'sx: host untapped'; });
});
// Sword of the Paruns
clx('As long as equipped creature is tapped, tapped creatures you control get +2/+0.', R => { R.sx_paruns = true; });
clx('As long as equipped creature is untapped, untapped creatures you control get +0/+2.', R => { R.sx_paruns = true; });
clx('{3}: You may tap or untap equipped creature.', (R, m, ctx) => { act(R, ctx.line, '{3}', [cmd('sx_toggleHost')], a => { a.onlyIf = 'sx: has host'; }); });
// Temur Sabertooth
clx('{1}{G}: You may return another creature you control to its owner\'s hand. If you do, ~ gains indestructible until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}{G}', [cmd('sx_sabertooth')]); });
// The Aesir Escape Valhalla
cl(/^I — Exile a permanent card from your graveyard\. You gain life equal to its mana value\.$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push(cmd('sx_aesir1')); });
cl(/^II — Put a number of \+1\/\+1 counters on target creature you control equal to the mana value of the exiled card\.$/, R => { R.saga = R.saga || {}; (R.saga[2] = R.saga[2] || []).push(cmd('sx_aesir2', { target: 'creature', mine: true, good: true })); });
cl(/^III — Return ~ and the exiled card to their owner's hand\.$/, R => { R.saga = R.saga || {}; (R.saga[3] = R.saga[3] || []).push(cmd('sx_aesir3')); });
// Umbral Mantle
clx('Equipped creature has "{3}, {Q}: ~ gets +2/+2 until end of turn."', (R, m, ctx) => { act(R, ctx.line, '{3}', [cmd('sx_mantle')], a => { a.onlyIf = 'sx: host tapped'; }); });

// ===================== Plargg and Nassari =====================
// Annihilator N (Artisan of Kozilek, Pathrazer of Ulamog, Hideous Taskmaster): handled when attackers are declared (15v-sixdecks.js)
cl(/^Annihilator (\d+)$/, (R, m) => { R.sx_annih = Number(m[1]); });
clx('Trample, haste, annihilator 1', R => { R.kw.add('trample'); R.kw.add('haste'); R.sx_annih = 1; });
// Alexios, Deimos of Kosmos
clx('~ attacks each combat if able, can\'t be sacrificed, and can\'t attack its owner.', R => { R.mustAttack = true; R.sx_noSac = true; R.sx_noAttackOwner = true; });
clx('At the beginning of each player\'s upkeep, that player gains control of ~, untaps it, and puts a +1/+1 counter on it. It gains haste until end of turn.', R => { R.trig.push({ ev: 'upkeep', who: 'each', effects: [cmd('sx_alexios')] }); });
// Avatar of Slaughter
clx('All creatures have double strike and attack each combat if able.', R => { R.h_thantis = true; R.sx_allDouble = true; });
// Chandra, Awakened Inferno
clx('+2: Each opponent gets an emblem with "At the beginning of your upkeep, this emblem deals 1 damage to you."', (R, m, ctx) => { R.acts.push({ loyalty: 2, effects: [cmd('sx_chandraEmblem')], text: ctx.line, sorcery: true }); });
clx('−3: ~ deals 3 damage to each non-Elemental creature.', (R, m, ctx) => { R.acts.push({ loyalty: -3, effects: [cmd('sx_chandraSweep')], text: ctx.line, sorcery: true }); });
clx('−X: ~ deals X damage to target creature or planeswalker. If a permanent dealt damage this way would die this turn, exile it instead.', (R, m, ctx) => { R.acts.push({ loyalty: 0, loyaltyX: true, effects: xMarkDeep([cmd('sx_chandraX', { x: 97, target: 'perm', filter: 'creature or planeswalker' })]), text: ctx.line, sorcery: true }); });
// Colossus of Akros
clx('As long as ~ is monstrous, it has trample and can attack as though it didn\'t have defender.', R => { R.sx_monsterAttack = true; });
// Curse of Obsession: a Curse, so it goes on an opponent (you may still pick yourself)
clx('At the beginning of enchanted player\'s draw step, that player draws two additional cards.', R => { R.etb.push(cmd('sx_enchantChoose', { curse: true })); R.trig.push({ ev: 'upkeep', who: 'each', fn: 'sx_hostActive', effects: [cmd('sx_hostDraws', { n: 2 })] }); });
clx('At the beginning of enchanted player\'s end step, that player discards their hand.', R => { R.trig.push({ ev: 'end', who: 'each', fn: 'sx_hostActive', effects: [cmd('sx_hostDiscards')] }); });
// Deflecting Swat
clx('You may choose new targets for target spell or ability.', R => { R.spell = [cmd('sx_retarget', { target: 'sx_spellOrAbility' })]; });
// Fanatic of Mogis
clx('When ~ enters, it deals damage to each opponent equal to your devotion to red.', R => { R.etb.push(cmd('sx_fanatic')); });
// Fear of Burning Alive
clx('Whenever a source you control deals noncombat damage to an opponent, if there are four or more card types among cards in your graveyard, ~ deals that amount of damage to target creature that player controls.', R => { R.sx_fearBurn = true; });
// Grenzo, Havoc Raiser
// Havoc Eater
clx('When ~ enters, for each opponent, goad up to one target creature that opponent controls. Put X +1/+1 counters on ~, where X is the total power of creatures goaded this way.', R => { R.etb.push(cmd('sx_havocEater', { multi: 'sx_eachOpp' })); });
// Hideous Taskmaster
clx('When you cast ~, for each opponent, gain control of up to one target creature that player controls until end of turn. Untap those creatures. They gain trample, haste, and annihilator 1 until end of turn.', R => { R.sx_taskmaster = true; });
// Interdimensional Web Watch: two mana in any mix of colors, spent only on spells cast from exile (`onlyType: 'FromExile'`, payOpts)
clx('{T}: Add two mana in any combination of colors. Spend this mana only to cast spells from exile.', R => { R.mana = { colors: [...COLORS], n: 2, combo: true, onlyType: 'FromExile' }; });
// Koth, Fire of Resistance
clx('−7: You get an emblem with "Whenever a Mountain you control enters, this emblem deals 4 damage to any target."', (R, m, ctx) => { R.acts.push({ loyalty: -7, effects: [cmd('sx_kothEmblem')], text: ctx.line, sorcery: true }); });
// Lithoform Engine, Peter Parker's Camera
clx('{2}, {T}: Copy target activated or triggered ability you control. You may choose new targets for the copy.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('fr_echo', { target: 'sx_myAbility' })]); });
clx('{4}, {T}: Copy target permanent spell you control.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [cmd('sx_copyPermSpell', { target: 'sx_myPermSpell' })]); });
clx('~ enters with three film counters on it.', R => { R.etbNamedN = { kind: 'film', n: 3 }; });
clx('{2}, {T}, Remove a film counter from ~: Copy target activated or triggered ability you control. You may choose new targets for the copy.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('fr_echo', { target: 'sx_myAbility' })], a => { a.cost.removeNamedN = { kind: 'film', n: 1 }; }); });
// Maximum Carnage, chapter I (the defender pickers avoid its controller when they can: 15v-sixdecks.js)
cl(/^I — Until your next turn, each creature attacks each combat if able and attacks a player other than you if able\.$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push(cmd('sx_carnage')); });
// Nalfeshnee, Spider-Verse: copies of spells cast from exile / from anywhere but your hand
clx('Whenever you cast a spell from exile, copy it. You may choose new targets for the copy. If it\'s a permanent spell, the copy gains haste and "At the beginning of the end step, sacrifice ~."', R => { R.sx_copyExile = 'nalfeshnee'; });
clx('The "legend rule" doesn\'t apply to Spiders you control.', R => { R.sx_spiderLegend = true; });
clx('Whenever you cast a spell from anywhere other than your hand, you may copy it. If you do, you may choose new targets for the copy. If the copy is a permanent spell, it gains haste. Do this only once each turn.', R => { R.sx_copyExile = 'spiderverse'; });
// Planetary Annihilation
clx('Each player chooses six lands they control, then sacrifices the rest. ~ deals 6 damage to each creature.', R => { R.spell = [cmd('sx_planetary')]; });
// Rampaging War Mammoth
clx('When you cycle ~, destroy up to X target artifacts.', R => { R.cycleTrig = [cmd('sx_mammoth')]; });
// Stolen Strategy (mana spent as though it were any color: costOf, 15v-sixdecks.js)
clx('At the beginning of your upkeep, exile the top card of each opponent\'s library. Until end of turn, you may cast spells from among those exiled cards, and you may spend mana as though it were mana of any color to cast those spells.', R => { R.trig.push({ ev: 'upkeep', effects: [cmd('sx_stolen')] }); });
// The Fire Crystal
clx('{4}{R}{R}, {T}: Create a token that\'s a copy of target creature you control. Sacrifice it at the beginning of the next end step.', (R, m, ctx) => { act(R, ctx.line, '{4}{R}{R}, {T}', [cmd('sx_fireCrystal', { target: 'creature', mine: true, good: true })]); });
// Urabrask, Heretic Praetor
clx('At the beginning of each opponent\'s upkeep, the next time they would draw a card this turn, instead they exile the top card of their library. They may play it this turn.', R => { R.trig.push({ ev: 'upkeep', who: 'opp', effects: [cmd('sx_urabrask')] }); });
// Urabrask's Forge
clx('At the beginning of combat on your turn, put an oil counter on ~, then create an X/1 red Phyrexian Horror creature token with trample and haste, where X is the number of oil counters on ~. Sacrifice that token at the beginning of the next end step.', R => { R.trig.push({ ev: 'combat', effects: [cmd('sx_forge')] }); });
// Wand of Wonder
clx('{4}, {T}: Roll a d20. Each opponent exiles cards from the top of their library until they exile an instant or sorcery card, then shuffles the rest into their library. You may cast up to X instant and/or sorcery spells from among cards exiled this way without paying their mana costs.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [cmd('sx_wand')]); });
cl(/^(?:1—9 \| X is one|10—19 \| X is two|20 \| X is three)\.$/, sxNop);
// Wild Magic Surge
clx('Destroy target permanent an opponent controls. Its controller reveals cards from the top of their library until they reveal a permanent card that shares a card type with that permanent. They put that card onto the battlefield and the rest on the bottom of their library in a random order.', R => { R.spell = [cmd('sx_wildSurge', { target: 'perm', filter: 'permanent', theirs: true })]; });
// Return the Favor (Spree modes)
sxRW(/Copy target instant spell, sorcery spell, activated ability, or triggered ability\. You may choose new targets for the copy\./, 'sxFavorCopy', cmd('sx_copyAny', { target: 'sx_spellOrAbility' }));
sxRW(/Change the target of target spell or ability with a single target\./, 'sxFavorChange', cmd('sx_retarget', { target: 'sx_spellOrAbility' }));

// ===================== Rukarumel, Biologist =====================
clx('Slivers you control and nontoken creatures you control are the chosen type in addition to their other creature types. The same is true for creature spells you control and creature cards you own that aren\'t on the battlefield.', R => { R.sx_rukarumel = true; });
clx('{T}: Target creature gains all creature types until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sx_allTypes', { target: 'creature', good: true })]); });
clx('{T}: Target creature loses all creature types until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sx_noTypes', { target: 'creature' })]); });
clx('Whenever another creature you control of the chosen type enters, put a +1/+1 counter on ~.', R => { R.trig.push({ ev: 'enters', fn: 'sx_chosenEnters', effects: [cmd('sx_selfCounter')] }); });
clx('At the beginning of your upkeep, for each color, put a +1/+1 counter on a Dragon you control of that color. If you put +1/+1 counters on five Dragons this way, you win the game.', R => { R.trig.push({ ev: 'upkeep', effects: [cmd('sx_spiritDragons')] }); });
clx('Sliver creatures you control have "Whenever ~ deals combat damage to a player, exile the top card of your library. You may play that card this turn."', R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, type: 'Sliver', effects: [cmd('sx_capricious')] }); });
clx('All Slivers have shroud.', R => { R.sx_sliverKw = 'shroud'; });
clx('Whenever you cast an outlaw spell, copy that spell.', R => { R.sx_doubleDown = true; });
clx('When ~ enters, return up to one other target creature you control to its owner\'s hand.', R => { R.etb.push(cmd('sx_flockBounce')); });
clx('Create an X/X colorless Shapeshifter creature token with changeling and deathtouch, where X is the number of land cards in your graveyard.', R => { R.spell = [cmd('sx_formless')]; });
clx('Spells you cast of the chosen type cost {1} less to cast.', (R, m, ctx) => { if (!/choose a creature type/i.test((ctx.card && ctx.card.text) || '')) return false; R.reducer = { what: 'chosenType', n: 1 }; });
clx('When ~ enters and at the beginning of your upkeep, look at the top card of your library. If it\'s a card of the chosen type, you may reveal it and put it into your hand. If you don\'t put the card into your hand, you may put it into your graveyard.', R => { R.etb.push(cmd('sx_gathering')); R.trig.push({ ev: 'upkeep', effects: [cmd('sx_gathering')] }); });
cl(/^I, II, III — Create a 3\/3 black Dalek artifact creature token with menace for each lore counter on ~\.$/, R => { R.saga = R.saga || {}; [1, 2, 3].forEach(k => { (R.saga[k] = R.saga[k] || []).push(cmd('sx_daleks')); }); });
cl(/^IV — Destroy all Dalek creatures and each of your opponents loses life equal to the total power of Daleks that died this turn, or destroy all non-Dalek creatures\.$/, R => { R.saga = R.saga || {}; (R.saga[4] = R.saga[4] || []).push(cmd('sx_dalekEnd')); });
clx('Creatures you control are every creature type. The same is true for creature spells you control and creature cards you own that aren\'t on the battlefield.', R => { R.sx_maskwood = true; });
clx('{X}: Until end of turn, creatures you control have base power and toughness X/X and gain all creature types.', (R, m, ctx) => { const a = parseActivated('{X}: Draw X cards.', R); a.effects = [cmd('sx_mirrorEntity', { x: '{X}' })]; a.text = ctx.line; R.acts.push(a); });
clx('You may have ~ enter as a copy of a permanent you control, except it\'s legendary and snow in addition to its other types and, if it\'s a creature, it enters with two additional +1/+1 counters on it and has changeling.', R => { R.clone = { what: 'permanent you control', sx_moritte: true }; });
clx('When ~ enters, create a tapped Mutavault token.', R => { R.etb.push(cmd('sx_mutavault')); });
clx('You may have ~ enter as a copy of any creature on the battlefield, except it has changeling.', R => { R.clone = { what: 'creature', addText: () => 'Changeling' }; });
clx('Whenever ~ or another Elemental you control enters, look at the top card of your library. If it\'s a land card, you may put it onto the battlefield tapped. If you don\'t put the card onto the battlefield, put it into your hand.', R => { R.trig.push({ ev: 'enters', typeEnter: { type: 'Elemental', creature: true, self: true }, effects: [cmd('sx_risenReef')] }); });
clx('When ~ enters, exile up to two target cards from graveyards. You gain 3 life.', R => { R.etb.push(cmd('sx_percher', { multi: 'sx_gy2' })); });
clx('Creature tokens you control have "{T}: Add one mana of any color."', R => { R.sx_tokenMana = true; });
clx('Affinity for Slivers', R => { R.affinityOf = 'Sliver'; });
clx('Whenever you cast a Myr spell, create a 1/1 colorless Myr artifact creature token.', R => { R.trig.push({ ev: 'cast', fn: 'sx_castMyr', who: 'any', effects: [cmd('sx_myrToken')] }); });
clx('At the beginning of combat on your turn, untap each Myr you control.', R => { R.trig.push({ ev: 'combat', effects: [cmd('sx_untapMyr')] }); });
clx('{W}{U}{B}{R}{G}, {T}: Put three +1/+1 counters on each Myr you control. Activate only during your turn.', (R, m, ctx) => { act(R, ctx.line, '{W}{U}{B}{R}{G}, {T}', [cmd('sx_myrCounters')], a => { a.onlyIf = 'sx: your turn'; }); });
clx('All Sliver creatures have poisonous 1.', R => { R.sx_virulent = 1; });
clx('All Slivers have protection from the chosen color.', R => { R.sx_sliverKw = 'chosenColor'; });

// ===================== Astarion, the Decadent =====================
clx('Exile target nonland permanent. You may cast that card for as long as it remains exiled, and you may spend colorless mana as though it were mana of any color to cast that spell.', R => { R.spell = [cmd('sx_appropriate', { target: 'perm', filter: 'nonland permanent' })]; });
clx('Kicker—Tap an untapped Vampire you control.', R => { R.sx_vampKicker = true; });
clx('Target opponent loses half their life, rounded up. If ~ was kicked, you gain life equal to the life lost this way.', R => { R.spell = [cmd('sx_bloodTribute', { target: 'player', oppOnly: true })]; });
clx('Whenever a creature you control dies, put a corpse counter on ~.', R => { R.trig.push({ ev: 'creatureDies', mine: true, effects: [{ t: 'namedCounter', n: 1, kind: 'corpse' }] }); });
clx('{4}{B}{B}, {T}, Sacrifice ~: Create a 2/2 black Zombie creature token with decayed for each corpse counter on ~.', (R, m, ctx) => { act(R, ctx.line, '{4}{B}{B}, {T}', [cmd('sx_crypt')], a => { a.cost.sacSelf = true; }); });
clx('{1}{B}, Sacrifice ~: Each nontoken Vampire creature you control gains persist until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}{B}', [cmd('sx_persistVamps')], a => { a.cost.sacSelf = true; }); });
clx('Lifelink, hexproof from instants', R => { R.kw.add('lifelink'); R.sx_hexInstants = true; });
clx('As long as your life total is greater than your starting life total, ~ gets +1/+1 and has menace. ~ gets an additional +5/+5 as long as your life total is at least 10 greater than your starting life total.', R => { R.sx_dyn = 'elenda'; });
clx('You gain 2 life. Each creature gets -X/-X until end of turn, where X is the amount of life you gained this turn.', R => { R.spell = [cmd('sx_essencePulse')]; });
clx('{4}, {T}: Look at the top card of your library. If it\'s a land card, you may put it onto the battlefield tapped. If you don\'t put the card onto the battlefield, you may put it on the bottom of your library.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [cmd('sx_lantern')]); });
clx('At the beginning of your upkeep, if your devotion to white and black is seven or greater, create a 4/3 white and black Vampire Demon creature token with flying.', R => { R.trig.push({ ev: 'upkeep', effects: [cmd('sx_march')] }); });
sxRW(/Target opponent sacrifices half the creatures they control of their choice, rounded up\./, 'sxDreadSac', cmd('sx_dreadSac', { target: 'player', oppOnly: true }));
sxRW(/Target opponent discards half the cards in their hand, rounded up\./, 'sxDreadDiscard', cmd('sx_dreadDiscard', { target: 'player', oppOnly: true }));
sxRW(/Target opponent loses half their life, rounded up\./, 'sxDreadLife', cmd('sx_dreadLife', { target: 'player', oppOnly: true }));
clx('When a legendary creature you control attacks and isn\'t blocked, if ~ is exiled, put it onto the battlefield attacking.', R => { R.sx_senu = true; });
clx('All creatures have shroud.', R => { R.sx_allShroud = true; });
clx('{5}, {T}, Sacrifice five creatures: Transform ~, then untap it.', (R, m, ctx) => { act(R, ctx.line, '{5}, {T}', [{ t: 'transform' }, cmd('sx_untapSelf')], a => { a.cost.sacN = { n: 5, kind: 'Creature' }; }); });

// Modal triggers read by the card reader's own "choose one —" reader: their bullets as single sentences
// Grenzo, Havoc Raiser
sxRW(/Goad target creature that player controls\./, 'sxGrenzoGoad', cmd('sx_grenzoGoad'));
sxRW(/Exile the top card of that player's library\. Until end of turn, you may cast that card and you may spend mana as though it were mana of any color to cast that spell\./, 'sxGrenzoExile', cmd('sx_grenzoExile'));
// Glissa, Herald of Predation
sxRW(/Incubate 2 twice\./, 'sxGlissaInc', cmd('sx_glissaInc'));
sxRW(/Transform all Incubator tokens you control\./, 'sxGlissaTr', cmd('sx_glissaTr'));
sxRW(/Phyrexians you control gain first strike and deathtouch until end of turn\./, 'sxGlissaKw', cmd('sx_glissaKw'));
// Astarion, the Decadent
sxRW(/Target opponent loses life equal to the amount of life they lost this turn\./, 'sxAstarionLose', cmd('sx_astarionLose', { target: 'player', oppOnly: true }));
sxRW(/You gain life equal to the amount of life you gained this turn\./, 'sxAstarionGain', cmd('sx_astarionGain'));

registerRules({ name: 'sixdecks', effects: SX });
