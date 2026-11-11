// Spell scores for the computer, round 1 (2026-11-11, owner: "build it out", after `node tests/ai_audit.js` showed that about a third of the non-creature cards scored 0,
// so the computer never cast them): planeswalkers, ramp spells (Cultivate, Kodama's Reach), rituals, Brainstorm-style card flow, wheels, "gain control until end of turn"
// and extra-combat spells. Each score depends on the situation (mana, hand, board, phase), not a flat number. `scoreEffects` and `aiScoreBase` are wrapped, so the
// old scores stay as they were and these are added for the kinds that used to add nothing. `AI_TUNE.spellScores = 0` (or `--tune spellScores=0` for seat A in the lab)
// turns all of it off for comparing results. Loaded after 07k-sequencing.js.
'use strict';
AI_TUNE.spellScores = 1;
const spellScoresOn = P => tn(P, 'spellScores') !== 0;

// How many mana sources a player has, and the biggest nonland spell waiting in their hand (ramp is worth more when something costly is stuck)
function ssSources(P) { return manaSources(P).length; }
function ssBiggestStuck(P, skip) { return Math.max(0, ...P.hand.filter(x => x !== skip && Rx(x).kind !== 'land').map(x => x.card.cmc || 0)); }
function ssRampWorth(P) {
    const src = ssSources(P), big = ssBiggestStuck(P);
    let s = tn(P, 'rockScore'); // a mana rock's own score (9)
    if (src <= 4) s += 3; else if (src >= 8) s -= 6;
    if (big > src) s += 2;
    return Math.max(0, s);
}
function ssBasicsInLibrary(P) { return P.library.filter(c => /\bBasic\b/.test(c.card.type) && /\bLand\b/.test(c.card.type)).length; }
function ssAttackPower(P) { return P.bf.filter(x => isCreature(x) && !x.sick).reduce((a, x) => a + Math.max(0, pow(x)), 0); }

const SPELL_SCORE = {
    // "Search for up to two basic lands: one onto the battlefield tapped, one into your hand"
    cultivate: P => (ssBasicsInLibrary(P) ? ssRampWorth(P) : 0),
    // A ritual only matters when it lets you cast something you couldn't: the biggest card in hand that costs more than you have left, but no more than you would have
    addMana: (P, e, t, src) => {
        if (!src || !src.card || (Rx(src).kind !== 'instant' && Rx(src).kind !== 'sorcery')) return 0;
        const have = availableMana(P) - (src.card.cmc || 0), gain = e.mana ? e.mana.length : e.opts ? e.opts[0].length : 1;
        const targets = P.hand.filter(x => x !== src && Rx(x).kind !== 'land' && (x.card.cmc || 0) > have && (x.card.cmc || 0) <= have + gain);
        return targets.length ? 7 + Math.max(...targets.map(x => x.card.cmc || 0)) * 0.5 : 0;
    },
    // Brainstorm / Brainsurge ("draw three, put two back"): a good draw when the hand is small
    brainstorm: P => (P.library.length > 6 ? (P.hand.length <= 3 ? 6 : 2) : 0),
    // Wheel of Fortune, Windfall: everyone discards their hand and draws; worth it when you are nearly empty-handed and they are not
    wheel: P => {
        const mine = P.hand.length, theirs = foes(P).reduce((a, F) => a + F.hand.length, 0);
        return mine <= 1 ? (theirs >= 2 ? 7 : 4) : mine <= 2 && theirs >= 3 ? 5 : 0;
    },
    // "Gain control of target creature until end of turn" (Act of Treason): only before combat, for the attack it makes (lethal counts)
    steal: (P, e, t) => {
        if (!t || !t.o || G.phase !== 'main1' || G.active !== P.i) return 0;
        const O = opp(P), p = Math.max(0, pow(t.o));
        const blockers = O.bf.filter(x => isCreature(x) && !x.tapped && x !== t.o).length;
        if (O.life <= p + ssAttackPower(P) && blockers <= 1) return 1000;
        return p >= 5 && blockers === 0 ? 2 + p : 0;
    },
    // Relentless Assault ("untap attackers, additional combat") is cast after attacking, in the second main phase
    relentless: P => ssExtraCombatWorth(P)
};
// Extra-combat spells: worth the damage the creatures that attacked would do again, when the opponent can't wall them
function ssExtraCombatWorth(P) {
    if (G.phase !== 'main2' || G.active !== P.i) return 0;
    const O = opp(P), power = ssAttackPower(P), blockers = O.bf.filter(x => isCreature(x) && !x.tapped).length;
    if (power <= 0) return 0;
    if (O.life <= power && blockers === 0) return 1000;
    return power >= 5 ? Math.min(14, 2 + power * 0.6 - blockers * 1.5) : 0;
}

{
    const base = scoreEffects;
    scoreEffects = function (P, effects, target, src) {
        let s = base.apply(this, arguments);
        if (!spellScoresOn(P)) return s;
        for (const e of effects || []) {
            const f = SPELL_SCORE[e.t];
            if (!f) continue;
            if (needsTarget(e) && !target) continue;
            try { s += f(P, e, target, src) || 0; } catch (er) { /* a score that can't be worked out adds nothing */ }
        }
        return s;
    };
    const baseCore = aiScoreBase;
    aiScoreBase = function (P, o, target) {
        const r = Rx(o);
        if (spellScoresOn(P) && r.kind === 'planeswalker') {
            if (P.bf.some(x => x.card.name === o.card.name && Rx(x).legendary)) return 0; // the legend rule
            // a planeswalker is a source of cards or removal every turn: worth about a good creature, a little more with high loyalty
            return 13 + (Number(o.card.loyalty) || 0) * 0.7;
        }
        return baseCore.apply(this, arguments);
    };
}
Object.assign(CMD_SCORE, { seizeTheDay: P => ssExtraCombatWorth(P) });
