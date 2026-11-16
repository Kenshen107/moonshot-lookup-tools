// Computer play, round 2 (2026-11-15, owner: "run the audit ... some of the decks need a game plan to understand what is the win con. Like Doc Samson is all about making
// infinite mana with him and activating and casting as much stuff as possible"). Two parts, loaded after 15x-casting.js:
//
// 1. ABILITY GUARDS (from `node tests/ability_audit.js`, which puts every card of every deck on the computer's battlefield with plenty of mana and lets it use its
//    abilities). Found: manlands (Mutavault, Firdoch Core) animated again and again for {1} / {4} with nothing gained, Nog's abilities (fixed earlier), Dal R'El
//    sacrificing a land for a card three times in a row, Maturation Chamber with no charge counters, Aetheric Amplifier with nothing to double.
//    `AI_ACT_GUARDS` (by card name) and the generic "already animated this turn" rule only apply to the computer.
// 2. GAME PLANS (`DECK_PLANS`, by commander name): what a deck is trying to do. A plan names the win condition in words (`win`), the cards that start the engine
//    (`engine`: cast sooner), the payoffs that only make sense once it runs (`payoff`: held back until `ready`), the creatures to keep home (`protect`), equipment
//    that belongs on one creature (`equipTo`), and, for combos, a loop (`loops`). A loop is an infinite combo the engine can't play out one activation at a time: when
//    its pieces are on the battlefield and working, the computer is given a large pool of mana for the turn (and the loop's pump), the log says so, and it then casts
//    and activates as much as it can. It is an approximation of "infinite" (30 mana), marked in the log with 🔁. `AI_TUNE.plans = 0` (lab: `--tune plans=0`, seat A)
//    turns plans off for comparing. Plans only steer the computer; people play their own decks.
'use strict';
AI_TUNE.plans = 1;
const planOn = P => !!P && P.isAI && tn(P, 'plans') !== 0 && P.aiLevel !== 'easy';
const plPol = k => { if (typeof pol !== 'function') return; const p = pol(); p.plan = p.plan || {}; p.plan[k] = (p.plan[k] || 0) + 1; };
const onBfNamed = (P, n) => P.bf.find(x => x.card.name === n);
const countNamed = (P, names) => names.filter(n => P.bf.some(x => x.card.name === n)).length;

// ---------- 1. Ability guards ----------
const AI_ACT_GUARDS = {
    'Maturation Chamber': (P, o) => (o.ctr.charge || 0) >= 2,
    'Aetheric Amplifier': (P, o) => P.bf.some(x => x !== o && (x.counters >= 2 || Object.values(x.ctr || {}).some(v => v >= 2))),
    'Dal R\'El, Augment Orphan': (P, o, a) => !a.cost || !a.cost.sacPerm || (P.bf.filter(x => /\bLand\b/.test(x.card.type)).length >= 8 && P.hand.length <= 3),
    'Duskwatch Recruiter': (P, o) => P.library.some(c => /\bCreature\b/.test(c.card.type)),
};
{
    const base = canActivate;
    canActivate = function (P, o, a) {
        if (P && P.isAI && o && a && a.effects) {
            // A "becomes a creature until end of turn" ability does nothing the second time in a turn
            if (a.effects.some(e => e.t === 'animate') && o.animated && o.animated.turn === G.turn) return false;
            if (a.effects.some(e => e.t === 'draw' && (e.target === 'player' || !e.target)) && P.library.length < 12) return false; // never draw itself out with an ability
            if (P.infMana === G.turn && P.infTurn === G.turn && (P.infTurnActs || 0) >= INF_ACT_CAP) return false; // bounded: the board stays playable
            const g = AI_ACT_GUARDS[o.card.name];
            if (g && !g(P, o, a)) return false;
        }
        return base.apply(this, arguments);
    };
}

// ---------- Infinite mana (2026-11-16, owner: "make the infinite mana truly infinite") ----------
// A combo that makes more mana than it costs gives the player unlimited mana for the turn (`P.infMana = G.turn`). The pool holds INF_PER of every color and
// paying from the pool no longer removes anything (a `tapSource` wrapper), so nothing in the engine can run out: any number of spells, abilities and X spells
// (X is capped by the pool, 90). It lasts until the turn ends (`keepPoolTurn`), like the loop it stands for.
const INF_PER = 15;
const INF_ACT_CAP = 60; // most abilities the computer uses in one infinite-mana turn
const infiniteNow = P => !!P && P.infMana === G.turn;
function giveInfiniteMana(P, why) {
    P.infMana = G.turn; P.keepPoolTurn = G.turn;
    P.pool = (P.pool || []).filter(c => c.includes(':'));
    ['W', 'U', 'B', 'R', 'G', 'C'].forEach(c => { for (let i = 0; i < INF_PER; i++) P.pool.push(c); });
    log(`🔁 ${P.name} ${you(P) ? 'loop' : 'loops'} ${why}: untap, tap for mana, repeat. That is infinite mana this turn.`);
    plPol('loops');
}
{
    const ts = tapSource;
    tapSource = function (P, s) { if (s && s.pool && !s.channel && !s.virtual && infiniteNow(P)) return; return ts.apply(this, arguments); };
}

