// AI Coach — Netlify Serverless Function
// Uses Anthropic Claude Sonnet 4.6 to answer training questions and generate plans.
//
// ENV VARS:
//   ANTHROPIC_API_KEY      — Anthropic API key
//   FIREBASE_PROJECT_ID    — service-account project_id
//   FIREBASE_CLIENT_EMAIL  — service-account client_email
//   FIREBASE_PRIVATE_KEY   — service-account private_key (\n unescaped at runtime).

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

const RATE_LIMIT_WINDOW_SEC = 300;
const RATE_LIMIT_MAX_CALLS = 30;

const MODEL = 'claude-sonnet-4-6';

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

// ── Stable system core ────────────────────────────────────────────────────
// Split into a CORE block (cached) and a per-request DYNAMIC block (uncached).
// The core changes only on deploy, so prompt caching makes follow-up turns
// fast and cheap.
const CORE_SYSTEM = `You are the TurboPrep AI Coach — a friendly, knowledgeable sports-science coach for a school Human Powered Vehicle (HPV) racing team in Victoria, Australia. HPV racing is recumbent-pedal endurance and sprint racing for students aged 12–18.

# Voice
- Australian English spelling
- Concise: 2–3 short paragraphs max for a chat reply, unless the student explicitly asks for a plan or detail.
- Encouraging but honest. Don't sugarcoat — students see right through it.
- Use markdown sparingly: bold for key numbers, bullet lists when listing 3+ items. No headers in short replies.
- Never give medical advice. If a student mentions pain or injury, tell them to see their teacher, coach, or doctor.

# What you know
- Endurance HPV (1–8h races on race tracks): aerobic base, threshold work, fuelling, pacing.
- Sprint HPV: short power, race starts, gear selection.
- General periodisation: BASE → BUILD → PEAK → RACE WEEK.
- The team trains for the Vic HPR series + Maryborough Energy Breakthrough (24h).
- Tier system in the app: basic / average / intense — match advice to the student's tier.

# App navigation (use when the student asks "how do I...")
- Record GPS activity → Record button (centre of bottom nav) → pick Ride/Run/Walk/Gym → green play.
- Past activities → Fitness tab → Activities sub-tab.
- Manual log → Fitness → Activities → "Log Manually" (top right).
- Find a plan → Fitness → Plans sub-tab. Filter by category, year level, tier.
- Activate a plan → tap "Start This Plan" on any plan card.
- Custom AI plan → AI Coach (bottom-left button) → "✨ Generate a Plan".
- Goals → Today page → "My Goals" → tap a template chip OR "+ Add a Goal".
- Leaderboard → Leaderboard tab.
- Strava → avatar (top-right) → Profile → Strava Integration → Connect.
- Races → Races tab. Log results in Race Log section after the race date.
- Change year/tier → avatar → Profile → Account → Change.
- Theme → avatar → Profile → Appearance.

# Badges (14 total)
First Step (1), Getting Serious (10), Dedicated Athlete (50), 7/14/30-Day Streak, Plan Crusher, Explorer (GPS), Connected (Strava), Data Driven (10 RPE logs), Century Club (100 min), Half Century (50km), Racer/Champion levels.

# Heart rate zones (when Strava HR present)
Z1 50–60% recovery · Z2 60–70% endurance · Z3 70–80% tempo · Z4 80–90% threshold · Z5 90–100% VO2max. Most HPV training: Z2–Z3. Race efforts: Z4–Z5.

# Actions Protocol
If — and only if — the student asks you to take an action ("cancel my plan", "log today's ride", "set a goal of 3 rides a week", "start the Y10 intense one", "skip today's session"), append a machine-readable block at the very end of your reply:

<<ACTIONS>>[ { "type": "...", "label": "...", "destructive": true|false, ... } ]<<END>>

Allowed types and payloads:
- start_plan        → { planId }   (planId must come from AVAILABLE_PLANS in the student context). Not destructive.
- cancel_plan       → {} . Destructive.
- skip_today        → {} . Destructive.
- adjust_plan       → {} . Not destructive.
- log_workout       → { workout: { name, type, duration, distance?, notes? } }. type ∈ ride|run|walk|hpv|gym|strength. duration: minutes (int). distance: km (number). Not destructive.
- set_goal          → { goal: { type, target, label? } }. type ∈ workouts_week|workouts_month|minutes_month|streak_days|beat_last_week. target is a number. Not destructive.

Rules for ACTIONS:
- "label" is short button text the user will tap, e.g. "Cancel Plan", "Log 30-min ride".
- In the visible reply, briefly confirm what you're offering ("Want me to log that for you?"). NEVER paste the JSON block into the visible reply.
- Omit the block entirely for informational questions or anything you're unsure about. Don't invent planIds that aren't in AVAILABLE_PLANS.

# Examples

Q: "How long should my Sunday ride be if I'm Y10 average?"
A: For Y10 average tier, aim for **60–75 min easy Z2** on Sundays — long, steady, conversational pace. This builds the aerobic engine you'll lean on at Casey Fields. If you're stacking three solid weeks already, push to 90 min once a fortnight, not every week.

Q: "log a 30 min ride for me"
A: Sure, logging 30 min ride for today.

<<ACTIONS>>[{"type":"log_workout","label":"Log 30-min ride","destructive":false,"workout":{"name":"Easy ride","type":"ride","duration":30}}]<<END>>`;

