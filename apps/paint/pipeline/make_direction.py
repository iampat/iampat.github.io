#!/usr/bin/env python3
"""Build a runnable direction.json from a style template and a regions file.

    python make_direction.py --style oil --target t.png --reference p.png \
        --out work/oil/direction.json [--regions regions/portrait_at_the_lake.json] \
        [--max-strokes N] [--seed N]

The style templates in directions/ hold the layers, the ground and the metric.
They carry no shapes: "regions" and "flows" come from a regions file, so all
four painting styles share one set of shapes per photo. The template names its
default regions file in "regions_file"; --regions overrides it.

A trace template (the crayon style) needs no shapes at all: its layers follow
the marks of the target. Such a template sets "border_frac" in place of
"regions_file", and this script builds "all", "main" and "border" from the
canvas. "border_frac" is the width of the border ring, as a fraction of the
shorter canvas side. 0 makes "main" the whole sheet and "border" empty.

A uniform template (the four *-uniform styles) needs no shapes either: every
layer paints the whole sheet. It names neither "regions_file" nor
"border_frac", and this script builds the one region "all" from the canvas.

For a trace template this script also prints where "max_strokes" cuts the layer
list, because the cap stops the whole run and drops the late layers. See
budget_note below.

The template's "target" and "reference" are the placeholders "{TARGET}" and
"{REFERENCE}". This script replaces them with the two paths you pass, written
relative to the output file when that is possible, because painter2.py resolves
a relative target or reference against the direction file's own directory.
"""
import argparse
import collections
import json
import os
import sys
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_ORDER = ["note", "canvas", "target", "reference", "seed", "max_strokes",
             "paper", "paper_tol", "ground", "metric", "locality", "regions",
             "flows", "layers"]


def load_json(path):
    with open(path) as fh:
        return json.load(fh, object_pairs_hook=collections.OrderedDict)


def resolve_style(style):
    """A style name (oil) or a path to a template json."""
    if os.path.isfile(style) and (style.endswith('.json') or os.sep in style):
        return style
    guess = os.path.join(HERE, "directions", style + ".json")
    if os.path.exists(guess):
        return guess
    here = os.path.join(HERE, "directions")
    have = sorted(f[:-5] for f in os.listdir(here) if f.endswith(".json"))
    raise SystemExit("error: no style template for %r. The names are: %s (templates in %s)"
                     % (style, ", ".join(have), here))


def resolve_regions(arg, template, template_path):
    if arg:
        if not os.path.exists(arg):
            raise SystemExit("error: no regions file at %s" % arg)
        return arg
    name = template.get("regions_file")
    if not name:
        raise SystemExit("error: the template has no \"regions_file\"; pass --regions")
    for cand in (os.path.join(HERE, "regions", name),
                 os.path.join(os.path.dirname(os.path.abspath(template_path)), name),
                 name):
        if os.path.exists(cand):
            return cand
    raise SystemExit("error: no regions file named %s under %s" % (name, os.path.join(HERE, "regions")))


def canvas_regions(canvas, border_frac):
    """The shapes a direction without a regions file needs, from the canvas.

    A trace layer follows the marks of the target, and a uniform layer paints
    the whole sheet, so neither needs hand-drawn shapes. Both need "all".

    `border_frac` adds the two shapes a frame needs: "main" is the picture and
    "border" is the ring around it. It is that ring's width, as a fraction of
    the shorter canvas side, so one template fits any drawing at any canvas
    size. 0 makes "main" the whole sheet and "border" empty. None leaves both
    out, which is what a uniform template wants.
    """
    w, h = int(canvas[0]), int(canvas[1])
    full = [0, 0, w - 1, h - 1]
    out = collections.OrderedDict([
        ("all", collections.OrderedDict([("rect", list(full))])),
    ])
    if border_frac is None:
        return out
    frac = float(border_frac)
    if not 0.0 <= frac < 0.5:
        raise SystemExit("error: \"border_frac\" must be 0 or more and less than 0.5 (got %r)" % border_frac)
    inset = int(round(frac * min(w, h)))
    out["main"] = collections.OrderedDict([("rect", [inset, inset, w - 1 - inset, h - 1 - inset])])
    out["border"] = collections.OrderedDict([("rect", list(full)), ("minus", ["main"])])
    return out


def layer_count(layer):
    """The strokes one layer may keep: its "count", or the sum of its levels.

    A layer that stops on ink density carries "stop": {"max_count": N}: N is
    then the cap, and the layer usually stops well under it.
    """
    stop = layer.get("stop")
    if isinstance(stop, dict) and stop.get("max_count"):
        return int(stop["max_count"])
    if "levels" in layer:
        return sum(int(lv.get("count", 0)) for lv in layer["levels"])
    return int(layer.get("count", 0))


