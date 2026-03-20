// VeloForge AI Features Module — Plan editing, weekly review, race prep, injury mode
import { escHtml } from './state.js';

let A = {};
export function initAiFeatures(ctx) { A = ctx; }

export function startAiPlanEdit() {
  const messagesEl = A.$('ai-messages');
  const activePlan = A.userProfile?.activePlanId ? A.findPlan(A.userProfile.activePlanId) : null;
  const planName = activePlan?.name || 'your plan';
  
  if (!activePlan) {
    const msg = document.createElement('div');
    msg.className = 'ai-msg ai';
    msg.textContent = 'You don\'t have an active plan to edit. Go to Fitness → Plans and start one first, then come back here to customise it.';
    messagesEl.appendChild(msg);
    return;
  }

  const aiMsg = document.createElement('div');
  aiMsg.className = 'ai-msg ai';
  aiMsg.innerHTML = `I can edit <strong>${escHtml(planName)}</strong> for you. What would you like to change?<br><br>
    <div class="ai-quick-btns" style="margin-top:8px">
      <button class="ai-quick-btn ai-edit-opt" data-edit="harder">💪 Make it harder</button>
      <button class="ai-quick-btn ai-edit-opt" data-edit="easier">😌 Make it easier</button>
      <button class="ai-quick-btn ai-edit-opt" data-edit="shorter">⏱️ Shorter sessions</button>
      <button class="ai-quick-btn ai-edit-opt" data-edit="swap">🔄 Swap a workout</button>
      <button class="ai-quick-btn ai-edit-opt" data-edit="custom">✏️ Describe changes</button>
    </div>`;
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  messagesEl.querySelectorAll('.ai-edit-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const edit = btn.dataset.edit;
      const prompts = {
        harder: 'Make my current plan (' + planName + ') harder — increase intensity, add more reps, or extend duration.',
        easier: 'Make my current plan (' + planName + ') easier — reduce intensity, fewer reps, more rest.',
        shorter: 'Shorten the sessions in my current plan (' + planName + ') to 20-30 minutes while keeping effectiveness.',
        swap: 'I want to swap one of the workouts in my plan (' + planName + '). Suggest alternatives.',
      };
      if (edit === 'custom') {
        const userMsg = document.createElement('div');
        userMsg.className = 'ai-msg user';
        userMsg.textContent = 'I want to customise my plan';
        messagesEl.appendChild(userMsg);
        const promptMsg = document.createElement('div');
        promptMsg.className = 'ai-msg ai';
        promptMsg.textContent = 'Describe what you want to change — e.g. "make week 2 harder", "replace Monday\'s ride with a floor session", "add more core work"';
        messagesEl.appendChild(promptMsg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        A.$('ai-input').dataset.planEditMode = 'true';
        A.$('ai-input').dataset.planEditId = activePlan.id;
      } else {
        sendAiPlanEdit(prompts[edit], activePlan);
      }
    });
  });
}

