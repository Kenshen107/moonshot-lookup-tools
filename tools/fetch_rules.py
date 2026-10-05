"""Keeps a copy of Magic's Comprehensive Rules for Spellslinger Duels.

Runs in GitHub Actions (.github/workflows/rules.yml) every Monday. It
reads Wizards' rules page (magic.wizards.com/en/rules), downloads the
current plain-text Comprehensive Rules it links to, and writes:

  rules/MagicCompRules.txt  the official text, unchanged apart from line
                            endings (UTF-8, LF)
  rules/cr.json             the same rules split for the game to look up:
                            { effective, source, fetched,
                              sections: {"405": "Stack", ...},
                              rules: {"405.1": "...", "702.19b": "...", ...},
                              glossary: {"Trample": "...", ...} }

Nothing is written when the text hasn't changed, so the repo only gets a
new commit when Wizards publishes an update (a few times a year).
The Comprehensive Rules are Wizards of the Coast's; they publish them for
anyone to download, and the copy keeps their own wording and notices.
"""

import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request

PAGE = "https://magic.wizards.com/en/rules"
OUT = "rules"
UA = {"User-Agent": "Mozilla/5.0 (compatible; Spellslinger-Duels rules copy; GitHub Actions)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


def decode(raw):
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def parse(text):
    lines = text.split("\n")
    sections, rules, glossary = {}, {}, {}
    # The rules proper start at the second "1. Game Concepts" (the first is
    # the contents list) and end at the second "Glossary".
    starts = [i for i, l in enumerate(lines) if l.strip() == "1. Game Concepts"]
    gloss = [i for i, l in enumerate(lines) if l.strip() == "Glossary"]
    credits = [i for i, l in enumerate(lines) if l.strip() == "Credits"]
    body_start = starts[1] if len(starts) > 1 else 0
    body_end = gloss[1] if len(gloss) > 1 else len(lines)
    current = None
    for line in lines[body_start:body_end]:
        s = line.strip()
        if not s:
            current = None
            continue
        m = re.match(r"^(\d{3})\. (.+)$", s)
        if m:
            sections[m.group(1)] = m.group(2)
            current = None
            continue
        m = re.match(r"^(\d{3}\.\d+[a-z]?)\.? (.+)$", s)
        if m:
            current = m.group(1)
            rules[current] = m.group(2)
            continue
        if current:  # examples and continued text belong to the rule above
            rules[current] += "\n" + s
    if len(gloss) > 1:
        end = credits[-1] if credits and credits[-1] > gloss[1] else len(lines)
        block = "\n".join(lines[gloss[1] + 1:end]).strip()
        for entry in re.split(r"\n\s*\n", block):
            parts = entry.strip().split("\n")
            if len(parts) >= 2:
                glossary[parts[0].strip()] = "\n".join(p.strip() for p in parts[1:])
    return sections, rules, glossary


def main():
    page = get(PAGE).decode("utf-8", "replace")
    links = re.findall(r"https://media\.wizards\.com/[^\"'<>]*?MagicCompRules[^\"'<>]*?\.txt", page)
    if not links:
        sys.exit("No Comprehensive Rules .txt link found on " + PAGE)
    url = links[0].replace(" ", "%20")
    text = decode(get(url)).replace("\r\n", "\n").replace("\r", "\n")
    if "Comprehensive Rules" not in text[:2000]:
        sys.exit("The download doesn't look like the Comprehensive Rules")
    os.makedirs(OUT, exist_ok=True)
    txt_path = os.path.join(OUT, "MagicCompRules.txt")
    if os.path.exists(txt_path):
        with open(txt_path, encoding="utf-8") as f:
            if f.read() == text:
                print("Comprehensive Rules unchanged")
                return
    m = re.search(r"These rules are effective as of ([A-Z][a-z]+ \d{1,2}, \d{4})", text)
    sections, rules, glossary = parse(text)
    if len(rules) < 1000:
        sys.exit(f"Only parsed {len(rules)} rules - the format may have changed")
    with open(txt_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    with open(os.path.join(OUT, "cr.json"), "w", encoding="utf-8") as f:
        json.dump({
            "effective": m.group(1) if m else None,
            "source": urllib.parse.unquote(url),
            "fetched": dt.date.today().isoformat(),
            "sections": sections, "rules": rules, "glossary": glossary,
        }, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Saved the Comprehensive Rules effective {m.group(1) if m else '?'}: {len(rules)} rules, {len(glossary)} glossary entries")


if __name__ == "__main__":
    main()
