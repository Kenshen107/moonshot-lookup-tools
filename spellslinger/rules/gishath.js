// Spellslinger Duels - rules pack: the Gishath, Sun's Avatar deck (2026-10-15, owner's request: make the whole list playable).
// Wordings only; the engine pieces are in 15e-gishath.js. Uses the cl / cmd / SPEC helpers from rules/cmdr.js.
cl(/^Whenever ~ deals combat damage to a player, reveal that many cards from the top of your library\. Put any number of Dinosaur creature cards from among them onto the battlefield and the rest on the bottom of your library in a random order\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('gishath')] }); });
cl(/^Players can't gain life\.$/, R => { R.noLifeGain = true; });
cl(/^Put a \+1\/\+1 counter on target creature you control\. It gains protection from the color of your choice until end of turn\.$/, R => { R.spell = [cmd('feat', { target: 'creature', good: true, mine: true })]; });
cl(/^Whenever a player casts a spell, if it's not their turn, ~ deals 4 damage to them\.$/, R => { R.trig.push({ ev: 'cast', fn: 'notTheirTurn', filter: 'any', who: 'any', effects: [cmd('scytheclaw')] }); });
cl(/^When ~ enters, it deals 3 damage to target opponent or planeswalker and 3 damage to up to one target creature\.$/, R => { R.etb.push(cmd('burningSun')); });
cl(/^Put all creatures on the bottom of their owners' libraries\.$/, R => { R.spell = [cmd('terminus')]; });
cl(/^Miracle ((?:\{[^}]+\})+)$/, (R, m) => { R.miracle = parseCost(m[1]); });
cl(/^When ~ enters, if you cast it from your hand, destroy all non-Dinosaur creatures\.$/, R => { R.etb.push(cmd('wakeningSun', { cond: 'you cast it from your hand' })); });
cl(/^Whenever you tap a land for mana while you're the monarch, add an additional one mana of any color\.$/, R => { R.monarchMana = true; });
cl(/^Whenever another creature you control enters, ~ deals 2 damage to it\. If a Dinosaur is dealt damage this way, ~ gets \+2\/\+0 until end of turn\.$/, R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature' }, { effects: [cmd('maraudRaptor')] })); });
cl(/^As an additional cost to cast (?:~|this spell), sacrifice a creature\.$/, R => { R.addCost = { sac: 'creature' }; });
cl(/^Search your library for a creature card with mana value X or less, where X is 2 plus the sacrificed creature's mana value\. Put that card onto the battlefield, then shuffle\. Exile ~\.$/, R => { R.spell = [cmd('eldritchEvo'), { t: 'exileSelf' }]; });
cl(/^If you tap a basic land for mana, it produces three times as much of that mana instead\.$/, R => { R.tripleBasic = true; });
cl(/^Harmonize ((?:\{[^}]+\})+)$/, (R, m) => { R.flashback = parseCost(m[1]); R.harmonize = true; });
cl(/^Counter target spell that targets a permanent you control\.$/, R => { R.spell = [{ t: 'counter', target: 'spell', filter: 'targetsMine' }]; });
cl(/^When ~ enters, if you cast it, untap all lands you control\.$/, R => { R.etb.push(cmd('untapLands', { cond: '~ was cast' })); });
cl(/^Destroy all tapped creatures\. Until your next turn, whenever a creature becomes tapped, destroy it\.$/, R => { R.spell = [cmd('dontMove')]; });
cl(/^Whenever one or more nontoken creatures you control die, create a green Fungus Dinosaur creature token with base power and toughness each equal to the total power of those creatures\.$/, R => { R.trig.push({ ev: 'dies', fn: 'nexusDies', effects: [cmd('nexusToken')] }); });
cl(/^\{2\}, \{T\}: Double target creature's power until end of turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'cmd', id: 'doublePower', target: 'creature', good: true }]); });
cl(/^When you cycle ~, put a trample counter on target creature you control\.$/, R => { R.cycleTrig = [cmd('trampleCounter', { target: 'creature', good: true, mine: true })]; });
cl(/^At the beginning of your upkeep, exile the top two cards of your library\. You may play them this turn\. If you exiled a land card this way, create a 3\/1 red Dinosaur creature token\. If you exiled a nonland card this way, create a Treasure token\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('bonehoard')] }); });
cl(/^Whenever ~ or another Dinosaur you control enters, you may discover X, where X is that creature's toughness\. Do this only once each turn\.$/, R => { R.trig.push(SPEC('enters', { type: 'Creature', sub: 'Dinosaur' }, { once: 'pantlaza', effects: [cmd('pantlaza')] })); });
cl(/^When ~ enters, each player exiles cards from the top of their library until they exile a nonland card\. You may cast any number of spells from among the nonland cards exiled this way without paying their mana costs\.$/, R => { R.etb.push(cmd('etaliConq')); });
cl(/^As an additional cost to cast (?:~|this spell), sacrifice a creature with power 4 or greater\.$/, R => { R.addCost = { sac: 'creature with power 4 or greater' }; });
cl(/^Search your library for a Dinosaur creature card, put it onto the battlefield, then shuffle\. It gains indestructible until your next turn\.$/, R => { R.spell = [cmd('savageOrder')]; });
cl(/^When ~ enters, put any number of creature cards from your hand onto the battlefield\.$/, R => { R.etb.push(cmd('ghaltaPut')); });
cl(/^If a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time\.$/, R => { R.throne = true; });

// Ghalta and Mavren: "Whenever you attack, choose one -" is read by the generic modal-trigger block in rulesFor; these give it a trigger and the two modes.
registerRules({
    name: 'gishath',
    effects: [
        [/^create a tapped and attacking X\/X green Dinosaur creature token with trample, where X is the greatest power among other attacking creatures$/i, () => cmd('mavrenDino')],
        [/^create X 1\/1 white Vampire creature tokens with lifelink, where X is the number of other attacking creatures$/i, () => cmd('mavrenVamp')]
    ],
    triggers: [
        [/^Whenever you attack, (.+)$/, () => ({ ev: 'attacks', fn: 'youAttack' })]
    ],
    lines: []
});
