// New reactions (2026-11-18): a bot talks about its own game, not only about what others did to it. Hooks are in 07d4-reactions.js.
//   goFirst    the bot has the first turn            lowLife / nearDeath   its life is 15 or less / 6 or less      deckLow    its library is nearly empty
//   cmdCast    it casts its commander for the first time    selfBig   it casts a very expensive spell ({card}, {n} mana)
//   wrathCast  it casts a sweeper itself             swing     it attacks with four or more creatures ({n})
//   comboGo    it starts an infinite-mana loop       comboPanic   another bot sees {foe} do it
//   idle       something small, now and then, in the mood it is in
addVoice('_', {
    goFirst: ["I'll go first, if nobody minds.", "Okay, I'm up first. Be gentle."],
    lowLife: { '*': ["I'm at {life}. That's getting low.", "Down to {life}. This is getting tight."], worried: ["{life} life. I don't love that."] },
    nearDeath: ["I'm at {life}. One more hit and I'm done.", "{life} life left. Everybody breathe."],
    deckLow: ["I only have {n} cards left in my library. That's... not a lot.", "My library is getting thin. {n} cards."],
    cmdCast: ["And there it is: {card}.", "{card} is on the table. Let's go."],
    selfBig: ["Here it comes: {card}. {n} mana's worth.", "That's {card}. I hope somebody's watching."],
    wrathCast: ["Everybody's board, gone. You're welcome.", "Time for a reset. Sorry, everyone."],
    swing: ["Here we go, {n} creatures. Brace yourselves.", "All in. {n} attackers."],
    comboGo: ["This is where it all comes together.", "And now we go off."],
    comboPanic: ["Wait. {foeIs} doing something. Stop {foe}!", "Somebody stop {foe}. That's a combo. That's definitely a combo."],
    idle: { '*': ["Nice board, everyone.", "Still thinking about my next play.", "Good game so far."], cheerful: ["Having a great time here.", "I love this part of the game."], worried: ["Not sure how long I can hold this together."], smug: ["Everything's going fine over here."], salty: ["I'm not mad. I'm just thinking about things."] }
});
addVoice('greg', {
    goFirst: ["Okay, I'm up first! Let's see what the cards have in mind.", "I'll lead off. Go easy on me, folks."],
    lowLife: { '*': ["Whoa, {life} life. That's lower than I'd like, honestly.", "I'm down to {life}. Somebody pat me on the head."], worried: ["Okay, {life}. I've been better, pals."] },
    nearDeath: ["{life} life left, buddy. I'm hanging on by a thread, here.", "{life}. I've got a good feeling I'm about to say 'ow' a lot."],
    deckLow: ["Uh oh, I've got {n} cards left. I might've overdone the drawing."],
    cmdCast: ["There's my guy. Say hi to {card}!", "{card}! Nice to see ya, big fella."],
    selfBig: ["Ha! Look at that! {card}. Big, right? I love a big one.", "That's {card}, folks. {n} mana of pure stomp."],
    wrathCast: ["Sorry, everyone. I didn't want to, but my board needed some air.", "A little sweeper time. Don't be mad, I'm kind of a softie."],
    swing: ["Here we go! {n} guys, all at once! Don't blink!", "Everybody attack! Big stompy parade!"],
    comboGo: ["Okay, okay. Watch this. This is the good part.", "I'm gonna do a thing now. It's a little silly."],
    comboPanic: ["Uh oh. {foe}, buddy, what are you doing? Somebody stop {foe}!", "I don't like where this is going. {foeIs} going off!"],
    idle: { '*': ["Hey, nice plays, everybody.", "I'm having a blast, you know that?", "Anybody want a snack? I brought chips."], cheerful: ["This is exactly the kind of game I like."], worried: ["Okay, I'm... trying to stay positive. Mostly."], smug: ["Don't mind me. Just enjoying my board."], salty: ["I'm fine. Totally fine. Moving on."] }
});
addVoice('marcus', {
    goFirst: ["I'll start. The advantage is minor but real.", "I go first. I've allowed for that."],
    lowLife: { '*': ["{life}. Manageable.", "My life total is {life}. I have a plan."], worried: ["{life}. That's lower than I intended."] },
    nearDeath: ["{life} life. One misstep from now, I'm out. I won't make it.", "At {life}, I need everything to go right. It won't be easy."],
    deckLow: ["{n} cards remain in my library. I've considered it."],
    cmdCast: ["{card}. As planned.", "The commander. Now the real game starts."],
    selfBig: ["{card}. {n} mana. I thought you'd want to see it.", "I waited for this turn. {card}."],
    wrathCast: ["A reset. Not a decision I enjoyed. A correct one.", "Your boards were becoming a problem. Now they aren't."],
    swing: ["{n} attackers. I've done the math on your blocks.", "Attacking with {n}. You won't enjoy this."],
    comboGo: ["Now. Watch closely.", "This is the part I planned for. Don't interrupt."],
    comboPanic: ["{foeIs} winning. Stop it. Now.", "That's a combo. {foe}, I'm not letting that resolve."],
    idle: { '*': ["I'm watching. All of you.", "Interesting turn. Keep going.", "That was a mistake. I'll hold on to it."], cheerful: ["This is a better table than I expected."], worried: ["I don't like the numbers."], smug: ["Everything is on schedule."], salty: ["I'm taking notes on everyone."] }
});
addVoice('sarah', {
    goFirst: ["Ooh, I'm first! Okay, okay, don't let me forget anything!", "I get to go first? I get to go first!"],
    lowLife: { '*': ["I'm at {life}! That's fine, right? That's totally fine.", "{life} life! It's a little bit of a lot."], worried: ["Okay, {life}. I have a plan. I think it's a plan."] },
    nearDeath: ["{life}! That's so low! It's honestly kind of fun?", "I'm at {life} and I'm trying not to panic, look at me not panicking."],
    deckLow: ["I only have {n} cards left?! How did I draw so much? I'm so sorry, deck."],
    cmdCast: ["Here we go! {card}! The star of the show!", "Okay! {card}! Look at it! It's so pretty!"],
    selfBig: ["Look at {card}! {n} mana! I've been saving this for ages!", "Wait for it. WAIT FOR IT. {card}!"],
    wrathCast: ["Sorry, sorry, sorry! Everybody's stuff is gone! I'm so sorry! It's very exciting!", "Okay, big reset, everyone! Blank slate!"],
    swing: ["{n} creatures! Everybody go! Wheee!", "Attack! With all {n}! This is so much fun!"],
    comboGo: ["Okay, here we go, watch this, it's SO good!", "This is the thing I built the deck for! Look look look!"],
    comboPanic: ["Hold on, hold on, {foe}, what is THAT? Somebody stop {foe}! It's so cool but STOP!", "Oh no. Oh no no no. {foeIs} doing a thing."],
    idle: { '*': ["Ooh, nice board! What does that do?", "Wait, can that card do... never mind. Keep going!", "I have a theory about what you're doing."], cheerful: ["I love games like this! Everyone's so fun!"], worried: ["Everything's a bit on fire. But it's a nice fire!"], smug: ["Oh, my plan is working! My plan is actually working!"], salty: ["It's fine! It's fine! Everything's lovely!"] }
});
addVoice('leo', {
    goFirst: ["And so, the first act belongs to me.", "I take the stage. Let the story begin."],
    lowLife: { '*': ["{life} life. The hero is wounded, but not yet broken.", "At {life}, the stakes rise."], worried: ["{life}. A dark chapter."] },
    nearDeath: ["{life}. The final act is upon me.", "{life} life. The curtain hovers."],
    deckLow: ["{n} cards remain. The last pages of my book."],
    cmdCast: ["Enter {card}, to a hush from the crowd.", "Behold: {card}. The hero arrives."],
    selfBig: ["The climax: {card}. {n} mana of pure drama.", "Behold {card}. This is the scene I wrote the deck around."],
    wrathCast: ["And with one great stroke, the story begins anew.", "A flood. A fire. A reset. Everyone, to the lifeboats."],
    swing: ["{n} heroes march at once. Cue the music.", "The charge. {n} strong. History will remember it."],
    comboGo: ["The plot turns. Watch how the pieces fall.", "And now the final act, rehearsed for so long."],
    comboPanic: ["A conspiracy! {foeIs} writing the ending! Stop the scene!", "Does no one see what {foe} is doing? The villain is making his move!"],
    idle: { '*': ["I do enjoy a well-paced game.", "Every table is a stage. This one is particularly good.", "Somebody here has the makings of a protagonist."], cheerful: ["What a delightful third act this is turning into."], worried: ["Things look grim. Good stories often begin that way."], smug: ["The plot is going as written."], salty: ["The author owes me an apology."] }
});
addVoice('trevor', {
    goFirst: ["I'm going first. That's turn one, for the record.", "First turn. I've written down the starting life totals."],
    lowLife: { '*': ["My life total is {life}. For the record.", "{life} life. I've updated my estimates."], worried: ["{life}. My win probability dropped."] },
    nearDeath: ["{life} life. I count at least {n} ways to lose from here.", "At {life}, a single attack ends the game."],
    deckLow: ["{n} cards left in my library. That's {n} draws from losing."],
    cmdCast: ["{card} cast. Commander tax applies from here.", "Commander cast: {card}. The tax is now one step higher."],
    selfBig: ["{card}. {n} mana. A deliberate sequencing choice.", "I've waited {n} mana's worth of turns for {card}."],
    wrathCast: ["Sweeper cast. By my count that removes most of the board.", "A reset. The numbers favor me now."],
    swing: ["Attacking with {n}. I've calculated the blocks.", "{n} attackers. Technically within the rules."],
    comboGo: ["The loop is online. Please don't interrupt the count.", "Beginning the sequence. Step one."],
    comboPanic: ["{foe} is repeating a loop. That's a combo. Stop it before it finishes.", "By my count, {foe} has an infinite loop. Somebody respond."],
    idle: { '*': ["I'm tracking all {n} life totals.", "Noting the sequence. Carry on.", "For the record, I'm enjoying this."], cheerful: ["This is a well-run game. I approve."], worried: ["The odds have shifted. Not in my favor."], smug: ["Everything is within my projected range."], salty: ["I am keeping a list."] }
});
addVoice('sam', {
    goFirst: ["I'M FIRST! Go go go go!", "First turn! Yes! Let's GO!"],
    lowLife: { '*': ["{life}?! Okay okay okay!", "I'm at {life}! I'm fine! I'm fast!"], worried: ["{life} life! That's BAD! Somebody help!"] },
    nearDeath: ["{life}!! I'm gonna DIE if you look at me!", "{life} life! One hit! ONE HIT!"],
    deckLow: ["I've got {n} cards left? That's FAST. Too fast."],
    cmdCast: ["{card}! Let's GO!", "Yes! {card}! Finally!"],
    selfBig: ["{card}! {n} mana! BOOM!", "Look at {card}! LOOK AT IT!"],
    wrathCast: ["RESET! Everybody gone! My turn!", "Boom! Clean board! Let's go!"],
    swing: ["ALL {n} AT ONCE! GO GO GO!", "Attack! {n}! No blocks! GO!"],
    comboGo: ["Okay okay okay, watch this! Watch THIS!", "Now it's FAST!"],
    comboPanic: ["{foe}! STOP {foe}! That's a COMBO! DO SOMETHING!", "{foeIs} going off! Somebody respond! Anybody!"],
    idle: { '*': ["Can we go faster? Please?", "Is it my turn yet?", "I'm bored. Hit somebody."], cheerful: ["This is awesome! Keep going!"], worried: ["Okay, this is going slow and badly."], smug: ["I'm WINNING! Did anybody notice?"], salty: ["Hurry UP."] }
});
addVoice('arthur', {
    goFirst: ["I'll begin, naturally.", "I go first. It's only proper."],
    lowLife: { '*': ["{life}? How tedious.", "A mere {life}. It's not what I'm used to."], worried: ["{life}. I find this unacceptable."] },
    nearDeath: ["{life}? That's... unprecedented.", "At {life}, I'm told, one becomes nervous. I wouldn't know."],
    deckLow: ["{n} cards left in the library. That can't be right."],
    cmdCast: ["Behold {card}. The finest in the room.", "I present {card}. Do not stare."],
    selfBig: ["{card}. {n} mana. I hope you took a good look.", "{card}, ladies and gentlemen. Collect yourselves."],
    wrathCast: ["I've cleared the table. The staff will be thrilled.", "A reset. I had no choice. It was getting vulgar."],
    swing: ["{n} attackers. Do try to stay calm.", "I'm attacking with {n}. A bit much? Perhaps."],
    comboGo: ["And now, the main event.", "Please, hold your applause until the end."],
    comboPanic: ["{foe}, that's... a lot of loop. Someone, do something.", "{foeIs} doing something quite impertinent. Stop that."],
    idle: { '*': ["Remarkable, how amateur this all is.", "I'd mention the price of that, but you'd faint.", "Carry on. I'm watching."], cheerful: ["A truly splendid evening."], worried: ["I'll be having words with the organizers."], smug: ["Everything is exactly as it should be."], salty: ["Do not speak to me."] }
});
addVoice('brenda', {
    goFirst: ["I'll go first. No sense wasting time.", "First turn. Let's not waste mana."],
    lowLife: { '*': ["I'm at {life}. That's getting expensive.", "{life} life. Don't waste it."], worried: ["{life}. I can't afford many more hits."] },
    nearDeath: ["{life} life. I can't spare any of it.", "At {life}, every point counts."],
    deckLow: ["{n} cards left. I've got to stretch every one of them."],
    cmdCast: ["{card}! My best card for under a dollar. Okay, maybe two.", "{card} is out. Let's see what I can do with a bargain."],
    selfBig: ["{card}. {n} mana. And you thought budget decks couldn't do it.", "That's {card}. It was worth the savings."],
    wrathCast: ["Sorry about the boards. I'd rather not waste them, but I had to.", "A clean sweep. Cheaper than a loss."],
    swing: ["Attacking with {n}. No wasted bodies.", "{n} creatures. Every one counts."],
    comboGo: ["Here we go. Nothing wasted. Nothing at all.", "Everything I paid for goes right here."],
    comboPanic: ["{foe}, that's a loop and you know it. Somebody stop {foe}!", "{foeIs} cheating the economy! Stop them!"],
    idle: { '*': ["Not bad. Not wasteful, either.", "Anybody want to trade? I've got some bulk.", "I'm just trying to stretch my cards."], cheerful: ["I love a good bargain-bin play."], worried: ["I can't afford to lose this."], smug: ["Look what a quarter can do."], salty: ["Somebody owes me for that."] }
});
addVoice('luke', {
    goFirst: ["Oh, I'll go first. I promise to be gentle.", "First turn. I'll try not to be suspicious."],
    lowLife: { '*': ["{life} life. How exciting for you all.", "I'm at {life}. It's all part of the plan. Probably."], worried: ["{life}. Oh, don't look so worried. I'm not."] },
    nearDeath: ["{life} life. Oh, it's fine. Everything's fine.", "At {life}, things are getting interesting."],
    deckLow: ["{n} cards in the library. I wonder what happens at zero. Hm."],
    cmdCast: ["Surprise! {card}!", "Oh look, it's {card}. How did that get there?"],
    selfBig: ["Oh, {card}. {n} mana. It slipped out.", "I hope you're sitting down. {card}."],
    wrathCast: ["Oops. Did I do that? I did. Sorry, everyone. Not sorry.", "Reset button! Isn't it lovely?"],
    swing: ["{n} little friends, and they all want to say hi.", "Everyone attack! I'm sure it's fine!"],
    comboGo: ["Now, this is the interesting part.", "Don't blink. Seriously. Don't."],
    comboPanic: ["Oh no. {foe} is doing it. Somebody stop {foe}. I'm very concerned.", "{foeIs} going off? How surprising. For everyone but me."],
    idle: { '*': ["Having fun? I'm having fun.", "Interesting. Very interesting.", "I wonder what everyone's holding."], cheerful: ["Oh, this is wonderful. Don't change a thing."], worried: ["It's fine. It's totally fine. Smile."], smug: ["Oh, I have a plan. It's a wonderful plan."], salty: ["No, I'm happy. Really. Look at my face."] }
});
