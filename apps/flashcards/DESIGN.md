# Flashcard Drill — Design Direction

Framing for evolving this from a latency-specific drill into a **generic,
content-agnostic flashcard tool**. This document is UX/product direction only —
no implementation detail, no backend/sync design (deliberately out of scope for
now). It records decisions made so far and the open questions that remain.

## 1. Product vision

A fast, mobile-first, self-graded flashcard drill that runs as a static site.
The app stays content-agnostic: everything subject-specific lives in deck JSON,
and the app renders whatever a deck provides. You open it, it drills you, it
remembers what you know — nothing else to configure.

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

- The answer remains the visual focus (largest element, accent color); rich
  content must not bury it.
- Notes stay secondary (dim, smaller) and reserve their line height so the card
  doesn't jump on reveal.
- Everything must remain legible and non-overflowing at 360 px wide; code and
  images scroll or scale within the card rather than widening the page.

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

**Keep the endless weighted drill.** One deck, continuous, no session boundary.

- Cards are drawn by weighted recall: a base weight (right/wrong history) times a
  recency factor, so missed cards return sooner and long-unseen cards come first.
- No fixed-length ("20 cards" / "10 minutes") sessions, no end-of-session
  summary screen.
- No tag/group filtering of the pool, and no cross-deck sessions — a session is
  one whole deck.
- "Mastered" stays a **status label** (a stat), not a filter: mastered cards
  still appear, just rarely, and resurface after a long gap.

Deck selection is unchanged: `?deck=<id>`, single-deck auto-load, or a picker
for multiple decks.

## 6. Non-goals (for this phase)

- Alternate card types: multiple choice, typed answers, cloze.
- Math / formula (LaTeX) rendering — dropped: library dependency vs. the
  static / no-build constraint. Use an image or Unicode instead.
- Category-chip or progress visualizations.
- Session scoping: length limits, tag filters, cross-deck study.
- Accounts, sync, sharing (backend — deferred, not part of this UX framing).

## 7. Open questions

To resolve before/while specifying the content work:

1. **Authoring format for rich content.** How does a deck author write bold,
   lists, code, and math in JSON — Markdown in a string, a small set of fields,
   or a restricted HTML subset? Affects both authoring UX and safety.
2. **Syntax-highlighting dependency.** Code highlighting typically needs a
   library; how does that square with "static, no build step, minimal external
   calls" (e.g. inline a small highlighter, precompute at authoring time, or
   ship plain monospace)? (Math rendering was dropped for the same reason.)
3. **Image sourcing.** Bundled in the repo under the deck, referenced by
   relative path, or external URLs (and how does that interact with offline)?
4. **Answer legibility with rich content.** Rules for when the answer is a code
   block or image rather than a short value — does it still need to be "the
   largest element," or does that guideline relax?
5. **Linear-scale specifics.** Tick/label conventions and edge clamping for
   linear scales, reusing the log rail's geometry.
