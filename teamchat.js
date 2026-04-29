// Team chat — lightweight in-app feed for a single team. Three message
// kinds: 'chat' (athletes typing), 'workout' (auto-posted when a member
// finishes a workout), 'coach' (head-coach broadcast that can optionally
// trigger a push notification).
//
// Path: /teams/{teamId}/chat/{messageId}
// Schema: { uid, displayName, text, kind, createdAt, broadcastPush?, workoutSummary? }
//
// Mod: a profanity filter blocks the worst words client-side. Server-side
// validation (Firestore rules) enforces uid match + size limit.

import { escHtml } from './state.js';

let A = { $: (id) => document.getElementById(id) };
export function initTeamChat(ctx) { A = ctx; }

let chatUnsub = null;
let chatCache = [];

// Conservative profanity word-list. Substrings on whole-word boundaries.
// Not exhaustive (there's no perfect list) — purpose is "first line of
// defence" for school context, not legal-grade moderation. Coaches review
// the chat in-app and can delete.
const BAD_WORDS = [
  'fuck','shit','bitch','asshole','dick','cunt','prick','wanker','bastard',
  'slut','whore','cock','tits','pussy','retard','faggot','nigger',
];
const BAD_RE = new RegExp('\\b(' + BAD_WORDS.join('|') + ')\\b', 'i');

export function isMessageClean(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.length > 500) return false;
  if (BAD_RE.test(text)) return false;
  return true;
}

/// Subscribe to live chat updates. Returns the unsubscribe fn.
export function subscribeTeamChat(teamId, onUpdate) {
  unsubscribeTeamChat();
  if (!A.db || !teamId) return null;
  try {
    const q = A.query(
      A.collection(A.db, 'teams', teamId, 'chat'),
      A.orderBy('createdAt', 'desc'),
      A.limit(100)
    );
    chatUnsub = A.onSnapshot(q, (snap) => {
      chatCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      try { onUpdate?.(chatCache); } catch(e) {}
    }, (err) => {
      console.warn('chat listener:', err);
    });
    return chatUnsub;
  } catch(e) { console.warn('subscribeTeamChat:', e); return null; }
}

export function unsubscribeTeamChat() {
  if (chatUnsub) { try { chatUnsub(); } catch(e) {} chatUnsub = null; }
}

export function getTeamChatCache() { return chatCache; }

/// Athlete sends a chat message (silent — no push).
export async function sendChatMessage(teamId, text) {
  if (!A.db || !A.currentUser || !teamId) {
    console.warn('[chat] send aborted — missing context', { hasDb: !!A.db, hasUser: !!A.currentUser, teamId });
    A.showToast?.('Not signed in or no team yet.', 'error');
    return false;
  }
  const trimmed = String(text || '').trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 500) {
    A.showToast?.('Message too long (500 max).', 'warn');
    return false;
  }
  // Coaches and admins skip the school-context profanity filter — they
  // need to be able to broadcast plainly without the filter false-flagging
  // ordinary words ("ass" inside "passion", "Scunthorpe", etc.).
  const bypassFilter = !!A.userProfile?.isCoach || !!A.isAdmin;
  if (!bypassFilter && !isMessageClean(trimmed)) {
    A.showToast?.('Message blocked — keep it clean.', 'warn');
    return false;
  }
  try {
    await A.addDoc(A.collection(A.db, 'teams', teamId, 'chat'), {
      uid: A.currentUser.uid,
      displayName: A.userProfile?.displayName || A.currentUser.email || 'Member',
      text: trimmed,
      kind: 'chat',
      createdAt: A.serverTimestamp(),
    });
    return true;
  } catch(e) {
    console.error('[chat] sendChatMessage failed:', e);
    const msg = (e?.code === 'permission-denied')
      ? 'Server rejected the message — your account is not in the team\'s members list. Reload the app.'
      : ('Couldn\'t send: ' + (e?.message || 'unknown error'));
    A.showToast?.(msg, 'error');
    // Throw so the click handler can surface this in the inline error bar.
    const err = new Error(msg);
    err.code = e?.code;
    throw err;
  }
}

