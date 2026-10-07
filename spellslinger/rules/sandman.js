// Spellslinger Duels - rules pack: Sandman deck (2026-10-07).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'sandman',
    effects: [
        [/^(?:you )?draw cards equal to the sacrificed creature's power$/i, () => ({ t: 'draw', n: 0, nFrom: 'sacPow' })],
        [/^(?:you )?draw cards equal to the sacrificed creature's power, then you gain life equal to its toughness$/i, () => [{ t: 'draw', n: 0, nFrom: 'sacPow' }, { t: 'gain', n: 0, nFrom: 'sacTou' }]],
        [/^draw cards equal to the power of target creature you control$/i, () => ({ t: 'drawPowTarget', target: 'creature', mine: true, good: true })],
        [/^§fetchpow$/, () => ({ t: 'fetchLand', n: 0, nFrom: 'greatestPower', what: 'basic land', bf: true, tapped: true })],
        [/^§spry$/, () => ({ t: 'spry' })],
        [/^§genesis (\d+)$/, m => ({ t: 'genesis', n: +m[1] })],
        [/^§druidpurify$/, () => ({ t: 'druidPurify' })],
    ],
    lines: [
    (ctx) => {
        // Sandman deck (2026-10-07)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^Lands you control enter untapped\.$/.test(line)) { R.landsUntapped = true; { ctx.li = li; return true; } } // Horizon Explorer, Spelunking
        if (/^Whenever you tap a land for mana, add \{([WUBRG])\}\.$/.test(line)) { R.extraMana = { all: true, color: line.match(/\{([WUBRG])\}/)[1] }; { ctx.li = li; return true; } } // Groundchuck & Dirtbag
        if ((m = line.match(/^Lands you control are (Plains|Islands|Swamps|Mountains|Forests) in addition to their other types\.$/))) { R.landTypeMine = m[1] === 'Plains' ? 'Plains' : m[1].slice(0, -1); { ctx.li = li; return true; } } // Swampbenders
        if ((m = line.match(/^Protection from ([a-z]+s) and from ([A-Z][a-z]+?)s$/)) && m[1] === 'planeswalkers') { R.proTypes = ['Planeswalker', m[2]]; { ctx.li = li; return true; } } // Greensleeves
        if (/^~ gets \+10\/\+10 for each player who has lost the game\.$/.test(line)) { ctx.li = li; return true; } // two-player games end when a player loses, so this never applies
        if (/^~ gets \+1\/\+1 for each land you control and each land card in your graveyard\.$/.test(line)) { R.cdaAdd = { p: 1, q: 1, what: 'the number of lands you control plus the number of land cards in your graveyard' }; { ctx.li = li; return true; } } // Multani
        if ((m = line.match(/^~ enters with a \+1\/\+1 counter on it for each (.+)\.$/)) && countFn(`the number of ${m[1]}`)) { R.etbCountersPer = `the number of ${m[1]}`; { ctx.li = li; return true; } } // Michelangelo
        if ((m = line.match(/^Encore ((?:\{[^}]+\})+)$/))) { (R.gyActs = R.gyActs || []).push({ cost: { mana: parseCost(m[1]), tap: false, exileSelfGy: true }, effects: [{ t: 'encore' }], text: `Encore ${m[1]}`, sorcery: true, gy: true }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Foretell ((?:\{[^}]+\})+)$/))) { R.foretell = parseCost(m[1]); { ctx.li = li; return true; } }
        return false;
    }
    ],
});
