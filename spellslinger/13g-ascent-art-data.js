// Planeswalker's Ascent: characters, their placeholder dialogue and the art manifest (sprites, effects, icons).
// Data only (no code), so `node tests/ascent_art_guide.js` can read it and write docs/ascent-art-prompts.md for Retro Diffusion.
// Art files go in spellslinger/art/ at the paths below; until a file exists the game shows a placeholder.
const ASCENT_ART_STYLE = '16-bit fantasy trading-card-game pixel art, crisp 1px dark outline, limited 16-color palette, soft top-left light, no text, no watermark, transparent background';
const ASCENT_ART_RULES = {
    characters: 'One PNG per character at spellslinger/art/characters/<id>.png. A sprite sheet with 2 rows of 4 frames, each frame 64 x 96 px (so the sheet is 256 x 192). Row 1 = idle loop (breathing, blinking). Row 2 = talking loop (mouth moving, a hand gesture). Same pose and framing in every frame, feet on the bottom edge, facing the viewer.',
    fx: 'One PNG per effect at spellslinger/art/fx/<id>.png: a single horizontal strip of frames, each frame the size listed. The game plays it once at 2x, pixelated, over the card.',
    ui: 'One PNG per icon at spellslinger/art/ui/<id>.png at the size listed (a single frame unless "frames" is listed, then a horizontal strip).'
};

