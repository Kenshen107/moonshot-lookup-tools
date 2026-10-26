// Spellslinger Duels - engine pieces for commander round 4, batch i (2026-10-26). Wordings are in rules/cmdr300i.js.
// Every global here starts with i_ (or is a CMD / TRIG_FN / STATIC_FN key starting with i_) so the other batches can't collide.

const i_human = P => !(P.isAI || AUTOPLAY);
const i_ctxO = () => (G.ctxRaw && G.ctxRaw.o) || null;
const i_isHistoric = x => /Artifact|Legendary|Saga/.test(x.card.type);
const i_cardTypes = c => ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle', 'Instant', 'Sorcery'].filter(w => new RegExp(`\\b${w}\\b`).test(c.card.type));
function i_actX(R, line, costText, effect, patch) { const a = parseActivated(`${costText}: Draw X cards.`, R); a.effects = [effect]; a.text = line; if (patch) patch(a); R.acts.push(a); return a; }
// Cast a card from a graveyard, paying its cost (it is moved to exile first so the game lets it be cast this turn)
async function i_castFromGy(P, H, c) {
    pull(H.gy, c); exilePlayFrom(P, H, c, G.turn);
    const ok = await castPaying(P, c);
    if (!ok && P.exile.includes(c)) { pull(P.exile, c); delete c.playUntil; H.gy.push(c); if (c.realOwner !== undefined) { c.owner = c.realOwner; delete c.realOwner; } log(`${c.card.name} can't be cast and returns to the graveyard.`); }
    return ok;
}

// ----- global wrappers (each one calls the previous version) -----
// Cid, Timeless Artificer: artifact creatures and Heroes get +1/+1 for each Artificer you control and each Artificer card in your graveyard
const i_origStaticBuffs = staticBuffs;
staticBuffs = function (o) {
    const b = i_origStaticBuffs(o);
    if (G && o && o.owner !== undefined && isCreature(o) && (/\bArtifact\b/.test(o.card.type) || hasType(o, 'Hero'))) {
        const X = G.players[o.owner];
        for (const a of X.bf) {
            if (!Rx(a).i_cid || lostAbilities(a)) continue;
            const n = X.bf.filter(y => isCreature(y) && hasType(y, 'Artificer')).length + X.gy.filter(c => /\bArtificer\b/.test(c.card.type)).length;
            b.p += n; b.q += n;
        }
    }
    return b;
};
// Caradora, Heart of Alacria: one more +1/+1 counter on a creature or Vehicle you control
const i_origPutCounters = putCounters;
putCounters = function (o, n, by) {
    if (o && n > 0 && onBf(o.uid) && (isCreature(o) || hasType(o, 'Vehicle'))) { const X = G.players[o.owner]; if (X.bf.some(a => Rx(a).i_caradora && !lostAbilities(a))) n += 1; }
    return i_origPutCounters(o, n, by);
};
// Emmara Tandris (prevent damage to your creature tokens), Djeru (prevent 1 damage to your planeswalkers), Far Fortune (1 more damage to opponents and their permanents)
const i_origDamage = damage;
damage = function (target, n, src) {
    if (n > 0 && target && target.card && target.uid !== undefined && G && G.players[target.owner]) {
        const X = G.players[target.owner];
        if (target.token && isCreature(target) && X.bf.some(a => Rx(a).i_emmara && !lostAbilities(a))) { log(`Damage to ${target.card.name} is prevented (Emmara Tandris).`); return; }
        if (/\bPlaneswalker\b/.test(target.card.type) && X.bf.some(a => Rx(a).i_djeru && !lostAbilities(a))) { n -= 1; log(`1 damage to ${target.card.name} is prevented (Djeru).`); if (n <= 0) return; }
    }
    if (n > 0 && src && src.card && src.uid !== undefined && G && G.players[src.owner]) {
        const S = G.players[src.owner];
        const tgtOwner = target && target.life !== undefined ? target.i : (target && target.uid !== undefined && G.players[target.owner] ? target.owner : undefined);
        if (tgtOwner !== undefined && tgtOwner !== src.owner && S.bf.some(a => Rx(a).i_farFortune && !lostAbilities(a))) n += 1;
    }
    return i_origDamage(target, n, src);
};
// Masako the Humorless: tapped creatures you control can block
const i_origCanBlock = canBlock;
canBlock = function (b, atk) {
    if (G && b.tapped && isCreature(b) && G.players[b.owner].bf.some(a => Rx(a).i_masako && !lostAbilities(a))) {
        b.tapped = false;
        try { return i_origCanBlock(b, atk); } finally { b.tapped = true; }
    }
    return i_origCanBlock(b, atk);
};
// Eligeth, Crossroads Augur: if you would scry a number of cards, draw that many cards instead
const i_origACE = applyChoiceEffect;
applyChoiceEffect = async function (P, e, src, t) {
    if (e && e.t === 'scry' && P.bf.some(a => Rx(a).i_eligeth && !lostAbilities(a))) { log(`${P.name} ${you(P) ? 'draw' : 'draws'} ${e.n} card${e.n === 1 ? '' : 's'} instead of scrying (Eligeth).`); drawCards(P, e.n); return; }
    return i_origACE.apply(this, arguments);
};
// Taeko, the Patient Avalanche: remember where a permanent went when it left the battlefield (did it die?)
const i_origLeave = leaveBattlefield;
leaveBattlefield = function (o, zone) { if (G) G.i_leaveZone = zone; return i_origLeave.apply(this, arguments); };

