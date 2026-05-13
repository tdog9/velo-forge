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

// Listeners installed flag — initTimer is called twice during boot
// (once with a stub ctx, once with the real ctx). Without a guard,
// each call stacked another listener on every button, so a single
// tap on "Tap to count" fired N times — the "random rep jumps" bug.
// Now we always refresh `A` but only bind listeners once.
let _timerBindingsInstalled = false;
export function initTimer(ctx) {
  A = ctx;
  if (_timerBindingsInstalled) return;
  _timerBindingsInstalled = true;
  // Use .onclick = ... (idempotent replace) instead of addEventListener
  // so even if a future caller side-steps the guard, the listener
  // stays a single handler per button. Belt-and-braces.
  const close = A.$('timer-close'); if (close) close.onclick = closeWorkoutTimer;
  const play = A.$('timer-play'); if (play) play.onclick = () => {
    A.haptic?.('light');
    if (timerRunning) pauseTimer();
    else startTimer();
  };
  const reset = A.$('timer-reset'); if (reset) reset.onclick = () => {
    A.haptic?.('light');
    resetTimer();
  };
  const skip = A.$('timer-skip'); if (skip) skip.onclick = () => {
    A.haptic?.('light');
    advanceFromCurrent();
  };
  document.querySelectorAll('.timer-rest-btn').forEach(btn => {
    btn.onclick = () => {
      A.haptic?.('light');
      const sec = parseInt(btn.dataset.rest);
      enterTimeMode(sec, 'Rest', 'Catch your breath, then keep going.');
      startTimer();
    };
  });
  // Reps counter buttons. Each tap = 1 rep. Hold-to-undo or tap
  // Undo. The tap target has touch-action:manipulation so iOS
  // doesn't fire both touchend + a synthesised click (which would
  // double-count even on a single physical tap).
  const tap = A.$('timer-reps-tap');
  if (tap) {
    tap.style.touchAction = 'manipulation';
    let lastTapAt = 0;
    tap.onclick = () => {
      if (timerMode !== 'reps') return;
      // Debounce ghost-clicks from iOS's touch→click synthesis (under 50ms).
      const now = Date.now();
      if (now - lastTapAt < 50) return;
      lastTapAt = now;
      timerRepsCount++;
      A.haptic?.('light');
      paintRepsCount();
      if (timerRepsTarget > 0 && timerRepsCount >= timerRepsTarget) {
        playBeep(880, 0.18, 2);
        A.haptic?.('medium');
        finishCurrentSet();
      }
    };
  }
  const undo = A.$('timer-reps-undo');
  if (undo) undo.onclick = () => {
    if (timerMode !== 'reps' || timerRepsCount <= 0) return;
    timerRepsCount--;
    paintRepsCount();
  };
  const done = A.$('timer-reps-done');
  if (done) done.onclick = () => {
    if (timerMode !== 'reps') return;
    A.haptic?.('medium');
    finishCurrentSet();
  };
}

