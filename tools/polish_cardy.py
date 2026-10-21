#!/usr/bin/env python3
"""Cleans up Cardy's sprite sheet (art/site/cardy.png, 6 rows x 16 frames of 96 x 96).

The generated frames have two flaws: stray single pixels around the edges (speckle), and arms drawn as thin lines that stop short of the card
or the glove so the hand seems to float. For every frame this script
  1. lines the card up with the row's median position (whole pixels; not on the cheer row, where he jumps on purpose),
  2. removes pixels with almost no neighbors and fills one-pixel holes (a 3 x 3 majority pass on the alpha),
  3. deletes small detached specks, except yellow sparkles (the cheer row),
  4. (rows that are lined up) wipes the dotted noise above the card's top edge,
  5. draws a 2-pixel arm line from any big detached piece (a glove) to the nearest part of the rest of the drawing.
`--replace 1:5=6` copies frame 6 of row 1 over frame 5 (for a frame whose outline came out rough). Run it once per freshly generated sheet (a second run is harmless but pointless). The old sheet is kept in art/site/_old/.

  python tools/polish_cardy.py            report only
  python tools/polish_cardy.py --write
"""
import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit('Needs numpy and Pillow:  pip install numpy pillow')

sys.path.insert(0, str(Path(__file__).resolve().parent))
from keep_old import keep_old  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'art' / 'site' / 'cardy.png'
S = 96
ROWS, COLS = 6, 16
CHEER = 4
MIN_PART = 14          # a piece this big is a glove or the body; smaller ones are specks
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def components(opaque):
    h, w = opaque.shape
    lab = np.zeros((h, w), dtype=np.int32)
    parts = []
    for y in range(h):
        for x in range(w):
            if opaque[y, x] and not lab[y, x]:
                n = len(parts) + 1
                stack, pts = [(y, x)], []
                lab[y, x] = n
                while stack:
                    cy, cx = stack.pop()
                    pts.append((cy, cx))
                    for dy, dx in NB:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and opaque[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            stack.append((ny, nx))
                parts.append(pts)
    return lab, parts


def teal_box(fr):
    r, g, b, a = (fr[..., i].astype(int) for i in range(4))
    m = (a > 0) & (g > r + 25) & (b > r + 15) & (g > 90)
    rows = np.nonzero(m.sum(axis=1) >= 15)[0]
    cols = np.nonzero(m.sum(axis=0) >= 15)[0]
    if len(rows) < 20 or len(cols) < 15:
        return None
    return int(cols.min()), int(rows.min()), int(cols.max())


def shift(fr, dx, dy):
    out = np.zeros_like(fr)
    h, w = fr.shape[:2]
    ys, xs = slice(max(0, dy), min(h, h + dy)), slice(max(0, dx), min(w, w + dx))
    ys0, xs0 = slice(max(0, -dy), min(h, h - dy)), slice(max(0, -dx), min(w, w - dx))
    out[ys, xs] = fr[ys0, xs0]
    return out


def majority(fr):
    a = fr[..., 3] > 0
    h, w = a.shape
    pad = np.pad(a, 1)
    cnt = sum(pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w].astype(int) for dy, dx in NB)
    out = fr.copy()
    lonely = a & (cnt <= 1)
    out[lonely] = 0
    # fill a one-pixel hole with the average of its neighbors' colors
    holes = (~a) & (cnt >= 7)
    for y, x in zip(*np.nonzero(holes)):
        near = [fr[y + dy, x + dx] for dy, dx in NB if 0 <= y + dy < h and 0 <= x + dx < w and fr[y + dy, x + dx, 3] > 0]
        if near:
            out[y, x] = np.mean(near, axis=0).astype(np.uint8)
    return out, int(lonely.sum()), int(holes.sum())


def is_sparkle(fr, pts):
    cols = np.array([fr[y, x, :3] for y, x in pts], dtype=int)
    m = cols.mean(axis=0)
    return m[0] > 180 and m[1] > 150 and m[2] < 170          # yellow / gold


