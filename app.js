// VeloForge HPV Training App

// Load plans data (dynamic import with fallback)
let ALL_PLANS = [];
try {
  const plansMod = await import('./plans.js');
  ALL_PLANS = plansMod.ALL_PLANS || [];
} catch(e) {
  console.error('Failed to load plans.js:', e);
  ALL_PLANS = [];
}

// ============================================
// Firebase SDK Imports (dynamic, with fallback)
// ============================================
let initializeApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut, updateProfile,
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy,
    onSnapshot, addDoc, deleteDoc, serverTimestamp, Timestamp, where, getDocs,
    arrayUnion, arrayRemove;

let firebaseImportFailed = false;
try {
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  initializeApp = appMod.initializeApp;

  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  ({ getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } = authMod);

  const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  ({ getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, serverTimestamp, Timestamp, where, getDocs, arrayUnion, arrayRemove } = fsMod);
} catch(importErr) {
  console.error('Firebase SDK failed to load:', importErr);
  firebaseImportFailed = true;
}

// ============================================
// Firebase Config (PLACEHOLDER)
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyDa_kbJN__2AoVy1asHRv2Vr9dFglR5yhE",
  authDomain: "hpr-2026.firebaseapp.com",
  databaseURL: "https://hpr-2026-default-rtdb.firebaseio.com",
  projectId: "hpr-2026",
  storageBucket: "hpr-2026.firebasestorage.app",
  messagingSenderId: "146970781719",
  appId: "1:146970781719:web:698dfcb67e7f68b1de9452"
};

// ============================================
// Embedded Plan Data (54 plans, 272+ workouts)

// ============================================
// Embedded UI Copy
// ============================================
const UI_COPY = {"safetyBanners":{"Y7":{"title":"Year 7 Training Guide","ages":"Ages 12-13","frequency":"2-3 sessions/week","duration":"30-45 min","maxIntensity":"Easy to moderate only","guideline":"Listen up, Year 7s - we are keeping things easy and fun in these early sessions so you build great habits and fall in love with training. Every champion started right where you are, so show up, give your best effort, and most importantly stay safe by keeping the intensity comfortable throughout."},"Y8":{"title":"Year 8 Training Guide","ages":"Ages 13-14","frequency":"2-3 sessions/week","duration":"35-50 min","maxIntensity":"Easy to moderate only","guideline":"Year 8, you are building on the great foundation from last year and adding some machine work to the mix - keep the resistance light and always prioritize learning the correct technique over adding more weight. If something feels uncomfortable or painful, stop immediately and let your coach or trainer know."},"Y9":{"title":"Year 9 Training Guide","ages":"Ages 14-15","frequency":"3-4 sessions/week","duration":"40-60 min","maxIntensity":"One hard session per week maximum","guideline":"Year 9, this is where your training starts to get genuinely serious - you get one hard session per week and the rest stay at a solid but sustainable effort. That hard session is only effective if the other sessions are genuinely easier, so resist the urge to push hard every day and trust the plan."},"Y10":{"title":"Year 10 Training Guide","ages":"Ages 15-16","frequency":"3-4 sessions/week","duration":"45-70 min","maxIntensity":"1-2 hard sessions/week","guideline":"Year 10, you are training with real loads now and your body is capable of handling more than ever before - make sure you are fueling well with good food, sleeping 8-9 hours, and taking rest days seriously because that is when the fitness adaptations actually happen. Work hard in sessions and recover just as hard outside them."},"Y11":{"title":"Year 11 Training Guide","ages":"Ages 16-17","frequency":"4-5 sessions/week","duration":"50-80 min","maxIntensity":"Max effort 1 session/week","guideline":"Year 11, you are training at near-adult loads now and one session per week reaches true maximum effort - those sessions are the most powerful training stimulus you have, so make sure you are fully warmed up before every hard session and completely recovered before the next one. Listen to your body and tell your coach if anything does not feel right."},"Y12":{"title":"Year 12 Training Guide","ages":"Ages 17-18","frequency":"4-6 sessions/week","duration":"60-90 min","maxIntensity":"Max effort 1-2 sessions/week","guideline":"Year 12 athletes train at full adult competitive loads - up to two maximum-effort sessions per week means your recovery between sessions is just as important as the sessions themselves, so prioritize sleep, nutrition, and active recovery every single day. You have reached the top level of this program and you have earned it."}},"tierDescriptions":{"basic":"Starting out or getting back into it? No worries at all - the basic tier is built exactly for you, with shorter sessions, more rest between exercises, and a focus on learning how to move well before moving heavy.","average":"You have got a solid fitness base and you are ready for a real training challenge - the average tier delivers standard competitive loads that will genuinely push you and produce real results over the season.","intense":"Ready to push your limits and train like a serious HPV competitor? The intense tier brings higher loads, longer efforts, less rest, and advanced protocols that are designed for athletes who want to win on race day."},"todayGreetings":["Rise and grind, champion! Let us make today count.","Another day, another chance to get faster on the HPV!","Hey superstar! Your training plan is waiting - let us crush it.","Good to see you back! Consistency is what separates the good from the great.","Today is YOUR day. Let us build that race fitness!","Every session you complete is a deposit in your race-day performance bank. Let us make a big one today.","You showed up - and that is already 50% of the battle. Now let us make it count.","The best HPV racers are made in training, not on race day. Let us get to work.","Your competitors are training right now. Good thing you are too.","Small improvements every day equal massive results on race day. Let us improve today."],"emptyStates":{"noActivePlan":"You have not picked a training plan yet! Head over to the Plans tab and find the perfect program for your year level. I have got plans for every fitness level - whether you are just starting out or ready to dominate race day.","noWorkouts":"No workouts logged yet - but that is about to change! After your next session, tap that + button and log what you did. Tracking your progress is how we level up.","noPlanWorkouts":"This plan does not have any workouts scheduled for today. Take a rest day - your body needs recovery to get stronger. Come back tomorrow ready to go!"},"categoryDescriptions":{"invehicle":"Time to get in the HPV and ride! These sessions put you directly in the vehicle to build race-specific fitness, handling skills, and the kind of speed that only comes from real saddle time.","floor":"No gym? No problem! These bodyweight sessions build real strength, power, and mobility using nothing but your own body - you can smash these at home, at school, or anywhere you have a bit of floor space.","machine":"Hit the gym and use the machines to build serious race-winning leg strength and cardiovascular fitness - the spin bike, rowing machine, leg press, and elliptical are your best tools for becoming an unstoppable HPV racer."}};

// ============================================
// Race Data
// ============================================
const RACES = [
  {id:'r0', name:'Vic HPV Round 1 — Calder Park', date:'2026-03-14', location:'Calder Park Raceway, Keilor, VIC', distance:100, type:'endurance', notes:'9am–4pm. 7-hour endurance race. Round 1 of the 2026 Victorian HPV Grand Prix Series.', streamUrl:'https://www.youtube.com/watch?v=zqD56QVsxAE', footageUrls:[{label:'Full Race Livestream',url:'https://www.youtube.com/watch?v=zqD56QVsxAE',type:'stream'},{label:'Official Results — Alpine Timing',url:'https://www.alpinetiming.com.au/results/r653/',type:'results'}]},
  {id:'r1', name:'Vic HPV Round 2 — Casey Fields', date:'2026-05-02', location:'Casey Fields, Cranbourne East, VIC', distance:80, type:'endurance', notes:'10am–4pm. 6-hour endurance race. Round 2 of the 2026 Victorian HPV Grand Prix Series.'},
  {id:'r2', name:'Vic HPV Round 3 — Sandown Raceway', date:'2026-07-25', location:'Sandown Raceway, Springvale, VIC', distance:100, type:'endurance', notes:'9am–4pm. 7-hour endurance race. Round 3 of the 2026 Victorian HPV Grand Prix Series.'},
  {id:'r3', name:'Vic HPV Round 4 — Casey Fields', date:'2026-10-17', location:'Casey Fields, Cranbourne East, VIC', distance:120, type:'endurance', notes:'9am–5pm. 8-hour endurance race. Series finale — Round 4 of the 2026 Victorian HPV Grand Prix Series.'},
  {id:'r4', name:'Energy Breakthrough — Maryborough 24hr', date:'2026-11-18', location:'Maryborough, VIC', distance:900, type:'multi_day', notes:'18–22 November. The flagship 24-hour HPV endurance race on the 1.58km Maryborough street circuit. Teams of 8 riders.'},
];

// ============================================
// App State
// ============================================
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

// Strava integration
const STRAVA_CLIENT_ID = '213628'; // Set your Strava API client ID here
const STRAVA_REDIRECT_URI = 'https://veloforge.netlify.app';
let stravaTokens = null; // { access_token, refresh_token, expires_at, athlete }
let stravaActivities = []; // cached recent activities
let userWorkouts = [];
let userChecklist = {};
let workoutsUnsubscribe = null;
let checklistUnsubscribe = null;

// XP & Levelling
const XP_LEVELS = [
  { name: 'Rookie', min: 0, icon: '🟢' },
  { name: 'Racer', min: 100, icon: '🔵' },
  { name: 'Athlete', min: 300, icon: '🟣' },
  { name: 'Champion', min: 600, icon: '🟠' },
  { name: 'Legend', min: 1000, icon: '🔴' },
  { name: 'Elite', min: 1500, icon: '👑' }
];
function getXpLevel(xp) {
  let lvl = XP_LEVELS[0];
  for (const l of XP_LEVELS) { if (xp >= l.min) lvl = l; }
  const idx = XP_LEVELS.indexOf(lvl);
  const next = XP_LEVELS[idx + 1] || null;
  const pct = next ? Math.min(100, ((xp - lvl.min) / (next.min - lvl.min)) * 100) : 100;
  return { ...lvl, xp, next, pct, idx };
}
function calcXp() {
  let xp = 0;
  xp += userWorkouts.length * 10; // 10 XP per workout
  // Streak bonus
  const dates = [...new Set(userWorkouts.map(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    return d ? d.toISOString().split('T')[0] : null;
  }).filter(Boolean))].sort();
  let streak = 0, best = 0, cur = 0;
  dates.forEach((d, i) => {
    if (i === 0) { cur = 1; } else {
      const diff = (new Date(d) - new Date(dates[i-1])) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > best) best = cur;
  });
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
      if (done >= total && total > 0) xp += 75; // completed plan bonus
    }
  }
  // RPE logging bonus (5 XP per workout with RPE)
  xp += userWorkouts.filter(w => w.rpe).length * 5;
  return xp;
}

// Personal Goals
let userGoals = []; // [{id, type, target, current, label, createdAt}]
function loadGoals() {
  try { userGoals = JSON.parse(localStorage.getItem('vf_goals') || '[]'); } catch(e) { userGoals = []; }
}
function saveGoals() {
  try { localStorage.setItem('vf_goals', JSON.stringify(userGoals)); } catch(e) {}
}

// Team Challenges
let activeChallenge = null; // {id, title, type, startDate, endDate, teams: {teamId: {name, score}}}

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

// ============================================
// Initialize Firebase
// ============================================
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

