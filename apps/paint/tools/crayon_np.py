#!/usr/bin/env python3
"""The crayon tool and the paper, in numpy: a mirror of engine.js.

engine.js is the truth. Everything here reproduces it step for step - the same
integer hash, the same lattice, the same footprint walk, the same smoothstep
against the paper tooth, the same 8-bit rounding at the end - so painter2.py can
preview a crayon drawing without a browser and get the same picture the renderer
will make (a mean absolute difference of a level or two, from 8-bit compositing
inside Chrome).

    from crayon_np import paper_height, draw_crayon, draw_paper_ground

    paper = paper_height(w, h, seed=1, scale=1.0)
    draw_crayon(canvas, pts, size, (r, g, b), alpha=0.9, pressure=0.7, paper=paper)

Lengths are canvas pixels, not plan units: a caller that renders at --scale 2
multiplies `size` and `pts` itself and asks paper_height for scale=2, exactly as
the engine does. The tool is deterministic: the mark comes from the paper, never
from a PRNG, so `rng` is accepted only to keep the tool signatures uniform.
"""

import math

import numpy as np

# ---------------------------------------------------------------------------
# constants, shared with engine.js
# ---------------------------------------------------------------------------

PAPER_FINE = 2.5        # fine tooth period, plan px
PAPER_COARSE = 11.0     # coarse tooth period, plan px
PAPER_MIX = 0.6         # weight of the fine scale in H
PAPER_TINT = 4.0        # clear{paper:true} tints the ground by +-2 levels

CRAYON_STEP = 0.25      # footprint walk, as a fraction of size
CRAYON_SOFT = 0.30      # half width of the smoothstep against the tooth
CRAYON_DEPOSIT = 0.28   # wax laid per stamp at full pressure (the passes build up)
CRAYON_RAG = 0.25       # raggedness added to the footprint edge
CRAYON_EDGE = 0.3       # the footprint holds full pressure to 1 - this
CRAYON_RAMP = 0.08      # pressure ramp, as a fraction of the path
CRAYON_RIM = 0.03       # the two long edges sit 3% darker

_U32 = np.uint32


# ---------------------------------------------------------------------------
# the paper
# ---------------------------------------------------------------------------

def hash2(ix, iy, salt):
    """32-bit integer hash of a lattice point -> [0, 1). Mirrors engine.js."""
    ix = np.asarray(ix, np.int64).astype(_U32)
    iy = np.asarray(iy, np.int64).astype(_U32)
    s = _U32(np.uint32(np.int64(salt) & 0xFFFFFFFF))
    with np.errstate(over="ignore"):    # uint32 wrap-around is the point
        h = (ix * _U32(0x27d4eb2d)) ^ (iy * _U32(0x85ebca6b)) ^ (s * _U32(0x9e3779b1))
        h = (h ^ (h >> _U32(15))) * _U32(0x2c1b3c6d)
        h = (h ^ (h >> _U32(13))) * _U32(0x297a2d39)
        h = h ^ (h >> _U32(16))
    return h.astype(np.float64) / 4294967296.0


def value_noise(w, h, period, salt):
    """Value noise on a w x h grid: one hashed lattice point every `period` px,
    sampled at pixel centres with a smoothstep fade."""
    gw = int(math.ceil(w / period)) + 2
    gh = int(math.ceil(h / period)) + 2
    gx = np.arange(gw)
    gy = np.arange(gh)
    lat = hash2(gx[None, :], gy[:, None], salt).astype(np.float32).astype(np.float64)

    fx = (np.arange(w) + 0.5) / period
    fy = (np.arange(h) + 0.5) / period
    ix = np.floor(fx).astype(np.int64)
    iy = np.floor(fy).astype(np.int64)
    tx = fx - ix
    ty = fy - iy
    ux = (tx * tx * (3.0 - 2.0 * tx))[None, :]
    uy = (ty * ty * (3.0 - 2.0 * ty))[:, None]

    a = lat[np.ix_(iy, ix)]
    b = lat[np.ix_(iy, ix + 1)]
    c = lat[np.ix_(iy + 1, ix)]
    d = lat[np.ix_(iy + 1, ix + 1)]
    top = a + (b - a) * ux
    bot = c + (d - c) * ux
    return (top + (bot - top) * uy).astype(np.float32)


