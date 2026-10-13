// Spellslinger Duels - rules pack: precon round 3 (2026-10-09). Repeating keywords (bushido, soulshift, bloodthirst, fading,
// vanishing, living weapon, buyback) and the cards that go with them. The keyword lines are rewritten into sentences at the
// top of rulesFor (02-card-reader.js); the engine cases are in 15b-precon-effects.js.
registerRules({
    name: 'precons3',
    effects: [
        [/^(?:you may )?return target Spirit card with mana value (\d+) or less from your graveyard to your hand$/i, m => ({ t: 'regrow', what: `Spirit mv${m[1]}`, may: true })]
    ],
    triggers: [
        [/^When ~ enters or leaves the battlefield, (.+)$/, () => [{ ev: 'selfEnters' }, { ev: 'leaves' }]],
        [/^Whenever ~ blocks or becomes blocked, (.+)$/, () => [{ ev: 'blocks' }, { ev: 'blocked' }]]
    ],
    lines: [
        (ctx) => {
            const { R } = ctx; const line = ctx.line; let m;
            if ((m = line.match(/^If an opponent was dealt damage this turn, ~ enters with (\d+) \+1\/\+1 counters on it\.$/))) { R.bloodthirst = +m[1]; return true; }
            if ((m = line.match(/^At the beginning of your upkeep, remove a (fade|time) counter from ~\. (?:If you can't, sacrifice ~|When the last is removed, sacrifice ~)\.$/))) {
                R.trig.push({ ev: 'upkeep', who: 'your', effects: [{ t: 'fadeTick', kind: m[1] }] }); return true;
            }
            if (/^Flanking$/.test(line)) { R.kw.add('flanking'); R.trig.push({ ev: 'blocked', effects: [{ t: 'flankingHit' }] }); return true; }
            return false;
        }
    ]
});
