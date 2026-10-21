// Spellslinger Duels - rules pack: the Jenova, Ancient Calamity deck (2026-10-21, owner's request: make the whole list playable).
// Wordings only; the engine pieces are in 15i-jenova.js. Uses the cl / clx / cmd / act / SPEC helpers from rules/cmdr.js.
// Sentence-level readings (used inside modal bullets and spells) are in the registerRules call at the end; whole-line readings are the cl() lines.

// ===== Returning cards from graveyards =====
cl(/^When ~ dies, return another target creature card from your graveyard to your hand\.$/, R => { R.trig.push({ ev: 'dies', effects: [{ t: 'regrow', what: 'creature', notSelf: true }] }); });
cl(/^Search your library for a creature card, reveal it, put it into your hand or graveyard, then shuffle\.$/, R => { R.spell = [cmd('dinaGuidance')]; });
cl(/^Return target card from your graveyard to your hand\.$/, R => { R.spell = [{ t: 'regrow', what: 'card' }]; });
cl(/^Return up to six target creature cards with different names from your graveyard to the battlefield\.$/, R => { R.spell = [cmd('beholdSix')]; });
cl(/^Return from your graveyard to the battlefield any number of target creature cards that each have a different mana value 97 or less\.$/, R => { R.spell = [cmd('agadeemX', { n: 97 })]; });
cl(/^Return target creature card from your graveyard to the battlefield\. Then if it isn't your main phase, blight 2\.$/, R => { R.spell = [{ t: 'regrow', what: 'creature', bf: true }, cmd('blightIfNotMain')]; });
cl(/^Each player sacrifices a creature of their choice\. If you sacrificed a creature this way, you may return another permanent card from your graveyard to the battlefield\.$/, R => { R.spell = [cmd('witchKing')]; });
clx('{2}, {T}, Exile ~: Put all commanders you own from the command zone and from your graveyard into your hand. Then shuffle your graveyard into your library.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Exile ~', [cmd('campfire')]); });
clx('{2}, {T}: You gain 5 life. Shuffle ~ and your graveyard into their owner\'s library.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'gain', n: 5 }, cmd('elixir')]); });
cl(/^Choose up to two\. Return those cards from your graveyard to your hand\.$/, (R, m, ctx) => {
    let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++;
    ctx.li = j - 1; R.spell = [cmd('callDamageControl')];
});


// ===== Sacrifice and edicts =====
cl(/^Destroy all creatures with toughness 97 or less\. You lose 97 life\. If 97 is 6 or more, return a creature card put into a graveyard this way to the battlefield under your control\.$/, R => { R.spell = [cmd('zeroPoint', { n: 97 })]; });
cl(/^You may sacrifice a nontoken black creature rather than pay ~'s mana cost\.$/, R => { R.alt = { mana: parseCost(''), sacKind: 'nontoken creature:B', life: 0, exile: null, cond: null, text: 'sacrifice a nontoken black creature' }; });
cl(/^Each opponent sacrifices a creature or planeswalker with the greatest mana value among creatures and planeswalkers they control\.$/, R => { R.spell = [cmd('flareEdict')]; });
cl(/^When ~ enters, you may sacrifice a creature or planeswalker\. When you do, each opponent sacrifices a creature of their choice\.$/, R => { R.etb.push(cmd('winterEtb')); });
cl(/^~ gets \+1\/\+0 for each creature and planeswalker card in your graveyard\.$/, R => { R.cdaAdd = { p: 1, q: 0, what: 'the number of creature and planeswalker cards in your graveyard' }; });
cl(/^When ~ enters, each player sacrifices half the non-God creatures they control of their choice, rounded down\.$/, R => { R.etb.push(cmd('zodiarEtb')); });
cl(/^Whenever a player sacrifices another creature, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'sacrificed', fn: 'otherCreatureSacrificed', effects: [cmd('selfCounter')] }); });
cl(/^When ~ enters, you may sacrifice another creature you control\. If you do, create a number of Treasure tokens equal to that creature's power\.$/, R => { R.etb.push(cmd('technoEtb')); });
clx('{2}{B}, Sacrifice X artifacts: Return target creature card with power X or less from your graveyard to the battlefield. X can\'t be 0.', (R, m, ctx) => { act(R, ctx.line, '{2}{B}', [cmd('technoReturn')], a => { a.onlyIf = 'you control an artifact'; }); });
cl(/^X can't be 0\.$/, () => {});
clx('{1}, Sacrifice another creature: Draw cards equal to the sacrificed creature\'s power, then discard a card.', (R, m, ctx) => { act(R, ctx.line, '{1}, Sacrifice another creature', [cmd('tbwDraw')]); });
cl(/^When ~ die, if they were a creature, return them to the battlefield\. They're an artifact\.$/, R => { R.trig.push({ ev: 'dies', effects: [cmd('tbwReturn')] }); });
cl(/^If a creature an opponent controls would die, exile it instead\.$/, R => { R.exileFoeDies = true; });
clx('+2: Up to one target creature gets -4/-1 until your next turn.', R => { R.acts.push({ loyalty: 2, effects: [cmd('garrukMinus', { target: 'creature', optional: true, theirs: true, good: false })], text: '+2: Up to one target creature gets -4/-1 until your next turn.' }); });
clx('−2: Each player sacrifices a creature of their choice. If you sacrificed a creature this way, create a 4/4 green Beast creature token with trample.', R => { R.acts.push({ loyalty: -2, effects: [cmd('garrukSac')], text: '−2: Each player sacrifices a creature of their choice. If you sacrificed a creature this way, create a 4/4 green Beast creature token with trample.' }); });
clx('−3: Each opponent discards two cards. For each opponent who didn\'t discard two nonland cards this way, you draw a card.', R => { R.acts.push({ loyalty: -3, effects: [cmd('garrukDiscard')], text: '−3: Each opponent discards two cards. For each opponent who didn\'t discard two nonland cards this way, you draw a card.' }); });
// ===== Combat tricks and small pieces =====
cl(/^Until end of turn, target creature you control gains indestructible and "Whenever ~ is dealt damage, put that many \+1\/\+1 counters on it\."$/, R => { R.spell = [cmd('strengthOfWill', { target: 'creature', mine: true, good: true })]; });
cl(/^Until end of turn, target creature gets \+1\/\+0 and gains "When ~ dies, put a number of \+1\/\+1 counters equal to its power on up to one target creature\."$/, R => { R.spell = [cmd('galufsAct', { target: 'creature', good: true })]; });
clx('{2}, {T}, Sacrifice ~: Search your library for up to two basic land cards, reveal them, put one onto the battlefield tapped and the other into your hand, then shuffle.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Sacrifice ~', [cmd('troopPonies')]); });
cl(/^Whenever you cycle or discard another card, put a -1\/-1 counter on each creature your opponents control\.$/, R => { R.trig.push({ ev: 'discarded', fn: 'archfiendDiscard', effects: [cmd('archfiendCounters')] }); });
cl(/^As long as there are fewer than eight cards in your graveyard, ~ isn't a creature\.$/, R => { (R.selfCond = R.selfCond || []).push({ cond: 'there are fewer than eight cards in your graveyard', notCreature: true, p: 0, q: 0, kw: [] }); });
clx('{T}, Mill a card: Target player adds one mana of any color.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('triadMana')], a => { a.manaLike = true; }); });

// ===== Mutants, counters and the TMNT / X-Men crew =====
cl(/^At the beginning of combat on your turn, put a number of \+1\/\+1 counters equal to ~'s power on up to one other target creature\. That creature becomes a Mutant in addition to its other types\.$/, R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('jenovaCombat')] }); });
cl(/^Whenever a Mutant you control dies during your turn, you draw cards equal to its power\.$/, R => { R.trig.push({ ev: 'creatureDies', fn: 'mutantDiesMyTurn', effects: [cmd('jenovaDraw')] }); });
cl(/^Whenever another Mutant you control enters, put a \+1\/\+1 counter on that creature and a \+1\/\+1 counter on ~\.$/, R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature', sub: 'Mutant' }, { effects: [cmd('x23')] })); });
cl(/^Whenever a Mutant you control attacks, double its power until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'mutantAttacks', effects: [cmd('doubleMutants')] }); });
cl(/^You may have ~ assign his combat damage as though he weren't blocked\.$/, R => { R.assignUnblocked = true; R.trig.push({ ev: 'blocked', effects: [cmd('wolverineAsk')] }); });
cl(/^Partner—Character select$/, () => {});
cl(/^Raid\s+— At the beginning of your second main phase, if you attacked this turn, put a \+1\/\+1 counter on target creature and create a Food token\.$/, R => { R.trig.push({ ev: 'main2', fn: 'raidMain2', effects: [cmd('michelangeloRaid', { target: 'creature', good: true })] }); });
cl(/^Whenever a player casts a creature spell, you create a Mutagen token\.$/, R => { R.trig.push({ ev: 'cast', who: 'any', filter: 'creature', effects: [{ t: 'artToken', kind: 'mutagen', n: 1 }] }); });
cl(/^Whenever ~ or another nontoken creature you control leaves the battlefield, create a Mutagen token\.$/, R => { R.trig.push({ ev: 'leaves', effects: [{ t: 'artToken', kind: 'mutagen', n: 1 }] }); R.trig.push(SPEC('leaves', { another: true, type: 'Creature', nontoken: true }, { effects: [{ t: 'artToken', kind: 'mutagen', n: 1 }] })); });
cl(/^Whenever another permanent leaves the battlefield, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push(SPEC('leaves', { another: true, ctl: 'any' }, { effects: [cmd('selfCounter')] })); });
cl(/^Whenever a creature you control deals combat damage to a player, put a \+1\/\+1 counter on that creature\.$/, R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, effects: [cmd('sphereCounter')] }); });
cl(/^(?:Unlock Ability\s+— )?Creatures you control with \+1\/\+1 counters on them have reach and trample\.$/, R => { R.statics.push({ fn: 'hasCounters', p: 0, q: 0, kw: ['reach', 'trample'] }); });
cl(/^If you would put one or more counters on a permanent you control, put that many plus one of each of those kinds of counters on that permanent instead\.$/, R => { R.counterBonus = ['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker']; });
cl(/^Whenever another nontoken creature you control enters, it endures X, where X is the number of counters on ~\.$/, R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature', nontoken: true }, { effects: [cmd('endureEntered')] })); });
cl(/^Increment$/, R => { R.trig.push({ ev: 'cast', fn: 'incrementCast', filter: 'any', effects: [cmd('selfCounter')] }); });
cl(/^Affinity for creatures$/, R => { R.affinityOf = 'Creature'; });
cl(/^Instant and sorcery spells you cast have affinity for creatures\.$/, R => { R.reducer = { what: 'Instant and sorcery', n: 0, affinity: 'Creature' }; });
// ===== Prepared creatures and Sephiroth =====
cl(/^~ enters prepared\.$/, R => { R.etb.push(cmd('prepare')); });
cl(/^At the beginning of your end step, if two or more creatures died this turn, ~ becomes prepared\.$/, R => { R.trig.push({ ev: 'end', who: 'your', fn: 'twoDied', effects: [cmd('prepare')] }); });
cl(/^Whenever another creature dies, target opponent loses 1 life and you gain 1 life\. If this is the fourth time this ability has resolved this turn, transform ~\.$/, R => { R.trig.push({ ev: 'creatureDies', fn: 'otherCreatureDies', effects: [cmd('sephirothDies')] }); });

cl(/^As ~ transforms into ~, you get an emblem with "Whenever a creature dies, target opponent loses 1 life and you gain 1 life\."$/, () => {});
cl(/^Whenever ~ attacks, you may sacrifice any number of other creatures\. If you do, draw that many cards\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('sephirothAttack')] }); });

registerRules({
    name: 'jenova',
    effects: [
        // Archenemy's Charm bullets, Desperate Plea bullets
        [/^return one or two target creature and\/or planeswalker cards from your graveyard to your hand$/, () => ({ t: 'regrow', what: 'creature or planeswalker', count: 2 })],
        [/^return target creature card from your graveyard to the battlefield if its power is less than or equal to the sacrificed creature's power$/, () => ({ t: 'cmd', id: 'pleaReturn' })],
        [/^return another target creature card from your graveyard to your hand$/, () => ({ t: 'regrow', what: 'creature', notSelf: true })]
    ],
    triggers: [],
    lines: []
});
