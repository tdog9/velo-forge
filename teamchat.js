// Team chat — subteam-scoped feed. Three message kinds: 'chat' (athletes
// typing), 'workout' (auto-posted on workout save), 'coach' (head-coach
// broadcast, optionally with a push notification).
//
// Path: /teams/{teamId}/chat/{messageId}
// Schema: { uid, displayName, text, kind, createdAt, subteamId,
//           broadcastPush?, workoutSummary? }
//
// Scope:
//   - subteamId is the conversation channel.
//   - subteamId = '' (or null/missing) means the whole-team channel.
//   - Athletes can only post into their own subteam (or whole-team if they
//     have no subteam yet).
//   - Coaches can post into any subteam OR target the whole team.
//
// Mod: a profanity filter blocks the worst words client-side. Server-side
// validation (Firestore rules) enforces uid match + size limit.

import { escHtml } from './state.js';

let A = { $: (id) => document.getElementById(id) };
export function initTeamChat(ctx) { A = ctx; }

let chatUnsub = null;
let chatCache = [];

// Persist a slim copy of the most-recent messages to localStorage so the
// next chat-tab open paints instantly (no waiting for Firestore's first
// snapshot). Firestore Timestamps are serialised as ms; the renderer's
// toDate() already handles plain numbers.
const CHAT_CACHE_KEY = (teamId) => 'tp_chat_' + teamId;
const CHAT_CACHE_MAX = 100;

export function hydrateChatFromLocal(teamId) {
  if (!teamId) return [];
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY(teamId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      chatCache = arr;
      return arr;
    }
  } catch(_) {}
  return [];
}

function persistChatToLocal(teamId) {
  if (!teamId || !Array.isArray(chatCache) || chatCache.length === 0) return;
  try {
    const slim = chatCache.slice(0, CHAT_CACHE_MAX).map(m => ({
      ...m,
      createdAt: m.createdAt?.toMillis ? m.createdAt.toMillis() : m.createdAt,
    }));
    localStorage.setItem(CHAT_CACHE_KEY(teamId), JSON.stringify(slim));
  } catch(_) {}
}

// Optimistic send — push a placeholder message into the cache so the
// UI can render it immediately while the actual Firestore write is
// in flight. The placeholder gets replaced when the snapshot lands
// (matched on _clientId) or marked failed if the write rejects.
export function addPendingChatMessage(msg) {
  if (!msg || !msg._clientId) return;
  chatCache = [{ ...msg, _pending: true }, ...chatCache];
}

export function markPendingChatFailed(clientId, errorCode) {
  if (!clientId) return;
  const i = chatCache.findIndex(m => m._clientId === clientId);
  if (i >= 0) {
    chatCache[i] = { ...chatCache[i], _pending: false, _failed: true, _failedCode: errorCode || '' };
  }
}

export function removePendingChatMessage(clientId) {
  if (!clientId) return;
  chatCache = chatCache.filter(m => m._clientId !== clientId);
}

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
/// onError(err) is called when Firestore can't keep the listener alive
/// (perms denied, offline, etc.) so the UI can show "Chat connection lost".
export function subscribeTeamChat(teamId, onUpdate, onError) {
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
      try { persistChatToLocal(teamId); } catch(_) {}
      try { onUpdate?.(chatCache); } catch(e) {}
    }, (err) => {
      console.warn('chat listener:', err);
      try { onError?.(err); } catch(e) {}
    });
    return chatUnsub;
  } catch(e) {
    console.warn('subscribeTeamChat:', e);
    try { onError?.(e); } catch(_) {}
    return null;
  }
}

export function unsubscribeTeamChat() {
  if (chatUnsub) { try { chatUnsub(); } catch(e) {} chatUnsub = null; }
}

export function getTeamChatCache() { return chatCache; }

