// Dialogue lint (2026-11-18, owner: "some of them read horribly"): every line the bots can say is rendered with a name and with "you" and checked for leftover
// placeholders, grammar slips ("you is"), length, punctuation, repeats and voice rules (Marcus never shouts, Sam always does...). `node tests/suites/dialogue.js --list`
// prints counts per character and a few sample lines.
'use strict';
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(() => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        const chars = Object.keys(CHARACTERS);
        const ctxs = [{ foe: 'Marcus', card: 'Greg', n: 7, cmd: 'Atraxa', me: 'Kenrith', life: 23, turn: 9, tag: 'tokens' }, { foe: 'you', card: 'you', n: 12, cmd: 'Kenrith', me: 'Kenrith', life: 5, turn: 20, tag: 'mill' }];
        const lines = []; // { ev, key, text }
        for (const [ev, t] of Object.entries(TALK)) for (const [key, arr] of Object.entries(t)) arr.forEach(text => lines.push({ ev, key, text }));
        const NAME_ONLY = new Set(['react:out']); // the player who left is always a bot
        const CARD_NAME_ONLY = new Set(['counterOffer']); // a third party, never the person
        const bad = (pred) => lines.flatMap(l => ctxs.filter(c => !(NAME_ONLY.has(l.ev) && c.foe === 'you') && !(CARD_NAME_ONLY.has(l.ev) && c.card === 'you')).map(c => ({ l, s: fillLine(l.text, c) }))).filter(x => pred(x.s, x.l)).map(x => `${x.l.ev}/${x.l.key}: ${x.s}`);
        const show = a => a.slice(0, 6);
        let b;
        b = bad(s => /[{}]/.test(s)); ok('no placeholder is left unfilled', !b.length, show(b));
        b = bad(s => /\b(you (is|was|has|does)|you's|your's)\b/i.test(s)); ok('no "you is / you was / you has / you does / you\'s"', !b.length, show(b));
        b = bad(s => /^you, |, you[.!?]|, you,|\byou you\b/i.test(s)); ok('no stray "you," address left behind', !b.length, show(b));
        b = bad(s => /\s{2,}|^\s|\s$|\s[,.!?]/.test(s)); ok('no double spaces or space before punctuation', !b.length, show(b));
        b = bad(s => !/[.!?…]["')]?$/.test(s)); ok('every line ends with punctuation', !b.length, show(b));
        b = bad(s => s.length < 3 || s.length > 150); ok('every line is between 3 and 150 characters', !b.length, show(b));
        b = bad((s, l) => /^[a-z]/.test(s) && !/^you\b/i.test(s)); ok('every line starts with a capital', !b.length, show(b));
        // moods used must exist
        const badMood = lines.filter(l => l.key.includes('@') && !MOODS[l.key.split('@')[1]]).map(l => `${l.ev}/${l.key}`);
        ok('every @mood is a real mood', !badMood.length, badMood.slice(0, 5));
        // repeats inside one event and character
        const seen = {}, dup = [];
        lines.forEach(l => { const k = `${l.ev}|${l.key}|${l.text}`; if (seen[k]) dup.push(k); seen[k] = 1; });
        ok('no line is listed twice for the same event and character', !dup.length, dup.slice(0, 5));
        // two characters never share a line in one event
        const owners = {}, shared = [];
        lines.filter(l => chars.includes(l.key.split('@')[0])).forEach(l => { const k = `${l.ev}|${l.text}`; if (owners[k] && owners[k] !== l.key.split('@')[0]) shared.push(k); owners[k] = l.key.split('@')[0]; });
        ok('no two characters say the same line', !shared.length, shared.slice(0, 5));
        // coverage: every character has its own line for each core event
        const CORE = ['intro', 'hit', 'hitAgain', 'spellAtMine', 'peaceYes', 'peaceNo', 'peaceOffer', 'kept', 'betrayed', 'betrayer', 'noMoreDeals', 'archenemy', 'worried', 'angry', 'smug', 'mulligan',
            'salt:land', 'salt:wrath', 'salt:counter', 'salt:mill', 'salt:steal', 'salt:turn', 'salt:cmd', 'salt:target', 'salt:jab', 'salt:rage', 'outSalty', 'outGracious', 'react:out',
            'cool:big', 'cool:copy', 'cool:steal', 'cool:reanimate', 'cool:old', 'cool:comeback', 'cool:deck', 'win', 'lose', 'tipMana', 'tipHold', 'tipThreat', 'tipLie', 'tipTrue',
            'askYes', 'askNo', 'askUnsure', 'askThreat', 'gossip', 'allianceOffer', 'allianceBroken', 'counterOffer', 'infoDeal', 'tradeRestraint',
            'goFirst', 'lowLife', 'nearDeath', 'deckLow', 'cmdCast', 'selfBig', 'wrathCast', 'swing', 'comboGo', 'comboPanic', 'idle'];
        const missing = [];
        chars.forEach(c => CORE.forEach(ev => { const t = TALK[ev] || {}; if (!(t[c] && t[c].length) && !Object.keys(t).some(k => k.startsWith(c + '@') && t[k].length)) missing.push(`${c}:${ev}`); }));
        ok('every character has its own lines for every core event', !missing.length, missing.slice(0, 8));
        // totals per character
        const per = {}; chars.forEach(c => { per[c] = lines.filter(l => l.key.split('@')[0] === c).length; });
        const low = chars.filter(c => per[c] < 90); ok('every character has at least 90 lines', !low.length, per);
        // voice rules
        const own = c => lines.filter(l => l.key.split('@')[0] === c).map(l => l.text);
        const rate = (c, re) => { const a = own(c); return a.filter(t => re.test(t)).length / (a.length || 1); };
        ok('Marcus never uses an exclamation mark', rate('marcus', /!/) === 0, rate('marcus', /!/));
        ok('Trevor never uses an exclamation mark', rate('trevor', /!/) === 0, rate('trevor', /!/));
        ok('Sam shouts: at least a third of his lines have an exclamation mark', rate('sam', /!/) >= 0.33, rate('sam', /!/));
        ok('Sarah is excitable: at least a quarter of her lines have an exclamation mark', rate('sarah', /!/) >= 0.25, rate('sarah', /!/));
        ok('Marcus keeps it short: average line under 60 characters', own('marcus').reduce((a, t) => a + t.length, 0) / own('marcus').length < 60, 0);
        ok('Leo stays in the story: at least 12% of his lines name the tale, chapter, page, curtain, hero or villain', rate('leo', /\b(story|tale|chapter|page|curtain|hero|villain|plot|narrat|act\b)/i) >= 0.12, rate('leo', /\b(story|tale|chapter|page|curtain|hero|villain|plot|narrat|act\b)/i));
        ok('Trevor counts: at least 15% of his lines have a number word or "for the record"', rate('trevor', /\b(\d|{n}|{life}|count|record|item|technically|rule|math|data|calculat|statistic)/i) >= 0.15, rate('trevor', /\b(\d|{n}|{life}|count|record|item|technically|rule|math|data|calculat|statistic)/i));
        ok('Brenda thinks about money: at least 15% of her lines do', rate('brenda', /\b(\$|dollar|cost|paid|pay|cheap|budget|waste|wasted|save|sale|free|groceries|spare change|coffee|quarter|worth|receipt|thrift|afford|buy|spend)/i) >= 0.15, rate('brenda', /\b(dollar|cost|paid|cheap|budget|waste|save|sale|free)/i));
        ok('Arthur thinks about money and status: at least 15% of his lines do', rate('arthur', /\b(paid|cost|foil|collection|worth|price|antique|original|invest|common|crude|rare|finest|spectacle|gentleman|rubbish|beneath)/i) >= 0.15, rate('arthur', /\b(paid|cost|foil|worth|price)/i));
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('dialogue', results, []);
    writeOut('dialogue', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
