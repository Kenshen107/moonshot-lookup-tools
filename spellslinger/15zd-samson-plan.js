// Spellslinger Duels - Doc Samson game plan, round 2 (2026-11-18, owner: the combo pieces, the Sagas, Ring of Three Wishes, Boon of Boseiju, Centaur Glade...).
// Loaded after 15y-ai-plans.js and 15zc-mana-abilities.js; it only adds to the Doc Samson plan (DECK_PLANS) and to the computer's choices while that plan is on.
//  * Infinite mana now also comes from Sword of the Paruns (tapped creatures get +2/+0, so Samson taps for power + 2 and untaps for {3}) and from any creature that taps for
//    mana equal to its power (Kami of Whispered Hopes), with Staff of Domination, Umbral Mantle or the Sword.
//  * One-shot untappers are used for real before spells are cast: Nature's Chosen ({0}: untap), Boon of Boseiju, Staff of Domination.
//  * Counters, pump and untap effects go to Doc Samson first (the Sagas' counters make him the mana engine).
//  * With infinite mana: Ring of Three Wishes fetches the missing combo piece / Surestrike Trident, Goblin Cannon finishes (15y), Centaur Glade stops at 24 Centaurs.
//  * Spells that draw cards equal to a creature's power never draw the library out.

const SM_NAME = 'Doc Samson, Super Psychiatrist';
const SM_ENGINE_MORE = ['Kami of Whispered Hopes', 'Spike Feeder', 'Sword of the Paruns', 'Astral Cornucopia', 'Everflowing Chalice', 'Temur Sabertooth', "Nature's Chosen",
    'The Aesir Escape Valhalla', 'The First Iroan Games', 'Origin of the Hulk', 'Jugan Defends the Temple', 'Centaur Glade', 'Ring of Three Wishes', "Magistrate's Scepter",
    'Gamma Grotesque', 'Goliath, Mass Manipulator', 'Boon of Boseiju', 'Umbral Mantle', 'Staff of Domination', 'Coalition Relic', 'Empowered Autogenerator'];
const smPowMana = o => { const a = typeof maStaticAct === 'function' ? maStaticAct(o) : null; return !!a && a.effects.some(e => e.anyPow); };
const smMana = P => P.bf.filter(x => isCreature(x) && !x.tapped && !x.sick && !lostAbilities(x) && smPowMana(x));
{
    const pl = DECK_PLANS[SM_NAME];
    if (pl) {
        pl.engine = [...new Set([...pl.engine, ...SM_ENGINE_MORE])];
        pl.favorite = SM_NAME;
        pl.loops = [{
            name: 'a creature that taps for its power, an untapper and its own mana',
            online(P) {
                for (const s of smMana(P)) {
                    const x = pow(s);
                    const staff = onBfNamed(P, 'Staff of Domination');
                    if (staff && !staff.tapped && x >= 5) return { pump: 0, infinite: true };
                    const mantle = P.bf.find(m => m.card.name === 'Umbral Mantle' && m.attachedTo === s.uid);
                    if (mantle && x >= 3) return { pump: 999, target: s, infinite: true };
                    // Sword of the Paruns: tapped, the creature gets +2/+0 (it taps for power + 2), and {3} untaps it
                    const sword = P.bf.find(m => m.card.name === 'Sword of the Paruns' && m.attachedTo === s.uid);
                    if (sword && x + 2 >= 4) return { pump: 0, infinite: true };
                }
                return null;
            }, mana: 16, color: 'G',
        }];
        pl.pre = async function (P) { await samsonFloat(P); };
    }
}

