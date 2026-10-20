import json, urllib.request, urllib.parse, time, sys
T = {
 "group-hug": "otag:group-hug",
 "politics": "(o:vote or o:\"the monarch\" or keyword:goad or otag:voting or otag:donate)",
 "donate": "(otag:donate or o:\"target opponent gains control\")",
 "infect": "(keyword:infect or keyword:proliferate or o:\"poison counter\")",
 "toxic": "(keyword:toxic or o:\"poison counter\" or keyword:proliferate)",
 "proliferate": "(keyword:proliferate or otag:counters-matter)",
 "tokens": "(o:\"creature token\" or o:\"populate\")",
 "aristocrats": "(otag:sacrifice-outlet or otag:death-trigger)",
 "lifegain": "(otag:lifegain or o:\"whenever you gain life\")",
 "mill": "(otag:mill -otag:self-mill)",
 "reanimator": "(otag:reanimate or otag:self-mill)",
 "spellslinger": "(o:\"whenever you cast an instant or sorcery\" or otag:cantrip or o:\"magecraft\")",
 "artifacts": "otag:artifact-matters",
 "enchantress": "(otag:enchantress or t:aura or o:\"whenever an enchantment\")",
 "voltron": "(t:equipment or t:aura)",
 "landfall": "otag:landfall",
 "blink": "otag:blink",
 "clones": "otag:clone",
 "chaos": "(otag:wheel or otag:coin-flip or o:\"at random\")",
 "pillowfort": "otag:pillowfort",
 "stax": "(otag:tax or otag:rule-of-law or otag:mass-land-denial)",
 "extra": "(otag:extra-turn or otag:extra-combat)",
 "treasure": "o:\"create a Treasure\"",
 "burn": "(otag:burn o:\"each opponent\")",
 "discard": "(otag:discard o:\"each opponent\")",
 "wipes": "otag:board-wipe",
 "counterspells": "(t:instant o:\"counter target\")",
 "ramp": "(otag:ramp or o:\"search your library for a basic land\")",
 "draw": "(o:\"whenever an opponent draws\" or o:\"each player draws\" or o:\"draws a card\")",
 "monarch": "o:\"the monarch\"",
 "goad": "keyword:goad",
 "voting": "o:vote",
 "dragons": "t:dragon", "goblins": "t:goblin", "elves": "t:elf", "zombies": "t:zombie", "vampires": "t:vampire", "angels": "t:angel",
 "wizards": "t:wizard", "merfolk": "t:merfolk", "slivers": "t:sliver", "spirits": "t:spirit", "dinosaurs": "t:dinosaur", "humans": "t:human", "cats": "t:cat", "beasts": "t:beast", "knights":"t:knight", "rogues":"t:rogue", "soldiers":"t:soldier", "pirates":"t:pirate", "demons":"t:demon", "elementals":"t:elemental", "eldrazi":"t:eldrazi", "artifact-creatures":"(t:artifact t:creature)",
}
only = sys.argv[1:]  # python3 tests/theme_names.py [theme ...] (run from the repo root; about 3 minutes for all)
out = {}
for k, q in T.items():
    if only and k not in only: continue
    names = []
    for page in (1, 2, 3):
        url = "https://api.scryfall.com/cards/search?q=" + urllib.parse.quote(f"f:commander game:paper -is:funny -is:commander {q}") + "&order=edhrec&page=%d" % page
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "spellslinger-audit/1.0", "Accept": "application/json"}), timeout=30))
        except Exception as e:
            break
        names += [c["name"] for c in d["data"]]
        if not d.get("has_more"): break
        time.sleep(0.12)
    out[k] = names
    print(k, len(names), flush=True)
import os
os.makedirs("tests/.out", exist_ok=True); os.makedirs("tests/data", exist_ok=True)
json.dump(out, open("tests/.out/theme_names.json", "w"))
# tests/data/theme_names.json: the same lists under the game's theme keys (spellslinger/04f-deck-themes.js), the top 260 names each; the lab builds themed decks from it
TRIBES = {"dragons": "dragon", "goblins": "goblin", "elves": "elf", "zombies": "zombie", "vampires": "vampire", "angels": "angel", "wizards": "wizard", "merfolk": "merfolk", "slivers": "sliver", "spirits": "spirit", "dinosaurs": "dinosaur", "humans": "human", "cats": "cat", "beasts": "beast", "knights": "knight", "rogues": "rogue", "soldiers": "soldier", "pirates": "pirate", "demons": "demon", "elementals": "elemental", "eldrazi": "eldrazi"}
KEEP = ["group-hug", "politics", "infect", "toxic", "proliferate", "tokens", "aristocrats", "lifegain", "mill", "reanimator", "spellslinger", "artifacts", "enchantress", "voltron", "landfall", "blink", "clones", "chaos", "pillowfort", "stax", "extra", "treasure", "burn", "discard", "wipes", "counterspells", "ramp"]
data = {k: v[:260] for k, v in out.items() if k in KEEP}
data.update({"tribe-" + TRIBES[k]: v[:260] for k, v in out.items() if k in TRIBES})
json.dump(data, open("tests/data/theme_names.json", "w"), separators=(",", ":"))
