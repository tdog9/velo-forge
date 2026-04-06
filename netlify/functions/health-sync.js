// Health Sync Webhook — Firebase REST API
// ENV VARS: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, HEALTH_SYNC_SECRET

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

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!projectId || !apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firebase not configured' }) };
    }

    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // Find user by sync token
    const qr = await fetch(`${base}:runQuery?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          where: { fieldFilter: { field: { fieldPath: 'syncToken' }, op: 'EQUAL', value: { stringValue: token } } },
          limit: 1
        }
      })
    });
    const results = await qr.json();
    if (!results || !results[0] || !results[0].document) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid sync token' }) };
    }

    const userDoc = results[0].document;
    const userId = userDoc.name.split('/').pop();
    const now = new Date().toISOString();

    // Get existing health data from user doc
    const existingHealth = userDoc.fields?.health?.mapValue?.fields || {};

    // Build updated health map
    const healthFields = {};
    // Preserve existing values
    if (existingHealth.latestHr) healthFields.latestHr = existingHealth.latestHr;
    if (existingHealth.latestSteps) healthFields.latestSteps = existingHealth.latestSteps;
    if (existingHealth.latestSleep) healthFields.latestSleep = existingHealth.latestSleep;
    if (existingHealth.restingHr) healthFields.restingHr = existingHealth.restingHr;
    if (existingHealth.vo2max) healthFields.vo2max = existingHealth.vo2max;

    // Apply new data
    if (type === 'heart_rate' && data.bpm) healthFields.latestHr = { integerValue: String(Math.round(data.bpm)) };
    if (type === 'steps' && data.count) healthFields.latestSteps = { integerValue: String(Math.round(data.count)) };
    if (type === 'sleep' && data.duration) healthFields.latestSleep = { doubleValue: parseFloat(data.duration) };
    if (type === 'body' && data.restingHr) healthFields.restingHr = { integerValue: String(Math.round(data.restingHr)) };
    if (type === 'body' && data.vo2max) healthFields.vo2max = { doubleValue: parseFloat(data.vo2max) };
    healthFields.lastSync = { stringValue: now };

    // Update with proper nested map structure
    const ur = await fetch(`${base}/users/${userId}?updateMask.fieldPaths=health&key=${apiKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          health: {
            mapValue: {
              fields: healthFields
            }
          }
        }
      })
    });

    if (!ur.ok) {
      const err = await ur.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Update failed', detail: err }) };
    }

    // Save workout if type is workout
    if (type === 'workout') {
      const wf = {
        name: { stringValue: data.name || 'Synced Workout' },
        type: { stringValue: data.type || 'cardio' },
        duration: { integerValue: String(data.duration || 0) },
        source: { stringValue: 'health_sync' },
        date: { timestampValue: data.startTime || now },
        createdAt: { timestampValue: now }
      };
      if (data.distance) wf.distance = { doubleValue: data.distance };
      if (data.avgHr) wf.heartRate = { integerValue: String(data.avgHr) };
      await fetch(`${base}/users/${userId}/workouts?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: wf })
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, type, userId }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
