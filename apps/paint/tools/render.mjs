#!/usr/bin/env node
/* Headless renderer for the paint engine.
   node render.mjs --plan <plan.js> --out <dir>
     [--frames 900] [--ref <png>] [--width W] [--height H] [--scale N] [--frame-scale M]
     [--video progressive --seconds S --fps F] [--pace length|size]
     or --actions <actions.json> instead of --plan
   The reference photo comes from --ref, else $PAINT_REF, else <app dir>/work/ref/photo_720x960.png.
   Plans work in plan space, 720 x 960 by default and W x H with --width/--height:
   h.W/h.H report it and h.ref/h.refAvg read the reference at that size.
   --scale N paints on a W*N x H*N canvas (the engine multiplies every length by
   N); final.png and the checkpoints come out at that size.
   --frame-scale M writes the movie frames at W*M x H*M, downscaled from the
   canvas, so a big render still makes a small video. Defaults: scale 1, frame
   scale 1. See apps/paint tools contract for the full behaviour.
   --video progressive makes a S*F frame video where strokes are drawn growing
   over several frames instead of appearing in one stride-sampled snapshot; see
   runActionsProgressive() below and the Harness section of work/v4/SPEC.md.
   --pace size spends that video budget on path length * sqrt(size) instead of
   path length, so wide marks are slow and fine marks fast.
   --pace travel prices every stroke in real drawing time instead of sharing a
   fixed budget: length / (px-per-mm * speed) seconds, divided by the time-lapse
   factor --lapse. --seconds is then a cap, not a target.
   --cursor crayon draws a crayon tip at the growing end of the stroke in the
   movie frames only (never in final.png or the checkpoints). */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..'); // apps/paint
const HEADLESS_URL = pathToFileURL(path.join(APP_DIR, 'headless.html')).href;
const DEFAULT_W = 720, DEFAULT_H = 960;

function parseArgs(argv) {
  const args = { frames: 900, scale: 1, frameScale: 1, seconds: 90, fps: 10, pace: 'length',
    width: DEFAULT_W, height: DEFAULT_H,
    speed: 200, pxPerMm: 6.86, lapse: 10, cursor: 'none' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') args.plan = argv[++i];
    else if (a === '--actions') args.actions = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--frames') args.frames = parseInt(argv[++i], 10);
    else if (a === '--ref') args.ref = argv[++i];
    else if (a === '--width') args.width = parseFloat(argv[++i]);
    else if (a === '--height') args.height = parseFloat(argv[++i]);
    else if (a === '--scale') args.scale = parseFloat(argv[++i]);
    else if (a === '--frame-scale') args.frameScale = parseFloat(argv[++i]);
    else if (a === '--video') args.video = argv[++i];
    else if (a === '--seconds') args.seconds = parseFloat(argv[++i]);
    else if (a === '--fps') args.fps = parseFloat(argv[++i]);
    else if (a === '--pace') args.pace = argv[++i];
    else if (a === '--speed') args.speed = parseFloat(argv[++i]);
    else if (a === '--px-per-mm') args.pxPerMm = parseFloat(argv[++i]);
    else if (a === '--lapse') args.lapse = parseFloat(argv[++i]);
    else if (a === '--cursor') args.cursor = argv[++i];
    else throw new Error('unknown argument ' + a);
  }
  if (!args.plan && !args.actions) throw new Error('pass --plan <plan.js> or --actions <actions.json>');
  if (args.plan && args.actions) throw new Error('pass only one of --plan or --actions');
  if (!args.out) throw new Error('--out <dir> is required');
  if (!Number.isFinite(args.frames) || args.frames < 1) throw new Error('--frames must be a positive number');
  if (!Number.isFinite(args.width) || args.width < 1) throw new Error('--width must be a positive number');
  if (!Number.isFinite(args.height) || args.height < 1) throw new Error('--height must be a positive number');
  if (!Number.isFinite(args.scale) || args.scale <= 0) throw new Error('--scale must be a positive number');
  if (!Number.isFinite(args.frameScale) || args.frameScale <= 0) throw new Error('--frame-scale must be a positive number');
  if (args.video != null && args.video !== 'progressive') throw new Error('--video only supports "progressive"');
  if (!Number.isFinite(args.seconds) || args.seconds <= 0) throw new Error('--seconds must be a positive number');
  if (!Number.isFinite(args.fps) || args.fps <= 0) throw new Error('--fps must be a positive number');
  if (!['length', 'size', 'travel'].includes(args.pace)) throw new Error('--pace must be "length", "size" or "travel"');
  if (!Number.isFinite(args.speed) || args.speed <= 0) throw new Error('--speed must be a positive number (mm/s)');
  if (!Number.isFinite(args.pxPerMm) || args.pxPerMm <= 0) throw new Error('--px-per-mm must be a positive number');
  if (!Number.isFinite(args.lapse) || args.lapse <= 0) throw new Error('--lapse must be a positive number');
  if (args.cursor !== 'none' && args.cursor !== 'crayon') throw new Error('--cursor must be "none" or "crayon"');
  return args;
}

