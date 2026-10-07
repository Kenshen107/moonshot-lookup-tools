// Spellslinger Duels - rules pack: Brudiclad deck (2026-10-07).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'brudiclad',
    effects: [
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
    ],
    lines: [
    (ctx) => {
        // Brudiclad deck (2026-10-07)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^If you would create a Clue, Food, or Treasure token, instead create one of each\.$/.test(line)) { R.manufactor = true; { ctx.li = li; return true; } } // Academy Manufactor
        if (/^Treasures you control have "\{T\}, Sacrifice ~: Add two mana of any one color\."$/.test(line)) { R.bigTreasure = true; { ctx.li = li; return true; } } // Goldspan Dragon
        if (/^~ can be your commander\.$/.test(line)) { ctx.li = li; return true; }
        if (/^Jump-start$/.test(line)) { R.gyCast = { life: 0, discard: 1, exile: true }; { ctx.li = li; return true; } } // 702.133
        if ((m = line.match(/^Whenever ~ attacks or becomes the target of a spell, (.+)$/)) && parseEffects(m[1])) { const fx = parseEffects(m[1]); R.trig.push({ ev: 'attacks', effects: fx }, { ev: 'targeted', effects: fx }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Whenever a nontoken creature dies, you may exile that card\. If you do, return each other card exiled with ~ to its owner's graveyard\.$/))) { R.trig.push({ ev: 'creatureDies', any: true, nontoken: true, effects: [{ t: 'vatImprint' }] }); { ctx.li = li; return true; } } // Mimic Vat
        if (/^\{3\}, \{T\}: Create a token that's a copy of a card exiled with ~\. It gains haste\. Exile it at the beginning of the next end step\.$/.test(line)) { R.acts.push({ cost: { mana: parseCost('{3}'), tap: true, sacSelf: false, life: 0, discard: 0 }, effects: [{ t: 'vatCopy' }], text: line }); { ctx.li = li; return true; } }
        if (/^\{X\}, \{T\}: Create a token that's a copy of the exiled card\. X is the mana value of that card\.$/.test(line)) { R.acts.push({ cost: { mana: parseCost(''), tap: true, sacSelf: false, life: 0, discard: 0, xImprint: true }, effects: [{ t: 'imprintCopy' }], text: line }); { ctx.li = li; return true; } } // Prototype Portal
        if (/^Whenever an opponent taps an artifact for mana, gain control of that artifact until the end of your next turn\.$/.test(line)) { R.trig.push({ ev: 'artifactMana', effects: [{ t: 'nabArtifact' }] }); { ctx.li = li; return true; } }
        return false;
    }
    ],
});
