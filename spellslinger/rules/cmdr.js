// Spellslinger Duels - rules pack: the Commander precons of the last four sets (2026-10-15): FDC, FRC, SOC and MSC.
// Wordings only; the engine pieces are in 15d-cmdr-*.js (CMD functions run by the `cmd` effect, `fn: 'spec'` trigger filters, statics with `spec`).
const CMD_REWRITES = [
    [/Create two tokens that are copies of target permanent an opponent controls\. They gain haste\. At the beginning of the next end step, sacrifice them\./g, '§venserCopies.'],
    [/Copy target instant or sorcery spell an opponent controls twice\. You may choose new targets for the copies\./g, '§venserSpell.']
];
function cmdRewrite(t) { for (const [re, to] of CMD_REWRITES) t = t.replace(re, to); return t; }
const CL = []; // [regex, (R, m, ctx) => void] whole-line readers
const cl = (re, fn) => CL.push([re, fn]);
const SPEC = (ev, spec, extra) => ({ ev, fn: 'spec', spec, ...(extra || {}) });
const cmd = (id, extra) => ({ t: 'cmd', id, ...(extra || {}) });
const selfCond = (R, c) => (R.selfCond = R.selfCond || []).push(c);
const mite = n => ({ t: 'token', n, p: 1, q: 1, name: 'colorless Phyrexian Mite', artifact: true, kw: [], text: 'Toxic 1\n~ can\'t block.' });
const TOKEN = (n, p, q, name, kw) => ({ t: 'token', n, p, q, name, kw: kw || [] });

// ===== FDC: Calling All Angels =====
cl(/^As long as you control your commander, ~ gets \+2\/\+2 and creatures you control have vigilance\.$/, R => { selfCond(R, { cond: 'you control your commander', p: 2, q: 2, kw: [] }); R.statics.push({ type: null, p: 0, q: 0, kw: ['vigilance'], cond: 'you control your commander' }); });
cl(/^As long as ~ is untapped, creatures can't attack you or planeswalkers you control unless their controller pays \{1\} for each of those creatures\.$/, R => { R.attackTaxUntapped = 1; });
cl(/^As long as ~ is attacking, creatures can't block unless their controller pays \{1\} for each of those creatures\.$/, R => { R.blockTax = 1; });
cl(/^At the beginning of your upkeep, create a 1\/1 white Spirit creature token with flying\. If you're the monarch, create a 4\/4 white Angel creature token with flying instead\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('courtGrace')] }); });
cl(/^Whenever a land you control enters, you may return target nonland permanent card from your graveyard to your hand\. If that land is a Plains, you may return that nonland permanent card to the battlefield instead\.$/, R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('emeria')] })); });
cl(/^When ~ enters, for each opponent, exile up to one target nonland permanent that player controls until ~ leaves the battlefield\.$/, R => { R.etb.push(cmd('exileEachOpp')); });
cl(/^Angel spells and Human spells you cast cost \{1\} less to cast for each \+1\/\+1 counter on ~\.$/, R => { R.reducer = { what: '(?:Angel|Human)', n: 1, perCounter: true }; });
cl(/^Whenever a commander you control enters or attacks, proliferate\.$/, R => { R.trig.push(SPEC('enters', { commander: true }, { effects: [{ t: 'proliferate' }] })); R.trig.push({ ev: 'attacks', fn: 'cmdrAttacks', effects: [{ t: 'proliferate' }] }); });
cl(/^Whenever another Angel or Cleric you control enters, you gain life equal to that creature's toughness\.$/, R => { R.trig.push(SPEC('enters', { another: true, sub: ['Angel', 'Cleric'] }, { effects: [cmd('gainCtxTou')] })); });
cl(/^As long as you have at least 7 life more than your starting life total, creatures you control get \+2\/\+2\.$/, R => { R.statics.push({ type: null, p: 2, q: 2, kw: [], cond: 'you have at least 7 life more than your starting life total' }); });
cl(/^You may pay \{W\} and tap four untapped creatures you control with flying rather than pay ~'s mana cost\.$/, R => { R.alt = { mana: parseCost('{W}'), tapFly: 4, life: 0, exile: null, cond: null, text: 'pay {W} and tap four untapped creatures with flying' }; });
cl(/^Other creatures you control with flying have indestructible\.$/, R => { R.statics.push({ other: true, fn: 'flying', p: 0, q: 0, kw: ['indestructible'] }); });
cl(/^Prevent all combat damage that would be dealt to ~\.$/, R => { R.kw.add('preventcombat'); });
cl(/^You can't cast ~ during your first, second, or third turns of the game\.$/, R => { R.castCond = 'you have taken more than three turns'; });
cl(/^\{T\}: Create a 4\/4 white Angel creature token with flying\. Activate only if you have at least 7 life more than your starting life total and only as a sorcery\.$/, (R, m, ctx) => { const a = parseActivated('{T}: Create a 4/4 white Angel creature token with flying. Activate only if you have at least 7 life more than your starting life total.', R); a.sorcery = true; R.acts.push(a); });
cl(/^At the beginning of your upkeep, investigate once for each opponent who has more cards in hand than you\.$/, R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('wojekInvestigate')] }); });
cl(/^Other nontoken creatures you control get \+1\/\+1 and have vigilance\.$/, R => { R.statics.push({ other: true, spec: { type: 'Creature', nontoken: true }, p: 1, q: 1, kw: ['vigilance'] }); });
cl(/^Whenever you gain life for the first time each turn, surveil 1\.$/, R => { R.trig.push({ ev: 'gainLife', once: 'firstGain', effects: [{ t: 'surveil', n: 1 }] }); });
cl(/^Each other Angel you control enters with an additional \+1\/\+1 counter on it for each Angel you already control\.$/, R => { R.entersPlus = { sub: 'Angel', perCount: 'Angel', other: true }; });


