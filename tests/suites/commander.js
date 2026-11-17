// Commander zone changes (owner's report, 2026-10-14): a commander put into the graveyard or exile lets its owner choose the command zone
// or leaving it there (to reanimate it); a commander exiled from the graveyard asks again; to the library it goes to the command zone.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');

(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = [];
        const C = await T.cards(['Mountain', 'Grizzly Bears']);
        const [A] = await T.newGame(); A.isAI = false; // a person, so the question is asked
        T.clear();
        const zones = o => ['bf', 'gy', 'exile', 'command', 'hand', 'library'].filter(z => A[z].includes(o)).join(',') || 'nowhere';
        const mk = () => { const c = T.put(A, C['Grizzly Bears']); c.isCommander = true; return c; };
        const asks = [];
        const real = window.askYes;
        const answer = v => { window.askYes = async (P, msg) => { asks.push(msg); return v; }; };

        // 1. Dies, owner says yes -> command zone
        answer(true); let c = mk(); dieOrLeave(c, 'gy'); await settle();
        out.push(['a commander that dies goes to the command zone when its owner says so', zones(c) === 'command' && asks.length === 1, zones(c)]);

        // 2. Dies, owner says no -> stays in the graveyard, and is not asked again
        A.command.length = 0; asks.length = 0; answer(false); c = mk(); dieOrLeave(c, 'gy'); await settle(); await settle();
        out.push(['the owner can leave a dead commander in the graveyard', zones(c) === 'gy' && asks.length === 1, { z: zones(c), asks: asks.length }]);

        // 3. From the graveyard it can be reanimated like any card
        pull(A.gy, c); A.bf.push(c);
        out.push(['a commander left in the graveyard can be put back onto the battlefield', zones(c) === 'bf', zones(c)]);
        pull(A.bf, c);
        A.gy.push(c); c.cmdSeenZone = 'gy';

        // 4. Exiled from the graveyard -> asked again, and yes sends it to the command zone
        pull(A.gy, c); A.exile.push(c); asks.length = 0; answer(true); await settle();
        out.push(['a commander exiled from the graveyard goes to the command zone when asked', zones(c) === 'command' && asks.length === 1, { z: zones(c), asks: asks.length }]);

        // 5. Exiled from the battlefield, owner says no -> stays in exile
        A.command.length = 0; asks.length = 0; answer(false); c = mk(); leaveBattlefield(c, 'exile'); await settle();
        out.push(['the owner can leave an exiled commander in exile', zones(c) === 'exile' && asks.length === 1, zones(c)]);

        // 6. To the library -> command zone, no question for the computer
        A.exile.length = 0; A.isAI = true; asks.length = 0; c = mk(); leaveBattlefield(c, 'library'); await settle();
        A.isAI = false;
        out.push(['a computer commander that would go to the library returns to the command zone without asking', zones(c) === 'command' && asks.length === 0, zones(c)]);

        // 7. Tokens and ordinary cards are never asked about
        asks.length = 0; const plain = T.put(A, C['Grizzly Bears']); dieOrLeave(plain, 'gy'); await settle();
        out.push(['an ordinary creature stays in the graveyard and nothing is asked', zones(plain) === 'gy' && asks.length === 0, zones(plain)]);
        // 8. Nurgle's Conscription exiles a graveyard: the commander in it asks its owner (owner's report, 2026-11-17)
        A.command.length = 0; A.exile.length = 0; A.gy.length = 0; asks.length = 0; answer(true);
        const B = G.players[1]; B.isAI = true;
        c = mk(); dieOrLeave(c, 'gy'); answer(false); await settle(); asks.length = 0; answer(true);
        const bait = T.put(A, C['Grizzly Bears']); dieOrLeave(bait, 'gy');
        const cons = T.put(B, C['Grizzly Bears']);
        B.isAI = false; const rp = window.pickCard; window.pickCard = async (P, list) => list.find(x => x === bait);
        await applyEffect(B, { t: 'conscription' }, null, cons, null, 'Nurgle\'s Conscription');
        window.pickCard = rp; B.isAI = true;
        await settle();
        out.push(['a commander in a graveyard exiled by Nurgle\'s Conscription asks its owner', zones(c) === 'command' && asks.length === 1, { z: zones(c), asks: asks.length }]);
        // 10. An opponent's reanimation from a graveyard asks the commander's owner first
        A.command.length = 0; A.exile.length = 0; A.gy.length = 0; G.players[1].bf.length = 0; asks.length = 0; answer(true);
        c = mk(); dieOrLeave(c, 'gy'); answer(false); await settle(); asks.length = 0; answer(true);
        const rcard = T.put(B, C['Grizzly Bears']); B.isAI = true;
        await applyEffect(B, { t: 'conscription' }, null, rcard, null, 'Nurgle\'s Conscription');
        out.push(['an opponent taking from your graveyard lets you move your commander to the command zone first', zones(c) === 'command' && asks.length >= 1, { z: zones(c), asks: asks.length }]);
        // 9. A person's commander bounced to hand or tucked into the library asks too
        A.command.length = 0; A.library.length = 0; A.hand.length = 0; asks.length = 0; answer(true);
        c = mk(); leaveBattlefield(c, 'hand'); await settle();
        out.push(['a commander bounced to hand can go to the command zone', zones(c) === 'command' && asks.length === 1, { z: zones(c), asks: asks.length }]);
        asks.length = 0; answer(false); c = mk(); leaveBattlefield(c, 'hand'); await settle(); await settle();
        out.push(['the owner can keep a bounced commander in hand (asked once)', zones(c) === 'hand' && asks.length === 1, { z: zones(c), asks: asks.length }]);
        A.hand.length = 0; asks.length = 0; answer(true); c = mk(); leaveBattlefield(c, 'library'); await settle();
        out.push(['a person with a tucked commander is asked and can choose the command zone', zones(c) === 'command' && asks.length === 1, { z: zones(c), asks: asks.length }]);
        window.askYes = real;
        // Hand size: a person is asked which card to discard
        T.clear(); A.hand.length = 0;
        for (let i = 0; i < 9; i++) A.hand.push(makeObj(C[i % 2 ? 'Mountain' : 'Grizzly Bears'], 0));
        const asked = []; const realPick = window.pickCard;
        window.pickCard = async (P, list, title) => { asked.push(title); return list.find(x => x.card.name === 'Grizzly Bears'); };
        G.active = 0; G.phase = 'main2'; await endTurn(A);
        window.pickCard = realPick;
        out.push(['a person chooses what to discard down to seven (twice for nine cards)', asked.length === 2 && A.hand.length === 7 && A.gy.filter(x => x.card.name === 'Grizzly Bears').length === 2, { asked, hand: A.hand.length }]);
        // Saddle: you choose who to tap, and you can saddle again and again
        T.clear(); A.hand.length = 0; G.active = 0; G.phase = 'main1'; G.turn = 10;
        const mountCard = { ...C['Grizzly Bears'], id: 'test-mount', name: 'Test Mount', fullName: 'Test Mount', text: 'Saddle 2', type: 'Creature — Horse Mount', power: '3', toughness: '3' };
        const mount = T.put(A, mountCard);
        const bears = [T.put(A, C['Grizzly Bears']), T.put(A, C['Grizzly Bears']), T.put(A, C['Grizzly Bears'])];
        const sacks = [];
        window.pickCard = async (P, list, title) => { sacks.push(title); return list.find(x => x === bears[2]) || list.find(x => x !== mount); };
        const act = actsOf(mount).find(x => x.saddle !== undefined);
        const first = await activate(A, mount, act);
        out.push(['saddling asks you which creature to tap, and taps the one you chose', first && bears[2].tapped && !bears[0].tapped && !bears[1].tapped && sacks.length === 1, { tapped: bears.map(b => b.tapped), asks: sacks.length }]);
        const again = await activate(A, mount, act);
        out.push(['a mount can be saddled a second time in the same turn', again && bears[0].tapped && mount.saddlers.length === 2, { again, saddlers: mount.saddlers.length }]);
        const third = await activate(A, mount, act);
        const fourth = canActivate(A, mount, act);
        out.push(['it can be saddled a third time, and stops when no creature is left to tap', third && mount.saddlers.length === 3 && fourth === false, { third, fourth, saddlers: mount.saddlers.length }]);
        window.pickCard = realPick;
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('commander', results, []);
    writeOut('commander', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
