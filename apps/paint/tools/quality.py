#!/usr/bin/env python3
"""quality.py - the picture quality metric Q (contract: work/v4/PAINTER_SPEC.md, Part C).

    python quality.py --ref <png> --img <png> [--regions direction.json] --out <dir>

Q = w1 * (1 - MS-SSIM(gray, 3 scales))
  + w2 * GMS   (1 - mean similarity of Sobel gradient magnitudes, on gray)
  + w3 * (mean Lab dE / 100)

Lower is better. Every term is the average of a per-pixel windowed term, so

  * a per-pixel contribution map exists (error.png, and the placer's seed map), and
  * a change confined to a box changes Q only inside that box grown by the
    window halo, so Q can be updated incrementally on a padded box and still
    equal the full-canvas recomputation.

`QMetric` is the incremental engine painter2.py imports. `q_of` and `terms_of`
are the one-shot helpers for the CLI and the reports.
"""

import argparse
import json
import os

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------

SCALES = 3                 # MS-SSIM scales: level 0, 1, 2
SSIM_KSIZE = 11            # gaussian window, radius 5
SSIM_SIGMA = 1.5
SSIM_C1 = (0.01 * 255.0) ** 2
SSIM_C2 = (0.03 * 255.0) ** 2
SCALE_WEIGHTS = (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0)
GMS_T = 170.0              # GMSD stability constant, gray 0..255
DEFAULT_WEIGHTS = {"ms_ssim": 0.5, "gradient": 0.3, "color": 0.2}

# Halos, in level-0 pixels, around the changed box.
#   SSIM window radius 5 at level s  ->  5 * 2**s level-0 px
#   pyrDown support (5x5, radius 2)  ->  2 * (2**s - 1) level-0 px
#   worst case at s = 2: 5*4 + 2*3 = 26
_HALO_CHANGE = 32          # >= 26: everything outside the box grown by this is untouched
_HALO_CROP = 32            # >= 26: extra ring so the values inside the update box are exact
_ALIGN = 1 << (SCALES - 1)  # crop origin must sit on the pyramid grid
# tighter boxes for the terms that live at level 0 only
_HALO_L0_CHANGE = 8        # SSIM level 0 window radius 5, plus slack
_HALO_L0_CROP = 8


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

def load_rgb(path, size=None):
    """Read a PNG as float32 RGB 0..255, optionally resized to (w, h)."""
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit("quality: cannot read image " + str(path))
    if size is not None and (img.shape[1] != size[0] or img.shape[0] != size[1]):
        interp = cv2.INTER_AREA if img.shape[1] > size[0] else cv2.INTER_CUBIC
        img = cv2.resize(img, (int(size[0]), int(size[1])), interpolation=interp)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32)


def to_gray(rgb):
    """RGB 0..255 float32 -> gray 0..255 float32."""
    return cv2.cvtColor(np.ascontiguousarray(rgb, np.float32), cv2.COLOR_RGB2GRAY)


def to_lab(rgb):
    """RGB 0..255 float32 -> CIE Lab, L 0..100."""
    return cv2.cvtColor(np.ascontiguousarray(rgb, np.float32) / 255.0, cv2.COLOR_RGB2LAB)


def _blur(a):
    return cv2.GaussianBlur(a, (SSIM_KSIZE, SSIM_KSIZE), SSIM_SIGMA,
                            borderType=cv2.BORDER_REFLECT_101)


def ssim_map(a, b):
    """Per-pixel SSIM of two gray planes (0..255), gaussian 11x11 sigma 1.5."""
    mu1 = _blur(a)
    mu2 = _blur(b)
    mu1s = mu1 * mu1
    mu2s = mu2 * mu2
    mu12 = mu1 * mu2
    s11 = _blur(a * a) - mu1s
    s22 = _blur(b * b) - mu2s
    s12 = _blur(a * b) - mu12
    num = (2.0 * mu12 + SSIM_C1) * (2.0 * s12 + SSIM_C2)
    den = (mu1s + mu2s + SSIM_C1) * (s11 + s22 + SSIM_C2)
    return num / den


