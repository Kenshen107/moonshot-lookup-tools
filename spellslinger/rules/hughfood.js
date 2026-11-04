// Spellslinger Duels - rules pack: Hugh, First of Many food and mana-rock deck (2026-11-04, owner pasted the list).
// Wordings only; engine pieces are in 15s-hughfood.js (CMD ids start with hh_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text must use the reader's "~" form (this card's name and "this creature" both become "~").
CMD_REWRITES.push([/Return up to three target artifacts and\/or creatures to their owners' hands\./gi, '§hhExp.']);
registerRules({
    name: 'hughfood',
    effects: [
        [/^suspect it$/i, () => cmd('hh_suspect')],
        [/^§hhExp$/, () => cmd('hh_expertise', { multi: 'expertise' })]
    ]
});
// Cosmos Elixir
clx('At the beginning of your end step, draw a card if your life total is greater than your starting life total. Otherwise, you gain 2 life.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('hh_elixir')] }); });
// Desculpting Blast
clx('Return target nonland permanent to its owner\'s hand. If it was attacking, create a 1/1 colorless Drone artifact creature token with flying and "~ can block only creatures with flying."', R => { R.spell = [cmd('hh_desculpt', { target: 'perm', filter: 'nonland permanent' })]; });
// Dimension X Pizzasaur
clx('When ~ enters, put two +1/+1 counters on target creature. When you do, destroy up to one target creature with mana value less than or equal to the number of counters among permanents you control.', R => { R.etb.push(cmd('hh_pizza', { target: 'creature', good: true })); });
// Drafna, Founder of Lat-Nam
clx('{3}, {T}: Copy target artifact spell you control.', (R, m, ctx) => { act(R, ctx.line, '{3}, {T}', [cmd('hh_drafna', { target: 'spell', filter: 'hhArtifactMine' })]); });
// Field-Tested Frying Pan
clx('When ~ enters, create a Food token, then create a 1/1 white Halfling creature token and attach ~ to it.', R => { R.etb.push(cmd('hh_pan')); });
clx('Equipped creature has "Whenever you gain life, ~ gets +X/+X until end of turn, where X is the amount of life you gained."', R => { R.trig.push({ ev: 'gainLife', fn: 'hh_hostGains', effects: [cmd('hh_panBoost')] }); });
// God-Pharaoh's Statue
clx('Spells your opponents cast cost {2} more to cast.', R => { R.spellTax = { who: 'opp', what: 'any', n: 2 }; });
// Hall of Tagsin
clx('{4}, {T}: Create a tapped Powerstone token.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [cmd('hh_tappedStone')]); });
// Hidden Hideout
clx('{2}, {T}: Target creature you control with a counter on it gains lifelink until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('hh_hideout')]); });
// Ivory Tower
clx('At the beginning of your upkeep, you gain X life, where X is the number of cards in your hand minus 4.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('hh_tower')] }); });
// Lembas
clx('When ~ is put into a graveyard from the battlefield, its owner shuffles it into their library.', R => { R.trig.push({ ev: 'toGy', fn: 'selfToGy', effects: [cmd('hh_lembas')] }); });
// Norn's Annex ({W/P} per attacker: {W} or 2 life)
clx('Creatures can\'t attack you or planeswalkers you control unless their controller pays {W/P} for each of those creatures.', R => { R.annexTax = true; });
// Paradise Plume
clx('Whenever a player casts a spell of the chosen color, you may gain 1 life.', R => { R.trig.push({ ev: 'cast', who: 'any', filter: 'chosenColor', effects: [{ t: 'gain', n: 1, may: true }] }); });
// Powerstone Shard
clx('{T}: Add {C} for each artifact you control named ~.', R => { R.mana = { colors: ['C'], n: 1 }; R.hhShard = true; });
// Sickbay
clx('At the beginning of combat on your turn, put X +1/+1 counters on target creature you control, where X is one plus the amount of life you gained this turn.', R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('hh_sickbay')] }); });
// Skyclave Relic
clx('When ~ enters, if it was kicked, create two tapped tokens that are copies of ~.', R => { R.etb.push(cmd('hh_relic')); });
// Spectrum Sentinel
cl(/^Protection from multicolored$/, R => { R.kw.add('pro:multicolored'); });
clx('Whenever a nonbasic land an opponent controls enters, you gain 1 life.', R => { R.trig.push({ ev: 'landfall', fn: 'hh_oppNonbasic', effects: [{ t: 'gain', n: 1 }] }); });
// Sphinx of the Revelation
cl(/^Whenever you gain life, you get that many \{E\} ?\.$/, R => { R.trig.push({ ev: 'gainLife', effects: [cmd('hh_sphinx')] }); });
