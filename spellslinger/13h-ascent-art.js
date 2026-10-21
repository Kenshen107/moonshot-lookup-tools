// Planeswalker's Ascent, art and animation runtime (data in 13g-ascent-art-data.js, guide in docs/ascent-art-prompts.md).
// Portraits and effects use the pixel art in spellslinger/art/ when the files exist, and a placeholder until then.
const ASCENT_CHAR = Object.fromEntries(ASCENT_CHARACTERS.map(c => [c.id, c]));
const ASC_ART = { ok: {}, probed: false, size: { w: 96, h: 96 }, legacy: {} };
const ASC_FX = { active: 0, max: 4 };
const ASC_FX_KINDS_ART = {}; // kind -> true when its PNG strip exists
function ascFxPref() { try { return store.get('ascentFx', true) !== false; } catch (e) { return true; } }
function ascFxSet(on) { store.set('ascentFx', !!on); renderAscentIfOpen(); }
function renderAscentIfOpen() { if ($('ascentApp') && !$('view-campaign').classList.contains('hidden')) renderAscent(); }
// Effects never play in tests (autoplay and the lab), for people who ask for less motion, or when switched off
function ascFxEnabled() { return window.__FX_FORCE === true || (!AUTOPLAY && !window.__LAB && !reducedMotion() && ascFxPref()); }

// ---- Probing for art files (once per page load) ----
function ascProbe(path, note) {
    return new Promise(res => { const img = new Image(); img.onload = () => { if (note) note(img.naturalWidth); res(true); }; img.onerror = () => res(false); img.src = path; });
}
async function ascProbeArt() {
    if (ASC_ART.probed) return;
    ASC_ART.probed = true;
    const tasks = [
        ...ASCENT_CHARACTERS.map(async c => { const p = `spellslinger/art/characters/${c.id}.png`; ASC_ART.ok[p] = await ascProbe(p, w => { if (w === 256) ASC_ART.legacy[p] = true; }); }),
        ...Object.keys(ASCENT_FX).map(async k => { ASC_FX_KINDS_ART[k] = await ascProbe(`spellslinger/art/fx/${k}.png`); })
    ];
    await Promise.all(tasks);
    if (Object.values(ASC_ART.ok).some(Boolean)) renderAscentIfOpen();
}

// ---- Portraits and dialogue ----
function ascPortraitHTML(id, opts = {}) {
    const c = ASCENT_CHAR[id];
    if (!c) return '';
    const path = `spellslinger/art/characters/${id}.png`, talk = opts.talk ? ' talk' : '';
    if (ASC_ART.ok[path]) return `<div class="asc-portrait sprite${talk}${ASC_ART.legacy[path] ? ' old' : ''}" style="background-image:url('${path}')" role="img" aria-label="${esc(c.name)}"></div>`;
    return `<div class="asc-portrait ph${talk}${c.boss ? ' boss' : ''}" style="--accent:${c.accent}" role="img" aria-label="${esc(c.name)} (placeholder art)"><span>${c.emoji}</span></div>`;
}
function ascLine(id, kind, seed) {
    const c = ASCENT_CHAR[id], list = c && c.lines && c.lines[kind];
    if (!list) return '';
    const arr = Array.isArray(list) ? list : [list];
    return arr[(seed === undefined ? Math.floor(Math.random() * arr.length) : seed % arr.length)];
}
function ascSpeechHTML(id, kind, seed) {
    const c = ASCENT_CHAR[id];
    if (!c) return '';
    return `<div class="asc-say">${ascPortraitHTML(id, { talk: true })}<div class="asc-bubble"><strong>${esc(c.name)}</strong> <span class="note">${esc(c.title)}</span><p>${esc(ascLine(id, kind, seed))}</p></div></div>`;
}

