// Spellslinger Duels - rules pack: Nephilim / Changeling tribal deck (2026-11-19, owner pasted the list).
// Wordings only; engine pieces are in 15zh-neph.js (CMD ids start with nf_). Line text uses the reader's "~" form
// ("Nephilim" in a card's text can read as ~ because the card's short name is Nephilim).
clx('When ~ enters, search your library for a ~ card, reveal it, put it into your hand, then shuffle.', R => { R.etb.push(cmd('nf_tutor')); });
clx('~ you control get +1/+1 for each other ~ you control and can\'t be blocked by monocolored creatures.', R => { R.nfEpochal = true; });
clx('Whenever you cast a spell of the chosen type, draw a card.', R => { R.trig.push({ ev: 'cast', filter: 'chosenType', effects: [{ t: 'draw', n: 1 }] }); });
clx('Target player creates a token that\'s a copy of target creature you control.', R => { R.spell = [cmd('nf_echo')]; });
clx('When ~ enters, you may exile another target permanent you control, then return that card to the battlefield under its owner\'s control.', R => { R.etb.push(cmd('nf_blinkOwn')); });
clx('Exile target nontoken permanent, then return it to the battlefield under its owner\'s control.', R => { R.spell = [cmd('nf_flicker')]; });
clx('Whenever a player casts an instant or sorcery spell, if that spell targets only ~, copy the spell for each other creature that spell could target. Each copy targets a different one of those creatures.', R => { R.nfInk = true; });
clx('Until end of turn, double target creature\'s power and it gains first strike.', R => { R.spell = [cmd('nf_legion', { target: 'creature' })]; });
clx('Each nonland permanent you control is all colors.', R => { R.nfLeyline = true; });
clx('Whenever equipped creature deals combat damage to a player, choose a creature type. Create a Treasure token for each creature you control of that type.', R => { R.trig.push({ ev: 'hitPlayer', host: true, effects: [cmd('nf_orcrist')] }); });
clx('Whenever you cast an instant or sorcery spell, if it targets one or more other permanents you control, create a token that\'s a copy of one of those permanents.', R => { R.nfOrvar = true; });
clx('When a spell or ability an opponent controls causes you to discard ~, create a token that\'s a copy of target permanent.', R => { R.nfOrvarDiscard = true; });
clx('As long as you control six or more lands, lands you control have "{T}: Add one mana of any color."', R => { R.nfWorldTree = true; });
clx('{W}{W}{U}{U}{B}{B}{R}{R}{G}{G}, {T}, Sacrifice ~: Search your library for any number of God cards, put them onto the battlefield, then shuffle.', (R, m, ctx) => { act(R, ctx.line, '{W}{W}{U}{U}{B}{B}{R}{R}{G}{G}, {T}, Sacrifice ~', [cmd('nf_gods')]); });
clx('Whenever ~ attacks, it gains trample until end of turn if its power is 10 or greater.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('nf_witch')] }); });
clx('Whenever ~ attacks, return target creature card from your graveyard to the battlefield tapped and attacking.', R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('nf_yore')] }); });
