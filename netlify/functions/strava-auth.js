// Strava OAuth Token Exchange — Netlify Serverless Function
// 
// SETUP:
// 1. Go to https://www.strava.com/settings/api and create an app
// 2. Set "Authorization Callback Domain" to your Netlify domain (e.g. veloforge.netlify.app)
// 3. In Netlify dashboard → Site Settings → Environment Variables, add:
//    - STRAVA_CLIENT_ID (your Strava app's Client ID)
//    - STRAVA_CLIENT_SECRET (your Strava app's Client Secret)
// 4. Copy the Client ID into your index.html where it says STRAVA_CLIENT_ID = ''

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Strava credentials not configured. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to Netlify environment variables.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Build token request
  const tokenParams = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  };

  if (body.code) {
    // Initial authorization code exchange
    tokenParams.code = body.code;
    tokenParams.grant_type = 'authorization_code';
  } else if (body.refresh_token) {
    // Token refresh
    tokenParams.refresh_token = body.refresh_token;
    tokenParams.grant_type = 'refresh_token';
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing code or refresh_token' }) };
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenParams)
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.message || 'Strava token exchange failed', details: data })
      };
    }

    // Return tokens to the client
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        athlete: data.athlete || null
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to contact Strava API', details: e.message })
    };
  }
};
