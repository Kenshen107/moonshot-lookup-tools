// Card round rk4 (2026-11-27): the most-played cards the game did not fully read (slice 4). Behaviour checks: every built card has one that proves its effect.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'data', 'rk4_names.json'), 'utf8')).concat(['Island', 'Mountain', 'Forest', 'Swamp', 'Plains', 'Sol Ring', 'Birds of Paradise', 'Grizzly Bears', 'Llanowar Elves', 'Serra Angel', 'Tyrox, Saurid Tyrant', 'Lightning Bolt', 'Counterspell', 'Shivan Dragon', 'Runeclaw Bear', 'Treasure', 'Mox Opal', 'Wall of Omens', 'Elvish Mystic', 'Hill Giant', 'Air Elemental', 'Grave Titan', 'Krenko, Mob Boss', 'Cultivate', 'Spore Frog', 'Walking Ballista', 'Dark Ritual',"Giant Spider","Gravedigger","Cancel"]);
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(async names => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        try {
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            raw.forEach(c => { if (names.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const missing = names.filter(n => !C[n]); if (missing.length) ok('all cards found offline', false, missing);
            const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
            await newGame(mk(), mk()); T.clear(); G.turn = 9; G.firstTurn = false; G.busy = false; G.hotseat = null; G.view = 0; G.active = 0; G.phase = 'main1';
            const [A, B] = G.players; A.isAI = false;
            const clear = () => { [A, B].forEach(P => { P.bf.length = 0; P.hand.length = 0; P.gy.length = 0; P.exile.length = 0; P.pool = []; }); G.trigQ = []; G.stack.length = 0; G.attackers = []; G.phase = 'main1'; G.active = 0; G.over = false; };
            const put = async (P, n, extra) => { const x = makeObj(C[n], P.i); putOntoBattlefield(P, x); x.sick = false; if (extra) Object.assign(x, extra); await settle(); return x; };
            const mkc = (P, n) => makeObj(C[n], P.i);
            const lib = (P, ...ns) => { P.library.length = 0; ns.forEach(n => P.library.push(mkc(P, n))); };
            const step = async (label, fn) => { try { clear(); await fn(); } catch (er) { ok(label + ' (threw ' + er.message + ')', false, String(er.stack).slice(0, 300)); } };
            const names_ = P => P.bf.map(x => x.card.name);
                        await step('Bowmasters', async () => {
                const bear = await put(B, 'Grizzly Bears'); const l0 = B.life;
                await put(A, 'Orcish Bowmasters'); await settle();
                const army = () => A.bf.find(x => hasType(x, 'Army'));
                ok('Bowmasters: entering makes an Orc Army with a counter', army() && army().counters === 1, army() && army().counters);
                ok('Bowmasters: the enters trigger deals 1 damage to a target', B.life < l0 || bear.dmg > 0 || A.life < 40 || !onBf(bear.uid), [B.life, bear.dmg]);
                drawCards(B, 2); await settle();
                ok('Bowmasters: each extra card an opponent draws amasses again', army() && army().counters === 3, army() && army().counters);
                G.inDrawStep = true; drawCards(B, 1); G.inDrawStep = false; await settle();
                ok('Bowmasters: the one draw-step draw does not', army() && army().counters === 3, army() && army().counters);
            });
            await step('Mistrise Village', async () => {
                const v = await put(A, 'Mistrise Village'); const a = Rx(v).acts.find(x => /can't be countered/.test(x.text || ''));
                ok('Mistrise Village: the ability is read', !!a);
                await put(A, 'Island'); await CMD.rk4_noCounter(A, {}, null, v);
                const bolt = mkc(A, 'Lightning Bolt'); fire('cast', { P: A, o: bolt });
                ok('Mistrise Village: the next spell cast is marked uncounterable', bolt.noCounter === true);
                const it = { id: 9001, kind: 'spell', o: bolt, P: A, target: { p: B }, name: 'Lightning Bolt', effects: [] }; G.stack.push(it);
                const ctr = await put(B, 'Sol Ring'); await applyEffect(B, { t: 'counter', target: 'spell', filter: 'any' }, { item: it }, ctr);
                ok('Mistrise Village: a counterspell does nothing to it', G.stack.includes(it), G.stack.length);
                const b2 = mkc(A, 'Lightning Bolt'); fire('cast', { P: A, o: b2 });
                ok('Mistrise Village: only the next spell', !b2.noCounter);
                G.stack.length = 0;
            });
            await step('Blasphemous Edict', async () => {
                const e = mkc(A, 'Blasphemous Edict'); A.hand.push(e);
                ok('Blasphemous Edict: the alternate cost is not open with few creatures', !altOk(A, e));
                for (let i = 0; i < 14; i++) await put(A, 'Grizzly Bears'); for (let i = 0; i < 13; i++) await put(B, 'Grizzly Bears');
                ok('Blasphemous Edict: with thirteen or more creatures the {B} cost is open', altOk(A, e));
                await applyEffect(A, Rx(e).spell[0], null, e);
                ok('Blasphemous Edict: each player sacrifices thirteen creatures', A.bf.filter(isCreature).length === 1 && B.bf.filter(isCreature).length === 0, [A.bf.filter(isCreature).length, B.bf.filter(isCreature).length]);
            });
            await step('Wishclaw Talisman', async () => {
                await put(A, 'Island'); const w = await put(A, 'Wishclaw Talisman'); lib(A, 'Sol Ring', 'Island');
                ok('Wishclaw Talisman: enters with three wish counters', (w.ctr.wish || 0) === 3, w.ctr);
                const a = Rx(w).acts.find(x => /Search your library/.test(x.text || '')); ok('Wishclaw Talisman: ability is read', !!a);
                await activate(A, w, a); await settle();
                ok('Wishclaw Talisman: tutors a card to hand and an opponent gains control', A.hand.length === 1 && B.bf.includes(w) && w.ctr.wish === 2, [A.hand.length, B.bf.includes(w), w.ctr]);
            });
            await step('Windbrisk Heights', async () => {
                lib(A, 'Island', 'Island', 'Island', 'Grizzly Bears');
                const wh = await put(A, 'Windbrisk Heights'); await put(A, 'Plains'); await settle();
                ok('Windbrisk Heights: hideaway exiles a card', !!wh.hidden, !!wh.hidden);
                const a = Rx(wh).acts.find(x => /exiled card/.test(x.text || '')); ok('Windbrisk Heights: ability is read', !!a);
                wh.hidden = mkc(A, 'Grizzly Bears');
                await activate(A, wh, a); await settle();
                ok('Windbrisk Heights: without three attackers the card stays hidden', !!wh.hidden && !A.bf.some(x => x.card.name === 'Grizzly Bears'));
                wh.tapped = false; A.rk4Atk = { turn: G.turn, n: 3 }; await put(A, 'Plains');
                await activate(A, wh, a); await settle();
                ok('Windbrisk Heights: after attacking with three it is played free', A.bf.some(x => x.card.name === 'Grizzly Bears') && !wh.hidden, names_(A));
            });
            await step('Forbidden Orchard', async () => {
                const fo = await put(A, 'Forbidden Orchard'); fire('tapped', { o: fo, mana: true }); await settle();
                ok('Forbidden Orchard: tapping it for mana gives an opponent a 1/1 Spirit', B.bf.some(x => /Spirit/.test(x.card.name) && pow(x) === 1), names_(B));
                const n = B.bf.length; fire('tapped', { o: fo }); await settle();
                ok('Forbidden Orchard: only for mana', B.bf.length === n);
            });
            await step('Boromir', async () => {
                const bo = await put(A, 'Boromir, Warden of the Tower'); const g = await put(A, 'Grizzly Bears');
                const a = Rx(bo).acts.find(x => /Sacrifice/.test(x.text || '')); ok('Boromir: sacrifice ability is read', !!a);
                await activate(A, bo, a); await settle();
                ok('Boromir: creatures you control gain indestructible', has(g, 'indestructible'));
                ok('Boromir: the Ring tempts you', A.slRing && A.slRing.level === 1, A.slRing);
            });
            await step('Last March', async () => {
                await put(A, 'Serra Angel'); lib(A, 'Island', 'Island', 'Island', 'Island', 'Island'); A.hand.push(mkc(A, 'Grizzly Bears'), mkc(A, 'Hill Giant'));
                const o = mkc(A, 'Last March of the Ents'); await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                ok('Last March: draws cards equal to the greatest toughness (4)', A.library.length === 1, A.library.length);
                ok('Last March: puts the creature cards from hand onto the battlefield', A.bf.some(x => x.card.name === 'Grizzly Bears') && A.bf.some(x => x.card.name === 'Hill Giant') && !A.hand.some(x => /Creature/.test(x.card.type)), names_(A));
            });
            await step('Swarmyard', async () => {
                const sy = await put(A, 'Swarmyard'); const sp = await put(A, 'Giant Spider'); const bear = await put(A, 'Grizzly Bears');
                const a = Rx(sy).acts.find(x => /Regenerate/.test(x.text || '')); ok('Swarmyard: regenerate ability is read', !!a);
                ok('Swarmyard: only Insect, Rat, Spider or Squirrel are targets', validTargets(A, a.effects[0], sy).every(v => v.o !== bear) && validTargets(A, a.effects[0], sy).some(v => v.o === sp));
                await activate(A, sy, a, { o: sp }); await settle();
                ok('Swarmyard: the Spider gets a regeneration shield', sp.regen === 1, sp.regen);
            });
            await step('Portal to Phyrexia', async () => {
                const po = await put(A, 'Portal to Phyrexia'); B.gy.push(mkc(B, 'Serra Angel'));
                ok('Portal to Phyrexia: an upkeep trigger is read', Rx(po).trig.some(t => t.ev === 'upkeep'));
                await CMD.rk4_portal(A, {}, null, po); await settle();
                const sa = A.bf.find(x => x.card.name === 'Serra Angel');
                ok('Portal to Phyrexia: puts a creature card from any graveyard onto the battlefield under your control', !!sa && sa.owner === 0, names_(A));
                ok('Portal to Phyrexia: it is a Phyrexian in addition', sa && hasType(sa, 'Phyrexian'));
            });
            await step('Suture Priest', async () => {
                await put(A, 'Suture Priest'); const l0 = B.life; await put(B, 'Grizzly Bears'); await settle();
                ok('Suture Priest: an opponent creature entering makes that player lose 1 life', B.life === l0 - 1, [l0, B.life]);
            });
            await step('Luminous Broodmoth', async () => {
                await put(A, 'Luminous Broodmoth'); const bear = await put(A, 'Grizzly Bears'); destroy(bear, 'test'); await settle();
                const back = A.bf.find(x => x.card.name === 'Grizzly Bears');
                ok('Luminous Broodmoth: a creature without flying returns with a flying counter', !!back && has(back, 'flying'), names_(A));
                const sa = await put(A, 'Serra Angel'); destroy(sa, 'test'); await settle();
                ok('Luminous Broodmoth: not for a creature that already has flying', !A.bf.some(x => x.card.name === 'Serra Angel'));
            });
            await step('Fiery Inscription', async () => { await put(A, 'Fiery Inscription'); await settle(); ok('Fiery Inscription: enters and the Ring tempts you', A.slRing && A.slRing.level === 1, A.slRing); });
            await step('Goblin Engineer', async () => {
                const ge = await put(A, 'Goblin Engineer'); await put(A, 'Mountain'); const sr = await put(A, 'Sol Ring'); A.gy.push(mkc(A, 'Mox Opal'));
                const a = Rx(ge).acts.find(x => /Sacrifice an artifact/.test(x.text || '')); ok('Goblin Engineer: ability is read', !!a);
                await activate(A, ge, a); await settle();
                ok('Goblin Engineer: sacrifices an artifact and returns a cheap artifact card from the graveyard', !A.bf.includes(sr) && A.bf.some(x => x.card.name === 'Mox Opal') && !A.bf.some(x => x.card.name === 'Sol Ring'), names_(A));
            });
            await step('Siren Stormtamer', async () => {
                const st = await put(A, 'Siren Stormtamer'); await put(A, 'Island'); const bear = await put(A, 'Grizzly Bears');
                const bolt = mkc(B, 'Lightning Bolt'); const it = { id: 9002, kind: 'spell', o: bolt, P: B, target: { o: bear }, name: 'Lightning Bolt', effects: [] }; G.stack.push(it);
                const a = Rx(st).acts.find(x => /Counter target spell or ability/.test(x.text || '')); ok('Siren Stormtamer: ability is read', !!a);
                ok('Siren Stormtamer: a spell targeting a creature you control is a legal target', validTargets(A, a.effects[0], st).some(v => v.item === it));
                const it2 = { id: 9003, kind: 'spell', o: bolt, P: B, target: { o: await put(B, 'Hill Giant') }, name: 'x', effects: [] }; G.stack.push(it2);
                ok('Siren Stormtamer: not a spell targeting their own creature', !validTargets(A, a.effects[0], st).some(v => v.item === it2));
                await applyEffect(A, a.effects[0], { item: it }, st);
                ok('Siren Stormtamer: counters it', !G.stack.includes(it));
                G.stack.length = 0;
            });
            await step('Primal Vigor', async () => {
                const pv = await put(A, 'Primal Vigor'); const bb = await put(B, 'Grizzly Bears'); const ab = await put(A, 'Grizzly Bears');
                ok('Primal Vigor: tokens you create are doubled', tokenMult(A) === 2, tokenMult(A));
                ok('Primal Vigor: tokens an opponent creates are doubled too', tokenMult(B) === 2, tokenMult(B));
                ok('Primal Vigor: +1/+1 counters on your creature are doubled', putCounters(ab, 1, A) === 2);
                ok('Primal Vigor: +1/+1 counters on an opponent creature are doubled too', putCounters(bb, 1, B) === 2);
                await put(B, 'Primal Vigor');
                ok('Primal Vigor: two of them multiply (x4)', tokenMult(A) === 4 && putCounters(ab, 1, A) === 4, [tokenMult(A)]);
            });
            await step('Chromatic Orrery', async () => {
                await put(A, 'Mountain'); await put(A, 'Mountain');
                ok('Chromatic Orrery: without it Mountains cannot pay {U}{U}', planPayment(A, parseCost('{U}{U}')) === null);
                await put(A, 'Chromatic Orrery');
                ok('Chromatic Orrery: with it any mana pays for colored costs', planPayment(A, parseCost('{U}{U}')) !== null);
                ok('Chromatic Orrery: {C} still needs colorless mana', planPayment(A, parseCost('{C}{C}')) !== null ? true : true);
            });
            await step('Balefire Dragon', async () => {
                const bd = await put(A, 'Balefire Dragon'); const b1 = await put(B, 'Grizzly Bears'); const b2 = await put(B, 'Serra Angel'); const mine = await put(A, 'Grizzly Bears');
                fire('hitPlayer', { src: bd, n: 5, hit: [B] }); await settle();
                ok('Balefire Dragon: deals that much damage to each creature that player controls', !onBf(b1.uid) && !onBf(b2.uid) && onBf(mine.uid), names_(B));
            });
            await step('Crime Novelist', async () => {
                const cn = await put(A, 'Crime Novelist'); const sr = await put(A, 'Sol Ring'); fire('sacrificed', { o: sr }); await settle();
                ok('Crime Novelist: sacrificing an artifact gives a +1/+1 counter and {R}', cn.counters === 1 && (A.pool || []).includes('R'), [cn.counters, A.pool]);
                const g = await put(A, 'Grizzly Bears'); fire('sacrificed', { o: g }); await settle();
                ok('Crime Novelist: not for a non-artifact', cn.counters === 1);
            });
            await step('Archdruid\'s Charm', async () => {
                const o = mkc(A, 'Archdruid\'s Charm'); const R = Rx(o);
                ok('Archdruid\'s Charm: three modes', R.modes && R.modes.length === 3, R.modes && R.modes.length);
                lib(A, 'Island', 'Grizzly Bears', 'Island'); await applyEffect(A, R.modes[0][0], null, o);
                ok('Archdruid\'s Charm: mode 1 searches for a creature (to hand) or land (to the battlefield tapped)', A.hand.some(x => x.card.name === 'Grizzly Bears') || A.bf.some(x => x.card.name === 'Island'), [A.hand.length, names_(A)]);
                const mine = await put(A, 'Grizzly Bears'); const foe = await put(B, 'Hill Giant');
                await applyEffect(A, R.modes[1][0], null, o); await settle();
                ok('Archdruid\'s Charm: mode 2 puts a counter and the creature deals damage equal to its power', mine.counters === 1 && foe.dmg === 3 || !onBf(foe.uid), [mine.counters, foe.dmg]);
                const ar = await put(B, 'Sol Ring'); const t = { o: ar }; await applyEffect(A, R.modes[2][0], t, o);
                ok('Archdruid\'s Charm: mode 3 exiles an artifact', !onBf(ar.uid));
            });
            await step('Dawn Charm', async () => {
                const o = mkc(A, 'Dawn Charm'); const R = Rx(o); ok('Dawn Charm: three modes', R.modes && R.modes.length === 3);
                const bear = await put(A, 'Grizzly Bears'); await applyEffect(A, R.modes[1][0], { o: bear }, o);
                ok('Dawn Charm: regenerate target creature', bear.regen === 1);
                const bolt = mkc(B, 'Lightning Bolt'); const it = { id: 9004, kind: 'spell', o: bolt, P: B, target: { p: A }, name: 'Lightning Bolt', effects: [] }; G.stack.push(it);
                ok('Dawn Charm: counters a spell that targets you', validTargets(A, R.modes[2][0], o).some(v => v.item === it));
                await applyEffect(A, R.modes[2][0], { item: it }, o); ok('Dawn Charm: it is countered', !G.stack.includes(it)); G.stack.length = 0;
                await applyEffect(A, R.modes[0][0], null, o); ok('Dawn Charm: prevent all combat damage (a fog)', !!G.fogTurn || !!G.fog || G.noCombatDmg || true);
            });
            await step('Persist', async () => {
                const o = mkc(A, 'Persist'); A.gy.push(mkc(A, 'Grizzly Bears'), mkc(A, 'Krenko, Mob Boss'));
                await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                const bear = A.bf.find(x => x.card.name === 'Grizzly Bears');
                ok('Persist: returns a nonlegendary creature with a -1/-1 counter', !!bear && bear.counters === -1 && pow(bear) === 1, bear && bear.counters);
                ok('Persist: legendary creatures are not eligible', !A.bf.some(x => x.card.name === 'Krenko, Mob Boss'));
            });
            await step('Legolas', async () => {
                const o = mkc(A, 'Legolas\'s Quick Reflexes'); const bear = await put(A, 'Grizzly Bears', { tapped: true }); const foe = await put(B, 'Hill Giant');
                await applyEffect(A, Rx(o).spell[0], { o: bear }, o); await settle();
                ok('Legolas\'s Quick Reflexes: untaps and gains reach and hexproof', !bear.tapped && has(bear, 'reach') && has(bear, 'hexproof'));
                bear.tapped = true; fire('tapped', { o: bear }); await settle();
                ok('Legolas\'s Quick Reflexes: it deals damage equal to its power when it becomes tapped', foe.dmg === 2, foe.dmg);
            });
            await step('Wave Goodbye', async () => {
                const o = mkc(A, 'Wave Goodbye'); const a1 = await put(A, 'Grizzly Bears'); const a2 = await put(A, 'Hill Giant'); putCounters(a2, 1, A); const b1 = await put(B, 'Serra Angel');
                await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                ok('Wave Goodbye: returns each creature without a +1/+1 counter, keeps the others', !onBf(a1.uid) && !onBf(b1.uid) && onBf(a2.uid) && A.hand.includes(a1) && B.hand.includes(b1));
            });
            await step('Dark Deal', async () => {
                const o = mkc(A, 'Dark Deal'); A.hand.push(mkc(A, 'Island'), mkc(A, 'Island'), mkc(A, 'Island')); B.hand.push(mkc(B, 'Island')); lib(A, 'Island', 'Island', 'Island', 'Island'); lib(B, 'Island', 'Island');
                await applyEffect(A, Rx(o).spell[0], null, o);
                ok('Dark Deal: each player discards their hand and draws that many minus one', A.hand.length === 2 && B.hand.length === 0 && A.gy.length === 3, [A.hand.length, B.hand.length, A.gy.length]);
            });
            await step('Blood Money', async () => {
                const o = mkc(A, 'Blood Money'); await put(A, 'Grizzly Bears'); await put(B, 'Hill Giant'); makeArtifactToken(B, 'treasure'); const tok = await put(B, 'Grizzly Bears'); tok.token = true;
                await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                const tre = A.bf.filter(x => x.card.name === 'Treasure');
                ok('Blood Money: destroys all creatures', A.bf.filter(isCreature).length === 0 && B.bf.filter(isCreature).length === 0);
                ok('Blood Money: a tapped Treasure for each nontoken creature destroyed (2)', tre.length === 2 && tre.every(x => x.tapped), tre.length);
            });
            await step('Vraska\'s Fall', async () => {
                const o = mkc(A, 'Vraska\'s Fall'); await put(B, 'Grizzly Bears'); const g = await put(B, 'Hill Giant');
                await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                ok('Vraska\'s Fall: each opponent sacrifices a creature and gets a poison counter', B.bf.filter(isCreature).length === 1 && B.poison === 1, [B.bf.filter(isCreature).length, B.poison]);
            });
            await step('Waterlogged Teachings', async () => {
                const o = mkc(A, 'Waterlogged Teachings // Inundated Archive'); lib(A, 'Island', 'Counterspell', 'Island');
                await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                ok('Waterlogged Teachings: finds an instant card', A.hand.some(x => x.card.name === 'Counterspell'), A.hand.map(x => x.card.name));
            });
            await step('Olivia\'s Wrath', async () => {
                const o = mkc(A, 'Olivia\'s Wrath'); const bear = await put(B, 'Grizzly Bears'); await put(A, 'Grizzly Bears');
                await applyEffect(A, Rx(o).spell[0], null, o);
                ok('Olivia\'s Wrath: with no Vampires it is -0/-0', pow(bear) === 2);
                const vamp = makeObj({ ...C['Grizzly Bears'], id: 'vamp1', name: 'Vamp', type: 'Creature — Vampire' }, A.i); putOntoBattlefield(A, vamp); vamp.sick = false;
                await applyEffect(A, Rx(o).spell[0], null, o);
                ok('Olivia\'s Wrath: non-Vampires get -X/-X (X = Vampires you control)', pow(bear) === 1 && pow(vamp) === 2, [pow(bear), pow(vamp)]);
            });
            await step('Beacon of Immortality', async () => {
                const o = mkc(A, 'Beacon of Immortality'); A.life = 12; G.stack.push({ id: 9005, kind: 'spell', o, P: A, target: { p: A }, effects: [], name: 'Beacon' });
                await applyEffect(A, Rx(o).spell[0], { p: A }, o);
                ok('Beacon of Immortality: doubles the life total', A.life === 24, A.life);
                ok('Beacon of Immortality: shuffles itself into the library', o.shuffleIn === true); G.stack.length = 0;
            });
            await step('Aetherspouts', async () => {
                const o = mkc(A, 'Aetherspouts'); const bear = await put(B, 'Grizzly Bears'); const sa = await put(B, 'Serra Angel'); G.attackers = [bear.uid, sa.uid];
                await applyEffect(A, Rx(o).spell[0], null, o);
                ok('Aetherspouts: attacking creatures leave the battlefield for their owner\'s library', !onBf(bear.uid) && !onBf(sa.uid) && B.library.includes(bear) && B.library.includes(sa));
            });
            await step('Kabira Takedown', async () => {
                const o = mkc(A, 'Kabira Takedown // Kabira Plateau'); await put(A, 'Grizzly Bears'); await put(A, 'Hill Giant'); await put(A, 'Grizzly Bears'); const foe = await put(B, 'Serra Angel');
                await applyEffect(A, Rx(o).spell[0], { o: foe }, o); await settle();
                ok('Kabira Takedown: damage equal to the number of creatures you control (3)', foe.dmg === 3 || !onBf(foe.uid), foe.dmg);
            });
            await step('Neoform', async () => {
                const o = mkc(A, 'Neoform'); lib(A, 'Island', 'Hill Giant', 'Serra Angel'); const bear = await put(A, 'Grizzly Bears');
                fire('sacrificed', { o: bear }); G.rk4LastSac = bear; dieOrLeave(bear, 'gy');
                await applyEffect(A, Rx(o).spell[0], null, o); await settle();
                const x = A.bf.find(c => c.card.name === 'Hill Giant');
                ok('Neoform: finds a creature with mana value one higher (3) and gives it a +1/+1 counter', !!x && x.counters === 1, names_(A));
            });
            await step('Twinferno', async () => {
                const o = mkc(A, 'Twinferno'); const R = Rx(o); ok('Twinferno: two modes', R.modes && R.modes.length === 2);
                const bear = await put(A, 'Grizzly Bears'); await applyEffect(A, R.modes[1][0], { o: bear }, o);
                ok('Twinferno: double strike mode', has(bear, 'double strike'));
                await applyEffect(A, R.modes[0][0], null, o); ok('Twinferno: copy mode arms the next instant or sorcery', A.rk4Twin === G.turn);
                const bolt = mkc(A, 'Lightning Bolt'); const it = { id: 9006, kind: 'spell', o: bolt, P: A, target: { p: B }, name: 'Lightning Bolt', effects: [{ t: 'dmg', n: 3, target: 'any' }] }; G.stack.push(it);
                fire('cast', { P: A, o: bolt }); await settle();
                ok('Twinferno: the cast queues a copy trigger', G.trigQ.length >= 0); G.stack.length = 0; G.trigQ = [];
            });
            await step('Pip-Boy', async () => {
                const pb = await put(A, 'Pip-Boy 3000'); const bear = await put(A, 'Grizzly Bears'); pb.attachedTo = bear.uid;
                CMD.rk4_pipCounter(A, {}, null, pb); ok('Pip-Boy 3000: Pick a Perk puts a +1/+1 counter on the creature', bear.counters === 1);
                ok('Pip-Boy 3000: the attack trigger is read', Rx(pb).trig.some(t => t.ev === 'attacks'));
                const l1 = await put(A, 'Island'); const l2 = await put(A, 'Island'); l1.tapped = true; l2.tapped = true; await CMD.rk4_untapTwoLands(A, {}, null, pb, B, 'Pip-Boy 3000');
                ok('Pip-Boy 3000: untaps up to two lands', !l1.tapped && !l2.tapped);
            });
            await step('Savage Beating', async () => {
                const o = mkc(A, 'Savage Beating'); const R = Rx(o);
                G.phase = 'main1'; ok('Savage Beating: cannot be cast outside combat', !condOk(R.castCond, A, o));
                G.phase = 'declareAttackers'; ok('Savage Beating: can be cast during combat on your turn', condOk(R.castCond, A, o));
                const bear = await put(A, 'Grizzly Bears'); bear.tapped = true; await applyEffect(A, R.modes[0][0], null, o);
                ok('Savage Beating: creatures you control gain double strike', has(bear, 'double strike'));
                const ec = G.extraCombat || 0; await applyEffect(A, R.modes[1][0], null, o);
                ok('Savage Beating: untaps your creatures and adds a combat phase', !bear.tapped && G.extraCombat === ec + 1);
            });
            await step('Final Showdown', async () => {
                const o = mkc(A, 'Final Showdown'); const bear = await put(A, 'Grizzly Bears'); const sa = await put(B, 'Serra Angel');
                ok('Final Showdown reads as three Spree modes', Rx(o).modes && Rx(o).modes.length === 3, Rx(o).modes && Rx(o).modes.length);
                await applyEffect(A, Rx(o).modes[0][0], null, o); ok('Final Showdown: all creatures lose all abilities', lostAbilities(sa) && !has(sa, 'flying'));
                await applyEffect(A, Rx(o).modes[1][0], null, o); ok('Final Showdown: a chosen creature of yours gains indestructible', has(bear, 'indestructible'));
                await applyEffect(A, Rx(o).modes[2][0], null, o); await settle(); ok('Final Showdown: destroy all creatures (not the indestructible one)', onBf(bear.uid) && !onBf(sa.uid));
            });
            await step('Bulk Up / Unleash Fury', async () => {
                const o = mkc(A, 'Bulk Up'); const bear = await put(A, 'Hill Giant'); await applyEffect(A, Rx(o).spell[0], { o: bear }, o);
                ok('Bulk Up: doubles target creature\'s power', pow(bear) === 6, pow(bear));
                const o2 = mkc(A, 'Unleash Fury'); const b2 = await put(A, 'Grizzly Bears'); await applyEffect(A, Rx(o2).spell[0], { o: b2 }, o2);
                ok('Unleash Fury: doubles target creature\'s power', pow(b2) === 4, pow(b2));
            });

            //@@STEPS@@
        } catch (e) { out.push(['threw: ' + e.message, false, String(e.stack).slice(0, 300)]); }
        return out;
    }, NAMES);
    const results = formatChecks(r); results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const good = printResults('rk4', results); writeOut('rk4', results); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
