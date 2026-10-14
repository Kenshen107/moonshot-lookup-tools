// Spellslinger Duels - rules pack: the Secrets of Strixhaven Commander precons (SOC, 2026-10-15).
// Uses the helpers rules/cmdr.js defines (cl, clx, cmd, SPEC, TOKEN, act, nw, selfCond); the engine pieces are in 15d-cmdr-soc.js.
const sfx = ph => { const F = parseTargetPhrase(ph); if (!F) throw new Error('no target filter for: ' + ph); return 'sf:' + JSON.stringify(F); };
const sfObj = o => 'sf:' + JSON.stringify({ types: [], notTypes: [], colors: [], notColors: [], states: [], notStates: [], kw: [], notKw: [], ctl: null, ...o });
const fxs = txt => parseEffects(txt);
const SPIRIT = n => TOKEN(n, 3, 2, 'red and white Spirit');
const INKLING = n => TOKEN(n, 2, 1, 'white and black Inkling', ['flying']);
const FRACTAL = (n, x) => ({ t: 'cmd', id: 'fractal', n, x });
const PEST = n => ({ t: 'token', n, p: 1, q: 1, name: 'black and green Pest', kw: [], text: 'When this creature dies, you gain 1 life.', dies: 'gain1' });

// ===== Class (levels) =====
cl(/^((?:\{[^}]+\})+): Level (\d)$/, (R, m, ctx) => {
    const n = +m[2];
    const a = parseActivated(`${m[1]}: Draw a card.`, R);
    a.effects = [cmd('levelUp', { lvl: n })]; a.text = `${m[1]}: Level ${n}`; a.sorcery = true; a.levelUp = n; R.acts.push(a);
    const block = [];
    let j = ctx.li + 1;
    while (j < ctx.lines.length && !/^(?:\{[^}]+\})+: Level \d$/.test(ctx.lines[j])) block.push(ctx.lines[j++]);
    ctx.li = j - 1;
    if (!block.length) return;
    const sub = rulesFor({ name: ctx.card.name, type: 'Enchantment — Class', cost: '', text: block.join('\n'), id: `${ctx.card.id}-L${n}`, cmc: 0 });
    sub.trig.forEach(tr => R.trig.push({ ...tr, lvl: n }));
    sub.statics.forEach(s => R.statics.push({ ...s, lvl: n }));
    sub.acts.forEach(a2 => R.acts.push({ ...a2, lvl: n }));
    if (sub.reducer) R.reducer = { ...sub.reducer, lvl: n };
    sub.unhandled.forEach(u => R.unhandled.push(u));
});

// ===== Lorehold =====
cl(/^At the beginning of your first main phase, mill a card, then exile a card from your graveyard at random\. You may play the exiled card this turn\.$/, R => { R.trig.push({ ev: 'main1', effects: [cmd('advRecon')] }); });
cl(/^Spells you cast from anywhere other than your hand cost \{2\} less to cast\.$/, R => { R.reducer = { what: 'notHand', n: 2 }; });
cl(/^Whenever a land an opponent controls enters, if that player controls more lands than you, you may put a land card from your hand onto the battlefield\.$/, R => { R.trig.push({ ev: 'landfall', theirs: true, effects: [cmd('mapLand')] }); });
cl(/^Whenever ~ attacks, each player exiles a card from their graveyard\. When one or more nonland cards are exiled this way, put that many \+1\/\+1 counters on target attacking creature\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('augusta')] }); });
cl(/^Untap all creatures you control during each other player's untap step\.$/, R => { R.untapOthers = 'creatures'; });
cl(/^When ~ enters, if an opponent controls more lands than you, you may search your library for a Plains card and put it onto the battlefield tapped\. Then if an opponent controls more lands than you, repeat this process once\. If you search your library this way, shuffle\.$/, R => { R.etb.push(cmd('claimJumper')); });
cl(/^Whenever ~ attacks, you may pay \{1\} and discard a card\. If you do, draw a card\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('payDiscardDraw')] }); });
cl(/^Whenever you discard one or more nonland cards, you may exile one of them from your graveyard\. If you do, you may cast it this turn\.$/, R => { R.trig.push({ ev: 'discarded', effects: [cmd('exileDiscarded', { play: 'turn', nonland: true, castOnly: true })] }); });
cl(/^Whenever ~ attacks, return up to one target artifact, creature, or non-Aura enchantment card with mana value 3 or less from your graveyard to the battlefield with a finality counter on it\. It's a 1\/1 Spirit creature with flying in addition to its other types\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('excava')] }); });
cl(/^Starting with you, each player votes for past or present\. You mill a card for each past vote, then ~ deals damage to each opponent equal to the total mana value of cards milled this way\. Exile the top card of your library for each present vote\. Until the end of your next turn, you may play the exiled cards\.$/, R => { R.spell = [cmd('fatefulTempest')]; });
cl(/^Whenever ~ attacks, return target nonland permanent card with mana value X or less from your graveyard to the battlefield, where X is ~'s power\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('scalelord')] }); });
cl(/^When ~ enters, any number of other target creatures you control phase out\.$/, R => { R.etb.push(cmd('guardianFaith')); });
cl(/^Whenever another nontoken creature you control dies, exile it\. If you do, create a token that's a copy of that creature, except it's a Spirit in addition to its other types and it has "When ~ leaves the battlefield, return the exiled card to its owner's graveyard\."$/, R => { R.trig.push(SPEC('dies', { another: true, type: 'Creature', nontoken: true }, { effects: [cmd('hofri')] })); });
cl(/^When ~ leaves the battlefield, return the exiled card to its owner's graveyard\.$/, R => { R.trig.push({ ev: 'leaves', effects: [cmd('hofriReturn')] }); });
cl(/^Whenever one or more cards leave your graveyard, ~ becomes prepared\.$/, R => { R.trig.push({ ev: 'gyLeave', effects: [cmd('prepare')] }); });
cl(/^Whenever one or more cards are put into exile from your library and\/or your graveyard, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'exiledOwn', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^\{T\}, Mill a card: Add \{C\}\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'addMana', mana: ['C'] }], a => { a.cost.mill = 1; a.mana = true; }); });
cl(/^\{W\}, \{T\}: Put target card from your graveyard on the bottom of your library\. Activate only if you control two or more white permanents\.$/, (R, m, ctx) => { act(R, ctx.line, '{W}, {T}', [{ t: 'cmd', id: 'gyToBottom', target: 'gycard', good: true }], a => { a.onlyIf = 'you control two or more white permanents'; }); });
cl(/^\{2\}, Exile ~: Shuffle any number of target cards from your graveyard into your library\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, Exile ~', [cmd('shuffleGyBack')]); });
cl(/^When ~ enters, return target nonland permanent card with mana value 3 or less from your graveyard to the battlefield\.$/, R => { R.etb.push({ t: 'regrow', what: 'nonland permanent mv3', bf: true }); });
cl(/^At the beginning of your end step, if a card left your graveyard this turn, draw a card\.$/, R => { R.trig.push({ ev: 'end', who: 'your', cond: 'a card left your graveyard this turn', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever one or more cards leave your graveyard, create a 3\/2 red and white Spirit creature token\.$/, R => { R.trig.push({ ev: 'gyLeave', effects: [SPIRIT(1)] }); });
cl(/^−4: Spirits you control gain double strike and vigilance until end of turn\.$/, R => { R.acts.push({ loyalty: -4, effects: [cmd('spiritsDouble')], text: '−4: Spirits you control gain double strike and vigilance until end of turn.', sorcery: true }); });
cl(/^At the beginning of your end step, exile target noncreature, nonland card from your graveyard\. Create a 3\/2 red and white Spirit creature token\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('quintoriusExile')] }); });
cl(/^\{1\}\{R\}\{W\}, \{T\}, Sacrifice a Spirit: Choose target card exiled with ~\. You may cast that card this turn without paying its mana cost\. If that spell would be put into a graveyard, put it on the bottom of its owner's library instead\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}{R}{W}, {T}', [cmd('quintoriusCast')], a => { a.cost.sacPerm = 'Spirit'; }); });
cl(/^At the beginning of each end step, if a card left your graveyard this turn, create a Treasure token\.$/, R => { R.trig.push({ ev: 'end', who: 'each', cond: 'a card left your graveyard this turn', effects: [{ t: 'artToken', n: 1, kind: 'treasure' }] }); });
cl(/^Once during each of your turns, you may play a land from your graveyard or cast a permanent spell with mana value 3 or less from your graveyard\. If you do, it gains "When ~ is put into a graveyard from the battlefield, exile it and you gain 2 life\."$/, R => { R.serraParagon = true; });
cl(/^When ~ enters, exile up to one target nonland, nontoken permanent you don't control with mana value 4 or less\.$/, R => { R.etb.push({ t: 'cmd', id: 'skyclaveExile', target: 'perm', filter: sfObj({ notTypes: ['Land'], nonToken: true, ctl: 'opp', mvMax: 4 }), optional: true, good: false }); });
cl(/^When ~ leaves the battlefield, the exiled card's owner creates an X\/X blue Illusion creature token, where X is the mana value of the exiled card\.$/, R => { R.trig.push({ ev: 'leaves', effects: [cmd('skyclaveLeaves')] }); });
cl(/^Whenever one or more cards leave your graveyard, put a \+1\/\+1 counter on ~, then you may have ~ become a copy of an artifact or creature card from among those cards until end of turn\.$/, R => { R.trig.push({ ev: 'gyLeave', effects: [{ t: 'counters', n: 1, target: 'self' }, cmd('spiritResilience')] }); });
cl(/^Spirits you control get \+1\/\+1 for each time you've cast your commander from the command zone this game\.$/, R => { R.statics.push({ type: 'Spirit', p: 1, q: 1, kw: [], perCmdCast: 1 }); });
cl(/^Whenever ~ deals combat damage to a player, you may return target creature card with mana value X or less from your graveyard to the battlefield, where X is the amount of damage ~ dealt to that player\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('warsinger')] }); });
cl(/^Return target permanent card with mana value 3 or less from your graveyard to the battlefield\. If ~ was cast from a graveyard, you may copy ~ and may choose a new target for the copy\.$/, R => { R.spell = [{ t: 'regrow', what: 'permanent mv3', bf: true }, cmd('sevinneCopy')]; });
cl(/^Each creature deals damage to itself equal to its power\.$/, R => { R.spell = [cmd('waveOfReckoning')]; });
cl(/^Destroy all creatures\. Then create a 3\/2 red and white Spirit creature token for each nontoken creature you controlled that was destroyed this way\.$/, R => { R.spell = [cmd('ceaselessConflict')]; });

