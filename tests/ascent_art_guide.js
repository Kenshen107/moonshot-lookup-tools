// Writes docs/ascent-art-prompts.md from spellslinger/13g-ascent-art-data.js: every character, effect and icon of
// Planeswalker's Ascent with a copy-and-paste prompt for Retro Diffusion, its size, frame count and the file path the game looks for.
//   node tests/ascent_art_guide.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const data = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'spellslinger', '13g-ascent-art-data.js'), 'utf8') + '\n;({ STYLE: ASCENT_ART_STYLE, RULES: ASCENT_ART_RULES, CH: ASCENT_CHARACTERS, FX: ASCENT_FX, IDEAS: ASCENT_FX_IDEAS, ICONS: ASCENT_ICONS })');
const { STYLE, RULES, CH, FX, IDEAS, ICONS } = data;
const PACKS = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'spellslinger', '12b-pack-looks.js'), 'utf8') + '\n;PACK_LOOKS');

const charPrompt = c => `${STYLE}. Close-up head-and-shoulders portrait sprite sheet (a dialogue portrait) of ${c.look}. Palette: ${c.palette}. Expression: ${c.mood}. The face is large and centered, facing the viewer, filling most of the frame, shoulders cropped by the bottom edge. Sheet layout: 2 rows of 4 frames, each frame 96 x 96 pixels. Row 1: idle loop (gentle breathing, a blink). Row 2: talking loop (mouth opening and closing, eyebrows moving a little). Identical framing in every frame.`;
const fxPrompt = (k, f) => `${STYLE}. Animated effect, ${f.frames} frames in one horizontal strip, each frame ${f.size} x ${f.size} pixels, centered, transparent background: ${f.prompt}.`;
const iconPrompt = (k, i) => `${STYLE}. ${i.frames > 1 ? `Animated loop of ${i.frames} frames in a horizontal strip, each frame` : 'Single sprite,'} ${i.size} x ${i.size} pixels: ${i.prompt}.`;

// ---- Machine-readable manifest for tools/make_art.py (styles checked against the Retro Diffusion API catalog, 2026-09) ----
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000; };
const charSubject = c => `Close-up head-and-shoulders portrait (a dialogue portrait) of ${c.look}. Show only what is visible from the chest up. The face is large and centered, filling most of the frame, facing the viewer with an expressive face, shoulders cropped by the bottom edge. Palette: ${c.palette}. Expression: ${c.mood}. Mouth closed in a relaxed, small friendly smile. Plain flat background, no text`;
const MANIFEST = { generated: 'by tests/ascent_art_guide.js; do not edit by hand', assets: [] };
for (const c of CH) MANIFEST.assets.push({
    id: c.id, group: 'characters', name: c.name, out: `spellslinger/art/characters/${c.id}.png`, kind: 'sheet', frame: [96, 96], cols: 4, rows: 2, seed: hash(c.id),
    steps: [
        { key: 'base', style: 'rd_pro__fantasy', width: 96, height: 96, prompt: charSubject(c), remove_bg: true },
        { key: 'idle', style: 'rd_advanced_animation__idle', width: 96, height: 96, prompt: 'gentle breathing and one slow blink only, the mouth stays closed and completely still, the head barely moves, shoulders stay in place', frames_duration: 4, from: 'base' },
        { key: 'talk', style: 'rd_advanced_animation__custom_action', width: 96, height: 96, prompt: 'talking: the mouth opens and closes, the eyebrows move a little and the head tilts slightly, shoulders stay in place', frames_duration: 4, from: 'base' }
    ]
});
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
    MANIFEST.assets.push({ id: 'pack-' + k + '-open', group: 'packs', name: L.label + ' opening burst', out: `spellslinger/art/packs/${k}-open.png`, kind: 'strip', frame: [96, 96], frames: 8, seed: hash('pack-' + k + '-open'),
        steps: [{ key: 'gen', style: 'rd_animation__vfx', width: 96, height: 96, prompt: L.open, remove_bg: true }] });
}
// ---- Website art (MTG lookup tool): pixel card frames, cursor and click burst; PNGs go in art/site/ and are used automatically ----
const SITE = [
    ...[['common', 'plain grey steel'], ['uncommon', 'polished silver-blue'], ['rare', 'bright gold'], ['mythic', 'fiery orange-red with tiny flame edges'], ['special', 'magenta and violet with star studs']].map(([r, d]) => ({
        id: 'frame-' + r, label: `${r} card frame`, size: [64, 64], frames: 1, style: 'rd_plus__ui_element', remove_bg: true,
        prompt: `a square ornate trading card border frame in ${d}, symmetrical, a thin bevelled band around the edge with small corner studs, the entire middle is empty and fully transparent, designed to be stretched as a 9-slice with 12 pixel corners, no text` })),
    { id: 'cursor-arrow', label: 'mouse cursor, arrow', size: [32, 32], frames: 1, style: 'rd_plus__low_res', remove_bg: true,
      prompt: 'a pixel art mouse pointer arrow, cream white fill with a thick dark outline and one small teal highlight pixel, pointing up and to the left, the tip at the very top-left corner of the image' },
    { id: 'cursor-hand', label: 'mouse cursor, pointing hand', size: [32, 32], frames: 1, style: 'rd_plus__low_res', remove_bg: true,
      prompt: 'a pixel art pointing hand cursor, cream white glove with a thick dark outline, the index finger pointing straight up at the top of the image' },
    { id: 'click-burst', label: 'click burst', size: [64, 64], frames: 8, style: 'rd_animation__vfx', remove_bg: true,
      prompt: 'a tiny satisfying click burst: a bright cyan and white ring of pixels expanding with a few gold sparks flying outward and fading, centered' }
];
for (const x of SITE) MANIFEST.assets.push({ id: x.id, group: 'site', name: x.label, out: `art/site/${x.id}.png`, kind: 'strip', frame: x.size, frames: x.frames, seed: hash(x.id),
    steps: [{ key: 'gen', style: x.style, width: x.size[0], height: x.size[1], prompt: x.prompt, remove_bg: x.remove_bg }] });
