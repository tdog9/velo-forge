// AI Coach — Netlify Serverless Function
// Uses Anthropic Claude API to answer training questions and generate plans.
//
// ENV VARS:
//   ANTHROPIC_API_KEY         — Anthropic API key
//   FIREBASE_SERVICE_ACCOUNT  — Firebase Admin service account JSON (for token verify + rate limits)

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
}

const ALLOWED_ORIGINS = new Set([
  'https://turboprep.app',
]);

const RATE_LIMIT_WINDOW_SEC = 300; // 5 minutes
const RATE_LIMIT_MAX_CALLS = 30;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://turboprep.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

async function verifyIdToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  try {
    return await admin.auth().verifyIdToken(m[1]);
  } catch {
    return null;
  }
}

async function checkRateLimit(uid) {
  const ref = admin.firestore().collection('rate_limits').doc(uid);
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    const windowStart = data?.windowStart?.toMillis?.() || data?.windowStart || 0;
    const count = data?.count || 0;
    if (now - windowStart > RATE_LIMIT_WINDOW_SEC * 1000) {
      tx.set(ref, { windowStart: new Date(now), count: 1 });
      return { ok: true };
    }
    if (count >= RATE_LIMIT_MAX_CALLS) {
      const retryAfter = Math.ceil((windowStart + RATE_LIMIT_WINDOW_SEC * 1000 - now) / 1000);
      return { ok: false, retryAfter };
    }
    tx.update(ref, { count: count + 1 });
    return { ok: true };
  });
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  if (!admin.apps.length) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firebase Admin not configured (set FIREBASE_SERVICE_ACCOUNT)' }) };

  const decoded = await verifyIdToken(event);
  if (!decoded) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sign in required' }) };

  const rate = await checkRateLimit(decoded.uid);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, 'Retry-After': String(rate.retryAfter) },
      body: JSON.stringify({ error: `Too many requests. Try again in ${rate.retryAfter}s.` }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { message, context } = body;
  if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing message' }) };

  const isPlanMode = context && context.startsWith('PLAN_GENERATION_MODE:');
  const isSpecialMode = context && (
    context.startsWith('PLAN_EDIT_MODE') ||
    context.startsWith('WEEKLY_REVIEW') ||
    context.startsWith('RACE_PREP_MODE') ||
    context.startsWith('INJURY_MODE') ||
    context.startsWith('ERROR_DIAGNOSIS')
  );

  let systemPrompt;
  let maxTokens;

  if (isPlanMode) {
    systemPrompt = context.replace('PLAN_GENERATION_MODE: ', '');
    maxTokens = 2000;
  } else if (isSpecialMode) {
    systemPrompt = `You are the VeloForge AI Coach — a sports science expert for a school HPV (Human Powered Vehicle) racing team in Victoria, Australia. Students aged 12-18 pedal recumbent vehicles in endurance and sprint events.

Rules:
- Use Australian English
- Be specific, practical, and encouraging
- Never give medical advice — always tell students to see their coach or doctor for real pain
- Keep responses well-structured with clear sections
- For workout modifications, give specific exercises with sets, reps, and rest times

${context}`;
    maxTokens = 1000;
  } else {
    systemPrompt = `You are the VeloForge AI Coach — a friendly, knowledgeable sports science coach for a school Human Powered Vehicle (HPV) racing team in Victoria, Australia. HPV racing involves students pedalling recumbent vehicles in endurance and sprint events.

Your role:
- Answer training questions in plain, encouraging language suitable for students aged 12-18
- Explain workout plans, exercises, and training concepts
- Give advice on pacing, recovery, nutrition, and race preparation
- Help students choose the right training plan for their year level (Y7-Y12) and fitness tier (basic, average, intense)
- Help students navigate the VeloForge app by giving clear directions to features
- Keep answers concise — 2-4 short paragraphs max
- Use Australian English spelling
- Never give medical advice — if a student mentions pain or injury, tell them to see their teacher, coach, or doctor
- Be motivating and positive, but honest about what it takes to improve

APP NAVIGATION GUIDE (use when students ask "how do I..." or "where is..."):
- To record a GPS activity: Tap the green Record button in the centre of the bottom nav bar. Choose Ride, Run, Walk, or Gym, then hit the green play button to start tracking.
- To view past activities: Go to Fitness tab (bottom nav) → Activities sub-tab. Tap any card to see the full route map and stats.
- To log a workout manually: Go to Fitness → Activities → tap "Log Manually" in the top right.
- To find a training plan: Go to Fitness → Plans sub-tab. Filter by category (In Vehicle, Floor, Machine), year level, and tier.
- To activate a plan: On any plan card, tap "Start This Plan". Your daily workouts will appear on the Today page.
- To generate a custom AI plan: Tap the purple AI Coach button (bottom left) → tap "✨ Generate a Plan" → choose your options.
- To view AI-generated plans: Go to Fitness → My Plans sub-tab.
- To check your XP and level: Your XP bar is at the top of the Today page. Earn XP by logging workouts, maintaining streaks, and completing plans.
- To set a personal goal: Scroll down on the Today page to "My Goals" → tap "+ Add a Goal".
- To see the team challenge: The challenge scoreboard appears on the Today page below your stats.
- To see the leaderboard: Tap the Leaderboard tab in the bottom nav.
- To connect Strava: Tap your avatar (top right) → Profile → Strava Integration → Connect with Strava.
- To see race events: Tap the Races tab in the bottom nav.
- To log race results: Go to Races tab and scroll to the Race Log section after a race date has passed.
- To change your year level or fitness tier: Tap your avatar → Profile → Account section → tap Change.
- To switch dark/light mode: Tap your avatar → Profile → Appearance → Light Mode toggle.
- To export a training report: Tap your avatar → Profile → Your Stats → Export Training Report.
- To redo the app tutorial: Tap your avatar → Profile → Help → Redo Tutorial.

BADGES: Students earn 14 achievement badges for milestones: First Step (1 workout), Getting Serious (10), Dedicated Athlete (50), 7/14/30-Day Streak, Plan Crusher (complete a plan), Explorer (GPS activity), Connected (Strava sync), Data Driven (10 RPE logs), Century Club (100 min), Half Century (50km), Racer/Champion level (XP). Badges appear on the Today page.

HEART RATE ZONES: If students have Strava data with heart rate, the app calculates 5 zones based on estimated max HR. Zone 1 (50-60% recovery), Zone 2 (60-70% endurance), Zone 3 (70-80% tempo), Zone 4 (80-90% threshold), Zone 5 (90-100% VO2 max). Most HPV training should be in zones 2-3, with race efforts in zones 4-5.

OFF-SEASON & HOLIDAY PLANS: Students can generate off-season plans (fun cross-training like swimming, hiking, yoga) and holiday plans (short 15-20 min bodyweight sessions) through the AI Coach → Generate a Plan menu.

ACTIONS PROTOCOL (follow exactly):
If — and only if — the student asks you to take an action (e.g. "cancel my plan", "start the Y10 intense one", "skip today's session", "log today's ride", "set a goal of 3 rides a week"), append a machine-readable block at the very end of your reply:

<<ACTIONS>>[ { "type": "...", "label": "...", "destructive": true|false, ... } ]<<END>>

Types and payloads:
- "start_plan" — { planId } from AVAILABLE_PLANS in the student context. Not destructive.
- "cancel_plan" — no extra fields. Destructive.
- "skip_today" — no extra fields. Destructive.
- "adjust_plan" — no extra fields. Not destructive.
- "log_workout" — { workout: { name, type, duration, distance?, notes? } }. type is one of: ride, run, walk, hpv, gym, strength. duration in minutes (integer). distance in km (number). Not destructive.
- "set_goal" — { goal: { type, target, label? } }. type is one of: weekly_workouts, weekly_mins, monthly_km, streak_days. target is a number. label is optional plain text. Not destructive.

Rules:
- "label" is short button text (e.g. "Cancel Plan", "Log 30 min ride").
- In the visible reply, briefly confirm what you're offering ("Want me to log that for you?"). Never paste the JSON block into the visible text.
- Omit the block entirely for informational questions or anything you're not sure about. Don't invent planIds that aren't in AVAILABLE_PLANS.

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
    let reply = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

    let actions = [];
    const m = reply.match(/<<ACTIONS>>([\s\S]*?)<<END>>/);
    if (m) {
      try {
        const parsed = JSON.parse(m[1].trim());
        if (Array.isArray(parsed)) {
          const allowed = new Set(['start_plan', 'cancel_plan', 'skip_today', 'adjust_plan', 'log_workout', 'set_goal']);
          actions = parsed.filter(a => {
            if (!a || typeof a !== 'object' || !allowed.has(a.type)) return false;
            if (a.type === 'start_plan' && typeof a.planId !== 'string') return false;
            if (a.type === 'log_workout' && (!a.workout || typeof a.workout !== 'object')) return false;
            if (a.type === 'set_goal' && (!a.goal || typeof a.goal !== 'object')) return false;
            return true;
          });
        }
      } catch {}
      reply = reply.replace(/<<ACTIONS>>[\s\S]*?<<END>>/, '').trim();
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reply, actions }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to contact AI service', details: e.message }) };
  }
};
