// CGS VeloForge Admin Panel Module
// All state accessed via A (app context set by initAdmin)
import { escHtml, capitalize, getXpLevel, timeAgo } from './state.js';

let A = {};
let usersSubTab = 'all';
let plansSubTab = 'manage';
export function initAdmin(ctx) { A = ctx; }

export function renderAdmin() {
  if (!A.isAdmin) return;
  const c = A.$('admin-content');
  const allTabs = [
    { id: 'announcements', label: 'Announcements' },
    { id: 'training', label: 'Training' },
    { id: 'races', label: 'Races' },
    { id: 'users', label: 'Users' },
    { id: 'plans', label: 'Plans' },
    { id: 'coach', label: 'Coach' }
  ];
  // Filter tabs to only show features the current admin has access to
  const tabs = allTabs.filter(t => A.currentAdminPerms.includes(t.id));

  // If no tabs, show restricted message
  if (tabs.length === 0) {
    c.innerHTML = '<div class="page-title">Admin Panel</div><div class="empty-state" style="padding:32px 16px"><div class="empty-state-title">No Permissions</div><div class="empty-state-desc">Your admin account doesn\'t have any features enabled yet. Ask the owner to grant you access.</div></div>';
    return;
  }

  // If active tab not in allowed list, switch to first allowed
  if (!tabs.some(t => t.id === A.adminActiveTab)) A.adminActiveTab = tabs[0].id;

  let html = '<div class="page-title">Admin Panel</div>';
  html += '<div class="admin-tabs">';
  tabs.forEach(t => {
    html += `<button class="admin-tab${A.adminActiveTab === t.id ? ' active' : ''}" data-admin-tab="${t.id}">${t.label}</button>`;
  });
  html += '</div>';

  // Create section containers for allowed tabs only
  tabs.forEach(t => {
    html += '<div id="admin-' + t.id + '" class="admin-section' + (A.adminActiveTab === t.id ? ' active' : '') + '"></div>';
  });

  
  c.innerHTML = html;

  // Bind admin tabs
  c.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      A.adminActiveTab = btn.dataset.adminTab;
      renderAdmin();
    });
  });

  // Render active section
  switch (A.adminActiveTab) {
    case 'announcements': renderAdminAnnouncements(); break;
    case 'training': renderAdminTraining(); break;
    case 'races': renderAdminRaces(); break;
    case 'users': renderAdminUsersMerged(); break;
    case 'plans': renderAdminPlansMerged(); break;
    case 'coach': renderCoachDashboard(); break;
  }
}

