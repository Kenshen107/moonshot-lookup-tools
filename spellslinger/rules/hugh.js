// Spellslinger Duels - rules pack: Hugh, First of Many artifact deck (2026-10-31, owner pasted the list).
// Wordings only; engine pieces are in 15q-hugh.js (CMD ids start with hg_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
// Line text must use the reader's "~" form (this card's name and "this creature" both become "~").
registerRules({
    name: 'hugh',
    effects: [
        [/^destroy all nonartifact creatures$/i, () => ({ t: 'wipe', how: 'destroy', what: 'nonartifact creatures' })],
        [/^double the number of each kind of counter on target creature$/i, () => cmd('td_doubleCounters', { target: 'creature', good: true })],
        [/^recruit$/i, () => cmd('hg_recruit')]
    ]
});
// Arcade Cabinet
clx('{2}, {T}, Sacrifice a token: Double the number of each kind of counter on target creature.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('td_doubleCounters', { target: 'creature', good: true })], a => { a.cost.sacPerm = 'token'; }); });
// Bronze Guardian
clx('Other artifacts you control have ward {2}.', R => { R.statics.push({ other: true, type: 'Artifact', p: 0, q: 0, kw: ['ward:2'] }); });
// Cargo Ship (approximation: the mana can be spent on artifact spells; artifact abilities aren't restricted)
clx('{T}: Add {C}. Spend this mana only to cast an artifact spell or activate an ability of an artifact source.', R => { R.mana = { colors: ['C'], n: 1, onlyType: 'Artifact' }; });
// Coin of Fate
clx('{3}{W}, {T}, Exile two creature cards from your graveyard, Sacrifice ~: An opponent chooses one of the exiled cards. You put that card on the bottom of your library and return the other to the battlefield tapped. You become the monarch.', (R, m, ctx) => { act(R, ctx.line, '{3}{W}, {T}', [cmd('hg_coinFate')], a => { a.cost.sacSelf = true; a.onlyIf = 'there are two or more creature cards in your graveyard'; }); });
// Coin of Mastery
clx('Each creature you control enters with an additional +1/+1 counter on it for each mana from an artifact source spent to cast it.', R => { R.coinMastery = true; });
// Colossal Plow
clx('Whenever ~ attacks, add {W}{W}{W} and you gain 3 life. Until end of turn, you don\'t lose this mana as steps and phases end.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('hg_plow')] }); });
// Cyberdrive Awakener
clx('Other artifact creatures you control have flying.', R => { R.statics.push({ other: true, type: 'Artifact', p: 0, q: 0, kw: ['flying'] }); });
clx('When ~ enters, each noncreature artifact you control becomes a 4/4 artifact creature until end of turn.', R => { R.etb.push(cmd('hg_awakener')); });
// Cybermat
clx('Whenever ~ attacks and isn\'t blocked, it gets +X/+0 until end of turn, where X is the number of attacking artifact creatures.', R => { R.trig.push({ ev: 'unblocked', fn: 'selfBlocked', effects: [cmd('hg_cybermat')] }); });
// Demonic Junker
clx('When ~ enters, for each player, destroy up to one target creature that player controls. If a creature you controlled was destroyed this way, put two +1/+1 counters on ~.', R => { R.etb.push(cmd('hg_junker')); });
// Ethersworn Shieldmage
clx('When ~ enters, prevent all damage that would be dealt to artifact creatures this turn.', R => { R.etb.push(cmd('hg_shieldmage')); });
// Great Gilded Boat
clx('Whenever you attack, recruit.', R => { R.trig.push({ ev: 'attacks', fn: 'anyAttackMine', once: 'hg_boat', effects: [cmd('hg_recruit')] }); });
// Luxurious Locomotive
clx('Whenever ~ attacks, create a Treasure token for each creature that crewed it this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('hg_loco')] }); });
clx('Crew 1. Activate only once each turn.', R => { R.crew = 1; R.crewOnce = true; });
// Mole Module
clx('Whenever ~ deals combat damage to a player, mill four cards. You may put a permanent card from among them onto the battlefield.', R => { R.trig.push({ ev: 'hitPlayer', fn: 'hg_selfHits', effects: [cmd('hg_mole')] }); });
// Nuka-Cola Vending Machine
clx('Whenever you sacrifice a Food, create a tapped Treasure token.', R => { R.trig.push({ ev: 'sacrificed', fn: 'hg_myFood', effects: [cmd('hg_tappedTreasure')] }); });
// Refurbished Familiar
clx('When ~ enters, each opponent discards a card. For each opponent who can\'t, you draw a card.', R => { R.etb.push(cmd('hg_familiar')); });
// The Cyber-Controller
clx('When ~ enters, each opponent mills 97 cards. Put all creature cards milled this way onto the battlefield face down under your control. They\'re 2/2 Cyberman artifact creatures.', R => { R.etb.push(cmd('hg_controller', { n: '{X}' })); });
// Torrential Gearhulk
clx('When ~ enters, you may cast target instant card from your graveyard without paying its mana cost. If that spell would be put into your graveyard, exile it instead.', R => { R.etb.push(cmd('hg_gearhulk')); });
// Weeping Angel
clx('Whenever an opponent casts a creature spell, ~ isn\'t a creature until end of turn.', R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'hg_oppCreatureCast', effects: [cmd('hg_angelOff')] }); });
clx('If ~ would deal combat damage to a creature, prevent that damage and that creature\'s owner shuffles it into their library.', R => { R.weepingAngel = true; });
