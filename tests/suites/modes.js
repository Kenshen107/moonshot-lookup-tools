// Game modes (Phase 4): Sandbox / Campaign / Shop Simulator.
//   - a new or old save starts in Campaign with today's coins, cash and record; Sandbox starts fresh
//   - switching modes swaps the money and record, and nothing leaks between Sandbox and Campaign/Shop
//   - each mode shows only its own tabs (desktop and phone) and a view from another mode is refused
//   - the collection and decks are shared by every mode
//   - Campaign deck-value limits per tier
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, openTestPage, installHelpers, formatChecks, printResults, writeOut, ROOT } = require('../lib/harness');

const BODY = async function () {
    const out = [];
    const ok = (label, cond, detail) => out.push([label, !!cond, detail]);
    ensureProfile();
    const shown = () => VIEWS.filter(k => !$(`tab-${k}`).classList.contains('hidden'));
    const money = () => ({ coins: profile.coins, usd: profile.usd, wins: profile.wins, losses: profile.losses, freePacks: profile.freePacks });

    // ---- an old save (no mode fields) is read as Campaign/Shop's save; Sandbox starts fresh ----
    const old = { coins: 1234, usd: 77.5, wins: 9, losses: 4, freePacks: 1, collection: { abc: 2 }, decks: [{ name: 'Old deck', format: 'casual', cards: { abc: 2 } }], packs: 3, created: '2026-10-01' };
    upgradeProfile(old);
    ok('an old save is in Campaign mode, main bucket', old.mode === 'campaign' && old.bucket === 'main');
    ok('its coins, cash, wins and losses are untouched', old.coins === 1234 && old.usd === 77.5 && old.wins === 9 && old.losses === 4);
    ok('Sandbox is parked fresh (500 coins, starting cash, no record)', old.stash.sandbox.coins === START_COINS && old.stash.sandbox.usd === SHOP_START_USD && old.stash.sandbox.wins === 0 && old.stash.sandbox.losses === 0, old.stash.sandbox);
    profile = old; saveProfile(); applyModeUI(true);

    // ---- switching ----
    ok('starts in Campaign', modeKey() === 'campaign');
    ok('Campaign shows Home, Packs, Decks, Campaign, Rules', JSON.stringify(shown()) === JSON.stringify(['home', 'packs', 'decks', 'campaign', 'rules']), shown());
    setMode('sandbox', { quiet: true });
    ok('Sandbox starts fresh: 500 coins, no wins', profile.coins === START_COINS && profile.wins === 0 && profile.losses === 0, money());
    ok('Sandbox shows Packs, Play, Precons, Draft, Welcome Decks, no Shop or Campaign', JSON.stringify(shown()) === JSON.stringify(['home', 'packs', 'decks', 'play', 'precons', 'draft', 'welcome', 'rules']), shown());
    ok('the collection and decks are shared', profile.collection.abc === 2 && profile.decks.length === 1);
    ok('the test buttons show only in Sandbox', !document.querySelector('[data-modes="sandbox"]').classList.contains('hidden'));
    profile.coins += 4000; profile.wins = 5; profile.usd = 999; saveProfile();
    setMode('shop', { quiet: true });
    ok('Shop gets Campaign\'s money, not Sandbox\'s', profile.coins === 1234 && profile.usd === 77.5 && profile.wins === 9 && profile.losses === 4, money());
    ok('Shop shows Shop, Distributor, Decks', JSON.stringify(shown()) === JSON.stringify(['home', 'decks', 'shop', 'dist', 'rules']), shown());
    ok('the test buttons are hidden outside Sandbox', document.querySelector('[data-modes="sandbox"]').classList.contains('hidden'));
    profile.usd = round2(profile.usd - 20); profile.coins -= 100; saveProfile();
    setMode('campaign', { quiet: true });
    ok('Campaign and Shop share one purse', profile.coins === 1134 && profile.usd === 57.5, money());
    setMode('sandbox', { quiet: true });
    ok('Sandbox kept its own money and record', profile.coins === START_COINS + 4000 && profile.wins === 5 && profile.usd === 999, money());
    setMode('campaign', { quiet: true });
    ok('and Campaign\'s record is unchanged by Sandbox', profile.wins === 9 && profile.losses === 4, money());
    ok('the stash holds only the parked bucket', Object.keys(profile.stash).join() === 'sandbox', Object.keys(profile.stash));

    // ---- a save survives a reload in the right mode ----
    setMode('sandbox', { quiet: true }); saveProfile(); await STORAGE.flush();
    const raw = store.get(`profile:${accounts.current}`, null);
    ok('the saved profile remembers the mode and bucket', raw && raw.mode === 'sandbox' && raw.bucket === 'sandbox' && raw.stash.main.coins === 1134, raw && { mode: raw.mode, bucket: raw.bucket });
    setMode('campaign', { quiet: true });

    // ---- views from other modes are refused ----
    showView('home');
    showView('shop');
    ok('opening the Shop from Campaign is refused and goes Home', !$('view-shop').classList.contains('hidden') === false && !$('view-home').classList.contains('hidden'));
    showView('campaign');
    ok('Campaign opens in Campaign', !$('view-campaign').classList.contains('hidden'));
    setMode('shop', { quiet: true });
    ok('the cash pill opens the Shop in Shop mode', modeAllows('shop'));
    ok('the phone bottom bar follows the mode', [...document.querySelectorAll('.bottom-nav [data-v]')].filter(b => !b.classList.contains('hidden')).map(b => b.dataset.v).join() === 'home,decks,more', [...document.querySelectorAll('.bottom-nav [data-v]')].filter(b => !b.classList.contains('hidden')).map(b => b.dataset.v));

    // ---- Campaign deck-value limits ----
    const [k, f, r] = CAMPAIGN_TIERS;
    ok('Kitchen Table: a $20 deck is fine, a $80 deck is over the limit', campaignDeckProblem(k, 20) === null && /up to \$50\.00/.test(campaignDeckProblem(k, 80) || ''), campaignDeckProblem(k, 80));
    ok('Friday Night Magic: needs $50 to $300', /\$50\.00 or more/.test(campaignDeckProblem(f, 20) || '') && campaignDeckProblem(f, 120) === null && /up to \$300\.00/.test(campaignDeckProblem(f, 500) || ''));
    ok('Regional Qualifier: $100 minimum, no maximum', /\$100\.00 or more/.test(campaignDeckProblem(r, 40) || '') && campaignDeckProblem(r, 99999) === null);
    return out;
};

async function main() {
    // Its own browser profile: this suite saves modes and money, which must not leak into the other suites' profile
    const dir = path.join(ROOT, 'tests', '.cache', 'modes');
    fs.rmSync(dir, { recursive: true, force: true });
    const h = await launch({ profileDir: dir });
    const { page, errors } = await openTestPage(h.ctx, h.server);
    await installHelpers(page);
    const raw = await page.evaluate(`(${BODY.toString()})()`);
    const results = formatChecks(raw);
    const good = printResults('modes', results, errors);
    writeOut('modes', { results, errors });
    await h.close();
    process.exit(good ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(2); });