class Paper:
    """The sheet: two noise scales and the height map H they mix into.

    H = 0.6 * fine + 0.4 * coarse, in [0, 1]. `fine` is also the raggedness of
    the crayon footprint and `coarse` is the tint of a papered ground, so both
    scales are kept.
    """

    __slots__ = ("w", "h", "fine", "coarse", "seed", "scale")

    def __init__(self, w, h, fine, coarse, seed, scale):
        self.w = int(w)
        self.h = int(h)
        self.fine = fine
        self.coarse = coarse
        self.seed = seed
        self.scale = scale

    @property
    def height(self):
        return PAPER_MIX * self.fine + (1.0 - PAPER_MIX) * self.coarse


def paper_height(w, h, seed=1, scale=1.0):
    """The paper for a w x h canvas rendered at `scale`. Same sheet, drawn
    bigger: the noise periods are multiplied by the scale."""
    w = int(w)
    h = int(h)
    seed = int(seed)
    fine = value_noise(w, h, PAPER_FINE * scale, (seed * 2 + 1) & 0xFFFFFFFF)
    coarse = value_noise(w, h, PAPER_COARSE * scale, (seed * 2 + 2) & 0xFFFFFFFF)
    return Paper(w, h, fine, coarse, seed, scale)


def draw_paper_ground(canvas, color, paper):
    """{t:"clear", color, paper:true}: fill with `color`, then tint by the coarse
    tooth, +-2 levels, so an untouched area reads as paper rather than a flat
    fill. `canvas` is a float (h, w, 3) array in 0..255, written in place."""
    col = np.asarray(color, np.float64).reshape(1, 1, 3)
    tint = ((paper.coarse - 0.5) * PAPER_TINT)[:, :, None]
    canvas[:, :, :] = np.clip(np.floor(col + tint + 0.5), 0.0, 255.0)
    return canvas


# ---------------------------------------------------------------------------
# the crayon
# ---------------------------------------------------------------------------

def _dir_at(pts, j):
    a = pts[max(0, j - 1)]
    b = pts[min(len(pts) - 1, j + 1)]
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy)
    if ln < 1e-6:
        return (1.0, 0.0)
    return (dx / ln, dy / ln)


def _walk(pts, step):
    """A stamp centre and its direction every `step` px, the start included.
    The k-th stamp sits at arc length k*step. Mirrors engine.js walk()."""
    step = max(0.5, step)
    u0 = _dir_at(pts, 0)
    xs = [pts[0][0]]
    ys = [pts[0][1]]
    uxs = [u0[0]]
    uys = [u0[1]]
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
            xs.append(ax + ux * t)
            ys.append(ay + uy * t)
            uxs.append(ux)
            uys.append(uy)
            t += step
        carry = ln - (t - step)
    return (np.array(xs), np.array(ys), np.array(uxs), np.array(uys))


def _norm_pts(pts):
    out = [(float(p[0]), float(p[1])) for p in pts]
    if len(out) == 1:
        out.append((out[0][0] + 0.01, out[0][1]))
    return out