// ============================================
// Demo Mode
// ============================================
let demoMode = false;
function enterDemoMode() {
  demoMode = true;
  firebaseReady = false;
  currentUser = { uid: 'demo-user', email: 'demo@veloforge.app', displayName: 'Demo Rider' };
  userProfile = { displayName: 'Demo Rider', email: 'demo@veloforge.app', yearLevel: 'Y9', fitnessLevel: 'average', activePlanId: 'invehicle-y9-average', teamId: null, teamName: null };
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

// ============================================
// DOM Helpers
// ============================================
const $ = id => document.getElementById(id);
function show(el) { if (typeof el === 'string') el = $(el); if (!el) return; el.classList.remove('hidden'); el.style.display = ''; }
function hide(el) { if (typeof el === 'string') el = $(el); if (!el) return; el.classList.add('hidden'); el.style.display = 'none'; }
function showLoading(text='Loading...') { $('loading-text').textContent = text; show('loading-overlay'); }
function hideLoading() { hide('loading-overlay'); }

// ============================================
// Auth UI
// ============================================
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
$('show-signup').addEventListener('click', showAuthSignup);
$('show-login').addEventListener('click', showAuthLogin);
$('demo-mode-btn').addEventListener('click', enterDemoMode);

$('login-btn').addEventListener('click', async () => {
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

$('signup-btn').addEventListener('click', async () => {
  const name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const yearLevel = $('signup-year').value;
  const tier = document.querySelector('input[name="signup-tier"]:checked').value;

  if (!name || !email || !password) {
    $('signup-error').textContent = 'Please fill in all fields.';
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
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName: name,
      email: email,
      yearLevel: yearLevel,
      fitnessLevel: tier,
      activePlanId: null,
      teamId: null,
      teamName: null,
      createdAt: serverTimestamp()
    });
  } catch(e) {
    hideLoading();
    btn.disabled = false;
    $('signup-error').textContent = friendlyError(e.code);
    show('signup-error');
  }
});

$('logout-btn').addEventListener('click', async () => {
  closeUserMenu();
  try {
    if (workoutsUnsubscribe) { workoutsUnsubscribe(); workoutsUnsubscribe = null; }
    if (checklistUnsubscribe) { checklistUnsubscribe(); checklistUnsubscribe = null; }
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

// ============================================
// User Menu
// ============================================
$('user-avatar-btn').addEventListener('click', (e) => {
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

$('user-menu-overlay').addEventListener('click', closeUserMenu);

// ============================================
// Tab Navigation — Enhanced QoL
// ============================================

// --- Feature 3: Remember scroll position per tab ---
const scrollPositions = {};

// --- Feature 6: Remember last active tab on reload ---
try {
  const saved = localStorage.getItem('vf_lastTab');
  if (saved && ['today','fitness','races','team','admin'].includes(saved)) {
    currentPage = saved;
  }
  const savedFitSub = localStorage.getItem('vf_fitnessSub');
  if (savedFitSub && ['workouts','plans','demos','myplans'].includes(savedFitSub)) {
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
    case 'today': renderToday(); break;
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
  const dc = $('demos-content');
  const mc = $('myplans-content');
  wc.style.display = 'none';
  pc.style.display = 'none';
  dc.style.display = 'none';
  mc.style.display = 'none';
  

  if (fitnessSubTab === 'workouts') {
    wc.style.display = '';
    
    renderWorkouts();
  } else if (fitnessSubTab === 'plans') {
    pc.style.display = '';
    renderPlans();
  } else if (fitnessSubTab === 'demos') {
    dc.style.display = '';
    renderDemonstration();
  } else if (fitnessSubTab === 'myplans') {
    mc.style.display = '';
    renderMyPlans();
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
const fitSubOrder = ['workouts', 'plans', 'demos', 'myplans'];
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
    // Reload data
    renderCurrentPage();
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

// ============================================
// DEMONSTRATION TAB
// ============================================
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

// ============================================
// MY PLANS TAB (AI-generated custom plans)
// ============================================
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

// ============================================
// TODAY PAGE
// ============================================
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
  html += '<div class="challenge-meta">' + (daysLeft > 0 ? daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' remaining' : 'Challenge ended!') + '</div>';
  teams.sort((a, b) => b.score - a.score);
  teams.forEach((t, i) => {
    const pct = maxScore > 0 ? (t.score / maxScore) * 100 : 0;
    html += '<div class="challenge-team">';
    html += '<div class="challenge-team-name">' + (i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '') + escHtml(t.name) + '</div>';
    html += '<div class="challenge-team-bar"><div class="challenge-team-fill" style="width:' + pct + '%;background:' + (colors[i] || colors[4]) + '"></div></div>';
    html += '<div class="challenge-team-score">' + t.score + '</div>';
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
  teamFeedCache.slice(0, 8).forEach(item => {
    const initials = (item.name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    html += '<div class="feed-item">';
    html += '<div class="feed-avatar">' + initials + '</div>';
    html += '<div class="feed-body"><div class="feed-name">' + escHtml(item.name || 'Unknown') + '</div>';
    html += '<div class="feed-action">' + escHtml(item.action) + '</div>';
    html += '<div class="feed-time">' + item.timeAgo + '</div></div></div>';
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

  // === BUILD HTML — clean layout ===
  let html = '';

  // Header: date + level badge
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div class="today-date" style="margin:0">${dateStr}</div>
    <div style="font-size:12px;font-weight:700;color:var(--primary);display:flex;align-items:center;gap:4px">${lvl.icon} ${lvl.name} · ${xp} XP</div>
  </div>`;

  // XP progress bar (thin)
  html += `<div style="height:4px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;margin-bottom:12px"><div style="height:100%;width:${lvl.pct}%;background:linear-gradient(90deg,var(--primary),#a3e635);border-radius:99px;transition:width .6s"></div></div>`;

  // Announcements (compact)
  const activeAnns = adminAnnouncements.filter(a => a.active);
  activeAnns.forEach(a => {
    html += `<div class="announce-banner"><div class="announce-banner-row"><div class="announce-banner-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3z"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div class="announce-banner-body"><div class="announce-banner-title">${escHtml(a.title)}</div><div class="announce-banner-msg">${escHtml(a.message)}</div></div></div></div>`;
  });

  // Stats row
  html += `<div class="today-stats-row">
    <div class="today-stat"><span class="today-stat-val">${streak}</span><span class="today-stat-lbl">streak</span></div>
    <div class="today-stat-sep"></div>
    <div class="today-stat"><span class="today-stat-val">${workoutsThisWeek}</span><span class="today-stat-lbl">this week</span></div>
    <div class="today-stat-sep"></div>
    <div class="today-stat"><span class="today-stat-val">${totalWorkouts}</span><span class="today-stat-lbl">total</span></div>
  </div>`;

  // Streak badges (compact)
  const badgeLevels = [{days:7,icon:'🔥',label:'7d'},{days:14,icon:'⚡',label:'14d'},{days:30,icon:'🏆',label:'30d'},{days:60,icon:'💎',label:'60d'},{days:100,icon:'👑',label:'100d'}];
  const earnedBadges = badgeLevels.filter(b => streak >= b.days);
  if (earnedBadges.length > 0) {
    html += '<div class="streak-badges">' + earnedBadges.map(b => `<div class="streak-badge earned">${b.icon} ${b.label}</div>`).join('') + '</div>';
  }

  // Team Challenge (prominent if active)
  html += renderTeamChallenge();

  // Race countdown
  const allRaces = getActiveRaces();
  const todayStr2 = now.toISOString().split('T')[0];
  const futureRaces = allRaces.filter(r => r.date >= todayStr2).sort((a,b) => a.date.localeCompare(b.date));
  const nextRace = futureRaces[0];
  if (nextRace) {
    const raceDate = new Date(nextRace.date + 'T09:00:00+10:00');
    const diffDays = Math.max(0, Math.floor((raceDate - now) / 86400000));
    html += `<div class="today-race-row"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="width:16px;height:16px;flex-shrink:0"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg><span class="today-race-name">${escHtml(nextRace.name)}</span><span class="today-race-days"><strong>${diffDays}</strong> day${diffDays!==1?'s':''}</span></div>`;
  }

  // TODAY'S TRAINING
  if (activePlan) {
    const pdData = getPlanDisplayData(activePlan);
    const totalPlanWorkouts = activePlan.workouts.length;
    let completedPlanWorkouts = 0;
    activePlan.workouts.forEach((w, i) => {
      const k = activePlanId + '-' + w.week + '-' + w.day + '-' + (activePlan.workouts.filter((ww, ii) => ii < i && ww.week === w.week && ww.day === w.day).length);
      if (userChecklist[k]) completedPlanWorkouts++;
    });
    const progressPct = totalPlanWorkouts > 0 ? Math.round((completedPlanWorkouts / totalPlanWorkouts) * 100) : 0;

    html += `<div class="section-title" style="margin-top:4px">Today's Training</div>`;
    html += `<div class="plan-progress"><div class="plan-progress-text"><span>${escHtml(pdData.name)}</span><span>${completedPlanWorkouts}/${totalPlanWorkouts} · ${progressPct}%</span></div><div class="plan-progress-bar"><div class="plan-progress-fill" style="width:${progressPct}%"></div></div></div>`;

    const dayMap = {'Mon':1,'Tue':2,'Wed':3,'Thu':4,'Fri':5,'Sat':6,'Sun':0};
    const todayDay = now.getDay();
    const todayWorkouts = activePlan.workouts.filter(w => dayMap[w.day] === todayDay);

    if (todayWorkouts.length > 0) {
      html += '<div class="space-y">';
      todayWorkouts.forEach((origW, i) => {
        const globalIdx = activePlan.workouts.indexOf(origW);
        const w = getWorkoutData(activePlanId, globalIdx, origW);
        w.week = origW.week; w.day = origW.day;
        const checkKey = activePlanId + '-' + origW.week + '-' + origW.day + '-' + i;
        const isChecked = userChecklist[checkKey] === true;
        html += renderChecklistItem(w, checkKey, isChecked);
      });
      html += '</div>';
    } else {
      html += `<div class="today-rest"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:20px;height:20px;color:var(--muted-fg)"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg><span>Rest day — no training scheduled.</span></div>`;
    }
  } else {
    const recHtml = renderPlanRecommendation();
    if (recHtml) {
      html += recHtml;
    } else {
      html += `<div class="today-no-plan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;color:var(--primary)"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><div><strong>No plan active</strong></div><div style="font-size:12px;color:var(--muted-fg)">Go to Fitness → Plans to pick one.</div></div>`;
    }
  }

  // Personal Goals (compact)
  html += renderGoals();

  // Collapsible "More Stats" section
  const moreOpen = localStorage.getItem('vf_more_open') === 'true';
  html += `<div class="section-card" style="margin-top:12px"><div class="section-title" id="more-toggle" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none">More Stats <span style="font-size:16px;transition:transform .2s;transform:rotate(${moreOpen ? '0' : '-90'}deg)">▾</span></div>`;
  html += `<div id="more-body" style="${moreOpen ? '' : 'display:none'}">`;

  // Progress chart
  if (totalWorkouts > 0) {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const wStart2 = new Date(now);
      wStart2.setDate(now.getDate() - now.getDay() - (i * 7));
      wStart2.setHours(0,0,0,0);
      const wEnd = new Date(wStart2);
      wEnd.setDate(wEnd.getDate() + 7);
      const count = userWorkouts.filter(w => {
        const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
        return d && d >= wStart2 && d < wEnd;
      }).length;
      weeks.push({ count, label: wStart2.getDate() + '/' + (wStart2.getMonth()+1), isCurrent: i === 0 });
    }
    const maxCount = Math.max(...weeks.map(w => w.count), 1);
    html += `<div class="progress-chart"><div class="progress-chart-title">Workouts per week</div><div class="chart-bars">${weeks.map(w => `<div class="chart-bar-col"><div class="chart-bar-val">${w.count || ''}</div><div class="chart-bar${w.count > 0 ? ' has-data' : ''}${w.isCurrent ? ' current' : ''}" style="height:${Math.max(2, (w.count / maxCount) * 60)}px"></div><div class="chart-bar-label">${w.label}</div></div>`).join('')}</div></div>`;
  }

  // Personal Bests
  html += renderPersonalBests(now, totalWorkouts, streak);

  // Calendar
  html += renderWorkoutCalendar(now);

  // Team feed
  html += renderTeamFeed();

  html += '</div></div>'; // close more-body + section-card

  c.innerHTML = html;

  // Bind "More Stats" toggle
  const moreToggle = $('more-toggle');
  if (moreToggle) {
    moreToggle.addEventListener('click', () => {
      const body = $('more-body');
      const chevron = moreToggle.querySelector('span');
      if (!body) return;
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : '';
      if (chevron) chevron.style.transform = 'rotate(' + (isOpen ? '-90' : '0') + 'deg)';
      localStorage.setItem('vf_more_open', isOpen ? 'false' : 'true');
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
      if (demoMode) { userProfile.activePlanId = planId; renderToday(); return; }
      if (db && currentUser) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), { activePlanId: planId });
          userProfile.activePlanId = planId;
          showToast('Plan activated!', 'success');
          renderToday();
        } catch(e) { showToast('Failed to activate plan.', 'error'); }
      }
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
}

function renderChecklistItem(workout, key, isChecked) {
  const intensityClass = 'intensity-' + workout.intensity;
  const shortDesc = workout.description && workout.description.length > 120 ? workout.description.substring(0, 120).trim() + '...' : (workout.description || '');
  return `
    <div class="checklist-item${isChecked?' checked':''}">
      <div class="cl-check" data-key="${key}">
        <div class="cl-box${isChecked?' done':''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div class="cl-info">
        <div class="cl-title">${workout.name} <span class="intensity-dot ${intensityClass}"></span></div>
        ${shortDesc ? '<div class="cl-desc">' + escHtml(shortDesc) + '</div>' : ''}
        <div class="cl-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${workout.duration} min · Week ${workout.week}
          <button class="cl-timer-btn" data-timer-name="${escHtml(workout.name)}" data-timer-dur="${workout.duration || 30}" data-timer-exercises='${workout.exercises ? JSON.stringify(workout.exercises).replace(/'/g,"&#39;") : "[]"}'>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Timer
          </button>
        </div>
      </div>
    </div>
  `;
}

async function toggleChecklist(key) {
  if (!currentUser) return;
  const newVal = !userChecklist[key];
  userChecklist[key] = newVal;
  renderToday();
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

// ============================================
// EXPORT TRAINING REPORT
// ============================================
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
<h1>VeloForge Training Report</h1>
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

// ============================================
// AI COACH
// ============================================
let aiChatHistory = [];

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

$('ai-fab').addEventListener('click', () => { haptic('light'); openAiCoach(); });
$('ai-close-btn').addEventListener('click', closeAiCoach);

// Quick question buttons
document.querySelectorAll('.ai-quick-btn:not(.ai-gen-trigger)').forEach(btn => {
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

$('ai-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const msg = $('ai-input').value.trim();
    if (!msg) return;
    const input = $('ai-input');
    if (input.dataset.planMode === 'custom') {
      delete input.dataset.planMode;
      generateAiPlan(null, userProfile?.yearLevel || 'Y10', userProfile?.fitnessLevel || 'basic', msg);
      input.value = '';
    } else {
      sendAiMessage(msg);
    }
  }
});

$('ai-send-btn').addEventListener('click', () => {
  const msg = $('ai-input').value.trim();
  if (!msg) return;
  const input = $('ai-input');
  if (input.dataset.planMode === 'custom') {
    delete input.dataset.planMode;
    generateAiPlan(null, userProfile?.yearLevel || 'Y10', userProfile?.fitnessLevel || 'basic', msg);
    input.value = '';
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

// ============================================
// AI PLAN GENERATION
// ============================================
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

  const catNames = { invehicle: 'In Vehicle (HPV riding)', floor: 'Floor & Home (bodyweight)', machine: 'Fitness Machine (gym)' };
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
  if (fitnessSubTab === 'myplans') renderMyPlans();
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
  renderMyPlans();
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

// --- Team Activity Feed loader ---
function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return date.toLocaleDateString();
}

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
      title: 'Monthly Minutes Challenge',
      type: 'minutes',
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

// ============================================
// WORKOUT TIMER
// ============================================
let timerInterval = null;
let timerSeconds = 0;
let timerTotal = 0;
let timerRunning = false;
let timerExercises = []; // for machine workouts
let timerCurrentStep = -1;

// Audio beep using Web Audio API
function playBeep(freq, dur, count) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (let i = 0; i < (count || 1); i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq || 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + (dur || 0.15));
      osc.start(t);
      osc.stop(t + (dur || 0.15));
      t += (dur || 0.15) + 0.08;
    }
  } catch(e) {}
}

function updateTimerDisplay() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  $('timer-minutes').textContent = String(mins).padStart(2, '0');
  $('timer-seconds').textContent = String(secs).padStart(2, '0');
  // Progress bar
  if (timerTotal > 0) {
    const pct = Math.max(0, ((timerTotal - timerSeconds) / timerTotal) * 100);
    $('timer-progress').style.width = pct + '%';
  }
  // Running state
  const overlay = $('timer-overlay');
  if (timerRunning) overlay.classList.add('timer-running');
  else overlay.classList.remove('timer-running');
}

function timerTick() {
  if (timerSeconds <= 0) {
    stopTimer();
    playBeep(880, 0.2, 3);
    haptic('medium');
    $('timer-label').textContent = 'Done!';
    // Auto-advance to next step if in exercise mode
    if (timerExercises.length > 0 && timerCurrentStep < timerExercises.length - 1) {
      setTimeout(() => advanceTimerStep(), 1000);
    }
    return;
  }
  timerSeconds--;
  updateTimerDisplay();
  // Warning beep at 3, 2, 1
  if (timerSeconds <= 3 && timerSeconds > 0) {
    playBeep(660, 0.1, 1);
  }
}

function startTimer() {
  if (timerSeconds <= 0) return;
  timerRunning = true;
  $('timer-play-icon').style.display = 'none';
  $('timer-pause-icon').style.display = '';
  timerInterval = setInterval(timerTick, 1000);
  updateTimerDisplay();
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  $('timer-play-icon').style.display = '';
  $('timer-pause-icon').style.display = 'none';
  updateTimerDisplay();
}

function stopTimer() {
  pauseTimer();
  timerSeconds = 0;
  updateTimerDisplay();
}

function resetTimer() {
  pauseTimer();
  timerSeconds = timerTotal;
  $('timer-progress').style.width = '0%';
  updateTimerDisplay();
}

function setTimerDuration(seconds, label) {
  pauseTimer();
  timerSeconds = seconds;
  timerTotal = seconds;
  $('timer-label').textContent = label || '';
  $('timer-progress').style.width = '0%';
  updateTimerDisplay();
}

function advanceTimerStep() {
  timerCurrentStep++;
  renderTimerSteps();
  if (timerCurrentStep < timerExercises.length) {
    const ex = timerExercises[timerCurrentStep];
    const dur = parseExerciseDuration(ex);
    setTimerDuration(dur, ex.name + (ex.sets ? ' · ' + ex.sets + ' sets' : ''));
    startTimer();
  }
}

function parseExerciseDuration(ex) {
  // Try to extract seconds from duration string like "5 min", "30 sec", "2 min fast / 2 min easy"
  if (ex.duration) {
    const minMatch = ex.duration.match(/(\d+)\s*min/);
    if (minMatch) return parseInt(minMatch[1]) * 60;
    const secMatch = ex.duration.match(/(\d+)\s*sec/);
    if (secMatch) return parseInt(secMatch[1]);
  }
  // Default: 60 seconds per exercise
  return 60;
}

function renderTimerSteps() {
  const stepsEl = $('timer-steps');
  if (timerExercises.length === 0) { stepsEl.innerHTML = ''; return; }
  let html = '';
  timerExercises.forEach((ex, i) => {
    const state = i < timerCurrentStep ? 'done' : i === timerCurrentStep ? 'active' : '';
    const meta = [ex.duration, ex.sets ? ex.sets + ' sets' : '', ex.reps ? ex.reps + ' reps' : ''].filter(Boolean).join(' · ');
    html += `<div class="timer-step ${state}">
      <div class="timer-step-num">${i + 1}</div>
      <div class="timer-step-info">
        <div class="timer-step-name">${escHtml(ex.name)}</div>
        ${meta ? '<div class="timer-step-meta">' + escHtml(meta) + '</div>' : ''}
      </div>
    </div>`;
  });
  stepsEl.innerHTML = html;
}

function openWorkoutTimer(workoutName, durationMin, exercises) {
  const overlay = $('timer-overlay');
  overlay.style.display = 'flex';
  $('timer-workout-name').textContent = workoutName || 'Workout';

  timerExercises = exercises || [];
  timerCurrentStep = -1;

  if (timerExercises.length > 0) {
    // Machine workout with exercise steps — start first exercise
    $('timer-rest-presets').style.display = '';
    advanceTimerStep();
  } else {
    // Simple timer for the whole workout
    const totalSec = (durationMin || 30) * 60;
    setTimerDuration(totalSec, (durationMin || 30) + ' minute workout');
    $('timer-rest-presets').style.display = '';
    renderTimerSteps();
  }

  // Keep screen awake
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}

function closeWorkoutTimer() {
  pauseTimer();
  $('timer-overlay').style.display = 'none';
  timerExercises = [];
  timerCurrentStep = -1;
}

// Bind timer controls
$('timer-close').addEventListener('click', closeWorkoutTimer);
$('timer-play').addEventListener('click', () => {
  haptic('light');
  if (timerRunning) pauseTimer();
  else startTimer();
});
$('timer-reset').addEventListener('click', () => {
  haptic('light');
  resetTimer();
});
$('timer-skip').addEventListener('click', () => {
  haptic('light');
  if (timerExercises.length > 0 && timerCurrentStep < timerExercises.length - 1) {
    advanceTimerStep();
  } else {
    stopTimer();
    $('timer-label').textContent = 'Complete!';
    playBeep(880, 0.2, 2);
  }
});

// Rest timer presets
document.querySelectorAll('.timer-rest-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    haptic('light');
    const sec = parseInt(btn.dataset.rest);
    setTimerDuration(sec, 'Rest');
    startTimer();
  });
});

// ============================================
// WORKOUTS PAGE
// ============================================
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
    const types = ['ride','run','walk','gym'];
    const typeIcons = {ride:'🚴',run:'🏃',walk:'🚶',gym:'🏋️'};
    types.forEach(t => {
      const count = userWorkouts.filter(w => (w.type || 'ride') === t || (!w.type && t === 'ride')).length;
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
    userWorkouts.forEach((w, idx) => {
      const date = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
      const dateStr = date.toLocaleDateString('en-AU', {day:'numeric',month:'short'});
      const timeStr = date.toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'});
      const wType = w.type || 'ride';
      const isTracked = w.source === 'tracker';
      const isStrava = w.source === 'strava';
      const routeId = w.routeId || w.id;
      const hasRoute = (isTracked || isStrava) && storedRoutes[routeId] && storedRoutes[routeId].length > 1;
      const sourceIcon = isStrava ? '⬡ ' : isTracked ? '📍 ' : '';

      html += `<div class="card wo-card" data-wo-type="${wType}" data-wo-source="${w.source || 'manual'}">
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
              </div>
              <div style="font-size:11px;color:var(--muted-fg);margin-top:3px">${dateStr} · ${timeStr}</div>
            </div>
            <button class="wo-delete" data-id="${w._id}" aria-label="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
          ${hasRoute ? `<div class="activity-map-thumb" id="mini-map-${idx}" data-route-id="${routeId}"></div>` : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  }

  c.innerHTML = html;

  // Render mini maps for tracked activities
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
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(miniMap);
        const latlngs = route.map(p => [p[0], p[1]]);
        const polyline = L.polyline(latlngs, { color: '#BFFF00', weight: 3, opacity: 0.9 }).addTo(miniMap);
        // Start marker
        L.circleMarker(latlngs[0], { radius: 5, fillColor: '#22c55e', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(miniMap);
        // End marker
        L.circleMarker(latlngs[latlngs.length - 1], { radius: 5, fillColor: '#ef4444', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(miniMap);
        miniMap.fitBounds(polyline.getBounds(), { padding: [10, 10] });
      } catch(e) { console.warn('Mini map error:', e); }
    }, 100);
  });

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

  // Manual log button
  const manualBtn = $('manual-log-btn');
  if (manualBtn) {
    manualBtn.addEventListener('click', () => { haptic('light'); openWorkoutSheet(); });
  }
}

// ============================================
// FAB & Workout Log Sheet
// ============================================
// Record moved to nav tab

function openWorkoutSheet() {
  const today = new Date().toISOString().split('T')[0];
  $('sheet-content').innerHTML = `
    <div class="sheet-title">Log Workout</div>
    <div class="form-group">
      <label class="label" for="wo-name">Workout Name</label>
      <input class="input" type="text" id="wo-name" placeholder="e.g. Morning Ride">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="label" for="wo-type">Type</label>
        <select class="input" id="wo-type">
          <option value="Ride">Ride</option>
          <option value="Strength">Strength</option>
          <option value="Cardio">Cardio</option>
          <option value="Flexibility">Flexibility</option>
        </select>
      </div>
      <div class="form-group">
        <label class="label" for="wo-duration">Duration (min)</label>
        <input class="input" type="number" id="wo-duration" placeholder="45" min="1">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="label" for="wo-distance">Distance (km)</label>
        <input class="input" type="number" id="wo-distance" placeholder="Optional" min="0" step="0.1">
      </div>
      <div class="form-group">
        <label class="label" for="wo-hr">Avg Heart Rate</label>
        <input class="input" type="number" id="wo-hr" placeholder="Optional" min="0">
      </div>
    </div>
    <div class="form-group">
      <label class="label" for="wo-notes">Notes</label>
      <textarea class="input" id="wo-notes" rows="2" placeholder="Optional"></textarea>
    </div>
    <div class="form-group">
      <label class="label">How hard did it feel? (RPE)</label>
      <div class="rpe-row" id="rpe-row">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button type="button" class="rpe-btn" data-rpe="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="label" for="wo-date">Date</label>
      <input class="input" type="date" id="wo-date" value="${today}">
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="wo-save-btn">Save Workout</button>
  `;
  openSheet();

  // Bind RPE buttons
  let selectedRpe = 0;
  document.querySelectorAll('#rpe-row .rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRpe = parseInt(btn.dataset.rpe);
      document.querySelectorAll('#rpe-row .rpe-btn').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.rpe) === selectedRpe));
    });
  });

  $('wo-save-btn').addEventListener('click', () => saveWorkout(selectedRpe));
}

async function saveWorkout(rpe) {
  const name = $('wo-name').value.trim();
  const type = $('wo-type').value;
  const duration = parseInt($('wo-duration').value) || 0;
  const distance = parseFloat($('wo-distance').value) || null;
  const heartRate = parseInt($('wo-hr').value) || null;
  const notes = $('wo-notes').value.trim() || null;
  const dateVal = $('wo-date').value;
  const rpeVal = rpe || null;

  if (!name) { showToast('Please enter a workout name.', 'warn'); return; }
  if (!duration) { showToast('Please enter duration.', 'warn'); return; }

  closeSheet();
  const dateObj = dateVal ? new Date(dateVal + 'T12:00:00') : new Date();
  if (demoMode) {
    userWorkouts.unshift({ _id:'d'+Date.now(), name, type, duration, distance, heartRate, notes, rpe: rpeVal, date: dateObj, createdAt: new Date() });
    renderWorkouts();
    return;
  }
  showLoading('Saving workout...');
  try {
    await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), {
      name, type, duration, distance, heartRate, notes, rpe: rpeVal,
      date: Timestamp.fromDate(dateObj),
      createdAt: serverTimestamp()
    });
    hideLoading();
  } catch(e) {
    hideLoading();
    console.error('Save workout error:', e);
    showToast('Failed to save workout.', 'error');
  }
}

// ============================================
// Bottom Sheet
// ============================================
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

// ============================================
// PLANS PAGE
// ============================================
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
        showToast('Failed to activate plan.', 'error');
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
        showToast('Failed to cancel plan.', 'error');
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

// ============================================
// RACES PAGE
// ============================================
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

// ============================================
// TEAM PAGE
// ============================================
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
      { uid: 'demo', displayName: userProfile?.displayName || 'You', yearLevel: userProfile?.yearLevel || 'Y10', totalWorkouts: userWorkouts.length, streak: 0 },
      { uid: 'd1', displayName: 'Alex M.', yearLevel: 'Y11', totalWorkouts: 34, streak: 7 },
      { uid: 'd2', displayName: 'Sam K.', yearLevel: 'Y10', totalWorkouts: 28, streak: 5 },
      { uid: 'd3', displayName: 'Jordan T.', yearLevel: 'Y12', totalWorkouts: 22, streak: 3 },
      { uid: 'd4', displayName: 'Riley W.', yearLevel: 'Y9', totalWorkouts: 19, streak: 4 },
      { uid: 'd5', displayName: 'Chris B.', yearLevel: 'Y10', totalWorkouts: 15, streak: 2 },
      { uid: 'd6', displayName: 'Pat H.', yearLevel: 'Y11', totalWorkouts: 12, streak: 1 },
      { uid: 'd7', displayName: 'Taylor R.', yearLevel: 'Y8', totalWorkouts: 9, streak: 0 },
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

      entries.push({
        uid: d.id,
        displayName: u.displayName || 'Unknown',
        yearLevel: u.yearLevel || '',
        totalWorkouts: wCount,
        streak
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

  const sorted = [...globalLeaderboard].sort((a, b) => (b.totalWorkouts || 0) - (a.totalWorkouts || 0));
  const myUid = currentUser?.uid;

  // Find my rank
  const myIdx = sorted.findIndex(u => u.uid === myUid);
  const myRank = myIdx >= 0 ? myIdx + 1 : null;

  let html = '';

  // Podium: top 3
  if (sorted.length >= 3) {
    html += '<div class="lb-podium">';
    // 2nd place
    const s = sorted[1];
    html += `<div class="lb-podium-item lb-podium-2${s.uid === myUid ? ' lb-podium-me' : ''}">
      <div class="lb-podium-rank">2</div>
      <div class="lb-podium-avatar">${(s.displayName || '?')[0].toUpperCase()}</div>
      <div class="lb-podium-name">${escHtml(s.displayName)}</div>
      <div class="lb-podium-stat">${s.totalWorkouts} workouts</div>
    </div>`;
    // 1st place
    const f = sorted[0];
    html += `<div class="lb-podium-item lb-podium-1${f.uid === myUid ? ' lb-podium-me' : ''}">
      <div class="lb-podium-crown"><svg viewBox="0 0 24 24" fill="var(--primary)" stroke="none"><path d="M2.5 18.5l3-8 4.5 5 2-9 2 9 4.5-5 3 8z"/></svg></div>
      <div class="lb-podium-avatar lb-podium-avatar-1">${(f.displayName || '?')[0].toUpperCase()}</div>
      <div class="lb-podium-name">${escHtml(f.displayName)}</div>
      <div class="lb-podium-stat">${f.totalWorkouts} workouts</div>
    </div>`;
    // 3rd place
    const t = sorted[2];
    html += `<div class="lb-podium-item lb-podium-3${t.uid === myUid ? ' lb-podium-me' : ''}">
      <div class="lb-podium-rank">3</div>
      <div class="lb-podium-avatar">${(t.displayName || '?')[0].toUpperCase()}</div>
      <div class="lb-podium-name">${escHtml(t.displayName)}</div>
      <div class="lb-podium-stat">${t.totalWorkouts} workouts</div>
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
    html += '<thead><tr><th class="lb-rank">#</th><th>Name</th><th>Year</th><th style="text-align:right">Workouts</th><th style="text-align:right">Streak</th></tr></thead><tbody>';
    sorted.slice(startIdx).forEach((m, i) => {
      const rank = startIdx + i + 1;
      const isMe = m.uid === myUid;
      html += `<tr class="${isMe ? 'lb-me' : ''}">
        <td class="lb-rank">${rank}</td>
        <td class="lb-name">${escHtml(m.displayName)}</td>
        <td class="lb-year">${m.yearLevel || '—'}</td>
        <td class="lb-stat" style="text-align:right">${m.totalWorkouts || 0}</td>
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

// ============================================
// PROFILE PAGE + THEME + STRAVA
// ============================================

// --- Theme ---
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.classList.toggle('light-theme', currentTheme === 'light');
  try { localStorage.setItem('vf_theme', currentTheme); } catch(e) {}
  renderProfile(); // Re-render to update toggle state
}

// --- Profile Page ---
$('profile-menu-btn').addEventListener('click', () => {
  closeUserMenu();
  openProfile();
});
$('profile-close-btn').addEventListener('click', closeProfile);

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

  el.innerHTML = html;

  // Bindings
  $('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  $('profile-edit-name')?.addEventListener('click', () => {
    const newName = prompt('Enter your display name:', name);
    if (newName && newName.trim()) {
      updateProfileField('displayName', newName.trim());
    }
  });
  $('profile-edit-year')?.addEventListener('click', () => {
    const years = ['Y7','Y8','Y9','Y10','Y11','Y12'];
    const choice = prompt('Enter year level (Y7-Y12):', year);
    if (choice && years.includes(choice.toUpperCase())) {
      updateProfileField('yearLevel', choice.toUpperCase());
    }
  });
  $('profile-edit-tier')?.addEventListener('click', () => {
    const choice = prompt('Enter fitness tier (basic, average, intense):', userProfile?.fitnessLevel || 'basic');
    if (choice && ['basic','average','intense'].includes(choice.toLowerCase())) {
      updateProfileField('fitnessLevel', choice.toLowerCase());
    }
  });

  $('strava-connect-btn')?.addEventListener('click', stravaStartAuth);
  $('strava-disconnect-btn')?.addEventListener('click', stravaDisconnect);
  $('strava-sync-btn')?.addEventListener('click', () => {
    stravaFetchActivities().then(() => renderStravaActivities());
  });
  $('profile-export-btn')?.addEventListener('click', exportTrainingReport);

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

// ============================================
// STRAVA INTEGRATION
// ============================================
function stravaStartAuth() {
  if (!STRAVA_CLIENT_ID) { showToast('Strava Client ID not configured.', 'error'); return; }
  const scope = 'activity:read_all';
  const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&response_type=code&scope=${scope}&approval_prompt=auto`;
  window.location.href = url;
}

async function stravaHandleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  try {
    // Exchange code for tokens via Netlify Function
    const resp = await fetch('/.netlify/functions/strava-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!resp.ok) throw new Error('Token exchange failed');
    const data = await resp.json();
    stravaTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete: data.athlete || {}
    };
    // Save to Firestore
    if (currentUser && db && !demoMode) {
      await updateDoc(doc(db, 'users', currentUser.uid), { stravaTokens });
    }
    // Fetch activities
    await stravaFetchActivities();
    renderProfile();
  } catch(e) {
    console.error('Strava auth error:', e);
    showToast('Failed to connect Strava.', 'error');
  }
}

async function stravaRefreshToken() {
  if (!stravaTokens?.refresh_token) return false;
  try {
    const resp = await fetch('/.netlify/functions/strava-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: stravaTokens.refresh_token, grant_type: 'refresh_token' })
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    stravaTokens.access_token = data.access_token;
    stravaTokens.refresh_token = data.refresh_token;
    stravaTokens.expires_at = data.expires_at;
    if (currentUser && db && !demoMode) {
      await updateDoc(doc(db, 'users', currentUser.uid), { stravaTokens });
    }
    return true;
  } catch(e) { return false; }
}

async function stravaFetchActivities() {
  if (!stravaTokens?.access_token) return;

  // Check if token expired
  if (stravaTokens.expires_at && Date.now() / 1000 > stravaTokens.expires_at) {
    const refreshed = await stravaRefreshToken();
    if (!refreshed) { stravaDisconnect(); return; }
  }

  try {
    const resp = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=20', {
      headers: { 'Authorization': 'Bearer ' + stravaTokens.access_token }
    });
    if (resp.status === 401) {
      const refreshed = await stravaRefreshToken();
      if (refreshed) return stravaFetchActivities();
      stravaDisconnect(); return;
    }
    if (!resp.ok) throw new Error('Fetch failed');
    stravaActivities = await resp.json();
  } catch(e) {
    console.error('Strava fetch error:', e);
  }
}

function renderStravaActivities() {
  const list = $('strava-activities-list');
  if (!list) return;
  if (stravaActivities.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted-fg);padding:8px 0">No recent activities found.</div>';
    return;
  }

  // Check which activities are already imported
  const importedIds = new Set();
  userWorkouts.forEach(w => { if (w.stravaId) importedIds.add(w.stravaId); });

  let html = '';
  stravaActivities.slice(0, 10).forEach(a => {
    const date = new Date(a.start_date_local || a.start_date);
    const dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const dist = a.distance ? (a.distance / 1000).toFixed(1) + ' km' : '';
    const dur = a.moving_time ? Math.round(a.moving_time / 60) + ' min' : '';
    const isImported = importedIds.has(String(a.id));

    html += `<div class="strava-activity">
      <div class="strava-activity-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg></div>
      <div class="strava-activity-info">
        <div class="strava-activity-name">${escHtml(a.name || 'Activity')}</div>
        <div class="strava-activity-meta">${dateStr}${dist ? ' · ' + dist : ''}${dur ? ' · ' + dur : ''}</div>
      </div>
      ${isImported
        ? '<span class="strava-import-btn imported">Imported</span>'
        : `<button class="strava-import-btn" data-strava-id="${a.id}" data-strava-name="${escHtml(a.name || 'Strava Activity')}" data-strava-dur="${Math.round((a.moving_time || 0) / 60)}" data-strava-dist="${a.distance ? (a.distance / 1000).toFixed(1) : ''}" data-strava-date="${a.start_date_local || a.start_date}" data-strava-type="${a.type || 'Ride'}">Import</button>`
      }
    </div>`;
  });
  list.innerHTML = html;

  // Bind import buttons
  list.querySelectorAll('.strava-import-btn:not(.imported)').forEach(btn => {
    btn.addEventListener('click', async () => {
      const stravaId = btn.dataset.stravaId;
      const name = btn.dataset.stravaName;
      const duration = parseInt(btn.dataset.stravaDur) || 0;
      const distance = parseFloat(btn.dataset.stravaDist) || null;
      const dateStr = btn.dataset.stravaDate;
      const type = btn.dataset.stravaType === 'Ride' ? 'Ride' : btn.dataset.stravaType === 'Run' ? 'Cardio' : 'Ride';
      const dateObj = dateStr ? new Date(dateStr) : new Date();

      btn.textContent = 'Importing...';
      btn.disabled = true;

      if (demoMode) {
        userWorkouts.unshift({ _id: 'd' + Date.now(), name, type, duration, distance, heartRate: null, notes: 'Imported from Strava', rpe: null, stravaId: String(stravaId), date: dateObj, createdAt: new Date() });
      } else if (db && currentUser) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), {
            name, type, duration, distance, heartRate: null, notes: 'Imported from Strava', rpe: null,
            stravaId: String(stravaId),
            date: Timestamp.fromDate(dateObj),
            createdAt: serverTimestamp()
          });
        } catch(e) { console.error('Strava import error:', e); }
      }

      btn.textContent = 'Imported';
      btn.classList.add('imported');
      btn.disabled = true;
    });
  });
}

async function stravaDisconnect() {
  stravaTokens = null;
  stravaActivities = [];
  if (currentUser && db && !demoMode) {
    try { await updateDoc(doc(db, 'users', currentUser.uid), { stravaTokens: null }); } catch(e) {}
  }
  renderProfile();
}

// Load Strava tokens from user profile on login
function loadStravaTokens() {
  if (userProfile?.stravaTokens) {
    stravaTokens = userProfile.stravaTokens;
  }
}

// Auto-sync Strava activities on login
async function stravaAutoSync() {
  if (!stravaTokens?.access_token) return;
  try {
    await stravaFetchActivities();
    if (stravaActivities.length === 0) return;
    // Auto-import any new activities not already in workouts
    const importedIds = new Set();
    userWorkouts.forEach(w => { if (w.stravaId) importedIds.add(String(w.stravaId)); });
    let imported = 0;
    for (const a of stravaActivities) {
      if (importedIds.has(String(a.id))) continue;
      const name = a.name || 'Strava Activity';
      const duration = a.moving_time ? Math.round(a.moving_time / 60) : 0;
      const distance = a.distance ? parseFloat((a.distance / 1000).toFixed(2)) : null;
      const avgSpeed = a.average_speed ? parseFloat((a.average_speed * 3.6).toFixed(1)) : null;
      const dateObj = a.start_date_local ? new Date(a.start_date_local) : new Date();
      const typeMap = { Ride: 'ride', Run: 'run', Walk: 'walk', Hike: 'walk', WeightTraining: 'gym', Workout: 'gym' };
      const type = typeMap[a.type] || 'ride';
      const routeId = 'strava-' + a.id;
      // Decode and store polyline route
      if (a.map && a.map.summary_polyline) {
        try {
          const path = decodePolyline(a.map.summary_polyline);
          if (path.length > 1) {
            const routes = JSON.parse(localStorage.getItem('vf_routes') || '{}');
            routes[routeId] = path.map(p => [parseFloat(p[0].toFixed(5)), parseFloat(p[1].toFixed(5))]);
            const keys = Object.keys(routes);
            if (keys.length > 80) delete routes[keys[0]];
            localStorage.setItem('vf_routes', JSON.stringify(routes));
          }
        } catch(e) {}
      }
      const workout = {
        name, type, duration, distance, avgSpeed,
        notes: 'Synced from Strava',
        stravaId: String(a.id),
        routeId: routeId,
        source: 'strava',
        heartRate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        rpe: null
      };
      if (!demoMode && db && currentUser) {
        try {
          await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), {
            ...workout,
            date: Timestamp.fromDate(dateObj),
            createdAt: serverTimestamp()
          });
          imported++;
        } catch(e) { console.error('Strava auto-import error:', e); }
      } else if (demoMode) {
        userWorkouts.unshift({ ...workout, _id: 'd' + Date.now() + imported, date: dateObj });
        imported++;
      }
    }
    if (imported > 0) {
      showToast(imported + ' activit' + (imported > 1 ? 'ies' : 'y') + ' synced from Strava!', 'success');
    }
  } catch(e) { console.error('Strava auto-sync error:', e); }
}

// Decode Google encoded polyline → [[lat, lng], ...]
function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
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
    renderTeam();
  } catch(e) {
    hideLoading();
    console.error('Create team error:', e);
    showToast('Failed to create team.', 'error');
  }
}

