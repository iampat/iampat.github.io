/* ==========================================================================
   Flashcard Drill — content-agnostic weighted-recall drill.
   Pure vanilla JS. No framework, no build step. Subpath-safe relative fetches.
   ========================================================================== */
(function () {
  'use strict';

  // ---- constants ----------------------------------------------------------
  var W_INIT   = 1.0;
  var W_RIGHT  = 0.45, W_RIGHT_MIN = 0.08;
  var W_WRONG  = 2.6,  W_WRONG_MAX = 8.0;
  var W_MASTER = 0.21;
  var RESET_ARM_MS = 4000;

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- module state -------------------------------------------------------
  var app = document.getElementById('app');
  var deck = null;
  var store = null;          // { repCount, cards: {id: {w,right,wrong,lastRep}} }
  var storageKey = null;
  var storageOK = true;

  var current = null;        // current card object
  var revealed = false;
  var recent = [];           // recently shown ids (for no-repeat guard)

  var sessionRight = 0, sessionTotal = 0;

  var refs = {};             // cached DOM references for the drill view

  // ---- storage probe ------------------------------------------------------
  try {
    var probe = '__fcd_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch (e) {
    storageOK = false;
  }

  // ---- helpers ------------------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function getParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }

  function pct(v, scale) {
    var lo = Math.log10(scale.min), hi = Math.log10(scale.max);
    var p = (Math.log10(v) - lo) / (hi - lo) * 100;
    return Math.max(0, Math.min(100, p));
  }

  function recallLevel(w) {
    if (w <= 0.21) return 'cold';
    if (w <= 0.5)  return 'low';
    if (w <= 1.6)  return 'normal';
    if (w <= 4)    return 'high';
    return 'urgent';
  }

  // ---- persistence --------------------------------------------------------
  function loadStore(d) {
    storageKey = 'fcd:' + d.id + ':v1';
    var parsed = null;
    if (storageOK) {
      try {
        var raw = localStorage.getItem(storageKey);
        if (raw) parsed = JSON.parse(raw);
      } catch (e) { parsed = null; }
    }
    var prev = (parsed && parsed.cards) || {};
    var cards = {};
    for (var i = 0; i < d.cards.length; i++) {
      var id = d.cards[i].id;
      var p = prev[id];
      if (p && typeof p.w === 'number') {
        cards[id] = {
          w: p.w,
          right: p.right | 0,
          wrong: p.wrong | 0,
          lastRep: (typeof p.lastRep === 'number') ? p.lastRep : null
        };
      } else {
        cards[id] = { w: W_INIT, right: 0, wrong: 0, lastRep: null };
      }
    }
    return {
      repCount: (parsed && typeof parsed.repCount === 'number') ? parsed.repCount : 0,
      cards: cards
    };
  }

  function saveStore() {
    if (!storageOK) return;
    try {
      // Only persist ids that exist in the current deck (drops removed ids).
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch (e) {
      storageOK = false;
      updateStatusLine();
    }
  }

  // ---- scheduling ---------------------------------------------------------
  function recencyFactor(id) {
    var st = store.cards[id];
    var age = (st.lastRep == null) ? Infinity : (store.repCount - st.lastRep);
    return Math.min(0.25 + age / 8, 2.5);
  }

  function pickNext() {
    var cards = deck.cards;

    // Build the candidate pool, excluding recently shown cards.
    // Hard rule: never the same card twice in a row (recent[0]); we also
    // keep a 2-deep window so a graded card can't return within 2 reps.
    var pool = cards.filter(function (c) { return recent.indexOf(c.id) === -1; });
    if (!pool.length) {
      pool = cards.filter(function (c) { return c.id !== recent[0]; });
    }
    if (!pool.length) pool = cards.slice();

    // Effect (b): while never-seen cards remain, introduce them first so the
    // whole deck is touched within ~N reps. A missed card's weight would
    // otherwise crowd unseen cards out and starve early coverage. Recently
    // shown cards are always already-seen, so this never fights the no-repeat
    // guard. Among unseen cards the weights are equal, so this is uniform.
    var unseen = pool.filter(function (c) { return store.cards[c.id].lastRep == null; });
    if (unseen.length) pool = unseen;

    var total = 0, weighted = [];
    for (var i = 0; i < pool.length; i++) {
      var c = pool[i];
      var p = store.cards[c.id].w * recencyFactor(c.id);
      total += p;
      weighted.push({ c: c, p: p });
    }

    var r = Math.random() * total;
    for (var j = 0; j < weighted.length; j++) {
      r -= weighted[j].p;
      if (r <= 0) return weighted[j].c;
    }
    return weighted[weighted.length - 1].c;
  }

  function grade(correct) {
    if (!revealed || !current) return;
    var st = store.cards[current.id];

    if (correct) {
      st.w = Math.max(st.w * W_RIGHT, W_RIGHT_MIN);
      st.right += 1;
      sessionRight += 1;
    } else {
      st.w = Math.min(st.w * W_WRONG, W_WRONG_MAX);
      st.wrong += 1;
    }
    sessionTotal += 1;
    st.lastRep = store.repCount;   // rep index at which it was just shown
    store.repCount += 1;

    // Track recency window (most-recent first, keep 2).
    recent.unshift(current.id);
    if (recent.length > 2) recent.length = 2;

    saveStore();
    next();
  }

  // ---- view: drill --------------------------------------------------------
  function buildDrillView() {
    clear(app);
    refs = {};

    // Header
    var hdr = el('header', 'hdr');
    var title = el('h1', 'hdr__title', deck.title || 'Flashcard Drill');
    hdr.appendChild(title);
    if (deck.subtitle) hdr.appendChild(el('span', 'hdr__sub', deck.subtitle));
    app.appendChild(hdr);

    // Stats strip
    var stats = el('div', 'stats');
    refs.stat = {};
    [['reps', 'Reps'], ['all', 'All-time'], ['sess', 'Session'], ['mast', 'Mastered']]
      .forEach(function (pair) {
        var s = el('div', 'stat');
        s.appendChild(el('span', 'stat__k', pair[1]));
        var v = el('span', 'stat__v', '—');
        s.appendChild(v);
        refs.stat[pair[0]] = v;
        stats.appendChild(s);
      });
    app.appendChild(stats);

    // Card
    var card = el('div', 'card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Flashcard — activate to reveal answer');
    refs.card = card;

    var tags = el('div', 'card__tags');
    refs.group = el('span', 'tag tag--group');
    refs.recall = el('span', 'tag tag--recall');
    tags.appendChild(refs.group);
    tags.appendChild(refs.recall);
    card.appendChild(tags);

    refs.front = el('div', 'card__front');
    card.appendChild(refs.front);

    refs.answer = el('div', 'card__answer is-masked');
    card.appendChild(refs.answer);

    refs.note = el('div', 'card__note');
    card.appendChild(refs.note);

    // Magnitude rail (built once if the deck has a scale)
    refs.rail = null;
    if (hasScale()) {
      refs.rail = buildRail();
      card.appendChild(refs.rail.root);
    }

    card.addEventListener('click', function () {
      if (!revealed) reveal();
    });
    app.appendChild(card);

    // Controls
    var controls = el('div', 'controls');
    refs.controls = controls;
    app.appendChild(controls);

    // Footer
    var footer = el('footer', 'footer');
    refs.status = el('div', 'footer__status');
    footer.appendChild(refs.status);
    refs.reset = el('button', 'btn btn--reset', 'Reset');
    refs.reset.type = 'button';
    footer.appendChild(refs.reset);
    app.appendChild(footer);

    wireReset();
    updateStatusLine();
    setupGestures();
  }

  function hasScale() {
    var s = deck.scale;
    return !!(s && s.type === 'log' &&
      typeof s.min === 'number' && typeof s.max === 'number' &&
      Array.isArray(s.ticks));
  }

  function buildRail() {
    var s = deck.scale;
    var root = el('div', 'rail');
    var track = el('div', 'rail__track');

    for (var i = 0; i < s.ticks.length; i++) {
      var t = s.ticks[i];
      var p = pct(t.v, s);
      var tick = el('div', 'rail__tick');
      tick.style.left = p + '%';
      track.appendChild(tick);
      if (t.label != null) {
        var lbl = el('div', 'rail__tick-label', String(t.label));
        lbl.style.left = Math.max(2, Math.min(97, p)) + '%';
        track.appendChild(lbl);
      }
    }

    var marker = el('div', 'rail__marker');
    track.appendChild(marker);
    root.appendChild(track);

    if (s.leftLabel || s.rightLabel) {
      var ends = el('div', 'rail__ends');
      ends.appendChild(el('span', null, s.leftLabel || ''));
      ends.appendChild(el('span', null, s.rightLabel || ''));
      root.appendChild(ends);
    }

    return { root: root, marker: marker };
  }

  // ---- controls rendering -------------------------------------------------
  function renderControls() {
    var c = refs.controls;
    clear(c);
    if (!revealed) {
      var show = el('button', 'btn btn--show');
      show.type = 'button';
      show.innerHTML = 'Show';
      var h1 = el('span', 'btn__hint', '(space)');
      show.appendChild(h1);
      show.addEventListener('click', reveal);
      c.appendChild(show);
    } else {
      var wrong = el('button', 'btn btn--wrong');
      wrong.type = 'button';
      wrong.textContent = 'Wrong';
      wrong.appendChild(el('span', 'btn__hint', '(←)'));
      wrong.addEventListener('click', function () { grade(false); });

      var ok = el('button', 'btn btn--ok');
      ok.type = 'button';
      ok.textContent = 'Correct';
      ok.appendChild(el('span', 'btn__hint', '(→)'));
      ok.addEventListener('click', function () { grade(true); });

      c.appendChild(wrong);
      c.appendChild(ok);
    }
  }

  // ---- card show / reveal -------------------------------------------------
  function next() {
    current = pickNext();
    revealed = false;
    showCard();
  }

  function showCard() {
    var st = store.cards[current.id];
    refs.group.textContent = current.group || '';
    refs.recall.textContent = 'recall · ' + recallLevel(st.w);
    refs.front.textContent = current.front;

    refs.answer.textContent = '— — —';
    refs.answer.classList.add('is-masked');

    refs.note.textContent = '';   // reserved height keeps layout stable

    // Rail: hide marker until reveal, but keep its previous left (slide effect).
    if (refs.rail) refs.rail.marker.classList.remove('is-on');

    refs.card.setAttribute('aria-label', current.front + ' — activate to reveal answer');
    renderControls();
    updateStats();
  }

  function reveal() {
    if (revealed) return;
    revealed = true;

    refs.answer.textContent = current.back;
    refs.answer.classList.remove('is-masked');
    refs.note.textContent = current.note || '';

    if (refs.rail && hasScale() && typeof current.mag === 'number') {
      var left = pct(current.mag, deck.scale);
      if (REDUCED) {
        refs.rail.marker.style.left = left + '%';
        refs.rail.marker.classList.add('is-on');
      } else {
        // Ensure the transition runs from the previous position on next frame.
        requestAnimationFrame(function () {
          refs.rail.marker.style.left = left + '%';
          refs.rail.marker.classList.add('is-on');
        });
      }
    }

    renderControls();
  }

  // ---- stats --------------------------------------------------------------
  function updateStats() {
    var right = 0, wrong = 0, mastered = 0, n = deck.cards.length;
    for (var i = 0; i < deck.cards.length; i++) {
      var st = store.cards[deck.cards[i].id];
      right += st.right; wrong += st.wrong;
      if (st.w <= W_MASTER) mastered += 1;
    }
    var allTot = right + wrong;
    refs.stat.reps.textContent = store.repCount;
    refs.stat.all.textContent = allTot ? Math.round(right / allTot * 100) + '%' : '—';
    refs.stat.sess.textContent = sessionTotal
      ? Math.round(sessionRight / sessionTotal * 100) + '%' : '—';
    refs.stat.mast.textContent = mastered + '/' + n;
  }

  function updateStatusLine() {
    if (!refs.status) return;
    refs.status.textContent = storageOK
      ? 'Weighted recall · missed cards return sooner'
      : 'Storage unavailable · this session only';
  }

  // ---- reset (two-step) ---------------------------------------------------
  var resetTimer = null;
  function wireReset() {
    refs.reset.addEventListener('click', function () {
      if (refs.reset.classList.contains('is-armed')) {
        disarmReset();
        doReset();
      } else {
        refs.reset.classList.add('is-armed');
        refs.reset.textContent = 'Erase all?';
        resetTimer = setTimeout(disarmReset, RESET_ARM_MS);
      }
    });
  }
  function disarmReset() {
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    refs.reset.classList.remove('is-armed');
    refs.reset.textContent = 'Reset';
  }
  function doReset() {
    if (storageOK) {
      try { localStorage.removeItem(storageKey); } catch (e) {}
    }
    store = loadStore(deck);
    sessionRight = 0; sessionTotal = 0;
    recent = [];
    current = null;
    next();
  }

  // ---- keyboard -----------------------------------------------------------
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (!revealed && (k === ' ' || k === 'Enter' || k === 'Spacebar')) {
      e.preventDefault(); reveal();
    } else if (revealed && k === 'ArrowLeft') {
      e.preventDefault(); grade(false);
    } else if (revealed && k === 'ArrowRight') {
      e.preventDefault(); grade(true);
    }
  }

  // ---- swipe (mobile) -----------------------------------------------------
  function setupGestures() {
    var x0 = null, y0 = null, tracking = false;
    var THRESH = 55;

    refs.card.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tracking = true;
    }, { passive: true });

    refs.card.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      if (!revealed) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy) * 1.6) {
        if (dx < 0) grade(false); else grade(true);
      }
    }, { passive: true });
  }

  // ---- validation ---------------------------------------------------------
  function validateDeck(d) {
    var errs = [];
    if (!d || typeof d !== 'object') return ['Deck is not a JSON object.'];
    if (!d.id) errs.push('Deck is missing an "id".');
    if (!Array.isArray(d.cards) || d.cards.length === 0) {
      errs.push('Deck has no "cards" array.');
      return errs;
    }
    var seen = {};
    for (var i = 0; i < d.cards.length; i++) {
      var c = d.cards[i], where = 'card #' + (i + 1);
      if (!c || typeof c !== 'object') { errs.push(where + ' is not an object.'); continue; }
      if (!c.id) { errs.push(where + ' is missing "id".'); }
      else {
        if (seen[c.id]) errs.push('Duplicate card id "' + c.id + '".');
        seen[c.id] = true;
        where = 'card "' + c.id + '"';
      }
      if (c.front == null || c.front === '') errs.push(where + ' is missing "front".');
      if (c.back == null || c.back === '') errs.push(where + ' is missing "back".');
    }
    return errs;
  }

  // ---- screens ------------------------------------------------------------
  function showError(heading, message, list) {
    clear(app);
    var box = el('div', 'error');
    box.appendChild(el('div', 'error__h', heading));
    var body = el('div', 'error__body');
    body.appendChild(document.createTextNode(message));
    if (list && list.length) {
      var ul = el('ul', 'error__list');
      for (var i = 0; i < list.length; i++) ul.appendChild(el('li', null, list[i]));
      body.appendChild(ul);
    }
    box.appendChild(body);
    app.appendChild(box);
  }

  function showPicker(manifest, metas) {
    clear(app);
    var wrap = el('div', 'picker');
    wrap.appendChild(el('div', 'picker__h', 'Choose a deck'));
    metas.forEach(function (m) {
      var b = el('button', 'deck');
      b.type = 'button';
      b.appendChild(el('span', 'deck__title', m.title));
      b.appendChild(el('span', 'deck__count', m.count + ' cards'));
      b.addEventListener('click', function () {
        // Preserve state; update URL so a reload sticks to the pick.
        history.replaceState(null, '', '?deck=' + encodeURIComponent(m.id));
        startDeck(m.id);
      });
      wrap.appendChild(b);
    });
    app.appendChild(wrap);
  }

  // ---- loading ------------------------------------------------------------
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function safeId(id) { return /^[A-Za-z0-9_-]+$/.test(id); }

  function startDeck(id) {
    if (!safeId(id)) {
      showError('Unknown deck', 'The deck id "' + id + '" is not valid.');
      return;
    }
    fetchJSON('decks/' + id + '.json').then(function (d) {
      var errs = validateDeck(d);
      if (errs.length) {
        showError('This deck can’t be loaded',
          'The deck file has problems that must be fixed:', errs);
        return;
      }
      deck = d;
      document.title = (d.title || 'Flashcard Drill');
      store = loadStore(d);
      recent = [];
      buildDrillView();
      next();
      document.addEventListener('keydown', onKey);
    }).catch(function () {
      showError('Deck not found',
        'Could not load deck "' + id + '". Check that decks/' + id +
        '.json exists.');
    });
  }

  function init() {
    var param = getParam('deck');
    if (param) { startDeck(param); return; }

    // No param: consult the manifest.
    fetchJSON('decks/index.json').then(function (mani) {
      var ids = (mani && Array.isArray(mani.decks)) ? mani.decks : [];
      if (ids.length === 0) {
        showError('No decks', 'The manifest decks/index.json lists no decks.');
        return;
      }
      if (ids.length === 1) { startDeck(ids[0]); return; }

      // Several decks: load light metadata for the picker.
      Promise.all(ids.map(function (id) {
        return fetchJSON('decks/' + id + '.json').then(function (d) {
          return { id: id, title: (d && d.title) || id,
                   count: (d && Array.isArray(d.cards)) ? d.cards.length : 0 };
        }).catch(function () { return { id: id, title: id, count: 0 }; });
      })).then(function (metas) { showPicker(mani, metas); });
    }).catch(function () {
      showError('Cannot start',
        'Could not load the deck manifest (decks/index.json).');
    });
  }

  init();
})();
