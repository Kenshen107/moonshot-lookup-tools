// =====================================================================
// Hidden UI & Gameplay Test Lab (2026-11-27, owner's request:
// "lets create test labs for all sorts of things will make testing easier").
//
// COMPLETELY HIDDEN from normal players (zero DOM, zero CSS, zero UI
// unless ?uilab=<preset> is in the URL or window.__UI_LAB.openPanel()
// is called from DevTools).
//
// Presets (?uilab=<name>):
//   early     Turn 2 clean 1v1 start (2 lands, 1 creature, 6 hand)
//   duel      1v1 mid-game (10 hand, 6 creatures, 8 lands, 4 stack)
//   pod       4-player Commander mid-game (deals, speech bubble)
//   stress    4-player heavy stress (14 hand, 12+6 cr, 5 stack, arrows, low life)
//   crowded   4-player extreme overflow (20 hand, 22+12 cr -> compact tiles)
//   attack    Live Declare Attackers mode (cyan halos, chevrons, All Attack)
//   block     Live Declare Blockers mode (4 incoming attackers, 5 blockers)
//   pay       Live Manual Mana Payment mode (8 untapped lands ready to tap)
//   target    Live Target Selection mode (cursor-tracking gold targeting arrow)
//   stackwar  Deep 10-item counterspell & trigger stack war
//   swarm     Giant token swarm & shingled piles (30 Goblins, 20 Soldiers, 12 Treasures)
//   keywords  All 13 keyword badges + legendary crowns + counters + sickness
//   lowlife   Danger state (life 4 pulsing, 18/21 cmd dmg, 8 poison, lethal board)
//   attach    Voltron equipment/aura stack + planeswalker loyalty showcase
//   custom    Override any param via &players=&hand=&creatures=&lands=&stack=&...
//
// JS API: window.__UI_LAB.{ spawn, audit, spawnCard, act, openPanel, PRESETS }
// =====================================================================
'use strict';