STATIC_FN.i_entered = o => o.enteredTurn === G.turn;
COND_EXTRA.push([/^three or more Lesson cards are in your graveyard$/, () => P => P.gy.filter(c => /\bLesson\b/.test(c.card.type)).length >= 3]);

Object.assign(TRIG_FN, {
    i_anyArtGy: (o, ctx) => !!ctx.o,
    i_selfAttacks: (o, ctx) => (ctx.list || []).includes(o),
    i_aloneSW: (o, ctx) => (ctx.list || []).length === 1 && ctx.list[0].owner === o.owner && (hasType(ctx.list[0], 'Samurai') || hasType(ctx.list[0], 'Warrior')),
    i_myInstSorc: (o, ctx) => !!ctx.P && ctx.P.i === o.owner && !!ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind),
    i_myTurn: (o, ctx) => G.active === o.owner,
    i_myVehicle: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Vehicle'),
    i_myCat: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && hasType(ctx.o, 'Cat'),
    i_selfHits: (o, ctx) => ctx.src === o && (ctx.hit || []).length > 0,
    i_mySacToken: (o, ctx) => !!ctx.o && !!ctx.o.token && ctx.o.owner === o.owner,
    i_selfLeaves: (o, ctx) => ctx.o === o,
    i_otherNontokenLeaves: (o, ctx) => !!ctx.o && ctx.o !== o && !ctx.o.token && ctx.o.owner === o.owner && /\bCreature\b/.test(ctx.o.card.type),
    i_attackAtOpp: (o, ctx) => (ctx.list || []).some(x => { const D = atkDef(x); return !!D && D.i !== o.owner; }),
    i_wraithAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Wraith')),
    i_sigardaAttacks: (o, ctx) => (ctx.list || []).includes(o) && new Set(G.players[o.owner].bf.filter(isCreature).map(pow)).size >= 3,
    i_artInstSorcCast: (o, ctx) => !!ctx.o && (/\bArtifact\b/.test(ctx.o.card.type) || ['instant', 'sorcery'].includes(Rx(ctx.o).kind)),
    i_heroCounters: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && ctx.o !== o && hasType(ctx.o, 'Hero') && (ctx.n || 0) > 0,
    i_myMain2: (o, ctx) => G.active === o.owner,
    i_myOtherNontokenCreature: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && !ctx.o.token && isCreature(ctx.o),
    i_myOtherPerm: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner,
    i_mineAttack: (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner),
    i_artEnteredMine: (o, ctx) => (G.entered || []).some(e => e.turn === G.turn && e.owner === o.owner && /\bArtifact\b/.test(e.o.card.type)),
    i_otherCreatureLeavesAlive: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && /\bCreature\b/.test(ctx.o.card.type) && G.i_leaveZone !== 'gy'
});

