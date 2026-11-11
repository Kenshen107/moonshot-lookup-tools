// Spellslinger Duels - rules pack: Grizzlegom, Hurloon Hero domain / land deck (2026-11-09, owner pasted the list).
// Wordings only; engine pieces are in 15u-grizzlegom.js (CMD ids start with gz_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text must use the reader's "~" form (this card's name and "this creature" both become "~"); "97" stands for X.

// Grizzlegom, Hurloon Hero (the Rulebreaker line only matters for deck building: see landsAnyCommander in 04-views-decks.js)
cl(/^A deck with this commander can have any land cards\.$/, R => { R.landsAny = true; });
clx('Whenever ~ attacks, create a 1/1 white Soldier creature token for each Plains you control. Draw a card for each Island you control. Each opponent loses 1 life for each Swamp you control. Put a +1/+1 counter on ~ for each Mountain you control. You gain 1 life for each Forest you control.', R => { R.trig.push({ ev: 'attacks', effects: [cmd('gz_grizzlegom')] }); });
// Branching Timeline
clx('Reveal the top X cards of your library, where X is the number of differently named lands you control. Put all permanent cards revealed this way onto the battlefield tapped and the rest on the bottom of your library in a random order.', R => { R.spell = [cmd('gz_timeline')]; });
// Elemental Teachings
clx('Search your library for up to four land cards with different names and reveal them. An opponent chooses two of those cards. Put the chosen cards into your graveyard and the rest onto the battlefield tapped, then shuffle.', R => { R.spell = [cmd('gz_teachings')]; });
// Escape to the Wilds (its extra land line is read elsewhere)
clx('Exile the top five cards of your library. You may play cards exiled this way until the end of your next turn.', R => { (R.spell = R.spell || []).push(cmd('gz_escape')); });
// Fblthp, Knows the Way
cl(/^~'s power is equal to the number of basic land types among lands you control\.$/, R => { R.cdaSet = { p: 'basic land types among lands you control' }; });
cl(/^When ~ enters, search your library for up to 97 basic land cards with different names, reveal them, put them into your hand, then shuffle\.$/, R => { R.etb.push(cmd('gz_fblthp', { x: 97 })); });
// Lavaspur Boots
clx('Equipped creature gets +1/+0 and has haste and ward {1}.', R => { R.buff = { p: 1, q: 0, kw: ['haste', 'ward:1'] }; });
// Stable Wormhole
clx('Whenever you attack, create a tapped Planet land token named New Planet with "{T}: Add one mana of any color."', R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', effects: [cmd('gz_planet')] }); });
// Summer Bloom
clx('You may play up to three additional lands this turn.', R => { R.spell = [cmd('gz_summer')]; });
// The Weatherseed Treaty, chapter III
cl(/^III — Target creature you control gets \+X\/\+X and gains trample until end of turn, where X is the number of basic land types among lands you control\.$/, R => { R.saga = R.saga || {}; (R.saga[3] = R.saga[3] || []).push(cmd('gz_weatherseed', { target: 'creature', mine: true, good: true })); });
// Through the Forest Gate
clx('Look at the top twenty cards of your library, put any number of land cards from among them onto the battlefield tapped, then shuffle. You gain 8 life.', R => { R.spell = [cmd('gz_forestGate')]; });
// Tromp the Domains
clx('Until end of turn, creatures you control gain trample and get +1/+1 for each basic land type among lands you control.', R => { R.spell = [cmd('gz_tromp')]; });
// U.S.S. Voyager, Lone Wanderer
clx('When ~ enters, reveal cards from the top of your library until you reveal two land cards. Put those land cards onto the battlefield tapped and the rest on the bottom of your library in a random order.', R => { R.etb.push(cmd('gz_voyager')); });
// Full Throttle (printed as Charge of Eternia in the Secret Lair): two more combats, creatures that attacked untap at each combat
cl(/^After this main phase, there are two additional combat phases\.$/, R => { (R.spell = R.spell || []).push(cmd('gz_throttle')); });
cl(/^At the beginning of each combat this turn, untap all creatures that attacked this turn\.$/, R => { });
// Aggravated Assault (2026-11-11, extra combat fix): {3}{R}{R}: untap all creatures you control, then an additional combat phase and main phase (sorcery speed)
clx('{3}{R}{R}: Untap all creatures you control. After this main phase, there is an additional combat phase followed by an additional main phase. Activate only as a sorcery.', (R, m, ctx) => { const a = parseActivated('{3}{R}{R}: Draw a card. Activate only as a sorcery.', R); a.effects = [cmd('extraCombatUntap')]; a.text = ctx.line; R.acts.push(a); });