window.__UI_LAB = (function () {
    const PRESETS = {
        early:    { label: 'Early',     players: 2, hand: 6,  creatures: 1,  oppCreatures: 1,  lands: 2,  stack: 0, attackers: 0, blockers: 0, life: 20, deals: 0, arch: 0, talk: 0, tokens: 0, attach: 0, mode: null },
        duel:     { label: '1v1 Duel',  players: 2, hand: 10, creatures: 6,  oppCreatures: 5,  lands: 8,  stack: 4, attackers: 2, blockers: 1, life: 14, deals: 0, arch: 0, talk: 0, tokens: 3, attach: 1, mode: null },
        pod:      { label: '4P Pod',    players: 4, hand: 7,  creatures: 4,  oppCreatures: 3,  lands: 6,  stack: 2, attackers: 2, blockers: 0, life: 36, deals: 1, arch: 0, talk: 1, tokens: 0, attach: 0, mode: null },
        stress:   { label: 'Stress',    players: 4, hand: 14, creatures: 12, oppCreatures: 10, lands: 10, stack: 5, attackers: 3, blockers: 1, life: 9,  deals: 1, arch: 2, talk: 1, tokens: 6, attach: 1, mode: null },
        crowded:  { label: 'Crowded',   players: 4, hand: 20, creatures: 22, oppCreatures: 20, lands: 14, stack: 6, attackers: 4, blockers: 2, life: 18, deals: 1, arch: 1, talk: 1, tokens: 12, attach: 1, mode: null },
        attack:   { label: 'Attack',    players: 4, hand: 7,  creatures: 7,  oppCreatures: 4,  lands: 7,  stack: 0, attackers: 0, blockers: 0, life: 32, deals: 1, arch: 0, talk: 0, tokens: 2, attach: 1, mode: 'attack' },
        block:    { label: 'Block',     players: 2, hand: 6,  creatures: 5,  oppCreatures: 5,  lands: 6,  stack: 0, attackers: 0, blockers: 0, life: 16, deals: 0, arch: 0, talk: 0, tokens: 0, attach: 0, mode: 'block' },
        pay:      { label: 'Mana Pay',  players: 2, hand: 7,  creatures: 3,  oppCreatures: 3,  lands: 8,  stack: 0, attackers: 0, blockers: 0, life: 20, deals: 0, arch: 0, talk: 0, tokens: 0, attach: 0, mode: 'pay' },
        target:   { label: 'Target',    players: 4, hand: 8,  creatures: 6,  oppCreatures: 6,  lands: 7,  stack: 1, attackers: 0, blockers: 0, life: 28, deals: 1, arch: 0, talk: 0, tokens: 0, attach: 0, mode: 'target' },
        stackwar: { label: 'Stack War', players: 4, hand: 9,  creatures: 5,  oppCreatures: 5,  lands: 9,  stack: 10, attackers: 1, blockers: 0, life: 22, deals: 1, arch: 1, talk: 1, tokens: 0, attach: 0, mode: null },
        swarm:    { label: 'Swarm',     players: 4, hand: 8,  creatures: 3,  oppCreatures: 3,  lands: 12, stack: 2, attackers: 0, blockers: 0, life: 34, deals: 1, arch: 2, talk: 0, tokens: 30, attach: 0, swarm: 1, mode: null },
        keywords: { label: 'Keywords',  players: 2, hand: 7,  creatures: 0,  oppCreatures: 4,  lands: 8,  stack: 1, attackers: 0, blockers: 0, life: 25, deals: 0, arch: 0, talk: 0, tokens: 0, attach: 0, keywords: 1, mode: null },
        lowlife:  { label: 'Low Life',  players: 4, hand: 6,  creatures: 4,  oppCreatures: 6,  lands: 8,  stack: 2, attackers: 0, blockers: 0, life: 4,  deals: 1, arch: 1, talk: 1, tokens: 0, attach: 1, poison: 8, cmdDmg: 18, mode: null },
        attach:   { label: 'Voltron',   players: 2, hand: 7,  creatures: 3,  oppCreatures: 3,  lands: 7,  stack: 0, attackers: 0, blockers: 0, life: 26, deals: 0, arch: 0, talk: 0, tokens: 0, attach: 3, pw: 1, mode: null }
    };

    const SAMPLE_NAMES = [
        'Tyrox, Saurid Tyrant', 'Brudiclad, Telchor Engineer', 'Sandman, Shifting Scoundrel', 'Odric, Lunarch Marshal',
        'Mountain', 'Island', 'Forest', 'Plains', 'Swamp',
        'Sol Ring', 'Arcane Signet', 'Lightning Greaves', 'Swiftfoot Boots', 'Skullclamp',
        'Lightning Bolt', 'Counterspell', 'Swords to Plowshares', 'Chaos Warp', 'Beast Within',
        'Goblin Guide', 'Llanowar Elves', 'Serra Angel', 'Shivan Dragon', 'Sun Titan',
        'Goblin Rabblemaster', 'Glorybringer', 'Combat Celebrant', 'Siege-Gang Commander',
        'Hellrider', 'Terror of the Peaks', 'Cultivate', 'Blasphemous Act',
        'Vampire Nighthawk', 'Baneslayer Angel', 'Questing Beast', 'Wall of Omens', 'Jace Beleren'
    ];

    let poolCache = null;
    let activePresetName = 'stress';
    const PHASES = ['upkeep', 'main1', 'declareAttackers', 'main2', 'end'];

    function stubCard(name, idx) {
        const isLand = ['Mountain', 'Island', 'Forest', 'Plains', 'Swamp'].includes(name);
        const isInst = ['Lightning Bolt', 'Counterspell', 'Swords to Plowshares', 'Chaos Warp', 'Beast Within'].includes(name);
        const isArt = ['Sol Ring', 'Arcane Signet', 'Lightning Greaves', 'Swiftfoot Boots', 'Skullclamp'].includes(name);
        const isSorc = ['Cultivate', 'Blasphemous Act'].includes(name);
        const isPW = /Jace/i.test(name);
        const col = /Island|Counterspell|Jace/i.test(name) ? ['U'] : /Forest|Llanowar|Cultivate|Questing/i.test(name) ? ['G'] : /Plains|Serra|Swords|Baneslayer|Wall|Odric/i.test(name) ? ['W'] : /Swamp|Vampire/i.test(name) ? ['B'] : isArt ? [] : ['R'];
        return {
            id: 'uilab-' + idx + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name, cmc: isLand ? 0 : isInst ? 1 : 3, mana: isLand ? '' : isInst ? '{R}' : '{2}{R}',
            type: isLand ? `Basic Land — ${name}` : isInst ? 'Instant' : isSorc ? 'Sorcery' : isPW ? 'Legendary Planeswalker — Jace' : isArt ? 'Artifact — Equipment' : 'Creature — Warrior',
            text: isLand ? `{T}: Add {${col[0] || 'C'}}.` : isInst ? 'Deal 3 damage to any target.' : '',
            colors: col, ci: col,
            power: (!isLand && !isInst && !isArt && !isSorc && !isPW) ? '3' : undefined,
            toughness: (!isLand && !isInst && !isArt && !isSorc && !isPW) ? '3' : undefined,
            loyalty: isPW ? '3' : undefined,
            img: '', imgS: '', usd: 1, rarity: 'rare'
        };
    }

    async function loadPool() {
        if (poolCache) return poolCache;
        const map = {};
        try {
            const parsed = parseDeckText(SAMPLE_NAMES.map(n => '1 ' + n).join('\n'));
            const rows = await resolveDeckCards([...parsed.commander, ...parsed.main]);
            rows.forEach(r => { if (r && r.card) { CARDS.set(r.card.id, r.card); map[r.card.name] = r.card; } });
        } catch (e) { /* offline fallback below */ }
        SAMPLE_NAMES.forEach((n, i) => {
            if (!map[n]) { const s = stubCard(n, i); CARDS.set(s.id, s); map[n] = s; }
        });
        poolCache = map;
        return map;
    }

    function refreshAll() {
        if (typeof renderGame === 'function') renderGame();
        if (typeof fitTable === 'function') fitTable();
        syncPanelState();
    }

    async function spawn(opts) {
        if (typeof opts === 'string' && PRESETS[opts]) activePresetName = opts;
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
            format: 'commander',
            commander: C[cmdrs[i % cmdrs.length]],
            entries: [{ card: C[basics[i % basics.length]], n: 60 }, { card: C['Lightning Bolt'], n: 10 }, { card: C['Goblin Guide'], n: 10 }, { card: C['Sol Ring'], n: 10 }, { card: C['Chaos Warp'], n: 9 }],
            source: 'UI Lab'
        });

        const nPlayers = Math.max(2, Math.min(4, Number(preset.players) || 4));
        const decks = [];
        for (let i = 0; i < nPlayers; i++) decks.push(mkDeck(i));

        // Prevent AI auto-loop, background startTurn, and mulligan dialog from clobbering instant preset setup
        const prevTest = window.__TEST;
        const origMull = window.mulligan;
        const origStart = window.startTurn;
        window.__TEST = true;
        window.mulligan = () => Promise.resolve();
        if (typeof origStart === 'function') window.startTurn = () => Promise.resolve();
        try {
            await newGame(decks[0], decks[1], null, decks.slice(2));
        } finally {
            window.__TEST = prevTest;
            window.mulligan = origMull;
            if (typeof origStart === 'function') window.startTurn = origStart;
        }
        if (typeof closeModal === 'function') closeModal();

        G.active = 0; G.view = 0; G.turn = preset.lands <= 3 ? 2 : 8; G.phase = 'main1'; G.busy = false; G.firstTurn = false; G.over = false; G.mode = null;
        G.players.forEach(P => { P.bf.length = 0; P.hand.length = 0; P.gy.length = 0; P.exile.length = 0; });
        G.stack.length = 0; G.attackers = []; G.blocks = {};

        const put = (P, card, extra) => {
            const o = makeObj(card, P.i);
            o.owner = P.i;
            P.bf.push(o);
            o.sick = false;
            Object.assign(o, extra || {});
            return o;
        };

        G.players.forEach((P, pi) => {
            P.life = pi === 0 ? (Number(preset.life) || 24) : (40 - pi * 6);
            if (pi === 0 && preset.poison) P.poison = Number(preset.poison);
            const nLands = Number(preset.lands) || 0;
            for (let i = 0; i < nLands; i++) put(P, C[basics[pi % basics.length]], { tapped: preset.mode === 'pay' ? false : i < Math.floor(nLands * 0.45) });
            if (nLands >= 4) {
                put(P, C['Sol Ring'], { tapped: preset.mode === 'pay' ? false : pi % 2 === 0 });
                put(P, C['Arcane Signet'], { tapped: false });
            }
            if (nLands >= 4) P.gy.push(makeObj(C[spellsPool[pi % spellsPool.length]], P.i), makeObj(C[creaturesPool[pi % creaturesPool.length]], P.i));

            const nCr = pi === 0 ? (Number(preset.creatures) || 0) : (Number(preset.oppCreatures != null ? preset.oppCreatures : preset.creatures) || 0);
            let firstCr = null;
            for (let i = 0; i < nCr; i++) {
                const card = C[creaturesPool[(i + pi * 3) % creaturesPool.length]];
                const o = put(P, card, {
                    counters: i === 0 ? 2 : i === 2 ? 1 : 0,
                    dmg: i === 1 ? 1 : 0,
                    sick: preset.mode === 'attack' ? false : i === nCr - 1 && nCr > 2,
                    tapped: (preset.mode === 'attack' || preset.mode === 'block') ? false : i === 3
                });
                if (!firstCr) firstCr = o;
            }
            if (preset.tokens && Number(preset.tokens) > 0) {
                const tokCard = { ...C['Goblin Guide'], id: `tok-gob-${pi}`, name: 'Goblin Token', power: '1', toughness: '1', type: 'Token Creature — Goblin', cmc: 0 };
                for (let t = 0; t < Number(preset.tokens); t++) put(P, tokCard, { token: true, sick: false });
            }
            if (preset.swarm && pi === 0) {
                const solCard = { ...C['Serra Angel'], id: 'tok-sol-0', name: 'Soldier Token', power: '1', toughness: '1', type: 'Token Creature — Soldier', cmc: 0, text: 'Vigilance' };
                const trCard = { ...C['Sol Ring'], id: 'tok-trs-0', name: 'Treasure Token', type: 'Token Artifact — Treasure', cmc: 0, text: '{T}, Sacrifice this artifact: Add one mana of any color.' };
                for (let t = 0; t < 20; t++) put(P, solCard, { token: true, sick: false });
                for (let t = 0; t < 12; t++) put(P, trCard, { token: true, sick: false });
            }
            const nAtt = Number(preset.attach) || 0;
            if (nAtt > 0 && firstCr) {
                const eqList = ['Lightning Greaves', 'Swiftfoot Boots', 'Skullclamp'];
                for (let a = 0; a < Math.min(nAtt, eqList.length); a++) {
                    const eq = put(P, C[eqList[a]]);
                    eq.attachedTo = firstCr.uid;
                }
            }
            if (preset.pw && pi === 0 && C['Jace Beleren']) {
                put(P, C['Jace Beleren'], { ctr: { loyalty: 5 } });
            }
            if (pi > 0) {
                for (let h = 0; h < 6; h++) P.hand.push(makeObj(C[spellsPool[h % spellsPool.length]], P.i));
            }
        });

        const meP = G.players[0];
        const oppP = G.players[1];

        // Keywords showcase: 6 sculpted showcase creatures covering ALL 13 keywords + legendary crown + counters
        if (preset.keywords) {
            const kwSpecs = [
                ['Serra Angel', { isCommander: true, counters: 2, tkw: ['flying', 'vigilance', 'indestructible'] }],
                ['Vampire Nighthawk', { counters: 1, tkw: ['flying', 'deathtouch', 'lifelink'] }],
                ['Questing Beast', { counters: -1, tkw: ['trample', 'haste', 'hexproof'] }],
                ['Baneslayer Angel', { dmg: 2, tkw: ['first strike', 'double strike', 'menace'] }],
                ['Wall of Omens', { sick: true, tkw: ['defender', 'reach'] }],
                ['Shivan Dragon', { tapped: true, counters: 3, tkw: ['flying', 'haste'] }]
            ];
            kwSpecs.forEach(([nm, ex]) => {
                const base = C[nm] || C['Serra Angel'];
                put(meP, { ...base, type: ex.isCommander ? 'Legendary Creature — Angel' : base.type }, ex);
            });
        }

        // Player 0 hand
        const nHand = Number(preset.hand) || 7;
        for (let i = 0; i < nHand; i++) {
            const card = C[(i % 2 === 0 ? spellsPool : creaturesPool)[i % 10]];
            meP.hand.push(makeObj(card, 0));
        }

        // Politics: Archenemy, deals & commander damage
        if (G.players.length > 2) {
            if (preset.arch) G.arch = Math.min(G.players.length - 1, Number(preset.arch));
            if (preset.deals) {
                G.deals = [
                    { type: 'peace', a: 0, b: 1, x: null, owner: 0, turn: G.turn, over: false, left: 1 },
                    { type: 'pact', a: 0, b: 3 % G.players.length, x: 2, owner: 0, turn: G.turn, over: false, left: 1 }
                ];
            }
            meP.cmdBy[1] = Number(preset.cmdDmg) || 8;
        }

        // Combat attackers & blockers for live SVG arrows
        const myCrs = meP.bf.filter(o => isCreature(o) && !o.tapped && !o.sick);
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
            for (let i = 0; i < nBlk; i++) G.blocks[G.attackers[i]] = [oppCrs[i].uid];
        }

        // Stack items with targets
        const nStack = Number(preset.stack) || 0;
        for (let i = 0; i < nStack; i++) {
            const card = C[spellsPool[i % spellsPool.length]];
            const obj = makeObj(card, i % G.players.length);
            const tgt = i % 3 === 0 && oppCrs[0] ? { o: oppCrs[0] } : i % 3 === 1 && myCrs[0] ? { o: myCrs[0] } : { p: G.players[1] };
            G.stack.push({ id: 7000 + i, kind: i % 2 ? 'trigger' : 'spell', o: obj, P: G.players[i % G.players.length], effects: [], target: tgt, name: i % 2 ? `${card.name}'s triggered ability` : card.name });
        }

        // Interactive modes for dedicated action presets
        if (preset.mode === 'attack') {
            G.phase = 'declareAttackers';
            G.defender = 1;
            G.mode = { type: 'attack', sel: new Set(), done: () => { G.mode = null; G.phase = 'main2'; refreshAll(); } };
        } else if (preset.mode === 'block') {
            G.active = 1; G.phase = 'declareBlocks'; G.defender = 0;
            oppCrs.slice(0, 4).forEach(a => { a.tapped = true; G.attackers.push(a.uid); });
            G.mode = { type: 'block', picked: null, done: () => { G.mode = null; G.active = 0; G.phase = 'main1'; G.attackers = []; G.blocks = {}; refreshAll(); } };
        } else if (preset.mode === 'pay') {
            G.phase = 'main1';
            G.mode = { type: 'pay', label: 'Cast Terror of the Peaks ({3}{R}{R})', cost: { generic: 3, colors: ['R', 'R'] }, cancel: () => { G.mode = null; refreshAll(); } };
        } else if (preset.mode === 'target') {
            G.phase = 'main1';
            const valid = [...oppCrs.map(o => ({ o })), ...myCrs.slice(0, 2).map(o => ({ o })), { p: oppP }];
            G.mode = { type: 'target', prompt: 'Choose a target for Lightning Bolt', source: myCrs[0] || null, valid, pick: () => { G.mode = null; refreshAll(); }, cancel: () => { G.mode = null; refreshAll(); } };
        }

        G.log = [
            '— Turn 7: Brudiclad, Telchor Engineer\'s turn —',
            'Brudiclad, Telchor Engineer casts Arcane Signet.',
            '😄 Sarah: "Watch this token engine go off!"',
            `— Turn ${G.turn}: your turn —`,
            'You play Mountain.',
            'You cast Terror of the Peaks.',
            'Lightning Bolt deals 3 damage to Serra Angel.'
        ];
        if (typeof log === 'function') log(`UI Lab ready: ${preset.label || activePresetName} loaded.`);

        $('game').classList.remove('hidden');
        if (typeof setBoardStyle === 'function') setBoardStyle(preset.view === 'classic' ? 'classic' : 'open');
        refreshAll();

        if (preset.talk && G.players.length > 2 && typeof showBubble === 'function') {
            showBubble(G.players[1], 'worried', 'Whoa, that board is getting huge — anyone want to make a deal?');
        }
        return audit();
    }

    // Spawn any arbitrary card by name into hand, your battlefield, opponent's battlefield, or stack
    async function spawnCard(name, where = 'hand') {
        if (!G || !name || !String(name).trim()) return null;
        const clean = String(name).trim();
        let card = null;
        try {
            const parsed = parseDeckText(`1 ${clean}`);
            const rows = await resolveDeckCards([...parsed.commander, ...parsed.main]);
            if (rows && rows[0] && rows[0].card) {
                card = rows[0].card;
                CARDS.set(card.id, card);
            }
        } catch (e) { /* offline fallback */ }
        if (!card) { card = stubCard(clean, Date.now()); CARDS.set(card.id, card); }
        const P = where === 'opp' ? (G.players[G.focus || 1] || G.players[1]) : G.players[0];
        const o = makeObj(card, P.i);
        if (where === 'hand') P.hand.push(o);
        else if (where === 'stack') G.stack.push({ id: Date.now() % 100000, kind: 'spell', o, P, effects: [], target: { p: G.players[1] }, name: card.name });
        else { o.owner = P.i; P.bf.push(o); o.sick = false; }
        refreshAll();
        return o;
    }

    // Interactive state mutators for rapid testing
    async function act(kind) {
        if (!G) return;
        const C = await loadPool();
        const meP = G.players[0];
        const oppP = G.players[G.focus || 1] || G.players[1];
        const drawPool = ['Lightning Bolt', 'Swords to Plowshares', 'Counterspell', 'Serra Angel', 'Glorybringer', 'Sol Ring'];
        if (kind === 'draw1' || kind === 'draw5') {
            const n = kind === 'draw5' ? 5 : 1;
            for (let i = 0; i < n; i++) meP.hand.push(makeObj(C[drawPool[(meP.hand.length + i) % drawPool.length]], 0));
        } else if (kind === 'discard1') {
            if (meP.hand.length) meP.gy.push(meP.hand.pop());
        } else if (kind === 'mana5') {
            meP.pool = meP.pool || [];
            ['W', 'U', 'B', 'R', 'G'].forEach(c => meP.pool.push(c));
        } else if (kind === 'untap') {
            meP.bf.forEach(o => { o.tapped = false; });
        } else if (kind === 'life-5') {
            meP.life -= 5;
        } else if (kind === 'life+5') {
            meP.life += 5;
        } else if (kind === 'cmd+5') {
            meP.cmdBy[oppP.i] = (meP.cmdBy[oppP.i] || 0) + 5;
        } else if (kind === 'plus1') {
            meP.bf.filter(isCreature).forEach(o => { o.counters = (o.counters || 0) + 1; });
        } else if (kind === 'dmg1') {
            meP.bf.filter(isCreature).forEach(o => { o.dmg = (o.dmg || 0) + 1; });
        } else if (kind === 'sick') {
            meP.bf.filter(isCreature).forEach(o => { o.sick = !o.sick; });
        } else if (kind === 'goblins5') {
            const tok = { ...C['Goblin Guide'], id: 'tok-gob-0', name: 'Goblin Token', power: '1', toughness: '1', type: 'Token Creature — Goblin', cmc: 0 };
            for (let i = 0; i < 5; i++) { const o = makeObj(tok, 0); o.owner = 0; meP.bf.push(o); o.sick = false; }
        } else if (kind === 'nextPhase') {
            const idx = PHASES.indexOf(G.phase);
            G.phase = PHASES[(idx + 1) % PHASES.length];
            if (G.phase === 'upkeep') G.turn += 1;
        } else if (kind === 'clearMode') {
            G.mode = null; G.attackers = []; G.blocks = {};
        } else if (kind === 'endTurn') {
            G.mode = null; G.stack.length = 0; G.attackers = []; G.blocks = {};
            G.active = (G.active + 1) % G.players.length;
            G.phase = 'main1';
            if (G.active === 0) G.turn += 1;
        }
        refreshAll();
    }

    function boxesOverlap(a, b, pad = 0) {
        if (!a || !b || (!a.width && !a.height) || (!b.width && !b.height)) return false;
        return a.left < b.right - pad && a.right > b.left + pad && a.top < b.bottom - pad && a.bottom > b.top + pad;
    }

    function hitCheck(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return { visible: false, ok: false };
        const cx = Math.min(innerWidth - 1, Math.max(1, r.left + r.width / 2));
        const cy = Math.min(innerHeight - 1, Math.max(1, r.top + r.height / 2));
        const top = document.elementFromPoint(cx, cy);
        const ok = !!(top && (top === el || el.contains(top) || (top.closest && top.closest('button, summary') === el)));
        return { visible: true, ok, hitTag: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}${top.className && typeof top.className === 'string' ? '.' + top.className.trim().split(/\s+/)[0] : ''}` : 'none' };
    }

    function audit() {
        const r = el => el ? el.getBoundingClientRect() : null;
        const handCards = [...document.querySelectorAll('#hand .hc')].map(r).filter(Boolean);
        const rail = r(document.querySelector('#midBar .phase-strip'));
        const turnBtnEl = $('turnBtn');
        const logSumEl = document.querySelector('#logWrap > summary');
        const gearSumEl = document.querySelector('#arenaGear > summary');
        const firstHcEl = document.querySelector('#hand .hc');
        const turnBtn = r(turnBtnEl);
        const logSum = r(logSumEl);
        const tools = r(document.querySelector('.hand-tools'));
        const oppSideEl = $('oppSide');
        const meSideEl = $('meSide');
        const oppSide = r(oppSideEl);
        const meSide = r(meSideEl);
        const strip = r(document.querySelector('.pod-strip'));
        return {
            preset: activePresetName,
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
            scrollbars: {
                oppSide: !!(oppSideEl && oppSideEl.scrollHeight > oppSideEl.clientHeight + 2),
                meSide: !!(meSideEl && meSideEl.scrollHeight > meSideEl.clientHeight + 2)
            },
            hitTests: {
                turnBtn: hitCheck(turnBtnEl),
                logToggle: hitCheck(logSumEl),
                gearToggle: hitCheck(gearSumEl),
                firstHandCard: hitCheck(firstHcEl)
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

    // ---- Collapsible Floating Lab Control Bar (ONLY injected when ?uilab= is active!) ----
    function injectPanelCSS() {
        if ($('uiLabCSS')) return;
        const st = document.createElement('style');
        st.id = 'uiLabCSS';
        st.textContent = `
#uiLabBar { position: fixed; left: 10px; top: 8px; z-index: 98; font-family: var(--font-body, system-ui, sans-serif); font-size: 12px; color: var(--text-primary); }
#uiLabBar > summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--bg-canvas) 86%, var(--brand)); border: 1.5px solid var(--gold); color: var(--gold); font-weight: 700;
  box-shadow: 0 4px 16px var(--bg-canvas); user-select: none; }
