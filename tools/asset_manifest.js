// Writes docs/spellslinger-asset-manifest.json: every picture in docs/spellslinger-asset-plan.md with its path, exact size, whether it
// needs a transparent background, a size budget, the batch it belongs to and the subject for the prompt. Antigravity reads the manifest,
// generates each file at its path and checks it with `node tests/asset_check.js`. Edit the lists below, then run `node tools/asset_manifest.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const STYLE = 'Gilded Arcana style: painted fantasy game art, warm rim light, brushed gold and carved stone accents, deep jewel colors, clean readable silhouette.';
const RULES = 'No text, no letters, no logos, no card frames, no official Magic: The Gathering symbols (no mana symbols, set symbols or planeswalker symbol), no real-world brands.';
const out = [];
const add = (o) => out.push({ batch: 7, alpha: false, ...o });
const kb = { icon: 40, sleeve: 200, matBase: 500, matPhone: 400, matLayer: 400, matThumb: 60, part: 80, thumb: 24, bg: 450, bgPhone: 400, frame: 30, fill: 80, button: 30, divider: 40, banner: 300, avatar: 120, emote: 60, pack: 120, ui: 200, loading: 450, table: 120, fx: 20, prop: 120 };

// ---- 3.5 Icons (128 x 128, transparent, round gold-rimmed medallion) ----
const ICONS = {
    'Turn phases': ['phase-untap:a turning gold arrow loop', 'phase-upkeep:a rising sun over a stone altar', 'phase-draw:a single card sliding off a stack', 'phase-main:a glowing open spellbook', 'phase-combat:two crossed swords', 'phase-attack:a sword thrust forward with motion streaks', 'phase-block:a raised kite shield', 'phase-damage:a red starburst impact', 'phase-main2:a closed spellbook with a ribbon', 'phase-end:a crescent moon over an hourglass'],
    Keywords: ['kw-flying:a feathered wing', 'kw-first-strike:a sword with a small lightning spark at its tip', 'kw-double-strike:two parallel swords with sparks', 'kw-trample:a heavy hoofprint cracking the ground', 'kw-deathtouch:a dripping green skull vial', 'kw-lifelink:a heart joined to a sword by a vine', 'kw-vigilance:an open watchful eye inside a shield', 'kw-haste:a lightning bolt with speed lines', 'kw-hexproof:a shield with a broken rune bouncing off', 'kw-indestructible:a diamond-hard gold shield', 'kw-menace:a snarling horned mask', 'kw-reach:a spider web strung between branches', 'kw-defender:a stone tower wall', 'kw-flash:a bright camera-flash star burst', 'kw-ward:a ring of protective runes', 'kw-protection:a bubble of light around a shield', 'kw-prowess:a fist wrapped in arcane sparks', 'kw-infect:a black-green blight blot', 'kw-toxic:a green poison droplet'],
    'Card types': ['type-creature:a beast paw print', 'type-instant:a lightning bolt', 'type-sorcery:a swirling spell flame', 'type-artifact:a brass gear', 'type-enchantment:a glowing crescent charm', 'type-planeswalker:a hooded mage silhouette', 'type-land:a mountain peak', 'type-battle:a tattered war banner', 'type-token:a round copper coin with a star'],
    Rarities: ['rarity-common:a plain black gem', 'rarity-uncommon:a silver gem', 'rarity-rare:a gold gem', 'rarity-mythic:a red-orange flaming gem', 'rarity-special:a purple prismatic gem', 'rarity-foil:a rainbow foil shimmer gem'],
    'Mana gems (our own design, not the official symbols)': ['gem-W:a pale gold sun-shaped gem', 'gem-U:a blue water-droplet crystal', 'gem-B:a black crystal with a faint violet glow', 'gem-R:a red ember crystal', 'gem-G:a green leaf-shaped emerald', 'gem-C:a grey hexagonal stone', 'gem-multi:a gold gem split into five colored facets'],
    Currencies: ['cur-coin:a stack of gold coins', 'cur-aether:a swirling cyan aether orb', 'cur-cash:a folded paper banknote with a gold band', 'cur-salvage:a pile of brass scrap and gears'],
    Menus: ['nav-home:a small stone cottage', 'nav-play:two crossed cards', 'nav-packs:a sealed booster pack', 'pack-play:a plain booster pack', 'pack-collector:a gold-trimmed collector booster pack', 'nav-decks:a deck box', 'nav-draft:a fan of three cards', 'nav-shop:a shop awning', 'nav-campaign:a rolled map with a red pin', 'nav-rules:an open rulebook with a quill', 'nav-locker:a gilded wardrobe chest', 'nav-settings:a brass cog', 'nav-records:a scroll with a wax seal'],
    'Game actions': ['act-attack:a sword pointing up and right', 'act-block:a shield held up', 'act-pass:an open palm', 'act-end-turn:an hourglass with the last grain falling', 'act-concede:a white flag', 'act-deal:two hands shaking', 'act-ask:a speech bubble with a question mark shape made of stars', 'act-taunt:a laughing jester mask', 'act-compliment:a raised goblet'],
    'Counters and zones': ['counter-plus:a green upward chevron gem', 'counter-minus:a red downward chevron gem', 'life:a glowing ruby heart', 'ctr-loyalty:a shield-shaped crest', 'ctr-charge:a crackling battery crystal', 'ctr-poison:a bubbling green flask', 'ctr-energy:a yellow lightning orb', 'zone-library:a neat stack of card backs', 'zone-graveyard:a tombstone', 'zone-exile:a swirling purple portal', 'zone-command:a gold pedestal'],
    Moods: ['mood-calm:a serene closed-eye face', 'mood-happy:a grinning face', 'mood-angry:a scowling face with steam', 'mood-worried:a sweating nervous face', 'mood-confident:a smirking face with a raised brow', 'mood-salty:a grumpy face with a salt shaker']
};
for (const [group, list] of Object.entries(ICONS)) list.forEach(s => {
    const [id, what] = s.split(':');
    add({ id, slot: 'icon', group, path: `spellslinger/art/ui/${id}.png`, w: 128, h: 128, alpha: true, maxKB: kb.icon, batch: 2, subject: `a round icon medallion with a thin gold rim showing ${what}, centered, readable at 24 pixels` });
});

