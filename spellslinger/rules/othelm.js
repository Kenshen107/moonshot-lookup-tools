// Spellslinger Duels - rules pack: the Othelm / Wernog deck (2026-10-27, owner's list: Clues, sacrifice and recursion). Wordings only; engine pieces in 15m-othelm.js (ids start with ot_).
// Uses the cl / clx / cmd / act helpers from rules/cmdr.js. Lines are matched whole, exactly as the reader prints them ("97" stands for X).

// Partners: the game has one commander, so the second one plays from the deck
cl(/^Partner—Friends forever(?: \(.*\))?$/, R => { R.partnerFF = true; });
// Othelm, Sigardian Outcast
clx("{2}, {T}: Choose target creature card in your graveyard that was put there from the battlefield this turn. Return it to the battlefield tapped.", (R, m, ctx) => { act(R, ctx.line, '{2}, {T}', [cmd('ot_othelm')]); });
// Wernog, Rider's Chaplain
clx("When ~ enters or leaves the battlefield, each opponent may investigate. Each opponent who doesn't loses 1 life. You investigate X times, where X is one plus the number of opponents who investigated this way.", R => { R.etb.push(cmd('ot_wernog')); R.trig.push({ ev: 'leaves', effects: [cmd('ot_wernog')] }); });
// Bebop & Rocksteady
clx("Whenever ~ attack or block, sacrifice a permanent unless you discard a card.", R => { R.trig.push({ ev: 'attacks', fn: 'ot_selfAttacks', effects: [cmd('ot_bebop')] }); R.trig.push({ ev: 'blocks', fn: 'ot_selfBlocks', effects: [cmd('ot_bebop')] }); });
// Brainspoil
clx("Destroy target creature that isn't enchanted. It can't be regenerated.", R => { R.spell = [{ t: 'destroy', target: 'creature', unenchanted: true }]; });
// Burning-Rune Demon
cl(/^When ~ enters, you may search your library for exactly two cards not named ~ that have different names\. If you do, reveal those cards\. An opponent chooses one of them\. Put the chosen card into your hand and the other into your graveyard, then shuffle\.$/, R => { R.etb.push(cmd('ot_demon')); });
// Demonic Taskmaster
clx("At the beginning of your upkeep, sacrifice a creature other than ~.", R => { R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('ot_taskmaster')] }); });
// Dimir Machinations
clx("Look at the top three cards of target player's library. Exile any number of those cards, then put the rest back in any order.", R => { R.spell = [{ t: 'cmd', id: 'ot_machinations', target: 'player' }]; });
// Havengul Laboratory
clx("At the beginning of your end step, if you sacrificed three or more Clues this turn, transform ~.", R => { R.trig.push({ ev: 'end', who: 'your', fn: 'ot_threeClues', effects: [{ t: 'transform' }] }); });
// Havengul Mystery (the back of Havengul Laboratory)
clx("When ~ transforms into ~, return target creature card from your graveyard to the battlefield.", R => { R.trig.push({ ev: 'transformed', fn: 'ot_selfTransformed', effects: [cmd('ot_mystery')] }); });
clx("When the creature put onto the battlefield with ~ leaves the battlefield, transform ~.", R => { R.trig.push({ ev: 'leaves', anyLeave: true, fn: 'ot_mysteryLeft', effects: [{ t: 'transform' }] }); });
// June, Bounty Hunter
clx("~ can't be blocked as long as you've drawn two or more cards this turn.", R => { selfCond(R, { cond: "you've drawn two or more cards this turn", p: 0, q: 0, kw: ['unblockable'] }); });
// Magus of the Balance
cl(/^\{4\}\{W\}, \{T\}, Sacrifice ~: Each player chooses a number of lands they control equal to the number of lands controlled by the player who controls the fewest, then sacrifices the rest\. Players discard cards and sacrifice creatures the same way\.$/, (R, m, ctx) => { act(R, ctx.line, '{4}{W}, {T}, Sacrifice ~', [cmd('ot_balance')]); });
// Netherborn Phalanx
clx("When ~ enters, each opponent loses 1 life for each creature they control.", R => { R.etb.push(cmd('ot_phalanx')); });
// Noble Heritage
cl(/^Commander creatures you own have "When ~ enters and at the beginning of your upkeep, each player may put two \+1\/\+1 counters on a creature they control\. For each opponent who does, you gain protection from that player until your next turn\."$/, R => { R.trig.push({ ev: 'enters', fn: 'ot_myCommanderEnters', effects: [cmd('ot_heritage', { enter: true })] }); R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('ot_heritage')] }); });
// Nyla, Shirshu Sleuth
clx("When ~ enters, exile up to one target creature card from your graveyard. If you do, you lose X life and create X Clue tokens, where X is that card's mana value.", R => { R.etb.push(cmd('ot_nylaEnter')); });
clx("At the beginning of your end step, if you control no Clues, return target card exiled with ~ to its owner's hand.", R => { R.trig.push({ ev: 'end', who: 'your', effects: [cmd('ot_nylaEnd')] }); });
// Obsessive Pursuit
clx("When ~ enters and at the beginning of your upkeep, you lose 1 life and create a Clue token.", R => { R.etb.push(cmd('ot_pursuitClue')); R.trig.push({ ev: 'upkeep', who: 'your', effects: [cmd('ot_pursuitClue')] }); });
clx("Whenever you attack, put X +1/+1 counters on target attacking creature, where X is the number of permanents you've sacrificed this turn. If X is three or more, that creature gains lifelink until end of turn.", R => { R.trig.push({ ev: 'attacks', fn: 'ot_iAttack', effects: [cmd('ot_pursuitAttack')] }); });
// Persuasive Interrogators
clx("Whenever you sacrifice a Clue, target opponent gets two poison counters.", R => { R.trig.push({ ev: 'sacrificed', sacType: 'Clue', effects: [cmd('ot_poison')] }); });
// Pitiless Carnage
clx("Sacrifice any number of permanents you control, then draw that many cards.", R => { R.spell = [cmd('ot_carnage')]; });
// Prismatic Undercurrents
clx("When ~ enters, search your library for up to X basic land cards, where X is the number of colors among permanents you control. Reveal those cards, put them into your hand, then shuffle.", R => { R.etb.push(cmd('ot_prismatic')); });
// Raven Eagle
clx("Whenever ~ enters or attacks, exile up to one target card from a graveyard. If a creature card is exiled this way, create a Clue token.", R => { R.etb.push(cmd('ot_eagle')); R.trig.push({ ev: 'attacks', fn: 'ot_selfAttacks', effects: [cmd('ot_eagle')] }); });
// Reveillark
clx("When ~ leaves the battlefield, return up to two target creature cards with power 2 or less from your graveyard to the battlefield.", R => { R.trig.push({ ev: 'leaves', effects: [cmd('ot_reveillark')] }); });
// Shred Memory
clx("Exile up to four target cards from a single graveyard.", R => { R.spell = [cmd('ot_shred')]; });
// The Soul Stone
clx("{6}{B}, {T}, Exile a creature you control: Harness ~.", (R, m, ctx) => { act(R, ctx.line, '{6}{B}, {T}', [cmd('ot_harness')]); });
clx("∞ — At the beginning of your upkeep, return target creature card from your graveyard to the battlefield.", R => { R.trig.push({ ev: 'upkeep', who: 'your', fn: 'ot_harnessed', effects: [cmd('ot_soulStone')] }); });

// Multi-sentence wordings become one token first (rules/cmdr.js CMD_REWRITES), read by one entry below
CMD_REWRITES.push(
    [/Draw a card\. Then you may put a land card from your hand onto the battlefield tapped\./g, '§otFungusDraw.'],
    [/Return target historic permanent card from your graveyard to the battlefield\. It enters with two additional \+1\/\+1 counters on it if it's a creature\./g, '§otHistoric.']
);
registerRules({
    name: 'othelm',
    effects: [
        [/^§otHistoric$/, () => ({ t: 'cmd', id: 'ot_historic' })],
        [/^§otFungusDraw$/, () => ({ t: 'cmd', id: 'ot_fungusDraw' })],
        [/^destroy all artifacts and creatures$/i, () => ({ t: 'wipe', how: 'destroy', what: 'artifacts and creatures' })]
    ],
    triggers: [],
    lines: []
});
