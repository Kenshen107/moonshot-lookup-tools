// =====================================================================
// Interactive Living MTG-Themed Battlefields (2026-11-27, owner's request:
// "interactive backgrounds that move and give the idea of the player being
// able to express themselves ... first ones to match themes to mtg").
//
// 6 original fan-made MTG-inspired living battlefields + "Match Deck" auto:
//   sanctum   🏛️ Sanctum of Gold     (Obsidian & brushed gold, embers, Arcane Lanterns)
//   plains    ☀️ Radiant Citadel     (Sunbeams, feathers & light motes, Sun Prisms)
//   island    🌊 Astral Tidepool     (Ocean currents, caustics & ripples, Tidal Runes)
//   swamp     💀 Shadowed Crypt      (Bog mist & soul wisps, Soul Braziers)
//   mountain  🌋 Volcanic Caldera    (Pulsing magma veins & sparks, Magma Vents)
//   forest    🌲 Whispering Wildwood (Canopy rays, fireflies & leaves, Sunblooms)
//
// Features:
//   - Click/tap any empty mat space for theme-specific interactive bursts
//   - 4 clickable corner props in the outer desktop margins (chargeable!)
//   - Subtle atmosphere pulses on combat hits, healing, and turn handoffs
//   - Auto-pauses when hidden, reduced-motion, or autoplay/test
// =====================================================================
'use strict';

const ARENA_MATS = [
    { key: 'auto',     icon: '✨', name: 'Match Deck',          mana: 'auto', prop: '✨', propName: 'Deck Resonance',  note: 'Adapts automatically to your deck\'s mana colors.' },
    { key: 'sanctum',  icon: '🏛️', name: 'Sanctum of Gold',     mana: 'M',    prop: '🏮', propName: 'Arcane Lantern',  note: 'Carved obsidian, brushed gold & drifting embers.' },
    { key: 'plains',   icon: '☀️', name: 'Radiant Citadel',     mana: 'W',    prop: '💎', propName: 'Sun Prism',       note: 'Swaying golden sunbeams, feathers & light motes.' },
    { key: 'island',   icon: '🌊', name: 'Astral Tidepool',     mana: 'U',    prop: '🌀', propName: 'Tidal Rune',      note: 'Moonlit ocean currents, caustics & water ripples.' },
    { key: 'swamp',    icon: '💀', name: 'Shadowed Crypt',      mana: 'B',    prop: '🕯️', propName: 'Soul Brazier',    note: 'Creeping violet-emerald mist & spectral wisps.' },
    { key: 'mountain', icon: '🌋', name: 'Volcanic Caldera',    mana: 'R',    prop: '🌋', propName: 'Magma Vent',      note: 'Pulsing basalt lava veins & rising fire sparks.' },
    { key: 'forest',   icon: '🌲', name: 'Whispering Wildwood', mana: 'G',    prop: '🌸', propName: 'Sunbloom',        note: 'Dappled canopy rays, dancing fireflies & leaves.' }
];

let arenaMatPref = store.get('arenaMat', 'sanctum');
if (!ARENA_MATS.some(m => m.key === arenaMatPref)) arenaMatPref = 'sanctum';

function arenaMatInfo(key) {
    return ARENA_MATS.find(m => m.key === key) || ARENA_MATS[1];
}

function detectDeckMat() {
    if (typeof G === 'undefined' || !G || !G.players || !G.players[0]) return 'sanctum';
    const P = G.players[0];
    const counts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    const scan = list => (list || []).forEach(o => {
        const ci = (o && o.card && (o.card.ci || o.card.colors)) || [];
        ci.forEach(c => { if (c in counts) counts[c]++; });
    });
    scan(P.command); scan(P.bf); scan(P.hand);
    if (!Object.values(counts).some(Boolean)) scan(P.library);
    const sorted = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return 'sanctum';
    // If balanced 3+ colors or close tie at top, use Sanctum of Gold
    if (sorted.length >= 3 && sorted[0][1] < sorted[1][1] * 1.4) return 'sanctum';
    const map = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' };
    return map[sorted[0][0]] || 'sanctum';
}

function activeArenaMat() {
    return arenaMatPref === 'auto' ? detectDeckMat() : arenaMatPref;
}

