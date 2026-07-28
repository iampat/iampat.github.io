/* ==========================================================================
   Flashcard Drill — content-agnostic weighted-recall drill.
   Pure vanilla JS. No framework, no build step. Subpath-safe relative fetches.
   ========================================================================== */
(function () {
  'use strict';

  // ---- constants (scheduler tuning lives here, nowhere else) ---------------
  var W_INIT   = 1.0;
  var W_RIGHT  = 0.45, W_RIGHT_MIN = 0.08;
  var W_WRONG  = 2.6,  W_WRONG_MAX = 8.0;
  // "Two consecutive corrects from fresh": W_INIT * W_RIGHT^2 = 0.2025.
  // Keep in sync with W_RIGHT if retuning.
  var W_MASTER = 0.21;
  // Recency weight. A near-zero floor makes rec scale ~linearly with age, so a
  // long-unseen card outweighs a just-answered one by roughly their age ratio;
  // the steep slope and high ceiling let that dominate the base-weight range.
  var REC_MIN  = 0.05, REC_PER_AGE = 0.2, REC_MAX = 30;
  var NO_REPEAT = 2;         // a graded card can't return within this many reps
  var RESET_ARM_MS = 4000;

  // ---- module state -------------------------------------------------------
  var app = document.getElementById('app');
  var manifestIds = [];      // every deck id in decks/index.json
  var selected = [];         // deck ids in the current drill pool
  var decks = {};            // id → validated deck
  var pool = [];             // cards of all selected decks (card._set = owner id)
  var stores = {};           // id → { cards: {cardId: {w,right,wrong,lastRep}} }
  var globalRep = 0;         // library-wide rep counter (all sets share one age axis)
  var railDeckId = null;     // the selected deck whose scale the rail renders
  var storageOK = true;

  var current = null;        // current card object
  var revealed = false;
  var imgFace = false;       // this showing uses the photo as the prompt face
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

  function makeBtn(cls, label, hint, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    if (hint) b.appendChild(el('span', 'btn__hint', hint));
    b.addEventListener('click', onClick);
    return b;
  }

  function deckUrl(id) { return 'decks/' + id + '.json'; }

  function pct(v, scale) {
    var lo = Math.log10(scale.min), hi = Math.log10(scale.max);
    var p = (Math.log10(v) - lo) / (hi - lo) * 100;
    return Math.max(0, Math.min(100, p));
  }

  // ---- persistence --------------------------------------------------------
  // One store per set (fcd:<setId>:v1) plus one shared global rep counter.
  // Only the selected sets' keys are ever loaded or written, so a deselected
  // set's stats can never be touched, let alone dropped.
  var GLOBAL_KEY = 'fcd:global:v1';
  var SELECTED_KEY = 'fcd:selected:v1';

  function storeKey(id) { return 'fcd:' + id + ':v1'; }

  function readJSON(key) {
    if (!storageOK) return null;
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    if (!storageOK) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      storageOK = false;   // callers refresh the status line
    }
  }

  // Load the selected sets' stores, merging by card id (edits/reorders never
  // disturb other cards; removed ids drop on next save). No migration or
  // backward compatibility: stats are disposable and a store that doesn't
  // match the current format simply starts fresh.
  function loadStores(ids) {
    var g = readJSON(GLOBAL_KEY);
    globalRep = (g && typeof g.repCount === 'number') ? g.repCount : 0;

    stores = {};
    ids.forEach(function (id) {
      var p = readJSON(storeKey(id));
      var prev = (p && p.cards) || {};
      var cards = {};
      decks[id].cards.forEach(function (c) {
        var s = prev[c.id];
        if (s && typeof s.w === 'number') {
          cards[c.id] = {
            w: s.w,
            right: s.right | 0,
            wrong: s.wrong | 0,
            lastRep: (typeof s.lastRep === 'number') ? s.lastRep : null
          };
        } else {
          cards[c.id] = { w: W_INIT, right: 0, wrong: 0, lastRep: null };
        }
      });
      stores[id] = { cards: cards };
    });
  }

  function statOf(card) { return stores[card._set].cards[card.id]; }

  function saveProgress(setId) {
    writeJSON(storeKey(setId), stores[setId]);
    writeJSON(GLOBAL_KEY, { repCount: globalRep });
  }

  // ---- scheduling ---------------------------------------------------------
  function cardKey(card) { return card._set + ':' + card.id; }

  function recencyFactor(card) {
    var st = statOf(card);
    var age = (st.lastRep == null) ? Infinity
      : Math.max(0, globalRep - st.lastRep);
    return Math.min(REC_MIN + age * REC_PER_AGE, REC_MAX);
  }

  function pickNext() {
    // Exclude recently shown cards. Hard rule: never the same card twice in a
    // row (recent[0]); the NO_REPEAT-deep window keeps a just-graded card from
    // returning right away.
    var eligible = pool.filter(function (c) { return recent.indexOf(cardKey(c)) === -1; });
    if (!eligible.length) {
      eligible = pool.filter(function (c) { return cardKey(c) !== recent[0]; });
    }
    if (!eligible.length) eligible = pool.slice();

    var unseen = eligible.filter(function (c) { return statOf(c).lastRep == null; });
    var seen = eligible.filter(function (c) { return statOf(c).lastRep != null; });

    // Introducing new cards: with a single set, unseen-first is absolute so
    // the whole deck is touched within ~N reps. In a mixed pool that rule
    // would let a newly added set monopolize the drill, so introduction is
    // throttled instead — at least 1-in-3 draws, more while most of the pool
    // is unseen. Unseen cards all have w = W_INIT, so uniform pick = weighted.
    if (unseen.length) {
      var introduce = selected.length === 1 || !seen.length ||
        Math.random() < Math.max(1 / 3, unseen.length / eligible.length);
      if (introduce) return unseen[Math.floor(Math.random() * unseen.length)];
    }

    var total = 0, weights = [];
    for (var i = 0; i < seen.length; i++) {
      var p = statOf(seen[i]).w * recencyFactor(seen[i]);
      total += p;
      weights.push(p);
    }
    var r = Math.random() * total;
    for (var j = 0; j < seen.length; j++) {
      r -= weights[j];
      if (r <= 0) return seen[j];
    }
    return seen[seen.length - 1];
  }

  function grade(correct) {
    if (!revealed || !current) return;
    var st = statOf(current);

    if (correct) {
      st.w = Math.max(st.w * W_RIGHT, W_RIGHT_MIN);
      st.right += 1;
      sessionRight += 1;
    } else {
      st.w = Math.min(st.w * W_WRONG, W_WRONG_MAX);
      st.wrong += 1;
    }
    sessionTotal += 1;
    st.lastRep = globalRep;   // rep index at which it was just shown
    globalRep += 1;

    // Track recency window (most-recent first).
    recent.unshift(cardKey(current));
    if (recent.length > NO_REPEAT) recent.length = NO_REPEAT;

    saveProgress(current._set);
    updateStatusLine();   // reflects a storage failure surfaced by the save
    next();
  }

  // ---- view: drill --------------------------------------------------------
  function buildDrillView() {
    clear(app);
    refs = {};

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

    // Card (aria-label is set per-card in showCard)
    var card = el('div', 'card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    refs.card = card;

    var tags = el('div', 'card__tags');
    refs.group = el('span', 'tag tag--group');
    refs.setTag = el('span', 'tag tag--set');
    tags.appendChild(refs.group);
    tags.appendChild(refs.setTag);
    card.appendChild(tags);

    refs.front = el('div', 'card__front');
    card.appendChild(refs.front);

    // Image slot: the photo prompt face, or the revealed photo (entity cards).
    refs.img = el('img', 'card__img');
    refs.img.hidden = true;
    card.appendChild(refs.img);

    refs.answer = el('div', 'card__answer is-masked');
    card.appendChild(refs.answer);

    refs.note = el('div', 'card__note');
    card.appendChild(refs.note);

    // Magnitude rail (built once from the selected pool's scaled deck; scales
    // were normalized to null at load when absent or malformed). Cards from
    // other sets simply hide it. Multi-scale pools are deferred by design —
    // if two scaled decks are ever selected, the first one wins.
    refs.rail = null;
    if (railDeckId) {
      refs.rail = buildRail(decks[railDeckId].scale);
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
    if (manifestIds.length > 1) {
      footer.appendChild(makeBtn('btn btn--foot', 'Sets', null, onSetsClick));
    }
    refs.reset = makeBtn('btn btn--foot', 'Reset', null, onResetClick);
    footer.appendChild(refs.reset);
    app.appendChild(footer);

    updateStatusLine();
    setupGestures();
  }

  function buildRail(s) {
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
      c.appendChild(makeBtn('btn btn--show', 'Show', '(space)', reveal));
    } else {
      c.appendChild(makeBtn('btn btn--wrong', 'Wrong', '(←)',
        function () { grade(false); }));
      c.appendChild(makeBtn('btn btn--ok', 'Correct', '(→)',
        function () { grade(true); }));
    }
  }

  // ---- card show / reveal -------------------------------------------------
  function next() {
    current = pickNext();
    revealed = false;
    showCard();
  }

  function showCard() {
    refs.group.textContent = current.group || '';
    // In a mixed pool, say which set the card came from.
    refs.setTag.textContent = selected.length > 1
      ? (decks[current._set].title || current._set) : '';
    refs.front.textContent = current.front;

    // Prompt face: any card with a photo uses either the photo or the front
    // text as the clue, chosen per showing. Presentation only — no stats.
    imgFace = !!current.img && Math.random() < 0.5;
    refs.front.hidden = imgFace;
    if (current.img) {
      refs.img.src = 'decks/' + current.img;
      refs.img.alt = imgFace ? 'Photo clue' : current.front;
    }
    refs.img.hidden = !imgFace;

    refs.answer.textContent = '— — —';
    refs.answer.classList.add('is-masked');
    refs.answer.classList.remove('is-multiline');

    refs.note.textContent = '';   // reserved height keeps layout stable

    // Rail: hide marker until reveal, but keep its previous left (slide
    // effect). Hidden entirely (no gap) for cards without a numeric mag or
    // from a set other than the rail's.
    if (refs.rail) {
      refs.rail.marker.classList.remove('is-on');
      refs.rail.root.hidden =
        (current._set !== railDeckId || typeof current.mag !== 'number');
    }

    refs.card.setAttribute('aria-label',
      (imgFace ? 'Photo clue' : current.front) + ' — activate to reveal answer');
    renderControls();
    updateStats();
  }

  function reveal() {
    if (revealed) return;
    revealed = true;

    refs.answer.classList.remove('is-masked');
    // Reveal whichever face wasn't the prompt (front after a photo clue,
    // photo after a text clue) — applies to every card shape.
    if (imgFace) refs.front.hidden = false;
    else if (current.img) refs.img.hidden = false;

    if (current.facts) {
      // Entity card: labelled fact rows.
      clear(refs.answer);
      refs.answer.classList.remove('is-multiline');
      var facts = el('div', 'facts');
      for (var k in current.facts) {
        var row = el('div', 'fact');
        row.appendChild(el('span', 'fact__k', k));
        row.appendChild(el('span', 'fact__v', current.facts[k]));
        facts.appendChild(row);
      }
      refs.answer.appendChild(facts);
    } else if (Array.isArray(current.back)) {
      // Checklist card: the answer is a list of points, rendered at body size.
      clear(refs.answer);
      refs.answer.classList.remove('is-multiline');
      var ul = el('ul', 'answer-list');
      for (var i = 0; i < current.back.length; i++) {
        ul.appendChild(el('li', null, current.back[i]));
      }
      refs.answer.appendChild(ul);
    } else {
      refs.answer.textContent = current.back;
      refs.answer.classList.toggle('is-multiline', current.back.indexOf('\n') !== -1);
    }
    refs.note.textContent = current.note || '';

    if (refs.rail && current._set === railDeckId && typeof current.mag === 'number') {
      var left = pct(current.mag, decks[railDeckId].scale);
      // Next frame, so the transition runs from the previous card's position.
      // (prefers-reduced-motion is handled in CSS: the transition is disabled.)
      requestAnimationFrame(function () {
        refs.rail.marker.style.left = left + '%';
        refs.rail.marker.classList.add('is-on');
      });
    }

    renderControls();
  }

  // ---- stats --------------------------------------------------------------
  // All stats are scoped to the current pool (the selected sets), not the
  // whole library: Reps = lifetime graded reps on these cards.
  function updateStats() {
    var right = 0, wrong = 0, mastered = 0, n = pool.length;
    for (var i = 0; i < pool.length; i++) {
      var st = statOf(pool[i]);
      right += st.right; wrong += st.wrong;
      if (st.w <= W_MASTER) mastered += 1;
    }
    var allTot = right + wrong;
    refs.stat.reps.textContent = allTot;
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

  // ---- session lifecycle --------------------------------------------------
  // Shared by pool start and reset: (re)load stats and begin drilling.
  function startSession() {
    loadStores(selected);
    sessionRight = 0; sessionTotal = 0;
    recent = [];
    next();
  }

  // ---- reset (two-step) ---------------------------------------------------
  // Erases stats for the selected sets only; other sets are untouched.
  var resetTimer = null;
  function onResetClick() {
    if (refs.reset.classList.contains('is-armed')) {
      disarmReset();
      if (storageOK) {
        try {
          selected.forEach(function (id) { localStorage.removeItem(storeKey(id)); });
        } catch (e) {}
      }
      startSession();
    } else {
      refs.reset.classList.add('is-armed');
      refs.reset.textContent = 'Erase all?';
      resetTimer = setTimeout(disarmReset, RESET_ARM_MS);
    }
  }

  // ---- selection navigation -----------------------------------------------
  function onSetsClick() {
    // A ?deck= URL pins a single set on every reload; leaving via the
    // selection screen must strip it or the pick would never stick.
    history.replaceState(null, '', window.location.pathname);
    showSelection(selected);
  }
  function disarmReset() {
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    refs.reset.classList.remove('is-armed');
    refs.reset.textContent = 'Reset';
  }

  // ---- keyboard -----------------------------------------------------------
  function onKey(e) {
    if (!current) return;   // drill view not active (picker/error screen)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (!revealed && (k === ' ' || k === 'Enter')) {
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
  // The magnitude rail is optional: normalize deck.scale to null unless it is
  // a well-formed log scale, so views only ever see a usable scale or nothing.
  function normalizeScale(s) {
    var ok = s && s.type === 'log' &&
      typeof s.min === 'number' && typeof s.max === 'number' &&
      Array.isArray(s.ticks);
    return ok ? s : null;
  }

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
      // The answer shape is implied by the data: string back = value card,
      // array back = checklist, facts object = entity.
      if (c.facts != null) {
        if (c.back != null) errs.push(where + ' has both "back" and "facts" — use one.');
        if (typeof c.facts !== 'object' || Array.isArray(c.facts) ||
            !Object.keys(c.facts).length) {
          errs.push(where + ' "facts" must be an object of label → value.');
        } else {
          for (var f in c.facts) {
            if (typeof c.facts[f] !== 'string' || c.facts[f] === '') {
              errs.push(where + ' fact "' + f + '" must be a non-empty string.');
              break;
            }
          }
        }
      } else if (Array.isArray(c.back)) {
        if (!c.back.length) errs.push(where + ' has an empty "back" list.');
        for (var j = 0; j < c.back.length; j++) {
          if (typeof c.back[j] !== 'string' || c.back[j] === '') {
            errs.push(where + ' "back" item #' + (j + 1) + ' must be a non-empty string.');
            break;
          }
        }
      } else if (c.back == null || c.back === '') {
        errs.push(where + ' is missing "back".');
      }
      if (c.img != null && (typeof c.img !== 'string' || c.img === '')) {
        errs.push(where + ' "img" must be a non-empty path string.');
      }
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

  // Multi-select set picker. The choice is persisted (fcd:selected:v1) so
  // reopening the app resumes the same pool; it is never written to the URL.
  function showSelection(preChecked) {
    Promise.all(manifestIds.map(function (id) {
      return fetchJSON(deckUrl(id)).then(function (d) {
        return { id: id, title: (d && d.title) || id,
                 count: (d && Array.isArray(d.cards)) ? d.cards.length : 0 };
      }).catch(function () { return { id: id, title: id, count: 0 }; });
    })).then(function (metas) {
      clear(app);
      current = null;   // deactivates drill keyboard shortcuts

      var checked = {};
      // Only manifest ids can be pre-checked (a ?deck= session may reference
      // an unlisted deck); an empty intersection falls back to all sets.
      var pre = (preChecked || []).filter(function (id) {
        return manifestIds.indexOf(id) !== -1;
      });
      (pre.length ? pre : manifestIds).forEach(function (id) { checked[id] = true; });

      var wrap = el('div', 'picker');
      wrap.appendChild(el('div', 'picker__h', 'Choose sets to practice'));

      var startBtn = makeBtn('btn btn--show', 'Start', null, function () {
        var ids = manifestIds.filter(function (id) { return checked[id]; });
        if (!ids.length) return;   // defense in depth; button is disabled anyway
        writeJSON(SELECTED_KEY, ids);
        startPool(ids);
      });
      startBtn.disabled = !manifestIds.some(function (id) { return checked[id]; });

      metas.forEach(function (m) {
        var b = el('button', 'deck');
        b.type = 'button';
        var mark = el('span', 'deck__check', checked[m.id] ? '✓' : '');
        b.appendChild(mark);
        b.appendChild(el('span', 'deck__title', m.title));
        b.appendChild(el('span', 'deck__count', m.count + ' cards'));
        b.classList.toggle('is-checked', !!checked[m.id]);
        b.addEventListener('click', function () {
          checked[m.id] = !checked[m.id];
          mark.textContent = checked[m.id] ? '✓' : '';
          b.classList.toggle('is-checked', checked[m.id]);
          startBtn.disabled = !manifestIds.some(function (id) { return checked[id]; });
        });
        wrap.appendChild(b);
      });

      wrap.appendChild(startBtn);
      app.appendChild(wrap);
    });
  }

  // ---- loading ------------------------------------------------------------
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function safeId(id) { return /^[A-Za-z0-9_-]+$/.test(id); }

  // Load the given sets and start drilling their union.
  function startPool(ids) {
    for (var i = 0; i < ids.length; i++) {
      if (!safeId(ids[i])) {
        showError('Unknown deck', 'The deck id "' + ids[i] + '" is not valid.');
        return;
      }
    }
    Promise.all(ids.map(function (id) {
      return fetchJSON(deckUrl(id)).then(
        function (d) { return { id: id, deck: d }; },
        function () { return { id: id, deck: null }; });
    })).then(function (loaded) {
      // Name exactly the decks that failed instead of discarding the batch
      // behind a generic error.
      var missing = loaded.filter(function (x) { return !x.deck; });
      if (missing.length) {
        showError('Deck not found', 'Could not load: ' +
          missing.map(function (x) { return deckUrl(x.id); }).join(', '));
        return;
      }
      var errs = [];
      loaded.forEach(function (item) {
        validateDeck(item.deck).forEach(function (msg) {
          errs.push('[' + item.id + '] ' + msg);
        });
      });
      if (errs.length) {
        showError('A deck can’t be loaded',
          'The deck files have problems that must be fixed:', errs);
        return;
      }
      decks = {};
      pool = [];
      railDeckId = null;
      loaded.forEach(function (item) {
        var d = item.deck;
        d.scale = normalizeScale(d.scale);
        decks[item.id] = d;
        if (d.scale && !railDeckId) railDeckId = item.id;
        d.cards.forEach(function (c) { c._set = item.id; pool.push(c); });
      });
      selected = ids;
      document.title = (ids.length === 1 && decks[ids[0]].title) || 'Flashcard Drill';
      buildDrillView();
      startSession();
    }).catch(function () {
      // Fetch failures are handled above; this is a last-resort guard.
      showError('Cannot start', 'Something went wrong loading the decks.');
    });
  }

  function init() {
    document.addEventListener('keydown', onKey);   // onKey no-ops until a deck starts

    var param = new URLSearchParams(window.location.search).get('deck');

    fetchJSON('decks/index.json').then(function (mani) {
      manifestIds = (mani && Array.isArray(mani.decks)) ? mani.decks : [];

      // Housekeeping: delete stores for decks no longer in the manifest.
      if (storageOK) {
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var m = /^fcd:(.+):v1$/.exec(localStorage.key(i));
            if (m && m[1] !== 'global' && m[1] !== 'selected' &&
                manifestIds.indexOf(m[1]) === -1) {
              localStorage.removeItem(m.input);
            }
          }
        } catch (e) {}
      }

      if (param) { startPool([param]); return; }   // URL pins a single set
      if (manifestIds.length === 0) {
        showError('No decks', 'The manifest decks/index.json lists no decks.');
        return;
      }
      if (manifestIds.length === 1) { startPool([manifestIds[0]]); return; }

      // Saved selection resumes without re-picking; otherwise pick sets.
      var saved = readJSON(SELECTED_KEY);
      var ids = Array.isArray(saved) ? saved.filter(function (id) {
        return manifestIds.indexOf(id) !== -1;
      }) : [];
      if (ids.length) { startPool(ids); return; }
      showSelection(null);
    }).catch(function () {
      if (param) { startPool([param]); return; }   // direct links survive a bad manifest
      showError('Cannot start',
        'Could not load the deck manifest (decks/index.json).');
    });
  }

  init();
})();