// ---- Characters ----
// lines: intro (before the match), win (you beat them), lose (they beat you), tip (a hint about their deck), taunt (during or after a hard turn)
const ASCENT_CHARACTERS = [
    { id: 't1-mick', name: 'Mossback Mick', title: 'Moss-covered stomper', role: 'opponent', tier: 1, emoji: '🐗', accent: 'var(--mana-G)',
      look: 'a broad, friendly young man in his early twenties with a green hooded poncho grown over with moss, bark-brown boots, a wooden club resting on one shoulder, messy brown hair, a gap-toothed grin',
      palette: 'forest greens, bark browns, a spot of warm skin tone', mood: 'cheerful and proud, a gentle giant',
      lines: { intro: ['Big things win games. Big things are my whole plan!', 'Hey there! Wanna see my bear? He is very large.'], win: ['Huh. You were bigger than I thought. Good game!', 'Aw, my big guys. Next time, buddy.'], lose: ['Stomp stomp! Better luck next time!', 'Told you. Big things.'], tip: 'He plays big green creatures with few tricks. Fliers go right over his head.', taunt: ['My guys are getting bigger!', 'Is that all you got? Mine are bigger.'] } },
    { id: 't1-annie', name: 'Candle Annie', title: 'Lantern keeper', role: 'opponent', tier: 1, emoji: '🕯️', accent: 'var(--mana-W)',
      look: 'a small, bright-eyed girl of about twelve in a cream hooded robe, carrying a tall paper lantern on a pole, a ring of tiny candles around her hat, rosy cheeks',
      palette: 'warm cream, soft gold, pale blue shadows', mood: 'polite, earnest and fast-talking',
      lines: { intro: ['Excuse me, may I play? My little guys are very quick!', 'I have so many friends, you will not believe it.'], win: ['Oh! You were faster. That was fun!', 'My candle went out... but I will relight it!'], lose: ['I won! Sorry, sorry! Good game!', 'My friends did all the work, really.'], tip: 'She fills the table with small white creatures. Wide boards beat her one-at-a-time attackers.', taunt: ['One more friend arrives!', 'Careful, they add up.'] } },
    { id: 't1-tess', name: 'Tidepool Tess', title: 'Sky fisher', role: 'opponent', tier: 1, emoji: '🪁', accent: 'var(--mana-U)',
      look: 'a lanky teenage girl with windswept teal hair, a patched blue raincoat, a fishing rod with a kite on the line, goggles pushed up on her forehead, bare feet in a tide pool',
      palette: 'sea blues, foam white, sandy yellow', mood: 'dreamy and a little smug',
      lines: { intro: ['Everything I own can fly. Do you own anything with reach?', 'The tide is in. So are my fliers.'], win: ['You had reach? That is not fair... nice one.', 'Back into the pool for me.'], lose: ['Up, up, and away!', 'Told you to bring reach.'], tip: 'Every creature she plays flies. Reach creatures and removal turn her game around.', taunt: ['Look up!', 'Too high for you?'] } },
    { id: 't1-gus', name: 'Gravedigger Gus', title: 'Cemetery caretaker', role: 'opponent', tier: 1, emoji: '⚰️', accent: 'var(--mana-B)',
      look: 'a stooped old man with a long grey beard and a black coat with a shovel strapped to his back, a small lantern, deep-set kind eyes, a faint purple glow around his hands',
      palette: 'charcoal, violet, bone white', mood: 'gravelly, gloomy, secretly warm',
      lines: { intro: ['Sit. Everything dies in the end. Even my deathtouchers, probably.', 'Quiet night. Good for card games.'], win: ['Hm. You earned that. Dig deep, kid.', 'Even the grave gives things back.'], lose: ['Rest easy. It was a good fight.', 'Nobody leaves my yard unburied.'], tip: 'Deathtouch and lifelink make blockers risky. Fliers and removal beat him.', taunt: ['My little ones bite hard.', 'You look pale.'] } },
    { id: 't1-cal', name: 'Cinder Cal', title: 'Firecracker', role: 'opponent', tier: 1, emoji: '🧨', accent: 'var(--mana-R)',
      look: 'a wiry boy of about fifteen with spiky orange hair and a scorched leather jacket, sparks flying off his fingertips, a bandolier of tiny firecrackers, a cocky smirk',
      palette: 'ember reds, orange, soot black', mood: 'hot-headed and impatient',
      lines: { intro: ['Let us go! Why are you still shuffling?!', 'Haste first, questions later!'], win: ['No way! Rematch! Right now!', 'You put out my fire... how?'], lose: ['Boom! Too slow, buddy!', 'That is what happens when you wait!'], tip: 'He is all haste and burn. Stay above his burn range and keep blockers back.', taunt: ['Burn it down!', 'Feel that heat?'] } },
    { id: 't1-boss', name: 'Greg the Stomper', title: 'Boss of the Locals', role: 'opponent', tier: 1, boss: true, emoji: '👑', accent: 'var(--mana-G)',
      look: 'a huge, jolly man in his forties with a thick braided beard, a green-and-white fur cloak, a crown of antlers, giant leather gauntlets and a belt made of oak leaves, a deep belly laugh',
      palette: 'forest green, ivory, warm gold crown', mood: 'booming, generous, loves a fair fight',
      lines: { intro: ['You beat my neighbours! Now you face Greg! HA!', 'Nobody gets past the Locals without meeting me.'], win: ['Ha ha ha! You stomped me! Take your prize, champion!', 'Well fought! The Grinders will be harder, you know.'], lose: ['Stomp! Come back when you are bigger!', 'That was close! Try a different deck!'], tip: 'The biggest bodies the Locals have. Chump-block and race, or remove his best one.', taunt: ['Feel the ground shake!', 'My army is bigger than yours!'] } },
    { id: 't2-sasha', name: 'Skyline Sasha', title: 'Rooftop duelist', role: 'opponent', tier: 2, emoji: '🌤️', accent: 'var(--mana-U)',
      look: 'a poised woman in her late twenties with short silver-blonde hair, a sky-blue trench coat and white scarf blowing sideways, a brass spyglass at her belt, standing on a rooftop edge',
      palette: 'sky blue, white, brass', mood: 'calm, polite, quietly competitive',
      lines: { intro: ['Altitude is everything. Shall we begin?', 'I hope you brought something that flies.'], win: ['Well played. You kept your feet on the ground and still won.', 'The view is better from up there, I suppose.'], lose: ['Thank you for the game. Mind the drop.', 'It was never going to land on the ground.'], tip: 'Fliers protected by pump spells. Hold removal for the creature she is about to buff.', taunt: ['Look up.', 'You cannot block what you cannot reach.'] } },
    { id: 't2-ike', name: 'Ironhide Ike', title: 'Blacksmith brawler', role: 'opponent', tier: 2, emoji: '🛡️', accent: 'var(--mana-R)',
      look: 'a stocky dwarf-like man with a red braided mustache, a leather smith apron over chainmail, a hammer in one hand and a small round shield in the other, soot on his cheeks',
      palette: 'iron grey, rust red, forge orange', mood: 'gruff, direct, respects effort',
      lines: { intro: ['First strike. Pump spells. That is the plan.', 'Let us see how you hold up against a proper hammering.'], win: ['Hmph. That was clean. Good smithing.', 'You broke my line. Fair enough.'], lose: ['Struck first, struck last.', 'Sturdy deck. Needs sturdier plans.'], tip: 'First strike wins his combats. Avoid trading small creatures; use tricks of your own.', taunt: ['First blood is mine.', 'Hammer time.'] } },
    { id: 't2-marcus', name: 'Marsh Marcus', title: 'Swamp herbalist', role: 'opponent', tier: 2, emoji: '🪷', accent: 'var(--mana-B)',
      look: 'a slender man with muddy green skin-toned robes, lily pads stitched to his cloak, a bundle of herbs at his belt, a staff with a glowing mushroom on top, half-lidded eyes and a calm smile',
      palette: 'swamp green, deep purple, mud brown', mood: 'slow and gentle, never in a hurry',
      lines: { intro: ['Patience. Everything in the marsh comes to me.', 'Deathtouch is just a very strong tea.'], win: ['Mm. You were quicker than the mist. Well done.', 'I will brew something stronger.'], lose: ['The marsh provides. Rest now.', 'Slow and steady. And poisonous.'], tip: 'Deathtouch, lifelink and removal. Do not trade your best creature into his blockers.', taunt: ['Sip slowly.', 'Another leaf in the pot.'] } },
    { id: 't2-sarah', name: 'Spellsmith Sarah', title: 'Lightning apprentice', role: 'opponent', tier: 2, emoji: '⚡', accent: 'var(--mana-R)',
      look: 'a lively young woman with a wild purple-blue ponytail, a belted blue-and-red coat covered in rune patches, a crackling wand, a spellbook tucked under one arm, mischievous grin',
      palette: 'electric blue, orange, parchment', mood: 'chatty, excitable, clever',
      lines: { intro: ['Burn, draw, repeat! Ready when you are!', 'I have been dying to test this combo on someone.'], win: ['Ooh, you shut me down! Teach me that!', 'My spellbook is going to need updating.'], lose: ['Zap! Told you it would work!', 'Another page for the book!'], tip: 'Lots of burn and a few fliers. Keep life high and do not let her draw extra cards unchecked.', taunt: ['Spell go brrr.', 'Did you see that?!'] } },
    { id: 't2-leo', name: 'Tangle Leo', title: 'Vine warden', role: 'opponent', tier: 2, emoji: '🕸️', accent: 'var(--mana-G)',
      look: 'a tall, quiet man with long braids woven with vines, a teal and green cloak, thin spectacles, a net of silver thread over one shoulder, a spider perched on his hat',
      palette: 'teal, leaf green, silver thread', mood: 'thoughtful, dry humour',
      lines: { intro: ['Reach beats air, bounce beats ground. I run both.', 'Do not mind the spider. He is a spectator.'], win: ['Unexpected. I had you tangled... apparently not.', 'Well played. Very well played.'], lose: ['Caught in the web.', 'A tidy little win.'], tip: 'Bounce spells slow you down while his big creatures catch up. Keep threats cheap.', taunt: ['Back to your hand.', 'Tangled.'] } },
    { id: 't2-boss', name: 'Marcus the Warden', title: 'Boss of the Grinders', role: 'opponent', tier: 2, boss: true, emoji: '👑', accent: 'var(--mana-U)',
      look: 'a dignified older man in a long midnight-blue and black coat with silver trim, a tall hat with a feather, a pocket watch chain, calm cold eyes and a short grey beard, one hand on a crystal staff',
      palette: 'midnight blue, black, silver', mood: 'measured, patient, always three turns ahead',
      lines: { intro: ['I have watched you win. Now watch me.', 'Control is not about waiting. It is about deciding.'], win: ['Magnificent. You read me correctly. The Pro Circuit awaits.', 'I concede. Go on.'], lose: ['As expected. Come back with a plan.', 'You rushed. It showed.'], tip: 'Removal, bounce and card draw. Do not overcommit; make him have the answers.', taunt: ['Not that one.', 'I would have thought you knew better.'] } },
    { id: 't3-brenda', name: 'Dread Brenda', title: 'Blood-red racer', role: 'opponent', tier: 3, emoji: '💀', accent: 'var(--mana-R)',
      look: 'a fierce woman in her thirties with a shaved-sided black hairdo, a black-and-crimson leather jacket with spikes, a skull-topped dagger, glowing red eyes and a cutting grin',
      palette: 'black, crimson, bone', mood: 'aggressive, sarcastic, loves pressure',
      lines: { intro: ['Fast and mean. That is the whole pitch.', 'You look nervous. Good.'], win: ['Damn. You are good. I mean it.', 'Fine. Rematch when I stop bleeding.'], lose: ['Bleed. Repeat.', 'Too slow. Always too slow.'], tip: 'Aggressive creatures with burn to finish. Block early and keep life above 8.', taunt: ['Tick tock.', 'Your life total looks lonely.'] } },
    { id: 't3-trevor', name: 'Titan Trevor', title: 'Mountain mover', role: 'opponent', tier: 3, emoji: '🦖', accent: 'var(--mana-G)',
      look: 'a towering man with a wild green beard and a moss-covered stone helmet, a hide cloak, carrying a huge stone hammer, small birds nesting in his beard, deep calm voice',
      palette: 'moss green, granite grey, amber', mood: 'slow, powerful, speaks in short sentences',
      lines: { intro: ['Big. Big. Bigger.', 'My creatures do not fit through doors.'], win: ['Hm. You stopped the mountain. Good.', 'You are strong. I like that.'], lose: ['Mountain wins.', 'Trample.'], tip: 'Gigantic tramplers. Chump-block with small ones and kill the biggest with removal.', taunt: ['Trample.', 'Feel that?'] } },
    { id: 't3-sam', name: 'Wallbuilder Sam', title: 'Fortress mason', role: 'opponent', tier: 3, emoji: '🧱', accent: 'var(--mana-W)',
      look: 'a stern woman in her fifties with a white braid down her back, a silver-white tabard over plate armor, a trowel hanging from her belt, a tall tower shield with a sunburst, steady eyes',
      palette: 'white, silver, sunburst gold', mood: 'patient, protective, immovable',
      lines: { intro: ['You will not get through. Few have.', 'Tell me when you tire of attacking.'], win: ['You found the crack. Well deserved.', 'My walls held longer than most.'], lose: ['A fortress stands.', 'You should have rested.'], tip: 'High-toughness lifelink creatures. Evasion and removal win; bashing into walls does not.', taunt: ['Wall.', 'Try again.'] } },
    { id: 't3-luke', name: 'Bounce Luke', title: 'Tide trickster', role: 'opponent', tier: 3, emoji: '🌀', accent: 'var(--mana-U)',
      look: 'a lithe young man with sea-glass blue hair, a layered coat of waves and bubbles patterned fabric, a pocket full of coins he flips, one raised eyebrow, a spiral tattoo on his neck',
      palette: 'ocean blue, teal, silver coins', mood: 'playful, mocking, always flipping a coin',
      lines: { intro: ['Everything you play comes right back. Fun, right?', 'I will have it back in your hand soon.'], win: ['Wow. You kept it on the table. Respect.', 'Okay, okay. You win this one.'], lose: ['Back in your hand it goes!', 'Heads, I win. Tails, I win.'], tip: 'He bounces your best creature and wins in the air. Cheap threats and removal for his fliers.', taunt: ['Not today.', 'Back it goes.'] } },
    { id: 't3-arthur', name: 'Arthur the Whale', title: 'Dragon-rider', role: 'opponent', tier: 3, emoji: '🐉', accent: 'var(--mana-R)',
      look: 'an enormous, flamboyant man in a red-and-green fur-trimmed cape, a belt of dragon scales, rings on every finger, a golden goblet, a tiny baby dragon on his shoulder, a loud laugh',
      palette: 'ruby red, emerald green, gold', mood: 'loud, generous, bragging',
      lines: { intro: ['Bring your best! I only play the biggest!', 'Is that your whole deck? Mine has a dragon.'], win: ['Magnificent! A worthy opponent! Have a coin!', 'The dragon blinks first. Well played.'], lose: ['Dragons win. Dragons always win.', 'Ha ha ha! Is that all?'], tip: 'Huge red and green creatures that cost a lot. Counter his tempo, remove the biggest one.', taunt: ['Behold!', 'Bigger!'] } },
    { id: 't3-boss', name: 'Sarah, Storm Walker', title: 'Boss of the Pro Circuit', role: 'opponent', tier: 3, boss: true, emoji: '👑', accent: 'var(--mana-U)',
      look: 'a regal, commanding woman in her late thirties with silver-white hair streaked with blue lightning, a long red-and-blue storm cloak crackling with energy, a floating crown made of lightning, one arm raised, calm confident gaze',
      palette: 'storm blue, crimson, white lightning', mood: 'confident, elegant, a little bored of winning',
      lines: { intro: ['You made it. Few do. Let me show you what the storm is.', 'The Pro Circuit ends here.'], win: ['Impossible... and wonderful. You are the best I have seen.', 'The storm bows. You are the champion.'], lose: ['The storm wins again. Come back stronger.', 'A good attempt. Not good enough.'], tip: 'The best burn and fliers in the pool with tricks. Track her mana and play around the finishing burn.', taunt: ['Lightning does not miss.', 'Feel the storm.'] } },
    // Helpers who talk on the other tabs
    { id: 'npc-guide', name: 'Pip the Guide', title: 'Ascent guide', role: 'npc', emoji: '🧭', accent: 'var(--brand-light)',
      look: 'a cheerful small traveller with a big backpack covered in patches, a rolled map under one arm, a feathered cap, bright round glasses, a notebook and pencil',
      palette: 'warm browns, teal, cream', mood: 'friendly, encouraging',
      lines: { intro: ['Welcome to the Ascent! Pick a color, win some games, climb the leagues.', 'Beat all five of a league and the boss opens up.'], tip: 'Each opponent drops its own signature cards. Check them on the map before you battle.', win: ['Great job! On to the next one!'], lose: ['Every loss is a lesson. And 5 Aether!'] } },
    { id: 'npc-packmaster', name: 'Mara the Packmaster', title: 'Booster merchant', role: 'npc', emoji: '📦', accent: 'var(--gold)',
      look: 'a brisk woman with a striped apron and sleeve garters, stacks of foil-wrapped booster packs, a pencil behind her ear, a brass scale on the counter, a sly smile',
      palette: 'gold, red, deep blue', mood: 'brisk and showy',
      lines: { intro: ['Fresh packs! Fourteen cards each, one rare guaranteed!', 'One in seven rares is a mythic. I counted.'], tip: 'The fifth copy of any card turns into Aether, so nothing is wasted.', win: ['Nice haul!'], lose: ['Better luck in the next pack!'] } },
    { id: 'npc-smith', name: 'Brindle the Aether Smith', title: 'Upgrade smith', role: 'npc', emoji: '⚒️', accent: 'var(--mythic)',
      look: 'a broad smith with a leather apron and goggles, glowing blue Aether crystals in a bucket, a small anvil that hums, burn scars on the forearms, a big laugh',
      palette: 'forge orange, aether blue, iron', mood: 'booming, loves tinkering',
      lines: { intro: ['Bring me a card and some Aether and I will teach it a new trick!', 'Every copy can be different. That is the fun of it.'], tip: 'Spare copies of a card can pay for an upgrade. Two slots per card, three on mythics.', win: ['Nice work!'], lose: ['Maybe it needs more flying.'] } },
    { id: 'npc-deckwright', name: 'Wren the Deckwright', title: 'Deck builder', role: 'npc', emoji: '🃏', accent: 'var(--color-link)',
      look: 'a quick-handed young person with a deck of cards fanned in one hand, a vest with many pockets, ink-stained fingers, a pencil in their hair, calm focused eyes',
      palette: 'blue-grey, cream, ink black', mood: 'careful and precise',
      lines: { intro: ['Forty cards. Seventeen lands is a good start.', 'Two colors are easier than three, but I will not stop you.'], tip: 'Tap a copy chip to choose exactly which copy goes in the deck, upgrades and all.', win: ['A tidy deck wins a lot of games.'], lose: ['Maybe one more land?'] } }
];

