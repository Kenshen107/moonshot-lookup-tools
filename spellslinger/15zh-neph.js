// Spellslinger Duels - engine pieces for the Nephilim / Changeling tribal deck (2026-11-19). Wordings: rules/neph.js. CMD ids start with nf_.
// Approximations (nothing is marked Partly): Echocasting Symposium, Flicker, Felidar Guardian and Yore-Tiller Nephilim choose their targets as they
// resolve; Orcrist picks the creature type with the most creatures (a person isn't asked); Orvar's discard clause fires when it is discarded on
// another player's turn (the engine doesn't record who caused a discard); World Tree's god search puts every God card onto the battlefield;
// Ink-Treader Nephilim copies the spell once for each other creature the spell could target.
(function () {
    const ALLC = ['W', 'U', 'B', 'R', 'G'];
    const epoch = X => allPerms().filter(s => Rx(s).nfEpochal && ctrl(s) === X && !lostAbilities(s)).length;
    const isNeph = o => isCreature(o) && hasType(o, 'Nephilim');
    const sb = staticBuffs;
    staticBuffs = function (o) {
        const b = sb.apply(this, arguments);
        if (!G || !isCreature(o) || !allPerms().some(s => Rx(s).nfEpochal)) return b;
        const X = ctrl(o); if (!X || !epoch(X) || !isNeph(o)) return b;
        const n = X.bf.filter(isNeph).length - 1;
        if (n > 0) { b.p += n; b.q += n; }
        return b;
    };
    const cb = canBlock;
    canBlock = function (blk, atk) {
        if (atk && G && isNeph(atk) && (blk.card.colors || []).length === 1) { const X = ctrl(atk); if (X && epoch(X)) return false; }
        return cb.apply(this, arguments);
    };
    const mo = manaOf;
    manaOf = function (o) {
        const m = mo.apply(this, arguments);
        if (!G || !o || !o.uid || !/\bLand\b/.test(o.card.type)) return m;
        const X = ctrl(o); if (!X) return m;
        const lands = X.bf.filter(x => /\bLand\b/.test(x.card.type)).length;
        if (lands < 6 || !allPerms().some(s => Rx(s).nfWorldTree && ctrl(s) === X && !lostAbilities(s))) return m;
        return { ...(m || { n: 1 }), colors: [...ALLC], fixed: false };
    };
    // Leyline of the Guildpact: every nonland permanent you control is all colors (synced after state-based checks)
    function leySync() {
        if (!G || !G.players) return;
        G.players.forEach(P => {
            const on = P.bf.some(s => Rx(s).nfLeyline && !lostAbilities(s));
            P.bf.forEach(x => {
                if (/\bLand\b/.test(x.card.type)) return;
                if (on && !x.nfColors) { x.nfColors = x.card.colors || []; x.card = { ...x.card, colors: [...ALLC] }; x._r = null; }
                else if (!on && x.nfColors) { x.card = { ...x.card, colors: x.nfColors }; delete x.nfColors; x._r = null; }
            });
        });
    }
    const sba0 = sba; sba = function () { const r = sba0.apply(this, arguments); try { leySync(); } catch (e) { /* ignore */ } return r; };
    const st0 = settle; settle = async function () { const r = await st0.apply(this, arguments); try { leySync(); } catch (e) { /* ignore */ } return r; };
    // Ink-Treader Nephilim and Orvar, the All-Form watch spells being cast
    const f0 = fire;
    fire = function (ev, ctx = {}) {
        const r = f0.apply(this, arguments);
        try {
            if (G && !G.over && ev === 'cast' && ctx.o && ['instant', 'sorcery'].includes(Rx(ctx.o).kind)) {
                const tg = ctx.target && ctx.target.o;
                const item = G.stack.find(it => it.kind === 'spell' && it.o === ctx.o);
                if (tg && item) {
                    if (Rx(tg).nfInk && !lostAbilities(tg) && onBf(tg.uid)) (G.trigQ = G.trigQ || []).push({ P: ctrl(tg), o: tg, effects: [cmd('nf_inkCopy', { item: item.id })] });
                    allPerms().filter(s => Rx(s).nfOrvar && !lostAbilities(s) && ctrl(s) === ctx.P && s !== tg && ctrl(tg) === ctx.P).forEach(s => (G.trigQ = G.trigQ || []).push({ P: ctx.P, o: s, effects: [cmd('nf_orvar', { uid: tg.uid })] }));
                }
            }
            if (G && !G.over && ev === 'discarded' && ctx.o && Rx(ctx.o).nfOrvarDiscard && ctx.P && G.active !== ctx.P.i) (G.trigQ = G.trigQ || []).push({ P: ctx.P, o: ctx.o, effects: [cmd('nf_orvarDiscard')] });
        } catch (e) { /* a watcher never stops the game */ }
        return r;
    };
})();

const nfBestOwn = P => P.bf.filter(x => !x.token && frEtbValue(x) >= 3).sort((a, b) => frEtbValue(b) - frEtbValue(a))[0] || null;

