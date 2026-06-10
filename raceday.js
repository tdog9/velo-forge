// raceday.js — TurboPrep Race Day Mode

let ctx = null;
export function initRaceDay(appCtx) { ctx = appCtx; }

// ── State ───────────────────────────────────────────────────────────────────
let rdd = { active:false, date:null, activatedBy:null, teamId:null, startPoint:null, startPointSet:false };
let rosterData  = [];
let setupFields = [];
// Cleanup hooks for the overlay's live listeners. Populated by
// attachRdOverlayListeners on open; called on close.
let _rdOverlayUnsubs = [];
let todayStints = [];

let stintActive       = false;
let stintStartTime    = null;
let stintPositions    = [];
let stintLaps         = [];
let stintPitStops     = []; // [{ ts: ms, durationMs: 0|null }] — auto-bumped via the pit button on the active-stint screen.
let stintWatchId      = null;
let stintGpsState     = 'idle';   // 'idle' | 'connecting' | 'live' | 'error'
let stintGpsTimeout   = null;     // 15s timeout to surface a "GPS isn't responding" toast
let stintInterval     = null;
let stintLiveInterval = null;
let spectatorUnsub = null;
let moveContinuousStart = null;
let lastLapTime       = null;
let stintMap          = null;
let stintPolyline     = null;
let stintMarker       = null;
let stintWakeLock     = null;  // Strong reference to the wake-lock sentinel so GC doesn't drop it mid-stint.

// GPS dropout tracking (rec #12). A "gap" is recorded whenever more
// than GPS_GAP_THRESHOLD_MS elapses between two onPos samples mid-
// stint. Used to (a) flag low-confidence laps and (b) stamp the stint
// archive with diagnostic data.
let stintGpsGaps        = [];   // [{ startTs, endTs, gapMs }]
let stintLastSampleTs   = 0;
const GPS_GAP_THRESHOLD_MS = 15000;
// Rider-down manual flag (rec #4) — set when the rider taps the
// "Rider down" button. Stamped on the stint record so the post-race
// archive shows the incident clearly.
let stintRiderDownFlag  = null; // null or { ts, reason }
// Pit-window heads-up (rec #9). Set to the stint-start (or last-pit)
// timestamp the cue last fired for, so we voice it once per window.
let stintPitWindowAlertedFor = 0;
// Personal-best lap for this race, fetched at stint start from
// race_archive (rec #8). Used to render continuous gap-to-PB on the
// active-stint sublabel — was previously only shown post-stint.
let stintPbLapMs = null;
// Local persistence keys (rec #5). On cold boot mid-stint we rehydrate
// laps + pit stops + gaps from localStorage so a force-quit doesn't
// destroy in-flight stint data.
const STINT_PERSIST_KEY = 'tp_stint_state_v1';

const LAP_THRESHOLD_M  = 30;   // metres — within this = at start/finish
const MIN_SPEED_MS     = 0.3;  // m/s — below this = stopped
const AUTO_START_SECS  = 450;  // 7 min 30 s of continuous movement
const POSITIONS_CAP    = 3000; // ~50 min at 1Hz, ~2.5h at 0.3Hz — raw trace (rec #15)

// ── Helpers ─────────────────────────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function haversine(lat1,lng1,lat2,lng2) {
  const R=6371000, φ1=lat1*Math.PI/180, φ2=lat2*Math.PI/180,
        Δφ=(lat2-lat1)*Math.PI/180, Δλ=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtMs(ms) {
  const s=Math.floor(ms/1000),m=Math.floor(s/60),sec=s%60;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
function fmtTime(ms) {
  const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
             : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Firestore ────────────────────────────────────────────────────────────────
export async function loadRaceDayState() {
  if (!ctx?.db) return false;
  try {
    const snap = await ctx.getDoc(ctx.doc(ctx.db,'race_day',todayKey()));
    if (snap.exists()) { rdd={...rdd,...snap.data(),date:todayKey()}; return rdd.active; }
  } catch(e) { console.warn('loadRaceDayState:',e); }
  return false;
}
export async function activateRaceDay(raceId, opts = {}) {
  const isMaster = ctx.currentUser?.email?.toLowerCase() === 'hearn.tenny@icloud.com';
  if (!ctx?.userProfile?.isCoach && !isMaster) return false;
  const now = Date.now();
  const data = {
    active: true,
    date: todayKey(),
    activatedBy: ctx.currentUser.uid,
    activatedAt: ctx.serverTimestamp(),
    activatedAtMs: now,
    teamId: ctx.userProfile.teamId||null,
    startPoint: null,
    startPointSet: false,
    raceId: raceId||null,
    // Dry-run mode (rec #1): coach can flip this to true when
    // rehearsing handoffs/pit drills. saveStint reads it to skip the
    // race_archive mirror so the rehearsal doesn't pollute the
    // team's historical record. The race_day stint doc still writes
    // (with dryRun:true stamped) so the live UI works normally.
    dryRun: !!opts.dryRun,
    maxDurationMs: 12*60*60*1000 // 12 hour hard limit (was 25h — too long, watches got stuck)
  };
  try {
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',todayKey()),data);
    rdd={...rdd,...data};
    try { ctx.pushWatchState?.(); } catch(e) {}
    try { updateRaceDayTabBar(true); } catch(e) {}
    try { window.CentreBar?.refresh?.(); } catch(_) {}
    return true;
  } catch(e) { console.warn('activateRaceDay:',e); return false; }
}

// Auto-check: start/end based on race schedule, enforce 25hr limit
export async function checkRaceDaySchedule() {
  if (!ctx?.db) return;
  const today = todayKey();
  const now = new Date();
  const nowMs = Date.now();
  const races = (ctx.getActiveRaces ? ctx.getActiveRaces() : []) || [];
  const todayRace = races.find(r => r.date === today);

  // Parse time from notes e.g. "9am–4pm" or "10am–4pm"
  function parseRaceTime(notes, date) {
    if (!notes) return null;
    const m = notes.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]||'0');
    const ampm = m[3].toLowerCase();
    if (ampm==='pm' && h!==12) h+=12;
    if (ampm==='am' && h===12) h=0;
    const d = new Date(date+'T00:00:00');
    d.setHours(h, min, 0, 0);
    return d;
  }

  function parseRaceEndTime(notes, date) {
    if (!notes) return null;
    // Match end time after dash e.g. "9am–4pm" or "9am-4pm"
    const m = notes.match(/[–\-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]||'0');
    const ampm = m[3].toLowerCase();
    if (ampm==='pm' && h!==12) h+=12;
    if (ampm==='am' && h===12) h=0;
    const d = new Date(date+'T00:00:00');
    d.setHours(h, min, 0, 0);
    return d;
  }

  try {
    const snap = await ctx.getDoc(ctx.doc(ctx.db,'race_day',today));
    const rd = snap.exists() ? snap.data() : null;

    // Auto-start if race starts now (within 5 min window) and not already active
    if (todayRace && !rd?.active) {
      const startTime = parseRaceTime(todayRace.notes, today);
      if (startTime) {
        const diff = Math.abs(nowMs - startTime.getTime());
        if (diff < 5*60*1000 && nowMs >= startTime.getTime()) {
          await activateRaceDay(todayRace.id);
          console.log('[RaceDay] Auto-activated for', todayRace.name);
          return;
        }
      }
    }

    // Auto-end if race end time reached OR 25hr limit exceeded
    if (rd?.active) {
      let shouldEnd = false;

      // 12hr hard limit
      if (rd.activatedAtMs && (nowMs - rd.activatedAtMs) > 12*60*60*1000) {
        shouldEnd = true;
        console.log('[RaceDay] 12hr limit reached — auto-ending');
      }

      // Race end time
      if (!shouldEnd && todayRace) {
        const endTime = parseRaceEndTime(todayRace.notes, today);
        if (endTime && nowMs >= endTime.getTime()) {
          shouldEnd = true;
          console.log('[RaceDay] Race end time reached — auto-ending');
        }
      }

      if (shouldEnd) {
        await ctx.updateDoc(ctx.doc(ctx.db,'race_day',today), {active:false, autoEnded:true, autoEndedAt:ctx.serverTimestamp()});
        rdd.active = false;
        try { ctx.pushWatchState?.(); } catch(e) {}
      }
    }
  } catch(e) { console.warn('checkRaceDaySchedule:', e); }
}
export async function deactivateRaceDay() {
  const isMaster = ctx.currentUser?.email?.toLowerCase() === 'hearn.tenny@icloud.com';
  if (!ctx?.userProfile?.isCoach && !isMaster) return false;
  try {
    await ctx.updateDoc(ctx.doc(ctx.db,'race_day',todayKey()),{active:false});
    rdd.active=false;
    try { ctx.pushWatchState?.(); } catch(e) {}
    try { window.CentreBar?.refresh?.(); } catch(_) {}
    return true;
  } catch(e) { return false; }
}
async function setStartPoint(lat,lng) {
  if (rdd.startPointSet) return;
  rdd.startPoint={lat,lng}; rdd.startPointSet=true;
  try { await ctx.updateDoc(ctx.doc(ctx.db,'race_day',rdd.date||todayKey()),{startPoint:{lat,lng},startPointSet:true}); } catch(e){}
}
async function loadRoster() {
  if (!ctx?.db||!rdd.date) return;
  try {
    const s=await ctx.getDoc(ctx.doc(ctx.db,'race_day',rdd.date,'roster','order'));
    if (s.exists()) rosterData=s.data().entries||[];
  } catch(e){}
}
async function saveRoster() {
  if (!ctx?.db||!rdd.date) {
    ctx?.showToast?.('Race day not active — start it first.','warn');
    return false;
  }
  try {
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',rdd.date,'roster','order'),{entries:rosterData,updatedAt:ctx.serverTimestamp()});
    return true;
  } catch(e) {
    console.error('[raceday] saveRoster failed:',e);
    const msg = (e?.code === 'permission-denied')
      ? 'Server rejected the change — only coaches can edit the roster. Make sure you\'re signed in as the team coach.'
      : ('Couldn\'t save roster: ' + (e?.message || 'unknown error'));
    ctx?.showToast?.(msg,'error');
    return false;
  }
}
async function loadSetupFields() {
  if (!ctx?.db||!rdd.date) return;
  try {
    const tid=ctx.userProfile?.teamId||'default';
    const s=await ctx.getDoc(ctx.doc(ctx.db,'race_day',rdd.date,'setup',tid));
    setupFields=s.exists() ? (s.data().fields||defaultSetupFields()) : defaultSetupFields();
  } catch(e){ setupFields=defaultSetupFields(); }
}
function defaultSetupFields() {
  return [
    {id:'seat',     label:'Seat Number',        type:'number', min:0, max:30, value:'', filledBy:'member'},
    {id:'helmet',   label:'Helmet Size',        type:'text',   value:'', filledBy:'member'},
    {id:'gloves',   label:'Glove Size',         type:'text',   value:'', filledBy:'member'},
    // Per-track lap distance (rec #13) — used to compute lap-based
    // pace + speed in post-race analysis. Filled once per race by the
    // coach, persists in the race-day setup doc.
    {id:'lapDistM', label:'Lap Distance (m)',   type:'number', min:50, max:5000, value:'', filledBy:'coach'},
    {id:'notes',    label:'Personal Notes',     type:'text',   value:'', filledBy:'member'},
  ];
}
async function saveSetupFields() {
  if (!ctx?.db||!rdd.date) return;
  const tid=ctx.userProfile?.teamId||'default';
  try { await ctx.setDoc(ctx.doc(ctx.db,'race_day',rdd.date,'setup',tid),{fields:setupFields,updatedAt:ctx.serverTimestamp()}); } catch(e){}
}
async function saveStint(record) {
  if (!ctx?.db || !ctx.currentUser) return;
  // rdd.date can be null if race-day mode opens before loadRaceDayState
  // resolves (cold-boot race). Fall back to today's local date.
  const dk = rdd.date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  // Resolve the race-id stamp so stints become discoverable by race
  // identity, not just by calendar date. Round 2 Casey 2026 ≠ Round 2
  // Casey 2027 — both can be queried separately or together.
  let raceId = rdd.raceId || null;
  let raceYear = null;
  try {
    if (!raceId && Array.isArray(ctx.getActiveRaces?.())) {
      const matched = ctx.getActiveRaces().find(r => r.date === dk);
      if (matched) raceId = matched.id;
    }
    raceYear = parseInt((dk || '').slice(0, 4)) || null;
  } catch(_) {}
  try {
    // Merge with any existing stint doc so we don't clobber laps that
    // came in from the Watch path (app.js writes via merge:true into
    // the same document). Without merge, a phone-side endStint() would
    // wipe lastWatchStintAt + any Watch-recorded laps that arrived
    // first.
    const ref = ctx.doc(ctx.db, 'race_day', dk, 'stints', ctx.currentUser.uid);
    let existing = null;
    try { const snap = await ctx.getDoc(ref); existing = snap.exists() ? snap.data() : null; } catch(e) {}
    const existingLaps = Array.isArray(existing?.laps) ? existing.laps : [];
    const incomingLaps = Array.isArray(record?.laps) ? record.laps : [];
    const lapKey = (l) => (l?.number ?? '') + '|' + (l?.recordedAt ?? l?.duration ?? '');
    const seen = new Set();
    const mergedLaps = [];
    [...existingLaps, ...incomingLaps].forEach(l => {
      const k = lapKey(l);
      if (seen.has(k)) return;
      seen.add(k);
      mergedLaps.push(l);
    });
    const merged = { ...existing, ...record, laps: mergedLaps };
    if (raceId) merged.raceId = raceId;
    if (raceYear) merged.raceYear = raceYear;
    // Stamp dry-run state (rec #1) so post-race analysis can filter.
    if (rdd.dryRun) merged.dryRun = true;
    await ctx.setDoc(ref, merged, { merge: true });
    // Mirror into a top-level race-archive collection keyed by race
    // identity so a future "Casey Fields, all years" view can query
    // across calendar dates without scanning every race_day doc.
    // Dry-run rehearsals don't write to the archive — they'd pollute
    // the historical record (rec #1).
    if (rdd.dryRun) {
      return;
    }
    if (raceId && raceYear) {
      try {
        const archiveRef = ctx.doc(
          ctx.db,
          'race_archive', raceId,
          'years', String(raceYear),
          'stints', ctx.currentUser.uid
        );
        await ctx.setDoc(archiveRef, { ...merged, dateKey: dk }, { merge: true });
      } catch(e) { /* archive mirror is best-effort */ }
    }
  } catch(e) {
    console.warn('saveStint failed:', e);
    try { ctx.showToast?.('Couldn\'t sync stint — your laps are saved locally.', 'warn'); } catch(e2) {}
  }
}
async function loadTodayStints() {
  if (!ctx?.db||!rdd.date) return;
  try {
    const s=await ctx.getDocs(ctx.collection(ctx.db,'race_day',rdd.date,'stints'));
    todayStints=s.docs.map(d=>({uid:d.id,...d.data()}));
  } catch(e){}
}

// ── Public Getters ────────────────────────────────────────────────────────────
export function getRaceDayActive(){ return rdd.active; }
export function getRaceDayData(){ return rdd; }
/** Today's race-day stints — used by the Watch bridge to render a wrist
 *  leaderboard. Each stint shape: { uid, displayName, laps:[{duration,...}] }. */
export function getTodayStints(){ return todayStints; }