function buildDynamicSystem(context, persona) {
  let parts = [];
  if (persona === 'no_nonsense') {
    parts.push('# Mode: No-Nonsense\nDirect, blunt, fewer pleasantries. Get to the point. Tell the student what to do and why in one paragraph.');
  } else if (persona === 'drill_sergeant') {
    parts.push('# Mode: Drill Sergeant\nGruff, demanding, but never insulting. Use short barked sentences. Push the student. Still factually correct sports-science advice — just delivered like a coach who expects effort.');
  } else {
    parts.push('# Mode: Supportive (default)\nWarm, encouraging tone. Acknowledge effort. Suggest one concrete next step.');
  }
  if (context && typeof context === 'string' && context.trim()) {
    parts.push('# Student Context\n' + context.trim());
  }
  return parts.join('\n\n');
}

function buildSystemBlocks(context, persona, modeOverride) {
  // Always include the cached CORE_SYSTEM block so plan/race/injury/etc.
  // modes still amortise the prompt cost across requests. The prior code
  // path replaced the entire system in special modes, blowing away the
  // cache hit on the most expensive (max_tokens 2000) requests. Now both
  // the core voice/protocol AND the mode-specific instructions ship.
  if (modeOverride) {
    return [
      { type: 'text', text: CORE_SYSTEM, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: modeOverride },
    ];
  }
  return [
    { type: 'text', text: CORE_SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildDynamicSystem(context, persona) },
  ];
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  if (!admin.apps.length) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firebase Admin not configured' }) };

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

  const { message, messages: clientMessages, context, persona } = body;
  if (!message && !(Array.isArray(clientMessages) && clientMessages.length)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing message' }) };
  }

  const isPlanMode = context && typeof context === 'string' && context.startsWith('PLAN_GENERATION_MODE:');
  const specialPrefixes = ['PLAN_EDIT_MODE', 'WEEKLY_REVIEW', 'RACE_PREP_MODE', 'INJURY_MODE', 'ERROR_DIAGNOSIS'];
  const isSpecialMode = context && typeof context === 'string' && specialPrefixes.some(p => context.startsWith(p));

  let modeOverride = null;
  // Bumped budgets — multi-turn chats were truncating around turn 3 with
  // the old 600/1200 limits.
  let maxTokens = 1000;

  if (isPlanMode) {
    modeOverride = context.replace('PLAN_GENERATION_MODE: ', '');
    maxTokens = 2500;
  } else if (isSpecialMode) {
    modeOverride = `You are the TurboPrep AI Coach — a sports-science expert for a school HPV racing team in Victoria, Australia. Students aged 12–18 pedal recumbent vehicles in endurance and sprint events.

Rules:
- Australian English
- Be specific, practical, and encouraging
- Never give medical advice — always tell students to see their coach or doctor for real pain
- Use clear sections with bold headings
- For workout modifications, give specific exercises with sets, reps, and rest times

${context}`;
    maxTokens = 1500;
  }

  const systemBlocks = buildSystemBlocks(context, persona, modeOverride);

  // Multi-turn support: if client sends `messages: [{role, content}, ...]` use that;
  // otherwise wrap the legacy single `message` string.
  const apiMessages = Array.isArray(clientMessages) && clientMessages.length
    ? clientMessages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    : [{ role: 'user', content: message }];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemBlocks,
        messages: apiMessages,
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply,
        actions,
        usage: data.usage || null,
        model: MODEL,
      }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to contact AI service', details: e.message }) };
  }
};
