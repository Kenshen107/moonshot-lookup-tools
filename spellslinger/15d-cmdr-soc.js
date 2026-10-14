// Engine pieces for the Secrets of Strixhaven Commander precons (SOC). Wordings: rules/soc.js.
// Prepared: a creature that "becomes prepared" lets its owner cast a copy of its back spell (the activated ability `needPrepared`, built in rulesFor).
const landsOf = X => X.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
const nonlandCard = x => !/\bLand\b/.test((x.card || x).type); // takes an object or a card
// Add a subtype / make a noncreature card a creature of a subtype: "Artifact" -> "Artifact Creature — Spirit"
function typeWith(type, sub, makeCreature) {
    let [left, right] = type.split(' — ');
    if (makeCreature && !/\bCreature\b/.test(left)) left += ' Creature';
    const subs = right ? right.split(' ') : [];
    if (!subs.includes(sub)) subs.push(sub);
    return `${left} — ${subs.join(' ')}`;
}
// A card was put into exile from a library or graveyard (Laelia)
function exiledOwn(P) { fire('exiledOwn', { P }); }
// A player picks one of their own cards (the computer takes the best by `rank`); null when none or when they decline an optional pick
async function pickOwn(P, pool, title, opts = {}) {
    if (!pool.length) return null;
    if (P.isAI || AUTOPLAY) return pool.slice().sort(opts.rank || ((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)))[0];
    return (await pickCard(P, pool, title, opts.optional ? { optional: true } : { required: true })) || (opts.optional ? null : pool[0]);
}
// An opponent chooses what to sacrifice / exile from a pool: the computer gives up the least valuable
async function chooseFrom(X, pool, title, optional) {
    if (!pool.length) return null;
    if (X.isAI || AUTOPLAY) return pool.slice().sort((a, b) => (a.token ? -5 : 0) + permValue(a) - ((b.token ? -5 : 0) + permValue(b)))[0];
    return (await pickCard(X, pool, title, optional ? { optional: true } : { required: true })) || (optional ? null : pool[0]);
}
Object.assign(CMD_SCORE, { levelUp: () => 5, prepare: () => 3 });
Object.assign(CMD, {
    prepare(P, e, t, src) {
        if (!src || !onBf(src.uid) || !Rx(src).preparedSpell || src.prepared) return;
        src.prepared = true; log(`${src.card.name} becomes prepared.`);
    },
    levelUp(P, e, t, src) { src.level = e.lvl; log(`${src.card.name} becomes level ${e.lvl}.`); },
    // Advanced Reconstruction level 1
    async advRecon(P, e, t, src) {
        doMill(P, 1);
        if (!P.gy.length) return;
        const x = P.gy[rand(P.gy.length)];
        pull(P.gy, x); P.exile.push(x); x.playUntil = G.turn; x.playAny = true;
        log(`${x.card.name} is exiled from ${you(P) ? 'your' : `${P.name}'s`} graveyard at random; ${you(P) ? 'you' : P.name} may play it this turn.`);
        exiledOwn(P);
    },
    // Archaeomancer's Map
    async mapLand(P, e, t, src) {
        const L = G.ctxObj; if (!L) return;
        const X = G.players[L.owner];
        if (landsOf(X) <= landsOf(P)) return;
        const pool = P.hand.filter(x => /\bLand\b/.test(x.card.type));
        const pick = await pickOwn(P, pool, `${src.card.name}: put a land card from your hand onto the battlefield`, { optional: true, rank: (a, b) => 0 });
        if (pick) putOntoBattlefield(P, pick);
    },
    // Augusta, Order Returned
    async augusta(P, e, t, src) {
        let n = 0;
        for (const X of G.players.filter(y => !y.out)) {
            if (!X.gy.length) continue;
            const pool = X.gy.slice();
            const x = X === P ? await pickOwn(P, pool, `${src.card.name}: exile a card from your graveyard`, { rank: (a, b) => (nonlandCard(b.card) - nonlandCard(a.card)) || ((b.card.cmc || 0) - (a.card.cmc || 0)) })
                : await chooseFrom(X, pool.sort((a, b) => (nonlandCard(a.card) - nonlandCard(b.card))), `${src.card.name}: exile a card from your graveyard`);
            if (!x) continue;
            pull(X.gy, x); X.exile.push(x);
            log(`${x.card.name} is exiled from ${X.name === 'You' ? 'your' : `${X.name}'s`} graveyard.`);
            exiledOwn(X);
            if (nonlandCard(x.card)) n++;
        }
        if (!n) return;
        const atk = G.attackers.map(u => onBf(u)).filter(o => o && isCreature(o));
        if (!atk.length) return;
        const mine = atk.filter(o => o.owner === P.i);
        const pick = await pickOwn(P, mine.length ? mine : atk, `${src.card.name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on target attacking creature`, { rank: (a, b) => pow(b) - pow(a) });
        if (pick) { const got = putCounters(pick, n, P); log(`${pick.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); }
    },
    // Claim Jumper
    async claimJumper(P, e, t, src) {
        for (let k = 0; k < 2; k++) {
            if (!foes(P).some(F => landsOf(F) > landsOf(P))) return;
            if (k === 0 && !(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: search for a Plains and put it onto the battlefield tapped?`, { card: src.card }))) return;
            await applyChoiceEffect(P, { t: 'fetchLand', n: 1, what: 'plains', bf: true, tapped: true }, src);
        }
    },
    // Conspiracy Theorist
    async payDiscardDraw(P, e, t, src) {
        if (!P.hand.length || !planPayment(P, parseCost('{1}'))) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: pay {1} and discard a card to draw a card?`, { card: src.card }))) return;
        if (P.isAI && P.hand.length < 2) return;
        planPayment(P, parseCost('{1}')).forEach(x => tapSource(P, x));
        const d = await pickOwn(P, P.hand, `${src.card.name}: discard a card`, { rank: (a, b) => aiKeepValue(P, a) - aiKeepValue(P, b) });
        if (!d) return;
        pull(P.hand, d); P.gy.push(d); d.discardTurn = G.turn; noteDiscard(P, 1);
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${d.card.name}.`);
        drawCards(P, 1);
    },
    // Excava, the Risen Past: a finality counter, and it's a 1/1 Spirit creature with flying in addition to its other types
    async excava(P, e, t, src) {
        const pool = P.gy.filter(x => nonlandCard(x.card) && (x.card.cmc || 0) <= 3 && /Artifact|Creature|Enchantment/.test(x.card.type) && !/\bAura\b/.test(x.card.type));
        const pick = await pickOwn(P, pool, `${src.card.name}: return a card with mana value 3 or less to the battlefield`, { optional: true });
        if (!pick) return;
        reanimateFrom(P, P, pick);
        pick.ctr.finality = 1;
        const was = pick.card;
        pick.copyOf = was;
        pick.card = { ...was, type: typeWith(was.type, 'Spirit', true), power: '1', toughness: '1', text: `Flying\n${was.text || ''}`, id: `${was.id}-spirit${uidSeq++}` };
        log(`${was.name} is a 1/1 Spirit creature with flying (finality counter).`);
    },
    // Fateful Tempest: each player votes past or present
    async fatefulTempest(P, e, t, src) {
        let past = 0, present = 0;
        for (const X of G.players.filter(y => !y.out)) {
            let v;
            if (X.isAI || AUTOPLAY) v = X === P ? (P.library.length > 12 ? 0 : 1) : (X.life > 12 ? 1 : 1);
            else v = await askMode(X, `${src.card.name}: vote for past (mill and deal damage) or present (exile and play)`, ['Past', 'Present']);
            if (v === 0) past++; else present++;
            log(`${X.name} ${you(X) ? 'vote' : 'votes'} for ${v === 0 ? 'past' : 'present'}.`);
        }
        let total = 0;
        for (let k = 0; k < past; k++) { const c = P.library.pop(); if (!c) break; P.gy.push(c); total += c.card.cmc || 0; }
        if (past) { log(`${P.name} ${you(P) ? 'mill' : 'mills'} ${past} card${past === 1 ? '' : 's'}.`); foes(P).forEach(F => damage(F, total, src)); log(`${src.card.name} deals ${total} damage to each opponent.`); }
        if (present) {
            const got = P.library.splice(Math.max(0, P.library.length - present)).reverse();
            got.forEach(x => { P.exile.push(x); x.playUntil = nextTurnOf(P); x.playAny = true; });
            log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${got.map(x => x.card.name).join(', ') || 'nothing'}; they can be played until the end of ${you(P) ? 'your' : 'their'} next turn.`);
            if (got.length) exiledOwn(P);
        }
    },
    // Guardian Scalelord
    async scalelord(P, e, t, src) {
        const X = pow(src);
        const pool = P.gy.filter(x => nonlandCard(x.card) && !['instant', 'sorcery'].includes(rulesFor(x.card).kind) && (x.card.cmc || 0) <= X);
        const pick = await pickOwn(P, pool, `${src.card.name}: return a nonland permanent card with mana value ${X} or less`, { optional: true });
        if (pick) reanimateFrom(P, P, pick);
    },
    // Guardian of Faith: any number of other target creatures you control phase out
    async guardianFaith(P, e, t, src) {
        if (P.isAI || AUTOPLAY) return;
        let pool = P.bf.filter(x => isCreature(x) && x !== src);
        for (;;) {
            if (!pool.length) break;
            const pick = await pickCard(P, pool, `${src.card.name}: phase out a creature (or stop)`, { optional: true });
            if (!pick) break;
            phaseOut(pick); pool = pool.filter(x => x !== pick);
        }
    },
    // Hofri Ghostforge
    async hofri(P, e, t, src) {
        const x = G.ctxObj; if (!x || x.token) return;
        const X = G.players[x.owner];
        if (!X.gy.includes(x)) return;
        pull(X.gy, x); X.exile.push(x);
        const was = x.card;
        const card = { ...was, id: `token-hofri-${uidSeq++}`, fullName: `${was.name} (token)`, type: typeWith(was.type, 'Spirit', false), text: `${was.text || ''}\nWhen ~ leaves the battlefield, return the exiled card to its owner's graveyard.` };
        const tok = tokenCopyOf(P, card);
        tok.hofriCard = x;
    },
    hofriReturn(P, e, t, src) {
        const x = src.hofriCard; if (!x) return;
        const X = G.players.find(y => y.exile.includes(x)); if (!X) return;
        pull(X.exile, x); G.players[x.owner].gy.push(x);
        log(`${x.card.name} returns to its owner's graveyard.`);
    },
    // Mistveil Plains
    async gyToBottom(P, e, t, src) {
        const pick = await pickOwn(P, P.gy, `${src.card.name}: put a card from your graveyard on the bottom of your library`, { rank: (a, b) => (a.card.cmc || 0) - (b.card.cmc || 0) });
        if (!pick) return;
        pull(P.gy, pick); P.library.unshift(pick);
        log(`${pick.card.name} goes on the bottom of ${you(P) ? 'your' : `${P.name}'s`} library.`);
    },
    // Perpetual Timepiece
    async shuffleGyBack(P, e, t, src) {
        let take = [];
        if (P.isAI || AUTOPLAY) take = P.gy.slice();
        else { let pool = P.gy.slice(); for (;;) { if (!pool.length) break; const pick = await pickCard(P, pool, `${src.card.name}: shuffle cards from your graveyard into your library (or stop)`, { optional: true }); if (!pick) break; take.push(pick); pool = pool.filter(x => x !== pick); } }
        take.forEach(x => { pull(P.gy, x); P.library.push(x); });
        shuffle(P.library);
        log(`${P.name} ${you(P) ? 'shuffle' : 'shuffles'} ${take.length} card${take.length === 1 ? '' : 's'} from ${you(P) ? 'your' : 'their'} graveyard into ${you(P) ? 'your' : 'their'} library.`);
    },
    spiritsDouble(P) { P.bf.filter(x => hasType(x, 'Spirit')).forEach(x => { x.tkw.push('doublestrike', 'vigilance'); }); log('Spirits you control gain double strike and vigilance until end of turn.'); },
    // Quintorius, Loremaster
    async quintoriusExile(P, e, t, src) {
        const pool = P.gy.filter(x => nonlandCard(x.card) && !/\bCreature\b/.test(x.card.type));
        const pick = await pickOwn(P, pool, `${src.card.name}: exile a noncreature, nonland card from your graveyard`, { optional: true });
        if (!pick) return;
        pull(P.gy, pick); P.exile.push(pick); src.exiledWith = [...(src.exiledWith || []), pick];
        log(`${pick.card.name} is exiled with ${src.card.name}.`);
        exiledOwn(P);
        await applyEffect(P, SPIRIT(1), null, src);
    },
    async quintoriusCast(P, e, t, src) {
        const pool = (src.exiledWith || []).filter(x => P.exile.includes(x) && Rx(x).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: cast a card exiled with it without paying its mana cost`, { optional: true });
        if (!pick) return;
        pick.bottomIfGy = true;
        await castFreeFrom(P, pick);
    },
    // Skyclave Apparition
    skyclaveExile(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        src.skyMV = x.card.cmc || 0; src.skyOwner = x.realOwner ?? x.owner;
        log(`${x.card.name} is exiled.`);
        leaveBattlefield(x, 'exile');
    },
    async skyclaveLeaves(P, e, t, src) {
        if (src.skyMV === undefined) return;
        const X = G.players[src.skyOwner];
        await applyEffect(X, { t: 'token', n: 1, p: src.skyMV, q: src.skyMV, name: 'blue Illusion', kw: [] }, null, src);
        src.skyMV = undefined;
    },
    // Spirit of Resilience
    async spiritResilience(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pool = (P.gyLeftLast || []).filter(x => /Artifact|Creature/.test(x.card.type));
        if (!pool.length) return;
        const pick = await pickOwn(P, pool, `${src.card.name}: become a copy of a card that left your graveyard (or none)`, { optional: true, rank: (a, b) => (isCreature(b) - isCreature(a)) || (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (pick) becomeCopyEOT(src, pick, { keepName: false });
    },
    // Venerable Warsinger
    async warsinger(P, e, t, src) {
        const X = (G.ctxRaw && G.ctxRaw.n) || 0;
        const pool = P.gy.filter(x => /\bCreature\b/.test(x.card.type) && (x.card.cmc || 0) <= X);
        const pick = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${X} or less`, { optional: true });
        if (pick) reanimateFrom(P, P, pick);
    },
    // Sevinne's Reclamation: a flashback cast may copy itself
    async sevinneCopy(P, e, t, src) {
        if (!src.flashedBack) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: copy it?`, { card: src.card }))) return;
        await applyEffect(P, { t: 'regrow', what: 'permanent mv3', bf: true }, null, src);
    },
    // Wave of Reckoning
    waveOfReckoning() { allPerms().filter(isCreature).forEach(c => { const n = pow(c); if (n > 0) damage(c, n, c); }); log('Each creature deals damage to itself equal to its power.'); },
    // Ceaseless Conflict
    async ceaselessConflict(P, e, t, src) {
        const all = allPerms().filter(isCreature);
        let mine = 0;
        all.forEach(c => { if (has(c, 'indestructible')) return; if (c.owner === P.i && !c.token) mine++; dieOrLeave(c, 'gy'); });
        if (mine) await applyEffect(P, SPIRIT(mine), null, src);
    },
    // Ao, the Dawn Sky
    async aoDig(P, e, t, src) {
        const seen = P.library.splice(Math.max(0, P.library.length - 7)).reverse();
        let left = 4; const take = [];
        let pool = seen.filter(x => nonlandCard(x.card) && !['instant', 'sorcery'].includes(rulesFor(x.card).kind));
        if (P.isAI || AUTOPLAY) { pool.sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)); for (const x of pool) if ((x.card.cmc || 0) <= left) { take.push(x); left -= x.card.cmc || 0; } }
        else for (;;) { pool = pool.filter(x => (x.card.cmc || 0) <= left && !take.includes(x)); if (!pool.length) break; const pick = await pickCard(P, pool, `${src.card.name}: put a nonland permanent onto the battlefield (${left} mana value left), or stop`, { optional: true }); if (!pick) break; take.push(pick); left -= pick.card.cmc || 0; }
        take.forEach(x => { pull(seen, x); putOntoBattlefield(P, x); });
        shuffle(seen).forEach(x => P.library.unshift(x));
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${take.length ? take.map(x => x.card.name).join(', ') : 'nothing'} onto the battlefield and the rest on the bottom of ${you(P) ? 'your' : 'their'} library.`);
    },
    countersCreaturesVehicles(P, e) { P.bf.filter(x => isCreature(x) || hasType(x, 'Vehicle')).forEach(x => { putCounters(x, e.n, P); }); log(`Each creature and Vehicle ${you(P) ? 'you control gets' : `${P.name} controls gets`} ${e.n} +1/+1 counters.`); },
    // Restore Relic (Lorehold Archivist's prepared spell)
    async restoreRelic(P, e, t, src) {
        const pool = P.gy.filter(x => /Artifact|Creature/.test(x.card.type));
        const pick = await pickOwn(P, pool, `${src.card.name}: exile an artifact or creature card from your graveyard`, { optional: false });
        if (!pick) return;
        pull(P.gy, pick); P.exile.push(pick);
        exiledOwn(P);
        tokenCopyOf(P, pick.card);
    },
    // Lorehold Charm
    async oppSacNontokenArtifact(P, e, t, src) {
        for (const X of foes(P)) {
            const pool = X.bf.filter(x => /\bArtifact\b/.test(x.card.type) && !x.token);
            const pick = await chooseFrom(X, pool, `${src.card.name}: sacrifice a nontoken artifact`);
            if (pick) { fire('sacrificed', { o: pick }); log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${pick.card.name}.`); dieOrLeave(pick, 'gy'); }
        }
    }
});
// The cards that left a graveyard since the last 'gyLeave' event (Spirit of Resilience)

// ===== Prismari =====
TRIG_FN.cast5Hand = (o, ctx) => !!ctx.o && ctx.o.castFromHand === G.turn && (ctx.o.card.cmc || 0) >= 5;
TRIG_FN.cast5Any = (o, ctx) => !!ctx.o && (ctx.o.card.cmc || 0) >= 5;
TRIG_FN.tokensHit = (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.token && x.owner === o.owner);
TRIG_FN.mirrorwing = (o, ctx) => !!ctx.target && ctx.target.o === o && !!G.stack.find(it => it.o === ctx.o && it.kind === 'spell');
// A copy of a spell on the stack (707.10): the same effects and X; the same target unless new ones are chosen (the computer keeps it; a person is asked)
async function copySpellItem(P, item, opts = {}) {
    const o = item.o, fx = withX(spellEffects(o), item.x);
    let target = item.target;
    const te = fx.find(needsTarget);
    if (opts.target !== undefined) target = opts.target;
    else if (te && opts.retarget) {
        const valid = validTargets(P, te, o);
        if (P.isAI || AUTOPLAY) { const pick = aiPickTarget(P, te, o, valid); if (pick) target = pick; }
        else if (valid.length > 1 && await askYes(P, `Copy of ${item.name}: choose a new target?`, { card: o.card, yes: 'New target', no: 'Same target' })) {
            const saved = G.mode; const pick = await chooseTarget(P, te, o, true); G.mode = saved; if (pick) target = pick;
        }
    }
    const cp = { id: stackSeq++, kind: 'trigger', o, P, target, effects: fx, name: `Copy of ${item.name}`, copy: true };
    G.stack.push(cp);
    log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${item.name}${target ? ` (targeting ${targetName(target)})` : ''}.`);
    return cp;
}
// Cast a copy of a card for free: the copy is a new object that ceases to exist after it resolves (707.10)
async function castCopyFree(P, card) {
    const cp = makeObj(card, P.i, {});
    cp.ceases = true; cp.copyCast = true;
    P.exile.push(cp);
    const ok = await castFreeFrom(P, cp);
    if (!ok) pull(P.exile, cp);
    return ok;
}
const burnTargetName = t => (t && t.o ? t.o.card.name : t && t.p ? t.p.name : '');
Object.assign(CMD_SCORE, { copyMySpell: () => 5, drakeArm: () => 2 });
Object.assign(CMD, {
    async populateHaste(P, e, t, src) {
        const n0 = P.bf.length;
        await applyChoiceEffect(P, { t: 'populate' }, src);
        const tok = P.bf.length > n0 ? P.bf[P.bf.length - 1] : null;
        if (!tok || !tok.token) return;
        tok.tkw.push('haste'); tok.sick = false; tok.sacAtEnd = G.turn;
        log(`${tok.card.name} gains haste and will be sacrificed at the next end step.`);
    },
    async furygale(P, e, t, src) {
        for (const F of oppsOf(P)) {
            const before = P.bf.length;
            await applyEffect(P, { t: 'token', n: 2, p: 3, q: 3, name: 'blue and red Elemental', kw: ['flying'], tkw: ['haste'] }, null, src);
            P.bf.slice(before).forEach(tk => { tk.forceAtk = G.turn; tk.forceAtkAt = F.i; tk.sick = false; });
        }
    },
    async copyMyself(P, e, t, src) { if (onBf(src.uid)) tokenCopyOf(P, src.card); },
    namedUnblockable(P, e, t, src) { P.bf.filter(c => c.card.name === src.card.name).forEach(c => c.tkw.push('unblockable')); log(`Creatures named ${src.card.name} can't be blocked this turn.`); },
    async tapTwo(P, e, t, src) {
        const pool = allPerms().filter(x => !x.tapped && !has(x, 'hexproof') && !has(x, 'shroud'));
        const picked = [];
        for (let k = 0; k < 2 && pool.length; k++) {
            const left = pool.filter(x => !picked.includes(x));
            if (!left.length) break;
            const pick = P.isAI || AUTOPLAY ? left.slice().sort((a, b) => (b.owner !== P.i) - (a.owner !== P.i) || permValue(b) - permValue(a))[0] : await pickCard(P, left, `${src.card.name}: tap target permanent (${k + 1} of 2)`, { required: true });
            if (!pick) break;
            picked.push(pick); pick.tapped = true; log(`${pick.card.name} is tapped.`);
        }
    },
    async hellkiteToken(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const x = sp ? (sp.manaSpent !== undefined ? sp.manaSpent : (sp.card.cmc || 0)) : 0;
        if (x <= 0) { log('The spell cost no mana, so the Dragon Illusion is 0/0 and dies.'); return; }
        const before = P.bf.length;
        await applyEffect(P, { t: 'token', n: 1, p: x, q: x, name: 'red Dragon Illusion', kw: ['flying'], tkw: ['haste'] }, null, src);
        P.bf.slice(before).forEach(tk => { tk.exileAtEnd = G.turn; tk.sick = false; });
    },
    async mirrorwing(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o, C = G.ctxRaw && G.ctxRaw.P;
        const item = G.stack.find(it => it.o === sp && it.kind === 'spell');
        if (!item || !C) return;
        const te = spellEffects(sp).find(needsTarget); if (!te) return;
        const others = validTargets(C, te, sp).filter(v => v.o && isCreature(v.o) && v.o !== src && v.o.owner === C.i);
        for (const v of others) await copySpellItem(C, item, { target: v });
    },
    async muddle(P, e, t, src) {
        if (!t || !t.o || !onBf(src.uid) || !onBf(t.o.uid)) return;
        becomeCopyEOT(src, t.o, { keepName: false });
        src.tkw.push('myriad');
    },
    async plargg(P, e, t, src) {
        const lists = [];
        for (const X of G.players.filter(y => !y.out)) {
            const got = []; let hit = null;
            while (X.library.length) { const c = X.library.pop(); X.exile.push(c); got.push(c); if (nonlandCard(c.card)) { hit = c; break; } }
            if (got.length) log(`${X.name} ${you(X) ? 'exile' : 'exiles'} ${got.map(c => c.card.name).join(', ')}.`);
            if (hit) lists.push({ X, hit, got });
        }
        if (P.library.length < 0) return;
        const nonland = lists.map(l => l.hit);
        if (!nonland.length) return;
        const O = foes(P)[0];
        const wrapped = nonland.map(c => ({ card: c.card, _c: c }));
        const choose = !O ? null : (O.isAI || AUTOPLAY) ? wrapped.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] : await chooseFrom(O, wrapped, `${src.card.name}: choose a nonland card exiled this way`);
        const chosen = choose ? choose._c : null;
        const rest = nonland.filter(c => c !== chosen);
        let n = 0;
        for (let k = 0; k < 2; k++) {
            const pool = rest.filter(c => G.players.some(X => X.exile.includes(c)) && Rx(c).support !== 'none' && Rx(c).kind !== 'land');
            const pick = await pickOwn(P, pool, `${src.card.name}: cast a spell without paying its mana cost (${2 - n} left)`, { optional: true });
            if (!pick) break;
            pull(rest, pick);
            const holder = G.players.find(X => X.exile.includes(pick)); if (holder) { pull(holder.exile, pick); P.exile.push(pick); }
            await castFreeFrom(P, pick); n++;
        }
    },
    async pianist(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const n = sp && (sp.card.cmc || 0) >= 5 ? 3 : 1;
        await applyEffect(P, TOKEN(n, 1, 1, 'blue and red Elemental'), null, src);
    },
    async stormsinger(P, e, t, src) {
        const mine = P.bf.filter(x => x.token && isCreature(x) && x.enteredTurn === G.turn && x.card.id && !String(x.card.id).startsWith('token-hs'));
        const copies = [];
        for (const x of mine) {
            const tok = tokenCopyOf(P, x.card);
            tok.tapped = true; tok.sacAtEnd = G.turn; if (!G.attackers.includes(tok.uid)) G.attackers.push(tok.uid);
            copies.push(tok);
        }
        if (copies.length) log(`${copies.length} tapped and attacking token cop${copies.length === 1 ? 'y' : 'ies'} (sacrificed at the end step).`);
    },
    bullPump(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const n = sp ? (sp.card.cmc || 0) : 0; if (n && onBf(src.uid)) { src.tp += n; log(`${src.card.name} gets +${n}/+0 until end of turn.`); } },
    async bullAttack(P, e, t, src) {
        const pool = P.gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind) && Rx(x).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: exile an instant or sorcery card from your graveyard and copy it`, { optional: true });
        if (!pick) return;
        pull(P.gy, pick); P.exile.push(pick); exiledOwn(P);
        log(`${pick.card.name} is exiled and copied.`);
        await castCopyFree(P, pick.card);
    },
    async rionya(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const k = (G.castKinds || {})[P.i]; const n = 1 + (k && k.turn === G.turn ? k.instant + k.sorcery : 0);
        for (let i = 0; i < n; i++) { const tok = tokenCopyOf(P, x.card); tok.tkw.push('haste'); tok.sick = false; tok.exileAtEnd = G.turn; }
    },
    async roothaToken(P, e, t, src) {
        const x = P.maxISTurn === G.turn ? P.maxIS : 0;
        const before = P.bf.length;
        await applyEffect(P, { t: 'token', n: 1, p: x, q: x, name: 'blue and red Elemental', kw: ['flying'], tkw: ['haste'] }, null, src);
        P.bf.slice(before).forEach(tk => { tk.sick = false; });
    },
    async copyMySpell(P, e, t, src) {
        if (!t || !t.item || !G.stack.includes(t.item)) return;
        await copySpellItem(P, t.item, { retarget: true });
    },
    async rousingRefrain(P, e, t, src) {
        const X = t && t.p ? t.p : foes(P)[0]; if (!X) return;
        const n = X.hand.length;
        P.pool = (P.pool || []).concat(Array(n).fill('R'));
        P.keepPoolTurn = G.turn;
        log(`${P.name} ${you(P) ? 'add' : 'adds'} ${n} {R} (it stays until end of turn).`);
        if (src.card && Rx(src).suspend) src.suspendAfter = 3;
    },
    async surgeToVictory(P, e, t, src) {
        const pool = P.gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind));
        const pick = await pickOwn(P, pool, `${src.card.name}: exile an instant or sorcery card from your graveyard`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (!pick) return;
        pull(P.gy, pick); P.exile.push(pick); exiledOwn(P);
        const n = pick.card.cmc || 0;
        P.bf.filter(isCreature).forEach(c => { c.tp += n; });
        P.surge = { turn: G.turn, card: pick.card };
        log(`Creatures you control get +${n}/+0 until end of turn; whenever one deals combat damage to a player, ${pick.card.name} is copied.`);
    },
    async surgeCopy(P, e, t, src) {
        if (!P.surge || P.surge.turn !== G.turn) return;
        await castCopyFree(P, P.surge.card);
    },
    drakeArm(P) { P.nextCastCopies = { turn: G.turn, n: commanderCasts(P) }; log(`When you next cast an instant or sorcery spell this turn, it is copied ${commanderCasts(P)} time${commanderCasts(P) === 1 ? '' : 's'}.`); },
    async copyLastCast(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const item = sp && G.stack.find(it => it.o === sp && it.kind === 'spell');
        if (!item) return;
        for (let k = 0; k < (e.n || 0); k++) await copySpellItem(P, item, { retarget: true });
    },
    async twinflame(P, e, t, src) {
        const n = 1 + (src.kickN || 0);
        let pool = P.bf.filter(isCreature); const chosen = [];
        for (let k = 0; k < n && pool.length; k++) {
            const pick = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: target creature you control (${k + 1} of ${n})`, { optional: k > 0 });
            if (!pick) break;
            chosen.push(pick); pool = pool.filter(x => x !== pick);
        }
        for (const x of chosen) { const tok = tokenCopyOf(P, x.card); tok.tkw.push('haste'); tok.sick = false; tok.exileAtEnd = G.turn; }
    },
    async salvo(P, e, t, src) {
        const first = t && t.o; const hits = [];
        if (first && onBf(first.uid)) hits.push(first);
        const te = { t: 'cmd', target: 'perm', filter: 'creature or planeswalker' };
        const valid = validTargets(P, te, src).filter(v => v.o && v.o !== first);
        if (valid.length) {
            const pick = P.isAI || AUTOPLAY ? aiPickTarget(P, { ...te, good: false }, src, valid) : await pickCard(P, valid.map(v => v.o), `${src.card.name}: another target creature or planeswalker (or none)`, { optional: true });
            const o2 = pick && (pick.o || pick);
            if (o2) hits.push(o2);
        }
        hits.forEach(x => damage(x, 6, src));
        if (hits.length) log(`${src.card.name} deals 6 damage to ${hits.map(x => x.card.name).join(' and ')}.`);
    },
    torrent(P, e, t, src) {
        const x = (G.castBy || [])[P.i] || 0;
        foes(P).forEach(F => F.bf.filter(c => isCreature(c) || isPlaneswalker(c)).forEach(c => damage(c, x, src)));
        log(`${src.card.name} deals ${x} damage to each creature and planeswalker your opponents control.`);
    },
    async treasureTarget(P, e, t, src) { const X = t && t.p ? t.p : P; makeArtifactToken(X, 'treasure'); log(`${X.name} ${you(X) ? 'create' : 'creates'} a Treasure token.`); },
    async pingOneOrTwo(P, e, t, src) {
        const hits = []; if (t) hits.push(t);
        const te = { t: 'dmg', n: 1, target: 'any' };
        const second = P.isAI || AUTOPLAY ? (() => { const v = validTargets(P, te, src).filter(x => !sameTarget(x, t)); return aiPickTarget(P, te, src, v); })() : null;
        if (second) hits.push(second);
        else if (!(P.isAI || AUTOPLAY)) { const saved = G.mode; const s2 = await chooseTarget(P, { ...te, optional: true }, src, true); G.mode = saved; if (s2 && !sameTarget(s2, t)) hits.push(s2); }
        hits.forEach(h => { damage(h.o || h.p, 1, src); });
        log(`${src.card.name} deals 1 damage to ${hits.map(burnTargetName).join(' and ')}.`);
    },
    async bounceSix(P, e, t, src) {
        let pool = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud'));
        const n = Math.min(6, pool.length); const got = [];
        for (let k = 0; k < n; k++) {
            const pick = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => ((b.owner !== P.i) - (a.owner !== P.i)) || (permValue(b) - permValue(a)))[0] : await pickCard(P, pool, `${src.card.name}: return a nonland permanent to its owner's hand (${k + 1} of ${n})`, { required: true });
            if (!pick) break;
            got.push(pick); pool = pool.filter(x => x !== pick);
        }
        got.forEach(x => { log(`${x.card.name} returns to its owner's hand.`); leaveBattlefield(x, 'hand'); });
    },
    async creativeTechnique(P, e, t, src) {
        shuffle(P.library);
        const seen = []; let hit = null;
        while (P.library.length) { const c = P.library.pop(); if (nonlandCard(c.card)) { hit = c; break; } seen.push(c); }
        shuffle(seen).forEach(c => P.library.unshift(c));
        if (!hit) return;
        P.exile.push(hit);
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${hit.card.name}.`);
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${hit.card.name} without paying its mana cost?`, { card: hit.card }))) return;
        await castFreeFrom(P, hit);
    },
    async danceWithCalamity(P, e, t, src) {
        shuffle(P.library);
        const out = []; let total = 0;
        for (;;) {
            if (!P.library.length) break;
            if (P.isAI || AUTOPLAY) { const nxt = P.library[P.library.length - 1]; if (total + (nxt.card.cmc || 0) > 13 || out.length >= 6 || total >= 9) break; }
            else if (!(await askYes(P, `${src.card.name}: exile the top card of your library? (Total mana value so far: ${total}; it must be 13 or less to cast them.)`, { card: src.card, yes: 'Exile another', no: 'Stop' }))) break;
            const c = P.library.pop(); P.exile.push(c); out.push(c); total += c.card.cmc || 0;
            log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${c.card.name} (total mana value ${total}).`);
        }
        if (total > 13) { log(`The total mana value is ${total}, more than 13: nothing is cast.`); return; }
        for (const c of out.filter(c => nonlandCard(c.card) && Rx(c).support !== 'none' && P.exile.includes(c))) {
            if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: cast ${c.card.name} without paying its mana cost?`, { card: c.card }))) continue;
            await castFreeFrom(P, c);
        }
    },
    async abstractPerformance(P, e, t, src) {
        const take = () => P.library.splice(Math.max(0, P.library.length - 4)).reverse();
        const down = take(), up = take();
        down.concat(up).forEach(c => P.exile.push(c));
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} four cards face down and four cards face up (${up.map(c => c.card.name).join(', ')}).`);
        const O = foes(P)[0];
        let giveUp; // which pile goes to the graveyard
        const val = pile => pile.reduce((a, c) => a + (c.card.cmc || 0), 0);
        if (!O) giveUp = down;
        else if (O.isAI || AUTOPLAY) giveUp = val(up) >= 4 * 2.2 ? up : down;
        else giveUp = (await askMode(O, `${src.card.name}: which pile goes to the graveyard?`, [`The face-up pile: ${up.map(c => c.card.name).join(', ')}`, 'The face-down pile'])) === 0 ? up : down;
        const keep = giveUp === up ? down : up;
        giveUp.forEach(c => { pull(P.exile, c); P.gy.push(c); });
        log(`${giveUp === up ? 'The face-up' : 'The face-down'} pile is put into the graveyard.`);
        const pool = keep.filter(c => nonlandCard(c.card) && Rx(c).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: cast a spell from among them without paying its mana cost (or none)`, { optional: true });
        if (pick) await castFreeFrom(P, pick);
        keep.filter(c => P.exile.includes(c)).forEach(c => { pull(P.exile, c); P.hand.push(c); });
        log(`${P.name} ${you(P) ? 'put' : 'puts'} the rest into ${you(P) ? 'your' : 'their'} hand.`);
    }
});

