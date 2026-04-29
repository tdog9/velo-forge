// Netlify function: send a push notification to a TurboPrep user.
//
// POST body:
//   { uid: "...", title: "...", body: "...", data?: { ... } }
//
// Auth: caller must include Authorization: Bearer <Firebase ID token>. The
// caller must be either:
//   - the user themselves (uid === decoded.uid), or
//   - a god-admin (matches the bootstrap email in firestore.rules:isGodAdmin).
//
// Inert until the following env vars are set in Netlify:
//   APNS_KEY_P8           — contents of the AuthKey_XXXXXXXXXX.p8 file
//                           downloaded from Apple Developer → Keys.
//   APNS_KEY_ID           — the 10-char key identifier shown next to the key.
//   APNS_TEAM_ID          — your 10-char Apple Developer Team ID
//                           (developer.apple.com/account → Membership).
//   APNS_BUNDLE_ID        — com.403productions.turboprep
//   APNS_ENV              — "development" (sandbox) or "production".
//   FIREBASE_PROJECT_ID   — already set; reused for admin SDK.
//   FIREBASE_CLIENT_EMAIL — service-account email from the admin SDK JSON.
//   FIREBASE_PRIVATE_KEY  — service-account private key. Newlines are stored
//                           as literal "\n" (env vars can't hold raw newlines)
//                           and unescaped at runtime.
//
// Once those are set, this function pulls the device tokens from
// users/{uid}/devices/* and posts to Apple's APNs HTTP/2 endpoint.

const admin = require('firebase-admin');
const http2 = require('node:http2');
const crypto = require('node:crypto');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

