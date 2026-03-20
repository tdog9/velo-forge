// VeloForge GPS Tracker Module
// Usage: import { initTracker, openActivityTracker, closeActivityTracker, openActivityDetail } from './tracker.js';
// Call initTracker(ctx) once after app loads, passing in the app context object.

import { escHtml, haversine } from './state.js';

let ctx = {}; // app context — set by initTracker()
let trackerState = 'idle';
let trackerType = 'ride';
let trackerWatchId = null;
let trackerPositions = [];
let trackerStartTime = null;
let trackerElapsed = 0;
let trackerInterval = null;
let trackerMap = null;
let trackerPolyline = null;
let trackerMarker = null;
let trackerWakeLock = null;

// Call once from app.js after Firebase + state is ready
export function initTracker(appCtx) { ctx = appCtx; }

export function openActivityTracker() {
  trackerState = 'idle';
  trackerPositions = [];
  trackerElapsed = 0;
  trackerStartTime = null;

  const overlay = document.createElement('div');
  overlay.id = 'tracker-overlay';
  overlay.className = 'tracker-overlay';
  overlay.innerHTML = `
    <div class="tracker-header">
      <span class="tracker-header-title">Record Activity</span>
      <button class="tracker-close" id="tracker-close-btn">✕</button>
    </div>
    <div class="tracker-type-bar">
      <button class="tracker-type-btn active" data-ttype="ride">🚴 Ride</button>
      <button class="tracker-type-btn" data-ttype="run">🏃 Run</button>
      <button class="tracker-type-btn" data-ttype="walk">🚶 Walk</button>
      <button class="tracker-type-btn" data-ttype="gym">🏋️ Gym</button>
    </div>
    <div class="tracker-map"><div id="tracker-map-el"></div></div>
    <div class="tracker-stats">
      <div class="tracker-stat big"><div class="tracker-stat-val" id="t-time">00:00</div><div class="tracker-stat-lbl">Duration</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-dist">0.00</div><div class="tracker-stat-lbl">Distance (km)</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-speed">0.0</div><div class="tracker-stat-lbl">Speed (km/h)</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-pace">--:--</div><div class="tracker-stat-lbl">Pace (min/km)</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-alt">--</div><div class="tracker-stat-lbl">Elevation (m)</div></div>
    </div>
    <div class="tracker-controls" id="tracker-controls">
      <button class="tracker-btn start" id="t-start-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg></button>
    </div>`;
  document.body.appendChild(overlay);

  setTimeout(() => {
    try {
      if (typeof L !== 'undefined') {
        trackerMap = L.map('tracker-map-el', { zoomControl: false, attributionControl: false }).setView([-37.81, 144.96], 15);
        L.tileLayer(ctx.getMapTileUrl(), { maxZoom: 19 }).addTo(trackerMap);
        trackerPolyline = L.polyline([], { color: '#BFFF00', weight: 4, opacity: 0.9 }).addTo(trackerMap);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(pos => {
            trackerMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
            trackerMarker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 8, fillColor: '#BFFF00', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(trackerMap);
          }, () => {}, { enableHighAccuracy: true });
        }
      } else {
        const mapEl = document.getElementById('tracker-map-el');
        if (mapEl) mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted-fg);font-size:13px">Map unavailable — GPS tracking still works</div>';
      }
    } catch(e) { console.error('Map init error:', e); }
  }, 150);

  overlay.querySelectorAll('.tracker-type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.querySelectorAll('.tracker-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trackerType = btn.dataset.ttype;
      ctx.haptic('light');
    });
  });

  document.getElementById('tracker-close-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trackerState === 'tracking' || trackerState === 'paused') {
      if (!confirm('Discard this activity?')) return;
    }
    closeActivityTracker();
  });

  document.getElementById('t-start-btn')?.addEventListener('click', (e) => { e.stopPropagation(); startTracking(); });
}

