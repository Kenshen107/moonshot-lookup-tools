// =====================================================================
// Rules round 2 (2026-10-05): triggered abilities, activated abilities
// (including Crew, Cycling and planeswalker loyalty), lords and anthems,
// modal spells, X spells, more evasion keywords, infect and wither. Like
// Forge's card scripts and Arena's per-card rules, every ability is built
// from a few shared pieces: a trigger or cost, plus effects from EFFECTS.
// =====================================================================

// ---- Reading ----
const PLURAL_TYPES = { Elves: 'Elf', Dwarves: 'Dwarf', Wolves: 'Wolf', Merfolk: 'Merfolk', Sphinxes: 'Sphinx', Faeries: 'Faerie', Mice: 'Mouse', Werewolves: 'Werewolf', Thieves: 'Thief', Halflings: 'Halfling' };
// "creatures" -> null (all), "Elf creatures" / "Elves" -> 'Elf', anything else -> undefined (not read)
function lordType(subject) {
    if (/^creatures$/i.test(subject)) return null;
    let m = subject.match(/^([A-Z][a-z]+) creatures$/);
    if (m) return m[1];
    m = subject.match(/^([A-Z][a-z]+)$/);
    if (m) return PLURAL_TYPES[m[1]] || (m[1].endsWith('s') ? m[1].slice(0, -1) : undefined);
    return undefined;
}
const TRIGGERS = [
    ...rulePackEntries('triggers'), // newest rules first (spellslinger/rules/*.js), then the general ones below
    // ---- Welcome decks (2026-10-06) ----
    [/^Whenever you draw your second card each turn, (.+)$/, () => ({ ev: 'draw', nth: 2 })],
    [/^Whenever ~ attacks while ([^,]+), (.+)$/, m => ({ ev: 'attacks', cond: m[1] })],
    [/^Whenever ~ attacks alone, (.+)$/, () => ({ ev: 'attacks', alone: true })],
    [/^Whenever a creature you control attacks alone, (.+)$/, () => ({ ev: 'attacks', anyMine: true, alone: true, ctxTarget: true })],
    [/^Whenever you attack with one or more ([A-Z][a-z]+|legendary creatures), (.+)$/, m => ({ ev: 'attacks', attackWith: m[1] })],
    [/^Whenever two or more creatures you control attack(?: a player)?, (.+)$/, () => ({ ev: 'attacks', attackWith: 'creatures', min: 2 })],
    [/^Whenever ~ and at least two other creatures attack, (.+)$/, () => ({ ev: 'attacks', min: 3 })],
    [/^Whenever an? (white|blue|black|red|green) creature you control attacks, (.+)$/, m => ({ ev: 'attacks', anyMine: true, color: COLOR_WORDS[m[1]], ctxTarget: true })],
    [/^Whenever (another|a) (white|blue|black|red|green|[A-Z][a-z]+|creature you control with power \w+ or less|creature with power \w+ or less)(?: creature)? you control enters, (.+)$/, m => ({ ev: 'enters', another: m[1] === 'another', filt: m[2], ctxTarget: true })],
    [/^Whenever another creature you control with power (\w+) or less enters, (.+)$/, m => ({ ev: 'enters', another: true, filt: `power<=${num(m[1])}`, ctxTarget: true })],
    [/^Whenever another creature you control enters, (.+)$/, () => ({ ev: 'enters', another: true, ctxTarget: true })],
    [/^Whenever (?:(~) or )?(another|a) ([A-Z][a-z]+) you control dies, (.+)$/, m => [{ ev: 'creatureDies', another: m[2] === 'another', mine: true, type: m[3] }, ...(m[1] ? [{ ev: 'dies' }] : [])]],
    [/^Whenever a creature an opponent controls dies, (.+)$/, () => ({ ev: 'creatureDies', theirs: true })],
    [/^When ~ enters or dies, (.+)$/, () => [{ ev: 'selfEnters' }, { ev: 'dies' }]],
    [/^Whenever you cast a spell with mana value (\w+) or greater, (.+)$/, m => ({ ev: 'cast', filter: `mv${num(m[1])}` })],
    [/^Whenever you cast a spell of the chosen color, (.+)$/, () => ({ ev: 'cast', filter: 'chosenColor' })],
    [/^Whenever you cast a noncreature or ([A-Z][a-z]+) spell, (.+)$/, m => ({ ev: 'cast', filter: `noncreature|${m[1]}` })],
    [/^Whenever you cast a spell, (.+)$/, () => ({ ev: 'cast', filter: 'any' })],
    [/^Whenever one or more creatures you control deal combat damage to a player, (.+)$/, () => ({ ev: 'combatHitAny' })],
    [/^Whenever ~ becomes tapped, (.+)$/, () => ({ ev: 'tapped' })],
    [/^Whenever a creature dealt damage by ~ this turn dies, (.+)$/, () => ({ ev: 'creatureDies', damagedBy: true })],
    [/^Whenever ~ is dealt damage, (.+)$/, () => ({ ev: 'dealtDamage' })],
    [/^Whenever ~ becomes blocked, (.+)$/, () => ({ ev: 'blocked' })],
    [/^At the beginning of the upkeep of enchanted creature's controller, (.+)$/, () => ({ ev: 'upkeep', who: 'host' })],
    [/^At the beginning of each combat, (.+)$/, () => ({ ev: 'combat', each: true })],
    [/^Whenever you scry, (.+)$/, () => ({ ev: 'scry' })],
    [/^Whenever you put one or more \+1\/\+1 counters on ~, (.+)$/, () => ({ ev: 'counters', self: true })],
    [/^Whenever you put a \+1\/\+1 counter on another creature, (.+)$/, () => ({ ev: 'counters', other: true })],
    [/^When ~ leaves the battlefield, (.+)$/, () => ({ ev: 'leaves' })],
    [/^At the beginning of (your|each) upkeep, (.+)$/, m => ({ ev: 'upkeep', who: m[1] })],
    [/^At the beginning of (your|each) end step, (.+)$/, m => ({ ev: 'end', who: m[1] })],
    [/^At the beginning of each player's (upkeep|end step), (.+)$/, m => ({ ev: m[1] === 'upkeep' ? 'upkeep' : 'end', who: 'each' })],
    [/^At the beginning of combat on your turn, (.+)$/, () => ({ ev: 'combat' })],
    [/^Whenever ~ attacks or blocks, (.+)$/, () => [{ ev: 'attacks' }, { ev: 'blocks' }]],
    [/^Whenever ~ attacks, (.+)$/, () => ({ ev: 'attacks' })],
    [/^Whenever a creature you control attacks, (.+)$/, () => ({ ev: 'attacks', anyMine: true })],
    [/^Whenever ~ blocks, (.+)$/, () => ({ ev: 'blocks' })],
    [/^When(?:ever)? ~ dies, (.+)$/, () => ({ ev: 'dies' })],
    [/^Whenever ~ deals combat damage to a player, (.+)$/, () => ({ ev: 'hitPlayer' })],
    [/^Whenever you cast (?:a|an) (noncreature|instant or sorcery|creature|artifact|enchantment|multicolored|historic|white|blue|black|red|green)? ?spell, (.+)$/, m => ({ ev: 'cast', filter: m[1] || 'any' })],
    [/^Whenever (an opponent|a player) casts (?:a|an) (noncreature|instant or sorcery|creature|artifact|enchantment|multicolored|historic|white|blue|black|red|green)? ?spell, (.+)$/, m => ({ ev: 'cast', filter: m[2] || 'any', who: m[1] === 'a player' ? 'any' : 'opp' })],
    [/^Whenever ~ or another land you control enters, (.+)$/, () => ({ ev: 'landfall' })],
    [/^(?:Landfall — )?Whenever a land (?:you control enters|enters(?: the battlefield)? under your control), (.+)$/, () => ({ ev: 'landfall' })],
    [/^Whenever (another|a) (nontoken )?creature (?:you control enters|enters(?: the battlefield)? under your control), (.+)$/, m => ({ ev: 'enters', another: m[1] === 'another', nontoken: !!m[2] })],
    [/^Whenever (another|a) (nontoken )?creature enters(?: the battlefield)?, (.+)$/, m => ({ ev: 'enters', another: m[1] === 'another', nontoken: !!m[2], anyone: true })],
    [/^Whenever you gain life, (.+)$/, () => ({ ev: 'gainLife' })],
    [/^Whenever (another|a) (nontoken )?creature you control dies, (.+)$/, m => ({ ev: 'creatureDies', another: m[1] === 'another', mine: true, nontoken: !!m[2] })],
    [/^Whenever (another|a) creature dies, (.+)$/, m => ({ ev: 'creatureDies', another: m[1] === 'another' })],
    [/^Whenever one or more other creatures (you control )?die, (.+)$/, m => ({ ev: 'creatureDies', another: true, mine: !!m[1], once: true })],
    [/^Whenever an opponent casts their first (noncreature|instant or sorcery|creature)? ?spell each turn, (.+)$/, m => ({ ev: 'cast', filter: m[1] || 'any', who: 'opp', once: true })],
    [/^Whenever ~ or another (nontoken )?creature (you control )?dies, (.+)$/, m => [{ ev: 'dies' }, { ev: 'creatureDies', mine: !!m[2], nontoken: !!m[1] }]],
    [/^Whenever ~ or another (nontoken )?creature (?:you control )?enters(?: the battlefield)?(?: under your control)?, (.+)$/, m => ({ ev: 'enters', nontoken: !!m[1] })],
    [/^Whenever you draw a card, (.+)$/, () => ({ ev: 'draw' })],
    [/^Whenever (?:equipped|enchanted) creature deals combat damage to a player, (.+)$/, () => ({ ev: 'hitPlayer', host: true })],
    [/^Whenever (?:equipped|enchanted) creature deals damage to an opponent, (.+)$/, () => ({ ev: 'dealsDamage', host: true, toOpp: true })],
    [/^Whenever (?:equipped|enchanted) creature attacks, (.+)$/, () => ({ ev: 'attacks', host: true })],
    [/^When(?:ever)? (?:equipped|enchanted) creature dies, (.+)$/, () => ({ ev: 'dies', host: true })],
    [/^When ~ is put into (?:a|your) graveyard from the battlefield, (.+)$/, () => ({ ev: 'toGy' })]
];
function parseTrigger(line) {
    const once = /This ability triggers only once each turn\.$/.test(line);
    line = line.replace(/\s*This ability triggers only once each turn\.$/, '');
    for (const [re, make] of TRIGGERS) {
        const m = line.match(re);
        if (!m) continue;
        let body = m[m.length - 1], cond = null;
        const ci = body.match(/^if ([^,]+), (.+)$/);
        if (ci && parseCond(ci[1])) { cond = ci[1]; body = ci[2]; }
        const made = [].concat(make(m));
        // "Whenever an opponent draws a card, they lose 2 life" / "that player may pay {2}. If the player doesn't, ..."
        if (made[0].who === 'opp' && made[0].ev === 'draw') body = body.replace(/^(?:they|that player) loses? (\w+) life/i, 'each opponent loses $1 life').replace(/^~ deals (\w+) damage to (?:them|that player)/i, '~ deals $1 damage to each opponent').replace(/^that player may pay \{(\d+)\}\. If the player doesn't, (?:you )?(.+?)\.?$/i, '$2 unless that player pays {$1}');
        // "put a +1/+1 counter on it" / "it gains indestructible": the creature the event is about
        if (made.some(t => t.ctxTarget)) body = body.replace(/\b(?:it|that creature|they)\b(?= (?:gets|gains)\b)/g, 'target creature').replace(/ on (?:it|that creature)\b/g, ' on target creature');
        const fx = parseEffects(body);
        if (!fx) return null;
        const eff = made.some(t => t.ctxTarget) ? fx.map(e => (needsTarget(e) && (e.target === 'creature' || e.target === 'last') ? { ...e, target: 'creature', ctx: true } : e)) : fx;
        return made.map((t, i) => ({ ...t, effects: eff, once: once || t.once ? (t.shareOnce ? line : `${line}#${i}`) : null, cond: t.cond || cond }));
    }
    return null;
}
// "{2}, {T}, Sacrifice ~: Draw a card." -> { cost, effects }
function parseActivated(line, R) {
    const m = line.match(/^([^:"]+?): (.+)$/);
    if (!m) return null;
    let body = m[2];
    const sorcery = /Activate only as a sorcery\.?/.test(body);
    const once = /Activate only (?:during your turn and only )?once each turn\.?/.test(body);
    const yourTurn = /Activate only during your turn/.test(body);
    const onceEver = /Activate only (?:as a sorcery and only )?once\.$/.test(body);
    const upkeepOnly = /Activate only during your upkeep\.?/.test(body); // Mirrodin: Grim Reminder, Nim Devourer
    body = body.replace(/\s*Activate only during your upkeep\.?/, '');
    const sorceryOnceTurn = /Activate only as a sorcery and only once each turn\.?/.test(body); // Gaea's Touch
    body = body.replace(/\s*Activate only as a sorcery and only once each turn\.?/, ' Activate only as a sorcery.');
    body = body.replace(/\s*Activate only as a sorcery and only once\.?/, ' Activate only as a sorcery.');
    body = body.replace(/\s*Activate only as an instant\.?$/, ''); // abilities can be activated any time you have priority (602.2)
    let onlyIf = null, lessIf = null, whelp = 0;
    let mm;
    if ((mm = body.match(/\s*Activate only if ([^.]+)\.?/)) && parseCond(mm[1])) { onlyIf = mm[1]; body = body.replace(mm[0], ''); }
    if ((mm = body.match(/\s*This ability costs \{(\d+)\} less to activate if ([^.]+)\.?/))) { lessIf = { n: +mm[1], cond: mm[2] }; body = body.replace(mm[0], ''); }
    // Channel lands: "This ability costs {1} less to activate for each legendary creature you control"
    let lessPer = null;
    if ((mm = body.match(/\s*This ability costs \{(\d+)\} less to activate for each (.+?)\.$/)) && countFn(`the number of ${mm[2]}`)) { lessPer = { n: +mm[1], what: `the number of ${mm[2]}` }; body = body.replace(mm[0], ''); }
    if ((mm = body.match(/\s*If this ability has been activated (\w+) or more times this turn, sacrifice ~ at the beginning of the next end step\.?/))) { whelp = num(mm[1]); body = body.replace(mm[0], ''); }
    body = body.replace(/\s*Activate only (?:as a sorcery|during your turn and only once each turn|once each turn|during your turn|once)\.?/g, '').replace(/\s*It's still a land\.?/, '').trim();
    // Mana abilities with other costs ("{1}, {T}: Add {R}{G}", "Sacrifice a creature: Add {C}{C}") add to the mana pool right away
    const cost = { mana: parseCost(''), tap: false, sacSelf: false, life: 0, discard: 0 };
    let sm0;
    for (const part of m[1].split(/,\s*/)) {
        if (/^(\{[^}]+\})+$/.test(part)) {
            const syms = part.match(/\{[^}]+\}/g);
            if (syms.includes('{T}')) cost.tap = true;
            const c = parseCost(syms.filter(x => x !== '{T}').join(''));
            if (c.odd) return null;
            if (c.x) { cost.mana.x = true; cost.mana.xn = c.xn; }
            Object.keys(c).forEach(k => { if (typeof c[k] === 'number' && k !== 'xn') cost.mana[k] += c[k]; });
        } else if (part === 'Sacrifice ~') cost.sacSelf = true;
        else if (part === 'Exile ~') cost.exileSelf = true;
        else if (part === 'Discard ~') cost.discardSelf = true;
        else if (part === 'Discard your hand') cost.discardHand = true;
        else if (part === 'Exile ~ from your graveyard') cost.exileSelfGy = true;
        else if (part === 'Exile ~ from your hand') cost.exileSelfHand = true;
        else if (part === 'Remove a +1/+1 counter from ~') cost.removeCounter = 1;
        else if (/^Pay (\w+) \{E\}$/.test(part)) cost.energy = num(part.match(/^Pay (\w+)/)[1]);
        else if (/^Sacrifice (?:an? )?(?:another )?(?:artifact or creature|creature or artifact)$/.test(part)) cost.sacPerm = 'artifact or creature';
        else if (/^Pay (\d+) life$/.test(part)) cost.life = Number(part.match(/\d+/)[0]);
        else if (/^Discard a card$/.test(part)) cost.discard = 1;
        else if (/^Sacrifice (?:a|another) creature$/.test(part)) cost.sacCreature = true;
        else if (/^Tap an untapped (?:legendary creature|creature|artifact) you control$/.test(part)) cost.tapOther = part.match(/untapped (legendary creature|creature|artifact)/)[1];
        else if (/^Sacrifice (?:a|an) (artifact|land|Treasure|Food|Clue)$/.test(part)) cost.sacPerm = part.match(/(artifact|land|Treasure|Food|Clue)$/)[1];
        else if ((sm0 = part.match(/^Sacrifice (?:a|an) ([A-Z][a-z]+)$/))) cost.sacPerm = sm0[1]; // "Sacrifice a Desert"
        else if ((sm0 = part.match(/^Return (two|three) lands you control to their owner's hand$/))) cost.returnLands = num(sm0[1]); // Multani
        else if (part === "Return an artifact you control to its owner's hand") cost.returnArt = true; // Master Transmuter
        else if (/^Sacrifice (two|three|four) ([A-Z][a-z]+)s$/.test(part)) { const sm = part.match(/^Sacrifice (\w+) ([A-Z][a-z]+)s$/); cost.sacN = { n: num(sm[1]), kind: sm[2] }; }
        // Top-1000 round 2 (2026-10-07)
        else if (/^Sacrifice (two|three) (artifacts|creatures)$/.test(part)) { const sm = part.match(/^Sacrifice (\w+) (\w+)s$/); cost.sacN = { n: num(sm[1]), kind: sm[2][0].toUpperCase() + sm[2].slice(1) }; }
        else if (part === 'Sacrifice a token') cost.sacPerm = 'token';
        else if ((sm0 = part.match(/^Sacrifice another (white|blue|black|red|green) creature$/))) cost.sacPerm = `creature:${COLOR_WORDS[sm0[1]]}`;
        else if ((sm0 = part.match(/^Exile (two|three|four) cards from your graveyard$/))) cost.exileGy = num(sm0[1]);
        else if (part === 'Put a -1/-1 counter on ~') cost.minusSelf = 1;
        // Mirrodin (2026-10-08)
        else if ((sm0 = part.match(/^Exile the top (\w+) cards of your library$/))) cost.exileTop = num(sm0[1]);
        else if ((sm0 = part.match(/^Remove a (charge|wish|\+1\/\+1) counter from ~$/))) { if (sm0[1] !== '+1/+1') cost.removeNamed = sm0[1]; else cost.removeCounter = 1; }
        else if (part === 'Remove a counter from a permanent you control') cost.removeAny = true;
        else return null;
    }
    const gyEffect = /^Return ~ from your graveyard to (?:your hand|the battlefield tapped|the battlefield)\.?$/.test(body);
    const gyNim = /^Return ~ from your graveyard to the battlefield, then sacrifice a creature\.?$/.test(body);
    const gyAlso = /^Return ~ and target land card from your graveyard to the battlefield tapped\.?$/.test(body); // Sandman
    // {X} in the cost: X in the text is read the same way as X spells (xSub), and filled in when it's activated
    let effects = gyEffect ? [{ t: 'returnSelfGy', bf: /battlefield/.test(body), tapped: /tapped/.test(body) }] : parseEffects(cost.mana.x ? xSub(body) : body);
    if (!effects) return null;
    if (cost.mana.x) { effects = xMarkDeep(effects); if (!hasXMark(effects)) return null; }
    return { cost, effects, text: line, sorcery, once: once || sorceryOnceTurn, yourTurn, onceEver, onlyIf, lessIf, lessPer, whelp, upkeepOnly, hand: !!cost.discardSelf || !!cost.exileSelfHand, gy: !!cost.exileSelfGy || gyEffect || gyAlso || gyNim };
}

