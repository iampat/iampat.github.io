#!/usr/bin/env python3
"""painter.py - the stroke placer (contract: apps/paint/work/v3/PAINTER_SPEC.md, Part A).

Reads an art direction json (regions, flow fields, layers) and writes an action
list for engine.js, a numpy preview of that action list, an error heatmap and
two reports.

    python painter.py --direction <dir.json> --out <run dir> [--target <png>]
                      [--ref <png>] [--seed 7]

No LLM is in the loop. Everything here is deterministic: the numpy RNG of each
layer is seeded from (seed, layer index), so the same json gives the same
actions byte for byte.
"""

import argparse
import json
import math
import os
import sys
import time
import zlib

import cv2
import numpy as np

CANVAS_W, CANVAS_H = 720, 960
BG = (255.0, 255.0, 255.0)
TOOLS = ("brush", "pencil", "bristle", "spray", "eraser")


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def hex_of(rgb):
    out = "#"
    for v in rgb[:3]:
        out += "%02x" % int(np.clip(round(float(v)), 0, 255))
    return out


def rgb_of(hexs):
    s = str(hexs or "#000000").strip().lstrip("#")
    if len(s) == 3:
        s = s[0] * 2 + s[1] * 2 + s[2] * 2
    n = int(s, 16)
    return np.array([(n >> 16) & 255, (n >> 8) & 255, n & 255], np.float32)


def as_range(v, fallback=None):
    """A json value that is either a number or [min, max]."""
    if v is None:
        return fallback
    if isinstance(v, (list, tuple)):
        return (float(v[0]), float(v[1]))
    return (float(v), float(v))


def pick(rng, rng_pair):
    lo, hi = rng_pair
    if hi <= lo:
        return lo
    return float(rng.uniform(lo, hi))


def clamp(v, lo, hi):
    return lo if v < lo else (hi if v > hi else v)


def to_lab(rgb_float):
    """rgb in 0..255 float -> CIE Lab (L 0..100)."""
    return cv2.cvtColor(np.ascontiguousarray(rgb_float, np.float32) / 255.0, cv2.COLOR_RGB2LAB)


def load_rgb(path, w, h):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit("painter: cannot read image " + str(path))
    if img.shape[1] != w or img.shape[0] != h:
        img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def bbox_of(pts, pad, w, h):
    a = np.asarray(pts, np.float64)
    x0 = int(math.floor(a[:, 0].min() - pad))
    y0 = int(math.floor(a[:, 1].min() - pad))
    x1 = int(math.ceil(a[:, 0].max() + pad))
    y1 = int(math.ceil(a[:, 1].max() + pad))
    return (max(0, x0), max(0, y0), min(w, max(0, x1)), min(h, max(0, y1)))


def path_length(pts):
    a = np.asarray(pts, np.float64)
    if len(a) < 2:
        return 0.0
    d = np.diff(a, axis=0)
    return float(np.sqrt((d * d).sum(axis=1)).sum())


# --------------------------------------------------------------------------
# regions
# --------------------------------------------------------------------------

