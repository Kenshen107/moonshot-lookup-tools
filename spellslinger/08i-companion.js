// Table companions (2026-11-27, Batch 1 of docs/spellslinger-asset-plan.md). Antigravity paints a creature as still parts (body, head,
// tail, wing... each on its own 512 x 512 canvas); this file puts them together as a puppet and moves them: breathing, a wagging tail,
// flapping wings, a head that follows the pointer, and reactions to the game (it perks up when you cast, cheers when an opponent loses
// life, flinches when you do, is happy when you gain life or pet it, naps after a quiet minute, celebrates a win and droops in a loss).
// The puppet sits in the bottom-left corner of the table, never over cards, and is off in autoplay, the lab and for reduced motion
// (a still pose there). Which companion: cosState().companion (04j-cosmetics.js). A rig places each part in a stage of w x h units:
// x, y = where the part's top-left goes, s = its size, px / py = its pivot (the joint it turns around) in the part's own 512 pixels.
const COMPANION_RIGS = {
    'ember-drake': {
        dir: 'spellslinger/art/companions/ember-drake/', w: 440, h: 430,
        parts: [
            { k: 'wingB', src: 'wing.png', x: 44, y: 98, s: 200, px: 22, py: 255, flip: true, dim: 0.7, r0: 22 },
            { k: 'wingF', src: 'wing.png', x: 248, y: 98, s: 200, px: 22, py: 255, r0: -22 },
            { k: 'tail', src: 'tail.png', x: 22, y: 222, s: 200, px: 32, py: 60, flip: true },
            { k: 'body', src: 'body.png', x: 110, y: 150, s: 250, px: 256, py: 500 },
            { k: 'head', src: 'head.png', x: 186, y: 4, s: 196, px: 256, py: 470 }
        ],
        ember: { part: 'tail', x: 462, y: 64 }, // the tail's flame tip, in the tail's own 512 pixels (before the flip)
        glow: { part: 'tail', x: 450, y: 120 }, // the middle of the tail's flame, where the flicker glow sits
        mouth: { part: 'head', x: 352, y: 392 }, // where fire breath comes out, in the head's own 512 pixels
        faces: ['happy', 'angry', 'scared', 'sleepy', 'cheer', 'blink'] // optional face-<name>.png head variants (used when the files exist)
    }
};
const COMP = { live: [], raf: 0, last: 0, dock: null, ctl: null, seen: null, idleSince: 0, mx: null, my: null };
const compReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