// ── Main Overlay ─────────────────────────────────────────────────────────────
/// Attach onSnapshot listeners for the data the race-day overlay shows
/// (root doc, roster, setup, stints). Replaces the one-shot getDoc/
/// getDocs reads so updates from any team member fan out instantly to
/// every device — no more "wait until you reopen for fresh data".
/// Cleanup hooks are pushed into _rdOverlayUnsubs.
function attachRdOverlayListeners() {
  if (!ctx?.db || !ctx.onSnapshot || !rdd.date) return;
  const teardown = (fn) => { try { fn(); } catch(_) {} };
  // Clear any previous listeners (re-open of overlay).
  _rdOverlayUnsubs.forEach(teardown);
  _rdOverlayUnsubs = [];

  // 1. Root race_day/{date} doc — covers active flag + activatedAtMs.
  try {
    const u = ctx.onSnapshot(ctx.doc(ctx.db, 'race_day', rdd.date), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const wasActive = rdd.active;
      Object.assign(rdd, d);
      // If the active flag flipped while we're in the overlay, react.
      if (wasActive && !d.active) {
        // Race day was ended remotely — close the overlay.
        const ov = document.getElementById('raceday-overlay');
        if (ov) ov.remove();
        try { updateRaceDayTabBar(false); } catch(_) {}
      }
    }, (err) => console.warn('[rd-listener] root:', err));
    _rdOverlayUnsubs.push(u);
  } catch(e) { console.warn('[rd-listener] root attach:', e); }

  // 2. Roster — entries[] array. Updates from coach drag-and-drop on
  //    any device propagate live to everyone watching.
  try {
    const u = ctx.onSnapshot(ctx.doc(ctx.db, 'race_day', rdd.date, 'roster', 'order'), (snap) => {
      const entries = (snap.exists() ? snap.data() : {}).entries || [];
      // Avoid stomping local edits in flight — only update if differing.
      const before = JSON.stringify(rosterData.map(r => r.uid || r.name));
      const after  = JSON.stringify(entries.map(r => r.uid || r.name));
      if (before === after) return;
      rosterData = entries;
      // Re-render the roster tab if it's the active one.
      const inner = document.getElementById('rd-inner');
      const active = inner?.querySelector('.rd-tab-btn.active')?.dataset.rdtab;
      if (active === 'roster' && inner) {
        try { showRdTab(inner, 'roster'); } catch(_) {}
      }
    }, (err) => console.warn('[rd-listener] roster:', err));
    _rdOverlayUnsubs.push(u);
  } catch(e) { console.warn('[rd-listener] roster attach:', e); }

  // 3. Setup fields — coach-edited setup notes (gear, tyres, etc.).
  try {
    const tid = ctx.userProfile?.teamId || 'default';
    const u = ctx.onSnapshot(ctx.doc(ctx.db, 'race_day', rdd.date, 'setup', tid), (snap) => {
      const fields = (snap.exists() ? snap.data() : {}).fields;
      if (!fields) return;
      const before = JSON.stringify(setupFields);
      const after  = JSON.stringify(fields);
      if (before === after) return;
      setupFields = fields;
      const inner = document.getElementById('rd-inner');
      const active = inner?.querySelector('.rd-tab-btn.active')?.dataset.rdtab;
      if (active === 'setup' && inner) {
        try { showRdTab(inner, 'setup'); } catch(_) {}
      }
    }, (err) => console.warn('[rd-listener] setup:', err));
    _rdOverlayUnsubs.push(u);
  } catch(e) { console.warn('[rd-listener] setup attach:', e); }

  // 4. Stints subcollection — every driver's stint history. Updates
  //    when any rider finishes a stint.
  try {
    const u = ctx.onSnapshot(ctx.collection(ctx.db, 'race_day', rdd.date, 'stints'), (snap) => {
      try { todayStints = snap.docs.map(d => ({ uid: d.id, ...d.data() })); } catch(_) {}
      const inner = document.getElementById('rd-inner');
      const active = inner?.querySelector('.rd-tab-btn.active')?.dataset.rdtab;
      if ((active === 'stints' || active === 'leaderboard') && inner) {
        try { showRdTab(inner, active); } catch(_) {}
      }
      try { ctx.pushWatchState?.(); } catch(_) {}
    }, (err) => console.warn('[rd-listener] stints:', err));
    _rdOverlayUnsubs.push(u);
  } catch(e) { console.warn('[rd-listener] stints attach:', e); }
}

function detachRdOverlayListeners() {
  _rdOverlayUnsubs.forEach((fn) => { try { fn(); } catch(_) {} });
  _rdOverlayUnsubs = [];
}

export async function openRaceDayOverlay() {
  await Promise.all([loadRoster(),loadSetupFields(),loadTodayStints()]);
  document.getElementById('raceday-overlay')?.remove();
  // Block back/swipe navigation while in race day
  window.history.pushState(null,'',window.location.href);
  const blockNav = ()=>{ window.history.pushState(null,'',window.location.href); };
  window.addEventListener('popstate', blockNav);
  window._rdNavBlock = blockNav;
  // Hide entire normal app — race day is full takeover
  const mainApp=document.getElementById('main-app');
  if (mainApp) mainApp.style.display='none';
  const aiFab=document.getElementById('ai-fab');
  if (aiFab) aiFab.style.display='none';
  const ov=document.createElement('div');
  ov.id='raceday-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:150;background:var(--bg);display:flex;flex-direction:column;overflow:hidden;';
  // Responsive centering on non-phone screens
  const rdStyle=document.createElement('style');
  rdStyle.id='rd-responsive-style';
  rdStyle.textContent=`
    @media(min-width:600px){
      #raceday-overlay{background:rgba(0,0,0,.6)!important;align-items:center;justify-content:center;}
      #rd-inner{max-width:520px;width:100%;height:100%;max-height:900px;border-radius:16px;overflow:hidden;}
    }
    @media(min-width:900px){
      #rd-inner{max-width:680px;max-height:860px;}
    }
    @media(min-width:1200px){
      #rd-inner{max-width:720px;}
    }
  `;
  document.head.appendChild(rdStyle);
  const inner=document.createElement('div');
  inner.id='rd-inner';
  inner.style.cssText='flex:1;background:var(--bg);display:flex;flex-direction:column;overflow:hidden;width:100%;height:100%;';
  ov.appendChild(inner);
  inner.innerHTML=buildOverlayHTML();
  document.body.appendChild(ov);
  bindOverlay(inner);
  showRdTab(inner,'roster');
  // Live listeners — race-day data updates from any team member now
  // fan out to every connected device instantly. Cleaned up in
  // closeOverlay (and via MutationObserver if the overlay is removed
  // by another path).
  attachRdOverlayListeners();
}

function buildOverlayHTML() {
  const isCoach = ctx.userProfile?.isCoach || ctx.currentUser?.email?.toLowerCase() === 'hearn.tenny@icloud.com';
  const teamName = ctx.teamData?.name || ctx.userProfile?.teamName || 'Your Team';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});

  // Find today's race if any
  let raceName = '';
  try {
    const todayISO = today.toISOString().split('T')[0];
    const races = (ctx.getActiveRaces ? ctx.getActiveRaces() : []) || [];
    const todayRace = races.find(r => r.date === todayISO);
    if (todayRace) raceName = todayRace.name;
  } catch(e) {}

  return `
<style>
  @keyframes rdPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
  .rd-tab-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 0;min-width:64px;min-height:44px;border:none;background:none;cursor:pointer;color:var(--muted-fg);transition:color .15s;-webkit-tap-highlight-color:transparent;position:relative}
  .rd-tab-btn.active{color:var(--primary)}
  .rd-tab-btn.active::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--primary)}
  .rd-tab-btn svg{width:22px;height:22px}
  .rd-tab-lbl{font-size:10px;font-weight:600;letter-spacing:.02em}
  .rd-drag-item{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;touch-action:none}
  .rd-drag-item.drag-over{border-color:var(--primary);border-top:2px solid var(--primary)}
</style>

<!-- Dry-run banner (rec #1). Surfaces above the header when the race
     day was activated in rehearsal mode; nothing here writes to the
     race archive, so coaches can drill handoffs without polluting
     historical data. -->
${rdd.dryRun ? `<div style="background:#f59e0b;color:#1a1a1a;text-align:center;padding:4px 10px;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0">Dry run — rehearsal mode, no archive</div>` : ''}
<!-- Header matching app style -->
<header style="height:56px;min-height:calc(56px + env(safe-area-inset-top,0px));padding:0 16px;padding-top:env(safe-area-inset-top,0px);display:flex;align-items:center;gap:10px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0;z-index:30">
  <div style="width:32px;height:32px;border-radius:9px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(var(--primary-rgb),.3)">T</div>
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:800;letter-spacing:.08em;color:var(--primary)">TURBOPREP</div>
    <div style="font-size:10px;color:var(--muted-fg);margin-top:-1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${raceName ? esc(raceName)+' · ' : ''}${esc(teamName)}</div>
  </div>
  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
    <div style="width:7px;height:7px;border-radius:50%;background:var(--destructive);animation:rdPulse 1.4s ease infinite"></div>
    <span style="font-size:11px;font-weight:700;color:var(--destructive)">LIVE</span>
  </div>
  <!-- Simplified header (rec — Team/Today/RaceDay polish pass).
       Was five separate inline buttons (Excel + Share + Hide on
       Watch + Clear + End Race Day) crammed into the header — read
       as "way too much" on a phone. Now: Share stays inline (the
       primary action — spectators need the link), everything else
       collapses behind one "⋯" menu button. Existing handlers find
       their #id-named buttons inside the menu via querySelector so
       no rebinding needed. -->
  <button id="rd-share-btn" aria-label="Share spectator link" style="font-size:11px;padding:6px 12px;border-radius:8px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);color:#3b82f6;font-weight:700;cursor:pointer;margin-left:4px">Share</button>
  <div style="position:relative;margin-left:4px">
    <button id="rd-more-btn" aria-label="More actions" title="More actions" aria-haspopup="menu" aria-expanded="false" style="width:34px;height:30px;border-radius:8px;background:transparent;border:1px solid var(--border);color:var(--muted-fg);font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
    </button>
    <div id="rd-more-menu" role="menu" hidden style="position:absolute;top:calc(100% + 6px);right:0;min-width:200px;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,.45);padding:4px;z-index:170;display:flex;flex-direction:column">
      <button id="rd-excel-btn" role="menuitem" aria-label="Export race day as Excel" style="text-align:left;font-size:12.5px;padding:9px 12px;border-radius:7px;background:transparent;border:none;color:var(--fg);font-weight:600;cursor:pointer">Export race day · Excel</button>
      <button id="rd-watch-dismiss" role="menuitem" aria-label="Hide race mode on my Watch" style="text-align:left;font-size:12.5px;padding:9px 12px;border-radius:7px;background:transparent;border:none;color:var(--fg);font-weight:600;cursor:pointer">Hide race mode on Watch</button>
      ${isCoach ? `
      <div style="height:1px;background:var(--border);margin:3px 6px"></div>
      <button id="rd-clear-history" role="menuitem" style="text-align:left;font-size:12.5px;padding:9px 12px;border-radius:7px;background:transparent;border:none;color:var(--warning, #f59e0b);font-weight:600;cursor:pointer">Clear today's race day</button>
      <button id="rd-end-btn" role="menuitem" style="text-align:left;font-size:12.5px;padding:9px 12px;border-radius:7px;background:transparent;border:none;color:var(--destructive);font-weight:700;cursor:pointer">End race day</button>
      ` : ''}
    </div>
  </div>
</header>

<!-- Scrollable content -->
<div id="rd-content" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px calc(16px + var(--tab-h,72px) + env(safe-area-inset-bottom,0px));"></div>

<!-- Coach FAB — add to roster -->
${isCoach ? `<button id="rd-roster-fab" style="position:fixed;bottom:calc(var(--tab-h,72px) + 12px + env(safe-area-inset-bottom,0px));right:16px;z-index:160;width:48px;height:48px;border-radius:50%;background:var(--primary);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(var(--primary-rgb),.4);-webkit-tap-highlight-color:transparent">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:22px;height:22px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
</button>` : ''}

<!-- Bottom tab bar matching app style -->
<nav style="position:fixed;bottom:0;left:0;right:0;z-index:155;background:rgba(10,11,15,0.99);border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:flex-start;justify-content:space-around;padding:6px 0 calc(6px + env(safe-area-inset-bottom,0px));">
  <button class="rd-tab-btn active" data-rdtab="roster">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    <span class="rd-tab-lbl">Roster</span>
  </button>
  <button class="rd-tab-btn" data-rdtab="stint" style="position:relative">
    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--success),#16a34a);display:flex;align-items:center;justify-content:center;margin:-14px auto 0;box-shadow:0 4px 14px rgba(var(--success-rgb),.4)">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:22px;height:22px"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16" fill="white" stroke="none"/></svg>
    </div>
    <span class="rd-tab-lbl" style="margin-top:4px">Stint</span>
  </button>
  <button class="rd-tab-btn" data-rdtab="setup">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M12 17v4"/></svg>
    <span class="rd-tab-lbl">Setup</span>
  </button>
</nav>`;
}