// ---- Effects played while a game is running ----
// kind -> { label, size (px per frame), frames, fps, prompt, hook }. Played over the card (lands, creatures) or the middle of the table (spells).
const ASCENT_FX = {
    'land-W': { label: 'Plains: a gentle white glow', size: 64, frames: 8, fps: 12, hook: 'a Plains enters', prompt: 'a soft radiant burst of white and gold light with floating feather motes and a sunbeam, expanding then fading' },
    'land-U': { label: 'Island: water ripple', size: 64, frames: 8, fps: 12, hook: 'an Island enters', prompt: 'a ring of blue water ripples with a splash and rising bubbles, expanding then fading' },
    'land-B': { label: 'Swamp: bubbling ooze', size: 64, frames: 8, fps: 12, hook: 'a Swamp enters', prompt: 'purple-black ooze bubbling up with wispy smoke and tiny skulls of vapor, rising then fading' },
    'land-R': { label: 'Mountain: ember burst', size: 64, frames: 8, fps: 12, hook: 'a Mountain enters', prompt: 'a burst of orange and red embers and a small flame ring, flickering then fading' },
    'land-G': { label: 'Forest: sprouting leaves', size: 64, frames: 8, fps: 12, hook: 'a Forest enters', prompt: 'green leaves and a sprout growing outward with sparkling spores, unfurling then fading' },
    'land-nonbasic': { label: 'Nonbasic land: five-color shimmer', size: 64, frames: 8, fps: 12, hook: 'any land that is not a basic enters', prompt: 'a swirl of white, blue, black, red and green sparkles spiralling around a bright ring, then fading' },
    'creature-W': { label: 'White creature arrives', size: 96, frames: 10, fps: 12, hook: 'a white creature enters', prompt: 'a pillar of white and gold light with feathers descending, a holy flash at the base' },
    'creature-U': { label: 'Blue creature arrives', size: 96, frames: 10, fps: 12, hook: 'a blue creature enters', prompt: 'a vortex of blue water and swirling mist rising into a bright splash' },
    'creature-B': { label: 'Black creature arrives', size: 96, frames: 10, fps: 12, hook: 'a black creature enters', prompt: 'purple-black shadow tendrils and skull-smoke curling up out of a crack in the ground' },
    'creature-R': { label: 'Red creature arrives', size: 96, frames: 10, fps: 12, hook: 'a red creature enters', prompt: 'a roaring column of orange flames and sparks bursting upward with a heat shimmer' },
    'creature-G': { label: 'Green creature arrives', size: 96, frames: 10, fps: 12, hook: 'a green creature enters', prompt: 'roots and vines bursting out of the ground with flying leaves and a green shockwave' },
    'creature-colorless': { label: 'Colorless creature arrives', size: 96, frames: 10, fps: 12, hook: 'a colorless creature (artifact creature) enters', prompt: 'grey metal gears and steel sparks assembling into a shining silver flash' },
    'creature-multi': { label: 'Multicolor creature arrives', size: 96, frames: 12, fps: 12, hook: 'a creature of two or more colors enters', prompt: 'a prismatic rainbow vortex of intertwined coloured light beams exploding into a star burst with gold sparkles' },
    'spell-instant': { label: 'Instant: lightning flash', size: 96, frames: 8, fps: 14, hook: 'an instant is cast', prompt: 'a fast jagged white-blue lightning flash with an arcane rune circle snapping in and out' },
    'spell-sorcery': { label: 'Sorcery: ritual circle', size: 96, frames: 10, fps: 12, hook: 'a sorcery is cast', prompt: 'a large glowing arcane summoning circle with orbiting runes and rising purple-gold smoke' },
    'spell-artifact': { label: 'Artifact: gear assembly', size: 96, frames: 10, fps: 12, hook: 'a non-creature artifact is cast', prompt: 'brass gears and cogs spinning into place with a metal clang flash and steam puffs' },
    'spell-enchantment': { label: 'Enchantment: sparkling aura', size: 96, frames: 10, fps: 12, hook: 'an enchantment is cast', prompt: 'a shimmering swirl of soft pink and gold sparkles forming a floating aura ring with tiny stars' },
    'spell-planeswalker': { label: 'Planeswalker: arrival portal', size: 128, frames: 12, fps: 12, hook: 'a planeswalker is cast', prompt: 'a swirling dimensional portal opening with colorful light and a spark of stars, a tall flash at the center' },
    'spell-battle': { label: 'Battle: clashing swords', size: 96, frames: 8, fps: 12, hook: 'a battle is cast', prompt: 'two crossed swords clashing with a shower of sparks and a shockwave ring' }
};
// Ideas for later (not wired up): combat hit, a creature dies, life gain, draw a card, an upgrade applied, a counterspell, a pack opening, a win and a lose banner.
const ASCENT_FX_IDEAS = {
    'fx-hit': { label: 'Combat hit', size: 64, frames: 6, fps: 14, prompt: 'a quick white impact flash with a slash mark and small sparks' },
    'fx-die': { label: 'Creature dies', size: 96, frames: 8, fps: 12, prompt: 'a creature outline crumbling into grey dust and fading spirit wisps rising' },
    'fx-heal': { label: 'Life gain', size: 64, frames: 8, fps: 12, prompt: 'rising green plus signs and soft white sparkles around a heart' },
    'fx-draw': { label: 'Draw a card', size: 64, frames: 6, fps: 14, prompt: 'a card sliding out of a deck with a small blue swoosh' },
    'fx-counter': { label: 'Counterspell', size: 96, frames: 8, fps: 14, prompt: 'a blue ward sigil shattering into pieces with a magic shatter ring' },
    'fx-upgrade': { label: 'Upgrade applied', size: 96, frames: 8, fps: 12, prompt: 'a golden anvil strike with rising blue Aether sparks and a bright flash' },
    'fx-pack-open': { label: 'Pack opens', size: 128, frames: 10, fps: 12, prompt: 'a foil booster pack tearing open with a burst of gold light and confetti' },
    'fx-win': { label: 'Victory banner', size: 128, frames: 10, fps: 10, prompt: 'a golden victory laurel and shining sunburst with confetti' },
    'fx-lose': { label: 'Defeat banner', size: 128, frames: 10, fps: 10, prompt: 'a dark grey cloud with a single falling ash flake and a dimming light' }
};

