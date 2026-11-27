# Pixel art for Planeswalker's Ascent

Drop PNG files here and the game uses them automatically (it shows a placeholder until a file exists):

- `characters/<id>.png`: 1536 x 192 sprite sheets (2 rows of 16 frames, 96 x 96 head-and-shoulders portraits each): row 1 idle, row 2 talking
- `fx/<kind>.png`: horizontal animation strips played over cards while a game runs
- Make them with `tools/make_art.py` (see docs/ascent-art-prompts.md).
- `ui/<id>.png`: icons, banners and backgrounds (listed in the guide; not all are wired into screens yet)

The full list with sizes and Retro Diffusion prompts is `docs/ascent-art-prompts.md` (made by `node tests/ascent_art_guide.js` from `spellslinger/13g-ascent-art-data.js`).

## New art (2026-11-27 onward, Antigravity)

The Gilded Arcana art for themes, sleeves, playmats, companions, icons and more is listed in `docs/spellslinger-asset-manifest.json`
(plan: `docs/spellslinger-asset-plan.md`). Check files with `node tests/asset_check.js` before committing; shrink with
`python3 tools/optimize_art.py`. `_style/` holds the Batch 0 masters; the game doesn't read it.