def crayon_coverage(pts, size, pressure, paper, x0, y0, bw, bh):
    """The wax a single crayon stroke leaves on the box (x0, y0, bw, bh).

    Returns (cov, rim): the stroke's own alpha in [0, 1] and, per pixel, the
    coverage-weighted mean distance across the path in [0, 1] (0 on the centre
    line, 1 at the rails), which drives the darker rim.

    A soft square of side `size`, turned to the path, is walked along it every
    size*0.25 px. Inside the footprint the local pressure is
        p = pressure * edge(d) * ramp(t)
    with d the Chebyshev distance in the footprint's own frame and edge() at
    full pressure under the flat of the tip, falling to 0 over the outer 30% of
    the footprint, its shoulder moved about by the fine noise so the two rails
    come out ragged. ramp() rises over the first 8% of the path and falls over
    the last 8%. The wax lands where the pressure beats the tooth:
        c = smoothstep(H - 0.15, H + 0.15, p)
    Stamps compose over each other, which is order independent for one colour
    (1 - cov is the product of 1 - c), so the sum runs in log space.
    """
    pts = _norm_pts(pts)
    half = max(0.5, size / 2.0)
    step = max(0.5, size * CRAYON_STEP)
    n = int(math.ceil(1.6 * half)) + 1
    cov = np.zeros((bh, bw), np.float64)
    rim = np.zeros((bh, bw), np.float64)
    if bw <= 0 or bh <= 0:
        return cov, rim

    L = 0.0
    for i in range(1, len(pts)):
        L += math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])

    X, Y, UX, UY = _walk(pts, step)
    t = np.arange(len(X), dtype=np.float64) * step
    if L < step:                       # no room to ramp: a single dab
        ramp = np.ones_like(t)
    else:
        ramp = np.minimum(1.0, np.minimum(t, L - t) / (CRAYON_RAMP * L))
    keep = ramp > 0
    if not keep.any():
        return cov, rim
    X, Y, UX, UY, ramp = X[keep], Y[keep], UX[keep], UY[keep], ramp[keep]
    pk = pressure * ramp

    off = np.arange(-n, n + 1)
    k = len(X)
    m = len(off)
    px = (np.floor(X).astype(np.int64)[:, None] + off[None, :])[:, None, :]
    py = (np.floor(Y).astype(np.int64)[:, None] + off[None, :])[:, :, None]
    px = np.broadcast_to(px, (k, m, m))
    py = np.broadcast_to(py, (k, m, m))

    dx = px + 0.5 - X[:, None, None]
    dy = py + 0.5 - Y[:, None, None]
    da = np.abs(dx * UX[:, None, None] + dy * UY[:, None, None]) / half
    db = np.abs(dy * UX[:, None, None] - dx * UY[:, None, None]) / half
    dd = np.maximum(da, db)

    sel = ((px >= x0) & (px < x0 + bw) & (py >= y0) & (py < y0 + bh) &
           (px >= 0) & (px < paper.w) & (py >= 0) & (py < paper.h) &
           (dd < 1.0 + CRAYON_RAG * 0.5))
    if not sel.any():
        return cov, rim

    ddv = dd[sel]
    dbv = db[sel]
    pkv = np.broadcast_to(pk[:, None, None], (k, m, m))[sel]
    pxv = px[sel]
    pyv = py[sel]
    flat = pyv * paper.w + pxv
    fine = paper.fine.ravel()[flat].astype(np.float64)
    coarse = paper.coarse.ravel()[flat].astype(np.float64)

    e = (1.0 - ddv + CRAYON_RAG * (fine - 0.5)) / CRAYON_EDGE
    ok = e > 0.0
    if not ok.any():
        return cov, rim
    e = np.minimum(e[ok], 1.0)
    hgt = PAPER_MIX * fine[ok] + (1.0 - PAPER_MIX) * coarse[ok]
    u = np.clip((pkv[ok] * e - hgt + CRAYON_SOFT) / (2.0 * CRAYON_SOFT), 0.0, 1.0)
    c = u * u * (3.0 - 2.0 * u)
    c = c * (CRAYON_DEPOSIT * (0.4 + 0.6 * pkv[ok]))   # a pass leaves a fraction of wax; pressure sets how much
    hit = c > 0.0
    if not hit.any():
        return cov, rim
    c = c[hit]
    bi = ((pyv[ok][hit] - y0) * bw + (pxv[ok][hit] - x0))
    dbv = np.minimum(dbv[ok][hit], 1.0)

    npix = bw * bh
    with np.errstate(divide="ignore"):
        lg = np.log1p(-np.minimum(c, 1.0))
    cov = (1.0 - np.exp(np.bincount(bi, weights=lg, minlength=npix))).reshape(bh, bw)
    wsum = np.bincount(bi, weights=c, minlength=npix)
    dsum = np.bincount(bi, weights=c * dbv, minlength=npix)
    rim = np.where(wsum > 0, dsum / np.maximum(wsum, 1e-12), 0.0).reshape(bh, bw)
    return cov, rim


