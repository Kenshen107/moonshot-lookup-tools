// =====================================================================
// Grading (2026-10-06, owner's request). Send a copy off with a fee; it
// comes back after some shop days in a slab with a grade from 1 to 10.
// The grade follows the copy's condition (a game choice, not real data)
// and replaces the condition in its value: a 10 is worth 3x (6x for cards
// from before 2003), a 9 1.5x, a 5 about half. The grader is made up.
// =====================================================================
const GRADE_TIERS = [
    { key: 'economy', label: 'Economy', fee: 5, days: 5 },
    { key: 'standard', label: 'Standard', fee: 15, days: 2 },
    { key: 'express', label: 'Express', fee: 40, days: 1 }
];
const GRADE_ODDS = {
    M: [[10, 12], [9.5, 18], [9, 35], [8.5, 15], [8, 12], [7, 8]],
    LP: [[8, 15], [7, 35], [6, 30], [5, 15], [4, 5]],
    MP: [[6, 10], [5, 30], [4, 35], [3, 20], [2, 5]],
    D: [[3, 20], [2, 40], [1, 40]]
};
const GRADE_MULT = { 10: 3, 9.5: 2, 9: 1.5, 8.5: 1.25, 8: 1.1, 7: 0.85, 6: 0.7, 5: 0.55, 4: 0.45, 3: 0.35, 2: 0.25, 1: 0.2 };
const GRADE_WORDS = { 10: 'Gem Mint', 9.5: 'Mint+', 9: 'Mint', 8.5: 'Near Mint-Mint+', 8: 'Near Mint-Mint', 7: 'Near Mint', 6: 'Excellent-Mint', 5: 'Excellent', 4: 'Very Good-Excellent', 3: 'Very Good', 2: 'Good', 1: 'Poor' };
function gradeWord(g) { return GRADE_WORDS[g] || ''; }
function gradeMult(card, g) { return g === 10 && card && card.released && card.released < '2003-01-01' ? 6 : (GRADE_MULT[g] || 1); }
function gradeRange(c) { const g = GRADE_ODDS[c].map(x => x[0]); return `${Math.min(...g)}-${Math.max(...g)}`; }
function openGradeDialog(id, key) {
    const card = CARDS.get(id);
    const copy = ownedCopies(id).find(c => copyKey(c) === key);
    if (!card || !copy) return;
    if (copy.g) { toast('That copy is already graded.'); return; }
    const now = copyValue(card, copy), mint = copyValue(card, { ...copy, c: 'M' }, true);
    showModal(`<h2>🔍 Send ${esc(card.name)} for grading</h2>
        <p>${esc(copyLabel(copy))} · worth ${usd(now)} now. ${esc(CONDITIONS[copy.c].label)} copies usually grade <strong>${gradeRange(copy.c)}</strong>.</p>
        <p class="note">If it comes back a 10 it's worth about <strong>${usd(mint * gradeMult(card, 10))}</strong>; a 9, ${usd(mint * gradeMult(card, 9))}; an 8, ${usd(mint * gradeMult(card, 8))}. The card leaves your collection (and decks) while it's away.</p>
        <div class="row" style="justify-content:center; gap:8px;">${GRADE_TIERS.map(t => `<button class="btn${t.key === 'standard' ? ' primary' : ''}" onclick="sendToGrading('${id}', '${key}', '${t.key}')" ${profile.usd < t.fee ? 'disabled' : ''}>${esc(t.label)} · ${usd(t.fee)}<br><small>back in ${t.days} day${t.days === 1 ? '' : 's'}</small></button>`).join('')}</div>
        <p class="note">Days are shop days: close the shop to move to the next one. Shop cash: ${usd(profile.usd)}.</p>
        <div class="row" style="justify-content:center; margin-top:8px;"><button class="btn" onclick="closeModal()">Cancel</button></div>`);
}
function sendToGrading(id, key, tierKey) {
    const t = GRADE_TIERS.find(x => x.key === tierKey);
    const copy = ownedCopies(id).find(c => copyKey(c) === key);
    if (!t || !copy || copy.g) return;
    if (profile.usd < t.fee) { toast('Not enough shop cash.'); return; }
    takeCopy(id, copy);
    profile.usd = round2(profile.usd - t.fee);
    profile.grading.push({ id, copy, tier: t.key, sent: profile.shopDay, due: profile.shopDay + t.days });
    shopLog(`📮 Sent ${esc(CARDS.get(id)?.name || 'a card')} for ${t.label.toLowerCase()} grading (${usd(t.fee)}), back on day ${profile.shopDay + t.days}.`);
    saveProfile();
    closeModal();
    renderShop();
}
function openGradedCard(i) {
    const g = profile.grading[i];
    if (!g || g.due > profile.shopDay) return;
    const card = CARDS.get(g.id);
    const odds = GRADE_ODDS[g.copy.c] || GRADE_ODDS.M;
    const grade = odds[pickWeighted(odds)][0];
    const copy = { ...g.copy, g: grade };
    profile.grading.splice(i, 1);
    addCopy(g.id, copy);
    saveProfile();
    renderShop();
    if (!card) return;
    const v = copyValue(card, copy);
    shopLog(`🔖 ${esc(card.name)} came back a <strong>${grade}</strong> (${gradeWord(grade)}), worth ${usd(v)}.`);
    const title = grade === 10 ? '💎 GEM MINT 10!' : grade >= 9 ? `🔥 GRADE ${grade}!` : grade >= 7 ? `🔖 Grade ${grade}` : `Grade ${grade}`;
    if (grade >= 9) spotlight({ title, card, value: v, slab: { grade, word: gradeWord(grade) }, sub: `${copyLabel(copy)} · was ${usd(copyValue(card, g.copy))} raw` });
    else {
        showModal(`<h2>${title}</h2><div class="slab-case" style="margin:0 auto; width:max-content;"><div class="slab-label"><span>${esc(card.name)}<br><small class="note">${esc(gradeWord(grade))}</small></span><span class="g">${grade}</span></div>
            <div class="sl-card" style="animation:none; box-shadow:none;">${card.img ? `<img src="${card.img}" alt="${esc(card.name)}">` : esc(card.name)}</div></div>
            <p>Worth <strong>${usd(v)}</strong> now (was ${usd(copyValue(card, g.copy))} raw).</p><button class="btn primary" onclick="closeModal()">OK</button>`);
    }
}
function renderGrading() {
    const el = $('shopGrading');
    if (!el) return;
    const list = profile.grading.map((g, i) => ({ g, i }));
    el.innerHTML = list.length ? `<ul class="grade-list">${list.map(({ g, i }) => {
        const card = CARDS.get(g.id), ready = g.due <= profile.shopDay;
        return `<li>${esc(card ? card.name : '?')} ${condBadge(g.copy)} <span class="note">${esc((GRADE_TIERS.find(t => t.key === g.tier) || {}).label || '')}</span>
            ${ready ? `<button class="btn small gold" onclick="openGradedCard(${i})">📬 Open the slab</button>` : `<span class="note">back on day ${g.due}</span>`}</li>`;
    }).join('')}</ul>` : '<p class="note">Nothing out for grading. Use 🔍 Grade on a card in your collection below.</p>';
}

