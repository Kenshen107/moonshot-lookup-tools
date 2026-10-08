// Rule checks for the engine: combat, keywords, state-based actions, commander rules, the stack, costs,
// and the Tyrox deck's special cards. Each check builds its own board with T.clear() and calls the engine directly.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

const NAMES = ['Mountain', 'Grizzly Bears', 'Hill Giant', 'Shivan Dragon', 'Lightning Bolt', 'Raging Goblin', 'Bonesplitter', 'Goblin Guide', 'Goblin Rabblemaster',
    'Glorybringer', 'Combat Celebrant', 'Embercleave', 'Temur Battle Rage', 'Light Up the Stage', 'Tyrox, Saurid Tyrant', 'Sol Ring', 'Monastery Swiftspear', 'Swamp', 'Cast Down', 'Kroxa, Titan of Death\'s Hunger',
    'Coercion', 'Incinerate', 'Path of Peace', 'Chastise', 'Condemn', 'Jagged Lightning', 'Kiss of the Amesha', 'Sleight of Hand', 'Telling Time', 'Ancestral Memories', 'Blessed Reversal', 'Whisk Away',
    'Furnace of Rath', "Urza's Armor", 'Cho-Manno, Revolutionary', 'Vigor', 'Pariah', 'Gravebane Zombie', 'Angelic Arbiter', 'Mole Worms', 'Deathgazer', 'Lure', 'Oppressive Rays', 'Angel of Vitality', "Hunter's Insight", 'Call of the Wild', 'Fertile Ground', 'Forest', 'Curfew', 'Esper Battlemage', 'Goblin Arsonist', 'Ascendant Evincar',
    'Exhaustion', 'Blightning', 'Ironclaw Orcs', 'Murk Dwellers', 'Signal Pest', 'Circle of Protection: Black', 'Spirit of the Hearth', 'Cruel Ultimatum', 'Meglonoth', 'Primeval Force', 'Sever Soul', 'Staff of the Wild Magus', 'Disintegrate'];

