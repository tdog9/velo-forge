// TurboPrep — Polish layer (v1.0.0)
// ----------------------------------------------------------------------------
// Side-effect module: imported once from app.js. Adds haptic feedback,
// offline indicator, confirm-leave guard for in-flight stints, idle-time
// prefetches, image lazy-load wiring, and a few perceived-perf wins.
//
// Everything here is defensive — every hook checks the existence of the
// underlying API and silently no-ops if it's missing, so this layer can
// never crash the host page.

(() => {
  if (window.__tpPolishLoaded) return;
  window.__tpPolishLoaded = true;

  // ── 1. Haptic feedback bridge ──────────────────────────────────────
  // Web Vibration API on Android web; Capacitor's Haptics plugin if
  // available; no-op on iOS web (Apple doesn't expose vibrate() in
  // WKWebView). We surface it via a single `tpHaptic(kind)` helper.
  function tpHaptic(kind = 'light') {
    try {
      // Capacitor plugin path (preferred when wrapping native)
      const Haptics = window.Capacitor?.Plugins?.Haptics;
      if (Haptics?.impact) {
        const style = ({ light: 'Light', medium: 'Medium', heavy: 'Heavy' })[kind] || 'Light';
        Haptics.impact({ style });
        return;
      }
      // Native bridge fallback — passes the kind to Swift which can map
      // to UIImpactFeedbackGenerator.
      const tpNative = window.webkit?.messageHandlers?.tpNative;
      if (tpNative) {
        tpNative.postMessage({ type: 'haptic', kind });
        return;
      }
      // Web fallback
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(({ light: 6, medium: 14, heavy: 28, success: [10, 30, 10] })[kind] || 6);
      }
    } catch (_) {}
  }
  window.tpHaptic = tpHaptic;


  // ── 2. Tab-switch haptic + smooth-scroll-to-top ────────────────────
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest?.('.tab-btn');
    if (!tabBtn) return;
    tpHaptic('light');
    // Scroll the actual scrolling container to top. .page is often
    // display:flex without overflow, so scrolling it does nothing.
    // Walk up looking for the nearest scrollable ancestor instead.
    try {
      const find = (n) => {
        while (n && n !== document.body) {
          const cs = getComputedStyle(n);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight) return n;
          n = n.parentElement;
        }
        return null;
      };
      const target = find(document.querySelector('.page.active')) || document.getElementById('content') || document.scrollingElement;
      if (target?.scrollTo) target.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(_) {}
  }, { passive: true });


  // ── 3. Long-press feedback on primary CTAs (medium haptic) ─────────
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.btn-primary, button.primary, [data-haptic]');
    if (!btn) return;
    const kind = btn.dataset?.haptic || 'medium';
    tpHaptic(kind);
  }, { passive: true });


  // ── 4. Offline / online indicator ──────────────────────────────────
  let _offlineBanner = null;
  function ensureOfflineBanner() {
    if (_offlineBanner) return _offlineBanner;
    const el = document.createElement('div');
    el.className = 'tp-offline-banner';
    el.id = 'tp-offline-banner';
    el.innerHTML = '<span class="dot"></span><span>You\'re offline — changes will sync when you reconnect</span>';
    document.body.appendChild(el);
    _offlineBanner = el;
    return el;
  }
  function syncOnlineState() {
    const banner = ensureOfflineBanner();
    if (navigator.onLine) {
      banner.classList.remove('show');
    } else {
      banner.classList.add('show');
      tpHaptic('medium');
    }
  }
  window.addEventListener('online', syncOnlineState);
  window.addEventListener('offline', syncOnlineState);
  // Initial sync after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncOnlineState, { once: true });
  } else {
    setTimeout(syncOnlineState, 200);
  }


  // ── 5. Confirm-leave guard when a stint or training is in flight ──
  window.addEventListener('beforeunload', (e) => {
    const stintActive = !!window._tpRaceDayStintActive;
    const trainingActive = !!window._tpTrainingActive;
    if (!stintActive && !trainingActive) return;
    // Native shell may not show this; web browsers will.
    e.preventDefault();
    e.returnValue = 'You have a session in progress — sure you want to leave?';
    return e.returnValue;
  });


  // ── 6. Idle-time prefetch of secondary modules ─────────────────────
  // Browsers schedule these when the main thread is idle so the first
  // tap on Coach / Plans / Tracker etc. is instant.
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
  idle(() => {
    const links = [
      '/admin.js', '/aifeatures.js', '/teamchat.js',
      '/raceLog.js', '/healthcheck.js', '/tracker.js',
    ];
    links.forEach(href => {
      try {
        const l = document.createElement('link');
        l.rel = 'modulepreload';
        l.href = href;
        document.head.appendChild(l);
      } catch(_) {}
    });
  });


  // ── 7. Image lazy-load wiring ──────────────────────────────────────
  // Mark images that have a known intrinsic size with loading=lazy.
  // Safe on every modern browser; falls back to eager load.
  idle(() => {
    try {
      document.querySelectorAll('img:not([loading])').forEach(img => {
        img.loading = 'lazy';
        img.decoding = 'async';
      });
    } catch(_) {}
  });


  // ── 8. Visibility-aware tick management ─────────────────────────────
  // When the tab is hidden, pause expensive UI ticks (centre bar etc).
  // When visible again, kick a refresh so state catches up.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      try { window.CentreBar?.refresh?.(); } catch(_) {}
      try { window.pushWatchState?.(); } catch(_) {}
    }
  });


  // ── 9. Streak chip painter ────────────────────────────────────────
  // Reads userWorkouts (set on the global by app.js) and counts the
  // current consecutive-day streak. Attaches a 🔥 chip to a header slot
  // with id="tp-streak-slot" if one exists.
  function paintStreak() {
    try {
      const slot = document.getElementById('tp-streak-slot');
      if (!slot) return;
      const wos = (window.userWorkouts || []).slice();
      if (!wos.length) { slot.innerHTML = ''; return; }
      const days = new Set();
      wos.forEach(w => {
        const d = w.date?.toDate ? w.date.toDate() : new Date(w.date);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
          days.add(key);
        }
      });
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 90; i++) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
        if (days.has(key)) streak++;
        else if (i > 0) break;       // gap → streak ends
        // Allow today to be empty without breaking — counts from yesterday.
      }
      slot.innerHTML = streak >= 1
        ? `<span class="tp-streak" aria-label="${streak}-day training streak">${streak}d streak</span>`
        : '';
    } catch(_) {}
  }
  window.tpPaintStreak = paintStreak;
  // Re-paint when userWorkouts changes — app.js can call window.tpPaintStreak().
  // Also fire on a low-rate interval as a fallback.
  setInterval(paintStreak, 60_000);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintStreak, { once: true });
  } else {
    setTimeout(paintStreak, 800);
  }


  // ── 10. Pull-to-refresh haptic on completion ──────────────────────
  // The native UIRefreshControl will fire its callback; we hook the
  // refresh-finished event the web exposes via `window.tpOnRefreshed`.
  let _lastRefreshAt = 0;
  window.tpOnRefreshed = () => {
    const now = Date.now();
    if (now - _lastRefreshAt < 500) return;     // dedupe
    _lastRefreshAt = now;
    tpHaptic('success');
  };


  // ── 11. Skeleton helper ───────────────────────────────────────────
  // Drop-in: `tpSkeleton(container, { lines: 4 })` paints a shimmer
  // placeholder; replace .innerHTML with real content when ready.
  window.tpSkeleton = function tpSkeleton(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const lines = opts.lines || 3;
    const includeAvatar = !!opts.avatar;
    let html = '';
    if (includeAvatar) html += '<div class="tp-skel tp-skel-avatar"></div>';
    for (let i = 0; i < lines; i++) {
      html += `<div class="tp-skel ${i === 0 ? 'tp-skel-line-lg' : 'tp-skel-line'}" style="width:${100 - i*8}%"></div>`;
    }
    el.innerHTML = html;
  };


  // ── 12. Cleanup stale localStorage on boot ────────────────────────
  // Hygiene pass — any keys with a `tp_temp_` prefix older than 7 days
  // are removed. Keeps the user from accumulating cruft across versions.
  idle(() => {
    try {
      const TTL = 7 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - TTL;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('tp_temp_')) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k) || '{}');
          if (typeof v.ts === 'number' && v.ts < cutoff) localStorage.removeItem(k);
        } catch(_) {
          localStorage.removeItem(k);
        }
      }
    } catch(_) {}
  });


  // ── 13. Smooth-scroll polyfill bypass ────────────────────────────
  // Some older WKWebView builds don't smoothly animate scrollTo with
  // `behavior:'smooth'`. Force it via CSS scroll-behavior.
  try {
    document.documentElement.style.scrollBehavior = 'smooth';
  } catch(_) {}


  // ── 14. Ripple-style touch feedback for cards ────────────────────
  // Click anywhere on a card that explicitly opts in (data-ripple) and
  // we draw a soft circular highlight at the touch point. Was previously
  // mutating .style.position / .style.overflow on every card, which
  // broke sticky-positioned children + hid scrollable card content.
  // Opt-in via `data-ripple` attribute keeps the effect targeted.
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest?.('[data-ripple]');
    if (!target) return;
    // Skip if the card isn't positioned — adding ripples breaks the
    // surrounding layout. Card markup that wants ripples should set
    // position:relative + overflow:hidden in its own CSS.
    const cs = getComputedStyle(target);
    if (cs.position === 'static') return;
    if (cs.overflow !== 'hidden' && cs.overflow !== 'clip') return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.style.cssText = `position:absolute;left:${e.clientX - rect.left - 10}px;top:${e.clientY - rect.top - 10}px;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle, rgba(var(--primary-rgb,249,115,22),.22) 0%, rgba(var(--primary-rgb,249,115,22),0) 70%);pointer-events:none;transform:scale(.5);opacity:.9;transition:transform .5s ease-out, opacity .5s ease-out;z-index:1`;
    target.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(8)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 520);
  }, { passive: true });


  // ── 15. Disable double-tap zoom on buttons (iOS Safari quirk) ────
  document.addEventListener('touchend', (e) => {
    if (e.target.closest?.('button, .tab-btn, .wo-card')) {
      // Calling preventDefault is too aggressive — instead we add
      // touch-action:manipulation to all interactive elements via CSS.
    }
  }, { passive: true });


  // ── 16. First-load welcome haptic ─────────────────────────────────
  // Tiny tap on first paint to confirm the app is live. Skipped if the
  // user has visited recently to avoid annoyance.
  try {
    const lastBoot = parseInt(localStorage.getItem('tp_last_boot_at') || '0', 10);
    if (Date.now() - lastBoot > 12 * 60 * 60 * 1000) {
      // > 12h since last boot → it's a "new session", give a tap.
      setTimeout(() => tpHaptic('light'), 600);
    }
    localStorage.setItem('tp_last_boot_at', String(Date.now()));
  } catch(_) {}

})();
