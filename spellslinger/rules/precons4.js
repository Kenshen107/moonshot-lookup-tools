// Spellslinger Duels - rules pack: precon round 4 (2026-10-09). Multikicker, Dash, Madness, sacrifice-a-land kicker.
// Engine: 06-engine.js (castAs 'dash' / 'madness', maxKick), 15b-precon-effects.js (madnessCast), 15-rules-conditions.js (discardWatch).
registerRules({
    name: 'precons4',
    effects: [
        [/^create a (\d+)\/(\d+) ([a-z ]+?) creature token for each time (?:it|~) was kicked$/i, m => ({ t: 'token', n: 0, nCount: 'the number of times it was kicked', p: +m[1], q: +m[2], name: m[3], kw: [] })],
        [/^(?:it|~) deals damage to target player or planeswalker equal to twice the number of times (?:it|~) was kicked$/i, () => ({ t: 'dmg', n: 0, nCount: 'twice the number of times it was kicked', target: 'player', oppOnly: true })],
        [/^target opponent discards a card for each time (?:it|~) was kicked$/i, () => ({ t: 'discard', n: 0, nCount: 'the number of times it was kicked' })],
        [/^you gain 2 life for each time (?:it|~) was kicked$/i, () => ({ t: 'gain', n: 0, nCount: 'twice the number of times it was kicked' })]
    ],
    triggers: [],
    lines: [
        (ctx) => {
            const { R } = ctx; const line = ctx.line; let m;
            if ((m = line.match(/^Multikicker ((?:\{[^}]+\})+)$/))) { R.multikicker = parseCost(m[1]); return true; }
            if ((m = line.match(/^~ enters with an? (\+1\/\+1|charge) counters? on it for each time it was kicked\.$/))) { R.kickPer = m[1] === 'charge' ? 'charge' : 'plus'; return true; }
            if ((m = line.match(/^Dash ((?:\{[^}]+\})+)$/))) { R.dash = parseCost(m[1]); return true; }
            if (/^Dash costs you pay cost \{2\} less ?\.?$/.test(line)) { R.dashLess = true; return true; }
            if ((m = line.match(/^Madness ((?:\{[^}]+\})+)$/))) { R.madness = parseCost(m[1]); return true; }
            if ((m = line.match(/^Kicker—Sacrifice (a|two) lands?\.$/))) { R.kicker = parseCost(''); R.kickSac = { kind: 'land', n: m[1] === 'a' ? 1 : 2 }; return true; }
            return false;
        }
    ]
});
