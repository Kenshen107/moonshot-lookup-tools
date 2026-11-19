// Spellslinger Duels - rules pack: Reed Richards, Smartest Man deck (2026-11-19, owner pasted the list).
// Wordings only; engine pieces are in 15zg-reed.js (CMD ids start with rr_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text must use the reader's "~" form.
// Bag of Holding
clx('Whenever you discard a card, exile that card from your graveyard.', R => { R.trig.push({ ev: 'discarded', fn: 'rr_myDiscard', effects: [cmd('rr_bagExile')] }); });
clx('{4}, {T}, Sacrifice ~: Return all cards exiled with ~ to their owner\'s hand.', (R, m, ctx) => { act(R, ctx.line, '{4}, {T}, Sacrifice ~', [cmd('rr_bagReturn')]); });
// Confounding Conundrum
clx('Whenever a land an opponent controls enters, if that player had another land enter the battlefield under their control this turn, they return a land they control to its owner\'s hand.', R => { R.rrConundrum = true; });
// Curses
clx('At the beginning of enchanted player\'s upkeep, any number of target players other than that player each draw cards equal to the number of Curses attached to that player.', R => { R.etb.push(cmd('sx_enchantChoose', { curse: true })); R.trig.push({ ev: 'upkeep', who: 'each', fn: 'sx_hostActive', effects: [cmd('rr_survey')] }); });
clx('Whenever enchanted player is attacked, you draw a card. Each opponent attacking that player does the same.', R => { R.etb.push(cmd('sx_enchantChoose', { curse: true })); R.rrVerbosity = true; });
// Super Intelligence
clx('At the beginning of the upkeep of enchanted creature\'s controller, that player draws a card.', R => { R.trig.push({ ev: 'upkeep', who: 'host', effects: [{ t: 'drawHostCtl' }] }); });
// Illusionist's Stratagem
clx('Exile up to two target creatures you control, then return those cards to the battlefield under their owner\'s control.', R => { R.spell = [cmd('rr_stratagem')]; });
// Counters for activated abilities
clx('Counter target activated ability from an artifact, creature, enchantment, or land. That permanent\'s activated abilities can\'t be activated this turn.', R => { R.spell = [{ t: 'counter', target: 'spell', filter: 'rrActivatedNoPW' }, cmd('rr_interdict')]; });
clx('Counter target activated ability.', R => { R.spell = [{ t: 'counter', target: 'spell', filter: 'rrActivated' }]; });
clx('When ~ enters, counter target activated ability.', R => { R.etb.push({ t: 'counter', target: 'spell', filter: 'rrActivated' }); });
// Jace's Erasure
clx('Whenever you draw a card, you may have target player mill a card.', R => { R.trig.push({ ev: 'draw', fn: 'rr_myDraw', effects: [cmd('rr_erasure', { target: 'player' })] }); });
// Trade the Helm
clx('Exchange control of target artifact or creature you control and target artifact or creature an opponent controls.', R => { R.spell = [cmd('rr_trade')]; });
// Uncover the Moon-Letters
clx('Whenever you cast a noncreature spell, you may draw X cards, where X is the amount of mana spent to cast that spell. If you do, discard two cards.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('rr_moonLetters')] }); });
// Waxen Shapethief
clx('You may have ~ enter as a copy of an artifact or creature you control.', R => { R.clone = { what: 'artifact or creature you control' }; });
