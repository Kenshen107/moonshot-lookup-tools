// Spellslinger Duels - rules pack rk6 (2026-11-27 card round: the most-played cards the game did not fully read).
// Wordings only; engine pieces are in 15zm-rk6.js (CMD ids start with rk6_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
const rk6Spell = (R, ...effs) => { R.spell = (R.spell || []).concat(effs); };
// ===== batch 1: spells =====
clx("Destroy target creature. If that creature dies this way, its controller creates two tokens that are copies of that creature, except their power is half that creature's power and their toughness is half that creature's toughness. Round up each time.", R => { R.spell = [cmd('rk6_saw', { target: 'creature' })]; });
clx('Sacrifice any number of lands. Search your library for up to that many land cards, put them onto the battlefield tapped, then shuffle.', R => { R.spell = [cmd('rk6_scapeshift')]; });
clx("Destroy all creatures. They can't be regenerated. Draw a card for each creature destroyed this way.", R => { R.spell = [cmd('rk6_decree')]; });
clx('When you cycle ~, all creatures get -2/-2 until end of turn.', R => { R.cycleTrig = [cmd('rk6_decreeCycle')]; });
clx('As an additional cost to cast ~, sacrifice a green creature.', R => { R.addCost = { sac: 'creature:G' }; });
clx('Search your library for a green creature card, put it onto the battlefield, then shuffle.', R => { R.spell = [cmd('rk6_natural')]; });
clx("Target player can't cast spells this turn. If ~ was kicked, creatures can't attack this turn.", R => { R.spell = [cmd('rk6_chant', { target: 'player' })]; });
clx('Until end of turn, target creature gets +2/+0 and gains "When ~ dies, return it to the battlefield tapped under its owner\'s control."', R => { R.spell = [cmd('rk6_stamina', { target: 'creature', good: true })]; });
clx('Untap all creatures and gain control of them until end of turn. They gain haste until end of turn.', R => { R.spell = [cmd('rk6_insurrection')]; });
clx('Target creature you control fights target creature an opponent controls. If the creature the opponent controls is dealt excess damage this way, add that much {R}.', R => { R.spell = [cmd('rk6_agni', { target: 'creature', theirs: true })]; });
clx("Until end of turn, you don't lose unspent red mana as steps and phases end.", R => { /* done by the fight line (rk6_agni keeps the pool for the turn) */ });
clx('Until end of turn, creatures target player controls lose all abilities and have base power and toughness 0/2.', R => { R.spell = [cmd('rk6_spoiling', { target: 'player' })]; });
clx('Choose a creature type. Target player draws X cards and loses X life, where X is the number of creatures they control of the chosen type.', R => { R.spell = [cmd('rk6_serpent', { target: 'player' })]; });
clx('Each player shuffles the cards from their hand into their library, then draws that many cards.', R => { R.spell = [cmd('rk6_winds')]; });
clx('You draw two cards and you lose 2 life. Each opponent gets a poison counter.', R => { R.spell = [cmd('rk6_inquiry')]; });
clx('Target opponent exiles the top 97 cards of their library. You may cast any number of spells with mana value 97 or less from among them without paying their mana costs.', R => { R.spell = [cmd('rk6_wealth', { target: 'player', oppOnly: true, xm: '{X}' })]; });
clx('Create 97 1/1 red Elemental creature tokens with haste. Each opponent may create 97 1/1 red Elemental creature tokens with haste. For each opponent who does, create 97 1/1 red Elemental creature tokens with haste.', R => { R.spell = [cmd('rk6_vengeance', { xm: '{X}' })]; });
clx("Destroy target artifact. It can't be regenerated. Create X 1/1 green Saproling creature tokens, where X is that artifact's mana value.", R => { R.spell = [cmd('rk6_mutation', { target: 'perm', filter: 'artifact' })]; });
clx('Search your library for an artifact card, reveal it, put it into your hand, shuffle, then discard a card at random. If an artifact card was discarded this way, ~ deals 2 damage to each opponent.', R => { R.spell = [cmd('rk6_reckless')]; });
clx("Exile any number of target creatures and/or planeswalkers you control. At the beginning of the next end step, return each of them to the battlefield under its owner's control. Each of them enters with an additional +1/+1 counter on it if it's a creature and an additional loyalty counter on it if it's a planeswalker.", R => { R.spell = [cmd('rk6_semester')]; });
clx('Create X 1/1 white Pegasus creature tokens with flying, where X is your life total.', R => { R.spell = [cmd('rk6_stormherd')]; });
clx('~ deals damage to each player equal to twice the number of nonbasic lands that player controls.', R => { R.spell = [cmd('rk6_progress')]; });
clx('~ deals 97 damage to target creature. Create a number of tapped Treasure tokens equal to the amount of excess damage dealt to that creature this way.', R => { R.spell = [cmd('rk6_hell', { target: 'creature', xm: '{X}' })]; });
clx('As an additional cost to cast ~, sacrifice a creature or discard a card.', R => { R.addCost = { sac: 'creature', orDiscard: true }; });
clx('As an additional cost to cast ~, discard two cards.', R => { R.addCost = { rk6Discard2: true }; });
clx("At the beginning of your next upkeep, pay {3}{U}{U}. If you don't, you lose the game.", R => { rk6Spell(R, cmd('rk6_pactDelay')); });
