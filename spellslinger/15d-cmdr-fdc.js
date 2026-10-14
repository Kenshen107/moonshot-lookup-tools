// Engine pieces for the other four FDC Commander decks (Keen Engineering, Reign of Dragons, Tramplesaurus Rex, Wretched Ranks). Wordings: rules/cmdr.js.
// ---- Hooks the core calls ----
function cmdNoUntap(o) { return !!G && allPerms().some(a => a.attachedTo === o.uid && Rx(a).noUntapUnlessMonarch && G.monarch !== o.owner); }
function cmdFlashOk(src, spell, P) {
    const f = Rx(src).flashSpec; if (!f || src.owner !== P.i) return false;
    if (f.cond && !condOk(f.cond, P, src)) return false;
    return specMatch(f.spec, src, spell, { cast: true, P });
}
function cmdForcedAttackers(P) { return P.bf.filter(o => canAttackWith(o) && hasType(o, 'Juggernaut') && P.bf.some(a => Rx(a).juggernautsAttack && !lostAbilities(a))); }
// Look at the top n cards: you may take one that fits into your hand, the rest go to the bottom in a random order
async function digInto(P, n, fits, label, src, then) {
    const top = P.library.splice(-Math.min(n, P.library.length)).reverse(); if (!top.length) return null;
    log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
    const opts = top.filter(fits);
    let pick = null;
    if (opts.length) pick = P.isAI ? opts.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, opts, `${src.card.name}: ${label} (or none)`, { optional: true });
    if (pick) { pull(top, pick); if (then) await then(pick); else { P.hand.push(pick); log(`${P.name} ${you(P) ? 'put' : 'puts'} ${pick.card.name} into ${you(P) ? 'your' : 'their'} hand.`); } }
    shuffle(top).forEach(c => P.library.unshift(c));
    return pick;
}
// A card put into exile that its owner may play until a turn
function exilePlayable(P, x, until) { P.exile.push(x); x.playUntil = until; log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${x.card.name}; ${you(P) ? 'you' : 'they'} may play it${until === G.turn ? ' this turn' : ''}.`); }
const dragonsOf = P => P.bf.filter(x => isCreature(x) && hasType(x, 'Dragon'));
Object.assign(TRIG_FN, {
    dragonsHit: (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && hasType(x, 'Dragon')),
    packTactics: (o, ctx) => (ctx.list || []).includes(o) && ctx.list.filter(x => x.owner === o.owner).reduce((a, x) => a + Math.max(0, pow(x)), 0) >= 6
});
Object.assign(CMD, {
    // ===== Keen Engineering =====
    // Misleading Signpost: during the declare attackers step, an attacking creature may attack something else (a planeswalker or the player)
    async reselectAttack(P, e, t, src, O, name) {
        if (!G.attackers.length || !['declareBlocks', 'declareAttackers'].includes(G.phase)) return;
        const atks = G.attackers.map(onBf).filter(Boolean);
        if (!atks.length) return;
        const pick = P.isAI ? null : await pickCard(P, atks, `${name}: choose an attacking creature to send somewhere else (or none)`, { optional: true });
        if (!pick) return;
        const def = G.players[G.defender ?? opp(G.players[pick.owner]).i];
        const walkers = def.bf.filter(x => isPlaneswalker(x) || isBattle(x));
        const opts = [{ label: `${def.name}`, uid: null }, ...walkers.map(w => ({ label: w.card.name, uid: w.uid }))];
        if (opts.length === 1) { log(`${pick.card.name} has nothing else to attack.`); return; }
        const choice = await pickCard(P, [pick, ...walkers], `${name}: where does ${pick.card.name} attack? (pick the planeswalker or battle, or ${pick.card.name} to attack the player)`, { required: true });
        if (choice && choice !== pick) { pick.attackPW = choice.uid; log(`${pick.card.name} now attacks ${choice.card.name}.`); } else { delete pick.attackPW; log(`${pick.card.name} now attacks ${def.name}.`); }
    },
    // Mazemind Tome: exile it once it has four page counters
    async mazemindCheck(P, e, t, src) {
        if (onBf(src.uid) && (src.ctr.page || 0) >= 4) { log(`${src.card.name} is exiled.`); leaveBattlefield(src, 'exile'); gainLifeFor(P, 4); }
    },
    async exileOppGys(P) { oppsOf(P).forEach(X => { const n = X.gy.length; X.exile.push(...X.gy.splice(0)); log(`${X.name}'s graveyard (${n} card${n === 1 ? '' : 's'}) is exiled.`); }); },
    // ===== Reign of Dragons =====
    // Dragonhawk: exile the top X cards (X = creatures with power 4+), play them until the end step, then 2 damage to each opponent per card still exiled
    async dragonhawk(P, e, t, src) {
        const x = P.bf.filter(c => isCreature(c) && pow(c) >= 4).length;
        const cards = P.library.splice(-Math.min(x, P.library.length)).reverse();
        if (!cards.length) return;
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top ${cards.length} card${cards.length === 1 ? '' : 's'} of ${you(P) ? 'your' : 'their'} library: ${cards.map(c => c.card.name).join(', ')}.`);
        cards.forEach(c => { P.exile.push(c); c.playUntil = G.turn; });
        atEndStep(async () => {
            const left = cards.filter(c => P.exile.includes(c)).length;
            if (left > 0 && onBf(src.uid)) { oppsOf(P).forEach(F => damage(F, 2 * left, src)); log(`${src.card.name} deals ${2 * left} damage to each opponent (${left} card${left === 1 ? '' : 's'} still exiled).`); }
            cards.forEach(c => { if (P.exile.includes(c)) c.playUntil = -1; });
        });
    },
    // The Elder Dragon War: II - discard any number of cards, then draw that many
    async wheelAny(P, e, t, src, O, name) {
        const hand = P.hand.slice(); if (!hand.length) return;
        let out = [];
        if (P.isAI || AUTOPLAY) { const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length; out = hand.filter(x => (Rx(x).kind === 'land' ? lands >= 5 : Rx(x).support === 'none' || (x.card.cmc || 0) > lands + 3)); }
        else { for (let i = 0; i < hand.length; i++) { const pool = P.hand.filter(x => !out.includes(x)); if (!pool.length) break; const c = await pickCard(P, pool, `${name}: discard a card to draw a replacement (or none to stop)`, { optional: true }); if (!c) break; out.push(c); } }
        out.forEach(c => { pull(P.hand, c); P.gy.push(c); c.discardTurn = G.turn; });
        if (out.length) { noteDiscard(P, out.length); log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${out.length} card${out.length === 1 ? '' : 's'} and ${you(P) ? 'draw' : 'draws'} that many.`); drawCards(P, out.length); }
    },
    async dmgCreaturesAndOpps(P, e, t, src, O, name) { allPerms().filter(isCreature).forEach(c => damage(c, e.n, src)); oppsOf(P).forEach(F => damage(F, e.n, src)); log(`${name} deals ${e.n} damage to each creature and each opponent.`); },
    // Leyline Tyrant: when it dies, pay any amount of {R}; it deals that much damage to any target
    async leylineDies(P, e, t, src, O, name) {
        const have = (P.pool || []).filter(c => c[0] === 'R').length + P.bf.filter(x => !x.tapped && manaOf(x) && manaOf(x).colors.includes('R')).reduce((a, x) => a + (manaOf(x).n || 1), 0);
        if (!have) return;
        let n = 0;
        if (P.isAI || AUTOPLAY) n = have >= 3 ? have : 0;
        else { const r = await askNumber(P, `${name}: pay how much {R}? It deals that much damage to any target.`, 0, have, Math.min(have, 3), { card: src.card, ok: 'Pay' }); n = r || 0; }
        if (!n) return;
        const plan = planPayment(P, { ...parseCost(''), R: n }); if (!plan) return;
        plan.forEach(x => tapSource(P, x));
        const tgt = await chooseTarget(P, { target: 'any', good: false }, src, false);
        if (tgt) { damage(tgt.p || tgt.o, n, src); log(`${name} deals ${n} damage to ${targetName(tgt)}.`); }
    },
    // Minion of the Mighty (pack tactics): a Dragon from your hand enters tapped and attacking
    async minionDragon(P, e, t, src, O, name) {
        const pool = P.hand.filter(x => isCreatureCard(x.card) && /\bDragon\b/.test(x.card.type)); if (!pool.length) return;
        const pick = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: put a Dragon creature card from your hand onto the battlefield tapped and attacking (or none)`, { optional: true });
        if (!pick) return;
        putOntoBattlefield(P, pick, true); G.attackers.push(pick.uid);
        if (Rx(pick).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: pick, effects: Rx(pick).etb });
        log(`${pick.card.name} enters tapped and attacking.`);
    },
    // Nogi, Sarkhan: becomes a Dragon until end of turn
    async becomeDragon(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.tempSub = { turn: G.turn, sub: 'Dragon' };
        if (e.base) src.baseSet = { turn: G.turn, p: e.base.p, q: e.base.q };
        src.tkw.push('flying');
        log(`${src.card.name} becomes a Dragon until end of turn${e.base ? ` with base power and toughness ${e.base.p}/${e.base.q}` : ''} and gains flying.`);
    },
    async sarkhanDragon(P, e, t, src) { if (!onBf(src.uid)) return; putCounters(src, 1, P); await CMD.becomeDragon(P, {}, t, src); },
    // Sarkhan: you may behold a Dragon (control one or reveal one from hand); if you do, create a Treasure
    async beholdDragon(P, e, t, src) {
        const can = P.bf.some(x => isCreature(x) && hasType(x, 'Dragon')) || P.hand.some(x => /\bDragon\b/.test(x.card.type));
        if (!can) return;
        log(`${P.name} ${you(P) ? 'behold' : 'beholds'} a Dragon.`);
        await applyEffect(P, { t: 'artToken', n: 1, kind: 'treasure' }, null, src);
    },
    // Parapet Thrasher: choose a mode that hasn't been chosen this turn
    async parapetThrasher(P, e, t, src, O, name) {
        src.thrashModes = src.thrashModes && src.thrashModes.turn === G.turn ? src.thrashModes : { turn: G.turn, done: [] };
        const D = G.players[G.defender ?? opp(P).i];
        const avail = [0, 1, 2].filter(i => !src.thrashModes.done.includes(i) && !(i === 0 && !D.bf.some(x => /\bArtifact\b/.test(x.card.type))) && !(i === 1 && oppsOf(P).filter(F => F !== D).length === 0));
        if (!avail.length) return;
        let mode = avail[0];
        if (!(P.isAI || AUTOPLAY) && avail.length > 1) {
            const labels = ['Destroy target artifact that opponent controls', 'Deal 4 damage to each other opponent', 'Exile the top card of your library; you may play it this turn'];
            const r = await askMode(P, name, avail.map(i => labels[i])); mode = avail[r ?? 0];
        } else if (P.isAI) mode = avail.includes(2) && P.library.length ? (avail.includes(0) ? 0 : 2) : avail[0];
        src.thrashModes.done.push(mode);
        if (mode === 0) { const arts = D.bf.filter(x => /\bArtifact\b/.test(x.card.type)); const a = P.isAI ? arts.sort((x, y) => permValue(y) - permValue(x))[0] : await pickCard(P, arts, `${name}: destroy an artifact`, { required: true }) || arts[0]; log(`${a.card.name} is destroyed.`); destroy(a); }
        else if (mode === 1) { oppsOf(P).filter(F => F !== D).forEach(F => damage(F, 4, src)); log(`${name} deals 4 damage to each other opponent.`); }
        else { const c = P.library.pop(); if (c) exilePlayable(P, c, G.turn); }
    },
    // Scourge of Valkas: X damage where X is the number of Dragons you control
    async scourgeValkas(P, e, t, src) { const n = dragonsOf(P).length; if (t && n > 0) { damage(t.p || t.o, n, src); log(`${src.card.name} deals ${n} damage to ${targetName(t)}.`); } },
    // Thunderbreak Regent: 3 damage to the player who targeted a Dragon
    async damageTargeter(P, e, t, src) { const by = G.ctxRaw && G.ctxRaw.by !== undefined ? G.players[G.ctxRaw.by] : null; if (by && by.i !== P.i) { damage(by, e.n, src); log(`${src.card.name} deals ${e.n} damage to ${by.name}.`); } },
    // Orb of Dragonkind
    async orbDig(P, e, t, src) { await digInto(P, 7, x => /\bDragon\b/.test(x.card.type), 'reveal a Dragon card to put into your hand', src); },
    // Outpost Siege / Windcrag Siege: choose a word as it enters
    async chooseWord(P, e, t, src, O, name) {
        const opts = e.options;
        let pick = opts[0];
        if (!(P.isAI || AUTOPLAY)) { const r = await askMode(P, `${name}: choose one`, opts); pick = opts[r ?? 0]; }
        else if (e.aiPick) pick = e.aiPick(P);
        src.word = pick; log(`${name}: ${pick} chosen.`);
    },
    async siegeKhans(P, e, t, src) { if (src.word !== 'Khans') return; const c = P.library.pop(); if (c) exilePlayable(P, c, G.turn); },
    async siegeDragons(P, e, t, src, O, name) {
        if (src.word !== 'Dragons') return;
        const tgt = await chooseTarget(P, { target: 'any', good: false }, src, false);
        if (tgt) { damage(tgt.p || tgt.o, 1, src); log(`${name} deals 1 damage to ${targetName(tgt)}.`); }
    },
    // Breaching Dragonstorm: exile until a nonland card; cast it free if its mana value is 8 or less, else put it into your hand
    async breachingDragonstorm(P, e, t, src, O, name) {
        const seen = [];
        let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (/\bLand\b/.test(c.card.type)) { seen.push(c); continue; } hit = c; break; }
        shuffle(seen).forEach(c => P.library.unshift(c));
        if (!hit) return;
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${hit.card.name}.`);
        if ((hit.card.cmc || 0) <= 8 && Rx(hit).kind !== 'land' && Rx(hit).support !== 'none') {
            hit.freeCast = true; hit.playUntil = G.turn; P.exile.push(hit);
            try { await castSpell(P, hit); } catch (er) { /* the spell couldn't be cast */ }
            if (P.exile.includes(hit)) { pull(P.exile, hit); P.hand.push(hit); log(`${hit.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
        } else { P.hand.push(hit); log(`${hit.card.name} is put into ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async returnSelfToHand(P, e, t, src) { if (onBf(src.uid)) { log(`${src.card.name} returns to its owner's hand.`); leaveBattlefield(src, 'hand'); } },
    async breathWeapon(P, e, t, src, O, name) { allPerms().filter(c => isCreature(c) && !hasType(c, 'Dragon')).forEach(c => damage(c, e.n, src)); log(`${name} deals ${e.n} damage to each non-Dragon creature.`); },
    // Skyline Despot, Lathliss, Utvara Hellkite: Dragon tokens
    async dragonToken(P, e, t, src) { if (e.needMonarch && G.monarch !== P.i) return; await applyEffect(P, { t: 'token', n: 1, p: e.p, q: e.q, name: 'red Dragon', kw: ['flying'] }, null, src); },
    // Haven of the Spirit Dragon: return a Dragon creature card or an Ugin planeswalker card from your graveyard to your hand
    async havenReturn(P, e, t, src, O, name) {
        const pool = P.gy.filter(x => (/\bCreature\b/.test(x.card.type) && /\bDragon\b/.test(x.card.type)) || /\bUgin\b/.test(x.card.type)); if (!pool.length) return;
        const pick = P.isAI ? pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return a Dragon creature card or an Ugin planeswalker card to your hand`, { required: true }) || pool[0];
        pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Hideaway N (Spinerock Knoll, Mosswort Bridge): look at the top N, exile one face down, the rest on the bottom
    async hideaway(P, e, t, src, O, name) {
        const top = P.library.splice(-Math.min(e.n, P.library.length)).reverse(); if (!top.length) return;
        log(`${P.name} ${you(P) ? 'look' : 'looks'} at the top ${top.length} cards${you(P) ? `: ${top.map(x => x.card.name).join(', ')}` : ''}.`);
        const pick = P.isAI ? top.slice().sort((a, b) => aiKeepValue(P, b) - aiKeepValue(P, a))[0] : await pickCard(P, top, `${name}: exile a card face down (hideaway)`, { required: true }) || top[0];
        pull(top, pick); src.hidden = pick; log(`${name} hides a card.`);
        shuffle(top).forEach(c => P.library.unshift(c));
    },
    async hideawayPlay(P, e, t, src, O, name) {
        const c = src.hidden; if (!c || !condOk(e.cond, P, src)) return;
        src.hidden = null;
        if (Rx(c).kind === 'land') { P.landsPlayed = Math.max(0, P.landsPlayed - 1); await playLand(P, c); return; }
        c.freeCast = true; c.playUntil = G.turn; P.exile.push(c);
        try { await castSpell(P, c); } catch (er) { /* */ }
        if (P.exile.includes(c)) { pull(P.exile, c); P.hand.push(c); }
    },
    // Tramplesaurus Rex
    async arachnogenesis(P, e, t, src, O, name) {
        const n = G.attackers.map(onBf).filter(a => a && a.owner !== P.i).length;
        if (n > 0) await applyEffect(P, { t: 'token', n, p: 1, q: 2, name: 'green Spider', kw: ['reach'] }, null, src);
        G.fogNonType = { turn: G.turn, type: 'Spider' };
        log(`${name}: all combat damage from non-Spider creatures is prevented this turn.`);
    },
    async ezuriPredation(P, e, t, src, O, name) {
        const theirs = allPerms().filter(c => isCreature(c) && c.owner !== P.i);
        for (const c of theirs) {
            await applyEffect(P, { t: 'token', n: 1, p: 4, q: 4, name: 'green Phyrexian Beast', kw: [] }, null, src);
            const tok = G.lastMade; if (!tok || !onBf(c.uid)) continue;
            log(`${tok.card.name} fights ${c.card.name}.`); damage(c, pow(tok), tok); damage(tok, pow(c), c);
        }
    },
    async lootDig(P, e, t, src) { const lands = P.bf.filter(x => /\bLand\b/.test(x.card.type)).length; await digInto(P, 6, x => isCreatureCard(x.card) && (x.card.cmc || 0) <= lands, 'reveal a creature card to put onto the battlefield', src, async pick => { putOntoBattlefield(P, pick); if (Rx(pick).etb.length) (G.trigQ = G.trigQ || []).push({ P, o: pick, effects: Rx(pick).etb }); }); },
    async hammerskullStun(P, e, t, src) { if (!P.bf.some(x => x !== src && isCreature(x) && hasType(x, 'Dinosaur'))) { src.ctr.stun = (src.ctr.stun || 0) + 1; log(`${src.card.name} gets a stun counter.`); } },
    async scavengingOoze(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => [X, c]));
        if (!pool.length) return;
        const [X, c] = P.isAI ? (pool.find(([x, c]) => x !== P && /\bCreature\b/.test(c.card.type)) || pool.find(([x, c]) => x !== P) || pool[0]) : (() => null)() || [];
        let pickX = X, pickC = c;
        if (!P.isAI) { const card = await pickCard(P, pool.map(([x, c]) => c), `${src.card.name}: exile a card from a graveyard`, { required: true }); const hit = pool.find(([x, c]) => c === card); pickX = hit[0]; pickC = hit[1]; }
        if (!pickC) return;
        pull(pickX.gy, pickC); pickX.exile.push(pickC); log(`${pickC.card.name} is exiled from a graveyard.`);
        if (/\bCreature\b/.test(pickC.card.type) && onBf(src.uid)) { putCounters(src, 1, P); gainLifeFor(P, 1); }
    },
    async scrapshooter(P, e, t, src) { if (!src.giftPromised) return; const pool = oppsOf(P).flatMap(F => F.bf.filter(x => /\bArtifact|Enchantment\b/.test(x.card.type))); if (!pool.length) return; const a = P.isAI ? pool.sort((x, y) => permValue(y) - permValue(x))[0] : await pickCard(P, pool, `${src.card.name}: destroy an artifact or enchantment`, { required: true }) || pool[0]; log(`${a.card.name} is destroyed.`); destroy(a); },
    async thicketCounters(P, e, t, src) { if (t && t.o && onBf(t.o.uid)) { const n = Math.max(0, pow(t.o)); putCounters(t.o, n, P); log(`${t.o.card.name} gets ${n} +1/+1 counters.`); } },
    async thicketDraw(P) { const best = Math.max(0, ...allPerms().filter(isCreature).map(pow)); if (P.bf.some(c => isCreature(c) && pow(c) === best)) drawCards(P, 2); },
    async whiptongue(P, e, t, src) {
        const fly = allPerms().filter(c => isCreature(c) && has(c, 'flying') && !has(c, 'indestructible'));
        let k = 0; fly.forEach(c => { dieOrLeave(c, 'gy'); k++; });
        if (k && onBf(src.uid)) { putCounters(src, k, P); log(`${src.card.name} gets ${k} +1/+1 counter${k === 1 ? '' : 's'}.`); }
    },
    async onslaught(P, e, t, src, O, name) {
        const x = src.castPow !== undefined ? src.castPow : Math.max(0, ...P.bf.filter(isCreature).map(pow));
        const theirs = allPerms().filter(isCreature).filter(c => c.owner !== P.i);
        let left = x;
        const targets = P.isAI ? theirs.sort((a, b) => creatureValue(b) - creatureValue(a)) : theirs;
        for (const c of targets) { if (left <= 0) break; const need = Math.max(1, tou(c) - c.dmg); const give = Math.min(left, need); if (give < need && c !== targets[targets.length - 1]) continue; damage(c, give, src); left -= give; log(`${name} deals ${give} damage to ${c.card.name}.`); }
    }
});
// ===== Wretched Ranks and the rest =====
Object.assign(CMD, {
    async zombieHalf(P, e, t, src) { const n = Math.floor(P.bf.filter(x => isCreature(x) && hasType(x, 'Zombie')).length / 2); if (n > 0) await applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'black Zombie', kw: [] }, null, src); },
    async museZombies(P) { const n = P.bf.filter(x => isCreature(x) && hasType(x, 'Zombie')).length; if (n > 0) { drawCards(P, n); P.life -= n; log(`${P.name} ${you(P) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P, n }); } },
    async bontuSac(P, e, t, src, O, name) {
        const pool = P.bf.filter(x => x !== src);
        let chosen = [];
        if (P.isAI || AUTOPLAY) chosen = pool.filter(x => x.token || (/\bLand\b/.test(x.card.type) && P.bf.filter(l => /\bLand\b/.test(l.card.type)).length > 6)).slice(0, 3);
        else { for (;;) { const rest = pool.filter(x => !chosen.includes(x)); if (!rest.length) break; const c = await pickCard(P, rest, `${name}: sacrifice another permanent to draw a card (${chosen.length} chosen; cancel to stop)`, { optional: true }); if (!c) break; chosen.push(c); } }
        chosen.forEach(c => { log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); });
        if (chosen.length) drawCards(P, chosen.length);
    },
    // God-Eternal Bontu: when she dies or is exiled from the battlefield, put her third from the top of her owner's library
    async bontuLibrary(P, e, t, src, O, name) {
        const own = G.players[src.realOwner ?? src.owner];
        const zone = own.gy.includes(src) ? 'gy' : own.exile.includes(src) ? 'exile' : null;
        if (!zone) return;
        if (!(P.isAI || await askYes(P, `${name}: put her into your library third from the top?`, { card: src.card, yes: 'Third from the top', no: 'Leave her' }))) return;
        pull(own[zone], src); resetObj(src);
        own.library.splice(Math.max(0, own.library.length - 2), 0, src);
        log(`${name} is put into ${you(own) ? 'your' : `${own.name}'s`} library third from the top.`);
    },
    async zombiesMenace(P) { allPerms().filter(x => isCreature(x) && hasType(x, 'Zombie')).forEach(x => x.tkw.push('menace')); log('All Zombies gain menace until end of turn.'); },
    async mutilate(P, e, t, src, O, name) {
        const k = P.bf.filter(x => hasType(x, 'Swamp')).length;
        if (k > 0) await applyEffect(P, { t: 'allPump', p: -k, q: -k }, null, src);
    },
    async necroticHex(P, e, t, src, O, name) {
        for (const X of G.players.filter(y => !y.out)) {
            for (let k = 0; k < 6; k++) {
                const cs = X.bf.filter(isCreature); if (!cs.length) break;
                const c = X.isAI || AUTOPLAY ? cs.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : (await pickCard(X, cs, `${name}: sacrifice a creature (${k + 1} of 6)`, { required: true })) || cs[0];
                log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy');
            }
        }
        await applyEffect(P, { t: 'token', n: 6, p: 2, q: 2, name: 'black Zombie', kw: [], tapped: true }, null, src);
    },
    async regrowCreature(P, e, t, src, O, name) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type)); if (!pool.length) return;
        const pick = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return a creature card from your graveyard to your hand (or none)`, { optional: true });
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async zulAshur(P, e, t, src, O, name) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type) && /\bZombie\b/.test(x.card.type)); if (!pool.length) return;
        const pick = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: you may cast a Zombie creature card from your graveyard this turn`, { required: true }) || pool[0];
        pick.gyCastTurn = G.turn; log(`${P.name} ${you(P) ? 'may' : 'may'} cast ${pick.card.name} from ${you(P) ? 'your' : 'their'} graveyard this turn.`);
    },
    async cemeteryRecruit(P, e, t, src, O, name) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type)); if (!pool.length) return;
        const pick = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return a creature card from your graveyard to your hand`, { required: true }) || pool[0];
        pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
        if (hasType(pick, 'Zombie')) drawCards(P, 1);
    },
    async consumedByGreed(P, e, t, src, O, name) {
        const promised = !!src.giftPromised; await giftDraw(P, src);
        await applyEffect(P, { t: 'edictGreatest' }, null, src);
        if (promised) await CMD.cemeteryRecruitPlain(P, e, t, src, O, name);
    },
    async cemeteryRecruitPlain(P, e, t, src, O, name) {
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type)); if (!pool.length) return;
        const pick = P.isAI ? pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await pickCard(P, pool, `${name}: return a creature card from your graveyard to your hand`, { required: true }) || pool[0];
        pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`);
    },
    async consumingCorruption(P, e, t, src, O, name) { const x = P.bf.filter(c => hasType(c, 'Swamp')).length; if (t && t.o && x > 0) { damage(t.o, x, src); gainLifeFor(P, x); log(`${name} deals ${x} damage to ${t.o.card.name}.`); } },
    async noxiousGhoul(P) { allPerms().filter(c => isCreature(c) && !hasType(c, 'Zombie')).forEach(c => { c.tp -= 1; c.tq -= 1; }); log('All non-Zombie creatures get -1/-1 until end of turn.'); },
    async syphonFlesh(P, e, t, src, O, name) {
        let n = 0;
        for (const X of oppsOf(P)) { const cs = X.bf.filter(isCreature); if (!cs.length) continue; const c = X.isAI || AUTOPLAY ? cs.slice().sort((a, b) => creatureValue(a) - creatureValue(b))[0] : (await pickCard(X, cs, `${name}: sacrifice a creature`, { required: true })) || cs[0]; log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${c.card.name}.`); fire('sacrificed', { o: c }); dieOrLeave(c, 'gy'); n++; }
        if (n > 0) await applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'black Zombie', kw: [] }, null, src);
    },
    async gisaTokens(P, e, t, src) { const n = G.lastSacPow || 0; if (n > 0) await applyEffect(P, { t: 'token', n, p: 2, q: 2, name: 'black Zombie', kw: [] }, null, src); },
    async commanderLifelink(P, e, t) { if (t && t.o) { t.o.tkw.push('lifelink'); log(`${t.o.card.name} gains lifelink until end of turn.`); } }
});
// entersWithGy: Diregraf Colossus enters with a +1/+1 counter for each Zombie card in your graveyard
const _cmdEntersHooksBase = cmdEntersHooks;
cmdEntersHooks = function (x) {
    _cmdEntersHooksBase(x);
    const w = x && Rx(x).entersWithGy;
    if (w && onBf(x.uid)) { const n = G.players[x.owner].gy.filter(c => hasType(c, w)).length; if (n > 0) { x.counters += n; log(`${x.card.name} enters with ${n} +1/+1 counter${n === 1 ? '' : 's'}.`); } }
};
Object.assign(CMD, {
    // Hit the Mother Lode: after discovering, tapped Treasures equal to 10 minus the discovered card's mana value
    async discoverTreasure(P, e, t, src) { const mv = G.lastDiscoverMv; if (mv !== null && mv !== undefined && mv < 10) await applyEffect(P, { t: 'artToken', n: 10 - mv, kind: 'treasure', tapped: true }, null, src); }
});
TRIG_FN.foeAttacksMany = (o, ctx) => (ctx.list || []).length >= 2 && ctx.list[0].owner !== o.owner;
Object.assign(CMD, {
    // Firemane Commando: another player who attacks with two or more creatures draws a card if none of them attacked you
    async commandoDraw(P, e, t, src) {
        const atk = G.attackers.map(onBf).filter(Boolean)[0]; if (!atk || atk.owner === P.i) return;
        if (G.defender === P.i || G.players.length === 2) return;
        const A = G.players[atk.owner]; drawCards(A, 1); log(`${A.name} ${you(A) ? 'draw' : 'draws'} a card (${src.card.name}).`);
    }
});