async function joinTeam() {
  const code = $('team-code-input').value.trim().toUpperCase();
  if (!code || code.length !== 6) {
    $('join-team-error').textContent = 'Please enter a 6-character team code.';
    show('join-team-error');
    return;
  }
  if (!currentUser) return;

  if (demoMode) {
    $('join-team-error').textContent = 'Team not found. Check the code and try again.';
    show('join-team-error');
    return;
  }

  if (!db) return;
  hide('join-team-error');
  showLoading('Joining team...');
  try {
    const q = query(collection(db, 'teams'), where('code', '==', code));
    const snap = await getDocs(q);
    if (snap.empty) {
      hideLoading();
      $('join-team-error').textContent = 'Team not found. Check the code and try again.';
      show('join-team-error');
      return;
    }
    const teamDoc = snap.docs[0];
    const tid = teamDoc.id;
    const tData = teamDoc.data();

    await updateDoc(doc(db, 'teams', tid), { members: arrayUnion(currentUser.uid) });
    await updateDoc(doc(db, 'users', currentUser.uid), { teamId: tid, teamName: tData.name });
    userProfile.teamId = tid;
    userProfile.teamName = tData.name;
    closeSheet();
    await loadTeamData();
    hideLoading();
    renderTeam();
  } catch(e) {
    hideLoading();
    console.error('Join team error:', e);
    showToast('Failed to join team.', 'error');
  }
}