// --- COACH DASHBOARD ---
export async function renderCoachDashboard() {
  const el = A.$('admin-coach');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div><div style="margin-top:8px;color:var(--muted-fg);font-size:13px">Loading student data...</div></div>';

  let students = [];
  try {
    if (A.demoMode) {
      students = [
        { name: 'Alex M.', year: 'Y11', tier: 'intense', workouts: 34, lastActive: new Date(Date.now() - 86400000), streak: 7, avgRpe: 7.2 },
        { name: 'Sam K.', year: 'Y10', tier: 'average', workouts: 28, lastActive: new Date(Date.now() - 172800000), streak: 5, avgRpe: 6.8 },
        { name: 'Jordan T.', year: 'Y12', tier: 'intense', workouts: 22, lastActive: new Date(Date.now() - 86400000 * 5), streak: 0, avgRpe: 8.1 },
        { name: 'Riley W.', year: 'Y9', tier: 'basic', workouts: 19, lastActive: new Date(Date.now() - 86400000 * 2), streak: 4, avgRpe: 5.5 },
        { name: 'Chris B.', year: 'Y10', tier: 'average', workouts: 15, lastActive: new Date(Date.now() - 86400000 * 8), streak: 0, avgRpe: null },
        { name: 'Pat H.', year: 'Y11', tier: 'basic', workouts: 12, lastActive: new Date(Date.now() - 86400000 * 12), streak: 0, avgRpe: 6.0 },
      ];
    } else if (A.db) {
      const usersSnap = await A.getDocs(A.collection(A.db, 'users'));
      for (const d of usersSnap.docs) {
        const u = d.data();
        let wCount = 0, lastDate = null, rpeSum = 0, rpeCount = 0;
        try {
          const wSnap = await A.getDocs(A.collection(A.db, 'users', d.id, 'workouts'));
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
      const lastStr = s.lastActive ? timeAgo(s.lastActive) : 'Never';
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
    const exportBtn = A.$('coach-export-csv');
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
        A.showToast('CSV downloaded!', 'success');
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
    const sendBtn = A.$('bulk-msg-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const text = A.$('bulk-msg-text')?.value?.trim();
        if (!text) { A.showToast('Enter a message.', 'warn'); return; }
        const title = bulkTarget === 'all' ? 'Coach Message'
          : bulkTarget === 'inactive' ? 'Coach Check-In'
          : 'Message for ' + bulkTarget;
        const newAnn = {
          id: Date.now().toString(),
          title: title,
          message: text + (bulkTarget !== 'all' ? ' [To: ' + bulkTarget + ']' : ''),
          date: new Date().toISOString(),
          by: A.userProfile?.displayName || 'Coach'
        };
        if (!A.demoMode && A.db) {
          try {
            const configRef = A.doc(A.db, 'config', 'announcements');
            const snap = await A.getDoc(configRef);
            const items = snap.exists() ? (snap.data().items || []) : [];
            items.unshift(newAnn);
            await A.setDoc(configRef, { items });
            A.showToast('Message posted as announcement!', 'success');
            A.$('bulk-msg-text').value = '';
          } catch(e) {
            A.showToast('Failed to send message.', 'error');
          }
        } else {
          A.adminAnnouncements.unshift(newAnn);
          A.showToast('Message posted (demo mode).', 'success');
          A.$('bulk-msg-text').value = '';
        }
      });
    }
  }

  render('recent');

  // --- Challenge Manager (below student list) ---
  const challengeEl = document.createElement('div');
  challengeEl.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:16px';
  let chHtml = '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:10px">🏆 Team Challenge Manager</div>';

  if (A.activeChallenge) {
    const cEnd = new Date(A.activeChallenge.endDate);
    const cDaysLeft = Math.max(0, Math.ceil((cEnd - new Date()) / 86400000));
    chHtml += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">${escHtml(A.activeChallenge.title || 'Active Challenge')}</div>
      <div style="font-size:11px;color:var(--muted-fg);margin-bottom:8px">${cDaysLeft > 0 ? cDaysLeft + ' days remaining' : 'Ended'} · Repeat: ${A.activeChallenge.repeat ? 'On' : 'Off'}</div>`;
    // Editable team scores
    const rawT = A.activeChallenge.teams || {};
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
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px">${A.activeChallenge ? 'Start New Challenge' : 'Create Challenge'}</div>
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
  A.$('ch-save-scores')?.addEventListener('click', async () => {
    if (!A.activeChallenge || A.demoMode || !A.db) { A.showToast('Cannot save in demo mode.', 'warn'); return; }
    const updatedTeams = { ...A.activeChallenge.teams };
    challengeEl.querySelectorAll('.ch-team-name').forEach(inp => {
      const k = inp.dataset.chKey;
      if (updatedTeams[k]) updatedTeams[k].name = inp.value.trim() || k;
    });
    challengeEl.querySelectorAll('.ch-team-score').forEach(inp => {
      const k = inp.dataset.chKey;
      if (updatedTeams[k]) updatedTeams[k].score = parseInt(inp.value) || 0;
    });
    try {
      await A.setDoc(A.doc(A.db, 'config', 'activeChallenge'), { ...A.activeChallenge, teams: updatedTeams });
      A.activeChallenge.teams = updatedTeams;
      A.showToast('Challenge updated!', 'success');
    } catch(e) { A.showToast('Failed to save.', 'error'); }
  });

  // Reset all scores to 0
  A.$('ch-reset-scores')?.addEventListener('click', async () => {
    if (!A.activeChallenge || A.demoMode || !A.db) return;
    if (!confirm('Reset all team scores to 0?')) return;
    const reset = {};
    Object.entries(A.activeChallenge.teams || {}).forEach(([k, v]) => {
      reset[k] = { name: (v && v.name) || k, score: 0 };
    });
    try {
      await A.setDoc(A.doc(A.db, 'config', 'activeChallenge'), { ...A.activeChallenge, teams: reset });
      A.activeChallenge.teams = reset;
      A.showToast('Scores reset!', 'success');
      renderCoachDashboard();
    } catch(e) { A.showToast('Failed to reset.', 'error'); }
  });

  // End challenge
  A.$('ch-end-challenge')?.addEventListener('click', async () => {
    if (!A.activeChallenge || A.demoMode || !A.db) return;
    if (!confirm('End this challenge? It will be removed.')) return;
    try {
      await A.deleteDoc(A.doc(A.db, 'config', 'activeChallenge'));
      A.activeChallenge = null;
      A.showToast('Challenge ended.', 'success');
      renderCoachDashboard();
    } catch(e) { A.showToast('Failed to end challenge.', 'error'); }
  });

  // Create new challenge
  A.$('ch-create-btn')?.addEventListener('click', async () => {
    const title = A.$('ch-new-title')?.value?.trim();
    const days = parseInt(A.$('ch-new-duration')?.value) || 30;
    const repeat = A.$('ch-new-repeat')?.checked || false;
    if (!title) { A.showToast('Enter a challenge title.', 'warn'); return; }
    const teamInputs = challengeEl.querySelectorAll('.ch-new-team-name');
    const teams = {};
    let idx = 1;
    teamInputs.forEach(inp => {
      const name = inp.value.trim();
      if (name) { teams['team' + idx] = { name, score: 0 }; idx++; }
    });
    if (Object.keys(teams).length < 2) { A.showToast('Need at least 2 teams.', 'warn'); return; }
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    const challenge = {
      title, type: 'minutes', repeat,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      teams
    };
    if (A.demoMode) {
      A.activeChallenge = challenge;
      A.showToast('Challenge created (demo).', 'success');
      renderCoachDashboard();
      return;
    }
    if (!A.db) return;
    try {
      await A.setDoc(A.doc(A.db, 'config', 'activeChallenge'), challenge);
      A.activeChallenge = challenge;
      A.showToast('Challenge created!', 'success');
      renderCoachDashboard();
    } catch(e) { A.showToast('Failed to create challenge.', 'error'); }
  });
  // --- Duplicate Workout Cleanup Tool ---
  const cleanupEl = document.createElement('div');
  cleanupEl.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:16px';
  cleanupEl.innerHTML = `
    <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">🧹 Cleanup Tools</div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Remove Duplicate Strava Activities</div>
      <div style="font-size:11px;color:var(--muted-fg);margin-bottom:8px">Scans all students for duplicate workouts (same day + similar duration). Shows duplicates for review before deleting.</div>
      <button id="cleanup-scan-btn" class="btn btn-secondary" style="font-size:12px;padding:8px 16px">Scan for Duplicates</button>
      <div id="cleanup-results" style="margin-top:8px"></div>
    </div>`;
  el.appendChild(cleanupEl);
  A.$('cleanup-scan-btn')?.addEventListener('click', async () => {
    const btn = A.$('cleanup-scan-btn');
    const results = A.$('cleanup-results');
    btn.textContent = 'Scanning...';
    btn.disabled = true;
    results.innerHTML = '<div style="font-size:12px;color:var(--muted-fg)">Checking all users...</div>';
    let totalDupes = 0;
    let dupeList = [];
    try {
      const usersSnap = await A.getDocs(A.collection(A.db, 'users'));
      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userName = userDoc.data().displayName || 'Unknown';
        const wSnap = await A.getDocs(A.collection(A.db, 'users', uid, 'workouts'));
        const workouts = wSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Find duplicates: same stravaId or same day + similar duration
        const seen = new Map();
        workouts.forEach(w => {
          const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
          if (!d) return;
          const dayKey = d.toISOString().split('T')[0];
          const dur = w.duration || 0;
          const key = w.stravaId ? 'strava-' + w.stravaId : dayKey + '-' + Math.round(dur / 5) * 5;
          if (seen.has(key)) {
            const orig = seen.get(key);
            dupeList.push({ uid, userName, dupeId: w.id, dupeName: w.name || 'Workout', origName: orig.name || 'Workout', dayKey });
            totalDupes++;
          } else {
            seen.set(key, w);
          }
        });
      }
    } catch(e) {
      results.innerHTML = '<div style="color:#ef4444;font-size:12px">Error scanning: ' + escHtml(e.message) + '</div>';
      btn.textContent = 'Scan for Duplicates';
      btn.disabled = false;
      return;
    }
    btn.textContent = 'Scan for Duplicates';
    btn.disabled = false;
    if (totalDupes === 0) {
      results.innerHTML = '<div style="color:#22c55e;font-size:12px;font-weight:600">✓ No duplicates found!</div>';
      return;
    }
    let rHtml = '<div style="font-size:12px;color:var(--text);margin-bottom:6px;font-weight:600">' + totalDupes + ' duplicate' + (totalDupes > 1 ? 's' : '') + ' found:</div>';
    dupeList.forEach((d, i) => {
      rHtml += '<div style="font-size:11px;color:var(--muted-fg);margin-bottom:2px">' + escHtml(d.userName) + ': "' + escHtml(d.dupeName) + '" on ' + d.dayKey + '</div>';
    });
    rHtml += '<button id="cleanup-delete-btn" class="btn" style="margin-top:8px;font-size:12px;padding:8px 16px;background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3)">Delete ' + totalDupes + ' Duplicate' + (totalDupes > 1 ? 's' : '') + '</button>';
    results.innerHTML = rHtml;
    A.$('cleanup-delete-btn')?.addEventListener('click', async () => {
      const delBtn = A.$('cleanup-delete-btn');
      delBtn.textContent = 'Deleting...';
      delBtn.disabled = true;
      let deleted = 0;
      for (const d of dupeList) {
        try {
          await A.deleteDoc(A.doc(A.db, 'users', d.uid, 'workouts', d.dupeId));
          deleted++;
        } catch(e) {}
      }
      results.innerHTML = '<div style="color:#22c55e;font-size:12px;font-weight:600">✓ Deleted ' + deleted + ' duplicate' + (deleted > 1 ? 's' : '') + '</div>';
    });
  });
}

// --- ANNOUNCEMENTS ---
export function renderAdminAnnouncements() {
  const el = A.$('admin-announcements');
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

  if (A.adminAnnouncements.length === 0) {
    html += '<div class="admin-empty">No announcements yet.</div>';
  } else {
    html += '<div class="card">';
    A.adminAnnouncements.forEach((a, i) => {
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
  A.$('ann-add-btn').addEventListener('click', async () => {
    const title = A.$('ann-title').value.trim();
    const message = A.$('ann-message').value.trim();
    if (!title) { A.showToast('Enter a title.', 'warn'); return; }
    if (!message) { A.showToast('Enter a message.', 'warn'); return; }
    A.adminAnnouncements.unshift({ id: 'ann-' + Date.now(), title, message, active: true, createdAt: new Date().toISOString() });
    await saveAnnouncements();
    renderAdminAnnouncements();
  });

  // Bind toggles
  el.querySelectorAll('.admin-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.annIdx);
      A.adminAnnouncements[idx].active = !A.adminAnnouncements[idx].active;
      await saveAnnouncements();
      renderAdminAnnouncements();
    });
  });

  // Bind deletes
  el.querySelectorAll('[data-ann-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this announcement?')) return;
      const idx = parseInt(btn.dataset.annDel);
      A.adminAnnouncements.splice(idx, 1);
      await saveAnnouncements();
      renderAdminAnnouncements();
    });
  });
}

async function saveAnnouncements() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'announcements'), { items: A.adminAnnouncements });
  } catch(e) {
    console.error('Save announcements error:', e);
    A.showToast('Failed to save.', 'error');
  }
}

// --- TRAINING SESSIONS ---
function renderAdminTraining() {
  const el = A.$('admin-training');
  if (!el) return;
  const sessions = A.trainingSessions || [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  // Split into upcoming and past
  const upcoming = sessions.filter(s => s.date >= todayStr).sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = sessions.filter(s => s.date < todayStr).sort((a,b) => (b.date + b.time).localeCompare(a.date + a.time));

  let html = '';
  // Create session form
  html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px">Schedule a Session</div>
    <input class="input" id="ts-title" type="text" placeholder="Session title (e.g. After School Training)" value="" style="margin-bottom:6px;width:100%;font-size:13px">
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <input class="input" id="ts-date" type="date" value="${todayStr}" style="flex:1;font-size:13px">
    </div>
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <div style="flex:1"><label style="font-size:10px;color:var(--muted-fg)">Start</label><input class="input" id="ts-time" type="time" value="15:45" style="width:100%;font-size:13px"></div>
      <div style="flex:1"><label style="font-size:10px;color:var(--muted-fg)">End</label><input class="input" id="ts-end-time" type="time" value="17:00" style="width:100%;font-size:13px"></div>
    </div>
    <input class="input" id="ts-location" type="text" placeholder="Location (e.g. School Oval, Gym)" value="" style="margin-bottom:6px;width:100%;font-size:13px">
    <textarea class="input" id="ts-notes" placeholder="Notes for students (e.g. Bring helmet, floor session if raining)" style="margin-bottom:8px;width:100%;min-height:50px;resize:vertical;font-size:13px"></textarea>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted-fg);cursor:pointer;flex:1">
        <input type="checkbox" id="ts-repeat"> Repeat weekly
      </label>
      <select class="input" id="ts-repeat-weeks" style="width:auto;font-size:12px;padding:4px 8px">
        <option value="4">4 weeks</option>
        <option value="8" selected>8 weeks</option>
        <option value="10">10 weeks (term)</option>
        <option value="12">12 weeks</option>
        <option value="20">20 weeks (semester)</option>
      </select>
    </div>
    <div style="display:flex;gap:6px">
      <button id="ts-save-btn" class="btn btn-primary" style="flex:1;font-size:13px;padding:10px">Add Session</button>
    </div>
  </div>`;

  // Upcoming sessions
  if (upcoming.length > 0) {
    html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px">Upcoming Sessions (' + upcoming.length + ')</div>';
    upcoming.forEach((s, i) => {
      const sDate = new Date(s.date + 'T' + (s.time || '16:00') + ':00');
      const dayLabel = sDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
      html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px">
        <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${escHtml(s.title || 'Training')}</div>
          <div style="font-size:11px;font-weight:600;color:var(--primary)">${dayLabel}</div>
        </div>
        <div style="font-size:12px;color:var(--muted-fg);margin-bottom:2px">${s.time || ''}${s.endTime ? ' - ' + s.endTime : ''}${s.location ? ' · ' + escHtml(s.location) : ''}</div>
        ${s.notes ? '<div style="font-size:11px;color:var(--muted-fg);line-height:1.4;margin-bottom:6px">' + escHtml(s.notes) + '</div>' : ''}
        <div style="display:flex;gap:6px">
          <button class="btn ts-notify-btn" data-ts-id="${s.id}" style="flex:1;padding:6px;font-size:11px;font-weight:600;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);color:#a855f7;border-radius:6px">📢 Notify All</button>
          <button class="btn ts-edit-btn" data-ts-id="${s.id}" style="padding:6px 10px;font-size:11px;background:var(--surface-alt);border:1px solid var(--border);color:var(--text);border-radius:6px">Edit</button>
          <button class="btn ts-delete-btn" data-ts-id="${s.id}" style="padding:6px 10px;font-size:11px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ef4444;border-radius:6px">Delete</button>
        </div>
      </div>`;
    });
  } else {
    html += '<div style="font-size:12px;color:var(--muted-fg);margin-bottom:12px;text-align:center;padding:16px">No upcoming sessions. Schedule one above.</div>';
  }

  // Past sessions (collapsed)
  if (past.length > 0) {
    html += `<details style="margin-top:8px"><summary style="font-size:12px;color:var(--muted-fg);cursor:pointer;padding:6px 0">Past Sessions (${past.length})</summary>`;
    past.forEach(s => {
      const sDate = new Date(s.date + 'T00:00:00');
      const dayLabel = sDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
      html += `<div style="padding:8px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:4px;opacity:.6">
        <div style="font-size:12px;font-weight:600">${escHtml(s.title || 'Training')} · ${dayLabel}</div>
        <div style="font-size:11px;color:var(--muted-fg)">${s.time || ''}${s.location ? ' · ' + escHtml(s.location) : ''}</div>
      </div>`;
    });
    html += '</details>';
  }

  el.innerHTML = html;

  // Bind save
  const saveBtn = A.$('ts-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const title = A.$('ts-title')?.value?.trim();
      const date = A.$('ts-date')?.value;
      const time = A.$('ts-time')?.value;
      const endTime = A.$('ts-end-time')?.value;
      const location = A.$('ts-location')?.value?.trim();
      const notes = A.$('ts-notes')?.value?.trim();
      if (!title) { A.showToast('Enter a session title.', 'warn'); return; }
      if (!date) { A.showToast('Pick a date.', 'warn'); return; }
      const repeat = A.$('ts-repeat')?.checked || false;
      const repeatWeeks = parseInt(A.$('ts-repeat-weeks')?.value) || 8;
      // Generate sessions
      const sessions = [];
      const weekCount = repeat ? repeatWeeks : 1;
      for (let w = 0; w < weekCount; w++) {
        const d = new Date(date + 'T00:00:00');
        d.setDate(d.getDate() + (w * 7));
        sessions.push({
          id: Date.now().toString() + '-' + w,
          title, date: d.toISOString().split('T')[0], time: time || null, endTime: endTime || null,
          location: location || null, notes: notes || null,
          createdBy: A.userProfile?.displayName || 'Coach',
          createdAt: new Date().toISOString()
        });
      }
      const updated = [...(A.trainingSessions || []), ...sessions];
      if (A.demoMode) {
        A.trainingSessions = updated;
        A.showToast(sessions.length > 1 ? sessions.length + ' sessions added (demo).' : 'Session added (demo).', 'success');
        renderAdminTraining();
        return;
      }
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
      try {
        await A.setDoc(A.doc(A.db, 'config', 'trainingSessions'), { sessions: updated });
        A.trainingSessions = updated;
        try { localStorage.setItem('vf_training_sessions', JSON.stringify(updated)); } catch(e) {}
        A.showToast(sessions.length > 1 ? sessions.length + ' sessions scheduled!' : 'Session scheduled!', 'success');
        renderAdminTraining();
      } catch(e) {
        A.showToast('Failed to save session.', 'error');
        saveBtn.textContent = 'Add Session';
        saveBtn.disabled = false;
      }
    });
  }

  // Bind delete
  el.querySelectorAll('.ts-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.tsId;
      if (!confirm('Delete this session?')) return;
      const updated = (A.trainingSessions || []).filter(s => s.id !== id);
      if (A.demoMode) {
        A.trainingSessions = updated;
        renderAdminTraining();
        return;
      }
      try {
        await A.setDoc(A.doc(A.db, 'config', 'trainingSessions'), { sessions: updated });
        A.trainingSessions = updated;
        try { localStorage.setItem('vf_training_sessions', JSON.stringify(updated)); } catch(e) {}
        A.showToast('Session deleted.', 'success');
        renderAdminTraining();
      } catch(e) { A.showToast('Failed to delete.', 'error'); }
    });
  });

  // Bind edit — pre-fill form with session data
  el.querySelectorAll('.ts-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tsId;
      const session = (A.trainingSessions || []).find(s => s.id === id);
      if (!session) return;
      const ti = A.$('ts-title'); if (ti) ti.value = session.title || '';
      const dt = A.$('ts-date'); if (dt) dt.value = session.date || '';
      const tm = A.$('ts-time'); if (tm) tm.value = session.time || '';
      const et = A.$('ts-end-time'); if (et) et.value = session.endTime || '';
      const lc = A.$('ts-location'); if (lc) lc.value = session.location || '';
      const nt = A.$('ts-notes'); if (nt) nt.value = session.notes || '';
      // Remove old session, save button acts as update
      A.trainingSessions = (A.trainingSessions || []).filter(s => s.id !== id);
      A.showToast('Editing session — make changes and tap Add.', 'info');
      // Scroll to top
      el.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Bind notify all — post as announcement
  el.querySelectorAll('.ts-notify-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.tsId;
      const session = (A.trainingSessions || []).find(s => s.id === id);
      if (!session) return;
      const sDate = new Date(session.date + 'T00:00:00');
      const dayLabel = sDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
      const annTitle = '🏋️ ' + (session.title || 'Training Session');
      let annMsg = dayLabel;
      if (session.time) annMsg += ' at ' + session.time;
      if (session.endTime) annMsg += ' - ' + session.endTime;
      if (session.location) annMsg += '\nLocation: ' + session.location;
      if (session.notes) annMsg += '\n' + session.notes;
      const newAnn = {
        id: Date.now().toString(),
        title: annTitle,
        message: annMsg,
        date: new Date().toISOString(),
        by: A.userProfile?.displayName || 'Coach',
        active: true
      };
      if (A.demoMode) {
        A.adminAnnouncements.unshift(newAnn);
        A.showToast('Notification sent (demo).', 'success');
        return;
      }
      btn.textContent = 'Sending...';
      btn.disabled = true;
      try {
        const configRef = A.doc(A.db, 'config', 'announcements');
        const snap = await A.getDoc(configRef);
        const items = snap.exists() ? (snap.data().items || []) : [];
        items.unshift(newAnn);
        await A.setDoc(configRef, { items });
        A.adminAnnouncements = items;
        A.showToast('Notification sent to all students!', 'success');
        btn.textContent = '✓ Sent';
      } catch(e) {
        A.showToast('Failed to send notification.', 'error');
        btn.textContent = '📢 Notify All';
        btn.disabled = false;
      }
    });
  });
}

// --- RACES ---

// ============================================
// RACE FOOTAGE (Admin-managed)
// ============================================

export async function loadRaceFootage() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'raceFootage'));
    A.raceFootage = snap.exists() ? (snap.data().footage || {}) : {};
  } catch(e) {
    A.raceFootage = {};
  }
}

async function saveRaceFootage() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'raceFootage'), { footage: A.raceFootage });
  } catch(e) {
    console.error('Save race footage error:', e);
    A.showToast('Failed to save footage links.', 'error');
  }
}

export async function loadRaceLogVideos() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'raceLogVideos'));
    A.raceLogVideos = snap.exists() ? (snap.data().videos || []) : [];
  } catch(e) {
    A.raceLogVideos = [];
  }
}

async function saveRaceLogVideos() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'raceLogVideos'), { videos: A.raceLogVideos });
  } catch(e) {
    console.error('Save race log videos error:', e);
    A.showToast('Failed to save videos.', 'error');
  }
}

function renderRaceFootageSection(parentEl) {
  const races = A.getActiveRaces();
  let html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">';
  html += '<div class="label" style="margin-bottom:8px">Race Footage & Stream Links</div>';
  html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Add livestream and footage links for each race. These appear in the Race Log for all users.</div>';
  
  races.forEach(race => {
    const existing = A.raceFootage[race.id] || race.footageUrls || [];
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
      if (!url) { A.showToast('Paste a URL first.', 'warn'); return; }
      const label = labelInput.value.trim() || 'Race Footage';
      const type = url.includes('youtube') || url.includes('youtu.be') ? 'stream' : (url.includes('result') || url.includes('timing') ? 'results' : 'footage');
      if (!A.raceFootage[raceId]) A.raceFootage[raceId] = [];
      A.raceFootage[raceId].push({ label, url, type });
      await saveRaceFootage();
      renderAdminRaces();
    });
  });
  
  // Bind delete footage
  footageDiv.querySelectorAll('[data-footage-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [raceId, idxStr] = btn.dataset.footageDel.split(':');
      const idx = parseInt(idxStr);
      if (A.raceFootage[raceId]) {
        A.raceFootage[raceId].splice(idx, 1);
        if (A.raceFootage[raceId].length === 0) delete A.raceFootage[raceId];
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

export function renderAdminRaceLogVideos(parentEl) {
  const races = A.getActiveRaces();
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
  if (A.raceLogVideos.length > 0) {
    html += '<div class="video-admin-grid">';
    A.raceLogVideos.forEach((v, i) => {
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
      if (!url) { A.showToast('Paste a video URL first.', 'warn'); return; }
      if (!title) { A.showToast('Enter a video title.', 'warn'); return; }
      A.raceLogVideos.push({
        title,
        url,
        raceId: raceId || null,
        addedBy: A.currentUser?.email || 'admin',
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
      A.raceLogVideos.splice(idx, 1);
      await saveRaceLogVideos();
      renderAdminRaces();
    });
  });
}


export function renderAdminRaces() {
  const el = A.$('admin-races');
  const races = A.getActiveRaces();
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
  A.$('race-add-btn').addEventListener('click', async () => {
    const name = A.$('race-name').value.trim();
    const date = A.$('race-date').value;
    const location = A.$('race-location').value.trim();
    const distance = parseInt(A.$('race-distance').value) || 0;
    const notes = A.$('race-notes').value.trim();
    if (!name || !date) { A.showToast('Enter a name and date.', 'warn'); return; }
    const newRaces = [...(A.adminRaces || RACES)];
    newRaces.push({ id: 'r-' + Date.now(), name, date, location, distance, type: 'endurance', notes });
    newRaces.sort((a, b) => a.date.localeCompare(b.date));
    A.adminRaces = newRaces;
    await saveRaces();
    renderAdminRaces();
  });

  // Bind deletes
  el.querySelectorAll('[data-race-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this race?')) return;
      const idx = parseInt(btn.dataset.raceDel);
      const newRaces = [...(A.adminRaces || RACES)];
      newRaces.splice(idx, 1);
      A.adminRaces = newRaces;
      await saveRaces();
      renderAdminRaces();
    });
  });

  // --- Race Footage Management Section ---
  if (A.isAdmin) renderRaceFootageSection(el);
  // --- Race Log Videos Management ---
  if (A.isAdmin) renderAdminRaceLogVideos(el);
}

async function saveRaces() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'races'), { races: A.adminRaces });
  } catch(e) {
    console.error('Save races error:', e);
    A.showToast('Failed to save.', 'error');
  }
}

// --- USERS ---
export function renderAdminUsersMerged() {
  const el = A.$('admin-users');
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

  const sc = A.$('users-sub-content');
  switch (usersSubTab) {
    case 'all': renderUsersAll(sc); break;
    case 'permissions': renderUsersPermissions(sc); break;
  }
}

async function renderUsersAll(el) {
  el.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div><div style="margin-top:8px;color:var(--muted-fg);font-size:13px">Loading users...</div></div>';

  try {
    const usersSnap = await A.getDocs(A.collection(A.db, 'users'));
    A.allUsersCache = [];
    for (const d of usersSnap.docs) {
      const u = d.data();
      let wCount = 0;
      try {
        const wSnap = await A.getDocs(A.collection(A.db, 'users', d.id, 'workouts'));
        wCount = wSnap.size;
      } catch(e) {}
      A.allUsersCache.push({ uid: d.id, ...u, workoutCount: wCount });
    }
  } catch(e) {
    el.innerHTML = '<div class="admin-empty">Failed to load users.</div>';
    console.error('Load users error:', e);
    return;
  }

  let html = `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:10px">${A.allUsersCache.length} registered user${A.allUsersCache.length !== 1 ? 's' : ''}</div>`;

  if (A.allUsersCache.length === 0) {
    html += '<div class="admin-empty">No users yet.</div>';
  } else {
    A.allUsersCache.forEach(u => {
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
        await A.updateDoc(A.doc(A.db, 'users', uid), { yearLevel: yearSel.value, fitnessLevel: tierSel.value });
        btn.textContent = 'Saved!';
        setTimeout(() => { btn.textContent = 'Save'; }, 1500);
      } catch(e) {
        console.error('Save user error:', e);
        A.showToast('Failed to save.', 'error');
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
          ${A.ALL_ADMIN_FEATURES.map(f => `
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
        <div class="perm-admin-email">${escHtml(A.ADMIN_EMAIL)}</div>
        <span class="admin-perm-badge">Owner</span>
      </div>
      <div class="perm-admin-tags">
        ${A.ALL_ADMIN_FEATURES.map(f => `<span class="perm-tag">${f.label}</span>`).join('')}
      </div>
    </div>
  `;

  // --- Each granted admin ---
  A.adminPerms.forEach((entry, i) => {
    const perms = entry.perms || [];
    html += `
      <div class="perm-admin-card">
        <div class="perm-admin-header">
          <div class="perm-admin-email">${escHtml(entry.email)}</div>
        </div>
        <div class="perm-feature-grid perm-edit-grid" data-perm-idx="${i}">
          ${A.ALL_ADMIN_FEATURES.map(f => `
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
  A.adminEmails.forEach((email, i) => {
    if (A.adminPerms.some(p => (p.email || '').toLowerCase() === (email || '').toLowerCase())) return;
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

  A.$('perm-select-all').addEventListener('click', () => {
    el.querySelectorAll('#perm-new-features .perm-feature-toggle').forEach(t => t.classList.add('active'));
  });

  A.$('perm-add-btn').addEventListener('click', async () => {
    const email = A.$('perm-email').value.trim().toLowerCase();
    if (!email || !email.includes('@')) { A.showToast('Enter a valid email.', 'warn'); return; }
    if (email === A.ADMIN_EMAIL.toLowerCase()) { A.showToast('This is already the owner account.', 'warn'); return; }
    if (A.adminPerms.some(e => (e.email || '').toLowerCase() === email)) { A.showToast('Already an admin.', 'warn'); return; }
    if (A.adminEmails.some(e => (e || '').toLowerCase() === email)) { A.showToast('Already an admin (legacy).', 'warn'); return; }

    const selectedPerms = [];
    el.querySelectorAll('#perm-new-features .perm-feature-toggle.active').forEach(t => {
      selectedPerms.push(t.dataset.feat);
    });
    if (selectedPerms.length === 0) { A.showToast('Select at least one permission.', 'warn'); return; }

    A.adminPerms.push({ email, perms: selectedPerms });
    await saveAdminEmails();
    renderAdminUsersMerged();
  });

  el.querySelectorAll('.perm-edit-grid .perm-feature-toggle').forEach(tog => {
    tog.addEventListener('click', async () => {
      const idx = parseInt(tog.dataset.permIdx);
      const feat = tog.dataset.feat;
      tog.classList.toggle('active');
      const entry = A.adminPerms[idx];
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
      const entry = A.adminPerms[idx];
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
      A.adminPerms.splice(idx, 1);
      await saveAdminEmails();
      renderAdminUsersMerged();
    });
  });

  el.querySelectorAll('[data-legacy-migrate]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.legacyMigrate);
      const email = A.adminEmails[idx];
      A.adminPerms.push({ email, perms: A.ALL_ADMIN_FEATURES.map(f => f.id) });
      A.adminEmails.splice(idx, 1);
      saveAdminEmails();
      renderAdminUsersMerged();
    });
  });

  el.querySelectorAll('[data-legacy-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove admin access for this account?')) return;
      const idx = parseInt(btn.dataset.legacyDel);
      A.adminEmails.splice(idx, 1);
      await saveAdminEmails();
      renderAdminUsersMerged();
    });
  });
}

// --- PLANS ---
export function renderAdminPlansMerged() {
  const el = A.$('admin-plans');
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

  const sc = A.$('plans-sub-content');
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

  let html = `<div style="font-size:13px;color:var(--muted-fg);margin-bottom:10px">${A.ALL_PLANS.length} plans · ${A.hiddenPlans.size} hidden · Tap a plan name to edit its details.</div>`;

  categories.forEach(cat => {
    const plans = A.ALL_PLANS.filter(p => p.category === cat.id);
    if (plans.length === 0) return;
    html += `<div style="font-size:14px;font-weight:700;color:var(--fg);margin:12px 0 6px">${cat.name} (${plans.length})</div>`;
    html += '<div class="card">';
    plans.forEach(p => {
      const isHidden = A.hiddenPlans.has(p.id);
      const pd = A.getPlanDisplayData(p);
      const hasOverride = !!A.planOverrides[p.id];
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
      if (A.hiddenPlans.has(pid)) {
        A.hiddenPlans.delete(pid);
      } else {
        A.hiddenPlans.add(pid);
      }
      await saveHiddenPlans();
      renderAdminPlansMerged();
    });
  });

  // Bind plan edit clicks
  el.querySelectorAll('[data-edit-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.editPlan;
      const plan = A.ALL_PLANS.find(p => p.id === pid);
      if (plan) openPlanEditSheet(plan);
    });
  });
}

function openPlanEditSheet(plan) {
  const ov = A.planOverrides[plan.id] || {};
  const name = ov.name || plan.name;
  const desc = ov.description || plan.description;
  const weeks = ov.durationWeeks || plan.durationWeeks;
  const sessions = ov.sessionsPerWeek || plan.sessionsPerWeek;

  A.$('sheet-content').innerHTML = `
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
      ${A.planOverrides[plan.id] ? '<button class="btn btn-secondary" id="plan-edit-reset">Reset to Default</button>' : ''}
    </div>
  `;
  A.openSheet();

  A.$('plan-edit-save').addEventListener('click', async () => {
    const newName = A.$('plan-edit-name').value.trim();
    const newDesc = A.$('plan-edit-desc').value.trim();
    const newWeeks = parseInt(A.$('plan-edit-weeks').value) || plan.durationWeeks;
    const newSessions = parseInt(A.$('plan-edit-sessions').value) || plan.sessionsPerWeek;

    const ov = {};
    if (newName && newName !== plan.name) ov.name = newName;
    if (newDesc && newDesc !== plan.description) ov.description = newDesc;
    if (newWeeks !== plan.durationWeeks) ov.durationWeeks = newWeeks;
    if (newSessions !== plan.sessionsPerWeek) ov.sessionsPerWeek = newSessions;

    if (Object.keys(ov).length > 0) {
      A.planOverrides[plan.id] = ov;
    } else {
      delete A.planOverrides[plan.id];
    }
    await savePlanOverrides();
    A.closeSheet();
    renderAdminPlansMerged();
    if (currentPage === 'fitness' && fitnessSubTab === 'plans') A.renderPlans();
    if (currentPage === 'today') A.renderToday();
  });

  const resetBtn = A.$('plan-edit-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset this plan to its original content?')) return;
      delete A.planOverrides[plan.id];
      await savePlanOverrides();
      A.closeSheet();
      renderAdminPlansMerged();
      if (currentPage === 'fitness' && fitnessSubTab === 'plans') A.renderPlans();
      if (currentPage === 'today') A.renderToday();
    });
  }
}

