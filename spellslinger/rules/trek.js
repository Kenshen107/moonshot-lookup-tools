// Spellslinger Duels - rules pack: the Star Trek cards (TRK, TRC, SDS), 2026-10-24, owner's request: make the current Star Trek cards playable.
// Wordings only; the engine pieces are in 15j-trek.js. Uses the cl / clx / cmd / act / SPEC / selfCond helpers from rules/cmdr.js.
// Sentence-level readings (modal bullets, saga chapters, spells) are in the registerRules call at the end; whole-line readings are the cl() lines.

const TKN = '(?:~|CARDNAME|Captain Archer|Captain Janeway|Captain Kirk|Captain Burnham|Dr\\. Crusher)';
const tkShip = (card) => Number.isFinite(parseFloat(card && card.power));
const TK_COND = n => `it has ${n} or more charge counters on it`;

// ===== Station and Spacecraft =====
cl(/^Station$/, R => {
    const a = parseActivated('{1}: Draw a card.', R);
    a.cost.mana = parseCost(''); a.effects = [cmd('tkStation')]; a.text = 'Station'; a.sorcery = true; a.onlyIf = 'you control an untapped creature other than ~';
    R.acts.push(a);
});
cl(/^(\d+)\+ \| (.+)$/, (R, m, ctx) => {
    const n = Number(m[1]), text = m[2].trim(), cond = TK_COND(n);
    R.stationTiers = (R.stationTiers || []).concat(n);
    if (tkShip(ctx.card)) R.stationAt = Math.max(R.stationAt || 0, n); // an artifact creature at the top tier (it has printed power and toughness)
    let mm;
    const kws = text.replace(/\.$/, '').toLowerCase().split(/,\s*/);
    if (kws.length && allKnown(kws)) { selfCond(R, { cond, p: 0, q: 0, kw: kws }); return; }
    if (/^Artifact creatures you control have flying\.$/.test(text)) { R.statics.push({ type: 'Artifact', p: 0, q: 0, kw: ['flying'], cond }); return; }
    if ((mm = text.match(/^Creatures you control get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ type: null, p: +mm[1], q: +mm[2], kw: [], cond }); return; }
    if (/^At the beginning of combat on your turn, create a 2\/1 red Klingon Warrior creature token with haste\. Sacrifice it at the beginning of the next end step\.$/.test(text)) {
        R.trig.push({ ev: 'combat', fn: 'myTurnCombat', cond, effects: [{ t: 'token', n: 1, p: 2, q: 1, name: 'red Klingon Warrior', kw: ['haste'], sacEnd: true }] }); return;
    }
    return false;
});
clx('Cloaking Device — As long as this Spacecraft isn\'t a creature, it has hexproof.', R => { selfCond(R, { cond: '~ isn\'t a creature', p: 0, q: 0, kw: ['hexproof'] }); });
clx('Whenever you cast a noncreature spell, if ~ isn\'t a creature, put two charge counters on it.', R => { R.trig.push({ ev: 'cast', filter: 'noncreature', cond: '~ isn\'t a creature', effects: [cmd('tkCharge', { n: 2 })] }); });
clx('{1}, {T}: Put two charge counters on target Spacecraft. Activate only as a sorcery.', (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('tkChargeTarget', { n: 2 })], a => { a.sorcery = true; }); });
clx('Whenever one or more charge counters are put on ~ for the first time each turn, exile the top card of your library. You may play that card this turn.', R => { R.trig.push({ ev: 'chargePut', fn: 'selfCharge', once: 'chg', effects: [cmd('tkExilePlay')] }); });
clx('Whenever ~ enters or deals combat damage to a player, return target creature card with mana value 4 or less from your graveyard to the battlefield with a finality counter on it.', R => {
    R.etb.push(cmd('tkFinality')); R.trig.push({ ev: 'hitPlayer', effects: [cmd('tkFinality')] });
});


// ===== Helpers =====
// "Whenever <something>, <effects>": the body is read by the card reader; false (not read) when it can't be
const tkT = (R, spec, body) => { const fx = parseEffects(body); if (!fx) return false; R.trig.push({ ...spec, effects: fx }); };
const TK_P8 = 'creatures you control have total power 8 or greater';
const OFFICER = n => ({ t: 'token', n, p: 1, q: 1, name: 'red Officer', kw: [] });
const BORG = n => ({ t: 'token', n, p: 1, q: 1, name: 'colorless Borg', kw: [], artifact: true });

// ===== Dilemmas (a player faces a dilemma when they choose modes) =====
cl(/^Whenever you face a dilemma, (.+)$/, (R, m) => tkT(R, { ev: 'dilemma', fn: 'myDilemma' }, m[1]));
cl(new RegExp('^Whenever you face a dilemma, put a \\+1\\/\\+?1 counter on ' + TKN + '\\.$'), R => { R.trig.push({ ev: 'dilemma', fn: 'myDilemma', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^At the beginning of your end step, create a 1\/1 red Officer creature token for each dilemma you've faced this turn\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('tkOfficersDilemma')] }); });
cl(new RegExp('^Whenever you cast a noncreature spell, put a quest counter on ' + TKN + '\\. Draw a card\\. Then discard a card unless there are three or more quest counters on ' + TKN + '\\.$'), R => { R.trig.push({ ev: 'cast', filter: 'noncreature', effects: [{ t: 'namedCounter', n: 1, kind: 'quest' }, { t: 'draw', n: 1 }, cmd('tkDiscardUnless', { kind: 'quest', n: 3 })] }); });
cl(new RegExp('^Whenever ' + TKN + ' becomes tapped, surveil 1\\. If its power is 4 or greater, instead draw a card\\.$'), R => { R.trig.push({ ev: 'tapped', effects: [cmd('tkRenoTap')] }); });
cl(/^Whenever a nontoken artifact you control enters, put a quest counter on ~\. Create a 1\/1 colorless Borg artifact creature token\. If ~ has six or more quest counters on it, create two of those tokens instead\.$/, R => { R.trig.push({ ev: 'enters', filt: 'nontokenArtifact', effects: [{ t: 'namedCounter', n: 1, kind: 'quest' }, cmd('tkBorgQuest')] }); });
cl(/^Whenever a creature you control enters, put a quest counter on ~\. Put a \+1\/\+1 counter on that creature\. If ~ has five or more quest counters on it, instead put two \+1\/\+1 counters on that creature\.$/, R => { R.trig.push(SPEC('enters', { type: 'Creature' }, { effects: [{ t: 'namedCounter', n: 1, kind: 'quest' }, cmd('tkSupport')] })); });
cl(/^Whenever a land you control enters, put a quest counter on ~\. Then exile cards from the top of your library until you exile a nonland card\. You may play that card this turn\. If ~ has five or more quest counters on it, add \{R\}\{R\}\.$/, R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [{ t: 'namedCounter', n: 1, kind: 'quest' }, cmd('tkExploratory')] })); });

