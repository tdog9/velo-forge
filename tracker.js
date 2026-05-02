// TurboPrep Activity Tracker — type-aware Record screen.
//
// Each activity type controls what's displayed during a session:
//   - HPV / Ride / Run / Walk : map + HR + steps + speed + distance
//   - Treadmill                : HR + steps + distance (no map; steps→distance)
//   - Gym                      : HR + timer (setup screen first: exercise, reps OR time)
//
// HR + steps are read from `userProfile.health` (HealthKit summary pushed by
// the iPhone/Watch app). Steps shown during a session are the delta from
// the start-of-session sample; HR is the latest sample.

import { escHtml, haversine } from './state.js';

let ctx = {};
let state = 'idle';                 // 'idle' | 'tracking' | 'paused' | 'saving'
let type = 'ride';
let watchId = null;
let positions = [];
let startTime = null;
let elapsedAtPause = 0;
let interval = null;
let map = null, polyline = null, marker = null;
let wakeLock = null;
let stepsAtStart = null;            // baseline so we can show DELTA steps for the session
let gymSetup = null;                // { exercise, mode: 'reps'|'time', value }
let gymPaintedSetup = false;

// Average stride length for treadmill distance estimation.
// Mid-range adult walking/running stride; user can correct distance at save.
const STRIDE_KM = 0.0007;

function accent() {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#f97316'; }
  catch (_) { return '#f97316'; }
}

// What each type shows + how it behaves. Centralised so each render path
// can ask "do I draw a map for this type?" without scattering branches.
const TYPE_CFG = {
  hpv:       { label: 'HPV',       map: true,  hr: true, steps: true,  speed: true,  distance: true,  pace: false, gym: false },
  ride:      { label: 'Ride',      map: true,  hr: true, steps: true,  speed: true,  distance: true,  pace: false, gym: false },
  run:       { label: 'Run',       map: true,  hr: true, steps: true,  speed: true,  distance: true,  pace: false, gym: false },
  walk:      { label: 'Walk',      map: true,  hr: true, steps: true,  speed: true,  distance: true,  pace: false, gym: false },
  treadmill: { label: 'Treadmill', map: false, hr: true, steps: true,  speed: false, distance: true,  pace: false, gym: false },
  gym:       { label: 'Gym',       map: false, hr: true, steps: false, speed: false, distance: false, pace: false, gym: true  },
};

function cfg() { return TYPE_CFG[type] || TYPE_CFG.ride; }

export function initTracker(appCtx) { ctx = appCtx; }

// Type-bar SVG glyphs — replaces emoji-as-text from earlier versions.
function typeIconSvg(t) {
  switch (t) {
    case 'hpv':       return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tt-ic"><path d="M14 16l-4-7-4 7"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M14 16h4"/></svg>';
    case 'ride':      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tt-ic"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6l3 4-4 6-3-5h-3l-2-5h2"/></svg>';
    case 'run':       return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tt-ic"><circle cx="13" cy="4" r="2"/><path d="M5 22l4-7 4 2 3-5 4 2"/><path d="M9 8l4 2 3-1"/></svg>';
    case 'treadmill': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tt-ic"><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 14V8a3 3 0 016 0"/><circle cx="13" cy="5" r="2"/></svg>';
    case 'walk':      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tt-ic"><circle cx="13" cy="4" r="2"/><path d="M9 22l2-7-3-3 1-5 4 3 3 1"/><path d="M14 17l3 5"/></svg>';
    case 'gym':       return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tt-ic"><path d="M6 4v16M2 8v8M22 8v8M18 4v16M6 12h12"/></svg>';
    default:          return '';
  }
}