/// Coach broadcast — same path, but kind:'coach' AND optionally fires a
/// push notification to all team members.
export async function sendCoachBroadcast(teamId, text, { push = false } = {}) {
  if (!A.db || !A.currentUser || !teamId) {
    console.warn('[chat] coach broadcast aborted — missing context', { hasDb: !!A.db, hasUser: !!A.currentUser, teamId });
    A.showToast?.('Not signed in or no team yet.', 'error');
    return false;
  }
  const trimmed = String(text || '').trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 500) {
    A.showToast?.('Message too long (500 max).', 'warn');
    return false;
  }
  // Coaches always bypass the profanity filter — they're posting under
  // their own name and a school context will moderate by accountability,
  // not by automated word-list (which trips on "Scunthorpe" / "ass" in
  // "passion" anyway).
  try {
    await A.addDoc(A.collection(A.db, 'teams', teamId, 'chat'), {
      uid: A.currentUser.uid,
      displayName: A.userProfile?.displayName || 'Coach',
      text: trimmed,
      kind: 'coach',
      broadcastPush: !!push,
      createdAt: A.serverTimestamp(),
    });
    if (push) {
      // Fire push to all team members via the existing send-push function.
      try {
        const teamSnap = await A.getDoc(A.doc(A.db, 'teams', teamId));
        const members = teamSnap.exists() ? (teamSnap.data().members || []) : [];
        // Server-side rate limiting / per-recipient caps not yet implemented;
        // for now we rely on coach discretion + a confirm() before sending.
        const token = await A.currentUser.getIdToken().catch(() => null);
        for (const uid of members) {
          if (uid === A.currentUser.uid) continue;
          fetch('/.netlify/functions/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({
              uid,
              title: '👋 ' + (A.userProfile?.displayName || 'Coach'),
              body: trimmed.length > 120 ? trimmed.slice(0, 117) + '…' : trimmed,
              category: 'coach_broadcast',
              data: { teamId, threadId: 'team-chat' },
            }),
          }).catch(() => {});
        }
      } catch(e) {}
    }
    return true;
  } catch(e) {
    console.error('[chat] sendCoachBroadcast failed:', e);
    const msg = (e?.code === 'permission-denied')
      ? 'Firestore rejected this — your account is not in the team\'s members[] array. Reload the app to self-heal, or check rules in Firebase Console.'
      : ('Couldn\'t broadcast: ' + (e?.message || 'unknown error'));
    A.showToast?.(msg, 'error');
    const err = new Error(msg);
    err.code = e?.code;
    throw err;
  }
}

/// Auto-post a "X just finished a workout" entry into the team chat. Fired
/// from the workout-save path. Silent (no push). Server-side rules require
/// uid == request.auth.uid so the message is attributed to whoever logged
/// the workout.
export async function postWorkoutToTeamChat(teamId, workout) {
  if (!A.db || !A.currentUser || !teamId || !workout) return;
  try {
    const dur = workout.duration ? Math.round(workout.duration) : null;
    const dist = workout.distance ? Number(workout.distance).toFixed(1) : null;
    const summary = [
      workout.name || 'workout',
      dur ? dur + ' min' : null,
      (dist && Number(dist) > 0) ? dist + ' km' : null,
    ].filter(Boolean).join(' · ');
    await A.addDoc(A.collection(A.db, 'teams', teamId, 'chat'), {
      uid: A.currentUser.uid,
      displayName: A.userProfile?.displayName || A.currentUser.email || 'Member',
      text: 'just finished ' + summary,
      kind: 'workout',
      workoutSummary: {
        name: workout.name || null,
        type: workout.type || null,
        duration: dur,
        distance: dist ? Number(dist) : null,
        hasMap: !!(workout.gpsTrack || workout.routePoints || workout.routeId),
      },
      createdAt: A.serverTimestamp(),
    });
  } catch(e) {
    // Don't fail the workout save if chat post fails — silent best-effort.
    console.warn('postWorkoutToTeamChat:', e);
  }
}

/// Delete a chat message (author or head coach only — Firestore rules enforce).
export async function deleteChatMessage(teamId, messageId) {
  if (!A.db || !teamId || !messageId) return;
  try { await A.deleteDoc(A.doc(A.db, 'teams', teamId, 'chat', messageId)); }
  catch(e) { A.showToast?.('Couldn\'t delete.', 'error'); }
}

