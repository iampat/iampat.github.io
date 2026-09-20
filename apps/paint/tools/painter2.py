#!/usr/bin/env python3
"""painter2.py - the v4 stroke placer (contract: apps/paint/work/v4/PAINTER_SPEC.md, Part B).

    W/venv/bin/python painter2.py --direction <json> --out <run dir> [--seed 7] [--max-strokes N]

Reads an art-direction json and writes an action list for engine.js. No agent
is in the loop: everything is deterministic, seeded from (seed, layer, level).

Every stroke is scored by the change of the WHOLE-PICTURE metric Q from
quality.py. The change is computed incrementally on the stroke's box grown by
the metric halo, which is exactly equal to the full-canvas recomputation; a
self-test asserts that on the first few strokes of every layer.
"""

import argparse
import json
import math
import os
import sys
import time

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import quality as QQ  # noqa: E402

BG = (255.0, 255.0, 255.0)
TOOLS = ("brush", "pencil", "bristle", "spray", "eraser", "flat", "knife", "crayon")
MODES = ("block", "refine", "trace")
CRAYON_PRESSURE = 0.7          # engine.js default
PAPER_TOL = 8.0                # Lab dE from the paper: a pixel carries pigment
CANVAS_SEED = 1                # the paper seed the crayon draws on: the ENGINE's
                               # canvas seed, which render.mjs fixes at 1
                               # (new PaintEngine(canvas, {seed: 1, scale})).
                               # It is NOT the direction's stroke seed: the paper
                               # is a property of the sheet, not of the plan, and
                               # the two renderers must agree on it.
CANVAS_W = 1440                # the canvas the paper is made for
CANVAS_H = 1920
SELFTEST_PER_LAYER = 3
SELFTEST_TOL = 1e-6
FAIL_STREAK = 50
INK_RECHECK = 200              # kept strokes between two deficit measurements
STOP_ROUNDS = 60               # seed rounds a density-stopped trace layer may run


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

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


def as_range(v, fallback):
    if v is None:
        return fallback
    if isinstance(v, (list, tuple)):
        return (float(v[0]), float(v[1]))
    return (float(v), float(v))


def clamp(v, lo, hi):
    return lo if v < lo else (hi if v > hi else v)


def lab_to_rgb(lab):
    a = np.asarray(lab, np.float32).reshape(1, 1, 3)
    return cv2.cvtColor(a, cv2.COLOR_LAB2RGB).reshape(3) * 255.0


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


# ---------------------------------------------------------------------------
# regions
# ---------------------------------------------------------------------------

class Regions:
    def __init__(self, spec, w, h):
        self.spec = spec or {}
        self.w, self.h = w, h
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
            raise SystemExit("painter2: unknown region " + str(name))
        if name in self._busy:
            raise SystemExit("painter2: region " + str(name) + " refers to itself")
        self._busy.add(name)
        spec = self.spec[name]
        m = np.zeros((self.h, self.w), np.uint8)
        if "poly" in spec:
            self._fill(m, spec["poly"])
        for poly in spec.get("polys", []):
            self._fill(m, poly)
        if "rect" in spec:
            x0, y0, x1, y1 = [int(round(float(v))) for v in spec["rect"]]
            cv2.rectangle(m, (x0, y0), (x1, y1), 1, -1)
        for other in spec.get("minus", []):
            m[self.mask(other) > 0] = 0
        self._busy.discard(name)
        self._cache[name] = m
        return m


# ---------------------------------------------------------------------------
# flow fields and the edge-tangent flow
# ---------------------------------------------------------------------------

def catmull_rom(points, step=2.0):
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
    p0, p1, p2, p3 = ext[-4], ext[-3], ext[-2], ext[-1]
    pos.append(P[-1][None, :])
    tan.append((0.5 * (-p0 + 3 * p1 - 3 * p2 + p3) * 3 + 0.5 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * 2
                + 0.5 * (-p0 + p2))[None, :])
    return np.vstack(pos), np.vstack(tan)


