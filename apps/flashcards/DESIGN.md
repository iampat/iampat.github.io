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
- **Code blocks** — monospaced snippets for programming decks. Plain monospace
  to start; syntax highlighting is deferred, not required.
- **Images** — diagrams or photos, usable as a prompt face (§3.2) or in the
  answer. **Bundled in the repo** under the owning set, referenced by relative
  path, so the app keeps working offline and makes no external calls.

**Authoring format: a small Markdown subset inside the existing strings** —
`**bold**`, `- bullets`, `` `code` ``, and newlines, rendered by a minimal
built-in renderer. No new schema for text content, nothing to learn beyond
Markdown, and no external library. The renderer must escape anything it does
not explicitly support (no raw HTML passthrough).

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
pairs rather than one giant value, so each fact is individually readable.

**Grading stays a single Wrong/Correct — decided.** One button covers all the
facts on a card; you decide whether recalling 4 of 5 counts as correct. No
per-fact grading, and no splitting a subject into one card per fact.

### 3.2 Prompt faces (randomized clue)

An entity card may offer **more than one face that can serve as the prompt** —
e.g. a player's photo *or* their name. Each time the card comes up, the app
**picks one face at random** as the clue and reveals everything else as the
answer. One card per subject, but the direction varies between showings.

- Photo shown → reveal name, number, position, age.
- Name shown → reveal photo, number, position, age.

Rules:

- If a face is missing (no photo for that player), it is simply never chosen —
  the card degrades to the faces it has, no blank prompt.
- Face choice is **presentation only**: it does not affect scheduling, and the
  card keeps one set of stats regardless of which face was shown. This follows
  from the single Wrong/Correct decision above.
- A card with one face behaves exactly like today's cards.

**Image as clue is a general capability, not a player-deck feature.** Any card
in any set may use an image as its prompt face; the players deck is just the
first consumer.

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

**Existing stats are not migrated — decided.** The move to namespaced storage
starts fresh; the current `fcd:latency-2026:v1` history is dropped rather than
converted. Stability guarantees (edit/reorder/add/remove a card without
disturbing others) apply from that point forward.

Other selection details:

- **Mixed-pool labelling.** When more than one set is selected, each card shows
  its set name alongside its group tag, so you always know what you're being
  asked about. With a single set selected, the set label is redundant and hidden.
- **Aging across selections.** The rep counter and per-card `lastRep` stay
  global, so cards in a set you haven't practiced keep aging and surface early
  when you next include them. This is desirable, not a bug.
- **Empty selection** is not a drillable state; the drill cannot start until at
  least one set is chosen.

### 5.2 Worked examples

Three decks that this model must accommodate:

| Set | Card shape | Notes |
|-----|-----------|-------|
| Latency numbers | value | numeric log rail; today's deck |
| Soccer team players | entity | number / position / age; photo or name as the random prompt face; no rail |
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

## 7. Decisions log

Previously open, now settled:

| Question | Decision |
|----------|----------|
| Grading granularity | Single Wrong/Correct per card; you judge whether 4-of-5 facts counts |
| Entity prompt direction | One card, **random prompt face** per showing (§3.2) |
| Rich-content authoring | Small **Markdown subset** inside existing strings |
| Image sourcing | **Bundled in the repo** under the owning set, relative paths |
| Image scope | A **general capability** — any card may use an image clue |
| Existing stats | **Start fresh**; no migration from `fcd:latency-2026:v1` |
| Selection primitive | One deck file = one set; tags refine within a set |
| Syntax highlighting | Deferred — plain monospace is enough |
| Set label on cards | Shown only when multiple sets are selected |
| Aging across sets | Global rep counter; unpractised sets keep aging |

Still genuinely open (do not block starting):

1. **Linear-scale specifics.** Tick/label conventions and edge clamping for
   linear scales, reusing the log rail's geometry. Only matters when a second
   numeric deck appears.
2. **Image rights for real photos.** Bundling is the mechanism; sourcing images
   that are legal to redistribute in a public repo is a content question for
   whoever authors the players set.
3. **Markdown subset scope.** Exactly which constructs the built-in renderer
   supports beyond bold / bullets / inline code (links? headings?).

## 8. Execution plan

Ordered so each phase is independently shippable and the app keeps working
throughout. Phases 1–2 are the structural work; 3–5 are additive.

**Phase 1 — Sets and selection.** The foundation, and the only phase with a
breaking storage change.
- Namespaced per-card stats (`<setId>:<cardId>`), starting fresh.
- Multi-select screen: every set with its card count, All / None, persisted
  choice, URL-encoded so a combination is linkable.
- Drill pool = union of selected sets; stats strip reflects the current pool.
- Set label on cards when more than one set is selected.

**Phase 2 — Card shapes.** Makes non-value content presentable.
- Checklist shape: hint list at readable body size, prompt stays prominent.
- Entity shape: label-value fact rows.
- Shapes must coexist in one mixed session without layout jumping.

**Phase 3 — Random prompt faces.** Depends on the entity shape from Phase 2.
- A card declares its available faces; one is chosen at random per showing.
- Missing faces are never chosen; single-face cards behave as today.
- Presentation only — no scheduling or stats impact.

**Phase 4 — Rich text and images.**
- Minimal Markdown renderer (bold, bullets, inline code, newlines) with
  escaping and no raw HTML passthrough.
- Bundled images with relative paths, usable as a prompt face or in an answer;
  must scale within the card at 360 px and never widen the page.

**Phase 5 — Content.** Author the two new sets against the finished shapes:
behavioral interview questions (checklist) and soccer players (entity). The
interview set needs no images, so it can land before Phase 4 completes.

Deferred beyond this plan: linear scales, syntax highlighting, and everything
in §6.
