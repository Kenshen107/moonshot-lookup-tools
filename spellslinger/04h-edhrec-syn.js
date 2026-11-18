// EDHREC synergy in the deck builder (2026-11-19, owner: "do all four" EDHREC ideas). For a Commander deck, EDHREC's page for its commander says how much more often that
// commander's decks play each card than other decks in the same colors do (synergy: 0.3 and up is on plan, near 0 is a generic staple, negative is played less than average).
// The builder shows it as a badge on each card row and lists the best cards the deck is missing. Optional: if EDHREC can't be read nothing shows. Cached a week per commander.
const SYN = { slug: null, map: null, state: '' }; // state: '', 'loading', 'ok', 'none'
const SYN_DAYS = 7;
function synBuild(entries) { const m = new Map(); entries.forEach(([name, syn, inc, tag]) => m.set(String(name).toLowerCase(), { name, syn, inc, tag })); return m; }
function synSet(slug, entries) { SYN.slug = slug; SYN.map = synBuild(entries); SYN.state = 'ok'; } // also used by tests
async function synLoad(commander) {
    if (!commander) return;
    const slug = edhrecSlug(commander.name);
    if (SYN.slug === slug && SYN.state) return;
    SYN.slug = slug; SYN.map = null; SYN.state = 'loading';
    const key = `edhrecSyn:${slug}`;
    try {
        const cached = store.get(key);
        if (cached && cached.m && Date.now() - cached.t < SYN_DAYS * 864e5) { SYN.map = synBuild(cached.m); SYN.state = 'ok'; }
        else {
            const res = await fetch(`${EDH}/commanders/${slug}.json`);
            if (!res.ok) throw new Error('no page');
            const json = await res.json();
            const best = new Map();
            for (const l of (json.container && json.container.json_dict && json.container.json_dict.cardlists) || []) for (const v of l.cardviews || []) {
                if (!v.potential_decks || v.potential_decks < 15) continue;
                const e = [v.name, +(v.synergy || 0).toFixed(3), +(v.num_decks / v.potential_decks).toFixed(3), l.tag || ''];
                const cur = best.get(v.name); if (!cur || Math.abs(e[1]) > Math.abs(cur[1])) best.set(v.name, e);
            }
            const m = [...best.values()];
            store.set(key, { t: Date.now(), m });
            SYN.map = synBuild(m); SYN.state = 'ok';
        }
    } catch (e) { SYN.map = null; SYN.state = 'none'; }
    if (typeof editing !== 'undefined' && editing && editing.format === 'commander' && typeof renderDeckPanel === 'function') renderDeckPanel();
}
function synOf(c) { return SYN.map && c ? SYN.map.get(String(c.name).toLowerCase()) || SYN.map.get(String(c.fullName || '').toLowerCase()) || null : null; }
function synBadge(c, isCmd) {
    if (isCmd || isBasic(c)) return '';
    const e = synOf(c); if (!e) return '';
    const cls = e.syn >= 0.3 ? 'hi' : e.syn >= 0.1 ? 'mid' : 'lo';
    const word = e.syn >= 0.3 ? 'on plan' : e.syn >= 0.1 ? 'fits' : e.syn >= 0 ? 'generic staple' : 'played less than average';
    return `<span class="mx-syn ${cls}" title="EDHREC synergy ${e.syn >= 0 ? '+' : ''}${e.syn.toFixed(2)} (${word}); ${Math.round(100 * e.inc)}% of this commander's decks play it">${e.syn >= 0 ? '+' : '−'}${Math.abs(e.syn).toFixed(2).replace(/^0/, '')}</span>`;
}
// the best cards this deck lacks: synergy 0.3+, in 25%+ of the commander's decks, not already in the deck
function synMissing(d, limit = 8) {
    if (!SYN.map || !d) return [];
    const inDeck = new Set(Object.keys(d.cards).map(id => CARDS.get(id)).filter(Boolean).map(c => c.name.toLowerCase()));
    if (d.commander && CARDS.get(d.commander)) inDeck.add(CARDS.get(d.commander).name.toLowerCase());
    if (d.commander2 && CARDS.get(d.commander2)) inDeck.add(CARDS.get(d.commander2).name.toLowerCase());
    return [...SYN.map.values()].filter(e => e.syn >= 0.3 && e.inc >= 0.25 && !inDeck.has(e.name.toLowerCase()) && !/land|basic/.test(e.tag || '')).sort((a, b) => b.syn - a.syn).slice(0, limit);
}
function synPanelHTML(d) {
    if (!d || d.format !== 'commander' || !d.commander) return '';
    if (SYN.state === 'loading') return '<div class="panel mx-stat"><h3>Fits the commander</h3><p class="note">Reading EDHREC…</p></div>';
    if (!SYN.map) return '';
    const cmd = CARDS.get(d.commander);
    const have = Object.entries(d.cards).map(([id, n]) => CARDS.get(id)).filter(c => c && !isBasic(c));
    const onPlan = have.filter(c => (synOf(c) || { syn: -1 }).syn >= 0.3).length;
    const nonBasic = have.length;
    const pool = new Map(builderPool().map(c => [c.name.toLowerCase(), c]));
    const miss = synMissing(d);
    return `<div class="panel mx-stat"><h3>Fits the commander <span class="note">(EDHREC synergy)</span></h3>
        <p class="note"><b>${onPlan}</b> of ${nonBasic} cards are on plan for ${esc(cmd ? cmd.name.split(',')[0] : 'this commander')} (synergy +0.30 or more).</p>
        ${miss.length ? `<p class="note">Played far more often by this commander's decks and missing here:</p><div class="mx-syn-list">${miss.map(e => { const c = pool.get(e.name.toLowerCase()); const ok = c && usableIn(d, c) && !isBasic(c); return ok ? `<button type="button" class="mx-syn-add" onclick="mxFindAdd('${c.id}')" title="Add to the deck">＋ ${esc(e.name)} <span class="mx-syn hi">+${e.syn.toFixed(2).replace(/^0/, '')}</span></button>` : `<span class="mx-syn-no" title="${c ? 'Not usable in this deck' : 'Not in your collection'}">${esc(e.name)} <span class="mx-syn hi">+${e.syn.toFixed(2).replace(/^0/, '')}</span></span>`; }).join('')}</div>` : '<p class="note">Nothing high-synergy is missing.</p>'}
        <p class="note">Numbers: <a href="https://edhrec.com/commanders/${SYN.slug}" target="_blank" rel="noopener">EDHREC</a>. Synergy is how much more often this commander's decks play a card than other decks in the same colors; staples like Sol Ring sit near 0.</p></div>`;
}
// hook into the builder: start the load when a Commander deck's panel is drawn, add the panel to the stats
{
    const rdp = renderDeckPanel;
    renderDeckPanel = function () {
        const d = editing;
        if (d && d.format === 'commander' && d.commander && CARDS.get(d.commander)) { const slug = edhrecSlug(CARDS.get(d.commander).name); if (SYN.slug !== slug) synLoad(CARDS.get(d.commander)); }
        return rdp.apply(this, arguments);
    };
    const rbs = renderBuilderStats;
    renderBuilderStats = function () {
        const r = rbs.apply(this, arguments);
        try { const el = $('mxStats'); if (el && editing) el.insertAdjacentHTML('beforeend', synPanelHTML(editing)); } catch (e) { /* optional */ }
        return r;
    };
}
