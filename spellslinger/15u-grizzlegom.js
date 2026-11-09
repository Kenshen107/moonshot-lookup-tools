// Spellslinger Duels - engine pieces for the Grizzlegom, Hurloon Hero domain / land deck (2026-11-09). Wordings: rules/grizzlegom.js. CMD ids start with gz_.
// Approximations (nothing is marked Partly): Full Throttle's extra combats come after the regular combat (cast in your second main phase they never happen); "basic land types among lands you control" counts the five types printed on lands (and Quicksilver Fountain-style
// additions through hasType); Tromp the Domains and The Weatherseed Treaty fix the bonus when they resolve instead of tracking the count; Elemental Teachings' opponent
// puts the two best lands into the graveyard (a person is asked); Escape to the Wilds' exiled cards last until the end of your next turn counted in turns of the living players.

const gzLands = P => P.bf.filter(x => /\bLand\b/.test(x.card.type));
const gzLandType = (P, ty) => gzLands(P).filter(x => hasType(x, ty)).length;
const gzDomain = P => BASIC_TYPES.filter(t => gzLands(P).some(x => hasType(x, t))).length;
const gzIsLand = c => /\bLand\b/.test(c.card.type);
const gzIsPermanent = c => !['instant', 'sorcery'].includes(Rx(c).kind);
// How good a land card is to keep: nonbasic lands with more types first
const gzLandRank = c => (/\bBasic\b/.test(c.card.type) ? 0 : 2) + BASIC_TYPES.filter(t => new RegExp(`\\b${t}\\b`).test(c.card.type)).length;
// Revealed cards you don't keep go to the bottom in a random order (library[0] is the bottom)
const gzBottom = (P, cards) => { if (cards.length) P.library.unshift(...shuffle(cards.slice())); };

COUNT_EXTRA.push([/^(?:the number of )?basic land types among lands you control$/, () => o => gzDomain(G.players[o.owner])]);