// ---- Moving cards: collection <-> case, bulk bin, vault ----
function suggestedAsk(card, copy) {
    const markup = parseFloat($('shopMarkup') ? $('shopMarkup').value : 20) || 0;
    return Math.max(0.1, Math.round(copyValue(card, copy) * (1 + markup / 100) * 100) / 100);
}
function listCopy(id, key) {
    const copy = ownedCopies(id).find(c => copyKey(c) === key);
    const card = CARDS.get(id);
    if (!copy || !card) return;
    takeCopy(id, copy);
    profile.displayCase.push({ id, condition: copy.c, foil: copy.f ? 1 : 0, serial: copy.s ? 1 : 0, ...(copy.g ? { grade: copy.g } : {}), askingPrice: suggestedAsk(card, copy) });
    saveProfile();
    renderShop();
}
function bulkCopy(id, key) {
    const copy = ownedCopies(id).find(c => copyKey(c) === key);
    if (!copy) return;
    if (copy.g) { toast('Graded slabs go in the case, not the bulk bin.'); return; }
    takeCopy(id, copy);
    profile.bulkBox.push({ id, condition: copy.c, foil: copy.f ? 1 : 0 });
    saveProfile();
    renderShop();
}
function unlist(i) {
    const l = profile.displayCase[i];
    if (!l) return;
    profile.displayCase.splice(i, 1);
    if (l.sealed) { addSealed(l.meta, 1); saveProfile(); renderShop(); return; }
    addCopy(l.id, listingCopy(l));
    saveProfile();
    renderShop();
}
function setAsk(i, val) {
    const l = profile.displayCase[i];
    const n = Math.round(parseFloat(String(val).replace(/[$,]/g, '')) * 100) / 100;
    if (l && n > 0) { l.askingPrice = n; saveProfile(); }
    renderShopFloor();
}
function setBulkPrice(val) {
    const n = Math.round(parseFloat(String(val).replace(/[$,]/g, '')) * 100) / 100;
    if (n > 0) { profile.bulkPrice = n; saveProfile(); }
    renderShopFloor();
}
function emptyBulkBin() {
    profile.bulkBox.forEach(l => addCopy(l.id, { c: l.condition, ...(l.foil ? { f: 1 } : {}) }));
    profile.bulkBox = [];
    saveProfile();
    renderShop();
}
// Cheap commons and uncommons go to the bin; copies your decks use stay
function sweepBulk() {
    const used = {};
    profile.decks.forEach(d => Object.entries(d.cards || {}).forEach(([id, n]) => { used[id] = Math.max(used[id] || 0, n); }));
    let moved = 0;
    Object.keys(profile.collection).forEach(id => {
        const card = CARDS.get(id);
        if (!card || isBasic(card) || !['common', 'uncommon'].includes(card.rarity)) return;
        let spare = (profile.collection[id] || 0) - (used[id] || 0);
        while (spare-- > 0) {
            const copy = ownedCopies(id).filter(c => !c.s).sort((a, b) => copyValue(card, a) - copyValue(card, b))[0];
            if (!copy || copyValue(card, copy) >= 0.5) break;
            takeCopy(id, copy);
            profile.bulkBox.push({ id, condition: copy.c, foil: copy.f ? 1 : 0 });
            moved++;
        }
    });
    saveProfile();
    toast(moved ? `${moved} bulk card${moved === 1 ? '' : 's'} went in the bin.` : 'No spare commons or uncommons under $0.50.');
    renderShop();
}
function toggleVault(id) {
    const i = profile.vault.indexOf(id);
    if (i >= 0) profile.vault.splice(i, 1);
    else if (profile.vault.length >= 3) { toast('The vault holds 3 trophies. Take one out first.'); return; }
    else profile.vault.push(id);
    saveProfile();
    renderShop();
}
function addTestCash() {
    const raw = prompt(`Add how much shop cash to ${accounts.current}? (test build)`, '100');
    const n = Math.round(Number(String(raw || '').replace(/[$, ]/g, '')) * 100) / 100;
    if (!(n > 0)) return;
    profile.usd = Math.round((profile.usd + Math.min(n, 1e7)) * 100) / 100;
    saveProfile();
    renderShop();
}

