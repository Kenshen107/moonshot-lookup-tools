// =====================================================================
// The opponent. Simple, readable heuristics: play a land, spend mana on
// the best play it can afford, attack when it's safe or lethal, and
// block to survive or to make good trades.
// =====================================================================
const creatureValueCard = o => (Number(o.card.power) || 0) + (Number(o.card.toughness) || 0) + (o.card.cmc || 0);
function creatureValue(o) {
    return pow(o) * 1.5 + tou(o) + (has(o, 'flying') ? 2 : 0) + (has(o, 'deathtouch') ? 2 : 0) + (has(o, 'lifelink') ? 1 : 0)
        + (has(o, 'first strike') || has(o, 'double strike') ? 1.5 : 0) + (has(o, 'trample') ? 1 : 0) + (o.card.cmc || 0) * 0.3 + (o.isCommander ? 3 : 0);
}

function aiPickTarget(P, e, source, valid) {
    valid = valid || validTargets(P, e, source);
    const O = opp(P);
    const theirs = valid.filter(v => v.o && v.o.owner !== P.i);
    const mine = valid.filter(v => v.o && v.o.owner === P.i);
    const byValue = list => list.slice().sort((a, b) => creatureValue(b.o) - creatureValue(a.o));
    switch (e.t) {
        // ---- Magic 2010 (2026-10-08) ----
        case 'harmsWay': return { p: O };
        case 'animateWhile': return mine.filter(v => !isCreature(v.o)).sort((a, b) => (a.o.tapped ? 1 : 0) - (b.o.tapped ? 1 : 0))[0] || null;
        case 'stoneGiant': return mine.filter(v => isCreature(v.o) && tou(v.o) < pow(source) && v.o !== source && !has(v.o, 'flying')).sort((a, b) => pow(b.o) - pow(a.o))[0] || null;
        case 'wildHunt': { const n = P.bf.filter(w => isCreature(w) && !w.tapped && hasType(w, 'Wolf')).reduce((a, w) => a + Math.max(0, pow(w)), 0); return byValue(theirs.filter(v => isCreature(v.o) && tou(v.o) - v.o.dmg <= n))[0] || null; }
        case 'mustAttackT': return null;
        case 'polymorph': return byValue(theirs)[0] || null;
        // ---- Mirrodin (2026-10-08) ----
        case 'augur': return { p: P };
        case 'lookHand': case 'exileGyCard': case 'prisonImprint': case 'oppHandToTop': case 'noUntapNext': case 'mustAttackAll': case 'discardUnlessArt': case 'mindslave': return { p: O };
        case 'toBottomOwn': case 'exileUntilLeaves': case 'preventNext': return null;
        case 'razorBarrier': case 'regenTarget': case 'fateCounter': { const own = valid.filter(v => v.o && v.o.owner === P.i && !/\bLand\b/.test(v.o.card.type)).sort((a, b) => permValue(b.o) - permValue(a.o)); return own[0] || null; }
        case 'borrowActs': { const w = valid.filter(v => v.o && v.o !== source && actsOf(v.o).length).sort((a, b) => actsOf(b.o).length - actsOf(a.o).length); return w[0] || null; }
        case 'unattachEquip': { const w = theirs.filter(v => allPerms().some(a => a.attachedTo === v.o.uid && /Equipment/.test(a.card.type))); return w[0] || null; }
        case 'aweStrike': return byValue(theirs.filter(v => G.attackers.includes(v.o.uid)))[0] || byValue(theirs)[0] || null;
        case 'toTop': case 'detonate': case 'glissa': case 'exileImprint': { const w = theirs.slice().sort((a, b) => permValue(b.o) - permValue(a.o)); return w[0] || null; }
        case 'gambit': case 'proteus': return byValue(theirs)[0] || null;
        case 'charbelcher': case 'sacFling': return { p: O };
        case 'namedCounterTarget': { const own = mine.filter(v => /Artifact/.test(v.o.card.type)); return own[0] || null; }
        case 'removeAllCounters': { // Marchesa: their +1/+1 counters and loyalty, or our -1/-1 counters
            const gain = v => (v.o.owner !== P.i ? Math.max(0, v.o.counters) + (v.o.ctr.loyalty || 0) : Math.max(0, -v.o.counters) + (v.o.ctr.stun || 0)) + (isBattle(v.o) && v.o.owner !== P.i ? v.o.ctr.defense || 0 : 0);
            const best = valid.filter(v => v.o && gain(v) > 0).sort((a, b) => gain(b) - gain(a))[0];
            return best || null;
        }
        case 'dmg': {
            if (e.target === 'player') return { p: O };
            const killable = byValue(theirs.filter(v => tou(v.o) - v.o.dmg <= e.n && !has(v.o, 'indestructible')));
            if (e.target === 'any' && O.life <= e.n) return { p: O };
            if (killable.length && creatureValue(killable[0].o) >= 3) return killable[0];
            if (e.target === 'any') return { p: O };
            return killable[0] || null;
        }
        case 'destroy': case 'exile': case 'bounce': case 'tap':
            if (e.target === 'perm') return theirs.filter(v => e.t !== 'destroy' || !has(v.o, 'indestructible')).sort((a, b) => permValue(b.o) - permValue(a.o))[0] || null;
            return byValue(theirs.filter(v => e.t !== 'destroy' || !has(v.o, 'indestructible')))[0] || null;
        case 'untap': if (e.only === 'attacking creature') return valid.filter(v => v.o && v.o.owner !== P.i).sort((a, b) => pow(b.o) - pow(a.o))[0] || null; return mine.sort((a, b) => permValue(b.o) - permValue(a.o)).find(v => v.o.tapped) || null;
        case 'fight': {
            const champ = (e.self ? [source] : P.bf.filter(isCreature)).filter(Boolean).sort((a, b) => pow(b) - pow(a))[0];
            if (!champ || !onBf(champ.uid)) return null;
            return byValue(theirs.filter(v => isCreature(v.o) && tou(v.o) - v.o.dmg <= pow(champ) && (pow(v.o) < tou(champ) - champ.dmg || creatureValue(v.o) > creatureValue(champ))))[0] || null;
        }
        case 'pump':
            if (e.good) return byValue(mine)[0] || null;
            return byValue(theirs.filter(v => tou(v.o) + e.q - v.o.dmg <= 0))[0] || byValue(theirs)[0] || null;
        case 'counters':
            // Backup: another creature also gets the abilities, so put it there
            if (e.backup) return byValue(mine.filter(v => v.o !== source && isCreature(v.o)))[0] || byValue(mine)[0] || null;
            return byValue(mine)[0] || null;
        case 'counter':
            return valid.filter(v => v.item && v.item.P !== P).pop() || null;
        case 'chaosWarp': return theirs.sort((a, b) => permValue(b.o) - permValue(a.o))[0] || null;
        case 'bounceAllOf': case 'commandersHome': return { p: O };
        case 'reflection': case 'tempt': return byValue(mine.filter(v => isCreature(v.o)))[0] || null;
        case 'drawPowTarget': return mine.filter(v => isCreature(v.o)).sort((a, b) => pow(b.o) - pow(a.o))[0] || null;
        case 'markMine': return byValue(mine.filter(v => !e.withCounters || v.o.counters > 0)).sort((a, b) => pow(b.o) - pow(a.o))[0] || null;
        case 'biteDmg': case 'fightLast': case 'powDmg': {
            const from = e.t === 'powDmg' && Rx(source).kind === 'creature' ? source : (G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o) || P.bf.filter(isCreature).sort((a, b) => pow(b) - pow(a))[0];
            const n = from ? pow(from) * (e.mult || 1) : 0;
            if (e.target === 'player') return { p: O };
            return byValue(theirs.filter(v => isCreature(v.o) && tou(v.o) - v.o.dmg <= n))[0] || byValue(theirs)[0] || null;
        }
        case 'connive': case 'moveCounters': case 'attachSelf': case 'attachAllEquip': case 'doubleCounters': return byValue(mine.filter(v => isCreature(v.o)))[0] || null;
        case 'attachEquipToSelf': return mine.sort((a, b) => permValue(b.o) - permValue(a.o))[0] || null;
        case 'landMana': return mine.find(v => !v.o.tapped) || mine[0] || null;
        case 'freeze': return byValue(theirs)[0] || null;
        case 'stealWhile': return byValue(theirs)[0] || null;
        case 'tokenCopy': return valid.slice().sort((a, b) => permValue(b.o) - permValue(a.o))[0] || null;
        case 'bounceSpell': return valid.filter(v => v.item && v.item.P !== P).pop() || null;
        case 'peer': return P.life >= 10 && P.library.length > 12 ? { p: P } : { p: O };
        case 'topdeck': return theirs.sort((a, b) => permValue(b.o) - permValue(a.o))[0] || null;
        case 'steal': return byValue(theirs)[0] || null;
        case 'aura':
            return e.good ? (byValue(mine)[0] || null) : (byValue(theirs)[0] || null);
        default:
            return valid[0] || null;
    }
}

