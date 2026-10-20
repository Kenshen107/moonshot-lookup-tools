// =====================================================================
// Deck themes for the random Commander opponents (2026-10-20, owner: "pull cards from EDHREC that have been tagged for certain things in Scryfall ...
// up the amount of different themes ... group hug and kingmaking and anything that could happen in real life ... toxic and infect").
// A theme is a Scryfall query (tags like otag:group-hug, keywords like keyword:infect, card types) for the cards that make the theme work, and optionally
// a query for commanders that suit it. The random builder (04c-random-decks.js) asks Scryfall for those cards in EDHREC order, keeps the ones the game
// fully plays, puts a good share of them in the deck and fills the rest with the style's usual picks.
// `styles` lists the playstyles (07b-playstyles.js) a theme plays as; a pod seat that is given a style only gets themes that fit it.
// `tests/theme_audit.js` counts how many tagged cards are Automated per theme (run `python3 tests/theme_names.py` first).
// =====================================================================
const DECK_THEMES = [
    // ---- Politics and the table ----
    { key: 'group-hug', name: 'Group Hug', emoji: '🤗', desc: 'Gives everyone cards, mana and life, and hopes the table stays friendly.', q: 'otag:group-hug', styles: ['control', 'midrange', 'ramp', 'spellslinger'], take: 22, min: 8, weight: 1.6 },
    { key: 'politics', name: 'Politics & Kingmaking', emoji: '🗳️', desc: 'The monarch, goad, voting and donating permanents: the table decides who wins, and so does this deck.', q: '(o:vote or o:"the monarch" or keyword:goad or otag:voting or otag:donate)', cmd: '(o:"the monarch" or o:vote or keyword:goad or o:"target opponent gains control")', styles: ['control', 'midrange', 'voltron', 'tokens'], take: 20, min: 8, weight: 1.6 },
    { key: 'chaos', name: 'Chaos', emoji: '🎲', desc: 'Wheels, coin flips and random effects: nobody knows what happens next.', q: '(otag:wheel or otag:coin-flip or o:"at random")', cmd: '(o:"at random" or o:"flip a coin" or o:"each player discards")', styles: ['spellslinger', 'aggro', 'ramp'], take: 20, min: 8, weight: 1 },
    { key: 'pillowfort', name: 'Pillowfort', emoji: '🛡️', desc: 'Makes it too expensive or impossible to attack, then wins slowly.', q: 'otag:pillowfort', cmd: '(o:"can\'t attack you" or o:"unless their controller pays")', styles: ['control', 'tokens', 'voltron'], take: 16, min: 6, weight: 1 },
    { key: 'stax', name: 'Stax & Taxes', emoji: '⛓️', desc: 'Taxes spells and shuts off mana so nobody gets to play their game.', q: '(otag:tax or otag:rule-of-law or otag:mass-land-denial)', cmd: '(o:"spells cost" or o:"can\'t cast" or o:"each opponent")', styles: ['control', 'ramp'], take: 20, min: 8, weight: 1 },
    { key: 'extra', name: 'Extra Turns & Combats', emoji: '⏩', desc: 'Takes more turns and more combats than anyone else.', q: '(otag:extra-turn or otag:extra-combat)', cmd: '(o:"additional combat" or o:"extra turn")', styles: ['aggro', 'spellslinger', 'ramp'], take: 14, min: 5, weight: 0.8 },
    // ---- Poison ----
    { key: 'infect', name: 'Infect', emoji: '☠️', desc: 'Infect creatures and proliferate: ten poison counters win the game.', q: '(keyword:infect or keyword:proliferate or o:"poison counter")', cmd: '(keyword:infect or o:"poison counter")', styles: ['aggro', 'voltron', 'midrange'], take: 24, min: 8, weight: 1.6 },
    { key: 'toxic', name: 'Toxic', emoji: '🧪', desc: 'Toxic creatures and proliferate, poisoning the table a little at a time.', q: '(keyword:toxic or o:"poison counter" or keyword:proliferate)', cmd: '(keyword:toxic or o:"poison counter" or keyword:proliferate)', styles: ['aggro', 'tokens', 'midrange'], take: 24, min: 8, weight: 1.6 },
    { key: 'proliferate', name: 'Counters & Proliferate', emoji: '➕', desc: 'Puts counters on everything and keeps adding more.', q: '(keyword:proliferate or otag:counters-matter)', cmd: '(keyword:proliferate or o:"+1/+1 counter")', styles: ['midrange', 'tokens', 'ramp'], take: 24, min: 8, weight: 1 },
    // ---- Archetypes ----
    { key: 'tokens', name: 'Tokens', emoji: '🐜', desc: 'Makes a crowd of creature tokens and pumps them all.', q: '(o:"creature token" or o:"populate")', cmd: 'o:"token"', styles: ['tokens', 'midrange'], take: 24, min: 8, weight: 1 },
    { key: 'aristocrats', name: 'Aristocrats', emoji: '🩸', desc: 'Sacrifices its own creatures for value and drains the table when they die.', q: '(otag:sacrifice-outlet or otag:death-trigger)', cmd: 'o:"sacrifice"', styles: ['tokens', 'midrange', 'aggro'], take: 24, min: 8, weight: 1 },
    { key: 'lifegain', name: 'Lifegain', emoji: '💖', desc: 'Gains life and turns it into damage, cards and counters.', q: '(otag:lifegain or o:"whenever you gain life")', cmd: '(o:"gain life" or o:"gains life")', styles: ['midrange', 'tokens', 'control'], take: 22, min: 8, weight: 1 },
    { key: 'mill', name: 'Mill', emoji: '📚', desc: 'Mills the table until somebody runs out of library.', q: '(otag:mill -otag:self-mill)', cmd: 'o:"mill"', styles: ['control', 'spellslinger'], take: 18, min: 6, weight: 1 },
    { key: 'reanimator', name: 'Reanimator & Graveyard', emoji: '⚰️', desc: 'Fills its own graveyard and brings back the best things in it.', q: '(otag:reanimate or otag:self-mill)', cmd: '(o:"graveyard" o:"battlefield")', styles: ['control', 'midrange', 'ramp'], take: 22, min: 8, weight: 1 },
    { key: 'spellslinger', name: 'Spellslinger', emoji: '🪄', desc: 'Casts lots of cheap instants and sorceries and gets paid for each one.', q: '(o:"whenever you cast an instant or sorcery" or otag:cantrip or o:"magecraft")', cmd: '(o:"instant or sorcery")', styles: ['spellslinger'], take: 26, min: 8, weight: 1 },
    { key: 'artifacts', name: 'Artifacts', emoji: '⚙️', desc: 'Artifacts everywhere, and payoffs for each one.', q: 'otag:artifact-matters', cmd: 'o:"artifact"', styles: ['ramp', 'voltron', 'midrange', 'spellslinger'], take: 24, min: 8, weight: 1 },
    { key: 'enchantress', name: 'Enchantress', emoji: '✨', desc: 'Enchantments and Auras that draw cards and power up the rest.', q: '(otag:enchantress or t:aura or o:"whenever an enchantment")', cmd: 'o:"enchantment"', styles: ['voltron', 'ramp', 'midrange'], take: 22, min: 8, weight: 1 },
    { key: 'voltron', name: 'Equipment & Auras', emoji: '⚔️', desc: 'One big protected creature wearing all the Equipment and Auras.', q: '(t:equipment or t:aura)', cmd: '(o:"equipped" or o:"equipment" or o:"aura")', styles: ['voltron', 'aggro'], take: 20, min: 8, weight: 1 },
    { key: 'landfall', name: 'Landfall', emoji: '🌍', desc: 'Plays lots of lands and gets a trigger for every one.', q: 'otag:landfall', cmd: 'otag:landfall', styles: ['ramp', 'midrange'], take: 22, min: 8, weight: 1 },
    { key: 'blink', name: 'Blink', emoji: '💫', desc: 'Flickers its creatures to use their enter-the-battlefield abilities again.', q: 'otag:blink', cmd: 'otag:blink', styles: ['midrange', 'control', 'spellslinger'], take: 16, min: 6, weight: 0.8 },
    { key: 'clones', name: 'Clones', emoji: '🪞', desc: 'Copies the best creature on the table, yours or theirs.', q: 'otag:clone', cmd: 'o:"copy of"', styles: ['midrange', 'spellslinger', 'control'], take: 14, min: 5, weight: 0.7 },
    { key: 'treasure', name: 'Treasure', emoji: '💰', desc: 'Makes Treasure tokens and spends them on something big.', q: 'o:"create a Treasure"', cmd: 'o:"Treasure"', styles: ['ramp', 'aggro', 'spellslinger'], take: 20, min: 8, weight: 1 },
    { key: 'burn', name: 'Group Slug', emoji: '🔥', desc: 'Damages every opponent a little every turn.', q: '(otag:burn o:"each opponent")', cmd: '(o:"each opponent" o:"damage")', styles: ['aggro', 'spellslinger'], take: 20, min: 8, weight: 1 },
    { key: 'discard', name: 'Discard', emoji: '🗑️', desc: 'Empties the table\'s hands.', q: '(otag:discard o:"each opponent")', cmd: 'o:"discard"', styles: ['control', 'aggro'], take: 16, min: 6, weight: 0.8 },
    { key: 'wipes', name: 'Board Wipes', emoji: '🌊', desc: 'Wipes the board again and again and rebuilds after.', q: 'otag:board-wipe', styles: ['control'], take: 14, min: 5, weight: 0.8 },
    { key: 'counterspells', name: 'Draw-Go', emoji: '🧊', desc: 'Holds mana up and counters whatever matters.', q: '(t:instant o:"counter target")', styles: ['control', 'spellslinger'], take: 16, min: 6, weight: 0.8 },
    { key: 'ramp', name: 'Big Mana', emoji: '🌳', desc: 'Ramps into the biggest things it can find.', q: '(otag:ramp or o:"search your library for a basic land")', styles: ['ramp'], take: 22, min: 8, weight: 1 }
];
// Tribes: the same builder with a creature type (a legendary member leads the deck)
const DECK_TRIBES = [['goblin', 'Goblins', '👺', ['aggro', 'tokens', 'midrange']], ['elf', 'Elves', '🧝', ['ramp', 'tokens', 'midrange']], ['zombie', 'Zombies', '🧟', ['aggro', 'midrange', 'control']],
    ['vampire', 'Vampires', '🧛', ['aggro', 'midrange']], ['dragon', 'Dragons', '🐉', ['ramp', 'aggro', 'midrange']], ['angel', 'Angels', '👼', ['midrange', 'voltron', 'tokens']],
    ['wizard', 'Wizards', '🧙', ['spellslinger', 'control']], ['merfolk', 'Merfolk', '🧜', ['aggro', 'tokens', 'midrange']], ['sliver', 'Slivers', '🧬', ['midrange', 'aggro', 'ramp']],
    ['spirit', 'Spirits', '👻', ['control', 'voltron', 'spellslinger']], ['dinosaur', 'Dinosaurs', '🦖', ['ramp', 'aggro', 'midrange']], ['human', 'Humans', '🧑', ['aggro', 'midrange', 'tokens']],
    ['cat', 'Cats', '🐈', ['aggro', 'tokens', 'midrange']], ['beast', 'Beasts', '🐗', ['ramp', 'aggro', 'midrange']], ['knight', 'Knights', '🛡️', ['aggro', 'voltron', 'midrange']],
    ['rogue', 'Rogues', '🗡️', ['control', 'aggro', 'midrange']], ['soldier', 'Soldiers', '💂', ['tokens', 'aggro', 'midrange']], ['pirate', 'Pirates', '🏴‍☠️', ['aggro', 'ramp', 'midrange']],
    ['demon', 'Demons', '😈', ['aggro', 'control', 'midrange']], ['elemental', 'Elementals', '🌪️', ['ramp', 'midrange', 'aggro']], ['eldrazi', 'Eldrazi', '🐙', ['ramp', 'control']]];
