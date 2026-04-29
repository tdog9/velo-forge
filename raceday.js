// raceday.js — TurboPrep Race Day Mode

let ctx = null;
export function initRaceDay(appCtx) { ctx = appCtx; }

// ── State ───────────────────────────────────────────────────────────────────
let rdd = { active:false, date:null, activatedBy:null, teamId:null, startPoint:null, startPointSet:false };
let rosterData  = [];
let setupFields = [];
let todayStints = [];

let stintActive       = false;
let stintStartTime    = null;
let stintPositions    = [];
let stintLaps         = [];
let stintWatchId      = null;
let stintGpsState     = 'idle';   // 'idle' | 'connecting' | 'live' | 'error'
let stintGpsTimeout   = null;     // 15s timeout to surface a "GPS isn't responding" toast
let stintInterval     = null;
let stintLiveInterval = null;
let spectatorInterval = null;
let moveContinuousStart = null;
let lastLapTime       = null;
let stintMap          = null;
let stintPolyline     = null;
let stintMarker       = null;

const LAP_THRESHOLD_M  = 30;   // metres — within this = at start/finish
const MIN_SPEED_MS     = 0.3;  // m/s — below this = stopped
const AUTO_START_SECS  = 450;  // 7 min 30 s of continuous movement

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
export async function activateRaceDay(raceId) {
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
    maxDurationMs: 25*60*60*1000 // 25 hour hard limit
  };
  try {
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',todayKey()),data);
    rdd={...rdd,...data};
    try { ctx.pushWatchState?.(); } catch(e) {}
    try { updateRaceDayTabBar(true); } catch(e) {}
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

      // 25hr hard limit
      if (rd.activatedAtMs && (nowMs - rd.activatedAtMs) > 25*60*60*1000) {
        shouldEnd = true;
        console.log('[RaceDay] 25hr limit reached — auto-ending');
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
    {id:'seat',  label:'Seat Number', type:'number',min:0,max:30,value:'',filledBy:'member'},
    {id:'helmet',label:'Helmet Size',  type:'text',  value:'',filledBy:'member'},
    {id:'gloves',label:'Glove Size',   type:'text',  value:'',filledBy:'member'},
    {id:'notes', label:'Personal Notes',type:'text', value:'',filledBy:'member'},
  ];
}
async function saveSetupFields() {
  if (!ctx?.db||!rdd.date) return;
  const tid=ctx.userProfile?.teamId||'default';
  try { await ctx.setDoc(ctx.doc(ctx.db,'race_day',rdd.date,'setup',tid),{fields:setupFields,updatedAt:ctx.serverTimestamp()}); } catch(e){}
}
async function saveStint(record) {
  if (!ctx?.db || !ctx.currentUser) return;
  // Audit found: rdd.date can be null if the user opens race-day mode
  // before loadRaceDayState() has resolved (race condition on cold start).
  // Fall back to today's local date so the stint actually saves instead of
  // silently disappearing. Same key format as todayKey() above.
  const dk = rdd.date || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  try {
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',dk,'stints',ctx.currentUser.uid), record);
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

<!-- Header matching app style -->
<header style="height:56px;min-height:calc(56px + env(safe-area-inset-top,0px));padding:0 16px;padding-top:env(safe-area-inset-top,0px);display:flex;align-items:center;gap:10px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0;z-index:30">
  <div style="width:32px;height:32px;border-radius:9px;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(249,115,22,.3)">T</div>
  <div style="flex:1;min-width:0">
    <div style="font-size:13px;font-weight:800;letter-spacing:.08em;color:var(--primary)">TURBOPREP</div>
    <div style="font-size:10px;color:var(--muted-fg);margin-top:-1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${raceName ? esc(raceName)+' · ' : ''}${esc(teamName)}</div>
  </div>
  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
    <div style="width:7px;height:7px;border-radius:50%;background:#ef4444;animation:rdPulse 1.4s ease infinite"></div>
    <span style="font-size:11px;font-weight:700;color:#ef4444">LIVE</span>
  </div>
  <button id="rd-share-btn" aria-label="Share spectator link" style="font-size:11px;padding:5px 10px;border-radius:8px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);color:#3b82f6;font-weight:700;cursor:pointer;margin-left:4px">Share</button>
  ${isCoach ? `<button id="rd-end-btn" style="font-size:11px;padding:5px 10px;border-radius:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444;font-weight:700;cursor:pointer;margin-left:4px">End Race Day</button>` : ''}
</header>

<!-- Scrollable content -->
<div id="rd-content" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px calc(16px + var(--tab-h,72px) + env(safe-area-inset-bottom,0px));"></div>

<!-- Coach FAB — add to roster -->
${isCoach ? `<button id="rd-roster-fab" style="position:fixed;bottom:calc(var(--tab-h,72px) + 12px + env(safe-area-inset-bottom,0px));right:16px;z-index:160;width:48px;height:48px;border-radius:50%;background:var(--primary);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(249,115,22,.4);-webkit-tap-highlight-color:transparent">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:22px;height:22px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
</button>` : ''}

<!-- Bottom tab bar matching app style -->
<nav style="position:fixed;bottom:0;left:0;right:0;z-index:155;background:rgba(10,11,15,0.99);border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:flex-start;justify-content:space-around;padding:6px 0 calc(6px + env(safe-area-inset-bottom,0px));">
  <button class="rd-tab-btn active" data-rdtab="roster">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    <span class="rd-tab-lbl">Roster</span>
  </button>
  <button class="rd-tab-btn" data-rdtab="stint" style="position:relative">
    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);display:flex;align-items:center;justify-content:center;margin:-14px auto 0;box-shadow:0 4px 14px rgba(34,197,94,.4)">
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
    if (spectatorInterval) { clearInterval(spectatorInterval); spectatorInterval=null; }
    if (window._rdNavBlock) { window.removeEventListener('popstate', window._rdNavBlock); delete window._rdNavBlock; }
    const ma=document.getElementById('main-app');
    if (ma) ma.style.display='flex';
    const af=document.getElementById('ai-fab');
    if (af&&ctx.userProfile) af.style.display='';
  }

  // Only coaches/admin can end race day — no close for regular users
  // Share spectator link — anyone can open this URL to follow the race
  // without signing in. Build with the team id so it's filtered to this
  // team's drivers.
  ov.querySelector('#rd-share-btn')?.addEventListener('click', async () => {
    const tid = ctx.userProfile?.teamId || '';
    const url = location.origin + '/spectate.html' + (tid ? '?team=' + encodeURIComponent(tid) : '');
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
  if (spectatorInterval) { clearInterval(spectatorInterval); spectatorInterval=null; }
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
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <div style="font-size:16px;font-weight:700">Driver Roster</div>
    ${mgr?`<button id="rd-add-driver" style="font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--primary);color:var(--primary);background:none;font-weight:600;cursor:pointer">+ Add Driver</button>`:''}
  </div>`;

  if (rosterData.length===0) {
    html+=`<div style="text-align:center;padding:32px 20px;color:var(--muted-fg);font-size:13px">No drivers added yet.${mgr?'<br>Tap + Add Driver to begin.':''}</div>`;
  } else {
    html+=`<div style="font-size:11px;color:var(--muted-fg);text-align:center;margin-bottom:8px">Hold and drag to reorder drivers</div><div id="rd-roster-list">`;
    rosterData.forEach((d,i)=>{
      const mins=Math.round((d.duration||3600)/60);
      html+=`<div class="rd-drag-item" data-idx="${i}" draggable="true">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:var(--primary-fg);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600">${esc(d.name)}</div>
          ${d.notes?`<div style="font-size:11px;color:var(--muted-fg);margin-top:1px">${esc(d.notes)}</div>`:''}
        </div>
        <div style="font-size:12px;color:var(--muted-fg);white-space:nowrap;flex-shrink:0">${mins}m</div>
        ${mgr?`<button class="rd-edit-btn" data-idx="${i}" style="width:30px;height:30px;border-radius:8px;background:var(--muted);border:none;color:var(--muted-fg);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
        <div style="color:var(--muted-fg);font-size:18px;line-height:1;cursor:grab;flex-shrink:0;padding:0 2px">⠿</div>
      </div>`;
    });
    html+=`</div>`;
  }
  c.innerHTML=html;
  initDrag(c);
  c.querySelector('#rd-add-driver')?.addEventListener('click',()=>openAddDriver(c));
  c.querySelectorAll('.rd-edit-btn').forEach(btn=>btn.addEventListener('click',()=>openEditDriver(parseInt(btn.dataset.idx),c)));
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
        ${mgr?`<button class="rd-del-field" data-idx="${i}" style="font-size:10px;color:#ef4444;background:none;border:none;cursor:pointer;padding:2px 6px;font-weight:700">✕</button>`:''}
      </div>
      ${f.type==='number'
        ?`<input class="input rd-sf" data-idx="${i}" type="number" min="${f.min??0}" max="${f.max??30}" value="${esc(f.value||'')}" placeholder="${esc(f.label)}">`
        :`<input class="input rd-sf" data-idx="${i}" type="text" value="${esc(f.value||'')}" placeholder="${esc(f.label)}" maxlength="80">`
      }
    </div>`;
  });

  html+=`<button class="btn btn-primary" style="width:100%;margin-top:4px" id="rd-setup-save">Save My Setup</button>`;
  c.innerHTML=html;

  c.querySelectorAll('.rd-sf').forEach(inp=>inp.addEventListener('change',()=>{ setupFields[parseInt(inp.dataset.idx)].value=inp.value; }));
  c.querySelectorAll('.rd-del-field').forEach(btn=>btn.addEventListener('click',async()=>{
    const i = parseInt(btn.dataset.idx);
    const fName = setupFields[i]?.name || 'this field';
    if (!confirm('Delete ' + fName + ' from setup?')) return;
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

function renderLivePanel(live) {
  if (!live || live.length === 0) return '';
  return `<div style="background:linear-gradient(135deg,rgba(239,68,68,.10),rgba(239,68,68,.04));border:1px solid rgba(239,68,68,.25);border-radius:12px;padding:12px;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <div style="width:7px;height:7px;border-radius:50%;background:#ef4444;animation:rdPulse 1.4s ease infinite"></div>
      <span style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:.05em;text-transform:uppercase">Live on track</span>
    </div>
    ${live.map(l => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(239,68,68,.12);font-size:13px">
      <span style="flex:1;font-weight:700">${esc(l.displayName||'Driver')}</span>
      <span style="color:var(--muted-fg);font-size:11px">${l.lapCount||0} laps</span>
      <span style="font-family:var(--font-mono);font-weight:700;color:var(--fg)">${fmtTime(l.elapsed||0)}</span>
    </div>`).join('')}
  </div>`;
}

function renderUpNextPanel() {
  if (!rosterData || rosterData.length === 0) return '';
  // Pick driver who hasn't ridden today, in roster order
  const completedUids = new Set(todayStints.map(s => s.uid));
  const next = rosterData.find(d => !completedUids.has(d.id) && d.id !== ctx.currentUser?.uid);
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
    ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:10px;margin-bottom:14px;font-size:13px;color:#22c55e">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Start / finish point is set
       </div>`
    : `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.2);border-radius:10px;margin-bottom:14px;font-size:13px;color:#f97316">
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
        <button class="rd-email-btn" data-uid="${esc(s.uid)}" style="font-size:11px;padding:3px 10px;border-radius:6px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);color:var(--primary);cursor:pointer;font-weight:600">📧</button>
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
    <button id="rd-start-btn" style="width:100%;padding:16px;border-radius:14px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;margin-top:14px;box-shadow:0 4px 15px rgba(34,197,94,.35);-webkit-tap-highlight-color:transparent">▶ Start My Stint</button>`;

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

  // Spectator polling — refresh live drivers every 20s while pre-stint screen is visible
  if (spectatorInterval) { clearInterval(spectatorInterval); spectatorInterval=null; }
  const refreshLive = async () => {
    const live = await loadLiveStints();
    const panel = document.getElementById('rd-live-panel');
    if (panel) panel.innerHTML = renderLivePanel(live);
    if (!document.getElementById('rd-start-btn')) {
      clearInterval(spectatorInterval); spectatorInterval=null;
    }
  };
  refreshLive();
  // Re-poll: 5s while at least one rider is live, else 20s. (The previous
  // adaptiveDelay helper was dead code — `false ? 20000 : 20000` always
  // returned 20s. The real adaptive logic lives inside tick() below.)
  const tick = async () => {
    await refreshLive();
    if (!document.getElementById('rd-start-btn')) return;  // tab moved on
    const live = await loadLiveStints();
    const delay = (live && live.length > 0) ? 5000 : 20000;
    spectatorInterval = setTimeout(tick, delay);
  };
  spectatorInterval = setTimeout(tick, 5000);
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
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p=>m.setView([p.coords.latitude,p.coords.longitude],16),()=>m.setView([-37.81,144.96],14));
    }
  } catch(e){}
}

function startStint(c) {
  stintActive=true; stintStartTime=Date.now();
  stintPositions=[]; stintLaps=[]; moveContinuousStart=null; lastLapTime=null;
  stintMap=null; stintPolyline=null; stintMarker=null;
  stintGpsState='connecting';
  renderActiveStint(c);
  stintInterval=setInterval(()=>updateActive(),1000);
  // Live progress publish — every 15s push current state so teammates see live laps/elapsed
  stintLiveInterval=setInterval(()=>publishLiveStint(),15000);
  publishLiveStint(); // initial
  if (navigator.geolocation) {
    stintWatchId=navigator.geolocation.watchPosition(
      (pos) => {
        if (stintGpsState !== 'live') {
          stintGpsState = 'live';
          if (stintGpsTimeout) { clearTimeout(stintGpsTimeout); stintGpsTimeout = null; }
        }
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
  try { if(navigator.wakeLock) navigator.wakeLock.request('screen').catch(()=>{}); } catch(e){}
}

async function publishLiveStint() {
  if (!ctx?.db || !rdd.date || !ctx.currentUser) return;
  try {
    const best = stintLaps.length ? Math.min(...stintLaps.map(l=>l.duration)) : null;
    await ctx.setDoc(ctx.doc(ctx.db,'race_day',rdd.date,'live',ctx.currentUser.uid), {
      uid: ctx.currentUser.uid,
      displayName: ctx.userProfile?.displayName || 'Driver',
      live: true,
      startTime: stintStartTime,
      elapsed: Date.now() - stintStartTime,
      lapCount: stintLaps.length,
      bestLap: best,
      lastLap: stintLaps.length ? stintLaps[stintLaps.length-1].duration : null,
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

function onPos(pos) {
  const {latitude:lat,longitude:lng,speed}=pos.coords, now=Date.now();
  stintPositions.push({lat,lng,time:now,speed:speed||0});

  // Update map
  try {
    if (stintMap&&stintPolyline) {
      stintPolyline.addLatLng([lat,lng]);
      if (stintMarker) stintMarker.setLatLng([lat,lng]);
      else if (typeof L!=='undefined') stintMarker=L.circleMarker([lat,lng],{radius:7,fillColor:'#22c55e',fillOpacity:1,color:'#fff',weight:2}).addTo(stintMap);
      stintMap.panTo([lat,lng]);
    }
  } catch(e){}

  // Movement tracking
  const moving=(speed||0)>MIN_SPEED_MS;
  if (moving) {
    if (!moveContinuousStart) moveContinuousStart=now;
    if (!rdd.startPointSet && (now-moveContinuousStart)/1000>=AUTO_START_SECS) {
      setStartPoint(lat,lng).then(()=>{ addStartMarker(lat,lng); ctx.showToast('Start/finish point set.','success'); });
    }
  } else { moveContinuousStart=null; }

  // Overlap detection (same point twice = start/finish)
  if (!rdd.startPointSet && stintPositions.length>20) {
    const first=stintPositions[0], elapsed=(now-first.time)/1000;
    if (elapsed>60 && haversine(lat,lng,first.lat,first.lng)<LAP_THRESHOLD_M) {
      setStartPoint(first.lat,first.lng).then(()=>{ addStartMarker(first.lat,first.lng); ctx.showToast('Start/finish point set.','success'); });
    }
  }

  // Lap detection
  if (rdd.startPointSet && rdd.startPoint) {
    const dist=haversine(lat,lng,rdd.startPoint.lat,rdd.startPoint.lng);
    const timeSinceLast=lastLapTime ? now-lastLapTime : now-stintStartTime;
    if (dist<LAP_THRESHOLD_M && timeSinceLast>20000) {
      const dur=lastLapTime ? now-lastLapTime : now-stintStartTime;
      try { ctx.haptic?.('heavy'); } catch(e) {}
      stintLaps.push({time:now,duration:dur,lat,lng});
      lastLapTime=now;
      ctx.showToast('Lap '+stintLaps.length+' · '+fmtMs(dur),'success');
      updateActive();
    }
  }
}

function addStartMarker(lat,lng) {
  try {
    if (typeof L!=='undefined'&&stintMap) {
      L.circleMarker([lat,lng],{radius:14,fillColor:'#f97316',fillOpacity:.9,color:'#fff',weight:3}).addTo(stintMap).bindPopup('Start / Finish').openPopup();
    }
  } catch(e){}
}

function renderActiveStint(c) {
  c.innerHTML=`
    <div style="text-align:center;padding-top:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">● STINT ACTIVE</div>
      <div id="rd-timer" style="font-size:60px;font-weight:800;font-family:var(--font-mono);color:var(--fg);line-height:1">00:00</div>
      <div id="rd-sublabel" style="font-size:12px;color:var(--muted-fg);margin-top:4px">GPS connecting...</div>
    </div>
    <div id="rd-live-map" style="width:100%;height:180px;border-radius:12px;overflow:hidden;background:#0a1628;margin-bottom:12px"></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:12px">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div id="rd-al" style="font-size:22px;font-weight:800;color:var(--primary)">0</div>
        <div style="font-size:9px;color:var(--muted-fg);text-transform:uppercase;margin-top:1px">Laps</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div id="rd-ll" style="font-size:22px;font-weight:800;color:var(--fg)">--:--</div>
        <div style="font-size:9px;color:var(--muted-fg);text-transform:uppercase;margin-top:1px">Last</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center">
        <div id="rd-bl" style="font-size:22px;font-weight:800;color:#22c55e">--:--</div>
        <div style="font-size:9px;color:var(--muted-fg);text-transform:uppercase;margin-top:1px">Best</div>
      </div>
    </div>
    <div id="rd-laplist" style="margin-bottom:14px;max-height:160px;overflow-y:auto"></div>
    <button id="rd-end-stint" style="width:100%;padding:14px;border-radius:12px;background:#ef4444;color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent">■ End Stint</button>`;

  setTimeout(()=>{
    try {
      if (typeof L==='undefined') return;
      const el=document.getElementById('rd-live-map'); if(!el) return;
      stintMap=L.map('rd-live-map',{zoomControl:false,attributionControl:false});
      L.tileLayer(ctx.getMapTileUrl(),{maxZoom:19}).addTo(stintMap);
      stintPolyline=L.polyline([],{color:'#f97316',weight:4,opacity:.9}).addTo(stintMap);
      if (rdd.startPointSet&&rdd.startPoint) {
        stintMap.setView([rdd.startPoint.lat,rdd.startPoint.lng],17);
        L.circleMarker([rdd.startPoint.lat,rdd.startPoint.lng],{radius:12,fillColor:'#f97316',fillOpacity:.9,color:'#fff',weight:2}).addTo(stintMap);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p=>stintMap.setView([p.coords.latitude,p.coords.longitude],16),()=>stintMap.setView([-37.81,144.96],14));
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
  updateActive();
}

function updateActive() {
  const elapsed=Date.now()-stintStartTime;
  const t=document.getElementById('rd-timer'); if(t) t.textContent=fmtTime(elapsed);
  const sl=document.getElementById('rd-sublabel');
  if (sl) {
    if (stintGpsState === 'error') {
      sl.innerHTML = '<span style="color:#f59e0b">GPS unavailable — tap laps manually.</span>';
    } else if (stintGpsState === 'connecting') {
      sl.textContent = 'GPS connecting…';
    } else if (stintLaps.length > 0) {
      sl.textContent = 'Lap ' + (stintLaps.length) + ' in progress';
    } else if (rdd.startPointSet) {
      sl.textContent = 'Approaching start/finish…';
    } else {
      sl.textContent = 'Waiting for start/finish point…';
    }
  }
  const al=document.getElementById('rd-al'); if(al) al.textContent=stintLaps.length;
  if (stintLaps.length>0) {
    const last=stintLaps[stintLaps.length-1], best=[...stintLaps].sort((a,b)=>a.duration-b.duration)[0];
    const ll=document.getElementById('rd-ll'); if(ll) ll.textContent=fmtMs(last.duration);
    const bl=document.getElementById('rd-bl'); if(bl) bl.textContent=fmtMs(best.duration);
    const lapList=document.getElementById('rd-laplist');
    if (lapList) {
      const bestDur=Math.min(...stintLaps.map(l=>l.duration));
      lapList.innerHTML=stintLaps.slice().reverse().map((lap,i)=>{
        const n=stintLaps.length-i, isBest=lap.duration===bestDur;
        return `<div style="display:flex;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px">
          <span style="color:var(--muted-fg);width:54px">Lap ${n}</span>
          <span style="flex:1;font-weight:700;font-family:var(--font-mono);color:${isBest?'#22c55e':'var(--fg)'}">${fmtMs(lap.duration)}</span>
          ${isBest?'<span style="font-size:10px;color:#22c55e;font-weight:700">BEST</span>':''}
        </div>`;
      }).join('');
    }
  }
}

async function endStint(c) {
  stintActive=false;
  clearInterval(stintInterval); stintInterval=null;
  clearInterval(stintLiveInterval); stintLiveInterval=null;
  if (stintGpsTimeout) { clearTimeout(stintGpsTimeout); stintGpsTimeout=null; }
  stintGpsState='idle';
  if (stintWatchId!==null){ navigator.geolocation.clearWatch(stintWatchId); stintWatchId=null; }
  await clearLiveStint();
  const record={
    uid:ctx.currentUser?.uid, displayName:ctx.userProfile?.displayName||'Unknown',
    startTime:stintStartTime, endTime:Date.now(), duration:Date.now()-stintStartTime,
    laps:stintLaps, positions:stintPositions.slice(0,500)
  };
  await saveStint(record);
  todayStints=todayStints.filter(s=>s.uid!==record.uid); todayStints.push(record);
  stintMap=null; stintPolyline=null; stintMarker=null;
  renderStintSummary(c,record);
}

function renderStintSummary(c,stint) {
  const best=stint.laps.length>0?fmtMs(Math.min(...stint.laps.map(l=>l.duration))):'--:--';
  const avg=stint.laps.length>0?fmtMs(stint.laps.reduce((s,l)=>s+l.duration,0)/stint.laps.length):'--:--';
  c.innerHTML=`
    <div style="text-align:center;padding:16px 0 20px">
      <div style="font-size:11px;font-weight:700;color:var(--muted-fg);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Stint Complete</div>
      <div style="font-size:48px;font-weight:800;font-family:var(--font-mono);color:var(--primary)">${fmtTime(stint.duration)}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:16px">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--primary)">${stint.laps.length}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Laps</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#22c55e">${best}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Best</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--fg)">${avg}</div>
        <div style="font-size:10px;color:var(--muted-fg);text-transform:uppercase;margin-top:2px">Avg</div>
      </div>
    </div>
    ${stint.laps.map((lap,i)=>`
      <div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px">
        <span style="color:var(--muted-fg);width:54px">Lap ${i+1}</span>
        <span style="flex:1;font-weight:700;font-family:var(--font-mono)">${fmtMs(lap.duration)}</span>
      </div>`).join('')}
    <button id="rd-email-rep" class="btn btn-primary" style="width:100%;margin-top:16px">📧 Email Stint Report</button>
    <button id="rd-team-rep" class="btn btn-secondary" style="width:100%;margin-top:8px">📧 Email Full Team Report</button>
    <button id="rd-done" class="btn btn-secondary" style="width:100%;margin-top:8px">Done</button>`;
  c.querySelector('#rd-email-rep').addEventListener('click',()=>emailStint(stint));
  c.querySelector('#rd-team-rep').addEventListener('click',()=>emailTeamReport());
  c.querySelector('#rd-done').addEventListener('click',()=>renderStintTab(c));
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
  try { window.open('mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)); } catch(e) {}
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
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;margin:-4px auto 0;box-shadow:0 3px 10px rgba(239,68,68,.4)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </div>
        <span class="tab-btn-label" style="color:#ef4444">Race</span>`;
      rdBtn.addEventListener('click',()=>openRaceDayOverlay());
      const racesTab=bar.querySelector('.tab-btn[data-page="races"]');
      if (racesTab) bar.insertBefore(rdBtn,racesTab); else bar.appendChild(rdBtn);
    }
  } else if (!active&&rdBtn) {
    rdBtn.remove();
  }
}
