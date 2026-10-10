# Moonshot price archive

Daily card prices for every Magic printing MTGJSON prices, kept for the last
60 days (59 days here: 2026-08-12 to 2026-10-10). Built by
`tools/build_market_data.py` on the `main` branch, which replaces this branch
(one commit, no history) every run, so it never grows past 60 days.

Prices come from MTGJSON (TCGplayer market, Card Kingdom and Mana Pool retail,
Card Kingdom buylist), in US dollars.

- `cards.csv.gz`: one row per printing (uuid, scryfallId, name, set, number).
  Rows are only ever added, so row N is the same printing in every day file.
- `days/<date>.csv.gz`: that day's prices. The first column, `gap`, is this
  line's row number in `cards.csv.gz` minus the previous line's (the first
  line counts from -1); the rest are tcg_n, tcg_f, tcg_e, ck_n, ck_f, ck_e, mp_n, mp_f, mp_e, ckbuy_n, ckbuy_f, ckbuy_e
  (n/f/e = normal/foil/etched; blank = no price that day).

Reading it in Python:

```python
import csv, gzip
cards = list(csv.reader(gzip.open("cards.csv.gz", "rt")))[1:]
rows = csv.reader(gzip.open("days/2026-10-10.csv.gz", "rt"))
header, row = next(rows), -1
for line in rows:
    row += int(line[0])
    print(cards[row][2], dict((k, v) for k, v in zip(header[1:], line[1:]) if v))
```
