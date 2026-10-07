// Shared helpers for the Spellslinger Duels tests.
// - answers requests for http://spellslinger.test/ from the repo's files (no web server)
// - launches the installed Chromium through the proxy when HTTPS_PROXY is set
// - opens the game in "test" mode: autoplay URL, but no turn starts by itself
//   (the served game file gets `if (!window.__TEST) beginTurn();`), so a test can
//   build any board it wants and call the engine directly.
'use strict';
const fs = require('fs');
const path = require('path');

// GAME_ROOT lets a test run against another checkout (for example a git worktree of an older commit) to compare results
const ROOT = process.env.GAME_ROOT ? path.resolve(process.env.GAME_ROOT) : path.resolve(__dirname, '..', '..');
const OUT_ROOT = path.resolve(__dirname, '..', '..');

function loadPlaywright() {
    const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean);
    for (const t of tries) { try { return require(t); } catch (e) { /* try the next */ } }
    throw new Error('Playwright for Node was not found. Set PLAYWRIGHT_MODULE=/path/to/node_modules/playwright');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.gz': 'application/gzip' };

// Patches applied to every served text file, only active when window.__TEST is set: no turn starts by itself
// (the game begins one at the end of newGame() and endTurn()) and ?autoplay doesn't start its own game.
// Both patches are plain text matches, so they keep working after the file is split.
function patch(text) {
    return text
        .replace(/^(\s*)beginTurn\(\);(\s*\n\})/mg, '$1if (!window.__TEST) beginTurn();$2')
        // ?autoplay would also start its own background game while a test is running
        .replace(/if \(AUTOPLAY\) autoTest\(\);/g, 'if (AUTOPLAY && !window.__TEST) autoTest();');
}

const SITE = 'http://spellslinger.test';
async function serveRepo(ctx) {
    await ctx.route(`${SITE}/**`, route => {
        try {
            let p = decodeURIComponent(new URL(route.request().url()).pathname);
            if (p === '/') p = '/Spellslinger_Duels.html';
            const file = path.join(ROOT, p);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'not found' });
            const ext = path.extname(file);
            let body = fs.readFileSync(file);
            if (ext === '.html' || ext === '.js') body = Buffer.from(patch(body.toString('utf8')));
            return route.fulfill({ status: 200, contentType: TYPES[ext] || 'application/octet-stream', body });
        } catch (e) { return route.fulfill({ status: 500, body: String(e) }); }
    });
}

async function launch(opts = {}) {
    const pw = loadPlaywright();
    const profileDir = opts.profileDir || path.join(OUT_ROOT, 'tests', '.cache', process.env.TEST_PROFILE || 'profile');
    fs.mkdirSync(profileDir, { recursive: true });
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const ctx = await pw.chromium.launchPersistentContext(profileDir, {
        executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
        args: ['--no-sandbox'],
        proxy: proxy ? { server: proxy, bypass: '127.0.0.1,localhost' } : undefined,
        ignoreHTTPSErrors: true,
        viewport: opts.viewport || { width: 1280, height: 800 }
    });
    await serveRepo(ctx);
    // Card pictures and web fonts are not needed (and are blocked by the sandbox proxy anyway)
    await ctx.route(/\.(png|jpe?g|gif|webp|svg|woff2?)(\?.*)?$|cards\.scryfall\.io|fonts\.(googleapis|gstatic)\.com|api\.qrserver\.com/, route => route.abort());
    const server = { url: SITE };
    return { ctx, server, close: async () => { await ctx.close(); } };
}

// Opens the game with no game running yet; the page's functions are then called through page.evaluate.
async function openTestPage(ctx, server, query = 'autoplay&format=none') {
    await ctx.addInitScript(() => { window.__TEST = true; });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.goto(`${server.url}/Spellslinger_Duels.html?${query}`);
    await page.waitForFunction(() => typeof newGame === 'function' && typeof rulesFor === 'function', null, { timeout: 30000 });
    await page.waitForTimeout(800);
    return { page, errors };
}

// In-page helpers every suite uses. Installed once with installHelpers(page).
const HELPERS = `
window.T = {
    // Cards by name from Scryfall (through the game's own loader and card cache)
    async cards(names) {
        const parsed = parseDeckText(names.map(n => '1 ' + n).join('\\n'));
        const rows = await resolveDeckCards([...parsed.commander, ...parsed.main]);
        const C = {};
        rows.forEach(r => { if (r.card) C[r.card.name] = r.card; });
        return C;
    },
    async newGame(extra) {
        T._decks = T._decks || [await listToOppDeck('1 Tyrox, Saurid Tyrant\\n98 Mountain', 'commander'), await listToOppDeck('1 Tyrox, Saurid Tyrant\\n98 Mountain', 'commander')];
        await newGame(T._decks[0], T._decks[1]);
        G.active = 0; G.turn = 5; G.phase = 'main1'; G.busy = false; G.firstTurn = false;
        return [G.players[0], G.players[1]];
    },
    put(P, card, extra) { const o = makeObj(card, P.i); putOntoBattlefield(P, o); o.sick = false; Object.assign(o, extra || {}); return o; },
    lands(P, C, n) { for (let i = 0; i < n; i++) { const m = makeObj(C['Mountain'], P.i); putOntoBattlefield(P, m); m.sick = false; } },
    clear() { G.players.forEach(P => { ['bf', 'hand', 'gy', 'exile'].forEach(z => P[z].splice(0)); }); G.stack.length = 0; G.attackers = []; G.blocks = {}; G.trigQ = []; G.mode = null; G.over = false; G.extraCombat = 0; G.combatFired = false; },
    // Every card in exactly one zone, no NaN life or power: returns a list of problems
    invariants() {
        const bad = [], seen = new Set();
        G.players.forEach(P => ['hand', 'bf', 'gy', 'exile', 'library', 'command'].forEach(z => (P[z] || []).forEach(x => { if (seen.has(x.uid)) bad.push('duplicate ' + x.card.name); seen.add(x.uid); })));
        G.players.forEach(P => { if (isNaN(P.life)) bad.push('NaN life ' + P.name); });
        allPerms().filter(isCreature).forEach(x => { if (isNaN(pow(x)) || isNaN(tou(x))) bad.push('NaN P/T ' + x.card.name); });
        return bad;
    }
};
`;
async function installHelpers(page) { await page.evaluate(HELPERS); }

// Runs a list of named checks in the page. A check is [label, passed, detail?].
function formatChecks(list) {
    return list.map(([label, ok, detail]) => ({ label, ok: !!ok, detail: detail === undefined ? undefined : JSON.stringify(detail).slice(0, 300) }));
}

function printResults(suite, results, extraErrors = []) {
    const failed = results.filter(r => !r.ok);
    results.forEach(r => console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.label}${r.detail !== undefined ? ' ' + r.detail : ''}`));
    extraErrors.forEach(e => console.log('PAGE ERROR', e));
    console.log(`${suite}: ${results.length - failed.length}/${results.length} passed${extraErrors.length ? `, ${extraErrors.length} page errors` : ''}`);
    return failed.length === 0 && extraErrors.length === 0;
}

function writeOut(name, data) {
    const dir = path.join(OUT_ROOT, 'tests', '.out');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(data, null, 1));
}

module.exports = { ROOT, launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, loadPlaywright };
