#!/usr/bin/env python3
"""Run the Spellslinger Duels tests. Run this before every commit; nothing that passed may start failing.

    python3 tests/run_all.py             the usual run (about 10 minutes)
    python3 tests/run_all.py --quick     a smoke test (about 3 minutes)
    python3 tests/run_all.py --full      everything, including the Welcome Decks, Starter Kits and ~100 games (about 40 minutes)
    python3 tests/run_all.py engine cards     only the named suites (engine, storage, redraw, cards, coverage, games)

Needs: node, Playwright for Node, the Chromium at /opt/pw-browsers (see tests/README.md).
GAME_ROOT=/path/to/another/checkout runs the same tests against an older copy of the game.
"""
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SUITES = os.path.join(HERE, 'suites')


def plan(mode, only):
    have_cards = os.path.exists(os.path.join(HERE, 'data', 'cards_all.json'))
    steps = [('engine', ['engine.js'], 300), ('storage', ['storage.js'], 300), ('redraw', ['redraw.js'], 300)]
    if mode == 'quick':
        steps.append(('cards (verified decks)', ['cards.js', '--quick'], 600))
        steps.append(('games (quick)', ['games.js', '--quick'], 900))
    elif mode == 'full':
        steps.append(('cards (all groups)', ['cards.js', 'all'], 3600))
        if have_cards:
            steps.append(('coverage', ['coverage.js'], 900))
        steps.append(('games (full)', ['games.js', '--full'], 3600))
    else:
        steps.append(('cards (verified, Mirrodin, Magic 2010)', ['cards.js'], 900))
        if have_cards:
            steps.append(('coverage', ['coverage.js'], 900))
        steps.append(('games', ['games.js'], 1800))
    if only:
        steps = [s for s in steps if any(o in s[0] for o in only)]
    return steps, have_cards


def main():
    args = sys.argv[1:]
    mode = 'full' if '--full' in args else 'quick' if '--quick' in args else 'normal'
    only = [a for a in args if not a.startswith('--')]
    if not shutil.which('node'):
        print('node is not installed.')
        return 2
    steps, have_cards = plan(mode, only)
    if not have_cards and mode != 'quick':
        print('(coverage skipped: run `python3 tests/fetch_cards.py` first to make tests/data/cards_all.json)\n')
    results = []
    for name, cmd, limit in steps:
        print(f'=== {name}', flush=True)
        t0 = time.time()
        try:
            p = subprocess.run(['node', os.path.join(SUITES, cmd[0])] + cmd[1:], timeout=limit)
            ok = p.returncode == 0
        except subprocess.TimeoutExpired:
            ok = False
            print(f'TIMED OUT after {limit}s')
        results.append((name, ok, time.time() - t0))
        print(flush=True)
    print('=== Summary')
    for name, ok, secs in results:
        print(f'{"PASS" if ok else "FAIL"}  {name}  ({secs:.0f}s)')
    bad = [r for r in results if not r[1]]
    print('\nAll tests passed.' if not bad else f'\n{len(bad)} suite(s) failed.')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
