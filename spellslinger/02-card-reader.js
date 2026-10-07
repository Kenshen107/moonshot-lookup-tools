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
    // ---- Magic 2010 (2026-10-08) ----
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
    // ---- Mirrodin (2026-10-08) ----
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
    // ---- Gitrog deck (2026-10-08) ----
    [/^§blacksun (\d+)$/, m => ({ t: 'blackSun', n: +m[1] })],
    [/^§lockerescape (\S+) (\d+)$/i, m => ({ t: 'grantEscape', cost: m[1].toUpperCase(), n: +m[2] })],
    [/^§espers$/, () => ({ t: 'espers' })],
    [/^§thrinax$/, () => ({ t: 'thrinax' })],
    [/^§emissary$/, () => ({ t: 'emissary' })],
    [/^§willow$/, () => ({ t: 'willow' })],
    [/^§shadowthrow$/, () => ({ t: 'shadowThrow' })],
    [/^§gitrog$/, () => ({ t: 'gitrogRide' })],
    [/^§conscription$/, () => ({ t: 'conscription' })],
    [/^§oncefuture$/, () => ({ t: 'onceFuture' })],
    [/^§rejoin$/, () => ({ t: 'rejoin' })],
    [/^§exilegygain$/, () => ({ t: 'exileGyGain', target: 'player' })],
    [/^§upheaval$/, () => ({ t: 'upheaval' })],
    [/^§victimize$/, () => ({ t: 'victimize' })],
    [/^§animatelands (\d+) (\d+)$/, m => ({ t: 'animateLands', p: +m[1], q: +m[2] })],
    [/^§loselastmv$/, () => ({ t: 'loseSelf', n: 0, nFrom: 'lastMv' })],
    [/^§tokentext sac (\d+) (\d+) (\S+) (\S+) (\S+)$/, m => ({ t: 'token', n: 0, nFrom: 'sacPow', p: +m[1], q: +m[2], name: m[3].replace(/_/g, ' ').toLowerCase(), kw: [], text: decodeURIComponent(m[5]) })],
    [/^(?:until end of turn, )?double target creature's power (\d+) times(?: until end of turn)?$/i, m => ({ t: 'powDoubleN', n: +m[1], target: 'creature', good: true })],
    [/^destroy all (planeswalkers|battles|legendary creatures|nonlegendary creatures)$/i, m => ({ t: 'wipe', how: 'destroy', what: m[1].toLowerCase() })],
    [/^each opponent loses all counters$/i, () => ({ t: 'oppLoseCounters' })],
    [/^remove all counters from (?:up to one )?target permanent$/i, m => ({ t: 'removeAllCounters', target: 'perm', filter: 'permanent', optional: /up to one/i.test(m[0]), good: false })],
    [/^put its counters on target creature you control$/i, () => ({ t: 'counters', n: 0, nFrom: 'srcLastCounters', target: 'creature', mine: true, good: true })],
    [/^each opponent discards a card, loses (\w+) life, and exiles the top (\w+) cards of their library$/i, m => [{ t: 'discard', n: 1 }, { t: 'drain', n: num(m[1]) }, { t: 'oppExileTop', n: num(m[2]) }]],
    [/^discover x, where x is that spell's mana value$/i, () => ({ t: 'discover', n: 0, nFrom: 'lastCastMv' })],
    [/^search your library for up to that many basic land cards, put them onto the battlefield tapped, then shuffle$/i, () => ({ t: 'fetchLand', n: 0, nFrom: 'bigAttackers', what: 'basic land', bf: true, tapped: true })],
    [/^until end of turn, each creature card in your graveyard gains "escape—((?:\{[^}]+\})+), exile (\w+) other cards from your graveyard\."$/i, m => ({ t: 'grantEscape', cost: m[1].toUpperCase(), n: num(m[2]) })],
    // ---- Brudiclad deck (2026-10-07) ----
    [/^§tokentext (\w+) (\d+) (\d+) (\S+) (\S+) (\S+)$/, m => ({ t: 'token', n: num(/^an?$/.test(m[1]) ? 'one' : m[1]), p: +m[2], q: +m[3], name: m[4].replace(/_/g, ' ').toLowerCase().replace(/ artifact$/, ''), artifact: / artifact$/.test(m[4].replace(/_/g, ' ')), kw: [], text: decodeURIComponent(m[6]), ...(m[5] === 'haste' ? { tkw: ['haste'] } : {}) })],
    [/^§reshape$/, () => ({ t: 'reshape' })],
    [/^§copyeachart$/, () => ({ t: 'copyEachArtifact' })],
    [/^§emry$/, () => ({ t: 'emryMark' })],
    [/^create x (treasure|clue|food) tokens, where x is (the number of .+)$/i, m => (countFn(m[2]) ? { t: 'artToken', n: 0, nCount: m[2], kind: m[1].toLowerCase() } : null)],
    [/^~ deals damage to each opponent equal to (the number of .+)$/i, m => (countFn(m[1]) ? { t: 'dmgOpp', n: 0, nCount: m[1] } : null)],
    [/^choose target artifact card in your graveyard\. you may cast that card this turn$/i, () => ({ t: 'emryMark' })],
    [/^§brudiclad$/, () => ({ t: 'brudiclad' })],
    [/^§chaoswarp$/, () => ({ t: 'chaosWarp', target: 'perm', filter: 'permanent' })],
    [/^§gearhulk$/, () => ({ t: 'gearhulk' })],
    [/^§factfiction$/, () => ({ t: 'factFiction' })],
    [/^§paycopy (\S+) (\S+)$/, m => ({ t: 'payCopyCtx', cost: `{${m[1]}}`, haste: m[2] === 'haste' })],
    [/^§darettiswap$/, () => ({ t: 'darettiSwap' })],
    [/^§treasureLastMv$/, () => ({ t: 'artToken', n: 0, nFrom: 'lastMv', kind: 'treasure' })],
    [/^§tempt$/, () => ({ t: 'tempt', target: 'creature', mine: true, good: true })],
    [/^§reflection$/, () => ({ t: 'reflection', target: 'creature', only: 'nonlegendary creature' })],
    [/^§treasuremap$/, () => ({ t: 'treasureMap' })],
    [/^§battlesphere$/, () => ({ t: 'battlesphere' })],
    [/^investigate (\w+) times$/i, m => ({ t: 'artToken', n: num(m[1]), kind: 'clue' })],
    [/^(?:that token|it) gains? ([a-z ,]+?) until end of turn$/i, m => ({ t: 'lastAllKw', kw: splitKw(m[1]) })],
    [/^create a token that's a copy of target (artifact|permanent you control|artifact you control)$/i, m => ({ t: 'tokenCopy', target: 'perm', filter: m[1].toLowerCase(), good: true })],
    [/^create a token that's a copy of target creature, except it's an artifact in addition to its other types$/i, () => ({ t: 'tokenCopy', target: 'creature', addType: 'Artifact', good: true })],
    [/^return all nonland permanents target player controls to their owner's hand$/i, () => ({ t: 'bounceAllOf', target: 'player' })],
    [/^~ deals (\d+) damage to each creature and each planeswalker$/i, m => ({ t: 'dmgCreaturesPws', n: +m[1] })],
    [/^add \{([WUBRG])\} for each card in target opponent's hand$/i, m => ({ t: 'addMana', color: m[1].toUpperCase(), n: 0, nFrom: 'oppHand', fromN: true })],
    [/^target player returns each commander they control from the battlefield to the command zone$/i, () => ({ t: 'commandersHome', target: 'player' })],
    [/^(?:you may )?put an artifact card from your hand onto the battlefield$/i, () => ({ t: 'putFromHand', what: 'artifact' })],
    [/^(?:you may )?exile an artifact card from your hand$/i, () => ({ t: 'imprintHand', what: 'artifact' })],
    [/^create a token that's a copy of the exiled card$/i, () => ({ t: 'imprintCopy' })],
    [/^each player may discard their hand and draw seven cards$/i, () => ({ t: 'windfallMay', n: 7 })],
    [/^discard up to (\w+) cards, then draw that many cards$/i, m => ({ t: 'discardDrawUpTo', n: num(m[1]) })],
    [/^you get an emblem with "whenever an artifact is put into your graveyard from the battlefield, return that card to the battlefield at the beginning of the next end step\."$/i, () => ({ t: 'emblem', kind: 'artifactReturn' })],
    [/^the next spell you cast this turn has affinity for artifacts$/i, () => ({ t: 'nextAffinity' })],
    [/^for each artifact you control, create a token that's a copy of it\. those tokens gain haste\. exile those tokens at the beginning of the next end step$/i, () => ({ t: 'copyEachArtifact' })],
    [/^gain control of all artifacts that player controls$/i, () => ({ t: 'stealArtifacts' })],
    [/^you win the game$/i, () => ({ t: 'winGame' })],
    [/^return ~ to its owner's hand and create (\w+) 1\/1 colorless thopter artifact creature tokens with flying$/i, m => [{ t: 'selfBounce' }, { t: 'token', n: num(m[1]), p: 1, q: 1, name: 'colorless thopter', kw: ['flying'], artifact: true }]],
    [/^gain control of that artifact until the end of your next turn$/i, () => ({ t: 'nabArtifact' })],
    [/^§steelhk (\d+)$/, m => ({ t: 'hellkiteWipe', n: +m[1] })],
    [/^create (an? \d+\/\d+ [a-z ]+? token(?: with [a-z ]+?)?(?:, (?:and )?an? \d+\/\d+ [a-z ]+? token(?: with [a-z ]+?)?)+)$/i, m => { const fx = m[1].split(/, (?:and )?(?=an? \d)/).map(x => parseEffects(`create ${x}`)); return fx.every(Boolean) ? fx.flat() : null; }],
    // ---- Sandman deck (2026-10-07) ----
    [/^(?:you )?draw cards equal to the sacrificed creature's power$/i, () => ({ t: 'draw', n: 0, nFrom: 'sacPow' })],
    [/^(?:you )?draw cards equal to the sacrificed creature's power, then you gain life equal to its toughness$/i, () => [{ t: 'draw', n: 0, nFrom: 'sacPow' }, { t: 'gain', n: 0, nFrom: 'sacTou' }]],
    [/^draw cards equal to the power of target creature you control$/i, () => ({ t: 'drawPowTarget', target: 'creature', mine: true, good: true })],
    [/^§fetchpow$/, () => ({ t: 'fetchLand', n: 0, nFrom: 'greatestPower', what: 'basic land', bf: true, tapped: true })],
    [/^§spry$/, () => ({ t: 'spry' })],
    [/^§genesis (\d+)$/, m => ({ t: 'genesis', n: +m[1] })],
    [/^§druidpurify$/, () => ({ t: 'druidPurify' })],
    // ---- Tyrox deck (2026-10-08) ----
    [/^§guide$/, () => ({ t: 'goblinGuide' })],
    [/^§celebrant$/, () => ({ t: 'celebrant' })],
    [/^§rabble$/, () => ({ t: 'rabble' })],
    [/^~ deals (\d+) damage to target non-([A-Z][a-z]+) creature an opponent controls$/, m => ({ t: 'dmg', n: +m[1], target: 'creature', theirs: true, only: `non-${m[2]} creature` })],
    [/^§feedpack$/, () => ({ t: 'feedPack' })],
    [/^§colossus$/, () => ({ t: 'colossus' })],
    [/^§millLands$/, () => ({ t: 'millLands' })],
    [/^§zombiecopy (\d+)$/, m => ({ t: 'zombieCopy', n: +m[1] })],
    [/^§conduit$/, () => ({ t: 'conduit' })],
    [/^§caradhras$/, () => ({ t: 'caradhras' })],
    [/^draw x cards, where x is the greatest power among creatures you controlled as you cast ~$/i, () => ({ t: 'draw', n: 0, nFrom: 'castPow' })],
    [/^you gain twice x life$/i, () => ({ t: 'gain', n: 0, nFrom: 'castPow2' })],
    [/^target creature you control deals damage equal to its power to another target creature$/i, () => [{ t: 'markMine', target: 'creature', mine: true, good: true }, { t: 'biteDmg', target: 'creature', notPrev: true }]],
    [/^if excess damage was dealt this way, discover x, where x is that excess damage$/i, () => ({ t: 'discoverExcess' })],
    [/^return target card from your graveyard to your hand$/i, () => ({ t: 'regrow', what: 'card' })],
    [/^you gain life equal to that card's mana value$/i, () => ({ t: 'gain', n: 0, nFrom: 'lastCardMv' })],
    [/^return target card with mana value (\w+) or greater from your graveyard to your hand$/i, m => ({ t: 'regrow', what: `card mvge${num(m[1])}` })],
    [/^roll two six-sided dice$/i, () => ({ t: 'roll', sides: 6, dice: 2 })],
    [/^return any number of cards with total mana value x or less from your graveyard to your hand, where x is the total of those results$/i, () => ({ t: 'regrowBudget' })],
    [/^(?:until end of turn, )?lands you control become (\d+)\/(\d+) creatures that are still lands(?: until end of turn)?$/i, m => ({ t: 'animateLands', p: +m[1], q: +m[2] })],
    [/^(?:you may )?put a basic (forest|island|swamp|mountain|plains) card from your hand onto the battlefield$/i, m => ({ t: 'putLandFromHand', what: `basic ${m[1].toLowerCase()}` })],
    [/^if you put a cave onto the battlefield this way, you gain (\d+) life$/i, m => ({ t: 'gain', n: +m[1], caveOnly: true })],
    [/^create a lander token$/i, () => ({ t: 'artToken', n: 1, kind: 'lander' })],
    [/^when you next cast a creature spell this turn, that creature enters with an additional \+1\/\+1 counter on it$/i, () => ({ t: 'nextCreatureCounter' })],
    [/^(?:until end of turn, )?another target creature you control gains trample and gets \+x\/\+x, where x is the number of (.+?)(?: until end of turn)?$/i, m => (countFn(`the number of ${m[1]}`) ? { t: 'pump', p: 1, q: 1, kw: ['trample'], per: `the number of ${m[1]}`, target: 'creature', mine: true, notSelf: true, good: true } : null)],
    [/^return ~ and target land card from your graveyard to the battlefield tapped$/i, () => [{ t: 'returnSelfGy', bf: true, tapped: true }, { t: 'regrow', what: 'land', bf: true, tapped: true }]],
    [/^return ~ to your hand$/i, () => ({ t: 'returnSelfHandGy' })],
    // ---- Top-1000 round 2 (2026-10-07) ----
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
    // ---- Landfall (2026-10-06) ----
    [/^(?:you may )?return ~ from your graveyard to the battlefield(?: tapped)?$/, m => ({ t: 'returnSelfGy', bf: true, tapped: /tapped/.test(m[0]) })],
    // Krenko, Mob Boss: "create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control" (audit, 2026-10-06)
    [/^create x (\d+)\/(\d+) ([a-z ]+?) (artifact )?creature tokens?(?: with ([a-z ,]+))?, where x is (the number of .+)$/i, m => (countFn(m[6]) ? { t: 'token', n: 0, nCount: m[6], p: +m[1], q: +m[2], name: m[3], artifact: !!m[4], kw: m[5] ? splitKw(m[5]) : [] } : null)],
    [/^create a (\d+)\/(\d+) ([a-z ]+?) (artifact )?creature token(?: with ([a-z ,]+))? for each (.+)$/, m => (countFn(`the number of ${m[6]}`) ? { t: 'token', n: 0, nCount: `the number of ${m[6]}`, p: +m[1], q: +m[2], name: m[3], artifact: !!m[4], kw: m[5] ? splitKw(m[5]) : [] } : null)],
    [/^(?:you may )?put a \+1\/\+1 counter on each ([a-z]+) creature you control$/, m => ({ t: 'teamCounters', n: 1, type: m[1][0].toUpperCase() + m[1].slice(1) })],
    [/^create a token that's a copy of ~$/, () => ({ t: 'tokenCopySelf' })],
    [/^(?:you may )?tap or untap target creature$/, () => ({ t: 'tapOrUntap', target: 'creature' })],
    [/^(?:you may )?(?:have )?target player lose (\d+) life$/, m => ({ t: 'drain', n: +m[1] })],
    [/^double ~'s power until end of turn$/, () => ({ t: 'doublePow', target: 'self' })],
    [/^double the power of target creature you control until end of turn$/, () => ({ t: 'doublePow', target: 'creature', mine: true, good: true })],
    [/^equipped creature gets \+(\d+)\/\+(\d+) until end of turn$/, m => ({ t: 'hostPump', p: +m[1], q: +m[2] })],
    [/^(?:you may )?(?:have )?target creature get ([+-]\d+)\/([+-]\d+) until end of turn$/, m => ({ t: 'pump', p: +m[1], q: +m[2], kw: [], target: 'creature', good: +m[1] + +m[2] >= 0 })],
    [/^(?:you may )?(?:have )?~ deal (\d+) damage to target player or planeswalker$/, m => ({ t: 'dmg', n: +m[1], target: 'player' })],
    [/^(?:you may have )?(?:up to one )?target land you control becomes? an? (\d+)\/(\d+) ([a-z ]+?) creature with ([a-z ,]+?) until end of turn$/, m => ({ t: 'animateLand', p: +m[1], q: +m[2], kw: splitKw(m[4]), target: 'perm', filter: 'land you control', mine: true, good: true })],
    [/^(?:you may )?(?:have )?~'s base power and toughness become (\d+)\/(\d+) until end of turn$/, m => ({ t: 'baseSelf', p: +m[1], q: +m[2] })],
    [/^other creatures you control get \+(\d+)\/\+(\d+) until end of turn$/, m => ({ t: 'teamPump', p: +m[1], q: +m[2], kw: [], other: true })],
    [/^you get ((?:\{e\} ?)+)$/i, m => ({ t: 'energy', n: (m[1].match(/\{e\}/gi) || []).length })],
    [/^exile that token at the beginning of the next end step$/, () => ({ t: 'exileMadeAtEnd' })],
    [/^look at the top card of your library\. if it's a creature card, you may reveal it and put it into your hand\. if you don't put the card into your hand, you may put it into your graveyard$/, () => ({ t: 'topCreatureElseGy' })],
    // ---- X spells (2026-10-06): X is read as 97 here (xSub) ----
    [/^counter target spell unless its controller pays \{(\d+)\}$/, m => ({ t: 'counter', target: 'spell', filter: 'any', unless: +m[1] })],
    [/^return all (creature|creature and planeswalker|artifact) cards with mana value (\d+) or less from your graveyard to the battlefield$/, m => ({ t: 'massReanimate', what: `${m[1].replace(' and ', ' or ')} mv${m[2]}` })],
    [/^each player mills (\d+) cards$/, m => ({ t: 'millAll', n: +m[1] })],
    [/^each player sacrifices (\d+) creatures$/, m => ({ t: 'edictN', n: +m[1] })],
    [/^create (\d+) (\d+)\/(\d+) ([a-z ]+?) creature tokens and (\d+) (food|treasure|clue) tokens$/, m => [{ t: 'token', n: +m[1], p: +m[2], q: +m[3], name: m[4], kw: [] }, { t: 'artToken', n: +m[5], kind: m[6] }]],
    [/^create a number of tapped treasure tokens equal to (?:its|~'s) power$/, () => ({ t: 'artToken', n: 0, nFrom: 'srcLastPow', kind: 'treasure', tapped: true })],
    [/^you gain life and draw cards equal to (?:its|~'s) power$/, () => [{ t: 'gain', n: 0, nFrom: 'srcLastPow' }, { t: 'draw', n: 0, nFrom: 'srcLastPow' }]],
    [/^create a (\d+)\/(\d+) ([a-z ]+?) (artifact )?creature token(?: with ([a-z ,]+))? for each \+1\/\+1 counter on (?:~|it)$/, m => ({ t: 'token', n: 0, nFrom: 'srcLastCounters', p: +m[1], q: +m[2], name: m[3], artifact: !!m[4], kw: m[5] ? splitKw(m[5]) : [] })],
    [/^draw a card for each \+1\/\+1 counter on (?:~|it)$/, () => ({ t: 'draw', n: 0, nFrom: 'srcLastCounters' })],
    [/^create a number of (\d+)\/(\d+) ([a-z ]+?) creature tokens equal to ~'s power$/, m => ({ t: 'token', n: 0, nFrom: 'srcPow', p: +m[1], q: +m[2], name: m[3], kw: [] })],
    [/^~ deals (\d+) damage to target creature\. create a number of tapped treasure tokens equal to the amount of excess damage dealt to that creature this way$/, m => ({ t: 'dmg', n: +m[1], target: 'creature', excessTreasure: true })],
    [/^search your library(?: and\/or graveyard)? for an? (?:(white|blue|black|red|green) )?(creature|artifact|permanent|enchantment) card with mana value (\d+) or less,? (?:and )?put (?:it|that card) onto the battlefield(?:, then shuffle)?$/, m => ({ t: 'tutor', what: `${m[1] ? `${m[1]} ` : ''}${m[2]} mv${m[3]}`, bf: true, gyToo: /graveyard/.test(m[0]) })],
    [/^shuffle ~ into its owner's library$/, () => ({ t: 'shuffleSelfIn' })],
    [/^~ deals (\d+) damage to each creature (without flying|with flying)? ?and each player$/, m => ({ t: 'dmgSweep', n: +m[1], filt: m[2] === 'without flying' ? 'noFly' : m[2] ? 'fly' : 'all', players: true })],
    [/^~ deals (\d+) damage to each (nonartifact )?creature and each player$/, m => ({ t: 'dmgSweep', n: +m[1], filt: m[2] ? 'nonartifact' : 'all', players: true })],
    [/^~ deals (\d+) damage to each creature without flying and each planeswalker$/, m => ({ t: 'dmgSweep', n: +m[1], filt: 'noFly' })],
    [/^target player gains (\d+) life$/, m => ({ t: 'gain', n: +m[1] })],
    [/^exile up to (\d+) target cards from graveyards$/, m => ({ t: 'exileGy', n: +m[1] })],
    [/^tap (\d+) target creatures$/, m => ({ t: 'tap', target: 'creature', multi: +m[1] })],
    [/^(destroy|exile) (?:up to )?(\d+) target (artifacts and\/or enchantments|artifacts|creatures|nonland permanents)$/, m => ({ t: m[1], target: 'perm', filter: { 'artifacts and/or enchantments': 'artifact or enchantment', artifacts: 'artifact', creatures: 'creature', 'nonland permanents': 'nonland permanent' }[m[3]], multi: +m[2] })],
    [/^counter target spell with mana value (\d+)$/, m => ({ t: 'counter', target: 'spell', filter: `mv=${m[1]}` })],
    [/^gain control of target creature with mana value (\d+)( or less)?$/, m => ({ t: 'stealPerm', target: 'creature', only: `creature with mana value ${m[1]}${m[2] ? ' or less' : ''}` })],
    [/^put (\d+) -1\/-1 counters on each creature$/, m => ({ t: 'minusEach', n: +m[1] })],
    [/^each creature gets -(\d+)\/-(\d+) until end of turn$/, m => ({ t: 'allPump', p: -m[1], q: -m[2] })],
    [/^~ deals (\d+) damage to each of up to (\w+) targets$/, m => ({ t: 'dmg', n: +m[1], target: 'any', multi: num(m[2]) })],
    [/^target player draws (\d+) cards$/, m => ({ t: 'draw', n: +m[1] })],
    [/^exile (\d+) target creatures §§ for each creature exiled this way, its controller creates a (\d+)\/(\d+) ([a-z ]+?) creature token$/, m => ({ t: 'exile', target: 'perm', filter: 'creature', multi: +m[1], ctrlToken: { p: +m[2], q: +m[3], name: m[4] } })],
    [/^create (\d+) (\d+)\/(\d+) ([a-z ]+?) creature tokens with "~ can't block\."$/, m => ({ t: 'token', n: +m[1], p: +m[2], q: +m[3], name: m[4], kw: ['cantblock'] })],
    // ---- Top-1000 round (2026-10-06): permanents' effects ----
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
    // ---- Welcome decks round (2026-10-06): more wordings ----
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
        // ---- Set mechanics read from keyword lines (welcome decks, 2026-10-06) ----
        if ((m = line.match(/^(Basic land|Plains|Island|Swamp|Mountain|Forest)cycling ((?:\{[^}]+\})+)$/i))) { R.landcycle = { cost: parseCost(m[2]), what: m[1].toLowerCase() === 'basic land' ? 'basic land' : m[1].toLowerCase() }; continue; }
        // ---- Top-1000 round 2 (2026-10-07) ----
        if ((m = line.match(/^Fabricate (\d+)$/))) { R.etb.push({ t: 'fabricate', n: +m[1] }); continue; }
        if (/^Choose a Background$/.test(line)) continue; // deck building only
        if (/^~ is the chosen type in addition to its other types\.$/.test(line)) { R.chosenSelf = true; continue; }
        if (/^Each other creature you control of the chosen type enters with an additional \+1\/\+1 counter on it\.$/.test(line)) { R.mimic = true; continue; }
        if (/^As ~ enters, choose artifact, creature, enchantment, instant, or sorcery\.$/.test(line)) { R.chooseCardType = true; continue; }
        if ((m = line.match(/^Spells you cast of the chosen type cost \{(\d+)\} less to cast\.$/)) && R.chooseCardType) { R.reducer = { what: 'chosenCardType', n: +m[1] }; continue; }
        if (/^At the beginning of your upkeep, look at the top card of your library\. If it's a creature card of the chosen type, you may reveal it and put it into your hand\.$/.test(line)) { R.trig.push({ ev: 'upkeep', effects: [{ t: 'heraldHorn' }] }); continue; }
        if (/^Whenever a creature you control enters, draw a card if its power is 3 or greater\. Otherwise, put two \+1\/\+1 counters on it\.$/.test(line)) { R.trig.push({ ev: 'enters', typeEnter: { creature: true }, self: true, effects: [{ t: 'tributeTree' }] }); continue; }
        if (/^Each creature you control with a counter on it has "\{T\}: Add \{G\}\."$/.test(line)) { R.counterMana = 'G'; continue; }
        if (/^Tokens you control have "\{T\}: Add \{G\}\."$/.test(line)) { R.tokenMana = 'G'; continue; }
        if (/^If you would gain life, you gain twice that much life instead\.$/.test(line)) { R.doubleGain = true; continue; }
        if (/^If an opponent would lose life during your turn, they lose twice that much life instead\.$/.test(line)) { R.doubleOppLoss = true; continue; }
        if (/^If you would draw a card except the first one you draw in each of your draw steps, draw two cards instead\.$/.test(line)) { R.doubleDraw = true; continue; }
        if (/^Extort$/.test(line)) { R.trig.push({ ev: 'cast', filter: 'any', effects: [{ t: 'extort' }] }); R.kw.add('extort'); continue; }
        if (/^Evolve$/.test(line)) { R.trig.push({ ev: 'enters', evolve: true, effects: [{ t: 'evolve' }] }); R.kw.add('evolve'); continue; }
        if (/^Unleash$/.test(line)) { R.kw.add('unleash'); continue; }
        if (/^Cipher$/.test(line)) { R.cipher = true; continue; }
        if ((m = line.match(/^Scavenge ((?:\{[^}]+\})+)$/))) { R.gyActs = R.gyActs || []; R.gyActs.push({ cost: { mana: parseCost(m[1]), tap: false, exileSelfGy: true }, effects: [{ t: 'counters', n: Number(card.power) || 0, target: 'creature', good: true }], text: `Scavenge ${m[1]}`, sorcery: true, gy: true }); continue; }
        if ((m = line.match(/^Mayhem ((?:\{[^}]+\})+)$/))) { R.mayhem = parseCost(m[1]); R.kw.add('mayhem'); continue; }
        if ((m = line.match(/^Web-slinging ((?:\{[^}]+\})+)$/))) { R.webSling = { cost: parseCost(m[1]), text: m[1] }; continue; }
        if ((m = line.match(/^Teamwork (\d+)$/))) { R.teamwork = +m[1]; continue; }
        if (/^Choose one\. If ~ was cast using teamwork, choose both instead\.$/.test(line)) { lines[li] = 'Choose one —'; R.modeTeamwork = true; li--; continue; }
        if (/^As ~ enters(?: the battlefield)?, choose a color\.$/.test(line)) { R.chooseColor = true; continue; }
        // Thriving lands
        if ((m = line.match(/^~ enters tapped\. As it enters, choose a color other than (white|blue|black|red|green)\.$/))) { R.entersTapped = true; R.chooseColor = true; R.chooseColorNot = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[1]]; continue; }
        if ((m = line.match(/^Creatures you control of the chosen color get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ type: null, colorChosen: true, p: +m[1], q: +m[2], kw: [] }); continue; }
        // Razorkin Needlehead: "~ has first strike during your turn"
        if ((m = line.match(/^~ has ([a-z ,]+) during your turn\.$/)) && allKnown(splitKw(m[1]))) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn', p: 0, q: 0, kw: splitKw(m[1]) }); continue; }
        if (/^As an additional cost to cast ~, discard a card or pay (\d+) life\.$/.test(line)) { R.addCost = { discard: true, orLife: +line.match(/pay (\d+) life/)[1] }; continue; }
        if ((m = line.match(/^~ enters with an? (\w+) counter on it for each (.+)\.$/)) && countFn(`the number of ${m[2]}`)) { R.etbNamed = { kind: m[1], what: `the number of ${m[2]}` }; continue; }
        // ---- Top-1000 round (2026-10-06): lands and mana ----
        if (/^When ~ dies, if it was a creature, return it to the battlefield under its owner's control\. It's an enchantment\.(?: \(It's not a creature\.\))?$/.test(line)) { R.trig.push({ ev: 'dies', effects: [{ t: 'enduring' }] }); continue; }
        if ((m = line.match(/^\{T\}: Add \{([WUBRG])\}\. Activate only if you control an? (\w+) or an? (\w+)\.$/))) { R.condMana = { color: m[1], types: [m[2], m[3]] }; continue; }
        if ((m = line.match(/^\{T\}: Add \{C\}\. If you control an Urza's ([A-Za-z-]+) and an Urza's ([A-Za-z-]+), add ((?:\{C\})+) instead\.$/))) { R.mana = { colors: ['C'], n: 1, tron: { need: [`Urza's ${m[1]}`, `Urza's ${m[2]}`].map(x => x.replace(/Power-Plant/, 'Power Plant')), n: (m[3].match(/C/g) || []).length } }; continue; }
        if ((m = line.match(/^Lands you control have "\{T\}: Add one mana of any color\."$/)) || /^Lands you control are every basic land type in addition to their other types\.$/.test(line)) { R.landsAnyColor = true; continue; }
        if ((m = line.match(/^Each land is an? (Plains|Island|Swamp|Mountain|Forest) in addition to its other land types\.$/))) { R.landTypeAll = m[1]; continue; }
        if ((m = line.match(/^(?:Other )?[Cc]reatures you control have "\{T\}: Add one mana of any color\."$/))) { R.creatureMana = true; continue; }
        if ((m = line.match(/^Whenever you tap an? (Plains|Island|Swamp|Mountain|Forest) for mana, add an additional \{([WUBRG])\}\.$/))) { R.extraMana = { type: m[1], color: m[2] }; continue; }
        if ((m = line.match(/^Whenever enchanted land is tapped for mana, its controller adds an additional \{([WUBRG])\}\.$/))) { R.extraMana = { host: true, color: m[1] }; continue; }
        if (/^Enchant Forest$/.test(line)) { R.aura = true; R.auraLand = true; R.auraForest = true; continue; }
        if ((m = line.match(/^~ costs \{1\} less to cast for each creature on the battlefield\.$/))) { R.costLess = { n: 1, what: 'the number of creatures on the battlefield' }; continue; }
        if ((m = line.match(/^~ costs \{X\} less to cast, where X is the (total power|greatest power) (?:of|among) creatures you control\.$/))) { R.costLessX = m[1]; continue; }
        if (/^~ costs \{X\} less to cast, where X is the total mana value of historic permanents you control\.$/.test(line)) { R.costLessX = 'historic'; continue; }
        if ((m = line.match(/^(White|Blue|Black|Red|Green) creature spells you cast cost \{(\d+)\} less to cast\.$/))) { R.reducer = { what: `color:${COLOR_WORDS[m[1].toLowerCase()]}:creature`, minPow: 0, n: +m[2] }; continue; }
        if ((m = line.match(/^Each spell you cast that's (white|blue|black|red|green) or (white|blue|black|red|green) costs \{(\d+)\} less to cast\.$/))) { R.reducer = { what: `color:${COLOR_WORDS[m[1]]}${COLOR_WORDS[m[2]]}`, minPow: 0, n: +m[3] }; continue; }
        if ((m = line.match(/^(Aura and Equipment|Creature) spells you cast(?: of the chosen type)? cost \{(\d+)\} less to cast\.$/)) || (m = line.match(/^(Creature) spells of the chosen type cost \{(\d+)\} less to cast\.$/))) { R.reducer = { what: /chosen/.test(line) ? 'chosenType' : m[1] === 'Aura and Equipment' ? 'Aura|Equipment' : 'Creature', minPow: 0, n: +m[2] }; continue; }
        // ---- Top-1000 round: replacement effects ----
        if ((m = line.match(/^If one or more \+1\/\+1 counters would be put on (?:a|an) (creature|permanent|artifact or creature) you control, (that many plus one|twice that many) \+1\/\+1 counters are put on (?:it|that creature|that permanent) instead\.$/))) { R.counterMod = { what: m[1], plus: /plus one/.test(m[2]) ? 1 : 0, times: /twice/.test(m[2]) ? 2 : 1 }; continue; }
        if (/^If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead\.$/.test(line) || /^If one or more tokens would be created under your control, twice that many of those tokens are created instead\.$/.test(line)) { R.tokenDouble = true; continue; }
        if (/^If you would create one or more Treasure tokens, instead create those tokens plus an additional Treasure token\.$/.test(line)) { R.extraTreasure = true; continue; }
        if ((m = line.match(/^If a source you control would deal damage to (?:a permanent or player|an opponent or a permanent an opponent controls), it deals (double|triple) that damage(?: to that permanent or player)? instead\.$/))) { R.dmgMult = { n: m[1] === 'double' ? 2 : 3, oppOnly: /opponent/.test(line) }; continue; }
        if (/^If a red source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus 2 instead\.$/.test(line)) { R.dmgPlus = { n: 2, color: 'R' }; continue; }
        // ---- Top-1000 round: statics ----
        if ((m = line.match(/^Creatures can't attack you(?: or planeswalkers you control)? unless their controller pays \{(2|X)\} for each (?:creature they control that's attacking you|of those creatures)(?:, where X is the number of enchantments you control)?\.$/))) { R.attackTax = m[1] === 'X' ? 'enchantments' : 2; continue; }
        if ((m = line.match(/^(Equipped|Enchanted) creature can't be blocked(?: and has ([a-z ,]+))?\.$/)) && (!m[2] || allKnown(splitKw(m[2])))) { R.buff = { p: 0, q: 0, kw: ['unblockable', ...(m[2] ? splitKw(m[2]) : [])] }; continue; }
        if (/^~ can't block and can't be blocked\.$/.test(line)) { R.kw.add('cantblock'); R.kw.add('unblockable'); continue; }
        if ((m = line.match(/^As long as equipped creature is legendary, it has ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { R.buffCond = { cond: 'the equipped creature is legendary', kw: splitKw(m[1]) }; continue; }
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) and loses ([a-z ]+)\.$/)) && allKnown([m[3]])) { R.buff = { p: +m[1], q: +m[2], kw: [`-${m[3]}`] }; continue; }
        if ((m = line.match(/^(Creature tokens|Legendary creatures) you control get \+(\d+)\/\+(\d+) and have ([a-z ,{}0-9]+)\.$/))) { const kw = splitKw(m[4].replace(/ward \{(\d+)\}/, 'ward:$1')); if (allKnown(kw)) { R.statics.push({ type: null, match: /tokens/.test(m[1]) ? 'token' : 'legendary', p: +m[2], q: +m[3], kw }); continue; } }
        if ((m = line.match(/^Creatures your opponents control get ([+-]\d+)\/([+-]\d+)\.$/))) { R.statics.push({ type: null, opp: true, global: true, p: +m[1], q: +m[2], kw: [] }); continue; }
        if ((m = line.match(/^Other permanents you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { R.permKw = splitKw(m[1]); continue; }
        if (/^Your opponents can't cast spells during your turn\.$/.test(line) || /^During your turn, your opponents can't cast spells or activate abilities of artifacts, creatures, or enchantments\.$/.test(line)) { R.noCastOnMyTurn = true; continue; }
        if (/^Your opponents can't cast spells from anywhere other than their hands\.$/.test(line)) { R.handOnly = true; continue; }
        if ((m = line.match(/^(Artifacts and creatures|Creatures) your opponents control enter tapped\.$/))) { R.oppEnterTapped = /Artifacts/.test(m[1]) ? 'artifact or creature' : 'creature'; continue; }
        if (/^You may cast spells as though they had flash\.$/.test(line)) { R.flashAll = true; continue; }
        if ((m = line.match(/^You may cast ([A-Z][a-z]+) and ([A-Z][a-z]+) spells as though they had flash\.$/))) { R.flashTypes = [m[1], m[2]]; continue; } // Sigarda's Aid
        if ((m = line.match(/^Spells your opponents cast that target ~ cost an additional (\d+) life to cast\.$/))) { R.targetTaxLife = +m[1]; continue; } // Terror of the Peaks
        if ((m = line.match(/^Cumulative upkeep ((?:\{[^}]+\})+)$/))) { const c = parseCost(m[1]); if (!c.x && !c.odd) { R.cumUpkeep = c; continue; } }
        if (/^Rebound$/.test(line)) { R.rebound = true; continue; }
        if ((m = line.match(/^You may play (two|an) additional lands? on each of your turns\.$/))) { R.extraLand = m[1] === 'two' ? 2 : 1; continue; }
        if (/^You may play lands from your graveyard\.$/.test(line)) { R.landsFromGy = true; continue; }
        if (/^You may play lands from the top of your library\.$/.test(line)) { R.landsFromTop = true; continue; }
        if ((m = line.match(/^Untap (all permanents|all artifacts|~) you control during each other player's untap step\.$/)) || (m = line.match(/^Untap (~) during each other player's untap step\.$/))) { R.untapOthers = m[1]; continue; }
        if (/^If you would draw a card while your library has no cards in it, you win the game instead\.$/.test(line)) { R.labMan = true; continue; }
        if ((m = line.match(/^As long as ~ is in your graveyard and you control an? (Plains|Island|Swamp|Mountain|Forest), creatures you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[2]))) { R.gyStatic = { type: m[1], kw: splitKw(m[2]) }; continue; }
        if ((m = line.match(/^You may cast ~ from your graveyard as long as you control an? ([A-Z][a-z]+)\.$/))) { R.gyCastIf = m[1]; continue; }
        if ((m = line.match(/^Creatures with power less than ~'s power can't block creatures you control\.$/))) { R.lambholt = true; continue; }
        if (/^Split second$/.test(line)) { R.splitSecond = true; R.kw.add('split second'); continue; }
        // Alternative costs (118.9): Force of Will, Force of Negation, Snuff Out
        if ((m = line.match(/^(?:If (.+?), )?[Yy]ou may (pay (\d+) life and exile|exile|pay (\d+) life|pay ((?:\{[^}]+\})+))(?: an? (white|blue|black|red|green) card from your hand)? rather than pay ~'s mana cost\.$/)) && (!m[1] || parseCond(m[1])) && (!/exile/.test(m[2]) || m[6]) && !(/exile/.test(m[2]) === !m[6])) {
            R.alt = { mana: parseCost(m[5] || ''), life: +(m[3] || m[4] || 0), exile: m[6] ? { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[6]] : null, cond: m[1] ? parseCond(m[1]) : null, text: line.replace(/^If .+?, y/, 'Y').replace(/^You may /, '').replace(/ rather than pay ~'s mana cost\.$/, '') };
            continue;
        }
        if ((m = line.match(/^(Evoke|Echo) ((?:\{[^}]+\})+)$/))) { const c = parseCost(m[2]); if (!c.x && !c.odd) { if (m[1] === 'Evoke') R.evoke = c; else R.echo = c; continue; } }
        if ((m = line.match(/^Eternalize ((?:\{[^}]+\})+)$/))) { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(m[1]), tap: false, exileSelfGy: true }, effects: [{ t: 'eternalize' }], text: `Eternalize ${m[1]}`, sorcery: true, gy: true }); continue; }
        // ---- Starter kits (2026-10-06): set mechanics ----
        if ((m = line.match(/^Freerunning ((?:\{[^}]+\})+)$/))) { R.freerun = parseCost(m[1]); continue; }
        if ((m = line.match(/^Backup (\d+)$/))) { R.backup = +m[1]; R.etb.push({ t: 'counters', n: +m[1], target: 'creature', good: true, backup: true }); R._kwBefore = new Set(R.kw); continue; }
        if ((m = line.match(/^Offspring ((?:\{[^}]+\})+)$/))) { R.kicker = parseCost(m[1]); R.offspring = true; continue; }
        if ((m = line.match(/^Unearth ((?:\{[^}]+\})+)$/))) { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(m[1]), tap: false }, effects: [{ t: 'unearth' }], text: `Unearth ${m[1]}`, sorcery: true, gy: true }); continue; }
        if ((m = line.match(/^~ can't attack or block unless (.+)\.$/)) && parseCond(m[1])) { R.blockCond = m[1]; R.attackCond = m[1]; continue; }
        if ((m = line.match(/^~ enters(?: the battlefield)? with an? \+1\/\+1 counter on it if (.+)\.$/)) && parseCond(m[1])) { R.etbCountersIf = { n: 1, cond: m[1] }; continue; }
        if ((m = line.match(/^If ~ was kicked, it enters with (\w+) \+1\/\+1 counters on it\.$/))) { R.kickCounters = num(m[1]); continue; }
        if ((m = line.match(/^~ enters with (\w+) \+1\/\+1 counters on it for each creature that convoked it\.$/))) { R.convokeCounters = num(m[1]); continue; }
        if (/^During your turn, prevent all damage that would be dealt to ~\.$/.test(line)) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn', p: 0, q: 0, kw: ['preventdmg'] }); continue; }
        if ((m = line.match(/^Creature tokens you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { R.statics.push({ type: null, match: 'token', p: 0, q: 0, kw: splitKw(m[1]) }); continue; }
        if (/^When ~ enters and when you sacrifice it, (.+)$/.test(line)) { const fx = parseEffects(line.replace(/^When ~ enters and when you sacrifice it, /, '')); if (fx) { R.etb.push(...fx); R.trig.push({ ev: 'sacrificed', effects: fx }); continue; } }
        // Kenrith's Transformation, Darksteel Mutation: base P/T and no abilities (the new creature type and color aren't modeled)
        if ((m = line.match(/^Enchanted creature loses all abilities and is an? (?:[a-z]+ )?[A-Z][a-z]+ creature with base power and toughness (\d+)\/(\d+)\.$/))) { R.buff = { p: 0, q: 0, kw: [] }; R.buffBase = { p: +m[1], q: +m[2] }; R.buffLose = true; R.buffBad = true; continue; }
        if ((m = line.match(/^Enchanted creature is an? [A-Z][a-z]+ artifact creature with base power and toughness (\d+)\/(\d+) and has ([a-z]+), and it loses all other abilities, card types, and creature types\.$/)) && allKnown([m[3]])) { R.buff = { p: 0, q: 0, kw: [m[3]] }; R.buffBase = { p: +m[1], q: +m[2] }; R.buffLose = true; R.buffBad = true; continue; }
        if (/^Enchanted creature has base power and toughness (\d+)\/(\d+), has defender, and loses all other abilities\.$/.test(line)) { const bm = line.match(/(\d+)\/(\d+)/); R.buff = { p: 0, q: 0, kw: ['defender'] }; R.buffBase = { p: +bm[1], q: +bm[2] }; R.buffLose = true; R.buffBad = true; continue; }
        if ((m = line.match(/^If an? ([A-Z][a-z]+) source you control would deal damage to a permanent or player, it deals double that damage to that permanent or player instead\.$/))) { R.doubleType = m[1]; continue; }
        if (/^If a creature would deal combat damage to ~, prevent that damage and put a \+1\/\+1 counter on ~\.$/.test(line)) { R.combatShield = true; continue; }
        if ((m = line.match(/^If one or more \+1\/\+1 counters would be put on an? ((?:[A-Z][a-z]+, )*[A-Z][a-z]+,? or [A-Z][a-z]+) you control, that many plus one \+1\/\+1 counters are put on it instead\.$/))) { R.counterBonus = m[1].split(/,? or |, /); continue; }
        if (/^If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead\.$/.test(line)) { R.extraFood = true; continue; }
        if (/^If you would draw a card, exile the top card of your library face down instead\.$/.test(line)) { R.drawExile = true; continue; }
        if ((m = line.match(/^You may cast ~ from your graveyard by paying (\d+) life and discarding a card in addition to paying its other costs\.$/))) { R.gyCast = { life: +m[1], discard: 1 }; continue; }
        // Clones (707.2): Clone, Phyrexian Metamorph, Sculpting Steel, Spark Double, Vesuva
        if ((m = line.match(/^You may have ~ enter(?: the battlefield)?( tapped)? as a copy of (?:any|a) (artifact or creature|artifact|creature|land|creature or planeswalker you control|creature you control)(?: on the battlefield)?(?:, except (.+))?\.$/))) {
            const ex = m[3] || '';
            const known = !ex || /^it's an? (artifact|enchantment) in addition to its other types$/.test(ex) || /^it enters with an additional \+1\/\+1 counter on it if it's a creature, it enters with an additional loyalty counter on it if it's a planeswalker, and it isn't legendary$/.test(ex) || /^it isn't legendary$/.test(ex);
            if (known) {
                const at = ex.match(/^it's an? (artifact|enchantment) in addition/);
                R.clone = { what: m[2], tapped: !!m[1], addType: at ? at[1][0].toUpperCase() + at[1].slice(1) : null, plusOne: /additional \+1\/\+1/.test(ex), notLegendary: /isn't legendary/.test(ex) };
                continue;
            }
        }
        if (/^You may have ~ enter as a copy of any creature on the battlefield with mana value less than or equal to the amount of mana spent to cast ~, except it's a Bird in addition to its other types and it has flying\.$/.test(line)) { R.cloneX = true; continue; }
        if (/^Whenever a Dragon you control enters, you may have ~ become a copy of it until end of turn, except its name is ~ and it's legendary in addition to its other types\.$/.test(line)) { R.trig.push({ ev: 'enters', filt: 'Dragon', ctxTarget: true, effects: [{ t: 'becomeCopy' }] }); continue; }
        if (/^Whenever you cast a spell, if it's the first instant spell, the first sorcery spell, or the first Otter spell other than ~ you've cast this turn, you may have target opponent draw a card\. If you do, copy that spell\. You may choose new targets for the copy\.$/.test(line)) { R.trig.push({ ev: 'cast', filter: 'any', cond: 'alania', effects: [{ t: 'optOppDraw' }, { t: 'copyLastCast', ifDo: true }] }); continue; }
        // ---- Starter kits (2026-10-06): Equipment ----
        if (/^Job select$/.test(line)) { R.etb.push({ t: 'token', n: 1, p: 1, q: 1, name: 'colorless hero', kw: [] }, { t: 'attachSelfToMade' }); continue; }
        if (/^For Mirrodin!$/.test(line)) { R.etb.push({ t: 'token', n: 1, p: 2, q: 2, name: 'red rebel', kw: [] }, { t: 'attachSelfToMade' }); continue; }
        if ((m = line.match(/^During your turn, equipped creature has (.+)\.$/))) { const kw = splitKw(m[1].replace(/can't be blocked/, 'unblockable')); if (allKnown(kw)) { R.buffCond = { cond: 'it is your turn', kw }; continue; } }
        if ((m = line.match(/^During your turn, as long as ~ is equipped, it has ([a-z ,]+)\.$/)) && allKnown(splitKw(m[1]))) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn and ~ is equipped', p: 0, q: 0, kw: splitKw(m[1]) }); continue; }
        if ((m = line.match(/^Equip abilities you activate that target ~ cost \{(\d+)\} less to activate\.$/))) { R.equipLessSelf = +m[1]; continue; }
        if ((m = line.match(/^Equip abilities you activate cost \{(\d+)\} less to activate\.$/))) { R.equipLess = +m[1]; continue; }
        // ---- Welcome decks (2026-10-06) ----
        if (/^~ can't be blocked by more than one creature\.$/.test(line)) { R.kw.add('maxoneblock'); continue; }
        if (/^~ can't attack or block alone\.$/.test(line)) { R.kw.add('notalone'); continue; }
        if (/^All creatures able to block ~ do so\.$/.test(line)) { R.kw.add('lure'); continue; }
        if (/^~ can block an additional creature each combat\.$/.test(line)) { R.kw.add('extrablock'); continue; }
        if (/^~ can block only creatures with flying\.$/.test(line)) { R.kw.add('blockflyonly'); continue; }
        if (/^~ can't be blocked except by three or more creatures\.$/.test(line)) { R.kw.add('minblock3'); continue; }
        if (/^~ can't be blocked except by creatures with flying or reach\.$/.test(line)) { R.kw.add('blockflyreach'); continue; }
        if ((m = line.match(/^~ can't be blocked except by ([A-Z][a-z]+)s\.$/))) { R.kw.add(`blockonly:${m[1]}`); continue; }
        if ((m = line.match(/^~ can't be blocked by creatures with power (\w+) or less\.$/)) && num(m[1]) !== undefined) { R.kw.add(`blockpowgt:${num(m[1])}`); continue; }
        if ((m = line.match(/^~ can't block unless (.+)\.$/)) && parseCond(m[1])) { R.blockCond = m[1]; continue; }
        if ((m = line.match(/^During your turn, ~ (?:has ([a-z ,]+)|gets \+(\d+)\/\+(\d+))\.$/)) && (!m[1] || allKnown(splitKw(m[1])))) { (R.selfCond = R.selfCond || []).push({ cond: 'it is your turn', p: +(m[2] || 0), q: +(m[3] || 0), kw: m[1] ? splitKw(m[1]) : [] }); continue; }
        if ((m = line.match(/^As long as ([^,]+), ~ has base power and toughness (\d+)\/(\d+)\.$/)) && parseCond(m[1])) { (R.selfCond = R.selfCond || []).push({ cond: m[1], p: 0, q: 0, kw: [], base: { p: +m[2], q: +m[3] } }); continue; }
        if ((m = line.match(/^As long as ([^,]+), ~ gets \+(\d+)\/\+(\d+) and is all creature types\.$/)) && parseCond(m[1])) { (R.selfCond = R.selfCond || []).push({ cond: m[1], p: +m[2], q: +m[3], kw: ['changeling'] }); continue; }
        // Lords with a filter
        if ((m = line.match(/^(Other )?([A-Z][a-z]+) and ([A-Z][a-z]+) you control (?:get \+(\d+)\/\+(\d+)|have ([a-z ,]+))\.$/)) && (!m[6] || allKnown(splitKw(m[6])))) {
            const ty = [m[2], m[3]].map(w => PLURAL_TYPES[w] || w.replace(/s$/, ''));
            R.statics.push({ other: !!m[1], types: ty, p: +(m[4] || 0), q: +(m[5] || 0), kw: m[6] ? splitKw(m[6]) : [] }); continue;
        }
        if ((m = line.match(/^(Other )?([Aa]rtifact creatures|[Cc]reature tokens) you control get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ other: !!m[1], type: null, match: /tokens/.test(m[2]) ? 'token' : 'artifact', p: +m[3], q: +m[4], kw: [] }); continue; }
        if ((m = line.match(/^Attacking ([A-Z][a-z]+) you control have ([a-z ,]+)\.$/)) && allKnown(splitKw(m[2]))) { R.statics.push({ type: PLURAL_TYPES[m[1]] || m[1].replace(/s$/, ''), match: 'attacking', p: 0, q: 0, kw: splitKw(m[2]) }); continue; }
        if ((m = line.match(/^Creatures with flying your opponents control get ([+-]\d+)\/([+-]\d+)\.$/))) { R.statics.push({ type: null, match: 'flying', opp: true, global: true, p: +m[1], q: +m[2], kw: [] }); continue; }
        if (/^Creatures you control with power or toughness 1 or less can't be blocked\.$/.test(line)) { R.statics.push({ type: null, match: 'pt1', p: 0, q: 0, kw: ['unblockable'] }); continue; }
        if (/^Instant and sorcery spells you control can't be countered\.$/.test(line)) { R.protectSpells = true; continue; }
        if (/^You may cast creature spells from the top of your library\.$/.test(line)) { R.castTopCreatures = true; continue; }
        if (/^Play with the top card of your library revealed\.$/.test(line)) { R.revealTop = true; continue; }
        if (/^You can spend mana of any type to cast creature spells\.$/.test(line)) { R.anyManaCreatures = true; continue; }
        // Costs
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast if it targets (.+)\.$/))) { R.costLessTgt = { n: +m[1], what: m[2] }; continue; }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast if (.+)\.$/)) && parseCond(m[2])) { R.costLessIf = { n: +m[1], cond: m[2] }; continue; }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast for each attacking creature you control\.$/))) { R.costLess = { n: +m[1], what: 'the number of attacking creatures you control' }; continue; }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast for each (creature that attacked this turn|creature you attacked with this turn)\.$/))) { R.costLess = { n: +m[1], what: 'the number of creatures that attacked this turn' }; continue; }
        if ((m = line.match(/^(Instant and sorcery|Creature|Artifact|Enchantment|[A-Z][a-z]+) spells you cast (?:with power (\w+) or greater )?cost \{(\d+)\} less to cast\.$/))) { R.reducer = { what: m[1], minPow: m[2] ? num(m[2]) : 0, n: +m[3] }; continue; }
        // Auras
        if (/^Enchant land$/i.test(line)) { R.aura = true; R.auraLand = true; continue; }
        if ((m = line.match(/^Enchanted creature gets ([+-]\d+)\/([+-]\d+) and (can't block|can't be blocked|has ([a-z ,]+) and ward \{(\d+)\})\.$/i))) {
            const kw = m[3] === "can't block" ? ['cantblock'] : m[3] === "can't be blocked" ? ['unblockable'] : [...splitKw(m[4]), `ward:${m[5]}`];
            if (allKnown(kw)) { R.buff = { p: +m[1], q: +m[2], kw }; if (m[3] === "can't block") R.buffBad = false; continue; }
        }
        if (/^Enchanted creature is an? [A-Z][a-z]+ and can't attack or block\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['cantattack', 'cantblock'] }; R.buffBad = true; continue; }
        if ((m = line.match(/^(?:Enchanted|Equipped) creature gets \+(\d+)\/\+(\d+) for each (.+?)(?: and has ([a-z ,]+))?\.$/)) && countFn(`the number of ${m[3]}`) && (!m[4] || allKnown(splitKw(m[4])))) { R.buff = { p: 0, q: 0, kw: m[4] ? splitKw(m[4]) : [] }; R.buffPer = { p: +m[1], q: +m[2], what: `the number of ${m[3]}` }; continue; }
        if ((m = line.match(/^Enchanted creature gets -X\/-X, where X is the number of (.+)\.$/)) && countFn(`the number of ${m[1]}`)) { R.buff = { p: 0, q: 0, kw: [] }; R.buffBad = true; R.buffPer = { p: -1, q: -1, what: `the number of ${m[1]}`, host: true }; continue; }
        if ((m = line.match(/^(?:Enchanted|Equipped) (creature|land) (?:gets ([+-]\d+)\/([+-]\d+) and )?has "(.+)"$/))) {
            // A granted ability, read as if it were printed on the enchanted permanent
            const inner = m[4].replace(/\.$/, '.').replace(/\bthis creature\b|\bthis land\b/g, '~');
            const tr = parseTrigger(inner), act = !tr && parseActivated(inner, R);
            const untapEach = /^Untap ~ during each other player's untap step\.?$/.test(inner);
            if (tr || act || untapEach) {
                R.buff = R.buff || { p: 0, q: 0, kw: [] };
                if (m[2]) { R.buff.p += +m[2]; R.buff.q += +m[3]; }
                R.grant = { trig: tr || [], acts: act ? [act] : [], untapEach };
                continue;
            }
        }
        if ((m = line.match(/^Enchanted land is an? (Plains|Island|Swamp|Mountain|Forest)\.$/))) { R.landBecomes = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' }[m[1]]; continue; }
        if ((m = line.match(/^Whenever enchanted land becomes tapped, (.+)$/))) { const fx = parseEffects(m[1].replace(/^its controller (loses|mills)/, (a, v) => `target player ${v}`)); if (fx) { R.trig.push({ ev: 'tapped', host: true, effects: fx.map(e => ({ ...e, hostCtrl: true })) }); continue; } }
        if (/^When ~ leaves the battlefield, return the exiled card(?:s)? to the battlefield under (?:its|their) owners?'s? control\.$/.test(line)) { R.leaveReturn = true; continue; }
        if ((m = line.match(/^If ([^,]+), you may cast ~ without paying its mana cost\.$/)) && parseCond(m[1])) { R.freeIf = m[1]; continue; }
        const kws = splitKw(line.replace(/\.$/, ''));
        if (kws.length && kws.every(k => KEYWORDS.includes(k) || /^ward \{\d+\}$/.test(k))) {
            kws.forEach(k => { const w = k.match(/^ward \{(\d+)\}$/); if (w) R.ward = Number(w[1]); else R.kw.add(k); });
            continue;
        }
        if ((m = line.match(/^Ward \{(\d+)\}$/))) { R.ward = Number(m[1]); continue; }
        // Ward—Pay N life (Hexing Squelcher), also given to your other creatures
        if ((m = line.match(/^Ward—Pay (\d+) life\.$/))) { R.wardLife = +m[1]; continue; }
        if ((m = line.match(/^Other creatures you control have "Ward—Pay (\d+) life\."$/))) { R.wardLifeOthers = +m[1]; continue; }
        if (/^Nontoken creatures you control have riot\.$/.test(line)) { R.riotAll = true; continue; }
        // ---- Brudiclad deck (2026-10-07) ----
        if (/^If you would create a Clue, Food, or Treasure token, instead create one of each\.$/.test(line)) { R.manufactor = true; continue; } // Academy Manufactor
        if (/^Treasures you control have "\{T\}, Sacrifice ~: Add two mana of any one color\."$/.test(line)) { R.bigTreasure = true; continue; } // Goldspan Dragon
        if (/^~ can be your commander\.$/.test(line)) continue;
        if (/^Jump-start$/.test(line)) { R.gyCast = { life: 0, discard: 1, exile: true }; continue; } // 702.133
        if ((m = line.match(/^Whenever ~ attacks or becomes the target of a spell, (.+)$/)) && parseEffects(m[1])) { const fx = parseEffects(m[1]); R.trig.push({ ev: 'attacks', effects: fx }, { ev: 'targeted', effects: fx }); continue; }
        if ((m = line.match(/^Whenever a nontoken creature dies, you may exile that card\. If you do, return each other card exiled with ~ to its owner's graveyard\.$/))) { R.trig.push({ ev: 'creatureDies', any: true, nontoken: true, effects: [{ t: 'vatImprint' }] }); continue; } // Mimic Vat
        if (/^\{3\}, \{T\}: Create a token that's a copy of a card exiled with ~\. It gains haste\. Exile it at the beginning of the next end step\.$/.test(line)) { R.acts.push({ cost: { mana: parseCost('{3}'), tap: true, sacSelf: false, life: 0, discard: 0 }, effects: [{ t: 'vatCopy' }], text: line }); continue; }
        if (/^\{X\}, \{T\}: Create a token that's a copy of the exiled card\. X is the mana value of that card\.$/.test(line)) { R.acts.push({ cost: { mana: parseCost(''), tap: true, sacSelf: false, life: 0, discard: 0, xImprint: true }, effects: [{ t: 'imprintCopy' }], text: line }); continue; } // Prototype Portal
        if (/^Whenever an opponent taps an artifact for mana, gain control of that artifact until the end of your next turn\.$/.test(line)) { R.trig.push({ ev: 'artifactMana', effects: [{ t: 'nabArtifact' }] }); continue; } // Treasure Nabber
        // ---- Sandman deck (2026-10-07) ----
        if (/^Lands you control enter untapped\.$/.test(line)) { R.landsUntapped = true; continue; } // Horizon Explorer, Spelunking
        if (/^Whenever you tap a land for mana, add \{([WUBRG])\}\.$/.test(line)) { R.extraMana = { all: true, color: line.match(/\{([WUBRG])\}/)[1] }; continue; } // Groundchuck & Dirtbag
        if ((m = line.match(/^Lands you control are (Plains|Islands|Swamps|Mountains|Forests) in addition to their other types\.$/))) { R.landTypeMine = m[1] === 'Plains' ? 'Plains' : m[1].slice(0, -1); continue; } // Swampbenders
        if ((m = line.match(/^Protection from ([a-z]+s) and from ([A-Z][a-z]+?)s$/)) && m[1] === 'planeswalkers') { R.proTypes = ['Planeswalker', m[2]]; continue; } // Greensleeves
        if (/^~ gets \+10\/\+10 for each player who has lost the game\.$/.test(line)) continue; // two-player games end when a player loses, so this never applies
        if (/^~ gets \+1\/\+1 for each land you control and each land card in your graveyard\.$/.test(line)) { R.cdaAdd = { p: 1, q: 1, what: 'the number of lands you control plus the number of land cards in your graveyard' }; continue; } // Multani
        if ((m = line.match(/^~ enters with a \+1\/\+1 counter on it for each (.+)\.$/)) && countFn(`the number of ${m[1]}`)) { R.etbCountersPer = `the number of ${m[1]}`; continue; } // Michelangelo
        if ((m = line.match(/^Encore ((?:\{[^}]+\})+)$/))) { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(m[1]), tap: false, exileSelfGy: true }, effects: [{ t: 'encore' }], text: `Encore ${m[1]}`, sorcery: true, gy: true }); continue; }
        if ((m = line.match(/^Foretell ((?:\{[^}]+\})+)$/))) { R.foretell = parseCost(m[1]); continue; }
        // ---- Magic 2010 (2026-10-08) ----
        if (/^~ costs \{1\} more to cast for each target beyond the first\.$/.test(line)) continue; // Fireball: played with one target, so the extra-target cost is never paid (a shortcut)
        if (/^Enchant tapped creature$/.test(line)) { R.aura = true; R.auraTarget = 'tapped creature'; continue; }
        if (/^Enchant permanent$/.test(line)) { R.aura = true; R.auraTarget = 'permanent'; continue; }
        if (/^Enchanted permanent has indestructible\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['indestructible'] }; continue; }
        if ((m = line.match(/^(.+), protection from ([A-Z][a-z]+?)s and from ([A-Z][a-z]+?)s$/)) && allKnown(splitKw(m[1].toLowerCase()))) { splitKw(m[1].toLowerCase()).forEach(k => R.kw.add(k)); R.proTypes = [...(R.proTypes || []), m[2], m[3]]; continue; } // Baneslayer Angel
        if ((m = line.match(/^~ can't be blocked except by (white|blue|black|red|green) creatures\.$/))) { R.kw.add(`blockonlycolor:${COLOR_WORDS[m[1]]}`); continue; }
        if (/^~ can block any number of creatures\.$/.test(line)) { R.kw.add('blockany'); continue; }
        if (/^If a source an opponent controls would deal damage to you, prevent 1 of that damage\.$/.test(line)) { R.seraph = true; continue; }
        if (/^Prevent all noncombat damage that would be dealt to equipped creature\.$/.test(line)) { R.buff = R.buff || { p: 0, q: 0, kw: [] }; R.buff.kw.push('nononcombat'); continue; }
        if (/^If damage would be dealt to ~, prevent that damage and remove that many \+1\/\+1 counters from it\.$/.test(line)) { R.protean = true; continue; }
        if (/^Whenever a \+1\/\+1 counter is removed from ~, put two \+1\/\+1 counters on it at the beginning of the next end step\.$/.test(line)) { R.protean = true; continue; } // done in damage() / endTurn
        if (/^~ gets \+1\/\+1 for each other creature on the battlefield named ~\.$/.test(line)) { R.namedBuff = true; continue; }
        if (/^A deck can have any number of cards named ~\.$/.test(line)) { R.anyNumber = true; continue; }
        if ((m = line.match(/^~ can't attack unless defending player controls an? ([A-Z][a-z]+)\.$/))) { R.attackNeedsLand = m[1]; continue; }
        if (/^Your opponents play with their hands revealed\.$/.test(line)) { R.telepathy = true; continue; }
        if (/^As ~ enters, choose a basic land type\.$/.test(line)) { R.chooseLandType = true; continue; }
        if (/^Enchanted land is the chosen type\.$/.test(line)) { R.landBecomes = 'chosen'; continue; }
        if (/^If ~ would be put into a graveyard from anywhere, reveal ~ and shuffle it into its owner's library instead\.$/.test(line)) { R.shuffleInstead = true; continue; }
        if (/^Whenever a player taps a land for mana, ~ deals 1 damage to that player\.$/.test(line)) { R.manabarbs = true; continue; }
        if (/^You control enchanted creature\.$/.test(line)) { R.auraSteal = true; R.buffBad = true; continue; }
        if (/^As ~ enters, choose a card name\.$/.test(line)) { R.needle = true; continue; }
        if (/^Activated abilities of sources with the chosen name can't be activated unless they're mana abilities\.$/.test(line)) { R.needle = true; continue; }
        if (/^Each creature gets \+1\/\+1 for each other creature on the battlefield that shares at least one creature type with it\.$/.test(line)) { R.coatOfArms = true; continue; }
        if ((m = line.match(/^As long as the top card of your library is black, ~ and other ([A-Z][a-z]+) creatures you control get \+(\d+)\/\+(\d+) and have ([a-z ]+)\.$/)) && allKnown(splitKw(m[4]))) { R.statics.push({ type: m[1], p: +m[2], q: +m[3], kw: splitKw(m[4]), cond: 'the top card of your library is black' }); continue; }
        if ((m = line.match(/^~ enters with (\w+) (wish|charge|time|fade|age|quest|oil) counters on it\.$/)) && num(m[1])) { R.etbNamedN = { kind: m[2], n: num(m[1]) }; continue; }
        if (R.kind === 'planeswalker' && (m = line.match(/^−X: (.+)$/))) { let fx = parseEffects(xSub(m[1])); if (fx) { fx = xMarkDeep(fx); if (hasXMark(fx)) { R.acts.push({ loyalty: 0, loyaltyX: true, effects: fx, text: line, sorcery: true }); continue; } } }
        if (R.kind === 'planeswalker' && (m = line.match(/^−(\d+): Create a white Avatar creature token\. It has "~'s power and toughness are each equal to your life total\."$/))) { R.acts.push({ loyalty: -Number(m[1]), effects: [{ t: 'lifeAvatar' }], text: line, sorcery: true }); continue; }
        // ---- Mirrodin (2026-10-08) ----
        if ((m = line.match(/^Entwine—Sacrifice (two|three) lands\.$/))) { R.kicker = parseCost(''); R.entwine = true; R.kickSac = { kind: 'land', n: num(m[1]) }; continue; }
        if (/^Equip costs you pay cost \{1\} less\.$/.test(line)) { R.equipLess = 1; continue; }
        if ((m = line.match(/^As long as ~ is equipped, each creature you control that's a ([A-Z][a-z]+) or an? ([A-Z][a-z]+) gets \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ types: [m[1], m[2]], p: +m[3], q: +m[4], kw: [], cond: '~ is equipped' }); continue; }
        if ((m = line.match(/^As long as ~ is equipped, it gets \+(\d+)\/\+(\d+)(?: and has ([a-z ,]+))?\.$/)) && (!m[3] || allKnown(splitKw(m[3])))) { (R.selfCond = R.selfCond || []).push({ cond: '~ is equipped', p: +m[1], q: +m[2], kw: m[3] ? splitKw(m[3]) : [] }); continue; }
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) for each (.+)\.$/)) && countFn(`the number of ${m[3].replace(/ it$/, ' ~')}`)) { R.buff = { p: 0, q: 0, kw: [] }; R.buffPer = { p: +m[1], q: +m[2], what: `the number of ${m[3].replace(/ it$/, ' ~')}`, host: true }; continue; }
        if (/^Equipped creature has trample and can't be blocked by more than one creature\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['trample', 'maxoneblock'] }; continue; }
        if ((m = line.match(/^Equipped creature gets \+(\d+)\/\+(\d+) and doesn't untap during its controller's untap step\.$/))) { R.buff = { p: +m[1], q: +m[2], kw: ['nountap'] }; continue; }
        if ((m = line.match(/^Equip—Pay (\d+) life\.?$/))) { R.equip = parseCost(''); R.equipLife = +m[1]; R.equipText = `Pay ${m[1]} life`; continue; }
        if (/^Enchant artifact$/.test(line)) { R.aura = true; R.auraTarget = 'artifact'; continue; }
        if (/^Enchant artifact creature$/.test(line)) { R.aura = true; R.auraTarget = 'artifact creature'; continue; }
        if (/^You control enchanted artifact creature\.$/.test(line)) { R.auraSteal = true; R.buffBad = true; continue; }
        if (/^Enchanted artifact doesn't untap during its controller's untap step\.$/.test(line)) { R.buff = { p: 0, q: 0, kw: ['nountap'] }; R.buffBad = true; continue; }
        if (/^Enchanted artifact has "At the beginning of your upkeep, you lose 2 life\."$/.test(line)) { R.buffBad = true; R.trig.push({ ev: 'upkeep', who: 'host', effects: [{ t: 'hostCtlLose', n: 2 }] }); continue; }
        if (/^Whenever enchanted creature becomes the target of a spell or ability, that spell or ability's controller gains control of that creature\.$/.test(line)) { R.buffBad = true; R.trig.push({ ev: 'targeted', host: true, effects: [{ t: 'loyaltyFracture' }] }); continue; }
        if (/^Whenever enchanted creature attacks or blocks, its controller loses 3 life\.$/.test(line)) { R.buffBad = true; R.trig.push({ ev: 'attacks', host: true, effects: [{ t: 'hostCtlLose', n: 3 }] }, { ev: 'blocks', host: true, effects: [{ t: 'hostCtlLose', n: 3 }] }); continue; }
        if (/^Whenever ~ attacks or blocks, remove a \+1\/\+1 counter from it at end of combat\.$/.test(line)) { R.clockwork = true; continue; }
        if (/^~ can't be blocked as long as defending player controls an artifact\.$/.test(line)) { R.spy = true; continue; }
        if (/^~ can't attack or block unless you pay \{1\} for each \+1\/\+1 counter on it\.$/.test(line)) { R.protoTax = true; continue; }
        if (/^\{T\}: Add an amount of \{G\} equal to ~'s power\.$/.test(line)) { R.mana = { colors: ['G'], n: 1, nPow: true }; continue; }
        if (/^\{T\}: Add one mana of any of the exiled card's colors\.$/.test(line)) { R.mana = { colors: [...COLORS], n: 1, imprintColors: true }; continue; }
        if (/^Whenever a land with the same name as the exiled card is tapped for mana, its controller adds one mana of any type that land produced\.$/.test(line)) { R.lens = true; continue; }
        if (/^~ has protection from each of the exiled card's card types\.$/.test(line)) { R.mirrorPro = true; continue; }
        if (/^As long as a card exiled with ~ is a creature card, ~ has the power, toughness, and creature types of the last creature card exiled with it\. It's still a Shapeshifter\.$/.test(line)) { R.duplicant = true; continue; }
        if (/^Whenever a player casts a spell that shares a color or mana value with the exiled card, ~ deals 2 damage to that player\.$/.test(line)) { R.trig.push({ ev: 'cast', who: 'any', filter: 'any', fn: 'prison', effects: [{ t: 'dmgCtxPlayer', n: 2 }] }); continue; }
        if (/^Whenever a player casts a card, if it has the same name as one of the cards exiled with ~, you may copy the other\. If you do, you may cast the copy without paying its mana cost\.$/.test(line)) { R.trig.push({ ev: 'cast', who: 'any', filter: 'any', fn: 'helix', effects: [{ t: 'helixCopy' }] }); continue; }
        if (/^Whenever a player casts a spell with mana value equal to the number of charge counters on ~, counter that spell\.$/.test(line)) { R.chalice = true; continue; }
        if (/^Activated abilities of artifacts and creatures can't be activated unless they're mana abilities\.$/.test(line)) { R.damping = true; continue; }
        if (/^You can't cast creature spells\.$/.test(line)) { R.noCreatureSpells = true; continue; }
        if (/^Each player can't cast more than one spell each turn\.$/.test(line)) { R.ruleOfLaw = true; continue; }
        if (/^Each artifact spell costs \{1\} more to cast for each artifact its controller controls\.$/.test(line)) { R.hum = true; continue; }
        if (/^If an artifact would deal damage to you, prevent 1 of that damage\.$/.test(line)) { R.sphere = true; continue; }
        if (/^You can't lose the game and your opponents can't win the game\.$/.test(line)) { R.cantLose = true; continue; }
        if (/^If you would flip a coin, instead flip two coins and ignore one\.$/.test(line)) { R.thumb = true; continue; }
        if (/^If a player would draw a card, that player exiles the top card of one of their opponents' libraries face down instead\.$/.test(line)) { R.sharedFate = true; continue; }
        if (/^Each player may look at cards they exiled with ~, and they may play lands and cast spells from among those cards\.$/.test(line)) continue; // Shared Fate: in drawCards
        if (/^All creatures have haste\.$/.test(line)) { R.statics.push({ global: true, p: 0, q: 0, kw: ['haste'] }); continue; }
        if (/^Each noncreature artifact is an artifact creature with power and toughness each equal to its mana value\.$/.test(line)) { R.march = true; continue; }
        if (/^Whenever ~ or another artifact enters, put a charge counter on ~\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'artAnyOrSelf', effects: [{ t: 'namedCounter', n: 1, kind: 'charge' }] }); continue; }
        if (/^Whenever an artifact enters, you may gain 1 life\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'artAny', effects: [{ t: 'gain', n: 1 }] }); continue; }
        if (/^Whenever an artifact enters, ~ gets \+4\/\+4 until end of turn\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'artAny', effects: [{ t: 'pump', p: 4, q: 4, kw: [], target: 'self', good: true }] }); continue; }
        if (/^Whenever an artifact is put into a graveyard from the battlefield, you may have target opponent lose 1 life\.$/.test(line)) { R.trig.push({ ev: 'artifactToGy', effects: [{ t: 'drain', n: 1 }] }); continue; }
        if (/^Whenever ~ or another artifact creature dies, you may untap target artifact\.$/.test(line)) { R.trig.push({ ev: 'creatureDies', fn: 'artCreatureDies', effects: [{ t: 'untap', target: 'perm', filter: 'artifact', good: true }] }); continue; }
        if (/^Whenever a source an opponent controls deals damage to you, if ~ is untapped, you may draw a card\.$/.test(line)) { R.trig.push({ ev: 'playerDamaged', fn: 'oppSourceToMe', cond: '~ is untapped', effects: [{ t: 'draw', n: 1 }] }); continue; }
        if (/^Whenever you're dealt damage, put that many charge counters on ~\.$/.test(line)) { R.trig.push({ ev: 'playerDamaged', fn: 'toMe', effects: [{ t: 'namedCounter', n: 0, nFrom: 'ctxCount', kind: 'charge' }] }); continue; }
        if (/^Whenever an opponent is dealt damage, put that many \+1\/\+1 counters on ~\.$/.test(line)) { R.trig.push({ ev: 'playerDamaged', fn: 'toOpp', effects: [{ t: 'counters', n: 0, nFrom: 'ctxCount', target: 'self' }] }); continue; }
        if (/^Whenever a spell or ability causes a player to shuffle their library, ~ deals 2 damage to that player\.$/.test(line)) { R.trig.push({ ev: 'shuffled', effects: [{ t: 'dmgCtxPlayer', n: 2 }] }); continue; }
        if (/^Whenever a player casts a creature spell, that player adds \{G\}\.$/.test(line)) { R.trig.push({ ev: 'cast', who: 'any', filter: 'creature', effects: [{ t: 'casterMana', color: 'G' }] }); continue; }
        if (/^Whenever a permanent becomes untapped, that permanent's controller mills a card\.$/.test(line)) { R.mesmeric = true; continue; }
        if (/^Whenever an artifact, creature, or enchantment enters, its controller chooses target permanent another player controls that shares a card type with it\. Exchange control of those permanents\.$/.test(line)) { R.trig.push({ ev: 'enters', fn: 'confusion', effects: [{ t: 'confusion' }] }); continue; }
        if (/^Whenever ~ deals combat damage to a creature, that creature's controller loses that much life\.$/.test(line)) { R.trig.push({ ev: 'dealsDamage', fn: 'selfCombatCreature', effects: [{ t: 'ctxCtlLoseN' }] }); continue; }
        if (/^Whenever equipped creature deals combat damage, put a charge counter on ~\.$/.test(line)) { R.trig.push({ ev: 'dealsDamage', fn: 'hostCombat', once: 'banshee', effects: [{ t: 'namedCounter', n: 1, kind: 'charge' }] }); continue; }
        if (/^Whenever equipped creature deals damage to a creature, exile that creature\.$/.test(line)) { R.trig.push({ ev: 'dealsDamage', fn: 'hostToCreature', effects: [{ t: 'exileCtx' }] }); continue; }
        if (/^Whenever equipped creature blocks or becomes blocked by a creature, destroy both creatures\.$/.test(line)) { R.trig.push({ ev: 'blocks', host: true, effects: [{ t: 'destroyCombatPair' }] }, { ev: 'blocked', host: true, effects: [{ t: 'destroyCombatPair' }] }); continue; }
        if (/^Whenever a creature dealt damage by equipped creature this turn dies, return that card to the battlefield under your control\. Attach ~ to that creature\.$/.test(line)) { R.scythe = true; continue; }
        if (/^Whenever ~ becomes blocked by an artifact creature, destroy that creature\.$/.test(line)) { R.trig.push({ ev: 'blocked', effects: [{ t: 'destroyBlockers', filter: 'artifact creature' }] }); continue; }
        if (/^Whenever ~ becomes blocked, you may return target card named ~ from your graveyard to your hand\.$/.test(line)) { R.trig.push({ ev: 'blocked', effects: [{ t: 'regrowNamed' }] }); continue; }
        if (/^At the beginning of the end step, if you control no artifacts, sacrifice ~\.$/.test(line)) { R.trig.push({ ev: 'end', who: 'each', cond: 'you control no artifacts', effects: [{ t: 'sacSelf' }] }); continue; }
        if (/^At the beginning of each player's first main phase, if ~ is untapped, that player adds \{C\} for each artifact they control\.$/.test(line)) { R.trig.push({ ev: 'main1', who: 'each', cond: '~ is untapped', effects: [{ t: 'urnMana' }] }); continue; }
        if (/^At the beginning of each player's upkeep, that player sacrifices an artifact of their choice\.$/.test(line)) { R.trig.push({ ev: 'upkeep', who: 'each', effects: [{ t: 'activeSacArt' }] }); continue; }
        if (/^Spend only black mana on (?:X|97)\.$/.test(line)) { R.xBlackOnly = true; continue; }
        if (/^At the beginning of your upkeep, if ~ has five or more charge counters on it, remove all of them from it and create that many 3\/1 red Elemental creature tokens with haste\. Exile them at the beginning of the next end step\.$/.test(line)) { R.trig.push({ ev: 'upkeep', effects: [{ t: 'coils' }] }); continue; }
        if (/^You may spend blue mana as though it were mana of any color to pay the activation costs of ~'s abilities\.$/.test(line)) { R.blueAny = true; continue; }
        // ---- Gitrog deck (2026-10-08) ----
        if ((m = line.match(/^Warp ((?:\{[^}]+\})+)$/))) { R.warp = parseCost(m[1]); continue; }
        if ((m = line.match(/^Bestow ((?:\{[^}]+\})+)$/))) { R.bestow = parseCost(m[1]); continue; }
        if ((m = line.match(/^Blitz—((?:\{[^}]+\})+)(?:, Pay (\d+) life)?\.?$/))) { R.blitz = { cost: parseCost(m[1]), life: +(m[2] || 0) }; continue; }
        if (/^You may cast ~ from your graveyard using its blitz ability\.$/.test(line)) { R.blitzGy = true; continue; }
        if ((m = line.match(/^Saddle (\d+)$/))) { R.saddle = +m[1]; continue; }
        if ((m = line.match(/^You may pay (\w+) \{E\} rather than pay the mana cost for permanent spells you cast\.$/)) && num(m[1])) { R.energyAlt = num(m[1]); continue; }
        if (/^You may cast spells from the top of your library by sacrificing a nonland permanent in addition to paying their other costs\.$/.test(line)) { R.castTopSac = true; continue; }
        if ((m = line.match(/^Each creature you control with power (\d+) or greater can't be blocked by more than one creature\.$/))) { R.bigOneBlock = +m[1]; continue; }
        if (/^If at least three green mana was spent to cast ~, instead return those cards to your hand and exile ~\.$/.test(line)) continue; // Once and Future's adamant: in its effect
        if (/^As long as ~ is on the battlefield, it's a land in addition to its other types\.$/.test(line)) { R.alsoLand = true; continue; }
        if ((m = line.match(/^~'s power is equal to (.+) and its toughness is equal to that number plus (\d+)\.$/)) && countFn(m[1])) { R.cdaSet = { p: m[1], q: m[1], qPlus: +m[2] }; continue; }
        if ((m = line.match(/^Entwine ((?:\{[^}]+\})+)$/))) { R.kicker = parseCost(m[1]); R.entwine = true; continue; }
        if (/^Demonstrate$/.test(line)) { R.demonstrate = true; continue; }
        // Mobilize N (702.181): attacking 1/1 red Warriors, sacrificed at the next end step
        if ((m = line.match(/^Mobilize (\d+)$/))) { R.trig.push({ ev: 'attacks', effects: [{ t: 'token', n: +m[1], p: 1, q: 1, name: 'red warrior', kw: [], attacking: true, sacEnd: true }] }); continue; }
        if ((m = line.match(/^Crew (\d+)$/))) { R.crew = Number(m[1]); continue; }
        if ((m = line.match(/^Toxic (\d+)$/))) { R.toxic = Number(m[1]); continue; }
        if (/^Affinity for artifacts$/.test(line)) { R.affinity = 'artifacts'; continue; }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast for each (.+)\.$/)) && countFn(`the number of ${m[2]}`)) { R.costLess = { n: Number(m[1]), what: `the number of ${m[2]}` }; continue; }
        if (/^(?:You may look at the top card of your library any time|You may look at the top card of your library any time, and you may .+)\.$/.test(line) && /any time\.$/.test(line)) { R.peekTop = true; continue; }
        if (/^As ~ enters(?: the battlefield)?, choose a creature type\.$/.test(line)) { R.chooseType = true; continue; }
        if ((m = line.match(/^(Other )?[Cc]reatures you control of the chosen type get \+(\d+)\/\+(\d+)(?: and have ([a-z ,]+))?\.$/))) { R.statics.push({ other: !!m[1], type: '*chosen', p: +m[2], q: +m[3], kw: m[4] ? splitKw(m[4]) : [] }); continue; }
        if ((m = line.match(/^Kicker ((?:\{[^}]+\})+)$/))) { const k = parseCost(m[1]); if (!k.x && !k.odd) { R.kicker = k; continue; } }
        if ((m = line.match(/^As an additional cost to cast ~, (sacrifice an artifact or creature|sacrifice a creature|return a land you control to its owner's hand)(?: or pay ((?:\{[^}]+\})+))?\.$/)) && (m[2] || !/^sacrifice a creature$/.test(m[1]))) {
            R.addCost = /land/.test(m[1]) ? { returnLand: true } : { sac: /artifact or creature/.test(m[1]) ? 'artifact or creature' : 'creature', orPay: m[2] ? parseCost(m[2]) : null };
            continue;
        }
        if (/^As an additional cost to cast ~, sacrifice a land\.$/.test(line)) { R.addCost = { sac: 'land' }; continue; }
        if (/^As an additional cost to cast ~, sacrifice an artifact or discard a card\.$/.test(line)) { R.addCost = { sac: 'artifact', orDiscard: true }; continue; }
        if ((m = line.match(/^As an additional cost to cast ~, (sacrifice a creature|sacrifice an artifact|discard a card|pay (\d+) life)\.$/))) {
            R.addCost = m[1].startsWith('sacrifice') ? { sac: m[1].endsWith('creature') ? 'creature' : 'artifact' } : m[1].startsWith('discard') ? { discard: 1 } : { life: Number(m[2]) };
            continue;
        }
        if (/^~ enters(?: the battlefield)? with X \+1\/\+1 counters on it\.$/.test(line)) { R.etbCounters = 'X'; continue; }
        if ((m = line.match(/^When you cast ~, (.+)$/)) && parseEffects(m[1])) { R.castTrig = parseEffects(m[1]); continue; }
        if (/^Ravenous$/.test(line)) { R.etbCounters = 'X'; R.ravenous = true; continue; }
        if ((m = line.match(/^~ enters(?: the battlefield)? with X (charge|oil|fire|time|quest) counters on it\.$/))) { R.etbNamedX = m[1]; continue; }
        if (/^~ enters with a number of \+1\/\+1 counters on it equal to the amount of mana spent to cast it\.$/.test(line)) { R.etbCounters = 'spent'; continue; }
        if (/^Improvise$/.test(line)) { R.kw.add('improvise'); continue; }
        if (/^Nonartifact spells you cast have improvise\.$/.test(line)) { R.improviseAll = true; continue; }
        // Power and toughness that count something (*/* and "+1/+1 for each")
        if ((m = line.match(/^~'s power and toughness are each equal to (.+)\.$/)) && countFn(m[1])) { R.cdaSet = { p: m[1], q: m[1] }; continue; }
        if ((m = line.match(/^~'s power is equal to (.+)\.$/)) && countFn(m[1])) { R.cdaSet = { p: m[1], q: null }; continue; }
        if ((m = line.match(/^~ gets \+(\d+)\/\+(\d+) for each (.+)\.$/)) && countFn(`the number of ${m[3]}`)) { R.cdaAdd = { p: +m[1], q: +m[2], what: `the number of ${m[3]}` }; continue; }
        // Saga chapters: "I, II — effect"
        if (/\bSaga\b/.test(t) && (m = line.match(/^((?:I|II|III|IV|V|VI)(?:, (?:I|II|III|IV|V|VI))*) — (.+)$/))) {
            const fx = parseEffects(m[2]);
            if (fx) { R.saga = R.saga || {}; m[1].split(', ').forEach(r => { R.saga[ROMAN[r]] = fx; }); continue; }
        }
        if (/^~ attacks each combat if able\.$/.test(line)) { R.mustAttack = true; continue; }
        // ---- Tyrox deck (2026-10-08) ----
        if (/^Other Goblin creatures you control attack each combat if able\.$/.test(line)) { R.forceGoblins = true; continue; }
        if ((m = line.match(/^Spectacle ((?:\{[^}]+\})+)$/)) && !parseCost(m[1]).odd) { R.alt = { mana: parseCost(m[1]), life: 0, exile: null, cond: 'an opponent lost life this turn', text: `pay ${m[1]} (spectacle: an opponent lost life this turn)` }; continue; }
        if ((m = line.match(/^(?:If ~ hasn't been exerted this turn, )?[Yy]ou may exert (?:~|it) as it attacks\. When you do, (.+)$/))) {
            const body = m[1].replace(/^it deals/, '~ deals').replace(/ and after this phase, there is an additional combat phase\.?$/, ' and §celebrant.').replace(/^untap all other creatures you control and §celebrant\.$/, '§celebrant.');
            const fx = parseEffects(body);
            if (fx) { R.exert = true; R.trig.push({ ev: 'exerted', effects: fx }); continue; }
        }
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

