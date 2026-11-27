// Spellslinger Duels - rules pack rk5 (2026-11-27 card round: the most-played cards the game did not fully read).
// Wordings only; engine pieces are in 15zm-rk5.js (CMD ids start with rk5_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
// Targets use filters 'rk5:<name>' (RK5F in 15zm-rk5.js, read by permMatches / stackMatches wrappers).

// ---- modal bullets and single sentences ----
registerRules({
    name: 'rk5',
    effects: [
        [/^each opponent sacrifices a nontoken creature$/i, () => cmd('rk5_edict', { kind: 'nontoken' })],
        [/^each opponent sacrifices a creature token$/i, () => cmd('rk5_edict', { kind: 'token' })],
        [/^each opponent sacrifices a planeswalker$/i, () => cmd('rk5_edict', { kind: 'planeswalker' })],
        [/^counter target spell with mana value less than or equal to the number of cards in its controller's graveyard$/i, () => ({ t: 'counter', target: 'spell', filter: 'rk5:mvLeGy' })],
        [/^destroy target creature with mana value less than or equal to the number of cards in its controller's graveyard$/i, () => ({ t: 'destroy', target: 'perm', filter: 'rk5:creatureMvLeGy', good: false })]
    ]
});

// ===== simple statics and triggers =====
clx('Spells cost {1} less to cast.', R => { R.rk5Helm = 1; });
clx('Equipped creature has flying and ward {4}.', R => { R.buff = { p: 0, q: 0, kw: ['flying', 'ward:4'] }; });
clx('Creatures you control with +1/+1 counters on them can\'t be blocked.', R => { R.rk5CounterUnblock = true; });
clx('Whenever a creature you control deals combat damage to an opponent, you may draw a card.', R => { R.trig.push({ ev: 'hitPlayer', fn: 'myCreatureHit', effects: [{ t: 'draw', n: 1, may: true }] }); });
clx('Whenever an opponent casts a noncreature spell, ~ deals damage equal to its power to that player.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', who: 'opp', effects: [cmd('rk5_arsonist')] }); });
clx('Whenever an opponent casts a spell, that player loses 5 life unless they discard a card.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'opp', effects: [cmd('rk5_quandary')] }); });
clx('Whenever a player casts a spell, if no mana was spent to cast it, counter that spell.', R => { R.trig.push({ ev: 'cast', filter: 'any', who: 'any', fn: 'rk5_noMana', effects: [cmd('rk5_counterCast')] }); });
clx('Whenever an opponent discards a creature card, create a 2/2 black Zombie creature token.', R => { R.trig.push({ ev: 'discarded', fn: 'rk5_oppDiscCreature', effects: [{ t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: [] }] }); });
clx('Whenever an opponent discards a land card, add {B}{B}.', R => { R.trig.push({ ev: 'discarded', fn: 'rk5_oppDiscLand', effects: [cmd('rk5_wasteMana')] }); });
clx('Whenever an opponent discards a noncreature, nonland card, draw a card.', R => { R.trig.push({ ev: 'discarded', fn: 'rk5_oppDiscOther', effects: [{ t: 'draw', n: 1 }] }); });
clx('Whenever you discard a card, choose one that hasn\'t been chosen this turn —', R => { R.trig.push({ ev: 'discarded', fn: 'rk5_myDisc', effects: [cmd('rk5_monument')] }); });
clx('• Draw a card.', R => { /* read by Monument to Endurance's trigger */ });
clx('• Create a Treasure token.', R => { });
clx('• Each opponent loses 3 life.', R => { });
clx('Whenever equipped creature attacks, double its power until end of turn.', R => { R.trig.push({ ev: 'attacks', host: true, effects: [cmd('rk5_axe')] }); });
clx('Whenever one or more Ninja or Rogue creatures you control deal combat damage to a player, create a Treasure token.', R => { R.trig.push({ ev: 'combatHitAny', fn: 'rk5_ninjaHit', effects: [{ t: 'artToken', kind: 'treasure', n: 1 }] }); });
clx('Ninjutsu abilities you activate cost {1} less to activate.', R => { R.rk5NinjaCut = 1; });
clx('Other Ninja and Rogue creatures you control get +1/+1.', R => { R.statics.push({ other: true, fn: 'rk5_ninjaRogue', p: 1, q: 1, kw: [] }); });
clx('Whenever ~ is dealt damage, create that many 1/1 green Insect creature tokens with flying and deathtouch.', R => { R.trig.push({ ev: 'dealtDamage', effects: [cmd('rk5_hornet')] }); });
clx('Whenever ~ attacks, destroy target artifact or enchantment defending player controls.', R => { R.trig.push({ ev: 'attacks', effects: [{ t: 'cmd', id: 'rk5_destroyTarget', target: 'perm', filter: 'rk5:artEnchTheirs', good: false }] }); });
clx('{1}{G}: Return target Human you control to its owner\'s hand. ~ gains indestructible until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}{G}', [{ t: 'cmd', id: 'rk5_koglaBounce', target: 'perm', filter: 'rk5:myHuman', mine: true, good: true }]); });
clx('When ~ enters, you may search your library for a creature card with toughness 2 or less, reveal it, put it into your hand, then shuffle.', R => { R.etb.push(cmd('rk5_recruiter')); });
clx('When ~ enters, you may search your library for an artifact card with mana value 1 or less, reveal that card, put it into your hand, then shuffle.', R => { R.etb.push(cmd('rk5_trinket')); });
clx('When ~ enters, reveal the top card of your library. If it\'s a land card, put it onto the battlefield. Otherwise, put that card into your hand.', R => { R.etb.push(cmd('rk5_coiling')); });
clx('When ~ enters, you may exile target non-Angel creature you control, then return that card to the battlefield under your control.', R => { R.etb.push(cmd('rk5_resto')); });
clx('Exile any number of target creatures you control. Return those cards to the battlefield under their owner\'s control at the beginning of the next end step.', R => { R.spell = [cmd('rk5_eerie')]; });
clx('Destroy target enchantment. Create X 1/1 green Saproling creature tokens, where X is that enchantment\'s mana value.', R => { R.spell = [{ t: 'cmd', id: 'rk5_auraMutation', target: 'perm', filter: 'enchantment', good: false }]; });
clx('Whenever a source deals damage to ~, that source\'s controller sacrifices that many permanents of their choice.', R => { R.trig.push({ ev: 'dealtDamage', effects: [cmd('rk5_obliterator')] }); });
clx('Whenever a Dragon you control is dealt damage, it deals that much damage to any target that isn\'t a Dragon.', R => { R.trig.push({ ev: 'dealtDamage', fn: 'rk5_myDragonHurt', effects: [cmd('rk5_wrathfulDragon')] }); });
clx('As long as there are four or more card types among cards in your graveyard, ~ gets +2/+2, has flying, and attacks each combat if able.', R => { selfCond(R, { cond: 'there are four or more card types among cards in your graveyard', p: 2, q: 2, kw: ['flying'] }); R.rk5Drc = true; });
clx('If you control a creature with power 4 or greater, counter that spell instead.', R => { R.spell = [{ t: 'cmd', id: 'rk5_stubborn', target: 'spell', filter: 'noncreature', good: false }]; });