// How much a play is worth right now (0 = don't).
function aiScore(P, o, target) {
    const r = Rx(o);
    const O = opp(P);
    if (r.legendary && P.bf.some(x => x.card.name === o.card.name)) return 0; // the legend rule would bin one
    if (r.kind === 'creature') return 10 + (o.card.cmc || 0) * 2 + creatureValue(o) * 0.5;
    if (r.isAura) return target ? 6 + r.buff.p + r.buff.q : 0;
    if (r.isEquipment) return P.bf.some(isCreature) ? 5 : 1;
    if (r.kind === 'artifact' || r.kind === 'enchantment') return r.mana ? 9 : 4;
    if (r.kind === 'battle') return 6 + Math.max(r.etb.length ? scoreEffects(P, r.etb, null, o) : 0, ...(r.etbModes || []).map(fx => scoreEffects(P, fx, null, o)));
    let fx = spellEffects(o);
    if (r.cost.x) fx = withX(fx, o.xVal || maxX(P, o));
    return scoreEffects(P, fx, target, o);
}
function scoreEffects(P, effects, target, src) {
    const O = opp(P);
    let score = 0;
    for (let e of effects || []) {
        if (e.nCount || e.nFrom) e = { ...e, n: dynN(P, e, src) };
        // Starter kits (2026-10-06)
        const sk = { amass: 4 + (e.n || 0), tokenCopy: target && target.o ? 5 + permValue(target.o) / 2 : 0, consumingTide: allPerms().filter(x => x.owner !== P.i && !/\bLand\b/.test(x.card.type)).length >= 2 ? 6 : 0,
            peer: target && target.p === P ? 6 : target && target.p ? (O.library.length < 14 ? 1000 : 2) : 0, stealWhile: target && target.o ? 8 + creatureValue(target.o) : 0, digLand: 3, topLandOrHand: 3, revealToLand: 4,
            bounceSpell: target && target.item ? 4 : 0, freeze: 1, tutorNamed: 3, landMana: 1, exileHost: 6, countersMade: 2, doubleCounters: 2, attachAllEquip: 1, attachSelf: 1, attachEquipToSelf: 1, gollum: 1, asmoReturn: 0, selfToLibrary: 0, pumpChoice: 0, arni: 0, unearth: 4 };
        if (e.t in sk) { score += sk[e.t]; continue; }
        const t = needsTarget(e) ? target : null;
        if (needsTarget(e) && !t) return 0;
        switch (e.t) {
            case 'dmg':
                if (e.target === 'opponents' || (t && t.p)) score += O.life <= e.n ? 1000 : (G.phase === 'main2' && !O.bf.some(isCreature) ? 4 : 1);
                else if (e.target === 'allCreatures' || e.target === 'oppCreatures') {
                    const kill = c => tou(c) - c.dmg <= e.n && !has(c, 'indestructible');
                    const theirs = O.bf.filter(isCreature).filter(kill).reduce((a, c) => a + creatureValue(c), 0);
                    const ours = e.target === 'allCreatures' ? P.bf.filter(isCreature).filter(kill).reduce((a, c) => a + creatureValue(c), 0) : 0;
                    score += theirs - ours > 5 ? theirs - ours : 0;
                } else if (t && t.o) score += t.o.owner !== P.i && tou(t.o) - t.o.dmg <= e.n ? 6 + creatureValue(t.o) : 0;
                break;
            case 'destroy': case 'exile': score += t && t.o.owner !== P.i && permValue(t.o) >= 4 ? 7 + permValue(t.o) : 0; break;
            case 'bounce': score += t && t.o.owner !== P.i && permValue(t.o) >= 6 ? 4 + permValue(t.o) / 2 : 0; break;
            case 'wipe': case 'massBounce': {
                const hit = x => wipeMatches(x, e.what, P) && (e.t === 'massBounce' || e.how === 'exile' || !has(x, 'indestructible'));
                const diff = O.bf.filter(hit).reduce((a, x) => a + permValue(x), 0) - P.bf.filter(hit).reduce((a, x) => a + permValue(x), 0);
                score += diff > 6 ? diff : 0;
                break;
            }
            case 'teamPump': { const n = P.bf.filter(canAttackWith).length; score += G.phase === 'main1' && n >= 3 ? n * 1.5 : 0; break; }
            case 'teamCounters': score += 2 + P.bf.filter(isCreature).length * 2; break;
            case 'edict': score += e.who === 'each player' ? (O.bf.some(isCreature) && !P.bf.some(isCreature) ? 6 : 0) : (O.bf.some(isCreature) ? 5 : 0); break;
            case 'loot': score += 3; break;
            case 'drawAll': score += 1; break;
            case 'loseAll': score += O.life <= e.n ? 1000 : P.life > O.life ? 2 : 0; break;
            case 'discardAll': score += O.hand.length > P.hand.length ? 2 : 0; break;
            case 'fetchLand': score += P.library.some(x => landFits(x, e.what)) ? 6 : 0; break;
            case 'tutor': score += 5; break;
            case 'regrow': score += P.gy.some(x => cardFits(x, e.what)) ? 5 + (e.bf ? 3 : 0) : 0; break;
            case 'artToken': score += 2 + e.n * 1.5; break;
            case 'fight': score += t && t.o.owner !== P.i ? 6 + creatureValue(t.o) : 0; break;
            case 'untap': score += 0.5; break;
            case 'proliferate': score += 2; break;
            case 'dig': score += 4; break;
            case 'surveil': score += 1; break;
            case 'monarch': score += G.monarch === P.i ? 1 : 6; break;
            case 'addMana': case 'copySpell': score += 0; break;
            case 'animate': score += G.phase === 'main1' && src && !src.sick && G.active === P.i && !src.tapped ? 2 + e.p : 0; break;
            case 'exileTop': score += e.play !== undefined ? 3 + e.n : 0; break;
            case 'extraTurn': score += 20; break;
            case 'castFreeHand': score += P.hand.some(x => Rx(x).kind !== 'land' && (x.card.cmc || 0) <= e.mv && (x.card.cmc || 0) >= 2) ? 6 : 0; break;
            case 'discover': score += 2 + e.n; break;
            // Brudiclad deck (2026-10-07)
            case 'chaosWarp': score += t && t.o && t.o.owner !== P.i ? 2 + permValue(t.o) : -5; break;
            case 'bounceAllOf': { const n = O.bf.filter(x => !/\bLand\b/.test(x.card.type)).reduce((a, x) => a + permValue(x), 0) - P.bf.filter(x => !/\bLand\b/.test(x.card.type)).length; score += n > 4 ? n : -5; break; }
            case 'commandersHome': score += O.bf.some(x => x.isCommander) ? 6 : -5; break;
            case 'dmgCreaturesPws': { const k = (X, sg) => X.bf.filter(x => (isCreature(x) && tou(x) - x.dmg <= e.n) || isPlaneswalker(x)).reduce((a, x) => a + sg * permValue(x), 0); score += k(O, 1) + k(P, -1); break; }
            case 'tempt': case 'reflection': score += t && t.o ? 3 + creatureValue(t.o) / 2 : -5; break;
            case 'reshape': case 'brudiclad': case 'battlesphere': case 'treasureMap': case 'imprintCopy': case 'vatCopy': case 'putFromHand': case 'emryMark': score += 3; break;
            case 'gearhulk': case 'factFiction': score += 6; break;
            case 'discardDrawUpTo': case 'nextAffinity': case 'imprintHand': case 'windfallMay': score += 1; break;
            case 'darettiSwap': score += P.gy.some(x => /\bArtifact\b/.test(x.card.type) && (x.card.cmc || 0) >= 3) ? 5 : -5; break;
            case 'copyEachArtifact': score += P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length * 2; break;
            case 'stealArtifacts': case 'winGame': score += 10; break;
            case 'hellkiteWipe': score += 4; break;
            case 'dmgOpp': score += e.n || 2; break;
            case 'emblem': score += 8; break;
            // Sandman deck (2026-10-07)
            case 'drawPowTarget': score += 3 + Math.max(0, ...P.bf.filter(isCreature).map(pow)); break;
            case 'spry': { const ps = P.bf.filter(isCreature).map(pow); score += ps.length >= 2 ? 2 + Math.max(...ps) - Math.min(...ps) : -5; break; }
            case 'genesis': score += 3 + (e.n || 0) * 2; break;
            case 'regrowBudget': case 'caradhras': score += P.gy.length ? 6 : 3; break;
            // ---- Magic 2010 (2026-10-08) ----
            case 'harmsWay': score += G.attackers.length && G.active !== P.i ? 4 : 1; break;
            case 'safePassage': score += G.attackers.length && G.active !== P.i ? 3 + G.attackers.reduce((a, u) => a + (onBf(u) ? pow(onBf(u)) : 0), 0) : -2; break;
            case 'hauntingEchoes': score += O.gy.filter(x => !isBasic(x.card)).length * 0.5; break;
            case 'openVaults': { const v = c => /Artifact|Enchantment/.test(c.card.type) && !/Aura/.test(c.card.type); score += P.gy.filter(v).length * 2 - O.gy.filter(v).length * 2; break; }
            case 'polymorph': score += t && t.o ? (t.o.owner !== P.i ? creatureValue(t.o) - 2 : -5) : -5; break;
            case 'millHalf': score += 2 + Math.floor(O.library.length / 2) * 0.1; break;
            case 'warpWorld': score += (P.bf.length < O.bf.length ? 4 : -6); break;
            case 'zombify': break;
            case 'dmgPartners': case 'freezePartners': case 'destroySelf': score += 0; break;
            case 'mustAttackT': score += 0; break;
            case 'reaper': score += G.players.some(X => X.gy.some(c => /Creature/.test(c.card.type))) ? 4 : -5; break;
            case 'pumpHost': score += G.attackers.length && G.active === P.i ? 1 : -1; break;
            case 'dmgYou': score -= e.n * (P.life <= e.n * 2 ? 5 : 0.4); break;
            case 'stoneGiant': score += t && t.o ? 1 + pow(t.o) - 2 : -5; break;
            case 'wildHunt': score += t && t.o ? creatureValue(t.o) : -5; break;
            case 'mirrorFate': score -= 50; break;
            case 'djinnWish': score += P.library.length > 5 ? 4 : -5; break;
            case 'dmgPlayerAndCreatures': score += e.n + O.bf.filter(isCreature).reduce((a, c) => a + creatureValue(c), 0) - P.bf.filter(isCreature).length; break;
            case 'lifeAvatar': score += P.life / 2; break;
            case 'animateWhile': score += t && t.o && t.o.owner === P.i ? 4 : -3; break;
            case 'efreet': case 'hiveMind': case 'lurking': case 'sphinxAmb': case 'xathrid': score += 1; break;
            // ---- Mirrodin (2026-10-08) ----
            case 'detonate': case 'glissa': score += t && t.o && t.o.owner !== P.i ? 3 + permValue(t.o) : -5; break;
            case 'sacFling': score += P.bf.some(x => isCreature(x) && (x.stolenTurn === G.turn || pow(x) >= O.life)) ? 8 : 0; break;
            case 'augur': case 'revealArt': case 'shuffleSelf': case 'lookHand': case 'pendulum': case 'fateCounter': case 'namedCounterTarget': case 'chokerAdjust': case 'mournerShield': case 'urnMana': score += 1; break;
            case 'tajNar': score += P.library.some(x => /Equipment/.test(x.card.type)) ? 4 : 0; break;
            case 'prisonImprint': case 'oppHandToTop': case 'exileGyCard': score += O.hand.length || O.gy.length ? 2 : 0; break;
            case 'gambit': score += 3; break;
            case 'spoils': score += 3; break;
            case 'grimReminder': score += 3; break;
            case 'charbelcher': score += 3 + Math.min(5, P.library.length ? 3 : 0); break;
            case 'incubator': score += P.library.filter(x => /Artifact/.test(x.card.type)).length * 2; break;
            case 'oStone': score += allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !(x.ctr.fate > 0)).reduce((a, x) => a + (x.owner === P.i ? -permValue(x) : permValue(x)), 0); break;
            case 'proteus': score += t && t.o && t.o.owner !== P.i ? creatureValue(t.o) - 2 : 0; break;
            case 'castImprintCopy': score += 3; break;
            case 'secondSunrise': score += G.players.reduce((a, X) => a + X.gy.filter(x => x.toGyTurn === G.turn).length * (X === P ? 2 : -2), 0); break;
            case 'timetwister': score += P.hand.length < 2 ? 4 : -2; break;
            case 'aweStrike': score += t && t.o ? Math.max(0, pow(t.o)) : 0; break;
            case 'discardUnlessArt': score += t && t.p === O ? 2 : P.hand.some(x => /Artifact/.test(x.card.type)) ? 2 : -1; break;
            case 'toTop': score += t && t.o && t.o.owner !== P.i ? 2 + permValue(t.o) / 2 : 0; break;
            case 'regenTarget': case 'regenAll': case 'preventNext': case 'razorBarrier': score += G.attackers.length ? 2 : 0; break;
            case 'exileLibrary': score -= 100; break;
            case 'untapAllMine': score += P.bf.filter(x => isCreature(x) && x.tapped).length; break;
            case 'extraLands': score += Math.min(2, P.hand.filter(x => Rx(x).kind === 'land').length) * 2; break;
            case 'putFromHandN': score += P.hand.filter(x => cardFits(x, e.what)).reduce((a, x) => a + (x.card.cmc || 0), 0); break;
            case 'unattachEquip': score += t ? 2 : 0; break;
            case 'noUntapNext': score += O.bf.filter(isCreature).length; break;
            case 'mustAttackAll': score += 1; break;
            case 'exileWithEquip': case 'exileImprint': score += t && t.o && t.o.owner !== P.i ? 3 + permValue(t.o) : -5; break;
            case 'helixImprint': case 'helixCopy': score += 2; break;
            case 'attachAllEquipAll': score += allPerms().filter(a => /Equipment/.test(a.card.type)).length * 2; break;
            case 'chokerPass': case 'peacekeeper': case 'rustElem': case 'coils': case 'crown': case 'timesift': case 'gateAether': case 'fatespin': case 'floodLand': case 'unflood': case 'activeSacArt': case 'warElemental': case 'confusion': score += 0; break;
            case 'mindslave': score += 6; break;
            case 'cullLowest': score += 2; break;
            case 'worldslay': score += allPerms().reduce((a, x) => a + (x.owner === P.i ? -permValue(x) : permValue(x)), 0); break;
            case 'borrowActs': score += t ? 2 : 0; break;
            case 'permAnimatePT': score += G.active === P.i && G.phase === 'main1' ? 2 : 0; break;
            case 'dmgAttackersNoFly': score += G.attackers.map(onBf).filter(x => x && x.owner !== P.i && !has(x, 'flying') && tou(x) - x.dmg <= e.n).length * 4; break;
            case 'exileUntilLeaves': case 'toBottomOwn': case 'nimDevour': case 'scytheReturn': case 'loyaltyFracture': case 'destroyBlockers': case 'destroyCombatPair': case 'exileCtx': case 'ctxCtlLoseN': case 'regrowNamed': case 'casterMana': case 'dmgCtxPlayer': case 'dmgSelfCharge': case 'hostCtlLose': score += 0; break;
            case 'blackSun': score += allPerms().filter(x => isCreature(x) && (x.card.cmc || 0) <= e.n).reduce((a, x) => a + (x.owner === P.i ? -creatureValue(x) : creatureValue(x)), 0); break;
            case 'espers': score += O.gy.some(x => /Creature/.test(x.card.type)) ? 6 : 1; break;
            case 'thrinax': case 'emissary': case 'willow': case 'shadowThrow': case 'gitrogRide': case 'grantEscape': score += 3; break;
            case 'conscription': score += O.gy.some(x => Rx(x).kind === 'creature') ? 6 + Math.max(...O.gy.filter(x => Rx(x).kind === 'creature').map(x => x.card.cmc || 0)) : 0; break;
            case 'onceFuture': score += P.gy.length ? 4 : 0; break;
            case 'rejoin': score += P.gy.some(x => Rx(x).kind === 'creature') ? 6 : 2; break;
            case 'exileGyGain': score += t && t.p ? t.p.gy.length / 2 : 0; break;
            case 'upheaval': score += P.bf.some(isCreature) ? P.gy.filter(x => /Creature/.test(x.card.type)).length * 1.5 : 0; break;
            case 'victimize': score += P.gy.filter(x => Rx(x).kind === 'creature').length >= 2 && P.bf.some(isCreature) ? 8 : 0; break;
            case 'powDoubleN': score += t && t.o && t.o.owner === P.i && G.active === P.i && G.phase === 'main1' && !t.o.sick ? Math.min(30, pow(t.o) * (2 ** Math.min(Number(e.n) || 0, 5) - 1)) / 2 : 0; break;
            case 'oppLoseCounters': score += (O.poison || 0) + (O.energy || 0) / 2; break;
            case 'removeAllCounters': score += t && t.o && t.o.owner !== P.i ? Math.max(0, t.o.counters) + 1 : 0; break;
            case 'oppExileTop': score += 1; break;
            case 'animateLands': score += G.active === P.i && G.phase === 'main1' ? P.bf.filter(x => /\bLand\b/.test(x.card.type) && !x.sick).length : 0; break;
            case 'discoverExcess': case 'colossus': case 'druidPurify': score += 3; break;
            case 'conduit': score += P.gy.some(x => !['instant', 'sorcery', 'land'].includes(Rx(x).kind)) ? 5 : -5; break;
            case 'flashTurn': score += 0; break;
            case 'discardPick': score += O.hand.length ? 4 : 0; break;
            case 'untapLands': case 'freezeLast': score += 1; break;
            case 'protChoice': score += 0; break;
            case 'selfBounce': case 'sacSelf': score -= 1; break;
            case 'draw': score += 5 + e.n; break;
            case 'gain': score += P.life < 10 ? 4 : 1; break;
            case 'drain': score += O.life <= e.n ? 1000 : 4; break;
            case 'discard': score += O.hand.length ? 3 : 0; break;
            case 'mill': score += 2 + e.n * 0.3 + (O.library.length <= e.n ? 1000 : 0); break;
            case 'counters': score += e.target === 'self' ? 3 : t ? 4 : 0; break;
            case 'pump': score += e.target === 'self' || e.good ? 0 : (t && t.o.owner !== P.i && tou(t.o) + e.q - t.o.dmg <= 0 ? 6 + creatureValue(t.o) : 0); break;
            case 'token': score += 5 + e.n * 2; break;
            case 'pumpOld': break;
            case 'tap': score += 0; break;
            case 'loseSelf': score -= e.n; break;
            case 'scry': score += 0.5; break;
            case 'markMine': score += t && t.o.owner === P.i ? 0 : -50; break;
            case 'biteDmg': case 'fightLast': case 'powDmg': { const from = (t && t.o && P.bf.filter(isCreature).sort((a, b) => pow(b) - pow(a))[0]); score += t && t.o && from && t.o.owner !== P.i && tou(t.o) - t.o.dmg <= pow(from) ? 6 + creatureValue(t.o) : t && t.p ? 2 : 0; break; }
            case 'oppPump': score += O.bf.filter(c => isCreature(c) && tou(c) + e.q - c.dmg <= 0).reduce((a, c) => a + creatureValue(c), 0) + (e.p < 0 ? 1 : 0); break;
            case 'doublePower': case 'groundCantBlock': score += G.phase === 'main1' && G.active === P.i && P.bf.filter(canAttackWith).length >= 2 ? 6 : 0; break;
            case 'topdeck': score += t && t.o.owner !== P.i ? 4 + permValue(t.o) / 2 : 0; break;
            case 'connive': case 'millPick': case 'keepTop': case 'populate': score += 3; break;
            case 'gainAll': score += 1; break;
            case 'lastCtrlLose': case 'lastCtrlDmg': score += e.n; break;
            case 'fogSelf': case 'fogNoCounters': score += G.active !== P.i && G.attackers.length ? 5 : 0; break;
            case 'counterPowDmg': case 'revealHand': case 'lastAllKw': case 'moveCounters': case 'millToLand': score += 1; break;
        }
    }
    return score;
}