const FALL = [['leaf', 'a tumbling orange autumn maple leaf'], ['pumpkin', 'a tiny jack-o-lantern'], ['bat', 'a small flapping black bat'], ['snowflake', 'a six-armed white snowflake'], ['ornament', 'a shiny red hanging ornament ball'],
    ['gift', 'a small wrapped gift with a bow'], ['heart', 'a pink heart'], ['shamrock', 'a green shamrock'], ['petal', 'a pink cherry blossom petal'], ['spark', 'a gold firework spark'], ['star', 'a twinkling yellow star'], ['candy', 'a candy cane']];
for (const [k, d] of FALL) MANIFEST.assets.push({ id: 'fall-' + k, group: 'site-fall', name: 'falling ' + k, out: `art/site/fall-${k}.png`, kind: 'strip', frame: [32, 32], frames: 4, seed: hash('fall-' + k),
    steps: [{ key: 'gen', style: 'rd_animation__vfx', width: 32, height: 32, prompt: `${d}, slowly spinning, a 4 frame loop, transparent background`, remove_bg: true }] });
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
Options: \`--group characters|fx|ideas|icons\` (default: characters, fx and packs; ideas and icons are not in the game yet), \`--only id1,id2\`, \`--max-spend 20\` (stops before going over, in dollars), \`--force\` (redo finished assets), \`--seed-bump N\` (a new look for the same prompt). Finished PNGs go to \`spellslinger/art/...\`; every step is kept in \`tools/.art-cache/\`, so a rerun only does what is missing and never pays twice for a step. Commit the PNGs, not the cache.

**How a character is made** (22 of them, $0.57 each, about $12.5 in all): RD Pro \`rd_pro__fantasy\` draws the head-and-shoulders portrait at 96 x 96 ($0.18), \`rd_advanced_animation__idle\` animates breathing and a blink from it ($0.14), and \`rd_advanced_animation__custom_action\` animates talking ($0.25). The script keeps 4 frames of each and builds the 384 x 192 sheet (row 1 idle, row 2 talking). Because both animations start from the same drawing, the character looks the same in every frame.
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
- **File:** \`spellslinger/art/characters/${c.id}.png\` (384 x 192, 2 rows x 4 frames of 96 x 96)
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
out.push('Each pack tier has its own look and opening animation in the game (drawn in CSS today). When these PNGs exist the wrapper art replaces the drawn pack and the burst plays over it while it opens. Wrapper: 96 x 144, one frame. Burst: 8 frames in a strip, each 96 x 96.\n');
for (const [k, L] of Object.entries(PACKS)) out.push(`- **${L.label}** (opens with "${L.anim}"): wrapper \`spellslinger/art/packs/${k}.png\`: ${L.wrap}. Burst \`spellslinger/art/packs/${k}-open.png\`: ${L.open}.`);
out.push('\n## Website art (MTG lookup tool): frames, cursor, click\n');
out.push('Drawn in code today from the theme colors; when these PNGs exist in `art/site/` the page uses them instead (cursor arrow and hand 32 x 32, click burst 8 frames of 64 x 64, card frames 64 x 64 as 9-slice with 12 px corners). Make them with `py tools\\make_art.py --go --group site`.\n');
for (const x of SITE) out.push(`- **${x.label}** (\`art/site/${x.id}.png\`, ${x.size[0]} x ${x.size[1]}${x.frames > 1 ? `, ${x.frames} frames` : ''}, style \`${x.style}\`): ${x.prompt}`);
out.push('\n### Falling sprites for the background (optional group `site-fall`, not used by the page yet; today the emoji are turned into pixel sprites in code)\n');
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