// ---- Icons and other sprites for the screens we already have ----
const ASCENT_ICONS = (() => {
    const out = {}, add = (id, group, label, size, prompt, frames) => { out[id] = { group, label, size, prompt, frames: frames || 1 }; };
    [['W', 'white', 'a bright white-gold sun'], ['U', 'blue', 'a blue water droplet'], ['B', 'black', 'a purple-black skull'], ['R', 'red', 'a red flame'], ['G', 'green', 'a green leaf']].forEach(([c, n, d]) => add('mana-' + c, 'Mana and colors', `${n} mana symbol`, 32, `a round gem-style mana symbol: ${d} on a dark round coin, bold readable shape`));
    add('mana-C', 'Mana and colors', 'colorless mana symbol', 32, 'a round grey gem-style mana symbol showing a small diamond');
    add('mana-multi', 'Mana and colors', 'multicolor symbol', 32, 'a round gem with a split rainbow of five colors');
    [['common', 'a plain grey-white gem'], ['uncommon', 'a silver-blue gem'], ['rare', 'a golden gem'], ['mythic', 'an orange-red fiery gem'], ['foil', 'a shimmering rainbow gem']].forEach(([r, d]) => add('rarity-' + r, 'Rarity', `${r} rarity gem`, 24, `${d}, small faceted, glowing slightly`));
    [['creature', 'a small clenched fist'], ['instant', 'a lightning bolt'], ['sorcery', 'a scroll with a flame'], ['artifact', 'a brass gear'], ['enchantment', 'a glowing star ring'], ['planeswalker', 'a spark of swirling stars'], ['land', 'a mountain and a tree']].forEach(([t, d]) => add('type-' + t, 'Card types', `${t} card type`, 24, `a tiny icon of ${d}, bold and readable`));
    [['firststrike', 'First strike', 'two crossed swords with a bright edge'], ['vigilance', 'Vigilance', 'an open eye over a shield'], ['reach', 'Reach', 'a long spear pointing up'], ['trample', 'Trample', 'a boot print breaking through a wall'], ['haste', 'Haste', 'a winged boot'], ['lifelink', 'Lifelink', 'a heart with a fang'], ['flying', 'Flying', 'a pair of wings'], ['deathtouch', 'Deathtouch', 'a skull with a dripping drop'], ['menace', 'Menace', 'two angry eyes in the dark'], ['hexproof', 'Hexproof', 'a crystal ball with a cross over it'], ['plus11', '+1/+1', 'a muscular arm with a plus sign'], ['plus20', '+2/+0', 'a sword with a plus sign'], ['plus02', '+0/+2', 'a shield with a plus sign'], ['etbdraw', 'Enters: draw', 'a card with a down arrow'], ['dielife', 'Dies: gain life', 'a sprout growing from a skull'], ['etblife', 'Enters: gain life', 'a heart with a leaf'], ['sdraw', 'Cantrip', 'a card with a star'], ['slife', 'Gain 3 life', 'a heart with a three']].forEach(([id, n, d]) => add('up-' + id, 'Upgrade and keyword icons', `${n} upgrade icon`, 24, `a tiny icon of ${d}, bold dark outline, readable at 24 pixels`));
    add('cur-aether', 'Currency', 'Aether crystal', 24, 'a glowing blue crystal shard with a white highlight');
    add('cur-coin', 'Currency', 'coin', 24, 'a gold coin with a star');
    add('cur-cash', 'Currency', 'cash', 24, 'a green banknote with a coin');
    add('pack-play', 'Packs', 'Play Booster wrapper', 96, 'a vertical foil booster pack wrapper in teal and silver with a swirling galaxy emblem, crimped top and bottom, no text', 1);
    add('pack-collector', 'Packs', 'Collector Booster wrapper', 96, 'a vertical gold and black foil booster pack wrapper with a shining sunburst emblem, crimped top and bottom, no text', 1);
    add('card-back', 'Cards', 'card back', 96, 'a trading card back in deep blue with a gold galaxy swirl border pattern, no text');
    add('card-frame-common', 'Cards', 'card frame, common', 96, 'an empty trading card frame border in plain grey with a transparent middle and a transparent name bar');
    add('card-frame-rare', 'Cards', 'card frame, rare', 96, 'an empty trading card frame border in gold with a transparent middle');
    add('card-frame-mythic', 'Cards', 'card frame, mythic', 96, 'an empty trading card frame border in fiery orange with flame edges and a transparent middle');
    add('tier-1', 'Map', 'League 1 banner: The Locals', 128, 'a cozy village banner with a little house and a flag, warm green and brown');
    add('tier-2', 'Map', 'League 2 banner: Friday Grinders', 128, 'a game-night banner with dice and a trophy cup, blue and orange');
    add('tier-3', 'Map', 'League 3 banner: The Pro Circuit', 128, 'a grand arena banner with a golden trophy and laurels, purple and gold');
    add('node-opp', 'Map', 'opponent node', 32, 'a round map node with a small crossed-swords emblem');
    add('node-boss', 'Map', 'boss node', 32, 'a round map node with a golden crown');
    add('node-beaten', 'Map', 'beaten node', 32, 'a round map node with a green check mark');
    add('node-locked', 'Map', 'locked node', 32, 'a round map node with a padlock');
    add('bg-tier-1', 'Backgrounds', 'League 1 map background', 320, 'a wide cozy countryside map at dawn with a winding path, farm fields and small houses, soft green and gold, no text', 1);
    add('bg-tier-2', 'Backgrounds', 'League 2 map background', 320, 'a wide lively town square at dusk with lanterns, tables and a card shop, blue and orange, no text', 1);
    add('bg-tier-3', 'Backgrounds', 'League 3 map background', 320, 'a wide grand arena under stormy purple skies with banners and a golden stadium, no text', 1);
    add('mat-table', 'Backgrounds', 'game table playmat', 320, 'a seamless dark wooden table top with a faint blue arcane circle in the middle, tileable, no text');
    add('tab-map', 'Tabs', 'Map tab icon', 24, 'a tiny folded map with a red pin');
    add('tab-packs', 'Tabs', 'Packs tab icon', 24, 'a tiny booster pack');
    add('tab-collection', 'Tabs', 'Collection tab icon', 24, 'a tiny stack of cards');
    add('tab-decks', 'Tabs', 'Decks tab icon', 24, 'a tiny hammer and a card');
    [['upkeep', 'a sunrise'], ['main', 'a hand holding a card'], ['combat', 'crossed swords'], ['end', 'a moon']].forEach(([id, d]) => add('phase-' + id, 'Turn phases', `${id} phase icon`, 24, `a tiny icon of ${d}`));
    add('counter-plus', 'Counters', '+1/+1 counter', 24, 'a small green coin with a plus sign');
    add('counter-minus', 'Counters', '-1/-1 counter', 24, 'a small red coin with a minus sign');
    add('life', 'Counters', 'life heart', 24, 'a red pixel heart with a white shine');
    add('mythic-flame', 'Rarity', 'mythic glow flames (loop)', 96, 'a loop of flickering orange flames around a transparent middle, to sit behind a mythic card', 6);
    add('foil-sheen', 'Rarity', 'foil sheen sweep', 96, 'a diagonal rainbow shimmer sweeping across a transparent card shape', 8);
    return out;
})();