Object.assign(CMD, {
    async nf_tutor(P, e, t, src) {
        const pool = P.library.filter(c => /\bNephilim\b/.test(c.card.type));
        let pick = pool.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0] || null;
        if (pool.length && !P.isAI && !AUTOPLAY) pick = (await pickCard(P, pool, `${src.card.name}: search for a Nephilim card`)) || null;
        if (pick) { pull(P.library, pick); P.hand.push(pick); log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${pick.card.name} and put it into ${you(P) ? 'your' : 'their'} hand.`); }
        shuffleLib(P);
    },
    async nf_echo(P, e, t, src) {
        const mine = P.bf.filter(isCreature); if (!mine.length) return;
        let X = P, c = mine.slice().sort((a, b) => permValue(b) - permValue(a))[0];
        if (!P.isAI && !AUTOPLAY) {
            const all = G.players.filter(p => !p.out);
            if (all.length > 1) X = (await pickPlayer(P, all, `${src.card.name}: who creates the token?`)) || P;
            c = (await pickCard(P, mine, `${src.card.name}: choose a creature you control to copy`, { required: true })) || c;
        }
        tokenCopyOf(X, c.card);
    },
    async nf_blinkOwn(P, e, t, src) {
        const pool = P.bf.filter(x => x !== src);
        if (!pool.length) return;
        let x = P.isAI || AUTOPLAY ? nfBestOwn(P) : await pickCard(P, pool, `${src.card.name}: exile another permanent you control, then return it (or skip)`);
        if (x && x !== src && onBf(x.uid)) rrBlinkNow(x);
    },
    async nf_flicker(P, e, t, src) {
        const pool = allPerms().filter(x => !x.token);
        if (!pool.length) return;
        let x = P.isAI || AUTOPLAY ? (nfBestOwn(P) || P.bf.filter(y => !y.token && y.tapped)[0] || null) : await pickCard(P, pool, `${src.card.name}: choose a nontoken permanent`, { required: true });
        if (x && onBf(x.uid)) rrBlinkNow(x);
    },
    async nf_inkCopy(P, e, t, src) {
        const it = G.stack.find(i => i.id === e.item); if (!it) return;
        const te = withX(spellEffects(it.o), it.x).find(needsTarget); if (!te) return;
        const valid = validTargets(it.P, te, it.o).filter(v => v.o && isCreature(v.o) && v.o !== src);
        for (const v of valid) await copySpellItem(P, it, { target: v });
    },
    nf_legion(P, e, t, src) {
        const x = t && t.o; if (!x || !onBf(x.uid)) return;
        x.tp += pow(x); x.tkw.push('first strike');
        log(`${x.card.name}'s power is doubled and it gains first strike until end of turn.`);
    },
    async nf_orcrist(P, e, t, src) {
        const cs = P.bf.filter(isCreature); if (!cs.length) return;
        const types = new Set(); cs.forEach(c => ((c.card.type.split('—')[1] || '').trim().split(/\s+/)).filter(Boolean).forEach(w => types.add(w)));
        let best = null, bn = 0; types.forEach(w => { const n = cs.filter(c => hasType(c, w)).length; if (n > bn) { bn = n; best = w; } });
        if (!best) return;
        log(`${src.card.name}: chosen creature type ${best} (${bn}).`);
        await applyEffect(P, { t: 'artToken', kind: 'treasure', n: bn }, null, src);
    },
    nf_orvar(P, e, t, src) {
        const tg = allPerms().find(x => x.uid === e.uid); if (!tg) return;
        tokenCopyOf(P, tg.card);
    },
    async nf_orvarDiscard(P, e, t, src) {
        const pool = allPerms();
        if (!pool.length) return;
        let x = pool.slice().sort((a, b) => permValue(b) - permValue(a))[0];
        if (!P.isAI && !AUTOPLAY) x = (await pickCard(P, pool, `${src.card.name}: create a token that's a copy of target permanent`, { required: true })) || x;
        tokenCopyOf(P, x.card);
    },
    nf_gods(P, e, t, src) {
        const gods = P.library.filter(c => /\bGod\b/.test(c.card.type));
        gods.forEach(c => { pull(P.library, c); putOntoBattlefield(P, c); });
        shuffleLib(P);
        log(`${src.card.name}: ${gods.length} God card${gods.length === 1 ? '' : 's'} put onto the battlefield.`);
    },
    nf_witch(P, e, t, src) { if (onBf(src.uid) && pow(src) >= 10) { src.tkw.push('trample'); log(`${src.card.name} gains trample until end of turn.`); } },
    async nf_yore(P, e, t, src) {
        const pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type)); if (!pool.length) return;
        const c = await pickOwn(P, pool, `${src.card.name}: return a creature card from your graveyard to the battlefield tapped and attacking`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (!c) return;
        pull(P.gy, c); putOntoBattlefield(P, c, true); G.attackers.push(c.uid); if (src.atkTo !== undefined) c.atkTo = src.atkTo;
        log(`${c.card.name} enters tapped and attacking.`);
    }
});
