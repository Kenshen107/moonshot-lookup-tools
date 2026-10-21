#!/usr/bin/env python3
"""Makes the seasonal falling sprites (art/site/fall-*.png, 4 frames of 32 x 32) loop without a pop.

For each sprite it tries every order of the 4 frames; if the best plain loop still jumps more than 1.3x its average step, the frames
are played forward then backward (a b c d c b, 6 frames, seamless by construction). The page reads the frame count from the width.
Run it once per freshly generated sprite (a second run would only re-order already-processed frames).

  python tools/polish_fall.py            report only
  python tools/polish_fall.py --write
"""
import argparse
import itertools
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from keep_old import keep_old  # noqa: E402

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit('Needs numpy and Pillow:  pip install numpy pillow')

DIR = Path(__file__).resolve().parent.parent / 'art' / 'site'
S = 32


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    for f in sorted(DIR.glob('fall-*.png')):
        im = Image.open(f).convert('RGBA')
        if im.size != (4 * S, S):
            print(f'{f.stem:<18} skipped (size {im.size}, already processed?)')
            continue
        arr = np.asarray(im, dtype=np.float32)
        fr = [arr[:, i * S:(i + 1) * S] for i in range(4)]
        d = lambda i, j: float(np.abs(fr[i] - fr[j]).mean())
        cyc = lambda o: [d(o[k], o[(k + 1) % 4]) for k in range(4)]
        orig = cyc((0, 1, 2, 3))
        best = min(((0,) + p for p in itertools.permutations((1, 2, 3))), key=lambda o: max(cyc(o)))
        c = cyc(best)
        step = float(np.mean(orig[:3]))
        verdict = 'keep'
        order = (0, 1, 2, 3)
        if max(orig) > 1.3 * max(step, 1.0):
            if max(c) <= 1.3 * max(float(np.mean(c)), 1.0):
                order, verdict = best, 'reordered'
            else:
                order, verdict = (0, 1, 2, 3, 2, 1), 'ping-pong'
        print(f'{f.stem:<18} loop jump {max(orig):5.1f} (avg step {step:4.1f}) -> {verdict} {order if verdict != "keep" else ""}')
        if a.write and verdict != 'keep':
            out = np.concatenate([fr[i] for i in order], axis=1)
            keep_old(f)
            Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGBA').save(f, 'PNG')
    if not a.write:
        print('\nReport only. Add --write to rewrite the sprites.')


main()
