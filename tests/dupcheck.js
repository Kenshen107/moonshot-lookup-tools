// Static check (no browser): top-level function / const / let / class names defined in more than one spellslinger script.
// Scripts share one global scope, so a duplicate silently replaces the earlier one (this once broke the Play tab's opponent picker).
//   node tests/dupcheck.js [--files a.js,b.js]   (with --files, only duplicates that involve those files are reported)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'spellslinger');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'art' && f !== 'data') walk(p); } else if (f.endsWith('.js')) files.push(p); } })(dir);
const only = (process.argv.find(a => a.startsWith('--files=')) || '').slice(8).split(',').filter(Boolean);
const seen = new Map();
for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
        const list = seen.get(m[1]) || []; list.push(path.relative(dir, f)); seen.set(m[1], list);
    }
}
let bad = 0;
for (const [n, fs_] of seen) if (fs_.length > 1 && (!only.length || fs_.some(x => only.some(o => x.includes(o))))) { bad++; console.log(`${n}: ${[...new Set(fs_)].join(', ')}${new Set(fs_).size === 1 ? ' (twice in one file)' : ''}`); }
console.log(bad ? `${bad} duplicate name(s)` : 'no duplicate names');
process.exit(bad ? 1 : 0);
