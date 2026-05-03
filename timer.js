// TurboPrep Workout Timer Module
//
// Drives the in-app session player: progresses through a list of exercises,
// each with one or more sets; auto-starts a break between sets and between
// exercises; supports both reps mode (tap to count) and time mode (countdown).

import { escHtml } from './state.js';
let A = { $: (id) => document.getElementById(id) };

let timerInterval = null;
let timerSeconds = 0;
let timerTotal = 0;
let timerRunning = false;
let timerExercises = [];
let timerCurrentStep = -1;
let timerCurrentSet = 0;          // 0-based within the active exercise
let timerWakeLock = null;
let timerMode = 'idle';           // 'idle' | 'time' | 'reps' | 'break'
let timerRepsCount = 0;
let timerRepsTarget = 0;
let timerCoachText = '';

// Default break between sets / exercises if the plan doesn't specify one.
const DEFAULT_BREAK_SEC = 30;

export function initTimer(ctx) {
  A = ctx;
  A.$('timer-close')?.addEventListener('click', closeWorkoutTimer);
  A.$('timer-play')?.addEventListener('click', () => {
    A.haptic?.('light');
    if (timerRunning) pauseTimer();
    else startTimer();
  });
  A.$('timer-reset')?.addEventListener('click', () => {
    A.haptic?.('light');
    resetTimer();
  });
  A.$('timer-skip')?.addEventListener('click', () => {
    A.haptic?.('light');
    advanceFromCurrent();
  });
  document.querySelectorAll('.timer-rest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      A.haptic?.('light');
      const sec = parseInt(btn.dataset.rest);
      enterTimeMode(sec, 'Rest', 'Catch your breath, then keep going.');
      startTimer();
    });
  });
  // Reps counter buttons.
  A.$('timer-reps-tap')?.addEventListener('click', () => {
    if (timerMode !== 'reps') return;
    timerRepsCount++;
    A.haptic?.('light');
    paintRepsCount();
    if (timerRepsTarget > 0 && timerRepsCount >= timerRepsTarget) {
      // Auto-complete set when target hit.
      playBeep(880, 0.18, 2);
      A.haptic?.('medium');
      finishCurrentSet();
    }
  });
  A.$('timer-reps-undo')?.addEventListener('click', () => {
    if (timerMode !== 'reps' || timerRepsCount <= 0) return;
    timerRepsCount--;
    paintRepsCount();
  });
  A.$('timer-reps-done')?.addEventListener('click', () => {
    if (timerMode !== 'reps') return;
    A.haptic?.('medium');
    finishCurrentSet();
  });
}

// ── Audio + display helpers ──────────────────────────────────────────────

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
  const overlay = A.$('timer-overlay');
  if (!overlay) return;
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  const mEl = A.$('timer-minutes'); if (mEl) mEl.textContent = String(mins).padStart(2, '0');
  const sEl = A.$('timer-seconds'); if (sEl) sEl.textContent = String(secs).padStart(2, '0');
  if (timerTotal > 0) {
    const pct = Math.max(0, ((timerTotal - timerSeconds) / timerTotal) * 100);
    const pEl = A.$('timer-progress'); if (pEl) pEl.style.width = pct + '%';
  }
  overlay.classList.toggle('timer-running', timerRunning);
}

function paintRepsCount() {
  const el = A.$('timer-reps-count');
  if (el) el.textContent = String(timerRepsCount);
}

function paintCoach(text) {
  timerCoachText = text || '';
  const el = A.$('timer-coach');
  if (el) {
    el.textContent = timerCoachText;
    el.style.display = timerCoachText ? '' : 'none';
  }
}

function setMode(mode) {
  timerMode = mode;
  const display = A.$('timer-display');
  const reps = A.$('timer-reps');
  const breakEl = A.$('timer-break');
  const progress = A.$('timer-progress-wrap');
  const skipBtn = A.$('timer-skip');
  // Show/hide UI groups based on the active mode.
  const isReps = mode === 'reps';
  const isBreak = mode === 'break';
  if (display) display.style.display = isReps ? 'none' : '';
  if (reps) reps.style.display = isReps ? '' : 'none';
  if (breakEl) breakEl.style.display = isBreak ? '' : 'none';
  if (progress) progress.style.display = isReps ? 'none' : '';
  if (skipBtn) skipBtn.style.display = isReps ? 'none' : '';
}