function renderPlansWorkouts(el) {
  const visiblePlans = A.getVisiblePlans();
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
          const ov = A.exerciseOverrides[key];
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
      const plan = A.getVisiblePlans().find(p => p.id === planId);
      if (!plan) return;
      const w = plan.workouts[wi];
      if (!w) return;
      const ov = A.exerciseOverrides[key] || {};
      openExerciseEditSheet(key, w, ov);
    });
  });

  el.querySelectorAll('[data-reset-exercise]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.resetExercise;
      if (!confirm('Reset this workout to its original content?')) return;
      delete A.exerciseOverrides[key];
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

  const vidCount = Object.keys(A.exerciseDemoVideos).filter(k => A.exerciseDemoVideos[k]).length;
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
    const withVid = exercises.filter(e => A.exerciseDemoVideos[e.key]).length;
    html += `<div style="font-size:14px;font-weight:700;color:var(--fg);margin:12px 0 6px">${cat.name} <span style="font-weight:400;font-size:12px;color:var(--muted-fg)">(${exercises.length} exercises · ${withVid} with videos)</span></div>`;
    html += '<div class="card admin-vid-cat" data-vid-cat="' + cat.id + '">';
    exercises.forEach(ex => {
      const currentUrl = A.exerciseDemoVideos[ex.key] || '';
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
  const searchInput = A.$('admin-vid-search');
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
      delete A.exerciseDemoVideos[key];
      await saveExerciseDemoVideos();
      renderAdminPlansMerged();
    });
  });

  // Bind save all
  A.$('admin-vid-save-all').addEventListener('click', async () => {
    const inputs = el.querySelectorAll('input[data-vid-key]');
    inputs.forEach(inp => {
      const key = inp.dataset.vidKey;
      const val = inp.value.trim();
      if (val) {
        A.exerciseDemoVideos[key] = val;
      } else {
        delete A.exerciseDemoVideos[key];
      }
    });
    await saveExerciseDemoVideos();
    const btn = A.$('admin-vid-save-all');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save All Videos'; }, 1500);
  });
}