class Regions:
    """Named masks built from the director's loose shapes."""

    def __init__(self, spec, w, h):
        self.spec = spec or {}
        self.w = w
        self.h = h
        self._cache = {}
        self._busy = set()

    def _fill(self, mask, poly):
        p = np.round(np.asarray(poly, np.float64)).astype(np.int32)
        if len(p) >= 3:
            cv2.fillPoly(mask, [p], 1, cv2.LINE_8)

    def mask(self, name):
        if name in self._cache:
            return self._cache[name]
        if name not in self.spec:
            raise SystemExit("painter: unknown region " + str(name))
        if name in self._busy:
            raise SystemExit("painter: region " + str(name) + " refers to itself")
        self._busy.add(name)
        spec = self.spec[name]
        m = np.zeros((self.h, self.w), np.uint8)
        if "poly" in spec:
            self._fill(m, spec["poly"])
        if "polys" in spec:
            for poly in spec["polys"]:
                self._fill(m, poly)
        if "rect" in spec:
            x0, y0, x1, y1 = [int(round(float(v))) for v in spec["rect"]]
            cv2.rectangle(m, (x0, y0), (x1, y1), 1, -1)
        for other in spec.get("minus", []):
            m[self.mask(other) > 0] = 0
        self._busy.discard(name)
        self._cache[name] = m
        return m

    def polys(self, name):
        """The director's polygons of a region (rect becomes one polygon; minus is ignored)."""
        if name not in self.spec:
            raise SystemExit("painter: unknown region " + str(name))
        spec = self.spec[name]
        out = []
        if "poly" in spec:
            out.append([[float(x), float(y)] for x, y in spec["poly"]])
        for poly in spec.get("polys", []):
            out.append([[float(x), float(y)] for x, y in poly])
        if "rect" in spec:
            x0, y0, x1, y1 = [float(v) for v in spec["rect"]]
            out.append([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
        return out


# --------------------------------------------------------------------------
# flow fields
# --------------------------------------------------------------------------

def catmull_rom(points, step=2.0):
    """Sample a Catmull-Rom spline through the points. Returns (pos, tangent)."""
    P = np.asarray(points, np.float64)
    if len(P) < 2:
        return P.reshape(-1, 2), np.tile(np.array([1.0, 0.0]), (len(P), 1))
    ext = np.vstack([P[0] + (P[0] - P[1]), P, P[-1] + (P[-1] - P[-2])])
    pos, tan = [], []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        seg = float(np.linalg.norm(p2 - p1))
        n = max(2, int(seg / max(0.5, step)) + 1)
        t = np.linspace(0.0, 1.0, n, endpoint=False)[:, None]
        a = 2 * p1
        b = -p0 + p2
        c = 2 * p0 - 5 * p1 + 4 * p2 - p3
        d = -p0 + 3 * p1 - 3 * p2 + p3
        pos.append(0.5 * (a + b * t + c * t * t + d * t * t * t))
        tan.append(0.5 * (b + 2 * c * t + 3 * d * t * t))
    # close with the last control point
    p0, p1, p2, p3 = ext[-4], ext[-3], ext[-2], ext[-1]
    pos.append(P[-1][None, :])
    tan.append((0.5 * (-p0 + 3 * p1 - 3 * p2 + p3) * 3 + 0.5 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * 2
                + 0.5 * (-p0 + p2))[None, :])
    return np.vstack(pos), np.vstack(tan)


def build_flow_field(curves, w, h):
    """At any pixel the direction is the tangent of the nearest guide curve.

    The nearest-curve lookup is exact: the curve samples are written into a
    mask and cv2.distanceTransformWithLabels hands back, for every pixel, the
    label of the nearest sample.
    """
    pos, tan = [], []
    for c in curves:
        p, t = catmull_rom(c)
        pos.append(p)
        tan.append(t)
    P = np.vstack(pos)
    T = np.vstack(tan)
    n = np.sqrt((T * T).sum(axis=1))
    n[n < 1e-9] = 1.0
    T = T / n[:, None]
    # keep one hemisphere so neighbouring samples do not cancel each other
    flip = T[:, 0] < 0
    T[flip] *= -1.0

    xi = np.clip(np.round(P[:, 0]).astype(np.int64), 0, w - 1)
    yi = np.clip(np.round(P[:, 1]).astype(np.int64), 0, h - 1)
    acc = np.zeros((h * w, 2), np.float64)
    flat = yi * w + xi
    np.add.at(acc, flat, T)
    seed = np.zeros(h * w, bool)
    seed[flat] = True

    src = np.where(seed.reshape(h, w), 0, 255).astype(np.uint8)
    _dist, labels = cv2.distanceTransformWithLabels(
        src, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(src == 0)
    labs = labels[ys, xs].astype(np.int64)
    lut = np.zeros((int(labels.max()) + 1, 2), np.float32)
    lut[labs] = acc.reshape(h, w, 2)[ys, xs]
    field = lut[labels]
    fn = np.sqrt((field * field).sum(axis=2))
    fn[fn < 1e-9] = 1.0
    return (field / fn[:, :, None]).astype(np.float32)


def build_gradient_field(target_rgb, size_mean):
    """Along the target's edges: perpendicular to the image gradient.

    A smoothed structure tensor gives the orientation, so flat areas still get
    a stable direction instead of gradient noise.
    """
    grey = cv2.cvtColor(target_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    pre = max(1.0, size_mean / 4.0)
    post = max(2.0, size_mean / 2.0)
    g = cv2.GaussianBlur(grey, (0, 0), pre)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), post)
    jxy = cv2.GaussianBlur(gx * gy, (0, 0), post)
    jyy = cv2.GaussianBlur(gy * gy, (0, 0), post)
    theta = 0.5 * np.arctan2(2.0 * jxy, jxx - jyy)   # dominant gradient angle
    field = np.stack([-np.sin(theta), np.cos(theta)], axis=2)  # 90 deg off it
    return field.astype(np.float32)


# --------------------------------------------------------------------------
# the numpy renderer (close to engine.js, not identical)
# --------------------------------------------------------------------------

_DAB_CACHE = {}


def dab_kernel(r):
    """Soft round dab: solid to 35% of the radius, then a fade to 0 at the edge."""
    key = int(round(r * 4))
    k = _DAB_CACHE.get(key)
    if k is not None:
        return k
    rr = max(0.6, key / 4.0)
    n = int(math.ceil(rr))
    ax = np.arange(-n, n + 1, dtype=np.float32)
    d = np.sqrt(ax[None, :] ** 2 + ax[:, None] ** 2)
    a = np.clip((1.0 - (d / rr - 0.35) / 0.65), 0.0, 1.0).astype(np.float32)
    a[d > rr] = 0.0
    _DAB_CACHE[key] = a
    return a


def walk_path(pts, step):
    """Every `step` px along the polyline, start included (engine.js walk())."""
    step = max(0.5, step)
    out = [(pts[0][0], pts[0][1])]
    carry = 0.0
    for i in range(1, len(pts)):
        ax, ay = pts[i - 1]
        dx, dy = pts[i][0] - ax, pts[i][1] - ay
        ln = math.hypot(dx, dy)
        if ln < 1e-6:
            continue
        ux, uy = dx / ln, dy / ln
        t = step - carry
        while t <= ln:
            out.append((ax + ux * t, ay + uy * t))
            t += step
        carry = ln - (t - step)
    return out


def dir_at(pts, j):
    a = pts[max(0, j - 1)]
    b = pts[min(len(pts) - 1, j + 1)]
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy)
    if ln < 1e-6:
        return (1.0, 0.0)
    return (dx / ln, dy / ln)


class Layer:
    """One action's own layer: premultiplied colour + coverage, composited once."""

    def __init__(self, box):
        self.x0, self.y0, self.x1, self.y1 = box
        h = max(0, self.y1 - self.y0)
        w = max(0, self.x1 - self.x0)
        self.w, self.h = w, h
        self.P = np.zeros((h, w, 3), np.float32)
        self.A = np.zeros((h, w), np.float32)

    def empty(self):
        return self.w <= 0 or self.h <= 0

    def add(self, x, y, alpha, colour):
        """Source-over one element (alpha patch at layer coords x,y)."""
        ah, aw = alpha.shape
        sx0, sy0 = max(0, x), max(0, y)
        sx1, sy1 = min(self.w, x + aw), min(self.h, y + ah)
        if sx1 <= sx0 or sy1 <= sy0:
            return
        a = alpha[sy0 - y:sy1 - y, sx0 - x:sx1 - x]
        P = self.P[sy0:sy1, sx0:sx1]
        A = self.A[sy0:sy1, sx0:sx1]
        inv = 1.0 - a
        A *= inv
        A += a
        P *= inv[:, :, None]
        P += a[:, :, None] * np.asarray(colour, np.float32)[None, None, :]

    def add_full(self, alpha, colour):
        self.add(0, 0, alpha, colour)

    def composite(self, canvas, galpha):
        if self.empty():
            return
        g = float(clamp(galpha, 0.0, 1.0))
        sub = canvas[self.y0:self.y1, self.x0:self.x1]
        w = (self.A * g)[:, :, None]
        sub *= (1.0 - w)
        sub += self.P * g


def aa_mask(h, w, draw):
    m = np.zeros((h, w), np.uint8)
    draw(m)
    return m.astype(np.float32) / 255.0


def render_stroke(canvas, action, rng, w, h):
    """Render one stroke action into the canvas. Mirrors engine.js closely."""
    pts = [(float(p[0]), float(p[1])) for p in action["pts"]]
    if len(pts) == 1:
        pts.append((pts[0][0] + 0.01, pts[0][1]))
    size = max(0.5, float(action.get("size", 1)))
    tool = action.get("tool", "pencil")
    alpha = 1.0 if action.get("alpha") is None else float(action["alpha"])
    colour = BG if tool == "eraser" else rgb_of(action.get("color", "#000000"))
    lay = Layer(bbox_of(pts, size + 6.0, w, h))
    if lay.empty():
        return
    ox, oy = lay.x0, lay.y0
    local = [(p[0] - ox, p[1] - oy) for p in pts]

    if tool == "brush":
        r = max(0.6, size / 2.0)
        k = dab_kernel(r)
        n = k.shape[0] // 2
        for (x, y) in walk_path(local, max(0.5, size / 4.0)):
            lay.add(int(round(x)) - n, int(round(y)) - n, k, colour)

    elif tool == "spray":
        # dots of alpha 0.15 in a disc of radius size/2, every 3 px along the path.
        # All dots share one colour, so overlapping source-over collapses to
        # A = 1 - 0.85**hits; that keeps a 30k-dot stroke fast and exact.
        R = max(1.0, size / 2.0)
        nd = max(4, int(round(size)))
        steps = walk_path(local, 3.0)
        total = len(steps) * nd
        ang = rng.random(total) * (2 * math.pi)
        rad = R * np.power(rng.random(total), 0.75)
        two = rng.random(total) >= 0.5
        cx = np.repeat(np.array([p[0] for p in steps], np.float64), nd)
        cy = np.repeat(np.array([p[1] for p in steps], np.float64), nd)
        px = np.round(cx + np.cos(ang) * rad).astype(np.int64)
        py = np.round(cy + np.sin(ang) * rad).astype(np.int64)
        hits = np.zeros(lay.h * lay.w, np.float32)
        for dx in (0, 1):
            for dy in (0, 1):
                if dx or dy:
                    sel = two
                else:
                    sel = np.ones(total, bool)
                qx, qy = px[sel] + dx, py[sel] + dy
                ok = (qx >= 0) & (qx < lay.w) & (qy >= 0) & (qy < lay.h)
                if ok.any():
                    hits += np.bincount(qy[ok] * lay.w + qx[ok],
                                        minlength=lay.h * lay.w).astype(np.float32)
        cov = (1.0 - np.power(0.85, hits)).reshape(lay.h, lay.w)
        lay.add_full(cov, colour)

    elif tool == "bristle":
        k = int(round(clamp(size / 3.0, 3, 14)))
        span = max(2.0, size)
        for b in range(k):
            off = (0.0 if k == 1 else (b / (k - 1.0) - 0.5)) * span
            shade = 1.0 + (float(rng.random()) - 0.5) * 0.16
            width = max(1, int(round(1.0 + float(rng.random()))))
            line = []
            for j in range(len(local)):
                dx, dy = dir_at(local, j)
                o = off + (float(rng.random()) - 0.5) * 1.6
                line.append((local[j][0] - dy * o + (float(rng.random()) - 0.5) * 0.8,
                             local[j][1] + dx * o + (float(rng.random()) - 0.5) * 0.8))
            arr = np.round(np.array(line, np.float64)).astype(np.int32)
            m = aa_mask(lay.h, lay.w,
                        lambda img, a=arr, wd=width: cv2.polylines(img, [a], False, 255, wd, cv2.LINE_AA))
            lay.add_full(m, np.clip(np.asarray(colour, np.float32) * shade, 0, 255))

    else:  # pencil and eraser: a hard line of width `size`
        arr = np.round(np.array(local, np.float64)).astype(np.int32)
        wd = max(1, int(round(size)))
        m = aa_mask(lay.h, lay.w,
                    lambda img: cv2.polylines(img, [arr], False, 255, wd, cv2.LINE_AA))
        lay.add_full(m, colour)

    lay.composite(canvas, alpha)


def render_action(canvas, action, rng, w, h):
    t = action.get("t")
    if t == "mark":
        return
    if t == "clear":
        canvas[:, :, :] = rgb_of(action.get("color", "#ffffff"))[None, None, :]
        return
    if t == "stroke":
        render_stroke(canvas, action, rng, w, h)
        return
    alpha = 1.0 if action.get("alpha") is None else float(action["alpha"])
    if t == "poly":
        pts = np.round(np.array(action["pts"], np.float64)).astype(np.int32)
        lay = Layer(bbox_of(pts, 3.0, w, h))
        if lay.empty():
            return
        local = pts - np.array([lay.x0, lay.y0], np.int32)
        m = aa_mask(lay.h, lay.w, lambda img: (cv2.fillPoly(img, [local], 255, cv2.LINE_AA),
                                               cv2.polylines(img, [local], True, 255, 1, cv2.LINE_AA)))
        lay.add_full(m, rgb_of(action.get("color", "#000000")))
        lay.composite(canvas, alpha)
        return
    if t == "ellipse":
        cx, cy = float(action.get("cx", 0)), float(action.get("cy", 0))
        rx = max(0.5, float(action.get("rx", 0)))
        ry = max(0.5, float(action.get("ry", 0)))
        m2 = max(rx, ry) + 3.0
        lay = Layer(bbox_of([(cx - m2, cy - m2), (cx + m2, cy + m2)], 0.0, w, h))
        if lay.empty():
            return
        ang = math.degrees(float(action.get("rot", 0)))
        c = (int(round(cx - lay.x0)), int(round(cy - lay.y0)))
        ax = (max(1, int(round(rx))), max(1, int(round(ry))))
        m = aa_mask(lay.h, lay.w, lambda img: (cv2.ellipse(img, c, ax, ang, 0, 360, 255, -1, cv2.LINE_AA),
                                               cv2.ellipse(img, c, ax, ang, 0, 360, 255, 1, cv2.LINE_AA)))
        lay.add_full(m, rgb_of(action.get("color", "#000000")))
        lay.composite(canvas, alpha)
        return
    if t == "bucket":
        # FIXED_RANGE: engine.js measures the tolerance against the seed colour
        tol = int(action.get("tol", 32))
        img = np.clip(canvas, 0, 255).astype(np.uint8)
        flood = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(img.copy(), flood, (int(round(float(action["x"]))), int(round(float(action["y"])))),
                      255, (tol, tol, tol), (tol, tol, tol),
                      4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8))
        sel = flood[1:h + 1, 1:w + 1] > 0
        col = rgb_of(action.get("color", "#000000"))
        canvas[sel] = canvas[sel] * (1.0 - alpha) + col[None, :] * alpha
        return
    raise SystemExit("painter: unknown action type " + repr(t))