export function openActivityTracker() {
  state = 'idle';
  positions = [];
  elapsedAtPause = 0;
  startTime = null;
  stepsAtStart = null;
  gymSetup = null;
  gymPaintedSetup = false;

  const overlay = document.createElement('div');
  overlay.id = 'tracker-overlay';
  overlay.className = 'tracker-overlay';
  overlay.innerHTML = `
    <div class="tracker-header">
      <span class="tracker-header-title">Record Activity</span>
      <button class="tracker-close" id="tracker-close-btn" aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="tracker-type-bar" id="tracker-type-bar">
      ${Object.keys(TYPE_CFG).map(t => `
        <button class="tracker-type-btn${t === type ? ' active' : ''}" data-ttype="${t}">
          ${typeIconSvg(t)}<span>${TYPE_CFG[t].label}</span>
        </button>
      `).join('')}
    </div>
    <div id="tracker-body" class="tracker-body"></div>
    <div class="tracker-controls" id="tracker-controls"></div>`;
  document.body.appendChild(overlay);

  paintBody();
  paintControls();
  bindTypeBar();
  document.getElementById('tracker-close-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state === 'tracking' || state === 'paused') {
      if (!confirm('Discard this activity?')) return;
    }
    closeActivityTracker();
  });
}

function bindTypeBar() {
  const bar = document.getElementById('tracker-type-bar');
  if (!bar) return;
  bar.querySelectorAll('.tracker-type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state === 'tracking' || state === 'paused') {
        if (!confirm('Switching activity type discards the current session. Continue?')) return;
        // Discard then re-init.
        teardownLiveListeners();
        positions = [];
        elapsedAtPause = 0;
        startTime = null;
        stepsAtStart = null;
        gymSetup = null;
        gymPaintedSetup = false;
        state = 'idle';
      }
      bar.querySelectorAll('.tracker-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      type = btn.dataset.ttype;
      ctx.haptic?.('light');
      paintBody();
      paintControls();
    });
  });
}

// ── Body painters ─────────────────────────────────────────────────────────

function paintBody() {
  const body = document.getElementById('tracker-body');
  if (!body) return;
  const c = cfg();
  // Tear down any prior map so we don't leave a hidden Leaflet instance
  // behind when switching from a map-type to a non-map-type.
  if (map) { try { map.remove(); } catch(_) {} map = null; polyline = null; marker = null; }

  if (c.gym) {
    paintGymBody(body);
    return;
  }

  const tiles = buildStatTilesHtml(c);
  if (c.map) {
    body.innerHTML = `
      <div class="tracker-map"><div id="tracker-map-el"></div></div>
      <div class="tracker-stats">${tiles}</div>
    `;
    // Defer Leaflet init until DOM is in place so the container has a measurable size.
    setTimeout(initMap, 80);
  } else {
    // Treadmill / no-map types: stats fill the space, no map shell at all.
    body.innerHTML = `
      <div class="tracker-no-map-pad"></div>
      <div class="tracker-stats no-map">${tiles}</div>
    `;
  }
  if (state === 'tracking' || state === 'paused') refreshDisplay();
}

function buildStatTilesHtml(c) {
  // Always show duration first as the big primary tile.
  const tiles = [];
  tiles.push(tile('t-time', '00:00', 'Duration', 'big'));
  if (c.distance)  tiles.push(tile('t-dist', '0.00', 'Distance (km)'));
  if (c.speed)     tiles.push(tile('t-speed', '0.0', 'Speed (km/h)'));
  if (c.steps)     tiles.push(tile('t-steps', '0', 'Steps'));
  if (c.hr)        tiles.push(tile('t-hr', '—', 'Heart rate', '', 'hr'));
  return tiles.join('');
}

