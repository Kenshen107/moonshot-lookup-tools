// Spellslinger Duels - rules pack: Top-1000 round 2 (2026-10-07).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'top1000-r2',
    effects: [
        [/^put a \+1\/\+1 counter on each (white|blue|black|red|green) creature that entered (?:the battlefield )?this turn$/i, m => ({ t: 'countersEntered', color: { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[1].toLowerCase()] })],
        [/^~ deals damage equal to that creature's power to any target$/i, () => ({ t: 'dmg', n: 0, nFrom: 'ctxPow', target: 'any' })],
        [/^(?:you may )?cast spells this turn as though they had flash$/i, () => ({ t: 'flashTurn' })],
        [/^(?:you may )?cast a spell with mana value (\w+) or less from your hand without paying its mana cost$/i, m => ({ t: 'castFreeHand', mv: num(m[1]) })],
        [/^§digk (\d+) (\d+)$/, m => ({ t: 'dig', n: +m[1], what: 'card', to: 'hand', keep: +m[2] })],
        // Adeline: "for each opponent, create a 1/1 white Human creature token that's tapped and attacking that player ..." (two players: one opponent)
        [/^(?!.*\bnamed\b)(?:for each opponent, )?create (a|an|one|two|three|four|five) (\d+)\/(\d+) ([a-z ]+?) creature tokens?(?: with ([a-z ,]+?))? that(?:'s| are) tapped and attacking(?: that player(?: or a planeswalker they control)?)?$/i, m => ({ t: 'token', n: num(/^an?$/i.test(m[1]) ? 'one' : m[1].toLowerCase()), p: +m[2], q: +m[3], name: m[4].toLowerCase(), kw: m[5] ? splitKw(m[5]) : [], attacking: true })],
        [/^return target artifact, creature, enchantment, or planeswalker to its owner's hand$/i, () => ({ t: 'bounce', target: 'perm', filter: 'artifact, creature, enchantment, or planeswalker' })],
        [/^mill (\w+) cards, then return an? ([a-z ]+?) card from your graveyard to your hand$/i, m => [{ t: 'millSelf', n: num(m[1]) }, { t: 'regrow', what: m[2] }]],
        [/^draw a card, then you lose life equal to the number of cards in your hand$/i, () => [{ t: 'draw', n: 1 }, { t: 'loseSelf', n: 0, nCount: 'the number of cards in your hand' }]],
        [/^target player draws (\w+) cards, then discards (\w+) cards$/i, m => ({ t: 'loot', n: num(m[1]), d: num(m[2]) })],
        [/^double the number of \+1\/\+1 counters on each creature you control$/i, () => ({ t: 'doubleCountersAll' })],
        [/^put (a|an|one|two|three|four) -1\/-1 counters? on target creature(?: and draw a card)?$/i, m => [{ t: 'minusCounters', n: num(m[1] === 'a' || m[1] === 'an' ? 'one' : m[1]), target: 'creature' }, ...(/draw a card$/i.test(m[0]) ? [{ t: 'draw', n: 1 }] : [])]],
        [/^return another target artifact card from your graveyard to your hand$/i, () => ({ t: 'regrow', what: 'artifact', notSelf: true })],
        [/^destroy another target creature$/i, () => ({ t: 'destroy', target: 'creature', notSelf: true })],
        [/^if a creature is destroyed this way, you gain life equal to its toughness$/i, () => ({ t: 'gain', n: 0, nFrom: 'lastTou' })],
        [/^create that many treasure tokens$/i, () => ({ t: 'artToken', n: 0, nFrom: 'ctxCount', kind: 'treasure' })],
        [/^destroy target artifact, target creature, target enchantment, and target land$/i, () => [{ t: 'destroy', target: 'perm', filter: 'artifact' }, { t: 'destroy', target: 'creature' }, { t: 'destroy', target: 'perm', filter: 'enchantment' }, { t: 'destroy', target: 'perm', filter: 'land' }]],
        [/^destroy each nonland permanent with mana value (\w+) or less$/i, m => ({ t: 'wipe', how: 'destroy', what: `nonland permanents with mana value ${num(m[1])} or less` })],
        [/^add \{([WUBRG])\} or \{([WUBRG])\} for each permanent destroyed this way$/i, m => ({ t: 'addMana', choice: [m[1].toUpperCase(), m[2].toUpperCase()], n: 0, nFrom: 'lastWipeN', each: true })],
        [/^each player sacrifices all permanents they control that are one or more colors$/i, () => ({ t: 'sacColored' })],
        [/^draw cards equal to the greatest power among (non-human )?creatures you control$/i, m => ({ t: 'draw', n: 0, nFrom: m[1] ? 'greatestPowerNonHuman' : 'greatestPower' })],
        [/^non-human creatures you control get \+(\d+)\/\+(\d+) until end of turn$/i, m => ({ t: 'teamPump', p: +m[1], q: +m[2], kw: [], notType: 'Human' })],
        [/^destroy all creatures with mana value (\w+) or greater$/i, m => ({ t: 'wipe', how: 'destroy', what: `creatures with mana value ${num(m[1])} or greater` })],
        [/^exile all graveyards$/i, () => ({ t: 'exileGraveyards' })],
        [/^each (player|opponent) sacrifices (two|three) creatures(?: of their choice)?$/i, m => ({ t: 'edictN', n: num(m[2]), who: m[1] === 'player' ? 'each player' : 'opp' })],
        [/^search your library for up to two basic land cards that share a land type, put them onto the battlefield tapped, then shuffle$/i, () => ({ t: 'fetchLand', n: 2, what: 'basic land', bf: true, tapped: true, sameType: true })],
        [/^search your library for an? (Plains|Island|Swamp|Mountain|Forest) card and an? (Plains|Island|Swamp|Mountain|Forest) card, put them onto the battlefield tapped, then shuffle$/i, m => [{ t: 'fetchLand', n: 1, what: m[1], bf: true, tapped: true }, { t: 'fetchLand', n: 1, what: m[2], bf: true, tapped: true }]],
        [/^look at the top (\w+) cards of your library, then put them back in any order$/i, m => ({ t: 'reorderTop', n: num(m[1]) })],
        [/^draw a card, then put ~ on top of its owner's library$/i, () => [{ t: 'draw', n: 1 }, { t: 'selfToTop' }]],
        [/^~ deals x damage to any target, where x is (the number of .+)$/i, m => (countFn(m[1]) ? { t: 'dmg', n: 0, target: 'any', nCount: m[1] } : null)],
        [/^sacrifice (two|three) lands$/i, m => ({ t: 'sacLands', n: num(m[1]) })],
        [/^attach that equipment to target creature you control$/i, () => ({ t: 'attachCtx', target: 'creature', mine: true, good: true })],
        [/^roll a d20$/i, () => ({ t: 'roll', sides: 20 })],
        [/^you create a number of treasure tokens equal to the result$/i, () => ({ t: 'artToken', n: 0, nFrom: 'lastRoll', kind: 'treasure' })],
        [/^~ fights another target creature$/i, () => ({ t: 'fightSelf', target: 'creature', notSelf: true })],
        [/^~ deals that much damage to target opponent$/i, () => ({ t: 'dmg', n: 0, nFrom: 'ctxCount', target: 'player', oppOnly: true })],
        [/^add x mana of any one color, where x is (the number of .+)$/i, m => (countFn(m[1]) ? { t: 'addMana', any: 0, n: 0, nCount: m[1], anyN: true } : null)],
        [/^double the power and toughness of each creature you control until end of turn$/i, () => ({ t: 'doubleTeam' })],
        [/^adapt (\w+)$/i, m => ({ t: 'adapt', n: num(m[1]) })],
        [/^each player loses (\w+) life$/i, m => ({ t: 'eachLoses', n: num(m[1]) })],
    ],
    triggers: [
        [/^Whenever an opponent loses life, (.+)$/, () => ({ ev: 'loseLife', who: 'opp' })],
        [/^Whenever ~ or another creature or planeswalker you control dies, (.+)$/, () => [{ ev: 'dies' }, { ev: 'creatureDies', mine: true }]],
        [/^Whenever ~ or another (enchantment|artifact|Equipment) you control enters, (.+)$/, m => ({ ev: 'enters', typeEnter: { type: m[1][0].toUpperCase() + m[1].slice(1) }, self: true })],
        [/^When ~ enters or is put into a graveyard from the battlefield, (.+)$/, () => [{ ev: 'selfEnters' }, { ev: 'toGy' }]],
        [/^Whenever ~ or another (white|blue|black|red|green) creature you control enters, (.+)$/, m => ({ ev: 'enters', typeEnter: { creature: true, color: COLOR_WORDS[m[1]] }, self: true })],
        [/^Whenever one or more creatures you control with mana value (\w+) or less enter, (.+)$/, m => ({ ev: 'enters', typeEnter: { creature: true, mvMax: num(m[1]) }, self: true })],
        [/^Whenever one or more artifact creatures you control deal combat damage to a player, (.+)$/, () => ({ ev: 'combatHitAny', artifactCreature: true })],
        [/^Whenever a token you control leaves the battlefield, (.+)$/, () => ({ ev: 'leaves', tokenMine: true })],
        [/^Whenever another creature or artifact you control is put into a graveyard from the battlefield, (.+)$/, () => [{ ev: 'creatureDies', another: true, mine: true }, { ev: 'artifactDies', nonCreature: true }]],
        [/^Whenever a modified creature you control deals combat damage to a player, (.+)$/, () => ({ ev: 'hitPlayer', anyMine: true, modified: true })],
        [/^Whenever a creature you control with flying enters, (.+)$/, () => ({ ev: 'enters', typeEnter: { creature: true, kw: 'flying' }, self: true, ctxTarget: true })],
        [/^At the beginning of each combat, (.+)$/, () => ({ ev: 'combat', who: 'each' })],
        [/^Whenever an Equipment you control enters, (.+)$/, () => ({ ev: 'enters', typeEnter: { type: 'Equipment' }, self: true })],
        [/^Whenever an opponent plays a land, (.+)$/, () => ({ ev: 'landfall', theirs: true })],
        [/^Whenever a creature you control of the chosen type enters or attacks, (.+)$/, () => [{ ev: 'enters', typeEnter: { creature: true, chosen: true }, self: true }, { ev: 'attacks', chosen: true }]],
        [/^Whenever you cast a creature spell of the chosen type, (.+)$/, () => ({ ev: 'cast', filter: 'chosenType' })],
        [/^Whenever a nontoken creature you control enters, if it doesn't have the same name as another creature you control or a creature card in your graveyard, (.+)$/, () => ({ ev: 'enters', typeEnter: { creature: true, nontoken: true, uniqueName: true }, self: true })],
    ],
    lines: [
    (ctx) => {
        // Top-1000 round 2 (2026-10-07)
        const { R, card, lines } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^Fabricate (\d+)$/))) { R.etb.push({ t: 'fabricate', n: +m[1] }); { ctx.li = li; return true; } }
        if (/^Choose a Background$/.test(line)) { ctx.li = li; return true; } // deck building only
        if (/^~ is the chosen type in addition to its other types\.$/.test(line)) { R.chosenSelf = true; { ctx.li = li; return true; } }
        if (/^Each other creature you control of the chosen type enters with an additional \+1\/\+1 counter on it\.$/.test(line)) { R.mimic = true; { ctx.li = li; return true; } }
        if (/^As ~ enters, choose artifact, creature, enchantment, instant, or sorcery\.$/.test(line)) { R.chooseCardType = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Spells you cast of the chosen type cost \{(\d+)\} less to cast\.$/)) && R.chooseCardType) { R.reducer = { what: 'chosenCardType', n: +m[1] }; { ctx.li = li; return true; } }
        if (/^At the beginning of your upkeep, look at the top card of your library\. If it's a creature card of the chosen type, you may reveal it and put it into your hand\.$/.test(line)) { R.trig.push({ ev: 'upkeep', effects: [{ t: 'heraldHorn' }] }); { ctx.li = li; return true; } }
        if (/^Whenever a creature you control enters, draw a card if its power is 3 or greater\. Otherwise, put two \+1\/\+1 counters on it\.$/.test(line)) { R.trig.push({ ev: 'enters', typeEnter: { creature: true }, self: true, effects: [{ t: 'tributeTree' }] }); { ctx.li = li; return true; } }
        if (/^Each creature you control with a counter on it has "\{T\}: Add \{G\}\."$/.test(line)) { R.counterMana = 'G'; { ctx.li = li; return true; } }
        if (/^Tokens you control have "\{T\}: Add \{G\}\."$/.test(line)) { R.tokenMana = 'G'; { ctx.li = li; return true; } }
        if (/^If you would gain life, you gain twice that much life instead\.$/.test(line)) { R.doubleGain = true; { ctx.li = li; return true; } }
        if (/^If an opponent would lose life during your turn, they lose twice that much life instead\.$/.test(line)) { R.doubleOppLoss = true; { ctx.li = li; return true; } }
        if (/^If you would draw a card except the first one you draw in each of your draw steps, draw two cards instead\.$/.test(line)) { R.doubleDraw = true; { ctx.li = li; return true; } }
        if (/^Extort$/.test(line)) { R.trig.push({ ev: 'cast', filter: 'any', effects: [{ t: 'extort' }] }); R.kw.add('extort'); { ctx.li = li; return true; } }
        if (/^Evolve$/.test(line)) { R.trig.push({ ev: 'enters', evolve: true, effects: [{ t: 'evolve' }] }); R.kw.add('evolve'); { ctx.li = li; return true; } }
        if (/^Unleash$/.test(line)) { R.kw.add('unleash'); { ctx.li = li; return true; } }
        if (/^Cipher$/.test(line)) { R.cipher = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Scavenge ((?:\{[^}]+\})+)$/))) { R.gyActs = R.gyActs || []; R.gyActs.push({ cost: { mana: parseCost(m[1]), tap: false, exileSelfGy: true }, effects: [{ t: 'counters', n: Number(card.power) || 0, target: 'creature', good: true }], text: `Scavenge ${m[1]}`, sorcery: true, gy: true }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Mayhem ((?:\{[^}]+\})+)$/))) { R.mayhem = parseCost(m[1]); R.kw.add('mayhem'); { ctx.li = li; return true; } }
        if ((m = line.match(/^Web-slinging ((?:\{[^}]+\})+)$/))) { R.webSling = { cost: parseCost(m[1]), text: m[1] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Teamwork (\d+)$/))) { R.teamwork = +m[1]; { ctx.li = li; return true; } }
        if (/^Choose one\. If ~ was cast using teamwork, choose both instead\.$/.test(line)) { lines[li] = 'Choose one —'; R.modeTeamwork = true; li--; { ctx.li = li; return true; } }
        if (/^As ~ enters(?: the battlefield)?, choose a color\.$/.test(line)) { R.chooseColor = true; { ctx.li = li; return true; } }
        // Thriving lands
        if ((m = line.match(/^~ enters tapped\. As it enters, choose a color other than (white|blue|black|red|green)\.$/))) { R.entersTapped = true; R.chooseColor = true; R.chooseColorNot = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[1]]; { ctx.li = li; return true; } }
        if ((m = line.match(/^Creatures you control of the chosen color get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ type: null, colorChosen: true, p: +m[1], q: +m[2], kw: [] }); { ctx.li = li; return true; } }
        // Razorkin Needlehead: "~ has first strike during your turn"
        if ((m = line.match(/^~ has ([a-z ,]+) during your turn\.$/)) && allKnown(splitKw(m[1]))) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn', p: 0, q: 0, kw: splitKw(m[1]) }); { ctx.li = li; return true; } }
        if (/^As an additional cost to cast ~, discard a card or pay (\d+) life\.$/.test(line)) { R.addCost = { discard: true, orLife: +line.match(/pay (\d+) life/)[1] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ enters with an? (\w+) counter on it for each (.+)\.$/)) && countFn(`the number of ${m[2]}`)) { R.etbNamed = { kind: m[1], what: `the number of ${m[2]}` }; { ctx.li = li; return true; } }
        return false;
    }
    ],
});