function bindOverlay(ov) {
  function closeOverlay() {
    document.getElementById('rd-responsive-style')?.remove();
    ov.remove(); // removes full overlay including backdrop
    document.getElementById('rd-roster-fab')?.remove();
    // spectatorUnsub is sometimes a setTimeout id and sometimes a
    // setInterval id; clearTimeout/clearInterval are interchangeable on
    // the same numeric id in browsers but call both to be safe.
    if (spectatorUnsub) { try { if (typeof spectatorUnsub === 'function') spectatorUnsub(); else { try { clearInterval(spectatorUnsub); } catch(e) {} try { clearTimeout(spectatorUnsub); } catch(e) {} } } catch(e) {} spectatorUnsub=null; }
    detachRdOverlayListeners();
    if (window._rdNavBlock) { window.removeEventListener('popstate', window._rdNavBlock); delete window._rdNavBlock; }
    const ma=document.getElementById('main-app');
    if (ma) ma.style.display='flex';
    const af=document.getElementById('ai-fab');
    if (af&&ctx.userProfile) af.style.display='';
  }
  // Belt-and-braces: if the overlay is removed by some other code path
  // (race-day auto-end, watchdog) the popstate listener used to leak
  // forever. Wire a MutationObserver so leaving the overlay always
  // tears down the listener.
  try {
    const mo = new MutationObserver(() => {
      if (!document.body.contains(ov)) {
        if (window._rdNavBlock) { window.removeEventListener('popstate', window._rdNavBlock); delete window._rdNavBlock; }
        if (spectatorUnsub) { try { if (typeof spectatorUnsub === 'function') spectatorUnsub(); else { try { clearInterval(spectatorUnsub); } catch(e) {} try { clearTimeout(spectatorUnsub); } catch(e) {} } } catch(e) {} spectatorUnsub=null; }
        detachRdOverlayListeners();
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true });
  } catch(e) {}

  // Only coaches/admin can end race day — no close for regular users
  // Share spectator link — anyone can open this URL to follow the race
  // without signing in. Build with the team id so it's filtered to this
  // team's drivers.
  // Coach-only "Clear today's race history" button — wipes the
  // active race_day/{date} subcollections (stints, live, setup,
  // roster). Useful for clearing a test/demo run before a real race
  // begins. Stints already mirrored into race_archive are preserved
  // by design (those are the season log).
  {
    const isCoachUser = ctx.userProfile?.isCoach || ctx.currentUser?.email?.toLowerCase() === 'hearn.tenny@icloud.com';
    if (isCoachUser) ov.querySelector('#rd-clear-history')?.addEventListener('click', async () => {
      if (!confirm('Clear today\'s race day data?\n\nThis wipes today\'s stints, live state, roster, and setup so the day can start fresh.\n\nArchived race history (race_archive/) is NOT touched — only TODAY\'S working state.')) return;
      if (!ctx.db || !rdd.date) return;
      try {
        ctx.showLoading?.('Clearing today\'s race day…');
        for (const sub of ['stints', 'live', 'setup', 'roster']) {
          try {
            const snap = await ctx.getDocs(ctx.collection(ctx.db, 'race_day', rdd.date, sub));
            for (const d of snap.docs) {
              try { await ctx.deleteDoc(d.ref); } catch(_) {}
            }
          } catch(_) {}
        }
        ctx.hideLoading?.();
        ctx.showToast?.('Today\'s race day cleared.', 'success');
        try { await loadTodayStints(); } catch(_) {}
        try { showRdTab(ov.querySelector('#rd-inner') || ov, 'roster'); } catch(_) {}
      } catch(e) {
        ctx.hideLoading?.();
        console.warn('Clear race history failed:', e);
        ctx.showToast?.('Couldn\'t clear — check Firestore rules.', 'error');
      }
    });
  }
  // ── Coach/admin "⋯" menu bindings ─────────────────────────────────
  // Toggle visibility on click, close on outside-tap or Esc, and
  // collapse the menu the moment any item inside fires so the user
  // isn't left looking at a stale open menu.
  const moreBtn  = ov.querySelector('#rd-more-btn');
  const moreMenu = ov.querySelector('#rd-more-menu');
  const closeMoreMenu = () => {
    if (!moreMenu || moreMenu.hidden) return;
    moreMenu.hidden = true;
    moreBtn?.setAttribute('aria-expanded', 'false');
  };
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = !moreMenu.hidden;
      moreMenu.hidden = wasOpen;
      moreBtn.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
    });
    document.addEventListener('click', (e) => {
      if (moreMenu.hidden) return;
      if (moreMenu.contains(e.target) || moreBtn.contains(e.target)) return;
      closeMoreMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMoreMenu();
    });
    // Any menu-item click closes the menu after its own handler runs.
    moreMenu.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setTimeout(closeMoreMenu, 0)));
  }
  ov.querySelector('#rd-excel-btn')?.addEventListener('click', () => {
    if (typeof window.exportRaceDayExcel === 'function') {
      window.exportRaceDayExcel({ dateKey: rdd.date });
    } else if (ctx.exportRaceDayExcel) {
      ctx.exportRaceDayExcel({ dateKey: rdd.date });
    }
  });
  ov.querySelector('#rd-share-btn')?.addEventListener('click', async () => {
    const tid = ctx.userProfile?.teamId || '';
    // Include the race date so spectators see THIS race day's roster
    // even if they open the link past midnight UTC. Was previously
    // letting spectate.html default to today's UTC day, which broke
    // for overnight events in Australian timezones.
    const params = new URLSearchParams();
    if (tid) params.set('team', tid);
    if (rdd.date) params.set('date', rdd.date);
    const qs = params.toString();
    const url = location.origin + '/spectate.html' + (qs ? '?' + qs : '');
    if (navigator.share) {
      try { await navigator.share({ title: 'TurboPrep — Spectator link', url }); return; } catch(e) {}
    }
    try {
      await navigator.clipboard?.writeText(url);
      ctx.showToast?.('Spectator link copied — share it with families.', 'success');
    } catch(e) {
      ctx.showToast?.('Link: ' + url, 'info');
    }
  });
  ov.querySelector('#rd-end-btn')?.addEventListener('click',async()=>{
    if (!confirm('End race day mode for all users?')) return;
    await deactivateRaceDay();
    closeOverlay();
    ctx.showToast('Race day ended.','info');
    updateRaceDayTabBar(false);
  });
  // Per-device suppress: hides race mode on THIS device's Watch even if
  // the team flag is still on (coach left it active). Resets overnight.
  ov.querySelector('#rd-watch-dismiss')?.addEventListener('click',()=>{
    try {
      const todayK = new Date().toISOString().slice(0, 10);
      localStorage.setItem('tp_race_day_suppress', todayK);
      ctx.pushWatchState?.();
      ctx.showToast?.('Race mode hidden on your Watch for today.','success');
    } catch(e) { ctx.showToast?.('Could not hide on Watch.','warn'); }
  });

  // Tab switching — bottom nav tabs
  ov.querySelectorAll('[data-rdtab]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      ov.querySelectorAll('.rd-tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      showRdTab(ov,btn.dataset.rdtab);
    });
  });

  // Coach FAB — add to roster
  ov.querySelector('#rd-roster-fab')?.addEventListener('click',()=>{
    // Switch to roster tab and open add driver
    ov.querySelectorAll('.rd-tab-btn').forEach(b=>b.classList.remove('active'));
    const rosterBtn = ov.querySelector('[data-rdtab="roster"]');
    if (rosterBtn) rosterBtn.classList.add('active');
    const c = ov.querySelector('#rd-content');
    renderRoster(c);
    // Auto-open add driver sheet
    setTimeout(()=>openAddDriver(c), 100);
  });
}
async function showRdTab(ov,tab) {
  const c=ov.querySelector('#rd-content');
  // Switching tabs invalidates the previous tab's polling intervals.
  // Without this, stacking 10 tab-switches stacks 10 spectator polls.
  if (spectatorUnsub) {
    try { if (typeof spectatorUnsub === 'function') spectatorUnsub(); else clearInterval(spectatorUnsub); } catch(e) {}
    spectatorUnsub = null;
  }
  // FAB is only useful on the roster tab — on stint/setup it overlaps
  // the bottom-nav centre Stint button and gives the wrong affordance.
  // Roster tab already has a "+ Add Driver" button in its header.
  const fab = document.getElementById('rd-roster-fab');
  if (fab) fab.style.display = (tab === 'roster') ? '' : 'none';
  // Refresh the per-tab data so the user always sees current state when
  // they switch back. Audit found todayStints + rosterData were going
  // stale across tab switches.
  if (tab==='roster') {
    try { await loadRoster(); } catch(e) {}
    renderRoster(c);
  } else if (tab==='stint') {
    try { await loadTodayStints(); } catch(e) {}
    renderStintTab(c);
  } else if (tab==='setup') {
    try { await loadSetupFields(); } catch(e) {}
    renderSetup(c);
  }
}

// ── Roster Tab ────────────────────────────────────────────────────────────────
function renderRoster(c) {
  const mgr=ctx.userProfile?.isCoach||ctx.userProfile?.isManager;
  // Coach can also bulk-add an entire subteam to the roster — saves
  // typing every driver name on race morning. Subteams come from
  // ctx.teamData.subteams (loaded by app.js).
  const subteams = (mgr && Array.isArray(ctx.teamData?.subteams)) ? ctx.teamData.subteams : [];
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px">
    <div style="font-size:16px;font-weight:700">Driver Roster</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
      ${subteams.length > 0 ? `<select id="rd-subteam-pick" style="font-size:12px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--fg);cursor:pointer">
        <option value="">+ Subteam…</option>
        ${subteams.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}
      </select>` : ''}
      ${mgr?`<button id="rd-add-driver" style="font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--primary);color:var(--primary);background:none;font-weight:600;cursor:pointer">+ Add Driver</button>`:''}
    </div>
  </div>`;

  if (rosterData.length===0) {
    html+=`<div style="text-align:center;padding:32px 20px;color:var(--muted-fg);font-size:13px">No drivers added yet.${mgr?'<br>Tap + Add Driver to begin.':''}</div>`;
  } else {
    html+=`<div style="font-size:11px;color:var(--muted-fg);text-align:center;margin-bottom:8px">Hold and drag to reorder drivers</div><div id="rd-roster-list">`;
    rosterData.forEach((d,i)=>{
      const mins=Math.round((d.duration||3600)/60);
      // Removed the dedicated drag handle ⠿ — the whole row is already
      // draggable via touchstart/touchmove handlers. Plus duration is
      // now folded into the name row's subtitle so this is 4 elements
      // (number, name+meta, edit) instead of 6.
      html+=`<div class="rd-drag-item" data-idx="${i}" draggable="true">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:var(--primary-fg);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600">${esc(d.name)}</div>
          <div style="font-size:11px;color:var(--muted-fg);margin-top:1px">${mins}m${d.notes?' · '+esc(d.notes):''}</div>
        </div>
        ${mgr?`<button class="rd-edit-btn" data-idx="${i}" aria-label="Edit driver" style="width:30px;height:30px;border-radius:8px;background:var(--muted);border:none;color:var(--muted-fg);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
      </div>`;
    });
    html+=`</div>`;
  }
  c.innerHTML=html;
  initDrag(c);
  c.querySelector('#rd-add-driver')?.addEventListener('click',()=>openAddDriver(c));
  c.querySelectorAll('.rd-edit-btn').forEach(btn=>btn.addEventListener('click',()=>openEditDriver(parseInt(btn.dataset.idx),c)));
  c.querySelector('#rd-subteam-pick')?.addEventListener('change', async (e) => {
    const subId = e.target.value;
    if (!subId) return;
    e.target.value = ''; // reset so picking the same subteam again works
    await populateRosterFromSubteam(subId, c);
  });
}

/// Bulk-add every member of a subteam to today's roster. Skips members
/// already on the roster (case-insensitive name match). Persists with
/// `uid` on each entry so we can later detect overlap with auth users.
async function populateRosterFromSubteam(subId, c) {
  const sub = (ctx.teamData?.subteams || []).find(s => s.id === subId);
  if (!sub) { ctx.showToast?.('Subteam not found.', 'warn'); return; }
  const existing = new Set(rosterData.map(d => (d.name || '').trim().toLowerCase()));
  let added = 0, skipped = 0;
  const members = Array.isArray(sub.members) ? sub.members : [];
  for (const uid of members) {
    const member = (ctx.teamMembers || []).find(m => m.uid === uid);
    if (!member) continue;
    const displayName = member.displayName || member.email || 'Driver';
    const key = displayName.trim().toLowerCase();
    if (existing.has(key)) { skipped++; continue; }
    rosterData.push({
      id: 'drv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: displayName,
      uid,            // track source for future filter / dedup
      duration: 3600,
      notes: ''
    });
    existing.add(key);
    added++;
  }
  if (added === 0 && skipped === 0) {
    ctx.showToast?.('Subteam has no members yet.', 'warn');
    return;
  }
  await saveRoster();
  renderRoster(c);
  const msg = added + ' added' + (skipped ? ' · ' + skipped + ' already on roster' : '');
  ctx.showToast?.(msg, 'success');
}

function initDrag(c) {
  const list=c.querySelector('#rd-roster-list');
  if (!list) return;
  let dragIdx=null;
  list.querySelectorAll('.rd-drag-item').forEach(item=>{
    // Mouse drag
    item.addEventListener('dragstart',()=>{ dragIdx=parseInt(item.dataset.idx); item.style.opacity='.5'; });
    item.addEventListener('dragend',()=>{ item.style.opacity=''; dragIdx=null; list.querySelectorAll('.rd-drag-item').forEach(el=>el.classList.remove('drag-over')); });
    item.addEventListener('dragover',e=>{ e.preventDefault(); list.querySelectorAll('.rd-drag-item').forEach(el=>el.classList.remove('drag-over')); item.classList.add('drag-over'); });
    item.addEventListener('drop',async()=>{
      const to=parseInt(item.dataset.idx);
      if (dragIdx===null||dragIdx===to) return;
      const moved=rosterData.splice(dragIdx,1)[0]; rosterData.splice(to,0,moved);
      await saveRoster(); renderRoster(c);
    });
    // Touch drag
    let ty=0, fromIdx=null;
    item.addEventListener('touchstart',e=>{ ty=e.touches[0].clientY; fromIdx=parseInt(item.dataset.idx); },{passive:true});
    item.addEventListener('touchmove',e=>{
      e.preventDefault();
      const y=e.touches[0].clientY;
      list.querySelectorAll('.rd-drag-item').forEach(el=>{
        const r=el.getBoundingClientRect();
        el.classList.toggle('drag-over',y>r.top&&y<r.bottom&&el!==item);
      });
    },{passive:false});
    item.addEventListener('touchend',async e=>{
      const y=e.changedTouches[0].clientY;
      let toIdx=fromIdx;
      list.querySelectorAll('.rd-drag-item').forEach(el=>{ el.classList.remove('drag-over'); const r=el.getBoundingClientRect(); if(y>r.top&&y<r.bottom) toIdx=parseInt(el.dataset.idx); });
      if (toIdx!==fromIdx) { const m=rosterData.splice(fromIdx,1)[0]; rosterData.splice(toIdx,0,m); await saveRoster(); renderRoster(c); }
    });
  });
}

function openAddDriver(c) {
  ctx.openSheet();
  ctx.$('sheet-content').innerHTML=`
    <div class="sheet-title">Add Driver</div>
    <div class="form-group"><label class="label">Name / Username</label><input class="input" type="text" id="rd-n" placeholder="Driver name" maxlength="40"></div>
    <div class="form-group"><label class="label">Stint Duration (minutes)</label><input class="input" type="number" id="rd-dur" value="60" min="1" max="480"></div>
    <div class="form-group"><label class="label">Notes (optional)</label><input class="input" type="text" id="rd-notes" placeholder="e.g. Start at 80% effort" maxlength="100"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="rd-add-save">Add Driver</button>`;
  ctx.$('rd-add-save').addEventListener('click',async()=>{
    const name=ctx.$('rd-n').value.trim();
    if (!name){ ctx.showToast('Enter a name.','warn'); return; }
    const dur=parseInt(ctx.$('rd-dur').value)*60||3600;
    const notes=ctx.$('rd-notes').value.trim();
    const driver = {id:'drv_'+Date.now(),name,duration:dur,notes};
    rosterData.push(driver);
    const ok = await saveRoster();
    if (!ok) {
      // Roll back the optimistic push so the next render reflects truth.
      const idx = rosterData.findIndex(d => d.id === driver.id);
      if (idx >= 0) rosterData.splice(idx, 1);
      return; // leave sheet open so the user can see the error toast & retry
    }
    // Alert team
    try { if(ctx.db&&ctx.userProfile?.teamId) await ctx.addDoc(ctx.collection(ctx.db,'teams',ctx.userProfile.teamId,'alerts'),{type:'roster_update',message:'Driver roster updated — check Race Day.',createdAt:ctx.serverTimestamp(),createdBy:ctx.userProfile.displayName}); } catch(e){}
    ctx.closeSheet();
    renderRoster(c);
  });
}

