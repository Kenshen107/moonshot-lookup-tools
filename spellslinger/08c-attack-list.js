// =====================================================================
// Choose attackers from a list (2026-10-28, owner's pod record: "I am still struggling to be able to select all my creatures to attack because I can't see them all").
// With a big board the creatures on the table overlap, so some can't be tapped. In the attack step the action bar gets a "Choose attackers" button that
// opens a list of every creature that can attack: identical creatures share one row with a - / + stepper, with All and None, biggest first. It changes
// the same selection (`G.mode.sel`) that tapping a creature on the table changes, so both ways work together. Phones always show the button; on larger
// screens it shows once 8 or more creatures can attack.
// =====================================================================
function attackCands() { return me().bf.filter(canAttackWith); }
const attackMust = o => forcedAttack(o) || me().mustAttackTurn === G.turn;
function attackGroups2() {
    const groups = new Map();
    attackCands().forEach(o => {
        const key = [o.card.id, pow(o), tou(o), (o.tkw || []).join(','), o.counters || 0, JSON.stringify(o.ctr || {}), attackMust(o) ? 'must' : '', o.isCommander ? 'cmd' : ''].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(o);
    });
    return [...groups.values()].sort((a, b) => pow(b[0]) - pow(a[0]) || a[0].card.name.localeCompare(b[0].card.name));
}
function attackListButton() {
    const n = G.mode && G.mode.type === 'attack' ? attackCands().length : 0;
    return n && (isPhone() || n >= 8) ? `<button class="btn" onclick="attackSheet()">☑️ Choose attackers (${n})</button>` : '';
}
function attackSheet() {
    const m = G.mode;
    if (!m || m.type !== 'attack') return;
    const groups = attackGroups2();
    window.__atkGroups = groups;
    const rows = groups.map((g, i) => {
        const o = g[0], on = g.filter(x => m.sel.has(x.uid)).length, must = attackMust(o);
        const chips = [o.isCommander ? '👑' : '', (o.tkw || []).slice(0, 3).join(', '), o.counters ? `+${o.counters}` : ''].filter(Boolean).join(' · ');
        const ctl = g.length === 1
            ? `<button class="btn small ${on ? 'primary' : ''}" ${must ? 'disabled' : ''} onclick="atkListSet(${i}, ${on ? 0 : 1})">${on ? '✔ Attacking' : 'Attack'}</button>`
            : `<span class="atk-step"><button class="btn small" ${must ? 'disabled' : ''} onclick="atkListSet(${i}, ${Math.max(0, on - 1)})" aria-label="one fewer">−</button><strong>${on}/${g.length}</strong><button class="btn small" ${must ? 'disabled' : ''} onclick="atkListSet(${i}, ${Math.min(g.length, on + 1)})" aria-label="one more">+</button><button class="btn small" ${must ? 'disabled' : ''} onclick="atkListSet(${i}, ${on === g.length ? 0 : g.length})">${on === g.length ? 'None' : 'All'}</button></span>`;
        return `<div class="atk-row${on ? ' on' : ''}"><div class="atk-name"><strong>${esc(o.card.name.split(',')[0])}${g.length > 1 ? ` ×${g.length}` : ''}</strong><span class="note">${pow(o)}/${tou(o)}${chips ? ' · ' + esc(chips) : ''}${must ? ' · must attack' : ''}</span></div>${ctl}</div>`;
    }).join('');
    showModal(`<div class="atk-list"><h2>Who attacks? (${m.sel.size})</h2>
        <div class="atk-top"><button class="btn small" onclick="atkListAll(true)">Everyone</button><button class="btn small" onclick="atkListAll(false)">None</button></div>
        <div class="atk-rows">${rows}</div>
        <div class="mull-actions"><button class="btn primary" onclick="closeModal(); renderGame()">Done (${m.sel.size})</button><button class="btn" onclick="closeModal(); confirmAttack()">⚔️ Attack now</button></div></div>`);
}
function atkListSet(i, k) {
    const m = G.mode, g = (window.__atkGroups || [])[i];
    if (!m || m.type !== 'attack' || !g) return;
    g.forEach(o => { if (!attackMust(o)) m.sel.delete(o.uid); });
    g.filter(o => !attackMust(o)).slice(0, Math.max(0, k - g.filter(attackMust).length)).forEach(o => m.sel.add(o.uid));
    attackSheet();
}
function atkListAll(on) {
    const m = G.mode;
    if (!m || m.type !== 'attack') return;
    attackCands().forEach(o => { if (on || !attackMust(o)) { if (on) m.sel.add(o.uid); else m.sel.delete(o.uid); } });
    attackSheet();
}
