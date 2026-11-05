// Spellslinger Duels - rules pack: Astonishing Spider-Man discard / wheel deck (2026-11-05, owner pasted the list: "Reckless build it out").
// Wordings only; engine pieces are in 15t-spiderman.js (CMD ids start with hs_). Uses cl / clx / cmd / act from rules/cmdr.js.
// Line text must use the reader's "~" form (this card's name and "this creature" both become "~").
const hsPump = (p, q) => cmd('pumpSelf', { p, q });
// Astonishing Spider-Man
clx('Whenever ~ attacks, you may discard your hand. If you do, draw a card for each card you\'ve discarded this turn.', R => { R.trig.push({ ev: 'attacks', fn: 'hg_selfAttacksHS', effects: [cmd('hs_wheelAttack')] }); });
// Captain Howler, Sea Scourge
cl(/^Ward—\{2\}, Pay 2 life\.$/, R => { R.ward = 2; R.wardBothLife = 2; });
clx('Whenever you discard one or more cards, target creature gets +2/+0 until end of turn for each card discarded this way. Whenever that creature deals combat damage to a player this turn, you draw a card.', R => { R.trig.push({ ev: 'discarded', effects: [cmd('hs_howler', { target: 'creature', good: true })] }); });
// Change of Fortune
clx('Discard your hand, then draw a card for each card you\'ve discarded this turn.', R => { R.spell = [cmd('hs_wheelMine')]; });
// Flame Blitz
clx('At the beginning of your end step, ~ deals 5 damage to each planeswalker.', R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('hs_blitz')] }); });
// Flameblade Adept
clx('Whenever you cycle or discard a card, ~ gets +1/+0 until end of turn.', R => { R.trig.push({ ev: 'discarded', effects: [hsPump(1, 0)] }); });
// Glint-Horn Buccaneer
clx('Whenever you discard a card, ~ deals 1 damage to each opponent.', R => { R.trig.push({ ev: 'discarded', effects: [{ t: 'dmgOpp', n: 1 }] }); });
// Imaginary Threats
clx('Creatures target opponent controls attack this turn if able. During that player\'s next untap step, creatures they control don\'t untap.', R => { R.spell = [cmd('hs_threats', { target: 'player', good: false })]; });
// Ivora, Insatiable Heir
clx('When ~ enters and whenever it deals combat damage to a player, create a Blood token.', R => { R.etb.push({ t: 'artToken', kind: 'blood', n: 1 }); R.trig.push({ ev: 'hitPlayer', fn: 'hg_selfHits', effects: [{ t: 'artToken', kind: 'blood', n: 1 }] }); });
clx('Whenever you discard a card, put a +1/+1 counter on ~.', R => { R.trig.push({ ev: 'discarded', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
// Magmakin Artillerist
clx('Whenever you discard one or more cards, ~ deals that much damage to each opponent.', R => { R.trig.push({ ev: 'discarded', effects: [{ t: 'dmgOpp', n: 1 }] }); });
clx('When you cycle ~, it deals 1 damage to each opponent.', R => { R.cycleTrig = [{ t: 'dmgOpp', n: 1 }]; });
// Marauding Mako, Scrounging Skyray
clx('Whenever you discard one or more cards, put that many +1/+1 counters on ~.', R => { R.trig.push({ ev: 'discarded', effects: [{ t: 'counters', n: 1, target: 'self' }] }); });
// Memory Deluge
clx('Look at the top X cards of your library, where X is the amount of mana spent to cast ~. Put two of them into your hand and the rest on the bottom of your library in a random order.', R => { R.spell = [cmd('hs_deluge')]; });
// Mirrorshell Crab
clx('{2}{U}, Discard ~: Counter target spell or ability unless its controller pays {3}.', (R, m, ctx) => { const a = act(R, ctx.line, '{2}{U}, Discard ~', [{ t: 'counter', target: 'spell', filter: 'spellOrAbility', unless: 3 }]); if (a.hand) { R.acts.pop(); (R.handActs = R.handActs || []).push(a); } });
// Mystic Redaction
clx('Whenever you discard a card, each opponent mills two cards.', R => { R.trig.push({ ev: 'discarded', effects: [cmd('hs_mill2')] }); });
// Nimble Obstructionist
clx('When you cycle ~, counter target activated or triggered ability you don\'t control.', R => { R.cycleTrig = [{ t: 'counter', target: 'spell', filter: 'hsAbilityTheirs' }]; });
// Ominous Seas
clx('Whenever you draw a card, put a foreshadow counter on ~.', R => { R.trig.push({ ev: 'draw', effects: [cmd('hs_seas')] }); });
clx('Remove eight foreshadow counters from ~: Create an 8/8 blue Kraken creature token.', (R, m, ctx) => { act(R, ctx.line, '{0}', [{ t: 'token', n: 1, p: 8, q: 8, name: 'blue Kraken', kw: [] }], a => { a.cost.removeNamedN = { kind: 'foreshadow', n: 8 }; }); });
// Path of the Pyromancer
clx('Discard all the cards in your hand. Add {R} for each card discarded this way, then draw that many cards plus one.', R => { R.spell = [cmd('hs_pyromancer')]; });
cl(/^Starting with you, each player votes for planeswalk or chaos\. If planeswalk gets more votes, planeswalk\. If chaos gets more votes or the vote is tied, chaos ensues\.$/, R => { R.hsPlanar = true; });
// Rush of Inspiration
clx('Draw two cards. Then discard a card at random unless you pay {E}{E} .', R => { R.spell = [cmd('hs_rush')]; });
// Spider-Man, New Champion
clx('Whenever you discard one or more cards, ~ deals that much damage to any target.', R => { R.trig.push({ ev: 'discarded', effects: [{ t: 'dmg', n: 1, target: 'any' }] }); });
// Underworld Breach
clx('Each nonland card in your graveyard has escape. The escape cost is equal to the card\'s mana cost plus exile three other cards from your graveyard.', R => { R.hsBreach = true; });
