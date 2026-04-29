// TurboPrep Fitbit Integration Module
// OAuth 2.0 with PKCE; activity sync via Fitbit Web API.
import { escHtml } from './state.js';

let A = { $: (id) => document.getElementById(id) };
export function initFitbit(ctx) { A = ctx; }

const FITBIT_AUTHORIZE = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_API = 'https://api.fitbit.com/1/user/-';
const SCOPES = 'activity profile heartrate location';

// PKCE helpers — generate verifier + S256 challenge
function rand(len) {
  const bytes = new Uint8Array(len);
  (crypto || window.crypto).getRandomValues(bytes);
  return Array.from(bytes, b => ('0' + b.toString(16)).slice(-2)).join('');
}
async function pkceChallenge(verifier) {
  const enc = new TextEncoder().encode(verifier);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function fitbitStartAuth() {
  const clientId = window.FITBIT_CLIENT_ID || A.FITBIT_CLIENT_ID;
  if (!clientId) { A.showToast('Fitbit Client ID not configured.', 'error'); return; }
  const verifier = rand(48);
  const challenge = await pkceChallenge(verifier);
  try { sessionStorage.setItem('tp_fb_verifier', verifier); } catch(e) {}
  const redirect = window.location.origin + '/';
  const url = `${FITBIT_AUTHORIZE}?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(SCOPES)}&code_challenge=${challenge}&code_challenge_method=S256&redirect_uri=${encodeURIComponent(redirect)}&state=fitbit&prompt=consent`;
  window.location.href = url;
}

export async function fitbitHandleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || state !== 'fitbit') return false;
  window.history.replaceState({}, '', window.location.pathname);
  let verifier = '';
  try { verifier = sessionStorage.getItem('tp_fb_verifier') || ''; } catch(e) {}
  try {
    const resp = await fetch('/.netlify/functions/fitbit-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: window.location.origin + '/', code_verifier: verifier }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error('Fitbit token exchange failed: ' + txt.slice(0, 120));
    }
    const data = await resp.json();
    A.fitbitTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user_id: data.user_id,
      scope: data.scope,
    };
    if (A.currentUser && A.db && !A.demoMode) {
      await A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid), { fitbitTokens: A.fitbitTokens });
    }
    A.showToast('Fitbit connected.', 'success');
    await fitbitFetchActivities();
    A.renderProfile?.();
    return true;
  } catch(e) {
    console.error('Fitbit auth error:', e);
    A.showToast('Failed to connect Fitbit.', 'error');
    return true;
  }
}

export async function fitbitRefreshToken() {
  if (!A.fitbitTokens?.refresh_token) return false;
  try {
    const resp = await fetch('/.netlify/functions/fitbit-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: A.fitbitTokens.refresh_token }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    A.fitbitTokens = { ...A.fitbitTokens, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
    if (A.currentUser && A.db && !A.demoMode) {
      await A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid), { fitbitTokens: A.fitbitTokens });
    }
    return true;
  } catch(e) { return false; }
}

async function ensureFreshFitbitToken() {
  if (!A.fitbitTokens?.access_token) return false;
  if (A.fitbitTokens.expires_at && Date.now() / 1000 > A.fitbitTokens.expires_at - 60) {
    return await fitbitRefreshToken();
  }
  return true;
}

export async function fitbitFetchActivities() {
  if (!await ensureFreshFitbitToken()) return [];
  // After-date 30 days back, 20 most recent
  const after = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0];
  try {
    const resp = await fetch(`${FITBIT_API}/activities/list.json?afterDate=${after}&sort=desc&offset=0&limit=20`, {
      headers: { Authorization: 'Bearer ' + A.fitbitTokens.access_token },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    A.fitbitActivities = data.activities || [];
    return A.fitbitActivities;
  } catch(e) { return []; }
}

export function fitbitDisconnect() {
  A.fitbitTokens = null;
  A.fitbitActivities = [];
  if (A.currentUser && A.db && !A.demoMode) {
    A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid), { fitbitTokens: null }).catch(() => {});
  }
  A.showToast('Fitbit disconnected.', 'info');
  A.renderProfile?.();
}

// Convert a Fitbit activity to a TurboPrep workout shape
function fitbitToWorkout(act) {
  // Fitbit activity: { logId, activityName, duration (ms), startTime, distance (km if metric), calories, averageHeartRate, ... }
  const date = act.startTime ? new Date(act.startTime) : new Date();
  const durMin = Math.round((act.duration || 0) / 60000);
  const typeMap = { 'Run': 'run', 'Bike': 'ride', 'Outdoor Bike': 'ride', 'Spinning': 'ride', 'Walk': 'walk', 'Treadmill': 'run', 'Aerobic Workout': 'gym', 'Weights': 'strength' };
  const t = typeMap[act.activityName] || 'gym';
  return {
    name: act.activityName || 'Fitbit Activity',
    type: t,
    duration: durMin,
    // Distance is meaningful for runs/rides/walks; gym/yoga get null so
    // the card doesn't render a misleading "0 km" pill.
    distance: (typeof act.distance === 'number' && act.distance > 0) ? act.distance : null,
    calories: act.calories || 0,
    // schema-wide field is `heartRate`; was `avgHeartRate` so the HR
    // pill never appeared on Fitbit imports.
    heartRate: act.averageHeartRate || null,
    date,
    source: 'fitbit',
    fitbitLogId: String(act.logId),
  };
}

export async function fitbitImportActivity(act) {
  if (!A.currentUser || !A.db || A.demoMode) { A.showToast('Sign in to import.', 'warn'); return; }
  // Skip duplicates by logId
  const existing = (A.userWorkouts || []).find(w => w.fitbitLogId === String(act.logId));
  if (existing) { A.showToast('Already imported.', 'info'); return; }
  const w = fitbitToWorkout(act);
  try {
    await A.addDoc(A.collection(A.db, 'users', A.currentUser.uid, 'workouts'), { ...w, date: A.Timestamp.fromDate(w.date) });
    A.showToast('Imported from Fitbit.', 'success');
  } catch(e) { A.showToast('Import failed.', 'error'); }
}

export function renderFitbitActivities() {
  const acts = A.fitbitActivities || [];
  if (acts.length === 0) return '<div style="font-size:12px;color:var(--muted-fg);padding:8px 0">No recent Fitbit activities.</div>';
  return acts.map(a => {
    const date = a.startTime ? new Date(a.startTime) : null;
    const dateStr = date ? date.toLocaleDateString('en-AU', { day:'numeric', month:'short' }) : '';
    const durMin = Math.round((a.duration || 0) / 60000);
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600">${escHtml(a.activityName || 'Activity')}</div>
        <div style="font-size:11px;color:var(--muted-fg);margin-top:1px">${dateStr} · ${durMin} min${a.distance ? ' · ' + a.distance.toFixed(1) + ' km' : ''}${a.averageHeartRate ? ' · ' + a.averageHeartRate + ' bpm' : ''}</div>
      </div>
      <button class="fitbit-import-btn" data-fb-id="${a.logId}" style="font-size:11px;padding:5px 10px;border-radius:8px;background:rgba(0,182,191,.15);border:1px solid rgba(0,182,191,.35);color:#00b6bf;font-weight:700;cursor:pointer">Import</button>
    </div>`;
  }).join('');
}
