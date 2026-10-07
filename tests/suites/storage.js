// Saved data (spellslinger/00-storage.js): the move from localStorage to IndexedDB.
//   - an old localStorage save is copied into IndexedDB on first load, the originals stay as a backup, and it is not copied again
//   - saves reload after a page reload
//   - a save far bigger than localStorage's 5MB works
//   - without IndexedDB the game falls back to localStorage and still saves and reloads
// Each check uses its own browser profile folder under tests/.cache/ so nothing is shared between them.
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

async function open(profile, { noIdb = false, before = null } = {}) {
    const dir = path.join(ROOT, 'tests', '.cache', profile);
    const h = await launch({ profileDir: dir });
    if (noIdb) await h.ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
    const page = await h.ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    const load = async () => { await page.goto(`${h.server.url}/Spellslinger_Duels.html`); await page.waitForFunction(() => typeof init === 'function' && typeof profile !== 'undefined' && profile, null, { timeout: 30000 }); await page.waitForTimeout(500); };
    await load();
    return { h, page, errors, reload: load };
}
const snap = page => page.evaluate(() => JSON.stringify({ coins: profile.coins, usd: profile.usd, wins: profile.wins, decks: profile.decks.map(d => [d.name, d.format, Object.keys(d.cards).length]), who: accounts.current }));

async function main() {
    const results = [];
    const ok = (label, cond, detail) => results.push({ label, ok: !!cond, detail: detail === undefined ? undefined : JSON.stringify(detail).slice(0, 300) });
    for (const d of ['st_migrate', 'st_big', 'st_fallback']) fs.rmSync(path.join(ROOT, 'tests', '.cache', d), { recursive: true, force: true });

    // ---- 1. an old (localStorage) save moves to IndexedDB ----
    {
        // Phase A: the game with IndexedDB switched off behaves like the old version: everything is saved in localStorage
        let a = await open('st_migrate', { noIdb: true });
        ok('without IndexedDB the game uses localStorage', await a.page.evaluate(() => STORAGE.backend) === 'localStorage');
        await a.page.evaluate(async () => { await makeVerifiedStarter('tyrox'); profile.coins = 4321; profile.usd = 88; profile.wins = 7; saveProfile(); store.set('handSize', 'L'); });
        const before = await snap(a.page);
        const lsKeys = await a.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('duels:')).sort());
        ok('the save is in localStorage', lsKeys.includes('duels:profile:Ovid') && lsKeys.includes('duels:accounts'), lsKeys);
        await a.h.close();
        // Phase B: the new storage on the same browser profile
        let b = await open('st_migrate');
        ok('IndexedDB is used', await b.page.evaluate(() => STORAGE.backend) === 'indexedDB', await b.page.evaluate(() => STORAGE.error));
        ok('the old save was copied (keys)', (await b.page.evaluate(() => STORAGE.migrated)) >= 3, await b.page.evaluate(() => STORAGE.migrated));
        ok('the player, coins, cash, wins and deck are identical', (await snap(b.page)) === before, await snap(b.page));
        ok('the hand size setting came across', await b.page.evaluate(() => store.get('handSize', null)) === 'L');
        ok('the localStorage originals are still there as a backup', await b.page.evaluate(k => k.every(x => localStorage.getItem(x) !== null), lsKeys));
        // changes now go to IndexedDB only
        await b.page.evaluate(async () => { profile.coins = 555; saveProfile(); await STORAGE.flush(); });
        ok('a new save does not touch the localStorage backup', await b.page.evaluate(() => JSON.parse(localStorage.getItem('duels:profile:Ovid')).coins) === 4321);
        await b.h.close();
        // Phase C: reload; the save is read from IndexedDB, not copied again from localStorage
        let c = await open('st_migrate');
        ok('after a reload the newer IndexedDB save is used', (await c.page.evaluate(() => profile.coins)) === 555, await c.page.evaluate(() => profile.coins));
        ok('nothing is migrated a second time', (await c.page.evaluate(() => STORAGE.migrated)) === 0);
        ok('no page errors', a.errors.length + b.errors.length + c.errors.length === 0, [...a.errors, ...b.errors, ...c.errors].slice(0, 3));
        await c.h.close();
    }

    // ---- 2. a save much bigger than localStorage can hold ----
    {
        let a = await open('st_big');
        const r = await a.page.evaluate(async () => {
            const big = { text: 'x'.repeat(12 * 1024 * 1024) };
            const okSet = store.set('bigtest', big);
            await STORAGE.flush();
            let ls = true; try { localStorage.setItem('duels:probe', 'y'.repeat(6 * 1024 * 1024)); localStorage.removeItem('duels:probe'); } catch (e) { ls = false; }
            return { okSet, localStorageTakes6MB: ls };
        });
        ok('a 12MB value saves', r.okSet, r);
        await a.h.close();
        let b = await open('st_big');
        const len = await b.page.evaluate(() => (store.get('bigtest', { text: '' }).text || '').length);
        ok('and reloads whole', len === 12 * 1024 * 1024, len);
        await b.page.evaluate(() => { store.remove('bigtest'); return STORAGE.flush(); });
        await b.h.close();
        let c = await open('st_big');
        ok('a removed key stays removed after a reload', await c.page.evaluate(() => store.get('bigtest', null)) === null);
        // a save made just before the page is reloaded or closed still lands (no explicit flush)
        await c.page.evaluate(() => { store.set('quick', { n: 42 }); persistCards(); });
        await c.reload();
        ok('a save made right before a reload is kept', (await c.page.evaluate(() => store.get('quick', null))) && (await c.page.evaluate(() => store.get('quick', null).n)) === 42);
        await c.h.close();
    }

    // ---- 3. no IndexedDB: the game still saves and reloads ----
    {
        let a = await open('st_fallback', { noIdb: true });
        await a.page.evaluate(() => { profile.coins = 321; saveProfile(); store.set('manaMode', 'auto'); });
        const snapA = await snap(a.page);
        await a.h.close();
        let b = await open('st_fallback', { noIdb: true });
        ok('localStorage fallback: a save reloads', (await snap(b.page)) === snapA, await snap(b.page));
        ok('localStorage fallback: the backend says so', await b.page.evaluate(() => STORAGE.backend) === 'localStorage');
        ok('localStorage fallback: a failing save returns false (the game then trims its card cache)', await b.page.evaluate(() => store.set('toobig', 'z'.repeat(6 * 1024 * 1024))) === false);
        await b.h.close();
    }

    const good = printResults('storage', results);
    writeOut('storage', formatChecks(results.map(r => [r.label, r.ok, r.detail])));
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
