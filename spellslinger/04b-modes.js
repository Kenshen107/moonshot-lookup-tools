// =====================================================================
// Three game modes (Phase 4 of docs/spellslinger-overhaul-plan.md, 2026-10-08)
//
// Sandbox, Campaign and Shop Simulator. Owner's answers (2026-10-08): one shared collection (cards and decks are the
// same in every mode); the money and the win/loss record are kept per mode; today's coins, cash, wins and losses
// stay with Campaign / Shop, and Sandbox starts fresh.
//
// How it works: the game's code keeps reading and writing profile.coins / usd / wins / losses / freePacks, so
// nothing else had to change. Those fields always belong to the ACTIVE bucket. Campaign and Shop share the 'main'
// bucket (Campaign pays cash and entry fees that the Shop uses); Sandbox has its own. Switching between buckets
// parks the current values in profile.stash and loads the other bucket's (setMode / swapBucket).
// =====================================================================
const MODE_FIELDS = ['coins', 'usd', 'wins', 'losses', 'freePacks'];
const MODES = {
    sandbox: { icon: '🧪', name: 'Sandbox', bucket: 'sandbox', views: ['home', 'packs', 'decks', 'play', 'precons', 'draft', 'welcome', 'rules'],
        desc: 'Try anything: open packs, build decks, play any opponent, draft. Its coins and record are separate from Campaign and Shop.' },
    campaign: { icon: '🗺️', name: 'Campaign', bucket: 'main', views: ['home', 'packs', 'decks', 'campaign', 'rules'],
        desc: 'Climb the ladder from the Kitchen Table to the Regional Qualifier. Each tier has a deck-value limit.' },
    shop: { icon: '🏪', name: 'Shop Simulator', bucket: 'main', views: ['home', 'decks', 'shop', 'dist', 'rules'],
        desc: 'Run the card shop: the case, the distributor, the stockroom and grading.' }
};
function modeKey() { return profile && MODES[profile.mode] ? profile.mode : 'campaign'; }
function modeAllows(view) { return MODES[modeKey()].views.includes(view); }
function sandboxStart() { return { coins: START_COINS, usd: SHOP_START_USD, wins: 0, losses: 0, freePacks: 3 }; }
function swapBucket(to) {
    if (!profile.stash) profile.stash = {};
    const from = profile.bucket || 'main';
    if (from === to) return;
    const parked = {};
    MODE_FIELDS.forEach(k => { parked[k] = profile[k]; });
    profile.stash[from] = parked;
    const next = profile.stash[to] || (to === 'sandbox' ? sandboxStart() : null);
    delete profile.stash[to];
    if (next) MODE_FIELDS.forEach(k => { profile[k] = next[k] !== undefined ? next[k] : (sandboxStart()[k]); });
    profile.bucket = to;
}
function setMode(m, opts) {
    if (!MODES[m] || !profile) return;
    if (editing && m !== modeKey() && !confirm('Switch mode? Unsaved changes to the deck you are building will be lost.')) return;
    if (m !== modeKey()) { editing = null; pauseShop(); SHOP.queue = []; SHOP.log = []; }
    swapBucket(MODES[m].bucket);
    profile.mode = m;
    saveProfile();
    renderCoins();
    applyModeUI(true);
    if (opts && opts.quiet) return;
    const cur = VIEWS.find(k => !$(`view-${k}`).classList.contains('hidden')) || 'home';
    showView(opts && opts.view ? opts.view : modeAllows(cur) ? cur : 'home');
}
let modeUIKey = '';
function applyModeUI(force) {
    if (!profile) return;
    const m = modeKey(), key = m + '|' + (isPhone() ? 'p' : 'd');
    if (!force && key === modeUIKey) return;
    modeUIKey = key;
    VIEWS.forEach(k => { const t = $(`tab-${k}`); if (t) t.classList.toggle('hidden', !modeAllows(k)); });
    document.querySelectorAll('.bottom-nav [data-v]').forEach(b => {
        const v = b.dataset.v;
        b.classList.toggle('hidden', v === 'more' ? !MORE_VIEWS.some(([k]) => modeAllows(k)) : !modeAllows(v));
    });
    document.querySelectorAll('[data-needs]').forEach(el => el.classList.toggle('hidden', !modeAllows(el.dataset.needs)));
    document.querySelectorAll('[data-modes]').forEach(el => el.classList.toggle('hidden', !el.dataset.modes.split(' ').includes(m)));
    const bar = $('modeBar');
    if (bar) {
        bar.innerHTML = Object.entries(MODES).map(([k, v]) => `<button type="button" class="mode-btn" role="tab" aria-selected="${k === m}" onclick="setMode('${k}')" title="${esc(v.desc)}">${v.icon} ${esc(v.name)}</button>`).join('')
            + `<span class="note mode-desc">${esc(MODES[m].desc)}</span>`;
    }
}
// The cash pill opens the Shop; in the other modes it only shows the number
function cashPillClick() { if (modeAllows('shop')) showView('shop'); else toast(`💵 This is ${MODES[modeKey()].name} cash. The Shop is in Shop Simulator mode.`); }

// Campaign deck-value limits (owner's decision 5): a tier's deck must be worth at least minValue and at most maxValue.
function campaignDeckProblem(t, value) {
    if (t.minValue && value < t.minValue) return `This tier needs a deck worth ${usd(t.minValue)} or more.`;
    if (t.maxValue && value > t.maxValue) return `This tier allows decks worth up to ${usd(t.maxValue)} (yours is ${usd(value)}). Try a higher tier.`;
    return null;
}
