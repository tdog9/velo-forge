// TurboPrep Cloud Functions
//
// Firestore-triggered helpers that move chat-related work server-side.
// The web client just writes to Firestore; these triggers fan out the
// side-effects (push notifications, moderation, summaries).
//
// Why server-side: the previous architecture had the web client calling
// /.netlify/functions/send-push directly after each coach broadcast.
// That hop had several silent-failure modes (auth expiry, Netlify
// cold-start, race with the listener). A Firestore-triggered Function
// is at-least-once-guaranteed by Firebase and runs within ~100ms of
// the doc create.
//
// Secrets used (set via `firebase functions:secrets:set <NAME>`):
//   APNS_KEY_P8     — contents of AuthKey_*.p8 (Apple Developer → Keys)
//   APNS_KEY_ID     — 10-char key identifier
//   APNS_TEAM_ID    — Apple Developer Team ID
//   APNS_BUNDLE_ID  — com.403productions.turboprep
//   APNS_ENV        — "production" or "development"

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const http2 = require('node:http2');
const crypto = require('node:crypto');

initializeApp();

const APNS_KEY_P8    = defineSecret('APNS_KEY_P8');
const APNS_KEY_ID    = defineSecret('APNS_KEY_ID');
const APNS_TEAM_ID   = defineSecret('APNS_TEAM_ID');
const APNS_BUNDLE_ID = defineSecret('APNS_BUNDLE_ID');
const APNS_ENV       = defineSecret('APNS_ENV');