CMD_REWRITES.push(
    [/Look at the top seven cards of your library\. Put any number of nonland permanent cards with total mana value 4 or less from among them onto the battlefield\. Put the rest on the bottom of your library in a random order\./g, '§aoDig.'],
    [/Exile target artifact or creature card from your graveyard\. Create a token that's a copy of it\./g, '§restoreRelic.'],
    [/Until end of turn, any time you could activate a mana ability, you may pay 1 life\. If you do, add \{C\}\./g, '§channel.'],
    [/[Ff]or each opponent, you create a 1\/1 black and green Pest creature token with "When ~ dies, you gain 1 life\."/g, '§pestPerOpp.'],
    [/[Yy]ou may sacrifice a permanent\. If you do, draw two cards\./g, '§charmSacDraw.'],
    [/Remove all counters from target nonland permanent you control\. Draw a card for each counter removed this way\./g, '§removeCountersDraw.'],
    [/[Pp]ut a \+1\/\+1 counter on target creature you control\. Then if that creature has power 7 or greater, ~ becomes prepared\./g, '§bloomsage.']
);
COND_EXTRA.push(
    [/^you've cast an instant or sorcery spell this turn$/, () => P => { const k = (G.castKinds || {})[P.i]; return !!k && k.turn === G.turn && (k.instant + k.sorcery) > 0; }],
    [/^there are three or more artifact and\/or creature cards in your graveyard$/, () => P => P.gy.filter(x => /Artifact|Creature/.test(x.card.type)).length >= 3],
    [/^a player has one or fewer cards in hand$/, () => P => G.players.some(X => !X.out && X.hand.length <= 1)],
    [/^a card left your graveyard this turn$/, () => P => P.gyLeftTurn === G.turn]
);

registerRules({
    name: 'soc',
    effects: [
        [/^~ becomes prepared$/i, () => cmd('prepare')],
        [/^§channel$/, () => cmd('channel')],
        [/^§aoDig$/, () => cmd('aoDig')],
        [/^target player draws a card and loses 1 life$/i, () => ({ t: 'cmd', id: 'drawLose1', target: 'player', good: true })],
        [/^you draw a card and lose 1 life$/i, () => [{ t: 'draw', n: 1 }, { t: 'loseSelf', n: 1 }]],
        [/^§charmSacDraw$/, () => cmd('charmSacDraw')],
        [/^target player mills three cards, then you return a land card from your graveyard to your hand$/i, () => ({ t: 'cmd', id: 'millThenLand', target: 'player', good: false })],
        [/^§pestPerOpp$/, () => cmd('pestPerOpp')],
        [/^create a 0\/1 colorless eldrazi spawn creature token\. it has "sacrifice ~: add \{c\}\."$/i, () => SPAWN(1)],
        [/^exile target monocolored permanent$/i, () => ({ t: 'exile', target: 'perm', filter: 'monocolored permanent', good: false })],
        [/^§restoreRelic$/, () => cmd('restoreRelic')],
        [/^target player draws (?:X|97) cards plus an additional card for each time they've cast a commander from the command zone this game$/i, () => ({ t: 'cmd', id: 'insightDraw', n: 97, target: 'player', good: true })],
        [/^proliferate (?:X|97) times$/i, () => cmd('proliferateX', { n: 97 })],
        [/^return all creature tokens to its owner's hand$/i, () => cmd('bounceAll', { what: 'token' })],
        [/^return all nontoken creatures to its owner's hand$/i, () => cmd('bounceAll', { what: 'nontoken' })],
        [/^§removeCountersDraw$/, () => ({ t: 'cmd', id: 'removeCountersDraw', target: 'perm', filter: 'nonland permanent you control', good: true })],
        [/^§bloomsage$/, () => ({ t: 'cmd', id: 'bloomsage', target: 'creature', mine: true, good: true })],
        [/^put a \+1\/\+1 counter on each of up to (?:x|97) target creatures you control$/i, () => cmd('silkguardCounters', { n: 97 })],
        [/^target creature has base power and toughness (\d+)\/(\d+) until end of turn$/i, m => ({ t: 'setBase', p: +m[1], q: +m[2], kw: [], target: 'creature', good: true })],
        [/^target player shuffles up to three target cards from their graveyard into their library$/i, () => ({ t: 'cmd', id: 'shuffleBack3', target: 'player', good: true })],
        [/^you may put a \+1\/\+1 counter on a creature$/i, () => cmd('zimoneHypothesis')],
        [/^move all counters from target nonland permanent you control onto another target nonland permanent you control$/i, () => ({ t: 'cmd', id: 'moveCounters', target: 'perm', filter: 'nonland permanent you control', good: true })],

        [/^target player creates a treasure token$/i, () => ({ t: 'cmd', id: 'treasureTarget', target: 'player', good: true })],
        [/^~ deals 1 damage to each of one or two targets$/i, () => ({ t: 'cmd', id: 'pingOneOrTwo', target: 'any', good: false })],
        [/^put two \+1\/\+1 counters on each permanent you control that's a creature or vehicle$/i, () => cmd('countersCreaturesVehicles', { n: 2 })],
        [/^each opponent sacrifices a nontoken artifact$/i, () => cmd('oppSacNontokenArtifact')],
        [/^return target artifact or creature card with mana value (\w+) or less from your graveyard to the battlefield$/i, m => ({ t: 'regrow', what: `artifact or creature mv${nw(m[1])}`, bf: true })]
    ],
    triggers: [
        [/^Whenever one or more cards leave your graveyard, (.+)$/, () => ({ ev: 'gyLeave' })]
    ],
    lines: []
});

// ===== Prismari =====
cl(/^At the beginning of combat on your turn, populate\. The token created this way gains haste\. Sacrifice it at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'combat', effects: [cmd('populateHaste')] }); });
cl(/^Whenever you cast an instant or sorcery spell with mana value 5 or greater from your hand, ~ becomes prepared\.$/, R => { R.trig.push({ ev: 'cast', fn: 'cast5Hand', filter: 'instant or sorcery', effects: [cmd('prepare')] }); });
cl(/^~ costs \{1\} less to cast for each instant and sorcery card in your graveyard\.$/, R => { R.costLess = { n: 1, what: 'the number of instant and sorcery cards in your graveyard' }; });
cl(/^For each opponent, create two 3\/3 blue and red Elemental creature tokens with flying that attack that opponent this turn if able\. They gain haste until end of turn\.$/, R => { R.spell = [cmd('furygale')]; });
cl(/^Artifacts you control have "\{T\}: Add one mana of any color\. Spend this mana only to cast an instant or sorcery spell\."$/, R => { R.artifactAnyInstSorc = true; });
cl(/^If a triggered ability of a Shaman or another Wizard you control triggers, that ability triggers an additional time\.$/, R => { R.harmonic = true; });
cl(/^When ~ enters and whenever one or more creature tokens you control deal combat damage to a player, ~ becomes prepared\.$/, R => { R.etb.push(cmd('prepare')); R.trig.push({ ev: 'combatHitAny', fn: 'tokensHit', effects: [cmd('prepare')] }); });
cl(/^Whenever one or more creatures you control deal combat damage to a player, ~ becomes prepared\.$/, R => { R.trig.push({ ev: 'combatHitAny', effects: [cmd('prepare')] }); });
cl(/^Whenever you cast an instant or sorcery spell with mana value 5 or greater, create a token that's a copy of ~\.$/, R => { R.trig.push({ ev: 'cast', fn: 'cast5Any', filter: 'instant or sorcery', effects: [cmd('copyMyself')] }); });
cl(/^\{2\}\{U\}: Creatures named ~ can't be blocked this turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}{U}', [cmd('namedUnblockable')]); });
cl(/^~ deals 4 damage divided as you choose among any number of targets\. Tap two target permanents\. Create a 4\/4 blue and red Elemental creature token\. Draw two cards\.$/, R => { R.spell = [...fxs('~ deals 4 damage divided as you choose among any number of targets'), cmd('tapTwo'), TOKEN(1, 4, 4, 'blue and red Elemental'), { t: 'draw', n: 2 }]; });
cl(/^Whenever you cast a noncreature spell, create an X\/X red Dragon Illusion creature token with flying and haste, where X is the amount of mana spent to cast that spell\. Exile that token at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('hellkiteToken')] }); });
cl(/^Whenever a player casts an instant or sorcery spell that targets only ~, that player copies that spell for each other creature they control that the spell could target\. Each copy targets a different one of those creatures\.$/, R => { R.trig.push({ ev: 'cast', fn: 'mirrorwing', filter: 'instant or sorcery', who: 'any', effects: [cmd('mirrorwing')] }); });
cl(/^Whenever you cast an instant or sorcery spell, ~ becomes a copy of up to one target nonlegendary creature you control until end of turn, except it has myriad\.$/, R => { R.trig.push({ ev: 'cast', filter: 'instant or sorcery', effects: [{ t: 'cmd', id: 'muddle', target: 'perm', filter: sfx('nonlegendary creature you control'), optional: true, good: true }] }); });
cl(/^At the beginning of your upkeep, each player exiles cards from the top of their library until they exile a nonland card\. An opponent chooses a nonland card exiled this way\. You may cast up to two spells from among the other cards exiled this way without paying their mana costs\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('plargg')] }); });
cl(/^Whenever you cast an instant or sorcery spell, create a 1\/1 blue and red Elemental creature token\. If that spell's mana value is 5 or greater, create three of those tokens instead\.$/, R => { R.trig.push({ ev: 'cast', filter: 'instant or sorcery', effects: [cmd('pianist')] }); });
cl(/^Whenever ~ attacks, for each creature token you control that entered this turn, create a tapped and attacking token that's a copy of that token\. At the beginning of the next end step, sacrifice those tokens\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('stormsinger')] }); });
cl(/^Whenever you cast an instant or sorcery spell, ~ gets \+X\/\+0 until end of turn, where X is that spell's mana value\.$/, R => { R.trig.push({ ev: 'cast', filter: 'instant or sorcery', effects: [cmd('bullPump')] }); });
cl(/^Whenever ~ attacks, exile up to one target instant or sorcery card from your graveyard and copy it\. You may cast the copy without paying its mana cost\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('bullAttack')] }); });
cl(/^At the beginning of combat on your turn, create X tokens that are copies of another target creature you control, where X is one plus the number of instant and sorcery spells you've cast this turn\. They gain haste\. Exile them at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'combat', effects: [{ t: 'cmd', id: 'rionya', target: 'creature', mine: true, notSelf: true, good: true }] }); });
cl(/^At the beginning of combat on your turn, if you've cast an instant or sorcery spell this turn, create an X\/X blue and red Elemental creature token with flying and haste, where X is the greatest mana value among instant and sorcery spells you've cast this turn\.$/, R => { R.trig.push({ ev: 'combat', cond: "you've cast an instant or sorcery spell this turn", effects: [cmd('roothaToken')] }); });
cl(/^\{2\}, Return ~ to its owner's hand: Copy target instant or sorcery spell you control\. You may choose new targets for the copy\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, Return ~ to its owner\'s hand', [{ t: 'cmd', id: 'copyMySpell', target: 'spell', filter: 'myInstSorc', good: true }]); });
cl(/^Add \{R\} for each card in target opponent's hand\. Until end of turn, you don't lose this mana as steps and phases end\. Exile ~ with three time counters on it\.$/, R => { R.spell = [{ t: 'cmd', id: 'rousingRefrain', target: 'player', oppOnly: true, good: false }]; });
cl(/^Exile target instant or sorcery card from your graveyard\. Creatures you control get \+X\/\+0 until end of turn, where X is that card's mana value\. Whenever a creature you control deals combat damage to a player this turn, copy the exiled card\. You may cast the copy without paying its mana cost\.$/, R => { R.spell = [cmd('surgeToVictory')]; });
cl(/^\{2\}\{U\}, Sacrifice ~: When you next cast an instant or sorcery spell this turn, copy it for each time you've cast your commander from the command zone this game\. You may choose new targets for the copies\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}{U}, Sacrifice ~', [cmd('drakeArm')]); });
cl(/^~ costs \{2\}\{R\} more to cast for each target beyond the first\.$/, R => { R.multikicker = parseCost('{2}{R}'); R.strive = true; });
cl(/^Choose any number of target creatures you control\. For each of them, create a token that's a copy of that creature, except it has haste\. Exile those tokens at the beginning of the next end step\.$/, R => { R.spell = [cmd('twinflame')]; });
cl(/^If you casting or copying an instant or sorcery spell causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time\.$/, R => { R.veyran = true; });
cl(/^~ deals 6 damage to each of up to two target creatures and\/or planeswalkers\.$/, R => { R.spell = [{ t: 'cmd', id: 'salvo', target: 'perm', filter: 'creature or planeswalker', good: false }]; });
cl(/^~ deals X damage to each creature and planeswalker your opponents control, where X is the number of spells you've cast this turn\.$/, R => { R.spell = [cmd('torrent')]; });
cl(/^Exile the top four cards of your library in a face-down pile, then exile the top four cards of your library in a face-up pile\. An opponent chooses one of those piles\. Put that pile into your graveyard\. Look at the cards in the other pile\. You may cast a spell from among them without paying its mana cost\. Put the rest into your hand\.$/, R => { R.spell = [cmd('abstractPerformance')]; });
cl(/^Return six target nonland permanents to their owners' hands\.$/, R => { R.spell = [cmd('bounceSix')]; });
cl(/^Shuffle your library, then reveal cards from the top of it until you reveal a nonland card\. Exile that card and put the rest on the bottom of your library in a random order\. You may cast the exiled card without paying its mana cost\.$/, R => { R.spell = [cmd('creativeTechnique')]; });
cl(/^Shuffle your library\. As many times as you choose, you may exile the top card of your library\. If the total mana value of the cards exiled this way is 13 or less, you may cast any number of spells from among those cards without paying their mana costs\.$/, R => { R.spell = [cmd('danceWithCalamity')]; });

// ===== Quandrix =====
cl(/^If one or more \+1\/\+1 counters would be put on another creature you control, that many plus one \+1\/\+1 counters are put on it instead\.$/, R => { R.counterMod = { what: 'creature', times: 1, plus: 1, other: true }; });
cl(/^You may have ~ enter as a copy of any creature on the battlefield, except it enters with (?:X|97) additional \+1\/\+1 counters on it\.$/, R => { R.clone = { what: 'creature' }; R.etbCounters = 'X'; });
cl(/^Reveal the top (?:X|97) cards of your library\. Put all land cards from among them onto the battlefield tapped and the rest on the bottom of your library in a random order\.$/, R => { R.spell = [{ t: 'cmd', id: 'animist', n: 97 }]; });
cl(/^If there are two or more instant and\/or sorcery cards in your graveyard, untap those lands\.$/, R => { if (R.spell && R.spell[0] && R.spell[0].id === 'animist') R.spell[0].mastery = true; else return false; });
cl(/^\{T\}: Choose a color\. Add one mana of that color for each charge counter on ~\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('cornucopiaMana')], a => { a.mana = true; }); });
cl(/^Creatures you control have base power and toughness (?:X|97)\/(?:X|97) until end of turn\.$/, R => { R.spell = [{ t: 'cmd', id: 'massBase', n: 97 }]; });
cl(/^\{T\}: Add \{C\}\{C\}\. When you next cast a spell with \{X\} in its mana cost this turn, you draw a card and gain half X life, rounded down\.$/, R => { R.mana = { colors: ['C'], n: 2, fixed: true }; R.infiniscope = true; });
cl(/^Whenever you cast or copy an instant or sorcery spell, create a 0\/0 green and blue Fractal creature token\. Put X \+1\/\+1 counters on it, where X is that spell's mana value\.$/, R => { R.trig.push({ ev: 'cast', filter: 'instant or sorcery', effects: [cmd('fractalFromSpell')] }); R.trig.push({ ev: 'spellCopied', effects: [cmd('fractalFromSpell')] }); });
cl(/^\{3\}\{U\}: Target creature token can't be blocked this turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{3}{U}', [{ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', only: sfx('creature token'), good: true }]); });
cl(/^Whenever you cast a spell with \{X\} in its mana cost, put two charge counters on ~\.$/, R => { R.trig.push({ ev: 'cast', filter: 'xspell', effects: [{ t: 'namedCounter', n: 2, kind: 'charge' }] }); });
cl(/^\{T\}: Add \{C\} for each charge counter on ~\. Spend this mana only on costs that contain \{X\}\.$/, R => { R.mana = { colors: ['C'], n: 1, onlyType: 'XCOST', nCtr: 'charge' }; });
cl(/^At the beginning of your upkeep, you may move any number of \+1\/\+1 counters from ~ onto other creatures\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('forgottenAncient')] }); });
cl(/^When ~ enters, create a 0\/0 green and blue Fractal creature token\. Put (?:X|97) \+1\/\+1 counters on it and attach ~ to it\.$/, R => { R.etb.push({ t: 'cmd', id: 'fractalHarness', n: 97 }); });
cl(/^When ~ enters, destroy up to one target artifact or enchantment with mana value (?:X|97) or less\. If (?:X|97) is 5 or more, you draw a card\. If (?:X|97) is 10 or more, double the number of \+1\/\+1 counters on any number of other target creatures\.$/, R => { R.etb.push({ t: 'cmd', id: 'kineticOoze', n: 97, target: 'perm', filter: 'sf:' + JSON.stringify({ types: ['Artifact', 'Enchantment'], notTypes: [], colors: [], notColors: [], states: [], notStates: [], kw: [], notKw: [], ctl: null, mvMax: 97 }), optional: true, good: false }); });
cl(/^When ~ enters and whenever you cast your first spell with \{X\} in its mana cost each turn, create a 0\/0 green and blue Fractal creature token\. Put a number of \+1\/\+1 counters on it equal to the number of study counters on ~\.$/, R => { R.etb.push(cmd('latticeFractal')); R.trig.push({ ev: 'cast', filter: 'xspell', once: 'firstX', effects: [cmd('latticeFractal')] }); });
cl(/^Remove a charge counter from ~: Add one mana of any color\. Activate only once each turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{0}', [{ t: 'addMana', any: 1 }], a => { a.cost.removeNamed = 'charge'; a.once = true; a.mana = true; }); });
cl(/^At the beginning of your upkeep, if ~ has no charge counters on it, return it to its owner's hand\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', cond: 'it has no charge counters on it', effects: [cmd('bounceSelf')] }); });
cl(/^Creatures you control with counters on them have trample\.$/, R => { R.statics.push({ fn: 'hasCounters', p: 0, q: 0, kw: ['trample'] }); });
cl(/^Whenever you cast your first spell with \{X\} in its mana cost each turn, put X \+1\/\+1 counters on ~\.$/, R => { R.trig.push({ ev: 'cast', filter: 'xspell', once: 'firstX', effects: [cmd('nevCounters')] }); });
cl(/^\{1\}, \{T\}: Add one mana of any color in your commander's color identity\. If you spend this mana to cast your commander, it enters with a number of additional \+1\/\+1 counters on it equal to the number of times it's been cast from the command zone this game\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [{ t: 'addMana', any: 1, identity: true, rider: 'opalPalace' }], a => { a.mana = true; }); });
cl(/^(?:X|97) can't be greater than the number of players in the game\.$/, R => { R.xMaxPlayers = true; });
cl(/^Reveal cards from the top of your library until you reveal (?:X|97) land cards\. Put those land cards onto the battlefield tapped and the rest on the bottom of your library in a random order\.$/, R => { R.spell = [{ t: 'cmd', id: 'openTheWay', n: 97 }]; });
cl(/^Exile all creatures\. Each player creates a 0\/0 green and blue Fractal creature token and puts a number of \+1\/\+1 counters on it equal to the total power of creatures they controlled that were exiled this way\.$/, R => { R.spell = [cmd('oversimplify')]; });
cl(/^Whenever you cast your first spell with \{X\} in its mana cost each turn, you may copy it\. You may choose new targets for the copy\.$/, R => { R.trig.push({ ev: 'cast', filter: 'xspell', once: 'firstX', effects: [cmd('copyXSpell')] }); });
cl(/^Whenever one or more creatures you control with base power 0 deal combat damage to a player, create a 0\/0 green and blue Fractal creature token\. Put a number of \+1\/\+1 counters on it equal to the damage dealt\.$/, R => { R.trig.push({ ev: 'combatHitAny', fn: 'basePower0', effects: [cmd('primoFractal')] }); });
cl(/^Auras, Equipment, and modified creatures you control gain hexproof until end of turn\.$/, R => { R.spell = [...(R.spell || []), cmd('silkguard')]; });
cl(/^\{T\}: Add \{G\}\{U\}\. Spend this mana only to cast spells with mana value 5 or greater or spells with \{X\} in their mana costs\.$/, R => { R.mana = { colors: ['G', 'U'], n: 2, fixed: true, onlyType: 'XCOST|MV5PLUS' }; });
cl(/^Reach, trample, protection from multicolored$/, R => { R.kw.add('reach'); R.kw.add('trample'); R.kw.add('pro:multicolored'); });
cl(/^When ~ enters, double the number of \+1\/\+1 counters on target creature you control\.$/, R => { R.etb.push({ t: 'cmd', id: 'doubleCountersOn', target: 'creature', mine: true, good: true }); });
cl(/^Whenever ~ attacks, you may have the base power and toughness of other creatures you control become equal to ~'s power and toughness until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('tanazirBase')] }); });
cl(/^Whenever ~ attacks, you may sacrifice a Food\. If you do, draw a card\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('gooseMother')] }); });
cl(/^Whenever you cast a permanent spell with a mana cost that contains \{X\}, double the value of X\.$/, R => { R.trig.push({ ev: 'cast', filter: 'xpermanent', effects: [cmd('doubleX')] }); });
cl(/^Whenever you cast an instant or sorcery spell or activate an ability, if that spell's mana cost or that ability's activation cost contains \{X\}, copy that spell or ability\. You may choose new targets for the copy\.$/, R => { R.trig.push({ ev: 'cast', filter: 'xspell', effects: [cmd('copyXSpell')] }); R.flourishing = true; });
cl(/^You may put a \+1\/\+1 counter on a creature\. Then choose odd or even\. Return each creature with power of the chosen quality to its owner's hand\.$/, R => { R.spell = [cmd('zimoneHypothesis')]; });
cl(/^At the beginning of your end step, if a land entered the battlefield under your control this turn and you control a prime number of lands, create Primo, the Indivisible, a legendary 0\/0 green and blue Fractal creature token, then put that many \+1\/\+1 counters on it\.$/, R => { R.trig.push({ ev: 'end', who: 'your', cond: 'a land entered the battlefield under your control this turn and you control a prime number of lands', effects: [cmd('primoIndivisible')] }); });
cl(/^The first spell you cast with \{X\} in its mana cost each turn costs \{1\} less to cast for each \+1\/\+1 counter on ~\.$/, R => { R.reducer = { what: 'xFirst', n: 1, perCounter: true }; });
cl(/^Whenever you cast your first spell with \{X\} in its mana cost each turn, put two \+1\/\+1 counters on ~\.$/, R => { R.trig.push({ ev: 'cast', filter: 'xspell', once: 'firstX', effects: [{ t: 'counters', n: 2, target: 'self' }] }); });
cl(/^\{1\}, \{T\}: You may put a land card from your hand onto the battlefield tapped\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('zimoneLand')]); });
cl(/^~ has trample as long as it has ten or more \+1\/\+1 counters on it\.$/, R => { selfCond(R, { cond: 'it has ten or more +1/+1 counters on it', p: 0, q: 0, kw: ['trample'] }); });
cl(/^Choose one\. If you control a commander as you cast ~, you may choose both instead\.$/, R => false);
COND_EXTRA.push(
    [/^it has no charge counters on it$/, () => (P, o) => !((o && o.ctr && o.ctr.charge) > 0)],
    [/^it has ten or more \+1\/\+1 counters on it$/, () => (P, o) => !!o && o.counters >= 10],
    [/^a land entered the battlefield under your control this turn and you control a prime number of lands$/, () => P => { const n = landsOf(P); const prime = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37].includes(n); return prime && (G.entered || []).some(e => e.turn === G.turn && e.land && e.owner === P.i); }]
);

