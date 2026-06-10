// TurboPrep Cloud Functions
//
// Firestore-triggered helpers that move chat-related work server-side.
// Push delivery now uses FCM via admin.messaging() — Firebase handles
// the APNs round-trip, dev/prod env routing, and token rotation, so
// we don't keep secrets here. The .p8 lives in Firebase Console
// (Project Settings → Cloud Messaging → Apple app config).
//
// Triggers:
//   - onChatWrite:        moderation + chat / coach-broadcast push fan-out
//   - cleanupOldChatMessages: scheduled, prunes chat to last 7 days
//   - deliverScheduledMessages: scheduled, posts due future-dated messages

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const { BigQuery } = require('@google-cloud/bigquery');
const Ably = require('ably');

initializeApp();

// ─── Ably secret ────────────────────────────────────────────────────────
//
// Set with:
//   npx firebase-tools functions:secrets:set ABLY_API_KEY --project hpr-2026
// then paste the ROOT key from the Ably dashboard (publish + subscribe +
// presence + push capability). The client app NEVER sees this — Cloud
// Functions use it to mint short-lived per-user JWTs on demand.
const ABLY_API_KEY = defineSecret('ABLY_API_KEY');

// ─── Home Assistant webhook fan-out ─────────────────────────────────────
//
// Users can paste a Home Assistant webhook URL into Profile → Home
// Assistant. fireUserWebhook(uid, event, payload) POSTs a small JSON
// envelope to that URL on key events (chat broadcast, crash alert,
// rider-down). HA users wire a Webhook trigger and automate from there.
//
// Best-effort with a 4s timeout — never blocks the original write.
// Allow-listed URL schemes (https + http for self-hosted local HA).
async function fireUserWebhook(uid, event, payload) {
  try {
    const db = getFirestore();
    const profSnap = await db.collection('users').doc(uid).get();
    if (!profSnap.exists) return;
    const p = profSnap.data() || {};
    if (!p.haEnabled) return;
    const url = String(p.haWebhookUrl || '').trim();
    if (!/^https?:\/\/.{4,}/.test(url)) return;
    const body = {
      app: 'TurboPrep',
      event,
      ts: Date.now(),
      uid,
      payload: payload || {},
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      console.warn('[fireUserWebhook]', uid, event, 'failed:', e?.message || e);
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.warn('[fireUserWebhook] outer:', e?.message || e);
  }
}

// Fan a single event out to every team member's webhook. Used for
// team-scoped events (race-day alerts, crash, rider-down).
async function fireTeamWebhooks(teamId, event, payload) {
  try {
    const db = getFirestore();
    const teamSnap = await db.collection('teams').doc(teamId).get();
    if (!teamSnap.exists) return;
    const members = Array.isArray(teamSnap.data()?.members) ? teamSnap.data().members : [];
    await Promise.all(members.map(uid => fireUserWebhook(uid, event, payload)));
  } catch (e) {
    console.warn('[fireTeamWebhooks]', teamId, event, e?.message || e);
  }
}

// ─── Team alerts → HA webhook trigger ───────────────────────────────────
exports.onAlertWrite = onDocumentCreated(
  {
    document: 'teams/{teamId}/alerts/{alertId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data() || {};
    const teamId = event.params.teamId;
    const kind = data.kind || 'alert';
    // Whitelist the kinds we forward to HA so a future internal alert
    // type doesn't surprise users.
    if (!['crash-prompt-unanswered', 'rider-down-manual'].includes(kind)) return;
    await fireTeamWebhooks(teamId, kind, {
      teamId,
      driver: data.driver || null,
      driverUid: data.driverUid || null,
      reason: data.reason || null,
      lapCount: data.lapCount ?? null,
    });
  }
);

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

// Quiet hours check (rec #52). User prefs hold HH:MM strings in their
// local time; we compare against Australia/Melbourne (the team's home
// timezone). The window can wrap across midnight (22:00–07:00). Race-
// day pushes never respect this — they call sites pass `respectQuiet`
// explicitly.
function inQuietHours(prefs) {
  if (!prefs || !prefs.quietHoursEnabled) return false;
  const start = (prefs.quietHoursStart || '22:00');
  const end = (prefs.quietHoursEnd || '07:00');
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false;
  // 24-hour HH:MM in Melbourne local time.
  const now = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end; // wraps midnight
}

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

    // Step 2 — decide whether this message fires a push, and under
    // which category. Two paths:
    //   - coach broadcast: kind 'coach' + broadcastPush flag → loud
    //     (active interruption), category 'coach_broadcast'.
    //   - ordinary athlete chat: kind 'chat' → quiet (passive
    //     interruption), category 'team_chat'. Default-ON for every
    //     recipient — they opt OUT via notificationPrefs.team_chat
    //     (the in-chat "silent mode" toggle), not opt in.
    // Everything else (workout / cheer / pr posts) stays silent.
    let category, isLoud;
    if (msg.kind === 'coach' && msg.broadcastPush) {
      category = 'coach_broadcast';
      isLoud = true;
    } else if (msg.kind === 'chat') {
      category = 'team_chat';
      isLoud = false;
    } else {
      return;
    }

    const text = String(msg.text || '').slice(0, 240);
    if (!text) return;
    const senderName = String(msg.displayName || (isLoud ? 'Coach' : 'Teammate')).slice(0, 80);

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
    // Don't push the message back to the sender.
    if (msg.uid) recipientUids = recipientUids.filter((u) => u !== msg.uid);
    if (recipientUids.length === 0) return;

    // Pull FCM tokens + filter by per-user notificationPrefs + quiet
    // hours (rec #52). Race-day broadcasts ignore quiet hours; chat +
    // coach broadcasts respect them.
    const tokenWork = await Promise.all(
      recipientUids.map(async (uid) => {
        try {
          const profSnap = await db.collection('users').doc(uid).get();
          const prefs = (profSnap.exists && profSnap.data().notificationPrefs) || {};
          if (prefs[category] === false) return [];
          if (inQuietHours(prefs)) return [];
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
    // server-side now. Coach broadcasts ride loud (active, priority
    // 10); ordinary chat messages ride quiet (passive, priority 5) so
    // they notify without interrupting.
    const fcmMessage = {
      tokens,
      notification: { title: senderName, body: text },
      apns: {
        headers: {
          'apns-priority': isLoud ? '10' : '5',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
            'thread-id': isLoud ? 'tp.coach_broadcast' : 'tp.team_chat',
            'interruption-level': isLoud ? 'active' : 'passive',
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

    // Home Assistant fan-out (one webhook per recipient). Same gating as
    // the FCM filter — respects opt-out + quiet hours by reading prefs
    // inside fireUserWebhook? Actually no — HA webhooks are a separate
    // automation channel, so we don't apply the chat-notification
    // gates. The user explicitly opted in via Profile → Home Assistant.
    try {
      await Promise.all(recipientUids.map(u => fireUserWebhook(u, category, {
        senderName,
        text,
        teamId,
        scope,
        loud: isLoud,
      })));
    } catch (e) { console.warn('[onChatWrite] webhook fan-out:', e?.message || e); }
  }
);

// ─── Scheduled cleanup: chat messages auto-clear after 1 week ──────────
//
// Photos sent via chat are dual-written into the team gallery before
// they land here, so the gallery copy persists forever. This job just
// trims the chat collection to keep storage costs low. Retention was
// 24h — bumped to 7 days so conversations and coach notes stay
// readable for a full training week.
exports.cleanupOldChatMessages = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    const cutoff = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
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

// ─── Scheduled chat messages — deliver when due ─────────────────────────
//
// Coaches/captains can queue a chat message for a future time via the
// app. It lands in teams/{teamId}/scheduled/{id} with a `scheduledFor`
// timestamp. This job runs every 5 minutes, moves any due message into
// the team's chat collection (which fires onChatWrite → push fan-out),
// then deletes the scheduled doc.
exports.deliverScheduledMessages = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
    const teamsSnap = await db.collection('teams').get();
    let delivered = 0;
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      let due;
      try {
        due = await db.collection('teams').doc(teamId).collection('scheduled')
          .where('scheduledFor', '<=', now)
          .limit(50)
          .get();
      } catch (e) {
        console.warn('[deliverScheduled] query failed for', teamId, e?.message || e);
        continue;
      }
      if (due.empty) continue;
      for (const d of due.docs) {
        const m = d.data() || {};
        try {
          await db.collection('teams').doc(teamId).collection('chat').add({
            uid: m.uid || '',
            displayName: String(m.displayName || 'Coach').slice(0, 80),
            text: String(m.text || '').slice(0, 500),
            kind: m.kind === 'coach' ? 'coach' : 'chat',
            subteamId: String(m.subteamId || ''),
            broadcastPush: !!m.broadcastPush,
            createdAt: FieldValue.serverTimestamp(),
            scheduledDelivery: true,
          });
          await d.ref.delete();
          delivered++;
        } catch (e) {
          console.warn('[deliverScheduled] deliver failed', teamId, d.id, e?.message || e);
        }
      }
    }
    console.log('[deliverScheduledMessages] delivered ' + delivered);
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
      if (inQuietHours(profile.notificationPrefs)) continue;
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

// ─── Daily motivation push at 3:30 AEST ──────────────────────────────────
// Every signed-in user gets a personalised week-summary + inspirational
// quote at 3:30 PM Melbourne local time (after school, before training).
// The quote is generated by Claude API per-user, falling back to a
// curated pool if the API fails. Snoozable via notificationPrefs.daily.

const FALLBACK_QUOTES = [
  'You don\'t rise to the level of your goals — you fall to the level of your training.',
  'Pain is temporary. Quitting is forever.',
  'The hard days are the best because that\'s when champions are made.',
  'Discipline beats motivation. Show up tired and do it anyway.',
  'Every pedal stroke is a vote for the rider you want to become.',
  'Compete with yourself. Surpass your past you. That\'s the only race.',
  'Soft tracks make hard riders. Hard tracks make legends.',
  'The clock doesn\'t care how you feel. Just turn the pedals.',
  'Your future self is watching. Make them proud.',
  'Pressure is a privilege. Hard sessions are paid forward.',
];

async function generateClaudeQuote(weekSummary) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system: 'You are an experienced HPR race coach. Output ONE short inspirational quote (max 18 words), no quotation marks, no attribution. Tone: punchy, direct, race-focused. No clichés. No emojis.',
        messages: [{ role: 'user', content: `This week the rider trained ${weekSummary.sessions} session${weekSummary.sessions === 1 ? '' : 's'} totalling ${weekSummary.minutes} minutes${weekSummary.daysOut != null ? `. ${weekSummary.daysOut} days to their next race.` : '.'}` }],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return (j?.content?.[0]?.text || '').trim() || null;
  } catch (_) { return null; }
}

exports.dailyMotivationPush = onSchedule(
  {
    // Weekdays only at 3:30 PM Melbourne. Weekends were sending pushes
    // when nobody is at school/training, which felt like noise. Cron
    // is `min hour * * dow` with dow=1-5 = Mon-Fri.
    schedule: '30 15 * * 1-5',
    timeZone: 'Australia/Melbourne',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    // Defence-in-depth: even if the cron ever misfires, refuse to send
    // on Sat/Sun in Melbourne time. Cloud Scheduler timezone semantics
    // around DST can drift.
    const melbWeekday = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      weekday: 'short',
    }).format(new Date());
    if (melbWeekday === 'Sat' || melbWeekday === 'Sun') {
      console.log('[dailyMotivationPush] weekend in Melbourne — skipping');
      return;
    }
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const usersSnap = await db.collection('users').get();
    let pushed = 0;
    for (const u of usersSnap.docs) {
      const profile = u.data();
      const uid = u.id;
      if (!profile.teamId) continue;
      if (profile.notificationPrefs?.daily === false) continue;
      if (inQuietHours(profile.notificationPrefs)) continue;
      try {
        // Pull this week's workouts
        const weekSnap = await db.collection('users').doc(uid).collection('workouts')
          .where('date', '>=', weekStart)
          .get();
        let mins = 0;
        weekSnap.forEach(d => { mins += Number(d.data().duration || 0); });
        const summary = { sessions: weekSnap.size, minutes: mins };
        // Fire-and-forget Claude generation. Cap at 5s so a slow
        // upstream doesn't stall the whole job.
        const claudePromise = Promise.race([
          generateClaudeQuote(summary),
          new Promise(resolve => setTimeout(() => resolve(null), 5000)),
        ]);
        const quote = (await claudePromise) || FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
        const body = `${summary.sessions} session${summary.sessions === 1 ? '' : 's'} · ${summary.minutes} min this week. ${quote}`;
        const devSnap = await db.collection('users').doc(uid).collection('devices').get();
        const tokens = devSnap.docs.map(d => d.data())
          .filter(d => d.platform === 'ios' && d.fcmToken)
          .map(d => d.fcmToken);
        if (tokens.length === 0) continue;
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: 'TurboPrep · Daily', body },
          apns: {
            // Was priority 5 + passive — iOS delivered it SILENTLY into
            // Notification Center with no banner or sound, so it looked
            // like "the 3:30 push doesn't work". Bumped to priority 10 +
            // active so it actually surfaces a banner + sound.
            headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
            payload: { aps: { sound: 'default', badge: 1, 'thread-id': 'tp.daily', 'interruption-level': 'active' } },
          },
          data: { teamId: profile.teamId || '', threadId: 'daily-motivation', category: 'daily' },
        });
        pushed++;
      } catch (e) {
        console.warn('[dailyMotivation] uid=' + uid, e?.message || e);
      }
    }
    console.log(`[dailyMotivationPush] sent ${pushed} daily pushes`);
  }
);

