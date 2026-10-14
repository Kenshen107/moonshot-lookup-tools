// Which of these sentences does the card reader understand?  node tests/parse_try.js sentences.txt   (one sentence per line; prints the effects it reads, or NOT READ)
'use strict';
const fs = require('fs');
const { launch, openTestPage, installHelpers } = require('./lib/harness');
(async () => {
    const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
    const h = await launch(); const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const rows = await page.evaluate(ls => ls.map(l => { try { const r = parseEffects(l); return [l, r ? JSON.stringify(r) : null]; } catch (e) { return [l, 'ERR ' + e.message]; } }), lines);
    rows.forEach(([l, r]) => console.log(`${r ? 'OK ' : 'NO '} ${l}${r ? '\n      ' + r.slice(0, 200) : ''}`));
    if (errors.length) console.log('PAGE ERRORS', errors);
    await h.close();
})();
