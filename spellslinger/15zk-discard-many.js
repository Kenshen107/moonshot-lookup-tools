// Discard down to hand size in one panel (2026-11-25, owner: "Add multi-select discard for hand size"; the pod record had 12 and 14 one-at-a-time prompts).
// Identical cards share a row with a - / + stepper; Discard unlocks when exactly the right number is chosen. Returns the chosen cards (a list of game objects).
function pickDiscardMany(P, need) {
    return new Promise(resolve => {
        const groups = []; const by = {};
        P.hand.forEach(o => { const k = o.card.name; if (!by[k]) { by[k] = { name: k, cmc: o.card.cmc || 0, objs: [], n: 0 }; groups.push(by[k]); } by[k].objs.push(o); });
        groups.sort((a, b) => b.cmc - a.cmc || a.name.localeCompare(b.name));
        const total = () => groups.reduce((a, g) => a + g.n, 0);
        const draw = () => {
            const t = total();
            const rows = groups.map((g, i) => `<div class="row" style="gap:8px; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border-subtle);">
                <span style="flex:1;${g.n ? ' font-weight:700;' : ''}">${esc(g.name)} <span class="note">${g.cmc ? `mv ${g.cmc}` : ''}${g.objs.length > 1 ? ` · you hold ${g.objs.length}` : ''}</span></span>
                <button class="btn small" ${g.n ? '' : 'disabled'} onclick="__ddStep(${i}, -1)" aria-label="Fewer ${esc(g.name)}">−</button>
                <span style="min-width:2ch; text-align:center;">${g.n}</span>
                <button class="btn small" ${g.n < g.objs.length && t < need ? '' : 'disabled'} onclick="__ddStep(${i}, 1)" aria-label="More ${esc(g.name)}">+</button></div>`).join('');
            const host = $('modalHost'); const box = host && host.querySelector('#ddBody');
            const html = `<p class="note">Choose ${need} card${need === 1 ? '' : 's'} to discard: <b>${t} / ${need}</b></p><div style="max-height:55vh; overflow:auto;">${rows}</div>
                <div class="row" style="justify-content:center; gap:8px; margin-top:12px;"><button class="btn" onclick="__ddAuto()">Pick for me (most expensive)</button><button class="btn primary" id="ddOk" ${t === need ? '' : 'disabled'} onclick="__ddOk()">Discard ${need}</button></div>`;
            if (box) box.innerHTML = html;
        };
        window.__ddStep = (i, d) => { const g = groups[i]; g.n = Math.max(0, Math.min(g.objs.length, g.n + d)); draw(); };
        window.__ddAuto = () => { groups.forEach(g => { g.n = 0; }); let left = need; for (const g of groups) { const k = Math.min(g.objs.length, left); g.n = k; left -= k; if (!left) break; } draw(); };
        window.__ddOk = () => { if (total() !== need) return; const out = []; groups.forEach(g => out.push(...g.objs.slice(0, g.n))); closeModal(); resolve(out); };
        showModal(`<h2>Hand size: discard down to ${P.hand.length - need}</h2><div id="ddBody"></div>`);
        draw();
    });
}