// ── Core timer loop ──────────────────────────────────────────────────────

function timerTick() {
  if (timerSeconds <= 0) {
    stopTimer();
    playBeep(880, 0.2, 3);
    A.haptic?.('medium');
    A.$('timer-label').textContent = 'Done!';
    // Time mode: a set finished. Roll into the post-set flow (break +
    // next set / exercise). Break mode just advances directly.
    if (timerMode === 'time') {
      setTimeout(() => finishCurrentSet(), 800);
    } else if (timerMode === 'break') {
      setTimeout(() => afterBreakAdvance(), 600);
    }
    return;
  }
  timerSeconds--;
  updateTimerDisplay();
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
  const playIc = A.$('timer-play-icon'); if (playIc) playIc.style.display = '';
  const pauseIc = A.$('timer-pause-icon'); if (pauseIc) pauseIc.style.display = 'none';
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
  const p = A.$('timer-progress'); if (p) p.style.width = '0%';
  updateTimerDisplay();
}

function enterTimeMode(seconds, label, coach) {
  setMode('time');
  pauseTimer();
  timerSeconds = seconds;
  timerTotal = seconds;
  A.$('timer-label').textContent = label || '';
  const p = A.$('timer-progress'); if (p) p.style.width = '0%';
  paintCoach(coach || '');
  updateTimerDisplay();
}

function enterRepsMode(target, label, coach) {
  setMode('reps');
  pauseTimer();
  timerSeconds = 0;
  timerTotal = 0;
  timerRepsCount = 0;
  timerRepsTarget = target || 0;
  A.$('timer-label').textContent = label || '';
  const t = A.$('timer-reps-target'); if (t) t.textContent = String(target || 0);
  paintRepsCount();
  paintCoach(coach || '');
}

function enterBreakMode(seconds, nextLabel) {
  setMode('break');
  pauseTimer();
  timerSeconds = seconds;
  timerTotal = seconds;
  A.$('timer-label').textContent = 'Rest · ' + seconds + 's';
  const next = A.$('timer-break-next');
  if (next) next.textContent = 'Next: ' + (nextLabel || 'finish');
  const p = A.$('timer-progress'); if (p) p.style.width = '0%';
  paintCoach('Stay loose. Breathe. Don\'t cool down completely.');
  updateTimerDisplay();
  startTimer();
}

// ── Step / set progression ───────────────────────────────────────────────

// User-initiated "skip" — works in any mode. Time / break: jump to next.
// Reps: same as Done set.
function advanceFromCurrent() {
  if (timerMode === 'reps') return finishCurrentSet();
  if (timerMode === 'break') return afterBreakAdvance();
  // Time mode: stop current and advance.
  return finishCurrentSet();
}

// A single set has just finished (either timer hit 0, reps target met, or
// user tapped Done/Skip). If more sets remain in this exercise, start the
// configured break then come back. Otherwise advance to the next exercise.
function finishCurrentSet() {
  const ex = timerExercises[timerCurrentStep];
  if (!ex) {
    return finishWorkout();
  }
  const totalSets = Math.max(1, ex.sets || 1);
  const isLastSet = timerCurrentSet >= totalSets - 1;
  if (!isLastSet) {
    timerCurrentSet++;
    const breakSec = parseExerciseBreakSec(ex);
    enterBreakMode(breakSec, ex.name + ' · set ' + (timerCurrentSet + 1) + '/' + totalSets);
    renderTimerSteps();
    return;
  }
  // Last set of this exercise — break before the next exercise (if any).
  // CRITICAL: bump timerCurrentSet past totalSets so afterBreakAdvance's
  // `timerCurrentSet >= totalSets` check fires and rolls onto the next
  // exercise. Without this, the break-then-advance path looped back into
  // the same exercise forever.
  timerCurrentSet++;
  const next = timerExercises[timerCurrentStep + 1];
  if (next) {
    const breakSec = parseExerciseBreakSec(ex);
    enterBreakMode(breakSec, next.name);
    return;
  }
  finishWorkout();
}

// Break ended — start the appropriate next set or exercise.
function afterBreakAdvance() {
  const ex = timerExercises[timerCurrentStep];
  if (!ex) return finishWorkout();
  const totalSets = Math.max(1, ex.sets || 1);
  if (timerCurrentSet >= totalSets) {
    // Move to the next exercise.
    timerCurrentStep++;
    timerCurrentSet = 0;
    const nx = timerExercises[timerCurrentStep];
    if (!nx) return finishWorkout();
    return startSet(nx);
  }
  return startSet(ex);
}