function openEditDriver(idx,c) {
  const d=rosterData[idx]; if (!d) return;
  ctx.openSheet();
  ctx.$('sheet-content').innerHTML=`
    <div class="sheet-title">Edit Driver</div>
    <div class="form-group"><label class="label">Name</label><input class="input" type="text" id="rd-en" value="${esc(d.name)}" maxlength="40"></div>
    <div class="form-group"><label class="label">Stint Duration (minutes)</label><input class="input" type="number" id="rd-edur" value="${Math.round((d.duration||3600)/60)}" min="1" max="480"></div>
    <div class="form-group"><label class="label">Notes</label><input class="input" type="text" id="rd-enotes" value="${esc(d.notes||'')}" maxlength="100"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="rd-es">Save</button>
    <button class="btn btn-secondary" style="width:100%;margin-top:8px" id="rd-ed">Remove Driver</button>`;
  ctx.$('rd-es').addEventListener('click',async()=>{
    rosterData[idx].name=ctx.$('rd-en').value.trim()||d.name;
    rosterData[idx].duration=(parseInt(ctx.$('rd-edur').value)||60)*60;
    rosterData[idx].notes=ctx.$('rd-enotes').value.trim();
    await saveRoster(); ctx.closeSheet(); renderRoster(c);
  });
  ctx.$('rd-ed').addEventListener('click',async()=>{
    const driverName = (rosterData[idx]?.name || 'this driver');
    if (!confirm('Remove ' + driverName + ' from the roster? This can\'t be undone mid-race.')) return;
    const removed = rosterData.splice(idx,1)[0];
    const ok = await saveRoster();
    if (!ok) {
      // Roll back so the UI reflects truth.
      rosterData.splice(idx, 0, removed);
      return;
    }
    ctx.closeSheet();
    renderRoster(c);
  });
}

// ── Setup Tab ─────────────────────────────────────────────────────────────────
function renderSetup(c) {
  const mgr=ctx.userProfile?.isCoach||ctx.userProfile?.isManager;
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
    <div style="font-size:16px;font-weight:700">Team Setup</div>
    ${mgr?`<button id="rd-add-field" style="font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--primary);color:var(--primary);background:none;font-weight:600;cursor:pointer">+ Field</button>`:''}
  </div>
  <div style="font-size:12px;color:var(--muted-fg);margin-bottom:14px">Enter your personal setup for today's race.</div>`;

  setupFields.forEach((f,i)=>{
    html+=`<div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <label class="label" style="margin:0;flex:1">${esc(f.label)}</label>
        ${mgr?`<button class="rd-del-field" data-idx="${i}" style="font-size:10px;color:var(--destructive);background:none;border:none;cursor:pointer;padding:2px 6px;font-weight:700">✕</button>`:''}
      </div>
      ${f.type==='number'
        ?`<input class="input rd-sf" data-idx="${i}" type="number"${typeof f.min==='number'?` min="${f.min}"`:''}${typeof f.max==='number'?` max="${f.max}"`:''} value="${esc(f.value||'')}" placeholder="${esc(f.label)}">`
        :`<input class="input rd-sf" data-idx="${i}" type="text" value="${esc(f.value||'')}" placeholder="${esc(f.label)}" maxlength="80">`
      }
    </div>`;
  });

  html+=`<button class="btn btn-primary" style="width:100%;margin-top:4px" id="rd-setup-save">Save My Setup</button>`;
  c.innerHTML=html;

  // 'input' (not 'change') so the last keystroke captures even if the
  // user taps Save without blurring the input first.
  c.querySelectorAll('.rd-sf').forEach(inp=>inp.addEventListener('input',()=>{ setupFields[parseInt(inp.dataset.idx)].value=inp.value; }));
  c.querySelectorAll('.rd-del-field').forEach(btn=>btn.addEventListener('click',async()=>{
    const i = parseInt(btn.dataset.idx);
    // Field objects use `label`, not `name` — confirm prompt was
    // showing "undefined" before.
    const fName = setupFields[i]?.label || 'this field';
    if (!confirm('Delete "' + fName + '" from setup?')) return;
    const removed = setupFields.splice(i,1)[0];
    try { await saveSetupFields(); renderSetup(c); }
    catch(e) { setupFields.splice(i,0,removed); renderSetup(c); }
  }));
  c.querySelector('#rd-add-field')?.addEventListener('click',()=>openAddField(c));
  c.querySelector('#rd-setup-save')?.addEventListener('click',async()=>{ await saveSetupFields(); ctx.showToast('Setup saved.','success'); });
}

function openAddField(c) {
  ctx.openSheet();
  ctx.$('sheet-content').innerHTML=`
    <div class="sheet-title">Add Setup Field</div>
    <div class="form-group"><label class="label">Field Label</label><input class="input" type="text" id="rd-fl" placeholder="e.g. Shoe Size" maxlength="40"></div>
    <div class="form-group"><label class="label">Type</label>
      <select class="input" id="rd-ft"><option value="text">Text</option><option value="number">Number (0–30)</option></select>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="rd-fls">Add Field</button>`;
  ctx.$('rd-fls').addEventListener('click',async()=>{
    const label=ctx.$('rd-fl').value.trim();
    if (!label){ ctx.showToast('Enter a label.','warn'); return; }
    setupFields.push({id:'f_'+Date.now(),label,type:ctx.$('rd-ft').value,value:'',min:0,max:30,filledBy:'member'});
    await saveSetupFields(); ctx.closeSheet(); renderSetup(c);
  });
}

// ── Stint Tab ─────────────────────────────────────────────────────────────────
async function loadLiveStints() {
  if (!ctx?.db || !rdd.date) return [];
  try {
    const s = await ctx.getDocs(ctx.collection(ctx.db,'race_day',rdd.date,'live'));
    const cutoff = Date.now() - 90*1000; // anything not updated in 90s = stale
    return s.docs.map(d=>d.data())
      .filter(d => d.live && d.updatedAt && (d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0) > cutoff);
  } catch(e) { return []; }
}

// Per-uid Leaflet instances so re-rendering the live panel doesn't
// re-create the map every 5s (would cause flicker + tile reloads).
// Keyed by the driver's uid; cleared when the panel goes empty or the
// driver disappears from the live array.
let liveDriverMaps = {};

function renderLivePanel(live) {
  if (!live || live.length === 0) {
    // Tear down any leftover maps so we don't leak Leaflet instances
    // when the panel becomes empty.
    Object.keys(liveDriverMaps).forEach(uid => {
      try { liveDriverMaps[uid].map.remove(); } catch(e) {}
    });
    liveDriverMaps = {};
    return '';
  }
  return `<div style="background:linear-gradient(135deg,rgba(var(--destructive-rgb),.10),rgba(var(--destructive-rgb),.04));border:1px solid rgba(var(--destructive-rgb),.25);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <div style="width:7px;height:7px;border-radius:50%;background:var(--destructive);animation:rdPulse 1.4s ease infinite"></div>
      <span style="font-size:11px;font-weight:700;color:var(--destructive);letter-spacing:.05em;text-transform:uppercase">Live on track</span>
    </div>
    ${live.map(l => {
      const safeId = String(l.uid || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      return `<div style="padding:6px 0;border-top:1px solid rgba(var(--destructive-rgb),.12)">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px">
          <span style="flex:1;font-weight:700">${esc(l.displayName||'Driver')}</span>
          <span style="color:var(--muted-fg);font-size:11px">${l.lapCount||0} laps</span>
          <span style="font-family:var(--font-mono);font-weight:700;color:var(--fg)">${fmtTime(l.elapsed||0)}</span>
        </div>
        ${l.coord ? `<div id="rd-live-map-${safeId}" data-uid="${esc(l.uid||'')}" data-lat="${l.coord.lat}" data-lng="${l.coord.lng}" style="width:100%;height:120px;border-radius:8px;overflow:hidden;background:#0a1628"></div>` : `<div style="font-size:10px;color:var(--muted-fg);font-style:italic">Waiting for GPS…</div>`}
      </div>`;
    }).join('')}
  </div>`;
}

/// After renderLivePanel writes its HTML, init/update Leaflet for each
/// live driver's mini-map. Re-uses existing instances by uid so the
/// 5-second poll doesn't tear down + rebuild the map on every refresh.
function initLiveDriverMaps(live) {
  if (typeof L === 'undefined') return;
  const liveUids = new Set((live || []).map(l => l.uid).filter(Boolean));
  // Tear down maps for drivers who are no longer live (stint ended).
  Object.keys(liveDriverMaps).forEach(uid => {
    if (!liveUids.has(uid)) {
      try { liveDriverMaps[uid].map.remove(); } catch(e) {}
      delete liveDriverMaps[uid];
    }
  });
  (live || []).forEach(l => {
    if (!l.coord || !l.uid) return;
    const safeId = String(l.uid).replace(/[^a-zA-Z0-9_-]/g, '_');
    const el = document.getElementById('rd-live-map-' + safeId);
    if (!el) return;
    let entry = liveDriverMaps[l.uid];
    if (!entry || !document.body.contains(entry.el)) {
      // First time seeing this driver, OR DOM was rebuilt — make a new map.
      try {
        if (entry) { try { entry.map.remove(); } catch(e) {} }
        const map = L.map(el, { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false });
        L.tileLayer(ctx.getMapTileUrl(), { maxZoom: 19 }).addTo(map);
        map.setView([l.coord.lat, l.coord.lng], 17);
        const marker = L.circleMarker([l.coord.lat, l.coord.lng], { radius: 9, fillColor: 'var(--primary)', fillOpacity: 1, color: '#fff', weight: 3 });
        marker.addTo(map);
        liveDriverMaps[l.uid] = { map, marker, el };
      } catch (e) { /* leaflet init can fail if container detached */ }
    } else {
      // Already have a map — just slide marker + recenter.
      try {
        entry.marker.setLatLng([l.coord.lat, l.coord.lng]);
        entry.map.panTo([l.coord.lat, l.coord.lng], { animate: true, duration: 0.6 });
      } catch (e) {}
    }
  });
}

function renderUpNextPanel() {
  if (!rosterData || rosterData.length === 0) return '';
  // Roster entries are keyed by `drv_<ts>` (internal id), not the
  // user's auth uid — so the previous `d.id !== ctx.currentUser?.uid`
  // check could NEVER match. Filter by displayName collation instead:
  // a roster entry whose name matches the current user's display name
  // (case + space-normalised) is considered "this is me, don't show
  // me as up-next".
  const meName = (ctx.userProfile?.displayName || '').trim().toLowerCase();
  const completedNames = new Set(todayStints
    .map(s => (s.displayName || '').trim().toLowerCase())
    .filter(Boolean));
  const next = rosterData.find(d => {
    const dn = (d.name || '').trim().toLowerCase();
    if (!dn) return false;
    if (completedNames.has(dn)) return false;
    if (meName && dn === meName) return false;
    return true;
  });
  if (!next) return '';
  const mins = Math.round((next.duration||3600)/60);
  // Visually distinct from the red "Live on track" panel — uses a blue
  // accent + sharper left border so the eye doesn't conflate "who's next"
  // with "who's currently riding."
  return `<div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.22);border-left:3px solid #3b82f6;border-radius:10px;padding:11px 13px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
    <div style="font-size:10px;font-weight:800;color:#3b82f6;text-transform:uppercase;letter-spacing:.06em">Up next</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:14px;font-weight:700;color:var(--fg)">${esc(next.name)}</div>
      ${next.notes?`<div style="font-size:11px;color:var(--muted-fg);margin-top:1px">${esc(next.notes)}</div>`:''}
    </div>
    <div style="font-size:12px;color:var(--muted-fg);white-space:nowrap">${mins}m</div>
  </div>`;
}

function renderStintTab(c) {
  if (stintActive) { renderActiveStint(c); return; }

  const spInfo = rdd.startPointSet
    ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(var(--success-rgb),.08);border:1px solid rgba(var(--success-rgb),.2);border-radius:10px;margin-bottom:14px;font-size:13px;color:var(--success)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Start / finish point is set
       </div>`
    : `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(var(--primary-rgb),.08);border:1px solid rgba(var(--primary-rgb),.2);border-radius:10px;margin-bottom:14px;font-size:13px;color:#f97316">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Waiting for start/finish — first rider to move 7:30 continuously or pass the same point twice sets it for everyone
       </div>`;

  let stintsHtml='';
  if (todayStints.length>0) {
    stintsHtml=`<div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 8px">Today's Stints</div>`;
    todayStints.forEach(s=>{
      const best=s.laps?.length>0 ? fmtMs(Math.min(...s.laps.map(l=>l.duration))) : '--:--';
      stintsHtml+=`<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span style="flex:1;font-weight:600">${esc(s.displayName||s.uid)}</span>
        <span style="color:var(--muted-fg)">${s.laps?.length||0} laps</span>
        <span style="color:var(--muted-fg);font-family:var(--font-mono)">${best}</span>
        <button class="rd-email-btn" data-uid="${esc(s.uid)}" style="font-size:11px;padding:3px 10px;border-radius:6px;background:rgba(var(--primary-rgb),.1);border:1px solid rgba(var(--primary-rgb),.2);color:var(--primary);cursor:pointer;font-weight:600">📧</button>
      </div>`;
    });
  }

  c.innerHTML=`
    <div id="rd-live-panel"></div>
    ${renderUpNextPanel()}
    ${spInfo}
    <div id="rd-pre-map" style="width:100%;height:200px;border-radius:12px;overflow:hidden;background:#0a1628;margin-bottom:14px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--primary)">${todayStints.length}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Stints Today</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--fg)">${todayStints.reduce((s,x)=>s+(x.laps?.length||0),0)}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Total Laps</div>
      </div>
    </div>
    ${stintsHtml}
    <button id="rd-start-btn" style="width:100%;padding:16px;border-radius:14px;background:linear-gradient(135deg,var(--success),#16a34a);color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;margin-top:14px;box-shadow:0 4px 15px rgba(var(--success-rgb),.35);-webkit-tap-highlight-color:transparent">▶ Start My Stint</button>`;

  setTimeout(()=>initPreMap(),150);
  c.querySelector('#rd-start-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.textContent = 'Starting…';
    // Brief lock — startStint replaces the DOM almost immediately, so the
    // disable mainly guards against a double-tap during the transition.
    setTimeout(() => startStint(c), 50);
  });
  c.querySelectorAll('.rd-email-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const s=todayStints.find(x=>x.uid===btn.dataset.uid); if(s) emailStint(s);
  }));

  // Live-stint subscription. Was previously a 5-20s setTimeout poll
  // (`loadLiveStints` → getDocs every tick). Switched to onSnapshot so
  // Firestore pushes deltas directly — no more round-trips, latency drops
  // from ~5s to ~500ms, and there's a single live listener instead of one
  // ticking per visible client.
  if (spectatorUnsub) {
    try { if (typeof spectatorUnsub === 'function') spectatorUnsub(); else { clearInterval(spectatorUnsub); clearTimeout(spectatorUnsub); } } catch(e) {}
    spectatorUnsub = null;
  }
  const applyLive = (live) => {
    const panel = document.getElementById('rd-live-panel');
    if (panel) {
      panel.innerHTML = renderLivePanel(live);
      try { initLiveDriverMaps(live); } catch (e) { /* leaflet may not be loaded yet */ }
    }
    // Stint locking — if ANY other driver is currently on track, lock the
    // Start button so two teammates can't run a stint at the same time.
    const myUid = ctx.currentUser?.uid;
    const othersLive = (live || []).filter(l => l.uid && l.uid !== myUid);
    const startBtn = document.getElementById('rd-start-btn');
    if (startBtn) {
      if (othersLive.length > 0) {
        const driver = othersLive[0].displayName || 'A teammate';
        startBtn.disabled = true;
        startBtn.dataset.locked = '1';
        startBtn.style.opacity = '0.55';
        startBtn.style.cursor = 'not-allowed';
        startBtn.style.background = 'linear-gradient(135deg,var(--muted),var(--muted))';
        startBtn.style.boxShadow = 'none';
        startBtn.textContent = driver + ' is on track — wait';
      } else if (startBtn.dataset.locked === '1') {
        startBtn.disabled = false;
        delete startBtn.dataset.locked;
        startBtn.style.opacity = '';
        startBtn.style.cursor = 'pointer';
        startBtn.style.background = 'linear-gradient(135deg,var(--success),#16a34a)';
        startBtn.style.boxShadow = '0 4px 15px rgba(var(--success-rgb),.35)';
        startBtn.textContent = '▶ Start My Stint';
      }
    }
    // Tab moved on — kill the listener so we don't leak Firestore reads.
    if (!document.getElementById('rd-start-btn') && spectatorUnsub) {
      try { spectatorUnsub(); } catch(e) {}
      spectatorUnsub = null;
    }
  };

  if (ctx?.db && ctx.onSnapshot && rdd.date) {
    try {
      const liveCol = ctx.collection(ctx.db, 'race_day', rdd.date, 'live');
      // spectatorUnsub doubles as the unsubscribe function so the tab
      // teardown path (which clears it) works without changes elsewhere.
      spectatorUnsub = ctx.onSnapshot(liveCol, (snap) => {
        const cutoff = Date.now() - 90 * 1000;
        const live = snap.docs
          .map(d => d.data())
          .filter(d => d.live)
          .filter(d => {
            const t = d.updatedAt?.toMillis ? d.updatedAt.toMillis() : 0;
            return t > cutoff;
          });
        applyLive(live);
      }, (err) => {
        console.warn('rd-live onSnapshot:', err);
        // Fall back to a one-shot read so the panel isn't blank on listener error.
        loadLiveStints().then(applyLive).catch(() => {});
      });
    } catch (e) {
      console.warn('rd-live onSnapshot init failed; falling back to single read:', e);
      loadLiveStints().then(applyLive).catch(() => {});
    }
  } else {
    // No db / no onSnapshot — single fetch and bail.
    loadLiveStints().then(applyLive).catch(() => {});
  }
}

