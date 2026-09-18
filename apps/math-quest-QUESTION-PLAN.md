# Math Quest — plan for 100 more question types

Scope: **100 new question templates**, pitched at *medium*, *hard* and *challenging*,
on top of the 8 that ship today.

A note on counting: the engine does not store finished questions. Each template is a
JSON entry that generates thousands of concrete questions (random parameters × 3
difficulty tiers), so "100 questions" here means 100 **templates** — in practice a
question bank a kid cannot exhaust.

## How difficulty is expressed

Difficulty stays invisible to the player — no menus, no level picker (the tiers
auto-advance after 8 and 18 correct answers). Each template declares its own per-tier
ranges, so for these new templates the three tiers read as:

| Tier | Band | Shape of it |
|---|---|---|
| 1 | Medium | one step, friendly numbers, the diagram carries most of the meaning |
| 2 | Hard | two steps, or one step with awkward numbers |
| 3 | Challenging | multi-step, a distractor that punishes the common shortcut, minimal diagram help |

No new engine features are needed for this: `params` already takes per-tier ranges.

## The 100 templates

### A — Fractions and number sense (28)
| # | Topic | Templates |
|---|---|---|
| 1 | Add / subtract **mixed numbers** (with regrouping) | 4 |
| 2 | Fraction × fraction | 4 |
| 3 | Fraction ÷ fraction | 3 |
| 4 | Fraction **of a quantity** ("⅖ of 60 marbles") | 3 |
| 5 | Compare and order fractions | 3 |
| 6 | Equivalent fractions / simplify to lowest terms | 2 |
| 7 | Improper ↔ mixed conversions | 2 |
| 8 | Fraction ↔ decimal ↔ percent | 4 |
| 9 | Multi-step fraction word problems | 3 |

### B — Ratios, rates and percents (18)
| # | Topic | Templates |
|---|---|---|
| 10 | Percent of a number | 3 |
| 11 | Discounts and tax | 3 |
| 12 | Unit rates ("best buy") | 3 |
| 13 | Ratio tables and equivalent ratios | 3 |
| 14 | Scaling a recipe | 3 |
| 15 | Percent increase / decrease | 3 |

### C — Integers, operations, number theory (16)
| # | Topic | Templates |
|---|---|---|
| 16 | Integer add / subtract on a number line | 4 |
| 17 | Order of operations (BEDMAS) | 4 |
| 18 | Exponents and square numbers | 2 |
| 19 | GCF and LCM | 3 |
| 20 | Prime factorisation and divisibility | 3 |

### D — Geometry and measurement (26)
| # | Topic | Templates |
|---|---|---|
| 21 | Area of a trapezoid | 3 |
| 22 | Composite shapes, including the *subtraction* method (L-shapes, holes) | 4 |
| 23 | Perimeter vs area contrasts | 3 |
| 24 | Volume of a rectangular prism | 4 |
| 25 | Surface area and nets | 4 |
| 26 | Angles: complementary, supplementary, around a point | 4 |
| 27 | Triangle angle sum / missing angle | 2 |
| 28 | Coordinate plane and distance | 2 |

### E — Data and probability (12)
| # | Topic | Templates |
|---|---|---|
| 29 | Mean, median, mode, range | 4 |
| 30 | Reading bar and line graphs | 4 |
| 31 | Simple probability (spinner, dice) | 4 |

## The only real code work: 11 new diagram builders

Templates are data, but a genuinely new *picture* needs one builder function added to
the `DIAGRAMS` registry. Everything in strand A reuses `fracBars` and `pizzas`.

`numberLine` · `percentBar` · `ratioDots` · `trapezoid` · `prism3d` · `net` ·
`angleWedge` · `coordGrid` · `barChart` · `lineGraph` · `spinner`

Each is ~20–40 lines of SVG, the same size as the existing `triangle` / `house`
builders, and each then serves every template in its family.

## Lessons

About **14 new illustrated lessons**, one per concept cluster (mixed numbers,
fraction × fraction, percents, ratios, integers, BEDMAS, GCF/LCM, trapezoid, volume,
surface area, angles, coordinates, averages, probability). This is the slowest part
and the part that matters most — a question type without a lesson breaks the
"teach before testing" rule.

## Phasing

| Phase | Templates | New builders | Why this order |
|---|---|---|---|
| 1 | 30 (strand A + percents) | `percentBar`, `numberLine` | Deepest curriculum value, reuses existing art, lowest risk |
| 2 | 34 (strand D) | `trapezoid`, `prism3d`, `net`, `angleWedge`, `coordGrid` | Natural next step from the area questions already shipped |
| 3 | 36 (strands B, C, E) | `ratioDots`, `barChart`, `lineGraph`, `spinner` | Widest new ground; best done once the builder patterns are settled |

## Quality bar (per template, enforced by the existing harness)

- Every wrong answer traceable to a **named misconception**, never a random number.
- Explanation names the step the kid missed, using their actual numbers.
- A diagram, plus screen-reader text carrying any dimension that lives only in the art.
- Integer-only answer display (no stray decimals).
- All four options distinct in value — already an engine guarantee.
- Per-tier ranges that actually separate medium / hard / challenging.

The fuzz harness is generic, so each new template is automatically covered the moment
it is added; the per-template expected-answer function is the only test code to write.

## Open question for later

At ~108 templates the shuffled-bag rotation will show a topic roughly once per 108
questions on Mixed. Worth adding **strand weighting** (draw fractions more often than
probability) rather than a uniform bag — a small change to `nextType`, best decided
once the bank is actually large.
