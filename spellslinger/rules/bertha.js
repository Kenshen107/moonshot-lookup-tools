// Spellslinger Duels - rules pack: the Big Bertha deck (2026-10-27, owner's list: Mutant +1/+1 counters, mono-green). Wordings only; engine pieces in 15l-bertha.js (ids start with bt_).
// Uses the cl / clx / cmd / act helpers from rules/cmdr.js. Lines are matched whole, exactly as the reader prints them ("97" stands for X).

// Big Mother Mouser
clx("When ~ dies, create a number of 1/1 colorless Robot artifact creature tokens equal to the number of +1/+1 counters on ~.", R => { R.trig.push({ ev: 'dies', effects: [cmd('bt_mouser')] }); });
// Bighorner Rancher
clx("{T}: Add an amount of {G} equal to the greatest power among creatures you control.", R => { R.mana = { colors: ['G'], n: 1, nGreat: true }; });
// Biophagus
clx("{T}: Add one mana of any color. If this mana is spent to cast a creature spell, that creature enters with an additional +1/+1 counter on it.", R => { R.mana = { colors: [...COLORS], n: 1, rider: 'btBio' }; });
// Bushmaster, Coiled Henchman
clx("Each other creature you control with a +1/+1 counter on it has deathtouch.", R => { R.statics.push({ other: true, fn: 'bt_plus', p: 0, q: 0, kw: ['deathtouch'] }); });
// Emil, Vastlands Roamer + Training Regimen
clx("Creatures you control with +1/+1 counters on them have trample.", R => { R.statics.push({ other: false, fn: 'bt_plus', p: 0, q: 0, kw: ['trample'] }); });
clx("{4}{G}, {T}: Create a 0/0 green and blue Fractal creature token. Put X +1/+1 counters on it, where X is the number of differently named lands you control.", (R, m, ctx) => { act(R, ctx.line, '{4}{G}, {T}', [cmd('bt_emil')]); });
// Claim the Kingdom
clx("Whenever a land you control enters, put a +1/+1 counter on target creature you control and a plan counter on ~.", R => { R.trig.push({ ev: 'landfall', fn: 'bt_myLand', effects: [{ t: 'counters', n: 1, target: 'creature', mine: true }, cmd('bt_plan')] }); });
clx("When the fourth plan counter is put on ~, sacrifice it. When you do, put an indestructible counter on target creature you control.", R => { R.btPlanDone = true; });
// Earthbender Ascension
clx("When ~ enters, earthbend 2. Then search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", R => { R.etb.push(cmd('bt_earthbend')); });
clx("Whenever a land you control enters, put a quest counter on ~. When you do, if it has four or more quest counters on it, put a +1/+1 counter on target creature you control. It gains trample until end of turn.", R => { R.trig.push({ ev: 'landfall', fn: 'bt_myLand', effects: [cmd('bt_quest')] }); });
// Fangs of Kalonia (overload: every creature you control)
clx("Put a +1/+1 counter on target creature you control, then double the number of +1/+1 counters on each creature that had a +1/+1 counter put on it this way.", R => { R.spell = [{ t: 'cmd', id: 'bt_fangs', target: 'creature', mine: true }]; });
cl(/^Overload \{4\}\{G\}\{G\}(?: \(.*\))?$/, R => { R.overload = { cost: parseCost('{4}{G}{G}'), spell: [cmd('bt_fangsAll')], text: 'Overload {4}{G}{G}' }; });
// Fertilid
clx("{1}{G}, Remove a +1/+1 counter from ~: Target player searches their library for a basic land card, puts it onto the battlefield tapped, then shuffles.", (R, m, ctx) => { act(R, ctx.line, '{1}{G}, Remove a +1/+1 counter from ~', [cmd('bt_fertilid')]); });
// Gamma Grotesque (power-up: once, cheaper the turn it entered)
cl(/^(?:Power-up — )?\{4\}\{G\}\{G\}: Put three \+1\/\+1 counters on ~\. Then draw a card for each creature you control with a counter on it\.$/, (R, m, ctx) => { act(R, ctx.line, '{4}{G}{G}', [{ t: 'counters', n: 3, target: 'self' }, cmd('bt_gamma')], a => { a.powerUp = true; }); });
// Incubation Druid
clx("{T}: Add one mana of any type that a land you control could produce. If ~ has a +1/+1 counter on it, add three mana of that type instead.", R => { R.mana = { colors: [...COLORS], n: 1, like: 'mine', tripleCtr: true }; });
// Ka-Zar of the Savage Land
cl(/^When ~ enters, create Zabu, a legendary 2\/2 green Cat creature token with "Landfall — Whenever a land you control enters, put a \+1\/\+1 counter on Zabu\."$/, R => { R.etb.push({ t: 'token', n: 1, p: 2, q: 2, name: 'green Cat', kw: [], legendary: true, named: 'Zabu', text: 'Landfall — Whenever a land you control enters, put a +1/+1 counter on ~.' }); });
// Mutagen Man, Living Ooze
clx("Activated abilities of artifact tokens you control cost {1} less to activate.", R => { R.tokenActLess = 1; });
clx("When ~ enters, create 97 ~ tokens.", R => { R.etb.push(cmd('bt_mutagenMan', { n: 'X' })); });
// Nesting Grounds
clx("{1}, {T}: Move a counter from target permanent you control onto a second target permanent. Activate only as a sorcery.", (R, m, ctx) => { const a = parseActivated('{1}, {T}: Draw a card. Activate only as a sorcery.', R); a.effects = [cmd('bt_nesting')]; a.text = ctx.line; R.acts.push(a); });
// Palazzo Archers
clx("Whenever a creature with flying attacks you or a planeswalker you control, ~ deals damage equal to its power to that creature.", R => { R.trig.push({ ev: 'attacks', fn: 'bt_flyAtkMe', anyOpp: true, effects: [cmd('bt_archers')] }); });
// Power Fist
clx("Equipped creature has trample and \"Whenever ~ deals combat damage to a player, put that many +1/+1 counters on it.\"", R => { R.buff = { p: 0, q: 0, kw: ['trample'] }; R.trig.push({ ev: 'hitPlayer', fn: 'bt_hostHit', host: true, effects: [cmd('bt_powerFist')] }); });
// Railway Brawler
clx("Whenever another creature you control enters, put X +1/+1 counters on it, where X is its power.", R => { R.trig.push(SPEC('enters', { another: true, type: 'Creature' }, { effects: [cmd('bt_brawler')] })); });
// Rampaging Yao Guai
clx("When ~ enters, destroy any number of target artifacts and/or enchantments with total mana value 97 or less.", R => { R.etb.push(cmd('bt_yaoGuai')); });
// Study the Classics
clx("Put a +1/+1 counter on target creature, then double the number of +1/+1 counters on it. You gain life equal to the number of +1/+1 counters on that creature.", R => { R.spell = [{ t: 'cmd', id: 'bt_study', target: 'creature' }]; });
// Synchronized Charge
clx("Distribute two +1/+1 counters among one or two target creatures you control. Creatures you control with counters on them gain vigilance and trample until end of turn.", R => { R.spell = [cmd('bt_charge')]; });
// The Ooze
clx("Whenever a creature you control with a +1/+1 counter on it leaves the battlefield, create a Mutagen token for each +1/+1 counter on it.", R => { R.trig.push({ ev: 'leaves', fn: 'bt_oozeLeaves', anyLeave: true, effects: [cmd('bt_ooze')] }); });
// Voracious Brood
clx("Whenever one or more creature cards are put into your graveyard from anywhere, put that many +1/+1 counters on ~.", R => { R.btBrood = true; });
clx("{T}: Exile target card from a graveyard. Create a Mutagen token.", (R, m, ctx) => { act(R, ctx.line, '{T}', [cmd('bt_oozeExile')]); });
