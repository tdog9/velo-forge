// TurboPrep HPV Training App
import { initTracker, openActivityTracker, closeActivityTracker, openActivityDetail } from './tracker.js';
import { escHtml, capitalize, timeAgo, haversine, decodePolyline, getXpLevel, XP_LEVELS } from './state.js';
// Dynamic imports — load ALL modules in PARALLEL (not sequential)
let renderAdmin = () => {}, renderCoachDashboard = async () => {}, loadAdminEmails = async () => {},
    loadExerciseOverrides = async () => {}, savePlanOverrides = async () => {},
    loadPlanOverrides = async () => {}, loadExerciseDemoVideos = async () => {},
    saveExerciseDemoVideos = async () => {}, loadRaceFootage = async () => {},
    loadRaceLogVideos = async () => {}, loadVideoOverrides = async () => {},
    saveVideoOverrides = async () => {}, loadHiddenPlans = async () => {},
    saveHiddenPlans = async () => {}, getWorkoutData = () => null, getVideoUrl = (a,b,c) => c,
    initAdmin = () => {};
let stravaStartAuth = () => {}, stravaHandleCallback = async () => {},
    stravaFetchActivities = async () => {}, renderStravaActivities = () => {},
    stravaDisconnect = async () => {}, loadStravaTokens = () => {},
    stravaUploadActivity = async () => false, stravaAutoSync = async () => {},
    stravaResyncRoutes = async () => {},
    initStrava = () => {};
let loadUserRaceLogs = async () => {}, renderRaceLog = () => {},
    openRaceLogForm = () => {}, getFootageForRace = () => [],
    getStreamForRace = () => null, renderFootageLinks = () => '',
    getCompletedRacesNeedingLogs = () => [], initRaceLog = () => {};
let openWorkoutTimer = () => {}, closeWorkoutTimer = () => {}, initTimer = () => {};
let startAiPlanEdit = () => {}, sendAiPlanEdit = async () => {},
    startAiWeeklyReview = () => {}, startAiRacePrep = () => {},
    generateRacePrepPlan = () => {}, startAiInjuryMod = () => {},
    sendInjuryModification = () => {}, openInlineWorkoutEdit = () => {},
    startAiFormCheck = () => {}, generateCoachSummary = () => null,
    generateTrainingInsight = () => null, renderSeasonPhase = () => '',
    initAiFeatures = () => {};
let ALL_PLANS = [];
let initializeApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut, updateProfile,
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy,
    onSnapshot, addDoc, deleteDoc, serverTimestamp, Timestamp, where, getDocs,
    arrayUnion, arrayRemove;
let firebaseImportFailed = false;
// Fire all imports at once — Promise.allSettled so one failure doesn't block others
const [adminRes, stravaRes, racelogRes, timerRes, aifRes, plansRes, fbAppRes, fbAuthRes, fbFsRes] = await Promise.allSettled([
  import('./admin.js'),
  import('./strava.js'),
  import('./racelog.js'),
  import('./timer.js'),
  import('./aifeatures.js'),
  import('./plans.js'),
  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
]);
// Unpack results — each is {status:'fulfilled', value:module} or {status:'rejected', reason:error}
if (adminRes.status === 'fulfilled') {
  ({ initAdmin, renderAdmin, renderCoachDashboard, loadAdminEmails, loadExerciseOverrides,
     savePlanOverrides, loadPlanOverrides, loadExerciseDemoVideos, saveExerciseDemoVideos,
     loadRaceFootage, loadRaceLogVideos, loadVideoOverrides, saveVideoOverrides,
     loadHiddenPlans, saveHiddenPlans, getWorkoutData, getVideoUrl } = adminRes.value);
} else { console.warn('admin.js load failed:', adminRes.reason); }
if (stravaRes.status === 'fulfilled') {
  ({ initStrava, stravaStartAuth, stravaHandleCallback, stravaFetchActivities,
     renderStravaActivities, stravaDisconnect, loadStravaTokens,
     stravaUploadActivity, stravaAutoSync, stravaResyncRoutes } = stravaRes.value);
} else { console.warn('strava.js load failed:', stravaRes.reason); }
if (racelogRes.status === 'fulfilled') {
  ({ initRaceLog, loadUserRaceLogs, renderRaceLog, openRaceLogForm,
     getFootageForRace, getStreamForRace, renderFootageLinks,
     getCompletedRacesNeedingLogs } = racelogRes.value);
} else { console.warn('racelog.js load failed:', racelogRes.reason); }
if (timerRes.status === 'fulfilled') {
  ({ initTimer, openWorkoutTimer, closeWorkoutTimer } = timerRes.value);
} else { console.warn('timer.js load failed:', timerRes.reason); }
if (aifRes.status === 'fulfilled') {
  ({ initAiFeatures, startAiPlanEdit, sendAiPlanEdit, startAiWeeklyReview,
     startAiRacePrep, generateRacePrepPlan, startAiInjuryMod,
     sendInjuryModification, openInlineWorkoutEdit,
     startAiFormCheck, generateCoachSummary,
     generateTrainingInsight, renderSeasonPhase } = aifRes.value);
} else { console.warn('aifeatures.js load failed:', aifRes.reason); }
if (plansRes.status === 'fulfilled') {
  ALL_PLANS = plansRes.value.ALL_PLANS || [];
} else { console.error('plans.js load failed:', plansRes.reason); }
if (fbAppRes.status === 'fulfilled' && fbAuthRes.status === 'fulfilled' && fbFsRes.status === 'fulfilled') {
  initializeApp = fbAppRes.value.initializeApp;
  ({ getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } = fbAuthRes.value);
  ({ getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, serverTimestamp, Timestamp, where, getDocs, arrayUnion, arrayRemove } = fbFsRes.value);
} else {
  console.error('Firebase SDK failed:', fbAppRes.reason || fbAuthRes.reason || fbFsRes.reason);
  firebaseImportFailed = true;
}
// Firebase Config (PLACEHOLDER)
const firebaseConfig = {
  apiKey: "AIzaSyDa_kbJN__2AoVy1asHRv2Vr9dFglR5yhE",
  authDomain: "hpr-2026.firebaseapp.com",
  databaseURL: "https://hpr-2026-default-rtdb.firebaseio.com",
  projectId: "hpr-2026",
  storageBucket: "hpr-2026.firebasestorage.app",
  messagingSenderId: "146970781719",
  appId: "1:146970781719:web:698dfcb67e7f68b1de9452"
};
// Embedded Plan Data (54 plans, 272+ workouts)
// Embedded UI Copy
const UI_COPY = {"safetyBanners":{"Y7":{"title":"Year 7 Training Guide","ages":"Ages 12-13","frequency":"2-3 sessions/week","duration":"30-45 min","maxIntensity":"Easy to moderate only","guideline":"Listen up, Year 7s - we are keeping things easy and fun in these early sessions so you build great habits and fall in love with training. Every champion started right where you are, so show up, give your best effort, and most importantly stay safe by keeping the intensity comfortable throughout."},"Y8":{"title":"Year 8 Training Guide","ages":"Ages 13-14","frequency":"2-3 sessions/week","duration":"35-50 min","maxIntensity":"Easy to moderate only","guideline":"Year 8, you are building on the great foundation from last year and adding some machine work to the mix - keep the resistance light and always prioritize learning the correct technique over adding more weight. If something feels uncomfortable or painful, stop immediately and let your coach or trainer know."},"Y9":{"title":"Year 9 Training Guide","ages":"Ages 14-15","frequency":"3-4 sessions/week","duration":"40-60 min","maxIntensity":"One hard session per week maximum","guideline":"Year 9, this is where your training starts to get genuinely serious - you get one hard session per week and the rest stay at a solid but sustainable effort. That hard session is only effective if the other sessions are genuinely easier, so resist the urge to push hard every day and trust the plan."},"Y10":{"title":"Year 10 Training Guide","ages":"Ages 15-16","frequency":"3-4 sessions/week","duration":"45-70 min","maxIntensity":"1-2 hard sessions/week","guideline":"Year 10, you are training with real loads now and your body is capable of handling more than ever before - make sure you are fueling well with good food, sleeping 8-9 hours, and taking rest days seriously because that is when the fitness adaptations actually happen. Work hard in sessions and recover just as hard outside them."},"Y11":{"title":"Year 11 Training Guide","ages":"Ages 16-17","frequency":"4-5 sessions/week","duration":"50-80 min","maxIntensity":"Max effort 1 session/week","guideline":"Year 11, you are training at near-adult loads now and one session per week reaches true maximum effort - those sessions are the most powerful training stimulus you have, so make sure you are fully warmed up before every hard session and completely recovered before the next one. Listen to your body and tell your coach if anything does not feel right."},"Y12":{"title":"Year 12 Training Guide","ages":"Ages 17-18","frequency":"4-6 sessions/week","duration":"60-90 min","maxIntensity":"Max effort 1-2 sessions/week","guideline":"Year 12 athletes train at full adult competitive loads - up to two maximum-effort sessions per week means your recovery between sessions is just as important as the sessions themselves, so prioritize sleep, nutrition, and active recovery every single day. You have reached the top level of this program and you have earned it."}},"tierDescriptions":{"basic":"Starting out or getting back into it? No worries at all - the basic tier is built exactly for you, with shorter sessions, more rest between exercises, and a focus on learning how to move well before moving heavy.","average":"You have got a solid fitness base and you are ready for a real training challenge - the average tier delivers standard competitive loads that will genuinely push you and produce real results over the season.","intense":"Ready to push your limits and train like a serious HPV competitor? The intense tier brings higher loads, longer efforts, less rest, and advanced protocols that are designed for athletes who want to win on race day."},"todayGreetings":["Rise and grind, champion! Let us make today count.","Another day, another chance to get faster on the HPV!","Hey superstar! Your training plan is waiting - let us crush it.","Good to see you back! Consistency is what separates the good from the great.","Today is YOUR day. Let us build that race fitness!","Every session you complete is a deposit in your race-day performance bank. Let us make a big one today.","You showed up - and that is already 50% of the battle. Now let us make it count.","The best HPV racers are made in training, not on race day. Let us get to work.","Your competitors are training right now. Good thing you are too.","Small improvements every day equal massive results on race day. Let us improve today."],"emptyStates":{"noActivePlan":"You have not picked a training plan yet! Head over to the Plans tab and find the perfect program for your year level. I have got plans for every fitness level - whether you are just starting out or ready to dominate race day.","noWorkouts":"No workouts logged yet - but that is about to change! After your next session, tap that + button and log what you did. Tracking your progress is how we level up.","noPlanWorkouts":"This plan does not have any workouts scheduled for today. Take a rest day - your body needs recovery to get stronger. Come back tomorrow ready to go!"},"categoryDescriptions":{"invehicle":"Time to get in the HPV and ride! These sessions put you directly in the vehicle to build race-specific fitness, handling skills, and the kind of speed that only comes from real saddle time.","floor":"No gym? No problem! These bodyweight sessions build real strength, power, and mobility using nothing but your own body - you can smash these at home, at school, or anywhere you have a bit of floor space.","machine":"Hit the gym and use the machines to build serious race-winning leg strength and cardiovascular fitness - the spin bike, rowing machine, leg press, and elliptical are your best tools for becoming an unstoppable HPV racer."}};
// Race Data
const RACES = [
  {id:'r0', name:'Vic HPV Round 1 — Calder Park', date:'2026-03-14', location:'Calder Park Raceway, Keilor, VIC', distance:100, type:'endurance', notes:'9am–4pm. 7-hour endurance race. Round 1 of the 2026 Victorian HPV Grand Prix Series.', streamUrl:'https://www.youtube.com/watch?v=zqD56QVsxAE', footageUrls:[{label:'Full Race Livestream',url:'https://www.youtube.com/watch?v=zqD56QVsxAE',type:'stream'},{label:'Official Results — Alpine Timing',url:'https://www.alpinetiming.com.au/results/r653/',type:'results'}]},
  {id:'r1', name:'Vic HPV Round 2 — Casey Fields', date:'2026-05-02', location:'Casey Fields, Cranbourne East, VIC', distance:80, type:'endurance', notes:'10am–4pm. 6-hour endurance race. Round 2 of the 2026 Victorian HPV Grand Prix Series.'},
  {id:'r2', name:'Vic HPV Round 3 — Sandown Raceway', date:'2026-07-25', location:'Sandown Raceway, Springvale, VIC', distance:100, type:'endurance', notes:'9am–4pm. 7-hour endurance race. Round 3 of the 2026 Victorian HPV Grand Prix Series.'},
  {id:'r3', name:'Vic HPV Round 4 — Casey Fields', date:'2026-10-17', location:'Casey Fields, Cranbourne East, VIC', distance:120, type:'endurance', notes:'9am–5pm. 8-hour endurance race. Series finale — Round 4 of the 2026 Victorian HPV Grand Prix Series.'},
  {id:'r4', name:'Energy Breakthrough — Maryborough 24hr', date:'2026-11-18', location:'Maryborough, VIC', distance:900, type:'multi_day', notes:'18–22 November. The flagship 24-hour HPV endurance race on the 1.58km Maryborough street circuit. Teams of 8 riders.'},
];
// App State
let app, auth, db;
let currentUser = null;
let userProfile = null;
let currentPage = 'today';
let fitnessSubTab = 'workouts'; // 'workouts' | 'plans' | 'demos' | 'myplans'
let demosCat = 'all'; // 'all' | 'invehicle' | 'floor' | 'machine'
let demosSearch = '';
let lbSubTab = 'global'; // 'global' | 'team'
let globalLeaderboard = [];
let globalLbLoading = false;
// Theme
let currentTheme = 'dark';
let calViewMonth = new Date().getMonth();
let calViewYear = new Date().getFullYear();
let teamFeedCache = [];
try { currentTheme = localStorage.getItem('vf_theme') || 'dark'; } catch(e) {}
if (currentTheme === 'light') document.documentElement.classList.add('light-theme');
// Map tile helper — switches dark/light based on theme
function getMapTileUrl() {
  return currentTheme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}
// Strava integration
const STRAVA_CLIENT_ID = '213628'; // Set your Strava API client ID here
const STRAVA_REDIRECT_URI = 'https://turboprep.netlify.app';
let stravaTokens = null; // { access_token, refresh_token, expires_at, athlete }
let stravaActivities = []; // cached recent activities
let userWorkouts = [];
let userChecklist = {};
let workoutsUnsubscribe = null;
let checklistUnsubscribe = null;
let profileUnsubscribe = null;
// XP & Levelling (imported from state.js)
function calcXp() {
  let xp = 0;
  // Base XP: 10 per workout
  xp += userWorkouts.length * 10;
  // Daily 2x bonus: first workout each day gets bonus 10 XP
  const dailyDates = new Set();
  userWorkouts.forEach(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    if (d) {
      const key = d.toISOString().split('T')[0];
      if (!dailyDates.has(key)) { dailyDates.add(key); xp += 10; } // +10 bonus for first workout of each day
    }
  });
  // Streak calculation with freeze support
  const dates = [...new Set(userWorkouts.map(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    return d ? d.toISOString().split('T')[0] : null;
  }).filter(Boolean))].sort();
  let streak = 0, best = 0, cur = 0;
  let freezesEarned = 0, freezesUsed = 0;
  dates.forEach((d, i) => {
    if (i === 0) { cur = 1; } else {
      const diff = (new Date(d) - new Date(dates[i-1])) / 86400000;
      if (diff === 1) { cur += 1; }
      else if (diff === 2 && freezesEarned > freezesUsed) { cur += 1; freezesUsed++; } // Use a freeze for 1 missed day
      else { cur = 1; }
    }
    if (cur > best) best = cur;
    if (cur > 0 && cur % 7 === 0) freezesEarned++; // Earn a freeze every 7 days
  });
  // Store streak freeze balance for display
  try { localStorage.setItem('vf_streak_freezes', String(Math.max(0, freezesEarned - freezesUsed))); } catch(e) {}
  if (best >= 7) xp += 25;
  if (best >= 14) xp += 50;
  if (best >= 30) xp += 100;
  // Plan completion bonus
  if (userProfile?.activePlanId) {
    const plan = findPlan(userProfile.activePlanId);
    if (plan && plan.workouts) {
      const total = plan.workouts.length;
      let done = 0;
      plan.workouts.forEach((w, i) => {
        const k = userProfile.activePlanId + '-' + w.week + '-' + w.day + '-' + (plan.workouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
        if (userChecklist[k]) done++;
      });
      if (done >= total && total > 0) xp += 75;
    }
  }
  // RPE logging bonus (5 XP per workout with RPE)
  xp += userWorkouts.filter(w => w.rpe).length * 5;
  return xp;
}
// Level-up detection
function checkLevelUp(oldXp, newXp) {
  const oldLvl = getXpLevel(oldXp);
  const newLvl = getXpLevel(newXp);
  if (newLvl.idx > oldLvl.idx) {
    showLevelUpAnimation(newLvl);
  }
}
function showLevelUpAnimation(level) {
  haptic('success');
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;flex-direction:column;animation:fadeIn .3s';
  ov.innerHTML = `
    <div style="font-size:80px;animation:bounceIn .6s">${level.icon}</div>
    <div style="font-size:28px;font-weight:800;color:#fff;margin-top:16px;animation:bounceIn .6s .1s both">LEVEL UP!</div>
    <div style="font-size:18px;color:var(--primary);font-weight:700;margin-top:8px;animation:bounceIn .6s .2s both">${level.name}</div>
    <div style="font-size:14px;color:rgba(255,255,255,.6);margin-top:6px;animation:bounceIn .6s .3s both">${level.xp} XP</div>
    <button style="margin-top:24px;padding:12px 32px;font-size:14px;font-weight:700;border-radius:10px;border:none;background:var(--primary);color:var(--primary-fg);cursor:pointer;animation:bounceIn .6s .4s both" id="lvlup-dismiss">Nice!</button>
  `;
  if (!document.getElementById('lvlup-style')) {
    const style = document.createElement('style');
    style.id = 'lvlup-style';
    style.textContent = '@keyframes bounceIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(ov);
  showCelebration('');
  ov.querySelector('#lvlup-dismiss')?.addEventListener('click', () => ov.remove());
  setTimeout(() => { if (ov.parentNode) ov.remove(); }, 8000);
}
// Personal Goals
let userGoals = []; // [{id, type, target, current, label, createdAt}]
function loadGoals() {
  try { userGoals = JSON.parse(localStorage.getItem('vf_goals') || '[]'); } catch(e) { userGoals = []; }
}
function saveGoals() {
  try { localStorage.setItem('vf_goals', JSON.stringify(userGoals)); } catch(e) {}
}
const BADGES = [
  { id: 'first_workout', icon: '🎯', name: 'First Step', desc: 'Log your first workout' },
  { id: 'ten_workouts', icon: '💪', name: 'Getting Serious', desc: 'Complete 10 workouts' },
  { id: 'fifty_workouts', icon: '⭐', name: 'Dedicated Athlete', desc: '50 workouts logged' },
  { id: 'streak_7', icon: '🔥', name: '7-Day Streak', desc: 'Train 7 days in a row' },
  { id: 'streak_14', icon: '⚡', name: 'Fortnight Fighter', desc: '14-day streak' },
  { id: 'streak_30', icon: '🏆', name: 'Monthly Monster', desc: '30-day streak' },
  { id: 'plan_complete', icon: '📋', name: 'Plan Crusher', desc: 'Complete a training plan' },
  { id: 'first_gps', icon: '📍', name: 'Explorer', desc: 'Record a GPS activity' },
  { id: 'strava_sync', icon: '⬡', name: 'Connected', desc: 'Sync from Strava' },
  { id: 'rpe_10', icon: '📊', name: 'Data Driven', desc: 'Log RPE on 10 workouts' },
  { id: 'century_mins', icon: '⏱️', name: 'Century Club', desc: '100 training minutes' },
  { id: 'distance_50k', icon: '🗺️', name: 'Half Century', desc: '50km total distance' },
  { id: 'xp_racer', icon: '🔵', name: 'Racer Level', desc: 'Reach 100 XP' },
  { id: 'xp_champion', icon: '🟠', name: 'Champion Level', desc: 'Reach 600 XP' },
];
function getEarnedBadges() {
  const earned = [];
  const xp = calcXp();
  const totalMins = userWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
  const totalDist = userWorkouts.reduce((s, w) => s + (w.distance || 0), 0);
  const streak = calcStreak();
  const rpeCount = userWorkouts.filter(w => w.rpe).length;
  const planDone = userProfile?.activePlanId && calcPlanPct() >= 100;
  if (userWorkouts.length >= 1) earned.push('first_workout');
  if (userWorkouts.length >= 10) earned.push('ten_workouts');
  if (userWorkouts.length >= 50) earned.push('fifty_workouts');
  if (streak >= 7) earned.push('streak_7');
  if (streak >= 14) earned.push('streak_14');
  if (streak >= 30) earned.push('streak_30');
  if (planDone) earned.push('plan_complete');
  if (userWorkouts.some(w => w.source === 'tracker')) earned.push('first_gps');
  if (userWorkouts.some(w => w.source === 'strava')) earned.push('strava_sync');
  if (rpeCount >= 10) earned.push('rpe_10');
  if (totalMins >= 100) earned.push('century_mins');
  if (totalDist >= 50) earned.push('distance_50k');
  if (xp >= 100) earned.push('xp_racer');
  if (xp >= 600) earned.push('xp_champion');
  return earned;
}
function calcStreak() {
  const dates = [...new Set(userWorkouts.map(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    return d ? d.toISOString().split('T')[0] : null;
  }).filter(Boolean))].sort();
  let cur = 0, best = 0;
  dates.forEach((d, i) => {
    if (i === 0) cur = 1;
    else cur = (new Date(d) - new Date(dates[i-1])) / 86400000 === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
  });
  return best;
}
function calcPlanPct() {
  if (!userProfile?.activePlanId) return 0;
  const plan = findPlan(userProfile.activePlanId);
  if (!plan?.workouts?.length) return 0;
  let done = 0;
  plan.workouts.forEach((w, i) => {
    const k = userProfile.activePlanId + '-' + w.week + '-' + w.day + '-' + (plan.workouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
    if (userChecklist[k]) done++;
  });
  return Math.round((done / plan.workouts.length) * 100);
}
function renderBadges() {
  const earned = getEarnedBadges();
  let html = '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  BADGES.forEach(b => {
    const has = earned.includes(b.id);
    html += `<div style="display:flex;flex-direction:column;align-items:center;width:60px;opacity:${has ? 1 : 0.25}" title="${b.desc}">
      <span style="font-size:24px">${b.icon}</span>
      <span style="font-size:9px;color:${has ? 'var(--text)' : 'var(--muted-fg)'};text-align:center;margin-top:2px;line-height:1.1">${b.name}</span>
    </div>`;
  });
  html += '</div>';
  return html;
}
// HR ZONES (from Strava data)
function calcHrZones(maxHr) {
  if (!maxHr) maxHr = 195; // default for teens
  return [
    { name: 'Zone 1 · Recovery', min: Math.round(maxHr * 0.5), max: Math.round(maxHr * 0.6), color: '#94a3b8' },
    { name: 'Zone 2 · Endurance', min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7), color: '#3b82f6' },
    { name: 'Zone 3 · Tempo', min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8), color: '#22c55e' },
    { name: 'Zone 4 · Threshold', min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9), color: '#f59e0b' },
    { name: 'Zone 5 · VO2 Max', min: Math.round(maxHr * 0.9), max: maxHr, color: '#ef4444' },
  ];
}
function getHrZone(hr, maxHr) {
  const zones = calcHrZones(maxHr);
  for (let i = zones.length - 1; i >= 0; i--) {
    if (hr >= zones[i].min) return zones[i];
  }
  return zones[0];
}
// MODAL SYSTEM (replaces prompt() calls)
function showModal(title, content, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'vf-modal';
  overlay.innerHTML = `<div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${content}</div>
      <div class="modal-btns">
        <button class="modal-btn secondary" id="modal-cancel">Cancel</button>
        <button class="modal-btn primary" id="modal-confirm">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  $('modal-cancel').addEventListener('click', () => overlay.remove());
  $('modal-backdrop')?.addEventListener('click', () => overlay.remove());
  $('modal-confirm').addEventListener('click', () => {
    if (onConfirm) onConfirm(overlay);
    overlay.remove();
  });
  // Focus first input if present
  setTimeout(() => {
    const inp = overlay.querySelector('input, select');
    if (inp) inp.focus();
  }, 100);
  return overlay;
}
function showEditModal(title, inputId, currentValue, onSave) {
  showModal(title, `<input class="input" id="${inputId}" type="text" value="${escHtml(currentValue)}" style="width:100%">`, (ov) => {
    const val = ov.querySelector('#' + inputId)?.value?.trim();
    if (val) onSave(val);
  });
}
function showSelectModal(title, options, currentValue, onSave) {
  const optHtml = options.map(o => `<option value="${o.value}"${o.value === currentValue ? ' selected' : ''}>${o.label}</option>`).join('');
  showModal(title, `<select class="input" id="modal-select" style="width:100%">${optHtml}</select>`, (ov) => {
    const val = ov.querySelector('#modal-select')?.value;
    if (val) onSave(val);
  });
}
const APP_VERSION = '4.4.0';
const CHANGELOG = [
  { version: '2.4.0', date: 'Mar 2026', items: [
    '🎓 App tour for new users',
    '🏅 14 achievement badges to earn',
    '❤️ Heart rate zones from Strava',
    '🏁 Race result logging with form',
    '📱 AI Coach now gives app navigation help',
    '⬡ Two-way Strava sync',
    '🗂️ App split into modules for performance',
    '☀️ Off-season & holiday plan generation'
  ]},
  { version: '2.3.0', date: 'Mar 2026', items: [
    '📍 GPS activity tracker',
    '🗺️ Dark/light map tiles',
    '🏆 XP leaderboard',
    '⚡ Auto team challenge scoring',
    '📊 Activity detail view with route maps'
  ]}
];
// Welcome setup replaces what's-new popup
function showWhatsNew() {
  // Disabled — replaced by welcome setup for new users
}
function showWelcomeSetup() {
  const name = userProfile?.displayName || 'there';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = `<div class="modal-backdrop"></div>
    <div class="modal-card" style="max-width:360px;padding:20px">
      <div style="text-align:center;font-size:36px;margin-bottom:8px">🚀</div>
      <div class="modal-title" style="text-align:center;margin-bottom:4px">Welcome, ${escHtml(name)}!</div>
      <div style="text-align:center;font-size:13px;color:var(--muted-fg);margin-bottom:16px">Connect your accounts to get the most out of TurboPrep</div>
      <div id="welcome-steps" style="display:flex;flex-direction:column;gap:8px">
        <button class="btn welcome-step" id="ws-strava" style="width:100%;padding:12px;font-size:13px;font-weight:600;background:var(--card);border:1.5px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left">
          <span style="font-size:20px;width:28px;text-align:center">⬡</span>
          <div style="flex:1"><div style="font-weight:700">Connect Strava</div><div style="font-size:11px;color:var(--muted-fg);margin-top:1px">Import Apple Watch, Garmin, Fitbit workouts</div></div>
          <span style="color:var(--muted-fg)">&rsaquo;</span>
        </button>
        <button class="btn welcome-step" id="ws-notifs" style="width:100%;padding:12px;font-size:13px;font-weight:600;background:var(--card);border:1.5px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left">
          <span style="font-size:20px;width:28px;text-align:center">🔔</span>
          <div style="flex:1"><div style="font-weight:700">Enable Notifications</div><div style="font-size:11px;color:var(--muted-fg);margin-top:1px">Training reminders and coach messages</div></div>
          <span style="color:var(--muted-fg)">&rsaquo;</span>
        </button>
        <button class="btn welcome-step" id="ws-plan" style="width:100%;padding:12px;font-size:13px;font-weight:600;background:var(--card);border:1.5px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left">
          <span style="font-size:20px;width:28px;text-align:center">📋</span>
          <div style="flex:1"><div style="font-weight:700">Pick a Training Plan</div><div style="font-size:11px;color:var(--muted-fg);margin-top:1px">Matched to your year level and fitness tier</div></div>
          <span style="color:var(--muted-fg)">&rsaquo;</span>
        </button>
        <button class="btn welcome-step" id="ws-homescreen" style="width:100%;padding:12px;font-size:13px;font-weight:600;background:var(--card);border:1.5px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left">
          <span style="font-size:20px;width:28px;text-align:center">📱</span>
          <div style="flex:1"><div style="font-weight:700">Add to Home Screen</div><div style="font-size:11px;color:var(--muted-fg);margin-top:1px">Works like a native app</div></div>
          <span style="color:var(--muted-fg)">&rsaquo;</span>
        </button>
      </div>
      <button class="btn btn-primary" id="ws-done" style="width:100%;padding:12px;font-size:14px;font-weight:700;margin-top:12px;border-radius:10px">Let's Go!</button>
      <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--muted-fg)">You can set these up later in Profile</div>
    </div>`;
  document.body.appendChild(overlay);
  const markDone = (btn) => {
    btn.style.borderColor = 'var(--primary)';
    btn.style.background = 'rgba(191,255,0,.06)';
    btn.querySelector('span:last-child').textContent = '✓';
    btn.querySelector('span:last-child').style.color = 'var(--primary)';
  };
  $('ws-strava')?.addEventListener('click', () => {
    stravaStartAuth();
    markDone($('ws-strava'));
  });
  $('ws-notifs')?.addEventListener('click', async () => {
    if (!('Notification' in window)) { showToast('Notifications not supported on this device.', 'warn'); return; }
    if (Notification.permission === 'denied') { showToast('Notifications blocked. Enable in browser settings.', 'warn'); return; }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      markDone($('ws-notifs'));
      showToast('Notifications enabled!', 'success');
    } else {
      showToast('Permission denied.', 'warn');
    }
  });
  $('ws-plan')?.addEventListener('click', () => {
    const year = userProfile?.yearLevel || 'Y9';
    const tier = userProfile?.fitnessLevel || 'basic';
    const match = ALL_PLANS.find(p => p.yearLevel === year && p.fitnessLevel === tier && p.category === 'floor')
      || ALL_PLANS.find(p => p.yearLevel === year && p.fitnessLevel === tier)
      || ALL_PLANS[0];
    if (match) {
      activatePlan(match.id);
      markDone($('ws-plan'));
      showToast('Plan activated!', 'success');
    }
  });
  $('ws-homescreen')?.addEventListener('click', () => {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) {
      showToast('Tap the Share button ↑ then "Add to Home Screen"', 'info');
    } else if (isAndroid) {
      showToast('Tap the menu ⋮ then "Add to Home Screen"', 'info');
    } else {
      showToast('Look for "Install" or "Add to Home Screen" in your browser menu', 'info');
    }
    markDone($('ws-homescreen'));
  });
  $('ws-done')?.addEventListener('click', () => {
    overlay.remove();
    try { localStorage.setItem('vf_onboarded', '1'); } catch(e) {}
    renderToday();
  });
  overlay.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    overlay.remove();
    try { localStorage.setItem('vf_onboarded', '1'); } catch(e) {}
  });
}
function openRaceResultForm(raceName, raceDate) {
  const content = `
    <div class="form-group" style="margin-bottom:10px">
      <label class="label">Race</label>
      <div style="font-weight:700;color:var(--text)">${escHtml(raceName)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div class="form-group"><label class="label">Position</label><input class="input" id="rr-position" type="number" min="1" placeholder="#"></div>
      <div class="form-group"><label class="label">Total Time</label><input class="input" id="rr-time" type="text" placeholder="e.g. 45:30"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div class="form-group"><label class="label">Fastest Lap</label><input class="input" id="rr-fastlap" type="text" placeholder="e.g. 2:15"></div>
      <div class="form-group"><label class="label">Total Laps</label><input class="input" id="rr-laps" type="number" min="0" placeholder="#"></div>
    </div>
    <div class="form-group" style="margin-bottom:10px"><label class="label">How did it go?</label><textarea class="input" id="rr-reflection" rows="3" placeholder="What went well? What would you change?"></textarea></div>
    <div class="form-group"><label class="label">Rate your effort (RPE)</label>
      <div style="display:flex;gap:4px;margin-top:4px" id="rr-rpe-row">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="rr-rpe-btn" data-rpe="${n}" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);font-size:11px;cursor:pointer">${n}</button>`).join('')}</div>
    </div>`;
  const ov = showModal('Log Race Result', content, async (overlay) => {
    const result = {
      raceName, raceDate,
      position: parseInt($('rr-position')?.value) || null,
      totalTime: $('rr-time')?.value?.trim() || null,
      fastestLap: $('rr-fastlap')?.value?.trim() || null,
      totalLaps: parseInt($('rr-laps')?.value) || null,
      reflection: $('rr-reflection')?.value?.trim() || null,
      rpe: parseInt(overlay.querySelector('.rr-rpe-btn[style*="primary"]')?.dataset?.rpe) || null,
      loggedAt: new Date().toISOString()
    };
    if (!demoMode && db && currentUser) {
      try {
        await addDoc(collection(db, 'users', currentUser.uid, 'raceResults'), { ...result, createdAt: serverTimestamp() });
        showToast('Race result saved!', 'success');
      } catch(e) { showError('Failed to save activity', 'tracker', e, { action: 'save' }); }
    } else {
      showToast('Race result saved (demo).', 'success');
    }
  });
  // RPE button bindings
  let selectedRpe = null;
  ov.querySelectorAll('.rr-rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ov.querySelectorAll('.rr-rpe-btn').forEach(b => { b.style.background = 'var(--surface-alt)'; b.style.color = 'var(--muted-fg)'; });
      btn.style.background = 'var(--primary)'; btn.style.color = 'var(--primary-fg)';
    });
  });
}
// Team Challenges
let activeChallenge = null; // {id, title, type, startDate, endDate, teams: {teamId: {name, score}}}
let trainingSessions = []; // [{id, title, date, time, endTime, location, notes, createdBy, createdAt}]
let raceTimerInterval = null;
let firebaseReady = false;
let raceFootage = {}; // {raceId: [{label, url, type}]} — admin-managed footage links
let raceLogVideos = []; // [{title, url, raceId, addedBy, timestamp}] — admin-curated videos for Race Log
let exerciseOverrides = {}; // {planId_weekIdx: {name, description, duration}} — admin overrides for workout details
// Plans page filter state
let plansCategory = 'invehicle';
let plansYear = 'Y7';
let plansTier = 'basic';
let plansSearch = '';
let customPlans = []; // user-created AI plans [{id, ...planData, createdBy, createdByName, shared}]
// Team state
let teamData = null; // {id, name, code, members:[]}
let teamMembers = []; // [{uid, displayName, yearLevel, fitnessLevel, activePlanId, totalWorkouts, streak, checklistPct}]
let isAdmin = false;
const ADMIN_EMAIL = 'hearn.tenny@icloud.com';
let adminAnnouncements = [];
let adminRaces = null; // null = use hardcoded, array = use Firestore
let hiddenPlans = new Set();
let allUsersCache = [];
let adminEmails = []; // legacy compat
let adminPerms = []; // [{email, perms: ['announcements','races','users','plans','demolinks']}]
let currentAdminPerms = []; // current user's allowed admin tabs
const ALL_ADMIN_FEATURES = [
  { id: 'announcements', label: 'Announcements', desc: 'Post updates to all users' },
  { id: 'training', label: 'Training', desc: 'Schedule training sessions' },
  { id: 'races', label: 'Races', desc: 'Manage race calendar' },
  { id: 'users', label: 'Users', desc: 'Manage users & admin access' },
  { id: 'plans', label: 'Plans', desc: 'Manage workout plans, exercises & videos' },
  { id: 'coach', label: 'Coach', desc: 'Student progress overview' }
];
let videoOverrides = {}; // {planId: {workoutIdx: url}}
let planOverrides = {}; // {planId: {name, description, durationWeeks, sessionsPerWeek}}
let exerciseDemoVideos = {}; // {exerciseName: videoUrl} — admin-managed demo videos for Demonstration tab
let userRaceLogs = []; // race log entries for current user
let teamLoading = false;
// Initialize Firebase
function initFirebase() {
  try {
    if (firebaseImportFailed) {
      console.warn('Firebase SDK could not be loaded. Showing demo mode option.');
      document.getElementById('setup-overlay').classList.remove('hidden');
      document.getElementById('setup-overlay').style.display = 'flex';
      return false;
    }
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
      document.getElementById('setup-overlay').classList.remove('hidden');
      document.getElementById('setup-overlay').style.display = 'flex';
      return false;
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseReady = true;
    return true;
  } catch(e) {
    console.error('Firebase init error:', e);
    document.getElementById('setup-overlay').classList.remove('hidden');
    document.getElementById('setup-overlay').style.display = 'flex';
    return false;
  }
}
// Demo Mode
let demoMode = false;
function enterDemoMode() {
  demoMode = true;
  firebaseReady = false;
  currentUser = { uid: 'demo-user', email: 'demo@turboprep.app', displayName: 'Demo Rider' };
  userProfile = { displayName: 'Demo Rider', email: 'demo@turboprep.app', yearLevel: 'Y9', fitnessLevel: 'average', activePlanId: 'invehicle-y9-average', teamId: null, teamName: null };
  userWorkouts = [
    { _id:'d1', name:'Morning Spin', type:'Ride', duration:45, distance:18, heartRate:142, notes:'Felt strong today', date: new Date(), createdAt: new Date() },
    { _id:'d2', name:'Core Circuit', type:'Strength', duration:30, distance:null, heartRate:118, notes:'Focused on planks', date: new Date(Date.now()-86400000), createdAt: new Date(Date.now()-86400000) },
    { _id:'d3', name:'Recovery Ride', type:'Ride', duration:35, distance:12, heartRate:125, notes:'', date: new Date(Date.now()-172800000), createdAt: new Date(Date.now()-172800000) },
  ];
  userChecklist = {};
  hide('setup-overlay');
  hide('auth-login');
  hide('auth-signup');
  showMainApp();
  // Update avatar
  const av = $('user-avatar-btn');
  if (av) av.textContent = 'D';
}
// DOM Helpers
const $ = id => document.getElementById(id);
function show(el) { if (typeof el === 'string') el = $(el); if (!el) return; el.classList.remove('hidden'); el.style.display = ''; }
function hide(el) { if (typeof el === 'string') el = $(el); if (!el) return; el.classList.add('hidden'); el.style.display = 'none'; }
function showLoading(text='Loading...') { $('loading-text').textContent = text; show('loading-overlay'); }
function hideLoading() { hide('loading-overlay'); }
function showAuthLogin() {
  show('auth-login');
  hide('auth-signup');
  hide('main-app');
  hide('login-error');
  hide('ai-fab');
  $('login-btn').disabled = false;
}
function showAuthSignup() {
  hide('auth-login');
  show('auth-signup');
  hide('main-app');
  hide('signup-error');
  hide('ai-fab');
  $('signup-btn').disabled = false;
  // Load available teams into dropdown
  loadSignupTeams();
}
async function loadSignupTeams() {
  const select = $('signup-team');
  if (!select || !db) return;
  try {
    const teamsSnap = await getDocs(collection(db, 'teams'));
    select.innerHTML = '<option value="">Select your team...</option>';
    teamsSnap.docs.forEach(d => {
      const t = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = t.name || d.id;
      select.appendChild(opt);
    });
    if (teamsSnap.docs.length === 0) {
      select.innerHTML = '<option value="">No teams created yet</option>';
    }
  } catch(e) { console.warn('Failed to load teams for signup:', e); }
}
function showMainApp() {
  hide('auth-login');
  hide('auth-signup');
  const mainApp = $('main-app');
  mainApp.classList.remove('hidden');
  mainApp.style.display = 'flex';
  show('ai-fab');
  renderCurrentPage();
}
// Auth event listeners
$('show-signup')?.addEventListener('click', showAuthSignup);
$('show-login')?.addEventListener('click', showAuthLogin);
$('demo-mode-btn')?.addEventListener('click', enterDemoMode);
// Role selector toggle
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const role = btn.dataset.role;
    $('signup-role').value = role;
    // Show/hide student-specific fields
    const studentFields = $('signup-student-fields');
    const childGroup = $('signup-child-group');
    if (role === 'student') {
      if (studentFields) studentFields.style.display = '';
      if (childGroup) childGroup.style.display = 'none';
    } else if (role === 'parent') {
      if (studentFields) studentFields.style.display = 'none';
      if (childGroup) childGroup.style.display = '';
    } else {
      if (studentFields) studentFields.style.display = 'none';
      if (childGroup) childGroup.style.display = 'none';
    }
  });
});
$('login-btn')?.addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  if (!email || !password) {
    $('login-error').textContent = 'Please enter email and password.';
    show('login-error');
    return;
  }
  if (!auth) {
    $('login-error').textContent = 'Firebase is not loaded. Check your connection or use Demo Mode.';
    show('login-error');
    return;
  }
  hide('login-error');
  const btn = $('login-btn');
  btn.disabled = true;
  showLoading('Logging in...');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e) {
    hideLoading();
    btn.disabled = false;
    $('login-error').textContent = friendlyError(e.code);
    show('login-error');
  }
});
$('signup-btn')?.addEventListener('click', async () => {
  const name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const role = $('signup-role').value || 'student';
  const yearLevel = role === 'student' ? $('signup-year').value : null;
  const tier = role === 'student' ? (document.querySelector('input[name="signup-tier"]:checked')?.value || 'basic') : null;
  const selectedTeamId = role === 'student' ? ($('signup-team')?.value || null) : null;
  const childEmail = role === 'parent' ? ($('signup-child-email')?.value?.trim() || null) : null;
  if (!name || !email || !password) {
    $('signup-error').textContent = 'Please fill in all fields.';
    show('signup-error');
    return;
  }
  if (role === 'parent' && !childEmail) {
    $('signup-error').textContent = 'Please enter your child\'s account email.';
    show('signup-error');
    return;
  }
  if (password.length < 6) {
    $('signup-error').textContent = 'Password must be at least 6 characters.';
    show('signup-error');
    return;
  }
  if (!auth) {
    $('signup-error').textContent = 'Firebase is not loaded. Check your connection or use Demo Mode.';
    show('signup-error');
    return;
  }
  hide('signup-error');
  const btn = $('signup-btn');
  btn.disabled = true;
  showLoading('Creating account...');
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const userData = {
      displayName: name,
      email: email,
      role: role,
      yearLevel: yearLevel,
      fitnessLevel: tier,
      activePlanId: null,
      teamId: null,
      teamName: null,
      createdAt: serverTimestamp()
    };
    if (role === 'parent') userData.linkedChildEmail = childEmail;
    if (role === 'coach') userData.isCoach = true;
    // Auto-join selected team
    if (selectedTeamId && db) {
      try {
        const teamSnap = await getDoc(doc(db, 'teams', selectedTeamId));
        if (teamSnap.exists()) {
          const td = teamSnap.data();
          await updateDoc(doc(db, 'teams', selectedTeamId), { members: arrayUnion(cred.user.uid) });
          userData.teamId = selectedTeamId;
          userData.teamName = td.name;
        }
      } catch(e) { console.warn('Auto-join team failed:', e); }
    }
    await setDoc(doc(db, 'users', cred.user.uid), userData);
  } catch(e) {
    hideLoading();
    btn.disabled = false;
    $('signup-error').textContent = friendlyError(e.code);
    show('signup-error');
  }
});
$('logout-btn')?.addEventListener('click', async () => {
  closeUserMenu();
  try {
    if (workoutsUnsubscribe) { workoutsUnsubscribe(); workoutsUnsubscribe = null; }
    if (checklistUnsubscribe) { checklistUnsubscribe(); checklistUnsubscribe = null; }
    if (profileUnsubscribe) { clearInterval(profileUnsubscribe); profileUnsubscribe = null; }
    if (raceTimerInterval) { clearInterval(raceTimerInterval); raceTimerInterval = null; }
    await signOut(auth);
    currentUser = null;
    userProfile = null;
    userWorkouts = [];
    userChecklist = {};
    showAuthLogin();
  } catch(e) {
    console.error('Logout error:', e);
  }
});
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
// User Menu
$('user-avatar-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = $('user-menu');
  const overlay = $('user-menu-overlay');
  if (menu.classList.contains('hidden')) {
    openUserMenu();
  } else {
    closeUserMenu();
  }
});
function openUserMenu() {
  const menu = $('user-menu');
  const overlay = $('user-menu-overlay');
  menu.classList.remove('hidden');
  menu.style.display = '';
  overlay.classList.remove('hidden');
  overlay.style.display = '';
  if (userProfile) {
    $('menu-name').textContent = userProfile.displayName || 'User';
    $('menu-info').textContent = (userProfile.yearLevel || 'Y7') + ' · ' + capitalize(userProfile.fitnessLevel || 'basic') + ' tier';
  }
}
function closeUserMenu() {
  hide('user-menu');
  hide('user-menu-overlay');
}
$('user-menu-overlay')?.addEventListener('click', closeUserMenu);
// --- Feature 3: Remember scroll position per tab ---
const scrollPositions = {};
// --- Feature 6: Remember last active tab on reload ---
try {
  const saved = localStorage.getItem('vf_lastTab');
  if (saved && ['today','fitness','races','team','admin'].includes(saved)) {
    currentPage = saved;
  }
  const savedFitSub = localStorage.getItem('vf_fitnessSub');
  if (savedFitSub && ['workouts','plans','health','demos'].includes(savedFitSub)) {
    fitnessSubTab = savedFitSub;
  }
} catch(e) {}
// --- Feature 10: Haptic feedback helper ---
function haptic(style) {
  try { if (navigator.vibrate) navigator.vibrate(style === 'light' ? 8 : style === 'medium' ? 15 : 5); } catch(e) {}
}
// Toast notification system
function showToast(message, type = 'info') {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3100);
}
// Error log — keeps last 20 errors for diagnostics
const errorLog = [];
// Local escHtml for error system (avoids dependency on state.js import timing)
const _esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function logError(area, error, context) {
  const entry = {
    area, message: error?.message || String(error), code: error?.code || null,
    stack: error?.stack?.split('\n').slice(0, 4).join('\n') || null,
    context: context || {},
    time: new Date().toISOString(),
    user: userProfile?.displayName || 'Unknown',
    online: navigator.onLine, platform: navigator.userAgent?.includes('iPhone') ? 'iOS' : navigator.userAgent?.includes('Android') ? 'Android' : 'Desktop'
  };
  errorLog.unshift(entry);
  if (errorLog.length > 20) errorLog.pop();
  console.error('[TurboPrep Error]', area, error);
  return entry;
}
// Smart error toast with tap-to-diagnose
function showError(message, area, error, context) {
  const entry = logError(area, error, context);
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.style.cursor = 'pointer';
  toast.innerHTML = message + '<span style="opacity:.6;font-size:10px;margin-left:6px">Tap for help</span>';
  toast.addEventListener('click', () => { toast.remove(); openErrorDiagnostics(entry); });
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
}
// Quick fix suggestions (no AI needed)
function getQuickFix(area, code, message) {
  const msg = (message || '').toLowerCase();
  const fixes = [];
  // Network issues
  if (!navigator.onLine || msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    fixes.push({ icon: '📶', title: 'No internet connection', fix: 'Check your WiFi or mobile data. The app will sync when you reconnect.' });
  }
  // Firebase auth errors
  if (code === 'auth/network-request-failed') fixes.push({ icon: '📶', title: 'Network error', fix: 'Check your internet connection and try again.' });
  if (code === 'auth/too-many-requests') fixes.push({ icon: '⏳', title: 'Too many attempts', fix: 'Wait 5 minutes before trying again. This is a security measure.' });
  if (code === 'auth/invalid-credential') fixes.push({ icon: '🔑', title: 'Wrong password', fix: 'Double-check your email and password. Use "Forgot Password" if needed.' });
  if (code === 'auth/email-already-in-use') fixes.push({ icon: '📧', title: 'Email taken', fix: 'This email already has an account. Try logging in instead of signing up.' });
  if (code === 'auth/user-not-found') fixes.push({ icon: '👤', title: 'No account found', fix: 'Check your email spelling or create a new account.' });
  // Firestore permission errors
  if (msg.includes('permission') || msg.includes('denied') || code === 'permission-denied') {
    fixes.push({ icon: '🔒', title: 'Permission denied', fix: 'Your account may not have access to this feature. Try logging out and back in. If the problem persists, contact your coach.' });
  }
  if (msg.includes('not-found') || msg.includes('document') && msg.includes('exist')) {
    fixes.push({ icon: '📄', title: 'Data not found', fix: 'The data you\'re looking for may have been deleted or moved. Try refreshing the page.' });
  }
  // Strava errors
  if (area === 'strava' || msg.includes('strava')) {
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('token')) {
      fixes.push({ icon: '⬡', title: 'Strava session expired', fix: 'Go to Profile → Strava → Disconnect, then reconnect. Your data will re-sync.' });
    }
    if (msg.includes('rate') || msg.includes('429')) fixes.push({ icon: '⏱️', title: 'Strava rate limit', fix: 'Too many requests to Strava. Wait 15 minutes and try again.' });
  }
  // GPS/tracker errors
  if (area === 'tracker' || msg.includes('geolocation') || msg.includes('gps')) {
    fixes.push({ icon: '📍', title: 'Location access', fix: 'Open your device Settings → Privacy → Location Services and make sure it\'s enabled for your browser.' });
  }
  // AI coach errors
  if (area === 'ai' || msg.includes('ai coach') || msg.includes('anthropic')) {
    fixes.push({ icon: '🤖', title: 'AI Coach unavailable', fix: 'The AI service may be temporarily down. Try again in a few minutes. If it keeps failing, the API key may need updating.' });
  }
  // Storage errors
  if (msg.includes('quota') || msg.includes('storage') || msg.includes('localstorage')) {
    fixes.push({ icon: '💾', title: 'Storage full', fix: 'Your device storage is full. Try clearing old data in Settings → Safari → Website Data, or delete unused apps.' });
  }
  // Generic fallback
  if (fixes.length === 0) {
    fixes.push({ icon: '🔄', title: 'Something went wrong', fix: 'Try refreshing the page. If the problem continues, log out and back in.' });
  }
  return fixes;
}
function openErrorDiagnostics(entry, showLog) {
  const fixes = getQuickFix(entry.area, entry.code, entry.message);
  const adminFixes = isAdmin ? getAdminFix(entry.area, entry.code, entry.message) : [];
  const ov = document.createElement('div');
  ov.id = 'error-diag-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center;padding:0';
  let html = `<div style="background:var(--bg);border-top:1px solid var(--border);border-radius:16px 16px 0 0;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px;padding-bottom:calc(20px + var(--safe-b))">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:16px;font-weight:700">Something went wrong</div>
      <button id="diag-close" style="background:none;border:none;color:var(--muted-fg);font-size:20px;cursor:pointer;padding:4px">✕</button>
    </div>`;
  // Highlighted fix (first one, prominent)
  if (fixes.length > 0) {
    const primary = fixes[0];
    html += `<div style="display:flex;gap:10px;padding:12px;background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(34,197,94,.04));border:1.5px solid rgba(34,197,94,.25);border-radius:12px;margin-bottom:10px">
      <span style="font-size:24px;flex-shrink:0">${primary.icon}</span>
      <div><div style="font-size:14px;font-weight:700;color:#22c55e;margin-bottom:3px">Try this first</div>
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${primary.title}</div>
      <div style="font-size:12px;color:var(--muted-fg);line-height:1.5">${primary.fix}</div></div>
    </div>`;
  }
  // Other fixes
  if (fixes.length > 1) {
    html += '<div style="font-size:11px;font-weight:600;color:var(--muted-fg);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Other things to try</div>';
    fixes.slice(1).forEach(f => {
      html += `<div style="display:flex;gap:10px;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
        <span style="font-size:16px;flex-shrink:0">${f.icon}</span>
        <div><div style="font-size:12px;font-weight:600;color:var(--text)">${f.title}</div>
        <div style="font-size:11px;color:var(--muted-fg);line-height:1.4">${f.fix}</div></div>
      </div>`;
    });
  }
  // ADMIN SECTION — extra diagnostics
  if (isAdmin) {
    html += `<div style="margin-top:12px;padding:12px;background:rgba(239,68,68,.06);border:1.5px solid rgba(239,68,68,.2);border-radius:10px">
      <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:8px;display:flex;align-items:center;gap:6px">🔧 Admin Diagnostics</div>`;
    // Admin-specific fixes
    if (adminFixes.length > 0) {
      adminFixes.forEach(f => {
        html += `<div style="padding:8px;background:rgba(239,68,68,.05);border-radius:6px;margin-bottom:6px">
          <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${f.title}</div>
          <div style="font-size:11px;color:var(--muted-fg);line-height:1.4">${f.fix}</div>
        </div>`;
      });
    }
    // Full technical info (open by default for admins)
    html += `<div style="font-size:11px;color:var(--muted-fg);background:var(--card);border:1px solid var(--border);border-radius:6px;padding:8px;margin-top:6px;font-family:var(--font-mono);line-height:1.6;word-break:break-all">
      <div><strong>Area:</strong> ${_esc(entry.area)}</div>
      <div><strong>Error:</strong> ${_esc(entry.message)}</div>
      ${entry.code ? '<div><strong>Code:</strong> <span style="color:#ef4444">' + _esc(entry.code) + '</span></div>' : ''}
      <div><strong>Time:</strong> ${entry.time}</div>
      <div><strong>User:</strong> ${_esc(entry.user)} · <strong>Online:</strong> ${entry.online ? '✓' : '✗'} · <strong>Platform:</strong> ${entry.platform}</div>
      ${entry.context && Object.keys(entry.context).length > 0 ? '<div><strong>Context:</strong> ' + _esc(JSON.stringify(entry.context)) + '</div>' : ''}
      ${entry.stack ? '<div style="margin-top:4px;white-space:pre-wrap;font-size:10px;opacity:.7;border-top:1px solid var(--border);padding-top:4px">' + _esc(entry.stack) + '</div>' : ''}
    </div>`;
    // Firestore doc path hint
    const docHints = {
      workout: 'Firestore: users/{uid}/workouts',
      plan: 'Firestore: users/{uid} → activePlanId',
      team: 'Firestore: teams/{teamId} + users/{uid} → teamId',
      strava: 'Firestore: users/{uid} → stravaTokens + stravaClubs',
      tracker: 'Firestore: users/{uid}/workouts + localStorage vf_routes',
      ai: 'Netlify Function: /.netlify/functions/ai-coach → ANTHROPIC_API_KEY env var',
      global: 'JavaScript runtime error — check browser console for full stack trace',
      promise: 'Unhandled async error — likely a network request or Firebase operation'
    };
    if (docHints[entry.area]) {
      html += `<div style="font-size:10px;color:var(--muted-fg);margin-top:6px;font-family:var(--font-mono)">📁 ${docHints[entry.area]}</div>`;
    }
    // Error log viewer (all recent errors)
    if (errorLog.length > 1) {
      html += `<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:var(--muted-fg);margin-bottom:4px">Recent Errors (${errorLog.length})</div>`;
      errorLog.slice(0, 10).forEach((e, i) => {
        const isCurrent = e === entry;
        html += `<div class="diag-log-item" data-log-idx="${i}" style="font-size:10px;padding:4px 6px;margin-bottom:2px;border-radius:4px;cursor:pointer;font-family:var(--font-mono);background:${isCurrent ? 'rgba(239,68,68,.1)' : 'transparent'};color:${isCurrent ? '#ef4444' : 'var(--muted-fg)'}">
          ${e.time.split('T')[1]?.split('.')[0] || ''} · ${_esc(e.area)} · ${_esc((e.message || '').substring(0, 60))}${e.message?.length > 60 ? '...' : ''}
        </div>`;
      });
      html += '</div>';
    }
    html += '</div>';
  } else {
    // Non-admin: collapsed technical details
    html += `<details style="margin-top:8px">
      <summary style="font-size:12px;color:var(--muted-fg);cursor:pointer;padding:6px 0;user-select:none">Technical Details</summary>
      <div style="font-size:11px;color:var(--muted-fg);background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:4px;font-family:var(--font-mono);line-height:1.5;word-break:break-all">
        <div><strong>Area:</strong> ${_esc(entry.area)}</div>
        <div><strong>Error:</strong> ${_esc(entry.message)}</div>
        ${entry.code ? '<div><strong>Code:</strong> ' + _esc(entry.code) + '</div>' : ''}
        <div><strong>Time:</strong> ${entry.time}</div>
      </div>
    </details>`;
  }
  // AI diagnose button
  html += `<button id="diag-ai-btn" class="btn" style="width:100%;margin-top:10px;padding:12px;font-size:13px;font-weight:600;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);border-radius:10px;color:#a855f7;display:flex;align-items:center;justify-content:center;gap:6px">
    🤖 Ask AI to Diagnose
  </button>
  <div id="diag-ai-result" style="margin-top:8px"></div>`;
  html += '</div>';
  ov.innerHTML = html;
  document.body.appendChild(ov);
  ov.querySelector('#diag-close').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  // Log item click → switch to that error
  ov.querySelectorAll('.diag-log-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.logIdx);
      if (errorLog[idx]) { ov.remove(); openErrorDiagnostics(errorLog[idx]); }
    });
  });
  ov.querySelector('#diag-ai-btn')?.addEventListener('click', async () => {
    const btn = ov.querySelector('#diag-ai-btn');
    const resultEl = ov.querySelector('#diag-ai-result');
    btn.textContent = 'Diagnosing...';
    btn.disabled = true;
    const roleContext = isAdmin ? 'This user is an ADMIN/COACH. Give both the user-facing fix AND the technical backend fix (Firestore paths, environment variables, deploy steps). Be specific about what to check in Firebase Console and Netlify.' : '';
    try {
      const diagPrompt = `A user got this error in a school HPV training app. Give a SHORT (3-4 sentences max) friendly explanation of what went wrong and exactly how to fix it. ${roleContext}
Error area: ${entry.area}
Error message: ${entry.message}
${entry.code ? 'Error code: ' + entry.code : ''}
Online: ${entry.online}
Platform: ${entry.platform}
Context: ${JSON.stringify(entry.context || {})}`;
      const resp = await fetch('/.netlify/functions/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: diagPrompt, context: 'ERROR_DIAGNOSIS. ' + (isAdmin ? 'User is admin. Include Firestore paths, env var names, and Netlify deploy steps. Be technical.' : 'Respond in 3-4 sentences. Be specific and practical. Use simple language a student would understand.') })
      });
      const data = await resp.json();
      resultEl.innerHTML = `<div style="padding:12px;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:10px;font-size:13px;color:var(--text);line-height:1.5">
        <div style="font-size:12px;font-weight:600;color:#a855f7;margin-bottom:4px">AI Diagnosis${isAdmin ? ' (Admin)' : ''}</div>
        ${_esc(data.reply || 'Could not diagnose. Try the suggestions above.')}
      </div>`;
    } catch(e) {
      resultEl.innerHTML = '<div style="font-size:12px;color:var(--muted-fg);padding:8px">AI diagnosis unavailable — try the suggestions above.</div>';
    }
    btn.style.display = 'none';
  });
}
// Admin-specific fix suggestions
function getAdminFix(area, code, message) {
  const msg = (message || '').toLowerCase();
  const fixes = [];
  if (msg.includes('permission') || msg.includes('denied') || code === 'permission-denied') {
    fixes.push({ title: 'Deploy Updated Firestore Rules', fix: 'The firestore.rules file has been updated but needs to be deployed. Go to Firebase Console → Firestore Database → Rules tab. Paste the contents of your firestore.rules file and click "Publish". The key change: teams need "allow update: if request.auth != null" so new members can join.' });
    fixes.push({ title: 'Check User Auth State', fix: 'The user\'s auth token may have expired. A page refresh forces re-authentication.' });
  }
  if (area === 'strava') {
    fixes.push({ title: 'Check Strava API Credentials', fix: 'Netlify → Site Settings → Environment Variables → verify STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are set and match your Strava API app at strava.com/settings/api.' });
    if (msg.includes('token') || msg.includes('401')) {
      fixes.push({ title: 'Token Expired', fix: 'The refresh token flow may have failed. Ask the student to disconnect and reconnect Strava in Profile. Check netlify/functions/strava-auth.js is deployed.' });
    }
  }
  if (area === 'ai') {
    fixes.push({ title: 'Check Anthropic API Key', fix: 'Netlify → Environment Variables → ANTHROPIC_API_KEY. Verify it\'s a valid sk-ant-... key with remaining credits. Check usage at console.anthropic.com.' });
    fixes.push({ title: 'Check Function Deploy', fix: 'Netlify → Functions → ai-coach. Check the function logs for errors. Ensure the function file is at netlify/functions/ai-coach.js.' });
  }
  if (area === 'team' || area === 'strava' && msg.includes('team')) {
    fixes.push({ title: 'Check Teams Collection', fix: 'Firebase Console → Firestore → teams collection. Verify the team document exists and has a members array containing the user\'s UID.' });
  }
  if (area === 'workout' || area === 'tracker') {
    fixes.push({ title: 'Check Workouts Subcollection', fix: 'Firebase Console → Firestore → users/{uid}/workouts. Verify write permissions. Check if the user\'s daily write quota is exhausted (free tier: 20K writes/day).' });
  }
  if (msg.includes('quota') || msg.includes('resource exhausted')) {
    fixes.push({ title: 'Firebase Quota Exceeded', fix: 'Free tier limits: 50K reads/day, 20K writes/day, 1GB storage. Check Firebase Console → Usage. Consider upgrading to Blaze plan (pay-as-you-go) if limits are hit regularly.' });
  }
  if (area === 'global' || area === 'promise') {
    fixes.push({ title: 'Check Browser Console', fix: 'Open DevTools (F12 or Cmd+Opt+I) → Console tab to see the full error with stack trace. This gives the exact file and line number.' });
  }
  return fixes;
}
// Global error handler — catches unhandled errors
window.addEventListener('error', (e) => {
  logError('global', e.error || e.message, { filename: e.filename, line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  logError('promise', e.reason, {});
});
// --- Tab click handler (features 4 + 10) ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (!page) return; // Record tab has no page
    haptic('light');
    if (page === currentPage) {
      $('content').scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    switchPage(page);
  });
  // --- Feature 12: Long-press shows tooltip ---
  let pressTimer = null;
  let tooltip = null;
  const names = { today: 'Home', fitness: 'Fitness', races: 'Races & Log', team: 'Leaderboard', admin: 'Admin' };
  btn.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => {
      haptic('medium');
      tooltip = document.createElement('div');
      tooltip.className = 'tab-tooltip visible';
      tooltip.textContent = names[btn.dataset.page] || '';
      btn.appendChild(tooltip);
    }, 500);
  }, { passive: true });
  const clearTooltip = () => {
    clearTimeout(pressTimer);
    if (tooltip) { tooltip.remove(); tooltip = null; }
  };
  btn.addEventListener('touchend', clearTooltip, { passive: true });
  btn.addEventListener('touchcancel', clearTooltip, { passive: true });
  btn.addEventListener('touchmove', clearTooltip, { passive: true });
});
// Record tab — opens activity tracker (outside forEach)
const recordTabBtn = $('record-tab-btn');
if (recordTabBtn) {
  recordTabBtn.addEventListener('click', () => {
    haptic('medium');
    openActivityTracker();
  });
}
function switchPage(page) {
  // Feature 3: Save scroll position before leaving
  scrollPositions[currentPage] = $('content').scrollTop;
  currentPage = page;
  // Feature 6: Persist to localStorage
  try { localStorage.setItem('vf_lastTab', page); } catch(e) {}
  // Update tab bar
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  // Update pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });
  const pageEl = $('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  renderCurrentPage();
  // Feature 3: Restore scroll position
  const savedScroll = scrollPositions[page] || 0;
  $('content').scrollTop = savedScroll;
}
function renderCurrentPage() {
  switch(currentPage) {
    case 'today': renderToday(); loadWeather(); break;
    case 'fitness': renderFitness(); break;
    case 'races': renderRaces(); renderRaceLog(); break;
    case 'team': renderTeam(); break;
    case 'admin': if (isAdmin) renderAdmin(); break;
  }
}
function renderFitness() {
  // Update sub-tab styling
  document.querySelectorAll('.fitness-sub-tab').forEach(btn => {
    const isActive = btn.dataset.fitnessSub === fitnessSubTab;
    btn.style.background = isActive ? 'var(--primary)' : 'var(--secondary)';
    btn.style.color = isActive ? 'var(--primary-fg)' : 'var(--secondary-fg)';
    btn.classList.toggle('active', isActive);
  });
  // Show/hide content areas
  const wc = $('workouts-content');
  const pc = $('plans-content');
  const hc = $('health-content');
  const dc = $('demos-content');
  wc.style.display = 'none';
  pc.style.display = 'none';
  hc.style.display = 'none';
  dc.style.display = 'none';
  
  if (fitnessSubTab === 'workouts') {
    wc.style.display = '';
    
    renderWorkouts();
  } else if (fitnessSubTab === 'plans') {
    pc.style.display = '';
    renderPlans();
  } else if (fitnessSubTab === 'health') {
    hc.style.display = '';
    renderHealthTab();
  } else if (fitnessSubTab === 'demos') {
    dc.style.display = '';
    renderDemonstration();
  }
}
// Bind fitness sub-tabs (feature 10: haptic)
document.querySelectorAll('.fitness-sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    haptic('light');
    fitnessSubTab = btn.dataset.fitnessSub;
    try { localStorage.setItem('vf_fitnessSub', fitnessSubTab); } catch(e) {}
    renderFitness();
    $('content').scrollTop = 0;
  });
});
// --- Feature 5: Swipe between fitness sub-tabs ---
const fitnessPage = $('page-fitness');
const fitSubOrder = ['workouts', 'plans', 'health', 'demos'];
let swipeStartX = 0, swipeStartY = 0, swipeDeltaX = 0, swiping = false;
fitnessPage.addEventListener('touchstart', (e) => {
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swiping = true;
  swipeDeltaX = 0;
}, { passive: true });
fitnessPage.addEventListener('touchmove', (e) => {
  if (!swiping) return;
  swipeDeltaX = e.touches[0].clientX - swipeStartX;
  const deltaY = Math.abs(e.touches[0].clientY - swipeStartY);
  if (deltaY > Math.abs(swipeDeltaX)) { swiping = false; }
}, { passive: true });
fitnessPage.addEventListener('touchend', () => {
  if (!swiping) return;
  swiping = false;
  if (Math.abs(swipeDeltaX) < 60) return;
  const curIdx = fitSubOrder.indexOf(fitnessSubTab);
  if (swipeDeltaX < -60 && curIdx < fitSubOrder.length - 1) {
    haptic('light');
    fitnessSubTab = fitSubOrder[curIdx + 1];
    try { localStorage.setItem('vf_fitnessSub', fitnessSubTab); } catch(e) {}
    renderFitness();
    $('content').scrollTop = 0;
  } else if (swipeDeltaX > 60 && curIdx > 0) {
    haptic('light');
    fitnessSubTab = fitSubOrder[curIdx - 1];
    try { localStorage.setItem('vf_fitnessSub', fitnessSubTab); } catch(e) {}
    renderFitness();
    $('content').scrollTop = 0;
  }
}, { passive: true });
// --- Feature 1: Scroll-to-top button ---
const scrollTopBtn = $('scroll-top-btn');
const contentEl = $('content');
let scrollTopVisible = false;
contentEl.addEventListener('scroll', () => {
  const shouldShow = contentEl.scrollTop > 400;
  if (shouldShow !== scrollTopVisible) {
    scrollTopVisible = shouldShow;
    scrollTopBtn.classList.toggle('visible', shouldShow);
  }
}, { passive: true });
scrollTopBtn.addEventListener('click', () => {
  haptic('light');
  contentEl.scrollTo({ top: 0, behavior: 'smooth' });
});
// --- Feature 7: Keyboard dismiss on scroll ---
contentEl.addEventListener('scroll', () => {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    active.blur();
  }
}, { passive: true });
// --- Feature 11: Pull-to-refresh on Today page ---
let ptrStartY = 0, ptrActive = false, ptrTriggered = false;
const ptrEl = document.createElement('div');
ptrEl.className = 'ptr-indicator';
ptrEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
contentEl.insertBefore(ptrEl, contentEl.firstChild);
contentEl.addEventListener('touchstart', (e) => {
  if (currentPage === 'today' && contentEl.scrollTop <= 0) {
    ptrStartY = e.touches[0].clientY;
    ptrActive = true;
    ptrTriggered = false;
  }
}, { passive: true });
contentEl.addEventListener('touchmove', (e) => {
  if (!ptrActive) return;
  const dy = e.touches[0].clientY - ptrStartY;
  if (dy > 10 && dy < 120) {
    ptrEl.classList.add('pulling');
    ptrEl.style.transform = 'translateX(-50%) translateY(' + (dy - 40) + 'px)';
    ptrEl.querySelector('svg').style.transform = 'rotate(' + (dy * 3) + 'deg)';
    if (dy > 80) ptrTriggered = true;
  }
}, { passive: true });
contentEl.addEventListener('touchend', () => {
  if (!ptrActive) return;
  ptrActive = false;
  if (ptrTriggered) {
    ptrEl.classList.add('refreshing');
    haptic('medium');
    // Reload profile and workouts from Firestore
    if (db && currentUser) {
      loadUserProfile(currentUser.uid).then(() => renderCurrentPage());
    } else {
      renderCurrentPage();
    }
    setTimeout(() => {
      ptrEl.classList.remove('pulling', 'refreshing');
      ptrEl.style.transform = 'translateX(-50%) translateY(-40px)';
    }, 600);
  } else {
    ptrEl.classList.remove('pulling');
    ptrEl.style.transform = 'translateX(-50%) translateY(-40px)';
  }
}, { passive: true });
// --- Feature 6 continued: Restore tab on load ---
// Set correct initial active tab styling
document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage));
document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
const initPage = $('page-' + currentPage);
if (initPage) initPage.classList.add('active');
function extractAllExercises() {
  const exerciseMap = {}; // key → exercise object
  const catLabels = { invehicle: 'In Vehicle', floor: 'Floor & Home', machine: 'Fitness Machine' };
  const catColors = { invehicle: '#2EA693', floor: '#8B5CF6', machine: '#FF8C33' };
  // ===== FLOOR EXERCISE DATABASE =====
  const FLOOR_EXERCISES = [
    { name: 'Plank Hold', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=pSHjTRCQxIw', desc: 'Prop yourself on forearms and toes with your body in a perfectly straight line from head to heels. Squeeze your core tight like you are bracing for a punch, keep your hips level — do not let them sag or pike up — and breathe steadily throughout. This is the foundation of all core stability work and directly improves the power transfer from your legs to the HPV pedals.' },
    { name: 'Side Plank', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=XeN4pEZZJNI', desc: 'Lie on one side propped on your forearm, stack your feet and lift your hip off the ground so your body forms a straight diagonal line. Hold without letting your hip drop. This exercise targets your obliques and lateral stabilisers — the muscles that keep you stable when cornering in the HPV and prevent energy-wasting side-to-side rocking during hard pedalling efforts.' },
    { name: 'Dead Bug', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=4XLEnwUr1d8', desc: 'Lie on your back with arms pointing straight up and knees bent at 90 degrees in the air. Slowly lower one arm overhead and the opposite leg toward the floor, keeping your lower back firmly pressed into the ground the entire time. Return and swap sides. If your lower back lifts, you have gone too far — reduce the range. This exercise teaches your deep core muscles to stabilise your spine under movement, which is exactly what happens when you pedal.' },
    { name: 'Bird Dog', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=my0UbQW4Zco', desc: 'Start on hands and knees with a flat back. Extend your right arm forward and left leg backward simultaneously until both are parallel to the floor. Hold for two seconds without letting your hips rotate or your back arch, then return and swap sides. This anti-rotation exercise builds the cross-body stability that keeps your torso steady while your legs drive the HPV pedals with maximum force.' },
    { name: 'Hollow Body Hold', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=BQCdzRPE9Ao', desc: 'Lie flat on your back and press your lower back hard into the floor. Lift both your legs and shoulders slightly off the ground — arms can be by your sides or overhead for extra difficulty. Hold this position while maintaining constant tension through your entire abdominal wall. This is one of the most effective core exercises for athletes and develops the same braced-core position you need to sustain race-pace pedalling without losing power through your trunk.' },
    { name: 'Bicycle Crunch', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=1we3bh9uhqY', desc: 'Lie on your back with hands behind your head. Bring your right elbow toward your left knee while extending your right leg, then smoothly rotate to bring your left elbow toward your right knee. Move slowly and with full rotation — quality beats speed every time. This rotational exercise strengthens your obliques and teaches your core to produce and resist twisting forces, which directly helps with HPV vehicle control at speed.' },
    { name: 'V-Up', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=n5cSgOvk53U', desc: 'Lie completely flat on the floor with arms extended overhead. In one controlled movement, simultaneously lift your arms and legs to meet above your midpoint, forming a V shape with your body. Lower back down with control — do not just collapse. This advanced exercise demands coordination and serious abdominal strength, building the explosive core power that supports hard race efforts and sprint finishes.' },
    { name: 'Flutter Kick', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=ANVdMDaYRts', desc: 'Lie on your back with your lower back pressed firmly into the floor. Lift both legs about 15-20 centimetres off the ground and rapidly alternate kicking them up and down in small, controlled movements. Keep your core braced and your legs straight throughout. This exercise builds endurance in your lower abdominals and hip flexors — the muscles that fatigue first during long sustained pedalling efforts in the HPV.' },
    { name: 'Hollow Body to V-Up', type: 'Core', videoUrl: 'https://www.youtube.com/watch?v=J1fw2a1WVrQ', desc: 'Start in the hollow body position — lower back pressed down, legs and shoulders lifted. From there, smoothly transition into a full V-Up by bringing your arms and legs to meet above your midpoint, then lower back to hollow body and repeat. This advanced combination exercise requires exceptional core control and coordination, and is reserved for elite Year 12 athletes who have mastered both movements individually.' },
    { name: 'Bodyweight Squat', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=m0GcZ24pK6k', desc: 'Stand with feet shoulder-width apart, toes slightly turned out. Lower yourself as if sitting into a chair behind you — keep your chest up, back straight, and knees tracking over your toes. Drive back up through your heels. Take three seconds going down and two seconds coming up for maximum benefit. This is the most fundamental lower body exercise and directly builds the quad and glute strength that powers every pedal stroke in the HPV.' },
    { name: 'Deep Squat', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=IHApHfNA2Ag', desc: 'A full-depth squat where your thighs go well below parallel — as deep as your mobility allows while maintaining a flat back. Pause for two seconds at the bottom, then drive up explosively. Deep squats develop strength through a greater range of motion and recruit more muscle fibres than partial squats, building the raw leg power needed for race-winning HPV acceleration and sustained high-cadence pedalling.' },
    { name: 'Reverse Lunge', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=xrPteyQLGAo', desc: 'From standing, step one foot backward and lower your back knee toward the floor until both legs form roughly 90-degree angles. Keep your front shin vertical and your torso upright. Push back to standing through the front heel. Stepping backward rather than forward is easier on the knees for developing athletes and builds single-leg strength that translates directly to the alternating leg drive pattern of HPV pedalling.' },
    { name: 'Split Squat', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=SGHnCftrZkA', desc: 'Set up with one foot forward and one foot behind you in a staggered stance. Lower your back knee toward the floor while keeping your front shin vertical, then drive back up. This is more challenging than a regular lunge because you maintain the split position throughout the set, demanding greater balance and muscular endurance. Split squats build the single-leg power and stability that makes each pedal stroke in the HPV more forceful and efficient.' },
    { name: 'Wall Sit', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=-cdph8hv0O0', desc: 'Place your back flat against a wall and slide down until your thighs are parallel to the floor, knees at 90 degrees. Hold this position — your quads will burn intensely but that is the point. Wall sits are particularly relevant for HPV riders because they simulate the sustained quadricep demand of maintaining pedal pressure over long race stints. Push through the burn and build the endurance that lasts when it matters.' },
    { name: 'Calf Raise', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=0PhsQvV-ZXg', desc: 'Stand on the edge of a step or flat on the floor near a wall for balance. Rise up onto your toes as high as possible, pause for one to two seconds at the top, then lower slowly for a full stretch at the bottom. Strong calves contribute to ankle stability and power transfer through the pedal stroke — they are the final link in the chain between your legs and the HPV drive system.' },
    { name: 'Step-Up', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=T7PT5nVHE6s', desc: 'Place one foot on a box or step and drive up through the heel of that foot until you are standing tall on top. Control the step back down without pushing off from the back foot. This single-leg exercise develops functional leg strength, hip stability, and the exact driving motion your legs perform on every pedal revolution inside the HPV. Use a higher box as you get stronger.' },
    { name: 'Pistol Squat', type: 'Legs', videoUrl: 'https://www.youtube.com/watch?v=NTf8YRWfOHY', desc: 'Stand on one leg with the other leg extended in front of you. Lower yourself on the standing leg as far as your strength and balance allow — the goal is full depth on one leg. Hold onto a wall or chair for balance as you develop the movement. This is the most advanced single-leg strength exercise in the program and develops exceptional leg power, balance, and ankle stability that very few school athletes achieve.' },
    { name: 'Glute Bridge', type: 'Glutes', videoUrl: 'https://www.youtube.com/watch?v=WtilA9IJX1c', desc: 'Lie on your back with knees bent and feet flat on the floor hip-width apart. Push your hips up toward the ceiling until your body forms a straight line from shoulders to knees. Squeeze your glutes hard at the top and hold for two to four seconds before lowering slowly. Your glutes are the single most powerful muscle for HPV pedalling — this exercise specifically activates and strengthens them through the exact hip extension pattern used in every pedal stroke.' },
    { name: 'Clamshell', type: 'Glutes', videoUrl: 'https://www.youtube.com/watch?v=vsQugiJgZZE', desc: 'Lie on your side with knees bent at 90 degrees and feet together. Keeping your feet touching, open your top knee up like a clamshell opening, then close it slowly. You should feel this deep in the side of your hip and glute. Clamshells activate the gluteus medius — a critical hip stabiliser that prevents your knees from collapsing inward during pedalling and maintains efficient power transfer throughout the pedal stroke.' },
    { name: 'Fire Hydrant', type: 'Glutes', videoUrl: 'https://www.youtube.com/watch?v=12whZWUANRY', desc: 'On hands and knees, keep your knee bent at 90 degrees and lift it out to the side — like a dog at a fire hydrant. Lift until your thigh is parallel to the floor, hold briefly, then lower with control. This exercise targets the glute medius and hip abductors from a different angle than bridges or clamshells, building well-rounded hip stability that keeps your pelvis steady and your pedalling efficient during long race efforts.' },
    { name: 'Push-Up', type: 'Upper Body', videoUrl: 'https://www.youtube.com/shorts/UIcct-7b6oE', desc: 'Start in a high plank with hands slightly wider than shoulder-width. Lower your entire body as one unit until your chest nearly touches the floor — maintain a perfectly straight line from head to heels — then press back up. Modify on your knees if needed but always keep that straight body line. HPV riders need upper body strength to control the vehicle at speed, maintain aerodynamic position, and resist fatigue in the arms during multi-hour race events.' },
    { name: 'Superman Hold', type: 'Back', videoUrl: 'https://www.youtube.com/watch?v=ZNVWTVdJW5s', desc: 'Lie face down with arms extended in front of you. Simultaneously lift both arms and both legs off the floor, squeezing your entire back and glutes. Hold for two to three seconds at the top, then lower with control. This exercise strengthens your entire posterior chain — the muscles running up the back of your body — which are essential for maintaining good posture inside the HPV and generating power without lower back pain over long training sessions.' },
    { name: 'Squat Jump', type: 'Plyometric', videoUrl: 'https://www.youtube.com/watch?v=CVaEhXotL7M', desc: 'Start in a squat position with thighs at or below parallel. Explode upward as high as possible, fully extending your body in the air. Land softly back in a full squat — absorb the impact through bent knees with no sound on landing. Squat jumps are the most HPV-specific explosive exercise you can do on the floor because the muscle activation pattern directly mirrors the power phase of the pedal stroke, training your fast-twitch fibres to fire rapidly.' },
    { name: 'Broad Jump', type: 'Plyometric', videoUrl: 'https://www.youtube.com/watch?v=96zJo3nlmHI', desc: 'Stand with feet hip-width apart. Swing your arms back, then explode forward jumping as far as possible horizontally. Land softly in a squat position with knees bent. Measure your distance and try to beat it each attempt. Broad jumps develop horizontal power production and teach your body to generate force rapidly through the entire lower body — the exact quality that produces race-winning HPV accelerations out of corners.' },
    { name: 'Tuck Jump', type: 'Plyometric', videoUrl: 'https://www.youtube.com/watch?v=qGk0MTjwLPo', desc: 'From standing, jump as high as you can and bring both knees up toward your chest at the peak of the jump. Land softly with bent knees and immediately prepare for the next rep. Tuck jumps develop explosive hip flexor power and fast-twitch muscle recruitment — building the snap acceleration you need to respond to pace changes in a race and sprint past competitors at critical moments.' },
    { name: 'Box Jump', type: 'Plyometric', videoUrl: 'https://www.youtube.com/watch?v=hxldG9FX4j4', desc: 'Stand facing a sturdy box or platform. Explode upward and forward, landing with both feet on top of the box in a squat position. Stand tall, then step back down — do not jump down. Box jumps develop maximum lower body power and teach your nervous system to recruit muscle fibres explosively. If no box is available, substitute squat jumps with maximum height intent.' },
    { name: 'High Knees', type: 'Cardio', videoUrl: 'https://www.youtube.com/watch?v=tx5rgpDAJRI', desc: 'Run on the spot driving your knees up toward your chest as high as possible with each stride. Pump your arms in coordination with your legs and maintain a steady pace — not an all-out sprint. High knees elevate your heart rate rapidly, develop hip flexor speed, and build the cardiovascular conditioning that lets you sustain harder efforts for longer during HPV race events.' },
    { name: 'Mountain Climber', type: 'Cardio', videoUrl: 'https://www.youtube.com/watch?v=cnyTQDSE884', desc: 'Start in a high plank position. Drive one knee toward your chest, then quickly switch legs — alternating rapidly as if running horizontally. Keep your hips level and your core tight throughout. Mountain climbers combine core stability work with intense cardio conditioning, training your body to maintain trunk control under high heart rates — exactly the demand placed on your body during hard race efforts in the HPV.' },
    { name: 'Bear Crawl', type: 'Cardio', videoUrl: 'https://www.youtube.com/watch?v=Wgt1vdZ_YYk', desc: 'Get on all fours with hands under shoulders and knees under hips. Lift your knees just a few centimetres off the ground. Crawl forward by moving opposite hand and foot together, keeping your back flat and your knees hovering. Then crawl backward. Bear crawls develop full-body coordination, shoulder stability, and core endurance in a way that few other bodyweight exercises can match.' },
    { name: 'Burpee', type: 'Cardio', videoUrl: 'https://www.youtube.com/watch?v=qLBImHhCXSw', desc: 'From standing, squat down and place your hands on the floor. Jump your feet back into a plank position. Jump your feet forward back to your hands, then explode upward into a jump with hands overhead. Burpees are the ultimate full-body conditioning exercise — they train strength, power, and cardiovascular endurance simultaneously. Modify by stepping instead of jumping if needed until you build the technique and fitness.' },
    { name: 'Cat-Cow', type: 'Mobility', videoUrl: 'https://www.youtube.com/watch?v=vuyUwtHl694', desc: 'Get on hands and knees with a neutral spine. For the Cat phase, round your back up toward the ceiling, tucking your chin and tailbone. For the Cow phase, arch your back downward, lifting your head and tailbone. Alternate slowly between these two positions, moving with your breath. This gentle spinal mobility exercise warms up your entire back, releases tension, and prepares your body for more demanding core and strength work.' },
    { name: 'Sun Salutation', type: 'Mobility', videoUrl: 'https://www.youtube.com/watch?v=FPjppcOquE4', desc: 'A flowing yoga sequence that moves through standing, forward fold, plank, upward dog, and downward dog positions in a continuous rhythmic pattern. Each movement connects to the next with your breath. Sun Salutations are one of the most effective full-body warm-up sequences — they mobilise every major joint, gently stretch all the major muscle groups, and raise your heart rate progressively. An excellent way to begin any training session.' },
    { name: 'Thoracic Rotation', type: 'Mobility', videoUrl: 'https://www.youtube.com/watch?v=AzCghjjWt5k', desc: 'Sit cross-legged or stand with feet hip-width apart, hands behind your head. Slowly rotate your upper body to the left, hold briefly, then rotate to the right. Keep your hips facing forward — the rotation should come entirely from your mid and upper back. Thoracic mobility is essential for HPV riders who spend time in a fixed recumbent position. Regular rotation work prevents the stiffness and discomfort that builds up over a racing season.' },
    { name: 'Child\'s Pose', type: 'Stretch', videoUrl: 'https://www.youtube.com/watch?v=kH12QrSGedM', desc: 'Kneel on the floor and sit back on your heels. Fold forward, extending your arms in front of you on the floor while your forehead rests on the ground. Breathe deeply and let your entire back relax. This gentle restorative stretch releases tension in the lower back, hips, and shoulders — the areas that accumulate the most stress during intense training sessions. Use it between exercises or as a cool-down.' },
    { name: 'Downward Dog', type: 'Stretch', videoUrl: 'https://www.youtube.com/watch?v=fjJlzniDqKQ', desc: 'From hands and knees, push your hips up and back to form an inverted V shape with your body. Press your hands firmly into the floor, straighten your arms, and gently work your heels toward the ground. Pedal your feet slowly to stretch each calf. Downward Dog stretches your hamstrings, calves, shoulders, and back simultaneously while building shoulder stability — a comprehensive stretch that every HPV rider should do regularly.' },
    { name: 'Hip Flexor Stretch', type: 'Stretch', videoUrl: 'https://www.youtube.com/watch?v=WPWNaOzZGPo', desc: 'Step one foot forward into a lunge position and drop your back knee to the floor. Keep your torso upright and gently push your hips forward until you feel a deep stretch across the front of your back hip. Hold for 30 to 50 seconds per side and breathe into the stretch. Tight hip flexors are the number one issue for HPV riders because of the recumbent position — regular stretching prevents pain and maintains your pedalling range of motion.' },
    { name: 'Hamstring Stretch', type: 'Stretch', videoUrl: 'https://www.youtube.com/watch?v=-MgesirYCoA', desc: 'Lie on your back and extend one leg straight up toward the ceiling, keeping the other leg flat on the floor. Gently pull the raised leg toward you using your hands or a towel until you feel a comfortable stretch through the back of your thigh. Hold 30 to 40 seconds per side. Flexible hamstrings allow a fuller pedal stroke and reduce the risk of the lower back pain that commonly affects HPV riders during long race events.' },
    { name: 'Pigeon Pose', type: 'Stretch', videoUrl: 'https://www.youtube.com/watch?v=M1gEGLtF1p0', desc: 'From a lunge position, lower your front shin to the floor at roughly a right angle in front of you. Extend your back leg behind you. Slowly lean forward over your front leg until you feel a deep stretch through your hip and glute. Hold for 45 to 60 seconds per side. Pigeon Pose is one of the most effective hip-opening stretches available and directly addresses the hip tightness that develops from spending extended time in the HPV recumbent position.' },
    { name: 'Warrior Pose', type: 'Stretch', videoUrl: 'https://www.youtube.com/watch?v=TBu5bsWrnTw', desc: 'Step one foot forward into a wide stance lunge with your back foot turned out at 45 degrees. Bend your front knee to 90 degrees, extend both arms overhead, and look forward. Hold for 20 to 30 seconds per side. Warrior Pose stretches your hip flexors, strengthens your legs, and develops balance — a combination that improves your stability inside the HPV and helps maintain good posture during long race stints.' },
    { name: 'Single-Leg Balance', type: 'Balance', videoUrl: 'https://www.youtube.com/watch?v=7SF7AYh2_Yw', desc: 'Stand on one leg with your other foot lifted off the ground. Hold this position for 30 seconds, keeping your standing leg slightly bent and your core engaged. For an extra challenge, close your eyes — this dramatically increases the balance demand. Balance training improves your proprioception and ankle stability, which translates to smoother, more controlled movements inside the HPV and better body awareness during racing.' }
  ];
  // Floor exercise keyword matching patterns
  const FLOOR_KEYWORDS = {};
  FLOOR_EXERCISES.forEach(ex => {
    const key = 'floor_' + ex.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    FLOOR_KEYWORDS[key] = { exercise: ex, patterns: [] };
    // Generate search patterns from the name
    const n = ex.name.toLowerCase();
    FLOOR_KEYWORDS[key].patterns.push(n);
    // Plurals and variants
    if (n.endsWith('ch') || n.endsWith('sh') || n.endsWith('x')) FLOOR_KEYWORDS[key].patterns.push(n + 'es');
    else if (!n.endsWith('s')) FLOOR_KEYWORDS[key].patterns.push(n + 's');
    // Special variants
    if (n === 'bodyweight squat') FLOOR_KEYWORDS[key].patterns.push('squat', 'squats');
    if (n === 'push-up') FLOOR_KEYWORDS[key].patterns.push('push up', 'push ups');
    if (n === 'step-up') FLOOR_KEYWORDS[key].patterns.push('step up', 'step ups');
    if (n === 'child\'s pose') FLOOR_KEYWORDS[key].patterns.push('childs pose', 'child\'s pose');
    if (n === 'v-up') FLOOR_KEYWORDS[key].patterns.push('v-up', 'v-ups', 'v up', 'v ups');
    if (n === 'superman hold') FLOOR_KEYWORDS[key].patterns.push('superman', 'supermans', 'superman exercises', 'superman holds');
    if (n === 'plank hold') FLOOR_KEYWORDS[key].patterns.push('plank', 'plank hold');
    if (n === 'hollow body hold') FLOOR_KEYWORDS[key].patterns.push('hollow body', 'hollow body holds');
    if (n === 'hollow body to v-up') FLOOR_KEYWORDS[key].patterns.push('hollow body to v-up transition', 'hollow body to v-up');
    if (n === 'glute bridge') FLOOR_KEYWORDS[key].patterns.push('glute bridge', 'glute bridges');
    if (n === 'calf raise') FLOOR_KEYWORDS[key].patterns.push('calf raise', 'calf raises');
    if (n === 'single-leg balance') FLOOR_KEYWORDS[key].patterns.push('single-leg balance', 'single leg balance');
  });
  // Scan floor plans and match exercises to plans
  const floorPlans = ALL_PLANS.filter(p => p.category === 'floor');
  const floorExKeys = {};
  Object.keys(FLOOR_KEYWORDS).forEach(k => { floorExKeys[k] = new Set(); });
  floorPlans.forEach(plan => {
    plan.workouts.forEach(w => {
      const descLower = (w.description || '').toLowerCase();
      const nameLower = (w.name || '').toLowerCase();
      const combined = nameLower + ' ' + descLower;
      Object.entries(FLOOR_KEYWORDS).forEach(([key, val]) => {
        for (const pattern of val.patterns) {
          if (combined.includes(pattern)) {
            floorExKeys[key].add(plan.id);
            break;
          }
        }
      });
    });
  });
  // Add matched floor exercises to the map
  const typeIcons = { Core: 'core', Legs: 'legs', Glutes: 'glutes', 'Upper Body': 'upper', Back: 'back', Plyometric: 'plyo', Cardio: 'cardio', Mobility: 'mobility', Stretch: 'stretch', Balance: 'balance' };
  Object.entries(FLOOR_KEYWORDS).forEach(([key, val]) => {
    if (floorExKeys[key].size === 0) return;
    const ex = val.exercise;
    exerciseMap[key] = {
      key,
      name: ex.name,
      category: 'floor',
      catLabel: catLabels.floor,
      catColor: catColors.floor,
      description: ex.desc,
      sets: null,
      reps: null,
      duration: null,
      resistance: null,
      exerciseType: ex.type,
      defaultVideoUrl: ex.videoUrl || '',
      plans: []
    };
    floorExKeys[key].forEach(planId => {
      const plan = findPlan(planId);
      if (plan) {
        const pd = getPlanDisplayData(plan);
        exerciseMap[key].plans.push({ id: plan.id, name: pd.name, year: plan.yearLevel, tier: plan.tier });
      }
    });
  });
  // ===== IN-VEHICLE PLANS (workout = exercise) =====
  ALL_PLANS.filter(p => p.category === 'invehicle').forEach(plan => {
    plan.workouts.forEach((w, wi) => {
      const wd = getWorkoutData(plan.id, wi, w);
      const key = 'invehicle_' + wd.name.toLowerCase().trim();
      if (!exerciseMap[key]) {
        exerciseMap[key] = {
          key,
          name: wd.name,
          category: 'invehicle',
          catLabel: catLabels.invehicle,
          catColor: catColors.invehicle,
          description: wd.description || '',
          sets: null,
          reps: null,
          duration: wd.duration ? wd.duration + ' min' : null,
          resistance: null,
          intensity: wd.intensity,
          plans: []
        };
      }
      const pd = getPlanDisplayData(plan);
      if (!exerciseMap[key].plans.some(p => p.id === plan.id)) {
        exerciseMap[key].plans.push({ id: plan.id, name: pd.name, year: plan.yearLevel, tier: plan.tier });
      }
    });
  });
  // ===== MACHINE PLANS (individual exercises array) =====
  ALL_PLANS.filter(p => p.category === 'machine').forEach(plan => {
    plan.workouts.forEach((w, wi) => {
      if (w.exercises && w.exercises.length > 0) {
        w.exercises.forEach(ex => {
          const key = 'machine_' + ex.name.toLowerCase().trim();
          if (!exerciseMap[key]) {
            exerciseMap[key] = {
              key,
              name: ex.name,
              category: 'machine',
              catLabel: catLabels.machine,
              catColor: catColors.machine,
              description: ex.notes || '',
              sets: ex.sets,
              reps: ex.reps,
              duration: ex.duration,
              resistance: ex.resistance,
              plans: []
            };
          }
          const pd = getPlanDisplayData(plan);
          if (!exerciseMap[key].plans.some(p => p.id === plan.id)) {
            exerciseMap[key].plans.push({ id: plan.id, name: pd.name, year: plan.yearLevel, tier: plan.tier });
          }
        });
      }
    });
  });
  return Object.values(exerciseMap).sort((a, b) => a.name.localeCompare(b.name));
}
function renderDemonstration() {
  const el = $('demos-content');
  const allExercises = extractAllExercises();
  const catFilters = [
    { id: 'all', label: 'All' },
    { id: 'invehicle', label: 'In Vehicle' },
    { id: 'floor', label: 'Floor & Home' },
    { id: 'machine', label: 'Machine' }
  ];
  // Filter by category
  let filtered = demosCat === 'all' ? allExercises : allExercises.filter(e => e.category === demosCat);
  // Filter by search
  if (demosSearch) {
    const q = demosSearch.toLowerCase();
    filtered = filtered.filter(e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || (e.exerciseType || '').toLowerCase().includes(q));
  }
  let html = '';
  // Sticky filter bar
  html += '<div class="demo-filter-sticky">';
  // Search bar
  html += `
    <div class="demo-search-wrap">
      <svg class="demo-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="demo-search" type="text" id="demos-search-input" placeholder="Search exercises, types..." value="${escHtml(demosSearch)}">
    </div>
  `;
  // Category pills
  html += '<div class="demo-cat-pills">';
  catFilters.forEach(c => {
    const count = c.id === 'all' ? allExercises.length : allExercises.filter(e => e.category === c.id).length;
    html += `<button class="demo-cat-pill${demosCat === c.id ? ' active' : ''}" data-demos-cat="${c.id}">${c.label} (${count})</button>`;
  });
  html += '</div>';
  // Count + collapse-all
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div class="demo-cat-count" style="margin-bottom:0">${filtered.length} exercise${filtered.length !== 1 ? 's' : ''}${demosSearch ? ' matching "' + escHtml(demosSearch) + '"' : ''}</div><button class="demo-collapse-all" id="demos-collapse-all">Collapse All</button></div>`;
  html += '</div>'; // end sticky
  if (filtered.length === 0) {
    html += '<div class="empty-state" style="padding:32px 16px"><div class="empty-state-title">No Exercises Found</div><div class="empty-state-desc">Try a different search term or category filter.</div></div>';
  } else {
    const typeColors = { Core: '#3b82f6', Legs: '#22c55e', Glutes: '#f97316', 'Upper Body': '#ec4899', Back: '#a855f7', Plyometric: '#ef4444', Cardio: '#f59e0b', Mobility: '#06b6d4', Stretch: '#10b981', Balance: '#6366f1' };
    filtered.forEach((ex, i) => {
      const videoUrl = exerciseDemoVideos[ex.key] || ex.defaultVideoUrl || '';
      const embedUrl = getEmbedUrl(videoUrl);
      const typeColor = typeColors[ex.exerciseType] || ex.catColor;
      const hasVideo = !!embedUrl;
      const planCount = ex.plans ? ex.plans.length : 0;
      html += `
        <div class="demo-ex-card">
          <div class="demo-ex-header" data-demos-expand="${i}">
            <div class="demo-ex-info">
              <div class="demo-ex-name">${escHtml(ex.name)}${hasVideo ? ' <svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;vertical-align:-1px;color:var(--primary);display:inline"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : ''}</div>
              <div class="demo-ex-meta">
                <span style="color:${typeColor}">${ex.exerciseType || ex.catLabel}</span>
                ${planCount > 0 ? '<span>' + planCount + ' plan' + (planCount !== 1 ? 's' : '') + '</span>' : ''}
              </div>
            </div>
            <span class="demo-ex-badge" style="background:${ex.catColor}22;color:${ex.catColor}">${ex.catLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--muted-fg);flex-shrink:0;transition:transform .15s"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="demo-ex-body" id="demos-body-${i}">
            ${embedUrl ? `
              <div class="demo-ex-video">
                <iframe src="${escHtml(embedUrl)}" allowfullscreen loading="lazy"></iframe>
              </div>
            ` : ''}
            ${ex.description ? '<div class="demo-ex-desc">' + escHtml(ex.description) + '</div>' : ''}
            ${!embedUrl ? `
              <div class="demo-ex-no-video">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                No video added yet
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
  }
  el.innerHTML = html;
  // Bind search
  const searchInput = $('demos-search-input');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      demosSearch = searchInput.value.trim();
      renderDemonstration();
    }, 250);
  });
  // Bind category pills
  el.querySelectorAll('.demo-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      demosCat = btn.dataset.demosCat;
      renderDemonstration();
    });
  });
  // Bind expand/collapse
  el.querySelectorAll('[data-demos-expand]').forEach(header => {
    header.addEventListener('click', () => {
      const idx = header.dataset.demosExpand;
      const body = $('demos-body-' + idx);
      const chevron = header.querySelector('svg:last-child');
      if (body) {
        body.classList.toggle('show');
        if (chevron) chevron.style.transform = body.classList.contains('show') ? 'rotate(180deg)' : '';
      }
    });
  });
  // Bind collapse-all
  const collapseAllBtn = $('demos-collapse-all');
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', () => {
      el.querySelectorAll('.demo-ex-body.show').forEach(body => {
        body.classList.remove('show');
        const hdr = body.previousElementSibling;
        if (hdr) { const ch = hdr.querySelector('svg:last-child'); if (ch) ch.style.transform = ''; }
      });
    });
  }
}
// MY PLANS TAB (AI-generated custom plans)
function renderMyPlans() {
  const c = $('myplans-content');
  const activePlanId = userProfile?.activePlanId;
  let html = '<div class="page-title">My Plans</div>';
  // Generate button
  html += `<button class="strava-connect" id="myplans-generate-btn" style="background:linear-gradient(135deg,#7c3aed,#a855f7);margin-bottom:14px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M12 2a8 8 0 0 1 8 8c0 3.1-1.7 5.8-4.3 7.1L12 22l-3.7-4.9A8 8 0 0 1 12 2z"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg>
    Generate a New Plan with AI
  </button>`;
  if (customPlans.length === 0) {
    html += `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--muted-fg)"><path d="M12 2a8 8 0 0 1 8 8c0 3.1-1.7 5.8-4.3 7.1L12 22l-3.7-4.9A8 8 0 0 1 12 2z"/><circle cx="12" cy="10" r="2"/></svg></div>
      <div class="empty-state-title">No Custom Plans Yet</div>
      <div class="empty-state-desc">Tap "Generate a New Plan" above to create a personalised training plan with AI. You can also share plans with your team.</div>
    </div>`;
  } else {
    html += '<div class="space-y">';
    customPlans.forEach((plan, idx) => {
      const isActive = plan.id === activePlanId;
      const isMine = plan.createdBy === (currentUser?.uid || 'demo');
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted-fg);margin-bottom:-8px;margin-top:4px">
        <span class="custom-plan-badge">AI Plan</span>
        ${plan.shared ? '<span class="shared-plan-badge">Shared</span>' : ''}
        <span style="flex:1">${isMine ? 'Created by you' : 'by ' + escHtml(plan.createdByName || 'Unknown')}</span>
        <button class="delete-ai-plan-btn" data-plan-idx="${idx}" style="background:none;border:none;color:var(--muted-fg);cursor:pointer;padding:4px 6px;font-size:16px;line-height:1" title="Delete plan">✕</button>
      </div>`;
      html += renderPlanCard(plan, isActive);
    });
    html += '</div>';
  }
  c.innerHTML = html;
  // Bind delete buttons
  c.querySelectorAll('.delete-ai-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.planIdx);
      if (confirm('Delete this AI plan?')) {
        deleteCustomPlan(idx);
      }
    });
  });
  // Bind generate button
  const genBtn = $('myplans-generate-btn');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      haptic('light');
      openAiCoach();
      startPlanGeneration();
    });
  }
  // Bind plan cards (same as Plans tab)
  bindPlanSearchAndCards(c);
}
// --- Workout Calendar ---
function renderWorkoutCalendar(now) {
  const year = calViewYear;
  const month = calViewMonth;
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayLabels = ['S','M','T','W','T','F','S'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  // Build set of dates with workouts
  const workoutDates = new Set();
  userWorkouts.forEach(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    if (d) workoutDates.add(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'));
  });
  const calOpen = localStorage.getItem('vf_cal_open') !== 'false';
  let html = '<div class="section-card" style="margin-top:12px"><div class="section-title" id="cal-toggle" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none">Workout Calendar<span style="font-size:16px;transition:transform .2s;transform:rotate(' + (calOpen ? '0' : '-90') + 'deg)">▾</span></div>';
  html += '<div id="cal-body" style="' + (calOpen ? '' : 'display:none') + '">';
  html += '<div class="cal-nav"><button class="cal-nav-btn" data-cal-dir="-1">‹</button>';
  html += '<span class="cal-nav-title">' + monthNames[month] + ' ' + year + '</span>';
  html += '<button class="cal-nav-btn" data-cal-dir="1">›</button></div>';
  html += '<div class="cal-grid">';
  dayLabels.forEach(d => { html += '<div class="cal-header">' + d + '</div>'; });
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const isToday = dateKey === todayStr;
    const hasWorkout = workoutDates.has(dateKey);
    const cls = 'cal-day' + (isToday ? ' today' : '') + (hasWorkout ? ' has-workout' : '');
    html += '<div class="' + cls + '" data-date-key="' + dateKey + '">' + d + '</div>';
  }
  html += '</div><div id="cal-detail" class="cal-day-detail" style="display:none" data-showing=""></div></div></div>';
  return html;
}
// --- Personal Bests ---
function renderPersonalBests(now, totalWorkouts, streak) {
  if (totalWorkouts === 0) return '';
  // Best streak (longest consecutive days)
  let bestStreak = 0, tempStreak = 0, lastDate = null;
  const sortedDates = [];
  userWorkouts.forEach(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    if (d) sortedDates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  });
  const uniqueDates = [...new Set(sortedDates)].sort();
  uniqueDates.forEach((t, i) => {
    if (i === 0) { tempStreak = 1; }
    else if (t - uniqueDates[i-1] === 86400000) { tempStreak++; }
    else { tempStreak = 1; }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
  });
  // Best week (most workouts in 7 days)
  let bestWeek = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const windowEnd = uniqueDates[i] + 7 * 86400000;
    let count = 0;
    for (let j = i; j < uniqueDates.length && uniqueDates[j] < windowEnd; j++) count++;
    if (count > bestWeek) bestWeek = count;
  }
  // Longest workout
  let longestWorkout = 0;
  userWorkouts.forEach(w => { if (w.duration && w.duration > longestWorkout) longestWorkout = w.duration; });
  // Highest RPE
  let highestRpe = 0;
  userWorkouts.forEach(w => { if (w.rpe && w.rpe > highestRpe) highestRpe = w.rpe; });
  let html = '<div class="section-card" style="margin-top:12px"><div class="section-title">Personal Bests</div>';
  html += '<div class="pb-grid">';
  html += '<div class="pb-card"><div class="pb-icon">🔥</div><div class="pb-val">' + bestStreak + '</div><div class="pb-lbl">Best Streak</div></div>';
  html += '<div class="pb-card"><div class="pb-icon">📅</div><div class="pb-val">' + bestWeek + '</div><div class="pb-lbl">Best Week</div></div>';
  html += '<div class="pb-card"><div class="pb-icon">⏱️</div><div class="pb-val">' + longestWorkout + '<span style="font-size:11px">m</span></div><div class="pb-lbl">Longest Session</div></div>';
  if (highestRpe > 0) {
    html += '<div class="pb-card"><div class="pb-icon">💪</div><div class="pb-val">' + highestRpe + '/10</div><div class="pb-lbl">Highest Effort</div></div>';
  } else {
    html += '<div class="pb-card"><div class="pb-icon">🏋️</div><div class="pb-val">' + totalWorkouts + '</div><div class="pb-lbl">Total Sessions</div></div>';
  }
  html += '</div></div>';
  return html;
}
// --- XP & Level Bar ---
function renderXpBar() {
  const xp = calcXp();
  const lvl = getXpLevel(xp);
  let html = '<div class="xp-bar-wrap">';
  html += '<div class="xp-header"><span class="xp-level-badge">' + lvl.icon + ' ' + lvl.name + '</span><span class="xp-amount">' + xp + ' XP</span></div>';
  html += '<div class="xp-track"><div class="xp-fill" style="width:' + lvl.pct + '%"></div></div>';
  if (lvl.next) {
    html += '<div class="xp-next">' + (lvl.next.min - xp) + ' XP to ' + lvl.next.icon + ' ' + lvl.next.name + '</div>';
  } else {
    html += '<div class="xp-next">Max level reached!</div>';
  }
  html += '</div>';
  return html;
}
// --- Personal Goals ---
function renderGoals() {
  loadGoals();
  let html = '<div class="section-card" style="margin-top:12px"><div class="section-title">My Goals</div>';
  if (userGoals.length === 0) {
    html += '<div style="font-size:12px;color:var(--muted-fg);padding:4px 0">Set a goal to stay motivated!</div>';
  }
  userGoals.forEach((g, idx) => {
    // Calculate current progress
    let current = 0;
    if (g.type === 'workouts') current = userWorkouts.length;
    else if (g.type === 'streak') {
      const dates = [...new Set(userWorkouts.map(w => {
        const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
        return d ? d.toISOString().split('T')[0] : null;
      }).filter(Boolean))].sort();
      let s = 0, c = 0;
      const today = new Date(); today.setHours(0,0,0,0);
      for (let i = dates.length - 1; i >= 0; i--) {
        const diff = Math.floor((today - new Date(dates[i])) / 86400000);
        if (diff === c) { s++; c++; }
        else if (i === dates.length - 1 && diff <= 1) { s = 1; c = diff + 1; }
        else break;
      }
      current = s;
    } else if (g.type === 'minutes') {
      current = userWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    }
    const pct = g.target > 0 ? Math.min(100, (current / g.target) * 100) : 0;
    const radius = 22, circ = 2 * Math.PI * radius, offset = circ - (pct / 100) * circ;
    const done = current >= g.target;
    html += '<div class="goal-card">';
    html += '<div class="goal-ring-wrap">';
    html += '<div class="goal-ring"><svg viewBox="0 0 56 56" width="56" height="56">';
    html += '<circle cx="28" cy="28" r="' + radius + '" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="4"/>';
    html += '<circle cx="28" cy="28" r="' + radius + '" fill="none" stroke="' + (done ? '#22c55e' : 'var(--primary)') + '" stroke-width="4" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>';
    html += '</svg><div class="goal-ring-text">' + (done ? '✓' : Math.round(pct) + '%') + '</div></div>';
    html += '<div class="goal-info"><div class="goal-label">' + (done ? '🎉 ' : '') + escHtml(g.label) + '</div>';
    html += '<div class="goal-progress">' + current + ' / ' + g.target + ' ' + g.type + '</div></div></div>';
    html += '<div class="goal-actions"><button class="goal-del" data-goal-del="' + idx + '">Remove</button></div>';
    html += '</div>';
  });
  html += '<button class="goal-add-btn" id="goal-add-btn">+ Add a Goal</button>';
  html += '</div>';
  return html;
}
// --- Team Challenge ---
function renderTeamChallenge() {
  if (!activeChallenge) return '';
  const now = new Date();
  const end = new Date(activeChallenge.endDate);
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  // Build teams array — handle both {name,score} and nested Firestore maps
  const rawTeams = activeChallenge.teams || {};
  const teams = [];
  Object.entries(rawTeams).forEach(([key, val]) => {
    if (val && typeof val === 'object') {
      teams.push({ name: val.name || key, score: val.score || 0 });
    } else {
      teams.push({ name: key, score: 0 });
    }
  });
  if (teams.length === 0) return '';
  const maxScore = Math.max(1, ...teams.map(t => t.score));
  const colors = ['#BFFF00', '#7c3aed', '#f97316', '#3b82f6', '#ec4899'];
  let html = '<div class="challenge-card">';
  html += '<div class="challenge-title">🏆 ' + escHtml(activeChallenge.title || 'Team Challenge') + '</div>';
  html += '<div class="challenge-meta">' + (daysLeft > 0 ? daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' remaining' : 'Challenge ended!') + ' · Mins + XP</div>';
  teams.sort((a, b) => b.score - a.score);
  teams.forEach((t, i) => {
    const pct = maxScore > 0 ? (t.score / maxScore) * 100 : 0;
    html += '<div class="challenge-team">';
    html += '<div class="challenge-team-name">' + (i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '') + escHtml(t.name) + '</div>';
    html += '<div class="challenge-team-bar"><div class="challenge-team-fill" style="width:' + pct + '%;background:' + (colors[i] || colors[4]) + '"></div></div>';
    html += '<div class="challenge-team-score">' + t.score + ' pts</div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}
// --- Smart Plan Recommendation ---
function renderPlanRecommendation() {
  if (!userProfile) return '';
  const activePlanId = userProfile.activePlanId;
  // Only show if no active plan OR active plan is complete
  if (activePlanId) {
    const plan = findPlan(activePlanId);
    if (plan && plan.workouts) {
      const total = plan.workouts.length;
      let done = 0;
      plan.workouts.forEach((w, i) => {
        const k = activePlanId + '-' + w.week + '-' + w.day + '-' + (plan.workouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
        if (userChecklist[k]) done++;
      });
      if (done < total) return ''; // Plan still in progress
    }
  }
  const year = userProfile.yearLevel || 'Y9';
  const tier = userProfile.fitnessLevel || 'basic';
  // Suggest next tier or same tier in a different category
  const tiers = ['basic', 'average', 'intense'];
  const cats = ['invehicle', 'floor', 'machine'];
  const currentCat = activePlanId ? (findPlan(activePlanId)?.category || 'invehicle') : 'invehicle';
  const tierIdx = tiers.indexOf(tier);
  // Try: different category same tier, then same category next tier
  let rec = null;
  for (const cat of cats) {
    if (cat === currentCat) continue;
    rec = ALL_PLANS.find(p => p.yearLevel === year && p.tier === tier && p.category === cat && p.id !== activePlanId);
    if (rec) break;
  }
  if (!rec && tierIdx < tiers.length - 1) {
    rec = ALL_PLANS.find(p => p.yearLevel === year && p.tier === tiers[tierIdx + 1] && p.category === currentCat);
  }
  if (!rec) {
    rec = ALL_PLANS.find(p => p.yearLevel === year && p.tier === tier && p.id !== activePlanId);
  }
  if (!rec) return '';
  const catLabels = { invehicle: '🚴 In Vehicle', floor: '🏠 Floor & Home', machine: '🏋️ Machine' };
  let html = '<div class="plan-rec-card">';
  html += '<div class="plan-rec-title">' + (activePlanId ? '🎉 Plan complete! Try next:' : '📋 Recommended for you:') + '</div>';
  html += '<div class="plan-rec-name">' + escHtml(rec.name) + '</div>';
  html += '<div class="plan-rec-desc">' + (catLabels[rec.category] || '') + ' · ' + rec.yearLevel + ' · ' + capitalize(rec.tier) + ' · ' + rec.durationWeeks + ' weeks</div>';
  html += '<button class="plan-rec-btn" data-rec-plan="' + rec.id + '">Start This Plan</button>';
  html += '</div>';
  return html;
}
// --- Team Activity Feed ---
function renderTeamFeed() {
  if (!teamFeedCache || teamFeedCache.length === 0) return '';
  let html = '<div class="section-card" style="margin-top:12px"><div class="section-title">Team Activity</div>';
  teamFeedCache.slice(0, 8).forEach((item, idx) => {
    const initials = (item.name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const reactKey = 'vf_react_' + (item.uid || idx) + '_' + (item.dateKey || idx);
    let myReaction = '';
    try { myReaction = localStorage.getItem(reactKey) || ''; } catch(e) {}
    html += `<div class="feed-item">
      <div class="feed-avatar">${initials}</div>
      <div class="feed-body">
        <div class="feed-name">${escHtml(item.name || 'Unknown')}</div>
        <div class="feed-action">${escHtml(item.action)}</div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
          <div class="feed-time">${item.timeAgo}</div>
          <div class="feed-reactions" style="display:flex;gap:2px;margin-left:auto">
            ${['🔥','💪','👏'].map(emoji => `<button class="feed-react-btn${myReaction === emoji ? ' active' : ''}" data-react-key="${reactKey}" data-emoji="${emoji}" style="font-size:14px;padding:2px 5px;border-radius:6px;background:${myReaction === emoji ? 'rgba(191,255,0,.15)' : 'transparent'};border:1px solid ${myReaction === emoji ? 'var(--primary)' : 'transparent'};cursor:pointer;transition:all .15s">${emoji}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  });
  html += '</div>';
  return html;
}
function renderToday() {
  const c = $('today-content');
  const now = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = dayNames[now.getDay()] + ', ' + now.getDate() + ' ' + monthNames[now.getMonth()];
  const activePlanId = userProfile?.activePlanId;
  const activePlan = findPlan(activePlanId);
  const totalWorkouts = userWorkouts.length;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0,0,0,0);
  const workoutsThisWeek = userWorkouts.filter(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    return d && d >= weekStart;
  }).length;
  // Streak
  let streak = 0;
  if (userWorkouts.length > 0) {
    const today = new Date(); today.setHours(0,0,0,0);
    const workoutDates = new Set();
    userWorkouts.forEach(w => {
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
      if (d) workoutDates.add(d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate());
    });
    let check = new Date(today);
    let todayKey = check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate();
    if (!workoutDates.has(todayKey)) check.setDate(check.getDate() - 1);
    while (true) {
      const key = check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate();
      if (workoutDates.has(key)) { streak++; check.setDate(check.getDate() - 1); } else break;
    }
  }
  // XP level inline
  const xp = calcXp();
  const lvl = getXpLevel(xp);
  // Widget pin state
  const defaultWidgets = { weather: true, health: true, engagement: true, training: true, challenge: true, weekly: true, quickActions: true };
  let pinnedWidgets = defaultWidgets;
  try { pinnedWidgets = { ...defaultWidgets, ...JSON.parse(localStorage.getItem('vf_widgets') || '{}') }; } catch(e) {}
  const isWidgetOn = (id) => pinnedWidgets[id] !== false;
  // === BUILD HTML — simplified layout ===
  let html = '';
  // ── SECTION 1: Compact header (date + XP + streak in one row) ──
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
    <div class="today-date" style="margin:0">${dateStr}</div>
    <div style="display:flex;align-items:center;gap:8px">
      ${streak > 0 ? `<span style="font-size:12px;font-weight:700;color:#f59e0b">🔥 ${streak}d</span>` : ''}
      <span style="font-size:12px;font-weight:700;color:var(--primary)">${lvl.icon} ${xp} XP</span>
      <button id="today-customize" style="background:none;border:none;color:var(--muted-fg);cursor:pointer;padding:2px;font-size:14px" title="Customize widgets">⚙️</button>
    </div>
  </div>`;
  html += `<div style="height:3px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:${lvl.pct}%;background:linear-gradient(90deg,var(--primary),#a3e635);border-radius:99px;transition:width .6s"></div></div>`;
  // Engagement indicators row
  if (isWidgetOn('engagement')) {
  const freezeCount = parseInt(localStorage.getItem('vf_streak_freezes') || '0');
  const engTodayStr = now.toISOString().split('T')[0];
  const hasTrainedToday = userWorkouts.some(w => { const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null; return d && d.toISOString().split('T')[0] === engTodayStr; });
  const indicators = [];
  if (!hasTrainedToday && totalWorkouts > 0) indicators.push('<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:rgba(245,158,11,.12);color:#f59e0b">2x XP — log today!</span>');
  if (freezeCount > 0) indicators.push('<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:rgba(59,130,246,.1);color:#3b82f6">🧊 ' + freezeCount + ' freeze' + (freezeCount > 1 ? 's' : '') + '</span>');
  if (indicators.length > 0) {
    html += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">' + indicators.join('') + '</div>';
  }
  }
  // Weather card — render cached inline, fetch fresh in background
  if (isWidgetOn('weather')) {
  let cachedWeather = null;
  try { cachedWeather = JSON.parse(localStorage.getItem('vf_weather') || 'null'); } catch(e) {}
  if (cachedWeather && cachedWeather.temp !== undefined) {
    const _w = cachedWeather;
    const _iconUrl = `https://openweathermap.org/img/wn/${_w.icon}@2x.png`;
    const _advice = _w.wind >= 30 ? '💨 Strong winds — consider indoor training' : _w.temp < 8 ? '🥶 Cold out — wear layers' : _w.temp > 35 ? '🔥 Extreme heat — train early or indoors' : _w.temp >= 20 ? '☀️ Great conditions for training' : '👍 Good conditions for training';
    const _bgGrad = _w.icon?.includes('n') ? 'linear-gradient(135deg,rgba(30,41,59,.9),rgba(51,65,85,.8))' : 'linear-gradient(135deg,rgba(59,130,246,.12),rgba(124,58,237,.06))';
    const _border = _w.icon?.includes('n') ? 'rgba(100,116,139,.3)' : 'rgba(59,130,246,.2)';
    html += `<div id="weather-card" style="margin-bottom:10px"><div style="padding:14px 16px;background:${_bgGrad};border:1px solid ${_border};border-radius:14px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <img src="${_iconUrl}" style="width:52px;height:52px;margin:-8px" alt="${escHtml(_w.desc)}">
        <div style="flex:1">
          <div style="display:flex;align-items:baseline;gap:6px">
            <span style="font-size:32px;font-weight:800;color:var(--text);line-height:1">${_w.temp}°</span>
            <span style="font-size:13px;color:var(--muted-fg);text-transform:capitalize">${escHtml(_w.desc)}</span>
          </div>
          <div style="font-size:12px;color:var(--muted-fg);margin-top:2px">Feels ${_w.feels}°${_w.city ? ' · ' + escHtml(_w.city) : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:6px">
        <span style="font-size:11px;color:var(--muted-fg)">💨 ${_w.wind} km/h</span>
        <span style="font-size:11px;color:var(--muted-fg)">💧 ${_w.humidity}%</span>
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--text)">${_advice}</div>
    </div></div>`;
  } else {
    html += `<div id="weather-card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(124,58,237,.05));border:1px solid rgba(59,130,246,.15);border-radius:12px">
        <div style="width:44px;height:44px;border-radius:10px;background:rgba(59,130,246,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="width:20px;height:20px;border-radius:50%;background:rgba(59,130,246,.2);animation:pulse 1.5s infinite"></div></div>
        <div style="flex:1"><div style="height:14px;width:60%;background:rgba(255,255,255,.06);border-radius:4px;margin-bottom:6px"></div><div style="height:10px;width:80%;background:rgba(255,255,255,.04);border-radius:4px"></div></div>
      </div>
    </div>`;
  }
  }
  // Health data from wearable sync
  if (isWidgetOn('health')) {
  const healthData = userProfile?.health;
  if (healthData && (healthData.latestHr || healthData.latestSteps || healthData.latestSleep)) {
    html += `<div id="health-card-tap" style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">❤️ Health Sync</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${healthData.lastSync ? '<span style="font-size:10px;color:var(--muted-fg)">' + timeAgo(new Date(healthData.lastSync)) + '</span>' : ''}
          <span style="font-size:12px;color:var(--muted-fg)">›</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px">
        ${healthData.latestHr ? `<div style="text-align:center;padding:10px 4px;background:rgba(239,68,68,.06);border-radius:10px">
          <div style="font-size:22px;font-weight:800;color:#ef4444">${healthData.latestHr}</div>
          <div style="font-size:10px;color:var(--muted-fg);margin-top:2px">❤️ bpm</div>
        </div>` : ''}
        ${healthData.latestSteps ? `<div style="text-align:center;padding:10px 4px;background:rgba(34,197,94,.06);border-radius:10px">
          <div style="font-size:22px;font-weight:800;color:#22c55e">${healthData.latestSteps > 999 ? (healthData.latestSteps / 1000).toFixed(1) + 'k' : healthData.latestSteps}</div>
          <div style="font-size:10px;color:var(--muted-fg);margin-top:2px">👟 steps</div>
        </div>` : ''}
        ${healthData.latestSleep ? `<div style="text-align:center;padding:10px 4px;background:rgba(124,58,237,.06);border-radius:10px">
          <div style="font-size:22px;font-weight:800;color:#a855f7">${healthData.latestSleep}</div>
          <div style="font-size:10px;color:var(--muted-fg);margin-top:2px">😴 hours</div>
        </div>` : ''}
        ${healthData.restingHr ? `<div style="text-align:center;padding:10px 4px;background:rgba(59,130,246,.06);border-radius:10px">
          <div style="font-size:22px;font-weight:800;color:#3b82f6">${healthData.restingHr}</div>
          <div style="font-size:10px;color:var(--muted-fg);margin-top:2px">💓 resting</div>
        </div>` : ''}
      </div>
      <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--muted-fg)">Tap for details</div>
    </div>`;
  }
  }
  // Announcements (only if active)
  const activeAnns = adminAnnouncements.filter(a => a.active);
  activeAnns.forEach(a => {
    html += `<div class="announce-banner"><div class="announce-banner-row"><div class="announce-banner-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div class="announce-banner-body"><div class="announce-banner-title">${escHtml(a.title)}</div><div class="announce-banner-msg">${escHtml(a.message)}</div></div></div></div>`;
  });
  // Weekly summary card (shows on Monday, or first open of the week)
  const weekDay = now.getDay(); // 0=Sun
  const lastSummaryWeek = localStorage.getItem('vf_summary_week');
  const summaryWeekStart = new Date(now); summaryWeekStart.setDate(now.getDate() - now.getDay() + 1); summaryWeekStart.setHours(0,0,0,0);
  const thisWeekKey = summaryWeekStart.toISOString().split('T')[0];
  if (totalWorkouts > 0 && lastSummaryWeek !== thisWeekKey) {
    // Compute last week stats
    const lwStart = new Date(summaryWeekStart); lwStart.setDate(lwStart.getDate() - 7);
    const lwEnd = summaryWeekStart;
    const lwWorkouts = userWorkouts.filter(w => { const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null; return d && d >= lwStart && d < lwEnd; });
    const lwMins = lwWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const lwXp = lwWorkouts.length * 10;
    if (lwWorkouts.length > 0) {
      const goalText = lwWorkouts.length < 3 ? 'Push for 3 sessions this week!' : lwWorkouts.length < 5 ? 'Great week — aim for ' + (lwWorkouts.length + 1) + ' this week!' : 'Incredible consistency — keep it up!';
      html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">📊 Last Week</div>
          <button id="dismiss-weekly" style="background:none;border:none;color:var(--muted-fg);font-size:16px;cursor:pointer;padding:2px">✕</button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:8px">
          <div style="text-align:center;flex:1"><div style="font-size:20px;font-weight:800;color:var(--primary)">${lwWorkouts.length}</div><div style="font-size:10px;color:var(--muted-fg)">sessions</div></div>
          <div style="text-align:center;flex:1"><div style="font-size:20px;font-weight:800;color:var(--text)">${lwMins}</div><div style="font-size:10px;color:var(--muted-fg)">mins</div></div>
          <div style="text-align:center;flex:1"><div style="font-size:20px;font-weight:800;color:#f59e0b">+${lwXp}</div><div style="font-size:10px;color:var(--muted-fg)">XP</div></div>
        </div>
        <div style="font-size:12px;color:var(--muted-fg);line-height:1.4">${goalText}</div>
      </div>`;
    }
  }
  // ── SECTION 2: Today's Training (the main thing) ──
  if (activePlan) {
    const pdData = getPlanDisplayData(activePlan);
    const totalPlanWorkouts = activePlan.workouts.length;
    let completedPlanWorkouts = 0;
    activePlan.workouts.forEach((w, i) => {
      const k = activePlanId + '-' + w.week + '-' + w.day + '-' + (activePlan.workouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
      if (userChecklist[k]) completedPlanWorkouts++;
    });
    const progressPct = totalPlanWorkouts > 0 ? Math.round((completedPlanWorkouts / totalPlanWorkouts) * 100) : 0;
    html += `<div class="plan-progress"><div class="plan-progress-text"><span>${escHtml(pdData.name)}</span><span>${completedPlanWorkouts}/${totalPlanWorkouts} · ${progressPct}%</span></div><div class="plan-progress-bar"><div class="plan-progress-fill" style="width:${progressPct}%"></div></div></div>`;
    // Duration selector
    const selectedDur = parseInt(localStorage.getItem('vf_session_duration') || '0');
    html += `<div style="display:flex;align-items:center;gap:4px;margin-bottom:10px;overflow-x:auto;-webkit-overflow-scrolling:touch">
      <span style="font-size:11px;color:var(--muted-fg);white-space:nowrap;margin-right:2px">Time:</span>
      ${[0,10,15,20,25,30].map(d => `<button class="dur-pick" data-dur="${d}" style="padding:5px 8px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid ${selectedDur === d ? 'var(--primary)' : 'var(--border)'};background:${selectedDur === d ? 'rgba(191,255,0,.15)' : 'var(--surface-alt)'};color:${selectedDur === d ? 'var(--primary)' : 'var(--muted-fg)'};cursor:pointer;white-space:nowrap">${d === 0 ? 'Full' : d + 'min'}</button>`).join('')}
    </div>`;
    const dayMap = {'Mon':1,'Tue':2,'Wed':3,'Thu':4,'Fri':5,'Sat':6,'Sun':0};
    const todayDay = now.getDay();
    const todayWorkouts = activePlan.workouts.filter(w => dayMap[w.day] === todayDay);
    if (todayWorkouts.length > 0) {
      html += '<div class="space-y">';
      todayWorkouts.forEach((origW, i) => {
        const globalIdx = activePlan.workouts.indexOf(origW);
        const w = getWorkoutData(activePlanId, globalIdx, origW);
        w.week = origW.week; w.day = origW.day;
        // Apply selected duration cap
        if (selectedDur > 0 && w.duration > selectedDur) {
          w.originalDuration = w.duration;
          w.duration = selectedDur;
          w.scaled = true;
        }
        const checkKey = activePlanId + '-' + origW.week + '-' + origW.day + '-' + i;
        const isChecked = userChecklist[checkKey] === true;
        html += renderChecklistItem(w, checkKey, isChecked);
      });
      html += '</div>';
    } else {
      html += `<div class="today-rest"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px;color:var(--muted-fg)"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg><span>Rest day — enjoy the recovery.</span></div>`;
    }
  } else {
    const recHtml = renderPlanRecommendation();
    if (recHtml) { html += recHtml; }
    else if (totalWorkouts === 0) {
      // First-time onboarding — guided plan picker
      const year = userProfile?.yearLevel || 'Y9';
      const tier = userProfile?.fitnessLevel || 'basic';
      html += `<div style="background:linear-gradient(135deg,rgba(191,255,0,.06),rgba(34,197,94,.04));border:1.5px solid rgba(191,255,0,.2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:6px">🚀</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px">Welcome to TurboPrep!</div>
        <div style="font-size:12px;color:var(--muted-fg);margin-bottom:12px;line-height:1.4">Let's get you a training plan. We've matched one to your year level (${year}) and fitness tier (${capitalize(tier)}).</div>
        <button class="btn btn-primary" id="onboard-pick-plan" style="width:100%;padding:12px;font-size:14px;font-weight:700;border-radius:10px">🏋️ Pick My Plan</button>
        <div style="font-size:11px;color:var(--muted-fg);margin-top:8px">Or go to Fitness → Plans to browse all 54 options</div>
      </div>`;
    } else {
      html += `<div class="today-no-plan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;color:var(--primary)"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><div><strong>No plan active</strong></div><div style="font-size:12px;color:var(--muted-fg)">Go to Fitness → Plans to pick one.</div></div>`;
    }
  }
  // Daily Roundup Card
  if (isWidgetOn('engagement') && totalWorkouts > 0) {
    const roundupToday = now.toISOString().split('T')[0];
    const todaysWorkouts = userWorkouts.filter(w => { const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null; return d && d.toISOString().split('T')[0] === roundupToday; });
    const todayMins = todaysWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
    const todayXp = todaysWorkouts.length * 10 + todaysWorkouts.filter(w => w.rpe).length * 5;
    const healthD = userProfile?.health;
    if (todaysWorkouts.length > 0 || (healthD && healthD.latestSteps > 0)) {
      const msgs = todaysWorkouts.length >= 2 ? 'Crushing it today!' : todaysWorkouts.length === 1 ? 'Nice session logged.' : todayMins > 60 ? 'Big training day!' : '';
      html += `<div style="background:linear-gradient(135deg,rgba(191,255,0,.05),rgba(34,197,94,.03));border:1px solid rgba(191,255,0,.15);border-radius:12px;padding:12px 14px;margin-top:8px">
        <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:8px">📋 Today's Roundup</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          ${todaysWorkouts.length > 0 ? `<div><span style="font-size:18px;font-weight:800;color:var(--text)">${todaysWorkouts.length}</span><span style="font-size:11px;color:var(--muted-fg);margin-left:4px">workout${todaysWorkouts.length > 1 ? 's' : ''}</span></div>` : ''}
          ${todayMins > 0 ? `<div><span style="font-size:18px;font-weight:800;color:var(--text)">${todayMins}</span><span style="font-size:11px;color:var(--muted-fg);margin-left:4px">mins</span></div>` : ''}
          ${todayXp > 0 ? `<div><span style="font-size:18px;font-weight:800;color:var(--primary)">+${todayXp}</span><span style="font-size:11px;color:var(--muted-fg);margin-left:4px">XP</span></div>` : ''}
          ${healthD?.latestSteps ? `<div><span style="font-size:18px;font-weight:800;color:#22c55e">${healthD.latestSteps > 999 ? (healthD.latestSteps / 1000).toFixed(1) + 'k' : healthD.latestSteps}</span><span style="font-size:11px;color:var(--muted-fg);margin-left:4px">steps</span></div>` : ''}
        </div>
        ${msgs ? '<div style="font-size:12px;font-weight:600;color:var(--text);margin-top:6px">' + msgs + '</div>' : ''}
      </div>`;
    }
  }
  // ── SECTION 3: Quick actions ──
  html += `<div style="display:flex;gap:8px;margin-top:10px">
    <button class="btn" id="today-quick-log" style="flex:1;padding:10px;font-size:13px;font-weight:600;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Log</button>
    <button class="btn" id="today-quick-record" style="flex:1;padding:10px;font-size:13px;font-weight:600;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/></svg>Record GPS</button>
  </div>`;
  // ── SECTION 4: Smart contextual cards ──
  const lastActivity = userWorkouts[0];
  const lastActivityDate = lastActivity?.date ? (lastActivity.date.toDate ? lastActivity.date.toDate() : new Date(lastActivity.date)) : null;
  const isToday = lastActivityDate && lastActivityDate.toDateString() === now.toDateString();
  let storedRoutes = {};
  try { storedRoutes = JSON.parse(localStorage.getItem('vf_routes') || '{}'); } catch(e) {}
  const lastRouteId = lastActivity?.routeId || (lastActivity?.stravaId ? 'strava-' + lastActivity.stravaId : lastActivity?._id);
  const lastRoute = lastRouteId ? storedRoutes[lastRouteId] : null;
  const hasLastRoute = lastRoute && lastRoute.length > 1;
  if (isToday && lastActivity) {
    const typeIcons = {hpv:'🏎️',ride:'🚴',run:'🏃',treadmill:'🏃‍♂️',walk:'🚶',gym:'🏋️',HPV:'🏎️',Ride:'🚴',Run:'🏃',Treadmill:'🏃‍♂️',Strength:'🏋️',Cardio:'❤️',Flexibility:'🧘'};
    html += `<div class="card" style="margin-top:10px;overflow:hidden">`;
    if (hasLastRoute) html += `<div class="activity-map-thumb" id="today-route-map" data-route-id="${lastRouteId}" style="height:120px;margin:0;border-radius:0"></div>`;
    html += `<div class="card-pad" style="padding:8px 12px"><div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${typeIcons[lastActivity.type] || '🏋️'}</span>
      <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px">${escHtml(lastActivity.name || 'Workout')}</div>
      <div style="font-size:11px;color:var(--muted-fg)">${lastActivity.duration ? lastActivity.duration + 'min' : ''}${lastActivity.distance ? ' · ' + lastActivity.distance + 'km' : ''}</div></div>
      <div style="font-size:10px;font-weight:600;color:var(--primary);background:rgba(191,255,0,.1);padding:2px 8px;border-radius:6px">TODAY</div>
    </div></div></div>`;
  }
  // Race countdown (compact, only next race)
  const allRaces = getActiveRaces();
  const todayStr2 = now.toISOString().split('T')[0];
  const futureRaces = allRaces.filter(r => r.date >= todayStr2).sort((a,b) => a.date.localeCompare(b.date));
  const nextRace = futureRaces[0];
  if (nextRace) {
    const raceDate = new Date(nextRace.date + 'T09:00:00+10:00');
    const diffDays = Math.max(0, Math.floor((raceDate - now) / 86400000));
    html += `<div class="today-race-row" style="margin-top:8px"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="width:14px;height:14px;flex-shrink:0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg><span class="today-race-name">${escHtml(nextRace.name)}</span><span class="today-race-days"><strong>${diffDays}</strong>d</span></div>`;
  }
  // Upcoming training session
  const todayStr3 = now.toISOString().split('T')[0];
  const upcomingSessions = trainingSessions.filter(s => s.date >= todayStr3).sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
  const nextSession = upcomingSessions[0];
  if (nextSession) {
    const sDate = new Date(nextSession.date + 'T' + (nextSession.time || '16:00') + ':00');
    const isSessionToday = nextSession.date === todayStr3;
    const diffMs = sDate - now;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    let timeLabel = '';
    if (isSessionToday && diffMs > 0) timeLabel = diffHrs > 0 ? 'in ' + diffHrs + 'h ' + diffMins + 'm' : 'in ' + diffMins + 'm';
    else if (isSessionToday && diffMs <= 0) timeLabel = 'NOW';
    else { const d = sDate; timeLabel = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); }
    html += `<div style="margin-top:8px;padding:12px;background:${isSessionToday ? 'linear-gradient(135deg,rgba(191,255,0,.08),rgba(34,197,94,.06))' : 'var(--card)'};border:1.5px solid ${isSessionToday ? 'rgba(191,255,0,.25)' : 'var(--border)'};border-radius:10px">
      <div style="display:flex;align-items:start;gap:10px">
        <div style="width:36px;height:36px;border-radius:8px;background:${isSessionToday ? 'rgba(191,255,0,.15)' : 'rgba(59,130,246,.1)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">${isSessionToday ? '🏃' : '📅'}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(nextSession.title)}</div>
            <div style="font-size:11px;font-weight:700;color:${isSessionToday ? 'var(--primary)' : 'var(--muted-fg)'}">${timeLabel}</div>
          </div>
          <div style="font-size:12px;color:var(--muted-fg)">${nextSession.time || ''}${nextSession.endTime ? ' - ' + nextSession.endTime : ''}${nextSession.location ? ' · ' + escHtml(nextSession.location) : ''}</div>
          ${nextSession.notes ? '<div style="font-size:11px;color:var(--muted-fg);margin-top:4px;line-height:1.4">' + escHtml(nextSession.notes) + '</div>' : ''}
        </div>
      </div>
      <button class="btn add-to-cal-btn" data-session-idx="0" style="width:100%;margin-top:8px;padding:7px;font-size:11px;font-weight:600;background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;color:var(--text);display:flex;align-items:center;justify-content:center;gap:4px">📲 Add to Calendar</button>
    </div>`;
  }
  // Team challenge (only if active)
  if (activeChallenge) html += renderTeamChallenge();
  // AI insight (compact single line)
  if (totalWorkouts >= 5) {
    const insight = generateTrainingInsight();
    if (insight) html += `<div style="margin-top:8px;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;font-size:12px;color:var(--muted-fg);line-height:1.4;display:flex;align-items:start;gap:8px"><span style="font-size:14px;flex-shrink:0">🧠</span><span>${insight}</span></div>`;
  }
  // Daily Roundup (shows after 5pm if student trained today)
  const roundupHour = now.getHours();
  const roundupDateStr = now.toISOString().split('T')[0];
  const todayWos = userWorkouts.filter(w => { const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null; return d && d.toISOString().split('T')[0] === roundupDateStr; });
  const roundupDismissed = localStorage.getItem('vf_roundup_' + roundupDateStr);
  if (roundupHour >= 17 && todayWos.length > 0 && !roundupDismissed) {
    const rMins = todayWos.reduce((s, w) => s + (w.duration || 0), 0);
    const rDist = todayWos.reduce((s, w) => s + (w.distance || 0), 0);
    const rXp = todayWos.length * 10 + todayWos.filter(w => w.rpe).length * 5;
    const rAvgRpe = todayWos.filter(w => w.rpe).length > 0 ? (todayWos.filter(w => w.rpe).reduce((s, w) => s + w.rpe, 0) / todayWos.filter(w => w.rpe).length).toFixed(1) : null;
    const rTypes = [...new Set(todayWos.map(w => w.type || 'workout'))].join(', ');
    const healthD = userProfile?.health;
    let encouragement = '';
    if (rMins >= 60) encouragement = 'Massive session today. Recovery is just as important — rest well tonight.';
    else if (todayWos.length >= 2) encouragement = 'Multiple sessions in one day — that\'s dedication. Your team will notice.';
    else if (streak >= 7) encouragement = 'Streak going strong! Every day you show up, you get better.';
    else encouragement = 'Another day in the books. Consistency is what separates good from great.';
    html += `<div style="margin-top:10px;background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(191,255,0,.04));border:1px solid rgba(124,58,237,.15);border-radius:12px;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700;color:var(--text)">📋 Today's Roundup</div>
        <button id="dismiss-roundup" style="background:none;border:none;color:var(--muted-fg);font-size:16px;cursor:pointer;padding:2px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${rDist > 0 ? 4 : 3},1fr);gap:6px;margin-bottom:10px">
        <div style="text-align:center;padding:8px 2px;background:rgba(255,255,255,.03);border-radius:8px">
          <div style="font-size:20px;font-weight:800;color:var(--primary)">${todayWos.length}</div>
          <div style="font-size:9px;color:var(--muted-fg)">sessions</div>
        </div>
        <div style="text-align:center;padding:8px 2px;background:rgba(255,255,255,.03);border-radius:8px">
          <div style="font-size:20px;font-weight:800;color:var(--text)">${rMins}</div>
          <div style="font-size:9px;color:var(--muted-fg)">mins</div>
        </div>
        ${rDist > 0 ? `<div style="text-align:center;padding:8px 2px;background:rgba(255,255,255,.03);border-radius:8px">
          <div style="font-size:20px;font-weight:800;color:var(--text)">${rDist.toFixed(1)}</div>
          <div style="font-size:9px;color:var(--muted-fg)">km</div>
        </div>` : ''}
        <div style="text-align:center;padding:8px 2px;background:rgba(255,255,255,.03);border-radius:8px">
          <div style="font-size:20px;font-weight:800;color:#f59e0b">+${rXp}</div>
          <div style="font-size:9px;color:var(--muted-fg)">XP</div>
        </div>
      </div>
      ${rAvgRpe ? `<div style="font-size:11px;color:var(--muted-fg);margin-bottom:4px">Effort: ${rAvgRpe}/10 · Types: ${rTypes}</div>` : ''}
      ${healthD?.latestHr ? `<div style="font-size:11px;color:var(--muted-fg);margin-bottom:4px">Peak HR: ${healthD.latestHr} bpm${healthD.latestSteps ? ' · Steps: ' + healthD.latestSteps.toLocaleString() : ''}</div>` : ''}
      <div style="font-size:12px;color:var(--text);line-height:1.4;margin-top:6px;padding-top:6px;border-top:1px solid rgba(124,58,237,.1)">${encouragement}</div>
    </div>`;
  }
  // Strava connect (new users only)
  if (!stravaTokens?.access_token && totalWorkouts <= 3 && !demoMode) {
    html += `<div style="margin-top:8px;padding:10px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;gap:10px">
      <svg viewBox="0 0 24 24" fill="#fc5200" style="width:18px;height:18px;flex-shrink:0"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
      <div style="flex:1"><div style="font-weight:600;font-size:12px">Connect Strava</div><div style="font-size:10px;color:var(--muted-fg)">Auto-import workouts</div></div>
      <button class="btn btn-primary" id="today-strava-connect" style="padding:5px 10px;font-size:11px;border-radius:6px">Connect</button>
    </div>`;
  }
  // ── SECTION 5: Expandable extras ──
  const extrasOpen = localStorage.getItem('vf_extras_open') === 'true';
  html += `<div style="margin-top:14px"><div id="extras-toggle" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;user-select:none;color:var(--muted-fg);font-size:13px;font-weight:600">Stats & Goals <span style="font-size:14px;transition:transform .2s;transform:rotate(${extrasOpen ? '0' : '-90'}deg)">▾</span></div>
  <div id="extras-body" style="${extrasOpen ? '' : 'display:none'}">`;
  // Stats row
  html += `<div class="today-stats-row" style="margin-bottom:8px"><div class="today-stat"><span class="today-stat-val">${streak}</span><span class="today-stat-lbl">streak</span></div><div class="today-stat-sep"></div><div class="today-stat"><span class="today-stat-val">${workoutsThisWeek}</span><span class="today-stat-lbl">this week</span></div><div class="today-stat-sep"></div><div class="today-stat"><span class="today-stat-val">${totalWorkouts}</span><span class="today-stat-lbl">total</span></div></div>`;
  html += renderSeasonPhase();
  html += renderGoals();
  const earned = getEarnedBadges();
  if (earned.length > 0 || userWorkouts.length > 0) {
    html += `<div style="margin-top:8px"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">Badges · ${earned.length}/${BADGES.length}</div>`;
    html += renderBadges();
    html += '</div>';
  }
  if (totalWorkouts > 0) {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const wStart2 = new Date(now); wStart2.setDate(now.getDate() - now.getDay() - (i * 7)); wStart2.setHours(0,0,0,0);
      const wEnd = new Date(wStart2); wEnd.setDate(wEnd.getDate() + 7);
      const count = userWorkouts.filter(w => { const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null; return d && d >= wStart2 && d < wEnd; }).length;
      weeks.push({ count, label: wStart2.getDate() + '/' + (wStart2.getMonth()+1), isCurrent: i === 0 });
    }
    const maxCount = Math.max(...weeks.map(w => w.count), 1);
    html += `<div style="margin-top:8px"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">Weekly Activity</div>
    <div class="chart-row">${weeks.map(w => `<div class="chart-col"><div class="chart-bar-wrap"><div class="chart-bar-val">${w.count || ''}</div><div class="chart-bar${w.isCurrent ? ' current' : ''}" style="height:${maxCount > 0 ? Math.max(2, (w.count / maxCount) * 80) : 2}px;background:${w.isCurrent ? 'var(--primary)' : 'var(--muted)'}"></div></div><div class="chart-label">${w.label}</div></div>`).join('')}</div></div>`;
  }
  html += renderWorkoutCalendar(now);
  html += renderTeamFeed();
  html += '</div></div>';
  c.innerHTML = html;
  // Bind duration picker
  document.querySelectorAll('.dur-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic('light');
      const dur = btn.dataset.dur;
      localStorage.setItem('vf_session_duration', dur);
      renderCurrentPage();
    });
  });
  // Bind "More Stats" toggle
  const moreToggle = $('extras-toggle');
  if (moreToggle) {
    moreToggle.addEventListener('click', () => {
      const body = $('extras-body');
      const chevron = moreToggle.querySelector('span');
      if (!body) return;
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      if (chevron) chevron.style.transform = 'rotate(' + (isOpen ? '-90' : '0') + 'deg)';
      localStorage.setItem('vf_extras_open', isOpen ? 'false' : 'true');
    });
  }
  // Bind calendar collapse toggle
  const calToggle = $('cal-toggle');
  if (calToggle) {
    calToggle.addEventListener('click', () => {
      const body = $('cal-body');
      const chevron = calToggle.querySelector('span');
      if (!body) return;
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      if (chevron) chevron.style.transform = 'rotate(' + (isOpen ? '-90' : '0') + 'deg)';
      localStorage.setItem('vf_cal_open', isOpen ? 'false' : 'true');
    });
  }
  // Bind calendar navigation
  c.querySelectorAll('.cal-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.calDir);
      calViewMonth += dir;
      if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      renderToday();
    });
  });
  // Bind calendar day clicks
  c.querySelectorAll('.cal-day.has-workout').forEach(el => {
    el.addEventListener('click', () => {
      const dateKey = el.dataset.dateKey;
      const detail = $('cal-detail');
      if (detail && detail.dataset.showing === dateKey) {
        detail.style.display = 'none';
        detail.innerHTML = '';
        detail.dataset.showing = '';
        return;
      }
      const dayWorkouts = userWorkouts.filter(w => {
        const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
        if (!d) return false;
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') === dateKey;
      });
      if (detail && dayWorkouts.length > 0) {
        detail.dataset.showing = dateKey;
        detail.style.display = '';
        detail.innerHTML = '<h4>' + dateKey + '</h4>' + dayWorkouts.map(w =>
          '<div class="cal-workout-item">' + escHtml(w.name || 'Workout') + ' · ' + (w.duration || '?') + 'min' + (w.rpe ? ' · RPE ' + w.rpe : '') + '</div>'
        ).join('');
      }
    });
  });
  // Bind goal delete buttons
  c.querySelectorAll('.goal-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.goalDel);
      userGoals.splice(idx, 1);
      saveGoals();
      renderToday();
    });
  });
  // Bind goal add button
  const goalAddBtn = $('goal-add-btn');
  if (goalAddBtn) {
    goalAddBtn.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99;display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.innerHTML = `<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;width:100%;max-width:320px">
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px">Set a Goal</div>
        <select id="goal-type-sel" class="input" style="margin-bottom:8px;width:100%">
          <option value="workouts">Total Workouts</option>
          <option value="streak">Day Streak</option>
          <option value="minutes">Total Minutes</option>
        </select>
        <input id="goal-target-inp" class="input" type="number" placeholder="Target number" style="margin-bottom:8px;width:100%">
        <input id="goal-label-inp" class="input" type="text" placeholder="Label (e.g. &quot;20 workouts this term&quot;)" style="margin-bottom:12px;width:100%">
        <div style="display:flex;gap:8px">
          <button id="goal-cancel" class="btn" style="flex:1;background:var(--surface-alt);color:var(--muted-fg)">Cancel</button>
          <button id="goal-save" class="btn btn-primary" style="flex:1">Save Goal</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      $('goal-cancel').addEventListener('click', () => overlay.remove());
      $('goal-save').addEventListener('click', () => {
        const type = $('goal-type-sel').value;
        const target = parseInt($('goal-target-inp').value);
        const label = $('goal-label-inp').value.trim();
        if (!target || target <= 0) { showToast('Enter a target number.', 'warn'); return; }
        userGoals.push({ id: Date.now().toString(), type, target, label: label || (target + ' ' + type), createdAt: new Date().toISOString() });
        saveGoals();
        overlay.remove();
        renderToday();
        showToast('Goal set!', 'success');
      });
    });
  }
  // Bind plan recommendation button
  const recBtn = c.querySelector('[data-rec-plan]');
  if (recBtn) {
    recBtn.addEventListener('click', async () => {
      const planId = recBtn.dataset.recPlan;
      haptic('medium');
      await activatePlan(planId);
    });
  }
  // Bind checklist toggles
  c.querySelectorAll('.cl-check').forEach(el => {
    el.addEventListener('click', () => toggleChecklist(el.dataset.key));
  });
  // Bind timer buttons
  c.querySelectorAll('.cl-timer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      const name = btn.dataset.timerName;
      const dur = parseInt(btn.dataset.timerDur) || 30;
      let exercises = [];
      try { exercises = JSON.parse(btn.dataset.timerExercises || '[]'); } catch(e) {}
      openWorkoutTimer(name, dur, exercises);
    });
  });
  // Exercise tracker — tap workout card to open set counter
  c.querySelectorAll('.cl-info-tap').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.cl-timer-btn')) return;
      haptic('light');
      let desc = el.dataset.workoutDesc || '';
      const isScaled = el.dataset.workoutScaled === '1';
      const origDur = parseInt(el.dataset.workoutOrigDur) || 30;
      const dur = parseInt(el.dataset.workoutDur) || 30;
      if (isScaled) {
        const ratio = dur / origDur;
        const scaleNote = ratio <= 0.4
          ? `⏱ ${dur}-minute version: Do the warm-up (3 min), pick 2-3 key exercises, skip cool-down intervals. Focus on quality over quantity.`
          : ratio <= 0.6
          ? `⏱ ${dur}-minute version: Shorten warm-up to 5 min, reduce sets by half, keep rest periods short (30s). Skip the last exercise if time is tight.`
          : `⏱ ${dur}-minute version: Reduce warm-up/cool-down by 5 min each, do 2 fewer sets per exercise. Same intensity, less volume.`;
        desc = scaleNote + '\n\n' + desc;
      }
      openExerciseTracker(el.dataset.workoutKey, el.dataset.workoutName, desc, dur, el.dataset.workoutExercises);
    });
  });
  // Quick Log + Record GPS buttons
  $('today-quick-log')?.addEventListener('click', () => { haptic('light'); openWorkoutSheet(); });
  // Onboarding — auto-pick best plan for user's year/tier
  $('onboard-pick-plan')?.addEventListener('click', () => {
    haptic('medium');
    const year = userProfile?.yearLevel || 'Y9';
    const tier = userProfile?.fitnessLevel || 'basic';
    // Find matching plan — prefer floor (bodyweight, no equipment needed)
    const match = ALL_PLANS.find(p => p.yearLevel === year && p.fitnessLevel === tier && p.category === 'floor')
      || ALL_PLANS.find(p => p.yearLevel === year && p.fitnessLevel === tier)
      || ALL_PLANS[0];
    if (match) {
      activatePlan(match.id);
      showToast('Plan activated! Check your training for today.', 'success');
      setTimeout(() => renderToday(), 300);
    } else {
      switchPage('fitness');
      fitnessSubTab = 'plans';
      renderFitness();
    }
  });
  // Dismiss weekly summary
  $('dismiss-weekly')?.addEventListener('click', () => {
    const ws = new Date(); ws.setDate(ws.getDate() - ws.getDay() + 1); ws.setHours(0,0,0,0);
    localStorage.setItem('vf_summary_week', ws.toISOString().split('T')[0]);
    $('dismiss-weekly')?.closest('div[style]')?.remove();
  });
  // Widget customization
  $('today-customize')?.addEventListener('click', () => {
    haptic('light');
    const widgets = [
      { id: 'weather', icon: '🌤️', label: 'Weather', desc: 'Local conditions and training advice' },
      { id: 'health', icon: '❤️', label: 'Health Data', desc: 'Heart rate, steps, sleep from wearables' },
      { id: 'engagement', icon: '🔥', label: 'XP & Streaks', desc: '2x XP badge and streak freezes' },
      { id: 'training', icon: '📅', label: 'Training Sessions', desc: 'Upcoming sessions with calendar add' },
      { id: 'challenge', icon: '🏆', label: 'Team Challenge', desc: 'Monthly leaderboard' },
      { id: 'weekly', icon: '📊', label: 'Weekly Summary', desc: 'Last week stats and goals' },
      { id: 'quickActions', icon: '⚡', label: 'Quick Actions', desc: 'Log and Record GPS buttons' }
    ];
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem('vf_widgets') || '{}'); } catch(e) {}
    const isOn = (id) => stored[id] !== false;
    let sheetHtml = '<div class="sheet-title">Customize Today Page</div>';
    sheetHtml += '<div style="font-size:12px;color:var(--muted-fg);margin-bottom:12px">Toggle widgets on or off. Your layout is saved automatically.</div>';
    widgets.forEach(w => {
      sheetHtml += `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:20px;width:28px;text-align:center">${w.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${w.label}</div>
          <div style="font-size:11px;color:var(--muted-fg)">${w.desc}</div>
        </div>
        <div class="theme-toggle${isOn(w.id) ? ' on' : ''}" data-widget-id="${w.id}" style="cursor:pointer">
          <div class="theme-toggle-knob"></div>
        </div>
      </div>`;
    });
    sheetHtml += '<button class="btn btn-primary" id="widgets-done" style="width:100%;margin-top:12px;padding:10px">Done</button>';
    $('sheet-content').innerHTML = sheetHtml;
    openSheet();
    document.querySelectorAll('[data-widget-id]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const id = toggle.dataset.widgetId;
        const current = stored[id] !== false;
        stored[id] = !current;
        toggle.classList.toggle('on', !current);
        try { localStorage.setItem('vf_widgets', JSON.stringify(stored)); } catch(e) {}
      });
    });
    $('widgets-done')?.addEventListener('click', () => { closeSheet(); renderToday(); loadWeather(); });
  });
  $('today-quick-record')?.addEventListener('click', () => { haptic('medium'); openActivityTracker(); });
  $('today-strava-connect')?.addEventListener('click', () => { stravaStartAuth(); });
  // Dismiss daily roundup
  $('dismiss-roundup')?.addEventListener('click', () => {
    localStorage.setItem('vf_roundup_' + new Date().toISOString().split('T')[0], '1');
    $('dismiss-roundup')?.closest('div[style*="background:linear-gradient"]')?.remove();
  });
  // Health card → open detailed dashboard
  $('health-card-tap')?.addEventListener('click', () => {
    haptic('light');
    openHealthDashboard();
  });
  // Add to Calendar buttons
  document.querySelectorAll('.add-to-cal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.sessionIdx || '0');
      const todayStr4 = new Date().toISOString().split('T')[0];
      const upcoming = trainingSessions.filter(s => s.date >= todayStr4).sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
      const session = upcoming[idx];
      if (!session) return;
      addSessionToCalendar(session);
    });
  });
  // Social reaction buttons on team feed
  c.querySelectorAll('.feed-react-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.reactKey;
      const emoji = btn.dataset.emoji;
      let current = '';
      try { current = localStorage.getItem(key) || ''; } catch(e) {}
      if (current === emoji) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, emoji);
      }
      haptic('light');
      renderToday();
    });
  });
  // Render today's route map
  if (typeof L !== 'undefined') {
    const todayMapEl = $('today-route-map');
    if (todayMapEl) {
      const rid = todayMapEl.dataset.routeId;
      const route = storedRoutes[rid];
      if (route && route.length > 1) {
        setTimeout(() => {
          try {
            const m = L.map(todayMapEl.id, { zoomControl:false, attributionControl:false, dragging:false, touchZoom:false, scrollWheelZoom:false, doubleClickZoom:false });
            L.tileLayer(getMapTileUrl(), { maxZoom:18 }).addTo(m);
            const ll = route.map(p => [p[0],p[1]]);
            const pl = L.polyline(ll, { color:'#BFFF00', weight:3, opacity:0.9 }).addTo(m);
            L.circleMarker(ll[0], { radius:5, fillColor:'#22c55e', fillOpacity:1, color:'#fff', weight:2 }).addTo(m);
            L.circleMarker(ll[ll.length-1], { radius:5, fillColor:'#ef4444', fillOpacity:1, color:'#fff', weight:2 }).addTo(m);
            m.fitBounds(pl.getBounds(), { padding:[10,10] });
          } catch(e) {}
        }, 100);
      }
    }
  }
}
function renderChecklistItem(workout, key, isChecked) {
  const intensityClass = 'intensity-' + workout.intensity;
  const shortDesc = workout.description && workout.description.length > 120 ? workout.description.substring(0, 120).trim() + '...' : (workout.description || '');
  const hasExercises = workout.exercises && workout.exercises.length > 0;
  const exerciseData = hasExercises ? JSON.stringify(workout.exercises).replace(/'/g,"&#39;").replace(/"/g,"&quot;") : '';
  // Load set progress for all plan types
  let setsDone = 0, setsTotal = 0;
  try {
    const prog = JSON.parse(localStorage.getItem('vf_sets_' + key) || '{}');
    setsDone = Object.values(prog).reduce((s, v) => s + v, 0);
    setsTotal = parseInt(localStorage.getItem('vf_sets_total_' + key)) || 0;
  } catch(e) {}
  if (hasExercises && setsTotal === 0) {
    setsTotal = workout.exercises.reduce((s, ex) => s + (ex.sets || 1), 0);
  }
  const progressText = setsTotal > 0 ? `<span style="font-size:10px;color:${setsDone >= setsTotal ? 'var(--primary)' : 'var(--muted-fg)'};margin-left:4px">${setsDone}/${setsTotal}</span>` : '';
  return `
    <div class="checklist-item${isChecked?' checked':''}">
      <div class="cl-check" data-key="${key}">
        <div class="cl-box${isChecked?' done':''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div class="cl-info cl-info-tap" data-workout-key="${key}" data-workout-name="${escHtml(workout.name)}" data-workout-desc="${escHtml(workout.description || '')}" data-workout-dur="${workout.duration || 30}" data-workout-scaled="${workout.scaled ? '1' : '0'}" data-workout-orig-dur="${workout.originalDuration || workout.duration || 30}" data-workout-exercises="${exerciseData}" style="cursor:pointer">
        <div class="cl-title">${workout.name} <span class="intensity-dot ${intensityClass}"></span>${progressText}</div>
        ${shortDesc ? '<div class="cl-desc">' + escHtml(shortDesc) + '</div>' : ''}
        <div class="cl-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${workout.duration} min${workout.scaled ? ' <span style="font-size:9px;color:var(--primary)">(of ' + workout.originalDuration + ')</span>' : ''} · Week ${workout.week}
          <button class="cl-timer-btn" data-timer-name="${escHtml(workout.name)}" data-timer-dur="${workout.duration || 30}" data-timer-exercises='${workout.exercises ? JSON.stringify(workout.exercises).replace(/'/g,"&#39;") : "[]"}'>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Timer
          </button>
        </div>
      </div>
    </div>
  `;
}
// Parse exercises from workout description text (floor & invehicle plans)
function parseExercisesFromDesc(desc, name, duration) {
  if (!desc) return [{ name: name, sets: 1, reps: null, duration: duration + ' min', notes: '' }];
  const exercises = [];
  const seen = new Set();
  const skipWords = /^(minute|min|second|sec|rep|set|round|effort|interval|easy|moderate|hard|light|the|your|a|an|and|then|for|of|with|at|between|rest|after|cool|warm|before|more|each)s?$/i;
  const restWords = /between\s+rounds|rest\s+for|cool.?down|warm.?up|easy\s+spin|relaxed|recover/i;
  // FIRST: Check for interval patterns (invehicle) "4 x 2-minute efforts"
  const intervalMatches = [...desc.matchAll(/(\d+)\s*x\s*(\d+)[-\s]*(?:minute|min|m)[a-z]*\s*([\w\s'-]*?)(?:\s*[-–—]\s*|[,;.]|where|at|with|$)/gi)];
  if (intervalMatches.length > 0) {
    intervalMatches.forEach(m => {
      let eName = (m[3] || '').trim().replace(/\s*(where|at|with|pushing|you|we|focus|think|about).*$/i, '').trim();
      if (!eName || eName.length < 2 || /^(effort|interval)s?$/i.test(eName)) eName = 'Interval';
      eName = eName.replace(/\b\w/g, c => c.toUpperCase());
      exercises.push({ name: eName, sets: parseInt(m[1]), reps: null, duration: m[2] + ' min', notes: '' });
    });
    // Also add steady segments
    const steadyMatches = [...desc.matchAll(/(?:ride|spin|pedal|row|hold)\s+(?:continuously\s+)?(?:for\s+)?(\d+)\s*(?:minute|min)/gi)];
    steadyMatches.forEach(m => {
      const verb = m[0].match(/^(\w+)/i)[1];
      exercises.push({ name: verb.charAt(0).toUpperCase() + verb.slice(1) + ' Steady', sets: 1, reps: null, duration: m[1] + ' min', notes: '' });
    });
    if (exercises.length > 0) return exercises;
  }
  // SECOND: Check for "rounds of" structured exercises (floor plans)
  const roundMatch = desc.match(/(\d+)\s*(?:rounds?|circuits?|times)\s*(?:of|:)/i);
  const globalSets = roundMatch ? parseInt(roundMatch[1]) : 1;
  const lines = desc.split(/[.;!]\s*/);
  lines.forEach(line => {
    if (restWords.test(line) && !/push|squat|plank|lunge|bridge|dead bug|bird dog|superman|crunch|burpee|v-up|hollow|clamshell|fire hydrant|calf raise|step.?up|wall sit|tuck jump|box jump/i.test(line)) return;
    // Pattern 1: "X-second/minute ExerciseName" → duration exercise (e.g. "30-second Plank Hold")
    const durMatches = [...line.matchAll(/(\d+)[-\s]*(?:second|sec)\s+(?:of\s+)?([\w\s'-]{3,30}?)(?:\s+each\s+\w+)?(?:\s*\(|[,;]|$)/gi)];
    durMatches.forEach(m => {
      let exName = m[2].trim().replace(/\s+/g, ' ');
      if (skipWords.test(exName) || restWords.test(exName) || exName.length < 3) return;
      exName = exName.replace(/\b\w/g, c => c.toUpperCase());
      if (seen.has(exName.toLowerCase())) return;
      seen.add(exName.toLowerCase());
      exercises.push({ name: exName, sets: globalSets, reps: null, duration: m[1] + ' sec', notes: '' });
    });
    const minMatches = [...line.matchAll(/(\d+)[-\s]*(?:minute|min)\s+(?:of\s+)?([\w\s'-]{3,30}?)(?:\s+each\s+\w+)?(?:\s*\(|[,;]|$)/gi)];
    minMatches.forEach(m => {
      let exName = m[2].trim().replace(/\s+/g, ' ');
      if (skipWords.test(exName) || restWords.test(exName) || exName.length < 3) return;
      exName = exName.replace(/\b\w/g, c => c.toUpperCase());
      if (seen.has(exName.toLowerCase())) return;
      seen.add(exName.toLowerCase());
      exercises.push({ name: exName, sets: globalSets, reps: null, duration: m[1] + ' min', notes: '' });
    });
    // Pattern 1b: "X seconds/minutes of Y" → duration (e.g. "10 seconds of Wall Sit")
    const ofMatches = [...line.matchAll(/(\d+)\s*[-\s]*(?:second|sec|minute|min)s?\s+of\s+([\w\s'-]{3,30}?)(?:\s+each\s+\w+)?(?:\s*\(|[,;]|$)/gi)];
    ofMatches.forEach(m => {
      let exName = m[2].trim().replace(/\s+/g, ' ');
      if (skipWords.test(exName) || restWords.test(exName) || exName.length < 3) return;
      exName = exName.replace(/\b\w/g, c => c.toUpperCase());
      if (seen.has(exName.toLowerCase())) return;
      seen.add(exName.toLowerCase());
      const isMin = /minute|min/i.test(m[0]);
      exercises.push({ name: exName, sets: globalSets, reps: null, duration: m[1] + (isMin ? ' min' : ' sec'), notes: '' });
    });
    // Pattern 2: "NUMBER ExerciseName" → rep exercise (e.g. "10 Push Ups", "15 Bodyweight Squats")
    const repMatches = [...line.matchAll(/(\d+)\s+([\w\s'-]{3,30}?)(?:\s+each\s+(?:leg|side|arm))?(?:\s*\(|[,;]|$)/gi)];
    repMatches.forEach(m => {
      let reps = parseInt(m[1]);
      let exName = m[2].trim().replace(/\s+/g, ' ');
      // Skip if already captured as duration exercise
      if (seen.has(exName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).toLowerCase())) return;
      if (skipWords.test(exName) || restWords.test(exName) || exName.length < 3 || reps > 200) return;
      // Skip if this looks like a time reference or "seconds of" pattern
      if (/^(minutes?|mins?|seconds?|secs?|hours?|rpm|reps?|repetitions?)$/i.test(exName)) return;
      if (/^(second|sec|minute|min)s?\s+of\s/i.test(exName)) return;
      exName = exName.replace(/\b\w/g, c => c.toUpperCase());
      if (seen.has(exName.toLowerCase())) return;
      seen.add(exName.toLowerCase());
      exercises.push({ name: exName, sets: globalSets, reps: reps, duration: null, notes: '' });
    });
  });
  // Fallback: single workout step
  if (exercises.length === 0) {
    exercises.push({ name: name, sets: 1, reps: null, duration: duration + ' min', notes: desc.length > 200 ? desc.substring(0, 200) + '...' : desc });
  }
  return exercises;
}
// Exercise Tracker Overlay — set counter for daily workouts
function openExerciseTracker(key, name, desc, duration, exercisesJson) {
  let exercises = [];
  try { exercises = JSON.parse(exercisesJson || '[]'); } catch(e) {}
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem('vf_sets_' + key) || '{}'); } catch(e) {}
  if (exercises.length === 0) exercises = parseExercisesFromDesc(desc, name, duration);
  const totalSets = exercises.reduce((s, ex) => s + (ex.sets || 1), 0);
  try { localStorage.setItem('vf_sets_total_' + key, String(totalSets)); } catch(e) {}
  let restTimerInterval = null;
  let restSeconds = 0;
  let liveMode = false;
  let liveExIdx = 0;
  const ov = document.createElement('div');
  ov.id = 'exercise-tracker-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:201;background:var(--bg);display:flex;flex-direction:column;overflow:hidden';

  function startRestTimer(secs) {
    if (restTimerInterval) clearInterval(restTimerInterval);
    restSeconds = secs || 60;
    renderTracker();
    restTimerInterval = setInterval(() => {
      restSeconds--;
      const el = ov.querySelector('#rest-timer-display');
      if (el) el.textContent = restSeconds + 's';
      const bar = ov.querySelector('#rest-timer-bar');
      if (bar) bar.style.width = (restSeconds / (secs || 60) * 100) + '%';
      if (restSeconds <= 0) {
        clearInterval(restTimerInterval);
        restTimerInterval = null;
        haptic('success');
        renderTracker();
      }
    }, 1000);
  }

  function renderTracker() {
    const totalS = exercises.reduce((s, ex) => s + (ex.sets || 1), 0);
    const doneS = Object.values(progress).reduce((s, v) => s + v, 0);
    const pct = totalS > 0 ? Math.round((doneS / totalS) * 100) : 0;
    const allDone = doneS >= totalS;
    if (liveMode) { renderLiveMode(); return; }
    let html = `<div style="display:flex;align-items:center;padding:12px 16px;padding-top:calc(12px + var(--safe-t));border-bottom:1px solid var(--border);flex-shrink:0">
      <button id="et-back" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;padding:4px 8px 4px 0">\u2190</button>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}</div>
        <div style="font-size:11px;color:var(--muted-fg)">${doneS}/${totalS} sets \u00b7 ${pct}%</div>
      </div>
      <button id="et-live-btn" style="font-size:11px;font-weight:700;padding:6px 12px;border-radius:8px;border:1.5px solid var(--primary);background:rgba(191,255,0,.1);color:var(--primary);cursor:pointer">\u25b6 Live Mode</button>
    </div>
    <div style="height:3px;background:var(--muted)"><div style="height:100%;width:${pct}%;background:var(--primary);border-radius:0 2px 2px 0;transition:width .3s"></div></div>`;
    if (restTimerInterval && restSeconds > 0) {
      html += `<div style="padding:12px 16px;background:rgba(59,130,246,.08);border-bottom:1px solid rgba(59,130,246,.15);text-align:center">
        <div style="font-size:11px;font-weight:600;color:#3b82f6;margin-bottom:4px">REST</div>
        <div id="rest-timer-display" style="font-size:32px;font-weight:800;color:var(--text)">${restSeconds}s</div>
        <div style="height:3px;background:rgba(59,130,246,.15);border-radius:99px;margin-top:6px"><div id="rest-timer-bar" style="height:100%;width:${(restSeconds/60)*100}%;background:#3b82f6;border-radius:99px;transition:width 1s linear"></div></div>
        <button id="skip-rest" style="margin-top:6px;font-size:11px;color:var(--muted-fg);background:none;border:none;cursor:pointer">Skip \u2192</button>
      </div>`;
    }
    html += `<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px;padding-bottom:calc(16px + var(--safe-b))">`;
    exercises.forEach((ex, i) => {
      const setsTarget = ex.sets || 1;
      const setsCompleted = progress[i] || 0;
      const exDone = setsCompleted >= setsTarget;
      const repInfo = ex.reps ? ex.reps + ' reps' : ex.duration || '';
      const resistInfo = ex.resistance ? ' \u00b7 ' + ex.resistance : '';
      html += `<div class="card" style="margin-bottom:8px;${exDone ? 'opacity:.5' : ''}">
        <div style="padding:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${ex.notes ? '4' : '6'}px">
            <div style="font-weight:700;font-size:14px;color:var(--text);flex:1;min-width:0">${exDone ? '<span style="color:var(--primary)">\u2713</span> ' : ''}${escHtml(ex.name)}</div>
            <div style="font-size:11px;color:var(--muted-fg);white-space:nowrap;margin-left:8px">${repInfo}${resistInfo}</div>
          </div>
          ${ex.notes ? '<div style="font-size:12px;color:var(--muted-fg);line-height:1.4;margin-bottom:6px">' + escHtml(ex.notes) + '</div>' : ''}
          <div style="display:flex;align-items:center;gap:6px">
            <div style="display:flex;gap:4px;flex:1;flex-wrap:wrap">`;
      for (let s = 0; s < setsTarget; s++) {
        const setDone = s < setsCompleted;
        html += `<button class="et-set-btn" data-ex="${i}" data-set="${s}" style="min-width:36px;height:36px;border-radius:8px;border:2px solid ${setDone ? 'var(--primary)' : 'var(--border)'};background:${setDone ? 'var(--primary)' : 'var(--card)'};color:${setDone ? 'var(--primary-fg)' : 'var(--muted-fg)'};font-weight:700;font-size:13px;cursor:pointer;transition:all .15s;padding:0 6px">${setsTarget === 1 ? '\u2713' : s + 1}</button>`;
      }
      html += `</div>
            <button class="et-rest-btn" data-ex="${i}" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--muted-fg);font-size:10px;cursor:pointer;padding:4px 8px;white-space:nowrap">\u23f1 Rest</button>
            <button class="et-reset-btn" data-ex="${i}" style="background:none;border:none;color:var(--muted-fg);font-size:16px;cursor:pointer;padding:4px 2px">\u21ba</button>
          </div>
        </div>
      </div>`;
    });
    html += `<div style="display:flex;gap:8px;margin-top:8px">
      <button id="et-reset-all" class="btn btn-secondary" style="flex:1;padding:12px;font-size:13px">Reset All</button>
      <button id="et-complete" class="btn ${allDone ? 'btn-primary' : 'btn-secondary'}" style="flex:2;padding:12px;font-size:14px;font-weight:700">${allDone ? '\u2713 Mark Complete' : 'Mark Complete'}</button>
    </div></div>`;
    ov.innerHTML = html;
    bindTrackerEvents();
  }

  function renderLiveMode() {
    const ex = exercises[liveExIdx];
    if (!ex) { liveMode = false; renderTracker(); return; }
    const setsTarget = ex.sets || 1;
    const setsCompleted = progress[liveExIdx] || 0;
    const exDone = setsCompleted >= setsTarget;
    const repInfo = ex.reps ? ex.reps + ' reps' : ex.duration || '';
    const nextEx = exercises[liveExIdx + 1];
    const totalDone = Object.values(progress).reduce((s, v) => s + v, 0);
    const totalS2 = exercises.reduce((s, ex2) => s + (ex2.sets || 1), 0);
    let html = `<div style="display:flex;align-items:center;padding:12px 16px;padding-top:calc(12px + var(--safe-t));border-bottom:1px solid var(--border);flex-shrink:0">
      <button id="et-exit-live" style="background:none;border:none;color:var(--text);font-size:20px;cursor:pointer;padding:4px 8px 4px 0">\u2190</button>
      <div style="flex:1;font-size:12px;color:var(--muted-fg)">${liveExIdx + 1} of ${exercises.length}</div>
      <div style="font-size:12px;font-weight:700;color:var(--primary)">${totalDone}/${totalS2} sets</div>
    </div>
    <div style="height:3px;background:var(--muted)"><div style="height:100%;width:${(totalDone/totalS2)*100}%;background:var(--primary);transition:width .3s"></div></div>`;
    if (restTimerInterval && restSeconds > 0) {
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px">
        <div style="font-size:14px;font-weight:600;color:#3b82f6;margin-bottom:8px">REST</div>
        <div id="rest-timer-display" style="font-size:72px;font-weight:800;color:var(--text)">${restSeconds}s</div>
        <div style="width:200px;height:4px;background:rgba(59,130,246,.15);border-radius:99px;margin:16px 0"><div id="rest-timer-bar" style="height:100%;width:${(restSeconds/60)*100}%;background:#3b82f6;border-radius:99px;transition:width 1s linear"></div></div>
        ${nextEx ? '<div style="font-size:13px;color:var(--muted-fg)">Next: ' + escHtml(nextEx.name) + '</div>' : ''}
        <button id="skip-rest" style="margin-top:16px;padding:10px 24px;font-size:13px;font-weight:600;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer">Skip Rest \u2192</button>
      </div>`;
    } else {
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">${exDone ? '\u2705' : '\ud83c\udfcb\ufe0f'}</div>
        <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(ex.name)}</div>
        <div style="font-size:16px;color:var(--muted-fg);margin-bottom:4px">${repInfo}${ex.resistance ? ' \u00b7 ' + ex.resistance : ''}</div>
        ${ex.notes ? '<div style="font-size:13px;color:var(--muted-fg);line-height:1.5;margin-bottom:12px;max-width:300px">' + escHtml(ex.notes) + '</div>' : ''}
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px">Set ${Math.min(setsCompleted + 1, setsTarget)} of ${setsTarget}</div>
        <div style="display:flex;gap:6px;margin-bottom:20px">`;
      for (let s = 0; s < setsTarget; s++) {
        const done = s < setsCompleted;
        html += `<div style="width:12px;height:12px;border-radius:50%;background:${done ? 'var(--primary)' : 'var(--border)'}"></div>`;
      }
      html += `</div>
        ${exDone ? `<button id="live-next" class="btn btn-primary" style="padding:14px 40px;font-size:16px;font-weight:700;border-radius:12px">${liveExIdx < exercises.length - 1 ? 'Next Exercise \u2192' : '\u2713 Finish Workout'}</button>`
        : `<button id="live-done-set" class="btn btn-primary" style="padding:14px 40px;font-size:16px;font-weight:700;border-radius:12px;min-width:180px">Done \u2713</button>`}
      </div>`;
    }
    ov.innerHTML = html;
    ov.querySelector('#et-exit-live')?.addEventListener('click', () => { liveMode = false; if (restTimerInterval) { clearInterval(restTimerInterval); restTimerInterval = null; } renderTracker(); });
    ov.querySelector('#skip-rest')?.addEventListener('click', () => { if (restTimerInterval) { clearInterval(restTimerInterval); restTimerInterval = null; } restSeconds = 0; renderTracker(); });
    ov.querySelector('#live-done-set')?.addEventListener('click', () => {
      haptic('medium');
      progress[liveExIdx] = (progress[liveExIdx] || 0) + 1;
      try { localStorage.setItem('vf_sets_' + key, JSON.stringify(progress)); } catch(e) {}
      const newDone = progress[liveExIdx] || 0;
      const target = exercises[liveExIdx]?.sets || 1;
      if (newDone >= target) {
        if (liveExIdx < exercises.length - 1) startRestTimer(60);
        renderTracker();
      } else {
        startRestTimer(45);
      }
    });
    ov.querySelector('#live-next')?.addEventListener('click', () => {
      if (liveExIdx < exercises.length - 1) {
        liveExIdx++;
        renderTracker();
      } else {
        liveMode = false;
        haptic('success');
        toggleChecklist(key);
        ov.remove();
        showToast('Workout complete! \ud83d\udcaa', 'success');
      }
    });
  }

  function bindTrackerEvents() {
    ov.querySelector('#et-back')?.addEventListener('click', () => { if (restTimerInterval) clearInterval(restTimerInterval); ov.remove(); renderToday(); });
    ov.querySelector('#et-live-btn')?.addEventListener('click', () => {
      liveMode = true;
      liveExIdx = exercises.findIndex((ex, i) => (progress[i] || 0) < (ex.sets || 1));
      if (liveExIdx < 0) liveExIdx = 0;
      haptic('medium');
      renderTracker();
    });
    ov.querySelector('#skip-rest')?.addEventListener('click', () => {
      if (restTimerInterval) { clearInterval(restTimerInterval); restTimerInterval = null; }
      restSeconds = 0;
      renderTracker();
    });
    ov.querySelectorAll('.et-set-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        haptic('light');
        const exIdx = parseInt(btn.dataset.ex);
        const setIdx = parseInt(btn.dataset.set);
        const current = progress[exIdx] || 0;
        if (setIdx < current) {
          progress[exIdx] = setIdx;
        } else {
          progress[exIdx] = setIdx + 1;
          const target = exercises[exIdx]?.sets || 1;
          if (progress[exIdx] < target) startRestTimer(45);
          else if (progress[exIdx] >= target) startRestTimer(60);
        }
        try { localStorage.setItem('vf_sets_' + key, JSON.stringify(progress)); } catch(e) {}
        renderTracker();
      });
    });
    ov.querySelectorAll('.et-rest-btn').forEach(btn => {
      btn.addEventListener('click', () => { haptic('light'); startRestTimer(60); });
    });
    ov.querySelectorAll('.et-reset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        progress[parseInt(btn.dataset.ex)] = 0;
        try { localStorage.setItem('vf_sets_' + key, JSON.stringify(progress)); } catch(e) {}
        renderTracker();
      });
    });
    ov.querySelector('#et-reset-all')?.addEventListener('click', () => {
      progress = {};
      try { localStorage.setItem('vf_sets_' + key, JSON.stringify(progress)); } catch(e) {}
      haptic('light');
      renderTracker();
    });
    ov.querySelector('#et-complete')?.addEventListener('click', () => {
      haptic('medium');
      if (restTimerInterval) clearInterval(restTimerInterval);
      toggleChecklist(key);
      ov.remove();
      showToast('Workout complete! \ud83d\udcaa', 'success');
    });
  }
  document.body.appendChild(ov);
  renderTracker();
}
// Activate a training plan by ID
async function activatePlan(planId) {
  if (demoMode) {
    userProfile.activePlanId = planId;
    renderToday();
    return;
  }
  if (db && currentUser) {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { activePlanId: planId });
      userProfile.activePlanId = planId;
      showToast('Plan activated!', 'success');
      renderToday();
    } catch(e) { showError('Failed to activate plan', 'plan', e, { action: 'activate' }); }
  }
}
async function toggleChecklist(key) {
  if (!currentUser) return;
  const newVal = !userChecklist[key];
  userChecklist[key] = newVal;
  renderToday();
  // Check if all workouts for the current plan week are done → celebrate
  if (newVal && activePlan) {
    try {
      const now = new Date();
      const dayMap = {'Mon':1,'Tue':2,'Wed':3,'Thu':4,'Fri':5,'Sat':6,'Sun':0};
      // Find current week number based on plan start
      const planStartKey = 'vf_plan_start_' + activePlanId;
      let planStart = localStorage.getItem(planStartKey);
      if (!planStart) { planStart = now.toISOString(); localStorage.setItem(planStartKey, planStart); }
      const weeksSinceStart = Math.floor((now - new Date(planStart)) / (7 * 86400000)) + 1;
      const currentWeek = Math.min(weeksSinceStart, activePlan.durationWeeks || 8);
      const weekWorkouts = activePlan.workouts.filter(w => w.week === currentWeek);
      if (weekWorkouts.length > 0) {
        const allDone = weekWorkouts.every((w, i) => {
          const k = activePlanId + '-' + w.week + '-' + w.day + '-' + (weekWorkouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
          return userChecklist[k];
        });
        if (allDone) showCelebration('Week ' + currentWeek + ' complete! 🎉');
      }
      // Check if ENTIRE plan is done
      const totalItems = activePlan.workouts.length;
      let doneCount = 0;
      activePlan.workouts.forEach((w, i) => {
        const k2 = activePlanId + '-' + w.week + '-' + w.day + '-' + (activePlan.workouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
        if (userChecklist[k2]) doneCount++;
      });
      if (doneCount === totalItems && totalItems > 0) showCelebration('Plan complete! You crushed it! 🏆');
    } catch(e) {}
  }
  if (demoMode || !db) return;
  try {
    const today = new Date();
    const dateKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const ref = doc(db, 'users', currentUser.uid, 'checklist', dateKey);
    await setDoc(ref, { items: { [key]: newVal } }, { merge: true });
  } catch(e) {
    console.error('Checklist save error:', e);
  }
}
// Celebration animation
function showCelebration(message) {
  haptic('success');
  showToast(message, 'success');
  // Confetti burst
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;z-index:500;pointer-events:none;overflow:hidden';
  document.body.appendChild(container);
  const colors = ['#BFFF00','#22c55e','#f59e0b','#3b82f6','#a855f7','#ef4444','#fff'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    const size = 4 + Math.random() * 6;
    const x = 20 + Math.random() * 60;
    const delay = Math.random() * 0.3;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const drift = (Math.random() - 0.5) * 40;
    p.style.cssText = `position:absolute;left:${x}%;top:-10px;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? '50%' : '1px'};opacity:1;animation:confetti-fall ${1.5 + Math.random()}s ease-out ${delay}s forwards`;
    p.style.setProperty('--drift', drift + 'vw');
    container.appendChild(p);
  }
  // Add keyframes if not already present
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `@keyframes confetti-fall { 0% { transform: translateY(0) translateX(0) rotate(0deg); opacity:1; } 100% { transform: translateY(100vh) translateX(var(--drift, 0px)) rotate(720deg); opacity:0; } }`;
    document.head.appendChild(style);
  }
  setTimeout(() => container.remove(), 3000);
}
function exportTrainingReport() {
  const name = userProfile?.displayName || currentUser?.displayName || 'Athlete';
  const year = userProfile?.yearLevel || '';
  const tier = capitalize(userProfile?.fitnessLevel || 'basic');
  const total = userWorkouts.length;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  // Calc streak
  let streak = 0;
  if (total > 0) {
    const check = new Date(now); check.setHours(0,0,0,0);
    const dates = new Set();
    userWorkouts.forEach(w => {
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
      if (d) dates.add(d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate());
    });
    let k = check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate();
    if (!dates.has(k)) check.setDate(check.getDate()-1);
    while (dates.has(check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate())) {
      streak++; check.setDate(check.getDate()-1);
    }
  }
  // Weekly data
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(now); wStart.setDate(now.getDate() - now.getDay() - (i*7)); wStart.setHours(0,0,0,0);
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate()+7);
    const count = userWorkouts.filter(w => {
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
      return d && d >= wStart && d < wEnd;
    }).length;
    weeks.push({ label: wStart.toLocaleDateString('en-AU',{day:'numeric',month:'short'}), count });
  }
  // Recent workouts (last 20)
  const recent = userWorkouts.slice(0, 20);
  const avgRpe = userWorkouts.filter(w => w.rpe).length > 0
    ? (userWorkouts.filter(w => w.rpe).reduce((s, w) => s + w.rpe, 0) / userWorkouts.filter(w => w.rpe).length).toFixed(1)
    : null;
  let reportHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Training Report - ${escHtml(name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a;font-size:14px}
h1{font-size:24px;margin-bottom:4px}h2{font-size:16px;margin:24px 0 8px;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px}
.meta{color:#666;font-size:13px;margin-bottom:24px}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}
.stat{background:#f5f5f5;padding:12px;border-radius:8px;text-align:center}.stat-val{font-size:22px;font-weight:700}.stat-lbl{font-size:11px;color:#888;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee;font-size:12px}
th{font-weight:600;color:#555;font-size:11px;text-transform:uppercase}.bar-row{display:flex;align-items:flex-end;gap:6px;height:60px;margin:12px 0}
.bar-col{flex:1;text-align:center}.bar{background:#BFFF00;border-radius:3px 3px 0 0;min-height:2px;margin:0 auto;width:80%}.bar-lbl{font-size:9px;color:#888;margin-top:3px}
.print-btn{margin-top:24px;padding:10px 24px;background:#BFFF00;border:none;font-weight:600;border-radius:6px;cursor:pointer;font-size:13px}
@media print{.print-btn{display:none}}
</style></head><body>
<h1>TurboPrep Training Report</h1>
<div class="meta">${escHtml(name)} · ${year} · ${tier} tier · Generated ${dateStr}</div>
<div class="stat-grid">
  <div class="stat"><div class="stat-val">${total}</div><div class="stat-lbl">Total Workouts</div></div>
  <div class="stat"><div class="stat-val">${streak}</div><div class="stat-lbl">Day Streak</div></div>
  <div class="stat"><div class="stat-val">${avgRpe || '—'}</div><div class="stat-lbl">Avg RPE</div></div>
  <div class="stat"><div class="stat-val">${weeks[weeks.length-1]?.count || 0}</div><div class="stat-lbl">This Week</div></div>
</div>
<h2>Workouts Per Week (Last 8 Weeks)</h2>
<div class="bar-row">
${weeks.map(w => `<div class="bar-col"><div class="bar" style="height:${Math.max(2, (w.count / Math.max(...weeks.map(x=>x.count),1)) * 50)}px"></div><div class="bar-lbl">${w.label}</div></div>`).join('')}
</div>
<h2>Recent Workouts</h2>
<table><thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Duration</th><th>RPE</th></tr></thead><tbody>
${recent.map(w => {
  const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
  return `<tr><td>${d.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</td><td>${escHtml(w.name||'')}</td><td>${escHtml(w.type||'')}</td><td>${w.duration||'—'} min</td><td>${w.rpe||'—'}</td></tr>`;
}).join('')}
</tbody></table>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body></html>`;
  const blob = new Blob([reportHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
let aiChatHistory = [];
function showAiHelpMenu() {
  const messagesEl = $('ai-messages');
  const aiMsg = document.createElement('div');
  aiMsg.className = 'ai-msg ai';
  aiMsg.innerHTML = `What do you need help with?<br><br>
    <div class="ai-quick-btns" style="margin-top:6px">
      <button class="ai-quick-btn ai-help-opt" data-help="edit-plan" style="background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.25);color:#3b82f6">✏️ Edit My Plan</button>
      <button class="ai-quick-btn ai-help-opt" data-help="race-prep" style="background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.25);color:#ef4444">🏁 Race Prep</button>
      <button class="ai-quick-btn ai-help-opt" data-help="injury-mod" style="background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.25);color:#f97316">🩹 Injury Mode</button>
      <button class="ai-quick-btn ai-help-opt" data-help="form-check" style="background:rgba(168,85,247,.12);border-color:rgba(168,85,247,.25);color:#a855f7">🎥 Form Tips</button>
      <button class="ai-quick-btn ai-help-opt" data-help="pick-plan">🎯 Pick a Plan</button>
      <button class="ai-quick-btn ai-help-opt" data-help="sore">🦵 I'm Sore</button>
      <button class="ai-quick-btn ai-help-opt" data-help="warmup">🔥 Race Warm-up</button>
    </div>`;
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  messagesEl.querySelectorAll('.ai-help-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = btn.dataset.help;
      if (h === 'edit-plan') startAiPlanEdit();
      else if (h === 'race-prep') startAiRacePrep();
      else if (h === 'injury-mod') startAiInjuryMod();
      else if (h === 'form-check') startAiFormCheck();
      else if (h === 'pick-plan') sendAiMessage('What plan should I pick for my year level?');
      else if (h === 'sore') sendAiMessage('My legs are really sore, should I train today?');
      else if (h === 'warmup') sendAiMessage('How should I warm up before a race?');
    });
  });
}
function openAiCoach(prefill) {
  $('ai-overlay').style.display = 'flex';
  if (prefill) {
    $('ai-input').value = prefill;
    sendAiMessage(prefill);
  } else {
    $('ai-input').focus();
  }
}
function closeAiCoach() {
  $('ai-overlay').style.display = 'none';
}
$('ai-fab')?.addEventListener('click', () => { haptic('light'); openAiCoach(); });
$('ai-close-btn')?.addEventListener('click', closeAiCoach);
// Quick question buttons
document.querySelectorAll('.ai-quick-btn:not(.ai-gen-trigger):not(.ai-action-trigger)').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    if (q) sendAiMessage(q);
    const qb = $('ai-quick-btns');
    if (qb) qb.remove();
  });
});
// Generate plan trigger
document.querySelectorAll('.ai-gen-trigger').forEach(btn => {
  btn.addEventListener('click', () => {
    const qb = $('ai-quick-btns');
    if (qb) qb.remove();
    startPlanGeneration();
  });
});
// AI action triggers (edit plan, weekly review, race prep, injury mode)
document.querySelectorAll('.ai-action-trigger').forEach(btn => {
  btn.addEventListener('click', () => {
    const qb = $('ai-quick-btns');
    if (qb) qb.remove();
    const action = btn.dataset.action;
    if (action === 'edit-plan') startAiPlanEdit();
    else if (action === 'weekly-review') startAiWeeklyReview();
    else if (action === 'race-prep') startAiRacePrep();
    else if (action === 'injury-mod') startAiInjuryMod();
    else if (action === 'form-check') startAiFormCheck();
    else if (action === 'help-menu') showAiHelpMenu();
  });
});
$('ai-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('ai-send-btn').click();
  }
});
$('ai-send-btn')?.addEventListener('click', () => {
  const msg = $('ai-input').value.trim();
  if (!msg) return;
  const input = $('ai-input');
  if (input.dataset.planMode === 'custom') {
    delete input.dataset.planMode;
    generateAiPlan(null, userProfile?.yearLevel || 'Y10', userProfile?.fitnessLevel || 'basic', msg);
    input.value = '';
  } else if (input.dataset.planEditMode) {
    delete input.dataset.planEditMode;
    const plan = findPlan(input.dataset.planEditId);
    delete input.dataset.planEditId;
    input.value = '';
    if (plan) sendAiPlanEdit(msg, plan);
    else sendAiMessage(msg);
  } else if (input.dataset.racePrepMode) {
    delete input.dataset.racePrepMode;
    input.value = '';
    generateRacePrepPlan(msg, 14);
  } else if (input.dataset.injuryMode) {
    delete input.dataset.injuryMode;
    input.value = '';
    sendInjuryModification(msg, userProfile?.activePlanId ? findPlan(userProfile.activePlanId) : null);
  } else {
    sendAiMessage(msg);
  }
});
async function sendAiMessage(message) {
  const messagesEl = $('ai-messages');
  const input = $('ai-input');
  input.value = '';
  // Remove quick buttons
  const qb = $('ai-quick-btns');
  if (qb) qb.remove();
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = message;
  messagesEl.appendChild(userMsg);
  // Add typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  // Build context from user profile
  const ctx = [];
  if (userProfile?.displayName) ctx.push('Name: ' + userProfile.displayName);
  if (userProfile?.yearLevel) ctx.push('Year level: ' + userProfile.yearLevel);
  if (userProfile?.fitnessLevel) ctx.push('Fitness tier: ' + userProfile.fitnessLevel);
  if (userProfile?.activePlanId) {
    const plan = findPlan(userProfile.activePlanId);
    if (plan) ctx.push('Active plan: ' + plan.name + ' (' + plan.category + ')');
  }
  ctx.push('Total workouts logged: ' + userWorkouts.length);
  try {
    const resp = await fetch('/.netlify/functions/ai-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        context: ctx.join('. ')
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Request failed');
    typingMsg.innerHTML = '';
    typingMsg.textContent = data.reply;
  } catch(e) {
    typingMsg.innerHTML = '';
    typingMsg.textContent = 'Sorry, I could not get a response. Make sure the AI Coach function is deployed on Netlify with the ANTHROPIC_API_KEY environment variable.';
    console.error('AI Coach error:', e);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
// Explain plan function — called from plan cards
async function explainPlan(planId) {
  const plan = findPlan(planId);
  if (!plan) return;
  const pd = getPlanDisplayData(plan);
  const workoutNames = plan.workouts.map(w => w.name).join(', ');
  const prompt = `Explain this training plan in simple terms for a ${plan.yearLevel} student:
Plan name: ${pd.name}
Category: ${plan.category}
Tier: ${plan.tier}
Duration: ${pd.durationWeeks} weeks, ${pd.sessionsPerWeek} sessions per week
Workouts: ${workoutNames}
Description: ${pd.description}
Explain: what this plan trains, why the workouts are in this order, what the student should expect each week, and how hard it will feel. Keep it encouraging.`;
  openAiCoach();
  // Show the question
  const messagesEl = $('ai-messages');
  const qb = $('ai-quick-btns');
  if (qb) qb.remove();
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = 'Explain the plan: ' + pd.name;
  messagesEl.appendChild(userMsg);
  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  try {
    const resp = await fetch('/.netlify/functions/ai-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, context: '' })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Request failed');
    typingMsg.innerHTML = '';
    typingMsg.textContent = data.reply;
  } catch(e) {
    typingMsg.innerHTML = '';
    typingMsg.textContent = 'Sorry, could not explain this plan right now. Check that the AI Coach function is deployed.';
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
let pendingAiPlan = null;
function startPlanGeneration() {
  const messagesEl = $('ai-messages');
  const year = userProfile?.yearLevel || 'Y10';
  const tier = userProfile?.fitnessLevel || 'basic';
  const aiMsg = document.createElement('div');
  aiMsg.className = 'ai-msg ai';
  aiMsg.innerHTML = `What kind of plan do you want?<br><br>
    <div class="ai-quick-btns" style="margin-top:8px">
      <button class="ai-quick-btn ai-plan-type" data-ptype="invehicle">🚴 In Vehicle</button>
      <button class="ai-quick-btn ai-plan-type" data-ptype="floor">🏠 Floor & Home</button>
      <button class="ai-quick-btn ai-plan-type" data-ptype="machine">🏋️ Machine</button>
      <button class="ai-quick-btn ai-plan-type" data-ptype="offseason">☀️ Off-Season</button>
      <button class="ai-quick-btn ai-plan-type" data-ptype="holiday">🏖️ Holiday</button>
      <button class="ai-quick-btn ai-plan-type" data-ptype="custom">🎯 Custom goal</button>
    </div>`;
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  messagesEl.querySelectorAll('.ai-plan-type').forEach(btn => {
    btn.addEventListener('click', () => {
      const ptype = btn.dataset.ptype;
      if (ptype === 'custom') {
        const userMsg = document.createElement('div');
        userMsg.className = 'ai-msg user';
        userMsg.textContent = 'I want a custom plan';
        messagesEl.appendChild(userMsg);
        const promptMsg = document.createElement('div');
        promptMsg.className = 'ai-msg ai';
        promptMsg.textContent = 'Describe what you want — e.g. "I want to get faster for a race in 2 weeks" or "a bodyweight plan I can do at home in 20 minutes"';
        messagesEl.appendChild(promptMsg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        $('ai-input').dataset.planMode = 'custom';
      } else {
        generateAiPlan(ptype, year, tier);
      }
    });
  });
}
async function generateAiPlan(category, yearLevel, tier, customGoal) {
  const messagesEl = $('ai-messages');
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = customGoal || 'Generate a ' + category + ' plan for ' + yearLevel + ' ' + tier;
  messagesEl.appendChild(userMsg);
  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  const catNames = { invehicle: 'In Vehicle (HPV riding)', floor: 'Floor & Home (bodyweight)', machine: 'Fitness Machine (gym)', offseason: 'Off-Season (fun cross-training to maintain fitness)', holiday: 'Holiday (short 15-20 min sessions doable anywhere)' };
  const prompt = customGoal
    ? 'Create a training plan: "' + customGoal + '". Student is ' + yearLevel + ', ' + tier + ' tier.'
    : 'Create a ' + (catNames[category] || category) + ' training plan for ' + yearLevel + ' at ' + tier + ' tier.';
  try {
    const resp = await fetch('/.netlify/functions/ai-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        context: 'PLAN_GENERATION_MODE: Respond with ONLY valid JSON, no markdown or explanation. Structure: {"name":"...","description":"...","category":"' + (category||'floor') + '","yearLevel":"' + yearLevel + '","tier":"' + tier + '","durationWeeks":2,"sessionsPerWeek":3,"workouts":[{"week":1,"day":"Mon","name":"...","description":"detailed workout description","duration":40,"intensity":"easy|moderate|hard"}]}. intensity must be easy, moderate, or hard. day must be Mon-Sun. Make ' + (yearLevel === 'Y7' || yearLevel === 'Y8' ? '2-3 sessions/week, 30-45 min, easy to moderate' : yearLevel === 'Y9' || yearLevel === 'Y10' ? '3-4 sessions/week, 40-60 min, one hard max' : '4-5 sessions/week, 50-80 min, 1-2 hard') + '. Write workout descriptions in motivating coaching voice with specific exercises, reps, and rest times. Australian English.'
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed');
    let planData;
    try {
      const clean = (data.reply || '').replace(/```json|```/g, '').trim();
      planData = JSON.parse(clean);
    } catch(e) {
      typingMsg.innerHTML = '';
      typingMsg.textContent = data.reply || 'Could not generate a structured plan. Try again.';
      return;
    }
    if (!planData.name || !planData.workouts || !Array.isArray(planData.workouts)) {
      typingMsg.innerHTML = '';
      typingMsg.textContent = 'The plan was incomplete. Try again.';
      return;
    }
    planData.id = 'ai-plan-' + Date.now();
    planData.category = planData.category || category || 'floor';
    planData.yearLevel = planData.yearLevel || yearLevel;
    planData.tier = planData.tier || tier;
    planData.durationWeeks = planData.durationWeeks || 2;
    planData.sessionsPerWeek = planData.sessionsPerWeek || 3;
    planData.createdBy = currentUser?.uid || 'demo';
    planData.createdByName = userProfile?.displayName || 'Unknown';
    planData.createdAt = new Date().toISOString();
    planData.shared = false;
    pendingAiPlan = planData;
    const workoutList = planData.workouts.map(w => 'W' + w.week + ' ' + w.day + ': ' + w.name + ' (' + w.duration + 'min)').join('<br>');
    typingMsg.innerHTML = '<div class="ai-gen-plan-card">' +
      '<div class="ai-gen-plan-title">' + escHtml(planData.name) + '</div>' +
      '<div class="ai-gen-plan-meta">' + planData.yearLevel + ' · ' + capitalize(planData.tier) + ' · ' + planData.durationWeeks + ' weeks · ' + planData.sessionsPerWeek + 'x/week</div>' +
      '<div style="font-size:12px;color:var(--muted-fg);margin-top:6px">' + escHtml(planData.description) + '</div>' +
      '<div style="font-size:11px;color:var(--muted-fg);margin-top:8px;line-height:1.6">' + workoutList + '</div>' +
      '<div class="ai-gen-plan-btns">' +
        '<button class="ai-gen-save" id="ai-plan-save">Save Plan</button>' +
        '<button class="ai-gen-share" id="ai-plan-share">Save & Share with Team</button>' +
      '</div></div>';
    $('ai-plan-save')?.addEventListener('click', () => saveAiPlan(false));
    $('ai-plan-share')?.addEventListener('click', () => saveAiPlan(true));
  } catch(e) {
    typingMsg.innerHTML = '';
    typingMsg.textContent = 'Could not generate plan. Check the AI function is deployed.';
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
async function saveAiPlan(shareWithTeam) {
  if (!pendingAiPlan) return;
  const plan = { ...pendingAiPlan, shared: shareWithTeam };
  // Always add to local array first
  customPlans.unshift(plan);
  // Always persist to localStorage (primary storage)
  saveCustomPlansLocal();
  // Also save to Firestore (secondary sync)
  if (!demoMode && db && currentUser) {
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'customPlans', plan.id), plan);
    } catch(e) { console.error('Save plan error:', e); }
  }
  // Share with team
  if (shareWithTeam && userProfile?.teamId) {
    if (!demoMode && db) {
      try {
        await setDoc(doc(db, 'teams', userProfile.teamId, 'sharedPlans', plan.id), plan);
      } catch(e) { console.error('Share plan error:', e); }
    }
  }
  pendingAiPlan = null;
  const messagesEl = $('ai-messages');
  const msg = document.createElement('div');
  msg.className = 'ai-msg ai';
  msg.textContent = shareWithTeam
    ? '"' + plan.name + '" saved and shared with your team! Find it in Fitness → My Plans.'
    : '"' + plan.name + '" saved! Find it in Fitness → My Plans.';
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  // Refresh My Plans tab
  if (fitnessSubTab === 'plans') renderPlans();
}
// Save custom plans to localStorage
function saveCustomPlansLocal() {
  try { localStorage.setItem('vf_customPlans', JSON.stringify(customPlans)); } catch(e) {}
}
// Delete a custom plan by index
async function deleteCustomPlan(idx) {
  const plan = customPlans[idx];
  if (!plan) return;
  customPlans.splice(idx, 1);
  saveCustomPlansLocal();
  // Also delete from Firestore
  if (!demoMode && db && currentUser) {
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'customPlans', plan.id));
    } catch(e) { console.error('Delete plan Firestore error:', e); }
  }
  renderPlans();
}
// Load from localStorage (always), then merge Firestore (when available)
async function loadCustomPlans() {
  // 1. Always load from localStorage first
  try {
    const stored = localStorage.getItem('vf_customPlans');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customPlans = parsed;
      }
    }
  } catch(e) {}
  // 2. Try merging from Firestore
  if (!demoMode && db && currentUser) {
    try {
      const mySnap = await getDocs(collection(db, 'users', currentUser.uid, 'customPlans'));
      const myPlans = mySnap.docs.map(d => ({ ...d.data(), id: d.id }));
      let teamPlans = [];
      if (userProfile?.teamId) {
        try {
          const teamSnap = await getDocs(collection(db, 'teams', userProfile.teamId, 'sharedPlans'));
          teamPlans = teamSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch(e) {}
      }
      // Merge: keep localStorage plans + add any Firestore-only plans
      const planMap = {};
      customPlans.forEach(p => { planMap[p.id] = p; });
      teamPlans.forEach(p => { if (!planMap[p.id]) planMap[p.id] = { ...p, _source: 'team' }; });
      myPlans.forEach(p => { planMap[p.id] = { ...p, _source: 'mine' }; });
      customPlans = Object.values(planMap);
      saveCustomPlansLocal(); // sync merged result back to localStorage
    } catch(e) { console.error('Load custom plans error:', e); }
  }
}
// AI PLAN EDITOR (natural language editing)
// --- Team Activity Feed loader ---
async function loadTeamFeed() {
  teamFeedCache = [];
  if (demoMode || !db || !currentUser || !userProfile?.teamId) return;
  try {
    // Get team members
    const teamSnap = await getDoc(doc(db, 'teams', userProfile.teamId));
    if (!teamSnap.exists()) return;
    const team = teamSnap.data();
    const memberIds = team.members || [];
    if (memberIds.length === 0) return;
    // Load recent workouts from each member (limited)
    const feed = [];
    const limit8 = memberIds.slice(0, 15); // cap at 15 members
    for (const uid of limit8) {
      if (uid === currentUser.uid) continue; // skip self
      try {
        const wSnap = await getDocs(query(collection(db, 'users', uid, 'workouts'), orderBy('date', 'desc')));
        const docs = wSnap.docs.slice(0, 3); // latest 3 per member
        const profileSnap = await getDoc(doc(db, 'users', uid));
        const profile = profileSnap.exists() ? profileSnap.data() : {};
        const name = profile.displayName || 'Unknown';
        docs.forEach(d => {
          const w = d.data();
          const date = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
          feed.push({
            name,
            action: 'Logged ' + (w.name || 'a workout') + ' · ' + (w.duration || '?') + 'min',
            date,
            timeAgo: timeAgo(date)
          });
        });
      } catch(e) {}
    }
    feed.sort((a, b) => b.date - a.date);
    teamFeedCache = feed.slice(0, 10);
  } catch(e) { console.error('Load team feed error:', e); }
}
// --- Team Challenge loader ---
async function loadTeamChallenge() {
  activeChallenge = null;
  if (demoMode) {
    activeChallenge = {
      id: 'demo-challenge',
      title: 'Monthly Challenge',
      type: 'monthly',
      repeat: true,
      startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 27 * 86400000).toISOString(),
      teams: {
        team1: { name: 'Team Alpha', score: 245 },
        team2: { name: 'Team Beta', score: 198 },
        team3: { name: 'Team Gamma', score: 312 },
        team4: { name: 'Team Delta', score: 156 },
        team5: { name: 'Team Omega', score: 280 }
      }
    };
    return;
  }
  if (!db || !currentUser) return;
  try {
    const challengeRef = doc(db, 'config', 'activeChallenge');
    const snap = await getDoc(challengeRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const now = new Date();
    const end = new Date(data.endDate);
    if (end > now) {
      // Challenge is still active
      activeChallenge = data;
    } else if (data.repeat) {
      // Challenge expired but repeat is on — auto-create next month
      const newStart = new Date(end);
      const newEnd = new Date(end);
      newEnd.setMonth(newEnd.getMonth() + 1);
      // Reset all team scores to 0
      const resetTeams = {};
      Object.entries(data.teams || {}).forEach(([k, v]) => {
        resetTeams[k] = { name: (v && v.name) || k, score: 0 };
      });
      const newChallenge = {
        ...data,
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
        teams: resetTeams
      };
      // Save the new challenge back to Firestore
      try {
        await setDoc(challengeRef, newChallenge);
      } catch(e) { console.error('Auto-repeat save error:', e); }
      activeChallenge = newChallenge;
    }
  } catch(e) { console.error('Load challenge error:', e); }
}
async function loadTrainingSessions() {
  trainingSessions = [];
  if (demoMode) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 5);
    trainingSessions = [
      { id: 'd1', title: 'After School Training', date: tomorrow.toISOString().split('T')[0], time: '15:45', endTime: '17:00', location: 'School Oval', notes: 'Bring your helmet and gloves. Floor session if raining.', createdBy: 'Coach' },
      { id: 'd2', title: 'Race Prep Session', date: nextWeek.toISOString().split('T')[0], time: '15:45', endTime: '17:30', location: 'School Oval', notes: 'Final prep before Murray Bridge. Vehicle checks + practice laps.', createdBy: 'Coach' }
    ];
    return;
  }
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'trainingSessions'));
    if (snap.exists()) {
      trainingSessions = snap.data().sessions || [];
      // Cache locally for notifications
      try { localStorage.setItem('vf_training_sessions', JSON.stringify(trainingSessions)); } catch(e) {}
    }
  } catch(e) { console.error('Load training sessions error:', e); }
}
function renderWorkouts() {
  const c = $('workouts-content');
  let html = '<div style="display:flex;align-items:center;justify-content:space-between"><div class="page-title" style="margin:0">Activities</div><button id="manual-log-btn" style="font-size:12px;padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface-alt);color:var(--text);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Manually</button></div>';
  // Load stored routes for mini maps
  let storedRoutes = {};
  try { storedRoutes = JSON.parse(localStorage.getItem('vf_routes') || '{}'); } catch(e) {}
  if (userWorkouts.length === 0) {
    html += `<div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--muted-fg)"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/></svg></div>
      <div class="empty-state-title">No Activities Yet</div>
      <div class="empty-state-desc">Tap Record in the nav bar to track with GPS, or Log Manually above to enter a workout.</div>
    </div>`;
  } else {
    // Filter buttons
    html += `<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button class="wo-filter-btn active" data-wofilter="all" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid var(--primary);background:var(--primary);color:var(--primary-fg);cursor:pointer;font-weight:600">All (${userWorkouts.length})</button>`;
    // Collect unique workout types from actual data
    const typeSet = new Set();
    userWorkouts.forEach(w => { if (w.type) typeSet.add(w.type.toLowerCase()); });
    const types = [...typeSet].sort();
    const typeIcons = {hpv:'🏎️',ride:'🚴',run:'🏃',treadmill:'🏃‍♂️',walk:'🚶',gym:'🏋️',strength:'🏋️',cardio:'❤️',flexibility:'🧘',workout:'🏋️'};
    types.forEach(t => {
      const count = userWorkouts.filter(w => (w.type || 'ride').toLowerCase() === t).length;
      if (count > 0) {
        html += `<button class="wo-filter-btn" data-wofilter="${t}" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);cursor:pointer">${typeIcons[t]} ${capitalize(t)} (${count})</button>`;
      }
    });
    // Check for tracked vs manual
    const trackedCount = userWorkouts.filter(w => w.source === 'tracker').length;
    const stravaCount = userWorkouts.filter(w => w.source === 'strava').length;
    const manualCount = userWorkouts.length - trackedCount - stravaCount;
    if (trackedCount > 0) {
      html += `<button class="wo-filter-btn" data-wofilter="tracked" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);cursor:pointer">📍 GPS (${trackedCount})</button>`;
    }
    if (stravaCount > 0) {
      html += `<button class="wo-filter-btn" data-wofilter="strava" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);cursor:pointer">⬡ Strava (${stravaCount})</button>`;
    }
    html += '</div>';
    html += '<div class="space-y" id="wo-list">';
    let storedPhotos = {};
    try { storedPhotos = JSON.parse(localStorage.getItem('vf_photos') || '{}'); } catch(e) {}
    userWorkouts.forEach((w, idx) => {
      const date = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
      const dateStr = date.toLocaleDateString('en-AU', {day:'numeric',month:'short'});
      const timeStr = date.toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'});
      const wType = (w.type || 'ride').toLowerCase();
      const isTracked = w.source === 'tracker';
      const isStrava = w.source === 'strava';
      const routeId = w.routeId || (w.stravaId ? 'strava-' + w.stravaId : w._id);
      const hasRoute = routeId && storedRoutes[routeId] && storedRoutes[routeId].length > 1;
      const sourceIcon = isStrava ? '⬡ ' : isTracked ? '📍 ' : '';
      const photoId = w.photoId || w._id;
      const hasPhoto = storedPhotos[photoId];
      html += `<div class="card wo-card" data-wo-type="${wType}" data-wo-source="${w.source || 'manual'}" data-wo-idx="${idx}">
        <div class="card-pad">
          <div class="wo-top">
            <div class="wo-left" style="flex:1;min-width:0">
              <div class="wo-title-row">
                <span class="wo-name">${escHtml(w.name || 'Workout')}</span>
                <span class="activity-badge ${wType}${isStrava ? ' strava' : ''}">${sourceIcon}${capitalize(wType)}</span>
              </div>
              <div class="activity-stats-row">
                ${w.duration ? `<span><strong>${w.duration}</strong> min</span>` : ''}
                ${w.distance ? `<span><strong>${w.distance}</strong> km</span>` : ''}
                ${w.avgSpeed ? `<span><strong>${w.avgSpeed}</strong> km/h</span>` : ''}
                ${w.heartRate ? `<span><strong>${w.heartRate}</strong> bpm</span>` : ''}
                ${w.rpe ? `<span>RPE <strong>${w.rpe}</strong>/10</span>` : ''}
                ${w.laps ? `<span><strong>${w.laps}</strong> laps</span>` : ''}
                ${w.pace ? `<span><strong>${w.pace}</strong> /km</span>` : ''}
                ${w.incline ? `<span><strong>${w.incline}</strong>% incline</span>` : ''}
              </div>
              ${w.vehicle || w.location || w.bestLap ? `<div style="font-size:11px;color:var(--muted-fg);margin-top:2px">${[w.vehicle, w.location, w.bestLap ? 'Best lap: ' + w.bestLap : ''].filter(Boolean).join(' · ')}</div>` : ''}
              <div style="font-size:11px;color:var(--muted-fg);margin-top:3px">${dateStr} · ${timeStr}</div>
            </div>
            <button class="wo-delete" data-id="${w._id}" aria-label="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
          ${hasRoute ? `<div class="activity-map-thumb" id="mini-map-${idx}" data-route-id="${routeId}"></div>` : ''}
          ${hasPhoto ? `<img src="${storedPhotos[photoId]}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-top:8px" loading="lazy">` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  }
  c.innerHTML = html;
  // Render mini maps for tracked activities
  if (typeof L !== 'undefined') {
    c.querySelectorAll('.activity-map-thumb').forEach(el => {
      const routeId = el.dataset.routeId;
      const route = storedRoutes[routeId];
      if (!route || route.length < 2) return;
      setTimeout(() => {
        try {
          const miniMap = L.map(el.id, {
            zoomControl: false, attributionControl: false, dragging: false,
            touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false
          });
          L.tileLayer(getMapTileUrl(), { maxZoom: 18 }).addTo(miniMap);
          const latlngs = route.map(p => [p[0], p[1]]);
          const polyline = L.polyline(latlngs, { color: '#BFFF00', weight: 3, opacity: 0.9 }).addTo(miniMap);
          L.circleMarker(latlngs[0], { radius: 5, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(miniMap);
          L.circleMarker(latlngs[latlngs.length - 1], { radius: 5, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(miniMap);
          miniMap.fitBounds(polyline.getBounds(), { padding: [10, 10] });
        } catch(e) { console.warn('Mini map error:', e); }
      }, 100);
    });
  }
  // Filter buttons
  c.querySelectorAll('.wo-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      c.querySelectorAll('.wo-filter-btn').forEach(b => {
        b.style.background = 'var(--surface-alt)'; b.style.color = 'var(--muted-fg)'; b.style.borderColor = 'var(--border)';
      });
      btn.style.background = 'var(--primary)'; btn.style.color = 'var(--primary-fg)'; btn.style.borderColor = 'var(--primary)';
      const filter = btn.dataset.wofilter;
      c.querySelectorAll('.wo-card').forEach(card => {
        if (filter === 'all') { card.style.display = ''; }
        else if (filter === 'tracked') { card.style.display = card.dataset.woSource === 'tracker' ? '' : 'none'; }
        else if (filter === 'strava') { card.style.display = card.dataset.woSource === 'strava' ? '' : 'none'; }
        else { card.style.display = card.dataset.woType === filter ? '' : 'none'; }
      });
    });
  });
  // Delete buttons
  c.querySelectorAll('.wo-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id || !currentUser) return;
      if (demoMode) { userWorkouts = userWorkouts.filter(w=>w._id!==id); renderWorkouts(); return; }
      if (!db) return;
      try { await deleteDoc(doc(db, 'users', currentUser.uid, 'workouts', id)); } catch(e) { console.error('Delete error:', e); }
    });
  });
  // Click card to open detail view
  c.querySelectorAll('.wo-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('.wo-delete')) return; // Don't open detail when deleting
      const idx = parseInt(card.dataset.woIdx);
      if (!isNaN(idx)) openActivityDetail(idx);
    });
  });
  // Manual log button
  const manualBtn = $('manual-log-btn');
  if (manualBtn) {
    manualBtn.addEventListener('click', () => { haptic('light'); openWorkoutSheet(); });
  }
}
// FAB & Workout Log Sheet
// Record moved to nav tab
function openWorkoutSheet() {
  const today = new Date().toISOString().split('T')[0];
  function getTypeFields(type) {
    const fields = {
      HPV: { name: 'HPV Session', fields: `
        <div class="form-row"><div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="45" min="1"></div><div class="form-group"><label class="label">Laps</label><input class="input" type="number" id="wo-laps" placeholder="Optional" min="0"></div></div>
        <div class="form-row"><div class="form-group"><label class="label">Distance (km)</label><input class="input" type="number" id="wo-distance" placeholder="Optional" min="0" step="0.1"></div><div class="form-group"><label class="label">Avg Speed (km/h)</label><input class="input" type="number" id="wo-speed" placeholder="Optional" min="0" step="0.1"></div></div>
        <div class="form-group"><label class="label">Vehicle</label><input class="input" type="text" id="wo-vehicle" placeholder="e.g. Team car, Practice trike"></div>
        <div class="form-group"><label class="label">Track / Location</label><input class="input" type="text" id="wo-location" placeholder="e.g. School oval, velodrome"></div>
        <div class="form-row"><div class="form-group"><label class="label">Avg Heart Rate</label><input class="input" type="number" id="wo-hr" placeholder="Optional" min="0"></div><div class="form-group"><label class="label">Best Lap Time</label><input class="input" type="text" id="wo-bestlap" placeholder="e.g. 2:15"></div></div>` },
      Ride: { name: 'Ride', fields: `
        <div class="form-row"><div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="45" min="1"></div><div class="form-group"><label class="label">Distance (km)</label><input class="input" type="number" id="wo-distance" placeholder="Optional" min="0" step="0.1"></div></div>
        <div class="form-row"><div class="form-group"><label class="label">Avg Speed (km/h)</label><input class="input" type="number" id="wo-speed" placeholder="Optional" min="0" step="0.1"></div><div class="form-group"><label class="label">Avg Heart Rate</label><input class="input" type="number" id="wo-hr" placeholder="Optional" min="0"></div></div>` },
      Run: { name: 'Run', fields: `
        <div class="form-row"><div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="30" min="1"></div><div class="form-group"><label class="label">Distance (km)</label><input class="input" type="number" id="wo-distance" placeholder="5.0" min="0" step="0.1"></div></div>
        <div class="form-row"><div class="form-group"><label class="label">Avg Pace (min/km)</label><input class="input" type="text" id="wo-pace" placeholder="e.g. 5:30"></div><div class="form-group"><label class="label">Avg Heart Rate</label><input class="input" type="number" id="wo-hr" placeholder="Optional" min="0"></div></div>` },
      Treadmill: { name: 'Treadmill Run', fields: `
        <div class="form-row"><div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="30" min="1"></div><div class="form-group"><label class="label">Distance (km)</label><input class="input" type="number" id="wo-distance" placeholder="Optional" min="0" step="0.1"></div></div>
        <div class="form-row"><div class="form-group"><label class="label">Speed (km/h)</label><input class="input" type="number" id="wo-speed" placeholder="e.g. 10" min="0" step="0.1"></div><div class="form-group"><label class="label">Incline (%)</label><input class="input" type="number" id="wo-incline" placeholder="e.g. 2" min="0" step="0.5"></div></div>
        <div class="form-group"><label class="label">Avg Heart Rate</label><input class="input" type="number" id="wo-hr" placeholder="Optional" min="0"></div>` },
      Strength: { name: 'Strength Session', fields: `
        <div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="45" min="1"></div>
        <div class="form-group"><label class="label">Exercises</label><textarea class="input" id="wo-exercises" rows="3" placeholder="e.g. Squats 3x12, Push-ups 3x15, Plank 3x30s"></textarea><div style="font-size:10px;color:var(--muted-fg);margin-top:2px">List what you did — sets x reps or time</div></div>
        <div class="form-group"><label class="label">Avg Heart Rate</label><input class="input" type="number" id="wo-hr" placeholder="Optional" min="0"></div>` },
      Cardio: { name: 'Cardio Session', fields: `
        <div class="form-row"><div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="30" min="1"></div><div class="form-group"><label class="label">Avg Heart Rate</label><input class="input" type="number" id="wo-hr" placeholder="Optional" min="0"></div></div>
        <div class="form-group"><label class="label">Activity</label><input class="input" type="text" id="wo-activity" placeholder="e.g. Skipping, rowing, swimming"></div>` },
      Flexibility: { name: 'Flexibility / Mobility', fields: `
        <div class="form-group"><label class="label">Duration (min)</label><input class="input" type="number" id="wo-duration" placeholder="20" min="1"></div>
        <div class="form-group"><label class="label">Focus Area</label><input class="input" type="text" id="wo-activity" placeholder="e.g. Hips, hamstrings, full body"></div>` }
    };
    return fields[type] || fields.Ride;
  }
  function renderForm(type) {
    const tf = getTypeFields(type);
    $('sheet-content').innerHTML = `
      <div class="sheet-title">Log Workout</div>
      <div class="form-group">
        <label class="label" for="wo-type">Type</label>
        <div style="display:flex;gap:4px;flex-wrap:wrap" id="wo-type-btns">
          ${['HPV','Ride','Run','Treadmill','Strength','Cardio','Flexibility'].map(t => {
            const icons = {HPV:'🏎️',Ride:'🚴',Run:'🏃',Treadmill:'🏃‍♂️',Strength:'🏋️',Cardio:'❤️',Flexibility:'🧘'};
            return `<button class="wo-type-pick${t === type ? ' active' : ''}" data-wotype="${t}" style="padding:6px 10px;font-size:11px;font-weight:600;border-radius:8px;border:1.5px solid ${t === type ? 'var(--primary)' : 'var(--border)'};background:${t === type ? 'rgba(191,255,0,.12)' : 'var(--card)'};color:${t === type ? 'var(--primary)' : 'var(--muted-fg)'};cursor:pointer">${icons[t]} ${t}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="label" for="wo-name">Name</label>
        <input class="input" type="text" id="wo-name" placeholder="${tf.name}" value="${$('wo-name')?.value || ''}">
      </div>
      <div id="wo-type-fields">${tf.fields}</div>
      <div class="form-group">
        <label class="label" for="wo-notes">Notes</label>
        <textarea class="input" id="wo-notes" rows="2" placeholder="Optional">${$('wo-notes')?.value || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="label">How hard did it feel? (RPE)</label>
        <div class="rpe-row" id="rpe-row">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button type="button" class="rpe-btn${n === selectedRpe ? ' selected' : ''}" data-rpe="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="label" for="wo-date">Date</label>
        <input class="input" type="date" id="wo-date" value="${today}">
      </div>
      <div class="form-group">
        <label class="label">Photo (optional)</label>
        <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px dashed var(--border);border-radius:8px;cursor:pointer;color:var(--muted-fg);font-size:13px" id="wo-photo-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          <span id="wo-photo-text">${workoutPhotoData ? 'Photo attached' : 'Add a photo'}</span>
          <input type="file" accept="image/*" capture="environment" id="wo-photo" style="display:none">
        </label>
        <img id="wo-photo-preview" style="${workoutPhotoData ? '' : 'display:none;'}width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:6px" ${workoutPhotoData ? 'src="' + workoutPhotoData + '"' : ''}>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:4px" id="wo-save-btn">Save Workout</button>
    `;
    // Bind type switcher
    document.querySelectorAll('.wo-type-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        currentType = btn.dataset.wotype;
        renderForm(currentType);
      });
    });
    bindFormEvents();
  }
  function bindFormEvents() {
    document.querySelectorAll('#rpe-row .rpe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRpe = parseInt(btn.dataset.rpe);
        document.querySelectorAll('#rpe-row .rpe-btn').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.rpe) === selectedRpe));
      });
    });
    $('wo-photo')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showToast('Photo too large (max 2MB)', 'warn'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 600;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          workoutPhotoData = canvas.toDataURL('image/jpeg', 0.7);
          const preview = $('wo-photo-preview');
          if (preview) { preview.src = workoutPhotoData; preview.style.display = ''; }
          const txt = $('wo-photo-text'); if (txt) txt.textContent = '📷 Photo attached';
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    $('wo-save-btn')?.addEventListener('click', () => saveWorkout(selectedRpe, workoutPhotoData, currentType));
  }
  let selectedRpe = 0;
  let workoutPhotoData = null;
  let currentType = 'HPV';
  renderForm(currentType);
  openSheet();
}
async function saveWorkout(rpe, photoData, workoutType) {
  const name = $('wo-name')?.value?.trim() || '';
  const type = workoutType || 'Ride';
  const duration = parseInt($('wo-duration')?.value) || 0;
  const distance = parseFloat($('wo-distance')?.value) || null;
  const heartRate = parseInt($('wo-hr')?.value) || null;
  const notes = $('wo-notes')?.value?.trim() || null;
  const dateVal = $('wo-date')?.value;
  const rpeVal = rpe || null;
  // Type-specific fields
  const avgSpeed = parseFloat($('wo-speed')?.value) || null;
  const laps = parseInt($('wo-laps')?.value) || null;
  const vehicle = $('wo-vehicle')?.value?.trim() || null;
  const location = $('wo-location')?.value?.trim() || null;
  const bestLap = $('wo-bestlap')?.value?.trim() || null;
  const pace = $('wo-pace')?.value?.trim() || null;
  const incline = parseFloat($('wo-incline')?.value) || null;
  const exercises = $('wo-exercises')?.value?.trim() || null;
  const activity = $('wo-activity')?.value?.trim() || null;
  if (!name) { showToast('Please enter a workout name.', 'warn'); return; }
  if (!duration) { showToast('Please enter duration.', 'warn'); return; }
  closeSheet();
  const dateObj = dateVal ? new Date(dateVal + 'T12:00:00') : new Date();
  const workoutId = 'wo-' + Date.now();
  // Build extra fields (type-specific, only include non-null)
  const extra = {};
  if (avgSpeed) extra.avgSpeed = avgSpeed;
  if (laps) extra.laps = laps;
  if (vehicle) extra.vehicle = vehicle;
  if (location) extra.location = location;
  if (bestLap) extra.bestLap = bestLap;
  if (pace) extra.pace = pace;
  if (incline) extra.incline = incline;
  if (exercises) extra.exerciseNotes = exercises;
  if (activity) extra.activity = activity;
  // Store photo in localStorage if provided
  if (photoData) {
    try {
      const photos = JSON.parse(localStorage.getItem('vf_photos') || '{}');
      photos[workoutId] = photoData;
      const keys = Object.keys(photos);
      while (keys.length > 30) { delete photos[keys.shift()]; } // keep max 30
      localStorage.setItem('vf_photos', JSON.stringify(photos));
    } catch(e) {}
  }
  if (demoMode) {
    userWorkouts.unshift({ _id: workoutId, name, type, duration, distance, heartRate, notes, rpe: rpeVal, ...extra, photoId: photoData ? workoutId : null, date: dateObj, createdAt: new Date() });
    renderWorkouts();
    return;
  }
  showLoading('Saving workout...');
  // Offline detection — queue if no connection
  if (!navigator.onLine) {
    const queued = { name, type, duration, distance, heartRate, notes, rpe: rpeVal, date: dateObj.toISOString(), photoId: photoData ? workoutId : null, queuedAt: new Date().toISOString() };
    try {
      const queue = JSON.parse(localStorage.getItem('vf_offline_queue') || '[]');
      queue.push(queued);
      localStorage.setItem('vf_offline_queue', JSON.stringify(queue));
    } catch(e) {}
    hideLoading();
    showToast('Saved offline — will sync when connected.', 'info');
    userWorkouts.unshift({ _id: workoutId, ...queued, date: dateObj, createdAt: new Date() });
    renderWorkouts();
    return;
  }
  try {
    const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), {
      name, type, duration, distance, heartRate, notes, rpe: rpeVal, ...extra,
      date: Timestamp.fromDate(dateObj),
      createdAt: serverTimestamp()
    });
    hideLoading();
    const oldXp = calcXp();
    showToast('Workout logged!', 'success');
    // Estimate new XP and check for level up
    const estNewXp = oldXp + 10 + 10 + (rpeVal ? 5 : 0); // workout + daily bonus + RPE
    setTimeout(() => checkLevelUp(oldXp, estNewXp), 500);
    if (stravaTokens?.access_token) {
      stravaUploadActivity({ name, type, duration, distance, date: dateObj }).then(async (sid) => {
        if (sid) {
          try { await updateDoc(doc(db, 'users', currentUser.uid, 'workouts', docRef.id), { stravaId: String(sid) }); } catch(e) {}
          showToast('Synced to Strava!', 'success');
        }
      });
    }
    autoUpdateChallengeScore(duration, 10 + (rpeVal ? 5 : 0));
  } catch(e) {
    hideLoading();
    // Network error — queue offline
    const queued = { name, type, duration, distance, heartRate, notes, rpe: rpeVal, date: dateObj.toISOString(), photoId: photoData ? workoutId : null, queuedAt: new Date().toISOString() };
    try {
      const queue = JSON.parse(localStorage.getItem('vf_offline_queue') || '[]');
      queue.push(queued);
      localStorage.setItem('vf_offline_queue', JSON.stringify(queue));
    } catch(ex) {}
    showToast('Saved offline — will sync when connected.', 'info');
    userWorkouts.unshift({ _id: workoutId, ...queued, date: dateObj, createdAt: new Date() });
  }
}
// Bottom Sheet
function openSheet() {
  const overlay = $('sheet-overlay');
  const sheet = $('sheet');
  overlay.style.display = '';
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  });
  overlay.onclick = closeSheet;
}
function closeSheet() {
  const overlay = $('sheet-overlay');
  const sheet = $('sheet');
  overlay.classList.remove('visible');
  sheet.classList.remove('visible');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}
let plansInitialized = false;
function renderPlans() {
  const c = $('plans-content');
  // Auto-select user's year/tier on FIRST render only
  if (!plansInitialized && userProfile) {
    if (userProfile.yearLevel) plansYear = userProfile.yearLevel;
    if (userProfile.fitnessLevel) plansTier = userProfile.fitnessLevel;
    plansInitialized = true;
  }
  const categories = [
    { id: 'invehicle', label: 'In Vehicle', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>' },
    { id: 'floor', label: 'Floor & Home', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' },
    { id: 'machine', label: 'Fitness Machine', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M12 17v4"/></svg>' },
  ];
  const years = ['Y7','Y8','Y9','Y10','Y11','Y12'];
  const tiers = ['basic','average','intense'];
  let html = '<div class="page-title">Training Plans</div>';
  // My AI Plans (inline at top — replaces separate sub-tab)
  if (customPlans.length > 0) {
    html += `<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">My AI Plans · ${customPlans.length}</div>`;
    customPlans.forEach((plan, idx) => {
      const isActive = plan.id === (userProfile?.activePlanId);
      html += `<div style="position:relative;margin-bottom:6px">`;
      html += renderPlanCard(plan, isActive);
      html += `</div>`;
    });
    html += '</div>';
  }
  html += `<button class="btn" id="plans-generate-btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:13px;font-weight:600;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);border-radius:10px;color:#a855f7;display:flex;align-items:center;justify-content:center;gap:6px">✨ Generate Plan with AI</button>`;
  // Search bar
  html += `<div class="demo-search-wrap" style="margin-bottom:10px">
    <svg class="demo-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input class="demo-search" type="text" id="plans-search-input" placeholder="Search plans by name, description..." value="${escHtml(plansSearch)}">
  </div>`;
  const visiblePlans = getVisiblePlans();
  const activePlanId = userProfile?.activePlanId;
  // SEARCH MODE
  if (plansSearch.trim()) {
    const q = plansSearch.toLowerCase().trim();
    const results = visiblePlans.filter(p => {
      const pd = getPlanDisplayData(p);
      return pd.name.toLowerCase().includes(q)
        || pd.description.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q)
        || p.yearLevel.toLowerCase().includes(q)
        || p.tier.toLowerCase().includes(q)
        || (p.workouts || []).some(w => (w.name || '').toLowerCase().includes(q));
    });
    html += `<div style="font-size:12px;color:var(--muted-fg);margin-bottom:10px">${results.length} plan${results.length !== 1 ? 's' : ''} matching "${escHtml(plansSearch)}"</div>`;
    if (results.length === 0) {
      html += `<div class="empty-state" style="padding:24px 16px">
        <div class="empty-state-title">No Plans Found</div>
        <div class="empty-state-desc">Try a different search term.</div>
      </div>`;
    } else {
      const catLabels = { invehicle: 'In Vehicle', floor: 'Floor & Home', machine: 'Fitness Machine' };
      html += '<div class="space-y">';
      results.forEach(plan => {
        const isActive = plan.id === activePlanId;
        html += `<div style="font-size:11px;color:var(--muted-fg);margin-bottom:-8px;margin-top:4px">${plan.yearLevel} · ${catLabels[plan.category] || plan.category}</div>`;
        html += renderPlanCard(plan, isActive);
      });
      html += '</div>';
    }
    c.innerHTML = html;
    bindPlanSearchAndCards(c);
    return;
  }
  // NORMAL MODE — category/year/tier filters
  // Category tabs
  html += '<div class="pill-tabs">';
  categories.forEach(cat => {
    html += `<button class="pill-tab${plansCategory===cat.id?' active':''}" data-cat="${cat.id}">${cat.icon} ${cat.label}</button>`;
  });
  html += '</div>';
  // Category description
  const catKey = plansCategory === 'invehicle' ? 'invehicle' : plansCategory;
  if (UI_COPY.categoryDescriptions && UI_COPY.categoryDescriptions[catKey]) {
    html += `<div class="category-desc">${UI_COPY.categoryDescriptions[catKey]}</div>`;
  }
  // Year pills
  html += '<div class="year-tabs" style="margin-top:10px">';
  years.forEach(y => {
    html += `<button class="year-pill${plansYear===y?' active':''}" data-year="${y}">${y}</button>`;
  });
  html += '</div>';
  // Tier pills
  html += '<div class="tier-tabs">';
  tiers.forEach(t => {
    html += `<button class="tier-pill${plansTier===t?' active':''}" data-tier="${t}">${capitalize(t)}</button>`;
  });
  html += '</div>';
  // Tier description
  if (UI_COPY.tierDescriptions && UI_COPY.tierDescriptions[plansTier]) {
    html += `<div class="tier-desc">${UI_COPY.tierDescriptions[plansTier]}</div>`;
  }
  // Safety banner
  const safety = UI_COPY.safetyBanners[plansYear];
  if (safety) {
    html += `
      <div class="safety-banner" style="margin-top:10px">
        <div class="safety-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <strong>${safety.title}</strong>
          <span class="safety-ages">${safety.ages}</span>
        </div>
        <div class="safety-details">
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${safety.frequency}</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg> ${safety.duration}</span>
          <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ${safety.maxIntensity}</span>
        </div>
        <div class="safety-guideline">${safety.guideline}</div>
      </div>
    `;
  }
  // Filter plans
  const filtered = visiblePlans.filter(p => p.category === plansCategory && p.yearLevel === plansYear && p.tier === plansTier);
  if (filtered.length === 0) {
    html += `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-state-title">No Plans Found</div>
      <div class="empty-state-desc">No training plans match this combination. Try a different category, year level, or fitness tier.</div>
    </div>`;
  } else {
    html += '<div class="space-y" style="margin-top:12px">';
    filtered.forEach(plan => {
      const isActive = plan.id === activePlanId;
      html += renderPlanCard(plan, isActive);
    });
    html += '</div>';
  }
  
  c.innerHTML = html;
  // Bind filter tabs
  c.querySelectorAll('.pill-tab[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      plansCategory = btn.dataset.cat;
      renderPlans();
    });
  });
  c.querySelectorAll('.year-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      plansYear = btn.dataset.year;
      renderPlans();
    });
  });
  c.querySelectorAll('.tier-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      plansTier = btn.dataset.tier;
      renderPlans();
    });
  });
  bindPlanSearchAndCards(c);
}
function bindPlanSearchAndCards(c) {
  // Bind search
  const searchInput = $('plans-search-input');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        plansSearch = searchInput.value.trim();
        renderPlans();
        // Re-focus search after re-render
        const newInput = $('plans-search-input');
        if (newInput) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = newInput.value.length; }
      }, 250);
    });
  }
  // Generate plan button (inside Plans tab)
  const genBtn = $('plans-generate-btn');
  if (genBtn) {
    genBtn.addEventListener('click', () => { haptic('light'); openAiCoach(); startPlanGeneration(); });
  }
  // Bind explain plan buttons
  c.querySelectorAll('.plan-explain-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      haptic('light');
      explainPlan(btn.dataset.explainPlan);
    });
  });
  // Bind plan expand/collapse
  c.querySelectorAll('.plan-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const card = hdr.closest('.plan-card');
      const schedule = card.querySelector('.plan-schedule');
      const chevron = hdr.querySelector('.plan-chevron');
      if (schedule.style.display === 'none' || !schedule.style.display) {
        schedule.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
      } else {
        schedule.style.display = 'none';
        chevron.style.transform = '';
      }
    });
  });
  // Bind activate buttons
  c.querySelectorAll('.plan-activate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const planId = btn.dataset.planId;
      if (!currentUser) return;
      if (demoMode) { userProfile.activePlanId = planId; renderPlans(); renderToday(); return; }
      if (!db) return;
      showLoading('Activating plan...');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { activePlanId: planId });
        userProfile.activePlanId = planId;
        hideLoading();
        renderPlans();
      } catch(e) {
        hideLoading();
        console.error('Activate plan error:', e);
        showError('Failed to activate plan', 'plan', e, { action: 'activate' });
      }
    });
  });
  // Bind exercise expand/collapse
  c.querySelectorAll('.exercise-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.expandEx;
      const detail = document.getElementById('ex-detail-' + key);
      if (detail) {
        const isOpen = detail.classList.toggle('show');
        btn.classList.toggle('open', isOpen);
        btn.textContent = '';
        btn.innerHTML = (isOpen ? 'Hide details' : 'Full details') + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
      }
    });
  });
  // Bind cancel plan buttons
  c.querySelectorAll('.plan-cancel-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUser) return;
      if (!confirm('Cancel this training plan? Your logged workouts will be kept, but your daily checklist will reset.')) return;
      if (demoMode) { userProfile.activePlanId = null; renderPlans(); renderToday(); return; }
      if (!db) return;
      showLoading('Cancelling plan...');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { activePlanId: null });
        userProfile.activePlanId = null;
        hideLoading();
        renderPlans();
      } catch(e) {
        hideLoading();
        console.error('Cancel plan error:', e);
        showError('Failed to cancel plan', 'plan', e, { action: 'cancel' });
      }
    });
  });
}
function renderPlanCard(plan, isActive) {
  const tierColors = { basic:'#3b82f6', average:'#22c55e', intense:'#f97316' };
  const tierColor = tierColors[plan.tier] || '#3b82f6';
  const pd = getPlanDisplayData(plan);
  // Group workouts by week
  const weeks = {};
  plan.workouts.forEach(w => {
    if (!weeks[w.week]) weeks[w.week] = [];
    weeks[w.week].push(w);
  });
  let scheduleHtml = '';
  Object.keys(weeks).sort((a,b)=>a-b).forEach(wk => {
    scheduleHtml += `<div class="week-title">Week ${wk}</div>`;
    weeks[wk].forEach((origW, wIdx) => {
      const globalIdx = plan.workouts.indexOf(origW);
      const w = getWorkoutData(plan.id, globalIdx, origW);
      const intensityClass = 'intensity-' + w.intensity;
      const exerciseKey = plan.id + '_' + globalIdx;
      scheduleHtml += `
        <div class="pw-row">
          <div class="pw-day">${origW.day}</div>
          <div class="pw-info">
            <div class="pw-name"><span class="intensity-dot ${intensityClass}"></span> ${w.name}</div>
            <div class="pw-desc">${w.description.length > 100 ? w.description.substring(0, 100) + '...' : w.description}</div>
            <div class="pw-meta">
              <span class="pw-dur"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${w.duration} min</span>
            </div>
            <button class="exercise-expand-btn" data-expand-ex="${exerciseKey}">
              Full details <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="exercise-detail" id="ex-detail-${exerciseKey}">
              <p><strong>Full Description:</strong></p>
              <p>${w.description}</p>
              <p style="margin-top:6px"><strong>Duration:</strong> ${w.duration} minutes · <strong>Intensity:</strong> ${capitalize(w.intensity)}</p>
              <p><strong>What to focus on:</strong> ${w.intensity === 'easy' ? 'Keep effort conversational. Focus on form and consistency.' : w.intensity === 'moderate' ? 'Comfortably hard — you can talk in short phrases. Maintain steady cadence.' : 'Near your limit — speaking is difficult. Push hard but keep form clean.'}</p>
            </div>
          </div>
        </div>
      `;
    });
  });
  return `
    <div class="card plan-card${isActive?' active-plan':''}">
      <div class="plan-header" style="cursor:pointer">
        <div style="flex:1;min-width:0">
          <div class="card-title">${pd.name}</div>
          <div class="card-desc">${pd.description}</div>
          <div class="plan-badges">
            <span class="badge badge-outline">${pd.durationWeeks} weeks</span>
            <span class="badge badge-outline">${pd.sessionsPerWeek}x/week</span>
            <span class="badge" style="background:${tierColor}22;color:${tierColor}">${capitalize(plan.tier)}</span>
            ${isActive ? '<span class="badge badge-primary">Active</span>' : ''}
          </div>
          <button class="plan-explain-btn" data-explain-plan="${plan.id}" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 1 8 8c0 3.1-1.7 5.8-4.3 7.1L12 22l-3.7-4.9A8 8 0 0 1 12 2z"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg>
            Explain Plan
          </button>
        </div>
        <div class="plan-actions">
          <svg class="plan-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="plan-schedule" style="display:none">
        ${scheduleHtml}
        <div class="plan-activate" style="padding:0 14px 14px">
          ${isActive ? `
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary" style="flex:1;pointer-events:none;opacity:0.7">✓ Active</button>
              <button class="btn plan-cancel-btn" style="flex:1;color:#ef4444;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08)" data-plan-id="${plan.id}">Cancel Plan</button>
            </div>
          ` : `
            <button class="btn btn-primary plan-activate-btn" style="width:100%" data-plan-id="${plan.id}">Activate Plan</button>
          `}
        </div>
      </div>
    </div>
  `;
}
function renderRaces() {
  const c = $('races-content');
  let html = '<div class="page-title">Upcoming Races</div><div class="space-y">';
  const racesData = getActiveRaces();
  racesData.forEach(race => {
    const raceDate = new Date(race.date + 'T09:00:00+10:00'); // AEST
    const now = new Date();
    const isPast = raceDate < now;
    html += `
      <div class="card race-card">
        <div class="card-pad">
          <div class="race-top">
            <div style="flex:1;min-width:0">
              <div class="race-name">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                ${race.name}
              </div>
              <div class="race-meta">
                <span class="race-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${race.location}</span>
                <span class="race-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg> ${race.distance} km</span>
                <span class="race-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${formatRaceDate(race.date)}</span>
              </div>
            </div>
            ${isPast ? '<span class="badge badge-complete">Race Complete</span>' : ''}
          </div>
          ${!isPast ? `<div class="countdown-grid" data-race-date="${race.date}"></div>` : ''}
          <div class="race-notes">${race.notes}</div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  c.innerHTML = html;
  updateCountdowns();
  if (raceTimerInterval) clearInterval(raceTimerInterval);
  raceTimerInterval = setInterval(updateCountdowns, 1000);
}
function updateCountdowns() {
  document.querySelectorAll('.countdown-grid[data-race-date]').forEach(el => {
    const raceDate = new Date(el.dataset.raceDate + 'T09:00:00+10:00');
    const now = new Date();
    const diff = raceDate - now;
    if (diff <= 0) {
      el.innerHTML = '<span class="badge badge-complete">Race Started!</span>';
      return;
    }
    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const mins = Math.floor((diff % (1000*60*60)) / (1000*60));
    const secs = Math.floor((diff % (1000*60)) / 1000);
    el.innerHTML = `
      <div class="time-unit"><div class="time-unit-box">${String(days).padStart(2,'0')}</div><div class="time-unit-label">Days</div></div>
      <span class="countdown-sep">:</span>
      <div class="time-unit"><div class="time-unit-box">${String(hours).padStart(2,'0')}</div><div class="time-unit-label">Hours</div></div>
      <span class="countdown-sep">:</span>
      <div class="time-unit"><div class="time-unit-box">${String(mins).padStart(2,'0')}</div><div class="time-unit-label">Min</div></div>
      <span class="countdown-sep">:</span>
      <div class="time-unit"><div class="time-unit-box">${String(secs).padStart(2,'0')}</div><div class="time-unit-label">Sec</div></div>
    `;
  });
}
function formatRaceDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'});
}
function generateTeamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}
function renderTeam() {
  // Update sub-tab styling
  document.querySelectorAll('.lb-sub-tab').forEach(btn => {
    const isActive = btn.dataset.lbSub === lbSubTab;
    btn.style.background = isActive ? 'var(--primary)' : 'var(--secondary)';
    btn.style.color = isActive ? 'var(--primary-fg)' : 'var(--secondary-fg)';
  });
  const gc = $('lb-global-content');
  const tc = $('lb-team-content');
  gc.style.display = 'none';
  tc.style.display = 'none';
  if (lbSubTab === 'global') {
    gc.style.display = '';
    renderGlobalLeaderboard(gc);
  } else {
    tc.style.display = '';
    renderTeamTab(tc);
  }
}
// --- GLOBAL LEADERBOARD ---
async function loadGlobalLeaderboard() {
  if (demoMode) {
    globalLeaderboard = [
      { uid: 'demo', displayName: userProfile?.displayName || 'You', yearLevel: userProfile?.yearLevel || 'Y10', totalWorkouts: userWorkouts.length, streak: 0, xp: calcXp() },
      { uid: 'd1', displayName: 'Alex M.', yearLevel: 'Y11', totalWorkouts: 34, streak: 7, xp: 365 },
      { uid: 'd2', displayName: 'Sam K.', yearLevel: 'Y10', totalWorkouts: 28, streak: 5, xp: 280 },
      { uid: 'd3', displayName: 'Jordan T.', yearLevel: 'Y12', totalWorkouts: 22, streak: 3, xp: 220 },
      { uid: 'd4', displayName: 'Riley W.', yearLevel: 'Y9', totalWorkouts: 19, streak: 4, xp: 190 },
      { uid: 'd5', displayName: 'Chris B.', yearLevel: 'Y10', totalWorkouts: 15, streak: 2, xp: 150 },
      { uid: 'd6', displayName: 'Pat H.', yearLevel: 'Y11', totalWorkouts: 12, streak: 1, xp: 120 },
      { uid: 'd7', displayName: 'Taylor R.', yearLevel: 'Y8', totalWorkouts: 9, streak: 0, xp: 90 },
    ];
    globalLbLoading = false;
    return;
  }
  if (!db) return;
  globalLbLoading = true;
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const entries = [];
    for (const d of usersSnap.docs) {
      const u = d.data();
      let wCount = 0;
      try {
        const wSnap = await getDocs(collection(db, 'users', d.id, 'workouts'));
        wCount = wSnap.size;
      } catch(e) {}
      // Calculate streak
      let streak = 0;
      try {
        const wSnap2 = await getDocs(collection(db, 'users', d.id, 'workouts'));
        const dates = new Set();
        wSnap2.docs.forEach(wd => {
          const dd = wd.data().date;
          const dt = dd ? (dd.toDate ? dd.toDate() : new Date(dd)) : null;
          if (dt) dates.add(dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate());
        });
        const check = new Date(); check.setHours(0,0,0,0);
        let todayKey = check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate();
        if (!dates.has(todayKey)) check.setDate(check.getDate()-1);
        while (dates.has(check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate())) {
          streak++; check.setDate(check.getDate()-1);
        }
      } catch(e) {}
      // Estimate XP from available data
      let xp = wCount * 10; // 10 per workout
      if (streak >= 7) xp += 25;
      if (streak >= 14) xp += 50;
      if (streak >= 30) xp += 100;
      entries.push({
        uid: d.id,
        displayName: u.displayName || 'Unknown',
        yearLevel: u.yearLevel || '',
        totalWorkouts: wCount,
        streak,
        xp
      });
    }
    globalLeaderboard = entries;
  } catch(e) {
    console.error('Load global leaderboard error:', e);
  }
  globalLbLoading = false;
}
function renderGlobalLeaderboard(el) {
  if (globalLbLoading) {
    el.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    return;
  }
  if (globalLeaderboard.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    loadGlobalLeaderboard().then(() => renderGlobalLeaderboard(el));
    return;
  }
  const sorted = [...globalLeaderboard].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const myUid = currentUser?.uid;
  // Override my own XP with accurate calculation
  const myEntry = sorted.find(u => u.uid === myUid);
  if (myEntry) { myEntry.xp = calcXp(); }
  sorted.sort((a, b) => (b.xp || 0) - (a.xp || 0));
  // Find my rank
  const myIdx = sorted.findIndex(u => u.uid === myUid);
  const myRank = myIdx >= 0 ? myIdx + 1 : null;
  let html = '';
  // Podium: top 3
  if (sorted.length >= 3) {
    html += '<div class="lb-podium">';
    // 2nd place
    const s = sorted[1]; const sLvl = getXpLevel(s.xp || 0);
    html += `<div class="lb-podium-item lb-podium-2${s.uid === myUid ? ' lb-podium-me' : ''}">
      <div class="lb-podium-rank">2</div>
      <div class="lb-podium-avatar">${(s.displayName || '?')[0].toUpperCase()}</div>
      <div class="lb-podium-name">${escHtml(s.displayName)}</div>
      <div class="lb-podium-stat">${sLvl.icon} ${s.xp || 0} XP</div>
    </div>`;
    // 1st place
    const f = sorted[0]; const fLvl = getXpLevel(f.xp || 0);
    html += `<div class="lb-podium-item lb-podium-1${f.uid === myUid ? ' lb-podium-me' : ''}">
      <div class="lb-podium-crown"><svg viewBox="0 0 24 24" fill="var(--primary)" stroke="none"><path d="M2.5 18.5l3-8 4.5 5 2-9 2 9 4.5-5 3 8z"/></svg></div>
      <div class="lb-podium-avatar lb-podium-avatar-1">${(f.displayName || '?')[0].toUpperCase()}</div>
      <div class="lb-podium-name">${escHtml(f.displayName)}</div>
      <div class="lb-podium-stat">${fLvl.icon} ${f.xp || 0} XP</div>
    </div>`;
    // 3rd place
    const t = sorted[2]; const tLvl = getXpLevel(t.xp || 0);
    html += `<div class="lb-podium-item lb-podium-3${t.uid === myUid ? ' lb-podium-me' : ''}">
      <div class="lb-podium-rank">3</div>
      <div class="lb-podium-avatar">${(t.displayName || '?')[0].toUpperCase()}</div>
      <div class="lb-podium-name">${escHtml(t.displayName)}</div>
      <div class="lb-podium-stat">${tLvl.icon} ${t.xp || 0} XP</div>
    </div>`;
    html += '</div>';
  }
  // My rank card
  if (myRank) {
    html += `<div class="lb-my-rank">
      <span style="color:var(--muted-fg)">Your rank</span>
      <span style="font-size:20px;font-weight:800;color:var(--primary);font-variant-numeric:tabular-nums">#${myRank}</span>
      <span style="color:var(--muted-fg)">of ${sorted.length}</span>
    </div>`;
  }
  // Rest of the table (4th place onwards, or all if < 3)
  const startIdx = sorted.length >= 3 ? 3 : 0;
  if (sorted.length > startIdx) {
    html += '<div class="card" style="overflow:hidden;margin-top:12px"><table class="lb-table">';
    html += '<thead><tr><th class="lb-rank">#</th><th>Name</th><th>Level</th><th style="text-align:right">XP</th><th style="text-align:right">Streak</th></tr></thead><tbody>';
    sorted.slice(startIdx).forEach((m, i) => {
      const rank = startIdx + i + 1;
      const isMe = m.uid === myUid;
      const mLvl = getXpLevel(m.xp || 0);
      html += `<tr class="${isMe ? 'lb-me' : ''}">
        <td class="lb-rank">${rank}</td>
        <td class="lb-name">${escHtml(m.displayName)}</td>
        <td class="lb-year">${mLvl.icon} ${mLvl.name}</td>
        <td class="lb-stat" style="text-align:right">${m.xp || 0}</td>
        <td class="lb-stat" style="text-align:right">${m.streak || 0}d</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }
  // Refresh button
  html += `<div style="text-align:center;margin-top:16px"><button class="btn btn-secondary" id="lb-refresh-btn" style="font-size:12px;padding:8px 20px">Refresh Leaderboard</button></div>`;
  el.innerHTML = html;
  const refreshBtn = $('lb-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = 'Loading...';
      refreshBtn.disabled = true;
      globalLeaderboard = [];
      await loadGlobalLeaderboard();
      renderGlobalLeaderboard(el);
    });
  }
}
// --- TEAM TAB (your team sub-tab) ---
function renderTeamTab(c) {
  let html = '';
  if (teamLoading) {
    html += '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    c.innerHTML = html;
    return;
  }
  const hasTeam = userProfile?.teamId && teamData;
  if (!hasTeam) {
    html += `
      <div class="team-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <div class="team-empty-title">Join or Create a Team</div>
        <div class="team-empty-desc">Compete with your squad on a private leaderboard.</div>
        <div class="team-btn-group">
          <button class="btn btn-primary" id="team-create-btn">Create Team</button>
          <button class="btn btn-secondary" id="team-join-btn">Join Team</button>
        </div>
      </div>
    `;
    c.innerHTML = html;
    $('team-create-btn').addEventListener('click', openCreateTeamSheet);
    $('team-join-btn').addEventListener('click', openJoinTeamSheet);
    return;
  }
  // Team header
  html += `
    <div class="team-hero">
      <div class="team-hero-title">${escHtml(teamData.name)}</div>
      <div class="team-hero-code">
        <span>${teamData.code}</span>
        <button id="copy-code-btn" aria-label="Copy code">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      <div class="team-hero-members">${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''}</div>
    </div>
  `;
  // Team leaderboard table
  const sorted = [...teamMembers].sort((a, b) => (b.totalWorkouts || 0) - (a.totalWorkouts || 0));
  html += '<div class="card" style="overflow:hidden"><table class="lb-table">';
  html += '<thead><tr><th class="lb-rank">#</th><th>Name</th><th>Year</th><th style="text-align:right">Workouts</th><th style="text-align:right">Streak</th></tr></thead><tbody>';
  sorted.forEach((m, i) => {
    const isMe = m.uid === currentUser?.uid;
    const rankClass = i === 0 ? ' lb-rank-1' : '';
    html += `<tr class="${isMe ? 'lb-me' : ''}">
      <td class="lb-rank${rankClass}">${i + 1}</td>
      <td class="lb-name">${escHtml(m.displayName || 'Unknown')}</td>
      <td class="lb-year">${m.yearLevel || '—'}</td>
      <td class="lb-stat" style="text-align:right">${m.totalWorkouts || 0}</td>
      <td class="lb-stat" style="text-align:right">${m.streak || 0}d</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  // Leave team
  html += '<div style="text-align:center;margin-top:16px"><button class="leave-team-btn" id="leave-team-btn">Leave Team</button></div>';
  c.innerHTML = html;
  // Bind copy
  $('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(teamData.code).catch(() => {});
    const btn = $('copy-code-btn');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(() => {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    }, 1500);
  });
  // Bind leave
  $('leave-team-btn').addEventListener('click', leaveTeam);
}
// Bind leaderboard sub-tabs
document.querySelectorAll('.lb-sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    haptic('light');
    lbSubTab = btn.dataset.lbSub;
    renderTeam();
  });
});
// --- Theme ---
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.classList.toggle('light-theme', currentTheme === 'light');
  try { localStorage.setItem('vf_theme', currentTheme); } catch(e) {}
  renderProfile(); // Re-render to update toggle state
}
// --- Profile Page ---
$('profile-menu-btn')?.addEventListener('click', () => {
  closeUserMenu();
  openProfile();
});
$('profile-close-btn')?.addEventListener('click', closeProfile);
function openProfile() {
  $('profile-overlay').style.display = 'flex';
  renderProfile();
}
function closeProfile() {
  $('profile-overlay').style.display = 'none';
}
function renderProfile() {
  const el = $('profile-body');
  const name = userProfile?.displayName || currentUser?.displayName || 'Unknown';
  const email = currentUser?.email || '';
  const year = userProfile?.yearLevel || '—';
  const tier = capitalize(userProfile?.fitnessLevel || 'basic');
  const initial = name.charAt(0).toUpperCase();
  const isStravaConnected = !!(stravaTokens && stravaTokens.access_token);
  let html = `
    <div class="profile-avatar-big">${initial}</div>
    <div class="profile-name-big">${escHtml(name)}</div>
    <div class="profile-meta">${escHtml(email)}</div>
  `;
  // Account section
  html += '<div class="profile-section"><div class="profile-section-title">Account</div>';
  html += `<div class="profile-row">
    <span class="profile-row-label">Display Name</span>
    <span class="profile-row-action" id="profile-edit-name">Edit</span>
  </div>`;
  html += `<div class="profile-row">
    <span class="profile-row-label">Year Level</span>
    <span class="profile-row-value">${year}</span>
    <span class="profile-row-action" id="profile-edit-year">Change</span>
  </div>`;
  html += `<div class="profile-row">
    <span class="profile-row-label">Fitness Tier</span>
    <span class="profile-row-value">${tier}</span>
    <span class="profile-row-action" id="profile-edit-tier">Change</span>
  </div>`;
  html += '</div>';
  // Appearance
  html += '<div class="profile-section"><div class="profile-section-title">Appearance</div>';
  html += `<div class="profile-row">
    <span class="profile-row-label">Light Mode</span>
    <div class="theme-toggle${currentTheme === 'light' ? ' on' : ''}" id="theme-toggle-btn">
      <div class="theme-toggle-knob"></div>
    </div>
  </div>`;
  html += '</div>';
  // Admin Demo Mode (only visible to admins)
  if (isAdmin) {
    const studentView = localStorage.getItem('vf_student_view') === 'true';
    html += '<div class="profile-section"><div class="profile-section-title">Admin</div>';
    html += `<div class="profile-row">
      <div>
        <span class="profile-row-label">Student View</span>
        <div style="font-size:10px;color:var(--muted-fg);margin-top:2px">Hide Admin tab to preview student experience</div>
      </div>
      <div class="theme-toggle${studentView ? ' on' : ''}" id="student-view-toggle">
        <div class="theme-toggle-knob"></div>
      </div>
    </div>`;
    html += '</div>';
  }
  // Strava
  html += '<div class="profile-section"><div class="profile-section-title">Strava Integration</div>';
  if (isStravaConnected) {
    const athlete = stravaTokens.athlete || {};
    html += `<div class="strava-status">
      <div class="strava-status-dot connected"></div>
      Connected as <strong>${escHtml(athlete.firstname || '')} ${escHtml(athlete.lastname || '')}</strong>
    </div>`;
    html += `<div class="strava-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13px;font-weight:600">Recent Activities</span>
        <button class="strava-import-btn" id="strava-sync-btn">Sync Now</button>
      </div>
      <div id="strava-activities-list"></div>
    </div>`;
    html += `<button class="strava-disconnect" id="strava-disconnect-btn">Disconnect Strava</button>`;
    html += `<button class="strava-disconnect" id="strava-resync-routes" style="margin-top:6px;background:var(--surface-alt);color:var(--text);border:1px solid var(--border)">🗺️ Re-sync Route Maps</button>`;
    html += `<div style="font-size:11px;color:var(--muted-fg);margin-top:4px">Re-downloads GPS routes for all Strava activities. Use if maps are missing.</div>`;
    // Strava Clubs
    const stravaClubs = userProfile?.stravaClubs || [];
    if (stravaClubs.length > 0) {
      html += `<div style="margin-top:12px"><div style="font-size:13px;font-weight:600;margin-bottom:6px">Your Strava Clubs</div>`;
      stravaClubs.forEach(club => {
        const isLinked = teamData?.stravaClubId === String(club.id);
        const isCurrentTeam = userProfile?.teamId && isLinked;
        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--card);border:1px solid ${isCurrentTeam ? 'var(--primary)' : 'var(--border)'};border-radius:8px;margin-bottom:6px">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(252,82,0,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="#fc5200" style="width:16px;height:16px"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(club.name)}</div>
            <div style="font-size:11px;color:var(--muted-fg)">${club.memberCount || '?'} members · ${club.sportType || 'cycling'}</div>
          </div>
          ${isCurrentTeam
            ? '<span style="font-size:10px;font-weight:700;color:var(--primary);background:rgba(191,255,0,.12);padding:3px 8px;border-radius:6px;white-space:nowrap">Your Team</span>'
            : `<button class="btn strava-club-join" data-club-id="${club.id}" data-club-name="${escHtml(club.name)}" style="padding:4px 10px;font-size:11px;font-weight:600;border-radius:6px;background:var(--surface-alt);color:var(--text);border:1px solid var(--border);white-space:nowrap">Use as Team</button>`
          }
        </div>`;
      });
      html += '</div>';
    } else {
      html += `<div style="margin-top:8px"><button class="btn" id="strava-fetch-clubs" style="width:100%;padding:8px;font-size:12px;background:var(--surface-alt);color:var(--text);border:1px solid var(--border);border-radius:8px">🔍 Find My Strava Clubs</button></div>`;
    }
  } else {
    html += `<div class="strava-status">
      <div class="strava-status-dot disconnected"></div>
      Not connected
    </div>`;
    if (!STRAVA_CLIENT_ID) {
      html += '<div style="font-size:12px;color:var(--muted-fg);margin-top:6px">Strava integration requires setup. Add your Strava Client ID in the app config.</div>';
    } else {
      html += `<button class="strava-connect" id="strava-connect-btn">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
        Connect with Strava
      </button>`;
    }
    html += '<div style="font-size:11px;color:var(--muted-fg);margin-top:8px">Import your rides and activities automatically. Your Strava data stays in your account.</div>';
  }
  html += '</div>';
  // Stats
  html += `<div class="profile-section"><div class="profile-section-title">Your Stats</div>
    <div class="profile-row"><span class="profile-row-label">Total Workouts</span><span class="profile-row-value">${userWorkouts.length}</span></div>
    <div class="profile-row"><span class="profile-row-label">Member Since</span><span class="profile-row-value">${userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString('en-AU',{month:'short',year:'numeric'}) : '—'}</span></div>
    <button class="export-btn" id="profile-export-btn" style="width:100%">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export Training Report
    </button>
  </div>`;
  // Help & Tutorial
  html += '<div class="profile-section"><div class="profile-section-title">Health &amp; Wearable Sync</div>';
  const syncToken = userProfile?.syncToken || null;
  html += `<div style="font-size:12px;color:var(--muted-fg);line-height:1.5;margin-bottom:8px">
    Connect your wearable to automatically sync workouts, heart rate, steps, and sleep.
  </div>
  <div style="font-size:12px;color:var(--muted-fg);line-height:1.6;padding:8px 12px;background:var(--surface-alt);border-radius:8px;margin-bottom:8px">
    <strong style="color:var(--text)">Option 1: Via Strava (easiest)</strong><br>
    Apple Watch, Garmin, Fitbit all sync to Strava. Connect Strava above and workouts flow in automatically.
  </div>
  <div style="font-size:12px;color:var(--muted-fg);line-height:1.6;padding:8px 12px;background:var(--surface-alt);border-radius:8px;margin-bottom:8px">
    <strong style="color:var(--text)">Option 2: Apple Shortcut (live HR during workouts)</strong><br>
    Your coach shares a Shortcut link. Tap to add it, paste your token below. It auto-runs when you start an Apple Watch workout and syncs heart rate every 5 seconds. Steps and sleep sync daily at 8am.
  </div>`;
  if (syncToken) {
    html += `<div style="padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:4px">Your Sync Token</div>
      <div style="font-size:11px;font-family:monospace;color:var(--primary);word-break:break-all;margin-bottom:4px">${escHtml(syncToken)}</div>
      <div style="font-size:10px;color:var(--muted-fg);margin-bottom:6px">Paste this into your Apple Shortcut when prompted.</div>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button id="copy-sync-token" style="flex:1;font-size:11px;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-alt);color:var(--text);cursor:pointer">Copy Token</button>
        <button id="test-sync-token" style="flex:1;font-size:11px;padding:6px 10px;border-radius:6px;border:1px solid var(--primary);background:rgba(191,255,0,.1);color:var(--primary);cursor:pointer">Test Sync</button>
      </div>
      <button id="install-shortcut-workout" style="width:100%;font-size:12px;font-weight:600;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#ef4444,#f87171);color:#fff;cursor:pointer;margin-bottom:6px">❤️ Install Workout Shortcut (live HR)</button>
      <button id="install-shortcut-daily" style="width:100%;font-size:12px;font-weight:600;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#3b82f6,#60a5fa);color:#fff;cursor:pointer">😴 Install Daily Sync (steps + sleep)</button>
    </div>`;
  } else {
    html += `<button id="generate-sync-token" style="width:100%;padding:10px;font-size:12px;font-weight:600;border-radius:8px;border:1px solid var(--border);background:var(--surface-alt);color:var(--text);cursor:pointer;margin-bottom:8px">Generate Sync Token</button>`;
  }
  // Show latest health data if available
  const health = userProfile?.health;
  if (health) {
    const healthItems = [];
    if (health.latestHr) healthItems.push('❤️ ' + health.latestHr + ' bpm');
    if (health.latestSteps) healthItems.push('👟 ' + health.latestSteps.toLocaleString() + ' steps');
    if (health.latestSleep) healthItems.push('😴 ' + health.latestSleep + 'h sleep');
    if (health.restingHr) healthItems.push('💓 ' + health.restingHr + ' resting');
    if (health.vo2max) healthItems.push('🫁 VO2 ' + health.vo2max);
    if (healthItems.length > 0) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">';
      healthItems.forEach(item => { html += '<span style="font-size:11px;padding:3px 8px;border-radius:6px;background:var(--surface-alt);color:var(--text)">' + item + '</span>'; });
      html += '</div>';
      if (health.lastSync) html += '<div style="font-size:10px;color:var(--muted-fg);margin-top:2px">Last sync: ' + timeAgo(new Date(health.lastSync)) + '</div>';
    }
  }
  html += '</div>';
  html += '<div class="profile-section"><div class="profile-section-title">Help</div>';
  html += `<div class="profile-row" id="profile-redo-tutorial" style="cursor:pointer">
    <span class="profile-row-label">🎓 App Tour</span>
    <span class="profile-row-action">Redo Tutorial</span>
  </div>`;
  html += `<div class="profile-row" id="profile-open-coach" style="cursor:pointer">
    <span class="profile-row-label">🤖 AI Coach</span>
    <span class="profile-row-action">Ask a Question</span>
  </div>`;
  if (errorLog.length > 0) {
    html += `<div class="profile-row" id="profile-error-log" style="cursor:pointer">
      <span class="profile-row-label">🐛 Error Log</span>
      <span class="profile-row-action">${errorLog.length} recent</span>
    </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
  // Bindings
  $('theme-toggle-btn')?.addEventListener('click', toggleTheme);
  $('student-view-toggle')?.addEventListener('click', () => {
    const current = localStorage.getItem('vf_student_view') === 'true';
    const newVal = !current;
    localStorage.setItem('vf_student_view', String(newVal));
    // Update admin tab visibility
    const adminTab = document.getElementById('admin-tab');
    if (adminTab) adminTab.style.display = newVal ? 'none' : '';
    // Update toggle visual directly (no re-render)
    const toggle = $('student-view-toggle');
    if (toggle) {
      if (newVal) toggle.classList.add('on');
      else toggle.classList.remove('on');
    }
    // If switching to student view while on admin page, go to today
    if (newVal && currentPage === 'admin') {
      closeProfile();
      setTimeout(() => switchPage('today'), 100);
    }
    showToast(newVal ? 'Student view — Admin tab hidden' : 'Admin view restored', 'info');
  });
  $('profile-edit-name')?.addEventListener('click', () => {
    showEditModal('Edit Display Name', 'modal-name', name, (val) => {
      updateProfileField('displayName', val);
    });
  });
  $('profile-edit-year')?.addEventListener('click', () => {
    showSelectModal('Change Year Level', [
      {value:'Y7',label:'Year 7'},{value:'Y8',label:'Year 8'},{value:'Y9',label:'Year 9'},
      {value:'Y10',label:'Year 10'},{value:'Y11',label:'Year 11'},{value:'Y12',label:'Year 12'}
    ], year, (val) => updateProfileField('yearLevel', val));
  });
  $('profile-edit-tier')?.addEventListener('click', () => {
    showSelectModal('Change Fitness Tier', [
      {value:'basic',label:'Basic — Starting out'},{value:'average',label:'Average — Solid base'},
      {value:'intense',label:'Intense — Competitive'}
    ], userProfile?.fitnessLevel || 'basic', (val) => updateProfileField('fitnessLevel', val));
  });
  $('strava-connect-btn')?.addEventListener('click', stravaStartAuth);
  $('strava-disconnect-btn')?.addEventListener('click', stravaDisconnect);
  $('strava-sync-btn')?.addEventListener('click', () => {
    stravaFetchActivities().then(() => renderStravaActivities());
  });
  $('strava-resync-routes')?.addEventListener('click', () => {
    stravaResyncRoutes();
  });
  // Strava club → team buttons
  document.querySelectorAll('.strava-club-join').forEach(btn => {
    btn.addEventListener('click', async () => {
      const clubId = btn.dataset.clubId;
      const clubName = btn.dataset.clubName;
      btn.textContent = 'Joining...';
      btn.disabled = true;
      try {
        // Use predictable doc ID: strava-club-{clubId}
        const teamDocId = 'strava-club-' + clubId;
        const teamRef = doc(db, 'teams', teamDocId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          // Team exists — join it
          const td = teamSnap.data();
          if (!(td.members || []).includes(currentUser.uid)) {
            await updateDoc(teamRef, { members: arrayUnion(currentUser.uid) });
          }
        } else {
          // Create new team with predictable ID
          const code = (() => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random()*c.length)]; return r; })();
          await setDoc(teamRef, {
            name: clubName, code, stravaClubId: String(clubId), stravaClubName: clubName,
            createdBy: currentUser.uid, createdAt: serverTimestamp(), members: [currentUser.uid]
          });
        }
        // Leave old team if different
        if (userProfile.teamId && userProfile.teamId !== teamDocId) {
          try { await updateDoc(doc(db, 'teams', userProfile.teamId), { members: arrayRemove(currentUser.uid) }); } catch(e) {}
        }
        await updateDoc(doc(db, 'users', currentUser.uid), { teamId: teamDocId, teamName: clubName });
        userProfile.teamId = teamDocId;
        userProfile.teamName = clubName;
        // Reload team data
        await loadTeamData();
        showToast('Team set to "' + clubName + '"!', 'success');
        renderProfile();
      } catch(e) {
        console.error('Club join error:', e);
        showError('Failed to set team from Strava club', 'strava', e, { action: 'club-join' });
        btn.textContent = 'Use as Team';
        btn.disabled = false;
      }
    });
  });
  // Fetch clubs button (if clubs not yet loaded)
  $('strava-fetch-clubs')?.addEventListener('click', async () => {
    const btn = $('strava-fetch-clubs');
    btn.textContent = 'Searching...';
    btn.disabled = true;
    try {
      // Import syncStravaClubs dynamically — it fetches and saves clubs
      const { syncStravaClubs } = await import('./strava.js');
      await syncStravaClubs();
      renderProfile();
    } catch(e) {
      showError('Failed to fetch Strava clubs', 'strava', e, { action: 'fetch-clubs' });
      btn.textContent = '🔍 Find My Strava Clubs';
      btn.disabled = false;
    }
  });
  $('profile-export-btn')?.addEventListener('click', exportTrainingReport);
  // Tutorial & Help bindings
  // Health sync token
  $('generate-sync-token')?.addEventListener('click', async () => {
    const token = crypto.randomUUID ? crypto.randomUUID() : 'vf-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    if (!demoMode && db && currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { syncToken: token });
        userProfile.syncToken = token;
        showToast('Sync token generated!', 'success');
        renderProfile();
      } catch(e) { showToast('Failed to generate token.', 'error'); }
    } else {
      userProfile.syncToken = token;
      renderProfile();
    }
  });
  $('copy-sync-token')?.addEventListener('click', () => {
    const token = userProfile?.syncToken;
    if (token) {
      navigator.clipboard?.writeText(token).then(() => showToast('Token copied!', 'success')).catch(() => showToast('Copy failed — tap and hold to copy manually.', 'warn'));
    }
  });
  $('test-sync-token')?.addEventListener('click', async () => {
    const token = userProfile?.syncToken;
    if (!token) return showToast('No token generated.', 'error');
    const btn = $('test-sync-token');
    btn.textContent = 'Testing...';
    btn.disabled = true;
    try {
      const resp = await fetch('https://turboprep.netlify.app/.netlify/functions/health-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          secret: 'vf-health-8k3mP9xR2nQ7',
          type: 'heart_rate',
          data: { bpm: 72, timestamp: new Date().toISOString() }
        })
      });
      const result = await resp.json();
      if (result.success) {
        showToast('Sync works! Test heart rate sent.', 'success');
        btn.textContent = '✓ Working';
        btn.style.color = '#22c55e';
        btn.style.borderColor = '#22c55e';
      } else {
        showToast('Sync failed: ' + (result.error || 'Unknown error'), 'error');
        btn.textContent = '✗ Failed';
        btn.style.color = '#ef4444';
      }
    } catch(e) {
      showToast('Network error: ' + e.message, 'error');
      btn.textContent = '✗ Error';
      btn.style.color = '#ef4444';
    }
    setTimeout(() => { btn.textContent = 'Test Sync'; btn.disabled = false; btn.style.color = ''; btn.style.borderColor = ''; }, 5000);
  });
  $('install-shortcut-workout')?.addEventListener('click', () => {
    const token = userProfile?.syncToken;
    if (!token) return showToast('Generate a sync token first.', 'warn');
    navigator.clipboard?.writeText(token).then(() => {
      showToast('Token copied! Paste when the Shortcut asks for it.', 'success');
    }).catch(() => {});
    setTimeout(() => {
      window.open('https://www.icloud.com/shortcuts/88fcd11cf7f5473eaf74d111df3b3d8c', '_blank');
    }, 800);
  });
  $('install-shortcut-daily')?.addEventListener('click', () => {
    const token = userProfile?.syncToken;
    if (!token) return showToast('Generate a sync token first.', 'warn');
    navigator.clipboard?.writeText(token).then(() => {
      showToast('Token copied! Paste when the Shortcut asks for it.', 'success');
    }).catch(() => {});
    setTimeout(() => {
      window.open('https://www.icloud.com/shortcuts/b38cfdbdd64f4aecbc495776cfe355ed', '_blank');
    }, 800);
  });
  $('profile-redo-tutorial')?.addEventListener('click', () => {
    closeProfile();
    try { localStorage.removeItem('vf_tutorial_seen'); } catch(e) {}
    setTimeout(() => showTutorial(), 300);
  });
  $('profile-open-coach')?.addEventListener('click', () => {
    closeProfile();
    setTimeout(() => openAiCoach(), 300);
  });
  $('profile-error-log')?.addEventListener('click', () => {
    if (errorLog.length === 0) { showToast('No errors recorded.', 'info'); return; }
    openErrorDiagnostics(errorLog[0]);
  });
  if (isStravaConnected) renderStravaActivities();
}
async function updateProfileField(field, value) {
  if (!currentUser) return;
  userProfile[field] = value;
  if (field === 'displayName' && updateProfile) {
    try { await updateProfile(currentUser, { displayName: value }); } catch(e) {}
  }
  if (!demoMode && db) {
    try { await updateDoc(doc(db, 'users', currentUser.uid), { [field]: value }); } catch(e) { console.error(e); }
  }
  // Update header avatar
  if (field === 'displayName') {
    $('user-avatar-btn').textContent = value.charAt(0).toUpperCase();
    $('menu-name').textContent = value;
  }
  renderProfile();
}
function openCreateTeamSheet() {
  $('sheet-content').innerHTML = `
    <div class="sheet-title">Create Team</div>
    <div class="form-group">
      <label class="label" for="team-name-input">Team Name</label>
      <input class="input" type="text" id="team-name-input" placeholder="e.g. Lightning Bolts" maxlength="30">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="team-create-save">Create Team</button>
  `;
  openSheet();
  $('team-create-save').addEventListener('click', createTeam);
}
function openJoinTeamSheet() {
  $('sheet-content').innerHTML = `
    <div class="sheet-title">Join Team</div>
    <div class="form-group">
      <label class="label" for="team-code-input">Team Code</label>
      <input class="input" type="text" id="team-code-input" placeholder="e.g. LGT2026" maxlength="6" style="text-transform:uppercase;letter-spacing:.1em;font-family:var(--font-mono)">
    </div>
    <div id="join-team-error" class="auth-error hidden"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="team-join-save">Join Team</button>
  `;
  openSheet();
  $('team-join-save').addEventListener('click', joinTeam);
}
async function createTeam() {
  const name = $('team-name-input').value.trim();
  if (!name) { showToast('Please enter a team name.', 'warn'); return; }
  if (!currentUser) return;
  closeSheet();
  const code = generateTeamCode();
  if (demoMode) {
    const tid = 'demo-team-' + Date.now();
    teamData = { id: tid, name, code, members: [currentUser.uid] };
    userProfile.teamId = tid;
    userProfile.teamName = name;
    teamMembers = [{
      uid: currentUser.uid,
      displayName: userProfile.displayName,
      yearLevel: userProfile.yearLevel,
      fitnessLevel: userProfile.fitnessLevel,
      activePlanId: userProfile.activePlanId,
      totalWorkouts: userWorkouts.length,
      streak: 0,
      checklistPct: 0
    }];
    showToast('Team "' + name + '" created! Code: ' + code, 'success');
    lbSubTab = 'team';
    renderTeam();
    return;
  }
  if (!db) return;
  showLoading('Creating team...');
  try {
    const teamRef = await addDoc(collection(db, 'teams'), {
      name,
      code,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      members: [currentUser.uid]
    });
    await updateDoc(doc(db, 'users', currentUser.uid), {
      teamId: teamRef.id,
      teamName: name
    });
    userProfile.teamId = teamRef.id;
    userProfile.teamName = name;
    await loadTeamData();
    hideLoading();
    showToast('Team "' + name + '" created! Share code: ' + code, 'success');
    lbSubTab = 'team';
    renderTeam();
  } catch(e) {
    hideLoading();
    console.error('Create team error:', e);
    showError('Failed to create team', 'team', e, { action: 'create' });
  }
}
async function joinTeam() {
  const code = $('team-code-input').value.trim().toUpperCase();
  if (!code || code.length < 4) {
    $('join-team-error').textContent = 'Please enter a valid team code.';
    show('join-team-error');
    return;
  }
  if (!currentUser) return;
  if (demoMode) {
    $('join-team-error').textContent = 'Teams require an account. Exit demo mode to use teams.';
    show('join-team-error');
    return;
  }
  if (!db) return;
  hide('join-team-error');
  closeSheet();
  showLoading('Joining team...');
  try {
    const q2 = query(collection(db, 'teams'), where('code', '==', code));
    const snap = await getDocs(q2);
    if (snap.empty) {
      hideLoading();
      showToast('Team not found. Check the code.', 'error');
      return;
    }
    const teamDoc = snap.docs[0];
    const tid = teamDoc.id;
    const tData = teamDoc.data();
    await updateDoc(doc(db, 'teams', tid), { members: arrayUnion(currentUser.uid) });
    await updateDoc(doc(db, 'users', currentUser.uid), { teamId: tid, teamName: tData.name });
    userProfile.teamId = tid;
    userProfile.teamName = tData.name;
    await loadTeamData();
    hideLoading();
    showToast('Joined "' + tData.name + '"!', 'success');
    lbSubTab = 'team';
    renderTeam();
  } catch(e) {
    hideLoading();
    console.error('Join team error:', e);
    if (e.code === 'permission-denied' || (e.message || '').includes('permission')) {
      showError('Team join blocked by database rules', 'team', e, { action: 'join', hint: 'Firestore rules need to be deployed. Go to Firebase Console → Firestore → Rules and paste the updated firestore.rules file, then click Publish.' });
    } else {
      showError('Failed to join team', 'team', e, { action: 'join' });
    }
  }
}
async function leaveTeam() {
  if (!currentUser || !userProfile?.teamId) return;
  const teamName = teamData?.name || 'this team';
  showModal('Leave Team', '<div style="font-size:14px;color:var(--text)">Are you sure you want to leave <strong>' + escHtml(teamName) + '</strong>? You can rejoin later with the team code.</div>', async () => {
    if (demoMode) {
      teamData = null;
      teamMembers = [];
      userProfile.teamId = null;
      userProfile.teamName = null;
      showToast('Left team.', 'info');
      renderTeam();
      return;
    }
    if (!db) return;
    showLoading('Leaving team...');
    try {
      const tid = userProfile.teamId;
      await updateDoc(doc(db, 'teams', tid), { members: arrayRemove(currentUser.uid) });
      await updateDoc(doc(db, 'users', currentUser.uid), { teamId: null, teamName: null });
      userProfile.teamId = null;
      userProfile.teamName = null;
      teamData = null;
      teamMembers = [];
      hideLoading();
      showToast('Left team.', 'info');
      renderTeam();
    } catch(e) {
      hideLoading();
      console.error('Leave team error:', e);
      showError('Failed to leave team', 'team', e, { action: 'leave' });
    }
  });
}
async function loadTeamData() {
  if (!currentUser || !userProfile?.teamId) {
    teamData = null;
    teamMembers = [];
    return;
  }
  if (demoMode) return;
  if (!db) return;
  try {
    const teamSnap = await getDoc(doc(db, 'teams', userProfile.teamId));
    if (!teamSnap.exists()) {
      userProfile.teamId = null;
      userProfile.teamName = null;
      teamData = null;
      teamMembers = [];
      return;
    }
    const td = teamSnap.data();
    teamData = { id: teamSnap.id, name: td.name, code: td.code, members: td.members || [], stravaClubId: td.stravaClubId || null };
    // Load each member's data
    const today = new Date();
    const dateKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const members = [];
    for (const uid of teamData.members) {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        const uData = uSnap.exists() ? uSnap.data() : {};
        // Count workouts
        const wSnap = await getDocs(collection(db, 'users', uid, 'workouts'));
        const totalWorkouts = wSnap.size;
        // Streak
        let streak = 0;
        if (totalWorkouts > 0) {
          const workoutDates = new Set();
          wSnap.docs.forEach(d => {
            const wd = d.data().date;
            const dt = wd?.toDate ? wd.toDate() : (wd ? new Date(wd) : null);
            if (dt) workoutDates.add(dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate());
          });
          let check = new Date(today);
          check.setHours(0,0,0,0);
          let todayKey = check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate();
          if (!workoutDates.has(todayKey)) check.setDate(check.getDate()-1);
          while (true) {
            const key = check.getFullYear()+'-'+(check.getMonth()+1)+'-'+check.getDate();
            if (workoutDates.has(key)) { streak++; check.setDate(check.getDate()-1); }
            else break;
          }
        }
        // Today checklist
        let checklistPct = 0;
        try {
          const clSnap = await getDoc(doc(db, 'users', uid, 'checklist', dateKey));
          if (clSnap.exists()) {
            const items = clSnap.data().items || {};
            const vals = Object.values(items);
            if (vals.length > 0) checklistPct = (vals.filter(v => v === true).length / vals.length) * 100;
          }
        } catch(e) {}
        members.push({
          uid,
          displayName: uData.displayName || 'Unknown',
          yearLevel: uData.yearLevel || null,
          fitnessLevel: uData.fitnessLevel || 'basic',
          activePlanId: uData.activePlanId || null,
          totalWorkouts,
          streak,
          checklistPct
        });
      } catch(e) {
        members.push({ uid, displayName: 'Unknown', totalWorkouts: 0, streak: 0, checklistPct: 0 });
      }
    }
    teamMembers = members;
  } catch(e) {
    console.error('Load team error:', e);
    teamData = null;
    teamMembers = [];
  }
}
// Utilities (escHtml, capitalize imported from state.js)
// Find a plan by ID from built-in + custom plans
function findPlan(id) {
  if (!id) return null;
  return ALL_PLANS.find(p => p.id === id) || customPlans.find(p => p.id === id) || null;
}
function getTimeAgo(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch(e) { return ''; }
}
function getEmbedUrl(url) {
  if (!url) return '';
  try {
    // Already an embed URL
    if (url.includes('/embed/')) return url.split('?')[0];
    // YouTube Shorts: /shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/);
    if (shortsMatch) return 'https://www.youtube.com/embed/' + shortsMatch[1];
    // Standard watch: ?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([A-Za-z0-9_-]+)/);
    if (watchMatch) return 'https://www.youtube.com/embed/' + watchMatch[1];
    // youtu.be short link
    const shortMatch = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    if (shortMatch) return 'https://www.youtube.com/embed/' + shortMatch[1];
  } catch(e) {}
  return url;
}
// Firebase Listeners
function setupListeners(uid) {
  // Listen to workouts
  if (workoutsUnsubscribe) workoutsUnsubscribe();
  const wRef = query(collection(db, 'users', uid, 'workouts'), orderBy('date', 'desc'));
  workoutsUnsubscribe = onSnapshot(wRef, (snap) => {
    userWorkouts = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    if (currentPage === 'fitness' && fitnessSubTab === 'workouts') renderWorkouts();
    if (currentPage === 'today') renderToday();
  }, (err) => {
    console.error('Workouts listener error:', err);
    userWorkouts = [];
  });
  // Listen to today's checklist
  if (checklistUnsubscribe) checklistUnsubscribe();
  const today = new Date();
  const dateKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const clRef = doc(db, 'users', uid, 'checklist', dateKey);
  checklistUnsubscribe = onSnapshot(clRef, (snap) => {
    if (snap.exists()) {
      userChecklist = snap.data().items || {};
    } else {
      userChecklist = {};
    }
    if (currentPage === 'today') renderToday();
  }, (err) => {
    console.error('Checklist listener error:', err);
    userChecklist = {};
  });
}
async function loadUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      userProfile = snap.data();
    } else {
      userProfile = {
        displayName: currentUser.displayName || 'User',
        email: currentUser.email || '',
        yearLevel: 'Y7',
        fitnessLevel: 'basic',
        activePlanId: null,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'users', uid), userProfile);
    }
    // Refresh health data every 30 seconds for live updates
    if (profileUnsubscribe) clearInterval(profileUnsubscribe);
    profileUnsubscribe = setInterval(async () => {
      try {
        const refreshSnap = await getDoc(doc(db, 'users', uid));
        if (refreshSnap.exists()) {
          const oldHealth = JSON.stringify(userProfile?.health || {});
          const newData = refreshSnap.data();
          const newHealth = JSON.stringify(newData?.health || {});
          if (oldHealth !== newHealth) {
            userProfile = newData;
            if (currentPage === 'today') renderCurrentPage();
          }
        }
      } catch(e) {}
    }, 30000);
  } catch(e) {
    console.error('Load profile error:', e);
    userProfile = {
      displayName: currentUser?.displayName || 'User',
      email: currentUser?.email || '',
      yearLevel: 'Y7',
      fitnessLevel: 'basic',
      activePlanId: null
    };
  }
}
// Auth State Observer
// Build context object for sub-modules (admin.js, strava.js)
// Uses getters so modules always read fresh state
function buildModuleCtx() {
  return {
    // DOM + UI helpers
    $, show, hide, showToast, showError, logError, showLoading, hideLoading, haptic, openSheet, closeSheet,
    // Firebase refs (getters for fresh values)
    get db() { return db; },
    get currentUser() { return currentUser; },
    get userProfile() { return userProfile; },
    get demoMode() { return demoMode; },
    get isAdmin() { return isAdmin; },
    // Firebase functions
    doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc,
    serverTimestamp, Timestamp, where, query, orderBy, onSnapshot, arrayUnion, arrayRemove,
    // State (getters)
    get adminAnnouncements() { return adminAnnouncements; }, set adminAnnouncements(v) { adminAnnouncements = v; },
    get adminRaces() { return adminRaces; }, set adminRaces(v) { adminRaces = v; },
    get allUsersCache() { return allUsersCache; }, set allUsersCache(v) { allUsersCache = v; },
    get hiddenPlans() { return hiddenPlans; }, set hiddenPlans(v) { hiddenPlans = v; },
    get adminEmails() { return adminEmails; }, set adminEmails(v) { adminEmails = v; },
    get adminPerms() { return adminPerms; }, set adminPerms(v) { adminPerms = v; },
    get currentAdminPerms() { return currentAdminPerms; },
    get adminActiveTab() { return adminActiveTab; }, set adminActiveTab(v) { adminActiveTab = v; },
    get videoOverrides() { return videoOverrides; }, set videoOverrides(v) { videoOverrides = v; },
    get planOverrides() { return planOverrides; }, set planOverrides(v) { planOverrides = v; },
    get exerciseDemoVideos() { return exerciseDemoVideos; }, set exerciseDemoVideos(v) { exerciseDemoVideos = v; },
    get exerciseOverrides() { return exerciseOverrides; }, set exerciseOverrides(v) { exerciseOverrides = v; },
    get raceFootage() { return raceFootage; }, set raceFootage(v) { raceFootage = v; },
    get raceLogVideos() { return raceLogVideos; }, set raceLogVideos(v) { raceLogVideos = v; },
    get activeChallenge() { return activeChallenge; }, set activeChallenge(v) { activeChallenge = v; },
    get trainingSessions() { return trainingSessions; }, set trainingSessions(v) { trainingSessions = v; },
    get customPlans() { return customPlans; },
    get teamData() { return teamData; },
    get teamMembers() { return teamMembers; },
    get userWorkouts() { return userWorkouts; }, set userWorkouts(v) { userWorkouts = v; },
    get userRaceLogs() { return userRaceLogs; }, set userRaceLogs(v) { userRaceLogs = v; },
    get ALL_PLANS() { return ALL_PLANS; },
    get stravaTokens() { return stravaTokens; }, set stravaTokens(v) { stravaTokens = v; },
    get stravaActivities() { return stravaActivities; }, set stravaActivities(v) { stravaActivities = v; },
    ADMIN_EMAIL, ALL_ADMIN_FEATURES,
    STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI,
    // Function refs
    findPlan, getActiveRaces, getVisiblePlans, getPlanDisplayData, getEmbedUrl,
    getMapTileUrl, renderToday, renderFitness, renderPlans, renderProfile,
    stravaUploadActivity, autoUpdateChallengeScore, showModal, saveCustomPlansLocal,
    sendAiMessage, calcStreak,
  };
}
function startApp() {
  // App version — bump this on every deploy
  const APP_VERSION = '4.4.0';
  console.log('[TurboPrep] v' + APP_VERSION + ' loading...');

  // Force-reset stuck student view via URL param: ?reset_admin=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('reset_admin')) {
    localStorage.removeItem('vf_student_view');
    window.history.replaceState({}, '', window.location.pathname);
    console.log('[TurboPrep] Student view reset');
  }
  // Force clear all caches via URL param: ?clear_cache=true
  if (urlParams.has('clear_cache')) {
    window.history.replaceState({}, '', window.location.pathname);
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
        console.log('[TurboPrep] All caches cleared');
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
            console.log('[TurboPrep] Service workers unregistered');
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      });
      return; // Stop — page will reload after cache clear
    }
  }
  if (!initFirebase()) return;
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      showLoading('Loading...');
      // PHASE 1: Profile + admin check (must complete before showing app)
      try { await loadUserProfile(user.uid); } catch(e) {
        console.error('Profile load failed:', e);
        userProfile = { displayName: user.displayName || 'User', email: user.email || '', yearLevel: 'Y7', fitnessLevel: 'basic', activePlanId: null };
      }
      try { setupListeners(user.uid); } catch(e) { console.warn('Listeners:', e); }
      try { initAdmin(buildModuleCtx()); initStrava(buildModuleCtx()); initRaceLog(buildModuleCtx()); initTimer(buildModuleCtx()); initAiFeatures(buildModuleCtx()); } catch(e) { console.warn('Module init:', e); }
      try { await loadAdminEmails(); } catch(e) {}
      try { checkAdmin(user.email); } catch(e) {}
      // PHASE 2: Show the app NOW — don't wait for all data
      hideLoading();
      if (window.location.search.includes('code=')) { try { stravaHandleCallback(); } catch(e) {} }
      try {
        const savedTab = localStorage.getItem('vf_lastTab');
        if (savedTab && ['today','fitness','races','team','admin'].includes(savedTab)) currentPage = savedTab;
      } catch(e) {}
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const startPage = $('page-' + currentPage);
      if (startPage) startPage.classList.add('active');
      initTracker({
        haptic, getMapTileUrl, getWorkouts: () => userWorkouts,
        saveTrackedActivity: async (workout, workoutId) => {
          if (!demoMode && db && currentUser) {
            try {
              const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), { ...workout, routeId: workoutId, date: serverTimestamp() });
              showToast('Activity saved!', 'success');
              if (stravaTokens?.access_token && workout.type !== 'gym') {
                stravaUploadActivity(workout).then(async (sid) => {
                  if (sid) { try { await updateDoc(doc(db, 'users', currentUser.uid, 'workouts', docRef.id), { stravaId: String(sid), source: 'tracker' }); } catch(e) {} showToast('Synced to Strava!', 'success'); }
                });
              }
              autoUpdateChallengeScore(workout.duration || 0, 10);
            } catch(e) { showError('Failed to save activity', 'tracker', e, { action: 'save' }); }
          } else { userWorkouts.unshift({ ...workout, id: workoutId, routeId: workoutId }); showToast('Activity saved (demo).', 'success'); }
        },
        onActivitySaved: () => { if (currentPage === 'today') renderToday(); if (currentPage === 'fitness') renderFitness(); }
      });
      showMainApp();
      const initial = (userProfile?.displayName || user.displayName || user.email || 'U').charAt(0).toUpperCase();
      try { $('user-avatar-btn').textContent = initial; } catch(e) {}
      // PHASE 3: Load remaining data in parallel (app is already visible)
      await Promise.allSettled([
        loadVideoOverrides(), isAdmin ? loadAdminData() : Promise.resolve(),
        loadAnnouncements(), loadFirestoreRaces(), loadHiddenPlans(),
        loadTeamData(), loadUserRaceLogs(), loadRaceFootage(), loadRaceLogVideos(),
        loadExerciseOverrides(), loadPlanOverrides(), loadExerciseDemoVideos(),
        loadCustomPlans(), loadTeamFeed(), loadTeamChallenge(), loadTrainingSessions()
      ]);
      // PHASE 4: Non-async finishers
      try { setupAnnouncementListener(); } catch(e) {}
      try { loadStravaTokens(); } catch(e) {}
      try { stravaAutoSync(); } catch(e) {}
      try { loadGoals(); } catch(e) {}
      // Re-render current page with full data
      renderCurrentPage();
      // Show welcome/onboarding for new users with API connection options
      if (!localStorage.getItem('vf_onboarded')) {
        setTimeout(() => showWelcomeSetup(), 800);
      }
      // Check training reminders
      checkTrainingReminder();
      // Request notification permission on first interaction
      requestNotificationPermission();
      // Check if any recent races need result logging
      checkRaceResultPrompt();
      // Flush any workouts queued while offline
      flushOfflineQueue();
    } else {
      currentUser = null;
      userProfile = null;
      userWorkouts = [];
      userChecklist = {};
      showAuthLogin();
      hideLoading();
    }
  });
}
// Allow Enter key on login/signup forms
$('login-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-btn').click(); });
$('signup-password')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('signup-btn').click(); });
function checkAdmin(email) {
  const e = (email || '').toLowerCase();
  const isOwner = e === ADMIN_EMAIL.toLowerCase();
  const permEntry = adminPerms.find(a => (a.email || '').toLowerCase() === e);
  // Legacy compat: also check old flat adminEmails
  const isLegacyAdmin = adminEmails.some(a => (a || '').toLowerCase() === e);
  isAdmin = isOwner || !!permEntry || isLegacyAdmin;
  // Owner gets all features; others get only granted features (mapped)
  if (isOwner) {
    currentAdminPerms = ALL_ADMIN_FEATURES.map(f => f.id);
  } else if (permEntry) {
    // Map old granular perms to new merged perms
    const raw = permEntry.perms || [];
    const mapped = new Set(raw);
    // If they had demolinks or exercises, grant plans
    if (mapped.has('demolinks') || mapped.has('exercises')) mapped.add('plans');
    // If they had permissions, grant users
    if (mapped.has('permissions')) mapped.add('users');
    currentAdminPerms = [...mapped];
  } else if (isLegacyAdmin) {
    currentAdminPerms = ALL_ADMIN_FEATURES.map(f => f.id);
  } else {
    currentAdminPerms = [];
  }
  const tab = document.getElementById('admin-tab');
  const studentView = localStorage.getItem('vf_student_view') === 'true';
  if (tab) tab.style.display = (isAdmin && !studentView) ? '' : 'none';
}
async function loadAdminData() {
  if (!isAdmin || !db) return;
  try {
    // Load announcements
    const annSnap = await getDoc(doc(db, 'config', 'announcements'));
    adminAnnouncements = annSnap.exists() ? (annSnap.data().items || []) : [];
    // Load races from Firestore
    const raceSnap = await getDoc(doc(db, 'config', 'races'));
    adminRaces = raceSnap.exists() ? (raceSnap.data().races || null) : null;
    // Load race footage, videos & exercise/plan overrides
    await loadRaceFootage();
    await loadRaceLogVideos();
    await loadExerciseOverrides();
    await loadPlanOverrides();
    await loadExerciseDemoVideos();
    // Load hidden plans
    const hpSnap = await getDoc(doc(db, 'config', 'hiddenPlans'));
    hiddenPlans = new Set(hpSnap.exists() ? (hpSnap.data().ids || []) : []);
  } catch(e) {
    console.error('Load admin data error:', e);
  }
}
async function loadAnnouncements() {
  if (!db) return;
  try {
    const annSnap = await getDoc(doc(db, 'config', 'announcements'));
    adminAnnouncements = annSnap.exists() ? (annSnap.data().items || []) : [];
  } catch(e) {
    adminAnnouncements = [];
  }
}
let lastSeenAnnId = '';
try { lastSeenAnnId = localStorage.getItem('vf_lastSeenAnn') || ''; } catch(e) {}
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
function showAnnouncementNotification(title, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Prefer service worker showNotification (required for iOS PWA)
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('TurboPrep: ' + title, {
        body: message,
        icon: document.querySelector('link[rel="apple-touch-icon"]')?.href || '',
        badge: document.querySelector('link[rel="apple-touch-icon"]')?.href || '',
        tag: 'vf-announcement-' + Date.now(),
        renotify: true,
        data: { url: location.href }
      });
    }).catch(() => {
      // Fallback to Notification constructor (desktop/Android)
      try {
        const n = new Notification('TurboPrep: ' + title, {
          body: message,
          icon: document.querySelector('link[rel="apple-touch-icon"]')?.href || '',
          tag: 'vf-announcement',
          renotify: true
        });
        n.onclick = () => { window.focus(); n.close(); };
      } catch(e) {}
    });
  } else {
    try {
      const n = new Notification('TurboPrep: ' + title, {
        body: message,
        tag: 'vf-announcement',
        renotify: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch(e) {}
  }
  // Update app badge count if supported
  try { if (navigator.setAppBadge) navigator.setAppBadge(1); } catch(e) {}
}
function checkForNewAnnouncements(announcements) {
  if (!announcements || announcements.length === 0) return;
  const activeAnns = announcements.filter(a => a.active);
  if (activeAnns.length === 0) return;
  const latestId = activeAnns[0].id || '';
  if (latestId && latestId !== lastSeenAnnId) {
    // New announcement detected
    const a = activeAnns[0];
    showAnnouncementNotification(a.title, a.message);
    lastSeenAnnId = latestId;
    try { localStorage.setItem('vf_lastSeenAnn', latestId); } catch(e) {}
  }
}
// Listen for announcements in real-time (triggers notification for new ones)
// --- Training Session Notifications ---
// --- Health Tab (Fitness page) ---
function renderHealthTab() {
  const c = $('health-content');
  if (!c) return;
  const h = userProfile?.health || {};
  const now = new Date();
  let html = '';

  // Current stats row
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div class="page-title" style="margin:0">Health</div>';
  if (h.lastSync) html += '<span style="font-size:11px;color:var(--muted-fg)">Synced ' + timeAgo(new Date(h.lastSync)) + '</span>';
  html += '</div>';

  // Stat cards
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  html += `<div style="text-align:center;padding:16px 8px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.1);border-radius:12px">
    <div style="font-size:32px;font-weight:800;color:#ef4444">${h.latestHr || '--'}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:4px">❤️ Heart Rate</div>
  </div>`;
  html += `<div style="text-align:center;padding:16px 8px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.1);border-radius:12px">
    <div style="font-size:32px;font-weight:800;color:#3b82f6">${h.restingHr || '--'}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:4px">💓 Resting HR</div>
  </div>`;
  html += `<div style="text-align:center;padding:16px 8px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.1);border-radius:12px">
    <div style="font-size:32px;font-weight:800;color:#22c55e">${h.latestSteps ? (h.latestSteps > 999 ? (h.latestSteps/1000).toFixed(1) + 'k' : h.latestSteps) : '--'}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:4px">👟 Steps</div>
  </div>`;
  html += `<div style="text-align:center;padding:16px 8px;background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1);border-radius:12px">
    <div style="font-size:32px;font-weight:800;color:#a855f7">${h.latestSleep ? h.latestSleep + 'h' : '--'}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:4px">😴 Sleep</div>
  </div>`;
  html += '</div>';

  // Heart Rate chart — from workout data
  const hrWorkouts = userWorkouts.filter(w => w.heartRate && w.heartRate > 0).slice(0, 14).reverse();
  if (hrWorkouts.length > 0) {
    const hrMax = Math.max(...hrWorkouts.map(w => w.heartRate));
    const hrMin = Math.min(...hrWorkouts.map(w => w.heartRate));
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">❤️ Heart Rate History</div>
        <div style="font-size:11px;color:var(--muted-fg)">Last ${hrWorkouts.length} workouts</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <span style="font-size:11px;color:var(--muted-fg)">Avg: <strong style="color:var(--text)">${Math.round(hrWorkouts.reduce((s,w)=>s+w.heartRate,0)/hrWorkouts.length)}</strong></span>
        <span style="font-size:11px;color:var(--muted-fg)">Low: <strong style="color:#22c55e">${hrMin}</strong></span>
        <span style="font-size:11px;color:var(--muted-fg)">High: <strong style="color:#ef4444">${hrMax}</strong></span>
      </div>
      <div style="display:flex;align-items:end;gap:3px;height:80px">`;
    hrWorkouts.forEach(w => {
      const pct = hrMax > hrMin ? ((w.heartRate - hrMin) / (hrMax - hrMin)) * 70 + 30 : 50;
      const color = w.heartRate > 160 ? '#ef4444' : w.heartRate > 140 ? '#f59e0b' : w.heartRate > 120 ? '#22c55e' : '#3b82f6';
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:8px;font-weight:600;color:var(--muted-fg)">${w.heartRate}</div>
        <div style="width:100%;height:${pct}%;background:${color};border-radius:4px 4px 0 0;min-height:6px;transition:height .3s"></div>
        <div style="font-size:7px;color:var(--muted-fg)">${d.getDate()}/${d.getMonth()+1}</div>
      </div>`;
    });
    html += '</div>';
    // HR zone legend
    html += `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
      <span style="font-size:9px;color:var(--muted-fg)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#3b82f6;margin-right:3px"></span>Low &lt;120</span>
      <span style="font-size:9px;color:var(--muted-fg)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#22c55e;margin-right:3px"></span>Moderate 120-140</span>
      <span style="font-size:9px;color:var(--muted-fg)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f59e0b;margin-right:3px"></span>Hard 140-160</span>
      <span style="font-size:9px;color:var(--muted-fg)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ef4444;margin-right:3px"></span>Max &gt;160</span>
    </div>`;
    html += '</div>';
  }

  // Training volume chart — duration per day for last 14 days
  const days14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const key = d.toISOString().split('T')[0];
    const dayWos = userWorkouts.filter(w => { const wd = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null; return wd && wd.toISOString().split('T')[0] === key; });
    const mins = dayWos.reduce((s, w) => s + (w.duration || 0), 0);
    const dist = dayWos.reduce((s, w) => s + (w.distance || 0), 0);
    days14.push({ date: d, key, mins, dist, count: dayWos.length });
  }
  const maxMins = Math.max(1, ...days14.map(d => d.mins));
  html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--text)">📊 Training Volume</div>
      <div style="font-size:11px;color:var(--muted-fg)">Last 14 days</div>
    </div>
    <div style="display:flex;align-items:end;gap:2px;height:70px">`;
  days14.forEach(d => {
    const pct = d.mins > 0 ? (d.mins / maxMins) * 100 : 0;
    const isToday = d.key === now.toISOString().split('T')[0];
    html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px">
      ${d.mins > 0 ? `<div style="font-size:7px;font-weight:600;color:var(--muted-fg)">${d.mins}</div>` : ''}
      <div style="width:100%;height:${pct}%;background:${isToday ? 'var(--primary)' : d.mins > 0 ? 'rgba(191,255,0,.4)' : 'rgba(255,255,255,.04)'};border-radius:3px 3px 0 0;min-height:${d.mins > 0 ? '6' : '2'}px"></div>
      <div style="font-size:7px;color:${isToday ? 'var(--primary)' : 'var(--muted-fg)'};font-weight:${isToday ? '700' : '400'}">${d.date.toLocaleDateString('en-AU',{weekday:'narrow'})}</div>
    </div>`;
  });
  html += '</div></div>';

  // Weekly summary stats
  const thisWeek = days14.slice(-7);
  const lastWeek = days14.slice(0, 7);
  const twMins = thisWeek.reduce((s, d) => s + d.mins, 0);
  const lwMins = lastWeek.reduce((s, d) => s + d.mins, 0);
  const twCount = thisWeek.reduce((s, d) => s + d.count, 0);
  const lwCount = lastWeek.reduce((s, d) => s + d.count, 0);
  const twDist = thisWeek.reduce((s, d) => s + d.dist, 0);
  const minsDiff = twMins - lwMins;
  html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">📈 Week Comparison</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div style="text-align:center">
        <div style="font-size:9px;color:var(--muted-fg);margin-bottom:4px">Sessions</div>
        <div style="font-size:20px;font-weight:800;color:var(--text)">${twCount}</div>
        <div style="font-size:10px;color:${twCount >= lwCount ? '#22c55e' : '#ef4444'}">${twCount >= lwCount ? '↑' : '↓'} vs ${lwCount}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:9px;color:var(--muted-fg);margin-bottom:4px">Minutes</div>
        <div style="font-size:20px;font-weight:800;color:var(--text)">${twMins}</div>
        <div style="font-size:10px;color:${minsDiff >= 0 ? '#22c55e' : '#ef4444'}">${minsDiff >= 0 ? '+' : ''}${minsDiff} min</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:9px;color:var(--muted-fg);margin-bottom:4px">Distance</div>
        <div style="font-size:20px;font-weight:800;color:var(--text)">${twDist > 0 ? twDist.toFixed(1) : '--'}</div>
        <div style="font-size:10px;color:var(--muted-fg)">${twDist > 0 ? 'km' : ''}</div>
      </div>
    </div>
  </div>`;

  // RPE effort trend
  const rpeWorkouts = userWorkouts.filter(w => w.rpe).slice(0, 14).reverse();
  if (rpeWorkouts.length >= 3) {
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">💪 Effort Trend (RPE)</div>
        <div style="font-size:11px;color:var(--muted-fg)">Last ${rpeWorkouts.length}</div>
      </div>
      <div style="display:flex;align-items:end;gap:3px;height:60px">`;
    rpeWorkouts.forEach(w => {
      const pct = (w.rpe / 10) * 100;
      const color = w.rpe >= 8 ? '#ef4444' : w.rpe >= 6 ? '#f59e0b' : w.rpe >= 4 ? '#22c55e' : '#3b82f6';
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:8px;font-weight:600;color:var(--muted-fg)">${w.rpe}</div>
        <div style="width:100%;height:${pct}%;background:${color};border-radius:4px 4px 0 0;min-height:6px"></div>
        <div style="font-size:7px;color:var(--muted-fg)">${d.getDate()}/${d.getMonth()+1}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  // Sync setup prompt if no health data
  if (!h.latestHr && !h.latestSteps && !h.latestSleep) {
    html += `<div style="text-align:center;padding:24px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px">
      <div style="font-size:32px;margin-bottom:8px">❤️</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">No Health Data Yet</div>
      <div style="font-size:12px;color:var(--muted-fg);line-height:1.5;margin-bottom:12px">Connect your wearable to see heart rate, steps, and sleep data here with charts and trends.</div>
      <div style="font-size:12px;color:var(--muted-fg);line-height:1.6;text-align:left;padding:10px;background:var(--surface-alt);border-radius:8px;margin-bottom:8px">
        <strong style="color:var(--text)">Option 1:</strong> Connect Strava in Profile — auto-imports workouts with heart rate<br><br>
        <strong style="color:var(--text)">Option 2:</strong> Apple Shortcut — ask your coach for the setup link. Syncs heart rate, steps, and sleep automatically.
      </div>
      <button class="btn btn-primary" id="health-go-profile" style="padding:10px 20px;font-size:13px">Go to Profile → Health Sync</button>
    </div>`;
  }

  // Personal bests
  const allDurations = userWorkouts.map(w => w.duration || 0).filter(d => d > 0);
  const allDistances = userWorkouts.map(w => w.distance || 0).filter(d => d > 0);
  const allSpeeds = userWorkouts.map(w => w.avgSpeed || 0).filter(s => s > 0);
  if (allDurations.length > 0 || allDistances.length > 0) {
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">🏆 Personal Bests</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${allDurations.length > 0 ? `<div style="padding:8px;background:var(--surface-alt);border-radius:8px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${Math.max(...allDurations)}</div>
          <div style="font-size:10px;color:var(--muted-fg)">Longest session (min)</div>
        </div>` : ''}
        ${allDistances.length > 0 ? `<div style="padding:8px;background:var(--surface-alt);border-radius:8px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${Math.max(...allDistances).toFixed(1)}</div>
          <div style="font-size:10px;color:var(--muted-fg)">Longest ride (km)</div>
        </div>` : ''}
        ${allSpeeds.length > 0 ? `<div style="padding:8px;background:var(--surface-alt);border-radius:8px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${Math.max(...allSpeeds).toFixed(1)}</div>
          <div style="font-size:10px;color:var(--muted-fg)">Top speed (km/h)</div>
        </div>` : ''}
        ${userWorkouts.length > 0 ? `<div style="padding:8px;background:var(--surface-alt);border-radius:8px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${userWorkouts.length}</div>
          <div style="font-size:10px;color:var(--muted-fg)">Total workouts</div>
        </div>` : ''}
      </div>
    </div>`;
  }

  c.innerHTML = html;

  // Bind
  $('health-go-profile')?.addEventListener('click', () => { openProfile(); });
}

// --- Health Dashboard ---
function openHealthDashboard() {
  const h = userProfile?.health || {};
  const workoutsWithHr = userWorkouts.filter(w => w.heartRate).slice(0, 10);
  const avgHr = workoutsWithHr.length > 0 ? Math.round(workoutsWithHr.reduce((s, w) => s + w.heartRate, 0) / workoutsWithHr.length) : null;
  const maxHr = workoutsWithHr.length > 0 ? Math.max(...workoutsWithHr.map(w => w.heartRate)) : null;
  const totalMins = userWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
  const totalDist = userWorkouts.reduce((s, w) => s + (w.distance || 0), 0);
  let html = '<div class="sheet-title">Health Dashboard</div>';
  // Current stats
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">';
  if (h.latestHr) html += `<div style="text-align:center;padding:14px 8px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.1);border-radius:12px">
    <div style="font-size:28px;font-weight:800;color:#ef4444">${h.latestHr}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:2px">Current HR</div>
  </div>`;
  if (h.restingHr) html += `<div style="text-align:center;padding:14px 8px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.1);border-radius:12px">
    <div style="font-size:28px;font-weight:800;color:#3b82f6">${h.restingHr}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:2px">Resting HR</div>
  </div>`;
  if (h.latestSteps) html += `<div style="text-align:center;padding:14px 8px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.1);border-radius:12px">
    <div style="font-size:28px;font-weight:800;color:#22c55e">${h.latestSteps > 999 ? (h.latestSteps / 1000).toFixed(1) + 'k' : h.latestSteps}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:2px">Steps Today</div>
  </div>`;
  if (h.latestSleep) html += `<div style="text-align:center;padding:14px 8px;background:rgba(124,58,237,.06);border:1px solid rgba(124,58,237,.1);border-radius:12px">
    <div style="font-size:28px;font-weight:800;color:#a855f7">${h.latestSleep}h</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:2px">Sleep</div>
  </div>`;
  if (h.vo2max) html += `<div style="text-align:center;padding:14px 8px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.1);border-radius:12px">
    <div style="font-size:28px;font-weight:800;color:#f59e0b">${h.vo2max}</div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:2px">VO2 Max</div>
  </div>`;
  html += '</div>';
  // Workout heart rate history
  if (workoutsWithHr.length > 0) {
    html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">Workout Heart Rate</div>';
    html += `<div style="display:flex;gap:12px;margin-bottom:10px">
      ${avgHr ? `<div style="font-size:12px;color:var(--muted-fg)">Avg: <strong style="color:var(--text)">${avgHr}</strong> bpm</div>` : ''}
      ${maxHr ? `<div style="font-size:12px;color:var(--muted-fg)">Peak: <strong style="color:#ef4444">${maxHr}</strong> bpm</div>` : ''}
    </div>`;
    // Simple bar chart of recent HR
    html += '<div style="display:flex;align-items:end;gap:3px;height:60px;margin-bottom:12px">';
    const hrMax = Math.max(...workoutsWithHr.map(w => w.heartRate));
    workoutsWithHr.reverse().forEach(w => {
      const pct = hrMax > 0 ? (w.heartRate / hrMax) * 100 : 0;
      const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
      const color = w.heartRate > 160 ? '#ef4444' : w.heartRate > 140 ? '#f59e0b' : '#22c55e';
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:8px;color:var(--muted-fg)">${w.heartRate}</div>
        <div style="width:100%;height:${pct}%;min-height:4px;background:${color};border-radius:3px 3px 0 0"></div>
        <div style="font-size:7px;color:var(--muted-fg)">${d.getDate()}/${d.getMonth() + 1}</div>
      </div>`;
    });
    html += '</div>';
  }
  // Training totals
  html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">Training Totals</div>';
  html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="text-align:center;padding:10px 4px;background:var(--surface-alt);border-radius:10px">
      <div style="font-size:18px;font-weight:800;color:var(--text)">${userWorkouts.length}</div>
      <div style="font-size:10px;color:var(--muted-fg)">workouts</div>
    </div>
    <div style="text-align:center;padding:10px 4px;background:var(--surface-alt);border-radius:10px">
      <div style="font-size:18px;font-weight:800;color:var(--text)">${totalMins > 60 ? (totalMins / 60).toFixed(1) + 'h' : totalMins + 'm'}</div>
      <div style="font-size:10px;color:var(--muted-fg)">total time</div>
    </div>
    <div style="text-align:center;padding:10px 4px;background:var(--surface-alt);border-radius:10px">
      <div style="font-size:18px;font-weight:800;color:var(--text)">${totalDist > 0 ? totalDist.toFixed(1) + 'km' : '--'}</div>
      <div style="font-size:10px;color:var(--muted-fg)">distance</div>
    </div>
  </div>`;
  // Sync info
  html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">How to Sync</div>';
  html += `<div style="font-size:12px;color:var(--muted-fg);line-height:1.5;margin-bottom:8px">
    <strong style="color:var(--text)">Strava:</strong> Profile → Connect Strava<br>
    <strong style="color:var(--text)">Apple Watch:</strong> Coach shares a Shortcut link. Tap to add → paste your sync token → heart rate syncs automatically during workouts.<br>
    <strong style="color:var(--text)">Token:</strong> ${userProfile?.syncToken ? '<span style="font-family:monospace;color:var(--primary)">' + escHtml(userProfile.syncToken.substring(0, 12)) + '...</span>' : 'Generate in Profile → Health Sync'}
  </div>`;
  if (h.lastSync) html += `<div style="font-size:10px;color:var(--muted-fg)">Last sync: ${timeAgo(new Date(h.lastSync))}</div>`;
  $('sheet-content').innerHTML = html;
  openSheet();
}
// --- Weather ---
const WEATHER_KEY = 'c286357e02b8753b54b5b7bf3e4ee1ce';
async function loadWeather() {
  // Check if fresh data needed (15 min TTL)
  try {
    const cached = JSON.parse(localStorage.getItem('vf_weather') || '{}');
    if (cached.ts && Date.now() - cached.ts < 15 * 60 * 1000) return; // Cache is fresh, already rendered inline
  } catch(e) {}
  // Get location
  let lat = -37.81, lon = 144.96; // Default: Melbourne
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch(e) {}
  try {
    const resp = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_KEY}`);
    if (!resp.ok) return;
    const data = await resp.json();
    const w = {
      temp: Math.round(data.main?.temp || 0),
      feels: Math.round(data.main?.feels_like || 0),
      desc: data.weather?.[0]?.description || '',
      icon: data.weather?.[0]?.icon || '01d',
      wind: Math.round((data.wind?.speed || 0) * 3.6),
      humidity: data.main?.humidity || 0,
      city: data.name || '',
      ts: Date.now()
    };
    try { localStorage.setItem('vf_weather', JSON.stringify(w)); } catch(e) {}
    // Soft-update the card if it exists on screen
    const el = $('weather-card');
    if (el) renderWeatherCard(el, w);
  } catch(e) {}
}
function renderWeatherCard(el, w) {
  const iconUrl = `https://openweathermap.org/img/wn/${w.icon}@2x.png`;
  const advice = w.wind >= 30 ? '💨 Strong winds — consider indoor training'
    : w.temp < 8 ? '🥶 Cold out — wear layers'
    : w.temp > 35 ? '🔥 Extreme heat — train early or indoors'
    : w.temp >= 20 ? '☀️ Great conditions for training'
    : '👍 Good conditions for training';
  const bgGrad = w.icon?.includes('n') ? 'linear-gradient(135deg,rgba(30,41,59,.9),rgba(51,65,85,.8))' : 'linear-gradient(135deg,rgba(59,130,246,.12),rgba(124,58,237,.06))';
  const borderCol = w.icon?.includes('n') ? 'rgba(100,116,139,.3)' : 'rgba(59,130,246,.2)';
  el.innerHTML = `<div style="padding:14px 16px;background:${bgGrad};border:1px solid ${borderCol};border-radius:14px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <img src="${iconUrl}" style="width:52px;height:52px;margin:-8px" alt="${escHtml(w.desc)}">
      <div style="flex:1">
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:32px;font-weight:800;color:var(--text);line-height:1">${w.temp}°</span>
          <span style="font-size:13px;color:var(--muted-fg);text-transform:capitalize">${escHtml(w.desc)}</span>
        </div>
        <div style="font-size:12px;color:var(--muted-fg);margin-top:2px">Feels ${w.feels}°${w.city ? ' · ' + escHtml(w.city) : ''}</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:6px">
      <span style="font-size:11px;color:var(--muted-fg)">💨 ${w.wind} km/h</span>
      <span style="font-size:11px;color:var(--muted-fg)">💧 ${w.humidity}%</span>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--text)">${advice}</div>
  </div>`;
}
function addSessionToCalendar(session) {
  const startDate = new Date(session.date + 'T' + (session.time || '16:00') + ':00');
  const endDate = session.endTime ? new Date(session.date + 'T' + session.endTime + ':00') : new Date(startDate.getTime() + 60 * 60 * 1000);
  const title = session.title || 'Training Session';
  const loc = session.location || '';
  const notes = session.notes || '';
  // Format dates
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fmtLocal = d => d.toISOString().replace(/[-:]/g, '').split('.')[0];
  // Show calendar picker
  const content = `<div style="padding:4px 0">
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">Add to Calendar</div>
    <button class="btn cal-opt" data-cal="google" style="width:100%;padding:12px;margin-bottom:8px;font-size:13px;font-weight:600;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer">
      <span style="font-size:18px">📅</span> Google Calendar
    </button>
    <button class="btn cal-opt" data-cal="apple" style="width:100%;padding:12px;margin-bottom:8px;font-size:13px;font-weight:600;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer">
      <span style="font-size:18px">🍎</span> Apple Calendar (.ics)
    </button>
    <button class="btn cal-opt" data-cal="outlook" style="width:100%;padding:12px;font-size:13px;font-weight:600;background:var(--card);border:1px solid var(--border);border-radius:10px;color:var(--text);display:flex;align-items:center;gap:10px;cursor:pointer">
      <span style="font-size:18px">📧</span> Outlook Calendar
    </button>
  </div>`;
  $('sheet-content').innerHTML = content;
  openSheet();
  document.querySelectorAll('.cal-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const cal = btn.dataset.cal;
      if (cal === 'google') {
        const gUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmtLocal(startDate)}/${fmtLocal(endDate)}&location=${encodeURIComponent(loc)}&details=${encodeURIComponent(notes)}`;
        window.open(gUrl, '_blank');
        showToast('Opening Google Calendar...', 'success');
      } else if (cal === 'outlook') {
        const oUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(title)}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&location=${encodeURIComponent(loc)}&body=${encodeURIComponent(notes)}`;
        window.open(oUrl, '_blank');
        showToast('Opening Outlook Calendar...', 'success');
      } else {
        // Apple / generic .ics download
        const ics = [
          'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TurboPrep//Training//EN',
          'BEGIN:VEVENT',
          'DTSTART:' + fmt(startDate), 'DTEND:' + fmt(endDate),
          'SUMMARY:' + title, 'LOCATION:' + loc,
          'DESCRIPTION:' + notes.replace(/\n/g, '\\n'),
          'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Training in 30 minutes', 'END:VALARM',
          'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = title.replace(/[^a-zA-Z0-9]/g, '_') + '.ics';
        a.click();
        URL.revokeObjectURL(url);
        showToast('Calendar file downloaded!', 'success');
      }
      closeSheet();
    });
  });
}
function checkTrainingReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().toISOString().split('T')[0];
  const lastReminder = localStorage.getItem('vf_reminder_date');
  if (lastReminder === today) return;
  // Check upcoming training sessions
  try {
    const sessions = JSON.parse(localStorage.getItem('vf_training_sessions') || '[]');
    const now = new Date();
    const todaySessions = sessions.filter(s => s.date === today && new Date(s.date + 'T' + (s.time || '16:00')) > new Date(now.getTime() - 3600000));
    if (todaySessions.length > 0) {
      localStorage.setItem('vf_reminder_date', today);
      const s = todaySessions[0];
      const msg = s.title + (s.location ? ' at ' + s.location : '') + (s.time ? ' — ' + s.time : '');
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Training Session Today', { body: msg, tag: 'training-session', data: { url: '/' } });
          });
        } else {
          new Notification('Training Session Today', { body: msg, tag: 'training-session' });
        }
      } catch(e) {}
    }
  } catch(e) {}
}
setInterval(checkTrainingReminder, 15 * 60 * 1000);
function setupAnnouncementListener() {
  if (!db) return;
  try {
    onSnapshot(doc(db, 'config', 'announcements'), (snap) => {
      if (!snap.exists()) return;
      const items = snap.data().items || [];
      const oldCount = adminAnnouncements.filter(a => a.active).length;
      adminAnnouncements = items;
      checkForNewAnnouncements(items);
      // Re-render Today if on that page
      if (currentPage === 'today') renderToday();
    });
  } catch(e) {
    console.log('Announcement listener setup failed:', e);
  }
}
// Request notification permission after first user interaction
document.addEventListener('click', function reqNotifOnce() {
  requestNotificationPermission();
  document.removeEventListener('click', reqNotifOnce);
}, { once: true });
// Check for new announcements when app becomes visible (returning from background)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && adminAnnouncements.length > 0) {
    // Re-render today if on that page
    if (currentPage === 'today') renderToday();
  }
});
// Notification click handler — delegated to sw.js
// Clear badge when app opens
try { if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch(e) {}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    try { if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch(e) {}
  }
});
async function loadFirestoreRaces() {
  if (!db) return;
  try {
    const rSnap = await getDoc(doc(db, 'config', 'races'));
    adminRaces = rSnap.exists() ? (rSnap.data().races || null) : null;
  } catch(e) {
    adminRaces = null;
  }
}
function getActiveRaces() {
  return adminRaces || RACES;
}
function getVisiblePlans() {
  if (hiddenPlans.size === 0) return ALL_PLANS;
  return ALL_PLANS.filter(p => !hiddenPlans.has(p.id));
}
function getPlanDisplayData(plan) {
  const ov = planOverrides[plan.id] || {};
  return {
    name: ov.name || plan.name,
    description: ov.description || plan.description,
    durationWeeks: ov.durationWeeks || plan.durationWeeks,
    sessionsPerWeek: ov.sessionsPerWeek || plan.sessionsPerWeek
  };
}
let adminActiveTab = 'announcements';
let plansSubTab = 'manage'; // manage | workouts | videos
let usersSubTab = 'all'; // all | permissions
// RACE LOG (all users)
// GPS Tracker — imported from tracker.js (see import at top of file)
async function autoUpdateChallengeScore(minutes, xpEarned) {
  if (!activeChallenge) return;
  const totalPoints = Math.round((minutes || 0) + (xpEarned || 0));
  if (totalPoints <= 0) return;
  if (demoMode || !db || !currentUser) return;
  // Find user's team
  const teamId = userProfile?.teamId;
  if (!teamId) return;
  // Match teamId to a challenge team key
  const teams = activeChallenge.teams || {};
  let matchKey = null;
  if (teams[teamId]) { matchKey = teamId; }
  else {
    if (teamData?.name) {
      const entry = Object.entries(teams).find(([k, v]) => v.name && v.name.toLowerCase() === teamData.name.toLowerCase());
      if (entry) matchKey = entry[0];
    }
  }
  if (!matchKey) return;
  try {
    const challengeRef = doc(db, 'config', 'activeChallenge');
    const snap = await getDoc(challengeRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.teams && data.teams[matchKey]) {
      data.teams[matchKey].score = (data.teams[matchKey].score || 0) + totalPoints;
      await setDoc(challengeRef, data);
      activeChallenge = data;
    }
  } catch(e) { console.error('Challenge score update error:', e); }
}
function checkRaceResultPrompt() {
  const allRaces = getActiveRaces();
  const today = new Date().toISOString().split('T')[0];
  const recentPast = allRaces.filter(r => {
    if (!r.date || r.date >= today) return false;
    const daysSince = Math.floor((Date.now() - new Date(r.date + 'T12:00:00').getTime()) / 86400000);
    return daysSince >= 0 && daysSince <= 7;
  });
  if (recentPast.length === 0) return;
  const prompted = localStorage.getItem('vf_race_prompted') || '';
  const unprompted = recentPast.find(r => !prompted.includes(r.date));
  if (!unprompted) return;
  setTimeout(() => {
    const rName = unprompted.name || 'recent race';
    // Show a clickable toast that opens the race result form
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.style.cursor = 'pointer';
    toast.textContent = 'How did ' + rName + ' go? Tap to log your result!';
    toast.addEventListener('click', () => {
      toast.remove();
      openRaceResultForm(rName, unprompted.date);
    });
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 8000);
    localStorage.setItem('vf_race_prompted', prompted + ',' + unprompted.date);
  }, 3000);
}
const TUTORIAL_STEPS = [
  {
    icon: '👋', bg: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    title: 'Welcome to TurboPrep!',
    desc: 'Hey! Welcome to your HPV training app. This tour takes about 2 minutes and shows you everything you need. Skip anytime or redo later from Profile.',
    highlight: null
  },
  {
    icon: '📊', bg: 'linear-gradient(135deg,#3b82f6,#60a5fa)',
    title: 'Today — Your Dashboard',
    desc: 'Your home base. Weather, XP, streak, health data at the top. Today\'s workout below. Training sessions, team challenges, and daily roundup further down. Tap ⚙️ to show/hide any widget.',
    highlight: '[data-page="today"]'
  },
  {
    icon: '🌤️', bg: 'linear-gradient(135deg,#3b82f6,#60a5fa)',
    title: 'Weather & Training Advice',
    desc: 'Live local weather with training advice. Updates every 15 minutes using your location. Tells you when conditions are good for outdoor training or when to train indoors.',
    highlight: null
  },
  {
    icon: '⭐', bg: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    title: 'XP, Levels & Streaks',
    desc: 'Every workout: +10 XP. First workout of the day: +10 bonus (2x XP badge). RPE rating: +5 XP. Every 7-day streak earns a Streak Freeze 🧊 that protects you if you miss a day. Levels: Rookie → Racer → Athlete → Champion → Legend → Elite.',
    highlight: null
  },
  {
    icon: '🏋️', bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
    title: 'Training Plans',
    desc: '54 plans across In Vehicle, Floor, and Machine. Matched to your year level and fitness tier. Tap a workout on Today to open the set tracker with auto rest timers between sets.',
    highlight: '[data-page="fitness"]'
  },
  {
    icon: '💪', bg: 'linear-gradient(135deg,#22c55e,#4ade80)',
    title: 'Set Tracker & Live Mode',
    desc: 'Tap any workout to open the exercise tracker. Tap set buttons as you complete them — rest timer starts automatically (45s between sets, 60s between exercises). Hit "Live Mode" for a full-screen guided workout that advances exercise by exercise.',
    highlight: null
  },
  {
    icon: '🟢', bg: 'linear-gradient(135deg,#22c55e,#16a34a)',
    title: 'GPS Tracker',
    desc: 'The green Record button opens GPS tracking with 6 types: 🏎️ HPV, 🚴 Ride, 🏃 Run, 🏃‍♂️ Treadmill, 🚶 Walk, 🏋️ Gym. Live map, distance, speed, pace, and elevation in real time.',
    highlight: '#record-tab-btn'
  },
  {
    icon: '✏️', bg: 'linear-gradient(135deg,#64748b,#94a3b8)',
    title: 'Smart Logging',
    desc: 'Tap "Log" to manually record. The form adapts per type — HPV asks for laps, vehicle, best lap. Treadmill asks for speed and incline. Strength lets you list exercises. Add a photo and rate your effort 1-10.',
    highlight: null
  },
  {
    icon: '📅', bg: 'linear-gradient(135deg,#f97316,#fb923c)',
    title: 'Training Sessions',
    desc: 'Coach-scheduled sessions appear on Today with a countdown. Tap "Add to Calendar" to add to Google Calendar, Apple Calendar, or Outlook with a 30-minute reminder.',
    highlight: null
  },
  {
    icon: '🏆', bg: 'linear-gradient(135deg,#f97316,#fb923c)',
    title: 'Teams & Monthly Challenge',
    desc: 'Pick your team at signup. Your training minutes AND XP count toward the Monthly Challenge. Top 3 teams get medals. Coach shoutouts appear as announcements when you\'re doing well.',
    highlight: '[data-page="team"]'
  },
  {
    icon: '📋', bg: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    title: 'Daily Roundup',
    desc: 'Every evening after 5pm, a roundup card shows today\'s sessions, minutes, distance, XP earned, effort level, and health data. Plus a personalised message. Your training receipt for the day.',
    highlight: null
  },
  {
    icon: '🤖', bg: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    title: 'AI Coach',
    desc: 'Purple button, bottom corner. Ask anything — plans, warm-ups, nutrition, injuries. It generates custom plans, reviews your week, and gives race prep advice. Knows your level and current plan.',
    highlight: '#ai-fab'
  },
  {
    icon: '⬡', bg: 'linear-gradient(135deg,#fc5200,#ff7043)',
    title: 'Strava Sync',
    desc: 'Connect Strava in Profile to auto-import Apple Watch, Garmin, and Fitbit workouts with routes and heart rate. TurboPrep activities upload back to Strava. Fully two-way.',
    highlight: null
  },
  {
    icon: '❤️', bg: 'linear-gradient(135deg,#ef4444,#f87171)',
    title: 'Health Sync — Apple Watch',
    desc: 'For live heart rate during workouts: your coach shares an Apple Shortcut link. Tap to add it, paste your sync token from Profile → Health Sync. It auto-runs when you start an Apple Watch workout and sends heart rate every 5 seconds. Steps and sleep sync daily.',
    highlight: null
  },
  {
    icon: '👤', bg: 'linear-gradient(135deg,#64748b,#94a3b8)',
    title: 'Your Profile',
    desc: 'Tap your avatar for Profile. Change name, year, tier, dark/light mode, Strava, health sync token, training report export. Redo this tour anytime from Profile → Help.',
    highlight: '#user-avatar-btn'
  },
  {
    icon: '🚀', bg: 'linear-gradient(135deg,var(--primary),#a3e635)',
    title: 'You\'re Ready!',
    desc: 'Do this now:\n\n1. Go to Fitness → Plans → start a training plan\n2. Tap a workout on Today → try Live Mode\n3. Hit Record to track your first ride\n4. Check back tomorrow for your streak\n\nRedo this tour anytime from Profile → Help.',
    highlight: null
  }
];
let tutorialStep = 0;
let tutorialOverlay = null;
function showTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}
function renderTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) { closeTutorial(); return; }
  // Remove existing
  if (tutorialOverlay) tutorialOverlay.remove();
  tutorialOverlay = document.createElement('div');
  tutorialOverlay.className = 'tutorial-overlay';
  tutorialOverlay.id = 'tutorial-overlay';
  // Highlight element
  let highlightHtml = '';
  if (step.highlight) {
    const el = document.querySelector(step.highlight);
    if (el) {
      const rect = el.getBoundingClientRect();
      highlightHtml = `<div class="tutorial-highlight" style="top:${rect.top - 4}px;left:${rect.left - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px"></div>`;
    }
  }
  const isFirst = tutorialStep === 0;
  const isLast = tutorialStep === TUTORIAL_STEPS.length - 1;
  const dots = TUTORIAL_STEPS.map((_, i) => `<div class="tutorial-dot${i === tutorialStep ? ' active' : ''}"></div>`).join('');
  const stepCount = `<div style="font-size:11px;color:var(--muted-fg);text-align:center;margin-bottom:8px">${tutorialStep + 1} of ${TUTORIAL_STEPS.length}</div>`;
  tutorialOverlay.innerHTML = `
    <div class="tutorial-backdrop" id="tut-backdrop"></div>
    ${highlightHtml}
    <div class="tutorial-card">
      ${stepCount}
      <div class="tutorial-icon" style="background:${step.bg}">${step.icon}</div>
      <div class="tutorial-title">${step.title}</div>
      <div class="tutorial-desc" style="max-height:180px;overflow-y:auto">${step.desc.replace(/\n/g, '<br>')}</div>
      <div class="tutorial-dots">${dots}</div>
      <div class="tutorial-btns">
        ${isFirst
          ? `<button class="tutorial-btn secondary" id="tut-skip">Skip Tour</button>
             <button class="tutorial-btn primary" id="tut-next">Let's Go →</button>`
          : isLast
            ? `<button class="tutorial-btn secondary" id="tut-back">← Back</button>
               <button class="tutorial-btn primary" id="tut-finish">Start Training!</button>`
            : `<button class="tutorial-btn secondary" id="tut-back">← Back</button>
               <button class="tutorial-btn primary" id="tut-next">Next →</button>`
        }
      </div>
      ${!isFirst && !isLast ? '<div style="text-align:center;margin-top:8px"><button id="tut-skip-mid" style="background:none;border:none;color:var(--muted-fg);font-size:12px;cursor:pointer;padding:4px">Skip tour</button></div>' : ''}
    </div>`;
  document.body.appendChild(tutorialOverlay);
  // Bindings
  $('tut-skip')?.addEventListener('click', () => closeTutorial());
  $('tut-skip-mid')?.addEventListener('click', () => closeTutorial());
  $('tut-next')?.addEventListener('click', () => { tutorialStep++; renderTutorialStep(); });
  $('tut-back')?.addEventListener('click', () => { tutorialStep--; renderTutorialStep(); });
  $('tut-finish')?.addEventListener('click', () => closeTutorial());
  $('tut-backdrop')?.addEventListener('click', () => { tutorialStep++; renderTutorialStep(); });
}
function closeTutorial() {
  if (tutorialOverlay) { tutorialOverlay.remove(); tutorialOverlay = null; }
  // Mark as seen
  try { localStorage.setItem('vf_tutorial_seen', 'true'); } catch(e) {}
  if (!demoMode && db && currentUser) {
    try { updateDoc(doc(db, 'users', currentUser.uid), { tutorialSeen: true }).catch(() => {}); } catch(e) {}
  }
}
function shouldShowTutorial() {
  // Check localStorage first (fast)
  try { if (localStorage.getItem('vf_tutorial_seen') === 'true') return false; } catch(e) {}
  // Check Firestore profile
  if (userProfile?.tutorialSeen) return false;
  return true;
}
// Offline queue sync — flush queued workouts when back online
async function flushOfflineQueue() {
  if (!db || !currentUser || demoMode) return;
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem('vf_offline_queue') || '[]'); } catch(e) { return; }
  if (queue.length === 0) return;
  let synced = 0;
  const remaining = [];
  for (const w of queue) {
    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), {
        name: w.name, type: w.type, duration: w.duration, distance: w.distance,
        heartRate: w.heartRate, notes: w.notes, rpe: w.rpe,
        date: Timestamp.fromDate(new Date(w.date)),
        createdAt: serverTimestamp(),
        source: 'offline'
      });
      synced++;
    } catch(e) {
      remaining.push(w);
    }
  }
  try { localStorage.setItem('vf_offline_queue', JSON.stringify(remaining)); } catch(e) {}
  if (synced > 0) showToast(synced + ' offline workout' + (synced > 1 ? 's' : '') + ' synced!', 'success');
}
window.addEventListener('online', () => { setTimeout(flushOfflineQueue, 2000); });
// Start
startApp();
// Register service worker for offline support — force update check
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Check for updates every page load
    reg.update().catch(() => {});
    // When a new SW is waiting, activate it immediately
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[TurboPrep] New service worker activated — refreshing');
            window.location.reload();
          }
        });
      }
    });
  }).catch(err => console.warn('SW registration failed:', err));
}