// With infinite mana a tap ability repeats: Staff of Domination untaps a creature ({3}) and itself ({1}), and a creature with Umbral Mantle untaps itself. So after an
// activation that tapped the source, the source untaps when one of those is in play. Non-creature tap abilities (Ozolith, the Ring) stay once a turn.
{
    const act = activate;
    activate = async function (P, o, a) {
        const was = o && o.tapped;
        const r = await act.apply(this, arguments);
        if (r && P && infiniteNow(P) && a && a.cost && a.cost.tap && o && !was && o.tapped && onBf(o.uid)) {
            const staff = P.bf.find(x => x.card.name === 'Staff of Domination' && !lostAbilities(x));
            const mantle = P.bf.some(x => x.card.name === 'Umbral Mantle' && x.attachedTo === o.uid);
            if ((o.card.name === 'Staff of Domination') || (isCreature(o) && (staff || mantle))) { o.tapped = false; P.infUntaps = (P.infUntaps || 0) + 1; }
        }
        if (r && P && infiniteNow(P)) { P.infActs = (P.infActs || 0) + 1; if (P.infTurn !== G.turn) { P.infTurn = G.turn; P.infTurnActs = 0; } P.infTurnActs++; }
        return r;
    };
}
// Use every repeatable ability, round after round, until a round does nothing (bounded)
async function useInfiniteAbilities(P) {
    let rounds = 0;
    while (rounds < 8 && !G.over) {
        const before = P.infActs || 0;
        await aiUseAbilities(P);
        await settle();
        rounds++;
        if ((P.infActs || 0) === before) break;
    }
    if (rounds > 1 || (P.infActs || 0) > 0) plPol('infiniteAbilityRounds');
}

