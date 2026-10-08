// =====================================================================
// Reading card text. Each card's Oracle text is matched against patterns
// the engine knows; the result says how much of the card the game can
// run: 'full' (everything), 'partial' (castable, some text does nothing)
// or 'none' (can't be cast yet: planeswalkers, X costs, counterspells...).
// =====================================================================
const KEYWORDS = ['flying', 'reach', 'trample', 'first strike', 'double strike', 'deathtouch', 'lifelink', 'vigilance', 'haste', 'defender', 'menace', 'indestructible', 'hexproof', 'shroud', 'flash',
    // added 2026-10-05 (rules round 2): evasion, combat and "no effect here" keywords
    'prowess', 'riot', 'infect', 'wither', 'exalted', 'persist', 'undying', 'convoke', 'storm', 'cascade', 'delve', 'shadow', 'horsemanship', 'fear', 'intimidate', 'skulk', 'changeling', 'devoid', 'partner',
    'swampwalk', 'islandwalk', 'nonbasic landwalk', 'myriad', 'forestwalk', 'mountainwalk', 'plainswalk',
    // pseudo-keywords the parser gives for "can't block", "can't be blocked", "can't attack", "doesn't untap"
    'cantblock', 'unblockable', 'cantattack', 'nountap',
    // added 2026-10-06 (welcome decks): blocking rules and markers
    'preventdmg', 'nocombatdmg', 'nononcombat', 'blockany', '-indestructible', 'returnondeath', 'maxoneblock', 'notalone', 'lure', 'extrablock', 'blockflyonly', 'blockflyreach', 'minblock3', 'unleash', 'evolve', 'extort', 'mayhem', 'cipher',
    'pro:W', 'pro:U', 'pro:B', 'pro:R', 'pro:G', 'pro:creatures', 'pro:artifacts', 'pro:everything',
    // added 2026-10-06 (starter kits)
    'mustbeblocked', 'split second', '-flying', 'improvise'];
const allKnown = kws => kws.every(k => KEYWORDS.includes(k) || /^(?:blockonly|blockpowgt|ward):/.test(k));
const NUMWORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fifteen: 15, twenty: 20 };
const num = s => (/^\d+$/.test(s) ? Number(s) : String(s) === 'X' || String(s) === 'x' ? 'X' : NUMWORDS[String(s).toLowerCase()]);

function parseCost(str) {
    const c = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, x: false, odd: false };
    (str.match(/\{[^}]+\}/g) || []).forEach(tok => {
        const s = tok.slice(1, -1);
        if (/^\d+$/.test(s)) c.generic += Number(s);
        else if (s === 'X') { c.x = true; c.xn = (c.xn || 0) + 1; }
        else if ('WUBRGC'.includes(s) && s.length === 1) c[s]++;
        else if (/^[WUBRG]\/P$/.test(s) || /^[WUBRG]\/[WUBRG]$/.test(s)) c[s[0]]++; // hybrid / Phyrexian: pay the first color
        else if (/^2\/[WUBRG]$/.test(s)) c.generic += 2;
        else c.odd = true;
    });
    return c;
}
function costTotal(c) { return c.generic + c.W + c.U + c.B + c.R + c.G + c.C; }

const PRO_CODES = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G', creatures: 'creatures', artifacts: 'artifacts', everything: 'everything' };
// "protection from red and from blue" -> ['pro:R', 'pro:U']
function splitKw(s) {
    return s.split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim().toLowerCase()).filter(Boolean)
        .flatMap(x => (/^protection from (?:all colors|each color)$/.test(x) ? ['pro:W', 'pro:U', 'pro:B', 'pro:R', 'pro:G'] : [x]))
        .map(x => { const m = x.match(/^(?:protection )?from (white|blue|black|red|green|creatures|artifacts|everything)$/); return m ? `pro:${PRO_CODES[m[1]]}` : x; });
}

