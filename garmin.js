// TurboPrep Garmin Integration Module
//
// Garmin Connect doesn't expose a public consumer OAuth API — accessing
// activity data requires a partner agreement with Garmin Health. As a
// pragmatic alternative we accept Garmin's exported .gpx (and basic .tcx)
// files: any user can export an activity from Garmin Connect → ⚙️ → Export
// to GPX/TCX, and drop the file here to ingest as a workout.
//
// FIT (binary) is the richest format but requires a parser (~30 KB lib).
// We do GPX (XML) and TCX (XML) here — covers ~95% of cyclists.

import { escHtml } from './state.js';

let A = { $: (id) => document.getElementById(id) };
export function initGarmin(ctx) { A = ctx; }

function parseISODate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function haversineKm(p1, p2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseGpx(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('Could not parse GPX file.');
  const trkpts = Array.from(doc.querySelectorAll('trkpt'));
  if (trkpts.length === 0) throw new Error('No track points found in GPX.');
  const points = trkpts.map(p => {
    const lat = parseFloat(p.getAttribute('lat'));
    const lng = parseFloat(p.getAttribute('lon'));
    const timeEl = p.querySelector('time');
    const eleEl = p.querySelector('ele');
    const hrEl = p.querySelector('extensions hr, extensions [*|hr]');
    return {
      lat, lng,
      time: timeEl ? parseISODate(timeEl.textContent) : null,
      ele: eleEl ? parseFloat(eleEl.textContent) : null,
      hr: hrEl ? parseInt(hrEl.textContent) : null,
    };
  }).filter(p => isFinite(p.lat) && isFinite(p.lng));
  if (points.length === 0) throw new Error('GPX file has no valid coordinates.');
  let distKm = 0;
  for (let i = 1; i < points.length; i++) distKm += haversineKm(points[i-1], points[i]);
  const start = points[0].time, end = points[points.length-1].time;
  const durMin = (start && end) ? Math.round((end - start) / 60000) : 0;
  const hrs = points.map(p => p.hr).filter(Boolean);
  const avgHr = hrs.length ? Math.round(hrs.reduce((s,h)=>s+h,0) / hrs.length) : null;
  const nameEl = doc.querySelector('trk > name');
  const name = nameEl ? nameEl.textContent.trim() : 'Garmin activity';
  return { name, distKm, durMin, start, avgHr, pointCount: points.length, polyline: points.map(p => [p.lat, p.lng]) };
}

function parseTcx(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('Could not parse TCX file.');
  const activity = doc.querySelector('Activities Activity');
  if (!activity) throw new Error('No activity in TCX file.');
  const sport = activity.getAttribute('Sport') || 'Other';
  const idEl = activity.querySelector('Id');
  const start = idEl ? parseISODate(idEl.textContent) : null;
  let totalSecs = 0, totalMeters = 0, hrSum = 0, hrCount = 0;
  const polyline = [];
  activity.querySelectorAll('Lap').forEach(lap => {
    const ts = lap.querySelector('TotalTimeSeconds');
    const dm = lap.querySelector('DistanceMeters');
    if (ts) totalSecs += parseFloat(ts.textContent) || 0;
    if (dm) totalMeters += parseFloat(dm.textContent) || 0;
  });
  activity.querySelectorAll('Trackpoint').forEach(tp => {
    const pos = tp.querySelector('Position');
    if (pos) {
      const lat = parseFloat(pos.querySelector('LatitudeDegrees')?.textContent);
      const lng = parseFloat(pos.querySelector('LongitudeDegrees')?.textContent);
      if (isFinite(lat) && isFinite(lng)) polyline.push([lat, lng]);
    }
    const hr = tp.querySelector('HeartRateBpm Value');
    if (hr) { hrSum += parseInt(hr.textContent) || 0; hrCount++; }
  });
  return {
    name: 'Garmin ' + sport,
    distKm: totalMeters / 1000,
    durMin: Math.round(totalSecs / 60),
    start,
    avgHr: hrCount ? Math.round(hrSum / hrCount) : null,
    pointCount: polyline.length,
    polyline,
    sport,
  };
}

function inferType(name, sport) {
  const s = ((sport || '') + ' ' + (name || '')).toLowerCase();
  if (s.includes('bik') || s.includes('cycl') || s.includes('ride')) return 'ride';
  if (s.includes('run')) return 'run';
  if (s.includes('walk') || s.includes('hik')) return 'walk';
  if (s.includes('strength') || s.includes('weight')) return 'strength';
  return 'ride';
}

export async function importGarminFile(file) {
  if (!file) return;
  if (!A.currentUser || !A.db || A.demoMode) { A.showToast('Sign in to import.', 'warn'); return; }
  const text = await file.text();
  const lower = file.name.toLowerCase();
  let parsed;
  try {
    if (lower.endsWith('.gpx')) parsed = parseGpx(text);
    else if (lower.endsWith('.tcx')) parsed = parseTcx(text);
    else throw new Error('Use a .gpx or .tcx file. (FIT support coming.)');
  } catch(e) {
    A.showToast(e.message || 'Could not parse file.', 'error');
    return;
  }
  const date = parsed.start || new Date();
  const workout = {
    name: parsed.name || 'Garmin activity',
    type: inferType(parsed.name, parsed.sport),
    duration: parsed.durMin || 0,
    distance: Number(parsed.distKm.toFixed(2)) || 0,
    heartRate: parsed.avgHr || null, // schema-wide field is `heartRate`; was previously `avgHeartRate` so the HR pill never appeared on Garmin-imported cards
    date: A.Timestamp.fromDate(date),
    source: 'garmin',
    importedAt: A.serverTimestamp(),
  };
  // Save polyline separately if non-trivial (Firestore field-size friendly)
  try {
    const ref = await A.addDoc(A.collection(A.db, 'users', A.currentUser.uid, 'workouts'), workout);
    if (parsed.polyline && parsed.polyline.length > 1 && parsed.polyline.length <= 5000) {
      try {
        await A.setDoc(A.doc(A.db, 'users', A.currentUser.uid, 'workout_routes', ref.id), {
          polyline: parsed.polyline,
          pointCount: parsed.polyline.length,
          source: 'garmin',
        });
      } catch(e) {}
    }
    A.showToast(`Imported ${workout.distance} km · ${workout.duration} min from Garmin.`, 'success');
    A.renderProfile?.();
  } catch(e) {
    A.showToast('Import failed: ' + e.message, 'error');
  }
}