// ---- 3.2 Sleeves (630 x 880, card shape, transparent rounded corners) ----
const SLEEVES = [
    ['gilded-sanctum', 'rare', 'an ornate art-deco card back in deep navy and gold with a glowing crystal at the centre', 1],
    ['ember-crest', 'common', 'a deep red card back with an embossed flame crest and a thin gold border', 3], ['tide-crest', 'common', 'a deep blue card back with an embossed wave crest', 3],
    ['grave-crest', 'common', 'a black card back with an embossed skull-and-moon crest', 3], ['grove-crest', 'common', 'a green card back with an embossed oak leaf crest', 3],
    ['dawn-crest', 'common', 'an ivory card back with an embossed sun crest', 3], ['onyx-plain', 'common', 'a matte black card back with a fine gold pinstripe border', 3],
    ['pearl-plain', 'common', 'a pearl white card back with a silver pinstripe border', 3], ['dragon-coil', 'rare', 'a red dragon coiled in a circle on a dark card back', 3],
    ['koi-pair', 'rare', 'two koi fish circling each other in dark water', 3], ['night-owl', 'rare', 'a wise owl with glowing eyes on a branch under the moon', 3],
    ['lantern-street', 'rare', 'a cobbled street of hanging paper lanterns at night', 7], ['star-chart', 'rare', 'an antique star chart with gold constellations', 7],
    ['clockwork', 'rare', 'brass gears and clock faces interlocking', 7], ['mushroom-ring', 'rare', 'a glowing fairy ring of mushrooms in a dark forest', 7],
    ['storm-crown', 'rare', 'a crown of lightning above dark clouds', 7], ['tidal-temple', 'rare', 'a sunken temple under shafts of light', 7],
    ['wolf-moon', 'rare', 'a wolf howling at a huge moon', 7], ['golden-hoard', 'epic', 'a dragon hoard of gold coins and gems, gold-foil look', 7],
    ['angel-wings', 'epic', 'great white angel wings spread, gold-foil look', 7], ['lich-crown', 'epic', 'a lich crown on a velvet cushion, violet glow', 7],
    ['forge-heart', 'epic', 'a glowing forge with a hammer and anvil', 7], ['sky-armada', 'epic', 'airships sailing over clouds at sunset', 7],
    ['crystal-cavern', 'epic', 'a cavern of giant glowing crystals', 7], ['serpent-scale', 'epic', 'iridescent serpent scales filling the card, gold-foil look', 7],
    ['autumn-shrine', 'epic', 'a shrine gate among red maple leaves', 7], ['phoenix-rebirth', 'mythic', 'a phoenix rising in a ring of fire', 7, true],
    ['astral-tide', 'mythic', 'a galaxy pouring like a wave', 7, true], ['lich-sigil', 'mythic', 'a dark sigil circle with skulls and violet flame', 7, true],
    ['world-tree', 'mythic', 'a vast glowing tree with roots of light', 7, true]
];
SLEEVES.forEach(([id, rarity, what, batch, fx]) => {
    add({ id: `sleeve-${id}`, slot: 'sleeve', rarity, path: `spellslinger/art/sleeves/${id}.png`, w: 630, h: 880, alpha: true, maxKB: kb.sleeve, batch, subject: `a trading card back (sleeve) filling the whole image, rounded corners with transparent corner pixels: ${what}. One strong central motif plus a border, readable at 60 pixels wide` });
    if (fx) add({ id: `sleeve-${id}-fx`, slot: 'sleeve-fx', rarity, path: `spellslinger/art/sleeves/${id}-fx.png`, w: 630, h: 880, alpha: true, maxKB: kb.sleeve, batch, subject: `only the glowing magic overlay for the card back "${id}" (runes, sparks, light), everything else transparent, same layout as the sleeve` });
});

