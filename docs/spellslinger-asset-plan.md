# Spellslinger Duels: new art and the Cosmetics Locker (plan)

Owner's request (2026-11-27): "a game plan to create all new assets for all of Spellslinger Duels that Antigravity can get ahold of and generate, except for code that you could write better. Themes, sleeves, icons, assets that you put on the play area that move and you can buy with coins to unlock."

This file is the plan and the hand-off brief. **Antigravity makes pictures; Claude writes the code.** Antigravity reads this file, generates the files listed in each batch at the exact sizes and paths given, checks them with `node tests/asset_check.js` (Claude writes this first), and commits them. Claude wires each file into the game so nothing breaks while a file is missing: every slot keeps a drawn fallback, as the current art does.

Nothing is built yet. The decisions marked **(owner)** come first.

---

## 1. Who does what

| Antigravity (image generation) | Claude (code) |
|---|---|
| Paintings: playmats, backgrounds, banners, loading screens | Every animation: motion, timing, particles, parallax, glows, shimmer |
| Card sleeves (card backs) | The Cosmetics Locker: buying, owning, equipping, previews |
| Icons (phases, keywords, types, rarities, currencies, menus, counters) | The companion engine (how pets move and react to the game) |
| Companions as **separate still parts** (body, head, wings, tail...) plus a few expressions | Theme colors (design tokens), button and panel styling, fonts |
| Theme textures: panel frames (9-slice), panel fill, dividers, button skins | Loading each picture only when it is needed, fallbacks, size budget |
| Pack wrappers, emote stickers, avatar portraits, victory and defeat banners | The asset checker, tests, screenshots at 360 / 768 / 1280px |
| Small effect textures (one spark, one smoke puff, one glow ring) | Effects built from those textures (bursts, trails, rings) |

**Rule of thumb:** if it moves, Antigravity draws it still and in parts, and Claude moves it. Image models don't keep a character steady across frames, so we don't ask Antigravity for frame-by-frame animation. The one exception: the existing pixel sprites from Retro Diffusion (`tools/make_art.py`), which stay where they are.

---

## 2. Style bible (do this first: one sheet the owner approves)