# --------------------------------------------------------------------------
# palettes
# --------------------------------------------------------------------------

def palette_centers(target_lab, mask, k, seed, rng):
    pts = target_lab[mask > 0]
    if len(pts) == 0 or k <= 0:
        return None
    if len(pts) > 20000:
        idx = rng.choice(len(pts), 20000, replace=False)
        pts = pts[idx]
    k = int(min(k, len(np.unique(np.round(pts, 1), axis=0))))
    if k <= 1:
        return pts.mean(axis=0, keepdims=True).astype(np.float32)
    cv2.setRNGSeed(int(seed) & 0x7fffffff)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _c, _l, centers = cv2.kmeans(np.ascontiguousarray(pts, np.float32), k, None,
                                 crit, 3, cv2.KMEANS_PP_CENTERS)
    return centers.astype(np.float32)


def snap_rgb(rgb, centers_lab):
    if centers_lab is None:
        return rgb
    lab = cv2.cvtColor(np.asarray(rgb, np.float32).reshape(1, 1, 3) / 255.0,
                       cv2.COLOR_RGB2LAB).reshape(3)
    d = centers_lab - lab[None, :]
    i = int(np.argmin((d * d).sum(axis=1)))
    back = cv2.cvtColor(centers_lab[i].reshape(1, 1, 3), cv2.COLOR_LAB2RGB).reshape(3)
    return np.clip(back * 255.0, 0, 255)


