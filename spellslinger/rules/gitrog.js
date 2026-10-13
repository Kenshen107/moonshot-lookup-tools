// Spellslinger Duels - rules pack: Gitrog deck (2026-10-08).
// Wordings this round added to the card reader. Registered with registerRules() (01-core.js); the card reader joins all packs in RULE_PACK_ORDER.
registerRules({
    name: 'gitrog',
    effects: [
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
    ],
    lines: [
    (ctx) => {
        // Gitrog deck (2026-10-08)
        const { R, t } = ctx;
        const line = ctx.line; let li = ctx.li; let m;
        if ((m = line.match(/^Warp ((?:\{[^}]+\})+)$/))) { R.warp = parseCost(m[1]); { ctx.li = li; return true; } }
        if ((m = line.match(/^Bestow ((?:\{[^}]+\})+)$/))) { R.bestow = parseCost(m[1]); { ctx.li = li; return true; } }
        if ((m = line.match(/^Blitz—((?:\{[^}]+\})+)(?:, Pay (\d+) life)?\.?$/))) { R.blitz = { cost: parseCost(m[1]), life: +(m[2] || 0) }; { ctx.li = li; return true; } }
        if (/^You may cast ~ from your graveyard using its blitz ability\.$/.test(line)) { R.blitzGy = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Saddle (\d+)$/))) { R.saddle = +m[1]; { ctx.li = li; return true; } }
        if ((m = line.match(/^You may pay (\w+) \{E\} rather than pay the mana cost for permanent spells you cast\.$/)) && num(m[1])) { R.energyAlt = num(m[1]); { ctx.li = li; return true; } }
        if (/^You may cast spells from the top of your library by sacrificing a nonland permanent in addition to paying their other costs\.$/.test(line)) { R.castTopSac = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^Each creature you control with power (\d+) or greater can't be blocked by more than one creature\.$/))) { R.bigOneBlock = +m[1]; { ctx.li = li; return true; } }
        if (/^If at least three green mana was spent to cast ~, instead return those cards to your hand and exile ~\.$/.test(line)) { ctx.li = li; return true; } // Once and Future's adamant: in its effect
        if (/^As long as ~ is on the battlefield, it's a land in addition to its other types\.$/.test(line)) { R.alsoLand = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^~'s power is equal to (.+) and its toughness is equal to that number plus (\d+)\.$/)) && countFn(m[1])) { R.cdaSet = { p: m[1], q: m[1], qPlus: +m[2] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^Entwine ((?:\{[^}]+\})+)$/))) { R.kicker = parseCost(m[1]); R.entwine = true; { ctx.li = li; return true; } }
        if (/^Demonstrate$/.test(line)) { R.demonstrate = true; { ctx.li = li; return true; } }
        // Mobilize N (702.181): attacking 1/1 red Warriors, sacrificed at the next end step
        if ((m = line.match(/^Mobilize (\d+)$/))) { R.trig.push({ ev: 'attacks', effects: [{ t: 'token', n: +m[1], p: 1, q: 1, name: 'red warrior', kw: [], attacking: true, sacEnd: true }] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Crew (\d+)$/))) { R.crew = Number(m[1]); { ctx.li = li; return true; } }
        if ((m = line.match(/^Toxic (\d+)$/))) { R.toxic = Number(m[1]); { ctx.li = li; return true; } }
        if (/^Affinity for artifacts$/.test(line)) { R.affinity = 'artifacts'; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ costs \{(\d+)\} less to cast for each (.+)\.$/)) && countFn(`the number of ${m[2]}`)) { R.costLess = { n: Number(m[1]), what: `the number of ${m[2]}` }; { ctx.li = li; return true; } }
        if (/^(?:You may look at the top card of your library any time|You may look at the top card of your library any time, and you may .+)\.$/.test(line) && /any time\.$/.test(line)) { R.peekTop = true; { ctx.li = li; return true; } }
        if (/^As ~ enters(?: the battlefield)?, choose a creature type\.$/.test(line)) { R.chooseType = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^(Other )?[Cc]reatures you control of the chosen type get \+(\d+)\/\+(\d+)(?: and have ([a-z ,]+))?\.$/))) { R.statics.push({ other: !!m[1], type: '*chosen', p: +m[2], q: +m[3], kw: m[4] ? splitKw(m[4]) : [] }); { ctx.li = li; return true; } }
        if ((m = line.match(/^Kicker ((?:\{[^}]+\})+)$/))) { const k = parseCost(m[1]); if (!k.x && !k.odd) { R.kicker = k; { ctx.li = li; return true; } } }
        if ((m = line.match(/^As an additional cost to cast ~, (sacrifice an artifact or creature|sacrifice a creature|return a land you control to its owner's hand)(?: or pay ((?:\{[^}]+\})+))?\.$/)) && (m[2] || !/^sacrifice a creature$/.test(m[1]))) {
            R.addCost = /land/.test(m[1]) ? { returnLand: true } : { sac: /artifact or creature/.test(m[1]) ? 'artifact or creature' : 'creature', orPay: m[2] ? parseCost(m[2]) : null };
            { ctx.li = li; return true; }
        }
        if (/^As an additional cost to cast ~, sacrifice a land\.$/.test(line)) { R.addCost = { sac: 'land' }; { ctx.li = li; return true; } }
        if (/^As an additional cost to cast ~, sacrifice an artifact or discard a card\.$/.test(line)) { R.addCost = { sac: 'artifact', orDiscard: true }; { ctx.li = li; return true; } }
        if ((m = line.match(/^As an additional cost to cast ~, (sacrifice a creature|sacrifice an artifact|discard a card|pay (\d+) life)\.$/))) {
            R.addCost = m[1].startsWith('sacrifice') ? { sac: m[1].endsWith('creature') ? 'creature' : 'artifact' } : m[1].startsWith('discard') ? { discard: 1 } : { life: Number(m[2]) };
            { ctx.li = li; return true; }
        }
        if (/^~ enters(?: the battlefield)? with X \+1\/\+1 counters on it\.$/.test(line)) { R.etbCounters = 'X'; { ctx.li = li; return true; } }
        if ((m = line.match(/^When you cast ~, (.+)$/)) && parseEffects(m[1])) { R.castTrig = parseEffects(m[1]); { ctx.li = li; return true; } }
        if (/^Ravenous$/.test(line)) { R.etbCounters = 'X'; R.ravenous = true; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ enters(?: the battlefield)? with X (charge|oil|fire|time|quest) counters on it\.$/))) { R.etbNamedX = m[1]; { ctx.li = li; return true; } }
        if (/^~ enters with a number of \+1\/\+1 counters on it equal to the amount of mana spent to cast it\.$/.test(line)) { R.etbCounters = 'spent'; { ctx.li = li; return true; } }
        if (/^Improvise$/.test(line)) { R.kw.add('improvise'); { ctx.li = li; return true; } }
        if (/^Nonartifact spells you cast have improvise\.$/.test(line)) { R.improviseAll = true; { ctx.li = li; return true; } }
        // Power and toughness that count something (*/* and "+1/+1 for each")
        if ((m = line.match(/^~'s power and toughness are each equal to (.+)\.$/)) && countFn(m[1])) { R.cdaSet = { p: m[1], q: m[1] }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~'s power is equal to (.+)\.$/)) && countFn(m[1])) { R.cdaSet = { p: m[1], q: null }; { ctx.li = li; return true; } }
        if ((m = line.match(/^~ gets \+(\d+)\/\+(\d+) for each (.+)\.$/)) && countFn(`the number of ${m[3]}`)) { R.cdaAdd = { p: +m[1], q: +m[2], what: `the number of ${m[3]}` }; { ctx.li = li; return true; } }
        // Saga chapters: "I, II — effect"
        if (/\bSaga\b/.test(t) && (m = line.match(/^((?:I|II|III|IV|V|VI)(?:, (?:I|II|III|IV|V|VI))*) — (.+)$/))) {
            const fx = parseEffects(m[2]);
            if (fx) { R.saga = R.saga || {}; m[1].split(', ').forEach(r => { R.saga[ROMAN[r]] = fx; }); { ctx.li = li; return true; } }
        }
        if (/^~ attacks each combat if able\.$/.test(line)) { R.mustAttack = true; { ctx.li = li; return true; } }
        return false;
    }
    ],
});