export async function sendAiPlanEdit(instruction, plan) {
  const messagesEl = A.$('ai-messages');
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = instruction;
  messagesEl.appendChild(userMsg);

  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Build plan summary for context
  const planSummary = plan.workouts ? plan.workouts.map(w => `Week ${w.week} ${w.day}: ${w.name} (${w.duration}min, ${w.intensity})`).join('; ') : 'No workout details';
  
  try {
    const resp = await fetch('/.netlify/functions/ai-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: instruction,
        context: `PLAN_EDIT_MODE. Current plan: "${plan.name}" (${plan.category}, ${plan.yearLevel}, ${plan.tier}). Workouts: ${planSummary}. Student: ${A.userProfile?.yearLevel || 'Y10'}, ${A.userProfile?.fitnessLevel || 'basic'} tier. Respond with specific workout-by-workout changes the student should make. Be practical and specific.`
      })
    });
    const data = await resp.json();
    typingMsg.innerHTML = data.reply || 'Sorry, I couldn\'t process that edit.';
    typingMsg.classList.remove('ai-typing');
  } catch(e) {
    typingMsg.textContent = 'Failed to get AI response. Try again.';
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ============================================
// AI WEEKLY REVIEW
// ============================================
export function startAiWeeklyReview() {
  const messagesEl = A.$('ai-messages');
  // Build last 7 days of training data
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const weekWorkouts = A.userWorkouts.filter(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : null;
    return d && d.getTime() > weekAgo;
  });

  if (weekWorkouts.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'ai-msg ai';
    msg.textContent = 'You haven\'t logged any workouts in the past 7 days, so there\'s nothing to review yet. Log some training and come back — I\'ll give you a proper breakdown!';
    messagesEl.appendChild(msg);
    return;
  }

  const summary = weekWorkouts.map(w => {
    const d = w.date ? (w.date.toDate ? w.date.toDate() : new Date(w.date)) : new Date();
    return `${d.toLocaleDateString('en-AU',{weekday:'short'})}: ${w.name||w.type} (${w.duration||0}min${w.distance ? ', '+w.distance+'km' : ''}${w.rpe ? ', RPE '+w.rpe : ''})`;
  }).join('; ');

  const totalMins = weekWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
  const totalDist = weekWorkouts.reduce((s, w) => s + (w.distance || 0), 0);
  const avgRpe = weekWorkouts.filter(w => w.rpe).length > 0
    ? (weekWorkouts.filter(w => w.rpe).reduce((s, w) => s + w.rpe, 0) / weekWorkouts.filter(w => w.rpe).length).toFixed(1)
    : null;

  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = '📊 Review my training week';
  messagesEl.appendChild(userMsg);

  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  fetch('/.netlify/functions/ai-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Review my training from the past week and tell me what I did well, what I could improve, and what to focus on next week.',
      context: `WEEKLY_REVIEW. Student: ${A.userProfile?.displayName || 'student'}, ${A.userProfile?.yearLevel || 'Y10'}, ${A.userProfile?.fitnessLevel || 'basic'} tier. This week: ${weekWorkouts.length} sessions, ${totalMins} total minutes, ${totalDist.toFixed(1)}km distance${avgRpe ? ', avg RPE ' + avgRpe : ''}. Sessions: ${summary}. Active plan: ${A.userProfile?.activePlanId ? A.findPlan(A.userProfile.activePlanId)?.name || 'unknown' : 'none'}. Give a structured weekly review with: 1) What went well 2) Areas to improve 3) Next week\'s focus. Be specific to their actual data.`
    })
  }).then(r => r.json()).then(data => {
    typingMsg.innerHTML = data.reply || 'Sorry, couldn\'t generate a review.';
  }).catch(() => {
    typingMsg.textContent = 'Failed to generate review. Try again.';
  }).finally(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

// ============================================
// AI RACE PREPARATION
// ============================================
export function startAiRacePrep() {
  const messagesEl = A.$('ai-messages');
  const races = A.getActiveRaces();
  const upcoming = races.filter(r => r.date && r.date >= new Date().toISOString().split('T')[0]).sort((a, b) => a.date.localeCompare(b.date));

  const aiMsg = document.createElement('div');
  aiMsg.className = 'ai-msg ai';

  if (upcoming.length === 0) {
    aiMsg.textContent = 'No upcoming races found in your calendar. Ask your coach to add race dates, or tell me a date and I\'ll build a taper plan for it.';
    messagesEl.appendChild(aiMsg);
    A.$('ai-input').dataset.racePrepMode = 'true';
    return;
  }

  let btns = upcoming.slice(0, 4).map(r => {
    const daysUntil = Math.ceil((new Date(r.date + 'T12:00:00') - Date.now()) / 86400000);
    return `<button class="ai-quick-btn ai-race-pick" data-race="${escHtml(r.name)}" data-days="${daysUntil}">${escHtml(r.name)} (${daysUntil}d)</button>`;
  }).join('');

  aiMsg.innerHTML = `Which race are you preparing for?<br><br><div class="ai-quick-btns" style="margin-top:8px">${btns}<button class="ai-quick-btn ai-race-pick" data-race="custom" data-days="0">📅 Other date</button></div>`;
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  messagesEl.querySelectorAll('.ai-race-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const raceName = btn.dataset.race;
      const days = parseInt(btn.dataset.days);
      if (raceName === 'custom') {
        const prompt = document.createElement('div');
        prompt.className = 'ai-msg ai';
        prompt.textContent = 'When is your race? Tell me the date or how many days away it is.';
        messagesEl.appendChild(prompt);
        A.$('ai-input').dataset.racePrepMode = 'true';
      } else {
        generateRacePrepPlan(raceName, days);
      }
    });
  });
}