def grad_mag(gray):
    """Sobel gradient magnitude of a gray plane (0..255)."""
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3, borderType=cv2.BORDER_REFLECT_101)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3, borderType=cv2.BORDER_REFLECT_101)
    return cv2.magnitude(gx, gy)


def gms_map(ga, gb):
    """Per-pixel gradient magnitude similarity, 0..1, 1 = identical."""
    return (2.0 * ga * gb + GMS_T) / (ga * ga + gb * gb + GMS_T)


def de_map(la, lb):
    """Per-pixel CIE76 Lab distance."""
    d = la - lb
    return np.sqrt((d * d).sum(axis=2))


def pyr_levels(gray, scales=SCALES):
    out = [gray]
    for _ in range(scales - 1):
        out.append(cv2.pyrDown(out[-1], borderType=cv2.BORDER_REFLECT_101))
    return out


# ---------------------------------------------------------------------------
# the incremental metric
# ---------------------------------------------------------------------------

class QMetric:
    """Full-canvas Q against a fixed reference, with exact box updates.

    Usage from the placer:

        q = QMetric(target_rgb, weights)
        q.set_image(canvas)                     # full recompute, O(picture)
        box = q.crop_box(stroke_box)            # the crop the candidate needs
        sub = canvas[box[1]:box[3], box[0]:box[2]].copy()
        ... render the candidate stroke into `sub` ...
        gain, payload = q.delta(stroke_box, box, sub)   # gain = Q_before - Q_after
        q.commit(payload)                       # only for the stroke you keep
    """

    def __init__(self, ref_rgb, weights=None, scales=SCALES):
        w = dict(DEFAULT_WEIGHTS)
        w.update(weights or {})
        self.w1 = float(w.get("ms_ssim", 0.5))
        self.w2 = float(w.get("gradient", 0.3))
        self.w3 = float(w.get("color", 0.2))
        self.scales = int(scales)
        self.ref = np.ascontiguousarray(ref_rgb, np.float32)
        self.H, self.W = self.ref.shape[:2]
        self.ref_gray = to_gray(self.ref)
        self.ref_pyr = pyr_levels(self.ref_gray, self.scales)
        self.ref_grad = grad_mag(self.ref_gray)
        self.ref_lab = to_lab(self.ref)
        self.shapes = [p.shape for p in self.ref_pyr]
        self.img = None

    # -- full recompute ----------------------------------------------------

    def set_image(self, img_rgb):
        img = np.ascontiguousarray(img_rgb, np.float32)
        if img.shape[:2] != (self.H, self.W):
            raise ValueError("quality: image size does not match the reference")
        self.img = img
        gray = to_gray(img)
        pyr = pyr_levels(gray, self.scales)
        self.ssim = [ssim_map(self.ref_pyr[s], pyr[s]) for s in range(self.scales)]
        self.gms = gms_map(self.ref_grad, grad_mag(gray))
        self.de = de_map(self.ref_lab, to_lab(img))
        self._sums = [float(m.sum()) for m in self.ssim]
        self._n = [float(m.size) for m in self.ssim]
        self._gms_sum = float(self.gms.sum())
        self._de_sum = float(self.de.sum())
        self._npix = float(self.gms.size)
        return self.value()

    # -- scalars -----------------------------------------------------------

    def ms_ssim(self):
        return sum(SCALE_WEIGHTS[s] * (self._sums[s] / self._n[s]) for s in range(self.scales))

    def terms(self):
        return {
            "ms_ssim": self.ms_ssim(),
            "gms": 1.0 - self._gms_sum / self._npix,
            "delta_e": self._de_sum / self._npix,
        }

    def value(self):
        t = self.terms()
        return (self.w1 * (1.0 - t["ms_ssim"])
                + self.w2 * t["gms"]
                + self.w3 * (t["delta_e"] / 100.0))

    def contribution(self):
        """Per-pixel contribution to Q, full resolution. Mean ~= Q."""
        acc = np.zeros((self.H, self.W), np.float32)
        for s in range(self.scales):
            m = self.ssim[s]
            if s:
                m = cv2.resize(m, (self.W, self.H), interpolation=cv2.INTER_NEAREST)
            acc += np.float32(SCALE_WEIGHTS[s]) * m
        out = self.w1 * (1.0 - acc)
        out += np.float32(self.w2) * (1.0 - self.gms)
        out += np.float32(self.w3 / 100.0) * self.de
        return out

    # -- boxes -------------------------------------------------------------

    def _grow(self, box, pad, align):
        x0 = max(0, int(box[0]) - pad)
        y0 = max(0, int(box[1]) - pad)
        x1 = min(self.W, int(box[2]) + pad)
        y1 = min(self.H, int(box[3]) + pad)
        x0 -= x0 % align
        y0 -= y0 % align
        if x1 < self.W:
            x1 = min(self.W, x1 + (-x1) % align)
        if y1 < self.H:
            y1 = min(self.H, y1 + (-y1) % align)
        return (x0, y0, x1, y1)

    def crop_box(self, box):
        """The canvas crop a candidate must hand back for an exact delta."""
        return self._grow(box, _HALO_CHANGE + _HALO_CROP, _ALIGN)

    def _level_box(self, box, s):
        """A level-0 box (origin on the pyramid grid) -> the level-s box."""
        h, w = self.shapes[s]
        x0 = box[0] >> s
        y0 = box[1] >> s
        x1 = w if box[2] >= self.W else min(w, box[2] >> s)
        y1 = h if box[3] >= self.H else min(h, box[3] >> s)
        return (x0, y0, max(x0, x1), max(y0, y1))

    # -- incremental delta -------------------------------------------------

    def delta(self, box, crop, sub_rgb):
        """Q_before - Q_after for a change confined to `box`.

        `sub_rgb` is the new image over `crop` (which must come from crop_box).
        Returns (gain, payload). A positive gain is an improvement.
        """
        sub = np.ascontiguousarray(sub_rgb, np.float32)
        cx0, cy0, cx1, cy1 = crop
        gray = to_gray(sub)

        # --- the two coarse SSIM scales need the whole wide crop ----------
        upd = self._grow(box, _HALO_CHANGE, _ALIGN)
        parts = []
        d_sum = [0.0] * self.scales
        pyr = [gray]
        for s in range(1, self.scales):
            pyr.append(cv2.pyrDown(pyr[-1], borderType=cv2.BORDER_REFLECT_101))

        # --- SSIM level 0 on a tight crop ---------------------------------
        tight = self._grow(box, _HALO_L0_CHANGE + _HALO_L0_CROP, 1)
        t_upd = self._grow(box, _HALO_L0_CHANGE, 1)
        ta = self.ref_gray[tight[1]:tight[3], tight[0]:tight[2]]
        tb = gray[tight[1] - cy0:tight[3] - cy0, tight[0] - cx0:tight[2] - cx0]
        m0 = ssim_map(ta, tb)
        sl = (slice(t_upd[1] - tight[1], t_upd[3] - tight[1]),
              slice(t_upd[0] - tight[0], t_upd[2] - tight[0]))
        new0 = np.ascontiguousarray(m0[sl])
        old0 = self.ssim[0][t_upd[1]:t_upd[3], t_upd[0]:t_upd[2]]
        d_sum[0] = float(new0.sum()) - float(old0.sum())
        parts.append((0, t_upd, new0))

        # --- SSIM levels 1.. on the wide crop -----------------------------
        for s in range(1, self.scales):
            cb = self._level_box(crop, s)
            ub = self._level_box(upd, s)
            ra = self.ref_pyr[s][cb[1]:cb[3], cb[0]:cb[2]]
            rb = pyr[s][:cb[3] - cb[1], :cb[2] - cb[0]]
            m = ssim_map(ra, rb)
            sl = (slice(ub[1] - cb[1], ub[3] - cb[1]), slice(ub[0] - cb[0], ub[2] - cb[0]))
            new = np.ascontiguousarray(m[sl])
            old = self.ssim[s][ub[1]:ub[3], ub[0]:ub[2]]
            d_sum[s] = float(new.sum()) - float(old.sum())
            parts.append((s, ub, new))

        # --- GMS: Sobel radius 1 ------------------------------------------
        gb = self._grow(box, 4, 1)
        gu = self._grow(box, 2, 1)
        gg = grad_mag(gray[gb[1] - cy0:gb[3] - cy0, gb[0] - cx0:gb[2] - cx0])
        rg = self.ref_grad[gb[1]:gb[3], gb[0]:gb[2]]
        gm = gms_map(rg, gg)
        sl = (slice(gu[1] - gb[1], gu[3] - gb[1]), slice(gu[0] - gb[0], gu[2] - gb[0]))
        new_g = np.ascontiguousarray(gm[sl])
        d_gms = float(new_g.sum()) - float(self.gms[gu[1]:gu[3], gu[0]:gu[2]].sum())

        # --- Lab dE: per pixel --------------------------------------------
        bx0, by0, bx1, by1 = (max(0, box[0]), max(0, box[1]),
                              min(self.W, box[2]), min(self.H, box[3]))
        lab = to_lab(sub[by0 - cy0:by1 - cy0, bx0 - cx0:bx1 - cx0])
        new_d = de_map(self.ref_lab[by0:by1, bx0:bx1], lab)
        d_de = float(new_d.sum()) - float(self.de[by0:by1, bx0:bx1].sum())

        dq = 0.0
        for s in range(self.scales):
            dq += -self.w1 * SCALE_WEIGHTS[s] * d_sum[s] / self._n[s]
        dq += -self.w2 * d_gms / self._npix
        dq += self.w3 * d_de / (100.0 * self._npix)
        payload = {
            "crop": crop, "box": (bx0, by0, bx1, by1), "sub": sub,
            "ssim": parts, "gms": (gu, new_g), "de": new_d,
            "d_sum": d_sum, "d_gms": d_gms, "d_de": d_de, "dq": dq,
        }
        return -dq, payload

    def commit(self, payload):
        """Apply a candidate: write its maps, sums and pixels into the state."""
        for s, box, new in payload["ssim"]:
            self.ssim[s][box[1]:box[3], box[0]:box[2]] = new
            self._sums[s] += payload["d_sum"][s]
        gu, new_g = payload["gms"]
        self.gms[gu[1]:gu[3], gu[0]:gu[2]] = new_g
        self._gms_sum += payload["d_gms"]
        b = payload["box"]
        self.de[b[1]:b[3], b[0]:b[2]] = payload["de"]
        self._de_sum += payload["d_de"]
        c = payload["crop"]
        self.img[c[1]:c[3], c[0]:c[2]] = payload["sub"]