// ---- 3.3 Playmats (1920 x 1080; the centre 60% x 70% stays calm) ----
const MATS = [
    ['sanctum', 'Sanctum of Gold: a carved stone temple floor with gold inlay circles and runes', ['lights'], 3], ['mountain', 'Volcanic Caldera: black basalt and glowing lava cracks at the edges', ['fire'], 3],
    ['island', 'Astral Tidepool: a shallow moonlit tidepool with coral at the edges', ['water'], 3], ['forest', 'Whispering Wildwood: a mossy forest floor with roots and ferns at the edges', ['foliage'], 3],
    ['plains', 'Radiant Citadel: white marble terrace in sunlight with banners at the edges', ['clouds'], 7], ['swamp', 'Shadowed Crypt: a misty crypt floor with candles and bones at the edges', ['fog', 'lights'], 7],
    ['sky-harbor', 'Sky Harbor: a wooden airship dock above the clouds', ['clouds'], 7], ['workshop', 'Clockwork Workshop: a tinkerer\'s bench with brass gears at the edges', ['lights'], 7],
    ['moon-shrine', 'Moonlit Shrine: a stone shrine courtyard at night with lanterns', ['lights', 'foliage'], 7], ['library', 'Sunken Library: drowned bookshelves and floating pages', ['water'], 7],
    ['oasis', 'Desert Oasis: sand dunes around a palm-fringed pool', ['water', 'foliage'], 7], ['frozen-throne', 'Frozen Throne: an ice palace floor with frost patterns', ['fog'], 7]
];
MATS.forEach(([id, what, layers, batch]) => {
    const base = `${what}. Top-down view of a game table playmat. The centre 60% by 70% is a calm, even surface for cards; detail only on the edges and corners`;
    add({ id: `mat-${id}`, slot: 'playmat', path: `spellslinger/art/mats/${id}/base.jpg`, w: 1920, h: 1080, maxKB: kb.matBase, batch, subject: base });
    add({ id: `mat-${id}-phone`, slot: 'playmat', path: `spellslinger/art/mats/${id}/base-phone.jpg`, w: 1080, h: 1920, maxKB: kb.matPhone, batch, subject: `${base} (portrait version)` });
    add({ id: `mat-${id}-thumb`, slot: 'playmat', path: `spellslinger/art/mats/${id}/thumb.jpg`, w: 480, h: 270, maxKB: kb.matThumb, batch, subject: `${what} (small preview)` });
    layers.forEach(l => add({ id: `mat-${id}-layer-${l}`, slot: 'playmat-layer', path: `spellslinger/art/mats/${id}/layer-${l}.png`, w: 1920, h: 1080, alpha: true, maxKB: kb.matLayer, batch, subject: `only the ${l} of the "${id}" playmat on the same 1920 x 1080 canvas so it lines up with base.jpg; everything else transparent` }));
});

