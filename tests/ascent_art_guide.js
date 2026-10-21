// Writes docs/ascent-art-prompts.md from spellslinger/13g-ascent-art-data.js: every character, effect and icon of
// Planeswalker's Ascent with a copy-and-paste prompt for Retro Diffusion, its size, frame count and the file path the game looks for.
//   node tests/ascent_art_guide.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const data = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'spellslinger', '13g-ascent-art-data.js'), 'utf8') + '\n;({ STYLE: ASCENT_ART_STYLE, RULES: ASCENT_ART_RULES, CH: ASCENT_CHARACTERS, FX: ASCENT_FX, IDEAS: ASCENT_FX_IDEAS, ICONS: ASCENT_ICONS })');
const { STYLE, RULES, CH, FX, IDEAS, ICONS } = data;
const PACKS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'spellslinger', '12b-pack-looks.js'), 'utf8') + '\n;PACK_LOOKS');

const charPrompt = c => `${STYLE}. Close-up head-and-shoulders portrait sprite sheet (a dialogue portrait) of ${c.look}. Palette: ${c.palette}. Expression: ${c.mood}. The face is large and centered, facing the viewer, filling most of the frame, shoulders cropped by the bottom edge. Sheet layout: 2 rows of 16 frames, each frame 96 x 96 pixels, 16 frames per row (so the sheet is 1536 x 192). Row 1: idle loop (gentle breathing, a blink). Row 2: talking loop (mouth opening and closing, eyebrows moving a little). Identical framing in every frame.`;
const fxPrompt = (k, f) => `${STYLE}. Animated effect, ${f.frames} frames in one horizontal strip, each frame ${f.size} x ${f.size} pixels, centered, transparent background: ${f.prompt}.`;
const iconPrompt = (k, i) => `${STYLE}. ${i.frames > 1 ? `Animated loop of ${i.frames} frames in a horizontal strip, each frame` : 'Single sprite,'} ${i.size} x ${i.size} pixels: ${i.prompt}.`;

