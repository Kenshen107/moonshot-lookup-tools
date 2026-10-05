"""Builds the Market Watch data files for MTG_Lookup_Tool.html.

Runs once a day in GitHub Actions (.github/workflows/market-data.yml) and
publishes its output to the `market-data` branch, which the site reads
from raw.githubusercontent.com. Nothing here runs in the browser.

Inputs (all free MTGJSON downloads):
  AllPrices.json.gz          90 days of daily prices for every printing
  csv/cardIdentifiers.csv.gz MTGJSON uuid -> Scryfall id
  csv/cards.csv.gz           names, set codes, collector numbers
  csv/cardLegalities.csv.gz  each printing's legality in every format

Outputs (in --out):
  meta.json            price date, build time, the weekly dates used below
  history/<xx>.json    TCGplayer market prices per printing: 14 weekly points
                       (n/f/e = non-foil/foil/etched) and 91 daily points for
                       the last 90 days (dn/df/de), sharded by the first two
                       characters of the Scryfall id
                       Also per finish: ck<f>/mp<f> = Card Kingdom / Mana Pool
                       retail [now, 7 days ago, 30 days ago], and kb<f> = Card
                       Kingdom buylist, weekly like the TCGplayer points; plus
                       the same three as 91 daily points (ckd<f>, mpd<f>,
                       kbd<f>; None where the store wasn't listing it) for the
                       Card Lookup price chart.
  spikes.json          printings whose price jumped in the last 1-7 days,
                       with Card Kingdom / Mana Pool retail [now, 1, 3, 7 days
                       ago] for the same printing (ck, mp)
  buylist-spikes.json  printings Card Kingdom started paying more for
  bans.json            current banned/restricted cards per format, plus a
                       log of changes seen since the job started running

Price archive (--archive-out, published to the `price-archive` branch):
  Our own copy of each day's prices, so the data doesn't depend on MTGJSON
  alone. MTGJSON's AllPrices only covers a rolling 90 days and is one big
  download; the archive keeps the last ARCHIVE_DAYS days (60).
  cards.csv.gz         one row per printing: uuid (MTGJSON), scryfallId, name,
                       set, number. Rows are only ever added, so a row number
                       means the same printing in every day file.
  days/<date>.csv.gz   that day's prices: `gap` (row number in cards.csv.gz
                       minus the previous line's; the first line counts from
                       -1) then TCGplayer, Card Kingdom and Mana Pool retail
                       and Card Kingdom buylist, each as normal/foil/etched in
                       US dollars (blank = no price that day). See ARCHIVE_COLUMNS.
  README.md            the same, for anyone opening the branch.
  Each run adds the newest day (and any day in the window the archive is
  missing), drops days older than ARCHIVE_DAYS, and reads the archive back
  in to fill days MTGJSON's file is missing. If AllPrices.json.gz can't be
  downloaded, the job uses AllPricesToday.json.gz plus the archive instead.

Usage:
  python tools/build_market_data.py --out out [--previous prev] [--inputs dir]
  python tools/build_market_data.py --out out --archive-in prev-archive --archive-out archive
  --previous is last run's output (for the ban log); --inputs is a folder
  that already holds the downloads (otherwise they're fetched);
  --archive-in is the last run's price archive (missing on the first run)
  and --archive-out is where the updated archive is written.
"""

import argparse
import bisect
import csv
import datetime as dt
import gzip
import json
import os
import sys
import urllib.request

MTGJSON = "https://mtgjson.com/api/v5"
DOWNLOADS = {
    "AllPrices.json.gz": f"{MTGJSON}/AllPrices.json.gz",
    "cardIdentifiers.csv.gz": f"{MTGJSON}/csv/cardIdentifiers.csv.gz",
    "cards.csv.gz": f"{MTGJSON}/csv/cards.csv.gz",
    "cardLegalities.csv.gz": f"{MTGJSON}/csv/cardLegalities.csv.gz",
}
# Today's prices only - the fallback when AllPrices.json.gz can't be fetched.
PRICES_TODAY = ("AllPricesToday.json.gz", f"{MTGJSON}/AllPricesToday.json.gz")

