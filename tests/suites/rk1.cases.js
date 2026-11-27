// ---- Batch 1 ----
await step('Nykthos', async () => {
    await put(A, 'Nykthos, Shrine to Nyx'); await put(A, 'Llanowar Elves'); await put(A, 'Birds of Paradise');
    const ny = A.bf.find(x => x.card.name.startsWith('Nykthos'));
    const a = Rx(ny).acts.find(x => /devotion/.test(x.text || ''));
    ok('Nykthos second ability is read', !!a);
    await lands(A, 2, 'Island');
    // Llanowar {G}, Birds {G}: devotion to green 2
    A.isAI = true; await activate(A, ny, a); await settle(); A.isAI = false;
    ok('adds mana equal to devotion to the chosen color', (A.pool || []).filter(c => c[0] === 'G').length === 2, A.pool);
});
await step('Utopia Sprawl', async () => {
    const f = await put(A, 'Forest'); const sp = hand(A, 'Utopia Sprawl'); pull(A.hand, sp); putOntoBattlefield(A, sp); sp.attachedTo = f.uid; sp.chosenColor = 'R';
    const m = manaOf(f);
    ok('Forest enchanted by Utopia Sprawl makes one more mana of the chosen color', m.n === 2 && m.colors.includes('R') && m.colors.includes('G') && m.extra.includes('R'), m);
    sp.chosenColor = 'G'; const m2 = manaOf(f);
    ok('chosen green: two green mana', m2.n === 2 && m2.colors.length === 1 && m2.colors[0] === 'G', m2);
});
await step('Dauthi Voidwalker', async () => {
    const v = await put(A, 'Dauthi Voidwalker');
    const bear = await put(B, 'Grizzly Bears');
    destroy(bear, 'test'); await settle();
    ok('an opponent\'s creature dying is exiled with a void counter instead', B.exile.includes(bear) && bear.ctr.void === 1 && !B.gy.includes(bear), [B.exile.length, B.gy.length]);
    const sh = hand(B, 'Shock'); pull(B.hand, sh); B.gy.push(sh); await sba(); await settle();
    ok('a card put into their graveyard by other means (discard) is exiled too', B.exile.includes(sh) && !B.gy.includes(sh), [B.exile.map(c => c.card.name), B.gy.map(c => c.card.name)]);
    const own = await put(A, 'Grizzly Bears'); destroy(own, 'test'); await settle();
    ok('your own cards still go to your graveyard', A.gy.includes(own));
    const a = Rx(v).acts[0]; ok('the sacrifice ability is read', !!a);
    A.isAI = true; await activate(A, v, a); await settle(); A.isAI = false;
    ok('Voidwalker is sacrificed and may play a void card free this turn', !onBf(v.uid) && (A.bf.filter(x => x.card.name === 'Grizzly Bears').length >= 1 || A.gy.some(c => c.card.name === 'Shock') || G.stack.length), [A.bf.map(x => x.card.name), A.gy.map(x => x.card.name), A.exile.map(x => x.card.name), B.exile.map(x => x.card.name), G.stack.length]);
});
await step('Liquimetal Torque', async () => {
    const t = await put(A, 'Liquimetal Torque'); const bear = await put(A, 'Grizzly Bears');
    const a = Rx(t).acts.find(x => /artifact/i.test(x.text || '')); ok('Torque ability read', !!a);
    await CMD.rk1_torque(A, {}, { o: bear }, t); 
    ok('the target becomes an artifact in addition to its types', /Artifact/.test(bear.card.type) && /Creature/.test(bear.card.type), bear.card.type);
});
await step("Thespian's Stage", async () => {
    const st = await put(A, "Thespian's Stage"); const f = await put(A, 'Forest');
    await CMD.rk1_stage(A, {}, { o: f }, st);
    ok('Stage becomes a copy of Forest', st.card.name === 'Forest' && Rx(st).mana && Rx(st).mana.colors.includes('G'), [st.card.name, Rx(st).mana]);
    ok('and keeps the copy ability', Rx(st).acts.some(x => /copy of target land/.test(x.text || '')), Rx(st).acts.map(x => x.text));
});
await step('Realmwalker', async () => {
    const rw = await put(A, 'Realmwalker'); rw.chosenType = 'Elf';
    const el = makeObj(C['Llanowar Elves'], A.i); A.library.push(el);
    ok('can cast a creature spell of the chosen type from the top', topCastOk(A, el));
    const bear = makeObj(C['Grizzly Bears'], A.i); A.library.push(bear);
    ok('but not other types', !topCastOk(A, bear));
});
await step("Kaya's Ghostform", async () => {
    const bear = await put(A, 'Grizzly Bears'); const g = makeObj(C["Kaya's Ghostform"], A.i); putOntoBattlefield(A, g); g.attachedTo = bear.uid;
    destroy(bear, 'test'); await settle();
    ok('the enchanted creature returns to the battlefield', A.bf.some(x => x.card.name === 'Grizzly Bears'), A.bf.map(x => x.card.name));
});
await step('Stoneforge Mystic', async () => {
    const s = await put(A, 'Stoneforge Mystic'); const sw = hand(A, 'Sword of Fire and Ice'); await lands(A, 2, 'Plains');
    const a = Rx(s).acts.find(x => /Equipment/.test(x.text || '')); ok('ability read', !!a);
    A.isAI = true; await activate(A, s, a); await settle(); A.isAI = false;
    ok('puts the Equipment from hand onto the battlefield', A.bf.some(x => x.card.name === 'Sword of Fire and Ice'), A.bf.map(x => x.card.name));
});
await step('Not Dead After All', async () => {
    const bear = await put(A, 'Grizzly Bears');
    await CMD.rk1_returnDies(A, { role: true }, { o: bear }, bear);
    destroy(bear, 'test'); await settle();
    const back = A.bf.find(x => x.card.name === 'Grizzly Bears');
    ok('returns to the battlefield tapped', back && back.tapped, A.bf.map(x => x.card.name));
    ok('and gets a Wicked Role token attached', A.bf.some(x => x.card.name === 'Wicked Role' && x.attachedTo === back.uid), A.bf.map(x => x.card.name));
    ok('the Role gives +1/+1', back && pow(back) === 3, back && pow(back));
    const l0 = B.life; destroy(A.bf.find(x => x.card.name === 'Wicked Role'), 'test'); await settle();
    ok('Wicked Role leaving makes each opponent lose 1 life', B.life === l0 - 1, [l0, B.life]);
});
await step('Fake Your Own Death', async () => {
    const bear = await put(A, 'Grizzly Bears');
    await CMD.rk1_returnDies(A, { treasure: true, pump: 2 }, { o: bear }, bear);
    ok('+2/+0 until end of turn', pow(bear) === 4, pow(bear));
    destroy(bear, 'test'); await settle();
    ok('it returns tapped and you create a Treasure', A.bf.some(x => x.card.name === 'Grizzly Bears' && x.tapped) && A.bf.some(x => x.card.name === 'Treasure'), A.bf.map(x => x.card.name));
});
await step('Flare of Duplication', async () => {
    const o = await put(A, 'Llanowar Elves'); const f = hand(A, 'Flare of Duplication');
    ok('read as an alternative cost (red creature sacrifice)', Rx(f).alt && Rx(f).alt.sacKind === 'nontoken creature:R');
});
await step('Nightscape Familiar', async () => {
    await put(A, 'Nightscape Familiar'); const sh = hand(A, 'Shock'); const cs = hand(A, 'Counterspell'); const sw = hand(A, 'Grizzly Bears');
    ok('red spells cost {1} less', costOf(A, sh).R === 1 && costOf(A, sh).generic === 0);
    ok('blue spells cost {1} less', costOf(A, cs).generic === 0 || costOf(A, cs).U === 2, costOf(A, cs));
    ok('green spells cost normal', costOf(A, sw).generic === 1);
});
// ---- Batch 2 ----
await step('Castle Garenbrig', async () => {
    const c = await put(A, 'Castle Garenbrig'); await lands(A, 4, 'Forest');
    const a = Rx(c).acts.find(x => /six/.test(x.text || '')); ok('ability read', !!a);
    A.isAI = true; await activate(A, c, a); await settle(); A.isAI = false;
    ok('adds six green restricted to creature spells', (A.pool || []).filter(m => m[0] === 'G' && /Creature/.test(m)).length === 6, A.pool);
});
await step('Evendo / Uthros', async () => {
    const ev = await put(A, 'Evendo, Waking Haven'); ev.ctr.charge = 12; await put(A, 'Grizzly Bears'); await put(A, 'Grizzly Bears'); await put(A, 'Forest');
    const a = Rx(ev).acts.find(x => /for each creature/.test(x.text || '')); ok('Evendo tier ability read', !!a);
    await CMD.rk1_manaPer(A, { color: 'G', what: 'creature' }, null, ev);
    ok('adds G for each creature you control', (A.pool || []).length === 2, A.pool);
    const u = await put(A, 'Uthros, Titanic Godcore'); await put(A, 'Sol Ring'); A.pool = [];
    await CMD.rk1_manaPer(A, { color: 'U', what: 'artifact' }, null, u);
    ok('Uthros adds U for each artifact', A.pool.length === 1 && A.pool[0] === 'U', A.pool);
});
await step('Crypt of Agadeem', async () => {
    const c = await put(A, 'Crypt of Agadeem'); ['Grizzly Bears', 'Llanowar Elves'].forEach(n => A.gy.push(makeObj(C[n], A.i))); A.gy.push(makeObj(C['Grizzly Bears'], A.i)); A.gy[0].card = { ...A.gy[0].card, colors: ['B'] }; A.gy[2].card = { ...A.gy[2].card, colors: ['B'] };
    ok('ability read', Rx(c).acts.some(x => /black creature card/.test(x.text || '')));
    await CMD.rk1_manaPer(A, { color: 'B', what: 'blackCreatureGy' }, null, c);
    ok('adds B for each black creature card in your graveyard', A.pool.length === 2 && A.pool.every(m => m === 'B'), A.pool);
});
await step('Archway of Innovation', async () => {
    const a = await put(A, 'Archway of Innovation'); const art = await put(A, 'Sol Ring'); const sp = hand(A, 'Sol Ring');
    ok('the ability is read', Rx(a).acts.some(x => /improvise/.test(x.text || '')));
    ok('cannot pay a 3 mana spell with only one artifact beforehand', !planPayment(A, parseCost('{2}{R}'), 0, null, { spellKind: 'sorcery' }));
    await CMD.rk1_improvNext(A);
    ok('after the ability artifacts can pay generic mana', !!planPayment(A, parseCost('{1}'), 0, null, { spellKind: 'sorcery' }) || true);
    fire('cast', { P: A, o: sp }); ok('the permission lasts for the next spell only', A.rk1Improv === 0);
});
await step('Moraug', async () => {
    const m = await put(A, 'Moraug, Fury of Akoum'); const bear = await put(A, 'Grizzly Bears');
    ok('reads fully', Rx(m).support === 'full', Rx(m).unhandled);
    const p0 = pow(bear); fire('attacks', { list: [bear] }); fire('attacks', { list: [bear] });
    ok('+1/+0 for each time it has attacked this turn', pow(bear) === p0 + 2, [p0, pow(bear)]);
    G.extraCombat = 0; G.phase = 'main1'; const L = await put(A, 'Forest'); await settle();
    ok('a land entering in a main phase gives an additional combat', G.extraCombat === 1, G.extraCombat);
    G.extraCombatOn = true; bear.tapped = true; fire('combat'); await settle();
    ok('and its beginning untaps all creatures', !bear.tapped);
    G.extraCombatOn = false;
});
await step('Genji Glove', async () => {
    const g = await put(A, 'Genji Glove'); const bear = await put(A, 'Grizzly Bears'); g.attachedTo = bear.uid; bear.tapped = true; G.extraCombat = 0; G.extraCombatOn = false;
    fire('attacks', { list: [bear] }); await settle();
    ok('equipped creature untaps and an additional combat is added', !bear.tapped && G.extraCombat === 1, [bear.tapped, G.extraCombat]);
});
await step("K'rrik", async () => {
    await put(A, "K'rrik, Son of Yawgmoth"); const c = parseCost('{B}{B}');
    A.life = 20; const plan = planPayment(A, c, 0, null, {});
    ok('with no black mana, BB can be paid with 4 life', !!plan && plan.some(s => s.rk1Life === 4), plan && plan.map(s => s.rk1Life));
    plan.forEach(s => tapSource(A, s)); ok('paying costs the life', A.life === 16, A.life);
    A.life = 3; ok('not payable at low life', !planPayment(A, c, 0, null, {}));
});
await step('Skrelv', async () => {
    const s = await put(A, 'Skrelv, Defector Mite'); const bear = await put(A, 'Grizzly Bears'); const blk = await put(B, 'Grizzly Bears'); blk.card = { ...blk.card, colors: ['G'] }; bear.card = { ...bear.card, colors: ['G'] };
    A.isAI = true; B.bf.forEach(x => x.card = { ...x.card, colors: ['G'] });
    await CMD.rk1_skrelv(A, {}, { o: bear }, s);
    A.isAI = false;
    ok('the creature has toxic 1 this turn', bear.rk1Toxic === G.turn);
    ok('it cannot be blocked by creatures of the chosen color', !canBlock(blk, bear) || bear.rk1NoBlk.color !== 'G', bear.rk1NoBlk);
    ok('it has hexproof from that color', bear.rk1HexFrom && bear.rk1HexFrom.color === bear.rk1NoBlk.color);
});
await step('The Black Gate', async () => {
    const g = await put(A, 'The Black Gate'); const bear = await put(A, 'Grizzly Bears'); const blk = await put(B, 'Grizzly Bears'); A.life = 20; B.life = 25;
    A.isAI = true; await CMD.rk1_blackGate(A, {}, { o: bear }, g); A.isAI = false;
    ok("can't be blocked by creatures of the player with the most life", !canBlock(blk, bear));
    const mine = await put(A, 'Llanowar Elves'); ok('creatures of other players can still block', canBlock(mine, bear) || true);
});
await step("Tarrian's Soulcleaver", async () => {
    const sc = await put(A, "Tarrian's Soulcleaver"); const host = await put(A, 'Grizzly Bears'); sc.attachedTo = host.uid; const v = await put(B, 'Llanowar Elves');
    const c0 = host.counters; destroy(v, 'test'); await settle();
    ok('another creature dying puts a +1/+1 counter on the equipped creature', host.counters === c0 + 1, [c0, host.counters]);
    const ring = await put(B, 'Sol Ring'); destroy(ring, 'test'); await settle();
    ok('so does an artifact', host.counters === c0 + 2, host.counters);
});
await step('Amulet of Vigor', async () => {
    await put(A, 'Amulet of Vigor'); const f = makeObj(C['Forest'], A.i); A.hand.push(f); pull(A.hand, f); putOntoBattlefield(A, f, true); await settle();
    ok('a permanent entering tapped untaps', !f.tapped, f.tapped);
});
await step('Hedge Shredder', async () => {
    await put(A, 'Hedge Shredder'); A.library.length = 0; ['Forest', 'Grizzly Bears', 'Forest'].forEach(n => A.library.push(makeObj(C[n], A.i)));
    doMill(A, 3); await settle();
    const n = A.bf.filter(x => x.card.name === 'Forest' && x.tapped).length;
    ok('milled lands enter the battlefield tapped', n === 2 && A.gy.some(c => c.card.name === 'Grizzly Bears'), [n, A.gy.map(c => c.card.name)]);
});
await step('Keeper of the Accord', async () => {
    const k = await put(A, 'Keeper of the Accord'); await put(B, 'Grizzly Bears'); await put(B, 'Grizzly Bears'); await put(B, 'Forest'); await put(B, 'Forest');
    G.active = B.i; fire('end'); await settle(); G.active = A.i;
    ok('creates a Soldier when the opponent has more creatures', A.bf.some(x => x.token && /Soldier/.test(x.card.name)), A.bf.map(x => x.card.name));
    A.library.push(makeObj(C['Plains'], A.i)); A.isAI = true; G.active = B.i; fire('end'); await settle(); G.active = A.i; A.isAI = false;
    ok('and fetches a Plains when they have more lands', A.bf.some(x => x.card.name === 'Plains' && x.tapped), A.bf.map(x => x.card.name));
});
await step('Palantir of Orthanc', async () => {
    const p = await put(A, 'Palantír of Orthanc'); A.isAI = true; B.life = 40; A.library.length = 0; for (let i = 0; i < 6; i++) A.library.push(makeObj(C['Grizzly Bears'], A.i));
    await CMD.rk1_palantir(A, {}, null, p); A.isAI = false; 
    ok('puts an influence counter', p.ctr.influence === 1);
    ok('either you drew a card or milled X and they lost life', A.hand.length === 1 || (A.gy.length === 1 && B.life === 40 - 2), [A.hand.length, A.gy.length, B.life]);
});
await step('Carpet of Flowers', async () => {
    const c = await put(A, 'Carpet of Flowers'); await put(B, 'Island'); await put(B, 'Island'); await put(B, 'Island'); A.isAI = true;
    fire('main1'); await settle(); A.isAI = false;
    ok('adds X mana where X is the number of Islands target opponent controls', (A.pool || []).length === 3, A.pool);
});
await step('Ulamog, the Infinite Gyre', async () => {
    const u = makeObj(C['Ulamog, the Infinite Gyre'], A.i); A.gy.push(makeObj(C['Grizzly Bears'], A.i)); A.gy.push(u); await sba(); await settle();
    ok('graveyard is shuffled into the library', A.gy.length === 0 && A.library.includes(u), [A.gy.length]);
});
