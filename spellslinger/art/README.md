# Pixel art for Planeswalker's Ascent

Drop PNG files here and the game uses them automatically (it shows a placeholder until a file exists):

- `characters/<id>.png`: 256 x 192 sprite sheets (2 rows of 4 frames, 64 x 96 each): row 1 idle, row 2 talking
- `fx/<kind>.png`: horizontal animation strips played over cards while a game runs
- Make them with `tools/make_art.py` (see docs/ascent-art-prompts.md).
- `ui/<id>.png`: icons, banners and backgrounds (listed in the guide; not all are wired into screens yet)

The full list with sizes and Retro Diffusion prompts is `docs/ascent-art-prompts.md` (made by `node tests/ascent_art_guide.js` from `spellslinger/13g-ascent-art-data.js`).