// ---- 3.4 Companions (parts on 512 x 512 canvases) ----
const COMPANIONS = [
    ['ember-drake', 'a chubby baby red dragon (whelp)', ['tail', 'wing'], 1], ['tidepool-axolotl', 'a cute blue axolotl with frilly gills', ['tail', 'gills'], 4],
    ['lantern-wisp', 'a floating lantern spirit with a candle flame face', ['flame', 'handle'], 4], ['moss-golem', 'a small round stone golem covered in moss', ['arm-l', 'arm-r'], 4],
    ['brass-owl', 'a clockwork brass owl', ['wing', 'ears'], 7], ['star-fox', 'a small fox with a starry night pelt', ['tail', 'ears'], 7],
    ['mimic-chest', 'a treasure chest mimic with a tongue', ['lid', 'tongue'], 7], ['ink-imp', 'a mischievous purple ink imp', ['tail', 'wing'], 7],
    ['crystal-tortoise', 'a tortoise with crystals growing on its shell', ['head-neck', 'leg'], 7], ['storm-ferret', 'a ferret crackling with blue lightning', ['tail', 'ears'], 7],
    ['sun-lion', 'a golden lion cub with a sunburst mane', ['tail', 'mane'], 7], ['bone-raven', 'a skeletal raven', ['wing', 'tail'], 7],
    ['mushroom-sprite', 'a tiny sprite wearing a red mushroom cap', ['cap', 'arm-l', 'arm-r'], 7], ['clockwork-beetle', 'a brass clockwork beetle', ['wing-case', 'leg'], 7],
    ['frost-kitsune', 'a white fox with icy blue tails', ['tail', 'ears'], 7], ['void-jelly', 'a floating dark jellyfish with starry tentacles', ['tentacles'], 7]
];
COMPANIONS.forEach(([id, what, parts, batch]) => {
    const canvas = 'on a 512 by 512 transparent canvas';
    add({ id: `comp-${id}-body`, slot: 'companion', path: `spellslinger/art/companions/${id}/body.png`, w: 512, h: 512, alpha: true, maxKB: kb.part, batch, subject: `${what}: the body only (no head and none of: ${parts.join(', ')}), ${canvas}` });
    add({ id: `comp-${id}-head`, slot: 'companion', path: `spellslinger/art/companions/${id}/head.png`, w: 512, h: 512, alpha: true, maxKB: kb.part, batch, subject: `${what}: the head only, facing the viewer, ${canvas}` });
    parts.forEach(p => add({ id: `comp-${id}-${p}`, slot: 'companion', path: `spellslinger/art/companions/${id}/${p}.png`, w: 512, h: 512, alpha: true, maxKB: kb.part, batch, subject: `${what}: only the ${p}, ${canvas}` }));
    ['happy', 'angry', 'scared', 'sleepy', 'cheer', 'blink'].forEach(m => add({ id: `comp-${id}-face-${m}`, slot: 'companion', path: `spellslinger/art/companions/${id}/face-${m}.png`, w: 512, h: 512, alpha: true, maxKB: kb.part, batch: batch === 1 ? 4 : batch, subject: `${what}: the head only, same position and size as head.png, ${m === 'blink' ? 'eyes gently closed mid-blink, otherwise exactly the same' : m + ' expression'}` }));
    add({ id: `comp-${id}-thumb`, slot: 'companion', path: `spellslinger/art/companions/${id}/thumb.png`, w: 128, h: 128, alpha: true, maxKB: kb.thumb, batch, subject: `${what}, whole creature, small icon` });
});

// ---- Desk props ----
[['life-d20', 'a large gold-and-crystal d20 die used as a life counter'], ['life-dial', 'a brass dial life counter with a glass face'], ['hourglass', 'an ornate gold hourglass'], ['candle', 'a tall wax candle in a gold holder (no flame)'], ['crystal-ball', 'a crystal ball on a claw stand']]
    .forEach(([id, what], k) => add({ id: `prop-${id}`, slot: 'prop', path: `spellslinger/art/props/${id}.png`, w: 256, h: 256, alpha: true, maxKB: kb.prop, batch: k < 3 ? 4 : 7, subject: `${what}, centered on a transparent canvas` }));

// ---- 3.1 Themes ----
const THEMES = [['gilded-sanctum', 'a gilded stone sanctum with warm gold light', 5], ['emberforge', 'a dwarven forge of embers and copper', 5], ['tidecrown', 'an underwater palace of pearl and blue coral', 5], ['grave-lantern', 'a candlelit gothic graveyard', 5],
    ['verdant-hollow', 'a mossy hollow under ancient trees', 7], ['dawnspire', 'white spires in morning light', 7], ['frostveil', 'a frozen hall of ice and silver', 7], ['clockwork-bazaar', 'a bustling brass bazaar', 7],
    ['starfall', 'a star observatory under falling stars', 7], ['harvest-moon', 'an autumn field under a huge orange moon', 7], ['yuletide', 'a festive hall with pine garlands and warm hearth', 7], ['void-rift', 'a purple void rift with floating rocks', 7]];
