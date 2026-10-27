// Mana fixes (2026-10-28): Yavimaya, Cradle of Growth ("each land is a Forest") and Signets ("{1}, {T}: Add {W}{U}").
// A Signet is a mana source that costs {1}: R.mana.fee. Auto-pay (planPayment wrapper in 15o-mana-fixes.js) pays that {1} from another source; when you tap by hand
// the Signet needs a mana already floating in your pool, which it uses up.
var LANDS_FOREST = { on: false };
clx("Each land is a Forest in addition to its other land types.", R => { R.landsForest = true; LANDS_FOREST.on = true; });
cl(/^\{(\d)\}, \{T\}: Add ((?:\{[WUBRG]\}){2,3})\.$/, (R, m, ctx) => {
    const cols = [...m[2].matchAll(/\{([WUBRG])\}/g)].map(x => x[1]);
    // filter lands also tap for {C} by themselves, so they keep the plain activated ability (as before)
    if (/\bLand\b/.test(ctx.card.type)) { act(R, ctx.line, `{${m[1]}}, {T}`, [{ t: 'addMana', mana: cols }]); return; }
    R.mana = { colors: [...new Set(cols)], n: cols.length, fixed: true, fee: Number(m[1]) };
});
