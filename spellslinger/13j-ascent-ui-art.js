// Planeswalker's Ascent, the rest of the art (2026-10-21, owner: "build out options for all of them"). Everything here is optional:
// each piece looks for its PNG once and uses it when it exists; without the file the game looks exactly as it did before.
//   spellslinger/art/ui/<id>.png        icons, badges, card back, backdrops (ids in ASCENT_ICONS, 13g-ascent-art-data.js)
//   spellslinger/art/fx/fx-<kind>.png   combat effects (ASCENT_FX_IDEAS): hit, die, heal, draw, counter, upgrade, pack open, win, lose
//   spellslinger/art/moods/<id>.png     3 expression stills per opponent (happy, angry, worried), 96 x 96 each
//   spellslinger/art/poses/<id>.png     win row and lose row per opponent, 16 frames of 96 x 96
const ASC_UI = { ok: {}, opp: {}, last: {} };
const ASC_MOODS = ['happy', 'angry', 'worried'];

// ---- Probing (called from ascProbeArt, 13h) ----
function ascExtraProbeTasks() {
    return [
        ...Object.keys(ASCENT_ICONS).map(async k => { ASC_UI.ok[k] = await ascProbe(`spellslinger/art/ui/${k}.png`); }),
        ...Object.keys(ASCENT_FX_IDEAS).map(async k => { ASC_FX_KINDS_ART[k] = await ascProbe(`spellslinger/art/fx/${k}.png`); })
    ];
}
// Moods and poses are looked for per opponent, when a game against them starts (and once per page load)
async function ascProbeOpp(id) {
    if (ASC_UI.opp[id]) return;
    ASC_UI.opp[id] = { moods: false, poses: false };
    const [m, p] = await Promise.all([ascProbe(`spellslinger/art/moods/${id}.png`), ascProbe(`spellslinger/art/poses/${id}.png`)]);
    ASC_UI.opp[id] = { moods: m, poses: p };
}
// Pushes found art into the page: header currency icons, the backdrop variables used by the stylesheet
function ascUiApply() {
    document.querySelectorAll('.cur[data-ico]').forEach(el => { const id = el.dataset.ico; if (ASC_UI.ok[id]) el.innerHTML = ascIco(id, '', 20); });
    const root = document.documentElement.style;
    for (const id of ['bg-tier-1', 'bg-tier-2', 'bg-tier-3', 'mat-table', 'card-frame-common', 'card-frame-rare', 'card-frame-mythic', 'mythic-flame', 'foil-sheen']) {
        if (ASC_UI.ok[id]) root.setProperty('--ui-' + id, `url('spellslinger/art/ui/${id}.png')`);
    }
    document.body.classList.toggle('asc-has-mat', !!ASC_UI.ok['mat-table']);
    document.body.classList.toggle('asc-has-frames', !!(ASC_UI.ok['card-frame-common'] || ASC_UI.ok['card-frame-rare'] || ASC_UI.ok['card-frame-mythic']));
}
// An icon image when its art exists, otherwise the fallback markup (usually the emoji used before)
function ascIco(id, fallback, px) {
    return ASC_UI.ok[id] ? `<img class="asc-ico" src="spellslinger/art/ui/${id}.png" alt="" aria-hidden="true" width="${px || 24}" height="${px || 24}">` : fallback;
}
function ascNodeDot(beaten, boss, locked, n) {
    if (beaten && ASC_UI.ok['node-beaten']) return ascIco('node-beaten', '', 26);
    if (locked && ASC_UI.ok['node-locked']) return ascIco('node-locked', '', 26);
    if (boss && ASC_UI.ok['node-boss']) return ascIco('node-boss', '', 26);
    return beaten ? '✓' : boss ? '👑' : n;
}

