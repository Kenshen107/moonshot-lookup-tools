// Pack looks (2026-10-21, owner's request: "pack opening animations and some different pack looks with unique animations").
// Every pack gets the look of its tier (PACK_TIERS in 12-distributor.js: the same table that prices it), and each look
// opens its own way (CSS classes `anim-<name>` in styles.css). Optional pixel art from the Retro Diffusion pipeline:
// spellslinger/art/packs/<look>.png is the wrapper (96 x 144) and <look>-open.png is an 8-frame burst strip (8 x 96 px wide, 96 tall).
// Until a file exists the game uses the drawn CSS pack. Data only at the top level, so tests/ascent_art_guide.js can read it.
const PACK_LOOKS = {
    standard: { label: 'Play Booster', anim: 'tear', ms: [650, 1150], wrap: 'a vertical foil booster pack wrapper in teal and silver with a swirling galaxy emblem in the middle, crimped zigzag top and bottom, no text',
        open: 'a quick burst of cyan and white sparkles and a few torn foil scraps flying outward' },
    collector: { label: 'Collector Booster', anim: 'burst', ms: [900, 1500], wrap: 'a vertical gold and black foil booster pack wrapper with a shining sunburst emblem and a thin gold border, crimped zigzag top and bottom, no text',
        open: 'a blinding golden flash with rays and glittering gold confetti bursting outward' },
    masters: { label: 'Masters Booster', anim: 'sweep', ms: [900, 1400], wrap: 'a vertical booster pack wrapper in deep violet and silver with a polished chrome emblem and a diagonal shine, crimped zigzag top and bottom, no text',
        open: 'a silver and violet foil shimmer sweeping across with floating prismatic sparkles' },
    classic: { label: 'Classic Booster (2000-2008)', anim: 'rip', ms: [700, 1200], wrap: 'a vertical retro booster pack wrapper in red and cream with a bold simple emblem and a painted-style border, crimped zigzag top and bottom, no text',
        open: 'a ragged paper tear with flying scraps and a small puff of dust' },
    vintage: { label: 'Vintage Booster', anim: 'seal', ms: [1000, 1600], wrap: 'a vertical old booster pack wrapper in weathered brown and parchment tones with a red wax seal at the top, worn edges and a faded emblem, no text',
        open: 'a red wax seal cracking apart with flying wax chips and a puff of old dust' },
    early: { label: 'Unlimited-era Booster', anim: 'unseal', ms: [1100, 1700], wrap: 'a vertical dark blue and gold booster pack wrapper in an ornate old style with glowing rune marks around a central gem, no text',
        open: 'glowing blue runes spinning up out of a pack with floating golden sparks' },
    power: { label: 'Alpha / Beta Booster', anim: 'unveil', ms: [1400, 2100], wrap: 'a vertical black booster pack wrapper with a heavy ornate gold border and a radiant gold five-pointed star, looking priceless and ancient, no text',
        open: 'a slow rising column of golden light with spinning rays, drifting embers and a heavenly glow' }
};
const PACK_ART = { probed: false, wrap: {}, open: {} };

// Which look a pack gets: its price tier (Alpha / Beta, Unlimited era, vintage, collector, classic, masters, standard)
function packLookKey(pack) {
    if (pack && pack.look && PACK_LOOKS[pack.look]) return pack.look;
    if (pack && pack.isHits) return 'collector';
    const s = (pack && pack.set) || {};
    const t = typeof packTier === 'function' ? packTier({ code: String(s.code || '').toLowerCase(), released: s.releaseDate || s.released_at || '9999', kind: /collector/i.test((pack && pack.name) || '') ? 'collector' : 'play', type: s.type || s.set_type || '' }) : null;
    return t && PACK_LOOKS[t.key] ? t.key : 'standard';
}
// Animation times in ms: [when the wrapper falls away, when the card stack shows]
function packLookTiming(key) {
    if (typeof reducedMotion === 'function' && reducedMotion()) return [150, 350];
    return (PACK_LOOKS[key] || PACK_LOOKS.standard).ms;
}
// Looks for pixel art once per page load; a look whose files exist gets them from then on
function packArtProbe() {
    if (PACK_ART.probed) return;
    PACK_ART.probed = true;
    const probe = path => new Promise(res => { const img = new Image(); img.onload = () => res(true); img.onerror = () => res(false); img.src = path; });
    Object.keys(PACK_LOOKS).forEach(async k => {
        PACK_ART.wrap[k] = await probe(`spellslinger/art/packs/${k}.png`);
        PACK_ART.open[k] = await probe(`spellslinger/art/packs/${k}-open.png`);
        document.querySelectorAll(`.pack3d[data-look="${k}"]`).forEach(el => packApplyArt(el, k));
    });
}
function packApplyArt(el, key) {
    if (PACK_ART.wrap[key]) { el.style.setProperty('--pk-art', `url('spellslinger/art/packs/${key}.png')`); el.classList.add('has-art'); }
    if (PACK_ART.open[key]) { el.style.setProperty('--pk-open', `url('spellslinger/art/packs/${key}-open.png')`); el.classList.add('has-open'); }
}
// The pack wrapper itself (used by the pack reveal and by Ascent boosters). `attrs` is extra markup for the outer element.
function packWrapperHTML(key, code, title, sub, attrs) {
    packArtProbe();
    const L = PACK_LOOKS[key] || PACK_LOOKS.standard;
    const cls = (PACK_ART.wrap[key] ? ' has-art' : '') + (PACK_ART.open[key] ? ' has-open' : '');
    const style = (PACK_ART.wrap[key] ? `--pk-art:url('spellslinger/art/packs/${key}.png');` : '') + (PACK_ART.open[key] ? `--pk-open:url('spellslinger/art/packs/${key}-open.png');` : '');
    return `<div class="pack3d${cls}" data-look="${key}"${style ? ` style="${style}"` : ''} ${attrs || ''}>
        <div class="pk-flap"><span>${esc(code || '')}</span></div>
        <div class="pk-body"><span class="pk-spark" aria-hidden="true">✨</span><strong>${esc(title || L.label)}</strong><small>${esc(sub || L.label)}</small><em>Tap to tear open</em></div>
        <span class="pk-burst" aria-hidden="true"></span>
    </div>`;
}
// Starts a look's opening animation on a pack element; calls open() when the wrapper falls away and done() when the cards show
function packTear(el, open, done) {
    if (!el || el.classList.contains('peeling')) return false;
    const key = el.dataset.look || 'standard', L = PACK_LOOKS[key] || PACK_LOOKS.standard, T = packLookTiming(key);
    el.classList.add('peeling', 'anim-' + L.anim);
    setTimeout(() => { el.classList.add('opened'); if (open) open(); }, T[0]);
    setTimeout(() => { el.classList.add('hidden'); if (done) done(); }, T[1]);
    return true;
}
