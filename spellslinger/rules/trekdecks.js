// Spellslinger Duels - rules pack: the four official Star Trek Commander decks (2026-10-30, owner posted Wizards' decklists:
// Federation Fleet, Landing Party, Klingon Fury, We Are the Borg). Wordings only; engine pieces are in 15p-trekdecks.js (CMD ids start with td_).
// Uses the cl / clx / cmd / act / SPEC / selfCond helpers from rules/cmdr.js. Lines are matched whole; "Seek out — " style ability words are stripped by the reader.
// Statement of approximations is in the header of 15p-trekdecks.js.

const TDR = []; // [regex, effect] single-sentence readings (joined into the pack below)
const tdRW = (re, id, fx) => { CMD_REWRITES.push([new RegExp(re.source, 'g'), `§${id}.`]); TDR.push([new RegExp(`^§${id}$`), () => fx]); };
const TD_SEEK = { ev: 'draw', who: 'you', nth: 2 };

// ================= Federation Fleet =================
// Captain Janeway, Endgame
clx('Whenever one or more Officers you control deal combat damage to a player, you draw a card and create a 1/1 red Officer creature token.', R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, type: 'Officer', effects: [cmd('td_janewayHit')] }); });
clx('{2}, Tap an untapped creature you control: Captain Janeway can\'t be blocked this turn.', (R, m, ctx) => { act(R, ctx.line, '{2}', [cmd('td_tapUnblockable')], a => { a.onlyIf = 'you control an untapped creature'; }); });
// Ambassador K'Ehleyr
clx('At the beginning of combat on your turn, each player reveals the top card of their library, then draws a card. For each nonland card revealed this way, put a +1/+1 counter on ~.', R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('td_parley')] }); });
// Ensign Harry Kim, Operations
clx('Whenever another creature you control enters, if it has greater power than ~ Kim, put a +1/+1 counter on ~ Kim.', R => { R.trig.push(SPEC('enters', { another: true, ctl: 'you', type: 'Creature' }, { effects: [cmd('td_kimGrow')] })); });
clx('{2}, Remove two +1/+1 counters from among creatures you control: Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{2}', [cmd('td_removeCountersDraw')], a => { a.onlyIf = 'you control creatures with two or more +1/+1 counters among them'; }); });
// Ezri Dax, Newly Joined
clx('You may have ~ enter as a copy of any creature card in your graveyard that was put there from the battlefield this turn, except her name is ~ and she\'s a legendary Trill in addition to her other types.', R => { R.clone = { gy: 'diedThisTurn', keepName: 'Ezri Dax, Newly Joined', makeLegendary: true, addSub: 'Trill' }; });
// Julian Bashir, Frontier Doctor
clx('Whenever you draw your second card each turn, put a +1/+1 counter on Julian Bashir.', R => { R.trig.push({ ...TD_SEEK, effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
clx('Whenever ~ attacks, return target creature card with mana value X or less from your graveyard to the battlefield, where X is ~\'s power.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_bashir')] }); });
// Chief Miles O'Brien
clx('Whenever you draw your second card each turn, double the number of each kind of counter on target artifact or creature you control.', R => { R.trig.push({ ...TD_SEEK, effects: [{ t: 'cmd', id: 'td_doubleCounters', target: 'perm', filter: 'artifact or creature', mine: true, good: true }] }); });
// Geordi La Forge, Innovator
clx('~ can\'t be blocked if you control a Spacecraft.', R => { selfCond(R, { cond: 'you control a Spacecraft', p: 0, q: 0, kw: ['unblockable'] }); });
// Kes, Evolving Telepath
clx('At the beginning of your end step, put a time counter on ~, then draw X cards, where X is the number of time counters on it. Then if she has nine or more time counters on her, sacrifice her.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('td_kes')] }); });
// Seven of Nine, Tertiary Adjunct
clx('That Is Irrelevant — {T}: Draw a card, then discard a card. When you discard a nonland card this way, put two charge counters on up to one target artifact.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_sevenLoot')]); });
clx('{T}: Draw a card, then discard a card. When you discard a nonland card this way, put two charge counters on up to one target artifact.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_sevenLoot')]); });
// Tuvok, Chief Tactical Officer
clx('When ~ enters during the declare attackers step, choose up to two target attacking creatures. For each of them, you may reselect which player or permanent that creature is attacking.', R => { R.etb.push(cmd('td_tuvok')); });
clx('When Tuvok enters during the declare attackers step, choose up to two target attacking creatures. For each of them, you may reselect which player or permanent that creature is attacking.', R => { R.etb.push(cmd('td_tuvok')); });
// Rom and Leeta, Unlikely Pair
clx('Whenever you draw your second card each turn, create two tapped Treasure tokens.', R => { R.trig.push({ ...TD_SEEK, effects: [cmd('td_tappedTreasures', { n: 2 })] }); });
// B'Elanna Torres, Scrapper
clx('{2}, {T}: Surveil 2, then you may reveal the top card of your library. Draw a card if it\'s an artifact card. If you don\'t draw a card this way, put two +1/+1 counters on ~.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('td_belanna')]); });
// Cmdr. Troi, Outgoing Empath
clx('{T}: Target opponent whose turn it is may cast a spell from their hand without paying its mana cost. If they do, you copy that spell. You may choose new targets for the copy. If they don\'t, you draw a card.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_troi')], a => { a.onlyIf = 'it is an opponent\'s turn'; }); });
// Reg Barclay, Fidgety Fantasist
clx('Whenever you draw your second card each turn, create a token that\'s a copy of another target creature you control, except it isn\'t legendary, it\'s an Illusion artifact in addition to its other types, and it has haste. Exile that token at the beginning of the next end step.', R => { R.trig.push({ ...TD_SEEK, effects: [{ t: 'cmd', id: 'td_barclay', target: 'creature', mine: true, notSelf: true, good: true }] }); });
// Unification (saga)
cl(/^I — The owner of up to one target creature draws two cards, then shuffles that creature into their library\.$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push({ t: 'cmd', id: 'td_unification1', target: 'creature', optional: true, good: false }); });
cl(/^II — You may put a Spacecraft card from your hand or graveyard onto the battlefield\.$/, R => { R.saga = R.saga || {}; (R.saga[2] = R.saga[2] || []).push(cmd('td_unification2')); });
cl(/^III — You and target opponent each draw two cards\.$/, R => { R.saga = R.saga || {}; (R.saga[3] = R.saga[3] || []).push({ t: 'cmd', id: 'td_unification3', target: 'player', oppOnly: true }); });
// U.S.S. Enterprise-C, Time-Tossed
clx('When ~ enters or dies, you may discard your hand. If you do, draw a card for each card discarded this way.', R => { R.etb.push(cmd('td_discardHandDraw')); R.trig.push({ ev: 'dies', effects: [cmd('td_discardHandDraw')] }); });
// U.S.S. Prometheus, Prototype
cl(/^8\+ \| Multivector Assault Mode — Whenever ~ deals combat damage to an opponent, it deals that much damage to each other opponent\.$/, R => { R.stationTiers = (R.stationTiers || []).concat(8); R.trig.push({ ev: 'hitPlayer', cond: 'it has 8 or more charge counters on it', effects: [cmd('td_multivector')] }); });
// U.S.S. Stargazer, Here and There
clx('Picard Maneuver — Whenever U.S.S. Stargazer attacks, create a tapped and attacking 4/3 colorless Spacecraft Illusion artifact creature token with flying. Exile that token at end of combat.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_stargazer')] }); });
clx('Whenever ~ attacks, create a tapped and attacking 4/3 colorless Spacecraft Illusion artifact creature token with flying. Exile that token at end of combat.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_stargazer')] }); });
// Fevered Visions
clx('At the beginning of each player\'s end step, that player draws a card. If the player is your opponent and has four or more cards in hand, ~ deals 2 damage to that player.', R => { R.trig.push({ ev: 'end', who: 'any', effects: [cmd('td_fevered')] }); });
tdRW(/Exile two target permanents you control\. Return those cards to the battlefield under their owner's control at the beginning of the next end step\./, 'tdTribulation', cmd('td_tribulation'));
// Fractured Identity / Chronomantic Escape / Stonespeaker Crystal
tdRW(/Exile target nonland permanent\. Each player other than its controller creates a token that's a copy of it\./, 'tdFractured', { t: 'cmd', id: 'td_fractured', target: 'perm', filter: 'nonland permanent', good: false });
tdRW(/Until your next turn, creatures can't attack you\. Exile ~ with three time counters on it\./, 'tdChrono', cmd('td_chrono'));
clx('{2}, {T}, Sacrifice ~: Exile any number of target players\' graveyards. Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Sacrifice ~', [cmd('td_stonespeaker')]); });
clx('{2}, {T}, Sacrifice Stonespeaker Crystal: Exile any number of target players\' graveyards. Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Sacrifice ~', [cmd('td_stonespeaker')]); });