// Render the chat thread as an iOS Messages-style feed:
// - day separators (Today / Yesterday / dated)
// - sender-side aligned bubbles (mine right, others left, with avatar)
// - grouping of consecutive same-sender messages within 3 min: only the
//   first shows the author name, only the last shows the timestamp
// - workout posts and coach broadcasts render as centered events (system
//   messages), so they don't compete with the conversational bubbles.
export function renderChatPanel(messages, opts = {}) {
  const isCoach = !!opts.isCoach;
  const myUid = opts.myUid || '';
  if (!messages || messages.length === 0) {
    return `<div class="msg-empty">
      <div class="msg-empty-icon">💬</div>
      <div class="msg-empty-title">No messages yet</div>
      <div class="msg-empty-sub">Be the first to say hi — your team sees it here.</div>
    </div>`;
  }
  // Newest at the bottom — flip order for natural chat feel.
  const ordered = [...messages].reverse();
  const GROUP_WINDOW_MS = 3 * 60 * 1000;
  let html = '';
  let prevDayKey = null;
  let prevUid = null;
  let prevKind = null;
  let prevTs = 0;
  ordered.forEach((m, i) => {
    const date = toDate(m.createdAt);
    const ts = date.getTime();
    const dayKey = isNaN(ts) ? 0 : new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (dayKey !== prevDayKey) {
      html += renderDaySep(date);
      prevDayKey = dayKey;
      prevUid = null;
      prevTs = 0;
    }
    // First in group when sender / kind changes or time gap is too big.
    const isFirstInGroup = m.uid !== prevUid || m.kind !== prevKind || (ts - prevTs) > GROUP_WINDOW_MS;
    // Last in group when next message breaks the group (or there is no next on this day).
    const next = ordered[i + 1];
    let isLastInGroup = true;
    if (next) {
      const nextDate = toDate(next.createdAt);
      const sameDay = !isNaN(nextDate) && nextDate.toDateString() === date.toDateString();
      const nextSame = sameDay && next.uid === m.uid && next.kind === m.kind
        && (nextDate.getTime() - ts) <= GROUP_WINDOW_MS;
      if (nextSame) isLastInGroup = false;
    }
    html += renderChatMessage(m, { isCoach, myUid, date, isFirstInGroup, isLastInGroup });
    prevUid = m.uid;
    prevKind = m.kind;
    prevTs = ts;
  });
  return `<div id="team-chat-list" class="msg-list">${html}</div>`;
}

function toDate(raw) {
  if (!raw) return new Date();
  if (typeof raw.toDate === 'function') return raw.toDate();
  return new Date(raw);
}

function renderDaySep(date) {
  if (isNaN(date)) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const d = new Date(date); d.setHours(0,0,0,0);
  let label;
  if (d.getTime() === today.getTime()) label = 'Today';
  else if (d.getTime() === yest.getTime()) label = 'Yesterday';
  else label = date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  return `<div class="msg-day-sep"><span>${label}</span></div>`;
}

function renderChatMessage(m, { isCoach, myUid, date, isFirstInGroup, isLastInGroup }) {
  const isMine = m.uid === myUid;
  const timeStr = isNaN(date) ? '' : date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  const initials = (m.displayName || '?').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0,2).toUpperCase() || '?';
  const canDelete = isMine || isCoach;
  const id = escHtml(m.id || '');

  // Workout posts: centered event row, like an iMessage system notice.
  if (m.kind === 'workout') {
    const ws = m.workoutSummary || {};
    const route = ws.hasMap ? ' <span class="msg-event-meta">· route saved</span>' : '';
    return `<div class="msg-event msg-event-workout" data-msg-id="${id}">
      <span class="msg-event-actor">${escHtml(m.displayName || 'Member')}</span>
      <span class="msg-event-text">${escHtml(m.text || 'logged a workout')}</span>${route}
    </div>`;
  }

  // Coach broadcast: full-width banner with delete control if allowed.
  if (m.kind === 'coach') {
    const delBtn = canDelete ? `<button class="msg-del chat-msg-del" data-del-id="${id}" aria-label="Delete">×</button>` : '';
    return `<div class="msg-event msg-event-coach" data-msg-id="${id}">
      <div class="msg-event-head">
        <span class="msg-event-actor">${escHtml(m.displayName || 'Coach')}${m.broadcastPush ? ' · pushed' : ''}</span>
        <span class="msg-event-time">${timeStr}</span>
        ${delBtn}
      </div>
      <div class="msg-event-body">${escHtml(m.text || '')}</div>
    </div>`;
  }

  // Standard chat bubble: aligned by sender, grouped, with optional tail.
  const side = isMine ? 'msg-mine' : 'msg-other';
  const groupCls = [isFirstInGroup ? 'msg-first' : '', isLastInGroup ? 'msg-last' : ''].filter(Boolean).join(' ');
  const tailCls = isLastInGroup ? ' msg-bubble-tail' : '';
  const delBtn = canDelete ? `<button class="msg-del chat-msg-del" data-del-id="${id}" aria-label="Delete">×</button>` : '';
  const avatar = !isMine
    ? (isFirstInGroup
        ? `<div class="msg-avatar">${escHtml(initials)}</div>`
        : `<div class="msg-avatar-spacer" aria-hidden="true"></div>`)
    : '';
  const author = !isMine && isFirstInGroup
    ? `<div class="msg-author">${escHtml(m.displayName || 'Member')}</div>`
    : '';
  const meta = isLastInGroup
    ? `<div class="msg-meta">${timeStr}</div>`
    : '';
  return `<div class="msg-row ${side} ${groupCls}" data-msg-id="${id}">
    ${avatar}
    <div class="msg-stack">
      ${author}
      <div class="msg-bubble${tailCls}">${escHtml(m.text || '')}${delBtn}</div>
      ${meta}
    </div>
  </div>`;
}