// Build a short-lived JWT for APNs.
function makeApnsJwt(keyId, teamId, p8) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signing = `${header}.${payload}`;
  const sig = crypto.createSign('SHA256');
  sig.update(signing);
  sig.end();
  const signed = sig.sign({ key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${signing}.${signed}`;
}

// Send a single push to APNs. Returns { ok, status, body }. Auto-falls
// back to the OTHER environment on BadDeviceToken — same trick as the
// Netlify send-push function, ports the dev/prod token mismatch fix.
function apnsSend({ token, payload, jwt, bundleId, env }) {
  return new Promise((resolve) => {
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
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
    });
    let status = 0;
    let body = '';
    req.on('response', (h) => { status = h[':status'] || 0; });
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      client.close();
      resolve({ ok: status === 200, status, body });
    });
    req.on('error', (err) => {
      try { client.close(); } catch (_) {}
      resolve({ ok: false, status: 0, body: String(err.message || err) });
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function sendBatchWithFallback({ tokens, payload, jwt, bundleId, env }) {
  const otherEnv = env === 'production' ? 'development' : 'production';
  const first = await Promise.all(
    tokens.map((tok) => apnsSend({ token: tok, payload, jwt, bundleId, env }))
  );
  const fallbackQueue = [];
  first.forEach((r, i) => {
    if (!r.ok && r.status === 400 && /BadDeviceToken/i.test(r.body || '')) {
      fallbackQueue.push({ token: tokens[i], idx: i });
    }
  });
  if (fallbackQueue.length > 0) {
    const fbResults = await Promise.all(
      fallbackQueue.map(({ token }) => apnsSend({ token, payload, jwt, bundleId, env: otherEnv }))
    );
    fallbackQueue.forEach(({ idx }, j) => {
      if (fbResults[j].ok) first[idx] = { ...fbResults[j], fallbackEnv: otherEnv };
    });
  }
  return first;
}

// ─── Server-side moderation ─────────────────────────────────────────────
//
// School-context blocklist — same words as the client-side filter in
// teamchat.js. Runs server-side as a defence-in-depth: even if a custom
// client bypasses the client filter, we catch it here before pushes
// fire. Coaches and admins bypass (same as client). Future: swap the
// substring check for an Anthropic moderation API call.
const BAD_WORDS = [
  'fuck','shit','bitch','asshole','dick','cunt','prick','wanker','bastard',
  'slut','whore','cock','tits','pussy','retard','faggot','nigger',
];
const BAD_RE = new RegExp('\\b(' + BAD_WORDS.join('|') + ')\\b', 'i');

async function isModerationBypass(uid, teamCreatedBy) {
  if (!uid) return false;
  if (uid === teamCreatedBy) return true; // head coach
  try {
    const profSnap = await getFirestore().collection('users').doc(uid).get();
    const prof = profSnap.exists ? profSnap.data() : null;
    if (prof?.isCoach === true) return true;
    if (prof?.isAdmin === true) return true;
  } catch (_) {}
  return false;
}

// ─── Trigger: chat message lifecycle ────────────────────────────────────
//
// Fires whenever a chat message is created. Two responsibilities:
//   1. Server-side moderation: if text trips the blocklist and the
//      sender isn't a coach/admin, soft-delete the message. UI shows
//      "Removed by moderator" using the deleted: true marker.
//   2. Coach-broadcast push delivery: if the message is kind:'coach'
//      with broadcastPush, fire APNs to recipients in scope.
exports.onChatWrite = onDocumentCreated(
  {
    document: 'teams/{teamId}/chat/{messageId}',
    secrets: [APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_ENV],
    region: 'us-central1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const msg = snap.data() || {};
    const { teamId } = event.params;

    const db = getFirestore();
    const teamSnap = await db.collection('teams').doc(teamId).get();
    if (!teamSnap.exists) {
      console.warn('[onChatWrite] team doc missing:', teamId);
      return;
    }
    const team = teamSnap.data() || {};

    // Step 1: moderation. Check the raw text. If it matches the
    // blocklist AND the sender isn't a coach/admin, soft-delete.
    const rawText = String(msg.text || '');
    if (rawText && BAD_RE.test(rawText)) {
      const bypass = await isModerationBypass(msg.uid, team.createdBy);
      if (!bypass) {
        await snap.ref.set({
          deleted: true,
          deletedReason: 'moderation',
          deletedAt: FieldValue.serverTimestamp(),
          text: '[Removed by moderator]',
        }, { merge: true });
        console.log('[onChatWrite] moderated: team=' + teamId + ' uid=' + msg.uid);
        // Don't deliver push for moderated messages.
        return;
      }
    }

    if (msg.kind !== 'coach') return;
    if (!msg.broadcastPush) return;

    const text = String(msg.text || '').slice(0, 240);
    if (!text) return;
    const senderName = String(msg.displayName || 'Coach').slice(0, 80);

    // Resolve recipients: team members or subteam members.
    let recipientUids = Array.isArray(team.members) ? team.members.slice() : [];
    const scope = msg.subteamId || '';
    if (scope) {
      const subs = Array.isArray(team.subteams) ? team.subteams : [];
      const sub = subs.find((s) => s.id === scope);
      if (sub) {
        const ids = new Set(sub.members || []);
        if (sub.subCoachUid) ids.add(sub.subCoachUid);
        recipientUids = Array.from(ids);
      }
    }
    // Don't push the broadcast back to the sender.
    if (msg.uid) recipientUids = recipientUids.filter((u) => u !== msg.uid);
    if (recipientUids.length === 0) return;

    // Pull device tokens + filter by per-user notificationPrefs.
    const category = 'coach_broadcast';
    const tokenWork = await Promise.all(
      recipientUids.map(async (uid) => {
        try {
          const profSnap = await db.collection('users').doc(uid).get();
          const prefs = (profSnap.exists && profSnap.data().notificationPrefs) || {};
          if (prefs[category] === false) return [];
          const devSnap = await db.collection('users').doc(uid).collection('devices').get();
          return devSnap.docs
            .map((d) => d.data())
            .filter((d) => d.platform === 'ios' && d.apnsToken)
            .map((d) => d.apnsToken);
        } catch (e) {
          console.warn('[onChatWrite] token lookup failed for uid', uid, e?.message || e);
          return [];
        }
      })
    );
    const tokens = tokenWork.flat();
    if (tokens.length === 0) {
      console.log('[onChatWrite] no tokens for team', teamId, 'scope', scope);
      return;
    }

    const jwt = makeApnsJwt(APNS_KEY_ID.value(), APNS_TEAM_ID.value(), APNS_KEY_P8.value());
    const bundleId = APNS_BUNDLE_ID.value();
    const env = APNS_ENV.value() || 'production';

    const apnsPayload = {
      aps: {
        alert: { title: senderName, body: text },
        sound: 'default',
        badge: 1,
        'mutable-content': 1,
        'thread-id': 'tp.coach_broadcast',
        'interruption-level': 'active',
      },
      teamId,
      threadId: 'team-chat',
      category,
    };

    const results = await sendBatchWithFallback({ tokens, payload: apnsPayload, jwt, bundleId, env });
    const delivered = results.filter((r) => r.ok).length;
    const failed = results.length - delivered;

    // Stamp delivery metadata back on the message — handy for diagnostics
    // and for the coach UI to show "delivered to N" later.
    try {
      await snap.ref.set({
        pushDelivery: {
          attempted: results.length,
          delivered,
          failed,
          ts: FieldValue.serverTimestamp(),
          envUsed: env,
        },
      }, { merge: true });
    } catch (e) {
      console.warn('[onChatWrite] could not stamp delivery:', e?.message || e);
    }

    console.log(`[onChatWrite] team=${teamId} scope=${scope || 'all'} tokens=${tokens.length} delivered=${delivered} failed=${failed}`);
  }
);

// ─── Scheduled cleanup: chat messages auto-clear after 24 hours ─────────
//
// Photos sent via chat are dual-written into the team gallery before
// they land here, so the gallery copy persists forever. This job just
// trims the chat collection to keep storage costs low.
//
// Runs every hour. Per run, scans every team's chat subcollection,
// deletes messages whose createdAt is older than 24h, in batches of 400.
// Limit per team per run = 800 deletes to keep the job under the 9-min
// timeout even if a team has months of legacy messages.
exports.cleanupOldChatMessages = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const teamsSnap = await db.collection('teams').get();
    let totalDeleted = 0;
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      let teamDeleted = 0;
      // Loop until either we hit the per-team cap or we run out of
      // expired docs. Firestore caps deleteAll at 500 per batch.
      for (let pass = 0; pass < 2; pass++) {
        const expired = await db
          .collection('teams').doc(teamId).collection('chat')
          .where('createdAt', '<', cutoff)
          .limit(400)
          .get();
        if (expired.empty) break;
        const batch = db.batch();
        expired.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        teamDeleted += expired.size;
        totalDeleted += expired.size;
        if (expired.size < 400) break;
      }
      if (teamDeleted > 0) {
        console.log(`[cleanupOldChatMessages] team=${teamId} deleted=${teamDeleted}`);
      }
    }
    console.log(`[cleanupOldChatMessages] total deleted: ${totalDeleted}`);
  }
);
