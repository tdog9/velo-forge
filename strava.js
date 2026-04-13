// TurboPrep Strava Integration Module
import { decodePolyline, escHtml } from './state.js';

let A = {};
export function initStrava(ctx) { A = ctx; }

export function stravaStartAuth() {
  if (!A.STRAVA_CLIENT_ID) { A.showToast('Strava Client ID not configured.', 'error'); return; }
  const scope = 'activity:read_all,activity:write';
  const url = `https://www.strava.com/oauth/authorize?client_id=${A.STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(A.STRAVA_REDIRECT_URI)}&response_type=code&scope=${scope}&approval_prompt=auto`;
  window.location.href = url;
}

export async function stravaHandleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  try {
    // Exchange code for tokens via Netlify Function
    const resp = await fetch('/.netlify/functions/strava-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!resp.ok) throw new Error('Token exchange failed');
    const data = await resp.json();
    A.stravaTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete || {}
    };
    // Save to Firestore
    if (A.currentUser && A.db && !A.demoMode) {
      await A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid), { stravaTokens: A.stravaTokens, stravaAthleteId: String(data.athlete?.id || '') });
    }
    // Fetch activities
    await stravaFetchActivities();
    A.renderProfile();
  } catch(e) {
    console.error('Strava auth error:', e);
    A.showToast('Failed to connect Strava.', 'error');
  }
}

export async function stravaRefreshToken() {
  if (!A.stravaTokens?.refresh_token) return false;
  try {
    const resp = await fetch('/.netlify/functions/strava-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: A.stravaTokens.refresh_token, grant_type: 'refresh_token' })
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    A.stravaTokens.access_token = data.access_token;
    A.stravaTokens.refresh_token = data.refresh_token;
    A.stravaTokens.expires_at = data.expires_at;
    if (A.currentUser && A.db && !A.demoMode) {
      await A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid), { stravaTokens: A.stravaTokens });
    }
    return true;
  } catch(e) { return false; }
}

export async function stravaFetchActivities() {
  if (!A.stravaTokens?.access_token) return;

  // Check if token expired
  if (A.stravaTokens.expires_at && Date.now() / 1000 > A.stravaTokens.expires_at) {
    const refreshed = await stravaRefreshToken();
    if (!refreshed) { stravaDisconnect(); return; }
  }

  try {
    const resp = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=20', {
      headers: { 'Authorization': 'Bearer ' + A.stravaTokens.access_token }
    });
    if (resp.status === 401) {
      const refreshed = await stravaRefreshToken();
      if (refreshed) return stravaFetchActivities();
      stravaDisconnect(); return;
    }
    if (!resp.ok) throw new Error('Fetch failed');
    A.stravaActivities = await resp.json();
  } catch(e) {
    console.error('Strava fetch error:', e);
  }
}

