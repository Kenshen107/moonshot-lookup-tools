// Spellslinger Duels - rules pack: sweep round 1 (2026-10-13). Chosen from tests/sweep.js (which unread sentence shapes keep the
// most cards from being Automated): lords by color, blocking limits, Renown, Modular, Mentor, Training, Dethrone, Afterlife, Afflict,
// Rampage, Ingest, explore, delayed draws, upkeep costs. Engine cases: 15b-precon-effects.js.
const SW_COLORS = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
registerRules({
    name: 'precons5',
    effects: [
        [/^draw (a|one|two|three) cards? at the beginning of the next turn's upkeep$/i, m => ({ t: 'delayedDraw', n: num(m[1]) })],
        [/^create a token that's a copy of ~, except it's a white Zombie in addition to its other types and it has no mana cost$/i, () => ({ t: 'embalmCopy' })],
        [/^search your library for a card with the same mana value as ~, reveal it, put it into your hand, then shuffle$/i, () => ({ t: 'transmute' })],
        [/^search your library for an? ([A-Z][a-z]+) permanent card with mana value (\d+) or less, put it onto the battlefield, then shuffle$/i, m => ({ t: 'tutor', what: `${m[1]} permanent mv${m[2]}`, bf: true })],
        [/^(?:~|it) explores$/i, () => ({ t: 'exploreSelf' })],
        [/^return a (white|blue|black|red|green) or (white|blue|black|red|green) creature you control to its owner's hand$/i, m => ({ t: 'returnOwn', colors: [SW_COLORS[m[1].toLowerCase()], SW_COLORS[m[2].toLowerCase()]] })]
    ],
    triggers: [
        [/^Whenever ~ or another Ally you control enters, (.+)$/, () => ({ ev: 'enters', fn: 'allyEnters' })],
        [/^Whenever you cast a spell that targets ~, (.+)$/, () => ({ ev: 'cast', fn: 'targetsMe', who: 'any', filter: 'any' })],
        [/^When(?:ever)? ~ is turned face up, (.+)$/, () => ({ ev: 'turnedUp', fn: 'selfTurned' })]
    ],
    lines: [
        (ctx) => {
            const { R } = ctx; const line = ctx.line; let m;
            // lords by color, and "all Slivers"
            if ((m = line.match(/^Other (white|blue|black|red|green) creatures you control get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ other: true, fn: 'c_' + SW_COLORS[m[1]], p: +m[2], q: +m[3], kw: [] }); return true; }
            if ((m = line.match(/^All ([A-Z][a-z]+) creatures get \+(\d+)\/\+(\d+)\.$/))) { R.statics.push({ global: true, type: m[1], p: +m[2], q: +m[3], kw: [] }); return true; }
            // limits on who can block
            if ((m = line.match(/^~ can't be blocked by (white|blue|black|red|green) creatures\.$/))) { (R.blockFns = R.blockFns || []).push('not_' + SW_COLORS[m[1]]); return true; }
            if ((m = line.match(/^~ can't be blocked by creatures with power (\d+) or greater\.$/))) { (R.blockFns = R.blockFns || []).push('powLt' + m[1]); return true; }
            if (/^Creatures with power less than ~'s power can't block it\.$/.test(line)) { (R.blockFns = R.blockFns || []).push('powGeAtk'); return true; }
            if (/^~ must be blocked if able\.$/.test(line)) { R.kw.add('mustbeblocked'); return true; }
            if (/^Whenever ~ deals damage, you gain that much life\.$/.test(line)) { R.kw.add('lifelink'); return true; }
            // keyword abilities written out
            if ((m = line.match(/^Renown (\d+)$/))) { R.trig.push({ ev: 'hitPlayer', fn: 'renown', effects: [{ t: 'renown', n: +m[1] }] }); return true; }
            if ((m = line.match(/^Modular (\d+)$/))) { R.etbCounters = +m[1]; R.trig.push({ ev: 'dies', fn: 'modular', effects: [{ t: 'modular' }] }); return true; }
            if (/^Mentor$/.test(line)) { R.trig.push({ ev: 'attacks', effects: [{ t: 'mentor' }] }); return true; }
            if (/^Training$/.test(line)) { R.trig.push({ ev: 'attacks', fn: 'training', effects: [{ t: 'counters', n: 1, target: 'self' }] }); return true; }
            if (/^Dethrone$/.test(line)) { R.trig.push({ ev: 'attacks', fn: 'dethrone', effects: [{ t: 'counters', n: 1, target: 'self' }] }); return true; }
            if ((m = line.match(/^Afterlife (\d+)$/))) { R.trig.push({ ev: 'dies', fn: 'selfDies', effects: [{ t: 'token', n: +m[1], p: 1, q: 1, name: 'Spirit', kw: ['flying'] }] }); return true; }
            if ((m = line.match(/^Afflict (\d+)$/))) { R.trig.push({ ev: 'blocked', effects: [{ t: 'drain', n: +m[1] }] }); return true; }
            if ((m = line.match(/^Rampage (\d+)$/))) { R.trig.push({ ev: 'blocked', effects: [{ t: 'rampage', n: +m[1] }] }); return true; }
            if (/^Ingest$/.test(line)) { R.trig.push({ ev: 'hitPlayer', fn: 'selfHit', effects: [{ t: 'oppExileTop', n: 1 }] }); return true; }
            // costs and drawbacks
            if ((m = line.match(/^At the beginning of your upkeep, sacrifice ~ unless you pay ((?:\{[^}]+\})+)\.$/))) { R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'upkeepPay', cost: parseCost(m[1]) }] }); return true; }
            if ((m = line.match(/^When you control no (Islands|Swamps|Forests|Mountains|Plains), sacrifice ~\.$/))) { R.sacNoLand = m[1].slice(0, -1); return true; }
            if ((m = line.match(/^(Mega)?morph ((?:\{[^}]+\})+)$/i))) { R.morph = parseCost(m[2]); if (m[1]) R.megamorph = true; return true; }
            if ((m = line.match(/^Ninjutsu ((?:\{[^}]+\})+)$/))) { R.ninjutsu = parseCost(m[1]); return true; }
            if ((m = line.match(/^Disguise ((?:\{[^}]+\})+)$/))) { R.morph = parseCost(m[1]); R.disguise = true; return true; }
            if ((m = line.match(/^Devour (\d+)$/))) { R.devour = +m[1]; return true; }
            if ((m = line.match(/^Casualty (\d+)$/))) { R.casualty = +m[1]; return true; }
            if (/^Enlist$/.test(line)) { R.trig.push({ ev: 'attacks', effects: [{ t: 'enlist' }] }); return true; }
            if ((m = line.match(/^Whenever ~ attacks, you may pay ((?:\{[^}]+\})+)\. If you do, put a \+1\/\+1 counter on it\.$/)) && !/\{E\}/.test(m[1])) { R.trig.push({ ev: 'attacks', effects: [{ t: 'payCounter', cost: parseCost(m[1]) }] }); return true; }
            if (/^Each creature you control with a \+1\/\+1 counter on it has trample\.$/.test(line)) { R.statics.push({ fn: 'hasPlus', p: 0, q: 0, kw: ['trample'] }); return true; }
            if (/^Umbra armor$/.test(line)) { R.umbra = true; return true; }
            if (/^If ~ is in your opening hand, you may begin the game with it on the battlefield\.$/.test(line)) { R.leyline = true; return true; }
            if ((m = line.match(/^Squad ((?:\{[^}]+\})+)$/))) { R.multikicker = parseCost(m[1]); R.trig.push({ ev: 'selfEnters', effects: [{ t: 'squadCopies' }] }); return true; }
            if ((m = line.match(/^Plot ((?:\{[^}]+\})+)$/))) { R.plot = parseCost(m[1]); return true; }
            if ((m = line.match(/^Disturb ((?:\{[^}]+\})+)$/))) { R.disturb = parseCost(m[1]); return true; }
            if (/^Retrace$/.test(line)) { R.retrace = true; return true; }
            if ((m = line.match(/^Suspend (\d+)—((?:\{[^}]+\})+)$/))) { R.suspend = { n: +m[1], cost: parseCost(m[2]) }; return true; }
            if (/^LOCKTAP$/.test(line)) { R.lockAfterTap = true; return true; }
            return false;
        }
    ]
});
