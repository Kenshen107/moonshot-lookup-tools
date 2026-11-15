#!/usr/bin/env python3
"""Lists the CMD ids whose rules text says "target" and whose body picks a card (spellslinger/rules/*.js and the CMD bodies in spellslinger/15*.js).
They are the ids in DRY_CMD (spellslinger/15x-casting.js): a person is asked for their picks as the spell is cast. Rerun after adding cards and paste the list into DRY_CMD."""
import re, glob, os
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'spellslinger'))
ids = {}
for f in glob.glob('rules/*.js'):
    if f.endswith('sixlists.js'): continue
    for l in open(f):
        if re.search(r'target', l, re.I) and not re.search(r"target: '", l):
            for m in re.finditer(r"cmd\('([A-Za-z0-9_]+)'", l): ids.setdefault(m.group(1), f)
bodies = {}
for f in glob.glob('15*.js'):
    if 'sixlists' in f or 'casting' in f: continue
    t = open(f).read()
    for m in re.finditer(r"^\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(P, e, t, src[^)]*\)\s*\{", t, re.M):
        i = m.end(); depth = 1; j = i
        while j < len(t) and depth > 0:
            if t[j] == '{': depth += 1
            elif t[j] == '}': depth -= 1
            j += 1
        bodies[m.group(1)] = t[i:j]
picky = sorted(k for k in ids if k in bodies and re.search(r'pickCard\(|pickOwn\(|slPickFrom\(', bodies[k]))
print(len(picky), 'ids')
print(','.join(repr(x) for x in picky))
