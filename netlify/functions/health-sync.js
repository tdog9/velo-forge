// Netlify Function: Health Data Sync Webhook
// NO dependencies — uses Firebase REST API with API key
// Firestore rules must allow public read on syncTokens collection
//
// ENV VARS: FIREBASE_PROJECT_ID, FIREBASE_API_KEY, HEALTH_SYNC_SECRET

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

    // Look up userId from syncTokens collection (publicly readable)
    const tokenDoc = await fetch(`${base}/syncTokens/${token}?key=${apiKey}`);
    if (!tokenDoc.ok) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid sync token' }) };
    }
    const tokenData = await tokenDoc.json();
    const userId = tokenData.fields?.userId?.stringValue;
    if (!userId) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Token not linked to user' }) };
    }

    const now = new Date().toISOString();

    // Build health update fields
    const fields = {};
    if (type === 'heart_rate' && data.bpm) fields['health.latestHr'] = { integerValue: String(data.bpm) };
    if (type === 'steps' && data.count) fields['health.latestSteps'] = { integerValue: String(data.count) };
    if (type === 'sleep' && data.duration) fields['health.latestSleep'] = { doubleValue: data.duration };
    if (type === 'body' && data.restingHr) fields['health.restingHr'] = { integerValue: String(data.restingHr) };
    if (type === 'body' && data.vo2max) fields['health.vo2max'] = { doubleValue: data.vo2max };
    fields['health.lastSync'] = { stringValue: now };

    // Update user health data via public syncTokens write-back
    const updatePath = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
    const updateResp = await fetch(`${base}/syncTokens/${token}?updateMask.fieldPaths=lastData&key=${apiKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 
        ...tokenData.fields,
        lastData: { stringValue: JSON.stringify({ type, data, timestamp: now }) }
      }})
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, type, userId }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