function startSet(ex) {
  if (!ex) return;
  renderTimerSteps();
  const totalSets = Math.max(1, ex.sets || 1);
  const setLabel = totalSets > 1
    ? (' · set ' + (timerCurrentSet + 1) + '/' + totalSets)
    : '';
  const coach = ex.notes || ex.description || '';
  if (ex.reps) {
    enterRepsMode(parseInt(ex.reps) || 0, ex.name + setLabel, coach);
    return;
  }
  const dur = parseExerciseDuration(ex);
  enterTimeMode(dur, ex.name + setLabel, coach);
  startTimer();
}

function finishWorkout() {
  setMode('idle');
  pauseTimer();
  A.$('timer-label').textContent = 'Workout complete';
  paintCoach('Nice. Tap Close when you\'re done.');
  playBeep(880, 0.25, 3);
  A.haptic?.('heavy');
}

function parseExerciseDuration(ex) {
  if (ex.duration) {
    const minMatch = ex.duration.match(/(\d+)\s*min/);
    if (minMatch) return parseInt(minMatch[1]) * 60;
    const secMatch = ex.duration.match(/(\d+)\s*sec/);
    if (secMatch) return parseInt(secMatch[1]);
  }
  return 60;
}

function parseExerciseBreakSec(ex) {
  // Honor an explicit `restSec` / `breakSec` field on the exercise; fall
  // back to a reasonable default. Keeps the door open for plan authors to
  // specify per-exercise rest without rewriting every existing entry.
  if (typeof ex?.breakSec === 'number') return Math.max(5, ex.breakSec);
  if (typeof ex?.restSec === 'number') return Math.max(5, ex.restSec);
  // High-intensity / shorter sets get a longer rest by default; bodyweight
  // plyo / fast efforts get less.
  if (ex?.intensity === 'hard' || ex?.intensity === 'max') return 90;
  return DEFAULT_BREAK_SEC;
}

function renderTimerSteps() {
  const stepsEl = A.$('timer-steps');
  if (!stepsEl) return;
  if (timerExercises.length === 0) { stepsEl.innerHTML = ''; return; }
  let html = '';
  timerExercises.forEach((ex, i) => {
    const state = i < timerCurrentStep ? 'done' : i === timerCurrentStep ? 'active' : '';
    const setsTotal = Math.max(1, ex.sets || 1);
    const setBadge = (i === timerCurrentStep && setsTotal > 1)
      ? ` <span class="timer-step-set">set ${timerCurrentSet + 1}/${setsTotal}</span>`
      : '';
    const meta = [
      ex.duration,
      setsTotal > 1 ? setsTotal + ' sets' : '',
      ex.reps ? ex.reps + ' reps' : '',
    ].filter(Boolean).join(' · ');
    html += `<div class="timer-step ${state}">
      <div class="timer-step-num">${i + 1}</div>
      <div class="timer-step-info">
        <div class="timer-step-name">${escHtml(ex.name)}${setBadge}</div>
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

  // Drop any malformed entries that would crash startSet / renderTimerSteps.
  timerExercises = Array.isArray(exercises)
    ? exercises.filter(e => e && typeof e === 'object' && (e.name || e.duration || e.reps))
    : [];
  timerCurrentStep = 0;
  timerCurrentSet = 0;

  if (timerExercises.length > 0) {
    A.$('timer-rest-presets').style.display = '';
    startSet(timerExercises[0]);
  } else {
    const totalSec = (durationMin || 30) * 60;
    enterTimeMode(totalSec, (durationMin || 30) + ' minute workout', 'Steady effort. Hit the duration and you\'re done.');
    A.$('timer-rest-presets').style.display = '';
    renderTimerSteps();
  }

  if (navigator.wakeLock) {
    navigator.wakeLock.request('screen')
      .then(s => { timerWakeLock = s; })
      .catch(() => {});
  }
}

export function closeWorkoutTimer() {
  pauseTimer();
  const ov = A.$('timer-overlay');
  if (ov) ov.style.display = 'none';
  timerExercises = [];
  timerCurrentStep = -1;
  timerCurrentSet = 0;
  timerMode = 'idle';
  timerRepsCount = 0;
  try { timerWakeLock?.release?.(); } catch(e) {}
  timerWakeLock = null;
}
