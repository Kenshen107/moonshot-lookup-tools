#!/bin/bash
# Per-deck game plan comparison (2026-11-16): seat A plays the deck with plans on, then off, on the same seeds. Usage: tests/plan_compare.sh [pods] [deck.txt ...]
N=${1:-100}; shift
DECKS=${@:-tests/decks/*.txt}
mkdir -p tests/.out
for d in $DECKS; do
  b=$(basename $d .txt)
  on=$(node tests/lab.js --n $N --conc 4 --kind commander --players 4 --seed 700 --decka $d 2>&1)
  off=$(node tests/lab.js --n $N --conc 4 --kind commander --players 4 --seed 700 --decka $d --tune plans=0 2>&1)
  pa=$(echo "$on" | grep -o "seat A [0-9]* ([0-9.]*%)" | head -1); pb=$(echo "$off" | grep -o "seat A [0-9]* ([0-9.]*%)" | head -1)
  hang=$(echo "$on" | grep -o "Hung (no result in time): [0-9]*" | head -1)
  echo "$b | plans ON: $pa | OFF: $pb | $hang" | tee -a tests/.out/plan_compare.txt
done