// ---- Effects ----
function ascFxKindFor(ev, ctx) {
    const o = ctx && ctx.o;
    if (!o || !o.card) return null;
    const t = o.card.type || '';
    if (ev === 'enters') {
        if (o.token) return null;
        if (/\bLand\b/.test(t) && !/\bCreature\b/.test(t)) {
            const m = isBasic(o.card) && { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' }[o.card.name];
            return m ? 'land-' + m : 'land-nonbasic';
        }
        if (/\bCreature\b/.test(t)) {
            const cols = (o.card.colors || []).filter(c => 'WUBRG'.includes(c));
            return cols.length > 1 ? 'creature-multi' : cols.length === 1 ? 'creature-' + cols[0] : 'creature-colorless';
        }
        return null;
    }
    if (ev === 'cast') {
        if (/\bCreature\b/.test(t) || /\bLand\b/.test(t)) return null; // those play their effect when they enter
        for (const [re, k] of [[/\bPlaneswalker\b/, 'spell-planeswalker'], [/\bBattle\b/, 'spell-battle'], [/\bInstant\b/, 'spell-instant'], [/\bSorcery\b/, 'spell-sorcery'], [/\bArtifact\b/, 'spell-artifact'], [/\bEnchantment\b/, 'spell-enchantment']]) if (re.test(t)) return k;
    }
    return null;
}
function ascFxHook(ev, ctx) {
    if (ev !== 'enters' && ev !== 'cast') return;
    if (!ascFxEnabled() || !G || G.over) return;
    const kind = ascFxKindFor(ev, ctx);
    if (kind) ascFxPlay(kind, ev === 'enters' ? ctx.o.uid : null);
}
function ascFxPlay(kind, uid) {
    const spec = ASCENT_FX[kind];
    if (!spec || ASC_FX.active >= ASC_FX.max) return null;
    ASC_FX.active++;
    setTimeout(() => {
        try {
            const el = uid != null ? document.querySelector(`#game [data-uid="${uid}"]`) : null;
            const host = el || $('midBar') || $('game');
            if (!host || $('game').classList.contains('hidden')) return;
            const r = host.getBoundingClientRect(), px = spec.size * 2;
            const node = document.createElement('div');
            const dur = spec.frames / spec.fps;
            node.className = `fx-item fx-${kind}`;
            node.setAttribute('aria-hidden', 'true');
            node.style.cssText = `left:${Math.round(r.left + r.width / 2 - px / 2)}px; top:${Math.round(r.top + r.height / 2 - px / 2)}px; width:${px}px; height:${px}px; --dur:${dur.toFixed(2)}s;`;
            if (ASC_FX_KINDS_ART[kind]) {
                node.classList.add('sprite');
                node.style.backgroundImage = `url('spellslinger/art/fx/${kind}.png')`;
                node.style.backgroundSize = `${px * spec.frames}px ${px}px`;
                node.style.setProperty('--frames', spec.frames);
                node.style.setProperty('--strip', `${px * spec.frames}px`);
            } else {
                node.classList.add('ph');
                node.dataset.kind = kind;
                node.innerHTML = `<span>${ASC_FX_EMOJI[kind] || '✨'}</span>`;
            }
            document.body.appendChild(node);
            setTimeout(() => node.remove(), dur * 1000 + 150);
        } catch (e) { /* an effect must never break a game */ } finally { setTimeout(() => { ASC_FX.active = Math.max(0, ASC_FX.active - 1); }, 300); }
    }, 90);
    return kind;
}
const ASC_FX_EMOJI = { 'land-W': '☀️', 'land-U': '💧', 'land-B': '☠️', 'land-R': '🔥', 'land-G': '🍃', 'land-nonbasic': '🌈', 'creature-W': '😇', 'creature-U': '🌊', 'creature-B': '💀', 'creature-R': '🔥', 'creature-G': '🌿', 'creature-colorless': '⚙️', 'creature-multi': '🌈', 'spell-instant': '⚡', 'spell-sorcery': '📜', 'spell-artifact': '⚙️', 'spell-enchantment': '✨', 'spell-planeswalker': '🌀', 'spell-battle': '⚔️' };