// ===== Shared staples (several decks) =====
cl(/^\{T\}: Add one mana of any color in your commander's color identity\. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1\.$/, R => { R.mana = { colors: [...COLORS], n: 1, identity: true, rider: 'pathAncestry' }; });
cl(/^\{T\}, Sacrifice ~: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle\. Then if you control four or more lands, untap that land\.$/, (R, m, ctx) => { const a = parseActivated('{T}, Sacrifice ~: Draw a card.', R); a.effects = [{ t: 'fetchLand', n: 1, what: 'basic land', bf: true, tapped: true }, cmd('untapFetchedIf4')]; a.text = ctx.line; R.acts.push(a); });
cl(/^\{3\}, \{T\}, Pay life equal to the number of colors in your commanders' color identity: Draw a card\.$/, (R, m, ctx) => { const a = parseActivated('{3}, {T}: Draw a card.', R); a.cost.lifeIdentity = true; a.text = ctx.line; R.acts.push(a); });
cl(/^\{1\}, \{T\}: Add one mana of any color\. When you spend this mana to cast your commander, scry X, where X is the number of times it's been cast from the command zone this game\.$/, (R, m, ctx) => { const a = parseActivated('{1}, {T}: Draw a card.', R); a.effects = [{ t: 'addMana', any: 1, rider: 'studyHall' }]; a.text = ctx.line; a.mana = true; R.acts.push(a); });
cl(/^Whenever you discard a card, you may exile that card from your graveyard\.$/, R => { R.trig.push({ ev: 'discarded', effects: [cmd('exileDiscarded', { keep: true })] }); });
cl(/^\{T\}: Put a card exiled with ~ into its owner's graveyard\. If it's a land card, create a Treasure token\. If it's a nonland card, create a 2\/2 black Rogue creature token\.$/, (R, m, ctx) => { const a = parseActivated('{T}: Draw a card.', R); a.effects = [cmd('converterTick')]; a.text = ctx.line; R.acts.push(a); });
cl(/^Whenever you discard a card, you may exile that card from your graveyard\. If you do, you may play that card this turn\.$/, R => { R.trig.push({ ev: 'discarded', effects: [cmd('exileDiscarded', { play: 'turn' })] }); });
cl(/^~ enters with a page counter on it\.$/, R => { R.etbNamedN = { kind: 'page', n: 1 }; });
cl(/^Whenever your commander enters or attacks, put a page counter on ~\.$/, R => { R.trig.push(SPEC('enters', { commander: true }, { effects: [{ t: 'namedCounter', n: 1, kind: 'page' }] })); R.trig.push({ ev: 'attacks', fn: 'cmdrAttacks', effects: [{ t: 'namedCounter', n: 1, kind: 'page' }] }); });
cl(/^As ~ enters, you may have it become a copy of any creature on the battlefield until end of turn, except it has haste\.$/, R => { R.etb.push(cmd('cursedMirror')); });
cl(/^When enchanted creature dies, return that card to the battlefield under its owner's control\. Return ~ to the battlefield attached to that creature at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'dies', host: true, effects: [cmd('giftImmortality')] }); });
cl(/^As an additional cost to cast ~, pay X life\.$/, R => { R.addCost = { lifeX: true }; });
cl(/^All creatures get -X\/-X until end of turn\.$/, R => { if (R.addCost && R.addCost.lifeX) R.spell = [{ t: 'cmd', id: 'toxicDeluge' }]; else return false; });
cl(/^Each player puts a vow counter on a creature they control and sacrifices the rest\. Each of those creatures can't attack you or planeswalkers you control for as long as it has a vow counter on it\.$/, R => { R.spell = [cmd('promiseOfLoyalty')]; });
cl(/^For each player, you choose from among the permanents that player controls an artifact, a creature, an enchantment, and a planeswalker\. Then each player sacrifices all other nonland permanents they control\.$/, R => { R.spell = [cmd('tragicArrogance')]; });
cl(/^Flashback—\{1\}\{U\}, Pay 3 life\.$/, R => { R.flashback = parseCost('{1}{U}'); R.flashbackLife = 3; });
cl(/^Look at the top three cards of your library\. Put one of them into your hand, put one of them on the bottom of your library, and exile one of them\. You may play the exiled card this turn\.$/, R => { R.spell = [cmd('expressiveIteration')]; });
cl(/^Whenever you discard a card, you may exile that card from your graveyard\. If you do, you may play that card this turn\.$/, R => { R.trig.push({ ev: 'discarded', effects: [cmd('exileDiscarded', { play: 'turn' })] }); });
cl(/^\{2\}: ~ becomes a copy of target artifact, creature, enchantment, or land until end of turn\.$/, (R, m, ctx) => { const a = parseActivated('{2}: Draw a card.', R); a.effects = [{ t: 'cmd', id: 'mirageMirror', target: 'perm', filter: 'artifact, enchantment, land, or creature', good: true }]; a.text = ctx.line; R.acts.push(a); });

// ===== FDC: the other four decks =====
const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, twenty: 20 };
const nw = w => (/^\d+$/.test(w) ? Number(w) : NUMW[String(w).toLowerCase()]);
const rx = t => new RegExp('^' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
const clx = (text, fn) => cl(rx(text), fn);
const act = (R, ctxLine, costText, effects, patch) => { const a = parseActivated(`${costText}: Draw a card.`, R); a.effects = effects; a.text = ctxLine; if (patch) patch(a); R.acts.push(a); return a; };
// -- Keen Engineering --
clx('When ~ enters during the declare attackers step, you may reselect which player or permanent target attacking creature is attacking.', R => { R.etb.push(cmd('reselectAttack')); });
clx('Whenever you tap a permanent for {C}, add an additional {C}.', R => { R.monumentC = true; });
clx('Juggernauts you control attack each combat if able.', R => { R.juggernautsAttack = true; });
clx('Juggernauts you control can\'t be blocked by Walls.', R => { R.juggernautsAttack = true; });
clx('Other creatures you control have base power and toughness 5/3 and are Juggernauts in addition to their other creature types.', R => { R.lordBase = { p: 5, q: 3 }; R.lordAddSub = 'Juggernaut'; });
clx('{T}, Put a page counter on ~: Scry 1.', (R, m, ctx) => { act(R, ctx.line, '{T}', [{ t: 'namedCounter', n: 1, kind: 'page' }, { t: 'scry', n: 1 }, cmd('mazemindCheck')]); });
clx('{2}, {T}, Put a page counter on ~: Draw a card.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'namedCounter', n: 1, kind: 'page' }, { t: 'draw', n: 1 }, cmd('mazemindCheck')]); });
clx('When there are four or more page counters on ~, exile it. If you do, you gain 4 life.', R => { /* checked right after a counter is added (Mazemind Tome's abilities) */ });
clx('{1}, {T}: Destroy all artifacts, creatures, and enchantments.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [{ t: 'wipe', how: 'destroy', what: 'artifacts, creatures, and enchantments' }]); });
clx('Enchanted creature doesn\'t untap during its controller\'s untap step unless that player is the monarch.', R => { R.noUntapUnlessMonarch = true; });
clx('You may cast artifact spells as though they had flash.', R => { R.flashTypes = ['Artifact']; });
clx('{T}, Sacrifice ~: Exile each opponent\'s graveyard.', (R, m, ctx) => { act(R, ctx.line, '{T}, Sacrifice ~', [cmd('exileOppGys')]); });
clx('Affinity for Islands', R => { R.affinityOf = 'Island'; });
// -- Reign of Dragons --
clx('Whenever ~ enters or attacks, exile the top X cards of your library, where X is the number of creatures you control with power 4 or greater. You may play those cards until your next end step. At the beginning of your next end step, ~ deals 2 damage to each opponent for each of those cards that are still exiled.', R => { R.etb.push(cmd('dragonhawk')); R.trig.push({ ev: 'attacks', effects: [cmd('dragonhawk')] }); });
clx('Read ahead', R => { R.readAhead = true; });
clx('You don\'t lose unspent red mana as steps and phases end.', R => { R.keepRedMana = true; });
clx('When ~ dies, you may pay any amount of {R}. When you do, it deals that much damage to any target.', R => { R.trig.push({ ev: 'dies', effects: [cmd('leylineDies')] }); });
clx('Whenever ~ attacks, if you attacked with creatures with total power 6 or greater this combat, you may put a Dragon creature card from your hand onto the battlefield tapped and attacking.', R => { R.trig.push({ ev: 'attacks', fn: 'packTactics', effects: [cmd('minionDragon')] }); });
clx('Whenever ~ attacks, if you control three or more Dragons, until end of turn, ~ becomes a Dragon with base power and toughness 5/5 and gains flying.', R => { R.trig.push({ ev: 'attacks', cond: 'you control three or more Dragons', effects: [cmd('becomeDragon', { base: { p: 5, q: 5 } })] }); });
clx('{1}, {T}: Add two mana in any combination of colors. Spend this mana only to cast Dragon spells or activate abilities of Dragons.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [{ t: 'addMana', any: 2, only: 'Dragon' }]); });
clx('{R}, {T}, Sacrifice ~: Look at the top seven cards of your library. You may reveal a Dragon card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.', (R, m, ctx) => { act(R, ctx.line, '{R}, {T}, Sacrifice ~', [cmd('orbDig')]); });
clx('As ~ enters, choose Khans or Dragons.', R => { R.etb.push(cmd('chooseWord', { options: ['Khans', 'Dragons'] })); });
clx('• Khans — At the beginning of your upkeep, exile the top card of your library. Until end of turn, you may play that card.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('siegeKhans')] }); });
clx('• Dragons — Whenever a creature you control leaves the battlefield, ~ deals 1 damage to any target.', R => { R.trig.push(SPEC('leaves', { type: 'Creature' }, { effects: [{ t: 'cmd', id: 'siegeDragons' }] })); });
clx('Whenever one or more Dragons you control deal combat damage to an opponent, choose one that hasn\'t been chosen this turn —', R => { R.trig.push({ ev: 'combatHitAny', fn: 'dragonsHit', effects: [cmd('parapetThrasher')] }); });
clx('• Destroy target artifact that opponent controls.', R => { });
clx('• ~ deals 4 damage to each other opponent.', R => { });
clx('• Exile the top card of your library. You may play it this turn.', R => { });
clx('When ~ enters, you may behold a Dragon. If you do, create a Treasure token.', R => { R.etb.push(cmd('beholdDragon')); });
clx('Whenever a Dragon you control enters, put a +1/+1 counter on ~. Until end of turn, ~ becomes a Dragon in addition to his other types and gains flying.', R => { R.trig.push(SPEC('enters', { sub: 'Dragon', another: true }, { effects: [cmd('sarkhanDragon')] })); });
clx('Whenever ~ attacks for the first time each turn, if it\'s attacking the player with the most life or tied for most life, untap all attacking creatures. After this phase, there is an additional combat phase.', R => { R.trig.push({ ev: 'attacks', fn: 'dethrone', once: 'throneFirst', effects: [{ t: 'relentless' }] }); });
clx('Whenever ~ or another Dragon you control enters, it deals X damage to any target, where X is the number of Dragons you control.', R => { R.trig.push(SPEC('enters', { sub: 'Dragon' }, { effects: [{ t: 'cmd', id: 'scourgeValkas', target: 'any', good: false }] })); });
clx('Whenever a Dragon you control becomes the target of a spell or ability an opponent controls, ~ deals 3 damage to that player.', R => { R.trig.push(SPEC('targeted', { sub: 'Dragon', byOpp: true }, { effects: [cmd('damageTargeter', { n: 3 })] })); });
clx('You may look at the top card of your library any time.', R => { R.lookTop = true; });
clx('You may cast creature spells with power 4 or greater from the top of your library. If you cast a creature spell this way, it gains haste until end of turn.', R => { R.castTopCreatures = { minPow: 4, haste: true }; });
clx('Lieutenant — As long as you control your commander, ~ gets +2/+2 and has "Whenever ~ attacks, it deals 7 damage to target creature defending player controls."', R => { selfCond(R, { cond: 'you control your commander', p: 2, q: 2, kw: [] }); R.trig.push({ ev: 'attacks', cond: 'you control your commander', effects: [{ t: 'dmg', n: 7, target: 'creature', theirs: true }] }); });
clx('As long as you control your commander, ~ gets +2/+2 and has "Whenever ~ attacks, it deals 7 damage to target creature defending player controls."', R => { selfCond(R, { cond: 'you control your commander', p: 2, q: 2, kw: [] }); R.trig.push({ ev: 'attacks', cond: 'you control your commander', effects: [{ t: 'dmg', n: 7, target: 'creature', theirs: true }] }); });
clx('Whenever a Dragon you control attacks, create a 6/6 red Dragon creature token with flying.', R => { R.trig.push({ ev: 'attacks', fn: 'dragonAttacks', effects: [cmd('dragonToken', { p: 6, q: 6 })] }); });
clx('Whenever a Dragon you control enters, put a gold counter on ~.', R => { R.trig.push(SPEC('enters', { sub: 'Dragon' }, { effects: [{ t: 'namedCounter', n: 1, kind: 'gold' }] })); });
clx('{2}, {T}, Sacrifice ~: Return target Dragon creature card or Ugin planeswalker card from your graveyard to your hand.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}, Sacrifice ~', [cmd('havenReturn')]); });
clx('{T}: Add one mana of any color. Spend this mana only to cast a Dragon creature spell.', R => { R.mana = { colors: [...COLORS], n: 1, onlyType: 'Dragon' }; });
clx('Hideaway 4', R => { R.etb.push(cmd('hideaway', { n: 4 })); });
clx('{R}, {T}: You may play the exiled card without paying its mana cost if an opponent was dealt 7 or more damage this turn.', (R, m, ctx) => { act(R, ctx.line, '{R}, {T}', [cmd('hideawayPlay', { cond: 'an opponent was dealt 7 or more damage this turn' })]); });
clx('{G}, {T}: You may play the exiled card without paying its mana cost if creatures you control have total power 10 or greater.', (R, m, ctx) => { act(R, ctx.line, '{G}, {T}', [cmd('hideawayPlay', { cond: 'creatures you control have total power 10 or greater' })]); });
clx('When ~ enters, exile cards from the top of your library until you exile a nonland card. You may cast it without paying its mana cost if that spell\'s mana value is 8 or less. If you don\'t, put that card into your hand.', R => { R.etb.push(cmd('breachingDragonstorm')); });
clx('When a Dragon you control enters, return ~ to its owner\'s hand.', R => { R.trig.push(SPEC('enters', { sub: 'Dragon' }, { effects: [cmd('returnSelfToHand')] })); });
clx('~ deals 2 damage to each non-Dragon creature.', R => { R.spell = [cmd('breathWeapon', { n: 2 })]; });
clx('At the beginning of your upkeep, if you\'re the monarch, create a 5/5 red Dragon creature token with flying.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('dragonToken', { p: 5, q: 5, needMonarch: true })] }); });
clx('Each Dragon you control enters with an additional +1/+1 counter on it.', R => { R.entersPlus = { sub: 'Dragon', n: 1 }; });
clx('Whenever another nontoken Dragon you control enters, create a 5/5 red Dragon creature token with flying.', R => { R.trig.push(SPEC('enters', { sub: 'Dragon', another: true, nontoken: true }, { effects: [cmd('dragonToken', { p: 5, q: 5 })] })); });
clx('Dragon spells you cast cost {1} less to cast.', R => { R.reducer = { what: 'Dragon', n: 1 }; });
// -- Tramplesaurus Rex --
clx('Create X 1/2 green Spider creature tokens with reach, where X is the number of creatures attacking you. Prevent all combat damage that would be dealt this turn by non-Spider creatures.', R => { R.spell = [cmd('arachnogenesis')]; });
clx('For each creature your opponents control, create a 4/4 green Phyrexian Beast creature token. Each of those tokens fights a different one of those creatures.', R => { R.spell = [cmd('ezuriPredation')]; });
clx('{4}{G}{G}, {T}: Look at the top six cards of your library. You may reveal a creature card with mana value less than or equal to the number of lands you control from among them and put it onto the battlefield. Put the rest on the bottom in a random order.', (R, m, ctx) => { act(R, ctx.line, '{4}{G}{G}, {T}', [cmd('lootDig')]); });
clx('Whenever ~ attacks while you don\'t control another Dinosaur, put a stun counter on it.', R => { R.trig.push({ ev: 'attacks', effects: [cmd('hammerskullStun')] }); });
clx('~ can\'t attack or block unless you control another creature with power 4 or greater.', R => { R.attackCond = 'you control another creature with power 4 or greater'; R.blockCond = 'you control another creature with power 4 or greater'; });
clx('{G}: Exile target card from a graveyard. If it was a creature card, put a +1/+1 counter on ~ and you gain 1 life.', (R, m, ctx) => { act(R, ctx.line, '{G}', [cmd('scavengingOoze')]); });
clx('Discover 10. If the discovered card\'s mana value is less than 10, create a number of tapped Treasure tokens equal to the difference.', R => { R.spell = [{ t: 'discover', n: 10 }, cmd('discoverTreasure')]; });
clx('Gift a card', R => { R.gift = 'card'; });
clx('When ~ enters, if the gift was promised, destroy target artifact or enchantment an opponent controls.', R => { R.etb.push(cmd('scrapshooter')); });
clx('Equipped creature gets +X/+X, where X is the greatest mana value among your commanders.', R => { R.buff = { p: 0, q: 0, kw: [] }; R.buffCmdr = true; });
clx('When ~ enters, put X +1/+1 counters on target creature, where X is that creature\'s power.', R => { R.etb.push({ t: 'cmd', id: 'thicketCounters', target: 'creature', good: true }); });
clx('At the beginning of your end step, draw two cards if you control the creature with the greatest power or tied for the greatest power.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('thicketDraw')] }); });
clx('Whenever ~ or another creature you control enters, you gain life equal to that creature\'s toughness.', R => { R.trig.push(SPEC('enters', { type: 'Creature' }, { effects: [cmd('gainCtxTou')] })); });
clx('When ~ enters, destroy all creatures with flying. Put a +1/+1 counter on ~ for each creature destroyed this way.', R => { R.etb.push(cmd('whiptongue')); });
clx('You may cast green creature spells as though they had flash.', R => { R.flashSpec = { spec: { type: 'Creature', color: 'G' } }; });
clx('{2}, {T}: Target commander gains lifelink until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [{ t: 'cmd', id: 'commanderLifelink', target: 'perm', filter: 'commander', good: true }]); });
clx('Whenever another player attacks with two or more creatures, they draw a card if none of those creatures attacked you.', R => { R.trig.push({ ev: 'attacks', fn: 'foeAttacksMany', effects: [cmd('commandoDraw')] }); });
clx('Escalate {G}', R => { R.escalate = parseCost('{G}'); });
clx('~ deals X damage divided as you choose among any number of target creatures, where X is the greatest power among creatures you control as you cast ~.', R => { R.spell = [cmd('onslaught')]; });
clx('~ has hexproof as long as it\'s untapped.', R => { selfCond(R, { cond: '~ is untapped', p: 0, q: 0, kw: ['hexproof'] }); });
clx('Enchanted creature doesn\'t untap during its controller\'s untap step.', R => { });
// -- Wretched Ranks --
clx('Tap three untapped Zombies you control: You draw a card and lose 1 life.', (R, m, ctx) => { const a = parseActivated('{T}: Draw a card.', R); a.cost.tap = false; a.cost.tapType = { n: 3, type: 'Zombie' }; a.effects = [{ t: 'draw', n: 1 }, { t: 'loseSelf', n: 1 }]; a.text = ctx.line; R.acts.push(a); });
clx('Skeletons you control and other Zombies you control get +1/+1 and have deathtouch.', R => { R.statics.push({ type: 'Skeleton', p: 1, q: 1, kw: ['deathtouch'] }); R.statics.push({ other: true, type: 'Zombie', p: 1, q: 1, kw: ['deathtouch'] }); });
clx('~ enters with a +1/+1 counter on it for each Zombie card in your graveyard.', R => { R.entersWithGy = 'Zombie'; });
clx('At the beginning of your upkeep, create X 2/2 black Zombie creature tokens, where X is half the number of Zombies you control, rounded down.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('zombieHalf')] }); });
clx('When ~ enters, sacrifice any number of other permanents, then draw that many cards.', R => { R.etb.push(cmd('bontuSac')); });
clx('When ~ dies or is put into exile from the battlefield, you may put her into her owner\'s library third from the top.', R => { R.trig.push({ ev: 'leaves', effects: [cmd('bontuLibrary')] }); });
clx('At the beginning of your upkeep, you draw X cards and lose X life, where X is the number of Zombies you control.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('museZombies')] }); });
clx('When ~ enters, if he was kicked, create eight 2/2 black Zombie Knight creature tokens with menace.', R => { R.etb.push({ t: 'token', n: 8, p: 2, q: 2, name: 'black Zombie Knight', kw: ['menace'], kicked: true }); });
clx('If a nontoken creature an opponent controls would die, instead exile that card and create a 2/2 black Zombie creature token.', R => { R.kalitas = true; });
clx('{2}{B}, Sacrifice another Vampire or Zombie: Put two +1/+1 counters on ~.', (R, m, ctx) => { act(R, ctx.line, '{2}{B}', [{ t: 'counters', n: 2, target: 'self' }], a => { a.cost.sacPerm = 'another Vampire or Zombie'; }); });
clx('Other Zombie creatures get +1/+1.', R => { R.statics.push({ global: true, other: true, type: 'Zombie', p: 1, q: 1, kw: [] }); });
clx('Other Zombies you control get +1/+1.', R => { R.statics.push({ other: true, type: 'Zombie', p: 1, q: 1, kw: [] }); });
clx('{1}{B}, {T}: All Zombies gain menace until end of turn.', (R, m, ctx) => { act(R, ctx.line, '{1}{B}, {T}', [cmd('zombiesMenace')]); });
clx('All creatures get -1/-1 until end of turn for each Swamp you control.', R => { R.spell = [cmd('mutilate')]; });
clx('Each player sacrifices six creatures of their choice. You create six tapped 2/2 black Zombie creature tokens.', R => { R.spell = [cmd('necroticHex')]; });
clx('At the beginning of your upkeep, if you have four or more creature cards in your graveyard, you may return target creature card from your graveyard to your hand.', R => { R.trig.push({ ev: 'upkeep', who: 'your', cond: 'you have four or more creature cards in your graveyard', effects: [cmd('regrowCreature')] }); });
clx('{4}{B}{B}: Return ~ from your graveyard to the battlefield with a +1/+1 counter on it. This ability costs {4} less to activate if an opponent controls four or more nonbasic lands.', (R, m, ctx) => { const a = act(R, ctx.line, '{4}{B}{B}', [{ t: 'returnSelfGy', bf: true, counter: 1 }]); R.acts.pop(); a.gy = true; a.lessIf = { n: 4, cond: 'an opponent controls four or more nonbasic lands' }; (R.gyActs = R.gyActs || []).push(a); });
clx('{T}: You may cast target Zombie creature card from your graveyard this turn.', (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('zulAshur')]); });
clx('Return target creature card from your graveyard to your hand. If it\'s a Zombie card, draw a card.', R => { R.spell = [cmd('cemeteryRecruit')]; });
clx('Gift a card', R => { R.gift = 'card'; });
clx('Target opponent sacrifices a creature with the greatest power among creatures they control. If the gift was promised, return target creature card from your graveyard to your hand.', R => { R.spell = [cmd('consumedByGreed')]; });
clx('~ deals X damage to target creature or planeswalker and you gain X life, where X is the number of Swamps you control.', R => { R.spell = [{ t: 'cmd', id: 'consumingCorruption', target: 'perm', filter: 'creature or planeswalker', good: false }]; });
clx('Whenever ~ or another Zombie enters, all non-Zombie creatures get -1/-1 until end of turn.', R => { R.trig.push(SPEC('enters', { sub: 'Zombie' }, { effects: [cmd('noxiousGhoul')] })); });
clx('~\'s power and toughness are each equal to the number of Zombies on the battlefield plus the number of Zombie cards in all graveyards.', R => { R.cdaSet = { p: 'the number of Zombies on the battlefield plus the number of Zombie cards in all graveyards', q: 'the number of Zombies on the battlefield plus the number of Zombie cards in all graveyards' }; });
clx('Each other player sacrifices a creature of their choice. You create a 2/2 black Zombie creature token for each creature sacrificed this way.', R => { R.spell = [cmd('syphonFlesh')]; });
clx('Whenever ~ or another Zombie dies, each opponent loses 1 life.', R => { R.trig.push(SPEC('dies', { sub: 'Zombie' }, { effects: [{ t: 'drain', n: 1 }] })); });
clx('{B}, {T}, Sacrifice another creature: Create X 2/2 black Zombie creature tokens, where X is the sacrificed creature\'s power.', (R, m, ctx) => { act(R, ctx.line, '{B}, {T}', [cmd('gisaTokens')], a => { a.cost.sacPerm = 'another creature'; }); });
clx('Whenever ~ deals combat damage to a player, that player discards a card and you create a tapped 2/2 black Zombie creature token.', R => { R.trig.push({ ev: 'hitPlayer', effects: [{ t: 'discard', n: 1 }, { t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: [], tapped: true }] }); });
clx('Whenever you cast a Zombie spell, create a tapped 2/2 black Zombie creature token.', R => { R.trig.push({ ev: 'cast', filter: 'types:Zombie', effects: [{ t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: [], tapped: true }] }); });
clx('Create thirteen tapped 2/2 black Zombie creature tokens.', R => { R.spell = [{ t: 'token', n: 13, p: 2, q: 2, name: 'black Zombie', kw: [], tapped: true }]; });
clx('Whenever ~ or another nontoken Zombie you control dies, create a 2/2 black Zombie creature token.', R => { R.trig.push(SPEC('dies', { sub: 'Zombie', nontoken: true }, { effects: [{ t: 'token', n: 1, p: 2, q: 2, name: 'black Zombie', kw: [] }] })); });

// ===== FRC: Multiverse Reforged =====
clx('Landfall — Whenever a land you control enters, draw a card. Then if this is the first time this ability has resolved this turn, reveal cards from the top of your library until you reveal a creature card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.', R => { R.trig.push({ ev: 'landfall', effects: [cmd('nissaLandfall')] }); });
clx('Whenever a land you control enters, draw a card. Then if this is the first time this ability has resolved this turn, reveal cards from the top of your library until you reveal a creature card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.', R => { R.trig.push({ ev: 'landfall', effects: [cmd('nissaLandfall')] }); });
clx('If you would lose unspent mana, that mana becomes colorless instead.', R => { R.keepColorless = true; });
clx('When ~ enters, reveal cards from the top of your library until you reveal X creature cards, where X is the number of opponents you have. Put those creature cards onto the battlefield, then shuffle. They\'re goaded for the rest of the game. For each of those permanents, choose a different opponent. Each opponent gains control of the permanent for which they were chosen.', R => { R.etb.push(cmd('dackFayden')); });
clx('When ~ enters, destroy all tapped creatures your opponents control. You gain 1 life for each creature destroyed this way.', R => { R.etb.push(cmd('obNixilis')); });
clx('Choose target opponent. Until that player\'s next turn, they gain protection from everything and their life total can\'t change. All nonland permanents they control phase out.', R => { R.spell = [{ t: 'cmd', id: 'teferisReproach', target: 'player', oppOnly: true, good: false }]; });
clx('Exile ~.', R => { if (R.spell && R.spell.some(e => e.id === 'teferisReproach')) R.spell.push({ t: 'exileSelf' }); else return false; });
clx('Whenever ~ or another nontoken creature you control dies, return that card to the battlefield under your control at the beginning of the next end step.', R => { R.trig.push(SPEC('dies', { type: 'Creature', nontoken: true }, { effects: [cmd('returnAtEnd')] })); });
clx('Whenever ~ enters or attacks, target opponent reveals cards from the top of their library until they reveal a historic permanent card. You put that card onto the battlefield under your control and lose life equal to that permanent\'s mana value. That player puts the rest of the revealed cards on the bottom of their library in a random order.', R => { const e = { t: 'cmd', id: 'jhoiraSteal', target: 'player', oppOnly: true, good: false }; R.etb.push(e); R.trig.push({ ev: 'attacks', effects: [e] }); });
clx('Whenever you gain life, you may pay that much life. If you do, draw that many cards.', R => { R.trig.push({ ev: 'gainLife', effects: [cmd('nivDraw')] }); });
clx('Whenever one or more creatures deal combat damage to you while you\'re the monarch, tap those creatures and put a stun counter on each of them.', R => { R.trig.push({ ev: 'hitPlayer', fn: 'hitMonarchMe', effects: [cmd('tamiyoStun')] }); });
clx('Eminence — As long as ~ is in the command zone or on the battlefield, other Sphinx spells you cast cost {1} less to cast.', R => { R.reducer = { what: 'Sphinx', n: 1, eminence: true }; });
clx('As long as ~ is in the command zone or on the battlefield, other Sphinx spells you cast cost {1} less to cast.', R => { R.reducer = { what: 'Sphinx', n: 1, eminence: true }; });
clx('Whenever one or more Sphinxes you control attack, each player mills that many cards. For each player, you may cast a card that player milled this way without paying its mana cost.', R => { R.trig.push({ ev: 'attacks', fn: 'sphinxAttack', effects: [cmd('sphinxAttack')] }); });
clx('You can\'t lose the game and your opponents can\'t win the game.', R => { R.cantLose = true; });
clx('Creatures you control can\'t have -1/-1 counters put on them.', R => { R.noMinusCounters = true; });
clx('At the beginning of each upkeep, if you\'re the monarch, create a Gingerbrute token.', R => { R.trig.push({ ev: 'upkeep', who: 'each', cond: 'you are the monarch', effects: [cmd('gingerbrute')] }); });
clx('{1}: ~ can\'t be blocked this turn except by creatures with haste.', (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('gingerEvade')]); });
clx('−7: You get an emblem with "Creatures you control get +2/+2 and have flying."', R => { R.acts.push({ loyalty: -7, effects: [cmd('emblemSun')], text: '−7: You get an emblem with "Creatures you control get +2/+2 and have flying."', sorcery: true }); });
clx('As ~ enters, choose a card type.', R => { R.etb.push(cmd('emissaryChoose')); });
clx('You and creatures you control have protection from the chosen card type.', R => { R.emissary = true; });
clx('At the beginning of your upkeep, you lose 1 life and create a 1/1 colorless Phyrexian Mite artifact creature token with toxic 1 and "~ can\'t block."', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'loseSelf', n: 1 }, mite(1)] }); });
clx('Corrupted — As long as an opponent has three or more poison counters, creatures you control with toxic have lifelink.', R => { R.statics.push({ fn: 'toxicCreature', p: 0, q: 0, kw: ['lifelink'], cond: 'an opponent has three or more poison counters' }); });
clx('As long as an opponent has three or more poison counters, creatures you control with toxic have lifelink.', R => { R.statics.push({ fn: 'toxicCreature', p: 0, q: 0, kw: ['lifelink'], cond: 'an opponent has three or more poison counters' }); });
clx('Whenever you create one or more creature tokens, put a story counter on ~.', R => { R.trig.push({ ev: 'creatureTokenMade', effects: [{ t: 'namedCounter', n: 1, kind: 'story' }] }); });
clx('Exile all creatures. Incubate X, where X is the number of creatures exiled this way.', R => { R.spell = [{ t: 'wipe', how: 'exile', what: 'creatures' }, cmd('incubate')]; });
clx('You gain X life. Create X 1/1 colorless Phyrexian Mite artifact creature tokens with toxic 1 and "~ can\'t block." If X is 5 or more, destroy all other creatures.', R => { R.spell = [{ t: 'cmd', id: 'whiteSunsTwilight', n: 'X' }]; });
clx('You gain 97 life. Create 97 1/1 colorless Phyrexian Mite artifact creature tokens with toxic 1 and "~ can\'t block." If 97 is 5 or more, destroy all other creatures.', R => { R.spell = [{ t: 'cmd', id: 'whiteSunsTwilight', n: 'X' }]; });
clx('Exile all creatures you control, then reveal cards from the top of your library until you reveal that many creature cards. Put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library.', R => { R.spell = [cmd('massPolymorph')]; });
clx('Exile all creatures you control. At the beginning of the next end step, reveal cards from the top of your library until you reveal that many creature cards, put all creature cards revealed this way onto the battlefield, then shuffle the rest of the revealed cards into your library.', R => { R.spell = [cmd('syntheticDestiny')]; });
clx('Draw X cards, then discard X cards. Create a 1/1 white Spirit creature token with flying for each card type among cards discarded this way.', R => { R.spell = [{ t: 'cmd', id: 'occultEpiphany', n: 'X' }]; });
clx('Draw 97 cards, then discard 97 cards. Create a 1/1 white Spirit creature token with flying for each card type among cards discarded this way.', R => { R.spell = [{ t: 'cmd', id: 'occultEpiphany', n: 'X' }]; });
clx('Whenever you cast a noncreature spell, create an X/X blue Shark creature token with flying, where X is that spell\'s mana value.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [cmd('sharkCast')] }); });
clx('When you cycle ~, create an X/X blue Shark creature token with flying.', R => { R.cycleTrig = [cmd('sharkCycle')]; });
clx('Your opponents can\'t gain life.', R => { R.noOppGain = true; });
clx('At the beginning of each end step, each opponent loses life equal to the life that player lost this turn.', R => { R.trig.push({ ev: 'end', who: 'each', effects: [cmd('archfiendEnd')] }); });
clx('Whenever ~ enters or attacks, target opponent sacrifices a creature or planeswalker of their choice, discards a card, and loses 3 life. You draw a card and gain 3 life.', R => { const e = { t: 'cmd', id: 'archonCruelty', target: 'player', oppOnly: true, good: false }; R.etb.push(e); R.trig.push({ ev: 'attacks', effects: [e] }); });
clx('At the beginning of your upkeep, you lose 1 life and amass Zombies 1.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'loseSelf', n: 1 }, { t: 'amass', n: 1, type: 'Zombie' }] }); });
clx('Whenever a Zombie token you control with power 6 or greater attacks, it gains lifelink until end of turn.', R => { R.trig.push({ ev: 'attacks', fn: 'bigZombieTokens', once: 'dreadLL', effects: [cmd('zombieLifelink')] }); });
clx('As ~ enters, choose Mardu or Jeskai.', R => { R.etb.push(cmd('chooseWord', { options: ['Mardu', 'Jeskai'] })); });
clx('• Mardu — If a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.', R => { R.doubleAttackTrig = true; });
clx('• Jeskai — At the beginning of your upkeep, create a 1/1 red Goblin creature token. It gains lifelink and haste until end of turn.', R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('siegeJeskai')] }); });
clx('{1}{R}, {T}: Create a 0/1 red Kobold creature token named Kobolds of ~.', (R, m, ctx) => { act(R, ctx.line, '{1}{R}, {T}', [{ t: 'token', n: 1, p: 0, q: 1, name: 'red Kobold', named: 'Kobolds of Kher Keep', kw: [] }]); });
clx('{U}{R}: Until end of turn, ~ becomes a 2/1 blue and red Elemental creature with "During your turn, ~ has first strike." It\'s still a land.', (R, m, ctx) => { act(R, ctx.line, '{U}{R}', [cmd('restlessAnimate')]); });
clx('When ~ enters, the owner of up to one other target nonland permanent puts it on their choice of the top or bottom of their library.', R => { R.etb.push({ t: 'cmd', id: 'topOrBottom', target: 'perm', filter: 'nonland permanent', notSelf: true, optional: true, good: false }); });
clx('Whenever you cast your first noncreature spell each turn, empower Jace 1.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', once: 'firstNC', effects: [cmd('empower', { n: 1 })] }); });
clx('At the beginning of combat on each opponent\'s turn, they may pay {2}. If they don\'t, creatures they control can\'t attack Jaces you control this turn.', R => { R.trig.push({ ev: 'combat', who: 'each', effects: [cmd('jaceTax')] }); });
clx('+1: Draw two cards, then put a card from your hand on the bottom of your library.', R => { R.acts.push({ loyalty: 1, effects: [{ t: 'draw', n: 2 }, cmd('bottomFromHand')], text: '+1: Draw two cards, then put a card from your hand on the bottom of your library.', sorcery: true }); });
clx('−3: Exile another target planeswalker or creature you control. Reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.', R => { R.acts.push({ loyalty: -3, effects: [{ t: 'cmd', id: 'jaceMinus3', target: 'perm', filter: 'creature or planeswalker you control', notSelf: true, good: true }], text: '−3: Exile another target planeswalker or creature you control. Reveal cards from the top of your library until you reveal a creature or planeswalker card. Put that card onto the battlefield and the rest on the bottom of your library in a random order.', sorcery: true }); });
clx('~ can be your commander.', R => { R.canBeCommander = true; });