// How bad something on the stack is for P (0 if it's P's own).
function stackThreat(item, P) {
    if (item.P === P) return 0;
    if (item.kind === 'trigger') return item.effects.some(e => ['dmg', 'destroy', 'exile', 'bounce', 'drain'].includes(e.t)) ? 4 : 1;
    const r = Rx(item.o);
    const t = item.target;
    let v = (item.o.card.cmc || 0) * 0.5;
    if (r.kind === 'creature') v += 2 + creatureValue(item.o) * 0.5;
    if (r.isAura || r.isEquipment) v += 3;
    for (const e of r.spell || []) {
        if (['destroy', 'exile', 'bounce'].includes(e.t) && t && t.o && t.o.owner === P.i) v += 3 + creatureValue(t.o);
        if (e.t === 'dmg' && t && t.p === P) v += P.life <= e.n ? 100 : e.n;
        if (e.t === 'dmg' && t && t.o && t.o.owner === P.i && tou(t.o) - t.o.dmg <= e.n) v += 2 + creatureValue(t.o);
        if (e.t === 'dmg' && e.target === 'opponents') v += P.life <= e.n ? 100 : e.n;
        if (e.t === 'drain') v += P.life <= e.n ? 100 : e.n;
        if (e.t === 'draw') v += 2 + e.n;
        if (e.t === 'token') v += 2 * e.n;
        if (e.t === 'counter' && t && t.item && t.item.P === P) v += 3 + stackThreat({ ...t.item, P: item.P }, P);
    }
    return v;
}

