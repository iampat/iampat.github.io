# Episode 3 concept: "The Player Who Gives Boxes Away"

Director's brief. Same series, same floodlit pitch, same voice (Charon), same kit where it fits.
Target 6:00–6:45, about 860 words. Working title alternatives: "Thank You, You Go First",
"Chalk Draws Dots".

## Voice rules for this episode

- The narrator is an older friend at the side of the pitch. Never a teacher.
- Never say: learn, lesson, educational, kids, age, school, teach, homework, "for ages".
- The game is never explained as a game "for children". It is "the game everyone knows and
  nobody knows".
- Tavi is "you". Chalk never speaks. One eyebrow does all his talking.
- Short sentences (lint: max 16 words). 4–6 learn-words, each on a word card.
- Only numbers that have a fact behind them (`research/ep3/RESULTS.md`).

## The big idea

Dots and Boxes looks like a game of grabbing. It is a game of **giving**. Whoever has to
make the first gift loses the endgame, and the whole middle of the game is a fight about
who runs out of safe moves first. Three skills, one per chapter:

1. **THE THIRD SIDE.** A box with three sides is a gift. Early on, nobody gives, so the board
   fills with "safe" lines. Then the safe lines run out, and every move is a gift. The game
   has two halves: the quiet half and the giving half.
2. **ALL BUT TWO.** When the other player is forced to open a chain, don't eat it all. Eat all
   but two, and leave the last two boxes as one "double-cross" gift. They get two boxes. Then
   they have to open the next chain for you. Give two, take the rest. Keep control.
3. **COUNT THE COUNTDOWN.** The safe lines are a countdown. Whoever draws the last safe line
   makes the other player open the first chain. Count them before they run out. Odd is good
   for the player who is about to move; even is bad. If the count is wrong, change it: give
   one box early on purpose.

Bonus teaser: **the one-sentence rule**. Champions count before the first line is drawn:
"dots plus long chains, even for the player who went first" (Berlekamp's long chain rule).
Chalk knows it. "That's for another night."

## The motif: the give-meter

A small chalk ledger in the corner of the board: boxes **given** and boxes **taken**, with a
line drawn through "given" each time a gift is made on purpose. Rhymes with the time bubble in
episode 2 (an honest scoreboard), but it counts gifts, not seconds. In the cold open Tavi gives
nothing until she has to, and gives everything. In the ending she gives two, twice, and wins.

A second recurring image: the board drawn as **two halves** on a timeline bar. Quiet half
(green, safe lines) and giving half (orange). The bar is drawn under every sample game.

## Story

Night three. Nine o'clock, floodlights on, but Tavi sits on the bench with her left boot off
and an ice pack on the ankle. No football tonight. Chalk peels off the goal line, walks over,
and sits down on the concrete beside her. He drags one finger across the ground: a dot. Then
sixteen dots in a square. He hands her a piece of himself to draw with.

**Cold open (about 60 s).** "You know this game. Everyone knows this game. Nobody knows this
game." Tavi plays like everyone: she grabs every box the moment it has three sides. Score 3–0,
she grins. Then Chalk draws one line, and the rest falls to him: 3–6. He didn't even look at
the board for the last four. One eyebrow. "You were winning three–nil. You took every box you
could. How does three–nil turn into three–six?" Title.

**Ch1 The third side (about 75 s).** Replay of the opening at half speed. The first moves are
quiet: no box gets a third side. Count the safe lines as they vanish; the bar fills green.
Then the moment: no safe line left. Every box on the board is part of a chain. Word card:
**chain**. Whoever moves now has to give. "The game isn't two players grabbing. It's two
players refusing to give, until one of them can't." Cue, mistake (drawing a third side while
safe lines still exist), fix, drill.

**Ch2 All but two (about 90 s).** Chalk opened nothing in the cold open; Tavi did. Watch what
Chalk did with her gift: he took the chain, all but two. Side by side: "eat it all" versus
"all but two" on the same endgame. Eat it all: take 3, hand over 4. All but two: take 1,
give 2, take 4. Word cards: **double-cross** (the two-box gift), **control** (you are the one
who keeps getting the chains opened for you). The rule has one exception, said plainly: on the
last chain, eat it all. Cue, mistake (greed), fix, drill.

