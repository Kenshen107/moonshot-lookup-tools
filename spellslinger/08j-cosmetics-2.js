// Cosmetics, part 2 (2026-11-28, Antigravity's Batches 3 to 5; plan in docs/spellslinger-asset-plan.md, sections 3 and 10):
//  - Painted themes: three Looks (Gilded Sanctum, Emberforge, Tidecrown) with their own colors (html[data-theme] blocks in styles.css), a page
//    background (themes/<id>/bg.jpg, bg-phone.jpg on portrait screens), the Home banner (banner.jpg) and, for Gilded Sanctum, its own panel frame.
//    They are bought in the Locker's Looks tab like the other cosmetics (Epic, main-bucket coins).
//  - Desk props: a life-counter skin (a d20 or a brass dial behind your life total) and an hourglass that turns over at the start of your turn.
//  - Moving playmat layers: mats/<mat>/layer-*.png laid over the painting and animated by CSS (lantern glow, waves, flames, swaying vines).
// Everything reads only theme tokens and the art files; nothing changes how a game plays. Off in autoplay and the lab where it moves.

// ---- Painted themes ----
const PAINTED_THEMES = [
    { key: 'gilded', id: 'theme-gilded', dir: 'gilded-sanctum', icon: '🏛️', name: 'Gilded Sanctum', note: 'Navy stone, brushed gold and a glowing crystal.', frame: 'own', rarity: 'epic' },
    { key: 'emberforge', id: 'theme-emberforge', dir: 'emberforge', icon: '⚒️', name: 'Emberforge', note: 'A dwarven forge: copper, coals and sparks.', frame: 'autumn', rarity: 'epic' },
    { key: 'tidecrown', id: 'theme-tidecrown', dir: 'tidecrown', icon: '🌊', name: 'Tidecrown', note: 'A sunken palace under deep blue water.', frame: 'winter', rarity: 'epic' }
];
const themeArtUrl = (dir, file) => { try { return new URL(`spellslinger/art/themes/${dir}/${file}`, document.baseURI).href; } catch (e) { return `spellslinger/art/themes/${dir}/${file}`; } };
PAINTED_THEMES.forEach(t => {
    if (!SP_LOOKS.some(l => l.key === t.key)) SP_LOOKS.push({ key: t.key, icon: t.icon, name: t.name, frame: t.frame === 'own' ? 'default' : t.frame, note: t.note, painted: t });
    if (!cosItem(t.id)) COSMETICS.push({ id: t.id, slot: 'theme', rarity: t.rarity, name: t.name, note: t.note, look: t.key, thumb: `spellslinger/art/themes/${t.dir}/banner.jpg` });
});
function lookOwned(key) { const l = spLookInfo(key); return !l.painted || cosOwns(l.painted.id); }
{
    const baseApply = applyLook;
    applyLook = function () {
        if (!lookOwned(spLook.name)) spLook.name = 'classic'; // a painted look this player hasn't bought (another player's save on the same device)
        baseApply.apply(this, arguments);
        const root = document.documentElement, info = spLookInfo(spLook.name), t = info.painted;
        if (t) {
            root.setAttribute('data-theme-art', t.key);
            root.style.setProperty('--theme-bg', `url('${themeArtUrl(t.dir, 'bg.jpg')}')`);
            root.style.setProperty('--theme-bg-phone', `url('${themeArtUrl(t.dir, 'bg-phone.jpg')}')`);
            root.style.setProperty('--theme-banner', `url('${themeArtUrl(t.dir, 'banner.jpg')}')`);
            if (t.frame === 'own') { root.style.setProperty('--sp-frame', `url('${themeArtUrl(t.dir, 'frame.png')}')`); root.style.setProperty('--sp-frame-slice', '24'); root.style.setProperty('--sp-frame-w', '16px'); }
            else { root.style.removeProperty('--sp-frame-slice'); root.style.removeProperty('--sp-frame-w'); }
        } else {
            root.removeAttribute('data-theme-art');
            ['--theme-bg', '--theme-bg-phone', '--theme-banner', '--sp-frame-slice', '--sp-frame-w'].forEach(k => root.style.removeProperty(k));
        }
    };
    const baseSet = setLook;
    setLook = function (key, frames) {
        if (key != null && !lookOwned(key)) { cosBuy(spLookInfo(key).painted.id); return; }
        return baseSet.apply(this, arguments);
    };
    const baseTab = looksTabHTML;
    looksTabHTML = function () {
        let h = baseTab.apply(this, arguments);
        // painted looks show their banner as the swatch, and a price until bought
        PAINTED_THEMES.forEach(t => {
            const owned = cosOwns(t.id), c = cosItem(t.id);
            h = h.replace(new RegExp(`(<button type="button" class="look-card[^"]*" data-look="${t.key}"[^>]*>)<span class="look-sw" aria-hidden="true"></span>`),
                `$1<span class="look-sw painted" aria-hidden="true" style="background-image:url('${themeArtUrl(t.dir, 'banner.jpg')}')"></span>`);
            if (!owned) h = h.replace(new RegExp(`(data-look="${t.key}"[^>]*>[\\s\\S]*?<small>[^<]*</small>)`), `$1<span class="look-price">${cosConfirm && cosConfirm.id === t.id && Date.now() <= cosConfirm.until ? 'Tap again to buy · ' : ''}🪙 ${cosPrice(c).toLocaleString()}</span>`)
                .replace(`class="look-card" data-look="${t.key}"`, `class="look-card locked" data-look="${t.key}"`);
        });
        return h;
    };
    const baseEquip = cosEquip;
    cosEquip = function (id, deckName) {
        const c = cosItem(id);
        if (c && c.slot === 'theme') { if (cosOwns(id)) { spLook.name = c.look; store.set('look', spLook); applyLook(); } lockerPanel(); return; }
        if (c && (c.slot === 'lifeskin' || c.slot === 'desk')) {
            if (!cosOwns(id)) return;
            const s = cosState(); s[c.slot] = id; saveProfile(); deskSync(); lockerPanel(); return;
        }
        return baseEquip.apply(this, arguments);
    };
    // A saved painted look was read before this file added it: read it again now
    try { const saved = store.get('look'); if (saved && saved.name && SP_LOOKS.some(l => l.key === saved.name)) { spLook = { name: saved.name, frames: saved.frames !== false }; applyLook(); } } catch (e) { /* keep the current look */ }
}