// The opponent's answer when it gets priority with something on the stack:
// counter what's worth countering, save a targeted creature with a trick,
// or burn for lethal.
function aiRespond(P, top) {
    if (top.P === P || P.aiLevel === 'easy') return null;
    const opts = P.hand.filter(o => (Rx(o).kind === 'instant' || Rx(o).flash) && canCastNow(P, o) && canPay(P, o));
    for (const o of [...opts, ...P.hand.filter(x => !opts.includes(x) && Rx(x).alt && Rx(x).kind === 'instant' && canCastNow(P, x) && altOk(P, x))]) {
        const ce = (Rx(o).spell || []).find(e => e.t === 'counter');
        if (ce && stackMatches(top, ce.filter) && stackThreat(top, P) >= (opts.includes(o) ? 5 : 7)) { if (!opts.includes(o)) o.altCast = true; return { o, target: { item: top } }; }
    }
    const mine = top.target && top.target.o && top.target.o.owner === P.i && onBf(top.target.o.uid) ? top.target.o : null;
    if (mine && top.kind === 'spell') {
        const eff = (Rx(top.o).spell || []).find(needsTarget);
        for (const o of opts) {
            const pe = (Rx(o).spell || []).find(e => e.t === 'pump' && e.good);
            if (!pe || !eff) continue;
            const saves = (eff.t === 'dmg' && tou(mine) + pe.q - mine.dmg > eff.n)
                || (eff.t === 'pump' && !eff.good && tou(mine) + pe.q + eff.q - mine.dmg > 0)
                || ((eff.t === 'destroy' || eff.t === 'dmg') && pe.kw.includes('indestructible'))
                || pe.kw.includes('hexproof') || pe.kw.includes('shroud');
            if (saves && creatureValue(mine) >= 3) return { o, target: { o: mine } };
        }
    }
    const O = opp(P);
    for (const o of opts) {
        const de = (Rx(o).spell || []).find(e => e.t === 'dmg' && (e.target === 'any' || e.target === 'player'));
        if (de && O.life <= de.n) return { o, target: { p: O } };
    }
    return null;
}

