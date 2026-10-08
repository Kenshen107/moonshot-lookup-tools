// Spellslinger Duels - rules pack: precon round 2 (2026-10-09). The next cards that keep precons from being Ready
// (docs/spellslinger-precon-plan.md). Engine cases: 15b-precon-effects.js.
registerRules({
    name: 'precons2',
    effects: [
        // ---- counterspells ----
        [/^counter target sorcery spell$/i, () => ({ t: 'counter', target: 'spell', filter: 'sorcery', good: false })],
        [/^counter target creature or sorcery spell$/i, () => ({ t: 'counter', target: 'spell', filter: 'creature or sorcery', good: false })],
        [/^counter target spell that targets a creature$/i, () => ({ t: 'counter', target: 'spell', filter: 'targetsCreature', good: false })],
        [/^its controller draws a card$/i, () => ({ t: 'ctlDrawsCountered' })],
        [/^counter target spell unless its controller pays \{97\}$/i, () => ({ t: 'counter', target: 'spell', filter: 'any', unless: 97, good: false })],
        [/^if that player doesn't, they tap all lands with mana abilities they control and lose all unspent mana$/i, () => ({ t: 'noop' })],
        // ---- discard, tap, untap ----
        [/^~ deals (\w+) damage to target player or planeswalker$/i, m => ({ t: 'dmg', n: num(m[1]), target: 'player', oppOnly: true })],
        [/^that player or that planeswalker's controller discards (\w+) cards$/i, m => ({ t: 'discard', n: num(m[1]) })],
        [/^creatures and lands target opponent controls don't untap during their next untap step$/i, () => ({ t: 'exhaustion', target: 'player', oppOnly: true })],
        [/^tap or untap target artifact, creature, or land$/i, () => ({ t: 'tapOrUntap', target: 'perm', filter: 'artifact, creature, or land' })],
        [/^regenerate enchanted creature$/i, () => ({ t: 'regenHost' })],
        // ---- removal and damage ----
        [/^destroy target nonblack creature$/i, () => ({ t: 'destroy', target: 'perm', filter: 'nonblack creature', good: false })],
        [/^you gain life equal to its toughness$/i, () => ({ t: 'gainLastTou', you: true })],
        [/^~ deals damage to target player or planeswalker equal to the number of Goblins you control$/i, () => ({ t: 'dmg', n: 0, nCount: 'the number of Goblins you control', target: 'player', oppOnly: true })],
        [/^look at the top three cards of your library\. put one of them into your hand and the rest into your graveyard$/i, () => ({ t: 'lookSort', n: 3, hand: 1, gy: true })],
        [/^return up to two target creatures to their owner's hand$/i, () => ({ t: 'bounce', target: 'creature', multi: 2 })],
        [/^return two target creatures to their owners' hands$/i, () => ({ t: 'bounce', target: 'creature', multi: 2 })],
        [/^return two target creatures to their owner's hand$/i, () => ({ t: 'bounce', target: 'creature', multi: 2 })],
        [/^return two target creatures to its owner's hand$/i, () => ({ t: 'bounce', target: 'creature', multi: 2 })],
        [/^defending player discards a card$/i, () => ({ t: 'discard', n: 1 })],
        [/^§lookgy3$/, () => ({ t: 'lookSort', n: 3, hand: 1, gy: true })],
        [/^nonblack creatures get -1\/-1 until end of turn$/i, () => ({ t: 'pumpFilter', filter: 'nonblack', p: -1, q: -1 })],
        [/^destroy all nonwhite creatures$/i, () => ({ t: 'wipeFilter', filter: 'nonwhite' })],
        [/^destroy three target permanents$/i, () => ({ t: 'destroy', target: 'perm', filter: 'permanent', multi: 3, good: false })],
        [/^target opponent chooses a creature they control$/i, () => ({ t: 'edictDestroy' })],
        [/^destroy that creature$/i, null],
        [/^target creature with power (\d+) or greater gains ([a-z ]+) until end of turn$/i, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[2]), target: 'creature', only: `creature with power ${m[1]} or greater`, good: true })],
        [/^target creature gets \+7\/\+7 and gains trample until end of turn$/i, () => ({ t: 'pump', p: 7, q: 7, kw: ['trample'], target: 'creature', good: true })],
        [/^it must be blocked this turn if able$/i, () => ({ t: 'pump', p: 0, q: 0, kw: ['mustbeblocked'], target: 'last', good: true })],
        [/^target opponent sacrifices a creature(?: of their choice)?, discards three cards, then loses 5 life$/i, () => [{ t: 'edict', who: 'opp', what: 'creature' }, { t: 'discard', n: 3 }, { t: 'drain', n: 5 }]],
        [/^you return a creature card from your graveyard to your hand, (?:then )?draw three cards, then gain 5 life$/i, () => [{ t: 'regrowCreature' }, { t: 'draw', n: 3 }, { t: 'gain', n: 5 }]],
        // ---- batch 2 ----
        [/^put a \+1\/\+1 counter on equipped creature if it's white$/i, () => ({ t: 'counterHost', color: 'white' })],
        [/^target creature an opponent controls can't block this turn$/i, () => ({ t: 'pump', p: 0, q: 0, kw: ['cantblock'], target: 'creature', theirs: true, good: false })],
        [/^other creatures you control get \+2\/\+2 and gain vigilance and trample until end of turn$/i, () => ({ t: 'teamPump', other: true, p: 2, q: 2, kw: ['vigilance', 'trample'] })],
        [/^put a \+1\/\+1 counter on each attacking creature$/i, () => ({ t: 'counterAttackers' })],
        [/^you gain 1 life for each attacking creature$/i, () => ({ t: 'gain', n: 0, nFrom: 'attackers', per: 1 })],
        [/^prevent all combat damage that would be dealt this turn by target attacking creature with flying$/i, () => ({ t: 'pump', p: 0, q: 0, kw: ['nocombatdmg'], target: 'creature', only: 'attacking creature with flying', good: false })],
        [/^(?:it|~) deals 1 damage to each opponent and each creature and planeswalker they control$/i, () => ({ t: 'dmgPlayerCreatures', n: 1, m: 1 })],
        [/^~ deals damage to that creature's controller equal to ~'s power$/i, () => ({ t: 'meglonoth' })],
        [/^you may put x \+1\/\+1 counters on ~, where x is that creature's power$/i, () => ({ t: 'counters', n: 0, nFrom: 'ctxPow', target: 'self' })],
        [/^put x \+1\/\+1 counters on ~, where x is that creature's power$/i, () => ({ t: 'counters', n: 0, nFrom: 'ctxPow', target: 'self' })],
        [/^that creature's controller loses life equal to its toughness$/i, () => ({ t: 'hostDiesLose' })],
        [/^that player mills two cards$/i, () => ({ t: 'millCaster', n: 2 })],
        [/^target player draws a card, then discards a card$/i, () => ({ t: 'lootTarget', target: 'player' })],
        [/^put a \+1\/\+1 counter on target Beast creature you control$/i, () => ({ t: 'counters', n: 1, target: 'creature', mine: true, only: 'types:Beast', good: true })],
        [/^have target opponent discard a card$/i, () => ({ t: 'discard', n: 1 })],
        [/^have target opponent sacrifice a creature$/i, () => ({ t: 'edict', who: 'opp', what: 'creature' })],
        [/^put a basic land card from your hand onto the battlefield tapped$/i, () => ({ t: 'putLandFromHand', what: 'basic land', tapped: true })],
        [/^sacrifice (?:it|~) unless you sacrifice three Forests$/i, () => ({ t: 'sacUnlessForests' })],
        [/^each (?:other player|opponent) may put a creature card from their hand onto the battlefield$/i, () => ({ t: 'wumpus' })],
        [/^~ deals damage equal to its power to target creature$/i, () => ({ t: 'fightSelf', target: 'creature' })],
        [/^that creature deals damage equal to its power to ~$/i, () => ({ t: 'noop' })],
        [/^target player reveals a card at random from their hand, then loses life equal to that card's mana value$/i, () => ({ t: 'singeMind', target: 'player' })],
        [/^destroy all creatures with flying$/i, () => ({ t: 'wipeFilter', filter: 'flying' })],
        [/^§digpow2$/, () => ({ t: 'digTake', n: 4, kinds: ['creature'], maxPow: 2, rest: 'bottom' })],
        [/^~ deals damage equal to the number of charge counters on it to each opponent$/i, () => ({ t: 'reaverBurn' })],
        [/^§gift$/, () => ({ t: 'digTake', n: 4, kinds: ['creature', 'land'], both: true, rest: 'bottom' })],
        // ---- combat triggers ----
        [/^~ gets \+2\/\+0 until end of combat$/i, () => ({ t: 'pump', p: 2, q: 0, kw: [], target: 'self', good: true })],
        [/^it gets \+2\/\+0 until end of combat$/i, () => ({ t: 'pump', p: 2, q: 0, kw: [], target: 'self', good: true })],
        [/^§battlecry$/, () => ({ t: 'battleCry' })],
    ].filter(x => x[1] !== null),
    triggers: [
        [/^Whenever one or more creatures you control attack, (.+)$/, () => ({ ev: 'attacks', fn: 'myAttack' })],
        [/^Whenever ~ blocks a creature, (.+)$/, () => ({ ev: 'blocks', fn: 'dgBlocks' })],
        [/^Whenever another creature enters, (.+)$/, () => ({ ev: 'enters', fn: 'anotherCreature' })],
        [/^Whenever an opponent casts a spell, (.+)$/, () => ({ ev: 'cast', fn: 'oppCast', who: 'any', filter: 'any' })],
        [/^When enchanted creature dies, (.+)$/, () => ({ ev: 'dies', fn: 'hostDies' })],
        [/^When ~ is put into your graveyard from the battlefield, (.+)$/, () => ({ ev: 'toGy', fn: 'selfToGy' })],
        [/^Whenever you cast a green spell or a Forest you control enters, (.+)$/, () => [{ ev: 'cast', fn: 'castColorG', filter: 'any' }, { ev: 'landfall', fn: 'forestEnters' }]],
        [/^Whenever you cast a blue spell or an Island you control enters, (.+)$/, () => [{ ev: 'cast', fn: 'castColorU', filter: 'any' }, { ev: 'landfall', fn: 'islandEnters' }]],
        [/^Whenever ~ attacks and isn't blocked, (.+)$/, () => ({ ev: 'unblocked', fn: 'selfBlocked' })],
    ],
    lines: [
        (ctx) => {
            const { R } = ctx; const line = ctx.line; let m;
            const done = () => true;
            if (/^~ can't block creatures with power 2 or greater\.$/.test(line)) { (R.blockerFns = R.blockerFns || []).push('noPow2'); return done(); }
            if (/^Vigilance; horsemanship$/.test(line)) { R.kw.add('vigilance'); R.kw.add('horsemanship'); return done(); }
            if (/^Haste; fear$/.test(line)) { R.kw.add('haste'); R.kw.add('fear'); return done(); }
            if (/^You have hexproof\.$/.test(line)) { R.playerHexproof = true; return done(); }
            if (/^Prevent all combat damage that would be dealt to and dealt by ~\.$/.test(line)) { R.kw.add('nocombatdmg'); return done(); }
            if ((m = line.match(/^\{1\}: The next time a (black|blue|green|red|white) source of your choice would deal damage to you this turn, prevent that damage\.$/))) { const act = parseActivated('{1}: Prevent all combat damage that would be dealt to and dealt by this creature this turn.', R); R.acts.push({ ...act, effects: [{ t: 'copShield', color: { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[1]] }] }); return done(); }
            if ((m = line.match(/^~ gets \+2\/\+2 as long as you control a permanent named (.+) or a permanent named (.+)\.$/))) { (R.selfCond = R.selfCond || []).push({ cond: `you control a permanent named ${m[1]} or a permanent named ${m[2]}`, p: 2, q: 2, kw: [] }); return done(); }
            if (/^Battle cry$/.test(line)) { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [{ t: 'battleCry' }] }); return done(); }
            if (/^You may have ~ assign its combat damage as though it weren't blocked\.$/.test(line)) { R.assignUnblocked = true; return done(); }
            return false;
        }
    ]
});