// ===== Quandrix =====
TRIG_FN.basePower0 = (o, ctx) => ctx.P.i === o.owner && (ctx.list || []).some(x => x.owner === o.owner && isCreature(x) && Number(x.card.power) === 0);
STATIC_FN.hasCounters = o => isCreature(o) && (o.counters > 0 || Object.values(o.ctr || {}).some(v => v > 0));
MANA_RIDERS.opalPalace = (P, o) => { if (o.isCommander) o.opalPalace = true; };
// A 0/0 green and blue Fractal creature token with N +1/+1 counters (the counters go on before state-based actions look at it)
async function makeFractal(P, counters, src, named) {
    const before = P.bf.length;
    await applyEffect(P, { t: 'token', n: 1, p: 0, q: 0, name: 'green and blue Fractal', kw: [], ...(named ? { named } : {}) }, null, src);
    const toks = P.bf.slice(before).filter(x => x.token);
    toks.forEach(tok => { if (counters > 0) putCounters(tok, counters, P); });
    return toks[toks.length - 1] || null;
}
// A copy of an activated ability on the stack (Unbound Flourishing)
function flourishCopyAbility(P, item) {
    const n = P.bf.filter(x => Rx(x).flourishing && !lostAbilities(x)).length;
    for (let k = 0; k < n; k++) { G.stack.push({ ...item, id: stackSeq++, name: `Copy of ${item.name}`, copy: true }); log(`${P.name} ${you(P) ? 'copy' : 'copies'} ${item.name} (Unbound Flourishing).`); }
}
Object.assign(CMD, {
    // Animist's Awakening
    async animist(P, e, t, src) {
        const seen = P.library.splice(Math.max(0, P.library.length - e.n)).reverse();
        const lands = seen.filter(x => /\bLand\b/.test(x.card.type)), rest = seen.filter(x => !lands.includes(x));
        lands.forEach(x => putOntoBattlefield(P, x, true));
        shuffle(rest).forEach(x => P.library.unshift(x));
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${seen.length} cards: ${lands.length} land${lands.length === 1 ? '' : 's'} enter${lands.length === 1 ? 's' : ''} tapped.`);
        if (e.mastery && P.gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind)).length >= 2) { lands.forEach(x => { x.tapped = false; }); log('The lands untap (spell mastery).'); }
    },
    async cornucopiaMana(P, e, t, src) {
        const n = (src.ctr && src.ctr.charge) || 0; if (!n) return;
        const col = P.isAI || AUTOPLAY ? bestPoolColor(P) : COLORS[await askMode(P, `${src.card.name}: choose a color`, COLORS.map(c => COLOR_NAMES[c] || c))] || bestPoolColor(P);
        P.pool = (P.pool || []).concat(Array(n).fill(col));
        log(`${P.name} ${you(P) ? 'add' : 'adds'} ${Array(n).fill(`{${col}}`).join('')}.`);
    },
    massBase(P, e) { P.bf.filter(isCreature).forEach(c => { c.baseSet = { turn: G.turn, p: e.n, q: e.n }; }); log(`Creatures you control have base power and toughness ${e.n}/${e.n} until end of turn.`); },
    async infiniscopeTrig(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const x = sp ? (sp.xVal || 0) : 0;
        drawCards(P, 1); gainLifeFor(P, Math.floor(x / 2));
    },
    async fractalFromSpell(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o;
        await makeFractal(P, sp ? (sp.card.cmc || 0) : 0, src);
    },
    async forgottenAncient(P, e, t, src) {
        if (P.isAI || AUTOPLAY || !onBf(src.uid) || src.counters <= 0) return;
        const n = await askNumber(P, `${src.card.name}: move how many +1/+1 counters onto another creature?`, 0, src.counters, 0, { card: src.card, ok: 'Move' });
        if (!n) return;
        const pool = P.bf.filter(x => isCreature(x) && x !== src);
        const pick = await pickCard(P, pool, `${src.card.name}: put ${n} +1/+1 counter${n === 1 ? '' : 's'} on a creature`, { optional: true });
        if (!pick) return;
        src.counters -= n; putCounters(pick, n, P); log(`${n} +1/+1 counter${n === 1 ? '' : 's'} move${n === 1 ? 's' : ''} from ${src.card.name} to ${pick.card.name}.`);
    },
    async fractalHarness(P, e, t, src) {
        const tok = await makeFractal(P, e.n, src);
        if (tok && onBf(src.uid)) { src.attachedTo = tok.uid; log(`${src.card.name} is attached to ${tok.card.name}.`); }
    },
    async kineticOoze(P, e, t, src) {
        if (t && t.o && onBf(t.o.uid)) { log(`${t.o.card.name} is destroyed.`); dieOrLeave(t.o, 'gy'); }
        if (e.n >= 5) drawCards(P, 1);
        if (e.n >= 10) {
            let pool = P.bf.filter(x => isCreature(x) && x !== src && x.counters > 0);
            if (!(P.isAI || AUTOPLAY)) { const chosen = []; for (;;) { const left = pool.filter(x => !chosen.includes(x)); if (!left.length) break; const pick = await pickCard(P, left, `${src.card.name}: double the +1/+1 counters on a creature (or stop)`, { optional: true }); if (!pick) break; chosen.push(pick); } pool = chosen; }
            pool.forEach(x => putCounters(x, x.counters, P));
        }
    },
    async latticeFractal(P, e, t, src) { await makeFractal(P, (src.ctr && src.ctr.study) || 0, src); },
    bounceSelf(P, e, t, src) { if (onBf(src.uid)) { log(`${src.card.name} returns to its owner's hand.`); leaveBattlefield(src, 'hand'); } },
    nevCounters(P, e, t, src) { const sp = G.ctxRaw && G.ctxRaw.o; const x = sp ? (sp.xVal || 0) : 0; if (x > 0 && onBf(src.uid)) { const got = putCounters(src, x, P); log(`${src.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } },
    async openTheWay(P, e, t, src) {
        const rest = []; let n = 0; const lands = [];
        while (P.library.length && n < e.n) { const c = P.library.pop(); if (/\bLand\b/.test(c.card.type)) { lands.push(c); n++; } else rest.push(c); }
        lands.forEach(x => putOntoBattlefield(P, x, true));
        shuffle(rest).forEach(x => P.library.unshift(x));
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${lands.length} land${lands.length === 1 ? '' : 's'} onto the battlefield tapped.`);
    },
    async oversimplify(P, e, t, src) {
        const power = Z(); const all = allPerms().filter(isCreature);
        all.forEach(c => { power[c.owner] += Math.max(0, pow(c)); });
        all.forEach(c => { log(`${c.card.name} is exiled.`); leaveBattlefield(c, 'exile'); });
        for (const X of G.players.filter(y => !y.out)) await makeFractal(X, power[X.i], src);
    },
    async copyXSpell(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const item = sp && G.stack.find(it => it.o === sp && it.kind === 'spell');
        if (!item) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: copy ${item.name}?`, { card: sp.card, yes: 'Copy it', no: 'No' }))) return;
        await copySpellItem(P, item, { retarget: true });
    },
    async primoFractal(P, e, t, src) {
        const list = (G.ctxRaw && G.ctxRaw.list) || [];
        const dmg = list.filter(x => x.owner === P.i && Number(x.card.power) === 0).reduce((a, x) => a + Math.max(0, pow(x)), 0);
        await makeFractal(P, dmg, src);
    },
    silkguard(P) { P.bf.filter(x => hasType(x, 'Aura') || hasType(x, 'Equipment') || (isCreature(x) && (x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0) || allPerms().some(a => a.attachedTo === x.uid)))).forEach(x => x.tkw.push('hexproof')); log('Auras, Equipment and modified creatures you control gain hexproof until end of turn.'); },
    doubleCountersOn(P, e, t, src) { const x = t && t.o; if (x && onBf(x.uid) && x.counters > 0) { const got = putCounters(x, x.counters, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'} (doubled).`); } },
    async tanazirBase(P, e, t, src) {
        if (!onBf(src.uid)) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: make the other creatures you control ${pow(src)}/${tou(src)}?`, { card: src.card }))) return;
        if (P.isAI && P.bf.filter(isCreature).every(x => x === src || pow(x) >= pow(src))) return;
        const p = pow(src), q = tou(src);
        P.bf.filter(x => isCreature(x) && x !== src).forEach(x => { x.baseSet = { turn: G.turn, p, q }; });
        log(`The other creatures you control have base power and toughness ${p}/${q} until end of turn.`);
    },
    async gooseMother(P, e, t, src) {
        const food = P.bf.filter(x => x.token && hasType(x, 'Food'));
        if (!food.length) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: sacrifice a Food to draw a card?`, { card: src.card }))) return;
        const f = food[0]; fire('sacrificed', { o: f }); dieOrLeave(f, 'gy'); log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} a Food.`);
        drawCards(P, 1);
    },
    doubleX(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; const item = sp && G.stack.find(it => it.o === sp && it.kind === 'spell');
        if (!item || item.x === undefined) return;
        item.x *= 2; sp.xVal = item.x; log(`The value of X for ${item.name} is doubled to ${item.x}.`);
    },
    async zimoneHypothesis(P, e, t, src) {
        const all = allPerms().filter(isCreature);
        if (all.length) {
            const pick = P.isAI || AUTOPLAY ? null : await pickCard(P, all, `${src.card.name}: put a +1/+1 counter on a creature (or none)`, { optional: true });
            if (pick) putCounters(pick, 1, P);
        }
        const odd = all.filter(c => pow(c) % 2 !== 0).map(c => (c.owner === P.i ? -1 : 1) * (permValue(c))).reduce((a, b) => a + b, 0);
        const even = all.filter(c => pow(c) % 2 === 0).map(c => (c.owner === P.i ? -1 : 1) * (permValue(c))).reduce((a, b) => a + b, 0);
        const choice = P.isAI || AUTOPLAY ? (odd >= even ? 0 : 1) : await askMode(P, `${src.card.name}: return each creature with odd or even power`, ['Odd power', 'Even power']);
        const hit = allPerms().filter(c => isCreature(c) && (pow(c) % 2 !== 0) === (choice === 0));
        hit.forEach(c => { log(`${c.card.name} returns to its owner's hand.`); leaveBattlefield(c, 'hand'); });
    },
    async primoIndivisible(P, e, t, src) { await makeFractal(P, landsOf(P), src, 'Primo, the Indivisible'); },
    async zimoneLand(P, e, t, src) {
        const pool = P.hand.filter(x => /\bLand\b/.test(x.card.type));
        const pick = await pickOwn(P, pool, `${src.card.name}: put a land card from your hand onto the battlefield tapped`, { optional: true, rank: () => 0 });
        if (pick) putOntoBattlefield(P, pick, true);
    },
    async insightDraw(P, e, t, src) { const X = t && t.p ? t.p : P; drawCards(X, e.n + commanderCasts(X)); },
    async proliferateX(P, e, t, src) { for (let k = 0; k < e.n; k++) await applyEffect(P, { t: 'proliferate' }, null, src); },
    bounceAll(P, e) {
        allPerms().filter(c => isCreature(c) && (e.what === 'token' ? c.token : !c.token)).forEach(c => { log(`${c.card.name} returns to its owner's hand.`); leaveBattlefield(c, 'hand'); });
    },
    async shuffleBack3(P, e, t, src) {
        const X = t && t.p ? t.p : P;
        let take = [];
        if (X.isAI || AUTOPLAY) take = X.gy.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0)).slice(0, X === P ? 0 : 3);
        else { let pool = X.gy.slice(); for (let k = 0; k < 3 && pool.length; k++) { const pick = await pickCard(X, pool, `${src.card.name}: shuffle up to three cards from your graveyard into your library (or stop)`, { optional: true }); if (!pick) break; take.push(pick); pool = pool.filter(x => x !== pick); } }
        if (X.isAI && X === P) take = X.gy.slice(0, 3);
        take.forEach(x => { pull(X.gy, x); X.library.push(x); });
        shuffle(X.library);
        log(`${X.name} ${you(X) ? 'shuffle' : 'shuffles'} ${take.length} card${take.length === 1 ? '' : 's'} into ${you(X) ? 'your' : 'their'} library.`);
    },
    async moveCounters(P, e, t, src) {
        const from = t && t.o; if (!from) return;
        const pool = P.bf.filter(x => x !== from && !/\bLand\b/.test(x.card.type));
        const to = await pickOwn(P, pool, `${src.card.name}: move all counters onto another nonland permanent you control`, { rank: (a, b) => permValue(b) - permValue(a) });
        if (!to) return;
        const n = from.counters; from.counters = 0; if (n > 0) to.counters += n;
        Object.keys(from.ctr || {}).forEach(k => { if (from.ctr[k] > 0 && k !== 'loyalty') { to.ctr[k] = (to.ctr[k] || 0) + from.ctr[k]; from.ctr[k] = 0; } });
        log(`All counters move from ${from.card.name} to ${to.card.name}.`);
    },
    async removeCountersDraw(P, e, t, src) {
        const x = t && t.o; if (!x) return;
        let n = Math.max(0, x.counters); x.counters = 0;
        Object.keys(x.ctr || {}).forEach(k => { if (x.ctr[k] > 0 && k !== 'loyalty') { n += x.ctr[k]; x.ctr[k] = 0; } });
        log(`${n} counter${n === 1 ? '' : 's'} removed from ${x.card.name}.`);
        if (n) drawCards(P, n);
    }
});
Object.assign(CMD, {
    async silkguardCounters(P, e, t, src) {
        let pool = P.bf.filter(isCreature); const chosen = [];
        for (let k = 0; k < e.n && pool.length; k++) {
            const pick = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => creatureValue(b) - creatureValue(a))[0] : await pickCard(P, pool, `${src.card.name}: put a +1/+1 counter on a creature (${k + 1} of up to ${e.n}) - or stop`, { optional: true });
            if (!pick) break; chosen.push(pick); pool = pool.filter(x => x !== pick);
        }
        chosen.forEach(x => putCounters(x, 1, P));
        if (chosen.length) log(`${chosen.map(x => x.card.name).join(', ')} each get a +1/+1 counter.`);
    },
    // Yavimaya Bloomsage: a +1/+1 counter on target creature; if it then has power 7 or greater, ~ becomes prepared
    bloomsage(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        putCounters(x, 1, P);
        if (pow(x) >= 7) CMD.prepare(P, e, t, src);
    },
    // Channel (Yavimaya Bloomsage's prepared spell): until end of turn you may pay 1 life for {C} whenever you could activate a mana ability
    channel(P) { P.channelTurn = G.turn; log(`Until end of turn, ${you(P) ? 'you' : P.name} may pay 1 life to add {C} any time a mana ability could be activated.`); }
});

