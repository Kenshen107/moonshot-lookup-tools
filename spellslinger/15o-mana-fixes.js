// Engine part of the Signet fix: when the normal plan can't pay, try using Signets. A Signet taps for its colors but needs {1} from another source, so using
// k Signets means paying k extra generic mana and getting their colors as extra mana (virtual sources, never tapped themselves).
{
    const basePlan = planPayment;
    const combos = (arr, k) => k === 0 ? [[]] : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map(c => [x, ...c]));
    planPayment = function (P, cost, extra = 0, exclude = null, opts = {}) {
        const r = basePlan.apply(this, arguments);
        if (r || !P || opts.poolOnly || opts.virt) return r;
        const sigs = P.bf.filter(o => o !== exclude && !o.tapped && manaOf(o) && manaOf(o).fee && !(isCreature(o) && o.sick && !has(o, 'haste')));
        for (let k = 1; k <= Math.min(3, sigs.length); k++) {
            for (const T of combos(sigs, k)) {
                const virt = T.flatMap(s => { const m = manaOf(s); return m.fixed && m.colors.length === m.n ? m.colors.slice() : Array(m.n).fill(m.colors[0]); });
                const fee = T.reduce((a, s) => a + manaOf(s).fee, 0);
                const plan = basePlan.call(this, P, cost, extra + fee, exclude, { ...opts, virt });
                const real = plan && plan.filter(o => !o.virtual);
                if (real && real.length) return real.concat(T); // at least one real source must start the chain: a Signet's {1} can't come from nothing
            }
        }
        return r;
    };
}
