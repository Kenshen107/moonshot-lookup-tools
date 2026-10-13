// Spellslinger Duels - rules pack: Welcome decks round (2026-10-06).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'welcome',
    effects: [
        [/^(?:target player|you) draws? (\w+) cards? and loses? (\w+) life$/, m => ({ t: 'draw', n: num(m[1]), then: { t: 'loseSelf', n: num(m[2]) } })],
        [/^(?:each|every) player gains (\w+) life$/, m => ({ t: 'gainAll', n: num(m[1]) })],
        [/^target player gains (\w+) life$/, m => ({ t: 'gain', n: num(m[1]) })],
        [/^its controller loses (\w+) life(?: and you gain (\w+) life)?$/, m => ({ t: 'lastCtrlLose', n: num(m[1]), gain: m[2] ? num(m[2]) : 0 })],
        [/^~ deals (\w+) damage to target creature and (\w+) damage to (that creature's controller|target player or planeswalker|target player|target opponent)$/, m => [{ t: 'dmg', n: num(m[1]), target: 'creature' }, m[3] === "that creature's controller" ? { t: 'lastCtrlDmg', n: num(m[2]) } : { t: 'dmg', n: num(m[2]), target: 'player' }]],
        [/^~ deals (\w+) damage to target player and (\w+) damage to each creature that player controls$/, m => [{ t: 'dmg', n: num(m[1]), target: 'player' }, { t: 'dmg', n: num(m[2]), target: 'oppCreatures' }]],
        [/^~ deals (\w+) damage to any target, (\w+) damage to another target, and (\w+) damage to a third target$/, m => [{ t: 'dmg', n: num(m[1]), target: 'any' }, { t: 'dmg', n: num(m[2]), target: 'any', notPrev: true }, { t: 'dmg', n: num(m[3]), target: 'any', notPrev: true }]],
        [/^~ deals (\w+) damage to any target and (\w+) damage to each of up to two other targets$/, m => [{ t: 'dmg', n: num(m[1]), target: 'any' }, { t: 'dmg', n: num(m[2]), target: 'any', notPrev: true, optional: true }, { t: 'dmg', n: num(m[2]), target: 'any', notPrev: true, optional: true }]],
        [/^~ deals (\w+) damage to each of up to two target creatures$/, m => ({ t: 'dmg', n: num(m[1]), target: 'creature', multi: 2 })],
        [/^~ deals damage to (target creature|any target) equal to the number of (.+)$/, m => (countFn(`the number of ${m[2]}`) ? { t: 'dmg', n: 0, target: m[1] === 'any target' ? 'any' : 'creature', nCount: `the number of ${m[2]}` } : null)],
        [/^~ deals damage equal to the sacrificed creature's power to any target$/, () => ({ t: 'dmg', n: 0, target: 'any', nFrom: 'sacPow' })],
        [/^(?:~|it) deals damage equal to (twice )?its power to (?:up to one )?(?:another |other )?target (creature|creature you don't control|creature an opponent controls|opponent|creature or planeswalker you don't control)$/, m => ({ t: 'powDmg', mult: m[1] ? 2 : 1, target: m[2] === 'opponent' ? 'player' : 'creature', theirs: /don't|opponent controls/.test(m[2]), optional: /up to one/.test(m[0]) })],
        [/^target creature you control deals damage equal to (twice )?its power to (?:another )?target creature(?: or planeswalker)?(?: you don't control| an opponent controls)?$/, m => [{ t: 'markMine', target: 'creature', mine: true, good: true }, { t: 'biteDmg', target: 'creature', theirs: true, mult: m[1] ? 2 : 1, notPrev: true }]],
        [/^target creature you control fights another target creature$/, () => [{ t: 'markMine', target: 'creature', mine: true, good: true }, { t: 'fightLast', target: 'creature', theirs: true, notPrev: true }]],
        [/^(?:it|that creature) fights (?:up to one )?target creature(?: you don't control| an opponent controls)?$/, m => ({ t: 'fightLast', target: 'creature', theirs: true, notPrev: true, optional: /up to one/.test(m[0]) })],
        [/^(?:have )?(?:it|~) fights? target creature you don't control$/, () => ({ t: 'fight', target: 'creature', self: true })],
        [/^~ deals damage equal to that spell's power to its controller$/, () => ({ t: 'counterPowDmg' })],
        [/^counter target creature spell with power or toughness (\w+) or less$/, m => ({ t: 'counter', target: 'spell', filter: `small${num(m[1])}` })],
        [/^counter target instant spell$/, () => ({ t: 'counter', target: 'spell', filter: 'instant' })],
        [/^counter target spell unless its controller pays \{x\}, where x is the greatest power among creatures you control$/i, () => ({ t: 'counter', target: 'spell', filter: 'any', unlessFrom: 'greatestPower' })],
        [/^(destroy|exile) (?:up to one )?target (artifact or land|artifact, enchantment, or creature with flying|creature or enchantment|colorless nonland permanent|creature with toughness \w+ or greater|creature with flying|land|tapped creature)$/, m => ({ t: m[1].toLowerCase(), target: 'perm', filter: m[2] })],
        [/^target (attacking|blocking|tapped) creature gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/, m => ({ t: 'pump', p: +m[2], q: +m[3], kw: m[4] ? splitKw(m[4]) : [], target: 'creature', only: `${m[1]} creature`, good: +m[2] + +m[3] >= 0 })],
        [/^another target (attacking )?creature(?: you control)? (?:gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))?|gains ([a-z ,]+?)) until end of turn$/, m => ({ t: 'pump', p: +(m[2] || 0), q: +(m[3] || 0), kw: splitKw(m[4] || m[5] || ''), target: 'creature', only: m[1] ? 'attacking creature' : null, notSelf: true, notPrev: true, good: +(m[2] || 0) + +(m[3] || 0) >= 0, mine: !/-/.test(m[2] || '') })],
        [/^target (attacking )?creature without flying gains flying until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: ['flying'], target: 'creature', only: m[1] ? 'attacking creature without flying' : 'creature without flying', good: true })],
        [/^(?:up to one )?target creature gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[1]), target: 'creature', good: true })],
        [/^target creature you control gets ([+-]\d+)\/([+-]\d+) until end of turn and can't be blocked this turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: ['unblockable'], target: 'creature', mine: true, good: true })],
        [/^~ gets ([+-]\d+)\/([+-]\d+) until end of turn and can't be blocked this turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: ['unblockable'], target: 'self', good: true })],
        [/^target creature (?:you control )?gets \+(\d+)\/\+(\d+) for each (.+?)(?: and gains ([a-z ,]+?))? until end of turn$/, m => (countFn(`the number of ${m[3]}`) ? { t: 'pump', p: +m[1], q: +m[2], kw: m[4] ? splitKw(m[4]) : [], per: `the number of ${m[3]}`, target: 'creature', good: true } : null)],
        [/^target creature you control gets \+x\/\+x until end of turn$/i, () => ({ t: 'pump', p: 'X', q: 'X', n: 'X', kw: [], target: 'creature', mine: true, good: true })],
        [/^(?:~|it) gets \+(\d+)\/\+(\d+) until end of turn for each (.+)$/, m => (countFn(`the number of ${m[3]}`) ? { t: 'pump', p: +m[1], q: +m[2], kw: [], per: `the number of ${m[3]}`, target: 'self', good: true } : null)],
        [/^(?:~|it) gets \+x\/\+(\d+) until end of turn, where x is the greatest power among creatures you control$/i, m => ({ t: 'pump', p: 0, q: +m[1], kw: [], pFrom: 'greatestPower', target: 'self', good: true })],
        [/^another target creature gets ([+-]\d+)\/([+-]\d+) until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], target: 'creature', notPrev: true, good: +m[1] + +m[2] >= 0 })],
        [/^(?:up to one )?target creature gets -(\d+)\/-(\d+) until end of turn$/, m => ({ t: 'pump', p: -m[1], q: -m[2], kw: [], target: 'creature', good: false })],
        [/^creatures (?:your opponents control|target player controls|target opponent controls) get ([+-]\d+)\/([+-]\d+) until end of turn$/, m => ({ t: 'oppPump', p: +m[1], q: +m[2] })],
        [/^attacking creatures (?:you control )?(?:get \+(\d+)\/\+(\d+)|gain ([a-z ,]+?)) until end of turn$/, m => ({ t: 'teamPump', p: +(m[1] || 0), q: +(m[2] || 0), kw: m[3] ? splitKw(m[3]) : [], attacking: true })],
        [/^each creature you control with power (\w+) or greater gets \+(\d+)\/\+(\d+)(?: and gains ([a-z ,]+?))? until end of turn$/, m => ({ t: 'teamPump', p: +m[2], q: +m[3], kw: m[4] ? splitKw(m[4]) : [], minPow: num(m[1]) })],
        [/^double the power of each creature you control until end of turn$/, () => ({ t: 'doublePower' })],
        [/^creatures without flying can't block this turn$/, () => ({ t: 'groundCantBlock' })],
        [/^(?:those creatures|they) can't block this turn$/, () => ({ t: 'lastAllKw', kw: ['cantblock'] })],
        [/^(?:those creatures|they) gain ([a-z ,]+?) until end of turn$/, m => ({ t: 'lastAllKw', kw: splitKw(m[1]) })],
        [/^put a \+1\/\+1 counter on each creature you control with a \+1\/\+1 counter on it$/, () => ({ t: 'teamCounters', n: 1, withCounter: true })],
        [/^put a \+1\/\+1 counter on target creature, two \+1\/\+1 counters on another target creature, and three \+1\/\+1 counters on a third target creature$/, () => [{ t: 'counters', n: 1, target: 'creature', good: true }, { t: 'counters', n: 2, target: 'creature', good: true, notPrev: true }, { t: 'counters', n: 3, target: 'creature', good: true, notPrev: true }]],
        [/^move any number of \+1\/\+1 counters from target creature onto another target creature with the same controller$/, () => [{ t: 'markMine', target: 'creature', mine: true, good: true, withCounters: true }, { t: 'moveCounters', target: 'creature', mine: true, good: true, notPrev: true }]],
        [/^put (\w+) \+1\/\+1 counters? on target (?!creature\b|permanent\b|artifact\b)([a-z]+)(?: you control)?$/i, m => (/^(creature|permanent|artifact)$/i.test(m[2]) ? null : { t: 'counters', n: num(m[1]), target: 'creature', only: m[2][0].toUpperCase() + m[2].slice(1).toLowerCase(), good: true, mine: /you control$/.test(m[0]) })],
        [/^return (?:up to two|one or two) target creature cards from your graveyard to your hand$/, () => ({ t: 'regrow', what: 'creature', count: 2 })],
        [/^return target (creature or land) card from a graveyard to its owner's hand$/, m => ({ t: 'regrow', what: m[1], anyGy: true })],
        [/^return (?:up to one )?target creature card with mana value (\w+) or less from your graveyard to your hand$/, m => ({ t: 'regrow', what: `creature mv${num(m[1])}` })],
        [/^return target ([a-z]+) card from your graveyard to your hand$/i, m => ({ t: 'regrow', what: m[1].toLowerCase() })],
        [/^put target nonland permanent on top of its owner's library$/, () => ({ t: 'topdeck', target: 'perm', filter: 'nonland permanent' })],
        [/^target creature's owner puts it on their choice of the top or bottom of their library$/, () => ({ t: 'topdeck', target: 'creature', ownerChoice: true })],
        [/^return all attacking creatures to (?:their owner's hand|its owner's hand|their owners' hands)$/, () => ({ t: 'massBounce', what: 'attacking creatures' })],
        [/^return (?:up to one )?target (?:nonland permanent|creature) to its owner's hand$/, m => ({ t: 'bounce', target: /creature$/.test(m[0]) ? 'creature' : 'perm', filter: 'nonland permanent', optional: /up to one/.test(m[0]) })],
        [/^§millpick (\d+) (\S+)$/, m => ({ t: 'millPick', n: +m[1], what: m[2].replace(/_/g, ' ') })],
        [/^§keeptop (\d+)$/, m => ({ t: 'keepTop', n: +m[1] })],
        [/^search your library for a basic land card, reveal it, then shuffle and put that card on top$/, () => ({ t: 'fetchLand', n: 1, what: 'basic land', top: true })],
        [/^target (?:player|opponent) reveals their hand$/, () => ({ t: 'revealHand' })],
        [/^you gain life equal to the number of cards in that player's hand$/, () => ({ t: 'gain', n: 0, nFrom: 'oppHand' })],
        [/^you gain life equal to that card's power$/, () => ({ t: 'gain', n: 0, nFrom: 'lastCardPow' })],
        [/^choose target creature you control$/, () => ({ t: 'markMine', target: 'creature', mine: true, good: true })],
        [/^you gain life equal to that creature's power plus its toughness$/, () => ({ t: 'gain', n: 0, nFrom: 'lastPT' })],
        [/^you gain (\w+) life for each (.+)$/, m => (countFn(`the number of ${m[2]}`) ? { t: 'gain', n: 0, per: num(m[1]), nCount: `the number of ${m[2]}` } : null)],
        [/^you gain x life and draw x cards, where x is that creature's power$/i, () => [{ t: 'gain', n: 0, nFrom: 'sacPow' }, { t: 'draw', n: 0, nFrom: 'sacPow' }]],
        [/^each opponent loses life equal to the number of (.+)$/, m => (countFn(`the number of ${m[1]}`) ? { t: 'drain', n: 0, nCount: `the number of ${m[1]}` } : null)],
        [/^(?:she|he|it|~) deals x damage to defending player, where x is the number of attacking creatures$/i, () => ({ t: 'dmg', n: 0, target: 'opponents', nFrom: 'attackers' })],
        [/^(?:it|~) deals (\w+) damage to the player or planeswalker it's attacking$/, m => ({ t: 'dmg', n: num(m[1]), target: 'opponents' })],
        [/^draw a card for each card you've discarded this turn$/, () => ({ t: 'draw', n: 0, nFrom: 'discardedTurn' })],
        [/^draw a card for each (.+)$/, m => (countFn(`the number of ${m[1]}`) ? { t: 'draw', n: 0, nCount: `the number of ${m[1]}` } : null)],
        [/^gain control of target creature with power (\w+) or less until end of turn$/, m => ({ t: 'steal', target: 'creature', only: `creature with power ${num(m[1])} or less` })],
        [/^tap target creature (with flying|without flying|defending player controls)$/, m => ({ t: 'tap', target: 'creature', only: m[1] === 'defending player controls' ? null : `creature ${m[1]}`, theirs: true, good: false })],
        [/^tap target nonland permanent an opponent controls$/, () => ({ t: 'tap', target: 'perm', filter: 'nonland permanent an opponent controls', good: false })],
        [/^tap (\w+) target nonland permanents$/, m => ({ t: 'tap', target: 'perm', filter: 'nonland permanent an opponent controls', multi: num(m[1]), n: num(m[1]), good: false })],
        [/^tap all creatures target player controls$/, () => ({ t: 'tapAll', who: 'opp' })],
        [/^(?:those creatures|they) don't untap during (?:that player's|their controller's|its controller's) next untap step$/, () => ({ t: 'freezeLast' })],
        [/^tap target creature an opponent controls and put a stun counter on it$/, () => ({ t: 'tap', target: 'creature', theirs: true, stun: true, good: false })],
        [/^prevent all damage that would be dealt to target creature this turn$/, () => ({ t: 'pump', p: 0, q: 0, kw: ['preventdmg'], target: 'creature', good: true })],
        [/^prevent all combat damage that would be dealt to you this turn$/, () => ({ t: 'fogSelf' })],
        [/^prevent all combat damage that would be dealt this turn by creatures with no \+1\/\+1 counters on them$/, () => ({ t: 'fogNoCounters' })],
        [/^populate$/, () => ({ t: 'populate' })],
        [/^tap enchanted creature$/, () => ({ t: 'tapHost' })],
        [/^add x mana of any one color, where x is ~'s power$/i, () => ({ t: 'addMana', any: 0, anyPow: true })],
        [/^spend this mana only to cast ([a-z]+) spells and activate abilities of \1 sources$/i, () => null],
        [/^draw a card for each ([a-z]+) tapped this way$/i, () => ({ t: 'noop' })],
        [/^tap target creature an opponent controls and put a stun counter on (?:it|~)$/, () => ({ t: 'tap', target: 'creature', theirs: true, stun: true, good: false })],
        [/^choose (?:another|up to one other) target creature you control$/, () => ({ t: 'markMine', target: 'creature', mine: true, notSelf: true, good: true, optional: true })],
        [/^its base power and toughness become equal to ~'s power and toughness until end of turn$/, () => ({ t: 'baseFromSrc', target: 'last' })],
        [/^~ becomes an? [A-Z][a-z]+ creature in addition to its other types and gains "~'s power and toughness are each equal to the number of (.+)\."$/, m => ({ t: 'permAnimate', what: `the number of ${m[1]}` })],
        [/^exile all creature cards from target player's graveyard$/, () => ({ t: 'exileGyCreaturesCastable' })],
        [/^(?:you may )?cast spells from among those cards for as long as they remain exiled, and mana of any type can be spent to cast them$/i, () => ({ t: 'noop' })],
        [/^exile the top card of each player's library, then you may cast any number of spells from among those cards without paying their mana costs$/, () => ({ t: 'etali' })],
        [/^put its \+1\/\+1 counters on target creature you control$/, () => ({ t: 'counters', n: 0, nFrom: 'srcLastCounters', target: 'creature', mine: true, good: true })],
        [/^~ deals (\w+) damage to each creature blocking it$/, m => ({ t: 'dmgBlockers', n: num(m[1]) })],
        [/^detain target (creature|nonland permanent) an opponent controls$/, m => ({ t: 'detain', target: 'perm', filter: `${m[1]} an opponent controls` })],
        [/^~ gets ([+-]\d+)\/([+-]\d+) and becomes an? [A-Za-z ]+? until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], target: 'self', good: true })],
        [/^~ becomes an? [A-Z][a-z]+$/, () => ({ t: 'noop' })],
        [/^target creature you control gets \+(\d+)\/\+(\d+) and becomes an? [A-Za-z]+ in addition to its other types until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], target: 'creature', mine: true, good: true })],
        [/^target creature becomes an? (?:\w+ )?[A-Z][a-z]+ with base power and toughness (\d+)\/(\d+) until end of turn$/, m => ({ t: 'setBase', p: +m[1], q: +m[2], kw: [], target: 'creature', good: true })],
        [/^target artifact or creature becomes an artifact creature with base power and toughness (\d+)\/(\d+) and gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'setBase', p: +m[1], q: +m[2], kw: splitKw(m[3]), target: 'perm', filter: 'artifact or creature', good: true })],
        [/^target land(?: you control)? becomes an? (\d+)\/(\d+) [A-Za-z]+ creature(?: with ([a-z ,]+))? until end of turn$/, m => ({ t: 'animateTarget', p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [], target: 'perm', filter: 'land', good: true, mine: /you control/.test(m[0]) })],
        [/^it's still a land$/, () => ({ t: 'noop' })],
        [/^~ deals (\w+) damage to target opponent unless that player sacrifices a creature(?: of their choice)?$/, m => ({ t: 'punisherSac', n: num(m[1]) })],
        [/^another target creature with power (\w+) or less can't be blocked this turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', only: `creature with power ${num(m[1])} or less`, notSelf: true, good: true })],
        [/^whenever a creature you control with power 2 or less deals combat damage to a player, draw a card until end of turn$/, () => ({ t: 'smallHitDraw' })],
        [/^put a card from your hand on the bottom of your library$/, () => ({ t: 'handToBottom' })],
        [/^remove an? (\w+) counter from ~$/, m => ({ t: 'removeNamed', kind: m[1] })],
        [/^remove a counter from a creature you control$/, () => ({ t: 'removeAnyCounter' })],
        [/^sacrifice (?:it|~) and you gain (\w+) life$/, m => [{ t: 'sacSelf' }, { t: 'gain', n: num(m[1]) }]],
        [/^reveal the top card of your library$/, () => ({ t: 'revealTop' })],
        [/^target (artifact or creature|creature) you control gains (?!protection from the color)([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[2]), target: 'perm', filter: m[1] === 'creature' ? 'creature you control' : 'artifact or creature', mine: true, good: true })],
        [/^another target permanent gains indestructible for as long as you control ~$/, () => ({ t: 'aegis', target: 'perm', filter: 'permanent', notSelf: true, good: true })],
        [/^target creature gets ([+-]\d+)\/([+-]\d+) and gains "when ~ dies, return it to the battlefield under its owner's control\." until end of turn$/i, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: ['returnondeath'], target: 'creature', good: true })],
        [/^attach an equipment you control to it$/, () => ({ t: 'attachEquipLast' })],
        [/^you may tap any number of untapped ([A-Z][a-z]+)s you control$/, m => ({ t: 'tapTypeDraw', type: m[1] })],
        [/^tap any number of untapped ([A-Z][a-z]+)s you control$/, m => ({ t: 'tapTypeDraw', type: m[1] })],
        [/^draw a card for each ([A-Z][a-z]+) tapped this way$/, () => ({ t: 'noop' })],
        [/^return all permanents to their owners' hands except for ([A-Z][a-z]+)s, ([A-Z][a-z]+)s, and lands$/, m => ({ t: 'massBounce', what: `permanents except ${m[1]} ${m[2]}` })],
        [/^~ gets \+(\d+)\/\+(\d+) until end of turn for each card looked at while scrying this way$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], perCtx: true, target: 'self', good: true })],
        [/^creatures you control gain (first strike) until end of turn if a creature you control has first strike$/, () => ({ t: 'odric' })],
        [/^the same is true for .+$/, () => ({ t: 'noop' })],
        [/^exchange control of two target nonland permanents that share a card type$/, () => [{ t: 'markMine', target: 'perm', filter: 'nonland permanent', mine: true, good: true }, { t: 'exchange', target: 'perm', filter: "nonland permanent an opponent controls", notPrev: true }]],
        [/^exile (another )?target (nonland permanent an opponent controls|creature|creature an opponent controls|creature defending player controls|nonland permanent|creature you don't control) until ~ leaves the battlefield$/, m => ({ t: 'exile', target: 'perm', filter: m[2] === 'creature defending player controls' ? "creature you don't control" : m[2], notSelf: !!m[1], until: true })],
        [/^exile another target creature$/, () => ({ t: 'exile', target: 'perm', filter: 'creature', notSelf: true })],
        [/^(?:destroy|exile) target land\. its controller reveals.+$/, () => null],
        [/^its controller reveals cards from the top of their library until they reveal a land card, then puts those cards into their graveyard$/, () => ({ t: 'millToLand' })],
        [/^target player sacrifices an? (artifact|creature|enchantment|land) and an? (artifact|creature|enchantment|land)(?: of their choice)?$/, m => [{ t: 'edict', who: 'target player', what: m[1] }, { t: 'edict', who: 'target player', what: m[2] }]],
        [/^~ deals (\w+) damage to that player$/, m => ({ t: 'dmg', n: num(m[1]), target: 'opponents' })],
        [/^(?:it|~|he|she) connives$/, () => ({ t: 'connive', target: 'self' })],
        [/^(?:up to one )?target creature you control connives$/, m => ({ t: 'connive', target: 'creature', mine: true, good: true, optional: /up to one/.test(m[0]) })],
        [/^target player draws a card, then up to one target creature you control connives$/, () => [{ t: 'draw', n: 1 }, { t: 'connive', target: 'creature', mine: true, good: true, optional: true }]],
        [/^exile (?:up to one )?target card from (?:an opponent's|a) graveyard$/, () => ({ t: 'exileGy' })],
        [/^that player mills that many cards$/, () => ({ t: 'mill', n: 0, nFrom: 'ctxCount' })],
        [/^you gain that much life$/, () => ({ t: 'gain', n: 0, nFrom: 'ctxCount' })],
        [/^target creature you control that's attacking alone gets ([+-]\d+)\/([+-]\d+) until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], target: 'creature', mine: true, only: 'attacking alone', good: true })],
        [/^creatures you control get \+(\d+)\/\+(\d+) until end of turn and can't be blocked this turn$/, m => ({ t: 'teamPump', p: +m[1], q: +m[2], kw: ['unblockable'] })],
        [/^exile target creature, then populate$/, () => [{ t: 'exile', target: 'creature' }, { t: 'populate' }]],
        [/^~ deals (\w+) damage to any target$/, m => ({ t: 'dmg', n: num(m[1]), target: 'any' })],
        [/^~ deals (\w+) damage to target (?:creature|creature or planeswalker|creature an opponent controls)$/, m => ({ t: 'dmg', n: num(m[1]), target: 'creature' })],
        [/^~ deals (\w+) damage to target (?:player|opponent|player or planeswalker|opponent or planeswalker)$/, m => ({ t: 'dmg', n: num(m[1]), target: 'player' })],
        [/^~ deals (\w+) damage to each opponent$/, m => ({ t: 'dmg', n: num(m[1]), target: 'opponents' })],
        [/^~ deals (\w+) damage to each creature$/, m => ({ t: 'dmg', n: num(m[1]), target: 'allCreatures' })],
        [/^~ deals (\w+) damage to each creature (?:your opponents control|you don't control)$/, m => ({ t: 'dmg', n: num(m[1]), target: 'oppCreatures' })],
        [/^destroy target (?:creature|creature an opponent controls|creature you don't control|creature or planeswalker)$/, () => ({ t: 'destroy', target: 'creature' })],
        [/^exile target (?:creature|creature an opponent controls|creature you don't control|creature or planeswalker)$/, () => ({ t: 'exile', target: 'creature' })],
        [/^return target (?:creature|creature an opponent controls|creature you don't control) to its owner's hand$/, () => ({ t: 'bounce', target: 'creature' })],
    ],
    lines: [
    (ctx) => {
        // Welcome decks (2026-10-06)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^~ can't be blocked by more than one creature\.$/.test(line)) { R.kw.add('maxoneblock'); { ctx.li = li; return true; } }
        if (/^~ can't attack or block alone\.$/.test(line)) { R.kw.add('notalone'); { ctx.li = li; return true; } }
        if (/^All creatures able to block ~ do so\.$/.test(line)) { R.kw.add('lure'); { ctx.li = li; return true; } }
        if (/^~ can block an additional creature each combat\.$/.test(line)) { R.kw.add('extrablock'); { ctx.li = li; return true; } }
        if (/^~ can block only creatures with flying\.$/.test(line)) { R.kw.add('blockflyonly'); { ctx.li = li; return true; } }
        if (/^~ can't be blocked except by three or more creatures\.$/.test(line)) { R.kw.add('minblock3'); { ctx.li = li; return true; } }
        if (/^~ can't be blocked except by creatures with flying or reach\.$/.test(line)) { R.kw.add('blockflyreach'); { ctx.li = li; return true; } }
        if ((m = line.match(/^~ can't be blocked except by ([A-Z][a-z]+)s\.$/))) { R.kw.add(`blockonly:${m[1]}`); { ctx.li = li; return true; } }
        if ((m = line.match(/^~ can't be blocked by creatures with power (\w+) or less\.$/)) && num(m[1]) !== undefined) { R.kw.add(`blockpowgt:${num(m[1])}`); { ctx.li = li; return true; } }
        if ((m = line.match(/^~ can't block unless (.+)\.$/)) && parseCond(m[1])) { R.blockCond = m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^During your turn, ~ (?:has ([a-z ,]+)|gets \+(\d+)\/\+(\d+))\.$/)) && (!m[1] || allKnown(splitKw(m[1])))) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn', p: +(m[2] || 0), q: +(m[3] || 0), kw: m[1] ? splitKw(m[1]) : [] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as ([^,]+), ~ has base power and toughness (\d+)\/(\d+)\.$/)) && parseCond(m[1])) { (R.selfCond = R.selfCond || []).push({ cond: m[1], p: 0, q: 0, kw: [], base: { p: +m[2], q: +m[3] } }); { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as ([^,]+), ~ gets \+(\d+)\/\+(\d+) and is all creature types\.$/)) && parseCond(m[1])) { (R.selfCond = R.selfCond || []).push({ cond: m[1], p: +m[2], q: +m[3], kw: ['changeling'] }); { ctx.li = li; return true; } }
        // Lords with a filter
        if ((m = line.match(/^(Other )?([A-Z][a-z]+) and ([A-Z][a-z]+) you control (?:get \+(\d+)\/\+(\d+)|have ([a-z ,]+))\.$/)) && (!m[6] || allKnown(splitKw(m[6])))) {
            const ty = [m[2], m[3]].map(w => PLURAL_TYPES[w] || w.replace(/s$/, ''));
            R.statics.push({ other: !!m[1], types: ty, p: +(m[4] || 0), q: +(m[5] || 0), kw: m[6] ? splitKw(m[6]) : [] }); { ctx.li = li; return true; }
        }
        if ((m = line.match(/^(Other )?([Aa]rtifact creatures|[Cc]reature tokens) you control get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ other: !!m[1], type: null, match: /tokens/.test(m[2]) ? 'token' : 'artifact', p: +m[3], q: +m[4], kw: [] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Attacking ([A-Z][a-z]+) you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[2]))) { R.statics.push({ type: PLURAL_TYPES[m[1]] || m[1].replace(/s$/, ''), match: 'attacking', p: 0, q: 0, kw: splitKw(m[2]) }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Creatures with flying your opponents control get ([+-]\d+)\/([+-]\d+)\.$/))) { R.statics.push({ type: null, match: 'flying', opp: true, global: true, p: +m[1], q: +m[2], kw: [] }); { ctx.li = li; return true; } }
        if (/^Creatures you control with power or toughness 1 or less can't be blocked\.$/.test(line)) { R.statics.push({ type: null, match: 'pt1', p: 0, q: 0, kw: ['unblockable'] }); { ctx.li = li; return true; } }
        if (/^Instant and sorcery spells you control can't be countered\.$/.test(line)) { R.protectSpells = true; { ctx.li = li; return true; } }
        if (/^You may cast creature spells from the top of your library\.$/.test(line)) { R.castTopCreatures = true; { ctx.li = li; return true; } }
        if (/^Play with the top card of your library revealed\.$/.test(line)) { R.revealTop = true; { ctx.li = li; return true; } }
        if (/^You can spend mana of any type to cast creature spells\.$/.test(line)) { R.anyManaCreatures = true; { ctx.li = li; return true; } }
        // Costs
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast if it targets (.+)\.$/))) { R.costLessTgt = { n: +m[1], what: m[2] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast if (.+)\.$/)) && parseCond(m[2])) { R.costLessIf = { n: +m[1], cond: m[2] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast for each attacking creature you control\.$/))) { R.costLess = { n: +m[1], what: 'the number of attacking creatures you control' }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast for each (creature that attacked this turn|creature you attacked with this turn)\.$/))) { R.costLess = { n: +m[1], what: 'the number of creatures that attacked this turn' }; { ctx.li = li; return true; } }
        if ((m = line.match(/^(Instant and sorcery|Creature|Artifact|Enchantment|[A-Z][a-z]+) spells you cast (?:with power (\w+) or greater )?cost \{(\d+)\} less to cast\.$/))) { R.reducer = { what: m[1], minPow: m[2] ? num(m[2]) : 0, n: +m[3] }; { ctx.li = li; return true; } }
        // Auras
        if (/^Enchant land$/i.test(line)) { R.aura = true; R.auraLand = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Enchanted creature gets ([+-]\d+)\/([+-]\d+) and (can't block|can't be blocked|has ([a-z ,]+) and ward \{(\d+)\})\.$/i))) {
            const kw = m[3] === "can't block" ? ['cantblock'] : m[3] === "can't be blocked" ? ['unblockable'] : [...splitKw(m[4]), `ward:${m[5]}`];
            if (allKnown(kw)) { R.buff = { p: +m[1], q: +m[2], kw }; if (m[3] === "can't block") R.buffBad = false; { ctx.li = li; return true; } }
        }
        if (/^Enchanted creature is an? [A-Z][a-z]+ and can't attack or block\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['cantattack', 'cantblock'] }; R.buffBad = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^(?:Enchanted|Equipped) creature gets \+(\d+)\/\+(\d+) for each (.+?)(?: and has ([a-z ,]+))?\.$/)) && countFn(`the number of ${m[3]}`) && (!m[4] || allKnown(splitKw(m[4])))) { R.buff = { p: 0, q: 0, kw: m[4] ? splitKw(m[4]) : [] }; R.buffPer = { p: +m[1], q: +m[2], what: `the number of ${m[3]}` }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Enchanted creature gets -X\/-X, where X is the number of (.+)\.$/)) && countFn(`the number of ${m[1]}`)) { R.buff = { p: 0, q: 0, kw: [] }; R.buffBad = true; R.buffPer = { p: -1, q: -1, what: `the number of ${m[1]}`, host: true }; { ctx.li = li; return true; } }
        if ((m = line.match(/^(?:Enchanted|Equipped) (creature|land) (?:gets ([+-]\d+)\/([+-]\d+) and )?has "(.+)"$/))) {
            // A granted ability, read as if it were printed on the enchanted permanent
            const inner = m[4].replace(/\.$/, '.').replace(/\bthis creature\b|\bthis land\b/g, '~');
            const tr = parseTrigger(inner), act = !tr && parseActivated(inner, R);
            const untapEach = /^Untap ~ during each other player's untap step\.?$/.test(inner);
            if (tr || act || untapEach) {
                R.buff = R.buff || { p: 0, q: 0, kw: [] };
                if (m[2]) { R.buff.p += +m[2]; R.buff.q += +m[3]; }
                R.grant = { trig: tr || [], acts: act ? [act] : [], untapEach };
                { ctx.li = li; return true; }
            }
        }
        if ((m = line.match(/^Enchanted land is an? (Plains|Island|Swamp|Mountain|Forest)\.$/))) { R.landBecomes = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' }[m[1]]; { ctx.li = li; return true; } }
        if ((m = line.match(/^Whenever enchanted land becomes tapped, (.+)$/))) { const fx = parseEffects(m[1].replace(/^its controller (loses|mills)/, (a, v) => `target player ${v}`)); if (fx) { R.trig.push({ ev: 'tapped', host: true, effects: fx.map(e => ({ ...e, hostCtrl: true })) }); { ctx.li = li; return true; } } }
        if (/^When ~ leaves the battlefield, return the exiled card(?:s)? to the battlefield under (?:its|their) owners?'s? control\.$/.test(line)) { R.leaveReturn = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^If ([^,]+), you may cast ~ without paying its mana cost\.$/)) && parseCond(m[1])) { R.freeIf = m[1]; { ctx.li = li; return true; } }
        const kws = splitKw(line.replace(/\.$/, ''));
        if (kws.length && kws.every(k => KEYWORDS.includes(k) || /^ward \{\d+\}$/.test(k))) {
            kws.forEach(k => { const w = k.match(/^ward \{(\d+)\}$/); if (w) R.ward = Number(w[1]); else R.kw.add(k); });
            { ctx.li = li; return true; }
        }
        if ((m = line.match(/^Ward \{(\d+)\}$/))) { R.ward = Number(m[1]); { ctx.li = li; return true; } }
        // Ward—Pay N life (Hexing Squelcher), also given to your other creatures
        if ((m = line.match(/^Ward—Pay (\d+) life\.$/))) { R.wardLife = +m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^Other creatures you control have "Ward—Pay (\d+) life\."$/))) { R.wardLifeOthers = +m[1]; { ctx.li = li; return true; } }
        if (/^Nontoken creatures you control have riot\.$/.test(line)) { R.riotAll = true; { ctx.li = li; return true; } }
        return false;
    }
    ],
});

// The one keyword line the Welcome Decks round reads before the other rounds' lines (see RULE_LINE_ORDER in 01-core.js)
registerRules({
    name: 'welcome-mechanics',
    lines: [
    (ctx) => {
        // Set mechanics read from keyword lines (welcome decks, 2026-10-06)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^(Basic land|Plains|Island|Swamp|Mountain|Forest)cycling ((?:\{[^}]+\})+)$/i))) { R.landcycle = { cost: parseCost(m[2]), what: m[1].toLowerCase() === 'basic land' ? 'basic land' : m[1].toLowerCase() }; { ctx.li = li; return true; } }
        return false;
    }
    ],
});
