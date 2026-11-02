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
frRW(/Exile any number of target creatures\. At the beginning of the next end step, return those cards to the battlefield tapped under their owners' control\./, 'frMorningtide', cmd('fr_morningtide'));
frRW(/Exile any number of other target permanents you control\. Return those cards to the battlefield under their owner's control at the beginning of the next end step\. If a land enters this way, it enters tapped\./, 'frSurfer', cmd('fr_surfer'));
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
clx('Whenever ~ enters or attacks, you may attach any number of target Equipment to it.', R => { R.etb.push(cmd('fr_attachAll', { equipOnly: true })); R.trig.push({ ev: 'attacks', fn: 'fr_selfAttacks', effects: [cmd('fr_attachAll', { equipOnly: true })] }); });
clx('When ~ enters, you may attach any number of Auras and Equipment you control to it.', R => { R.etb.push(cmd('fr_attachAll')); });
clx('Other creatures you control get +1/+1 for each Aura and Equipment attached to ~.', R => { R.statics.push({ other: true, type: 'Creature', p: 1, q: 1, kw: [], perAttached: true }); });
clx('When ~ enters, return any number of target Aura and/or Equipment cards from your graveyard to the battlefield attached to enchanted creature.', R => { R.etb.push(cmd('fr_mantle')); });
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
FR.push([/^create a token that's a copy of target creature$/i, () => cmd('fr_copyCreature', { target: 'creature' })]);
clx('~ can\'t be copied.', R => { R.cantBeCopied = true; });
clx('As an additional cost to cast ~, you may exile any number of blue cards from your hand. ~ costs {2} less to cast for each card exiled this way.', R => { R.exileBlueReduce = 2; });
frRW(/Up to 97 target creatures phase out\./, 'frPhaseX', cmd('fr_phaseOutX', { n: 'X' }));
clx('Whenever you cast a spell that targets a creature you control, draw a card. Until end of turn, ~ gains "~\'s base power is equal to the number of cards in your hand."', R => { R.trig.push({ ev: 'cast', fn: 'fr_castTargetsMyCreature', effects: [cmd('fr_msMarvel')] }); });
clx('The first time you would draw a card each turn except the first card you draw during each of your draw steps, you draw four cards instead.', R => { R.reedDraw = true; });
clx('{5}, Exile ~ from your graveyard: Choose target creature. Put four +1/+1 counters, a flying counter, a vigilance counter, a trample counter, and a lifelink counter on that creature. Activate only as a sorcery.', (R, m, ctx) => { const a = act(R, ctx.line, '{5}', [cmd('fr_brawler', { target: 'creature', good: true })], a => { a.cost.exileSelfGy = true; a.sorcery = true; }); R.acts.pop(); (R.gyActs = R.gyActs || []).push(a); });
cl(/^Whenever you cast a noncreature spell, choose one that hasn't been chosen this turn —$/, (R, m, ctx) => { let k = ctx.li + 1; while (k < ctx.lines.length && ctx.lines[k].startsWith('•')) k++; R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('fr_vision')] }); ctx.li = k - 1; return true; });
clx('When ~ enters, tap up to one target creature. It loses all abilities for as long as ~ remains on the battlefield.', R => { R.etb.push(cmd('fr_wasp', { target: 'creature', optional: true })); });
clx('Choose artifact, creature, or land. Tap all untapped permanents of the chosen type target player controls, or untap all tapped permanents of that type that player controls.', R => { R.spell = [cmd('fr_turnabout', { target: 'player' })]; });
clx('{T}, Remove two charge counters from ~: Add {C}{C}.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'addMana', colors: ['C'], n: 2 }], a => { a.cost.removeNamedN = { kind: 'charge', n: 2 }; a.mana = true; }); });
clx('{T}, Remove three charge counters from ~: It deals 3 damage to any target.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'dmg', n: 3, target: 'any' }], a => { a.cost.removeNamedN = { kind: 'charge', n: 3 }; }); });
frRW(/Return an artifact card from your graveyard to your hand\. If you can't, draw a card\./, 'frInventive', cmd('fr_inventive'));