export function generateRacePrepPlan(raceName, daysUntil) {
  const messagesEl = A.$('ai-messages');
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = `🏁 Prep plan for ${raceName} (${daysUntil} days away)`;
  messagesEl.appendChild(userMsg);

  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  fetch('/.netlify/functions/ai-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Create a race preparation and taper plan for ${raceName} which is ${daysUntil} days away.`,
      context: `RACE_PREP_MODE. Student: ${A.userProfile?.yearLevel || 'Y10'}, ${A.userProfile?.fitnessLevel || 'basic'} tier. Race: ${raceName}, ${daysUntil} days away. Total workouts logged: ${A.userWorkouts.length}. Give a day-by-day taper plan that: 1) Reduces volume progressively 2) Maintains some intensity 3) Includes rest days before race 4) Gives race-day nutrition and warm-up advice. Be specific with exercises and durations.`
    })
  }).then(r => r.json()).then(data => {
    typingMsg.innerHTML = data.reply || 'Sorry, couldn\'t generate a race prep plan.';
  }).catch(() => {
    typingMsg.textContent = 'Failed to generate plan. Try again.';
  }).finally(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

// ============================================
// AI INJURY MODIFICATION
// ============================================
export function startAiInjuryMod() {
  const messagesEl = A.$('ai-messages');
  const activePlan = A.userProfile?.activePlanId ? A.findPlan(A.userProfile.activePlanId) : null;

  const aiMsg = document.createElement('div');
  aiMsg.className = 'ai-msg ai';
  aiMsg.innerHTML = `I can help modify your training around an injury or soreness. What's bothering you?<br><br>
    <div class="ai-quick-btns" style="margin-top:8px">
      <button class="ai-quick-btn ai-injury-pick" data-injury="knee">🦵 Knee</button>
      <button class="ai-quick-btn ai-injury-pick" data-injury="back">🔙 Back</button>
      <button class="ai-quick-btn ai-injury-pick" data-injury="shoulder">💪 Shoulder/Arm</button>
      <button class="ai-quick-btn ai-injury-pick" data-injury="ankle">🦶 Ankle/Foot</button>
      <button class="ai-quick-btn ai-injury-pick" data-injury="custom">🩹 Something else</button>
    </div>
    <div style="font-size:11px;color:var(--muted-fg);margin-top:8px">⚠️ This is not medical advice. If you\'re in real pain, see your teacher, coach, or doctor first.</div>`;
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  messagesEl.querySelectorAll('.ai-injury-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const injury = btn.dataset.injury;
      if (injury === 'custom') {
        const prompt = document.createElement('div');
        prompt.className = 'ai-msg ai';
        prompt.textContent = 'Tell me what\'s sore or injured and I\'ll suggest how to modify your training.';
        messagesEl.appendChild(prompt);
        A.$('ai-input').dataset.injuryMode = 'true';
      } else {
        sendInjuryModification(injury, activePlan);
      }
    });
  });
}