registerRules({
    name: 'cmdr',
    effects: [
        [/^§venserCopies$/, () => ({ t: 'cmd', id: 'venserCopies', target: 'perm', filter: 'permanent an opponent controls', good: false })],
        [/^§venserSpell$/, () => ({ t: 'cmd', id: 'venserSpell', target: 'spell', filter: 'oppInstSorc', good: false })],
        [/^empower jace (\d+)$/i, m => ({ t: 'cmd', id: 'empower', n: +m[1] })],
        [/^return target spell or creature to its owner's hand$/i, () => ({ t: 'cmd', id: 'bounceSpellOrCreature', target: 'spellOrCreature', good: false })],
        [/^draw four cards, then put two cards from your hand on top of your library in any order$/i, () => ({ t: 'brainstorm', draw: 4 })],
        [/^counter target creature or planeswalker spell$/i, () => ({ t: 'counter', target: 'spell', filter: 'creature or planeswalker' })],
        [/^~ deals (\w+) damage to each creature and each opponent$/i, m => ({ t: 'cmd', id: 'dmgCreaturesAndOpps', n: nw(m[1]) })],
        [/^discard any number of cards, then draw that many cards$/i, () => ({ t: 'cmd', id: 'wheelAny' })],
        [/^its controller investigates$/i, () => ({ t: 'artToken', n: 1, kind: 'clue', forLastCtrl: true })],
        [/^destroy target creature or planeswalker$/i, () => ({ t: 'destroy', target: 'perm', filter: 'creature or planeswalker' })]
    ],
    triggers: [
        [/^Whenever another permanent you control leaves the battlefield, if it had counters on it, (.+)$/, () => SPEC('leaves', { another: true, hadCounters: true })],
        [/^Whenever an Angel you control enters, (.+)$/, () => SPEC('enters', { sub: 'Angel' })],
        [/^Whenever you cast a colorless spell, (.+)$/, () => ({ ev: 'cast', filter: 'colorless' })],
        [/^Whenever an Angel you control dies, (.+)$/, () => SPEC('dies', { sub: 'Angel' })],
        [/^Whenever an opponent casts their second spell each turn, (.+)$/, () => ({ ev: 'cast', filter: 'any', who: 'opp', nth: 2 })]
    ],
    lines: [ctx => { for (const [re, fn] of CL) { const m = ctx.line.match(re); if (m && fn(ctx.R, m, ctx) !== false) return true; } return false; }]
});