#uiLabBar > summary::-webkit-details-marker { display: none; }
#uiLabBar .lab-body { margin-top: 6px; width: min(360px, calc(100vw - 20px)); max-height: calc(100vh - 64px); overflow-y: auto; padding: 10px;
  border-radius: 12px; background: color-mix(in srgb, var(--bg-panel) 95%, var(--bg-canvas)); border: 1px solid var(--brand-light);
  box-shadow: 0 18px 46px var(--bg-canvas); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); display: grid; gap: 8px; }
#uiLabBar .lab-h { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); margin-bottom: 3px; }
#uiLabBar .lab-row { display: flex; flex-wrap: wrap; gap: 4px; }
#uiLabBar button { font: inherit; font-size: 11px; padding: 3px 7px; border-radius: 6px; cursor: pointer;
  background: var(--bg-panel-raised); color: var(--text-primary); border: 1px solid var(--border); }
#uiLabBar button:hover { border-color: var(--gold); color: var(--text-heading); }
#uiLabBar button.on { background: var(--brand); border-color: var(--gold); color: var(--text-heading); font-weight: 700; }
#uiLabBar input { flex: 1 1 130px; min-width: 0; font: inherit; font-size: 12px; padding: 4px 7px; border-radius: 6px;
  background: var(--bg-inset); color: var(--text-heading); border: 1px solid var(--border); }
