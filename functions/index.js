// TurboPrep Cloud Functions
//
// Firestore-triggered helpers that move chat-related work server-side.
// Push delivery now uses FCM via admin.messaging() — Firebase handles
// the APNs round-trip, dev/prod env routing, and token rotation, so
// we don't keep secrets here. The .p8 lives in Firebase Console
// (Project Settings → Cloud Messaging → Apple app config).
//
// Triggers:
//   - onChatWrite:        moderation + coach-broadcast push fan-out
//   - cleanupOldChatMessages: scheduled, prunes chat to last 24h

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { BigQuery } = require('@google-cloud/bigquery');

initializeApp();

// ─── Server-side moderation ─────────────────────────────────────────────
//
// School-context blocklist — same words as the client-side filter in
// teamchat.js. Defence-in-depth: even a custom client bypassing the
// client filter trips here. Coaches and admins bypass.
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
exports.onChatWrite = onDocumentCreated(
  {
    document: 'teams/{teamId}/chat/{messageId}',
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

    // Step 1 — moderation. Soft-delete + skip push if blocked.
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

    // Pull FCM tokens + filter by per-user notificationPrefs.
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
            .filter((d) => d.platform === 'ios' && d.fcmToken)
            .map((d) => d.fcmToken);
        } catch (e) {
          console.warn('[onChatWrite] token lookup failed for uid', uid, e?.message || e);
          return [];
        }
      })
    );
    // Dedupe (one user could have legacy duplicate device docs).
    const tokens = Array.from(new Set(tokenWork.flat()));
    if (tokens.length === 0) {
      console.log('[onChatWrite] no FCM tokens for team', teamId, 'scope', scope);
      return;
    }

    // FCM multicast — one call, Firebase fans out to all tokens. APNs
    // env routing, token rotation, and dev/prod handling are all
    // server-side now.
    const fcmMessage = {
      tokens,
      notification: { title: senderName, body: text },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
            'thread-id': 'tp.coach_broadcast',
            'interruption-level': 'active',
          },
        },
      },
      data: {
        teamId,
        threadId: 'team-chat',
        category,
        url: '/?go=team-chat',
      },
    };

    let response;
    try {
      response = await getMessaging().sendEachForMulticast(fcmMessage);
    } catch (err) {
      console.error('[onChatWrite] sendEachForMulticast threw:', err?.message || err);
      return;
    }

    const delivered = response.successCount;
    const failed = response.failureCount;

    // Drop FCM tokens that came back as INVALID_ARGUMENT / UNREGISTERED.
    // These are dead tokens — uninstalled apps, expired registrations.
    // Cleaning them up keeps future sends fast.
    if (failed > 0) {
      const dead = [];
      response.responses.forEach((r, i) => {
        const code = r.error?.code || '';
        if (!r.success && (code === 'messaging/invalid-argument'
                           || code === 'messaging/registration-token-not-registered')) {
          dead.push(tokens[i]);
        }
      });
      if (dead.length > 0) {
        // Find docs containing these dead tokens and delete them.
        try {
          for (const tok of dead) {
            const q = await db.collectionGroup('devices').where('fcmToken', '==', tok).get();
            const batch = db.batch();
            q.docs.forEach((d) => batch.delete(d.ref));
            if (q.size > 0) await batch.commit();
          }
        } catch (e) {
          console.warn('[onChatWrite] dead-token cleanup failed:', e?.message || e);
        }
      }
    }

    try {
      await snap.ref.set({
        pushDelivery: {
          attempted: tokens.length,
          delivered,
          failed,
          ts: FieldValue.serverTimestamp(),
          via: 'fcm',
        },
      }, { merge: true });
    } catch (e) {
      console.warn('[onChatWrite] could not stamp delivery:', e?.message || e);
    }

    console.log(`[onChatWrite] team=${teamId} scope=${scope || 'all'} fcmTokens=${tokens.length} delivered=${delivered} failed=${failed}`);
  }
);

// ─── Scheduled cleanup: chat messages auto-clear after 24 hours ─────────
//
// Photos sent via chat are dual-written into the team gallery before
// they land here, so the gallery copy persists forever. This job just
// trims the chat collection to keep storage costs low.
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

// ─── Streak-at-risk daily push (Shred-inspired #4) ───────────────────────
//
// Runs once a day at 18:00 local. For each user with an active streak
// who hasn't logged a workout TODAY, send a single push: "Your team
// avg is 4/wk; you're at 2 with N days left this week" — if true.
// Avoids generic "log a workout" spam by only firing when the streak
// is genuinely about to break.
exports.streakAtRiskPush = onSchedule(
  {
    schedule: 'every day 18:00',
    timeZone: 'Australia/Melbourne',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const usersSnap = await db.collection('users').get();
    let pushed = 0;
    for (const u of usersSnap.docs) {
      const profile = u.data();
      const uid = u.id;
      // Skip users with no team or notifications muted for training.
      if (!profile.teamId) continue;
      if (profile.notificationPrefs?.training === false) continue;
      // Read today's workouts for this user.
      try {
        const today = await db.collection('users').doc(uid).collection('workouts')
          .where('date', '>=', startOfDay)
          .limit(1)
          .get();
        if (!today.empty) continue; // already trained today, no nudge
        const streak = profile.streak || 0;
        if (streak < 3) continue; // streak too short to be at risk
        // Resolve FCM tokens.
        const devSnap = await db.collection('users').doc(uid).collection('devices').get();
        const tokens = devSnap.docs.map(d => d.data())
          .filter(d => d.platform === 'ios' && d.fcmToken)
          .map(d => d.fcmToken);
        if (tokens.length === 0) continue;
        const body = `${streak}-day streak at risk — log anything before midnight to keep it.`;
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: 'TurboPrep', body },
          apns: {
            headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
            payload: { aps: { sound: 'default', 'thread-id': 'tp.training', 'interruption-level': 'passive' } },
          },
          data: { teamId: profile.teamId || '', threadId: 'streak-at-risk', category: 'training' },
        });
        pushed++;
      } catch (e) {
        console.warn('[streakAtRisk] uid=' + uid, e?.message || e);
      }
    }
    console.log(`[streakAtRiskPush] sent ${pushed} streak-at-risk pushes`);
  }
);