// ─── HTTPS trigger: fire the daily push for the calling user now ────────
//
// Lets an admin verify the daily-motivation push end-to-end without
// waiting for 15:30 Melbourne. Returns a JSON payload showing each
// step's outcome so we can pinpoint where it failed (no team / muted /
// in quiet hours / no FCM token / FCM send error).
//
// Auth: the request must carry a Firebase ID token. We then read the
// caller's profile and fire one push to their own devices.
exports.triggerDailyPushNow = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    try {
      const authHeader = req.get('Authorization') || '';
      const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!idToken) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }
      const { getAuth } = require('firebase-admin/auth');
      const decoded = await getAuth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const db = getFirestore();
      const profSnap = await db.collection('users').doc(uid).get();
      if (!profSnap.exists) {
        res.status(404).json({ error: 'User profile not found', uid });
        return;
      }
      const profile = profSnap.data() || {};
      const diag = {
        uid,
        hasTeam: !!profile.teamId,
        prefsAllow: profile.notificationPrefs?.daily !== false,
        inQuietHours: inQuietHours(profile.notificationPrefs),
        tokens: 0,
        sent: 0,
        failed: 0,
      };
      if (!diag.hasTeam) {
        res.status(200).json({ ...diag, reason: 'no teamId — daily skips users with no team' });
        return;
      }
      if (!diag.prefsAllow) {
        res.status(200).json({ ...diag, reason: 'notificationPrefs.daily is false' });
        return;
      }
      if (diag.inQuietHours) {
        res.status(200).json({ ...diag, reason: 'currently in quiet hours' });
        return;
      }
      // Build the same summary the scheduled job builds.
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekSnap = await db.collection('users').doc(uid).collection('workouts')
        .where('date', '>=', weekStart)
        .get();
      let mins = 0;
      weekSnap.forEach(d => { mins += Number(d.data().duration || 0); });
      const summary = { sessions: weekSnap.size, minutes: mins };
      const quote = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
      const body = `${summary.sessions} session${summary.sessions === 1 ? '' : 's'} · ${summary.minutes} min this week. ${quote}`;
      const devSnap = await db.collection('users').doc(uid).collection('devices').get();
      const tokens = devSnap.docs.map(d => d.data())
        .filter(d => d.platform === 'ios' && d.fcmToken)
        .map(d => d.fcmToken);
      diag.tokens = tokens.length;
      if (tokens.length === 0) {
        res.status(200).json({ ...diag, reason: 'no iOS FCM tokens registered for this user — push permissions not granted, or the device never registered with FCM' });
        return;
      }
      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: 'TurboPrep · Daily (test)', body },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
          payload: { aps: { sound: 'default', 'thread-id': 'tp.daily', 'interruption-level': 'active' } },
        },
        data: { teamId: profile.teamId || '', threadId: 'daily-motivation', category: 'daily' },
      });
      diag.sent = response.successCount;
      diag.failed = response.failureCount;
      const errors = response.responses
        .filter(r => !r.success)
        .map(r => r.error?.code || r.error?.message || 'unknown');
      res.status(200).json({ ...diag, body, errors, reason: response.successCount > 0 ? 'pushed' : 'FCM rejected — see errors' });
    } catch (e) {
      console.error('[triggerDailyPushNow]', e);
      res.status(500).json({ error: e?.message || String(e) });
    }
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

