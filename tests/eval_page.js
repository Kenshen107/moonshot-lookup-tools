// Evaluate a JS expression inside the game page (for quick checks): node tests/eval_page.js "parseEffects('draw a card')"
'use strict';
const { launch, openTestPage, installHelpers } = require('./lib/harness');
(async () => {
    const h = await launch(); const { page, errors } = await openTestPage(h.ctx, h.server); await installHelpers(page);
    const r = await page.evaluate(`(async () => { try { return JSON.stringify(await (${process.argv[2]}), null, 1); } catch (e) { return 'ERR ' + e.message; } })()`);
    console.log(r); if (errors.length) console.log('PAGE ERRORS', errors);
    await h.close();
})();
