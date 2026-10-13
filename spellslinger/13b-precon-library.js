// =====================================================================
// 📚 Precon Library (owner's request, 2026-10-08): every precon the game knows (553 from MTGJSON), grouped by product
// type and then by set, with a badge for whether the game plays every card of it ("Ready") or how many cards still
// don't work. Any deck can be picked as your deck or as the opponent; a deck with cards the game can't cast swaps
// those for basics when it is the OPPONENT (preconForAI), and can't be your own deck until it is Ready.
// Which decks are Ready comes from spellslinger/data/precon-ready.json, written by `node tests/precon_audit.js --write`
// after each rules round (the same idea as CARD_COVERAGE on Home).
// =====================================================================
const PRECON_GROUPS = [
    ['Welcome Deck', 'Welcome Decks', '30 cards, made for brand-new players'],
    ['Starter Deck', 'Starter Decks (1990s)', 'The first boxed decks'],
    ['Theme Deck', 'Theme Decks', 'Classic 40- and 60-card decks'],
    ['Intro Pack', 'Intro Packs', 'Pre-built decks sold with a set'],
    ['Starter Kit', 'Starter Kits', '60 cards, for learning'],
    ['Arena Starter Kit', 'Arena Starter Kits', '60 cards'],
    ['Planeswalker Deck', 'Planeswalker Decks', '60 cards with a planeswalker'],
    ['Challenger Deck', 'Challenger Decks', '60 cards, tournament-ready'],
    ['Pioneer Challenger Deck', 'Pioneer Challenger Decks', '60 cards, Pioneer']
];
let preconReady = null; // { measured, total, ready, bad: { file: nBad }, near: { file: [names] } }
async function loadPreconReady() {
    if (preconReady) return preconReady;
    try { const r = await fetch('spellslinger/data/precon-ready.json'); preconReady = r.ok ? await r.json() : { bad: {}, near: {}, missing: true }; }
    catch (e) { preconReady = { bad: {}, near: {}, missing: true }; }
    return preconReady;
}
function preconBad(p) { return preconReady && preconReady.bad ? (preconReady.bad[p.file] || 0) : 0; }
function preconIsReady(p) { return !!preconReady && !preconReady.missing && !preconReady.bad[p.file]; }
const PL = { type: 'all', ready: true, q: '', pick: null, open: {} };
function plSetFilter(k, v) { PL[k] = v; if (k === 'type') PL.open = {}; renderPreconLibrary(); }
async function renderPreconLibrary() {
    const box = $('plBody');
    let list, names;
    try { list = await loadPreconList(); await loadPreconReady(); names = await setNames(); }
    catch (e) { box.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    const setOf = p => names[(p.code || '').toUpperCase()] || p.code || 'Other';
    const year = p => (p.date || '').slice(0, 4);
    const total = list.length, ready = list.filter(preconIsReady).length;
    $('plNote').textContent = preconReady.missing ? `${total} precons from MTGJSON (readiness data not found)` : `${ready} of ${total} precons are fully playable now (measured ${preconReady.measured}); the rest need a few more cards built.`;
    $('plChips').innerHTML = [['all', 'All']].concat(PRECON_GROUPS.map(g => [g[0], g[1]])).map(([k, label]) => `<button type="button" class="chip${PL.type === k ? ' on' : ''}" onclick="plSetFilter('type','${k}')">${esc(label)}</button>`).join('');
    $('plReady').checked = PL.ready;
    const q = PL.q.trim().toLowerCase();
    const show = p => (PL.type === 'all' || p.type === PL.type) && (!PL.ready || preconIsReady(p)) && (!q || `${p.name} ${setOf(p)} ${year(p)}`.toLowerCase().includes(q));
    let html = '';
    PRECON_GROUPS.forEach(([type, label, blurb]) => {
        const all = list.filter(p => p.type === type), mine = all.filter(show);
        if (!mine.length) return;
        const open = PL.open[type] !== false && (PL.type !== 'all' || q || PL.open[type] === true || mine.length <= 12);
        const bySet = new Map();
        mine.forEach(p => { const k = `${setOf(p)}|${year(p)}`; if (!bySet.has(k)) bySet.set(k, []); bySet.get(k).push(p); });
        html += `<details class="pl-group" ${open ? 'open' : ''} ontoggle="PL.open['${type}'] = this.open"><summary><strong>${esc(label)}</strong> <span class="note">${esc(blurb)} · ${all.filter(preconIsReady).length} of ${all.length} playable${mine.length !== all.length ? ` · ${mine.length} shown` : ''}</span></summary>
            ${[...bySet.entries()].map(([k, decks]) => { const [setName, yr] = k.split('|'); return `<div class="pl-set"><div class="pl-set-h">${esc(setName)}${yr ? ` <span class="note">${yr}</span>` : ''}</div><div class="pl-decks">${decks.map(p => {
                const bad = preconBad(p), near = preconReady.near && preconReady.near[p.file];
                return `<button type="button" class="wd-card pl-deck${bad ? ' pl-warn' : ''}" aria-pressed="${PL.pick === p.file}" onclick="plPick('${esc(p.file)}')"><strong>${esc(p.name)}</strong><span class="note">${bad ? `⚠ ${bad} card${bad === 1 ? '' : 's'} not fully working${near ? `: ${esc(near.join(', '))}` : ''}` : preconReady.missing ? '' : '✅ Ready to play'}</span><span class="note">${PL.pick === p.file ? '✔ Picked' : 'Tap to pick'}</span></button>`; }).join('')}</div></div>`; }).join('')}</details>`;
    });
    box.innerHTML = html || '<p class="note">No precons match. Try turning off "Ready to play only".</p>';
    // The play bar: your deck vs the picked precon
    const pick = list.find(p => p.file === PL.pick);
    const sel = $('plMine'), prev = sel.value;
    const mineDecks = profile.decks.map((d, i) => [d, i]).filter(([d]) => d.format !== 'commander');
    sel.innerHTML = (mineDecks.length ? `<optgroup label="Your decks">${mineDecks.map(([d, i]) => `<option value="${i}">${esc(d.name)}</option>`).join('')}</optgroup>` : '')
        + `<optgroup label="Play a precon yourself (ready ones)">${list.filter(preconIsReady).map(p => `<option value="pc:${esc(p.file)}">${esc(p.name)} (${esc(setOf(p))})</option>`).join('')}</optgroup>`;
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
    else if (!mineDecks.length && sel.options.length) sel.value = sel.options[0].value;
    $('plStart').disabled = !pick;
    $('plStartNote').textContent = pick ? `vs ${pick.name} (${setOf(pick)})${preconIsReady(pick) ? '' : ', cards it can\'t cast become lands'}` : 'Tap a deck above to pick your opponent.';
}
function plPick(f) { PL.pick = f; renderPreconLibrary(); if (isPhone()) $('plStart').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
async function startPreconMatch() {
    const list = await loadPreconList();
    const opp = list.find(p => p.file === PL.pick);
    if (!opp) { toast('Pick an opponent first.'); return; }
    const v = $('plMine').value;
    showModal('<h2>Shuffling up...</h2><p class="loading">Loading both decks...</p>');
    try {
        let mine;
        if (v.startsWith('pc:')) mine = { ...(await loadPreconDeck(list.find(x => x.file === v.slice(3)))) };
        else {
            const deck = profile.decks[Number(v)];
            if (!deck) throw new Error('Pick your deck first.');
            await cardsByIds(Object.keys(deck.cards));
            mine = deckToEntries(deck);
        }
        mine.format = 'casual';
        const oppDeck = await preconForAI(await loadPreconDeck(opp));
        oppDeck.format = 'casual';
        oppDeck.source = `${opp.type}${oppDeck.swapped ? `, ${oppDeck.swapped} cards swapped for lands` : ''}`;
        closeModal();
        newGame(mine, oppDeck);
    } catch (e) {
        console.error(e);
        showModal(`<h2>Couldn't start</h2><p class="warn">${esc(e.message)}</p><div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">OK</button></div>`);
    }
}

// =====================================================================
// 🃏 Precon Circuit (Campaign): a lane for each kind of precon, a stop for every deck the game can fully play.
// New decks join the circuit by themselves as they become Ready (precon-ready.json). Beating a stop pays its lane's
// coins the first time (10 coins for repeat wins, 5 for a loss); progress is kept in profile.campaignProgress as
// "pc-<file>". Your deck is one you built or any Ready precon (Casual rules).
// =====================================================================
const CIRCUIT_LANES = {
    'Welcome Deck': { level: 'easy', win: 20 }, 'Starter Deck': { level: 'easy', win: 25 },
    'Theme Deck': { level: 'normal', win: 30 }, 'Intro Pack': { level: 'normal', win: 35 },
    'Starter Kit': { level: 'normal', win: 40 }, 'Arena Starter Kit': { level: 'normal', win: 40 },
    'Planeswalker Deck': { level: 'normal', win: 60 }, 'Challenger Deck': { level: 'hard', win: 100 }, 'Pioneer Challenger Deck': { level: 'hard', win: 100 }
};
const CC = { pick: null };
function circuitBeaten(p) { return profile.campaignProgress.includes('pc-' + p.file); }
async function renderCircuit() {
    const box = $('circuitBody');
    if (!box) return;
    let list, names;
    try { list = await loadPreconList(); await loadPreconReady(); names = await setNames(); }
    catch (e) { box.innerHTML = `<p class="warn">${esc(e.message)}</p>`; return; }
    const ready = list.filter(preconIsReady).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const setOf = p => names[(p.code || '').toUpperCase()] || p.code || '';
    const beaten = ready.filter(circuitBeaten).length;
    $('circuitNote').textContent = `${beaten} of ${ready.length} stops beaten. A deck gets a stop once the game plays every card in it, so the circuit grows as more are built.`;
    box.innerHTML = PRECON_GROUPS.map(([type, label]) => {
        const lane = CIRCUIT_LANES[type], decks = ready.filter(p => p.type === type);
        if (!decks.length) return '';
        const done = decks.filter(circuitBeaten).length;
        return `<details class="pl-group"${CC.pick && decks.some(p => p.file === CC.pick) ? ' open' : ''}><summary><strong>${esc(label)}</strong> <span class="note">${done} of ${decks.length} beaten · ${lane.level === 'easy' ? 'casual AI' : lane.level === 'normal' ? 'solid AI' : 'expert AI'} · 🪙 ${lane.win} per first win</span></summary>
            <div class="pl-decks" style="margin-top:8px;">${decks.map(p => `<button type="button" class="wd-card pl-deck" aria-pressed="${CC.pick === p.file}" onclick="circuitPick('${esc(p.file)}')"><strong>${circuitBeaten(p) ? '✓ ' : ''}${esc(p.name)}</strong><span class="note">${esc(setOf(p))}${p.date ? ' · ' + p.date.slice(0, 4) : ''}</span></button>`).join('')}</div></details>`;
    }).join('') || '<p class="note">No precon is ready yet.</p>';
    const pick = list.find(p => p.file === CC.pick);
    const sel = $('circuitMine'), prev = sel.value;
    const mine = profile.decks.map((d, i) => [d, i]).filter(([d]) => d.format !== 'commander');
    sel.innerHTML = (mine.length ? `<optgroup label="Your decks">${mine.map(([d, i]) => `<option value="${i}">${esc(d.name)}</option>`).join('')}</optgroup>` : '')
        + `<optgroup label="Play a precon yourself">${ready.map(p => `<option value="pc:${esc(p.file)}">${esc(p.name)} (${esc(setOf(p))})</option>`).join('')}</optgroup>`;
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
    else if (!mine.length && sel.options.length) sel.value = sel.options[0].value;
    $('circuitStart').disabled = !pick;
    $('circuitStartNote').textContent = pick ? `vs ${pick.name} (${setOf(pick)}) · first win 🪙 ${CIRCUIT_LANES[pick.type].win}` : 'Pick a stop above.';
}
function circuitPick(f) { CC.pick = f; renderCircuit(); }
async function startCircuitMatch() {
    const list = await loadPreconList();
    const opp = list.find(p => p.file === CC.pick);
    if (!opp || !preconIsReady(opp)) { toast('Pick a stop first.'); return; }
    const v = $('circuitMine').value;
    showModal('<h2>Shuffling up...</h2><p class="loading">Loading both decks...</p>');
    try {
        let mine;
        if (v.startsWith('pc:')) mine = { ...(await loadPreconDeck(list.find(x => x.file === v.slice(3)))) };
        else {
            const deck = profile.decks[Number(v)];
            if (!deck) throw new Error('Pick your deck first.');
            await cardsByIds(Object.keys(deck.cards));
            mine = deckToEntries(deck);
        }
        mine.format = 'casual';
        const oppDeck = await preconForAI(await loadPreconDeck(opp));
        oppDeck.format = 'casual';
        oppDeck.aiLevel = CIRCUIT_LANES[opp.type].level;
        oppDeck.source = `Precon Circuit: ${opp.type}`;
        oppDeck.campaign = { circuit: true, node: 'pc-' + opp.file, lane: opp.type, name: opp.name };
        closeModal();
        newGame(mine, oppDeck);
    } catch (e) {
        console.error(e);
        showModal(`<h2>Couldn't start</h2><p class="warn">${esc(e.message)}</p><div class="row" style="justify-content:center; margin-top:12px;"><button class="btn" onclick="closeModal()">OK</button></div>`);
    }
}
// Called from campaignResult for circuit games
function circuitResult(won) {
    const c = G.campaign, lane = CIRCUIT_LANES[c.lane] || { win: 20 };
    const first = won && !profile.campaignProgress.includes(c.node);
    if (first) profile.campaignProgress.push(c.node);
    const coins = won ? (first ? lane.win : 10) : 5;
    profile.coins += coins;
    saveProfile();
    return won ? `Precon Circuit: ${first ? `${c.name} beaten for the first time!` : 'another win'} 🪙 +${coins}` : `Precon Circuit: 🪙 ${coins} for trying.`;
}
