// Spellslinger Duels - rules pack rk4 (2026-11-27 card round: the most-played cards the game did not fully read).
// Wordings only; engine pieces are in 15zm-rk4.js (CMD ids start with rk4_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
// "Choose one —" cards whose bullets are read as sentence effects by the reader's own modal machinery (registerRules below)
CMD_REWRITES.push([/Put a \+1\/\+1 counter on target creature you control\. It deals damage equal to its power to target creature you don't control\./g, '§rk4Archdruid.']);
CMD_REWRITES.push([/Search your library for a creature or land card and reveal it\. Put it onto the battlefield tapped if it's a land card\. Otherwise, put it into your hand\. Then shuffle\./g, '§rk4ArchSearch.']);
CMD_REWRITES.push([/Choose a creature you control\. It gains indestructible until end of turn\./g, '§rk4ChooseIndestr.']);
CMD_REWRITES.push([/Untap target creature\. Until end of turn, it gains reach, hexproof, and "Whenever ~ becomes tapped, it deals damage equal to its power to up to one target creature\."/g, '§rk4Legolas.']);
CMD_REWRITES.push([/When you cast your next instant or sorcery spell this turn, copy that spell\. You may choose new targets for the copy\./g, '§rk4Twin.']);
CMD_REWRITES.push([/Untap all creatures you control\. After this phase, there is an additional combat phase\./g, '§rk4ExtraCombat.']);
CMD_REWRITES.push([/Destroy all creatures\. For each nontoken creature destroyed this way, you create a tapped Treasure token\./g, '§rk4BloodMoney.']);
CMD_REWRITES.push([/Double target player's life total\. Shuffle ~ into its owner's library\./g, '§rk4Beacon.']);
CMD_REWRITES.push([/Search your library for a creature card with mana value equal to 1 plus the sacrificed creature's mana value, put that card onto the battlefield with an additional \+1\/\+1 counter on it, then shuffle\./g, '§rk4Neoform.']);
registerRules({
    name: 'rk4',
    effects: [
        [/^§rk4Archdruid$/, () => cmd('rk4_archdruid')],
        [/^§rk4ArchSearch$/, () => cmd('rk4_archSearch')],
        [/^§rk4ChooseIndestr$/, () => cmd('rk4_chooseIndestr')],
        [/^§rk4Legolas$/, () => cmd('rk4_legolas', { target: 'creature' })],
        [/^exile target artifact or enchantment$/i, () => ({ t: 'exile', target: 'perm', filter: 'artifact or enchantment', good: false })],
        [/^all creatures lose all abilities until end of turn$/i, () => cmd('rk4_loseAbilities')],
        [/^regenerate target creature$/i, () => ({ t: 'regenTarget', target: 'creature' })],
        [/^counter target spell that targets you$/i, () => ({ t: 'counter', target: 'spell', filter: 'rk4_targetsMe', good: false })],
        [/^target creature you control gains double strike until end of turn$/i, () => ({ t: 'pump', p: 0, q: 0, kw: ['double strike'], target: 'creature', mine: true })],
        [/^§rk4Twin$/, () => cmd('rk4_twinfernoCopy')],
        [/^creatures you control gain double strike until end of turn$/i, () => cmd('rk4_teamDS')],
        [/^§rk4ExtraCombat$/, () => cmd('extraCombatUntap')],
        [/^draw a card, then discard a card$/i, () => ({ t: 'loot', n: 1, d: 1 })],
        [/^put a \+1\/\+1 counter on that creature$/i, () => cmd('rk4_pipCounter')],
        [/^untap up to two target lands$/i, () => cmd('rk4_untapTwoLands')],
        [/^double target creature's power until end of turn$/i, () => ({ t: 'doublePow', target: 'creature' })],
        [/^double the power of target creature until end of turn$/i, () => ({ t: 'doublePow', target: 'creature' })],
        [/^return each creature without a \+1\/\+1 counter on it to its owner's hand$/i, () => cmd('rk4_waveGoodbye')],
        [/^each player discards all the cards in their hand, then draws that many cards minus one$/i, () => cmd('rk4_darkDeal')],
        [/^§rk4BloodMoney$/, () => cmd('rk4_bloodMoney')],
        [/^each opponent sacrifices a creature or planeswalker of their choice and gets a poison counter$/i, () => cmd('rk4_vraskaFall')],
        [/^search your library for an instant card or a card with flash, reveal it, put it into your hand, then shuffle$/i, () => ({ t: 'tutor', what: 'instant or flash' })],
        [/^each non-vampire creature gets -x\/-x until end of turn, where x is the number of vampires you control$/i, () => cmd('rk4_olivia')],
        [/^§rk4Beacon$/, () => cmd('rk4_beacon', { target: 'player' })],
        [/^for each attacking creature, its owner puts it on their choice of the top or bottom of their library$/i, () => cmd('rk4_aetherspouts')],
        [/^~ deals damage equal to the number of creatures you control to target creature or planeswalker$/i, () => cmd('rk4_kabira', { target: 'creature', good: false })],
        [/^return target nonlegendary creature card from your graveyard to the battlefield with a -1\/-1 counter on it$/i, () => ({ t: 'regrow', what: 'nonlegendary creature', bf: true, rk4Minus: true })],
        [/^§rk4Neoform$/, () => cmd('rk4_neoform')]
    ]
});

// ===== Round 1 =====
clx('When ~ enters and whenever an opponent draws a card except the first one they draw in each of their draw steps, ~ deals 1 damage to any target. Then amass Orcs 1.', R => { const fx = () => [{ t: 'dmg', n: 1, target: 'any', good: false }, { t: 'amass', n: 1, type: 'Orc' }]; fx().forEach(e => R.etb.push(e)); R.trig.push({ ev: 'draw', fn: 'rk4_oppDrawExtra', effects: fx() }); });
clx('{U}, {T}: The next spell you cast this turn can\'t be countered.', (R, m, ctx) => { act(R, ctx.line, '{U}, {T}', [cmd('rk4_noCounter')]); });
clx('You may pay {B} rather than pay ~\'s mana cost if there are thirteen or more creatures on the battlefield.', R => { R.alt = { mana: parseCost('{B}'), life: 0, exile: null, cond: 'there are thirteen or more creatures on the battlefield', text: 'pay {B} (thirteen or more creatures on the battlefield)' }; });
clx('Each player sacrifices thirteen creatures of their choice.', R => { R.spell = [{ t: 'edictN', n: 13, who: 'each player' }]; });
clx('{1}, {T}, Remove a wish counter from ~: Search your library for a card, put it into your hand, then shuffle. An opponent gains control of ~. Activate only during your turn.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('rk4_wishclaw')], a => { a.cost.removeNamedN = { kind: 'wish', n: 1 }; a.yourTurn = true; }); });
clx('{W}, {T}: You may play the exiled card without paying its mana cost if you attacked with three or more creatures this turn.', (R, m, ctx) => { act(R, ctx.line, '{W}, {T}', [cmd('hideawayPlay', { cond: 'you attacked with three or more creatures this turn' })]); });
clx('Whenever you tap ~ for mana, target opponent creates a 1/1 colorless Spirit creature token.', R => { R.trig.push({ ev: 'tapped', fn: 'rk4_tapMana', effects: [cmd('rk4_orchard')] }); });
clx('Sacrifice ~: Creatures you control gain indestructible until end of turn. The Ring tempts you.', (R, m, ctx) => { act(R, ctx.line, 'Sacrifice ~', [cmd('unbreakableFormation'), cmd('rk4_ring')]); });
clx('Draw cards equal to the greatest toughness among creatures you control, then put any number of creature cards from your hand onto the battlefield.', R => { R.spell = [cmd('rk4_lastMarch')]; });
clx('{T}: Regenerate target Insect, Rat, Spider, or Squirrel.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'regenTarget', target: 'perm', filter: 'types:Insect|Rat|Spider|Squirrel' }]); });
clx('At the beginning of your upkeep, put target creature card from a graveyard onto the battlefield under your control. It\'s a Phyrexian in addition to its other types.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('rk4_portal')] }); });
clx('Whenever a creature an opponent controls enters, you may have that player lose 1 life.', R => { R.trig.push(SPEC('enters', { ctl: 'opp', type: 'Creature' }, { effects: [cmd('rk4_priest')] })); });
clx('Whenever a creature you control without flying dies, return it to the battlefield under its owner\'s control with a flying counter on it.', R => { R.trig.push({ ev: 'creatureDies', fn: 'rk4_broodDies', effects: [cmd('rk4_brood')] }); });
clx('When ~ enters, the Ring tempts you.', R => { R.etb.push(cmd('rk4_ring')); });
clx('{R}, {T}, Sacrifice an artifact: Return target artifact card with mana value 3 or less from your graveyard to the battlefield.', (R, m, ctx) => { act(R, ctx.line, '{R}, {T}', [cmd('rk4_engineer')], a => { a.cost.sacPerm = 'artifact'; }); });
clx('{U}, Sacrifice ~: Counter target spell or ability that targets you or a creature you control.', (R, m, ctx) => { act(R, ctx.line, '{U}, Sacrifice ~', [{ t: 'counter', target: 'spell', filter: 'rk4_targetsMine', good: false }]); });
clx('If one or more tokens would be created, twice that many of those tokens are created instead.', R => { R.tokenDouble = true; R.rk4TokDoubleAll = true; });
clx('If one or more +1/+1 counters would be put on a creature, twice that many +1/+1 counters are put on that creature instead.', R => { R.counterMod = { what: 'creature', plus: 0, times: 2 }; R.rk4CtrDoubleAll = true; });
clx('You may spend mana as though it were mana of any color.', R => { R.rk4AnyColorSpend = true; });
clx('Whenever ~ deals combat damage to a player, it deals that much damage to each creature that player controls.', R => { R.trig.push({ ev: 'hitPlayer', host: false, effects: [cmd('rk4_balefire')] }); });
clx('Whenever you sacrifice an artifact, put a +1/+1 counter on ~ and add {R}.', R => { R.trig.push({ ev: 'sacrificed', sacType: 'Artifact', effects: [cmd('rk4_novelist')] }); });
clx('Cast ~ only during combat on your turn.', R => { R.castCond = 'it is combat on your turn'; });