/* ---------- action validation (t, tool, numbers, pts) ---------- */

const VALID_TYPES = ['clear', 'stroke', 'poly', 'ellipse', 'bucket', 'mark'];
const VALID_TOOLS = ['pencil', 'brush', 'spray', 'bristle', 'flat', 'knife', 'crayon', 'eraser'];

function isNum(v) {
  const n = +v;
  return typeof v !== 'object' && v !== '' && v != null && Number.isFinite(n);
}

function isPts(v) {
  if (!Array.isArray(v) || !v.length) return false;
  for (const p of v) {
    if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1])) return false;
  }
  return true;
}

function validateAction(a, i) {
  const fail = (msg) => { throw new Error('action ' + i + ' invalid: ' + msg); };
  if (!a || typeof a !== 'object') fail('not an object');
  if (!VALID_TYPES.includes(a.t)) fail('bad t ' + JSON.stringify(a.t));

  if (a.t === 'clear') {
    if (a.color != null && typeof a.color !== 'string') fail('color must be a string');
    if (a.paper != null && typeof a.paper !== 'boolean') fail('paper must be a boolean');
  } else if (a.t === 'mark') {
    if (typeof a.name !== 'string' || !a.name) fail('mark needs a string name');
  } else if (a.t === 'bucket') {
    if (!isNum(a.x) || !isNum(a.y)) fail('bad x/y');
    if (typeof a.color !== 'string') fail('bad color');
    if (a.tol != null && !isNum(a.tol)) fail('bad tol');
    if (a.alpha != null && !isNum(a.alpha)) fail('bad alpha');
  } else if (a.t === 'stroke') {
    if (!VALID_TOOLS.includes(a.tool)) fail('bad tool ' + JSON.stringify(a.tool));
    if (a.tool !== 'eraser' && typeof a.color !== 'string') fail('bad color');
    if (!isNum(a.size)) fail('bad size');
    if (a.alpha != null && !isNum(a.alpha)) fail('bad alpha');
    if (a.pressure != null && !isNum(a.pressure)) fail('bad pressure');
    if (!isPts(a.pts)) fail('bad pts');
  } else if (a.t === 'poly') {
    if (typeof a.color !== 'string') fail('bad color');
    if (a.alpha != null && !isNum(a.alpha)) fail('bad alpha');
    if (!isPts(a.pts) || a.pts.length < 3) fail('poly needs at least 3 pts');
  } else if (a.t === 'ellipse') {
    if (typeof a.color !== 'string') fail('bad color');
    if (a.alpha != null && !isNum(a.alpha)) fail('bad alpha');
    for (const k of ['cx', 'cy', 'rx', 'ry']) if (!isNum(a[k])) fail('bad ' + k);
    if (a.rot != null && !isNum(a.rot)) fail('bad rot');
  }
}

/* ---------- helper object h, built inside the page ---------- */
/* Runs in the browser. Kept as a plain function string via page.evaluate,
   so it stays next to engine.js's own PaintEngine.* statics. */
