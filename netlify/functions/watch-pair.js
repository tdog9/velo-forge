// Watch pairing endpoint — lets the Apple Watch pair directly with a
// user's Firestore identity, NO iPhone WCSession required.
//
// Flow:
//   1. The web app on iPhone (or any browser) writes a doc to
//      `watch_pair_codes/{code}` containing { uid, expiresAt } when
//      the user views Profile → Connect Watch.
//   2. The Watch user types the 6-digit code on the sign-in gate +
//      taps Pair. The Watch makes a single HTTPS POST to this endpoint
//      with { code, deviceId }.
//   3. This function reads the pair-codes doc, validates expiry, and
//      returns the signed-in user's identity. It also records the
//      deviceId in `users/{uid}/watches/{deviceId}` for revocation.
//   4. The Watch saves uid + displayName + email locally and
//      considers itself signed-in. Subsequent calls to /watch-state
//      use the deviceId as auth.
//
// URL: POST /.netlify/functions/watch-pair
// Body: { code: "123456", deviceId: "uuid", deviceName: "Tenny's Watch" }
// Returns: { ok: true, uid, displayName, email } on match
//          { ok: false, error: "..." } on miss / expired / invalid

const admin = require('firebase-admin');

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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  if (!admin.apps.length) return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: 'admin not init' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'bad json' }) };
  }
  const code = String(body.code || '').replace(/\D/g, '').slice(0, 8);
  const deviceId = String(body.deviceId || '').slice(0, 64);
  const deviceName = String(body.deviceName || 'Apple Watch').slice(0, 64);
  if (!code || !deviceId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'missing code or deviceId' }) };
  }

  try {
    const fs = admin.firestore();
    const codeRef = fs.collection('watch_pair_codes').doc(code);
    const snap = await codeRef.get();
    if (!snap.exists) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: 'code not found' }) };
    }
    const data = snap.data() || {};
    const uid = String(data.uid || '');
    const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : Number(data.expiresAt || 0);
    if (!uid) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: 'invalid code' }) };
    }
    // Tightened: reject if expiresAt is missing/zero OR already past.
    // Was `if (expiresAt && expiresAt < Date.now())` — a missing/zero
    // expiresAt would skip the check and let the code live forever,
    // which is worse than rejecting one fresh-but-malformed write.
    if (!expiresAt || expiresAt < Date.now()) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: 'code expired' }) };
    }

    // Look up the user's identity to return to the Watch.
    const userSnap = await fs.collection('users').doc(uid).get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const displayName = String(user.displayName || '').slice(0, 80);
    const email = String(user.email || '').slice(0, 120);

    // Record the watch under the user — we'll use this for /watch-state
    // auth and for revocation. Idempotent merge.
    await fs.collection('users').doc(uid).collection('watches').doc(deviceId).set({
      deviceName,
      pairedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, uid, displayName, email }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: err.message || 'server error' }) };
  }
};