function initPreMap() {
  try {
    if (typeof L==='undefined') return;
    const el=document.getElementById('rd-pre-map'); if (!el) return;
    const m=L.map('rd-pre-map',{zoomControl:false,attributionControl:false});
    L.tileLayer(ctx.getMapTileUrl(),{maxZoom:19}).addTo(m);
    if (rdd.startPointSet&&rdd.startPoint) {
      m.setView([rdd.startPoint.lat,rdd.startPoint.lng],17);
      L.circleMarker([rdd.startPoint.lat,rdd.startPoint.lng],{radius:12,fillColor:'#f97316',fillOpacity:.9,color:'#fff',weight:2}).addTo(m).bindPopup('Start / Finish');
    } else {
      // Silent centering: use cached coords from a prior session if we
      // have them, else default to Melbourne. NEVER trigger a fresh
      // permission prompt just to center the map — users complained
      // every cold boot was asking for location.
      try {
        const last = JSON.parse(localStorage.getItem('tp_last_coords') || 'null');
        if (last && Number.isFinite(last.lat) && Number.isFinite(last.lon)) {
          m.setView([last.lat, last.lon], 16);
        } else {
          m.setView([-37.81, 144.96], 14);
        }
      } catch (_) { m.setView([-37.81, 144.96], 14); }
    }
  } catch(e){}
}

async function startStint(c) {
  // Server-side lock — read the latest live stints right before flipping
  // local state. If ANY other driver is live, abort and re-render the
  // pre-stint UI with the lock banner. This catches a fast double-tap
  // that beats the spectator-poll refresh.
  try {
    const live = await loadLiveStints();
    const myUid = ctx.currentUser?.uid;
    const others = (live || []).filter(l => l.uid && l.uid !== myUid);
    if (others.length > 0) {
      const driver = others[0].displayName || 'a teammate';
      ctx.showToast?.('Wait — ' + driver + ' is on track.', 'warn');
      // Re-render the pre-stint UI so the user sees the live panel update.
      renderStintTab(c);
      return;
    }
  } catch (e) { /* lock check is best-effort; fall through if Firestore unreachable */ }
  stintActive=true; stintStartTime=Date.now();
  // Persist so a JS context loss / reload doesn't leave stintStartTime
  // null. Without this, endStint() would compute Date.now() - null =
  // Date.now() (≈55 years in ms) and bypass the 25-hour cap entirely.
  try { localStorage.setItem('tp_stint_start', String(stintStartTime)); } catch(e) {}
  stintPositions=[]; stintLaps=[]; stintPitStops=[]; moveContinuousStart=null; lastLapTime=null;
  // Reset detector + voice state for the new stint.
  _crashHrSamples = []; _crashAlertedThisStint = false;
  _lastPitSuggestionAt = 0; _bestLapSpoken = Infinity;
  // Reset GPS-gap + rider-down state for the new stint (recs #4, #12).
  stintGpsGaps = []; stintLastSampleTs = 0; stintRiderDownFlag = null;
  // Fetch this rider's PB lap for this race in the background (rec #8)
  // so updateActive can render a live gap-to-PB. Best-effort — silently
  // leaves stintPbLapMs null if the user has no prior years at this race.
  stintPbLapMs = null;
  (async () => {
    try {
      if (!ctx?.db || !ctx.currentUser || !rdd.raceId) return;
      const yearsSnap = await ctx.getDocs(ctx.collection(ctx.db, 'race_archive', rdd.raceId, 'years'));
      let best = Infinity;
      for (const yd of yearsSnap.docs) {
        const ref = ctx.doc(ctx.db, 'race_archive', rdd.raceId, 'years', yd.id, 'stints', ctx.currentUser.uid);
        const s = await ctx.getDoc(ref).catch(() => null);
        if (!s?.exists?.()) continue;
        const laps = Array.isArray(s.data()?.laps) ? s.data().laps : [];
        for (const lap of laps) {
          const d = lap?.duration;
          if (typeof d === 'number' && d > 3000 && d < best) best = d;
        }
      }
      if (Number.isFinite(best)) stintPbLapMs = best;
    } catch (_) {}
  })();
  // Crash-recovery: if a persisted state exists from a force-quit
  // within the last hour, rehydrate the in-flight stint silently so no
  // lap data is lost. (rec #5)
  try {
    const persisted = rehydratePersistedStintState();
    if (persisted && persisted.startTime && (Date.now() - persisted.startTime) < 60 * 60 * 1000) {
      stintStartTime = persisted.startTime;
      stintLaps = Array.isArray(persisted.laps) ? persisted.laps : [];
      stintPitStops = Array.isArray(persisted.pitStops) ? persisted.pitStops : [];
      stintGpsGaps = Array.isArray(persisted.gaps) ? persisted.gaps : [];
      stintRiderDownFlag = persisted.riderDown || null;
      if (stintLaps.length) lastLapTime = stintLaps[stintLaps.length - 1].time;
      try { localStorage.setItem('tp_stint_start', String(stintStartTime)); } catch (_) {}
      ctx.showToast?.('Resumed in-flight stint — ' + stintLaps.length + ' laps restored.', 'info');
    }
  } catch (_) {}
  // Kick off the iOS Live Activity (lock-screen + Dynamic Island).
  // Best-effort — silently no-ops on non-iOS or when the user has
  // disabled live activities in Settings.
  try {
    if (window.webkit?.messageHandlers?.tpNative) {
      const raceName = (rdd.raceName || ctx.teamData?.name || 'Race day').toString().slice(0, 40);
      const riderName = (ctx.userProfile?.displayName || 'Rider').toString().slice(0, 24);
      window.webkit.messageHandlers.tpNative.postMessage({
        type: 'live-activity-start',
        raceName, riderName,
        startedAtMs: stintStartTime,
      });
    }
  } catch(_) {}
  // Mirror to window flags so the persistent CentreBar (Spotify-style
  // "now training" strip) can pick up the active stint and re-render.
  try {
    window._tpRaceDayStintActive = true;
    window._tpRaceDayStintStartedAt = stintStartTime;
    window._tpRaceDayStintLabel = (rdd.raceName || ctx.teamData?.name || 'Race stint').toString().slice(0, 60);
    window.CentreBar?.refresh?.();
  } catch(_) {}
  stintMap=null; stintPolyline=null; stintMarker=null;
  stintGpsState='connecting';
  renderActiveStint(c);
  stintInterval=setInterval(()=>updateActive(),1000);
  // Live progress publish — every 15s push current state so teammates see live laps/elapsed
  stintLiveInterval=setInterval(()=>publishLiveStint(),1000);
  publishLiveStint(); // initial
  if (navigator.geolocation) {
    stintWatchId=navigator.geolocation.watchPosition(
      (pos) => {
        if (stintGpsState !== 'live') {
          stintGpsState = 'live';
          if (stintGpsTimeout) { clearTimeout(stintGpsTimeout); stintGpsTimeout = null; }
        }
        // Cache the last-known coords so map-centering on future cold
        // launches uses the user's last position instead of either
        // showing Melbourne CBD or asking for permission again.
        try {
          localStorage.setItem('tp_last_coords', JSON.stringify({
            lat: pos.coords.latitude, lon: pos.coords.longitude, ts: Date.now(),
          }));
        } catch (_) {}
        onPos(pos);
      },
      (err) => {
        console.warn('GPS error:', err?.message || err?.code);
        stintGpsState = 'error';
        try {
          ctx.showToast?.('GPS unavailable — laps must be tapped manually. Check Location permission.', 'warn');
        } catch(e) {}
      },
      { enableHighAccuracy:true, maximumAge:1000, timeout:10000 }
    );
    // Surface a soft warning if GPS hasn't fired in 15s — could be a permission
    // dialog the user needs to dismiss, airplane mode, or indoor with no signal.
    if (stintGpsTimeout) clearTimeout(stintGpsTimeout);
    stintGpsTimeout = setTimeout(() => {
      if (stintGpsState === 'connecting') {
        stintGpsState = 'error';
        try { ctx.showToast?.('GPS not responding. Tap laps manually or check Location.', 'warn'); } catch(e) {}
        // Force a re-render so the sublabel shows the error state.
        try { updateActive(); } catch(e) {}
      }
    }, 15000);
  } else {
    stintGpsState = 'error';
    try { ctx.showToast?.('Location not supported — tap laps manually.', 'warn'); } catch(e) {}
  }
  // Retain a strong reference to the wake-lock sentinel — without
  // this, the GC can release it partway through a long stint and the
  // screen sleeps unexpectedly during a race.
  try {
    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen')
        .then(s => { stintWakeLock = s; })
        .catch(() => {});
    }
  } catch(e) {}
}

async function publishLiveStint() {
  if (!ctx?.db || !rdd.date || !ctx.currentUser) return;
  // Update the iOS Live Activity in lockstep with the spectator
  // publish — same data, different surface. Best-effort.
  try {
    if (window.webkit?.messageHandlers?.tpNative) {
      const best = stintLaps.length ? Math.min(...stintLaps.map(l=>l.duration)) : null;
      const last = stintLaps.length ? stintLaps[stintLaps.length-1].duration : null;
      window.webkit.messageHandlers.tpNative.postMessage({
        type: 'live-activity-update',
        lapCount: stintLaps.length,
        pitCount: stintPitStops.length,
        lastLapMs: last,
        bestLapMs: best,
      });
    }
  } catch(_) {}
  try {
    const best = stintLaps.length ? Math.min(...stintLaps.map(l=>l.duration)) : null;
    // Latest GPS sample so locked teammates can see the live driver's
    // current position on a mini-map. Falls back to null if GPS hasn't
    // produced a fix yet (e.g. first 2-3s of stint).
    const last = stintPositions.length > 0 ? stintPositions[stintPositions.length - 1] : null;
    const coord = last && Number.isFinite(last.lat) && Number.isFinite(last.lng)
      ? { lat: last.lat, lng: last.lng, ts: last.time || Date.now() }
      : null;
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',rdd.date,'live',ctx.currentUser.uid), {
      uid: ctx.currentUser.uid,
      displayName: ctx.userProfile?.displayName || 'Driver',
      // Team scoping — lets the spectator view + future multi-team
      // race-day mode group drivers by team. Was missing, so multi-team
      // race days saw all drivers in one flat list.
      teamId: ctx.userProfile?.teamId || null,
      teamName: ctx.teamData?.name || ctx.userProfile?.teamName || 'Team',
      live: true,
      startTime: stintStartTime,
      elapsed: Date.now() - stintStartTime,
      lapCount: stintLaps.length,
      bestLap: best,
      lastLap: stintLaps.length ? stintLaps[stintLaps.length-1].duration : null,
      pitCount: stintPitStops.length,
      coord,
      updatedAt: ctx.serverTimestamp(),
    });
  } catch(e) {}
}

async function clearLiveStint() {
  if (!ctx?.db || !rdd.date || !ctx.currentUser) return;
  try {
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',rdd.date,'live',ctx.currentUser.uid), {
      uid: ctx.currentUser.uid, live: false, updatedAt: ctx.serverTimestamp(),
    });
  } catch(e) {}
}

