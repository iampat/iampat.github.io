# Flashcard Drill — Design Direction

Framing for evolving this from a latency-specific drill into a **generic,
content-agnostic flashcard tool**. This document is UX/product direction only —
no implementation detail, no backend/sync design (deliberately out of scope for
now). It records decisions made so far and the open questions that remain.

## 1. Product vision

A fast, mobile-first, self-graded flashcard drill that runs as a static site.
The app stays content-agnostic: everything subject-specific lives in deck JSON,
and the app renders whatever a deck provides. You pick which sets to practice,
it drills you, and it remembers what you know — nothing else to configure.

The app must comfortably host unrelated subjects side by side. Three reference
decks drive the design: **latency numbers** (short numeric answers), **soccer
team players** (a few labelled facts plus an optional photo), and **behavioral
interview questions** (no single answer — a checklist of points to hit).

## 2. Card & grading model

**Self-graded reveal is the only card type.** (Multiple-choice, type-in, and
cloze/fill-in-the-blank are explicitly *not* pursued.)

The interaction stays exactly as today:

- Front is shown; the answer is masked.
- Tap / Show / Space reveals the answer, note, and any visualization together.
- You self-judge with **Wrong / Correct** (or ← / →, or swipe).
- Grading immediately advances to the next card — grade-to-advance, no "next"
  button, no lingering.

Rationale: self-grading is universal (works for any subject and any answer
shape), needs no answer-matching logic, and keeps the pace fast. The cost —
honest self-assessment — is accepted.

## 3. Card content

A card has these conceptual slots, each of which may carry richer content than
plain text:

| Slot   | Purpose                                  |
|--------|------------------------------------------|
| group  | short category/tag label (e.g. "CPU")    |
| front  | the prompt / question                    |
| answer | the thing being recalled (largest on screen) |
| note   | extra context shown after reveal         |

Supported content, on any slot:

- **Rich text** — bold/italic, multiple lines, bullet lists. (Multi-line and
  bulleted answers already work.)
- **Code blocks** — monospaced snippets for programming decks (syntax
  highlighting optional; plain monospace is enough to start).
- **Images** — diagrams or pictures on the front or answer side.

Math / formula (LaTeX) rendering is **not** in the plan: it needs a rendering
library, which conflicts with the static / no-build / minimal-external-calls
constraint. Decks needing an equation can use an image or Unicode notation.

UX principles for content:

- Notes stay secondary (dim, smaller) and reserve their line height so the card
  doesn't jump on reveal.
- Everything must remain legible and non-overflowing at 360 px wide; code and
  images scroll or scale within the card rather than widening the page.

### 3.1 Card shapes

The grading model is always the same (reveal, then Wrong/Correct), but the
*answer* comes in three shapes, and each wants a different visual treatment.
The card declares its shape; the app styles accordingly.

