// Spellslinger Duels - rules pack: explore (2026-10-30, owner: "Explore mechanic isn't working").
// Every wording of the keyword action now makes one `explore` effect (engine: 15b-precon-effects.js, case 'explore'),
// and "Whenever a creature you control explores" triggers on the `explores` event.
const EXP_N = { once: 1, twice: 2, two: 2, three: 3 };
registerRules({
    name: 'explore',
    effects: [
        [/^(?:~|it|this creature|that creature|he|she) explores(?:, then (?:it |he |she )?explores again)?$/i, (m) => ({ t: 'explore', n: /again/.test(m[0]) ? 2 : 1 })],
        [/^(?:~|it|this creature|that creature) explores (two|three|\d+) times$/i, (m) => ({ t: 'explore', n: EXP_N[m[1].toLowerCase()] || +m[1] })],
        [/^explore$/i, () => ({ t: 'explore', n: 1 })],
        [/^explore, then explore again$/i, () => ({ t: 'explore', n: 2 })],
        [/^target creature you control explores$/i, () => ({ t: 'explore', n: 1, target: 'creature', mine: true, good: true })]
    ],
    triggers: [
        [/^Whenever a creature you control explores, (.+)$/, () => ({ ev: 'explores', fn: 'exploreMine' })],
        [/^Whenever ~ explores, (.+)$/, () => ({ ev: 'explores', fn: 'exploreSelfOnly' })]
    ]
});
