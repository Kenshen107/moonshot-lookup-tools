// Spellslinger Duels - rules pack: six more owner decks (2026-11-15): Nog, Terra, Urianger, Jenova (second list), Gogo and Beorn the Fierce.
// Wordings only; engine pieces are in 15w-sixlists.js (CMD ids start with sl_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text must use the reader's "~" form (this card's name and "this creature" both become "~").
const slTarget = ph => { const F = parseTargetPhrase(ph); return F ? 'sf:' + JSON.stringify(F) : null; };

// ===== Nog, Ambitious Cadet deck =====
clx('{3}{B}, {T}, Sacrifice ~: Each opponent loses 2 life and you gain 2 life. Create a tapped Planet land token named New Planet with "{T}: Add one mana of any color."', (R, m, ctx) => { act(R, ctx.line, '{3}{B}, {T}, Sacrifice ~', [{ t: 'drain', n: 2 }, { t: 'gain', n: 2 }, cmd('tkNewPlanet')]); });
clx('{3}{G}, {T}, Sacrifice ~: Mill four cards. You may put a permanent card from among them into your hand. Create a tapped Planet land token named New Planet with "{T}: Add one mana of any color."', (R, m, ctx) => { act(R, ctx.line, '{3}{G}, {T}, Sacrifice ~', [cmd('sl_tempAnomaly'), cmd('tkNewPlanet')]); });
clx('Whenever you cast a creature spell, put X +1/+1 counters on target creature you control, where X is that spell\'s mana value.', R => { R.trig.push({ ev: 'cast', filter: 'types:Creature', effects: [cmd('sl_dancing', { target: 'creature', mine: true })] }); });
clx('{5}, {T}: Mill two cards. Then you may sacrifice ~. When you do, return another target permanent card from your graveyard to your hand.', (R, m, ctx) => { act(R, ctx.line, '{5}, {T}', [cmd('sl_eden')]); });
clx('Destroy all creatures you don\'t control and all planeswalkers you don\'t control.', R => { R.spell = [cmd('sl_garrukWake')]; });
clx('{T}: Exile the top card of target player\'s library. If it\'s a land card, you gain 1 life.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sl_scrib', { target: 'player' })]); });
clx('At the beginning of your upkeep, sacrifice ~ unless you sacrifice a land.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sl_gitrogUpkeep')] }); });
clx('Whenever one or more land cards are put into your graveyard from anywhere, draw a card.', R => { R.slGitrogDraw = true; });
clx('{1}, {T}, Sacrifice ~: Destroy target nonland permanent... '.slice(0, 0) + '{1}, {T}, Sacrifice ~: Destroy target nonbasic land an opponent controls. That player may search their library for a basic land card, put it onto the battlefield, then shuffle. You create a Treasure token.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}, Sacrifice ~', [cmd('sl_volatileFault', { target: 'perm', filter: slTarget('nonbasic land an opponent controls') })]); });
clx('Affinity for Forests', R => { R.affinityOf = 'Forest'; });
clx('{1}{G}, Exile ~: Treefolk and Forests you control gain indestructible until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}{G}, Exile ~', [cmd('sl_nursery')]); });

// ===== Terra, Magical Adept deck =====
clx('Return target nonland permanent to its owner\'s hand. If that permanent had mana value 3 or less, proliferate.', R => { R.spell = [cmd('sl_serumSnare', { target: 'perm', filter: 'nonland permanent' })]; });
clx('Return each nonland permanent that\'s not historic to its owner\'s hand.', R => { R.spell = [cmd('sl_desync')]; });
clx('Return any number of permanent cards with different names from your graveyard to the battlefield.', R => { R.spell = [cmd('sl_eerie')]; });
clx('Return target creature card from your graveyard to your hand. If ~ was kicked, instead return two target creature cards from your graveyard to your hand.', R => { R.spell = [cmd('sl_beckon')]; });
clx('Whenever you tap a land for mana, add one mana of any type that land produced.', R => { R.landDoubleMine = true; });
clx('Permanents you control with counters on them gain hexproof and indestructible until end of turn. Prevent all damage that would be dealt to those permanents this turn. Proliferate.', R => { R.spell = [cmd('sl_mutational')]; });