// ---- Machine-readable manifest for tools/make_art.py (styles checked against the Retro Diffusion API catalog, 2026-09) ----
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000; };
const charSubject = c => `Close-up head-and-shoulders portrait (a dialogue portrait) of ${c.look}. Show only what is visible from the chest up. The face is large and centered, filling most of the frame, facing the viewer with an expressive face, shoulders cropped by the bottom edge. Palette: ${c.palette}. Expression: ${c.mood}. Mouth closed in a relaxed, small friendly smile. Plain flat background, no text`;
const MANIFEST = { generated: 'by tests/ascent_art_guide.js; do not edit by hand', assets: [] };
for (const c of CH) MANIFEST.assets.push({
    id: c.id, group: 'characters', name: c.name, out: `spellslinger/art/characters/${c.id}.png`, kind: 'sheet', frame: [96, 96], cols: 16, rows: 2, seed: hash(c.id),
    steps: [
        { key: 'base', style: 'rd_pro__fantasy', width: 96, height: 96, prompt: charSubject(c), remove_bg: true },
        { key: 'idle', style: 'rd_advanced_animation__idle', width: 96, height: 96, prompt: 'a seamless idle loop: the very first and very last frame are the same pose. Gentle breathing and one slow blink only. The expression never changes from the starting drawing, the mouth stays closed and completely still, the head barely moves, shoulders stay in place, no lighting or color changes', frames_duration: 16, from: 'base' },
        { key: 'talk', style: 'rd_advanced_animation__custom_action', width: 96, height: 96, prompt: 'talking: the mouth opens and closes, the eyebrows move a little and the head tilts slightly, shoulders stay in place', frames_duration: 16, from: 'base' }
    ]
});
// Expression stills and win / lose poses for the 18 opponents (not the helpers). Both are made from the character's own base drawing
// (tools/make_art.py reads it from that character's cache, so make the characters first), so they stay on-model.
const MOODS = [['happy', 'the character breaks into a warm delighted smile, eyes bright, eyebrows raised, head tilts a little'], ['angry', 'the character scowls angrily, eyebrows lowered and pulled together, eyes narrowed, jaw clenched'], ['worried', 'the character looks worried and anxious, eyebrows raised and drawn together, eyes wide, mouth tight, one small sweat drop']];
const POSES = [['win', 'the character celebrates a victory: a big triumphant grin, a quick fist pump and bouncing shoulders, then settles back with a proud smile'], ['lose', 'the character is defeated: shoulders slump, the head drops, a heavy sigh with eyes closed, then slowly looks up with a rueful half-smile']];
for (const c of CH.filter(x => !/^npc-/.test(x.id))) {
    MANIFEST.assets.push({ id: 'mood-' + c.id, group: 'moods', name: c.name + ': expressions (happy, angry, worried)', out: `spellslinger/art/moods/${c.id}.png`, kind: 'stills', frame: [96, 96], stills: MOODS.map(m => 'm_' + m[0]), seed: hash('mood-' + c.id),
        steps: MOODS.map(m => ({ key: 'm_' + m[0], style: 'rd_advanced_animation__custom_action', width: 96, height: 96, prompt: m[1] + ', shoulders stay in place, the framing and drawing stay identical', frames_duration: 8, from: 'base', from_asset: c.id })) });
    MANIFEST.assets.push({ id: 'pose-' + c.id, group: 'poses', name: c.name + ': win and lose poses', out: `spellslinger/art/poses/${c.id}.png`, kind: 'rows', frame: [96, 96], cols: 16, rows: POSES.map(p => 'p_' + p[0]), seed: hash('pose-' + c.id),
        steps: POSES.map(p => ({ key: 'p_' + p[0], style: 'rd_advanced_animation__custom_action', width: 96, height: 96, prompt: p[1] + ', shoulders stay in place, the framing and drawing stay identical', frames_duration: 16, from: 'base', from_asset: c.id })) });
}
for (const [k, f] of Object.entries(FX)) MANIFEST.assets.push({
    id: k, group: 'fx', name: f.label, out: `spellslinger/art/fx/${k}.png`, kind: 'strip', frame: [f.size, f.size], frames: f.frames, seed: hash(k),
    steps: [{ key: 'gen', style: 'rd_animation__vfx', width: Math.min(f.size, 96), height: Math.min(f.size, 96), prompt: f.prompt, remove_bg: true }]
});
for (const [k, f] of Object.entries(IDEAS)) MANIFEST.assets.push({
    id: k, group: 'ideas', name: f.label, out: `spellslinger/art/fx/${k}.png`, kind: 'strip', frame: [f.size, f.size], frames: f.frames, seed: hash(k),
    steps: [{ key: 'gen', style: 'rd_animation__vfx', width: Math.min(f.size, 96), height: Math.min(f.size, 96), prompt: f.prompt, remove_bg: true }]
});
for (const [k, i] of Object.entries(ICONS)) {
    const big = i.size >= 128, bg = /^bg-|^mat-/.test(k);
    MANIFEST.assets.push({
        id: k, group: 'icons', name: i.label, out: `spellslinger/art/ui/${k}.png`, kind: 'strip', frame: [i.size, i.size], frames: i.frames, seed: hash(k),
        steps: [{ key: 'gen', style: i.frames > 1 ? 'rd_animation__vfx' : big ? 'rd_plus__environment' : 'rd_plus__low_res', width: i.frames > 1 ? Math.min(i.size, 96) : Math.max(i.size, 16), height: i.frames > 1 ? Math.min(i.size, 96) : Math.max(i.size, 16), prompt: i.prompt, remove_bg: !bg }]
    });
}
for (const [k, L] of Object.entries(PACKS)) {
    MANIFEST.assets.push({ id: 'pack-' + k, group: 'packs', name: L.label + ' wrapper', out: `spellslinger/art/packs/${k}.png`, kind: 'strip', frame: [96, 144], frames: 1, seed: hash('pack-' + k),
        steps: [{ key: 'gen', style: 'rd_pro__default', width: 96, height: 144, prompt: L.wrap, remove_bg: true }] });
    MANIFEST.assets.push({ id: 'pack-' + k + '-open', group: 'packs', name: L.label + ' opening burst', out: `spellslinger/art/packs/${k}-open.png`, kind: 'strip', frame: [96, 96], frames: 12, seed: hash('pack-' + k + '-open'),
        steps: [{ key: 'gen', style: 'rd_animation__vfx', width: 96, height: 96, prompt: L.open, remove_bg: true }] });
}
// ---- Website art (MTG lookup tool): pixel card frames, cursor and click burst; PNGs go in art/site/ and are used automatically ----
const SITE = [
    ...[['common', 'plain grey steel'], ['uncommon', 'polished silver-blue'], ['rare', 'bright gold'], ['mythic', 'fiery orange-red with tiny flame edges'], ['special', 'magenta and violet with star studs']].map(([r, d]) => ({
        id: 'frame-' + r, label: `${r} card frame`, size: [64, 64], frames: 1, style: 'rd_plus__ui_element', remove_bg: true,
        prompt: `a square ornate trading card border frame in ${d}, symmetrical, a thin bevelled band around the edge with small corner studs, the entire middle is empty and fully transparent, designed to be stretched as a 9-slice with 12 pixel corners, no text` })),
    { id: 'cursor-arrow', label: 'mouse cursor, arrow', size: [32, 32], frames: 1, style: 'rd_plus__low_res', remove_bg: true,
      prompt: 'a pixel art mouse pointer arrow, cream white fill with a thick dark outline and one small teal highlight pixel, pointing up and to the left, the tip at the very top-left corner of the image' },
    { id: 'loading-card', label: 'loading spinner (a card flipping)', size: [48, 48], frames: 8, style: 'rd_animation__vfx', remove_bg: true,
      prompt: 'a single pixel playing card spinning around its vertical axis like a coin flip, teal back with a small gold star, seamless 8 frame loop, centered' },
    ...[['halloween', 'a spooky night street with a big orange moon, bats, a haunted house and glowing jack-o-lanterns'], ['autumn', 'a golden autumn hillside with red and orange trees, falling leaves and a warm low sun'], ['winter', 'a snowy village at dusk with lit windows, pine trees and falling snow'], ['christmas', 'a cozy Christmas night scene with a decorated tree, wrapped gifts, a sleigh and twinkling lights'], ['spring', 'a bright spring meadow with cherry blossoms, tulips, a pastel sky and small birds'], ['newyear', 'a midnight city skyline with fireworks bursting, confetti and a glowing clock']].map(([k, d]) => ({
        id: 'scene-' + k, label: `${k} scene banner`, size: [256, 128], frames: 1, style: 'rd_plus__environment', remove_bg: false,
        prompt: `a wide pixel art banner scene, ${d}, horizon along the lower third, plenty of open sky in the upper half where a page title will sit, soft colors that stay readable behind white text` }))
];
// Cardy, the site's talking-card helper (MTG tool, 2026-10-21): one base drawing, then six 16-frame rows. The page picks the row by pose.
const CARDY_SUBJECT = `${STYLE}. A friendly living trading card mascot called Cardy, full body, facing the viewer: the card is the body, a cream-colored card with a teal frame, a big simple face (two round eyes, a wide smile, rosy cheeks) where the card art would be, small stick arms with white cartoon gloves and little legs with shoes. Spunky, eager, kind, a little goofy. Palette: cream, teal, gold, dark navy outline. Plain background, centered, no text, no logos, no real card art`;
const CARDY_ROWS = [['idle', 'a seamless idle loop: bouncing very slightly on tiptoe, one blink, the eyes glancing left and right, the smile unchanged'], ['wave', 'waving one glove high with a big happy grin and a small hop, then settling'], ['talk', 'talking enthusiastically: the mouth opens and closes, a glove gestures, the body bobs'], ['think', 'thinking: one glove on the chin, eyes looking up and to the side, a small tilt of the body'], ['cheer', 'cheering: both gloves in the air, jumping with a huge grin and tiny sparkles'], ['sleep', 'sleeping: eyes closed, the body slumped and gently breathing, a little Z floating up']];
MANIFEST.assets.push({ id: 'cardy', group: 'site', name: 'Cardy, the helper card (6 animation rows)', out: 'art/site/cardy.png', kind: 'rows', frame: [96, 96], cols: 16, rows: CARDY_ROWS.map(r => r[0]), seed: hash('cardy'),
    steps: [{ key: 'base', style: 'rd_pro__fantasy', width: 96, height: 96, prompt: CARDY_SUBJECT, remove_bg: true },
        ...CARDY_ROWS.map(r => ({ key: r[0], style: r[0] === 'idle' ? 'rd_advanced_animation__idle' : 'rd_advanced_animation__custom_action', width: 96, height: 96, prompt: r[1] + ', the drawing, colors and framing stay identical to the starting picture', frames_duration: 16, from: 'base' }))] });
