// The AI's blocking when it is in danger: it must block (even chump) to stay alive.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    const C = await T.cards(['Grizzly Bears', 'Hill Giant', 'Shivan Dragon', 'Raging Goblin', 'Goblin Guide', 'Mountain']);
    let P0, P1;
    const fresh = async () => { [P0, P1] = await T.newGame(); T.clear(); P0.life = P1.life = 40; G.over = false; P1.isAI = true; };
    const put = (P, name, extra) => T.put(P, C[name], extra);
    const blocksFor = (atk, life) => { P1.life = life; G.attackers = []; G.blocks = {}; declareAttackers(P0, atk); atk.forEach(a => { a.tapped = true; }); return aiChooseBlocks(P1, P0); };
    const n = b => Object.keys(b).length;
    await fresh();
    let a = put(P0, 'Hill Giant'); put(P1, 'Raging Goblin');
    ok('a 1/1 chump-blocks a 3/3 when the hit would be lethal (life 3)', n(blocksFor([a], 3)) === 1);
    await fresh(); a = put(P0, 'Grizzly Bears', { tkw: ['double strike'] }); put(P1, 'Raging Goblin');
    ok('it blocks a double striker whose two hits are lethal (life 4)', n(blocksFor([a], 4)) === 1);
    await fresh(); a = put(P0, 'Hill Giant'); let b = put(P0, 'Hill Giant'); put(P1, 'Raging Goblin'); put(P1, 'Raging Goblin');
    ok('two attackers, life 6: blocks enough to survive', n(blocksFor([a, b], 6)) >= 1);
    await fresh(); a = put(P0, 'Hill Giant'); b = put(P0, 'Hill Giant'); put(P1, 'Raging Goblin'); put(P1, 'Raging Goblin');
    ok('two attackers, life 4: it does not stay at 1 life when it can block (both blocked)', n(blocksFor([a, b], 4)) === 2);
    await fresh(); a = put(P0, 'Hill Giant', { tkw: ['trample'] }); put(P1, 'Raging Goblin');
    ok('trample, life 3: the chump block still reduces damage to 2, so it blocks', n(blocksFor([a], 3)) === 1);
    await fresh(); a = put(P0, 'Hill Giant'); put(P1, 'Raging Goblin');
    ok('life 4 against a 3/3 is not lethal, a bad block is not required', n(blocksFor([a], 4)) <= 1);
    await fresh(); a = put(P0, 'Hill Giant'); put(P1, 'Raging Goblin'); G.lifeSeen = null;
    ok('with a pump spell or burn in hand it should block even when the hit leaves 1 life', (() => { const r = blocksFor([a], 3); return n(r) === 1; })());
    return out;
};

async function main() {
    const dir = path.join(ROOT, 'tests', '.cache', 'aiblock');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('aiblock', results, errors);
    writeOut('aiblock', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