Object.assign(CMD_SCORE, { i_ichtekik: () => 3, i_grenzo: () => 4, i_thor: () => 5, i_norika: () => 4, i_egon: () => 0, i_akul: () => 8, i_sofia: () => 7, i_zaffai: () => 3, i_loot: () => 6, i_greasefang: () => 6,
    i_miles: () => 2, i_kemba: () => 3, i_tempestra: () => 4, i_intet: () => 4, i_extus: () => 4, i_antman: () => 4, i_gerrard: () => 8, i_nadier: () => 5, i_nin: () => 6, i_shaile: () => 3, i_tokka: () => 3,
    i_gahiji: () => 5, i_skanos: () => 5, i_duke: () => 3, i_capAmerica: () => 5, i_amareth: () => 3, i_ashling: () => 3, i_witchKing: () => 6, i_narset: () => 3, i_plargg: () => 6, i_sigarda: () => 3,
    i_aziza: () => 6, i_owen: () => 3, i_silas: () => 4, i_mortarion: () => 6, i_april: () => 2, i_jugan: () => 8, i_syr: () => 5, i_invisible: () => 2, i_kirri: () => 3, i_riku: () => 6, i_alistair: () => 6,
    i_tegan: () => 3, i_akalPakal: () => 3, i_taeko: () => 2, i_ghired: () => 6 });