// ---- Combat effects: hit, die, heal, draw, counter (play only when the art exists) ----
const ASC_IDEA_MAP = { dies: 'fx-die', gainLife: 'fx-heal', loseLife: 'fx-hit', draw: 'fx-draw', countered: 'fx-counter' };
function ascBarRect(P) { const el = P === me() ? $('meBar') : $('oppBar'); return el ? el.getBoundingClientRect() : null; }
function ascIdeaFxHook(ev, ctx) {
    const kind = ASC_IDEA_MAP[ev];
    if (!kind || !ASC_FX_KINDS_ART[kind] || !ascFxEnabled() || !G || G.over) return;
    const now = performance.now();
    if (now - (ASC_UI.last[kind] || 0) < 350) return; // a burst of draws or hits plays one effect, not a pile
    let rect = null;
    if (ev === 'dies') {
        if (!ctx.o || !ctx.o.card || !isCreature(ctx.o)) return;
        const el = document.querySelector(`#game [data-uid="${ctx.o.uid}"]`); rect = el && el.getBoundingClientRect();
    } else if (ev === 'countered') rect = $('midBar') && $('midBar').getBoundingClientRect();
    else {
        if (!ctx.P || (ev === 'gainLife' || ev === 'loseLife') && !ctx.n) return;
        rect = ascBarRect(ctx.P);
    }
    if (!rect) return;
    ASC_UI.last[kind] = now;
    ascFxPlay(kind, null, rect);
}
// The opponent's mood follows what happens (used by the little face on its bar; no art needed to keep track)
function ascMoodNote(ev, ctx) {
    if (!G || !G.campaign || !G.campaign.ascent || ev !== 'loseLife' || !ctx || !ctx.P || ctx.P === me()) return;
    if (Math.abs(ctx.n || 0) >= 4) G.ascAngry = G.turn;
}

// ---- The opponent's face on its bar (a Planeswalker's Ascent game with art for that opponent) ----
function ascOppMood(P) {
    try {
        const F = me(), power = X => X.bf.filter(isCreature).reduce((a, o) => a + Math.max(0, pow(o)), 0);
        if (P.life <= 10 || power(F) >= P.life * 0.6) return 'worried';
        if (G.ascAngry && G.turn - G.ascAngry <= 1) return 'angry';
        if (P.life >= F.life + 8 || power(P) >= power(F) * 1.5 + 3) return 'happy';
    } catch (e) { /* a face must never break the table */ }
    return 'neutral';
}
function ascBarFace(P) {
    if (!G || !G.campaign || !G.campaign.ascent || P === me() || !G.campaign.node) return '';
    const id = G.campaign.node, c = ASCENT_CHAR[id], o = ASC_UI.opp[id] || {};
    if (!c) return '';
    const mood = ascOppMood(P), mi = ASC_MOODS.indexOf(mood);
    if (mi >= 0 && o.moods) return `<span class="asc-barface" role="img" aria-label="${esc(c.name)} looks ${mood}" title="${esc(c.name)} looks ${mood}" style="background-image:url('spellslinger/art/moods/${id}.png');background-position-x:${mi * -48}px"></span>`;
    const path = `spellslinger/art/characters/${id}.png`;
    if (ASC_ART.ok[path]) return `<span class="asc-barface idle" role="img" aria-label="${esc(c.name)}" title="${esc(c.name)}" style="background-image:url('${path}');--cols:${ASC_ART.cols[path] || 4};--idle:${((ASC_ART.cols[path] || 4) / 12).toFixed(2)}s"></span>`;
    return '';
}

// ---- The result screen: the opponent's win or lose pose, and the victory or defeat banner ----
function ascResultFlair(won) {
    if (!G || !G.campaign || !G.campaign.ascent || !G.campaign.node) return '';
    const id = G.campaign.node, o = ASC_UI.opp[id] || {};
    if (ASC_FX_KINDS_ART[won ? 'fx-win' : 'fx-lose'] && ascFxEnabled()) setTimeout(() => ascFxPlay(won ? 'fx-win' : 'fx-lose', null, { left: innerWidth / 2 - 1, top: innerHeight * 0.3, width: 2, height: 2 }), 250);
    if (!o.poses) return '';
    // you won: the opponent's lose pose (row 2); you lost: its win pose (row 1)
    return `<div class="asc-pose-wrap"><div class="asc-pose" role="img" aria-label="${esc((ASCENT_CHAR[id] || {}).name || 'Opponent')} ${won ? 'accepts the loss' : 'celebrates'}" style="background-image:url('spellslinger/art/poses/${id}.png');--prow:${won ? 1 : 0}"></div></div>`;
}

// Upgrade applied: the anvil strike over the upgrade dialog's card (called from the upgrade buttons)
function ascUpgradeFlair() {
    if (!ASC_FX_KINDS_ART['fx-upgrade'] || !ascFxEnabled()) return;
    ascFxPlay('fx-upgrade', null, { left: innerWidth / 2 - 1, top: innerHeight * 0.4, width: 2, height: 2 });
}
// Pack tear: the generic burst over the pack (the per-look bursts of 12b play too when they exist)
function ascPackFlair() {
    if (!ASC_FX_KINDS_ART['fx-pack-open'] || !ascFxEnabled()) return;
    const el = document.querySelector('#ascReveal .pack3d'), r = el && el.getBoundingClientRect();
    if (r) ascFxPlay('fx-pack-open', null, r);
}
