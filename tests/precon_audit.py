#!/usr/bin/env python3
"""Downloads every precon the game uses (MTGJSON) into tests/.cache/precon_names.json:
[[type, name, code, date, fileName, [card names]], ...]. Run once; precon_audit.js reads it."""
import json, os, subprocess, concurrent.futures as cf
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '.cache', 'precon_names.json')
TYPES = ['Welcome Deck', 'Starter Kit', 'Arena Starter Kit', 'Planeswalker Deck', 'Challenger Deck', 'Pioneer Challenger Deck', 'Intro Pack', 'Theme Deck', 'Starter Deck']
def curl(url):
    for _ in range(3):
        r = subprocess.run(['curl', '-s', '--max-time', '60', url], capture_output=True)
        try: return json.loads(r.stdout)
        except Exception: pass
    return None
dl = curl('https://mtgjson.com/api/v5/DeckList.json')['data']
decks = [x for x in dl if x['type'] in TYPES]
def get(x):
    j = curl(f"https://mtgjson.com/api/v5/decks/{x['fileName']}.json")
    if not j: return None
    j = j['data']
    return [x['type'], x['name'], x['code'], x.get('releaseDate'), x['fileName'], [c['name'] for k in ('mainBoard', 'commander') for c in j.get(k, []) for _ in range(c.get('count', 1))]]
with cf.ThreadPoolExecutor(8) as ex: rows = [r for r in ex.map(get, decks) if r]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(rows, open(OUT, 'w'))
print(len(rows), 'decks saved to', OUT)
