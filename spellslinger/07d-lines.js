// =====================================================================
// What the bots say (2026-10-15, owner: "I want more things the ai can say"). Data only; the logic is in 07d-banter.js.
// TALK[event] has `_` (anyone can say these) and, for some events, lines for one character (greg, marcus, sarah, leo, trevor, sam, arthur, brenda, luke).
// Placeholders: {foe} the player it is about, {me} the speaker's commander, {card} a card name, {n} a number, {cmd} a commander name, {tag} a deck theme.
// A line is picked by turn, seat and how much the bot has already said (no random numbers, so seeded games replay the same).
// =====================================================================
const CHARACTERS = {
    greg:   { name: 'Greg',   voice: 'friendly',  salt: 1.0, lie: 0.05, prefer: ['midrange', 'aggro', 'ramp'],            blurb: 'Plain-spoken and friendly. Hates getting blown out, forgives fast.' },
    marcus: { name: 'Marcus', voice: 'cold',      salt: 0.7, lie: 0.40, prefer: ['control', 'spellslinger'],               blurb: 'Cold and exact. Notices everything, says little, bluffs well.' },
    sarah:  { name: 'Sarah',  voice: 'quirky',    salt: 0.8, lie: 0.10, prefer: ['spellslinger', 'tokens', 'midrange'],    blurb: 'Loves weird combos and says so. Gets excited, rarely angry.' },
    leo:    { name: 'Leo',    voice: 'flavor',    salt: 0.9, lie: 0.05, prefer: ['tokens', 'voltron', 'midrange'],         blurb: 'Reads the flavor text. Takes it personally when the story goes wrong.' },
    trevor: { name: 'Trevor', voice: 'precise',   salt: 1.0, lie: 0.00, prefer: ['ramp', 'control', 'midrange'],           blurb: 'Counts everything out loud and never lies. Hates surprises.' },
    sam:    { name: 'Sam',    voice: 'hyper',     salt: 1.5, lie: 0.25, prefer: ['aggro', 'voltron', 'tokens'],            blurb: 'Fast, loud and impatient. Salty when slowed down.' },
    arthur: { name: 'Arthur', voice: 'rich',      salt: 1.2, lie: 0.20, prefer: ['voltron', 'ramp', 'control'],            blurb: 'Plays the expensive stuff and expects respect for it.' },
    brenda: { name: 'Brenda', voice: 'thrifty',   salt: 1.1, lie: 0.10, prefer: ['tokens', 'midrange', 'ramp'],            blurb: 'Counts the dollars. Hates seeing good cards wasted.' },
    luke:   { name: 'Luke',   voice: 'trickster', salt: 0.6, lie: 0.50, prefer: ['control', 'spellslinger', 'voltron'],    blurb: 'Grins at everything and bluffs constantly. Do not trust the tips.' }
};