DECK_TRIBES.forEach(([t, name, emoji, styles]) => DECK_THEMES.push({
    key: `tribe-${t}`, name: `Tribal ${name}`, emoji, desc: `${name} lead the way: a ${t} commander, ${name.toLowerCase()} and the cards that reward them.`,
    q: `(t:${t} or o:"${t}s you control" or o:"other ${t}s" or o:"another ${t}")`, cmd: `t:legendary t:${t}`, tribe: t, styles, take: 26, min: 10, weight: 0.45
}));
const deckThemeByKey = k => DECK_THEMES.find(t => t.key === k) || null;
// A theme for a seat (random, weighted; only those that suit the style when one is given). `forced` is a key or a theme.
function pickDeckTheme(style, forced, avoid) {
    if (forced) return typeof forced === 'string' ? deckThemeByKey(forced) : forced;
    let pool = DECK_THEMES.filter(t => !avoid || !avoid.includes(t.key));
    const fit = style ? pool.filter(t => t.styles.includes(style)) : pool;
    if (fit.length) pool = fit;
    let r = Math.random() * pool.reduce((a, t) => a + t.weight, 0);
    for (const t of pool) { r -= t.weight; if (r <= 0) return t; }
    return pool[pool.length - 1];
}
const THEME_BASE = 'f:commander game:paper -is:funny';
// Commanders that suit a theme (legendary creatures the game fully plays); empty when the theme names none
async function themeCommanders(theme) {
    const clause = theme.cmd || theme.q;
    const pool = await searchCards(`is:commander t:legendary t:creature ${THEME_BASE} ${clause}`, 3, 'edhrec');
    return pool.filter(c => isFullAuto(c) && rulesFor(c).kind === 'creature' && c.ci.length >= 1 && c.ci.length <= 3 && c.cmc <= 7);
}
// The theme's cards in a color identity: the Automated, non-land ones in EDHREC order
async function themeCards(theme, ci, commander) {
    const pool = await searchCards(`${THEME_BASE} ${colorQuery(ci)} -is:commander -t:land ${theme.q}`, 3, 'edhrec');
    return pool.filter(c => isFullAuto(c) && rulesFor(c).kind !== 'land' && (!commander || c.id !== commander.id));
}

