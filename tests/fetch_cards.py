#!/usr/bin/env python3
"""Download Scryfall's oracle-cards bulk file and write a slim copy for the coverage test.

    python3 tests/fetch_cards.py            # writes tests/data/cards_all.json (about 40MB, not committed)

The slim file keeps only what the game's card reader (`slimCard` / `rulesFor`) looks at, for every paper card
(one entry per oracle card). It tries the bulk file first and, where that host is blocked (as in Claude's cloud
environment), pages through the search API (about 200 requests, under a minute). The coverage test (tests/suites/coverage.js) measures how many read as Automated.
"""
import gzip
import json
import os
import sys
import urllib.parse
import urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'cards_all.json')
UA = {'User-Agent': 'moonshot-lookup-tools-tests/1.0', 'Accept': 'application/json;q=0.9,*/*;q=0.8'}

# Layouts that are not cards you can put in a deck
SKIP_LAYOUTS = {'token', 'double_faced_token', 'emblem', 'art_series', 'vanguard', 'scheme', 'planar', 'augment', 'host'}
KEEP = ['id', 'name', 'mana_cost', 'cmc', 'type_line', 'oracle_text', 'power', 'toughness', 'colors', 'color_identity', 'layout', 'loyalty',
        'defense', 'rarity', 'set', 'set_name', 'collector_number', 'edhrec_rank', 'frame_effects', 'released_at', 'keywords']
FACE_KEEP = ['name', 'mana_cost', 'type_line', 'oracle_text', 'power', 'toughness', 'colors', 'loyalty', 'defense']


def get(url, tries=4):
    import time
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    data = gzip.decompress(data)
                return data
        except Exception as e:  # network hiccup or rate limit: wait and retry
            if k == tries - 1:
                raise
            time.sleep(2 * (k + 1))


def bulk_cards():
    """Scryfall's oracle-cards bulk file (one card per oracle id). Some networks block data.scryfall.io."""
    meta = json.loads(get('https://api.scryfall.com/bulk-data/oracle-cards'))
    uri = meta.get('download_uri')
    if not uri:
        raise RuntimeError('no download_uri')
    print('downloading', uri, file=sys.stderr)
    return json.loads(get(uri))


def search_cards():
    """The same list through the search API, 175 cards a page, one request every 110ms (Scryfall asks for 50-100ms+)."""
    import time
    q = 'game:paper -layout:token -layout:double_faced_token -layout:emblem -layout:art_series -layout:vanguard -layout:scheme -layout:planar -layout:augment -layout:host'
    url = 'https://api.scryfall.com/cards/search?unique=cards&order=name&q=' + urllib.parse.quote(q)
    cards, page = [], 0
    while url:
        res = json.loads(get(url))
        cards.extend(res['data'])
        url = res.get('next_page') if res.get('has_more') else None
        page += 1
        if page % 20 == 0:
            print(f'  page {page}, {len(cards)} cards', file=sys.stderr)
        time.sleep(0.11)
    return cards


def main():
    try:
        cards = bulk_cards()
        source = 'bulk oracle-cards'
    except Exception as e:
        print(f'bulk file not available here ({e}); paging through the search API instead', file=sys.stderr)
        cards = search_cards()
        source = 'search API'
    out = []
    for c in cards:
        if 'paper' not in (c.get('games') or []) or c.get('layout') in SKIP_LAYOUTS:
            continue
        s = {k: c[k] for k in KEEP if k in c}
        s['legalities'] = {k: (c.get('legalities') or {}).get(k) for k in ('modern', 'commander')}
        if c.get('card_faces'):
            s['card_faces'] = [{k: f[k] for k in FACE_KEEP if k in f} for f in c['card_faces']]
        out.append(s)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'wrote {len(out)} cards to {OUT} ({os.path.getsize(OUT) // 1_000_000} MB) from the {source}', file=sys.stderr)


if __name__ == '__main__':
    main()