// Persist mid-stint state so a cold-boot or force-quit doesn't destroy
// lap data. Debounced via timer below. (rec #5)
let _stintPersistTimer = null;
function persistStintState() {
  if (_stintPersistTimer) return;
  _stintPersistTimer = setTimeout(() => {
    _stintPersistTimer = null;
    if (!stintActive) return;
    try {
      const slim = {
        startTime: stintStartTime,
        laps: stintLaps,
        pitStops: stintPitStops,
        gaps: stintGpsGaps,
        positionsTail: stintPositions.slice(-50), // small recent slice
        riderDown: stintRiderDownFlag,
        savedAt: Date.now(),
      };
      localStorage.setItem(STINT_PERSIST_KEY, JSON.stringify(slim));
    } catch (_) {}
  }, 5000);
}
function clearPersistedStintState() {
  try { localStorage.removeItem(STINT_PERSIST_KEY); } catch (_) {}
}
function rehydratePersistedStintState() {
  try {
    const raw = localStorage.getItem(STINT_PERSIST_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Drop persisted state if it's older than 25 hours — a stale
    // forgotten stint from a previous race should not auto-resume.
    if (!s || (Date.now() - (s.savedAt || 0)) > 25 * 60 * 60 * 1000) {
      clearPersistedStintState();
      return null;
    }
    return s;
  } catch (_) { return null; }
}

// Annotate a lap with confidence (rec #14) based on whether a GPS gap
// happened during it and the lap's source.
function lapConfidence(lap) {
  if (lap.source === 'manual') return 'manual';
  const overlap = stintGpsGaps.some(g => {
    const start = lap.time - lap.duration;
    return g.startTs >= start && g.endTs <= lap.time;
  });
  return overlap ? 'low' : 'high';
}

function onPos(pos) {
  const {latitude:lat,longitude:lng,speed}=pos.coords, now=Date.now();
  // GPS gap detection (rec #12) — record any silent stretch > threshold.
  if (stintActive && stintLastSampleTs && (now - stintLastSampleTs) > GPS_GAP_THRESHOLD_MS) {
    stintGpsGaps.push({ startTs: stintLastSampleTs, endTs: now, gapMs: now - stintLastSampleTs });
    try { ctx.showToast?.('GPS gap (' + Math.round((now - stintLastSampleTs) / 1000) + 's) — laps in this window flagged.', 'warn'); } catch (_) {}
  }
  stintLastSampleTs = now;
  stintPositions.push({lat,lng,time:now,speed:speed||0});
  // Trim to cap so very long stints don't unbounded the trace.
  if (stintPositions.length > POSITIONS_CAP) {
    stintPositions = stintPositions.slice(-POSITIONS_CAP);
  }

  // Update map
  try {
    if (stintMap&&stintPolyline) {
      stintPolyline.addLatLng([lat,lng]);
      if (stintMarker) stintMarker.setLatLng([lat,lng]);
      else if (typeof L!=='undefined') stintMarker=L.circleMarker([lat,lng],{radius:7,fillColor:'#22c55e',fillOpacity:1,color:'#fff',weight:2}).addTo(stintMap);
      stintMap.panTo([lat,lng]);
    }
  } catch(e){}

  // Movement tracking. iOS Geolocation reports `null` speed mid-stride
  // between fixes — the previous code treated null as stationary and
  // reset moveContinuousStart on every null sample, so the 7.5-min
  // continuous-movement timer never expired and auto-start-point
  // never fired on iPhones. Treat null as "unknown — keep counting"
  // and only reset on a confirmed-stationary sample (speed is a
  // number AND below threshold).
  const movingOrUnknown = speed == null || speed > MIN_SPEED_MS;
  if (movingOrUnknown) {
    if (!moveContinuousStart) moveContinuousStart=now;
    if (!rdd.startPointSet && (now-moveContinuousStart)/1000>=AUTO_START_SECS) {
      setStartPoint(lat,lng).then(()=>{
        addStartMarker(lat,lng);
        lastLapTime = now;
        ctx.showToast('Start/finish point set.','success');
      });
    }
  } else { moveContinuousStart=null; }

  // Overlap detection (same point twice = start/finish)
  if (!rdd.startPointSet && stintPositions.length>20) {
    const first=stintPositions[0], elapsed=(now-first.time)/1000;
    if (elapsed>60 && haversine(lat,lng,first.lat,first.lng)<LAP_THRESHOLD_M) {
      setStartPoint(first.lat,first.lng).then(()=>{
        addStartMarker(first.lat,first.lng);
        // Seed lastLapTime so the first lap measures from the start
        // point being set, not from stintStartTime — was producing
        // 7+ minute first laps when auto-set fired late.
        lastLapTime = now;
        ctx.showToast('Start/finish point set.','success');
      });
    }
  }

  // Lap detection
  if (rdd.startPointSet && rdd.startPoint) {
    const dist=haversine(lat,lng,rdd.startPoint.lat,rdd.startPoint.lng);
    const timeSinceLast=lastLapTime ? now-lastLapTime : now-stintStartTime;
    if (dist<LAP_THRESHOLD_M && timeSinceLast>20000) {
      const dur=lastLapTime ? now-lastLapTime : now-stintStartTime;
      recordManualLap(dur, { time: now, lat, lng });
    }
  }
}

// Manual / GPS-agnostic lap commit. Used by both the auto-detection
// path above and the manual-tap button on the active-stint screen for
// when GPS is unavailable. Was previously inlined inside onPos —
// renderActiveStint advertised "tap laps manually" with no tappable
// element, which made the GPS-error fallback a dead promise.
function recordManualLap(durMs, opts = {}) {
  if (!stintActive) return;
  const now = opts.time || Date.now();
  const dur = (typeof durMs === 'number' && durMs > 0) ? durMs : (lastLapTime ? now - lastLapTime : now - stintStartTime);
  // Reject implausibly fast laps (<3s) so a triple-tap doesn't pollute.
  if (dur < 3000) return;
  try { ctx.haptic?.('heavy'); } catch(e) {}
  stintLaps.push({ time: now, duration: dur, lat: opts.lat, lng: opts.lng, source: opts.source || (opts.lat ? 'gps' : 'manual') });
  lastLapTime = now;
  ctx.showToast('Lap ' + stintLaps.length + ' · ' + fmtMs(dur), 'success');
  speakRaceCue('lap-' + stintLaps.length, dur);
  updateActive();
  // Pit predictor + crash detector check on every new lap.
  try { checkPitPredictor(); } catch(_) {}
  try { checkCrashDetector(); } catch(_) {}
  // Persist current state for cold-boot recovery (rec #5).
  persistStintState();
}

// ── Crash detector ────────────────────────────────────────────────
// Two trigger conditions, each tuned to be conservative:
//   1. NO lap recorded for >5 min AFTER the rider has completed at
//      least 2 laps (normal lap is 3-5 min; 5+ min silence is a real
//      anomaly — almost certainly stopped or off-course)
//   2. Sudden HR collapse: ≥30 bpm drop within 10s while otherwise
//      mid-stint. Reads from window._tpLatestHR which the watch
//      sync pipeline already feeds.
// On trigger:
//   • Vibrate + show in-app "Are you OK?" prompt with 15-sec timeout
//   • If no response in 15s → write to team /alerts as a coach SOS
//   • Speak "Crash detected, are you OK?" via TTS
let _crashHrSamples = [];       // sliding 20s HR samples
let _crashAlertedThisStint = false;
function checkCrashDetector() {
  if (!stintActive || _crashAlertedThisStint) return;
  // ── Stale-lap check ──
  if (stintLaps.length >= 2) {
    const now = Date.now();
    const last = stintLaps[stintLaps.length - 1].time;
    const silentMs = now - last;
    if (silentMs > 5 * 60 * 1000) {
      triggerCrashPrompt('No lap detected in 5 min — are you OK?');
      return;
    }
  }
}
function _crashHrTick(bpm) {
  if (!stintActive || !Number.isFinite(bpm) || bpm <= 0) return;
  const now = Date.now();
  _crashHrSamples.push({ t: now, bpm });
  // Keep last 20s only.
  _crashHrSamples = _crashHrSamples.filter(s => now - s.t < 20000);
  if (_crashHrSamples.length < 4) return;
  const oldest = _crashHrSamples[0].bpm;
  const newest = _crashHrSamples[_crashHrSamples.length - 1].bpm;
  if (oldest - newest >= 30) {
    triggerCrashPrompt('HR dropped sharply — are you OK?');
  }
}
function triggerCrashPrompt(reason) {
  if (_crashAlertedThisStint) return;
  _crashAlertedThisStint = true;
  try { ctx.haptic?.('heavy'); } catch(_) {}
  speakRaceCue('crash', null, reason);
  // Build a confirm modal that auto-escalates after 15s.
  document.getElementById('rd-crash-prompt')?.remove();
  const ov = document.createElement('div');
  ov.id = 'rd-crash-prompt';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
  ov.innerHTML = `
    <div style="background:#1a0a0a;border:2px solid #ef4444;border-radius:18px;padding:22px;max-width:340px;text-align:center;animation:pulse 1s ease-in-out infinite alternate">
      <div style="font-size:42px;margin-bottom:8px">⚠️</div>
      <div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:8px">Are you OK?</div>
      <div style="font-size:13px;color:#ffcccc;margin-bottom:18px;line-height:1.45">${reason}<br><br>If you don't respond in <span id="rd-crash-countdown" style="font-weight:900;color:#fff">15</span>s, your coach will be alerted.</div>
      <div style="display:flex;gap:8px">
        <button id="rd-crash-ok" type="button" style="flex:1;padding:14px;border-radius:12px;background:#22c55e;color:#fff;border:none;font-weight:800;font-size:15px;cursor:pointer">I'm OK</button>
        <button id="rd-crash-help" type="button" style="flex:1;padding:14px;border-radius:12px;background:#ef4444;color:#fff;border:none;font-weight:800;font-size:15px;cursor:pointer">Get Help</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  let remaining = 15;
  const countdown = setInterval(() => {
    remaining--;
    const c = document.getElementById('rd-crash-countdown');
    if (c) c.textContent = String(remaining);
    if (remaining <= 0) {
      clearInterval(countdown);
      escalateCrashAlert(reason);
      ov.remove();
    }
  }, 1000);
  ov.querySelector('#rd-crash-ok').addEventListener('click', () => {
    clearInterval(countdown);
    ov.remove();
    ctx.showToast?.('Glad you\'re OK. Stint continues.', 'success');
  });
  ov.querySelector('#rd-crash-help').addEventListener('click', () => {
    clearInterval(countdown);
    escalateCrashAlert(reason);
    ov.remove();
  });
}
async function escalateCrashAlert(reason) {
  try { ctx.haptic?.('heavy'); } catch(_) {}
  ctx.showToast?.('Coach alerted.', 'warn');
  if (!ctx?.db || !ctx.userProfile?.teamId) return;
  try {
    const aRef = ctx.doc(ctx.collection(ctx.db, 'teams', ctx.userProfile.teamId, 'alerts'));
    await ctx.setDoc(aRef, {
      kind: 'crash-prompt-unanswered',
      reason,
      driver: ctx.userProfile?.displayName || 'Driver',
      driverUid: ctx.currentUser?.uid || null,
      stintStartTime,
      lapCount: stintLaps.length,
      createdAt: ctx.serverTimestamp(),
    });
  } catch (e) { console.warn('crash alert write failed:', e?.message || e); }
}

// ── Pit predictor ─────────────────────────────────────────────────
// Two trigger conditions:
//   1. Time-based: stint elapsed >25 min since start or last pit
//   2. Performance-based: latest lap is >7% slower than fastest of
//      the last 5, indicating fatigue
// Either condition shows a non-blocking "Time to pit?" suggestion
// that the rider can accept or dismiss. Re-triggers no more than
// once every 90 sec.
let _lastPitSuggestionAt = 0;
function checkPitPredictor() {
  if (!stintActive) return;
  const now = Date.now();
  if (now - _lastPitSuggestionAt < 90 * 1000) return;
  const sinceLastPit = stintPitStops.length
    ? now - stintPitStops[stintPitStops.length - 1].ts
    : now - stintStartTime;
  // Trigger 1: 25-min window
  if (sinceLastPit > 25 * 60 * 1000) {
    showPitSuggestion('You\'ve been out 25+ min — consider pitting.');
    return;
  }
  // Trigger 2: degradation
  if (stintLaps.length >= 5) {
    const recent = stintLaps.slice(-5);
    const fastest = Math.min(...recent.map(l => l.duration));
    const latest = recent[recent.length - 1].duration;
    if (latest > fastest * 1.07) {
      showPitSuggestion('Last lap was 7% off best — fatigue showing.');
    }
  }
}
function showPitSuggestion(message) {
  _lastPitSuggestionAt = Date.now();
  speakRaceCue('pit-suggest');
  try { ctx.haptic?.('medium'); } catch(_) {}
  // Banner — non-blocking, auto-hides in 12 sec.
  document.getElementById('rd-pit-banner')?.remove();
  const b = document.createElement('div');
  b.id = 'rd-pit-banner';
  b.style.cssText = 'position:fixed;left:12px;right:12px;top:env(safe-area-inset-top,12px);z-index:9200;padding:12px 14px;background:linear-gradient(135deg, #fbbf24, #f59e0b);color:#000;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);display:flex;align-items:center;gap:10px;font-weight:700;animation:tp-pit-slide-down .3s ease-out both';
  b.innerHTML = `
    <span style="font-size:22px">⛽</span>
    <span style="flex:1;font-size:13px;line-height:1.3">${message}</span>
    <button id="rd-pit-dismiss" type="button" style="background:rgba(0,0,0,.18);border:none;color:#000;padding:6px 10px;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer">OK</button>
  `;
  document.body.appendChild(b);
  document.getElementById('rd-pit-dismiss').addEventListener('click', () => b.remove());
  setTimeout(() => b.remove(), 12000);
}

// ── Voice race-day callouts ───────────────────────────────────────
// Uses the existing Web Speech API the workout timer already uses.
// Off by default — opt-in via tp_race_voice in localStorage. Speaks
// short cues for lap completion, best-lap improvement, pit prompt,
// crash check, and stint end.
let _bestLapSpoken = Infinity;
function speakRaceCue(kind, value = null, message = null) {
  try {
    if (localStorage.getItem('tp_race_voice') !== '1') return;
    if (!('speechSynthesis' in window)) return;
    let text = null;
    if (kind.startsWith('lap-')) {
      const n = stintLaps.length;
      const dur = value || (stintLaps[n - 1]?.duration);
      if (!dur) return;
      const isBest = dur < _bestLapSpoken;
      if (isBest && n > 1) {
        _bestLapSpoken = dur;
        text = `New best lap, ${Math.floor(dur / 60000)} minutes ${Math.floor((dur % 60000) / 1000)} seconds`;
      } else if (n === 1) {
        _bestLapSpoken = dur;
        text = `Lap one`;
      } else {
        // Speak every 5th lap to avoid annoyance.
        if (n % 5 === 0) text = `Lap ${n}`;
      }
    } else if (kind === 'pit-suggest') {
      text = 'Time to pit';
    } else if (kind === 'pit-window') {
      // Heads-up rec #9 — fired once when pit ETA crosses 3 min so the
      // rider can plan their approach rather than being told "now".
      text = 'Pit window in three minutes';
    } else if (kind === 'crash') {
      text = message || 'Are you OK?';
    } else if (kind === 'stint-end') {
      text = `Great stint, ${stintLaps.length} laps`;
    }
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.volume = 0.95;
    window.speechSynthesis.speak(u);
  } catch(_) {}
}
window.tpRaceVoice = {
  enable: () => { localStorage.setItem('tp_race_voice', '1'); },
  disable: () => { localStorage.removeItem('tp_race_voice'); },
  isEnabled: () => localStorage.getItem('tp_race_voice') === '1',
};
// HR sample hook — called by app.js when a new HR reading arrives
// from the watch. Plumbed via window._tpFeedCrashHR(bpm).
window._tpFeedCrashHR = _crashHrTick;

function addStartMarker(lat,lng) {
  try {
    if (typeof L!=='undefined'&&stintMap) {
      L.circleMarker([lat,lng],{radius:14,fillColor:'#f97316',fillOpacity:.9,color:'#fff',weight:3}).addTo(stintMap).bindPopup('Start / Finish').openPopup();
    }
  } catch(e){}
}

function renderActiveStint(c) {
  // The active-stint UI is wrapped in .rd-active-grid so the CSS at
  // the bottom of styles.css can flow it into a 2-column grid on
  // landscape iPads / wide desktops (rec #6 — pit-display layout).
  // On phone portrait the wrapper is a plain flex column.
  c.innerHTML=`
  <div class="rd-active-grid">
    <div class="rd-active-col-a">
    <div style="text-align:center;padding-top:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">● STINT ACTIVE</div>
      <div id="rd-timer" style="font-size:60px;font-weight:800;font-family:var(--font-mono);color:var(--fg);line-height:1">00:00</div>
      <div id="rd-sublabel" style="font-size:12px;color:var(--muted-fg);margin-top:4px">GPS connecting...</div>
    </div>
    <div id="rd-live-map" style="width:100%;height:140px;border-radius:12px;overflow:hidden;background:#0a1628;margin-bottom:10px"></div>
    </div>
    <div class="rd-active-col-b">
    <div style="display:flex;align-items:center;justify-content:space-around;gap:4px;margin-bottom:10px;padding:8px 8px;border:1px solid var(--border);border-radius:99px;background:var(--card)">
      <div style="text-align:center;min-width:0"><span id="rd-al" style="font-size:14px;font-weight:800;color:var(--primary)">0</span> <span style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-left:2px">laps</span></div>
      <div style="width:1px;height:14px;background:var(--border)"></div>
      <div style="text-align:center;min-width:0"><span id="rd-ll" style="font-size:14px;font-weight:800;color:var(--fg);font-family:var(--font-mono)">--:--</span> <span style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-left:2px">last</span></div>
      <div style="width:1px;height:14px;background:var(--border)"></div>
      <div style="text-align:center;min-width:0"><span id="rd-bl" style="font-size:14px;font-weight:800;color:var(--success);font-family:var(--font-mono)">--:--</span> <span style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-left:2px">best</span></div>
      <div style="width:1px;height:14px;background:var(--border)"></div>
      <div style="text-align:center;min-width:0"><span id="rd-pc" style="font-size:14px;font-weight:800;color:var(--warning, #f97316)">0</span> <span style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-left:2px">pits</span></div>
      <div style="width:1px;height:14px;background:var(--border)"></div>
      <div style="text-align:center;min-width:0"><span id="rd-pit-eta" style="font-size:14px;font-weight:800;color:var(--fg);font-family:var(--font-mono)">--:--</span> <span style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-left:2px">next pit</span></div>
      <div style="width:1px;height:14px;background:var(--border)"></div>
      <div style="text-align:center;min-width:0"><span id="rd-watch-bat" style="font-size:14px;font-weight:800;color:var(--muted-fg);font-family:var(--font-mono)">—</span> <span style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-left:2px">watch</span></div>
    </div>
    <div id="rd-laplist" style="margin-bottom:10px;max-height:180px;overflow-y:auto"></div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button id="rd-tap-lap" style="flex:1;padding:14px;border-radius:12px;background:rgba(var(--success-rgb),.10);border:1px solid rgba(var(--success-rgb),.35);color:var(--success);font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent">Tap Lap</button>
      <button id="rd-pit-btn" style="flex:1;padding:14px;border-radius:12px;background:rgba(var(--warning-rgb),.10);border:1px solid rgba(var(--warning-rgb),.35);color:var(--warning, #f97316);font-size:13px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent">+ Pit Stop</button>
      <button id="rd-end-stint" style="flex:1;padding:14px;border-radius:12px;background:var(--destructive);color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent">End</button>
    </div>
    <button id="rd-rider-down" style="width:100%;padding:11px;border-radius:12px;background:rgba(var(--destructive-rgb),.10);border:1px solid rgba(var(--destructive-rgb),.40);color:var(--destructive);font-size:12.5px;font-weight:800;cursor:pointer;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;-webkit-tap-highlight-color:transparent">Rider down / mechanical — flag pit</button>
    </div>
  </div>`;

  setTimeout(()=>{
    try {
      if (typeof L==='undefined') return;
      const el=document.getElementById('rd-live-map'); if(!el) return;
      // Tear down any prior stint map/polyline before creating a new one.
      // Re-rendering the active-stint view (e.g. on lap completion or
      // route polling) used to stack a second polyline on top of the
      // first, drawing the GPS line twice. removeLayer + map.remove()
      // keeps a single set of tiles + line per stint.
      if (stintMap) { try { stintMap.remove(); } catch(e) {} stintMap = null; }
      stintPolyline = null;
      stintMarker = null;
      stintMap=L.map('rd-live-map',{zoomControl:false,attributionControl:false});
      L.tileLayer(ctx.getMapTileUrl(),{maxZoom:19}).addTo(stintMap);
      stintPolyline=L.polyline([],{color:'#f97316',weight:4,opacity:.9}).addTo(stintMap);
      if (rdd.startPointSet&&rdd.startPoint) {
        stintMap.setView([rdd.startPoint.lat,rdd.startPoint.lng],17);
        L.circleMarker([rdd.startPoint.lat,rdd.startPoint.lng],{radius:12,fillColor:'#f97316',fillOpacity:.9,color:'#fff',weight:2}).addTo(stintMap);
      } else {
        // Silent centering — watchPosition below (in startStint) is what
        // actually pulls live GPS during the stint. The map-centering call
        // doesn't need its own prompt.
        try {
          const last = JSON.parse(localStorage.getItem('tp_last_coords') || 'null');
          if (last && Number.isFinite(last.lat) && Number.isFinite(last.lon)) {
            stintMap.setView([last.lat, last.lon], 16);
          } else {
            stintMap.setView([-37.81, 144.96], 14);
          }
        } catch (_) { stintMap.setView([-37.81, 144.96], 14); }
      }
    } catch(e){}
  },150);

  // End Stint sits inches from the lap timer — fat-finger danger during a
  // ride. Require a confirm so a single mis-tap doesn't kill an in-progress
  // stint.
  c.querySelector('#rd-end-stint')?.addEventListener('click',()=>{
    if (!confirm('End your stint? Lap times stop now.')) return;
    endStint(c);
  });
  // Manual-lap fallback for when GPS is unreliable. The sublabel under
  // the timer already advertises this as available; previously there
  // was no actual button to tap.
  c.querySelector('#rd-tap-lap')?.addEventListener('click', () => {
    const now = Date.now();
    const dur = lastLapTime ? (now - lastLapTime) : (now - stintStartTime);
    recordManualLap(dur, { time: now, source: 'manual' });
  });
  // Rider-down / mechanical flag (rec #4). Reuses the existing crash-
  // alert path — writes a `kind: 'rider-down-manual'` doc into the
  // team's alerts so the pit sees it immediately, voices the call,
  // stamps the stint record so the post-race archive shows it.
  c.querySelector('#rd-rider-down')?.addEventListener('click', () => {
    if (!confirm('Flag rider down / mechanical and alert the pit?')) return;
    try { ctx.haptic?.('heavy'); } catch(_) {}
    stintRiderDownFlag = { ts: Date.now(), reason: 'rider-down-manual' };
    try { speakRaceCue('crash', null, 'Rider down — pit alerted.'); } catch(_) {}
    // Write the alert via the existing escalate path with a manual kind.
    (async () => {
      try {
        if (!ctx?.db || !ctx.userProfile?.teamId) return;
        const aRef = ctx.doc(ctx.collection(ctx.db, 'teams', ctx.userProfile.teamId, 'alerts'));
        await ctx.setDoc(aRef, {
          kind: 'rider-down-manual',
          reason: 'Manual rider-down flag',
          driver: ctx.userProfile?.displayName || 'Driver',
          driverUid: ctx.currentUser?.uid || null,
          stintStartTime,
          lapCount: stintLaps.length,
          createdAt: ctx.serverTimestamp(),
        });
        ctx.showToast?.('Pit alerted — help is on the way.', 'warn');
      } catch (e) { console.warn('rider-down write failed:', e?.message || e); }
    })();
    persistStintState();
  });
  // Pit-stop counter — single-tap to log a stop. Also updates the
  // live spectator state so coaches see pit count climb in real time.
  c.querySelector('#rd-pit-btn')?.addEventListener('click', () => {
    const now = Date.now();
    stintPitStops.push({ ts: now });
    try { ctx.haptic?.('light'); } catch(_) {}
    const pc = document.getElementById('rd-pc');
    if (pc) {
      pc.textContent = String(stintPitStops.length);
      pc.style.transition = 'transform .15s';
      pc.style.transform = 'scale(1.25)';
      setTimeout(() => { pc.style.transform = 'scale(1)'; }, 150);
    }
    try { ctx.showToast?.('Pit ' + stintPitStops.length + ' logged', 'info'); } catch(_) {}
    // Best-effort live publish so the spectator panel ticks up. The
    // 1s publishLiveStint loop will catch up too — this is just for
    // immediate feedback.
    try { publishLiveStint(); } catch(_) {}
  });
  updateActive();
}

function updateActive() {
  const elapsed=Date.now()-stintStartTime;
  // Run crash + pit detectors on each 1Hz tick so stale-lap timeouts
  // fire even when no new lap event triggers checkPitPredictor.
  try { checkCrashDetector(); } catch(_) {}
  try { checkPitPredictor(); } catch(_) {}
  const t=document.getElementById('rd-timer'); if(t) t.textContent=fmtTime(elapsed);
  const sl=document.getElementById('rd-sublabel');
  if (sl) {
    if (stintGpsState === 'error') {
      sl.innerHTML = '<span style="color:var(--warning)">GPS unavailable — tap laps manually.</span>';
    } else if (stintGpsState === 'connecting') {
      sl.textContent = 'GPS connecting…';
    } else if (stintLaps.length > 0) {
      // Continuous gap-to-PB ghost-line (rec #8). Append the delta
      // between the current best lap and the rider's all-time PB for
      // this race, so they can see live whether this stint is on
      // record pace.
      let pbDelta = '';
      if (stintPbLapMs && stintLaps.length > 0) {
        const bestThisStint = Math.min.apply(null, stintLaps.map(l => l.duration));
        const d = bestThisStint - stintPbLapMs;
        const abs = Math.abs(d);
        const sec = (abs / 1000).toFixed(1);
        const sign = d < 0 ? '−' : (d > 0 ? '+' : '=');
        const colour = d < 0 ? '#22c55e' : d > 0 ? '#ef4444' : 'var(--muted-fg)';
        pbDelta = ' · <span style="color:' + colour + ';font-weight:700">' + (d === 0 ? '= PB' : (sign + sec + 's vs PB')) + '</span>';
      }
      sl.innerHTML = 'Lap ' + (stintLaps.length) + ' in progress' + pbDelta;
    } else if (rdd.startPointSet) {
      sl.textContent = 'Approaching start/finish…';
    } else {
      sl.textContent = 'Waiting for start/finish point…';
    }
  }
  const al=document.getElementById('rd-al'); if(al) al.textContent=stintLaps.length;
  // Live pit countdown (rec #2). Mirrors checkPitPredictor's 25-min
  // window: target = 25 min since last pit (or stint start).
  const pitEta = document.getElementById('rd-pit-eta');
  if (pitEta) {
    const lastPitTs = stintPitStops.length
      ? stintPitStops[stintPitStops.length - 1].ts
      : stintStartTime;
    const sinceLastPit = Date.now() - lastPitTs;
    const remainingMs = 25 * 60 * 1000 - sinceLastPit;
    if (remainingMs <= 0) {
      pitEta.textContent = 'NOW';
      pitEta.style.color = 'var(--destructive)';
    } else {
      pitEta.textContent = fmtTime(remainingMs);
      pitEta.style.color = remainingMs < 5 * 60 * 1000 ? 'var(--warning, #f97316)' : 'var(--fg)';
    }
    // 3-minute pit-window heads-up (rec #9) — voice once per window.
    if (remainingMs > 0 && remainingMs <= 3 * 60 * 1000
        && stintPitWindowAlertedFor !== lastPitTs) {
      stintPitWindowAlertedFor = lastPitTs;
      try { speakRaceCue('pit-window'); } catch (_) {}
      try { ctx.showToast?.('Pit window in 3 min — start planning approach.', 'info'); } catch (_) {}
    }
  }
  // Watch battery display (rec #50). Latest sample was pushed by the
  // Watch via ConnectivityService → tpNative.onWatchBattery; show it
  // and colour-warn under 20%. Treat data >5 min old as stale.
  const watchEl = document.getElementById('rd-watch-bat');
  if (watchEl) {
    const wb = window._tpWatchBattery;
    if (wb && (Date.now() - wb.at) < 5 * 60 * 1000) {
      const pct = Math.round((wb.level || 0) * 100);
      const charging = wb.state === 2 || wb.state === 3;
      watchEl.textContent = pct + '%' + (charging ? '⚡' : '');
      watchEl.style.color = pct < 20 ? 'var(--destructive)' : (pct < 40 ? 'var(--warning, #f97316)' : 'var(--fg)');
    } else {
      watchEl.textContent = '—';
      watchEl.style.color = 'var(--muted-fg)';
    }
  }
  if (stintLaps.length>0) {
    const last=stintLaps[stintLaps.length-1], best=[...stintLaps].sort((a,b)=>a.duration-b.duration)[0];
    const ll=document.getElementById('rd-ll'); if(ll) ll.textContent=fmtMs(last.duration);
    const bl=document.getElementById('rd-bl'); if(bl) bl.textContent=fmtMs(best.duration);
    const lapList=document.getElementById('rd-laplist');
    if (lapList) {
      const bestDur=Math.min(...stintLaps.map(l=>l.duration));
      // Median of laps so we can colour each lap by trend (rec #7).
      // Faster than median × 0.95 = green; within ±5% = neutral;
      // slower than median × 1.05 = red.
      const sorted = stintLaps.map(l => l.duration).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 1;
      const trendColor = (durMs) => {
        if (durMs <= median * 0.95) return 'var(--success)';
        if (durMs >= median * 1.05) return 'var(--destructive)';
        return 'var(--fg)';
      };
      lapList.innerHTML=stintLaps.slice().reverse().map((lap,i)=>{
        const idx = stintLaps.length - 1 - i; // index into stintLaps[]
        const n=idx+1, isBest=lap.duration===bestDur;
        const conf = lapConfidence(lap);
        const confBadge = conf === 'low'
          ? '<span title="GPS gap during this lap — confidence low" style="font-size:9px;font-weight:800;color:var(--warning,#f97316);padding:1px 5px;border:1px solid rgba(var(--warning-rgb,249,115,22),.4);border-radius:99px;letter-spacing:.04em">LOW</span>'
          : (conf === 'manual'
              ? '<span title="Recorded manually" style="font-size:9px;font-weight:800;color:var(--muted-fg);padding:1px 5px;border:1px solid var(--border);border-radius:99px;letter-spacing:.04em">MANUAL</span>'
              : '');
        const c = isBest ? 'var(--success)' : trendColor(lap.duration);
        return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px">
          <span style="color:var(--muted-fg);width:54px">Lap ${n}</span>
          <span style="flex:1;font-weight:700;font-family:var(--font-mono);color:${c}">${fmtMs(lap.duration)}</span>
          ${confBadge}
          ${isBest?'<span style="font-size:10px;color:var(--success);font-weight:700">BEST</span>':''}
          <button class="rd-lap-del" data-lap-idx="${idx}" aria-label="Remove lap ${n}" title="Remove lap" style="margin-left:4px;background:transparent;border:none;color:var(--muted-fg);font-size:14px;line-height:1;padding:0 4px;cursor:pointer">×</button>
        </div>`;
      }).join('');
      // Bind delete buttons. Each click confirms then splices the lap.
      // Used to correct an auto-detected lap that was a false positive
      // (rec #11). Re-renders via updateActive.
      lapList.querySelectorAll('.rd-lap-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.lapIdx || '-1', 10);
          if (idx < 0 || idx >= stintLaps.length) return;
          const n = idx + 1;
          if (!confirm('Remove lap ' + n + '? You can re-add it with Tap Lap.')) return;
          const removed = stintLaps.splice(idx, 1)[0];
          // Re-anchor lastLapTime so the next auto-lap measures from
          // the most-recent surviving lap (or stint start).
          lastLapTime = stintLaps.length ? stintLaps[stintLaps.length - 1].time : null;
          try { ctx.showToast?.('Lap ' + n + ' removed.', 'info'); } catch (_) {}
          try { ctx.haptic?.('light'); } catch (_) {}
          persistStintState();
          updateActive();
        });
      });
    }
  }
}