// ---- one-shot untappers: tap Doc Samson for mana, untap him, keep the mana floating for the main phase ----
// Mana from tapping goes to the pool (it stays there until the step ends). Each untapper must give back more mana than it costs.
async function samsonFloat(P) {
    if (infiniteNow(P) || G.over) return;
    for (let k = 0; k < 4 && !G.over; k++) {
        const s = smMana(P).find(x => x.card.name === SM_NAME) || smMana(P)[0]; if (!s) return;
        const m = manaOf(s); if (!m || m.n < 3) return;
        const chosen = P.bf.find(a => a.card.name === "Nature's Chosen" && a.attachedTo === s.uid && !lostAbilities(a) && !(s.actTurn && s.actTurn.chosen === G.turn));
        const boon = P.hand.find(c => c.card.name === 'Boon of Boseiju');
        const staff = onBfNamed(P, 'Staff of Domination');
        const hasUntap = chosen || (boon && m.n >= 4 && canCastNow(P, boon)) || (staff && !staff.tapped && m.n >= 5);
        if (!hasUntap) return;
        // tap Doc Samson into the pool
        s._payColor = 'G'; const n = m.n; tapSource(P, s);
        P.pool = (P.pool || []).concat(Array(n).fill('G')); P.keepPoolTurn = G.turn;
        log(`${P.name} taps ${s.card.name} for ${n} {G} and keeps it in the mana pool.`);
        if (chosen) {
            s.actTurn = s.actTurn || {}; s.actTurn.chosen = G.turn; s.tapped = false; fire('untapped', { o: s });
            log(`${chosen.card.name} untaps ${s.card.name} ({0}).`); plPol('floatUntaps'); continue;
        }
        if (staff && !staff.tapped && m.n >= 5 && P.pool.length >= 4) {
            const pay = planPayment(P, parseCost('{3}'), 0, null, { poolOnly: true });
            if (pay) { pay.forEach(x => tapSource(P, x)); staff.tapped = true; s.tapped = false; log(`${staff.card.name} untaps ${s.card.name} ({3}).`); plPol('floatUntaps'); continue; }
        }
        if (boon && canCastNow(P, boon) && canPay(P, boon)) {
            try { await castSpell(P, boon, { o: s }); await settle(); plPol('floatUntaps'); } catch (err) { /* keep playing */ }
            continue;
        }
        return;
    }
}

// ---- Doc Samson gets the counters, the pump and the untap ----
{
    const apt = aiPickTarget;
    aiPickTarget = function (P, e, source, valid) {
        const t = apt.apply(this, arguments);
        try {
            if (planOn(P) && planOf(P) && planOf(P).favorite && e && (e.good || ['counters', 'pump', 'untap', 'cmd'].includes(e.t))) {
                const fav = onBfNamed(P, planOf(P).favorite);
                if (fav && (!t || !t.o || t.o.owner === P.i) && (valid || validTargets(P, e, source)).some(v => v.o === fav)) return { ...(t || {}), o: fav };
            }
        } catch (err) { /* keep the default */ }
        return t;
    };
}

// ---- Ring of Three Wishes: fetch the missing combo piece, else Surestrike Trident, else the best value ----
function samsonWants(P) {
    const have = n => P.bf.some(x => x.card.name === n) || P.hand.some(x => x.card.name === n);
    const want = [];
    if (!have('Surestrike Trident')) want.push('Surestrike Trident');
    if (!have('Sword of the Paruns')) want.push('Sword of the Paruns');
    if (!have('Staff of Domination')) want.push('Staff of Domination');
    if (!have('Umbral Mantle')) want.push('Umbral Mantle');
    want.push('Kalonian Hydra', 'Hydra Broodmaster', "Rishkar's Expertise");
    return want;
}
{
    const pc = pickCard;
    pickCard = function (P, list, title, opts) {
        if (P && P.isAI && planOn(P) && planOf(P) && planOf(P).favorite === SM_NAME && /choose a card/.test(String(title)) && list.length) {
            for (const nm of samsonWants(P)) { const hit = list.find(c => c.card && c.card.name === nm); if (hit) return Promise.resolve(hit); }
        }
        return pc.apply(this, arguments);
    };
}

// ---- guards: no 60 Centaurs, never draw the library out ----
{
    AI_ACT_GUARDS['Centaur Glade'] = P => P.bf.filter(x => x.token && /centaur/i.test(x.card.name)).length >= 24;
    const DRAW_BY_POWER = ["Return of the Wildspeaker", "Rishkar's Expertise"];
    const ccn = canCastNow;
    canCastNow = function (P, o) {
        if (P && P.isAI && o && o.card && DRAW_BY_POWER.includes(o.card.name)) {
            const g = Math.max(0, ...P.bf.filter(isCreature).map(pow));
            if (g >= P.library.length - 2) return false; // it would draw the library out
        }
        return ccn.apply(this, arguments);
    };
}

