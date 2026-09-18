#!/usr/bin/env python3
"""Build a runnable direction.json from a style template and a regions file.

    python make_direction.py --style oil --target t.png --reference p.png \
        --out work/oil/direction.json [--regions regions/portrait_at_the_lake.json] \
        [--max-strokes N] [--seed N]

The style templates in directions/ hold the layers, the ground and the metric.
They carry no shapes: "regions" and "flows" come from a regions file, so all
four styles share one set of shapes per photo. The template names its default
regions file in "regions_file"; --regions overrides it.

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

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_ORDER = ["canvas", "target", "reference", "seed", "max_strokes",
             "ground", "metric", "regions", "flows", "layers"]


def load_json(path):
    with open(path) as fh:
        return json.load(fh, object_pairs_hook=collections.OrderedDict)


def resolve_style(style):
    """A style name (oil) or a path to a template json."""
    if os.path.exists(style):
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
    ap.add_argument("--style", required=True, help="oil | watercolor | pencil | sketch | path to a template json")
    ap.add_argument("--target", required=True, help="the style target image (what the painting copies)")
    ap.add_argument("--reference", required=True, help="the reference photo (likeness truth)")
    ap.add_argument("--out", required=True, help="path of the direction.json to write")
    ap.add_argument("--regions", default=None, help="a regions json (default: the template's regions_file)")
    ap.add_argument("--max-strokes", type=int, default=None)
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args(argv)

    template_path = resolve_style(a.style)
    template = load_json(template_path)
    regions_path = resolve_regions(a.regions, template, template_path)
    regions = load_json(regions_path)

    out_dir = os.path.dirname(os.path.abspath(a.out)) or "."
    os.makedirs(out_dir, exist_ok=True)

    d = collections.OrderedDict(template)
    d.pop("style", None)
    d.pop("regions_file", None)
    d["canvas"] = regions.get("canvas", d.get("canvas"))
    d["target"] = rel_to(a.target, out_dir)
    d["reference"] = rel_to(a.reference, out_dir)
    d["regions"] = regions["regions"]
    d["flows"] = regions.get("flows", {})
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
          % (a.out, os.path.basename(template_path), os.path.basename(regions_path),
             len(ordered["regions"]), len(ordered.get("flows", {})),
             ordered["canvas"][0], ordered["canvas"][1], ordered["max_strokes"], ordered["seed"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
