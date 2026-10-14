# Spellslinger Duels: what it is, what it can do, and how it grew

A fan-made Magic: The Gathering test game that runs in your web browser. No account, no download, no real money. Open packs, build decks, run a card shop, and play Magic against computer opponents (or a friend on the same device). It's marked "Test build", so expect rough edges. It is not made or run by any store, and it isn't affiliated with Wizards of the Coast.

Try it: https://kenshen107.github.io/moonshot-lookup-tools/Spellslinger_Duels.html

## What it can do

### Play Magic
- **Rules engine:** turns, mana, the stack with priority and responses, counterspells, combat (first strike, double strike, trample, deathtouch, lifelink, menace, flying, and more), state-based actions, the legend rule, commander tax, commander damage, and the London mulligan. It follows the official Comprehensive Rules and links to the rule text in the game log.
- **Formats:** Modern, Commander, Casual (precons and other decks), and Limited (booster draft).
- **4-player Commander pods** as well as 1 vs 1, and playing a friend on the same device.
- **Card coverage:** over 13,000 cards are fully automated and about 87% of all paper cards can be cast. The Home screen shows the exact numbers.
- **Friendly table:** an always-visible End turn button, a phase strip, and tap-your-own-lands payment (or auto-pay). Big boards stack like MTG Arena, with counters, tokens and a life/poison/energy tracker. Opponent plays are shown one step at a time with the card's picture, and every question (kicker, X, sacrifice, discard) is an on-screen panel. There's a full phone layout with a bottom tab bar.

### Computer opponents
- Easy, normal and hard levels, plus nine shop-customer personalities used as campaign bosses.
- **Seven playstyles** (Aggro, Control, Midrange, Ramp, Tokens, Voltron, Spellslinger) with decks that match them.
- **Surprise me:** a brand-new random playable Commander or Modern deck every game.
- Face any commander (from EDHREC's average decks), this week's trending commanders, a pasted decklist, or any of 553 real preconstructed decks.
- **Politics in pods:** a shifting archenemy, bot moods with speech bubbles, and deals you can make (Peace, Hands off, Gang up). Bots keep their word, remember betrayal, and stop dealing with you after two broken deals.

### Packs and drafting
- Open packs from nearly any paper set, Alpha (1993) to today, using real booster odds. Reveals scale with the pull: glow, rays, confetti and a full-screen jackpot for the big ones. Open a whole box at once.
- Every card has a condition (Mint to Damaged), may be foil, and may be serialized; value follows Scryfall's prices.
- **8-person booster draft** (you plus 7 computer drafters) for Mirrodin and Magic 2010: pick, auto-build a 40-card deck, and play three rounds for coins.

### Deck building
- A Moxfield-style builder: mana curve, color balance, sample hands, group and sort, a picture view, and bulk edit.
- Import decklists from Moxfield, Arena, Archidekt or plain text.
- A goldfish **playtester** with no opponent.
- Preset "fully working" Commander decks, and a library of all 553 precons marked Ready or not.

### Game modes
- **Sandbox:** free play with test buttons and no shop money.
- **Campaign:** Kitchen Table, Friday Night, and Regional Qualifier tiers with bosses, rewards and a permanent discount, plus a Precon Circuit.
- **Shop Simulator:** run a card shop. Price your case, haggle with nine kinds of customers, buy from walk-in sellers, order boxes from a distributor, crack packs for singles, and send cards to a made-up grader. A shop day lasts 10 minutes.

### Handy extras
- Multiple players on one device, each with their own saved profile.
- An in-game Comprehensive Rules viewer with search.
- Coins and cash are in-game only.

## Update log

### Oct 5 (launch day)
First test game: packs, decks, Modern and Commander vs the computer. Then the same day: the stack, priority and counterspells; a Rules tab; the goldfish playtester; multiple players; the card shop, wholesale distributor and sealed packs; precons, the campaign ladder, AI levels and deck analytics; and a flexible game table with a bigger hand and counter tracking. The first rules rounds made triggers, activated abilities and statics work.

### Oct 6
- Rules rounds 3-6: mana pool, kicker, sagas, storm, cascade, delve, protection, two-faced cards, planeswalker attacks and modes.
- A stacked pack reveal, grading, the 10-minute shop day and friendlier haggling.
- Pack and box prices based on the cards inside; coin boxes; open a whole box.
- Every Welcome Deck and Starter Kit card fully automated; 66% of the top 1,000 Commander cards.
- Always-visible turn button, phase strip, and tap-your-own-lands payment.
- Phone layout; Welcome Deck duels; play a friend on one device.
- The Moxfield-style deck builder; effect questions as in-game panels instead of browser pop-ups.
- Import Moxfield decklists; face any commander or a pasted list.

### Oct 7
- Top-1000 rounds 2 and 3: 821 of the top 1,000 automated.
- Verified preset decks: Sandman, Brudiclad, Gitrog, Tyrox.
- 8-seat booster draft; every Mirrodin and Magic 2010 card automated.
- Card coverage shown on Home; you choose what to sacrifice; the opponent's turn plays out step by step.
- Behind the scenes: split into plain script files, saved data moved to IndexedDB, and redraws only what changed (faster).

### Oct 8
- A token-based card reader for the next batch of cards.
- Three game modes: Sandbox, Campaign and Shop Simulator, each with its own money and record.
- The four other Aetherdrift Tyrant decks.
- The Precon Library (553 decks) and Precon Circuit, plus four precon rounds (Buyback, Flanking, Bushido, Multikicker, Dash, Madness and more).
- The Play tab picks a deck type first, then a same-type opponent. Smarter AI blocking.

### Oct 9
Sandbox has no shop cash: imports and missing cards are free there.

### Oct 14
- Three sweep rounds: about 750 more cards automated (Morph, Suspend, Ninjutsu, Plot, Embalm, Squad and more).
- Surprise me random decks.
- An offline test lab that plays hundreds of games a minute. It found and fixed frozen games and a duplicated-card bug.
- 4-player Commander pods with a pod strip on the table; seven playstyles.
- Rules fixes: commander zone choice, choose what to discard, Saddle and Crew choices.
- Pod politics: archenemy, bot moods and speech bubbles, a free pod mulligan, and play-by-play pop-ups.
- Deals: Peace, Hands off, and Gang up, with trust, reputation and a trust floor after two broken deals.
- Balance: drain decks counted as a threat sooner; one grudge line per betrayal.
- 800 test pods of six political deck styles showed betrayals and a shifting archenemy make the most entertaining games.

## Credits and legal
Cards and prices come from Scryfall. Pack contents come from MTGJSON. Commander decks come from EDHREC. The game text follows Wizards' Comprehensive Rules. Magic: The Gathering is a trademark of Wizards of the Coast; this is unofficial fan content under their Fan Content Policy.
