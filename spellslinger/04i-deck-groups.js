// Commander decks grouped by color (2026-11-24, owner: "grouping the commander decks together ... selectable by WUBRG color order ... collapsable while also differentiating between
// user created decks and actual verified pre-cons"). One shared view for every list of Commander decks: the Decks tab, the Play tab's deck grid, the Ready decks opponent tab and the
// starter picker. Groups follow WUBRG order (colorless, mono W U B R G, the ten pairs, the ten trios, four colors, five), each one folds, and every deck carries a badge:
//   🏷️ Official precon (a real product: the Commander precons of FDC, FRC, MSC, SOC and Star Trek), ✅ Verified list (a list checked card by card, not a product),
//   🎁 Starter (a generated deck, such as an EDHREC average deck) and 🛠️ Yours (built or imported by a person).
const DG_OFFICIAL = new Set(['giada', 'sai', 'lathliss', 'ghalta', 'gisa', 'jace-multiverse', 'captain-america', 'doctor-doom', 'invisible-woman', 'tchalla', 'quintorius', 'rootha', 'zimone', 'killian', 'dina', 'trk_federation', 'trk_landing', 'trk_klingon', 'trk_borg']);
const DG_KINDS = [['all', 'All'], ['official', '🏷️ Official precons'], ['verified', '✅ Verified lists'], ['starter', '🎁 Starters'], ['yours', '🛠️ Yours']];
const DG_BADGE = { official: ['🏷️ Official precon', 'A real Commander precon product'], verified: ['✅ Verified list', 'A list checked card by card (not a product)'], starter: ['🎁 Starter', 'A generated starter deck'], yours: ['🛠️ Yours', 'Built or imported by a player'] };
const DG_WUBRG = ['W', 'U', 'B', 'R', 'G'];
const DG_GROUPS = [['', 'Colorless'], ['W', 'White'], ['U', 'Blue'], ['B', 'Black'], ['R', 'Red'], ['G', 'Green'],
    ['WU', 'Azorius (W U)'], ['UB', 'Dimir (U B)'], ['BR', 'Rakdos (B R)'], ['RG', 'Gruul (R G)'], ['WG', 'Selesnya (G W)'],
    ['WB', 'Orzhov (W B)'], ['UR', 'Izzet (U R)'], ['BG', 'Golgari (B G)'], ['WR', 'Boros (R W)'], ['UG', 'Simic (G U)'],
    ['WUB', 'Esper (W U B)'], ['UBR', 'Grixis (U B R)'], ['BRG', 'Jund (B R G)'], ['WRG', 'Naya (R G W)'], ['WUG', 'Bant (G W U)'],
    ['WBR', 'Mardu (R W B)'], ['URG', 'Temur (G U R)'], ['WBG', 'Abzan (W B G)'], ['WUR', 'Jeskai (U R W)'], ['UBG', 'Sultai (B G U)'],
    ['UBRG', 'Four colors: no white'], ['WBRG', 'Four colors: no blue'], ['WURG', 'Four colors: no black'], ['WUBG', 'Four colors: no red'], ['WUBR', 'Four colors: no green'],
    ['WUBRG', 'Five colors']];