async function leaveTeam() {
  if (!currentUser || !userProfile?.teamId) return;

  if (demoMode) {
    teamData = null;
    teamMembers = [];
    userProfile.teamId = null;
    userProfile.teamName = null;
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
    renderTeam();
  } catch(e) {
    hideLoading();
    console.error('Leave team error:', e);
    showToast('Failed to leave team.', 'error');
  }
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
    teamData = { id: teamSnap.id, name: td.name, code: td.code, members: td.members || [] };

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

// ============================================
// Utilities
// ============================================
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

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

function escHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
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

// ============================================
// Firebase Listeners
// ============================================
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
      // Create default profile
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

// ============================================
// Auth State Observer
// ============================================
function startApp() {
  if (!initFirebase()) return;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      showLoading('Loading your data...');
      try {
        await loadUserProfile(user.uid);
        setupListeners(user.uid);
        // Load admin emails FIRST so checkAdmin has the full list
        await loadAdminEmails();
        await loadVideoOverrides();
        // Now check admin with full data
        checkAdmin(user.email);
        if (isAdmin) await loadAdminData();
        // Load dynamic data for all users
        await loadAnnouncements();
        await loadFirestoreRaces();
        await loadHiddenPlans();
        await loadTeamData();
        await loadUserRaceLogs();
        await loadRaceFootage();
        await loadRaceLogVideos();
        await loadExerciseOverrides();
        await loadPlanOverrides();
        await loadExerciseDemoVideos();
        setupAnnouncementListener(); // Real-time announcement notifications
        loadStravaTokens(); // Load Strava connection from profile
        stravaAutoSync(); // Auto-import new Strava activities (runs async, no await)
        await loadCustomPlans(); // Load AI-generated custom plans
        await loadTeamFeed(); // Load team activity feed
        await loadTeamChallenge(); // Load active team challenge
        loadGoals(); // Load personal goals from localStorage
        const initial = (userProfile?.displayName || user.displayName || user.email || 'U').charAt(0).toUpperCase();
        $('user-avatar-btn').textContent = initial;
      } catch(e) {
        console.error('Error loading user data after login:', e);
      }
      hideLoading();
      // Handle Strava OAuth callback
      if (window.location.search.includes('code=')) {
        stravaHandleCallback();
      }
      // Restore saved tab or default to today
      try {
        const savedTab = localStorage.getItem('vf_lastTab');
        if (savedTab && ['today','fitness','races','team','admin'].includes(savedTab)) {
          currentPage = savedTab;
        }
      } catch(e) {}
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const startPage = $('page-' + currentPage);
      if (startPage) startPage.classList.add('active');
      showMainApp();
      // Check training reminders
      checkTrainingReminder();
      // Request notification permission on first interaction
      requestNotificationPermission();
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
$('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-btn').click(); });
$('signup-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('signup-btn').click(); });



// ============================================
// ADMIN PANEL
// ============================================

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
  if (tab) tab.style.display = isAdmin ? '' : 'none';
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

// ============================================
// PUSH NOTIFICATIONS FOR ANNOUNCEMENTS
// ============================================
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
      reg.showNotification('VeloForge: ' + title, {
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
        const n = new Notification('VeloForge: ' + title, {
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
      const n = new Notification('VeloForge: ' + title, {
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
// --- Training Reminder Notifications ---
function checkTrainingReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (userWorkouts.length === 0) return;

  // Only remind once per day
  const today = new Date().toISOString().split('T')[0];
  const lastReminder = localStorage.getItem('vf_reminder_date');
  if (lastReminder === today) return;

  // Find most recent workout date
  let latestDate = null;
  userWorkouts.forEach(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    if (d && (!latestDate || d > latestDate)) latestDate = d;
  });
  if (!latestDate) return;

  const daysSince = Math.floor((Date.now() - latestDate.getTime()) / 86400000);

  if (daysSince >= 2) {
    localStorage.setItem('vf_reminder_date', today);
    const messages = [
      'Your streak is at risk! Log a workout today to keep it going.',
      'It\'s been ' + daysSince + ' days since your last session. Your competitors are training right now!',
      'Hey ' + (userProfile?.displayName || 'champ') + '! Time to get back into it. Even a short session counts.',
      'Don\'t break the chain! A quick workout today keeps the momentum going.'
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    try {
      new Notification('VeloForge Training Reminder', {
        body: msg,
        tag: 'training-reminder',
        requireInteraction: false
      });
    } catch(e) {}
  }

  // Also schedule periodic check via setInterval (every 4 hours while app is open)
  setInterval(() => {
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
    if (localStorage.getItem('vf_reminder_date') !== todayKey && now.getHours() >= 16) {
      // Afternoon reminder if no workout logged today
      const todayWorkouts = userWorkouts.filter(w => {
        const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
        return d && d.toISOString().split('T')[0] === todayKey;
      });
      if (todayWorkouts.length === 0 && Notification.permission === 'granted') {
        localStorage.setItem('vf_reminder_date', todayKey);
        try {
          new Notification('VeloForge', {
            body: 'No workout logged today yet. There\'s still time!',
            tag: 'afternoon-reminder'
          });
        } catch(e) {}
      }
    }
  }, 4 * 60 * 60 * 1000); // every 4 hours
}

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

// Register service worker for PWA notification support
if ('serviceWorker' in navigator) {
  const swCode = `
    self.addEventListener('notificationclick', e => {
      e.notification.close();
      e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
          if (list.length > 0) { list[0].focus(); return; }
          return clients.openWindow(e.notification.data?.url || '/');
        })
      );
    });
    self.addEventListener('install', e => self.skipWaiting());
    self.addEventListener('activate', e => e.waitUntil(clients.claim()));
  `;
  const swBlob = new Blob([swCode], { type: 'application/javascript' });
  navigator.serviceWorker.register(URL.createObjectURL(swBlob), { scope: '.' }).catch(() => {});
}
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

async function loadHiddenPlans() {
  if (!db) return;
  try {
    const hpSnap = await getDoc(doc(db, 'config', 'hiddenPlans'));
    hiddenPlans = new Set(hpSnap.exists() ? (hpSnap.data().ids || []) : []);
  } catch(e) {
    hiddenPlans = new Set();
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

function renderAdmin() {
  if (!isAdmin) return;
  const c = $('admin-content');
  const allTabs = [
    { id: 'announcements', label: 'Announcements' },
    { id: 'races', label: 'Races' },
    { id: 'users', label: 'Users' },
    { id: 'plans', label: 'Plans' },
    { id: 'coach', label: 'Coach' }
  ];
  // Filter tabs to only show features the current admin has access to
  const tabs = allTabs.filter(t => currentAdminPerms.includes(t.id));

  // If no tabs, show restricted message
  if (tabs.length === 0) {
    c.innerHTML = '<div class="page-title">Admin Panel</div><div class="empty-state" style="padding:32px 16px"><div class="empty-state-title">No Permissions</div><div class="empty-state-desc">Your admin account doesn\'t have any features enabled yet. Ask the owner to grant you access.</div></div>';
    return;
  }

  // If active tab not in allowed list, switch to first allowed
  if (!tabs.some(t => t.id === adminActiveTab)) adminActiveTab = tabs[0].id;

  let html = '<div class="page-title">Admin Panel</div>';
  html += '<div class="admin-tabs">';
  tabs.forEach(t => {
    html += `<button class="admin-tab${adminActiveTab === t.id ? ' active' : ''}" data-admin-tab="${t.id}">${t.label}</button>`;
  });
  html += '</div>';

  // Create section containers for allowed tabs only
  tabs.forEach(t => {
    html += '<div id="admin-' + t.id + '" class="admin-section' + (adminActiveTab === t.id ? ' active' : '') + '"></div>';
  });

  
  c.innerHTML = html;

  // Bind admin tabs
  c.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      adminActiveTab = btn.dataset.adminTab;
      renderAdmin();
    });
  });

  // Render active section
  switch (adminActiveTab) {
    case 'announcements': renderAdminAnnouncements(); break;
    case 'races': renderAdminRaces(); break;
    case 'users': renderAdminUsersMerged(); break;
    case 'plans': renderAdminPlansMerged(); break;
    case 'coach': renderCoachDashboard(); break;
  }
}

// --- COACH DASHBOARD ---
async function renderCoachDashboard() {
  const el = $('admin-coach');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div><div style="margin-top:8px;color:var(--muted-fg);font-size:13px">Loading student data...</div></div>';

  let students = [];
  try {
    if (demoMode) {
      students = [
        { name: 'Alex M.', year: 'Y11', tier: 'intense', workouts: 34, lastActive: new Date(Date.now() - 86400000), streak: 7, avgRpe: 7.2 },
        { name: 'Sam K.', year: 'Y10', tier: 'average', workouts: 28, lastActive: new Date(Date.now() - 172800000), streak: 5, avgRpe: 6.8 },
        { name: 'Jordan T.', year: 'Y12', tier: 'intense', workouts: 22, lastActive: new Date(Date.now() - 86400000 * 5), streak: 0, avgRpe: 8.1 },
        { name: 'Riley W.', year: 'Y9', tier: 'basic', workouts: 19, lastActive: new Date(Date.now() - 86400000 * 2), streak: 4, avgRpe: 5.5 },
        { name: 'Chris B.', year: 'Y10', tier: 'average', workouts: 15, lastActive: new Date(Date.now() - 86400000 * 8), streak: 0, avgRpe: null },
        { name: 'Pat H.', year: 'Y11', tier: 'basic', workouts: 12, lastActive: new Date(Date.now() - 86400000 * 12), streak: 0, avgRpe: 6.0 },
      ];
    } else if (db) {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const d of usersSnap.docs) {
        const u = d.data();
        let wCount = 0, lastDate = null, rpeSum = 0, rpeCount = 0;
        try {
          const wSnap = await getDocs(collection(db, 'users', d.id, 'workouts'));
          wCount = wSnap.size;
          wSnap.docs.forEach(wd => {
            const wData = wd.data();
            const dt = wData.date ? (wData.date.toDate ? wData.date.toDate() : new Date(wData.date)) : null;
            if (dt && (!lastDate || dt > lastDate)) lastDate = dt;
            if (wData.rpe) { rpeSum += wData.rpe; rpeCount++; }
          });
        } catch(e) {}
        students.push({
          name: u.displayName || 'Unknown',
          year: u.yearLevel || '',
          tier: u.fitnessLevel || 'basic',
          workouts: wCount,
          lastActive: lastDate,
          streak: 0,
          avgRpe: rpeCount > 0 ? (rpeSum / rpeCount) : null
        });
      }
    }
  } catch(e) {
    el.innerHTML = '<div style="padding:20px;color:var(--muted-fg)">Failed to load student data.</div>';
    return;
  }

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 86400000 * 3);
  const sevenDaysAgo = new Date(now.getTime() - 86400000 * 7);
  const fiveDaysAgo = new Date(now.getTime() - 86400000 * 5);

  // Coach notification for inactive students
  const needsFollowUp = students.filter(s => s.lastActive && s.lastActive < fiveDaysAgo && s.lastActive > new Date(now.getTime() - 86400000 * 30));
  if (needsFollowUp.length > 0 && Notification.permission === 'granted') {
    const lastNotif = localStorage.getItem('vf_coach_notif_date');
    const today = now.toISOString().split('T')[0];
    if (lastNotif !== today) {
      localStorage.setItem('vf_coach_notif_date', today);
      try {
        new Notification('VeloForge Coach Alert', {
          body: needsFollowUp.length + ' student' + (needsFollowUp.length > 1 ? 's haven\'t' : ' hasn\'t') + ' trained in 5+ days: ' + needsFollowUp.map(s => s.name).slice(0, 3).join(', ') + (needsFollowUp.length > 3 ? '...' : ''),
          icon: '🏋️',
          tag: 'coach-inactive'
        });
      } catch(e) {}
    }
  }

  // Sort options
  let coachSort = 'recent';
  function render(sort) {
    coachSort = sort || coachSort;
    const sorted = [...students].sort((a, b) => {
      if (coachSort === 'recent') return (b.lastActive || 0) - (a.lastActive || 0);
      if (coachSort === 'inactive') return (a.lastActive || 0) - (b.lastActive || 0);
      if (coachSort === 'workouts') return b.workouts - a.workouts;
      if (coachSort === 'rpe') return (b.avgRpe || 0) - (a.avgRpe || 0);
      return 0;
    });

    const activeCount = students.filter(s => s.lastActive && s.lastActive >= threeDaysAgo).length;
    const inactiveCount = students.filter(s => !s.lastActive || s.lastActive < sevenDaysAgo).length;

    let html = `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:10px">${students.length} students registered</div>`;

    html += `<div style="display:flex;gap:8px;margin-bottom:12px">
      <div style="flex:1;padding:10px;background:rgba(34,197,94,.1);border-radius:8px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#22c55e">${activeCount}</div>
        <div style="font-size:10px;color:var(--muted-fg)">Trained in last 3 days</div>
      </div>
      <div style="flex:1;padding:10px;background:rgba(239,68,68,.1);border-radius:8px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#ef4444">${inactiveCount}</div>
        <div style="font-size:10px;color:var(--muted-fg)">No activity 7+ days</div>
      </div>
    </div>`;

    // Inactive student alerts
    const inactiveStudents = students.filter(s => !s.lastActive || s.lastActive < sevenDaysAgo);
    if (inactiveStudents.length > 0) {
      html += `<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:12px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:6px">⚠️ Students needing follow-up</div>
        <div style="font-size:12px;color:var(--muted-fg)">${inactiveStudents.map(s => escHtml(s.name) + ' (' + (s.lastActive ? Math.floor((now - s.lastActive) / 86400000) + 'd ago' : 'never') + ')').join(', ')}</div>
      </div>`;
    }

    // Bulk message section
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px">Send Message to Students</div>
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        <button class="bulk-target-btn active" data-bulk-target="all" style="font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid var(--primary);background:var(--primary);color:var(--primary-fg);cursor:pointer;font-weight:600">All</button>
        ${['Y7','Y8','Y9','Y10','Y11','Y12'].map(y => `<button class="bulk-target-btn" data-bulk-target="${y}" style="font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);cursor:pointer">${y}</button>`).join('')}
        <button class="bulk-target-btn" data-bulk-target="inactive" style="font-size:11px;padding:4px 10px;border-radius:20px;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);cursor:pointer">Inactive Only</button>
      </div>
      <textarea id="bulk-msg-text" class="input" placeholder="Type your message to students..." style="width:100%;min-height:60px;resize:vertical;font-size:13px;margin-bottom:8px"></textarea>
      <button class="btn btn-primary" id="bulk-msg-send" style="font-size:12px;padding:8px 16px">Post as Announcement</button>
    </div>`;

    html += '<div class="coach-sort-bar">';
    html += '<button class="coach-sort-btn" id="coach-export-csv" style="background:var(--primary);color:var(--primary-fg);font-weight:700">⬇ Export CSV</button>';
    ['recent','inactive','workouts','rpe'].forEach(s => {
      const labels = { recent:'Most Recent', inactive:'Needs Follow-up', workouts:'Most Workouts', rpe:'Highest Effort' };
      html += `<button class="coach-sort-btn${coachSort === s ? ' active' : ''}" data-coach-sort="${s}">${labels[s]}</button>`;
    });
    html += '</div>';

    html += '<div class="coach-grid">';
    sorted.forEach(s => {
      const isActive = s.lastActive && s.lastActive >= threeDaysAgo;
      const isInactive = !s.lastActive || s.lastActive < sevenDaysAgo;
      const lastStr = s.lastActive ? getTimeAgo(s.lastActive.toISOString()) : 'Never';
      const tierColors = { basic:'#3b82f6', average:'#22c55e', intense:'#f97316' };
      const borderStyle = isInactive ? 'border-color:rgba(239,68,68,.3)' : '';
      html += `<div class="coach-card" style="${borderStyle}">
        <div class="coach-card-top">
          <div class="coach-card-name">${escHtml(s.name)}</div>
          <span class="coach-card-badge ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : isInactive ? 'Inactive' : 'Idle'}</span>
        </div>
        <div class="coach-card-stats">
          <span>${s.year} · <span style="color:${tierColors[s.tier] || '#3b82f6'}">${capitalize(s.tier)}</span></span>
          <span><strong>${s.workouts}</strong> workouts</span>
          ${s.avgRpe ? `<span>RPE <strong>${s.avgRpe.toFixed(1)}</strong></span>` : ''}
          <span>Last active: ${lastStr}</span>
        </div>
      </div>`;
    });
    html += '</div>';

    el.innerHTML = html;

    el.querySelectorAll('.coach-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => render(btn.dataset.coachSort));
    });
    const exportBtn = $('coach-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        let csv = 'Name,Year,Tier,Workouts,Avg RPE,Last Active\n';
        students.forEach(s => {
          csv += [
            '"' + (s.name || '').replace(/"/g, '""') + '"',
            s.year, capitalize(s.tier), s.workouts,
            s.avgRpe ? s.avgRpe.toFixed(1) : '',
            s.lastActive ? s.lastActive.toISOString().split('T')[0] : 'Never'
          ].join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'veloforge-students-' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        showToast('CSV downloaded!', 'success');
      });
    }
    // Bulk message target buttons
    let bulkTarget = 'all';
    el.querySelectorAll('.bulk-target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.bulk-target-btn').forEach(b => {
          b.style.background = 'var(--surface-alt)';
          b.style.color = 'var(--muted-fg)';
          b.style.borderColor = 'var(--border)';
        });
        btn.style.background = 'var(--primary)';
        btn.style.color = 'var(--primary-fg)';
        btn.style.borderColor = 'var(--primary)';
        bulkTarget = btn.dataset.bulkTarget;
      });
    });
    // Bulk message send
    const sendBtn = $('bulk-msg-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const text = $('bulk-msg-text')?.value?.trim();
        if (!text) { showToast('Enter a message.', 'warn'); return; }
        const title = bulkTarget === 'all' ? 'Coach Message'
          : bulkTarget === 'inactive' ? 'Coach Check-In'
          : 'Message for ' + bulkTarget;
        const newAnn = {
          id: Date.now().toString(),
          title: title,
          message: text + (bulkTarget !== 'all' ? ' [To: ' + bulkTarget + ']' : ''),
          date: new Date().toISOString(),
          by: userProfile?.displayName || 'Coach'
        };
        if (!demoMode && db) {
          try {
            const configRef = doc(db, 'config', 'announcements');
            const snap = await getDoc(configRef);
            const items = snap.exists() ? (snap.data().items || []) : [];
            items.unshift(newAnn);
            await setDoc(configRef, { items });
            showToast('Message posted as announcement!', 'success');
            $('bulk-msg-text').value = '';
          } catch(e) {
            showToast('Failed to send message.', 'error');
          }
        } else {
          adminAnnouncements.unshift(newAnn);
          showToast('Message posted (demo mode).', 'success');
          $('bulk-msg-text').value = '';
        }
      });
    }
  }

  render('recent');

  // --- Challenge Manager (below student list) ---
  const challengeEl = document.createElement('div');
  challengeEl.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:16px';
  let chHtml = '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:10px">🏆 Team Challenge Manager</div>';

  if (activeChallenge) {
    const cEnd = new Date(activeChallenge.endDate);
    const cDaysLeft = Math.max(0, Math.ceil((cEnd - new Date()) / 86400000));
    chHtml += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">${escHtml(activeChallenge.title || 'Active Challenge')}</div>
      <div style="font-size:11px;color:var(--muted-fg);margin-bottom:8px">${cDaysLeft > 0 ? cDaysLeft + ' days remaining' : 'Ended'} · Repeat: ${activeChallenge.repeat ? 'On' : 'Off'}</div>`;
    // Editable team scores
    const rawT = activeChallenge.teams || {};
    Object.entries(rawT).forEach(([key, val]) => {
      const tName = (val && val.name) || key;
      const tScore = (val && val.score) || 0;
      chHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input class="input ch-team-name" data-ch-key="${key}" value="${escHtml(tName)}" style="flex:1;font-size:12px;padding:6px 8px">
        <input class="input ch-team-score" data-ch-key="${key}" type="number" value="${tScore}" style="width:70px;font-size:12px;padding:6px 8px;text-align:center">
      </div>`;
    });
    chHtml += `<div style="display:flex;gap:6px;margin-top:8px">
      <button id="ch-save-scores" class="btn btn-primary" style="flex:1;font-size:12px;padding:8px">Save Changes</button>
      <button id="ch-reset-scores" class="btn" style="font-size:12px;padding:8px;background:var(--surface-alt);color:var(--muted-fg)">Reset Scores</button>
      <button id="ch-end-challenge" class="btn" style="font-size:12px;padding:8px;background:rgba(239,68,68,.1);color:#ef4444">End</button>
    </div></div>`;
  } else {
    chHtml += '<div style="font-size:12px;color:var(--muted-fg);margin-bottom:8px">No active challenge. Create one below.</div>';
  }

  // Create new challenge form
  chHtml += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px">${activeChallenge ? 'Start New Challenge' : 'Create Challenge'}</div>
    <input class="input" id="ch-new-title" type="text" placeholder="Challenge title" value="Monthly Minutes Challenge" style="margin-bottom:6px;width:100%;font-size:12px">
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <select class="input" id="ch-new-duration" style="flex:1;font-size:12px;padding:6px"><option value="7">1 Week</option><option value="14">2 Weeks</option><option value="30" selected>1 Month</option><option value="60">2 Months</option></select>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted-fg);white-space:nowrap"><input type="checkbox" id="ch-new-repeat" checked> Auto-repeat</label>
    </div>
    <div id="ch-new-teams" style="margin-bottom:8px">
      <div style="font-size:11px;color:var(--muted-fg);margin-bottom:4px">Teams:</div>
      ${[1,2,3,4,5].map(n => `<input class="input ch-new-team-name" type="text" placeholder="Team ${n} name" value="Team ${n}" style="margin-bottom:4px;width:100%;font-size:12px;padding:6px 8px">`).join('')}
    </div>
    <button id="ch-create-btn" class="btn btn-primary" style="width:100%;font-size:12px;padding:8px">Create Challenge</button>
  </div>`;

  challengeEl.innerHTML = chHtml;
  el.appendChild(challengeEl);

  // --- Challenge event handlers ---
  // Save score changes
  $('ch-save-scores')?.addEventListener('click', async () => {
    if (!activeChallenge || demoMode || !db) { showToast('Cannot save in demo mode.', 'warn'); return; }
    const updatedTeams = { ...activeChallenge.teams };
    challengeEl.querySelectorAll('.ch-team-name').forEach(inp => {
      const k = inp.dataset.chKey;
      if (updatedTeams[k]) updatedTeams[k].name = inp.value.trim() || k;
    });
    challengeEl.querySelectorAll('.ch-team-score').forEach(inp => {
      const k = inp.dataset.chKey;
      if (updatedTeams[k]) updatedTeams[k].score = parseInt(inp.value) || 0;
    });
    try {
      await setDoc(doc(db, 'config', 'activeChallenge'), { ...activeChallenge, teams: updatedTeams });
      activeChallenge.teams = updatedTeams;
      showToast('Challenge updated!', 'success');
    } catch(e) { showToast('Failed to save.', 'error'); }
  });

  // Reset all scores to 0
  $('ch-reset-scores')?.addEventListener('click', async () => {
    if (!activeChallenge || demoMode || !db) return;
    if (!confirm('Reset all team scores to 0?')) return;
    const reset = {};
    Object.entries(activeChallenge.teams || {}).forEach(([k, v]) => {
      reset[k] = { name: (v && v.name) || k, score: 0 };
    });
    try {
      await setDoc(doc(db, 'config', 'activeChallenge'), { ...activeChallenge, teams: reset });
      activeChallenge.teams = reset;
      showToast('Scores reset!', 'success');
      renderCoachDashboard();
    } catch(e) { showToast('Failed to reset.', 'error'); }
  });

  // End challenge
  $('ch-end-challenge')?.addEventListener('click', async () => {
    if (!activeChallenge || demoMode || !db) return;
    if (!confirm('End this challenge? It will be removed.')) return;
    try {
      await deleteDoc(doc(db, 'config', 'activeChallenge'));
      activeChallenge = null;
      showToast('Challenge ended.', 'success');
      renderCoachDashboard();
    } catch(e) { showToast('Failed to end challenge.', 'error'); }
  });

  // Create new challenge
  $('ch-create-btn')?.addEventListener('click', async () => {
    const title = $('ch-new-title')?.value?.trim();
    const days = parseInt($('ch-new-duration')?.value) || 30;
    const repeat = $('ch-new-repeat')?.checked || false;
    if (!title) { showToast('Enter a challenge title.', 'warn'); return; }
    const teamInputs = challengeEl.querySelectorAll('.ch-new-team-name');
    const teams = {};
    let idx = 1;
    teamInputs.forEach(inp => {
      const name = inp.value.trim();
      if (name) { teams['team' + idx] = { name, score: 0 }; idx++; }
    });
    if (Object.keys(teams).length < 2) { showToast('Need at least 2 teams.', 'warn'); return; }
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    const challenge = {
      title, type: 'minutes', repeat,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      teams
    };
    if (demoMode) {
      activeChallenge = challenge;
      showToast('Challenge created (demo).', 'success');
      renderCoachDashboard();
      return;
    }
    if (!db) return;
    try {
      await setDoc(doc(db, 'config', 'activeChallenge'), challenge);
      activeChallenge = challenge;
      showToast('Challenge created!', 'success');
      renderCoachDashboard();
    } catch(e) { showToast('Failed to create challenge.', 'error'); }
  });
}

// --- ANNOUNCEMENTS ---
function renderAdminAnnouncements() {
  const el = $('admin-announcements');
  let html = '';

  // Add form
  html += `
    <div class="card" style="margin-bottom:12px">
      <div class="admin-form">
        <div class="label">New Announcement</div>
        <input class="input" type="text" id="ann-title" placeholder="Title">
        <textarea class="input" id="ann-message" placeholder="Message for all students"></textarea>
        <button class="btn btn-primary" id="ann-add-btn" style="align-self:flex-start">Post Announcement</button>
      </div>
    </div>
  `;

  if (adminAnnouncements.length === 0) {
    html += '<div class="admin-empty">No announcements yet.</div>';
  } else {
    html += '<div class="card">';
    adminAnnouncements.forEach((a, i) => {
      html += `
        <div class="admin-item">
          <div class="admin-item-info">
            <div class="admin-item-title">${escHtml(a.title || 'Untitled')}</div>
            <div class="admin-item-meta">${escHtml(a.message || '').substring(0, 80)}${(a.message||'').length > 80 ? '...' : ''}</div>
          </div>
          <button class="admin-toggle${a.active ? ' on' : ''}" data-ann-idx="${i}" title="${a.active ? 'Active' : 'Inactive'}"></button>
          <button class="admin-del-btn" data-ann-del="${i}">Delete</button>
        </div>
      `;
    });
    html += '</div>';
  }
  el.innerHTML = html;

  // Bind add
  $('ann-add-btn').addEventListener('click', async () => {
    const title = $('ann-title').value.trim();
    const message = $('ann-message').value.trim();
    if (!title) { showToast('Enter a title.', 'warn'); return; }
    if (!message) { showToast('Enter a message.', 'warn'); return; }
    adminAnnouncements.unshift({ id: 'ann-' + Date.now(), title, message, active: true, createdAt: new Date().toISOString() });
    await saveAnnouncements();
    renderAdminAnnouncements();
  });

  // Bind toggles
  el.querySelectorAll('.admin-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.annIdx);
      adminAnnouncements[idx].active = !adminAnnouncements[idx].active;
      await saveAnnouncements();
      renderAdminAnnouncements();
    });
  });

  // Bind deletes
  el.querySelectorAll('[data-ann-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this announcement?')) return;
      const idx = parseInt(btn.dataset.annDel);
      adminAnnouncements.splice(idx, 1);
      await saveAnnouncements();
      renderAdminAnnouncements();
    });
  });
}

