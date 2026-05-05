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
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

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