// ================= Klingon Fury =================
const TD_YOUATK = { ev: 'attacks', fn: 'youAttack' };
const TD_KW = { sub: ['Klingon', 'Warrior'], ctl: 'you' };
// Kor, Cause of Vengeance
clx('Whenever you attack, you may sacrifice another creature. If you do, draw a card, then Klingons and Warriors you control get +2/+2 until end of turn.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_kor')] }); });
// Indelicate Healer
clx('Whenever ~ or another Klingon or Warrior you control enters, creatures you control gain lifelink until end of turn.', R => { R.trig.push(SPEC('enters', TD_KW, { effects: [cmd('td_lifelinkAll')] })); });
// Korok, Liberated Rage
clx('Battlefront — Whenever ~ attacks, creatures you control get +X/+X until end of turn, where X is the number of opponents you attacked this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_korok')] }); });
clx('Whenever ~ attacks, creatures you control get +X/+X until end of turn, where X is the number of opponents you attacked this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_korok')] }); });
// Martok, Hero of the Empire
clx('Whenever you attack, put a +1/+1 counter on each of up to X target creatures you control, where X is the number of opponents you attacked this turn.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_martok')] }); });
// Merciful Mandate / Right of Vengeance
tdRW(/Untap all creatures you control\. If it's a combat phase, you may end the combat phase\. \(Remove all attackers and blockers from combat\. Exile all spells and abilities from the stack, including this spell\.\)/, 'tdMandate', cmd('td_mandate'));
tdRW(/Untap all creatures you control\. If it's a combat phase, you may end the combat phase\./, 'tdMandate2', cmd('td_mandate'));
tdRW(/Until end of turn, whenever a creature deals combat damage to you, destroy that creature and create a 2\/1 red Klingon Warrior creature token with haste\./, 'tdVengeance', cmd('td_vengeance'));
// Blood-Sport Champion
clx('When ~ enters, if it was kicked, other creatures you control gain deathtouch until end of turn.', R => { R.etb.push({ ...cmd('td_deathtouchAll'), kicked: true }); });
// Kurn, Son of Mogh
clx('Battlefront — Whenever ~ attacks, you draw X cards and lose X life, where X is the number of opponents you attacked this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_kurn')] }); });
clx('Whenever ~ attacks, you draw X cards and lose X life, where X is the number of opponents you attacked this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_kurn')] }); });
// The Promise of Kahless
tdRW(/You may sacrifice a Klingon or Warrior\. If you do, return all other Klingon and Warrior creature cards from your graveyard to the battlefield\./, 'tdPromise', cmd('td_promise'));
// Voq, Torchbearer
clx('You may have ~ enter as a copy of a creature card in a graveyard, except he\'s a Klingon Spy in addition to his other types and has menace.', R => { R.clone = { gy: 'any', addSub: 'Klingon Spy', addKw: 'Menace' }; });
// The Beacon of Kahless
clx('Battlefront — {T}: Choose a color. Add an amount of mana of that color equal to the number of opponents you attacked this turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_beacon')], a => { a.manaLike = true; }); });
clx('{T}: Choose a color. Add an amount of mana of that color equal to the number of opponents you attacked this turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_beacon')], a => { a.manaLike = true; }); });
// Gagh Slinger
clx('Klingon spells and Warrior spells you cast cost {1} less to cast.', R => { R.reducer = { what: '(?:Klingon|Warrior)', n: 1 }; });
clx('Whenever another Klingon or Warrior you control enters, ~ deals 1 damage to each opponent.', R => { R.trig.push(SPEC('enters', { ...TD_KW, another: true }, { effects: [{ t: 'dmg', n: 1, target: 'opponents' }] })); });
// Galvanizing Tenor
clx('Battlefront — Whenever this creature attacks, goad up to X target creatures, where X is the number of opponents you attacked this turn. (Until your next turn, those creatures attack each combat if able and attack a player other than you if able.)', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_tenor')] }); });
clx('Whenever ~ attacks, goad up to X target creatures, where X is the number of opponents you attacked this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_tenor')] }); });
// Glory to the Empire!
clx('When ~ enters, create a number of 2/1 red Klingon Warrior creature tokens with haste equal to the number of opponents you have.', R => { R.etb.push(cmd('td_gloryTokens')); });
clx('Creatures you control have melee.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_melee')] }); });
// Gnarling Targ
clx('Whenever you attack, Klingons and Warriors you control get +2/+0 and gain trample until end of turn.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_targ')] }); });
// Grilka, Widowed Warrior
clx('When ~ enters, gain control of target creature an opponent controls until end of turn. Untap it. Until end of turn, it gains trample, haste, and "Whenever ~ deals combat damage to a player, create that many tapped Treasure tokens."', R => { R.etb.push({ t: 'cmd', id: 'td_grilka', target: 'creature', theirs: true, good: false }); });
// Kang, Suspicious Captain
clx('When ~ enters, choose target creature an opponent controls. ~ and that creature are goaded for as long as you control ~.', R => { R.etb.push({ t: 'cmd', id: 'td_kangEtb', target: 'creature', theirs: true, good: false }); });
clx('Whenever one or more goaded creatures attack, put a +1/+1 counter on target creature you control.', R => { R.trig.push({ ev: 'attacks', fn: 'goadedAttacks', effects: [{ t: 'counters', n: 1, target: 'creature', good: true }] }); });
// Own the Day / World at War
clx('Battlefront — This spell costs {1} less to cast for each opponent you attacked this turn.', R => { R.costLess = { n: 1, what: 'the number of opponents you attacked this turn' }; });
clx('~ costs {1} less to cast for each opponent you attacked this turn.', R => { R.costLess = { n: 1, what: 'the number of opponents you attacked this turn' }; });
tdRW(/After the second main phase this turn, there's an additional combat phase followed by an additional main phase\. At the beginning of that combat, untap all creatures that attacked this turn\./, 'tdWorld', cmd('td_extraCombat'));
// Qo'noS Quartermaster
clx('Whenever ~ attacks, add one mana of any color. Until end of turn, you don\'t lose this mana as steps and phases end.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_quartermaster')] }); });
// Alexander, Ship's Fool
clx('{T}: Each player reveals the top card of their library, then draws a card. ~ deals X damage to a random opponent, where X is the greatest mana value among cards revealed this way.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_alexander')]); });
// Curzon Dax, Bound by Blood
clx('Whenever another Klingon or Warrior you control dies, ~ deals 1 damage to each opponent.', R => { R.trig.push(SPEC('dies', { ...TD_KW, another: true }, { effects: [{ t: 'dmg', n: 1, target: 'opponents' }] })); });
clx('When ~ dies, you may put a creature card with mana value 3 or less from your hand onto the battlefield.', R => { R.trig.push({ ev: 'dies', effects: [cmd('td_curzonDies')] }); });
// Rite of Ascension
clx('Battlefront — Whenever you attack, for each opponent you attacked this turn, create a tapped and attacking 2/1 red Klingon Warrior creature token with haste.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_riteAscension')] }); });
clx('Whenever you attack, for each opponent you attacked this turn, create a tapped and attacking 2/1 red Klingon Warrior creature token with haste.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_riteAscension')] }); });
// Sins of the Father (chapter I is read by trek.js)
cl(/^II — For each opponent, you create a 2\/1 red Klingon Warrior creature token with haste\.$/, R => { R.saga = R.saga || {}; (R.saga[2] = R.saga[2] || []).push(cmd('td_gloryTokens')); });
cl(/^III — Exile target player's graveyard\. Each opponent loses life equal to the number of creature cards exiled this way\.$/, R => { R.saga = R.saga || {}; (R.saga[3] = R.saga[3] || []).push({ t: 'cmd', id: 'td_sinsIII', target: 'player' }); });
// K't'inga-Class Battle Cruiser / K'Vort-Class Raider
clx('Whenever ~ enters or attacks, one or two target Klingons and/or Warriors you control gain flying until end of turn.', R => { R.etb.push(cmd('td_ktinga')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_ktinga')] }); });
clx('During your turn, ~ and creatures you control have hexproof.', R => { selfCond(R, { cond: 'it is your turn', p: 0, q: 0, kw: ['hexproof'] }); R.statics.push({ type: null, p: 0, q: 0, kw: ['hexproof'], cond: 'it is your turn' }); });
// Concerted Effort / Duelist's Heritage / Shared Animosity
clx('At the beginning of each upkeep, creatures you control gain flying until end of turn if a creature you control has flying. The same is true for fear, first strike, double strike, landwalk, protection, trample, and vigilance.', R => { R.trig.push({ ev: 'upkeep', who: 'any', effects: [cmd('td_concerted')] }); });
clx('Whenever one or more creatures attack, you may have target attacking creature gain double strike until end of turn.', R => { R.trig.push({ ev: 'attacks', fn: 'anyAttack', effects: [cmd('td_duelist')] }); });
clx('Whenever a creature you control attacks, it gets +1/+0 until end of turn for each other attacking creature that shares a creature type with it.', R => { R.trig.push({ ...TD_YOUATK, effects: [cmd('td_sharedAnimosity')] }); });
// Painful Truths (converge)
tdRW(/You draw X cards and lose X life, where X is the number of colors of mana spent to cast ~\./, 'tdConverge', cmd('td_painful'));
// Pest Control / Sword of Light and Shadow / Return to Dust / Rite of Oblivion
tdRW(/Destroy all nonland permanents with mana value 1 or less\./, 'tdPest', cmd('td_pest'));
clx('Equipped creature gets +2/+2 and has protection from white and from black.', R => { R.buff = { p: 2, q: 2, kw: ['pro:W', 'pro:B'] }; });
clx('Whenever equipped creature deals combat damage to a player, you gain 3 life and you may return up to one target creature card from your graveyard to your hand.', R => { R.trig.push({ ev: 'hitPlayer', host: true, effects: [{ t: 'gain', n: 3 }, cmd('td_swordLS')] }); });
tdRW(/Exile target artifact or enchantment\. If you cast ~ during your main phase, you may exile up to one other target artifact or enchantment\./, 'tdReturnDust', { t: 'cmd', id: 'td_returnToDust', target: 'perm', filter: 'artifact or enchantment', good: false });
clx('As an additional cost to cast ~, sacrifice a nonland permanent.', R => { R.addCost = { sac: 'nonland permanent' }; });

// ================= Landing Party =================
// Balance of Terror (saga)
cl(/^I — Destroy up to one other target artifact or enchantment\.$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push({ t: 'cmd', id: 'td_balanceDestroy', target: 'perm', filter: 'artifact or enchantment', optional: true, good: false }); });
cl(/^II, III — Exile up to one other target permanent you control\. Return that card to the battlefield under its owner's control at the beginning of the next end step\.$/, R => { R.saga = R.saga || {}; [2, 3].forEach(k => (R.saga[k] = R.saga[k] || []).push(cmd('td_blinkOwn', { n: 1 }))); });
// Shuttlecraft Galileo
clx('Landfall — Whenever a land you control enters, create a 1/1 red Officer creature token.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [OFFICER(1)] })); });
clx('Whenever a land you control enters, create a 1/1 red Officer creature token.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [OFFICER(1)] })); });
clx('Whenever ~ attacks, up to seven target attacking creatures gain flying until end of turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', cond: TK_COND(6), effects: [cmd('td_galileo')] }); });
// Tribble Cluster
clx('At the beginning of combat on your turn, put a +1/+1 counter on ~.', R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
clx('When ~ dies, create X 1/1 white Tribble creature tokens with "~ can\'t block," where X is ~\'s power.', R => { R.trig.push({ ev: 'dies', effects: [cmd('td_tribbles')] }); });
// Colossal Clone Master
clx('Strange new worlds — You may have ~ enter as a copy of any creature on the battlefield, except it isn\'t legendary and it has "~\'s power and toughness are each equal to the number of differently named lands you control."', R => { R.clone = { what: 'creature', notLegendary: true, addText: () => '~\'s power and toughness are each equal to the number of differently named lands you control.' }; });
clx('You may have ~ enter as a copy of any creature on the battlefield, except it isn\'t legendary and it has "~\'s power and toughness are each equal to the number of differently named lands you control."', R => { R.clone = { what: 'creature', notLegendary: true, addText: () => '~\'s power and toughness are each equal to the number of differently named lands you control.' }; });
// Fleet Captain Christopher Pike
clx('Yes — {1}, {T}: Untap two other target creatures.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('td_pikeYes')]); });
clx('No — {2}, {T}: Tap two other target creatures.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('td_pikeNo')]); });
clx('{1}, {T}: Untap two other target creatures.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('td_pikeYes')]); });
clx('{2}, {T}: Tap two other target creatures.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('td_pikeNo')]); });
// Giant Space Amoeba
clx('Whenever ~ attacks, target creature defending player controls gets -3/-0 until end of turn, then create a token that\'s a copy of ~.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_amoeba')] }); });
// Lieutenant Nyota Uhura
clx('{4}, {T}: Target opponent exiles the top X cards of their library, where X is the number of differently named lands you control. You may cast an instant or sorcery spell from among them without paying its mana cost. Then that player puts the rest on the bottom of their library in a random order.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [cmd('td_uhura')]); });
// Amanda Grayson, Logic's Link
clx('Affinity for Vulcans', R => { R.affinityOf = 'Vulcan'; });
cl(/^Affinity for Vulcans(?: \(.*\))?$/, R => { R.affinityOf = 'Vulcan'; });
clx('Landfall — Whenever a land you control enters, put two +1/+1 counters on target creature you control.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [{ t: 'counters', n: 2, target: 'creature', good: true }] })); });
clx('Whenever a land you control enters, put two +1/+1 counters on target creature you control.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [{ t: 'counters', n: 2, target: 'creature', good: true }] })); });
// Janice Rand, Essential Aide
clx('Whenever a commander you control enters or attacks, put a +1/+1 counter on it, then reveal cards from the top of your library until you reveal a land card. Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order.', R => { R.trig.push(SPEC('enters', { commander: true }, { effects: [cmd('td_rand')] })); R.trig.push({ ev: 'attacks', fn: 'cmdrAttacks', effects: [cmd('td_rand')] }); });
// Lieutenant Hikaru Sulu
clx('Whenever ~ Sulu becomes tapped, he explores.', R => { R.trig.push({ ev: 'tapped', effects: [cmd('td_explore')] }); });
clx('Whenever Lieutenant Sulu becomes tapped, he explores.', R => { R.trig.push({ ev: 'tapped', effects: [cmd('td_explore')] }); });
clx('{2}{U}: Target creature can\'t be blocked this turn.', (R, m, ctx) => { act(R, ctx.line, '{2}{U}', [{ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', good: true }]); });
// Chief Kyle, Transporter Tech
clx('Landfall — Whenever a land you control enters, exile up to one other target creature you control. Return that card to the battlefield under its owner\'s control at the beginning of the next end step.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('td_blinkOwn', { n: 1, creature: true })] })); });
clx('Whenever a land you control enters, exile up to one other target creature you control. Return that card to the battlefield under its owner\'s control at the beginning of the next end step.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('td_blinkOwn', { n: 1, creature: true })] })); });
// Chief Montgomery Scott
clx('Strange new worlds — {6}, {T}: You may put a creature or Spacecraft card from your hand onto the battlefield. It enters with X additional +1/+1 counters on it if it\'s a creature and X additional charge counters on it if it\'s a Spacecraft, where X is the number of differently named lands you control.', (R, m, ctx) => { act(R, ctx.line, '{6}, {T}', [cmd('td_scott')]); });
clx('{6}, {T}: You may put a creature or Spacecraft card from your hand onto the battlefield. It enters with X additional +1/+1 counters on it if it\'s a creature and X additional charge counters on it if it\'s a Spacecraft, where X is the number of differently named lands you control.', (R, m, ctx) => { act(R, ctx.line, '{6}, {T}', [cmd('td_scott')]); });
// Lt. Arex, Ever-Adapting
clx('When ~ enters, draw three cards. You may put up to three land cards from your hand onto the battlefield tapped.', R => { R.etb.push(cmd('td_arex')); });
// McCoy, Not a Bricklayer
clx('Whenever ~ or another Doctor you control enters, put a +1/+1 counter on each creature you control.', R => { R.trig.push(SPEC('enters', { sub: 'Doctor', ctl: 'you' }, { effects: [cmd('td_counterAll')] })); });
clx('Creatures you control with counters on them have lifelink.', R => { R.statics.push({ type: null, p: 0, q: 0, kw: ['lifelink'], fn: 'hasCounters' }); });
// Pavel Chekov, First Posting
clx('If you would draw a card, you may instead choose land or nonland and reveal cards from the top of your library until you reveal a card of the chosen kind. Put that card into your hand and put all other cards revealed this way on the bottom of your library in a random order.', R => { R.chekovDraw = true; });
// T'Pring, Never Parted
clx('Kal-if-fee — When ~ enters, choose another target creature you control and target creature an opponent controls. You may have the chosen creatures fight each other. Whenever a creature that fought this way dies this turn, you draw a card.', R => { R.etb.push(cmd('td_tpring')); });
clx('When ~ enters, choose another target creature you control and target creature an opponent controls. You may have the chosen creatures fight each other. Whenever a creature that fought this way dies this turn, you draw a card.', R => { R.etb.push(cmd('td_tpring')); });
// The Guardian of Forever
clx('{4}, Sacrifice another nontoken creature: Return that card to the battlefield under its owner\'s control at the beginning of the next end step.', (R, m, ctx) => { act(R, ctx.line, '{4}', [cmd('td_guardian')], a => { a.onlyIf = 'you control another nontoken creature'; }); });
// Jefferies Tube
clx('{2}, {T}: Put two charge counters on target artifact.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'cmd', id: 'td_chargeArtifact', target: 'perm', filter: 'artifact', good: true }]); });
clx('{3}, {T}: Target creature you control can\'t be blocked this turn.', (R, m, ctx) => { act(R, ctx.line, '{3}, {T}', [{ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', mine: true, good: true }]); });
clx('{4}, {T}: Draw a card. You may put a land card from your hand onto the battlefield tapped.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [{ t: 'draw', n: 1 }, cmd('td_putLands', { n: 1 })]); });
// Planet Killer
clx('Whenever ~ deals combat damage to a player, put a +1/+1 counter on it for each land that player controls.', R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('td_planetKiller')] }); });
// S.S. Botany Bay
clx('{T}: Each opponent exiles a card from their graveyard. You may exile a card from your graveyard.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_botanyBay')]); });
cl(/^8\+ \| Flying$/, R => { R.stationTiers = (R.stationTiers || []).concat(8); selfCond(R, { cond: TK_COND(8), p: 0, q: 0, kw: ['flying'] }); });
clx('Whenever ~ deals combat damage to a player, return each creature card you own exiled with it to the battlefield.', R => { R.trig.push({ ev: 'hitPlayer', cond: TK_COND(8), effects: [cmd('td_botanyReturn')] }); });
// U.S.S. Defiant, Mirror Migrant
clx('When ~ enters, it and up to one target creature you control phase out.', R => { R.etb.push(cmd('td_defiant')); });
// U.S.S. Farragut, Bold Explorer
clx('Landfall — Whenever a land you control enters, you may put a creature card from your hand onto the battlefield. That creature gains haste. At the beginning of the next end step, put it on the bottom of your library. When you do, draw a card.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('td_farragut')] })); });
clx('Whenever a land you control enters, you may put a creature card from your hand onto the battlefield. That creature gains haste. At the beginning of the next end step, put it on the bottom of your library. When you do, draw a card.', R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('td_farragut')] })); });
// Shore Leave Planet
clx('{4}{U}: ~ becomes a copy of target creature you control until end of turn, except it isn\'t legendary and it\'s a Robot artifact in addition to its other types.', (R, m, ctx) => { act(R, ctx.line, '{4}{U}', [{ t: 'cmd', id: 'td_shoreLeave', target: 'creature', mine: true, good: true }]); });
// Echo of Eons
tdRW(/Each player shuffles their hand and graveyard into their library, then draws seven cards\./, 'tdEcho', cmd('td_echo'));
// Ancient Greenwarden
clx('You may play lands from your graveyard.', R => { R.landsFromGy = true; });
clx('If a land entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.', R => { R.greenwarden = true; });
// Augur of Autumn
clx('You may look at the top card of your library any time.', R => { R.lookTop = true; });
clx('You may play lands from the top of your library.', R => { R.landsFromTop = true; });
clx('Coven — As long as you control three or more creatures with different powers, you may cast creature spells from the top of your library.', R => { R.castTopCreatures = { when: o => tdCoven(G.players[o.owner]) }; });
clx('As long as you control three or more creatures with different powers, you may cast creature spells from the top of your library.', R => { R.castTopCreatures = { when: o => tdCoven(G.players[o.owner]) }; });
// Satyr Wayfinder
clx('When ~ enters, reveal the top four cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard.', R => { R.etb.push(cmd('td_wayfinder')); });

// ================= We Are the Borg =================
const TD_ARTBORG = n => ({ t: 'token', n, p: 1, q: 1, name: 'colorless Borg', kw: [], artifact: true });
tdRW(/Create two 1\/1 colorless Borg artifact creature tokens, then artifact creatures you control gain protection from the color of your choice until end of turn\./, 'tdIncursion', cmd('td_incursion'));
tdRW(/Artifacts you control gain hexproof and indestructible until end of turn\./, 'tdRegen', cmd('td_regen'));
clx('When ~ dies, create X 1/1 colorless Borg artifact creature tokens, where X is its power.', R => { R.trig.push({ ev: 'dies', effects: [cmd('td_stratagem')] }); });
clx('Artifact creatures you control have "Whenever ~ deals combat damage to a player, put a +1/+1 counter on it."', R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, only: 'artifact', effects: [cmd('td_grow')] }); });
clx('Artifact creatures you control have "{T}: Add {C}. Spend this mana only to cast an artifact spell or activate an ability of an artifact source."', R => { R.reactor = true; });
clx('Artifact creatures you control have "Whenever ~ deals combat damage to a player, draw a card."', R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, only: 'artifact', effects: [{ t: 'draw', n: 1 }] }); });
tdRW(/Each opponent reveals cards from the top of their library until they reveal a creature card\. Assimilate one of the creature cards revealed this way\. Then each opponent puts the other cards they revealed this way on the bottom of their library in a random order\./, 'tdGift', cmd('td_gift'));
clx('If one or more charge counters would be put on an artifact you control, that many plus one charge counters are put on it instead.', R => { R.annex = true; });
clx('When ~ enters, mill five cards. You may put up to two artifact cards from among them into your hand.', R => { R.etb.push(cmd('td_transwarp')); });
cl(/^3\+ \| \{T\}: Target creature can't be blocked this turn\.$/, (R, m, ctx) => { R.stationTiers = (R.stationTiers || []).concat(3); act(R, ctx.line, '{T}', [{ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', good: true }], a => { a.onlyIf = TK_COND(3); }); });
clx('When Võx enters and at the beginning of your first main phase, the next artifact creature spell and the next Spacecraft spell you cast this turn have undaunted.', R => { R.etb.push(cmd('td_vox')); R.trig.push({ ev: 'main1', effects: [cmd('td_vox')] }); });
clx('When ~ enters and at the beginning of your first main phase, the next artifact creature spell and the next Spacecraft spell you cast this turn have undaunted.', R => { R.etb.push(cmd('td_vox')); R.trig.push({ ev: 'main1', effects: [cmd('td_vox')] }); });
tdRW(/For each opponent, assimilate up to one target creature card from that player's graveyard that was put there from the battlefield this turn\./, 'tdWounded', cmd('td_wounded'));
clx('When ~ enters, exile target opponent\'s graveyard.', R => { R.etb.push(cmd('td_assessorEtb')); });
clx('Whenever ~ attacks, assimilate a creature card exiled with it.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('td_assessorAttack')] }); });
tdRW(/All nonartifact creatures get -X\/-X until end of turn, where X is the number of artifact creatures you control\./, 'tdWolf', cmd('td_wolf359'));
clx('Artifact creatures you control have menace and "Whenever a creature blocks ~, that creature gets -1/-1 until end of turn."', R => { R.statics.push({ type: 'Artifact', p: 0, q: 0, kw: ['menace'] }); R.trig.push({ ev: 'blocks', fn: 'anyBlocks', effects: [cmd('td_integrant')] }); });
clx('{1}, Sacrifice an artifact creature: Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('td_reclaim')], a => { a.onlyIf = 'you control an artifact creature'; }); });
cl(/^I — Assimilate target nonartifact creature an opponent controls\. \(Gain control of it and put a \+1\/\+1 counter on it\. It's a Borg artifact creature and loses all other creature types\.\)$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push({ t: 'cmd', id: 'td_bobw1', target: 'creature', theirs: true, good: false }); });
cl(/^I — Assimilate target nonartifact creature an opponent controls\.$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push({ t: 'cmd', id: 'td_bobw1', target: 'creature', theirs: true, good: false }); });
cl(/^II — Artifact creatures you control get \+2\/\+2 until end of turn\.$/, R => { R.saga = R.saga || {}; (R.saga[2] = R.saga[2] || []).push(cmd('td_bobw2')); });
cl(/^III — Exile the Borg assimilated with ~, then return it to the battlefield under its owner's control\.$/, R => { R.saga = R.saga || {}; (R.saga[3] = R.saga[3] || []).push(cmd('td_bobw3')); });
tdRW(/Exile target artifact or creature\. Create X 1\/1 colorless Borg artifact creature tokens, where X is that permanent's mana value\./, 'tdDeliver', { t: 'cmd', id: 'td_deliver', target: 'perm', filter: 'artifact or creature', good: false });
clx('Artifact spells you cast have replicate {2}{U}. (Whenever you cast an artifact spell, copy it for each time you paid its replicate cost. Each copy becomes a token.)', R => { R.trig.push({ ev: 'cast', filter: 'types:Artifact', effects: [cmd('td_replicate')] }); });
clx('Artifact spells you cast have replicate {2}{U}.', R => { R.trig.push({ ev: 'cast', filter: 'types:Artifact', effects: [cmd('td_replicate')] }); });
clx('Whenever one or more artifact creatures you control deal combat damage to a player, create a token that\'s a copy of target artifact token you control.', R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, only: 'artifact', effects: [cmd('td_jurati')] }); });
clx('Artifact creatures you control have flying, double strike, vigilance, menace, lifelink, and ward {2}.', R => { R.statics.push({ type: 'Artifact', p: 0, q: 0, kw: ['flying', 'double strike', 'vigilance', 'menace', 'lifelink', 'ward:2'] }); });
clx('{T}: Choose a color. Add one mana of that color for each charge counter on ~. Spend this mana only to cast your commander.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('td_queensDiamond')], a => { a.manaLike = true; }); });
cl(/^8\+ \| Flying, vigilance, haste$/, R => { R.stationTiers = (R.stationTiers || []).concat(8); R.stationAt = Math.max(R.stationAt || 0, 8); selfCond(R, { cond: TK_COND(8), p: 0, q: 0, kw: ['flying', 'vigilance', 'haste'] }); });
const MODAL_ACT_HOOKS = [[/^\{T\}, Remove a counter from ~: Choose one —$/, (R, line) => { act(R, line, '{T}', [cmd('td_recon')], a => { a.onlyIf = 'it has 1 or more counters on it'; }); }]];
clx('Players can\'t activate planeswalkers\' loyalty abilities.', R => { R.immortalSun = true; });
clx('At the beginning of your draw step, draw an additional card.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'draw', n: 1 }] }); });
clx('Spells you cast cost {1} less to cast.', R => { R.reducer = { what: 'any', n: 1 }; });
// Hit It! (Oracle wording of 2026-10: reveal instead of look)
clx('When ~ enters, reveal the top five cards of your library. Put a land card from among them onto the battlefield tapped and the rest into your graveyard.', R => { R.etb.push(cmd('tkHitIt')); });

registerRules({
    name: 'trekdecks',
    effects: [...TDR],
    triggers: [],
    lines: []
});