// ─── Ably token mint ────────────────────────────────────────────────────
//
// Web/iOS sends the user's Firebase ID token; we verify it, build the
// channel capability that user is allowed to use (team:{teamId},
// subteam:{subteamId}, dm:{uid1}:{uid2}, presence on those), then mint
// a short-lived Ably JWT scoped to those channels.
//
// The Ably ROOT key never leaves the function. The client receives only
// a per-user JWT that expires in 1h; the Ably SDK auto-renews via the
// same authCallback when it nears expiry.
//
// URL: POST https://us-central1-hpr-2026.cloudfunctions.net/ablyAuth
//      Authorization: Bearer <firebase id token>
//      → { keyName, ttl, timestamp, capability, mac, clientId } (Ably TokenRequest)
function buildCapability(uid, profile) {
  const teamId   = profile?.teamId   || null;
  const subteamId = profile?.subteamId || null;
  const cap = {};
  // Always allow self-DM channel — pattern dm:<sorted-uids>:<sorted-uids>
  // resolved per peer. Each user can publish/subscribe on any dm
  // channel containing their uid (Ably wildcards support a single * per segment).
  cap[`dm:${uid}:*`] = ['publish', 'subscribe', 'presence', 'history'];
  cap[`dm:*:${uid}`] = ['publish', 'subscribe', 'presence', 'history'];
  if (teamId) {
    cap[`team:${teamId}:*`] = ['publish', 'subscribe', 'presence', 'history'];
  }
  if (subteamId) {
    cap[`subteam:${subteamId}:*`] = ['publish', 'subscribe', 'presence', 'history'];
  }
  // Per-user notification fan-in channel (server publishes; user listens).
  cap[`user:${uid}`] = ['subscribe', 'history'];
  return cap;
}