(function initArenaMats() {
    const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isAuto = () => (typeof AUTOPLAY !== 'undefined' && AUTOPLAY) || !!window.__TEST || !!window.__LAB;

    const cv = $('arenaMotes');
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;

    let currentMat = activeArenaMat();
    let pts = [], bursts = [], ripples = [], flashes = [];
    let raf = 0, lastT = 0, pulseEnergy = 0;

    // 4 interactive corner props tucked cleanly into outer desktop margins
    function ensureProps() {
        const g = $('game');
        if (!g) return null;
        let host = $('arenaProps');
        if (!host) {
            host = document.createElement('div');
            host.id = 'arenaProps';
            host.className = 'arena-props';
            host.setAttribute('aria-label', 'Interactive battlefield ornaments');
            const spots = ['tl', 'tr', 'bl', 'br'];
            host.innerHTML = spots.map((pos, i) => `<button type="button" class="arena-prop prop-${pos}" data-prop-i="${i}" title="Tap to interact"></button>`).join('');
            host.addEventListener('click', e => {
                const btn = e.target.closest && e.target.closest('.arena-prop');
                if (!btn) return;
                const r = btn.getBoundingClientRect();
                const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                const lvl = Math.min(3, (Number(btn.dataset.charge) || 0) + 1);
                btn.dataset.charge = String(lvl);
                btn.classList.remove('prop-fired');
                void btn.offsetWidth;
                btn.classList.add('prop-fired');
                clearTimeout(btn._cool);
                btn._cool = setTimeout(() => { btn.dataset.charge = '0'; btn.classList.remove('prop-fired'); }, 1800);
                spawnInteraction(cx, cy, 1.15 + lvl * 0.35);
            });
            g.insertBefore(host, g.firstChild ? g.firstChild.nextSibling : null);
        }
        const info = arenaMatInfo(currentMat);
        host.querySelectorAll('.arena-prop').forEach(b => {
            if (b.textContent !== info.prop) b.textContent = info.prop;
            b.title = `${info.propName} — click to interact!`;
        });
        return host;
    }

    function applyMatDOM() {
        const g = $('game');
        const next = activeArenaMat();
        const changed = next !== currentMat;
        currentMat = next;
        if (g) g.dataset.mat = currentMat;
        ensureProps();
        const sel = $('matSelect');
        if (sel && sel.value !== arenaMatPref) sel.value = arenaMatPref;
        if (changed && cv && cv.width && cv.height) seed(cv.width, cv.height);
        wake();
    }

    window.setArenaMat = function (key) {
        arenaMatPref = ARENA_MATS.some(m => m.key === key) ? key : 'sanctum';
        store.set('arenaMat', arenaMatPref);
        try { localStorage.setItem('spArenaMat', arenaMatPref); } catch (e) { /* session only */ }
        applyMatDOM();
        if (document.querySelector('#modalHost .looks') && typeof lookPanel === 'function') lookPanel();
        if ($('game') && !$('game').classList.contains('hidden')) {
            spawnInteraction(innerWidth * 0.5, innerHeight * 0.46, 1.35);
        }
    };

    window.arenaMatPulse = function (kind) {
        if (reduced() || isAuto()) return;
        pulseEnergy = Math.min(1.4, pulseEnergy + (kind === 'hit' ? 0.9 : kind === 'turn' ? 0.55 : 0.65));
        if (kind === 'hit') spawnInteraction(innerWidth * 0.5, innerHeight * 0.48, 1.1);
        wake();
    };

    // Click anywhere on empty playmat for satisfying interactive feedback!
    document.addEventListener('pointerdown', e => {
        const g = $('game');
        if (!g || g.classList.contains('hidden') || !g.classList.contains('open-board') || reduced() || isAuto()) return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (!g.contains(e.target)) return;
        // Never fire when clicking any interactive UI, card, button, drawer, or modal
        if (e.target.closest('button, a, input, select, summary, details, .perm, .hc, .stack-item, .pod-chip, .life, .sheet, .modal, .talk-bubble, .act-banner, #uiLabBar')) return;
        spawnInteraction(e.clientX, e.clientY, 1);
    }, { passive: true });

    function matPalette(mat) {
        const cs = getComputedStyle(document.documentElement);
        const gold = cs.getPropertyValue('--gold').trim() || '#e8c25a';
        const brand = cs.getPropertyValue('--brand-light').trim() || '#3aa3d1';
        switch (mat) {
            case 'plains':   return { a: '#ffe79e', b: '#fff6d6', c: '#f2b84b', glow: 'rgba(255, 224, 130, 0.20)' };
            case 'island':   return { a: '#5ce1ff', b: '#9ff0ff', c: '#2986cc', glow: 'rgba(72, 198, 255, 0.22)' };
            case 'swamp':    return { a: '#c07bff', b: '#52e09b', c: '#7d3fb8', glow: 'rgba(164, 92, 232, 0.22)' };
            case 'mountain': return { a: '#ff7b33', b: '#ffd166', c: '#e63928', glow: 'rgba(255, 92, 36, 0.24)' };
            case 'forest':   return { a: '#9ef06c', b: '#ffe875', c: '#2db362', glow: 'rgba(92, 224, 114, 0.20)' };
            default:         return { a: gold,      b: brand,     c: gold,      glow: 'rgba(232, 194, 90, 0.16)' };
        }
    }

    function spawnInteraction(x, y, power = 1) {
        if (reduced() || isAuto()) return;
        const pal = matPalette(currentMat);
        // Expanding themed ring / shockwave
        const ringCount = currentMat === 'island' ? 3 : currentMat === 'sanctum' ? 2 : 1;
        for (let r = 0; r < ringCount; r++) {
            ripples.push({
                x, y, r: 6 + r * 8, maxR: (72 + r * 36) * power,
                life: 1, decay: 1.05 - r * 0.16, col: r % 2 === 0 ? pal.a : pal.b,
                dashed: currentMat === 'sanctum' && r === 1
            });
        }
        flashes.push({ x, y, r: 46 * power, life: 1, col: pal.a });
        // Theme-flavored burst particles
        const count = Math.round((currentMat === 'mountain' ? 18 : currentMat === 'forest' ? 14 : 12) * power);
        for (let i = 0; i < count; i++) {
            const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55;
            const spd = (36 + Math.random() * 88) * power;
            bursts.push({
                x, y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd - (currentMat === 'mountain' || currentMat === 'swamp' ? 38 : 12),
                g: currentMat === 'mountain' ? 120 : currentMat === 'plains' ? -18 : currentMat === 'forest' ? 16 : 24,
                r: 1.6 + Math.random() * 2.6,
                life: 1,
                decay: 0.9 + Math.random() * 0.65,
                col: i % 3 === 0 ? pal.b : pal.a,
                kind: currentMat === 'forest' && i % 3 === 0 ? 'leaf' : currentMat === 'plains' && i % 4 === 0 ? 'feather' : 'dot',
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() - 0.5) * 5
            });
        }
        if (bursts.length > 140) bursts.splice(0, bursts.length - 140);
        if (ripples.length > 24) ripples.splice(0, ripples.length - 24);
        wake();
    }

    function seed(w, h) {
        pts = [];
        const n = currentMat === 'forest' ? 34 : currentMat === 'mountain' ? 36 : currentMat === 'swamp' ? 28 : 30;
        for (let i = 0; i < n; i++) {
            pts.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: currentMat === 'swamp' && i < 8 ? (28 + Math.random() * 44) : (1.2 + Math.random() * 2.6),
                vx: currentMat === 'island' ? (10 + Math.random() * 14) : currentMat === 'plains' ? (6 + Math.random() * 8) : (Math.random() - 0.5) * 14,
                vy: currentMat === 'mountain' ? -(18 + Math.random() * 26)
                  : currentMat === 'plains' ? (7 + Math.random() * 10)
                  : currentMat === 'forest' ? (Math.random() - 0.5) * 12
                  : -(6 + Math.random() * 12),
                ph: Math.random() * Math.PI * 2,
                alt: i % 3 === 0,
                mist: currentMat === 'swamp' && i < 8,
                leaf: currentMat === 'forest' && i < 10
            });
        }
    }

    function drawAmbientBackdrop(w, h, t, pal) {
        const pulse = 1 + pulseEnergy * 0.6;
        if (currentMat === 'plains') {
            // Gently swaying diagonal golden sunbeams
            ctx.save();
            for (let i = 0; i < 4; i++) {
                const bx = w * (0.14 + i * 0.24) + Math.sin(t * 0.00035 + i * 1.3) * 34;
                const grad = ctx.createLinearGradient(bx, 0, bx + 120, h * 0.88);
                grad.addColorStop(0, `rgba(255, 232, 154, ${(0.08 + 0.03 * Math.sin(t * 0.0009 + i)) * pulse})`);
                grad.addColorStop(1, 'rgba(255, 232, 154, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(bx - 38, 0); ctx.lineTo(bx + 44, 0);
                ctx.lineTo(bx + 190, h); ctx.lineTo(bx + 60, h);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        } else if (currentMat === 'island') {
            // Undulating ocean current ribbons & caustic shimmer
            ctx.save();
            ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                const baseY = h * (0.16 + i * 0.17);
                ctx.strokeStyle = i % 2 === 0 ? `rgba(92, 225, 255, ${0.09 * pulse})` : `rgba(159, 240, 255, ${0.06 * pulse})`;
                ctx.beginPath();
                for (let x = 0; x <= w; x += 36) {
                    const y = baseY + Math.sin(x * 0.006 + t * 0.0011 + i * 1.4) * 14 + Math.cos(x * 0.011 - t * 0.0007) * 6;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.restore();
        } else if (currentMat === 'mountain') {
            // Pulsing lava fissures glowing along outer basalt corners
            ctx.save();
            const glowA = (0.12 + 0.06 * Math.sin(t * 0.0018)) * pulse;
            const corners = [[0, h * 0.35], [w, h * 0.35], [0, h * 0.72], [w, h * 0.72]];
            corners.forEach(([cx, cy], i) => {
                const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * 0.26);
                g.addColorStop(0, `rgba(255, 96, 30, ${glowA})`);
                g.addColorStop(0.55, `rgba(220, 42, 18, ${glowA * 0.4})`);
                g.addColorStop(1, 'rgba(220, 42, 18, 0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.26, 0, Math.PI * 2); ctx.fill();
            });
            ctx.restore();
        } else if (currentMat === 'forest') {
            // Dappled emerald canopy light shafts
            ctx.save();
            for (let i = 0; i < 3; i++) {
                const bx = w * (0.2 + i * 0.3) + Math.sin(t * 0.0004 + i * 2) * 26;
                const g = ctx.createLinearGradient(bx, 0, bx + 90, h * 0.85);
                g.addColorStop(0, `rgba(158, 240, 108, ${(0.065 + 0.025 * Math.sin(t * 0.001 + i)) * pulse})`);
                g.addColorStop(1, 'rgba(45, 179, 98, 0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(bx - 30, 0); ctx.lineTo(bx + 36, 0);
                ctx.lineTo(bx + 150, h); ctx.lineTo(bx + 45, h);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
    }

    function tick(t) {
        raf = 0;
        const g = $('game');
        if (!ctx || !g || g.classList.contains('hidden') || !g.classList.contains('open-board') || document.hidden || reduced() || isAuto()) {
            lastT = 0; return;
        }
        const w = innerWidth, h = innerHeight;
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; seed(w, h); }
        const dt = lastT ? Math.min(0.06, (t - lastT) / 1000) : 0.016;
        lastT = t;
        pulseEnergy = Math.max(0, pulseEnergy - dt * 1.4);

        const pal = matPalette(currentMat);
        ctx.clearRect(0, 0, w, h);

        // 1. Living atmospheric background layer
        drawAmbientBackdrop(w, h, t, pal);

        // 2. Ambient particles (embers, fireflies, bog mist, bubbles, feathers)
        for (const p of pts) {
            if (p.mist) {
                p.x += (8 + Math.sin(t * 0.0004 + p.ph) * 6) * dt;
                p.y += Math.cos(t * 0.0005 + p.ph) * 4 * dt;
                if (p.x > w + p.r) p.x = -p.r;
                const mg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 2.2);
                mg.addColorStop(0, p.alt ? 'rgba(82, 224, 155, 0.065)' : 'rgba(164, 92, 232, 0.075)');
                mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = mg;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.fill();
                continue;
            }
            if (currentMat === 'forest' && !p.leaf) {
                // Dancing fireflies with organic drift & warm blink
                p.x += (Math.sin(t * 0.0012 + p.ph * 2) * 18) * dt;
                p.y += (Math.cos(t * 0.0009 + p.ph) * 14) * dt;
            } else {
                p.x += (p.vx + Math.sin(t * 0.0009 + p.ph) * 6) * dt;
                p.y += p.vy * dt;
            }
            if (p.y < -14) { p.y = h + 12; p.x = Math.random() * w; }
            if (p.y > h + 14) { p.y = -12; p.x = Math.random() * w; }
            if (p.x < -14) p.x = w + 12;
            if (p.x > w + 14) p.x = -12;

            const blink = currentMat === 'forest' && !p.leaf
                ? Math.pow(0.5 + 0.5 * Math.sin(t * 0.0026 + p.ph * 3), 2)
                : (0.45 + 0.55 * Math.sin(t * 0.0018 + p.ph));
            const a = (currentMat === 'mountain' ? 0.24 : 0.16) + 0.34 * blink;

            if (p.leaf) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(t * 0.001 + p.ph);
                ctx.globalAlpha = 0.28;
                ctx.fillStyle = p.alt ? pal.b : pal.c;
                ctx.beginPath(); ctx.ellipse(0, 0, p.r * 2.1, p.r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            } else {
                ctx.globalAlpha = a;
                ctx.fillStyle = p.alt ? pal.b : pal.a;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = a * 0.28;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2); ctx.fill();
            }
        }

        // 3. Interactive click flashes
        for (let i = flashes.length - 1; i >= 0; i--) {
            const f = flashes[i];
            f.life -= dt * 2.4;
            if (f.life <= 0) { flashes.splice(i, 1); continue; }
            const fg = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r * (1.3 - f.life * 0.3));
            fg.addColorStop(0, f.col);
            fg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = f.life * 0.32;
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.3, 0, Math.PI * 2); ctx.fill();
        }

        // 4. Interactive expanding ripples / rune rings
        for (let i = ripples.length - 1; i >= 0; i--) {
            const rp = ripples[i];
            rp.life -= dt * rp.decay;
            if (rp.life <= 0) { ripples.splice(i, 1); continue; }
            const prog = 1 - rp.life;
            const rad = rp.r + (rp.maxR - rp.r) * (1 - Math.pow(1 - prog, 2.2));
            ctx.save();
            ctx.globalAlpha = rp.life * 0.65;
            ctx.strokeStyle = rp.col;
            ctx.lineWidth = 1.6 + rp.life * 1.8;
            if (rp.dashed) ctx.setLineDash([6, 6]);
            ctx.beginPath(); ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // 5. Interactive click burst sparks / leaves / feathers
        for (let i = bursts.length - 1; i >= 0; i--) {
            const b = bursts[i];
            b.life -= dt * b.decay;
            if (b.life <= 0) { bursts.splice(i, 1); continue; }
            b.vy += b.g * dt;
            b.vx *= (1 - dt * 1.4);
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.rot += b.vrot * dt;
            ctx.save();
            ctx.globalAlpha = Math.max(0, b.life);
            ctx.fillStyle = b.col;
            if (b.kind === 'leaf' || b.kind === 'feather') {
                ctx.translate(b.x, b.y);
                ctx.rotate(b.rot);
                ctx.beginPath();
                ctx.ellipse(0, 0, b.r * 2.4, b.r * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.4 + b.life * 0.6), 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        raf = requestAnimationFrame(tick);
    }

    function wake() {
        if (!raf && ctx && !reduced() && !isAuto()) raf = requestAnimationFrame(tick);
    }

    window._arenaWakeMotes = function () { applyMatDOM(); wake(); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

    // Load persisted choice on startup
    try {
        const ls = localStorage.getItem('spArenaMat');
        if (ls && ARENA_MATS.some(m => m.key === ls)) arenaMatPref = ls;
    } catch (e) { /* ignore */ }
    applyMatDOM();
})();
