/* COI Check guided tour engine. Plain JavaScript, no dependencies.

   HOW TO START IT
   - First visit: a welcome card offers the tour. Closing it (or the tour) points to the Tour button once.
   - Replay: click any element with [data-tour-replay], or call CoiTour.start().
   - AUTOPLAY for screen recording: open the page with ?tour=play in the address,
     or press P while the tour is open. Each step's time is "ms" in tour-steps.js.
   - Keys while open: Right/Left arrows move between steps, Esc closes, P toggles autoplay.

   The host app may expose window.coiApp = { go(view), screen() } so steps can switch views.
   All copy, targets and timings live in tour-steps.js. */
(function () {
  var C = window.TOUR_CONFIG;
  if (!C || !C.steps || !C.steps.length || window.CoiTour) return;
  var L = C.labels || {}, W = C.welcome || {}, FIN = C.finale || {};
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = rm ? 0 : 320, EASE = 'cubic-bezier(.16,1,.3,1)', PAD = 8;
  var ring, card, live, titleEl, bodyEl, countEl, dotsEl, barEl, backBtn, nextBtn, playBtn, skipBtn, finEl, finBtn;
  var welcome, hintEl, hintRing;
  var idx = -1, isOpen = false, playing = false, timer = 0, raf = 0, token = 0, last = null, moving = false, returnTo = null, target = null, finished = false;

  function app() { return window.coiApp || null; }
  function q(s) { try { return s ? document.querySelector(s) : null; } catch (e) { return null; } }
  function fmt(t, o) { return String(t || '').replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function mobile() { return window.innerWidth <= 640; }
  function esc(t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function markSeen() { try { localStorage.setItem(C.storageKey, '1'); } catch (e) {} }

  function build() {
    if (card) return;
    ring = document.createElement('div'); ring.className = 'ct-ring ct-off'; ring.setAttribute('aria-hidden', 'true');
    card = document.createElement('div'); card.className = 'ct-card ct-off ct-out';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-label', L.region || 'Tour'); card.tabIndex = -1;
    card.innerHTML =
      '<div class="ct-main"><div class="ct-top"><span class="ct-count" id="ct-count"></span><span class="ct-dots" aria-hidden="true"></span>' +
      '<button type="button" class="ct-skip" data-ct="skip"></button></div>' +
      '<h2 class="ct-title" id="ct-title"></h2><p class="ct-body" id="ct-body"></p>' +
      '<div class="ct-bar" aria-hidden="true"><span></span></div>' +
      '<div class="ct-actions"><button type="button" class="ct-play" data-ct="play" aria-pressed="false"></button>' +
      '<span class="ct-sp"></span><button type="button" class="ct-btn ct-back" data-ct="back"></button>' +
      '<button type="button" class="ct-btn ct-next" data-ct="next"></button></div></div>' +
      '<div class="ct-fin" hidden><span class="ct-check" aria-hidden="true"><svg viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="21" fill="none" stroke="#46632F" stroke-width="3" pathLength="100" class="ct-c1"/><path d="M15 24.5l6.5 6.5L33.5 18" fill="none" stroke="#46632F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" pathLength="100" class="ct-c2"/></svg></span>' +
      '<h2 class="ct-title ct-fin-title" id="ct-fin-title">' + esc(FIN.title) + '</h2><p class="ct-body">' + esc(FIN.body) + '</p>' +
      '</div>';
    live = document.createElement('div'); live.className = 'ct-live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    document.body.appendChild(ring); document.body.appendChild(card); document.body.appendChild(live);
    titleEl = card.querySelector('#ct-title'); bodyEl = card.querySelector('#ct-body'); countEl = card.querySelector('#ct-count');
    dotsEl = card.querySelector('.ct-dots'); barEl = card.querySelector('.ct-bar'); backBtn = card.querySelector('[data-ct="back"]');
    nextBtn = card.querySelector('[data-ct="next"]'); playBtn = card.querySelector('[data-ct="play"]'); skipBtn = card.querySelector('[data-ct="skip"]');
    finEl = card.querySelector('.ct-fin');
    card.setAttribute('aria-labelledby', 'ct-title'); card.setAttribute('aria-describedby', 'ct-body');
    skipBtn.textContent = L.skip || 'Skip'; backBtn.textContent = L.back || 'Back';
    dotsEl.innerHTML = C.steps.map(function () { return '<i></i>'; }).join('');
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ct]'); if (!b) return;
      var a = b.getAttribute('data-ct');
      if (a === 'next') next(); else if (a === 'back') go(idx - 1); else if (a === 'skip') close(); else if (a === 'play') setPlay(!playing);
      else if (a === 'finish') { var ap = app(); if (FIN.view && ap) ap.go(FIN.view); close(true); }
    });
  }

  function setPlay(on) {
    playing = on;
    playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    playBtn.innerHTML = (on
      ? '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1.5" width="2.6" height="9" rx=".6" fill="currentColor"/><rect x="7.4" y="1.5" width="2.6" height="9" rx=".6" fill="currentColor"/></svg>'
      : '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.6v8.8L10.2 6z" fill="currentColor"/></svg>') + (on ? (L.pause || 'Pause') : (L.play || 'Autoplay'));
    barEl.style.visibility = on ? 'visible' : 'hidden';
    clearTimeout(timer);
    if (on && isOpen && !moving && !finished) schedule();
  }

  function schedule() {
    var s = C.steps[idx], ms = s.ms || C.defaultMs || 7000, sp = barEl.firstChild;
    sp.style.transition = 'none'; sp.style.transform = 'scaleX(0)'; void sp.offsetWidth;
    sp.style.transition = 'transform ' + ms + 'ms linear'; sp.style.transform = 'scaleX(1)';
    clearTimeout(timer);
    timer = setTimeout(next, ms);
  }

  function next() { if (idx >= C.steps.length - 1) finale(); else go(idx + 1); }

  function waitFor(sel, delay, limit, cb) {
    if (!sel) { setTimeout(function () { cb(null); }, delay); return; }
    var t0 = 0;
    setTimeout(function poll() {
      var el = q(sel), r = el && el.getBoundingClientRect();
      if (el && r.width > 0 && r.height > 0) { cb(el); return; }
      if ((t0 += 50) > limit) { cb(null); return; }
      setTimeout(poll, 50);
    }, delay);
  }

  function scrollToTarget(el, cb) {
    if (!el) { cb(); return; }
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var ox = getComputedStyle(p).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) {
        var pr = p.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (er.left < pr.left || er.right > pr.right) p.scrollLeft += er.left - pr.left - Math.max(0, (pr.width - er.width) / 2);
      }
    }
    var r = el.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth, top = 84;
    var cw = card.offsetWidth, ch = card.offsetHeight;
    var sideFits = r.right + PAD + 16 + cw <= vw - 16 || r.left - PAD - 16 - cw >= 16;
    if (!mobile() && !sideFits && r.height + ch + PAD * 2 + 32 <= vh - top) {
      if (Math.abs(r.top - PAD - top) > 4) { window.scrollTo({ top: Math.max(0, window.scrollY + r.top - top - PAD), behavior: rm ? 'auto' : 'smooth' }); setTimeout(cb, rm ? 30 : 460); } else cb();
      return;
    }
    var bottom = mobile() ? vh - ch - 24 : vh - 24, room = bottom - top;
    if (r.top >= top && (r.bottom <= bottom || r.height > room && r.top <= top + 40)) { cb(); return; }
    var y = window.scrollY + r.top - (r.height < room ? top + (room - r.height) / 2 : top);
    window.scrollTo({ top: Math.max(0, y), behavior: rm ? 'auto' : 'smooth' });
    setTimeout(cb, rm ? 30 : 460);
  }

  function boxFor(el) {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (!el) { var cr = card.getBoundingClientRect(); return { x: cr.left, y: cr.top, w: cr.width, h: cr.height }; }
    var r = el.getBoundingClientRect();
    var x = Math.max(6, r.left - PAD), y = Math.max(6, r.top - PAD);
    var x2 = Math.min(vw - 6, r.right + PAD), y2 = Math.min(vh - 6, r.bottom + PAD);
    return { x: x, y: y, w: Math.max(24, x2 - x), h: Math.max(24, y2 - y) };
  }

  function setRing(b) {
    ring.style.transition = 'opacity 220ms ' + EASE;
    ring.style.width = b.w + 'px'; ring.style.height = b.h + 'px';
    ring.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
  }

  function moveRing(b, animate) {
    if (!last || !animate || !D) { setRing(b); last = b; return; }
    var a = last; last = b;
    ring.style.transition = 'none';
    ring.style.width = b.w + 'px'; ring.style.height = b.h + 'px';
    ring.style.transform = 'translate(' + a.x + 'px,' + a.y + 'px) scale(' + (a.w / b.w) + ',' + (a.h / b.h) + ')';
    void ring.offsetWidth;
    ring.style.transition = 'transform ' + D + 'ms ' + EASE + ',opacity 220ms ' + EASE;
    ring.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
  }

  function resetCardStyle() { card.style.left = ''; card.style.right = ''; card.style.bottom = ''; card.style.top = ''; card.style.width = ''; }

  function placeCard(b, centred, animate) {
    var vw = window.innerWidth, vh = window.innerHeight, m = 16;
    resetCardStyle();
    if (mobile()) { card.classList.add('ct-docked'); return; }
    card.classList.remove('ct-docked');
    var cw = card.offsetWidth, ch = card.offsetHeight, x, y;
    if (centred) { x = (vw - cw) / 2; y = Math.max(m, (vh - ch) / 2); }
    else if (b.x + b.w + m + cw <= vw - m) { x = b.x + b.w + m; y = Math.min(Math.max(b.y, 80), vh - ch - m); }
    else if (b.x - m - cw >= m) { x = b.x - m - cw; y = Math.min(Math.max(b.y, 80), vh - ch - m); }
    else if (b.y + b.h + m + ch <= vh - m) { y = b.y + b.h + m; x = Math.min(Math.max(b.x, m), vw - cw - m); }
    else if (b.y - m - ch >= 76) { y = b.y - m - ch; x = Math.min(Math.max(b.x, m), vw - cw - m); }
    else {
      x = vw - cw - 28; y = vh - ch - 28;
      if (x < b.x + b.w && x + cw > b.x && y < b.y + b.h && y + ch > b.y) {
        var below = b.y + b.h + m;
        if (vh - below - m >= ch) { y = below; x = Math.min(Math.max(b.x, m), vw - cw - m); }
        else if (b.y - m - ch >= 76) { y = b.y - m - ch; x = Math.min(Math.max(b.x, m), vw - cw - m); }
        else { card.classList.add('ct-docked'); card.style.left = 'auto'; card.style.right = '16px'; card.style.bottom = '16px'; card.style.top = 'auto'; card.style.width = 'min(372px,calc(100vw - 32px))'; return; }
      }
    }
    y = Math.max(m, Math.min(y, vh - ch - m));
    card.style.transition = animate && D ? '' : 'none';
    card.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    if (!animate || !D) { void card.offsetWidth; card.style.transition = ''; }
  }

  function fill(s, n) {
    var total = C.steps.length;
    titleEl.textContent = s.title; bodyEl.textContent = s.body;
    countEl.textContent = fmt(L.count || '{n} of {total}', { n: n + 1, total: total });
    Array.prototype.forEach.call(dotsEl.children, function (d, i) { d.className = i < n ? 'done' : i === n ? 'on' : ''; });
    backBtn.disabled = n === 0;
    nextBtn.textContent = n === total - 1 ? (L.done || 'Finish') : (L.next || 'Next');
  }

  function showMain(on) {
    card.querySelector('.ct-main').hidden = !on; finEl.hidden = on;
    card.classList.toggle('ct-final', !on);
    card.setAttribute('aria-labelledby', on ? 'ct-title' : 'ct-fin-title');
  }

  function go(n) {
    if (!isOpen || n < 0 || n >= C.steps.length) return;
    var t = ++token, s = C.steps[n], a = app(), first = idx < 0;
    idx = n; moving = true; finished = false; clearTimeout(timer);
    var needNav = !!(s.view && a && a.screen && a.screen() !== s.view);
    if (needNav) a.go(s.view);
    card.classList.add('ct-out');
    showMain(true); fill(s, n);
    waitFor(s.target, needNav ? (D ? 380 : 60) : (first ? 0 : 160), 2500, function (el) {
      if (t !== token) return;
      target = el;
      if (!s.target || !el) placeCard(null, true, false);
      scrollToTarget(el, function () {
        if (t !== token) return;
        var b = boxFor(el);
        ring.classList.remove('ct-dim');
        moveRing(b, !first);
        placeCard(b, !el, !first);
        card.classList.remove('ct-out');
        live.textContent = countEl.textContent + '. ' + s.title + '. ' + s.body;
        setTimeout(function () { if (t !== token) return; moving = false; if (playing) schedule(); }, D);
      });
    });
  }

  function burst(cx, cy) {
    if (rm || !document.body.animate) return;
    var colors = ['#46632F', '#9DB386', '#C79A3E', '#B5770F', '#2E6A3E', '#E3ECD9'];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('span'), sz = 5 + Math.random() * 6, sq = i % 3 === 0;
      p.className = 'ct-spark';
      p.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;width:' + sz + 'px;height:' + (sq ? sz * .55 : sz) + 'px;background:' + colors[i % colors.length] + ';border-radius:' + (sq ? '1.5px' : '50%');
      document.body.appendChild(p);
      var ang = (i / 26) * Math.PI * 2 + Math.random() * .4, dist = 110 + Math.random() * 120;
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * .75 - 40, rot = (Math.random() * 2 - 1) * 260;
      var an = p.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: 'translate(-50%,-50%) translate(' + dx * .55 + 'px,' + dy * .55 + 'px) rotate(' + rot * .5 + 'deg) scale(1)', opacity: 1, offset: .35 },
        { transform: 'translate(-50%,-50%) translate(' + dx + 'px,' + (dy + 70) + 'px) rotate(' + rot + 'deg) scale(.7)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 400, delay: 120 + Math.random() * 80, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
      an.onfinish = (function (el) { return function () { el.remove(); }; })(p);
    }
  }

  function ripple() {
    var c = card.querySelector('.ct-check'); if (!c || rm) return;
    var r = c.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    [0, 1, 2].forEach(function (k) {
      var o = document.createElement('span'); o.className = 'ct-orbit';
      o.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px';
      document.body.appendChild(o);
      var an = o.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: .55 }, { transform: 'translate(-50%,-50%) scale(' + (3.2 + k * 1.4) + ')', opacity: 0 }],
        { duration: 1100 + k * 180, delay: k * 140, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
      var gone = false, rmv = function () { if (gone) return; gone = true; o.remove(); };
      an.onfinish = rmv; setTimeout(rmv, 1100 + k * 180 + k * 140 + 120);
    });
  }

  function dismissIntoReplay() {
    var rb = q('[data-tour-replay]');
    if (!rb || rm || !card.animate) { close(true); showHint(); return; }
    var cr = card.getBoundingClientRect(), tr = rb.getBoundingClientRect();
    var dx = tr.left + tr.width / 2 - (cr.left + cr.width / 2), dy = tr.top + tr.height / 2 - (cr.top + cr.height / 2);
    var base = card.style.transform || 'none';
    ring.classList.add('ct-dim');
    var an = card.animate([{ transform: base, opacity: 1 }, { transform: base + ' translate(' + dx + 'px,' + dy + 'px) scale(.08)', opacity: 0 }],
      { duration: 560, easing: 'cubic-bezier(.55,0,.3,1)', fill: 'forwards' });
    var done = false, end = function () { if (done) return; done = true; close(true); try { an.cancel(); } catch (e) {} showHint(); };
    an.onfinish = end; setTimeout(end, 640);
  }

  function finale() {
    if (!isOpen || finished) return;
    token++; finished = true; moving = true; clearTimeout(timer);
    var t = token;
    card.classList.add('ct-out');
    setTimeout(function () {
      if (t !== token) return;
      showMain(false);
      target = null;
      placeCard(null, true, false);
      var b = boxFor(null);
      moveRing(b, true);
      card.classList.remove('ct-out');
      finEl.classList.remove('ct-play-in'); void finEl.offsetWidth; finEl.classList.add('ct-play-in');
      setTimeout(function () { if (t === token) ripple(); }, rm ? 0 : 380);
      live.textContent = (FIN.title || '') + '. ' + (FIN.body || '');
      card.focus({ preventScroll: true });
      setTimeout(function () { if (t === token) moving = false; }, D);
      timer = setTimeout(function () { if (t === token) dismissIntoReplay(); }, rm ? 1600 : 2300);
    }, D ? 200 : 0);
  }

  function track() {
    raf = requestAnimationFrame(track);
    if (!isOpen || moving) return;
    if (target && !document.contains(target)) { ring.classList.add('ct-dim'); return; }
    var b = boxFor(target);
    if (!last || Math.abs(b.x - last.x) > .5 || Math.abs(b.y - last.y) > .5 || Math.abs(b.w - last.w) > .5 || Math.abs(b.h - last.h) > .5) {
      last = b; setRing(b); if (target) placeCard(b, false, false);
    }
  }

  function start(opts) {
    build(); hideWelcome(true); hideHint();
    if (isOpen) return;
    opts = opts || {};
    returnTo = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    isOpen = true; idx = -1; last = null; target = null; finished = false;
    ring.classList.remove('ct-off'); card.classList.remove('ct-off');
    setPlay(!!opts.autoplay);
    go(0);
    setTimeout(function () { card.focus({ preventScroll: true }); }, D ? 60 : 0);
    cancelAnimationFrame(raf); track();
  }

  function close(completed) {
    if (!isOpen) return;
    isOpen = false; token++; clearTimeout(timer); cancelAnimationFrame(raf);
    markSeen();
    ring.classList.add('ct-dim'); card.classList.add('ct-out');
    setTimeout(function () { if (!isOpen) { ring.classList.add('ct-off'); card.classList.add('ct-off'); ring.classList.remove('ct-dim'); showMain(true); } }, D ? 240 : 0);
    live.textContent = L.closed || '';
    var rb = q('[data-tour-replay]');
    var back = completed === true ? null : (returnTo && document.contains(returnTo) ? returnTo : rb);
    if (back && back.focus) back.focus({ preventScroll: true });
    if (completed !== true) setTimeout(showHint, D ? 380 : 0);
  }

  /* Welcome card: first visit only. */
  function showWelcome() {
    if (welcome) return;
    var rows = (W.demo || []).map(function (r, i) {
      return '<li class="ct-w-row" style="--i:' + i + '" data-tone="' + esc(r.tone) + '"><span class="ct-w-co">' + esc(r.name) + '</span>' +
        '<span class="ct-w-st"><span class="ct-w-from">' + esc(r.from) + '</span><span class="ct-w-to"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.3l2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' + esc(r.to) + '</span></span></li>';
    }).join('');
    welcome = document.createElement('div'); welcome.className = 'ct-welcome';
    welcome.innerHTML = '<div class="ct-veil" data-w="later"><span class="ct-orb ct-orb-a"></span><span class="ct-orb ct-orb-b"></span><span class="ct-orb ct-orb-c"></span></div>' +
      '<div class="ct-wcard" role="dialog" aria-modal="true" aria-labelledby="ct-w-title"><span class="ct-w-glow" aria-hidden="true"></span>' +
      '<div class="ct-w-hero" aria-hidden="true"><div class="ct-w-hero-top">' +
      '<span class="ct-w-live"><i></i>' + esc(W.demoLabel) + '</span></div><ul class="ct-w-rows">' + rows + '</ul></div>' +
      '<div class="ct-w-copy"><div class="ct-w-eyebrow">' + esc(W.eyebrow) + '</div><h2 class="ct-w-title" id="ct-w-title">' + esc(W.title) + '</h2>' +
      '<div class="ct-w-actions"><button type="button" class="ct-btn ct-next ct-w-go" data-w="start"><span>' + esc(W.start) + '</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button type="button" class="ct-btn ct-ghost" data-w="later">' + esc(W.later) + '</button></div></div></div>';
    document.body.appendChild(welcome);
    var cardEl = welcome.querySelector('.ct-wcard');
    void welcome.offsetWidth; welcome.classList.add('ct-in');
    if (!rm && window.matchMedia && matchMedia('(pointer: fine)').matches) {
      var tx = 0, ty = 0, cx = 0, cy = 0, wr = 0;
      var loop = function () {
        if (!welcome) return;
        cx += (tx - cx) * .08; cy += (ty - cy) * .08;
        cardEl.style.setProperty('--rx', (cy * -2.2).toFixed(3) + 'deg');
        cardEl.style.setProperty('--ry', (cx * 2.8).toFixed(3) + 'deg');
        cardEl.style.setProperty('--gx', (50 + cx * 38).toFixed(1) + '%');
        cardEl.style.setProperty('--gy', (30 + cy * 30).toFixed(1) + '%');
        welcome.style.setProperty('--px', (cx * 14).toFixed(1) + 'px');
        welcome.style.setProperty('--py', (cy * 10).toFixed(1) + 'px');
        wr = requestAnimationFrame(loop);
      };
      welcome.addEventListener('pointermove', function (ev) { tx = ev.clientX / window.innerWidth * 2 - 1; ty = ev.clientY / window.innerHeight * 2 - 1; });
      welcome.addEventListener('pointerleave', function () { tx = ty = 0; });
      loop();
    }
    var flips = welcome.querySelectorAll('.ct-w-row');
    Array.prototype.forEach.call(flips, function (r, i) { setTimeout(function () { if (r.isConnected) r.classList.add('ct-done'); }, rm ? 0 : 1000 + i * 520); });
    welcome.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-w]'); if (!b) return;
      if (b.getAttribute('data-w') === 'start') start(); else { hideWelcome(); markSeen(); setTimeout(showHint, D ? 260 : 0); }
    });
    setTimeout(function () { var st = welcome && welcome.querySelector('[data-w="start"]'); if (st) st.focus({ preventScroll: true }); }, 60);
  }
  function hideWelcome(instant) {
    if (!welcome) return;
    var w = welcome; welcome = null; w.classList.remove('ct-in'); w.classList.add('ct-leaving');
    setTimeout(function () { w.remove(); }, instant || !D ? 0 : 320);
  }

  /* One-time pointer to the replay button after a close. */
  function showHint() {
    var rb = q('[data-tour-replay]'); if (!rb) return;
    hideHint();
    var r = rb.getBoundingClientRect();
    hintRing = document.createElement('span'); hintRing.className = 'ct-hint-ring'; hintRing.setAttribute('aria-hidden', 'true');
    hintRing.style.cssText = 'left:' + (r.left - 3) + 'px;top:' + (r.top - 3) + 'px;width:' + (r.width + 6) + 'px;height:' + (r.height + 6) + 'px';
    document.body.appendChild(hintRing);
    void hintRing.offsetWidth; hintRing.classList.add('ct-in');
    if (live) live.textContent = C.hint || '';
    hideHint.t = setTimeout(hideHint, 3400);
    document.addEventListener('pointerdown', hideHint, { once: true });
  }
  function hideHint() {
    clearTimeout(hideHint.t);
    [hintRing].forEach(function (el) { if (!el) return; el.classList.remove('ct-in'); setTimeout(function () { el.remove(); }, 260); });
    hintRing = null;
  }

  window.addEventListener('keydown', function (e) {
    if (welcome && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideWelcome(); markSeen(); setTimeout(showHint, D ? 260 : 0); return; }
    if (!isOpen) return;
    var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    var hit = true;
    if (e.key === 'Escape') close();
    else if (typing || finished) hit = false;
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') go(idx - 1);
    else if (e.key === 'p' || e.key === 'P') setPlay(!playing);
    else hit = false;
    if (hit) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
  }, true);

  window.addEventListener('resize', function () { if (isOpen && !moving) last = null; if (hintRing) hideHint(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-tour-replay]');
    if (b && !b.hasAttribute('data-tour-managed')) start();
  });

  window.CoiTour = { start: start, close: close, autoplay: function () { start({ autoplay: true }); }, isOpen: function () { return isOpen; }, welcome: showWelcome };

  function boot() {
    var tries = 0, flag = new URLSearchParams(location.search).get('tour');
    (function wait() {
      if (!app() && tries++ < 100) { setTimeout(wait, 50); return; }
      var seen = false; try { seen = localStorage.getItem(C.storageKey) === '1'; } catch (e) {}
      if (flag === 'play') setTimeout(function () { start({ autoplay: true }); }, 600);
      else if (flag === 'start') setTimeout(start, 600);
      else if (!seen || flag === 'welcome') setTimeout(showWelcome, 700);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