THEMES.forEach(([id, what, batch]) => {
    const p = f => `spellslinger/art/themes/${id}/${f}`;
    add({ id: `theme-${id}-bg`, slot: 'theme', path: p('bg.jpg'), w: 1920, h: 1080, maxKB: kb.bg, batch, subject: `${what}; calm, low contrast, darker in the middle third so text reads (page background)` });
    add({ id: `theme-${id}-bg-phone`, slot: 'theme', path: p('bg-phone.jpg'), w: 1080, h: 1920, maxKB: kb.bgPhone, batch, subject: `${what} (portrait version of the page background)` });
    add({ id: `theme-${id}-frame`, slot: 'theme', path: p('frame.png'), w: 96, h: 96, alpha: true, maxKB: kb.frame, batch, subject: `a 9-slice panel frame for ${what}: 24 pixel decorated corners, plain straight edges, fully transparent centre` });
    add({ id: `theme-${id}-fill`, slot: 'theme', path: p('fill.png'), w: 256, h: 256, maxKB: kb.fill, batch, subject: `a seamless tiling, very subtle panel texture for ${what}` });
    add({ id: `theme-${id}-button`, slot: 'theme', path: p('button.png'), w: 96, h: 48, alpha: true, maxKB: kb.button, batch, subject: `a 9-slice button skin for ${what}, 16 pixel corners` });
    add({ id: `theme-${id}-divider`, slot: 'theme', path: p('divider.png'), w: 512, h: 32, alpha: true, maxKB: kb.divider, batch, subject: `a thin horizontal ornament divider line for ${what}` });
    add({ id: `theme-${id}-banner`, slot: 'theme', path: p('banner.jpg'), w: 1600, h: 400, maxKB: kb.banner, batch, subject: `${what}, wide banner; the left half calm for a title` });
});

// ---- 3.6 Everything else ----
['wizard', 'knight', 'rogue', 'druid', 'necromancer', 'artificer', 'pirate', 'monk', 'witch', 'paladin', 'bard', 'ranger', 'samurai', 'shaman', 'alchemist', 'gladiator', 'oracle', 'tinker', 'vampire lord', 'elf archer', 'dwarf smith', 'goblin chief', 'merfolk sage', 'dragon rider']
    .forEach((who, k) => add({ id: `avatar-${who.replace(/ /g, '-')}`, slot: 'avatar', path: `spellslinger/art/avatars/${who.replace(/ /g, '-')}.png`, w: 512, h: 512, alpha: true, maxKB: kb.avatar, batch: k < 12 ? 6 : 7, subject: `a head-and-shoulders portrait of an original ${who}, subject inside the middle 80 percent circle` }));
const BOTS = { greg: 'a cheerful big bearded farmer-druid who loves huge creatures', marcus: 'a sharp, calm young strategist in a dark coat', sarah: 'an inventive tinkerer with goggles and a toolbelt', leo: 'a dreamy storyteller bard with a lute', trevor: 'a meticulous accountant-mage with spectacles and a ledger', sam: 'a hyper energetic speedrunner with a headband', arthur: 'a rich old collector in a velvet jacket with gold rings', brenda: 'a thrifty, friendly woman with a coupon book', luke: 'a smirking trickster in a hooded cloak' };
Object.entries(BOTS).forEach(([id, what]) => {
    add({ id: `bot-${id}`, slot: 'bot', path: `spellslinger/art/bots/${id}.png`, w: 512, h: 512, alpha: true, maxKB: kb.avatar, batch: 6, subject: `${what}, head-and-shoulders portrait, neutral expression` });
    ['happy', 'angry', 'worried', 'confident', 'salty'].forEach(m => add({ id: `bot-${id}-${m}`, slot: 'bot', path: `spellslinger/art/bots/${id}-${m}.png`, w: 512, h: 512, alpha: true, maxKB: kb.avatar, batch: 6, subject: `${what}, same portrait, ${m === 'blink' ? 'eyes gently closed mid-blink, otherwise exactly the same' : m + ' expression'}` }));
});
['gg', 'thinking', 'nice', 'oops', 'wow', 'hello', 'cry', 'laugh', 'angry', 'love', 'cool', 'sleepy', 'party', 'shock', 'facepalm', 'thumbs-up', 'salt', 'fire', 'crown', 'skull', 'popcorn', 'clap', 'shrug', 'tea']
    .forEach((e, k) => add({ id: `emote-${e}`, slot: 'emote', path: `spellslinger/art/emotes/${e}.png`, w: 256, h: 256, alpha: true, maxKB: kb.emote, batch: k < 12 ? 6 : 7, subject: `a sticker emote of a little round mascot creature expressing "${e.replace(/-/g, ' ')}", thick outline, no words` }));