async function saveAnnouncements() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'announcements'), { items: adminAnnouncements });
  } catch(e) {
    console.error('Save announcements error:', e);
    showToast('Failed to save.', 'error');
  }
}

// --- RACES ---

// ============================================
// RACE FOOTAGE (Admin-managed)
// ============================================

async function loadRaceFootage() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'raceFootage'));
    raceFootage = snap.exists() ? (snap.data().footage || {}) : {};
  } catch(e) {
    raceFootage = {};
  }
}

async function saveRaceFootage() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'raceFootage'), { footage: raceFootage });
  } catch(e) {
    console.error('Save race footage error:', e);
    showToast('Failed to save footage links.', 'error');
  }
}

async function loadRaceLogVideos() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'raceLogVideos'));
    raceLogVideos = snap.exists() ? (snap.data().videos || []) : [];
  } catch(e) {
    raceLogVideos = [];
  }
}

async function saveRaceLogVideos() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'raceLogVideos'), { videos: raceLogVideos });
  } catch(e) {
    console.error('Save race log videos error:', e);
    showToast('Failed to save videos.', 'error');
  }
}

function renderRaceFootageSection(parentEl) {
  const races = getActiveRaces();
  let html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">';
  html += '<div class="label" style="margin-bottom:8px">Race Footage & Stream Links</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Add livestream and footage links for each race. These appear in the Race Log for all users.</div>';
  
  races.forEach(race => {
    const existing = raceFootage[race.id] || race.footageUrls || [];
    const isPast = race.date <= new Date().toISOString().split('T')[0];
    html += `
      <div class="footage-admin-item">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <strong style="font-size:13px;color:var(--text);flex:1">${escHtml(race.name)}</strong>
          ${isPast ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(191,255,0,0.15);color:#BFFF00;font-weight:600">DONE</span>' : '<span style="font-size:10px;color:var(--text-muted)">' + race.date + '</span>'}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${existing.length} link${existing.length !== 1 ? 's' : ''} attached</div>
        <div style="display:flex;gap:6px">
          <input class="input" type="url" placeholder="Paste stream/footage URL" style="flex:1;font-size:12px" data-footage-url="${race.id}">
          <input class="input" type="text" placeholder="Label" style="width:80px;font-size:12px" data-footage-label="${race.id}">
          <button class="admin-edit-btn" data-footage-add="${race.id}" style="flex-shrink:0">Add</button>
        </div>
        ${existing.length > 0 ? '<div style="margin-top:6px">' + existing.map((f, fi) => `
          <div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px">
            <span style="flex:1;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(f.label || f.url)}</span>
            <button class="admin-del-btn" data-footage-del="${race.id}:${fi}" style="font-size:11px">×</button>
          </div>
        `).join('') + '</div>' : ''}
      </div>
    `;
  });
  
  html += '</div>';
  
  // Create a container and append
  const footageDiv = document.createElement('div');
  footageDiv.innerHTML = html;
  parentEl.appendChild(footageDiv);
  
  // Bind add footage
  footageDiv.querySelectorAll('[data-footage-add]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const raceId = btn.dataset.footageAdd;
      const urlInput = footageDiv.querySelector(`[data-footage-url="${raceId}"]`);
      const labelInput = footageDiv.querySelector(`[data-footage-label="${raceId}"]`);
      const url = urlInput.value.trim();
      if (!url) { showToast('Paste a URL first.', 'warn'); return; }
      const label = labelInput.value.trim() || 'Race Footage';
      const type = url.includes('youtube') || url.includes('youtu.be') ? 'stream' : (url.includes('result') || url.includes('timing') ? 'results' : 'footage');
      if (!raceFootage[raceId]) raceFootage[raceId] = [];
      raceFootage[raceId].push({ label, url, type });
      await saveRaceFootage();
      renderAdminRaces();
    });
  });
  
  // Bind delete footage
  footageDiv.querySelectorAll('[data-footage-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [raceId, idxStr] = btn.dataset.footageDel.split(':');
      const idx = parseInt(idxStr);
      if (raceFootage[raceId]) {
        raceFootage[raceId].splice(idx, 1);
        if (raceFootage[raceId].length === 0) delete raceFootage[raceId];
        await saveRaceFootage();
        renderAdminRaces();
      }
    });
  });
}

function getYouTubeThumbUrl(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? 'https://img.youtube.com/vi/' + m[1] + '/mqdefault.jpg' : '';
}

function renderAdminRaceLogVideos(parentEl) {
  const races = getActiveRaces();
  let html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">';
  html += '<div class="label" style="margin-bottom:8px">Race Log Videos</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Add video links (YouTube, Vimeo, etc.) that appear in the Race Log for all users. Great for race highlights, team footage, and onboard camera.</div>';
  
  // Add video form
  html += `
    <div style="margin-bottom:12px">
      <input class="input" type="url" id="admin-video-url" placeholder="Paste video URL (YouTube, Vimeo, etc.)" style="font-size:12px;margin-bottom:6px">
      <input class="input" type="text" id="admin-video-title" placeholder="Video title" style="font-size:12px;margin-bottom:6px">
      <div style="display:flex;gap:6px;align-items:center">
        <select class="input" id="admin-video-race" style="font-size:12px;flex:1">
          <option value="">Link to race (optional)</option>
          ${races.map(r => '<option value="' + r.id + '">' + escHtml(r.name) + '</option>').join('')}
        </select>
        <button class="btn btn-primary" id="admin-video-add-btn" style="flex-shrink:0;padding:8px 16px;font-size:12px">Add Video</button>
      </div>
    </div>
  `;
  
  // List existing videos
  if (raceLogVideos.length > 0) {
    html += '<div class="video-admin-grid">';
    raceLogVideos.forEach((v, i) => {
      const raceName = v.raceId ? (races.find(r => r.id === v.raceId)?.name || '') : '';
      html += `
        <div class="video-admin-row">
          <div style="width:40px;height:30px;border-radius:4px;background:rgba(191,255,0,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;color:#BFFF00"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
          </div>
          <div class="video-info">
            <strong style="color:var(--text)">${escHtml(v.title)}</strong>
            ${raceName ? '<br><span style="font-size:11px">' + escHtml(raceName) + '</span>' : ''}
          </div>
          <button class="admin-del-btn" data-video-del="${i}" style="font-size:11px">×</button>
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px;border:1px dashed var(--border);border-radius:8px">No videos added yet</div>';
  }
  
  html += '</div>';
  
  const videosDiv = document.createElement('div');
  videosDiv.innerHTML = html;
  parentEl.appendChild(videosDiv);
  
  // Bind add video
  const addBtn = videosDiv.querySelector('#admin-video-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const url = videosDiv.querySelector('#admin-video-url').value.trim();
      const title = videosDiv.querySelector('#admin-video-title').value.trim();
      const raceId = videosDiv.querySelector('#admin-video-race').value;
      if (!url) { showToast('Paste a video URL first.', 'warn'); return; }
      if (!title) { showToast('Enter a video title.', 'warn'); return; }
      raceLogVideos.push({
        title,
        url,
        raceId: raceId || null,
        addedBy: currentUser?.email || 'admin',
        timestamp: new Date().toISOString()
      });
      await saveRaceLogVideos();
      renderAdminRaces();
    });
  }
  
  // Bind delete video
  videosDiv.querySelectorAll('[data-video-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.videoDel);
      if (!confirm('Delete this video?')) return;
      raceLogVideos.splice(idx, 1);
      await saveRaceLogVideos();
      renderAdminRaces();
    });
  });
}


function renderAdminRaces() {
  const el = $('admin-races');
  const races = getActiveRaces();
  let html = '';

  // Add form
  html += `
    <div class="card" style="margin-bottom:12px">
      <div class="admin-form">
        <div class="label">Add Race</div>
        <input class="input" type="text" id="race-name" placeholder="Race name">
        <input class="input" type="date" id="race-date">
        <input class="input" type="text" id="race-location" placeholder="Location">
        <input class="input" type="number" id="race-distance" placeholder="Distance (km)">
        <textarea class="input" id="race-notes" placeholder="Notes (time, details, etc.)"></textarea>
        <button class="btn btn-primary" id="race-add-btn" style="align-self:flex-start">Add Race</button>
      </div>
    </div>
  `;

  if (races.length === 0) {
    html += '<div class="admin-empty">No races configured.</div>';
  } else {
    html += '<div class="card">';
    races.forEach((r, i) => {
      html += `
        <div class="admin-item">
          <div class="admin-item-info">
            <div class="admin-item-title">${escHtml(r.name)}</div>
            <div class="admin-item-meta">${r.date} · ${escHtml(r.location || '')} · ${r.distance}km</div>
          </div>
          <button class="admin-del-btn" data-race-del="${i}">Delete</button>
        </div>
      `;
    });
    html += '</div>';
  }
  el.innerHTML = html;

  // Bind add
  $('race-add-btn').addEventListener('click', async () => {
    const name = $('race-name').value.trim();
    const date = $('race-date').value;
    const location = $('race-location').value.trim();
    const distance = parseInt($('race-distance').value) || 0;
    const notes = $('race-notes').value.trim();
    if (!name || !date) { showToast('Enter a name and date.', 'warn'); return; }
    const newRaces = [...(adminRaces || RACES)];
    newRaces.push({ id: 'r-' + Date.now(), name, date, location, distance, type: 'endurance', notes });
    newRaces.sort((a, b) => a.date.localeCompare(b.date));
    adminRaces = newRaces;
    await saveRaces();
    renderAdminRaces();
  });

  // Bind deletes
  el.querySelectorAll('[data-race-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this race?')) return;
      const idx = parseInt(btn.dataset.raceDel);
      const newRaces = [...(adminRaces || RACES)];
      newRaces.splice(idx, 1);
      adminRaces = newRaces;
      await saveRaces();
      renderAdminRaces();
    });
  });

  // --- Race Footage Management Section ---
  if (isAdmin) renderRaceFootageSection(el);
  // --- Race Log Videos Management ---
  if (isAdmin) renderAdminRaceLogVideos(el);
}

async function saveRaces() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'races'), { races: adminRaces });
  } catch(e) {
    console.error('Save races error:', e);
    showToast('Failed to save.', 'error');
  }
}

// --- USERS ---
function renderAdminUsersMerged() {
  const el = $('admin-users');
  if (!el) return;

  const subTabs = [
    { id: 'all', label: 'All Users' },
    { id: 'permissions', label: 'Admin Access' }
  ];

  let html = '<div style="display:flex;gap:6px;margin-bottom:14px">';
  subTabs.forEach(t => {
    html += `<button class="btn ${usersSubTab === t.id ? 'btn-primary' : 'btn-secondary'}" style="flex:1;font-size:12px;padding:8px 0;min-height:36px" data-users-sub="${t.id}">${t.label}</button>`;
  });
  html += '</div>';
  html += '<div id="users-sub-content"></div>';
  el.innerHTML = html;

  el.querySelectorAll('[data-users-sub]').forEach(btn => {
    btn.addEventListener('click', () => {
      usersSubTab = btn.dataset.usersSub;
      renderAdminUsersMerged();
    });
  });

  const sc = $('users-sub-content');
  switch (usersSubTab) {
    case 'all': renderUsersAll(sc); break;
    case 'permissions': renderUsersPermissions(sc); break;
  }
}

async function renderUsersAll(el) {
  el.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div><div style="margin-top:8px;color:var(--muted-fg);font-size:13px">Loading users...</div></div>';

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    allUsersCache = [];
    for (const d of usersSnap.docs) {
      const u = d.data();
      let wCount = 0;
      try {
        const wSnap = await getDocs(collection(db, 'users', d.id, 'workouts'));
        wCount = wSnap.size;
      } catch(e) {}
      allUsersCache.push({ uid: d.id, ...u, workoutCount: wCount });
    }
  } catch(e) {
    el.innerHTML = '<div class="admin-empty">Failed to load users.</div>';
    console.error('Load users error:', e);
    return;
  }

  let html = `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:10px">${allUsersCache.length} registered user${allUsersCache.length !== 1 ? 's' : ''}</div>`;

  if (allUsersCache.length === 0) {
    html += '<div class="admin-empty">No users yet.</div>';
  } else {
    allUsersCache.forEach(u => {
      const tierColors = { basic:'#3b82f6', average:'#22c55e', intense:'#f97316' };
      const tc = tierColors[u.fitnessLevel] || '#3b82f6';
      html += `
        <div class="card" style="margin-bottom:8px">
          <div class="card-pad" style="padding:12px 14px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <div style="font-size:15px;font-weight:600;color:var(--fg);flex:1">${escHtml(u.displayName || 'Unknown')}</div>
              <div style="font-size:11px;color:var(--muted-fg)">${escHtml(u.email || '')}</div>
            </div>
            <div class="admin-user-grid">
              <div class="admin-user-stat">Year: <strong>${u.yearLevel || '—'}</strong></div>
              <div class="admin-user-stat">Tier: <strong style="color:${tc}">${capitalize(u.fitnessLevel || 'basic')}</strong></div>
              <div class="admin-user-stat">Workouts: <strong>${u.workoutCount || 0}</strong></div>
              <div class="admin-user-stat">Team: <strong>${escHtml(u.teamName || 'None')}</strong></div>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <select class="input admin-year-select" data-uid="${u.uid}" style="flex:1;padding:6px 8px;font-size:12px">
                ${['Y7','Y8','Y9','Y10','Y11','Y12'].map(y => `<option value="${y}"${u.yearLevel === y ? ' selected' : ''}>${y}</option>`).join('')}
              </select>
              <select class="input admin-tier-select" data-uid="${u.uid}" style="flex:1;padding:6px 8px;font-size:12px">
                ${['basic','average','intense'].map(t => `<option value="${t}"${u.fitnessLevel === t ? ' selected' : ''}>${capitalize(t)}</option>`).join('')}
              </select>
              <button class="admin-edit-btn" data-user-save="${u.uid}">Save</button>
            </div>
          </div>
        </div>
      `;
    });
  }
  el.innerHTML = html;

  el.querySelectorAll('[data-user-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.userSave;
      const yearSel = el.querySelector(`.admin-year-select[data-uid="${uid}"]`);
      const tierSel = el.querySelector(`.admin-tier-select[data-uid="${uid}"]`);
      if (!yearSel || !tierSel) return;
      try {
        await updateDoc(doc(db, 'users', uid), { yearLevel: yearSel.value, fitnessLevel: tierSel.value });
        btn.textContent = 'Saved!';
        setTimeout(() => { btn.textContent = 'Save'; }, 1500);
      } catch(e) {
        console.error('Save user error:', e);
        showToast('Failed to save.', 'error');
      }
    });
  });
}