# ---------------------------------------------------------------------------
# one-shot helpers
# ---------------------------------------------------------------------------

def terms_of(ref_rgb, img_rgb, weights=None):
    q = QMetric(ref_rgb, weights)
    val = q.set_image(img_rgb)
    t = q.terms()
    t["q"] = val
    return t, q


def q_of(ref_rgb, img_rgb, weights=None):
    return terms_of(ref_rgb, img_rgb, weights)[0]["q"]


def heat_png(contrib, path):
    a = np.asarray(contrib, np.float32)
    hi = float(np.percentile(a, 99.5))
    if hi <= 1e-9:
        hi = 1.0
    u = np.clip(a / hi, 0.0, 1.0)
    img = cv2.applyColorMap((u * 255.0).astype(np.uint8), cv2.COLORMAP_INFERNO)
    cv2.imwrite(str(path), img)


def hist_chi2(lab_a, lab_b, bins=16):
    """Chi-square distance of two Lab colour histograms (16 bins per axis)."""
    def hist(lab):
        # calcHist wants an image, so the list of Lab samples becomes an N x 1 one
        img = np.ascontiguousarray(np.asarray(lab, np.float32).reshape(-1, 1, 3))
        h = cv2.calcHist([img], [0, 1, 2], None,
                         [bins, bins, bins], [0, 100, -128, 128, -128, 128])
        s = h.sum()
        return (h / s) if s > 0 else h
    a, b = hist(lab_a), hist(lab_b)
    d = a - b
    den = a + b
    den[den <= 1e-12] = 1.0
    return float(0.5 * (d * d / den).sum())