// ===== Borg and assimilate =====
cl(/^When ~ enters, assimilate target creature card from an opponent's graveyard\.$/, R => { R.etb.push(cmd('tkAssimilateGy', { theirs: true })); });
cl(/^At the beginning of your end step, assimilate target creature card from a graveyard\.$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('tkAssimilateGy', { any: true })] }); });
cl(/^Whenever ~ enters or attacks, target opponent exiles cards from the top of their library until they exile a creature card\. Assimilate that card\. They put the rest on the bottom in a random order\.$/, R => { R.etb.push(cmd('tkBorgQueen')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkBorgQueen')] }); });
cl(/^Whenever ~ enters or attacks, assimilate a creature card exiled with it\. If you can't, exile up to one target creature\.$/, R => { R.etb.push(cmd('tkCubeAssimilate')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkCubeAssimilate')] }); });
cl(/^Affinity for artifact creatures$/, R => { R.affinityOf = 'Artifact Creature'; });
cl(/^Artifact creatures you control have "Whenever ~ deals combat damage to a player, you may pay \{1\}\. If you do, create a 1\/1 colorless Borg artifact creature token\."$/, R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, only: 'artifact', effects: [cmd('tkBorgHit', { pay: 1 })] }); });
cl(/^Artifact creatures you control have "Whenever ~ deals combat damage to a player, create a 1\/1 colorless Borg artifact creature token\."$/, R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, only: 'artifact', effects: [cmd('tkBorgHit', { pay: 0 })] }); });
cl(/^Artifact creatures you control have "Whenever ~ deals combat damage to a player, you may pay 1 life\. If you do, draw a card\."$/, R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, only: 'artifact', effects: [cmd('tkHiveDraw')] }); });
cl(/^Artifact creatures you control have "Whenever ~ attacks, each opponent loses 1 life and you gain 1 life\."$/, R => { R.trig.push({ ev: 'attacks', fn: 'artifactAttacks', effects: [{ t: 'drain', n: 1 }, { t: 'gain', n: 1 }] }); });
cl(/^\{2\}: Artifact creatures you control gain menace until end of turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}', [cmd('tkArtifactMenace')]); });
cl(/^~'s power is equal to the number of artifact creatures you control\.$/, R => { R.cdaSet = { p: 'the number of artifact creatures you control' }; });
cl(/^When ~ enters, if you cast it, destroy all nonartifact creatures\.$/, R => { R.etb.push(cmd('tkCrystalline')); });

// ===== Differently named lands (Strange new worlds) and Federation =====
cl(/^~'s power and toughness are each equal to the number of differently named lands you control\.$/, R => { R.cdaSet = { p: 'differently named lands you control', q: 'differently named lands you control' }; });
cl(/^~'s power is equal to the number of differently named lands you control\.$/, R => { R.cdaSet = { p: 'differently named lands you control' }; });
cl(/^When ~ enters, you gain life equal to the number of differently named lands you control\.$/, R => { R.etb.push(cmd('tkGainLands')); });
cl(/^When ~ enters, create X 1\/1 red Officer creature tokens, where X is the number of differently named lands you control\.$/, R => { R.etb.push(cmd('tkOfficersLands')); });
cl(/^At the beginning of your first main phase, draw a card\. Then discard a card unless you control five or more differently named lands\.$/, R => { R.trig.push({ ev: 'main1', effects: [{ t: 'draw', n: 1 }, cmd('tkSevenDiscard')] }); });
cl(/^\{6\}\{U\}: ~'s base power and toughness become 7\/9\. Activate only if you control seven or more differently named lands\.$/, (R, m, ctx) => { act(R, ctx.line, '{6}{U}', [{ t: 'baseSelf', p: 7, q: 9 }], a => { a.onlyIf = 'you control seven or more differently named lands'; }); });
cl(/^When ~ enters, look at the top X cards of your library, where X is the number of creature types among non-Borg creatures you control\. Put one of them into your hand and the rest on the bottom of your library in a random order\.$/, R => { R.etb.push(cmd('tkHoshi')); });
cl(/^When ~ enters, ~ deals X damage to target attacking or blocking creature an opponent controls, where X is the number of creature types among non-Borg creatures you control\.$/, R => { R.etb.push(cmd('tkSaavik', { target: 'creature', theirs: true, good: false })); });
cl(/^\{G\}, \{T\}: Target creature you control gets \+X\/\+X until end of turn, where X is the number of creature types among non-Borg creatures you control\. Activate only as a sorcery\.$/, (R, m, ctx) => { act(R, ctx.line, '{G}, {T}', [cmd('tkArcherPump', { target: 'creature', mine: true, good: true })], a => { a.sorcery = true; }); });
cl(new RegExp('^When ' + TKN + ' enters, create Porthos, a legendary 1\\/1 green Dog creature token\\.$'), R => { R.etb.push({ t: 'token', n: 1, p: 1, q: 1, name: 'green Dog', named: 'Porthos', kw: [], legendary: true }); });
cl(/^\{5\}, \{T\}: Choose a color\. Add an amount of mana of that color equal to the number of creature types among non-Borg creatures you control\.$/, (R, m, ctx) => { act(R, ctx.line, '{5}, {T}', [cmd('tkAcademyMana')], a => { a.manaLike = true; }); });
cl(/^\{6\}: Create a tapped Planet land token named New Planet with "\{T\}: Add one mana of any color\." Activate only as a sorcery\.$/, (R, m, ctx) => { act(R, ctx.line, '{6}', [cmd('tkNewPlanet')], a => { a.sorcery = true; }); });
cl(/^When ~ enters, choose one —$/, () => false);

// ===== Beam me up, charge counters and Spacecraft helpers =====
cl(/^Beam me up (\{[^}]+\}(?:\{[^}]+\})*)$/, (R, m) => { R.beam = parseCost(m[1]); });
cl(/^During your main phase, each card in your graveyard has beam me up\. The beam me up cost is equal to that spell's mana cost\. ~ can't be beamed up to cast a spell this way\.$/, R => { R.scotty = true; });
cl(/^Enchant artifact or creature$/, R => { R.aura = true; R.auraTarget = 'artifact or creature'; R.marooned = true; });
cl(/^If you would put one or more charge counters on an artifact you control, put twice that many charge counters on that artifact instead\.$/, R => { R.geordi = true; });
cl(/^If you would put one or more counters on a creature you control, put twice that many of each of those kinds of counters on that creature instead\.$/, R => { R.mbenga = true; });
cl(/^Other creatures you control with counters on them have hexproof\.$/, R => { R.statics.push({ type: null, other: true, p: 0, q: 0, kw: ['hexproof'], fn: 'hasCounters' }); });
cl(/^Whenever ~ becomes tapped, until end of turn, if one or more counters would be put on a permanent you control, that many plus one of each of those kinds of counters are put on that permanent instead\.$/, R => { R.trig.push({ ev: 'tapped', effects: [cmd('tkBoimler')] }); });
cl(/^During your turn, Spacecraft you control have hexproof\.$/, R => { R.hemmer = true; });
cl(/^Whenever you cast a Spacecraft spell, put a \+1\/\+1 counter on target creature\.$/, R => { R.trig.push({ ev: 'cast', filter: 'types:Spacecraft', effects: [{ t: 'counters', n: 1, target: 'creature', good: true }] }); });
cl(/^Whenever you cast a creature or Spacecraft spell, create a 1\/1 red Officer creature token\.$/, R => { R.trig.push({ ev: 'cast', filter: 'types:Creature|Spacecraft', effects: [OFFICER(1)] }); });
cl(/^Tap seven untapped Officers you control: Search your library for a Spacecraft card, put it onto the battlefield with seven charge counters on it, then shuffle\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('tkPicardFetch')], a => { a.cost.mana = parseCost(''); a.onlyIf = 'you control seven or more untapped Officers'; }); });
cl(/^Whenever you draw your second card each turn, put a \+1\/\+1 counter on up to one other target creature and two charge counters on up to one target Spacecraft\.$/, R => { R.trig.push({ ev: 'draw', who: 'you', nth: 2, effects: [cmd('tkLuminaryDraw')] }); });
cl(/^Whenever another historic permanent you control with mana value 3 or greater enters, draw a card\.$/, R => { R.trig.push(SPEC('enters', { another: true, ctl: 'you', mvMin: 3, historic: true }, { effects: [{ t: 'draw', n: 1 }] })); });
cl(/^Whenever ~ enters or attacks, search your library and\/or graveyard for a basic land card or a card named Starship Enterprise, reveal it, and put it into your hand\. If you search your library this way, shuffle\.$/, R => { R.etb.push(cmd('tkKirkSearch')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkKirkSearch')] }); });

// ===== The Officers, Klingons and the "total power 8" attack triggers =====
cl(/^Whenever you attack while creatures you control have total power 8 or greater, exile the top card of your library\. You may play that card this turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', cond: TK_P8, effects: [{ t: 'exileTop', n: 1, play: 0 }] }); });
cl(/^Whenever you attack while creatures you control have total power 8 or greater, target creature can't block this turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', cond: TK_P8, effects: [{ t: 'pump', p: 0, q: 0, kw: ['cantblock'], target: 'creature', theirs: true, good: false }] }); });
cl(/^Whenever you attack while creatures you control have total power 8 or greater, target attacking creature gets \+2\/\+0 and gains first strike until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', cond: TK_P8, effects: [{ t: 'pump', p: 2, q: 0, kw: ['first strike'], target: 'creature', only: 'attacking creature', mine: true, good: true }] }); });
cl(/^Whenever you attack while creatures you control have total power 8 or greater, put a \+1\/\+1 counter on ~\. Untap it\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', cond: TK_P8, effects: [{ t: 'counters', n: 1, target: 'self' }, { t: 'untapSelf' }] }); });
cl(/^Whenever you attack while creatures you control have total power 8 or greater, double ~'s power until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', cond: TK_P8, effects: [{ t: 'doublePower' }] }); });
cl(/^Tap two untapped artifacts and\/or creatures you control: Put a \+1\/\+1 counter on ~\. Activate only as a sorcery\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('tkWorfCounter')], a => { a.cost.mana = parseCost(''); a.sorcery = true; a.onlyIf = 'you control two or more untapped artifacts and/or creatures other than ~'; }); });
cl(/^At the beginning of combat on your turn, create a 2\/1 red Klingon Warrior creature token with haste\. Sacrifice it at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [{ t: 'token', n: 1, p: 2, q: 1, name: 'red Klingon Warrior', kw: ['haste'], sacEnd: true }] }); });
cl(/^Whenever ~ attacks, attacking Klingons you control get \+1\/\+1 until end of turn\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkKrugePump')] }); });
cl(/^\{1\}, Sacrifice a creature: Put a \+1\/\+1 counter on each Klingon you control\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, Sacrifice a creature', [cmd('tkChangPump')]); });
cl(/^Sacrifice another creature: ~ gains trample until end of turn\. If you sacrificed a Klingon this way, you draw a card and lose 1 life\.$/, (R, m, ctx) => { act(R, ctx.line, 'Sacrifice another creature', [cmd('tkGowron')]); });
cl(/^When ~ die, create a 2\/1 red Klingon Warrior creature token with haste\.$/, R => { R.trig.push({ ev: 'dies', effects: [{ t: 'token', n: 1, p: 2, q: 1, name: 'red Klingon Warrior', kw: ['haste'] }] }); });
cl(/^At the beginning of your end step, each player creates two 1\/1 white Tribble creature tokens with "~ can't block\."$/, R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('tkTribbles')] }); });
cl(/^All Tribbles get \+1\/\+0 and are goaded\.$/, R => { R.statics.push({ type: 'Tribble', global: true, p: 1, q: 0, kw: [] }); R.tribbleGoad = true; });
cl(/^~ can't attack alone\.$/, R => { R.cantAttackAlone = true; });
cl(/^Whenever ~ becomes tapped, put a promotion counter on it\. Then if there are three or more promotion counters on her, remove those counters and she deals 2 damage to each opponent\.$/, R => { R.trig.push({ ev: 'tapped', effects: [cmd('tkMariner')] }); });
cl(/^Whenever a land you control enters, ~ deals 1 damage to each opponent\. If this is the second time this ability has resolved this turn, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('tkBurnham')] })); });
cl(/^Whenever a land you control enters, Captain Burnham deals 1 damage to each opponent\. If this is the second time this ability has resolved this turn, put a \+1\/\+1 counter on Captain Burnham\.$/, R => { R.trig.push(SPEC('landfall', { type: 'Land' }, { effects: [cmd('tkBurnham')] })); });
cl(/^At the beginning of combat on your turn, target creature you control gets \+1\/\+0 until end of turn\. Then that creature gains menace until end of turn if creatures you control have total power 8 or greater\.$/, R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', effects: [cmd('tkCaptainBoost', { target: 'creature', mine: true, good: true })] }); });
cl(new RegExp('^Whenever ' + TKN + ' enters or attacks, choose one\\. If you have no cards in hand, choose one or more instead\\.$'), (R, m, ctx) => {
    let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++; ctx.li = j - 1;
    R.etb.push(cmd('tkKirkModes')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkKirkModes')] });
});
cl(new RegExp('^Whenever ' + TKN + ' or another creature you control enters, that creature explores\\.$'), R => { R.trig.push(SPEC('enters', { type: 'Creature' }, { effects: [cmd('tkExploreEntered')] })); });
cl(/^Whenever ~ becomes tapped, until end of turn, if one or more counters would be put on a permanent you control, that many plus one of each of those kinds of counters are put on that permanent instead\.$/, R => { R.trig.push({ ev: 'tapped', effects: [cmd('tkBoimler')] }); });
cl(/^You may play lands and cast creature spells from the top of your library\.$/, R => { R.castTopCreatures = true; R.landsFromTop = true; });
cl(/^\{T\}: Add X mana of any one color, where X is the greatest mana value among commanders you control\.$/, (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('tkChairMana')], a => { a.manaLike = true; }); });
cl(/^Whenever ~ enters or attacks, reveal the top card of your library\. You may cast that card without paying its mana cost if that spell's mana value is equal to or less than the number of differently named lands you control\. If it's a land card, you may put it onto the battlefield tapped\. If that card is still on top of your library, draw a card\.$/, R => { R.etb.push(cmd('tkSpock')); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkSpock')] }); });
cl(/^When ~ enters, mill two cards, then put a \+1\/\+1 counter on ~ for each artifact and\/or creature card in your graveyard\.$/, R => { R.etb.push(cmd('tkCetiEel')); });
cl(/^\{1\}, \{T\}: Put target card from your graveyard on the bottom of your library\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('tkGyBottom')]); });
cl(/^When ~ enters, you may sacrifice another nonland permanent\. When you do, ~ deals 2 damage to any target\.$/, R => { R.etb.push(cmd('tkDahar')); });
cl(/^\{2\}, Put ~ from your graveyard on the bottom of your library: You gain 2 life\.$/, R => { R.acts.push({ cost: { mana: parseCost('{2}'), tap: false, sacSelf: false, life: 0, discard: 0, exileSelfGy: true }, effects: [{ t: 'gain', n: 2 }, cmd('tkBottomSelf')], text: 'Put ~ from your graveyard on the bottom of your library: You gain 2 life.', gy: true }); });

