// TurboPrep Race Log Module
import { escHtml } from './state.js';

let A = {};
export function initRaceLog(ctx) { A = ctx; }

export async function loadUserRaceLogs() {
  if (!A.currentUser || !A.db) { A.userRaceLogs = []; return; }
  try {
    const snap = await A.getDocs(A.collection(A.db, 'users', A.currentUser.uid, 'raceLogs'));
    A.userRaceLogs = [];
    snap.forEach(d => {
      A.userRaceLogs.push({ _id: d.id, ...d.data() });
    });
    A.userRaceLogs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch(e) {
    console.error('Load race logs error:', e);
    A.userRaceLogs = [];
  }
}

export function getFootageForRace(raceId) {
  // Check admin-managed footage, then default race data
  if (A.raceFootage[raceId] && A.raceFootage[raceId].length) return A.raceFootage[raceId];
  const race = A.getActiveRaces().find(r => r.id === raceId);
  if (race && race.footageUrls && race.footageUrls.length) return race.footageUrls;
  return [];
}

export function getStreamForRace(raceId) {
  const race = A.getActiveRaces().find(r => r.id === raceId);
  return (race && race.streamUrl) || '';
}

export function renderFootageLinks(raceId) {
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

export function getCompletedRacesNeedingLogs() {
  const races = A.getActiveRaces();
  const today = new Date().toISOString().split('T')[0];
  const loggedTracks = new Set((A.userRaceLogs || []).map(l => (l.trackName || '').toLowerCase()));
  return races.filter(r => {
    if (!r.date || r.date > today) return false;
    // Check if user already logged this specific race
    const trackLower = (r.location || r.name || '').toLowerCase();
    const nameLower = (r.name || '').toLowerCase();
    return !(A.userRaceLogs || []).some(l => {
      const lt = (l.trackName || '').toLowerCase();
      return (lt === trackLower || lt.includes(trackLower.split(',')[0].toLowerCase()) || nameLower.includes(lt)) && l.date === r.date;
    });
  });
}

export function renderRaceLog() {
  const c = A.$('racelog-content');
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
    html += '<div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:8px">Races to Log</div>';
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
  if (A.userRaceLogs.length === 0 && needsLog.length === 0) {
    html += `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg></div>
      <div class="empty-state-title">No Race Data Yet</div>
      <div class="empty-state-desc">Log your race results to track your progress across different tracks — average lap times, fastest laps, and more.</div>
    </div>`;
  }

  if (A.userRaceLogs.length > 0) {
    if (needsLog.length > 0) html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin:16px 0 8px">Your Race History</div>';
    html += '<div class="space-y">';
    A.userRaceLogs.forEach((entry, i) => {
      // Find matching race for footage
      const matchingRace = A.getActiveRaces().find(r => {
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
  if (A.raceLogVideos.length > 0) {
    html += '<div class="race-video-section">';
    html += '<div class="race-video-heading"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg> Race Videos</div>';
    A.raceLogVideos.forEach(v => {
      const matchedRace = v.raceId ? A.getActiveRaces().find(r => r.id === v.raceId) : null;
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
  A.$('racelog-add-btn').addEventListener('click', () => openRaceLogForm());

  // Bind "Log Your Results" for completed race prompts
  c.querySelectorAll('[data-log-race]').forEach(btn => {
    btn.addEventListener('click', () => {
      const raceId = btn.dataset.logRace;
      const race = A.getActiveRaces().find(r => r.id === raceId);
      if (race) {
        openRaceLogForm({ trackName: race.location || race.name, date: race.date });
      }
    });
  });

  // Bind edits
  c.querySelectorAll('[data-racelog-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.racelogEdit);
      openRaceLogForm(A.userRaceLogs[idx], idx);
    });
  });

  // Bind deletes
  c.querySelectorAll('[data-racelog-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this race log entry?')) return;
      const idx = parseInt(btn.dataset.racelogDel);
      const entry = A.userRaceLogs[idx];
      if (entry._id && A.db && A.currentUser) {
        try {
          await A.deleteDoc(A.doc(A.db, 'users', A.currentUser.uid, 'raceLogs', entry._id));
        } catch(e) { console.error('Delete race log error:', e); }
      }
      A.userRaceLogs.splice(idx, 1);
      renderRaceLog();
    });
  });
}

export function openRaceLogForm(existing, editIdx) {
  const c = A.$('racelog-content');
  const isEdit = existing !== undefined;
  const e = existing || {};

  // Build track options from RACES
  const races = A.getActiveRaces();
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
  const trackSel = A.$('rl-track-select');
  const trackCustom = A.$('rl-track-custom');
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
  A.$('rl-cancel-btn').addEventListener('click', () => renderRaceLog());

  // Save
  A.$('rl-save-btn').addEventListener('click', async () => {
    let trackName = trackSel.value === '__custom' ? trackCustom.value.trim() : (trackSel.value || trackCustom.value.trim());
    if (!trackName) { A.showToast('Please select a track name.', 'warn'); return; }

    const entry = {
      trackName,
      date: A.$('rl-date').value,
      avgLapTime: A.$('rl-avg-lap').value.trim(),
      fastestLap: A.$('rl-fastest').value.trim(),
      totalLaps: A.$('rl-laps').value ? parseInt(A.$('rl-laps').value) : null,
      totalTime: A.$('rl-totaltime').value.trim(),
      avgHR: A.$('rl-avghr').value ? parseInt(A.$('rl-avghr').value) : null,
      maxHR: A.$('rl-maxhr').value ? parseInt(A.$('rl-maxhr').value) : null,
      notes: A.$('rl-notes').value.trim(),
      updatedAt: new Date().toISOString()
    };

    if (A.db && A.currentUser) {
      try {
        if (isEdit && existing._id) {
          await A.updateDoc(A.doc(A.db, 'users', A.currentUser.uid, 'raceLogs', existing._id), entry);
          A.userRaceLogs[editIdx] = { _id: existing._id, ...entry };
        } else {
          entry.createdAt = new Date().toISOString();
          const ref = await A.addDoc(A.collection(A.db, 'users', A.currentUser.uid, 'raceLogs'), entry);
          A.userRaceLogs.unshift({ _id: ref.id, ...entry });
        }
      } catch(e) {
        console.error('Save race log error:', e);
        A.showToast('Failed to save.', 'error');
        return;
      }
    }
    renderRaceLog();
  });
}
