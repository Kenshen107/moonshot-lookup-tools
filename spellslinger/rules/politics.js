// Spellslinger Duels - rules pack: group hug, kingmaking (donating permanents, goad) and poison cards (2026-10-20, owner: "group hug and kingmaking and anything
// that could happen in real life ... toxic and infect"). Chosen from tests/theme_sweep.js: the unread sentences that kept the most group-hug, politics and
// poison cards from being Automated. Wordings only; the engine pieces are in 15h-politics.js. Uses the cl / cmd / SPEC / mite helpers from rules/cmdr.js.
const TEMPT = '(?:Tempting offer — )?';
const trx = body => new RegExp('^' + TEMPT + body + '$');
// ---- Group hug ----
cl(/^Each player may draw up to two cards\. For each card less than two a player draws this way, that player gains 2 life\.$/, R => { R.spell = [cmd('truce')]; });
cl(/^Each player may play an additional land on each of their turns\.$/, R => { R.extraLandAll = 1; });
cl(/^Whenever a player taps a land for mana, that player adds one mana of any type that land produced\.$/, R => { R.landDoubleAll = true; });
cl(/^Whenever a player plays a land, that player draws a card\.$/, R => { R.trig.push({ ev: 'landfall', fn: 'anyLandPlayed', effects: [cmd('landOwnerDraws')] }); });
cl(/^Whenever a player casts their first multicolored spell each turn, each other player draws a card\.$/, R => { R.trig.push({ ev: 'cast', who: 'any', filter: 'any', fn: 'firstMulti', effects: [cmd('othersDrawCaster')] }); });
cl(trx('Search your library for a land card and put it onto the battlefield\\. Each opponent may search their library for a land card and put it onto the battlefield\\. For each opponent who searches a library this way, search your library for a land card and put it onto the battlefield\\. Then each player who searched a library this way shuffles\\.'), R => { R.spell = [cmd('tempt', { kind: 'discovery' })]; });
cl(trx('Draw a card and create a 1\\/1 white Rabbit creature token\\. Then each opponent may draw a card and create a 1\\/1 white Rabbit creature token\\. For each opponent who does, you draw a card and you create a 1\\/1 white Rabbit creature token\\.'), R => { R.spell = [cmd('tempt', { kind: 'bunnies' })]; });
cl(trx('Put a \\+1\\/\\+1 counter on each creature you control\\. Each opponent may put a \\+1\\/\\+1 counter on each creature they control\\. For each opponent who does, put a \\+1\\/\\+1 counter on each creature you control\\.'), R => { R.spell = [cmd('tempt', { kind: 'glory' })]; });
cl(trx('Return a creature card from your graveyard to the battlefield\\. Each opponent may return a creature card from their graveyard to the battlefield\\. For each opponent who does, return a creature card from your graveyard to the battlefield\\.'), R => { R.spell = [cmd('tempt', { kind: 'immortality' })]; });
// ---- Kingmaking: giving permanents away ----
cl(/^Target opponent gains control of target permanent you control\.$/, R => { R.spell = [cmd('donate', { target: 'perm', filter: 'permanent you control', opp: true, good: true })]; });
cl(/^Target player gains control of target permanent you control\.$/, R => { R.spell = [cmd('donate', { target: 'perm', filter: 'permanent you control', good: true })]; });
cl(/^Target opponent gains control of target creature\.$/, R => { R.spell = [cmd('donate', { target: 'creature', mine: true, opp: true, good: true })]; });
cl(/^At the beginning of your upkeep, you gain X life and draw X cards, where X is the number of permanents you own that your opponents control\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('zedruuUpkeep')] }); });
cl(/^\{U\}\{R\}\{W\}: Target opponent gains control of target permanent you control\.$/, (R, m, ctx) => { const a = parseActivated('{U}{R}{W}: Draw a card.', R); a.effects = [cmd('donate', { target: 'perm', filter: 'permanent you control', opp: true, good: true })]; a.text = ctx.line; R.acts.push(a); });
cl(/^\{T\}: Target player gains control of target artifact, creature, or land you control\.$/, (R, m, ctx) => { const a = parseActivated('{T}: Draw a card.', R); a.effects = [cmd('donate', { target: 'perm', filter: 'artifact, creature, or land you control', good: true })]; a.text = ctx.line; R.acts.push(a); });
cl(/^\{T\}: Draw two cards\. Target opponent gains control of (?:this creature|~)\. Activate only during your turn\.$/, (R, m, ctx) => { const a = parseActivated('{T}: Draw a card.', R); a.effects = [cmd('defectorDraw')]; a.yourTurn = true; a.text = ctx.line; R.acts.push(a); });
cl(/^Sacrifice a creature: Target opponent gains control of (?:this artifact|~)\.(?: \(This effect lasts indefinitely\.\))?$/, (R, m, ctx) => { const a = parseActivated('Sacrifice a creature: Draw a card.', R); a.effects = [cmd('donateSelf')]; a.text = ctx.line; R.acts.push(a); });
cl(/^Whenever a nontoken permanent is put into your graveyard from the battlefield, (?:this artifact|~) deals 1 damage to you\.$/, R => { R.trig.push({ ev: 'toGy', fn: 'ownNontokenToGy', effects: [cmd('jinxedRingHurts')] }); });
// ---- Goad ----
cl(/^Goad all creatures you don't control\.$/, R => { R.spell = [cmd('goadAllTheirs')]; });
cl(/^Whenever (?:this creature|~) attacks, you may goad target creature defending player controls\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [{ t: 'cmd', id: 'goadTarget', target: 'creature', theirs: true, optional: true, good: false }] }); });
cl(/^Whenever (?:this creature|~) enters or attacks, goad target creature\.$/, R => { R.etb.push({ t: 'cmd', id: 'goadTarget', target: 'creature', theirs: true, good: false }); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [{ t: 'cmd', id: 'goadTarget', target: 'creature', theirs: true, good: false }] }); });
cl(/^Whenever a goaded creature attacks, it deals 1 damage to its controller\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'goadedAttacks', effects: [cmd('goadedHurt')] }); });
cl(/^At the beginning of your end step, each player may put two \+1\/\+1 counters on a creature they control\. Goad each creature that had counters put on it this way\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('agitatorEnd')] }); });
// ---- Poison ----
cl(/^Whenever (?:this creature|~) attacks and isn't blocked, defending player gets a poison counter\.$/, R => { R.trig.push({ ev: 'unblocked', fn: 'selfUnblocked', effects: [cmd('poisonDefender')] }); });
cl(/^Whenever (?:this creature|~) deals combat damage to a player or planeswalker, proliferate\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [{ t: 'proliferate' }] }); });
cl(/^When (?:this creature|~) dies, create a 1\/1 colorless Phyrexian Mite artifact creature token with toxic 1 and "(?:This token|~) can't block\."$/, R => { R.trig.push({ ev: 'dies', effects: [mite(1)] }); });
registerRules({
    name: 'politics',
    effects: [
        [/^that player draws two additional cards$/, () => ({ t: 'activeDraws', n: 2 })],
        [/^each player draws a card and loses (\d+) life$/, m => [{ t: 'drawAll', n: 1 }, cmd('allLose', { n: +m[1] })]]
    ],
    triggers: [], lines: []
});
