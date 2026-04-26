// Health Sync Webhook — writes via firebase-admin (bypasses Firestore rules).
// ENV VARS:
//   FIREBASE_PROJECT_ID    — service-account project_id
//   FIREBASE_CLIENT_EMAIL  — service-account client_email
//   FIREBASE_PRIVATE_KEY   — service-account private_key (literal \n escaped)
//   HEALTH_SYNC_SECRET     — shared secret sent by client in request body
//
// NOTE: HEALTH_SYNC_SECRET is hardcoded client-side, so it's effectively public.
// Firestore security rules deny all unauthenticated access regardless; this
// secret is only a cheap spam filter on the webhook.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
  }
}

const ALLOWED_ORIGINS = new Set([
  'https://turboprep.app',
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://turboprep.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  if (!admin.apps.length) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firebase Admin not configured (set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { token, secret, type, data } = body;

    if (process.env.HEALTH_SYNC_SECRET && secret !== process.env.HEALTH_SYNC_SECRET) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid secret' }) };
    }
    if (!token || !type || !data) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token, type, or data' }) };
    }

    const db = admin.firestore();

    // Find user by sync token.
    const snap = await db.collection('users').where('syncToken', '==', token).limit(1).get();
    if (snap.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid sync token' }) };
    }
    const userRef = snap.docs[0].ref;
    const existingHealth = snap.docs[0].get('health') || {};
    const now = new Date().toISOString();

    const healthUpdate = { lastSync: now };
    if (type === 'heart_rate' && data.bpm != null) healthUpdate.latestHr = Math.round(Number(data.bpm));
    if (type === 'steps' && data.count != null) healthUpdate.latestSteps = Math.round(Number(data.count));
    if (type === 'sleep' && data.duration != null) healthUpdate.latestSleep = parseFloat(data.duration);
    if (type === 'body' && data.restingHr != null) healthUpdate.restingHr = Math.round(Number(data.restingHr));
    if (type === 'body' && data.vo2max != null) healthUpdate.vo2max = parseFloat(data.vo2max);

    await userRef.update({ health: { ...existingHealth, ...healthUpdate } });

    if (type === 'workout') {
      const workout = {
        name: data.name || 'Synced Workout',
        type: data.type || 'cardio',
        duration: Number(data.duration || 0),
        source: 'health_sync',
        date: data.startTime ? new Date(data.startTime) : new Date(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (data.distance != null) workout.distance = parseFloat(data.distance);
      if (data.avgHr != null) workout.heartRate = Math.round(Number(data.avgHr));
      await userRef.collection('workouts').add(workout);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, type, userId: userRef.id }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
