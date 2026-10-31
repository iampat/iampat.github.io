# Dots and Boxes: brute-force results (episode 3 research)

`solve.c` enumerates every position of an N×N-box game (bitmask of drawn lines,
negamax, value = future box differential for the player to move).
Build: `gcc -O2 -o solve solve.c && ./solve 0` (extra turn) / `./solve 1` (one turn each).
Change `#define N`. N=3 runs in about 10 s; N=4 (2^40 positions) is out of reach for this tool.

Cross-checked against an independent Python implementation for N=1 and N=2.

| Boxes | Lines | Extra-turn rule | One-turn-each rule |
|---|---|---|---|
| 1×1 | 4 | second player wins 1–0 | second player wins 1–0 |
| 2×2 | 12 | first player wins 3–1 | second player wins 3–1 |
| 3×3 | 24 | **second player wins 6–3**, whatever the first line is | second player wins 6–3, whatever the first line is |
| 4×4 | 40 | tie 8–8 (literature: D. Wilson's solver; to fact-check) | unknown |

Still to fact-check for the script: 4×4 tie (Wilson), 4×5 tie (Barker & Korf, 2012),
the game's origin (Édouard Lucas, 1889, "La Pipopipette"), Berlekamp's long chain rule.
