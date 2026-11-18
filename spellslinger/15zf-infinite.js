// Infinite mana for any deck (2026-11-19, owner: "make it pick up better on infinite mana ... staff of domination ... and no limit on how much mana can be put in Astral Cornucopia,
// Everflowing Chalice and replicate"). Loaded after 15ze-combo-talk.js. Before this only a few commanders' plans (Doc Samson) noticed a loop.
// (1) `genericLoop(P)` finds a creature that taps for more mana than its untapper costs: Staff of Domination ({3} untap the creature + {1} untap the Staff, so the creature must
//     make 5+), Sword of the Paruns on it ({3}: untap, 4+), Umbral Mantle on it ({3}, 4+; the Mantle also pumps it). A person is offered the loop in their main phase
//     (`loopOfferFor`, 15y-ai-plans.js); the computer takes it by itself (`genericGoOff`, before and after its main phase). Both go through `giveInfiniteMana`.
// (2) With infinite mana the payment plan only needs the coloured symbols (the pool holds 15 of each), so any X, multikicker or replicate count can be paid (`planPayment`
//     wrapper); `maxX` / `maxKick` / `maxRep` (06-engine.js) search for the real limit instead of stopping at 30 / 20 / 60.
const INF_UNTAPPERS = [
    { name: 'Staff of Domination', cost: 4, find: (P, C) => P.bf.find(x => x.card.name === 'Staff of Domination') },
    { name: 'Sword of the Paruns', cost: 3, find: (P, C) => P.bf.find(x => x.card.name === 'Sword of the Paruns' && x.attachedTo === C.uid) },
    { name: 'Umbral Mantle', cost: 3, pump: 999, find: (P, C) => P.bf.find(x => x.card.name === 'Umbral Mantle' && x.attachedTo === C.uid) },
];
function genericLoop(P) {
    if (!P || P.out || infiniteNow(P)) return null;
    for (const C of P.bf) {
        if (!isCreature(C) || C.tapped || (C.sick && !has(C, 'haste')) || lostAbilities(C)) continue;
        let m = null; try { m = manaOf(C); } catch (e) { m = null; }
        if (!m || m.fee || !(m.n > 0)) continue;
        const gain = (m.n || 1) * (m.fixed && new Set(m.colors).size > 1 ? m.colors.length : 1);
        for (const U of INF_UNTAPPERS) {
            const u = U.find(P, C); if (!u || gain <= U.cost) continue;
            return { name: `${C.card.name} and ${U.name}`, pump: U.pump || 0, target: U.pump ? C : null, creature: C };
        }
    }
    return null;
}
{
    const lof = loopOfferFor;
    loopOfferFor = function (P) {
        const r = lof.apply(this, arguments); if (r) return r;
        if (!P || P.isAI) return null;
        const g = genericLoop(P);
        return g ? { lp: { name: g.name }, on: { infinite: true, pump: g.pump, target: g.target } } : null;
    };
}
async function genericGoOff(P) {
    if (P.planLoopTurn === G.turn || infiniteNow(P)) return false;
    const g = genericLoop(P); if (!g) return false;
    P.planLoopTurn = G.turn; giveInfiniteMana(P, g.name);
    if (g.pump && g.target) { g.target.tp += g.pump; g.target.tq += g.pump; log(`${g.target.card.name} gets +${g.pump}/+${g.pump} from the loop (every pass pumps it again).`); }
    return true;
}
{
    const am = aiMain;
    aiMain = async function (P) {
        const ok = P && P.isAI && P.aiLevel !== 'easy' && tn(P, 'plans') !== 0 && G.active === P.i && !G.over;
        if (ok) { try { await genericGoOff(P); } catch (e) { /* keep playing */ } }
        let r = await am.apply(this, arguments);
        if (ok && !G.over) { let went = false; try { went = await genericGoOff(P); } catch (e) { /* keep playing */ } if (went) r = await am.apply(this, arguments); }
        return r;
    };
}
{
    const pp = planPayment;
    planPayment = function (P, cost, extra, exclude, opts) {
        if (P && infiniteNow(P) && cost) return pp.call(this, P, { ...cost, generic: 0 }, 0, exclude, opts || {});
        return pp.apply(this, arguments);
    };
}