// Build a puppet inside host. Returns a controller { el, react(kind), state, destroy() }.
function compMount(host, id, opts = {}) {
    const rig = COMPANION_RIGS[id]; if (!rig || !host) return null;
    const stage = document.createElement('div');
    stage.className = 'comp-stage'; stage.dataset.comp = id;
    stage.style.setProperty('--cw', rig.w); stage.style.setProperty('--ch', rig.h);
    const inner = document.createElement('div'); inner.className = 'comp-inner';
    inner.style.width = `${rig.w}px`; inner.style.height = `${rig.h}px`;
    const els = {};
    rig.parts.forEach(p => {
        const box = document.createElement('div'), im = document.createElement('img');
        box.className = `comp-part comp-${p.k}`;
        im.src = rig.dir + p.src; im.alt = ''; im.draggable = false;
        if (p.flip) im.style.transform = 'scaleX(-1)'; // mirrored inside its box, so the box's pivot stays where the joint is drawn
        const sc = p.s / 512;
        Object.assign(box.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.s}px`, height: `${p.s}px`,
            transformOrigin: `${(p.flip ? 512 - p.px : p.px) * sc}px ${p.py * sc}px` });
        if (p.dim) im.style.filter = `brightness(${p.dim})`;
        im.addEventListener('error', () => { stage.classList.add('comp-missing'); });
        box.appendChild(im); inner.appendChild(box); els[p.k] = box;
        if (rig.glow && rig.glow.part === p.k) { // a flickering glow on the tail's flame, moving with the tail
            const g = document.createElement('span'); g.className = 'comp-flame';
            g.style.left = `${(p.flip ? 512 - rig.glow.x : rig.glow.x) * sc}px`; g.style.top = `${rig.glow.y * sc}px`;
            box.appendChild(g);
        }
    });
    const faces = {}, headImg = els.head && els.head.querySelector('img');
    (rig.faces || []).forEach(f => { const t = new Image(); t.onload = () => { faces[f] = t.src; }; t.src = `${rig.dir}face-${f}.png`; });
    stage.appendChild(inner); host.appendChild(stage);
    const ctl = { id, rig, el: stage, inner, els, faces, headImg, headSrc: headImg && headImg.src, face: '', preview: !!opts.preview, t0: performance.now(), act: null, idle: null, mood: null,
        nextIdle: performance.now() + 3500 + Math.random() * 4000, nextEmber: 0, nextZ: 0, nextBlink: performance.now() + 2500,
        react(kind, ms) { if (compReduced()) return; this.act = { kind, t0: performance.now(), ms: ms || COMP_REACT_MS[kind] || 1000 }; this.idle = null; if (kind === 'happy' || kind === 'cheer' || kind === 'win') compSparks(this, kind); if (kind === 'cheer' || kind === 'win') compBreath(this, true); },
        destroy() { stage.remove(); COMP.live = COMP.live.filter(c => c !== this); } };
    const fit = () => { const w = stage.clientWidth || host.clientWidth || 120; inner.style.transform = `scale(${w / rig.w})`; };
    ctl.fit = fit; fit();
    stage.addEventListener('pointerdown', e => { e.stopPropagation(); ctl.react('happy'); COMP.idleSince = performance.now(); });
    stage.addEventListener('pointerenter', () => { if (!ctl.act) ctl.react('perk', 700); });
    COMP.live.push(ctl); compKick();
    return ctl;
}
const COMP_REACT_MS = { perk: 900, cheer: 1300, hurt: 800, happy: 1100, win: 1e9, lose: 1e9 };

// One pose per frame: idle breathing plus the current reaction
function compPose(ctl, now) {
    const t = (now - ctl.t0) / 1000, still = compReduced();
    const P = { body: { tx: 0, ty: 0, r: 0, sx: 1, sy: 1 }, head: { tx: 0, ty: 0, r: 0 }, tail: { r: 0 }, wingF: { r: 0 }, wingB: { r: 0 }, all: { tx: 0, ty: 0, r: 0, s: 1 } };
    if (!still) {
        const br = Math.sin(t * 2.1);
        P.body.sy = 1 + br * 0.012; P.body.sx = 1 - br * 0.006;
        P.head.ty = br * 3; P.head.r = Math.sin(t * 0.9) * 2.5;
        P.tail.r = Math.sin(t * 1.6) * 6;
        P.wingF.r = Math.sin(t * 1.25) * 4; P.wingB.r = -Math.sin(t * 1.25 + 0.4) * 4;
        // look toward the pointer (game only)
        if (!ctl.preview && COMP.mx != null) {
            const b = ctl.el.getBoundingClientRect(), cx = b.left + b.width * 0.6, cy = b.top + b.height * 0.25;
            P.head.r += Math.max(-10, Math.min(10, (COMP.mx - cx) / 60));
            P.head.ty += Math.max(-4, Math.min(4, (COMP.my - cy) / 120));
        }
        const sleepy = !ctl.preview && COMP.idleSince && now - COMP.idleSince > 60000 && !ctl.act;
        if (sleepy) { P.head.r += 12; P.head.ty += 14; P.wingF.r -= 10; P.wingB.r += 10; P.body.sy = 1 + br * 0.02; ctl.el.classList.add('sleepy'); } else ctl.el.classList.remove('sleepy');
        ctl.sleepy = sleepy;
        if (sleepy && now > ctl.nextZ) { ctl.nextZ = now + 1500; compFloat(ctl, 'z'); }
        // the tail flame sheds an ember now and then
        if (!sleepy && now > ctl.nextEmber) { ctl.nextEmber = now + 900 + Math.random() * 1200; compSparks(ctl, 'ember'); }
        // an idle habit every so often, so it doesn't just sway
        if (!ctl.act && !ctl.idle && !sleepy && now > ctl.nextIdle) {
            const kinds = ['stretch', 'look', 'wag', 'flap', 'puff', 'look', 'wag'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            ctl.idle = { kind, t0: now, ms: COMP_IDLE_MS[kind] };
            ctl.nextIdle = now + 7000 + Math.random() * 7000;
            if (kind === 'puff') compBreath(ctl, false);
        }
        const d = ctl.idle;
        if (d) {
            const e = (now - d.t0) / d.ms, w = Math.sin(Math.PI * Math.min(1, e)), u = now / 1000;
            if (e > 1) ctl.idle = null;
            else if (d.kind === 'stretch') { P.wingF.r -= 26 * w; P.wingB.r += 26 * w; P.head.r -= 10 * w; P.head.ty -= 8 * w; P.body.sy += 0.04 * w; P.tail.r += 10 * w; }
            else if (d.kind === 'look') { P.head.r += 14 * Math.sin(e * Math.PI * 2) * w; P.head.tx += 6 * Math.sin(e * Math.PI * 2); }
            else if (d.kind === 'wag') { P.tail.r += 16 * Math.sin(u * 18) * w; }
            else if (d.kind === 'flap') { P.wingF.r -= 22 * Math.abs(Math.sin(u * 16)) * w + 6 * w; P.wingB.r += 22 * Math.abs(Math.sin(u * 16)) * w + 6 * w; P.all = { ...P.all, ty: -10 * w }; }
            else if (d.kind === 'puff') { P.head.r -= 6 * w; P.head.tx += 3 * w; }
        }
        // blink (only with a face-blink.png drawing)
        if (ctl.faces.blink && now > ctl.nextBlink) { ctl.blinkUntil = now + 140; ctl.nextBlink = now + 2500 + Math.random() * 4000; }
    }
    const a = ctl.act;
    if (a) {
        const e = (now - a.t0) / a.ms, k = Math.max(0, 1 - e), u = now / 1000;
        if (e > 1) ctl.act = null;
        else if (a.kind === 'perk') { P.head.r -= 8 * Math.sin(Math.PI * e); P.head.ty -= 10 * Math.sin(Math.PI * e); P.wingF.r -= 16 * Math.sin(Math.PI * e); P.wingB.r += 16 * Math.sin(Math.PI * e); }
        else if (a.kind === 'cheer' || a.kind === 'win') {
            const hop = Math.abs(Math.sin(u * 9)); const amp = a.kind === 'win' ? 1 : k;
            P.all.ty = -26 * hop * amp; P.wingF.r = -30 * Math.sin(u * 22) * amp - 10; P.wingB.r = 30 * Math.sin(u * 22) * amp + 10; P.tail.r += 14 * Math.sin(u * 14) * amp; P.head.r -= 6 * amp;
            if (a.kind === 'win' && Math.random() < 0.04) compSparks(ctl, 'cheer');
        }
        else if (a.kind === 'hurt') { P.all.tx = Math.sin(u * 60) * 10 * k; P.body.sy -= 0.06 * k; P.head.r += 14 * k; P.head.ty += 10 * k; P.wingF.r += 14 * k; P.wingB.r -= 14 * k; ctl.el.classList.toggle('hurt', k > 0.35); }
        else if (a.kind === 'happy') { const hop = Math.abs(Math.sin(Math.PI * e * 2)); P.all.ty = -16 * hop; P.head.r += 10 * Math.sin(Math.PI * e * 2); P.tail.r += 18 * Math.sin(u * 16) * k; }
        else if (a.kind === 'lose') { P.head.r += 16; P.head.ty += 18; P.wingF.r += 22; P.wingB.r -= 22; P.tail.r = P.tail.r * 0.3 - 8; P.all.ty = 4; ctl.el.classList.add('down'); }
        if (a.kind !== 'hurt') ctl.el.classList.remove('hurt');
    } else ctl.el.classList.remove('hurt', 'down');
    const tf = (o, r0 = 0) => `translate(${(o.tx || 0).toFixed(1)}px, ${(o.ty || 0).toFixed(1)}px) rotate(${((o.r || 0) + r0).toFixed(2)}deg)`;
    ctl.rig.parts.forEach(p => {
        const el = ctl.els[p.k], o = P[p.k] || {};
        el.style.transform = p.k === 'body' ? `${tf(o, p.r0 || 0)} scale(${o.sx.toFixed(4)}, ${o.sy.toFixed(4)})` : tf(o, p.r0 || 0);
    });
    ctl.inner.style.translate = `${P.all.tx.toFixed(1)}px ${P.all.ty.toFixed(1)}px`;
    // face drawings, when the art has them
    const ak = a && a.kind, F = ctl.faces;
    let face = ak === 'cheer' || ak === 'win' ? (F.cheer ? 'cheer' : 'happy') : ak === 'happy' || ak === 'perk' ? 'happy' : ak === 'hurt' ? 'scared' : ak === 'lose' ? (F.sleepy ? 'sleepy' : 'scared') : ctl.sleepy ? 'sleepy' : '';
    if (!face && ctl.blinkUntil && now < ctl.blinkUntil) face = 'blink';
    if (face && !F[face]) face = '';
    if (ctl.headImg && face !== ctl.face) { ctl.face = face; ctl.headImg.src = face ? F[face] : ctl.headSrc; }
}
const COMP_IDLE_MS = { stretch: 1700, look: 2200, wag: 1300, flap: 1400, puff: 1100 };
// A floating letter (Zz while it naps)
function compFloat(ctl, ch) {
    if (compReduced()) return;
    const p = ctl.rig.parts.find(x => x.k === 'head'); if (!p) return;
    const s = document.createElement('span'); s.className = 'comp-z'; s.textContent = ch;
    s.style.left = `${p.x + p.s * 0.8}px`; s.style.top = `${p.y + p.s * 0.15}px`;
    ctl.inner.appendChild(s); setTimeout(() => s.remove(), 2400);
}
// Fire breath from the mouth (a big burst on a cheer, a little smoke-and-ember puff when idle)
function compBreath(ctl, big) {
    if (compReduced()) return;
    const m = ctl.rig.mouth; if (!m) return;
    const p = ctl.rig.parts.find(x => x.k === m.part), sc = p.s / 512, host = ctl.els[m.part];
    const x = m.x * sc, y = m.y * sc, n = big ? 12 : 4; // inside the head's box, so the breath follows the head
    for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = `comp-fire${big ? '' : ' small'}`;
        s.style.left = `${x}px`; s.style.top = `${y}px`;
        s.style.setProperty('--dx', `${(big ? 70 : 30) + Math.random() * (big ? 90 : 30)}px`);
        s.style.setProperty('--dy', `${-10 - Math.random() * (big ? 60 : 30)}px`);
        s.style.animationDelay = `${i * (big ? 35 : 80)}ms`;
        host.appendChild(s); setTimeout(() => s.remove(), 1400);
    }
}
// Little embers (or hearts) from the tail's flame
function compSparks(ctl, kind) {
    if (compReduced()) return;
    const rig = ctl.rig, em = rig.ember; if (!em) return;
    const p = rig.parts.find(x => x.k === em.part), sc = p.s / 512;
    const x = p.x + (p.flip ? 512 - em.x : em.x) * sc, y = p.y + em.y * sc;
    const n = kind === 'happy' ? 4 : kind === 'ember' ? 1 : 7;
    for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = `comp-spark${kind === 'happy' ? ' heart' : kind === 'ember' ? ' drift' : ''}`;
        if (kind === 'happy') s.textContent = '\u2665';
        s.style.left = `${x}px`; s.style.top = `${y}px`;
        s.style.setProperty('--dx', `${(Math.random() - 0.5) * 90}px`); s.style.setProperty('--dy', `${-60 - Math.random() * 90}px`);
        s.style.animationDelay = `${i * 60}ms`;
        ctl.inner.appendChild(s); setTimeout(() => s.remove(), 1600);
    }
}
function compTick(now) {
    COMP.raf = 0;
    if (document.hidden) return;
    COMP.live = COMP.live.filter(c => c.el.isConnected);
    if (!COMP.live.length) return;
    if (now - COMP.last >= 33) { COMP.last = now; compWatch(now); COMP.live.forEach(c => { if (!c.el.getClientRects().length) return; compPose(c, now); }); }
    if (compReduced()) return; // a still pose, drawn once
    COMP.raf = requestAnimationFrame(compTick);
}
function compKick() { if (!COMP.raf && !document.hidden) COMP.raf = requestAnimationFrame(compTick); }
document.addEventListener('visibilitychange', compKick);
addEventListener('pointermove', e => { COMP.mx = e.clientX; COMP.my = e.clientY; if (COMP.ctl && COMP.idleSince && performance.now() - COMP.idleSince > 60000) COMP.idleSince = performance.now(); }, { passive: true });

// ---- In a game ----
function compWanted() {
    if (typeof AUTOPLAY !== 'undefined' && AUTOPLAY && !window.__COMP_FORCE) return null;
    if (window.__LAB) return null;
    if (typeof G === 'undefined' || !G || !G.players || typeof cosState !== 'function') return null;
    const id = cosState().companion;
    if (!id || id === 'none' || !COMPANION_RIGS[id]) return null;
    const gEl = document.getElementById('game');
    if (!gEl || gEl.classList.contains('hidden') || !gEl.getClientRects().length) return null;
    const P = G.players[0]; if (!P || (P.isAI && !window.__COMP_FORCE) || G.hotseat) return null;
    return id;
}
// Where the companion sits: the first free spot next to your seat (beside your life medallion on a wide screen, just above your bar on a
// phone). A spot is free when it covers no card, hand card, button or counter; with none free it ducks out of sight until one is.
const COMP_AVOID = '#game .perm, #game .hc, #game button, #game .zone-count, #game .life, #game .arena-av, #game .board-sum, #game .stack-item, #game .act-banner, #game #logWrap, #game .phase-rail, #game .pod-strip';
function compPlace() {
    const dock = COMP.dock; if (!dock) return;
    const phone = innerWidth <= 600, W = phone ? 64 : 132, H = Math.round(W * 430 / 440);
    const bar = document.getElementById('meBar'), br = bar ? bar.getBoundingClientRect() : null;
    const av = bar && (bar.querySelector('.life') || bar.querySelector('.arena-av')), ar = av ? av.getBoundingClientRect() : null;
    const cands = [];
    if (!phone && ar && ar.width) { cands.push([ar.right + 22, ar.bottom - H + 6], [ar.left - 22 - W, ar.bottom - H + 6]); }
    if (br && br.width) { const top = br.top - H - 2; cands.push([innerWidth - W - 8, top], [8, top], [(innerWidth - W) / 2 + W, top]); }
    cands.push([10, innerHeight - H - 140]);
    const obst = [...document.querySelectorAll(COMP_AVOID)].map(e => e.getBoundingClientRect()).filter(b => b.width && b.height);
    const free = ([x, y]) => x >= 0 && y >= 0 && x + W <= innerWidth && y + H <= innerHeight &&
        obst.every(b => b.right <= x + 4 || b.left >= x + W - 4 || b.bottom <= y + 4 || b.top >= y + H - 4);
    const spot = cands.find(free);
    dock.style.width = `${W}px`;
    if (spot) { dock.style.left = `${Math.round(spot[0])}px`; dock.style.top = `${Math.round(spot[1])}px`; dock.style.bottom = 'auto'; dock.classList.remove('ducked'); }
    else dock.classList.add('ducked');
    if (COMP.ctl) COMP.ctl.fit();
}
function companionSync() {
    const id = compWanted();
    if (!id) { if (COMP.dock) { COMP.dock.remove(); COMP.dock = null; COMP.ctl = null; } return; }
    if (COMP.ctl && COMP.ctl.id === id && COMP.dock && COMP.dock.isConnected) { compPlace(); return; }
    if (COMP.dock) COMP.dock.remove();
    const dock = document.createElement('div');
    dock.id = 'companionDock'; dock.setAttribute('aria-hidden', 'true');
    document.getElementById('game').appendChild(dock);
    COMP.dock = dock; COMP.ctl = compMount(dock, id); COMP.seen = null; COMP.idleSince = performance.now();
    if (COMP.ctl) COMP.ctl.el.title = 'Your companion (tap to pet it; change it in the 🎨 Locker)';
    compPlace();
}
// What happened since the last frame (life totals and the end of the game are read, not hooked, so nothing in the engine changes)
function compWatch(now) {
    const ctl = COMP.ctl; if (!ctl || !G || !G.players) return;
    const me = G.players[0], foesLife = G.players.slice(1).reduce((a, P) => a + (P.out ? 0 : Math.max(0, P.life)), 0);
    const s = { life: me.life, foes: foesLife, over: !!G.over, turn: G.turn };
    const o = COMP.seen; COMP.seen = s;
    if (!o || o.turn > s.turn) return;
    if (s.over && !o.over) { const won = G.winner === me || G.winner === 0 || (me && !me.out && G.players.slice(1).every(P => P.out)); ctl.react(won ? 'win' : 'lose'); COMP.idleSince = now; return; }
    if (s.life < o.life) { ctl.react('hurt'); COMP.idleSince = now; }
    else if (s.foes < o.foes) { ctl.react('cheer'); COMP.idleSince = now; }
    else if (s.life > o.life) { ctl.react('happy'); COMP.idleSince = now; }
}
{
    const base = fire;
    fire = function (ev, ctx) {
        const r = base.apply(this, arguments);
        if (COMP.ctl && ev === 'cast' && ctx && ctx.P && G && ctx.P === G.players[0]) { if (!COMP.ctl.act || COMP.ctl.act.kind === 'perk') COMP.ctl.react('perk'); COMP.idleSince = performance.now(); }
        return r;
    };
    const baseRender = renderGame;
    renderGame = function () { const r = baseRender.apply(this, arguments); try { companionSync(); } catch (e) { /* never break the table */ } return r; };
}
setInterval(() => { try { companionSync(); if (COMP.ctl) compKick(); } catch (e) { /* ignore */ } }, 1500);

// Locker previews: every [data-comp-preview] box gets a small live puppet
function companionPreviews() {
    document.querySelectorAll('[data-comp-preview]').forEach(box => {
        if (box.querySelector('.comp-stage')) return;
        box.querySelectorAll('img').forEach(i => { i.style.display = 'none'; });
        const c = compMount(box, box.dataset.compPreview, { preview: true });
        if (!c) box.querySelectorAll('img').forEach(i => { i.style.display = ''; });
    });
}
