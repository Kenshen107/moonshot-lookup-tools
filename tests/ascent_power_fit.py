#!/usr/bin/env python3
"""Fits the deck-power weights for Planeswalker's Ascent (spellslinger/13i-ascent-power.js) from lab games.

  node tests/lab.js --kind ascentpool --n 12000 --conc 6      # plays the calibration pool against itself (about 20 minutes)
  python3 tests/ascent_power_fit.py                           # reads tests/.out/lab.json, writes spellslinger/data/ascent-power.json

Each game gives both decks' features (fa, fb) and who won. A logistic regression on the feature DIFFERENCE gives one weight per feature (how many
points of logit a unit of that feature is worth). The score is shifted so an average tier 1 opponent (no boss) is 100 and scaled Elo-style
(400 points = 10-to-1 odds). Weights that come out negative are clamped to zero and the fit repeated.
"""
import json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEATURES = ['base', 'm1', 'm2', 'm3', 'm4', 'top']
games = json.load(open(os.path.join(ROOT, 'tests', '.out', 'lab.json')))
rows = [g for g in games if g.get('fa') and g.get('winner') in (0, 1) and not g.get('hang') and not g.get('error')]
if len(rows) < 500:
    sys.exit(f'only {len(rows)} usable games; run the lab with --kind ascentpool --n 12000 first')
X = np.array([[g['fa'][k] - g['fb'][k] for k in FEATURES] for g in rows], dtype=float)
y = np.array([1.0 if g['winner'] == 0 else 0.0 for g in rows])

def fit(X, y, active, l2=1e-2, iters=60):
    A = X[:, active]
    w = np.zeros(A.shape[1])
    for _ in range(iters):  # Newton / IRLS
        z = A @ w
        p = 1 / (1 + np.exp(-np.clip(z, -30, 30)))
        g = A.T @ (p - y) + l2 * w
        H = (A.T * (p * (1 - p))) @ A + l2 * np.eye(len(w))
        step = np.linalg.solve(H, g)
        w -= step
        if np.max(np.abs(step)) < 1e-9:
            break
    return w, H

def cv_accuracy(X, y, active, folds=5, seed=1):
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(y))
    parts = np.array_split(idx, folds)
    hits = 0
    for k in range(folds):
        te = parts[k]; tr = np.concatenate([parts[j] for j in range(folds) if j != k])
        w, _ = fit(X[tr], y[tr], active)
        pred = (X[te][:, active] @ w) > 0
        hits += int(np.sum(pred == (y[te] == 1)))
    return hits / len(y)

active = list(range(len(FEATURES)))
while True:
    w, H = fit(X, y, active)
    neg = [i for i, wi in zip(active, w) if wi < 0 and FEATURES[i] != 'base']
    if not neg:
        break
    active = [i for i in active if i not in neg]
weights = {k: 0.0 for k in FEATURES}
for i, wi in zip(active, w):
    weights[FEATURES[i]] = float(wi)
se = np.sqrt(np.diag(np.linalg.inv(H)))
acc = cv_accuracy(X, y, active)
base_acc = max(y.mean(), 1 - y.mean())

# every deck's features, by name
feats = {}
for g in rows:
    feats[g['a']] = g['fa']; feats[g['b']] = g['fb']
def raw(f): return sum(weights[k] * f[k] for k in FEATURES)
t1 = [n for n in feats if n.endswith('+0') and n.split('+')[0] in ('t1-mick', 't1-annie', 't1-tess', 't1-gus', 't1-cal')]
offset = float(np.mean([raw(feats[n]) for n in t1]))
scale = 400 / math.log(10)
def rating(f): return 100 + scale * (raw(f) - offset)

out = {'weights': weights, 'offset': offset, 'fitted': {'games': len(rows), 'cvAccuracy': round(acc, 4), 'baselineAccuracy': round(float(base_acc), 4), 'features': FEATURES, 'stdErr': {FEATURES[i]: round(float(s), 4) for i, s in zip(active, se)}, 'date': __import__('datetime').date.today().isoformat()}}
json.dump(out, open(os.path.join(ROOT, 'spellslinger', 'data', 'ascent-power.json'), 'w'), indent=1)

print(f'{len(rows)} games, {len(feats)} decks. Held-out accuracy {acc:.3f} (coin flip {base_acc:.3f}).')
print('weights (logit per unit):', {k: round(v, 4) for k, v in weights.items()}, ' std err:', out['fitted']['stdErr'])
# calibration: predicted vs actual win rate, by bins of the power difference
pw = np.array([100 + scale * (raw(g['fa']) - offset) - (100 + scale * (raw(g['fb']) - offset)) for g in rows])
bins = [-1e9, -300, -200, -100, -40, 40, 100, 200, 300, 1e9]
print('power gap (A - B)   games   predicted   actual')
for lo, hi in zip(bins, bins[1:]):
    m = (pw >= lo) & (pw < hi)
    if m.sum() < 20: continue
    pred = float(np.mean(1 / (1 + 10 ** (-pw[m] / 400))))
    print(f'  {max(lo,-999):>5} .. {min(hi,999):<5}  {int(m.sum()):6d}   {pred*100:6.1f}%   {y[m].mean()*100:6.1f}%')
print('opponents (no modules):')
for n in sorted(feats):
    if n.endswith('+0') and (n.startswith('t') or n.startswith('starter')):
        print(f'  {n:18s} {rating(feats[n]):6.0f}')
