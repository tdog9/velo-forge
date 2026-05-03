// TurboPrep training plans — generator-style.
//
// Each session is defined ONCE in a session library (BIKE / FLOOR /
// MACHINE), then composed into per-plan weekly schedules. This keeps
// the file maintainable: edit a session here and every plan that uses
// it gets the update for free.
//
// Categories:
//   - 'bike'    — on the HPR vehicle (or a stationary trainer); was
//                 'invehicle' before this rewrite. Stint-paced HPR work.
//   - 'floor'   — bodyweight at home. Most riders train here outside of
//                 the vehicle, so this library is the most thorough.
//   - 'machine' — gym session on machines (leg press, rower, spin bike,
//                 elliptical). Race-day strength + cardio.
//
// Schema reminder: every workout carries a structured `exercises[]` so
// the in-app session player can step the athlete through every effort
// and rest. Per-exercise `breakSec` overrides the default break; if
// omitted the player picks 30s for easy/moderate, 90s for hard/max.

const VID_DEFAULT = 'https://www.youtube.com/watch?v=2-LAMcpzODU';

// ─────────────────────────────────────────────────────────────────────────
// BIKE SESSIONS — on the HPR (or a stationary trainer with a fan).
// HPR racing is closed-circuit relay, 20-40 min stints, hot enclosed
// cabin, driver changeovers. Sessions reference vents/cabin/pit-lap.
// ─────────────────────────────────────────────────────────────────────────