function tile(id, value, label, sizeCls = '', tone = '') {
  const cls = ['tracker-stat', sizeCls, tone ? 't-tone-' + tone : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><div class="tracker-stat-val" id="${id}">${value}</div><div class="tracker-stat-lbl">${label}</div></div>`;
}

// Gym mode: setup screen first, then big HR+Timer runtime.
function paintGymBody(body) {
  if (!gymSetup) {
    gymPaintedSetup = true;
    body.innerHTML = `
      <div class="tracker-gym-setup">
        <div class="gym-setup-card">
          <div class="gym-setup-h">What are you doing?</div>
          <input class="input gym-setup-input" id="gym-exercise" type="text" placeholder="e.g. Bench press, Squats" maxlength="60" autocomplete="off">

          <div class="gym-setup-h">Track by</div>
          <div class="gym-mode-row">
            <button class="gym-mode-btn active" data-mode="reps" type="button">Reps</button>
            <button class="gym-mode-btn" data-mode="time" type="button">Time</button>
          </div>

          <div class="gym-setup-h" id="gym-value-label">How many reps?</div>
          <input class="input gym-setup-input" id="gym-value" type="number" min="1" max="999" inputmode="numeric" placeholder="e.g. 12">

          <div class="gym-setup-hint">Heart rate and a timer are all you'll see while you lift. We'll auto-stop when the time's up (Time mode) or count up while you push reps (Reps mode).</div>
        </div>
      </div>
    `;
    bindGymSetup();
    return;
  }
  // Runtime: huge HR + huge timer, plus exercise label.
  body.innerHTML = `
    <div class="tracker-gym-runtime">
      <div class="gym-runtime-label">${escHtml(gymSetup.exercise || 'Exercise')}</div>
      <div class="gym-runtime-sub">${gymSetup.mode === 'reps' ? gymSetup.value + ' reps' : 'Target: ' + fmtSec(gymSetup.value)}</div>
      <div class="gym-runtime-row">
        <div class="gym-runtime-card">
          <div class="gym-runtime-val" id="t-hr">—</div>
          <div class="gym-runtime-lbl">Heart rate (bpm)</div>
        </div>
        <div class="gym-runtime-card primary">
          <div class="gym-runtime-val" id="t-time">${gymSetup.mode === 'time' ? fmtSec(gymSetup.value) : '00:00'}</div>
          <div class="gym-runtime-lbl">${gymSetup.mode === 'time' ? 'Remaining' : 'Elapsed'}</div>
        </div>
      </div>
    </div>
  `;
  if (state === 'tracking' || state === 'paused') refreshDisplay();
}

function bindGymSetup() {
  const modeBtns = document.querySelectorAll('.gym-mode-btn');
  let mode = 'reps';
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      mode = btn.dataset.mode;
      modeBtns.forEach(b => b.classList.toggle('active', b === btn));
      const lbl = document.getElementById('gym-value-label');
      const inp = document.getElementById('gym-value');
      if (mode === 'reps') {
        lbl.textContent = 'How many reps?';
        inp.placeholder = 'e.g. 12';
        inp.value = '';
      } else {
        lbl.textContent = 'How long (seconds)?';
        inp.placeholder = 'e.g. 60';
        inp.value = '';
      }
      ctx.haptic?.('light');
    });
  });
}

// Read setup values, validate, lock in, and re-paint runtime.
function commitGymSetup() {
  const ex = (document.getElementById('gym-exercise')?.value || '').trim();
  const modeBtn = document.querySelector('.gym-mode-btn.active');
  const mode = modeBtn ? modeBtn.dataset.mode : 'reps';
  const val = parseInt(document.getElementById('gym-value')?.value || '0', 10);
  if (!ex) { ctx.showToast?.('Tell us what you\'re doing first.', 'warn'); return false; }
  if (!val || val <= 0) { ctx.showToast?.(mode === 'reps' ? 'Enter a rep count.' : 'Enter a duration in seconds.', 'warn'); return false; }
  if (mode === 'time' && val > 60 * 60 * 4) { ctx.showToast?.('Keep gym timers under 4 hours.', 'warn'); return false; }
  if (mode === 'reps' && val > 999) { ctx.showToast?.('Keep reps under 1000.', 'warn'); return false; }
  gymSetup = { exercise: ex, mode, value: val };
  paintBody();
  return true;
}

// ── Map (only when cfg().map is true) ─────────────────────────────────────

function initMap() {
  try {
    if (typeof L === 'undefined') {
      const el = document.getElementById('tracker-map-el');
      if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted-fg);font-size:13px">Map unavailable — GPS tracking still works</div>';
      return;
    }
    const a = accent();
    map = L.map('tracker-map-el', { zoomControl: false, attributionControl: false }).setView([-37.81, 144.96], 15);
    L.tileLayer(ctx.getMapTileUrl(), { maxZoom: 19 }).addTo(map);
    polyline = L.polyline(positions.map(p => [p.lat, p.lng]), { color: a, weight: 4, opacity: 0.9 }).addTo(map);
    if (positions.length > 0) {
      const last = positions[positions.length - 1];
      marker = L.circleMarker([last.lat, last.lng], { radius: 8, fillColor: a, fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);
      map.panTo([last.lat, last.lng]);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => {
        if (!map) return;
        map.setView([p.coords.latitude, p.coords.longitude], 16);
        marker = L.circleMarker([p.coords.latitude, p.coords.longitude], { radius: 8, fillColor: a, fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);
      }, () => {}, { enableHighAccuracy: true });
    }
  } catch(e) { console.warn('Tracker map init:', e); }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

function startTracking() {
  if (state === 'tracking') return;
  // Gym requires setup to be locked-in before we start.
  if (cfg().gym && !gymSetup) {
    if (!commitGymSetup()) return;
  }
  state = 'tracking';
  startTime = Date.now() - (elapsedAtPause * 1000);
  // Snapshot steps baseline so we report DELTA steps for this session.
  stepsAtStart = currentTotalSteps();
  ctx.haptic?.('medium');
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(wl => { wakeLock = wl; }).catch(() => {}); } catch(_) {}
  if (interval) { try { clearInterval(interval); } catch(_) {} }
  interval = setInterval(refreshDisplay, 1000);
  // GPS only matters for map types. Treadmill and gym skip it entirely.
  if (cfg().map) startGps();
  paintControls();
}

function startGps() {
  try {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, speed, altitude } = pos.coords;
        positions.push({ lat: latitude, lng: longitude, time: Date.now(), speed: speed || 0, alt: altitude || 0 });
        try {
          if (map && polyline) {
            const ll = [latitude, longitude];
            polyline.addLatLng(ll);
            if (marker) marker.setLatLng(ll);
            else if (typeof L !== 'undefined') marker = L.circleMarker(ll, { radius: 8, fillColor: accent(), fillOpacity: 1, color: '#fff', weight: 2 }).addTo(map);
            map.panTo(ll);
          }
        } catch(_) {}
      },
      err => console.warn('GPS error:', err?.message || err?.code),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  } catch(e) { console.warn('GPS init:', e); }
}

function pauseTracking() {
  state = 'paused';
  elapsedAtPause = Math.floor((Date.now() - startTime) / 1000);
  if (interval) { clearInterval(interval); interval = null; }
  if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(_) {} watchId = null; }
  if (wakeLock) { try { wakeLock.release(); } catch(_) {} wakeLock = null; }
  ctx.haptic?.('light');
  paintControls();
}

function stopTracking() {
  pauseTracking();
  state = 'saving';
  ctx.haptic?.('medium');
  showSaveScreen();
}

function teardownLiveListeners() {
  if (interval) { clearInterval(interval); interval = null; }
  if (watchId !== null) { try { navigator.geolocation.clearWatch(watchId); } catch(_) {} watchId = null; }
  if (wakeLock) { try { wakeLock.release(); } catch(_) {} wakeLock = null; }
}

// ── Display refresh ───────────────────────────────────────────────────────

function refreshDisplay() {
  const c = cfg();
  const elapsedSec = state === 'tracking'
    ? Math.floor((Date.now() - startTime) / 1000)
    : elapsedAtPause;

  // Time tile / countdown
  const timeEl = document.getElementById('t-time');
  if (timeEl) {
    if (c.gym && gymSetup?.mode === 'time') {
      const remaining = Math.max(0, gymSetup.value - elapsedSec);
      timeEl.textContent = fmtSec(remaining);
      if (state === 'tracking' && remaining === 0) {
        // Time-mode auto-stop when target reached.
        try { ctx.haptic?.('heavy'); } catch(_) {}
        stopTracking();
        return;
      }
    } else {
      timeEl.textContent = fmtElapsed(elapsedSec);
    }
  }

  // Distance / speed / pace (only when relevant)
  const dist = c.distance && (c.map || c.gym === false && type === 'treadmill')
    ? (c.map ? gpsDist() : treadmillDistFromSteps())
    : 0;
  const distEl = document.getElementById('t-dist');
  if (distEl) distEl.textContent = dist.toFixed(2);

  if (c.speed) {
    const last = positions[positions.length - 1];
    const speedEl = document.getElementById('t-speed');
    if (speedEl) speedEl.textContent = (last ? Math.max(0, last.speed) * 3.6 : 0).toFixed(1);
  }

  // Steps delta
  if (c.steps) {
    const stepsEl = document.getElementById('t-steps');
    if (stepsEl) {
      const total = currentTotalSteps();
      const delta = (stepsAtStart != null && total != null) ? Math.max(0, total - stepsAtStart) : 0;
      stepsEl.textContent = delta != null ? delta.toLocaleString() : '—';
    }
  }

  // Heart rate (always read-only — comes from HealthKit summary)
  if (c.hr) {
    const hrEl = document.getElementById('t-hr');
    if (hrEl) {
      const hr = ctx.userProfile?.health?.latestHr;
      hrEl.textContent = (typeof hr === 'number' && hr > 0) ? String(hr) : '—';
    }
  }
}

function gpsDist() {
  let d = 0;
  for (let i = 1; i < positions.length; i++)
    d += haversine(positions[i-1].lat, positions[i-1].lng, positions[i].lat, positions[i].lng);
  return d;
}

function treadmillDistFromSteps() {
  if (stepsAtStart == null) return 0;
  const total = currentTotalSteps();
  if (total == null) return 0;
  return Math.max(0, (total - stepsAtStart) * STRIDE_KM);
}

function currentTotalSteps() {
  const v = ctx.userProfile?.health?.latestSteps;
  return (typeof v === 'number' && v >= 0) ? v : null;
}

function fmtElapsed(sec) {
  const s = Math.max(0, sec | 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0
    ? h + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
    : String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
}
function fmtSec(sec) { return fmtElapsed(sec); }

// ── Controls (Start / Pause / Stop / Save) ───────────────────────────────

function paintControls() {
  const el = document.getElementById('tracker-controls');
  if (!el) return;
  if (state === 'idle') {
    // For Gym, the start button reads the setup form when clicked.
    el.innerHTML = `<button class="tracker-btn start" id="t-start-btn" aria-label="Start"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21"/></svg></button>`;
    document.getElementById('t-start-btn')?.addEventListener('click', (e) => { e.stopPropagation(); startTracking(); });
  } else if (state === 'tracking') {
    el.innerHTML = `
      <button class="tracker-btn discard" id="t-discard-btn" aria-label="Discard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <button class="tracker-btn pause" id="t-pause-btn" aria-label="Pause"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg></button>
      <button class="tracker-btn stop" id="t-stop-btn" aria-label="Stop"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
    `;
    document.getElementById('t-pause-btn')?.addEventListener('click', (e) => { e.stopPropagation(); pauseTracking(); });
    document.getElementById('t-stop-btn')?.addEventListener('click', (e) => { e.stopPropagation(); stopTracking(); });
    document.getElementById('t-discard-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Discard?')) closeActivityTracker(); });
  } else if (state === 'paused') {
    el.innerHTML = `
      <button class="tracker-btn discard" id="t-discard-btn" aria-label="Discard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <button class="tracker-btn resume" id="t-resume-btn" aria-label="Resume"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21"/></svg></button>
      <button class="tracker-btn stop" id="t-stop-btn" aria-label="Stop"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
    `;
    document.getElementById('t-resume-btn')?.addEventListener('click', (e) => { e.stopPropagation(); startTracking(); });
    document.getElementById('t-stop-btn')?.addEventListener('click', (e) => { e.stopPropagation(); stopTracking(); });
    document.getElementById('t-discard-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Discard?')) closeActivityTracker(); });
  }
}

