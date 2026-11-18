// Activated mana abilities are mana sources (owner, 2026-11-18): Doc Samson ("{T}: Add X mana of any one color, where X is his power") and Empowered
// Autogenerator (puts a charge counter first) can pay for a spell, by hand or automatically, without activating them beforehand.
'use strict';
const fs = require('fs'); const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');
(async () => {
    const h = await launch({ profileDir: undefined });
    await h.ctx.route('http://spellslinger.test/__cards.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(path.join(ROOT, 'tests', 'data', 'cards_all.json')) }));
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const r = await page.evaluate(async () => {
        const out = []; const ok = (l, c, d) => out.push([l, !!c, d]);
        const C = await T.cards(['Doc Samson, Super Psychiatrist', 'Empowered Autogenerator', 'Doubling Season', 'Forest', 'Grizzly Bears']);
        let [A, B] = await T.newGame(); T.clear(); A.isAI = false; G.view = 0; G.active = 0; G.phase = 'main1'; manaMode = 'tap';
        const sam = T.put(A, C['Doc Samson, Super Psychiatrist']); sam.sick = false;
        const gen = T.put(A, C['Empowered Autogenerator']); gen.tapped = false;
        ok('both are mana sources', manaSources(A).includes(sam) && manaSources(A).includes(gen), manaSources(A).map(x => x.card.name));
        ok("Doc Samson's amount is his power", manaOf(sam).n === Math.max(0, pow(sam)), manaOf(sam).n + ' / ' + pow(sam));
        ok('the Autogenerator would make 2 (its charge counter plus the one Doc Samson adds)', manaOf(gen).n === 2, manaOf(gen).n);
        // automatic payment: {G} paid by the Autogenerator alone puts the counter on it
        const plan = planPayment(A, parseCost('{G}'), 0, sam);
        ok('a plan exists that uses the Autogenerator', !!plan && plan.includes(gen), plan && plan.map(x => x.card.name));
        plan.forEach(x => tapSource(A, x));
        ok('tapping it for a payment puts the charge counter on it', gen.tapped && gen.ctr.charge === 2, gen.ctr.charge); // Doc Samson adds one more
        // by hand: tap Doc Samson for green while paying
        const cost = parseCost('{G}{G}');
        const payP = new Promise(res => { G.mode = { type: 'pay', cost, extra: 0, opts: {}, taps: [], done: res, source: null }; });
        tapForMana(sam.uid, 'G');
        ok("tapping Doc Samson by hand adds his power in green to the pool", A.pool.filter(c => c[0] === 'G').length === manaOf(sam).n || A.pool.filter(c => c[0] === 'G').length >= Math.max(1, pow(sam)), A.pool);
        ok('and taps him', sam.tapped, sam.tapped);
        G.mode = null;
        // Doubling Season: the charge counter is doubled, so the second tap makes more
        T.put(A, C['Doubling Season']); gen.tapped = false; A.pool = [];
        ok('with Doubling Season the Autogenerator makes the doubled counter count', manaOf(gen).n === 6, manaOf(gen).n); // 2 on it + (1 + Samson's 1) doubled = 6

        // ---- every kind of mana ability found by the audit: usable in a payment, with its costs and side effects ----
        const WANT = ['Black Lotus', 'Pristine Talisman', 'Millikin', 'Springleaf Drum', 'Sphere of the Suns', 'Mox Opal', 'Temple of the False God', 'Gilded Goose', 'Tomb of Urami', 'The Great Henge', 'Mirrored Lotus', 'Basal Thrull', 'Circle of Elders', 'Shrine of Boundless Growth', 'Avid Reclaimer', 'Sol Ring', 'Grizzly Bears', 'Forest', 'Mountain'];
        const raw = await (await fetch('/__cards.json')).json(); const K = {};
        raw.forEach(c => { if (WANT.includes(c.name) && !K[c.name] && c.type_line) { const sc = slimCard(c); CARDS.set(sc.id, sc); K[c.name] = sc; } });
        const fresh = async () => { [A, B] = await T.newGame(); T.clear(); A.isAI = false; G.view = 0; G.active = 0; G.phase = 'main1'; manaMode = 'tap'; A.library.length = 0; for (let i = 0; i < 12; i++) A.library.push(makeObj(K['Forest'], 0)); return A; };
        const use = (name, setup) => { const o = T.put(A, K[name]); o.sick = false; o.tapped = false; if (setup) setup(o); return o; };
        const pay = (cost) => { const plan = planPayment(A, parseCost(cost)); if (plan) plan.forEach(x => tapSource(A, x)); return plan; };
        await fresh(); let o = use('Black Lotus'); let pl = pay('{R}{R}{R}');
        ok('Black Lotus pays for a three-mana cost and is sacrificed', pl && pl.includes(o) && !A.bf.includes(o) && A.gy.includes(o), pl && pl.map(x => x.card.name));
        await fresh(); o = use('Pristine Talisman'); let l0 = A.life; pl = pay('{1}');
        ok('Pristine Talisman pays and gains 1 life', pl && A.life === l0 + 1, A.life - l0);
        await fresh(); o = use('Millikin'); const lib0 = A.library.length; pl = pay('{1}');
        ok('Millikin pays and mills a card', pl && A.library.length === lib0 - 1, lib0 - A.library.length);
        await fresh(); o = use('Springleaf Drum'); const bear = use('Grizzly Bears'); pl = pay('{G}');
        ok('Springleaf Drum pays by tapping a creature', pl && pl.includes(o) && bear.tapped, bear.tapped);
        await fresh(); use('Grizzly Bears').tapped = true; o = use('Springleaf Drum');
        ok('Springleaf Drum is not a source with no untapped creature to tap', !manaSources(A).includes(o), 0);
        await fresh(); o = use('Sphere of the Suns', x => { x.ctr.charge = 3; }); pl = pay('{R}');
        ok('Sphere of the Suns pays by removing a charge counter', pl && o.ctr.charge === 2, o.ctr.charge);
        await fresh(); o = use('Mox Opal'); ok('Mox Opal needs three artifacts', !manaSources(A).includes(o), 0);
        use('Sol Ring'); use('Sol Ring'); ok('Mox Opal works with metalcraft', manaSources(A).includes(o), manaSources(A).length);
        await fresh(); o = use('Temple of the False God'); ok('Temple of the False God needs five lands', !manaSources(A).includes(o), 0);
        for (let i = 0; i < 4; i++) use('Forest'); ok('Temple of the False God works with five lands', manaSources(A).includes(o), 0);
        await fresh(); o = use('Gilded Goose'); ok('Gilded Goose needs a Food', !manaSources(A).includes(o), 0);
        await fresh(); o = use('Tomb of Urami'); l0 = A.life; pl = pay('{B}'); await new Promise(r => setTimeout(r, 50));
        ok('Tomb of Urami pays and deals 1 damage to you without an Ogre', pl && A.life === l0 - 1, A.life - l0);
        await fresh(); o = use('The Great Henge'); l0 = A.life; pl = pay('{G}{G}'); await new Promise(r => setTimeout(r, 50));
        ok('The Great Henge pays {G}{G} and gains 2 life', pl && A.life === l0 + 2, A.life - l0);
        await fresh(); o = use('Mirrored Lotus'); pl = pay('{G}{G}{G}');
        ok('Mirrored Lotus pays and is exiled', pl && A.exile.includes(o), 0);
        await fresh(); o = use('Basal Thrull'); pl = pay('{B}{B}');
        ok('Basal Thrull pays {B}{B} and is sacrificed', pl && !A.bf.includes(o), 0);
        await fresh(); o = use('Avid Reclaimer'); ok('Avid Reclaimer makes one mana of green or blue', manaOf(o) && manaOf(o).n === 1 && manaOf(o).colors.join('') === 'GU' || manaOf(o).colors.join('') === 'UG', manaOf(o) && manaOf(o).colors);
        return out;
    });
    const results = formatChecks(r);
    results.push(...formatChecks([['no page errors', errors.length === 0, errors.slice(0, 3)]]));
    const ok = printResults('manaabilities', results, []);
    writeOut('manaabilities', results);
    await h.close();
    process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
