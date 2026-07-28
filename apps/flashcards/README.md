# Flashcard Drill

A static weighted-recall flashcard drill for GitHub Pages. Pure HTML + CSS +
vanilla JS — no framework, no build step, no bundler. The only external
resource is an optional Google Fonts stylesheet, loaded async with a full
system-font fallback.

The app is **content-agnostic**: everything subject-specific lives in deck JSON
files under `decks/`. The code itself knows nothing about the cards it shows.

The app lives under `apps/flashcards/` in this repo.

## Run locally

Because the app fetches deck JSON, open it over HTTP (not `file://`). Serve from
the repo root:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/apps/flashcards/
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
3. Pick the branch (e.g. `master`) and folder `/ (root)`.
4. The app serves at `https://<user>.github.io/<repo>/apps/flashcards/`.

All asset and deck paths are relative, so it works correctly under any subpath
with no configuration.

## Set selection

Each deck file is a **set**. You can practice any combination:

- With no URL param, the manifest `decks/index.json` decides: one deck loads
  directly; several show a **multi-select screen** (tap to check/uncheck,
  then Start). The drill pool is the union of the checked sets.
- The choice persists (localStorage), so reopening the app resumes the same
  pool. The **Sets** button in the footer returns to the selection screen.
- `?deck=<id>` pins a single set (e.g. `?deck=latency-2026`); leaving via
  **Sets** clears the pin.
- When more than one set is selected, each card shows its set name next to
  its group tag. Stats always reflect the current pool.

## Adding a deck

1. Create `decks/<your-id>.json` following the schema below.
2. Add `<your-id>` to the `decks` array in `decks/index.json`:

   ```json
   { "decks": ["latency-2026", "your-id"] }
   ```

3. Visit `?deck=<your-id>` (or check it on the selection screen).

### Deck schema

```jsonc
{
  "schema": 1,
  "id": "your-id",              // stable; used as the localStorage namespace
  "title": "Your Deck",         // browser tab + deck picker
  "subtitle": "Rev. 2026",      // optional; reserved (not currently rendered)
  "scale": {                    // OPTIONAL — omit for non-numeric decks
    "type": "log",              // only "log" in v1
    "min": 1,
    "max": 3.156e16,
    "ticks": [
      { "v": 1,    "label": "ns" },
      { "v": 1e9,  "label": "s"  }
    ],
    "leftLabel": "Nanosecond",
    "rightLabel": "Year"
  },
  "cards": [
    {
      "id": "c1",               // stable, unique within the deck
      "group": "Category",      // free-form tag, shown on the card
      "front": "Question text",
      "back": "Answer value",   // string = value card; array of strings = checklist
      "note": "shown after reveal (optional)",
      "mag": 1                  // optional; positions the marker on the scale
    }
  ]
}
```

**Card shapes** (implied by the data — no shape field):

- `back` as a **string** → value card: one short answer, rendered large in the
  accent color.
- `back` as an **array of strings** → checklist card: the answer is a list of
  points to hit (e.g. interview hints), rendered as a readable body-size list.
  See `decks/interview-behavioral.json`.
- a `facts` **object** (label → value) instead of `back` → entity card: the
  answer is labelled fact rows about one subject. `front` is the subject's
  name. See `decks/whitecaps.json`.

**Images and prompt faces** (any card shape): an optional `img` field holds a
path relative to the `decks/` directory (bundle the file in the repo). When a
card has an image, each showing randomly uses either the image or the `front`
text as the prompt; revealing shows the other one plus the answer. A card
without `img` always prompts with `front`. Image licensing is the deck
author's call.

**Rules**

- A `scale` plus a numeric `mag` on a card renders the log magnitude rail with
  an animated marker on reveal. If `scale` is absent or a card has no `mag`, the
  rail is hidden entirely — no empty space.
- Unknown fields are ignored (forward compatibility).
- The deck is validated on load: duplicate ids, a missing `front`/`back`, or an
  empty/invalid `back` list produce a readable error screen instead of silently
  dropping cards.

## How scheduling works

Each card carries `{ w, right, wrong, lastRep }` and all sets share one global
rep counter, so cards in a set you haven't practiced keep aging and surface
early when you next include it. The probability of drawing a card is
proportional to `w × rec`:

- **Base weight** (Leitner-style): starts at `1.0`; a correct answer multiplies
  it by `0.45` (floor `0.08`), a wrong answer by `2.6` (ceiling `8.0`).
- **Recency factor** `rec = min(0.05 + age·0.2, 30)` where
  `age = globalRep − lastRep`. The near-zero floor makes `rec` scale roughly
  with age, so a long-unseen card is drawn well before a recently answered one;
  a just-seen card is strongly suppressed.
- **Introducing new cards:** with a single set selected, never-seen cards come
  first, so the whole deck is toured within ~N reps. In a mixed pool the
  introduction rate is throttled (at least 1-in-3 draws, more while most of
  the pool is unseen) so a newly added set interleaves with practice instead
  of monopolizing the drill.

A card is **mastered** at `w ≤ 0.21` (two consecutive corrects from fresh).
The same card is never shown twice in a row, and a just-graded card will not
return within the next two reps.

## Persistence

Each set keeps its own **localStorage** store under `fcd:<setId>:v1`; the
shared rep counter lives in `fcd:global:v1` and the current selection in
`fcd:selected:v1`. Only selected sets' stores are ever loaded or written, so a
deselected set's stats can't be disturbed. Within a store, state merges by
card id on load, so editing a deck (adding, removing, or changing cards)
preserves the stats of untouched cards; stats for removed ids are dropped on
the next save, and stores for decks removed from the manifest are deleted at
startup. Stats are disposable — there is no migration or backward
compatibility; a store that doesn't match the current format starts fresh.
If localStorage is unavailable (e.g. private mode), the app falls back to
in-memory state and shows "this session only" in the footer.

`Reset` clears only the currently selected sets' stats. It is a two-step
control: the first tap arms it ("Erase all?"), a second tap within 4 seconds
erases; it disarms itself on timeout.

## Keyboard & touch

- **Desktop:** `Space`/`Enter` reveals, `←` marks wrong, `→` marks correct.
- **Mobile:** tap the card or **Show** to reveal; after reveal, swipe left for
  wrong or right for correct.
- `prefers-reduced-motion` disables the marker animation.