function parseManaProduce(s) {
    s = s.trim();
    if (/^one mana of any color(?: in your commander's color identity)?$/i.test(s)) return { colors: [...COLORS], n: 1 };
    // Heraldic Banner ("one mana of the chosen color"), Thriving lands ("{U} or one mana of the chosen color")
    let cm = s.match(/^(?:\{([WUBRG])\} or )?one mana of the chosen color$/i);
    if (cm) return { colors: cm[1] ? [cm[1]] : [...COLORS], n: 1, chosen: true, base: cm[1] || null };
    // Mox Amber, Plaza of Heroes: the colors among some of your permanents, worked out live (manaOf)
    let am = s.match(/^one mana of any color among (legendary creatures and planeswalkers|legendary permanents|permanents) you control$/i);
    if (am) return { colors: [...COLORS], n: 1, among: am[1] };
    // Exotic Orchard, Reflecting Pool: played as any color (approximate)
    // Exotic Orchard, Fellwar Stone (an opponent's lands), Reflecting Pool (your lands): the colors are worked out live (manaOf)
    if (/^one mana of any (?:color|type) that a land (an opponent|you) controls? could produce$/i.test(s)) return { colors: [...COLORS], n: 1, like: /opponent/.test(s) ? 'opp' : 'mine' };
    let m = s.match(/^((?:\{[WUBRGC]\})+)$/);
    if (m) { const syms = m[1].match(/[WUBRGC]/g); return { colors: [...new Set(syms)], n: syms.length, fixed: syms.length > 1 }; }
    m = s.match(/^\{([WUBRGC])\}(?:, \{([WUBRGC])\})*,? or \{([WUBRGC])\}$/);
    if (m) return { colors: [...new Set(s.match(/[WUBRGC]/g))], n: 1 };
    return null;
}

// One sentence of an effect -> an action, or null if the engine can't do it.
const EFFECTS = [
    ...rulePackEntries('effects'), // newest rules first (spellslinger/rules/*.js), then the general ones below
    // Any kind of permanent (permMatches checks the filter)
    [/^(destroy|exile) target (artifact|enchantment|artifact or enchantment|land|nonbasic land|permanent|nonland permanent|noncreature permanent|nonland permanent an opponent controls|nonland permanent you don't control|permanent an opponent controls|creature with flying|creature without flying|tapped creature|attacking creature|attacking or blocking creature|blocking creature|artifact or creature|creature or vehicle|artifact, creature, or enchantment|creature an opponent controls with power \w+ or greater|creature with power \w+ or greater|creature with mana value \w+ or less|creature with power \w+ or less)$/, m => ({ t: m[1].toLowerCase(), target: 'perm', filter: m[2] })],
    [/^return target (nonland permanent|permanent|artifact|enchantment|creature or planeswalker|nonland permanent an opponent controls|nonland permanent you don't control|attacking creature|tapped creature) to its owner's hand$/, m => ({ t: 'bounce', target: 'perm', filter: m[1] })],
    [/^untap another target (creature|permanent|land|artifact|creature you control)$/, m => ({ t: 'untap', target: 'perm', filter: m[1], notSelf: true })],
    [/^untap target (creature|permanent|land|artifact|creature you control)$/, m => ({ t: 'untap', target: 'perm', filter: m[1] })],
    // Maze of Ith
    [/^untap target attacking creature$/, () => ({ t: 'untap', target: 'creature', only: 'attacking creature' })],
    [/^prevent all combat damage that would be dealt to and dealt by (?:that creature|it) this turn$/, () => ({ t: 'pump', p: 0, q: 0, kw: ['nocombatdmg'], target: 'last', good: false })],
    [/^(destroy|exile) all (artifacts|enchantments|nonland permanents|artifacts and enchantments|creatures|permanents) (?:you don't control|your opponents control)$/, m => ({ t: 'wipe', how: m[1].toLowerCase(), what: `${m[2]} you don't control` })],
    [/^return all (nonland permanents|creatures|artifacts|enchantments|permanents)( you don't control| your opponents control)? to (?:their owners' hands|its owner's hand)$/, m => ({ t: 'massBounce', what: `${m[1]}${m[2] ? " you don't control" : ''}` })],
    [/^(destroy|exile) all (creatures|other creatures|artifacts|enchantments|artifacts and enchantments|nonland permanents|creatures you don't control|creatures your opponents control|nontoken creatures|lands|tapped creatures|attacking creatures|creatures with power \w+ or less|creatures with power \w+ or greater|creatures with mana value \w+ or less)$/, m => ({ t: 'wipe', how: m[1].toLowerCase(), what: m[2] })],
    [/^~ deals (\w+) damage to each (creature and each player|player|creature without flying|creature with flying|other creature|creature and planeswalker your opponents control|opponent and each creature they control)$/, m => ({ t: 'dmg', n: num(m[1]), target: { 'creature and each player': 'everyone', player: 'players', 'creature without flying': 'groundCreatures', 'creature with flying': 'flyingCreatures', 'other creature': 'allCreatures', 'creature and planeswalker your opponents control': 'oppCreatures', 'opponent and each creature they control': 'oppAll' }[m[2]] })],
    [/^~ deals (\w+) damage to target (?:creature or player|attacking creature|attacking or blocking creature|creature without flying|creature with flying|tapped creature|blocking creature)$/, m => ({ t: 'dmg', n: num(m[1]), target: 'creature' })],
    [/^~ deals (\w+) damage to target (?:player or planeswalker|opponent|opponent or planeswalker|player)$/, m => ({ t: 'dmg', n: num(m[1]), target: 'player' })],
    [/^~ deals (\w+) damage to you$/, m => ({ t: 'loseSelf', n: num(m[1]) })],
    // This permanent itself
    [/^~ gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [], target: 'self', good: true })],
    [/^~ gains ([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[1]), target: 'self', good: true })],
    [/^return ~ to its owner's hand$/, () => ({ t: 'selfBounce' })],
    [/^sacrifice ~$/, () => ({ t: 'sacSelf' })],
    [/^~ fights target creature (?:you don't control|an opponent controls)?$/, () => ({ t: 'fight', target: 'creature', self: true })],
    [/^target creature you control fights target creature (?:you don't control|an opponent controls)$/, () => ({ t: 'fight', target: 'creature' })],
    // Your whole team
    [/^creatures you control get \+(\d+)\/\+(\d+)(?: and gain ([a-z ,]+?))? until end of turn$/, m => ({ t: 'teamPump', p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [] })],
    [/^creatures you control gain ([a-z ,]+?) until end of turn$/, m => ({ t: 'teamPump', p: 0, q: 0, kw: splitKw(m[1]) })],
    [/^put (\w+) \+1\/\+1 counters? on each (?:other )?creature you control$/, m => ({ t: 'teamCounters', n: num(m[1]) })],
    [/^proliferate$/, () => ({ t: 'proliferate' })],
    // Players
    [/^(each opponent|target opponent|target player|each player) sacrifices (?:a|an) (creature|artifact|enchantment|permanent|nonland permanent|creature or planeswalker|land)$/, m => ({ t: 'edict', who: m[1], what: m[2] })],
    [/^draw (\w+) cards?, then discard (\w+) cards?$/, m => ({ t: 'loot', n: num(m[1]), d: num(m[2]) })],
    [/^discard (\w+) cards?, then draw (\w+) cards?$/, m => ({ t: 'loot', n: num(m[2]), d: num(m[1]) })],
    [/^each player draws (\w+) cards?$/, m => ({ t: 'drawAll', n: num(m[1]) })],
    [/^each player (?:loses|discards) (\w+) (life|cards?)$/, m => ({ t: m[2] === 'life' ? 'loseAll' : 'discardAll', n: num(m[1]) })],
    [/^you and target opponent each draw (\w+) cards?$/, m => ({ t: 'drawAll', n: num(m[1]) })],
    // Libraries and graveyards (the card is picked from a list: you choose, the AI takes its best)
    [/^search your library for (a|an|up to \w+) (basic land|land|basic plains|basic island|basic swamp|basic mountain|basic forest|plains|island|swamp|mountain|forest|(?:plains|island|swamp|mountain|forest) or (?:plains|island|swamp|mountain|forest)) cards?(?:, reveal (?:it|them))?,? (?:and )?put (?:it|them|that card|those cards) (onto the battlefield(?: tapped)?|into your hand)(?:, then shuffle)?$/, m => ({ t: 'fetchLand', n: m[1].startsWith('up to') ? num(m[1].slice(6)) : 1, what: m[2], bf: m[3].startsWith('onto'), tapped: /tapped/.test(m[3]) })],
    [/^search your library for (?:a|an) (creature|instant|sorcery|artifact|enchantment|instant or sorcery|land|artifact or enchantment)? ?card(?: with mana value \w+ or less)?(?:, reveal it)?,? (?:and )?put (?:it|that card) into your hand(?:, then shuffle)?$/, m => ({ t: 'tutor', what: m[1] || 'card' })],
    [/^return (?:up to one )?target (creature|instant or sorcery|instant|sorcery|artifact|enchantment|permanent|land|nonland permanent|artifact or enchantment|creature or planeswalker)? ?card from your graveyard to (your hand|the battlefield(?: under your control)?|the battlefield tapped)$/, m => ({ t: 'regrow', what: m[1] || 'card', bf: !m[2].includes('hand') })],
    // Artifact tokens (each comes with its real rules text, read by rulesFor)
    [/^create (\w+) (treasure|food|clue|blood|map|powerstone|gold) tokens?$/, m => ({ t: 'artToken', n: num(m[1]), kind: m[2] })],
    [/^investigate$/, () => ({ t: 'artToken', n: 1, kind: 'clue' })],
    [/^create (\w+) (\d+)\/(\d+) ([a-z ]+?) (artifact )?creature tokens? (?:with|that (?:have|has)) ([a-z ,]+)$/, m => ({ t: 'token', n: num(m[1]), p: +m[2], q: +m[3], name: m[4], kw: splitKw(m[6]), artifact: !!m[5] })],
    [/^create (\w+) (\d+)\/(\d+) ([a-z ]+?) artifact creature tokens?$/, m => ({ t: 'token', n: num(m[1]), p: +m[2], q: +m[3], name: m[4], kw: [], artifact: true })],
    [/^target creature(?: an opponent controls| you don't control)? gets ([+-]\d+)\/([+-]\d+) until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], target: 'creature', good: +m[1] + +m[2] >= 0 })],
    [/^target creature can't block this turn$/, () => ({ t: 'pump', p: 0, q: 0, kw: ['cantblock'], target: 'creature', good: false })],
    [/^~ deals (\w+) damage to target creature or planeswalker an opponent controls$/, m => ({ t: 'dmg', n: num(m[1]), target: 'creature' })],
    [/^~ deals (\w+) damage to target creature (?:you don't control|an opponent controls)$/, m => ({ t: 'dmg', n: num(m[1]), target: 'creature', theirs: true })],
    [/^each creature deals (\w+) damage to its controller$/, m => ({ t: 'creaturesHitOwners', n: num(m[1]) })],
    [/^(destroy|exile) target (artifact|creature|enchantment|artifact or enchantment|permanent) (?:you don't control|an opponent controls)$/, m => ({ t: m[1].toLowerCase(), target: 'perm', filter: `${m[2]} you don't control` })],
    [/^you gain (\w+) life and draw (\w+) cards?$/, m => ({ t: 'gain', n: num(m[1]), then: { t: 'draw', n: num(m[2]) } })],
    // Color filters: "destroy target nonblack creature"
    [/^(destroy|exile) target (non)?(white|blue|black|red|green|artifact) creature$/, m => ({ t: m[1], target: 'perm', filter: `${m[2] || ''}${m[3]} creature` })],
    [/^(?:you )?mill (\w+) cards?$/, m => ({ t: 'millSelf', n: num(m[1]) })],
    [/^all creatures get ([+-]\d+)\/([+-]\d+) until end of turn$/, m => ({ t: 'allPump', p: +m[1], q: +m[2] })],
    [/^prevent all combat damage that would be dealt this turn$/, () => ({ t: 'fog' })],
    [/^damage can't be prevented this turn$/, () => ({ t: 'noPrevent' })],
    // "deals 3 damage divided as you choose among one, two, or three targets" (601.2d)
    [/^~ deals (\w+) damage divided as you choose among (one or two|one, two, or three|any number of) targets?$/, m => ({ t: 'dmg', n: num(m[1]), target: 'any', div: { 'one or two': 2, 'one, two, or three': 3, 'any number of': 99 }[m[2]] })],
    [/^gain control of target creature until end of turn$/, () => ({ t: 'steal', target: 'creature' })],
    [/^untap target creature and gain control of it until end of turn$/, () => ({ t: 'steal', target: 'creature' })],
    [/^its controller gains life equal to its power$/, () => ({ t: 'lifeFromPower' })],
    [/^draw three cards, then put two cards from your hand on top of your library in any order$/, () => ({ t: 'brainstorm' })],
    [/^search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand(?:, then shuffle)?$/, () => ({ t: 'cultivate' })],
    [/^discard (\w+) cards?$/, m => ({ t: 'discardSelf', n: num(m[1]) })],
    [/^~ deals (\w+) damage to that player$/, m => ({ t: 'dmg', n: num(m[1]), target: 'opponents' })],
    [/^that player (?:discards a card|loses (\w+) life)$/, m => (m[1] ? { t: 'drain', n: num(m[1]) } : { t: 'discard', n: 1 })],
    [/^untap ~$/, () => ({ t: 'untapSelf' })],
    [/^exile ~$/, () => ({ t: 'exileSelf' })],
    [/^put (\w+) (charge|oil|lore|time|quest|level|age) counters? on ~$/, m => ({ t: 'namedCounter', n: num(m[1]), kind: m[2] })],
    [/^regenerate ~$/, () => ({ t: 'regen' })],
    [/^exile target card from a graveyard$/, () => ({ t: 'exileGy' })],
    [/^exile target player's graveyard$/, () => ({ t: 'exileGy', all: true })],
    [/^(?:you )?draw (\w+) cards?$/, m => ({ t: 'draw', n: num(m[1]) })],
    [/^(?:you )?gain (\w+) life$/, m => ({ t: 'gain', n: num(m[1]) })],
    [/^you lose (\w+) life$/, m => ({ t: 'loseSelf', n: num(m[1]) })],
    [/^(?:each opponent|target opponent|target player) loses (\w+) life$/, m => ({ t: 'drain', n: num(m[1]) })],
    [/^(?:each opponent|target opponent|target player) discards (\w+) cards?$/, m => ({ t: 'discard', n: num(m[1]) })],
    [/^(?:each opponent|target opponent|target player) mills (\w+) cards?$/, m => ({ t: 'mill', n: num(m[1]) })],
    [/^target player draws (\w+) cards?$/, m => ({ t: 'draw', n: num(m[1]) })],
    [/^target creature(?: you control)? gets \+(\d+)\/\+(\d+)(?: and gains ([a-z ,]+?))? until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [], target: 'creature', good: true })],
    [/^target creature(?: an opponent controls| you don't control)? gets -(\d+)\/-(\d+) until end of turn$/, m => ({ t: 'pump', p: -m[1], q: -m[2], kw: [], target: 'creature', good: false })],
    [/^target creature(?: you control)? gains (?!protection from the color)([a-z ,]+?) until end of turn$/, m => ({ t: 'pump', p: 0, q: 0, kw: splitKw(m[1]), target: 'creature', good: true })],
    [/^create (\w+) (\d+)\/(\d+) ([a-z ]+?) creature tokens?(?: with ([a-z ,]+))?$/, m => ({ t: 'token', n: num(m[1]), p: +m[2], q: +m[3], name: m[4], kw: m[5] ? splitKw(m[5]) : [] })],
    [/^put (\w+) \+1\/\+1 counters? on target creature(?: you control)?$/, m => ({ t: 'counters', n: num(m[1]), target: 'creature', good: true })],
    [/^put (\w+) \+1\/\+1 counters? on ~$/, m => ({ t: 'counters', n: num(m[1]), target: 'self' })],
    [/^tap target (?:creature|creature an opponent controls|creature you don't control)$/, () => ({ t: 'tap', target: 'creature', good: false })],
    [/^tap target (permanent|artifact|land|artifact or creature|nonland permanent)$/, m => ({ t: 'tap', target: 'perm', filter: m[1], good: false })],
    [/^counter target spell$/, () => ({ t: 'counter', target: 'spell', filter: 'any' })],
    [/^counter target spell, activated ability, or triggered ability$/, () => ({ t: 'counter', target: 'spell', filter: 'spellOrAbility' })],
    // "Counter target spell if it's blue" (Pyroblast): played as targeting only a blue spell
    [/^counter target (?:(white|blue|black|red|green) spell|spell if it's (white|blue|black|red|green))$/, m => ({ t: 'counter', target: 'spell', filter: m[1] || m[2] })],
    [/^destroy target (?:(white|blue|black|red|green) permanent|permanent if it's (white|blue|black|red|green))$/, m => ({ t: 'destroy', target: 'perm', filter: `${m[1] || m[2]} permanent` })],
    [/^permanents you control gain ([a-z ,]+?) until end of turn$/, m => ({ t: 'teamPump', p: 0, q: 0, kw: splitKw(m[1]) })],
    [/^untap up to (\w+) lands$/, m => ({ t: 'untapLandsN', n: num(m[1]) })],
    [/^(?:you may )?play an additional land this turn$/, () => ({ t: 'extraLand' })],
    [/^return a land you control to its owner's hand$/, () => ({ t: 'bounceOwnLand' })],
    [/^counter target (noncreature|creature|instant or sorcery|artifact or enchantment) spell$/, m => ({ t: 'counter', target: 'spell', filter: m[1] })],
    [/^counter target spell unless its controller pays \{(\d+)\}$/, m => ({ t: 'counter', target: 'spell', filter: 'any', unless: +m[1] })],
    [/^counter target (?:activated or triggered|triggered) ability$/, () => ({ t: 'counter', target: 'spell', filter: 'ability' })],
    [/^scry (\w+)$/, m => ({ t: 'scry', n: num(m[1]) })],
    [/^surveil (\w+)$/, m => ({ t: 'surveil', n: num(m[1]) })],
    [/^[Aa]dd ((?:\{[WUBRGC]\})+)$/, m => ({ t: 'addMana', mana: m[1].match(/[WUBRGC]/g) })],
    [/^[Aa]dd one mana of any color$/, () => ({ t: 'addMana', any: 1 })],
    [/^discover (\d+)$/i, m => ({ t: 'discover', n: +m[1] })],
    // Filter lands: "Add {R}{R}, {R}{W}, or {W}{W}"
    [/^[Aa]dd ((?:\{[WUBRGC]\}){2}), ((?:\{[WUBRGC]\}){2}),? or ((?:\{[WUBRGC]\}){2})$/, m => ({ t: 'addMana', opts: [m[1], m[2], m[3]].map(x => x.match(/[WUBRGC]/g)) })],
    [/^[Aa]dd \{([WUBRGC])\}(?:, \{([WUBRGC])\})*,? or \{([WUBRGC])\}$/, m => ({ t: 'addMana', choice: [...new Set(m[0].match(/[WUBRGC]/g))] })],
    [/^[Aa]dd \{([WUBRGC])\} for each (.+)$/, m => (countFn(`the number of ${m[2]}`) ? { t: 'addMana', color: m[1], count: `the number of ${m[2]}` } : null)],
    [/^[Aa]dd (\w+) mana in any combination of colors$/, m => ({ t: 'addMana', any: num(m[1]) })],
    [/^add (\w+) mana of any one color$/, m => ({ t: 'addMana', any: num(m[1]) })],
    [/^([A-Z][a-z]+) you control get \+(\d+)\/\+(\d+)(?: and gain ([a-z ,]+?))? until end of turn$/, m => { const type = lordType(m[1]); return type ? { t: 'teamPump', p: +m[2], q: +m[3], kw: m[4] ? splitKw(m[4]) : [], type } : null; }],
    [/^you become the monarch$/, () => ({ t: 'monarch' })],
    [/^target creature can't be blocked this turn$/, () => ({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'creature', good: true })],
    [/^copy target (instant or sorcery|instant|sorcery) spell(?: you control)?$/, m => ({ t: 'copySpell', target: 'spell', filter: 'instant or sorcery' })],
    [/^§dig (\d+) (\S+) (hand|top)$/, m => ({ t: 'dig', n: +m[1], what: m[2].replace(/_/g, ' '), to: m[3] })],
    [/^put (\w+) \+1\/\+1 counters? on (?:another )?target (?:creature|artifact or creature|creature or vehicle|creature or artifact)(?: you control)?$/, m => ({ t: 'counters', n: num(m[1]), target: 'creature', good: true })],
    // Creature lands: "~ becomes a 2/2 creature with all creature types until end of turn"
    [/^(?:until end of turn, )?~ becomes an? (\d+)\/(\d+) ([a-z ]*?)(?:artifact )?creature(?: with ([a-z ,]+?))?(?: and all creature types)?(?: until end of turn)?$/, m => ({ t: 'animate', p: +m[1], q: +m[2], kw: (m[4] || '').replace(/all creature types/, '').split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(x => x && KEYWORDS.includes(x)) })],
    [/^~ can't be blocked this turn$/, () => ({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'self', good: true })],
    // "Exile the top card of your library. You may play it this turn."
    [/^exile the top (?:(\w+) )?cards? of your library$/, m => ({ t: 'exileTop', n: m[1] ? num(m[1]) : 1 })],
    [/^(?:until (?:the )?end of (your next )?turn, )?(?:you may )?play (?:it|that card|them|those cards)(?: this turn| until (?:the )?end of (your next )?turn)?$/, m => ({ t: 'playExiled', next: !!(m[1] || m[2]) })],
    [/^(?:take|target player takes) an extra turn after this one$/, () => ({ t: 'extraTurn' })],
    [/^transform ~$/, () => ({ t: 'transform' })],
    [/^§revealxf (\S+)$/, m => ({ t: 'revealTransform', what: m[1].replace(/_/g, ' ') })],
    [/^exile ~, then return (?:it|him|her) to the battlefield transformed under (?:your|its owner's) control$/, () => ({ t: 'exileReturnTransformed' })],
    // Optional costs inside an effect ("you may pay {2}. If you do, ...")
    [/^pay ((?:\{[^}]+\})+)$/, m => { const c = parseCost(m[1]); return c.x || c.odd ? null : { t: 'optPay', cost: c }; }],
    [/^pay (\w+) life$/, m => ({ t: 'optLife', n: num(m[1]) })],
    [/^sacrifice (?:a|another) (creature|artifact|land)$/, m => ({ t: 'optSac', what: m[1] })],
    [/^return it to its owner's hand$/, () => ({ t: 'selfBounce' })],
    [/^(?:you )?untap all lands you control$/, () => ({ t: 'untapLands' })],
    [/^tap all (creatures your opponents control|creatures you don't control|creatures target opponent controls|creatures)$/, m => ({ t: 'tapAll', who: m[1] === 'creatures' ? 'all' : 'opp' })],
    [/^(?:target player|target opponent|each opponent|that player) discards (\w+) cards? at random$/, m => ({ t: 'discard', n: num(m[1]) })],
    [/^§pick (\S+)$/, m => ({ t: 'discardPick', what: m[1].replace(/_/g, ' ') })],
    [/^(?:those creatures|that creature|it|they) (?:don't|doesn't) untap during (?:its|their) (?:controller's|controllers') next untap step$/, () => ({ t: 'freezeLast' })],
    [/^target creature you control gains protection from the color of your choice until end of turn$/, () => ({ t: 'protChoice', target: 'creature', good: true, mine: true })]
];

function parseEffects(text) {
    text = text.replace(/(Exile \d+ target creatures)\. (For each creature exiled this way, its controller creates)/g, '$1 §§ $2')
        .replace(/[Ll]ook at the top card of your library\. If it's a creature card, you may reveal it and put it into your hand\. If you don't put the card into your hand, you may put it into your graveyard\./g, 'Look at the top card of your library. If it\'s a creature card, you may reveal it and put it into your hand. If you don\'t put the card into your hand, you may put it into your graveyard'.replace(/\. /g, '§¶'));
    // Multi-sentence card-selection phrases become one token first ("look at the top N cards...")
    text = text.replace(/Look at the top (\w+) cards of your library\. (?:You may reveal|Put) (?:a|an|one|up to one) ?((?:creature|land|instant or sorcery|artifact|enchantment|permanent|nonland|noncreature|legendary|dragon|elf|goblin|spider|vampire|zombie|human|wizard|angel|knight|merfolk|dinosaur)(?: or (?:creature|land|artifact|enchantment))?)? ?card (?:from among them|of them) (?:and put (?:it|that card) )?into your hand(?: and the rest on the bottom of your library in (?:a random|any) order)?\.(?: Put the rest on the bottom of your library in (?:a random|any) order\.)?/gi,
        (all, n, what) => `§dig ${num(n)} ${(what || 'card').toLowerCase().replace(/ /g, '_')} hand.`)
        .replace(/Target (?:opponent|player) reveals their hand\. You choose a card from it with mana value (\w+) or greater\. That player discards that card\./gi, (all, mv) => `§pick card_mvge${num(mv)}.`)
        .replace(/Target (?:opponent|player) reveals (?:their|his or her) hand\. You choose an? ((?:non)?[a-z]+(?:,? (?:or )?(?:non)?[a-z]+)?) card(?: with mana value (\w+) or less)? from it(?: with mana value (\w+) or less)?\. That player discards that card\./gi, (all, what, mv, mv2) => `§pick ${what.toLowerCase().replace(/,? /g, '_')}${mv || mv2 ? `_mv${num(mv || mv2)}` : ''}.`)
        // Magic 2010 (2026-10-08)
        .replace(/Exile target creature card from a graveyard\. Create a 2\/2 black Zombie creature token\./g, '§reaper.')
        .replace(/target Forest becomes a 4\/5 green Treefolk creature for as long as ~ remains on the battlefield\. It's still a land\./g, '§awakener.')
        .replace(/choose target nonland permanent you control and up to two target nonland permanents you don't control\. Destroy one of them at random\./g, '§efreet.')
        .replace(/each other player copies that spell\. Each of those players may choose new targets for their copy\./g, '§hivemind.')
        .replace(/reveal the top card of your library\. If it's a creature card, put it onto the battlefield\. Otherwise, you may put that card on the bottom of your library\./g, '§lurking.')
        .replace(/search that player's library for a card, then that player chooses a card name\. If you searched for a creature card that doesn't have that name, you may put it onto the battlefield under your control\. Then that player shuffles\./g, '§sphinxamb.')
        .replace(/sacrifice a creature other than ~, then each opponent loses life equal to the sacrificed creature's power\. If you can't sacrifice a creature, tap ~ and you lose 7 life\./g, '§xathrid.')
        .replace(/Target creature you control with toughness less than ~'s power gains flying until end of turn\. Destroy that creature at the beginning of the next end step\./g, '§stonegiant.')
        .replace(/Tap all untapped Wolf creatures you control\. Each Wolf tapped this way deals damage equal to its power to target creature\. That creature deals damage equal to its power divided as its controller chooses among any number of those Wolves\./g, '§wildhunt.')
        .replace(/Choose up to seven face-up exiled cards you own\. Exile all the cards from your library, then put the chosen cards on top of your library\./g, '§mirrorfate.')
        .replace(/Reveal the top card of your library\. You may play that card without paying its mana cost\. If you don't, exile it\./g, '§djinnwish.')
        .replace(/Exile all cards from target player's graveyard other than basic land cards\. For each card exiled this way, search that player's library for all cards with the same name as that card and exile them\. Then that player shuffles\./g, '§haunting.')
        .replace(/Destroy target creature\. It can't be regenerated\. Its controller reveals cards from the top of their library until they reveal a creature card\. The player puts that card onto the battlefield, then shuffles all other cards revealed this way into their library\./g, '§polymorph.')
        .replace(/Each player shuffles all permanents they own into their library, then reveals that many cards from the top of their library\. Each player puts all artifact, creature, and land cards revealed this way onto the battlefield, then does the same for enchantment cards, then puts all cards revealed this way that weren't put onto the battlefield on the bottom of their library\./g, '§warpworld.')
        // Mirrodin (2026-10-08)
        .replace(/It deals 2 damage to each attacking creature without flying\./g, '§bladetrap.')
        .replace(/[Uu]ntil end of turn, you gain control of target creature and it gains haste\./g, '§reins.')
        .replace(/target opponent gains control of ~ and puts a charge counter on it\./g, '§chokerpass.')
        .replace(/~ deals damage to you equal to the number of charge counters on it\./g, '§chokerdmg.')
        .replace(/~ deals 2 damage to target creature\. If it's an artifact creature, ~ deals 4 damage to it instead\./g, '§ebolt.')
        .replace(/Destroy target land\. If that land was nonbasic, ~ deals 2 damage to the land's controller\./g, '§moltenrain.')
        .replace(/Destroy target artifact with mana value 97\. It can't be regenerated\. ~ deals 97 damage to that artifact's controller\./g, '§detonate.')
        .replace(/Sacrifice a creature\. ~ deals damage equal to that creature's power to any target\./g, '§sacfling.')
        .replace(/Target player draws a card, then discards a card\. If that player discards an artifact card this way, untap ~\./g, '§augur.')
        .replace(/reveal the top card of your library\. If it's an artifact card, put it into your hand\. Otherwise, put it into your graveyard\./g, '§revealart.')
        .replace(/you may pay \{X\}\. If you do, search your library for an Equipment card with mana value X or less, put that card onto the battlefield, then shuffle\./g, '§tajnar.')
        .replace(/you may have target player reveal their hand\. If you do, choose a nonland card from it and exile that card\./g, '§prisonimprint.')
        .replace(/sacrifice another artifact\. If you can't, tap ~ and you lose 4 life\./g, '§rustelem.')
        .replace(/the player with the lowest life total gains control of ~\. If two or more players are tied for lowest life total, you choose one of them, and that player gains control of ~\./g, '§peacekeeper.')
        .replace(/if ~ has five or more charge counters on it, remove all of them from it and create that many 3\/1 red Elemental creature tokens with haste\. Exile them at the beginning of the next end step\./g, '§coils.')
        .replace(/draw a card if you had no cards in hand at the beginning of this turn\. If you had a card in hand, ~ deals 1 damage to you\./g, '§crown.')
        .replace(/each player exiles the top card of their library\. The player who exiled the card with the greatest mana value takes an extra turn after this one\. If two or more players' cards are tied for greatest, the tied players repeat this process until the tie is broken\./g, '§timesift.')
        .replace(/that player reveals the top card of their library\. If it's an artifact, creature, enchantment, or land card, the player may put it onto the battlefield\./g, '§gateaether.')
        .replace(/that player chooses draw step, main phase, or combat phase\. The player skips each instance of the chosen step or phase this turn\./g, '§fatespin.')
        .replace(/that player puts a flood counter on target non-Island land they control of their choice\. That land is an Island for as long as it has a flood counter on it\./g, '§floodland.')
        .replace(/if all lands on the battlefield are Islands, remove all flood counters from them\./g, '§unflood.')
        .replace(/Flip a coin until you lose a flip or choose to stop flipping\. If you lose a flip, ~ has no effect\. If you win one or more flips, ~ deals 3 damage to target creature\. If you win two or more flips, ~ deals 6 damage to each opponent\. If you win three or more flips, draw nine cards and untap all lands you control\./g, '§gambit.')
        .replace(/Choose a card name\. Reveal cards from the top of your library until you reveal a card with that name, then put that card into your hand\. Exile all other cards revealed this way, and you lose 1 life for each of the exiled cards\./g, '§spoils.')
        .replace(/Search your library for a nonland card and reveal it\. Each opponent who cast a spell this turn with the same name as that card loses 6 life\. Then shuffle\./g, '§grimreminder.')
        .replace(/Reveal cards from the top of your library until you reveal a land card\. ~ deals damage equal to the number of nonland cards revealed this way to any target\. If the revealed land card was a Mountain, ~ deals double that damage instead\. Put the revealed cards on the bottom of your library in any order\./g, '§charbelcher.')
        .replace(/Choose a card name\. Target opponent guesses whether a card with that name is in your hand\. You may reveal your hand\. If you do and your opponent guessed wrong, draw a card\./g, '§pendulum.')
        .replace(/Search your library for any number of artifact cards, exile them, then create that many 1\/1 colorless Myr artifact creature tokens\. Then shuffle\./g, '§incubator.')
        .replace(/Destroy each nonland permanent without a fate counter on it, then remove all fate counters from all permanents\./g, '§ostone.')
        .replace(/Put target creature on the bottom of its owner's library\. That creature's controller reveals cards from the top of their library until they reveal a creature card\. The player puts that card onto the battlefield and the rest on the bottom of their library in any order\./g, '§proteus.')
        .replace(/You may copy the exiled card\. If you do, you may cast the copy without paying its mana cost\./g, '§scepter.')
        .replace(/Return ~ from your graveyard to the battlefield, then sacrifice a creature\./g, '§nimdevour.')
        .replace(/Each player returns to the battlefield all artifact, creature, enchantment, and land cards in their graveyard that were put there from the battlefield this turn\./g, '§secondsunrise.')
        .replace(/Each player shuffles their hand and graveyard into their library\./g, '§timetwister.')
        .replace(/The next time target creature would deal damage this turn, prevent that damage\. You gain life equal to the damage prevented this way\./g, '§awestrike.')
        .replace(/sacrifice it unless an opponent was dealt damage this turn\./g, '§warelemental.')
        .replace(/Draw three cards\. Then discard two cards unless you discard an artifact card\./g, 'Draw three cards. §thirst.')
        .replace(/Choose one — Put a charge counter on target artifact\. Put a \+1\/\+1 counter on target creature\./g, '§conduit2.')
        .replace(/Put target creature card from a graveyard onto the battlefield under your control\./g, 'Put target creature card from a graveyard onto the battlefield under your control.')
        .replace(/[Uu]ntil end of turn, each creature card in your graveyard gains "Escape—((?:\{[^}]+\})+), Exile (\w+) other cards from your graveyard\."/g, (all, c, n) => `§lockerescape ${c} ${num(n)}.`)
        .replace(/Each creature with mana value (\d+) or less loses all abilities until end of turn\. Destroy those creatures\./g, (all, n) => `§blacksun ${n}.`)
        .replace(/[Ee]xile each opponent's graveyard\. When you do, choose up to one target creature card exiled this way\. Create a token that's a copy of that card, except it's an artifact and it loses all other card types\./g, '§espers.')
        .replace(/[Uu]ntil end of turn, whenever a nontoken creature you control dies, create a number of 1\/1 green Saproling creature tokens equal to that creature's power\./g, '§thrinax.')
        .replace(/[Ww]henever a nontoken creature you control dies, create a number of 1\/1 green Saproling creature tokens equal to that creature's power\./g, '§thrinax.')
        .replace(/[Ss]tarting with you, each player votes for profit or security\. You create a number of Treasure tokens equal to twice the number of profit votes\. Put a number of \+1\/\+1 counters on each creature you control equal to the number of security votes\./g, '§emissary.')
        .replace(/[Yy]ou may sacrifice another creature or a token\. When you do, target creature an opponent controls gets -2\/-2 until end of turn\./g, '§willow.')
        .replace(/[Yy]ou may sacrifice another nonland permanent\. If you do, draw two cards and each opponent loses life equal to the mana value of the sacrificed permanent\./g, '§shadowthrow.')
        .replace(/[Yy]ou may sacrifice a creature that saddled it this turn\. If you do, draw X cards, then put up to X land cards from your hand onto the battlefield tapped, where X is the sacrificed creature's power\./g, '§gitrog.')
        .replace(/[Pp]ut target creature card from an opponent's graveyard onto the battlefield tapped under your control, then exile that player's graveyard\./g, '§conscription.')
        .replace(/Return target card from your graveyard to your hand\. Put up to one other target card from your graveyard on top of your library\. Exile ~\./g, '§oncefuture.')
        .replace(/Mill three cards\. Then starting with the next opponent in turn order, each opponent chooses a creature card in your graveyard that hasn't been chosen\. Return each card chosen this way to the battlefield under your control\./g, '§rejoin.')
        .replace(/Create X (\d+)\/(\d+) ([A-Za-z ]+?) creature tokens with "(.+?),?" where X is the sacrificed creature's power\./g, (all, p, q, nm, txt) => `§tokentext sac ${p} ${q} ${nm.replace(/ /g, '_')} - ${encodeURIComponent(txt.replace(/,$/, '.')).replace(/\./g, '%2E')}.`)
        .replace(/Exile target player's graveyard\. You gain 1 life for each card exiled this way\./g, '§exilegygain.')
        .replace(/Distribute X \+1\/\+1 counters among any number of target creatures you control, where X is the number of creature cards in your graveyard as you cast ~\./g, '§upheaval.')
        .replace(/Choose two target creature cards in your graveyard\. Sacrifice a creature\. If you do, return the chosen cards to the battlefield tapped\./g, '§victimize.')
        .replace(/All lands you control become (\d+)\/(\d+) creatures until end of turn\. They're still lands\./g, (all, p, q) => `§animatelands ${p} ${q}.`)
        .replace(/Return target creature card from your graveyard to the battlefield\. You lose life equal to its mana value\./g, 'Return target creature card from your graveyard to the battlefield. §loselastmv.')
        // Brudiclad deck (2026-10-07)
        .replace(/[Cc]reate (a|an|one|two|three|four|five) (\d+)\/(\d+) ([A-Za-z ]+?) creature tokens? with "(.+)"( (?:They gain|That token gains) haste until end of turn\.)?/g, (all, n, p, q, nm, txt, haste) => `§tokentext ${n} ${p} ${q} ${nm.replace(/ /g, '_')} ${haste ? 'haste' : '-'} ${encodeURIComponent(txt).replace(/\./g, '%2E')}.`)
        .replace(/[Cc]reate (a|an|one|two|three|four|five) (\d+)\/(\d+) ([A-Za-z ]+?) creature tokens? with '(.+)'( (?:They gain|That token gains) haste until end of turn\.)?/g, (all, n, p, q, nm, txt, haste) => `§tokentext ${n} ${p} ${q} ${nm.replace(/ /g, '_')} ${haste ? 'haste' : '-'} ${encodeURIComponent(txt).replace(/\./g, '%2E')}.`)
        .replace(/Choose target artifact card in your graveyard\. You may cast that card this turn\./g, '§emry.')
        .replace(/For each artifact you control, create a token that's a copy of it\. Those tokens gain haste\. Exile those tokens at the beginning of the next end step\./g, '§copyeachart.')
        .replace(/Reveal cards from the top of your library until you reveal an artifact card\. Put that card onto the battlefield and the rest on the bottom of your library in a random order\. ~ deals damage to you equal to the number of cards revealed this way\./g, '§reshape.')
        .replace(/[Cc]reate a 2\/1 blue Phyrexian Myr artifact creature token\. Then you may choose a token you control\. If you do, each other token you control becomes a copy of that token\./g, 'Create a 2/1 blue Phyrexian Myr artifact creature token. §brudiclad.')
        .replace(/[Tt]he owner of target permanent shuffles it into their library, then reveals the top card of their library\. If it's a permanent card, they put it onto the battlefield\./g, '§chaoswarp.')
        .replace(/[Tt]arget opponent may have you draw three cards\. If the player doesn't, you mill three cards, then ~ deals damage to that player equal to the total mana value of those cards\./g, '§gearhulk.')
        .replace(/Reveal the top five cards of your library\. An opponent separates those cards into two piles\. Put one pile into your hand and the other into your graveyard\./g, '§factfiction.')
        .replace(/[Yy]ou may pay \{([WUBRG\d])\}\. If you do, create a token that's a copy of that (creature|artifact)\.(?: That token gains haste\. Exile it at the beginning of the next end step\.)?/g, (all, c, w) => `§paycopy ${c} ${/haste/.test(all) ? 'haste' : '-'}.`)
        .replace(/[Ss]acrifice an artifact\. If you do, return target artifact card from your graveyard to the battlefield\./g, '§darettiswap.')
        .replace(/Counter target spell\. Create X Treasure tokens, where X is that spell's mana value\./g, 'Counter target spell. §treasureLastMv.')
        .replace(/Choose target creature you control\. Create a token that's a copy of that creature\. Each opponent may create a token that's a copy of that creature\. For each opponent who does, create a token that's a copy of that creature\./g, '§tempt.')
        .replace(/Choose target nonlegendary creature\. The next time one or more creatures or planeswalkers enter this turn, they enter as copies of the chosen creature\./g, '§reflection.')
        .replace(/Scry 1\. Put a landmark counter on ~\. Then if there are three or more landmark counters on it, remove those counters, transform ~, and create three Treasure tokens\./g, '§treasuremap.')
        .replace(/[Ii]t deals damage to the player or planeswalker it's attacking equal to the number of (.+?)\./g, (all, w) => `~ deals damage to each opponent equal to the number of ${w}.`)
        .replace(/[Yy]ou may tap X untapped Myr you control\. If you do, ~ gets \+X\/\+0 until end of turn and deals X damage to the player or planeswalker it's attacking\./g, '§battlesphere.')
        .replace(/Destroy each nonland permanent with mana value (\d+) whose controller was dealt combat damage by ~ this turn\./g, (all, n) => `§steelhk ${n}.`)
        .replace(/Search your library for up to X basic land cards, where X is the greatest power among creatures you control\. Put those cards onto the battlefield tapped, then shuffle\./gi, '§fetchpow.')
        .replace(/Choose exactly two creatures you control\. You draw X cards and the chosen creatures get \+X\/\+X and gain trample until end of turn, where X is the difference between the chosen creatures' powers\./gi, '§spry.')
        .replace(/Reveal the top (\d+) cards of your library\. You may put any number of permanent cards with mana value \1 or less from among them onto the battlefield\. Then put all cards revealed this way that weren't put onto the battlefield into your graveyard\./gi, (all, n) => `§genesis ${n}.`)
        .replace(/[Ss]tarting with you, each player may choose an artifact or enchantment you don't control\. Destroy each permanent chosen this way\./g, '§druidpurify.')
        .replace(/[Yy]ou may sacrifice a nontoken creature\. If you do, create X 2\/2 green Wolf creature tokens, where X is the sacrificed creature's toughness\./g, '§feedpack.')
        // Tyrox deck (2026-10-08)
        .replace(/[Dd]efending player reveals the top card of their library\. If it's a land card, that player puts it into their hand\./g, '§guide.')
        .replace(/it gets \+1\/\+0 until end of turn for each other attacking Goblin\./g, '§rabble.')
        .replace(/That creature also gains trample until end of turn if you control a creature with power 4 or greater\./g, 'If you control a creature with power 4 or greater, that creature gains trample until end of turn.')
        .replace(/[Yy]ou may put a land card from your hand onto the battlefield tapped\. If you do, draw a card and repeat this process\./g, '§colossus.')
        .replace(/[Yy]ou may mill that many cards\. Put any number of land cards from among them onto the battlefield tapped\./g, '§millLands.')
        .replace(/Exile target creature card with mana value (\d+) from your graveyard\. Create a token that's a copy of it, except it's a 4\/4 black Zombie\./g, (all, n) => `§zombiecopy ${n}.`)
        .replace(/Choose target nonland permanent card in your graveyard\. If you haven't cast a spell this turn, you may cast that card\. If you do, you can't cast additional spells this turn\./g, '§conduit.')
        .replace(/(?:Council's dilemma — )?Starting with you, each player votes for Redhorn Pass or Mines of Moria\. For each Redhorn Pass vote, search your library for a basic land card and put it onto the battlefield tapped\. If you search your library this way, shuffle\. For each Mines of Moria vote, return a card from your graveyard to your hand\./g, '§caradhras.')
        .replace(/Look at the top (\w+) cards of your library\. Put (two|three) of them into your hand and the rest on the bottom of your library in (?:a random|any) order\./gi, (all, n, k) => `§digk ${num(n)} ${num(k)}.`)
        .replace(/Look at the top (\w+) cards of your library\. Put one of them into your hand and the rest (?:on the bottom of your library|into your graveyard) in (?:a random|any) order\./gi, (all, n) => `§dig ${num(n)} card hand.`)
        .replace(/Look at the top card of your library\. You may reveal that card\. If an? (instant or sorcery|creature|land|instant|sorcery) card is revealed this way, transform ~\./gi, (all, what) => `§revealxf ${what.toLowerCase().replace(/ /g, '_')}.`)
        .replace(/Mill (\w+) cards?\. You may put an? (permanent|creature|land|artifact|enchantment|creature or land|nonland) card from among them into your hand\./gi, (all, n, what) => `§millpick ${num(n)} ${what.toLowerCase().replace(/ /g, '_')}.`)
        .replace(/[Ll]ook at the top (\w+) cards of your library\. You may put one of (?:those|them) (?:cards )?back on top of your library\. Put the rest into your graveyard\./g, (all, n) => `§keeptop ${num(n)}.`)
        .replace(/Look at the top (\w+) cards of your library\. Put any number of them on the bottom(?: of your library)? and the rest (?:back )?on top(?: of your library)? in any order\./gi, (all, n) => `Scry ${num(n)}.`);
    // Starter kits (2026-10-06): more card-selection phrases as one token
    text = text.replace(/[Ll]ook at the top card of your library\. If it's a land card, you may put it onto the battlefield tapped\. Otherwise, put it into your hand\./g, '§toplandhand.')
        .replace(/[Rr]eveal cards from the top of your library until you reveal a land card\. Put that card onto the battlefield tapped and the rest on the bottom of your library in a random order\./g, '§revealland.')
        .replace(/[Ll]ook at the top (\w+) cards of your library\. You may put a land card from among them onto the battlefield tapped\. Put the rest on the bottom of your library in a random order\./g, (all, n) => `§digland ${num(n)}.`)
        .replace(/[Ll]ook at the top (\w+) cards of your library\. You may reveal an? (creature|land|artifact|instant or sorcery) card with mana value (\w+) or less from among them and put it into your hand\. Put the rest on the bottom of your library in a random order\./g, (all, n, what, mv) => `§dig ${num(n)} ${what.replace(/ /g, '_')}_mv${num(mv)} hand.`)
        .replace(/When you play a card this way, ~ deals (\w+) damage to each player\./g, (all, n) => `§playdmg ${num(n)}.`)
        .replace(/[Ee]ach player chooses a nonland permanent they control\. Return all nonland permanents not chosen this way to their owners' hands\. Then you draw a card for each opponent who has more cards in their hand than you\./g, '§tide.')
        .replace(/Target player draws cards equal to half the number of cards in their library and loses half their life\. Round up each time\./g, '§peer.')
        .replace(/look at the top two cards of your library, put them back in any order, then choose land or nonland\. An opponent guesses whether the top card of your library is the chosen kind\. Reveal that card\. If they guessed right, remove ~ from combat\. Otherwise, you draw a card and ~ can't be blocked this turn\./g, '§gollum.')
        .replace(/Sacrifice that token at end of combat\./g, '§sacendcombat.');
    // "When you do, ..." is a reflexive trigger: its target is chosen when it resolves (603.12)
    text = text.replace(/\. When you do, /g, '. If you do, §late ');
    const sentences = text.replace(/\.$/, '').split(/(?<=\.")\s+|\.\s+/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (let s of sentences) {
        const may = /^you may /i.test(s);
        s = s.replace(/^you may /i, '').replace(/^then,? /i, '');
        // "Until end of turn, X" reads like "X until end of turn"
        s = s.replace(/^until end of turn, (.+)$/i, (all, rest) => (/until end of turn$/i.test(rest) ? rest : `${rest} until end of turn`));
        // Flags on the effect before ("If that creature would die this turn, exile it instead", "Excess damage ...", "loses indestructible")
        if (out.length && /^(?:if (?:that creature|that creature or planeswalker|a creature dealt damage this way|it) would die this turn, exile it instead)$/i.test(s.replace(/\.$/, ''))) { out[out.length - 1].exileDies = true; continue; }
        if (out.length && /^excess damage is dealt to that creature's controller instead$/i.test(s.replace(/\.$/, ''))) { out[out.length - 1].excess = true; continue; }
        if (out.length && /^that creature loses indestructible until end of turn$/i.test(s.replace(/\.$/, ''))) { out[out.length - 1].noIndestr = true; continue; }
        { const sp = s.replace(/\.$/, '').match(/^spend this mana only to cast ([A-Za-z]+) spells and activate abilities of \1 sources$/i); if (sp && out.length && out[out.length - 1].t === 'addMana') { out[out.length - 1].only = sp[1][0].toUpperCase() + sp[1].slice(1).toLowerCase(); continue; } }
        if (out.length && /^if a permanent spell is countered this way, exile it instead of putting it into its owner's graveyard$/i.test(s.replace(/\.$/, '')) && out[out.length - 1].t === 'counter') { out[out.length - 1].exileCast = true; continue; }
        if (/^(?:you may )?cast that card without paying its mana cost for as long as it remains exiled$/i.test(s.replace(/\.$/, '')) && out.length && out[out.length - 1].exileCast) continue;
        if (out.length && /^if that creature is attacking, you may put it on top of its owner's library instead$/i.test(s.replace(/\.$/, ''))) { out[out.length - 1].topIfAttacking = true; continue; }
        { const bfm = s.replace(/\.$/, '').match(/^if ([^,]+), return that card to the battlefield instead$/i); if (bfm && out.length && parseCond(bfm[1])) { out[out.length - 1].bfIf = bfm[1]; continue; } }
        if (/^a creature destroyed this way can't be regenerated$/i.test(s.replace(/\.$/, ''))) continue;
        let ifDo = false, ifDont = false;
        if (/^if you do, /i.test(s)) { ifDo = true; s = s.replace(/^if you do, /i, ''); }
        let late = false;
        if (/^§late /.test(s)) { late = true; s = s.replace(/^§late /, '').replace(/^until end of turn, (.+)$/i, (all, rest) => (/until end of turn$/i.test(rest) ? rest : `${rest} until end of turn`)); }
        // Flags on the effect before (starter kits)
        { const pd = s.match(/^§playdmg (\d+)$/); if (pd && out.length && out[out.length - 1].t === 'exileTop') { out[out.length - 1].playDmg = +pd[1]; continue; } }
        if (s === '§sacendcombat' && out.length && out[out.length - 1].t === 'token') { out[out.length - 1].sacEndCombat = true; continue; }
        if (/^if the creature you control has trample, excess damage is dealt to that creature's controller instead$/i.test(s) && out.length) { out[out.length - 1].excessTrample = true; continue; }
        if (/^(?:untap it|it gains haste until end of turn)$/i.test(s) && out.some(e => e.t === 'steal')) continue;
        if (/^if they search their library this way, they shuffle$/i.test(s)) continue;
        if (/^if you don't, /i.test(s)) { ifDont = true; s = s.replace(/^if you don't, /i, ''); }
        // "up to two target creatures" -> one target, chosen up to two times
        let multi = 0, upToOne = false;
        if (/\bup to one (?:other )?target\b/i.test(s)) { upToOne = true; s = s.replace(/\bup to one (other )?target\b/i, (all, o) => `${o ? 'another ' : ''}target`); }
        s = s.replace(/\b(?:each of )?(?:up to|one or) (\w+) target (creatures your opponents control|creatures you control|creatures you don't control|creatures an opponent controls|artifacts and\/or enchantments|creatures|permanents|nonland permanents|artifacts|enchantments|lands)\b/i,
            (all, n, noun) => { multi = num(n) || 0; return `target ${noun.replace(/creatures your opponents control/, 'creature an opponent controls').replace(/creatures/, 'creature').replace(/permanents/, 'permanent').replace(/artifacts and\/or enchantments/, 'artifact or enchantment').replace(/artifacts/, 'artifact').replace(/enchantments/, 'enchantment').replace(/lands/, 'land')}`; })
            .replace(/to their owners' hands$/i, "to its owner's hand");
        if (multi) s = s.replace(/^target creature each gets? /i, 'target creature gets ').replace(/ and gain /i, ' and gains ');
        // Sentences with no effect here: regeneration doesn't exist, the folded "untap/haste" parts of a steal
        if (/^(?:it|they|a creature destroyed this way|creatures destroyed this way) can't be regenerated$/i.test(s)) { const last = out[out.length - 1]; if (last && ['destroy', 'wipe'].includes(last.t)) last.noRegen = true; continue; } // Mirrodin: Terror, Reiver Demon
        if (/^(?:untap that creature|it gains haste until end of turn|that creature gains haste until end of turn)$/i.test(s) && out.some(e => e.t === 'steal')) continue;
        if (/^(?:then )?shuffle$/i.test(s) || /^if you search your library this way, shuffle$/i.test(s)) continue;
        if (/^it's still a land$/i.test(s)) continue;
        s = s.replace(/§¶/g, '. ');
        // "it deals" on a permanent's own ability means the permanent; "If you do," after an optional cost: the AI always does
        s = s.replace(/^(?:it|he|she) deals /i, '~ deals ').replace(/^if you do, /i, '');
        if (!out.some(needsTarget)) s = s.replace(/^(?:it|he|she) (gets|gains|connives|can't be blocked)\b/i, '~ $1');
        if (!out.some(needsTarget) && !/with an? .+ on it$/i.test(s)) s = s.replace(/ on (?:it|him|her)$/i, ' on ~');
        if (/^(?:you may )?choose new targets for the copy$/i.test(s)) continue;
        s = s.replace(/ of their choice$/i, '').replace(/^each other player /i, 'each opponent ').replace(/ creature or planeswalker of their choice\./i, ' creature or planeswalker.');
        if (/^if that spell is countered this way, exile it instead of putting it into its owner's graveyard$/i.test(s)) { const pc = [...out].reverse().find(e => e.t === 'counter'); if (pc) { pc.exileIt = true; continue; } }
        let kicked = false;
        const km = s.match(/^if (?:~|it) was kicked, (.+)$/i);
        if (km) {
            s = km[1]; kicked = true;
            // "If it was kicked, it deals 4 damage instead": the earlier damage changes
            const inst = s.match(/^(?:~|it) deals (\w+) damage instead$/i);
            const prev = [...out].reverse().find(e => e.t === 'dmg');
            if (inst && prev) { prev.kickedN = num(inst[1]); continue; }
            if (/^create five of those tokens instead$/i.test(s)) { const tc = [...out].reverse().find(e => e.t === 'tokenCopy'); if (tc) { tc.kickedN = 5; continue; } }
            const kd = s.match(/^draw (\w+) cards? instead$/i), kdp = [...out].reverse().find(e => e.t === 'draw');
            if (kd && kdp) { kdp.kickedN = num(kd[1]); continue; }
            const kp = s.match(/^(?:that creature|it|target creature) gets \+(\d+)\/\+(\d+) until end of turn instead$/i), kpp = [...out].reverse().find(e => e.t === 'pump');
            if (kp && kpp) { kpp.kickedP = { p: +kp[1], q: +kp[2] }; continue; }
            // Tear Asunder: "exile target nonland permanent instead"
            const kx = s.match(/^(exile|destroy) target ([a-z ]+?) instead$/i), kxp = kx && [...out].reverse().find(e => e.t === kx[1].toLowerCase() && needsTarget(e));
            if (kx && kxp) { kxp.kickedFilter = kx[2]; continue; }
        }
        // "If you control three or more artifacts, ..." / "If a creature died this turn, ... instead" (conditions, round 6)
        let cond = null, instead = false;
        const tail = !kicked && s.match(/^(?:~|it) deals (\w+) damage(?: to (?:that creature|that player|that permanent|it|each opponent|any target))? instead if (.+)$/i);
        if (tail && parseCond(tail[2])) { const prev = [...out].reverse().find(e => e.t === 'dmg'); if (prev && num(tail[1]) !== undefined) { prev.condN = { cond: tail[2], n: num(tail[1]) }; continue; } }
        let unless = 0, condNot = null;
        const un = s.match(/^(.+?) unless (you attacked this turn|you control .+|it's your turn)$/i);
        if (un && parseCond(un[2])) { s = un[1]; condNot = un[2]; }
        const um = s.match(/^(.+?) unless (?:that player|they) pays? \{(\d+)\}$/i);
        if (um) { s = um[1]; unless = Number(um[2]); }
        const ux = s.match(/^(.+?) unless that player pays \{X\}, where X is ~'s power$/i);
        if (ux) { s = ux[1]; unless = 'pow'; }
        { const ti = s.match(/^(add .+|that creature gets .+|it gets .+) instead if (.+)$/i); if (ti && parseCond(ti[2])) s = `If ${ti[2]}, ${ti[1]} instead`; }
        const cm = !kicked && s.match(/^if ([^,]+), (.+)$/i);
        if (cm && parseCond(cm[1])) {
            cond = cm[1]; s = cm[2].replace(/^you may /i, '');
            if (/ instead$/i.test(s)) {
                instead = true;
                const inst = s.match(/^(?:~|it) deals (\w+) damage(?: to (?:that creature|that player|that permanent|it|each opponent|any target))? instead$/i);
                const prev = [...out].reverse().find(e => e.t === 'dmg');
                if (inst && prev && num(inst[1]) !== undefined) { prev.condN = { cond, n: num(inst[1]) }; continue; }
                s = s.replace(/ instead$/i, '');
            }
        }
        if (!cond && !kicked) { const tc = s.match(/^(.+) if (.+)$/i); if (tc && parseCond(tc[2]) && !EFFECTS.some(([re]) => re.test(s) || re.test(s.toLowerCase())) && EFFECTS.some(([re]) => re.test(tc[1]) || re.test(tc[1].toLowerCase()))) { cond = tc[2]; s = tc[1]; } }
        // "~ deals 3 damage to target creature and 2 damage to you" etc. aren't handled
        // The whole sentence first ("untap target creature and gain control of it..."), then its "and" parts
        const whole = EFFECTS.find(([re]) => re.test(s.replace(/\.$/, '')) || re.test(s.replace(/\.$/, '').toLowerCase()));
        const parts = whole ? [s] : s.split(/,? and (?=(?:you |draw |gain |each opponent |~ |put |create |scry |it can't be blocked))/i);
        for (const part of parts) {
            let p = part.trim().replace(/\.$/, '');
            if (!out.some(needsTarget) && !/with an? .+ on it$/i.test(p)) p = p.replace(/ on (?:it|him|her)$/i, ' on ~').replace(/^(untap|sacrifice|exile) (?:it|him|her)$/i, '$1 ~').replace(/^it can't be blocked this turn$/i, "~ can't be blocked this turn");
            if (out.some(needsTarget) && /^it can't be blocked this turn$/i.test(p)) { out.push({ t: 'pump', p: 0, q: 0, kw: ['unblockable'], target: 'last', good: true }); continue; }
            let hit = null;
            for (const [re, make] of EFFECTS) {
                const m = p.match(re) || p.toLowerCase().match(re);
                if (m) { const h = make(m); if (h) { hit = h; break; } }
            }
            // Phase 2b: the token reader, only for sentences no pattern above read
            if (!hit && typeof tokenReadSentence === 'function') hit = tokenReadSentence(p);
            // "Tap target creature. ... exile that creature" / "put a +1/+1 counter on it": the creature targeted earlier
            if (!hit && out.some(needsTarget) && /\b(?:that creature|that permanent|it)\b/i.test(p)) {
                const p2 = p.replace(/\bthat creature\b|\bit\b(?! (?:gets|gains|deals|can't))/i, 'target creature').replace(/\bthat permanent\b/i, 'target permanent').replace(/^it (gets|gains)/i, 'target creature $1');
                for (const [re, make] of EFFECTS) { const m = p2.match(re) || p2.toLowerCase().match(re); if (m) { const h = make(m); if (h && !Array.isArray(h) && needsTarget(h)) { hit = { ...h, target: 'last' }; } break; } }
            }
            // "A, then B" / "A, B, then C": read the parts on their own
            if (!hit && /,? then |, /.test(p)) {
                const bits = p.split(/,? then |, (?=(?:draw|discard|untap|put|create|you|scry|surveil|exile|return|populate|mill|target|each)\b)/i).map(x => x.trim()).filter(Boolean);
                const parsed = bits.length > 1 ? bits.map(b => parseEffects(b)) : null;
                if (parsed && parsed.every(Boolean)) { parsed.flat().forEach(h => { if (may) h.may = true; if (cond) h.cond = cond; out.push(h); }); continue; }
            }
            // A wording that gives several effects at once
            if (Array.isArray(hit)) { if (!hit.every(h => h && !(h.kw && !allKnown(h.kw)))) return null; hit.forEach(h => { if (may) h.may = true; if (cond) h.cond = cond; if (ifDo) h.ifDo = true; if (ifDont) h.ifDont = true; if (kicked) h.kicked = true; out.push(h); }); continue; }
            if (!hit || (hit.n === undefined && 'n' in hit) || (hit.kw && !allKnown(hit.kw))) return null;
            if (kicked) hit.kicked = true;
            if (cond && instead) { const prev = [...out].reverse().find(e => e.t === hit.t) || out[out.length - 1]; if (!prev) return null; if (prev.t === hit.t && hit.n !== undefined && (hit.target === 'last' || !needsTarget(hit))) { prev.condN = { cond, n: hit.n }; continue; } prev.alt = { cond, e: hit.target === 'last' && needsTarget(prev) ? { ...hit, target: prev.target, only: prev.only, mine: prev.mine, filter: prev.filter } : hit }; continue; }
            if (cond) hit.cond = cond;
            if (upToOne && needsTarget(hit)) hit.optional = true;
            if (condNot) hit.condNot = condNot;
            if (late) hit.late = true;
            if (unless) hit.unless = unless;
            if (may) hit.may = true;
            if (ifDo) hit.ifDo = true;
            if (ifDont) hit.ifDont = true;
            if (multi > 1 && needsTarget(hit)) hit.multi = multi;
            // "You may play it this turn" belongs to the exile before it
            if (hit.t === 'playExiled') { const prev = out[out.length - 1]; if (!prev || prev.t !== 'exileTop') return null; prev.play = hit.whileSrc ? 1e6 : hit.next ? 2 : 0; if (hit.whileSrc) prev.playWhile = true; continue; }
            out.push(hit);
            if (hit.then) { if (kicked) hit.then.kicked = true; out.push(hit.then); delete hit.then; }
        }
    }
    // Mirrodin: "It can't be regenerated" marks the destroy before it
    for (let i = 1; i < out.length; i++) if (out[i].t === 'noRegen') { out[i - 1].noRegen = true; out.splice(i, 1); i--; }
    for (let i = 0; i < out.length; i++) if (out[i].t === 'noop' && out.length > 1) { out.splice(i, 1); i--; }
    // "Create two 1/1 Spirit tokens. They gain haste until end of turn": the tokens just made get it (top-1000 round 2)
    for (let i = 1; i < out.length; i++) if (out[i].t === 'lastAllKw' && out[i - 1].t === 'token') { out[i - 1].tkw = out[i].kw; out.splice(i, 1); i--; }
    return out.length ? out : null;
}

function rulesFor(card) {
    if (card._r) return card._r;
    const R = { kind: 'other', kw: new Set(), etb: [], spell: null, mana: null, entersTapped: false, buff: null, equip: null, aura: false, unhandled: [], support: 'full', why: '',
        acts: [], trig: [], statics: [], modes: null, etbModes: null, etbCounters: 0, crew: null, cycling: null, ward: 0, uncounterable: false };
    const t = card.type || '';
    R.kind = /\bLand\b/.test(t) && !/\bCreature\b/.test(t) ? 'land'
        : /\bCreature\b/.test(t) ? 'creature'
        : /\bPlaneswalker\b/.test(t) ? 'planeswalker'
        : /\bBattle\b/.test(t) ? 'battle'
        : /\bInstant\b/.test(t) ? 'instant'
        : /\bSorcery\b/.test(t) ? 'sorcery'
        : /\bArtifact\b/.test(t) ? 'artifact'
        : /\bEnchantment\b/.test(t) ? 'enchantment' : 'other';
    R.cost = parseCost(card.cost || '');
    R.legendary = /\bLegendary\b/.test(t);
    R.isAura = /\bAura\b/.test(t);
    R.isEquipment = /\bEquipment\b/.test(t);
    let text = (card.text || '').replace(/\([^)]*\)/g, '');
    const first = card.name.split(/[ ,]/)[0];
    const two = card.name.split(/[ ,]/).slice(0, 2).join(' ');
    const names = [card.name, card.name.split(',')[0], ...(/Legendary/.test(card.type || '') && / of /.test(card.name) && two !== card.name ? [two] : []), ...(/Legendary/.test(card.type || '') && first.length > 3 && !/^(?:The|Lord|Lady|King|Queen|Sir|Doctor|Captain)$/.test(first) ? [first] : [])].filter((v, i, a) => v && a.indexOf(v) === i);
    // Whole words only, so a short name can't match inside another word (audit, 2026-10-06)
    names.filter(Boolean).forEach(n => { text = text.replace(new RegExp(`(?<![A-Za-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g'), '~'); });
    text = text.replace(/\bthis (?:creature|spell|land|artifact|enchantment|card|permanent|Aura|Equipment|Vehicle|Saga|planeswalker|token|Class|Room|Case|Spacecraft|Siege|battle)\b/gi, '~');
    text = text.replace(/^((?:\{[^}]+\})+), \{T\} or ((?:\{[^}]+\})+), \{T\}: (.+)$/gm, '$1, {T}: $3\n$2, {T}: $3'); // Mirrodin's Shards
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    // Starter kits (2026-10-06): "... and is a Cleric in addition to its other types" adds a creature type;
    // "gets +2/+2, has trample and haste" reads as "gets +2/+2 and has trample and haste"
    for (let k = 0; k < lines.length; k++) {
        let l = lines[k], mm;
        if (/^Celebration — /.test(l)) l = l.replace(/^Celebration — /, '');
        // Sandman deck (2026-10-07): named Saga chapters ("I — Crescent Fang — ..."), "a +1/+1 counter on him"
        // Gitrog deck: "counters on him", "he deals"
        l = l.replace(/ counters? on (?:him|her)\./, m0 => m0.replace(/him|her/, 'it')).replace(/(^|, )(?:he|she) (deals|gets|gains)\b/g, '$1~ $2');
        l = l.replace(/^((?:I|II|III|IV|V|VI)(?:, (?:I|II|III|IV|V|VI))*) — [A-Z][A-Za-z' ,-]{1,40}? — /, '$1 — ').replace(/ counters? on (?:him|her) for each /, m0 => m0.replace(/him|her/, 'it'));
        if ((mm = l.match(/^((?:Equipped|Enchanted) creature .+?),? and is an? ([A-Z][a-z]+) in addition to its other types\.$/))) { R.addType = mm[2]; l = `${mm[1]}.`; }
        l = l.replace(/^((?:Equipped|Enchanted) creature gets [+-]\d+\/[+-]\d+), has /, '$1 and has ').replace(/,"\.$/, '."');
        if (/^As long as .+ and can't be blocked\.$/.test(l)) l = l.replace(/ and can't be blocked\.$/, ' and has unblockable.');
        // "As long as ~ has two or more counters on it, it has first strike and is an Assassin in addition to its other types."
        if ((mm = l.match(/^As long as (.+?), (?:it|~) has ([a-z ,]+) and is an? ([A-Z][a-z]+) in addition to its other types\.$/)) && parseCond(mm[1]) && allKnown(splitKw(mm[2]))) { (R.selfCond = R.selfCond || []).push({ cond: mm[1], p: 0, q: 0, kw: splitKw(mm[2]), addType: mm[3] }); l = '§done'; }
        // Goddric: "As long as ..., ~ is a Dragon with base power and toughness 4/4, flying, and "{R}: Dragons you control get +1/+0 until end of turn.""
        if ((mm = l.match(/^As long as (.+?), ~ is an? ([A-Z][a-z]+) with base power and toughness (\d+)\/(\d+), ([a-z ,]+?),? and "(.+?)"\.?$/)) && parseCond(mm[1])) {
            const act = parseActivated(mm[6].replace(/\.$/, '.'), R);
            if (act && allKnown(splitKw(mm[5]))) { R.selfCond = R.selfCond || []; R.selfCond.push({ cond: mm[1], p: 0, q: 0, kw: [], base: { p: +mm[3], q: +mm[4] } }, { cond: mm[1], p: 0, q: 0, kw: splitKw(mm[5]), addType: mm[2] }); (R.condActs = R.condActs || []).push({ cond: mm[1], act }); l = '§done'; }
        }
        lines[k] = l;
    }
    // X spells (2026-10-06): the X in the text is read as a placeholder number (X_PH) so every
    // effect the game knows works with X; the parsed effects are marked (xMark) and the X paid
    // is filled in when the spell resolves (withX).
    if (R.cost.x) for (let k = 0; k < lines.length; k++) lines[k] = xSub(lines[k]);
    for (let li = 0; li < lines.length; li++) {
        // Ability words ("Landfall —", "Metalcraft —") are just labels (207.2c)
        const line = lines[li].replace(/^(?!Choose\b)(?!(?:I|II|III|IV|V|VI)(?:,| —))[A-Z][A-Za-z'!-]*(?: [A-Za-z'!-]+){0,4} — (?=When|Whenever|At |\{|[A-Z~])/, '');
        let m;
        if (line === '§done') continue;
        // Modal triggers: "Whenever you cast a creature spell, choose one —", "At the beginning of combat on your turn, choose up to one —"
        if ((m = lines[li].match(/^(.+?), choose (one|up to one) —$/)) && !/^(?:When ~ enters(?: the battlefield)?|At the beginning of your upkeep)$/.test(m[1]) && lines[li + 1] && lines[li + 1].startsWith('•')) {
            const bullets = [];
            while (li + 1 < lines.length && lines[li + 1].startsWith('•')) bullets.push(lines[++li].replace(/^•\s*/, '').replace(/^[A-Z][A-Za-z'-]+(?: [A-Za-z'-]+){0,3} — /, ''));
            const modes = bullets.map(b => parseEffects(b));
            const modal = { t: 'modal', modes, n: 1, min: m[2] === 'up to one' ? 0 : 1 };
            const both = m[1].match(/^Whenever ~ enters or attacks$/);
            const trig = !both && parseTrigger(`${m[1]}, draw a card.`);
            if (modes.length && modes.every(Boolean) && (both || trig)) {
                if (both) { R.etb.push(modal); R.trig.push({ ev: 'attacks', effects: [modal] }); }
                else R.trig.push(...trig.map(tr => ({ ...tr, effects: [modal] })));
                continue;
            }
            R.unhandled.push(lines[li - bullets.length], ...bullets); continue;
        }
        // Modal: "Choose one —" (or "When ~ enters, choose one —") and its bullet lines
        // "Choose one. If you control a commander as you cast ~, you may choose both instead." (Akroma's Will)
        if (/^Choose one\. If you control a commander as you cast ~, you may choose both instead\.$/.test(line)) lines[li] = 'Choose one —', R.modeCmdBoth = true;
        if ((m = lines[li].match(/^(?:(When ~ enters(?: the battlefield)?|At the beginning of your upkeep), )?choose (one|one or both|two|three|one or more|up to one|up to two) ?—$/i))) {
            const bullets = [];
            while (li + 1 < lines.length && lines[li + 1].startsWith('•')) bullets.push(lines[++li].replace(/^•\s*/, '').replace(/^[A-Z][A-Za-z'-]+(?: [A-Za-z'-]+){0,3} — /, ''));
            const modes = bullets.map(b => parseEffects(b));
            if (modes.length && modes.every(Boolean)) {
                if (m[1] && /^At the beginning of your upkeep$/.test(m[1])) { R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'modal', modes, n: 1 }] }); continue; }
                if (m[1]) R.etbModes = modes; else R.modes = modes;
                const cnt = { one: [1, 1], 'up to one': [1, 1], two: [2, 2], three: [3, 3], 'one or both': [1, 2], 'up to two': [1, 2], 'one or more': [1, modes.length] }[m[2].toLowerCase()];
                R.modeN = { min: Math.min(cnt[0], modes.length), max: Math.min(R.modeCmdBoth ? 2 : cnt[1], modes.length) };
                continue;
            }
            R.unhandled.push(line, ...bullets);
            continue;
        }
        if ((m = line.match(/^([^:"]+): Choose one —$/)) && lines[li + 1] && lines[li + 1].startsWith('•')) {
            const bullets = [];
            while (li + 1 < lines.length && lines[li + 1].startsWith('•')) bullets.push(lines[++li].replace(/^•\s*/, '').replace(/^[A-Z][A-Za-z'-]+(?: [A-Za-z'-]+){0,3} — /, ''));
            const modes = bullets.map(b => parseEffects(b));
            const act = modes.every(Boolean) && parseActivated(`${m[1]}: Draw a card.`, R);
            if (act) { act.effects = [{ t: 'modal', modes, n: 1 }]; act.text = line; R.acts.push(act); continue; }
            R.unhandled.push(line, ...bullets); continue;
        }
        // Daybound / nightbound (702.145), played like the older werewolves: day ends when a turn has no spells
        if (/^(Daybound|Nightbound)$/.test(line)) {
            R.trig.push({ ev: 'upkeep', who: 'each', cond: line === 'Daybound' ? 'no spells were cast last turn' : 'a player cast two or more spells last turn', effects: [{ t: 'transform' }] });
            R.approx = 'Day and night are tracked per card: it transforms at an upkeep after a turn with no spells (or back after a player casts two).';
            continue;
        }
        // Conditional abilities of this permanent: "As long as you have 30 or more life, ~ gets +5/+5 and has flying."
        if ((m = line.match(/^As long as ([^,]+), ~ (?:gets \+(\d+)\/\+(\d+)(?: and has ([a-z ,]+))?|has ([a-z ,]+)|isn't a creature)\.$/)) && parseCond(m[1])) {
            const kw = m[4] || m[5] ? splitKw(m[4] || m[5]) : [];
            if (allKnown(kw)) { (R.selfCond = R.selfCond || []).push({ cond: m[1], p: +(m[2] || 0), q: +(m[3] || 0), kw, notCreature: /isn't a creature\.$/.test(line) }); continue; }
        }
        if ((m = line.match(/^~ (?:gets \+(\d+)\/\+(\d+)(?: and has ([a-z ,]+))?|has ([a-z ,]+)) as long as ([^,]+)\.$/)) && parseCond(m[5])) {
            const kw = m[3] || m[4] ? splitKw(m[3] || m[4]) : [];
            if (allKnown(kw)) { (R.selfCond = R.selfCond || []).push({ cond: m[5], p: +(m[1] || 0), q: +(m[2] || 0), kw }); continue; }
        }
        if ((m = line.match(/^As long as ([^,]+), (other )?creatures you control get \+(\d+)\/\+(\d+)(?: and have ([a-z ,]+))?\.$/)) && parseCond(m[1]) && (!m[5] || allKnown(splitKw(m[5])))) {
            R.statics.push({ other: !!m[2], type: null, p: +m[3], q: +m[4], kw: m[5] ? splitKw(m[5]) : [], cond: m[1] }); continue;
        }
        // "If you control a commander, you may cast ~ without paying its mana cost."
        // The special-case lines each round of card-reader work added (spellslinger/rules/*.js), tried in the order they were added
        { const ctx = { R, card, lines, t, line, li }; if (runLinePacks(ctx)) { li = ctx.li; continue; } }
        if ((m = line.match(/^Flashback ((?:\{[^}]+\})+)$/))) { R.flashback = parseCost(m[1]); continue; }
        // Overload (702.96): "target" becomes "each" - read the spell again with that wording
        if ((m = line.match(/^Overload ((?:\{[^}]+\})+)$/))) {
            const body = lines.filter(l => l !== lines[li] && !/^Overload /.test(l)).join(' ')
                .replace(/~ deals (\w+) damage to target creature/g, '~ deals $1 damage to each creature')
                .replace(/Target creature you control gets ([^.]+?) and gains /g, 'Creatures you control get $1 and gain ').replace(/Target creature you control gets /g, 'Creatures you control get ')
                .replace(/\btarget ((?:nonland |noncreature )?(?:permanent|creature|artifact|enchantment|artifact or enchantment))( you don't control| your opponents control| an opponent controls)?/g, (all, w, ctl) => `all ${w.replace(/artifact or enchantment/, 'artifacts and enchantments').replace(/(permanent|creature|artifact|enchantment)$/, '$1s')}${ctl ? " you don't control" : ''}`)
                .replace(/to its owner's hand/g, "to their owners' hands").replace(/\s*(?:It|They|A creature destroyed this way) can't be regenerated\./g, '');
            const fx = parseEffects(body);
            const c = parseCost(m[1]);
            if (fx && !c.x && !c.odd && !fx.some(needsTarget)) { R.overload = { cost: c, spell: fx, text: m[1] }; continue; }
        }
        if ((m = line.match(/^Cycling ((?:\{[^}]+\})+)$/))) { R.cycling = parseCost(m[1]); continue; }
        if (/^~ can't block\.$/.test(line)) { R.kw.add('cantblock'); continue; }
        if (/^~ can't be blocked\.$/.test(line)) { R.kw.add('unblockable'); continue; }
        if (/^~ can't attack or block\.$/.test(line)) { R.kw.add('cantblock'); R.kw.add('cantattack'); continue; }
        if (/^~ can't be countered\.$/.test(line)) { R.uncounterable = true; continue; }
        // Commander's Plate: protection from the colors outside your commander's color identity
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) and has protection from each color that's not in your commander's color identity\.$/))) { R.buff = { p: +m[1], q: +m[2], kw: [] }; R.plateProt = true; continue; }
        if ((m = line.match(/^Equipped creature has ward \{(\d+)\}, is an? ([A-Z][a-z]+) in addition to its other types, and can't be blocked\.$/))) { R.buff = { p: 0, q: 0, kw: [`ward:${m[1]}`, 'unblockable'] }; R.addType = m[2]; continue; }
        // "Protection from Humans" (702.16): from sources of that creature type
        if ((m = line.match(/^Protection from ([A-Z][a-z]+?)s$/))) { (R.proTypes = R.proTypes || []).push(m[1]); continue; }
        if ((m = line.match(/^(?:Metalcraft — )?Equipment you control have equip \{0\} as long as (you control three or more artifacts)\.$/)) && parseCond(m[1])) { R.equipZeroIf = parseCond(m[1]); continue; }
        if ((m = line.match(/^(Creature )?[Ss]pells you control can't be countered\.$/))) { R.spellsUncounterable = m[1] ? 'creature' : 'all'; continue; }
        if (/^~ doesn't untap during your untap step\.$/.test(line)) { R.kw.add('nountap'); continue; }
        if ((m = line.match(/^~ enters(?: the battlefield)? with (\w+) \+1\/\+1 counters? on it\.$/)) && num(m[1]) > 0) { R.etbCounters = num(m[1]); continue; }
        // Lords and anthems: "Other Elves you control get +1/+1", "Creatures you control have flying"
        if ((m = line.match(/^(Other )?(.+?) you control get \+(\d+)\/\+(\d+)(?: and have ([a-z ,]+))?\.$/))) {
            const type = lordType(m[2]);
            if (type !== undefined && (!m[5] || allKnown(splitKw(m[5])))) { R.statics.push({ other: !!m[1], type, p: +m[3], q: +m[4], kw: m[5] ? splitKw(m[5]) : [] }); continue; }
        }
        if ((m = line.match(/^(Other |All )?([A-Z][a-z]+?)(?: creatures)? get \+(\d+)\/\+(\d+)(?: and have ([a-z ,]+))?\.$/)) && !/you control/.test(line)) {
            const type = /^creatures$/i.test(m[2]) ? null : lordType(m[2]);
            if (type !== undefined && (!m[5] || allKnown(splitKw(m[5])))) { R.statics.push({ other: m[1] === 'Other ', type, p: +m[3], q: +m[4], kw: m[5] ? splitKw(m[5]) : [], global: true }); continue; }
        }
        if ((m = line.match(/^(Other )?(.+?) you control have ([a-z ,]+)\.$/))) {
            const type = lordType(m[2]);
            if (type !== undefined && allKnown(splitKw(m[3]))) { R.statics.push({ other: !!m[1], type, p: 0, q: 0, kw: splitKw(m[3]) }); continue; }
        }
        // Triggered abilities (other than "when this enters", read below)
        const trig = parseTrigger(line);
        if (trig) {
            // "... return ~ from your graveyard to your hand" triggers while the card is in the graveyard
            if (trig.every(tr => tr.effects.some(e => e.t === 'returnSelfGy'))) (R.gyTrig = R.gyTrig || []).push(...trig); else R.trig.push(...trig);
            continue;
        }
        // Activated abilities, planeswalker loyalty abilities first
        if (R.kind === 'planeswalker' && (m = line.match(/^([+−-]?)(\d+): (.+)$/))) {
            const fx = parseEffects(m[3]);
            if (fx) { R.acts.push({ loyalty: (m[1] === '+' ? 1 : m[1] ? -1 : 0) * Number(m[2]), effects: fx, text: line, sorcery: true }); continue; }
        }
        // Plain mana abilities ({T}: Add ...) make the permanent a mana source, read before other activated abilities
        if ((m = line.match(/^\{T\}(?:, Pay (\d+) life)?: Add (.+?)\.( ~ deals (\d+) damage to you\.)?( Spend this mana only .+)?$/))) {
            let lm;
            const prevMana = R.mana;
            const p = parseManaProduce(m[2]);
            if (p && p.among && R.mana && R.mana.limit) { R.mana.limit.among = p.among; continue; } // Plaza of Heroes
            if (p) {
                if (m[4] && R.mana && !R.mana.pain) {
                    // Painland: the free colors stay free, the new ones cost life
                    p.pain = { colors: p.colors.filter(c => !R.mana.colors.includes(c)), life: Number(m[4]) };
                    p.colors = [...new Set([...R.mana.colors, ...p.colors])];
                } else if (m[4]) p.pain = { colors: p.colors.slice(), life: Number(m[4]) };
                R.mana = p;
                if (m[1]) p.life = Number(m[1]);
                if (p.approx) R.approx = 'Taps for any color here (an approximation).';
                if (m[5] && /only to cast an instant or sorcery spell/.test(m[5])) p.only = 'instant or sorcery';
                else if (m[5] && /only to cast a creature spell\.$/.test(m[5])) p.only = 'creature';
                else if (m[5] && /only to cast an Equipment spell or activate an equip ability\.$/.test(m[5])) p.onlyType = 'Equipment';
                else if (m[5] && (lm = m[5].match(/^ Spend this mana only to cast (a legendary spell|a creature spell of the chosen type)( or activate an ability of a creature source of the chosen type)?(, and that spell can't be countered)?\.$/))) {
                    // Cavern of Souls, Secluded Courtyard, Delighted Halfling: the earlier "{T}: Add {C}" stays free, the new colors are limited
                    p.limit = { test: /legendary/.test(lm[1]) ? 'legendary' : lm[2] ? 'chosenOrAbil' : 'chosen', free: prevMana ? prevMana.colors.slice() : [], uncounter: !!lm[3] };
                    if (prevMana) p.colors = [...new Set([...prevMana.colors, ...p.colors])];
                }
                else if (m[5]) R.approx = 'The "spend this mana only" limit isn\'t checked.';
                continue;
            }
        }
        // Treasure: "{T}, Sacrifice ~: Add one mana of any color." is a mana source, read before other activated abilities
        if (/^\{T\}, Sacrifice ~: Add one mana of any color\.$/.test(line) && !R.mana) { R.mana = { colors: [...COLORS], n: 1, sac: true }; continue; }
        const act = parseActivated(line, R);
        if (act) {
            if (/^Power-up — /.test(lines[li])) act.powerUp = true; // once only; costs less by its mana cost the turn it entered
            if (/^Boast — /.test(lines[li])) { act.once = true; act.onlyIf = '~ attacked this turn'; } // boast (702.142)
            if (act.hand) (R.handActs = R.handActs || []).push(act); else if (act.gy) (R.gyActs = R.gyActs || []).push(act); else R.acts.push(act);
            continue;
        }
        if (/^\{T\}: For each color among permanents you control, add one mana of that color\.$/.test(line)) { R.mana = { colors: [...COLORS], n: 1, among: 'permanents', each: true }; continue; } // Bloom Tender, Faeburrow Elder
        // Signets ({1}, {T}: Add two colors): played as one mana of either color
        if ((m = line.match(/^\{1\}, \{T\}: Add \{([WUBRGC])\}\{([WUBRGC])\}\.$/))) { R.mana = { colors: [...new Set([m[1], m[2]])], n: 1 }; R.approx = 'Plays as one mana of either color (the {1} it filters isn\'t modeled).'; continue; }
        // Fetch lands: played as a land that taps for the colors it could fetch
        if (R.kind === 'land' && (m = line.match(/^\{T\}, (?:Pay 1 life, )?Sacrifice ~: Search your library for (?:an? )?(basic land|\w+ or \w+) card/))) {
            const types = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
            const cols = m[1] === 'basic land' ? [...COLORS] : m[1].split(' or ').map(x => types[x]).filter(Boolean);
            if (cols.length) { R.mana = { colors: cols, n: 1 }; R.approx = 'Fetching isn\'t automated: this plays as a land that taps for the colors it could fetch.'; continue; }
        }

        if ((m = line.match(/^\{T\}: Add \{([WUBRGC])\}\. If that mana is spent on a Dragon creature spell, it gains haste until end of turn\.$/))) { R.mana = { colors: [m[1]], n: 1, hasteDragon: true }; continue; }
        if (/^~ enters tapped\.$/.test(line)) { R.entersTapped = true; continue; }
        // Shock lands and pathway-style MDFC lands: pay N life or it enters tapped (you choose; the AI pays when it has a play)
        if (R.kind === 'land' && (m = line.match(/^As ~ enters(?: the battlefield)?, you may pay (\d+) life\. If you don't, it enters tapped\.$/))) { R.shockLife = +m[1]; continue; }
        // Reveal lands ("you may reveal an Island or Swamp card from your hand"): untapped when you hold one
        if (R.kind === 'land' && (m = line.match(/^As ~ enters(?: the battlefield)?, you may reveal an? (\w+) or (\w+) card from your hand\. If you don't, ~ enters tapped\.$/))) { R.revealTypes = [m[1], m[2]]; continue; }
        if (/^You may play an additional land on each of your turns\.$/.test(line)) { R.extraLand = 1; continue; }
        if (/^You have no maximum hand size\.$/.test(line)) { R.noMaxHand = true; continue; }
        if (R.kind === 'land' && /^~ enters tapped unless/.test(line)) { R.entersTapped = true; continue; } // approximation
        if ((m = line.match(/^When ~ enters(?: the battlefield)?, (.+)$/))) { const fx = parseEffects(m[1]); if (fx) { R.etb.push(...fx); continue; } }
        if ((m = line.match(/^When(?:ever)? ~ enters(?: the battlefield)? or attacks, (.+)$/))) { const fx = parseEffects(m[1]); if (fx) { R.etb.push(...fx); R.trig.push({ ev: 'attacks', effects: fx }); continue; } }
        if ((R.kind === 'instant' || R.kind === 'sorcery')) {
            const fx = parseEffects(line);
            if (fx) { R.spell = (R.spell || []).concat(fx); R._spellText = `${R._spellText || ''} ${line}`; continue; }
            // A later line that refers back ("Metalcraft — ... deals 4 damage instead", "... exile that creature"): read it with the lines before it
            if (R.spell && R._spellText) { const all = parseEffects(`${R._spellText.trim()} ${line}`); if (all) { R.spell = all; R._spellText += ` ${line}`; continue; } }
        }
        if (/^Enchant creature$/i.test(line)) { R.aura = true; continue; }
        if (/^Enchant creature you control$/i.test(line)) { R.aura = true; R.auraMine = true; continue; }
        if (/^Enchanted creature can't attack or block(?:, and its activated abilities can't be activated)?\.$/i.test(line)) { R.buff = { p: 0, q: 0, kw: ['cantattack', 'cantblock'] }; R.buffBad = true; continue; }
        if (/^Enchanted creature can't block\.$/i.test(line)) { R.buff = { p: 0, q: 0, kw: ['cantblock'] }; R.buffBad = true; continue; }
        if (/^Enchanted creature doesn't untap during its controller's untap step\.$/i.test(line)) { R.buff = { p: 0, q: 0, kw: ['nountap'] }; R.buffBad = true; continue; }
        if ((m = line.match(/^(?:Enchanted|Equipped) creature gets ([+-]\d+)\/([+-]\d+)(?: and has ([a-z ,]+))?\.$/i)) && (!m[3] || allKnown(splitKw(m[3])))) { R.buff = { p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [] }; continue; }
        if ((m = line.match(/^(?:Enchanted|Equipped) creature has ([a-z ,]+)\.$/i)) && allKnown(splitKw(m[1]))) { R.buff = { p: 0, q: 0, kw: splitKw(m[1]) }; continue; }
        if ((m = line.match(/^Equip (legendary creature|commander|[A-Z][a-z]+) ((?:\{[^}]+\})+)$/))) { R.equipCheap = { type: m[1], cost: parseCost(m[2]) }; continue; }
        if ((m = line.match(/^Equip ((?:\{[^}]+\})+)$/))) { const c = parseCost(m[1]); if (!c.x && !c.odd) { R.equip = c; R.equipText = m[1]; continue; } }
        R.unhandled.push(line);
    }
    if (R.cost.x) xMarkRules(R);
    if ((R.spell || []).some(e => e.t === 'detonate')) R.xFromTarget = true; // Detonate: X is the artifact's mana value
    if (R._kwBefore) { R.backupKw = [...R.kw].filter(k => !R._kwBefore.has(k)); delete R._kwBefore; }
    if (R.cloneX && R.cost.x) R.etbCounters = R.etbCounters || 0;
    // Basic land types tap for their color (the reminder text was stripped)
    if (R.kind === 'land' || /\bLand\b/.test(t)) {
        const types = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
        const cols = Object.keys(types).filter(k => new RegExp(`\\b${k}\\b`).test(t)).map(k => types[k]);
        if (cols.length) R.mana = { colors: [...new Set([...(R.mana ? R.mana.colors : []), ...cols])], n: 1 };
        if (/\bWastes\b/.test(card.name)) R.mana = { colors: ['C'], n: 1 };
    }
    // How much of it works
    const numeric = v => v !== undefined && /^\d+$/.test(String(v));
    const xOk = R.cost.x && (((R.kind === 'instant' || R.kind === 'sorcery') && (R.spell || []).some(e => e.n === 'X' || e.p === 'X')) || R.etbCounters === 'X' || R.etbNamedX || R.etb.some(e => e.n === 'X') || R.cloneX || hasXMark([R.spell, R.modes, R.etb, R.etbModes, R.trig.map(t => t.effects), R.castTrig]));
    if (R.saga && Object.keys(R.saga).length && Object.keys(R.saga).length < Math.max(...Object.keys(R.saga).map(Number))) R.unhandled.push('(some Saga chapters)');
    if (R.isEquipment && R.equip === null && R.equipCheap) { R.equip = R.equipCheap.cost; R.equipOnly = R.equipCheap.type; R.equipText = costSymbols(R.equip); } // "Equip legendary creature {2}" only (Excalibur)
    if (R.kind === 'battle' && !/\bSiege\b/.test(t)) { R.support = 'none'; R.why = 'Only Siege battles are in the game so far.'; }
    else if (R.kind === 'planeswalker' && !(R.acts.length && numeric(card.loyalty))) { R.support = 'none'; R.why = 'This planeswalker\'s abilities aren\'t in the game yet.'; }
    else if ((R.cost.x && !xOk) || R.cost.odd) { R.support = 'none'; R.why = 'This X cost (or mana symbol) isn\'t in the game yet.'; }
    else if (R.kind === 'creature' && ((!numeric(card.power) && !(R.cdaSet && R.cdaSet.p)) || (!numeric(card.toughness) && !(R.cdaSet && R.cdaSet.q)))) { R.support = 'none'; R.why = 'Power or toughness that changes (like */*) isn\'t in the game yet.'; }
    else if ((R.kind === 'instant' || R.kind === 'sorcery') && !R.spell && !R.modes) { R.support = 'none'; R.why = 'The game can\'t read what this spell does yet.'; }
    else if (R.isAura && !R.aura) { R.support = 'none'; R.why = 'Only Auras that enchant a creature work so far.'; }
    else if (R.isEquipment && R.equip === null) { R.support = 'none'; R.why = 'Only Equipment with a plain Equip cost works so far.'; }
    else if (R.unhandled.length) { R.support = 'partial'; R.why = `Not automated: "${R.unhandled.join(' / ')}"`; }
    if (R.approx) { if (R.support === 'full') R.support = 'partial'; R.why = [R.approx, R.why].filter(Boolean).join(' '); }
    if (R.kw.has('flash') && R.kind !== 'instant') R.flash = true;
    if (R.isAura && !R.buff) R.buff = { p: 0, q: 0, kw: [] };
    Object.defineProperty(card, '_r', { value: R, enumerable: false, configurable: true });
    return R;
}

const SUPPORT_LABEL = { full: 'Automated', partial: 'Partly', none: 'Not yet' };
function supportBadge(card) {
    const R = rulesFor(card);
    return `<span class="badge sup-${R.support}" title="${esc(R.why || 'Everything on this card works in the game.')}">${SUPPORT_LABEL[R.support]}</span>`;
}