// The Play tab's theme picker for "Surprise me" (empty = any theme). Saved in the browser.
let randomThemeChoice = (typeof store !== 'undefined' && store.get('randomTheme', '')) || '';
function setRandomTheme(v) { randomThemeChoice = v || ''; store.set('randomTheme', randomThemeChoice); const d = deckThemeByKey(randomThemeChoice); const n = $('randomThemeNote'); if (n) n.textContent = d ? d.desc : 'A new theme every game.'; }
function randomThemeSelectHTML() {
    const group = (label, list) => `<optgroup label="${label}">${list.map(t => `<option value="${t.key}"${randomThemeChoice === t.key ? ' selected' : ''}>${t.emoji} ${esc(t.name)}</option>`).join('')}</optgroup>`;
    const d = deckThemeByKey(randomThemeChoice);
    return `<div class="row" style="gap:8px; flex-wrap:wrap; align-items:center; margin:-4px 0 12px;"><label for="randomThemeSel" class="note" style="margin:0;">Theme for the opponent</label>
        <select id="randomThemeSel" onchange="setRandomTheme(this.value)"><option value="">🎲 Any theme (a new one each game)</option>${group('Table & politics', DECK_THEMES.filter(t => ['group-hug', 'politics', 'chaos', 'pillowfort', 'stax', 'extra'].includes(t.key)))}${group('Poison', DECK_THEMES.filter(t => ['infect', 'toxic', 'proliferate'].includes(t.key)))}${group('Archetypes', DECK_THEMES.filter(t => !t.tribe && !['group-hug', 'politics', 'chaos', 'pillowfort', 'stax', 'extra', 'infect', 'toxic', 'proliferate'].includes(t.key)))}${group('Tribes', DECK_THEMES.filter(t => t.tribe))}</select>
        <span class="note" id="randomThemeNote" style="margin:0;">${esc(d ? d.desc : 'A new theme every game.')}</span></div>`;
}
