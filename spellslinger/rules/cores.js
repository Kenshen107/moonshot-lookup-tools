// Spellslinger Duels - rules pack: the draft sets round (2026-11-18): Magic 2011, 2012, 2013, Seventh to Tenth Edition, Core Set 2019, Foundations,
// Modern Masters 2017 and Return to Ravnica. Wordings only; the engine pieces are in 15zb-cores.js (CMD ids start with dc_).
// Lines are matched whole, exactly as the reader prints them (~ is the card's own name). Uses cl / clx / cmd / act / SPEC / selfCond from rules/cmdr.js.

// ===== Magic 2011 =====
clx("{R}: ~ deals 1 damage to target creature defending player controls. Activate only if ~ is attacking.", (R, m, ctx) => { act(R, ctx.line, '{R}', [{ t: 'dmg', n: 1, target: 'creature', theirs: true, good: false }], a => { a.onlyIf = '~ is attacking'; }); });
clx("Spells you control can't be countered by blue or black spells this turn, and creatures you control can't be the targets of blue or black spells this turn.", R => { R.spell = [cmd('dc_veil')]; });
clx("~ can't attack unless an opponent has been dealt damage this turn.", R => { R.attackCond = 'an opponent has been dealt damage this turn'; });
clx("Tap five untapped Vampires you control: Gain control of target creature. It becomes a Vampire in addition to its other types.", (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('dc_captivating', { target: 'creature', theirs: true, good: false })], a => { a.cost.dcTapN = { n: 5, sub: 'Vampire' }; }); });
clx("Whenever an opponent is dealt noncombat damage, ~ gets +3/+0 until end of turn.", R => { R.trig.push({ ev: 'playerDamaged', fn: 'dc_oppNoncombat', effects: [{ t: 'pump', p: 3, q: 0, kw: [], target: 'self' }] }); });
clx("~ deals 5 damage to target white or blue creature. The damage can't be prevented.", R => { R.spell = [cmd('dc_combust', { target: 'creature', only: 'white or blue creature', good: false })]; });
clx("Whenever ~ attacks, each player chooses a card name. Then each player reveals the top card of their library. If the card a player revealed has the name they chose, that player puts it into their hand. If it doesn't, that player puts it on the bottom of their library.", R => { R.trig.push({ ev: 'attacks', fn: 'dc_selfAttacks', effects: [cmd('dc_conundrum')] }); });
clx("Whenever ~ attacks, you may have it deal damage equal to its power to target creature defending player controls. If you do, that creature deals damage equal to its power to ~.", R => { R.trig.push({ ev: 'attacks', fn: 'dc_selfAttacks', effects: [cmd('dc_cyclops', { target: 'creature', theirs: true, good: false })] }); });
clx("At the beginning of your upkeep, reveal the top card of your library and put that card into your hand. You lose life equal to its mana value.", R => { R.trig.push({ ev: 'upkeep', fn: 'dc_myUpkeep', effects: [cmd('dc_tutelage')] }); });
clx("You may pay 6 life and sacrifice three black creatures rather than pay ~'s mana cost.", R => { R.alt = { mana: parseCost(''), life: 6, sacKind: 'creature:B', sacN: 3, exile: null, cond: null, text: 'pay 6 life and sacrifice three black creatures' }; });
clx("Each player sacrifices five lands of their choice. ~ deals 5 damage to each creature.", R => { R.spell = [cmd('dc_destructiveForce')]; });
clx("{G}, {T}, Discard a creature card: Search your library for a creature card, reveal it, put it into your hand, then shuffle.", (R, m, ctx) => { act(R, ctx.line, '{G}, {T}', [cmd('dc_fauna')], a => { a.cost.dcDiscard = 'creature'; }); });
clx("If a red instant or sorcery spell you control would deal damage, it deals double that damage instead.", R => { R.dmgMult = { n: 2, redSpell: true }; });
clx("Whenever ~ becomes the target of a spell or ability an opponent controls, counter that spell or ability unless its controller pays {2}.", R => { R.trig.push({ ev: 'targeted', fn: 'dc_selfTargetedByOpp', effects: [cmd('dc_frostTitan')] }); });
clx("~ can't be the target of nongreen spells or abilities from nongreen sources.", R => { R.dcHexNonGreen = true; });
clx("{3}: Until end of turn, ~ loses defender and gains flying.", (R, m, ctx) => { act(R, ctx.line, '{3}', [cmd('dc_gargoyle')]); });
clx("~ can't attack unless there are five or more Islands on the battlefield.", R => { R.attackCond = 'there are five or more Islands on the battlefield'; });
clx("When ~ enters, you may search your library for an artifact card, exile it, then shuffle.", R => { R.etb.push(cmd('dc_hoardSearch')); });
clx("When ~ dies, you may put the exiled card into its owner's hand.", R => { R.trig.push({ ev: 'dies', effects: [cmd('dc_hoardReturn')] }); });
clx("Any number of target players each gain 6 life.", R => { R.spell = [cmd('dc_feast')]; });
clx("Target creature becomes red until end of turn and attacks this turn if able.", R => { R.spell = [cmd('dc_incite', { target: 'creature', good: false })]; });

// Counter replacement effects that see every kind of counter (2026-11-18, owner: Hardened Scales only +1/+1, Doubling Season doubles all, Doc Samson one more of any kind)
clx("If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.", R => { R.counterMod = { what: 'permanent', times: 2, plus: 0, kinds: 'all' }; });
clx("If one or more counters would be put on an artifact or creature you control, that many plus one of each of those kinds of counters are put on that permanent instead.", R => { R.counterMod = { what: 'artifact or creature', times: 1, plus: 1, kinds: 'all' }; });

// Remnant of the Rising Star (back of Jugan Defends the Temple): another creature entering may get X counters for {X} (Doc Samson makes each one more)
clx("Whenever another creature you control enters, you may pay {X}. When you do, put X +1/+1 counters on that creature.", R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature' }, { effects: [cmd('dc_remnantX')] })); });
