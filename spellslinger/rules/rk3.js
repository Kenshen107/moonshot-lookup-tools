// Spellslinger Duels - rules pack rk3 (2026-11-27 card round: the most-played cards the game did not fully read).
// Wordings only; engine pieces are in 15zm-rk3.js (CMD ids start with rk3_). Uses cl / clx / cmd / act / SPEC from rules/cmdr.js.
const RK3_SPELL = (R, ...fx) => { R.spell = (R.spell || []).concat(fx); };
// ---- round 1 ----
// Syr Konrad, the Grim
clx('Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, ~ deals 1 damage to each opponent.', R => {
    R.rk3GyWatch = true;
    R.trig.push({ ev: 'creatureDies', fn: 'rk3Another', effects: [{ t: 'dmgOpp', n: 1 }] });
    R.trig.push({ ev: 'rk3GyIn', fn: 'rk3GyInElse', effects: [{ t: 'dmgOpp', n: 1 }] });
    R.trig.push({ ev: 'gyLeave', fn: 'rk3KonradLeft', effects: [cmd('rk3_konradLeft')] });
});
clx('{1}{B}: Each player mills a card.', (R, m, ctx) => { act(R, ctx.line, '{1}{B}', [{ t: 'millAll', n: 1 }]); });
// Terrasymbiosis
clx('Whenever you put one or more +1/+1 counters on a creature you control, you may draw that many cards. Do this only once each turn.', R => { R.trig.push({ ev: 'counters', fn: 'e_myCounters', effects: [cmd('rk3_terra')] }); });
// Up the Beanstalk
clx('When ~ enters and whenever you cast a spell with mana value 5 or greater, draw a card.', R => { R.etb.push({ t: 'draw', n: 1 }); R.trig.push({ ev: 'cast', filter: 'mv5', effects: [{ t: 'draw', n: 1 }] }); });
// Well of Lost Dreams
clx('Whenever you gain life, you may pay {X}, where X is less than or equal to the amount of life you gained. If you do, draw X cards.', R => { R.trig.push({ ev: 'gainLife', effects: [cmd('rk3_well')] }); });
// Archivist of Oghma
clx('Whenever an opponent searches their library, you gain 1 life and draw a card.', R => { R.trig.push({ ev: 'rk3Search', fn: 'rk3OppSearch', effects: [{ t: 'gain', n: 1 }, { t: 'draw', n: 1 }] }); });
// Grim Hireling
clx('{B}, Sacrifice X Treasures: Target creature gets -X/-X until end of turn. Activate only as a sorcery.', (R, m, ctx) => { act(R, ctx.line, '{B}', [cmd('rk3_hireling', { target: 'creature', good: false })], a => { a.sorcery = true; a.rk3SacTreasures = true; }); });
// Fierce Empath, Trophy Mage
clx('When ~ enters, you may search your library for a creature card with mana value 6 or greater, reveal it, put it into your hand, then shuffle.', R => { R.etb.push(cmd('rk3_empath')); });
clx('When ~ enters, you may search your library for an artifact card with mana value 3, reveal it, put it into your hand, then shuffle.', R => { R.etb.push(cmd('rk3_trophy')); });
// Harvest Season, Entish Restoration, Final Parting
clx('Search your library for up to X basic land cards, where X is the number of tapped creatures you control, put those cards onto the battlefield tapped, then shuffle.', R => { RK3_SPELL(R, cmd('rk3_harvest')); });
clx('Sacrifice a land. Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle. If you control a creature with power 4 or greater, instead search your library for up to three basic land cards, put them onto the battlefield tapped, then shuffle.', R => { RK3_SPELL(R, cmd('rk3_entish')); });
clx('Search your library for two cards. Put one into your hand and the other into your graveyard. Then shuffle.', R => { RK3_SPELL(R, cmd('rk3_parting')); });
// Spiteful Visions, Sulfuric Vortex
clx('Whenever a player draws a card, ~ deals 1 damage to that player.', R => { R.trig.push({ ev: 'draw', fn: 'rk3AnyDraw', effects: [cmd('rk3_visions')] }); });
clx('If a player would gain life, that player gains no life instead.', R => { R.noLifeGain = true; });
// Obscuring Haze, Crimson Wisps, Soul's Fire
clx('Prevent all damage that would be dealt this turn by creatures your opponents control.', R => { RK3_SPELL(R, cmd('rk3_haze')); });
clx('Target creature becomes red and gains haste until end of turn.', R => { RK3_SPELL(R, cmd('rk3_wisps', { target: 'creature', good: true })); });
clx('Target creature you control deals damage equal to its power to any target.', R => { RK3_SPELL(R, cmd('rk3_soulsFire', { target: 'creature', mine: true, good: true })); });
// Necropotence
clx('Pay 1 life: Exile the top card of your library face down. Put that card into your hand at the beginning of your next end step.', (R, m, ctx) => { act(R, ctx.line, '{0}', [cmd('rk3_necro')], a => { a.cost.life = 1; }); });