const BIKE_SESSIONS = {
  recovery_short: {
    name: 'Recovery Spin',
    duration: 20, intensity: 'easy',
    description: 'Active recovery between race-stints — truly easy. 5/10 effort, high cadence, low force. The point is to flush yesterday and prep tomorrow. Go harder here and you cost yourself the back half of the week.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Easy spin', duration: '20 min', notes: 'Conversational. 90+ rpm, light pressure. Breath nasal if you can. Vents partial.' }
    ]
  },
  recovery_25: {
    name: 'Driver Recovery Spin',
    duration: 25, intensity: 'easy',
    description: 'The kind of spin you do between race-day stints while you wait for your turn back in the vehicle. High cadence, low force.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Easy spin', duration: '25 min', notes: 'Conversational. 90+ rpm, light pressure. Same recovery breathing as a real pit-side rotation.' }
    ]
  },

  endurance_short: {
    name: 'Endurance Cruise · Z2',
    duration: 35, intensity: 'easy',
    description: 'Race-day cruise pace — the speed you would hold across a 6-hour relay. Conversational, sustainable, NOT impressive. Restraint today pays off in your quality session later in the week.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '5 min', notes: 'Spin into rhythm. 85+ rpm — recumbent gearing rewards high cadence.' },
      { name: 'Z2 cruise', duration: '25 min', notes: 'Talk-test pace. If you can\'t say a full sentence, you\'re going too hard.' },
      { name: 'Cool-down', duration: '5 min', notes: 'Spin out. After: stretch hip flexors and hamstrings.' }
    ]
  },
  endurance_long: {
    name: 'Long Cruise + Pit-Out Strides',
    duration: 60, intensity: 'easy',
    description: 'Longest aerobic session of the week. 35 min steady at race-day pace, then 4×30s pit-out strides simulating the high-cadence acceleration leaving the pit lane after a driver change. Builds the aerobic ceiling without taxing tomorrow.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '8 min', notes: 'Easy spin into rhythm.' },
      { name: 'Z2 cruise block', duration: '35 min', notes: 'Race-day pace. Sip water every 10 min — hydration practice for long events.' },
      { name: 'Pit-out stride', duration: '30 sec', sets: 4, breakSec: 90, intensity: 'moderate', notes: '100+ rpm, smooth. NOT a sprint — quick to race speed then settle.' },
      { name: 'Z2 cruise back', duration: '10 min', notes: 'Settle back into race pace. Don\'t drift up.' },
      { name: 'Cool-down', duration: '5 min', notes: 'Spin out, vents fully open.' }
    ]
  },

  cadence_drills: {
    name: 'Cadence Drills',
    duration: 30, intensity: 'easy',
    description: 'Smooth round pedal circles. The single biggest hidden cost in HPR racing is sloppy form across long stints — you waste watts and you tire faster. Today is technique only. No effort heroics.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '8 min', notes: 'Easy spin. Vents open.' },
      { name: 'High-cadence drill', duration: '1 min', sets: 6, breakSec: 60, intensity: 'easy', notes: '105+ rpm. Smooth circles, NOT bouncing in the seat. Focus on pulling the foot up the back of the stroke.' },
      { name: 'Single-leg drill (left)', duration: '30 sec', sets: 4, breakSec: 30, intensity: 'easy', notes: 'Unclip right (or rest right pedal) and spin smoothly with left only. You\'ll find the dead spots fast.' },
      { name: 'Single-leg drill (right)', duration: '30 sec', sets: 4, breakSec: 30, intensity: 'easy', notes: 'Now right only. Eliminate the dead spots.' },
      { name: 'Cool-down spin', duration: '5 min', notes: 'Easy. Apply the smooth circles you just practised.' }
    ]
  },

  tempo_block: {
    name: 'Tempo Block',
    duration: 40, intensity: 'moderate',
    description: 'A solid 20-min tempo block at ~75% of stint pace — moderate-hard, breath rhythmic, sustainable for an hour if you had to. Builds the durable middle gear that wins long relays.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '8 min', notes: 'Easy → moderate.' },
      { name: 'Tempo · 20 min', duration: '20 min', intensity: 'moderate', notes: 'Solid moderate, breath deeper but rhythmic. Cadence steady. ~75% stint pace.' },
      { name: 'Cool-down', duration: '12 min', notes: 'Spin out, vents full.' }
    ]
  },

  sweet_spot_4x9: {
    name: 'Long Stint Sim · 4×9',
    duration: 50, intensity: 'hard',
    description: 'Race-stint simulation. Four 9-minute efforts at 85-90% of stint pace — uncomfortably comfortable. The challenge is holding consistent effort + cadence + form across all four. THIS is what wins HPR races: lap-time consistency, not peak power.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '10 min', notes: 'Easy → moderate. Last 3 min: build to stint-sim intensity.' },
      { name: 'Stint block', duration: '9 min', sets: 4, breakSec: 180, intensity: 'hard', notes: 'Steady, controlled. 85-90% of true stint pace. Cadence consistent. Same effort on rep 4 as rep 1 — that\'s the test.' },
      { name: 'Cool-down', duration: '8 min', notes: 'Easy spin out, full ventilation.' }
    ]
  },

  threshold_pyramid: {
    name: 'Stint Pyramid · 4·5·6·5·4',
    duration: 45, intensity: 'hard',
    description: 'Stint-pace pyramid. Each rung is the effort you should be able to hold for a full 25-min race stint. Pyramid format teaches you to read effort honestly — you should NOT be more cooked at the end of the 6 min rung than the 4 min rung. The descending side is where the adaptation happens.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Cabin check + warm-up', duration: '10 min', notes: 'Vents open, water in reach. Easy spin building to a sweat. 3×30s 90+ rpm in last 3 min.' },
      { name: 'Stint pace · 4 min', duration: '4 min', intensity: 'hard', notes: 'One word at a time, not a sentence. Shoulders down, low back relaxed against the seat.' },
      { name: 'Pit-lap recovery', duration: '3 min', notes: 'Drop force. Vents open. Breath fully back under control.' },
      { name: 'Stint pace · 5 min', duration: '5 min', intensity: 'hard', notes: 'Same effort, longer. Smooth round circles — pull through the top, don\'t just stomp down.' },
      { name: 'Pit-lap recovery', duration: '3 min', notes: 'Sip water. Cool the cabin.' },
      { name: 'Stint pace · 6 min', duration: '6 min', intensity: 'hard', notes: 'Top of the pyramid. THIS is where racers fade — hold form when it hurts.' },
      { name: 'Pit-lap recovery', duration: '3 min', notes: 'Big recovery — descending side is the workout.' },
      { name: 'Stint pace · 5 min', duration: '5 min', intensity: 'hard', notes: 'Match the climb. No fading.' },
      { name: 'Pit-lap recovery', duration: '3 min', notes: 'One more rung.' },
      { name: 'Stint pace · 4 min', duration: '4 min', intensity: 'hard', notes: 'Same effort as rung 1, but more tired. THAT\'S the point.' },
      { name: 'Cool-down', duration: '8 min', notes: 'Easy spin out. Get core temp down before stopping.' }
    ]
  },

  vo2_surges: {
    name: 'Surge Drills · 6×2',
    duration: 35, intensity: 'hard',
    description: 'Mid-stint surges — the hard accelerations you do when overtaking another vehicle or chasing back to a wheel. Six 2-min efforts at 9/10. The LAST 60s of each is where you earn the fitness. Commit fully.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '10 min', notes: 'Easy → moderate. Last 4 min: 2×30s build to surge intensity.' },
      { name: 'Surge', duration: '2 min', sets: 6, breakSec: 180, intensity: 'hard', notes: '9/10. Open the gear, smooth aggressive cadence. Last 60s is the workout. Vents full between reps.' },
      { name: 'Cool-down', duration: '12 min', notes: 'Easy spin. Sip water steadily.' }
    ]
  },

  race_pace_3x8: {
    name: 'Race Stint Practice · 3×8',
    duration: 45, intensity: 'hard',
    description: 'Specificity day — three 8-min blocks at TRUE race-stint pace. Not threshold (you\'d blow up), not VO2 (you\'d never hold it). The fastest sustainable repeatable pace — what wins races.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '10 min', notes: 'Easy build with 2×1min pickups in last 4 min.' },
      { name: 'Race stint', duration: '8 min', sets: 3, breakSec: 240, intensity: 'hard', notes: 'True race pace. Smooth circles, eyes far up the track, cadence steady. Imagine you\'re 10 min into a 25-min stint.' },
      { name: 'Cool-down', duration: '11 min', notes: 'Spin out fully. Vent. Sip water.' }
    ]
  },

  race_simulation: {
    name: 'Race Day Sim · Final Stint',
    duration: 50, intensity: 'hard',
    description: 'Capstone session. Progressive ride simulating the final hour of a long relay — Z2 cruise, tempo as the race tightens, hard as the lead pack pushes, max-effort finish straight. Practice the race in advance.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '5 min', notes: 'Spin into rhythm.' },
      { name: 'Z2 cruise', duration: '15 min', notes: 'Race-day pace. Holding the pack, no surging.' },
      { name: 'Tempo · pack tightens', duration: '15 min', intensity: 'moderate', notes: 'Solid moderate. ~75% stint pace.' },
      { name: 'Hard · lead group push', duration: '10 min', intensity: 'hard', notes: 'Stint pace. Holding the front bunch.' },
      { name: 'Finish straight', duration: '5 min', intensity: 'max', notes: 'Everything. Empty the legs. Chequered flag in sight.' }
    ]
  },

  starts_drill: {
    name: 'Pit-Out Starts',
    duration: 30, intensity: 'hard',
    description: 'Standing-start practice. The 5 seconds after a driver change determines whether you exit cleanly or get bogged down. 8 short max-effort accelerations from low cadence.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '10 min', notes: 'Easy → moderate. Last 3 min: 2×15s acceleration drills at moderate effort.' },
      { name: 'Standing start · 15s', duration: '15 sec', sets: 8, breakSec: 90, intensity: 'max', notes: 'From low cadence (60 rpm or simulated standstill) accelerate hard for 15s. Smooth, not jerky. Plant the legs and wind it up.' },
      { name: 'Cool-down', duration: '12 min', notes: 'Spin easy.' }
    ]
  },

  taper_short: {
    name: 'Pre-Race Sharpener',
    duration: 25, intensity: 'moderate',
    description: 'Race week. Short, sharp, NOT taxing. Wakes the legs without using them up. Run this 1-2 days before the event.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '8 min', notes: 'Easy spin.' },
      { name: 'Race-pace pickup', duration: '60 sec', sets: 3, breakSec: 120, intensity: 'hard', notes: 'Race pace, not max. Just enough to remind the legs.' },
      { name: 'Easy spin out', duration: '12 min', notes: 'Truly easy. Save the legs.' }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────
// FLOOR SESSIONS — bodyweight at home / school / anywhere with floor space.
// HPR-relevant focus: glutes, quads, core, hip mobility, posterior chain.
// Most riders do most of their training here — these are the meat of the
// program when the vehicle isn't available.
// ─────────────────────────────────────────────────────────────────────────

const FLOOR_SESSIONS = {
  mobility_short: {
    name: 'Mobility & Flow',
    duration: 20, intensity: 'easy',
    description: 'Active recovery + mobility flow. Hip flexors and hamstrings tighten in the recumbent position — staying loose costs you nothing and keeps you riding strong.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Cat-cow', reps: 10, sets: 2, breakSec: 15, intensity: 'easy', notes: 'Slow, breath with the movement. Roll the spine.' },
      { name: 'Hip flexor lunge stretch', duration: '45 sec', sets: 2, breakSec: 15, intensity: 'easy', notes: 'Drop the back knee. Tuck the pelvis. Feel the stretch up the front of the hip.' },
      { name: 'Hamstring reach', duration: '45 sec', sets: 2, breakSec: 15, intensity: 'easy', notes: 'Sit, one leg straight. Hinge from hips, reach for the toes. Don\'t round the back.' },
      { name: '90/90 hip switch', reps: 10, sets: 2, breakSec: 15, intensity: 'easy', notes: 'Sit cross-legged style, switch sides. Both knees track to 90°.' },
      { name: 'World\'s greatest stretch', reps: 6, sets: 2, breakSec: 20, intensity: 'easy', notes: 'Lunge → elbow to floor → twist toward sky. Both sides each rep.' },
      { name: 'Child\'s pose', duration: '60 sec', notes: 'Breathe deep. Release the lower back.' }
    ]
  },

  core_basic: {
    name: 'Core Basics',
    duration: 25, intensity: 'moderate',
    description: 'Brace work — the core position you need to hold for an entire stint without leaking power. Focus on quality of brace, not rep count.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Glute bridge', reps: 12, sets: 3, breakSec: 30, intensity: 'moderate', notes: 'Drive through heels. Squeeze glutes at the top — don\'t let the lower back arch.' },
      { name: 'Plank hold', duration: '40 sec', sets: 3, breakSec: 45, intensity: 'moderate', notes: 'Straight line ear → ankle. Hips don\'t sag. Ribs tucked.' },
      { name: 'Dead bug', reps: 8, sets: 3, breakSec: 30, intensity: 'moderate', notes: '8 each side. Lower back stays flat against the floor — this is the rule.' },
      { name: 'Side plank', duration: '25 sec', sets: 2, breakSec: 30, intensity: 'moderate', notes: '2 per side. Stack the shoulder over the elbow. Hips lifted.' }
    ]
  },

  core_advanced: {
    name: 'Core Hard',
    duration: 30, intensity: 'hard',
    description: 'Race-strength core. The brace needed for a 25-min stint at race pace where every watt counts. Push to true muscular fatigue.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Hollow body hold', duration: '30 sec', sets: 4, breakSec: 30, intensity: 'hard', notes: 'Lower back glued to the floor. Arms + legs hover. The hardest core exercise on this list — feel it everywhere.' },
      { name: 'Plank with shoulder taps', reps: 20, sets: 3, breakSec: 45, intensity: 'hard', notes: '20 total. Don\'t let the hips rotate when you tap.' },
      { name: 'V-up', reps: 12, sets: 3, breakSec: 30, intensity: 'hard', notes: 'Reach toes. Slow control. No swinging.' },
      { name: 'Side plank reach-through', reps: 10, sets: 2, breakSec: 30, intensity: 'hard', notes: '10 per side. Thread arm under, then up.' },
      { name: 'Plank hold finisher', duration: '60 sec', sets: 1, intensity: 'hard', notes: 'Last one. Hold on form, not pride.' }
    ]
  },

  legs_strength: {
    name: 'Leg Strength Circuit',
    duration: 35, intensity: 'hard',
    description: 'The watts you produce in the vehicle come from glutes, quads, hamstrings. Three rounds of compound bodyweight strength. Focus on quality reps.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Bodyweight squat', reps: 15, sets: 3, breakSec: 60, intensity: 'moderate', notes: 'Feet shoulder width. Sit back, knees track over toes. Drive through heels.' },
      { name: 'Reverse lunge', reps: 10, sets: 3, breakSec: 60, intensity: 'moderate', notes: '10 each leg. Step back, drop knee, drive through front heel. Slow control.' },
      { name: 'Glute bridge · single leg', reps: 10, sets: 3, breakSec: 45, intensity: 'hard', notes: '10 per leg. Drive through heel of working leg. Squeeze hard at the top.' },
      { name: 'Wall sit', duration: '45 sec', sets: 3, breakSec: 60, intensity: 'hard', notes: 'Thighs parallel. Back flat against wall. Just survive.' },
      { name: 'Calf raise', reps: 20, sets: 2, breakSec: 30, intensity: 'moderate', notes: 'Slow up, slow down. Pause at the top.' }
    ]
  },

  legs_endurance: {
    name: 'Leg Endurance Circuit',
    duration: 35, intensity: 'moderate',
    description: 'Higher rep, lower load. Builds the muscular endurance you need to maintain power through a full stint — not just the first 5 minutes.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Bodyweight squat', reps: 25, sets: 3, breakSec: 45, intensity: 'moderate', notes: 'Pace yourself — these add up. Keep form on rep 25 same as rep 1.' },
      { name: 'Walking lunge', reps: 20, sets: 3, breakSec: 60, intensity: 'moderate', notes: '20 total steps. Long stride, drop the back knee toward the floor.' },
      { name: 'Step-up', reps: 12, sets: 3, breakSec: 45, intensity: 'moderate', notes: '12 per leg. Use a chair, low bench, or stairs. Drive through the heel of the up leg.' },
      { name: 'Glute bridge · march', reps: 16, sets: 3, breakSec: 45, intensity: 'moderate', notes: '16 total. Hold bridge, alternate lifting one foot. Hips stay level.' }
    ]
  },

  plyo: {
    name: 'Plyometric Power',
    duration: 30, intensity: 'hard',
    description: 'Explosive jumps train the fast-twitch power you need for pit-out accelerations and overtaking surges. Quality > quantity. Land softly.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up · arm circles + leg swings', duration: '5 min', notes: 'Get the joints warm. 10 forward + 10 back arm circles. 10 leg swings each side.' },
      { name: 'Squat jump', reps: 8, sets: 4, breakSec: 60, intensity: 'hard', notes: 'Maximum effort each rep. Land soft, sink into next squat. Quality over speed — rest if form drops.' },
      { name: 'Lunge jump · alternating', reps: 10, sets: 3, breakSec: 60, intensity: 'hard', notes: '10 total. Switch legs in the air. Drop the back knee on the landing.' },
      { name: 'Broad jump', reps: 6, sets: 3, breakSec: 60, intensity: 'hard', notes: 'Maximum distance. Land balanced, walk back, repeat. Big arm swing.' },
      { name: 'Cool-down stretch', duration: '5 min', notes: 'Quads, hamstrings, calves. Ease the legs out.' }
    ]
  },

  glute_focus: {
    name: 'Glute Focus',
    duration: 30, intensity: 'moderate',
    description: 'Glutes are the prime mover in the recumbent pedalling position. Most riders are quad-dominant — today fixes that. Activation, then strength, then endurance.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Glute activation · clamshell', reps: 15, sets: 3, breakSec: 30, intensity: 'easy', notes: '15 per side. Slow, feel the burn in the side glute.' },
      { name: 'Banded lateral walk', reps: 10, sets: 3, breakSec: 30, intensity: 'moderate', notes: '10 each direction. Use a band if you have one — towel works as a substitute. Stay low.' },
      { name: 'Single-leg glute bridge', reps: 10, sets: 3, breakSec: 45, intensity: 'hard', notes: '10 per side. Drive HARD through the working heel. Squeeze the glute at the top.' },
      { name: 'Bulgarian split squat', reps: 8, sets: 3, breakSec: 60, intensity: 'hard', notes: '8 per leg. Back foot on a chair / low surface. Drop the back knee.' },
      { name: 'Donkey kick', reps: 12, sets: 2, breakSec: 30, intensity: 'moderate', notes: '12 per side. Tabletop position, drive heel toward ceiling. Squeeze at the top.' }
    ]
  },

  full_body: {
    name: 'Full Body Circuit',
    duration: 30, intensity: 'moderate',
    description: 'A balanced session covering legs, core, posterior chain in one go. Three rounds, AMRAP feel — push but keep form clean.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Bodyweight squat', reps: 12, sets: 3, breakSec: 30, intensity: 'moderate', notes: 'Quality reps. Sit back into the heels.' },
      { name: 'Push-up', reps: 10, sets: 3, breakSec: 30, intensity: 'moderate', notes: 'Knees if needed. Body straight line. Chest to floor.' },
      { name: 'Plank', duration: '30 sec', sets: 3, breakSec: 30, intensity: 'moderate', notes: 'Tight brace.' },
      { name: 'Reverse lunge', reps: 8, sets: 3, breakSec: 30, intensity: 'moderate', notes: '8 each leg. Drive through front heel.' },
      { name: 'Superman hold', duration: '20 sec', sets: 3, breakSec: 30, intensity: 'moderate', notes: 'Lift arms + legs. Squeeze the lower back.' },
      { name: 'Mountain climber', duration: '30 sec', sets: 2, breakSec: 30, intensity: 'moderate', notes: 'Steady tempo, not panicked.' }
    ]
  },

  hill_simulation: {
    name: 'Hill Simulation',
    duration: 30, intensity: 'hard',
    description: 'Step-ups + lunges replicate the prolonged force production of a hard climb or sustained surge. Tough on the legs in a way bike work doesn\'t reach.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Step-up · single leg', reps: 15, sets: 4, breakSec: 60, intensity: 'hard', notes: '15 per leg. Don\'t bounce off the bottom — drive through the heel of the up leg.' },
      { name: 'Reverse lunge · slow', reps: 10, sets: 3, breakSec: 60, intensity: 'hard', notes: '10 per leg, 3 seconds down. Eccentric loading.' },
      { name: 'Wall sit hold', duration: '60 sec', sets: 3, breakSec: 60, intensity: 'hard', notes: 'Thighs parallel. Hold like you mean it.' }
    ]
  },

  intervals_floor: {
    name: 'Interval Conditioning',
    duration: 25, intensity: 'hard',
    description: 'Tabata-style cardio when you can\'t get on the bike. 8 rounds of 20s on / 10s off — the same VO2 stimulus you get from on-bike surges.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '5 min', notes: 'Light jog on the spot, arm circles, body twists.' },
      { name: 'Tabata · burpee', duration: '20 sec', sets: 4, breakSec: 10, intensity: 'hard', notes: '20s max effort, 10s rest. Repeat 4 times before moving on.' },
      { name: 'Tabata · jump squat', duration: '20 sec', sets: 4, breakSec: 10, intensity: 'hard', notes: 'Same protocol — 20s max, 10s rest, 4 rounds.' },
      { name: 'Cool-down stretch', duration: '5 min', notes: 'Hamstrings, hip flexors, calves.' }
    ]
  },

  technique_focus: {
    name: 'Technique & Posture',
    duration: 25, intensity: 'easy',
    description: 'Posture work for the recumbent position. Strong neutral spine, relaxed shoulders, engaged glutes — the position you hold for an entire stint.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Wall angel', reps: 10, sets: 3, breakSec: 30, intensity: 'easy', notes: 'Back flat against wall, slide arms up + down keeping contact. Feels harder than it looks.' },
      { name: 'Bird-dog', reps: 8, sets: 3, breakSec: 30, intensity: 'easy', notes: '8 per side. Slow. Maintain a neutral spine — no hip rocking.' },
      { name: 'Glute bridge with hold', duration: '20 sec', sets: 3, breakSec: 30, intensity: 'moderate', notes: 'Hold at the top of the bridge. Squeeze glutes, ribs tucked.' },
      { name: 'Foam roll / self massage', duration: '5 min', notes: 'Quads, glutes, upper back. If you have a foam roller, use it. If not, lacrosse ball or tennis ball.' }
    ]
  },

  recovery_floor: {
    name: 'Recovery & Stretch',
    duration: 20, intensity: 'easy',
    description: 'Pure stretching. The day after a hard quality session, this is what gets you ready for the next one.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Hip flexor lunge', duration: '60 sec', sets: 2, breakSec: 15, intensity: 'easy', notes: '60s per side. Tuck pelvis to maximise the stretch.' },
      { name: 'Pigeon pose', duration: '60 sec', sets: 2, breakSec: 15, intensity: 'easy', notes: '60s per side. Sink into the front hip.' },
      { name: 'Seated forward fold', duration: '60 sec', notes: 'Hamstrings. Hinge from hips. Don\'t round.' },
      { name: 'Thread the needle', duration: '45 sec', sets: 2, breakSec: 15, intensity: 'easy', notes: 'Per side. Releases the upper back + thoracic spine.' },
      { name: 'Child\'s pose', duration: '90 sec', notes: 'Final breath-down. Slow nasal breathing.' }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────
