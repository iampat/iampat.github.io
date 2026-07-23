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

## Deck selection

- `?deck=<id>` loads `decks/<id>.json` (e.g. `?deck=latency-2026`).
- With no `?deck=` param, the manifest `decks/index.json` decides:
  - one deck → load it directly,
  - several → show a minimal deck picker.

## Adding a deck

1. Create `decks/<your-id>.json` following the schema below.
2. Add `<your-id>` to the `decks` array in `decks/index.json`:

   ```json
   { "decks": ["latency-2026", "your-id"] }
   ```

3. Visit `?deck=<your-id>` (or pick it from the picker).

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
      "back": "Answer value",
      "note": "shown after reveal (optional)",
      "mag": 1                  // optional; positions the marker on the scale
    }
  ]
}
```

**Rules**

- A `scale` plus a numeric `mag` on a card renders the log magnitude rail with
  an animated marker on reveal. If `scale` is absent or a card has no `mag`, the
  rail is hidden entirely — no empty space.
- Unknown fields are ignored (forward compatibility).
- The deck is validated on load: duplicate ids or a missing `front`/`back`
  produce a readable error screen instead of silently dropping cards.

## How scheduling works

Each card carries `{ w, right, wrong, lastRep }` and there is a global
`repCount`. The probability of drawing a card is proportional to `w × rec`:

- **Base weight** (Leitner-style): starts at `1.0`; a correct answer multiplies
  it by `0.45` (floor `0.08`), a wrong answer by `2.6` (ceiling `8.0`).
- **Recency factor** `rec = min(0.05 + age·0.2, 30)` where
  `age = repCount − lastRep`. The near-zero floor makes `rec` scale roughly
  with age, so a long-unseen card is drawn well before a recently answered one;
  a just-seen card is strongly suppressed. Unseen cards are introduced first
  (before the weighted draw) so the whole deck is touched early.

A card is **mastered** at `w ≤ 0.21` (two consecutive corrects from fresh).
The same card is never shown twice in a row, and a just-graded card will not
return within the next two reps.

## Persistence

Stats are stored in **localStorage** under `fcd:<deckId>:v1`. State is merged by
card id on load, so editing a deck (adding, removing, or changing cards)
preserves the stats of untouched cards. Stats for removed ids are dropped on the
next save. If localStorage is unavailable (e.g. private mode), the app falls
back to in-memory state and shows "this session only" in the footer.

`Reset` clears only the current deck's stats. It is a two-step control: the
first tap arms it ("Erase all?"), a second tap within 4 seconds erases; it
disarms itself on timeout.

## Keyboard & touch

- **Desktop:** `Space`/`Enter` reveals, `←` marks wrong, `→` marks correct.
- **Mobile:** tap the card or **Show** to reveal; after reveal, swipe left for
  wrong or right for correct.
- `prefers-reduced-motion` disables the marker animation.