function makeApnsJwt() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const p8 = process.env.APNS_KEY_P8;
  if (!keyId || !teamId || !p8) throw new Error('APNS env not configured');
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signing = `${header}.${payload}`;
  const sig = crypto.createSign('SHA256');
  sig.update(signing);
  sig.end();
  const signed = sig.sign({ key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${signing}.${signed}`;
}

function sendToToken({ token, payload, jwt, bundleId, env }) {
  return new Promise((resolve, reject) => {
    const host = env === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.development.push.apple.com';
    const client = http2.connect(host);
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    });
    req.setEncoding('utf8');
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { client.close(); resolve({ ok: true, body, token }); });
    req.on('error', err => { client.close(); reject(err); });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!admin.apps.length) {
    return { statusCode: 500, body: 'Firebase admin not initialised' };
  }
  // Auth: caller must be the target user or a god-admin.
  const authz = event.headers.authorization || event.headers.Authorization;
  const idToken = (authz || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return { statusCode: 401, body: 'Missing token' };
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return { statusCode: 401, body: 'Invalid token' };
  }
  const isGodAdmin = decoded.email === 'hearn.tenny@icloud.com';
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const broadcast = payload.broadcast === true;
  const title = String(payload.title || 'TurboPrep').slice(0, 80);
  const body  = String(payload.body  || '').slice(0, 240);
  const data  = (payload.data && typeof payload.data === 'object') ? payload.data : {};
  if (!body) return { statusCode: 400, body: 'Missing body' };

  // Category — used for iOS notification grouping (thread-id), per-user
  // opt-out, and rate limiting. Falls back to "general" so legacy callers
  // keep working.
  const category = String(payload.category || data.kind || 'general')
    .toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'general';
  // Map category → APNs thread identifier so iOS groups them on the lock
  // screen + Notification Center.
  const THREAD_PREFIX = 'tp.';
  const threadId = THREAD_PREFIX + category;

  // Simple per-sender rate limit (hourly) — caps how many pushes one user
  // can fire per hour. Doesn't apply to system / scheduled jobs that use
  // a server credential. Stored in Firestore for cross-instance safety.
  // Cap: 60/hour for god-admin (broadcasts), 30/hour for coaches, 10/hour
  // for everyone else.
  const SENDER_CAPS = { admin: 60, coach: 30, member: 10 };
  let senderRole = 'member';
  if (isGodAdmin) senderRole = 'admin';
  else {
    try {
      const profSnap = await admin.firestore().collection('users').doc(decoded.uid).get();
      if (profSnap.exists && profSnap.data().isCoach) senderRole = 'coach';
    } catch (e) {}
  }
  try {
    const rlRef = admin.firestore().collection('push_rate').doc(decoded.uid);
    const result = await admin.firestore().runTransaction(async tx => {
      const snap = await tx.get(rlRef);
      const now = Date.now();
      const data = snap.exists ? snap.data() : {};
      const windowStart = data.windowStart || 0;
      const count = data.count || 0;
      // 1-hour rolling window — reset count if we've crossed an hour.
      if (now - windowStart > 60 * 60 * 1000) {
        tx.set(rlRef, { windowStart: now, count: 1 });
        return { ok: true, remaining: SENDER_CAPS[senderRole] - 1 };
      }
      const cap = SENDER_CAPS[senderRole] || 10;
      if (count >= cap) {
        const retryAfter = Math.ceil((windowStart + 60*60*1000 - now) / 1000);
        return { ok: false, retryAfter };
      }
      tx.update(rlRef, { count: count + 1 });
      return { ok: true, remaining: cap - count - 1 };
    });
    if (!result.ok) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(result.retryAfter) },
        body: JSON.stringify({ error: 'Push rate limit reached', retryAfter: result.retryAfter }),
      };
    }
  } catch (e) {
    // Rate-limit failure shouldn't block delivery — log and continue.
    console.warn('rate-limit check error:', e.message);
  }

  // Resolve target tokens. Broadcast mode (god-admin only) collects every
  // iOS token across users/*/devices. Single-user mode targets one uid.
  let tokens = [];
  if (broadcast) {
    if (!isGodAdmin) return { statusCode: 403, body: 'Broadcast forbidden' };
    try {
      const snap = await admin.firestore().collectionGroup('devices').get();
      tokens = snap.docs
        .map(d => d.data())
        .filter(d => d.platform === 'ios' && d.apnsToken)
        .map(d => d.apnsToken);
    } catch (e) {
      return { statusCode: 500, body: 'Broadcast token lookup failed: ' + e.message };
    }
  } else {
    const targetUid = String(payload.uid || '').trim();
    if (!targetUid) return { statusCode: 400, body: 'Missing uid' };
    if (!isGodAdmin && targetUid !== decoded.uid) {
      return { statusCode: 403, body: 'Forbidden' };
    }
    try {
      const snap = await admin.firestore().collection('users').doc(targetUid).collection('devices').get();
      tokens = snap.docs
        .map(d => d.data())
        .filter(d => d.platform === 'ios' && d.apnsToken)
        .map(d => d.apnsToken);
    } catch (e) {
      return { statusCode: 500, body: 'Token lookup failed: ' + e.message };
    }
  }
  if (tokens.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ delivered: 0, reason: 'no devices' }) };
  }
  // Filter out tokens whose owner has opted out of this category. Each
  // user doc has an optional `notificationPrefs` object: a set of category
  // → boolean. Default-on; set false to mute. Categories: 'general',
  // 'training', 'race_day', 'coach_broadcast', 'team_chat', 'admin-test'.
  // Skip the filter for 'admin-test' (so god-admin can debug).
  if (category !== 'admin-test' && tokens.length > 0) {
    try {
      // Resolve which uid each token belongs to (broadcast collected across
      // users; per-user case is straightforward).
      const filtered = [];
      const ownerUids = broadcast
        ? (await admin.firestore().collectionGroup('devices').get()).docs
            .map(d => ({ uid: d.ref.parent.parent.id, apnsToken: d.data().apnsToken, platform: d.data().platform }))
            .filter(x => x.platform === 'ios' && x.apnsToken && tokens.includes(x.apnsToken))
        : tokens.map(t => ({ uid: payload.uid, apnsToken: t }));
      for (const o of ownerUids) {
        try {
          const profSnap = await admin.firestore().collection('users').doc(o.uid).get();
          const prefs = (profSnap.exists && profSnap.data().notificationPrefs) || {};
          if (prefs[category] === false) continue;
          filtered.push(o.apnsToken);
        } catch (e) { filtered.push(o.apnsToken); }
      }
      tokens = filtered;
    } catch (e) { console.warn('opt-out filter:', e.message); }
  }
  if (tokens.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ delivered: 0, reason: 'no opt-in devices' }) };
  }
  // Construct APNs payload. thread-id groups notifications under the same
  // category in iOS Notification Center. interruption-level varies — quiet
  // categories (training reminders, team chat) use 'passive' so they don't
  // interrupt; race_day and coach_broadcast keep 'active' for visibility.
  const QUIET_CATEGORIES = new Set(['training', 'team_chat', 'workout_logged']);
  const interruption = QUIET_CATEGORIES.has(category) ? 'passive' : 'active';
  const apnsPayload = {
    aps: {
      alert: { title, body },
      sound: QUIET_CATEGORIES.has(category) ? null : 'default',
      badge: 1,
      'mutable-content': 1,
      'thread-id': threadId,
      'interruption-level': interruption,
    },
    ...data,
    category,
  };
  // Strip null fields so APNs doesn't error.
  if (apnsPayload.aps.sound === null) delete apnsPayload.aps.sound;
  let jwt;
  try { jwt = makeApnsJwt(); }
  catch (e) { return { statusCode: 500, body: e.message }; }
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.403productions.turboprep';
  const env = process.env.APNS_ENV || 'development';
  const results = await Promise.allSettled(
    tokens.map(token => sendToToken({ token, payload: apnsPayload, jwt, bundleId, env }))
  );
  const delivered = results.filter(r => r.status === 'fulfilled').length;
  // Refund the rate-limit count on TOTAL delivery failure — was
  // previously consuming the cap on every call regardless of outcome,
  // so a coach hitting an APNs outage 30 times got locked out for an
  // hour despite zero successful pushes. Partial successes still
  // consume one (rate-limiting is by call, not by recipient).
  if (delivered === 0 && tokens.length > 0) {
    try {
      const rlRef = admin.firestore().collection('push_rate').doc(decoded.uid);
      await admin.firestore().runTransaction(async tx => {
        const snap = await tx.get(rlRef);
        const cur = snap.exists ? (snap.data().count || 0) : 0;
        if (cur > 0) tx.update(rlRef, { count: cur - 1 });
      });
    } catch (e) {
      console.warn('rate-limit refund error:', e.message);
    }
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivered, total: tokens.length }),
  };
};
