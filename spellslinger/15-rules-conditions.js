// =====================================================================
// Rules round 6 (2026-10-06): conditions. "If you control three or more
// artifacts", "As long as you have 30 or more life", "if no spells were
// cast last turn"... are read once into a test (parseCond) and checked
// when the effect resolves, the trigger fires (603.4) or a power/toughness
// or keyword is looked up. A condition the game can't read leaves the
// whole line unread, so the card says so.
// =====================================================================
const COLOR_WORDS = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
const COND_CACHE = new Map();
function parseCond(text) {
    const t = String(text).trim().replace(/\.$/, '').replace(/^it's /, 'it is ').replace(/^you've /, 'you have ');
    if (!COND_CACHE.has(t)) COND_CACHE.set(t, buildCond(t));
    return COND_CACHE.get(t);
}
let condDepth = 0;
function condOk(text, P, o) {
    const f = parseCond(text);
    if (!f || !G || condDepth > 3) return !f;
    condDepth++;
    try { return !!f(P, o); } finally { condDepth--; }
}
function devotion(P, colors) {
    return P.bf.reduce((a, x) => a + ((x.card.cost || '').match(/\{[^}]+\}/g) || []).filter(sym => colors.some(c => sym.includes(c))).length, 0);
}
function buildCond(t) {
    let m;
    const cmp = (a, rel, n) => (/more|greater/.test(rel) ? a >= n : a <= n);
    const opp = P => G.players[1 - P.i];
    if (t === 'you control a commander') return P => P.bf.some(x => x.isCommander);
    if (t === 'the top card of your library is black') return P => { const c = P.library[P.library.length - 1]; return !!c && (c.card.colors || []).includes('B'); }; // Vampire Nocturnus
    if (t === 'you cast it from your hand') return (P, o) => !!o && o.castFromHand === G.turn;
    if (t === 'you control no artifacts') return P => !P.bf.some(x => /Artifact/.test(x.card.type));
    if (t === 'an opponent controls no basic lands') return P => !opp(P).bf.some(x => /\bBasic\b/.test(x.card.type) && /\bLand\b/.test(x.card.type));
    if (t === "you haven't been dealt combat damage since your last turn" || t === 'you have not been dealt combat damage since your last turn') return P => !(P.combatHitTurn >= G.turn - 2);
    if (t === 'you control your commander') return P => P.bf.some(x => x.isCommander);
    if ((m = t.match(/^you control no ([A-Z][a-z]+)s other than ~$/))) { const ty = m[1]; return (P, o) => !P.bf.some(x => x !== o && hasType(x, ty)); }
    if (t === '~ was cast from exile') return (P, o) => !!o && !!o.castFromExile;
    if ((m = t.match(/^there are (\w+) or more permanent types among cards in your graveyard$/))) { const n = num(m[1]); return P => ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'].filter(ty => P.gy.some(x => new RegExp(`\\b${ty}\\b`).test(x.card.type))).length >= n; }
    if (t === 'you control the creature with the greatest power or tied for the greatest power') return P => { const best = Math.max(-99, ...allPerms().filter(isCreature).map(pow)); return P.bf.some(x => isCreature(x) && pow(x) === best); };
    if ((m = t.match(/^you control (\w+) or more lands with different names$/))) { const n = num(m[1]); return P => new Set(P.bf.filter(x => /\bLand\b/.test(x.card.type)).map(x => x.card.name)).size >= n; }
    if (t === '~ is untapped') return (P, o) => !!o && !o.tapped;
    if ((m = t.match(/^97 is (\d+) or (more|greater)$/))) { const n = +m[1]; return () => (G.curX || 0) >= n; }
    if ((m = t.match(/^that land is an? (Plains|Island|Swamp|Mountain|Forest|Desert|Gate)$/))) { const ty = m[1]; return () => !!G.ctxObj && hasType(G.ctxObj, ty); }
    if (t === 'you had a land enter the battlefield under your control this turn') return P => (G.entered || []).some(e => e.turn === G.turn && e.land && e.owner === P.i);
    if ((m = t.match(/^this is the (first|second|third) time this ability has resolved this turn$/))) { const n = { first: 1, second: 2, third: 3 }[m[1]]; return () => (G.resolveN || 0) === n; }
    if (t === 'you created a token this turn') return P => P.tokenTurn === G.turn;
    if (t === 'you attacked with two or more creatures this turn') return P => !!G.attackedN && G.attackedN.turn === G.turn && G.attackedN.p === P.i && G.attackedN.n >= 2;
    if ((m = t.match(/^there are (\w+) or more cards in your graveyard$/))) { const n = num(m[1]); return P => P.gy.length >= n; }
    if ((m = t.match(/^you control a creature with power (\w+) or greater$/))) { const n = num(m[1]); return P => P.bf.some(x => isCreature(x) && pow(x) >= n); }
    if (t === 'the equipped creature is legendary') return (P, o) => { const h = o && o.attachedTo && onBf(o.attachedTo); return !!h && /Legendary/.test(h.card.type); };
    // Starter kits (2026-10-06)
    if ((m = t.match(/^it is your turn and (.+)$/)) && parseCond(m[1])) { const rest = parseCond(m[1]); return (P, o) => G.active === P.i && rest(P, o); }
    if (t === '~ is equipped') return (P, o) => !!o && isEquipped(o);
    if (t === 'at least four mana was spent to cast it') return () => !!G.lastCast && (G.lastCast.card.cmc || 0) >= 4;
    if (t === 'alania') return (P, o) => { const c = G.lastCast; if (!c || c === o) return false; const k = (G.castKinds || {})[P.i] || {}; const kind = Rx(c).kind; return (kind === 'instant' && k.instant === 1) || (kind === 'sorcery' && k.sorcery === 1) || (hasType(c, 'Otter') && c.card.name !== o.card.name && k.otter === 1); };
    if (t === 'another creature entered the battlefield under your control this turn') return (P, o) => (G.entered || []).some(e => e.turn === G.turn && e.owner === P.i && e.creature && e.o !== o);
    if ((m = t.match(/^(\w+) or more nonland permanents entered the battlefield under your control this turn$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => (G.entered || []).filter(e => e.turn === G.turn && e.owner === P.i && !e.land).length >= n; }
    if ((m = t.match(/^you had an? ([A-Z][a-z]+) or ([A-Z][a-z]+) enter the battlefield under your control this turn$/))) { const a = m[1], b = m[2]; return P => (G.entered || []).some(e => e.turn === G.turn && e.owner === P.i && (hasType(e.o, a) || hasType(e.o, b))); }
    if (t === "that creature's power is greater than ~'s power") return (P, o) => !!G.ctxObj && !!o && pow(G.ctxObj) > pow(o);
    if ((m = t.match(/^that creature (?:was|is) an? ([A-Z][a-z]+) or ([A-Z][a-z]+)$/))) { const a = m[1], b = m[2]; return () => { const x = G.ctxObj || (G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o); return !!x && (hasType(x, a) || hasType(x, b)); }; }
    if ((m = t.match(/^you control a legendary ([A-Z][a-z]+)$/))) { const ty = m[1]; return P => P.bf.some(x => /Legendary/.test(x.card.type) && hasType(x, ty)); }
    if ((m = t.match(/^~ has (\w+) or more counters on it$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return (P, o) => !!o && Math.max(0, o.counters) + Object.values(o.ctr || {}).reduce((a, v) => a + Math.max(0, v), 0) >= n; }
    if (t === 'that creature has a +1/+1 counter on it') return () => { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; return !!x && x.counters > 0; };
    if (t === 'the sacrificed creature was legendary') return () => !!G.lastSacLegend;
    if ((m = t.match(/^its mana value was (\w+) or less$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return () => G.lastMv !== undefined && G.lastMv <= n; }
    if (t === 'you attacked with exactly one other creature this combat') return (P, o) => G.attackers.length === 2 && !!o && G.attackers.includes(o.uid);
    if ((m = t.match(/^you control a permanent with mana value (\w+) or greater$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => P.bf.some(x => (x.card.cmc || 0) >= n); }
    if (t === '~ was cast from a graveyard') return (P, o) => !!o && !!o.flashedBack;
    if (t === '~ attacked this turn') return (P, o) => !!o && o.attackedTurn === G.turn;
    if (t === 'a +1/+1 counter was put on a permanent under your control this turn') return P => P.counterTurn === G.turn;
    if (t === 'that creature is attacking') return () => { const x = G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o; return !!x && G.attackers.includes(x.uid); };
    if (t === 'it is your turn' || t === 'it\'s your turn') return P => G.active === P.i;
    if (t === 'it is not your turn') return P => G.active !== P.i;
    if (t === '~ is tapped') return (P, o) => !!o && o.tapped;
    if (t === 'it is attacking' || t === '~ is attacking') return (P, o) => !!o && G.attackers.includes(o.uid);
    if (t === 'an opponent lost life this turn') return P => opp(P).lostTurn === G.turn;
    if ((m = t.match(/^(?:it's|it is|that creature is|that creature was) (?:a|an|another) ([A-Z][a-z]+)$/))) { const ty = m[1]; return () => { const x = G.ctxObj || (G.lastTargets && G.lastTargets[0] && G.lastTargets[0].o); return !!x && hasType(x, ty); }; }
    if ((m = t.match(/^it(?:'s| is) an? (artifact|creature|land|instant|sorcery) card$/))) { const k = m[1]; return () => !!G.revealed && cardFits(G.revealed, k); }
    if ((m = t.match(/^there are (\w+) or more creature cards in your graveyard$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => P.gy.filter(x => /Creature/.test(x.card.type)).length >= n; }
    if ((m = t.match(/^you control an? ([A-Z][a-z]+) or ([A-Z][a-z]+)$/))) { const a = m[1], b = m[2]; return P => P.bf.some(x => hasType(x, a) || hasType(x, b)); }
    if ((m = t.match(/^you control (?:a|an|another) ([a-z]+ creature|creature with flying)$/))) { const w = m[1]; return (P, o) => P.bf.some(x => x !== o && isCreature(x) && (w === 'creature with flying' ? has(x, 'flying') : new RegExp(w.split(' ')[0], 'i').test(x.card.type))); }
    if ((m = t.match(/^creatures you control have total power (\w+) or greater$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => P.bf.filter(isCreature).reduce((a, x) => a + Math.max(0, pow(x)), 0) >= n; }
    if (t === 'you cast it from your hand') return (P, o) => !!o && o.castFromHand === G.turn;
    if (t === 'you controlled that permanent') return P => !!G.lastBounced && G.lastBounced === P.i;
    if ((m = t.match(/^~ has no (\w+) counters on it$/))) { const k = m[1]; return (P, o) => !!o && !(o.ctr[k] > 0); }
    if ((m = t.match(/^you don't control an? (legendary creature|[a-z]+ creature|[A-Z][a-z]+)$/))) { const w = m[1]; return P => !P.bf.some(x => w === 'legendary creature' ? /Legendary/.test(x.card.type) && isCreature(x) : /creature$/.test(w) ? new RegExp(w.split(' ')[0], 'i').test(x.card.type) && isCreature(x) : hasType(x, w)); }
    if (t === '~ is untapped') return (P, o) => !!o && !o.tapped;
    if (/^(?:a creature|another creature|one or more creatures) died this turn$/.test(t)) return () => G.diedTurn === G.turn;
    if (/^you (?:have )?gained life this turn$/.test(t) || t === 'you gained life this turn') return P => P.gainedTurn === G.turn;
    if (/^you (?:have )?attacked(?: with (?:a|one or more) creatures?)? this turn$/.test(t)) return P => G.attackedTurn === G.turn && G.active === P.i;
    if (t === 'no spells were cast last turn') return () => !!G.lastCastBy && G.lastCastBy[0] + G.lastCastBy[1] === 0 && G.turn > 1;
    if (t === 'a player cast two or more spells last turn') return () => !!G.lastCastBy && Math.max(...G.lastCastBy) >= 2;
    if ((m = t.match(/^you (?:have )?cast (another spell|two or more spells|three or more spells|a noncreature spell|an instant or sorcery spell) this turn$/))) {
        const n = { 'another spell': 2, 'two or more spells': 2, 'three or more spells': 3 }[m[1]];
        return n ? P => (G.castBy || [0, 0])[P.i] >= n : P => (G.castBy || [0, 0])[P.i] >= 1;
    }
    if ((m = t.match(/^you have (\w+) or (more|less) life$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => cmp(P.life, m[2], n); }
    if ((m = t.match(/^your life total is (\w+) or (more|less)$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => cmp(P.life, m[2], n); }
    if ((m = t.match(/^an opponent has (\w+) or (more|less) life$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => cmp(opp(P).life, m[2], n); }
    if (/^you have no cards in hand$/.test(t)) return P => P.hand.length === 0;
    if ((m = t.match(/^you have (\w+) or (more|fewer) cards in (?:your )?hand$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => cmp(P.hand.length, m[2], n); }
    if ((m = t.match(/^(?:there are )?(\w+) or more cards (?:are )?in your graveyard$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => P.gy.length >= n; }
    if ((m = t.match(/^there are (\w+) or more card types among cards in your graveyard$/)) && num(m[1]) !== undefined) {
        const n = num(m[1]);
        return P => new Set(P.gy.flatMap(x => (x.card.type.split(' — ')[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)\b/g) || []))).size >= n;
    }
    if ((m = t.match(/^your devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))? is less than (\w+)$/)) && num(m[3]) !== undefined) {
        const cols = [m[1], m[2]].filter(Boolean).map(c => COLOR_WORDS[c]), n = num(m[3]);
        return P => devotion(P, cols) < n;
    }
    if ((m = t.match(/^~ has (\w+) or more ([+\-\d/]+|[a-z]+) counters on it$/)) && num(m[1]) !== undefined) {
        const n = num(m[1]), kind = m[2];
        return (P, o) => !!o && (kind === '+1/+1' ? o.counters : (o.ctr && o.ctr[kind]) || 0) >= n;
    }
    if ((m = t.match(/^an opponent controls more (creatures|lands) than you$/))) {
        const f = m[1] === 'lands' ? x => /\bLand\b/.test(x.card.type) : isCreature;
        return P => opp(P).bf.filter(f).length > P.bf.filter(f).length;
    }
    if ((m = t.match(/^you control a creature with power (\w+) or greater$/)) && num(m[1]) !== undefined) { const n = num(m[1]); return P => P.bf.some(x => isCreature(x) && pow(x) >= n); }
    // "you control three or more artifacts", "you control an Island", "you control no other creatures", "you control another Elf"
    if ((m = t.match(/^you control (a|an|another|no|no other|(\w+) or (more|fewer)(?: other)?) (.+)$/))) {
        let what = m[4];
        const other = /another|other/.test(m[0].split(what)[0]);
        if (/^(?:a|an|another|no|no other)$/.test(m[1])) {
            if (!/s$/.test(what) || /^(?:Plains|Mercenaries)$/.test(what)) what = /^[a-z]/.test(what) && !/s$/.test(what) ? `${what}s` : what;
        }
        const f = countFn(`the number of ${other ? 'other ' : ''}${what} you control`);
        if (!f) return null;
        if (m[2]) { const n = num(m[2]); if (n === undefined) return null; return (P, o) => cmp(f(o || { owner: P.i }), m[3], n); }
        if (/^no/.test(m[1])) return (P, o) => f(o || { owner: P.i }) === 0;
        return (P, o) => f(o || { owner: P.i }) >= 1;
    }
    return null;
}
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
// What "the number of ..." counts, for */* creatures and "+1/+1 for each"
function countFn(phrase) {
    // "the number of creatures you control plus the number of Equipment you control"
    const plus = phrase.split(/ plus the number of /);
    if (plus.length > 1) { const fs = plus.map((x, i) => countFn(i ? `the number of ${x}` : x)); return fs.every(Boolean) ? o => fs.reduce((a, f) => a + f(o), 0) : null; }
    let p = phrase.replace(/^the number of /, '').trim();
    const other = /^other /.test(p);
    let mm0;
    p = p.replace(/^other /, '');
    const ctl = o => G.players[o.owner];
    if (/^cards? in your hand$/.test(p)) return o => ctl(o).hand.length;
    if (/^cards? in your graveyard$/.test(p)) return o => ctl(o).gy.length;
    if (/^creature cards? in your graveyard$/.test(p)) return o => ctl(o).gy.filter(x => /Creature/.test(x.card.type)).length;
    if (/^cards? in all graveyards$/.test(p)) return () => G.players.reduce((a, P) => a + P.gy.length, 0);
    if (/^creature cards? in all graveyards$/.test(p)) return () => G.players.reduce((a, P) => a + P.gy.filter(x => /Creature/.test(x.card.type)).length, 0);
    if (/^untapped permanents? your opponents control$/.test(p)) return o => G.players.filter(X => X.i !== o.owner).reduce((a, X) => a + X.bf.filter(x => !x.tapped).length, 0);
    if (/^Equipment attached to (?:it|~)$/.test(p)) return o => allPerms().filter(a => a.attachedTo === o.uid && /\bEquipment\b/.test(a.card.type)).length;
    if (/^card types among cards in all graveyards$/.test(p)) return () => new Set(G.players.flatMap(P => P.gy.flatMap(x => (x.card.type.split(' — ')[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)\b/g) || [])))).size;
    if (/^creatures? on the battlefield$/.test(p)) return () => allPerms().filter(isCreature).length;
    // Top-1000 round 2: "Elves on the battlefield", "+1/+1 counters on ~"
    if ((mm0 = p.match(/^([A-Z][a-z]+) on the battlefield$/))) { const ty = PLURAL_TYPES[mm0[1]] || (mm0[1].endsWith('s') ? mm0[1].slice(0, -1) : mm0[1]); return () => allPerms().filter(x => hasType(x, ty)).length; }
    if (/^\+1\/\+1 counters? on ~$/.test(p)) return o => Math.max(0, o.counters || 0);
    if (/^land cards? in your graveyard$/.test(p)) return o => ctl(o).gy.filter(x => /\bLand\b/.test(x.card.type)).length;
    if (/^artifacts and enchantments your opponents control$/.test(p)) return o => G.players[1 - o.owner].bf.filter(x => /\b(?:Artifact|Enchantment)\b/.test(x.card.type)).length;
    if (/^colors? among permanents you control$/.test(p)) return o => amongColors(ctl(o), 'permanents').length;
    if (/^artifacts? and\/or enchantments? you control$/.test(p)) return o => ctl(o).bf.filter(x => /\b(?:Artifact|Enchantment)\b/.test(x.card.type)).length;
    if (/^tapped lands? your opponents control$/.test(p)) return o => G.players[1 - o.owner].bf.filter(x => x.tapped && /\bLand\b/.test(x.card.type)).length;
    if ((mm0 = p.match(/^cards? named (.+) in (?:each|all) graveyards?$/i))) { const nm = mm0[1].toLowerCase(); return () => G.players.reduce((a, X) => a + X.gy.filter(x => x.card.name.toLowerCase() === nm).length, 0); }
    if (/^charge counters? on ~$/.test(p)) return o => (o.ctr && o.ctr.charge) || 0;
    let mm;
    if ((mm = p.match(/^basic ([A-Z][a-z]+)s? you control$/))) { const ty = mm[1]; return o => ctl(o).bf.filter(x => /\bBasic\b/.test(x.card.type) && new RegExp(`\\b${ty}\\b`).test(x.card.type)).length; }
    if (/^attacking creatures? you control$/.test(p)) return o => (G.attackers || []).map(onBf).filter(x => x && x.owner === o.owner).length; // Embercleave
    if (/^(?:creatures? that attacked|creatures? you attacked with) this turn$/.test(p)) return o => (G.attackedN && G.attackedN.turn === G.turn && G.attackedN.p === o.owner ? G.attackedN.n : 0);
    if (/^attacking creatures?$/.test(p)) return o => G.attackers.filter(u => !(other && u === o.uid)).length;
    if ((mm = p.match(/^creatures? you control with power (\w+) or greater$/))) { const n = num(mm[1]); return o => ctl(o).bf.filter(x => isCreature(x) && pow(x) >= n).length; }
    if (/^creature cards? in its controller's graveyard$/.test(p)) return o => ctl(o).gy.filter(x => /Creature/.test(x.card.type)).length;
    if ((mm = p.match(/^(enchantments|lands|creatures|artifacts) you control$/))) { /* falls through below */ }
    // Starter kits (2026-10-06)
    if (/^equipped creatures you control$/.test(p)) return o => ctl(o).bf.filter(x => isCreature(x) && isEquipped(x) && !(other && x === o)).length;
    if (/^modified creatures you control$/.test(p)) return o => ctl(o).bf.filter(x => isCreature(x) && !(other && x === o) && (x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0) || allPerms().some(a => a.attachedTo === x.uid && (Rx(a).isEquipment || (Rx(a).isAura && a.owner === x.owner))))).length;
    if (/^legendary creatures? you control$/.test(p)) return o => ctl(o).bf.filter(x => isCreature(x) && /Legendary/.test(x.card.type) && !(other && x === o)).length;
    if (/^(?:creature )?tokens you control$/.test(p)) return o => ctl(o).bf.filter(x => x.token && (!/^creature/.test(p) || isCreature(x))).length;
    if (/^noncreature, nonland cards? in your graveyard$/.test(p)) return o => ctl(o).gy.filter(x => !/Creature|\bLand\b/.test(x.card.type)).length;
    if (/^creatures? that died this turn$/.test(p)) return () => (G.diedN && G.diedN.turn === G.turn ? G.diedN.n : 0);
    const m = p.match(/^([A-Za-z]+) you control$/);
    if (!m) return null;
    const w = m[1];
    const base = { creature: 'creature', creatures: 'creature', land: 'land', lands: 'land', artifact: 'artifact', artifacts: 'artifact', enchantment: 'enchantment', enchantments: 'enchantment' }[w];
    let test;
    if (base === 'creature') test = x => isCreature(x);
    else if (base === 'land') test = x => /\bLand\b/.test(x.card.type);
    else if (base) test = x => new RegExp(base, 'i').test(x.card.type);
    else if (/^[A-Z]/.test(w)) { const type = PLURAL_TYPES[w] || (w.endsWith('s') ? w.slice(0, -1) : w); test = x => hasType(x, type); }
    else return null;
    return o => ctl(o).bf.filter(x => test(x) && !(other && x === o)).length;
}
// ---- Top-1000 round 2 (2026-10-07) ----
// The creature type a permanent chose ("As ~ enters, choose a creature type"); the deck's most common type if it hasn't
function chosenTypeOf(o) { return (o && o.chosenType) || (o && G ? commonType(G.players[o.owner]) : 'Human'); }
// Cloud Key: the card type the deck casts most
function commonCardType(P) {
    const n = {};
    [...P.hand, ...P.library, ...P.gy].forEach(x => ['Artifact', 'Creature', 'Enchantment', 'Instant', 'Sorcery'].forEach(t => { if (new RegExp(`\\b${t}\\b`).test(x.card.type)) n[t] = (n[t] || 0) + 1; }));
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || 'Creature';
}
// Life changes, seen after each action (sba): fires "loses life" (Exquisite Blood, Mindcrank) and applies
// the doublers (Bloodletter of Aclazotz: an opponent loses twice that much on your turn; The Wind Crystal,
// Alhammarret's Archive: you gain twice that much). Doing it here covers every way life changes.
// Magic 2010 (Megrim): every card discarded this turn fires "discarded" once
function discardWatch() {
    G.players.forEach(X => X.gy.forEach(c => { if (c.discardTurn === G.turn && c.discardSeen !== G.turn) { c.discardSeen = G.turn; fire('discarded', { P: X, o: c }); } }));
    // Darksteel Colossus: it's shuffled into its owner's library instead of staying in a graveyard
    G.players.forEach(X => X.gy.filter(c => Rx(c).shuffleInstead).forEach(c => { pull(X.gy, c); const Y = G.players[c.realOwner ?? c.owner]; Y.library.push(c); shuffle(Y.library); log(`${c.card.name} is revealed and shuffled into its owner's library instead.`); }));
}
function lifeWatch() {
    if (!G || G.over) return;
    G.lifeSeen = G.lifeSeen || G.players.map(X => X.life);
    G.players.forEach((X, i) => {
        let d = X.life - G.lifeSeen[i];
        if (!d) return;
        if (d > 0) {
            const dg = X.bf.filter(a => Rx(a).doubleGain && !lostAbilities(a)).length;
            if (dg) { const extra = d * (2 ** dg - 1); X.life += extra; log(`${X.name} ${you(X) ? 'gain' : 'gains'} ${extra} more life (${X.bf.find(a => Rx(a).doubleGain).card.name}).`); }
        } else {
            const A = G.players[G.active];
            if (A !== X && A.bf.some(a => Rx(a).doubleOppLoss && !lostAbilities(a))) { X.life += d; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${-d} more life (${A.bf.find(a => Rx(a).doubleOppLoss).card.name}).`); d *= 2; }
            G.lifeSeen[i] = X.life;
            fire('loseLife', { P: X, n: -d });
            return;
        }
        G.lifeSeen[i] = X.life;
    });
}
function commonType(P) {
    const n = {};
    [...P.bf, ...P.hand, ...P.library].filter(x => /Creature/.test(x.card.type)).forEach(x => ((x.card.type.split('—')[1] || '').trim().split(/\s+/)).filter(Boolean).forEach(t => { n[t] = (n[t] || 0) + 1; }));
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || 'Human';
}
// "Tap an untapped creature you control" costs (Springleaf Drum, Relic of Legends); summoning sickness doesn't matter (302.6)
function tapFodder(P, o, kind) {
    const fits = x => x !== o && !x.tapped && (kind === 'artifact' ? /\bArtifact\b/.test(x.card.type) : isCreature(x) && (kind !== 'legendary creature' || /\bLegendary\b/.test(x.card.type)));
    return P.bf.filter(fits).sort((a, b) => (b.sick - a.sick) || (creatureValue(a) - creatureValue(b)))[0] || null;
}
// Cast a card without paying its mana cost right now (Rishkar's Expertise, rebound)
async function castFreeNow(P, x, fromZone) {
    if (Rx(x).modes) x.mode = (await pickModes(P, Rx(x), Rx(x).modes, x)) ?? 0;
    const te = firstTargetEffect(x);
    const target = te ? await chooseTarget(P, te, x, false) : null;
    if (te && !target) return false;
    x.castFromHand = fromZone === P.hand ? G.turn : 0;
    if (fromZone) pull(fromZone, x);
    G.stack.push({ id: stackSeq++, kind: 'spell', o: x, P, target, name: x.card.name, x: 0 });
    log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${x.card.name} without paying its mana cost.`);
    fire('cast', { o: x, P });
    return true;
}
// Cascade (702.85) and discover N (701.57): the hit may be cast free; discover can put it in your hand instead
async function cascade(P, src, discover = 0) {
    const mv = src.card.cmc || 0;
    const shown = [];
    let hit = null;
    const word = discover ? `Discover ${discover}` : 'Cascade';
    while (P.library.length) {
        const x = P.library.pop();
        if (Rx(x).kind !== 'land' && (discover ? (x.card.cmc || 0) <= discover : (x.card.cmc || 0) < mv)) { hit = x; break; }
        shown.push(x);
    }
    P.library.unshift(...shuffle(shown));
    if (!hit) { log(`${word}: ${P.name} found nothing.`); return; }
    log(`${word}: ${P.name} ${you(P) ? 'reveal' : 'reveals'} ${hit.card.name}.`);
    if (discover) {
        const te0 = Rx(hit).support !== 'none' ? firstTargetEffect(hit) : null;
        const castable = Rx(hit).support !== 'none' && (!te0 || validTargets(P, te0, hit).length);
        const cast = castable && (P.isAI ? true : await askYes(P, `Discover: cast ${hit.card.name} without paying its mana cost? (Cancel = put it into your hand)`, { card: hit.card, yes: 'Cast it', no: 'To hand' }));
        if (!cast) { P.hand.push(hit); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${hit.card.name} into ${you(P) ? 'your' : 'their'} hand.`); return; }
    }
    if (Rx(hit).support === 'none' || ['land'].includes(Rx(hit).kind)) { P.library.unshift(hit); return; }
    if (Rx(hit).modes) hit.mode = (await pickModes(P, Rx(hit), Rx(hit).modes, hit)) ?? 0;
    const te = firstTargetEffect(hit);
    const target = te ? await chooseTarget(P, te, hit, false) : null;
    if (te && !target) { P.library.unshift(hit); log(`${hit.card.name} has no target - it goes to the bottom.`); return; }
    G.stack.push({ id: stackSeq++, kind: 'spell', o: hit, P, target, name: hit.card.name, x: 0 });
    log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${hit.card.name} without paying its mana cost.`);
}
function sagaChapter(P, o) {
    const R = Rx(o), n = o.ctr.lore || 0;
    const last = Math.max(...Object.keys(R.saga).map(Number));
    if (R.saga[n]) { (G.trigQ = G.trigQ || []).push({ P, o, effects: R.saga[n] }); log(`${o.card.name}: chapter ${Object.keys(ROMAN).find(k => ROMAN[k] === n)}.`); }
    if (n >= last) o.sagaDone = true;
}
// "You may pay {2}" / "pay 2 life" / "sacrifice a creature" / "discard a card": you choose, the AI does it when it can
async function optionalCost(P, e, src) {
    if (e.t === 'optOppDraw') {
        const O = opp(P);
        const yes = P.isAI ? true : await askYes(P, `${src.card.name}: let ${O.name} draw a card to copy the spell?`, { card: src.card });
        if (yes) drawCards(O, 1);
        return yes;
    }
    const what = e.t === 'optPay' ? `pay ${['W', 'U', 'B', 'R', 'G', 'C'].map(c => `{${c}}`.repeat(e.cost[c])).join('')}${e.cost.generic ? `{${e.cost.generic}}` : ''}` : e.t === 'optLife' ? `pay ${e.n} life` : e.t === 'optSac' ? `sacrifice a${e.what === 'artifact' ? 'n' : ''} ${e.what}` : 'discard a card';
    const can = e.t === 'optPay' ? !!planPayment(P, e.cost) : e.t === 'optLife' ? P.life > e.n : e.t === 'optSac' ? !!sacFodder(P, src, e.what) : P.hand.length > 0;
    if (!can) return false;
    const yes = P.isAI ? true : await askYes(P, `${src.card.name}: ${what}?`, { card: src.card });
    if (!yes) return false;
    if (e.t === 'optPay') planPayment(P, e.cost).forEach(x => tapSource(P, x));
    if (e.t === 'optLife') P.life -= e.n;
    if (e.t === 'optSac') { const f = await chooseSac(P, src, e.what, src.card.name); G.lastSacPow = Math.max(0, pow(f)); log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); dieOrLeave(f, 'gy'); }
    if (e.t === 'discardSelf') { await applyEffect(P, e, null, src); return true; }
    log(`${P.name} ${you(P) ? 'choose' : 'chooses'} to ${what}.`);
    return true;
}
function bestPoolColor(P, among = COLORS) {
    const need = { W: 0, U: 0, B: 0, R: 0, G: 0, C: -1 };
    P.hand.forEach(o => COLORS.forEach(c => { need[c] += Rx(o).cost[c] || 0; }));
    return among.slice().sort((a, b) => need[b] - need[a])[0];
}
// Scry / surveil: you choose top or bottom (graveyard) for each card; the AI keeps what it can use soon
function pickScry(P, cards, surveil, src) {
    const lands = P.bf.filter(x => Rx(x).kind === 'land').length + P.hand.filter(x => Rx(x).kind === 'land').length;
    const aiKeep = o => Rx(o).kind === 'land' ? lands < 5 : Rx(o).support !== 'none' && (o.card.cmc || 0) <= lands + 1;
    if (P.isAI) return Promise.resolve(cards.map(aiKeep));
    if (G && G.hotseat && G.view !== P.i) return handTo(P).then(() => pickScry(P, cards, surveil, src));
    const keep = cards.map(() => true);
    return new Promise(resolve => {
        window.__scryT = i => { keep[i] = !keep[i]; draw(); };
        window.__scryOk = () => { closeModal(); resolve(keep); };
        const draw = () => showModal(`<h2>${esc(src.card.name)}: ${surveil ? 'surveil' : 'scry'} ${cards.length}</h2><p class="note">Tap a card to switch it between top and ${surveil ? 'graveyard' : 'bottom'}. The first card is the top.</p>
            <div class="pick-grid">${cards.map((o, i) => `<button type="button" class="pick-card scry-${keep[i] ? 'top' : 'away'}" onclick="__scryT(${i})" title="${esc(o.card.name)}">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}<span class="scry-tag">${keep[i] ? 'Top' : surveil ? 'Graveyard' : 'Bottom'}</span></button>`).join('')}</div>
            <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn primary" onclick="__scryOk()">Done</button></div>`);
        draw();
    });
}
// ---- Static abilities: lords and anthems ----
function hasType(o, type) {
    if (Rx(o).kw.has('changeling') || new RegExp(`\\b${type}\\b`).test(o.card.type)) return true;
    if (type === 'Island' && o.ctr && o.ctr.flood > 0) return true; // Quicksilver Fountain
    if (Rx(o).duplicant && o.imprinted && new RegExp(`\\b${type}\\b`).test(o.imprinted.card.type.split(' — ')[1] || '')) return true;
    if (Rx(o).chosenSelf && o.chosenType === type) return true;
    if (!G) return false;
    if (LAND_COLOR[type] && /\bLand\b/.test(o.card.type) && G.players[o.owner].bf.some(a => Rx(a).landTypeMine === type && !lostAbilities(a))) return true;
    if (LAND_COLOR[type] && /\bLand\b/.test(o.card.type) && allPerms().some(a => Rx(a).landTypeAll === type || (Rx(a).landsAnyColor && a.owner === o.owner && /every basic land type/.test(a.card.text || '')))) return true;
    // "... and is a Cleric in addition to its other types" (Equipment, Auras) and "As long as ..., it is an Assassin"
    return allPerms().some(a => a.attachedTo === o.uid && Rx(a).addType === type) || (Rx(o).selfCond || []).some(c => c.addType === type && condOk(c.cond, ctrl(o), o));
}
const isEquipped = o => allPerms().some(a => a.attachedTo === o.uid && Rx(a).isEquipment);
// "Enchanted creature ... loses all other abilities" (Stasis Field)
function lostAbilities(o) { return !!G && !!o && o.uid !== undefined && allPerms().some(a => a.attachedTo === o.uid && Rx(a).buffLose); }
function staticMatch(o, what) {
    switch (what) {
        case 'token': return !!o.token;
        case 'legendary': return /Legendary/.test(o.card.type);
        case 'artifact': return /Artifact/.test(o.card.type);
        case 'attacking': return G.attackers.includes(o.uid);
        case 'flying': return has(o, 'flying');
        case 'pt1': return basePT(o, 'p') + o.counters + o.tp <= 1 || basePT(o, 'q') + o.counters + o.tq <= 1;
    }
    return true;
}
// Statics that match on a quality (flying, power) ask has()/pow(), which ask staticBuffs again:
// inside that nested ask only the statics without a quality filter count (abilities first, layer 6 before 7c).
let staticDepth = 0;
function staticBuffs(o) {
    const b = { p: 0, q: 0, kw: [] };
    if (!isCreature(o)) return b;
    if (staticDepth > 1) return b;
    staticDepth++;
    try {
    { const X = G.players[o.owner]; for (const c of X.gy) { const gs = Rx(c).gyStatic; if (gs && X.bf.some(l => hasType(l, gs.type))) b.kw.push(...gs.kw); } }
    for (const a of allPerms()) {
        const st = Rx(a).statics;
        if (!st || !st.length || lostAbilities(a)) continue;
        for (const s of st) {
            if (!s.global && a.owner !== o.owner) continue;
            if (s.other && a === o) continue;
            if (s.opp && a.owner === o.owner) continue;
            if (s.type === '*chosen' ? !(a.chosenType && hasType(o, a.chosenType)) : (s.type && !hasType(o, s.type))) continue;
            if (s.types && !s.types.some(ty => hasType(o, ty))) continue;
            if (s.match && (staticDepth > 1 || !staticMatch(o, s.match))) continue;
            if (s.colorChosen && !(a.chosenColor && (o.card.colors || []).includes(a.chosenColor))) continue;
            if (s.cond && !condOk(s.cond, G.players[a.owner], a)) continue;
            b.p += s.p; b.q += s.q; b.kw.push(...s.kw);
        }
    }
    } finally { staticDepth--; }
    return b;
}

// ---- Triggers: queued when something happens, put on the stack at the next safe point (603.3) ----
const TRIG_FN = {
    prison: (o, ctx) => !!o.imprinted && !!ctx.o && ((ctx.o.card.colors || []).some(c => (o.imprinted.card.colors || []).includes(c)) || (ctx.o.card.cmc || 0) === (o.imprinted.card.cmc || 0)),
    helix: (o, ctx) => !!o.helix && !!ctx.o && o.helix.some(c => c.name === ctx.o.card.name),
    artAnyOrSelf: (o, ctx) => !!ctx.o && /Artifact/.test(ctx.o.card.type),
    artAny: (o, ctx) => !!ctx.o && /Artifact/.test(ctx.o.card.type),
    artCreatureDies: (o, ctx) => !!ctx.o && (ctx.o === o || /Artifact/.test(ctx.o.card.type)),
    oppSourceToMe: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.src && ctx.src.owner !== undefined && ctx.src.owner !== o.owner,
    toMe: (o, ctx) => !!ctx.P && ctx.P.i === o.owner,
    toOpp: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner,
    confusion: (o, ctx) => !!ctx.o && (isCreature(ctx.o) || /Artifact|Enchantment/.test(ctx.o.card.type)),
    selfCombatCreature: (o, ctx) => ctx.src === o && !!G.inCombatDamage && !!ctx.o && isCreature(ctx.o),
    hostCombat: (o, ctx) => !!ctx.src && ctx.src.uid === o.attachedTo && !!G.inCombatDamage,
    hostToCreature: (o, ctx) => !!ctx.src && ctx.src.uid === o.attachedTo && !!ctx.o && isCreature(ctx.o)
};
function trigMatches(tr, ev, o, ctx) {
    if (tr.ev !== ev) return false;
    if (tr.fn) return !!TRIG_FN[tr.fn](o, ctx, tr) && (ev !== 'cast' || (tr.who === 'any' || ctx.P.i === o.owner) && castFilter(tr.filter || 'any', ctx.o));
    if (ev === 'artifactToGy' || ev === 'shuffled') return true;
    if (ev === 'discarded') return tr.who === 'opp' ? ctx.P.i !== o.owner : ctx.P.i === o.owner; // Magic 2010: Megrim
    if (ev === 'playerDamaged') return false;
    if (ev === 'blocks' && tr.host) return ctx.list.some(x => x.uid === o.attachedTo);
    if (ev === 'blocked' && tr.host) return !!ctx.o && ctx.o.uid === o.attachedTo;
    if (ev === 'targeted' && tr.host) return !!ctx.o && ctx.o.uid === o.attachedTo;
    if (ev === 'main1' && tr.who === 'each') return true;
    // Starter kits (2026-10-06)
    if (ev === 'dealsDamage') return (tr.host ? !!ctx.src && ctx.src.uid === o.attachedTo : ctx.src === o) && (!tr.toOpp || (!!ctx.P && ctx.P.i !== o.owner)) && (!tr.toType || (!!ctx.o && tr.toType.some(ty => hasType(ctx.o, ty))));
    if (ev === 'artifactDies') return ctx.o !== o && (!tr.mine || ctx.o.owner === o.owner);
    if (ev === 'tokenMade') return ctx.P.i === o.owner;
    if (ev === 'sacrificed' && tr.tokenMine) return !!ctx.o.token && ctx.o.owner === o.owner;
    if (ev === 'sacrificed' && tr.anySac) return true;
    if (ev === 'sacrificed' && tr.sacType) return ctx.o.owner === o.owner && hasType(ctx.o, tr.sacType);
    if (ev === 'sacrificed') return ctx.o === o;
    if (ev === 'counters' && tr.anyone) return ctx.o === o;
    if (ev === 'hitPlayer' && tr.anyMine) return ctx.src.owner === o.owner && (!tr.type || hasType(ctx.src, tr.type));
    if (ev === 'combatHitAny' && tr.nontoken) return ctx.P.i === o.owner && (ctx.list || []).some(x => !x.token);
    if (ev === 'enters' && tr.historic) return ctx.o.owner === o.owner && !ctx.o.token && /Artifact|Legendary|Saga/.test(ctx.o.card.type);
    if (ev === 'blocks' && tr.vsFlying) return ctx.list.includes(o) && Object.entries(G.blocks).some(([a, bs]) => bs.includes(o.uid) && onBf(Number(a)) && has(onBf(Number(a)), 'flying'));
    if (ev === 'attacks' && tr.host && tr.alone) return ctx.list.length === 1 && ctx.list[0].uid === o.attachedTo;
    if (ev === 'selfEnters') return ctx.o === o;
    // Top-1000 round (2026-10-06)
    if (ev === 'draw' && tr.who === 'opp') return ctx.P.i !== o.owner && (!tr.nth || ctx.n === tr.nth);
    if (ev === 'enters' && tr.theirsEnter) return ctx.o.owner !== o.owner && isCreature(ctx.o);
    if (ev === 'enters' && tr.artEnter) return ctx.o.owner === o.owner && /Artifact/.test(ctx.o.card.type) && !(tr.another && ctx.o === o);
    if (ev === 'upkeep' && tr.who === 'opp') return G.active !== o.owner;
    if (ev === 'main1') return G.active === o.owner;
    if (ev === 'combatHitAny') return ctx.P.i === o.owner;
    // Top-1000 round 2 (2026-10-07)
    if (ev === 'loseLife') return tr.who === 'opp' ? ctx.P.i !== o.owner : ctx.P.i === o.owner;
    if (ev === 'leaves' && tr.tokenMine) return !!ctx.o.token && ctx.o.owner === o.owner;
    if (ev === 'enters' && tr.typeEnter) { const x = ctx.o; if (x.owner !== o.owner || (!tr.self && x === o)) return false; const f = tr.typeEnter; return (f.creature ? isCreature(x) : true) && (!f.type || new RegExp(`\\b${f.type}\\b`).test(x.card.type) || hasType(x, f.type)) && (!f.color || (x.card.colors || []).includes(f.color)) && (!f.mvMax || (x.card.cmc || 0) <= f.mvMax) && (!f.kw || has(x, f.kw)) && (!f.nontoken || !x.token) && (!f.chosen || hasType(x, chosenTypeOf(o))) && (!f.uniqueName || !G.players[o.owner].bf.some(y => y !== x && isCreature(y) && y.card.name === x.card.name) && !G.players[o.owner].gy.some(y => /Creature/.test(y.card.type) && y.card.name === x.card.name)); }
    if (ev === 'attacks' && tr.chosen) return ctx.list.some(x => x.owner === o.owner && hasType(x, chosenTypeOf(o)));
    if (ev === 'hitPlayer' && tr.anyMine && tr.only) return ctx.src.owner === o.owner && (tr.only === 'token' ? !!ctx.src.token : /\bArtifact\b/.test(ctx.src.card.type) && isCreature(ctx.src));
    if (ev === 'enters' && tr.filt === 'nontokenArtifact') return !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && !ctx.o.token && /\bArtifact\b/.test(ctx.o.card.type);
    if (ev === 'targeted') return ctx.o === o;
    if (ev === 'artifactMana') return !!ctx.o && ctx.o.owner !== o.owner;
    if (ev === 'creatureDies' && tr.any && tr.nontoken) return !!ctx.o && !ctx.o.token;
    if (ev === 'hitPlayer' && tr.anyMine && tr.modified) return ctx.src.owner === o.owner && (ctx.src.counters > 0 || Object.values(ctx.src.ctr || {}).some(v => v > 0) || allPerms().some(a => a.attachedTo === ctx.src.uid));
    if (ev === 'combatHitAny' && tr.artifactCreature) return ctx.P.i === o.owner && (ctx.list || []).some(x => /Artifact/.test(x.card.type) && isCreature(x));
    if (ev === 'artifactDies' && tr.nonCreature) return ctx.o !== o && ctx.o.owner === o.owner && !/Creature/.test(ctx.o.card.type);
    if (ev === 'landfall' && tr.theirs) return !!ctx.o && ctx.o.owner !== o.owner;
    if (ev === 'combat' && tr.who === 'each') return true;
    if (ev === 'dealtDamage' || ev === 'blocked' || ev === 'leaves') return ctx.o === o;
    if (ev === 'scry') return ctx.P.i === o.owner;
    if (ev === 'counters') return ctx.P.i === o.owner && (tr.self ? ctx.o === o : ctx.o !== o);
    if (ev === 'draw' && tr.nth) return ctx.P.i === o.owner && ctx.n === tr.nth;
    if (ev === 'upkeep' && tr.who === 'host') { const h = o.attachedTo && onBf(o.attachedTo); return !!h && G.active === h.owner; }
    if (ev === 'combat' && tr.each) return true;
    if (ev === 'attacks' && tr.withCounter) return ctx.list.some(x => x.owner === o.owner && x.counters > 0);
    if (ev === 'attacks' && (tr.attackWith || tr.min || tr.alone || tr.color)) {
        const mine = ctx.list.filter(x => x.owner === o.owner);
        if (tr.alone) return ctx.list.length === 1 && (tr.anyMine ? mine.length === 1 : ctx.list[0] === o);
        if (tr.color) return mine.some(x => (x.card.colors || []).includes(tr.color));
        if (tr.min && !tr.attackWith) return ctx.list.includes(o) && ctx.list.length >= tr.min;
        const fit = mine.filter(x => (!tr.minPow || pow(x) >= tr.minPow) && (tr.attackWith === 'creatures' || (tr.attackWith === 'legendary creatures' ? /Legendary/.test(x.card.type) : tr.attackWith.split('|').some(w => hasType(x, PLURAL_TYPES[w] || w.replace(/s$/, ''))))));
        return fit.length >= (tr.min || 1);
    }
    if (ev === 'enters' && tr.evolve) return ctx.o.owner === o.owner && ctx.o !== o && isCreature(ctx.o);
    if (ev === 'enters' && tr.filt) {
        const x = ctx.o;
        if (x.owner !== o.owner || !isCreature(x) || (tr.another && x === o)) return false;
        const f = tr.filt;
        if (COLOR_WORDS[f]) return (x.card.colors || []).includes(COLOR_WORDS[f]);
        let mm;
        if ((mm = f.match(/power<=(\d+)|power (\w+) or less/))) return pow(x) <= (+mm[1] || num(mm[2]));
        if ((mm = f.match(/power>=(\d+)/))) return pow(x) >= +mm[1];
        if (f === 'toughGtPow') return tou(x) > pow(x);
        return hasType(x, PLURAL_TYPES[f] || f);
    }
    if (ev === 'creatureDies' && (tr.type || tr.theirs || tr.damagedBy)) {
        if (tr.theirs) return ctx.o.owner !== o.owner && (!tr.legendary || /Legendary/.test(ctx.o.card.type));
        if (tr.damagedBy) return !!(ctx.o.dmgBy && ctx.o.dmgBy[o.uid] === G.turn) && ctx.o !== o;
        return ctx.o.owner === o.owner && hasType(ctx.o, tr.type) && !(tr.another && ctx.o === o) && !(tr.nontoken && ctx.o.token);
    }
    if (ev === 'tapped') return tr.host ? ctx.o.uid === o.attachedTo : ctx.o === o;
    if (ev === 'exerted') return ctx.o === o;
    const mine = x => x && x.owner === o.owner;
    switch (ev) {
        case 'upkeep': case 'end': return tr.who === 'each' || G.active === o.owner;
        case 'combat': return G.active === o.owner;
        case 'attacks': return tr.host ? ctx.list.some(x => x.uid === o.attachedTo) : tr.anyMine ? ctx.list.some(x => x.owner === o.owner) : ctx.list.includes(o);
        case 'blocks': return ctx.list.includes(o);
        case 'dies': return tr.host ? ctx.o.uid === o.attachedTo : ctx.o === o;
        case 'toGy': return ctx.o === o;
        case 'hitPlayer': return tr.host ? ctx.src.uid === o.attachedTo : ctx.src === o;
        case 'cast': castFilterSrc = o; return (tr.who === 'any' || (tr.who === 'opp' ? ctx.P.i !== o.owner : ctx.P.i === o.owner)) && castFilter(tr.filter, ctx.o) && (!tr.nth || (G.castBy || [0, 0])[ctx.P.i] === tr.nth);
        case 'landfall': return mine(ctx.o);
        case 'enters': return (tr.anyone || mine(ctx.o)) && isCreature(ctx.o) && !(tr.another && ctx.o === o) && !(tr.nontoken && ctx.o.token);
        case 'creatureDies': return ctx.o !== o && (!tr.mine || mine(ctx.o)) && !(tr.nontoken && ctx.o.token);
        case 'gainLife': case 'draw': return ctx.P.i === o.owner;
    }
    return false;
}
let castFilterSrc = null;
function castFilter(f, o) {
    const k = Rx(o).kind, t = o.card.type;
    return f === 'any' || (f === 'chosenType' && k === 'creature' && !!castFilterSrc && hasType(o, chosenTypeOf(castFilterSrc))) || (f === 'noncreature' && k !== 'creature') || (f === 'creature' && k === 'creature') || (f === 'instant or sorcery' && (k === 'instant' || k === 'sorcery'))
        || (f === 'artifact' && /Artifact/.test(t)) || (f === 'enchantment' && /Enchantment/.test(t)) || (f === 'multicolored' && (o.card.colors || []).length > 1)
        || (f === 'historic' && (/Artifact|Legendary|Saga/.test(t)))
        || (/^types:/.test(f) && f.slice(6).split('|').some(w => new RegExp(`\\b${w}\\b`).test(t)))
        || (COLOR_WORDS[f] && (o.card.colors || []).includes(COLOR_WORDS[f]))
        || (/^colors:/.test(f) && f.slice(7).split('|').some(c => (o.card.colors || []).includes(c)))
        || (/^mv\d+$/.test(f) && (o.card.cmc || 0) >= +f.slice(2))
        || (/^cpow\d+$/.test(f) && k === 'creature' && (Number(o.card.power) || 0) >= +f.slice(4))
        || (/^noncreature\|/.test(f) && (k !== 'creature' || new RegExp(`\\b${f.split('|')[1]}\\b`).test(t)))
        || (f === 'chosenColor' && castFilterSrc && castFilterSrc.chosenColor && (o.card.colors || []).includes(castFilterSrc.chosenColor));
}
function landsUntappedFor(X) { return X.bf.some(a => Rx(a).landsUntapped && !lostAbilities(a)); }
function fire(ev, ctx = {}) {
    if (!G || G.over) return;
    if (ev === 'enters' && ctx.o && G.reflection && G.reflection.turn === G.turn && (isCreature(ctx.o) || isPlaneswalker(ctx.o))) {
        const rf = G.reflection, x = ctx.o;
        x.copyOf = x.copyOf || x.card; x.card = { ...rf.card, id: `${rf.card.id}-copy${uidSeq++}` };
        log(`${x.copyOf.name} enters as a copy of ${rf.card.name} (Mystic Reflection).`);
        if (!rf.ending) { rf.ending = true; Promise.resolve().then(() => { if (G && G.reflection === rf) G.reflection = null; }); }
    }
    // Horizon Explorer, Spelunking: lands you control enter untapped (also ones put onto the battlefield tapped)
    if (ev === 'landfall' && ctx.o && ctx.o.tapped && landsUntappedFor(G.players[ctx.o.owner])) ctx.o.tapped = false;
    if (ev === 'creatureDies') { G.diedTurn = G.turn; G.diedN = G.diedN && G.diedN.turn === G.turn ? { turn: G.turn, n: G.diedN.n + 1 } : { turn: G.turn, n: 1 }; }
    if (ev === 'cast' && ctx.o) {
        G.lastCast = ctx.o;
        G.castKinds = G.castKinds || {};
        const k = G.castKinds[ctx.P.i] && G.castKinds[ctx.P.i].turn === G.turn ? G.castKinds[ctx.P.i] : (G.castKinds[ctx.P.i] = { turn: G.turn, instant: 0, sorcery: 0, otter: 0 });
        const kind = Rx(ctx.o).kind;
        if (kind === 'instant') k.instant++; if (kind === 'sorcery') k.sorcery++; if (hasType(ctx.o, 'Otter')) k.otter++;
    }
    if ((ev === 'enters' || ev === 'landfall') && ctx.o) (G.entered = (G.entered || []).filter(e => e.turn === G.turn)).push({ turn: G.turn, o: ctx.o, owner: ctx.o.owner, creature: isCreature(ctx.o), land: /\bLand\b/.test(ctx.o.card.type) });
    // Cards with abilities that work from the graveyard (Shambling Cie'th)
    G.players.forEach(X => X.gy.filter(o => Rx(o).gyTrig).forEach(o => Rx(o).gyTrig.forEach(tr => { if (trigMatches(tr, ev, o, ctx) && (!tr.cond || condOk(tr.cond, X, o))) (G.trigQ = G.trigQ || []).push({ P: X, o, effects: tr.effects }); })));
    if (ev === 'gainLife' && ctx.P) ctx.P.gainedTurn = G.turn;
    // Metallic Mimic: another creature of the chosen type enters with an extra +1/+1 counter (a replacement, not a trigger)
    if (ev === 'enters' && ctx.o && isCreature(ctx.o)) G.players[ctx.o.owner].bf.filter(a => a !== ctx.o && Rx(a).mimic && !lostAbilities(a) && a.chosenType && hasType(ctx.o, a.chosenType)).forEach(a => { ctx.o.counters += 1; log(`${ctx.o.card.name} enters with an additional +1/+1 counter (${a.card.name}).`); });
    if (ev === 'enters' && ctx.o) fire('selfEnters', { o: ctx.o });
    // A land's own "when ~ enters" abilities (lands don't use the stack to enter, 305.1)
    if (ev === 'landfall' && ctx.o) { fire('selfEnters', { o: ctx.o }); if (Rx(ctx.o).etb.length) (G.trigQ = G.trigQ || []).push({ P: G.players[ctx.o.owner], o: ctx.o, effects: Rx(ctx.o).etb }); }
    if (ev === 'attacks') G.attackedTurn = G.turn;
    const perms = (ev === 'dies' || ev === 'toGy' || ev === 'leaves') && ctx.o ? [ctx.o, ...allPerms().filter(x => x !== ctx.o)] : allPerms();
    if (ev === 'draw' && ctx.P) { if (ctx.P.drawTurn !== G.turn) { ctx.P.drawTurn = G.turn; ctx.P.drawN = 0; } ctx.n = ++ctx.P.drawN; }
    for (const o of perms) {
        if (lostAbilities(o)) continue;
        // Built-in keyword triggers
        if (ev === 'cast' && o.owner === ctx.P.i && has(o, 'prowess') && Rx(ctx.o).kind !== 'creature' && onBf(o.uid)) { o.tp++; o.tq++; log(`${o.card.name}: prowess, +1/+1 until end of turn.`); }
        for (const tr of [...(Rx(o).trig || []), ...grantsOn(o).flatMap(g => g.trig)]) {
            if (!trigMatches(tr, ev, o, ctx)) continue;
            if (tr.cond && !condOk(tr.cond, G.players[o.owner], o)) continue; // intervening "if" (603.4)
            if (tr.once) { o.onceTurn = o.onceTurn || {}; if (o.onceTurn[tr.once] === G.turn) continue; o.onceTurn[tr.once] = G.turn; }
            if ((G.trigCount = (G.trigCount || 0) + 1) > 250) { if (G.trigCount === 251) log('Too many triggers this turn - the rest are skipped.'); continue; }
            const times = tr.anyMine && ev === 'attacks' ? ctx.list.filter(x => x.owner === o.owner).length : 1;
            // The creature the event is about ("put a +1/+1 counter on it"); for attacks, the attacker
            const ctxObj = (ev === 'cast' ? null : ctx.o) || (ctx.list && (tr.alone ? ctx.list[0] : ctx.list.find(x => x.owner === o.owner && (!tr.color || (x.card.colors || []).includes(tr.color))))) || null;
            const ctxCount = tr.attackWith ? ctx.list.filter(x => x.owner === o.owner && (tr.attackWith === 'creatures' || (tr.attackWith === 'legendary creatures' ? /Legendary/.test(x.card.type) : hasType(x, PLURAL_TYPES[tr.attackWith] || tr.attackWith.replace(/s$/, ''))))).length : ctx.n || 0;
            if (tr.anyMine && tr.ctxTarget && !tr.alone) { ctx.list.filter(x => x.owner === o.owner && (!tr.color || (x.card.colors || []).includes(tr.color)) && (!tr.withCounter || x.counters > 0)).forEach(x => (G.trigQ = G.trigQ || []).push({ P: G.players[o.owner], o, effects: tr.effects, ctx: x })); continue; }
            for (let k = 0; k < times; k++) (G.trigQ = G.trigQ || []).push({ P: G.players[o.owner], o, effects: tr.effects, ctx: ctxObj, ctxCount, raw: { P: ctx.P, o: ctx.o, by: ctx.by } });
        }
    }
}
async function flushTriggers() {
    while (G && G.trigQ && G.trigQ.length && !G.over) {
        const t = G.trigQ.shift();
        await putTriggers(t.P, t.o, t.effects, t.ctx, t.ctxCount, t.raw);
    }
}
// Put waiting triggers on the stack and resolve everything
async function settle() {
    if (!G || G.over) return;
    await flushTriggers();
    await runStack();
}

// ---- Activated abilities ----
function sourceCanTap(o) { return !o.tapped && !(isCreature(o) && o.sick && !has(o, 'haste')); }
function actCost(o, a) {
    let mana = a.cost.mana;
    if (a.cost.xImprint) mana = { ...mana, generic: mana.generic + (o.imprinted ? o.imprinted.card.cmc || 0 : 0) };
    const cut = (a.lessIf && condOk(a.lessIf.cond, ctrl(o), o) ? a.lessIf.n : 0) + (a.lessPer ? a.lessPer.n * countFn(a.lessPer.what)(o) : 0);
    if (a.powerUp && o.enteredTurn === G.turn) { const c = Rx(o).cost; mana = { ...mana }; ['W', 'U', 'B', 'R', 'G', 'C'].forEach(k => { mana[k] = Math.max(0, (mana[k] || 0) - (c[k] || 0)); }); mana.generic = Math.max(0, mana.generic - c.generic); }
    if (Rx(o).blueAny) { const col = ['W', 'B', 'R', 'G'].reduce((a, k) => a + (mana[k] || 0), 0); if (col) mana = { ...mana, W: 0, B: 0, R: 0, G: 0, generic: mana.generic + col }; }
    return cut ? { ...mana, generic: Math.max(0, mana.generic - cut) } : mana;
}
function actPlan(P, o, a, xExtra = 0) {
    if (a.hand ? !P.hand.includes(o) : a.gy ? !P.gy.includes(o) : !P.bf.includes(o)) return null;
    if (o.detainedUntil > G.turn) return null;
    if (a.onlyIf && !condOk(a.onlyIf, P, o)) return null;
    if ((a.onceEver || a.powerUp) && (o.usedOnce || {})[a.text]) return null;
    if (a.hand || a.gy) return planPayment(P, actCost(o, a), xExtra);
    if (a.cost && a.cost.tap && !sourceCanTap(o)) return null;
    if (a.once && o.actTurn && o.actTurn[a.text] === G.turn) return null;
    if (a.loyalty !== undefined) {
        if (o.loyaltyTurn === G.turn) return null;
        if ((o.ctr.loyalty || 0) + a.loyalty < 0) return null;
        return [];
    }
    if (a.crew !== undefined) return !dampingOn() && crewPick(P, o, a.crew) ? [] : null;
    if (a.saddle !== undefined) return o.saddledTurn !== G.turn && crewPick(P, o, a.saddle) ? [] : null;
    if (a.cost.life && P.life < a.cost.life) return null;
    if (dampingOn() && (isCreature(o) || /Artifact/.test(o.card.type)) && !a.effects.every(e => e.t === 'addMana')) return null; // Damping Matrix
    if (a.cost.exileTop && P.library.length < a.cost.exileTop) return null;
    if (a.cost.removeNamed && !((o.ctr[a.cost.removeNamed] || 0) > 0)) return null;
    if (a.cost.removeAny && !P.bf.some(x => x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0))) return null;
    if (a.cost.removeCounter && o.counters < a.cost.removeCounter) return null;
    if (a.cost.energy && (P.energy || 0) < a.cost.energy) return null;
    if (a.cost.discard && !P.hand.length) return null;
    if (a.cost.sacCreature && !sacFodder(P, o, 'creature')) return null;
    if (a.cost.tapOther && !tapFodder(P, o, a.cost.tapOther)) return null;
    if (a.cost.sacPerm && !sacFodder(P, o, a.cost.sacPerm)) return null;
    if (a.cost.sacN && P.bf.filter(x => new RegExp(`\\b${a.cost.sacN.kind}\\b`).test(x.card.type)).length < a.cost.sacN.n) return null;
    if (a.cost.exileGy && P.gy.length < a.cost.exileGy) return null;
    if (a.cost.xImprint && !o.imprinted) return null;
    if (a.cost.returnArt && !P.bf.some(x => /\bArtifact\b/.test(x.card.type) && x !== o)) return null;
    if (a.cost.returnLands && P.bf.filter(x => /\bLand\b/.test(x.card.type)).length < a.cost.returnLands) return null;
    // Pay with other sources first so the permanent itself stays untapped when it can
    const mana = actCost(o, a);
    return planPayment(P, mana, xExtra, o, { forType: o.card.type }) || (a.cost.tap ? null : planPayment(P, mana, xExtra, null, { forType: o.card.type }));
}
function actTimingOk(P, a) {
    if (a.upkeepOnly) return G.active === P.i && G.phase === 'upkeep' && !G.stack.length;
    if (a.yourTurn && G.active !== P.i) return false;
    if (a.sorcery || a.loyalty !== undefined) return G.active === P.i && MAIN.includes(G.phase) && !G.stack.length && G.priority === null;
    if (G.stack.length || G.priority !== null) return G.priority === P.i;
    if (G.active === P.i) return [...MAIN, 'afterBlocks', 'declareAttackers'].includes(G.phase);
    return G.phase === 'declareBlocks';
}
// Gravecrawler: "You may cast ~ from your graveyard as long as you control a Zombie"
function gyCastOk(P, o) { const ty = Rx(o).gyCastIf; return !!ty && P.gy.includes(o) && P.bf.some(x => hasType(x, ty)); }
function mayhemOk(P, o) { return !!Rx(o).mayhem && o.discardTurn === G.turn && P.gy.includes(o); }
function grantsOn(o) { return allPerms().filter(a => a.attachedTo === o.uid && Rx(a).grant).map(a => Rx(a).grant); }
function actsOf(o) {
    const R = Rx(o);
    const zoneP = G && G.players.find(X => X.hand.includes(o) || X.gy.includes(o));
    if (zoneP) return zoneP.hand.includes(o) ? (R.handActs || []) : (R.gyActs || []);
    if (lostAbilities(o)) return [];
    const out = [...R.acts, ...grantsOn(o).flatMap(g => g.acts), ...(R.condActs || []).filter(c => condOk(c.cond, ctrl(o), o)).map(c => c.act), ...(o.borrowed && o.borrowed.turn === G.turn ? o.borrowed.acts : [])];
    if (R.crew !== null && R.crew !== undefined) out.push({ crew: R.crew, effects: [], text: `Crew ${R.crew}` });
    if (R.saddle) out.push({ saddle: R.saddle, effects: [], text: `Saddle ${R.saddle}`, sorcery: true });
    return out;
}
// The least valuable permanent of a kind to sacrifice for a cost (tokens first)
function sacFodder(P, src, kind) {
    if (/ or /.test(kind)) return kind.split(' or ').map(k => sacFodder(P, src, k)).filter(Boolean).sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0] || null;
    if (kind === 'token') return P.bf.filter(x => x.token && x !== src).sort((a, b) => permValue(a) - permValue(b))[0] || null;
    if (/^creature:[WUBRG]$/.test(kind)) return P.bf.filter(x => isCreature(x) && x !== src && (x.card.colors || []).includes(kind.slice(9))).sort((a, b) => permValue(a) - permValue(b))[0] || null;
    const fits = x => kind === 'creature' ? isCreature(x) : kind === 'artifact' ? /Artifact/.test(x.card.type) : kind === 'land' ? /\bLand\b/.test(x.card.type) : new RegExp(`\\b${kind}\\b`).test(x.card.type);
    return P.bf.filter(x => fits(x) && !(kind === 'creature' && x === src && false)).sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0] || null;
}
// Everything that could pay "sacrifice a <kind>" (sacFodder picks the least valuable of these)
function sacCandidates(P, src, kind) {
    if (/ or /.test(kind)) return [...new Set(kind.split(' or ').flatMap(k => sacCandidates(P, src, k)))];
    if (kind === 'token') return P.bf.filter(x => x.token && x !== src);
    if (/^creature:[WUBRG]$/.test(kind)) return P.bf.filter(x => isCreature(x) && x !== src && (x.card.colors || []).includes(kind.slice(9)));
    const fits = x => kind === 'creature' ? isCreature(x) : kind === 'artifact' ? /Artifact/.test(x.card.type) : kind === 'land' ? /\bLand\b/.test(x.card.type) : new RegExp(`\\b${kind}\\b`).test(x.card.type);
    return P.bf.filter(fits);
}
// The player chooses what to sacrifice (rule 701.21a); the computer takes its least valuable
async function chooseSac(P, src, kind, label) {
    const best = sacFodder(P, src, kind);
    if (!best || P.isAI || AUTOPLAY) return best;
    const pool = sacCandidates(P, src, kind);
    if (pool.length <= 1) return best;
    return (await pickCard(P, pool, `${label || (src && src.card ? src.card.name : 'Sacrifice')}: choose ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind.replace(/:.*/, '')} to sacrifice`, { required: true })) || best;
}
// Several at once ("Sacrifice three lands", "Sacrifice two artifacts")
async function chooseSacN(P, pool, n, label) {
    const auto = pool.slice().sort((a, b) => (b.tapped - a.tapped) || (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b))).slice(0, n);
    if (P.isAI || AUTOPLAY || pool.length <= n) return auto;
    const out = [];
    for (let k = 0; k < n; k++) { const left = pool.filter(x => !out.includes(x)); const c = await pickCard(P, left, `${label}: choose what to sacrifice (${k + 1} of ${n})`, { required: true }); out.push(c || left.sort((a, b) => permValue(a) - permValue(b))[0]); }
    return out;
}
// "Return target ... card from your graveyard": needs such a card to cast or activate (owner's report, Skeleton Shard)
function gyTargetMissing(P, fx, self) { const e = fx && fx[0]; return !!e && e.t === 'regrow' && !e.may && !e.bfIf && !e.anyGy && !P.gy.some(x => x !== self && cardFits(x, e.what)); }
function canActivate(P, o, a) { return !G.over && !needled(o, a) && !gyTargetMissing(P, a.effects, o) && actTimingOk(P, a) && !!actPlan(P, o, a); }
// Crew N: tap untapped creatures with total power N or more (the weakest that do it)
function crewPick(P, v, n) {
    const pool = P.bf.filter(c => c !== v && isCreature(c) && !c.tapped).sort((a, b) => creatureValue(a) - creatureValue(b));
    const out = [];
    let sum = 0;
    for (const c of pool) { if (sum >= n) break; out.push(c); sum += Math.max(0, pow(c)); }
    return sum >= n ? out : null;
}
// The most X an activated ability with {X} in its cost can be paid for
function maxActX(P, o, a) { const xn = a.cost.mana.xn || 1; let x = 0; while (x < 30 && planPayment(P, actCost(o, a), (x + 1) * xn, a.cost.tap ? o : null, { forType: o.card.type })) x++; return x; }
async function activate(P, o, a, presetTarget, presetX) {
    if (!canActivate(P, o, a)) return false;
    let xExtra = 0;
    if (a.cost && a.cost.mana && a.cost.mana.x) {
        const mx = maxActX(P, o, a);
        let x = presetX ?? mx;
        if (presetX === undefined && P.isAI && a.effects.some(e => e.t === 'hellkiteWipe')) { const val = n => (o.hitTurn && o.hitTurn.turn === G.turn ? o.hitTurn.players : []).reduce((s2, pi) => s2 + G.players[pi].bf.filter(y => !/\bLand\b/.test(y.card.type) && (y.card.cmc || 0) === n).reduce((v, y) => v + (y.owner === P.i ? -permValue(y) : permValue(y)), 0), 0); let bx = 0, bv = 0; for (let n = 0; n <= mx; n++) if (val(n) > bv) { bv = val(n); bx = n; } x = bx; }
        if (!P.isAI && !AUTOPLAY && presetX === undefined) { x = await askNumber(P, `Choose X for ${o.card.name}`, 0, mx, mx, { card: o.card, ok: 'Activate' }); if (x === null || !(x >= 0 && x <= mx)) return false; }
        xExtra = x * (a.cost.mana.xn || 1);
        a = { ...a, effects: withX(a.effects, x) };
    }
    if (a.loyaltyX) { // Chandra Nalaar's −X: X is paid in loyalty
        const mx = o.ctr.loyalty || 0;
        let x = presetX ?? mx;
        if (!P.isAI && !AUTOPLAY && presetX === undefined) { x = await askNumber(P, `Choose X for ${o.card.name} (removes X loyalty)`, 0, mx, Math.min(mx, 2), { card: o.card, ok: 'Activate' }); if (x === null || !(x >= 0 && x <= mx)) return false; }
        a = { ...a, loyalty: -x, effects: withX(a.effects, x) };
    }
    if (a.saddle !== undefined) {
        const crew = crewPick(P, o, a.saddle);
        if (!crew) return false;
        crew.forEach(c => { c.tapped = true; fire('tapped', { o: c }); });
        o.saddledTurn = G.turn; o.saddlers = crew.map(c => c.uid);
        log(`${P.name} ${you(P) ? 'saddle' : 'saddles'} ${o.card.name} with ${crew.map(c => c.card.name).join(', ')} (rule 702.171).`);
        renderGame();
        return true;
    }
    if (a.crew !== undefined) {
        const crew = crewPick(P, o, a.crew);
        crew.forEach(c => { c.tapped = true; });
        o.crewed = G.turn;
        log(`${P.name} ${you(P) ? 'crew' : 'crews'} ${o.card.name} with ${crew.map(c => c.card.name).join(', ')}: it's an artifact creature until end of turn.`);
        renderGame();
        return true;
    }
    // Targets are chosen before costs are paid (602.2b-c), so you can back out
    let target = presetTarget || null;
    const te = a.effects.find(needsTarget);
    if (te && !target) {
        if (!validTargets(P, te, o).length) { if (!P.isAI) toast('There\'s nothing to target.'); return false; }
        const saved = G.mode;
        target = await chooseTarget(P, te, o, !P.isAI);
        G.mode = saved && saved.type === 'respond' ? null : saved;
        if (!target) { renderGame(); return false; }
    }
    if (a.loyalty !== undefined) { o.ctr.loyalty = (o.ctr.loyalty || 0) + a.loyalty; o.loyaltyTurn = G.turn; }
    else {
        if (manual(P) && !(await humanPay(P, actCost(o, a), xExtra, { forType: o.card.type, exclude: a.cost && a.cost.tap ? o : null }, o.card.name))) { renderGame(); return false; }
        const plan = actPlan(P, o, a, xExtra);
        if (!plan) return false;
        plan.forEach(s => tapSource(P, s));
        if (a.cost.tap) { o.tapped = true; fire('tapped', { o }); }
        if (a.cost.life) { P.life -= a.cost.life; }
        if (a.cost.discard) { const d = P.hand.slice().sort((x, y) => (x.card.cmc || 0) - (y.card.cmc || 0))[0]; pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`); }
        if (a.once) { o.actTurn = o.actTurn || {}; o.actTurn[a.text] = G.turn; }
        if (a.onceEver || a.powerUp) { o.usedOnce = o.usedOnce || {}; o.usedOnce[a.text] = true; }
        if (a.whelp) { o.whelpN = o.whelpTurn === G.turn ? (o.whelpN || 0) + 1 : 1; o.whelpTurn = G.turn; if (o.whelpN >= a.whelp) o.sacAtEnd = G.turn; }
        if (a.cost.discardHand) { const n = P.hand.length; P.hand.forEach(c => { c.discardTurn = G.turn; }); P.gy.push(...P.hand.splice(0)); noteDiscard(P, n); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${n === 1 ? 'a card' : `${n} cards`} (the whole hand).`); }
        if (a.cost.discardSelf) { pull(P.hand, o); P.gy.push(o); o.discardTurn = G.turn; noteDiscard(P, 1); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${o.card.name}.`); }
        if (a.cost.exileSelfHand) { pull(P.hand, o); P.exile.push(o); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${o.card.name} from ${you(P) ? 'your' : 'their'} hand.`); }
        if (a.cost.energy) { P.energy -= a.cost.energy; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${a.cost.energy} energy.`); }
        if (a.cost.removeCounter) { o.counters -= a.cost.removeCounter; log(`${o.card.name}: a +1/+1 counter is removed.`); }
        if (a.cost.minusSelf) { o.counters -= a.cost.minusSelf; log(`${o.card.name} gets a -1/-1 counter.`); }
        if (a.cost.exileTop) { const ex = P.library.splice(-a.cost.exileTop).reverse(); P.exile.push(...ex); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top ${ex.length} cards of the library.`); }
        if (a.cost.removeNamed) { o.ctr[a.cost.removeNamed]--; log(`A ${a.cost.removeNamed} counter is removed from ${o.card.name}.`); }
        if (a.cost.removeAny) await removeAnyCounter(P, o);
        if (a.cost.exileGy) { const ex = P.gy.slice().sort((x, y) => (x.card.cmc || 0) - (y.card.cmc || 0)).slice(0, a.cost.exileGy); ex.forEach(x => { pull(P.gy, x); P.exile.push(x); }); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${ex.map(x => x.card.name).join(', ')} from ${you(P) ? 'your' : 'their'} graveyard.`); }
        if (a.cost.exileSelfGy) { pull(P.gy, o); P.exile.push(o); log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${o.card.name} from the graveyard.`); }
        if (a.cost.returnArt) { const ar = P.bf.filter(x => /\bArtifact\b/.test(x.card.type) && x !== o).sort((x, y) => (Rx(y).etb.length - Rx(x).etb.length) || (permValue(x) - permValue(y)))[0]; leaveBattlefield(ar, 'hand'); if (ar.token) pull(P.hand, ar); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${ar.card.name} to hand.`); }
        if (a.cost.returnLands) { const ls = P.bf.filter(x => /\bLand\b/.test(x.card.type)).sort((x, y) => (y.tapped - x.tapped) || (permValue(x) - permValue(y))).slice(0, a.cost.returnLands); ls.forEach(l => leaveBattlefield(l, 'hand')); log(`${P.name} ${you(P) ? 'return' : 'returns'} ${ls.map(l => l.card.name).join(' and ')} to hand.`); }
        if (a.cost.tapOther) { const f = tapFodder(P, o, a.cost.tapOther); f.tapped = true; fire('tapped', { o: f }); log(`${P.name} ${you(P) ? 'tap' : 'taps'} ${f.card.name} for ${o.card.name}.`); }
        for (const kind of [a.cost.sacCreature && 'creature', a.cost.sacPerm].filter(Boolean)) { const f = await chooseSac(P, o, kind, o.card.name); if (isCreature(f)) G.lastSacPow = Math.max(0, pow(f)); G.lastSacMv = f.card.cmc || 0; log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${f.card.name}.`); fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); }
        if (a.cost.sacN) { const fs = await chooseSacN(P, P.bf.filter(x => new RegExp(`\\b${a.cost.sacN.kind}\\b`).test(x.card.type)), a.cost.sacN.n, o.card.name); log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${fs.map(f => f.card.name).join(', ')}.`); fs.forEach(f => { fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); }); }
    }
    // Mana abilities don't use the stack (605.3)
    if (a.effects.every(e => e.t === 'addMana')) { for (const e of a.effects) await applyEffect(P, e, null, o); if (a.cost && a.cost.sacSelf) { fire('sacrificed', { o }); dieOrLeave(o, 'gy'); } renderGame(); return true; }
    G.stack.push({ id: stackSeq++, kind: 'trigger', ability: true, o, P, target, effects: a.effects, name: `${o.card.name}'s ability` });
    if (target && target.o) fire('targeted', { o: target.o, by: P.i });
    log(`${P.name} ${you(P) ? 'activate' : 'activates'} ${o.card.name}: ${a.text.replace(/~/g, o.card.name.split(',')[0])}${target ? ` (targeting ${targetName(target)})` : ''}`);
    if (a.cost && a.cost.sacSelf) { log(`${o.card.name} is sacrificed.`); fire('sacrificed', { o }); dieOrLeave(o, 'gy'); }
    if (a.cost && a.cost.exileSelf && onBf(o.uid)) { log(`${o.card.name} is exiled.`); leaveBattlefield(o, 'exile'); }
    renderGame();
    await settle();
    return true;
}
// Cycling: pay, discard this card from your hand, draw a card (702.29)
function canCycle(P, o) { const c = Rx(o).cycling; return !!c && P.hand.includes(o) && !G.over && actTimingOk(P, {}) && !!planPayment(P, c); }
async function cycle(P, o) {
    if (!canCycle(P, o)) return false;
    planPayment(P, Rx(o).cycling).forEach(s => tapSource(P, s));
    pull(P.hand, o);
    P.gy.push(o);
    log(`${P.name} ${you(P) ? 'cycle' : 'cycles'} ${o.card.name}.`);
    drawCards(P, 1);
    renderGame();
    return true;
}
async function humanActivate(uid, i) {
    const o = findObj(uid);
    closeSheet();
    if (!o) return;
    const a = actsOf(o)[i];
    const responding = G.mode && G.mode.type === 'respond' ? G.mode : null;
    if (!a || !canActivate(me(), o, a)) { toast('You can\'t activate that right now.'); return; }
    if (responding) { G.mode = null; G.priority = null; const ok = await activate(me(), o, a); responding.resolve(ok); return; }
    const wasBusy = G.busy;
    G.busy = true;
    await activate(me(), o, a);
    G.busy = wasBusy && G.players[G.active].isAI;
    if (!G.players[G.active].isAI) G.busy = false;
    renderGame();
}
// Landcycling (702.29e): pay, discard it, search for a land of that type and put it in your hand
function canLandcycle(P, o) { const c = Rx(o).landcycle; return !!c && P.hand.includes(o) && !G.over && actTimingOk(P, {}) && !!planPayment(P, c.cost); }
async function landcycle(P, o) {
    if (!canLandcycle(P, o)) return false;
    const c = Rx(o).landcycle;
    planPayment(P, c.cost).forEach(s => tapSource(P, s));
    pull(P.hand, o); P.gy.push(o); o.discardTurn = G.turn; noteDiscard(P, 1);
    log(`${P.name} ${you(P) ? 'cycle' : 'cycles'} ${o.card.name} (landcycling).`);
    await applyChoiceEffect(P, { t: 'fetchLand', n: 1, what: c.what === 'basic land' ? 'basic land' : c.what }, o);
    renderGame();
    return true;
}
async function humanLandcycle(uid) { const o = findObj(uid); closeSheet(); if (o && canLandcycle(me(), o) && await humanPay(me(), Rx(o).landcycle.cost, 0, {}, `${o.card.name} (landcycling)`)) { G.busy = true; await landcycle(me(), o); G.busy = false; renderGame(); } }
async function humanCycle(uid) {
    const o = findObj(uid);
    closeSheet();
    if (o && canCycle(me(), o) && await humanPay(me(), Rx(o).cycling, 0, {}, `${o.card.name} (cycling)`)) await cycle(me(), o);
}
// Buttons for the card popup
function abilityButtonsHTML(P, o) {
    let out = '';
    if (P.bf.includes(o) || P.hand.includes(o) || P.gy.includes(o)) actsOf(o).forEach((a, i) => {
        const ok = canActivate(P, o, a);
        out += `<button class="btn${ok ? ' primary' : ''}" ${ok ? '' : 'disabled'} onclick="humanActivate(${o.uid}, ${i})" title="${esc(a.text)}">⚡ ${esc(a.text.replace(/~/g, 'this').slice(0, 60))}${a.text.length > 60 ? '…' : ''}</button>`;
    });
    if (P.hand.includes(o) && Rx(o).cycling) out += `<button class="btn" ${canCycle(P, o) ? '' : 'disabled'} onclick="humanCycle(${o.uid})">♻️ Cycle</button>`;
    if (P.hand.includes(o) && Rx(o).landcycle) out += `<button class="btn" ${canLandcycle(P, o) ? '' : 'disabled'} onclick="humanLandcycle(${o.uid})">♻️ ${esc(Rx(o).landcycle.what === 'basic land' ? 'Basic landcycling' : `${Rx(o).landcycle.what[0].toUpperCase()}${Rx(o).landcycle.what.slice(1)}cycling`)}</button>`;
    if (P.hand.includes(o) && Rx(o).webSling) out += `<button class="btn" onclick="humanWebSling(${o.uid})" title="Cast it for ${esc(Rx(o).webSling.text)} and return a tapped creature you control to your hand">🕸️ Web-sling ${esc(Rx(o).webSling.text)}</button>`;
    return out;
}

// ---- The AI's abilities ----
function permValue(o) { return isCreature(o) ? creatureValue(o) : (o.card.cmc || 0) * 1.5 + (Rx(o).mana ? 1 : 3); }
async function aiUseAbilities(P) {
    const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
    if (lands < 5 && !P.hand.some(x => Rx(x).kind === 'land')) { const lc = P.hand.find(x => canLandcycle(P, x)); if (lc) await landcycle(P, lc); }
    for (let guard = 0; guard < 8 && !G.over; guard++) {
        let best = null;
        for (const o of [...P.bf, ...P.gy.filter(x => (Rx(x).gyActs || []).length), ...P.hand.filter(x => (Rx(x).handActs || []).length)]) {
            actsOf(o).forEach(a0 => {
                if (a0.crew !== undefined || !canActivate(P, o, a0)) return;
                const ax = a0.loyaltyX ? Math.max(0, (o.ctr.loyalty || 0) - 1) : a0.cost && a0.cost.mana && a0.cost.mana.x ? maxActX(P, o, a0) : undefined;
                if (ax === 0) return;
                const a = ax !== undefined ? { ...a0, effects: withX(a0.effects, ax), _x: ax, _orig: a0 } : a0;
                const te = a.effects.find(needsTarget);
                const target = te ? aiPickTarget(P, te, o) : null;
                if (te && !target) return;
                let sc = scoreEffects(P, a.effects, target, o);
                if (a.cost && (a.cost.sacSelf || a.cost.exileSelf)) sc -= isCreature(o) ? creatureValue(o) : 2;
                if (a.cost && (a.cost.sacCreature || a.cost.sacPerm)) { const f = sacFodder(P, o, a.cost.sacCreature ? 'creature' : a.cost.sacPerm); sc -= f ? (f.token ? 1 : permValue(f)) : 99; }
                if (a.cost && a.cost.tap && isCreature(o) && G.phase === 'main1' && canAttackWith(o)) sc -= 3; // attack first
                if (a.loyalty !== undefined && a.loyalty > 0) sc += 2; // keep the planeswalker growing
                if (sc > 2 && (!best || sc > best.sc)) best = { o, a, target, sc };
            });
        }
        if (!best) return;
        await pause(400);
        if (!await activate(P, best.o, best.a._orig || best.a, best.target, best.a._x)) return;
    }
}
// Crew a vehicle before attacking when the crew can't attack anyway or the vehicle hits harder
// Saddle before combat with creatures that can't attack this turn anyway (summoning sick)
function aiSaddle(P) {
    for (const v of P.bf) {
        const n = Rx(v).saddle;
        if (!n || v.saddledTurn === G.turn || !canAttackWith(v)) continue;
        const pool = P.bf.filter(c => c !== v && isCreature(c) && !c.tapped && !canAttackWith(c)).sort((a, b) => pow(b) - pow(a));
        let sum = 0; const crew = [];
        for (const c of pool) { if (sum >= n) break; crew.push(c); sum += Math.max(0, pow(c)); }
        if (sum < n) continue;
        crew.forEach(c => { c.tapped = true; });
        v.saddledTurn = G.turn; v.saddlers = crew.map(c => c.uid);
        log(`${P.name} saddles ${v.card.name} with ${crew.map(c => c.card.name).join(', ')}.`);
    }
}
function aiCrew(P) {
    for (const v of P.bf) {
        const n = Rx(v).crew;
        if (n === null || n === undefined || v.crewed === G.turn || v.tapped || v.sick) continue;
        const crew = crewPick(P, v, n);
        if (!crew) continue;
        const lost = crew.filter(canAttackWith).reduce((a, c) => a + pow(c), 0);
        if ((Number(v.card.power) || 0) > lost) { crew.forEach(c => { c.tapped = true; }); v.crewed = G.turn; log(`${P.name} crews ${v.card.name}.`); }
    }
}

// ---- Choices from a list (tutors, regrowth): you pick, the AI takes its best ----
function pickCard(P, list, title, opts = {}) {
    if (!list.length) return Promise.resolve(null);
    const best = () => list.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
    if (P.isAI) return Promise.resolve(best());
    if (G && G.hotseat && G.view !== P.i) return handTo(P).then(() => pickCard(P, list, title, opts));
    if (actBusy()) return actDrain().then(() => pickCard(P, list, title, opts));
    return new Promise(resolve => {
        window.__pick = i => { closeModal(); resolve(list[i] || null); };
        showModal(`<h2>${esc(title)}</h2><div class="pick-grid">${list.slice(0, 60).map((o, i) => `<button type="button" class="pick-card" onclick="__pick(${i})" title="${esc(o.card.name)}">${o.card.imgS ? `<img src="${o.card.imgS}" alt="${esc(o.card.name)}">` : `<span class="noimg">${esc(o.card.name)}</span>`}</button>`).join('')}</div>
            ${list.length > 60 ? '<p class="note">Showing the first 60.</p>' : ''}${opts.required ? '<p class="note" style="text-align:center;">This is required - pick one.</p>' : '<div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="__pick(-1)">None</button></div>'}`);
    });
}
// Mode choice for "Choose one —"
function pickMode(P, modes, src) {
    if (!P.isAI && G && G.hotseat && G.view !== P.i) return handTo(P).then(() => pickMode(P, modes, src));
    if (P.isAI) {
        let bi = 0, bs = -1;
        modes.forEach((fx, i) => { const te = fx.find(needsTarget); const t = te ? aiPickTarget(P, te, src) : null; if (te && !t) return; const sc = scoreEffects(P, fx, t, src); if (sc > bs) { bs = sc; bi = i; } });
        return Promise.resolve(bi);
    }
    const lines = (src.card.text || '').split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^•\s*/, ''));
    return new Promise(resolve => {
        window.__mode = i => { closeModal(); resolve(i); };
        showModal(`<h2>${esc(src.card.name)}: choose one</h2><div class="row" style="flex-direction:column; align-items:stretch; gap:8px;">${modes.map((_, i) => `<button class="btn" onclick="__mode(${i})">${esc(lines[i] || `Mode ${i + 1}`)}</button>`).join('')}</div>
            <div class="row" style="justify-content:center; margin-top:10px;"><button class="btn" onclick="__mode(-1)">Cancel</button></div>`);
    });
}
function spellEffects(o) { const r = Rx(o); if (o.overloaded && r.overload) return r.overload.spell; if (o.kicked && r.entwine && r.modes) return r.modes.flat(); if (o.kicked && (r.spell || []).some(e => e.kickedFilter)) return r.spell.map(e => (e.kickedFilter ? { ...e, target: 'perm', filter: e.kickedFilter } : e)); const fx = r.spell || (r.modes ? (Array.isArray(o.mode) ? o.mode.flatMap(i => r.modes[i]) : r.modes[o.mode || 0]) : []) || []; return r.cost.x && o.xVal !== undefined ? withX(fx, o.xVal) : fx; }
function aiPickModes(P, R, modes, src) {
    const { min, max } = modeRange(P, R, src);
    const sc = modes.map((fx, i) => { const te = fx.find(needsTarget); const t = te ? aiPickTarget(P, te, src) : null; return { i, s: te && !t ? -99 : scoreEffects(P, fx, t, src) }; }).sort((a, b) => b.s - a.s);
    return sc.filter((x, k) => k < min || (x.s > 0 && k < max)).map(x => x.i).sort((a, b) => a - b);
}
// How many modes this cast may choose ("Choose two —", "one or both", Akroma's Will with a commander)
function modeRange(P, R, src) {
    const n = R.modeN || { min: 1, max: 1 };
    if (R.modeTeamwork) return { min: 1, max: src && src.teamworked ? 2 : 1 };
    return { min: n.min, max: R.modeCmdBoth ? (P.bf.some(x => x.isCommander) ? 2 : 1) : n.max };
}
// Teamwork N (an optional additional cost): tap untapped creatures with total power N or more
function teamworkCrew(P, o) {
    const n = Rx(o).teamwork;
    if (!n) return null;
    const pool = P.bf.filter(x => isCreature(x) && !x.tapped).sort((a, b) => pow(a) - pow(b));
    const out = []; let sum = 0;
    for (const x of pool) { if (sum >= n) break; out.push(x); sum += Math.max(0, pow(x)); }
    return sum >= n ? out : null;
}
// Choose the modes: one index (a single mode) or a list; null = cancelled
function pickModes(P, R, modes, src) {
    const { min, max } = modeRange(P, R, src);
    if (max <= 1) return pickMode(P, modes, src).then(i => (i < 0 ? null : i));
    if (P.isAI) return Promise.resolve(aiPickModes(P, R, modes, src));
    if (G && G.hotseat && G.view !== P.i) return handTo(P).then(() => pickModes(P, R, modes, src));
    const lines = (src.card.text || '').split('\n').filter(l => l.trim().startsWith('•')).map(l => l.replace(/^•\s*/, ''));
    const on = new Set();
    return new Promise(resolve => {
        window.__modeT = i => { if (on.has(i)) on.delete(i); else if (on.size < max) on.add(i); draw(); };
        window.__modeOk = ok => { closeModal(); resolve(ok ? [...on].sort((a, b) => a - b) : null); };
        const draw = () => showModal(`<h2>${esc(src.card.name)}: choose ${min === max ? min : `${min} to ${max}`}</h2><div class="row" style="flex-direction:column; align-items:stretch; gap:8px;">${modes.map((_, i) => `<button class="btn${on.has(i) ? ' primary' : ''}" aria-pressed="${on.has(i)}" onclick="__modeT(${i})">${on.has(i) ? '✔ ' : ''}${esc(lines[i] || `Mode ${i + 1}`)}</button>`).join('')}</div>
            <div class="row" style="justify-content:center; margin-top:10px; gap:8px;"><button class="btn" onclick="__modeOk(false)">Cancel</button><button class="btn primary" onclick="__modeOk(true)" ${on.size >= min && on.size <= max ? '' : 'disabled'}>Done (${on.size})</button></div>`);
        draw();
    });
}
// X: 'X' / 'X2' (twice X) / 'Xh' (half X, rounded down) / 'Xu' (half X, rounded up) and '{X}' inside filter text
const X_PH = 97;
const X_FORMS = { X: x => x, X2: x => 2 * x, Xh: x => Math.floor(x / 2), Xu: x => Math.ceil(x / 2) };
function xSub(l) {
    if (/^X can't be 0\.$/.test(l)) return '§done';
    if (/where X is|enters? (?:the battlefield )?with X |as a copy|^\{X\}|^[^:"]*\{X\}[^:"]*:/.test(l)) return l;
    return l.replace(/\b(?:twice|two times) X\b/g, '194').replace(/\bhalf X((?: [\w]+)*?), rounded down\b/g, '9701$1').replace(/\bhalf X((?: [\w]+)*?), rounded up\b/g, '9702$1')
        .replace(/^(.*)\. Round down each time\.$/, (a, b) => `${b.replace(/\bhalf X\b/g, '9701')}.`).replace(/\bIf X is (\d+) or more, also /g, 'If X is $1 or more, ')
        .replace(/pays \{X\}/g, 'pays {97}').replace(/(?<![\w{])X(?![\w}])/g, '97');
}
function xVal(v) { if (v === 97) return 'X'; if (v === 194) return 'X2'; if (v === 9701) return 'Xh'; if (v === 9702) return 'Xu'; if (v === -97) return '-X'; return v; }
function xMarkDeep(v) {
    if (typeof v === 'number') return xVal(v);
    if (typeof v === 'string') return v.replace(/(?<!\d)97(?!\d)/g, '{X}').replace(/(?<!\d)194(?!\d)/g, '{X2}');
    if (Array.isArray(v)) return v.map(xMarkDeep);
    if (v && typeof v === 'object' && !(v instanceof Set) && !(v instanceof RegExp)) { const o = {}; for (const k of Object.keys(v)) o[k] = k === 'cond' || k === 'condNot' ? v[k] : xMarkDeep(v[k]); return o; }
    return v;
}
function xMarkRules(R) {
    for (const k of ['spell', 'modes', 'etb', 'etbModes', 'castTrig']) if (R[k]) R[k] = xMarkDeep(R[k]);
    R.trig = R.trig.map(t => ({ ...t, effects: xMarkDeep(t.effects), cond: t.cond }));
    if (R.etbCounters === 97) R.etbCounters = 'X';
}
function hasXMark(v) {
    if (typeof v === 'string') return v in X_FORMS || v === '-X' || /\{X2?\}/.test(v);
    if (Array.isArray(v)) return v.some(hasXMark);
    if (v && typeof v === 'object' && !(v instanceof Set)) return Object.values(v).some(hasXMark);
    return false;
}
function xFill(v, x) {
    if (typeof v === 'string') { if (v in X_FORMS) return X_FORMS[v](x); if (v === '-X') return -x; return v.replace(/\{X\}/g, String(x)).replace(/\{X2\}/g, String(2 * x)); }
    if (Array.isArray(v)) return v.map(e => xFill(e, x));
    if (v && typeof v === 'object' && !(v instanceof Set)) { const o = {}; for (const k of Object.keys(v)) o[k] = xFill(v[k], x); return o; }
    return v;
}
function withX(effects, x) { return hasXMark(effects) ? xFill(effects, x || 0) : effects; }

// ---- Permanents that match a target filter ----
function permMatches(o, f, P) {
    const k = Rx(o).kind, t = o.card.type, theirs = o.owner !== P.i;
    let m;
    if (/ you don't control$/.test(f) && f !== "nonland permanent you don't control") return theirs && permMatches(o, f.replace(/ you don't control$/, ''), P);
    if ((m = f.match(/^(non)?(white|blue|black|red|green|artifact) creature$/))) {
        if (!isCreature(o)) return false;
        const col = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' }[m[2]];
        const is = col ? (o.card.colors || []).includes(col) : /Artifact/.test(t);
        return m[1] ? !is : is;
    }
    if ((m = f.match(/^(white|blue|black|red|green) permanent$/))) return (o.card.colors || []).includes(COLOR_WORDS[m[1]]);
    // Magic 2010: "black or red permanent", "green or white creature"
    if ((m = f.match(/^(white|blue|black|red|green) or (white|blue|black|red|green) (permanent|creature)( an opponent controls| that player controls)?$/))) return (m[3] === 'permanent' || isCreature(o)) && (!m[4] || theirs) && [m[1], m[2]].some(c => (o.card.colors || []).includes(COLOR_WORDS[c]));
    if ((m = f.match(/power (\w+) or (greater|less)/))) { const n = num(m[1]); if (!isCreature(o)) return false; return m[2] === 'greater' ? pow(o) >= n : pow(o) <= n; }
    if ((m = f.match(/^permanent with mana value (\w+) or greater$/))) return (o.card.cmc || 0) >= num(m[1]);
    if ((m = f.match(/^nonland permanent with mana value (\w+) or less$/))) return !/\bLand\b/.test(t) && (o.card.cmc || 0) <= num(m[1]);
    if ((m = f.match(/mana value (\w+) or less/))) return isCreature(o) && (o.card.cmc || 0) <= num(m[1]);
    if ((m = f.match(/^creature with mana value (\d+)$/))) return isCreature(o) && (o.card.cmc || 0) === +m[1];
    if ((m = f.match(/^non-([A-Z][a-z]+) creature$/))) return isCreature(o) && !hasType(o, m[1]); // Glorybringer
    if (LAND_COLOR[f]) return hasType(o, f);
    if (/^types:/.test(f)) return f.slice(6).split('|').some(ty => hasType(o, ty)); // Undead Slayer
    switch (f) {
        case 'legendary permanent': return /Legendary/.test(t);
        // Mirrodin (2026-10-08)
        case 'nonartifact, nonblack creature': return isCreature(o) && !/Artifact/.test(t) && !(o.card.colors || []).includes('B');
        case 'artifact, enchantment, or land': return /Artifact|Enchantment|\bLand\b/.test(t);
        case 'artifact, creature, or land': return isCreature(o) || /Artifact|\bLand\b/.test(t);
        case 'equipment': case 'Equipment': return /\bEquipment\b/.test(t);
        case 'noncreature artifact': return /Artifact/.test(t) && !isCreature(o);
        case 'green creature': return isCreature(o) && (o.card.colors || []).includes('G');
        case 'permanent you own': return (o.realOwner ?? o.owner) === P.i;
        case 'permanent you control': return !theirs;
        case 'land you control': return !theirs && /\bLand\b/.test(t);
        case 'artifact creature': return isCreature(o) && /Artifact/.test(t);
        case 'legendary creature': return isCreature(o) && /Legendary/.test(t);
        case 'nonlegendary creature': return isCreature(o) && !/Legendary/.test(t);
        case 'nontoken creature': return isCreature(o) && !o.token;
        case 'noncreature artifact or noncreature enchantment': return !isCreature(o) && /Artifact|Enchantment/.test(t);
        case 'creature': case 'creature you control': return isCreature(o) && (f === 'creature' || !theirs);
        case 'artifact': return /Artifact/.test(t);
        case 'enchantment': return /Enchantment/.test(t);
        case 'artifact or enchantment': return /Artifact|Enchantment/.test(t);
        case 'land': return k === 'land' || /\bLand\b/.test(t);
        case 'nonbasic land': return (k === 'land') && !isBasic(o.card);
        case 'permanent': return true;
        case 'nonland permanent': return !/\bLand\b/.test(t);
        case 'noncreature permanent': return !isCreature(o);
        case 'nonland permanent an opponent controls': case "nonland permanent you don't control": return !/\bLand\b/.test(t) && theirs;
        case 'permanent an opponent controls': return theirs;
        case 'creature with flying': return isCreature(o) && has(o, 'flying');
        case 'creature without flying': return isCreature(o) && !has(o, 'flying');
        case 'tapped creature': return isCreature(o) && o.tapped;
        case 'attacking creature': return G.attackers.includes(o.uid);
        case 'blocking creature': return Object.values(G.blocks).some(bs => bs.includes(o.uid));
        case 'attacking or blocking creature': return G.attackers.includes(o.uid) || Object.values(G.blocks).some(bs => bs.includes(o.uid));
        case 'artifact or creature': return isCreature(o) || /Artifact/.test(t);
        case 'artifact, creature, or enchantment': return isCreature(o) || /Artifact|Enchantment/.test(t);
        case 'creature or vehicle': return isCreature(o) || /Vehicle/.test(t);
        case 'creature or planeswalker': return isCreature(o) || k === 'planeswalker';
        case 'artifact or land': return /Artifact|\bLand\b/.test(t);
        case 'artifact, enchantment, or creature with flying': return /Artifact|Enchantment/.test(t) || (isCreature(o) && has(o, 'flying'));
        case 'creature or enchantment': return isCreature(o) || /Enchantment/.test(t);
        case 'colorless nonland permanent': return !/\bLand\b/.test(t) && !(o.card.colors || []).length;
        case 'attacking creature without flying': return G.attackers.includes(o.uid) && !has(o, 'flying');
        case 'attacking nontoken creature': return G.attackers.includes(o.uid) && !o.token;
        case 'attacking alone': return G.attackers.length === 1 && G.attackers[0] === o.uid;
        // Starter kits (2026-10-06)
        case 'nonbasic land an opponent controls': return theirs && /\bLand\b/.test(t) && !isBasic(o.card);
        case 'artifact, creature, or planeswalker': return isCreature(o) || /Artifact|Planeswalker/.test(t);
        case 'artifact, enchantment, or nonbasic land an opponent controls': return theirs && (/Artifact|Enchantment/.test(t) || (/\bLand\b/.test(t) && !isBasic(o.card)));
        case 'creature or planeswalker an opponent controls': return theirs && (isCreature(o) || k === 'planeswalker');
        case 'permanent you control': return !theirs;
        case 'nonland permanent you control': return !theirs && !/\bLand\b/.test(t);
        case 'artifact, creature, or land you control': return !theirs && (isCreature(o) || /Artifact|\bLand\b/.test(t));
        case 'legendCombat': return isCreature(o) && (G.combatPairs || []).some(x => x.turn === G.turn && ((x.a === o.uid && /Legendary/.test((onBf(x.b) || { card: { type: '' } }).card.type)) || (x.b === o.uid && /Legendary/.test((onBf(x.a) || { card: { type: '' } }).card.type))));
        case 'nonlegendary creature power<=army': return isCreature(o) && !/Legendary/.test(t) && theirs && pow(o) <= (G.lastArmyPow || 0);
        case 'land you control': return /\bLand\b/.test(t) && !theirs;
        case 'Equipment you control mv2-3': return /Equipment/.test(t) && !theirs && (o.card.cmc || 0) >= 2 && (o.card.cmc || 0) <= 3;
        case 'attacking equipped creature': return G.attackers.includes(o.uid) && isEquipped(o);
        case 'equipped creature': return isCreature(o) && isEquipped(o);
        case 'nonenchantment creature': return isCreature(o) && !/Enchantment/.test(t);
        case 'artifact, creature, or land': return isCreature(o) || /Artifact|\bLand\b/.test(t);
        case 'creature with power or toughness 4 or greater': return isCreature(o) && (pow(o) >= 4 || tou(o) >= 4);
        case 'creature without flying you control': return isCreature(o) && !theirs && !has(o, 'flying');
    }
    if ((m = f.match(/^creature with toughness (\w+) or greater$/))) return isCreature(o) && tou(o) >= num(m[1]);
    if (/^[A-Z][a-z]+$/.test(f)) return isCreature(o) && hasType(o, f); // "target Spider"
    // "artifact, creature, enchantment, or planeswalker (an opponent controls)": any one of the kinds (top-1000 round 2)
    if ((m = f.match(/^((?:[a-z]+, )+)or ([a-z ]+?)( an opponent controls| you control)?$/))) {
        const who = m[3] ? (m[3].includes('opponent') ? theirs : !theirs) : true;
        return who && [...m[1].split(', ').filter(Boolean), m[2]].some(k => permMatches(o, k, P));
    }
    return false;
}
// Ward N (702.21): a spell or ability an opponent aims at it is countered unless they pay N
function wardCheck(P, target, name) {
    if (!target || !target.o || target.o.owner === P.i) return true;
    const wk = buffsOn(target.o).kw.find(k => /^ward:/.test(k));
    const w = Rx(target.o).ward || (wk ? +wk.slice(5) : 0);
    const wl = Rx(target.o).wardLife || Math.max(0, ...G.players[target.o.owner].bf.filter(x => x !== target.o && isCreature(target.o) && !lostAbilities(x)).map(x => Rx(x).wardLifeOthers || 0));
    if (wl && !w) {
        if (P.life > wl) { P.life -= wl; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${wl} life for ward on ${target.o.card.name}.`); return true; }
        log(`${name} is countered by ward - ${P.name} can't pay ${wl} life (rule 702.21a).`);
        return false;
    }
    if (!w) return true;
    const plan = planPayment(P, { generic: w, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
    if (plan) { plan.forEach(s => tapSource(P, s)); log(`${P.name} ${you(P) ? 'pay' : 'pays'} ward {${w}} for ${target.o.card.name}.`); return true; }
    log(`${name} is countered by ward - ${P.name} can't pay {${w}} (rule 702.21a).`);
    return false;
}
// Leaving the battlefield with "dies" triggers (a creature going to the graveyard, 700.4)
function dieOrLeave(o, zone) {
    if (zone === 'gy' && o.exileOnDeath === G.turn) { log(`${o.card.name} is exiled instead.`); zone = 'exile'; }
    const dying = zone === 'gy' && onBf(o.uid) && isCreature(o);
    if (dying) { fire('dies', { o }); fire('creatureDies', { o }); }
    if (dying && !o.token) { const X = G.players[o.owner], k = X.thrinaxTurn === G.turn ? X.thrinaxN || 0 : 0, p = Math.max(0, pow(o)); if (k && p) (G.trigQ = G.trigQ || []).push({ P: X, o, effects: [{ t: 'token', n: p * k, p: 1, q: 1, name: 'green saproling', kw: [] }] }); }
    if (dying && o.blitzed) (G.trigQ = G.trigQ || []).push({ P: G.players[o.owner], o, effects: [{ t: 'draw', n: 1 }] }); // blitz (702.152)
    if (dying && !o.token && o.dmgBy) allPerms().filter(a => Rx(a).scythe && a.attachedTo && o.dmgBy[a.attachedTo] === G.turn && !lostAbilities(a)).forEach(a => (G.trigQ = G.trigQ || []).push({ P: G.players[a.owner], o: a, effects: [{ t: 'scytheReturn', uid: o.uid }] }));
    else if (zone === 'gy' && onBf(o.uid) && /Artifact/.test(o.card.type)) fire('artifactDies', { o });
    const back = dying && !o.token && ((has(o, 'persist') && o.counters >= 0) ? -1 : (has(o, 'undying') && o.counters <= 0) ? 1 : o.tkw.includes('returnondeath') ? 1e-9 : 0);
    leaveBattlefield(o, zone);
    // Persist / undying (702.79, 702.93): it comes back with a -1/-1 or +1/+1 counter
    if (back && G.players[o.owner].gy.includes(o)) {
        const P = G.players[o.owner];
        pull(P.gy, o);
        resetObj(o);
        o.counters = Math.round(back);
        P.bf.push(o);
        log(back === 1e-9 ? `${o.card.name} returns to the battlefield.` : `${o.card.name} returns with a ${back > 0 ? '+1/+1' : '-1/-1'} counter (${back > 0 ? 'undying' : 'persist'}).`);
        fire('enters', { o });
        if (Rx(o).etb.length) (G.trigQ = G.trigQ || []).push({ P, o, effects: Rx(o).etb });
    }
}
function tapSource(P, s) {
    if (s.pool) { const i = (P.pool || []).indexOf(s.color); if (i >= 0) P.pool.splice(i, 1); return; }
    s.tapped = true;
    fire('tapped', { o: s });
    if (/\bArtifact\b/.test(s.card.type) && manaOf(s)) fire('artifactMana', { o: s, P });
    if (/\bLand\b/.test(s.card.type)) allPerms().filter(b => Rx(b).manabarbs && !lostAbilities(b)).forEach(b => { damage(P, 1, b); log(`${b.card.name} deals 1 damage to ${P.name === 'You' ? 'you' : P.name}.`); }); // Manabarbs
    const m = manaOf(s);
    if (m && m.life) { P.life -= m.life; log(`${P.name} ${you(P) ? 'pay' : 'pays'} ${m.life} life for ${s.card.name}.`); }
    if (m && m.pain && s._payColor && m.pain.colors.includes(s._payColor)) { P.life -= m.pain.life; log(`${s.card.name} deals ${m.pain.life} damage to ${P.name === 'You' ? 'you' : P.name}.`); }
    s._payColor = null;
    if (m && m.sac && onBf(s.uid)) { log(`${s.card.name} is sacrificed for mana.`); fire('sacrificed', { o: s }); fire('artifactDies', { o: s }); leaveBattlefield(s, 'gy'); }
}
// Artifact tokens with their real rules text
const ART_TOKENS = {
    treasure: { name: 'Treasure', text: '{T}, Sacrifice this artifact: Add one mana of any color.' },
    food: { name: 'Food', text: '{2}, {T}, Sacrifice this artifact: You gain 3 life.' },
    clue: { name: 'Clue', text: '{2}, Sacrifice this artifact: Draw a card.' },
    blood: { name: 'Blood', text: '{1}, {T}, Discard a card, Sacrifice this artifact: Draw a card.' },
    gold: { name: 'Gold', text: 'Sacrifice this artifact: Add one mana of any color.' },
    lander: { name: 'Lander', text: '{2}, {T}, Sacrifice this token: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' },
    map: { name: 'Map', text: '{1}, {T}, Sacrifice this artifact: Target creature you control explores. Activate only as a sorcery.' },
    powerstone: { name: 'Powerstone', text: '{T}: Add {C}. This mana can\'t be spent to cast a nonartifact spell.' }
};
function makeArtifactToken(P, kind) {
    const t = ART_TOKENS[kind];
    const card = { id: `token-${kind}-${uidSeq}`, name: t.name, fullName: `${t.name} token`, cost: '', cmc: 0, type: `Token Artifact — ${t.name}`, text: t.text, colors: [], ci: [], img: null, imgS: null, legal: {} };
    const o = makeObj(card, P.i, { token: true, sick: false });
    P.bf.push(o);
    if (G) fire('enters', { o });
    return o;
}