function installHelpers(refDataUrl, W, H) {
  return (async () => {
    let imgData = null;
    if (refDataUrl) {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('could not decode reference image'));
        im.src = refDataUrl;
      });
      const oc = document.createElement('canvas');
      oc.width = W; oc.height = H;
      const octx = oc.getContext('2d');
      octx.drawImage(img, 0, 0, W, H);
      imgData = octx.getImageData(0, 0, W, H);
    }

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    let refCalls = 0;
    window.__refCalls = () => refCalls;

    function ref(x, y) {
      refCalls++;
      if (!imgData) return [0, 0, 0];
      const xi = clamp(Math.round(x), 0, W - 1);
      const yi = clamp(Math.round(y), 0, H - 1);
      const i = (yi * W + xi) * 4;
      const d = imgData.data;
      return [d[i], d[i + 1], d[i + 2]];
    }

    function refAvg(x, y, radius) {
      refCalls++;
      if (!imgData) return [0, 0, 0];
      radius = Math.max(0, radius || 0);
      if (radius < 0.5) return ref(x, y);
      const r2 = radius * radius;
      const x0 = clamp(Math.floor(x - radius), 0, W - 1);
      const x1 = clamp(Math.ceil(x + radius), 0, W - 1);
      const y0 = clamp(Math.floor(y - radius), 0, H - 1);
      const y1 = clamp(Math.ceil(y + radius), 0, H - 1);
      const d = imgData.data;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - x, dy = yy - y;
          if (dx * dx + dy * dy > r2) continue;
          const i = (yy * W + xx) * 4;
          sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++;
        }
      }
      if (!n) return ref(x, y);
      return [sr / n, sg / n, sb / n];
    }

    /* n points along a Catmull-Rom curve through pts (clamped end tangents) */
    function curve(pts, n) {
      n = Math.max(2, n | 0);
      if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
      const segs = pts.length - 1;
      const get = (i) => pts[clamp(i, 0, pts.length - 1)];
      const out = [];
      const steps = n - 1;
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * segs;
        let i0 = Math.floor(t);
        if (i0 >= segs) i0 = segs - 1;
        const lt = t - i0;
        const p0 = get(i0 - 1), p1 = get(i0), p2 = get(i0 + 1), p3 = get(i0 + 2);
        const t2 = lt * lt, t3 = t2 * lt;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * lt +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * lt +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x, y]);
      }
      return out;
    }

    const rngFn = PaintEngine.mulberry32(7);
    window.__H = {
      W: W,
      H: H,
      ref: ref,
      refAvg: refAvg,
      hex: PaintEngine.rgbToHex,
      rgb: PaintEngine.hexToRgb,
      mix: PaintEngine.mix,
      shade: PaintEngine.shade,
      rng: rngFn,
      jitter: (v, amount) => v + (rngFn() - 0.5) * 2 * amount,
      curve: curve,
      lerp: (a, b, t) => a + (b - a) * t
    };
  })();
}

/* ---------- apply + capture, runs inside the page ---------- */

async function runActions(actions, frameTarget, frameW, frameH) {
  const engine = window.engine;
  engine.reset();
  const total = actions.length;
  const stride = Math.max(1, Math.ceil(total / frameTarget));
  const pad = (n, w) => String(n).padStart(w, '0');
  let frameCount = 0;
  const checkpoints = [];

  /* Frames are downscaled off the big canvas; checkpoints and final.png keep
     the full size. Encoding a 2880x3840 PNG is the slow part, so only the
     sampled frames pay for it, and they pay at frame size. */
  let shrink = null, sctx = null;
  if (frameW !== engine.canvas.width || frameH !== engine.canvas.height) {
    shrink = document.createElement('canvas');
    shrink.width = frameW;
    shrink.height = frameH;
    sctx = shrink.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
  }

  let fullUrl = null;
  const full = () => (fullUrl === null ? (fullUrl = engine.toDataURL()) : fullUrl);
  const frame = () => {
    if (!shrink) return full();
    sctx.clearRect(0, 0, frameW, frameH);
    sctx.drawImage(engine.canvas, 0, 0, frameW, frameH);
    return shrink.toDataURL('image/png');
  };

  for (let i = 0; i < total; i++) {
    engine.apply(actions[i]);
    fullUrl = null;
    const isMark = actions[i].t === 'mark';
    const isLast = i === total - 1;
    const needFrame = ((i + 1) % stride === 0) || isMark || isLast;
    if (needFrame) {
      frameCount++;
      await window.__saveFile('frames/f' + pad(frameCount, 6) + '.png', frame());
    }
    if (isMark) {
      const n = checkpoints.length + 1;
      const safe = String(actions[i].name || 'mark').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'mark';
      const file = pad(n, 2) + '-' + safe + '.png';
      await window.__saveFile('checkpoints/' + file, full());
      checkpoints.push(file);
    }
  }

  await window.__saveFile('final.png', engine.toDataURL());
  return { frameCount, checkpoints };
}

