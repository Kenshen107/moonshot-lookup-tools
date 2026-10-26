// Engine pieces for commander round 2, batch b (2026-10-26). Wordings are in rules/cmdr300b.js; each odd card is a CMD entry (ids start with b_).
// Choices inside resolving abilities are made as they resolve; "target" / "you may" always ask a person.

const bHurt = (X, n, src) => { if (n <= 0 || X.out) return; X.life -= n; log(`${src.card.name} deals ${n} damage to ${X.name}.`); fire('playerDamaged', { P: X, n }); fire('loseLife', { P: X, n }); };
const bLoseLife = (X, n) => { if (n <= 0) return; X.life -= n; log(`${X.name} ${you(X) ? 'lose' : 'loses'} ${n} life.`); fire('loseLife', { P: X, n }); };
const bIsHuman = P => !(P.isAI || AUTOPLAY);
async function bOpp(P, title) {
    const fs = foes(P); if (fs.length <= 1) return fs[0] || null;
    if (!bIsHuman(P)) return fs.slice().sort((a, b) => a.life - b.life)[0];
    const i = await askMode(P, title, fs.map(f => f.name)); return fs[i] || fs[0];
}
const bTypes = ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Instant', 'Land', 'Planeswalker', 'Sorcery', 'Kindred'];
const bNextTurnOf = P => (G.active === P.i ? G.turn : G.turn + G.players.filter(X => !X.out).length);
// Library search: choose from a list (the computer takes the best), put it where asked, shuffle
async function bSearch(P, test, title, src, how) {
    const pool = P.library.filter(test);
    if (!pool.length) { log(`${P.name} ${you(P) ? 'search' : 'searches'} their library and find${you(P) ? '' : 's'} nothing.`); shuffleLib(P); return null; }
    const x = await pickOwn(P, pool, `${src.card.name}: ${title}`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
    if (x) { pull(P.library, x); if (how === 'bf') putOntoBattlefield(P, x); else P.hand.push(x); }
    shuffleLib(P);
    return x;
}

Object.assign(TRIG_FN, {
    b_landLeaves: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner && /\bLand\b/.test(ctx.o.card.type) && ctx.o !== o,
    b_foeDiesZeroTou: (o, ctx) => !!ctx.o && ctx.o.owner !== o.owner && tou(ctx.o) < 1,
    b_myBlocked: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    b_myDiscard: (o, ctx) => !!ctx.P && ctx.P.i === o.owner,
    b_firstSpell: (o, ctx) => !!ctx.P && ctx.P.castN === 1,
    b_main2Mine: (o, ctx) => G.active === o.owner,
    b_main2Tapped: (o, ctx) => G.active === o.owner && !!o.tapped,
    b_legendDies: (o, ctx) => !!ctx.o && ctx.o !== o && ctx.o.owner === o.owner && /\bLegendary\b/.test(ctx.o.card.type),
    b_kazuul: (o, ctx) => (ctx.list || []).some(x => x.owner !== o.owner && ((x.atkTo != null ? x.atkTo : G.defender) === o.owner || G.players.length === 2)),
    b_foeSacNontoken: (o, ctx) => !!ctx.o && !ctx.o.token && ctx.o.owner !== o.owner,
    b_foeDiscardPerm: (o, ctx) => !!ctx.P && ctx.P.i !== o.owner && !!ctx.o && !/\b(Instant|Sorcery)\b/.test(ctx.o.card.type),
    b_myLandfall: (o, ctx) => !!ctx.o && ctx.o.owner === o.owner,
    b_revHit: (o, ctx) => { if (!ctx.src || ctx.src.owner !== o.owner) return false; if (o.lastStepRev === ctx.step) return false; o.lastStepRev = ctx.step; return true; },
});
COND_EXTRA.push(
    [/^you control thirty or more artifacts$/, () => P => P.bf.filter(x => /\bArtifact\b/.test(x.card.type)).length >= 30],
    [/^you gained three or more life this turn$/, () => P => P.gainedTurn === G.turn && (P.gainedAmt || 0) >= 3],
    [/^you attacked this turn$/, () => P => P.attackedTurn === G.turn],
    [/^you cast it$/, () => (P, o) => !!o && (o.castFromHand === G.turn || !!o.isCommander)]
);
Object.assign(CMD_SCORE, { b_halana: () => 6, b_xenagos: () => 5, b_arwen: () => 3, b_kazuul: () => 5, b_okinec: () => 4, b_otharri: () => 8, b_alesha: () => 5, b_hidetsugu: () => 3, b_ashling: () => 3 });

Object.assign(CMD, {
    b_win(P, e, t, src) { endGame(P.i, `${P.name} controls thirty or more artifacts (${src.card.name}).`); },
    // Titania, Protector of Argoth
    b_titania(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || x.token) return;
        const X = G.players[x.realOwner ?? x.owner]; if (!X.gy.includes(x)) return;
        applyEffect(P, { t: 'token', n: 1, p: 5, q: 3, name: 'green Elemental', kw: [] }, null, src);
    },
    // Alesha, Who Laughs at Fate
    async b_alesha(P, e, t, src) {
        if (!onBf(src.uid)) return;
        const pw = pow(src), pool = P.gy.filter(c => /\bCreature\b/.test(c.card.type) && (c.card.cmc || 0) <= pw);
        const x = await pickOwn(P, pool, `${src.card.name}: return a creature card with mana value ${pw} or less from your graveyard to the battlefield`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (x) { pull(P.gy, x); putOntoBattlefield(P, x); }
    },
    // The Locust God
    b_locust(P, e, t, src) {
        const owner = G.players[src.realOwner ?? src.owner];
        atEndStep(() => { const x = owner.gy.find(y => y.uid === src.uid); if (x) { pull(owner.gy, x); owner.hand.push(x); log(`${x.card.name} returns to ${owner.name === 'You' ? 'your' : `${owner.name}'s`} hand.`); } }, `${src.card.name} returns to its owner's hand.`);
    },
    // Electro, Assaulting Battery
    async b_electro(P, e, t, src) {
        let max = 0; for (let k = 1; k <= 20; k++) { if (planPayment(P, parseCost(`{${k}}`))) max = k; else break; }
        if (!max) return;
        const F = await bOpp(P, `${src.card.name}: damage to which player?`); if (!F) return;
        let X = 0;
        if (bIsHuman(P)) X = await askNumber(P, `${src.card.name}: pay {X} to deal X damage to ${F.name}?`, 0, max, 0, { card: src.card }) || 0;
        else X = F.life <= max ? F.life : 0;
        if (X <= 0) return;
        planPayment(P, parseCost(`{${X}}`)).forEach(y => tapSource(P, y));
        bHurt(F, X, src);
    },
    // Arwen, Weaver of Hope (approximation: the counters arrive just after the creature enters)
    b_arwen(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid) || !isCreature(x) || x === src) return;
        const n = Math.max(0, tou(src)); if (n <= 0) return;
        const got = putCounters(x, n, P); log(`${x.card.name} enters with ${got} additional +1/+1 counter${got === 1 ? '' : 's'} (${src.card.name}).`);
    },
    // Kazuul, Tyrant of the Cliffs
    async b_kazuul(P, e, t, src) {
        const list = ((G.ctxRaw && G.ctxRaw.list) || []).filter(x => x.owner !== P.i && onBf(x.uid) && ((x.atkTo != null ? x.atkTo : G.defender) === P.i || G.players.length === 2));
        for (const x of list) {
            const C = G.players[x.owner];
            const paid = await mayPay(C, '{3}', `${src.card.name}: pay {3} so ${P.name} doesn't create a 3/3 Ogre for ${x.card.name} attacking?`, src, true);
            if (!paid) await applyEffect(P, { t: 'token', n: 1, p: 3, q: 3, name: 'red Ogre', kw: [] }, null, src);
        }
    },
    // Inti, Seneschal of the Sun
    b_inti(P, e, t, src) {
        const c = P.library.pop(); if (!c) return;
        exilePlayFrom(P, P, c, bNextTurnOf(P));
    },
    // Venser, Shaper Savant (permanents only)
    async b_venser(P, e, t, src) {
        const pool = allPerms();
        let x;
        if (bIsHuman(P)) x = await pickCard(P, pool, `${src.card.name}: return target permanent to its owner's hand`, { required: true }) || pool[0];
        else x = pool.filter(y => y.owner !== P.i && !/\bLand\b/.test(y.card.type)).sort((a, b) => permValue(b) - permValue(a))[0] || null;
        if (!x) return;
        log(`${src.card.name} returns ${x.card.name} to its owner's hand.`);
        leaveBattlefield(x, 'hand');
    },
    // Grazilaxx, Illithid Scholar
    async b_grazilaxx(P, e, t, src) {
        const x = G.ctxObj; if (!x || !onBf(x.uid)) return;
        const blockers = ((G.blocks && G.blocks[x.uid]) || []).map(onBf).filter(Boolean);
        const yes = bIsHuman(P) ? await askYes(P, `${src.card.name}: return ${x.card.name} to its owner's hand?`, { card: x.card }) : (blockers.some(b => pow(b) >= tou(x)) && !has(x, 'indestructible'));
        if (yes) { log(`${x.card.name} is returned to its owner's hand.`); leaveBattlefield(x, 'hand'); }
    },
    // Halana and Alena, Partners
    async b_halana(P, e, t, src) {
        const pool = P.bf.filter(y => isCreature(y) && y !== src);
        const x = await pickOwn(P, pool, `${src.card.name}: put counters on another target creature you control`, { rank: (a, b) => pow(b) - pow(a) });
        if (!x) return;
        const n = Math.max(0, pow(src)); if (n > 0) { const got = putCounters(x, n, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); }
        x.tkw.push('haste'); log(`${x.card.name} gains haste until end of turn.`);
    },
    // Xenagos, God of Revels
    async b_xenagos(P, e, t, src) {
        const pool = P.bf.filter(y => isCreature(y) && y !== src);
        const x = await pickOwn(P, pool, `${src.card.name}: another target creature gains haste and +X/+X`, { rank: (a, b) => pow(b) - pow(a) });
        if (!x) return;
        const k = Math.max(0, pow(x)); x.tp += k; x.tq += k; x.tkw.push('haste');
        log(`${x.card.name} gains haste and gets +${k}/+${k} until end of turn.`);
    },
    // Selvala, Explorer Returned
    b_selvala(P, e, t, src) {
        let n = 0;
        for (const X of G.players.filter(y => !y.out)) {
            const c = X.library[X.library.length - 1]; if (!c) continue;
            log(`${X.name} reveal${you(X) ? '' : 's'} ${c.card.name}.`);
            if (!/\bLand\b/.test(c.card.type)) n++;
        }
        if (n > 0) { P.pool = (P.pool || []).concat(Array(n).fill('G')); gainLifeFor(P, n); log(`${P.name} add${you(P) ? '' : 's'} ${'{G}'.repeat(n)}.`); }
        G.players.filter(y => !y.out).forEach(X => drawCards(X, 1));
    },
    // Klauth, Unrivaled Ancient (the colors are split by the colored symbols in your hand; the "spells only" limit isn't tracked)
    b_klauth(P, e, t, src) {
        const x = (G.attackers || []).map(onBf).filter(Boolean).reduce((a, y) => a + Math.max(0, pow(y)), 0); if (x <= 0) return;
        const need = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        P.hand.forEach(c => ((c.card.cost || '').match(/\{([WUBRG])\}/g) || []).forEach(s => { need[s[1]]++; }));
        let cols = Object.keys(need).filter(k => need[k] > 0); if (!cols.length) cols = (src.card.ci && src.card.ci.length ? src.card.ci : ['G']);
        const out = []; for (let i = 0; i < x; i++) out.push(cols[i % cols.length]);
        P.pool = (P.pool || []).concat(out); P.keepPoolTurn = G.turn;
        log(`${P.name} add${you(P) ? '' : 's'} ${x} mana (it stays until end of turn).`);
    },
    // Ioreth of the Healing House
    async b_ioreth(P, e, t, src) {
        const pool = P.bf.filter(y => y !== src && isCreature(y) && /\bLegendary\b/.test(y.card.type) && y.tapped);
        for (let k = 0; k < 2; k++) {
            const left = pool.filter(y => y.tapped);
            const x = await pickOwn(P, left, `${src.card.name}: untap another target legendary creature`, { optional: k > 0, rank: (a, b) => pow(b) - pow(a) });
            if (!x) break; x.tapped = false; log(`${x.card.name} untaps.`);
        }
    },
    // God-Eternal Oketra
    async b_oketra(P, e, t, src) {
        const X = G.players[src.realOwner ?? src.owner];
        const zone = ['gy', 'exile'].find(z => X[z].includes(src)); if (!zone) return;
        const yes = bIsHuman(G.players[src.owner]) ? await askYes(G.players[src.owner], `${src.card.name}: put it into your library third from the top?`, { card: src.card }) : true;
        if (!yes) return;
        pull(X[zone], src); resetObj(src);
        X.library.splice(Math.max(0, X.library.length - 2), 0, src);
        log(`${src.card.name} is put into ${X.name === 'You' ? 'your' : `${X.name}'s`} library third from the top.`);
    },
    // Ureni of the Unwritten
    async b_ureni(P, e, t, src) {
        const top = []; for (let i = 0; i < 8 && P.library.length; i++) top.push(P.library.pop());
        const pool = top.filter(c => /\bCreature\b/.test(c.card.type) && /\bDragon\b/.test(c.card.type));
        const got = pool.length ? await pickOwn(P, pool, `${src.card.name}: put a Dragon creature card onto the battlefield`, { optional: true }) : null;
        P.library.unshift(...shuffle(top.filter(c => c !== got)));
        if (got) putOntoBattlefield(P, got);
    },
    // The Lord of Pain
    async b_lop(P, e, t, src) {
        const raw = G.ctxRaw || {}; const C = raw.P, sp = raw.o; if (!C || !sp) return;
        const mv = sp.card.cmc || 0; if (mv <= 0) return;
        const pool = G.players.filter(X => !X.out && X !== C); if (!pool.length) return;
        let F;
        if (bIsHuman(P)) F = pool[await askMode(P, `${src.card.name}: choose another player (${mv} damage)`, pool.map(X => X.name))] || pool[0];
        else F = pool.filter(X => X !== P).sort((a, b) => a.life - b.life)[0] || pool[0];
        bHurt(F, mv, src);
    },
    // Kona, Rescue Beastie
    async b_kona(P, e, t, src) {
        if (!src.tapped) return;
        const pool = P.hand.filter(c => !/\b(Instant|Sorcery)\b/.test(c.card.type));
        const x = await pickOwn(P, pool, `${src.card.name}: put a permanent card from your hand onto the battlefield?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (x) { pull(P.hand, x); putOntoBattlefield(P, x); }
    },
    // Neheb, the Eternal
    b_neheb(P, e, t, src) {
        const n = foes(P).reduce((a, F) => a + (F.lostTurn === G.turn ? (F.lostN || 0) : 0), 0); if (n <= 0) return;
        P.pool = (P.pool || []).concat(Array(Math.min(n, 60)).fill('R')); log(`${P.name} add${you(P) ? '' : 's'} ${n} red mana.`);
    },
    // Rev, Tithe Extractor
    b_rev(P, e, t, src) {
        makeArtifactToken(P, 'treasure'); log(`${P.name} ${you(P) ? 'create' : 'creates'} a Treasure token.`);
        const H = hitList().find(X => X !== P); if (!H) return;
        const c = H.library.pop(); if (c) exilePlayFrom(P, H, c, 1e9);
    },
    // Sovereign Okinec Ahau
    b_okinec(P, e, t, src) {
        const adds = P.bf.filter(x => isCreature(x)).map(x => [x, pow(x) - (Number(x.card.power) || 0)]).filter(([x, d]) => d > 0);
        adds.forEach(([x, d]) => { if (onBf(x.uid)) { const got = putCounters(x, d, P); log(`${x.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); } });
    },
    // Ratadrabik of Urborg
    b_rat(P, e, t, src) {
        const l = G.ctxRaw && G.ctxRaw.lki, x = G.ctxRaw && G.ctxRaw.o; const card = (l && l.card) || (x && x.card); if (!card) return;
        const type = card.type.replace(/\bLegendary\s+/, '').replace(/(—.*)$/, '$1 Zombie');
        const c = { ...card, type, colors: [...new Set([...(card.colors || []), 'B'])], _r: undefined };
        tokenCopyOf(P, c, { p: 2, q: 2 });
    },
    // Zur the Enchanter
    async b_zur(P, e, t, src) {
        await bSearch(P, c => /\bEnchantment\b/.test(c.card.type) && !/\bAura\b/.test(c.card.type) && (c.card.cmc || 0) <= 3, 'search for an enchantment card with mana value 3 or less', src, 'bf');
    },
    // Kefka, Court Mage
    async b_kefka(P, e, t, src) {
        const seen = new Set();
        for (const X of G.players.filter(y => !y.out)) {
            if (!X.hand.length) continue;
            const d = await discardChosen(X, `${src.card.name}: discard a card`); if (!d) continue;
            bTypes.forEach(w => { if (new RegExp(`\\b${w}\\b`).test(d.card.type)) seen.add(w); });
        }
        if (seen.size) drawCards(P, seen.size);
    },
    // Oswald Fiddlebender
    async b_oswald(P, e, t, src) {
        const mv = (G.lastSacMv || 0) + 1;
        await bSearch(P, c => /\bArtifact\b/.test(c.card.type) && (c.card.cmc || 0) === mv, `search for an artifact card with mana value ${mv}`, src, 'bf');
    },
    // Otharri, Suns' Glory
    async b_otharri(P, e, t, src) {
        P.exp = (P.exp || 0) + 1; log(`${P.name} get${you(P) ? '' : 's'} an experience counter (${P.exp}).`);
        await applyEffect(P, { t: 'token', n: P.exp, p: 2, q: 2, name: 'red Rebel', kw: [], tapped: true, attacking: true }, null, src);
    },
    // Ink-Eyes, Servant of Oni
    async b_inkeyes(P, e, t, src) {
        const H = hitList().find(X => X !== P); if (!H) return;
        const pool = H.gy.filter(c => /\bCreature\b/.test(c.card.type));
        const x = await pickOwn(P, pool, `${src.card.name}: put a creature card from ${H.name === 'You' ? 'your' : `${H.name}'s`} graveyard onto the battlefield under your control?`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
        if (x) reanimateFrom(P, H, x);
    },
    // Tiamat
    async b_tiamat(P, e, t, src) {
        if (!condOk('you cast it', P, src)) return;
        const names = new Set(); const got = [];
        for (let k = 0; k < 5; k++) {
            const pool = P.library.filter(c => /\bDragon\b/.test(c.card.type) && c.card.name !== src.card.name && !names.has(c.card.name));
            const x = await pickOwn(P, pool, `${src.card.name}: choose a Dragon card with a different name (${k + 1} of 5)`, { optional: true, rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
            if (!x) break; names.add(x.card.name); pull(P.library, x); P.hand.push(x); got.push(x.card.name);
        }
        shuffleLib(P);
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${got.length ? got.join(', ') : 'nothing'} into ${you(P) ? 'your' : 'their'} hand.`);
    },
    // Heartless Hidetsugu
    b_hidetsugu(P, e, t, src) { G.players.filter(X => !X.out).forEach(X => bHurt(X, Math.floor(X.life / 2), src)); },
    // Malcolm, Keen-Eyed Navigator
    b_malcolmK(P, e, t, src) {
        const n = hitList().filter(H => H !== P).length;
        for (let i = 0; i < n; i++) makeArtifactToken(P, 'treasure');
        if (n) log(`${P.name} ${you(P) ? 'create' : 'creates'} ${n} Treasure token${n === 1 ? '' : 's'}.`);
    },
    // Fandaniel, Telophoroi Ascian
    async b_fandaniel(P, e, t, src) {
        const n = P.gy.filter(c => /\b(Instant|Sorcery)\b/.test(c.card.type)).length;
        for (const F of foes(P)) {
            const pool = F.bf.filter(x => isCreature(x) && !x.token);
            let sacked = false;
            if (pool.length) {
                const cheap = pool.slice().sort((a, b) => permValue(a) - permValue(b))[0];
                const ok = bIsHuman(F) ? await askYes(F, `${src.card.name}: sacrifice a nontoken creature? (Otherwise you lose ${2 * n} life.)`, { card: src.card }) : (n > 0 ? permValue(cheap) <= 2 * n : false);
                if (ok) { const c = bIsHuman(F) ? await chooseFrom(F, pool, `${src.card.name}: sacrifice a nontoken creature`, false) : cheap; if (c) { sacPerm(F, c); sacked = true; } }
            }
            if (!sacked && n > 0) bLoseLife(F, 2 * n);
        }
    },
    // Rakdos, Patron of Chaos
    async b_rakdosPatron(P, e, t, src) {
        const F = await bOpp(P, `${src.card.name}: target opponent`); if (!F) return;
        const pool = F.bf.filter(x => !x.token && !/\bLand\b/.test(x.card.type));
        let did = false;
        if (pool.length >= 2) {
            const cheap = pool.slice().sort((a, b) => permValue(a) - permValue(b)).slice(0, 2);
            const ok = bIsHuman(F) ? await askYes(F, `${src.card.name}: sacrifice two nonland, nontoken permanents? (Otherwise ${P.name} draws two cards.)`, { card: src.card }) : cheap[0] && permValue(cheap[0]) + permValue(cheap[1]) <= 8;
            if (ok) {
                const a = bIsHuman(F) ? await chooseFrom(F, pool, `${src.card.name}: sacrifice a permanent (1 of 2)`, false) : cheap[0];
                const rest = pool.filter(x => x !== a);
                const b = bIsHuman(F) ? await chooseFrom(F, rest, `${src.card.name}: sacrifice a permanent (2 of 2)`, false) : cheap[1];
                if (a) sacPerm(F, a); if (b && b !== a) sacPerm(F, b); did = true;
            }
        }
        if (!did) drawCards(P, 2);
    },
    // Mendicant Core, Guidelight
    async b_mendicant(P, e, t, src) {
        const sp = G.ctxRaw && G.ctxRaw.o; if (!sp) return;
        if (!(await mayPay(P, '{1}', `${src.card.name}: pay {1} to copy ${sp.card.name}?`, src, true))) return;
        tokenCopyOf(P, sp.card); // a copy of an artifact spell becomes a token copy of the permanent
    },
    // Lathiel, the Bounteous Dawn
    async b_lathiel(P, e, t, src) {
        let left = lifeGainedNow(P); if (left <= 0) return;
        const pool = () => G.players.flatMap(X => X.bf).filter(x => isCreature(x) && x !== src);
        if (!bIsHuman(P)) {
            const best = P.bf.filter(x => isCreature(x) && x !== src).sort((a, b) => creatureValue(b) - creatureValue(a))[0];
            if (best) { const got = putCounters(best, left, P); log(`${best.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); }
            return;
        }
        while (left > 0) {
            const c = await pickCard(P, pool(), `${src.card.name}: put +1/+1 counters on a creature (${left} left)`, { optional: true }); if (!c) break;
            const k = await askNumber(P, `${src.card.name}: counters on ${c.card.name} (${left} left)`, 1, left, left, { card: src.card }); if (!k) break;
            const got = putCounters(c, k, P); left -= k; log(`${c.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`);
        }
    },
    // Clive, Ifrit's Dominant
    async b_clive(P, e, t, src) {
        const n = devotion(P, ['R']);
        const yes = bIsHuman(P) ? await askYes(P, `${src.card.name}: discard your hand, then draw ${n} card${n === 1 ? '' : 's'} (your devotion to red)?`, { card: src.card }) : P.hand.length < n;
        if (!yes) return;
        const cards = P.hand.splice(0); noteDiscard(P, cards.length);
        cards.forEach(c => { P.gy.push(c); c.discardTurn = G.turn; });
        log(`${P.name} ${you(P) ? 'discard' : 'discards'} ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
        if (n > 0) drawCards(P, n);
    },
    // Ashling, Flame Dancer
    async b_ashling(P, e, t, src) {
        P.ashN = P.ashTurn === G.turn ? P.ashN + 1 : 1; P.ashTurn = G.turn;
        const n = P.ashN;
        if (P.hand.length) await discardChosen(P, `${src.card.name}: discard a card`);
        drawCards(P, 1);
        if (n === 2) { for (const F of foes(P)) { bHurt(F, 2, src); F.bf.filter(isCreature).forEach(x => damage(x, 2, src)); } }
        if (n === 3) { P.pool = (P.pool || []).concat(['R', 'R', 'R', 'R']); log(`${P.name} add${you(P) ? '' : 's'} {R}{R}{R}{R}.`); }
    },
    // Malcolm, Alluring Scoundrel
    async b_malcolmA(P, e, t, src) {
        if (!onBf(src.uid)) return;
        src.ctr.chorus = (src.ctr.chorus || 0) + 1; log(`${src.card.name} gets a chorus counter (${src.ctr.chorus}).`);
        drawCards(P, 1);
        const d = P.hand.length ? await discardChosen(P, `${src.card.name}: discard a card`) : null;
        if (d && src.ctr.chorus >= 4 && Rx(d).kind !== 'land') {
            const yes = bIsHuman(P) ? await askYes(P, `${src.card.name}: cast ${d.card.name} without paying its mana cost?`, { card: d.card }) : true;
            if (yes) await castFreeFrom(P, d);
        }
    },
    // Phelia, Exuberant Shepherd
    async b_phelia(P, e, t, src) {
        const pool = allPerms().filter(x => x !== src && !/\bLand\b/.test(x.card.type));
        let x;
        if (bIsHuman(P)) x = await pickCard(P, pool, `${src.card.name}: exile up to one other target nonland permanent`, { optional: true });
        else x = pool.filter(y => y.owner !== P.i).sort((a, b) => permValue(b) - permValue(a))[0] || null;
        if (!x) return;
        const owner = G.players[x.realOwner ?? x.owner];
        log(`${src.card.name} exiles ${x.card.name}.`);
        leaveBattlefield(x, 'exile');
        atEndStep(() => {
            if (!owner.exile.includes(x)) return;
            pull(owner.exile, x); putOntoBattlefield(owner, x);
            if (owner === P && onBf(src.uid)) { const got = putCounters(src, 1, P); log(`${src.card.name} gets ${got} +1/+1 counter.`); }
        }, `${x.card.name} returns to the battlefield.`);
    },
    // Jaxis, the Troublemaker
    async b_jaxis(P, e, t, src) {
        const pool = P.bf.filter(y => isCreature(y) && y !== src);
        const x = await pickOwn(P, pool, `${src.card.name}: create a token copy of another target creature you control`, { rank: (a, b) => creatureValue(b) - creatureValue(a) });
        if (!x) return;
        const tok = tokenCopyOf(P, x.card);
        tok.sick = false; tok.tkw.push('haste');
        tok.card._r = { ...Rx(tok), trig: [...(Rx(tok).trig || []), { ev: 'dies', effects: [{ t: 'draw', n: 1 }] }] };
        atEndStep(() => { if (onBf(tok.uid)) sacPerm(P, tok); }, `${tok.card.name} is sacrificed.`);
    },
    // Tergrid, God of Fright
    async b_tergrid(P, e, t, src) {
        const x = G.ctxRaw && G.ctxRaw.o; if (!x || x.token) return;
        const X = G.players[x.realOwner ?? x.owner]; if (!X || X === P || !X.gy.includes(x)) return;
        const yes = bIsHuman(P) ? await askYes(P, `${src.card.name}: put ${x.card.name} onto the battlefield under your control?`, { card: x.card }) : true;
        if (yes) reanimateFrom(P, X, x);
    },
    // Freyalise, Llanowar's Fury
    b_freyalise(P, e, t, src) { const n = P.bf.filter(x => isCreature(x) && (x.card.colors || []).includes('G')).length; if (n) drawCards(P, n); },
    // Emiel the Blessed
    async b_emiel(P, e, t, src) {
        const pool = P.bf.filter(y => isCreature(y) && y !== src);
        const x = await pickOwn(P, pool, `${src.card.name}: exile another target creature you control, then return it`, { optional: true, rank: (a, b) => ((b.etbCount || 0) - (a.etbCount || 0)) || (Rx(b).etb.length - Rx(a).etb.length) });
        if (x && ((bIsHuman(P)) || Rx(x).etb.length)) await applyEffect(P, { t: 'flicker' }, { o: x }, src);
    },
    // Gríma, Saruman's Footman
    async b_grima(P, e, t, src) {
        const H = hitList().find(X => X !== P); if (!H) return;
        const exiled = []; let found = null;
        while (H.library.length) { const c = H.library.pop(); exiled.push(c); H.exile.push(c); if (/\b(Instant|Sorcery)\b/.test(c.card.type)) { found = c; break; } }
        log(`${H.name} exile${you(H) ? '' : 's'} ${exiled.length} card${exiled.length === 1 ? '' : 's'} from the top of ${you(H) ? 'your' : 'their'} library.`);
        if (found) {
            const yes = bIsHuman(P) ? await askYes(P, `${src.card.name}: cast ${found.card.name} without paying its mana cost?`, { card: found.card }) : true;
            if (yes) await castFreeFrom(P, found);
        }
        const rest = exiled.filter(c => H.exile.includes(c));
        rest.forEach(c => pull(H.exile, c)); H.library.unshift(...shuffle(rest));
    },
    // Gonti, Lord of Luxury
    async b_gonti(P, e, t, src) {
        const F = await bOpp(P, `${src.card.name}: look at the top four cards of which opponent's library?`); if (!F) return;
        const top = []; for (let i = 0; i < 4 && F.library.length; i++) top.push(F.library.pop());
        const pool = top.filter(c => Rx(c).kind !== 'land');
        const x = pool.length ? await pickOwn(P, pool, `${src.card.name}: exile one of them face down (you may cast it)`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) }) : null;
        F.library.unshift(...shuffle(top.filter(c => c !== x)));
        if (x) exilePlayFrom(P, F, x, 1e9);
    },
    // Nissa, Resurgent Animist
    async b_nissa(P, e, t, src) {
        P.nissaN = P.nissaTurn === G.turn ? P.nissaN + 1 : 1; P.nissaTurn = G.turn;
        const need = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        P.hand.forEach(c => ((c.card.cost || '').match(/\{([WUBRG])\}/g) || []).forEach(s => { need[s[1]]++; }));
        let col = Object.keys(need).sort((a, b) => need[b] - need[a])[0]; if (!need[col]) col = 'G';
        if (bIsHuman(P)) { const cols = ['W', 'U', 'B', 'R', 'G']; col = cols[await askMode(P, `${src.card.name}: add one mana of any color`, ['White', 'Blue', 'Black', 'Red', 'Green'])] || col; }
        P.pool = (P.pool || []).concat([col]); log(`${P.name} add${you(P) ? '' : 's'} {${col}}.`);
        if (P.nissaN === 2) {
            const rev = []; let got = null;
            while (P.library.length) { const c = P.library.pop(); rev.push(c); if (/\b(Elf|Elemental)\b/.test(c.card.type)) { got = c; break; } }
            if (got) { P.hand.push(got); log(`${P.name} reveal${you(P) ? '' : 's'} ${got.card.name} and put it into ${you(P) ? 'your' : 'their'} hand.`); }
            P.library.unshift(...shuffle(rev.filter(c => c !== got)));
        }
    },
    // Varragoth, Bloodsky Sire
    async b_varragoth(P, e, t, src) {
        let X = P;
        if (bIsHuman(P) && foes(P).length) { const all = G.players.filter(y => !y.out); X = all[await askMode(P, `${src.card.name}: target player searches their library`, all.map(y => y.name))] || P; }
        if (!X.library.length) return;
        const x = bIsHuman(X) ? (await pickCard(X, X.library, `${src.card.name}: search your library for a card to put on top`, { required: true })) || X.library[0] : X.library.slice().sort((a, b) => (b.card.cmc || 0) - (a.card.cmc || 0))[0];
        pull(X.library, x); shuffleLib(X); X.library.push(x);
        log(`${X.name} search${you(X) ? '' : 'es'} their library and put a card on top.`);
    },
    // Eladamri, Korvecdal
    async b_eladamri(P, e, t, src) {
        const hand = P.hand.filter(c => /\bCreature\b/.test(c.card.type));
        const top = P.library[P.library.length - 1];
        let fromHand = hand.length > 0;
        if (bIsHuman(P) && hand.length && top) fromHand = (await askMode(P, `${src.card.name}: reveal a card`, ['A creature card from your hand', 'The top card of your library'])) === 0;
        if (fromHand) {
            const x = await pickOwn(P, hand, `${src.card.name}: reveal a creature card from your hand`, { rank: (a, b) => (b.card.cmc || 0) - (a.card.cmc || 0) });
            if (x) { pull(P.hand, x); putOntoBattlefield(P, x); }
        } else if (top) {
            log(`${P.name} reveal${you(P) ? '' : 's'} ${top.card.name} from the top of ${you(P) ? 'your' : 'their'} library.`);
            if (/\bCreature\b/.test(top.card.type)) { pull(P.library, top); putOntoBattlefield(P, top); }
        }
    },
    // Mina and Denn, Wildborn
    async b_mina(P, e, t, src) {
        const x = await pickOwn(P, P.bf.filter(isCreature), `${src.card.name}: target creature gains trample`, { rank: (a, b) => pow(b) - pow(a) });
        if (x) { x.tkw.push('trample'); log(`${x.card.name} gains trample until end of turn.`); }
    },
    // Brago, King Eternal
    async b_brago(P, e, t, src) {
        const pool = P.bf.filter(x => !/\bLand\b/.test(x.card.type) && !x.token);
        if (bIsHuman(P)) {
            for (;;) {
                const left = pool.filter(x => onBf(x.uid)); if (!left.length) break;
                const x = await pickCard(P, left, `${src.card.name}: exile a nonland permanent you control, then return it (Cancel when done)`, { optional: true }); if (!x) break;
                await applyEffect(P, { t: 'flicker' }, { o: x }, src); pool.splice(pool.indexOf(x), 1);
            }
        } else for (const x of pool.filter(y => Rx(y).etb.length && onBf(y.uid))) await applyEffect(P, { t: 'flicker' }, { o: x }, src);
    },
    // Éowyn, Fearless Knight
    async b_eowyn(P, e, t, src) {
        const pool = foes(P).flatMap(F => F.bf).filter(x => isCreature(x) && pow(x) > pow(src));
        if (!pool.length) return;
        const x = bIsHuman(P) ? (await pickCard(P, pool, `${src.card.name}: exile target creature an opponent controls with greater power`, { required: true })) || pool[0] : pool.sort((a, b) => creatureValue(b) - creatureValue(a))[0];
        const cols = x.card.colors || [];
        log(`${src.card.name} exiles ${x.card.name}.`); leaveBattlefield(x, 'exile');
        P.bf.filter(y => isCreature(y) && /\bLegendary\b/.test(y.card.type)).forEach(y => { cols.forEach(c => y.tkw.push(`pro:${c}`)); });
        if (cols.length) log(`Legendary creatures you control gain protection from ${cols.map(c => COLOR_NAMES[c]).join(' and ')} until end of turn.`);
    },
    // Thalisse, Reverent Medium
    b_thalisse(P, e, t, src) {
        const n = (G.entered || []).filter(en => en.turn === G.turn && en.owner === P.i && en.o.token).length; if (n <= 0) return;
        applyEffect(P, { t: 'token', n, p: 1, q: 1, name: 'white Spirit', kw: ['flying'] }, null, src);
    },
    // Gluntch, the Bestower
    async b_gluntch(P, e, t, src) {
        const alive = G.players.filter(X => !X.out); const picks = [];
        for (let k = 0; k < 3; k++) {
            const left = alive.filter(X => !picks.includes(X)); if (!left.length) break;
            if (bIsHuman(P)) picks.push(left[await askMode(P, `${src.card.name}: choose a player to ${['put two +1/+1 counters on a creature they control', 'draw a card', 'create two Treasure tokens'][k]}`, left.map(X => X.name))] || left[0]);
            else picks.push(k === 0 ? (left.includes(P) ? P : left[0]) : left.slice().sort((a, b) => a.life - b.life)[0]);
        }
        if (picks[0]) { const X = picks[0]; const c = bIsHuman(X) ? await pickOwn(X, X.bf.filter(isCreature), `${src.card.name}: put two +1/+1 counters on a creature you control`, {}) : X.bf.filter(isCreature).sort((a, b) => creatureValue(b) - creatureValue(a))[0]; if (c) { const got = putCounters(c, 2, X); log(`${c.card.name} gets ${got} +1/+1 counters.`); } }
        if (picks[1]) drawCards(picks[1], 1);
        if (picks[2]) { makeArtifactToken(picks[2], 'treasure'); makeArtifactToken(picks[2], 'treasure'); log(`${picks[2].name} ${you(picks[2]) ? 'create' : 'creates'} two Treasure tokens.`); }
    },
    // Massacre Girl: the opening -1/-1 and the rest of the turn
    b_massacreGirl(P, e, t, src) {
        G.mgb = { turn: G.turn, uid: src.uid };
        G.players.forEach(X => X.bf.filter(x => isCreature(x) && x !== src).forEach(x => { x.tp -= 1; x.tq -= 1; }));
        log(`Each other creature gets -1/-1 until end of turn.`);
    },
});

// Massacre Girl: whenever a creature dies this turn, each creature other than her gets -1/-1
const bFire0 = fire;
fire = function (ev, ctx) {
    const r = bFire0.apply(this, arguments);
    if (ev === 'creatureDies' && G && G.mgb && G.mgb.turn === G.turn && ctx && ctx.o && ctx.o.uid !== G.mgb.uid) {
        G.players.forEach(X => X.bf.filter(x => isCreature(x) && x.uid !== G.mgb.uid).forEach(x => { x.tp -= 1; x.tq -= 1; }));
        log('Massacre Girl: each creature other than her gets -1/-1 until end of turn.');
    }
    return r;
};
// Iroas, God of Victory: prevent all damage that would be dealt to attacking creatures you control
const bDamage0 = damage;
damage = function (target, n, src) {
    if (target && target.card && target.uid !== undefined && G && G.attackers && G.attackers.includes(target.uid) && G.players[target.owner] && G.players[target.owner].bf.some(a => Rx(a).b_iroas && !lostAbilities(a))) {
        log(`Damage to ${target.card.name} is prevented (Iroas).`); return;
    }
    return bDamage0.apply(this, arguments);
};
// Linvala, Keeper of Silence: activated abilities of creatures your opponents control can't be activated
const bCanActivate0 = canActivate;
canActivate = function (P, o, a) {
    if (o && o.card && isCreature(o) && allPerms().some(x => x.owner !== o.owner && Rx(x).b_linvala && !lostAbilities(x))) return false;
    return bCanActivate0.apply(this, arguments);
};