// AI levels (campaign): easy picks a random good play 40% of the time and
// never responds; hard saves removal for real threats, and a control deck
// keeps mana up for its counterspells and instant removal.
function heldInstantCost(P) {
    const held = P.hand.filter(o => Rx(o).kind === 'instant' && (Rx(o).spell || []).some(e => ['counter', 'destroy', 'exile', 'dmg'].includes(e.t)));
    return held.length ? Math.min(...held.map(o => o.card.cmc || 0)) : 0;
}
function aiBestPlay(P) {
    const cands = [];
    const O = opp(P);
    const untapped = P.bf.filter(o => !o.tapped && Rx(o).mana).length;
    const reserve = P.aiStyle === 'control' && P.aiLevel !== 'easy' && G.active === P.i && O.hand.length ? heldInstantCost(P) : 0;
    const faces = [];
    const libTop = P.library[P.library.length - 1];
    for (const o of [...P.hand, ...P.command, ...P.gy.filter(x => Rx(x).flashback || mayhemOk(P, x) || gyCastOk(P, x) || x.gyCastTurn === G.turn || (Rx(x).gyCast && Rx(x).gyCast.exile) || castAsOk(P, x, 'blitz') || lockerOk(P, x)), ...P.exile.filter(x => x.playUntil >= G.turn || x.advReady || (x.foretoldTurn && x.foretoldTurn < G.turn) || (x.warpedTurn && x.warpedTurn < G.turn)), ...(libTop && ((P.bf.some(x => Rx(x).castTopCreatures) && Rx(libTop).kind === 'creature') || pitTop(P) === libTop) ? [libTop] : [])]) {
        faces.push([o, o.front || o.card]);
        if (P.hand.includes(o) && o.front && o.front.back && ['modal_dfc', 'adventure', 'split'].includes(o.front.layout) && rulesFor(o.front.back).kind !== 'land') faces.push([o, o.front.back]);
        if (P.hand.includes(o) && Rx(o).overload) faces.push([o, o.card, true]);
        if (P.hand.includes(o) && Rx(o).evoke && Rx(o).etb.length && !canPay(P, o)) faces.push([o, o.card, false, true]);
        if (Rx(o).alt && !canPay(P, o) && altOk(P, o)) faces.push([o, o.card, false, false, true]);
        for (const md of ['warp', 'bestow', 'blitz', 'dash', 'energy', 'escape']) if (castAsOk(P, o, md)) faces.push([o, o.card, false, false, false, md]);
    }
    for (const [o, face, ov, ev, alt, md] of faces) {
        o.card = face;
        o.overloaded = !!ov;
        o.evoked = !!ev;
        o.altCast = !!alt;
        o.castAs = md || null;
        if (!md && (P.gy.includes(o) && !(Rx(o).flashback || mayhemOk(P, o) || gyCastOk(P, o) || o.gyCastTurn === G.turn || Rx(o).gyCast))) continue; // only castable from there another way
        const r = Rx(o);
        if (r.kind === 'land' || !canCastNow(P, o) || !canPay(P, o)) continue;
        if (reserve && r.kind !== 'instant' && (o.card.cmc || 0) > untapped - reserve) continue; // hold mana up
        if (r.kicker) o.kicked = canKick(P, o);
        if (r.multikicker) { o.kickN = maxKick(P, o); o.kicked = o.kickN > 0; } else o.kickN = 0;
        o.buyback = !!r.buyback && canBuyback(P, o) && (untapped - (o.card.cmc || 0)) >= 3;
        if (r.cost.x) o.xVal = maxX(P, o);
        if (r.xFromTarget) { const te0 = firstTargetEffect(o), t0 = te0 ? aiPickTarget(P, te0, o) : null; if (!t0 || !t0.o || (t0.o.card.cmc || 0) > o.xVal) continue; o.xVal = t0.o.card.cmc || 0; }
        if (r.teamwork) o.teamworked = !!teamworkCrew(P, o) && P.bf.filter(canAttackWith).length <= 1;
        if (r.modes && modeRange(P, r, o).max > 1) o.mode = aiPickModes(P, r, r.modes, o);
        else if (r.modes) { let bi = 0, bs = -1; r.modes.forEach((fx, i) => { o.mode = i; const te2 = firstTargetEffect(o); const t2 = te2 ? aiPickTarget(P, te2, o) : null; if (te2 && !t2) return; const sc = aiScore(P, o, t2); if (sc > bs) { bs = sc; bi = i; } }); o.mode = bi; }
        const te = firstTargetEffect(o);
        const target = te ? aiPickTarget(P, te, o) : null;
        if (te && !target) continue;
        let s = aiScore(P, o, target);
        if (P.aiLevel === 'hard' && target && target.o && target.o.owner !== P.i && ['destroy', 'exile', 'dmg'].includes(te.t) && creatureValue(target.o) < 5 && !(te.t === 'dmg' && target.p)) s = 0; // save it
        if (ev) s = s * 0.5 - 1;
        if (alt) s = s * 0.7 - 1;
        if (md === 'warp' || md === 'blitz' || md === 'dash') { o.castAs = null; const full = canPay(P, o) && !P.gy.includes(o); o.castAs = md; s = full ? 0 : s * 0.6; } // the real thing when it can
        if (md === 'bestow') s = target ? 6 + (o.card.cmc || 0) : 0;
        if (md === 'energy') s = s * 1.1 + 2;
        if (s > 0) cands.push({ o, target, s, face, ov: !!ov, ev: !!ev, alt: !!alt, md });
    }
    faces.forEach(([o]) => { o.card = o.front || o.card; o.overloaded = false; o.evoked = false; o.altCast = false; o.castAs = null; });
    if (!cands.length) return null;
    const pick = P.aiLevel === 'easy' && Math.random() < 0.4 ? cands[rand(cands.length)] : cands.sort((a, b) => b.s - a.s)[0];
    pick.o.card = pick.face; // cast the half it chose
    pick.o.overloaded = pick.ov;
    pick.o.evoked = pick.ev;
    pick.o.altCast = pick.alt;
    pick.o.castAs = pick.md || null;
    return pick;
}
// Hard AI: when you attack, kill the biggest attacker with instant removal before blocks
async function aiRemoveAttacker(P) {
    const atks = G.attackers.map(onBf).filter(Boolean).sort((a, b) => creatureValue(b) - creatureValue(a));
    if (!atks.length) return;
    for (const o of P.hand.filter(x => Rx(x).kind === 'instant' && canCastNow(P, x) && canPay(P, x))) {
        const e = (Rx(o).spell || []).find(x => ['destroy', 'exile'].includes(x.t) || (x.t === 'dmg' && ['creature', 'any'].includes(x.target)));
        if (!e) continue;
        const valid = validTargets(P, e, o);
        const t = atks.find(a => valid.some(v => v.o && v.o.uid === a.uid) && (e.t !== 'dmg' || tou(a) - a.dmg <= e.n) && !(e.t === 'destroy' && has(a, 'indestructible')));
        if (t && creatureValue(t) >= 4) { await pause(400); await castSpell(P, o, { o: t }); return; }
    }
}