// ---------- 2. Game plans ----------
// Fields: win (words), style (playstyle if the deck names none), engine / payoff / protect (card names), payoffNeed (engine pieces or mana sources before payoffs are
// "ready", default 1 engine piece or 8 sources), cmdr (extra score for casting the commander), equipTo { equipment: creature }, loops [{ name, online(P) -> bool, mana, color, pump }]
const DECK_PLANS = {
    'Doc Samson, Super Psychiatrist': {
        win: 'Combo: Doc Samson taps for mana equal to his power. With an untapper (Staff of Domination: {3},{T} untap, {1} untap itself; or Umbral Mantle: {3},{Q} +2/+2) and power 5 (or 3 with the Mantle) every tap makes more than it costs: infinite mana. Cast and activate everything, then attack with a huge Samson or Kalonian Hydra.',
        style: 'ramp',
        engine: ['Hardened Scales', 'Ozolith, the Shattered Spire', 'Incubation Druid', 'Staff of Domination', 'Umbral Mantle', 'Kalonian Hydra', 'Sol Ring', 'Fyndhorn Elves', 'Gyre Sage', 'Moxite Refinery', 'Surestrike Trident', 'Magistrate\'s Scepter'],
        payoff: ['Hydra Broodmaster', 'Fangs of Kalonia', 'The Ooze', 'Ring of Three Wishes', 'Goblin Cannon', 'Return of the Wildspeaker', 'Temur Sabertooth', 'Gamma Grotesque', 'Origin of the Hulk'],
        protect: ['Doc Samson, Super Psychiatrist'], cmdr: 6,
        // With infinite mana the deck wins with Surestrike Trident: equip it, tap Samson to hit a player for his power, untap him (Staff {3} or Mantle), repeat.
        // Find the Trident (draw with Staff of Domination: {5},{T} draw, {1} untap it), cast it, then every opponent takes lethal.
        async post(P) {
            if (!infiniteNow(P) || G.over) return;
            const s = onBfNamed(P, 'Doc Samson, Super Psychiatrist'); if (!s || lostAbilities(s)) return;
            // Every other repeatable ability is worth doing over and over: counters, tokens, draw, pump, damage (owner, 2026-11-16)
            if (!P.infBusy) { P.infBusy = true; try { P.infActs = 0; await useInfiniteAbilities(P); if (P.infActs && !G.over) { await aiMain(P); await useInfiniteAbilities(P); } } finally { P.infBusy = false; } }
            if (G.over) return;
            const isTr = o => o.card.name === 'Surestrike Trident';
            let tr = onBfNamed(P, 'Surestrike Trident');
            if (!tr && !P.hand.some(isTr) && onBfNamed(P, 'Staff of Domination')) {
                let n = 0;
                while (n < 90 && P.library.length > 6 && !P.hand.some(isTr) && !G.over) { drawCards(P, 1, true); n++; }
                if (n) log(`🔁 ${P.name} draws ${n} card${n === 1 ? '' : 's'} with Staff of Domination (untap it for {1} each time) looking for Surestrike Trident.`);
                await settle();
            }
            if (!tr) { const h = P.hand.find(isTr); if (h && canCastNow(P, h) && canPay(P, h)) { await castSpell(P, h, null); await settle(); } tr = onBfNamed(P, 'Surestrike Trident'); }
            if (!tr) return;
            const power = Math.max(1, pow(s));
            log(`🔁 ${P.name} equips Surestrike Trident to ${s.card.name}, taps him to deal ${power} to a player, untaps him and does it again, once for every opponent.`);
            plPol('tridentKill');
            for (const f of foes(P)) { if (G.over) break; damage(f, Math.max(power, f.life + 1), s); }
            await settle();
        },
        equipTo: { 'Umbral Mantle': 'Doc Samson, Super Psychiatrist', 'Sword of the Paruns': 'Doc Samson, Super Psychiatrist' },
        loops: [{
            name: 'Doc Samson, an untapper and his own mana',
            online(P) {
                const s = onBfNamed(P, 'Doc Samson, Super Psychiatrist'); if (!s || s.tapped || s.sick || lostAbilities(s)) return null;
                const x = pow(s);
                const staff = onBfNamed(P, 'Staff of Domination');
                if (staff && !staff.tapped && x >= 5) return { pump: 0, infinite: true };
                const mantle = P.bf.find(m => m.card.name === 'Umbral Mantle' && m.attachedTo === s.uid);
                if (mantle && x >= 3) return { pump: 999, target: s, infinite: true };
                return null;
            }, mana: 16, color: 'G',
        }],
    },
    'Hugh, First of Many': {
        win: 'Replicate every cheap artifact: rocks first, then pay for copies of Gearhulks, Vehicles and the Cyber-Controller. Big artifacts come down late, with lots of mana.',
        engine: ['Etherium Sculptor', 'Foundry Inspector', 'Sol Ring', 'Mind Stone', 'Arcane Signet', 'Thran Dynamo', 'Gilded Lotus', 'Cargo Ship', 'Worn Powerstone', 'Academy Manufactor', 'Powerstone Shard', 'Drafna, Founder of Lat-Nam'],
        payoff: ['Torrential Gearhulk', 'Noxious Gearhulk', 'The Cyber-Controller', 'Planet Killer', 'Consulate Dreadnought', 'Wurmcoil Engine', 'Ethersworn Sphinx', 'Organic Extinction', 'Battle of Wolf 359'], payoffNeed: 7, cmdr: 4,
    },
    'Kang the Conqueror': {
        win: 'Extra turns and "end the turn": Kang copies and flickers value, Time Stop and Discontinuity end the turn while Hurkyl\'s Final Meditation and Panharmonicon double up. Ramp, then chain turns.',
        engine: ['Panharmonicon', 'Displacer Kitten', 'Archaeomancer', 'Sol Ring', 'Mind Stone', 'Arcane Signet', 'Thran Dynamo', 'Gilded Lotus', 'Reed Richards, Smartest Man', 'Immortus, Master of Eternity'],
        payoff: ['Time Stop', 'Discontinuity', 'Hurkyl\'s Final Meditation', 'Silver Surfer, Cosmic Voyager', 'The Vision', 'Snap', 'See Double'], payoffNeed: 7, cmdr: 4,
    },
    'Gogo, Master of Mimicry': {
        win: 'Copy and ramp: Urza lands and rocks make mana, Replicating Ring, Aetherflux Conduit, Extravagant Replication and Kang copy the best thing on the table; Wurmcoil Engine and Conduit end games.',
        engine: ['Replicating Ring', 'Urza\'s Workshop', 'Urza\'s Tower', 'Urza\'s Mine', 'Urza\'s Power Plant', 'Sol Ring', 'Thran Dynamo', 'Arcane Signet', 'Grozoth', 'Aetheric Amplifier', 'High Tide', 'The Theorist, Jace Beleren'],
        payoff: ['Aetherflux Conduit', 'Extravagant Replication', 'Wurmcoil Engine', 'Kang the Conqueror', 'Artisan of Kozilek', 'Keiga, the Tide Star', 'Scuttling Doom Engine'], payoffNeed: 7, cmdr: 4,
    },
    'Astonishing Spider-Man': {
        win: 'Discard and wheel: Spider-Man discards the hand and draws it back; every discard pays off in damage (Glint-Horn Buccaneer, Magmakin Artillerist, Cool but Rude) and Underworld Breach / Teferi\'s Tutelage turn it into a win.',
        style: 'spellslinger',
        engine: ['Glint-Horn Buccaneer', 'Magmakin Artillerist', 'Marauding Mako', 'Scrounging Skyray', 'Cool but Rude', 'Sphinx\'s Tutelage', 'Teferi\'s Tutelage', 'Hobgoblin, Mantled Marauder', 'Misty Knight, Hero for Hire', 'Ivora, Insatiable Heir', 'Ashling, Rekindled'],
        payoff: ['Underworld Breach', 'Memory Deluge', 'Rush of Inspiration', 'Flame Blitz', 'Kazuul\'s Fury', 'Skycrash'], payoffNeed: 2, cmdr: 5,
    },
    'Astarion, the Decadent': {
        win: 'Drain: gain or drain once, then Astarion doubles it at end step. Gray Merchant, Exsanguinate and Blood Tribute with a board of lifelinkers finish.',
        style: 'midrange',
        engine: ['Gifted Aetherborn', 'Vito, Thorn of the Dusk Rose', 'Elenda, Saint of Dusk', 'Rhox Faithmender', 'Phyrexian Arena', 'Sol Ring', 'Mind Stone'],
        payoff: ['Gray Merchant of Asphodel', 'Exsanguinate', 'Blood Tribute', 'Boon-Bringer Valkyrie', 'Debt to the Deathless', 'Essence Pulse'], payoffNeed: 2, cmdr: 5,
    },
    'Aurelia, the Law Above': {
        win: 'Go wide: attack with three or more creatures so Aurelia draws, five and she burns the table. Phoenixes come back attacking, Gisela doubles the damage.',
        style: 'tokens',
        engine: ['Flamewake Phoenix', 'Warcry Phoenix', 'Phoenix Chick', 'Inspiring Overseer', 'Healer\'s Hawk', 'Courier Hawk', 'Cartographer\'s Hawk', 'Sol Ring', 'Mind Stone'],
        payoff: ['Gisela, Blade of Goldnight', 'The Warring Triad', 'Anya, Merciless Angel', 'Avacyn, Angel of Hope', 'Magmaquake', 'Seize the Spoils'], payoffNeed: 3, cmdr: 5,
    },
    'Grizzlegom, Hurloon Hero': {
        win: 'Domain: land after land, every basic land type you control makes Grizzlegom\'s attack trigger count for more. Ramp, fix, attack with a huge Grizzlegom.',
        engine: ['Harrow', 'Branching Timeline', 'Summer Bloom', 'Escape to the Wilds', 'Primeval Herald', 'Fblthp, Knows the Way', 'Through the Forest Gate', 'Dal R\'El, Augment Orphan', 'Return of the Wildspeaker'],
        payoff: ['Genesis Wave', 'Full Throttle', 'Tromp the Domains', 'The Weatherseed Treaty', 'Seize the Day'], payoffNeed: 3, cmdr: 5,
    },
    'Super-Skrull': {
        win: 'Ramp into the activated abilities (owner, 2026-11-16): make as much mana as possible, then spend it every turn on Super-Skrull\'s four abilities: {5}{U} draw four, {2}{W} a 0/4 Wall, {3}{G} +4/+4, {4}{R} 4 damage. Rocks, rituals and cost reducers (Training Grounds, Zirda, Biomancer\'s Familiar) come first; High Alert, Doran and The Kingpin of Crime turn the Walls into damage.',
        style: 'ramp',
        engine: ['Sol Ring', 'Arcane Signet', 'Thran Dynamo', 'Worn Powerstone', 'Everflowing Chalice', 'Hedron Archive', 'Lotus Petal', 'Dark Ritual', 'Astral Cornucopia', 'Relic of Sauron', 'Moonsilver Key', 'Training Grounds', 'Zirda, the Dawnwaker', 'Biomancer\'s Familiar', 'Wilderness Reclamation', 'Three Visits', 'Skyshroud Claim', 'Demonic Tutor', 'Vampiric Tutor', 'Victory Chimes'],
        payoff: ['High Alert', 'The Kingpin of Crime', 'Doran, Besieged by Time', 'Exsanguinate', 'Atraxa, Grand Unifier'], payoffNeed: 4, mana: 8, cmdr: 8,
        // With mana to spare, draw four before small removal: mana turns into cards
        async abilities(P) {
            const sk = onBfNamed(P, 'Super-Skrull'); if (!sk || lostAbilities(sk)) return;
            for (let k = 0; k < 3 && !G.over; k++) {
                const a = actsOf(sk).find(x => x.effects.some(e => e.t === 'draw' && e.n === 4));
                if (!a || !canActivate(P, sk, a) || availableMana(P) < 6 || P.hand.length > 5 || P.library.length < 10) return;
                if (!await activate(P, sk, a, { p: P })) return;
                plPol('skrullDraw');
            }
        },
    },
    'Jadzi, Oracle of Arcavios': {
        win: 'Bounce-land value and copies: Jadzi, Tatyova and bounce lands draw cards; Genesis Wave, Temporal Cascade and Doppelgang convert mana into a board; Tutelages punish a big hand.',
        engine: ['Tatyova, Benthic Druid', 'Sphinx\'s Tutelage', 'Teferi\'s Tutelage', 'Cultivate', 'Sol Ring', 'Eternal Witness', 'Timeless Witness'],
        payoff: ['Genesis Wave', 'Temporal Cascade', 'Doppelgang', 'Avenger of Zendikar', 'Windfall', 'Pull from Tomorrow'], payoffNeed: 3, cmdr: 4,
    },
    'Torgaar, Famine Incarnate': {
        win: 'Sacrifice and recursion: fill the graveyard, sacrifice creatures (Torgaar halves every life total, Exsanguinate and Finale finish) and rebuy them with Midnight Reaper and Reassembling Skeleton.',
        style: 'midrange',
        engine: ['Midnight Reaper', 'Reassembling Skeleton', 'Morbid Opportunist', 'Boggart Trawler', 'Hedron Archive', 'Sol Ring', 'Victimize', 'Another Chance'],
        payoff: ['Exsanguinate', 'Finale of Eternity', 'Game Over', 'Torgaar, Famine Incarnate', 'Tallyman of Nurgle', 'Shredder, Shadow Master'], payoffNeed: 3, cmdr: 5,
    },
    'Nog, Ambitious Cadet': {
        win: 'Lands and the graveyard: grow Nog from Rogue to Scout to Officer (extra land drops, lands from the graveyard), Gitrog and landfall draw cards, Planet tokens and recursion refill the table.',
        engine: ['The Gitrog Monster', 'Scrib Nibblers', 'Exploration Broodship'], payoff: [], cmdr: 5,
    },
    'Rukarumel, Biologist': {
        win: 'Typal: Rukarumel makes every nontoken creature the chosen type, so Slivers, changelings, Herald\'s Horn and Mirror Entity all work together; go wide and pump.',
        style: 'tokens',
        engine: ['Maskwood Nexus', 'Herald\'s Horn', 'Sol Ring', 'Mind Stone', 'Arcane Signet'], payoff: ['Mirror Entity', 'Crystalline Sliver', 'Virulent Sliver', 'Ward Sliver'], payoffNeed: 3, cmdr: 5,
    },
    'U.S. Agent, John Walker': {
        win: 'Blink and Equipment: Panharmonicon and Elesh Norn double enters triggers, Astral Slide and Flickerwisp flicker them, Auras and Equipment stay on the right creature.',
        engine: ['Panharmonicon', 'Elesh Norn, Mother of Machines', 'Sol Ring', 'Mind Stone', 'Arcane Signet'], payoff: [], cmdr: 5,
    },
    'Lorehold, the Historian': {
        win: 'Miracle: every instant and sorcery has miracle {2}. Draw big spells (Gearhulks, mass recursion) at the top of the library with mana ready.',
        engine: ['Sol Ring', 'Mind Stone', 'Arcane Signet', 'Thran Dynamo', 'Worn Powerstone'], payoff: ['Torrential Gearhulk', 'Noxious Gearhulk'], payoffNeed: 6, cmdr: 5,
    },
    'Plargg and Nassari': {
        win: 'Chaos: cast spells from every library, goad everything (Disrupt Decorum, Grenzo), copy spells cast from exile and let the Eldrazi annihilate the table.',
        style: 'aggro',
        engine: ['Spider-Verse', 'Nalfeshnee', 'Wand of Wonder', 'Sol Ring', 'Mind Stone', 'Arcane Signet'], payoff: ['Disrupt Decorum', 'Grenzo, Havoc Raiser'], payoffNeed: 4, cmdr: 5,
    },
    'Jenova, Ancient Calamity': {
        win: 'Graveyard, sacrifice and Mutants: mill and sacrifice to fill the graveyard, then reanimate and put counters on Mutants; Ruric Thar, Doomgape and Hapatra end games.',
        style: 'midrange',
        engine: ['Sol Ring', 'Mind Stone', 'Arcane Signet', 'Thran Dynamo', 'Hapatra, the Desert Fang', 'Pizza Face, Gastromancer'],
        payoff: ['Doomgape', 'Ruric Thar, Magecrusher', 'Behold the Sinister Six!', 'Agadeem\'s Awakening'], payoffNeed: 3, cmdr: 5,
    },
    'Terra, Magical Adept': {
        win: 'Summon sagas: five colors of mana (Chromatic Lantern, Yuna, Sylvan Library), then Final Fantasy Summon sagas and recursion every turn.',
        engine: ['Chromatic Lantern', 'Yuna, Grand Summoner', 'Sylvan Library', 'Sol Ring', 'Arcane Signet', 'Mind Stone'], payoff: ['Summon: Primal Odin', 'Summon: Anima', 'Summon: Valefor', 'Summon: Shiva'], payoffNeed: 3, cmdr: 5,
    },
    'Urianger Augurelt': {
        win: 'Abuse the commander\'s tap abilities (owner, 2026-11-16): Draw Arcanum exiles the top card face down, Play Arcanum lets you play those exiled cards for {2} less (and gain 2 life). Both need {T}, so untappers (Unbender Tine, Vizier of Tumbling Sands, Fatestitcher, Freed from the Real, Thousand-Year Elixir) let him do both in a turn. Stock up the exile with Draw Arcanum, then cast bombs (Lyra, Archangel of Thune, Absolute Virtue, Serra\'s Emissary, Teferi) two mana cheaper.',
        style: 'midrange',
        engine: ['Unbender Tine', 'Vizier of Tumbling Sands', 'Fatestitcher', 'Freed from the Real', 'Thousand-Year Elixir', 'Patriar\'s Seal', 'Sol Ring', 'Arcane Signet', 'Talisman of Progress', 'Gilded Lotus', 'Chromatic Lantern', 'Commander\'s Sphere', 'Moonsilver Key'],
        payoff: ['Lyra, Archangel of Dawn', 'Lyra Dawnbringer', 'Archangel of Thune', 'Avacyn, Angel of Hope', 'Absolute Virtue', 'Serra\'s Emissary', 'Teferi, Who Slows the Sunset', 'Ob Nixilis, the Ascended', 'Ultimate Magic: Holy', 'Seraph of the Sword'], payoffNeed: 2, cmdr: 8,
        // Before the main phase: with cards waiting in exile and mana to cast them, Play Arcanum first (cheaper spells). After it: Draw Arcanum to fill the exile.
        async pre(P) {
            const u = onBfNamed(P, 'Urianger Augurelt'); if (!u || u.tapped || u.sick || lostAbilities(u)) return;
            const a = actsOf(u).find(x => x.effects.some(e => e.id === 'sl_urianger2'));
            const waiting = P.exile.filter(c => c.slUri === u.uid);
            const worth = waiting.some(c => Rx(c).kind === 'land' ? P.landsPlayed < landLimit(P) : availableMana(P) >= Math.max(1, (c.card.cmc || 0) - 2));
            if (a && worth && canActivate(P, u, a) && await activate(P, u, a)) plPol('uriPlay');
        },
        async post(P) {
            const u = onBfNamed(P, 'Urianger Augurelt'); if (!u || u.tapped || u.sick || lostAbilities(u)) return;
            const a = actsOf(u).find(x => x.effects.some(e => e.id === 'sl_urianger1'));
            if (a && P.library.length > 6 && canActivate(P, u, a) && await activate(P, u, a)) plPol('uriDraw');
        },
    },
    'Beorn the Fierce': {
        win: 'Mana dorks into big green creatures: Famished Worldsire, Wargling and Selvala, then attack with the biggest bears.',
        style: 'ramp',
        engine: ['Llanowar Elves', 'Fyndhorn Elves', 'Selvala, Heart of the Wilds', 'Sol Ring', 'Wood Elves'], payoff: ['Famished Worldsire', 'Wargling', 'Part in Friendship'], payoffNeed: 3, cmdr: 5,
    },
    'Big Bertha': {
        win: 'Mutant counters: grow creatures with +1/+1 counters and mana from the biggest creature, then trample over the table.',
        style: 'ramp', engine: ['Incubation Druid', 'Bighorner Rancher', 'Sol Ring'], payoff: [], cmdr: 5,
    },
    'Othelm, Sigardian Outcast': {
        win: 'Abzan Clues and recursion: sacrifice Clues and creatures for value, bring everything back and drain.',
        engine: ['Sol Ring', 'Mind Stone', 'Arcane Signet'], payoff: [], cmdr: 5,
    },
    'Samut, Hazoret\'s Champion': {
        win: 'Red ramp into bombs: rocks, rituals and Skullclamp / Wheel of Fortune draw, then Terror of the Peaks, Goldspan Dragon, Inferno Titan and Embercleave with 7 or 8 mana.',
        style: 'ramp',
        engine: ['Sol Ring', 'Mana Vault', 'Gilded Lotus', 'Thran Dynamo', 'Jeska\'s Will', 'Seething Song', 'Skullclamp', 'Wheel of Fortune'],
        payoff: ['Terror of the Peaks', 'Goldspan Dragon', 'Inferno Titan', 'Bonehoard Dracosaur', 'Embercleave'], payoffNeed: 3, mana: 7, cmdr: 3,
    },
    'Samut, the Driving Force': {
        win: 'Speed: start your engines, hit opponents to raise speed to max, then Paradigm and Mercenary payoffs and extra combats.',
        style: 'aggro', engine: ['Sol Ring'], payoff: ['Devastating Onslaught', 'Become the Avalanche', 'Full Throttle'], payoffNeed: 2, cmdr: 5,
    },
    'Odric, Lunarch Marshal': {
        win: 'Keyword sharing: Odric gives every creature the keywords any creature has; build a board of different keywords and attack.',
        style: 'midrange', engine: ['Sol Ring', 'Mind Stone'], payoff: [], cmdr: 5,
    },
    'Jean-Luc Picard, Luminary': {
        win: 'Officers, Spacecraft and card draw: station the Spacecraft, draw with Seek, and attack with Officers.', style: 'midrange', engine: ['Sol Ring'], payoff: [], cmdr: 5,
    },
    'Worf, Defiant Commander': {
        win: 'Battlefront: attack several opponents at once for Klingon payoffs, Warrior tokens and goad.', style: 'aggro', engine: ['Sol Ring'], payoff: [], cmdr: 5,
    },
    'Commander Spock': {
        win: 'Exploration: differently named lands, Strange new worlds and landfall.', style: 'ramp', engine: ['Sol Ring'], payoff: [], cmdr: 5,
    },
    'The Borg Queen': {
        win: 'Assimilate creatures, make Borg tokens and build Spacecraft, then overwhelm with the assimilated board.', style: 'midrange', engine: ['Sol Ring'], payoff: [], cmdr: 5,
    },
};