for (const x of SITE) MANIFEST.assets.push({ id: x.id, group: 'site', name: x.label, out: `art/site/${x.id}.png`, kind: 'strip', frame: x.size, frames: x.frames, seed: hash(x.id),
    steps: [{ key: 'gen', style: x.style, width: x.size[0], height: x.size[1], prompt: x.prompt, remove_bg: x.remove_bg }] });
// Falling and drifting sprites for the seasonal themes (the page maps each theme emoji to one of these ids: PX_FALL_MAP in MTG_Lookup_Tool.html)
const FALL = [['leaf', 'a tumbling brown and orange autumn leaf'], ['maple', 'a red maple leaf'], ['greenleaf', 'a fresh green leaf'], ['sprout', 'a small green seedling with two leaves'], ['snowflake', 'a six-armed white snowflake'],
    ['pumpkin', 'a tiny jack-o-lantern with a glowing face'], ['bat', 'a small black bat flapping its wings'], ['ghost', 'a cute white ghost'], ['witch', 'a witch on a broomstick, tiny'], ['broom', 'a straw witch broom'],
    ['moon', 'a golden crescent moon'], ['star', 'a twinkling yellow star'], ['sparkle', 'a white and gold sparkle with four points'], ['gift', 'a small wrapped gift with a red bow'], ['firework', 'a bursting gold and red firework spark'],
    ['confetti', 'a few pieces of colorful confetti and a streamer'], ['dove', 'a small white dove with wings spread'], ['tree', 'a small green pine tree with a star'], ['cookie', 'a frosted gingerbread cookie'], ['cocoa', 'a steaming mug of hot cocoa'],
    ['ribbon', 'a red ribbon bow'], ['snowman', 'a tiny snowman with a scarf'], ['sleigh', 'a small red sleigh'], ['reindeer', 'a small reindeer with antlers'], ['bag', 'a shopping bag with a sale tag'],
    ['tag', 'a price tag on a string'], ['turkey', 'a small cartoon turkey with fanned tail feathers'], ['heart', 'a pink heart with a white shine'], ['shamrock', 'a green three-leaf shamrock'], ['egg', 'a painted pastel easter egg'],
    ['chick', 'a fluffy yellow chick'], ['tulip', 'a pink tulip flower'], ['blossom', 'a pink cherry blossom flower'], ['tie', 'a blue necktie'], ['earth', 'a small blue and green planet earth'],
    ['pie', 'a pumpkin pie slice'], ['envelope', 'a red envelope with a gold coin'], ['lantern', 'a red paper lantern with gold tassels'], ['diya', 'a small glowing clay oil lamp'], ['menorah', 'a gold nine-branch menorah with flames'], ['pi', 'a golden pi symbol with a small shine']];