// ===== Silverquill =====
const goadBuff = (R, p, q, kw) => { R.buff = { p, q, kw: kw || [] }; R.goadsHost = true; };
cl(/^Enchanted creature gets \+(\d+)\/\+(\d+) and is goaded\.$/, (R, m) => goadBuff(R, +m[1], +m[2]));
cl(/^Enchanted creature has indestructible and is goaded\.$/, R => goadBuff(R, 0, 0, ['indestructible']));
cl(/^Enchanted creature gets \+1\/\+1 and has deathtouch, and is goaded\.$/, R => goadBuff(R, 1, 1, ['deathtouch']));
cl(/^When enchanted creature dies, return ~ to the battlefield at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'dies', host: true, effects: [cmd('ghoulishReturn')] }); });
cl(/^Whenever enchanted creature attacks, each other creature that's attacking one of your opponents gets \+1\/\+1 until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', host: true, effects: [cmd('martialImpetus')] }); });
cl(/^Enchanted creature has ward \{2\}\.$/, R => { R.buff = { p: 0, q: 0, kw: ['ward:2'] }; });
cl(/^Replicate \{2\}$/, R => { R.multikicker = parseCost('{2}'); R.replicate = true; R.etb.push(cmd('replicateAura')); });
cl(/^When enchanted creature dies, return it to the battlefield under your control\.$/, R => { R.trig.push({ ev: 'dies', host: true, effects: [cmd('reanimateHost')] }); });
cl(/^~ and enchanted creature each get \+1\/\+1 for each creature you control and \+1\/\+1 for each Aura you control\.$/, R => { R.eidolon = true; R.buff = R.buff || { p: 0, q: 0, kw: [] }; });
cl(/^Enchanted creature gets \+10\/\+10 and has trample and annihilator 2\.$/, R => { R.buff = { p: 10, q: 10, kw: ['trample'] }; R.grant = { trig: [{ ev: 'attacks', effects: [cmd('annihilator', { n: 2 })] }], acts: [] }; });
cl(/^Enchanted creature has flying and "Sacrifice a creature: ~ gets \+2\/\+1 until end of turn\."$/, (R, m, ctx) => { const a = parseActivated('Sacrifice a creature: ~ gets +2/+1 until end of turn.', R); R.buff = { p: 0, q: 0, kw: ['flying'] }; R.grant = { trig: [], acts: a ? [a] : [] }; });
cl(/^Enchanted creature has protection from the chosen color\.$/, R => { R.protChosen = true; R.buff = { p: 0, q: 0, kw: [] }; R.chooseColor = true; });
cl(/^Whenever an enchantment you control enters, create a 2\/2 white Cat creature token\. If that enchantment is an Aura, you may attach it to the token\.$/, R => { R.trig.push(SPEC('enters', { type: 'Enchantment' }, { effects: [cmd('ajaniChosen')] })); });
cl(/^Whenever an enchantment you control enters, create a 2\/2 white Pegasus creature token with flying\.$/, R => { R.trig.push(SPEC('enters', { type: 'Enchantment' }, { effects: [TOKEN(1, 2, 2, 'white Pegasus', ['flying'])] })); });
cl(/^\{1\}, \{T\}: Until end of turn, creatures your opponents control lose hexproof and shroud and can't have hexproof or shroud\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('lighthouse')]); });
cl(/^Whenever ~ attacks, look at the top six cards of your library\. You may put an Aura or Equipment card from among them onto the battlefield\. If an Equipment is put onto the battlefield this way, you may attach it to a creature you control\. Put the rest of those cards on the bottom of your library in a random order\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('skyhunter')] }); });
cl(/^Whenever a player attacks one of your opponents, if that opponent has more life than another of your opponents, that attacking player draws a card and you put two \+1\/\+1 counters on a creature you control\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'breena', effects: [cmd('breena')] }); });
cl(/^Inklings can't attack you or planeswalkers you control\.$/, R => { R.calligrapher = true; });
cl(/^Whenever a player attacks one of your opponents, that attacking player creates a tapped 2\/1 white and black Inkling creature token with flying that's attacking that opponent\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'calligrapher', effects: [cmd('calligrapherToken')] }); });
cl(/^Each creature that's enchanted by an Aura you control can't attack you or planeswalkers you control\.$/, R => { R.erietteBars = true; });
cl(/^At the beginning of your end step, each opponent loses X life and you gain X life, where X is the number of Auras you control\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('erietteDrain')] }); });
cl(/^At the beginning of your upkeep, create a 2\/1 white and black Inkling creature token with flying\. When you do, return up to one target Aura or Equipment card from your graveyard to the battlefield attached to that token\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('filibuster')] }); });
cl(/^Whenever an enchanted creature dies, draw a card for each Aura you controlled that was attached to it\.$/, R => { R.trig.push({ ev: 'dies', fn: 'enchantedDies', any: true, effects: [cmd('hatefulDraw')] }); });
cl(/^When ~ enters, exile the top eight cards of your library\. You may cast an Aura spell from among them without paying its mana cost\. Then put the rest on the bottom of your library in a random order\.$/, R => { R.etb.push(cmd('heraldOfAmity')); });
cl(/^Prevent all combat damage that would be dealt to you this turn\. For each 1 damage prevented this way, create a 2\/1 white and black Inkling creature token with flying\.$/, R => { R.spell = [cmd('inkshield')]; });
cl(/^Whenever you lose life for the first time each turn, put a \+1\/\+1 counter on target creature you control\.$/, R => { R.trig.push({ ev: 'loseLife', once: 'firstLoss', effects: [{ t: 'cmd', id: 'counterOnTarget', target: 'creature', mine: true, good: true }] }); });
cl(/^At the beginning of each end step, if a modified creature died under your control this turn, create a 2\/1 white and black Inkling creature token with flying\.$/, R => { R.trig.push({ ev: 'end', who: 'each', cond: 'a modified creature died under your control this turn', effects: [INKLING(1)] }); });
cl(/^At the beginning of your upkeep, you and target opponent each reveal the top card of your library\. You each lose life equal to the mana value of the card revealed by the other player\. You each put the card you revealed into your hand\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'cmd', id: 'keenDuelist', target: 'player', oppOnly: true, good: false }] }); });
cl(/^Whenever an enchantment you control enters, tap up to one target creature and goad it\.$/, R => { R.trig.push(SPEC('enters', { type: 'Enchantment' }, { effects: [{ t: 'cmd', id: 'tapAndGoad', target: 'creature', optional: true, good: false }] })); });
cl(/^Whenever one or more creatures that are enchanted by an Aura you control attack, draw a card\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'enchantedAttack', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Spells you cast that target a creature cost \{2\} less to cast\.$/, R => { R.costLessTgt = { n: 2, what: 'creature' }; });
cl(/^~ gets \+2\/\+2 for each Aura attached to it\.$/, R => { R.spiritdancer = true; });
cl(/^Whenever you cast an Aura spell, you may draw a card\.$/, R => { R.trig.push({ ev: 'cast', filter: 'Aura', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever an opponent attacks with creatures, if two or more of those creatures are attacking you and\/or planeswalkers you control, draw a card\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attackedByTwo', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever an opponent attacks with creatures, if two or more of those creatures are attacking you and\/or planeswalkers you control, that opponent loses 3 life and you draw a card\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attackedByTwo', effects: [cmd('tomikDrain')] }); });
cl(/^Affinity for planeswalkers$/, R => { R.affinityOf = 'Planeswalker'; });
cl(/^At the beginning of your end step, for each player, put a \+1\/\+1 counter on up to one target creature that player controls\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('nilsCounters')] }); });
cl(/^Each creature with one or more counters on it can't attack you or planeswalkers you control unless its controller pays \{X\}, where X is the number of counters on that creature\.$/, R => { R.nilsTax = true; });
cl(/^Enchantment spells you cast have affinity for Auras\.$/, R => { R.reducer = { what: 'Enchantment', n: 0, affinity: 'Aura' }; });
cl(/^Whenever you cast an Aura spell that targets a modified permanent you control, draw a card\.$/, R => { R.trig.push({ ev: 'cast', fn: 'auraOnModified', filter: 'Aura', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^You may cast ~ from your graveyard by paying \{2\}\{W\} rather than paying its mana cost\.$/, R => { R.flashback = parseCost('{2}{W}'); R.flashbackKeep = true; });
cl(/^When ~ enters, draw a card for each Aura you control that's attached to a creature\.$/, R => { R.etb.push(cmd('reverieDraw')); });
cl(/^Enchanted creature gets \+1\/\+1 for each Aura you control that's attached to a creature\.$/, R => { R.buff = { p: 0, q: 0, kw: [] }; R.buffPer = { p: 1, q: 1, what: 'the number of Auras you control that are attached to a creature' }; });
cl(/^Whenever ~ enters or attacks, create a white Aura enchantment token named Contract attached to target creature an opponent controls\. The token has enchant creature and "Whenever enchanted creature attacks, it gets \+2\/\+0 until end of turn if it's attacking one of your opponents\. Otherwise, its controller loses 2 life\."$/, R => { const e = { t: 'cmd', id: 'scrivContract', target: 'creature', theirs: true, good: false }; R.etb.push(e); R.trig.push({ ev: 'attacks', effects: [e] }); });
cl(/^CONTRACT$/, R => { R.trig.push({ ev: 'attacks', host: true, effects: [cmd('contractAttack')] }); });
cl(/^Escape—\{W\}, Exile two other cards from your graveyard\.$/, R => { R.escape = { cost: parseCost('{W}'), n: 2 }; });
cl(/^Escape—\{3\}\{B\}\{B\}, Exile four other cards from your graveyard\.$/, R => { R.escape = { cost: parseCost('{3}{B}{B}'), n: 4, counters: 2 }; });
cl(/^~ escapes with two \+1\/\+1 counters on it\.$/, R => { if (!R.escape) return false; });
cl(/^At the beginning of combat on your turn, you may choose two\. Each mode must target a different player\.$/, (R, m, ctx) => { ctx.li += ctx.lines.slice(ctx.li + 1).filter(l => l.startsWith('•')).length; R.trig.push({ ev: 'combat', effects: [cmd('shadrix')] }); });
cl(/^Whenever a creature enters, you may attach ~ to that creature\.$/, R => { R.trig.push({ ev: 'enters', anyone: true, effects: [cmd('shieldedByFaith')] }); });
cl(/^Whenever enchanted creature attacks, reveal cards from the top of your library until you reveal an Aura card\. You may put that card onto the battlefield\. If you don't, put it into your hand\. Put the rest on the bottom of your library in a random order\.$/, R => { R.trig.push({ ev: 'attacks', host: true, effects: [cmd('songbirds')] }); });
cl(/^Whenever an enchantment you control is put into a graveyard from the battlefield, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'enchantToGy', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^Destroy all creatures that aren't enchanted\. They can't be regenerated\.$/, R => { R.spell = [cmd('windsOfRath')]; });
cl(/^Return all enchantment cards from your graveyard to the battlefield\.$/, R => { R.spell = [cmd('replenish')]; });
cl(/^Enchant creature card in a graveyard$/, R => { R.animateDead = true; R.isAura = false; });
cl(/^When ~ enters, if it's on the battlefield, it loses "enchant creature card in a graveyard" and gains "enchant creature put onto the battlefield with ~\." Return enchanted creature card to the battlefield under your control and attach ~ to it\. When ~ leaves the battlefield, that creature's controller sacrifices it\.$/, R => { R.etb.push(cmd('animateDead')); R.trig.push({ ev: 'leaves', effects: [cmd('animateDeadLeaves')] }); R.buff = { p: -1, q: 0, kw: [] }; });
COND_EXTRA.push(
    [/^a modified creature died under your control this turn$/, () => P => P.modDied === G.turn]
);
CMD_REWRITES.push([/Exile target monocolored permanent\./g, 'Exile target monocolored permanent.']);

// ===== Witherbloom =====
const SPAWN = n => ({ t: 'token', n, p: 0, q: 1, name: 'colorless Eldrazi Spawn', kw: [], text: 'Sacrifice ~: Add {C}.' });
const PESTT = n => ({ t: 'token', n, p: 1, q: 1, name: 'black and green Pest', kw: [], text: 'When ~ dies, you gain 1 life.' });
cl(/^At the beginning of your upkeep, you may create a 0\/1 colorless Eldrazi Spawn creature token\. It has "Sacrifice ~: Add \{C\}\."$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [SPAWN(1)] }); });
cl(/^Attacking Pests you control get \+1\/\+0 and have menace\.$/, R => { R.statics.push({ spec: { sub: 'Pest', attacking: true }, p: 1, q: 0, kw: ['menace'] }); });
cl(/^Attacking Pests you control get \+1\/\+0 and have deathtouch\.$/, R => { R.statics.push({ spec: { sub: 'Pest', attacking: true }, p: 1, q: 0, kw: ['deathtouch'] }); });
cl(/^Whenever ~ attacks, you gain 2 life\. Then creatures you control gain trample and get \+X\/\+X until end of turn, where X is the amount of life you gained this turn\.$/, R => { R.trig.push({ ev: 'attacks', effects: [{ t: 'gain', n: 2 }, cmd('bogbeast')] }); });
cl(/^Each player sacrifices a creature or planeswalker of their choice\. If you sacrificed a permanent this way, you may return another permanent card from your graveyard to your hand\.$/, R => { R.spell = [cmd('deadlyBrew')]; });
cl(/^At the beginning of your end step, each opponent loses X life, where X is the amount of life you gained this turn\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('daemogothDrain')] }); });
cl(/^Whenever you sacrifice a creature, draw a card\. This ability triggers only once each turn\.$/, R => { R.trig.push({ ev: 'sacrificed', fn: 'sacCreatureMine', once: 'dinaDraw', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever you sacrifice a creature, draw a card\.$/, R => { R.trig.push({ ev: 'sacrificed', fn: 'sacCreatureMine', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^\{2\}, \{T\}, Sacrifice another creature: You gain X life and put X \+1\/\+1 counters on target creature you control, where X is the sacrificed creature's power\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'cmd', id: 'dinaBrew', target: 'creature', mine: true, good: true }], a => { a.cost.sacPerm = 'another creature'; }); });
cl(/^\{1\}, Sacrifice another creature: ~ gets \+X\/\+0 until end of turn, where X is the sacrificed creature's power\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('dinaPump')], a => { a.cost.sacPerm = 'another creature'; }); });
cl(/^\{1\}\{G\}: Exile target card from a graveyard\. If a creature card is exiled this way, create a 1\/1 black and green Pest creature token with "When ~ dies, you gain 1 life\."$/, (R, m, ctx) => { act(R, ctx.line, '{1}{G}', [cmd('feralAppetite')]); });
cl(/^Nontoken creatures you control enter with an additional \+1\/\+1 counter on them for each creature that died under your control this turn\.$/, R => { R.gormaEnter = true; });
cl(/^At the beginning of your end step, create a number of Food tokens equal to the number of nontoken creatures you had enter the battlefield under your control this turn\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('gyomeFood')] }); });
cl(/^As an additional cost to cast ~, sacrifice X creatures\.$/, R => { R.addCost = { sacX: true }; });
cl(/^Destroy X target nonland permanents\.$/, R => { if (R.addCost && R.addCost.sacX) R.spell = [cmd('destroyXTargets')]; else return false; });
cl(/^At the beginning of your end step, if you control no creatures with decayed, create a 2\/2 black Zombie creature token with decayed\.$/, R => { R.trig.push({ ev: 'end', who: 'your', cond: 'you control no creatures with decayed', effects: [{ t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: ['decayed'] }] }); });
cl(/^Whenever a player sacrifices another permanent, put a \+1\/\+1 counter on each creature you control\.$/, R => { R.trig.push({ ev: 'sacrificed', fn: 'anySacOther', effects: [cmd('mazirek')] }); });
cl(/^Whenever another creature is put into your graveyard from the battlefield, you may pay \{B\}\. If you do, return ~ from your graveyard to the battlefield\.$/, R => { (R.gyTrig = R.gyTrig || []).push({ ev: 'creatureDies', mine: true, effects: [cmd('netherTraitor')] }); });
cl(/^Gravestorm$/, R => { R.gravestorm = true; });
cl(/^Whenever ~ or another nontoken creature you control dies, you may create a 0\/1 colorless Eldrazi Spawn creature token\. It has "Sacrifice ~: Add \{C\}\."$/, R => { R.trig.push(SPEC('dies', { type: 'Creature', nontoken: true }, { effects: [SPAWN(1)] })); });
cl(/^Destroy up to (?:X|97) target artifacts and\/or enchantments\. Create (?:twice X|194) 1\/1 black and green Pest creature tokens with "When ~ dies, you gain 1 life\."$/, R => { R.spell = [{ t: 'cmd', id: 'pestInfestation', n: 97 }]; });
cl(/^At the beginning of each upkeep, if you don't control a Pest creature token, create a 1\/1 black and green Pest creature token with "When ~ dies, you gain 1 life\."$/, R => { R.trig.push({ ev: 'upkeep', who: 'each', cond: "you don't control a Pest creature token", effects: [PESTT(1)] }); });
cl(/^As an additional cost to cast ~, you may sacrifice one or more creatures\. When you do, copy ~ for each creature sacrificed this way\.$/, R => { R.addCost = { sacMany: true }; });
cl(/^\{T\}, Sacrifice two other creatures: Any number of target players each lose 2 life and sacrifice a creature of their choice\. You add \{B\}\{B\} and draw a card\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('priestForgotten')], a => { a.cost.sacOthers = 2; }); });
cl(/^At the beginning of your end step, create a number of 1\/1 black and green Pest creature tokens equal to the number of \+1\/\+1 counters on ~\. They have "When ~ dies, you gain 1 life\."$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('ribtrussPests')] }); });
cl(/^Whenever you attack, target creature gains deathtouch until end of turn\. Whenever that creature deals combat damage to a player this combat, ~ becomes prepared\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'sanguinistAtk', effects: [{ t: 'cmd', id: 'sanguinistMark', target: 'creature', good: true }] }); R.trig.push({ ev: 'hitPlayer', fn: 'sanguinistHit', anyMine: true, effects: [cmd('prepare')] }); });
cl(/^Ascend$/, R => { R.ascend = true; });
cl(/^Saprolings you control get \+2\/\+2 as long as you have the city's blessing\.$/, R => { R.statics.push({ spec: { sub: 'Saproling' }, p: 2, q: 2, kw: [], cond: "you have the city's blessing" }); });
cl(/^At the beginning of your end step, if you gained life this turn, each opponent sacrifices a creature of their choice and you return up to one target creature card from your graveyard to your hand\.$/, R => { R.trig.push({ ev: 'end', who: 'your', cond: 'you gained life this turn', effects: [cmd('witchMoors')] }); });
COND_EXTRA.push(
    [/^you control no creatures with decayed$/, () => P => !P.bf.some(x => isCreature(x) && has(x, 'decayed'))],
    [/^you don't control a Pest creature token$/, () => P => !P.bf.some(x => x.token && isCreature(x) && hasType(x, 'Pest'))],
    [/^you have the city's blessing$/, () => P => { if (!P.blessing && P.bf.length >= 10 && P.bf.some(x => Rx(x).ascend)) { P.blessing = true; log(`${P.name} ${you(P) ? 'get' : 'gets'} the city's blessing.`); } return !!P.blessing; }]
);

// ===== Marvel Commander precons (MSC) =====
// Vibranium / Powerstone tokens tap for {C} that can only be spent on artifact spells
cl(/^\{T\}: Add \{C\}\. This mana can't be spent to cast a nonartifact spell\.$/, R => { R.mana = { colors: ['C'], n: 1, onlyType: 'Artifact' }; });
const isHero = x => hasType(x, 'Hero');
// ===== Avengers Assemble =====
cl(/^~ can't be blocked by creatures with greater power\.$/, R => { R.kw.add('skulk'); });
cl(/^~ costs \{2\} less to cast if a player attacked you during their last turn\.$/, R => { R.costLessIf = { n: 2, cond: 'a player attacked you during their last turn' }; });
cl(/^~ costs \{2\} less to cast if a creature is attacking you\.$/, R => { R.costLessIf = { n: 2, cond: 'a creature is attacking you' }; });
cl(/^\{4\}, \{T\}: Look at the top three cards of your library\. You may reveal a Hero card from among them and put it into your hand\. Put the rest on the bottom of your library in any order\.$/, (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [cmd('digHero', { n: 3 })]); });
cl(/^Whenever you attack, look at the top four cards of your library\. You may reveal a Hero card from among them and put that card into your hand\. Put the rest on the bottom of your library in a random order\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'nickFury', effects: [cmd('digHero', { n: 4 })] }); });
cl(/^Whenever a creature you control becomes tapped during your turn, if it's the first time that creature has become tapped this turn, untap it\.$/, R => { R.trig.push({ ev: 'tapped', fn: 'capLegend', effects: [cmd('untapCtx')] }); });
cl(/^Whenever another Hero you control enters, it gains vigilance and haste until end of turn\. Put a \+1\/\+1 counter on that Hero and a \+1\/\+1 counter on ~\.$/, R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature', sub: 'Hero' }, { effects: [cmd('capTeam')] })); });
cl(/^As long as an opponent has cast a spell this turn, you may cast spells as though they had flash\.$/, R => { R.flashCond = 'an opponent has cast a spell this turn'; });
cl(/^As long as ~ is tapped, you may cast spells as though they had flash\.$/, R => { R.flashCond = 'it is tapped'; });
cl(/^Whenever you put one or more counters on another creature, if it's not a Kree, you may put the same number and kind of counters on ~\.$/, R => { R.trig.push({ ev: 'counters', fn: 'marvelCounters', effects: [cmd('copyCounters')] }); });
cl(/^Whenever ~ deal combat damage to a player, create that many 1\/1 white Bird creature tokens with flying, then put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('falconBirds')] }); });
cl(/^Whenever ~ attacks, other attacking creatures get \+X\/\+0 until end of turn, where X is ~'s power\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('firebirdBoost')] }); });
cl(/^Commander creatures you own have "Whenever you cast a spell that shares a creature type with ~, draw a card\. This ability triggers only once each turn\."$/, R => { R.trig.push({ ev: 'cast', fn: 'folkHero', once: 'folkHero', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever a creature an opponent controls dies, if ~ dealt damage to it this turn, draw a card\.$/, R => { R.trig.push({ ev: 'creatureDies', fn: 'hawkeyeKill', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever ~ is dealt damage for the first time each turn, put that many \+1\/\+1 counters on it\.$/, R => { R.trig.push({ ev: 'dealtDamage', once: 'hercules', effects: [cmd('herculesCounters')] }); });
cl(/^Whenever a legendary creature you control enters, you may attach ~ to it\.$/, R => { R.trig.push(SPEC('enters', { type: 'Creature', legendary: true }, { effects: [cmd('attachSelfToCtx')] })); });
cl(/^Return target creature card from your graveyard to the battlefield\. If a Hero enters this way, it enters with two additional \+1\/\+1 counters on it\.$/, R => { R.spell = [{ t: 'regrow', what: 'creature', bf: true, heroCounters: 2 }]; });
cl(/^Choose target creature you control\. Until end of turn, all damage that would be dealt to you and creatures you control is dealt to the chosen creature instead \. When that creature dies this turn, put its counters on up to one target creature you control and draw a card\.$/, R => { R.spell = [{ t: 'cmd', id: 'heroicSacrifice', target: 'creature', mine: true, good: true }]; });
cl(/^Equipped creature has base power and toughness 9\/9 and has flying\.$/, R => { R.buff = { p: 0, q: 0, kw: ['flying'] }; R.buffBase = { p: 9, q: 9 }; });
cl(/^Whenever ~ attacks, other attacking modified creatures gain flying until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('modifiedAttackers', { kw: ['flying'] })] }); });
cl(/^Whenever ~ attacks, attacking modified creatures you control gain double strike until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('modifiedAttackers', { kw: ['double strike'], self: true })] }); });
cl(/^Whenever you cast a Hero spell, draw a card\.$/, R => { R.trig.push({ ev: 'cast', filter: 'types:Hero', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever your commander deals combat damage to a player, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'hitPlayer', fn: 'commanderHit', anyMine: true, effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^Whenever you attack with your commander, if ~ is in your graveyard, you may return it to the battlefield tapped and attacking\.$/, R => { (R.gyTrig = R.gyTrig || []).push({ ev: 'attacks', fn: 'commanderAttackFromGy', effects: [cmd('jocastaReturn')] }); });
cl(/^Whenever you attack with exactly two creatures, those creatures gain first strike until end of turn, then draw a card\. Whenever either of those creatures deals combat damage to a player this combat, put a \+1\/\+1 counter on it\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attackWithTwo', effects: [cmd('loveBattlefield')] }); R.trig.push({ ev: 'hitPlayer', fn: 'loveHit', anyMine: true, effects: [cmd('loveCounter')] }); });
cl(/^Whenever ~ deals combat damage to a player, add that much mana of any one color\. Until end of turn, you don't lose this mana as steps and phases end\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('photonMana')] }); });
cl(/^Whenever ~ deals combat damage to a player, draw that many cards\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('drawDamage')] }); });
cl(/^When ~ enters, return up to one other target artifact or creature you control to its owner's hand\. If it was an artifact, put a \+1\/\+1 counter on ~\.$/, R => { R.etb.push({ t: 'cmd', id: 'rescuePepper', target: 'perm', filter: sfObj({ types: ['Artifact', 'Creature'], ctl: 'you' }), notSelf: true, optional: true, good: true }); });
cl(/^Whenever ~ deals combat damage to a player, look at the top two cards of your library, then exile them face down\. Then you may cast a Hero or noncreature spell from among cards exiled with ~ without paying its mana cost\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('scarletWitch')] }); });
cl(/^When the tenth \+1\/\+1 counter is put on ~, you draw five cards and gain 5 life\.$/, R => { R.trig.push({ ev: 'counters', fn: 'tenthCounter', effects: [cmd('shangChi')] }); });
cl(/^Whenever a Hero you control becomes blocked, put a \+1\/\+1 counter on that Hero for each creature blocking it\.$/, R => { R.trig.push({ ev: 'blocked', fn: 'heroBlocked', effects: [cmd('sheHulk')] }); });
cl(/^Whenever you cast a noncreature spell, you may pay \{1\}\. When you do, target creature with haste can't be blocked this turn except by creatures with haste\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [{ t: 'cmd', id: 'speedTrick', target: 'creature', only: sfObj({ kw: ['haste'] }), good: true }] }); });
cl(/^When ~ enters, target Hero gains hexproof until end of turn\.$/, R => { R.etb.push({ t: 'pump', p: 0, q: 0, kw: ['hexproof'], target: 'creature', only: sfObj({ types: ['Hero'] }), good: true }); });
cl(/^If another source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus 1 instead\.$/, R => { R.thorPlus = true; });
cl(/^Whenever a player casts a spell, if it isn't that player's turn, choose one —$/, (R, m, ctx) => { const bullets = []; let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) bullets.push(ctx.lines[j++]); if (bullets.length !== 2) return false; ctx.li = j - 1; R.trig.push({ ev: 'cast', fn: 'notTheirTurn', filter: 'any', who: 'any', effects: [{ t: 'modal', modes: [[{ t: 'counters', n: 1, target: 'self' }], [cmd('phaseOutSelf')]], n: 1 }] }); });
cl(/^Draw (?:X|97) cards\. If (?:X|97) is 5 or more, you may cast a Hero spell from your hand without paying its mana cost\.$/, R => { R.spell = [{ t: 'cmd', id: 'westCoast', n: 97 }]; });
cl(/^Whenever ~ attacks, return target creature card with mana value less than or equal to ~'s power from your graveyard to the battlefield\. If a Hero enters this way, it enters with an additional \+1\/\+1 counter on it\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('winterSoldier')] }); });
cl(/^\{T\}: Add one mana of any color\. Spend this mana only to cast a Hero spell or to activate an ability of a Hero source\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'addMana', any: 1, only: 'Hero' }], a => { a.mana = true; }); });
cl(/^For each opponent, destroy up to one target artifact or enchantment that player controls\.$/, R => { R.spell = [cmd('dismantlingWave')]; });
cl(/^When you cycle ~, destroy all artifacts and enchantments\.$/, R => { R.cycleTrig = [{ t: 'wipe', how: 'destroy', what: 'artifacts and enchantments' }]; });
cl(/^Whenever you cast a spell of the chosen type, put a charge counter on ~\.$/, R => { R.trig.push({ ev: 'cast', filter: 'chosenType', effects: [{ t: 'namedCounter', n: 1, kind: 'charge' }] }); });
cl(/^Creatures you control of the chosen type get \+1\/\+1 for each charge counter on ~\.$/, R => { R.statics.push({ type: '*chosen', p: 1, q: 1, kw: [], perCtr: 'charge' }); });
COND_EXTRA.push(
    [/^a player attacked you during their last turn$/, () => P => P.attackedAt !== undefined && P.attackedAt >= G.turn - Math.max(1, G.players.length - 1) && P.attackedAt < G.turn],
    [/^a creature is attacking you$/, () => P => (G.attackers || []).some(u => { const a = onBf(u); return a && a.owner !== P.i && (G.players.length === 2 || G.defender === P.i); })],
    [/^an opponent has cast a spell this turn$/, () => P => foes(P).some(F => F.castTurn === G.turn)],
    [/^it is tapped$/, () => (P, o) => !!o && !!o.tapped]
);
registerRules({
    name: 'msc',
    effects: [
        [/^create (a|an|one|two|three|four) tapped vibranium tokens?$/i, m => ({ t: 'artToken', n: nw(m[1] === 'a' || m[1] === 'an' ? 'one' : m[1]), kind: 'vibranium', tapped: true })],
        [/^destroy target artifact and target enchantment$/i, () => ({ t: 'cmd', id: 'destroyArtAndEnch', target: 'perm', filter: 'artifact', good: false })],
        [/^put a \+1\/\+1 counter on each creature target player controls$/i, () => ({ t: 'cmd', id: 'counterEachOfPlayer', target: 'player', good: true })],
        [/^mill three cards, then you may put an artifact or land card from among the milled cards into your hand$/i, () => ({ t: 'millPick', n: 3, what: 'artifact or land' })],
        [/^put a hero creature card from your hand onto the battlefield$/i, () => cmd('heroFromHand')],
        [/^return target hero creature card from your graveyard to your hand$/i, () => ({ t: 'regrow', what: 'Hero creature' })],
        [/^~ phases out$/i, () => cmd('phaseOutSelf')],
        [/^for each opponent, destroy (?:up to one )?target nonartifact creature that player controls$/i, () => cmd('ultronDestroy')],
        [/^for each opponent, you create a 2\/2 colorless robot villain artifact creature token$/i, () => cmd('robotPerOpp')],
        [/^§ultron3$/, () => cmd('ultronChapter3')],
        [/^§kangDynasty12$/, () => cmd('kangDynasty12')],
        [/^target creature you control gets \+1\/\+1 until end of turn for each card in your hand and can't be blocked this turn$/i, () => ({ t: 'cmd', id: 'kangDynasty3', target: 'creature', mine: true, good: true })],
    ],
    triggers: [
        [/^Whenever a player casts a spell, if it isn't that player's turn, (.+)$/, () => ({ ev: 'cast', fn: 'notTheirTurn', filter: 'any', who: 'any' })]
    ],
    lines: []
});

// ===== Doom Prevails =====
const ROBOT = n => ({ t: 'token', n, p: 2, q: 2, name: 'colorless Robot Villain', artifact: true, kw: [] });
cl(/^Whenever you discard a card, you may exile that card from your graveyard\. If you do, until the end of your next turn, you may play that card\.$/, R => { R.trig.push({ ev: 'discarded', effects: [cmd('exileDiscarded', { play: 'nextTurn' })] }); });
cl(/^\{3\}, \{T\}: Target Villain you control connives\. Activate only as a sorcery\.$/, (R, m, ctx) => { act(R, ctx.line, '{3}, {T}', [{ t: 'cmd', id: 'conniveTarget', target: 'creature', mine: true, only: sfObj({ types: ['Villain'] }), good: true }], a => { a.sorcery = true; }); });
cl(/^Enchant opponent$/, R => { R.enchantPlayer = true; R.isAura = false; R.etb.push({ t: 'enchantPlayer' }); });
cl(/^Whenever you attack enchanted player, that player loses 2 life\. You draw a card and gain 2 life\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attackEnchanted', effects: [cmd('archnemesisHit')] }); });
cl(/^Whenever a player attacks you, you may attach ~ to that player\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attackedMe', effects: [cmd('archnemesisMove')] }); });
cl(/^Whenever another Villain you control enters, you may have it connive\. Do this only once each turn\.$/, R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature', sub: 'Villain' }, { once: 'strucker', effects: [cmd('conniveCtx')] })); });
cl(/^~ enters with a \+1\/\+1 counter on it for each time he was kicked\.$/, R => { R.kickPer = 'plus'; });
cl(/^When ~ enters, ~ deals damage equal to his power to each of up to X targets, where X is the number of times he was kicked\.$/, R => { R.etb.push(cmd('batroc')); });
cl(/^Multikicker \{(\d+)\}$/, (R, m) => { R.multikicker = parseCost(`{${m[1]}}`); });
cl(/^At the beginning of your first main phase, choose one or more —$/, (R, m, ctx) => { let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++; ctx.li = j - 1; R.trig.push({ ev: 'main1', effects: [cmd('blackMarket')] }); });
cl(/^You may have ~ enter as a copy of a creature you control, except his name is ~\.$/, R => { R.clone = { what: 'creature you control', keepName: true }; });
cl(/^Whenever ~ deals combat damage to a player, that player faces a villainous choice — They sacrifice a nontoken creature of their choice, or they lose 2 life and you draw two cards\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('damoclesChoice')] }); });
cl(/^Whenever you discard one or more land cards, each opponent loses 2 life\.$/, R => { R.trig.push({ ev: 'discarded', fn: 'discardedLand', effects: [cmd('loseOpps', { n: 2 })] }); });
cl(/^At the beginning of combat on your turn, target Villain you control gains menace until end of turn\. It connives\.$/, R => { R.trig.push({ ev: 'combat', effects: [{ t: 'cmd', id: 'doomCombat', target: 'creature', mine: true, only: sfObj({ types: ['Villain'] }), good: true }] }); });
cl(/^Whenever you attack, exile target nonland card from your graveyard with two time counters on it\. If it doesn't have suspend, it gains suspend\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'timePlatform', effects: [cmd('timePlatform')] }); });
cl(/^For each opponent, you create a 2\/1 black Villain creature token with menace\.$/, R => { R.spell = [cmd('hydraRanks')]; });
cl(/^Whenever your commander enters or attacks, you may pay \{1\}\{B\}\. If you do, return ~ from your graveyard to your hand\.$/, R => { (R.gyTrig = R.gyTrig || []).push(SPEC('enters', { commander: true }, { effects: [cmd('hydraReturn')] })); R.gyTrig.push({ ev: 'attacks', fn: 'commanderAttackFromGy', effects: [cmd('hydraReturn')] }); });
cl(/^Look at the top card of each player's library, then exile those cards face down\. You may play them without paying their mana costs for as long as they remain exiled\.$/, R => { R.spell = [cmd('extractPower')]; });
cl(/^Whenever a creature you control connives, put a \+1\/\+1 counter on that creature and a plan counter on ~\.$/, R => { R.trig.push({ ev: 'connives', fn: 'myConnive', effects: [cmd('gloriousPurposeTick')] }); });
cl(/^When the sixth plan counter is put on ~, sacrifice it\. If you do, exile the top four cards of your library\. You may cast any number of spells from among them without paying their mana costs\. Put the rest into your hand\.$/, R => { });
cl(/^Whenever ~ attacks, you may cast target instant or sorcery card with mana value less than or equal to his power from your graveyard\. If that spell would be put into your graveyard, exile it instead\. If you cast a spell this way, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('zemoAttack')] }); });
cl(/^Whenever a creature you control connives, put a \+1\/\+1 counter on each Villain you control\.$/, R => { R.trig.push({ ev: 'connives', fn: 'myConnive', effects: [cmd('ironMonger')] }); });
cl(/^Whenever a creature you control connives, you may pay \{1\}\. If you do, create a 2\/2 colorless Robot Villain artifact creature token\.$/, R => { R.trig.push({ ev: 'connives', fn: 'myConnive', effects: [cmd('ultronRobot')] }); });
cl(/^Whenever ~ enters or attacks, exile cards from the top of your library until you exile a nonland card\. Put two time counters on that card\. If it doesn't have suspend, it gains suspend\.$/, R => { R.etb.push(cmd('kangPrime')); R.trig.push({ ev: 'attacks', effects: [cmd('kangPrime')] }); });
cl(/^Whenever ~ attacks, ~ gets \+1\/\+0 until end of turn for each artifact defending player controls\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('killmongerBoost')] }); });
cl(/^Whenever you play a card from exile, ~ gains indestructible until end of turn\.$/, R => { R.trig.push({ ev: 'playedFromExile', effects: [cmd('klawIndestructible')] }); });
cl(/^Whenever ~ deals combat damage to a player, look at the top card of that player's library, then exile it face down\. You may play it for as long as it remains exiled\. Mana of any type can be spent to cast a spell this way\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('klawExile')] }); });
cl(/^Whenever you cast your first instant, sorcery, or Villain spell each turn, exile it, then exile cards from the top of your library until you exile a nonland card\. ~ deals damage to each opponent equal to the difference between that spell's mana value and that nonland card's mana value\. You may cast that card without paying its mana cost\.$/, R => { R.trig.push({ ev: 'cast', fn: 'ladyLoki', filter: 'any', once: 'ladyLoki', effects: [cmd('ladyLoki')] }); });
cl(/^Destroy target creature or planeswalker\. Each creature that convoked ~ connives\.$/, R => { R.spell = [{ t: 'destroy', target: 'perm', filter: 'creature or planeswalker' }, cmd('convokersConnive')]; });
cl(/^Whenever ~ attacks, for each card you've discarded this turn, create a token that's a copy of ~, except the token isn't legendary\. The tokens enter tapped and attacking\. Exile the tokens at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('livingLaser')] }); });
cl(/^When ~ enters, gain control of target creature until end of turn\. Untap that creature\. Until end of turn, it becomes a Villain in addition to its other types and gains haste\.$/, R => { R.etb.push({ t: 'cmd', id: 'lokiScepter', target: 'creature', theirs: true, good: false }); });
cl(/^Whenever ~ attacks, create a tapped and attacking token that's a copy of another target Villain you control, except it isn't legendary and it's an Illusion in addition to its other types\. Sacrifice that token at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'attacks', effects: [{ t: 'cmd', id: 'lokiDeceiver', target: 'creature', mine: true, notSelf: true, only: sfObj({ types: ['Villain'] }), good: true }] }); });
cl(/^Whenever one or more Villains you control deal combat damage to a player, draw a card\.$/, R => { R.trig.push({ ev: 'combatHitAny', fn: 'villainsHit', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever you cast a Villain spell, create a 2\/1 black Villain creature token with menace\.$/, R => { R.trig.push({ ev: 'cast', filter: 'types:Villain', effects: [{ t: 'token', n: 1, p: 2, q: 1, name: 'black Villain', kw: ['menace'] }] }); });
cl(/^Nonland cards in your hand have miracle \{0\}\.$/, R => { R.trig.push({ ev: 'draw', fn: 'miracleFirst', effects: [cmd('miracle0')] }); });
cl(/^\{T\}: The next spell of the chosen type you cast this turn can be cast as though it had flash\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('progenitorFlash')], a => { a.mana = false; }); });
cl(/^Whenever you attack, goad target creature an opponent controls\. It can't block this turn\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'puppetAtk', effects: [{ t: 'cmd', id: 'puppetGoad', target: 'creature', theirs: true, good: false }] }); });
cl(/^Whenever one or more goaded creatures deal combat damage to one of your opponents, create a Treasure token\.$/, R => { R.trig.push({ ev: 'combatHitAny', fn: 'goadedHit', effects: [{ t: 'artToken', n: 1, kind: 'treasure' }] }); });
cl(/^Whenever one or more Villains you control deal combat damage to a player, gain control of target noncreature, nonland permanent that player controls until the end of your next turn\. It gains "~ can't be sacrificed" until the end of your next turn\.$/, R => { R.trig.push({ ev: 'combatHitAny', fn: 'villainsHit', effects: [{ t: 'cmd', id: 'stiltMan', target: 'perm', filter: sfObj({ notTypes: ['Creature', 'Land'], ctl: 'opp' }), good: false }] }); });
cl(/^Whenever you cast a spell with mana value 4 or greater, you may exile the top card of your library\. If you do, you may play that card until you exile another card with ~\.$/, R => { R.trig.push({ ev: 'cast', filter: 'mv4', effects: [cmd('superiorFoes')] }); });
cl(/^Whenever an opponent casts their first noncreature spell each turn, that player loses life equal to that spell's mana value\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', who: 'any', fn: 'oppFirstNoncreature', effects: [cmd('frightfulFour')] }); });
cl(/^Whenever ~ enters or attacks, you may draw a card for each other creature you control that shares a creature type with it\. If you do, discard a card\.$/, R => { R.etb.push(cmd('titanLittjara')); R.trig.push({ ev: 'attacks', effects: [cmd('titanLittjara')] }); });
cl(/^Other creatures you control have melee\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'titania', effects: [cmd('titaniaMelee')] }); });
cl(/^When ~ enters, for each opponent, ~ deals 3 damage to up to one target creature that player controls\.$/, R => { R.etb.push(cmd('triSentinel')); });
cl(/^Whenever ~ attacks, choose one at random\. If you discarded a card this turn, you choose one instead\.$/, (R, m, ctx) => { let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++; ctx.li = j - 1; R.trig.push({ ev: 'attacks', effects: [cmd('typhoidMary')] }); });
cl(/^Whenever you cast your first noncreature spell each turn, draw a card\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', once: 'valeria', effects: [{ t: 'draw', n: 1 }] }); });
CMD_REWRITES.push(
    [/For each opponent, tap up to one target creature that player controls\. Goad those creatures\. Until your next turn, whenever any of those creatures deals combat damage to a player, draw a card\./g, '§kangDynasty12.'],
    [/Artifact creatures you control gain deathtouch until end of turn\. Put a \+1\/\+1 counter on each of them\./g, '§ultron3.']
);

// ===== The Fantastic Four =====
cl(/^\{T\}: Add one mana of any color\. Spend this mana only to cast a Villain spell or to activate an ability of a Villain source\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'addMana', any: 1, only: 'Villain' }], a => { a.mana = true; }); });
cl(/^At the beginning of your end step, each player gains control of all creatures they own\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('aliciaReturn')] }); });
cl(/^If a triggered ability of a legendary creature you control triggers, that ability triggers an additional time\.$/, R => { R.doubleLegendTrig = true; });
cl(/^\{4\}, \{T\}: Draw a card\. Activate only if you control a creature with toughness 4 or greater\.$/, (R, m, ctx) => { act(R, ctx.line, '{4}, {T}', [{ t: 'draw', n: 1 }], a => { a.onlyIf = 'you control a creature with toughness 4 or greater'; }); });
cl(/^Whenever ~ becomes the target of a spell or ability an opponent controls, destroy target nonland permanent that player controls\.$/, R => { R.trig.push({ ev: 'targeted', fn: 'targetedByOpp', effects: [{ t: 'destroy', target: 'perm', filter: sfObj({ notTypes: ['Land'], ctl: 'opp' }) }] }); });
cl(/^Any number of target nonland permanents you control phase out\.$/, R => { R.spell = [cmd('clever')]; });
cl(/^Whenever ~ deals combat damage to an opponent, you draw a card and that player may draw a card\. If they do, that player can't attack you or permanents you control during their next turn\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('willieMail')] }); });
cl(/^Escalate—Tap an untapped creature you control\.$/, R => { R.escalateTap = true; });
cl(/^Whenever you cast a noncreature spell, you may copy it\. You may choose new targets for the copy\. Do this only once each turn\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', once: 'crucible', effects: [cmd('copyXSpell')] }); });
cl(/^The "legend rule" doesn't apply to creatures you control\.$/, R => { R.noLegendRule = true; });
cl(/^Whenever you cast a noncreature spell, ~ deals X damage to each opponent, where X is the number of colors that spell is\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('crystalBurn')] }); });
cl(/^~'s power is equal to the greatest mana value among noncreature permanents you control and noncreature cards in your graveyard\.$/, R => { R.cdaSet = { p: 'the greatest mana value among noncreature permanents you control and noncreature cards in your graveyard' }; });
cl(/^You may cast ~ from your graveyard by discarding a card in addition to paying its other costs\.$/, R => { R.gyCast = { life: 0, discard: 1, exile: false }; });
cl(/^You draw X cards and gain X life, where X is the number of colors among permanents you control and spells you've cast this turn\.$/, R => { R.spell = [cmd('firstFamily')]; });
cl(/^Put X \+1\/\+1 counters on target creature, where X is the number of noncreature, nonland cards in your graveyard\. It gains flying until end of turn\.$/, R => { R.spell = [{ t: 'cmd', id: 'flameOn', target: 'creature', good: true }]; });
cl(/^~ attacks an opponent with the most life among your opponents each combat if able unless you control a creature named Silver Surfer, ~'s Herald\.$/, R => { R.galactus = true; });
cl(/^When you next cast an instant or sorcery spell this turn, copy that spell\. You may choose new targets for the copy\.$/, R => { R.spell = [cmd('nextSpellCopy', { n: 1 })]; });
cl(/^Look at the top five cards of your library\. Put any number of permanent cards from among them onto the battlefield and the rest into your hand\. Exile ~\.$/, R => { R.spell = [cmd('genesisUltimatum')]; });
cl(/^Whenever ~ attacks, you may pay \{R\}\{G\}\{W\}\{U\}\. If you do, until end of turn, whenever he deals combat damage to an opponent, ~ deals that much damage to each other opponent\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('humanTorch')] }); R.trig.push({ ev: 'hitPlayer', fn: 'torchHit', effects: [cmd('torchSplash')] }); });
cl(/^Up to four target permanents you control gain indestructible until end of turn\.$/, R => { R.spell = [cmd('forceField')]; });
cl(/^Whenever you attack, you may pay \{R\}\{G\}\{W\}\{U\}\. When you do, target creature gets \+1\/\+0 until end of turn for each creature you control and can't be blocked this turn\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'invisibleWoman', effects: [cmd('invisibleWoman')] }); });
cl(/^At the beginning of combat on your turn, if you've cast a noncreature spell this turn, put a \+1\/\+1 counter on ~\. When you do, ~ and up to one other target creature you control can't be blocked this turn\.$/, R => { R.trig.push({ ev: 'combat', cond: "you've cast a noncreature spell this turn", effects: [cmd('lockjaw')] }); });
cl(/^Whenever an opponent casts their first spell each turn, that player exiles the top card of their library\. If it's a nonland card, you may cast it without paying its mana cost\.$/, R => { R.trig.push({ ev: 'cast', who: 'any', fn: 'oppFirstSpell', filter: 'any', effects: [cmd('mindsDilation')] }); });
cl(/^\{R\}\{G\}\{W\}\{U\}, \{T\}: Copy target triggered ability you control twice\. You may choose new targets for the copies\.$/, (R, m, ctx) => { act(R, ctx.line, '{R}{G}{W}{U}, {T}', [{ t: 'cmd', id: 'copyTrigger', target: 'spell', filter: 'ability', good: true }]); });
cl(/^Whenever one or more tokens you control enter, you may draw a card\.$/, R => { R.trig.push({ ev: 'tokenMade', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever ~ attacks a player who has more life than you, other creatures you control attacking that player get \+2\/\+0 until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('namorBoost')] }); });
cl(/^\{2\}, \{T\}: Exile target card from an opponent's graveyard\. If it's a creature card, draw a card\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'cmd', id: 'portalExile', target: 'gycard' }]); });
cl(/^At the beginning of your upkeep, if there are four or more creature cards exiled with ~, flip a coin\. If you lose the flip, sacrifice ~ and return a card exiled with it at random to its owner's hand\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('portalFlip')] }); });
cl(/^Put (?:X|97) \+1\/\+1 counters on target creature you control\. It deals damage equal to its power to each other creature\.$/, R => { R.spell = [{ t: 'cmd', id: 'novaFlame', n: 97, target: 'creature', mine: true, good: true }]; });
cl(/^Whenever ~ deals combat damage to a player, exile target instant or sorcery card from your graveyard chosen at random\. At the beginning of your next upkeep, you may cast that card without paying its mana cost\. If that spell would be put into your graveyard, exile it instead\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('powerPack')] }); });
cl(/^Create a token that's a copy of target creature you control, except it isn't legendary\.$/, R => { R.spell = [{ t: 'cmd', id: 'quantumCopy', target: 'creature', mine: true, good: true }]; });
cl(/^Draw cards equal to the number of cards in target opponent's hand\.$/, R => { R.spell = [{ t: 'cmd', id: 'recurringInsight', target: 'player', oppOnly: true, good: false }]; });
cl(/^Untap target creature\. After this main phase, there is an additional combat phase followed by an additional main phase\.$/, R => { R.spell = [{ t: 'cmd', id: 'seizeTheDay', target: 'creature', good: true }]; });
cl(/^Whenever ~ deals combat damage to a player, until the end of your next turn, target creature attacks that player each combat if able\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [{ t: 'cmd', id: 'surferMark', target: 'creature', good: false }] }); });
cl(/^Goad all creatures your opponents control\. Until your next turn, those creatures can't block\.$/, R => { R.spell = [cmd('taunt')]; });
cl(/^Whenever you cast a noncreature spell, you may have ~ become an artifact creature until end of turn\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('fantasticarAnimate')] }); });
cl(/^Whenever you cast your fourth noncreature spell each turn, you may sacrifice ~\. If you do, create four 4\/4 colorless Construct artifact creature tokens with flying and haste\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', fn: 'fourthNoncreature', effects: [cmd('fantasticarConstructs')] }); });
cl(/^Whenever ~ attacks, you may pay \{R\}\{G\}\{W\}\{U\}\. When you do, double the number of each kind of counter on any number of target permanents you control\.$/, R => { R.trig.push({ ev: 'attacks', effects: [cmd('theThing')] }); });
cl(/^As an additional cost to cast ~, sacrifice a legendary creature\.$/, R => { R.addCost = { sac: 'legendary creature' }; });
cl(/^Exile all creatures and graveyards\. Put ~ on the bottom of its owner's library\.$/, R => { R.spell = [cmd('ultimateNullification')]; });
COND_EXTRA.push(
    [/^you control a creature with toughness 4 or greater$/, () => P => P.bf.some(x => isCreature(x) && tou(x) >= 4)],
    [/^you've cast a noncreature spell this turn$/, () => P => P.nonCreatureCastTurn === G.turn]
);

// ===== Wakanda Forever =====
cl(/^When you cast ~ while you control your commander, copy ~\. You may choose a new target for the copy\.$/, R => { R.castTrig = [cmd('copySelfIfCommander')]; });
cl(/^Whenever you attack, target attacking creature gets \+X\/\+X until end of turn, where X is the number of creatures you control\.$/, R => { R.trig.push({ ev: 'attacks', anyMine: true, once: 'bast', effects: [{ t: 'cmd', id: 'bastBoost', target: 'creature', mine: true, only: sfObj({ states: ['attacking'] }), good: true }] }); });
cl(/^Whenever one or more creatures an opponent controls attack you and aren't blocked, that player draws three cards and gains control of ~\. Untap it\.$/, R => { R.trig.push({ ev: 'unblocked', fn: 'jewelUnblocked', once: 'jewel', effects: [cmd('coveted')] }); });
cl(/^If one or more creature tokens would be created under your control, that many 4\/4 white Angel creature tokens with flying and vigilance are created instead\.$/, R => { R.divineVisit = true; });
cl(/^Sacrifice ~: Legendary permanents you control gain indestructible until end of turn\.$/, (R, m, ctx) => { act(R, ctx.line, 'Sacrifice ~', [cmd('legendIndestructible')]); });
cl(/^Whenever an opponent attacks you with two or more creatures, draw a card\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attackedByTwo', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Put a \+1\/\+1 counter on target creature you control\. Then it fights target creature an opponent controls\. When the creature an opponent controls dies this turn, if you control your commander, you become the monarch\.$/, R => { R.spell = [{ t: 'cmd', id: 'fightThrone', target: 'creature', mine: true, good: true }]; });
cl(/^As long as ~ is monstrous, it has hexproof and indestructible\.$/, R => { selfCond(R, { cond: 'it is monstrous', p: 0, q: 0, kw: ['hexproof', 'indestructible'] }); });
cl(/^When you cast ~, copy it for each time you've cast your commander from the command zone this game\.$/, R => { R.castTrig = [cmd('hatutCopies')]; });
cl(/^\{2\}, \{T\}, Sacrifice ~: You may sacrifice a creature\. If you do, return that card to the battlefield under its owner's control with three \+1\/\+1 counters on it and you become the monarch\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Sacrifice ~', [cmd('heartShapedHerb')]); });
cl(/^At the beginning of combat on your turn, create a token that's a copy of equipped creature, except the token isn't legendary\. That token gains haste\.$/, R => { R.trig.push({ ev: 'combat', effects: [cmd('helmOfHost')] }); });
cl(/^Whenever one or more artifacts you control enter, put a \+1\/\+1 counter on ~\. This ability triggers only once each turn\.$/, R => { R.trig.push({ ev: 'enters', fn: 'artifactEnters', once: 'smith', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^At the beginning of your end step, choose one that hasn't been chosen —$/, (R, m, ctx) => { let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++; ctx.li = j - 1; R.trig.push({ ev: 'end', who: 'your', effects: [cmd('kimoyoBeads')] }); });
cl(/^When ~ enters, if you cast it, for each opponent, exile up to one target permanent that player controls with mana value 3 or greater\. For each permanent exiled this way, its controller draws a card\.$/, R => { R.etb.push(cmd('solomonFrogs')); });
cl(/^Sacrifice ~: Return target legendary creature card from your graveyard to the battlefield\. Activate only during your turn, before attackers are declared\.$/, (R, m, ctx) => { act(R, ctx.line, 'Sacrifice ~', [{ t: 'regrow', what: 'legendary creature', bf: true }], a => { a.onlyIf = 'it is your main phase before combat'; a.yourTurn = true; }); });
cl(/^At the beginning of your end step, if there is no monarch, target opponent becomes the monarch\.$/, R => { R.trig.push({ ev: 'end', who: 'your', cond: 'there is no monarch', effects: [cmd('mbakuMonarch')] }); });
cl(/^Whenever a creature attacks one of your opponents, if that player is the monarch, that creature gets \+1\/\+1 and gains trample until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'attacksMonarch', effects: [cmd('mbakuBoost')] }); });
cl(/^~ costs \{X\} less to cast, where X is the total mana value of noncreature artifacts you control\.$/, R => { R.costLessX = 'noncreatureArtifacts'; });
cl(/^Whenever ~ deals combat damage to a player, look at the top card of your library\. If it's a permanent card, you may put it onto the battlefield\. If you don't put it onto the battlefield, put it into your hand\.$/, R => { R.trig.push({ ev: 'hitPlayer', effects: [cmd('nyamiShip')] }); });
cl(/^Whenever your commander enters, you become the monarch\.$/, R => { R.trig.push(SPEC('enters', { commander: true }, { effects: [{ t: 'monarch' }] })); });
cl(/^At the beginning of combat on your turn, put a \+1\/\+1 counter on target creature\. Whenever that creature attacks the monarch this turn, it gains double strike and trample until end of turn\.$/, R => { R.trig.push({ ev: 'combat', effects: [{ t: 'cmd', id: 'okoyeMark', target: 'creature', good: true }] }); R.trig.push({ ev: 'attacks', fn: 'okoyeAttack', anyMine: true, effects: [cmd('okoyeBoost')] }); });
cl(/^When ~ enters, exile target creature an opponent controls until an opponent becomes the monarch\.$/, R => { R.etb.push({ t: 'cmd', id: 'palaceJailer', target: 'creature', theirs: true, good: false }); });
cl(/^If equipped creature would be dealt damage, prevent that damage and put that many \+1\/\+1 counters on it\.$/, R => { R.pantherHabit = true; });
cl(/^As long as you're the monarch, creatures with power 2 or less can't attack you\.$/, R => { R.ramonda = true; });
cl(/^Whenever ~ enters or attacks, create a number of 1\/1 white Soldier creature tokens equal to the number of \+1\/\+1 counters on it\.$/, R => { R.etb.push(cmd('talonSoldiers')); R.trig.push({ ev: 'attacks', effects: [cmd('talonSoldiers')] }); });
cl(/^\{T\}, Sacrifice ~: Destroy all permanents except for artifacts and lands\. Activate only during your upkeep\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('scourglass')], a => { a.upkeepOnly = true; }); });
cl(/^\{6\}, \{T\}: Return target artifact card from your graveyard to the battlefield with a finality counter on it\. Activate only as a sorcery\.$/, (R, m, ctx) => { act(R, ctx.line, '{6}, {T}', [{ t: 'regrow', what: 'artifact', bf: true, finality: true }], a => { a.sorcery = true; }); });
cl(/^Whenever ~ attacks, until end of turn, another target attacking creature gains flying and gets \+X\/\+0, where X is ~'s power\.$/, R => { R.trig.push({ ev: 'attacks', effects: [{ t: 'cmd', id: 'stormBoost', target: 'creature', mine: true, notSelf: true, only: sfObj({ states: ['attacking'] }), good: true }] }); });
cl(/^Whenever a creature with flying attacks you, ~ deals damage equal to her power to that creature\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'flierAttacksMe', effects: [cmd('stormSnipe')] }); });
cl(/^Whenever you cast an artifact spell with mana value 4 or greater, put two \+1\/\+1 counters on ~\.$/, R => { R.trig.push({ ev: 'cast', fn: 'artifactMv4', filter: 'artifact', effects: [{ t: 'counters', n: 2, target: 'self' }] }); });
cl(/^Whenever you cast an artifact spell with mana value 4 or greater, put a \+1\/\+1 counter on each creature you control\.$/, R => { R.trig.push({ ev: 'cast', fn: 'artifactMv4', filter: 'artifact', effects: [cmd('zuriCounters')] }); });
cl(/^When ~ enters, if there is no monarch, you become the monarch\.$/, R => { R.etb.push({ t: 'cmd', id: 'monarchIfNone' }); });
cl(/^Whenever equipped creature attacks the monarch, destroy target tapped nonland permanent that player controls\.$/, R => { R.trig.push({ ev: 'attacks', host: true, fn: 'hostAttacksMonarch', effects: [{ t: 'destroy', target: 'perm', filter: sfObj({ states: ['tapped'], notTypes: ['Land'], ctl: 'opp' }) }] }); });
cl(/^Equipped creature gets \+3\/\+0 and has trample and "Whenever ~ deals combat damage to a player, draw a card\."$/, R => { R.buff = { p: 3, q: 0, kw: ['trample'] }; R.grant = { trig: [{ ev: 'hitPlayer', effects: [{ t: 'draw', n: 1 }] }], acts: [] }; });
cl(/^Whenever you attack with your commander, if you control an artifact with mana value 4 or greater, create a 4\/4 green Rhino creature token with trample\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'commanderAttackFromGy', cond: 'you control an artifact with mana value 4 or greater', effects: [TOKEN(1, 4, 4, 'green Rhino', ['trample'])] }); });
cl(/^Reveal the top six cards of your library\. You may put a permanent card from among them onto the battlefield with an indestructible counter on it\. You may put a permanent card from among them into your hand\. Put the rest into your graveyard\.$/, R => { R.spell = [cmd('wakandaForever')]; });
CMD_REWRITES.push([/Mill three cards, then you may put an artifact or land card from among the milled cards into your hand\./g, 'Mill three cards, then you may put an artifact or land card from among the milled cards into your hand.']);
COND_EXTRA.push(
    [/^it is monstrous$/, () => (P, o) => !!o && !!o.monstrous],
    [/^there is no monarch$/, () => () => G.monarch === null || G.monarch === undefined],
    [/^you control an artifact with mana value 4 or greater$/, () => P => P.bf.some(x => /\bArtifact\b/.test(x.card.type) && (x.card.cmc || 0) >= 4)]
);
