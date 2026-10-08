// Spellslinger Duels - rules pack: precon round 1 (2026-10-08). The cards that keep the most precons from being Ready
// (docs/spellslinger-precon-plan.md). Registered with registerRules() (01-core.js); the engine cases are in 15b-precon-effects.js.
registerRules({
    name: 'precons1',
    effects: [
        // Discard and card selection
        [/^target opponent reveals their hand$/i, () => ({ t: 'coerce', target: 'player', oppOnly: true, good: false })],
        [/^look at target player's hand and choose a card from it$/i, () => ({ t: 'coerce', target: 'player', good: false })],
        [/^§tellingtime$/, () => ({ t: 'lookSort', n: 3, hand: 1, top: 1 })],
        [/^§ancmem$/, () => ({ t: 'lookSort', n: 7, hand: 2, gy: true })],
        [/^you choose a card from it$/i, () => ({ t: 'noop' })],
        [/^that player discards that card$/i, () => ({ t: 'noop' })],
        [/^§lookhand (\d+)$/, m => ({ t: 'lookSort', n: +m[1], hand: 1 })],
        // Removal with a rider
        [/^a creature dealt damage this way can't be regenerated this turn$/i, () => ({ t: 'noop' })],
        [/^its owner gains (\w+) life$/i, m => ({ t: 'lastCtrlGain', n: num(m[1]) })],
        [/^you gain life equal to its power$/i, () => ({ t: 'gainLastPower' })],
        [/^put target attacking creature on the bottom of its owner's library$/i, () => ({ t: 'bottomdeck', target: 'perm', filter: 'attacking creature' })],
        [/^its controller gains life equal to its toughness$/i, () => ({ t: 'gainLastTou' })],
        [/^put target attacking or blocking creature on top of its owner's library$/i, () => ({ t: 'topdeck', target: 'perm', filter: 'attacking or blocking creature' })],
        [/^~ deals (\w+) damage to each of two target creatures$/i, m => ({ t: 'dmg', n: num(m[1]), target: 'creature', multi: 2 })],
        [/^~ deals (\w+) damage divided as you choose among any number of target attacking or blocking creatures$/i, m => ({ t: 'dmg', n: num(m[1]), target: 'creature', only: 'attacking or blocking creature', div: 99 })],
        [/^~ deals (\w+) damage to target player or planeswalker and (\w+) damage to each creature that player or that planeswalker's controller controls$/i, m => ({ t: 'dmgPlayerCreatures', n: num(m[1]), m: num(m[2]), target: 'player', oppOnly: true })],
        [/^target player gains (\w+) life and draws (\w+) cards$/i, m => ({ t: 'gainDrawTarget', n: num(m[1]), d: num(m[2]), target: 'player' })],
        [/^you gain (\w+) life for each creature attacking you$/i, m => ({ t: 'gain', n: 0, nFrom: 'attackers', per: num(m[1]) })],
        // Batch D: spells with their own twist
        [/^~ deals damage to any target equal to the number of Swamps you control$/i, () => [{ t: 'dmg', n: 0, nCount: 'the number of Swamps you control', target: 'any' }, { t: 'gain', n: 0, nCount: 'the number of Swamps you control' }]],
        [/^you gain life equal to the damage dealt this way$/i, () => ({ t: 'noop' })],
        [/^each opponent sacrifices a creature with the greatest power among creatures that player controls$/i, () => ({ t: 'edictGreatest' })],
        [/^each player sacrifices four lands$/i, () => ({ t: 'sacLandsEach', n: 4 })],
        [/^~ deals 4 damage to each creature$/i, () => ({ t: 'dmgSweep', n: 4, filt: 'all' })],
        [/^target creature an opponent controls blocks this turn if able$/i, () => ({ t: 'markForDeath', target: 'creature', theirs: true, good: false })],
        [/^untap that creature$/i, () => ({ t: 'untapLast' })],
        [/^other creatures that player controls can't block this turn$/i, () => ({ t: 'noop' })],
        [/^choose target creature you control$/i, () => ({ t: 'hunterInsight', target: 'creature', mine: true, good: true })],
        [/^whenever that creature deals combat damage to a player or planeswalker this turn, draw that many cards$/i, () => ({ t: 'noop' })],
        [/^white creatures you control also gain first strike until end of turn$/i, () => ({ t: 'teamKwColor', color: 'W', kw: ['first strike'] })],
        [/^counter target spell\. search its controller's graveyard, hand, and library for all cards with the same name as that spell and exile them$/i, () => [{ t: 'counter', target: 'spell', filter: 'any' }, { t: 'counterbore' }]],
        [/^search its controller's graveyard, hand, and library for all cards with the same name as that spell and exile them$/i, () => ({ t: 'counterbore' })],
        [/^that player shuffles$/i, () => ({ t: 'noop' })],
        // Batch C: creature triggers and abilities
        [/^have (?:it|~) deal (\w+) damage to any target$/i, m => ({ t: 'dmg', n: num(m[1]), target: 'any' })],
        [/^defending player may draw a card$/i, () => ({ t: 'oppDraws', n: 1 })],
        [/^sacrifice (?:it|~) unless you discard a creature card$/i, () => ({ t: 'sacUnlessDiscardCreature' })],
        [/^return each other creature you control to its owner's hand$/i, () => ({ t: 'bounceOthers' })],
        [/^return a green creature you control to its owner's hand$/i, () => ({ t: 'returnGreenUpkeep' })],
        [/^return (?:it|~) to the battlefield tapped under its owner's control at the beginning of their next upkeep$/i, () => ({ t: 'returnNextUpkeep' })],
        [/^shuffle (?:it|~) into its owner's library$/i, () => ({ t: 'shuffleSelfIn' })],
        [/^exile another target nonland permanent$/i, () => ({ t: 'exileUntilLeaves', target: 'perm', filter: 'nonland permanent', notSelf: true, good: false })],
        [/^that creature's controller loses (\w+) life$/i, m => ({ t: 'bloodReckoning', n: num(m[1]) })],
        [/^~ deals (\d+) damage to you$/i, m => ({ t: 'dmgYou', n: +m[1] })],
        [/^you gain that much life$/i, () => ({ t: 'gain', n: 0, nFrom: 'ctxCount' })],
        [/^it deals (\d+) damage to each opponent$/i, m => ({ t: 'dmgOpp', n: +m[1] })],
        [/^that player draws an additional card$/i, () => ({ t: 'drawHostCtl' })],
        // Batch B: sentence effects
        [/^tap all creatures without flying$/i, () => ({ t: 'tapNoFly' })],
        [/^draw a card for each tapped creature target opponent controls$/i, () => ({ t: 'drawTappedOpp', target: 'player', oppOnly: true })],
        [/^each player returns a creature they control to its owner's hand$/i, () => ({ t: 'curfew' })],
        [/^target player sacrifices an attacking creature$/i, () => ({ t: 'sacAttacking', target: 'player', n: 1, good: false })],
        [/^that player sacrifices two attacking creatures(?: of their choice)?(?: instead)?$/i, () => ({ t: 'sacAttacking', target: 'last', n: 1, good: false })], // with metalcraft: the first effect's one plus this one,
        [/^§eyespy$/, () => ({ t: 'eyeSpy', target: 'player' })],
        [/^§grisly$/, () => ({ t: 'digTake', n: 5, kinds: ['creature', 'land'], rest: 'gy' })],
        [/^§digcolor (\d+) (white|blue|black|red|green)$/i, m => ({ t: 'digTake', n: +m[1], color: m[2].toLowerCase(), rest: 'bottom' })],
        [/^target player skips all combat phases of their next turn$/i, () => ({ t: 'skipNext', what: 'combat', target: 'player', good: false })],
        [/^target player skips their next draw step$/i, () => ({ t: 'skipNext', what: 'draw', target: 'player', good: false })],
        [/^§relentless$/, () => ({ t: 'relentless' })],
        [/^if 97 is 5 or more, ~ can't be countered and the damage can't be prevented$/i, () => ({ t: 'noop' })],
        [/^~ can't be countered and the damage can't be prevented$/i, () => ({ t: 'noop' })],
    ],
    triggers: [
        [/^Whenever enchanted creature deals damage, (.+)$/, () => ({ ev: 'dealsDamage', host: true })],
        [/^Whenever you tap ~ for mana, (.+)$/, () => ({ ev: 'tapped', fn: 'selfManaTap' })],
        [/^At the beginning of the draw step of enchanted creature's controller, (.+)$/, () => ({ ev: 'upkeep', who: 'host' })],
        [/^When ~ is put into a graveyard from anywhere, (.+)$/, () => ({ ev: 'toGy', fn: 'selfToGy' })],
        [/^Whenever ~ deals damage to a player, (.+)$/, () => ({ ev: 'dealsDamage', toOpp: true })],
        [/^Whenever another creature you control with power (\w+) or greater enters, (.+)$/, m => ({ ev: 'enters', fn: 'anotherPow', minPow: num(m[1]) })],
        [/^Whenever a creature attacks you or a planeswalker you control, (.+)$/, () => ({ ev: 'attacks', fn: 'oppAttacks', anyOpp: true })],
        [/^Whenever you cast a red spell or a Mountain you control enters, (.+)$/, () => [{ ev: 'cast', fn: 'castRed', filter: 'any' }, { ev: 'landfall', fn: 'mountainEnters' }]],
        [/^At the beginning of your end step, if ~ didn't attack this turn, (.+) unless it came under your control this turn\.?$/, () => ({ ev: 'end', fn: 'ergRaiders' })],
    ],
    lines: [
        (ctx) => {
            // Precon round 1 (2026-10-08): statics and one-off lines
            const { R } = ctx; const line = ctx.line; let m;
            const done = () => { ctx.li = ctx.li; return true; };
            if (/^Other black creatures get \+1\/\+1\.$/.test(line)) { R.statics.push({ global: true, other: true, fn: 'black', p: 1, q: 1, kw: [] }); return done(); }
            if (/^Nonblack creatures get -1\/-1\.$/.test(line)) { R.statics.push({ global: true, fn: 'nonblack', p: -1, q: -1, kw: [] }); return done(); }
            if (/^~ can't be blocked except by Walls and\/or creatures with flying\.$/.test(line)) { (R.blockFns = R.blockFns || []).push('wallOrFlying'); return done(); }
            if (/^~ can't be blocked by Walls\.$/.test(line)) { (R.blockFns = R.blockFns || []).push('notWall'); return done(); }
            if (/^Prevent all damage that would be dealt to ~\.$/.test(line)) { R.preventSelf = true; return done(); }
            if (/^Prevent all combat damage that would be dealt to ~ by creatures blocking it\.$/.test(line)) { R.blockersHarmless = true; return done(); }
            if (/^If a source would deal damage to you, prevent 1 of that damage\.$/.test(line)) { R.urzaArmor = true; return done(); }
            if (/^If a source would deal damage to a permanent or player, it deals double that damage to that permanent or player instead\.$/.test(line)) { R.furnace = true; return done(); }
            if (/^All damage that would be dealt to you is dealt to enchanted creature instead\.$/.test(line)) { R.pariah = true; R.aura = true; return done(); }
            if (/^Prevent all combat damage that would be dealt to and dealt by enchanted creature\.$/.test(line)) { R.ghostly = true; return done(); }
            if (/^If damage would be dealt to another creature you control, prevent that damage\. Put a \+1\/\+1 counter on that creature for each 1 damage prevented this way\.$/.test(line)) { R.vigor = true; return done(); }
            if ((m = line.match(/^As long as ~ is enchanted, it gets \+2\/\+2 and has flying, first strike, and trample\.$/))) { (R.selfCond = R.selfCond || []).push({ cond: '~ is enchanted', p: 2, q: 2, kw: ['flying', 'first strike', 'trample'] }); return done(); }
            if (/^You control enchanted permanent\.$/.test(line)) { R.auraSteal = true; R.buffBad = true; return done(); }
            if (/^Whenever enchanted land is tapped for mana, its controller adds an additional one mana of any color\.$/.test(line)) { R.extraMana = { host: true, color: 'any' }; return done(); }
            if (/^Enchanted creature gets \+1\/\+1 for each card in its controller's hand\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: [] }; R.buffPer = { p: 1, q: 1, what: 'the number of cards in your hand', host: true }; return done(); }
            return false;
        }
    ]
});