function startTracking() {
  trackerState = 'tracking';
  trackerStartTime = Date.now() - (trackerElapsed * 1000);
  ctx.haptic('medium');
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(wl => { trackerWakeLock = wl; }).catch(() => {}); } catch(e) {}
  trackerInterval = setInterval(updateTrackerDisplay, 1000);
  try {
    if (navigator.geolocation) {
      trackerWatchId = navigator.geolocation.watchPosition(pos => {
        const { latitude, longitude, speed, altitude } = pos.coords;
        trackerPositions.push({ lat: latitude, lng: longitude, time: Date.now(), speed: speed || 0, alt: altitude || 0 });
        try {
          if (trackerMap && trackerPolyline) {
            const ll = [latitude, longitude];
            trackerPolyline.addLatLng(ll);
            if (trackerMarker) trackerMarker.setLatLng(ll);
            else if (typeof L !== 'undefined') trackerMarker = L.circleMarker(ll, { radius: 8, fillColor: '#BFFF00', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(trackerMap);
            trackerMap.panTo(ll);
          }
        } catch(e) {}
      }, err => console.warn('GPS error:', err.message), { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 });
    }
  } catch(e) { console.error('GPS init error:', e); }
  updateTrackerControls();
}

function pauseTracking() {
  trackerState = 'paused';
  trackerElapsed = Math.floor((Date.now() - trackerStartTime) / 1000);
  clearInterval(trackerInterval);
  if (trackerWatchId !== null) { navigator.geolocation.clearWatch(trackerWatchId); trackerWatchId = null; }
  if (trackerWakeLock) { trackerWakeLock.release().catch(() => {}); trackerWakeLock = null; }
  ctx.haptic('light');
  updateTrackerControls();
}

function stopTracking() {
  pauseTracking();
  trackerState = 'saving';
  ctx.haptic('medium');
  showSaveScreen();
}

function updateTrackerControls() {
  const el = document.getElementById('tracker-controls');
  if (!el) return;
  if (trackerState === 'idle') {
    el.innerHTML = '<button class="tracker-btn start" id="t-start-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg></button>';
    document.getElementById('t-start-btn')?.addEventListener('click', (e) => { e.stopPropagation(); startTracking(); });
  } else if (trackerState === 'tracking') {
    el.innerHTML = `<button class="tracker-btn discard" id="t-discard-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <button class="tracker-btn pause" id="t-pause-btn"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg></button>
      <button class="tracker-btn stop" id="t-stop-btn"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>`;
    document.getElementById('t-pause-btn')?.addEventListener('click', (e) => { e.stopPropagation(); pauseTracking(); });
    document.getElementById('t-stop-btn')?.addEventListener('click', (e) => { e.stopPropagation(); stopTracking(); });
    document.getElementById('t-discard-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Discard?')) closeActivityTracker(); });
  } else if (trackerState === 'paused') {
    el.innerHTML = `<button class="tracker-btn discard" id="t-discard-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <button class="tracker-btn resume" id="t-resume-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg></button>
      <button class="tracker-btn stop" id="t-stop-btn"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>`;
    document.getElementById('t-resume-btn')?.addEventListener('click', (e) => { e.stopPropagation(); startTracking(); });
    document.getElementById('t-stop-btn')?.addEventListener('click', (e) => { e.stopPropagation(); stopTracking(); });
    document.getElementById('t-discard-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Discard?')) closeActivityTracker(); });
  }
}

function updateTrackerDisplay() {
  const elapsed = Math.floor((Date.now() - trackerStartTime) / 1000);
  const mins = Math.floor(elapsed / 60), secs = elapsed % 60, hrs = Math.floor(mins / 60);
  const timeEl = document.getElementById('t-time');
  if (timeEl) timeEl.textContent = hrs > 0 ? hrs+':'+String(mins%60).padStart(2,'0')+':'+String(secs).padStart(2,'0') : String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
  const dist = calcDist();
  const distEl = document.getElementById('t-dist');
  if (distEl) distEl.textContent = dist.toFixed(2);
  const lastPt = trackerPositions[trackerPositions.length - 1];
  const speedEl = document.getElementById('t-speed');
  if (speedEl) speedEl.textContent = (lastPt ? lastPt.speed * 3.6 : 0).toFixed(1);
  const paceEl = document.getElementById('t-pace');
  if (paceEl) {
    if (dist > 0.01) { const p = (elapsed/60)/dist; paceEl.textContent = Math.floor(p)+':'+String(Math.round((p-Math.floor(p))*60)).padStart(2,'0'); }
    else paceEl.textContent = '--:--';
  }
  const altEl = document.getElementById('t-alt');
  if (altEl && lastPt?.alt) altEl.textContent = Math.round(lastPt.alt);
}