// ---- Shop view ----
let shopFilter = '';
async function renderShop() {
    if (!$('view-shop')) return;
    ensureShopDay();
    // Cards cached before the shop existed lack foil prices, frames and dates
    const ids = [...new Set([...Object.keys(profile.collection), ...profile.displayCase.map(l => l.id).filter(Boolean), ...profile.bulkBox.map(l => l.id), ...profile.vault])];
    const stale = ids.filter(id => CARDS.has(id) && !(CARDS.get(id).v >= 2));
    if (stale.length) {
        $('shopStock').innerHTML = '<div class="loading">Getting today\'s prices...</div>';
        await fetchCollection(stale.map(id => ({ id }))).catch(() => {});
    }
    const missing = ids.filter(id => !CARDS.has(id));
    if (missing.length) await cardsByIds(missing).catch(() => {});
    renderShopFloor();
    renderShopStock();
    ensurePackEVs(profile.displayCase.filter(l => l.sealed).map(l => l.meta), () => { if (!$('view-shop').classList.contains('hidden')) renderShopFloor(); });
}
function renderShopFloor() {
    const T = profile.shopToday;
    const e = todayEvent();
    $('shopHead').innerHTML = `
        <div class="pos-stats">
            <div><span class="pos-k">Day</span><strong>${profile.shopDay}</strong></div>
            <div><span class="pos-k">Shop cash</span><strong class="${profile.usd < 0 ? 'neg' : ''}">💵 ${usd(profile.usd)}</strong></div>
            <div><span class="pos-k">Reputation</span><strong>⭐ ${profile.shopReputation}</strong></div>
            <div><span class="pos-k">Today</span><strong>${T.sales.length} sale${T.sales.length === 1 ? '' : 's'} · ${usd(T.revenue)}</strong>${T.bought ? `<span class="note">bought ${usd(T.bought)}</span>` : ''}</div>
            <div><span class="pos-k">Day ends in</span><strong class="day-clock">⏱ ${clockText(T.timeLeft)}</strong></div>
            <div><span class="pos-k">Customers due</span><strong>${T.timeLeft > 0 ? T.visitsLeft : 0}</strong></div>
        </div>
        ${e ? `<div class="pos-event"><span aria-hidden="true">${e.icon}</span> <strong>${esc(e.title)}:</strong> ${esc(e.text)}</div>` : ''}
        <div class="row">
            ${SHOP.open ? '<button class="btn" onclick="pauseShop(); renderShopFloor();">⏸ Pause</button>' : `<button class="btn primary" onclick="openShop()" ${T.visitsLeft <= 0 || T.timeLeft <= 0 ? 'disabled' : ''}>🔓 Open the shop</button>`}
            <button class="btn" onclick="closeShop()">🔒 Close shop (rent ${usd(SHOP_RENT)}) → day ${profile.shopDay + 1}</button>
            <button class="btn small" onclick="addTestCash()" title="Test build: add free shop cash">＋💵 Add cash</button>
            <span class="note">${SHOP.open ? 'Open: a day is 10 minutes; the clock runs while you\'re on this tab. Some customers come to sell you cards.' : 'Closed: open up to let customers in.'}</span>
        </div>`;
    // The floor redraws every few seconds: keep a half-typed counteroffer (and its open box) as it was
    const keep = [...document.querySelectorAll('#shopCustomers .counter-in')].map(i => ({ id: i.id, v: i.value, focus: document.activeElement === i, open: i.closest('details') && i.closest('details').open }));
    $('shopCustomers').innerHTML = SHOP.queue.length ? SHOP.queue.map(c => customerHTML(c)).join('') : `<p class="note">${SHOP.open ? 'Waiting for customers...' : 'No one here. Open the shop.'}</p>`;
    $('shopCase').innerHTML = profile.displayCase.length ? `<table class="pos-table"><thead><tr><th>Card</th><th>Worth today</th><th>Your price</th><th></th></tr></thead><tbody>${profile.displayCase.map((l, i) => {
        if (l.sealed) return `<tr><td>📦 <strong>${esc(l.meta.name)}</strong> <span class="note">${kindLabel(l.meta)} pack</span></td>
            <td>${usd(packMarket(l.meta))}</td>
            <td><input type="text" inputmode="decimal" value="${l.askingPrice.toFixed(2)}" onchange="setAsk(${i}, this.value)" aria-label="Asking price" class="ask-in"></td>
            <td><button class="btn small" onclick="unlist(${i})" title="Back to your stockroom">↩</button></td></tr>`;
        const card = CARDS.get(l.id);
        return `<tr class="${l.serial ? 'serial-row' : ''}"><td><button class="linkish" onclick="showCardSheet('${l.id}')">${esc(card ? card.name : '?')}</button> ${condBadge(listingCopy(l))}</td>
            <td>${usd(listingValue(l))}</td>
            <td><input type="text" inputmode="decimal" value="${l.askingPrice.toFixed(2)}" onchange="setAsk(${i}, this.value)" aria-label="Asking price" class="ask-in"></td>
            <td><button class="btn small" onclick="unlist(${i})" title="Back to your collection">↩</button></td></tr>`;
    }).join('')}</tbody></table>` : '<p class="note">The case is empty. Add cards from your collection below.</p>';
    $('shopBulk').innerHTML = `<div class="row"><span>🧺 <strong>${profile.bulkBox.length}</strong> card${profile.bulkBox.length === 1 ? '' : 's'} in the bin</span>
        <label class="note">Price each: <input type="text" inputmode="decimal" value="${profile.bulkPrice.toFixed(2)}" onchange="setBulkPrice(this.value)" class="ask-in" aria-label="Bulk price per card"></label>
        <button class="btn small" onclick="sweepBulk()" title="Spare commons and uncommons under $0.50 (copies your decks use stay)">🧹 Sweep bulk in</button>
        ${profile.bulkBox.length ? '<button class="btn small" onclick="emptyBulkBin()">↩ Empty the bin</button>' : ''}</div>`;
    $('shopVault').innerHTML = [0, 1, 2].map(i => {
        const id = profile.vault[i];
        const card = id && CARDS.get(id);
        return card ? `<button class="vault-slot" onclick="showCardSheet('${id}')" title="${esc(card.name)} · ${usd(baseUsd(card))}">${card.imgS ? `<img src="${card.imgS}" alt="${esc(card.name)}">` : esc(card.name)}</button>`
            : '<div class="vault-slot empty">🏆<span class="note">empty</span></div>';
    }).join('') + `<p class="note" style="grid-column:1/-1;">Trophies aren't for sale; they draw a crowd (up to +15% customers).${vaultBonus() ? ` Now: +${Math.round(vaultBonus() * 100)}%.` : ''}</p>`;
    keep.forEach(k => { const i = $(k.id); if (!i) return; i.value = k.v; if (k.open) i.closest('details').open = true; if (k.focus) i.focus(); });
    renderGrading();
    $('shopLog').innerHTML = SHOP.log.length ? SHOP.log.map(m => `<li>${m}</li>`).join('') : '<li class="note">Nothing yet today.</li>';
}
function renderShopStock() {
    const q = shopFilter.trim().toLowerCase();
    const rows = Object.keys(profile.collection).map(id => CARDS.get(id)).filter(c => c && !isBasic(c) && (!q || c.name.toLowerCase().includes(q)))
        .map(c => ({ c, best: Math.max(...ownedCopies(c.id).map(cp => copyValue(c, cp))) })).sort((a, b) => b.best - a.best).slice(0, 60).map(x => x.c);
    $('shopStock').innerHTML = rows.length ? `<table class="pos-table"><thead><tr><th>Card</th><th>Copies</th><th></th></tr></thead><tbody>${rows.map(card => {
        const groups = {};
        ownedCopies(card.id).forEach(c => { const k = copyKey(c); (groups[k] = groups[k] || { c, n: 0 }).n++; });
        const opts = Object.entries(groups).sort((a, b) => copyValue(card, b[1].c) - copyValue(card, a[1].c));
        const sel = `<select id="cp-${card.id}" aria-label="Which copy">${opts.map(([k, g]) => `<option value="${k}">${esc(copyLabel(g.c))} ×${g.n} · ${usd(copyValue(card, g.c))}</option>`).join('')}</select>`;
        const inVault = profile.vault.includes(card.id);
        return `<tr><td><button class="linkish" onclick="showCardSheet('${card.id}')">${esc(card.name)}</button> <span class="note">${esc((card.set || '').toUpperCase())} · ${card.rarity}</span></td><td>${sel}</td>
            <td class="pos-actions"><button class="btn small primary" onclick="listCopy('${card.id}', $('cp-${card.id}').value)">＋ Case</button>
            <button class="btn small" onclick="bulkCopy('${card.id}', $('cp-${card.id}').value)">→ Bulk</button>
            <button class="btn small" onclick="openGradeDialog('${card.id}', $('cp-${card.id}').value)" title="Send this copy to be graded">🔍 Grade</button>
            <button class="btn small" onclick="toggleVault('${card.id}')" aria-pressed="${inVault}">${inVault ? '🏆 Out' : '🏆 Vault'}</button></td></tr>`;
    }).join('')}</tbody></table>${Object.keys(profile.collection).length > 60 && !q ? '<p class="note">Showing your 60 most valuable cards. Search to find others.</p>' : ''}`
        : `<p class="note">${q ? 'No cards match.' : 'No cards yet. Open some packs first.'}</p>`;
}