/* ---------- progressive video: --video progressive --seconds S --fps F ---------- */
/* Runs inside the page, like runActions. Frames are spent by "painting time":
   a stroke's time is its path length plus a small constant (STROKE_BASE),
   poly/ellipse/bucket cost a fixed one frame each, marks and clear cost
   nothing. Total frames = round(S*F). A stroke whose own share of that
   budget is >= 1 frame is drawn growing: snapshot the canvas, then for
   k = 1..n restore the snapshot, draw the stroke truncated to its first
   ceil(k/n * pts.length) points with a throwaway engine._draw() call (same
   rng index the real apply will use, so it matches pixel for pixel), and
   capture a frame; then restore once more and engine.apply() the full stroke
   for real. A short stroke (share < 1 frame) is just applied for real, and
   the run captures one frame once the accumulated share of a run of such
   strokes reaches 1 (a cumulative-rounding accumulator, so the total frame
   count from strokes lands within one frame of its ideal share).
   pace 'length' (the default) weighs a stroke by path length + STROKE_BASE.
   pace 'size' multiplies that by sqrt(size), so a wide mark takes many frames
   and a fine mark goes past quickly.
   pace 'travel' prices a stroke in real time instead: length / (pxPerMm * speed)
   seconds of hand travel, divided by the time-lapse factor `lapse`, times fps.
   Those weights ARE the frame counts, so the cumulative-rounding accumulator
   below hands each stroke its own real duration and `seconds` only caps the
   total (every share is scaled down together when the sum overruns it).
   cursor 'crayon' stamps a crayon tip at the live end of the stroke into the
   frame image - never into the canvas, so final.png and the checkpoints stay
   clean. Nothing else changes. */
