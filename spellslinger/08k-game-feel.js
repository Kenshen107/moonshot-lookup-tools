// =====================================================================
// Game Feel & QoL Suite (2026-11-28):
//  1) Web Audio Synth SFX (zero external files, mute toggle)
//  2) Pod-chip floating damage/heal deltas + Creature hit recoil shake
//  3) Quick-Play double-tap on playable hand cards + Undo manual mana tap
//  4) Arena-style Mana Tap Preview on hand hover/focus
//  5) Remember Last Match Setup ("Instant Match" card on Play tab)
//  6) "New Pulls That Fit This Deck" 1-tap add strip in Deck Builder
// Loaded right before 16-startup.js.
// =====================================================================
'use strict';

(function initGameFeel() {
    const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const silent = () => (typeof AUTOPLAY !== 'undefined' && AUTOPLAY) || !!window.__TEST || !!window.__LAB;

    // ---- 1. Web Audio Synth SFX (zero asset files) ----
    let sfxOn = store.get('sfxOn', '1') !== '0';
    let audioCtx = null;
    function ctx() {
        if (!sfxOn || silent()) return null;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!audioCtx) { try { audioCtx = new AC(); } catch (e) { return null; } }
        if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) { /* ok */ } }
        return audioCtx;
    }
    function tone(freq, dur, type = 'sine', vol = 0.08, endFreq = null, delay = 0) {
        const c = ctx();
        if (!c) return;
        try {
            const t0 = c.currentTime + delay;
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t0);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            osc.connect(g); g.connect(c.destination);
            osc.start(t0); osc.stop(t0 + dur + 0.02);
        } catch (e) { /* audio blocked */ }
    }
    function vibe(pat) {
        if (!sfxOn || silent() || reduced()) return;
        try {
            if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
            if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(pat);
        } catch (e) { /* unsupported */ }
    }
    const SFX = {
        snap() { tone(420, 0.055, 'triangle', 0.06, 180); vibe(10); },
        tap() { tone(520, 0.04, 'sine', 0.04, 680); vibe(8); },
        cast() { tone(392, 0.14, 'triangle', 0.07, 587); tone(587, 0.18, 'sine', 0.05, 880, 0.05); vibe(14); },
        hit() { tone(140, 0.16, 'sawtooth', 0.09, 48); vibe(32); },
        heal() { tone(440, 0.14, 'sine', 0.06, 554); tone(554, 0.18, 'sine', 0.05, 659, 0.06); },
        sparkle() { [659, 880, 1175, 1568].forEach((f, i) => tone(f, 0.16, 'sine', 0.055, f * 1.04, i * 0.055)); vibe([16, 30, 22]); },
        victory() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.075, null, i * 0.09)); vibe([20, 40, 25, 40, 40]); },
        defeat() { [330, 294, 247, 196].forEach((f, i) => tone(f, 0.24, 'sawtooth', 0.05, null, i * 0.11)); vibe(45); }
    };
    window.SFX = SFX;
    function syncSfxBtn() {
        const b = $('sfxBtn');
        if (!b) return;
        b.textContent = sfxOn ? '🔊' : '🔇';
        b.setAttribute('aria-pressed', String(sfxOn));
        b.title = sfxOn ? 'Sound effects: ON (tap to mute)' : 'Sound effects: OFF (tap to enable)';
    }
    window.toggleSfx = function () {
        sfxOn = !sfxOn;
        store.set('sfxOn', sfxOn ? '1' : '0');
        syncSfxBtn();
        if (sfxOn) SFX.tap();
        toast(sfxOn ? '🔊 Sound effects on' : '🔇 Sound effects muted');
    };
    syncSfxBtn();

    // ---- 2. Pod-Chip Floating Deltas, Creature Hit Shake & SFX Hooks ----
    const TRACK = { game: null, life: {}, dmg: {}, handN: 0, over: false, seeded: false };
    function spawnPodDelta(seatIdx, diff) {
        if (!diff || reduced()) return;
        const chip = document.querySelector(`.pod-chip[data-seat="${seatIdx}"]`);
        if (!chip) return;
        const r = chip.getBoundingClientRect();
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

    function afterRenderGame() {
        if (typeof G === 'undefined' || !G) return;
        if (TRACK.game !== G) {
            TRACK.game = G; TRACK.life = {}; TRACK.dmg = {}; TRACK.over = false; TRACK.seeded = false;
            TRACK.handN = me() ? me().hand.length : 0;
        }
        const curLife = {};
        const curDmg = {};
        G.players.forEach(P => {
            curLife[P.i] = P.life;
            (P.bf || []).forEach(o => { if (o.dmg) curDmg[o.uid] = o.dmg; });
        });
        if (TRACK.seeded) {
            let anyHit = false, anyHeal = false;
            G.players.forEach(P => {
                const prev = TRACK.life[P.i];
                if (prev !== undefined && prev !== P.life) {
                    const diff = P.life - prev;
                    if (diff < 0) anyHit = true; else anyHeal = true;
                    if (G.players.length > 2 && P.i !== G.view) spawnPodDelta(P.i, diff);
                }
            });
            Object.entries(curDmg).forEach(([uid, d]) => {
                if ((TRACK.dmg[uid] || 0) < d) {
                    anyHit = true;
                    if (!reduced()) {
                        const el = document.querySelector(`.perm[data-uid="${uid}"]`);
                        if (el) { el.classList.remove('perm-hit-shake'); void el.offsetWidth; el.classList.add('perm-hit-shake'); setTimeout(() => el.classList.remove('perm-hit-shake'), 420); }
                    }
                }
            });
            const myHandN = me() ? me().hand.length : 0;
            if (myHandN > TRACK.handN) SFX.snap();
            TRACK.handN = myHandN;
            if (anyHit) SFX.hit();
            else if (anyHeal) SFX.heal();
            if (G.over && !TRACK.over) {
                TRACK.over = true;
                if (window.lastResult && window.lastResult.winner === 0) SFX.victory();
                else if (window.lastResult && window.lastResult.winner !== null) SFX.defeat();
            }
        }
        TRACK.life = curLife;
        TRACK.dmg = curDmg;
        TRACK.seeded = true;
        renderUndoManaBtn();
        clearManaPreview();
    }

    if (typeof window.renderGame === 'function') {
        const origRenderGame = window.renderGame;
        window.renderGame = function () {
            const res = origRenderGame.apply(this, arguments);
            try { afterRenderGame(); } catch (e) { /* non-fatal */ }
            return res;
        };
    }
    if (typeof window.humanCast === 'function') {
        const origCast = window.humanCast;
        window.humanCast = function () { SFX.cast(); clearUndoMana(); return origCast.apply(this, arguments); };
    }
    if (typeof window.humanPlayLand === 'function') {
        const origLand = window.humanPlayLand;
        window.humanPlayLand = function () { SFX.snap(); return origLand.apply(this, arguments); };
    }
    if (typeof window.celebratePull === 'function') {
        const origCel = window.celebratePull;
        window.celebratePull = function () { SFX.sparkle(); return origCel.apply(this, arguments); };
    }
    if (typeof window.peelPack === 'function') {
        const origPeel = window.peelPack;
        window.peelPack = function () { SFX.snap(); return origPeel.apply(this, arguments); };
    }

    // ---- 3. Quick-Play Double-Tap & Undo Last Manual Mana Tap ----
    let lastHandTap = { uid: null, at: 0 };
    if (typeof window.showGameCard === 'function') {
        const origShow = window.showGameCard;
        window.showGameCard = function (uid) {
            const now = Date.now();
            const o = typeof findObj === 'function' ? findObj(uid) : null;
            const P = typeof me === 'function' ? me() : null;
            if (o && P && P.hand && P.hand.includes(o) && lastHandTap.uid === uid && (now - lastHandTap.at) < 380) {
                lastHandTap = { uid: null, at: 0 };
                closeSheet();
                const r = Rx(o);
                if (r.kind === 'land' && canPlayLand(P, o)) { humanPlayLand(uid); return; }
                if (r.kind !== 'land' && canCastNow(P, o) && canPay(P, o)) { humanCast(uid); return; }
            }
            lastHandTap = { uid, at: now };
            return origShow.apply(this, arguments);
        };
    }

    function clearUndoMana() { if (typeof G !== 'undefined' && G) G._undoMana = []; }
    if (typeof window.tapForMana === 'function') {
        const origTap = window.tapForMana;
        window.tapForMana = function (uid, color) {
            const P = typeof me === 'function' ? me() : null;
            const o = typeof onBf === 'function' ? onBf(uid) : null;
            const beforePool = P ? (P.pool || []).length : 0;
            const beforeLife = P ? P.life : 0;
            const inPay = typeof G !== 'undefined' && G && G.mode && G.mode.type === 'pay';
            const res = origTap.apply(this, arguments);
            if (!inPay && P && o && o.tapped && (P.pool || []).length > beforePool) {
                SFX.tap();
                G._undoMana = G._undoMana || [];
                G._undoMana.push({ uid: o.uid, added: (P.pool || []).length - beforePool, lifeDelta: beforeLife - P.life, turn: G.turn, phase: G.phase });
                renderUndoManaBtn();
            }
            return res;
        };
    }
    window.undoManaTap = function () {
        if (typeof G === 'undefined' || !G || !G._undoMana || !G._undoMana.length) return;
        const P = me();
        const rec = G._undoMana.pop();
        if (!rec || rec.turn !== G.turn || rec.phase !== G.phase) { clearUndoMana(); renderUndoManaBtn(); return; }
        const o = onBf(rec.uid);
        if (!o || !o.tapped || (P.pool || []).length < rec.added) { toast('That mana has already been used.'); clearUndoMana(); renderUndoManaBtn(); return; }
        o.tapped = false;
        P.pool.splice(P.pool.length - rec.added, rec.added);
        if (rec.lifeDelta) P.life += rec.lifeDelta;
        SFX.tap();
        toast(`↩ Untapped ${o.card.name}`);
        renderGame();
    };
    function renderUndoManaBtn() {
        const mc = document.querySelector('#midBar .mid-controls');
        if (!mc || typeof G === 'undefined' || !G) return;
        const old = $('undoManaBtn');
        const list = (G._undoMana || []).filter(r => r.turn === G.turn && r.phase === G.phase);
        G._undoMana = list;
        const P = me();
        const show = list.length > 0 && P && (P.pool || []).length > 0 && !(G.mode && G.mode.type === 'pay');
        if (!show) { if (old) old.remove(); return; }
        if (!old) {
            const btn = document.createElement('button');
            btn.id = 'undoManaBtn';
            btn.type = 'button';
            btn.className = 'btn small';
            btn.textContent = '↩ Undo mana tap';
            btn.title = 'Untap the last land you tapped manually';
            btn.onclick = () => window.undoManaTap();
            mc.appendChild(btn);
        }
    }

    // ---- 4. Arena-Style Mana Tap Preview on Hand Hover / Focus ----
    function clearManaPreview() {
        document.querySelectorAll('.perm.mana-preview').forEach(el => el.classList.remove('mana-preview'));
    }
    function previewManaFor(uid) {
        clearManaPreview();
        if (typeof G === 'undefined' || !G || G.over || G.busy || typeof planPayment !== 'function') return;
        const P = me();
        const o = findObj(uid);
        if (!P || !o || Rx(o).kind === 'land' || !canCastNow(P, o)) return;
        try {
            const plan = planPayment(P, parseCost(o.card.cost), typeof extraCost === 'function' ? extraCost(P, o) : 0);
            if (!plan || !plan.length) return;
            plan.forEach(src => {
                const u = src && (src.uid || (src.o && src.o.uid));
                if (!u) return;
                const el = document.querySelector(`#meSide .perm[data-uid="${u}"]`);
                if (el) el.classList.add('mana-preview');
            });
        } catch (e) { /* safe ignore */ }
    }
    document.addEventListener('pointerover', e => {
        const hc = e.target && e.target.closest ? e.target.closest('#hand .hc.playable') : null;
        if (hc && hc.dataset.uid) previewManaFor(Number(hc.dataset.uid));
    }, { passive: true });
    document.addEventListener('pointerout', e => {
        const hc = e.target && e.target.closest ? e.target.closest('#hand .hc.playable') : null;
        if (hc) clearManaPreview();
    }, { passive: true });

    // ---- 5. Remember Last Match Setup ("Instant Match" Card on Play Tab) ----
    if (typeof window.startMatch === 'function') {
        const origStart = window.startMatch;
        window.startMatch = function () {
            try {
                const sel = $('playDeck');
                const idx = sel ? Number(sel.value) : 0;
                const d = profile && profile.decks && profile.decks[idx];
                if (d) {
                    store.set('lastMatchSetup:' + (accounts && accounts.current || 'default'), {
                        deckId: d.id, deckName: d.name, format: d.format,
                        oppName: (typeof chosenOpponent !== 'undefined' && chosenOpponent && chosenOpponent.name) || ''
                    });
                }
            } catch (e) { /* ignore */ }
            return origStart.apply(this, arguments);
        };
    }
    window.launchInstantMatch = function () {
        const saved = store.get('lastMatchSetup:' + (accounts && accounts.current || 'default'), null);
        if (!saved || !profile || !profile.decks.length) return;
        const idx = profile.decks.findIndex(d => d.id === saved.deckId);
        if (idx >= 0 && $('playDeck')) { $('playDeck').value = String(idx); if (typeof renderPlayView === 'function') renderPlayView(); }
        if (typeof startMatch === 'function') startMatch();
    };
    if (typeof window.renderPlayView === 'function') {
        const origPlay = window.renderPlayView;
        window.renderPlayView = function () {
            const res = origPlay.apply(this, arguments);
            try {
                const box = $('deckPick');
                const saved = store.get('lastMatchSetup:' + (accounts && accounts.current || 'default'), null);
                if (!box || !saved || !profile || !profile.decks.length) return res;
                const d = profile.decks.find(x => x.id === saved.deckId);
                if (!d || deckProblems(d).length) return res;
                const existing = $('instantMatchCard');
                if (existing) existing.remove();
                const card = document.createElement('div');
                card.id = 'instantMatchCard';
                card.className = 'instant-match-card';
                card.innerHTML = `<div class="im-info"><strong>⚡ Jump Right Back In</strong><span class="note">Last deck: <b>${esc(d.name)}</b> (${esc(FORMATS[d.format].name)})${saved.oppName ? ` · vs ${esc(saved.oppName)}` : ''}</span></div><button type="button" class="btn primary" onclick="launchInstantMatch()">⚔️ Instant Match</button>`;
                box.prepend(card);
            } catch (e) { /* ignore */ }
            return res;
        };
    }

    // ---- 6. "New Pulls That Fit This Deck" Strip in Deck Builder ----
    if (typeof window.renderDeckPanel === 'function') {
        const origDeckPanel = window.renderDeckPanel;
        window.renderDeckPanel = function () {
            const res = origDeckPanel.apply(this, arguments);
            try {
                if (!editing || editing.starter || !$('mxStats')) return res;
                const old = $('newPullsStrip');
                if (old) old.remove();
                const cmd = editing.commander && CARDS.get(editing.commander);
                const allowedCi = cmd ? deckCi(editing) : null;
                const candidates = Object.entries(profile.collection || {})
                    .filter(([id, cnt]) => cnt > 0 && !editing.cards[id] && editing.commander !== id && editing.commander2 !== id)
                    .map(([id]) => CARDS.get(id))
                    .filter(c => c && !isBasic(c) && rulesFor(c).support === 'full' && (!allowedCi || (c.ci || []).every(col => allowedCi.includes(col))))
                    .sort((a, b) => (+b.usd || 0) - (+a.usd || 0))
                    .slice(0, 8);
                if (!candidates.length) return res;
                const strip = document.createElement('div');
                strip.id = 'newPullsStrip';
                strip.className = 'panel new-pulls-strip';
                strip.innerHTML = `<h3>✨ Owned cards that fit this deck</h3><div class="new-pulls-row">${candidates.map(c => `<button type="button" class="new-pull-chip" onclick="addCardToDeck('${c.id}')" onmouseenter="if(typeof mxHover==='function') mxHover('${c.id}')" title="Add ${esc(c.name)} to deck">${c.imgS ? `<img src="${c.imgS}" alt="">` : ''}<span><strong>${esc(c.name)}</strong><small>${esc(c.cost || '')}${+c.usd ? ` · ${usd(+c.usd)}` : ''}</small></span><b>＋</b></button>`).join('')}</div>`;
                $('mxStats').after(strip);
            } catch (e) { /* ignore */ }
            return res;
        };
    }
    window.addCardToDeck = function (id) {
        if (!editing || !CARDS.get(id)) return;
        editing.cards[id] = (editing.cards[id] || 0) + 1;
        SFX.snap();
        toast(`＋ Added ${CARDS.get(id).name}`);
        if (typeof builderChanged === 'function') builderChanged();
    };

    // ---- 7. Sticky "Match Ready" Bar & Commander Art Portraits on Play Tab ----
    function updateStickyMatchBar() {
        const vp = $('view-play');
        if (!vp || vp.classList.contains('hidden')) return;
        const sel = $('playDeck');
        const d = sel && profile && profile.decks && profile.decks[Number(sel.value)];
        const opp = typeof chosenOpponent !== 'undefined' ? chosenOpponent : null;
        let bar = $('stickyMatchBar');
        // Only show the sticky Match Ready bar once both a deck AND an opponent are picked (so it never occludes step 2 or misleads!)
        if (!d || !opp) { if (bar) bar.remove(); }
        else {
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'stickyMatchBar';
                bar.className = 'sticky-match-bar';
                vp.appendChild(bar);
            }
            const probs = typeof deckProblems === 'function' ? deckProblems(d) : [];
            const cmdr = d.commander && CARDS.get(d.commander);
            const art = cmdr && (cmdr.imgS || cmdr.img);
            bar.innerHTML = `<div class="smb-info">${art ? `<img class="smb-av" src="${art}" alt="">` : ''}<div class="smb-txt"><strong>${esc(d.name)}</strong><span class="note">vs ${esc(opp.name || 'Opponent')} · ${esc(FORMATS[d.format].name)}${probs.length ? ` · ⚠ ${probs.length} to fix` : ''}</span></div></div>
                <button type="button" class="btn primary smb-go" ${probs.length ? 'disabled' : ''} onclick="const sb = document.getElementById('startBtn'); if (sb && !sb.disabled) sb.click(); else startMatch();">⚔️ Start Match</button>`;
        }
        // Inject commander art thumbnails into deck tiles inside #deckPick
        document.querySelectorAll('#deckPick .opp.dk').forEach(btn => {
            if (btn.querySelector('.dk-art')) return;
            const m = (btn.getAttribute('onclick') || '').match(/playPickDeck\((\d+)\)/);
            if (!m) return;
            const dk = profile.decks[Number(m[1])];
            const c = dk && dk.commander && CARDS.get(dk.commander);
            if (c && (c.imgS || c.img)) {
                const img = document.createElement('img');
                img.className = 'dk-art';
                img.src = c.imgS || c.img;
                img.alt = '';
                btn.prepend(img);
            }
        });
    }
    if (typeof window.renderOpponents === 'function') {
        const origOpp = window.renderOpponents;
        window.renderOpponents = function () {
            const res = origOpp.apply(this, arguments);
            try { updateStickyMatchBar(); } catch (e) { /* ok */ }
            return res;
        };
    }

    // ---- 8. Mobile Deck Builder Sub-Tabs (Decklist | Collection | Curve & Hand) ----
    let mobDeckTab = 'deck';
    window.setMobDeckTab = function (t) {
        mobDeckTab = t;
        const b = $('builder');
        if (b) b.dataset.mobTab = t;
        document.querySelectorAll('#mobDeckTabs [data-mt]').forEach(el => el.classList.toggle('on', el.dataset.mt === t));
    };
    if (typeof window.renderBuilderHead === 'function') {
        const origBH = window.renderBuilderHead;
        window.renderBuilderHead = function () {
            const res = origBH.apply(this, arguments);
            try {
                const b = $('builder');
                if (!b) return res;
                b.dataset.mobTab = mobDeckTab;
                if (!$('mobDeckTabs')) {
                    const bar = document.createElement('div');
                    bar.id = 'mobDeckTabs';
                    bar.className = 'chips phone-only mob-deck-tabs';
                    bar.innerHTML = `<button type="button" class="chip on" data-mt="deck" onclick="setMobDeckTab('deck')">🗂️ Decklist</button><button type="button" class="chip" data-mt="browse" onclick="setMobDeckTab('browse')">➕ Collection</button><button type="button" class="chip" data-mt="stats" onclick="setMobDeckTab('stats')">📊 Curve &amp; Hand</button>`;
                    const head = $('mxHead');
                    if (head) head.after(bar);
                }
                window.setMobDeckTab(mobDeckTab);
            } catch (e) { /* ok */ }
            return res;
        };
    }

    // ---- 9. Locker "Live Setup Preview" Banner ----
    function injectLockerPreview() {
        const host = document.querySelector('#modalHost .locker');
        if (!host || typeof cosState !== 'function') return;
        const old = $('lockerPreview');
        if (old) old.remove();
        const s = cosState();
        const slv = cosItem(s.sleeve) || COSMETICS[0];
        const comp = cosItem(s.companion);
        const look = (() => { try { return JSON.parse(localStorage.getItem('spLook') || '{}').name || 'classic'; } catch (e) { return 'classic'; } })();
        const matKey = (() => { try { return localStorage.getItem('arenaMat') || 'auto'; } catch (e) { return 'auto'; } })();
        const matObj = typeof ARENA_MATS !== 'undefined' ? (ARENA_MATS.find(m => m.id === matKey) || ARENA_MATS[0]) : null;
        const bgStyle = matObj && matObj.img ? `background-image: linear-gradient(color-mix(in srgb, var(--bg-canvas) 45%, transparent), color-mix(in srgb, var(--bg-canvas) 65%, transparent)), url('${matObj.img}');` : '';
        const slvHTML = slv && slv.img ? `<img class="lp-sleeve" src="${slv.img}" alt="${esc(slv.name)}">` : `<span class="lp-sleeve lp-css" style="background:${slv && slv.css ? slv.css : 'var(--bg-inset)'}"></span>`;
        const compHTML = comp && comp.thumb ? `<img class="lp-comp" src="${comp.thumb}" alt="${esc(comp.name)}">` : `<span class="lp-comp empty">🐾</span>`;
        const prev = document.createElement('div');
        prev.id = 'lockerPreview';
        prev.className = 'locker-preview';
        if (bgStyle) prev.setAttribute('style', bgStyle);
        prev.innerHTML = `<div class="lp-items">${slvHTML}${compHTML}</div><div class="lp-meta"><small>Active table loadout</small><strong>${esc(look.charAt(0).toUpperCase() + look.slice(1))} · ${esc(slv ? slv.name : 'Classic')}</strong><span>${esc(matObj ? matObj.name : 'Auto Playmat')} · ${esc(comp && comp.id !== 'none' ? comp.name : 'No companion')}</span></div>`;
        const tabs = host.querySelector('.locker-tabs');
        if (tabs) tabs.before(prev);
    }
    if (typeof window.lockerPanel === 'function') {
        const origLP = window.lockerPanel;
        window.lockerPanel = function () {
            const res = origLP.apply(this, arguments);
            try { injectLockerPreview(); } catch (e) { /* ok */ }
            return res;
        };
        window.lookPanel = function () { window.lockerPanel(); };
    }

    // ---- 10. Desktop Power-User Hotkeys & ? Cheat-Sheet ----
    window.showHotkeysModal = function () {
        showModal(`<h2>⌨️ Keyboard Shortcuts</h2>
            <div class="hotkey-grid">
                <div><kbd>E</kbd><span>End your turn</span></div>
                <div><kbd>A</kbd><span>Go to combat / All Attack</span></div>
                <div><kbd>R</kbd><span>Resolve / Pass priority</span></div>
                <div><kbd>Shift+Enter</kbd><span>Toggle Auto-pass turn</span></div>
                <div><kbd>Space</kbd><span>Skip opponent play-by-play</span></div>
                <div><kbd>L</kbd><span>Open / close Game Log</span></div>
                <div><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd><span>Switch opponent seat (4P Pod)</span></div>
                <div><kbd>Esc</kbd><span>Close sheet / modal</span></div>
            </div>
            <div class="row" style="justify-content:center; margin-top:12px;"><button class="btn primary" onclick="closeModal()">Got it</button></div>`);
    };
    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (!$('game') || $('game').classList.contains('hidden')) return;
        if (e.key === '?') { e.preventDefault(); window.showHotkeysModal(); return; }
        if ($('modalHost') && $('modalHost').innerHTML.trim()) return;
        const k = e.key.toLowerCase();
        if (k === 'e' && $('turnBtn') && !$('turnBtn').disabled && typeof endMyTurn === 'function') { e.preventDefault(); endMyTurn(); }
        else if (k === 'a') {
            if (typeof G !== 'undefined' && G && G.mode && G.mode.type === 'attack' && typeof allAttack === 'function') { e.preventDefault(); allAttack(); }
            else if (typeof G !== 'undefined' && G && G.phase === 'main1' && G.active === G.view && !G.busy && typeof goToCombat === 'function') { e.preventDefault(); goToCombat(); }
        }
        else if (k === 'r' && typeof G !== 'undefined' && G && G.mode && G.mode.type === 'respond' && typeof passPriority === 'function') { e.preventDefault(); passPriority(); }
        else if (k === 'l') {
            e.preventDefault();
            if (typeof toggleLog === 'function' && !isPhone()) toggleLog();
            else if (typeof logSheet === 'function') logSheet();
        }
    });
})();