function renderUsersPermissions(el) {
  let html = '';

  // --- Add new admin form ---
  html += `
    <div class="card" style="margin-bottom:12px">
      <div class="admin-form">
        <div class="label">Grant Admin Access</div>
        <input class="input" type="email" id="perm-email" placeholder="user@example.com">
        <div class="label" style="margin-top:8px">Select Features</div>
        <div class="perm-feature-grid" id="perm-new-features">
          ${ALL_ADMIN_FEATURES.map(f => `
            <div class="perm-feature-toggle" data-feat="${f.id}">
              <div class="perm-check"><svg viewBox="0 0 24 24" fill="none" stroke="#0a0b0f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              <div class="perm-feature-label">${f.label}</div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary" id="perm-add-btn" style="flex:1">Add Admin</button>
          <button class="btn btn-secondary" id="perm-select-all" style="flex-shrink:0;font-size:12px">All</button>
        </div>
      </div>
    </div>
  `;

  // --- Owner card ---
  html += '<div style="font-size:13px;color:var(--muted-fg);margin-bottom:8px">Admin Accounts</div>';
  html += `
    <div class="perm-admin-card">
      <div class="perm-admin-header">
        <div class="perm-admin-email">${escHtml(ADMIN_EMAIL)}</div>
        <span class="admin-perm-badge">Owner</span>
      </div>
      <div class="perm-admin-tags">
        ${ALL_ADMIN_FEATURES.map(f => `<span class="perm-tag">${f.label}</span>`).join('')}
      </div>
    </div>
  `;

  // --- Each granted admin ---
  adminPerms.forEach((entry, i) => {
    const perms = entry.perms || [];
    html += `
      <div class="perm-admin-card">
        <div class="perm-admin-header">
          <div class="perm-admin-email">${escHtml(entry.email)}</div>
        </div>
        <div class="perm-feature-grid perm-edit-grid" data-perm-idx="${i}">
          ${ALL_ADMIN_FEATURES.map(f => `
            <div class="perm-feature-toggle${perms.includes(f.id) ? ' active' : ''}" data-feat="${f.id}" data-perm-idx="${i}">
              <div class="perm-check"><svg viewBox="0 0 24 24" fill="none" stroke="#0a0b0f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              <div class="perm-feature-label">${f.label}</div>
            </div>
          `).join('')}
        </div>
        <div class="perm-admin-actions" style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end">
          <button class="admin-edit-btn" data-perm-revoke="${i}">Revoke All</button>
          <button class="admin-del-btn" data-perm-del="${i}">Remove Admin</button>
        </div>
      </div>
    `;
  });

  // --- Legacy admins ---
  adminEmails.forEach((email, i) => {
    if (adminPerms.some(p => (p.email || '').toLowerCase() === (email || '').toLowerCase())) return;
    html += `
      <div class="perm-admin-card" style="border-color:var(--muted-fg)">
        <div class="perm-admin-header">
          <div class="perm-admin-email">${escHtml(email)}</div>
          <span style="font-size:11px;color:var(--muted-fg)">Legacy</span>
          <button class="admin-edit-btn" data-legacy-migrate="${i}">Upgrade</button>
          <button class="admin-del-btn" data-legacy-del="${i}">Remove</button>
        </div>
        <div class="perm-admin-tags">
          <span class="perm-tag" style="background:rgba(255,255,255,0.08);color:var(--muted-fg)">All features (legacy)</span>
        </div>
      </div>
    `;
  });

  el.innerHTML = html;

  // --- Bind new feature toggles ---
  el.querySelectorAll('#perm-new-features .perm-feature-toggle').forEach(tog => {
    tog.addEventListener('click', () => tog.classList.toggle('active'));
  });

  $('perm-select-all').addEventListener('click', () => {
    el.querySelectorAll('#perm-new-features .perm-feature-toggle').forEach(t => t.classList.add('active'));
  });

  $('perm-add-btn').addEventListener('click', async () => {
    const email = $('perm-email').value.trim().toLowerCase();
    if (!email || !email.includes('@')) { showToast('Enter a valid email.', 'warn'); return; }
    if (email === ADMIN_EMAIL.toLowerCase()) { showToast('This is already the owner account.', 'warn'); return; }
    if (adminPerms.some(e => (e.email || '').toLowerCase() === email)) { showToast('Already an admin.', 'warn'); return; }
    if (adminEmails.some(e => (e || '').toLowerCase() === email)) { showToast('Already an admin (legacy).', 'warn'); return; }

    const selectedPerms = [];
    el.querySelectorAll('#perm-new-features .perm-feature-toggle.active').forEach(t => {
      selectedPerms.push(t.dataset.feat);
    });
    if (selectedPerms.length === 0) { showToast('Select at least one permission.', 'warn'); return; }

    adminPerms.push({ email, perms: selectedPerms });
    await saveAdminEmails();
    renderAdminUsersMerged();
  });

  el.querySelectorAll('.perm-edit-grid .perm-feature-toggle').forEach(tog => {
    tog.addEventListener('click', async () => {
      const idx = parseInt(tog.dataset.permIdx);
      const feat = tog.dataset.feat;
      tog.classList.toggle('active');
      const entry = adminPerms[idx];
      if (tog.classList.contains('active')) {
        if (!entry.perms.includes(feat)) entry.perms.push(feat);
      } else {
        entry.perms = entry.perms.filter(p => p !== feat);
      }
      await saveAdminEmails();
    });
  });

  el.querySelectorAll('[data-perm-revoke]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.permRevoke);
      const entry = adminPerms[idx];
      if (!confirm(`Revoke all admin features from ${entry.email}?`)) return;
      entry.perms = [];
      await saveAdminEmails();
      renderAdminUsersMerged();
    });
  });

  el.querySelectorAll('[data-perm-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove admin access for this account entirely?')) return;
      const idx = parseInt(btn.dataset.permDel);
      adminPerms.splice(idx, 1);
      await saveAdminEmails();
      renderAdminUsersMerged();
    });
  });

  el.querySelectorAll('[data-legacy-migrate]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.legacyMigrate);
      const email = adminEmails[idx];
      adminPerms.push({ email, perms: ALL_ADMIN_FEATURES.map(f => f.id) });
      adminEmails.splice(idx, 1);
      saveAdminEmails();
      renderAdminUsersMerged();
    });
  });

  el.querySelectorAll('[data-legacy-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove admin access for this account?')) return;
      const idx = parseInt(btn.dataset.legacyDel);
      adminEmails.splice(idx, 1);
      await saveAdminEmails();
      renderAdminUsersMerged();
    });
  });
}

// --- PLANS ---
function renderAdminPlansMerged() {
  const el = $('admin-plans');
  if (!el) return;

  const subTabs = [
    { id: 'manage', label: 'Manage' },
    { id: 'workouts', label: 'Workouts' },
    { id: 'videos', label: 'Videos' }
  ];

  let html = '<div style="display:flex;gap:6px;margin-bottom:14px">';
  subTabs.forEach(t => {
    html += `<button class="btn ${plansSubTab === t.id ? 'btn-primary' : 'btn-secondary'}" style="flex:1;font-size:12px;padding:8px 0;min-height:36px" data-plans-sub="${t.id}">${t.label}</button>`;
  });
  html += '</div>';
  html += '<div id="plans-sub-content"></div>';
  el.innerHTML = html;

  el.querySelectorAll('[data-plans-sub]').forEach(btn => {
    btn.addEventListener('click', () => {
      plansSubTab = btn.dataset.plansSub;
      renderAdminPlansMerged();
    });
  });

  const sc = $('plans-sub-content');
  switch (plansSubTab) {
    case 'manage': renderPlansManage(sc); break;
    case 'workouts': renderPlansWorkouts(sc); break;
    case 'videos': renderPlansVideos(sc); break;
  }
}

function renderPlansManage(el) {
  const categories = [
    { id: 'invehicle', name: 'In Vehicle' },
    { id: 'floor', name: 'Floor & Home' },
    { id: 'machine', name: 'Fitness Machine' }
  ];

  let html = `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:10px">${ALL_PLANS.length} plans · ${hiddenPlans.size} hidden · Tap a plan name to edit its details.</div>`;

  categories.forEach(cat => {
    const plans = ALL_PLANS.filter(p => p.category === cat.id);
    if (plans.length === 0) return;
    html += `<div style="font-size:14px;font-weight:700;color:var(--fg);margin:12px 0 6px">${cat.name} (${plans.length})</div>`;
    html += '<div class="card">';
    plans.forEach(p => {
      const isHidden = hiddenPlans.has(p.id);
      const pd = getPlanDisplayData(p);
      const hasOverride = !!planOverrides[p.id];
      html += `
        <div class="admin-item">
          <div class="admin-item-info" style="cursor:pointer" data-edit-plan="${p.id}">
            <div class="admin-item-title" style="${isHidden ? 'opacity:0.4' : ''}">${escHtml(pd.name)} ${hasOverride ? '<span style="color:#BFFF00;font-size:10px">(edited)</span>' : ''}</div>
            <div class="admin-item-meta">${p.yearLevel} · ${capitalize(p.tier)} · ${p.workouts.length} workouts · ${pd.durationWeeks}wk · ${pd.sessionsPerWeek}x/wk</div>
          </div>
          <span class="admin-badge ${isHidden ? 'admin-badge-hidden' : 'admin-badge-active'}">${isHidden ? 'Hidden' : 'Visible'}</span>
          <button class="admin-toggle${isHidden ? '' : ' on'}" data-plan-toggle="${p.id}"></button>
        </div>
      `;
    });
    html += '</div>';
  });
  el.innerHTML = html;

  // Bind toggles
  el.querySelectorAll('[data-plan-toggle]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.planToggle;
      if (hiddenPlans.has(pid)) {
        hiddenPlans.delete(pid);
      } else {
        hiddenPlans.add(pid);
      }
      await saveHiddenPlans();
      renderAdminPlansMerged();
    });
  });

  // Bind plan edit clicks
  el.querySelectorAll('[data-edit-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.editPlan;
      const plan = ALL_PLANS.find(p => p.id === pid);
      if (plan) openPlanEditSheet(plan);
    });
  });
}

function openPlanEditSheet(plan) {
  const ov = planOverrides[plan.id] || {};
  const name = ov.name || plan.name;
  const desc = ov.description || plan.description;
  const weeks = ov.durationWeeks || plan.durationWeeks;
  const sessions = ov.sessionsPerWeek || plan.sessionsPerWeek;

  $('sheet-content').innerHTML = `
    <div class="sheet-title">Edit Plan</div>
    <div style="font-size:12px;color:var(--muted-fg);margin-bottom:10px">${plan.yearLevel} · ${capitalize(plan.tier)} · ${plan.category}</div>
    <div class="form-group">
      <label class="label" for="plan-edit-name">Plan Name</label>
      <input class="input" type="text" id="plan-edit-name" value="${escHtml(name)}">
    </div>
    <div class="form-group">
      <label class="label" for="plan-edit-desc">Description</label>
      <textarea class="input" id="plan-edit-desc" rows="4" style="font-size:13px;line-height:1.5">${escHtml(desc)}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="label" for="plan-edit-weeks">Duration (weeks)</label>
        <input class="input" type="number" id="plan-edit-weeks" value="${weeks}" min="1" max="52">
      </div>
      <div class="form-group">
        <label class="label" for="plan-edit-sessions">Sessions / week</label>
        <input class="input" type="number" id="plan-edit-sessions" value="${sessions}" min="1" max="7">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-primary" style="flex:1" id="plan-edit-save">Save Changes</button>
      ${planOverrides[plan.id] ? '<button class="btn btn-secondary" id="plan-edit-reset">Reset to Default</button>' : ''}
    </div>
  `;
  openSheet();

  $('plan-edit-save').addEventListener('click', async () => {
    const newName = $('plan-edit-name').value.trim();
    const newDesc = $('plan-edit-desc').value.trim();
    const newWeeks = parseInt($('plan-edit-weeks').value) || plan.durationWeeks;
    const newSessions = parseInt($('plan-edit-sessions').value) || plan.sessionsPerWeek;

    const ov = {};
    if (newName && newName !== plan.name) ov.name = newName;
    if (newDesc && newDesc !== plan.description) ov.description = newDesc;
    if (newWeeks !== plan.durationWeeks) ov.durationWeeks = newWeeks;
    if (newSessions !== plan.sessionsPerWeek) ov.sessionsPerWeek = newSessions;

    if (Object.keys(ov).length > 0) {
      planOverrides[plan.id] = ov;
    } else {
      delete planOverrides[plan.id];
    }
    await savePlanOverrides();
    closeSheet();
    renderAdminPlansMerged();
    if (currentPage === 'fitness' && fitnessSubTab === 'plans') renderPlans();
    if (currentPage === 'today') renderToday();
  });

  const resetBtn = $('plan-edit-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset this plan to its original content?')) return;
      delete planOverrides[plan.id];
      await savePlanOverrides();
      closeSheet();
      renderAdminPlansMerged();
      if (currentPage === 'fitness' && fitnessSubTab === 'plans') renderPlans();
      if (currentPage === 'today') renderToday();
    });
  }
}

function renderPlansWorkouts(el) {
  const visiblePlans = getVisiblePlans();
  let html = '';
  html += '<div class="label" style="margin-bottom:6px">Select Plan to Edit Workouts</div>';
  html += '<select class="input" id="admin-exercise-plan-select" style="font-size:13px;margin-bottom:12px">';
  html += '<option value="">— Choose a plan —</option>';
  visiblePlans.forEach(p => {
    html += '<option value="' + p.id + '"' + (exerciseAdminPlan === p.id ? ' selected' : '') + '>' + escHtml(p.name) + ' (' + p.yearLevel + ' ' + capitalize(p.tier) + ')</option>';
  });
  html += '</select>';

  if (exerciseAdminPlan) {
    const plan = visiblePlans.find(p => p.id === exerciseAdminPlan);
    if (plan) {
      html += '<div style="font-size:12px;color:var(--muted-fg);margin-bottom:10px">' + plan.workouts.length + ' workouts. Tap a workout to edit its name, description, duration, or intensity.</div>';
      const weeks = {};
      plan.workouts.forEach((w, wi) => {
        if (!weeks[w.week]) weeks[w.week] = [];
        weeks[w.week].push({ workout: w, index: wi });
      });
      Object.keys(weeks).sort((a,b)=>a-b).forEach(wk => {
        html += '<div style="font-size:12px;font-weight:700;color:var(--fg);margin:8px 0 4px">Week ' + wk + '</div>';
        weeks[wk].forEach(({ workout: w, index: wi }) => {
          const key = plan.id + '_' + wi;
          const ov = exerciseOverrides[key];
          const name = (ov && ov.name) || w.name;
          const hasOverride = !!ov;
          html += `
            <div class="admin-exercise-card" data-exercise-key="${key}" data-plan-id="${plan.id}" data-workout-idx="${wi}">
              <div class="admin-exercise-name">${escHtml(name)} ${hasOverride ? '<span style="color:#BFFF00;font-size:10px">(edited)</span>' : ''}</div>
              <div class="admin-exercise-meta">${w.day} · ${w.duration}min · ${capitalize(w.intensity)}</div>
              <button class="admin-edit-btn" data-edit-exercise="${key}">Edit</button>
              ${hasOverride ? '<button class="admin-del-btn" data-reset-exercise="' + key + '" style="margin-left:6px">Reset</button>' : ''}
            </div>
          `;
        });
      });
    }
  }
  el.innerHTML = html;

  const sel = el.querySelector('#admin-exercise-plan-select');
  if (sel) {
    sel.addEventListener('change', () => {
      exerciseAdminPlan = sel.value || null;
      renderAdminPlansMerged();
    });
  }

  el.querySelectorAll('[data-edit-exercise]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.editExercise;
      const [planId, wiStr] = [key.substring(0, key.lastIndexOf('_')), key.substring(key.lastIndexOf('_') + 1)];
      const wi = parseInt(wiStr);
      const plan = getVisiblePlans().find(p => p.id === planId);
      if (!plan) return;
      const w = plan.workouts[wi];
      if (!w) return;
      const ov = exerciseOverrides[key] || {};
      openExerciseEditSheet(key, w, ov);
    });
  });

  el.querySelectorAll('[data-reset-exercise]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.resetExercise;
      if (!confirm('Reset this workout to its original content?')) return;
      delete exerciseOverrides[key];
      await saveExerciseOverrides();
      renderAdminPlansMerged();
    });
  });
}