// ---- Desk props ----
const DESK_PROPS = [
    { id: 'lifeskin-none', slot: 'lifeskin', rarity: 'free', name: 'Plain life total', note: 'No counter behind your life.' },
    { id: 'life-d20', slot: 'lifeskin', rarity: 'rare', name: 'Sapphire d20', note: 'A blue and gold d20 behind your life total. It rolls when your life changes.', img: 'spellslinger/art/props/life-d20.png' },
    { id: 'life-dial', slot: 'lifeskin', rarity: 'rare', name: 'Brass Dial', note: 'A clockwork dial behind your life total. Its gears turn when your life changes.', img: 'spellslinger/art/props/life-dial.png' },
    { id: 'desk-none', slot: 'desk', rarity: 'free', name: 'Clear desk', note: 'Nothing on the table.' },
    { id: 'hourglass', slot: 'desk', rarity: 'common', name: 'Hourglass', note: 'Sits by your seat and turns over at the start of each of your turns.', img: 'spellslinger/art/props/hourglass.png' }
];
DESK_PROPS.forEach(p => { if (!cosItem(p.id)) COSMETICS.push(p); });
const propUrl = p => { try { return new URL(p.img, document.baseURI).href; } catch (e) { return p.img; } };
{
    const baseState = cosState;
    cosState = function () {
        const s = baseState.apply(this, arguments);
        if (!s.lifeskin || !cosItem(s.lifeskin)) s.lifeskin = 'lifeskin-none';
        if (!s.desk || !cosItem(s.desk)) s.desk = 'desk-none';
        return s;
    };
}
if (!LOCKER_TABS.some(t => t[0] === 'props')) LOCKER_TABS.splice(LOCKER_TABS.findIndex(t => t[0] === 'soon'), 0, ['props', '🎲', 'Props']);
function propsTabHTML() {
    const s = cosState();
    const card = c => cosCard(c, s[c.slot] === c.id, c.img ? `<span class="cos-prop"><img src="${c.img}" alt=""></span>` : '<span class="cos-comp none">∅</span>');
    return `<p class="note">Things for your side of the table. A life-counter skin sits behind your life total; a desk prop sits by your seat.</p>
        <h4>Life counter</h4><div class="cos-grid">${DESK_PROPS.filter(c => c.slot === 'lifeskin').map(card).join('')}</div>
        <h4>On the desk</h4><div class="cos-grid">${DESK_PROPS.filter(c => c.slot === 'desk').map(card).join('')}</div>`;
}
{
    const baseLocker = lockerPanel;
    lockerPanel = function (tab) {
        if (tab) LOCKER_TAB = tab;
        if (LOCKER_TAB !== 'props') return baseLocker.apply(this, arguments);
        // draw the Locker with another tab's body, then swap in the props
        LOCKER_TAB = 'looks'; baseLocker(); LOCKER_TAB = 'props';
        const box = document.querySelector('#modalHost .locker'); if (!box) return;
        box.dataset.tab = 'props';
        box.querySelectorAll('.locker-tab').forEach(b => { const on = /Props/.test(b.textContent); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
        box.querySelector('.locker-body').innerHTML = propsTabHTML();
    };
}
// Turns lift the life skin's roll and the hourglass's flip off the game state (read, not hooked)
const DESK = { life: null, turnKey: null, flips: 0, el: null };
function deskOn() { return typeof G !== 'undefined' && G && G.players && (!(typeof AUTOPLAY !== 'undefined' && AUTOPLAY) || window.__COMP_FORCE) && !window.__LAB; }
function deskSync() {
    const game = document.getElementById('game'); if (!game) return;
    const s = profile ? cosState() : { lifeskin: 'lifeskin-none', desk: 'desk-none' };
    const skin = cosItem(s.lifeskin), on = deskOn() && !game.classList.contains('hidden');
    if (on && skin && skin.img) { game.classList.add('has-lifeskin'); game.dataset.lifeskin = skin.id; game.style.setProperty('--lifeskin', `url('${propUrl(skin)}')`); }
    else { game.classList.remove('has-lifeskin'); delete game.dataset.lifeskin; }
    if (on && skin && skin.img && G.players[0]) {
        const life = G.players[0].life;
        if (DESK.life != null && life !== DESK.life) { const el = game.querySelector('#meBar .life'); if (el) { el.classList.remove('skin-roll'); void el.offsetWidth; el.classList.add('skin-roll'); } }
        DESK.life = life;
    }
    const desk = cosItem(s.desk);
    if (!on || !desk || !desk.img) { if (DESK.el) { DESK.el.remove(); DESK.el = null; } return; }
    if (!DESK.el || !DESK.el.isConnected) {
        DESK.el = document.createElement('div'); DESK.el.id = 'deskProp'; DESK.el.setAttribute('aria-hidden', 'true');
        DESK.el.innerHTML = `<img src="${desk.img}" alt="">`; game.appendChild(DESK.el);
    }
    // the hourglass turns over when your turn starts
    const mine = G.active === G.view, key = `${G.turn}:${mine}`;
    if (mine && DESK.turnKey !== key && DESK.turnKey != null) DESK.flips++;
    DESK.turnKey = key;
    DESK.el.style.setProperty('--flip', `${DESK.flips * 180}deg`);
    DESK.el.classList.toggle('turn', mine);
    deskPlace();
}
// A free spot by your seat that covers no card, button or counter (and not the companion)
function deskPlace() {
    const el = DESK.el; if (!el) return;
    const phone = innerWidth <= 600, W = phone ? 30 : 46, H = Math.round(W * 1.0);
    const bar = document.getElementById('meBar'), br = bar ? bar.getBoundingClientRect() : null;
    const av = bar && (bar.querySelector('.life') || bar.querySelector('.arena-av')), ar = av ? av.getBoundingClientRect() : null;
    const cands = [];
    if (ar && ar.width) cands.push([ar.left - W - 10, ar.top + (ar.height - H) / 2], [ar.right + 10, ar.top + (ar.height - H) / 2], [ar.left - W - 70, ar.top + (ar.height - H) / 2]);
    if (br && br.width) { const top = br.top - H - 4; cands.push([8, top], [innerWidth - W - 8, top]); }
    const avoid = (typeof COMP_AVOID === 'string' ? COMP_AVOID + ', ' : '') + '#companionDock';
    const obst = [...document.querySelectorAll(avoid)].map(e => e.getBoundingClientRect()).filter(b => b.width && b.height);
    const free = ([x, y]) => x >= 0 && y >= 0 && x + W <= innerWidth && y + H <= innerHeight && obst.every(b => b.right <= x + 2 || b.left >= x + W - 2 || b.bottom <= y + 2 || b.top >= y + H - 2);
    const spot = cands.find(free);
    el.style.width = `${W}px`; el.style.height = `${H}px`;
    if (spot) { el.style.left = `${Math.round(spot[0])}px`; el.style.top = `${Math.round(spot[1])}px`; el.classList.remove('ducked'); } else el.classList.add('ducked');
}

// ---- Moving playmat layers ----
const MAT_LAYERS = { sanctum: 'lights', island: 'water', mountain: 'fire', forest: 'foliage' };
const MAT_LAYER_OK = {}; // mat -> true once its layer picture has loaded
function matLayerSync() {
    const game = document.getElementById('game'); if (!game) return;
    let el = document.getElementById('matLayer');
    const mat = game.getAttribute('data-mat') || 'sanctum', kind = MAT_LAYERS[mat];
    if (!kind || !game.classList.contains('open-board')) { if (el) el.hidden = true; return; }
    if (!el) {
        el = document.createElement('div'); el.id = 'matLayer'; el.className = 'mat-layer'; el.setAttribute('aria-hidden', 'true');
        const motes = document.getElementById('arenaMotes');
        if (motes && motes.parentNode === game) motes.insertAdjacentElement('beforebegin', el); else game.insertBefore(el, game.firstChild);
    }
    const src = `spellslinger/art/mats/${mat}/layer-${kind}.png`;
    if (el.dataset.src !== src) {
        el.dataset.src = src; el.dataset.kind = kind; el.hidden = true;
        if (MAT_LAYER_OK[src]) { el.style.backgroundImage = `url('${new URL(src, document.baseURI).href}')`; el.hidden = false; }
        else { const im = new Image(); im.onload = () => { MAT_LAYER_OK[src] = true; if (el.dataset.src === src) { el.style.backgroundImage = `url('${im.src}')`; el.hidden = false; } }; im.src = new URL(src, document.baseURI).href; }
    } else if (MAT_LAYER_OK[src]) el.hidden = false;
}
{
    const baseRender = renderGame;
    renderGame = function () { const r = baseRender.apply(this, arguments); try { matLayerSync(); deskSync(); } catch (e) { /* never break the table */ } return r; };
}
setInterval(() => { try { if (typeof G !== 'undefined' && G && document.getElementById('game') && !document.getElementById('game').classList.contains('hidden')) { matLayerSync(); deskSync(); } } catch (e) { /* ignore */ } }, 1500);
addEventListener('resize', () => { try { deskPlace(); } catch (e) { /* ignore */ } });
