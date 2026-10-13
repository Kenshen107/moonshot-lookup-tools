// Spellslinger Duels - rules pack: Top-1000 round (2026-10-06).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'top1000',
    effects: [
        [/^each player sacrifices a nontoken creature$/, () => ({ t: 'edict', who: 'each player', what: 'nontoken creature' })],
        [/^each player who can't discards a card$/, () => ({ t: 'discardIfNoSac' })],
        [/^target opponent loses that much life$/, () => ({ t: 'drain', n: 0, nFrom: 'ctxCount' })],
        [/^each opponent loses x life, where x is your devotion to (white|blue|black|red|green)$/, m => ({ t: 'drain', n: 0, nFrom: `devotion:${COLOR_WORDS[m[1]]}` })],
        [/^you gain life equal to the life lost this way$/, () => ({ t: 'gain', n: 0, nFrom: 'lastLost' })],
        [/^you gain 1 life for each spell you've cast this turn$/, () => ({ t: 'gain', n: 0, nFrom: 'myCasts' })],
        [/^each player draws a card, then discards a card$/, () => ({ t: 'lootAll' })],
        [/^untap target (forest|legendary permanent)$/, m => ({ t: 'untap', target: 'perm', filter: m[1] === 'forest' ? 'Forest' : m[1] })],
        [/^target legendary creature gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[1]), target: 'creature', only: 'legendary creature', good: true })],
        [/^target creature with power (\w+) or less can't be blocked this turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', only: `creature with power ${num(m[1])} or less`, good: true })],
        [/^exile target noncreature artifact or noncreature enchantment$/, () => ({ t: 'exile', target: 'perm', filter: 'noncreature artifact or noncreature enchantment' })],
        [/^draw cards equal to the sacrificed creature's power, then discard (\w+) cards?$/, m => ({ t: 'loot', n: 0, nFrom: 'sacPow', d: num(m[1]) })],
        [/^target player mills cards equal to the sacrificed creature's power$/, () => ({ t: 'mill', n: 0, nFrom: 'sacPow' })],
        [/^(?:you may )?put target (creature|artifact|enchantment|instant or sorcery) card from your graveyard on top of your library$/, m => ({ t: 'regrow', what: m[1], top: true })],
        [/^(?:you may )?return target permanent card with mana value (\w+) or less from your graveyard to the battlefield$/, m => ({ t: 'regrow', what: `permanent mv${num(m[1])}`, bf: true })],
        [/^create x (\d+)\/(\d+) ([a-z ]+?) creature tokens?(?: with ([a-z ,]+))?, where x is the number of \+1\/\+1 counters on ~$/, m => ({ t: 'token', n: 0, nFrom: 'srcLastCounters', p: +m[1], q: +m[2], name: m[3], kw: m[4] ? splitKw(m[4]) : [] })],
        [/^~ deals damage equal to its power to any target$/, () => ({ t: 'ctxPowDmg', target: 'any' })],
        [/^add \{([WUBRGC])\} for each tapped land your opponents control$/i, m => ({ t: 'addMana', color: m[1].toUpperCase(), count: 'the number of tapped lands your opponents control' })],
        [/^put your commander into your hand from the command zone$/, () => ({ t: 'cmdToHand' })],
        [/^create a food token or a treasure token$/, () => ({ t: 'foodOrTreasure' })],
        [/^that player draws an additional card$/, () => ({ t: 'activeDraws', n: 1 })],
        [/^return it to the battlefield under its owner's control\. it's an enchantment$/, () => ({ t: 'enduring' })],
        // ---- Top-1000 round (2026-10-06): instants and sorceries ----
        [/^(?:its|that land's|that permanent's|that creature's) controller may search their library for a basic land card, put (?:it|that card) onto the battlefield( tapped)?, then shuffle$/, m => ({ t: 'lastCtrlFetch', tapped: !!m[1] })],
        [/^that player may search their library for a land card with a basic land type, put it onto the battlefield, then shuffle$/, () => ({ t: 'lastCtrlFetch', tapped: false })],
        [/^each player searches their library for a basic land card, puts it onto the battlefield, then shuffles$/, () => ({ t: 'eachFetchBasic' })],
        [/^(?:its|that creature's|that permanent's) controller creates (\w+) (\d+)\/(\d+) ([a-z ]+?) creature tokens?(?: with ([a-z ,]+))?$/, m => ({ t: 'token', n: num(m[1]), p: +m[2], q: +m[3], name: m[4], kw: m[5] ? splitKw(m[5]) : [], forLastCtrl: true })],
        [/^(?:its|that creature's|that permanent's) controller creates (\w+) (treasure|food|clue) tokens?$/, m => ({ t: 'artToken', n: num(m[1]), kind: m[2], forLastCtrl: true })],
        [/^its controller gains (\w+) life$/, m => ({ t: 'lastCtrlGain', n: num(m[1]) })],
        [/^(destroy|exile) target (nonbasic land an opponent controls|permanent with mana value \w+ or greater|nonland permanent with mana value \w+ or less|artifact, creature, or planeswalker|artifact, enchantment, or nonbasic land an opponent controls|creature or planeswalker an opponent controls)$/, m => ({ t: m[1], target: 'perm', filter: m[2] })],
        [/^counter target (enchantment, instant, or sorcery|noncreature|instant or sorcery) spell unless its controller pays \{(\d+)\}$/, m => ({ t: 'counter', target: 'spell', filter: m[1], unless: +m[2] })],
        [/^counter target enchantment, instant, or sorcery spell$/, () => ({ t: 'counter', target: 'spell', filter: 'enchantment, instant, or sorcery' })],
        [/^at the beginning of your next main phase, add an amount of \{c\} equal to that spell's mana value$/i, () => ({ t: 'delayedManaDrain' })],
        [/^its controller may draw up to two cards at the beginning of the next turn's upkeep$/, () => ({ t: 'delayedDraw', who: 'lastCtrl', n: 2 })],
        [/^you draw a card at the beginning of the next turn's upkeep$/, () => ({ t: 'delayedDraw', who: 'you', n: 1 })],
        [/^search your library for (a|an|up to (\w+)) (?:([a-z ,]+?) )?cards?(?: with power (\w+) or less)?(?:, reveal (?:it|that card|them))?, then shuffle and put (?:that card|the card) on top$/, m => ({ t: 'tutor', what: (m[3] || 'card').replace(/,? or /g, ' or '), top: true })],
        [/^search your library for (a|an|up to (\w+)) (?:([a-z ,]+?) )?cards?(?: with power (\w+) or less)?(?:, reveal (?:it|that card|them))?, put (?:it|that card|them) (into your hand|into your graveyard)(, discard a card at random)?, then shuffle$/, m => [{ t: 'tutor', what: (m[3] || 'card').replace(/,? or /g, ' or ') + (m[4] ? ` pow${num(m[4])}` : ''), n: m[2] ? num(m[2]) : 1, toGy: /graveyard/.test(m[5]) }, ...(m[6] ? [{ t: 'discardSelfRandom', n: 1 }] : [])]],
        [/^search your library for (a|an|up to (\w+)) ([a-z ,]+?) cards?(?: with power (\w+) or less)?, reveal that card, put it into your hand, then shuffle$/, m => ({ t: 'tutor', what: m[3].replace(/,? or /g, ' or ') + (m[4] ? ` pow${num(m[4])}` : '') })],
        [/^search your library for an? (basic )?((?:plains|island|swamp|mountain|forest)(?:, (?:plains|island|swamp|mountain|forest))*,? or (?:plains|island|swamp|mountain|forest)) card, put it onto the battlefield( tapped)?, then shuffle$/i, m => ({ t: 'fetchLand', n: 1, what: (m[1] ? 'basic ' : '') + m[2].toLowerCase().replace(/,? or |, /g, ' or '), bf: true, tapped: !!m[3] })],
        [/^each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way$/, () => ({ t: 'wheel', n: 'most' })],
        [/^each player discards their hand, then draws (\w+) cards$/, m => ({ t: 'wheel', n: num(m[1]) })],
        [/^draw cards equal to the number of cards in your hand plus one$/, () => ({ t: 'draw', n: 0, nFrom: 'handPlusOne' })],
        [/^you have no maximum hand size for the rest of the game$/, () => ({ t: 'noMaxHandForever' })],
        [/^(?:you may )?put a land card from your hand onto the battlefield$/, () => ({ t: 'putLandFromHand' })],
        [/^each opponent draws a card, then you draw a card for each opponent who drew a card this way$/, () => [{ t: 'oppDraws', n: 1 }, { t: 'draw', n: 1 }]],
        [/^choose a creature type$/i, () => ({ t: 'noop' })],
        [/^draw a card for each permanent you control of that type$/i, () => ({ t: 'draw', n: 0, nFrom: 'commonTypeCount' })],
        [/^draw a card for each creature you control with a \+1\/\+1 counter on it$/, () => ({ t: 'draw', n: 0, nFrom: 'countersCreatures' })],
        [/^those creatures gain indestructible until end of turn$/, () => ({ t: 'teamPump', p: 0, q: 0, kw: ['indestructible'], withCounter: true })],
        [/^~ deals x damage to each creature, where x is the number of creatures on the battlefield$/i, () => ({ t: 'dmg', n: 0, nFrom: 'creaturesAll', target: 'allCreatures' })],
        [/^you gain (\w+) life for each creature destroyed this way$/, m => ({ t: 'gain', n: 0, nFrom: 'lastWipeN', per: num(m[1]) })],
        [/^creatures you control gain ([a-z ,]+?) and get \+x\/\+x(?: until end of turn)?, where x is (the greatest power among creatures you control|the number of creatures you control)(?: until end of turn)?$/i, m => ({ t: 'teamPump', p: 0, q: 0, kw: splitKw(m[1]), xFrom: /greatest/.test(m[2]) ? 'greatestPower' : 'creatureCount' })],
        [/^(destroy|return) all creatures that aren't of the chosen type(?: to (?:their owners' hands|its owner's hand))?$/i, m => ({ t: 'wipeNotType', how: m[1].toLowerCase() })],
        [/^each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield$/, () => ({ t: 'livingDeath' })],
        [/^put all creature cards from all graveyards onto the battlefield under your control$/, () => ({ t: 'riseDark' })],
        [/^return all land cards from your graveyard to the battlefield tapped$/, () => ({ t: 'landsFromGy' })],
        [/^untap all nonland permanents you control$/, () => ({ t: 'untapNonland' })],
        [/^target creature gets -1\/-1 until end of turn for each (.+)$/i, m => (countFn(`the number of ${m[1]}`) ? { t: 'pump', p: -1, q: -1, kw: [], per: `the number of ${m[1]}`, target: 'creature', good: false } : null)],
        [/^target creature you control deals damage equal to its power to each other creature and each opponent$/, () => ({ t: 'ignition', target: 'creature', mine: true, good: true })],
        [/^exile (?:target creature you control|target artifact or creature you control), then return (?:that card|it) to the battlefield under (?:your|its owner's) control$/, () => ({ t: 'flicker', target: 'creature', mine: true, good: true })],
        [/^exile up to one target (?:artifact or creature|creature|nonland permanent) you control, then return that card to the battlefield under (?:your|its owner's) control$/, () => ({ t: 'flicker', target: 'perm', filter: 'nonland permanent you control', mine: true, good: true, optional: true })],
        [/^exile two target artifacts, creatures, and\/or lands you control, then return those cards to the battlefield under your control$/, () => ({ t: 'flicker', target: 'perm', filter: 'artifact, creature, or land you control', mine: true, good: true, multi: 2 })],
        [/^if it's a spirit, put a \+1\/\+1 counter on it$/i, () => ({ t: 'countersLastIfType', type: 'Spirit', n: 1 })],
        [/^put target creature card from a graveyard onto the battlefield under your control$/, () => ({ t: 'regrow', what: 'creature', bf: true, anyGy: true })],
        [/^you lose life equal to that card's mana value$/, () => ({ t: 'loseSelf', n: 0, nFrom: 'lastMv' })],
        [/^create a token that's a copy of target creature(?: you control)?(?:, except the token has flying and it isn't legendary)?$/, m => ({ t: 'tokenCopy', target: 'creature', mine: /you control/.test(m[0]), flying: /flying/.test(m[0]), good: true })],
        [/^create five of those tokens instead$/, () => null],
        [/^for each token you control, create a token that's a copy of that permanent$/, () => ({ t: 'copyEachToken' })],
        [/^target permanent you control gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[1]), target: 'perm', filter: 'permanent you control', mine: true, good: true })],
        [/^look at target player's hand$/, () => ({ t: 'revealHand' })],
        [/^return target spell to its owner's hand$/, () => ({ t: 'bounceSpell', target: 'spell', filter: 'any' })],
        [/^your opponents can't cast (noncreature )?spells this turn$/, m => ({ t: 'silence', noncreature: !!m[1] })],
        [/^choose target creature$/, () => ({ t: 'markMine', target: 'creature', good: true })],
        [/^that creature gains "when ~ dies, return it to the battlefield tapped under its owner's control\." until end of turn$/i, () => ({ t: 'pump', p: 0, q: 0, kw: ['returnondeath'], target: 'last', good: true })],

        [/^return all cards exiled with ~ to their owner's hand and you lose that much life$/, () => ({ t: 'asmoReturn' })],
        [/^amass ([A-Za-z]+?)s? (\w+)$/i, m => ({ t: 'amass', n: num(m[2]), type: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() })],
        [/^§toplandhand$/, () => ({ t: 'topLandOrHand' })],
        [/^§revealland$/, () => ({ t: 'revealToLand' })],
        [/^§digland (\d+)$/, m => ({ t: 'digLand', n: +m[1] })],
        [/^§tide$/, () => ({ t: 'consumingTide' })],
        [/^§peer$/, () => ({ t: 'peer', target: 'player', good: true })],
        [/^§gollum$/, () => ({ t: 'gollum' })],
        [/^(?:you may )?play that card for as long as you control ~$/, () => ({ t: 'playExiled', whileSrc: true })],
        [/^put a \+1\/\+1 counter on target creature you control without flying$/, () => ({ t: 'counters', n: 1, target: 'creature', only: 'creature without flying you control', mine: true, good: true })],
        [/^put a \+1\/\+1 counter on target creature you control other than ~(?: [A-Z][a-z]+)?$/, () => ({ t: 'counters', n: 1, target: 'creature', mine: true, notSelf: true, good: true })],
        [/^put a \+1\/\+1 counter on each other creature you control that's a token or an? ([A-Z][a-z]+)$/, m => ({ t: 'teamCounters', n: 1, other: true, tokenOr: m[1] })],
        [/^put a \+1\/\+1 counter on each attacking creature with a \+1\/\+1 counter on it$/, () => ({ t: 'teamCounters', n: 1, withCounter: true, attacking: true })],
        [/^put another \+1\/\+1 counter on ~$/, () => ({ t: 'counters', n: 1, target: 'self' })],
        [/^put (\w+) \+1\/\+1 counters? on that token$/, m => ({ t: 'countersMade', n: num(m[1]) })],
        [/^put (\w+) \+1\/\+1 counters? on another target creature$/, m => ({ t: 'counters', n: num(m[1]), target: 'creature', notSelf: true, good: true })],
        [/^double the number of \+1\/\+1 counters on (~|target creature)$/, m => (m[1] === '~' ? { t: 'doubleCounters', target: 'self' } : { t: 'doubleCounters', target: 'creature', good: true })],
        [/^remove an? \+1\/\+1 counter from (?:it|~)$/, () => ({ t: 'removeCounterSelf' })],
        [/^distribute (\w+) \+1\/\+1 counters among (?:any number of target creatures|target creature) you control(?:, where x is the number of \+1\/\+1 counters on ~)?$/i, m => ({ t: 'counters', n: num(m[1]) === 'X' ? 0 : num(m[1]), nFrom: num(m[1]) === 'X' ? 'srcLastCounters' : undefined, target: 'creature', mine: true, good: true, div: num(m[1]) === 'X' ? 99 : num(m[1]) })],
        [/^destroy that creature$/, () => ({ t: 'destroy', target: 'creature' })],
        [/^~ deals damage equal to the number of (.+) to (target creature|any target)$/, m => (countFn(`the number of ${m[1]}`) ? { t: 'dmg', n: 0, target: m[2] === 'any target' ? 'any' : 'creature', nCount: `the number of ${m[1]}` } : null)],
        [/^~ deals damage equal to the number of (.+) to (each opponent|defending player|target opponent|target player)$/, m => (countFn(`the number of ${m[1]}`) ? { t: 'dmg', n: 0, target: 'opponents', nCount: `the number of ${m[1]}` } : null)],
        [/^~ deals (\w+) damage to target creature and x damage to that creature's controller, where x is the number of (.+)$/i, m => (countFn(`the number of ${m[2]}`) ? [{ t: 'dmg', n: num(m[1]), target: 'creature' }, { t: 'lastCtrlDmg', n: 0, nCount: `the number of ${m[2]}` }] : null)],
        [/^~ (?:also )?deals (\w+) damage to that creature's controller$/, m => ({ t: 'lastCtrlDmg', n: num(m[1]) })],
        [/^~ deals x damage to each opponent, where x is the number of (.+?)(?: other than ~)?$/i, m => (countFn(`the number of ${/ other than ~$/.test(m[0]) ? 'other ' : ''}${m[1]}`) ? { t: 'dmg', n: 0, target: 'opponents', nCount: `the number of ${/ other than ~$/.test(m[0]) ? 'other ' : ''}${m[1]}` } : null)],
        [/^~ deals x damage to target creature an opponent controls, where x is the amassed army's power$/i, () => ({ t: 'dmg', n: 0, target: 'creature', theirs: true, nFrom: 'armyPow' })],
        [/^~ gets \+x\/\+x until end of turn, where x is the number of (.+)$/i, m => (countFn(`the number of ${m[1]}`) ? { t: 'pump', p: 1, q: 1, kw: [], per: `the number of ${m[1]}`, target: 'self', good: true } : null)],
        [/^target creature you control gains ([a-z ,]+?) and gets \+x\/\+x, where x is the number of (.+?)(?: until end of turn)?$/i, m => (countFn(`the number of ${m[2]}`) ? { t: 'pump', p: 1, q: 1, kw: splitKw(m[1]), per: `the number of ${m[2]}`, target: 'creature', mine: true, good: true } : null)],
        [/^target creature you control gets \+(\d+)\/\+(\d+) until end of turn for each (.+)$/, m => (countFn(`the number of ${m[3]}`) ? { t: 'pump', p: +m[1], q: +m[2], kw: [], per: `the number of ${m[3]}`, target: 'creature', mine: true, good: true } : null)],
        [/^target creature you control can't be blocked this turn$/, () => ({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', mine: true, good: true })],
        [/^another target ([A-Z][a-z]+) you control gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[2]), target: 'creature', only: m[1], mine: true, notSelf: true, good: true })],
        [/^tap target creature an opponent controls and put (\w+) stun counters on (?:it|~)$/, m => ({ t: 'tap', target: 'creature', theirs: true, stun: num(m[1]), good: false })],
        [/^tap target nonenchantment creature$/, () => ({ t: 'tap', target: 'creature', only: 'nonenchantment creature', good: false })],
        [/^target creature doesn't untap during its controller's next untap step$/, () => ({ t: 'freeze', target: 'creature', good: false })],
        [/^return another target nonland permanent to its owner's hand$/, () => ({ t: 'bounce', target: 'perm', filter: 'nonland permanent', notSelf: true })],
        [/^return target spell you don't control to its owner's hand$/, () => ({ t: 'bounceSpell', target: 'spell', filter: 'notMine' })],
        [/^return target creature card from your graveyard to the battlefield with (\w+) additional \+1\/\+1 counters on (?:it|~)$/, m => ({ t: 'regrow', what: 'creature', bf: true, counters: num(m[1]) })],
        [/^return target creature card with mana value (\w+) or less from your graveyard to the battlefield$/, m => ({ t: 'regrow', what: `creature mv${num(m[1])}`, bf: true })],
        [/^that creature can't attack or block for as long as you control ~$/, () => ({ t: 'lockReturned' })],
        [/^exile target creature card from your graveyard$/, () => ({ t: 'exileGyMine', what: 'creature' })],
        [/^put all cards exiled with (?:~|it) onto the battlefield$/, () => ({ t: 'returnExiledByMe' })],
        [/^you gain life equal to the greatest toughness among other creatures you control$/, () => ({ t: 'gain', n: 0, nFrom: 'greatestTouOther' })],
        [/^you lose life equal to that permanent's mana value$/, () => ({ t: 'loseSelf', n: 0, nFrom: 'lastMv' })],
        [/^create a food token for each creature sacrificed this way$/i, () => ({ t: 'artToken', n: 0, nFrom: 'lastEdictN', kind: 'food' })],
        [/^(that player|defending player) sacrifices a creature(?: with the least power among creatures they control)?$/, m => ({ t: 'edict', who: 'each opponent', what: 'creature', leastPow: /least power/.test(m[0]) })],
        [/^(?:search your library and\/or graveyard|target player searches their library and\/or graveyard) for a card named (.+?), reveals? it, and puts? it into (?:your|their) hand$/i, m => ({ t: 'tutorNamed', name: m[1], gy: true })],
        [/^search your library for a card named (.+?), reveal it, put it into your hand(?:, then shuffle)?$/, m => ({ t: 'tutorNamed', name: m[1] })],
        [/^put (?:it|~) into its owner's library fifth from the top$/, () => ({ t: 'selfToLibrary', pos: 5 })],
        [/^put ~ on the bottom of its owner's library$/, () => ({ t: 'selfToLibrary', pos: 'bottom' })],
        [/^have target opponent draw a card$/, () => ({ t: 'optOppDraw' })],
        [/^copy that spell$/, () => ({ t: 'copyLastCast' })],
        [/^have ~'s base power become 1 plus the greatest power among other creatures you control until end of turn$/, () => ({ t: 'arni' })],
        [/^gain control of target creature for as long as you control ~$/, () => ({ t: 'stealWhile', target: 'creature', theirs: true })],
        [/^gain control of target creature an opponent controls until end of turn$/, () => ({ t: 'steal', target: 'creature' })],
        [/^gain control of target nonlegendary creature an opponent controls with power less than or equal to the amassed army's power until end of turn$/i, () => ({ t: 'steal', target: 'creature', only: 'nonlegendary creature power<=army' })],
        [/^target land gains "\{t\}: add \{g\}\{g\}\{g\}" until end of turn$/i, () => ({ t: 'landMana', target: 'perm', filter: 'land you control', mine: true, good: true })],
        [/^~ gains your choice of ([a-z ,]+) until end of turn$/, m => ({ t: 'pumpChoice', kws: m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean) })],
        [/^create a (\d+)\/(\d+) ([a-z ]+?) (artifact )?creature token with ([a-z ,]+) named ([a-z ]+) that's tapped and attacking$/i, m => ({ t: 'token', n: 1, p: +m[1], q: +m[2], name: m[3].toLowerCase(), kw: splitKw(m[5]), artifact: !!m[4], named: m[6].replace(/\b\w/g, c => c.toUpperCase()), attacking: true })],
        [/^create a token that's a copy of target (artifact, creature, or land|creature)$/, m => ({ t: 'tokenCopy', target: 'perm', filter: m[1], good: true })],
        [/^destroy target creature that blocked or was blocked by a legendary creature this turn$/, () => ({ t: 'destroy', target: 'perm', filter: 'legendCombat' })],
        [/^destroy target creature with power or toughness (\w+) or greater$/, m => ({ t: 'destroy', target: 'perm', filter: `creature with power or toughness ${num(m[1])} or greater` })],
        [/^(destroy|exile) target creature or enchantment (?:an opponent controls|you don't control)$/, m => ({ t: m[1].toLowerCase(), target: 'perm', filter: "creature or enchantment you don't control" })],
        [/^exile (another )?target nonland permanent you don't control until ~ leaves the battlefield$/, m => ({ t: 'exile', target: 'perm', filter: "nonland permanent you don't control", notSelf: !!m[1], until: true })],
        [/^exile enchanted creature$/, () => ({ t: 'exileHost' })],
        [/^return ~ from your graveyard to your hand$/, () => ({ t: 'returnSelfGy' })],
        [/^have that creature's base power and toughness become (\d+)\/(\d+) until end of turn$/, m => ({ t: 'setBaseOtherAttacker', p: +m[1], q: +m[2] })],

        [/^attach ~ to it$/, () => ({ t: 'attachSelfToMade' })],
        [/^attach (?:it|~) to target creature you control$/, () => ({ t: 'attachSelf', target: 'creature', mine: true, good: true })],
        [/^attach (?:it|~) to target legendary creature you control$/, () => ({ t: 'attachSelf', target: 'creature', mine: true, good: true, only: 'legendary creature' })],
        [/^attach any number of equipment you control to (target creature you control|it|that creature)$/i, m => ({ t: 'attachAllEquip', target: /^target/.test(m[1]) ? 'creature' : 'last', mine: true, good: true })],
        [/^attach target equipment you control with mana value 2 or 3 to ~$/i, () => ({ t: 'attachEquipToSelf', target: 'perm', filter: 'Equipment you control mv2-3', mine: true, good: true })],
        [/^(?:that creature|it) gains ([a-z ,]+?) until end of turn and must be blocked this turn if able$/, m => ({ t: 'pump', p: 0, q: 0, kw: [...splitKw(m[1]), 'mustbeblocked'], target: 'last', good: true })],
        [/^destroy all equipment attached to that creature$/i, () => ({ t: 'destroyAttachedEquip', target: 'last' })],
        [/^target (attacking equipped|equipped|attacking) creature gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[2]), target: 'creature', only: `${m[1]} creature`, good: true })],
    ],
    triggers: [
        [/^Whenever a creature you control with power (\w+) or greater enters, (.+)$/, m => ({ ev: 'enters', filt: `power>=${num(m[1])}` })],
        [/^Whenever an opponent draws their second card each turn, (.+)$/, () => ({ ev: 'draw', who: 'opp', nth: 2 })],
        [/^Whenever an opponent draws a card, (.+)$/, () => ({ ev: 'draw', who: 'opp' })],
        [/^Whenever a player casts their second spell each turn, (.+)$/, () => ({ ev: 'cast', who: 'any', filter: 'any', nth: 2 })],
        [/^Whenever you cast an Aura, Equipment, or Vehicle spell, (.+)$/, () => ({ ev: 'cast', filter: 'types:Aura|Equipment|Vehicle' })],
        [/^Whenever a creature an opponent controls enters, (.+)$/, () => ({ ev: 'enters', theirsEnter: true })],
        [/^Whenever (an|another) artifact you control enters, (.+)$/, m => ({ ev: 'enters', artEnter: true, another: m[1] === 'another' })],
        [/^Whenever you create or sacrifice a token, (.+)$/, () => [{ ev: 'tokenMade' }, { ev: 'sacrificed', tokenMine: true }]],
        [/^Whenever a player sacrifices a permanent, (.+)$/, () => ({ ev: 'sacrificed', anySac: true })],
        [/^Whenever you sacrifice an? ([A-Z][a-z]+), (.+)$/, m => ({ ev: 'sacrificed', sacType: m[1] })],
        [/^At the beginning of each opponent's upkeep, (.+)$/, () => ({ ev: 'upkeep', who: 'opp' })],
        [/^At the beginning of each player's draw step, (.+)$/, () => ({ ev: 'upkeep', who: 'each' })],
        [/^At the beginning of your draw step, (.+)$/, () => ({ ev: 'upkeep', who: 'your' })],
        [/^At the beginning of your (?:first|precombat) main phase, (.+)$/, () => ({ ev: 'main1' })],
        [/^When ~ enters untapped, (.+)$/, () => ({ ev: 'selfEnters', cond: '~ is untapped' })],
    ],
    lines: [
    (ctx) => {
        // Top-1000 round (2026-10-06): lands and mana
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^When ~ dies, if it was a creature, return it to the battlefield under its owner's control\. It's an enchantment\.(?: \(It's not a creature\.\))?$/.test(line)) { R.trig.push({ ev: 'dies', effects: [{ t: 'enduring' }] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^\{T\}: Add \{([WUBRG])\}\. Activate only if you control an? (\w+) or an? (\w+)\.$/))) { R.condMana = { color: m[1], types: [m[2], m[3]] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^\{T\}: Add \{C\}\. If you control an Urza's ([A-Za-z-]+) and an Urza's ([A-Za-z-]+), add ((?:\{C\})+) instead\.$/))) { R.mana = { colors: ['C'], n: 1, tron: { need: [`Urza's ${m[1]}`, `Urza's ${m[2]}`].map(x => x.replace(/Power-Plant/, 'Power Plant')), n: (m[3].match(/C/g) || []).length } }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Lands you control have "\{T\}: Add one mana of any color\."$/)) || /^Lands you control are every basic land type in addition to their other types\.$/.test(line)) { R.landsAnyColor = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Each land is an? (Plains|Island|Swamp|Mountain|Forest) in addition to its other land types\.$/))) { R.landTypeAll = m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^(?:Other )?[Cc]reatures you control have "\{T\}: Add one mana of any color\."$/))) { R.creatureMana = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Whenever you tap an? (Plains|Island|Swamp|Mountain|Forest) for mana, add an additional \{([WUBRG])\}\.$/))) { R.extraMana = { type: m[1], color: m[2] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Whenever enchanted land is tapped for mana, its controller adds an additional \{([WUBRG])\}\.$/))) { R.extraMana = { host: true, color: m[1] }; { ctx.li = li; return true; } }
        if (/^Enchant Forest$/.test(line)) { R.aura = true; R.auraLand = true; R.auraForest = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ costs \{1\} less to cast for each creature on the battlefield\.$/))) { R.costLess = { n: 1, what: 'the number of creatures on the battlefield' }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ costs \{X\} less to cast, where X is the (total power|greatest power) (?:of|among) creatures you control\.$/))) { R.costLessX = m[1]; { ctx.li = li; return true; } }
        if (/^~ costs \{X\} less to cast, where X is the total mana value of historic permanents you control\.$/.test(line)) { R.costLessX = 'historic'; { ctx.li = li; return true; } }
        if ((m = line.match(/^(White|Blue|Black|Red|Green) creature spells you cast cost \{(\d+)\} less to cast\.$/))) { R.reducer = { what: `color:${COLOR_WORDS[m[1].toLowerCase()]}:creature`, minPow: 0, n: +m[2] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Each spell you cast that's (white|blue|black|red|green) or (white|blue|black|red|green) costs \{(\d+)\} less to cast\.$/))) { R.reducer = { what: `color:${COLOR_WORDS[m[1]]}${COLOR_WORDS[m[2]]}`, minPow: 0, n: +m[3] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^(Aura and Equipment|Creature) spells you cast(?: of the chosen type)? cost \{(\d+)\} less to cast\.$/)) || (m = line.match(/^(Creature) spells of the chosen type cost \{(\d+)\} less to cast\.$/))) { R.reducer = { what: /chosen/.test(line) ? 'chosenType' : m[1] === 'Aura and Equipment' ? 'Aura|Equipment' : 'Creature', minPow: 0, n: +m[2] }; { ctx.li = li; return true; } }
        return false;
    },
    (ctx) => {
        // Top-1000 round: replacement effects
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^If one or more \+1\/\+1 counters would be put on (?:a|an) (creature|permanent|artifact or creature) you control, (that many plus one|twice that many) \+1\/\+1 counters are put on (?:it|that creature|that permanent) instead\.$/))) { R.counterMod = { what: m[1], plus: /plus one/.test(m[2]) ? 1 : 0, times: /twice/.test(m[2]) ? 2 : 1 }; { ctx.li = li; return true; } }
        if (/^If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead\.$/.test(line) || /^If one or more tokens would be created under your control, twice that many of those tokens are created instead\.$/.test(line)) { R.tokenDouble = true; { ctx.li = li; return true; } }
        if (/^If you would create one or more Treasure tokens, instead create those tokens plus an additional Treasure token\.$/.test(line)) { R.extraTreasure = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^If a source you control would deal damage to (?:a permanent or player|an opponent or a permanent an opponent controls), it deals (double|triple) that damage(?: to that permanent or player)? instead\.$/))) { R.dmgMult = { n: m[1] === 'double' ? 2 : 3, oppOnly: /opponent/.test(line) }; { ctx.li = li; return true; } }
        if (/^If a red source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus 2 instead\.$/.test(line)) { R.dmgPlus = { n: 2, color: 'R' }; { ctx.li = li; return true; } }
        return false;
    },
    (ctx) => {
        // Top-1000 round: statics
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^Creatures can't attack you(?: or planeswalkers you control)? unless their controller pays \{(2|X)\} for each (?:creature they control that's attacking you|of those creatures)(?:, where X is the number of enchantments you control)?\.$/))) { R.attackTax = m[1] === 'X' ? 'enchantments' : 2; { ctx.li = li; return true; } }
        if ((m = line.match(/^(Equipped|Enchanted) creature can't be blocked(?: and has ([a-z ,]+))?\.$/)) && (!m[2] || allKnown(splitKw(m[2])))) { R.buff = { p: 0, q: 0, kw: ['unblockable', ...(m[2] ? splitKw(m[2]) : [])] }; { ctx.li = li; return true; } }
        if (/^~ can't block and can't be blocked\.$/.test(line)) { R.kw.add('cantblock'); R.kw.add('unblockable'); { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as equipped creature is legendary, it has ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { R.buffCond = { cond: 'the equipped creature is legendary', kw: splitKw(m[1]) }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) and loses ([a-z ]+)\.$/)) && allKnown([m[3]])) { R.buff = { p: +m[1], q: +m[2], kw: [`-${m[3]}`] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^(Creature tokens|Legendary creatures) you control get \+(\d+)\/\+(\d+) and have ([a-z ,{}0-9]+)\.$/))) { const kw = splitKw(m[4].replace(/ward \{(\d+)\}/, 'ward:$1')); if (allKnown(kw)) { R.statics.push({ type: null, match: /tokens/.test(m[1]) ? 'token' : 'legendary', p: +m[2], q: +m[3], kw }); { ctx.li = li; return true; } } }
        if ((m = line.match(/^Creatures your opponents control get ([+-]\d+)\/([+-]\d+)\.$/))) { R.statics.push({ type: null, opp: true, global: true, p: +m[1], q: +m[2], kw: [] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Other permanents you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { R.permKw = splitKw(m[1]); { ctx.li = li; return true; } }
        if (/^Your opponents can't cast spells during your turn\.$/.test(line) || /^During your turn, your opponents can't cast spells or activate abilities of artifacts, creatures, or enchantments\.$/.test(line)) { R.noCastOnMyTurn = true; { ctx.li = li; return true; } }
        if (/^Your opponents can't cast spells from anywhere other than their hands\.$/.test(line)) { R.handOnly = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^(Artifacts and creatures|Creatures) your opponents control enter tapped\.$/))) { R.oppEnterTapped = /Artifacts/.test(m[1]) ? 'artifact or creature' : 'creature'; { ctx.li = li; return true; } }
        if (/^You may cast spells as though they had flash\.$/.test(line)) { R.flashAll = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^You may cast ([A-Z][a-z]+) and ([A-Z][a-z]+) spells as though they had flash\.$/))) { R.flashTypes = [m[1], m[2]]; { ctx.li = li; return true; } } // Sigarda's Aid
        if ((m = line.match(/^Spells your opponents cast that target ~ cost an additional (\d+) life to cast\.$/))) { R.targetTaxLife = +m[1]; { ctx.li = li; return true; } } // Terror of the Peaks
        if ((m = line.match(/^Cumulative upkeep ((?:\{[^}]+\})+)$/))) { const c = parseCost(m[1]); if (!c.x && !c.odd) { R.cumUpkeep = c; { ctx.li = li; return true; } } }
        if (/^Rebound$/.test(line)) { R.rebound = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^You may play (two|an) additional lands? on each of your turns\.$/))) { R.extraLand = m[1] === 'two' ? 2 : 1; { ctx.li = li; return true; } }
        if (/^You may play lands from your graveyard\.$/.test(line)) { R.landsFromGy = true; { ctx.li = li; return true; } }
        if (/^You may play lands from the top of your library\.$/.test(line)) { R.landsFromTop = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Untap (all permanents|all artifacts|~) you control during each other player's untap step\.$/)) || (m = line.match(/^Untap (~) during each other player's untap step\.$/))) { R.untapOthers = m[1]; { ctx.li = li; return true; } }
        if (/^If you would draw a card while your library has no cards in it, you win the game instead\.$/.test(line)) { R.labMan = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as ~ is in your graveyard and you control an? (Plains|Island|Swamp|Mountain|Forest), creatures you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[2]))) { R.gyStatic = { type: m[1], kw: splitKw(m[2]) }; { ctx.li = li; return true; } }
        if ((m = line.match(/^You may cast ~ from your graveyard as long as you control an? ([A-Z][a-z]+)\.$/))) { R.gyCastIf = m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^Creatures with power less than ~'s power can't block creatures you control\.$/))) { R.lambholt = true; { ctx.li = li; return true; } }
        if (/^Split second$/.test(line)) { R.splitSecond = true; R.kw.add('split second'); { ctx.li = li; return true; } }
        // Alternative costs (118.9): Force of Will, Force of Negation, Snuff Out
        if ((m = line.match(/^(?:If (.+?), )?[Yy]ou may (pay (\d+) life and exile|exile|pay (\d+) life|pay ((?:\{[^}]+\})+))(?: an? (white|blue|black|red|green) card from your hand)? rather than pay ~'s mana cost\.$/)) && (!m[1] || parseCond(m[1])) && (!/exile/.test(m[2]) || m[6]) && !(/exile/.test(m[2]) === !m[6])) {
            R.alt = { mana: parseCost(m[5] || ''), life: +(m[3] || m[4] || 0), exile: m[6] ? { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[6]] : null, cond: m[1] ? parseCond(m[1]) : null, text: line.replace(/^If .+?, y/, 'Y').replace(/^You may /, '').replace(/ rather than pay ~'s mana cost\.$/, '') };
            { ctx.li = li; return true; }
        }
        if ((m = line.match(/^(Evoke|Echo) ((?:\{[^}]+\})+)$/))) { const c = parseCost(m[2]); if (!c.x && !c.odd) { if (m[1] === 'Evoke') R.evoke = c; else R.echo = c; { ctx.li = li; return true; } } }
        if ((m = line.match(/^Eternalize ((?:\{[^}]+\})+)$/))) { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(m[1]), tap: false, exileSelfGy: true }, effects: [{ t: 'eternalize' }], text: `Eternalize ${m[1]}`, sorcery: true, gy: true }); { ctx.li = li; return true; } }
        return false;
    }
    ],
});
