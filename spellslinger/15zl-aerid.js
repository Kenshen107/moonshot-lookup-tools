// Spellslinger Duels - engine pieces for the Aerid Konstrari deck (2026-11-25, owner pasted a Gruul artifacts / Heartwood list). CMD ids start with ak_.
// Wordings are in rules/sevendecks.js (pack 'aerid' and the clx lines at the end).
Object.assign(ART_TOKENS, {
    heartwood: { name: 'Heartwood', text: '{T}: Add {R} or {G}.', colors: ['R', 'G'] },
    meteorite: { name: 'Meteorite', text: '{T}: Add one mana of any color.' },
    manalith: { name: 'Icy Manalith', text: '{T}: Add one mana of any color.' }
});
// a person chooses; the computer takes the best by score
async function akPick(P, pool, prompt, score, optional) {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort((a, b) => score(b) - score(a))[0];
    return (await pickCard(P, pool, prompt, { required: !optional })) || (optional ? null : pool[0]);
}
const akArts = P => P.bf.filter(o => /\bArtifact\b/.test(o.card.type)).length;
// Stridehangar Automaton: artifact tokens come with a Thopter (queued as a trigger so the replacement stays simple)
function akThopterQueue(P, src) {
    if (!G || G.akMaking) return;
    const n = P.bf.filter(x => Rx(x).akThopter && !lostAbilities(x)).length;
    for (let k = 0; k < n; k++) (G.trigQ = G.trigQ || []).push({ P, o: P.bf.find(x => Rx(x).akThopter), effects: [{ t: 'token', n: 1, p: 1, q: 1, name: 'colorless Thopter', kw: ['flying'], artifact: true, akThop: true }] });
}
{
    const base = makeArtifactToken;
    makeArtifactToken = function (P, kind) { const o = base.apply(this, arguments); akThopterQueue(P, o); return o; };
    const mo = manaOf;
    manaOf = function (o) { // Roxanne: tapping an artifact token adds one more mana of the same type
        const m = mo.apply(this, arguments);
        if (!G || !o || !o.token || !m || !/\bArtifact\b/.test(o.card.type) || !m.colors) return m;
        return G.players[o.owner].bf.some(a => Rx(a).akRoxanne && !lostAbilities(a)) ? { ...m, n: (m.n || 1) + 1 } : m;
    };
    const f0 = fire; // Herd Heirloom: the creature draws when it deals combat damage to a player
    fire = function (ev, ctx) {
        const r = f0.apply(this, arguments);
        if (ev === 'hitPlayer' && ctx && ctx.src && ctx.src.akDrawHit === G.turn && onBf(ctx.src.uid)) { drawCards(G.players[ctx.src.owner], 1); log(`${ctx.src.card.name} deals combat damage to a player: ${G.players[ctx.src.owner].name} draws a card (Herd Heirloom).`); }
        return r;
    };
}
Object.assign(CMD, {
    async ak_copyToken(P, e, t, src) {
        const pool = P.bf.filter(x => x.token && !/\bSaga\b/.test(x.card.type));
        const x = await akPick(P, pool, `${src.card.name}: choose a non-Saga token to copy`, o => isCreature(o) ? 3 + pow(o) : (/Heartwood|Treasure/.test(o.card.name) ? 4 : 2));
        if (!x) { log(`${src.card.name}: no token to copy.`); return; }
        const k = tokenMult(P);
        for (let i = 0; i < k; i++) tokenCopyOf(P, x.card);
        if (/\bArtifact\b/.test(x.card.type)) akThopterQueue(P, x);
    },
    ak_crater(P) {
        const n = akArts(P); P.bf.filter(isCreature).forEach(c => { c.tp += n; c.tkw.push('trample'); });
        log(`Creatures ${you(P) ? 'you control' : `${P.name} controls`} gain trample and get +${n}/+0 until end of turn.`);
    },
    async ak_tethermage(P, e, t, src) {
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type));
        if (!lands.length) return;
        const yes = P.isAI || AUTOPLAY ? lands.length >= 5 : await askYes(P, `${src.card.name}: sacrifice a land to create two tapped Heartwood tokens?`, { card: src.card, yes: 'Sacrifice a land', no: 'No' });
        if (!yes) return;
        const l = await chooseSac(P, src, 'land', src.card.name);
        if (!l) return;
        fire('sacrificed', { o: l }); dieOrLeave(l, 'gy');
        await applyEffect(P, { t: 'artToken', kind: 'heartwood', n: 2, tapped: true }, null, src);
    },
    async ak_depthshaker(P, e, t, src) {
        const pool = P.bf.filter(x => /\bArtifact\b/.test(x.card.type) && !isCreature(x));
        const chosen = [];
        if (P.isAI || AUTOPLAY) pool.filter(x => x.token && /Treasure|Clue|Food|Map|Gold/.test(x.card.name)).slice(0, 4).forEach(x => chosen.push(x));
        else for (let guard = 0; guard < 12; guard++) { const left = pool.filter(x => !chosen.includes(x)); if (!left.length) break; const x = await pickCard(P, left, `${src.card.name}: make a noncreature artifact a 3/3 (sacrificed at the end step). None to stop (${chosen.length} chosen)`, { required: false }); if (!x) break; chosen.push(x); }
        chosen.forEach(x => { x.permAnimated = { p: 3, q: 3 }; x.sacAtEnd = G.turn; });
        if (chosen.length) log(`${chosen.map(x => x.card.name).join(', ')} become 3/3 artifact creatures; sacrificed at the beginning of the next end step.`);
    },
    ak_agatha(P, e, t, src) {
        P.bf.filter(x => x !== src && isCreature(x)).forEach(c => { c.tp += 1; c.tq += 1; c.tkw.push('trample', 'haste'); });
        log(`Other creatures ${you(P) ? 'you control' : `${P.name} controls`} get +1/+1 and gain trample and haste until end of turn.`);
    },
    ak_dino(P, e, t, src) {
        const o = G.ctxObj; if (!o || !onBf(o.uid)) return;
        const ty = o.card.type || '';
        if (!(/\bArtifact\b/.test(ty) || /\bLegendary\b/.test(ty) || /\bSaga\b/.test(ty))) return;
        o.permAnimated = { p: 7, q: 7 }; o.addedTypes = (o.addedTypes || []).concat('Dinosaur');
        log(`${o.card.name} becomes a 7/7 Dinosaur creature in addition to its other types (Displaced Dinosaurs).`);
    },
    ak_heirloom(P, e, t, src) {
        if (!t || !t.o || !onBf(t.o.uid)) return;
        t.o.tkw.push('trample'); t.o.akDrawHit = G.turn;
        log(`${t.o.card.name} gains trample and "whenever this deals combat damage to a player, draw a card" until end of turn.`);
    },
    async ak_puppet(P, e, t, src) {
        if (!onBf(src.uid)) return;
        putCounters(src, 1, P);
        const i = await askMode(P, `${src.card.name}: gains your choice until end of turn`, ['Trample', 'Hexproof', 'Haste']);
        const kw = ['trample', 'hexproof', 'haste'][i] || 'trample';
        src.tkw.push(kw); if (kw === 'haste') src.sick = false;
        log(`${src.card.name} gets a +1/+1 counter and gains ${kw} until end of turn.`);
    },
    ak_untapTokens(P) { const xs = P.bf.filter(x => x.token && x.tapped); xs.forEach(x => { x.tapped = false; }); if (xs.length) log(`${P.name} untaps ${xs.length} token${xs.length === 1 ? '' : 's'}.`); },
    async ak_orthion(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && isCreature(x));
        const x = await akPick(P, pool, `${src.card.name}: choose another creature you control to copy`, o => creatureValue(o));
        if (!x) return;
        const k = e.n * tokenMult(P);
        for (let i = 0; i < k; i++) { const tok = tokenCopyOf(P, x.card); tok.tkw.push('haste'); tok.sick = false; tok.sacAtEnd = G.turn; }
        log(`The copies have haste and are sacrificed at the beginning of the next end step.`);
    },
    async ak_meteorite(P, e, t, src) {
        await applyEffect(P, { t: 'artToken', kind: 'meteorite', n: 1, tapped: true }, null, src);
        // the Meteorite's own enters trigger: 2 damage to any target (chosen as it resolves; the computer takes the best one)
        const foesP = foes(P); const cands = [];
        foesP.forEach(F => { cands.push({ p: F, s: F.life <= 2 ? 100 : 1 }); F.bf.filter(isCreature).forEach(c => cands.push({ o: c, s: tou(c) - c.dmg <= 2 ? 3 + creatureValue(c) : 0 })); });
        let pick;
        if (P.isAI || AUTOPLAY) pick = cands.sort((a, b) => b.s - a.s)[0];
        else {
            const objs = [...foesP.flatMap(F => F.bf.filter(isCreature)), ...P.bf.filter(isCreature)];
            const players = foesP.map(F => ({ name: F.name, F }));
            const mode = await askMode(P, 'Meteorite deals 2 damage to', [...players.map(p => `${p.name} (${p.F.life} life)`), ...(objs.length ? ['A creature...'] : [])]);
            if (mode < players.length) pick = { p: players[mode].F };
            else { const c = await pickCard(P, objs, 'Meteorite: choose a creature (2 damage)', { required: true }); pick = c ? { o: c } : null; }
        }
        if (!pick || pick.s === 0 && P.isAI) return;
        if (pick.p) { damage(pick.p, 2, src); log(`Meteorite deals 2 damage to ${pick.p.name}.`); }
        else if (pick.o && onBf(pick.o.uid)) { damage(pick.o, 2, src); log(`Meteorite deals 2 damage to ${pick.o.card.name}.`); }
    },
    async ak_steelseeker(P, e, t, src) {
        const top = P.library[P.library.length - 1]; if (!top) return;
        let taken = false;
        if (/\bLand\b/.test(top.card.type)) {
            const yes = P.isAI || AUTOPLAY ? true : await askYes(P, `${src.card.name}: ${top.card.name} is a land. Put it into your hand? (No: you may put it into your graveyard)`, { card: top.card, yes: 'Into my hand', no: 'No' });
            if (yes) { pull(P.library, top); P.hand.push(top); taken = true; log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.card.name} and ${you(P) ? 'put' : 'puts'} it into ${you(P) ? 'your' : 'their'} hand.`); }
        }
        if (!taken) {
            const gy = P.isAI || AUTOPLAY ? false : await askYes(P, `${src.card.name}: put ${top.card.name} into your graveyard?`, { card: top.card, yes: 'Graveyard', no: 'Leave it on top' });
            if (gy) { pull(P.library, top); P.gy.push(top); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${top.card.name} into ${you(P) ? 'your' : 'their'} graveyard.`); }
        }
    },
    async ak_svella(P, e, t, src) {
        const seen = P.library.splice(-4).reverse();
        if (!seen.length) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${seen.length} cards of ${you(P) ? 'your' : 'their'} library.`);
        const pool = seen.filter(c => Rx(c).kind !== 'land' && Rx(c).support !== 'none');
        const pick = await akPick(P, pool, `${src.card.name}: cast a spell from among them for free`, c => c.card.cmc || 0, true);
        let cast = false;
        if (pick) { const at = seen.indexOf(pick); seen.splice(at, 1); P.library.push(pick); cast = await castFreeFrom(P, pick, undefined) || await castFreeAuto(P, pick); if (!cast && P.library.includes(pick)) { pull(P.library, pick); seen.push(pick); } else if (!cast) { /* it left the library */ } }
        seen.sort(() => Math.random() - 0.5); P.library.unshift(...seen);
        if (pick && cast) log(`${P.name} ${you(P) ? 'cast' : 'casts'} ${pick.card.name} without paying its mana cost; the rest go to the bottom.`);
    },
    async ak_cleaver(P, e, t, src) {
        const h = onBf(src.attachedTo); const n = (G.ctxRaw && G.ctxRaw.n) || 0;
        if (h && n > 0) { await applyEffect(P, { t: 'artToken', kind: 'treasure', n }, null, src); log(`${h.card.name} deals ${n} combat damage: ${n} Treasure token${n === 1 ? '' : 's'} (The Reaver Cleaver).`); }
    }
});
Object.assign(CMD_SCORE, {
    ak_copyToken: P => P.bf.some(x => x.token && !/\bSaga\b/.test(x.card.type)) ? 5 : 0,
    ak_orthion: P => P.bf.some(x => isCreature(x) && pow(x) >= 3) ? 6 : 0,
    ak_agatha: P => P.bf.filter(isCreature).length >= 3 ? 5 : 0,
    ak_puppet: () => 3, ak_heirloom: () => 2, ak_svella: () => 7, ak_depthshaker: () => 1, ak_crater: P => Math.min(10, akArts(P) * 2), ak_tethermage: () => 2,
    ak_meteorite: () => 4, ak_steelseeker: () => 1, ak_dino: () => 0, ak_untapTokens: () => 0, ak_cleaver: () => 0
});