export async function loadHiddenPlans() {
  if (!A.db) return;
  try {
    const hpSnap = await A.getDoc(A.doc(A.db, 'config', 'hiddenPlans'));
    A.hiddenPlans = new Set(hpSnap.exists() ? (hpSnap.data().ids || []) : []);
  } catch(e) {
    A.hiddenPlans = new Set();
  }
}

export async function saveHiddenPlans() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'hiddenPlans'), { ids: [...A.hiddenPlans] });
  } catch(e) {
    console.error('Save hidden plans error:', e);
    A.showToast('Failed to save.', 'error');
  }
}



// ============================================
// ADMIN PERMISSIONS
// ============================================

export async function loadAdminEmails() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'adminEmails'));
    if (snap.exists()) {
      const data = snap.data();
      // Support both old format (emails: string[]) and new format (perms: [{email, perms}])
      A.adminEmails = data.emails || [];
      A.adminPerms = data.perms || [];
    } else {
      A.adminEmails = [];
      A.adminPerms = [];
    }
  } catch(e) {
    A.adminEmails = [];
    A.adminPerms = [];
  }
}

export async function saveAdminEmails() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'adminEmails'), { emails: A.adminEmails, perms: A.adminPerms });
  } catch(e) {
    console.error('Save admin emails error:', e);
    A.showToast('Failed to save.', 'error');
  }
}