// ===== Silverquill =====
const isAuraLike = x => hasType(x, 'Aura') || !!x.bestowed;
const gAttackDefender = atkIdx => (G.defender != null ? G.defender : G.players.length === 2 ? 1 - atkIdx : null);
TRIG_FN.breena = (o, ctx) => {
    const a = (ctx.list || [])[0]; if (!a || a.owner === o.owner) return false;
    const d = gAttackDefender(a.owner); if (d == null || d === o.owner) return false;
    return foes(G.players[o.owner]).some(F => F.i !== d && G.players[d].life > F.life);
};
TRIG_FN.calligrapher = (o, ctx) => { const a = (ctx.list || [])[0]; if (!a) return false; const d = gAttackDefender(a.owner); return d != null && d !== o.owner; };
TRIG_FN.attackedByTwo = (o, ctx) => { const l = (ctx.list || []).filter(x => x.owner !== o.owner); return l.length >= 2 && gAttackDefender(l[0].owner) === o.owner; };
TRIG_FN.enchantedAttack = (o, ctx) => (ctx.list || []).some(x => x.owner === o.owner && allPerms().some(a => a.attachedTo === x.uid && a.owner === o.owner && isAuraLike(a)));
TRIG_FN.enchantedDies = (o, ctx) => { const n = allPerms().filter(a => a.attachedTo === ctx.o.uid && a.owner === o.owner && isAuraLike(a)).length; const any = allPerms().some(a => a.attachedTo === ctx.o.uid && isAuraLike(a)); if (!any) return false; ctx.o._hatefulN = n; return true; };
TRIG_FN.auraOnModified = (o, ctx) => { const t = ctx.target; const x = t && t.o; return !!x && x.owner === o.owner && (x.counters > 0 || Object.values(x.ctr || {}).some(v => v > 0) || allPerms().some(a => a.attachedTo === x.uid)); };
COUNT_EXTRA.push([/^(?:the number of )?instant and sorcery cards in your graveyard$/, () => o => G.players[o.owner].gy.filter(x => ['instant', 'sorcery'].includes(Rx(x).kind)).length]);
COUNT_EXTRA.push([/^the number of Auras you control that are attached to a creature$/, () => o => G.players[o.owner].bf.filter(x => isAuraLike(x) && x.attachedTo && isCreature(onBf(x.attachedTo) || {})).length]);
// An Aura (or Equipment) put onto the battlefield attaches to a creature its controller picks (the computer picks its best creature)
async function attachTo(P, aura, label) {
    const pool = allPerms().filter(isCreature);
    const pick = await pickOwn(P, pool.filter(x => x.owner === P.i).length && (P.isAI || AUTOPLAY) ? pool.filter(x => x.owner === P.i) : pool, label || `${aura.card.name}: attach to a creature`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
    if (pick) { aura.attachedTo = pick.uid; log(`${aura.card.name} is attached to ${pick.card.name}.`); }
    return pick;
}
// Cast a card without paying its mana cost, choosing a target first when it needs one
async function castFreeAuto(P, c) {
    const te = firstTargetEffect(c);
    let target;
    if (te) {
        const valid = validTargets(P, te, c); if (!valid.length) return false;
        target = P.isAI || AUTOPLAY ? aiPickTarget(P, te, c, valid) : (() => null)();
        if (!target && !(P.isAI || AUTOPLAY)) { const saved = G.mode; target = await chooseTarget(P, te, c, true); G.mode = saved; }
        if (!target) return false;
    }
    return castFreeFrom(P, c, target);
}
Object.assign(CMD_SCORE, { lighthouse: () => 0 });
Object.assign(CMD, {
    async ghoulishReturn(P, e, t, src) {
        atEndStep(async () => {
            const X = G.players[src.owner];
            if (!X.gy.includes(src)) return;
            const pool = allPerms().filter(isCreature); if (!pool.length) return;
            putOntoBattlefield(X, src); await attachTo(X, src);
        }, `${src.card.name} will return at the beginning of the next end step.`);
    },
    martialImpetus(P, e, t, src) { const host = onBf(src.attachedTo); G.attackers.map(u => onBf(u)).filter(x => x && x.owner === P.i && x !== host && isCreature(x)).forEach(x => { x.tp += 1; x.tq += 1; }); log('Each other attacking creature gets +1/+1 until end of turn.'); },
    async replicateAura(P, e, t, src) {
        const n = src.kickN || 0;
        for (let k = 0; k < n; k++) {
            const tok = tokenCopyOf(P, src.card);
            await attachTo(P, tok, `${src.card.name} (replicate): attach the copy to a creature`);
        }
    },
    async reanimateHost(P, e, t, src) { const x = G.ctxObj; if (!x) return; const X = G.players.find(y => y.gy.includes(x)); if (X) reanimateFrom(P, X, x); },
    async annihilator(P, e, t, src) {
        const host = onBf(src.attachedTo) || src; const D = gAttackDefender(host.owner) != null ? G.players[gAttackDefender(host.owner)] : opp(G.players[host.owner]);
        for (let k = 0; k < e.n; k++) { const pool = D.bf.slice(); const pick = await chooseFrom(D, pool, `${src.card.name}: sacrifice a permanent (annihilator ${e.n})`); if (!pick) break; fire('sacrificed', { o: pick }); log(`${D.name} ${you(D) ? 'sacrifice' : 'sacrifices'} ${pick.card.name} (annihilator).`); dieOrLeave(pick, 'gy'); }
    },
    async ajaniChosen(P, e, t, src) {
        const ench = G.ctxObj;
        const before = P.bf.length;
        await applyEffect(P, TOKEN(1, 2, 2, 'white Cat'), null, src);
        const tok = P.bf.length > before ? P.bf[P.bf.length - 1] : null;
        if (tok && ench && onBf(ench.uid) && isAuraLike(ench) && (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: attach ${ench.card.name} to the Cat token?`, { card: ench.card }))) { ench.attachedTo = tok.uid; log(`${ench.card.name} is attached to ${tok.card.name}.`); }
    },
    lighthouse(P) { G.noHexproof = { turn: G.turn, by: P.i }; log('Creatures your opponents control lose hexproof and shroud this turn.'); },
    async skyhunter(P, e, t, src) {
        const seen = P.library.splice(Math.max(0, P.library.length - 6)).reverse();
        const pool = seen.filter(x => hasType(x, 'Aura') || hasType(x, 'Equipment'));
        const pick = await pickOwn(P, pool, `${src.card.name}: put an Aura or Equipment onto the battlefield (or none)`, { optional: true });
        if (pick) {
            pull(seen, pick); putOntoBattlefield(P, pick);
            if (hasType(pick, 'Aura')) await attachTo(P, pick);
            else if (P.bf.some(isCreature) && (P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: attach ${pick.card.name} to a creature?`, { card: pick.card }))) { const c = await pickOwn(P, P.bf.filter(isCreature), `${pick.card.name}: attach to a creature`, { rank: (a, b) => creatureValue(b) - creatureValue(a) }); if (c) pick.attachedTo = c.uid; }
        }
        shuffle(seen).forEach(x => P.library.unshift(x));
    },
    async breena(P, e, t, src) {
        const a = G.ctxRaw && G.ctxRaw.list && G.ctxRaw.list[0]; const A = a ? G.players[a.owner] : null;
        if (A) drawCards(A, 1);
        const pool = P.bf.filter(isCreature);
        const pick = await pickOwn(P, pool, `${src.card.name}: put two +1/+1 counters on a creature you control`, { rank: (x, y) => creatureValue(y) - creatureValue(x) });
        if (pick) putCounters(pick, 2, P);
    },
    async calligrapherToken(P, e, t, src) {
        const a = G.ctxRaw && G.ctxRaw.list && G.ctxRaw.list[0]; const A = a ? G.players[a.owner] : P;
        await applyEffect(A, { t: 'token', n: 1, p: 2, q: 1, name: 'white and black Inkling', kw: ['flying'], tapped: true, attacking: true }, null, src);
    },
    erietteDrain(P, e, t, src) {
        const n = P.bf.filter(isAuraLike).length; if (!n) return;
        foes(P).forEach(F => { F.life -= n; F.lostTurn = G.turn; fire('loseLife', { P: F, n }); }); gainLifeFor(P, n);
        log(`Each opponent loses ${n} life and ${P.name} gains ${n}.`);
    },
    async filibuster(P, e, t, src) {
        const before = P.bf.length;
        await applyEffect(P, INKLING(1), null, src);
        const tok = P.bf.length > before ? P.bf[P.bf.length - 1] : null; if (!tok) return;
        const pool = P.gy.filter(x => hasType(x, 'Aura') || hasType(x, 'Equipment'));
        const pick = await pickOwn(P, pool, `${src.card.name}: return an Aura or Equipment card to the battlefield attached to the Inkling (or none)`, { optional: true });
        if (pick) { reanimateFrom(P, P, pick); pick.attachedTo = tok.uid; log(`${pick.card.name} is attached to ${tok.card.name}.`); }
    },
    hatefulDraw(P, e, t, src) { const x = G.ctxObj; const n = x && x._hatefulN || 0; if (n) drawCards(P, n); },
    async heraldOfAmity(P, e, t, src) {
        const seen = P.library.splice(Math.max(0, P.library.length - 8)).reverse();
        seen.forEach(c => P.exile.push(c));
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} the top ${seen.length} cards: ${seen.map(c => c.card.name).join(', ')}.`);
        const pool = seen.filter(x => hasType(x, 'Aura') && Rx(x).support !== 'none');
        const pick = await pickOwn(P, pool, `${src.card.name}: cast an Aura spell without paying its mana cost (or none)`, { optional: true });
        if (pick) await castFreeAuto(P, pick);
        seen.filter(c => P.exile.includes(c)).forEach(c => { pull(P.exile, c); P.library.unshift(c); });
        shuffle(P.library.slice(0, 0));
    },
    inkshield(P) { P.inkshield = G.turn; log(`All combat damage that would be dealt to ${you(P) ? 'you' : P.name} this turn is prevented; each 1 damage makes an Inkling.`); },
    counterOnTarget(P, e, t) { if (t && t.o && onBf(t.o.uid)) putCounters(t.o, 1, P); },
    async keenDuelist(P, e, t, src) {
        const X = t && t.p; if (!X) return;
        const a = P.library.pop(), b = X.library.pop();
        const va = a ? a.card.cmc || 0 : 0, vb = b ? b.card.cmc || 0 : 0;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${a ? a.card.name : 'nothing'}; ${X.name} ${you(X) ? 'reveal' : 'reveals'} ${b ? b.card.name : 'nothing'}.`);
        P.life -= vb; X.life -= va; P.lostTurn = G.turn; X.lostTurn = G.turn;
        if (vb) fire('loseLife', { P, n: vb }); if (va) fire('loseLife', { P: X, n: va });
        if (a) P.hand.push(a); if (b) X.hand.push(b);
    },
    tapAndGoad(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; x.tapped = true; goad(x, P.i, nextTurnOf(P)); log(`${x.card.name} is tapped and goaded.`); },
    tomikDrain(P, e, t, src) { const a = G.ctxRaw && G.ctxRaw.list && G.ctxRaw.list[0]; const A = a ? G.players[a.owner] : opp(P); A.life -= 3; A.lostTurn = G.turn; fire('loseLife', { P: A, n: 3 }); log(`${A.name} loses 3 life.`); drawCards(P, 1); },
    async nilsCounters(P, e, t, src) {
        for (const X of G.players.filter(y => !y.out)) {
            const pool = X.bf.filter(isCreature); if (!pool.length) continue;
            let pick;
            if (P.isAI || AUTOPLAY) pick = pool.slice().sort((a, b) => (X === P ? creatureValue(b) - creatureValue(a) : pow(b) - pow(a)))[0];
            else pick = await pickCard(P, pool, `${src.card.name}: put a +1/+1 counter on up to one creature ${X.name === 'You' ? 'you control' : `${X.name} controls`}`, { optional: true });
            if (pick) putCounters(pick, 1, P);
        }
    },
    reverieDraw(P) { const n = P.bf.filter(x => isAuraLike(x) && x.attachedTo && onBf(x.attachedTo) && isCreature(onBf(x.attachedTo))).length; if (n) drawCards(P, n); },
    async scrivContract(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        const card = { id: `token-contract-${uidSeq}`, name: 'Contract', fullName: 'Contract token', cost: '', cmc: 0, type: 'Token Enchantment — Aura', text: 'Enchant creature\nCONTRACT', colors: ['W'], ci: ['W'], img: null };
        const tok = makeObj(card, P.i, { token: true, sick: false });
        P.bf.push(tok); tok.attachedTo = x.uid; tok.contractOf = P.i;
        log(`${P.name} ${you(P) ? 'create' : 'creates'} a Contract Aura attached to ${x.card.name}.`);
        fire('enters', { o: tok });
    },
    contractAttack(P, e, t, src) {
        const host = onBf(src.attachedTo); if (!host) return;
        const D = gAttackDefender(host.owner);
        const ownerIdx = src.owner;
        if (D != null && D !== ownerIdx) { host.tp += 2; log(`${host.card.name} gets +2/+0 until end of turn (Contract).`); }
        else { const H = G.players[host.owner]; H.life -= 2; H.lostTurn = G.turn; fire('loseLife', { P: H, n: 2 }); log(`${H.name} loses 2 life (Contract).`); }
    },
    async shadrix(P, e, t, src) {
        if (P.isAI || AUTOPLAY) return;
        const live = G.players.filter(x => !x.out);
        if (live.length < 2) return;
        if (!(await askYes(P, `${src.card.name}: choose two modes (each must target a different player)?`, { card: src.card, yes: 'Choose modes', no: 'Not now' }))) return;
        const MODES = ['Target player creates a 2/1 Inkling with flying', 'Target player draws a card and loses 1 life', 'Target player puts a +1/+1 counter on each creature they control'];
        const chosen = [], used = [];
        for (let k = 0; k < 2; k++) {
            const left = MODES.map((m, i) => i).filter(i => !chosen.includes(i));
            const mi = left[await askMode(P, `${src.card.name}: mode ${k + 1} of 2`, left.map(i => MODES[i]))];
            const players = live.filter(x => !used.includes(x.i));
            const pi = players[await askMode(P, `${MODES[mi]} - which player?`, players.map(x => x.name))];
            chosen.push(mi); used.push(pi.i);
            if (mi === 0) await applyEffect(pi, INKLING(1), null, src);
            else if (mi === 1) { drawCards(pi, 1); pi.life -= 1; pi.lostTurn = G.turn; fire('loseLife', { P: pi, n: 1 }); }
            else pi.bf.filter(isCreature).forEach(c => putCounters(c, 1, P));
        }
    },
    async shieldedByFaith(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(src.uid) || !onBf(x.uid) || x.uid === src.attachedTo || !isCreature(x)) return;
        if (P.isAI || AUTOPLAY) { if (x.owner !== P.i) return; const cur = onBf(src.attachedTo); if (cur && cur.owner === P.i && creatureValue(cur) >= creatureValue(x)) return; }
        else if (!(await askYes(P, `${src.card.name}: attach it to ${x.card.name}?`, { card: src.card }))) return;
        src.attachedTo = x.uid; log(`${src.card.name} is attached to ${x.card.name}.`);
    },
    async songbirds(P, e, t, src) {
        const rest = []; let aura = null;
        while (P.library.length) { const c = P.library.pop(); if (hasType(c, 'Aura')) { aura = c; break; } rest.push(c); }
        shuffle(rest).forEach(c => P.library.unshift(c));
        if (!aura) return;
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${aura.card.name}.`);
        const toBf = P.isAI || AUTOPLAY || P.bf.some(isCreature) && await askYes(P, `${src.card.name}: put ${aura.card.name} onto the battlefield? (Otherwise it goes to your hand.)`, { card: aura.card, yes: 'Battlefield', no: 'Hand' });
        if (toBf && P.bf.some(isCreature)) { putOntoBattlefield(P, aura); await attachTo(P, aura); } else { P.hand.push(aura); log(`${aura.card.name} goes to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    windsOfRath() { allPerms().filter(c => isCreature(c) && !allPerms().some(a => a.attachedTo === c.uid && isAuraLike(a)) && !has(c, 'indestructible')).forEach(c => { dieOrLeave(c, 'gy'); }); log('Each creature that isn\'t enchanted is destroyed.'); },
    async replenish(P) {
        for (const x of P.gy.filter(c => /\bEnchantment\b/.test(c.card.type))) {
            if (hasType(x, 'Aura')) { if (!allPerms().some(isCreature)) continue; reanimateFrom(P, P, x); await attachTo(P, x); } else reanimateFrom(P, P, x);
        }
    },
    async animateDead(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.filter(x => /\bCreature\b/.test(x.card.type)).map(x => ({ x, X })));
        if (!pool.length) { log(`${src.card.name} has nothing to enchant and is put into the graveyard.`); leaveBattlefield(src, 'gy'); return; }
        let pick;
        if (P.isAI || AUTOPLAY) pick = pool.slice().sort((a, b) => (b.x.card.cmc || 0) - (a.x.card.cmc || 0))[0];
        else { const c = await pickCard(P, pool.map(p => p.x), `${src.card.name}: return a creature card from a graveyard to the battlefield`, { required: true }); pick = pool.find(p => p.x === c) || pool[0]; }
        reanimateFrom(P, pick.X, pick.x);
        src.attachedTo = pick.x.uid; src.animTarget = pick.x.uid;
    },
    animateDeadLeaves(P, e, t, src) { const x = src.animTarget && onBf(src.animTarget); if (x) { log(`${x.card.name} is sacrificed.`); fire('sacrificed', { o: x }); dieOrLeave(x, 'gy'); } }
});

