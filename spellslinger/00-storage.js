// =====================================================================
// Spellslinger Duels - saved data (Phase 1b of docs/spellslinger-overhaul-plan.md, 2026-10-08)
//
// Everything the game saves (profiles, the card cache, caches of MTGJSON data, settings) goes through `store`.
// It used to be localStorage, which holds about 5MB and is read synchronously in hundreds of places. Now:
//   - All saved values are loaded from IndexedDB ONCE, before the game's scripts run (see loadGame below),
//     and kept in memory (STORAGE.mem, as JSON text). store.get / store.set work on memory, so they stay synchronous.
//   - store.set also queues a background write to IndexedDB (one transaction per tick). Nothing waits for it.
//   - First run after this change: every `duels:*` key found in localStorage is copied into IndexedDB. The
//     localStorage keys are left where they are as a backup (a later cleanup can delete them). After that,
//     IndexedDB is the only place the game reads.
//   - If IndexedDB can't be used (some private windows, blocked storage), the game falls back to localStorage
//     exactly as before, including the "storage is full" handling in saveProfile / trimCardCache.
//   - Test inputs (keys that start with "test", such as testListA) are read from localStorage, so a test can set them.
// Values are stored as JSON text, so store.get returns a fresh copy every time, as it always did.
// Two tabs open at once no longer see each other's changes until reload (localStorage was read live).
// =====================================================================
const STORAGE = { backend: 'localStorage', mem: new Map(), db: null, queue: new Map(), flushing: null, migrated: 0, error: null, ready: null };

const store = {
    get(k, d) {
        let v;
        if (k.startsWith('test')) { try { v = localStorage.getItem('duels:' + k); } catch (e) { v = null; } }
        else v = STORAGE.mem.get(k);
        if (!v) return d;
        try { return JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
        let s;
        try { s = JSON.stringify(v); } catch (e) { return false; }
        if (s === undefined) return false;
        if (STORAGE.backend === 'indexedDB') { STORAGE.mem.set(k, s); STORAGE.queue.set(k, s); scheduleFlush(); return true; }
        try { localStorage.setItem('duels:' + k, s); STORAGE.mem.set(k, s); return true; } catch (e) { return false; }
    },
    remove(k) {
        STORAGE.mem.delete(k);
        if (STORAGE.backend === 'indexedDB') { STORAGE.queue.set(k, null); scheduleFlush(); return; }
        try { localStorage.removeItem('duels:' + k); } catch (e) { /* fine */ }
    }
};

function scheduleFlush() {
    if (STORAGE.flushing) return;
    STORAGE.flushing = Promise.resolve().then(doFlush).catch(() => {}).then(() => { STORAGE.flushing = null; if (STORAGE.queue.size) scheduleFlush(); });
}
function doFlush() {
    const batch = [...STORAGE.queue];
    STORAGE.queue.clear();
    if (!batch.length || !STORAGE.db) return Promise.resolve();
    return new Promise(resolve => {
        let tx;
        try {
            tx = STORAGE.db.transaction('kv', 'readwrite');
            const os = tx.objectStore('kv');
            batch.forEach(([k, s]) => { if (s === null) os.delete(k); else os.put(s, k); });
        } catch (e) { storageFailed(e, batch); resolve(); return; }
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => { storageFailed(tx.error, batch); resolve(); };
    });
}
// A background write failed (quota, a closed database): try localStorage for what was queued, and tell the player
function storageFailed(err, batch) {
    STORAGE.error = String(err && err.message || err);
    let saved = true;
    batch.forEach(([k, s]) => { try { if (s === null) localStorage.removeItem('duels:' + k); else localStorage.setItem('duels:' + k, s); } catch (e) { saved = false; } });
    if (!saved && typeof toast === 'function') toast('⚠ Browser storage is full: your progress couldn\'t be saved.');
}
// Resolves when everything queued so far has been written (tests use this; the game never waits)
STORAGE.flush = async function () { while (STORAGE.flushing || STORAGE.queue.size) { scheduleFlush(); await STORAGE.flushing; } };
// Writes still waiting when the page is hidden or closed are started at once
['pagehide', 'visibilitychange'].forEach(ev => window.addEventListener(ev, () => { if (STORAGE.queue.size && !STORAGE.flushing) scheduleFlush(); }));

function storageOpenDb() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
        let r;
        try { r = indexedDB.open('spellslinger', 1); } catch (e) { reject(e); return; }
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error || new Error('IndexedDB would not open'));
        r.onblocked = () => reject(new Error('IndexedDB is blocked'));
        setTimeout(() => reject(new Error('IndexedDB took too long to open')), 4000);
    });
}
function storageLoadAllFromDb(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readonly'), os = tx.objectStore('kv');
        const keysReq = os.getAllKeys(), valsReq = os.getAll();
        tx.oncomplete = () => resolve(keysReq.result.map((k, i) => [k, valsReq.result[i]]));
        tx.onerror = tx.onabort = () => reject(tx.error);
    });
}
function storageLocalEntries() {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('duels:')) out.push([k.slice(6), localStorage.getItem(k)]); } } catch (e) { /* no localStorage */ }
    return out;
}

STORAGE.ready = (async () => {
    try {
        const db = await storageOpenDb();
        const rows = await storageLoadAllFromDb(db);
        rows.forEach(([k, v]) => { if (typeof v === 'string' && !k.startsWith('__')) STORAGE.mem.set(k, v); });
        STORAGE.db = db;
        STORAGE.backend = 'indexedDB';
        // One-time copy of the old localStorage saves (the originals stay as a backup)
        if (!rows.some(([k]) => k === '__migrated')) {
            const old = storageLocalEntries().filter(([k, v]) => v && !k.startsWith('test') && !STORAGE.mem.has(k));
            old.forEach(([k, v]) => { STORAGE.mem.set(k, v); STORAGE.queue.set(k, v); });
            STORAGE.queue.set('__migrated', JSON.stringify({ at: new Date().toISOString(), keys: old.length }));
            STORAGE.migrated = old.length;
            await doFlush();
        }
    } catch (e) {
        STORAGE.backend = 'localStorage';
        STORAGE.error = String(e && e.message || e);
        storageLocalEntries().forEach(([k, v]) => { if (v) STORAGE.mem.set(k, v); });
    }
})();

// Loads the game's scripts one after another, in this order, once the saved data is in memory.
// (They are plain scripts that share one global scope, so the order is the order they used to run in.)
function loadGame(files) {
    STORAGE.ready.then(() => {
        let i = 0;
        (function next() {
            if (i >= files.length) return;
            const s = document.createElement('script');
            s.src = 'spellslinger/' + files[i++];
            s.onload = next;
            s.onerror = () => { document.body.insertAdjacentHTML('afterbegin', `<p style="color:#f66; padding:16px;">Could not load ${s.src}. Reload the page.</p>`); };
            document.body.appendChild(s);
        })();
    });
}