async function endStint(c) {
  // Voice end-of-stint summary while we still have stintActive=true
  // (speakRaceCue gates on it being true to avoid spamming idle UI).
  try { speakRaceCue('stint-end'); } catch(_) {}
  stintActive=false;
  // Tear down the iOS Live Activity. Best-effort.
  try {
    window.webkit?.messageHandlers?.tpNative?.postMessage({ type: 'live-activity-end' });
  } catch(_) {}
  try {
    window._tpRaceDayStintActive = false;
    window._tpRaceDayStintStartedAt = 0;
    window._tpRaceDayStintLabel = null;
    window.CentreBar?.refresh?.();
  } catch(_) {}
  // Hydrate stintStartTime from localStorage if it's null (cold-boot
  // mid-stint case), then clamp duration to the 25-hour max so a
  // stale persisted value can't write a 55-year stint to Firestore.
  if (!stintStartTime) {
    try {
      const persisted = parseInt(localStorage.getItem('tp_stint_start') || '0', 10);
      if (persisted && persisted > Date.now() - rdd.maxDurationMs) stintStartTime = persisted;
    } catch(e) {}
  }
  if (!stintStartTime) stintStartTime = Date.now() - 1000; // last-resort: 1s stint
  try { localStorage.removeItem('tp_stint_start'); } catch(e) {}
  clearInterval(stintInterval); stintInterval=null;
  clearInterval(stintLiveInterval); stintLiveInterval=null;
  if (stintGpsTimeout) { clearTimeout(stintGpsTimeout); stintGpsTimeout=null; }
  stintGpsState='idle';
  if (stintWatchId!==null){ navigator.geolocation.clearWatch(stintWatchId); stintWatchId=null; }
  // Release the wake lock if we held one — saveStint reference at top
  // of file holds it so GC can't kill it mid-stint.
  try { await stintWakeLock?.release?.(); } catch(e) {}
  stintWakeLock = null;
  const rawDuration = Date.now() - stintStartTime;
  // Clamp to the configured max (default 25h) — protects against
  // stale persisted stintStartTime values from earlier sessions.
  const cappedDuration = Math.min(rdd.maxDurationMs || (25 * 60 * 60 * 1000), Math.max(0, rawDuration));
  const record={
    uid:ctx.currentUser?.uid, displayName:ctx.userProfile?.displayName||'Unknown',
    // Team stamping — lets the spectator + multi-team race archive
    // group stints by team without joining against the users table.
    teamId: ctx.userProfile?.teamId || null,
    teamName: ctx.teamData?.name || ctx.userProfile?.teamName || 'Team',
    startTime:stintStartTime, endTime:Date.now(), duration:cappedDuration,
    // Was slice(0,500) which kept the FIRST 500 points — for a
    // 24-hour Maryborough stint at 1Hz that's the first 8.3 minutes
    // only. Take the most-recent 500 to preserve the end of the stint
    // (where the rider's actually ridden the most distance).
    // Per-lap confidence (rec #14) is computed at save time so the
    // archive carries the trust-level alongside the raw duration.
    laps:stintLaps.map(l => ({ ...l, confidence: lapConfidence(l) })),
    positions:stintPositions.slice(-POSITIONS_CAP), // rec #15 — raw trace
    positionsCount: stintPositions.length,
    pitStops: stintPitStops.length,
    pitTimestamps: stintPitStops.map(p => p.ts),
    gpsGaps: stintGpsGaps,                          // rec #12
    riderDownFlag: stintRiderDownFlag,              // rec #4
  };
  // Save the stint FIRST. If this fails (network flake), we still want
  // the live doc up so the spectator panel doesn't show "off track" for
  // a stint that hasn't been archived yet. Was previously clearing live
  // first, so flaky network = "live cleared, stint never saved".
  await saveStint(record);
  await clearLiveStint();
  todayStints=todayStints.filter(s=>s.uid!==record.uid); todayStints.push(record);
  stintMap=null; stintPolyline=null; stintMarker=null;
  // Clean up per-stint module state so the next stint starts fresh.
  stintGpsGaps = []; stintLastSampleTs = 0; stintRiderDownFlag = null;
  clearPersistedStintState();
  renderStintSummary(c,record);
}