// ===== Cards that care about counters, life, drawing and other replacement-style abilities =====
cl(/^If you gaining life causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time\.$/, R => { R.crusher = true; });
cl(/^Whenever you gain life, put a \+1\/\+1 counter on (?:~|Dr\. Crusher)\.$/, R => { R.trig.push({ ev: 'gainLife', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^You don't lose the game for having 0 or less life\.$/, R => { R.noLifeLoss = true; });
cl(/^If you would draw a card, draw two cards instead\.$/, R => { R.drawTwo = true; });
cl(/^If another creature you control with a \+1\/\+1 counter on it would be destroyed, instead remove all \+1\/\+1 counters from it and all damage already dealt to it is healed\.$/, R => { R.mccoy = true; });
cl(/^If a creature you control would enter while you control an attacking creature, instead it enters tapped and attacking\.$/, R => { R.kira = true; });
cl(/^Whenever a creature you control with a counter on it deals combat damage to a player, draw a card\.$/, R => { R.trig.push({ ev: 'hitPlayer', anyMine: true, modified: true, effects: [{ t: 'draw', n: 1 }] }); });
cl(/^You can't sacrifice Treasure tokens\.$/, R => { R.noSacTreasure = true; });
cl(/^Whenever you play a card from exile, create a Treasure token\.$/, R => { R.trig.push({ ev: 'playedFromExile', fn: 'myPlay', effects: [{ t: 'artToken', n: 1, kind: 'treasure' }] }); });
cl(/^As ~ enters, choose a number between 0 and 10\.$/, R => { R.chooseNumber = 10; });
cl(/^Whenever an opponent casts a spell with mana value equal to the chosen number, you draw a card\.$/, R => { R.trig.push({ ev: 'cast', who: 'opp', filter: 'chosenMv', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^\{1\}, \{T\}: Another target creature gets \+X\/\+X until end of turn, where X is ~'s power\. Activate only as a sorcery\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('tkPicardPump', { target: 'creature', notSelf: true, good: true })], a => { a.sorcery = true; }); });
cl(/^\{1\}, \{T\}: Put a \+1\/\+1 counter on each creature you control that entered this turn\. If you put two or more \+1\/\+1 counters on creatures this way, draw a card\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}, {T}', [cmd('tkGuinan')]); });
cl(/^\{1\}, Remove three counters from among creatures you control: Draw a card\.$/, (R, m, ctx) => { act(R, ctx.line, '{1}', [cmd('tkDataDraw')], a => { a.onlyIf = 'you control creatures with three or more counters among them'; }); });
cl(/^Whenever you gain life, put a \+1\/\+1 counter on ~\.$/, R => { R.trig.push({ ev: 'gainLife', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
cl(/^Whenever a card leaves your graveyard, draw a card\. This ability triggers only once each turn\.$/, R => { R.trig.push({ ev: 'gyLeave', once: 'vash', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^Whenever a card leaves your graveyard, create a 3\/3 colorless Illusion artifact creature token\. This ability triggers only once each turn\.$/, R => { R.trig.push({ ev: 'gyLeave', once: 'holo', effects: [{ t: 'token', n: 1, p: 3, q: 3, name: 'colorless Illusion', kw: [], artifact: true }] }); });
cl(/^Whenever you cast a noncreature spell, if ~ isn't a creature, put two charge counters on it\.$/, R => { R.trig.push({ ev: 'cast', filter: 'noncreature', cond: '~ isn\'t a creature', effects: [cmd('tkCharge', { n: 2 })] }); });
cl(/^As long as ~ isn't a creature, it has hexproof\.$/, R => { selfCond(R, { cond: '~ isn\'t a creature', p: 0, q: 0, kw: ['hexproof'] }); });
cl(/^Whenever ~ or another nontoken legendary permanent you control enters, create a Food token\.$/, R => { R.trig.push(SPEC('enters', { legendary: true, nontoken: true, ctl: 'you' }, { effects: [{ t: 'artToken', n: 1, kind: 'food' }] })); });

// ===== Equipment and other artifacts =====
cl(/^When you cast ~, copy it\.$/, R => { R.castTrig = [cmd('tkCopyCommunicator')]; });
cl(/^Equipped creature has "Whenever ~ attacks, draw X cards, then you may put up to X land cards from your hand onto the battlefield tapped, where X is the number of other creatures you control with a Communicator attached to them\."$/, R => { R.trig.push({ ev: 'attacks', fn: 'hostAttacks', host: true, effects: [cmd('tkCommunicator')] }); });
cl(/^Equipped creature gets \+2\/\+2 and has "Whenever ~ attacks, look at the top five cards of your library\. You may put a Klingon or Warrior creature card from among them onto the battlefield\. Put the rest on the bottom of your library in a random order\."$/, R => { R.buff = { p: 2, q: 2, kw: [] }; R.trig.push({ ev: 'attacks', fn: 'hostAttacks', host: true, effects: [cmd('tkKahless')] }); });
cl(/^Sunburst$/, R => { R.sunburst = true; R.etbNamedX = 'charge'; });
cl(/^\{2\}, Sacrifice ~: Destroy each nonland permanent with mana value equal to the number of charge counters on ~\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, Sacrifice ~', [cmd('tkExplosives')]); });
cl(/^Kicker—Sacrifice an artifact or creature\.$/, R => { R.kickerSac = true; });
cl(/^\{2\}: Artifact creatures you control gain menace until end of turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}', [cmd('tkArtifactMenace')]); });
cl(/^\{2\}, \{T\}: Create a tapped token that's a copy of target token you control\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('tkReplicator')]); });
cl(/^Once during each of your turns, you may play a permanent card you own from outside the game or from your graveyard\.$/, R => { R.holodeck = true; R.acts.push({ cost: { mana: parseCost(''), tap: false, sacSelf: false, life: 0, discard: 0 }, effects: [cmd('tkHolodeck')], text: 'Once during each of your turns, you may play a permanent card you own from your graveyard.', once: true, onlyIf: 'it is your turn' }); });

// ===== ETB and other whole-line readers =====
cl(/^When ~ enters, put a \+1\/\+1 counter on target creature\. Then put a \+1\/\+1 counter on each creature you control with a counter on it\.$/, R => { R.etb.push(cmd('tkDoctorEmh', { target: 'creature', good: true })); });
cl(/^When ~ enters, return up to one other target creature or artifact you control to its owner's hand\.$/, R => { R.etb.push(cmd('tkOBrienEtb')); });
cl(/^At the beginning of each end step, if a permanent was returned to your hand from the battlefield this turn, draw a card\.$/, R => { R.trig.push({ ev: 'end', who: 'any', cond: 'a permanent was returned to your hand from the battlefield this turn', effects: [{ t: 'draw', n: 1 }] }); });
cl(/^When ~ enters, look at the top five cards of your library\. Put a land card from among them onto the battlefield tapped and the rest into your graveyard\.$/, R => { R.etb.push(cmd('tkHitIt')); });
cl(/^When ~ enters, look at the top four cards of your library\. You may reveal a noncreature, nonland card from among them and put it into your hand\. Put the rest on the bottom of your library in any order\.$/, R => { R.etb.push(cmd('tkSpockLook')); });
cl(/^When ~ enters, look at target opponent's hand\. You may choose a nonland card from it\. If you do, that player exiles that card, then draws a card\.$/, R => { R.etb.push(cmd('tkSaltVampire')); });
cl(/^When ~ enters, look at target opponent's hand\. You may exile a nonland card from it\. For as long as that card remains exiled, its owner may play it\. A spell cast this way costs \{2\} more to cast\.$/, R => { R.etb.push(cmd('tkZero')); });
cl(/^When ~ enters, mill three cards\. Then return a land card from your graveyard to your hand\. If you can't, create a Treasure token\.$/, R => { R.etb.push(cmd('tkConqueror')); });
cl(/^When ~ enters, for each opponent, gain control of up to one target creature that player controls with mana value 3 or less until end of turn\. Untap those creatures\. Until end of turn, they become Warriors in addition to their other types and gain haste\.$/, R => { R.etb.push(cmd('tkWorfContractor')); });
cl(/^When ~ enters, exile target creature card with mana value 3 or less from your graveyard\. Create a token that's a copy of it\. That token gains haste\. Sacrifice it at the beginning of the next end step\.$/, R => { R.etb.push(cmd('tkBlastoneuron')); });
cl(/^When ~ enters, you may sacrifice another creature or artifact\. If you do, draw two cards\.$/, R => { R.etb.push(cmd('tkKhanEtb')); });
cl(/^You may cast ~ from exile\.$/, R => { R.castFromExileSelf = true; });
cl(/^When ~ enters, shuffle your library, then exile cards from the top of your library until you exile a nonland card\. That nonland card gains "Exile a card from your hand: Create a copy of ~\. You may cast the copy\. Activate only during your turn and only if ~ is exiled\."$/, R => { R.etb.push(cmd('tkQ')); });
cl(/^When (?:~|~ Chekov) enters, each opponent exiles the top X cards of their library, where X is the number of differently named lands you control\. For each opponent, choose a land card that player owns exiled this way\. You may play the chosen cards (?:this turn|for as long as they remain exiled)\.$/, R => { R.etb.push(cmd('tkChekov')); });
cl(/^You may have ~ enter as a copy of any artifact or creature on the battlefield, except it isn't legendary\. If you do, it enters with additional counters on it equal to the same number and kinds of counters the copied permanent has on it\.$/, R => { R.clone = { what: 'artifact or creature', notLegendary: true, copyCounters: true }; });
cl(/^You may cast ~ from your graveyard\. If you do, it enters with a finality counter on it\.$/, R => { R.gyCast = { life: 0, discard: 0, exile: false, finality: true }; R.gyCastFinality = true; });
cl(/^~ can't be beamed up\.$/, () => {});
cl(/^Enchanted permanent doesn't untap during its controller's untap step and can't be beamed up\.$/, R => { R.noUntapHost = true; R.marooned = true; });
cl(/^When ~ enters, you may pay \{3\}\. If you do, tap enchanted permanent\.$/, R => { R.etb.push(cmd('tkMarooned')); });
cl(/^At the beginning of combat on each player's turn, that player may draw a card\. If they do, they can't attack this turn and you put a peace counter on ~\.$/, R => { R.trig.push({ ev: 'combat', who: 'any', effects: [cmd('tkPeace')] }); });
cl(/^At the beginning of your upkeep, choose one that hasn't been chosen —$/, (R, m, ctx) => {
    let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++; ctx.li = j - 1;
    R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('tkKobayashi')] });
});
cl(/^Whenever ~ enters or attacks, choose one —$/, (R, m, ctx) => {
    let j = ctx.li + 1; while (j < ctx.lines.length && ctx.lines[j].startsWith('•')) j++;
    const bullets = ctx.lines.slice(ctx.li + 1, j).map(b => b.replace(/^•\s*/, ''));
    const modes = bullets.map(b => parseEffects(b));
    if (!modes.length || !modes.every(Boolean)) return false;
    ctx.li = j - 1;
    const eff = [{ t: 'modal', modes, n: 1 }];
    R.trig.push({ ev: 'selfEnters', effects: eff }); R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: eff });
});

cl(/^Whenever ~ attacks, you may sacrifice another creature or artifact\. If you do, draw a card\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'selfAttacks', effects: [cmd('tkSacDraw')] }); });
cl(/^\{2\}\{W\}\{U\}\{B\}\{R\}\{G\}, \{T\}: Exile the top five cards of your library\. You may cast any number of spells with mana value less than or equal to the number of Officers you control from among those cards without paying their mana costs\.$/, (R, m, ctx) => { act(R, ctx.line, '{2}{W}{U}{B}{R}{G}, {T}', [cmd('tkSiskoCast')]); });
cl(/^At the beginning of combat on your turn, if you've cast a noncreature spell this turn, create a token that's a copy of target creature you control, except it isn't legendary\. It gains haste until end of turn\. Sacrifice it at the beginning of the next end step\.$/, R => { R.trig.push({ ev: 'combat', fn: 'myTurnCombat', cond: 'you\'ve cast a noncreature spell this turn', effects: [{ t: 'cmd', id: 'tkGrayAdira', target: 'creature', mine: true, good: true }] }); });
cl(/^\{R\}: All creatures gain trample and haste until end of turn\.$/, (R, m, ctx) => { act(R, ctx.line, '{R}', [cmd('tkKenrithHaste')]); });
cl(/^\{4\}\{B\}: Put target creature card from a graveyard onto the battlefield under its owner's control\.$/, (R, m, ctx) => { act(R, ctx.line, '{4}{B}', [cmd('tkKenrithReanimate')]); });
cl(/^When ~ enters and at the beginning of your upkeep, exile the top four cards of your library\. Put all permanent cards exiled this way onto the battlefield\.$/, R => { R.etb.push(cmd('tkDs9')); R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('tkDs9')] }); });
cl(/^Whenever you attack, exile the top X cards of your library, where X is the number of opponents you attacked this turn\. Until the end of your next turn, you may play those cards\.$/, R => { R.trig.push({ ev: 'attacks', fn: 'youAttack', effects: [cmd('tkBattlefront')] }); });
// ===== Sagas =====
cl(/^III — You may sacrifice an artifact or creature\. If you do, create two 2\/2 black Romulan creature tokens\.$/, R => { R.saga = R.saga || {}; (R.saga[3] = R.saga[3] || []).push(cmd('tkMoonlight3')); });
cl(/^I — Each opponent sacrifices a nontoken creature of their choice\.$/, R => { R.saga = R.saga || {}; (R.saga[1] = R.saga[1] || []).push(cmd('tkEdictNontoken')); });
cl(/^I, II, III — Draw two cards, then exile a card from your hand\.$/, R => { R.saga = R.saga || {}; [1, 2, 3].forEach(k => (R.saga[k] = R.saga[k] || []).push({ t: 'draw', n: 2 }, cmd('tkAllGood'))); });
cl(/^IV — If all cards exiled with ~ share a card type, you gain 10 life\.$/, R => { R.saga = R.saga || {}; (R.saga[4] = R.saga[4] || []).push(cmd('tkAllGoodIV')); });
// ===== Multi-sentence spells and modal bullets: the card reader splits text into sentences and rewrites some words first,
// so wordings that need several sentences are rewritten to one token here (like the Commander precons do) and read by one entry. =====
const TK_EFFECTS = [];
const tkRW = (re, id, fx) => { CMD_REWRITES.push([new RegExp(re.source, 'g'), `§${id}.`]); TK_EFFECTS.push([new RegExp(`^§${id}$`), () => fx]); };
const TKT = { t: 'tap', target: 'creature', stun: true, good: false };
tkRW(/Exile target creature or Spacecraft\. Its controller may search their library for a basic land card, reveal it, put it into their hand, then shuffle\./, 'tkSeventyK', [{ t: 'exile', target: 'perm', filter: 'types:Creature|Spacecraft', good: false }, cmd('tkFetchHandLastCtrl')]);
tkRW(/Target creature gets \+2\/\+0 until end of turn\. When that creature dies this turn, you draw a card\./, 'tkGoodDay', [{ t: 'pump', p: 2, q: 0, kw: [], target: 'creature', good: true }, { t: 'cmd', id: 'tkDeathDraw', target: 'last' }]);
tkRW(/Target creature or Spacecraft's owner puts it on their choice of the top or bottom of their library\./, 'tkGuidance', [{ t: 'cmd', id: 'tkGuidanceFailure', target: 'perm', filter: 'types:Creature|Spacecraft', good: false }]);
tkRW(/Counter target spell with mana value 2 or less\. If ~ was kicked, instead counter target spell\./, 'tkIllogical', [{ t: 'counter', target: 'spell', filter: 'mv<=2', kickedFilter: 'any' }]);
tkRW(/Target creature gets -2\/-2 until end of turn\. If ~ was kicked, that creature gets -6\/-6 until end of turn instead\./, 'tkEject', [{ t: 'pump', p: -2, q: -2, kw: [], target: 'creature', good: false, kickedP: { p: -6, q: -6 } }]);
tkRW(/Tap up to one target creature and put a stun counter on it\./, 'tkStunOpt', [{ ...TKT, optional: true }]);
tkRW(/Tap up to one target artifact or creature\. Put a stun counter on it\./, 'tkStunArt', [{ t: 'tap', target: 'perm', filter: 'artifact, creature, or land', stun: true, good: false, optional: true }]);
tkRW(/Tap target creature an opponent controls\. Put two stun counters on it\./, 'tkStunTwo', [{ t: 'tap', target: 'creature', theirs: true, stun: 2, good: false }]);
tkRW(/Tap target creature and put a stun counter on it\./, 'tkStunOne', [TKT]);
tkRW(/Temba, His Arms Wide — Target creature gets \+3\/\+3 and gains trample until end of turn\./, 'tkTemba', [{ t: 'pump', p: 3, q: 3, kw: ['trample'], target: 'creature', good: true }]);
tkRW(/Shaka, When the Walls Fell — Each opponent sacrifices a nontoken artifact or enchantment of their choice\./, 'tkShaka', [cmd('tkShaka')]);
tkRW(/Draw X cards, where X is the number of differently named lands you control\. You have no maximum hand size until your next turn\./, 'tkDeepScan', [cmd('tkDeepSpaceScan'), { t: 'noMaxHandForever' }]);
tkRW(/Destroy all creatures\. Create X 1\/1 colorless Borg artifact creature tokens, where X is the number of nonartifact creatures destroyed this way\./, 'tkJoin', [cmd('tkJoinCollective')]);
tkRW(/Put a \+1\/\+1 counter on target creature you control\. Untap it\. Until end of turn, it gets \+1\/\+1 and becomes a Doctor\./, 'tkDoctor', [{ t: 'cmd', id: 'tkDoctorNot', target: 'creature', mine: true, good: true }]);
tkRW(/Create a token that's a copy of target creature an opponent controls, except it has menace\. If ~ was kicked, instead for each creature target opponent controls, create a token that's a copy of that creature, except it has menace\./, 'tkMirror', [{ t: 'cmd', id: 'tkMirrorIntrusion', target: 'creature', theirs: true, good: false }]);
tkRW(/Distribute two \+1\/\+1 counters among one or two target creatures\./, 'tkPure', [cmd('tkPureEnergy')]);
tkRW(/One or two target creatures you control each deal damage equal to their power to target creature an opponent controls\./, 'tkGoal', [cmd('tkCommonGoal')]);
tkRW(/Target artifact or creature you control gains hexproof and indestructible until end of turn\. If it's a creature, put a \+1\/\+1 counter on it\./, 'tkShields', [{ t: 'cmd', id: 'tkShieldsUp', target: 'perm', filter: 'artifact, creature, or land you control', mine: true, good: true }]);
tkRW(/Target opponent draws a card\. You draw two cards\./, 'tkConviction', [{ t: 'oppDraws', n: 1 }, { t: 'draw', n: 2 }]);
tkRW(/Plain, Simple Garak — Exile target card from a graveyard\. Draw a card\./, 'tkGarak', [{ t: 'exileGy' }, { t: 'draw', n: 1 }]);
tkRW(/Of the Obsidian Order — Return target creature card from your graveyard to your hand\./, 'tkObsidian', [{ t: 'regrow', what: 'creature' }]);
tkRW(/Return target artifact creature card with mana value 3 or less from your graveyard to the battlefield\./, 'tkResist', [cmd('tkReturnArtifactCreature')]);
tkRW(/Look at the top five cards of your library\. You may reveal a Plains card or nonland permanent card with mana value 3 or less from among them and put it into your hand\. Put the rest on the bottom in a random order\./, 'tkCoffee', [cmd('tkCoffee')]);
tkRW(/Creatures your opponents control get -1\/-0 until your next turn\./, 'tkVger', [cmd('tkVgerShrink')]);
tkRW(/Look at target opponent's hand, then draw a card\./, 'tkVgerLook', [{ t: 'lookHand', target: 'player', oppOnly: true }, { t: 'draw', n: 1 }]);
tkRW(/Return up to one target creature an opponent controls with mana value 3 or less to its owner's hand\./, 'tkHail', [{ t: 'bounce', target: 'perm', filter: 'creature with mana value 3 or less you don\'t control', optional: true }]);
tkRW(/Hail — Return up to one target creature an opponent controls with mana value 3 or less to its owner's hand\./, 'tkHail2', [{ t: 'bounce', target: 'perm', filter: 'creature with mana value 3 or less you don\'t control', optional: true }]);
tkRW(/Each opponent sacrifices a nontoken permanent of their choice\./, 'tkEdictPerm', [cmd('tkEdictNontokenPerm')]);
tkRW(/Each opponent sacrifices a nontoken creature of their choice\./, 'tkEdictCreature', [cmd('tkEdictNontoken')]);
// Sagas
tkRW(/All artifacts and creatures phase out\. Create a 0\/1 white Human creature token with "Permanents can't phase in\."/, 'tkCity1', [cmd('tkCityI')]);
tkRW(/You draw two cards and each player loses 2 life\./, 'tkCity2', [{ t: 'draw', n: 2 }, cmd('tkEachLose', { n: 2 })]);
tkRW(/Sacrifice a creature token\. If you do, you gain 5 life\./, 'tkCity3', [cmd('tkCityIII')]);
tkRW(/Return target green or white creature card from your graveyard to the battlefield\./, 'tkInner1', [cmd('tkInnerI')]);
tkRW(/Choose target creature\. Whenever it deals combat damage to a player this turn, you draw that many cards\./, 'tkInner2', [{ t: 'cmd', id: 'tkInnerII', target: 'creature', good: true }]);
tkRW(/You gain life equal to the greatest power among creatures you control\. Create a Treasure token\./, 'tkInner3', [cmd('tkInnerIII'), { t: 'artToken', n: 1, kind: 'treasure' }]);
tkRW(/~ deals 4 damage to target creature an opponent controls\. At the beginning of the next combat this turn, gain control of that creature until end of turn\. Untap it\. It gains haste until end of turn\./, 'tkWrath1', [{ t: 'cmd', id: 'tkWrathI', target: 'creature', theirs: true, good: false }]);
tkRW(/You may exile a card from your hand\. If you do, draw a card\./, 'tkWrath2', [cmd('tkWrathLoot')]);
tkRW(/Each opponent sacrifices a nontoken permanent of their choice\./, 'tkWrath3', [cmd('tkEdictNontokenPerm')]);
tkRW(/Return up to one target artifact, instant, or sorcery card from your graveyard to your hand\./, 'tkOld2', [cmd('tkOldScientists2')]);
tkRW(/Choose up to two target cards in graveyards\. The owners of those cards shuffle them into their libraries\./, 'tkOld3', [cmd('tkOldScientists3')]);

registerRules({
    name: 'trek',
    effects: [
        ...TK_EFFECTS,
        // Single sentences the reader leaves as they are
        [/^put (a|two) stun counters? on (?:it|~)$/, m => ({ t: 'cmd', id: 'tkStunLast', n: m[1] === 'a' ? 1 : 2, target: 'last' })],
        [/^investigate twice$/, () => ({ t: 'artToken', n: 2, kind: 'clue' })],
        [/^all other creatures get -1\/-1 until end of turn$/, () => ({ t: 'cmd', id: 'tkMinusOthers' })],
        [/^double your life total$/, () => ({ t: 'cmd', id: 'tkDoubleLife' })],
        [/^draw cards equal to the number of cards in your hand$/, () => ({ t: 'cmd', id: 'tkDrawHand' })],
        [/^you have no maximum hand size until your next turn$/, () => ({ t: 'noMaxHandForever' })],
        [/^mill four cards\. you may put a permanent card from among them into your hand$/, () => ({ t: 'millPick', n: 4, what: 'permanent' })],
        [/^if ~ is the first spell you've cast this game, you gain 2 life$/, () => ({ t: 'cmd', id: 'tkFirstContact' })],
        [/^draw a card if you control a permanent with a counter on it$/, () => ({ t: 'draw', n: 1, cond: 'you control a permanent with a counter on it' })],
        [/^destroy target creature\. its controller creates two 1\/1 red officer creature tokens$/, () => [{ t: 'destroy', target: 'creature' }, { t: 'token', n: 2, p: 1, q: 1, name: 'red Officer', kw: [], forLastCtrl: true }]],
        [/^target opponent draws a card$/, () => ({ t: 'oppDraws', n: 1 })],
        [/^sensors — draw two cards$/, () => ({ t: 'draw', n: 2 })],
        [/^transport — create two 1\/1 red officer creature tokens$/, () => OFFICER(2)],
        [/^abandon ship — you lose the game$/, () => ({ t: 'loseSelf' })],
        [/^counter target activated or triggered ability$/, () => ({ t: 'counter', target: 'spell', filter: 'ability' })],
        [/^~ deals 3 damage to target attacking creature$/, () => ({ t: 'dmg', n: 3, target: 'creature', only: 'attacking creature', theirs: true })],
        [/^surveil 2$/, () => ({ t: 'surveil', n: 2 })],
        [/^target creature gets \+1\/\+0 until end of turn and can't be blocked this turn$/, () => ({ t: 'pump', p: 1, q: 0, kw: ['unblockable'], target: 'creature', good: true })],
        [/^each player draws a card$/, () => ({ t: 'drawAll', n: 1 })]
    ],
    triggers: [],
    lines: []
});