**Ch3 Count the countdown (about 90 s).** Back to the quiet half. The safe lines are a
countdown, and you can count them. Five left and it's your move: you draw the last one, Chalk
must give. Four left: Chalk draws the last one, you must give. So when the count is wrong, give
one box early, on purpose, and the count flips. Word card: **safe line** (a line that gives no
box a third side). Show Chalk doing exactly this in the cold open: a tiny early gift nobody
noticed. "That was the whole game. One box, given at the right time." Cue, mistake (counting
too late), fix, drill.

**Bonus teaser (about 25 s).** The one-sentence rule, written in chalk, not explained. The long
chain rule. "Chalk reads the board that way before you've drawn a line."

**Ending (about 60 s).** The first game again, same first line by Chalk. Tavi counts, gives one
early, then eats all but two, twice. 6–3 to Tavi. Chalk's eyebrow goes up and stays up. Then
the computer fact, on a chalk board of 16 dots: "A computer has played every possible game on
this board. Every single one. Whoever moves second wins, six–three, if they never slip. Any
first line." Beat. "On the bigger board, five by five dots, perfect play is a tie. Nobody has
finished the next board. Nobody." Ankle better. Lights out. Last line: "Next time someone says
'you go first': smile. Say thank you."

## Sample gameplays to build (from the solver)

All on the 3×3-box board (16 dots), extra-turn rule, generated and checked by
`research/ep3/solve.c` so every line drawn on screen is a real game.

| Game | Where | What it shows |
|---|---|---|
| G1 greedy loss | cold open, Ch1 replay | Tavi grabs every third side; 3–0 becomes 3–6 |
| G2 the quiet half | Ch1 | Time-lapse of safe lines filling; board becomes all chains |
| G3 eat-all vs all-but-two | Ch2 | Same endgame, two outcomes, side by side |
| G4 the countdown | Ch3 | Counting safe lines, the early one-box gift that flips the count |
| G5 the win | ending | Same first line as G1; Tavi plays second and wins 6–3 |

Drills (one per chapter, with a friend or a parent, on paper):
- Ch1: play one game saying "safe" or "gift" out loud before every line.
- Ch2: set up a board with two chains of 3 and 4. Take turns opening; practise all but two.
- Ch3: pause when about six safe lines are left; both players count; compare.

## Learn-words (4–6)

chain, double-cross, control, safe line. Candidates if a fifth is needed: "the quiet half".
No "parity", "zugzwang", "game theory", "Nimstring", "minimax" in narration.

## Facts to carry (see research/ep3/RESULTS.md)

- 3×3 boxes: second player wins 6–3 with perfect play, any first line (computed, cross-checked).
- 4×4 boxes: tie with perfect play (Wilson). 4×5: tie (Barker & Korf 2012). 5×5: unsolved.
  These need the fact-check pass before they are spoken.
- Lines on the board: 24 (3×3), 40 (4×4), 84 (6×6). 3×3 has about 16.7 million positions.
- Origin: Édouard Lucas, 1889 (to fact-check). Berlekamp's long chain rule (to fact-check wording).

## Rules that carry over

- Code-drawn SVG, flat shapes, no outlines. Charon. Lyria, same key family. Kurzgesagt pacing.
- Every chapter ends with cue, classic mistake, fix and a drill.
- Chalk never speaks. He is the problem-setter; this time he is also the one who gives.

## Turn mode

The video uses the classic extra-turn rule only. The app's "one turn each" mode is a different
game (Ch2 does not apply there). Solver result for that mode: second player also wins 6–3 on 3×3.

## New kit needs (for later, not this step)

- A dots-and-boxes board component driven by the app's `h`/`v`/`box` arrays, drawn in chalk
  on dark concrete, lines "handwritten" with a trim path.
- Chalk sitting and drawing (new poses), Tavi on the bench with a boot off.
- The give-meter ledger and the two-halves bar.
- A move-list player that replays a solver game at a chosen speed, keyed to narration cues.