def crayon_colour_map(cov, rim, color):
    """The stroke's colour per pixel: the two long edges sit 3% darker, then the
    8-bit rounding engine.js does when it writes the ImageData."""
    tt = np.clip((rim - 0.5) / 0.5, 0.0, 1.0)
    f = (1.0 - CRAYON_RIM * tt * tt * (3.0 - 2.0 * tt))[:, :, None]
    col = np.asarray(color, np.float64).reshape(1, 1, 3) * f
    col = np.clip(np.floor(col + 0.5), 0.0, 255.0)
    a = np.floor(np.clip(cov, 0.0, 1.0) * 255.0 + 0.5) / 255.0
    return col, a


def draw_crayon(layer_rgba_or_canvas, pts, size, color, alpha=1.0, pressure=0.7,
                paper=None, rng=None, origin=None):
    """Render one crayon stroke.

    Only the stroke's own box is touched, the way the engine's per-action layer
    is, so the cost follows the mark and not the canvas.

    layer_rgba_or_canvas is one of
      * a painter2 Layer (anything with .P, .A, .x0, .y0, .w, .h): the stroke's
        coverage and colour are added to it and the CALLER composites, so the
        stroke lands on the canvas once at `alpha` like every other tool;
      * a float (h, w, 4) RGBA array, straight alpha, colour 0..255 and alpha
        0..1: the stroke composites into it, `alpha` included;
      * a float (h, w, 3) canvas in 0..255: the stroke composites into it,
        `alpha` included.
    pts and size are in canvas pixels. `paper` comes from paper_height() for the
    whole canvas; it is built on the spot for a bare canvas if left out.
    `rng` is accepted for a uniform tool signature and is not used: the crayon is
    deterministic, its grain comes from the paper.
    """
    target = layer_rgba_or_canvas
    size = max(0.5, float(size))
    alpha = float(np.clip(alpha, 0.0, 1.0))
    pressure = float(np.clip(pressure, 0.0, 1.0))

    is_layer = hasattr(target, "P") and hasattr(target, "A")
    if is_layer:
        # painter2 already cut the layer to the stroke's box: use it as it is
        ox, oy = int(target.x0), int(target.y0)
        x0, y0 = ox, oy
        bw, bh = int(target.w), int(target.h)
    else:
        arr = np.asarray(target)
        ah, aw = arr.shape[0], arr.shape[1]
        ox, oy = (0, 0) if origin is None else (int(origin[0]), int(origin[1]))
        # only the stroke's own box is touched, as the engine's layer does
        scale = 1.0 if paper is None else float(paper.scale)
        pad = size + 6.0 * scale
        px = [float(p[0]) for p in pts]
        py = [float(p[1]) for p in pts]
        x0 = int(np.clip(math.floor(min(px) - pad), ox, ox + aw))
        y0 = int(np.clip(math.floor(min(py) - pad), oy, oy + ah))
        x1 = int(np.clip(math.ceil(max(px) + pad), ox, ox + aw))
        y1 = int(np.clip(math.ceil(max(py) + pad), oy, oy + ah))
        bw, bh = x1 - x0, y1 - y0
    if bw <= 0 or bh <= 0:
        return

    if paper is None:
        paper = paper_height(x0 + bw, y0 + bh, 1, 1.0)

    cov, rim = crayon_coverage(pts, size, pressure, paper, x0, y0, bw, bh)
    if not cov.any():
        return
    col, a = crayon_colour_map(cov, rim, color)

    if is_layer:
        target.add_full(a.astype(np.float32), col.astype(np.float32))
        return

    arr = target
    sub = arr[y0 - oy:y0 - oy + bh, x0 - ox:x0 - ox + bw]
    if arr.shape[2] == 4:
        src_a = (a * alpha)[:, :, None]
        dst_a = sub[:, :, 3:4]
        out_a = src_a + dst_a * (1.0 - src_a)
        num = col * src_a + sub[:, :, :3] * dst_a * (1.0 - src_a)
        sub[:, :, :3] = np.where(out_a > 1e-9, num / np.maximum(out_a, 1e-9), sub[:, :, :3])
        sub[:, :, 3:4] = out_a
    else:
        w = (a * alpha)[:, :, None]
        sub[:, :, :3] *= (1.0 - w)
        sub[:, :, :3] += col * w
    return