// ============================================
// ADMIN: EXERCISE EDITING
// ============================================

export async function loadExerciseOverrides() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'exerciseOverrides'));
    A.exerciseOverrides = snap.exists() ? (snap.data().overrides || {}) : {};
  } catch(e) {
    A.exerciseOverrides = {};
  }
}

export async function saveExerciseOverrides() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'exerciseOverrides'), { overrides: A.exerciseOverrides });
  } catch(e) {
    console.error('Save exercise overrides error:', e);
    A.showToast('Failed to save exercises.', 'error');
  }
}

export async function loadPlanOverrides() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'planOverrides'));
    A.planOverrides = snap.exists() ? (snap.data().overrides || {}) : {};
  } catch(e) {
    A.planOverrides = {};
  }
}

export async function savePlanOverrides() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'planOverrides'), { overrides: A.planOverrides });
  } catch(e) {
    console.error('Save plan overrides error:', e);
    A.showToast('Failed to save plan changes.', 'error');
  }
}

export async function loadExerciseDemoVideos() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'exerciseDemoVideos'));
    A.exerciseDemoVideos = snap.exists() ? (snap.data().videos || {}) : {};
  } catch(e) {
    A.exerciseDemoVideos = {};
  }
}

export async function saveExerciseDemoVideos() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'exerciseDemoVideos'), { videos: A.exerciseDemoVideos });
  } catch(e) {
    console.error('Save exercise demo videos error:', e);
    A.showToast('Failed to save.', 'error');
  }
}

