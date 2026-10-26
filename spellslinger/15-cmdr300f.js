// Spellslinger Duels - engine pieces for commander round 3, batch f (2026-10-26). Wordings are in rules/cmdr300f.js.
// Every global here starts with f_ (or is a CMD / TRIG_FN key starting with f_) so the other batches can't collide.

// Last-known flags that must not outlive the permanent (Admiral Brass's base 4/4, Abigale's lost abilities)
(function () {
    const f_reset0 = resetObj;
    resetObj = function (o) { f_reset0(o); if (o.f_brass) { o.baseForever = null; o.f_brass = false; } o.f_noAbil = false; };
    const f_lost0 = lostAbilities;
    lostAbilities = function (o) { return !!(o && o.f_noAbil) || f_lost0(o); };
})();

const f_subtypes = card => { const m = (card.type || '').match(/—\s*(.+)$/); return m ? m[1].split(/\s+/).filter(Boolean) : []; };
const f_bottomRandom = (P, cards) => { cards.forEach(c => pull(P.library, c)); P.library.unshift(...shuffle(cards.slice())); };
function f_loseLife(X, n, src) { if (n <= 0) return; X.life -= n; X.lostN = (X.lostTurn === G.turn ? X.lostN || 0 : 0) + n; X.lostTurn = G.turn; log(`${X.name} lose${you(X) ? '' : 's'} ${n} life.`); fire('loseLife', { P: X, n }); }
// Look at the top n cards (they stay in the library); you may cast one that passes `test` for free; the rest go to the bottom in a random order
async function f_lookCast(P, n, test, src, why) {
    const top = P.library.slice(-n).reverse();
    log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library.`);
    const pool = top.filter(c => Rx(c).kind !== 'land' && Rx(c).support !== 'none' && test(c));
    if (pool.length) { const pick = await pickOwn(P, pool, `${src.card.name}: ${why}`, { optional: true }); if (pick) await castFreeAuto(P, pick); }
    f_bottomRandom(P, top.filter(c => P.library.includes(c)));
}
const f_myEquip = P => allPerms().filter(x => /\bEquipment\b/.test(x.card.type));
function f_attach(eq, host) { eq.attachedTo = host.uid; log(`${eq.card.name} is attached to ${host.card.name}.`); }

Object.assign(TRIG_FN, {
    f_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    f_selfAttacksWithOther: (o, ctx) => (ctx.list || []).includes(o) && (ctx.list || []).some(x => x !== o && x.owner === o.owner),
    f_myAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    f_myTwoAttack: (o, ctx) => (ctx.list || []).filter(x => x.owner === o.owner).length >= 2,
    f_secondSpell: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && ctx.P.castN === 2,
    f_myNoncreature: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && !['creature', 'land'].includes(Rx(ctx.o).kind),
    f_kioraCast: (o, ctx) => !!ctx.o && ctx.P.i === o.owner && ctx.o.castFromHand === G.turn && Rx(ctx.o).kind === 'creature' && /\b(Kraken|Leviathan|Octopus|Serpent)\b/.test(ctx.o.card.type),
    f_voloCast: (o, ctx) => {
        if (!ctx.o || ctx.P.i !== o.owner || Rx(ctx.o).kind !== 'creature') return false;
        const mine = new Set(); ctx.P.bf.filter(isCreature).forEach(x => (x.card.type.match(/—\s*(.+)$/) ? x.card.type.replace(/^.*—\s*/, '').split(/\s+/) : []).concat(x.addedTypes || []).forEach(w => mine.add(w)));
        ctx.P.gy.filter(c => /\bCreature\b/.test(c.card.type)).forEach(c => f_subtypes(c.card).forEach(w => mine.add(w)));
        return !f_subtypes(ctx.o.card).some(w => mine.has(w));
    },
    f_heroesHit: (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && f_isHeroes(x)),
    f_anyMain2: () => true,
    f_myBlocked: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    f_finalityMark: (o, ctx) => !!ctx.o && ctx.o.f_noctis === true && ctx.o.owner === o.owner
});
const f_isHeroes = x => ['Mutant', 'Ninja', 'Turtle'].some(w => hasType(x, w));
STATIC_FN.f_thancredMark = o => o.f_thancred !== undefined && G.players[o.owner].bf.some(b => b.uid === o.f_thancred);
COND_EXTRA.push(
    [/^you control a land with a \+1\/\+1 counter on it$/, () => P => P.bf.some(x => /\bLand\b/.test(x.card.type) && x.counters > 0)],
    [/^you control at least three other creatures$/, () => (P, o) => P.bf.filter(x => isCreature(x) && x !== o).length >= 3]
);

Object.assign(CMD_SCORE, { f_lydia: () => 2, f_sliverQueen: () => 4, f_meneldor: () => 3, f_lorthos: () => 6, f_brass: () => 7, f_virtus: () => 8, f_saruman: () => 4, f_tasigur: () => 3, f_arthur: () => 6, f_keene: () => 4, f_archaic: () => 7, f_noctis: () => 5, f_beorn: () => 4, f_heroes: () => 6, f_panther: () => 3, f_kiora: () => 7, f_volo: () => 8, f_tellah: () => 5, f_velomachus: () => 7, f_chiss: () => 5, f_bre: () => 4, f_kamiz: () => 5, f_amy: () => 3, f_barret: () => 2, f_belbe: () => 3, f_marhault: () => 1, f_abigale: () => 3, f_shiko: () => 6, f_thancred: () => 2, f_boone: () => 5, f_finality: () => 0 });
Object.assign(CMD, {
    // Lydia Frye: surveil X, X = tapped Assassins you control
    async f_lydia(P, e, t, src) { const x = P.bf.filter(c => isCreature(c) && c.tapped && hasType(c, 'Assassin')).length; if (x > 0) await applyChoiceEffect(P, { t: 'surveil', n: x }, src); },
    // Sliver Queen
    async f_sliverQueen(P, e, t, src) { await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Sliver', kw: [] }, null, src); },
    // Meneldor, Swift Savior: blink a creature you own
    async f_meneldor(P, e, t, src) {
        const pool = allPerms().filter(x => isCreature(x) && (x.realOwner ?? x.owner) === P.i);
        const x = await pickOwn(P, pool, `${src.card.name}: exile up to one creature you own, then return it`, { optional: true, rank: (a, b) => (Rx(b).etb.length - Rx(a).etb.length) || creatureValue(b) - creatureValue(a) });
        if (x && ((!(P.isAI || AUTOPLAY)) || Rx(x).etb.length)) await applyEffect(P, { t: 'flicker' }, { o: x }, src);
    },
    // Lorthos, the Tidemaker: pay {8}, tap up to eight permanents; they get stun counters (they stay tapped through their next untap step)
    async f_lorthos(P, e, t, src) {
        if (!await mayPay(P, '{8}', `${src.card.name}: pay {8} to tap up to eight target permanents?`, src, true)) return;
        let pool = allPerms().filter(x => x.owner !== P.i && !x.tapped && !has(x, 'hexproof')).sort((a, b) => permValue(b) - permValue(a));
        const picked = [];
        if (P.isAI || AUTOPLAY) picked.push(...pool.slice(0, 8));
        else for (let i = 0; i < 8 && pool.length; i++) { const x = await pickCard(P, pool, `${src.card.name}: tap a permanent (${i + 1} of 8)`, { optional: true }); if (!x) break; picked.push(x); pool = pool.filter(y => y !== x); }
        picked.forEach(x => { x.tapped = true; x.ctr.stun = (x.ctr.stun || 0) + 1; });
        if (picked.length) log(`${picked.map(x => x.card.name).join(', ')} ${picked.length === 1 ? 'is' : 'are'} tapped and won't untap during the next untap step.`);
    },
    // Admiral Brass: a Pirate returns with a finality counter, base 4/4, haste
    async f_brass(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && hasType(c, 'Pirate')); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a Pirate creature card from your graveyard?`, { optional: true }); if (!c) return;
        reanimateFrom(P, P, c); c.ctr.finality = 1; c.baseForever = { p: 4, q: 4 }; c.f_brass = true; c.tkw.push('haste');
        log(`${c.card.name} gets a finality counter, has base power and toughness 4/4 and gains haste until end of turn.`);
    },
    // Virtus the Veiled: that player loses half their life, rounded up
    f_virtus(P, e, t, src) { hitList().filter(H => H.i !== P.i && !H.out).forEach(H => f_loseLife(H, Math.ceil(H.life / 2), src)); },
    // Saruman the White
    async f_saruman(P, e, t, src) { await applyEffect(P, { t: 'amass', n: 2, type: 'Orc' }, null, src); },
    // Tasigur: mill two, an opponent chooses a nonland card from your graveyard to return to your hand
    async f_tasigur(P, e, t, src) {
        await applyEffect(P, { t: 'millSelf', n: 2 }, null, src);
        const pool = P.gy.filter(c => Rx(c).kind !== 'land' && !/\bLand\b/.test(c.card.type)); if (!pool.length) return;
        const X = foes(P)[0] || P; let c;
        if (X.isAI || AUTOPLAY) c = pool.slice().sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0))[0];
        else c = await pickCard(X, pool, `${src.card.name}: choose a nonland card from ${P.name === 'You' ? 'your' : P.name + "'s"} graveyard to return to hand`, { required: true }) || pool[0];
        pull(P.gy, c); P.hand.push(c); log(`${c.card.name} is returned to ${you(P) ? 'your' : P.name + "'s"} hand.`);
    },
    // Arthur, Marigold Knight: top six, a creature enters tapped and attacking, back to hand at the end of the turn (end of combat approximated)
    async f_arthur(P, e, t, src) {
        const top = P.library.slice(-6).reverse(); log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library.`);
        const pool = top.filter(c => /\bCreature\b/.test(c.card.type));
        const c = pool.length ? await pickOwn(P, pool, `${src.card.name}: put a creature onto the battlefield tapped and attacking?`, { optional: true }) : null;
        if (c) { putOntoBattlefield(P, c, true); G.attackers.push(c.uid); if (src.atkTo !== undefined) c.atkTo = src.atkTo; log(`${c.card.name} enters tapped and attacking.`); atEndStep(() => { if (onBf(c.uid)) { leaveBattlefield(c, 'hand'); } }, `${c.card.name} returns to its owner's hand.`); }
        f_bottomRandom(P, top.filter(x => P.library.includes(x)));
    },
    // Nine-Fingers Keene
    async f_keene(P, e, t, src) {
        const top = P.library.slice(-9).reverse(); log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards of ${you(P) ? 'your' : 'their'} library.`);
        const gates = top.filter(c => /\bGate\b/.test(c.card.type));
        const g = gates.length ? await pickOwn(P, gates, `${src.card.name}: put a Gate onto the battlefield?`, { optional: true }) : null;
        if (g) putOntoBattlefield(P, g, false);
        const rest = top.filter(c => c !== g && P.library.includes(c));
        if (P.bf.filter(x => /\bGate\b/.test(x.card.type)).length >= 9) { rest.forEach(c => { pull(P.library, c); P.hand.push(c); }); log(`${P.name} put${you(P) ? '' : 's'} the rest into ${you(P) ? 'your' : 'their'} hand.`); }
        else f_bottomRandom(P, rest);
    },
    // The Dawning Archaic: cast an instant or sorcery from your graveyard free; exile it instead of putting it into the graveyard
    async f_archaic(P, e, t, src) {
        const pool = P.gy.filter(c => ['instant', 'sorcery'].includes(Rx(c).kind) && Rx(c).support !== 'none'); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: cast an instant or sorcery card from your graveyard without paying its mana cost?`, { optional: true }); if (!c) return;
        c.exileAfter = true; if (!await castFreeAuto(P, c)) c.exileAfter = false;
    },
    // Noctis, Prince of Lucis: cast an artifact from your graveyard by paying 3 life; it enters with a finality counter
    async f_noctis(P, e, t, src) {
        const pool = P.gy.filter(x => /\bArtifact\b/.test(x.card.type) && Rx(x).kind !== 'land' && Rx(x).support !== 'none' && canPay(P, x)); if (!pool.length || P.life <= 3) { src.usedOnce = {}; return; }
        const c = await pickOwn(P, pool, `${src.card.name}: cast an artifact spell from your graveyard (pay 3 life)`, { optional: true }); if (!c) return;
        c.f_noctis = true; P.life -= 3; P.lostTurn = G.turn; P.lostN = (P.lostN || 0) + 3; fire('loseLife', { P, n: 3 }); log(`${P.name} pay${you(P) ? '' : 's'} 3 life.`);
        if (!await castPaying(P, c)) { c.f_noctis = false; P.life += 3; }
    },
    f_finality(P, e, t, src) { const o = G.ctxRaw && G.ctxRaw.o; if (o && onBf(o.uid) && o.f_noctis) { o.f_noctis = false; o.ctr.finality = 1; log(`${o.card.name} enters with a finality counter.`); } },
    // Beorn the Fierce
    async f_beorn(P, e, t, src) {
        const pool = P.bf.filter(isCreature);
        const x = await pickOwn(P, pool, `${src.card.name}: put a trample counter on up to one creature you control`, { optional: true, rank: (a, b) => (hasType(a, 'Bear') ? 1 : 0) - (hasType(b, 'Bear') ? 1 : 0) || pow(b) - pow(a) });
        if (x) { x.ctr.trample = (x.ctr.trample || 0) + 1; x.addedTypes = x.addedTypes || []; if (!x.addedTypes.includes('Bear')) x.addedTypes.push('Bear'); log(`${x.card.name} gets a trample counter and becomes a Bear in addition to its other types.`); }
        if (P.bf.filter(c => isCreature(c) && hasType(c, 'Bear')).length >= 3) drawCards(P, 2);
    },
    // Heroes in a Half Shell
    f_heroes(P, e, t, src) {
        const l = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner === P.i && onBf(x.uid) && f_isHeroes(x));
        l.forEach(x => { const got = putCounters(x, 1, P); log(`${x.card.name} gets ${got} +1/+1 counter.`); }); drawCards(P, 1);
    },
    // Black Panther: move all +1/+1 counters from a land to a creature
    async f_panther(P, e, t, src) {
        const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type) && x.counters > 0); const crs = P.bf.filter(isCreature); if (!lands.length || !crs.length) return;
        const l = await pickOwn(P, lands, `${src.card.name}: move +1/+1 counters from which land?`, { rank: (a, b) => b.counters - a.counters });
        const c = l && await pickOwn(P, crs, `${src.card.name}: move them onto which creature?`, { rank: (a, b) => pow(b) - pow(a) });
        if (!l || !c) return;
        const n = l.counters; l.counters = 0; const got = putCounters(c, n, P); log(`${n} +1/+1 counter${n === 1 ? '' : 's'} move from ${l.card.name} to ${c.card.name}.`);
        if (got > 0 || n > 0) { gainLifeFor(P, n); drawCards(P, 1); }
    },
    // Kiora, Sovereign of the Deep: top X cards, cast a spell with lesser mana value free
    async f_kiora(P, e, t, src) { const o = G.ctxRaw && G.ctxRaw.o; const x = o ? (o.card.cmc || 0) : 0; if (x > 0) await f_lookCast(P, x, c => (c.card.cmc || 0) < x, src, 'cast a spell with lesser mana value without paying its mana cost?'); },
    // Volo, Guide to Monsters: copy the creature spell (a creature spell's copy is a token copy of the permanent)
    f_volo(P, e, t, src) { const o = G.ctxRaw && G.ctxRaw.o; const item = o && G.stack.find(i => i.o === o && i.kind === 'spell'); if (item) tokenCopyOf(P, { ...o.card, type: o.card.type.replace(/^Token\s+/, '') }); },
    // Tellah, Great Sage (mana spent is approximated by mana value, plus X)
    async f_tellah(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; if (!o) return;
        const item = G.stack.find(i => i.o === o && i.kind === 'spell'); const mv = (o.card.cmc || 0) + (item && item.x ? item.x : 0);
        await applyEffect(P, { t: 'token', n: 1, p: 1, q: 1, name: 'colorless Hero', kw: [] }, null, src);
        if (mv >= 4) drawCards(P, 2);
        if (mv >= 8 && onBf(src.uid)) { sacPerm(P, src); foes(P).forEach(F => damage(F, mv, src)); }
    },
    // Velomachus Lorehold: top seven, cast an instant or sorcery with mana value up to his power free
    async f_velomachus(P, e, t, src) { const p = pow(src); await f_lookCast(P, 7, c => ['instant', 'sorcery'].includes(Rx(c).kind) && (c.card.cmc || 0) <= p, src, `cast an instant or sorcery with mana value ${p} or less without paying its mana cost?`); },
    // Chiss-Goria, Forge Tyrant: exile the top five; you may cast an artifact spell from among them this turn (the affinity is not modeled)
    f_chiss(P, e, t, src) {
        const top = P.library.slice(-5).reverse();
        top.forEach(c => { pull(P.library, c); if (/\bArtifact\b/.test(c.card.type) && Rx(c).kind !== 'land') exilePlayFrom(P, P, c, G.turn); else { P.exile.push(c); log(`${c.card.name} is exiled.`); } });
    },
    // Bre of Clan Stoutarm: exile until a nonland card; cast it free if its mana value is at most the life gained, else put it into your hand
    async f_bre(P, e, t, src) {
        const gained = P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0; if (gained <= 0) return;
        let c = null; while (P.library.length) { const x = P.library.pop(); P.exile.push(x); log(`${x.card.name} is exiled.`); if (Rx(x).kind !== 'land' && !/\bLand\b/.test(x.card.type)) { c = x; break; } }
        if (!c) return;
        if ((c.card.cmc || 0) <= gained) { const yes = (P.isAI || AUTOPLAY) ? true : await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }); if (yes && await castFreeAuto(P, c)) return; }
        else { pull(P.exile, c); P.hand.push(c); log(`${c.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Kamiz, Obscura Oculus
    async f_kamiz(P, e, t, src) {
        const at = (G.attackers || []).map(onBf).filter(x => x && x.owner === P.i); if (!at.length) return;
        const x = await pickOwn(P, at, `${src.card.name}: target attacking creature can't be blocked this turn`, { rank: (a, b) => (has(a, 'unblockable') ? 1 : 0) - (has(b, 'unblockable') ? 1 : 0) || pow(b) - pow(a) });
        if (!x) return;
        x.tkw.push('unblockable'); log(`${x.card.name} can't be blocked this turn.`);
        await applyChoiceEffect(P, { t: 'connive', target: 'creature' }, src, { o: x });
        const lesser = at.filter(y => y !== x && onBf(y.uid) && pow(y) < pow(x));
        const y = await pickOwn(P, lesser, `${src.card.name}: another attacking creature with lesser power gains double strike`, { rank: (a, b) => pow(b) - pow(a) });
        if (y) { y.tkw.push('double strike'); log(`${y.card.name} gains double strike until end of turn.`); }
    },
    // Amy Rose: attach an Equipment to her, another attacker gets +X/+0
    async f_amy(P, e, t, src) {
        const eq = await pickOwn(P, f_myEquip(P).filter(q => q.owner === P.i && q.attachedTo !== src.uid), `${src.card.name}: attach up to one target Equipment to her`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (eq) f_attach(eq, src);
        const other = (G.attackers || []).map(onBf).filter(x => x && x !== src && x.owner === P.i);
        const y = await pickOwn(P, other, `${src.card.name}: up to one other attacking creature gets +${pow(src)}/+0`, { optional: true, rank: (a, b) => pow(b) - pow(a) });
        if (y) { const x = pow(src); y.tp += x; log(`${y.card.name} gets +${x}/+0 until end of turn.`); }
    },
    // Barret, Avalanche Leader
    async f_barret(P, e, t, src) {
        const rebels = P.bf.filter(x => isCreature(x) && hasType(x, 'Rebel')); if (!rebels.length) return;
        const eqs = f_myEquip(P).filter(q => q.owner === P.i); if (!eqs.length) return;
        const eq = await pickOwn(P, eqs, `${src.card.name}: attach up to one Equipment you control to a Rebel`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!eq) return;
        const r = await pickOwn(P, rebels.filter(x => eq.attachedTo !== x.uid), `${src.card.name}: attach to which Rebel?`, { rank: (a, b) => pow(b) - pow(a) });
        if (r) f_attach(eq, r);
    },
    // Belbe, Corrupted Observer: the active player adds {C}{C} for each of your opponents who lost life this turn
    f_belbe(P, e, t, src) {
        const n = foes(P).filter(F => (F.lostTurn === G.turn ? F.lostN || 0 : 0) > 0).length; if (!n) return;
        const A = G.players[G.active]; A.pool = (A.pool || []).concat(Array(2 * n).fill('C')); log(`${A.name} add${you(A) ? '' : 's'} ${'{C}'.repeat(2 * n)}.`);
    },
    // General Marhault Elsdragon: +3/+3 for each creature blocking it
    f_marhault(P, e, t, src) { const o = G.ctxRaw && G.ctxRaw.o; if (!o || !onBf(o.uid)) return; const n = (G.blocks[o.uid] || []).length; if (n > 0) { o.tp += 3 * n; o.tq += 3 * n; log(`${o.card.name} gets +${3 * n}/+${3 * n} until end of turn.`); } },
    // Abigale, Eloquent First-Year: another creature loses all abilities, then gets flying, first strike and lifelink counters
    async f_abigale(P, e, t, src) {
        const pool = allPerms().filter(x => isCreature(x) && x !== src); if (!pool.length) return;
        const cost = x => Rx(x).kw.size + Rx(x).trig.length + Rx(x).acts.length + Rx(x).statics.length;
        const x = await pickOwn(P, pool, `${src.card.name}: up to one other target creature loses all abilities`, { optional: true, rank: (a, b) => (b.owner === P.i ? 1 : 0) - (a.owner === P.i ? 1 : 0) || cost(a) - cost(b) });
        if (!x) return;
        x.f_noAbil = true; ['flying', 'first strike', 'lifelink'].forEach(k => { x.ctr[k] = (x.ctr[k] || 0) + 1; });
        log(`${x.card.name} loses all abilities and gets a flying counter, a first strike counter and a lifelink counter.`);
    },
    // Shiko and Narset, Unified: copy the second spell if it targets a permanent or player, otherwise draw
    async f_shiko(P, e, t, src) {
        const o = G.ctxRaw && G.ctxRaw.o; const item = o && G.stack.find(i => i.o === o && i.kind === 'spell'); if (!item) return;
        if (item.target && (item.target.o || item.target.p)) await copySpellItem(P, item, { retarget: true }); else drawCards(P, 1);
    },
    // Thancred Waters: another legendary permanent you control gains indestructible as long as you control him
    async f_thancred(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src && /Legendary/.test(x.card.type)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: another target legendary permanent you control gains indestructible`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (x) { x.f_thancred = src.uid; log(`${x.card.name} gains indestructible for as long as ${P.name} ${you(P) ? 'control' : 'controls'} ${src.card.name}.`); }
    },
    // Craig Boone, Novac Guard: two quest counters, then damage equal to the quest counters to a creature unless its controller takes it
    async f_boone(P, e, t, src) {
        if (!onBf(src.uid)) return; src.ctr.quest = (src.ctr.quest || 0) + 2; const d = src.ctr.quest;
        const pool = foes(P).flatMap(F => F.bf.filter(isCreature)).filter(x => !has(x, 'hexproof') && !has(x, 'shroud'));
        const x = await pickOwn(P, pool, `${src.card.name}: deal ${d} damage to up to one target creature`, { optional: true, rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (!x) return;
        const X = G.players[x.owner]; let take;
        if (X.isAI || AUTOPLAY) take = X.life - d > 12 && creatureValue(x) >= 4; else take = await askYes(X, `${src.card.name} would deal ${d} damage to ${x.card.name}. Have it deal ${d} damage to you instead?`, { card: src.card, yes: 'Take it', no: 'Let the creature take it' });
        if (take) { damage(X, d, src); log(`${X.name} take${you(X) ? '' : 's'} ${d} damage instead.`); } else damage(x, d, src);
    }
});
