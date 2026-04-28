// Public spectator endpoint — returns a sanitized snapshot of today's
// race-day so families/coaches/anyone can follow along without signing
// in. Read-only. The endpoint takes a teamId so each team's race-day
// data is fetched independently. No PII beyond what's already in the
// Firestore display name.
//
// URL: /.netlify/functions/race-day-public?teamId=<id>
// Returns: { active, raceName, drivers: [{name, lapCount, bestMs, live}], stints: [...] }

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

function localTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=5',
    'Content-Type': 'application/json',
  };
  if (!admin.apps.length) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'admin not init' }) };
  }
  const teamId = (event.queryStringParameters?.teamId || '').trim();
  // teamId optional — without it we just return raceday meta + global live.
  // With it we filter drivers to that team.
  const date = (event.queryStringParameters?.date || localTodayKey()).trim();

  try {
    const fs = admin.firestore();
    const rdSnap = await fs.collection('race_day').doc(date).get();
    if (!rdSnap.exists) {
      return { statusCode: 200, headers, body: JSON.stringify({ active: false, date }) };
    }
    const rd = rdSnap.data() || {};
    let teamName = '';
    let memberSet = null;
    if (teamId) {
      try {
        const tSnap = await fs.collection('teams').doc(teamId).get();
        if (tSnap.exists) {
          const t = tSnap.data() || {};
          teamName = t.name || '';
          memberSet = new Set(Array.isArray(t.members) ? t.members : []);
        }
      } catch(e) {}
    }
    // Live stints
    const liveSnap = await fs.collection('race_day').doc(date).collection('live').get();
    const liveCutoff = Date.now() - 90 * 1000;
    const live = liveSnap.docs.map(d => d.data())
      .filter(d => d.live)
      .filter(d => !memberSet || memberSet.has(d.uid))
      .filter(d => {
        const t = d.updatedAt?.toMillis ? d.updatedAt.toMillis() : 0;
        return t > liveCutoff;
      })
      .map(d => ({
        uid: d.uid,
        displayName: d.displayName || 'Driver',
        lapCount: d.lapCount || 0,
        bestMs: d.bestLap || null,
        elapsed: d.elapsed || 0,
      }));
    // Stints (completed)
    const stintsSnap = await fs.collection('race_day').doc(date).collection('stints').get();
    const stints = stintsSnap.docs.map(d => d.data())
      .filter(d => !memberSet || memberSet.has(d.uid))
      .map(d => {
        const laps = Array.isArray(d.laps) ? d.laps : [];
        const lapCount = laps.length;
        const bestMs = laps.length > 0 ? Math.min(...laps.map(l => l.duration || 0)) : null;
        return {
          uid: d.uid,
          displayName: d.displayName || 'Driver',
          lapCount,
          bestMs,
          duration: d.duration || null,
        };
      });
    // Combined leaderboard — laps from completed stints + live laps wins.
    const totals = {};
    [...stints, ...live].forEach(d => {
      if (!d.uid) return;
      if (!totals[d.uid]) totals[d.uid] = { displayName: d.displayName, lapCount: 0, bestMs: null };
      totals[d.uid].lapCount += d.lapCount;
      if (d.bestMs && (totals[d.uid].bestMs == null || d.bestMs < totals[d.uid].bestMs)) {
        totals[d.uid].bestMs = d.bestMs;
      }
    });
    const leaderboard = Object.values(totals)
      .sort((a, b) => (b.lapCount - a.lapCount) || ((a.bestMs || Infinity) - (b.bestMs || Infinity)));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        active: !!rd.active,
        date,
        teamName,
        raceName: rd.raceName || '',
        leaderboard,
        live,
      }),
    };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
