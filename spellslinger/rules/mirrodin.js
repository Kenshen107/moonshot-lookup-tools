// Spellslinger Duels - rules pack: Mirrodin (2026-10-08).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'mirrodin',
    effects: [
        [/^§ebolt$/, () => ({ t: 'dmg', n: 2, target: 'creature', artN: 4 })],
        [/^§bladetrap$/, () => ({ t: 'dmgAttackersNoFly', n: 2 })],
        [/^put a charge counter on target artifact$/i, () => ({ t: 'namedCounterTarget', kind: 'charge', n: 1, target: 'perm', filter: 'artifact', good: true })],
        [/^§reins$/, () => ({ t: 'steal', target: 'creature' })],
        [/^§chokerpass$/, () => ({ t: 'chokerPass' })],
        [/^§chokerdmg$/, () => ({ t: 'dmgSelfCharge' })],
        [/^§moltenrain$/, () => ({ t: 'destroy', target: 'perm', filter: 'land', nonbasicDmg: 2 })],
        [/^§detonate$/, () => ({ t: 'detonate', n: 97, target: 'perm', filter: 'artifact' })],
        [/^§sacfling$/, () => ({ t: 'sacFling', target: 'any' })],
        [/^§augur$/, () => ({ t: 'augur', target: 'player', good: true })],
        [/^§revealart$/, () => ({ t: 'revealArt' })],
        [/^§tajnar$/, () => ({ t: 'tajNar' })],
        [/^§prisonimprint$/, () => ({ t: 'prisonImprint', target: 'player', oppOnly: true })],
        [/^§rustelem$/, () => ({ t: 'rustElem' })],
        [/^§peacekeeper$/, () => ({ t: 'peacekeeper' })],
        [/^§coils$/, () => ({ t: 'coils' })],
        [/^§crown$/, () => ({ t: 'crown' })],
        [/^§timesift$/, () => ({ t: 'timesift' })],
        [/^§gateaether$/, () => ({ t: 'gateAether' })],
        [/^§fatespin$/, () => ({ t: 'fatespin' })],
        [/^§floodland$/, () => ({ t: 'floodLand' })],
        [/^§unflood$/, () => ({ t: 'unflood' })],
        [/^§gambit$/, () => ({ t: 'gambit', target: 'creature' })],
        [/^§spoils$/, () => ({ t: 'spoils' })],
        [/^§grimreminder$/, () => ({ t: 'grimReminder' })],
        [/^§charbelcher$/, () => ({ t: 'charbelcher', target: 'any' })],
        [/^§pendulum$/, () => ({ t: 'pendulum' })],
        [/^§incubator$/, () => ({ t: 'incubator' })],
        [/^§ostone$/, () => ({ t: 'oStone' })],
        [/^§proteus$/, () => ({ t: 'proteus', target: 'creature' })],
        [/^§scepter$/, () => ({ t: 'castImprintCopy' })],
        [/^§nimdevour$/, () => ({ t: 'nimDevour' })],
        [/^§secondsunrise$/, () => ({ t: 'secondSunrise' })],
        [/^§timetwister$/, () => ({ t: 'timetwister' })],
        [/^§awestrike$/, () => ({ t: 'aweStrike', target: 'creature', theirs: true, good: false })],
        [/^§warelemental$/, () => ({ t: 'warElemental' })],
        [/^§thirst$/, () => ({ t: 'discardUnlessArt', n: 2 })],
        [/^(?:it|they) can't be regenerated$/i, () => ({ t: 'noRegen' })],
        [/^it's still a land$/i, () => ({ t: 'noop' })],
        [/^destroy target (nonartifact, nonblack creature|artifact, enchantment, or land|equipment|artifact that player controls)$/i, m => ({ t: 'destroy', target: 'perm', filter: m[1].toLowerCase() === 'artifact that player controls' ? "artifact you don't control" : m[1].toLowerCase() })],
        [/^(?:you may )?destroy target artifact that player controls$/i, m => ({ t: 'destroy', target: 'perm', filter: "artifact you don't control", may: /^you may/i.test(m[0]) })],
        [/^tap target (artifact, creature, or land|noncreature artifact)$/i, m => ({ t: 'tap', target: 'perm', filter: m[1].toLowerCase(), good: false })],
        [/^tap two target creatures$/i, () => ({ t: 'tap', target: 'creature', good: false, multi: 2 })],
        [/^(?:you may )?return target artifact creature card from your graveyard to your hand$/i, m => ({ t: 'regrow', what: 'artifact creature', may: /^you may/i.test(m[0]) })],
        [/^put target artifact on top of its owner's library$/i, () => ({ t: 'toTop', target: 'perm', filter: 'artifact' })],
        [/^regenerate target (artifact|green creature)$/i, m => ({ t: 'regenTarget', target: 'perm', filter: m[1].toLowerCase(), good: true })],
        [/^return target creature to its owner's hand unless its controller pays \{(\d+)\}$/i, m => ({ t: 'bounce', target: 'creature', unless: +m[1] })],
        [/^exile all cards from your library$/i, () => ({ t: 'exileLibrary' })],
        [/^shuffle your library$/i, () => ({ t: 'shuffleSelf' })],
        [/^untap all creatures you control$/i, () => ({ t: 'untapAllMine' })],
        [/^(?:you may )?play up to two additional lands this turn$/i, () => ({ t: 'extraLands', n: 2 })],
        [/^put up to two creature cards from your hand onto the battlefield$/i, () => ({ t: 'putFromHandN', n: 2, what: 'creature' })],
        [/^regenerate each creature you control$/i, () => ({ t: 'regenAll' })],
        [/^look at target opponent's hand$/i, () => ({ t: 'lookHand', target: 'player', oppOnly: true })],
        [/^(?:until end of turn, )?target land becomes a (\d+)\/(\d+) creature(?: that's still a land)?(?: until end of turn)?$/i, m => ({ t: 'animateLand', target: 'perm', filter: 'land', p: +m[1], q: +m[2], kw: [], good: true })],
        [/^put target permanent you own on the bottom of your library$/i, () => ({ t: 'toBottomOwn', target: 'perm', filter: 'permanent you own', good: true })],
        [/^target player exiles a card from their graveyard$/i, () => ({ t: 'exileGyCard', target: 'player', oppOnly: true })],
        [/^until end of turn, you gain control of target creature and it gains haste$/i, () => ({ t: 'steal', target: 'creature' })],
        [/^unattach all equipment from target creature$/i, () => ({ t: 'unattachEquip', target: 'creature', theirs: true, good: false })],
        [/^target creature gets \+x\/\+x until end of turn, where x is ~'s power$/i, () => ({ t: 'pump', p: 0, q: 0, kw: [], target: 'creature', good: true, pqFrom: 'srcPow' })],
        [/^all creatures able to block target creature this turn do so$/i, () => ({ t: 'pump', p: 0, q: 0, kw: ['lure'], target: 'creature', good: true })],
        [/^~ deals damage equal to the sacrificed artifact's mana value to any target$/i, () => ({ t: 'dmg', n: 0, nFrom: 'sacMv', target: 'any' })],
        [/^put x \+1\/\+1 counters on target creature, where x is the sacrificed artifact's mana value$/i, () => ({ t: 'counters', n: 0, nFrom: 'sacMv', target: 'creature', good: true })],
        [/^counter target activated ability from an artifact source$/i, () => ({ t: 'counter', target: 'spell', filter: 'artifactAbility' })],
        [/^target opponent puts a card from their hand on top of their library$/i, () => ({ t: 'oppHandToTop', target: 'player', oppOnly: true })],
        [/^creatures don't untap during target player's next untap step$/i, () => ({ t: 'noUntapNext', target: 'player', oppOnly: true })],
        [/^creatures target player controls attack this turn if able$/i, () => ({ t: 'mustAttackAll', target: 'player', oppOnly: true })],
        [/^create an x\/x black demon creature token with flying, where x is the number of cards in your hand$/i, () => ({ t: 'token', n: 1, p: 0, q: 0, name: 'black demon', kw: ['flying'], pqHand: true })],
        [/^exile target attacking creature and all equipment attached to it$/i, () => ({ t: 'exileWithEquip', target: 'perm', filter: 'attacking creature' })],
        [/^target player discards two cards unless they discard an artifact card$/i, () => ({ t: 'discardUnlessArt', n: 2, target: 'player', oppOnly: true })],
        [/^counter target spell unless its controller pays \{1\} for each artifact you control$/i, () => ({ t: 'counter', target: 'spell', filter: 'any', unlessFrom: 'myArtifacts' })],
        [/^(?:you may )?exile target nontoken creature$/i, m => ({ t: 'exileImprint', target: 'perm', filter: 'nontoken creature', may: /^you may/i.test(m[0]) })],
        [/^(?:you may )?exile target land you control$/i, m => ({ t: 'exileImprint', target: 'perm', filter: 'land you control', good: true, may: /^you may/i.test(m[0]) })],
        [/^(?:you may )?exile two target sorcery cards from a single graveyard$/i, () => ({ t: 'helixImprint' })],
        [/^(?:you may )?exile an instant card with mana value 2 or less from your hand$/i, () => ({ t: 'imprintHand', what: 'instant mv2' })],
        [/^(?:you may )?exile a nonartifact, nonland card from your hand$/i, () => ({ t: 'imprintHand', what: 'nonartifact nonland' })],
        [/^(?:you may )?exile a creature card from your hand$/i, () => ({ t: 'imprintHand', what: 'creature' })],
        [/^attach all equipment on the battlefield to it$/i, () => ({ t: 'attachAllEquipAll' })],
        [/^distribute three \+1\/\+1 counters among one, two, or three target creatures$/i, () => ({ t: 'counters', n: 3, target: 'creature', div: true, good: true })],
        [/^~ deals damage to you equal to the number of charge counters on it$/i, () => ({ t: 'dmgSelfCharge' })],
        [/^target opponent gains control of ~ and puts a charge counter on it$/i, () => ({ t: 'chokerPass' })],
        [/^put a charge counter on ~ or remove one from it$/i, () => ({ t: 'chokerAdjust' })],
        [/^you control target player during that player's next turn$/i, () => ({ t: 'mindslave', target: 'player', oppOnly: true })],
        [/^its controller loses (\d+) life$/i, m => ({ t: 'hostCtlLose', n: +m[1] })],
        [/^that player sacrifices an artifact of their choice$/i, () => ({ t: 'activeSacArt' })],
        [/^that player adds \{C\} for each artifact they control$/i, () => ({ t: 'urnMana' })],
        [/^destroy target nonland permanent with the lowest mana value$/i, () => ({ t: 'cullLowest' })],
        [/^exile that creature$/i, () => ({ t: 'exileCtx' })],
        [/^that creature's controller loses that much life$/i, () => ({ t: 'ctxCtlLoseN' })],
        [/^destroy that creature$/i, () => ({ t: 'destroyBlockers', filter: 'artifact creature' })],
        [/^destroy both creatures$/i, () => ({ t: 'destroyCombatPair' })],
        [/^(?:you may )?return target card named ~ from your graveyard to your hand$/i, () => ({ t: 'regrowNamed' })],
        [/^regenerate it$/i, () => ({ t: 'regen' })],
        [/^(?:you may )?have target opponent lose (\d+) life$/i, m => ({ t: 'drain', n: +m[1] })],
        [/^put that many \+1\/\+1 counters on ~$/i, () => ({ t: 'counters', n: 0, nFrom: 'ctxCount', target: 'self' })],
        [/^put that many charge counters on ~$/i, () => ({ t: 'namedCounter', n: 0, nFrom: 'ctxCount', kind: 'charge' })],
        [/^(?:you may )?draw a card$/i, m => ({ t: 'draw', n: 1, may: /^you may/i.test(m[0]) })],
        [/^create that many 1\/1 green insect creature tokens$/i, () => ({ t: 'token', n: 0, nFrom: 'ctxCount', p: 1, q: 1, name: 'green insect', kw: [] })],
        [/^destroy all permanents other than ~$/i, () => ({ t: 'worldslay' })],
        [/^that player adds \{G\}$/i, () => ({ t: 'casterMana', color: 'G' })],
        [/^~ deals 2 damage to that player$/i, () => ({ t: 'dmgCtxPlayer', n: 2 })],
        [/^its controller chooses target permanent another player controls that shares a card type with it\. exchange control of those permanents$/i, () => ({ t: 'confusion' })],
        [/^(?:you may )?untap target artifact$/i, m => ({ t: 'untap', target: 'perm', filter: 'artifact', may: /^you may/i.test(m[0]) })],
        [/^~ gets \+4\/\+4 until end of turn$/i, () => ({ t: 'pump', p: 4, q: 4, kw: [], target: 'self', good: true })],
        [/^put a fate counter on target permanent$/i, () => ({ t: 'fateCounter', target: 'perm', filter: 'permanent', good: true })],
        [/^~ gains all activated abilities of target creature until end of turn$/i, () => ({ t: 'borrowActs', target: 'creature' })],
        [/^target permanent you control gains protection from artifacts or from the color of your choice until end of turn$/i, () => ({ t: 'razorBarrier', target: 'perm', filter: 'permanent you control', good: true })],
        [/^prevent the next (\d+) damage that would be dealt to any target this turn$/i, m => ({ t: 'preventNext', n: +m[1], target: 'any', good: true })],
        [/^prevent all damage that would be dealt this turn by a source of your choice that shares a color with the exiled card$/i, () => ({ t: 'mournerShield' })],
        [/^~ becomes a (\d+)\/(\d+) elemental artifact creature that's still a land$/i, m => ({ t: 'permAnimatePT', p: +m[1], q: +m[2], type: 'Artifact Creature — Elemental' })],
        [/^it deals 2 damage to each attacking creature without flying$/i, () => ({ t: 'dmgAttackersNoFly', n: 2 })],
        [/^exile target permanent you control$/i, () => ({ t: 'exileUntilLeaves', target: 'perm', filter: 'permanent you control', good: true })],
        [/^return all cards exiled with ~ to the battlefield under your control$/i, () => ({ t: 'noop' })],
        [/^destroy target artifact if its mana value is equal to the amount of unspent mana you have$/i, () => ({ t: 'glissa', target: 'perm', filter: 'artifact' })],
        [/^each opponent who cast a spell this turn with the same name as that card loses 6 life$/i, () => ({ t: 'noop' })],
        [/^return target artifact creature card from your graveyard to your hand$/i, () => ({ t: 'regrow', what: 'artifact creature' })],
        [/^~ deals 1 damage to each creature and each player$/i, () => ({ t: 'dmgSweep', n: 1, filt: 'all', players: true })],
        [/^destroy all nonartifact, nonblack creatures$/i, () => ({ t: 'wipe', how: 'destroy', what: 'nonartifact, nonblack creatures' })],
    ],
    triggers: [
        [/^At the beginning of each player's upkeep, (.+)$/, () => ({ ev: 'upkeep', who: 'each' })],
        [/^At the beginning of each upkeep, (.+)$/, () => ({ ev: 'upkeep', who: 'each' })],
        [/^At the beginning of each opponent's upkeep, (.+)$/, () => ({ ev: 'upkeep', who: 'opp' })],
        [/^At the beginning of each end step, (.+)$/, () => ({ ev: 'end', who: 'each' })],

        [/^Whenever you cast a creature spell with power (\d+) or greater, (.+)$/, m => ({ ev: 'cast', filter: `cpow${m[1]}` })],
        [/^Whenever one or more creatures you control with power (\d+) or greater attack, (.+)$/, m => ({ ev: 'attacks', attackWith: 'creatures', minPow: +m[1] })],
    ],
    lines: [
    (ctx) => {
        // Mirrodin (2026-10-08)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^Entwine—Sacrifice (two|three) lands\.$/))) { R.kicker = parseCost(''); R.entwine = true; R.kickSac = { kind: 'land', n: num(m[1]) }; { ctx.li = li; return true; } }
        if (/^Equip costs you pay cost \{1\} less\.$/.test(line)) { R.equipLess = 1; { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as ~ is equipped, each creature you control that's a ([A-Z][a-z]+) or an? ([A-Z][a-z]+) gets \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ types: [m[1], m[2]], p: +m[3], q: +m[4], kw: [], cond: '~ is equipped' }); { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as ~ is equipped, it gets \+(\d+)\/\+(\d+)(?: and has ([a-z ,]+))?\.$/)) && (!m[3] || allKnown(splitKw(m[3])))) { (R.selfCond = R.selfCond || []).push({ cond: '~ is equipped', p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) for each (.+)\.$/)) && countFn(`the number of ${m[3].replace(/ it$/, ' ~')}`)) { R.buff = { p: 0, q: 0, kw: [] }; R.buffPer = { p: +m[1], q: +m[2], what: `the number of ${m[3].replace(/ it$/, ' ~')}`, host: true }; { ctx.li = li; return true; } }
        if (/^Equipped creature has trample and can't be blocked by more than one creature\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['trample', 'maxoneblock'] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) and doesn't untap during its controller's untap step\.$/))) { R.buff = { p: +m[1], q: +m[2], kw: ['nountap'] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Equip—Pay (\d+) life\.?$/))) { R.equip = parseCost(''); R.equipLife = +m[1]; R.equipText = `Pay ${m[1]} life`; { ctx.li = li; return true; } }
        if (/^Enchant artifact$/.test(line)) { R.aura = true; R.auraTarget = 'artifact'; { ctx.li = li; return true; } }
        if (/^Enchant artifact creature$/.test(line)) { R.aura = true; R.auraTarget = 'artifact creature'; { ctx.li = li; return true; } }
        if (/^You control enchanted artifact creature\.$/.test(line)) { R.auraSteal = true; R.buffBad = true; { ctx.li = li; return true; } }
        if (/^Enchanted artifact doesn't untap during its controller's untap step\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['nountap'] }; R.buffBad = true; { ctx.li = li; return true; } }
        if (/^Enchanted artifact has "At the beginning of your upkeep, you lose 2 life\."$/.test(line)) { R.buffBad = true; R.trig.push({ ev: 'upkeep', who: 'host', effects: [{ t: 'hostCtlLose', n: 2 }] }); { ctx.li = li; return true; } }
        if (/^Whenever enchanted creature becomes the target of a spell or ability, that spell or ability's controller gains control of that creature\.$/.test(line)) { R.buffBad = true; R.trig.push({ ev: 'targeted', host: true, effects: [{ t: 'loyaltyFracture' }] }); { ctx.li = li; return true; } }
        if (/^Whenever enchanted creature attacks or blocks, its controller loses 3 life\.$/.test(line)) { R.buffBad = true; R.trig.push({ ev: 'attacks', host: true, effects: [{ t: 'hostCtlLose', n: 3 }] }, { ev: 'blocks', host: true, effects: [{ t: 'hostCtlLose', n: 3 }] }); { ctx.li = li; return true; } }
        if (/^Whenever ~ attacks or blocks, remove a \+1\/\+1 counter from it at end of combat\.$/.test(line)) { R.clockwork = true; { ctx.li = li; return true; } }
        if (/^~ can't be blocked as long as defending player controls an artifact\.$/.test(line)) { R.spy = true; { ctx.li = li; return true; } }
        if (/^~ can't attack or block unless you pay \{1\} for each \+1\/\+1 counter on it\.$/.test(line)) { R.protoTax = true; { ctx.li = li; return true; } }
        if (/^\{T\}: Add an amount of \{G\} equal to ~'s power\.$/.test(line)) { R.mana = { colors: ['G'], n: 1, nPow: true }; { ctx.li = li; return true; } }
        if (/^\{T\}: Add one mana of any of the exiled card's colors\.$/.test(line)) { R.mana = { colors: [...COLORS], n: 1, imprintColors: true }; { ctx.li = li; return true; } }
        if (/^Whenever a land with the same name as the exiled card is tapped for mana, its controller adds one mana of any type that land produced\.$/.test(line)) { R.lens = true; { ctx.li = li; return true; } }
        if (/^~ has protection from each of the exiled card's card types\.$/.test(line)) { R.mirrorPro = true; { ctx.li = li; return true; } }
        if (/^As long as a card exiled with ~ is a creature card, ~ has the power, toughness, and creature types of the last creature card exiled with it\. It's still a Shapeshifter\.$/.test(line)) { R.duplicant = true; { ctx.li = li; return true; } }
        if (/^Whenever a player casts a spell that shares a color or mana value with the exiled card, ~ deals 2 damage to that player\.$/.test(line)) { R.trig.push({ ev: 'cast', who: 'any', filter: 'any', fn: 'prison', effects: [{ t: 'dmgCtxPlayer', n: 2 }] }); { ctx.li = li; return true; } }
        if (/^Whenever a player casts a card, if it has the same name as one of the cards exiled with ~, you may copy the other\. If you do, you may cast the copy without paying its mana cost\.$/.test(line)) { R.trig.push({ ev: 'cast', who: 'any', filter: 'any', fn: 'helix', effects: [{ t: 'helixCopy' }] }); { ctx.li = li; return true; } }
        if (/^Whenever a player casts a spell with mana value equal to the number of charge counters on ~, counter that spell\.$/.test(line)) { R.chalice = true; { ctx.li = li; return true; } }
        if (/^Activated abilities of artifacts and creatures can't be activated unless they're mana abilities\.$/.test(line)) { R.damping = true; { ctx.li = li; return true; } }
        if (/^You can't cast creature spells\.$/.test(line)) { R.noCreatureSpells = true; { ctx.li = li; return true; } }
        if (/^Each player can't cast more than one spell each turn\.$/.test(line)) { R.ruleOfLaw = true; { ctx.li = li; return true; } }
        if (/^Each artifact spell costs \{1\} more to cast for each artifact its controller controls\.$/.test(line)) { R.hum = true; { ctx.li = li; return true; } }
        if (/^If an artifact would deal damage to you, prevent 1 of that damage\.$/.test(line)) { R.sphere = true; { ctx.li = li; return true; } }
        if (/^You can't lose the game and your opponents can't win the game\.$/.test(line)) { R.cantLose = true; { ctx.li = li; return true; } }
        if (/^If you would flip a coin, instead flip two coins and ignore one\.$/.test(line)) { R.thumb = true; { ctx.li = li; return true; } }
        if (/^If a player would draw a card, that player exiles the top card of one of their opponents' libraries face down instead\.$/.test(line)) { R.sharedFate = true; { ctx.li = li; return true; } }
        if (/^Each player may look at cards they exiled with ~, and they may play lands and cast spells from among those cards\.$/.test(line)) { ctx.li = li; return true; } // Shared Fate: in drawCards
        if (/^All creatures have haste\.$/.test(line)) { R.statics.push({ global: true, p: 0, q: 0, kw: ['haste'] }); { ctx.li = li; return true; } }
        if (/^Each noncreature artifact is an artifact creature with power and toughness each equal to its mana value\.$/.test(line)) { R.march = true; { ctx.li = li; return true; } }
        if (/^Whenever ~ or another artifact enters, put a charge counter on ~\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'artAnyOrSelf', effects: [{ t: 'namedCounter', n: 1, kind: 'charge' }] }); { ctx.li = li; return true; } }
        if (/^Whenever an artifact enters, you may gain 1 life\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'artAny', effects: [{ t: 'gain', n: 1 }] }); { ctx.li = li; return true; } }
        if (/^Whenever an artifact enters, ~ gets \+4\/\+4 until end of turn\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'artAny', effects: [{ t: 'pump', p: 4, q: 4, kw: [], target: 'self', good: true }] }); { ctx.li = li; return true; } }
        if (/^Whenever an artifact is put into a graveyard from the battlefield, you may have target opponent lose 1 life\.$/.test(line)) { R.trig.push({ ev: 'artifactToGy', effects: [{ t: 'drain', n: 1 }] }); { ctx.li = li; return true; } }
        if (/^Whenever ~ or another artifact creature dies, you may untap target artifact\.$/.test(line)) { R.trig.push({ ev: 'creatureDies', fn: 'artCreatureDies', effects: [{ t: 'untap', target: 'perm', filter: 'artifact', good: true }] }); { ctx.li = li; return true; } }
        if (/^Whenever a source an opponent controls deals damage to you, if ~ is untapped, you may draw a card\.$/.test(line)) { R.trig.push({ ev: 'playerDamaged', fn: 'oppSourceToMe', cond: '~ is untapped', effects: [{ t: 'draw', n: 1 }] }); { ctx.li = li; return true; } }
        if (/^Whenever you're dealt damage, put that many charge counters on ~\.$/.test(line)) { R.trig.push({ ev: 'playerDamaged', fn: 'toMe', effects: [{ t: 'namedCounter', n: 0, nFrom: 'ctxCount', kind: 'charge' }] }); { ctx.li = li; return true; } }
        if (/^Whenever an opponent is dealt damage, put that many \+1\/\+1 counters on ~\.$/.test(line)) { R.trig.push({ ev: 'playerDamaged', fn: 'toOpp', effects: [{ t: 'counters', n: 0, nFrom: 'ctxCount', target: 'self' }] }); { ctx.li = li; return true; } }
        if (/^Whenever a spell or ability causes a player to shuffle their library, ~ deals 2 damage to that player\.$/.test(line)) { R.trig.push({ ev: 'shuffled', effects: [{ t: 'dmgCtxPlayer', n: 2 }] }); { ctx.li = li; return true; } }
        if (/^Whenever a player casts a creature spell, that player adds \{G\}\.$/.test(line)) { R.trig.push({ ev: 'cast', who: 'any', filter: 'creature', effects: [{ t: 'casterMana', color: 'G' }] }); { ctx.li = li; return true; } }
        if (/^Whenever a permanent becomes untapped, that permanent's controller mills a card\.$/.test(line)) { R.mesmeric = true; { ctx.li = li; return true; } }
        if (/^Whenever an artifact, creature, or enchantment enters, its controller chooses target permanent another player controls that shares a card type with it\. Exchange control of those permanents\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'confusion', effects: [{ t: 'confusion' }] }); { ctx.li = li; return true; } }
        if (/^Whenever ~ deals combat damage to a creature, that creature's controller loses that much life\.$/.test(line)) { R.trig.push({ ev: 'dealsDamage', fn: 'selfCombatCreature', effects: [{ t: 'ctxCtlLoseN' }] }); { ctx.li = li; return true; } }
        if (/^Whenever equipped creature deals combat damage, put a charge counter on ~\.$/.test(line)) { R.trig.push({ ev: 'dealsDamage', fn: 'hostCombat', once: 'banshee', effects: [{ t: 'namedCounter', n: 1, kind: 'charge' }] }); { ctx.li = li; return true; } }
        if (/^Whenever equipped creature deals damage to a creature, exile that creature\.$/.test(line)) { R.trig.push({ ev: 'dealsDamage', fn: 'hostToCreature', effects: [{ t: 'exileCtx' }] }); { ctx.li = li; return true; } }
        if (/^Whenever equipped creature blocks or becomes blocked by a creature, destroy both creatures\.$/.test(line)) { R.trig.push({ ev: 'blocks', host: true, effects: [{ t: 'destroyCombatPair' }] }, { ev: 'blocked', host: true, effects: [{ t: 'destroyCombatPair' }] }); { ctx.li = li; return true; } }
        if (/^Whenever a creature dealt damage by equipped creature this turn dies, return that card to the battlefield under your control\. Attach ~ to that creature\.$/.test(line)) { R.scythe = true; { ctx.li = li; return true; } }
        if (/^Whenever ~ becomes blocked by an artifact creature, destroy that creature\.$/.test(line)) { R.trig.push({ ev: 'blocked', effects: [{ t: 'destroyBlockers', filter: 'artifact creature' }] }); { ctx.li = li; return true; } }
        if (/^Whenever ~ becomes blocked, you may return target card named ~ from your graveyard to your hand\.$/.test(line)) { R.trig.push({ ev: 'blocked', effects: [{ t: 'regrowNamed' }] }); { ctx.li = li; return true; } }
        if (/^At the beginning of the end step, if you control no artifacts, sacrifice ~\.$/.test(line)) { R.trig.push({ ev: 'end', who: 'each', cond: 'you control no artifacts', effects: [{ t: 'sacSelf' }] }); { ctx.li = li; return true; } }
        if (/^At the beginning of each player's first main phase, if ~ is untapped, that player adds \{C\} for each artifact they control\.$/.test(line)) { R.trig.push({ ev: 'main1', who: 'each', cond: '~ is untapped', effects: [{ t: 'urnMana' }] }); { ctx.li = li; return true; } }
        if (/^At the beginning of each player's upkeep, that player sacrifices an artifact of their choice\.$/.test(line)) { R.trig.push({ ev: 'upkeep', who: 'each', effects: [{ t: 'activeSacArt' }] }); { ctx.li = li; return true; } }
        if (/^Spend only black mana on (?:X|97)\.$/.test(line)) { R.xBlackOnly = true; { ctx.li = li; return true; } }
        if (/^At the beginning of your upkeep, if ~ has five or more charge counters on it, remove all of them from it and create that many 3\/1 red Elemental creature tokens with haste\. Exile them at the beginning of the next end step\.$/.test(line)) { R.trig.push({ ev: 'upkeep', effects: [{ t: 'coils' }] }); { ctx.li = li; return true; } }
        if (/^You may spend blue mana as though it were mana of any color to pay the activation costs of ~'s abilities\.$/.test(line)) { R.blueAny = true; { ctx.li = li; return true; } }
        return false;
    }
    ],
});