// ---- round 3 (2026-11-18, owner: "work on fixing up the rest of the logic that's not done") ----
//  * Magistrate's Scepter: charged with spare mana ({4},{T}; Doc Samson makes each activation two counters), then the extra turn (three counters).
//  * Screaming Shield on Doc Samson with infinite mana: {2},{T}: mill three, again and again - the computer mills every opponent's whole library (they lose at their next draw).
//  * Ring of Three Wishes: used for its three fetches with infinite mana.
//  * Temur Sabertooth resets the power-ups: it returns Gamma Grotesque / Goliath, recast, power up again, until the combo piece shows up or the library is down to 14.
{
    const isTri = c => c.card.name === 'Surestrike Trident';
    const haveWin = P => P.bf.some(isTri) || P.hand.some(isTri) || !!onBfNamed(P, 'Goblin Cannon');
    const orig = CMD.sx_sabertooth;
    CMD.sx_sabertooth = async function (P, e, t, src) {
        const c = P && P.dcSabPick; P.dcSabPick = null;
        if (c && onBf(c.uid)) { leaveBattlefield(c, 'hand'); log(`${c.card.name} returns to ${P.name === 'You' ? 'your' : `${P.name}'s`} hand.`); if (onBf(src.uid)) { src.tkw.push('indestructible'); log(`${src.card.name} gains indestructible until end of turn.`); } return; }
        return orig.apply(this, arguments);
    };
    async function samsonDrawCycle(P) {
        const sab = onBfNamed(P, 'Temur Sabertooth'); if (!sab) return;
        for (let i = 0; i < 8 && !G.over; i++) {
            if (P.library.length < 14 || haveWin(P)) return;
            let did = false;
            for (const nm of ['Gamma Grotesque', 'Goliath, Mass Manipulator']) {
                let c = onBfNamed(P, nm);
                if (!c) { const h = P.hand.find(x => x.card.name === nm); if (h && canCastNow(P, h) && canPay(P, h)) { await castSpell(P, h, null); await settle(); c = onBfNamed(P, nm); } }
                if (!c) continue;
                const up = actsOf(c).find(a => a.powerUp);
                if (up && canActivate(P, c, up)) { await activate(P, c, up); await settle(); did = true; continue; }
                const sa = actsOf(sab)[0];
                if (sa && canActivate(P, sab, sa)) { P.dcSabPick = c; await activate(P, sab, sa); await settle(); P.dcSabPick = null; did = true; }
            }
            if (!did) return;
        }
    }
    async function samsonShieldMill(P) {
        const sam = onBfNamed(P, SM_NAME); if (!sam) return false;
        let sh = onBfNamed(P, 'Screaming Shield');
        if (!sh) { const h = P.hand.find(c => c.card.name === 'Screaming Shield'); if (h && canCastNow(P, h) && canPay(P, h)) { await castSpell(P, h, null); await settle(); sh = onBfNamed(P, 'Screaming Shield'); } }
        if (!sh) return false;
        if (sh.attachedTo !== sam.uid) { try { await equip(P, sh, sam); } catch (err) { return false; } }
        if (sh.attachedTo !== sam.uid) return false;
        log(`🔁 ${P.name} gives ${sam.card.name} Screaming Shield and, with infinite mana, taps him to mill three, untaps and does it again until every opponent's library is empty.`);
        plPol('shieldMill');
        for (const f of foes(P)) { if (f.library.length) doMill(f, f.library.length); }
        await settle();
        return true;
    }
    async function samsonRing(P) {
        for (let i = 0; i < 4 && !G.over; i++) {
            const ring = onBfNamed(P, 'Ring of Three Wishes'); if (!ring || !(ring.ctr.wish > 0) || haveWin(P)) return;
            const a = actsOf(ring)[0]; if (!a || !canActivate(P, ring, a)) return;
            await activate(P, ring, a); await settle();
            // the Ring is the one thing that untaps for free here: Doc Samson's loop untaps everything else
            ring.tapped = false;
        }
    }
    const pl = DECK_PLANS[SM_NAME];
    if (pl) {
        const oldPost = pl.post;
        pl.post = async function (P) {
            if (infiniteNow(P) && !G.over && !onBfNamed(P, 'Goblin Cannon')) {
                try { await samsonRing(P); } catch (err) { /* keep playing */ }
                try { if (await samsonShieldMill(P)) return; } catch (err) { /* keep playing */ }
                try { await samsonDrawCycle(P); } catch (err) { /* keep playing */ }
            }
            return oldPost.apply(this, arguments);
        };
        // Magistrate's Scepter: charge it with spare mana, then take the extra turn
        pl.abilities = async function (P) {
            const sc = onBfNamed(P, "Magistrate's Scepter"); if (!sc || G.over) return;
            const acts = actsOf(sc), charge = acts.find(a => a.effects && a.effects.some(e => e.t === 'namedCounter')), turn = acts.find(a => a.effects && a.effects.some(e => e.t === 'extraTurn'));
            if (turn && canActivate(P, sc, turn)) { await activate(P, sc, turn); await settle(); plPol('extraTurns'); return; }
            if (charge && (sc.ctr.charge || 0) < 3 && canActivate(P, sc, charge)) { await activate(P, sc, charge); await settle(); }
        };
    }
}
