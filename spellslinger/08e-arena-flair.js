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
            const ry = ((px - 0.5) * 12).toFixed(2);
            const rx = ((0.5 - py) * 12).toFixed(2);
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
    }

    if (typeof renderGame === 'function') {
        const origRenderGame = renderGame;
        window.renderGame = function () {
            origRenderGame.apply(this, arguments);
            try { arenaAfterRender(); } catch (e) { /* flair must never break the table */ }
        };
    }
})();