function aiPlayLand(P) {
    if (P.landsPlayed >= landLimit(P)) return;
    let lands = [...P.hand, ...P.exile.filter(x => x.playUntil >= G.turn), ...extraLandZones(P)].filter(o => Rx(o).kind === 'land');
    // No land? A modal double-faced card's land side will do
    if (!lands.length) { const md = P.hand.find(o => o.front && o.front.back && o.front.layout === 'modal_dfc' && rulesFor(o.front.back).kind === 'land'); if (md) { md.card = md.front.back; lands = [md]; } }
    if (!lands.length) return;
    // The colors the hand still needs and the lands don't make
    const have = new Set(P.bf.filter(o => Rx(o).mana).flatMap(o => Rx(o).mana.colors));
    const want = new Set(P.hand.filter(o => Rx(o).kind !== 'land').flatMap(o => COLORS.filter(c => Rx(o).cost[c] > 0)));
    const score = l => (Rx(l).mana ? Rx(l).mana.colors.filter(c => want.has(c) && !have.has(c)).length * 3 + Rx(l).mana.colors.filter(c => want.has(c)).length : 0) - (Rx(l).entersTapped ? 1 : 0);
    const land = lands.sort((a, b) => score(b) - score(a))[0];
    playLand(P, land);
}

async function aiMain(P) {
    for (let k = 0; k < 3 && P.landsPlayed < landLimit(P); k++) { const before = P.landsPlayed; aiPlayLand(P); if (P.landsPlayed === before) break; }
    await settle();
    renderGame();
    await actDrain();
    for (let guard = 0; guard < 15 && !G.over; guard++) {
        const play = aiBestPlay(P);
        if (!play) break;
        await pause(500);
        const ok = await castSpell(P, play.o, play.target);
        await actDrain();
        if (!ok) break;
    }
    await aiUseAbilities(P);
    await actDrain();
    // Equip unattached equipment to the best creature
    for (const eq of P.bf.filter(o => Rx(o).isEquipment && Rx(o).equip !== null && !o.attachedTo)) {
        const cheap = Rx(eq).equipCheap, fits = P.bf.filter(c => isCreature(c) && equipOk(eq, c));
        const best = (cheap && fits.find(c => equipFits(c, cheap.type) && planPayment(P, equipCost(P, eq, c), 0, null, { forType: eq.card.type }))) || fits.sort((a, b) => creatureValue(b) - creatureValue(a))[0];
        if (best && await equip(P, eq, best)) { await pause(300); await actDrain(); }
    }
}

