#!/usr/bin/env python3
"""Draw a coordinate grid over a photo, and optionally the region shapes on top.

Read coordinates off the photo before you draw a new regions file:
    python grid_overlay.py --image work/lake/photo_1440x1920.png --out work/lake/grid.png

Check the shapes you drew, region by region or all at once:
    python grid_overlay.py --image work/lake/photo_1440x1920.png \
        --regions regions/portrait_at_the_lake.json --out work/lake/regions.png
    python grid_overlay.py --image ... --regions ... --only face hair_left --out face.png

Crop in on the face while you place the small shapes:
    python grid_overlay.py --image ... --crop 380 520 1060 1240 --out face_grid.png

The grid lines are every --step pixels (120 by default), labelled in plan-space
coordinates, so a number you read off the picture goes straight into the json.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np

COLORS = [(66, 133, 244), (219, 68, 55), (244, 180, 0), (15, 157, 88), (171, 71, 188),
          (255, 112, 67), (0, 172, 193), (124, 179, 66), (240, 98, 146), (121, 85, 72)]


def draw_grid(img, step, ox=0, oy=0):
    h, w = img.shape[:2]
    over = img.copy()
    for x in range(0, w + 1, step):
        heavy = ((x + ox) // step) % 5 == 0
        cv2.line(over, (x, 0), (x, h), (255, 255, 255), 2 if heavy else 1)
        cv2.line(over, (x, 0), (x, h), (0, 0, 0), 1)
    for y in range(0, h + 1, step):
        heavy = ((y + oy) // step) % 5 == 0
        cv2.line(over, (0, y), (w, y), (255, 255, 255), 2 if heavy else 1)
        cv2.line(over, (0, y), (w, y), (0, 0, 0), 1)
    img = cv2.addWeighted(over, 0.55, img, 0.45, 0)
    for x in range(0, w + 1, step):
        for y in range(0, h + 1, step):
            if ((x + ox) // step) % 2 or ((y + oy) // step) % 2:
                continue
            label = "%d,%d" % (x + ox, y + oy)
            cv2.putText(img, label, (x + 4, y + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 3, cv2.LINE_AA)
            cv2.putText(img, label, (x + 4, y + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    return img


def polys_of(region):
    out = []
    if "poly" in region:
        out.append(region["poly"])
    for p in region.get("polys", []):
        out.append(p)
    if "rect" in region:
        x0, y0, x1, y1 = region["rect"]
        out.append([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    return out


def draw_regions(img, regions, only, ox=0, oy=0):
    names = [n for n in regions if not only or n in only]
    for i, name in enumerate(names):
        color = COLORS[i % len(COLORS)]
        first = None
        for poly in polys_of(regions[name]):
            pts = np.array([[int(round(x)) - ox, int(round(y)) - oy] for x, y in poly], np.int32)
            cv2.polylines(img, [pts], True, (0, 0, 0), 5, cv2.LINE_AA)
            cv2.polylines(img, [pts], True, color, 3, cv2.LINE_AA)
            if first is None:
                first = pts[0]
        if first is not None:
            cv2.putText(img, name, tuple(first + np.array([6, -8])), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 4, cv2.LINE_AA)
            cv2.putText(img, name, tuple(first + np.array([6, -8])), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2, cv2.LINE_AA)
    return img


def main(argv=None):
    ap = argparse.ArgumentParser(description="grid and region overlay for drawing a regions file")
    ap.add_argument("--image", required=True, help="the photo, in plan space (1440x1920)")
    ap.add_argument("--out", required=True, help="the png to write")
    ap.add_argument("--regions", default=None, help="a regions json or a direction json, to draw on top")
    ap.add_argument("--only", nargs="*", default=None, help="draw only these region names")
    ap.add_argument("--flows", action="store_true", help="draw the flow curves too")
    ap.add_argument("--step", type=int, default=120, help="grid spacing in pixels (default 120)")
    ap.add_argument("--crop", nargs=4, type=int, default=None, metavar=("X0", "Y0", "X1", "Y1"))
    a = ap.parse_args(argv)

    img = cv2.imread(a.image, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit("error: cannot read %s" % a.image)
    ox = oy = 0
    if a.crop:
        x0, y0, x1, y1 = a.crop
        img = img[y0:y1, x0:x1].copy()
        ox, oy = x0, y0
        if img.size == 0:
            raise SystemExit("error: the crop is empty")

    img = draw_grid(img, a.step, ox, oy)

    if a.regions:
        with open(a.regions) as fh:
            data = json.load(fh)
        regions = data.get("regions", data)
        img = draw_regions(img, regions, set(a.only or []), ox, oy)
        if a.flows:
            for name, flow in (data.get("flows") or {}).items():
                for curve in flow.get("curves", []):
                    pts = np.array([[int(round(x)) - ox, int(round(y)) - oy] for x, y in curve], np.int32)
                    cv2.polylines(img, [pts], False, (0, 0, 0), 6, cv2.LINE_AA)
                    cv2.polylines(img, [pts], False, (255, 255, 255), 3, cv2.LINE_AA)

    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    cv2.imwrite(a.out, img)
    print("%s (%dx%d)" % (a.out, img.shape[1], img.shape[0]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