function renderPlansVideos(el) {
  const allExercises = extractAllExercises();
  const categories = [
    { id: 'invehicle', name: 'In Vehicle' },
    { id: 'floor', name: 'Floor & Home' },
    { id: 'machine', name: 'Fitness Machine' }
  ];

  const vidCount = Object.keys(exerciseDemoVideos).filter(k => exerciseDemoVideos[k]).length;
  let html = '';
  html += `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:10px">${allExercises.length} exercises · ${vidCount} with videos. Add YouTube URLs for the Demos tab.</div>`;

  // Search
  html += `
    <div class="demo-search-wrap" style="margin-bottom:12px">
      <svg class="demo-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="demo-search" type="text" id="admin-vid-search" placeholder="Search exercises..." value="">
    </div>
  `;

  categories.forEach(cat => {
    const exercises = allExercises.filter(e => e.category === cat.id);
    if (exercises.length === 0) return;
    const withVid = exercises.filter(e => exerciseDemoVideos[e.key]).length;
    html += `<div style="font-size:14px;font-weight:700;color:var(--fg);margin:12px 0 6px">${cat.name} <span style="font-weight:400;font-size:12px;color:var(--muted-fg)">(${exercises.length} exercises · ${withVid} with videos)</span></div>`;
    html += '<div class="card admin-vid-cat" data-vid-cat="' + cat.id + '">';
    exercises.forEach(ex => {
      const currentUrl = exerciseDemoVideos[ex.key] || '';
      html += `
        <div class="admin-item" style="flex-wrap:wrap;gap:6px">
          <div class="admin-item-info" style="flex:1;min-width:140px">
            <div class="admin-item-title" style="font-size:13px">${escHtml(ex.name)} ${currentUrl ? '<span style="color:#BFFF00;font-size:10px">has video</span>' : ''}</div>
          </div>
          <div style="display:flex;gap:4px;flex:2;min-width:200px">
            <input class="input" type="url" value="${escHtml(currentUrl)}" placeholder="YouTube URL" data-vid-key="${ex.key}" style="flex:1;height:36px;font-size:12px;padding:0 10px">
            ${currentUrl ? '<button class="admin-del-btn" data-vid-clear="' + ex.key + '" style="height:36px;padding:0 8px;font-size:11px">Clear</button>' : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
  });

  html += '<button class="btn btn-primary" style="width:100%;margin-top:12px" id="admin-vid-save-all">Save All Videos</button>';
  el.innerHTML = html;

  // Bind search filter
  const searchInput = $('admin-vid-search');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    el.querySelectorAll('.admin-item').forEach(item => {
      const name = item.querySelector('.admin-item-title')?.textContent?.toLowerCase() || '';
      item.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
  });

  // Bind clear buttons
  el.querySelectorAll('[data-vid-clear]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.vidClear;
      delete exerciseDemoVideos[key];
      await saveExerciseDemoVideos();
      renderAdminPlansMerged();
    });
  });

  // Bind save all
  $('admin-vid-save-all').addEventListener('click', async () => {
    const inputs = el.querySelectorAll('input[data-vid-key]');
    inputs.forEach(inp => {
      const key = inp.dataset.vidKey;
      const val = inp.value.trim();
      if (val) {
        exerciseDemoVideos[key] = val;
      } else {
        delete exerciseDemoVideos[key];
      }
    });
    await saveExerciseDemoVideos();
    const btn = $('admin-vid-save-all');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save All Videos'; }, 1500);
  });
}

async function saveHiddenPlans() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'hiddenPlans'), { ids: [...hiddenPlans] });
  } catch(e) {
    console.error('Save hidden plans error:', e);
    showToast('Failed to save.', 'error');
  }
}



// ============================================
// ADMIN PERMISSIONS
// ============================================

async function loadAdminEmails() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'adminEmails'));
    if (snap.exists()) {
      const data = snap.data();
      // Support both old format (emails: string[]) and new format (perms: [{email, perms}])
      adminEmails = data.emails || [];
      adminPerms = data.perms || [];
    } else {
      adminEmails = [];
      adminPerms = [];
    }
  } catch(e) {
    adminEmails = [];
    adminPerms = [];
  }
}

async function saveAdminEmails() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'adminEmails'), { emails: adminEmails, perms: adminPerms });
  } catch(e) {
    console.error('Save admin emails error:', e);
    showToast('Failed to save.', 'error');
  }
}


// ============================================
// ADMIN: EXERCISE EDITING
// ============================================

async function loadExerciseOverrides() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'exerciseOverrides'));
    exerciseOverrides = snap.exists() ? (snap.data().overrides || {}) : {};
  } catch(e) {
    exerciseOverrides = {};
  }
}

async function saveExerciseOverrides() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'exerciseOverrides'), { overrides: exerciseOverrides });
  } catch(e) {
    console.error('Save exercise overrides error:', e);
    showToast('Failed to save exercises.', 'error');
  }
}

async function loadPlanOverrides() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'planOverrides'));
    planOverrides = snap.exists() ? (snap.data().overrides || {}) : {};
  } catch(e) {
    planOverrides = {};
  }
}

async function savePlanOverrides() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'planOverrides'), { overrides: planOverrides });
  } catch(e) {
    console.error('Save plan overrides error:', e);
    showToast('Failed to save plan changes.', 'error');
  }
}

async function loadExerciseDemoVideos() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'exerciseDemoVideos'));
    exerciseDemoVideos = snap.exists() ? (snap.data().videos || {}) : {};
  } catch(e) {
    exerciseDemoVideos = {};
  }
}

async function saveExerciseDemoVideos() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'exerciseDemoVideos'), { videos: exerciseDemoVideos });
  } catch(e) {
    console.error('Save exercise demo videos error:', e);
    showToast('Failed to save.', 'error');
  }
}

function getWorkoutData(planId, weekIdx, workout) {
  const key = planId + '_' + weekIdx;
  const override = exerciseOverrides[key];
  if (override) {
    return {
      name: override.name || workout.name,
      description: override.description || workout.description,
      duration: override.duration || workout.duration,
      intensity: override.intensity || workout.intensity
    };
  }
  return workout;
}

let exerciseAdminPlan = null;

// (Exercises now rendered within renderAdminPlansMerged → renderPlansWorkouts)

function openExerciseEditSheet(key, originalWorkout, currentOverride) {
  const name = currentOverride.name || originalWorkout.name;
  const desc = currentOverride.description || originalWorkout.description;
  const dur = currentOverride.duration || originalWorkout.duration;
  const intensity = currentOverride.intensity || originalWorkout.intensity;
  
  $('sheet-content').innerHTML = `
    <div class="sheet-title">Edit Workout</div>
    <div style="font-size:12px;color:var(--muted-fg);margin-bottom:10px">Changes appear for all users in the plan schedule and today's training.</div>
    <div class="form-group">
      <label class="label" for="ex-edit-name">Workout Name</label>
      <input class="input" type="text" id="ex-edit-name" value="${escHtml(name)}">
    </div>
    <div class="form-group">
      <label class="label" for="ex-edit-desc">Description</label>
      <textarea class="input" id="ex-edit-desc" rows="5" style="font-size:13px;line-height:1.5">${escHtml(desc)}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="label" for="ex-edit-dur">Duration (min)</label>
        <input class="input" type="number" id="ex-edit-dur" value="${dur}" min="1">
      </div>
      <div class="form-group">
        <label class="label" for="ex-edit-int">Intensity</label>
        <select class="input" id="ex-edit-int">
          <option value="easy"${intensity === 'easy' ? ' selected' : ''}>Easy</option>
          <option value="moderate"${intensity === 'moderate' ? ' selected' : ''}>Moderate</option>
          <option value="hard"${intensity === 'hard' ? ' selected' : ''}>Hard</option>
        </select>
      </div>
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:4px" id="ex-edit-save">Save Changes</button>
  `;
  openSheet();
  
  $('ex-edit-save').addEventListener('click', async () => {
    const newName = $('ex-edit-name').value.trim();
    const newDesc = $('ex-edit-desc').value.trim();
    const newDur = parseInt($('ex-edit-dur').value) || originalWorkout.duration;
    const newInt = $('ex-edit-int').value;
    
    // Only save overrides for fields that differ from original
    const ov = {};
    if (newName && newName !== originalWorkout.name) ov.name = newName;
    if (newDesc && newDesc !== originalWorkout.description) ov.description = newDesc;
    if (newDur !== originalWorkout.duration) ov.duration = newDur;
    if (newInt !== originalWorkout.intensity) ov.intensity = newInt;
    
    if (Object.keys(ov).length > 0) {
      exerciseOverrides[key] = ov;
    } else {
      delete exerciseOverrides[key];
    }
    
    await saveExerciseOverrides();
    closeSheet();
    renderAdminPlansMerged();
    // Also re-render plans and today if visible
    if (currentPage === 'fitness' && fitnessSubTab === 'plans') renderPlans();
    if (currentPage === 'today') renderToday();
  });
}

// (Permissions now rendered within renderAdminUsersMerged → renderUsersPermissions)

// ============================================
// VIDEO OVERRIDE (Demo Links)
// ============================================

async function loadVideoOverrides() {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'videoOverrides'));
    videoOverrides = snap.exists() ? (snap.data().overrides || {}) : {};
  } catch(e) {
    videoOverrides = {};
  }
}

async function saveVideoOverrides() {
  if (!db) return;
  try {
    await setDoc(doc(db, 'config', 'videoOverrides'), { overrides: videoOverrides });
  } catch(e) {
    console.error('Save video overrides error:', e);
    showToast('Failed to save.', 'error');
  }
}

function getVideoUrl(planId, workoutIdx, defaultUrl) {
  if (videoOverrides[planId] && videoOverrides[planId][workoutIdx] !== undefined) {
    return videoOverrides[planId][workoutIdx] || defaultUrl;
  }
  return defaultUrl;
}

let demoExpandedPlan = null;

// (Demo links now rendered within renderAdminPlansMerged → renderPlansVideos)

// ============================================
// RACE LOG (all users)
// ============================================

async function loadUserRaceLogs() {
  if (!currentUser || !db) { userRaceLogs = []; return; }
  try {
    const snap = await getDocs(collection(db, 'users', currentUser.uid, 'raceLogs'));
    userRaceLogs = [];
    snap.forEach(d => {
      userRaceLogs.push({ _id: d.id, ...d.data() });
    });
    userRaceLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch(e) {
    console.error('Load race logs error:', e);
    userRaceLogs = [];
  }
}

function getFootageForRace(raceId) {
  // Check admin-managed footage, then default race data
  if (raceFootage[raceId] && raceFootage[raceId].length) return raceFootage[raceId];
  const race = getActiveRaces().find(r => r.id === raceId);
  if (race && race.footageUrls && race.footageUrls.length) return race.footageUrls;
  return [];
}

function getStreamForRace(raceId) {
  const race = getActiveRaces().find(r => r.id === raceId);
  return (race && race.streamUrl) || '';
}

function renderFootageLinks(raceId) {
  const footage = getFootageForRace(raceId);
  const stream = getStreamForRace(raceId);
  if (!footage.length && !stream) return '';
  let h = '<div class="race-footage-section">';
  if (stream && !footage.some(f => f.url === stream)) {
    h += `<a href="${stream}" target="_blank" rel="noopener" class="race-footage-link">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
      <div class="race-footage-label">Race Livestream<small>Watch the full race</small></div>
    </a>`;
  }
  footage.forEach(f => {
    const icon = f.type === 'results'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>';
    h += `<a href="${f.url}" target="_blank" rel="noopener" class="race-footage-link">
      ${icon}
      <div class="race-footage-label">${escHtml(f.label)}<small>${f.type === 'results' ? 'View results' : 'Watch footage'}</small></div>
    </a>`;
  });
  h += '</div>';
  return h;
}

function getCompletedRacesNeedingLogs() {
  const races = getActiveRaces();
  const today = new Date().toISOString().split('T')[0];
  const loggedTracks = new Set(userRaceLogs.map(l => (l.trackName || '').toLowerCase()));
  return races.filter(r => {
    if (!r.date || r.date > today) return false;
    // Check if user already logged this specific race
    const trackLower = (r.location || r.name || '').toLowerCase();
    const nameLower = (r.name || '').toLowerCase();
    return !userRaceLogs.some(l => {
      const lt = (l.trackName || '').toLowerCase();
      return (lt === trackLower || lt.includes(trackLower.split(',')[0].toLowerCase()) || nameLower.includes(lt)) && l.date === r.date;
    });
  });
}

function renderRaceLog() {
  const c = $('racelog-content');
  let html = '<div class="page-title" style="margin-top:8px">Race Log</div>';

  // Add entry button
  html += `
    <button class="btn btn-primary" style="width:100%;margin-bottom:16px" id="racelog-add-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:middle;margin-right:6px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Log New Race
    </button>
  `;

  // --- Completed races needing logs ---
  const needsLog = getCompletedRacesNeedingLogs();
  if (needsLog.length > 0) {
    html += '<div style="font-size:13px;font-weight:700;color:#BFFF00;margin-bottom:8px">Races to Log</div>';
    needsLog.forEach(race => {
      const footage = getFootageForRace(race.id);
      const stream = getStreamForRace(race.id);
      html += `
        <div class="race-prompt-card">
          <div class="race-prompt-header">
            <div class="race-prompt-track">${escHtml(race.name)}</div>
            <span class="race-prompt-badge">Completed</span>
          </div>
          <div class="race-prompt-date">${race.date} · ${escHtml(race.location || '')}</div>
          <div class="race-prompt-desc">${escHtml(race.notes || '')}</div>
          ${renderFootageLinks(race.id)}
          <button class="btn btn-primary" style="width:100%;margin-top:10px" data-log-race="${race.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:middle;margin-right:6px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Log Your Results
          </button>
        </div>
      `;
    });
  }

  // --- Existing logs ---
  if (userRaceLogs.length === 0 && needsLog.length === 0) {
    html += `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg></div>
      <div class="empty-state-title">No Race Data Yet</div>
      <div class="empty-state-desc">Log your race results to track your progress across different tracks — average lap times, fastest laps, and more.</div>
    </div>`;
  }

  if (userRaceLogs.length > 0) {
    if (needsLog.length > 0) html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin:16px 0 8px">Your Race History</div>';
    html += '<div class="space-y">';
    userRaceLogs.forEach((entry, i) => {
      // Find matching race for footage
      const matchingRace = getActiveRaces().find(r => {
        const lt = (entry.trackName || '').toLowerCase();
        const rl = (r.location || '').toLowerCase();
        const rn = (r.name || '').toLowerCase();
        return (lt === rl || rl.includes(lt.split(',')[0]) || rn.includes(lt) || lt.includes(rl.split(',')[0])) && entry.date === r.date;
      });
      const raceId = matchingRace ? matchingRace.id : null;

      html += `
        <div class="race-log-card">
          <div class="race-log-header">
            <div class="race-log-track">${escHtml(entry.trackName || 'Unknown Track')}</div>
            <div class="race-log-date">${entry.date || ''}</div>
          </div>
          <div class="race-log-grid">
            <div class="race-log-stat">Avg Lap<br><strong>${entry.avgLapTime || '—'}</strong></div>
            <div class="race-log-stat">Fastest Lap<br><strong>${entry.fastestLap || '—'}</strong></div>
            <div class="race-log-stat">Total Laps<br><strong>${entry.totalLaps || '—'}</strong></div>
            <div class="race-log-stat">Total Time<br><strong>${entry.totalTime || '—'}</strong></div>
            <div class="race-log-stat">Avg HR<br><strong>${entry.avgHR || '—'}</strong></div>
            <div class="race-log-stat">Max HR<br><strong>${entry.maxHR || '—'}</strong></div>
          </div>
          ${entry.notes ? '<div class="race-log-notes">"' + escHtml(entry.notes) + '"</div>' : ''}
          ${raceId ? renderFootageLinks(raceId) : ''}
          <div class="race-log-actions">
            <button class="admin-edit-btn" data-racelog-edit="${i}">Edit</button>
            <button class="admin-del-btn" data-racelog-del="${i}">Delete</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  // --- Admin-curated Race Videos ---
  if (raceLogVideos.length > 0) {
    html += '<div class="race-video-section">';
    html += '<div class="race-video-heading"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg> Race Videos</div>';
    raceLogVideos.forEach(v => {
      const matchedRace = v.raceId ? getActiveRaces().find(r => r.id === v.raceId) : null;
      const meta = matchedRace ? escHtml(matchedRace.name) : 'General';
      html += `
        <a href="${v.url}" target="_blank" rel="noopener" class="race-video-card">
          <div class="race-video-thumb">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
          </div>
          <div class="race-video-info">
            <div class="race-video-title">${escHtml(v.title)}</div>
            <div class="race-video-meta">${meta}</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      `;
    });
    html += '</div>';
  }

  
  c.innerHTML = html;

  // Bind add
  $('racelog-add-btn').addEventListener('click', () => openRaceLogForm());

  // Bind "Log Your Results" for completed race prompts
  c.querySelectorAll('[data-log-race]').forEach(btn => {
    btn.addEventListener('click', () => {
      const raceId = btn.dataset.logRace;
      const race = getActiveRaces().find(r => r.id === raceId);
      if (race) {
        openRaceLogForm({ trackName: race.location || race.name, date: race.date });
      }
    });
  });

  // Bind edits
  c.querySelectorAll('[data-racelog-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.racelogEdit);
      openRaceLogForm(userRaceLogs[idx], idx);
    });
  });

  // Bind deletes
  c.querySelectorAll('[data-racelog-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this race log entry?')) return;
      const idx = parseInt(btn.dataset.racelogDel);
      const entry = userRaceLogs[idx];
      if (entry._id && db && currentUser) {
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'raceLogs', entry._id));
        } catch(e) { console.error('Delete race log error:', e); }
      }
      userRaceLogs.splice(idx, 1);
      renderRaceLog();
    });
  });
}

