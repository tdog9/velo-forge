// Netlify Function: Weather proxy
// Env var required: OPENWEATHER_API_KEY (free at openweathermap.org/api)
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'No API key configured' }) };
  }

  const params = event.queryStringParameters || {};
  const lat = params.lat || '-37.81';
  const lon = params.lon || '144.96';

  try {
    const resp = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
    );
    if (!resp.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Weather API error' }) };
    }
    const data = await resp.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        temp: Math.round(data.main?.temp || 0),
        feels: Math.round(data.main?.feels_like || 0),
        desc: data.weather?.[0]?.description || '',
        icon: data.weather?.[0]?.icon || '01d',
        wind: Math.round((data.wind?.speed || 0) * 3.6),
        humidity: data.main?.humidity || 0,
        city: data.name || ''
      })
    };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: e.message }) };
  }
};
