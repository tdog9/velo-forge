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
  // Construct APNs payload. interruption-level "active" guarantees the
  // notification appears on the lock screen (default lock-screen routing).
  // badge:1 puts a red dot on the app icon — iOS shows the count when the
  // user has unread alerts. The native NotificationService delegate on
  // iOS increments/clears it as the user opens the app.
  const apnsPayload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      badge: 1,
      'mutable-content': 1,
      'interruption-level': 'active',
    },
    ...data,
  };
  let jwt;
  try { jwt = makeApnsJwt(); }
  catch (e) { return { statusCode: 500, body: e.message }; }
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.403productions.turboprep';
  const env = process.env.APNS_ENV || 'development';
  const results = await Promise.allSettled(
    tokens.map(token => sendToToken({ token, payload: apnsPayload, jwt, bundleId, env }))
  );
  const delivered = results.filter(r => r.status === 'fulfilled').length;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivered, total: tokens.length }),
  };
};
