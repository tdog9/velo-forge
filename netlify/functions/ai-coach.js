// AI Coach — Netlify Serverless Function
// Uses Anthropic Claude API to answer training questions and generate plans
//
// SETUP: Add ANTHROPIC_API_KEY to Netlify environment variables

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { message, context } = body;
  if (!message) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing message' }) };
  }

  const isPlanMode = context && context.startsWith('PLAN_GENERATION_MODE:');

  let systemPrompt;
  let maxTokens;

  if (isPlanMode) {
    systemPrompt = context.replace('PLAN_GENERATION_MODE: ', '');
    maxTokens = 2000;
  } else {
    systemPrompt = `You are the VeloForge AI Coach — a friendly, knowledgeable sports science coach for a school Human Powered Vehicle (HPV) racing team in Victoria, Australia. HPV racing involves students pedalling recumbent vehicles in endurance and sprint events.

Your role:
- Answer training questions in plain, encouraging language suitable for students aged 12-18
- Explain workout plans, exercises, and training concepts
- Give advice on pacing, recovery, nutrition, and race preparation
- Help students choose the right training plan for their year level (Y7-Y12) and fitness tier (basic, average, intense)
- Keep answers concise — 2-4 short paragraphs max
- Use Australian English spelling
- Never give medical advice — if a student mentions pain or injury, tell them to see their teacher, coach, or doctor
- Be motivating and positive, but honest about what it takes to improve

${context ? 'Student context: ' + context : ''}`;
    maxTokens = 500;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: errData.error?.message || 'AI request failed' })
      };
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to contact AI service', details: e.message })
    };
  }
};
