// TurboPrep Utilities Module — pure functions, no state

// Local "today key" for date-keyed docs and localStorage. The previous
// `new Date().toISOString().split('T')[0]` rolled at UTC midnight,
// which is 10am or 11am Sydney-time — flipping users into "tomorrow"
// during the workday and causing daily-mute keys to re-trigger,
// streaks to break, and the race_day Firestore doc to be keyed
// differently in admin.js vs raceday.js for ~10 hours every morning.
// This helper produces YYYY-MM-DD using the device's local timezone
// components, so every consumer agrees on the same calendar day for
// the user's actual day boundary.
export function localDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function escHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

export function timeAgo(date) {
  const now = Date.now();
  const d = date instanceof Date ? date : new Date(date);
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Level tones — used to colour-code level badges across the app. The
// `icon` field is a small inline SVG so renderers can drop it straight
// into innerHTML without a separate helper. `tone` is the level's
// signature colour for cases where the SVG alone won't read.
const _xpDot = (hex) => `<svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-2px"><circle cx="12" cy="12" r="9" fill="${hex}"/></svg>`;
const _xpCrown = (hex) => `<svg viewBox="0 0 24 24" fill="${hex}" style="width:1em;height:1em;vertical-align:-2px"><path d="M5 16 3 7l4 3 5-6 5 6 4-3-2 9H5zm0 2h14v2H5z"/></svg>`;
export const XP_LEVELS = [
  { name: 'Rookie',   min: 0,    tone: '#22c55e', icon: _xpDot('#22c55e') },
  { name: 'Racer',    min: 100,  tone: '#3b82f6', icon: _xpDot('#3b82f6') },
  { name: 'Athlete',  min: 300,  tone: '#a855f7', icon: _xpDot('#a855f7') },
  { name: 'Champion', min: 600,  tone: '#f97316', icon: _xpDot('#f97316') },
  { name: 'Legend',   min: 1000, tone: '#ef4444', icon: _xpDot('#ef4444') },
  { name: 'Elite',    min: 1500, tone: '#fbbf24', icon: _xpCrown('#fbbf24') },
];

export function getXpLevel(xp) {
  let lvl = XP_LEVELS[0];
  for (const l of XP_LEVELS) { if (xp >= l.min) lvl = l; }
  const idx = XP_LEVELS.indexOf(lvl);
  const next = XP_LEVELS[idx + 1] || null;
  const pct = next ? Math.min(100, ((xp - lvl.min) / (next.min - lvl.min)) * 100) : 100;
  return { ...lvl, xp, next, pct, idx };
}
