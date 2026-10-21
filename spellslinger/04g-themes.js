// Looks and frames (2026-10-21, owner: "themes and frames updated for Spellslinger Duels"; a picker you choose, panel frames from the MTG tool's art).
// A look only changes the color tokens (html[data-theme] blocks in styles.css); the frames are the pixel 9-slice pictures in art/site/frame-panel-<name>.png
// drawn over panels and dialogs (html[data-frames="on"]). The choice is saved with the other game data (store key `look`) and mirrored in localStorage as
// `spLook`, so the tiny script in <head> can set it before the first paint. Classic is the original look and has no overrides.
const SP_LOOKS = [
    { key: 'classic', icon: '🪄', name: 'Classic', frame: 'default', note: 'The original dark teal.' },
    { key: 'dungeon', icon: '🕯️', name: 'Dungeon', frame: 'halloween', note: 'Candlelit purple stone.' },
    { key: 'ember', icon: '🔥', name: 'Ember', frame: 'autumn', note: 'Warm coals and copper.' },
    { key: 'frost', icon: '❄️', name: 'Frost', frame: 'winter', note: 'Cold blue ice.' },
    { key: 'yule', icon: '🎄', name: 'Yule', frame: 'christmas', note: 'Pine green and holly red.' },
    { key: 'grove', icon: '🌿', name: 'Grove', frame: 'spring', note: 'Deep forest greens.' },
    { key: 'royal', icon: '👑', name: 'Royal', frame: 'newyear', note: 'Dark with gold.' }
];
let spLook = { name: 'classic', frames: true };
function spLookInfo(key) { return SP_LOOKS.find(l => l.key === key) || SP_LOOKS[0]; }
function applyLook() {
    const root = document.documentElement, info = spLookInfo(spLook.name);
    if (info.key === 'classic') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', info.key);
    root.setAttribute('data-frames', spLook.frames ? 'on' : 'off');
    root.style.setProperty('--sp-frame', `url('../art/site/frame-panel-${info.frame}.png')`);
    try { localStorage.setItem('spLook', JSON.stringify({ name: info.key, frames: !!spLook.frames })); } catch (e) { /* this session only */ }
}
function setLook(key, frames) {
    if (key != null) spLook.name = spLookInfo(key).key;
    if (frames != null) spLook.frames = !!frames;
    store.set('look', spLook);
    applyLook();
    if (document.querySelector('#modalHost .looks')) lookPanel();
}
function lookPanel() {
    showModal(`<div class="looks"><h2>🎨 Looks and frames</h2>
        <p class="note">Pick a look. It changes the colors of the whole game and is saved on this device. Frames draw a pixel border around panels and dialogs.</p>
        <div class="look-grid">${SP_LOOKS.map(l => `<button type="button" class="look-card${l.key === spLook.name ? ' on' : ''}" data-look="${l.key}" onclick="setLook('${l.key}')" aria-pressed="${l.key === spLook.name}"><span class="look-sw" aria-hidden="true"></span><strong>${l.icon} ${l.name}</strong><small>${l.note}</small></button>`).join('')}</div>
        <label class="look-frames"><input type="checkbox" ${spLook.frames ? 'checked' : ''} onchange="setLook(null, this.checked)"> Show pixel frames</label>
        <div class="row" style="justify-content:center; margin-top:12px;"><button class="btn primary" onclick="closeModal()">Done</button></div></div>`);
}
(function initLook() {
    const saved = store.get('look');
    if (saved && saved.name) spLook = { name: spLookInfo(saved.name).key, frames: saved.frames !== false };
    applyLook();
})();
