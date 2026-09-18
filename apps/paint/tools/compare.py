#!/usr/bin/env python3
"""Compare a painting against its reference photo.

Usage:
    python compare.py --ref photo.png --img painting.png --out out_dir

Writes metrics.json, side.png, heat.png and report.txt to out_dir.
The comparison happens at the reference image's own size: the painting is
resized to it when the two differ, so any canvas size works.
"""
import argparse
import json
import os

import cv2
import numpy as np
from skimage.color import rgb2lab
from skimage.metrics import structural_similarity as ssim

GRID_COLS, GRID_ROWS = 6, 8
DE_HEATMAP_CAP = 40.0  # dE at or above this maps to the hottest heatmap colour
BLUR_SIGMA = 4
LABEL_BASE = 720.0  # the size the label font was tuned for


def load_image(path, size=None):
    """Read an image. With size = (w, h) the image is resized to it if needed."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"error: cannot read image: {path}")
    if size is not None and (img.shape[1], img.shape[0]) != size:
        interp = cv2.INTER_AREA if img.shape[1] > size[0] else cv2.INTER_CUBIC
        img = cv2.resize(img, size, interpolation=interp)
    return img


def to_lab(img_bgr):
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float64) / 255.0
    return rgb2lab(rgb)


def bgr_mean_to_hex(bgr_mean):
    b, g, r = (int(round(c)) for c in bgr_mean)
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def cell_bounds(col, row, w, h):
    """Cell edges for a w x h image. Integer division puts any remainder in the
    last column and row, so the cells always cover the whole picture."""
    x0, x1 = col * w // GRID_COLS, (col + 1) * w // GRID_COLS
    y0, y1 = row * h // GRID_ROWS, (row + 1) * h // GRID_ROWS
    return x0, y0, x1, y1


def make_hint(ref_lab_mean, img_lab_mean):
    dL = img_lab_mean[0] - ref_lab_mean[0]
    da = img_lab_mean[1] - ref_lab_mean[1]
    db = img_lab_mean[2] - ref_lab_mean[2]
    parts = []
    if abs(dL) > 2:
        parts.append("too dark" if dL < 0 else "too light")
    if abs(da) > 2:
        parts.append("too green" if da < 0 else "too red")
    if abs(db) > 2:
        parts.append("too blue" if db < 0 else "too yellow")
    return ", ".join(parts) if parts else "close match"


def build_grid(de_map, lab_ref, lab_img, ref_bgr, img_bgr):
    """Return (grid, cells): grid[row][col] = mean dE; cells = flat list with
    per-cell colours and a plain-word hint about the difference."""
    h, w = de_map.shape[:2]
    grid = [[0.0] * GRID_COLS for _ in range(GRID_ROWS)]
    cells = []
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            x0, y0, x1, y1 = cell_bounds(col, row, w, h)
            mean_de = float(de_map[y0:y1, x0:x1].mean())
            grid[row][col] = mean_de

            ref_bgr_mean = ref_bgr[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)
            img_bgr_mean = img_bgr[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)
            ref_lab_mean = lab_ref[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)
            img_lab_mean = lab_img[y0:y1, x0:x1].reshape(-1, 3).mean(axis=0)

            cells.append({
                "col": col,
                "row": row,
                "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                "delta_e": mean_de,
                "ref_rgb": [int(round(ref_bgr_mean[2])), int(round(ref_bgr_mean[1])), int(round(ref_bgr_mean[0]))],
                "img_rgb": [int(round(img_bgr_mean[2])), int(round(img_bgr_mean[1])), int(round(img_bgr_mean[0]))],
                "ref_hex": bgr_mean_to_hex(ref_bgr_mean),
                "img_hex": bgr_mean_to_hex(img_bgr_mean),
                "hint": make_hint(ref_lab_mean, img_lab_mean),
            })
    return grid, cells


def draw_grid_overlay(img, values=None):
    """Copy img and draw the 6x8 grid with 'c{col}r{row}' labels (and an
    optional numeric value per cell) in outlined text for readability."""
    out = img.copy()
    h, w = out.shape[:2]
    k = max(1.0, w / LABEL_BASE)  # lines and labels grow with the picture
    lw = max(1, int(round(k)))
    white = (255, 255, 255)
    for col in range(1, GRID_COLS):
        x = cell_bounds(col, 0, w, h)[0]
        cv2.line(out, (x, 0), (x, h), white, lw, cv2.LINE_AA)
    for row in range(1, GRID_ROWS):
        y = cell_bounds(0, row, w, h)[1]
        cv2.line(out, (0, y), (w, y), white, lw, cv2.LINE_AA)
    cv2.rectangle(out, (0, 0), (w - 1, h - 1), white, lw, cv2.LINE_AA)

    font = cv2.FONT_HERSHEY_SIMPLEX
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            x0, y0, _, _ = cell_bounds(col, row, w, h)
            label = f"c{col}r{row}"
            _put_outlined_text(out, label, (x0 + int(3 * k), y0 + int(13 * k)), font, 0.32 * k, lw)
            if values is not None:
                val = f"{values[row][col]:.1f}"
                _put_outlined_text(out, val, (x0 + int(3 * k), y0 + int(27 * k)), font, 0.32 * k, lw)
    return out


def _put_outlined_text(img, text, org, font, scale, lw=1):
    cv2.putText(img, text, org, font, scale, (0, 0, 0), lw * 2, cv2.LINE_AA)
    cv2.putText(img, text, org, font, scale, (255, 255, 255), lw, cv2.LINE_AA)


def make_heatmap(de_map):
    norm = np.clip(de_map / DE_HEATMAP_CAP, 0, 1)
    norm_u8 = (norm * 255).astype(np.uint8)
    colormap = getattr(cv2, "COLORMAP_TURBO", cv2.COLORMAP_JET)
    return cv2.applyColorMap(norm_u8, colormap)


def write_report(path, ref_path, img_path, metrics, cells):
    lines = []
    lines.append("Paint comparison report")
    lines.append("========================")
    lines.append(f"ref: {ref_path}")
    lines.append(f"img: {img_path}")
    lines.append(f"size: {metrics['width']}x{metrics['height']}")
    lines.append("")
    lines.append(f"SSIM (gray):            {metrics['ssim_gray']:.4f}")
    lines.append(f"SSIM (blurred, sigma=4): {metrics['ssim_blur']:.4f}")
    lines.append(f"Delta E mean (Lab):     {metrics['delta_e_mean']:.2f}")
    lines.append(f"PSNR:                   {metrics['psnr']:.2f} dB")
    lines.append("")
    lines.append("Grid, mean dE per cell (rows top to bottom, cols left to right):")
    for row in range(GRID_ROWS):
        row_vals = " ".join(f"{v:5.1f}" for v in metrics["grid"]["delta_e"][row])
        lines.append(f"  r{row}: {row_vals}")
    lines.append("")
    worst_sorted = sorted(cells, key=lambda c: c["delta_e"], reverse=True)[:8]
    lines.append("Worst 8 cells (biggest dE first):")
    for c in worst_sorted:
        lines.append(
            f"  c{c['col']}r{c['row']}  dE={c['delta_e']:.1f}  "
            f"ref={c['ref_hex']}  img={c['img_hex']}  -> {c['hint']}"
        )
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    p = argparse.ArgumentParser(description="Compare a painting against its reference photo.")
    p.add_argument("--ref", required=True, help="path to the reference image")
    p.add_argument("--img", required=True, help="path to the painting to check")
    p.add_argument("--out", required=True, help="output directory")
    args = p.parse_args()

    os.makedirs(args.out, exist_ok=True)

    ref_bgr = load_image(args.ref)
    size = (ref_bgr.shape[1], ref_bgr.shape[0])
    img_bgr = load_image(args.img, size)

    ref_gray = cv2.cvtColor(ref_bgr, cv2.COLOR_BGR2GRAY)
    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    ssim_gray = float(ssim(ref_gray, img_gray, data_range=255))

    ref_blur = cv2.GaussianBlur(ref_gray, (0, 0), sigmaX=BLUR_SIGMA)
    img_blur = cv2.GaussianBlur(img_gray, (0, 0), sigmaX=BLUR_SIGMA)
    ssim_blur = float(ssim(ref_blur, img_blur, data_range=255))

    lab_ref = to_lab(ref_bgr)
    lab_img = to_lab(img_bgr)
    de_map = np.sqrt(((lab_ref - lab_img) ** 2).sum(axis=2))
    delta_e_mean = float(de_map.mean())

    mse = float(np.mean((ref_bgr.astype(np.float64) - img_bgr.astype(np.float64)) ** 2))
    psnr = 100.0 if mse == 0 else 20 * np.log10(255.0) - 10 * np.log10(mse)

    grid, cells = build_grid(de_map, lab_ref, lab_img, ref_bgr, img_bgr)
    worst_cells = sorted(cells, key=lambda c: c["delta_e"], reverse=True)[:8]

    metrics = {
        "width": size[0],
        "height": size[1],
        "ssim_gray": ssim_gray,
        "ssim_blur": ssim_blur,
        "delta_e_mean": delta_e_mean,
        "psnr": float(psnr),
        "grid": {"cols": GRID_COLS, "rows": GRID_ROWS, "delta_e": grid},
        "worst_cells": worst_cells,
    }

    with open(os.path.join(args.out, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    heat = make_heatmap(de_map)
    panel_ref = draw_grid_overlay(ref_bgr)
    panel_img = draw_grid_overlay(img_bgr)
    panel_heat = draw_grid_overlay(heat, values=grid)

    cv2.imwrite(os.path.join(args.out, "heat.png"), panel_heat)

    sep = np.full((size[1], 4, 3), 255, dtype=np.uint8)
    side = np.hstack([panel_ref, sep, panel_img, sep, panel_heat])
    cv2.imwrite(os.path.join(args.out, "side.png"), side)

    write_report(os.path.join(args.out, "report.txt"), args.ref, args.img, metrics, cells)

    print(
        f"ssim_gray={ssim_gray:.4f} ssim_blur={ssim_blur:.4f} "
        f"delta_e_mean={delta_e_mean:.2f} psnr={psnr:.2f} -> {args.out}"
    )


if __name__ == "__main__":
    main()