// Which plan a player is playing: found by commander name, cached
function planOf(P) {
    if (!P || P.planKey === null) return null;
    if (P.planKey === undefined) {
        const c = [...P.command, ...P.bf, ...P.hand, ...P.gy].find(x => x.isCommander && DECK_PLANS[x.card.name]);
        P.planKey = c ? c.card.name : null;
        if (P.planKey) { const pl = DECK_PLANS[P.planKey]; pl.engineSet = pl.engineSet || new Set(pl.engine); pl.payoffSet = pl.payoffSet || new Set(pl.payoff); pl.protectSet = pl.protectSet || new Set(pl.protect || []); if (pl.style && !P.aiStyle && PLAYSTYLES[pl.style]) P.aiStyle = pl.style; }
    }
    return P.planKey ? DECK_PLANS[P.planKey] : null;
}
// Is the engine running? Enough engine pieces on the battlefield, or enough mana sources, or a loop is online
function planReady(P, pl) {
    if (P.planLoopTurn === G.turn) return true;
    const key = `${G.turn}:${P.bf.length}`; // scores are asked for many times a turn; the answer only changes when the battlefield does
    if (P.planReadyKey === key) return P.planReadyVal;
    const need = pl.payoffNeed || 1;
    const v = countNamed(P, pl.engine) >= need || manaSources(P).length >= (pl.mana || 8);
    P.planReadyKey = key; P.planReadyVal = v;
    return v;
}

