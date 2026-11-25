// Jadzi and Othelm plans: not a hiding style, and the pushers attack (owner, 2026-11-25)
'use strict';
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: path.join(ROOT, 'tests', '.cache', 'jadzi_othelm') });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        const C = await T.cards(['Rampant Frogantua', 'Jadzi, Oracle of Arcavios', 'Othelm, Sigardian Outcast', 'Forest', 'Grizzly Bears']);
        for (const [cmdName, pusher] of [['Jadzi, Oracle of Arcavios', 'Rampant Frogantua'], ['Othelm, Sigardian Outcast', null]]) {
            const [A, B, C2, D] = await T.newGame(4); T.clear(); G.turn = 12; G.phase = 'main1'; G.active = 0; A.aiStyle = 'ramp'; A.planKey = undefined;
            const cm = makeObj(C[cmdName], 0); cm.isCommander = true; A.command.push(cm);
            const pl = planOf(A);
            ok(cmdName + ': plan found, style no longer a hiding one', pl && A.aiStyle === 'midrange' && !isQuiet(A), [A.aiStyle, tn(A, 'quiet'), tn(A, 'openAttack')]);
            if (pusher) {
                const f = T.put(A, C[pusher]); f.sick = false;
                const kept = aiChooseAttackers(A);
                ok('Rampant Frogantua attacks when no blocker at the table kills it', kept.includes(f), kept.map(o => o.card.name));
                const blocker = T.put(B, C['Grizzly Bears']); blocker.tp = 8; blocker.tq = 8; blocker.sick = false; // an 11/11 blocker kills it
                const kept2 = aiChooseAttackers(A);
                ok('...and stays home when an untapped creature would kill it', !kept2.includes(f), kept2.map(o => o.card.name));
            }
        }
        return out;
    });
    const results = formatChecks(raw); const good = printResults('jadzi_othelm', results, errors); writeOut('jadzi_othelm', { results, errors }); await h.close(); process.exit(good ? 0 : 1);
})().catch(e => { console.error('ERR', String(e).slice(0, 500)); process.exit(2); });