// ===== Urianger Augurelt deck =====
clx('{T}: Untap target artifact or creature.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'untap', target: 'perm', filter: 'artifact or creature' }]); });
clx('{T}: You may tap or untap another target permanent.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('sl_tapOrUntap', { target: 'perm', filter: 'permanent', notSelf: true })]); });
clx('{T}: Untap another target permanent you control.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'untap', target: 'perm', filter: 'permanent', notSelf: true, mine: true }]); });
clx('{1}, {T}: Untap target legendary creature you control.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [{ t: 'untap', target: 'perm', filter: slTarget('legendary creature you control') }]); });
clx('{U}: Untap enchanted creature.', (R, m, ctx) => { act(R, ctx.line, '{U}', [cmd('sl_untapHost')]); });
clx('{1}: Enchanted creature gets +1/-1 or -1/+1 until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('sl_pemmin')]); });
clx('When you cycle ~, untap target permanent.', R => { R.cycleTrig = [{ t: 'untap', target: 'perm', filter: 'permanent' }]; });
clx('Put a +1/+1 counter on target creature. It phases out.', R => { R.spell = [cmd('sl_slipOut', { target: 'creature' })]; });
clx('Whenever you gain life, put a +1/+1 counter on each Angel you control.', R => { R.trig.push({ ev: 'gainLife', effects: [cmd('sl_lyra')] }); });
clx('When ~ dies, create X 1/1 white Vampire creature tokens with lifelink, where X is its power.', R => { R.trig.push({ ev: 'dies', effects: [cmd('sl_hierophant')] }); });
clx('Permanents you control gain indestructible until end of turn. If ~ was cast from exile, prevent all damage that would be dealt to you this turn.', R => { R.spell = [cmd('sl_ultimateHoly')]; });

// ===== Jenova (second list) =====
clx('At the beginning of your upkeep, sacrifice a creature. You gain life equal to that creature\'s toughness.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sl_doomgape')] }); });
clx('When ~ enters, for each opponent, put X -1/-1 counters on up to one target creature that player controls, where X is the greatest mana value among cards in your graveyard.', R => { R.etb.push(cmd('sl_hapatra')); });

// ===== Gogo deck =====
clx('When ~ dies, create a 3/3 colorless Phyrexian Wurm artifact creature token with deathtouch and a 3/3 colorless Phyrexian Wurm artifact creature token with lifelink.', R => { R.trig.push({ ev: 'dies', effects: [{ t: 'token', n: 1, p: 3, q: 3, name: 'colorless Phyrexian Wurm', artifact: true, kw: ['deathtouch'] }, { t: 'token', n: 1, p: 3, q: 3, name: 'colorless Phyrexian Wurm', artifact: true, kw: ['lifelink'] }] }); });
clx('Until end of turn, whenever a player taps an Island for mana, that player adds an additional {U}.', R => { R.spell = [cmd('sl_highTide')]; });
clx('When ~ enters, up to one target creature phases out.', R => { R.etb.push(cmd('sl_phaseOutTarget', { target: 'creature' })); });

// ===== Beorn the Fierce deck =====
clx('10,000 Needles — Whenever ~ attacks, it gets +9999/+0 until end of turn.', R => { R.trig.push({ ev: 'attacks', fn: 'hg_selfAttacksHS', effects: [{ t: 'pump', p: 9999, q: 0, kw: [], target: 'self' }] }); });
clx('Whenever you cast a green spell and whenever a Forest you control enters, put a +1/+1 counter on target creature you control.', R => { R.trig.push({ ev: 'cast', filter: 'color:G', effects: [{ t: 'counters', n: 1, target: 'creature', mine: true }] }); R.trig.push(SPEC('enters', { sub: 'Forest' }, { effects: [{ t: 'counters', n: 1, target: 'creature', mine: true }] })); });
clx('{5}{G}{G}: ~ becomes a 7/7 Beast creature in addition to its other types.', (R, m, ctx) => { act(R, ctx.line, '{5}{G}{G}', [{ t: 'permAnimatePT', p: 7, q: 7 }]); });
clx('Target player gains 2 life, then searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles. Put a +1/+1 counter on up to one target creature.', R => { R.spell = [cmd('sl_restorative')]; });
clx('Look at the top X cards of your library, where X is the number of lands you control. You may reveal a creature or land card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.', R => { R.spell = [cmd('sl_seismic')]; });

