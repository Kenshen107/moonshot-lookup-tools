// Checks the art in docs/spellslinger-asset-manifest.json (made by tools/asset_manifest.js) before it is committed.
// For every file that exists: the exact size in pixels, PNG or JPEG as named, a transparent background where the manifest asks for one
// (and a fully transparent corner on sleeves and companion parts), and the size budget in KB. Missing files are listed, not failed,
// unless --strict. Exit code 1 when any file that exists fails.
//
//   node tests/asset_check.js                 every asset
//   node tests/asset_check.js --batch 2       one batch (also --slot sleeve, --id sleeve-gilded-sanctum)
//   node tests/asset_check.js --missing       also list every missing file
//   node tests/asset_check.js --strict        missing files fail too
//   node tests/asset_check.js --json          machine-readable report
//
// Too big? `python3 tools/optimize_art.py <file>` shrinks a PNG (256-colour palette) or JPEG and keeps the original in _old/.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const flag = k => args.includes(k);

function readPng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) return null;
    let off = 8, ihdr = null, trns = false; const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
        else if (type === 'tRNS') trns = true;
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'PLTE') ihdr.plte = data;
        if (type === 'tRNS') ihdr.trnsData = data;
        off += 12 + len;
    }
    if (!ihdr) return null;
    const alpha = ihdr.color === 4 || ihdr.color === 6 || trns;
    return { fmt: 'png', w: ihdr.w, h: ihdr.h, alpha, ihdr, idat: Buffer.concat(idat) };
}
// Alpha of the top-left pixel (only for 8-bit, non-interlaced images; null when it can't tell)
function cornerAlpha(p) {
    const { ihdr } = p; if (ihdr.depth !== 8 || ihdr.interlace) return null;
    let raw; try { raw = zlib.inflateSync(p.idat); } catch (e) { return null; }
    const first = raw[1]; // row 0, after the filter byte (filters other than 0/2 on row 0 keep pixel 0 unchanged, since there is no left neighbour)
    if (ihdr.color === 6) return raw[4];
    if (ihdr.color === 4) return raw[2];
    if (ihdr.color === 3) return ihdr.trnsData && first < ihdr.trnsData.length ? ihdr.trnsData[first] : 255;
    return 255;
}
function readJpeg(buf) {
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let off = 2;
    while (off < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1], len = buf.readUInt16BE(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { fmt: 'jpg', h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7), alpha: false };
        off += 2 + len;
    }
    return null;
}
function inspect(file) {
    const buf = fs.readFileSync(file);
    const info = readPng(buf) || readJpeg(buf);
    if (!info) return { fmt: '?', bytes: buf.length };
    if (info.fmt === 'png') info.corner = cornerAlpha(info);
    delete info.ihdr; delete info.idat;
    return { ...info, bytes: buf.length };
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'spellslinger-asset-manifest.json'), 'utf8'));
let list = manifest.assets;
if (opt('--batch')) list = list.filter(a => String(a.batch) === opt('--batch'));
if (opt('--slot')) list = list.filter(a => a.slot === opt('--slot'));
if (opt('--id')) list = list.filter(a => a.id === opt('--id'));

const report = { ok: [], bad: [], missing: [] };
for (const a of list) {
    const file = path.join(ROOT, a.path);
    if (!fs.existsSync(file)) { report.missing.push(a); continue; }
    const i = inspect(file), problems = [];
    const want = path.extname(a.path).slice(1).replace('jpeg', 'jpg');
    if (i.fmt !== want) problems.push(`is ${i.fmt.toUpperCase()}, should be ${want.toUpperCase()}`);
    if (i.w !== a.w || i.h !== a.h) problems.push(`is ${i.w} x ${i.h}, should be ${a.w} x ${a.h}`);
    if (a.alpha && !i.alpha) problems.push('has no transparency (needs a transparent background)');
    if (a.alpha && ['sleeve', 'sleeve-fx', 'companion', 'avatar', 'emote', 'prop', 'pack'].includes(a.slot) && i.corner != null && i.corner > 8)
        problems.push('the top-left corner pixel is not transparent (background not removed?)');
    const k = Math.round(i.bytes / 1024);
    if (a.maxKB && k > a.maxKB) problems.push(`is ${k} KB, budget ${a.maxKB} KB (python3 tools/optimize_art.py ${a.path})`);
    (problems.length ? report.bad : report.ok).push({ ...a, kb: k, problems });
}

// Files in the new art folders that the manifest doesn't know (a typo in a name, or a file in the wrong folder)
const NEW_DIRS = ['sleeves', 'mats', 'companions', 'themes', 'props', 'avatars', 'bots', 'emotes', 'packs2', 'table', 'fx2', 'celebrations'];
const known = new Set(manifest.assets.map(a => a.path));
const unknown = [];
const walk = d => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (f === '_old') continue; if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(png|jpe?g|webp)$/i.test(f)) { const rel = path.relative(ROOT, p).split(path.sep).join('/'); if (!known.has(rel)) unknown.push(rel); } } };
NEW_DIRS.forEach(d => walk(path.join(ROOT, 'spellslinger', 'art', d)));

if (flag('--json')) { console.log(JSON.stringify({ ok: report.ok.length, bad: report.bad, missing: report.missing.map(a => a.path), unknown }, null, 1)); }
else {
    console.log(`Asset check: ${list.length} in scope, ${report.ok.length} OK, ${report.bad.length} with problems, ${report.missing.length} not made yet.`);
    report.bad.forEach(a => console.log(`  ✗ ${a.path}: ${a.problems.join('; ')}`));
    if (unknown.length) { console.log(`  ? ${unknown.length} file(s) not in the manifest (check the name and folder):`); unknown.forEach(u => console.log(`      ${u}`)); }
    if (flag('--missing') || flag('--strict')) report.missing.forEach(a => console.log(`  · missing ${a.path} (${a.w} x ${a.h}${a.alpha ? ', transparent' : ''})`));
    else if (report.missing.length) console.log('  (add --missing to list the files not made yet)');
}
process.exit(report.bad.length || (flag('--strict') && report.missing.length) ? 1 : 0);
