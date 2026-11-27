// =====================================================================
// Arena UI Flair (2026-11-27): subtle ambient backdrop, 3D holographic
// card tilt & specular glare on desktop hover, live life-total impact +
// floating damage/heal deltas, summon entrance slam, card-draw glide,
// and turn-handoff glow sweep. Skips timers/effects in tests & autoplay.
// Loaded right after 08d-open-board.js.
// =====================================================================
'use strict';

(function initArenaFlair() {
    const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isAuto = () => (typeof AUTOPLAY !== 'undefined' && AUTOPLAY) || !!window.__TEST || !!window.__LAB;

    // 1. Ambient arcane backdrop behind the non-game shell (pure CSS tokens)
    if (document.body && !$('arenaBg')) {
        const bg = document.createElement('div');
        bg.id = 'arenaBg';
        bg.setAttribute('aria-hidden', 'true');
        document.body.prepend(bg);
    }

    // 2. Delegated 3D holographic tilt & specular glare (desktop fine pointer only)
    const TILT_SEL = '.ctile, .mx-preview, .asc-tile, .vault-slot:not(.empty)';
    let activeTilt = null;
    function clearTilt() {
        if (!activeTilt) return;
        activeTilt.classList.remove('arena-tilting');
        activeTilt.style.removeProperty('--tilt-rx');
        activeTilt.style.removeProperty('--tilt-ry');
        activeTilt.style.removeProperty('--glare-x');
        activeTilt.style.removeProperty('--glare-y');
        activeTilt = null;
    }
    if (typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.addEventListener('pointermove', e => {
            if (reduced() || isAuto()) { clearTilt(); return; }
            const el = e.target && e.target.closest ? e.target.closest(TILT_SEL) : null;
            if (!el || !el.querySelector('img')) { clearTilt(); return; }
            if (activeTilt && activeTilt !== el) clearTilt();
            activeTilt = el;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
            const ry = ((px - 0.5) * 8).toFixed(2);
            const rx = ((0.5 - py) * 8).toFixed(2);
            el.style.setProperty('--tilt-rx', rx + 'deg');
            el.style.setProperty('--tilt-ry', ry + 'deg');
            el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
            el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
            el.classList.add('arena-tilting');
        }, { passive: true });
        document.addEventListener('pointerdown', clearTilt, { passive: true });
        window.addEventListener('scroll', clearTilt, { passive: true });
    }

    // 3. Battle table feedback hooked cleanly around renderGame()
    const FX = { game: null, life: {}, perms: new Set(), hand: new Set(), turnKey: '', seeded: false };

    function spawnDelta(anchorEl, diff) {
        if (!anchorEl || !diff || reduced()) return;
        const r = anchorEl.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const tag = document.createElement('div');
        tag.className = 'arena-delta ' + (diff < 0 ? 'hit' : 'heal');
        tag.setAttribute('aria-hidden', 'true');
        tag.textContent = (diff > 0 ? '+' : '') + diff;
        tag.style.left = Math.round(r.left + r.width / 2) + 'px';
        tag.style.top = Math.round(r.top + r.height / 2) + 'px';
        document.body.appendChild(tag);
        setTimeout(() => tag.remove(), 1000);
    }

    function pulseLife(barId, diff, low) {
        const el = document.querySelector(`#${barId} .life`);
        if (!el) return;
        el.classList.toggle('life-low', !!low);
        if (!diff || reduced()) return;
        const cls = diff < 0 ? 'life-hit' : 'life-heal';
        el.classList.remove('life-hit', 'life-heal');
        void el.offsetWidth;
        el.classList.add(cls);
        spawnDelta(el, diff);
        setTimeout(() => el.classList.remove(cls), 600);
    }

    let turnToastTimer = null;
    function showTurnToast() {
        const el = $('turnToast');
        if (!el || !G || G.over || G.phase === 'setup' || reduced()) return;
        const A = G.players[G.active];
        if (!A) return;
        const mine = G.active === G.view;
        const cmdr = typeof playerCmdr === 'function' ? playerCmdr(A) : null;
        const col = mine ? 'var(--gold)' : (cmdr && cmdr.col ? cmdr.col : 'var(--brand-light)');
        const title = mine ? 'Your Turn' : `${who(A)}'s Turn`;
        const sub = cmdr ? cmdr.card.name : (A.deckName || '');
        const av = cmdr && cmdr.art
            ? `<span class="tt-av has-art"><img src="${cmdr.art}" alt=""></span>`
            : `<span class="tt-av">${mine ? '🧙' : '🤖'}</span>`;
        el.style.setProperty('--tt-c', col);
        el.className = `turn-toast${mine ? ' mine' : ''}`;
        el.innerHTML = `${av}<span class="tt-copy"><small>Turn ${G.turn}</small><strong>${esc(title)}</strong>${sub ? `<em>${esc(sub)}</em>` : ''}</span>`;
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(turnToastTimer);
        const dur = Math.max(700, Math.round(1450 / (window._gameSpeed || 1)));
        turnToastTimer = setTimeout(() => el.classList.remove('show'), dur);
    }

    function flashTurn(mine) {
        const g = $('game');
        if (!g || reduced()) return;
        const cls = mine ? 'turn-flash-mine' : 'turn-flash-theirs';
        g.classList.remove('turn-flash-mine', 'turn-flash-theirs');
        void g.offsetWidth;
        g.classList.add(cls);
        setTimeout(() => g.classList.remove(cls), 700);
        showTurnToast();
    }

    // Keyboard shortcuts during a live game (desktop): 1/2/3 focus pod seats, Space skips action banner
    document.addEventListener('keydown', e => {
        if (isAuto() || !G || !$('game') || $('game').classList.contains('hidden')) return;
        const t = e.target;
        if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
        if (document.querySelector('#modalHost .modal, #sheetHost .sheet-bg')) return;
        if (G.players.length > 2 && ['1', '2', '3'].includes(e.key)) {
            const opps = G.players.filter(X => X !== me() && !X.out);
            const pick = opps[Number(e.key) - 1];
            if (pick && typeof podFocus === 'function') { podFocus(pick.i); e.preventDefault(); }
        } else if (e.key === ' ' && typeof actCur !== 'undefined' && actCur && typeof actSkip === 'function') {
            actSkip(); e.preventDefault();
        }
    });

    function arenaAfterRender() {
        const g = $('game');
        if (g && G) g.classList.toggle('pod-mode', G.players.length > 2);
        if (typeof applyGameSpeed === 'function') applyGameSpeed();
        if (isAuto() || !G || !g || g.classList.contains('hidden')) return;
        if (FX.game !== G) {
            FX.game = G;
            FX.life = {};
            FX.perms = new Set();
            FX.hand = new Set();
            FX.turnKey = `${G.turn}|${G.active}`;
            FX.seeded = false;
            // In Open Board on desktop, start the Game Log cleanly collapsed into a floating drawer button so the playmat stays full-bleed
            const lw = $('logWrap');
            if (lw && typeof openBoard === 'function' && openBoard() && innerWidth >= 760) lw.open = false;
        }

        const lowCut = G.format === 'commander' ? 10 : 5;
        const pairs = [['meBar', me()], ['oppBar', foe()]];
        for (const [barId, P] of pairs) {
            if (!P) continue;
            const prev = FX.life[P.i];
            const diff = (FX.seeded && typeof prev === 'number') ? P.life - prev : 0;
            FX.life[P.i] = P.life;
            pulseLife(barId, diff, P.life <= lowCut && P.life > 0);
        }

        // Turn handoff glow
        const tk = `${G.turn}|${G.active}`;
        if (FX.seeded && tk !== FX.turnKey && !G.over && G.phase !== 'setup') {
            flashTurn(G.active === G.view);
        }
        FX.turnKey = tk;

        // Newly entered battlefield permanents
        const curPerms = new Set();
        document.querySelectorAll('#meSide .perm[data-uid], #oppSide .perm[data-uid]').forEach(el => {
            const uid = el.dataset.uid;
            curPerms.add(uid);
            if (FX.seeded && !FX.perms.has(uid) && !reduced()) {
                el.classList.add('just-entered');
                setTimeout(() => el.classList.remove('just-entered'), 450);
            }
        });
        FX.perms = curPerms;

        // Newly drawn hand cards
        const curHand = new Set();
        document.querySelectorAll('#hand .hc[data-uid]').forEach(el => {
            const uid = el.dataset.uid;
            curHand.add(uid);
            if (FX.seeded && !FX.hand.has(uid) && !reduced()) {
                el.classList.add('just-drawn');
                setTimeout(() => el.classList.remove('just-drawn'), 400);
            }
        });
        FX.hand = curHand;
        FX.seeded = true;
        drawArenaArrows();
    }

    // 4. MTG Arena Live SVG Targeting & Combat Arrows (#arenaArrows)
    let liveCursor = null;
    function centerOf(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
    }
    function playerAnchor(P) {
        if (!P || !G) return null;
        if (P === me()) return centerOf(document.querySelector('#meBar .life'));
        if (G.players.length > 2) {
            const seat = document.querySelector(`.pod-chip[data-seat="${P.i}"]`);
            if (seat) return centerOf(seat);
        }
        return centerOf(document.querySelector('#oppBar .life')) || centerOf($('oppBar'));
    }
    function targetAnchor(t) {
        if (!t) return null;
        if (t.o) return centerOf(document.querySelector(`#game [data-uid="${t.o.uid}"]`));
        if (t.item) return centerOf(document.querySelector(`#game [data-stack-id="${t.item.id}"]`));
        if (t.p) return playerAnchor(t.p);
        return null;
    }
    function arrowPath(a, b, bend) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const trimEnd = Math.min(18, dist * 0.18);
        const ex = b.x - (dx / dist) * trimEnd, ey = b.y - (dy / dist) * trimEnd;
        const mx = (a.x + ex) / 2, my = (a.y + ey) / 2;
        const nx = -dy / dist, ny = dx / dist;
        const curve = Math.min(72, dist * 0.22) * (bend || 1);
        return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${(mx + nx * curve).toFixed(1)} ${(my + ny * curve).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
    function drawArenaArrows() {
        const svg = $('arenaArrows');
        if (!svg) return;
        if (isAuto() || !G || G.over || !$('game') || $('game').classList.contains('hidden')) {
            if (svg.innerHTML) svg.innerHTML = '';
            return;
        }
        const lines = [];
        // (a) Stack item -> target (electric cyan)
        (G.stack || []).forEach(it => {
            if (!it || !it.target) return;
            const from = centerOf(document.querySelector(`#game [data-stack-id="${it.id}"]`)) || (it.o && centerOf(document.querySelector(`#game [data-uid="${it.o.uid}"]`)));
            const to = targetAnchor(it.target);
            if (from && to) lines.push({ kind: 'spell', d: arrowPath(from, to, from.x > to.x ? -1 : 1) });
        });
        // (b) Declared attackers -> defender / seat / planeswalker (crimson-orange)
        const atkUids = G.attackers && G.attackers.length ? G.attackers : (G.mode && G.mode.type === 'attack' && G.mode.sel ? [...G.mode.sel] : []);
        atkUids.forEach((uid, idx) => {
            const o = typeof onBf === 'function' ? onBf(uid) : null;
            if (!o) return;
            const from = centerOf(document.querySelector(`#game [data-uid="${uid}"]`));
            let to = null;
            if (o.attackPW) to = centerOf(document.querySelector(`#game [data-uid="${o.attackPW}"]`));
            if (!to) {
                const defIdx = o.atkTo != null ? o.atkTo : (G.defender != null ? G.defender : (o.owner === me().i ? foe().i : me().i));
                to = playerAnchor(G.players[defIdx]);
            }
            if (from && to) lines.push({ kind: 'attack', d: arrowPath(from, to, (idx % 2 === 0 ? 1 : -1) * 0.7) });
        });
        // (c) Blockers -> attackers they block (arcane blue)
        Object.entries(G.blocks || {}).forEach(([atkUid, blockers]) => {
            const to = centerOf(document.querySelector(`#game [data-uid="${atkUid}"]`));
            if (!to) return;
            (blockers || []).forEach(bUid => {
                const from = centerOf(document.querySelector(`#game [data-uid="${bUid}"]`));
                if (from) lines.push({ kind: 'block', d: arrowPath(from, to, 0.8) });
            });
        });
        // (d) Interactive cursor targeting arrow when choosing a target
        if (G.mode && G.mode.type === 'target' && liveCursor) {
            const src = G.mode.source;
            const from = (src && centerOf(document.querySelector(`#game [data-uid="${src.uid}"]`)))
                || centerOf(document.querySelector('#midBar .stack-item.top'))
                || centerOf(document.querySelector('#midBar .prompt'))
                || centerOf(document.querySelector('#meBar .life'));
            if (from) {
                const hoveringValid = !!(liveCursor.el && liveCursor.el.closest && liveCursor.el.closest('.selectable, .targetable'));
                lines.push({ kind: hoveringValid ? 'target-lock' : 'spell', d: arrowPath(from, liveCursor, 0.65) });
            }
        }
        if (!lines.length) { if (svg.innerHTML) svg.innerHTML = ''; return; }
        svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
        svg.innerHTML = `<defs>
            <marker id="arw-spell" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" class="arw-head spell"/></marker>
            <marker id="arw-attack" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" class="arw-head attack"/></marker>
            <marker id="arw-block" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" class="arw-head block"/></marker>
            <marker id="arw-lock" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" class="arw-head target-lock"/></marker>
        </defs>${lines.map(l => {
            const mk = l.kind === 'target-lock' ? 'arw-lock' : `arw-${l.kind}`;
            return `<path class="arw-glow ${l.kind}" d="${l.d}"/><path class="arw-line ${l.kind}" d="${l.d}" marker-end="url(#${mk})"/>`;
        }).join('')}`;
    }
    window.addEventListener('resize', () => drawArenaArrows(), { passive: true });
    document.addEventListener('pointermove', e => {
        if (!G || !G.mode || G.mode.type !== 'target') {
            if (liveCursor) { liveCursor = null; drawArenaArrows(); }
            return;
        }
        liveCursor = { x: e.clientX, y: e.clientY, el: e.target };
        drawArenaArrows();
    }, { passive: true });

    if (typeof renderGame === 'function') {
        const origRenderGame = renderGame;
        window.renderGame = function () {
            origRenderGame.apply(this, arguments);
            try { arenaAfterRender(); if (typeof window._arenaWakeMotes === 'function') window._arenaWakeMotes(); } catch (e) { /* flair must never break the table */ }
        };
    }

    // 5. Ambient Floating Embers / Arcane Motes Canvas (#arenaMotes)
    // Gentle drifting particles tinted by the active Look's --gold & --brand-light tokens.
    // Pauses automatically when #game is hidden, tab is hidden, reduced-motion, or autoplay/test.
    (function initArenaMotes() {
        const cv = $('arenaMotes');
        if (!cv || !cv.getContext) return;
        const ctx = cv.getContext('2d');
        const N = 26;
        let pts = [], raf = 0, lastT = 0;
        function seed(w, h) {
            pts = [];
            for (let i = 0; i < N; i++) {
                pts.push({
                    x: Math.random() * w, y: Math.random() * h,
                    r: 1.1 + Math.random() * 2.1,
                    vx: (Math.random() - 0.5) * 9, vy: -(5 + Math.random() * 11),
                    ph: Math.random() * Math.PI * 2, gold: i % 3 !== 0
                });
            }
        }
        function tick(t) {
            raf = 0;
            const g = $('game');
            if (!g || g.classList.contains('hidden') || !g.classList.contains('open-board') || document.hidden || reduced() || isAuto()) {
                lastT = 0; return;
            }
            const w = innerWidth, h = innerHeight;
            if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; seed(w, h); }
            const dt = lastT ? Math.min(0.06, (t - lastT) / 1000) : 0.016;
            lastT = t;
            const cs = getComputedStyle(document.documentElement);
            const cGold = cs.getPropertyValue('--gold').trim() || '#e8c25a';
            const cBrand = cs.getPropertyValue('--brand-light').trim() || '#3aa3d1';
            ctx.clearRect(0, 0, w, h);
            for (const p of pts) {
                p.x += (p.vx + Math.sin(t * 0.0008 + p.ph) * 4) * dt;
                p.y += p.vy * dt;
                if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
                if (p.x < -10) p.x = w + 10;
                if (p.x > w + 10) p.x = -10;
                const a = 0.16 + 0.24 * (0.5 + 0.5 * Math.sin(t * 0.0018 + p.ph));
                ctx.globalAlpha = a;
                ctx.fillStyle = p.gold ? cGold : cBrand;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = a * 0.3;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 3.1, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(tick);
        }
        function wake() { if (!raf && !reduced() && !isAuto()) raf = requestAnimationFrame(tick); }
        const origAfter = window._arenaWakeMotes = wake;
        document.addEventListener('visibilitychange', () => { if (!document.hidden) origAfter(); });
        wake();
    })();
})();
