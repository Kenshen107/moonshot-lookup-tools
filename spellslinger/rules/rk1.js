// Spellslinger Duels - rules pack rk1 (2026-11-27 card round: the most-played cards the game did not fully read).
// Wordings only; engine pieces are in 15zm-rk1.js (CMD ids start with rk1_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
// ===== Batch 1 =====
// Nykthos, Shrine to Nyx
clx('{2}, {T}: Choose a color. Add an amount of mana of that color equal to your devotion to that color.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('rk1_nykthos')]); });
// Utopia Sprawl
clx('Whenever enchanted Forest is tapped for mana, its controller adds an additional one mana of the chosen color.', R => { R.rk1Sprawl = true; });
// Dauthi Voidwalker
clx('If a card would be put into an opponent\'s graveyard from anywhere, instead exile it with a void counter on it.', R => { R.rk1Void = true; });
clx('{T}, Sacrifice ~: Choose an exiled card an opponent owns with a void counter on it. You may play it this turn without paying its mana cost.', (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('rk1_voidPlay')]); });
// Liquimetal Torque
clx('{T}: Target nonland permanent becomes an artifact in addition to its other types until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('rk1_torque', { target: 'perm', filter: 'nonland permanent' })]); });
// Thespian's Stage
clx('{2}, {T}: ~ becomes a copy of target land, except it has this ability.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('rk1_stage', { target: 'perm', filter: 'land' })]); });
// Realmwalker
clx('You may cast creature spells of the chosen type from the top of your library.', R => { R.rk1TopChosen = true; });
// Kaya's Ghostform
clx('Enchant creature or planeswalker you control', R => { R.aura = true; R.auraTarget = 'creature or planeswalker you control'; });
clx('When enchanted permanent dies or is put into exile, return that card to the battlefield under your control.', R => { R.rk1Ghostform = true; });
// Stoneforge Mystic
clx('{1}{W}, {T}: You may put an Equipment card from your hand onto the battlefield.', (R, m, ctx) => { act(R, ctx.line, '{1}{W}, {T}', [cmd('rk1_stoneforge')]); });
// Not Dead After All / Fake Your Own Death
clx('Until end of turn, target creature you control gains "When ~ dies, return it to the battlefield tapped under its owner\'s control, then create a Wicked Role token attached to it."', R => { R.spell = [cmd('rk1_returnDies', { target: 'creature', mine: true, good: true, role: true })]; });
clx('Until end of turn, target creature gets +2/+0 and gains "When ~ dies, return it to the battlefield tapped under its owner\'s control and you create a Treasure token."', R => { R.spell = [cmd('rk1_returnDies', { target: 'creature', good: true, treasure: true, pump: 2 })]; });
// Flares
clx('You may sacrifice a nontoken red creature rather than pay ~\'s mana cost.', R => { R.alt = { mana: parseCost(''), sacKind: 'nontoken creature:R', life: 0, exile: null, cond: null, text: 'sacrifice a nontoken red creature' }; });
clx('You may sacrifice a nontoken blue creature rather than pay ~\'s mana cost.', R => { R.alt = { mana: parseCost(''), sacKind: 'nontoken creature:U', life: 0, exile: null, cond: null, text: 'sacrifice a nontoken blue creature' }; });
clx('You may sacrifice a nontoken green creature rather than pay ~\'s mana cost.', R => { R.alt = { mana: parseCost(''), sacKind: 'nontoken creature:G', life: 0, exile: null, cond: null, text: 'sacrifice a nontoken green creature' }; });
// Nightscape Familiar
clx('Blue spells and red spells you cast cost {1} less to cast.', R => { R.reducer = { what: 'color:UR', n: 1 }; });
// ===== Batch 2 =====
const RK_TIER = n => `it has ${n} or more charge counters on it`;
// Castle Garenbrig
clx('{2}{G}{G}, {T}: Add six {G}. Spend this mana only to cast creature spells or activate abilities of creatures.', (R, m, ctx) => { act(R, ctx.line, '{2}{G}{G}, {T}', [{ t: 'addMana', fromN: true, color: 'G', n: 6, only: 'Creature' }]); });
// Spacecraft lands and other "add mana for each" abilities
clx('12+ | {G}, {T}: Add {G} for each creature you control.', (R, m, ctx) => { R.stationTiers = (R.stationTiers || []).concat(12); act(R, ctx.line, '{G}, {T}', [cmd('rk1_manaPer', { color: 'G', what: 'creature' })], a => { a.onlyIf = RK_TIER(12); }); });
clx('12+ | {U}, {T}: Add {U} for each artifact you control.', (R, m, ctx) => { R.stationTiers = (R.stationTiers || []).concat(12); act(R, ctx.line, '{U}, {T}', [cmd('rk1_manaPer', { color: 'U', what: 'artifact' })], a => { a.onlyIf = RK_TIER(12); }); });
clx('{2}, {T}: Add {B} for each black creature card in your graveyard.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('rk1_manaPer', { color: 'B', what: 'blackCreatureGy' })]); });
// Archway of Innovation
clx('{U}, {T}: The next spell you cast this turn has improvise.', (R, m, ctx) => { act(R, ctx.line, '{U}, {T}', [cmd('rk1_improvNext')]); });
// Moraug
clx('Each creature you control gets +1/+0 for each time it has attacked this turn.', R => { R.rk1Moraug = true; });
clx('Whenever a land you control enters, if it\'s your main phase, there\'s an additional combat phase after this phase. At the beginning of that combat, untap all creatures you control.', R => { R.trig.push({ ev: 'landfall', fn: 'rk1MoraugLand', effects: [cmd('rk1_moraugExtra')] }); R.trig.push({ ev: 'combat', fn: 'rk1MoraugComb', effects: [cmd('rk1_moraugUntap')] }); });
// Genji Glove
clx('Whenever equipped creature attacks, if it\'s the first combat phase of the turn, untap it. After this phase, there is an additional combat phase.', R => { R.trig.push({ ev: 'attacks', fn: 'rk1HostAttacksFirst', effects: [cmd('rk1_genji')] }); });
// K'rrik
clx('For each {B} in a cost, you may pay 2 life rather than pay that mana.', R => { R.rk1Krrik = true; });
// Skrelv
clx('{W/P}, {T}: Choose a color. Another target creature you control gains toxic 1 and hexproof from that color until end of turn. It can\'t be blocked by creatures of that color this turn.', (R, m, ctx) => { act(R, ctx.line, '{W}', [cmd('rk1_skrelv', { target: 'creature', mine: true, good: true, notSelf: true })], a => { a.phyrexian = 'W'; }); });
// The Black Gate
clx('{1}{B}, {T}: Choose a player with the most life or tied for most life. Target creature can\'t be blocked by creatures that player controls this turn.', (R, m, ctx) => { act(R, ctx.line, '{1}{B}, {T}', [cmd('rk1_blackGate', { target: 'creature', good: true })]); });
// Tarrian's Soulcleaver
clx('Whenever another artifact or creature is put into a graveyard from the battlefield, put a +1/+1 counter on equipped creature.', R => { R.rk1Cleaver = true; });
// Amulet of Vigor
clx('Whenever a permanent you control enters tapped, untap it.', R => { R.trig.push(SPEC('enters', { ctl: 'you', tapped: true }, { effects: [cmd('rk1_untapCtx')] })); R.trig.push(SPEC('landfall', { ctl: 'you', tapped: true }, { effects: [cmd('rk1_untapCtx')] })); });
// Hedge Shredder
clx('Whenever one or more land cards are put into your graveyard from your library, put them onto the battlefield tapped.', R => { R.trig.push({ ev: 'milled', fn: 'rk1MilledLands', effects: [cmd('rk1_shredder')] }); });
// Keeper of the Accord
clx('At the beginning of each opponent\'s end step, if that player controls more creatures than you, create a 1/1 white Soldier creature token.', R => { R.trig.push({ ev: 'end', fn: 'rk1OppEnd', cond: 'the active player controls more creatures than you', effects: [{ t: 'token', n: 1, p: 1, q: 1, name: 'white Soldier', kw: [] }] }); });
clx('At the beginning of each opponent\'s end step, if that player controls more lands than you, you may search your library for a basic Plains card, put it onto the battlefield tapped, then shuffle.', R => { R.trig.push({ ev: 'end', fn: 'rk1OppEnd', cond: 'the active player controls more lands than you', effects: [cmd('rk1_keeperLand')] }); });
// Palantír of Orthanc
clx('At the beginning of your end step, put an influence counter on ~ and scry 2. Then target opponent may have you draw a card. If that player doesn\'t, you mill X cards, where X is the number of influence counters on ~, and that player loses life equal to the total mana value of those cards.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('rk1_palantir')] }); });
// Carpet of Flowers
clx('At the beginning of each of your main phases, if you haven\'t added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target opponent controls.', R => { R.trig.push({ ev: 'main1', once: 'carpet', effects: [cmd('rk1_carpet')] }); R.trig.push({ ev: 'main2', once: 'carpet', effects: [cmd('rk1_carpet')] }); });
// Ulamog, the Infinite Gyre
clx('When ~ is put into a graveyard from anywhere, its owner shuffles their graveyard into their library.', R => { R.rk1Ulamog = true; });