**Decision (owner): one art style for everything new.** Recommended: **"Gilded Arcana"**, the look of the current `arena-mat.jpg`. Painted, rich, warm light, carved stone and brushed gold, deep jewel colors, a soft glow on magic, readable shapes at small sizes. The pixel-art Ascent characters can stay pixel (they're a separate campaign) or be redone later in the same style.

The style sheet Antigravity makes first (`spellslinger/art/_style/`, not used by the game):
- one playmat, one sleeve, eight icons, one companion in parts, one panel frame;
- a color strip for each of the five mana colors plus colorless and gold, used on every asset that needs a color.

**Hard rules for every asset (legal and practical):**
- **Original designs only.** No Wizards of the Coast or Magic logos, card frames, set symbols, the planeswalker symbol, official mana symbols, card art or real characters. Mana colors appear as **our own gems** (a white sun gem, a blue droplet crystal, a black skull crystal... designed fresh), never the official symbols.
- No real brands, no store names, no Moonshot branding (Spellslinger stands alone).
- No text baked into pictures (the game writes all words), except a banner where the brief asks for it.
- Transparent background (PNG with alpha) for everything except backgrounds and playmats.
- Readable at the smallest size it's shown (icons at 24px, sleeves at 60px wide).
- Keep the main subject inside the safe zone given for each kind.

---

## 3. The catalog

Sizes are what to save. Code scales down; never deliver smaller. Paths are under `spellslinger/art/`. Each asset has an id; the id is the file name.

### 3.1 Themes (unlockable)
A theme restyles the whole game: colors (Claude, as design tokens), plus Antigravity's textures:

| File | Size | Notes |
|---|---|---|
| `themes/<id>/bg.jpg` | 1920 x 1080 | Page background behind everything; calm, low contrast, dark in the middle third so text reads. ≤ 450 KB |
| `themes/<id>/bg-phone.jpg` | 1080 x 1920 | Portrait version of the same scene |
| `themes/<id>/frame.png` | 96 x 96 | Panel frame, 9-slice with 24px corners; centre fully transparent |
| `themes/<id>/fill.png` | 256 x 256 | Seamless panel texture (tiles), very subtle |
| `themes/<id>/button.png` | 96 x 48 | Button skin, 9-slice with 16px corners |
| `themes/<id>/divider.png` | 512 x 32 | Ornament line between sections |
| `themes/<id>/banner.jpg` | 1600 x 400 | Home hero banner; leave the left half calm for the title |

Starter list (12): Gilded Sanctum (free, the default), Emberforge, Tidecrown, Grave Lantern, Verdant Hollow, Dawnspire (one per color), Frostveil, Clockwork Bazaar, Starfall Observatory, Harvest Moon, Yuletide Hall, Void Rift. The current seven Looks keep working (they're color-only).

### 3.2 Card sleeves (unlockable)
What your library, hand backs and face-down cards look like. Opponents use their own sleeves (each computer character gets one).

| File | Size | Notes |
|---|---|---|
| `sleeves/<id>.png` | 630 x 880 | Card shape (63 : 88), corners rounded 28px with transparent corners. Design must read at 60px wide: one strong central motif plus a border |
| `sleeves/<id>-fx.png` *(mythic only)* | 630 x 880 | A separate transparent layer (runes, stars, flames) that Claude animates on top: shimmer, slow spin or pulse |

Starter list (30): 8 common (solid colors with a simple embossed pattern), 10 rare (illustrated: a dragon coil, a koi pair, an owl, a lantern street...), 8 epic (gold-foil look, full illustration), 4 mythic (with an `-fx` layer: Phoenix Rebirth, Astral Tide, Lich's Sigil, World Tree).

### 3.3 Playmats (unlockable)
The table you play on. The six living battlefields exist now; only Sanctum has a painting. New mats are paintings **delivered in layers** so Claude can move parts:

| File | Size | Notes |
|---|---|---|
| `mats/<id>/base.jpg` | 1920 x 1080 | The painting. **Centre 60% x 70% is a calm playing surface** (cards sit there); decoration lives on the edges and corners |
| `mats/<id>/base-phone.jpg` | 1080 x 1920 | Portrait version, same rules |
| `mats/<id>/layer-*.png` | 1920 x 1080 | Optional transparent layers with the moving parts kept separate: `layer-water`, `layer-clouds`, `layer-fire`, `layer-foliage`, `layer-lights` (2 to 4 per mat). Same canvas, so they line up |
| `mats/<id>/thumb.jpg` | 480 x 270 | Locker preview |

Starter list (12): repaint the six existing ones (Sanctum of Gold, Radiant Citadel, Astral Tidepool, Shadowed Crypt, Volcanic Caldera, Whispering Wildwood) so they all have real art, then six new: Sky Harbor (airships), Clockwork Workshop, Moonlit Shrine, Sunken Library, Desert Oasis, Frozen Throne.

Claude animates the layers (cloud drift, water ripple and caustics, flame flicker, swaying leaves, glowing windows) and keeps the moving critters already in `08h-arena-life.js`.

### 3.4 Table companions (unlockable; "assets on the play area that move")
A small creature or object that lives in your corner of the table and reacts to the game: it idles, perks up when you cast a spell, cheers when you deal damage, flinches when you're hit, celebrates a win and droops in a loss. It never covers cards (it sits in the bottom-left corner on desktop, on top of your life medallion on phones), and it can be turned off.

**Delivered as parts, not animation:**

| File | Size | Notes |
|---|---|---|
| `companions/<id>/body.png` | 512 x 512 | Body without the moving parts, on a transparent canvas, feet at the bottom centre |
| `companions/<id>/head.png` | 512 x 512 | Same canvas, head only, lined up with the body |
| `companions/<id>/<part>.png` | 512 x 512 | Each moving part on the same canvas: `wing-l`, `wing-r`, `tail`, `arm-l`, `arm-r`, `flame`, `ears` (whatever the creature has) |
| `companions/<id>/face-<mood>.png` | 512 x 512 | Head variants: `happy`, `angry`, `scared`, `sleepy`, `cheer` (same position as `head.png`) |
| `companions/<id>/thumb.png` | 128 x 128 | Locker icon |

Claude then makes it alive: breathing, blinking, wing flaps, tail sway, little hops, looking at the card you're pointing at, reactions tied to game events, and a short celebration on a win.

Starter list (16): Ember Drake whelp, Tidepool Axolotl, Lantern Wisp, Moss Golem, Brass Owl, Star Fox, Mimic Chest, Ink Imp, Crystal Tortoise, Storm Ferret, Sun Lion cub, Bone Raven, Mushroom Sprite, Clockwork Beetle, Frost Kitsune, Void Jelly.

**Desk props (smaller unlocks, also on the table):** a life counter skin (`props/life-<id>.png`, 256 x 256 dial or d20 that Claude spins), a hourglass that turns during your turn, a candle that burns down, a crystal ball that clouds when an opponent thinks. Same rule: stills or parts only.

### 3.5 Icons (not unlockable; they replace the emoji everywhere)
All 128 x 128, transparent, one consistent frame shape (a round gold-rimmed medallion), under 30 KB each. Folder `ui/`. Current filled ones stay until replaced.

| Group | Ids | Count |
|---|---|---|
| Turn phases | `phase-untap`, `-upkeep`, `-draw`, `-main`, `-combat`, `-attack`, `-block`, `-damage`, `-main2`, `-end` | 10 |
| Keywords | `kw-flying`, `-first-strike`, `-double-strike`, `-trample`, `-deathtouch`, `-lifelink`, `-vigilance`, `-haste`, `-hexproof`, `-indestructible`, `-menace`, `-reach`, `-defender`, `-flash`, `-ward`, `-protection`, `-prowess`, `-infect`, `-toxic` | 19 |
| Card types | `type-creature`, `-instant`, `-sorcery`, `-artifact`, `-enchantment`, `-planeswalker`, `-land`, `-battle`, `-token` | 9 |
| Rarities | `rarity-common`, `-uncommon`, `-rare`, `-mythic`, `-special` | 5 |
| Mana gems (our own design) | `gem-W`, `-U`, `-B`, `-R`, `-G`, `-C`, `-multi` | 7 |
| Currencies | `cur-coin`, `cur-aether`, `cur-cash`, `cur-salvage` | 4 |
| Menus | `nav-home`, `-play`, `-packs`, `-decks`, `-draft`, `-shop`, `-campaign`, `-rules`, `-locker`, `-settings`, `-records` | 11 |
| Game actions | `act-attack`, `-block`, `-pass`, `-end-turn`, `-concede`, `-deal`, `-ask`, `-taunt`, `-compliment` | 9 |
| Counters and zones | `ctr-plus`, `-minus`, `-loyalty`, `-charge`, `-poison`, `-energy`, `zone-library`, `-graveyard`, `-exile`, `-command` | 10 |
| Moods (for the bots) | `mood-calm`, `-happy`, `-angry`, `-worried`, `-confident`, `-salty` | 6 |

About 90 icons in all.

### 3.6 Everything else

| What | Files | Size | Unlockable? |
|---|---|---|---|
| Player avatars | `avatars/<id>.png` | 512 x 512, round-safe (subject inside the middle 80% circle) | Yes (24 to start; 6 free) |
| Computer characters (the 9 personalities: Greg, Marcus, Sarah, Leo, Trevor, Sam, Arthur, Brenda, Luke) | `bots/<id>.png` plus `bots/<id>-<mood>.png` for 5 moods | 512 x 512 | No |
| Emote stickers (shown in a bubble over your seat) | `emotes/<id>.png` | 256 x 256 | Yes (24; 6 free: GG, Thinking, Nice, Oops, Wow, Hello) |
| Pack wrappers (7 looks) | `packs/<look>.png` | 384 x 576 (the code still splits flap and body at the top 22%) | No |
| Victory and defeat banners | `ui/banner-win.png`, `ui/banner-lose.png`, `ui/banner-draw.png` | 1200 x 400 | Win celebrations unlockable (see 3.7) |
| Loading screens | `ui/loading-<n>.jpg` | 1920 x 1080 | No (6, picked at random) |
| Mode banners (Sandbox, Campaign, Shop Simulator) | `ui/mode-<mode>.jpg` | 1200 x 300 | No |
| Board pieces | `table/<set>/deck-tray.png`, `graveyard.png`, `exile-portal.png`, `command-plinth.png` | 512 x 512 | Yes, as "table sets" (6) |
| Effect textures | `fx2/spark.png`, `smoke.png`, `glow-ring.png`, `shard.png`, `ember.png`, `droplet.png`, `leaf.png`, `rune.png` | 128 x 128 | No |

### 3.7 Win celebrations (unlockable)
What happens on the result screen when you win: fireworks, a dragon flyover, a rain of coins, a burst of petals, a phoenix rising. Antigravity draws the stills (the dragon silhouette, a coin, a petal, a firework shell); Claude builds the animation. 8 to start.

---

## 4. The Cosmetics Locker (Claude's code)

**Where it lives (owner):** recommended inside the existing **🎨 Look** panel, which becomes "🎨 Locker" with tabs for Themes, Sleeves, Playmats, Companions, Props, Avatars, Emotes, Celebrations. No new top-level tab. (Alternative: a "Cosmetics" counter inside the 🏪 Shop.)

What it does:
- Shows every item with a preview (mats and themes preview live behind the panel; companions play their idle; sleeves show front and a 3D flip).
- **Buy with coins** (no real money, ever; the page says so). Owned items can be equipped per slot; sleeves can also be set per deck.
- Rarity tiers and prices: Common 300, Rare 1,000, Epic 3,000, Legendary 8,000 coins. A win pays 150 (200 in Commander), so a Rare is about 7 wins and a Legendary about 50. Prices are one table, easy to tune.
- A few free items in each slot so everyone starts with choices, and some unlocked by milestones (first win, 10 Commander wins, a draft trophy, beating each Campaign boss) instead of coins.
- **Which coins (owner):** recommended the main bucket (Campaign and Shop Simulator share it). Sandbox coins can be added for free, so if Sandbox coins could buy cosmetics everything would be free there. Alternative: everything unlocked in Sandbox, bought elsewhere.
- Saved in the player's profile (`profile.cosmetics` already exists with `sleeves` and `playmat`; it grows to `{ owned: [...], equipped: {...}, deckSleeves: {...} }`, filled in on old profiles).
- Opponents get their own looks: each computer character has a fixed sleeve, companion and favourite playmat, so tables feel different.

Engine pieces Claude builds (before any art arrives, with drawn placeholders):
1. `COSMETICS` registry (data file `spellslinger/data/cosmetics.json`: id, slot, rarity, price, name, files, unlock rule).
2. Locker screen, buying, equipping, per-deck sleeves.
3. Sleeve rendering on the library pile, hand backs, opponents' hands, face-down cards, the pack reveal.
4. Playmat layer loader (base plus animated layers) on top of the current battlefield system (`08g-arena-mats.js`, `08h-arena-life.js`).
5. Companion engine: puppet rig from parts (pivot points read from the part images' bounding boxes), idle loop, reactions on game events (`fire` events: cast, damage, life gain, loss, win), off switch, reduced-motion still pose.
6. Theme loader: token set plus the textures from 3.1.
7. `tests/asset_check.js`: checks every file in the manifest exists at the right size, has transparency where required, and fits its size budget; lists what is missing. Antigravity runs it before each commit.
8. A size budget: a game page should load under about 3 MB of art at start; everything else loads only when it is shown.

---

## 5. How Antigravity works through it

1. Claude writes `docs/spellslinger-asset-manifest.json` from this plan (id, path, size, transparent, safe zone, prompt) and `tests/asset_check.js`.
2. Antigravity reads the manifest, generates one batch, saves to the paths, runs `node tests/asset_check.js --batch <n>`, fixes what fails (resize, crop, remove background), and commits to the working branch with a message naming the batch.
3. Claude wires the batch in, screenshots it at 360 / 768 / 1280px, and the owner looks at it on the fresh-copy link.
4. Anything the owner dislikes is redone in the next batch. Old versions are kept in `_old/` (the rule the art scripts already follow), never deleted.

Prompt pattern for every asset (Antigravity fills the subject):
> "Gilded Arcana style: painted fantasy game art, warm rim light, brushed gold and carved stone accents, deep jewel colors, clean readable silhouette. [Subject]. [Composition: centered / edges only / transparent background]. No text, no logos, no card frames, no real-world symbols."

---

## 6. Batches

| Batch | What | Count | Who goes first |
|---|---|---|---|
| 0 | Style sheet (section 2) | ~15 | Antigravity, then the owner approves |
| 1 | Code foundation: manifest, checker, Locker with placeholders, sleeve rendering, companion engine with a drawn test creature | — | Claude (can run while batch 0 is reviewed) |
| 2 | Core icons (phases, keywords, types, rarities, gems, currencies, menus) | ~65 | Antigravity |
| 3 | 12 sleeves + 4 playmats (repaint Sanctum, Caldera, Tidepool, Wildwood with layers) | ~30 | Antigravity, Claude animates the layers |
| 4 | 4 companions in parts + 3 desk props | ~45 | Antigravity, Claude rigs them |
| 5 | 4 themes (Gilded Sanctum, Emberforge, Tidecrown, Grave Lantern) | ~28 | Antigravity, Claude tokens |
| 6 | 9 computer characters with moods, 12 avatars, 12 emotes | ~78 | Antigravity |
| 7 | The rest of the starter lists: sleeves, mats, companions, themes, props, celebrations, table sets, banners, loading screens, pack wrappers | ~150 | Both |
| 8 | Balance prices, milestone unlocks, opponents' fixed looks, tests, About log | — | Claude |

About 400 images in all. Each batch ends playable: nothing waits for the last batch.

---

## 7. Decisions for the owner

1. **Art style:** one style for all new art ("Gilded Arcana", like the current Sanctum mat)? Keep the pixel Ascent characters as they are?
2. **Locker placement:** inside the 🎨 Look panel (recommended), or inside the Shop?
3. **Which coins buy cosmetics:** main bucket only (recommended), or everything free in Sandbox?
4. **Prices:** 300 / 1,000 / 3,000 / 8,000 coins OK?
5. **Companions:** bottom-left corner of your side, switchable off. OK?
6. **Start with batch 0** (the style sheet) and batch 1 (Claude's code) at the same time?