#uiLabBar .lab-audit { font-family: ui-monospace, Consolas, monospace; font-size: 11px; padding: 6px 8px; border-radius: 6px;
  background: var(--bg-inset); border: 1px solid var(--border-subtle); white-space: pre-wrap; line-height: 1.35; }
#uiLabBar .lab-ok { color: var(--color-success); } #uiLabBar .lab-bad { color: var(--color-error); }
`;
        document.head.appendChild(st);
    }

    function syncPanelState() {
        const bar = $('uiLabBar');
        if (!bar) return;
        bar.querySelectorAll('[data-lab-preset]').forEach(b => b.classList.toggle('on', b.dataset.labPreset === activePresetName));
        const curLook = document.documentElement.dataset.theme || '';
        bar.querySelectorAll('[data-lab-look]').forEach(b => b.classList.toggle('on', b.dataset.labLook === curLook));
    }

    function runAuditUI() {
        const out = $('uiLabAudit');
        if (!out) return;
        const a = audit();
        const ovs = Object.entries(a.overlaps).filter(([, v]) => v).map(([k]) => k);
        const hits = Object.entries(a.hitTests).filter(([, v]) => v && v.visible && !v.ok).map(([k, v]) => `${k} blocked by ${v.hitTag}`);
        const ok = a.scrollX <= 0 && !ovs.length && !hits.length;
        out.innerHTML = `<span class="${ok ? 'lab-ok' : 'lab-bad'}">${ok ? '✓ ALL CLEAR' : '✗ ISSUES FOUND'}</span> (${a.viewport.w}×${a.viewport.h}, ${a.preset})\n`
            + `Hand:${a.counts.hand} My:${a.counts.myPerms} Opp:${a.counts.oppPerms} Stack:${a.counts.stackTotal} Arrows:${a.counts.arrows}\n`
            + `ScrollX:${a.scrollX} SideScroll:${a.scrollbars.oppSide || a.scrollbars.meSide ? 'yes' : 'no'}\n`
            + `Overlaps: ${ovs.length ? ovs.join(', ') : 'none'}\n`
            + `Click Hit-Tests: ${hits.length ? hits.join('; ') : 'all clickable'}`;
    }

    function openPanel(expanded = false) {
        injectPanelCSS();
        let bar = $('uiLabBar');
        if (!bar) {
            bar = document.createElement('details');
            bar.id = 'uiLabBar';
            const lookKeys = (typeof SP_LOOKS !== 'undefined' && Array.isArray(SP_LOOKS))
                ? SP_LOOKS.map(l => [l.key, l.name])
                : [['', 'Classic'], ['dungeon', 'Dungeon'], ['ember', 'Ember'], ['frost', 'Frost'], ['yule', 'Yule'], ['grove', 'Grove'], ['royal', 'Royal']];
            bar.innerHTML = `<summary title="Hidden UI & Gameplay Test Lab">🧪 Lab ▾</summary><div class="lab-body">
                <div><div class="lab-h">Scenarios (${Object.keys(PRESETS).length})</div>
                <div class="lab-row">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" data-lab-preset="${k}">${p.label || k}</button>`).join('')}</div></div>
                <div><div class="lab-h">Spawn Any Card</div>
                <div class="lab-row"><input id="uiLabCardIn" type="text" placeholder="Card name (e.g. Black Lotus)" value="Atraxa, Praetors' Voice">
                <button type="button" data-lab-spawn="hand">Hand</button><button type="button" data-lab-spawn="me">Board</button><button type="button" data-lab-spawn="opp">Opp</button><button type="button" data-lab-spawn="stack">Stack</button></div></div>
                <div><div class="lab-h">Live State Actions</div>
                <div class="lab-row">
                    <button type="button" data-lab-act="draw1">+1 Card</button>
                    <button type="button" data-lab-act="draw5">+5 Cards</button>
                    <button type="button" data-lab-act="discard1">Discard</button>
                    <button type="button" data-lab-act="mana5">+WUBRG</button>
                    <button type="button" data-lab-act="untap">Untap All</button>
                    <button type="button" data-lab-act="life-5">Life −5</button>
                    <button type="button" data-lab-act="life+5">Life +5</button>
                    <button type="button" data-lab-act="cmd+5">Cmd +5</button>
                    <button type="button" data-lab-act="plus1">+1/+1 All</button>
                    <button type="button" data-lab-act="dmg1">Dmg 1</button>
                    <button type="button" data-lab-act="sick">Toggle Sick</button>
                    <button type="button" data-lab-act="goblins5">+5 Goblins</button>
                    <button type="button" data-lab-act="nextPhase">Next Phase</button>
                    <button type="button" data-lab-act="clearMode">Clear Mode</button>
                    <button type="button" data-lab-act="endTurn">End Turn</button>
                </div></div>
                <div><div class="lab-h">Looks & Board Style</div>
                <div class="lab-row">${lookKeys.map(([k, nm]) => `<button type="button" data-lab-look="${k}">${nm}</button>`).join('')}
                <button type="button" data-lab-board="toggle">Open / Classic</button></div></div>
                <div><div class="lab-row"><button type="button" id="uiLabAuditBtn">🩺 Run UI Audit & Hit-Tests</button></div>
                <div class="lab-audit" id="uiLabAudit">Click Audit to verify clicks, overlaps & scrollbars.</div></div>
            </div>`;
            bar.addEventListener('click', e => {
                const b = e.target.closest && e.target.closest('button');
                if (!b) return;
                if (b.dataset.labPreset) spawn(b.dataset.labPreset);
                else if (b.dataset.labSpawn) spawnCard(($('uiLabCardIn') || {}).value, b.dataset.labSpawn);
                else if (b.dataset.labAct) act(b.dataset.labAct);
                else if (b.dataset.labLook !== undefined && typeof setLook === 'function') { setLook(b.dataset.labLook); syncPanelState(); }
                else if (b.dataset.labBoard && typeof setBoardStyle === 'function') setBoardStyle(openBoard() ? 'classic' : 'open');
                else if (b.id === 'uiLabAuditBtn') runAuditUI();
            });
            document.body.appendChild(bar);
        }
        if (expanded) bar.open = true;
        syncPanelState();
        return bar;
    }

    // Auto-boot silently ONLY when ?uilab=<preset> is present in the URL
    const q = new URLSearchParams(location.search);
    const labParam = q.get('uilab');
    if (labParam) {
        let tries = 0;
        const bootLab = () => {
            if (typeof newGame !== 'function' || typeof renderGame !== 'function' || typeof who !== 'function' || typeof profile === 'undefined' || !profile) {
                if (++tries < 120) setTimeout(bootLab, 100);
                return;
            }
            activePresetName = PRESETS[labParam] ? labParam : 'stress';
            const opts = PRESETS[labParam] ? { ...PRESETS[labParam] } : { ...PRESETS.stress };
            ['players', 'hand', 'creatures', 'oppCreatures', 'lands', 'stack', 'attackers', 'blockers', 'life', 'deals', 'arch', 'talk', 'tokens', 'attach', 'poison', 'cmdDmg'].forEach(k => {
                if (q.has(k)) opts[k] = Number(q.get(k));
            });
            if (q.has('view')) opts.view = q.get('view');
            if (q.has('mode')) opts.mode = q.get('mode');
            if (q.get('panel') !== '0') openPanel(q.get('panel') === 'open');
            spawn(opts);
        };
        setTimeout(bootLab, 150);
    }

    return { spawn, spawnCard, act, audit, openPanel, PRESETS };
})();