function renderStintSummary(c,stint) {
  const best=stint.laps.length>0?fmtMs(Math.min(...stint.laps.map(l=>l.duration))):'--:--';
  const avg=stint.laps.length>0?fmtMs(stint.laps.reduce((s,l)=>s+l.duration,0)/stint.laps.length):'--:--';
  const myBestMs = stint.laps.length>0?Math.min(...stint.laps.map(l=>l.duration)):null;
  c.innerHTML=`
    <div style="text-align:center;padding:16px 0 20px">
      <div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Stint Complete</div>
      <div style="font-size:48px;font-weight:800;font-family:var(--font-mono);color:var(--primary)">${fmtTime(stint.duration)}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:16px">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--primary)">${stint.laps.length}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Laps</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--success)">${best}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Best</div>
        <div id="rd-ghost-best" style="font-size:9px;margin-top:2px;font-weight:700">&nbsp;</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--fg)">${avg}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Avg</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:var(--warning, #f97316)">${stint.pitStops || 0}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Pits</div>
      </div>
    </div>
    ${stint.laps.map((lap,i)=>`
      <div data-ghost-lap="${lap.duration}" style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px">
        <span style="color:var(--muted-fg);width:54px">Lap ${i+1}</span>
        <span style="flex:1;font-weight:700;font-family:var(--font-mono)">${fmtMs(lap.duration)}</span>
        <span class="rd-ghost-delta" style="font-size:10.5px;font-weight:700;color:var(--muted-fg);min-width:60px;text-align:right">&nbsp;</span>
      </div>`).join('')}
    <div style="display:flex;gap:8px;margin-top:16px">
      <button id="rd-share-rep" class="btn btn-primary" style="flex:1">Share Report</button>
      <button id="rd-done" class="btn btn-secondary" style="flex:1">Done</button>
    </div>`;
  c.querySelector('#rd-share-rep')?.addEventListener('click', () => openShareReportSheet(stint));
  c.querySelector('#rd-done')?.addEventListener('click', () => renderStintTab(c));
  // Ghost-line: fetch this rider's previous-best lap at this race
  // (across all prior years) and annotate each lap with the delta.
  // Best is also tagged "🟢 -1.2s" or "🔴 +0.8s" vs personal record.
  (async () => {
    try {
      if (!ctx?.db || !ctx.currentUser || !rdd.raceId || myBestMs == null) return;
      const yearsSnap = await ctx.getDocs(ctx.collection(ctx.db, 'race_archive', rdd.raceId, 'years'));
      let pbLapMs = Infinity;
      for (const yd of yearsSnap.docs) {
        const myStintRef = ctx.doc(ctx.db, 'race_archive', rdd.raceId, 'years', yd.id, 'stints', ctx.currentUser.uid);
        const myStint = await ctx.getDoc(myStintRef).catch(() => null);
        if (!myStint?.exists?.()) continue;
        const data = myStint.data() || {};
        const laps = Array.isArray(data.laps) ? data.laps : [];
        for (const lap of laps) {
          const d = lap?.duration;
          if (typeof d === 'number' && d > 3000 && d < pbLapMs) pbLapMs = d;
        }
      }
      if (!Number.isFinite(pbLapMs)) return;
      // Update "best" chip with delta-to-PB
      const fmtDelta = (ms) => {
        const abs = Math.abs(ms);
        const sec = Math.floor(abs / 1000), tenths = Math.floor((abs % 1000) / 100);
        return (ms >= 0 ? '+' : '-') + sec + '.' + tenths + 's';
      };
      const bestEl = c.querySelector('#rd-ghost-best');
      if (bestEl) {
        const d = myBestMs - pbLapMs;
        const colour = d < 0 ? '#22c55e' : d > 0 ? '#ef4444' : 'var(--muted-fg)';
        bestEl.style.color = colour;
        bestEl.textContent = d === 0 ? '= PB' : `${fmtDelta(d)} vs PB`;
      }
      // Annotate each lap with delta-to-PB
      c.querySelectorAll('[data-ghost-lap]').forEach(row => {
        const ms = parseInt(row.dataset.ghostLap, 10);
        if (!Number.isFinite(ms)) return;
        const d = ms - pbLapMs;
        const colour = d < 0 ? '#22c55e' : d > 0 ? '#ef4444' : 'var(--muted-fg)';
        const span = row.querySelector('.rd-ghost-delta');
        if (span) {
          span.style.color = colour;
          span.textContent = d === 0 ? '= PB' : fmtDelta(d);
        }
      });
    } catch (e) { console.warn('ghost-line fetch failed:', e?.message || e); }
  })();
}

// Two distinct report formats (just-this-stint, full team) used to be
// two competing buttons of equal weight in the summary footer. Now
// they live behind a single "Share Report" entry that opens a sheet
// with two clearly-labelled options + a Cancel.
function openShareReportSheet(stint) {
  ctx.openSheet();
  ctx.$('sheet-content').innerHTML = `
    <div class="sheet-title">Share Report</div>
    <p style="font-size:12px;color:var(--muted-fg);margin-bottom:14px">Send a stint summary to coaches, parents, or the team.</p>
    <button class="btn btn-secondary" style="width:100%;text-align:left;padding:14px;margin-bottom:8px" id="rd-rep-mine">
      <div style="font-size:14px;font-weight:700;color:var(--fg)">Just my stint</div>
      <div style="font-size:11px;color:var(--muted-fg);margin-top:2px;font-weight:500">${stint.laps.length} laps · ${fmtTime(stint.duration)}</div>
    </button>
    <button class="btn btn-secondary" style="width:100%;text-align:left;padding:14px;margin-bottom:8px" id="rd-rep-team">
      <div style="font-size:14px;font-weight:700;color:var(--fg)">Whole team's race day</div>
      <div style="font-size:11px;color:var(--muted-fg);margin-top:2px;font-weight:500">Every stint logged today</div>
    </button>
    <button class="btn btn-secondary" style="width:100%" id="rd-rep-cancel">Cancel</button>
  `;
  ctx.$('rd-rep-mine')?.addEventListener('click', () => { ctx.closeSheet(); emailStint(stint); });
  ctx.$('rd-rep-team')?.addEventListener('click', () => { ctx.closeSheet(); emailTeamReport(); });
  ctx.$('rd-rep-cancel')?.addEventListener('click', () => ctx.closeSheet());
}

function emailStint(stint) {
  const date=new Date().toLocaleDateString('en-AU');
  const lapLines=stint.laps.length>0 ? stint.laps.map((l,i)=>`Lap ${i+1}: ${fmtMs(l.duration)}`).join('\n') : 'No laps recorded.';
  const best=stint.laps.length>0?fmtMs(Math.min(...stint.laps.map(l=>l.duration))):'--';
  const avg=stint.laps.length>0?fmtMs(stint.laps.reduce((s,l)=>s+l.duration,0)/stint.laps.length):'--';
  const subject = `Race Day Stint — ${stint.displayName||'Driver'} — ${date}`;
  const text =
    `TURBOPREP RACE DAY STINT REPORT\nDate: ${date}\nDriver: ${stint.displayName||'Unknown'}\n`+
    `Stint Time: ${fmtTime(stint.duration)}\nLaps: ${stint.laps.length}\nBest Lap: ${best}\nAvg Lap: ${avg}\n\n`+
    `LAP TIMES\n---------\n${lapLines}\n\n--- Sent from TurboPrep ---`;
  shareReport(subject, text);
}

// Tries the share sheet (iOS native), then mailto:, then clipboard copy.
// On iOS WKWebView the mailto: link is often silently blocked; the
// previous implementation gave the user no feedback so reports felt
// broken. Now the worst case is "copied to clipboard" + a clear toast.
async function shareReport(subject, body) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title: subject, text: body }); return; } catch(e) {}
  }
  // Default destination = dev inbox (per the app's email-routing rule).
  try { window.open('mailto:hearn.tenny@icloud.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)); } catch(e) {}
  try {
    await navigator.clipboard?.writeText(subject + '\n\n' + body);
    ctx.showToast?.('Report copied to clipboard — paste into Mail / Messages.', 'success');
  } catch(e) {
    ctx.showToast?.('Couldn\'t copy report — try again.', 'warn');
  }
}

function emailTeamReport() {
  const date=new Date().toLocaleDateString('en-AU');
  const lines=todayStints.map(s=>{
    const best=s.laps?.length>0?fmtMs(Math.min(...s.laps.map(l=>l.duration))):'--';
    const avg=s.laps?.length>0?fmtMs(s.laps.reduce((t,l)=>t+l.duration,0)/s.laps.length):'--';
    return `${s.displayName||s.uid} | Laps: ${s.laps?.length||0} | Best: ${best} | Avg: ${avg} | Time: ${fmtTime(s.duration||0)}`;
  }).join('\n');
  const totalLaps=todayStints.reduce((s,x)=>s+(x.laps?.length||0),0);
  const allLaps=todayStints.flatMap(s=>s.laps||[]);
  const fastestDriver=allLaps.length>0 ? todayStints.reduce((prev,curr)=>{
    const pb=prev.laps?.length>0?Math.min(...prev.laps.map(l=>l.duration)):Infinity;
    const cb=curr.laps?.length>0?Math.min(...curr.laps.map(l=>l.duration)):Infinity;
    return cb<pb?curr:prev;
  }) : null;
  const subject = `Race Day Team Report — ${date}`;
  const text =
    `TURBOPREP RACE DAY TEAM REPORT\nDate: ${date}\nTotal Drivers: ${todayStints.length}\nTotal Laps: ${totalLaps}`+
    (fastestDriver?`\nFastest Driver: ${fastestDriver.displayName||fastestDriver.uid}`:'') +
    `\n\nDRIVER BREAKDOWN\n----------------\n${lines||'No stints recorded.'}\n\n--- Sent from TurboPrep ---`;
  shareReport(subject, text);
}

// ── Tab Bar Control (called from app.js) ─────────────────────────────────────
export function updateRaceDayTabBar(active) {
  const plansTab=document.querySelector('.fitness-sub-tab[data-fitness-sub="plans"]');
  const lbTab=document.querySelector('.tab-btn[data-page="team"]');
  if (plansTab) plansTab.style.display=active?'none':'';
  if (lbTab) lbTab.style.display=active?'none':'';

  let rdBtn=document.getElementById('rd-tab-btn');
  if (active&&!rdBtn) {
    const bar=document.querySelector('.tab-bar');
    if (bar) {
      rdBtn=document.createElement('button');
      rdBtn.id='rd-tab-btn';
      rdBtn.className='tab-btn';
      rdBtn.innerHTML=`
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--destructive),#dc2626);display:flex;align-items:center;justify-content:center;margin:-4px auto 0;box-shadow:0 3px 10px rgba(var(--destructive-rgb),.4)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </div>
        <span class="tab-btn-label" style="color:var(--destructive)">Race</span>`;
      rdBtn.addEventListener('click',()=>openRaceDayOverlay());
      const racesTab=bar.querySelector('.tab-btn[data-page="races"]');
      if (racesTab) bar.insertBefore(rdBtn,racesTab); else bar.appendChild(rdBtn);
    }
  } else if (!active&&rdBtn) {
    rdBtn.remove();
  }
}