export function getWorkoutData(planId, weekIdx, workout) {
  const key = planId + '_' + weekIdx;
  const override = A.exerciseOverrides[key];
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
  
  A.$('sheet-content').innerHTML = `
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
  A.openSheet();
  
  A.$('ex-edit-save').addEventListener('click', async () => {
    const newName = A.$('ex-edit-name').value.trim();
    const newDesc = A.$('ex-edit-desc').value.trim();
    const newDur = parseInt(A.$('ex-edit-dur').value) || originalWorkout.duration;
    const newInt = A.$('ex-edit-int').value;
    
    // Only save overrides for fields that differ from original
    const ov = {};
    if (newName && newName !== originalWorkout.name) ov.name = newName;
    if (newDesc && newDesc !== originalWorkout.description) ov.description = newDesc;
    if (newDur !== originalWorkout.duration) ov.duration = newDur;
    if (newInt !== originalWorkout.intensity) ov.intensity = newInt;
    
    if (Object.keys(ov).length > 0) {
      A.exerciseOverrides[key] = ov;
    } else {
      delete A.exerciseOverrides[key];
    }
    
    await saveExerciseOverrides();
    A.closeSheet();
    renderAdminPlansMerged();
    // Also re-render plans and today if visible
    if (currentPage === 'fitness' && fitnessSubTab === 'plans') A.renderPlans();
    if (currentPage === 'today') A.renderToday();
  });
}

// (Permissions now rendered within renderAdminUsersMerged → renderUsersPermissions)

// ============================================
// VIDEO OVERRIDE (Demo Links)
// ============================================

export async function loadVideoOverrides() {
  if (!A.db) return;
  try {
    const snap = await A.getDoc(A.doc(A.db, 'config', 'videoOverrides'));
    A.videoOverrides = snap.exists() ? (snap.data().overrides || {}) : {};
  } catch(e) {
    A.videoOverrides = {};
  }
}

export async function saveVideoOverrides() {
  if (!A.db) return;
  try {
    await A.setDoc(A.doc(A.db, 'config', 'videoOverrides'), { overrides: A.videoOverrides });
  } catch(e) {
    console.error('Save video overrides error:', e);
    A.showToast('Failed to save.', 'error');
  }
}

export function getVideoUrl(planId, workoutIdx, defaultUrl) {
  if (A.videoOverrides[planId] && A.videoOverrides[planId][workoutIdx] !== undefined) {
    return A.videoOverrides[planId][workoutIdx] || defaultUrl;
  }
  return defaultUrl;
}

let demoExpandedPlan = null;

// (Demo links now rendered within renderAdminPlansMerged → renderPlansVideos)

// ============================================