function aiChooseAttackers(P) {
    const must = P.bf.filter(o => canAttackWith(o) && forcedAttack(o));
    const chosen = [...new Set([...aiChooseAttackersFree(P), ...must])];
    aiAimAtPlaneswalkers(P, chosen);
    return chosen;
}
function aiAimAtPlaneswalkers(P, list) {
    const D = opp(P);
    list.forEach(o => { delete o.attackPW; });
    const pws = D.bf.filter(isPlaneswalker).sort((a, b) => (a.ctr.loyalty || 0) - (b.ctr.loyalty || 0));
    if (list.reduce((s, a) => s + pow(a), 0) >= D.life) return;
    // Its own battles (Sieges it attacks to flip): spare attackers that can finish one
    for (const b of P.bf.filter(isBattle)) {
        let need = b.ctr.defense || 0;
        const team = [];
        for (const a of list.slice().sort((x, y) => pow(y) - pow(x))) { if (need <= 0) break; if (a.attackPW) continue; team.push(a); need -= pow(a); }
        if (need <= 0 && team.length < list.length) team.forEach(a => { a.attackPW = b.uid; });
    }
    if (!pws.length) return;
    const free = list.slice().sort((a, b) => pow(a) - pow(b));
    for (const w of pws) {
        let need = w.ctr.loyalty || 0;
        const team = [];
        for (const a of free) { if (need <= 0) break; if (a.attackPW) continue; team.push(a); need -= pow(a); }
        if (need > 0) break;
        team.forEach(a => { a.attackPW = w.uid; pull(free, a); });
    }
}
function aiChooseAttackersFree(P) {
    const D = opp(P);
    const cands = P.bf.filter(o => canAttackWith(o) && pow(o) > 0);
    if (!cands.length) return [];
    const blockers = D.bf.filter(o => isCreature(o) && !o.tapped);
    const canBeBlocked = a => blockers.some(b => canBlock(b, a));
    // Lethal on board? Assume they block our biggest blockable attackers.
    const unblockable = cands.filter(a => !canBeBlocked(a));
    const blockable = cands.filter(a => canBeBlocked(a)).sort((a, b) => pow(b) - pow(a));
    const through = unblockable.reduce((s, a) => s + pow(a), 0) + blockable.slice(blockers.length).reduce((s, a) => s + pow(a), 0);
    if (through >= D.life && !(P.aiLevel === 'easy' && Math.random() < 0.3)) return cands;
    if (P.aiLevel === 'easy') return cands.filter(a => !canBeBlocked(a) || Math.random() < 0.5);
    return cands.filter(a => {
        if (!canBeBlocked(a)) return true;
        const threats = blockers.filter(b => canBlock(b, a) && combatKills(b, a));
        if (!threats.length) return true;
        // Even or better trades: our attacker kills every creature that could kill it
        if (threats.every(b => combatKills(a, b) && creatureValue(a) <= creatureValue(b) + 0.5)) return true;
        // Push when they're low and we have more creatures, or when the
        // board has stalled and our side is clearly bigger
        if (D.life <= 6 && cands.length > blockers.length) return true;
        const ourPow = P.bf.filter(isCreature).reduce((s, o) => s + pow(o), 0);
        const theirPow = D.bf.filter(isCreature).reduce((s, o) => s + pow(o), 0);
        return G.turn >= 14 && ourPow >= theirPow * 1.4 && cands.length >= blockers.length;
    });
}

