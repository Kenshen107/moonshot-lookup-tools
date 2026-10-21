#!/usr/bin/env python3
"""Cleans up the character sprite sheets (spellslinger/art/characters/*.png) without calling the art service.

The generated idle row isn't a loop: it starts on the base drawing, settles into a calm face and ends mid-blink, so replaying it
pops every cycle. For each sheet this script
  1. steadies the frames (removes whole-pixel wobble between frames, keeps slow movement such as breathing),
  2. skips the settling-in frames at the start of the idle row,
  3. picks the 9 frames with the most life and plays them forward then backward (a ping-pong of 16 frames), which loops with no seam,
  4. steadies the talking row and fades its loop seam.
Sheets stay 1536 x 192 (2 rows of 16 frames of 96 x 96), so the game needs no change. The originals are in git history.

  python tools/polish_sheets.py            report only (what would change, seam before and after)
  python tools/polish_sheets.py --write    rewrite the sheets in place
  python tools/polish_sheets.py --only t1-mick --write
"""
import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit('Needs numpy and Pillow:  pip install numpy pillow')

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'spellslinger' / 'art' / 'characters'
W = H = 96
COLS = 16
WINDOW = 9  # forward 9 + backward 7 = 16 frames, a seamless ping-pong


def rows_of(im):
    a = np.asarray(im.convert('RGBA'), dtype=np.float32)
    return [[a[r * H:(r + 1) * H, c * W:(c + 1) * W] for c in range(COLS)] for r in (0, 1)]


def gray(f):
    return f[..., :3].mean(axis=2) * (f[..., 3] / 255.0)


def diff(a, b):
    return float(np.abs(a - b).mean())


def shift(f, dx, dy):
    """Moves a frame by whole pixels, filling the edge by repeating the nearest pixel (the portraits are full-bleed)."""
    if not dx and not dy:
        return f
    p = 4
    padded = np.pad(f, ((p, p), (p, p), (0, 0)), mode='edge')
    return padded[p - dy:p - dy + H, p - dx:p - dx + W]


def best_shift(ref, f, r=3):
    g0, g1 = gray(ref), gray(f)
    best, arg = None, (0, 0)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            s = np.abs(g0[r:-r, r:-r] - np.roll(np.roll(g1, dy, 0), dx, 1)[r:-r, r:-r]).mean()
            if best is None or s < best:
                best, arg = s, (dx, dy)
    return arg


def steady(frames):
    """Removes jitter: each frame's offset from the median frame is smoothed over its neighbours, and only the difference is undone."""
    ref = np.median(np.stack(frames), axis=0)
    sh = np.array([best_shift(ref, f) for f in frames], dtype=np.float32)
    smooth = sh.copy()
    for i in range(len(sh)):
        lo, hi = max(0, i - 2), min(len(sh), i + 3)
        smooth[i] = sh[lo:hi].mean(axis=0)
    out = []
    for f, s, m in zip(frames, sh, smooth):
        out.append(shift(f, int(round(s[0] - m[0])), int(round(s[1] - m[1]))))
    return out


def seam(frames):
    steps = [diff(frames[i], frames[i + 1]) for i in range(len(frames) - 1)]
    return round(float(np.mean(steps)), 1), round(diff(frames[-1], frames[0]), 1)


def pick_window(frames):
    """Skips the settling-in frames, then takes the WINDOW frames that move the most."""
    ref = np.median(np.stack(frames[8:]), axis=0)
    d = [diff(f, ref) for f in frames]
    base = float(np.median(d[8:])) + 0.5
    start = 0
    while start < len(frames) - WINDOW and d[start] > base * 1.6:
        start += 1
    # candidate windows: keep the ones with at least 40% of the best movement, then take the one with the smallest biggest jump
    cands = []
    for st in range(start, len(frames) - WINDOW + 1):
        steps = [diff(frames[i], frames[i + 1]) for i in range(st, st + WINDOW - 1)]
        cands.append((st, sum(steps), max(steps)))
    top = max(c[1] for c in cands)
    ok = [c for c in cands if c[1] >= top * 0.4] or cands
    a = min(ok, key=lambda c: (c[2], -c[1]))[0]
    return a, start


def pingpong(win):
    return win + win[-2:0:-1]  # 9 forward + 7 back = 16, the end frames are not repeated


def fade_seam(frames, k=3):
    """Blends the last k frames toward the first so a loop that isn't perfect still closes."""
    out = list(frames)
    n = len(out)
    for i in range(k):
        w = (i + 1) / (k + 1)
        out[n - k + i] = out[n - k + i] * (1 - w * 0.5) + out[i] * (w * 0.5)
    return out


def build(path, write):
    im = Image.open(path)
    if im.size != (COLS * W, 2 * H):
        return f'{path.name}: skipped (size {im.size})'
    idle, talk = rows_of(im)
    b_idle, b_talk = seam(idle), seam(talk)
    idle_s = steady(idle)
    a, start = pick_window(idle_s)
    idle_new = pingpong(idle_s[a:a + WINDOW])
    talk_new = fade_seam(steady(talk))
    a_idle, a_talk = seam(idle_new), seam(talk_new)
    if write:
        sheet = np.zeros((2 * H, COLS * W, 4), dtype=np.float32)
        for r, row in enumerate((idle_new, talk_new)):
            for c, f in enumerate(row):
                sheet[r * H:(r + 1) * H, c * W:(c + 1) * W] = f
        Image.fromarray(np.clip(sheet.round(), 0, 255).astype(np.uint8), 'RGBA').save(path, 'PNG')
    return (f'{path.stem:<16} idle step/seam {b_idle[0]:>4}/{b_idle[1]:>4} -> {a_idle[0]:>4}/{a_idle[1]:>4}   '
            f'talk seam {b_talk[1]:>4} -> {a_talk[1]:>4}   (settle-in: first {start} frames skipped, window {a}-{a + WINDOW - 1})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--only')
    a = ap.parse_args()
    files = sorted(DIR.glob('*.png'))
    if a.only:
        files = [f for f in files if f.stem in a.only.split(',')]
    for f in files:
        print(build(f, a.write))
    if not a.write:
        print('\nReport only. Add --write to rewrite the sheets (originals stay in git history).')


if __name__ == '__main__':
    main()