export function renderStravaActivities() {
  const list = A.$('strava-activities-list');
  if (!list) return;
  if (A.stravaActivities.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted-fg);padding:8px 0">No recent activities found.</div>';
    return;
  }

  // Check which activities are already imported
  const importedIds = new Set();
  A.userWorkouts.forEach(w => { if (w.stravaId) importedIds.add(w.stravaId); });

  let html = '';
  A.stravaActivities.slice(0, 10).forEach(a => {
    const date = new Date(a.start_date_local || a.start_date);
    const dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const dist = a.distance ? (a.distance / 1000).toFixed(1) + ' km' : '';
    const dur = a.moving_time ? Math.round(a.moving_time / 60) + ' min' : '';
    const isImported = importedIds.has(String(a.id));

    html += `<div class="strava-activity">
      <div class="strava-activity-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg></div>
      <div class="strava-activity-info">
        <div class="strava-activity-name">${escHtml(a.name || 'Activity')}</div>
        <div class="strava-activity-meta">${dateStr}${dist ? ' · ' + dist : ''}${dur ? ' · ' + dur : ''}</div>
      </div>
      ${isImported
        ? '<span class="strava-import-btn imported">Imported</span>'
        : `<button class="strava-import-btn" data-strava-id="${a.id}" data-strava-name="${escHtml(a.name || 'Strava Activity')}" data-strava-dur="${Math.round((a.moving_time || 0) / 60)}" data-strava-dist="${a.distance ? (a.distance / 1000).toFixed(1) : ''}" data-strava-date="${a.start_date_local || a.start_date}" data-strava-type="${a.type || 'Ride'}">Import</button>`
      }
    </div>`;
  });
  list.innerHTML = html;

  // Bind import buttons
  list.querySelectorAll('.strava-import-btn:not(.imported)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stravaId = btn.dataset.stravaId;
      const name = btn.dataset.stravaName;
      const duration = parseInt(btn.dataset.stravaDur) || 0;
      const distance = parseFloat(btn.dataset.stravaDist) || null;
      const dateStr = btn.dataset.stravaDate;
      const stravaTypeRaw = btn.dataset.stravaType || 'Ride';
      const importTypeMap = { Ride: 'ride', Run: 'run', Walk: 'walk', Workout: 'gym', WeightTraining: 'gym', Yoga: 'gym', Swim: 'cardio', Hike: 'walk', VirtualRide: 'ride', VirtualRun: 'treadmill', Elliptical: 'treadmill' };
      const type = importTypeMap[stravaTypeRaw] || 'ride';
      const dateObj = dateStr ? new Date(dateStr) : new Date();
      const routeId = 'strava-' + stravaId;

      // Decode polyline from cached activity data
      const stravaActivity = A.stravaActivities.find(a => String(a.id) === String(stravaId));
      if (stravaActivity?.map?.summary_polyline) {
        try {
          const path = decodePolyline(stravaActivity.map.summary_polyline);
          if (path.length > 1) {
            const routes = JSON.parse(localStorage.getItem('vf_routes') || '{}');
            routes[routeId] = path.map(p => [parseFloat(p[0].toFixed(5)), parseFloat(p[1].toFixed(5))]);
            const keys = Object.keys(routes);
            if (keys.length > 80) delete routes[keys[0]];
            localStorage.setItem('vf_routes', JSON.stringify(routes));
          }
        } catch(e) {}
      }

      btn.textContent = 'Importing...';
      btn.disabled = true;

      const workoutData = {
        name, type, duration, distance,
        heartRate: stravaActivity?.average_heartrate ? Math.round(stravaActivity.average_heartrate) : null,
        avgSpeed: stravaActivity?.average_speed ? parseFloat((stravaActivity.average_speed * 3.6).toFixed(1)) : null,
        notes: 'Imported from Strava',
        rpe: null,
        stravaId: String(stravaId),
        routeId: routeId,
        source: 'strava'
      };

      if (A.demoMode) {
        A.userWorkouts.unshift({ ...workoutData, _id: 'd' + Date.now(), date: dateObj, createdAt: new Date() });
      } else if (A.db && A.currentUser) {
        try {
          await A.addDoc(A.collection(A.db, 'users', A.currentUser.uid, 'workouts'), {
            ...workoutData,
            date: A.Timestamp.fromDate(dateObj),
            createdAt: A.serverTimestamp()
          });
        } catch(e) { console.error('Strava import error:', e); }
      }

      btn.textContent = 'Imported ✓';
      btn.classList.add('imported');
      btn.disabled = true;
    });
  });
}

export async function stravaDisconnect() {
  // Call Strava deauthorization endpoint (required by API terms)
  if (A.stravaTokens?.access_token) {
    try {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'access_token=' + A.stravaTokens.access_token
      });
    } catch(e) { console.warn('Strava deauth API call failed:', e); }
  }
  A.stravaTokens = null;
  A.stravaActivities = [];
  if (A.currentUser && A.db && !A.demoMode) {
    try { await A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid), { stravaTokens: null }); } catch(e) {}
  }
  A.renderProfile();
}

// Load Strava tokens from user profile on login
export function loadStravaTokens() {
  if (A.userProfile?.stravaTokens) {
    A.stravaTokens = A.userProfile.stravaTokens;
  }
}

// Upload a TurboPrep activity to Strava
export async function stravaUploadActivity(workout) {
  if (!A.stravaTokens?.access_token) return false;
  // Refresh token if needed
  if (A.stravaTokens.expires_at && Date.now() / 1000 > A.stravaTokens.expires_at) {
    const refreshed = await stravaRefreshToken();
    if (!refreshed) return false;
  }
  try {
    const typeMap = { hpv: 'Ride', ride: 'Ride', run: 'Run', treadmill: 'Run', walk: 'Walk', gym: 'Workout', HPV: 'Ride', Ride: 'Ride', Run: 'Run', Treadmill: 'Run', Strength: 'Workout', Cardio: 'Workout', Flexibility: 'Workout' };
    const stravaType = typeMap[workout.type] || typeMap[workout.type?.toLowerCase()] || 'Workout';
    const startDate = workout.date ? (workout.date.toDate ? workout.date.toDate() : new Date(workout.date)) : new Date();
    const body = {
      name: workout.name || 'TurboPrep Activity',
      type: stravaType,
      sport_type: stravaType,
      start_date_local: startDate.toISOString(),
      elapsed_time: (workout.duration || 0) * 60,
      description: 'Recorded with TurboPrep',
      distance: workout.distance ? workout.distance * 1000 : undefined,
      trainer: workout.type === 'gym' ? 1 : 0
    };
    // Remove undefined fields
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
    const resp = await fetch('https://www.strava.com/api/v3/activities', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + A.stravaTokens.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.id; // Return Strava activity ID
    }
    console.error('Strava upload failed:', resp.status);
    return false;
  } catch(e) {
    console.error('Strava upload error:', e);
    return false;
  }
}