// Would a's combat damage kill b, when the two fight? Counts first and double
// strike (the faster one may kill the other before it deals damage),
// deathtouch, indestructible and protection (audit, 2026-10-06).
const firstStriker = o => has(o, 'first strike') || has(o, 'double strike');
function rawKills(a, b) {
    if (pow(a) <= 0 || protFrom(b, a) || has(b, 'indestructible')) return false;
    const dmg = has(a, 'double strike') && !firstStriker(b) ? pow(a) * 2 : pow(a);
    return has(a, 'deathtouch') || dmg >= tou(b) - b.dmg;
}
function combatKills(a, b) {
    if (!rawKills(a, b)) return false;
    // b strikes first and kills a: a never deals its damage
    if (firstStriker(b) && !firstStriker(a) && rawKills(b, a)) return false;
    return true;
}
function aiChooseBlocks(D, A) {
    const atks = G.attackers.map(onBf).filter(Boolean).sort((a, b) => pow(b) - pow(a));
    const free = D.bf.filter(o => isCreature(o) && !o.tapped);
    const blocks = {};
    const take = b => pull(free, b);
    let incoming = atks.reduce((s, a) => s + pow(a), 0);
    for (const atk of atks) {
        let options = free.filter(b => canBlock(b, atk));
        if (!options.length) continue;
        const atkKills = b => combatKills(atk, b);
        const blockerKills = b => combatKills(b, atk);
        if (has(atk, 'menace')) {
            if (incoming >= D.life && options.length >= 2) { const two = options.sort((a, b) => creatureValue(a) - creatureValue(b)).slice(0, 2); two.forEach(take); blocks[atk.uid] = two.map(b => b.uid); incoming -= pow(atk); }
            continue;
        }
        const safeKill = options.filter(b => !atkKills(b) && blockerKills(b));
        const safe = options.filter(b => !atkKills(b));
        const trade = options.filter(b => blockerKills(b) && creatureValue(b) <= creatureValue(atk) + 1);
        let pick = safeKill[0] || safe.sort((a, b) => creatureValue(a) - creatureValue(b))[0] || trade.sort((a, b) => creatureValue(a) - creatureValue(b))[0];
        // A double block: two creatures that kill it together, when it can only kill one of them
        if (!pick && D.aiLevel !== 'easy' && options.length >= 2 && !has(atk, 'indestructible') && !firstStriker(atk) && creatureValue(atk) >= 3) {
            const pool = options.filter(b => !protFrom(atk, b)).sort((a, b) => pow(b) - pow(a));
            for (let i = 0; i < pool.length && !blocks[atk.uid]; i++) for (let j = i + 1; j < pool.length; j++) {
                const [b1, b2] = [pool[i], pool[j]];
                const together = has(b1, 'deathtouch') || has(b2, 'deathtouch') || pow(b1) + pow(b2) >= tou(atk) - atk.dmg;
                const killsBoth = !has(atk, 'deathtouch') ? pow(atk) >= (tou(b1) - b1.dmg) + (tou(b2) - b2.dmg) : pow(atk) >= 2;
                if (together && !killsBoth && !has(atk, 'trample') && Math.max(creatureValue(b1), creatureValue(b2)) <= creatureValue(atk)) {
                    take(b1); take(b2); blocks[atk.uid] = [b1.uid, b2.uid]; incoming -= pow(atk); break;
                }
            }
            if (blocks[atk.uid]) continue;
        }
        if (!pick && incoming >= D.life) pick = options.sort((a, b) => creatureValue(a) - creatureValue(b))[0]; // chump to survive
        if (pick && D.aiLevel === 'easy' && incoming < D.life && Math.random() < 0.5) pick = null; // misses blocks
        if (pick) {
            take(pick);
            blocks[atk.uid] = [pick.uid];
            if (!has(atk, 'trample')) incoming -= pow(atk);
        }
    }
    return blocks;
}

async function aiTurn(P) {
    G.busy = true;
    await pause(500);
    await actDrain();
    await aiMain(P);
    if (G.over) return;
    aiSaddle(P);
    emptyPools();
    fire('combat');
    await settle();
    if (G.over) return;
    aiCrew(P);
    let attackers = P.skip && P.skip.turn === G.turn && P.skip.what === 'combat' ? [] : aiChooseAttackers(P);
    if (P.mustAttackTurn === G.turn && !(P.skip && P.skip.turn === G.turn && P.skip.what === 'combat')) attackers = [...new Set([...attackers, ...P.bf.filter(canAttackWith)])];
    for (let round = 0; round < 4 && attackers.length && !G.over; round++) {
        G.phase = 'declareAttackers';
        declareAttackers(P, attackers);
        await exertChoices(P, attackers);
        await settle();
        if (G.over) return;
        renderGame();
        await actDrain();
        G.phase = 'declareBlocks';
        renderGame();
        const D = opp(P);
        const canDoAnything = D.bf.some(o => isCreature(o) && !o.tapped) || D.hand.some(o => canCastNow(D, o) && canPay(D, o));
        if (D.isAI) {
            await pause(400);
            G.blocks = aiChooseBlocks(D, P);
        } else if (canDoAnything) {
            G.busy = false;
            await new Promise(resolve => { G.mode = { type: 'block', who: D.i, picked: null, resolve }; renderGame(); });
            G.busy = true;
        } else {
            await pause(700);
        }
        if (G.over) return;
        fixMenace(); fireBlocked();
        logBlocks();
        fire('blocks', { list: Object.values(G.blocks).flat().map(onBf).filter(Boolean) });
        await settle();
        renderGame();
        await pause(500);
        G.phase = 'combatDamage';
        combatDamage(P);
        await settle();
        renderGame();
        if (G.over) return;
        await pause(400);
        await actDrain();
        if (G.extraCombat > 0) { // Combat Celebrant: an additional combat phase
            G.extraCombat--;
            log(`${P.name} gets an additional combat phase.`);
            fire('combat'); await settle();
            if (G.over) return;
            attackers = aiChooseAttackers(P);
        } else attackers = [];
    }
    G.phase = 'main2';
    await aiMain(P);
    if (G.over) return;
    await pause(300);
    await actDrain();
    endTurn(P);
}