['standard', 'collector', 'masters', 'classic', 'vintage', 'early', 'power'].forEach(p => add({ id: `pack-${p}`, slot: 'pack', path: `spellslinger/art/packs2/${p}.png`, w: 384, h: 576, alpha: true, maxKB: kb.pack, batch: 7, subject: `a sealed booster pack wrapper in the "${p}" style; the top 22 percent is the crimped flap; original design, no logos` }));
[['banner-win', 'a triumphant gold laurel and sunburst banner', 1200, 400], ['banner-lose', 'a broken sword over a dim banner', 1200, 400], ['banner-draw', 'two crossed swords resting on a stone', 1200, 400],
    ['mode-sandbox', 'an alchemist\'s workbench with bubbling flasks', 1200, 300], ['mode-campaign', 'a winding road to a distant tower', 1200, 300], ['mode-shop', 'a cosy card shop counter', 1200, 300]]
    .forEach(([id, what, w, h]) => add({ id, slot: 'ui', path: `spellslinger/art/ui/${id}.${/^banner/.test(id) ? 'png' : 'jpg'}`, w, h, alpha: /^banner/.test(id), maxKB: kb.ui, batch: 7, subject: what }));
for (let n = 1; n <= 6; n++) add({ id: `loading-${n}`, slot: 'ui', path: `spellslinger/art/ui/loading-${n}.jpg`, w: 1920, h: 1080, maxKB: kb.loading, batch: 7, subject: `loading screen painting ${n}: an epic duel between two original mages across a magical landscape` });
['sanctum', 'ember', 'tide', 'grave', 'grove', 'clockwork'].forEach(set => ['deck-tray', 'graveyard', 'exile-portal', 'command-plinth'].forEach(piece =>
    add({ id: `table-${set}-${piece}`, slot: 'table', path: `spellslinger/art/table/${set}/${piece}.png`, w: 512, h: 512, alpha: true, maxKB: kb.table, batch: 7, subject: `a ${piece.replace(/-/g, ' ')} game-table piece in the ${set} style, seen from above at a slight angle` })));
['spark', 'smoke', 'glow-ring', 'shard', 'ember', 'droplet', 'leaf', 'rune'].forEach(f => add({ id: `fx2-${f}`, slot: 'fx', path: `spellslinger/art/fx2/${f}.png`, w: 128, h: 128, alpha: true, maxKB: kb.fx, batch: 7, subject: `a single ${f.replace(/-/g, ' ')} particle texture, soft edges, centered, white-to-colored glow` }));
['firework', 'coin', 'petal', 'dragon-silhouette', 'phoenix', 'star', 'confetti', 'lantern'].forEach(c => add({ id: `celebrate-${c}`, slot: 'celebration', path: `spellslinger/art/celebrations/${c}.png`, w: 256, h: 256, alpha: true, maxKB: kb.prop, batch: 7, subject: `one ${c.replace(/-/g, ' ')} used in a victory celebration animation` }));

const file = path.join(ROOT, 'docs', 'spellslinger-asset-manifest.json');
fs.writeFileSync(file, JSON.stringify({ about: 'Every picture in docs/spellslinger-asset-plan.md. Generate each at exactly w x h at its path; alpha = transparent background needed; maxKB = size budget. Check with: node tests/asset_check.js', style: STYLE, rules: RULES, promptPattern: `${STYLE} <subject>. ${RULES}`, assets: out.map(a => ({ ...a, prompt: `${STYLE} ${a.subject[0].toUpperCase()}${a.subject.slice(1)}. ${RULES}` })) }, null, 1) + '\n');
console.log(`Wrote ${path.relative(ROOT, file)}: ${out.length} assets (${[...new Set(out.map(a => a.batch))].sort().map(b => `batch ${b}: ${out.filter(a => a.batch === b).length}`).join(', ')})`);
