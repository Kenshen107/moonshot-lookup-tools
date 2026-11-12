#!/usr/bin/env python3
"""Run the Spellslinger Duels tests. Suites run in parallel; each result prints as it finishes.

    python3 tests/run_all.py                the fast run (about 4 minutes): gameplay, screens, Ascent and the 300-game lab
    python3 tests/run_all.py --changed      only the suites that match the files you changed (plus the fast set if the core changed)
    python3 tests/run_all.py --cards        fast + card-reader work: coverage, rules snapshot, every deck and commander-round suite, and the standard check of every deck
    python3 tests/run_all.py --games        fast + whole AI games (about 40) and the card-by-card test of the verified decks
    python3 tests/run_all.py --full         everything, including the Welcome Decks, Starter Kits and ~100 games (about 40 minutes)
    python3 tests/run_all.py engine pod     only the named suites (any part of a suite's name)
    --jobs N      how many suites run at once (default 3; the machine's browser is the limit)
    --list        print the groups and exit

Run `--cards` after changing the card reader or any rules pack, and `--games` after changing the AI or the engine in a big way.
Needs: node, Playwright for Node, the Chromium at /opt/pw-browsers (see tests/README.md).
GAME_ROOT=/path/to/another/checkout runs the same tests against an older copy of the game.
A suite that fails is run once more on its own, because a few fail only when several browsers share the machine; a retry that passes is
reported as "flaky" so it isn't forgotten.
"""
import concurrent.futures
import os
import re
import shutil
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SUITES = os.path.join(HERE, 'suites')

# Groups of suites (file names in tests/suites). Every suite is in exactly one group.
PLAY = ['engine', 'blocking', 'priority', 'aiblock', 'aireserve', 'pod', 'multiattack', 'tablesense', 'sequencing', 'attacklist', 'commander',
        'politics2', 'politics3', 'characters', 'votes', 'banter', 'tension', 'selftarget', 'stackgroup', 'lands', 'manafixes', 'replicate',
        'explore', 'partners', 'records', 'extracombat', 'aifog', 'spellscores']
SCREENS = ['openboard', 'storage', 'redraw', 'layout', 'modes', 'precons', 'playpicker', 'about', 'home', 'podseats', 'looks', 'packlooks', 'owner1023']
ASCENT = ['ascent', 'ascentdecks', 'ascentupg', 'ascentpower', 'ascentui', 'ascentart', 'ascentart2']
LIVE = ['randomdeck', 'themes']  # need live Scryfall: they fail when it is slow or blocked, so they run with --cards and --full
DECKS = ['cmdr', 'soc', 'gishath', 'jenova', 'bertha', 'othelm', 'hugh', 'hughfood', 'grizzlegom', 'sixdecks', 'spiderman', 'fivedecks', 'samutdf', 'uldaros',
         'trek', 'trekdecks', 'odric', 'cmdr300', 'cmdr300b', 'cmdr300c', 'cmdr300d', 'cmdr300e', 'cmdr300f', 'cmdr300g', 'cmdr300h', 'cmdr300i', 'cmdr300j']
NEEDS_CARDS = set(PLAY) - {'engine', 'blocking', 'priority', 'aiblock', 'aireserve'} | set(DECKS)  # read tests/data/cards_all.json or live cards



def suite(n, group):
    lim = 900 if n.startswith('cmdr300') or n in ('fivedecks', 'themes') else 600
    return {'name': n, 'cmd': [n + '.js'], 'limit': lim, 'group': group}


CHECK = os.path.join(HERE, 'check.js')


def check_steps(files=None, builtin=True):
    """The standard check (tests/check.js) once per deck: every list file in tests/decks and every built-in verified deck."""
    steps = []
    if files is None:
        d = os.path.join(HERE, 'decks')
        files = sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.txt'))
    for f in files:
        steps.append({'name': 'standard: ' + os.path.basename(f)[:-4], 'cmd': [CHECK, f, '--quick'], 'limit': 900, 'group': 'standard'})
    if builtin:
        try:
            keys = subprocess.run(['node', CHECK, '--builtin', '--list-builtin'], capture_output=True, text=True, timeout=120).stdout.split()
        except Exception:
            keys = []
        for k in keys:
            steps.append({'name': 'standard: ' + k, 'cmd': [CHECK, '--builtin', '--key', k, '--quick'], 'limit': 900, 'group': 'standard'})
    return steps