// MACHINE SESSIONS — gym-based work using leg press, rowing erg, spin
// bike, elliptical, etc. Race-day strength + cardio when you have access
// to a fitness room.
// ─────────────────────────────────────────────────────────────────────────

const MACHINE_SESSIONS = {
  recovery_machine: {
    name: 'Easy Spin · Bike or Elliptical',
    duration: 25, intensity: 'easy',
    description: 'Light cardio recovery on the spin bike or elliptical. Pure aerobic flush — keeps the legs supple between hard sessions.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Spin bike OR elliptical', duration: '25 min', notes: 'Light resistance, conversational. 80+ rpm on bike, similar cadence on elliptical.' }
    ]
  },

  endurance_rower: {
    name: 'Endurance · Rower',
    duration: 35, intensity: 'easy',
    description: 'Steady aerobic work on the rowing erg. Full-body, low-impact, builds engine without taxing the legs the way the bike does.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '5 min', notes: 'Slow rate (~22 spm). Find a smooth rhythm.' },
      { name: 'Z2 row', duration: '25 min', notes: 'Talk-test pace. ~24 spm. Catch → drive → finish → recovery.' },
      { name: 'Cool-down', duration: '5 min', notes: 'Slow rate, light pressure.' }
    ]
  },

  endurance_bike: {
    name: 'Endurance · Spin Bike',
    duration: 40, intensity: 'easy',
    description: 'Z2 spin on the gym bike. Aerobic engine work in a controlled environment — no GPS, no traffic, just steady effort.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '5 min', notes: 'Easy spin, light resistance.' },
      { name: 'Z2 endurance', duration: '30 min', notes: 'Talk-test. 85+ rpm. Resistance set so heart rate sits in low aerobic.' },
      { name: 'Cool-down', duration: '5 min', notes: 'Drop resistance, spin out.' }
    ]
  },

  leg_press: {
    name: 'Leg Press Strength',
    duration: 35, intensity: 'hard',
    description: 'The single best machine for HPR-relevant leg power. Heavy compound work — squat-pattern under load. Build the watts you produce in the vehicle.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up · light spin', duration: '5 min', notes: 'Get blood in the legs.' },
      { name: 'Leg press · warm-up set', reps: 12, sets: 1, breakSec: 90, intensity: 'easy', notes: 'Light load. Get used to the movement.' },
      { name: 'Leg press · working set', reps: 8, sets: 4, breakSec: 120, intensity: 'hard', notes: 'Load to ~70-75% of your 1RM (heavy but you finish all reps with form). Slow down (3s), drive up controlled. NO bouncing at the bottom.' },
      { name: 'Calf press', reps: 15, sets: 3, breakSec: 60, intensity: 'moderate', notes: 'Same machine. Pause at the top. Slow down.' },
      { name: 'Cool-down spin', duration: '5 min', notes: 'Light bike spin to flush the legs.' }
    ]
  },

  squat_strength: {
    name: 'Squat Rack Strength',
    duration: 40, intensity: 'hard',
    description: 'Barbell squats — gold-standard leg strength work. Coach supervision recommended for younger athletes. Form before load.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up · spin bike', duration: '5 min', notes: 'Get the joints warm.' },
      { name: 'Bodyweight warm-up squat', reps: 10, sets: 2, breakSec: 30, intensity: 'easy', notes: 'Groove the pattern.' },
      { name: 'Back squat · build', reps: 5, sets: 2, breakSec: 90, intensity: 'moderate', notes: '2 build sets — lighter load, getting heavier. Find your form.' },
      { name: 'Back squat · working', reps: 5, sets: 4, breakSec: 180, intensity: 'hard', notes: 'Working weight (~75% 1RM). Brace the core. Knees track over toes. Below parallel if mobility allows.' },
      { name: 'Cool-down', duration: '5 min', notes: 'Light spin + hip flexor stretch.' }
    ]
  },

  full_circuit: {
    name: 'Machine Circuit',
    duration: 40, intensity: 'moderate',
    description: 'Full-body circuit hitting legs, posterior chain, core in 3 rounds. Moves fast — gym efficiency.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up · row', duration: '5 min', notes: 'Light rate, find rhythm.' },
      { name: 'Leg press', reps: 12, sets: 3, breakSec: 60, intensity: 'moderate', notes: 'Moderate load. Quality reps.' },
      { name: 'Lat pulldown', reps: 12, sets: 3, breakSec: 60, intensity: 'moderate', notes: 'Pull to upper chest. Squeeze shoulder blades.' },
      { name: 'Seated row', reps: 12, sets: 3, breakSec: 60, intensity: 'moderate', notes: 'Drive elbows back. Don\'t lean.' },
      { name: 'Hamstring curl', reps: 12, sets: 3, breakSec: 60, intensity: 'moderate', notes: 'Slow eccentric (3s back). Squeeze at full curl.' },
      { name: 'Cool-down · bike', duration: '5 min', notes: 'Easy spin out.' }
    ]
  },

  intervals_assault: {
    name: 'Intervals · Assault Bike',
    duration: 30, intensity: 'hard',
    description: 'Air bike intervals — brutal but efficient. Same VO2 stimulus as on-bike surges. 6×30s all-out.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '8 min', notes: 'Easy spin, build slightly. 2×15s pickups in last 2 min.' },
      { name: 'Assault bike · 30s max', duration: '30 sec', sets: 6, breakSec: 90, intensity: 'max', notes: '30s ALL OUT. Pull with the arms, push with the legs. Last 5s should feel impossible.' },
      { name: 'Cool-down', duration: '8 min', notes: 'Easy spin. Recover the breath.' }
    ]
  },

  threshold_machine: {
    name: 'Threshold · Spin Bike',
    duration: 40, intensity: 'hard',
    description: 'Threshold intervals on a controlled bike — same stimulus as on-HPR threshold work but in the gym. 4×6 min at hardest sustainable pace.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up', duration: '10 min', notes: 'Build from easy to moderate. 2×30s 90+ rpm bursts in last 3 min.' },
      { name: 'Threshold', duration: '6 min', sets: 4, breakSec: 180, intensity: 'hard', notes: 'Hardest sustainable. One word, not a sentence. 80-85 rpm.' },
      { name: 'Cool-down', duration: '6 min', notes: 'Easy spin out.' }
    ]
  },

  hill_machine: {
    name: 'Hill Machine · Elliptical or Stairmaster',
    duration: 30, intensity: 'hard',
    description: 'Steep elliptical or stairmaster intervals. Mimics sustained climbing force without bike-specific impact. Great alternative when the bike\'s booked.',
    videoUrl: VID_DEFAULT,
    exercises: [
      { name: 'Warm-up · low resistance', duration: '8 min', notes: 'Easy. Find the rhythm.' },
      { name: 'Hill push · 3 min', duration: '3 min', sets: 5, breakSec: 90, intensity: 'hard', notes: 'Crank the resistance / steepest setting. Drive through legs. 60-70 rpm cadence.' },
      { name: 'Cool-down', duration: '7 min', notes: 'Drop resistance fully. Easy out.' }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PLAN GENERATOR
// ─────────────────────────────────────────────────────────────────────────

function makeWorkout(week, day, sessionTemplate) {
  // Inline-clone the session template so each plan owns its data and a
  // user reading the plans page can't see references leaking into UI.
  return { week, day, ...sessionTemplate };
}

function makePlan({ id, category, yearLevel, tier, name, description, durationWeeks, sessionsPerWeek, schedule, lib }) {
  const workouts = [];
  schedule.forEach((week, wi) => {
    week.forEach(({ day, key }) => {
      const tpl = lib[key];
      if (tpl) workouts.push(makeWorkout(wi + 1, day, tpl));
    });
  });
  return {
    id, category, yearLevel, tier, name, description,
    durationWeeks, sessionsPerWeek,
    workouts,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PLAN SCHEDULES — the per-tier, per-year-level weekly structures
// ─────────────────────────────────────────────────────────────────────────
//
// Schedule shape: array of weeks; each week is an array of { day, key }.
// `key` references a session in the relevant library (BIKE/FLOOR/MACHINE).
//
// Difficulty progression follows the year-level guidance:
//   Y7-Y8  → 2 sessions/week, 2 weeks, easy/moderate cap
//   Y9     → 3 sessions/week, 2 weeks, one hard session
//   Y10    → 4 sessions/week, 2 weeks, 1-2 hard sessions
//   Y11    → 4-5 sessions/week, 2 weeks, 1 max session
//   Y12    → 5 sessions/week, 2 weeks, 1-2 max sessions

const BIKE_SCHEDULES = {
  // Y7-Y8: easy to moderate ONLY per the year-level guideline. No hard /
  // race-pace / VO2 / threshold sessions at this age. Build the habit
  // and the position before chasing intensity.
  Y7_basic: [
    [ { day: 'Mon', key: 'recovery_short' }, { day: 'Thu', key: 'cadence_drills' } ],
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Thu', key: 'endurance_short' } ],
  ],
  Y7_average: [
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Thu', key: 'endurance_short' } ],
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Thu', key: 'endurance_short' }, { day: 'Sat', key: 'tempo_block' } ],
  ],
  Y7_intense: [
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Sat', key: 'tempo_block' } ],
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Sat', key: 'tempo_block' } ],
  ],
  Y8_basic: [
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Thu', key: 'endurance_short' } ],
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Thu', key: 'tempo_block' } ],
  ],
  Y8_average: [
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Sat', key: 'tempo_block' } ],
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Sat', key: 'tempo_block' } ],
  ],
  Y8_intense: [
    [ { day: 'Mon', key: 'cadence_drills' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Fri', key: 'tempo_block' }, { day: 'Sat', key: 'recovery_25' } ],
    [ { day: 'Mon', key: 'tempo_block' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Fri', key: 'cadence_drills' }, { day: 'Sat', key: 'endurance_long' } ],
  ],
  Y9_basic: [
    [ { day: 'Mon', key: 'recovery_25' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Sat', key: 'tempo_block' } ],
    [ { day: 'Mon', key: 'recovery_25' }, { day: 'Wed', key: 'cadence_drills' }, { day: 'Sat', key: 'race_pace_3x8' } ],
  ],
  Y9_average: [
    [ { day: 'Mon', key: 'tempo_block' }, { day: 'Wed', key: 'recovery_25' }, { day: 'Fri', key: 'endurance_short' }, { day: 'Sat', key: 'race_pace_3x8' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Wed', key: 'recovery_25' }, { day: 'Fri', key: 'endurance_short' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y9_intense: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'endurance_short' }, { day: 'Thu', key: 'vo2_surges' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Thu', key: 'race_pace_3x8' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y10_basic: [
    [ { day: 'Mon', key: 'tempo_block' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Sat', key: 'race_pace_3x8' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Wed', key: 'recovery_25' }, { day: 'Sat', key: 'endurance_long' } ],
  ],
  Y10_average: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'endurance_short' }, { day: 'Thu', key: 'vo2_surges' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Thu', key: 'race_pace_3x8' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y10_intense: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Fri', key: 'vo2_surges' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'starts_drill' }, { day: 'Fri', key: 'race_pace_3x8' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y11_basic: [
    [ { day: 'Mon', key: 'tempo_block' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Fri', key: 'sweet_spot_4x9' }, { day: 'Sat', key: 'recovery_25' } ],
    [ { day: 'Mon', key: 'race_pace_3x8' }, { day: 'Wed', key: 'recovery_25' }, { day: 'Fri', key: 'endurance_long' } ],
  ],
  Y11_average: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'endurance_short' }, { day: 'Wed', key: 'recovery_25' }, { day: 'Fri', key: 'vo2_surges' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'cadence_drills' }, { day: 'Fri', key: 'race_pace_3x8' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y11_intense: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Thu', key: 'vo2_surges' }, { day: 'Fri', key: 'recovery_short' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'starts_drill' }, { day: 'Thu', key: 'race_pace_3x8' }, { day: 'Fri', key: 'recovery_short' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y12_basic: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Fri', key: 'race_pace_3x8' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Wed', key: 'recovery_25' }, { day: 'Fri', key: 'cadence_drills' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y12_average: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Fri', key: 'vo2_surges' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'starts_drill' }, { day: 'Fri', key: 'race_pace_3x8' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
  Y12_intense: [
    [ { day: 'Mon', key: 'threshold_pyramid' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'endurance_short' }, { day: 'Thu', key: 'vo2_surges' }, { day: 'Fri', key: 'recovery_short' }, { day: 'Sat', key: 'endurance_long' } ],
    [ { day: 'Mon', key: 'sweet_spot_4x9' }, { day: 'Tue', key: 'recovery_25' }, { day: 'Wed', key: 'starts_drill' }, { day: 'Thu', key: 'race_pace_3x8' }, { day: 'Fri', key: 'recovery_short' }, { day: 'Sat', key: 'race_simulation' } ],
  ],
};

const FLOOR_SCHEDULES = {
  // Y7-Y8 floor: easy/moderate only. No core_advanced, plyo, hill_sim,
  // legs_strength, intervals_floor (all 'hard' in the session library).
  Y7_basic: [
    [ { day: 'Mon', key: 'mobility_short' }, { day: 'Thu', key: 'core_basic' } ],
    [ { day: 'Mon', key: 'core_basic' }, { day: 'Thu', key: 'full_body' } ],
  ],
  Y7_average: [
    [ { day: 'Mon', key: 'core_basic' }, { day: 'Wed', key: 'full_body' }, { day: 'Sat', key: 'mobility_short' } ],
    [ { day: 'Mon', key: 'legs_endurance' }, { day: 'Wed', key: 'core_basic' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y7_intense: [
    [ { day: 'Mon', key: 'legs_endurance' }, { day: 'Wed', key: 'core_basic' }, { day: 'Fri', key: 'full_body' }, { day: 'Sat', key: 'mobility_short' } ],
    [ { day: 'Mon', key: 'glute_focus' }, { day: 'Wed', key: 'core_basic' }, { day: 'Fri', key: 'technique_focus' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y8_basic: [
    [ { day: 'Mon', key: 'core_basic' }, { day: 'Thu', key: 'full_body' } ],
    [ { day: 'Mon', key: 'legs_endurance' }, { day: 'Thu', key: 'core_basic' } ],
  ],
  Y8_average: [
    [ { day: 'Mon', key: 'legs_endurance' }, { day: 'Wed', key: 'core_basic' }, { day: 'Sat', key: 'full_body' } ],
    [ { day: 'Mon', key: 'glute_focus' }, { day: 'Wed', key: 'core_basic' }, { day: 'Sat', key: 'mobility_short' } ],
  ],
  Y8_intense: [
    [ { day: 'Mon', key: 'legs_endurance' }, { day: 'Wed', key: 'core_basic' }, { day: 'Fri', key: 'full_body' }, { day: 'Sat', key: 'glute_focus' } ],
    [ { day: 'Mon', key: 'glute_focus' }, { day: 'Wed', key: 'technique_focus' }, { day: 'Fri', key: 'core_basic' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y9_basic: [
    [ { day: 'Mon', key: 'legs_endurance' }, { day: 'Wed', key: 'core_basic' }, { day: 'Sat', key: 'full_body' } ],
    [ { day: 'Mon', key: 'glute_focus' }, { day: 'Wed', key: 'core_basic' }, { day: 'Sat', key: 'mobility_short' } ],
  ],
  Y9_average: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'glute_focus' }, { day: 'Sat', key: 'mobility_short' } ],
    [ { day: 'Mon', key: 'plyo' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'full_body' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y9_intense: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'plyo' }, { day: 'Sat', key: 'glute_focus' } ],
    [ { day: 'Mon', key: 'hill_simulation' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'intervals_floor' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y10_basic: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'glute_focus' }, { day: 'Sat', key: 'mobility_short' } ],
    [ { day: 'Mon', key: 'plyo' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'full_body' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y10_average: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'plyo' }, { day: 'Sat', key: 'glute_focus' } ],
    [ { day: 'Mon', key: 'hill_simulation' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'intervals_floor' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y10_intense: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'glute_focus' }, { day: 'Thu', key: 'plyo' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'hill_simulation' } ],
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'intervals_floor' }, { day: 'Thu', key: 'full_body' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y11_basic: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'plyo' }, { day: 'Sat', key: 'mobility_short' } ],
    [ { day: 'Mon', key: 'hill_simulation' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'glute_focus' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y11_average: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'plyo' }, { day: 'Sat', key: 'glute_focus' } ],
    [ { day: 'Mon', key: 'hill_simulation' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'intervals_floor' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y11_intense: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'glute_focus' }, { day: 'Thu', key: 'plyo' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'hill_simulation' } ],
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'intervals_floor' }, { day: 'Thu', key: 'full_body' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y12_basic: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'plyo' }, { day: 'Sat', key: 'glute_focus' } ],
    [ { day: 'Mon', key: 'hill_simulation' }, { day: 'Tue', key: 'mobility_short' }, { day: 'Wed', key: 'core_advanced' }, { day: 'Fri', key: 'intervals_floor' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y12_average: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'glute_focus' }, { day: 'Thu', key: 'plyo' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'hill_simulation' } ],
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'intervals_floor' }, { day: 'Thu', key: 'full_body' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
  Y12_intense: [
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'plyo' }, { day: 'Thu', key: 'glute_focus' }, { day: 'Fri', key: 'core_advanced' }, { day: 'Sat', key: 'hill_simulation' } ],
    [ { day: 'Mon', key: 'legs_strength' }, { day: 'Tue', key: 'core_advanced' }, { day: 'Wed', key: 'intervals_floor' }, { day: 'Thu', key: 'plyo' }, { day: 'Fri', key: 'mobility_short' }, { day: 'Sat', key: 'recovery_floor' } ],
  ],
};

const MACHINE_SCHEDULES = {
  // Y7-Y8 machine: easy/moderate only. No leg_press/squat_strength/
  // intervals_assault/threshold_machine/hill_machine (all 'hard').
  // full_circuit is moderate, fine for these years.
  Y7_basic: [
    [ { day: 'Mon', key: 'recovery_machine' }, { day: 'Thu', key: 'endurance_bike' } ],
    [ { day: 'Mon', key: 'endurance_rower' }, { day: 'Thu', key: 'full_circuit' } ],
  ],
  Y7_average: [
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Sat', key: 'recovery_machine' } ],
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_rower' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y7_intense: [
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'recovery_machine' } ],
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_rower' }, { day: 'Fri', key: 'endurance_bike' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y8_basic: [
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Thu', key: 'endurance_bike' } ],
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Thu', key: 'endurance_rower' } ],
  ],
  Y8_average: [
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Sat', key: 'full_circuit' } ],
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_rower' }, { day: 'Sat', key: 'endurance_bike' } ],
  ],
  Y8_intense: [
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'recovery_machine' } ],
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_rower' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y9_basic: [
    [ { day: 'Mon', key: 'full_circuit' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Sat', key: 'leg_press' } ],
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Wed', key: 'recovery_machine' }, { day: 'Sat', key: 'endurance_rower' } ],
  ],
  Y9_average: [
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'recovery_machine' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Fri', key: 'endurance_rower' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y9_intense: [
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Fri', key: 'hill_machine' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y10_basic: [
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'recovery_machine' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Wed', key: 'recovery_machine' }, { day: 'Fri', key: 'intervals_assault' }, { day: 'Sat', key: 'endurance_rower' } ],
  ],
  Y10_average: [
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Fri', key: 'hill_machine' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y10_intense: [
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Thu', key: 'full_circuit' }, { day: 'Fri', key: 'recovery_machine' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Thu', key: 'full_circuit' }, { day: 'Fri', key: 'recovery_machine' }, { day: 'Sat', key: 'hill_machine' } ],
  ],
  Y11_basic: [
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Fri', key: 'hill_machine' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y11_average: [
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Fri', key: 'hill_machine' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y11_intense: [
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Thu', key: 'full_circuit' }, { day: 'Fri', key: 'recovery_machine' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Thu', key: 'hill_machine' }, { day: 'Fri', key: 'recovery_machine' }, { day: 'Sat', key: 'full_circuit' } ],
  ],
  Y12_basic: [
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'endurance_bike' }, { day: 'Fri', key: 'full_circuit' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Fri', key: 'hill_machine' }, { day: 'Sat', key: 'recovery_machine' } ],
  ],
  Y12_average: [
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Thu', key: 'full_circuit' }, { day: 'Fri', key: 'recovery_machine' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'leg_press' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Thu', key: 'hill_machine' }, { day: 'Fri', key: 'recovery_machine' }, { day: 'Sat', key: 'full_circuit' } ],
  ],
  Y12_intense: [
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'threshold_machine' }, { day: 'Thu', key: 'full_circuit' }, { day: 'Fri', key: 'leg_press' }, { day: 'Sat', key: 'endurance_rower' } ],
    [ { day: 'Mon', key: 'squat_strength' }, { day: 'Tue', key: 'recovery_machine' }, { day: 'Wed', key: 'intervals_assault' }, { day: 'Thu', key: 'hill_machine' }, { day: 'Fri', key: 'leg_press' }, { day: 'Sat', key: 'full_circuit' } ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// PLAN METADATA — name, description, sessionsPerWeek per (year, tier).
// Generated below for each category.
// ─────────────────────────────────────────────────────────────────────────

// Per-(category × tier) plan names + descriptions. Each combination gets
// a distinctive title and a description that highlights what that
// specific plan focuses on, so the plans list doesn't read as 54 copies
// of the same template with year-numbers swapped.
const PLAN_META = {
  bike: {
    basic:   { name: 'Bike · Foundation',     desc: 'Easy spinning, cadence drills, smooth pedal circles. Build the recumbent position and the habit before chasing intensity. Mostly easy/moderate efforts.' },
    average: { name: 'Bike · Race Conditioning', desc: 'Race-prep block with stint-pace pyramids, surge drills, sweet-spot work, and a race-day simulation. Polarised 80/20 — most easy, some genuinely hard.' },
    intense: { name: 'Bike · Race Build',     desc: 'Race-week build for athletes who want to win. Higher volume, threshold + VO2 work, race-pace stints, pit-out starts, full race simulation. Recovery days are non-negotiable.' },
  },
  floor: {
    basic:   { name: 'Floor · Foundations',   desc: 'Bodyweight basics — core bracing, glute activation, mobility flow. Learn the patterns before adding load. Done at home, no equipment.' },
    average: { name: 'Floor · Strength + Mobility', desc: 'Glute focus, leg endurance circuits, core work, plyometrics for accelerations, plus mobility to counter recumbent-position tightness. Solid race-prep loads.' },
    intense: { name: 'Floor · Race Power',    desc: 'High-volume bodyweight strength + plyometrics for race-winning leg power. Hill simulation, intervals, advanced core. Built for athletes who train mostly at home.' },
  },
  machine: {
    basic:   { name: 'Machine · Gym Habit',   desc: 'Easy circuits + steady cardio (rower, spin bike). Learn the machines and build the gym habit. Quality reps, no heavy load yet.' },
    average: { name: 'Machine · Strength + Cardio', desc: 'Leg press, full-body circuits, threshold rides, hill machine work. Race-day strength for athletes with gym access.' },
    intense: { name: 'Machine · Race Power',  desc: 'Heavy leg work (squat rack + leg press), assault-bike intervals, threshold blocks, hill simulation. The heaviest race-power option in the program.' },
  },
};

const CAT_NAME = { bike: 'Bike', floor: 'Floor & Home', machine: 'Machine' };

function planFor(category, yearLevel, tier) {
  const sched = ({ bike: BIKE_SCHEDULES, floor: FLOOR_SCHEDULES, machine: MACHINE_SCHEDULES })[category][yearLevel + '_' + tier];
  const lib = ({ bike: BIKE_SESSIONS, floor: FLOOR_SESSIONS, machine: MACHINE_SESSIONS })[category];
  const sessions = sched.reduce((s, w) => s + w.length, 0);
  const meta = PLAN_META[category][tier];
  return makePlan({
    id: `${category}-${yearLevel.toLowerCase()}-${tier}`,
    category, yearLevel, tier,
    name: `${yearLevel} · ${meta.name}`,
    description: meta.desc,
    durationWeeks: sched.length,
    sessionsPerWeek: Math.round(sessions / sched.length),
    schedule: sched,
    lib,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORT — the full plan list (54 plans across 6 year levels × 3 tiers ×
// 3 categories) generated from the schedules above.
// ─────────────────────────────────────────────────────────────────────────

const YEAR_LEVELS = ['Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12'];
const TIERS = ['basic', 'average', 'intense'];
const CATEGORIES = ['bike', 'floor', 'machine'];

export const ALL_PLANS = [];
CATEGORIES.forEach(cat => {
  YEAR_LEVELS.forEach(yr => {
    TIERS.forEach(tier => {
      ALL_PLANS.push(planFor(cat, yr, tier));
    });
  });
});
