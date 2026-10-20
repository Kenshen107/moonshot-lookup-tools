// Character habits, taunts and compliments, the draw offer, revenge pacts between bots, remembered rivalries and the Tap all lands button (2026-10-20).
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        try {
            const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
            const raw = await (await fetch('/__cards.json')).json(); const C = {};
            const want = ['Island', 'Mountain', 'Grizzly Bears', 'Serra Angel', 'Tyrox, Saurid Tyrant', 'Divination', 'Truce', 'Tempt with Bunnies', 'Tempt with Discovery', 'Tempt with Glory', 'Tempt with Immortality', 'Horn of Greed', 'Zenith Chronicler', 'Stormfist Crusader', 'Rites of Flourishing', 'Mana Flare', 'Font of Mythos', 'Donate', 'Harmless Offering', 'Wrong Turn', 'Zedruu the Greathearted', 'Bazaar Trader', 'Humble Defector', 'Jinxed Idol', 'Jinxed Ring', 'Disrupt Decorum', 'Coveted Peacock', 'Vengeful Ancestor', 'Agitator Ant', 'Swamp Mosquito', 'Grateful Apparition', 'Crawling Chorus', 'Gray Ogre', 'Lightning Bolt'];
            raw.forEach(c => { if (want.includes(c.name) && !C[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); C[c.name] = sc; } });
            const fresh = async (chars) => {
                const mk = () => ({ name: 'T', format: 'commander', commander: C['Tyrox, Saurid Tyrant'], entries: [{ card: C['Island'], n: 98 }], source: 'test' });
                const ds = [mk(), mk(), mk(), mk()]; ds[1].aiStyle = 'control'; ds[2].aiStyle = 'aggro'; ds[3].aiStyle = 'ramp';
                await newGame(ds[0], ds[1], null, ds.slice(2)); T.clear(); G.turn = 6; G.phase = 'main1'; G.firstTurn = false; G.active = 0; G.busy = false;
                G.players.forEach((P, i) => { P.life = 40; P.salt = 0; P.said = 0; P.name = ['You', 'Alpha', 'Bravo', 'Charlie'][i] + ', test'; P.library.length = 0; for (let k = 0; k < 30; k++) P.library.push(makeObj(C['Island'], i)); });
                G.players[0].isAI = false;
                G.players.forEach(P => { delete P.char; });
                assignCharacters();
                if (chars) chars.forEach((k, i) => { if (k) G.players[i + 1].char = { key: k, ...CHARACTERS[k] }; });
                G.cool = G.players.map(() => 0); G.deals = []; G.tips = []; G.reliable = {}; G.askUsed = null; G.arch = null;
                return G.players;
            };
            const lines = () => G.log.map(l => l.text || l);
            const lands = (P, n, name) => { for (let i = 0; i < n; i++) T.put(P, C[name]); };

            const friends = (A) => G.players.forEach(P => { if (P !== A) { P.trust = { [A.i]: 3 }; } });
            const names = ['Truce', 'Tempt with Bunnies', 'Tempt with Discovery', 'Tempt with Glory', 'Tempt with Immortality', 'Horn of Greed', 'Zenith Chronicler', 'Stormfist Crusader', 'Rites of Flourishing', 'Mana Flare', 'Font of Mythos', 'Donate', 'Harmless Offering', 'Wrong Turn', 'Zedruu the Greathearted', 'Bazaar Trader', 'Humble Defector', 'Jinxed Idol', 'Jinxed Ring', 'Disrupt Decorum', 'Coveted Peacock', 'Vengeful Ancestor', 'Agitator Ant', 'Swamp Mosquito', 'Grateful Apparition', 'Crawling Chorus'];
            ok('every group hug, kingmaking, goad and poison card is read as fully automated', names.every(n => C[n] && rulesFor(C[n]).support === 'full'), names.filter(n => !C[n] || rulesFor(C[n]).support !== 'full'));
            const cast = async (A, id, extra, t) => applyEffect(A, cmd(id, extra || {}), t || null, T.put(A, C['Island']));
            // ---- Truce ----
            let [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const h0 = G.players.map(P => P.hand.length); await cast(A, 'truce');
            ok('Truce: every player draws two cards', G.players.every((P, i) => P.hand.length === h0[i] + 2), G.players.map((P, i) => P.hand.length - h0[i]));
            // ---- tempting offers ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            let r0 = G.players.map(P => P.bf.filter(o => o.card.name === 'Rabbit').length);
            await cast(A, 'tempt', { kind: 'bunnies' });
            const rab = G.players.map(P => P.bf.filter(o => /Rabbit/.test(o.card.name)).length);
            ok('Tempt with Bunnies: three friends take it, so the caster gets one rabbit and three more', rab[0] === 4 && rab[1] === 1 && rab[2] === 1 && rab[3] === 1, rab);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); G.arch = A.i; B.trust = {}; Cc.trust = {}; D.trust = {};
            await cast(A, 'tempt', { kind: 'bunnies' });
            const rab2 = G.players.map(P => P.bf.filter(o => /Rabbit/.test(o.card.name)).length);
            ok('a bot that fears the caster (the archenemy) and does not like them refuses the deal', rab2[0] === 1 && rab2[1] === 0, rab2);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); friends(A);
            await cast(A, 'tempt', { kind: 'discovery' });
            const lc = G.players.map((P, i) => P.bf.filter(o => /\bLand\b/.test(o.card.type) && o.card.name === 'Island').length - (i === 0 ? 1 : 0)); // the caster's own Island was the spell's source
            ok('Tempt with Discovery: each taker fetches a land and the caster fetches one more per taker', lc[0] === 4 && lc[1] === 1 && lc[2] === 1 && lc[3] === 1, lc);
            // ---- Horn of Greed, Zenith Chronicler, Stormfist Crusader ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            T.put(A, C['Horn of Greed']); const lb = makeObj(C['Island'], B.i); B.bf.push(lb); const hb = B.hand.length;
            fire('landfall', { o: lb }); await settle();
            ok("Horn of Greed: another player's land draws that player a card", B.hand.length === hb + 1, B.hand.length - hb);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            T.put(A, C['Zenith Chronicler']); const gold = { ...C['Serra Angel'], colors: ['W', 'U'], id: 'gold-test' }; CARDS.set(gold.id, gold);
            const hs = G.players.map(P => P.hand.length);
            const go = makeObj(gold, B.i); fire('cast', { P: B, o: go }); await settle();
            ok('Zenith Chronicler: the first multicolored spell of the turn draws everyone else a card', A.hand.length === hs[0] + 1 && Cc.hand.length === hs[2] + 1 && D.hand.length === hs[3] + 1 && B.hand.length === hs[1], G.players.map((P, i) => P.hand.length - hs[i]));
            const go2 = makeObj(gold, B.i); fire('cast', { P: B, o: go2 }); await settle();
            ok('and only the first one', A.hand.length === hs[0] + 1);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const hc = G.players.map(P => P.hand.length), lifeC = G.players.map(P => P.life);
            await applyEffect(A, { t: 'drawAll', n: 1 }, null, T.put(A, C['Island'])); await cast(A, 'allLose', { n: 1 });
            ok('Stormfist Crusader\'s upkeep: each player draws a card and loses 1 life', G.players.every((P, i) => P.hand.length === hc[i] + 1 && P.life === lifeC[i] - 1));
            // ---- Rites of Flourishing and Mana Flare ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const lim0 = landLimit(B); T.put(Cc, C['Rites of Flourishing']);
            ok('Rites of Flourishing: every player may play an additional land', landLimit(B) === lim0 + 1 && landLimit(A) === lim0 + 1, [lim0, landLimit(B)]);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const isl = T.put(B, C['Island']); const m0 = manaOf(isl).n; T.put(A, C['Mana Flare']);
            ok("Mana Flare: another player's land makes twice the mana", manaOf(isl).n === m0 * 2, [m0, manaOf(isl).n]);
            // ---- Donate ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 0 }; Cc.trust = { 0: 2 }; D.trust = { 0: 3 };
            const ang = T.put(A, C['Serra Angel']);
            await applyEffect(A, cmd('donate', { target: 'perm', filter: 'permanent you control', good: true }), { o: ang }, T.put(A, C['Island']));
            ok('Donate: the permanent goes to a player (the one A is least liked by), and its owner is still A', A.bf.every(o => o !== ang) && ang.owner !== A.i && ang.realOwner === A.i && G.players[ang.owner].bf.includes(ang), { to: ang.owner });
            ok('the new controller cannot attack with it right away', ang.sick === true);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const ang2 = T.put(A, C['Serra Angel']); ang2.owner = A.i;
            ok('giveControl moves it to the chosen player only', giveControl(ang2, B) && B.bf.includes(ang2) && !A.bf.includes(ang2) && giveControl(ang2, B) === false);
            // dies under the new controller: back to the owner's graveyard
            dieOrLeave(ang2, 'gy');
            ok("a donated permanent that dies goes to its owner's graveyard", A.gy.some(o => o.card.name === 'Serra Angel') && !B.gy.some(o => o.card.name === 'Serra Angel'), [A.gy.length, B.gy.length]);
            // Zedruu
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const gift = T.put(A, C['Grizzly Bears']); giveControl(gift, B); const gift2 = T.put(A, C['Serra Angel']); giveControl(gift2, Cc);
            const hz = A.hand.length, lz = A.life; CMD.zedruuUpkeep(A);
            ok('Zedruu: gain X life and draw X cards for the permanents you own that others control', A.life === lz + 2 && A.hand.length === hz + 2, [A.life - lz, A.hand.length - hz]);
            // Jinxed Idol: sacrifice a creature, an opponent takes the artifact
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); B.trust = { 0: 0 };
            const idol = T.put(A, C['Jinxed Idol']);
            await applyEffect(A, cmd('donateSelf'), null, idol);
            ok('Jinxed Idol goes to an opponent', idol.owner !== A.i && foes(A).includes(G.players[idol.owner]), idol.owner);
            ok('and it is a liability to the AI', isLiability(idol));
            // ---- Kingmaking: a doomed bot gives its best permanent to the player it trusts most ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); G.turn = 30; B.life = 6; A.life = 40;
            [Cc, D].forEach(F => { for (let i = 0; i < 4; i++) T.put(F, C['Serra Angel']); F.life = 40; }); T.put(A, C['Serra Angel']);
            const bear = T.put(B, C['Grizzly Bears']); B.trust = { 0: 3, [Cc.i]: -2, [D.i]: -1 }; B.grudge = {};
            ok('a bot far behind with low life is doomed', isDoomed(B) && !isDoomed(Cc), [isDoomed(B), isDoomed(Cc)]);
            await applyEffect(B, cmd('donate', { target: 'perm', filter: 'permanent you control', good: true }), { o: bear }, T.put(B, C['Island']));
            ok('kingmaking: the doomed bot gives its best permanent to the player it trusts most', bear.owner === A.i, bear.owner);
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']); G.turn = 30; B.life = 6;
            [Cc, D].forEach(F => { for (let i = 0; i < 4; i++) T.put(F, C['Serra Angel']); }); T.put(B, C['Grizzly Bears']); B.grudge = { [Cc.i]: 9, [D.i]: 2 };
            ok("a doomed bot's attacks go to whoever it holds the biggest grudge against", podPickDefender(B) === Cc, podPickDefender(B) && podPickDefender(B).i);
            // ---- Goad ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const mine = T.put(A, C['Grizzly Bears']), theirs = T.put(B, C['Grizzly Bears']), theirs2 = T.put(Cc, C['Grizzly Bears']);
            await cast(A, 'goadAllTheirs');
            ok("Disrupt Decorum goads every creature A doesn't control, and none of A's own", isGoaded(theirs) && isGoaded(theirs2) && !isGoaded(mine), [isGoaded(theirs), isGoaded(mine)]);
            // ---- poison ----
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const mos = T.put(A, C['Swamp Mosquito']); G.defender = B.i; G.attackers = [mos.uid]; atkDef(mos);
            CMD.poisonDefender(A, {}, null, mos);
            ok('Swamp Mosquito: the defending player gets a poison counter', B.poison === 1, B.poison);
            // The AI sees poison: an infect attacker is lethal when the target has 9 poison counters
            [A, B, Cc, D] = await fresh(['greg', 'marcus', 'sam']);
            const inf = T.put(A, C['Gray Ogre']); inf.tkw.push('infect');
            B.poison = 9; B.life = 40; Cc.life = 40; D.life = 40;
            ok('dmgVs counts poison as the share of life it takes: 3 infect power vs 9 poison is lethal', dmgVs(inf, B) >= B.life, [dmgVs(inf, B), B.life]);
            ok('so the AI picks the poisoned player to attack', podPickDefender(A) === B, podPickDefender(A) && podPickDefender(A).i);
            ok('no broken invariants', T.invariants().length === 0, T.invariants());
        } catch (e) { out.push([`threw after ${out.length} checks: ${e.message}`, false, String(e.stack).split('\n').slice(0, 4)]); }
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    printResults('politics3', results, []);
    writeOut('politics3', results);
    await h.close();
    process.exit(results.every(x => x.ok) ? 0 : 1);
})();