const TALK = {
    // ---- Start of the game ----
    intro: {
        _: ["Let's go. I'm on {me}.", "{me} at the table. Be nice.", "Good luck, everybody. {me}, ready.", "Shuffle up. {me} in the seat."],
        greg: ["Hey all! Greg with {me}. Let's have a good one.", "{me}. Nothing fancy, just a lot of beef."],
        marcus: ["{me}. I've read the table already.", "Everything I do is on purpose. Remember that."],
        sarah: ["Ooh, I've been waiting to try {me} in a real pod!", "I built {me} on a dare. Watch this."],
        leo: ["{me}. The story begins.", "Every deck is a book. This one is {me}."],
        trevor: ["{me}. One hundred cards, thirty-seven lands. Ask me why.", "Seats checked, life totals checked. {me} is ready."],
        sam: ["{me}! Can we start already?", "I have a plan and it is: fast."],
        arthur: ["{me}. Foils, every one of them.", "I'd say good luck, but you'll need more than that."],
        brenda: ["{me}. Built it for under fifty dollars and I'm proud.", "{me} and a whole lot of spite."],
        luke: ["{me}. Do you trust me? You shouldn't.", "{me}, and I have absolutely nothing in my hand."]
    },
    // What a bot says about the person's deck on turn one, by theme
    'meet:mill': { _: ["{foe} is on {cmd}. I'm keeping an eye on my library.", "Mill? In this pod? Bold. Count your cards, everyone."] },
    'meet:clones': { _: ["{foe} is on {cmd}. Whatever I play, it will copy.", "Lots of copies in that deck, I bet. Fine, I'll play things worth copying."] },
    'meet:tokens': { _: ["{foe} is on {cmd}. We're going to see a lot of tokens.", "Tokens everywhere, I can already tell."] },
    'meet:reanimator': { _: ["{foe} is on {cmd}. Nobody stays dead for long, do they?", "Graveyard deck. I'll remember that."] },
    'meet:artifacts': { _: ["{foe} is on {cmd}. Lots of shiny things.", "Artifacts. I'll bring something to break them."] },
    'meet:spells': { _: ["{foe} is on {cmd}. Spells all night.", "I'll keep my counters close against {cmd}."] },
    'meet:voltron': { _: ["{foe} is on {cmd}. One big angry creature, I bet.", "Equipment and auras on {cmd}? Somebody keep removal handy."] },
    'meet:ramp': { _: ["{foe} is on {cmd}. Mana first, trouble later.", "Ramp deck. Watch for the big turn."] },
    'meet:burn': { _: ["{foe} is on {cmd}. Mind your life totals.", "Burn on {cmd}. I'll keep my life high."] },
    'meet:big': { _: ["{foe} is on {cmd}. I can feel the expensive spells from here.", "Big plays from {cmd}. Let's see them."] },
    // A rivalry carried over from earlier games
    rival: {
        _: ["Back again, {foe}? I remember last game.", "Oh, it's {foe}. I haven't forgotten.", "{foe}. We have unfinished business."],
        sam: ["{foe}! Rematch! Let's go!"], marcus: ["{foe}. I took notes last time."], luke: ["{foe}. I forgave you. Mostly."]
    },
    friendlyRival: { _: ["{foe}! Good to see you again.", "Hey {foe}. That last game was fun."], greg: ["{foe}! Round two, let's go."] },
    // ---- During the game ----
    hit: {
        _: ["Really, {foe}? Fine. We'll see how that goes.", "Ow. Noted, {foe}.", "That's one, {foe}.", "Hitting me again? Okay.", "I see you, {foe}."],
        greg: ["Come on, {foe}, I was being nice!"], marcus: ["{foe}. Every point of that is recorded."], sarah: ["Ow! Okay, but I have a plan."],
        leo: ["The crowd gasps at what {foe} has done."], trevor: ["That's {n} damage. I'm counting."], sam: ["You hit me! Now I have to hit back!"],
        arthur: ["Do you know what I paid for this life total?"], brenda: ["Waste of a good attack, {foe}."], luke: ["Ha! Keep going. It's funny."]
    },
    hitAgain: {
        _: ["That's twice now, {foe}. I'm remembering this.", "You keep coming at me, {foe}. Bad plan.", "{foe}, you made a mistake.", "I won't forget this, {foe}."],
        marcus: ["{foe}. Strike two."], sam: ["Okay, now it's personal, {foe}!"], greg: ["{foe}, buddy. Stop."]
    },
    spellAtMine: {
        _: ["{foe} just went after my stuff.", "Aiming at my permanents, {foe}? Bold.", "That was my best card, {foe}.", "{foe}, that wasn't necessary."],
        leo: ["{foe} has desecrated my story."], brenda: ["Do you know how long it took me to find that?"], trevor: ["{foe}, that's the third target I've counted."], luke: ["Oh no. Anyway."]
    },
    // ---- Deals ----
    peaceYes: {
        _: ["Fine, {foe}. Peace for now.", "Deal, {foe}. We both look elsewhere.", "Agreed. Don't make me regret this, {foe}.", "Peace. Let's watch the others."],
        greg: ["Sure thing, {foe}. A handshake is a handshake."], marcus: ["Acceptable, {foe}. Terms noted."], luke: ["Peace! Totally. Absolutely. Trust me."],
        arthur: ["I accept your offer, {foe}. Don't waste it."]
    },
    peaceNo: {
        _: ["Not this time, {foe}.", "No deal, {foe}.", "I don't think so, {foe}.", "Ask me again when you've earned it, {foe}."],
        sam: ["No time for peace! Attack!"], marcus: ["I decline, {foe}."], greg: ["Sorry, {foe}. Can't do it right now."]
    },
    peaceOffer: {
        _: ["{foe}, I'd rather not fight you right now. Peace?", "How about peace, {foe}? Let's watch the others.", "{foe}, truce for a turn?"],
        marcus: ["{foe}. A truce suits us both. Think it over."], greg: ["{foe}, you and me, let's not."], luke: ["{foe}! Peace, friend. Totally honest offer."]
    },
    kept: {
        _: ["Thanks for keeping your word, {foe}.", "Good deal, {foe}. We'll do it again.", "{foe} kept it. I'll remember that."],
        trevor: ["Deal kept: {foe}. Trust updated."], leo: ["A promise kept. The chapter closes well."]
    },
    betrayed: {
        _: ["You gave me your word, {foe}. I won't forget that.", "That was a promise, {foe}.", "Peace? Not anymore, {foe}.", "{foe} broke their word. Remember that, table."],
        greg: ["Seriously, {foe}? We shook on it."], marcus: ["{foe}. Never again."], sarah: ["You lied! I trusted you!"], leo: ["Betrayal. Of course there's betrayal."],
        sam: ["Oh, so it's like that, {foe}?"], arthur: ["Do you know who you just betrayed?"], brenda: ["I trusted you for a whole turn!"], luke: ["Ha. I should have seen that coming."]
    },
    betrayer: {
        _: ["Sorry, {foe}. The math changed.", "Nothing personal, {foe}.", "I said peace until my next turn. It's not my next turn."],
        marcus: ["I never said I'd keep it, {foe}."], sam: ["Gotta go fast, {foe}. Sorry!"], luke: ["Surprise, {foe}!"]
    },
    noMoreDeals: { _: ["No more deals with you, {foe}. Twice is enough.", "I'm done making promises with you, {foe}."], greg: ["I tried, {foe}. I really tried."] },
    // ---- The table ----
    archenemy: {
        _: ["{foe} is getting out of hand. Somebody has to deal with that.", "Everybody, look at {foe}'s board.", "{foe} is winning this and we all know it.", "Let's slow {foe} down together."],
        marcus: ["{foe} is the threat. The math is not close."], greg: ["{foe}, nothing personal, but you're the big guy."], sam: ["{foe}! Everyone get {foe}!"],
        sarah: ["{foe} is doing something scary. I can feel it."], luke: ["Poor {foe}. Everyone's looking at you now."]
    },
    worried: {
        _: ["I'm in trouble here.", "This is getting dangerous for me.", "I need a miracle, honestly.", "Somebody help me out here."],
        sam: ["Okay, I'm not winning this the fast way."], marcus: ["I've been better positioned."], brenda: ["I can't afford to lose these cards."]
    },
    angry: {
        _: ["I won't forget that.", "You keep coming after me. Noted.", "I'm done being nice.", "That's it. I'm picking a target."],
        greg: ["Okay, now I'm annoyed."], sam: ["I'm mad! I'm so mad!"], marcus: ["I've decided what to do about you."]
    },
    smug: {
        _: ["Looks like somebody else is the problem now.", "I'm happy to watch this.", "Go ahead, fight each other.", "I'll just sit here and develop."],
        luke: ["Don't mind me. Just popcorn."], arthur: ["I like my position. I like it a lot."]
    },
    mulligan: { _: ["My hand was a mess, so I took the free mulligan.", "Free mulligan, thank you very much.", "That seven was unplayable. New one, please."] },
    // ---- Salt (a nasty play happened) ----
    'salt:land': {
        _: ["Land destruction? Seriously?", "Blowing up lands, {foe}? Really?", "That's a rude play, {foe}.", "Wow. Land destruction at a casual table."],
        greg: ["Come on, {foe}, that's not fun for anybody."], marcus: ["Land destruction. Predictable and sad."], sam: ["My mana! My MANA!"], brenda: ["Do you know how much that land cost?"],
        trevor: ["That's {n} fewer lands. Do you understand what that does to me?"], luke: ["Oh, you absolute menace."]
    },
    'salt:wrath': {
        _: ["Wrath. Of course. I spent all that time on my board.", "There goes my board. Thanks, {foe}.", "Every creature. Every single creature.", "Sweeper again? Okay."],
        greg: ["My whole team! Come on!"], leo: ["The story ends. All of it. In one turn."], sam: ["I didn't even get to attack!"], arthur: ["Do you know what those creatures cost?"],
        brenda: ["Wasted. All of it. Wasted."], marcus: ["Predictable. But effective."], luke: ["Ha! Nice one. I'm not even mad."]
    },
    'salt:counter': {
        _: ["Countered? Again?", "{foe} counters my spell. Wonderful.", "Please stop countering everything, {foe}.", "That was my best spell, {foe}."],
        sarah: ["Aw, I was so close to the good part!"], marcus: ["Interesting. Let me remember that you hold counters."], sam: ["I don't have time for this!"], luke: ["You counter, I smile. Remember that."]
    },
    'salt:mill': {
        _: ["Mill? Seriously, {foe}?", "My library! Stop it!", "I'm going to run out of cards because of you, {foe}.", "Milling is just rude."],
        trevor: ["That's {n} cards. I counted them all."], greg: ["Stop, {foe}. Those were my cards!"], leo: ["Page after page, torn from the book."], marcus: ["Mill is only funny when it isn't you."]
    },
    'salt:steal': {
        _: ["Stealing my creature? Wow, {foe}.", "That's mine, {foe}. Give it back.", "Stolen. Of course.", "{foe} took my best card."],
        greg: ["{foe}, I'm going to want that back."], brenda: ["I paid for that!"], sam: ["Give it back! Give it back!"], luke: ["Oh, I'll get it back. Slowly."]
    },
    'salt:turn': { _: ["Extra turn. Great. Another one.", "{foe} gets another turn? Okay.", "Can we skip this? Please?"], marcus: ["Extra turns. A coward's play."], sam: ["Time! You're wasting time!"] },
    'salt:cmd': {
        _: ["My commander! Again!", "Not my commander. Not again.", "{foe}, that was my commander.", "I only get one of those, {foe}."],
        arthur: ["My commander, ruined. Do you know what that cost?"], leo: ["The hero falls."], trevor: ["That's the second time. The tax is going to hurt."]
    },
    'salt:target': { _: ["That's the third time you've aimed at me this turn, {foe}.", "Find another target, {foe}.", "{foe}, am I the only one you can see?"], greg: ["Hey! Pick on somebody else!"] },
    'salt:jab': {
        _: ["Maybe try playing the game instead, {foe}.", "Is that really your best play, {foe}?", "We're all trying to have fun, {foe}.", "{foe}, you're making this less fun for everyone."],
        marcus: ["Impressive. Truly. That was almost clever, {foe}."], sam: ["Wow, great job being annoying, {foe}!"], luke: ["Nice, {foe}. Really. I'm clapping."]
    },
    'salt:rage': {
        _: ["I'm done. Nobody make me any offers.", "That's it. No more deals with anyone!", "I'm so salty I could season a table.", "Fine. FINE. See how that goes."],
        greg: ["Okay. I'm officially mad."], sarah: ["I'm trying to be positive, but ugh."], sam: ["I can't believe this!"], arthur: ["This is unacceptable."], brenda: ["I have never been so insulted."]
    },
    // ---- Getting knocked out ----
    outSalty: {
        _: ["Great. Thanks, {foe}. Everyone's going to remember this.", "That's it? That's how I go out? Wow.", "I'm out. Cool. Good game, I guess.", "Congratulations, {foe}. I hope that felt good."],
        sam: ["I didn't even get to my good cards!"], arthur: ["Ridiculous."], brenda: ["All that money for this."], greg: ["Well, that stinks."]
    },
    outGracious: {
        _: ["Good game, everybody. Well played, {foe}.", "I had fun. Good luck to the rest of you.", "Out! Nicely done, {foe}.", "That was a fun one. Go get them."],
        sarah: ["That was great! Who's winning?"], leo: ["A fine ending to my chapter."], greg: ["Good game, {foe}. Really."], trevor: ["Game over. Good play, {foe}."]
    },
    kingmake: { _: ["If I'm going down, {foe} gets my help.", "{foe}, take my stuff. Finish them."], luke: ["Everyone wins a little, {foe}. Especially you."], greg: ["Here, {foe}. Make me proud."] },
    // ---- Cool plays (impressed) ----
    'cool:big': {
        _: ["Okay, that's a big play, {foe}.", "Whoa. {foe} has the big one.", "That's the kind of play you remember, {foe}.", "Nicely done, {foe}. Even if it hurts."],
        greg: ["Now THAT is a big play, {foe}!"], sarah: ["Oh, that's so cool! I hate it, but it's cool!"], leo: ["A grand moment. The crowd is on its feet."],
        trevor: ["That's {n} mana of value, {foe}. Respect."], sam: ["WOW. Okay. WOW."], arthur: ["Acceptable. Barely."], luke: ["I'm actually clapping, {foe}."]
    },
    'cool:copy': {
        _: ["You copied that? That's brilliant, {foe}.", "Oh, I hate that. It's very good, {foe}.", "Copying my best card. Respect.", "{foe} used my own card against me. Wow."],
        sarah: ["A clone! A real clone! I love it!"], marcus: ["Well played, {foe}. I'll remember that."], leo: ["A mirror held up to the story."]
    },
    'cool:steal': { _: ["Okay, that was smooth, {foe}.", "You stole it clean. Respect.", "That's the kind of thing I wish I'd thought of, {foe}."], luke: ["Stealing. My favorite. Nice one."] },
    'cool:reanimate': {
        _: ["Back from the dead! Nice one, {foe}.", "Reanimation? That's sweet.", "{foe} is playing everyone's graveyard. Respect.", "That's a great pull, {foe}."],
        leo: ["The dead rise. Chills."], sarah: ["Death is just a speed bump! I love it!"]
    },
    'cool:old': {
        _: ["Is that an original? That's incredible, {foe}.", "That card is older than some of us, {foe}. Respect.", "Whoa, {foe}. That's a classic."],
        arthur: ["A genuine antique. I'm impressed, {foe}."], brenda: ["Do you know what that card is worth?! Respect."], leo: ["The art on that one. Wow."]
    },
    'cool:comeback': {
        _: ["From the brink! Nice one, {foe}.", "That comeback was something else, {foe}.", "{foe} came back from nothing. Respect.", "I thought you were done, {foe}. I was wrong."],
        greg: ["Great comeback, {foe}!"], marcus: ["I miscounted. Well played, {foe}."], sam: ["That was SO close! Wow!"], trevor: ["{n} life to victory. Statistically impossible."]
    },
    'cool:deck': {
        _: ["That's an unusual deck, {foe}. I like it.", "Where did you even find this deck, {foe}?", "A deck with a plan. Respect.", "I haven't seen a deck like that in a while, {foe}."],
        sarah: ["It's so weird! I love it!"], marcus: ["Interesting construction, {foe}."], leo: ["Every card has a story. I can see it."]
    },
    // ---- End of the game ----
    win: {
        _: ["Good game, everybody.", "That was a good one. Thanks for playing.", "GG. Well played, everyone."],
        greg: ["Good game! Everyone played great."], marcus: ["As expected."], sam: ["I won! Again! Again!"], arthur: ["Naturally."], luke: ["Did I win? I did. Hehe."]
    },
    lose: {
        _: ["Good game, {foe}. You earned that.", "Well played, {foe}.", "GG, {foe}. Nice."],
        greg: ["Good game, {foe}! You got me."], marcus: ["I'll win the next one, {foe}."], sam: ["Rematch! Right now, {foe}!"], brenda: ["Fair enough, {foe}. Good game."]
    },
    saltiest: { _: ["Saltiest at the table: {foe}."] },
    // ---- Information (tips and answers) ----
    tipMana: {
        _: ["Heads up, {foe}: {card} has {n} untapped lands.", "Careful, {card} left {n} lands open.", "Just so you know, {card} has mana up."],
        trevor: ["Facts: {card} has {n} untapped lands."], marcus: ["{card} has {n} lands open. Do with that what you will."], luke: ["Friendly tip: {card} has {n} lands open. Probably."]
    },
    tipHold: {
        _: ["I think {card} is holding a counterspell.", "Be careful, {card} might have something in hand.", "{card} kept mana up for a reason."],
        marcus: ["I'd bet {card} is holding an answer."], luke: ["I'm sure {card} has a counter. Totally."]
    },
    tipThreat: {
        _: ["{card} is one swing from lethal on somebody.", "Watch out for {card}. That's a lot of power.", "{card} is the real threat at this table."],
        greg: ["{card} has the biggest board. Just saying."], trevor: ["{card}'s board: {n} power. Do the math."]
    },
    tipLie: { _: ["My earlier tip about {card} was wrong, {foe}. Oops."], luke: ["I said {card}, {foe}. I lied. Sorry, not sorry."], marcus: ["That tip was a test, {foe}. You failed."] },
    tipTrue: { _: ["My tip was true, {foe}. You can trust me.", "Told you, {foe}. {card} did have it."], trevor: ["Accurate, as always."] },
    askYes: { _: ["Yes, I do.", "I'm not going to lie, I do.", "Yes. Plan around it.", "I do. Don't make me use it."], luke: ["Absolutely. Definitely. Sure."], marcus: ["Yes."] },
    askNo: { _: ["No, I don't.", "Nope. Nothing like that in my hand.", "I'm empty-handed on that.", "Not right now."], luke: ["Nothing. Nothing at all. Believe me."], marcus: ["No."] },
    askUnsure: { _: ["I can't be sure.", "I haven't seen enough to say.", "No idea, honestly."], trevor: ["I don't have the data to answer that."] },
    askThreat: { _: ["I'd say {card}.", "{card} worries me the most.", "Honestly? {card}."], marcus: ["{card}. Obviously."], sam: ["{card}! Get {card}!"] },
    gossip: { _: ["Did you see that? {foe} broke their word to {card}.", "{foe} just broke a deal with {card}. Remember that.", "I wouldn't trust {foe} after that."], marcus: ["{foe} breaks deals. Noted for later."], greg: ["That wasn't nice, {foe}."] },
    // ---- Complex deals ----
    bountyOffer: {
        _: ["{foe}, anyone who knocks out {card} gets a card from me.", "Bounty on {card}. A card for whoever takes them down.", "Kill {card}, {foe}, and I'll make it worth your while."],
        arthur: ["I'll pay for {card}'s head. Handsomely."], brenda: ["A card for the one who finishes {card}. Cheap at the price."], luke: ["Bounty on {card}! Collect from me, I swear."]
    },
    bountyPaid: { _: ["A deal's a deal, {foe}. Here's your card.", "Bounty paid, {foe}. Nice work."], arthur: ["Paid in full, {foe}."], greg: ["There you go, {foe}. Thanks."] },
    allianceOffer: {
        _: ["{foe}, let's take {card} down together. Three turns.", "Alliance against {card}, {foe}? Three turns, no attacks between us.", "You and me versus {card}, {foe}. Deal?"],
        marcus: ["{foe}. {card} is the problem. We both benefit if it goes away."], sam: ["{foe}! You and me! Get {card}!"]
    },
    allianceBroken: { _: ["The alliance is over, {foe}.", "So much for our alliance, {foe}."], greg: ["I trusted you, {foe}. We had an alliance."] },
    counterOffer: {
        _: ["Not peace, {foe}, but I'll go after {card} first.", "How about this, {foe}: I leave you alone for a turn if you don't touch my commander.", "Can't do that, {foe}. Here's what I can do."],
        marcus: ["No. But I'll make you a better offer."], trevor: ["That doesn't balance, {foe}. Try this."]
    },
    infoDeal: { _: ["Here's a tip, {foe}: I'll tell you what I know if you leave me alone this turn.", "{foe}, peace for a turn and I'll tell you who's holding a counterspell."], luke: ["Peace for a turn and I'll tell you a secret, {foe}. A true one. Probably."] },
    tradeRestraint: { _: ["{foe}, I won't counter your next spell if you leave my commander alone.", "How about this, {foe}: I hold my sweeper if you hold yours."], marcus: ["Mutual restraint, {foe}. Think about it."] }
};

// What a deck is "about", worked out from its card text (counted in 07d-banter.js `deckTags`): [tag, words that count, cards needed]
const DECK_TAGS = [
    ['mill', /\bmills?\b|reveal cards from the top of their library until|their library/i, 4],
    ['clones', /\b(?:enter as a copy|create a token that's a copy|becomes a copy|copy target)\b/i, 4],
    ['tokens', /\bcreate [^.]*token/i, 7],
    ['reanimator', /\bgraveyard to the battlefield\b|\breturn target creature card from (?:a|your) graveyard\b/i, 4],
    ['artifacts', /\bartifacts? you control\b|\bEquipment\b|\bVehicle\b/i, 8],
    ['spells', /\binstant or sorcery\b|\bcopy target (?:instant|sorcery)\b|\bwhenever you cast (?:an?|your) (?:instant|noncreature)/i, 6],
    ['voltron', /\bequipped creature\b|\benchanted creature gets\b|\bAura\b/i, 8],
    ['ramp', /\bsearch your library for [^.]*\bland\b|\badd \{[A-Z0-9]\}/i, 12],
    ['burn', /\bdeals? \d+ damage to (?:any target|each opponent|target (?:player|opponent))/i, 6]
];