// ===== batch 2 =====
// Terra: Summon sagas
const slChap = (list, fx) => (R) => { R.saga = R.saga || {}; list.forEach(n => (R.saga[n] = R.saga[n] || []).push(...fx)); };
clx('IV — Each opponent sacrifices a creature of their choice and loses 3 life.', slChap([4], [cmd('sl_animaEdict')]));
clx('I — ~ deals damage equal to the number of noncreature, nonland cards in your graveyard to target creature an opponent controls.', slChap([1], [cmd('sl_ramuh', { target: 'creature', theirs: true })]));
clx('I — Each opponent chooses a creature with the greatest mana value among creatures they control. Return those creatures to their owners\' hands.', slChap([1], [cmd('sl_valefor')]));
clx('III — Draw a card for each tapped creature your opponents control.', slChap([3], [cmd('sl_shiva')]));
clx('I — Return each creature that isn\'t a Kraken, Leviathan, Merfolk, Octopus, or Serpent to its owner\'s hand.', slChap([1], [cmd('sl_leviathanBounce')]));
clx('II, III — Until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card.', slChap([2, 3], [cmd('sl_leviathanDraw')]));
clx('II — ~ gains "Whenever ~ deals combat damage to a player, that player loses the game."', slChap([2], [cmd('sl_odin')]));
clx('II, III — Until your next turn, creatures can\'t attack you unless their controller pays {2} for each of those creatures.', slChap([2, 3], [cmd('sl_yojimboTax')]));
clx('IV — Create X Treasure tokens, where X is the number of opponents who control a creature with power 4 or greater.', slChap([4], [cmd('sl_yojimboTreasure')]));
cl(/^I, II, III — Choose one at random —$/, (R, m, ctx) => { const n = ctx.lines.slice(ctx.li + 1, ctx.li + 4); if (n.length !== 3 || !n.every(l => /^• /.test(l))) return false; slChap([1, 2, 3], [cmd('sl_magus')])(R); ctx.li += 3; return true; });
// Urianger
clx('At the beginning of each end step, if you gained 4 or more life this turn, create a 4/4 white Angel creature token with flying and vigilance.', R => { R.trig.push({ ev: 'end', who: 'any', effects: [cmd('sl_harbinger')] }); });
clx('You have protection from each of your opponents.', R => { R.playerHexproof = true; R.slAbsVirtue = true; });
clx('Other tapped legendary creatures you control have indestructible.', R => { R.statics.push({ other: true, spec: { type: 'Creature', legendary: true, tapped: true }, p: 0, q: 0, kw: ['indestructible'] }); });
clx('You may activate abilities of creatures you control as though those creatures had haste.', R => { R.slElixir = true; });
// Gogo
clx('{4}: Put ~ from your hand onto the battlefield.', (R, m, ctx) => { const a = act(R, ctx.line, '{4}', [cmd('sl_talonGates')]); a.hand = true; });
clx('{3}, {T}: You may put a land card from your hand onto the battlefield tapped.', (R, m, ctx) => { act(R, ctx.line, '{3}, {T}', [cmd('sl_horizon')]); });
clx('{2}, {T}, Sacrifice ~: Search your library for up to two basic land cards and/or Gate cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Sacrifice ~', [cmd('sl_navOrb')]); });
clx('{T}: Add {C} for each Urza\'s land you control. Activate only if you control three or more artifacts.', (R, m, ctx) => { R.mana = { colors: ['C'], n: 1, slWorkshop: true }; });
clx('~ is every nonbasic land type.', R => { R.slPlanarNexus = true; });
// Beorn
clx('Whenever ~ attacks while you control a creature with power 4 or greater, until end of turn, ~ gets +1/+0 and creatures you control gain trample.', R => { R.trig.push({ ev: 'attacks', fn: 'hg_selfAttacksHS', effects: [cmd('sl_wargling')] }); });
clx('~ gets +1/+1 for each creature you control and each creature card in your graveyard.', R => { R.cdaAdd = { p: 1, q: 1, what: 'the number of creatures you control and creature cards in your graveyard' }; });
clx('Whenever another creature enters, its controller may draw a card if its power is greater than each other creature\'s power.', R => { R.trig.push({ ev: 'enters', who: 'any', fn: 'sl_otherCreatureEnters', effects: [cmd('sl_selvalaDraw')] }); });
clx('{G}, {T}: Add X mana in any combination of colors, where X is the greatest power among creatures you control.', (R, m, ctx) => { R.mana = { colors: [...COLORS], n: 1, fee: { G: 1 }, slGreatest: true }; });
clx('The first creature spell you cast each turn costs {2} less to cast and can be cast as though it had flash.', R => { R.reducer = { what: 'firstCreature', n: 2 }; R.slRadagast = true; });
clx('Whenever a nontoken creature you control dies, reveal cards from the top of your library until you reveal a creature card. If its mana value is less than or equal to the number of lands you control, put it onto the battlefield. Otherwise, put it into your hand. Put the rest on the bottom of your library in a random order. This ability triggers only once each turn.', R => { R.trig.push({ ev: 'creatureDies', fn: 'sl_myNontokenDies', effects: [cmd('sl_partFriendship')] }); });
cl(/^Tiered$/, (R, m, ctx) => {
    const costs = [], effs = []; let k = ctx.li + 1; const FX = [() => [{ t: 'pump', p: 2, q: 2, kw: [], target: 'creature', good: true }], () => [cmd('sl_scalePT', { k: 2, target: 'creature', good: true })], () => [cmd('sl_scalePT', { k: 3, target: 'creature', good: true })]];
    while (k < ctx.lines.length && /^• /.test(ctx.lines[k])) { const mm = ctx.lines[k].match(/^• [^—]+ — ((?:\{[^}]+\})+) — /); if (!mm || !FX[effs.length]) return false; costs.push(parseCost(mm[1])); effs.push(FX[effs.length]()); k++; }
    if (effs.length !== 3) return false;
    R.modes = effs; R.spreeCosts = costs; R.modeN = { min: 1, max: 1 }; ctx.li = k - 1; return true;
});
COUNT_EXTRA.push([/^(?:the number of )?creatures you control and creature cards in your graveyard$/, () => o => G.players[o.owner].bf.filter(isCreature).length + G.players[o.owner].gy.filter(c => /\bCreature\b/.test(c.card.type)).length]);