// Scores: engine pieces come sooner, payoffs wait for the engine, the commander is worth casting
{
    const base = aiScoreBase;
    aiScoreBase = function (P, o, target) {
        let s = base.apply(this, arguments);
        if (!planOn(P)) return s;
        const pl = planOf(P); if (!pl || !o || !o.card) return s;
        const n = o.card.name;
        if (pl.engineSet.has(n)) { if (s <= 0 && ['artifact', 'enchantment', 'creature'].includes(Rx(o).kind)) s = 4; if (s > 0) { s += 5; plPol('engineScore'); } }
        else if (pl.payoffSet.has(n) && s > 0) { if (planReady(P, pl)) s += 4; else { s = s * 0.6; plPol('payoffHeld'); } }
        if (s > 0 && pl.cmdr && o.isCommander) s += pl.cmdr;
        return s;
    };
}

// Keep the engine creature home unless the attack is lethal or the loop already ran this turn
{
    const base = aiChooseAttackers;
    aiChooseAttackers = function (P) {
        const chosen = base.apply(this, arguments);
        if (!planOn(P) || !chosen || !chosen.length) return chosen;
        const pl = planOf(P); if (!pl || !pl.protectSet.size || P.planLoopTurn === G.turn) return chosen;
        const lowest = Math.min(...foes(P).map(x => x.life), 99);
        const keep = chosen.filter(o => !(pl.protectSet.has(o.card.name) && pow(o) < lowest));
        if (keep.length < chosen.length) plPol('protected');
        return keep;
    };
}

