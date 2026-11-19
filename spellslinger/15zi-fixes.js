// Spellslinger Duels - small fixes from the owner's play (2026-11-19).
// Moonsilver Key: "an artifact card with a mana ability or a basic land card" found nothing, because the filter "artifact card with a mana ability" was unknown
// (and an "A or B" filter fails when one half is unknown). Solved for any search or pick that uses these words.
(function () {
    const cf = cardFits;
    const hasManaAbility = o => { const R = Rx(o); return /\bArtifact\b/.test(o.card.type) && (!!R.mana || (R.acts || []).some(a => a && (a.mana || /\bAdd \{/.test(a.text || '')))); };
    cardFits = function (o, what) {
        if (typeof what === 'string' && /with a mana ability/.test(what)) {
            return what.split(' or ').some(part => /with a mana ability/.test(part) ? hasManaAbility(o) : cf.call(this, o, part.replace(/^(?:a|an) /, '').replace(/ card$/, '')));
        }
        return cf.apply(this, arguments);
    };
})();
