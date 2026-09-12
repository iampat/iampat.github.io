# Math Quest: Grade 6 Academy — v2

A math practice game for a Grade 6 kid (~11), covering fractions and the area of 2D
shapes. One self-contained file, no libraries, no assets, no build step — it works
offline, from a USB stick, on a school laptop or a phone.

**Play it:** https://iampat.github.io/apps/math-quest-grade6-v2.html
**File:** `apps/math-quest-grade6-v2.html`

## How it plays

- A question appears with a diagram and four tappable answers. Tap one (or press 1–4).
- The first time a new concept comes up, its illustrated lesson opens automatically.
  "📖 Teach me this!" reopens it any time; ⬅️/➡️ or arrow keys step through it.
- Correct → happy sound, XP, streak grows. Every 3rd in a row gets confetti and a fanfare.
- Wrong → the fart noise (sometimes with a bonus boing/honk on top), the right answer
  lights up green with a ✅, and a plain-language explanation appears. Only the streak
  resets.
- The next question loads on its own. "⏭️ New question" skips without penalty.
- **Every 5 questions answered — right or wrong — a prize unlocks:** pick 🐍 Snake or
  ⚽ Penalty Kicks. Both are short by design (Snake is a 45-second round; Penalty Kicks
  is 5 shots against a goalie who remembers your favourite corner), keep a session high
  score, and always show "Back to the quest". Progress dots under the buttons count
  down to the next prize.
- Three tabs: 🎲 Mixed, 🍫 Fractions, 📐 Shapes. No difficulty settings — just play.
- 🔊 mutes everything. All sound is synthesized (WebAudio) and deliberately mild so it
  won't take over a room.

## The question bank (data-driven)

All questions live in `QUESTION_BANK` inside the HTML file — an array of pure-JSON
templates. A generic engine samples parameters, evaluates formulas with a tiny built-in
expression parser (no `eval`), renders the text, answers, explanation, and the diagram.
**Adding a question type means adding a JSON entry — no new code** unless it needs a
brand-new kind of picture ("What fraction of the pizza is shaded?" was added exactly
this way, reusing the pizza renderer).

A template looks like:

```json
{
  "id": "tri", "topic": "shapes", "lesson": "tri", "unit": "cm²",
  "params":  { "b": { "range": { "1": [4,8], "2": [4,12], "3": [6,20] } },
               "h": { "range": { "1": [3,6], "2": [3,9], "3": [4,12] } } },
  "derive":  { "area": "b * h / 2" },
  "require": ["(b * h) % 2 == 0"],
  "text":    "What is the area of this triangle?",
  "diagram": { "type": "triangle", "base": "b", "height": "h" },
  "answer":  { "number": "area" },
  "distractors": [ { "number": "b * h" }, { "number": "2 * (b + h)" } ],
  "explain": "base × height ÷ 2 = {b} × {h} ÷ 2 = {area} cm²."
}
```

Note the difference between the two parameter kinds: `range: [4, 12]` samples any
integer from 4 to 12, while `pick: [4, 12]` chooses one element of the list — only
4 or 12.

- **params** — random values; per-tier lists/ranges make difficulty data-driven
- **derive / require** — computed values and constraints (rejection sampling; a
  template whose constraints can't be met degrades with a console warning, it
  never crashes the quiz)
- **answer / distractors** — `{fraction: [num, den]}` or `{number: expr}`; `raw: true`
  shows a fraction exactly as computed, `when:` makes a wrong answer conditional.
  The engine guarantees all four options differ in **value**; the one exception is a
  distractor marked `twin: true`, which may equal the correct answer (the deliberate
  "forgot simplest form" choice, shown in a different form)
- **filler** — optional template-specific backup wrong answer (evaluated with `fi` =
  attempt number) used when distractors collide, so backups stay plausible per type
- **family** — optional grouping; two types in one family (fracAdd/fracSub) never
  appear back-to-back
- **diagram** — references one of the visual builders: `fracBars`, `pizzas`,
  `pizzaShare`, `triangle`, `parallelogram`, `house`
- **text/explain tokens** — `{expr}`, `{stack:n:d}` stacked fraction shown as-is,
  `{mixtext:n:d}` plain words, always simplified; `explain` segments can carry `when:`

Expressions support `+ - * / % ( )`, comparisons, `|| &&`, and `gcd/max/abs`.

## Question types and their distractors

Wrong choices are modelled on real kid mistakes, not random numbers:

| Type | Wrong answers look like |
|---|---|
| Add / subtract unlike denominators | added tops and bottoms; forgot simplest form; did the other operation; small numerator slip |
| What fraction is shaded | counted the unshaded pieces; flipped the fraction; miscounted the pieces |
| Whole × fraction | multiplied top *and* bottom; glued the numbers together (k + a/b); off-by-one |
| Fraction ÷ whole | multiplied instead; forgot to divide; added to the denominator |
| Triangle area | forgot to halve; perimeter instead of area; added the sides |
| Parallelogram area | used the slanted side as height; halved like a triangle; perimeter |
| Composite (house) | box only; forgot to halve the roof; halved the box too |

Mixed numbers appear naturally whenever an answer is more than one whole.

## Difficulty and variety

Difficulty rises quietly with progress — no visible levels or settings. After 8 correct
answers the number ranges grow, and again after 18 (bigger denominators, bigger shapes).
Question types are drawn from a shuffled bag so the same question family never repeats
back-to-back (adding and subtracting count as one family), and the last 25 exact
questions are remembered so the same one doesn't come around again soon.

## Ranks and XP

+10 XP per correct answer, +2 more for every step of the current streak.
Cadet → Scholar (100) → Wizard (250) → Grandmaster (500). Nothing is saved between
sessions — closing the tab resets everything (by design, matches the handoff).

## Checking a change (the shipping checklist)

An automated Playwright suite was used for v2; the same things can be checked by hand:

1. Play 20+ questions on Mixed — every question has a diagram and 4 answers.
2. Every lesson opens, steps forward and back, closes at the end.
3. A wrong answer always reveals the correct one, with an explanation.
4. Mute silences everything.
5. On a narrow phone (~390 px) nothing spills outside the card.
6. The prize appears after every 5th answer, both games exit at any moment via
   "Back to the quest", and the quest resumes right after.

The automated suite additionally generates 16,800 questions (700 per type per
difficulty tier, all 8 types) and re-computes every answer independently: exactly one
correct option, four options distinct in display AND value (twin excepted), and the
correct value matches the math.

## Where to take it next (from the handoff, still open)

- Save progress between sessions (localStorage).
- More curriculum: ratios/rates, percents, integers, order of operations,
  volume/surface area of prisms, angles, transformations.
- Test on a real iPhone/iPad (v2 tested in desktop Chromium at phone size only).
- More mini-games: Bubble Blaster (target popping) and Connect Four vs. a simple
  robot are planned next.
- Focus trap for the overlays (keyboard users can still Tab behind an open dialog).