**Value card** (today's default). The answer is one short value — a latency, a
date, a term. Treatment: largest element on screen, bold mono, accent color.
This is the only shape the current UI is designed for.

**Checklist card.** There is no single correct answer; the answer side is a
short list of points your spoken answer should have covered (behavioral
interview questions, "name the tradeoffs of X"). Treatment: the accent-colored
"one big value" hierarchy is wrong here — the list should be readable at a
comfortable body size, each point scannable, with the *prompt* remaining
prominent. You self-grade on "did I cover these?"

**Entity card.** The answer is a small set of labelled facts about one subject
(a player's number, position, and age). Treatment: fact rows / label-value
pairs rather than one giant value, so each fact is individually readable. An
optional image (e.g. a photo) may appear on the prompt or answer side.

Open issue for entity cards: a single Wrong/Correct covers several facts at
once. Two options, to be decided — (a) accept coarse grading: "did I get them
all?", or (b) split each fact into its own card (photo→name, name→number),
which grades precisely but multiplies card count. Recommendation: start with
(a), since self-grading is already approximate.

## 4. Answer visualization (optional)

The magnitude rail generalizes but stays **strictly optional and numeric**:

- A deck with a numeric answer dimension may define a **scale** and place each
  card's value on an axis. Support both **log** and **linear** scales (today
  only log exists).
- A deck (or a card) without a numeric value shows **no visualization at all** —
  no empty space, no placeholder. Most generic decks will use no rail.

Explicitly not pursued: category/enum "chip" visualizations for non-numeric
answers, and per-card/per-deck progress/mastery visualizations. Visualization
means "where does this answer sit on a number line," or nothing.

## 5. Session model

**Keep the endless weighted drill**, but let the user choose *what's in the
pool*. (This supersedes the earlier "one deck, no filtering" decision.)

Drill mechanics are unchanged:

- Cards are drawn by weighted recall: a base weight (right/wrong history) times a
  recency factor, so missed cards return sooner and long-unseen cards come first.
- No fixed-length ("20 cards" / "10 minutes") sessions, no end-of-session
  summary screen — the drill is continuous.
- "Mastered" stays a **status label** (a stat), not a filter: mastered cards
  still appear, just rarely, and resurface after a long gap.

### 5.1 Sets and selection

A **set** is a named, selectable group of cards — the unit you pick when you
start practicing. Before drilling, you choose **all sets, one set, or any
combination**; the drill pool is the union of the selected sets, drawn by the
same weighted-recall algorithm.

Model (proposed): each **deck file is a set** (`latency`, `whitecaps`,
`interview-behavioral`), and a card may additionally carry **tags** for
finer slicing within a large set. Selection UI operates on sets first; tags are
a secondary refinement.

UX requirements:

- A selection screen listing every set with its card count and a checkbox-style
  multi-select, plus "All" / "None".
- The choice persists, so reopening the app resumes the same pool without
  re-picking.
- The selection is shareable/bookmarkable via the URL (extending today's
  `?deck=`), so a given combination can be linked.
- The stats strip reflects the *current pool*, not the whole library.

Consequence for persistence: card ids are only unique *within* a deck today, so
a multi-set pool must namespace stats (e.g. `<setId>:<cardId>`) to avoid
collisions. Per-card stats must stay keyed by that stable id, never by position,
so editing or reordering a set never disturbs other cards.

### 5.2 Worked examples

Three decks that this model must accommodate:

| Set | Card shape | Notes |
|-----|-----------|-------|
| Latency numbers | value | numeric log rail; today's deck |
| Whitecaps players | entity | number / position / age, optional photo; no rail |
| Behavioral interview questions | checklist | hint list, no single answer; no rail |

Practicing "all" mixes value, entity, and checklist cards in one session, so the
three card shapes must coexist visually without the layout jumping between them.

## 6. Non-goals (for this phase)

- Alternate card types: multiple choice, typed answers, cloze.
- Math / formula (LaTeX) rendering — dropped: library dependency vs. the
  static / no-build constraint. Use an image or Unicode instead.
- Category-chip or progress visualizations.
- Fixed-length sessions and end-of-session summary screens. (Set selection is
  now *in* scope — see §5.1 — but session *length* limits are not.)
- Accounts, sync, sharing (backend — deferred, not part of this UX framing).

## 7. Open questions

To resolve before/while specifying the content work:

1. **Set vs. tag as the selection primitive.** §5.1 proposes "one deck file =
   one set, tags refine within." Confirm, or make tags the only primitive (one
   big library, sets are just tag values)?
2. **Authoring format for rich content.** How does a deck author write bold,
   lists, and code in JSON — Markdown in a string, a small set of fields, or a
   restricted HTML subset? Affects both authoring UX and safety.
3. **Entity-card grading granularity.** One Wrong/Correct for several facts
   (coarse, recommended) vs. splitting each fact into its own card (precise, but
   multiplies card count and repeats the prompt).
4. **Syntax-highlighting dependency.** Code highlighting typically needs a
   library; how does that square with "static, no build step, minimal external
   calls" (e.g. inline a small highlighter, precompute at authoring time, or
   ship plain monospace)? (Math rendering was dropped for the same reason.)
5. **Image sourcing and rights.** Bundled in the repo under the set, referenced
   by relative path, or external URLs (and how does that interact with offline)?
   Note that third-party photos (e.g. club/agency player images) are typically
   copyrighted — a practical blocker for bundling them in a public repo,
   independent of the technical choice.
6. **Answer legibility with rich content.** Rules for when the answer is a code
   block or image rather than a short value — does the "largest element"
   guideline relax? (§3.1 already relaxes it for checklist and entity cards.)
7. **Linear-scale specifics.** Tick/label conventions and edge clamping for
   linear scales, reusing the log rail's geometry.