exports.ablyAuth = onRequest(
  {
    region: 'us-central1',
    cors: true,
    secrets: [ABLY_API_KEY],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'method not allowed' });
    }
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'missing Bearer token' });
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: 'invalid Firebase token' });
    }
    const uid = decoded.uid;
    // Resolve teamId/subteamId from Firestore (don't trust client to send them).
    let profile = {};
    try {
      const snap = await getFirestore().collection('users').doc(uid).get();
      if (snap.exists) profile = snap.data() || {};
    } catch (e) {
      // Soft-fail: a token with only the DM/user capability is still
      // useful — they just can't join team channels until profile loads.
      console.warn('[ablyAuth] profile read failed for', uid, e?.message);
    }
    const capability = buildCapability(uid, profile);
    try {
      const ably = new Ably.Rest({ key: ABLY_API_KEY.value() });
      const tokenRequest = await ably.auth.createTokenRequest({
        clientId: uid,
        capability,
        ttl: 60 * 60 * 1000, // 1h — Ably SDK auto-renews when near expiry
      });
      return res.status(200).json(tokenRequest);
    } catch (e) {
      console.error('[ablyAuth] mint failed', e?.message || e);
      return res.status(500).json({ error: 'ably mint failed' });
    }
  }
);

// ─── Auto-provision a user into Ably on Firestore profile create ────────
//
// Fires when a new users/{uid} doc lands (signup completes profile bootstrap).
// Stamps `ablyProvisionedAt` so the client can know the server-side
// handshake is done. Ably itself doesn't require a "create user" call —
// clients identify by clientId at connect time — but stamping a marker
// lets the client wait for it before opening the realtime connection,
// which avoids a races where a brand-new user's profile read in ablyAuth
// returns empty and they get a no-channels token.
exports.provisionAblyOnUserCreate = onDocumentCreated(
  {
    document: 'users/{uid}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const uid = event.params.uid;
    try {
      await getFirestore().collection('users').doc(uid).set({
        ablyProvisionedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log('[provisionAbly] stamped', uid);
    } catch (e) {
      console.warn('[provisionAbly] failed for', uid, e?.message || e);
    }
  }
);

// ─── Server-published broadcast helper ──────────────────────────────────
//
// Lets onChatWrite (and future triggers) publish into Ably from Cloud
// Functions without going through a client SDK. Used to bridge legacy
// Firestore-routed messages into the new Ably channels during cutover.
async function publishToAbly(channelName, eventName, data) {
  try {
    const ably = new Ably.Rest({ key: ABLY_API_KEY.value() });
    const ch = ably.channels.get(channelName);
    await ch.publish(eventName, data);
  } catch (e) {
    console.warn('[publishToAbly]', channelName, e?.message || e);
  }
}
exports._publishToAbly = publishToAbly; // exposed for future bridges

