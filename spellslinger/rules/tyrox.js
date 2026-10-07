// Spellslinger Duels - rules pack: Tyrox deck (2026-10-08).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'tyrox',
    effects: [
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
    ],
    lines: [
    (ctx) => {
        // Tyrox deck (2026-10-08)
        const { R } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if (/^Other Goblin creatures you control attack each combat if able\.$/.test(line)) { R.forceGoblins = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Spectacle ((?:\{[^}]+\})+)$/)) && !parseCost(m[1]).odd) { R.alt = { mana: parseCost(m[1]), life: 0, exile: null, cond: 'an opponent lost life this turn', text: `pay ${m[1]} (spectacle: an opponent lost life this turn)` }; { ctx.li = li; return true; } }
        if ((m = line.match(/^(?:If ~ hasn't been exerted this turn, )?[Yy]ou may exert (?:~|it) as it attacks\. When you do, (.+)$/))) {
            const body = m[1].replace(/^it deals/, '~ deals').replace(/ and after this phase, there is an additional combat phase\.?$/, ' and §celebrant.').replace(/^untap all other creatures you control and §celebrant\.$/, '§celebrant.');
            const fx = parseEffects(body);
            if (fx) { R.exert = true; R.trig.push({ ev: 'exerted', effects: fx }); { ctx.li = li; return true; } }
        }
        return false;
    }
    ],
});