const pre_ = (P, pl) => pl.pre(P);
// Combos: at the start of the computer's main phase (and again after it has played more), check each loop
async function planGoOff(P) {
    const pl = planOf(P); if (!pl || !pl.loops || P.planLoopTurn === G.turn) return;
    for (const lp of pl.loops) {
        const on = lp.online(P); if (!on) continue;
        P.planLoopTurn = G.turn;
        if (on.infinite) giveInfiniteMana(P, lp.name);
        else { P.keepPoolTurn = G.turn; P.pool = (P.pool || []).concat(Array(lp.mana).fill(lp.color)); log(`🔁 ${P.name} loops ${lp.name} (counted as ${lp.mana} mana this turn).`); plPol('loops'); }
        if (on.pump && on.target) { on.target.tp += on.pump; on.target.tq += on.pump; log(`${on.target.card.name} gets +${on.pump}/+${on.pump} from the loop (every pass pumps him again).`); }
        return;
    }
}
{
    const am = aiMain;
    aiMain = async function (P) {
        if (planOn(P) && G.active === P.i && !G.over) {
            const pl = planOf(P);
            if (pl) {
                // Equipment that belongs on one creature goes there first
                for (const [eq, who] of Object.entries(pl.equipTo || {})) {
                    const e = onBfNamed(P, eq), c = onBfNamed(P, who);
                    if (e && c && e.attachedTo !== c.uid && Rx(e).isEquipment) { try { if (await equip(P, e, c)) plPol('equips'); } catch (err) { /* keep playing */ } }
                }
                await planGoOff(P);
                if (pl.pre) { try { await pre_(P, pl); } catch (err) { /* keep playing */ } }
            }
        }
        let r = await am.apply(this, arguments);
        if (planOn(P) && G.active === P.i && !G.over && planOf(P)) {
            const before = P.planLoopTurn;
            await planGoOff(P);
            if (P.planLoopTurn === G.turn && !G.over && (before !== G.turn || true)) r = await am.apply(this, arguments);
        }
        if (planOn(P) && G.active === P.i && !G.over) { const pl2 = planOf(P); if (pl2 && pl2.post) { try { await pl2.post(P); } catch (err) { /* keep playing */ } } }
        return r;
    };
}