function openRaceLogForm(existing, editIdx) {
  const c = $('racelog-content');
  const isEdit = existing !== undefined;
  const e = existing || {};

  // Build track options from RACES
  const races = getActiveRaces();
  let trackOptions = '<option value="">Select a track...</option>';
  const trackNames = [...new Set(races.map(r => r.location || r.name))];
  trackNames.forEach(t => {
    trackOptions += `<option value="${escHtml(t)}"${e.trackName === t ? ' selected' : ''}>${escHtml(t)}</option>`;
  });
  trackOptions += '<option value="__custom">Other (type below)</option>';

  let html = '<div class="page-title">' + (isEdit ? 'Edit Race Log' : 'Log New Race') + '</div>';
  html += `
    <div class="card">
      <div class="admin-form">
        <div class="label">Track / Location</div>
        <select class="input" id="rl-track-select">${trackOptions}</select>
        <input class="input" type="text" id="rl-track-custom" placeholder="Custom track name" value="${escHtml(e.trackName || '')}" style="${trackNames.includes(e.trackName) ? 'display:none' : ''}">

        <div class="label">Date</div>
        <input class="input" type="date" id="rl-date" value="${e.date || new Date().toISOString().split('T')[0]}">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div class="label">Avg Lap Time</div>
            <input class="input" type="text" id="rl-avg-lap" placeholder="e.g. 2:34" value="${escHtml(e.avgLapTime || '')}">
          </div>
          <div>
            <div class="label">Fastest Lap</div>
            <input class="input" type="text" id="rl-fastest" placeholder="e.g. 2:18" value="${escHtml(e.fastestLap || '')}">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div class="label">Total Laps</div>
            <input class="input" type="number" id="rl-laps" placeholder="e.g. 42" value="${e.totalLaps || ''}">
          </div>
          <div>
            <div class="label">Total Time</div>
            <input class="input" type="text" id="rl-totaltime" placeholder="e.g. 3h 24m" value="${escHtml(e.totalTime || '')}">
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div class="label">Avg Heart Rate</div>
            <input class="input" type="number" id="rl-avghr" placeholder="e.g. 155" value="${e.avgHR || ''}">
          </div>
          <div>
            <div class="label">Max Heart Rate</div>
            <input class="input" type="number" id="rl-maxhr" placeholder="e.g. 182" value="${e.maxHR || ''}">
          </div>
        </div>

        <div class="label">Notes</div>
        <textarea class="input" id="rl-notes" placeholder="How did it feel? Weather, strategy, etc.">${escHtml(e.notes || '')}</textarea>

        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" id="rl-save-btn" style="flex:1">${isEdit ? 'Update' : 'Save Entry'}</button>
          <button class="btn btn-secondary" id="rl-cancel-btn" style="flex:1">Cancel</button>
        </div>
      </div>
    </div>
  `;
  c.innerHTML = html;

  // Track select logic
  const trackSel = $('rl-track-select');
  const trackCustom = $('rl-track-custom');
  if (e.trackName && !trackNames.includes(e.trackName)) {
    trackSel.value = '__custom';
    trackCustom.style.display = '';
  }
  trackSel.addEventListener('change', () => {
    if (trackSel.value === '__custom') {
      trackCustom.style.display = '';
      trackCustom.value = '';
      trackCustom.focus();
    } else {
      trackCustom.style.display = 'none';
      trackCustom.value = trackSel.value;
    }
  });

  // Cancel
  $('rl-cancel-btn').addEventListener('click', () => renderRaceLog());

  // Save
  $('rl-save-btn').addEventListener('click', async () => {
    let trackName = trackSel.value === '__custom' ? trackCustom.value.trim() : (trackSel.value || trackCustom.value.trim());
    if (!trackName) { showToast('Please select a track name.', 'warn'); return; }

    const entry = {
      trackName,
      date: $('rl-date').value,
      avgLapTime: $('rl-avg-lap').value.trim(),
      fastestLap: $('rl-fastest').value.trim(),
      totalLaps: $('rl-laps').value ? parseInt($('rl-laps').value) : null,
      totalTime: $('rl-totaltime').value.trim(),
      avgHR: $('rl-avghr').value ? parseInt($('rl-avghr').value) : null,
      maxHR: $('rl-maxhr').value ? parseInt($('rl-maxhr').value) : null,
      notes: $('rl-notes').value.trim(),
      updatedAt: new Date().toISOString()
    };

    if (db && currentUser) {
      try {
        if (isEdit && existing._id) {
          await updateDoc(doc(db, 'users', currentUser.uid, 'raceLogs', existing._id), entry);
          userRaceLogs[editIdx] = { _id: existing._id, ...entry };
        } else {
          entry.createdAt = new Date().toISOString();
          const ref = await addDoc(collection(db, 'users', currentUser.uid, 'raceLogs'), entry);
          userRaceLogs.unshift({ _id: ref.id, ...entry });
        }
      } catch(e) {
        console.error('Save race log error:', e);
        showToast('Failed to save.', 'error');
        return;
      }
    }
    renderRaceLog();
  });
}

// ============================================
// GPS ACTIVITY TRACKER
// ============================================
let trackerState = 'idle'; // idle | tracking | paused | saving
let trackerType = 'ride'; // ride | run | walk | gym
let trackerWatchId = null;
let trackerPositions = []; // [{lat,lng,time,speed,alt}]
let trackerStartTime = null;
let trackerElapsed = 0; // seconds
let trackerInterval = null;
let trackerMap = null;
let trackerPolyline = null;
let trackerMarker = null;
let trackerWakeLock = null;

function openActivityTracker() {
  trackerState = 'idle';
  trackerPositions = [];
  trackerElapsed = 0;
  trackerStartTime = null;

  const overlay = document.createElement('div');
  overlay.id = 'tracker-overlay';
  overlay.className = 'tracker-overlay';
  overlay.innerHTML = `
    <div class="tracker-header">
      <span class="tracker-header-title">Record Activity</span>
      <button class="tracker-close" id="tracker-close-btn">✕</button>
    </div>
    <div class="tracker-type-bar">
      <button class="tracker-type-btn active" data-ttype="ride">🚴 Ride</button>
      <button class="tracker-type-btn" data-ttype="run">🏃 Run</button>
      <button class="tracker-type-btn" data-ttype="walk">🚶 Walk</button>
      <button class="tracker-type-btn" data-ttype="gym">🏋️ Gym</button>
    </div>
    <div class="tracker-map"><div id="tracker-map-el"></div></div>
    <div class="tracker-stats">
      <div class="tracker-stat big"><div class="tracker-stat-val" id="t-time">00:00</div><div class="tracker-stat-lbl">Duration</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-dist">0.00</div><div class="tracker-stat-lbl">Distance (km)</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-speed">0.0</div><div class="tracker-stat-lbl">Speed (km/h)</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-pace">--:--</div><div class="tracker-stat-lbl">Pace (min/km)</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" id="t-alt">--</div><div class="tracker-stat-lbl">Elevation (m)</div></div>
    </div>
    <div class="tracker-controls" id="tracker-controls">
      <button class="tracker-btn start" id="t-start-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg></button>
    </div>`;
  document.body.appendChild(overlay);

  // Init map
  setTimeout(() => {
    trackerMap = L.map('tracker-map-el', { zoomControl: false, attributionControl: false }).setView([-37.81, 144.96], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(trackerMap);
    trackerPolyline = L.polyline([], { color: '#BFFF00', weight: 4, opacity: 0.9 }).addTo(trackerMap);

    // Try to get initial position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        trackerMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
        trackerMarker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 8, fillColor: '#BFFF00', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(trackerMap);
      }, () => {}, { enableHighAccuracy: true });
    }
  }, 100);

  // Bind type buttons
  overlay.querySelectorAll('.tracker-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.tracker-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trackerType = btn.dataset.ttype;
    });
  });

  // Bind close
  $('tracker-close-btn').addEventListener('click', () => {
    if (trackerState === 'tracking' || trackerState === 'paused') {
      if (!confirm('Discard this activity?')) return;
    }
    closeActivityTracker();
  });

  // Bind start
  $('t-start-btn').addEventListener('click', () => startTracking());
}

function startTracking() {
  trackerState = 'tracking';
  trackerStartTime = Date.now() - (trackerElapsed * 1000);
  haptic('medium');

  // Wake lock
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').then(wl => { trackerWakeLock = wl; }).catch(() => {});
  }

  // Timer
  trackerInterval = setInterval(updateTrackerDisplay, 1000);

  // GPS
  if (navigator.geolocation) {
    trackerWatchId = navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, speed, altitude } = pos.coords;
      const point = { lat: latitude, lng: longitude, time: Date.now(), speed: speed || 0, alt: altitude || 0 };
      trackerPositions.push(point);
      // Update map
      if (trackerMap) {
        const ll = [latitude, longitude];
        trackerPolyline.addLatLng(ll);
        if (trackerMarker) trackerMarker.setLatLng(ll);
        else trackerMarker = L.circleMarker(ll, { radius: 8, fillColor: '#BFFF00', fillOpacity: 1, color: '#fff', weight: 2 }).addTo(trackerMap);
        trackerMap.panTo(ll);
      }
    }, err => { console.warn('GPS error:', err.message); }, {
      enableHighAccuracy: true, maximumAge: 2000, timeout: 10000
    });
  }

  updateTrackerControls();
}

function pauseTracking() {
  trackerState = 'paused';
  trackerElapsed = Math.floor((Date.now() - trackerStartTime) / 1000);
  clearInterval(trackerInterval);
  if (trackerWatchId !== null) { navigator.geolocation.clearWatch(trackerWatchId); trackerWatchId = null; }
  if (trackerWakeLock) { trackerWakeLock.release().catch(() => {}); trackerWakeLock = null; }
  haptic('light');
  updateTrackerControls();
}

function resumeTracking() {
  startTracking();
}

function stopTracking() {
  pauseTracking();
  trackerState = 'saving';
  haptic('medium');
  showTrackerSaveScreen();
}

function updateTrackerControls() {
  const el = $('tracker-controls');
  if (!el) return;
  if (trackerState === 'idle') {
    el.innerHTML = '<button class="tracker-btn start" id="t-start-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg></button>';
    $('t-start-btn')?.addEventListener('click', () => startTracking());
  } else if (trackerState === 'tracking') {
    el.innerHTML = '<button class="tracker-btn discard" id="t-discard-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><button class="tracker-btn pause" id="t-pause-btn"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></button><button class="tracker-btn stop" id="t-stop-btn"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>';
    $('t-pause-btn')?.addEventListener('click', () => pauseTracking());
    $('t-stop-btn')?.addEventListener('click', () => stopTracking());
    $('t-discard-btn')?.addEventListener('click', () => { if (confirm('Discard this activity?')) closeActivityTracker(); });
  } else if (trackerState === 'paused') {
    el.innerHTML = '<button class="tracker-btn discard" id="t-discard-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><button class="tracker-btn resume" id="t-resume-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21"/></svg></button><button class="tracker-btn stop" id="t-stop-btn"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>';
    $('t-resume-btn')?.addEventListener('click', () => resumeTracking());
    $('t-stop-btn')?.addEventListener('click', () => stopTracking());
    $('t-discard-btn')?.addEventListener('click', () => { if (confirm('Discard this activity?')) closeActivityTracker(); });
  }
}

function updateTrackerDisplay() {
  const elapsed = Math.floor((Date.now() - trackerStartTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const hrs = Math.floor(mins / 60);
  const timeEl = $('t-time');
  if (timeEl) timeEl.textContent = hrs > 0 ? hrs + ':' + String(mins % 60).padStart(2,'0') + ':' + String(secs).padStart(2,'0') : String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');

  // Distance
  const dist = calcTrackerDistance();
  const distEl = $('t-dist');
  if (distEl) distEl.textContent = dist.toFixed(2);

  // Speed (current from last GPS point)
  const lastPt = trackerPositions[trackerPositions.length - 1];
  const speedKmh = lastPt ? (lastPt.speed * 3.6) : 0;
  const speedEl = $('t-speed');
  if (speedEl) speedEl.textContent = speedKmh.toFixed(1);

  // Pace
  const paceEl = $('t-pace');
  if (paceEl) {
    if (dist > 0.01) {
      const paceMinPerKm = (elapsed / 60) / dist;
      const pMins = Math.floor(paceMinPerKm);
      const pSecs = Math.round((paceMinPerKm - pMins) * 60);
      paceEl.textContent = pMins + ':' + String(pSecs).padStart(2,'0');
    } else {
      paceEl.textContent = '--:--';
    }
  }

  // Altitude
  const altEl = $('t-alt');
  if (altEl && lastPt && lastPt.alt) altEl.textContent = Math.round(lastPt.alt);
}

function calcTrackerDistance() {
  let dist = 0;
  for (let i = 1; i < trackerPositions.length; i++) {
    dist += haversine(trackerPositions[i-1].lat, trackerPositions[i-1].lng, trackerPositions[i].lat, trackerPositions[i].lng);
  }
  return dist;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function showTrackerSaveScreen() {
  const overlay = $('tracker-overlay');
  if (!overlay) return;
  const dist = calcTrackerDistance();
  const elapsed = trackerElapsed;
  const mins = Math.floor(elapsed / 60);
  const avgSpeed = elapsed > 0 ? (dist / (elapsed / 3600)) : 0;
  const typeLabels = { ride: '🚴 Ride', run: '🏃 Run', walk: '🚶 Walk', gym: '🏋️ Gym' };

  const saveDiv = document.createElement('div');
  saveDiv.className = 'tracker-save-overlay';
  saveDiv.innerHTML = `<div class="tracker-save-card">
    <h3>Save Activity</h3>
    <div style="font-size:13px;color:var(--muted-fg);margin-bottom:12px">${typeLabels[trackerType] || trackerType}</div>
    <div class="tracker-save-stats">
      <div class="tracker-save-stat"><div class="val">${dist.toFixed(2)} km</div><div class="lbl">Distance</div></div>
      <div class="tracker-save-stat"><div class="val">${mins} min</div><div class="lbl">Duration</div></div>
      <div class="tracker-save-stat"><div class="val">${avgSpeed.toFixed(1)} km/h</div><div class="lbl">Avg Speed</div></div>
      <div class="tracker-save-stat"><div class="val">${trackerPositions.length}</div><div class="lbl">GPS Points</div></div>
    </div>
    <input class="input" id="t-save-name" type="text" placeholder="Activity name (optional)" style="margin-bottom:8px;width:100%">
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <span style="font-size:12px;color:var(--muted-fg);line-height:32px">RPE:</span>
      <div id="t-save-rpe" style="display:flex;gap:3px">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="t-rpe-btn" data-rpe="${n}" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--surface-alt);color:var(--muted-fg);font-size:11px;cursor:pointer">${n}</button>`).join('')}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="t-save-discard" class="btn" style="flex:1;background:var(--surface-alt);color:var(--muted-fg)">Discard</button>
      <button id="t-save-btn" class="btn btn-primary" style="flex:1">Save Activity</button>
    </div>
  </div>`;
  overlay.appendChild(saveDiv);

  let selectedRpe = null;
  saveDiv.querySelectorAll('.t-rpe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveDiv.querySelectorAll('.t-rpe-btn').forEach(b => { b.style.background = 'var(--surface-alt)'; b.style.color = 'var(--muted-fg)'; });
      btn.style.background = 'var(--primary)';
      btn.style.color = 'var(--primary-fg)';
      selectedRpe = parseInt(btn.dataset.rpe);
    });
  });

  $('t-save-discard')?.addEventListener('click', () => closeActivityTracker());
  $('t-save-btn')?.addEventListener('click', async () => {
    const name = $('t-save-name')?.value?.trim() || (trackerType === 'ride' ? 'Ride' : trackerType === 'run' ? 'Run' : trackerType === 'walk' ? 'Walk' : 'Gym Session');
    // Simplify GPS path — sample every 3rd point, store only lat/lng
    const simplifiedPath = trackerPositions.filter((_, i) => i % 3 === 0 || i === trackerPositions.length - 1).map(p => [parseFloat(p.lat.toFixed(5)), parseFloat(p.lng.toFixed(5))]);
    const workoutId = 'trk-' + Date.now();
    const workout = {
      name: name,
      duration: mins,
      date: new Date(),
      type: trackerType,
      distance: parseFloat(dist.toFixed(2)),
      avgSpeed: parseFloat(avgSpeed.toFixed(1)),
      rpe: selectedRpe,
      gpsPoints: trackerPositions.length,
      source: 'tracker'
    };
    // Store GPS route in localStorage (Firestore has field size limits)
    if (simplifiedPath.length > 1) {
      try {
        const routes = JSON.parse(localStorage.getItem('vf_routes') || '{}');
        routes[workoutId] = simplifiedPath;
        // Keep only last 50 routes to avoid storage overflow
        const keys = Object.keys(routes);
        if (keys.length > 50) { delete routes[keys[0]]; }
        localStorage.setItem('vf_routes', JSON.stringify(routes));
      } catch(e) {}
    }
    // Save to Firestore
    if (!demoMode && db && currentUser) {
      try {
        const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'workouts'), {
          ...workout,
          routeId: workoutId,
          date: serverTimestamp()
        });
        showToast('Activity saved!', 'success');
      } catch(e) { showToast('Failed to save activity.', 'error'); }
    } else {
      userWorkouts.unshift({ ...workout, id: workoutId, routeId: workoutId });
      showToast('Activity saved (demo).', 'success');
    }
    closeActivityTracker();
    if (currentPage === 'today') renderToday();
    if (currentPage === 'fitness') renderFitness();
  });
}

function closeActivityTracker() {
  clearInterval(trackerInterval);
  if (trackerWatchId !== null) { navigator.geolocation.clearWatch(trackerWatchId); trackerWatchId = null; }
  if (trackerWakeLock) { trackerWakeLock.release().catch(() => {}); trackerWakeLock = null; }
  if (trackerMap) { trackerMap.remove(); trackerMap = null; }
  trackerPolyline = null;
  trackerMarker = null;
  trackerState = 'idle';
  const overlay = $('tracker-overlay');
  if (overlay) overlay.remove();
}

// Start
startApp();

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