def plan(mode, only, changed):
    have_cards = os.path.exists(os.path.join(HERE, 'data', 'cards_all.json'))
    groups = [(PLAY, 'play'), (SCREENS, 'screens'), (ASCENT, 'ascent')]
    steps = []
    # the lab goes first: it is the longest of the fast set
    steps.append({'name': 'lab (300 seeded games)', 'cmd': ['lab.js'], 'limit': 1200, 'group': 'lab'})
    for names, g in groups:
        steps += [suite(n, g) for n in names]
    if mode in ('cards', 'full'):
        steps += [suite(n, 'live') for n in LIVE]
        steps += [suite(n, 'decks') for n in DECKS]
        steps.append({'name': 'coverage', 'cmd': ['coverage.js'], 'limit': 900, 'group': 'heavy'})
        steps.append({'name': 'rules snapshot', 'cmd': ['rules-snapshot.js'], 'limit': 900, 'group': 'heavy'})
        if have_cards:
            steps += check_steps()  # the standard check for every deck
    if mode == 'full':
        steps.append({'name': 'cards (all groups)', 'cmd': ['cards.js', 'all'], 'limit': 3600, 'group': 'heavy'})
        steps.append({'name': 'games (full)', 'cmd': ['games.js', '--full'], 'limit': 3600, 'group': 'heavy'})
    elif mode == 'games':
        steps.append({'name': 'cards (verified decks)', 'cmd': ['cards.js', '--quick'], 'limit': 900, 'group': 'heavy'})
        steps.append({'name': 'games', 'cmd': ['games.js'], 'limit': 1800, 'group': 'heavy'})
    elif mode == 'cards':
        steps.append({'name': 'cards (Mirrodin, Magic 2010)', 'cmd': ['cards.js', 'mirrodin', 'm10'], 'limit': 600, 'group': 'heavy'})
    if mode == 'changed':
        steps = pick_changed(steps, changed)
    if not have_cards:
        steps = [s for s in steps if s['cmd'][0][:-3] not in NEEDS_CARDS and s['cmd'][0] not in ('coverage.js', 'rules-snapshot.js')] if mode != 'quick' else steps
    if only:
        every = steps + [suite(n, 'x') for n in PLAY + SCREENS + ASCENT + LIVE + DECKS if not any(s['cmd'][0] == n + '.js' for s in steps)]
        steps = [s for s in every if any(o in s['name'] or o in s['cmd'][0] for o in only)]
    return steps, have_cards


def changed_files():
    out = []
    for cmd in (['git', 'diff', '--name-only', 'origin/main...HEAD'], ['git', 'diff', '--name-only', 'HEAD'], ['git', 'ls-files', '--others', '--exclude-standard']):
        try:
            out += subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.split()
        except Exception:
            pass
    return sorted(set(out))


def pick_changed(steps, changed):
    """Suites named after a changed file (spellslinger/rules/samutdf.js, 15n-samutdf.js, tests/suites/samutdf.js -> samutdf), plus the
    fast set when anything else in the game changed."""
    names = {s['cmd'][0][:-3]: s for s in steps}
    every = {n: suite(n, 'x') for n in PLAY + SCREENS + ASCENT + LIVE + DECKS}
    chosen, rest = {}, False
    for f in changed:
        if f.startswith('tests/decks/') and f.endswith('.txt'):
            for st in check_steps([os.path.join(ROOT, f)], builtin=False):
                chosen[st['name']] = st
            continue
        base = os.path.basename(f)
        stem = re.sub(r'\.\w+$', '', base)
        stem = re.sub(r'^\d+[a-z]?-', '', stem)
        hit = None
        for cand in (stem, stem.replace('-', ''), re.sub(r'^cmdr300', 'cmdr300', stem)):
            if cand in every:
                hit = cand
                break
        if f.startswith('tests/suites/') and stem in every:
            hit = stem
        if hit:
            chosen[hit] = every[hit]
        elif f.startswith(('spellslinger/', 'Spellslinger_Duels.html')) or f.startswith('tests/lib/'):
            rest = True
    if rest or not chosen:
        for n, s in names.items():
            chosen.setdefault(n, s)
    return list(chosen.values())