WEEKS = 13            # weekly points kept per printing (about 90 days)
DAYS = 90             # plus daily points for the last 90 days (the price chart)
HISTORY_MIN_PRICE = 1.0   # skip printings that never reached $1 in the window
SPIKE_MIN_PRICE = 2.0     # spike list: current price at least this
SPIKE_MIN_JUMP = 1.0      # ...up at least this many dollars
SPIKE_MIN_PCT = 0.15      # ...and at least this much, over 1, 3 or 7 days
SPIKE_MAX = 1500
BUYLIST_SPIKE_MAX = 3000
BUYLIST_SPIKE_MIN_PRICE = 1.0   # Card Kingdom buylist increases: paying at least this now
BUYLIST_SPIKE_MIN_JUMP = 0.5    # ...up at least this much (and SPIKE_MIN_PCT)
STORE_MAX_AGE_DAYS = 2          # a store price older than this counts as "not listed"
ARCHIVE_DAYS = 60   # days kept in the price archive (owner's choice, 2026-10-05)
# (column, MTGJSON store, list, finish) for each price in an archive day file.
ARCHIVE_COLUMNS = [
    (f"{label}_{fk}", store, kind, finish)
    for label, store, kind in (("tcg", "tcgplayer", "retail"), ("ck", "cardkingdom", "retail"),
                               ("mp", "manapool", "retail"), ("ckbuy", "cardkingdom", "buylist"))
    for finish, fk in (("normal", "n"), ("foil", "f"), ("etched", "e"))
]
BAN_FORMATS = ["standard", "pioneer", "modern", "legacy", "vintage", "commander", "pauper"]