Object.assign(CMD, {
    // Ich-Tekik, Salvage Splicer
    i_ichtekik(P, e, t, src) {
        if (onBf(src.uid)) putCounters(src, 1, P);
        P.bf.filter(x => hasType(x, 'Golem') && onBf(x.uid)).forEach(x => putCounters(x, 1, P));
        log('+1/+1 counters go on Ich-Tekik and each Golem you control.');
    },
    // Grenzo, Dungeon Warden: mill the bottom card; a creature with power up to Grenzo's enters
    i_grenzo(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const c = P.library.shift(); if (!c) return;
        P.gy.push(c); log(`${P.name} put${you(P) ? '' : 's'} the bottom card of ${you(P) ? 'your' : 'their'} library into the graveyard: ${c.card.name}.`);
        if (/\bCreature\b/.test(c.card.type) && (Number(c.card.power) || 0) <= pow(src)) { pull(P.gy, c); putOntoBattlefield(P, c); log(`${c.card.name} is put onto the battlefield.`); }
    },
    // The Mighty Thor, Jane Foster: exile up to one nontoken artifact or creature, then return it tapped under its owner's control
    async i_thor(P, e, t, src) {
        let pool = allPerms().filter(x => !x.token && x !== undefined && (isCreature(x) || /\bArtifact\b/.test(x.card.type)) && (x.owner === P.i || (!has(x, 'hexproof') && !has(x, 'shroud'))));
        if (!i_human(P)) pool = pool.filter(x => x.owner === P.i && Rx(x).etb.length > 0);
        const x = await pickOwn(P, pool, `${src.card.name}: exile up to one target nontoken artifact or creature, then return it tapped`, { optional: true, rank: (a, b) => Rx(b).etb.length - Rx(a).etb.length }); if (!x) return;
        const uid = x.uid; leaveBattlefield(x, 'exile');
        const O = G.players[x.owner], y = O.exile.find(c => c.uid === uid);
        if (y) { pull(O.exile, y); putOntoBattlefield(O, y, true); log(`${y.card.name} returns to the battlefield tapped.`); }
    },
    // Norika Yamazaki, the Poet: cast an enchantment card from your graveyard this turn
    async i_norika(P, e, t, src) {
        const pool = P.gy.filter(c => /\bEnchantment\b/.test(c.card.type) && Rx(c).support !== 'none'); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: cast an enchantment card from your graveyard this turn?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        await i_castFromGy(P, P, c);
    },
    // Egon, God of Death: exile two cards from your graveyard each upkeep, or sacrifice it and draw
    async i_egon(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (P.gy.length < 2) { sacPerm(P, src); drawCards(P, 1); return; }
        for (let k = 0; k < 2; k++) {
            const c = await pickOwn(P, P.gy, `${src.card.name}: exile two cards from your graveyard (${k + 1} of 2)`, { rank: (a, b) => (a.card.cmc || 0) - (b.card.cmc || 0) });
            if (c) { pull(P.gy, c); P.exile.push(c); log(`${P.name} exile${you(P) ? '' : 's'} ${c.card.name} from ${you(P) ? 'your' : 'their'} graveyard.`); }
        }
    },
    // Akul the Unrepentant
    async i_akul(P, e, t, src) {
        const pool = P.hand.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: put a creature card from your hand onto the battlefield?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(P.hand, c); putOntoBattlefield(P, c); log(`${c.card.name} is put onto the battlefield.`);
    },
    // Commander Sofia Daguerre: destroy up to one legendary permanent; its controller creates a Junk token
    async i_sofia(P, e, t, src) {
        let pool = allPerms().filter(x => x !== src && /\bLegendary\b/.test(x.card.type) && (x.owner === P.i || (!has(x, 'hexproof') && !has(x, 'shroud'))));
        if (!i_human(P)) pool = pool.filter(x => x.owner !== P.i);
        const x = await pickOwn(P, pool, `${src.card.name}: destroy up to one target legendary permanent`, { optional: true, rank: (a, b) => permValue(b) - permValue(a) }); if (!x) return;
        const C = G.players[x.owner];
        destroy(x, src.card.name);
        applyEffect(C, { t: 'artToken', kind: 'junk', n: 1 }, null, src);
    },
    // Zaffai, Thunder Conductor
    async i_zaffai(P, e, t, src) {
        const o = i_ctxO(); if (!o) return;
        await applyChoiceEffect(P, { t: 'scry', n: 1 }, src);
        const mv = o.card.cmc || 0;
        if (mv >= 5) await applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'blue and red Elemental', kw: [] }, null, src);
        if (mv >= 10) { const fs = foes(P); if (fs.length) { const F = shuffle(fs.slice())[0]; log(`${src.card.name} deals 10 damage to ${F.name}.`); damage(F, 10, src); } }
    },
    // Loot, the Key to Everything: exile the top X cards, X = card types among other nonland permanents; play them this turn
    i_loot(P, e, t, src) {
        const types = new Set(); P.bf.forEach(x => { if (x !== src) permTypes(x).filter(w => w !== 'Land').forEach(w => types.add(w)); });
        const X = types.size; if (!X) return;
        for (let k = 0; k < X && P.library.length; k++) { const c = P.library.pop(); exilePlayFrom(P, P, c, G.turn); }
    },
    // Greasefang, Okiba Boss
    async i_greasefang(P, e, t, src) {
        const pool = P.gy.filter(c => /\bVehicle\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return target Vehicle card from your graveyard to the battlefield`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c); c.tkw.push('haste'); c.sick = false;
        atEndStep(() => { if (onBf(c.uid)) leaveBattlefield(c, 'hand'); }, `${c.card.name} returns to its owner's hand.`);
    },
    // Miles "Tails" Prower
    i_miles(P, e, t, src) {
        const o = i_ctxO(); if (!o || !onBf(o.uid)) return;
        if (has(o, 'flying')) { drawCards(P, 1); log(`${P.name} draw${you(P) ? '' : 's'} a card.`); }
        else { o.ctr.flying = (o.ctr.flying || 0) + 1; log(`${o.card.name} gets a flying counter.`); }
    },
    // Kemba, Kha Enduring: attach up to one Equipment you control to the Cat that entered
    async i_kemba(P, e, t, src) {
        const cat = i_ctxO(); if (!cat || !onBf(cat.uid)) return;
        const pool = P.bf.filter(x => /\bEquipment\b/.test(x.card.type) && x.attachedTo !== cat.uid); if (!pool.length) return;
        const eq = await pickOwn(P, pool, `${src.card.name}: attach up to one Equipment you control to ${cat.card.name}`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!eq) return;
        eq.attachedTo = cat.uid; log(`${eq.card.name} is attached to ${cat.card.name}.`);
    },
    // Tempestra, Dame of Games: a nonlegendary hasty token copy of another creature, sacrificed at the end step
    async i_tempestra(P, e, t, src) {
        const pool = P.bf.filter(x => isCreature(x) && x !== src); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: create a token that's a copy of another target creature you control`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        const tok = tokenCopyOf(P, { ...x.card, type: x.card.type.replace(/Legendary\s*/, '') });
        tok.tkw.push('haste'); tok.sick = false;
        atEndStep(() => { if (onBf(tok.uid)) sacPerm(P, tok); }, `${tok.card.name} is sacrificed.`);
    },
    // Intet, the Dreamer: pay {2}{U} to exile the top card face down; play it free while Intet stays
    async i_intet(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (!await mayPay(P, '{2}{U}', `${src.card.name}: pay {2}{U} to exile the top card of your library face down?`, src)) return;
        const c = P.library.pop(); if (!c) return;
        c.freeCast = true; c.playUntil = 99999; c.playWhile = src.uid; P.exile.push(c);
        log(`${P.name} exile${you(P) ? '' : 's'} the top card of ${you(P) ? 'your' : 'their'} library face down; ${you(P) ? 'you' : 'they'} may play it for free while ${src.card.name} stays on the battlefield.`);
    },
    // Extus, Oriq Overlord
    async i_extus(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && !/\bLegendary\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return target nonlegendary creature card from your graveyard to your hand`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // The Astonishing Ant-Man: remove any number of +1/+1 counters; that many 1/1 Insects
    async i_antman(P, e, t, src) {
        const have = Math.max(0, src.counters || 0); if (!onBf(src.uid) || !have) return;
        let n = have;
        if (i_human(P)) { const r = await askNumber(P, `${src.card.name}: remove how many +1/+1 counters?`, 0, have, have, { card: src.card }); n = r === null ? 0 : r; }
        if (n <= 0) return;
        src.counters -= n; log(`${src.card.name} loses ${n} +1/+1 counter${n === 1 ? '' : 's'}.`);
        await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Insect', kw: [] }, null, src);
    },
    // Gerrard, Weatherlight Hero: exile it and return the artifact and creature cards that went to your graveyard from the battlefield this turn
    i_gerrard(P, e, t, src) {
        const I = G.players[src.owner];
        if (I.gy.includes(src)) { pull(I.gy, src); I.exile.push(src); }
        const back = I.gy.filter(c => c.toGyTurn === G.turn && /\b(Artifact|Creature)\b/.test(c.card.type));
        back.forEach(c => { pull(I.gy, c); putOntoBattlefield(I, c); });
        log(`${back.length} card${back.length === 1 ? '' : 's'} return${back.length === 1 ? 's' : ''} to the battlefield.`);
    },
    // Nadier, Agent of the Duskenel: 1/1 Elf Warriors equal to its power
    async i_nadier(P, e, t, src) {
        const lki = G.ctxRaw && G.ctxRaw.lki;
        const n = lki && lki.pow !== undefined ? lki.pow : (src.lastPow !== undefined ? src.lastPow : (Number(src.card.power) || 0));
        if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'green Elf Warrior', kw: [] }, null, src);
    },
    // Nin, the Pain Artist: X damage to a creature; its controller draws X cards
    async i_nin(P, e, t, src) {
        const X = Number(e.x); if (!(X > 0)) return;
        let pool = allPerms().filter(x => isCreature(x) && (x.owner === P.i || (!has(x, 'hexproof') && !has(x, 'shroud'))));
        if (!i_human(P)) pool = pool.filter(x => x.owner !== P.i && tou(x) - x.dmg <= X);
        const x = await pickOwn(P, pool, `${src.card.name}: deal ${X} damage to target creature`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        const C = G.players[x.owner];
        damage(x, X, src); drawCards(C, X); log(`${C.name} draw${you(C) ? '' : 's'} ${X} card${X === 1 ? '' : 's'}.`);
    },
    // Shaile, Dean of Radiance: a +1/+1 counter on each creature that entered this turn
    i_shaile(P, e, t, src) {
        const xs = P.bf.filter(x => isCreature(x) && x.enteredTurn === G.turn); xs.forEach(x => putCounters(x, 1, P));
        log(`${xs.length} creature${xs.length === 1 ? '' : 's'} get a +1/+1 counter.`);
    },
    // Tokka & Rahzar, Unsupervised
    i_tokka(P, e, t, src) { if (onBf(src.uid)) putCounters(src, 1, P); makeArtifactToken(P, 'treasure'); log(`${P.name} create${you(P) ? '' : 's'} a Treasure token.`); },
    // Gahiji, Honored One: attackers at your opponents get +2/+0
    i_gahiji(P, e, t, src) {
        const xs = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => onBf(x.uid) && (() => { const D = atkDef(x); return !!D && D.i !== P.i; })());
        xs.forEach(x => { x.tp += 2; }); if (xs.length) log(`${xs.length} attacking creature${xs.length === 1 ? '' : 's'} get +2/+0 until end of turn.`);
    },
    // Skanos Dragonheart
    i_skanos(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const X = Math.max(0, ...P.bf.filter(x => x !== src && isCreature(x) && hasType(x, 'Dragon')).map(pow), ...P.gy.filter(c => /\bDragon\b/.test(c.card.type)).map(c => Number(c.card.power) || 0));
        if (X > 0) { src.tp += X; src.tq += X; log(`${src.card.name} gets +${X}/+${X} until end of turn.`); }
    },
    // The Duke, Rebel Sentry: remove a counter; +1/+1 counter and hexproof on another creature
    async i_duke(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (src.counters > 0) src.counters--; else { const k = Object.keys(src.ctr || {}).find(c => src.ctr[c] > 0); if (!k) return; src.ctr[k]--; }
        const pool = P.bf.filter(x => isCreature(x) && x !== src); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: put a +1/+1 counter on another target creature you control`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        putCounters(x, 1, P); x.tkw.push('hexproof'); log(`${x.card.name} gets a +1/+1 counter and hexproof until end of turn.`);
    },
    // Captain America, Wings of Freedom
    i_capAmerica(P, e, t, src) {
        if (!onBf(src.uid)) return; const X = Math.max(0, tou(src));
        P.bf.filter(x => x !== src && isCreature(x) && hasType(x, 'Hero')).forEach(x => { x.tp += X; x.tq += X; });
        log(`Each other Hero you control gets +${X}/+${X} until end of turn.`);
    },
    // Amareth, the Lustrous: look at the top card; if it shares a card type with the permanent that entered, you may put it into your hand
    async i_amareth(P, e, t, src) {
        const o = i_ctxO(); if (!o) return;
        const top = P.library[P.library.length - 1]; if (!top) return;
        const mine = i_cardTypes(o); if (!i_cardTypes(top).some(w => mine.includes(w))) return;
        const yes = i_human(P) ? await askYes(P, `${src.card.name}: ${top.card.name} shares a card type with ${o.card.name}. Reveal it and put it into your hand?`, { card: top.card }) : true;
        if (yes) { P.library.pop(); P.hand.push(top); log(`${P.name} reveal${you(P) ? '' : 's'} ${top.card.name} and put${you(P) ? '' : 's'} it into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    // Ashling the Pilgrim: the third activation each turn blows up
    i_ashling(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (src.i_ashT !== G.turn) { src.i_ashT = G.turn; src.i_ashN = 0; }
        src.i_ashN++;
        if (src.i_ashN < 3) { putCounters(src, 1, P); return; }
        putCounters(src, 1, P);
        const n = Math.max(0, src.counters || 0); src.counters = 0;
        log(`${src.card.name} removes all +1/+1 counters and deals ${n} damage to each creature and each player.`);
        if (n > 0) { allPerms().filter(isCreature).forEach(x => damage(x, n, src)); G.players.filter(X => !X.out).forEach(X => damage(X, n, src)); }
    },
    // Witch-king, Sky Scourge: exile the top X cards where X is the attacking Wraiths' total power
    i_witchKing(P, e, t, src) {
        const xs = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner === P.i && hasType(x, 'Wraith') && onBf(x.uid));
        const X = xs.reduce((s, x) => s + Math.max(0, pow(x)), 0);
        for (let k = 0; k < X && P.library.length; k++) { const c = P.library.pop(); exilePlayFrom(P, P, c, G.turn); }
    },
    // Narset, Jeskai Waymaster
    async i_narset(P, e, t, src) {
        const n = P.castTurn === G.turn ? (P.castN || 0) : 0; if (!P.hand.length && !n) return;
        const yes = i_human(P) ? await askYes(P, `${src.card.name}: discard your hand and draw ${n} card${n === 1 ? '' : 's'}?`, { card: src.card }) : n > P.hand.length;
        if (!yes) return;
        const hand = P.hand.slice(); noteDiscard(P, hand.length);
        hand.forEach(c => { pull(P.hand, c); P.gy.push(c); c.discardTurn = G.turn; });
        log(`${P.name} discard${you(P) ? '' : 's'} ${you(P) ? 'your' : 'their'} hand.`);
        if (n > 0) drawCards(P, n);
    },
    // Plargg, Dean of Chaos: reveal until a nonlegendary nonland card with mana value 3 or less; cast it free
    async i_plargg(P, e, t, src) {
        const rest = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (!/\bLand\b/.test(c.card.type) && !/\bLegendary\b/.test(c.card.type) && (c.card.cmc || 0) <= 3) { hit = c; break; } rest.push(c); }
        if (hit) { log(`${P.name} reveal${you(P) ? '' : 's'} ${hit.card.name}.`); P.library.push(hit); const yes = i_human(P) ? await askYes(P, `${src.card.name}: cast ${hit.card.name} without paying its mana cost?`, { card: hit.card }) : true; let ok = false; if (yes) ok = await castFreeAuto(P, hit); if (!ok && P.library.includes(hit)) { pull(P.library, hit); rest.push(hit); } }
        P.library.unshift(...shuffle(rest));
    },
    // Sigarda, Champion of Light
    async i_sigarda(P, e, t, src) { await lookTopPick(P, 5, c => /\bCreature\b/.test(c.card.type) && /\bHuman\b/.test(c.card.type), 'put a Human creature card into your hand?', src); },
    // Aziza, Mage Tower Captain: tap three creatures to copy the spell
    async i_aziza(P, e, t, src) {
        const o = i_ctxO(); if (!o) return;
        const item = G.stack.find(i => i.o === o && i.kind === 'spell'); if (!item) return;
        const free = P.bf.filter(x => isCreature(x) && !x.tapped); if (free.length < 3) return;
        const yes = i_human(P) ? await askYes(P, `${src.card.name}: tap three untapped creatures to copy ${o.card.name}?`, { card: src.card }) : true; if (!yes) return;
        const tapped = [];
        for (let k = 0; k < 3; k++) { const x = await pickOwn(P, free.filter(y => !tapped.includes(y)), `${src.card.name}: tap an untapped creature (${k + 1} of 3)`, { rank: (a, b) => creatureValue(a) - creatureValue(b) }); if (!x) break; tapped.push(x); }
        tapped.forEach(x => { x.tapped = true; });
        await copySpellItem(P, item, { retarget: true });
    },
    // Owen Grady, Raptor Trainer
    async i_owen(P, e, t, src) {
        const pool = allPerms().filter(x => hasType(x, 'Dinosaur') && (x.owner === P.i || (!has(x, 'hexproof') && !has(x, 'shroud')))); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: put a counter on target Dinosaur`, { rank: (a, b) => (a.owner === P.i ? 0 : 1) - (b.owner === P.i ? 0 : 1) || creatureValue(b) - creatureValue(a) }); if (!x) return;
        const kinds = ['reach', 'menace', 'trample', 'haste'];
        const k = i_human(P) ? kinds[await askMode(P, `${src.card.name}: choose a counter`, kinds)] || 'trample' : 'trample';
        x.ctr[k] = (x.ctr[k] || 0) + 1; log(`${x.card.name} gets a ${k} counter.`);
    },
    // Silas Renn, Seeker Adept: cast an artifact card from your graveyard this turn
    async i_silas(P, e, t, src) {
        const pool = P.gy.filter(c => /\bArtifact\b/.test(c.card.type) && Rx(c).support !== 'none' && Rx(c).kind !== 'land'); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: cast an artifact card from your graveyard this turn`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        await i_castFromGy(P, P, c);
    },
    // Mortarion, Daemon Primarch: pay {X}, up to the life you lost this turn, for 2/2 Astartes Warriors with menace
    async i_mortarion(P, e, t, src) {
        const lost = lostThisTurn(P); if (lost <= 0) return;
        let max = 0; for (let x = Math.min(lost, 20); x >= 1; x--) { if (planPayment(P, parseCost(`{${x}}`))) { max = x; break; } }
        if (!max) return;
        let X = max;
        if (i_human(P)) { const r = await askNumber(P, `${src.card.name}: pay {X} (up to ${max}) for X 2/2 Astartes Warriors?`, 0, max, max, { card: src.card }); X = r === null ? 0 : r; }
        if (X <= 0) return;
        planPayment(P, parseCost(`{${X}}`)).forEach(s => tapSource(P, s));
        await applyEffect(P, { t: 'token', n: X, p: 2, q: 2, name: 'black Astartes Warrior', kw: ['menace'] }, null, src);
    },
    // April O'Neil, Human Element
    i_april(P, e, t, src) { applyEffect(P, { t: 'artToken', kind: 'mutagen', n: 1 }, null, src); },
    // Jugan, the Rising Star: five +1/+1 counters spread among your creatures
    async i_jugan(P, e, t, src) {
        for (let k = 0; k < 5; k++) {
            const pool = P.bf.filter(x => isCreature(x) && x !== src); if (!pool.length) break;
            const x = await pickOwn(P, pool, `${src.card.name}: put a +1/+1 counter on a creature (${k + 1} of 5)`, { optional: k > 0, rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) break;
            putCounters(x, 1, P); log(`${x.card.name} gets a +1/+1 counter.`);
        }
    },
    // Syr Vondam, the Lucent
    i_syr(P, e, t, src) {
        const xs = P.bf.filter(x => isCreature(x) && x !== src); xs.forEach(x => { x.tp += 1; x.tkw.push('deathtouch'); });
        log(`Other creatures you control get +1/+0 and gain deathtouch until end of turn.`);
    },
    // Invisible Woman, Sue Storm
    async i_invisible(P, e, t, src) {
        const yes = i_human(P) ? await askYes(P, `${src.card.name}: create a 0/4 Wall creature token with defender?`, { card: src.card }) : true; if (!yes) return;
        await applyEffect(P, { t: 'token', n: 1, p: 0, q: 4, name: 'colorless Wall', kw: ['defender'] }, null, src);
    },
    // Kirri, Talented Sprout
    async i_kirri(P, e, t, src) {
        const pool = P.gy.filter(c => /\bLand\b/.test(c.card.type) || /\b(Plant|Treefolk)\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return target Plant, Treefolk, or land card from your graveyard to your hand`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }); if (!c) return;
        pull(P.gy, c); P.hand.push(c); log(`${c.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Riku of Two Reflections
    async i_riku(P, e, t, src) {
        const o = i_ctxO(); if (!o || o.token) return;
        if (!await mayPay(P, '{G}{U}', `${src.card.name}: pay {G}{U} to create a token copy of ${o.card.name}?`, src)) return;
        tokenCopyOf(P, o.card);
    },
    // Alistair, the Brigadier
    async i_alistair(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (!await mayPay(P, '{8}', `${src.card.name}: pay {8} to give creatures you control +X/+X?`, src)) return;
        const X = P.bf.filter(i_isHistoric).length;
        P.bf.filter(isCreature).forEach(x => { x.tp += X; x.tq += X; }); log(`Creatures you control get +${X}/+${X} until end of turn.`);
    },
    // Tegan Jovanka
    async i_tegan(P, e, t, src) {
        const pool = (G.attackers || []).map(u => onBf(u)).filter(x => x && x.owner === P.i && isCreature(x) && i_isHistoric(x)); if (!pool.length) return;
        const x = await pickOwn(P, pool, `${src.card.name}: target attacking historic creature gets +1/+1 and indestructible`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!x) return;
        x.tp += 1; x.tq += 1; x.tkw.push('indestructible'); log(`${x.card.name} gets +1/+1 and gains indestructible until end of turn.`);
    },
    // Akal Pakal, First Among Equals
    async i_akalPakal(P, e, t, src) {
        const top = []; for (let k = 0; k < 2 && P.library.length; k++) top.push(P.library.pop()); if (!top.length) return;
        const c = await pickOwn(P, top, `${src.card.name}: put one of them into your hand (the other goes to your graveyard)`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        top.forEach(x => { if (x === c) P.hand.push(x); else P.gy.push(x); });
        log(`${P.name} put${you(P) ? '' : 's'} one card into ${you(P) ? 'your' : 'their'} hand and the other into the graveyard.`);
    },
    // Taeko, the Patient Avalanche
    async i_taeko(P, e, t, src) { await applyChoiceEffect(P, { t: 'scry', n: 1 }, src); if (onBf(src.uid)) putCounters(src, 1, P); },
    // Ghired, Conclave Exile: populate; the token enters tapped and attacking
    async i_ghired(P, e, t, src) {
        const pool = P.bf.filter(x => x.token && isCreature(x)); if (!pool.length) return;
        const tok = await pickOwn(P, pool, `${src.card.name}: populate (choose a creature token you control)`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (!tok) return;
        const cp = tokenCopyOf(P, tok.card); cp.tapped = true; G.attackers.push(cp.uid); if (src.atkTo !== undefined) cp.atkTo = src.atkTo;
        log(`${cp.card.name} enters tapped and attacking.`);
    }
});
