// VeloForge Workout Timer Module
let A = {};
export function initTimer(ctx) { A = ctx; }

let timerInterval = null;
let timerSeconds = 0;
let timerTotal = 0;
let timerRunning = false;
let timerExercises = [];
let timerCurrentStep = -1;

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
  A.$('timer-minutes').textContent = String(mins).padStart(2, '0');
  A.$('timer-seconds').textContent = String(secs).padStart(2, '0');
  // Progress bar
  if (timerTotal > 0) {
    const pct = Math.max(0, ((timerTotal - timerSeconds) / timerTotal) * 100);
    A.$('timer-progress').style.width = pct + '%';
  }
  // Running state
  const overlay = A.$('timer-overlay');
  if (timerRunning) overlay.classList.add('timer-running');
  else overlay.classList.remove('timer-running');
}

function timerTick() {
  if (timerSeconds <= 0) {
    stopTimer();
    playBeep(880, 0.2, 3);
    A.haptic('medium');
    A.$('timer-label').textContent = 'Done!';
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
  A.$('timer-play-icon').style.display = 'none';
  A.$('timer-pause-icon').style.display = '';
  timerInterval = setInterval(timerTick, 1000);
  updateTimerDisplay();
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  A.$('timer-play-icon').style.display = '';
  A.$('timer-pause-icon').style.display = 'none';
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
  A.$('timer-progress').style.width = '0%';
  updateTimerDisplay();
}

function setTimerDuration(seconds, label) {
  pauseTimer();
  timerSeconds = seconds;
  timerTotal = seconds;
  A.$('timer-label').textContent = label || '';
  A.$('timer-progress').style.width = '0%';
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
  const stepsEl = A.$('timer-steps');
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

export function openWorkoutTimer(workoutName, durationMin, exercises) {
  const overlay = A.$('timer-overlay');
  overlay.style.display = 'flex';
  A.$('timer-workout-name').textContent = workoutName || 'Workout';

  timerExercises = exercises || [];
  timerCurrentStep = -1;

  if (timerExercises.length > 0) {
    // Machine workout with exercise steps — start first exercise
    A.$('timer-rest-presets').style.display = '';
    advanceTimerStep();
  } else {
    // Simple timer for the whole workout
    const totalSec = (durationMin || 30) * 60;
    setTimerDuration(totalSec, (durationMin || 30) + ' minute workout');
    A.$('timer-rest-presets').style.display = '';
    renderTimerSteps();
  }

  // Keep screen awake
  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen').catch(() => {});
  }
}

export function closeWorkoutTimer() {
  pauseTimer();
  A.$('timer-overlay').style.display = 'none';
  timerExercises = [];
  timerCurrentStep = -1;
}

// Bind timer controls
A.$('timer-close').addEventListener('click', closeWorkoutTimer);
A.$('timer-play').addEventListener('click', () => {
  A.haptic('light');
  if (timerRunning) pauseTimer();
  else startTimer();
});
A.$('timer-reset').addEventListener('click', () => {
  A.haptic('light');
  resetTimer();
});
A.$('timer-skip').addEventListener('click', () => {
  A.haptic('light');
  if (timerExercises.length > 0 && timerCurrentStep < timerExercises.length - 1) {
    advanceTimerStep();
  } else {
    stopTimer();
    A.$('timer-label').textContent = 'Complete!';
    playBeep(880, 0.2, 2);
  }
});

// Rest timer presets
document.querySelectorAll('.timer-rest-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    A.haptic('light');
    const sec = parseInt(btn.dataset.rest);
    setTimerDuration(sec, 'Rest');
    startTimer();
  });
});

// ============================================
// WORKOUTS PAGE
// ============================================
