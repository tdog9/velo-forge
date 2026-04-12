// TurboPrep Utilities Module — pure functions, no state

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

export const XP_LEVELS = [
  { name: 'Rookie', min: 0, icon: '🟢' },
  { name: 'Racer', min: 100, icon: '🔵' },
  { name: 'Athlete', min: 300, icon: '🟣' },
  { name: 'Champion', min: 600, icon: '🟠' },
  { name: 'Legend', min: 1000, icon: '🔴' },
  { name: 'Elite', min: 1500, icon: '👑' }
];

export function getXpLevel(xp) {
  let lvl = XP_LEVELS[0];
  for (const l of XP_LEVELS) { if (xp >= l.min) lvl = l; }
  const idx = XP_LEVELS.indexOf(lvl);
  const next = XP_LEVELS[idx + 1] || null;
  const pct = next ? Math.min(100, ((xp - lvl.min) / (next.min - lvl.min)) * 100) : 100;
  return { ...lvl, xp, next, pct, idx };
}