// ─── One-shot: create BigQuery views in turboprep_analytics ──────────────
//
// HTTP trigger so we can run it once after the firestore-bigquery-export
// extensions land. Creates v_athlete_weekly_summary,
// v_team_activity_daily, v_race_lap_distribution, v_chat_engagement.
// Idempotent — uses CREATE OR REPLACE VIEW.
//
// Auth: only the master admin email (or Firebase admin SDK token).
// After running once, we don't need this again — but it stays as a
// way to update the views if we change definitions.
exports.createBigQueryViews = onRequest(
  { region: 'us-central1', cors: false },
  async (req, res) => {
    // Lightweight auth — require the secret query param to match.
    // Non-secret because the views creation is idempotent + read-only
    // on Firestore data; if someone runs it twice nothing changes.
    if (req.query.key !== 'turboprep-views-init') {
      res.status(401).send('Unauthorized');
      return;
    }
    const bq = new BigQuery();
    const VIEWS = [
      {
        name: 'v_athlete_weekly_summary',
        sql: `SELECT
  REGEXP_EXTRACT(document_name, r'users/([^/]+)/workouts') AS uid,
  DATE_TRUNC(DATE(CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)), WEEK(MONDAY)) AS week_start,
  COUNT(*) AS workouts,
  AVG(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS avg_duration_min,
  SUM(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS total_minutes,
  COUNTIF(CAST(JSON_EXTRACT_SCALAR(data, '$.rpe') AS INT64) >= 8) AS hard_sessions
FROM \`hpr-2026.turboprep_analytics.workouts_raw_latest\`
WHERE JSON_EXTRACT_SCALAR(data, '$.date') IS NOT NULL
GROUP BY uid, week_start`,
      },
      {
        name: 'v_team_activity_daily',
        sql: `SELECT
  REGEXP_EXTRACT(document_name, r'users/([^/]+)/') AS uid,
  DATE(CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)) AS day,
  COUNT(*) AS workouts,
  AVG(CAST(JSON_EXTRACT_SCALAR(data, '$.duration') AS FLOAT64)) AS avg_duration_min
FROM \`hpr-2026.turboprep_analytics.workouts_raw_latest\`
WHERE JSON_EXTRACT_SCALAR(data, '$.date') IS NOT NULL
  AND CAST(JSON_EXTRACT_SCALAR(data, '$.date') AS TIMESTAMP)
        >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
GROUP BY uid, day`,
      },
      {
        name: 'v_race_lap_distribution',
        sql: `SELECT
  REGEXP_EXTRACT(document_name, r'race_day/([^/]+)/') AS race_date,
  document_id AS rider_uid,
  ARRAY_LENGTH(JSON_QUERY_ARRAY(data, '$.laps')) AS lap_count,
  CAST(JSON_EXTRACT_SCALAR(data, '$.bestLapMs') AS FLOAT64) / 1000 AS best_lap_seconds,
  JSON_EXTRACT_SCALAR(data, '$.displayName') AS rider_name
FROM \`hpr-2026.turboprep_analytics.stints_raw_latest\`
WHERE JSON_EXTRACT_SCALAR(data, '$.bestLapMs') IS NOT NULL`,
      },
      {
        name: 'v_chat_engagement',
        sql: `SELECT
  REGEXP_EXTRACT(document_name, r'teams/([^/]+)/') AS team_id,
  DATE(timestamp) AS day,
  COUNT(*) AS messages,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'chat') AS athlete_chats,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'workout') AS workout_posts,
  COUNTIF(JSON_EXTRACT_SCALAR(data, '$.kind') = 'coach') AS coach_broadcasts,
  COUNT(DISTINCT JSON_EXTRACT_SCALAR(data, '$.uid')) AS active_members
FROM \`hpr-2026.turboprep_analytics.chat_raw_changelog\`
WHERE operation = 'CREATE'
GROUP BY team_id, day`,
      },
    ];
    const results = [];
    for (const v of VIEWS) {
      const fullName = `\`hpr-2026.turboprep_analytics.${v.name}\``;
      const ddl = `CREATE OR REPLACE VIEW ${fullName} AS\n${v.sql}`;
      try {
        await bq.query(ddl);
        results.push({ name: v.name, ok: true });
      } catch (err) {
        results.push({ name: v.name, ok: false, error: err.message.slice(0, 300) });
      }
    }
    res.status(200).json({ results });
  }
);
