// Spellslinger Duels - rules pack: Magic 2010 (2026-10-08).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'm10',
    effects: [
        [/^(destroy|exile) target (white|blue|black|red|green) or (white|blue|black|red|green) (permanent|creature)$/i, m => ({ t: m[1].toLowerCase(), target: 'perm', filter: `${m[2]} or ${m[3]} ${m[4]}`.toLowerCase() })],
        [/^counter target (white|blue|black|red|green) or (white|blue|black|red|green) spell$/i, m => ({ t: 'counter', target: 'spell', filter: `${m[1]} or ${m[2]}`.toLowerCase() })],
        [/^each player draws (\w+) cards, then discards (\w+) cards at random$/i, m => [{ t: 'drawAll', n: num(m[1]) }, { t: 'discardAll', n: num(m[2]) }]],
        [/^put target creature on top of its owner's library$/i, () => ({ t: 'topdeck', target: 'perm', filter: 'creature' })],
        [/^~ deals 97 damage divided evenly, rounded down, among any number of targets$/i, () => ({ t: 'dmg', n: 97, target: 'any' })], // Fireball, played with one target
        [/^the next (\w+) damage that a source of your choice would deal to you and\/or permanents you control this turn is dealt to any target instead$/i, m => ({ t: 'harmsWay', n: num(m[1]), target: 'any' })],
        [/^§haunting$/, () => ({ t: 'hauntingEchoes' })],
        [/^create a (\d+)\/(\d+) ([a-z]+ [A-Za-z]+) creature token for each ([A-Z][a-z]+) you control$/i, m => ({ t: 'token', n: 0, nCount: `the number of ${m[4]} you control`, p: +m[1], q: +m[2], name: m[3].toLowerCase(), kw: [] })],
        [/^~ deals (\w+) damage divided as you choose among one, two, or three target (white|blue|black|red|green) and\/or (white|blue|black|red|green) creatures$/i, m => ({ t: 'dmg', n: num(m[1]), target: 'creature', only: `${m[2]} or ${m[3]} creature`.toLowerCase(), div: 3 })],
        [/^return all artifact and enchantment cards from all graveyards to the battlefield under their owners' control$/i, () => ({ t: 'openVaults' })],
        [/^§polymorph$/, () => ({ t: 'polymorph', target: 'creature' })],
        [/^~ target creature$/, () => ({ t: 'regenTarget', target: 'perm', filter: 'creature', good: true })], // the card Regenerate
        [/^that creature is a black zombie in addition to its other colors and types$/i, () => ({ t: 'zombify' })],
        [/^~ deals (\w+) damage to that creature$/i, m => ({ t: 'dmgPartners', n: num(m[1]) })], // Inferno Elemental: the creature it fights
        [/^that creature doesn't untap during its controller's next untap step$/i, () => ({ t: 'freezePartners' })], // Wall of Frost
        [/^(destroy|exile) target (white|blue|black|red|green) or (white|blue|black|red|green) permanent that player controls$/i, m => ({ t: m[1].toLowerCase(), target: 'perm', filter: `${m[2]} or ${m[3]} permanent an opponent controls`.toLowerCase() })],
        [/^destroy ~$/i, () => ({ t: 'destroySelf' })],
        [/^target creature an opponent controls attacks you this turn if able$/i, () => ({ t: 'mustAttackT', target: 'creature', theirs: true, good: false })],
        [/^§reaper$/, () => ({ t: 'reaper' })],
        [/^§awakener$/, () => ({ t: 'animateWhile', target: 'perm', filter: 'Forest', p: 4, q: 5, good: true })],
        [/^§efreet$/, () => ({ t: 'efreet' })],
        [/^§hivemind$/, () => ({ t: 'hiveMind' })],
        [/^§lurking$/, () => ({ t: 'lurking' })],
        [/^§sphinxamb$/, () => ({ t: 'sphinxAmb' })],
        [/^§xathrid$/, () => ({ t: 'xathrid' })],
        [/^(?:you may )?put a creature card from your hand onto the battlefield$/i, () => ({ t: 'putFromHand', what: 'creature' })],
        [/^enchanted creature gets ([+-]\d+)\/([+-]\d+) until end of turn$/i, m => ({ t: 'pumpHost', p: +m[1], q: +m[2] })],
        [/^untap two target lands$/i, () => ({ t: 'untapLandsN', n: 2 })],
        [/^~ deals (\w+) damage to any target and (\w+) damage to you$/i, m => [{ t: 'dmg', n: num(m[1]), target: 'any' }, { t: 'dmgYou', n: num(m[2]) }]],
        [/^target ([A-Z][a-z]+) creature can't be blocked this turn$/i, m => ({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', only: m[1], good: true })],
        [/^exile target ([A-Z][a-z]+), ([A-Z][a-z]+), or ([A-Z][a-z]+)$/i, m => ({ t: 'exile', target: 'perm', filter: `types:${m[1]}|${m[2]}|${m[3]}` })],
        [/^§stonegiant$/, () => ({ t: 'stoneGiant', target: 'creature', mine: true, good: true })],
        [/^§wildhunt$/, () => ({ t: 'wildHunt', target: 'creature' })],
        [/^§mirrorfate$/, () => ({ t: 'mirrorFate' })],
        [/^§djinnwish$/, () => ({ t: 'djinnWish' })],
        [/^~ deals 97 damage to target creature$/i, () => ({ t: 'dmg', n: 97, target: 'creature' })],
        [/^~ deals (\w+) damage to target player or planeswalker and each creature that player or that planeswalker's controller controls$/i, m => ({ t: 'dmgPlayerAndCreatures', n: num(m[1]) })],
        [/^prevent all damage that would be dealt to you and creatures you control this turn$/i, () => ({ t: 'safePassage' })],
        [/^~ deals x damage to target creature and you gain x life, where x is (the number of .+)$/i, m => (countFn(m[1]) ? [{ t: 'dmg', n: 0, target: 'creature', nCount: m[1] }, { t: 'gain', n: 0, nCount: m[1] }] : null)],
        [/^target player mills half their library, rounded down$/i, () => ({ t: 'millHalf' })],
        [/^§warpworld$/, () => ({ t: 'warpWorld' })],
    ],
    triggers: [
        [/^At the beginning of the end step, (.+)$/, () => ({ ev: 'end', who: 'each' })],
        [/^Whenever an opponent casts an? (white|blue|black|red|green) or (white|blue|black|red|green) spell, (.+)$/, m => ({ ev: 'cast', who: 'opp', filter: `colors:${COLOR_WORDS[m[1]]}|${COLOR_WORDS[m[2]]}` })],
        [/^Whenever ~ blocks or becomes blocked by a creature, (.+)$/, () => [{ ev: 'blocks' }, { ev: 'blocked' }]],
        [/^Whenever ~ blocks a creature, (.+)$/, () => ({ ev: 'blocks' })],
        [/^When ~ becomes the target of a spell or ability, (.+)$/, () => ({ ev: 'targeted' })],
        [/^When enchanted creature becomes the target of a spell or ability, (.+)$/, () => ({ ev: 'targeted', host: true })],
        [/^Whenever an opponent discards a card, (.+)$/, () => ({ ev: 'discarded', who: 'opp' })],
    ],
    lines: [
    (ctx) => {
        // Magic 2010 (2026-10-08)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^~ costs \{1\} more to cast for each target beyond the first\.$/.test(line)) { ctx.li = li; return true; } // Fireball: played with one target, so the extra-target cost is never paid (a shortcut)
        if (/^Enchant tapped creature$/.test(line)) { R.aura = true; R.auraTarget = 'tapped creature'; { ctx.li = li; return true; } }
        if (/^Enchant permanent$/.test(line)) { R.aura = true; R.auraTarget = 'permanent'; { ctx.li = li; return true; } }
        if (/^Enchanted permanent has indestructible\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['indestructible'] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^(.+), protection from ([A-Z][a-z]+?)s and from ([A-Z][a-z]+?)s$/)) && allKnown(splitKw(m[1].toLowerCase()))) { splitKw(m[1].toLowerCase()).forEach(k => R.kw.add(k)); R.proTypes = [...(R.proTypes || []), m[2], m[3]]; { ctx.li = li; return true; } } // Baneslayer Angel
        if ((m = line.match(/^~ can't be blocked except by (white|blue|black|red|green) creatures\.$/))) { R.kw.add(`blockonlycolor:${COLOR_WORDS[m[1]]}`); { ctx.li = li; return true; } }
        if (/^~ can block any number of creatures\.$/.test(line)) { R.kw.add('blockany'); { ctx.li = li; return true; } }
        if (/^If a source an opponent controls would deal damage to you, prevent 1 of that damage\.$/.test(line)) { R.seraph = true; { ctx.li = li; return true; } }
        if (/^Prevent all noncombat damage that would be dealt to equipped creature\.$/.test(line)) { R.buff = R.buff || { p: 0, q: 0, kw: [] }; R.buff.kw.push('nononcombat'); { ctx.li = li; return true; } }
        if (/^If damage would be dealt to ~, prevent that damage and remove that many \+1\/\+1 counters from it\.$/.test(line)) { R.protean = true; { ctx.li = li; return true; } }
        if (/^Whenever a \+1\/\+1 counter is removed from ~, put two \+1\/\+1 counters on it at the beginning of the next end step\.$/.test(line)) { R.protean = true; { ctx.li = li; return true; } } // done in damage() / endTurn
        if (/^~ gets \+1\/\+1 for each other creature on the battlefield named ~\.$/.test(line)) { R.namedBuff = true; { ctx.li = li; return true; } }
        if (/^A deck can have any number of cards named ~\.$/.test(line)) { R.anyNumber = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ can't attack unless defending player controls an? ([A-Z][a-z]+)\.$/))) { R.attackNeedsLand = m[1]; { ctx.li = li; return true; } }
        if (/^Your opponents play with their hands revealed\.$/.test(line)) { R.telepathy = true; { ctx.li = li; return true; } }
        if (/^As ~ enters, choose a basic land type\.$/.test(line)) { R.chooseLandType = true; { ctx.li = li; return true; } }
        if (/^Enchanted land is the chosen type\.$/.test(line)) { R.landBecomes = 'chosen'; { ctx.li = li; return true; } }
        if (/^If ~ would be put into a graveyard from anywhere, reveal ~ and shuffle it into its owner's library instead\.$/.test(line)) { R.shuffleInstead = true; { ctx.li = li; return true; } }
        if (/^Whenever a player taps a land for mana, ~ deals 1 damage to that player\.$/.test(line)) { R.manabarbs = true; { ctx.li = li; return true; } }
        if (/^You control enchanted creature\.$/.test(line)) { R.auraSteal = true; R.buffBad = true; { ctx.li = li; return true; } }
        if (/^As ~ enters, choose a card name\.$/.test(line)) { R.needle = true; { ctx.li = li; return true; } }
        if (/^Activated abilities of sources with the chosen name can't be activated unless they're mana abilities\.$/.test(line)) { R.needle = true; { ctx.li = li; return true; } }
        if (/^Each creature gets \+1\/\+1 for each other creature on the battlefield that shares at least one creature type with it\.$/.test(line)) { R.coatOfArms = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^As long as the top card of your library is black, ~ and other ([A-Z][a-z]+) creatures you control get \+(\d+)\/\+(\d+) and have ([a-z ]+)\.$/)) && allKnown(splitKw(m[4]))) { R.statics.push({ type: m[1], p: +m[2], q: +m[3], kw: splitKw(m[4]), cond: 'the top card of your library is black' }); { ctx.li = li; return true; } }
        if ((m = line.match(/^~ enters with (\w+) (wish|charge|time|fade|age|quest|oil) counters on it\.$/)) && num(m[1])) { R.etbNamedN = { kind: m[2], n: num(m[1]) }; { ctx.li = li; return true; } }
        if (R.kind === 'planeswalker' && (m = line.match(/^−X: (.+)$/))) { let fx = parseEffects(xSub(m[1])); if (fx) { fx = xMarkDeep(fx); if (hasXMark(fx)) { R.acts.push({ loyalty: 0, loyaltyX: true, effects: fx, text: line, sorcery: true }); { ctx.li = li; return true; } } } }
        if (R.kind === 'planeswalker' && (m = line.match(/^−(\d+): Create a white Avatar creature token\. It has "~'s power and toughness are each equal to your life total\."$/))) { R.acts.push({ loyalty: -Number(m[1]), effects: [{ t: 'lifeAvatar' }], text: line, sorcery: true }); { ctx.li = li; return true; } }
        return false;
    }
    ],
});
