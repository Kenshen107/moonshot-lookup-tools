// Spellslinger Duels - rules pack: Starter Kits round (2026-10-06).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'starter-kits',
    triggers: [
        [/^Whenever you attack, (.+)$/, () => ({ ev: 'attacks', attackWith: 'creatures' })],
        [/^Whenever you attack a player, (.+)$/, () => ({ ev: 'attacks', attackWith: 'creatures' })],
        [/^Whenever a creature token you control deals combat damage to a player, (.+)$/, () => ({ ev: 'hitPlayer', anyMine: true, only: 'token' })],
        [/^Whenever an artifact creature you control deals combat damage to a player, (.+)$/, () => ({ ev: 'hitPlayer', anyMine: true, only: 'artifact' })],
        [/^Whenever another nontoken artifact you control enters, (.+)$/, () => ({ ev: 'enters', filt: 'nontokenArtifact', ctxTarget: true })],
        [/^Whenever you attack with two or more creatures, (.+)$/, () => ({ ev: 'attacks', attackWith: 'creatures', min: 2 })],
        [/^Whenever you attack with one or more ([A-Z][a-z]+) and\/or ([A-Z][a-z]+), (.+)$/, m => ({ ev: 'attacks', attackWith: `${m[1]}|${m[2]}` })],
        [/^Whenever one or more ([A-Z][a-z]+) you control attack(?: a player)?, (.+)$/, m => ({ ev: 'attacks', attackWith: m[1] })],
        [/^Whenever a creature you control with a \+1\/\+1 counter on it attacks, (.+)$/, () => ({ ev: 'attacks', anyMine: true, ctxTarget: true, withCounter: true })],
        [/^Whenever equipped creature attacks alone, (.+)$/, () => ({ ev: 'attacks', host: true, alone: true })],
        [/^Whenever a creature you control deals combat damage to a player, (.+)$/, () => ({ ev: 'hitPlayer', anyMine: true })],
        [/^Whenever an? ([A-Z][a-z]+) you control deals combat damage to a player, (.+)$/, m => ({ ev: 'hitPlayer', anyMine: true, type: m[1] })],
        [/^Whenever ~ deals damage to an opponent, (.+)$/, () => ({ ev: 'dealsDamage', toOpp: true })],
        [/^Whenever ~ deals damage to an? ([A-Z][a-z]+) or ([A-Z][a-z]+), (.+)$/, m => ({ ev: 'dealsDamage', toType: [m[1], m[2]], ctxTarget: true })],
        [/^Whenever one or more nontoken creatures you control deal combat damage to a player, (.+)$/, () => ({ ev: 'combatHitAny', nontoken: true })],
        [/^Whenever ~ or another (?:creature or artifact|artifact or creature) you control dies, (.+)$/, () => [{ ev: 'dies' }, { ev: 'creatureDies', mine: true }, { ev: 'artifactDies', mine: true }]],
        [/^Whenever one or more other creatures and\/or artifacts you control die, (.+)$/, () => [{ ev: 'creatureDies', another: true, mine: true, shareOnce: true }, { ev: 'artifactDies', mine: true, shareOnce: true }]],
        [/^Whenever one or more \+1\/\+1 counters are put on ~, (.+)$/, () => ({ ev: 'counters', self: true, anyone: true })],
        [/^Whenever another nontoken ([A-Z][a-z]+) you control dies, (.+)$/, m => ({ ev: 'creatureDies', another: true, mine: true, type: m[1], nontoken: true })],
        [/^Whenever one or more other creatures you control with power (\w+) or less enter, (.+)$/, m => ({ ev: 'enters', another: true, filt: `power<=${num(m[1])}` })],
        [/^Whenever ~ or another (?:nontoken )?historic permanent you control enters, (.+)$/, () => ({ ev: 'enters', historic: true })],
        [/^Whenever ~ or another creature you control with toughness greater than its power enters, (.+)$/, () => ({ ev: 'enters', filt: 'toughGtPow' })],
        [/^When a legendary creature an opponent controls dies, (.+)$/, () => ({ ev: 'creatureDies', theirs: true, legendary: true })],
        [/^Whenever you create a token, (.+)$/, () => ({ ev: 'tokenMade' })],
        [/^Whenever ~ blocks a creature with flying, (.+)$/, () => ({ ev: 'blocks', vsFlying: true })],
        [/^Whenever you cast or copy an instant or sorcery spell, (.+)$/, () => ({ ev: 'cast', filter: 'instant or sorcery' })],
    ],
    lines: [
    (ctx) => {
        // Starter kits (2026-10-06): set mechanics
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^Freerunning ((?:\{[^}]+\})+)$/))) { R.freerun = parseCost(m[1]); { ctx.li = li; return true; } }
        if ((m = line.match(/^Backup (\d+)$/))) { R.backup = +m[1]; R.etb.push({ t: 'counters', n: +m[1], target: 'creature', good: true, backup: true }); R._kwBefore = new Set(R.kw); { ctx.li = li; return true; } }
        if ((m = line.match(/^Offspring ((?:\{[^}]+\})+)$/))) { R.kicker = parseCost(m[1]); R.offspring = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Unearth ((?:\{[^}]+\})+)$/))) { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(m[1]), tap: false }, effects: [{ t: 'unearth' }], text: `Unearth ${m[1]}`, sorcery: true, gy: true }); { ctx.li = li; return true; } }
        if ((m = line.match(/^~ can't attack or block unless (.+)\.$/)) && parseCond(m[1])) { R.blockCond = m[1]; R.attackCond = m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ enters(?: the battlefield)? with an? \+1\/\+1 counter on it if (.+)\.$/)) && parseCond(m[1])) { R.etbCountersIf = { n: 1, cond: m[1] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^If ~ was kicked, it enters with (\w+) \+1\/\+1 counters on it\.$/))) { R.kickCounters = num(m[1]); { ctx.li = li; return true; } }
        if ((m = line.match(/^~ enters with (\w+) \+1\/\+1 counters on it for each creature that convoked it\.$/))) { R.convokeCounters = num(m[1]); { ctx.li = li; return true; } }
        if (/^During your turn, prevent all damage that would be dealt to ~\.$/.test(line)) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn', p: 0, q: 0, kw: ['preventdmg'] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Creature tokens you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { R.statics.push({ type: null, match: 'token', p: 0, q: 0, kw: splitKw(m[1]) }); { ctx.li = li; return true; } }
        if (/^When ~ enters and when you sacrifice it, (.+)$/.test(line)) { const fx = parseEffects(line.replace(/^When ~ enters and when you sacrifice it, /, '')); if (fx) { R.etb.push(...fx); R.trig.push({ ev: 'sacrificed', effects: fx }); { ctx.li = li; return true; } } }
        // Kenrith's Transformation, Darksteel Mutation: base P/T and no abilities (the new creature type and color aren't modeled)
        if ((m = line.match(/^Enchanted creature loses all abilities and is an? (?:[a-z]+ )?[A-Z][a-z]+ creature with base power and toughness (\d+)\/(\d+)\.$/))) { R.buff = { p: 0, q: 0, kw: [] }; R.buffBase = { p: +m[1], q: +m[2] }; R.buffLose = true; R.buffBad = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Enchanted creature is an? [A-Z][a-z]+ artifact creature with base power and toughness (\d+)\/(\d+) and has ([a-z]+), and it loses all other abilities, card types, and creature types\.$/)) && allKnown([m[3]])) { R.buff = { p: 0, q: 0, kw: [m[3]] }; R.buffBase = { p: +m[1], q: +m[2] }; R.buffLose = true; R.buffBad = true; { ctx.li = li; return true; } }
        if (/^Enchanted creature has base power and toughness (\d+)\/(\d+), has defender, and loses all other abilities\.$/.test(line)) { const bm = line.match(/(\d+)\/(\d+)/); R.buff = { p: 0, q: 0, kw: ['defender'] }; R.buffBase = { p: +bm[1], q: +bm[2] }; R.buffLose = true; R.buffBad = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^If an? ([A-Z][a-z]+) source you control would deal damage to a permanent or player, it deals double that damage to that permanent or player instead\.$/))) { R.doubleType = m[1]; { ctx.li = li; return true; } }
        if (/^If a creature would deal combat damage to ~, prevent that damage and put a \+1\/\+1 counter on ~\.$/.test(line)) { R.combatShield = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^If one or more \+1\/\+1 counters would be put on an? ((?:[A-Z][a-z]+, )*[A-Z][a-z]+,? or [A-Z][a-z]+) you control, that many plus one \+1\/\+1 counters are put on it instead\.$/))) { R.counterBonus = m[1].split(/,? or |, /); { ctx.li = li; return true; } }
        if (/^If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead\.$/.test(line)) { R.extraFood = true; { ctx.li = li; return true; } }
        if (/^If you would draw a card, exile the top card of your library face down instead\.$/.test(line)) { R.drawExile = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^You may cast ~ from your graveyard by paying (\d+) life and discarding a card in addition to paying its other costs\.$/))) { R.gyCast = { life: +m[1], discard: 1 }; { ctx.li = li; return true; } }
        // Clones (707.2): Clone, Phyrexian Metamorph, Sculpting Steel, Spark Double, Vesuva
        if ((m = line.match(/^You may have ~ enter(?: the battlefield)?( tapped)? as a copy of (?:any|a) (artifact or creature|artifact|creature|land|creature or planeswalker you control|creature you control)(?: on the battlefield)?(?:, except (.+))?\.$/))) {
            const ex = m[3] || '';
            const known = !ex || /^it's an? (artifact|enchantment) in addition to its other types$/.test(ex) || /^it enters with an additional \+1\/\+1 counter on it if it's a creature, it enters with an additional loyalty counter on it if it's a planeswalker, and it isn't legendary$/.test(ex) || /^it isn't legendary$/.test(ex);
            if (known) {
                const at = ex.match(/^it's an? (artifact|enchantment) in addition/);
                R.clone = { what: m[2], tapped: !!m[1], addType: at ? at[1][0].toUpperCase() + at[1].slice(1) : null, plusOne: /additional \+1\/\+1/.test(ex), notLegendary: /isn't legendary/.test(ex) };
                { ctx.li = li; return true; }
            }
        }
        if (/^You may have ~ enter as a copy of any creature on the battlefield with mana value less than or equal to the amount of mana spent to cast ~, except it's a Bird in addition to its other types and it has flying\.$/.test(line)) { R.cloneX = true; { ctx.li = li; return true; } }
        if (/^Whenever a Dragon you control enters, you may have ~ become a copy of it until end of turn, except its name is ~ and it's legendary in addition to its other types\.$/.test(line)) { R.trig.push({ ev: 'enters', filt: 'Dragon', ctxTarget: true, effects: [{ t: 'becomeCopy' }] }); { ctx.li = li; return true; } }
        if (/^Whenever you cast a spell, if it's the first instant spell, the first sorcery spell, or the first Otter spell other than ~ you've cast this turn, you may have target opponent draw a card\. If you do, copy that spell\. You may choose new targets for the copy\.$/.test(line)) { R.trig.push({ ev: 'cast', filter: 'any', cond: 'alania', effects: [{ t: 'optOppDraw' }, { t: 'copyLastCast', ifDo: true }] }); { ctx.li = li; return true; } }
        return false;
    },
    (ctx) => {
        // Starter kits (2026-10-06): Equipment
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^Job select$/.test(line)) { R.etb.push({ t: 'token', n: 1, p: 1, q: 1, name: 'colorless hero', kw: [] }, { t: 'attachSelfToMade' }); { ctx.li = li; return true; } }
        if (/^For Mirrodin!$/.test(line)) { R.etb.push({ t: 'token', n: 1, p: 2, q: 2, name: 'red rebel', kw: [] }, { t: 'attachSelfToMade' }); { ctx.li = li; return true; } }
        if ((m = line.match(/^During your turn, equipped creature has (.+)\.$/))) { const kw = splitKw(m[1].replace(/can't be blocked/, 'unblockable')); if (allKnown(kw)) { R.buffCond = { cond: 'it is your turn', kw }; { ctx.li = li; return true; } } }
        if ((m = line.match(/^During your turn, as long as ~ is equipped, it has ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn and ~ is equipped', p: 0, q: 0, kw: splitKw(m[1]) }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Equip abilities you activate that target ~ cost \{(\d+)\} less to activate\.$/))) { R.equipLessSelf = +m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^Equip abilities you activate cost \{(\d+)\} less to activate\.$/))) { R.equipLess = +m[1]; { ctx.li = li; return true; } }
        return false;
    }
    ],
});