def line(fr, p, q, color):
    (y0, x0), (y1, x1) = p, q
    n = max(abs(y1 - y0), abs(x1 - x0), 1)
    for i in range(n + 1):
        y = round(y0 + (y1 - y0) * i / n)
        x = round(x0 + (x1 - x0) * i / n)
        for oy, ox in ((0, 0), (0, 1)):
            if 0 <= y + oy < S and 0 <= x + ox < S and fr[y + oy, x + ox, 3] == 0:
                fr[y + oy, x + ox] = color


def tidy(fr, row):
    fr, lonely, holes = majority(fr)
    removed = joined = 0
    lab, parts = components(fr[..., 3] > 0)
    if parts:
        order = sorted(range(len(parts)), key=lambda i: -len(parts[i]))
        main = order[0]
        for i in order[1:]:
            pts = parts[i]
            if len(pts) < MIN_PART:
                if row == CHEER and is_sparkle(fr, pts):
                    continue
                for y, x in pts:
                    fr[y, x] = 0
                removed += 1
                continue
            # a glove: link it to the closest pixel of the main piece with a dark arm line
            body = np.array(parts[main])
            best = None
            for y, x in pts:
                d = np.abs(body - (y, x)).sum(axis=1)
                j = int(d.argmin())
                if best is None or d[j] < best[0]:
                    best = (int(d[j]), (y, x), tuple(body[j]))
            if best and best[0] > 2:
                dark = np.array([0, 0, 0, 255], dtype=np.uint8)
                darks = [fr[y, x] for y, x in pts if fr[y, x, :3].sum() < 150]
                if darks:
                    dark = np.median(np.array(darks), axis=0).astype(np.uint8)
                line(fr, best[1], best[2], dark)
                joined += 1
    return fr, lonely, holes, removed, joined


def clear_top(fr, box):
    # the card's dark outline sits one pixel above its first teal row; anything higher, across the card's width, is noise
    x0, y0, x1 = box
    top = max(0, y0 - 2)
    n = int((fr[:top, x0:x1 + 1, 3] > 0).sum())
    fr[:top, x0:x1 + 1] = 0
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--replace', default='', help='row:col=srccol,... copy one frame of a row over a badly drawn one (rows and columns count from 0)')
    a = ap.parse_args()
    swaps = {}
    for item in filter(None, a.replace.split(',')):
        dst, src = item.split('=')
        r, c = dst.split(':')
        swaps[(int(r), int(c))] = int(src)
    im = Image.open(SHEET).convert('RGBA')
    if im.size != (COLS * S, ROWS * S):
        sys.exit(f'Unexpected sheet size {im.size}')
    arr = np.array(im)
    out = arr.copy()
    totals = [0, 0, 0, 0]
    for r in range(ROWS):
        frames = [arr[r * S:(r + 1) * S, c * S:(c + 1) * S].copy() for c in range(COLS)]
        for (sr, sc), src in swaps.items():
            if sr == r:
                frames[sc] = frames[src].copy()
        if r != CHEER:
            boxes = [teal_box(f) for f in frames]
            ok = [b for b in boxes if b]
            if ok:
                mx = int(np.median([b[0] for b in ok]))
                my = int(np.median([b[1] for b in ok]))
                mw = int(np.median([b[2] - b[0] for b in ok]))
                frames = [shift(f, mx - b[0], my - b[1]) if b else f for f, b in zip(frames, boxes)]
        for c, f in enumerate(frames):
            f, lo, ho, rm, jn = tidy(f, r)
            if r != CHEER and ok:
                lo += clear_top(f, (mx, my, mx + mw))
            for i, v in enumerate((lo, ho, rm, jn)):
                totals[i] += v
            out[r * S:(r + 1) * S, c * S:(c + 1) * S] = f
    print(f'speckle pixels removed {totals[0]}, holes filled {totals[1]}, small pieces removed {totals[2]}, arms joined {totals[3]}')
    if a.write:
        keep_old(SHEET)
        Image.fromarray(out).save(SHEET)
        print('wrote', SHEET)


if __name__ == '__main__':
    main()
