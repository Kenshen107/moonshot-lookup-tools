// Ability audit (2026-11-15): for every card in every deck file and VERIFIED_DECKS deck, put it on the computer's battlefield with plenty of mana and
// let the computer use its abilities. Reports abilities it uses over and over, or uses with no visible effect (wasted mana). Writes tests/.out/ability_audit.json.
// node tests/ability_audit.js [--deck name]
'use strict';
const fs = require('fs'), path = require('path');
const { launch, openTestPage, installHelpers } = require('./lib/harness');
const dir = path.join(__dirname, 'decks');
const only = process.argv.includes('--deck') ? process.argv[process.argv.indexOf('--deck') + 1] : null;
const names = new Set();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt') && (!only || f.includes(only)))) {
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) { const m = l.match(/^\s*(\d+)\s+(.+?)\s*$/); if (m && !/^(Plains|Island|Swamp|Mountain|Forest)$/.test(m[2])) names.add(m[2].replace(/\s*\/\/.*$/, '').replace(/\//g, ' // ')); }
}
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const list = [...names];
    const res = await page.evaluate(async (list) => {
        const out = [];
        const C = await T.cards([...list, 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Grizzly Bears']);
        const sig = () => JSON.stringify(G.players.map(P => [P.life, P.hand.length, P.gy.length, P.exile.length, P.library.length, P.bf.map(x => [x.card.name, x.card.type, x.counters, x.tp, x.tq, x.dmg, JSON.stringify(x.ctr), x.attachedTo, x.slNog, x.animated ? 1 : 0, x.baseSet ? 1 : 0]), JSON.stringify(P.emblems || [])]));
        for (const name of list) {
            const c = C[name]; if (!c) { out.push({ name, skip: 'no card' }); continue; }
            try {
                const [A, B] = await T.newGame(); T.clear(); G.turn = 8; G.phase = 'main1'; G.active = 1; G.busy = false; G.firstTurn = false; G.stack.length = 0;
                B.isAI = true; A.isAI = true;
                for (const l of ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']) for (let i = 0; i < 2; i++) T.put(B, C[l]);
                T.put(B, C['Grizzly Bears']); T.put(A, C['Grizzly Bears']);
                for (let i = 0; i < 4; i++) { B.library.push(makeObj(C['Forest'], B.i)); A.library.push(makeObj(C['Forest'], A.i)); }
                const o = T.put(B, c); o.sick = false;
                const acts = (typeof actsOf === 'function' ? actsOf(o) : []) || [];
                if (!acts.length && !(Rx(o).gyActs || []).length) { out.push({ name, none: true }); continue; }
                const uses = []; const orig = activate;
                activate = async function (P, ob, a, ...rest) { const before = sig(); const idx = actsOf(ob).indexOf(a); const r = await orig.call(this, P, ob, a, ...rest); await settle(); uses.push({ src: ob.card.name, idx, ok: r, same: sig() === before }); return r; };
                try { await aiUseAbilities(B); } finally { activate = orig; }
                await settle();
                const by = {}; uses.forEach(u => { const k = u.src + '#' + u.idx; by[k] = by[k] || { n: 0, noEffect: 0 }; by[k].n++; if (u.ok && u.same) by[k].noEffect++; });
                out.push({ name, acts: acts.length, uses: by });
            } catch (e) { out.push({ name, err: String(e && e.message || e).slice(0, 120) }); }
        }
        return out;
    }, list);
    fs.mkdirSync(path.join(__dirname, '.out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '.out', 'ability_audit.json'), JSON.stringify(res, null, 1));
    const flagged = res.filter(r => r.uses && Object.values(r.uses).some(u => u.n >= 3 || u.noEffect >= 1));
    console.log(`cards checked: ${res.length}, with abilities: ${res.filter(r => r.acts).length}, errors: ${res.filter(r => r.err).length}, missing: ${res.filter(r => r.skip).length}`);
    for (const r of flagged) console.log(r.name, JSON.stringify(r.uses));
    for (const r of res.filter(r => r.err)) console.log('ERR', r.name, r.err);
    process.exit(0);
})();