// ── Voice coach (Web Speech API) ─────────────────────────────────────────
// Speaks short cues during the timer — exercise name on transition,
// 3-2-1 countdown at end of set, "set N done" on transition. Off by
// default; user toggles via tp_voice_coach in localStorage. Respects
// system audio volume; uses Apple's Premium voice when available.
let _voiceVoice = null;
function _voiceCoachEnabled() {
  try { return localStorage.getItem('tp_voice_coach') === '1'; } catch(_) { return false; }
}
function _pickVoice() {
  if (_voiceVoice) return _voiceVoice;
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  // Prefer enhanced English voices; fall back to first English voice.
  _voiceVoice = voices.find(v => /en[-_]/i.test(v.lang) && /Premium|Enhanced|Samantha|Daniel|Karen/i.test(v.name))
    || voices.find(v => /en[-_]/i.test(v.lang))
    || voices[0];
  return _voiceVoice;
}
function speakCue(text) {
  if (!text || !_voiceCoachEnabled()) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = _pickVoice();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.pitch = 1.0;
    u.volume = 0.95;
    window.speechSynthesis.speak(u);
  } catch(_) {}
}
// Pre-warm the voice list — first call to getVoices() is empty until
// the browser has loaded them. Voices are populated asynchronously.
if ('speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => { _voiceVoice = null; _pickVoice(); };
  } catch(_) {}
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
    if (timerMode === 'time') {
      speakCue('Set complete');
      setTimeout(() => finishCurrentSet(), 800);
    } else if (timerMode === 'break') {
      speakCue('Go');
      setTimeout(() => afterBreakAdvance(), 600);
    }
    return;
  }
  timerSeconds--;
  updateTimerDisplay();
  if (timerSeconds <= 3 && timerSeconds > 0) {
    playBeep(660, 0.1, 1);
    speakCue(String(timerSeconds));
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
  // Practical coach cue. Augments the exercise's own notes with a
  // generic "quality > quantity" reminder for hard sessions and an
  // RIR (reps in reserve) target so athletes don't grind to failure.
  // Y7/Y8 scaling lives on the session, not the exercise.
  const baseCue = ex.notes || ex.description || '';
  const intensity = String(ex.intensity || '').toLowerCase();
  let practicalCue = '';
  if (intensity === 'hard' || intensity === 'max') {
    practicalCue = ' · Aim 1–2 reps in reserve. Stop if form breaks.';
  } else if (intensity === 'moderate') {
    practicalCue = ' · Controlled tempo. 3 sec down, 1 sec up.';
  }
  const coach = baseCue + practicalCue;
  const cueParts = [];
  if (totalSets > 1) cueParts.push(`Set ${timerCurrentSet + 1} of ${totalSets},`);
  cueParts.push(ex.name);
  if (ex.reps) cueParts.push(`${formatReps(ex.reps)} reps`);
  speakCue(cueParts.join(' '));
  // Forward step + set progression to the Watch + Live Activity so
  // the rider sees the current exercise from the wrist / lock screen
  // / Dynamic Island. Best-effort — silently no-ops without bridge.
  try {
    if (typeof window !== 'undefined') {
      window._tpTrainingCurrentIdx = timerCurrentStep || 0;
      window._tpTrainingCurrentSet = timerCurrentSet || 0;
    }
    if (typeof A.pushWatchState === 'function') A.pushWatchState();
    if (window.webkit?.messageHandlers?.tpNative) {
      window.webkit.messageHandlers.tpNative.postMessage({
        type: 'live-activity-update',
        lapCount: timerCurrentStep + 1,
        pitCount: 0,
        lastLapMs: null,
        bestLapMs: null,
      });
    }
  } catch(_) {}
  if (ex.reps) {
    // Rep counts can be numbers ("12") OR ranges ("8-12") — in the
    // range case the timer tracks the upper bound but the displayed
    // label keeps the range so the athlete knows the practical target.
    const repsUpper = parseRepsUpper(ex.reps);
    const repsLabel = formatReps(ex.reps);
    enterRepsMode(repsUpper, ex.name + ' · ' + repsLabel + ' reps' + setLabel, coach);
    return;
  }
  const dur = parseExerciseDuration(ex);
  enterTimeMode(dur, ex.name + setLabel, coach);
  startTimer();
}

/// Parse a reps value into the upper bound for the rep counter. Accepts
/// numbers (12), numeric strings ("12"), or ranges ("8-12" / "8 to 12").
function parseRepsUpper(reps) {
  if (typeof reps === 'number') return reps | 0;
  const s = String(reps || '').trim();
  const rangeMatch = s.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (rangeMatch) return parseInt(rangeMatch[2], 10);
  const num = parseInt(s, 10);
  return isNaN(num) ? 0 : num;
}

/// Format a reps value for display. Numbers and clean strings pass
/// through unchanged; ranges normalise to "8–12" with an en-dash.
function formatReps(reps) {
  if (typeof reps === 'number') return String(reps);
  const s = String(reps || '').trim();
  return s.replace(/(\d+)\s*[-–]\s*(\d+)/, '$1–$2');
}

function finishWorkout() {
  setMode('idle');
  pauseTimer();
  A.$('timer-label').textContent = 'Workout complete';
  paintCoach('Nice. Tap Close when you\'re done.');
  playBeep(880, 0.25, 3);
  A.haptic?.('heavy');
  // Tear down the watch handoff + Live Activity so the lock screen
  // and Dynamic Island don't keep the workout pinned after the user
  // finished. Phone stays in the timer overlay until the user taps
  // Close — the LA disappears immediately.
  try {
    if (typeof A.endTrainingSession === 'function') A.endTrainingSession();
  } catch(_) {}
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