async function runActionsProgressive(actions, seconds, fps, frameW, frameH, pace, travel, cursor) {
  const engine = window.engine;
  engine.reset();
  const total = actions.length;
  const pad = (n, w) => String(n).padStart(w, '0');
  const totalFrames = Math.max(1, Math.round(seconds * fps));
  const STROKE_BASE = 12; /* plan px; keeps a short/zero-length stroke from getting ~0 time */

  function pathLength(pts) {
    if (!pts || pts.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  /* pass 1: weigh every action so the budget can be split */
  let fixedCount = 0; /* poly/ellipse/bucket: one frame each, off the top */
  let totalStrokeWeight = 0;
  const weights = new Array(total).fill(0);
  for (let i = 0; i < total; i++) {
    const a = actions[i];
    if (a.t === 'stroke') {
      let w;
      if (pace === 'travel') {
        /* seconds of hand travel, sped up by `lapse`, in frames */
        w = (pathLength(a.pts) / (travel.pxPerMm * travel.speed) / travel.lapse) * fps;
      } else {
        w = pathLength(a.pts) + STROKE_BASE;
        if (pace === 'size') w *= Math.sqrt(Math.max(0.5, +a.size || 0));
      }
      weights[i] = w;
      totalStrokeWeight += w;
    } else if (a.t === 'poly' || a.t === 'ellipse' || a.t === 'bucket') {
      fixedCount++;
    }
  }
  let remaining = Math.max(0, totalFrames - fixedCount);
  /* travel pacing asks for a definite number of frames; --seconds only caps it */
  if (pace === 'travel') remaining = Math.min(remaining, totalStrokeWeight);

  const wantCursor = cursor === 'crayon';
  let shrink = null, sctx = null;
  if (frameW !== engine.canvas.width || frameH !== engine.canvas.height || wantCursor) {
    shrink = document.createElement('canvas');
    shrink.width = frameW;
    shrink.height = frameH;
    sctx = shrink.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
  }

  /* A crayon held at the mark, drawn in frame pixels: a 26 x 8 rounded body
     lying along the last path segment and pointing ahead of the tip (so it
     never covers the fresh mark), a darker 5 px nib whose point sits exactly on
     the stroke end, and a soft shadow that lifts it off the paper. */
  const CURSOR_LEN = 26, CURSOR_WID = 8;
  function crayonBody(ctx2) {
    const x = 3, y = -CURSOR_WID / 2, w = CURSOR_LEN - 3, h = CURSOR_WID, r = 3;
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.lineTo(x + w - r, y);
    ctx2.arcTo(x + w, y, x + w, y + r, r);
    ctx2.lineTo(x + w, y + h - r);
    ctx2.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx2.lineTo(x + r, y + h);
    ctx2.arcTo(x, y + h, x, y + h - r, r);
    ctx2.lineTo(x, y + r);
    ctx2.arcTo(x, y, x + r, y, r);
    ctx2.closePath();
  }
  function drawCursor(ctx2, cur) {
    ctx2.save();
    ctx2.translate(cur.x, cur.y);
    ctx2.rotate(Math.atan2(cur.uy, cur.ux));
    ctx2.shadowColor = 'rgba(0,0,0,0.30)';
    ctx2.shadowBlur = 4;
    ctx2.shadowOffsetX = 2;
    ctx2.shadowOffsetY = 3;
    ctx2.fillStyle = cur.color;
    crayonBody(ctx2);
    ctx2.fill();
    ctx2.shadowColor = 'rgba(0,0,0,0)';
    ctx2.shadowBlur = 0;
    ctx2.shadowOffsetX = 0;
    ctx2.shadowOffsetY = 0;
    ctx2.beginPath();
    ctx2.moveTo(0, 0);
    ctx2.lineTo(5, -CURSOR_WID * 0.4);
    ctx2.lineTo(5, CURSOR_WID * 0.4);
    ctx2.closePath();
    ctx2.fillStyle = PaintEngine.shade(cur.color, 0.55);
    ctx2.fill();
    ctx2.lineWidth = 1;
    ctx2.strokeStyle = 'rgba(0,0,0,0.35)';
    crayonBody(ctx2);
    ctx2.stroke();
    ctx2.restore();
  }

  /* plan px -> frame px */
  const fk = (frameW * engine.scale) / engine.canvas.width;
  function cursorAt(a, pts, m) {
    if (!wantCursor || !pts || !pts.length) return null;
    const p1 = pts[Math.min(m, pts.length) - 1];
    const p0 = pts[Math.max(0, Math.min(m, pts.length) - 2)];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const l = Math.sqrt(dx * dx + dy * dy);
    if (l < 1e-6) { dx = 1; dy = 0; } else { dx /= l; dy /= l; }
    return { x: p1[0] * fk, y: p1[1] * fk, ux: dx, uy: dy, color: a.color || '#000000' };
  }

  const frameDataUrl = (cur) => {
    if (!shrink) return engine.canvas.toDataURL('image/png');
    sctx.clearRect(0, 0, frameW, frameH);
    sctx.drawImage(engine.canvas, 0, 0, frameW, frameH);
    if (cur) drawCursor(sctx, cur);
    return shrink.toDataURL('image/png');
  };

  function snapshot() {
    const snap = document.createElement('canvas');
    snap.width = engine.canvas.width;
    snap.height = engine.canvas.height;
    snap.getContext('2d').drawImage(engine.canvas, 0, 0);
    return snap;
  }
  function restore(snap) {
    const c = engine.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, engine.width, engine.height);
    c.drawImage(snap, 0, 0);
  }

  let frameCount = 0;
  const checkpoints = [];
  const saveFrame = async (cur) => {
    frameCount++;
    await window.__saveFile('frames/f' + pad(frameCount, 6) + '.png', frameDataUrl(cur));
  };

  let cumWeight = 0;
  let allocated = 0; /* frames already handed to strokes */
  let framesCurrent = false; /* does the last saved frame match the live canvas? */

  for (let i = 0; i < total; i++) {
    const a = actions[i];

    if (a.t === 'stroke') {
      const w = weights[i];
      cumWeight += w;
      const target = totalStrokeWeight > 0 ? Math.round((cumWeight / totalStrokeWeight) * remaining) : 0;
      let n = target - allocated;
      const rawShare = totalStrokeWeight > 0 ? (w / totalStrokeWeight) * remaining : 0;
      const index = engine.history.length; /* rng index the real apply() below will use */

      if (rawShare >= 1) {
        /* progressive: grows across n frames, then the real stroke lands */
        if (n < 1) n = 1;
        const snap = snapshot();
        const pts = a.pts;
        for (let k = 1; k <= n; k++) {
          restore(snap);
          const m = Math.max(1, Math.ceil((k / n) * pts.length));
          const truncated = Object.assign({}, a, { pts: pts.slice(0, m) });
          engine._draw(truncated, index); /* throwaway: not pushed to history */
          await saveFrame(cursorAt(a, pts, m));
        }
        restore(snap);
        engine.apply(a); /* the real, full stroke */
        allocated += n;
        framesCurrent = true; /* the k=n frame above already equals this state */
      } else {
        /* grouped: too short on its own; apply it for real and only spend a
           frame once a run of these has accumulated a full frame's share */
        engine.apply(a);
        if (n < 0) n = 0;
        if (n > 1) n = 1;
        if (n >= 1) {
          /* the crayon has just finished this stroke: show it at its end */
          await saveFrame(cursorAt(a, a.pts, a.pts.length));
          allocated += 1;
          framesCurrent = true;
        } else {
          framesCurrent = false;
        }
      }
    } else if (a.t === 'poly' || a.t === 'ellipse' || a.t === 'bucket') {
      engine.apply(a);
      await saveFrame();
      framesCurrent = true;
    } else if (a.t === 'mark') {
      engine.apply(a); /* draws nothing: framesCurrent is unaffected */
      const n2 = checkpoints.length + 1;
      const safe = String(a.name || 'mark').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'mark';
      const file = pad(n2, 2) + '-' + safe + '.png';
      await window.__saveFile('checkpoints/' + file, engine.toDataURL());
      checkpoints.push(file);
    } else {
      engine.apply(a); /* e.g. clear: no time budget, no frame */
      framesCurrent = false;
    }
  }

  /* guarantee the video ends on the finished painting even if the budget
     maths did not happen to trigger a capture on the very last action */
  if (!framesCurrent) await saveFrame();

  await window.__saveFile('final.png', engine.toDataURL());
  return { frameCount, checkpoints };
}

/* ---------- main ---------- */

async function main() {
  const t0 = Date.now();
  const args = parseArgs(process.argv.slice(2));

  const outDir = path.resolve(args.out);
  fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'checkpoints'), { recursive: true });

  const refArg = args.ref || process.env.PAINT_REF;
  const refPath = refArg ? path.resolve(refArg) : path.join(APP_DIR, 'work', 'ref', 'photo_720x960.png');
  let refBuf = null;
  if (fs.existsSync(refPath)) {
    refBuf = fs.readFileSync(refPath);
  } else if (refArg) {
    throw new Error('reference file not found: ' + refPath);
  } else if (args.plan) {
    console.warn('render.mjs: no reference image at ' + refPath + ' (pass --ref <png> or set PAINT_REF)');
  }

  const browser = await puppeteer.launch({ channel: 'chrome', headless: true , protocolTimeout: 3600000});
  let exitCode = 0;
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push(msg.text()); });

    await page.goto(HEADLESS_URL);

    /* headless.html builds a 720x960 engine; rebuild it at the plan size and scale */
    const planW = Math.round(args.width), planH = Math.round(args.height);
    await page.evaluate((w, h, scale) => {
      const canvas = document.getElementById('c');
      canvas.width = w;
      canvas.height = h;
      window.engine = new PaintEngine(canvas, { seed: 1, scale: scale });
    }, Math.round(planW * args.scale), Math.round(planH * args.scale), args.scale);

    const refDataUrl = refBuf ? ('data:image/png;base64,' + refBuf.toString('base64')) : null;
    await page.evaluate(installHelpers, refDataUrl, planW, planH);

    let actions;
    if (args.plan) {
      const planPath = path.resolve(args.plan);
      if (!fs.existsSync(planPath)) throw new Error('plan file not found: ' + planPath);
      await page.addScriptTag({ path: planPath });
      actions = await page.evaluate(() => {
        if (typeof window.plan !== 'function') throw new Error('plan.js did not define window.plan');
        const result = window.plan(window.__H);
        if (!Array.isArray(result)) throw new Error('window.plan(h) did not return an array');
        return result;
      });
      if (!refBuf) {
        const used = await page.evaluate(() => window.__refCalls());
        if (used) {
          throw new Error('the plan called h.ref/h.refAvg ' + used + ' times but no reference image was loaded (looked for ' +
            refPath + '). Pass --ref <png> or set PAINT_REF.');
        }
      }
    } else {
      const actionsPath = path.resolve(args.actions);
      actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
      if (!Array.isArray(actions)) throw new Error('--actions file must contain a JSON array');
    }

    actions.forEach(validateAction);
    fs.writeFileSync(path.join(outDir, 'actions.json'), JSON.stringify(actions));

    await page.exposeFunction('__saveFile', async (relPath, dataUrl) => {
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      fs.writeFileSync(path.join(outDir, relPath), Buffer.from(b64, 'base64'));
    });

    const frameW = Math.round(planW * args.frameScale);
    const frameH = Math.round(planH * args.frameScale);
    const progressive = args.video === 'progressive';
    const runResult = progressive
      ? await page.evaluate(runActionsProgressive, actions, args.seconds, args.fps, frameW, frameH, args.pace,
        { speed: args.speed, pxPerMm: args.pxPerMm, lapse: args.lapse }, args.cursor)
      : await page.evaluate(runActions, actions, args.frames, frameW, frameH);

    if (pageErrors.length) {
      console.warn('render.mjs: page errors during run:\n' + pageErrors.join('\n'));
    }

    const seconds = (Date.now() - t0) / 1000;
    const meta = {
      actions: actions.length,
      frames: runResult.frameCount,
      checkpoints: runResult.checkpoints,
      width: planW,
      height: planH,
      scale: args.scale,
      frameScale: args.frameScale,
      seconds
    };
    if (progressive) {
      meta.video = 'progressive';
      meta.videoSeconds = args.seconds;
      meta.fps = args.fps;
      meta.pace = args.pace;
      meta.cursor = args.cursor;
      if (args.pace === 'travel') {
        meta.speed = args.speed;
        meta.pxPerMm = args.pxPerMm;
        meta.lapse = args.lapse;
      }
      meta.targetFrames = Math.max(1, Math.round(args.seconds * args.fps));
    }
    fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

    console.log(
      'render.mjs: ' + actions.length + ' actions, ' + runResult.frameCount + ' frames (' +
      frameW + 'x' + frameH + ')' + (progressive ? ' [progressive, target ' + meta.targetFrames + ']' : '') +
      ', ' + runResult.checkpoints.length + ' checkpoints, plan ' + planW + 'x' + planH + ', scale ' +
      args.scale + ' (' + Math.round(planW * args.scale) + 'x' + Math.round(planH * args.scale) + '), ' +
      seconds.toFixed(2) + 's -> ' + outDir
    );
  } catch (err) {
    console.error('render.mjs: ' + (err && err.message ? err.message : err));
    exitCode = 1;
  } finally {
    await browser.close();
  }
  if (exitCode) process.exit(exitCode);
}

main();
