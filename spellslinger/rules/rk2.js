// Spellslinger Duels - rules pack rk2 (2026-11-27 card round: the most-played cards the game did not fully read).
// Wordings only; engine pieces are in 15zm-rk2.js (CMD ids start with rk2_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
// Three Tree City
clx('{2}, {T}: Choose a color. Add an amount of mana of that color equal to the number of creatures you control of the chosen type.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('rk2_threeTree')]); });
// Dawn's Truce, Veil of Summer
clx('You and permanents you control gain hexproof until end of turn. If the gift was promised, permanents you control also gain indestructible until end of turn.', R => { R.spell = [cmd('rk2_dawnTruce')]; });
clx('Draw a card if an opponent has cast a blue or black spell this turn. Spells you control can\'t be countered this turn. You and permanents you control gain hexproof from blue and from black until end of turn.', R => { R.spell = [cmd('rk2_veil')]; });
// Bident of Thassa
clx('{1}{U}, {T}: Creatures your opponents control attack this turn if able.', (R, m, ctx) => { act(R, ctx.line, '{1}{U}, {T}', [cmd('rk2_bident')]); });
// Wizard Class (level 2), Cleric Class (level 3)
clx('When ~ becomes level 2, draw two cards.', R => { R.trig.push({ ev: 'levelUp', fn: 'rk2_lvl', lvlN: 2, effects: [{ t: 'draw', n: 2 }] }); });
clx('When ~ becomes level 3, return target creature card from your graveyard to the battlefield. You gain life equal to that creature\'s toughness.', R => { R.trig.push({ ev: 'levelUp', fn: 'rk2_lvl', lvlN: 3, effects: [cmd('rk2_clericL3')] }); });
// Reflections of Littjara
clx('Whenever you cast a spell of the chosen type, copy that spell.', R => { R.trig.push({ ev: 'cast', fn: 'rk2_chosenSpell', who: 'any', filter: 'any', effects: [{ t: 'copyLastCast' }] }); });
// Flare of Fortitude
clx('You may sacrifice a nontoken white creature rather than pay ~\'s mana cost.', R => { R.alt = { mana: parseCost(''), sacKind: 'nontoken creature:W', life: 0, exile: null, cond: null, text: 'sacrifice a nontoken white creature' }; });
clx('Until end of turn, your life total can\'t change, and permanents you control gain hexproof and indestructible.', R => { R.spell = [cmd('rk2_flare')]; });
// Mizzix's Mastery
clx('Exile target card that\'s an instant or sorcery from your graveyard. For each card exiled this way, copy it, and you may cast the copy without paying its mana cost. Exile ~.', R => { R.spell = [cmd('rk2_mizzix')]; });
clx('Overload {5}{R}{R}{R}', R => { R.overload = { cost: parseCost('{5}{R}{R}{R}'), spell: [cmd('rk2_mizzix', { all: true })], text: '{5}{R}{R}{R}' }; });
// Solphim, Mayhem Dominus
clx('If a source you control would deal noncombat damage to an opponent or a permanent an opponent controls, it deals double that damage to that player or permanent instead.', R => { R.rk2Solphim = true; });
clx('{1}{R/P}{R/P}, Discard two cards: Put an indestructible counter on ~.', (R, m, ctx) => { act(R, ctx.line, '{1}{R}{R}', [{ t: 'namedCounter', n: 1, kind: 'indestructible' }], a => { a.rk2DiscardN = 2; }); });
// Demonic Consultation
clx('Choose a card name. Exile the top six cards of your library, then reveal cards from the top of your library until you reveal a card with the chosen name. Put that card into your hand and exile all other cards revealed this way.', R => { R.spell = [cmd('rk2_consult')]; });
// Strix Serenade, Damning Verdict
clx('Counter target artifact, creature, or planeswalker spell. Its controller creates a 2/2 blue Bird creature token with flying.', R => { R.spell = [{ t: 'counter', target: 'spell', filter: 'rk2ACP', good: false }, cmd('rk2_birdFor')]; });
clx('Destroy all creatures with no counters on them.', R => { R.spell = [cmd('rk2_verdict')]; });
// Sterling Grove, Greater Auramancy
clx('Other enchantments you control have shroud.', R => { R.rk2EnchShroud = true; });
// Dolmen Gate
clx('Prevent all combat damage that would be dealt to attacking creatures you control.', R => { R.statics.push({ spec: { type: 'Creature', attacking: true }, p: 0, q: 0, kw: ['preventcombat'] }); });
// Simic Ascendancy
clx('Whenever one or more +1/+1 counters are put on a creature you control, put that many growth counters on ~.', R => { R.trig.push({ ev: 'counters', fn: 'rk2_ctrMine', effects: [cmd('rk2_growth')] }); });
// Ad Nauseam
clx('Reveal the top card of your library and put that card into your hand. You lose life equal to its mana value. You may repeat this process any number of times.', R => { R.spell = [cmd('rk2_adNauseam')]; });
// Ancient Silver Dragon
clx('Whenever ~ deals combat damage to a player, roll a d20. Draw cards equal to the result. You have no maximum hand size for the rest of the game.', R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('rk2_silverDragon')] }); });
// Ouroboroid
clx('At the beginning of combat on your turn, put X +1/+1 counters on each creature you control, where X is ~\'s power.', R => { R.trig.push({ ev: 'combat', who: 'your', effects: [cmd('rk2_ouroboroid')] }); });
registerRules({
    name: 'rk2',
    effects: [
        [/^destroy all Dragon creatures$/i, () => cmd('rk2_wipeDragons')],
        [/^destroy all non-Dragon creatures$/i, () => cmd('rk2_wipeDragons', { non: true })],
        [/^remove up to three counters from target permanent$/i, () => cmd('rk2_removeCounters', { n: 3, target: 'perm', filter: 'permanent' })]
    ],
    triggers: [
        [/^Whenever an enchantment you control enters, (.+)$/, () => SPEC('enters', { ctl: 'you', type: 'Enchantment' })],
        [/^Whenever another permanent you control enters, (.+)$/, () => SPEC('enters', { ctl: 'you', another: true })]
    ]
});