def quantize_lab(lab_img, centers):
    flat = lab_img.reshape(-1, 3)
    out = np.empty(len(flat), np.int32)
    step = 200000
    for i in range(0, len(flat), step):
        chunk = flat[i:i + step]
        d = ((chunk[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        out[i:i + step] = np.argmin(d, axis=1)
    return centers[out].reshape(lab_img.shape)


# --------------------------------------------------------------------------
# stroke geometry
# --------------------------------------------------------------------------

def build_path(sx, sy, dir_fn, length, curvature, jitter, rng, inside_fn):
    """A path of 5..11 points, centred on (sx, sy), following the direction
    field, bent by curvature and shaken by jitter. Stops where inside_fn fails."""
    steps = int(clamp(round(length / 60.0) + 2, 2, 5))
    seg = length / (2.0 * steps)
    bend = (float(rng.random()) - 0.5) * 2.0 * curvature * 1.2 / steps
    d0 = dir_fn(sx, sy)
    ang0 = math.atan2(d0[1], d0[0])
    halves = []
    for sign in (1.0, -1.0):
        pts = [(sx, sy)]
        cur = ang0 if sign > 0 else ang0 + math.pi
        x, y = sx, sy
        for k in range(steps):
            fd = dir_fn(x, y)
            fang = math.atan2(fd[1], fd[0])
            if math.cos(fang - cur) < 0:
                fang += math.pi
            ang = fang + sign * bend * (k + 1) + (float(rng.random()) - 0.5) * jitter
            nx = x + math.cos(ang) * seg
            ny = y + math.sin(ang) * seg
            if inside_fn is not None and not inside_fn(nx, ny):
                break
            cur = ang
            x, y = nx, ny
            pts.append((x, y))
        halves.append(pts)
    fwd, back = halves
    return back[::-1] + fwd[1:]


def resample_path(pts, n):
    """n points spread evenly by arc length along the same polyline."""
    a = np.asarray(pts, np.float64)
    seg = np.sqrt((np.diff(a, axis=0) ** 2).sum(axis=1))
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    if cum[-1] <= 0:
        return [(float(a[0][0]), float(a[0][1]))] * int(n)
    t = np.linspace(0.0, cum[-1], int(n))
    x = np.interp(t, cum, a[:, 0])
    y = np.interp(t, cum, a[:, 1])
    return [(float(u), float(v)) for u, v in zip(x, y)]


def clip_to_inside(pts, inside_fn, steps=8):
    """Quantize a path to the emit precision and pull stray points back inside.

    Two things get a point past build_path's own check. build_path only tests
    its vertices, so the straight segment between two good ones can cut a corner
    outside the region, and a resample puts a real point on that corner. And the
    action carries one decimal, so rounding can step a point over a pixel edge.
    Both are handled here: every point is tested at the precision it is emitted
    at, and a bad one is bisected back towards the last good point until it sits
    inside the region again. What the action carries is what was checked."""
    if inside_fn is None:
        return [(round(float(x), 1), round(float(y), 1)) for (x, y) in pts]
    out = []
    anchor = None
    for (x, y) in pts:
        px, py = round(float(x), 1), round(float(y), 1)
        if inside_fn(px, py):
            out.append((px, py))
            anchor = (px, py)
            continue
        if anchor is None:
            continue                      # no good point yet: drop this one
        ax, ay = anchor
        lo, hi, best = 0.0, 1.0, anchor   # lo is inside, hi is outside
        for _k in range(steps):
            mid = 0.5 * (lo + hi)
            mx = round(ax + (px - ax) * mid, 1)
            my = round(ay + (py - ay) * mid, 1)
            if inside_fn(mx, my):
                lo, best = mid, (mx, my)
            else:
                hi = mid
        out.append(best)
    return out


def footprint_color(target, pts, size, region_mask, w, h):
    box = bbox_of(pts, size / 2.0 + 2.0, w, h)
    x0, y0, x1, y1 = box
    if x1 <= x0 or y1 <= y0:
        return target[int(clamp(pts[0][1], 0, h - 1)), int(clamp(pts[0][0], 0, w - 1))].astype(np.float32)
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    arr = np.round(np.array(pts, np.float64) - [x0, y0]).astype(np.int32)
    cv2.polylines(m, [arr], False, 255, max(1, int(round(size))), cv2.LINE_8)
    sel = m > 0
    if region_mask is not None:
        sub = region_mask[y0:y1, x0:x1] > 0
        both = sel & sub
        if both.any():
            sel = both
    if not sel.any():
        return target[int(clamp(pts[0][1], 0, h - 1)), int(clamp(pts[0][0], 0, w - 1))].astype(np.float32)
    return target[y0:y1, x0:x1][sel].astype(np.float32).mean(axis=0)


# --------------------------------------------------------------------------
# the placer
# --------------------------------------------------------------------------

class Painter:
    def __init__(self, direction, out_dir, ref_path, target_path, seed):
        self.dir = direction
        self.out = out_dir
        cw, ch = direction.get("canvas", [CANVAS_W, CANVAS_H])
        self.w, self.h = int(cw), int(ch)
        self.seed = int(seed)
        self.ref = load_rgb(ref_path, self.w, self.h)
        self.stylized = False
        if target_path:
            self.target = load_rgb(target_path, self.w, self.h)
        elif direction.get("stylize"):
            self.target = self.make_stylized(direction["stylize"])
            self.stylized = True
        else:
            self.target = self.ref.copy()
        self.target_f = self.target.astype(np.float32)
        self.target_lab = to_lab(self.target_f)
        self.ref_lab = to_lab(self.ref.astype(np.float32))
        hw, hh = self.w // 2, self.h // 2
        self.half_target_lab = to_lab(cv2.resize(self.target_f, (hw, hh),
                                                 interpolation=cv2.INTER_AREA))
        self.regions = Regions(direction.get("regions", {}), self.w, self.h)
        self.flows = {}
        self.grad_fields = {}
        self.pal_cache = {}
        self.canvas = np.empty((self.h, self.w, 3), np.float32)
        self.canvas[:, :, :] = np.array(BG, np.float32)[None, None, :]
        self.actions = []
        self.reports = []

    # -- target ------------------------------------------------------------
    def make_stylized(self, spec):
        bgr = cv2.cvtColor(self.ref, cv2.COLOR_RGB2BGR)
        st = cv2.stylization(bgr, sigma_s=float(spec.get("sigma_s", 60)),
                             sigma_r=float(spec.get("sigma_r", 0.45)))
        rgb = cv2.cvtColor(st, cv2.COLOR_BGR2RGB)
        k = int(spec.get("k", 0))
        if k > 0:
            lab = to_lab(rgb.astype(np.float32))
            rng = np.random.default_rng(self.seed)
            centers = palette_centers(lab, np.ones((self.h, self.w), np.uint8), k, self.seed, rng)
            lab = quantize_lab(lab, centers)
            rgb = np.clip(cv2.cvtColor(lab, cv2.COLOR_LAB2RGB) * 255.0, 0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(self.out, "target.png"), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        return rgb

    # -- fields ------------------------------------------------------------
    def flow_field(self, name):
        if name not in self.flows:
            spec = (self.dir.get("flows") or {}).get(name)
            if not spec:
                raise SystemExit("painter: unknown flow " + str(name))
            self.flows[name] = build_flow_field(spec["curves"], self.w, self.h)
        return self.flows[name]

    def gradient_field(self, size_mean):
        key = int(round(size_mean))
        if key not in self.grad_fields:
            self.grad_fields[key] = build_gradient_field(self.target, float(key))
        return self.grad_fields[key]

    def dir_fn_for(self, layer, size_mean):
        mode = layer.get("direction", "horizontal")
        if mode == "horizontal":
            return lambda x, y: (1.0, 0.0)
        if mode == "vertical":
            return lambda x, y: (0.0, 1.0)
        if mode == "angle":
            a = math.radians(float(layer.get("angle", 0)))
            v = (math.cos(a), math.sin(a))
            return lambda x, y: v
        if mode == "gradient":
            f = self.gradient_field(size_mean)
        elif mode == "flow":
            f = self.flow_field(layer.get("flow"))
        else:
            raise SystemExit("painter: unknown direction " + repr(mode))
        w, h = self.w, self.h

        def fn(x, y):
            xi = int(x) if 0 <= x < w else int(clamp(x, 0, w - 1))
            yi = int(y) if 0 <= y < h else int(clamp(y, 0, h - 1))
            v = f[yi, xi]
            return (float(v[0]), float(v[1]))
        return fn

    # -- error -------------------------------------------------------------
    def region_error(self, mask):
        lab = to_lab(self.canvas)
        d = lab - self.target_lab
        de = np.sqrt((d * d).sum(axis=2))
        sel = mask > 0
        if not sel.any():
            return 0.0
        return float(de[sel].mean())

    def box_error(self, box, mask):
        x0, y0, x1, y1 = box
        if x1 <= x0 or y1 <= y0:
            return 0.0
        lab = to_lab(self.canvas[y0:y1, x0:x1])
        d = lab - self.target_lab[y0:y1, x0:x1]
        de = np.sqrt((d * d).sum(axis=2))
        if mask is not None:
            sel = mask[y0:y1, x0:x1] > 0
            if sel.any():
                return float(de[sel].sum())
            return 0.0
        return float(de.sum())

    # -- palette -----------------------------------------------------------
    def palette(self, region_name, mask, k):
        """One palette per (region, K). Layers that share a region and a K share
        one k-means result on purpose: they paint the same thing, so their
        colours have to agree. The palette is a pure function of seed, region
        and K, not of which layer asked for it first."""
        if not k:
            return None
        key = (region_name, int(k))
        if key not in self.pal_cache:
            tag = int(zlib.crc32(str(region_name).encode("utf-8")))
            prng = np.random.default_rng([self.seed, int(k), tag])
            self.pal_cache[key] = palette_centers(self.target_lab, mask, int(k),
                                                  self.seed * 131 + int(k), prng)
        return self.pal_cache[key]

    # -- one stroke --------------------------------------------------------
    def emit(self, action):
        rng = np.random.default_rng([self.seed, len(self.actions)])
        render_action(self.canvas, action, rng, self.w, self.h)
        self.actions.append(action)

    def stroke_action(self, tool, pts, size, alpha, colour):
        return {
            "t": "stroke", "tool": tool, "color": hex_of(colour),
            "size": round(float(size), 2), "alpha": round(float(alpha), 3),
            "pts": [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in pts],
        }

    # -- layers ------------------------------------------------------------
    def run(self):
        t_all = time.time()
        # toned ground: "ground": "#rrggbb" | "auto" (mean colour of the target) | absent (white)
        ground = self.dir.get("ground")
        if ground == "auto":
            m = self.target_f.reshape(-1, 3).mean(axis=0)
            ground = "#%02x%02x%02x" % tuple(int(round(float(v))) for v in m)
        self.emit({"t": "clear", "color": ground or "#ffffff"})
        for li, layer in enumerate(self.dir.get("layers", [])):
            t0 = time.time()
            name = layer.get("name", "layer%d" % li)
            rng = np.random.default_rng([self.seed, li])
            if "actions" in layer:
                mask = None
                before = self.region_error(np.ones((self.h, self.w), np.uint8))
                for a in layer["actions"]:
                    self.emit(a)
                after = self.region_error(np.ones((self.h, self.w), np.uint8))
                tried = kept = len(layer["actions"])
                tool = mode = "literal"
                region = "-"
            else:
                region = layer.get("region")
                mask = self.regions.mask(region)
                before = self.region_error(mask)
                tool = layer.get("tool", "brush")
                mode = layer.get("mode", "block")
                if mode == "block":
                    tried, kept = self.layer_block(layer, li, mask, rng)
                elif mode == "refine":
                    tried, kept = self.layer_refine(layer, li, mask, rng)
                elif mode == "fill":
                    tried, kept = self.layer_fill(layer, li, mask, rng)
                else:
                    raise SystemExit("painter: unknown mode " + repr(mode))
                after = self.region_error(mask)
            self.emit({"t": "mark", "name": name})
            secs = time.time() - t0
            self.reports.append({
                "index": li, "name": name, "region": region, "tool": tool, "mode": mode,
                "tried": tried, "kept": kept, "error_before": round(before, 3),
                "error_after": round(after, 3), "seconds": round(secs, 2),
            })
            print("[%2d] %-16s %-10s %-8s %-6s tried=%-4d kept=%-4d  dE %6.2f -> %6.2f  %5.2fs"
                  % (li, name, str(region), tool, mode, tried, kept, before, after, secs),
                  flush=True)
        self.seconds = time.time() - t_all
        return self.actions

    def layer_fill(self, layer, li, mask, rng):
        """MS Paint polygon fill: one poly action per director polygon of the region,
        in the mean colour of the target inside the region (snapped to the layer
        palette when one is set). Guarantees coverage before the strokes."""
        region = layer.get("region")
        polys = self.regions.polys(region)
        if not polys or not mask.any():
            return 0, 0
        col = self.target[mask > 0].astype(np.float32).mean(axis=0)
        k = int(layer.get("palette", 0) or 0)
        if k > 0:
            col = snap_rgb(col, self.palette(region, mask, k))
        vs = float(layer.get("value_shift", 0.0))
        if vs:
            col = np.clip(np.asarray(col, np.float32) * (1.0 + vs), 0, 255)
        alpha = pick(rng, as_range(layer.get("alpha"), (1.0, 1.0)))
        hexcol = "#%02x%02x%02x" % tuple(int(round(float(v))) for v in col)
        for poly in polys:
            self.emit({"t": "poly", "color": hexcol, "alpha": round(float(alpha), 3),
                       "pts": [[round(x, 1), round(y, 1)] for x, y in poly]})
        return len(polys), len(polys)

    def layer_params(self, layer):
        size_r = as_range(layer.get("size"), (12.0, 12.0))
        alpha_r = as_range(layer.get("alpha"), (1.0, 1.0))
        length_r = as_range(layer.get("length"))
        return size_r, alpha_r, length_r

    def inside_fn_for(self, layer, mask):
        clip = layer.get("clip", True)
        overflow = float(layer.get("overflow", 0) or 0)
        if clip is False:
            return None
        m = mask
        if overflow > 0:
            k = int(round(overflow)) * 2 + 1
            m = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        w, h = self.w, self.h

        def inside(x, y):
            xi, yi = int(x), int(y)
            if xi < 0 or yi < 0 or xi >= w or yi >= h:
                return False
            return m[yi, xi] > 0
        return inside

    def make_stroke(self, layer, li, mask, rng, sx, sy, dir_fn, pal, inside):
        size_r, alpha_r, length_r = self.layer_params(layer)
        size = pick(rng, size_r)
        alpha = pick(rng, alpha_r)
        if length_r is None:
            length = pick(rng, (3.0 * size, 6.0 * size))
        else:
            length = pick(rng, length_r)
        curvature = float(layer.get("curvature", 0.15))
        jitter = float(layer.get("jitter", 0.2))
        pts = build_path(sx, sy, dir_fn, length, curvature, jitter, rng, inside)
        if len(pts) < 2 or path_length(pts) < 3.0:
            return None
        # A stroke is a stroke, never a dab: a path clipped down to two or
        # three points is resampled back up to the 4..12 point band.
        if len(pts) < 4:
            pts = resample_path(pts, 4)
        elif len(pts) > 12:
            pts = resample_path(pts, 12)
        # Neither the resample nor the one-decimal emit precision goes through
        # build_path's inside test, so check the path once more as it will ship.
        pts = clip_to_inside(pts, inside)
        if len(pts) < 2:
            return None
        col = footprint_color(self.target, pts, size, mask, self.w, self.h)
        col = snap_rgb(col, pal)
        vs = float(layer.get("value_shift", 0.0))
        if vs:
            col = np.clip(np.asarray(col, np.float32) * (1.0 + vs), 0, 255)
        cj = float(layer.get("color_jitter", 0.0))
        if cj:
            col = np.clip(np.asarray(col, np.float32) * (1.0 + (float(rng.random()) - 0.5) * 2.0 * cj), 0, 255)
        return self.stroke_action(layer.get("tool", "brush"), pts, size, alpha, col)

    def layer_axis(self, layer, mask, size_mean):
        """The nominal stroke axis of a layer, used to shape the block grid."""
        mode = layer.get("direction", "horizontal")
        if mode == "horizontal":
            return (1.0, 0.0)
        if mode == "vertical":
            return (0.0, 1.0)
        if mode == "angle":
            a = math.radians(float(layer.get("angle", 0)))
            return (math.cos(a), math.sin(a))
        f = self.gradient_field(size_mean) if mode == "gradient" else self.flow_field(layer.get("flow"))
        v = f[mask > 0]
        if len(v) == 0:
            return (1.0, 0.0)
        ang2 = 2.0 * np.arctan2(v[:, 1], v[:, 0])   # doubled angle: a direction has no sign
        a = 0.5 * math.atan2(float(np.sin(ang2).mean()), float(np.cos(ang2).mean()))
        return (math.cos(a), math.sin(a))

    def grid_seeds(self, mask, axis, na, nb, rng):
        """A jittered grid of na x nb cells over the region, in the stroke's own
        frame (na along the stroke, nb across it). Seeds sit at cell centres, so
        none of them lands on the region edge where a stroke would die at once."""
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            return []
        P = np.stack([xs, ys], axis=1).astype(np.float64)
        ua = np.array(axis, np.float64)
        va = np.array([-axis[1], axis[0]], np.float64)
        a = P @ ua
        b = P @ va
        a0, ea = float(a.min()), max(1.0, float(a.max() - a.min()))
        b0, eb = float(b.min()), max(1.0, float(b.max() - b.min()))
        ca, cb = ea / na, eb / nb
        seeds = []
        for j in range(nb):
            for i in range(na):
                pa = a0 + (i + 0.5) * ca + (float(rng.random()) - 0.5) * 0.7 * ca
                pb = b0 + (j + 0.5) * cb + (float(rng.random()) - 0.5) * 0.7 * cb
                p = pa * ua + pb * va
                xi = int(clamp(p[0], 0, self.w - 1))
                yi = int(clamp(p[1], 0, self.h - 1))
                if mask[yi, xi] > 0:
                    seeds.append((float(p[0]), float(p[1])))
        return seeds

    def grid_shape(self, mask, axis, sp_along, sp_across, count):
        """How many cells along and across: keep the cell aspect of the stroke
        (length x size, not a square) and spend about `count` strokes on the
        part of the bounding box the region actually fills."""
        ys, xs = np.nonzero(mask)
        P = np.stack([xs, ys], axis=1).astype(np.float64)
        a = P @ np.array(axis, np.float64)
        b = P @ np.array([-axis[1], axis[0]], np.float64)
        ea = max(1.0, float(a.max() - a.min()))
        eb = max(1.0, float(b.max() - b.min()))
        fill = clamp(len(xs) / (ea * eb), 0.15, 1.0)
        n = count / fill
        r = max(1.0, sp_along / max(1e-6, sp_across))
        nb = int(round(math.sqrt(max(1.0, n * eb * r / ea))))
        nb = int(clamp(nb, 1, max(1, int(eb / max(2.0, sp_across * 0.4)))))
        na = int(clamp(round(n / nb), 1, max(1, int(ea / max(2.0, sp_along * 0.4)))))
        return na, nb

    def layer_block(self, layer, li, mask, rng):
        """Cover the region with a jittered grid: across the stroke the cells are
        about size*0.6 apart, along it about length*0.7, and the grid is sized so
        it spends about `count` strokes (count stays a hard cap)."""
        count = int(layer.get("count", 0))
        if count <= 0 or mask.sum() == 0:
            return 0, 0
        size_r, _a, length_r = self.layer_params(layer)
        size_mean = 0.5 * (size_r[0] + size_r[1])
        length_mean = 0.5 * (length_r[0] + length_r[1]) if length_r else 4.5 * size_mean
        pal = self.palette(layer.get("region"), mask, layer.get("palette", 0))
        dir_fn = self.dir_fn_for(layer, size_mean)
        inside = self.inside_fn_for(layer, mask)
        axis = self.layer_axis(layer, mask, size_mean)
        sp_b = max(2.0, size_mean * 0.6)
        sp_a = max(sp_b, length_mean * 0.7)
        na, nb = self.grid_shape(mask, axis, sp_a, sp_b, count)
        seeds = self.grid_seeds(mask, axis, na, nb, rng)
        if len(seeds) > count:
            idx = np.linspace(0, len(seeds) - 1, count).round().astype(int)
            seeds = [seeds[i] for i in idx]
        tried = kept = 0
        for (sx, sy) in seeds:
            if kept >= count:
                break
            tried += 1
            a = self.make_stroke(layer, li, mask, rng, sx, sy, dir_fn, pal, inside)
            if a is None:
                continue
            self.emit(a)
            kept += 1
        return tried, kept

    def layer_refine(self, layer, li, mask, rng):
        """Error driven: aim at the worst pixels, keep the stroke if it helps."""
        count = int(layer.get("count", 0))
        if count <= 0:
            return 0, 0
        size_r, _a, _l = self.layer_params(layer)
        size_mean = 0.5 * (size_r[0] + size_r[1])
        pal = self.palette(layer.get("region"), mask, layer.get("palette", 0))
        dir_fn = self.dir_fn_for(layer, size_mean)
        inside = self.inside_fn_for(layer, mask)
        accept = layer.get("accept", "improve")

        hw, hh = self.w // 2, self.h // 2
        hmask = cv2.resize(mask, (hw, hh), interpolation=cv2.INTER_NEAREST)
        flat = np.flatnonzero(hmask.reshape(-1) > 0)
        if flat.size == 0:
            return 0, 0
        sigma = max(0.8, size_mean / 3.0 / 2.0)   # sigma ~ size/3, at half res

        cdf = None

        def refresh_weights():
            half = cv2.resize(self.canvas, (hw, hh), interpolation=cv2.INTER_AREA)
            d = to_lab(half) - self.half_target_lab
            de = np.sqrt((d * d).sum(axis=2))
            de = cv2.GaussianBlur(de, (0, 0), sigma)
            e = de.reshape(-1)[flat]
            thr = np.percentile(e, 55.0) if e.size > 8 else 0.0
            wt = np.clip(e - thr, 0.0, None) ** 2
            s = wt.sum()
            if s <= 1e-9:
                wt = np.ones_like(e)
            return np.cumsum(wt, dtype=np.float64)

        refresh = max(1, count // 40)
        tried = kept = 0
        max_tried = count if accept == "always" else count * 4
        misses = 0
        while kept < count and tried < max_tried:
            if cdf is None or tried % refresh == 0:
                cdf = refresh_weights()
            r = float(rng.random()) * float(cdf[-1])
            j = int(np.searchsorted(cdf, r, side="left"))
            j = min(j, len(flat) - 1)
            p = int(flat[j])
            sx = (p % hw) * 2 + 1 + (float(rng.random()) - 0.5) * 2.0
            sy = (p // hw) * 2 + 1 + (float(rng.random()) - 0.5) * 2.0
            if not (0 <= sx < self.w and 0 <= sy < self.h) or mask[int(sy), int(sx)] == 0:
                tried += 1
                continue
            tried += 1
            a = self.make_stroke(layer, li, mask, rng, sx, sy, dir_fn, pal, inside)
            if a is None:
                continue
            box = bbox_of(a["pts"], float(a["size"]) + 6.0, self.w, self.h)
            if accept == "always":
                self.emit(a)
                kept += 1
                continue
            before = self.box_error(box, mask)
            saved = self.canvas[box[1]:box[3], box[0]:box[2]].copy()
            self.emit(a)
            after = self.box_error(box, mask)
            if after < before:
                kept += 1
                misses = 0
            else:
                self.canvas[box[1]:box[3], box[0]:box[2]] = saved
                self.actions.pop()
                misses += 1
                if misses > 200:
                    break
        return tried, kept


# --------------------------------------------------------------------------
# reports
# --------------------------------------------------------------------------

def blurred_ssim(a_rgb, b_rgb):
    try:
        from skimage.metrics import structural_similarity
    except Exception:
        return None
    ga = cv2.GaussianBlur(cv2.cvtColor(a_rgb, cv2.COLOR_RGB2GRAY), (0, 0), 4)
    gb = cv2.GaussianBlur(cv2.cvtColor(b_rgb, cv2.COLOR_RGB2GRAY), (0, 0), 4)
    return float(structural_similarity(ga, gb))


def write_reports(p, args):
    canvas_u8 = np.clip(p.canvas, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(p.out, "preview.png"), cv2.cvtColor(canvas_u8, cv2.COLOR_RGB2BGR))

    lab = to_lab(p.canvas)
    d = lab - p.target_lab
    de = np.sqrt((d * d).sum(axis=2))
    heat = np.clip(de / 30.0, 0, 1)
    heat_u8 = (heat * 255).astype(np.uint8)
    cv2.imwrite(os.path.join(p.out, "error.png"), cv2.applyColorMap(heat_u8, cv2.COLORMAP_INFERNO))

    dref = lab - p.ref_lab
    de_ref = np.sqrt((dref * dref).sum(axis=2))

    regions = {}
    for name in p.dir.get("regions", {}):
        m = p.regions.mask(name)
        sel = m > 0
        regions[name] = {
            "pixels": int(sel.sum()),
            "delta_e_target": round(float(de[sel].mean()), 3) if sel.any() else None,
            "delta_e_ref": round(float(de_ref[sel].mean()), 3) if sel.any() else None,
        }

    strokes = sum(1 for a in p.actions if a.get("t") == "stroke")
    rep = {
        "direction": os.path.abspath(args.direction),
        "out": os.path.abspath(p.out),
        "seed": p.seed,
        "canvas": [p.w, p.h],
        "target": ("stylize (local)" if p.stylized else (args.target or p.dir.get("target") or "reference")),
        "actions": len(p.actions),
        "strokes": strokes,
        "seconds": round(p.seconds, 2),
        "layers": p.reports,
        "regions": regions,
        "delta_e_target_mean": round(float(de.mean()), 3),
        "likeness": {
            "delta_e_ref_mean": round(float(de_ref.mean()), 3),
            "ssim_blur_ref": blurred_ssim(canvas_u8, p.ref),
        },
    }
    with open(os.path.join(p.out, "report.json"), "w") as fh:
        json.dump(rep, fh, indent=1)

    L = []
    L.append("painter run  %s" % rep["out"])
    L.append("direction    %s" % rep["direction"])
    L.append("target       %s" % rep["target"])
    L.append("seed %d   canvas %dx%d   actions %d   strokes %d   %.1fs"
             % (p.seed, p.w, p.h, rep["actions"], strokes, p.seconds))
    L.append("")
    L.append("%-3s %-16s %-10s %-8s %-6s %6s %6s %8s %8s %7s"
             % ("#", "layer", "region", "tool", "mode", "tried", "kept", "dE-in", "dE-out", "sec"))
    for r in p.reports:
        L.append("%-3d %-16s %-10s %-8s %-6s %6d %6d %8.2f %8.2f %7.2f"
                 % (r["index"], r["name"], str(r["region"]), r["tool"], r["mode"],
                    r["tried"], r["kept"], r["error_before"], r["error_after"], r["seconds"]))
    L.append("")
    L.append("region dE (painting vs target, then vs reference)")
    for name, v in regions.items():
        L.append("  %-12s %8s px   dE %6s   ref dE %6s"
                 % (name, v["pixels"], v["delta_e_target"], v["delta_e_ref"]))
    L.append("")
    L.append("whole canvas mean dE vs target : %.2f" % rep["delta_e_target_mean"])
    L.append("likeness   mean dE vs reference: %.2f" % rep["likeness"]["delta_e_ref_mean"])
    ss = rep["likeness"]["ssim_blur_ref"]
    L.append("likeness   blurred SSIM vs ref : %s" % ("%.4f" % ss if ss is not None else "n/a"))
    L.append("")
    L.append("error.png is the dE left against the target: black 0, purple 10, orange 20, pale 30+.")
    with open(os.path.join(p.out, "report.txt"), "w") as fh:
        fh.write("\n".join(L) + "\n")
    return rep


# --------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description="place strokes from an art direction json")
    ap.add_argument("--direction", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--target", default=None)
    ap.add_argument("--ref", default=None)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args(argv)

    with open(args.direction) as fh:
        direction = json.load(fh)
    base = os.path.dirname(os.path.abspath(args.direction))

    def resolve(p):
        if not p:
            return None
        return p if os.path.isabs(p) else os.path.join(base, p)

    ref = resolve(args.ref) or resolve(direction.get("reference"))
    if not ref:
        raise SystemExit("painter: no reference: pass --ref or set \"reference\" in the json")
    target = resolve(args.target) or resolve(direction.get("target"))
    seed = args.seed if args.seed is not None else int(direction.get("seed", 7))
    os.makedirs(args.out, exist_ok=True)

    p = Painter(direction, args.out, ref, target, seed)
    actions = p.run()
    with open(os.path.join(args.out, "actions.json"), "w") as fh:
        json.dump(actions, fh)
    rep = write_reports(p, args)
    print("painter: %d actions (%d strokes) in %.1fs -> %s"
          % (len(actions), rep["strokes"], p.seconds, os.path.join(args.out, "actions.json")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