// Auto-sync Strava activities on login
export async function stravaAutoSync() {
  if (!A.stravaTokens?.access_token) return;
  try {
    await stravaFetchActivities();
    if (A.stravaActivities.length === 0) return;
    // Build sets for duplicate detection
    const importedIds = new Set();
    const existingWorkouts = [];
    A.userWorkouts.forEach(w => {
      if (w.stravaId) importedIds.add(String(w.stravaId));
      // Also track date+duration for fuzzy matching
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
      if (d) existingWorkouts.push({ date: d.getTime(), duration: w.duration || 0, name: (w.name || '').toLowerCase() });
    });
    let imported = 0;
    for (const a of A.stravaActivities) {
      // Skip if stravaId already exists
      if (importedIds.has(String(a.id))) continue;
      const name = a.name || 'Strava Activity';
      const duration = a.moving_time ? Math.round(a.moving_time / 60) : 0;
      const distance = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : null;
      const avgSpeed = a.average_speed ? parseFloat((a.average_speed * 3.6).toFixed(1)) : null;
      const dateObj = a.start_date_local ? new Date(a.start_date_local) : new Date();
      // Fuzzy duplicate check: same day + similar duration (within 5 min)
      const isDuplicate = existingWorkouts.some(w => {
        const dayMatch = Math.abs(w.date - dateObj.getTime()) < 86400000; // same day
        const durMatch = Math.abs(w.duration - duration) <= 5; // within 5 min
        return dayMatch && durMatch;
      });
      if (isDuplicate) continue;
      const typeMap = { Ride: 'ride', Run: 'run', Walk: 'walk', Hike: 'walk', WeightTraining: 'gym', Workout: 'gym', VirtualRide: 'ride', VirtualRun: 'treadmill', Elliptical: 'treadmill', Yoga: 'gym', Swim: 'cardio' };
      const type = typeMap[a.type] || 'ride';
      const routeId = 'strava-' + a.id;
      // Decode and store polyline route
      if (a.map && a.map.summary_polyline) {
        try {
          const path = decodePolyline(a.map.summary_polyline);
          if (path.length > 1) {
            const routes = JSON.parse(localStorage.getItem('vf_routes') || '{}');
            routes[routeId] = path.map(p => [parseFloat(p[0].toFixed(5)), parseFloat(p[1].toFixed(5))]);
            const keys = Object.keys(routes);
            if (keys.length > 80) delete routes[keys[0]];
            localStorage.setItem('vf_routes', JSON.stringify(routes));
          }
        } catch(e) {}
      }
      const workout = {
        name, type, duration, distance, avgSpeed,
        notes: 'Synced from Strava',
        stravaId: String(a.id),
        routeId: routeId,
        source: 'strava',
        heartRate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        rpe: null
      };
      if (!A.demoMode && A.db && A.currentUser) {
        try {
          await A.addDoc(A.collection(A.db, 'users', A.currentUser.uid, 'workouts'), {
            ...workout,
            date: A.Timestamp.fromDate(dateObj),
            createdAt: A.serverTimestamp()
          });
          imported++;
        } catch(e) { console.error('Strava auto-import error:', e); }
      } else if (A.demoMode) {
        A.userWorkouts.unshift({ ...workout, _id: 'd' + Date.now() + imported, date: dateObj });
        imported++;
      }
    }
    if (imported > 0) {
      A.showToast(imported + ' activit' + (imported > 1 ? 'ies' : 'y') + ' synced from Strava!', 'success');
    }
  } catch(e) { console.error('Strava auto-sync error:', e); }
}


  A.showToast('Re-syncing routes...', 'info');
  try {
    // Refresh token if needed
    if (A.stravaTokens.expires_at && Date.now() / 1000 > A.stravaTokens.expires_at) {
      const refreshed = await stravaRefreshToken();
      if (!refreshed) { A.showToast('Strava session expired. Go to Profile to reconnect.', 'error'); return; }
    }
    // Fetch up to 100 activities (5 pages of 20)
    let allActivities = [];
    for (let page = 1; page <= 5; page++) {
      const resp = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=20&page=${page}`, {
        headers: { 'Authorization': 'Bearer ' + A.stravaTokens.access_token }
      });
      if (!resp.ok) break;
      const batch = await resp.json();
      if (batch.length === 0) break;
      allActivities = allActivities.concat(batch);
    }
    // Decode and store all polylines
    let routes = {};
    try { routes = JSON.parse(localStorage.getItem('vf_routes') || '{}'); } catch(e) {}
    let count = 0;
    allActivities.forEach(a => {
      if (a.map && a.map.summary_polyline) {
        try {
          const path = decodePolyline(a.map.summary_polyline);
          if (path.length > 1) {
            routes['strava-' + a.id] = path.map(p => [parseFloat(p[0].toFixed(5)), parseFloat(p[1].toFixed(5))]);
            count++;
          }
        } catch(e) {}
      }
    });
    // Cap at 100 routes
    const keys = Object.keys(routes);
    while (keys.length > 100) { delete routes[keys.shift()]; }
    localStorage.setItem('vf_routes', JSON.stringify(routes));
    A.showToast(count + ' route' + (count !== 1 ? 's' : '') + ' synced!', 'success');
  } catch(e) {
    console.error('Route resync error:', e);
    A.showToast('Failed to re-sync routes.', 'error');
  }
}
