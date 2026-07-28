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

- **Multi-line text and lists** — newlines in any slot; list answers via array
  `back` (§3.1). (Multi-line answers already work.)
- **Code snippets** — as plain monospaced text (the whole app is mono already);
  styled code and syntax highlighting are deferred, not required.
- **Images** — diagrams or photos, usable as a prompt face (§3.2) or in the
  answer. **Bundled in the repo** under the owning set, referenced by relative
  path, so the app keeps working offline and makes no external calls. (Image
  licensing is the deck author's call.)

**Authoring format: plain text plus structure.** Text slots are plain strings
(newlines allowed); lists are JSON arrays; entity facts are a JSON object. The
**Markdown renderer is deferred** — no planned deck needs bold or code, and
plain text + structured fields cover all three reference decks. If it is ever
built, the subset is fixed now: bold and inline code only — no links, no
headings, no block fences — and it must escape everything else (no raw HTML
passthrough).

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
*answer* comes in three shapes, each with its own visual treatment. **The data
implies the shape — there is no declared `shape` field.** A string `back` is a
value card, an array `back` is a checklist, a `facts` object is an entity card.
This removes a whole class of shape/data-mismatch errors.

**Value card** (today's default; `back` is a string). The answer is one short
value — a latency, a date, a term. Treatment: largest element on screen, bold
mono, accent color. This is the only shape the current UI is designed for.

**Checklist card** (`back` is an array of strings). There is no single correct
answer; the answer side is a short list of points your spoken answer should
have covered (behavioral interview questions, "name the tradeoffs of X").
Treatment: the accent-colored "one big value" hierarchy is wrong here — the
list renders at a comfortable body size, each point scannable, with the
*prompt* remaining prominent. You self-grade on "did I cover these?"

**Entity card** (a `facts` object of label → value, instead of `back`). The
answer is a small set of labelled facts about one subject (a player's number,
position, and age). Treatment: fact rows / label-value pairs rather than one
giant value, so each fact is individually readable.

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

Model: each **deck file is a set** (`latency`, `whitecaps`,
`interview-behavioral`). Tags for finer slicing within a set are **deferred** —
no planned deck needs them, and unknown fields are ignored, so they can be
added anytime.

UX requirements (trimmed for a single user):

- A selection screen listing every set with its card count and a checkbox-style
  multi-select. No All/None bulk controls — three checkboxes don't need them.
- The choice persists in localStorage, so reopening the app resumes the same
  pool without re-picking. **URL-encoding the selection is cut** — there is
  nobody to share a link with; `?deck=<id>` keeps working for a single set.
- The stats strip reflects the *current pool*, not the whole library.

**Persistence: per-set storage keys — no migration, no data loss.** Each set
keeps its own store under today's key format (`fcd:<setId>:v1`), which already
namespaces stats; only a small shared key for the global rep counter is added,
seeded from the existing counter. The earlier "namespace per card and start
fresh" decision is superseded: existing latency history is preserved for free,
per-set Reset stays natural, and a deselected set's stats can never be dropped
because only selected sets' keys are ever loaded or written. Per-card stats
stay keyed by stable card id, never by position.

Other selection details:

- **Mixed-pool labelling.** When more than one set is selected, each card shows
  its set name alongside its group tag, so you always know what you're being
  asked about. With a single set selected, the set label is redundant and hidden.
- **Aging across selections.** The rep counter and per-card `lastRep` stay
  global, so cards in a set you haven't practiced keep aging and surface early
  when you next include them. This is desirable, not a bug.
- **Unseen-card throttle.** Today unseen cards are introduced with absolute
  priority, which would let a newly added big set monopolize the drill until
  every new card is toured. In a multi-set pool, unseen cards are introduced at
  a throttled rate (roughly one draw in three, more when most of the pool is
  unseen) so new content interleaves with practice instead of displacing it.
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
| Card shape declaration | **Implied by data** (string/array `back`, `facts` object) — no `shape` field |
| Rich-content authoring | Plain text + structured fields; **Markdown renderer deferred** (subset fixed: bold + inline code only, if ever) |
| Image sourcing | **Bundled in the repo**, paths relative to the deck's directory, resolved at load |
| Image scope | A **general capability** — any card may use an image clue |
| Existing stats | **Preserved** — per-set keys make migration unnecessary (supersedes "start fresh") |
| Storage shape | Per-set `fcd:<setId>:v1` stores + one shared global rep-counter key |
| Selection primitive | One deck file = one set; **tags deferred** |
| Selection UX | Checkboxes + persisted choice; **no URL encoding, no All/None** |
| Unseen-card introduction | **Throttled** (~1-in-3) in multi-set pools, not absolute priority |
| Syntax highlighting | Deferred — plain monospace is enough |
| Set label on cards | Shown only when multiple sets are selected |
| Aging across sets | Global rep counter; unpractised sets keep aging |

Still genuinely open (does not block starting):

1. **Linear-scale specifics.** Tick/label conventions and edge clamping for
   linear scales, reusing the log rail's geometry. Only matters when a second
   numeric deck appears.

## 8. Execution plan

Reordered after evaluation: **content first, plumbing last** — nothing in the
later phases depends on multi-set support, so it ships when it's the only
thing left, not as a false "foundation". Each phase is independently shippable
and the app keeps working throughout.

**Phase 1 — Checklist rendering + interview deck.** Array-valued `back`
renders as a body-size hint list; author the behavioral-interview set against
it. Single-select picker (already working) covers set switching for now.

**Phase 2 — Entity cards, images, random faces + players deck.** `facts`
object renders as label-value rows; bundled images (paths relative to the
deck's directory) render scaled inside the card at 360 px; a card with both a
photo and a name face gets one picked at random per showing. Author the
players set (photos optional — cards degrade to name-only faces).

**Phase 3 — Multi-set selection.** Checkbox selection screen with persisted
choice; drill pool = union of selected sets; per-set stores + shared global
rep counter (no migration); set label on cards in mixed pools; per-card rail
lookup from the owning set; unseen-card throttle.

**Phase 4 — Markdown renderer.** Only if a real card ever needs bold or
inline code. Not scheduled.

Deferred beyond this plan: linear scales, tags, syntax highlighting, and
everything in §6.