def region_masks(direction_path, w, h):
    with open(direction_path) as fh:
        spec = json.load(fh)
    out = {}
    for name, r in (spec.get("regions") or {}).items():
        m = np.zeros((h, w), np.uint8)
        polys = []
        if "poly" in r:
            polys.append(r["poly"])
        polys.extend(r.get("polys", []))
        for p in polys:
            arr = np.round(np.asarray(p, np.float64)).astype(np.int32)
            if len(arr) >= 3:
                cv2.fillPoly(m, [arr], 1, cv2.LINE_8)
        if "rect" in r:
            x0, y0, x1, y1 = [int(round(float(v))) for v in r["rect"]]
            cv2.rectangle(m, (x0, y0), (x1, y1), 1, -1)
        out[name] = (m, r.get("minus", []))
    final = {}
    for name, (m, minus) in out.items():
        m = m.copy()
        for other in minus:
            if other in out:
                m[out[other][0] > 0] = 0
        final[name] = m
    return final


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description="picture quality metric Q")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--img", required=True)
    ap.add_argument("--regions", default=None, help="a direction json, for per-region numbers")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)

    ref = load_rgb(a.ref)
    h, w = ref.shape[:2]
    img = load_rgb(a.img, (w, h))

    weights = None
    if a.regions:
        with open(a.regions) as fh:
            weights = (json.load(fh) or {}).get("metric")
    t, q = terms_of(ref, img, weights)
    contrib = q.contribution()

    os.makedirs(a.out, exist_ok=True)
    out = {
        "width": w, "height": h,
        "weights": {"ms_ssim": q.w1, "gradient": q.w2, "color": q.w3},
        "ms_ssim": t["ms_ssim"],
        "gms": t["gms"],
        "delta_e_mean": t["delta_e"],
        "q": t["q"],
    }
    print("size        %d x %d" % (w, h))
    print("MS-SSIM     %.5f   (3 scales, gray)" % t["ms_ssim"])
    print("GMS         %.5f   (gradient dissimilarity)" % t["gms"])
    print("Lab dE      %.3f" % t["delta_e"])
    print("Q           %.6f   (lower is better)" % t["q"])

    if a.regions:
        masks = region_masks(a.regions, w, h)
        lab_r, lab_i = q.ref_lab, to_lab(img)
        per = {}
        print("\nper region:      Q        hist chi2   px")
        for name in sorted(masks):
            m = masks[name]
            n = int(m.sum())
            if n < 16:
                continue
            sel = m > 0
            rq = float(contrib[sel].mean())
            ch = hist_chi2(lab_r[sel], lab_i[sel])
            per[name] = {"q": rq, "hist_chi2": ch, "pixels": n}
            print("  %-14s %-8.6f %-10.4f %d" % (name, rq, ch, n))
        out["regions"] = per

    with open(os.path.join(a.out, "metrics.json"), "w") as fh:
        json.dump(out, fh, indent=1)
    heat_png(contrib, os.path.join(a.out, "error.png"))
    print("\nwrote %s" % os.path.join(a.out, "metrics.json"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
