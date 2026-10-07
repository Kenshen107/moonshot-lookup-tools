// =====================================================================
// Start-up
// =====================================================================
async function init() {
    ensureProfile();
    renderAccounts();
    const v = (location.hash || '').slice(1);
    showView(VIEWS.includes(v) ? v : 'home');
    window.addEventListener('beforeunload', persistCards);
    loadBasics().catch(() => {});
    if (AUTOPLAY) autoTest();
    else if (needsOnboarding()) preconPicker(true);
}

// Testing hook (?autoplay&a=burn&b=stompy, or b=<commander slug> with
// format=commander): builds both decks and lets the AI play both sides.
async function autoTest() {
    const q = new URLSearchParams(location.search);
    const format = q.get('format') || 'modern';
    try {
        let A, B;
        if (format === 'commander') {
            A = await buildCommanderDeck(q.get('a'));
            B = await buildCommanderDeck(q.get('b'));
        } else if (format === 'list') {
            // Pasted decklists (saved in this browser as duels:testListA / duels:testListB); b can be a commander slug instead
            A = await listToOppDeck(store.get('testListA', ''), 'commander');
            B = q.get('b') ? await buildCommanderDeck(q.get('b')) : await listToOppDeck(store.get('testListB', '') || store.get('testListA', ''), 'commander');
        } else if (format === 'precon') {
            // Real precons from MTGJSON by file name: format=precon&a=<file>&b=<file>
            const list = await loadPreconList();
            const find = f => list.find(p => p.file === f) || { file: f, name: f, type: 'Welcome Deck' };
            A = await loadPreconDeck(find(q.get('a')));
            B = await loadPreconDeck(find(q.get('b')));
        } else if (format === 'draft') {
            // A whole draft with 8 computer drafters, then two of their decks: format=draft&set=mrd&a=0&b=3
            const r = await autoDraftTest(q.get('set') || 'mrd');
            A = r.A; B = r.B;
        } else if (format === 'boss') {
            // Personality decks at set AI levels: format=boss&a=marcus&b=greg&la=hard&lb=easy
            const PA = PERSONALITIES[q.get('a')], PB = PERSONALITIES[q.get('b')];
            A = { ...(await buildBossDeck(PA)), aiLevel: q.get('la') || 'hard', aiStyle: PA.duel.style };
            B = { ...(await buildBossDeck(PB)), aiLevel: q.get('lb') || 'hard', aiStyle: PB.duel.style };
        } else {
            A = await buildThemeDeck(MODERN_THEMES.find(t => t.key === (q.get('a') || 'burn')));
            B = await buildThemeDeck(MODERN_THEMES.find(t => t.key === (q.get('b') || 'stompy')));
        }
        B.source = 'test';
        window.autoDecks = { A, B };
        newGame(A, B);
    } catch (e) {
        window.lastResult = { error: String(e && e.stack || e) };
    }
}

init();
