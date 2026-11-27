// =====================================================================
// Hidden UI Stress-Test Lab (2026-11-27, owner's request: "a test lab
// that just the bot knows how to access to be able to test lots of
// variables: a whole bunch of cards in hand, a lot of creatures, a lot
// of effects on stack").
//
// COMPLETELY HIDDEN from normal players (no buttons or visible UI).
// Access via URL query or JS API:
//   ?uilab=stress                  4-player pod, 14 hand, 12+ creatures, 5 stack, arrows, deals, bubble
//   ?uilab=crowded                 4-player pod, 20 hand, 22 creatures (compact tiles), 6 stack
//   ?uilab=combat                  4-player pod, live combat arrows (4 attackers, 2 blockers, 3 stack)
//   ?uilab=duel                    1v1 duel, 10 hand, 6 creatures, 4 stack, targeting arrow
//   ?uilab=custom&players=4&hand=14&creatures=12&lands=10&stack=5&attackers=3&blockers=2&life=8&deals=1&talk=1
//   window.__UI_LAB.spawn({ ... }) / window.__UI_LAB.audit()
// =====================================================================
'use strict';

window.__UI_LAB = (function () {
    const PRESETS = {
        stress:  { players: 4, hand: 14, creatures: 12, oppCreatures: 10, lands: 10, stack: 5, attackers: 3, blockers: 1, life: 9, deals: 1, arch: 2, talk: 1, tokens: 6, attach: 1 },
        crowded: { players: 4, hand: 20, creatures: 22, oppCreatures: 20, lands: 14, stack: 6, attackers: 4, blockers: 2, life: 18, deals: 1, arch: 1, talk: 1, tokens: 12, attach: 1 },
        combat:  { players: 4, hand: 8,  creatures: 6,  oppCreatures: 5,  lands: 7,  stack: 3, attackers: 4, blockers: 2, life: 24, deals: 1, arch: 2, talk: 1, tokens: 4, attach: 1 },
        duel:    { players: 2, hand: 10, creatures: 6,  oppCreatures: 5,  lands: 8,  stack: 4, attackers: 2, blockers: 1, life: 14, deals: 0, arch: 0, talk: 0, tokens: 3, attach: 1 },
        pod:     { players: 4, hand: 7,  creatures: 4,  oppCreatures: 3,  lands: 6,  stack: 2, attackers: 2, blockers: 0, life: 36, deals: 1, arch: 0, talk: 1, tokens: 0, attach: 0 }
    };

    const SAMPLE_NAMES = [
        'Tyrox, Saurid Tyrant', 'Brudiclad, Telchor Engineer', 'Sandman, Shifting Scoundrel', 'Odric, Lunarch Marshal',
        'Mountain', 'Island', 'Forest', 'Plains', 'Swamp',
        'Sol Ring', 'Arcane Signet', 'Lightning Greaves', 'Swiftfoot Boots', 'Skullclamp',
        'Lightning Bolt', 'Counterspell', 'Swords to Plowshares', 'Chaos Warp', 'Beast Within',
        'Goblin Guide', 'Llanowar Elves', 'Serra Angel', 'Shivan Dragon', 'Sun Titan',
        'Goblin Rabblemaster', 'Glorybringer', 'Combat Celebrant', 'Siege-Gang Commander',
        'Hellrider', 'Terror of the Peaks', 'Cultivate', 'Blasphemous Act'
    ];

    function stubCard(name, idx) {
        const isLand = ['Mountain', 'Island', 'Forest', 'Plains', 'Swamp'].includes(name);
        const isInst = ['Lightning Bolt', 'Counterspell', 'Swords to Plowshares', 'Chaos Warp', 'Beast Within'].includes(name);
        const isArt = ['Sol Ring', 'Arcane Signet', 'Lightning Greaves', 'Swiftfoot Boots', 'Skullclamp'].includes(name);
        const isSorc = ['Cultivate', 'Blasphemous Act'].includes(name);
        const col = name === 'Island' || name === 'Counterspell' ? ['U'] : name === 'Forest' || name === 'Llanowar Elves' || name === 'Cultivate' ? ['G'] : name === 'Plains' || name === 'Serra Angel' || name === 'Swords to Plowshares' ? ['W'] : isArt ? [] : ['R'];
        return {
            id: 'uilab-' + idx + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name, cmc: isLand ? 0 : isInst ? 1 : 3, mana: isLand ? '' : isInst ? '{R}' : '{2}{R}',
            type: isLand ? `Basic Land — ${name}` : isInst ? 'Instant' : isSorc ? 'Sorcery' : isArt ? 'Artifact — Equipment' : 'Creature — Warrior',
            text: isLand ? `{T}: Add {${col[0] || 'C'}}.` : isInst ? 'Deal 3 damage to any target.' : '',
            colors: col, ci: col, power: (!isLand && !isInst && !isArt && !isSorc) ? '3' : undefined,
            toughness: (!isLand && !isInst && !isArt && !isSorc) ? '3' : undefined,
            img: '', imgS: '', usd: 1, rarity: 'rare'
        };
    }

    async function loadPool() {
        const map = {};
        try {
            const parsed = parseDeckText(SAMPLE_NAMES.map(n => '1 ' + n).join('\n'));
            const rows = await resolveDeckCards([...parsed.commander, ...parsed.main]);
            rows.forEach(r => { if (r && r.card) { CARDS.set(r.card.id, r.card); map[r.card.name] = r.card; } });
        } catch (e) { /* offline fallback below */ }
        SAMPLE_NAMES.forEach((n, i) => {
            if (!map[n]) { const s = stubCard(n, i); CARDS.set(s.id, s); map[n] = s; }
        });
        return map;
    }

    async function spawn(opts) {
        const preset = typeof opts === 'string' ? (PRESETS[opts] || PRESETS.stress) : Object.assign({}, PRESETS.stress, opts || {});
        if (typeof closeModal === 'function') closeModal();
        if (typeof closeSheet === 'function') closeSheet();
        const C = await loadPool();
        const cmdrs = ['Tyrox, Saurid Tyrant', 'Brudiclad, Telchor Engineer', 'Sandman, Shifting Scoundrel', 'Odric, Lunarch Marshal'];
        const basics = ['Mountain', 'Island', 'Forest', 'Plains'];
        const creaturesPool = ['Goblin Guide', 'Goblin Rabblemaster', 'Combat Celebrant', 'Glorybringer', 'Hellrider', 'Terror of the Peaks', 'Siege-Gang Commander', 'Serra Angel', 'Shivan Dragon', 'Sun Titan', 'Llanowar Elves'];
        const spellsPool = ['Lightning Bolt', 'Counterspell', 'Swords to Plowshares', 'Chaos Warp', 'Beast Within', 'Skullclamp', 'Sol Ring', 'Arcane Signet', 'Lightning Greaves', 'Cultivate', 'Blasphemous Act'];

        const mkDeck = i => ({
            name: `${cmdrs[i % cmdrs.length].split(',')[0]} Lab`,
            format: preset.players > 2 ? 'commander' : 'commander',
            commander: C[cmdrs[i % cmdrs.length]],
            entries: [{ card: C[basics[i % basics.length]], n: 60 }, { card: C['Lightning Bolt'], n: 10 }, { card: C['Goblin Guide'], n: 10 }, { card: C['Sol Ring'], n: 10 }, { card: C['Chaos Warp'], n: 9 }],
            source: 'UI Lab'
        });

        const nPlayers = Math.max(2, Math.min(4, Number(preset.players) || 4));
        const decks = [];
        for (let i = 0; i < nPlayers; i++) decks.push(mkDeck(i));

        // Prevent AI auto-loop and mulligan dialog from blocking the instant stress setup
        const prevTest = window.__TEST;
        const origMull = window.mulligan;
        window.__TEST = true;
        window.mulligan = () => Promise.resolve();
        try {
            await newGame(decks[0], decks[1], null, decks.slice(2));
        } finally {
            window.__TEST = prevTest;
            window.mulligan = origMull;
        }
        if (typeof closeModal === 'function') closeModal();

        G.active = 0; G.view = 0; G.turn = 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.over = false; G.mode = null;
        G.players.forEach(P => { P.bf.length = 0; P.hand.length = 0; P.gy.length = 0; P.exile.length = 0; });
        G.stack.length = 0; G.attackers = []; G.blocks = {};

        const put = (P, card, extra) => {
            const o = makeObj(card, P.i);
            putOntoBattlefield(P, o);
            o.sick = false;
            Object.assign(o, extra || {});
            return o;
        };

        // Populate every player's lands, creatures, graveyard & life
        G.players.forEach((P, pi) => {
            P.life = pi === 0 ? (Number(preset.life) || 24) : (40 - pi * 6);
            const nLands = Number(preset.lands) || 8;
            for (let i = 0; i < nLands; i++) put(P, C[basics[pi % basics.length]], { tapped: i < Math.floor(nLands * 0.45) });
            put(P, C['Sol Ring'], { tapped: pi % 2 === 0 });
            put(P, C['Arcane Signet'], { tapped: false });
            // Graveyard cards so 3D graveyard art pile renders
            P.gy.push(makeObj(C[spellsPool[pi % spellsPool.length]], P.i), makeObj(C[creaturesPool[pi % creaturesPool.length]], P.i));

            const nCr = pi === 0 ? (Number(preset.creatures) || 8) : (Number(preset.oppCreatures != null ? preset.oppCreatures : preset.creatures) || 6);
            let firstCr = null;
            for (let i = 0; i < nCr; i++) {
                const card = C[creaturesPool[(i + pi * 3) % creaturesPool.length]];
                const o = put(P, card, {
                    counters: i === 0 ? 2 : i === 2 ? 1 : 0,
                    dmg: i === 1 ? 1 : 0,
                    sick: i === nCr - 1,
                    tapped: i === 3
                });
                if (!firstCr) firstCr = o;
            }
            if (preset.tokens && Number(preset.tokens) > 0) {
                const tokCard = { ...C['Goblin Guide'], id: `tok-${pi}`, name: 'Goblin Token', power: '1', toughness: '1', type: 'Token Creature — Goblin', cmc: 0 };
                for (let t = 0; t < Number(preset.tokens); t++) {
                    const o = put(P, tokCard, { token: true, sick: false });
                }
            }
            if (preset.attach && firstCr) {
                const eq = put(P, C['Lightning Greaves']);
                eq.attachedTo = firstCr.uid;
            }
            // Opponent hand cards
            if (pi > 0) {
                for (let h = 0; h < 6; h++) P.hand.push(makeObj(C[spellsPool[h % spellsPool.length]], P.i));
            }
        });

        // Player 0 hand (configurable size!)
        const meP = G.players[0];
        const nHand = Number(preset.hand) || 12;
        for (let i = 0; i < nHand; i++) {
            const card = C[(i % 2 === 0 ? spellsPool : creaturesPool)[i % 10]];
            meP.hand.push(makeObj(card, 0));
        }

        // Politics: Archenemy & active deals in pods
        if (G.players.length > 2) {
            if (preset.arch) G.arch = Math.min(G.players.length - 1, Number(preset.arch));
            if (preset.deals) {
                G.deals = [
                    { type: 'peace', a: 0, b: 1, x: null, owner: 0, turn: G.turn, over: false, left: 1 },
                    { type: 'pact', a: 0, b: 3 % G.players.length, x: 2, owner: 0, turn: G.turn, over: false, left: 1 }
                ];
            }
            meP.cmdBy[1] = 8;
        }

        // Combat attackers & blockers for live SVG arrows
        const myCrs = meP.bf.filter(o => isCreature(o) && !o.tapped && !o.sick);
        const oppP = G.players[1];
        const oppCrs = oppP.bf.filter(o => isCreature(o) && !o.tapped);
        const nAtk = Math.min(Number(preset.attackers) || 0, myCrs.length);
        if (nAtk > 0) {
            G.phase = 'afterBlocks';
            G.defender = 1;
            for (let i = 0; i < nAtk; i++) {
                const a = myCrs[i];
                a.tapped = true;
                if (G.players.length > 2) a.atkTo = (i % (G.players.length - 1)) + 1;
                G.attackers.push(a.uid);
            }
            const nBlk = Math.min(Number(preset.blockers) || 0, nAtk, oppCrs.length);
            for (let i = 0; i < nBlk; i++) {
                G.blocks[G.attackers[i]] = [oppCrs[i].uid];
            }
        }

        // Stack items with targets (live cyan SVG targeting arrows + right-side Arena stack!)
        const nStack = Number(preset.stack) || 0;
        for (let i = 0; i < nStack; i++) {
            const card = C[spellsPool[i % spellsPool.length]];
            const obj = makeObj(card, i % G.players.length);
            const tgt = i % 3 === 0 && oppCrs[0] ? { o: oppCrs[0] } : i % 3 === 1 && myCrs[0] ? { o: myCrs[0] } : { p: G.players[1] };
            G.stack.push({ id: 7000 + i, kind: i % 2 ? 'trigger' : 'spell', o: obj, P: G.players[i % G.players.length], effects: [], target: tgt, name: i % 2 ? `${card.name}'s triggered ability` : card.name });
        }

        // Populate rich Game Log entries
        G.log = [
            '— Turn 7: Brudiclad, Telchor Engineer\'s turn —',
            'Brudiclad, Telchor Engineer casts Arcane Signet.',
            '😄 Sarah: "Watch this token engine go off!"',
            '— Turn 8: your turn —',
            'You play Mountain.',
            'You cast Lightning Greaves.',
            'You cast Terror of the Peaks.',
            'Goblin Rabblemaster attacks Brudiclad, Telchor Engineer.',
            'Lightning Bolt deals 3 damage to Serra Angel.',
            'Serra Angel dies.'
        ];
        if (typeof log === 'function') log('UI Lab ready: stress state loaded.');

        $('game').classList.remove('hidden');
        if (typeof setBoardStyle === 'function') setBoardStyle(preset.view === 'classic' ? 'classic' : 'open');
        renderGame();
        fitTable();

        // Optional live speech bubble
        if (preset.talk && G.players.length > 2 && typeof showBubble === 'function') {
            showBubble(G.players[1], 'worried', 'Whoa, that board is getting huge — anyone want to make a deal?');
        }
        return audit();
    }

    function boxesOverlap(a, b, pad = 0) {
        if (!a || !b || (!a.width && !a.height) || (!b.width && !b.height)) return false;
        return a.left < b.right - pad && a.right > b.left + pad && a.top < b.bottom - pad && a.bottom > b.top + pad;
    }

    function audit() {
        const r = el => el ? el.getBoundingClientRect() : null;
        const handCards = [...document.querySelectorAll('#hand .hc')].map(r).filter(Boolean);
        const rail = r(document.querySelector('#midBar .phase-strip'));
        const turnBtn = r($('turnBtn'));
        const logSum = r(document.querySelector('#logWrap > summary'));
        const tools = r(document.querySelector('.hand-tools'));
        const oppSide = r($('oppSide'));
        const meSide = r($('meSide'));
        const strip = r(document.querySelector('.pod-strip'));
        return {
            viewport: { w: innerWidth, h: innerHeight },
            scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            counts: {
                players: G ? G.players.length : 0,
                hand: handCards.length,
                myPerms: document.querySelectorAll('#meSide .perm').length,
                oppPerms: document.querySelectorAll('#oppSide .perm').length,
                stackShown: document.querySelectorAll('#midBar .stack-item').length,
                stackTotal: G ? G.stack.length : 0,
                arrows: document.querySelectorAll('#arenaArrows .arw-line').length
            },
            heights: {
                oppBar: Math.round((r($('oppBar')) || {}).height || 0),
                oppSide: Math.round((oppSide || {}).height || 0),
                meSide: Math.round((meSide || {}).height || 0),
                dock: Math.round((r(document.querySelector('.dock')) || {}).height || 0)
            },
            overlaps: {
                railVsHand: handCards.some(c => boxesOverlap(c, rail)),
                logVsTurnBtn: boxesOverlap(logSum, turnBtn),
                logVsHand: handCards.some(c => boxesOverlap(c, logSum)),
                toolsVsHand: handCards.some(c => boxesOverlap(c, tools)),
                stripOverflowX: strip ? strip.right > innerWidth + 1 : false
            }
        };
    }

    // Auto-boot silently ONLY when ?uilab=<preset> is present in the URL (waits for all scripts including 07g & 16-startup!)
    const q = new URLSearchParams(location.search);
    const labParam = q.get('uilab');
    if (labParam) {
        let tries = 0;
        const bootLab = () => {
            if (typeof newGame !== 'function' || typeof renderGame !== 'function' || typeof who !== 'function' || typeof profile === 'undefined' || !profile) {
                if (++tries < 120) setTimeout(bootLab, 100);
                return;
            }
            const opts = PRESETS[labParam] ? { ...PRESETS[labParam] } : { ...PRESETS.stress };
            ['players', 'hand', 'creatures', 'oppCreatures', 'lands', 'stack', 'attackers', 'blockers', 'life', 'deals', 'arch', 'talk', 'tokens', 'attach'].forEach(k => {
                if (q.has(k)) opts[k] = Number(q.get(k));
            });
            if (q.has('view')) opts.view = q.get('view');
            spawn(opts);
        };
        setTimeout(bootLab, 150);
    }

    return { spawn, audit, PRESETS };
})();
