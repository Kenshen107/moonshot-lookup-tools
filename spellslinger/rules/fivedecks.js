// Spellslinger Duels - rules pack: five owner decks (2026-11-02): U.S. Agent (Orzhov blink), Kang the Conqueror (mono-blue "end the turn"),
// Lorehold, the Historian (Boros artifacts), Jadzi, Oracle of Arcavios (Simic) and Torgaar, Famine Incarnate (mono-black).
// Wordings only; engine pieces are in 15r-fivedecks.js (CMD ids start with fr_). Uses cl / clx / cmd / act / SPEC / selfCond from rules/cmdr.js.
// Line text must use the reader's "~" form (this card's name and "this creature" both become "~").
const FR = []; // [regex, effect] single-sentence readings (joined into the pack below)
const frRW = (re, id, fx) => { CMD_REWRITES.push([new RegExp(re.source, 'gi'), `§${id}.`]); FR.push([new RegExp(`^§${id}$`), () => fx]); };

// ===== Blink: "exile it, then return it" and "return it at the beginning of the next end step" =====
frRW(/Exile another target creature you own\. Return it to the battlefield under your control at the beginning of the next end step\./, 'frPrince', cmd('fr_blinkEnd', { target: 'creature', mine: true, notSelf: true, good: true }));
frRW(/Exile up to one target creature\. Return that card to the battlefield under its owner's control at the beginning of the next end step\./, 'frDuelist', cmd('fr_blinkEnd', { target: 'creature', optional: true }));
frRW(/Exile another target permanent\. Return that card to the battlefield under its owner's control at the beginning of the next end step\./, 'frWisp', cmd('fr_blinkEnd', { target: 'perm', filter: 'permanent', notSelf: true }));
frRW(/Exile up to one other target creature or artifact you control\. Return it to the battlefield under its owner's control at the beginning of the next end step\./, 'frGhirapur', cmd('fr_blinkEnd', { target: 'perm', filter: 'artifact or creature', mine: true, notSelf: true, optional: true, good: true }));
frRW(/Exile target nontoken creature\. Return it to the battlefield under its owner's control at the beginning of the next end step\./, 'frGlamer', cmd('fr_blinkEnd', { target: 'creature', filter: 'nontoken creature', good: true }));
FR.push([/^destroy target creature if no other creature has greater power$/i, () => cmd('fr_destroyIfBiggest', { target: 'creature' })]);
FR.push([/^until your next turn, prevent all damage that would be dealt to you$/i, () => cmd('fr_shieldYou')]);
frRW(/Exile any number of target creatures\. At the beginning of the next end step, return those cards to the battlefield tapped under their owners' control\./, 'frMorningtide', cmd('fr_morningtide', { multi: 'morningtide' }));
frRW(/Exile any number of other target permanents you control\. Return those cards to the battlefield under their owner's control at the beginning of the next end step\. If a land enters this way, it enters tapped\./, 'frSurfer', cmd('fr_surfer', { multi: 'surfer' }));
frRW(/Exile target artifact or creature, then return it to the battlefield under its owner's control with a \+1\/\+1 counter on it\./, 'frSpaceshift', cmd('fr_blinkNow', { target: 'perm', filter: 'artifact or creature', good: true, counter: 1 }));
frRW(/Exile target artifact or creature, then return that card to the battlefield under its owner's control with a \+1\/\+1 counter on it\./, 'frSpaceshift2', cmd('fr_blinkNow', { target: 'perm', filter: 'artifact or creature', good: true, counter: 1 }));
frRW(/Exile up to one target artifact, creature, or enchantment you control, then return it to the battlefield under its owner's control\./, 'frScrollshift', cmd('fr_blinkNow', { target: 'perm', filter: 'artifact, creature, or enchantment', mine: true, optional: true, good: true }));
frRW(/Exile target creature you control, then return that card to the battlefield under its owner's control\. If a Pirate was exiled this way, draw a card\./, 'frSiren', cmd('fr_blinkNow', { target: 'creature', mine: true, good: true, pirateDraw: true }));
frRW(/Exile target non-Pilot creature you control, then return that card to the battlefield under its owner's control\./, 'frAboard', cmd('fr_blinkNow', { target: 'creature', mine: true, good: true, nonPilot: true }));
FR.push([/^exile another target creature you control, then return it to the battlefield under its owner's control$/i, () => cmd('fr_blinkNow', { target: 'creature', mine: true, notSelf: true, good: true })]);
FR.push([/^exile up to one target nonland permanent you control, then return that card to the battlefield under its owner's control$/i, () => cmd('fr_blinkNow', { target: 'perm', filter: 'nonland permanent', mine: true, optional: true, good: true })]);
FR.push([/^airbend target creature you control$/i, () => cmd('fr_airbend', { target: 'creature', mine: true, good: true })]);

registerRules({ name: 'fivedecks', effects: FR });

// ----- U.S. Agent deck -----
clx('When ~ enters, create a colorless Equipment artifact token named Sturdy Shield with "Equipped creature gets +1/+2" and equip {2}. Attach it to ~.', R => { R.etb.push(cmd('fr_sturdy')); });
clx('At the beginning of combat on your turn, you may attach any number of Auras and Equipment you control to target permanent or player.', R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('fr_ardenn')] }); });
clx('Whenever ~ enters or attacks, you may attach any number of target Equipment to it.', R => { R.etb.push(cmd('fr_attachAll', { equipOnly: true, multi: 'equip' })); R.trig.push({ ev: 'attacks', fn: 'fr_selfAttacks', effects: [cmd('fr_attachAll', { equipOnly: true, multi: 'equip' })] }); });
clx('When ~ enters, you may attach any number of Auras and Equipment you control to it.', R => { R.etb.push(cmd('fr_attachAll')); });
clx('Other creatures you control get +1/+1 for each Aura and Equipment attached to ~.', R => { R.statics.push({ other: true, type: 'Creature', p: 1, q: 1, kw: [], perAttached: true }); });
clx('When ~ enters, return any number of target Aura and/or Equipment cards from your graveyard to the battlefield attached to enchanted creature.', R => { R.etb.push(cmd('fr_mantle', { multi: 'mantle' })); });
clx('Enchanted creature gets +1/+1 for each Aura and Equipment attached to it.', R => { R.buffPerAttached = { p: 1, q: 1 }; });
clx('Whenever you cycle ~ or cycle another card while ~ is on the battlefield, you may exile target creature. If you do, return that card to the battlefield under its owner\'s control at the beginning of the next end step.', R => { R.trig.push({ ev: 'cycled', fn: 'fr_myCycle', effects: [cmd('fr_blinkEnd', { target: 'creature', optional: true })] }); R.cycleTrig = [cmd('fr_blinkEnd', { target: 'creature', optional: true })]; });
clx('Whenever a player cycles a card, you may exile target creature. If you do, return that card to the battlefield under its owner\'s control at the beginning of the next end step.', R => { R.trig.push({ ev: 'cycled', fn: 'fr_anyCycle', effects: [cmd('fr_blinkEnd', { target: 'creature', optional: true })] }); });
clx('Whenever you cast an instant or sorcery spell that targets a creature, exile up to one target creature. Return that card to the battlefield under its owner\'s control at the beginning of the next end step.', R => { R.trig.push({ ev: 'cast', fn: 'fr_castTargetsCreature', effects: [cmd('fr_blinkEnd', { target: 'creature', optional: true })] }); });
clx('Whenever a source an opponent controls deals damage to you or a permanent you control, that source\'s controller loses 2 life unless they pay {1}.', R => { R.eleshTax = true; });
clx('{2}{W}, Sacrifice three other creatures: Exile ~, then return it to the battlefield transformed under its owner\'s control. Activate only as a sorcery.', (R, m, ctx) => { act(R, ctx.line, '{2}{W}', [{ t: 'exileReturnTransformed' }], a => { a.cost.sacN = { n: 3, kind: 'Creature' }; a.sorcery = true; }); });
clx('Permanents entering don\'t cause abilities of permanents your opponents control to trigger.', R => { R.noOppEnterTrig = true; });
clx('Outlast {W}', (R, m, ctx) => { act(R, ctx.line, '{W}, {T}', [{ t: 'counters', n: 1, target: 'self' }], a => { a.sorcery = true; }); });
clx('Commander creatures you own have "At the beginning of your end step, exile up to one target tapped creature you control, then return it to the battlefield under its owner\'s control."', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('fr_farTraveler')] }); });
clx('If an artifact or creature entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.', R => { R.panharmonicon = true; });
// Spree: the "+ {cost} — effect" lines that follow become modes; each chosen mode adds its cost (totalCost in 06-engine.js)
cl(/^Spree$/, (R, m, ctx) => {
    const costs = [], effs = []; let k = ctx.li + 1;
    while (k < ctx.lines.length && /^\+ \{/.test(ctx.lines[k])) {
        const mm = ctx.lines[k].match(/^\+ ((?:\{[^}]+\})+) — (.+)$/); if (!mm) return false;
        const e = parseEffects(mm[2]); if (!e) return false;
        costs.push(parseCost(mm[1])); effs.push(e); k++;
    }
    if (!effs.length) return false;
    R.modes = effs; R.spreeCosts = costs; R.modeN = { min: 1, max: effs.length }; ctx.li = k - 1; return true;
});
clx('{2}, {T}: Target opponent mills three cards. Put a land card from their graveyard onto the battlefield tapped under your control. It gains "If ~ would leave the battlefield, exile it instead of putting it anywhere else."', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('fr_realmbreaker1')]); });
clx('{10}, {T}, Sacrifice ~: Search your library for any number of Praetor cards, put them onto the battlefield, then shuffle.', (R, m, ctx) => { act(R, ctx.line, '{10}, {T}', [cmd('fr_realmbreaker2')], a => { a.cost.sacSelf = true; }); });
clx('All creatures and Vehicles lose indestructible until end of turn, then destroy all creatures and Vehicles.', R => { R.spell = [cmd('fr_pileup')]; });
clx('Cycling—Pay 2 life.', R => { R.cycling = parseCost('{0}'); R.cyclingLife = 2; });
clx('Whenever ~ attacks, return target creature card with mana value X or less from your graveyard to the battlefield, where X is the number of modified creatures you control.', R => { R.trig.push({ ev: 'attacks', fn: 'fr_selfAttacks', effects: [cmd('fr_unforgiving')] }); });
clx('When you cycle ~, put a deathtouch counter on target creature you control.', R => { R.cycleTrig = [cmd('fr_deathtouchCounter', { target: 'creature', mine: true, good: true })]; });
clx('Whenever a creature deals combat damage to one of your opponents, its controller may pay 1 life. If they do, they draw a card.', R => { R.trig.push({ ev: 'hitPlayer', fn: 'fr_anyCreatureHitsOpp', effects: [cmd('fr_gix')] }); });
clx('{4}{B}{B}{B}, Discard X cards: Exile the top X cards of target opponent\'s library. You may play lands and cast spells from among cards exiled this way without paying their mana costs.', (R, m, ctx) => { act(R, ctx.line, '{4}{B}{B}{B}', [cmd('fr_gixUlt')]); });

// ----- Kang the Conqueror deck -----
clx('{5}{U}{U}{U}: Put a +1/+1 counter on ~. Take an extra turn after this one. During that turn, power-up abilities can\'t be activated.', (R, m, ctx) => { act(R, ctx.line, '{5}{U}{U}{U}', [{ t: 'counters', n: 1, target: 'self' }, { t: 'extraTurn' }]); });
FR.push([/^put target spell or nonland permanent into its owner's library second from the top$/i, () => cmd('fr_commit', { target: 'spellOrPerm' })]);
clx('During your turn, ~ costs {2}{U}{U} less to cast.', R => { R.freeOnTurn = true; });
clx('End the turn.', R => { R.spell = [cmd('fr_endTurn')]; });
clx('During turns other than yours, ~ costs {3} more to cast.', R => { R.taxOffTurn = 3; });
clx('Return all nonland permanents to their owners\' hands. End the turn.', R => { R.spell = [{ t: 'massBounce', what: 'nonland permanents' }, cmd('fr_endTurn')]; });
clx('Destroy all artifacts and creatures. End the turn.', R => { R.spell = [{ t: 'wipe', how: 'destroy', what: 'artifacts and creatures' }, cmd('fr_endTurn')]; });
clx('Whenever you cast a noncreature spell, exile up to one target nonland permanent you control, then return that card to the battlefield under its owner\'s control.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('fr_blinkNow', { target: 'perm', filter: 'nonland permanent', mine: true, optional: true, good: true })] }); });
cl(/^When ~ enter, choose one or both\. Each mode must target a different player\.$/, (R, m, ctx) => { let k = ctx.li + 1; while (k < ctx.lines.length && ctx.lines[k].startsWith('•')) k++; R.etb.push(cmd('fr_donnie')); ctx.li = k - 1; return true; });
clx('{1}, {T}: Copy target activated or triggered ability you control from a creature source. You may choose new targets for the copy.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('fr_echo', { target: 'myCreatureAbility' })]); });
FR.push([/^create a token that's a copy of target creature you control, except it's not legendary and it's a 4\/4 hero in addition to its other types$/i, () => cmd('fr_copyHero', { target: 'creature', mine: true, good: true })]);
FR.push([/^create a token that's a copy of target creature an opponent controls, except it's not legendary and it's a 2\/2 coward in addition to its other types$/i, () => cmd('fr_copyCoward', { target: 'creature', theirs: true })]);
clx('When ~ enters, draw a card, then you may put a land card from your hand onto the battlefield tapped.', R => { R.etb.push(cmd('fr_herbie')); });
clx('{T}: Add {U} for each card you\'ve drawn this turn. Spend this mana only to cast noncreature spells.', R => { R.mana = { colors: ['U'], n: 1, onlyType: 'noncreature', drawnN: true }; });
FR.push([/^(?:you may )?choose new targets for target spell$/i, () => cmd('fr_retarget', { target: 'spell', filter: 'any' })]);
frRW(/Copy target spell\. You may choose new targets for the copy\./, 'frCopyAnySpell', cmd('fr_copySpell', { target: 'spell', filter: 'any', anySpell: true }));
frRW(/Copy target instant or sorcery spell\. You may choose new targets for the copy\./, 'frCopySpell', cmd('fr_copySpell', { target: 'spell', filter: 'any' }));
clx('~ can\'t be copied.', R => { R.cantBeCopied = true; });
clx('As an additional cost to cast ~, you may exile any number of blue cards from your hand. ~ costs {2} less to cast for each card exiled this way.', R => { R.exileBlueReduce = 2; });
frRW(/Up to 97 target creatures phase out\./, 'frPhaseX', cmd('fr_phaseOutX', { n: 'X', multi: 'phase' }));
clx('Whenever you cast a spell that targets a creature you control, draw a card. Until end of turn, ~ gains "~\'s base power is equal to the number of cards in your hand."', R => { R.trig.push({ ev: 'cast', fn: 'fr_castTargetsMyCreature', effects: [cmd('fr_msMarvel')] }); });
clx('The first time you would draw a card each turn except the first card you draw during each of your draw steps, you draw four cards instead.', R => { R.reedDraw = true; });
clx('{5}, Exile ~ from your graveyard: Choose target creature. Put four +1/+1 counters, a flying counter, a vigilance counter, a trample counter, and a lifelink counter on that creature. Activate only as a sorcery.', (R, m, ctx) => { const a = act(R, ctx.line, '{5}', [cmd('fr_brawler', { target: 'creature', good: true })], a => { a.cost.exileSelfGy = true; a.sorcery = true; }); R.acts.pop(); (R.gyActs = R.gyActs || []).push(a); });
cl(/^Whenever you cast a noncreature spell, choose one that hasn't been chosen this turn —$/, (R, m, ctx) => { let k = ctx.li + 1; while (k < ctx.lines.length && ctx.lines[k].startsWith('•')) k++; R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('fr_vision')] }); ctx.li = k - 1; return true; });
clx('When ~ enters, tap up to one target creature. It loses all abilities for as long as ~ remains on the battlefield.', R => { R.etb.push(cmd('fr_wasp', { target: 'creature', optional: true })); });
clx('Choose artifact, creature, or land. Tap all untapped permanents of the chosen type target player controls, or untap all tapped permanents of that type that player controls.', R => { R.spell = [cmd('fr_turnabout', { target: 'player' })]; });
clx('{T}, Remove two charge counters from ~: Add {C}{C}.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'addMana', colors: ['C'], n: 2 }], a => { a.cost.removeNamedN = { kind: 'charge', n: 2 }; a.mana = true; }); });
clx('{T}, Remove three charge counters from ~: It deals 3 damage to any target.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'dmg', n: 3, target: 'any' }], a => { a.cost.removeNamedN = { kind: 'charge', n: 3 }; }); });
frRW(/Return an artifact card from your graveyard to your hand\. If you can't, draw a card\./, 'frInventive', cmd('fr_inventive'));

// ----- Lorehold, the Historian deck -----
clx('Each instant and sorcery card in your hand has miracle {2}.', R => { R.grantMiracle = true; });
clx('Whenever ~ attacks, if defending player controls more lands than you, search your library for a basic Plains card, put it onto the battlefield tapped, then shuffle.', R => { R.trig.push({ ev: 'attacks', fn: 'fr_selfAttacks', effects: [cmd('fr_surveyor')] }); });
clx('~ enters tapped. As it enters, choose a color.', R => { R.entersTapped = true; R.chooseColor = true; });
clx('{5}, {T}: Create a 1/1 black Rat creature token for each opponent you have.', (R, m, ctx) => { act(R, ctx.line, '{5}, {T}', [cmd('fr_rats')]); });
FR.push([/^for each land you control, create a treasure token$/i, () => cmd('fr_brassBounty')]);
clx('When ~ enters, discard any number of cards, then draw that many cards plus one.', R => { R.etb.push(cmd('fr_wheelPlus')); });
clx('When ~ dies, discard any number of cards, then draw that many cards plus one.', R => { R.trig.push({ ev: 'dies', fn: 'fr_selfDies', effects: [cmd('fr_wheelPlus')] }); });
clx('At the beginning of your end step, if you descended this turn, put a bore counter on ~. Then if there are three or more bore counters on it, remove those counters and transform it.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('fr_bore')] }); });
FR.push([/^return all artifact and enchantment cards from your graveyard to the battlefield$/i, () => cmd('fr_brilliant')]);
clx('Whenever another nontoken artifact creature or Vehicle you control enters, draw a card.', R => { R.trig.push({ ev: 'enters', fn: 'fr_nontokenArtCreatureOrVehicle', effects: [{ t: 'draw', n: 1 }] }); });
clx('When ~ enters, each player chooses an artifact, a creature, an enchantment, and a planeswalker from among the nonland permanents they control, then sacrifices the rest.', R => { R.etb.push(cmd('fr_gearhulk')); });
frRW(/Exile up to one target artifact, up to one target creature, up to one target enchantment, up to one target planeswalker, and\/or up to one target land\. For each permanent exiled this way, its controller reveals cards from the top of their library until they reveal a card that shares a card type with it, puts that card onto the battlefield, then shuffles\./, 'frChaotic', cmd('fr_chaotic', { multi: 'chaotic' }));
clx('Whenever you discard a card, ~ deals 2 damage to each opponent.', R => { R.trig.push({ ev: 'discarded', effects: [{ t: 'dmgOpp', n: 2 }] }); });
clx('When ~ becomes level 3, search your library for a card, put it into your hand, shuffle, then discard a card at random.', R => { R.trig.push({ ev: 'levelUp', fn: 'fr_levelThree', effects: [cmd('fr_tutorDiscardRandom')] }); });
clx('Whenever ~ becomes crewed, each artifact creature card in your graveyard gains unearth {3} until end of turn.', R => { R.trig.push({ ev: 'crewed', fn: 'fr_selfCrewed', effects: [cmd('fr_ghostArk')] }); });
frRW(/Return target permanent card from your graveyard to the battlefield, then distribute four \+1\/\+1 counters among any number of creatures and\/or Vehicles target player controls\./, 'frInvoke', cmd('fr_invokeJustice', { multi: 'invoke' }));
clx('{T}: Put a +1/+1 counter on each artifact creature and\/or Vehicle you control.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('fr_ironSpider')]); });
clx('{2}, Remove two +1/+1 counters from among artifacts you control: Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{2}', [cmd('fr_ironDraw')], a => { a.onlyIf = 'artifacts you control have two or more +1/+1 counters among them'; }); });
clx('Whenever ~ or a commander you control attacks alone, return target artifact card from your graveyard to the battlefield.', R => { R.trig.push({ ev: 'attacks', fn: 'fr_enforcerAlone', effects: [cmd('fr_returnArtifact')] }); });
clx('At the beginning of combat on your turn, choose an opponent at random. ~ attacks that player this combat if able.', R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('fr_rampagerCombat')] }); });
clx('When ~ dies, it deals 4 damage to target opponent chosen at random.', R => { R.trig.push({ ev: 'dies', fn: 'fr_selfDies', effects: [cmd('fr_rampagerDies')] }); });
clx('Whenever ~ attacks, mill three cards. For each creature card milled this way, create a 2/2 black Necron Warrior artifact creature token.', R => { R.trig.push({ ev: 'attacks', fn: 'fr_selfAttacks', effects: [cmd('fr_necron')] }); });
clx('{3}: Until end of turn, ~\'s base power becomes equal to the number of Towns you control.', (R, m, ctx) => { act(R, ctx.line, '{3}', [cmd('fr_pupu')]); });
frRW(/Return any number of target creature cards with total power 10 or less from your graveyard to the battlefield\. Exile ~\./, 'frReunion', cmd('fr_reunion', { multi: 'reunion' }));
clx('Whenever you attack, other creatures you control get +2/+2 and gain indestructible until end of turn.', R => { R.trig.push({ ev: 'attacks', fn: 'anyAttackMine', once: 'fr_colossus', effects: [{ t: 'teamPump', other: true, p: 2, q: 2, kw: ['indestructible'] }] }); });
clx('Unearth—Pay eight {E}.', R => { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(''), tap: false, energy: 8 }, effects: [{ t: 'unearth' }], text: 'Unearth—Pay eight {E}' }); });
clx('When ~ enters, choose an opponent. If that player has more cards in hand than you, draw cards equal to the difference.', R => { R.etb.push(cmd('fr_oracle')); });
frRW(/Each player may discard their hand and draw five cards\. Then ~ deals 5 damage to each opponent who discarded their hand this way\./, 'frSnort', cmd('fr_snort'));
frRW(/Return all creature cards from your graveyard to the battlefield\. Each of them is a 1\/1 Spirit with flying in addition to its other types\. Exile ~\./, 'frStorm', cmd('fr_stormOfSouls'));
FR.push([/^~ deals damage equal to the total mana value of other permanents you control to each opponent$/i, () => cmd('fr_bahamut')]);
frRW(/Other creatures you control get \+2\/\+2 until end of turn\. Put an indestructible counter on each of them\./, 'frKnights', cmd('fr_knights'));
frRW(/Discard a card, then draw two cards\. When you discard a card this way, ~ deals damage equal to that card's mana value to each opponent\./, 'frKujata', cmd('fr_kujata'));
clx('~ costs {1} less to cast for each historic card in your graveyard.', R => { R.costLessHistoricGy = true; });
clx('Exile any number of historic cards from your graveyard with total mana value 30 or greater: You get an emblem with "Creatures you control have base power and toughness 9/9."', (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('fr_triadEmblem')], a => { a.onlyIf = 'your graveyard has historic cards with total mana value 30 or greater'; }); });
clx('At the beginning of your upkeep, each player exiles the top card of their library. Until end of turn, you may play the card you own exiled this way and each other card exiled this way with lesser mana value than it without paying their mana costs.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('fr_tripleTriad')] }); });
frRW(/Return target artifact card from your graveyard to the battlefield\. If it's a Vehicle, it becomes an artifact creature\./, 'frTuneUp', cmd('fr_tuneUp'));
frRW(/Put any number of cards from your hand on the bottom of your library, then draw that many cards plus one\./, 'frValakut', cmd('fr_valakut'));

// ----- Jadzi, Oracle of Arcavios deck -----
clx('When ~ enters, return a land you control to its owner\'s hand. If another Desert was returned this way, surveil 1.', R => { R.etb.push(cmd('fr_archway')); });
clx('When ~ enters, sacrifice it unless you return an untapped Island you control to its owner\'s hand.', R => { R.etb.push(cmd('fr_karoo', { land: 'Island' })); });
clx('When ~ enters, sacrifice it unless you return an untapped Forest you control to its owner\'s hand.', R => { R.etb.push(cmd('fr_karoo', { land: 'Forest' })); });
frRW(/For each of 97 target permanents, create 97 tokens that are copies of that permanent\./, 'frDoppel', cmd('fr_doppelgang', { n: 'X', multi: 'doppel' }));
clx('Assist', R => { R.kw.add('assist'); R.assist = true; }); // another person at the table may pay part of the generic cost (frAssistAsk)
clx('When ~ enters, you may change the target of target instant or sorcery spell with a single target to ~.', R => { R.etb.push(cmd('fr_hydro', { target: 'spell', filter: 'any', optional: true })); });
clx('Whenever you draw a card, target opponent mills two cards. If two nonland cards that share a color were milled this way, repeat this process.', R => { R.trig.push({ ev: 'draw', who: 'you', effects: [cmd('fr_sphinx')] }); });
clx('{T}, Return a land you control to its owner\'s hand: Draw a card. Then discard a card unless that land had a nonbasic land type.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('fr_wonderscape')], a => { a.onlyIf = 'you control a land'; }); });

// ----- Torgaar, Famine Incarnate deck -----
clx('As an additional cost to cast ~, you may sacrifice any number of creatures. ~ costs {2} less to cast for each creature sacrificed this way.', R => { R.sacReduce = 2; });
clx('When ~ enters, up to one target player\'s life total becomes half their starting life total, rounded down.', R => { R.etb.push(cmd('fr_torgaar', { target: 'player', optional: true })); });
frRW(/Choose a card name\. Search target opponent's graveyard, hand, and library for up to four cards with that name and exile them\. Then that player shuffles\./, 'frVendetta', cmd('fr_vendetta'));
frRW(/You may mill two cards\. Then return up to two creature cards from your graveyard to your hand\./, 'frAnother', cmd('fr_anotherChance'));
clx('When ~ dies, you draw X cards and you lose X life, where X is the number of creature cards in target player\'s graveyard.', R => { R.trig.push({ ev: 'dies', fn: 'fr_selfDies', effects: [cmd('fr_corpseAugur', { target: 'player' })] }); });
clx('At the beginning of your upkeep, each opponent loses 3 life unless they discard a card. If you\'re the monarch, instead each opponent loses 6 life unless they discard two cards.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('fr_court')] }); });
clx('At the beginning of your upkeep, if each player has 10 or less life, transform ~.', R => { R.trig.push({ ev: 'upkeep', who: 'your', cond: 'each player has 10 or less life', effects: [{ t: 'transform' }] }); });
cl(/^When ~ dies, choose one\. If you have exactly 13 life, you may choose both instead\.$/, (R, m, ctx) => { let k = ctx.li + 1; while (k < ctx.lines.length && ctx.lines[k].startsWith('•')) k++; R.trig.push({ ev: 'dies', fn: 'fr_selfDies', effects: [cmd('fr_disciple')] }); ctx.li = k - 1; return true; });
frRW(/Destroy up to three target creatures with toughness 97 or less\. If 97 is 10 or more, return all creature cards from your graveyard to the battlefield\./, 'frFinale', cmd('fr_finale', { n: 'X', multi: 'finale' }));
clx('Whenever equipped creature deals combat damage to a player, you may sacrifice it. If you do, draw cards equal to its power.', R => { R.trig.push({ ev: 'hitPlayer', fn: 'fr_hostHitsPlayer', effects: [cmd('fr_footChopper')] }); });
clx('~ costs {2} less to cast if a player\'s life total is less than or equal to half their starting life total.', R => { R.costLessLowLife = 2; });
frRW(/Target opponent reveals their hand\. You choose an artifact or creature card from it\. Exile that card\./, 'frIntimidation', cmd('fr_intimidation'));
clx('Whenever a creature deals damage to you, destroy it.', R => { R.trig.push({ ev: 'dealsDamage', fn: 'fr_creatureHurtsMe', effects: [cmd('fr_noMercy')] }); });
frRW(/Until end of turn, any number of target creatures you control each get \+1\/\+0 and gain "When ~ dies, draw a card\."/, 'frRabid', cmd('fr_rabid', { multi: 'rabid' }));
frRW(/Each opponent discards a card\. You create a 1\/1 black and green Pest creature token with "Whenever ~ attacks, you gain 1 life\."/, 'frPest', cmd('fr_pest'));
clx('Sneak {1}{B} (You may cast this spell for {1}{B} if you also return an unblocked attacker you control to hand during the declare blockers step.)', R => { R.sneak = parseCost('{1}{B}'); });
clx('Sneak {1}{B}', R => { R.sneak = parseCost('{1}{B}'); });
clx('At the beginning of your end step, if a creature died this turn, you draw a card and you lose 1 life. If seven or more creatures died this turn, instead you draw seven cards and you lose 7 life.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('fr_tallyman')] }); });
clx('20+ | {T}: Add X mana of any one color, where X is the number of charge counters on ~.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('fr_elevator')], a => { a.stationMin = 20; a.onlyIf = '~ has 20 or more charge counters'; }); });
clx('Craft with creature {4}{B}', (R, m, ctx) => { act(R, ctx.line, '{4}{B}', [cmd('fr_craft')], a => { a.sorcery = true; a.onlyIf = 'you have a creature to craft with'; }); });
frRW(/Draw a card, then discard a card\. You lose 1 life\. If ~ was cast from your hand, create a 0\/1 black Wizard creature token with "Whenever you cast a noncreature spell, ~ deals 1 damage to each opponent\."/, 'frTranspose', cmd('fr_transpose'));
clx('Enchant player', R => { R.enchantPlayer = true; R.isAura = false; R.etb.push({ t: 'enchantPlayer' }); });
clx('Whenever a creature enchanted player controls enters, that player loses 1 life and you gain 1 life.', R => { R.trig.push({ ev: 'enters', fn: 'fr_curseEnter', effects: [cmd('fr_curseTick')] }); });
clx('When ~ enters, create a number of 1/1 green Squirrel creature tokens equal to your devotion to black.', R => { R.etb.push(cmd('fr_hermit')); });
clx('When ~ enters, you may exile two cards from your graveyard. When you do, return target creature card from your graveyard to the battlefield.', R => { R.etb.push(cmd('fr_necromancer')); });
frRW(/Return target creature card from your graveyard to your hand\. If ~ was kicked, instead put that card onto the battlefield tapped\./, 'frZuko', cmd('fr_zuko'));

FR.push([/^return target spell or nonland permanent an opponent controls to its owner's hand$/i, () => cmd('fr_sinkStupor', { target: 'spellOrPerm', theirs: true })]);
frRW(/Each player may shuffle their hand and graveyard into their library\. Each player who does draws seven cards\. Exile ~\./, 'frStepBetween', cmd('fr_stepBetween'));