// The page's glyph map must cover every emoji its themes use (the colored dots are drawn as pixel lights in code) and only name sprites in the list above
{
    const html = fs.readFileSync(path.join(ROOT, 'MTG_Lookup_Tool.html'), 'utf8');
    const m = html.match(/const PX_FALL_MAP = (\{[\s\S]*?\n        \});/);
    if (m) {
        const map = vm.runInNewContext('(' + m[1] + ')');
        const ids = new Set(FALL.map(f => f[0])), used = new Set(Object.values(map));
        const glyphs = new Set([...html.matchAll(/\[\s*'([^'\w\s][^']*)',\s*'(?:fall|rise|drift|twinkle)'\s*\]/g)].map(x => x[1]));
        const dots = new Set(['🔴', '🟢', '🔵', '🟡', '🟣', '⚪', '⚫']);
        const missing = [...glyphs].filter(g => !map[g] && !dots.has(g)), unknown = [...used].filter(i => !ids.has(i)), unused = [...ids].filter(i => !used.has(i));
        if (missing.length || unknown.length || unused.length) { console.error('FALL sprite map out of step with the page:', { missing, unknown, unused }); process.exit(1); }
    }
}
for (const [k, d] of FALL) MANIFEST.assets.push({ id: 'fall-' + k, group: 'site-fall', name: 'falling ' + k, out: `art/site/fall-${k}.png`, kind: 'strip', frame: [32, 32], frames: 4, seed: hash('fall-' + k),
    steps: [{ key: 'gen', style: 'rd_animation__vfx', width: 32, height: 32, prompt: `${d}, slowly spinning, a 4 frame loop, transparent background`, remove_bg: true }] });