// ===== Witherbloom =====
TRIG_FN.sacCreatureMine = (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && isCreature(ctx.o);
TRIG_FN.anySacOther = (o, ctx) => !!ctx.o && ctx.o !== o;
TRIG_FN.sanguinistHit = (o, ctx) => !!ctx.src && !!ctx.src.sanguinistFor && ctx.src.sanguinistFor.uid === o.uid && ctx.src.sanguinistFor.turn === G.turn;
const lifeGainedNow = P => (P.gainedTurn === G.turn ? P.gainedAmt || 0 : 0);
Object.assign(CMD, {
    bogbeast(P) { const x = lifeGainedNow(P); P.bf.filter(isCreature).forEach(c => { c.tkw.push('trample'); c.tp += x; c.tq += x; }); log(`Creatures you control gain trample and get +${x}/+${x} until end of turn.`); },
    async deadlyBrew(P, e, t, src) {
        let mine = null;
        for (const X of G.players.filter(y => !y.out)) {
            const pool = X.bf.filter(x => isCreature(x) || isPlaneswalker(x));
            const pick = X === P ? await pickOwn(P, pool, `${src.card.name}: sacrifice a creature or planeswalker`, { rank: (a, b) => permValue(a) - permValue(b) }) : await chooseFrom(X, pool, `${src.card.name}: sacrifice a creature or planeswalker`);
            if (!pick) continue;
            fire('sacrificed', { o: pick }); log(`${X.name} ${you(X) ? 'sacrifice' : 'sacrifices'} ${pick.card.name}.`); dieOrLeave(pick, 'gy');
            if (X === P) mine = pick;
        }
        if (!mine) return;
        const pool = P.gy.filter(x => x !== mine && !['instant', 'sorcery'].includes(Rx(x).kind));
        const pick = await pickOwn(P, pool, `${src.card.name}: return another permanent card from your graveyard to your hand (or none)`, { optional: true });
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    daemogothDrain(P) { const x = lifeGainedNow(P); if (!x) return; foes(P).forEach(F => { F.life -= x; F.lostTurn = G.turn; fire('loseLife', { P: F, n: x }); }); log(`Each opponent loses ${x} life.`); },
    dinaBrew(P, e, t, src) { const x = G.lastSacPow || 0; gainLifeFor(P, x); if (t && t.o && onBf(t.o.uid) && x > 0) { const got = putCounters(t.o, x, P); log(`${t.o.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } },
    dinaPump(P, e, t, src) { const x = G.lastSacPow || 0; if (onBf(src.uid)) { src.tp += x; log(`${src.card.name} gets +${x}/+0 until end of turn.`); } },
    async feralAppetite(P, e, t, src) {
        const pool = G.players.flatMap(X => X.gy.map(c => ({ c, X })));
        if (!pool.length) return;
        let pick;
        if (P.isAI || AUTOPLAY) pick = pool.slice().sort((a, b) => ((/\bCreature\b/.test(b.c.card.type) ? 1 : 0) - (/\bCreature\b/.test(a.c.card.type) ? 1 : 0)) || ((b.X !== P) - (a.X !== P)))[0];
        else { const c = await pickCard(P, pool.map(p => p.c), `${src.card.name}: exile target card from a graveyard`, { required: true }); pick = pool.find(p => p.c === c) || pool[0]; }
        pull(pick.X.gy, pick.c); pick.X.exile.push(pick.c);
        log(`${pick.c.card.name} is exiled.`);
        if (/\bCreature\b/.test(pick.c.card.type)) await applyEffect(P, PESTT(1), null, src);
    },
    gyomeFood(P, e, t, src) { const n = (G.entered || []).filter(x => x.turn === G.turn && x.owner === P.i && x.creature && !x.o.token).length; for (let k = 0; k < n; k++) makeArtifactToken(P, 'food'); if (n) { tokenMade(P); log(`${P.name} ${you(P) ? 'create' : 'creates'} ${n} Food token${n === 1 ? '' : 's'}.`); } },
    async destroyXTargets(P, e, t, src) {
        const n = src.xVal || 0;
        let pool = allPerms().filter(x => !/\bLand\b/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
        const got = [];
        for (let k = 0; k < n && pool.length; k++) {
            const pick = P.isAI || AUTOPLAY ? pool.slice().sort((a, b) => ((b.owner !== P.i) - (a.owner !== P.i)) || (permValue(b) - permValue(a)))[0] : await pickCard(P, pool, `${src.card.name}: destroy a nonland permanent (${k + 1} of ${n})`, { required: true });
            if (!pick) break; got.push(pick); pool = pool.filter(x => x !== pick);
        }
        got.forEach(x => { if (!has(x, 'indestructible')) { log(`${x.card.name} is destroyed.`); dieOrLeave(x, 'gy'); } });
    },
    mazirek(P) { P.bf.filter(isCreature).forEach(c => putCounters(c, 1, P)); },
    async netherTraitor(P, e, t, src) {
        if (!P.gy.includes(src) || G.ctxObj === src) return;
        if (!planPayment(P, parseCost('{B}'))) return;
        if (!(P.isAI || AUTOPLAY || await askYes(P, `${src.card.name}: pay {B} to return it to the battlefield?`, { card: src.card }))) return;
        planPayment(P, parseCost('{B}')).forEach(x => tapSource(P, x));
        reanimateFrom(P, P, src);
    },
    async pestInfestation(P, e, t, src) {
        const n = e.n;
        let pool = allPerms().filter(x => /Artifact|Enchantment/.test(x.card.type) && !has(x, 'hexproof') && !has(x, 'shroud') && !protFrom(x, src));
        const got = [];
        for (let k = 0; k < n && pool.length; k++) {
            const pick = P.isAI || AUTOPLAY ? pool.filter(x => x.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0] : await pickCard(P, pool, `${src.card.name}: destroy an artifact or enchantment (or stop)`, { optional: true });
            if (!pick) break; got.push(pick); pool = pool.filter(x => x !== pick);
        }
        got.forEach(x => { log(`${x.card.name} is destroyed.`); dieOrLeave(x, 'gy'); });
        if (n > 0) await applyEffect(P, { ...PESTT(2 * n) }, null, src);
    },
    async priestForgotten(P, e, t, src) {
        for (const F of foes(P)) {
            F.life -= 2; F.lostTurn = G.turn; fire('loseLife', { P: F, n: 2 });
            const pick = await chooseFrom(F, F.bf.filter(isCreature), `${src.card.name}: sacrifice a creature`);
            if (pick) { fire('sacrificed', { o: pick }); dieOrLeave(pick, 'gy'); }
        }
        P.pool = (P.pool || []).concat(['B', 'B']); drawCards(P, 1);
        log(`${P.name} ${you(P) ? 'add' : 'adds'} {B}{B} and ${you(P) ? 'draw' : 'draws'} a card.`);
    },
    async ribtrussPests(P, e, t, src) { const n = Math.max(0, src.counters); if (n) await applyEffect(P, PESTT(n), null, src); },
    sanguinistMark(P, e, t, src) { const x = t && t.o; if (!x || !onBf(x.uid)) return; x.tkw.push('deathtouch'); x.sanguinistFor = { uid: src.uid, turn: G.turn }; log(`${x.card.name} gains deathtouch until end of turn.`); },
    async witchMoors(P, e, t, src) {
        for (const F of foes(P)) { const pick = await chooseFrom(F, F.bf.filter(isCreature), `${src.card.name}: sacrifice a creature`); if (pick) { fire('sacrificed', { o: pick }); log(`${F.name} ${you(F) ? 'sacrifice' : 'sacrifices'} ${pick.card.name}.`); dieOrLeave(pick, 'gy'); } }
        const pick = await pickOwn(P, P.gy.filter(x => /\bCreature\b/.test(x.card.type)), `${src.card.name}: return a creature card from your graveyard to your hand (or none)`, { optional: true });
        if (pick) { pull(P.gy, pick); P.hand.push(pick); log(`${pick.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async charmSacDraw(P, e, t, src) {
        const pool = P.bf.slice();
        const pick = P.isAI || AUTOPLAY ? pool.filter(x => x.token || permValue(x) < 2)[0] : await pickCard(P, pool, `${src.card.name}: sacrifice a permanent to draw two cards (or none)`, { optional: true });
        if (!pick) return;
        fire('sacrificed', { o: pick }); log(`${P.name} ${you(P) ? 'sacrifice' : 'sacrifices'} ${pick.card.name}.`); dieOrLeave(pick, 'gy');
        drawCards(P, 2);
    },
    async millThenLand(P, e, t, src) {
        const X = t && t.p ? t.p : P; doMill(X, 3);
        const land = await pickOwn(P, P.gy.filter(x => /\bLand\b/.test(x.card.type)), `${src.card.name}: return a land card from your graveyard to your hand`, { optional: true });
        if (land) { pull(P.gy, land); P.hand.push(land); log(`${land.card.name} returns to ${you(P) ? 'your' : 'their'} hand.`); }
    },
    async pestPerOpp(P, e, t, src) { const n = oppsOf(P).length; if (n) await applyEffect(P, PESTT(n), null, src); },
    drawLose1(P, e, t) { const X = t && t.p ? t.p : P; drawCards(X, 1); X.life -= 1; X.lostTurn = G.turn; fire('loseLife', { P: X, n: 1 }); log(`${X.name} ${you(X) ? 'lose' : 'loses'} 1 life.`); }
});
