/* PaintEngine - the rendering core of the paint app.
   Classic script, no DOM access except the canvas it gets.
   Every action renders the same way each time, so replays are pixel-identical.

   Actions are written in plan space (720 x 960). The `scale` option renders the
   same actions on a bigger canvas: every length is multiplied by scale at draw
   time, the history keeps the original unscaled actions. scale 1 is the old
   engine, pixel for pixel. */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---------- small helpers ---------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function hexToRgb(hex) {
    var s = String(hex == null ? '#000000' : hex).trim();
    if (s.charAt(0) === '#') s = s.slice(1);
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (!isFinite(n)) n = 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(c) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var v = clamp(Math.round(c[i]), 0, 255);
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  }

  function shade(hex, k) {
    var c = hexToRgb(hex);
    return rgbToHex([c[0] * k, c[1] * k, c[2] * k]);
  }

  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    return rgbToHex([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ]);
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* [[x,y],...] -> [{x,y},...]. One point becomes two, so a stroke of one
     point still has a direction and draws a single dab. */
  function normPts(raw) {
    var pts = [], i, p;
    if (!raw || !raw.length) return pts;
    for (i = 0; i < raw.length; i++) {
      p = raw[i];
      var x = p && p.length ? +p[0] : +p.x;
      var y = p && p.length ? +p[1] : +p.y;
      if (isFinite(x) && isFinite(y)) pts.push({ x: x, y: y });
    }
    if (pts.length === 1) pts.push({ x: pts[0].x + 0.01, y: pts[0].y });
    return pts;
  }

  /* plan space -> device space. s === 1 gives the same array back. */
  function scalePts(pts, s) {
    if (s === 1) return pts;
    var out = new Array(pts.length);
    for (var i = 0; i < pts.length; i++) out[i] = { x: pts[i].x * s, y: pts[i].y * s };
    return out;
  }

  /* Call cb(x, y, ux, uy) every `step` px along the polyline, start included. */
  function walk(pts, step, cb) {
    step = Math.max(0.5, step);
    var i, first = dirAt(pts, 0);
    cb(pts[0].x, pts[0].y, first[0], first[1]);
    var carry = 0;
    for (i = 1; i < pts.length; i++) {
      var ax = pts[i - 1].x, ay = pts[i - 1].y;
      var dx = pts[i].x - ax, dy = pts[i].y - ay;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-6) continue;
      var ux = dx / len, uy = dy / len;
      var t = step - carry;
      while (t <= len) {
        cb(ax + ux * t, ay + uy * t, ux, uy);
        t += step;
      }
      carry = len - (t - step);
    }
  }

  /* unit direction at point j, from its neighbours */
  function dirAt(pts, j) {
    var a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
    var dx = b.x - a.x, dy = b.y - a.y;
    var l = Math.sqrt(dx * dx + dy * dy);
    if (l < 1e-6) return [1, 0];
    return [dx / l, dy / l];
  }

  function bboxOf(pts, pad) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].x < x0) x0 = pts[i].x;
      if (pts[i].y < y0) y0 = pts[i].y;
      if (pts[i].x > x1) x1 = pts[i].x;
      if (pts[i].y > y1) y1 = pts[i].y;
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }

  /* ---------- tools ---------- */

  /* soft round dab: solid to 35% of the radius, then a fade to nothing */
  function softDab(c, x, y, r, color) {
    r = Math.max(0.6, r);
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color);
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  function drawHardLine(c, pts, size, color, s) {
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.5 * s, size * s);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
  }

  function drawBrush(c, pts, size, color, s) {
    var r = Math.max(0.6 * s, size * s / 2);
    walk(pts, Math.max(0.5 * s, size * s / 4), function (x, y) {
      softDab(c, x, y, r, color);
    });
  }

  /* Airbrush. The dot alpha here is 0.15; the stroke alpha multiplies in at
     composite time, so the painted dot alpha is 0.15 * alpha.
     Dots fill a disc of radius size/2. The 0.75 power biases them to the
     centre: a uniform disc would use 0.5, a bigger power crowds the middle.
     Scale: the disc and the step along the path grow with s, and the dot count
     grows with s * s, so the number of dots per device pixel - and with it the
     ink per unit area - is the same at every scale. The dot stays 1-2 device
     px: a dot that also grew with s would lay down s * s times too much ink and
     the spray would go solid. */
  function drawSpray(c, pts, size, color, rng, s) {
    var R = Math.max(1 * s, size * s / 2);
    var n = Math.max(4, Math.round(size));
    if (s !== 1) n = Math.max(1, Math.round(n * s * s));
    c.fillStyle = rgba(color, 0.15);
    walk(pts, 3 * s, function (x, y) {
      for (var i = 0; i < n; i++) {
        var ang = rng() * TAU;
        var rad = R * Math.pow(rng(), 0.75);
        var d = rng() < 0.5 ? 1 : 2;
        c.fillRect(Math.round(x + Math.cos(ang) * rad), Math.round(y + Math.sin(ang) * rad), d, d);
      }
    });
  }

  /* rounded rectangle path, r clamped so it never folds over itself */
  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r, Math.min(w, h) / 2);
    c.beginPath();
    if (r <= 0) {
      c.rect(x, y, w, h);
      return;
    }
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  /* Flat brush. A rounded rectangle, `size` wide across the path and
     size*0.35 long along it, stamped every size*0.2 px and turned to the path
     tangent. Every stamp takes a value ripple of +-4% from the action PRNG, so
     the band reads as paint and not as a fill, and the two long edges of the
     swath (the rails parallel to the path) sit 2% darker. Edges are plain
     canvas fills: hard, with the 1 px of anti-aliasing the fill gives.
     The stamps overlap (0.35 long, 0.2 apart), so the ripple shows up as faint
     bands across the mark. */
  function drawFlat(c, pts, size, color, rng, s) {
    var w = Math.max(1 * s, size * s);
    var len = Math.max(0.8 * s, size * 0.35 * s);
    var rad = Math.min(w, len) * 0.25;
    var step = Math.max(0.5 * s, size * 0.2 * s);
    walk(pts, step, function (x, y, ux, uy) {
      var v = 1 + (rng() - 0.5) * 0.08;
      var mid = shade(color, v);
      var edge = shade(color, v * 0.98);
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(uy, ux));
      var g = c.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, edge);
      g.addColorStop(0.12, mid);
      g.addColorStop(0.88, mid);
      g.addColorStop(1, edge);
      c.fillStyle = g;
      roundRectPath(c, -len / 2, -w / 2, len, w, rad);
      c.fill();
      c.restore();
    });
  }

  /* Palette knife. A parallelogram, `size` wide across the path and size*0.6
     long along it, leaning by one length so the leading edge cuts across at
     about 31 degrees, stamped every size*0.5 px. Across the stamp the colour
     runs from 6% lighter on one rail to 6% darker on the other, which is the
     scrape of paint under the blade. The stamps are laid down back to front,
     so every leading edge stays on top and stays hard. No PRNG: the mark is
     the same every time. */
  function drawKnife(c, pts, size, color, s) {
    var w = Math.max(1 * s, size * s);
    var len = Math.max(0.8 * s, size * 0.6 * s);
    var skew = len;
    var step = Math.max(0.5 * s, size * 0.5 * s);
    var light = shade(color, 1.06);
    var dark = shade(color, 0.94);
    var stamps = [];
    walk(pts, step, function (x, y, ux, uy) { stamps.push(x, y, ux, uy); });
    for (var i = stamps.length - 4; i >= 0; i -= 4) {
      c.save();
      c.translate(stamps[i], stamps[i + 1]);
      c.rotate(Math.atan2(stamps[i + 3], stamps[i + 2]));
      var g = c.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, light);
      g.addColorStop(1, dark);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-len / 2 - skew / 2, -w / 2);
      c.lineTo(len / 2 - skew / 2, -w / 2);
      c.lineTo(len / 2 + skew / 2, w / 2);
      c.lineTo(-len / 2 + skew / 2, w / 2);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  /* k thin parallel lines offset across the path: hair, water, fabric */
  function drawBristle(c, pts, size, color, rng, s) {
    var k = Math.round(clamp(size / 3, 3, 14));
    var span = Math.max(2 * s, size * s);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (var b = 0; b < k; b++) {
      var off = (k === 1 ? 0 : b / (k - 1) - 0.5) * span;
      c.strokeStyle = shade(color, 1 + (rng() - 0.5) * 0.16);
      c.lineWidth = (1 + rng()) * s;
      c.beginPath();
      for (var j = 0; j < pts.length; j++) {
        var d = dirAt(pts, j);
        var o = off + (rng() - 0.5) * 1.6 * s;
        var x = pts[j].x - d[1] * o + (rng() - 0.5) * 0.8 * s;
        var y = pts[j].y + d[0] * o + (rng() - 0.5) * 0.8 * s;
        if (j === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }

  /* scanline flood fill, tol = max per-channel distance */
  function bucketFill(ctx, w, h, sx, sy, hex, tol, alpha) {
    sx = Math.round(sx); sy = Math.round(sy);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var seen = new Uint8Array(w * h);
    var s = (sy * w + sx) * 4;
    var tr = d[s], tg = d[s + 1], tb = d[s + 2];
    var fill = hexToRgb(hex);
    var a = clamp(alpha, 0, 1);

    function match(p) {
      var i = p * 4;
      return Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol && Math.abs(d[i + 2] - tb) <= tol;
    }
    function paint(p) {
      var i = p * 4;
      d[i] = d[i] + (fill[0] - d[i]) * a;
      d[i + 1] = d[i + 1] + (fill[1] - d[i + 1]) * a;
      d[i + 2] = d[i + 2] + (fill[2] - d[i + 2]) * a;
      d[i + 3] = 255;
    }

    var stack = [sx, sy];
    while (stack.length) {
      var y = stack.pop(), x = stack.pop();
      var row = y * w;
      var left = x;
      while (left >= 0 && !seen[row + left] && match(row + left)) left--;
      left++;
      var right = x;
      while (right < w && !seen[row + right] && match(row + right)) right++;
      right--;
      if (left > right) continue;
      for (var i = left; i <= right; i++) {
        seen[row + i] = 1;
        paint(row + i);
      }
      for (var dy = -1; dy <= 1; dy += 2) {
        var ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        var nrow = ny * w;
        for (var j = left; j <= right; j++) {
          if (!seen[nrow + j] && match(nrow + j)) {
            stack.push(j, ny);
            /* skip the rest of this run, the span fill picks it up */
            while (j <= right && !seen[nrow + j] && match(nrow + j)) j++;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- the engine ---------- */

  function PaintEngine(canvas, options) {
    options = options || {};
    this.canvas = canvas;
    /* Render scale. Action coordinates stay in plan space; every length is
       multiplied by this at draw time. The canvas must already be plan size
       times scale, or give options.width/height in plan units and the engine
       sizes it. */
    var s = options.scale == null ? 1 : +options.scale;
    if (!isFinite(s) || s <= 0) s = 1;
    this.scale = s;
    if (options.width != null && options.height != null) {
      canvas.width = Math.round(+options.width * s);
      canvas.height = Math.round(+options.height * s);
    }
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    /* device pixels: plan size * scale */
    this.width = canvas.width;
    this.height = canvas.height;
    this.seed = options.seed == null ? 1 : options.seed | 0;
    /* bg null or 'transparent' keeps the canvas clear, which the UI uses for
       the live preview layer */
    this.bg = options.bg === undefined ? '#ffffff' : options.bg;
    this.history = [];

    this.layer = (typeof document !== 'undefined')
      ? document.createElement('canvas')
      : new OffscreenCanvas(this.width, this.height);
    this.layer.width = this.width;
    this.layer.height = this.height;
    this.lctx = this.layer.getContext('2d');

    this.reset();
  }

  PaintEngine.prototype.reset = function () {
    this.history = [];
    this._paintBg();
  };

  PaintEngine.prototype._paintBg = function () {
    var c = this.ctx;
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.width, this.height);
    if (this.bg && this.bg !== 'transparent') {
      c.fillStyle = this.bg;
      c.fillRect(0, 0, this.width, this.height);
    }
  };

  PaintEngine.prototype.rngFor = function (index) {
    /* two odd constants keep neighbouring (seed, index) pairs far apart */
    return mulberry32((Math.imul(this.seed | 0, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0);
  };

  PaintEngine.prototype.apply = function (action) {
    this._draw(action, this.history.length);
    this.history.push(action);
    return this;
  };

  PaintEngine.prototype.applyAll = function (actions) {
    for (var i = 0; i < actions.length; i++) this.apply(actions[i]);
    return this;
  };

  PaintEngine.prototype.undo = function () {
    if (!this.history.length) return this;
    var kept = this.history.slice(0, -1);
    this.reset();
    this.applyAll(kept);
    return this;
  };

  PaintEngine.prototype.toDataURL = function (type) {
    return this.canvas.toDataURL(type || 'image/png');
  };

  /* draw one action. index feeds the PRNG, so undo and replay repeat it. */
  PaintEngine.prototype._draw = function (action, index) {
    var a = action || {};
    var rng = this.rngFor(index);
    var alpha = a.alpha == null ? 1 : clamp(+a.alpha, 0, 1);

    if (a.t === 'mark') return;

    if (a.t === 'clear') {
      var c = this.ctx;
      c.globalAlpha = 1;
      c.fillStyle = a.color || this.bg || '#ffffff';
      c.fillRect(0, 0, this.width, this.height);
      return;
    }

    /* every length below is plan units times s, the tolerance is not a length */
    var s = this.scale;

    if (a.t === 'bucket') {
      bucketFill(this.ctx, this.width, this.height, +a.x * s, +a.y * s,
        a.color || '#000000', a.tol == null ? 32 : +a.tol, alpha);
      return;
    }

    if (a.t === 'stroke') {
      var pts = scalePts(normPts(a.pts), s);
      if (!pts.length) return;
      var size = Math.max(0.5, a.size == null ? 1 : +a.size);
      var tool = a.tool || 'pencil';
      var color = tool === 'eraser' ? (this.bg || '#ffffff') : (a.color || '#000000');
      var box = bboxOf(pts, size * s + 6 * s);
      var lc = this._openLayer(box);
      if (tool === 'brush') drawBrush(lc, pts, size, color, s);
      else if (tool === 'spray') drawSpray(lc, pts, size, color, rng, s);
      else if (tool === 'bristle') drawBristle(lc, pts, size, color, rng, s);
      else if (tool === 'flat') drawFlat(lc, pts, size, color, rng, s);
      else if (tool === 'knife') drawKnife(lc, pts, size, color, s);
      else drawHardLine(lc, pts, size, color, s); /* pencil and eraser */
      this._closeLayer(alpha);
      return;
    }

    if (a.t === 'poly') {
      var ppts = scalePts(normPts(a.pts), s);
      if (ppts.length < 3) return;
      var pbox = bboxOf(ppts, 2 * s);
      var pc = this._openLayer(pbox);
      pc.fillStyle = pc.strokeStyle = a.color || '#000000';
      pc.lineWidth = 1 * s;
      pc.lineJoin = 'round';
      pc.beginPath();
      pc.moveTo(ppts[0].x, ppts[0].y);
      for (var i = 1; i < ppts.length; i++) pc.lineTo(ppts[i].x, ppts[i].y);
      pc.closePath();
      pc.fill();
      pc.stroke(); /* the outline kills the hairline seam between neighbours */
      this._closeLayer(alpha);
      return;
    }

    if (a.t === 'ellipse') {
      var rx = Math.max(0.5 * s, (+a.rx || 0) * s), ry = Math.max(0.5 * s, (+a.ry || 0) * s);
      var cx = (+a.cx || 0) * s, cy = (+a.cy || 0) * s;
      var m = Math.max(rx, ry) + 2 * s;
      var ec = this._openLayer({ x0: cx - m, y0: cy - m, x1: cx + m, y1: cy + m });
      ec.fillStyle = ec.strokeStyle = a.color || '#000000';
      ec.lineWidth = 1 * s;
      ec.beginPath();
      ec.ellipse(cx, cy, rx, ry, +a.rot || 0, 0, TAU);
      ec.fill();
      ec.stroke();
      this._closeLayer(alpha);
      return;
    }

    throw new Error('PaintEngine: unknown action type ' + JSON.stringify(a.t));
  };

  /* A stroke goes on its own layer first. The layer then lands on the canvas
     once, at globalAlpha = alpha, so dabs inside one stroke do not pile up.
     Only the touched box is cleared and copied, which keeps long plans fast. */
  PaintEngine.prototype._openLayer = function (box) {
    var x0 = clamp(Math.floor(box.x0), 0, this.width);
    var y0 = clamp(Math.floor(box.y0), 0, this.height);
    var x1 = clamp(Math.ceil(box.x1), 0, this.width);
    var y1 = clamp(Math.ceil(box.y1), 0, this.height);
    this._box = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
    var c = this.lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(this._box.x, this._box.y, this._box.w, this._box.h);
    c.save();
    c.beginPath();
    c.rect(this._box.x, this._box.y, this._box.w, this._box.h);
    c.clip();
    return c;
  };

  PaintEngine.prototype._closeLayer = function (alpha) {
    this.lctx.restore();
    var b = this._box;
    if (!b.w || !b.h) return;
    var c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = alpha;
    c.drawImage(this.layer, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    c.globalAlpha = 1;
  };

  /* handy for the UI and the render harness */
  PaintEngine.mulberry32 = mulberry32;
  PaintEngine.hexToRgb = hexToRgb;
  PaintEngine.rgbToHex = rgbToHex;
  PaintEngine.shade = shade;
  PaintEngine.mix = mix;

  global.PaintEngine = PaintEngine;
})(typeof window !== 'undefined' ? window : this);
