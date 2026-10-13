// =====================================================================
// Token-based reader (Phase 2b of docs/spellslinger-overhaul-plan.md, 2026-10-08)
//
// Reads "target <filter>" phrases by pieces instead of one regex per wording, so one rule covers
// "destroy target nonartifact, nonblack creature", "exile target tapped red creature an opponent controls" and so on.
//   parseTargetPhrase("nonblack creature with flying an opponent controls") -> { types, notTypes, colors, ... }
// The result is carried on an effect as a filter string "sf:<json>", which permMatches hands to structMatch.
// It is a FALLBACK: parseEffects tries it only when no regex in EFFECTS matched, so no card that was read before reads differently.
// =====================================================================
const TR_TYPES = { creature: 'Creature', artifact: 'Artifact', enchantment: 'Enchantment', land: 'Land', planeswalker: 'Planeswalker', permanent: '*', battle: 'Battle' };
const TR_COLORS = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
const TR_STATES = ['attacking', 'blocking', 'tapped', 'untapped'];

// Returns a filter object, or null when any word of the phrase isn't understood
function parseTargetPhrase(phrase) {
    let s = ' ' + phrase.trim().toLowerCase().replace(/\.$/, '') + ' ';
    const F = { types: [], notTypes: [], colors: [], notColors: [], states: [], notStates: [], kw: [], notKw: [], ctl: null };
    let m;
    if ((m = s.match(/ (you control|an opponent controls|you don't control|you own) $/))) { F.ctl = m[1] === 'you control' || m[1] === 'you own' ? 'you' : 'opp'; s = s.slice(0, m.index) + ' '; }
    while ((m = s.match(/ with power (\d+) or (greater|less) /))) { F[m[2] === 'greater' ? 'powMin' : 'powMax'] = +m[1]; s = s.replace(m[0], ' '); }
    while ((m = s.match(/ with toughness (\d+) or (greater|less) /))) { F[m[2] === 'greater' ? 'touMin' : 'touMax'] = +m[1]; s = s.replace(m[0], ' '); }
    while ((m = s.match(/ with mana value (\d+) or (greater|less) /))) { F[m[2] === 'greater' ? 'mvMin' : 'mvMax'] = +m[1]; s = s.replace(m[0], ' '); }
    while ((m = s.match(/ with mana value (\d+) /))) { F.mvMin = F.mvMax = +m[1]; s = s.replace(m[0], ' '); }
    while ((m = s.match(/ (with|without) (flying|reach|trample|haste|first strike|deathtouch|lifelink|vigilance|menace|defender|horsemanship) /))) { (m[1] === 'with' ? F.kw : F.notKw).push(m[2]); s = s.replace(m[0], ' '); }
    // modifiers before the noun: "attacking or blocking", "nonartifact, nonblack", "tapped red"
    const words = s.replace(/,/g, ' ').replace(/\band\/or\b/g, 'or').trim().split(/\s+/);
    const nouns = [];
    for (const w of words) {
        let x;
        if (w === 'or' || w === 'and') continue;
        if (TR_STATES.includes(w)) { (F.states).push(w); continue; }
        if (TR_COLORS[w]) { F.colors.push(TR_COLORS[w]); continue; }
        if ((x = w.match(/^non-?(\w+)$/))) {
            if (TR_COLORS[x[1]]) F.notColors.push(TR_COLORS[x[1]]);
            else if (TR_TYPES[x[1]] && TR_TYPES[x[1]] !== '*') F.notTypes.push(TR_TYPES[x[1]]);
            else if (x[1] === 'token') F.nonToken = true;
            else if (x[1] === 'legendary') F.nonLegendary = true;
            else if (x[1] === 'basic') F.nonBasic = true;
            else return null;
            continue;
        }
        if (w === 'legendary') { F.legendary = true; continue; }
        if (w === 'token') { F.token = true; continue; }
        if (TR_TYPES[w]) { nouns.push(TR_TYPES[w]); continue; }
        return null;
    }
    if (!nouns.length) return null;
    F.types = nouns.includes('*') ? [] : [...new Set(nouns)];
    // A colour or state list means "or" between them ("white or blue creature", "attacking or blocking")
    return F;
}

function structMatch(o, F, P) {
    const t = o.card.type, theirs = o.owner !== P.i, cols = o.card.colors || [];
    if (F.types.length && !F.types.some(ty => ty === 'Creature' ? isCreature(o) : new RegExp('\\b' + ty + '\\b').test(t))) return false;
    if (F.notTypes.some(ty => ty === 'Creature' ? isCreature(o) : new RegExp('\\b' + ty + '\\b').test(t))) return false;
    if (F.colors.length && !F.colors.some(c => cols.includes(c))) return false;
    if (F.notColors.some(c => cols.includes(c))) return false;
    if (F.ctl === 'you' && theirs) return false;
    if (F.ctl === 'opp' && !theirs) return false;
    const inCombat = { attacking: () => G.attackers.includes(o.uid), blocking: () => Object.values(G.blocks).some(bs => bs.includes(o.uid)), tapped: () => !!o.tapped, untapped: () => !o.tapped };
    const pos = F.states.filter(x => x === 'attacking' || x === 'blocking'), tp = F.states.filter(x => x === 'tapped' || x === 'untapped');
    if (pos.length && !pos.some(x => inCombat[x]())) return false;
    if (tp.length && !tp.every(x => inCombat[x]())) return false;
    if (F.nonToken && o.token) return false;
    if (F.token && !o.token) return false;
    if (F.legendary && !/Legendary/.test(t)) return false;
    if (F.nonLegendary && /Legendary/.test(t)) return false;
    if (F.nonBasic && /\bBasic\b/.test(t)) return false;
    const cmc = o.card.cmc || 0;
    if (F.mvMin !== undefined && cmc < F.mvMin) return false;
    if (F.mvMax !== undefined && cmc > F.mvMax) return false;
    if (F.powMin !== undefined || F.powMax !== undefined || F.touMin !== undefined || F.touMax !== undefined) {
        if (!isCreature(o)) return false;
        const p = pow(o), q = typeof tou === 'function' ? tou(o) : Number(o.card.toughness);
        if ((F.powMin !== undefined && p < F.powMin) || (F.powMax !== undefined && p > F.powMax) || (F.touMin !== undefined && q < F.touMin) || (F.touMax !== undefined && q > F.touMax)) return false;
    }
    if (F.kw.some(k => !has(o, k))) return false;
    if (F.notKw.some(k => has(o, k))) return false;
    return true;
}
const TR_CACHE = new Map();
function structFilter(f) { let F = TR_CACHE.get(f); if (!F) { F = JSON.parse(f.slice(3)); TR_CACHE.set(f, F); } return F; }

// One sentence -> an effect, or null. Used only after every EFFECTS pattern failed.
function tokenReadSentence(p) {
    let m, F;
    const filt = ph => { F = parseTargetPhrase(ph); return F ? 'sf:' + JSON.stringify(F) : null; };
    const creatureOnly = () => F.types.length === 1 && F.types[0] === 'Creature';
    if ((m = p.match(/^(destroy|exile) target (.+)$/i)) && filt(m[2])) {
        const t = m[1].toLowerCase();
        return { t, target: 'perm', filter: filt(m[2]) };
    }
    if ((m = p.match(/^return target (.+?) to its owner's hand$/i)) && filt(m[1])) return { t: 'bounce', target: 'perm', filter: filt(m[1]) };
    if ((m = p.match(/^~ deals (\w+) damage to target (.+)$/i)) && num(m[1]) !== undefined && filt(m[2]) && creatureOnly()) return { t: 'dmg', n: num(m[1]), target: 'creature', only: filt(m[2]) };
    // Phase 2b, second batch: pump, tap and +1/+1 counters on a described creature
    if ((m = p.match(/^target (.+?) gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/i)) && filt(m[1]) && creatureOnly()) {
        const kw = m[4] ? splitKw(m[4]) : [];
        return { t: 'pump', p: +m[2], q: +m[3], kw, target: 'creature', only: filt(m[1]), good: +m[2] + +m[3] >= 0 };
    }
    if ((m = p.match(/^tap target (.+)$/i)) && filt(m[1])) return creatureOnly() ? { t: 'tap', target: 'creature', only: filt(m[1]), good: false } : { t: 'tap', target: 'perm', filter: filt(m[1]), good: false };
    if ((m = p.match(/^put (\w+) \+1\/\+1 counters? on target (.+)$/i)) && num(m[1]) !== undefined && filt(m[2]) && creatureOnly()) return { t: 'counters', n: num(m[1]), target: 'creature', only: filt(m[2]), good: true };
    return null;
}