def download(url, path):
    print(f"Downloading {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "moonshot-lookup-tools market-data job"})
    tmp = path + ".part"
    with urllib.request.urlopen(req, timeout=600) as res, open(tmp, "wb") as out:
        while chunk := res.read(1 << 20):
            out.write(chunk)
    os.replace(tmp, path)


def fetch(inputs):
    """Downloads the inputs; returns the prices file to read. If the full
    90-day AllPrices can't be fetched, falls back to today's prices (the
    price archive fills in the earlier days)."""
    os.makedirs(inputs, exist_ok=True)
    prices_file = os.path.join(inputs, "AllPrices.json.gz")
    for name, url in DOWNLOADS.items():
        path = os.path.join(inputs, name)
        if os.path.exists(path):
            continue
        if name != "AllPrices.json.gz":
            download(url, path)
            continue
        try:
            download(url, path)
        except Exception as err:  # noqa: BLE001 - any failure means "use the fallback"
            print(f"Couldn't download AllPrices ({err}); using today's prices plus the archive", flush=True)
            prices_file = os.path.join(inputs, PRICES_TODAY[0])
            if not os.path.exists(prices_file):
                download(PRICES_TODAY[1], prices_file)
    return prices_file


def read_csv(path, columns):
    csv.field_size_limit(sys.maxsize)
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            yield {c: row.get(c, "") for c in columns}


def price_on_or_before(series, days, day):
    """Latest price at or before `day` (ISO date string), or None.
    `days` is the series' dates, sorted."""
    i = bisect.bisect_right(days, day)
    return series[days[i - 1]] if i else None


def recent_price(series, days, day, max_age=STORE_MAX_AGE_DAYS):
    """Like price_on_or_before, but None if the latest price is more than
    max_age days old - Card Kingdom and Mana Pool drop cards they aren't
    buying or selling, and a stale price shouldn't count as current."""
    i = bisect.bisect_right(days, day)
    if not i:
        return None
    found = days[i - 1]
    if (dt.date.fromisoformat(day) - dt.date.fromisoformat(found)).days > max_age:
        return None
    return series[found]


def store_points(series, latest, offsets):
    """[price now, price N days ago, ...] for one store, rounded, or None
    if the store has no current price."""
    if not series:
        return None
    days = sorted(series)
    pts = [recent_price(series, days, iso(latest - dt.timedelta(days=n))) for n in offsets]
    if pts[0] is None:
        return None
    return [round(p, 2) if p is not None else None for p in pts]


def iso(d):
    return d.isoformat()


def load_archive(folder):
    """The last run's price archive: (cards, days). cards is a list of
    [uuid, scryfallId, name, set, number] in row order; days maps each date
    to {uuid: {column: price}}. Empty if there's no archive yet."""
    cards, days = [], {}
    if not folder or not os.path.exists(os.path.join(folder, "cards.csv.gz")):
        return cards, days
    with gzip.open(os.path.join(folder, "cards.csv.gz"), "rt", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        cards = [row for row in reader]
    day_dir = os.path.join(folder, "days")
    for fname in sorted(os.listdir(day_dir)) if os.path.isdir(day_dir) else []:
        if not fname.endswith(".csv.gz"):
            continue
        day = fname[:-len(".csv.gz")]
        prices = days[day] = {}
        with gzip.open(os.path.join(day_dir, fname), "rt", encoding="utf-8", newline="") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            row = -1
            for line in reader:
                row += int(line[0])
                if row >= len(cards):
                    break
                prices[cards[row][0]] = {col: float(v) for col, v in zip(header[1:], line[1:]) if v}
    print(f"Archive: {len(cards)} printings, {len(days)} days", flush=True)
    return cards, days


def merge_archive(prices, days):
    """Fills in archived prices for days MTGJSON's file doesn't have
    (MTGJSON's own numbers win where both exist)."""
    by_col = {col: (store, kind, finish) for col, store, kind, finish in ARCHIVE_COLUMNS}
    data = prices["data"]
    added = 0
    for day, rows in days.items():
        for uuid, values in rows.items():
            paper = data.setdefault(uuid, {}).setdefault("paper", {})
            for col, price in values.items():
                store, kind, finish = by_col[col]
                series = paper.setdefault(store, {}).setdefault(kind, {}).setdefault(finish, {})
                if day not in series:
                    series[day] = price
                    added += 1
    print(f"Archive: filled in {added} prices MTGJSON's file didn't have", flush=True)


def write_archive(folder, prices, cards, days, info, scryfall_id, latest):
    """Writes the updated archive: today's prices (and any day in the window
    the archive is missing), minus days older than ARCHIVE_DAYS."""
    window = [iso(latest - dt.timedelta(days=i)) for i in range(ARCHIVE_DAYS - 1, -1, -1)]
    data = prices["data"]

    def snapshot(day):
        out = {}
        for uuid, entry in data.items():
            paper = entry.get("paper", {})
            values = {}
            for col, store, kind, finish in ARCHIVE_COLUMNS:
                v = paper.get(store, {}).get(kind, {}).get(finish, {}).get(day)
                if v is not None:
                    values[col] = v
            if values:
                out[uuid] = values
        return out

    kept = {}
    for day in window:
        # Always rebuild the newest day (a later run can have more of it),
        # and fill any day the archive is missing from MTGJSON's history.
        if day == window[-1] or day not in days:
            snap = snapshot(day)
            if snap:
                kept[day] = snap
                continue
        if day in days:
            kept[day] = days[day]

    # Rows are only ever added, so old day files keep pointing at the same
    # printings. Name, set and number are refreshed from today's files.
    row_of = {c[0]: i for i, c in enumerate(cards)}
    for snap in kept.values():
        for uuid in snap:
            if uuid not in row_of:
                row_of[uuid] = len(cards)
                cards.append([uuid, "", "", "", ""])
    for c in cards:
        if c[0] in info:
            name, set_code, number = info[c[0]]
            c[1:] = [scryfall_id.get(c[0], c[1]), name, set_code, number]

    os.makedirs(os.path.join(folder, "days"), exist_ok=True)
    with gzip.open(os.path.join(folder, "cards.csv.gz"), "wt", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["uuid", "scryfallId", "name", "set", "number"])
        w.writerows(cards)
    cols = [c[0] for c in ARCHIVE_COLUMNS]
    for day, snap in kept.items():
        rows = sorted((row_of[u], v) for u, v in snap.items())
        with gzip.open(os.path.join(folder, "days", f"{day}.csv.gz"), "wt", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["gap", *cols])
            prev = -1
            for row, values in rows:
                w.writerow([row - prev, *(f"{values[c]:.2f}" if c in values else "" for c in cols)])
                prev = row
    with open(os.path.join(folder, "README.md"), "w", encoding="utf-8") as f:
        f.write(ARCHIVE_README.format(days=ARCHIVE_DAYS, first=min(kept), last=max(kept), count=len(kept),
                                      columns=", ".join(cols)))
    print(f"Archive: wrote {len(kept)} days ({min(kept)} to {max(kept)}), {len(cards)} printings", flush=True)


ARCHIVE_README = """# Moonshot price archive

Daily card prices for every Magic printing MTGJSON prices, kept for the last
{days} days ({count} days here: {first} to {last}). Built by
`tools/build_market_data.py` on the `main` branch, which replaces this branch
(one commit, no history) every run, so it never grows past {days} days.

Prices come from MTGJSON (TCGplayer market, Card Kingdom and Mana Pool retail,
Card Kingdom buylist), in US dollars.

- `cards.csv.gz`: one row per printing (uuid, scryfallId, name, set, number).
  Rows are only ever added, so row N is the same printing in every day file.
- `days/<date>.csv.gz`: that day's prices. The first column, `gap`, is this
  line's row number in `cards.csv.gz` minus the previous line's (the first
  line counts from -1); the rest are {columns}
  (n/f/e = normal/foil/etched; blank = no price that day).

Reading it in Python:

```python
import csv, gzip
cards = list(csv.reader(gzip.open("cards.csv.gz", "rt")))[1:]
rows = csv.reader(gzip.open("days/{last}.csv.gz", "rt"))
header, row = next(rows), -1
for line in rows:
    row += int(line[0])
    print(cards[row][2], dict((k, v) for k, v in zip(header[1:], line[1:]) if v))
```
"""


def build(inputs, out, previous, prices_file=None, archive_in="", archive_out=""):
    print("Reading identifiers and names", flush=True)
    scryfall_id = {r["uuid"]: r["scryfallId"] for r in read_csv(os.path.join(inputs, "cardIdentifiers.csv.gz"), ["uuid", "scryfallId"])}
    info = {}
    promo = set()
    for r in read_csv(os.path.join(inputs, "cards.csv.gz"), ["uuid", "name", "setCode", "number", "isPromo"]):
        info[r["uuid"]] = (r["name"], r["setCode"], r["number"])
        if r["isPromo"] in ("True", "true", "1"):
            promo.add(r["uuid"])

    print("Reading prices", flush=True)
    with gzip.open(prices_file or os.path.join(inputs, "AllPrices.json.gz"), "rt", encoding="utf-8") as f:
        prices = json.load(f)
    fallback = os.path.basename(prices_file or "") == PRICES_TODAY[0]
    archive_cards, archive_days = load_archive(archive_in)
    merge_archive(prices, archive_days)
    price_date = prices["meta"]["date"]
    latest = dt.date.fromisoformat(price_date)
    week_dates = [iso(latest - dt.timedelta(days=7 * i)) for i in range(WEEKS, -1, -1)]  # oldest -> newest
    day_dates = [iso(latest - dt.timedelta(days=i)) for i in range(DAYS, -1, -1)]

    history = {}  # scryfall id -> {"n": [...], "f": [...], ...} (see the file docstring)
    spikes = []
    buylist_spikes = []
    finishes = (("normal", "n"), ("foil", "f"), ("etched", "e"))
    for uuid, entry in prices["data"].items():
        sid = scryfall_id.get(uuid)
        if not sid:
            continue
        paper = entry.get("paper", {})
        retail = paper.get("tcgplayer", {}).get("retail", {})
        ck_retail = paper.get("cardkingdom", {}).get("retail", {})
        ck_buylist = paper.get("cardkingdom", {}).get("buylist", {})
        mp_retail = paper.get("manapool", {}).get("retail", {})
        name, set_code, number = info.get(uuid, ("", "", ""))
        for finish, key in finishes:
            series = retail.get(finish)
            now = series.get(price_date) if series else None
            if now is not None:
                days = sorted(series)
                if max(series.values()) >= HISTORY_MIN_PRICE:
                    points = [price_on_or_before(series, days, d) for d in week_dates]
                    points = [round(p, 2) if p is not None else None for p in points]
                    slot = history.setdefault(sid, {})
                    slot.setdefault(key, points)
                    daily = [price_on_or_before(series, days, d) for d in day_dates]
                    slot.setdefault("d" + key, [round(p, 2) if p is not None else None for p in daily])
                    # Other stores: Card Kingdom and Mana Pool retail as
                    # [now, 7 days ago, 30 days ago]; Card Kingdom's buylist
                    # as weekly points like the TCGplayer ones.
                    for store, store_series in (("ck", ck_retail.get(finish)), ("mp", mp_retail.get(finish))):
                        pts = store_points(store_series, latest, (0, 7, 30))
                        if pts:
                            slot.setdefault(store + key, pts)
                    buy = ck_buylist.get(finish)
                    if buy:
                        buy_days = sorted(buy)
                        weekly = [recent_price(buy, buy_days, d) for d in week_dates]
                        if any(v is not None for v in weekly):
                            slot.setdefault("kb" + key, [round(v, 2) if v is not None else None for v in weekly])
                    # Daily store prices for the chart (a price more than
                    # STORE_MAX_AGE_DAYS old counts as not listed).
                    for store, store_series in (("ckd", ck_retail.get(finish)), ("mpd", mp_retail.get(finish)), ("kbd", buy)):
                        if not store_series:
                            continue
                        store_days = sorted(store_series)
                        daily = [recent_price(store_series, store_days, d) for d in day_dates]
                        if any(v is not None for v in daily):
                            slot.setdefault(store + key, [round(v, 2) if v is not None else None for v in daily])

                if now >= SPIKE_MIN_PRICE:
                    ago = {n: price_on_or_before(series, days, iso(latest - dt.timedelta(days=n))) for n in (1, 3, 7)}
                    best = None
                    for n, then in ago.items():
                        if then and now - then >= SPIKE_MIN_JUMP and (now - then) / then >= SPIKE_MIN_PCT:
                            best = max(best or 0, now - then)
                    if best is not None:
                        spike = {
                            "id": sid, "name": name, "set": set_code, "number": number, "finish": finish,
                            "promo": uuid in promo,
                            "now": round(now, 2),
                            **{f"d{n}": (round(p, 2) if p is not None else None) for n, p in ago.items()},
                        }
                        # The same printing at the other stores, [now, 1, 3,
                        # 7 days ago], so the page can tell a real move from
                        # one odd sale at one store.
                        for store, store_series in (("ck", ck_retail.get(finish)), ("mp", mp_retail.get(finish))):
                            pts = store_points(store_series, latest, (0, 1, 3, 7))
                            if pts:
                                spike[store] = pts
                        spikes.append(spike)

            # Card Kingdom paying more for a card is a strong demand signal.
            buy = ck_buylist.get(finish)
            if buy:
                buy_days = sorted(buy)
                buy_now = recent_price(buy, buy_days, price_date)
                if buy_now is not None and buy_now >= BUYLIST_SPIKE_MIN_PRICE:
                    ago = {n: recent_price(buy, buy_days, iso(latest - dt.timedelta(days=n))) for n in (1, 3, 7)}
                    rose = any(then and buy_now - then >= BUYLIST_SPIKE_MIN_JUMP and (buy_now - then) / then >= SPIKE_MIN_PCT for then in ago.values())
                    # Card Kingdom's buylist often dips and comes back; only
                    # count it if they're paying more than a week ago.
                    week_ago = ago[7] if ago[7] is not None else ago[3]
                    if rose and (week_ago is None or buy_now > week_ago):
                        buylist_spikes.append({
                            "id": sid, "name": name, "set": set_code, "number": number, "finish": finish,
                            "promo": uuid in promo,
                            "now": round(buy_now, 2),
                            **{f"d{n}": (round(p, 2) if p is not None else None) for n, p in ago.items()},
                            "retail": round(now, 2) if now is not None else None,
                        })
    # MTGJSON sometimes has separate foil and non-foil uuids for one
    # Scryfall printing - keep one entry per printing and finish.
    def dedupe_and_sort(rows, cap=SPIKE_MAX):
        seen = set()
        rows = [r for r in rows if not ((r["id"], r["finish"]) in seen or seen.add((r["id"], r["finish"])))]
        rows.sort(key=lambda r: -max((r["now"] - (r[k] or r["now"])) for k in ("d1", "d3", "d7")))
        return rows[:cap]
    spikes = dedupe_and_sort(spikes)
    buylist_spikes = dedupe_and_sort(buylist_spikes, BUYLIST_SPIKE_MAX)

    print("Reading legalities", flush=True)
    status = {f: {} for f in BAN_FORMATS}  # format -> name -> Banned/Restricted/Legal
    for r in read_csv(os.path.join(inputs, "cardLegalities.csv.gz"), ["uuid", *BAN_FORMATS]):
        name = info.get(r["uuid"], ("",))[0]
        if not name:
            continue
        for fmt in BAN_FORMATS:
            value = r[fmt]
            if value and status[fmt].get(name) not in ("Banned", "Restricted"):
                status[fmt][name] = value
    current = {fmt: {n: v for n, v in names.items() if v in ("Banned", "Restricted")} for fmt, names in status.items()}

    log = []
    prev = {}
    prev_path = os.path.join(previous, "bans.json") if previous else None
    if prev_path and os.path.exists(prev_path):
        with open(prev_path, encoding="utf-8") as f:
            prev = json.load(f)
        log = prev.get("log", [])
        before = prev.get("current", {})
        for fmt in BAN_FORMATS:
            old, new = before.get(fmt, {}), current[fmt]
            for name, value in new.items():
                if old.get(name) != value:
                    log.append({"date": price_date, "format": fmt, "card": name,
                                "change": "banned" if value == "Banned" else "restricted",
                                "was": old.get(name, "Legal")})
            for name, value in old.items():
                # Only a real unban: the card is still in the format, now Legal.
                # (Rotating out of Standard also drops it from the banned list.)
                if name not in new and status[fmt].get(name) == "Legal":
                    log.append({"date": price_date, "format": fmt, "card": name,
                                "change": "unbanned" if value == "Banned" else "unrestricted", "was": value})
    log = log[-500:]

    print("Writing output", flush=True)
    os.makedirs(os.path.join(out, "history"), exist_ok=True)
    shards = {}
    for sid, series in history.items():
        shards.setdefault(sid[:2], {})[sid] = series
    for key, shard in shards.items():
        with open(os.path.join(out, "history", f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(shard, f, separators=(",", ":"))
    with open(os.path.join(out, "spikes.json"), "w", encoding="utf-8") as f:
        json.dump({"date": price_date, "spikes": spikes}, f, separators=(",", ":"))
    with open(os.path.join(out, "buylist-spikes.json"), "w", encoding="utf-8") as f:
        json.dump({"date": price_date, "spikes": buylist_spikes}, f, separators=(",", ":"))
    with open(os.path.join(out, "bans.json"), "w", encoding="utf-8") as f:
        json.dump({"date": price_date, "since": prev.get("since") or price_date,
                   "current": current, "log": log}, f, separators=(",", ":"))
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
        json.dump({"priceDate": price_date, "built": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
                   "weeks": week_dates, "days": day_dates, "printings": len(history), "spikes": len(spikes), "buylistSpikes": len(buylist_spikes),
                   "source": "MTGJSON (TCGplayer market prices)" + (" - today's file plus the price archive" if fallback else "")}, f, separators=(",", ":"))
    if archive_out:
        write_archive(archive_out, prices, archive_cards, archive_days, info, scryfall_id, latest)
    print(f"Done: {len(history)} printings with history, {len(spikes)} spikes, {len(buylist_spikes)} buylist increases, {len(log)} ban log entries", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--previous", default="")
    parser.add_argument("--inputs", default="mtgjson-downloads")
    parser.add_argument("--archive-in", default="")
    parser.add_argument("--archive-out", default="")
    args = parser.parse_args()
    prices_file = fetch(args.inputs)
    build(args.inputs, args.out, args.previous, prices_file, args.archive_in, args.archive_out)


if __name__ == "__main__":
    main()