Object.assign(CMD, {
    // Grizzlegom: one effect per basic land type
    async gz_grizzlegom(P, e, t, src) {
        const pl = gzLandType(P, 'Plains'), is = gzLandType(P, 'Island'), sw = gzLandType(P, 'Swamp'), mo = gzLandType(P, 'Mountain'), fo = gzLandType(P, 'Forest');
        if (pl) await applyEffect(P, { t: 'token', n: pl, p: 1, q: 1, name: 'white Soldier', kw: [] }, null, src);
        if (is) drawCards(P, is);
        if (sw) foes(P).forEach(F => { F.life -= sw; F.lostTurn = G.turn; log(`${F.name} ${you(F) ? 'lose' : 'loses'} ${sw} life.`); fire('loseLife', { P: F, n: sw }); });
        if (mo && onBf(src.uid)) { const got = putCounters(src, mo, P); log(`${src.card.name} gets ${got} +1/+1 counter${got === 1 ? '' : 's'}.`); }
        if (fo) gainLifeFor(P, fo);
    },
    // Branching Timeline: reveal one card per differently named land; permanents come in tapped, the rest go to the bottom
    gz_timeline(P, e, t, src) {
        const x = tkNamedLands(P), top = P.library.splice(Math.max(0, P.library.length - x), x).reverse();
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${top.map(c => c.card.name).join(', ') || 'nothing'}.`);
        const keep = top.filter(gzIsPermanent);
        keep.forEach(c => putOntoBattlefield(P, c, true));
        gzBottom(P, top.filter(c => !keep.includes(c)));
    },
    // Elemental Teachings: up to four lands with different names; an opponent sends two to the graveyard, the rest enter tapped
    async gz_teachings(P, e, t, src) {
        const pool = P.library.filter(gzIsLand);
        let chosen = [];
        if (P.isAI || AUTOPLAY) { for (const c of pool.slice().sort((a, b) => gzLandRank(b) - gzLandRank(a))) { if (chosen.length < 4 && !chosen.some(x => x.card.name === c.card.name)) chosen.push(c); } }
        else chosen = await jvPickSeveral(P, pool, `${src.card.name}: search for a land`, 4, (x, got) => !got.some(c => c.card.name === x.card.name));
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${chosen.map(c => c.card.name).join(', ') || 'nothing'}.`);
        const Q = opp(P), toGy = [];
        for (let k = 0; k < 2 && chosen.length > toGy.length; k++) {
            const left = chosen.filter(c => !toGy.includes(c));
            const pick = (Q.isAI || AUTOPLAY || Q === P) ? left.slice().sort((a, b) => gzLandRank(b) - gzLandRank(a))[0] : await pickCard(Q, left, `${src.card.name}: choose a land to go to the graveyard (${k + 1} of 2)`, { required: true });
            toGy.push(pick || left[0]);
        }
        toGy.forEach(c => { pull(P.library, c); P.gy.push(c); c.gyTurn = G.turn; });
        chosen.filter(c => !toGy.includes(c)).forEach(c => putOntoBattlefield(P, c, true));
        log(`${toGy.map(c => c.card.name).join(' and ') || 'No land'} ${toGy.length === 1 ? 'goes' : 'go'} to the graveyard.`);
        P.library = shuffle(P.library);
    },
    // Escape to the Wilds: exile five, play them until the end of your next turn (one turn of every living player)
    gz_escape(P, e, t, src) {
        const got = P.library.splice(Math.max(0, P.library.length - 5), 5).reverse();
        if (got.length && typeof exiledOwn === 'function') exiledOwn(P);
        const until = G.turn + G.players.filter(x => !x.out).length;
        got.forEach(x => { P.exile.push(x); x.playUntil = until; });
        log(`${P.name} ${you(P) ? 'exile' : 'exiles'} ${got.map(x => x.card.name).join(', ') || 'nothing'} from the top of the library (playable until the end of the next turn).`);
    },
    // Fblthp, Knows the Way: up to X basic lands with different names to your hand
    async gz_fblthp(P, e, t, src) {
        const x = typeof e.x === 'number' ? e.x : (src.xVal || 0), pool = P.library.filter(c => /\bBasic\b/.test(c.card.type) && gzIsLand(c));
        let chosen = [];
        if (x > 0) {
            if (P.isAI || AUTOPLAY) { const have = ty => gzLandType(P, ty); for (const c of pool.slice().sort((a, b) => Math.min(...BASIC_TYPES.filter(ty => new RegExp(`\\b${ty}\\b`).test(a.card.type)).map(have)) - Math.min(...BASIC_TYPES.filter(ty => new RegExp(`\\b${ty}\\b`).test(b.card.type)).map(have)))) { if (chosen.length < x && !chosen.some(y => y.card.name === c.card.name)) chosen.push(c); } }
            else chosen = await jvPickSeveral(P, pool, `${src.card.name}: search for a basic land`, x, (c, got) => !got.some(y => y.card.name === c.card.name));
        }
        chosen.forEach(c => { pull(P.library, c); P.hand.push(c); });
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${chosen.map(c => c.card.name).join(', ') || 'nothing'} and ${you(P) ? 'put' : 'puts'} ${chosen.length === 1 ? 'it' : 'them'} into ${you(P) ? 'your' : 'their'} hand.`);
        P.library = shuffle(P.library);
    },
    // Stable Wormhole: a tapped New Planet land token that makes any color
    gz_planet(P, e, t, src) {
        const card = { id: `token-planet-${uidSeq}`, name: 'New Planet', fullName: 'New Planet token', cost: '', cmc: 0, type: 'Token Land — Planet', text: '{T}: Add one mana of any color.', colors: [], ci: [], img: null, imgS: null, legal: {} };
        const o = makeObj(card, P.i, { token: true, sick: false });
        o.tapped = true; o.enteredTurn = G.turn; P.bf.push(o);
        log(`${P.name} ${you(P) ? 'create' : 'creates'} a tapped Planet land token named New Planet.`);
        fire('landfall', { o });
    },
    // Summer Bloom: three more land plays this turn
    gz_summer(P) { const cur = P.extraLandTurn === G.turn ? (P.extraLandN || 1) : 0; P.extraLandTurn = G.turn; P.extraLandN = cur + 3; log(`${P.name} ${you(P) ? 'may' : 'may'} play up to three additional lands this turn.`); },
    // The Weatherseed Treaty, chapter III
    gz_weatherseed(P, e, t, src) {
        const c = t && t.o; if (!c || !onBf(c.uid)) return;
        const x = gzDomain(P); c.tp += x; c.tq += x; c.tkw.push('trample');
        log(`${c.card.name} gets +${x}/+${x} and gains trample until end of turn.`);
    },
    // Through the Forest Gate: top twenty, any number of lands onto the battlefield tapped, shuffle, gain 8
    async gz_forestGate(P, e, t, src) {
        const top = P.library.splice(Math.max(0, P.library.length - 20), 20).reverse(), lands = top.filter(gzIsLand);
        let chosen = lands;
        if (!(P.isAI || AUTOPLAY) && lands.length && !(await askYes(P, `${src.card.name}: put all ${lands.length} land${lands.length === 1 ? '' : 's'} from the top twenty onto the battlefield tapped?`, { card: src.card, yes: 'Put all', no: 'Choose' }))) chosen = await frPickMany(P, lands, `${src.card.name}: put a land onto the battlefield tapped`, lands.length, lands);
        chosen.forEach(c => putOntoBattlefield(P, c, true));
        P.library.push(...top.filter(c => !chosen.includes(c))); P.library = shuffle(P.library);
        log(`${P.name} ${you(P) ? 'put' : 'puts'} ${chosen.length} land${chosen.length === 1 ? '' : 's'} onto the battlefield tapped.`);
        gainLifeFor(P, 8);
    },
    // Tromp the Domains: trample and +1/+1 per basic land type for your creatures until end of turn
    gz_tromp(P) {
        const x = gzDomain(P), mine = P.bf.filter(isCreature);
        mine.forEach(c => { c.tp += x; c.tq += x; c.tkw.push('trample'); });
        log(`Creatures ${you(P) ? 'you control' : `${P.name} controls`} gain trample and get +${x}/+${x} until end of turn.`);
    },
    // U.S.S. Voyager: reveal until two lands, lands enter tapped, the rest go to the bottom
    gz_voyager(P, e, t, src) {
        const lands = [], rest = [];
        while (lands.length < 2 && P.library.length) { const c = P.library.pop(); (gzIsLand(c) ? lands : rest).push(c); }
        log(`${P.name} ${you(P) ? 'reveal' : 'reveals'} ${[...rest, ...lands].map(c => c.card.name).join(', ') || 'nothing'}.`);
        lands.forEach(c => putOntoBattlefield(P, c, true));
        gzBottom(P, rest);
    }
});

// Full Throttle: at the beginning of each combat this turn, the creatures that attacked this turn untap
(function () {
    const f = fire;
    fire = function (ev, ctx) {
        if (ev === 'combat' && G && G.throttleTurn === G.turn) {
            const P = G.players[G.active], ut = P ? P.bf.filter(x => isCreature(x) && x.attackedTurn === G.turn && x.tapped) : [];
            if (ut.length) { ut.forEach(x => { x.tapped = false; }); log(`${ut.map(x => x.card.name).join(', ')} untap${ut.length === 1 ? 's' : ''} (Full Throttle).`); }
        }
        return f.apply(this, arguments);
    };
})();
Object.assign(CMD, {
    // Two additional combat phases after the regular one (the engine runs additional combats after combat damage)
    gz_throttle(P) { G.extraCombat = (G.extraCombat || 0) + 2; G.throttleTurn = G.turn; log(`There will be two additional combat phases after this main phase; creatures that attacked untap at each combat.`); }
});
Object.assign(CMD_SCORE, { gz_throttle: P => (P.bf.filter(isCreature).length >= 2 ? 8 : 0),
    gz_grizzlegom: () => 1, gz_timeline: P => Math.min(10, tkNamedLands(P) * 1.5), gz_teachings: P => (P.library.some(gzIsLand) ? 5 : 0), gz_escape: () => 7,
    gz_summer: P => (P.hand.filter(gzIsLand).length >= 2 ? 6 : 0), gz_forestGate: P => (P.library.slice(-20).filter(gzIsLand).length >= 4 ? 8 : 3), gz_tromp: P => (P.bf.filter(isCreature).length >= 2 ? 3 + gzDomain(P) * P.bf.filter(isCreature).length * 0.8 : 0),
    gz_weatherseed: () => 4, gz_planet: () => 3, gz_voyager: () => 6, gz_fblthp: () => 5
});
