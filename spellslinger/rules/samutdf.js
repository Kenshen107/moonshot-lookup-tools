// Spellslinger Duels - rules pack: the Samut, the Driving Force deck (2026-10-27, owner's list: Boros/Naya speed, Mercenaries, Paradigm lessons and token copies).
// Wordings only; engine pieces in 15n-samutdf.js (ids start with sd_). "97" stands for X in the reader's text. Lines are matched whole.
// Speed is a real counter now (P.speed); "Max speed —" lines are marked in the card reader (02-card-reader.js) and only work at speed 4.

const SD_MERC_TEXT = '{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.';
const sdMerc = n => ({ t: 'token', n, p: 1, q: 1, name: 'red Mercenary', kw: [], text: SD_MERC_TEXT });
CMD_REWRITES.push(
    [/Create 97 1\/1 red Mercenary creature tokens with "\{T\}: Target creature you control gets \+1\/\+0 until end of turn\. Activate only as a sorcery\."/g, '§sdPosse.'],
    [/Create 97 2\/2 red Human Knight creature tokens with trample and haste\. Whenever one or more creatures you control deal combat damage to one or more players this turn, you become the monarch\./g, '§sdEorlingas.'],
    [/Create 97 tokens that are copies of target artifact or creature you control\. Those tokens gain haste until end of turn\. Sacrifice them at the beginning of the next end step\./g, '§sdOnslaught.'],
    [/Draw a card for each creature you control with power 4 or greater\. Then creatures you control get \+X\/\+X until end of turn, where X is the number of cards in your hand\./g, '§sdAvalanche.'],
    [/Discard your hand, then draw cards equal to the number of cards in target opponent's hand\./g, '§sdBorrowA.'],
    [/Discard your hand, then draw cards equal to the number of cards discarded this way\./g, '§sdBorrowB.'],
    [/Target player gains 2 life for each creature on the battlefield\./g, '§sdCongregate.'],
    [/Search your library for up to X basic land cards, where X is the number of creatures attacking you, put those cards onto the battlefield tapped, then shuffle\./g, '§sdRespite.'],
    [/~ deals damage to each opponent equal to the number of lands that player controls\./g, '§sdTerrain.'],
    [/Exile cards from the top of your library until you exile cards with total mana value 4 or greater\. You may cast any number of spells from among them without paying their mana costs\./g, '§sdCapstone.']
);
registerRules({
    name: 'samutdf',
    effects: [
        [/^§sdPosse$/, () => sdMerc(X_PH)],
        [/^§sdEorlingas$/, () => ({ t: 'cmd', id: 'sd_eorlingas', n: X_PH })],
        [/^§sdOnslaught$/, () => ({ t: 'cmd', id: 'sd_onslaught', n: X_PH, target: 'perm', filter: 'artifact or creature', mine: true, good: true })],
        [/^§sdAvalanche$/, () => ({ t: 'cmd', id: 'sd_avalanche' })],
        [/^§sdBorrowA$/, () => ({ t: 'cmd', id: 'sd_borrowA' })],
        [/^§sdBorrowB$/, () => ({ t: 'cmd', id: 'sd_borrowB' })],
        [/^§sdCongregate$/, () => ({ t: 'cmd', id: 'sd_congregate', target: 'player' })],
        [/^§sdRespite$/, () => ({ t: 'fetchLand', n: 0, nFrom: 'sdAtkMe', what: 'basic land', bf: true, tapped: true })],
        [/^§sdTerrain$/, () => ({ t: 'cmd', id: 'sd_terrain' })],
        [/^§sdCapstone$/, () => ({ t: 'cmd', id: 'sd_capstone' })]
    ],
    triggers: [],
    lines: []
});

// Samut, the Driving Force
cl(/^Other creatures you control get \+X\/\+0, where X is your speed\.$/, R => { R.statics.push({ other: true, perSpeed: true, p: 1, q: 0, kw: [] }); });
cl(/^Noncreature spells you cast cost \{X\} less to cast, where X is your speed\.$/, R => { R.reducer = { what: 'noncreature', n: 1, perSpeed: true }; });
// Angelic Sell-Sword
clx("Whenever ~ attacks, if its power is 6 or greater, draw a card.", R => { R.trig.push({ ev: 'attacks', fn: 'sd_selfAttacksBig', effects: [{ t: 'draw', n: 1 }] }); });
// Burnout Bashtronaut (the card reader marks the "Max speed —" line)
clx("~ has double strike.", R => { selfCond(R, { p: 0, q: 0, kw: ['double strike'] }); });
// Decree of Savagery
clx("When you cycle ~, you may put four +1/+1 counters on target creature.", R => { R.cycleTrig = [{ t: 'counters', n: 4, target: 'creature', optional: true }]; });
// Elixir
cl(/^\{5\}, \{T\}, Exile ~: Shuffle all nonland cards from your graveyard into your library\. You gain life equal to the number of cards shuffled into your library this way\.$/, (R, m, ctx) => { act(R, ctx.line, '{5}, {T}, Exile ~', [cmd('sd_elixir')]); });
// Gogo, Mysterious Mime
cl(/^At the beginning of combat on your turn, you may have ~ become a copy of another target creature you control until end of turn, except its name is ~\. If you do, ~ and that creature each get \+2\/\+0 and gain haste until end of turn and attack this turn if able\.$/, R => { R.trig.push({ ev: 'combat', fn: 'sd_myCombat', effects: [cmd('sd_gogo')] }); });
// Howlsquad Heavy
clx("At the beginning of combat on your turn, create a 1/1 red Goblin creature token. That token attacks this combat if able.", R => { R.trig.push({ ev: 'combat', fn: 'sd_myCombat', effects: [cmd('sd_howlsquad')] }); });
// Hulkling, Young Avenger
cl(/^Whenever you cast a noncreature spell, ~ becomes a copy of up to one other target creature until end of turn, except his name is ~, he's 4\/4, and he has flying and this ability\.$/, R => { R.trig.push({ ev: 'cast', fn: 'sd_myNoncreatureCast', who: 'any', filter: 'any', effects: [cmd('sd_hulkling')] }); });
// Oviya, Automech Artisan
clx("Each creature that's attacking one of your opponents has trample.", R => { R.statics.push({ global: true, fn: 'sd_atkOpp', p: 0, q: 0, kw: ['trample'] }); });
clx("{G}, {T}: You may put a creature or Vehicle card from your hand onto the battlefield. If you put an artifact onto the battlefield this way, put two +1/+1 counters on it.", (R, m, ctx) => { act(R, ctx.line, '{G}, {T}', [cmd('sd_oviya')]); });
// Parhelion II
clx("Whenever ~ attacks, create two 4/4 white Angel creature tokens with flying and vigilance that are attacking.", R => { R.trig.push({ ev: 'attacks', fn: 'sd_selfAttacksAny', effects: [{ t: 'token', n: 2, p: 4, q: 4, name: 'white Angel', kw: ['flying', 'vigilance'], attacking: true }] }); });
// Point the Way
clx("{3}{G}, Sacrifice ~: Search your library for up to X basic land cards, where X is your speed. Put those cards onto the battlefield tapped, then shuffle.", (R, m, ctx) => { act(R, ctx.line, '{3}{G}, Sacrifice ~', [{ t: 'fetchLand', n: 0, nFrom: 'sdSpeed', what: 'basic land', bf: true, tapped: true }]); });
// Racers' Scoreboard (the reader marks the "Max speed —" line)
clx("Spells you cast cost {1} less to cast.", R => { R.reducer = { what: 'any', n: 1 }; });
// Threefold Thunderhulk
clx("Whenever ~ enters or attacks, create a number of 1/1 colorless Gnome artifact creature tokens equal to its power.", R => { R.etb.push(cmd('sd_thunderhulk')); R.trig.push({ ev: 'attacks', fn: 'sd_selfAttacksAny', effects: [cmd('sd_thunderhulk')] }); });
clx("{2}, Sacrifice another artifact: Put a +1/+1 counter on ~.", (R, m, ctx) => { act(R, ctx.line, '{2}', [{ t: 'counters', n: 1, target: 'self' }], a => { a.cost.sacPerm = 'another artifact'; }); });
// We Ride at Dawn
clx("Legendary creature spells you cast have convoke.", R => { R.convokeLegend = true; });
clx("Whenever your commander attacks, create a 1/1 red Mercenary creature token with \"{T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery.\"", R => { R.trig.push({ ev: 'attacks', fn: 'sd_myCommanderAttacks', effects: [sdMerc(1)] }); });
// Paradigm (Germination Practicum, Improvisation Capstone, Restoration Seminar)
clx("Paradigm", R => { R.paradigm = true; });
