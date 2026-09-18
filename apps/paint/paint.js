/* Paint UI. Every gesture becomes exactly one engine action, so the exported
   script repaints the picture exactly. */
(function () {
  'use strict';

  var W = 720, H = 960;
  var canvas = document.getElementById('canvas');
  var overlay = document.getElementById('overlay');
  var eng = new PaintEngine(canvas, { seed: 1, bg: '#ffffff' });
  /* second engine on the top canvas, only for the live preview of a gesture */
  var pre = new PaintEngine(overlay, { seed: 1, bg: null });

  var state = { tool: 'pencil', color: '#000000', size: 6, alpha: 1, tol: 32 };
  var gesture = null;   /* stroke or ellipse in progress */
  var poly = null;      /* points of an open polygon */
  var replayId = 0;
  var replayActs = null;  /* snapshot the replay paints from */
  var replayAt = 0;

  var COLORS = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080',
    '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
    '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'
  ];

  var $ = function (id) { return document.getElementById(id); };
  var status = $('status');

  function say(msg) {
    status.textContent = msg + '  |  ' + eng.history.length + ' actions  |  ' +
      state.tool + ' ' + state.color + ' size ' + state.size + ' opacity ' + state.alpha;
  }

  /* ---------- palette and controls ---------- */

  var grid = $('grid');
  COLORS.forEach(function (c) {
    var b = document.createElement('button');
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', function () { setColor(c); });
    grid.appendChild(b);
  });

  function setColor(c) {
    state.color = c;
    $('swatch').style.background = c;
    $('in-color').value = c;
    say('colour ' + c);
  }
  $('in-color').addEventListener('input', function () { setColor(this.value); });

  document.querySelectorAll('.tool').forEach(function (b) {
    b.addEventListener('click', function () { setTool(b.dataset.tool); });
  });

  function setTool(t) {
    if (poly) cancelPoly();
    state.tool = t;
    document.querySelectorAll('.tool').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tool === t);
    });
    say(t === 'poly' ? 'click to add points, double-click to close' :
      t === 'ellipse' ? 'drag to draw an ellipse' :
        t === 'flat' ? 'flat brush: a wide band with hard edges' :
          t === 'knife' ? 'palette knife: short wide smears' : 'tool ' + t);
  }

  function bindRange(id, out, key, round) {
    var el = $(id);
    el.addEventListener('input', function () {
      state[key] = round ? Math.round(+el.value) : +el.value;
      $(out).textContent = state[key];
      say(key + ' ' + state[key]);
    });
  }
  bindRange('rng-size', 'out-size', 'size', true);
  bindRange('rng-alpha', 'out-alpha', 'alpha', false);
  bindRange('rng-tol', 'out-tol', 'tol', true);

  /* ---------- pointer helpers ---------- */

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return [
      Math.round((e.clientX - r.left) * W / r.width * 10) / 10,
      Math.round((e.clientY - r.top) * H / r.height * 10) / 10
    ];
  }

  function commit(action) {
    clearPreview();
    eng.apply(action);
    say(action.t + (action.tool ? ' ' + action.tool : '') + ' done');
  }

  function preview(action) {
    pre.reset();
    try { pre.apply(action); } catch (err) { /* half-built shapes are fine */ }
  }

  function clearPreview() { pre.reset(); }

  function pick(x, y) {
    var d = canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data;
    setColor(PaintEngine.rgbToHex([d[0], d[1], d[2]]));
  }

  /* ---------- drawing gestures ---------- */

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    stopReplay();   /* a new gesture always lands on top of the finished picture */
    var p = pos(e);
    canvas.setPointerCapture(e.pointerId);

    if (state.tool === 'picker') { pick(p[0], p[1]); return; }

    if (state.tool === 'bucket') {
      commit({ t: 'bucket', x: Math.round(p[0]), y: Math.round(p[1]), color: state.color, alpha: state.alpha, tol: state.tol });
      return;
    }

    if (state.tool === 'poly') {
      poly = poly || [];
      poly.push(p);
      preview(polyAction(poly));
      say('polygon: ' + poly.length + ' points, double-click to close');
      return;
    }

    if (state.tool === 'ellipse') {
      gesture = { kind: 'ellipse', a: p, b: p, shift: e.shiftKey };
      preview(ellipseAction(gesture));
      return;
    }

    gesture = { kind: 'stroke', pts: [p] };
    preview(strokeAction(gesture));
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = pos(e);
    if (!gesture) {
      if (poly) return;
      say('x ' + Math.round(p[0]) + ' y ' + Math.round(p[1]));
      return;
    }
    if (gesture.kind === 'ellipse') {
      gesture.b = p;
      gesture.shift = e.shiftKey;
      preview(ellipseAction(gesture));
      return;
    }
    var last = gesture.pts[gesture.pts.length - 1];
    if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) < 1.2) return;
    gesture.pts.push(p);
    preview(strokeAction(gesture));
  });

  function endGesture() {
    if (!gesture) return;
    var g = gesture;
    gesture = null;
    if (g.kind === 'ellipse') {
      var a = ellipseAction(g);
      if (a.rx >= 0.5 && a.ry >= 0.5) commit(a); else clearPreview();
    } else {
      commit(strokeAction(g));
    }
  }
  canvas.addEventListener('pointerup', endGesture);
  canvas.addEventListener('pointercancel', function () { gesture = null; clearPreview(); });

  canvas.addEventListener('dblclick', function () {
    if (state.tool !== 'poly' || !poly) return;
    var pts = dedupe(poly);
    poly = null;
    if (pts.length >= 3) commit(polyAction(pts)); else clearPreview();
  });

  function cancelPoly() { poly = null; clearPreview(); }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'Escape') cancelPoly();
    if (e.key === 'Enter' && poly) {
      var pts = dedupe(poly);
      poly = null;
      if (pts.length >= 3) commit(polyAction(pts)); else clearPreview();
    }
  });

  function dedupe(pts) {
    return pts.filter(function (p, i) {
      return i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1];
    });
  }

  function strokeAction(g) {
    var a = { t: 'stroke', tool: state.tool, size: state.size, alpha: state.alpha, pts: g.pts.slice() };
    if (state.tool !== 'eraser') a.color = state.color;
    return a;
  }

  function polyAction(pts) {
    return { t: 'poly', color: state.color, alpha: state.alpha, pts: pts.slice() };
  }

  function ellipseAction(g) {
    var rx = Math.abs(g.b[0] - g.a[0]) / 2, ry = Math.abs(g.b[1] - g.a[1]) / 2;
    if (g.shift) { rx = ry = Math.max(rx, ry); }
    return {
      t: 'ellipse', color: state.color, alpha: state.alpha,
      cx: Math.round(((g.a[0] + g.b[0]) / 2) * 10) / 10,
      cy: Math.round(((g.a[1] + g.b[1]) / 2) * 10) / 10,
      rx: Math.round(rx * 10) / 10, ry: Math.round(ry * 10) / 10, rot: 0
    };
  }

  /* ---------- buttons ---------- */

  function undo() { stopReplay(); eng.undo(); say('undo'); }

  $('btn-undo').addEventListener('click', undo);
  $('btn-clear').addEventListener('click', function () {
    stopReplay();
    commit({ t: 'clear', color: '#ffffff' });
  });

  $('btn-save').addEventListener('click', function () {
    download(eng.toDataURL(), 'painting.png');
  });

  $('btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(eng.history)], { type: 'application/json' });
    download(URL.createObjectURL(blob), 'script.json');
    say('exported ' + eng.history.length + ' actions');
  });

  function download(href, name) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
  }

  $('in-script').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        var acts = Array.isArray(data) ? data : data.actions;
        stopReplay();
        eng.reset();
        eng.applyAll(acts);
        say('loaded ' + acts.length + ' actions');
      } catch (err) {
        say('bad script: ' + err.message);
      }
    };
    r.readAsText(f);
    this.value = '';
  });

  $('btn-replay').addEventListener('click', function () {
    if (replayId) { stopReplay(); return; }
    if (!eng.history.length) return;
    replayActs = eng.history.slice();
    replayAt = 0;
    eng.reset();
    (function step() {
      var n = Math.max(1, +$('rng-speed').value);
      for (var k = 0; k < n && replayAt < replayActs.length; k++) eng.apply(replayActs[replayAt++]);
      say('replay ' + replayAt + '/' + replayActs.length);
      replayId = replayAt < replayActs.length ? requestAnimationFrame(step) : 0;
      if (!replayId) replayActs = null;
    })();
  });

  /* Stop the animation and paint the rest at once, so the history is whole
     again. Anything the user does next appends after the full script. */
  function stopReplay() {
    if (!replayId) return;
    cancelAnimationFrame(replayId);
    replayId = 0;
    while (replayAt < replayActs.length) eng.apply(replayActs[replayAt++]);
    replayActs = null;
  }

  /* ---------- reference panel ---------- */

  var refCanvas = $('refcanvas');
  var refCtx = refCanvas.getContext('2d', { willReadFrequently: true });

  $('in-ref').addEventListener('change', function () {
    var f = this.files[0];
    if (!f) return;
    var url = URL.createObjectURL(f);
    var img = new Image();
    img.onload = function () {
      var s = Math.min(W / img.width, H / img.height);
      var w = img.width * s, h = img.height * s;
      refCtx.fillStyle = '#ffffff';
      refCtx.fillRect(0, 0, W, H);
      refCtx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      URL.revokeObjectURL(url);
      say('reference loaded');
    };
    img.src = url;
    this.value = '';
  });

  refCanvas.addEventListener('click', function (e) {
    if (state.tool !== 'picker') { say('choose the Picker tool to take a colour from the photo'); return; }
    var r = refCanvas.getBoundingClientRect();
    var x = Math.round((e.clientX - r.left) * W / r.width);
    var y = Math.round((e.clientY - r.top) * H / r.height);
    var d = refCtx.getImageData(x, y, 1, 1).data;
    setColor(PaintEngine.rgbToHex([d[0], d[1], d[2]]));
  });

  /* ---------- start ---------- */

  setTool('pencil');
  setColor('#000000');
  say('ready');
})();
