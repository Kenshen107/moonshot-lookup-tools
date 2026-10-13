// Spellslinger Duels - rules pack: Landfall (2026-10-06).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'landfall',
    effects: [
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
    ],
});