def build_flow_field(curves, w, h):
    """The director's guide curves, spread over the canvas by nearest sample."""
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
    T[T[:, 0] < 0] *= -1.0
    xi = np.clip(np.round(P[:, 0]).astype(np.int64), 0, w - 1)
    yi = np.clip(np.round(P[:, 1]).astype(np.int64), 0, h - 1)
    acc = np.zeros((h * w, 2), np.float64)
    flat = yi * w + xi
    np.add.at(acc, flat, T)
    src = np.full(h * w, 255, np.uint8)
    src[flat] = 0
    src = src.reshape(h, w)
    _d, labels = cv2.distanceTransformWithLabels(src, cv2.DIST_L2, 5,
                                                 labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(src == 0)
    labs = labels[ys, xs].astype(np.int64)
    lut = np.zeros((int(labels.max()) + 1, 2), np.float32)
    lut[labs] = acc.reshape(h, w, 2)[ys, xs]
    field = lut[labels]
    fn = np.sqrt((field * field).sum(axis=2))
    fn[fn < 1e-9] = 1.0
    return (field / fn[:, :, None]).astype(np.float32)


def edge_tangent_flow(level_rgb, size):
    """ETF: the structure tensor of the level target, then the tangent (90 deg off).

    Flat areas still get a stable direction, because the tensor is smoothed
    before the orientation is read off it.
    """
    grey = cv2.cvtColor(level_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    pre = max(1.0, size / 4.0)
    post = max(2.0, size / 2.0)
    g = cv2.GaussianBlur(grey, (0, 0), pre)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    jxx = cv2.GaussianBlur(gx * gx, (0, 0), post)
    jxy = cv2.GaussianBlur(gx * gy, (0, 0), post)
    jyy = cv2.GaussianBlur(gy * gy, (0, 0), post)
    theta = 0.5 * np.arctan2(2.0 * jxy, jxx - jyy)      # dominant gradient angle
    field = np.stack([-np.sin(theta), np.cos(theta)], axis=2)   # 90 deg off it
    return np.ascontiguousarray(field, np.float32)


def mix_fields(etf, bias, weight):
    """Blend a bias field into the ETF, matching the sign first (both are orientations)."""
    if bias is None or weight <= 0:
        return etf
    w = float(clamp(weight, 0.0, 1.0))
    s = np.sign((etf * bias).sum(axis=2))
    s[s == 0] = 1.0
    b = bias * s[:, :, None]
    out = etf * (1.0 - w) + b * w
    n = np.sqrt((out * out).sum(axis=2))
    n[n < 1e-9] = 1.0
    return np.ascontiguousarray(out / n[:, :, None], np.float32)


# ---------------------------------------------------------------------------
# the numpy renderer (flat and knife share Part A's constants)
# ---------------------------------------------------------------------------

FLAT_LEN = 0.35
FLAT_STEP = 0.2
FLAT_RIPPLE = 0.08
FLAT_EDGE = 0.98
FLAT_EDGE_FRAC = 0.12
KNIFE_LEN = 0.6
KNIFE_STEP = 0.5
KNIFE_LIGHT = 1.06
KNIFE_DARK = 0.94

_DAB_CACHE = {}


def dab_kernel(r):
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
        self.w = max(0, self.x1 - self.x0)
        self.h = max(0, self.y1 - self.y0)
        self.P = np.zeros((self.h, self.w, 3), np.float32)
        self.A = np.zeros((self.h, self.w), np.float32)

    def empty(self):
        return self.w <= 0 or self.h <= 0

    def add(self, x, y, alpha, colour):
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
        col = np.asarray(colour, np.float32)
        if col.ndim == 3:
            P += a[:, :, None] * col[sy0 - y:sy1 - y, sx0 - x:sx1 - x]
        else:
            P += a[:, :, None] * col[None, None, :]

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


def _unit_normals(pts):
    a = np.asarray(pts, np.float64)
    n = len(a)
    d = np.zeros_like(a)
    if n == 1:
        d[0] = (1.0, 0.0)
    else:
        d[1:-1] = a[2:] - a[:-2]
        d[0] = a[1] - a[0]
        d[-1] = a[-1] - a[-2]
    ln = np.sqrt((d * d).sum(axis=1))
    ln[ln < 1e-9] = 1.0
    u = d / ln[:, None]
    nrm = np.stack([-u[:, 1], u[:, 0]], axis=1)
    return u, nrm


def band_polygon(pts, width, extend, skew=0.0):
    """The swath a stamped tool leaves: the path offset by +-width/2, ends grown
    by `extend` along the tangent, the two rails shifted by -+skew/2 along it."""
    a = np.asarray(pts, np.float64)
    u, nrm = _unit_normals(a)
    a = a.copy()
    a[0] -= u[0] * extend
    a[-1] += u[-1] * extend
    left = a + nrm * (width / 2.0) + u * (-skew / 2.0)
    right = a - nrm * (width / 2.0) + u * (skew / 2.0)
    return np.vstack([left, right[::-1]])


def _chord(pts):
    a = np.asarray(pts, np.float64)
    d = a[-1] - a[0]
    ln = float(np.hypot(d[0], d[1]))
    if ln < 1e-6:
        return (1.0, 0.0)
    return (d[0] / ln, d[1] / ln)


def _draw_flat(lay, local, size, colour, rng):
    """Flat brush: a hard-edged band with a value ripple across it and darker rails.

    engine.js stamps a rounded rectangle every size*0.2 px. The union of those
    stamps is the band drawn here; the per-stamp value ripple becomes a lookup
    on the distance along the path, and the 2% edge darkening becomes a ramp on
    the distance to the band edge. Same look, one rasterisation.
    """
    w = max(1.0, size)
    ln = max(0.8, size * FLAT_LEN)
    step = max(0.5, size * FLAT_STEP)
    poly = band_polygon(local, w, ln / 2.0)
    arr = np.round(poly).astype(np.int32)
    m = np.zeros((lay.h, lay.w), np.uint8)
    cv2.fillPoly(m, [arr], 255, cv2.LINE_AA)
    if not m.any():
        return
    cov = m.astype(np.float32) / 255.0
    # value ripple: one draw per stamp, walked front to back, as in engine.js
    nst = int(path_length(local) / step) + 2
    ripple = (1.0 + (rng.random(nst) - 0.5) * FLAT_RIPPLE).astype(np.float32)
    ux, uy = _chord(local)
    xs = np.arange(lay.w, dtype=np.float32)[None, :]
    ys = np.arange(lay.h, dtype=np.float32)[:, None]
    t = (xs - local[0][0]) * ux + (ys - local[0][1]) * uy
    idx = np.clip((t / step).astype(np.int32), 0, nst - 1)
    fac = ripple[idx]
    # the two long rails sit 2% darker
    edge = max(1.0, w * FLAT_EDGE_FRAC)
    d = cv2.distanceTransform((m > 0).astype(np.uint8), cv2.DIST_L2, 3)
    fac = fac * (FLAT_EDGE + (1.0 - FLAT_EDGE) * np.clip(d / edge, 0.0, 1.0))
    col = np.asarray(colour, np.float32)[None, None, :] * fac[:, :, None]
    lay.add_full(cov, np.clip(col, 0.0, 255.0))


def _draw_knife(lay, local, size, colour):
    """Palette knife: a leaning band, 6% lighter on one rail, 6% darker on the other."""
    w = max(1.0, size)
    ln = max(0.8, size * KNIFE_LEN)
    poly = band_polygon(local, w, ln / 2.0, skew=ln)
    arr = np.round(poly).astype(np.int32)
    m = np.zeros((lay.h, lay.w), np.uint8)
    cv2.fillPoly(m, [arr], 255, cv2.LINE_AA)
    if not m.any():
        return
    cov = m.astype(np.float32) / 255.0
    ux, uy = _chord(local)
    nx, ny = -uy, ux
    xs = np.arange(lay.w, dtype=np.float32)[None, :]
    ys = np.arange(lay.h, dtype=np.float32)[:, None]
    s = (xs - local[0][0]) * nx + (ys - local[0][1]) * ny
    tt = np.clip(s / w + 0.5, 0.0, 1.0)           # 0 at one rail, 1 at the other
    fac = (KNIFE_LIGHT + (KNIFE_DARK - KNIFE_LIGHT) * tt).astype(np.float32)
    col = np.asarray(colour, np.float32)[None, None, :] * fac[:, :, None]
    lay.add_full(cov, np.clip(col, 0.0, 255.0))


# ---------------------------------------------------------------------------
# the crayon (Part A lives in tools/crayon_np.py: paper_height + draw_crayon)
# ---------------------------------------------------------------------------

_CRAYON_MOD = "unset"
_PAPER_CACHE = {}


def crayon_mod():
    """tools/crayon_np.py, Part A of the crayon contract. None if it is absent,
    and then a hard stand-in mark draws instead (TODO(crayon) below)."""
    global _CRAYON_MOD
    if _CRAYON_MOD == "unset":
        try:
            import crayon_np as m
        except Exception:
            m = None
        _CRAYON_MOD = m
    return _CRAYON_MOD


def canvas_paper():
    """The sheet the whole canvas is drawn on. One per (size, seed): the paper
    tooth is a property of the canvas, so every stroke reads the same map."""
    m = crayon_mod()
    if m is None:
        return None
    key = (CANVAS_W, CANVAS_H, CANVAS_SEED)
    p = _PAPER_CACHE.get(key)
    if p is None:
        p = m.paper_height(CANVAS_W, CANVAS_H, CANVAS_SEED, 1.0)
        _PAPER_CACHE.clear()
        _PAPER_CACHE[key] = p
    return p


class _PlacedLayer:
    """`lay`'s pixels, seen at their CANVAS coordinates.

    A candidate is scored on a crop, so a Layer's x0/y0 are crop-relative. The
    paper belongs to the canvas, so the crayon is handed the layer's real place
    and canvas-space points; otherwise the same stroke would land on different
    paper when it is scored and when it is drawn.
    """

    __slots__ = ("P", "A", "w", "h", "x0", "y0", "_lay")

    def __init__(self, lay, gx, gy):
        self.P, self.A, self.w, self.h = lay.P, lay.A, lay.w, lay.h
        self.x0, self.y0 = int(gx), int(gy)
        self._lay = lay

    def add_full(self, alpha, colour):
        self._lay.add_full(alpha, colour)


def _crayon_standin(lay, local, size, colour, pressure):
    """TODO(crayon): only used when tools/crayon_np.py is missing. A hard
    pencil-like band, no paper tooth. It is NOT the crayon of the contract."""
    arr = np.round(np.array(local, np.float64)).astype(np.int32)
    wd = max(1, int(round(size)))
    m = aa_mask(lay.h, lay.w,
                lambda img: cv2.polylines(img, [arr], False, 255, wd, cv2.LINE_AA))
    lay.add_full(m * float(clamp(0.35 + 0.65 * pressure, 0.2, 1.0)), colour)


def draw_crayon(lay, local, size, colour, pressure, gx, gy):
    """One crayon stroke into `lay`, which sits at (gx, gy) on the canvas.
    The caller composites the layer at the action's alpha, as for every tool."""
    m = crayon_mod()
    if m is None:
        _crayon_standin(lay, local, size, colour, pressure)
        return
    pts = [(float(x) + gx, float(y) + gy) for (x, y) in local]
    m.draw_crayon(_PlacedLayer(lay, gx, gy), pts, size, colour,
                  pressure=pressure, paper=canvas_paper())


def paper_ground(canvas, colour):
    """{"t": "clear", "color": c, "paper": true}: the colour, tinted by the
    coarse tooth so an untouched area reads as paper and not as a flat fill."""
    m = crayon_mod()
    if m is None:
        canvas[:, :, :] = np.asarray(colour, np.float32)[None, None, :]
        return
    m.draw_paper_ground(canvas, np.asarray(colour, np.float64), canvas_paper())


def render_stroke(canvas, action, rng, w, h, ox=0, oy=0):
    """Render one stroke into `canvas`, whose top-left sits at (ox, oy)."""
    pts = [(float(p[0]) - ox, float(p[1]) - oy) for p in action["pts"]]
    if len(pts) == 1:
        pts.append((pts[0][0] + 0.01, pts[0][1]))
    size = max(0.5, float(action.get("size", 1)))
    tool = action.get("tool", "pencil")
    alpha = 1.0 if action.get("alpha") is None else float(action["alpha"])
    colour = BG if tool == "eraser" else rgb_of(action.get("color", "#000000"))
    lay = Layer(bbox_of(pts, size + 6.0, w, h))
    if lay.empty():
        return
    lx, ly = lay.x0, lay.y0
    local = [(p[0] - lx, p[1] - ly) for p in pts]

    if tool == "brush":
        r = max(0.6, size / 2.0)
        k = dab_kernel(r)
        n = k.shape[0] // 2
        for (x, y) in walk_path(local, max(0.5, size / 4.0)):
            lay.add(int(round(x)) - n, int(round(y)) - n, k, colour)

    elif tool == "flat":
        _draw_flat(lay, local, size, colour, rng)

    elif tool == "knife":
        _draw_knife(lay, local, size, colour)

    elif tool == "crayon":
        draw_crayon(lay, local, size, colour,
                    float(action.get("pressure", CRAYON_PRESSURE)),
                    ox + lay.x0, oy + lay.y0)

    elif tool == "spray":
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
                sel = two if (dx or dy) else np.ones(total, bool)
                qx, qy = px[sel] + dx, py[sel] + dy
                ok = (qx >= 0) & (qx < lay.w) & (qy >= 0) & (qy < lay.h)
                if ok.any():
                    hits += np.bincount(qy[ok] * lay.w + qx[ok],
                                        minlength=lay.h * lay.w).astype(np.float32)
        lay.add_full((1.0 - np.power(0.85, hits)).reshape(lay.h, lay.w), colour)

    elif tool == "bristle":
        k = int(round(clamp(size / 3.0, 3, 14)))
        span = max(2.0, size)
        for b in range(k):
            off = (0.0 if k == 1 else (b / (k - 1.0) - 0.5)) * span
            sh = 1.0 + (float(rng.random()) - 0.5) * 0.16
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
            lay.add_full(m, np.clip(np.asarray(colour, np.float32) * sh, 0, 255))

    else:   # pencil, eraser
        arr = np.round(np.array(local, np.float64)).astype(np.int32)
        wd = max(1, int(round(size)))
        m = aa_mask(lay.h, lay.w,
                    lambda img: cv2.polylines(img, [arr], False, 255, wd, cv2.LINE_AA))
        lay.add_full(m, colour)

    lay.composite(canvas, alpha)


def render_actions(actions, w, h, seed=1):
    global CANVAS_W, CANVAS_H
    CANVAS_W, CANVAS_H = int(w), int(h)   # `seed` drives the stroke rng, not the paper
    canvas = np.full((h, w, 3), 255.0, np.float32)
    for i, a in enumerate(actions):
        t = a.get("t")
        if t == "clear":
            col = rgb_of(a.get("color", "#ffffff"))
            if a.get("paper"):
                paper_ground(canvas, col)
            else:
                canvas[:, :, :] = col[None, None, :]
        elif t == "stroke":
            render_stroke(canvas, a, np.random.default_rng([seed, i]), w, h)
    return canvas


# ---------------------------------------------------------------------------
# stroke order: how the hand travels over the paper
# ---------------------------------------------------------------------------

def travel_of(strokes, start=(0.0, 0.0)):
    """Pen-up travel: the sum of the jumps from one stroke's end to the next
    stroke's start, in plan px."""
    cx, cy = float(start[0]), float(start[1])
    tot = 0.0
    for a in strokes:
        p0 = a["pts"][0]
        tot += math.hypot(float(p0[0]) - cx, float(p0[1]) - cy)
        p1 = a["pts"][-1]
        cx, cy = float(p1[0]), float(p1[1])
    return tot


def sweep_strokes(strokes, start=(0.0, 0.0)):
    """Greedy nearest-neighbour order from the top-left: from the previous
    stroke's end, take the stroke with the nearest END POINT (either end) and
    flip its points when its far end is the nearer one.

    Returns (ordered strokes, pen-up travel px).
    """
    n = len(strokes)
    if n < 2:
        return list(strokes), travel_of(strokes, start)
    A = np.array([[float(a["pts"][0][0]), float(a["pts"][0][1])] for a in strokes])
    B = np.array([[float(a["pts"][-1][0]), float(a["pts"][-1][1])] for a in strokes])
    left = np.ones(n, bool)
    cur = np.array([float(start[0]), float(start[1])])
    out = []
    travel = 0.0
    for _ in range(n):
        d0 = ((A - cur) ** 2).sum(axis=1)
        d1 = ((B - cur) ** 2).sum(axis=1)
        d0 = np.where(left, d0, np.inf)
        d1 = np.where(left, d1, np.inf)
        i0, i1 = int(np.argmin(d0)), int(np.argmin(d1))
        flip = d1[i1] < d0[i0]
        i = i1 if flip else i0
        travel += math.sqrt(float(d1[i1] if flip else d0[i0]))
        a = strokes[i]
        if flip:
            a = dict(a)
            a["pts"] = list(reversed(a["pts"]))
        out.append(a)
        cur = np.array([float(a["pts"][-1][0]), float(a["pts"][-1][1])])
        left[i] = False
    return out, travel


# ---------------------------------------------------------------------------
# the placer
# ---------------------------------------------------------------------------

class Painter:
    def __init__(self, direction, out_dir, seed, max_strokes):
        self.d = direction
        self.out = out_dir
        self.W, self.H = [int(v) for v in direction.get("canvas", [1440, 1920])]
        self.seed = int(seed)
        self.max_strokes = int(max_strokes)
        self.target = QQ.load_rgb(direction["target"], (self.W, self.H))
        self.photo_path = direction.get("reference")
        # the photo is only read when a layer asks for "photo_mix" (colour anchoring)
        self.photo = None
        if self.photo_path and any(float(l.get("photo_mix", 0) or 0) > 0 for l in direction.get("layers", [])):
            self.photo = QQ.load_rgb(self.photo_path, (self.W, self.H))
        self.regions = Regions(direction.get("regions"), self.W, self.H)
        self.flows = {}
        self.actions = []
        self.canvas = np.full((self.H, self.W, 3), 255.0, np.float32)
        self.q = QQ.QMetric(self.target, direction.get("metric"))
        self.q.set_image(self.canvas)
        self.canvas = self.q.img      # one buffer: commit() writes straight into it
        self.nstrokes = 0
        self._level_cache = {}
        self._trace_cache = {}
        self._group_cache = {}
        self._ink_cache = {}
        self._mark = None
        self.paper = self.paper_colour()
        self.paper_lab = QQ.to_lab(self.paper.reshape(1, 1, 3)).reshape(3)
        self.paper_tol = float(direction.get("paper_tol", PAPER_TOL))
        self.travel = []
        self.reordered = False
        self.rerender_seconds = 0.0
        self.selftest = []
        global CANVAS_W, CANVAS_H
        CANVAS_W, CANVAS_H = self.W, self.H   # the paper keeps CANVAS_SEED

    # -- caches ------------------------------------------------------------

    def flow(self, name):
        if name not in self.flows:
            spec = (self.d.get("flows") or {}).get(name)
            if not spec:
                raise SystemExit("painter2: unknown flow " + str(name))
            self.flows[name] = build_flow_field(spec["curves"], self.W, self.H)
        return self.flows[name]

    def paper_colour(self):
        """The direction's "paper" hex, or the median of the brightest fifth."""
        spec = self.d.get("paper")
        if spec:
            return rgb_of(spec)
        L = QQ.to_lab(self.target)[:, :, 0].ravel()
        sel = L >= float(np.percentile(L, 80.0))
        return np.median(self.target.reshape(-1, 3)[sel], axis=0).astype(np.float32)

    def mark(self):
        """The target at MARK scale (sigma 1): the colour of one crayon line,
        before the level blur mixes the paper back into it."""
        if self._mark is None:
            rgb = cv2.GaussianBlur(self.target, (0, 0), 1.0)
            self._mark = {"rgb": rgb, "lab": QQ.to_lab(rgb)}
        return self._mark

    def trace_maps(self, size):
        """The pigment mask M at one scale and the half-width of its marks.

        M = the level target more than `paper_tol` (Lab dE) off the paper.
        The distance transform of M is the local mark half-width, so the
        stroke size can follow how wide the mark under it is.
        """
        key = round(float(size), 3)
        got = self._trace_cache.get(key)
        if got is not None:
            return got
        lab = self.level(size)["lab"]
        d = lab - self.paper_lab[None, None, :]
        de = np.sqrt((d * d).sum(axis=2))
        m = (de > self.paper_tol).astype(np.uint8)
        got = {"mask": m, "half": cv2.distanceTransform(m, cv2.DIST_L2, 3)}
        if len(self._trace_cache) >= 4:
            self._trace_cache.clear()
        self._trace_cache[key] = got
        return got

    # -- ink and the deficit -----------------------------------------------

    def ink_of(self, lab):
        """ink(x, y) = Lab dE from the paper colour: how much wax a pixel
        carries. Paper itself is 0, a saturated mark is 40-60."""
        d = lab - self.paper_lab[None, None, :]
        return np.sqrt((d * d).sum(axis=2))

    def ink_target(self, size):
        """The ink of the finished drawing, at the layer's scale (cached)."""
        key = round(float(size), 3)
        got = self._ink_cache.get(key)
        if got is None:
            got = self.ink_of(self.level(size)["lab"])
            if len(self._ink_cache) >= 4:
                self._ink_cache.clear()
            self._ink_cache[key] = got
        return got

    def ink_canvas(self, size):
        """The ink the canvas carries now, at the same scale. ~60 ms."""
        blur = cv2.GaussianBlur(np.clip(self.canvas, 0.0, 255.0), (0, 0),
                                max(0.6, float(size) / 2.0))
        return self.ink_of(QQ.to_lab(blur))

    def deficit_map(self, size):
        """max(0, ink_target - ink_canvas): the wax still missing, per pixel.

        Both sides are blurred by size/2, so this is the density the eye reads
        at the scale of the layer's marks, not a per-pixel colour error. It is
        never negative: ink already laid where the target has none is the Q
        metric's business, not this one's.
        """
        return np.maximum(0.0, self.ink_target(size) - self.ink_canvas(size))

    def group_mask(self, spec):
        """A layer's colour group, read off the mark-scale target:
        {"lightness": [lo, hi]} | {"hue": [lo, hi]} | {"outline": true}
        (outline = chroma < 12 and L < 45). None when the layer sets none."""
        if not spec:
            return None
        if isinstance(spec, str):
            spec = {spec: True}
        key = json.dumps(spec, sort_keys=True)
        got = self._group_cache.get(key)
        if got is not None:
            return got
        lab = self.mark()["lab"]
        L, A, B = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]
        m = np.ones(L.shape, bool)
        if spec.get("outline"):
            m &= (np.sqrt(A * A + B * B) < 12.0) & (L < 45.0)
        if "lightness" in spec:
            lo, hi = as_range(spec["lightness"], (0.0, 100.0))
            m &= (L >= lo) & (L <= hi)
        if "hue" in spec:
            lo, hi = as_range(spec["hue"], (0.0, 360.0))
            hue = (np.degrees(np.arctan2(B, A)) + 360.0) % 360.0
            m &= ((hue >= lo) & (hue <= hi)) if lo <= hi else ((hue >= lo) | (hue <= hi))
        out = m.astype(np.uint8)
        if spec.get("outline"):
            # outlines are 2-4 px wide, so give the seeds a pixel of slack
            out = cv2.dilate(out, np.ones((3, 3), np.uint8))
        self._group_cache[key] = out
        return out

    def group_ok(self, spec, lab, slack):
        """Is this stroke colour still the layer's colour group?

        The seeds are inside the group, but a stroke's colour is the median
        along its whole path, and a mark may run into its neighbour. `slack`
        (the layer's "group_slack", 8 L by default) is how far out of the band
        a stroke may still be kept, so light -> mid -> dark stay separate.
        """
        if not spec:
            return True
        if isinstance(spec, str):
            spec = {spec: True}
        L, A, B = float(lab[0]), float(lab[1]), float(lab[2])
        if spec.get("outline"):
            if math.sqrt(A * A + B * B) > 12.0 + slack * 0.75 or L > 45.0 + slack:
                return False
        if "lightness" in spec:
            lo, hi = as_range(spec["lightness"], (0.0, 100.0))
            if L < lo - slack or L > hi + slack:
                return False
        if "hue" in spec:
            lo, hi = as_range(spec["hue"], (0.0, 360.0))
            hue = (math.degrees(math.atan2(B, A)) + 360.0) % 360.0
            d = 2.0 * slack
            inside = ((hue >= lo - d) and (hue <= hi + d)) if lo <= hi else \
                     ((hue >= lo - d) or (hue <= hi + d))
            if not inside:
                return False
        return True

    def level(self, size):
        """The blurred target, its Lab and its ETF at one brush scale."""
        key = round(float(size), 3)
        got = self._level_cache.get(key)
        if got is not None:
            return got
        sigma = max(0.6, size / 2.0)
        blurred = cv2.GaussianBlur(self.target, (0, 0), sigma)
        got = {
            "rgb": blurred,
            "lab": QQ.to_lab(blurred),
            "etf": edge_tangent_flow(blurred, size),
        }
        if self.photo is not None:
            got["photo_lab"] = QQ.to_lab(cv2.GaussianBlur(self.photo, (0, 0), sigma))
        # each entry holds three full-size planes (~88 MB at 1440x1920), so keep
        # only the handful a layer walks through; rebuilding one costs ~0.2 s
        if len(self._level_cache) >= 4:
            self._level_cache.clear()
        self._level_cache[key] = got
        return got

    # -- actions -----------------------------------------------------------

    def emit(self, action):
        self.actions.append(action)
        if action.get("t") == "stroke":
            self.nstrokes += 1

    def stroke_action(self, tool, pts, size, alpha, colour, pressure=None):
        a = {
            "t": "stroke", "tool": tool, "color": hex_of(colour),
            "size": round(float(size), 2), "alpha": round(float(alpha), 3),
            "pts": [[round(float(x), 1), round(float(y), 1)] for x, y in pts],
        }
        if pressure is not None:
            a["pressure"] = round(float(pressure), 3)
        return a

    # -- the ground pass ---------------------------------------------------

    def ground(self):
        spec = self.d.get("ground")
        if not spec:
            return 0.0
        t0 = time.time()
        if isinstance(spec, dict):
            col = (rgb_of(spec["color"]) if spec.get("color")
                   else np.asarray(self.paper, np.float32))
            act = {"t": "clear", "color": hex_of(col)}
            if spec.get("paper"):
                act["paper"] = True
            self.emit(act)
            if spec.get("paper"):
                paper_ground(self.canvas, col)
            else:
                self.canvas[:, :, :] = col[None, None, :]
            self.emit({"t": "mark", "name": "ground"})
            self.q.set_image(self.canvas)
            self.canvas = self.q.img
            return time.time() - t0
        if str(spec).lower() == "auto":
            lab = QQ.to_lab(self.target).reshape(-1, 3)
            col = lab_to_rgb(np.median(lab, axis=0))
        else:
            col = rgb_of(spec)
        self.emit({"t": "clear", "color": "#ffffff"})
        self.canvas[:, :, :] = 255.0
        size = max(40.0, min(self.W, self.H) / 12.0)
        step = size * 0.5
        y = step * 0.5
        rng = np.random.default_rng([self.seed, 999])
        n = 0
        while y < self.H + step:
            pts = [(-size, y), (self.W * 0.5, y + (float(rng.random()) - 0.5) * size * 0.1),
                   (self.W + size, y)]
            a = self.stroke_action("flat", pts, size, 1.0, col)
            self.emit(a)
            render_stroke(self.canvas, a, rng, self.W, self.H)
            n += 1
            y += step
        self.emit({"t": "mark", "name": "ground"})
        self.q.set_image(self.canvas)
        self.canvas = self.q.img
        return time.time() - t0

    # -- seeds -------------------------------------------------------------

    def seed_stream(self, mask, size, rng, want, weight=None):
        """Indices drawn from a map with probability proportional to it.

        The map is the per-pixel contribution to Q, or `weight` when the layer
        sows by something else (a density-stopped trace layer sows by its ink
        deficit, so the strokes go where the wax is missing).
        """
        err = self.q.contribution() if weight is None else weight
        err = cv2.GaussianBlur(err, (0, 0), max(0.6, size / 2.0))
        err = np.maximum(err, 0.0)
        idx = np.flatnonzero(mask.ravel() > 0)
        if len(idx) == 0:
            return np.zeros(0, np.int64)
        p = err.ravel()[idx].astype(np.float64)
        tot = p.sum()
        if tot <= 1e-12:
            p = np.ones(len(idx), np.float64)
            tot = float(len(idx))
        cdf = np.cumsum(p)
        cdf /= cdf[-1]
        u = rng.random(int(want))
        return idx[np.searchsorted(cdf, u, side="right").clip(0, len(idx) - 1)]

    # -- one stroke --------------------------------------------------------

    def build_path(self, sx, sy, dirs, ang0, half, curvature, inside, lab_lvl, col_lab, drift):
        """A streamline of the (biased) ETF from the seed, both ways from it."""
        step = clamp(self.step_size, 1.5, 24.0)
        out = []
        for way in (-1.0, 1.0):
            dx, dy = math.cos(ang0) * way, math.sin(ang0) * way
            x, y = sx, sy
            run = [(x, y)]
            travelled = 0.0
            while travelled < half:
                ix = int(clamp(round(x), 0, self.W - 1))
                iy = int(clamp(round(y), 0, self.H - 1))
                fx, fy = float(dirs[iy, ix, 0]), float(dirs[iy, ix, 1])
                if fx * dx + fy * dy < 0:
                    fx, fy = -fx, -fy
                nx = dx + (fx - dx) * curvature
                ny = dy + (fy - dy) * curvature
                nl = math.hypot(nx, ny)
                if nl < 1e-6:
                    break
                dx, dy = nx / nl, ny / nl
                x2, y2 = x + dx * step, y + dy * step
                ix2 = int(clamp(round(x2), 0, self.W - 1))
                iy2 = int(clamp(round(y2), 0, self.H - 1))
                if not inside[iy2, ix2]:
                    break
                lab = lab_lvl[iy2, ix2]
                de = math.sqrt(float((lab[0] - col_lab[0]) ** 2 + (lab[1] - col_lab[1]) ** 2
                                     + (lab[2] - col_lab[2]) ** 2))
                if de > drift:
                    break
                x, y = x2, y2
                travelled += step
                run.append((x, y))
            if way < 0:
                out = run[::-1]
            else:
                out = out + run[1:]
        if len(out) < 2:
            out = [(sx, sy), (sx + math.cos(ang0) * step, sy + math.sin(ang0) * step)]
        return out

    @staticmethod
    def smooth_path(raw, n):
        """Catmull-Rom through the streamline, resampled to n points."""
        a = np.asarray(raw, np.float64)
        if len(a) > 5:
            k = np.linspace(0, len(a) - 1, 5).round().astype(int)
            a = a[np.unique(k)]
        if len(a) < 2:
            return [(float(a[0][0]), float(a[0][1]))]
        dense, _ = catmull_rom(a, step=1.5)
        d = np.sqrt((np.diff(dense, axis=0) ** 2).sum(axis=1))
        s = np.concatenate([[0.0], np.cumsum(d)])
        if s[-1] < 1e-6:
            return [(float(dense[0][0]), float(dense[0][1])),
                    (float(dense[0][0]) + 0.5, float(dense[0][1]))]
        t = np.linspace(0.0, s[-1], int(n))
        x = np.interp(t, s, dense[:, 0])
        y = np.interp(t, s, dense[:, 1])
        return [(float(px), float(py)) for px, py in zip(x, y)]

    # -- one layer level ---------------------------------------------------

    def biased_dirs(self, layer, lvl):
        """The ETF at this scale, with the layer's flow and angle bias mixed in."""
        dirs = lvl["etf"]
        fname = layer.get("flow")
        if fname:
            dirs = mix_fields(dirs, self.flow(fname),
                              float(layer.get("flow_weight", 0.3)))
        if layer.get("angle") is not None:
            a = math.radians(float(layer["angle"]))
            bias = np.zeros_like(lvl["etf"])
            bias[:, :, 0] = math.cos(a)
            bias[:, :, 1] = math.sin(a)
            dirs = mix_fields(dirs, bias, float(layer.get("angle_weight", 0.3)))
        return dirs

    def run_level(self, layer, li, lv, spec, mask, inside, rng, stats):
        size = float(spec["size"])
        count = int(spec.get("count", 0))
        threshold = float(spec.get("threshold", 0.0) or 0.0)
        if count <= 0 or not mask.any():
            return
        lvl = self.level(size)
        lab_lvl = lvl["lab"]
        dirs = self.biased_dirs(layer, lvl)

        tool = layer.get("tool", "brush")
        if tool not in TOOLS:
            raise SystemExit("painter2: layer %r asks for unknown tool %r (have %s)"
                             % (layer.get("name"), tool, ", ".join(TOOLS)))
        alo, ahi = as_range(layer.get("alpha"), (0.8, 1.0))
        llo, lhi = as_range(layer.get("length"), (2.0, 6.0))
        curv = float(clamp(float(layer.get("curvature", 0.35)), 0.0, 1.0))
        drift = float(layer.get("drift", 12.0))
        nc = int(layer.get("candidates", 12))
        value = float(layer.get("value", 0.0))
        sat = float(layer.get("saturation", 0.0))
        jitter = float(layer.get("jitter", 0.0))
        photo_mix = float(clamp(float(layer.get("photo_mix", 0.0) or 0.0), 0.0, 1.0))

        self.step_size = max(1.5, size * 0.4)
        spacing = max(1.0, size * 0.4)
        used = np.zeros((self.H, self.W), np.uint8)
        want = count * 8 + 512
        seeds = self.seed_stream(mask, size, rng, want)
        kept = tried = 0
        fails = 0
        q_before = self.q.value()
        t0 = time.time()
        tests = 0

        for flat_idx in seeds:
            if kept >= count or self.nstrokes >= self.max_strokes:
                break
            if fails >= FAIL_STREAK:
                break
            sy, sx = divmod(int(flat_idx), self.W)
            if used[sy, sx]:
                continue
            cv2.circle(used, (sx, sy), int(round(spacing)), 1, -1)
            tried += 1
            best = None
            base_lab = lab_lvl[sy, sx]
            if photo_mix > 0.0 and "photo_lab" in lvl:
                base_lab = (1.0 - photo_mix) * base_lab + photo_mix * lvl["photo_lab"][sy, sx]
            for _ in range(nc):
                cx = sx + (rng.random() * 2.0 - 1.0) * size * 0.3
                cy = sy + (rng.random() * 2.0 - 1.0) * size * 0.3
                cx = clamp(cx, 0, self.W - 1)
                cy = clamp(cy, 0, self.H - 1)
                ix, iy = int(round(cx)), int(round(cy))
                if not inside[iy, ix]:
                    continue
                ang = math.atan2(float(dirs[iy, ix, 1]), float(dirs[iy, ix, 0]))
                ang += math.radians((rng.random() * 2.0 - 1.0) * 12.0)
                ang += math.radians((rng.random() * 2.0 - 1.0) * 30.0 * jitter)
                length = size * (llo + rng.random() * max(0.0, lhi - llo))
                ssz = size * (0.85 + rng.random() * 0.30)
                lab = np.array(base_lab, np.float32)
                lab[0] = clamp(float(lab[0]) + (rng.random() * 2.0 - 1.0) * 3.0, 0.0, 100.0)
                lab[0] = clamp(float(lab[0]) * (1.0 + value), 0.0, 100.0)
                lab[1] *= (1.0 + sat)
                lab[2] *= (1.0 + sat)
                colour = np.clip(lab_to_rgb(lab), 0.0, 255.0)
                alpha = alo + rng.random() * max(0.0, ahi - alo)
                raw = self.build_path(cx, cy, dirs, ang, length / 2.0, curv,
                                      inside, lab_lvl, lab, drift)
                npts = int(clamp(round(path_length(raw) / max(1.0, ssz)) + 4, 6, 14))
                pts = self.smooth_path(raw, npts)
                box = bbox_of(pts, ssz + 6.0, self.W, self.H)
                if box[2] <= box[0] or box[3] <= box[1]:
                    continue
                act = self.stroke_action(tool, pts, ssz, alpha, colour)
                crop = self.q.crop_box(box)
                sub = self.canvas[crop[1]:crop[3], crop[0]:crop[2]].copy()
                render_stroke(sub, act, rng, crop[2] - crop[0], crop[3] - crop[1],
                              crop[0], crop[1])
                gain, payload = self.q.delta(box, crop, sub)
                if best is None or gain > best[0]:
                    best = (gain, payload, act)
            ok = best is not None and (best[0] > 0.0 if threshold <= 0.0 else best[0] >= threshold)
            if not ok:
                fails += 1
                continue
            fails = 0
            gain, payload, act = best
            q_pre = self.q.value()
            self.q.commit(payload)
            self.emit(act)
            kept += 1
            if tests < SELFTEST_PER_LAYER:
                tests += 1
                full = QQ.QMetric(self.target, self.d.get("metric"))
                q_full = full.set_image(self.q.img)
                err = abs(q_full - self.q.value())
                self.selftest.append({
                    "layer": layer.get("name"), "size": size, "stroke": len(self.actions),
                    "q_incremental": self.q.value(), "q_full": q_full, "abs_err": err,
                    "gain": gain, "gain_full": q_pre - q_full,
                })
                if err > SELFTEST_TOL:
                    raise SystemExit(
                        "painter2: Q self-test failed on layer %s size %g: "
                        "incremental %.9f vs full %.9f (err %.3e)"
                        % (layer.get("name"), size, self.q.value(), q_full, err))
        stats.append({
            "layer": layer.get("name"), "level": lv, "size": size,
            "tried": tried, "kept": kept, "count": count,
            "q_before": q_before, "q_after": self.q.value(),
            "seconds": time.time() - t0,
        })

    # -- one trace level ---------------------------------------------------

    def trace_pressure(self, spec, dark):
        """Crayon pressure from the local darkness relative to the paper.

        No "pressure" in the layer  -> 0.4 + 0.6 * dark   (the contract).
        A number p                  -> that rule scaled by p / 0.7, so the
                                       engine default 0.7 reproduces it.
        A pair [lo, hi]             -> lo + (hi - lo) * dark.
        """
        if spec is None:
            p = 0.4 + 0.6 * dark
        elif isinstance(spec, (list, tuple)):
            lo, hi = as_range(spec, (0.4, 1.0))
            p = lo + (hi - lo) * dark
        else:
            p = float(spec) * (0.4 + 0.6 * dark) / CRAYON_PRESSURE
        return float(clamp(p, 0.3, 1.0))

    def deficit_pressure(self, spec, ratio):
        """Crayon pressure from the wax that is still MISSING, not from the
        mark's darkness: `"pressure_from": "deficit"`.

        ratio = local deficit / local target ink, both measured at the seed on
        the size/2 blur, so it is 1 on bare paper and 0 where the drawing is
        already dense enough. p = clamp(0.45 + 0.55 * ratio, 0.35, 1.0), times
        the layer's pressure scale (p / 0.7, as everywhere else); a pair
        [lo, hi] maps the ratio into that range instead.

        The old rule reads the target alone, so a mid tone on bare paper and
        the same tone over three passes ask for the same light stroke, and a
        tan skin never gets past a wash. This one presses hard while the paper
        still shows and eases off as the area fills.
        """
        if isinstance(spec, (list, tuple)):
            lo, hi = as_range(spec, (0.45, 1.0))
            return float(clamp(lo + (hi - lo) * ratio, 0.35, 1.0))
        p = clamp(0.45 + 0.55 * ratio, 0.35, 1.0)
        if spec is not None:
            p *= float(spec) / CRAYON_PRESSURE
        return float(clamp(p, 0.35, 1.0))

    def run_trace(self, layer, li, lv, spec, mask, inside, rng, stats):
        """Reproduce the marks of the target: strokes that run ALONG the
        pigment, one colour each, sized by how wide the mark under them is."""
        smin, smax = as_range(spec.get("size", layer.get("size")), (3.0, 9.0))
        if smax < smin:
            smin, smax = smax, smin
        count = int(spec.get("count", 0))
        threshold = float(spec.get("threshold", 0.0) or 0.0)
        # "stop": {"deficit": D, "max_count": N} - the layer draws until the
        # ink it still misses falls under D instead of counting to a fixed N
        stop = layer.get("stop", spec.get("stop"))
        stop_de = None
        max_rounds = 6
        if stop is not None:
            if not isinstance(stop, dict):
                raise SystemExit('painter2: layer %r: "stop" must be an object '
                                 '{"deficit": D, "max_count": N}' % layer.get("name"))
            stop_de = float(stop.get("deficit", 0.0))
            count = int(stop.get("max_count", count) or count)
            max_rounds = int(stop.get("rounds", STOP_ROUNDS))
        if count <= 0 or not mask.any():
            return
        base = 0.5 * (smin + smax)
        lvl = self.level(base)
        lab_lvl = lvl["lab"]
        dirs = self.biased_dirs(layer, lvl)
        maps = self.trace_maps(base)
        M = maps["mask"] > 0
        half = maps["half"]
        mark_lab = self.mark()["lab"]

        tool = layer.get("tool", "crayon")
        if tool not in TOOLS:
            raise SystemExit("painter2: layer %r asks for unknown tool %r (have %s)"
                             % (layer.get("name"), tool, ", ".join(TOOLS)))
        grp = self.group_mask(layer.get("color_group"))
        seed_mask = (mask > 0) & M
        if grp is not None:
            seed_mask &= grp > 0
        seed_mask = seed_mask.astype(np.uint8)
        field = inside & M                       # where a stroke may run
        if not seed_mask.any():
            stats.append({"layer": layer.get("name"), "level": lv, "size": base,
                          "mode": "trace", "tried": 0, "kept": 0, "count": count,
                          "path_px": 0.0, "seed_px": 0, "rounds": 0,
                          "stop_deficit": stop_de, "deficit_before": None,
                          "deficit_after": None, "stop_reason": "empty",
                          "q_before": self.q.value(), "q_after": self.q.value(),
                          "seconds": 0.0})
            return

        alo, ahi = as_range(layer.get("alpha"), (0.85, 1.0))
        llo, lhi = as_range(layer.get("length"), (3.0, 12.0))
        curv = float(clamp(float(layer.get("curvature", 0.5)), 0.0, 1.0))
        drift = float(layer.get("drift", 14.0))
        nc = int(layer.get("candidates", 8))
        value = float(layer.get("value", 0.0))
        sat = float(layer.get("saturation", 0.0))
        jitter = float(layer.get("jitter", 0.0))
        press = layer.get("pressure", spec.get("pressure"))
        press_from = str(layer.get("pressure_from", spec.get("pressure_from", "darkness")))
        if press_from not in ("darkness", "deficit"):
            raise SystemExit('painter2: layer %r: "pressure_from" is "darkness" '
                             'or "deficit" (got %r)' % (layer.get("name"), press_from))
        by_deficit = press_from == "deficit"
        gslack = float(layer.get("group_slack", 8.0))
        paper_L = max(1.0, float(self.paper_lab[0]))

        # the layer's own pixels: its region, the pigment mask and its colour
        # group. The deficit is the mean of max(0, ink_target - ink_canvas)
        # over exactly these, so one layer is never judged on another's work.
        layer_px = seed_mask > 0
        npx = int(layer_px.sum())
        ink_t = self.ink_target(base)
        live = stop_de is not None or by_deficit      # the map steers the run

        def measure():
            m = self.deficit_map(base)
            return m, (float(m[layer_px].mean()) if npx else 0.0)

        dmap, deficit = measure()
        deficit_before = deficit

        # seeds keep size * 0.5 apart, at the size of the mark under them
        used = np.zeros((self.H, self.W), np.uint8)
        kept = tried = fails = 0
        path_px = 0.0
        q_before = self.q.value()
        t0 = time.time()
        tests = 0
        rounds = 0
        checked = 0
        stop_reason = "count" if stop_de is None else "max_count"

        while kept < count and fails < FAIL_STREAK and rounds < max_rounds:
            # the error map ages as the layer fills, so the seeds are redrawn
            # in rounds instead of once for the whole layer
            rounds += 1
            if live and kept != checked:
                dmap, deficit = measure()
                checked = kept
            if stop_de is not None and deficit <= stop_de:
                stop_reason = "deficit"
                break
            if live and rounds > 1:
                # a second pass over an area is how a crayon builds up, so the
                # spacing mask starts every round empty; inside a round the
                # seeds stay size * 0.5 apart as before
                used[:, :] = 0
            seeds = self.seed_stream(seed_mask, base, rng, count * 3 + 256,
                                     weight=dmap if stop_de is not None else None)
            for flat_idx in seeds:
                if kept >= count or self.nstrokes >= self.max_strokes:
                    break
                if fails >= FAIL_STREAK:
                    break
                sy, sx = divmod(int(flat_idx), self.W)
                if used[sy, sx]:
                    continue
                ssz0 = clamp(2.0 * float(half[sy, sx]), smin, smax)
                cv2.circle(used, (sx, sy), int(round(max(1.0, ssz0 * 0.5))), 1, -1)
                tried += 1
                best = None
                for _ in range(nc):
                    cx = clamp(sx + (rng.random() * 2.0 - 1.0) * ssz0 * 0.3, 0, self.W - 1)
                    cy = clamp(sy + (rng.random() * 2.0 - 1.0) * ssz0 * 0.3, 0, self.H - 1)
                    ix, iy = int(round(cx)), int(round(cy))
                    if not field[iy, ix]:
                        continue
                    ssz = clamp(2.0 * float(half[iy, ix]) * (0.9 + rng.random() * 0.2),
                                smin, smax)
                    ang = math.atan2(float(dirs[iy, ix, 1]), float(dirs[iy, ix, 0]))
                    ang += math.radians((rng.random() * 2.0 - 1.0) * 8.0)
                    ang += math.radians((rng.random() * 2.0 - 1.0) * 30.0 * jitter)
                    length = ssz * (llo + rng.random() * max(0.0, lhi - llo))
                    self.step_size = clamp(ssz * 0.5, 1.5, 6.0)
                    raw = self.build_path(cx, cy, dirs, ang, length / 2.0, curv,
                                          field, lab_lvl, lab_lvl[iy, ix], drift)
                    npts = int(clamp(round(path_length(raw) / max(1.0, ssz)) + 4, 6, 14))
                    pts = self.smooth_path(raw, npts)
                    # one colour per stroke: the median of the mark-scale target
                    # under the path, and the pressure of its darkness
                    px = np.clip(np.round([p[0] for p in pts]).astype(np.int64), 0, self.W - 1)
                    py = np.clip(np.round([p[1] for p in pts]).astype(np.int64), 0, self.H - 1)
                    lab = np.median(mark_lab[py, px], axis=0).astype(np.float32)
                    if grp is not None and not self.group_ok(layer.get("color_group"),
                                                             lab, gslack):
                        continue
                    if by_deficit:
                        ti = float(ink_t[iy, ix])
                        ratio = clamp(float(dmap[iy, ix]) / ti, 0.0, 1.0) if ti > 1e-6 else 0.0
                        pressure = self.deficit_pressure(press, ratio)
                    else:
                        dark = clamp((paper_L - float(lab[0])) / paper_L, 0.0, 1.0)
                        pressure = self.trace_pressure(press, dark)
                    lab[0] = clamp(float(lab[0]) + (rng.random() * 2.0 - 1.0) * 2.0, 0.0, 100.0)
                    lab[0] = clamp(float(lab[0]) * (1.0 + value), 0.0, 100.0)
                    lab[1] *= (1.0 + sat)
                    lab[2] *= (1.0 + sat)
                    colour = np.clip(lab_to_rgb(lab), 0.0, 255.0)
                    alpha = alo + rng.random() * max(0.0, ahi - alo)
                    box = bbox_of(pts, ssz + 6.0, self.W, self.H)
                    if box[2] <= box[0] or box[3] <= box[1]:
                        continue
                    act = self.stroke_action(tool, pts, ssz, alpha, colour, pressure)
                    crop = self.q.crop_box(box)
                    sub = self.canvas[crop[1]:crop[3], crop[0]:crop[2]].copy()
                    render_stroke(sub, act, rng, crop[2] - crop[0], crop[3] - crop[1],
                                  crop[0], crop[1])
                    gain, payload = self.q.delta(box, crop, sub)
                    if best is None or gain > best[0]:
                        best = (gain, payload, act)
                ok = best is not None and (best[0] > 0.0 if threshold <= 0.0
                                           else best[0] >= threshold)
                if not ok:
                    fails += 1
                    continue
                fails = 0
                gain, payload, act = best
                q_pre = self.q.value()
                self.q.commit(payload)
                self.emit(act)
                kept += 1
                path_px += path_length(act["pts"])
                if live and kept - checked >= INK_RECHECK:
                    # the canvas is in memory, so a fresh measurement costs one
                    # blur: read the density again every INK_RECHECK strokes
                    dmap, deficit = measure()
                    checked = kept
                    if stop_de is not None and deficit <= stop_de:
                        break          # the round ends; the while head stops the layer
                if tests < SELFTEST_PER_LAYER:
                    tests += 1
                    full = QQ.QMetric(self.target, self.d.get("metric"))
                    q_full = full.set_image(self.q.img)
                    err = abs(q_full - self.q.value())
                    self.selftest.append({
                        "layer": layer.get("name"), "size": base, "stroke": len(self.actions),
                        "q_incremental": self.q.value(), "q_full": q_full, "abs_err": err,
                        "gain": gain, "gain_full": q_pre - q_full,
                    })
                    if err > SELFTEST_TOL:
                        raise SystemExit(
                            "painter2: Q self-test failed on layer %s size %g: "
                            "incremental %.9f vs full %.9f (err %.3e)"
                            % (layer.get("name"), base, self.q.value(), q_full, err))
            if self.nstrokes >= self.max_strokes:
                break
        dmap, deficit = measure()
        if self.nstrokes >= self.max_strokes:
            stop_reason = "budget"
        elif stop_de is not None and deficit <= stop_de:
            stop_reason = "deficit"
        elif kept >= count:
            stop_reason = "max_count" if stop_de is not None else "count"
        elif fails >= FAIL_STREAK:
            stop_reason = "seeds"
        elif rounds >= max_rounds:
            stop_reason = "rounds"
        secs = time.time() - t0
        print("[trace] %-14s kept %5d/%-5d  ink deficit %5.2f -> %5.2f%s  "
              "pressure %-8s stop: %-9s %5.1f s"
              % (layer.get("name"), kept, count, deficit_before, deficit,
                 (" (target %.2f)" % stop_de) if stop_de is not None else "",
                 press_from, stop_reason, secs), flush=True)
        stats.append({
            "layer": layer.get("name"), "level": lv, "size": base,
            "mode": "trace", "tried": tried, "kept": kept, "count": count,
            "path_px": path_px, "seed_px": int(seed_mask.sum()), "rounds": rounds,
            "pressure_from": press_from, "stop_deficit": stop_de,
            "deficit_before": deficit_before, "deficit_after": deficit,
            "stop_reason": stop_reason,
            "q_before": q_before, "q_after": self.q.value(),
            "seconds": secs,
        })

    # -- the run -----------------------------------------------------------

    def layer_specs(self, layer):
        """A trace layer may carry its size/count on the layer itself; every
        other layer lists its pyramid levels as v4 does."""
        levels = layer.get("levels")
        if levels:
            return levels
        if layer.get("mode") == "trace":
            return [{"size": layer.get("size", [3.0, 9.0]),
                     "count": int(layer.get("count", 0) or 0),
                     "threshold": layer.get("threshold", 0.0)}]
        return []

    def run(self):
        t0 = time.time()
        stats = []
        ground_s = self.ground()
        # where the crayon is: it starts at the top-left corner and then stays
        # where the last stroke left it. The per-layer travel chains through
        # this cursor, so the table's TOTAL is the run's real pen-up travel and
        # the sweep also minimizes the jump into the next layer.
        cursor = (0.0, 0.0)
        gstrokes = [a for a in self.actions if a.get("t") == "stroke"]
        if gstrokes:
            gt = travel_of(gstrokes, cursor)
            self.travel.append({
                "layer": "ground", "order": "placed", "strokes": len(gstrokes),
                "travel_placed": gt, "travel": gt,
                "path_px": sum(path_length(a["pts"]) for a in gstrokes),
            })
            cursor = (float(gstrokes[-1]["pts"][-1][0]), float(gstrokes[-1]["pts"][-1][1]))
        for li, layer in enumerate(self.d.get("layers", [])):
            name = layer.get("name", "layer%d" % li)
            rname = layer.get("region")
            mask = self.regions.mask(rname) if rname else np.ones((self.H, self.W), np.uint8)
            over = int(layer.get("overflow", 0) or 0)
            if over > 0:
                k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * over + 1, 2 * over + 1))
                inside = cv2.dilate(mask, k) > 0
            else:
                inside = mask > 0
            mode = str(layer.get("mode", "block"))
            if mode not in MODES:
                raise SystemExit("painter2: layer %r asks for unknown mode %r (have %s)"
                                 % (name, mode, ", ".join(MODES)))
            first = len(self.actions)
            for lv, spec in enumerate(self.layer_specs(layer)):
                rng = np.random.default_rng([self.seed, li, lv])
                if mode == "trace":
                    self.run_trace(layer, li, lv, spec, mask, inside, rng, stats)
                else:
                    self.run_level(layer, li, lv, spec, mask, inside, rng, stats)
                if self.nstrokes >= self.max_strokes:
                    break
            # stroke order inside the layer: "sweep" walks the crayon from one
            # mark to the nearest next one, which is how a hand fills a page
            body = self.actions[first:]
            order = str(layer.get("order", "sweep" if mode == "trace" else "placed"))
            before = travel_of(body, cursor)
            after = before
            if order == "sweep" and len(body) > 1:
                ordered, after = sweep_strokes(body, cursor)
                self.actions[first:] = ordered
                self.reordered = True
                body = ordered
            if body:
                cursor = (float(body[-1]["pts"][-1][0]), float(body[-1]["pts"][-1][1]))
            self.travel.append({
                "layer": name, "order": order, "strokes": len(body),
                "travel_placed": before, "travel": after,
                "path_px": sum(path_length(a["pts"]) for a in body),
            })
            # the mark closes the layer, as demo_plan.js does, so the harness
            # checkpoint named after a layer shows that layer finished
            self.emit({"t": "mark", "name": name})
            if self.nstrokes >= self.max_strokes:
                break
        if self.reordered:
            # the strokes now go down in a different order than they were
            # scored in, so the canvas (and Q, and error.png) is rebuilt from
            # the action list itself: what render.mjs will draw
            t1 = time.time()
            self.q.set_image(render_actions(self.actions, self.W, self.H, self.seed))
            self.canvas = self.q.img
            self.rerender_seconds = time.time() - t1
        self.seconds = time.time() - t0
        self.ground_seconds = ground_s
        self.stats = stats
        return stats