def run_step(step, lock, profile):
    env = dict(os.environ, TEST_PROFILE=profile)
    t0 = time.time()
    try:
        p = subprocess.run(['node', step['cmd'][0] if os.path.isabs(step['cmd'][0]) else os.path.join(SUITES, step['cmd'][0])] + step['cmd'][1:], timeout=step['limit'], capture_output=True, text=True, env=env)
        ok, out = p.returncode == 0, p.stdout + p.stderr
    except subprocess.TimeoutExpired as e:
        ok, out = False, f"TIMED OUT after {step['limit']}s\n" + ((e.stdout or b'').decode('utf8', 'ignore') if isinstance(e.stdout, bytes) else (e.stdout or ''))
    return ok, out, time.time() - t0


def main():
    args = sys.argv[1:]
    jobs = 3
    if '--jobs' in args:
        i = args.index('--jobs')
        jobs = int(args[i + 1])
        del args[i:i + 2]
    if '--list' in args:
        for label, names in (('play', PLAY), ('screens', SCREENS), ('ascent', ASCENT), ('live (Scryfall)', LIVE), ('decks and commander rounds', DECKS)):
            print(f'{label}: {", ".join(names)}')
        return 0
    mode = 'full' if '--full' in args else 'changed' if '--changed' in args else 'cards' if '--cards' in args else 'games' if '--games' in args else 'fast'
    only = [a for a in args if not a.startswith('--')]
    if not shutil.which('node'):
        print('node is not installed.')
        return 2
    changed = changed_files() if mode == 'changed' else []
    steps, have_cards = plan(mode, only, changed)
    if not have_cards:
        print('(card-file suites skipped: run `python3 tests/fetch_cards.py` first to make tests/data/cards_all.json)\n')
    if mode == 'changed':
        print(f'Changed files: {len(changed)}. Suites chosen: {", ".join(s["name"] for s in steps)}\n', flush=True)
    lock = threading.Lock()
    results = []
    t_all = time.time()

    def work(item):
        i, step = item
        ok, out, secs = run_step(step, lock, f'ra{i}')
        flaky = False
        if not ok:
            ok2, out2, secs2 = run_step(step, lock, f'ra{i}r')
            if ok2:
                ok, out, flaky, secs = True, out2, True, secs + secs2
            else:
                out, secs = out2, secs + secs2
        with lock:
            tag = 'PASS ' if ok and not flaky else 'FLAKY' if flaky else 'FAIL '
            last = [l for l in out.strip().splitlines() if l.strip()][-1:] or ['']
            print(f'{tag} {step["name"]:34s} {secs:5.0f}s  {last[0][:90]}', flush=True)
            if not ok:
                bad = [l for l in out.splitlines() if l.startswith('FAIL') or 'TIMED OUT' in l or 'Error' in l][:8]
                for l in bad:
                    print('      ' + l[:200], flush=True)
        results.append((step['name'], ok, flaky, secs))

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, jobs)) as ex:
        list(ex.map(work, list(enumerate(steps))))
    bad = [r for r in results if not r[1]]
    flaky = [r for r in results if r[2]]
    print(f'\n{len(results)} suites in {time.time() - t_all:.0f}s.', end=' ')
    if flaky:
        print('Flaky (failed once, passed on retry): ' + ', '.join(r[0] for r in flaky) + '.', end=' ')
    print('All tests passed.' if not bad else f'{len(bad)} suite(s) failed: ' + ', '.join(r[0] for r in bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
