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
  if (!A.db || !A.currentUser || !teamId) return false;
  const trimmed = String(text || '').trim();
  if (!isMessageClean(trimmed)) {
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
    A.showToast?.('Couldn\'t send: ' + (e?.message || 'unknown'), 'error');
    return false;
  }
}

/// Coach broadcast — same path, but kind:'coach' AND optionally fires a
/// push notification to all team members.
export async function sendCoachBroadcast(teamId, text, { push = false } = {}) {
  if (!A.db || !A.currentUser || !teamId) return false;
  const trimmed = String(text || '').trim();
  if (!isMessageClean(trimmed)) {
    A.showToast?.('Message blocked — keep it clean.', 'warn');
    return false;
  }
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
    A.showToast?.('Couldn\'t broadcast: ' + (e?.message || 'unknown'), 'error');
    return false;
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

/// Render the chat panel HTML.
export function renderChatPanel(messages, opts = {}) {
  const isCoach = !!opts.isCoach;
  const myUid = opts.myUid || '';
  if (!messages || messages.length === 0) {
    return `<div style="padding:30px 20px;text-align:center;color:var(--muted-fg);font-size:13px">
      <div style="font-size:32px;margin-bottom:8px">💬</div>
      <div style="font-weight:600;color:var(--fg);margin-bottom:4px">No messages yet</div>
      <div>Be the first to say hi or log a workout — your team sees it here.</div>
    </div>`;
  }
  // Newest at the bottom — flip order for natural chat feel.
  const ordered = [...messages].reverse();
  const html = ordered.map(m => renderChatMessage(m, { isCoach, myUid })).join('');
  return `<div id="team-chat-list" style="display:flex;flex-direction:column;gap:6px;padding:8px 4px 4px">${html}</div>`;
}

function renderChatMessage(m, { isCoach, myUid }) {
  const isMine = m.uid === myUid;
  const date = m.createdAt?.toDate?.() || (m.createdAt ? new Date(m.createdAt) : new Date());
  const timeStr = isNaN(date) ? '' : date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  const initials = (m.displayName || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const canDelete = isMine || isCoach;

  if (m.kind === 'workout') {
    const ws = m.workoutSummary || {};
    const typeColor = (
      ws.type === 'ride' || ws.type === 'cycle' ? '#3b82f6' :
      ws.type === 'run' ? '#22c55e' :
      ws.type === 'walk' ? '#a855f7' :
      ws.type === 'hpv' ? '#f97316' :
      'var(--muted-fg)'
    );
    return `<div class="chat-msg chat-msg-workout" data-msg-id="${escHtml(m.id || '')}" style="display:flex;gap:8px;padding:8px 10px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.18);border-radius:10px">
      <div class="chat-avatar" style="width:28px;height:28px;border-radius:50%;background:${typeColor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">${escHtml(initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
          <span style="font-size:12px;font-weight:700;color:var(--fg)">${escHtml(m.displayName || 'Member')}</span>
          <span style="font-size:10px;color:#22c55e;font-weight:700;letter-spacing:.04em;text-transform:uppercase">workout</span>
          <span style="font-size:10px;color:var(--muted-fg);margin-left:auto">${timeStr}</span>
        </div>
        <div style="font-size:13px;color:var(--fg);line-height:1.35">${escHtml(m.text || '')}${ws.hasMap ? ' <span style="color:var(--muted-fg);font-size:11px">· 🗺 route saved</span>' : ''}</div>
      </div>
    </div>`;
  }

  if (m.kind === 'coach') {
    return `<div class="chat-msg chat-msg-coach" data-msg-id="${escHtml(m.id || '')}" style="display:flex;gap:8px;padding:8px 10px;background:rgba(249,115,22,.10);border:1px solid rgba(249,115,22,.30);border-radius:10px">
      <div class="chat-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">${escHtml(initials)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px">
          <span style="font-size:12px;font-weight:700;color:var(--primary)">${escHtml(m.displayName || 'Coach')}</span>
          <span style="font-size:10px;color:var(--primary);font-weight:700;letter-spacing:.04em;text-transform:uppercase">coach${m.broadcastPush ? ' · pushed' : ''}</span>
          <span style="font-size:10px;color:var(--muted-fg);margin-left:auto">${timeStr}</span>
          ${canDelete ? `<button class="chat-msg-del" data-del-id="${escHtml(m.id || '')}" aria-label="Delete message" style="background:none;border:none;color:var(--muted-fg);font-size:14px;cursor:pointer;padding:0 2px">×</button>` : ''}
        </div>
        <div style="font-size:13px;color:var(--fg);line-height:1.35;font-weight:500">${escHtml(m.text || '')}</div>
      </div>
    </div>`;
  }

  // Default — plain athlete chat.
  return `<div class="chat-msg" data-msg-id="${escHtml(m.id || '')}" style="display:flex;gap:8px;padding:6px 10px;border-radius:10px${isMine ? ';background:rgba(249,115,22,.06)' : ''}">
    <div class="chat-avatar" style="width:26px;height:26px;border-radius:50%;background:${isMine ? 'var(--primary)' : 'var(--muted)'};color:${isMine ? '#fff' : 'var(--fg)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${escHtml(initials)}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:baseline;gap:6px">
        <span style="font-size:12px;font-weight:600;color:var(--fg)">${escHtml(m.displayName || 'Member')}</span>
        <span style="font-size:10px;color:var(--muted-fg);margin-left:auto">${timeStr}</span>
        ${canDelete ? `<button class="chat-msg-del" data-del-id="${escHtml(m.id || '')}" aria-label="Delete message" style="background:none;border:none;color:var(--muted-fg);font-size:14px;cursor:pointer;padding:0 2px">×</button>` : ''}
      </div>
      <div style="font-size:13px;color:var(--fg);line-height:1.35">${escHtml(m.text || '')}</div>
    </div>
  </div>`;
}
