"""Shrinks art files that are over their budget in docs/spellslinger-asset-manifest.json, keeping each original in _old/ first.

PNG: reduced to a 256-colour palette with transparency (looks the same at the sizes the game shows); JPEG: re-saved at quality 82 (then lower
if still too big). Sizes in pixels are never changed.

    python3 tools/optimize_art.py spellslinger/art/sleeves/gilded-sanctum.png [more files]
    python3 tools/optimize_art.py --over-budget          every manifest file that is over its budget
"""
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from keep_old import keep_old  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'docs' / 'spellslinger-asset-manifest.json').read_text())
BUDGET = {a['path']: a.get('maxKB') for a in MANIFEST['assets']}


def shrink(path):
    p = Path(path)
    rel = p.resolve().relative_to(ROOT).as_posix()
    budget = (BUDGET.get(rel) or 10 ** 6) * 1024
    before = p.stat().st_size
    im = Image.open(p)
    if p.suffix.lower() == '.png':
        rgba = im.convert('RGBA')
        q = rgba.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
        buf = io.BytesIO()
        q.save(buf, 'PNG', optimize=True)
    else:
        rgb = im.convert('RGB')
        for quality in (82, 76, 70, 64, 58):
            buf = io.BytesIO()
            rgb.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
            if buf.tell() <= budget:
                break
    if buf.tell() >= before:
        print(f'{rel}: already as small as it gets ({before // 1024} KB)')
        return
    keep_old(p)
    p.write_bytes(buf.getvalue())
    note = '' if buf.tell() <= budget else f' - still over the {budget // 1024} KB budget'
    print(f'{rel}: {before // 1024} KB -> {buf.tell() // 1024} KB{note}')


if __name__ == '__main__':
    files = sys.argv[1:]
    if files == ['--over-budget']:
        files = [ROOT / a['path'] for a in MANIFEST['assets'] if (ROOT / a['path']).exists() and a.get('maxKB') and (ROOT / a['path']).stat().st_size > a['maxKB'] * 1024]
    for f in files:
        shrink(f)