export function sendInjuryModification(injuryArea, plan) {
  const messagesEl = A.$('ai-messages');
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = `🩹 My ${injuryArea} is sore — modify my training`;
  messagesEl.appendChild(userMsg);

  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai';
  typingMsg.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const planInfo = plan ? `Active plan: "${plan.name}" (${plan.category})` : 'No active plan';

  fetch('/.netlify/functions/ai-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `My ${injuryArea} is sore/injured. How should I modify my training?`,
      context: `INJURY_MODE. Student: ${A.userProfile?.yearLevel || 'Y10'}, ${A.userProfile?.fitnessLevel || 'basic'}. ${planInfo}. Injury area: ${injuryArea}. Give: 1) What to AVOID (specific exercises) 2) Safe alternatives that maintain fitness 3) Recovery suggestions 4) When to return to normal training. Always remind them to see a coach or doctor if pain is severe. Be specific and practical.`
    })
  }).then(r => r.json()).then(data => {
    typingMsg.innerHTML = data.reply || 'Sorry, couldn\'t generate modifications.';
  }).catch(() => {
    typingMsg.textContent = 'Failed to get AI response. Try again.';
  }).finally(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
}

// ============================================
// INLINE PLAN WORKOUT EDITING
// ============================================
export function openInlineWorkoutEdit(planId, weekIdx, workoutIdx, workout) {
  const content = `
    <div class="form-group" style="margin-bottom:10px">
      <label class="label">Workout Name</label>
      <input class="input" id="iwe-name" type="text" value="${escHtml(workout.name || '')}" style="width:100%">
    </div>
    <div class="form-group" style="margin-bottom:10px">
      <label class="label">Description</label>
      <textarea class="input" id="iwe-desc" rows="4" style="width:100%">${escHtml(workout.description || '')}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div class="form-group"><label class="label">Duration (min)</label><input class="input" id="iwe-dur" type="number" min="5" max="120" value="${workout.duration || 30}"></div>
      <div class="form-group"><label class="label">Intensity</label>
        <select class="input" id="iwe-intensity">
          <option value="easy"${workout.intensity === 'easy' ? ' selected' : ''}>Easy</option>
          <option value="moderate"${workout.intensity === 'moderate' ? ' selected' : ''}>Moderate</option>
          <option value="hard"${workout.intensity === 'hard' ? ' selected' : ''}>Hard</option>
        </select>
      </div>
    </div>`;

  A.showModal('Edit Workout', content, async (ov) => {
    const name = ov.querySelector('#iwe-name')?.value?.trim();
    const desc = ov.querySelector('#iwe-desc')?.value?.trim();
    const dur = parseInt(ov.querySelector('#iwe-dur')?.value) || workout.duration;
    const intensity = ov.querySelector('#iwe-intensity')?.value || workout.intensity;

    if (!name) { A.showToast('Name is required.', 'warn'); return; }

    // Check if this is a custom plan (editable directly) or built-in (needs override)
    const customIdx = A.customPlans.findIndex(p => p.id === planId);
    if (customIdx >= 0) {
      // Edit custom plan directly
      const wp = A.customPlans[customIdx].workouts[workoutIdx];
      if (wp) {
        wp.name = name;
        wp.description = desc;
        wp.duration = dur;
        wp.intensity = intensity;
        A.saveCustomPlansLocal();
        if (!A.demoMode && A.db && A.currentUser) {
          try { await A.setDoc(A.doc(A.db, 'users', A.currentUser.uid, 'customPlans', planId), A.customPlans[customIdx]); } catch(e) {}
        }
      }
    } else {
      // Built-in plan — save as exercise override
      const key = planId + '_' + weekIdx;
      A.exerciseOverrides[key] = { name, description: desc, duration: dur, intensity };
      if (!A.demoMode && A.db) {
        try { await A.setDoc(A.doc(A.db, 'config', 'exerciseOverrides'), { overrides: A.exerciseOverrides }); } catch(e) {}
      }
    }
    A.showToast('Workout updated!', 'success');
    if (A.currentPage === 'fitness') A.renderFitness();
    if (A.currentPage === 'today') A.renderToday();
  });
}