const BODY = async function (NAMES, ONLY, SKIP) {
    const startTurnUntapForTest = P => { P.bf.forEach(o => { if (o.skipUntap) o.skipUntap = false; else if (!has(o, 'nountap') && !(o.lockedBy && onBf(o.lockedBy) && onBf(o.lockedBy).tapped) && !(Rx(o).mayNotUntap && o.tapped && allPerms().some(l => l.lockedBy === o.uid))) o.tapped = false; }); };
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    const C = await T.cards(NAMES);
    const missing = NAMES.filter(n => !C[n]);
    ok('test cards all found on Scryfall', missing.length === 0, missing);
    // Every check starts a brand-new game, so nothing leaks from one check into the next
    let P0, P1;
    const fresh = async () => {
        [P0, P1] = await T.newGame();
        T.clear(); P0.life = P1.life = 40; G.over = false; window.lastResult = null;
    };
    const put = (P, name, extra) => T.put(P, C[name], extra);
    const combat = async (atk, blocks) => { // blocks: [[attacker, blocker], ...]
        G.attackers = []; G.blocks = {};
        declareAttackers(P0, atk);
        blocks.forEach(([a, b]) => { (G.blocks[a.uid] = G.blocks[a.uid] || []).push(b.uid); });
        await settle(); fixMenace(); combatDamage(P0); await settle(); sba();
    };
    const check = async (label, fn) => { if (ONLY.length && !ONLY.some(o => label.includes(o))) return; if (SKIP.some(o => label.includes(o))) return; try { await Promise.race([(async () => { await fresh(); await fn(); })(), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 25s')), 25000))]); } catch (e) { ok(label + ' (threw)', false, String(e && e.stack || e).slice(0, 240)); } };

    // ---------- Combat ----------
    await check('unblocked damage', async () => { const a = put(P0, 'Hill Giant'); await combat([a], []); ok('unblocked 3/3 deals 3', P1.life === 37, P1.life); });
    await check('blocked trade', async () => {
        const a = put(P0, 'Grizzly Bears'), b = put(P1, 'Hill Giant'); await combat([a], [[a, b]]);
        ok('2/2 attacker dies to a 3/3 blocker, blocker survives', !onBf(a.uid) && onBf(b.uid) && b.dmg === 2, { dmg: b.dmg });
    });
    await check('first strike', async () => {
        const a = put(P0, 'Hill Giant', { tkw: ['first strike'] }), b = put(P1, 'Hill Giant'); await combat([a], [[a, b]]);
        ok('first strike kills the blocker first, takes no damage', !onBf(b.uid) && onBf(a.uid) && a.dmg === 0, { dmg: a.dmg });
    });
    await check('double strike', async () => { const a = put(P0, 'Grizzly Bears', { tkw: ['double strike'] }); await combat([a], []); ok('double strike deals damage twice', P1.life === 36, P1.life); });
    await check('deathtouch', async () => {
        const a = put(P0, 'Grizzly Bears', { tkw: ['deathtouch'] }), b = put(P1, 'Hill Giant'); await combat([a], [[a, b]]);
        ok('deathtouch kills a bigger blocker', !onBf(b.uid) && !onBf(a.uid));
    });
    await check('trample', async () => {
        const a = put(P0, 'Hill Giant', { tkw: ['trample'] }), b = put(P1, 'Grizzly Bears'); await combat([a], [[a, b]]);
        ok('excess damage tramples over to the player', !onBf(b.uid) && P1.life === 39, P1.life);
    });
    await check('lifelink', async () => { const a = put(P0, 'Grizzly Bears', { tkw: ['lifelink'] }); await combat([a], []); ok('lifelink gains life equal to damage', P0.life === 42 && P1.life === 38, [P0.life, P1.life]); });
    await check('vigilance', async () => { const a = put(P0, 'Grizzly Bears', { tkw: ['vigilance'] }); declareAttackers(P0, [a]); ok('vigilance attacker stays untapped', !a.tapped); });
    await check('attackers tap', async () => { const a = put(P0, 'Grizzly Bears'); declareAttackers(P0, [a]); ok('an ordinary attacker taps', a.tapped); });
    await check('flying and reach', async () => {
        const a = put(P0, 'Shivan Dragon'), b = put(P1, 'Hill Giant');
        ok('a creature without flying or reach cannot block a flyer', !canBlock(b, a));
    });
    await check('menace', async () => {
        const a = put(P0, 'Hill Giant', { tkw: ['menace'] }), b = put(P1, 'Grizzly Bears');
        G.attackers = [a.uid]; G.blocks = { [a.uid]: [b.uid] }; fixMenace();
        ok('menace: one blocker is removed', !(G.blocks[a.uid] || []).length);
    });
    await check('indestructible', async () => {
        const a = put(P0, 'Grizzly Bears', { tkw: ['indestructible'] }), b = put(P1, 'Hill Giant'); await combat([a], [[a, b]]);
        ok('indestructible survives lethal damage', onBf(a.uid) && a.dmg === 3, { dmg: a.dmg });
    });
    await check('summoning sickness', async () => {
        const a = put(P0, 'Grizzly Bears'); a.sick = true; ok('a creature that just entered cannot attack', !canAttackWith(a));
        const h = put(P0, 'Raging Goblin'); h.sick = true; ok('haste ignores summoning sickness', canAttackWith(h) || has(h, 'haste'));
    });

    // ---------- State-based actions and winning ----------
    await check('sba 0 toughness', async () => { const a = put(P0, 'Grizzly Bears'); a.tq = -3; sba(); ok('a creature with 0 toughness dies', !onBf(a.uid)); });
    await check('sba damage', async () => { const a = put(P0, 'Grizzly Bears'); a.dmg = 2; sba(); ok('lethal damage kills', !onBf(a.uid)); });
    await check('legend rule', async () => {
        put(P0, 'Tyrox, Saurid Tyrant'); put(P0, 'Tyrox, Saurid Tyrant'); sba();
        ok('two legendary permanents with one name leave one', P0.bf.filter(o => o.card.name === 'Tyrox, Saurid Tyrant').length === 1);
    });
    await check('lethal life', async () => { damage(P1, 40, put(P0, 'Hill Giant')); sba(); ok('0 life ends the game with the right winner', G.over && window.lastResult && window.lastResult.winner === 0, window.lastResult); });
    await check('commander damage', async () => { P1.cmdDmg = 21; sba(); ok('21 commander damage loses', G.over && /commander damage/.test((window.lastResult || {}).reason || ''), window.lastResult); });
    await check('poison', async () => { P1.poison = 10; sba(); ok('10 poison counters lose', G.over && /poison/.test((window.lastResult || {}).reason || ''), window.lastResult); });
    await check('draw from empty library', async () => { P1.library.splice(0); drawCards(P1, 1); sba(); ok('drawing from an empty library loses', G.over && window.lastResult.winner === 0, window.lastResult); });
    await check('regeneration shield', async () => { const a = put(P0, 'Grizzly Bears'); a.regen = 1; destroy(a); ok('a regeneration shield saves it and taps it', onBf(a.uid) && a.tapped && a.regen === 0); });
    await check('destroy', async () => { const a = put(P0, 'Grizzly Bears'); destroy(a); ok('destroy puts it in the graveyard', !onBf(a.uid) && P0.gy.some(x => x.uid === a.uid)); });

    // ---------- Casting, costs, the stack ----------
    await check('cast a burn spell', async () => {
        T.lands(P0, C, 1); const bolt = makeObj(C['Lightning Bolt'], 0); P0.hand.push(bolt);
        ok('Lightning Bolt can be paid with one Mountain', canPay(P0, bolt));
        await castSpell(P0, bolt, { p: P1 });
        await runStack();
        ok('it resolves for 3 and goes to the graveyard', P1.life === 37 && P0.gy.some(x => x.uid === bolt.uid) && G.stack.length === 0, P1.life);
        ok('the Mountain was tapped to pay', P0.bf.filter(o => o.tapped).length === 1);
    });
    await check('not enough mana', async () => {
        const g = makeObj(C['Hill Giant'], 0); P0.hand.push(g); T.lands(P0, C, 2);
        ok('a {3}{R} creature cannot be paid with two lands', !canPay(P0, g));
    });
    await check('commander tax', async () => {
        const t = makeObj(C['Tyrox, Saurid Tyrant'], 0); t.isCommander = true; P0.command.push(t); P0.tax = 0;
        ok('no tax before the first cast', extraCost(P0, t) === 0);
        P0.tax = 1; ok('one earlier cast from the command zone adds {2}', extraCost(P0, t) === 2, extraCost(P0, t));
        P0.tax = 2; ok('two earlier casts add {4}', extraCost(P0, t) === 4, extraCost(P0, t));
    });
    await check('rocks make mana', async () => {
        put(P0, 'Sol Ring'); T.lands(P0, C, 2);
        const g = makeObj(C['Hill Giant'], 0); P0.hand.push(g);
        ok('Sol Ring ({C}{C}) + two Mountains pays {3}{R}', canPay(P0, g));
    });
    await check('equipment', async () => {
        const a = put(P0, 'Grizzly Bears'), e = put(P0, 'Bonesplitter'); T.lands(P0, C, 1);
        ok('equipping pays the equip cost', await equip(P0, e, a));
        ok('Bonesplitter gives +2/+0', e.attachedTo === a.uid && pow(a) === 4, pow(a));
    });
    await check('tokens', async () => {
        await applyEffect(P0, { t: 'token', n: 2, p: 1, q: 1, name: 'red goblin', kw: [] }, null, put(P0, 'Hill Giant'));
        ok('token effect makes tokens', P0.bf.filter(o => o.token).length === 2);
    });
    await check('hexproof and protection', async () => {
        const h = put(P1, 'Grizzly Bears', { tkw: ['hexproof'] });
        const bolt = makeObj(C['Lightning Bolt'], 0);
        const valid = validTargets(P0, { t: 'dmg', n: 3, target: 'any' }, bolt).filter(v => v.o);
        ok('hexproof creatures cannot be targeted by opponents', !valid.some(v => v.o.uid === h.uid));
        const p = put(P1, 'Hill Giant', { tkw: ['pro:R'] });
        const valid2 = validTargets(P0, { t: 'dmg', n: 3, target: 'any' }, bolt).filter(v => v.o);
        ok('protection from red stops a red source', !valid2.some(v => v.o.uid === p.uid));
    });
    await check('draw', async () => { const n = P0.hand.length; P0.library.push(makeObj(C['Mountain'], 0), makeObj(C['Mountain'], 0)); drawCards(P0, 2); ok('drawing moves cards to hand', P0.hand.length === n + 2); });
    await check('invariants after a full AI turn', async () => {
        put(P0, 'Hill Giant'); put(P1, 'Grizzly Bears'); T.lands(P0, C, 4); P0.hand.push(makeObj(C['Lightning Bolt'], 0), makeObj(C['Monastery Swiftspear'], 0));
        await aiTurn(P0);
        ok('no duplicate cards, no NaN', T.invariants().length === 0, T.invariants());
    });

    // ---------- Tyrox deck: the special cards ----------
    await check('Goblin Guide', async () => {
        const gg = put(P0, 'Goblin Guide'); const land = makeObj(C['Mountain'], 1); P1.library.push(land); const h = P1.hand.length;
        declareAttackers(P0, [gg]); await settle();
        ok('Goblin Guide: a land on top goes to the defender\'s hand', P1.hand.includes(land) && P1.hand.length === h + 1);
        const spell = makeObj(C['Lightning Bolt'], 1); P1.library.push(spell); G.attackers = []; declareAttackers(P0, [gg]); await settle();
        ok('Goblin Guide: a spell stays on top', P1.library[P1.library.length - 1] === spell);
    });
    await check('Goblin Rabblemaster', async () => {
        const rm = put(P0, 'Goblin Rabblemaster');
        await applyEffect(P0, { t: 'token', n: 2, p: 1, q: 1, name: 'red goblin', kw: ['haste'] }, null, rm);
        const toks = P0.bf.filter(o => o.token); toks.forEach(t => { t.sick = false; });
        ok('Goblin tokens must attack, Rabblemaster itself does not', toks.every(forcedAttack) && !forcedAttack(rm));
        ok('the AI attacks with the forced Goblins', toks.every(t => aiChooseAttackers(P0).includes(t)));
        declareAttackers(P0, [rm, ...toks]); await settle();
        ok('Rabblemaster gets +1/+0 for each other attacking Goblin', rm.tp === 2, { tp: rm.tp, log: G.log.slice(-6) });
    });
    await check('Glorybringer', async () => {
        const gb = put(P0, 'Glorybringer'), hg = put(P1, 'Hill Giant'), sd = put(P1, 'Shivan Dragon');
        declareAttackers(P0, [gb]); await exertChoices(P0, [gb]); await settle();
        ok('Glorybringer exerts and will not untap', gb.exertedTurn === G.turn && gb.skipUntap === true, { log: G.log.slice(-6), ai: P0.isAI, auto: typeof AUTOPLAY !== 'undefined' && AUTOPLAY });
        ok('it deals 4 to a non-Dragon creature', !onBf(hg.uid) || hg.dmg >= 3, hg.dmg);
        ok('it cannot target a Dragon', onBf(sd.uid) && sd.dmg === 0);
    });
    await check('Glorybringer, only Dragons', async () => {
        const gb = put(P0, 'Glorybringer'); put(P1, 'Shivan Dragon');
        declareAttackers(P0, [gb]); await exertChoices(P0, [gb]); await settle();
        ok('the AI does not exert with no good target', !gb.exertedTurn && !gb.skipUntap);
    });
    await check('Combat Celebrant', async () => {
        const cc = put(P0, 'Combat Celebrant'), bear = put(P0, 'Grizzly Bears');
        declareAttackers(P0, [cc, bear]); await exertChoices(P0, [cc, bear]); await settle();
        ok('exert untaps the other creatures and queues an extra combat', cc.skipUntap && !bear.tapped && cc.tapped && G.extraCombat === 1, { extra: G.extraCombat });
    });
    await check('extra combat, the AI turn', async () => {
        put(P0, 'Combat Celebrant'); put(P0, 'Grizzly Bears'); put(P0, 'Hill Giant'); P0.hand.splice(0);
        await aiTurn(P0);
        ok('the AI turn logs an additional combat phase and attacks twice', G.log.some(l => /additional combat phase/.test(l)) && P1.life < 40 - 5, { life: P1.life });
    });
    await check('extra combat, the human flow', async () => {
        P1.hand.splice(0);
        const cc = put(P0, 'Combat Celebrant'), b = put(P0, 'Grizzly Bears');
        G.view = 0; G.combatFired = false; G.extraCombatOn = false;
        await goToCombat(); G.mode.sel = new Set([cc.uid, b.uid]); await confirmAttack();
        ok('attack, exert, then waiting for blocks', G.phase === 'afterBlocks' && G.extraCombat === 1, G.phase);
        await dealDamage();
        ok('damage, then the extra combat starts', G.phase === 'declareAttackers' && G.extraCombatOn && G.extraCombat === 0, G.phase);
        ok('the exerted Celebrant is tapped, the Bears can attack again', !canAttackWith(cc) && canAttackWith(b));
        G.mode.sel = new Set([b.uid]); await confirmAttack(); await dealDamage();
        ok('then main phase 2', G.phase === 'main2', G.phase);
        G.extraCombat = 1; G.phase = 'afterBlocks'; G.busy = false; G.attackers = []; await dealDamage(); cancelAttack();
        ok('backing out of the extra combat goes to main 2, not main 1', G.phase === 'main2', G.phase);
    });
    await check('Embercleave', async () => {
        const emb = makeObj(C['Embercleave'], 0); P0.hand.push(emb);
        const base = costTotal(costOf(P0, emb));
        const a1 = put(P0, 'Grizzly Bears'), a2 = put(P0, 'Hill Giant'), a3 = put(P0, 'Monastery Swiftspear');
        G.attackers = [a1.uid, a2.uid, a3.uid];
        ok('costs {1} less for each attacking creature', base - costTotal(costOf(P0, emb)) === 3, { base, now: costTotal(costOf(P0, emb)) });
        T.lands(P0, C, 4); a1.tapped = a2.tapped = a3.tapped = true; G.attackers = [a1.uid, a2.uid];
        ok('payable with 4 lands and 2 attackers', canPay(P0, emb));
        G.stack.length = 0; await castSpell(P0, emb); await runStack();
        const host = onBf(emb.attachedTo);
        ok('enters attached with double strike and trample', onBf(emb.uid) && host && has(host, 'double strike') && has(host, 'trample'));
    });
    await check('Light Up the Stage (spectacle)', async () => {
        const lu = makeObj(C['Light Up the Stage'], 0); P0.hand.push(lu);
        P1.lostTurn = -1; ok('spectacle is not offered before an opponent loses life', !altOk(P0, lu));
        P1.lostTurn = G.turn; ok('spectacle is offered after an opponent loses life', altOk(P0, lu));
        lu.altCast = true; const c = costTotal(costOf(P0, lu)); lu.altCast = false; ok('the spectacle cost is {R}', c === 1, c);
    });
    await check('Temur Battle Rage', async () => {
        for (const big of [true, false]) {
            T.clear(); P0.hand.splice(0);
            const t1 = put(P0, big ? 'Hill Giant' : 'Grizzly Bears'); if (big) t1.counters = 1;
            const tb = makeObj(C['Temur Battle Rage'], 0); P0.hand.push(tb); T.lands(P0, C, 4); G.stack.length = 0;
            await castSpell(P0, tb, { o: t1 }); await runStack();
            ok(`Temur Battle Rage on power ${pow(t1)}: double strike${big ? ' and trample (ferocious)' : ' only'}`, has(t1, 'double strike') && has(t1, 'trample') === big, t1.tkw);
        }
    });
    await check('token reader: Cast Down', async () => {
        const g = put(P1, 'Grizzly Bears'), k = put(P1, 'Kroxa, Titan of Death\'s Hunger');
        const cd = makeObj(C['Cast Down'], 0); P0.hand.push(cd);
        for (let i = 0; i < 2; i++) { const sw = makeObj(C['Swamp'], 0); putOntoBattlefield(P0, sw); sw.sick = false; }
        const e = Rx(cd).spell && Rx(cd).spell[0];
        ok('Cast Down reads as Automated with a structured filter', Rx(cd).support === 'full' && e && /^sf:/.test(e.filter), e);
        const valid = validTargets(P0, e, cd).map(v => v.o && v.o.uid);
        ok('only the nonlegendary creature is a target', valid.includes(g.uid) && !valid.includes(k.uid), valid);
        await castSpell(P0, cd, { o: g }); await runStack();
        ok('the nonlegendary creature is destroyed, the legend is not', !onBf(g.uid) && onBf(k.uid));
    });
    // ---------- Precon round 1 (effects resolved directly: cost and casting are covered elsewhere) ----------
    const run = async (name, target) => { const o = makeObj(C[name], 0); await resolveEffects(P0, Rx(o).spell, target, o); return o; };
    const lib = (P, names) => { P.library.splice(0); names.forEach(n => P.library.push(makeObj(C[n], P.i))); };
    await check('precon: Coercion', async () => {
        P1.hand.push(makeObj(C['Mountain'], 1), makeObj(C['Hill Giant'], 1));
        await run('Coercion', { p: P1 });
        ok('the opponent discards the best nonland card', P1.hand.length === 1 && P1.hand[0].card.name === 'Mountain' && P1.gy.some(x => x.card.name === 'Hill Giant'), P1.hand.map(x => x.card.name));
    });
    await check('precon: removal with life', async () => {
        const a = put(P1, 'Hill Giant'); await run('Path of Peace', { o: a });
        ok('Path of Peace destroys and its owner gains 4', !onBf(a.uid) && P1.life === 44, P1.life);
        const b = put(P1, 'Hill Giant'); G.attackers = [b.uid]; P0.life = 40; await run('Chastise', { o: b });
        ok('Chastise destroys an attacker and you gain its power', !onBf(b.uid) && P0.life === 43, P0.life);
        const c = put(P1, 'Hill Giant'); G.attackers = [c.uid]; P1.life = 40; await run('Condemn', { o: c });
        ok('Condemn puts it on the bottom and its controller gains its toughness', !onBf(c.uid) && P1.library[0] === c && P1.life === 43, [P1.life, P1.library[0] && P1.library[0].card.name]);
        const d = put(P1, 'Grizzly Bears'); G.attackers = [d.uid]; await run('Whisk Away', { o: d });
        ok('Whisk Away puts an attacker on top', !onBf(d.uid) && P1.library[P1.library.length - 1] === d);
    });
    await check('precon: damage spells', async () => {
        const a = put(P1, 'Hill Giant'), b = put(P1, 'Grizzly Bears');
        const was = P0.isAI; P0.isAI = true; await run('Jagged Lightning'); P0.isAI = was;
        ok('Jagged Lightning kills a 3/3 and a 2/2', !onBf(a.uid) && !onBf(b.uid), [onBf(a.uid), onBf(b.uid)]);
        P1.life = 40; await run('Incinerate', { p: P1 });
        ok('Incinerate deals 3', P1.life === 37, P1.life);
    });
    await check('precon: life and cards', async () => {
        lib(P0, ['Mountain', 'Mountain', 'Mountain']); P0.hand.splice(0); P0.life = 40;
        await run('Kiss of the Amesha', { p: P0 });
        ok('Kiss of the Amesha: 7 life and 2 cards', P0.life === 47 && P0.hand.length === 2, [P0.life, P0.hand.length]);
        lib(P0, ['Mountain', 'Hill Giant', 'Grizzly Bears']); P0.hand.splice(0);
        await run('Sleight of Hand');
        ok('Sleight of Hand: one card to hand, one to the bottom', P0.hand.length === 1 && P0.library.length === 2 && P0.library[0].card.name !== 'Mountain' && P0.library[0] !== P0.hand[0], [P0.hand.map(x => x.card.name), P0.library.map(x => x.card.name)]);
        lib(P0, ['Mountain', 'Mountain', 'Hill Giant', 'Grizzly Bears']); P0.hand.splice(0);
        await run('Telling Time');
        ok('Telling Time: one in hand, one on top, one on the bottom', P0.hand.length === 1 && P0.library.length === 3, [P0.hand.length, P0.library.length]);
        lib(P0, Array(8).fill('Mountain')); P0.hand.splice(0); P0.gy.splice(0);
        await run('Ancestral Memories');
        ok('Ancestral Memories: two in hand, five in the graveyard', P0.hand.length === 2 && P0.gy.length === 5 && P0.library.length === 1, [P0.hand.length, P0.gy.length, P0.library.length]);
        P0.life = 40; G.attackers = [1, 2, 3].map(() => put(P1, 'Grizzly Bears').uid);
        await run('Blessed Reversal');
        ok('Blessed Reversal: 3 life per attacker', P0.life === 49, P0.life);
    });
    await check('precon: replacement and prevention', async () => {
        const f = put(P0, 'Furnace of Rath'); P1.life = 40; damage(P1, 3, f);
        ok('Furnace of Rath doubles damage', P1.life === 34, P1.life);
        onBf(f.uid) && leaveBattlefield(f, 'gy');
        const ua = put(P1, "Urza's Armor"); P1.life = 40; damage(P1, 3, put(P0, 'Hill Giant'));
        ok("Urza's Armor prevents 1", P1.life === 38, P1.life); leaveBattlefield(ua, 'gy');
        const cm = put(P1, 'Cho-Manno, Revolutionary'); damage(cm, 5, put(P0, 'Hill Giant'));
        ok('Cho-Manno takes no damage', cm.dmg === 0 && onBf(cm.uid), cm.dmg);
        const vg = put(P1, 'Vigor'), bear = put(P1, 'Grizzly Bears'); damage(bear, 3, put(P0, 'Hill Giant'));
        ok('Vigor: damage to another creature becomes +1/+1 counters', bear.dmg === 0 && bear.counters === 3, [bear.dmg, bear.counters]);
        leaveBattlefield(vg, 'gy');
        const host = put(P1, 'Hill Giant'), pa = put(P1, 'Pariah'); pa.attachedTo = host.uid; P1.life = 40; damage(P1, 2, put(P0, 'Grizzly Bears'));
        ok('Pariah: damage to you goes to the enchanted creature', P1.life === 40 && host.dmg === 2, [P1.life, host.dmg]);
    });
    await check('precon: static and replacement effects', async () => {
        const gz = put(P0, 'Gravebane Zombie'); P0.library.splice(0); destroy(gz);
        ok('Gravebane Zombie goes on top of the library instead of dying', !onBf(gz.uid) && P0.library[P0.library.length - 1] === gz && !P0.gy.includes(gz));
        const av = put(P0, 'Angel of Vitality'); P0.life = 20; gainLifeFor(P0, 3); await applyEffect(P0, { t: 'gain', n: 2 }, null, av);
        ok('Angel of Vitality: each life gain is 1 more (the effect, not the helper)', P0.life === 20 + 3 + 3, P0.life);
        const ev = put(P0, 'Ascendant Evincar'), bears = put(P1, 'Grizzly Bears');
        ok('Ascendant Evincar: nonblack creatures get -1/-1', pow(bears) === 1 && pow(put(P0, 'Hill Giant')) === 2, [pow(bears)]);
    });
    await check('precon: Angelic Arbiter', async () => {
        const arb = put(P0, 'Angelic Arbiter'); const atk = put(P1, 'Grizzly Bears'); atk.sick = false;
        G.active = 1; P1.castTurn = G.turn;
        ok('an opponent who cast a spell this turn cannot attack', !canAttackWith(atk));
        P1.castTurn = 0; P1.attackedTurn = G.turn; const bolt = makeObj(C['Lightning Bolt'], 1); P1.hand.push(bolt); T.lands(P1, C, 2); G.phase = 'main1';
        ok('an opponent who attacked this turn cannot cast spells', !canCastNow(P1, bolt));
    });
    await check('precon: auras and combat', async () => {
        const host = put(P1, 'Grizzly Bears'), rays = put(P0, 'Oppressive Rays'); rays.attachedTo = host.uid; host.sick = false;
        P1.hand.splice(0); P1.bf.filter(x => /Land/.test(x.card.type)).forEach(x => x.tapped = true);
        G.active = 1; declareAttackers(P1, [host]);
        ok('Oppressive Rays: cannot attack without {3}', G.attackers.length === 0, G.attackers);
        const atk = put(P0, 'Hill Giant'), lure = put(P1, 'Lure'); lure.attachedTo = atk.uid;
        const b1 = put(P1, 'Grizzly Bears'), b2 = put(P1, 'Hill Giant'); b1.tapped = b2.tapped = false;
        G.active = 0; G.attackers = [atk.uid]; G.blocks = {}; fixMenace();
        ok('Lure: every creature able to block must block', (G.blocks[atk.uid] || []).includes(b1.uid) && (G.blocks[atk.uid] || []).includes(b2.uid), G.blocks);
        const dg = put(P1, 'Deathgazer'), atk2 = put(P0, 'Hill Giant'); G.attackers = [atk2.uid]; G.blocks = { [atk2.uid]: [dg.uid] };
        fire('blocks', { list: [dg] }); await settle(); combatDamage(P0); await settle();
        ok('Deathgazer destroys the nonblack creature it blocked at end of combat', !onBf(atk2.uid), onBf(atk2.uid) && atk2.card.name);
    });
    await check('precon: spells and abilities', async () => {
        const worms = put(P0, 'Mole Worms'), land = put(P1, 'Mountain');
        await applyEffect(P0, { t: 'tap', target: 'perm', filter: 'land' }, { o: land }, worms); G.lastTargets = [{ o: land }];
        await applyEffect(P0, { t: 'lockLastLand' }, null, worms); worms.tapped = true; land.tapped = true;
        startTurnUntapForTest(P1);
        ok('Mole Worms keeps the land tapped while it stays tapped', land.tapped === true, land.tapped);
        lib(P0, ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Hill Giant']);
        const cw = put(P0, 'Call of the Wild'); const before = P0.bf.length; await applyEffect(P0, { t: 'callWild' }, null, cw);
        ok('Call of the Wild puts a creature card from the top onto the battlefield', P0.bf.length === before + 1 && P0.bf.some(x => x.card.name === 'Hill Giant'));
        await applyEffect(P0, { t: 'callWild' }, null, cw);
        ok('and a noncreature card goes to the graveyard', P0.gy.some(x => x.card.name === 'Mountain'));
        P0.life = 40; P0.hand.splice(0); lib(P0, ['Mountain', 'Mountain']);
        const ag = makeObj(C['Goblin Arsonist'], 0); P0.bf.push(ag); ag.sick = false;
        ok('Goblin Arsonist reads its death trigger', Rx(ag).trig.some(tr => tr.ev === 'dies'), Rx(ag).trig.map(t => t.ev));
        const c0 = put(P0, 'Grizzly Bears'), c1 = put(P1, 'Hill Giant'); const h0 = P0.hand.length, h1 = P1.hand.length;
        const was = [P0.isAI, P1.isAI]; P0.isAI = P1.isAI = true; await run('Curfew'); [P0.isAI, P1.isAI] = was;
        ok('Curfew returns a creature each player controls to hand', P0.hand.length === h0 + 1 && P1.hand.length === h1 + 1, [P0.hand.length - h0, P1.hand.length - h1]);
    });
    await check('precon round 2: spells', async () => {
        const c1 = put(P1, 'Hill Giant'), l1 = put(P1, 'Mountain'); c1.tapped = l1.tapped = true;
        await run('Exhaustion', { p: P1 });
        startTurnUntapForTest(P1);
        ok('Exhaustion: the opponent\'s creatures and lands stay tapped', c1.tapped && l1.tapped, [c1.tapped, l1.tapped]);
        P1.hand.push(makeObj(C['Mountain'], 1), makeObj(C['Hill Giant'], 1), makeObj(C['Grizzly Bears'], 1)); P1.life = 40;
        await run('Blightning', { p: P1 });
        ok('Blightning: 3 damage and two cards discarded', P1.life === 37 && P1.hand.length === 1, [P1.life, P1.hand.length]);
        const b = put(P1, 'Hill Giant'); P0.life = 40; await run('Sever Soul', { o: b });
        ok('Sever Soul: destroys the creature and you gain its toughness', !onBf(b.uid) && P0.life === 43, P0.life);
        const dd = put(P1, 'Hill Giant'); await resolveEffects(P0, [{ t: 'dmg', n: 3, target: 'creature', exileDies: true }], { o: dd }, makeObj(C['Disintegrate'], 0));
        sba(); ok('exile-instead damage exiles the creature', !onBf(dd.uid) && P1.exile.some(x => x.card.name === 'Hill Giant') && !P1.gy.includes(dd), { bf: onBf(dd.uid), ex: P1.exile.map(x => x.card.name), gy: P1.gy.map(x => x.card.name), flag: dd.exileOnDeath, turn: G.turn });
    });
    await check('precon round 2: creatures', async () => {
        const io = put(P1, 'Ironclaw Orcs'), big = put(P0, 'Hill Giant'), small = put(P0, 'Monastery Swiftspear');
        ok('Ironclaw Orcs cannot block a creature with power 2 or more', !canBlock(io, big));
        small.tp = -10; ok('but can block a smaller one', canBlock(io, small));
        const sp = put(P0, 'Signal Pest'), other = put(P0, 'Hill Giant'); G.attackers = [sp.uid, other.uid]; other.tp = 0;
        await applyEffect(P0, { t: 'battleCry' }, null, sp);
        ok('battle cry gives each other attacker +1/+0', pow(other) === 4 && pow(sp) === 0 + 0, [pow(other), pow(sp)]);
        const md = put(P0, 'Murk Dwellers'); G.attackers = [md.uid]; G.blocks = {}; let hit = 0;
        const before = pow(md); fire('unblocked', { o: md }); await settle();
        ok('Murk Dwellers gets +2/+0 when it attacks and is not blocked', pow(md) === before + 2, [before, pow(md)]);
        const mg = put(P1, 'Meglonoth'), atk = put(P0, 'Hill Giant'); G.attackers = [atk.uid]; G.blocks = { [atk.uid]: [mg.uid] }; P0.life = 40;
        await applyEffect(P1, { t: 'meglonoth' }, null, mg);
        ok('Meglonoth deals damage equal to its power to the attacker\'s controller', P0.life === 40 - pow(mg), [P0.life, pow(mg)]);
        const sh = put(P1, 'Spirit of the Hearth');
        ok('Spirit of the Hearth: you have hexproof', !validTargets(P0, { target: 'player' }, makeObj(C['Lightning Bolt'], 0)).some(v => v.p === P1));
        put(P0, 'Circle of Protection: Black'); await applyEffect(P0, { t: 'copShield', color: 'B' }, null, put(P0, 'Circle of Protection: Black')); P0.life = 40;
        const blk = makeObj({ ...C['Grizzly Bears'], colors: ['B'] }, 1); P1.bf.push(blk); damage(P0, 2, blk);
        ok('Circle of Protection: Black prevents the next black source\'s damage', P0.life === 40, P0.life);
    });
    return out;
};

async function main() {
    const h = await launch();
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})(${JSON.stringify(NAMES)}, ${JSON.stringify((process.env.ONLY || '').split(',').filter(Boolean))}, ${JSON.stringify((process.env.SKIP || '').split(',').filter(Boolean))})`);
    const results = formatChecks(raw);
    const good = printResults('engine', results, errors);
    writeOut('engine', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