// ---- Site lettering, panel frames and Realm background layers (2026-10-21). All optional: the page draws its own pixel font, frames and background in code,
// and uses these files instead when they exist (MTG_Lookup_Tool.html, the Realm / lettering / frames script). ----
const LETTER_ORDER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LETTER_STYLES = [['gold', 'ornate fantasy gold with a dark outline and a bevelled highlight'], ['ember', 'charred black stone edged with glowing orange embers and a few drips of green slime'], ['ice', 'frosted blue ice crystal with white snow resting on top'], ['leaf', 'carved wood wrapped with red and orange autumn leaves'], ['garland', 'green pine garland with red berries and tiny gold lights'], ['bloom', 'green vines with pink and white blossoms']];
for (const [k, d] of LETTER_STYLES) MANIFEST.assets.push({ id: 'letters-' + k, group: 'letters', name: `lettering: ${k} (A-Z, 0-9)`, out: `art/site/letters-${k}.png`, kind: 'stills', frame: [32, 32], stills: [...LETTER_ORDER].map(c => 'g_' + c), seed: hash('letters-' + k),
    steps: [...LETTER_ORDER].map(c => ({ key: 'g_' + c, style: 'rd_plus__low_res', width: 32, height: 32, prompt: `${STYLE}. One single pixel art lettering glyph: only the capital letter "${c}", centered and filling most of the image, ${d}, a bold readable letterform, transparent background, no other characters, no words`, remove_bg: true })) });
const FRAME_STYLES = [['default', 'plain steel with a teal inner edge and a small gem in each corner'], ['halloween', 'twisted dark wood with orange glow, a cobweb and a tiny spider in each corner'], ['autumn', 'brown carved wood with orange and red leaves tucked into each corner'], ['winter', 'pale blue ice with small icicles and a snowflake in each corner'], ['christmas', 'red and green with holly leaves and berries in each corner'], ['spring', 'green vines with pink blossoms in each corner'], ['newyear', 'polished gold with a four-point star and tiny confetti in each corner']];
for (const [k, d] of FRAME_STYLES) MANIFEST.assets.push({ id: 'frame-panel-' + k, group: 'frames', name: `panel frame: ${k}`, out: `art/site/frame-panel-${k}.png`, kind: 'strip', frame: [48, 48], frames: 1, seed: hash('frame-panel-' + k),
    steps: [{ key: 'gen', style: 'rd_plus__ui_element', width: 48, height: 48, prompt: `${STYLE}. A square panel border frame, ${d}. Symmetrical, a thin 12 pixel border all the way around with ornaments only in the four corners, the entire middle is empty and fully transparent so it can be stretched as a 9-slice with 12 pixel corners, no text`, remove_bg: true }] });
const REALM_BIOMES = [['castle', 'a high fantasy kingdom at sunset: a castle with towers on a hill, pine forest, distant mountains'], ['frontier', 'a science fiction frontier at night: a ringed planet, a moon, a distant space station, mesas and crystals'], ['gothic', 'a gothic moonlit night: a huge full moon, bare twisted trees, a chapel spire and gravestones'], ['grove', 'an enchanted glowing grove: giant ancient trees, huge glowing mushrooms, fireflies']];
for (const [k, d] of REALM_BIOMES) for (const [layer, desc, bg] of [['far', 'the far background only: the sky and the most distant mountains or horizon, no foreground', false], ['mid', 'the middle distance only: the main silhouettes on the ground, transparent sky above them', true], ['near', 'the foreground only: dark close-up foliage or rocks along the bottom edge, transparent above them', true]]) MANIFEST.assets.push({ id: `realm-${k}-${layer}`, group: 'realm', name: `Realm ${k}: ${layer}`, out: `art/site/realm-${k}-${layer}.png`, kind: 'strip', frame: [320, 180], frames: 1, seed: hash(`realm-${k}-${layer}`),
    steps: [{ key: 'gen', style: 'rd_plus__environment', width: 320, height: 180, prompt: `${STYLE}. A wide parallax background layer of ${d}: ${desc}. Calm, soft contrast so a web page can sit on top of it, no text, no characters`, remove_bg: bg }] });