function calcDist() {
  let d = 0;
  for (let i = 1; i < trackerPositions.length; i++)
    d += haversine(trackerPositions[i-1].lat, trackerPositions[i-1].lng, trackerPositions[i].lat, trackerPositions[i].lng);
  return d;
}

function showSaveScreen() {
  const overlay = document.getElementById('tracker-overlay');
  if (!overlay) return;
  const dist = calcDist(), elapsed = trackerElapsed, mins = Math.floor(elapsed/60);
  const avgSpeed = elapsed > 0 ? (dist/(elapsed/3600)) : 0;
  const typeLabels = {ride:'🚴 Ride',run:'🏃 Run',walk:'🚶 Walk',gym:'🏋️ Gym'};
  const saveDiv = document.createElement('div');
  saveDiv.className = 'tracker-save-overlay';
  saveDiv.innerHTML = `<div class="tracker-save-card">
    <h3>Save Activity</h3>
    <div style="font-size:13px;color:var(--muted-fg);margin-bottom:12px">${typeLabels[trackerType]||trackerType}</div>
    <div class="tracker-save-stats">
      <div class="tracker-save-stat"><div class="val">${dist.toFixed(2)} km</div><div class="lbl">Distance</div></div>
      <div class="tracker-save-stat"><div class="val">${mins} min</div><div class="lbl">Duration</div></div>
      <div class="tracker-save-stat"><div class="val">${avgSpeed.toFixed(1)} km/h</div><div class="lbl">Avg Speed</div></div>
      <div class="tracker-save-stat"><div class="val">${trackerPositions.length}</div><div class="lbl">GPS Points</div></div>
    </div>
    <input class="input" id="t-save-name" type="text" placeholder="Activity name (optional)" style="margin-bottom:8px;width:100%">
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <span style="font-size:12px;color:var(--muted-fg);line-height:32px">RPE:</span>
      <div style="display:flex;gap:3px">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="t-rpe-btn" data-rpe="${n}" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);font-size:11px;cursor:pointer">${n}</button>`).join('')}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="t-save-discard" class="btn" style="flex:1;background:var(--surface-alt);color:var(--muted-fg)">Discard</button>
      <button id="t-save-btn" class="btn btn-primary" style="flex:1">Save Activity</button>
    </div></div>`;
  overlay.appendChild(saveDiv);

  let selectedRpe = null;
  saveDiv.querySelectorAll('.t-rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveDiv.querySelectorAll('.t-rpe-btn').forEach(b=>{b.style.background='var(--surface-alt)';b.style.color='var(--muted-fg)';});
      btn.style.background='var(--primary)';btn.style.color='var(--primary-fg)';
      selectedRpe = parseInt(btn.dataset.rpe);
    });
  });

  document.getElementById('t-save-discard')?.addEventListener('click', () => closeActivityTracker());
  document.getElementById('t-save-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('t-save-name')?.value?.trim() || (trackerType==='ride'?'Ride':trackerType==='run'?'Run':trackerType==='walk'?'Walk':'Gym Session');
    const path = trackerPositions.filter((_,i)=>i%3===0||i===trackerPositions.length-1).map(p=>[parseFloat(p.lat.toFixed(5)),parseFloat(p.lng.toFixed(5))]);
    const workoutId = 'trk-'+Date.now();
    const workout = { name, duration:mins, date:new Date(), type:trackerType, distance:parseFloat(dist.toFixed(2)), avgSpeed:parseFloat(avgSpeed.toFixed(1)), rpe:selectedRpe, gpsPoints:trackerPositions.length, source:'tracker' };
    if (path.length > 1) { try { const r=JSON.parse(localStorage.getItem('vf_routes')||'{}'); r[workoutId]=path; const k=Object.keys(r); if(k.length>50)delete r[k[0]]; localStorage.setItem('vf_routes',JSON.stringify(r)); }catch(e){} }
    // Delegate save to app.js callback
    if (ctx.saveTrackedActivity) {
      await ctx.saveTrackedActivity(workout, workoutId);
    }
    closeActivityTracker();
    if (ctx.onActivitySaved) ctx.onActivitySaved();
  });
}

export function closeActivityTracker() {
  clearInterval(trackerInterval);
  if (trackerWatchId !== null) { navigator.geolocation.clearWatch(trackerWatchId); trackerWatchId = null; }
  if (trackerWakeLock) { trackerWakeLock.release().catch(() => {}); trackerWakeLock = null; }
  if (trackerMap) { trackerMap.remove(); trackerMap = null; }
  trackerPolyline = null; trackerMarker = null; trackerState = 'idle';
  const overlay = document.getElementById('tracker-overlay');
  if (overlay) overlay.remove();
}

export function openActivityDetail(workoutIdx) {
  const w = ctx.getWorkouts()[workoutIdx];
  if (!w) return;
  let routes = {};
  try { routes = JSON.parse(localStorage.getItem('vf_routes')||'{}'); } catch(e) {}
  const routeId = w.routeId || w.id;
  const route = routes[routeId];
  const hasRoute = route && route.length > 1;
  const date = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
  const dateStr = date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const timeStr = date.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
  const icons = {ride:'🚴',run:'🏃',walk:'🚶',gym:'🏋️'};
  const wType = w.type||'ride';

  const ov = document.createElement('div');
  ov.id = 'activity-detail-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:48;background:var(--bg);display:flex;flex-direction:column;overflow-y:auto';
  let html = `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;padding-top:calc(12px + var(--safe-t));border-bottom:1px solid var(--border);flex-shrink:0">
    <button id="ad-back" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;padding:4px">←</button>
    <span style="font-size:15px;font-weight:700;color:var(--text)">Activity Detail</span><div style="width:28px"></div></div>`;
  if (hasRoute) html += `<div id="ad-map" style="width:100%;height:220px;flex-shrink:0;background:#0a0b0f"></div>`;
  html += `<div style="padding:16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:24px">${icons[wType]||'🏋️'}</span><span style="font-size:20px;font-weight:800;color:var(--text)">${escHtml(w.name||'Workout')}</span></div>`;
  html += `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:16px">${dateStr} · ${timeStr}</div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">';
  const stat = (val,lbl,color) => `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:800;color:${color||'var(--primary)'}">${val}</div><div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">${lbl}</div></div>`;
  if (w.duration) html += stat(w.duration,'Minutes');
  if (w.distance) html += stat(w.distance,'Kilometres');
  if (w.avgSpeed) html += stat(w.avgSpeed,'Avg km/h','var(--text)');
  if (w.heartRate) html += stat(w.heartRate,'Avg BPM','#ef4444');
  if (w.rpe) html += stat(w.rpe+'/10','RPE','var(--text)');
  if (w.duration && w.distance && w.distance > 0) html += stat((w.duration/w.distance).toFixed(1),'Min/km','var(--text)');
  html += '</div>';
  const src = w.source==='strava'?'⬡ Synced from Strava':w.source==='tracker'?'📍 GPS Tracked':'✏️ Manually Logged';
  html += `<div style="font-size:12px;color:var(--muted-fg);text-align:center;padding:8px 0">${src}</div></div>`;
  ov.innerHTML = html;
  document.body.appendChild(ov);

  if (hasRoute && typeof L !== 'undefined') {
    setTimeout(() => {
      try {
        const m = L.map('ad-map',{zoomControl:false,attributionControl:false});
        L.tileLayer(ctx.getMapTileUrl(),{maxZoom:18}).addTo(m);
        const ll = route.map(p=>[p[0],p[1]]);
        const pl = L.polyline(ll,{color:'#BFFF00',weight:4,opacity:0.9}).addTo(m);
        L.circleMarker(ll[0],{radius:7,fillColor:'#22c55e',fillOpacity:1,color:'#fff',weight:2}).addTo(m);
        L.circleMarker(ll[ll.length-1],{radius:7,fillColor:'#ef4444',fillOpacity:1,color:'#fff',weight:2}).addTo(m);
        m.fitBounds(pl.getBounds(),{padding:[20,20]});
      } catch(e) {}
    }, 150);
  }
  document.getElementById('ad-back')?.addEventListener('click', () => ov.remove());
}