/// Filter chat messages to those visible to a viewer in a given scope.
/// scope === '' means "whole team channel" (athletes' broadcasts default).
/// Coaches with `coachSeesAll` get every message regardless of scope.
export function filterMessagesForScope(messages, { scope = '', coachSeesAll = false } = {}) {
  if (!Array.isArray(messages)) return [];
  if (coachSeesAll && !scope) return messages;
  const want = String(scope || '');
  return messages.filter(m => {
    const ms = String(m.subteamId || '');
    if (coachSeesAll) return ms === want;
    // Athletes: see messages addressed to their subteam OR addressed to
    // the whole team (empty subteamId).
    return ms === want || ms === '';
  });
}

/// Athlete sends a chat message (silent — no push). subteamId scopes the
/// message to a single subteam channel; '' (or null) targets the whole team.
export async function sendChatMessage(teamId, text, { subteamId = '' } = {}) {
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
    // Defensive: trim + always non-empty displayName. Empty strings
    // pass `is string` but trip downstream UI; harden the fallback.
    const safeName = ((A.userProfile?.displayName || A.currentUser.displayName || A.currentUser.email || 'Member').toString().trim()) || 'Member';
    await A.addDoc(A.collection(A.db, 'teams', teamId, 'chat'), {
      uid: A.currentUser.uid,
      displayName: safeName,
      text: trimmed,
      kind: 'chat',
      subteamId: String(subteamId || ''),
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

/// Coach broadcast — kind:'coach' AND optionally fires a push notification.
/// subteamId targets a single subteam channel; '' (or null) targets the
/// whole team. Push goes to recipients of the chosen scope.
export async function sendCoachBroadcast(teamId, text, { push = false, subteamId = '' } = {}) {
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
    const scope = String(subteamId || '');
    const safeName = ((A.userProfile?.displayName || A.currentUser.displayName || 'Coach').toString().trim()) || 'Coach';
    await A.addDoc(A.collection(A.db, 'teams', teamId, 'chat'), {
      uid: A.currentUser.uid,
      displayName: safeName,
      text: trimmed,
      kind: 'coach',
      subteamId: scope,
      broadcastPush: !!push,
      createdAt: A.serverTimestamp(),
    });
    // Push delivery is now handled by the onChatWrite Cloud Function
    // (functions/index.js). It triggers on the chat doc create, reads
    // recipients server-side, fires APNs with the dev/prod fallback,
    // and stamps pushDelivery metadata back on the message. The web
    // client just writes the message — much more reliable than the
    // previous client-driven Netlify hop.
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
/// the workout. Default scope is the whole-team channel (subteamId: '')
/// so the activity feed is visible to every teammate regardless of
/// subteam — chat scoping is for conversational messages, not workouts.
export async function postWorkoutToTeamChat(teamId, workout, { subteamId = '' } = {}) {
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
      subteamId: String(subteamId || ''),
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
    // Don't fail the workout save if chat post fails — but DO surface why
    // it didn't make it to chat so the user isn't left wondering. The
    // common cause is membership drift (uid not in team.members[]); other
    // failures usually mean rules haven't been deployed.
    console.warn('postWorkoutToTeamChat:', e);
    const msg = (e?.code === 'permission-denied')
      ? 'Workout saved, but team chat post was blocked — your account isn\'t in the team\'s members list. Reload the app.'
      : ('Workout saved. Couldn\'t post to team chat: ' + (e?.message || 'unknown error'));
    try { A.showToast?.(msg, 'warn'); } catch(_) {}
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
  // Dedupe: drop pending messages that match a real (non-pending)
  // message with the same uid + text. The real one wins because it
  // has a Firestore-assigned id and timestamp.
  const realKeys = new Set(
    (messages || []).filter(m => !m._clientId)
      .map(m => `${m.uid}|${(m.text || '').trim()}`)
  );
  messages = (messages || []).filter(m => {
    if (m._clientId) {
      const key = `${m.uid}|${(m.text || '').trim()}`;
      if (realKeys.has(key)) return false;
    }
    return true;
  });
  if (!messages || messages.length === 0) {
    return `<div class="msg-empty">
      <svg class="msg-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
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
  // Pull the sender's photoURL from the team-members cache. Falls back to
  // the initials avatar when no photo is set.
  let photoUrl = '';
  try {
    const members = (typeof A !== 'undefined' && A.teamMembers) ? A.teamMembers : (window._tpTeamMembers || []);
    const sender = (Array.isArray(members) ? members : []).find(mem => mem.uid === m.uid);
    if (sender?.photoURL) photoUrl = sender.photoURL;
  } catch(_) {}
  const canDelete = isMine || isCoach;
  const id = escHtml(m.id || '');

  // Workout posts: centered event row, like an iMessage system notice.
  if (m.kind === 'workout') {
    const ws = m.workoutSummary || {};
    const route = ws.hasMap ? ' <span class="msg-event-meta">· route saved</span>' : '';
    return `<div class="msg-event msg-event-workout" data-msg-id="${id}">
      <span class="msg-event-tag">Workout</span>
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
  const stateCls = m._failed ? ' msg-failed' : (m._pending ? ' msg-pending' : '');
  const groupCls = [isFirstInGroup ? 'msg-first' : '', isLastInGroup ? 'msg-last' : '', stateCls.trim()].filter(Boolean).join(' ');
  const tailCls = isLastInGroup ? ' msg-bubble-tail' : '';
  const delBtn = canDelete ? `<button class="msg-del chat-msg-del" data-del-id="${id}" aria-label="Delete">×</button>` : '';
  const stateIndicator = m._failed
    ? '<span class="msg-state msg-state-failed" title="Send failed">!</span>'
    : (m._pending ? '<span class="msg-state msg-state-pending" title="Sending…"></span>' : '');
  const avatar = !isMine
    ? (isFirstInGroup
        ? (photoUrl
            ? `<div class="msg-avatar"><img src="${escHtml(photoUrl)}" alt="${escHtml(m.displayName || 'Member')}"></div>`
            : `<div class="msg-avatar">${escHtml(initials)}</div>`)
        : `<div class="msg-avatar-spacer" aria-hidden="true"></div>`)
    : '';
  const author = !isMine && isFirstInGroup
    ? `<div class="msg-author">${escHtml(m.displayName || 'Member')}</div>`
    : '';
  const meta = isLastInGroup
    ? `<div class="msg-meta">${timeStr}</div>`
    : '';
  // Moderated/deleted messages render as a centered notice so the
  // thread reads naturally with a clear gap, not as a normal bubble.
  if (m.deleted === true) {
    return `<div class="msg-event msg-event-moderated" data-msg-id="${id}">
      <span class="msg-event-text">${escHtml(m.deletedReason === 'moderation' ? 'Message removed by moderator' : 'Message deleted')}</span>
    </div>`;
  }
  // Image-bubble support: messages can carry imageUrl in addition to or
  // instead of text. Tap-to-fullscreen handled by the panel via event
  // delegation on .msg-image elements.
  const hasImg = !!m.imageUrl;
  const imageHtml = hasImg
    ? `<img class="msg-image" src="${escHtml(m.imageUrl)}" alt="" loading="lazy" data-img-src="${escHtml(m.imageUrl)}">`
    : '';
  const textHtml = (m.text || '').trim() ? `<span class="msg-text">${escHtml(m.text)}</span>` : '';
  const bubbleClass = hasImg ? 'msg-bubble msg-bubble-image' : 'msg-bubble';
  const bubbleInner = hasImg && !textHtml
    ? `${imageHtml}${stateIndicator}${delBtn}`
    : `${imageHtml}${textHtml}${stateIndicator}${delBtn}`;
  return `<div class="msg-row ${side} ${groupCls}" data-msg-id="${id}">
    ${avatar}
    <div class="msg-stack">
      ${author}
      <div class="${bubbleClass}${tailCls}">${bubbleInner}</div>
      ${meta}
    </div>
  </div>`;
}