// Vastlands Scavenger's prepared spell (Bind to Life)
const SLX = [
    [/^mill seven cards\. then put a creature card from among them onto the battlefield$/i, () => [cmd('sl_bindLife')]]
];
registerRules({ name: 'sixlists', effects: SLX });

// ===== batch 3 =====
// Terra: Esper Origins (and its back face, Summon: Esper Maduin), Summon: Choco/Mog, Sylvan Library, the Yunas, Summoner's Grimoire
clx('Surveil 2. You gain 2 life. If ~ was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner\'s control with a finality counter on it.', R => { R.spell = [cmd('sl_esperOrigins')]; });
clx('I — Reveal the top card of your library. If it\'s a permanent card, put it into your hand.', slChap([1], [cmd('sl_maduin1')]));
clx('III — Other creatures you control get +2/+2 and gain trample until end of turn.', slChap([3], [cmd('sl_maduin3')]));
clx('I, II, III, IV — Stampede! — Other creatures you control get +1/+0 until end of turn.', slChap([1, 2, 3, 4], [cmd('sl_stampede')]));
clx('At the beginning of your draw step, you may draw two additional cards. If you do, choose two cards in your hand drawn this turn. For each of those cards, pay 4 life or put the card on top of your library.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sl_sylvanLibrary')] }); });
clx('{T}: Add one mana of any color. When you next cast a creature spell this turn, that creature enters with two additional +1/+1 counters on it.', R => { R.mana = { colors: [...COLORS], n: 1, rider: 'slYuna' }; });
clx('Whenever another permanent you control is put into a graveyard from the battlefield, if it had one or more counters on it, you may put that number of +1/+1 counters on target creature.', R => { R.slYunaGy = true; });
clx('During your turn, ~ and enchantment creatures you control have trample, lifelink, and ward {2}.', R => { selfCond(R, { cond: 'it\'s your turn', p: 0, q: 0, kw: ['trample', 'lifelink', 'ward:2'] }); R.statics.push({ other: true, spec: { type: 'Enchantment', alsoCreature: true }, p: 0, q: 0, kw: ['trample', 'lifelink', 'ward:2'], cond: 'it\'s your turn' }); });
clx('At the beginning of your end step, return up to one target enchantment card from your graveyard to the battlefield with a finality counter on it.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('sl_yunaReturn')] }); });
clx('Equipped creature is a Shaman in addition to its other types and has "Whenever ~ attacks, you may put a creature card from your hand onto the battlefield. If that card is an enchantment card, it enters tapped and attacking."', R => { R.addType = 'Shaman'; R.trig.push({ ev: 'attacks', host: true, fn: 'sl_hostAttacks', effects: [cmd('sl_grimoire')] }); });
// Jenova (second list)
clx('At the beginning of your end step, if a permanent left the battlefield under your control this turn, put three +1/+1 counters on up to one other target artifact or creature. If it isn\'t a creature, it becomes a 0/0 Mutant creature in addition to its other types.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('sl_pizzaFace')] }); });
clx('~ has hexproof as long as they haven\'t dealt combat damage yet.', R => { R.slHexNoDmg = true; });
// Beorn
clx('Devour land 3', R => { R.slDevourLand = 3; });
clx('When ~ enters, look at the top X cards of your library, where X is ~\'s power. Put any number of land cards from among them onto the battlefield tapped, then shuffle.', R => { R.etb.push(cmd('sl_worldsire')); });
// Gogo
clx('When ~ enters, each opponent sacrifices a permanent of their choice unless they pay {1}.', R => { R.etb.push(cmd('sl_cutpurse')); });
clx('At the beginning of your upkeep, put a night counter on ~. Then if it has eight or more night counters on it, remove all of them and create eight colorless snow artifact tokens named Replicated Ring with "{T}: Add one mana of any color."', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sl_replicatingRing')] }); });
clx('Whenever you untap one or more permanents during your untap step, put that many time counters on ~.', R => { R.slCalendar = true; });
clx('{2}, {T}: Double the number of time counters on ~.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('sl_calendarDouble')]); });
clx('When there are 1,000 or more time counters on ~, sacrifice it and each opponent loses 1,000 life.', R => { R.slCalendarWin = true; });
clx('When ~ enters, you may search your library for any number of cards that have mana value 9, reveal them, put them into your hand, then shuffle.', R => { R.etb.push(cmd('sl_grozothSearch')); });
clx('{4}: ~ loses defender until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{4}', [{ t: 'pump', p: 0, q: 0, kw: ['-defender'], target: 'self', good: true }]); });
clx('At the beginning of your upkeep, create a token that\'s a copy of another target nonland permanent you control.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('sl_extravRepl')] }); });
clx('When ~ enters, tap enchanted permanent.', R => { R.etb.push(cmd('sl_tapHost')); });
clx('Enchanted permanent doesn\'t untap during its controller\'s untap step and its activated abilities can\'t be activated.', R => { R.buff = { p: 0, q: 0, kw: ['nountap'] }; R.buffBad = true; R.slNoActs = true; });
clx('Enchant creature an opponent controls', R => { R.aura = true; R.auraTarget = slTarget('creature an opponent controls'); });
clx('When ~ enters, tap enchanted creature and remove all counters from it.', R => { R.etb.push(cmd('sl_tapRemoveCounters')); });
clx('Enchanted creature loses all abilities and is a Citizen with base power and toughness 1/1 and "{T}: Add {C}" named Humble Merchant.', R => { R.buff = { p: 0, q: 0, kw: [] }; R.buffBase = { p: 1, q: 1 }; R.buffLose = true; R.buffBad = true; });
clx('When ~ enters, remove enchanted creature from combat. Then draw a card for each tapped creature its controller controls.', R => { R.etb.push(cmd('sl_observedStasis')); });
clx('Enchanted creature loses all abilities and can\'t attack or block.', R => { R.buff = { p: 0, q: 0, kw: ['cantattack', 'cantblock'] }; R.buffLose = true; R.buffBad = true; });
