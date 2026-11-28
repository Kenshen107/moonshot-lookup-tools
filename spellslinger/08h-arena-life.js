// =====================================================================
// Living battlefields, part 2 (2026-11-27, owner: "tune the look and add more elements ... elements of them that move and make the
// board feel alive"). A second canvas (#arenaLife, behind the cards, never clickable) draws moving scenery on top of the playmat:
//   - on every mat: flickering lantern flames in the four painted corners, a rune chase along the stone border, and a light that
//     travels around the gold circles (all tinted by the mat's colors, so the same painted picture feels different per plane)
//   - Sanctum: rising glyphs and twinkling gold dust
//   - Radiant Citadel: drifting cloud shadows, a bird that crosses now and then, glinting motes
//   - Astral Tidepool: fish, a jellyfish, wandering caustic light
//   - Shadowed Crypt: wandering wisps with trails, bubbling mist rings
//   - Volcanic Caldera: pulsing lava cracks, drifting ash, an occasional fireball arc
//   - Whispering Wildwood: swaying vines, butterflies
// Draws at about 30 frames a second, stops when the table is hidden, the tab is in the background, reduced motion is on, or in
// autoplay / the lab / tests. Colors are fixed per mat (they copy the painted lanterns and runes), everything else is drawn in code.
// =====================================================================
'use strict';
(function initArenaLife() {
    const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isAuto = () => !window.__LIFE_FORCE && ((typeof AUTOPLAY !== 'undefined' && AUTOPLAY) || !!window.__TEST || !!window.__LAB);
    const game = () => document.getElementById('game');
    const host = game();
    if (!host) return;
    let cv = document.getElementById('arenaLife');
    if (!cv) {
        cv = document.createElement('canvas');
        cv.id = 'arenaLife'; cv.className = 'arena-life'; cv.setAttribute('aria-hidden', 'true');
        const motes = document.getElementById('arenaMotes');
        if (motes && motes.parentNode === host) motes.insertAdjacentElement('afterend', cv); else host.insertBefore(cv, host.firstChild);
    }
    const ctx = cv.getContext ? cv.getContext('2d') : null;
    if (!ctx) return;

    // The painted mat is 1376 x 768 and drawn "cover, center"; these are positions of its features in that picture.
    // The wide picture (desktop): mats/<mat>/base.jpg, 1920 x 1080, the same layout as the first 1376 x 768 painting, so these numbers still fit.
    const WIDE = { w: 1376, h: 768, lanterns: [[103, 80], [1262, 84], [103, 686], [1262, 682]],
        runes: [[368, 57, 0, 150], [1005, 57, 0, 150], [350, 713, 0, 150], [1008, 713, 0, 150],
                [88, 270, 1, 130], [88, 495, 1, 130], [1300, 270, 1, 130], [1300, 495, 1, 130]],
        circles: [[688, 383, 203], [688, 383, 349]] };
    // The tall picture (base-phone.jpg, 1080 x 1920) used on portrait screens (styles.css, same media test): no runes, corner ornaments, one big circle.
    const TALL = { w: 1080, h: 1920, lanterns: [[70, 90], [1010, 90], [70, 1830], [1010, 1830]], runes: [], circles: [[540, 962, 480], [540, 962, 506]] };
    let IMG_W = WIDE.w, IMG_H = WIDE.h, LANTERNS = WIDE.lanterns, RUNES = WIDE.runes, CIRCLES = WIDE.circles;
    const tallMq = window.matchMedia ? matchMedia('(max-aspect-ratio: 10/13)') : null;
    const TINT = {
        sanctum:  { flame: [255, 168, 72],  core: [255, 232, 170], rune: [90, 232, 224],  sweep: [240, 200, 100] },
        plains:   { flame: [255, 226, 140], core: [255, 250, 220], rune: [255, 224, 130], sweep: [255, 236, 170] },
        island:   { flame: [96, 214, 255],  core: [200, 246, 255], rune: [92, 225, 255],  sweep: [130, 230, 255] },
        swamp:    { flame: [170, 110, 255], core: [190, 255, 220], rune: [82, 224, 155],  sweep: [160, 100, 235] },
        mountain: { flame: [255, 96, 36],   core: [255, 214, 120], rune: [255, 150, 60],  sweep: [255, 120, 50] },
        forest:   { flame: [160, 236, 100], core: [255, 244, 160], rune: [120, 240, 150], sweep: [190, 240, 110] }
    };
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

    let W = 0, H = 0, S = 1, OX = 0, OY = 0, raf = 0, timer = 0, lastDraw = 0, flare = 0;
    const st = { mat: '', birds: [], nextBird: 0, fish: [], jelly: null, wisps: [], bubbles: [], ash: [], cracks: [], fireballs: [], nextFire: 0,
                 vines: [], flies: [], glyphs: [], dust: [], clouds: [] };

    const ix = x => OX + x * S, iy = y => OY + y * S;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const flick = (t, i) => 0.62 + 0.18 * Math.sin(t * 0.011 + i * 2.1) + 0.12 * Math.sin(t * 0.027 + i * 5.3) + 0.08 * Math.sin(t * 0.061 + i);

    function layout() {
        const w = innerWidth, h = innerHeight;
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        W = w; H = h;
        const g = tallMq && tallMq.matches ? TALL : WIDE;
        IMG_W = g.w; IMG_H = g.h; LANTERNS = g.lanterns; RUNES = g.runes; CIRCLES = g.circles;
        S = Math.max(W / IMG_W, H / IMG_H);
        OX = (W - IMG_W * S) / 2; OY = (H - IMG_H * S) / 2;
    }

    function seed(mat) {
        st.mat = mat;
        st.birds = []; st.fish = []; st.wisps = []; st.bubbles = []; st.ash = []; st.cracks = []; st.fireballs = [];
        st.vines = []; st.flies = []; st.glyphs = []; st.dust = []; st.clouds = []; st.jelly = null;
        st.nextBird = performance.now() + rnd(4000, 9000); st.nextFire = performance.now() + rnd(5000, 9000);
        if (mat === 'plains') for (let i = 0; i < 4; i++) st.clouds.push({ x: rnd(0, W), y: rnd(0.15, 0.85) * H, r: rnd(160, 300), v: rnd(5, 11) });
        if (mat === 'island') {
            for (let i = 0; i < 5; i++) st.fish.push({ x: rnd(0, W), y: rnd(0.2, 0.85) * H, v: rnd(16, 34) * (i % 2 ? 1 : -1), s: rnd(9, 17), ph: rnd(0, 6.3), amp: rnd(14, 34) });
            st.jelly = { x: rnd(0.2, 0.8) * W, y: rnd(0.3, 0.7) * H, ph: 0, vx: rnd(-8, 8) };
        }
        if (mat === 'swamp') {
            for (let i = 0; i < 6; i++) st.wisps.push({ x: rnd(0, W), y: rnd(0, H), a: rnd(0, 6.3), sp: rnd(18, 36), tr: [], hue: i % 2 });
        }
        if (mat === 'mountain') {
            [[0.0, 0.3, 1], [0.0, 0.74, 1], [1.0, 0.3, -1], [1.0, 0.74, -1]].forEach(([fx, fy, dir], k) => {
                let x = fx * W, y = fy * H; const pts = [[x, y]];
                for (let i = 0; i < 9; i++) { x += dir * rnd(5, 13); y += rnd(-24, 24); pts.push([x, y]); }
                st.cracks.push({ pts, ph: k * 1.3 });
            });
            for (let i = 0; i < 26; i++) st.ash.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(8, 22), sw: rnd(0, 6.3), r: rnd(1, 2.4) });
        }
        if (mat === 'forest') {
            for (let i = 0; i < 6; i++) st.vines.push({ x: (i < 3 ? 0.03 + i * 0.045 : 0.97 - (i - 3) * 0.045) * W, len: rnd(0.18, 0.34) * H, ph: rnd(0, 6.3), leaves: Math.round(rnd(4, 7)) });
            for (let i = 0; i < 4; i++) st.flies.push({ x: rnd(0, W), y: rnd(0.15, 0.85) * H, a: rnd(0, 6.3), sp: rnd(22, 40), flap: rnd(0, 6.3), hue: i % 2 });
        }
        if (mat === 'sanctum') {
            for (let i = 0; i < 34; i++) st.dust.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(4, 12), ph: rnd(0, 6.3), r: rnd(0.8, 2) });
        }
    }

    // ---------------- layers every mat shares (positions come from the painted picture) ----------------
    function lanterns(t, tint) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        LANTERNS.forEach(([x, y], i) => {
            const f = flick(t, i) + flare * 0.5, cx = ix(x), cy = iy(y), r = 64 * S * (0.9 + f * 0.35);
            let g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
            g.addColorStop(0, rgba(tint.core, 0.55 * f)); g.addColorStop(0.35, rgba(tint.flame, 0.28 * f)); g.addColorStop(1, rgba(tint.flame, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
            // light spilling onto the stone
            const R = 240 * S * (0.9 + f * 0.2);
            g = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
            g.addColorStop(0, rgba(tint.flame, 0.09 * f)); g.addColorStop(1, rgba(tint.flame, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
            // a flame tongue that leans and jumps
            ctx.fillStyle = rgba(tint.core, 0.3 * f);
            ctx.beginPath(); ctx.ellipse(cx + Math.sin(t * 0.009 + i) * 2 * S, cy - 4 * S, 5 * S, 11 * S * f, Math.sin(t * 0.007 + i * 3) * 0.25, 0, 7); ctx.fill();
        });
        ctx.restore();
    }
    function runes(t, tint) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        RUNES.forEach(([x, y, vert, len], i) => {
            // a bright wave that chases clockwise around the border
            const wave = Math.pow(0.5 + 0.5 * Math.sin(t * 0.0011 - i * 0.8), 3);
            const a = 0.1 + 0.5 * wave + flare * 0.2;
            ctx.save(); ctx.translate(ix(x), iy(y)); if (vert) ctx.rotate(Math.PI / 2);
            const g = ctx.createRadialGradient(0, 0, 1, 0, 0, len * 0.55 * S);
            g.addColorStop(0, rgba(tint.rune, a)); g.addColorStop(1, rgba(tint.rune, 0));
            ctx.fillStyle = g; ctx.scale(1, 0.22); ctx.beginPath(); ctx.arc(0, 0, len * 0.55 * S, 0, 7); ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }
    function circles(t, tint) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        CIRCLES.forEach(([x, y, r], k) => {
            const a0 = t * (k ? -0.00022 : 0.00031) + k * 2, cx = ix(x), cy = iy(y), rad = r * S;
            for (let s = 0; s < 6; s++) {
                ctx.strokeStyle = rgba(tint.sweep, (0.5 - s * 0.075) * (0.55 + flare * 0.3));
                ctx.lineWidth = (2.4 - s * 0.25) * S;
                const sgn = k ? -1 : 1;
                ctx.beginPath(); ctx.arc(cx, cy, rad, a0 - sgn * s * 0.09, a0 - sgn * (s + 1) * 0.09, k === 1); ctx.stroke();
            }
        });
        ctx.restore();
    }

    // ---------------- per mat actors ----------------
    function sanctum(t, dt, tint) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const d of st.dust) {
            d.y -= d.v * dt; d.x += Math.sin(t * 0.0006 + d.ph) * 6 * dt;
            if (d.y < -6) { d.y = H + 6; d.x = rnd(0, W); }
            const tw = Math.pow(0.5 + 0.5 * Math.sin(t * 0.003 + d.ph * 3), 4);
            ctx.fillStyle = rgba(tint.core, 0.12 + 0.55 * tw);
            const s = d.r * (1 + tw);
            ctx.fillRect(d.x - s * 0.15, d.y - s, s * 0.3, s * 2); ctx.fillRect(d.x - s, d.y - s * 0.15, s * 2, s * 0.3); // a four-point twinkle
        }
        // a glyph drifts up now and then, glows, and fades
        if (Math.random() < dt * 0.45 && st.glyphs.length < 7) st.glyphs.push({ x: rnd(0.12, 0.88) * W, y: rnd(0.55, 0.95) * H, life: 0, ch: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗ'[Math.floor(Math.random() * 20)] });
        ctx.font = `${Math.round(22 * S)}px serif`; ctx.textAlign = 'center';
        for (let i = st.glyphs.length - 1; i >= 0; i--) {
            const g = st.glyphs[i]; g.life += dt / 5; g.y -= 16 * dt;
            if (g.life >= 1) { st.glyphs.splice(i, 1); continue; }
            ctx.fillStyle = rgba(tint.rune, Math.sin(g.life * Math.PI) * 0.45);
            ctx.fillText(g.ch, g.x, g.y);
        }
        ctx.restore();
    }
    function plains(t, dt, tint, now) {
        // slow cloud shadows
        ctx.save();
        for (const c of st.clouds) {
            c.x += c.v * dt; if (c.x - c.r > W) { c.x = -c.r; c.y = rnd(0.1, 0.9) * H; }
            const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.r);
            g.addColorStop(0, 'rgba(10,10,20,0.14)'); g.addColorStop(1, 'rgba(10,10,20,0)');
            ctx.fillStyle = g; ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1.7, 0.7); ctx.translate(-c.x, -c.y); ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill(); ctx.restore();
        }
        ctx.restore();
        // a bird crosses the sky
        if (now > st.nextBird && st.birds.length < 2) { st.birds.push({ x: -30, y: rnd(0.12, 0.35) * H, v: rnd(70, 110), ph: 0, s: rnd(0.9, 1.4) }); st.nextBird = now + rnd(16000, 32000); }
        ctx.save(); ctx.strokeStyle = 'rgba(30,26,20,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = st.birds.length - 1; i >= 0; i--) {
            const b = st.birds[i]; b.x += b.v * dt; b.ph += dt * 7; b.y += Math.sin(b.ph * 0.35) * 8 * dt;
            if (b.x > W + 40) { st.birds.splice(i, 1); continue; }
            const w = (7 + Math.sin(b.ph) * 5) * b.s, up = Math.sin(b.ph) * 6 * b.s;
            ctx.beginPath(); ctx.moveTo(b.x - 12 * b.s, b.y - up); ctx.quadraticCurveTo(b.x - 5 * b.s, b.y - w, b.x, b.y); ctx.quadraticCurveTo(b.x + 5 * b.s, b.y - w, b.x + 12 * b.s, b.y - up); ctx.stroke();
        }
        ctx.restore();
        // glints on the stone
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
            const k = (t * 0.00018 + i / 6) % 1, x = (0.1 + 0.8 * ((i * 0.37) % 1)) * W, y = (0.15 + 0.7 * ((i * 0.61) % 1)) * H, a = Math.pow(Math.sin(k * Math.PI), 6);
            ctx.fillStyle = rgba(tint.core, a * 0.6); const s = 6 + a * 8;
            ctx.fillRect(x - s * 0.1, y - s, s * 0.2, s * 2); ctx.fillRect(x - s, y - s * 0.1, s * 2, s * 0.2);
        }
        ctx.restore();
    }
    function island(t, dt, tint) {
        // wandering caustic light
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 7; i++) {
            ctx.strokeStyle = rgba([150, 235, 255], 0.045);
            ctx.beginPath();
            for (let x = 0; x <= W; x += 28) {
                const y = H * (0.1 + i * 0.13) + Math.sin(x * 0.008 + t * 0.0009 + i) * 18 + Math.sin(x * 0.019 - t * 0.0014 + i * 2) * 8;
                if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
        // fish
        ctx.save();
        for (const f of st.fish) {
            f.x += f.v * dt; f.ph += dt * 3;
            if (f.v > 0 && f.x > W + 40) { f.x = -40; f.y = rnd(0.2, 0.85) * H; }
            if (f.v < 0 && f.x < -40) { f.x = W + 40; f.y = rnd(0.2, 0.85) * H; }
            const y = f.y + Math.sin(f.ph + f.x * 0.01) * f.amp * 0.4, dir = f.v > 0 ? 1 : -1, tail = Math.sin(f.ph * 3) * f.s * 0.4;
            ctx.save(); ctx.translate(f.x, y); ctx.scale(dir, 1);
            ctx.fillStyle = 'rgba(120,226,255,0.22)';
            ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.42, 0, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-f.s * 0.8, 0); ctx.lineTo(-f.s * 1.7, -f.s * 0.5 + tail); ctx.lineTo(-f.s * 1.7, f.s * 0.5 + tail); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(220,250,255,0.4)'; ctx.beginPath(); ctx.arc(f.s * 0.55, -f.s * 0.1, f.s * 0.1, 0, 7); ctx.fill();
            ctx.restore();
        }
        // a jellyfish pulses upward and sinks
        const j = st.jelly;
        if (j) {
            j.ph += dt * 1.6; j.x += j.vx * dt; j.y += (-Math.cos(j.ph) * 14 + 3) * dt;
            if (j.x < 40 || j.x > W - 40) j.vx = -j.vx; if (j.y < 60) j.y = H - 60; if (j.y > H - 40) j.y = 60;
            const sq = 1 + Math.sin(j.ph) * 0.18;
            ctx.save(); ctx.translate(j.x, j.y);
            ctx.fillStyle = 'rgba(150,236,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, 0, 18 * sq, 13 / sq, 0, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = 'rgba(180,244,255,0.22)'; ctx.lineWidth = 1.5;
            for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 6, 0); for (let n = 1; n <= 5; n++) ctx.lineTo(k * 6 + Math.sin(j.ph + n + k) * 4, n * 7); ctx.stroke(); }
            ctx.restore();
        }
        ctx.restore();
    }
    function swamp(t, dt, tint) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const w of st.wisps) {
            w.a += Math.sin(t * 0.0007 + w.sp) * dt * 1.4; w.x += Math.cos(w.a) * w.sp * dt; w.y += Math.sin(w.a) * w.sp * dt * 0.8;
            if (w.x < -20) w.x = W + 20; if (w.x > W + 20) w.x = -20; if (w.y < -20) w.y = H + 20; if (w.y > H + 20) w.y = -20;
            w.tr.push([w.x, w.y]); if (w.tr.length > 18) w.tr.shift();
            const col = w.hue ? [100, 255, 180] : [190, 130, 255];
            for (let i = 0; i < w.tr.length; i++) { const a = i / w.tr.length; ctx.fillStyle = rgba(col, a * 0.18); ctx.beginPath(); ctx.arc(w.tr[i][0], w.tr[i][1], 1 + a * 3, 0, 7); ctx.fill(); }
            const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 16); g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, 16, 0, 7); ctx.fill();
        }
        if (Math.random() < dt * 0.9 && st.bubbles.length < 8) st.bubbles.push({ x: rnd(0.1, 0.9) * W, y: rnd(0.3, 0.95) * H, life: 0 });
        for (let i = st.bubbles.length - 1; i >= 0; i--) {
            const b = st.bubbles[i]; b.life += dt / 1.8; if (b.life >= 1) { st.bubbles.splice(i, 1); continue; }
            ctx.strokeStyle = rgba([120, 255, 190], (1 - b.life) * 0.35); ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(b.x, b.y, 3 + b.life * 16, 0, 7); ctx.stroke();
        }
        ctx.restore();
    }
    function mountain(t, dt, tint, now) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
        for (const c of st.cracks) {
            const a = 0.16 + 0.34 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.0016 + c.ph), 2) + flare * 0.2;
            ctx.strokeStyle = rgba([255, 120, 40], a); ctx.lineWidth = 3;
            ctx.beginPath(); c.pts.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
            ctx.strokeStyle = rgba([255, 220, 140], a * 0.7); ctx.lineWidth = 1;
            ctx.beginPath(); c.pts.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
        }
        for (const p of st.ash) {
            p.y -= p.v * dt * 0.6; p.x += Math.sin(t * 0.0007 + p.sw) * 9 * dt;
            if (p.y < -6) { p.y = H + 6; p.x = rnd(0, W); }
            ctx.fillStyle = rgba([255, 150, 70], 0.2 + 0.3 * Math.sin(t * 0.002 + p.sw) ** 2); ctx.fillRect(p.x, p.y, p.r, p.r);
        }
        if (now > st.nextFire && st.fireballs.length < 2) {
            const left = Math.random() < 0.5, x0 = left ? 0.04 * W : 0.96 * W;
            st.fireballs.push({ x: x0, y: 0.96 * H, vx: (left ? 1 : -1) * rnd(80, 140), vy: -rnd(260, 360), life: 0, tr: [] });
            st.nextFire = now + rnd(11000, 20000);
        }
        for (let i = st.fireballs.length - 1; i >= 0; i--) {
            const f = st.fireballs[i]; f.vy += 300 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.life += dt;
            f.tr.push([f.x, f.y]); if (f.tr.length > 16) f.tr.shift();
            if (f.y > H + 20 && f.life > 0.5) { st.fireballs.splice(i, 1); continue; }
            for (let k = 0; k < f.tr.length; k++) { const a = k / f.tr.length; ctx.fillStyle = rgba([255, 110, 40], a * 0.3); ctx.beginPath(); ctx.arc(f.tr[k][0], f.tr[k][1], 2 + a * 5, 0, 7); ctx.fill(); }
            const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 18); g.addColorStop(0, 'rgba(255,230,150,0.8)'); g.addColorStop(1, 'rgba(255,90,30,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 18, 0, 7); ctx.fill();
        }
        ctx.restore();
    }
    function forest(t, dt, tint) {
        ctx.save(); ctx.lineCap = 'round';
        for (const v of st.vines) {
            const sw = Math.sin(t * 0.0008 + v.ph) * 16, sw2 = Math.sin(t * 0.0011 + v.ph * 2) * 9;
            ctx.strokeStyle = 'rgba(40,110,60,0.5)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(v.x, -4); ctx.bezierCurveTo(v.x + sw, v.len * 0.35, v.x - sw2, v.len * 0.7, v.x + sw * 0.6, v.len); ctx.stroke();
            for (let k = 1; k <= v.leaves; k++) {
                const u = k / (v.leaves + 1), px = v.x + sw * u * (1 - u) * 2.2 + (u > 0.6 ? sw * 0.3 : 0), py = v.len * u;
                ctx.save(); ctx.translate(px, py); ctx.rotate((k % 2 ? 1 : -1) * (0.7 + Math.sin(t * 0.0012 + k + v.ph) * 0.25));
                ctx.fillStyle = k % 2 ? 'rgba(90,190,100,0.5)' : 'rgba(60,160,90,0.5)';
                ctx.beginPath(); ctx.ellipse(8, 0, 9, 3.6, 0, 0, 7); ctx.fill(); ctx.restore();
            }
        }
        for (const b of st.flies) {
            b.a += Math.sin(t * 0.0009 + b.sp) * dt * 2; b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt * 0.7 - 4 * dt; b.flap += dt * 14;
            if (b.x < -20) b.x = W + 20; if (b.x > W + 20) b.x = -20; if (b.y < -20) b.y = H + 20; if (b.y > H + 20) b.y = -20;
            const sp = Math.abs(Math.sin(b.flap)), col = b.hue ? [255, 220, 90] : [150, 220, 255];
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a + Math.PI / 2); ctx.fillStyle = rgba(col, 0.55);
            ctx.beginPath(); ctx.ellipse(-4 * sp - 1, 0, 4 * sp + 0.6, 6, -0.3, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4 * sp + 1, 0, 4 * sp + 0.6, 6, 0.3, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(30,24,16,0.7)'; ctx.fillRect(-0.6, -4, 1.2, 8); ctx.restore();
        }
        ctx.restore();
    }
    const ACTORS = { sanctum, plains, island, swamp, mountain, forest };

    function frame(t) {
        raf = 0;
        const g = game();
        const on = ctx && g && !g.classList.contains('hidden') && g.classList.contains('open-board') && !document.hidden && !reduced() && !isAuto();
        if (!on) { lastDraw = 0; timer = setTimeout(() => { timer = 0; wake(); }, 600); return; }
        if (t - lastDraw < 30) { raf = requestAnimationFrame(frame); return; }
        const dt = lastDraw ? Math.min(0.08, (t - lastDraw) / 1000) : 0.03;
        lastDraw = t;
        layout();
        const mat = g.dataset.mat || 'sanctum';
        if (st.mat !== mat || !st.clouds) seed(mat);
        flare = Math.max(0, flare - dt * 1.6);
        ctx.clearRect(0, 0, W, H);
        const tint = TINT[mat] || TINT.sanctum;
        lanterns(t, tint);
        if (mat === 'sanctum') { runes(t, tint); circles(t, tint); } // only the Sanctum picture has runes and gold circles to light up
        (ACTORS[mat] || sanctum)(t, dt, tint, performance.now());
        raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && !timer && ctx) raf = requestAnimationFrame(frame); }

    // hits, healing and turn changes flare the lanterns and runes (08g calls arenaMatPulse)
    const basePulse = window.arenaMatPulse;
    window.arenaMatPulse = function (kind) { flare = Math.min(1.4, flare + (kind === 'hit' ? 1 : 0.6)); wake(); if (basePulse) return basePulse.apply(this, arguments); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    const baseWake = window._arenaWakeMotes;
    window._arenaWakeMotes = function () { if (baseWake) baseWake.apply(this, arguments); wake(); };
    wake();
})();