const DG = { state: {}, items: {}, wrap: {} };
function dgState(ctx) { if (!DG.state[ctx]) DG.state[ctx] = { kind: 'all', cols: [], closed: store.get('dgClosed:' + ctx, null), all: null }; return DG.state[ctx]; }
function dgKey(colors) { const s = new Set(colors || []); return DG_WUBRG.filter(c => s.has(c)).join(''); }
// What kind of deck a player's saved deck is: a starter made from a verified list keeps the list's name
function dgDeckKind(d) {
    const v = typeof VERIFIED_DECKS !== 'undefined' && VERIFIED_DECKS.find(x => d.srcKey === x.key || d.name === `${x.name} (starter)`);
    if (v) return DG_OFFICIAL.has(v.key) ? 'official' : 'verified';
    return d.starter ? 'starter' : 'yours';
}
function dgVerifiedKind(v) { return DG_OFFICIAL.has(v.key) ? 'official' : 'verified'; }
function dgBadge(kind) { const b = DG_BADGE[kind]; return b ? `<span class="dg-badge k-${kind}" title="${esc(b[1])}">${b[0]}</span>` : ''; }
// items: [{ colors, kind, html }]; the wrapper is redrawn from `itemsFn` when a chip or the fold buttons are used
function dgView(ctx, itemsFn, opts = {}) {
    DG.items[ctx] = itemsFn; DG.wrap[ctx] = opts;
    return `<div id="dg-${ctx}" class="dg">${dgInner(ctx)}</div>`;
}
function dgInner(ctx) {
    const st = dgState(ctx), opts = DG.wrap[ctx] || {}, items = DG.items[ctx]() || [];
    const kinds = {}; items.forEach(it => { kinds[it.kind] = (kinds[it.kind] || 0) + 1; });
    const shown = items.filter(it => (st.kind === 'all' || it.kind === st.kind) && st.cols.every(c => c === 'C' ? !dgKey(it.colors) : (it.colors || []).includes(c)) && (!st.cols.includes('C') || !dgKey(it.colors)));
    const groups = {}; shown.forEach(it => { const k = dgKey(it.colors); (groups[k] = groups[k] || []).push(it); });
    const total = shown.length, defClosed = total > 12;
    const closed = k => (st.closed && Object.prototype.hasOwnProperty.call(st.closed, k) ? st.closed[k] : defClosed);
    const kindChips = DG_KINDS.filter(([k]) => k === 'all' || kinds[k]).map(([k, label]) => `<button type="button" class="chip${st.kind === k ? ' on' : ''}" aria-pressed="${st.kind === k}" onclick="dgKind('${ctx}','${k}')">${label}${k === 'all' ? ` ${items.length}` : ` ${kinds[k]}`}</button>`).join('');
    const colChips = [...DG_WUBRG, 'C'].map(c => `<button type="button" class="chip dg-col${st.cols.includes(c) ? ' on' : ''}" aria-pressed="${st.cols.includes(c)}" aria-label="${c === 'C' ? 'Colorless' : c}" title="${c === 'C' ? 'Colorless' : ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' })[c]}" onclick="dgCol('${ctx}','${c}')"><i style="background:var(--mana-${c})"></i>${c === 'C' ? '' : c}</button>`).join('');
    const body = DG_GROUPS.filter(([k]) => groups[k]).map(([k, name]) => {
        const g = groups[k], pips = (k ? k.split('') : ['C']).map(c => `<i style="background:var(--mana-${c})"></i>`).join('');
        return `<details class="dg-group"${closed(k) ? '' : ' open'} ontoggle="dgToggle('${ctx}','${k}',this.open)"><summary><span class="dg-pips">${pips}</span> <strong>${esc(name)}</strong> <span class="note">${g.length} deck${g.length === 1 ? '' : 's'}</span></summary>
            <div class="${opts.grid ? 'opp-grid' + (opts.gridClass ? ' ' + opts.gridClass : '') : 'dg-rows'}">${g.map(it => it.html).join('')}</div></details>`;
    }).join('');
    return `<div class="dg-bar"><div class="chips" role="group" aria-label="Deck kind">${kindChips}</div>
        <div class="chips" role="group" aria-label="Colors (WUBRG)">${colChips}</div>
        <div class="row" style="gap:6px;"><button type="button" class="btn small" onclick="dgAll('${ctx}', true)">Expand all</button><button type="button" class="btn small" onclick="dgAll('${ctx}', false)">Collapse all</button>${st.cols.length || st.kind !== 'all' ? `<button type="button" class="btn small" onclick="dgClear('${ctx}')">Show everything</button>` : ''}</div></div>
        ${body || '<p class="note">No deck matches those filters.</p>'}`;
}
function dgRedraw(ctx) { const el = $('dg-' + ctx); if (el && DG.items[ctx]) el.innerHTML = dgInner(ctx); }
function dgSave(ctx) { const st = dgState(ctx); store.set('dgClosed:' + ctx, st.closed); }
function dgKind(ctx, k) { dgState(ctx).kind = k; dgRedraw(ctx); }
function dgCol(ctx, c) { const st = dgState(ctx), i = st.cols.indexOf(c); if (i >= 0) st.cols.splice(i, 1); else { if (c === 'C') st.cols = ['C']; else st.cols = st.cols.filter(x => x !== 'C').concat(c); } dgRedraw(ctx); }
function dgClear(ctx) { const st = dgState(ctx); st.kind = 'all'; st.cols = []; dgRedraw(ctx); }
function dgToggle(ctx, k, open) { const st = dgState(ctx); st.closed = st.closed || {}; if (st.closed[k] === !open) return; st.closed[k] = !open; dgSave(ctx); }
function dgAll(ctx, open) { const st = dgState(ctx); st.closed = {}; DG_GROUPS.forEach(([k]) => { st.closed[k] = !open; }); dgSave(ctx); dgRedraw(ctx); }
