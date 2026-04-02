// Netlify Function: Health Data Sync Webhook
// Accepts POST from any health app (Health Auto Export, IFTTT, Home Assistant, Tasker, etc.)
// Stores health data in Firestore against the student's profile
//
// ENV VARS REQUIRED:
//   FIREBASE_PROJECT_ID — your Firebase project ID
//   HEALTH_SYNC_SECRET  — shared secret to prevent spam (you create this, any random string)
//
// WEBHOOK URL: https://veloforge.netlify.app/.netlify/functions/health-sync
//
// POST body (JSON):
// {
//   "token": "student-sync-token-from-profile",
//   "secret": "your-shared-secret",
//   "type": "heart_rate" | "workout" | "steps" | "sleep" | "body",
//   "data": { ... type-specific fields ... }
// }
//
// DATA FORMATS:
//
// Heart Rate:
//   { "bpm": 142, "timestamp": "2026-04-02T15:30:00Z" }
//
// Workout:
//   { "name": "Afternoon Run", "type": "run", "duration": 30, "distance": 5.2,
//     "calories": 320, "avgHr": 155, "maxHr": 178, "startTime": "...", "endTime": "..." }
//
// Steps:
//   { "count": 8432, "date": "2026-04-02" }
//
// Sleep:
//   { "duration": 7.5, "quality": "good", "bedTime": "22:30", "wakeTime": "06:00", "date": "2026-04-02" }
//
// Body:
//   { "weight": 65.2, "height": 172, "restingHr": 62, "vo2max": 42, "date": "2026-04-02" }

const admin = require('firebase-admin');

let app;
function getFirestore() {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: `firebase-adminsdk@${process.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
        // For full admin SDK, set FIREBASE_PRIVATE_KEY env var
        // Otherwise uses application default credentials
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      })
    });
  }
  return admin.firestore();
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { token, secret, type, data } = body;

    // Validate shared secret
    if (secret !== process.env.HEALTH_SYNC_SECRET) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid secret' }) };
    }
    if (!token || !type || !data) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing token, type, or data' }) };
    }

    const validTypes = ['heart_rate', 'workout', 'steps', 'sleep', 'body'];
    if (!validTypes.includes(type)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid type. Use: ' + validTypes.join(', ') }) };
    }

    const db = getFirestore();

    // Find user by sync token
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('syncToken', '==', token).limit(1).get();
    if (snapshot.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid sync token' }) };
    }

    const userId = snapshot.docs[0].id;
    const now = new Date().toISOString();

    if (type === 'workout') {
      // Save as a workout in the user's workouts collection
      await db.collection('users').doc(userId).collection('workouts').add({
        name: data.name || 'Synced Workout',
        type: data.type || 'cardio',
        duration: data.duration || 0,
        distance: data.distance || null,
        heartRate: data.avgHr || null,
        calories: data.calories || null,
        notes: 'Synced from health app',
        source: 'health_sync',
        rpe: null,
        date: admin.firestore.Timestamp.fromDate(new Date(data.startTime || now)),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Save to health data subcollection
      await db.collection('users').doc(userId).collection('healthData').add({
        type,
        data,
        receivedAt: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update latest health snapshot on user profile
    const updateFields = {};
    if (type === 'heart_rate' && data.bpm) updateFields['health.latestHr'] = data.bpm;
    if (type === 'steps' && data.count) updateFields['health.latestSteps'] = data.count;
    if (type === 'sleep' && data.duration) updateFields['health.latestSleep'] = data.duration;
    if (type === 'body' && data.restingHr) updateFields['health.restingHr'] = data.restingHr;
    if (type === 'body' && data.vo2max) updateFields['health.vo2max'] = data.vo2max;
    updateFields['health.lastSync'] = now;

    if (Object.keys(updateFields).length > 0) {
      await db.collection('users').doc(userId).update(updateFields);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, type, userId }) };
  } catch (e) {
    console.error('Health sync error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