// ── Save ──────────────────────────────────────────────────────────────────

function showSaveScreen() {
  const overlay = document.getElementById('tracker-overlay');
  if (!overlay) return;
  const c = cfg();
  const elapsedSec = elapsedAtPause;
  const mins = Math.max(1, Math.round(elapsedSec / 60));
  let dist = 0;
  if (c.distance) dist = c.map ? gpsDist() : treadmillDistFromSteps();
  const avgSpeed = (dist > 0 && elapsedSec > 0) ? (dist / (elapsedSec / 3600)) : 0;
  const stepsDelta = (stepsAtStart != null && currentTotalSteps() != null)
    ? Math.max(0, currentTotalSteps() - stepsAtStart)
    : null;

  // Build summary tiles per type so the save screen mirrors what was shown
  // during the session (no random columns the user never saw).
  const tiles = [];
  tiles.push(saveStat(fmtElapsed(elapsedSec), 'Duration'));
  if (c.distance) tiles.push(saveStat(dist.toFixed(2) + ' km', 'Distance'));
  if (c.speed)    tiles.push(saveStat(avgSpeed.toFixed(1) + ' km/h', 'Avg speed'));
  if (c.steps && stepsDelta != null) tiles.push(saveStat(stepsDelta.toLocaleString(), 'Steps'));
  const lastHr = ctx.userProfile?.health?.latestHr;
  if (c.hr && typeof lastHr === 'number' && lastHr > 0) tiles.push(saveStat(String(lastHr) + ' bpm', 'Heart rate'));
  if (c.gym && gymSetup) {
    tiles.push(saveStat(escHtml(gymSetup.exercise), 'Exercise'));
    tiles.push(saveStat(gymSetup.mode === 'reps' ? gymSetup.value + ' reps' : fmtSec(gymSetup.value), gymSetup.mode === 'reps' ? 'Target reps' : 'Target time'));
  }

  const saveDiv = document.createElement('div');
  saveDiv.className = 'tracker-save-overlay';
  saveDiv.innerHTML = `<div class="tracker-save-card">
    <h3>Save Activity</h3>
    <div class="tracker-save-type">${typeIconSvg(type)}<span>${escHtml(c.label)}</span></div>
    <div class="tracker-save-stats">${tiles.join('')}</div>
    <input class="input" id="t-save-name" type="text" placeholder="Activity name (optional)" style="margin-bottom:8px;width:100%">
    <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center">
      <span style="font-size:12px;color:var(--muted-fg)">RPE:</span>
      <div style="display:flex;gap:3px;flex-wrap:wrap">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="t-rpe-btn" data-rpe="${n}" type="button">${n}</button>`).join('')}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="t-save-discard" class="btn" style="flex:1;background:var(--surface-alt);color:var(--muted-fg)">Discard</button>
      <button id="t-save-btn" class="btn btn-primary" style="flex:1">Save Activity</button>
    </div>
  </div>`;
  overlay.appendChild(saveDiv);

  let selectedRpe = null;
  saveDiv.querySelectorAll('.t-rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveDiv.querySelectorAll('.t-rpe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRpe = parseInt(btn.dataset.rpe);
    });
  });

  document.getElementById('t-save-discard')?.addEventListener('click', () => closeActivityTracker());
  document.getElementById('t-save-btn')?.addEventListener('click', async () => {
    const defaultName = c.gym && gymSetup
      ? gymSetup.exercise
      : { hpv: 'HPV Session', ride: 'Ride', run: 'Run', walk: 'Walk', treadmill: 'Treadmill', gym: 'Gym Session' }[type] || 'Workout';
    const name = (document.getElementById('t-save-name')?.value || '').trim() || defaultName;
    const path = c.map
      ? positions.filter((_, i) => i % 3 === 0 || i === positions.length - 1).map(p => [parseFloat(p.lat.toFixed(5)), parseFloat(p.lng.toFixed(5))])
      : [];
    const workoutId = 'trk-' + Date.now();
    const workout = {
      name,
      duration: mins,
      date: new Date(),
      type,
      distance: c.distance ? parseFloat(dist.toFixed(2)) : null,
      avgSpeed: c.speed && avgSpeed > 0 ? parseFloat(avgSpeed.toFixed(1)) : null,
      steps: stepsDelta,
      heartRate: (typeof lastHr === 'number' && lastHr > 0) ? lastHr : null,
      rpe: selectedRpe,
      gpsPoints: c.map ? positions.length : 0,
      source: 'tracker',
    };
    if (c.gym && gymSetup) {
      workout.gym = { exercise: gymSetup.exercise, mode: gymSetup.mode, value: gymSetup.value };
    }
    if (path.length > 1) {
      try {
        const r = JSON.parse(localStorage.getItem('vf_routes') || '{}');
        r[workoutId] = path;
        const k = Object.keys(r);
        if (k.length > 50) delete r[k[0]];
        localStorage.setItem('vf_routes', JSON.stringify(r));
      } catch(_) {}
    }
    if (ctx.saveTrackedActivity) await ctx.saveTrackedActivity(workout, workoutId);
    closeActivityTracker();
    if (ctx.onActivitySaved) ctx.onActivitySaved();
  });
}

function saveStat(val, lbl) {
  return `<div class="tracker-save-stat"><div class="val">${val}</div><div class="lbl">${lbl}</div></div>`;
}

// Hook called by app.js' Gym setup screen "Start" — it just delegates here.
// We keep the public Start button on tracker-controls so the UX is uniform.
// commitGymSetup is invoked from startTracking when type is 'gym'.

export function closeActivityTracker() {
  teardownLiveListeners();
  if (map) { try { map.remove(); } catch(_) {} map = null; }
  polyline = null; marker = null; state = 'idle';
  positions = []; stepsAtStart = null; gymSetup = null;
  const overlay = document.getElementById('tracker-overlay');
  if (overlay) overlay.remove();
}

// ── Activity detail ───────────────────────────────────────────────────────

export function openActivityDetail(workoutIdx) {
  const w = ctx.getWorkouts()[workoutIdx];
  if (!w) return;
  let routes = {};
  try { routes = JSON.parse(localStorage.getItem('vf_routes') || '{}'); } catch(_) {}
  const routeId = w.routeId || (w.stravaId ? 'strava-' + w.stravaId : w._id);
  const route = routes[routeId];
  const hasRoute = route && route.length > 1;
  const date = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
  const dateStr = date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const wType = w.type || 'ride';
  const wCfg = TYPE_CFG[wType] || TYPE_CFG.ride;

  const ov = document.createElement('div');
  ov.id = 'activity-detail-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:48;background:var(--bg);display:flex;flex-direction:column;overflow-y:auto';
  let html = `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;padding-top:calc(12px + var(--safe-t));border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ad-back" aria-label="Back" style="background:none;border:none;color:var(--fg);cursor:pointer;padding:4px;display:flex;align-items:center"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
    <span style="font-size:15px;font-weight:700;color:var(--fg)">Activity Detail</span><div style="width:28px"></div></div>`;
  if (hasRoute && wCfg.map) html += `<div id="ad-map" style="width:100%;height:220px;flex-shrink:0;background:#0a0b0f"></div>`;
  html += `<div style="padding:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;color:var(--primary)">${typeIconSvg(wType)}<span style="font-size:20px;font-weight:800;color:var(--fg)">${escHtml(w.name || 'Workout')}</span></div>`;
  html += `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:16px">${dateStr} · ${timeStr}</div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">';
  const stat = (val, lbl, color) => `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:800;color:${color || 'var(--primary)'}">${val}</div><div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">${lbl}</div></div>`;
  if (w.duration) html += stat(w.duration, 'Minutes');
  if (w.distance) html += stat(w.distance, 'Kilometres');
  if (w.avgSpeed) html += stat(w.avgSpeed, 'Avg km/h', 'var(--fg)');
  if (w.steps != null) html += stat(w.steps.toLocaleString(), 'Steps', 'var(--fg)');
  if (w.heartRate) {
    const maxHr = 220 - (parseInt(ctx.getUserAge?.() || '15'));
    const zones = [
      { name: 'Z1 Recovery',  min: Math.round(maxHr*0.5), max: Math.round(maxHr*0.6), color: '#94a3b8' },
      { name: 'Z2 Endurance', min: Math.round(maxHr*0.6), max: Math.round(maxHr*0.7), color: '#3b82f6' },
      { name: 'Z3 Tempo',     min: Math.round(maxHr*0.7), max: Math.round(maxHr*0.8), color: '#22c55e' },
      { name: 'Z4 Threshold', min: Math.round(maxHr*0.8), max: Math.round(maxHr*0.9), color: '#f59e0b' },
      { name: 'Z5 VO2 Max',   min: Math.round(maxHr*0.9), max: maxHr,                color: '#ef4444' },
    ];
    let zone = zones[0];
    for (let i = zones.length - 1; i >= 0; i--) { if (w.heartRate >= zones[i].min) { zone = zones[i]; break; } }
    html += stat(w.heartRate, 'Avg BPM', zone.color);
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:14px;font-weight:700;color:${zone.color}">${zone.name}</div><div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">HR Zone</div></div>`;
  }
  if (w.rpe) html += stat(w.rpe + '/10', 'RPE', 'var(--fg)');
  if (w.gym?.exercise) html += stat(escHtml(w.gym.exercise), 'Exercise', 'var(--fg)');
  if (w.duration && w.distance && w.distance > 0) html += stat((w.duration / w.distance).toFixed(1), 'Min/km', 'var(--fg)');
  html += '</div>';
  const src = w.source === 'strava'
    ? '<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;vertical-align:-2px"><path d="M16.5 13.4l-2.6 5.2-2.6-5.2H8.7L13.9 24l5.2-10.6h-2.6zM8 0L1.4 13.4h4l2.6-5.2 2.6 5.2H15L8 0z"/></svg> Synced from Strava'
    : w.source === 'tracker'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:-2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> GPS tracked'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Manually logged';
  html += `<div style="font-size:12px;color:var(--muted-fg);text-align:center;padding:8px 0;display:flex;align-items:center;justify-content:center;gap:5px">${src}</div></div>`;
  ov.innerHTML = html;
  document.body.appendChild(ov);

  if (hasRoute && wCfg.map && typeof L !== 'undefined') {
    const a2 = accent();
    setTimeout(() => {
      try {
        const m2 = L.map('ad-map', { zoomControl: false, attributionControl: false });
        L.tileLayer(ctx.getMapTileUrl(), { maxZoom: 18 }).addTo(m2);
        const ll = route.map(p => [p[0], p[1]]);
        const pl = L.polyline(ll, { color: a2, weight: 4, opacity: 0.9 }).addTo(m2);
        L.circleMarker(ll[0], { radius: 7, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(m2);
        L.circleMarker(ll[ll.length - 1], { radius: 7, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(m2);
        m2.fitBounds(pl.getBounds(), { padding: [20, 20] });
      } catch(_) {}
    }, 150);
  }
  document.getElementById('ad-back')?.addEventListener('click', () => ov.remove());
}