# ---------------------------------------------------------------------------
# reports
# ---------------------------------------------------------------------------

def write_reports(p, args):
    os.makedirs(p.out, exist_ok=True)
    strokes = [a for a in p.actions if a.get("t") == "stroke"]
    with open(os.path.join(p.out, "actions.json"), "w") as fh:
        json.dump(p.actions, fh)
    cv2.imwrite(os.path.join(p.out, "preview.png"),
                cv2.cvtColor(np.clip(p.canvas, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))
    QQ.heat_png(p.q.contribution(), os.path.join(p.out, "error.png"))

    # the headline numbers come from a fresh full-canvas computation, not from
    # the running incremental sums; the gap is the end-of-run self-test
    q_inc = p.q.value()
    t_target, _q_full = QQ.terms_of(p.target, np.clip(p.canvas, 0, 255), p.d.get("metric"))
    q_target = t_target["q"]
    p.selftest.append({"layer": "FINAL", "size": 0, "stroke": len(p.actions),
                       "q_incremental": q_inc, "q_full": q_target,
                       "abs_err": abs(q_inc - q_target), "gain": 0.0, "gain_full": 0.0})
    photo = QQ.load_rgb(p.photo_path, (p.W, p.H)) if p.photo_path else None
    if photo is not None:
        t_photo, _ = QQ.terms_of(photo, np.clip(p.canvas, 0, 255), p.d.get("metric"))
    else:
        t_photo = None

    rep = {
        "canvas": [p.W, p.H],
        "seed": p.seed,
        "max_strokes": p.max_strokes,
        "actions": len(p.actions),
        "strokes": len(strokes),
        "seconds": p.seconds,
        "ground_seconds": p.ground_seconds,
        "rerender_seconds": p.rerender_seconds,
        "paper": hex_of(p.paper),
        "paper_tol": p.paper_tol,
        "path_px": sum(path_length(a["pts"]) for a in strokes),
        "travel_px": travel_of(strokes),
        "travel": p.travel,
        "tools": sorted({a.get("tool") for a in strokes}),
        "q_vs_target": {"q": q_target, "ms_ssim": t_target["ms_ssim"],
                        "gms": t_target["gms"], "delta_e": t_target["delta_e"],
                        "q_incremental": q_inc},
        "q_vs_photo": ({"q": t_photo["q"], "ms_ssim": t_photo["ms_ssim"],
                        "gms": t_photo["gms"], "delta_e": t_photo["delta_e"]}
                       if t_photo else None),
        "levels": p.stats,
        "selftest": {"tolerance": SELFTEST_TOL, "checks": len(p.selftest),
                     "worst_abs_err": max([s["abs_err"] for s in p.selftest] or [0.0]),
                     "samples": p.selftest},
    }
    with open(os.path.join(p.out, "report.json"), "w") as fh:
        json.dump(rep, fh, indent=1)

    L = []
    L.append("painter2 run   %s" % os.path.abspath(p.out))
    L.append("canvas %dx%d   seed %d   max strokes %d" % (p.W, p.H, p.seed, p.max_strokes))
    L.append("actions %d   strokes %d   tools %s" % (len(p.actions), len(strokes),
                                                     ", ".join(rep["tools"])))
    L.append("time %.1f s  (ground pass %.1f s, rerender %.1f s)"
             % (p.seconds, p.ground_seconds, p.rerender_seconds))
    L.append("paper %s (dE > %.0f is pigment)   path %.0f px   pen-up travel %.0f px"
             % (rep["paper"], p.paper_tol, rep["path_px"], rep["travel_px"]))
    L.append("")
    L.append("Q vs target   %.6f   (MS-SSIM %.4f, GMS %.4f, Lab dE %.2f)"
             % (q_target, t_target["ms_ssim"], t_target["gms"], t_target["delta_e"]))
    if t_photo:
        L.append("Q vs photo    %.6f   (MS-SSIM %.4f, GMS %.4f, Lab dE %.2f)"
                 % (t_photo["q"], t_photo["ms_ssim"], t_photo["gms"], t_photo["delta_e"]))
    L.append("")
    L.append("Q self-test (incremental box delta vs full-canvas recomputation,")
    L.append("            first 3 kept strokes of every level, plus the finished picture)")
    L.append("  %d checks, tolerance %.0e, worst error %.3e  -> %s"
             % (len(p.selftest), SELFTEST_TOL, rep["selftest"]["worst_abs_err"],
                "PASS" if rep["selftest"]["worst_abs_err"] <= SELFTEST_TOL else "FAIL"))
    L.append("")
    L.append("%-16s %-4s %-6s %-7s %-7s %-9s %-11s %-11s %-7s"
             % ("layer", "lvl", "size", "tried", "kept", "path px",
                "Q before", "Q after", "sec"))
    for s in p.stats:
        L.append("%-16s %-4d %-6.4g %-7d %-7d %-9.0f %-11.6f %-11.6f %-7.1f"
                 % (s["layer"], s["level"], s["size"], s["tried"], s["kept"],
                    s.get("path_px", 0.0), s["q_before"], s["q_after"], s["seconds"]))
    tried = sum(s["tried"] for s in p.stats)
    kept = sum(s["kept"] for s in p.stats)
    L.append("%-16s %-4s %-6s %-7d %-7d %-9.0f"
             % ("TOTAL", "", "", tried, kept, sum(s.get("path_px", 0.0) for s in p.stats)))
    L.append("")
    dens = [s for s in p.stats if s.get("deficit_before") is not None]
    if dens:
        # ink = Lab dE from the paper colour; the deficit is the mean of
        # max(0, ink_target - ink_canvas) over the layer's own pixels
        L.append("ink density (Lab dE from the paper, over the layer's own pixels)")
        L.append("%-16s %-7s %-9s %-9s %-8s %-9s %-7s %s"
                 % ("layer", "kept", "deficit", "-> after", "stop at", "pressure",
                    "rounds", "stop"))
        for s in dens:
            L.append("%-16s %-7d %-9.2f %-9.2f %-8s %-9s %-7d %s"
                     % (s["layer"], s["kept"], s["deficit_before"], s["deficit_after"],
                        ("%.2f" % s["stop_deficit"]) if s.get("stop_deficit") is not None
                        else "-", s.get("pressure_from", "darkness"),
                        s.get("rounds", 0), s.get("stop_reason", "")))
        L.append("")
    if p.travel:
        # the per-layer rows chain through the pen position, so their TOTAL is
        # the same number as the headline pen-up travel; say so if it ever drifts
        tsum = sum(t["travel"] for t in p.travel)
        if abs(tsum - rep["travel_px"]) > max(1.0, 1e-6 * rep["travel_px"]):
            raise SystemExit("painter2: travel accounting mismatch: table total "
                             "%.1f px vs run total %.1f px" % (tsum, rep["travel_px"]))
        L.append("stroke order (pen-up travel, plan px)")
        L.append("%-16s %-8s %-8s %-11s %-11s %-11s"
                 % ("layer", "order", "strokes", "path", "as placed", "as ordered"))
        for t in p.travel:
            L.append("%-16s %-8s %-8d %-11.0f %-11.0f %-11.0f"
                     % (t["layer"], t["order"], t["strokes"], t["path_px"],
                        t["travel_placed"], t["travel"]))
        L.append("%-16s %-8s %-8d %-11.0f %-11.0f %-11.0f"
                 % ("TOTAL", "", sum(t["strokes"] for t in p.travel),
                    sum(t["path_px"] for t in p.travel),
                    sum(t["travel_placed"] for t in p.travel),
                    sum(t["travel"] for t in p.travel)))
        L.append("")
    L.append("files: actions.json, preview.png, error.png, report.json, report.txt")
    with open(os.path.join(p.out, "report.txt"), "w") as fh:
        fh.write("\n".join(L) + "\n")
    print("\n".join(L))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description="v4 stroke placer")
    ap.add_argument("--direction", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--max-strokes", type=int, default=None)
    a = ap.parse_args(argv)

    with open(a.direction) as fh:
        d = json.load(fh)
    base = os.path.dirname(os.path.abspath(a.direction))
    for k in ("target", "reference"):
        if d.get(k) and not os.path.isabs(d[k]):
            d[k] = os.path.normpath(os.path.join(base, d[k]))
    seed = a.seed if a.seed is not None else int(d.get("seed", 7))
    mx = a.max_strokes if a.max_strokes is not None else int(d.get("max_strokes", 15000))

    os.makedirs(a.out, exist_ok=True)
    p = Painter(d, a.out, seed, mx)
    p.run()
    write_reports(p, a)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