fs.writeFileSync(path.join(ROOT, 'docs', 'ascent-art-manifest.json'), JSON.stringify(MANIFEST, null, 1) + '\n');

const out = [];
out.push(`# Planeswalker's Ascent: art prompts for Retro Diffusion

Generated by \`node tests/ascent_art_guide.js\` from \`spellslinger/13g-ascent-art-data.js\`. **Edit the data file, then rerun the script**; don't edit this file by hand.

The game already has placeholders for everything below (an emoji portrait, a colored burst). When a PNG with the right name appears in \`spellslinger/art/\`, the game uses it automatically and the placeholder goes away. Nothing else needs changing.

## Style (add to every prompt)
> ${STYLE}

## File rules
- **Characters:** ${RULES.characters}
- **Effects:** ${RULES.fx}
- **Icons and other sprites:** ${RULES.ui}

## Making the art with the script (recommended)
\`tools/make_art.py\` reads \`docs/ascent-art-manifest.json\` (written by this guide's script) and does everything below for you. It needs Python 3 with \`requests\` and \`Pillow\`.
\`\`\`
export RD_API_KEY=rdpk-...        # your key, in your own terminal; never commit it or paste it into a file
python3 tools/make_art.py                     # free dry run: checks the styles, lists every step and its cost
python3 tools/make_art.py --go --only t1-mick # make one character first (about $0.57) and look at the result
python3 tools/make_art.py --go                # then make everything the game uses now (characters + effects)
\`\`\`
Options: \`--group characters|fx|packs|site|site-fall|ideas|icons|moods|poses|all\` (default: characters, fx, packs, site, site-fall; \`all\` adds the combat effects, icons, expressions and poses; moods and poses are made from each character's own base drawing, so make the characters first), \`--only id1,id2\`, \`--max-spend 20\` (stops before going over, in dollars), \`--force\` (redo finished assets), \`--seed-bump N\` (a new look for the same prompt). Finished PNGs go to \`spellslinger/art/...\`; every step is kept in \`tools/.art-cache/\`, so a rerun only does what is missing and never pays twice for a step. Commit the PNGs, not the cache.

**How a character is made** (22 of them, $0.57 each, about $12.5 in all): RD Pro \`rd_pro__fantasy\` draws the head-and-shoulders portrait at 96 x 96 ($0.18), \`rd_advanced_animation__idle\` animates breathing and a blink from it ($0.14), and \`rd_advanced_animation__custom_action\` animates talking ($0.25). The script keeps 16 frames of each and builds the 1536 x 192 sheet (row 1 idle, row 2 talking). Because both animations start from the same drawing, the character looks the same in every frame.
**How an effect is made** (19 of them, $0.07 each, about $1.35 in all): \`rd_animation__vfx\` (24 to 96 px) makes the animation; the script picks the right number of frames, scales it up with hard pixels if the game wants it bigger (the Planeswalker portal is 128 px), and writes the strip.
**Checked against the API's style list** (the pasted Retro Diffusion API notes, verified 2026-09): the style names, size limits and prices above. The script also asks the live \`/v2/styles/selector\` list first and stops with a clear message if a style or size has changed. Claude can't reach the API from here, so **nothing has been generated yet**: do the one-character test first. If the pixel style isn't what you want, change the style or prompt in \`tests/ascent_art_guide.js\` / the data file and rerun both scripts.

## Prompts to paste by hand (if you use the website instead)
Use the prompt under each asset. For characters, make the standing picture first, then use the website's animation tools on it; the sheet is 2 rows x 4 frames of 96 x 96.

## Counts
- ${CH.length} characters (${CH.filter(c => c.role === 'opponent').length} opponents, ${CH.filter(c => c.role === 'npc').length} helpers)
- ${Object.keys(FX).length} in-game effects (+ ${Object.keys(IDEAS).length} ideas for later)
- ${Object.keys(ICONS).length} icons, banners and backgrounds
`);
out.push('\n## Characters\n');
for (const tier of [1, 2, 3, 0]) {
    const group = CH.filter(c => (c.tier || 0) === tier);
    if (!group.length) continue;
    out.push(`\n### ${tier ? `League ${tier} (${['The Locals', 'Friday Grinders', 'The Pro Circuit'][tier - 1]})` : 'Helpers on the other tabs'}\n`);
    for (const c of group) {
        out.push(`#### ${c.name}${c.boss ? ' (boss)' : ''}: ${c.title}
- **File:** \`spellslinger/art/characters/${c.id}.png\` (1536 x 192, 2 rows x 16 frames of 96 x 96)
- **Placeholder in the game:** ${c.emoji}
- **Look:** ${c.look}
- **Palette:** ${c.palette}
- **Personality:** ${c.mood}

**Retro Diffusion prompt:**
\`\`\`
${charPrompt(c)}
\`\`\`

**Dialogue (placeholder, shown in the game now):**
${['intro', 'win', 'lose', 'taunt', 'tip'].filter(k => c.lines[k]).map(k => `- *${k}${k === 'win' ? ' (you beat them)' : k === 'lose' ? ' (they beat you)' : ''}:* ${[].concat(c.lines[k]).map(l => `"${l}"`).join(' / ')}`).join('\n')}
`);
    }
}
out.push('\n## In-game effects (played while a game runs)\n');
out.push('Lands play a color effect, creatures play a mono-color or multicolor effect when they enter, and each kind of non-creature spell plays its own effect when cast. Played once at 2x over the card (lands, creatures) or the middle of the table (spells).\n');
out.push('| File | Plays when | Size | Frames | Speed |\n|---|---|---|---|---|');
for (const [k, f] of Object.entries(FX)) out.push(`| \`spellslinger/art/fx/${k}.png\` | ${f.hook} | ${f.size} x ${f.size} | ${f.frames} | ${f.fps} fps |`);
out.push('');
for (const [k, f] of Object.entries(FX)) out.push(`#### ${f.label} (\`${k}\`)\n\`\`\`\n${fxPrompt(k, f)}\n\`\`\`\n`);
out.push('\n### Ideas for later (not in the game yet)\n');
for (const [k, f] of Object.entries(IDEAS)) out.push(`- **${f.label}** (\`${k}\`, ${f.size} x ${f.size}, ${f.frames} frames): ${fxPrompt(k, f)}`);
out.push('\n## Booster pack looks (wrapper and opening burst)\n');
out.push('Each pack tier has its own look and opening animation in the game (drawn in CSS today). When these PNGs exist the wrapper art replaces the drawn pack and the burst plays over it while it opens. Wrapper: 96 x 144, one frame. Burst: 12 frames in a strip, each 96 x 96.\n');
for (const [k, L] of Object.entries(PACKS)) out.push(`- **${L.label}** (opens with "${L.anim}"): wrapper \`spellslinger/art/packs/${k}.png\`: ${L.wrap}. Burst \`spellslinger/art/packs/${k}-open.png\`: ${L.open}.`);
out.push('\n## Expressions and win / lose poses (groups `moods` and `poses`, one each per opponent)\n');
out.push('Made from each opponent\'s own base drawing (the character must be made first), so they stay on-model. **Expressions** (`spellslinger/art/moods/<id>.png`, 3 stills of 96 x 96: happy, angry, worried, $0.75 each, 18 = about $13.5) show on the opponent\'s bar in Planeswalker\'s Ascent games as the game turns (worried at low life or facing a big board, angry after a hard hit, happy when ahead). **Poses** (`spellslinger/art/poses/<id>.png`, 1536 x 192: row 1 victory, row 2 defeat, 16 frames each, $0.50 each, 18 = about $9) play on the result screen (you win: its defeat pose; you lose: its victory pose).\n');
for (const m of MOODS) out.push(`- **${m[0]}**: ${m[1]}`);
for (const q of POSES) out.push(`- **${q[0]} pose**: ${q[1]}`);
out.push('\n## Rank badges, backdrops, card back, phase icons (group `icons`)\n');
out.push('Trophy milestone badges (`badge-3` to `badge-75`), tier backdrops, the table mat, the card back, map markers, phase icons, tab icons, currency icons, rarity gems and upgrade icons are all in the Icons section below; the game uses each one in its screen as soon as the PNG exists in `spellslinger/art/ui/`. The five mana gems and seven type icons are generic (not game symbols): they appear on the starter-color buttons and the card dialog.\n');
out.push('\n## Site lettering, panel frames and the Realm background (groups `letters`, `frames`, `realm`)\n');
out.push('The MTG tool already draws these in code: a pixel font for the page title (A-Z, 0-9 and common punctuation, restyled per season: slime drips for Halloween, snow caps for winter, sparkles for Christmas), 9-slice panel frames and a banner frame with seasonal corner ornaments, and **the Realm**, a slowly drifting pixel background that changes between four fantasy worlds (a castle kingdom, a sci-fi frontier, a gothic moonlit night, an enchanted grove) and takes its colors from the season. Generated art replaces the drawn versions when the files exist in `art/site/`. **Lettering is an experiment**: image models often draw wrong or garbled letters, so each glyph is its own image (36 per style, about $2.20 a style); look at `letters-gold` first (`py tools\\make_art.py --go --group letters --only letters-gold`) and only keep it if every letter reads. Preview the Realm without art with `?realm=castle`, `frontier`, `gothic`, `grove` (or `off`).\n');
for (const [k, d] of LETTER_STYLES) out.push(`- **letters-${k}** (\`art/site/letters-${k}.png\`, 36 glyphs of 32 x 32 in one row, A-Z then 0-9): ${d}`);
for (const [k, d] of FRAME_STYLES) out.push(`- **frame-panel-${k}** (\`art/site/frame-panel-${k}.png\`, 48 x 48, 9-slice with 12 px corners): ${d}`);
for (const [k, d] of REALM_BIOMES) out.push(`- **realm-${k}-far / -mid / -near** (\`art/site/realm-${k}-<layer>.png\`, 320 x 180 each): ${d}`);
out.push('\n## Website art (MTG lookup tool): frames, cursor, click\n');
out.push('Drawn in code today from the theme colors; when these PNGs exist in `art/site/` the page uses them instead (the **Cardy** sheet replaces his drawn version, the **loading card** (8 frames of 48 x 48) shows under every loading message, and each **scene** (256 x 128) is drawn behind the page title for its season at Effects: Full, mirrored tile to tile; cursor arrow and hand 32 x 32, click burst 8 frames of 64 x 64, card frames 64 x 64 as 9-slice with 12 px corners). Make them with `py tools\\make_art.py --go --group site`.\n');
out.push(`- **Cardy, the helper card** (\`art/site/cardy.png\`, 1536 x 576: 6 rows (idle, wave, talk, think, cheer, sleep) x 16 frames of 96 x 96, made from one base drawing): ${CARDY_SUBJECT}`);
for (const x of SITE) out.push(`- **${x.label}** (\`art/site/${x.id}.png\`, ${x.size[0]} x ${x.size[1]}${x.frames > 1 ? `, ${x.frames} frames` : ''}, style \`${x.style}\`): ${x.prompt}`);
out.push('\n### Seasonal falling sprites for the background (group `site-fall`, 32 x 32, 4 frames each: the page draws them in place of the pixelated emoji for each theme)\n');
for (const [k, d] of FALL) out.push(`- **${k}**: ${d}, 32 x 32, 4 frames, \`art/site/fall-${k}.png\``);
out.push('\n## Icons, banners and backgrounds\n');
const groups = {};
for (const [k, i] of Object.entries(ICONS)) (groups[i.group] = groups[i.group] || []).push([k, i]);
for (const [g, list] of Object.entries(groups)) {
    out.push(`\n### ${g}\n`);
    for (const [k, i] of list) out.push(`- **${i.label}** (\`spellslinger/art/ui/${k}.png\`, ${i.size} x ${i.size}${i.frames > 1 ? `, ${i.frames} frames` : ''}): ${iconPrompt(k, i)}`);
}
fs.writeFileSync(path.join(ROOT, 'docs', 'ascent-art-prompts.md'), out.join('\n') + '\n');
console.log(`wrote docs/ascent-art-prompts.md: ${CH.length} characters, ${Object.keys(FX).length} effects, ${Object.keys(ICONS).length} icons`);
