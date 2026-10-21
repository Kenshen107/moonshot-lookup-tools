"""Keeps the old copy of an art file before a script overwrites it (the owner pays for every generation, so nothing is thrown away).

keep_old(path) copies path to <its folder>/_old/<name>.<date-time><ext>, if path exists. The _old folders sit inside art/ and
spellslinger/art/, so `git add art spellslinger/art` commits them too. The game never reads _old.
"""
import shutil
import time
from pathlib import Path


def keep_old(path):
    p = Path(path)
    if not p.exists():
        return None
    d = p.parent / '_old'
    d.mkdir(exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S', time.localtime(p.stat().st_mtime))   # when that version was made
    dest = d / f'{p.stem}.{stamp}{p.suffix}'
    n = 2
    while dest.exists():
        dest = d / f'{p.stem}.{stamp}-{n}{p.suffix}'
        n += 1
    shutil.copy2(p, dest)
    return dest
