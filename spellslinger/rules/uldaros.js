// Spellslinger Duels - rules pack: the Uldaros Theorix deck (2026-10-15, owner's request: "make all these cards playable").
// A mill and clone deck (Dimir). Engine cases: 15c-uldaros-effects.js (uldEffect, doMill, manifest, Impending hooks in 06-engine.js).
const ULD_NUM = { eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, twenty: 20 };
const uNum = w => (/^\d+$/.test(w) ? Number(w) : ULD_NUM[String(w).toLowerCase()] ?? (typeof num === 'function' ? num(w) : undefined));
registerRules({
    name: 'uldaros',
    effects: [
        // Creatures that hit a player and spells that mill
        [/^defending player mills (\w+) cards?$/i, m => ({ t: 'mill', n: uNum(m[1]) })],
        [/^defending player mills half their library, rounded up$/i, () => ({ t: 'millHalf' })],
        [/^each opponent mills (\d+|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|twenty) cards?$/i, m => ({ t: 'millFoes', n: uNum(m[1]) })],
        [/^each opponent reveals cards from the top of their library until they reveal a land card, then puts those cards into their graveyard$/i, () => ({ t: 'millUntilLands', n: 1 })],
        [/^counter target spell unless its controller discards their hand$/i, () => ({ t: 'counter', target: 'spell', filter: 'any', unlessDiscard: true })],
        [/^each other player discards a card, then you draw a card for each card discarded this way$/i, () => ({ t: 'syphon' })]
    ],
    triggers: [],
    lines: [
        (ctx) => {
            const { R, line } = ctx;
            let m;
            const done = () => true;
            // ---- Mill ----
            if (/^Each opponent mills (\w+) cards\.$/.test(line) && uNum(line.match(/^Each opponent mills (\w+) cards\.$/)[1])) { R.spell = (R.spell || []).concat([{ t: 'millFoes', n: uNum(line.match(/^Each opponent mills (\w+) cards\.$/)[1]) }]); R._spellText = `${R._spellText || ''} ${line}`; return done(); }
            if (/^When you cycle ~, each opponent mills four cards\.$/.test(line)) { R.cycleTrig = [{ t: 'millFoes', n: 4 }]; return done(); }
            if (/^Each opponent mills eight cards\. If ~ was kicked, instead each opponent mills half their library, rounded up\.$/.test(line)) { R.spell = [{ t: 'millFoes', n: 8, kickedHalf: true }]; return done(); }
            if (/^Target opponent reveals cards from the top of their library until four land cards are revealed\. That player puts all cards revealed this way into their graveyard\.$/.test(line)) { R.spell = [{ t: 'revealLandsOne', n: 4 }]; return done(); }
            if (/^Each opponent reveals cards from the top of their library until they reveal X land cards, then puts all cards revealed this way into their graveyard\. X can't be 0\.$/.test(line)) { R.spell = [{ t: 'millUntilLands', n: 'X' }]; return done(); }
            if ((m = line.match(/^Each opponent reveals cards from the top of their library until they reveal 97 land cards, then puts all cards revealed this way into their graveyard\. 97 can't be 0\.$/))) { R.spell = [{ t: 'millUntilLands', n: 'X' }]; return done(); }
            if (/^Destroy all creatures, then any number of target players each mill half their library, rounded down\.$/.test(line)) { R.spell = [{ t: 'wipe', how: 'destroy', what: 'creatures' }, { t: 'millHalfChosen', down: true }]; return done(); }
            if (/^Each opponent exiles cards from the top of their library until they have exiled cards with total mana value 5 or greater this way\. Until end of turn, you may cast cards exiled this way without paying their mana costs\.$/.test(line)) { R.spell = [{ t: 'exileUntilMv', mv: 5, cast: true }]; return done(); }
            if (/^Each opponent exiles cards from the top of their library until that player has exiled cards with total mana value 20 or greater\.$/.test(line)) { R.spell = [{ t: 'exileUntilMv', mv: 20 }]; return done(); }
            if (/^Each creature gets twice -(?:X|97)\/-(?:X|97) until end of turn\. Each player gets (?:X|97) rad counters\.$/.test(line)) { R.spell = [{ t: 'fallout', n: 'X' }]; return done(); }
            if (/^Each other player discards a card\. You draw a card for each card discarded this way\.$/.test(line)) { R.spell = [{ t: 'syphon' }]; return done(); }
            if (/^Exile target creature\. Its controller manifests the top card of their library\.$/.test(line)) { R.spell = [{ t: 'exile', target: 'perm', filter: 'creature' }, { t: 'manifestCtrl' }]; return done(); }
            if (/^Each player mills two cards\. Then you put a creature card from a graveyard onto the battlefield under your control\.$/.test(line)) { R.spell = [{ t: 'extractDark' }]; return done(); }
            if (/^Each player mills ten cards\. For each player, choose a creature or planeswalker card in that player's graveyard\. Put those cards onto the battlefield under your control\. Then each creature you control becomes a Phyrexian in addition to its other types\.$/.test(line)) { R.spell = [{ t: 'breach' }]; return done(); }
            // ---- Permanents that mill ----
            if (/^At the beginning of your first main phase, mill three cards\. Then you may pay \{1\} and 3 life\. If you do, put a card from among those cards into your hand\.$/.test(line)) { R.trig.push({ ev: 'main1', effects: [{ t: 'ripples' }] }); return done(); }
            if (/^If an opponent would mill one or more cards, they mill that many cards plus four instead\.$/.test(line)) { R.millPlus = 4; return done(); }
            if (/^If a source you control would deal damage to an opponent, prevent that damage and each opponent mills that many cards\.$/.test(line)) { R.mindskin = true; return done(); }
            if (/^\{4\}\{U\}\{U\}, \{T\}: Each opponent mills cards equal to the number of cards in your hand\.$/.test(line)) { const act = parseActivated('{4}{U}{U}, {T}: You gain 1 life.', R); R.acts.push({ ...act, effects: [{ t: 'millFoes', n: 0, nCount: 'cards in your hand' }], text: line }); return done(); }
            if (/^Enchant player$/.test(line) && ctx.card && ctx.card.name === 'Fraying Sanity') { R.enchantPlayer = true; R.isAura = false; R.etb.push({ t: 'enchantPlayer' }); return done(); }
            if (/^At the beginning of each end step, enchanted player mills X cards, where X is the number of cards put into their graveyard from anywhere this turn\.$/.test(line)) { R.trig.push({ ev: 'end', who: 'each', effects: [{ t: 'frayTick' }] }); return done(); }
            if (/^Whenever equipped creature attacks, defending player reveals cards from the top of their library until they reveal a land card\. The creature gets \+1\/\+0 until end of turn for each card revealed this way\. That player puts the revealed cards into their graveyard\.$/.test(line)) { R.trig.push({ ev: 'attacks', fn: 'hostAttack', effects: [{ t: 'bladeReveal' }] }); return done(); }
            if (/^When ~ enters, if it was cast, each player exiles all but the bottom six cards of their library face down\.$/.test(line)) { R.etb.push({ t: 'doomsday', cond: '~ was cast' }); return done(); }
            if (/^When ~ enters, if you cast him, exile up to one target nonland card of each card type from your graveyard\. Copy those cards\. You may cast any number of spells with total mana value 6 or less from among the copies without paying their mana costs\.$/.test(line)) { R.etb.push({ t: 'uldaros', cond: '~ was cast' }); return done(); }
            // Thief of Sanity
            if (/^Whenever ~ deals combat damage to a player, look at the top three cards of that player's library, exile one of them face down, then put the rest into their graveyard\. You may cast that card for as long as it remains exiled, and mana of any type can be spent to cast that spell\.$/.test(line)) { R.trig.push({ ev: 'hitPlayer', effects: [{ t: 'thief' }] }); return done(); }
            // Overlord of the Balemurk (Impending)
            if ((m = line.match(/^Impending (\d+)—((?:\{[^}]+\})+)$/))) { R.impending = { n: Number(m[1]), cost: parseCost(m[2]) }; return done(); }
            if (/^Whenever ~ enters or attacks, mill four cards, then you may return a non-Avatar creature card or a planeswalker card from your graveyard to your hand\.$/.test(line)) { const fx = [{ t: 'millSelf', n: 4 }, { t: 'overlordReturn' }]; R.etb.push(...fx); R.trig.push({ ev: 'attacks', effects: fx }); return done(); }
            // ---- Consuming Aberration's cast trigger ("each opponent reveals cards ... until a land") is an effect sentence above ----
            // ---- Clones that enter as a copy "except ..." (707.9) ----
            if (/^You may have ~ enter as a copy of any nonland permanent on the battlefield\.$/.test(line)) { R.clone = { what: 'nonland permanent' }; return done(); }
            if (/^You may have ~ enter as a copy of any creature on the battlefield, except it has "Whenever ~ attacks, it connives\."/.test(line)) { R.clone = { what: 'creature', addText: n => `Whenever ${n} attacks, it connives.` }; return done(); }
            if (/^You may have ~ enter as a copy of a creature you control with power 4 or greater, except it's a Dragon in addition to its other types and it has flying\.$/.test(line)) { R.clone = { what: 'creature you control with power 4 or greater', addSub: 'Dragon', addText: () => 'Flying' }; return done(); }
            if (/^You may have ~ enter as a copy of any creature on the battlefield, except it has vanishing 3 if that creature doesn't have vanishing\.$/.test(line)) { R.clone = { what: 'creature', vanishing: true }; return done(); }
            if (/^You may have ~ enter as a copy of a creature you control, except it's a Shapeshifter Rogue in addition to its other types\.$/.test(line)) { R.clone = { what: 'creature you control', addSub: 'Shapeshifter Rogue' }; return done(); }
            if (/^You may have ~ enter as a copy of any creature on the battlefield, except it's an Illusion in addition to its other types and it has "When ~ becomes the target of a spell or ability, sacrifice it\."$/.test(line)) { R.clone = { what: 'creature', addSub: 'Illusion', addText: n => `When ${n} becomes the target of a spell or ability, sacrifice it.` }; return done(); }
            // ---- Golbez, Crystal Collector / Joo Dee, One of Many ----
            if (/^Whenever an artifact you control enters, surveil 1\.$/.test(line)) { R.trig.push({ ev: 'enters', artEnter: true, effects: [{ t: 'surveil', n: 1 }] }); return done(); }
            if (/^At the beginning of your end step, if you control four or more artifacts, return target creature card from your graveyard to your hand\. Then if you control eight or more artifacts, each opponent loses life equal to that card's power\.$/.test(line)) { R.trig.push({ ev: 'end', who: 'your', effects: [{ t: 'golbez' }] }); return done(); }
            if (/^\{B\}, \{T\}: Surveil 1\. Create a token that's a copy of ~, then sacrifice an artifact or creature\. Activate only as a sorcery\.$/.test(line)) { const act = parseActivated('{B}, {T}: You gain 1 life.', R); R.acts.push({ ...act, effects: [{ t: 'jooDee' }], text: line, sorcery: true }); return done(); }
            return false;
        }
    ]
});
