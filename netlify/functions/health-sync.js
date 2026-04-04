// Netlify Function: Health Data Sync Webhook
// Uses firebase-admin for full Firestore access
// ENV VARS: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, HEALTH_SYNC_SECRET

const admin = require('firebase-admin');

let app;
function getDb() {
  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) return null;
    app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  }
  return admin.firestore();
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { token, secret, type, data } = body;

    if (secret !== process.env.HEALTH_SYNC_SECRET) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid secret' }) };
    }
    if (!token || !type || !data) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token, type, or data' }) };
    }

    const db = getDb();
    if (!db) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firebase not configured' }) };
    }

    // Find user by sync token
    const snap = await db.collection('users').where('syncToken', '==', token).limit(1).get();
    if (snap.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid sync token' }) };
    }

    const userId = snap.docs[0].id;
    const now = new Date().toISOString();

    // Update health snapshot on user profile
    const update = { 'health.lastSync': now };
    if (type === 'heart_rate' && data.bpm) update['health.latestHr'] = data.bpm;
    if (type === 'steps' && data.count) update['health.latestSteps'] = data.count;
    if (type === 'sleep' && data.duration) update['health.latestSleep'] = data.duration;
    if (type === 'body' && data.restingHr) update['health.restingHr'] = data.restingHr;
    if (type === 'body' && data.vo2max) update['health.vo2max'] = data.vo2max;
    await db.collection('users').doc(userId).update(update);

    // Save workout if type is workout
    if (type === 'workout') {
      await db.collection('users').doc(userId).collection('workouts').add({
        name: data.name || 'Synced Workout',
        type: data.type || 'cardio',
        duration: data.duration || 0,
        distance: data.distance || null,
        heartRate: data.avgHr || null,
        calories: data.calories || null,
        source: 'health_sync',
        notes: 'Synced from health app',
        rpe: null,
        date: admin.firestore.Timestamp.fromDate(new Date(data.startTime || now)),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, type, userId }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