def budget_note(d):
    """Where "max_strokes" cuts the layer list of a trace direction.

    The placer walks the layers in order and stops the whole run at
    "max_strokes". A low cap therefore drops the late layers. It does not thin
    every layer, so the picture comes back missing its colour, its outlines and
    its frame, not lighter all over.

    Only a trace direction gets this note. A trace layer keeps exactly its
    "count", so the cumulative sum says which layer the cap lands in. A painting
    layer drops any stroke that misses its "threshold", so there the sum is an
    upper bound and the cut lands later than the arithmetic says.

    Returns the note, or None when the cap reaches the end of the list.
    """
    layers = d.get("layers") or []
    if not layers or not all(l.get("mode") == "trace" for l in layers):
        return None
    cap = int(d.get("max_strokes", 0))
    if cap <= 0:
        return None
    running = []
    total = 0
    for l in layers:
        total += layer_count(l)
        running.append((str(l.get("name", "?")), total))
    if cap >= total:
        return None
    stop = next(i for i, (_, c) in enumerate(running) if c > cap)
    into = cap - (running[stop - 1][1] if stop else 0)
    if into == 0:
        head = 'max strokes %d of %d: the run ends with "%s" (layer %d of %d)' % (
            cap, total, running[stop - 1][0], stop, len(running))
        skipped = [n for n, _ in running[stop:]]
    else:
        head = 'max strokes %d of %d: the run stops %d strokes into "%s" (layer %d of %d)' % (
            cap, total, into, running[stop][0], stop + 1, len(running))
        skipped = [n for n, _ in running[stop + 1:]]
    lines = ["  budget     " + head,
             textwrap.fill("cumulative: " + ", ".join("%s %d" % (n, c) for n, c in running),
                           width=92, initial_indent="             ",
                           subsequent_indent="               ")]
    if skipped:
        lines.append(textwrap.fill("these layers place nothing: " + ", ".join(skipped),
                                   width=92, initial_indent="             ",
                                   subsequent_indent="               "))
    lines.append("             the whole picture needs %d strokes. Raise --max-strokes, or leave it off."
                 % total)
    if any(isinstance(l.get("stop"), dict) for l in layers):
        lines.append(textwrap.fill(
            'a layer with "stop" quits when its ink deficit is met, so its "max_count" is an '
            "upper bound and the cut lands later than this note says",
            width=92, initial_indent="             ", subsequent_indent="               "))
    return "\n".join(lines)


def rel_to(path, out_dir):
    """Relative path from out_dir when it stays short, else absolute.

    painter2.py resolves a relative target or reference against the direction
    file's own directory, so a relative path keeps the work dir movable.
    """
    path = os.path.abspath(path)
    try:
        rel = os.path.relpath(path, os.path.abspath(out_dir))
    except ValueError:
        return path
    return path if rel.count("..") > 2 else rel


def main(argv=None):
    ap = argparse.ArgumentParser(description="build a direction.json from a style template")
    ap.add_argument("--style", required=True,
                    help="oil | watercolor | pencil | sketch | crayon | path to a template json")
    ap.add_argument("--target", required=True, help="the style target image (what the painting copies)")
    ap.add_argument("--reference", required=True, help="the reference photo (likeness truth)")
    ap.add_argument("--out", required=True, help="path of the direction.json to write")
    ap.add_argument("--regions", default=None, help="a regions json (default: the template's regions_file)")
    ap.add_argument("--max-strokes", type=int, default=None)
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args(argv)

    template_path = resolve_style(a.style)
    template = load_json(template_path)
    border_frac = template.get("border_frac")
    from_canvas = a.regions is None and "regions_file" not in template
    regions_path = None
    regions = None
    if not from_canvas:
        regions_path = resolve_regions(a.regions, template, template_path)
        regions = load_json(regions_path)

    out_dir = os.path.dirname(os.path.abspath(a.out)) or "."
    os.makedirs(out_dir, exist_ok=True)

    d = collections.OrderedDict(template)
    d.pop("style", None)
    d.pop("regions_file", None)
    d.pop("border_frac", None)
    d["target"] = rel_to(a.target, out_dir)
    d["reference"] = rel_to(a.reference, out_dir)
    if from_canvas:
        d["regions"] = canvas_regions(d["canvas"], border_frac)
        d["flows"] = collections.OrderedDict()
        regions_name = ("from the canvas, the whole sheet" if border_frac is None
                        else "from the canvas, border_frac %g" % float(border_frac))
    else:
        d["canvas"] = regions.get("canvas", d.get("canvas"))
        d["regions"] = regions["regions"]
        d["flows"] = regions.get("flows", {})
        regions_name = os.path.basename(regions_path)
    if a.max_strokes is not None:
        d["max_strokes"] = a.max_strokes
    if a.seed is not None:
        d["seed"] = a.seed

    ordered = collections.OrderedDict((k, d[k]) for k in KEY_ORDER if k in d)
    for k, v in d.items():
        ordered.setdefault(k, v)

    with open(a.out, "w") as fh:
        json.dump(ordered, fh, indent=1)
    print("direction  %s\n  style      %s\n  regions    %s (%d regions, %d flows)\n  canvas     %dx%d, max strokes %d, seed %d"
          % (a.out, os.path.basename(template_path), regions_name,
             len(ordered["regions"]), len(ordered.get("flows", {})),
             ordered["canvas"][0], ordered["canvas"][1], ordered["max_strokes"], ordered["seed"]))
    note = budget_note(ordered)
    if note:
        print(note)
    return 0


if __name__ == "__main__":
    sys.exit(main())
