// Fitbit OAuth Token Exchange — Netlify Serverless Function
//
// SETUP:
// 1. Register an app at https://dev.fitbit.com/apps
//    - OAuth 2.0 Application Type: Server
//    - Callback URL: https://turboprep.app
//    - Default Access Type: Read Only (or Read + Write if you want write back)
// 2. In Netlify → Site Settings → Environment Variables, add:
//    - FITBIT_CLIENT_ID
//    - FITBIT_CLIENT_SECRET
// 3. The client passes the Client ID to the auth URL via window.FITBIT_CLIENT_ID
//    (set in app.js). We never expose the secret to the browser.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
  const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Fitbit credentials not configured. Add FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET to Netlify env vars.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) }; }

  const basicAuth = 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const params = new URLSearchParams();

  if (body.code) {
    params.set('grant_type', 'authorization_code');
    params.set('code', body.code);
    params.set('client_id', CLIENT_ID);
    if (body.redirect_uri) params.set('redirect_uri', body.redirect_uri);
    if (body.code_verifier) params.set('code_verifier', body.code_verifier);
  } else if (body.refresh_token) {
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', body.refresh_token);
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code or refresh_token' }) };
  }

  try {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.errors?.[0]?.message || 'Fitbit token exchange failed', details: data }),
      };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 0),
        user_id: data.user_id || null,
        scope: data.scope || null,
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to contact Fitbit API', details: e.message }) };
  }
};