// Abilities: a plan may spend mana on its commander's abilities before the generic ability loop does (Super-Skrull: draw four before small removal)
{
    const ab = aiUseAbilities;
    aiUseAbilities = async function (P) {
        if (planOn(P) && !G.over) { const pl = planOf(P); if (pl && pl.abilities) { try { await pl.abilities(P); } catch (err) { /* keep playing */ } } }
        return ab.apply(this, arguments);
    };
}

// A person at the table is offered the loop too: when the combo is online in their main phase, once a turn, they choose to loop (nothing happens by itself)
function loopOfferFor(P) {
    const pl = planOf(P); if (!pl || !pl.loops || P.isAI) return null;
    for (const lp of pl.loops) { const on = lp.online(P); if (on && on.infinite) return { lp, on }; }
    return null;
}
async function offerLoop(P) {
    const f = loopOfferFor(P); if (!f) return;
    P.loopAsked = G.turn;
    const card = onBfNamed(P, 'Doc Samson, Super Psychiatrist');
    const yes = await askYes(P, `${f.lp.name}: tap, pay to untap, repeat. That makes infinite mana this turn. Loop it?`, { card: card && card.card, yes: 'Loop (infinite mana)', no: 'Not now' });
    if (!yes || G.over) return;
    P.planLoopTurn = G.turn; giveInfiniteMana(P, f.lp.name);
    if (f.on.pump && f.on.target) { f.on.target.tp += f.on.pump; f.on.target.tq += f.on.pump; log(`${f.on.target.card.name} gets +${f.on.pump}/+${f.on.pump} from the loop.`); }
    renderGame();
}
setInterval(() => {
    try {
        if (typeof G === 'undefined' || !G || G.over || AUTOPLAY || window.__LAB || G.hotseat) return;
        const P = G.players.find(x => !x.isAI && !x.out); if (!P || G.active !== P.i || !MAIN.includes(G.phase) || G.busy || G.mode || G.stack.length || window.__ask || document.querySelector('#modalHost .modal') || P.loopAsked === G.turn || P.planLoopTurn === G.turn) return;
        if (loopOfferFor(P)) offerLoop(P);
    } catch (e) { /* ignore */ }
}, 800);
