# App Store Connect — TurboPrep metadata

Paste this into App Store Connect → My Apps → TurboPrep → App Information / iOS App / 1.0.0 Prepare for Submission. The reason "turboprep" search currently shows only the website + short description is because these fields are empty / minimal in ASC. Fill them in to fix it.

---

## App Information (locale-independent — set once)

**Name** (30 char max)
```
TurboPrep
```

**Subtitle** (30 char max)
```
Race day for HPR teams
```

**Bundle ID** (read-only)
```
com.403productions.turboprep
```

**Primary category**: Sports
**Secondary category**: Health & Fitness

**Content rights**: No third-party content
**Age rating**: 4+

---

## Pricing & Availability

**Price**: Free
**Availability**: Australia (start narrow; expand to NZ, US, UK once stable)

---

## 1.0.0 Prepare for Submission

### Promotional Text (170 char max — editable any time without re-review)
```
Live race-day leaderboard. Apple Watch stint tracking. AI coach. Built with Caulfield Grammar HPR. The training app Victorian HPR teams have been waiting for.
```

### Description (4000 char max)
```
TurboPrep is the race-day platform for Victorian high-school Human Powered Vehicle (HPR) teams. Built with one of the country's premier HPR programs, it replaces spreadsheets, group chats, and stopwatch apps with a single tool the whole squad uses every day.

WHAT YOU GET

Race day, sorted
• Live stint leaderboard every team in your pit can see
• Apple Watch HR + lap detection — taps to lap, taps to pit
• Auto-archives every stint to a multi-year team library
• Excel export of the full race — drivers, lap counts, conditions, notes — for the head of sport in one tap
• Lock-screen Live Activity so a parent's phone shows the running stint without unlocking
• Course-side spectator URL parents can open without an account

Training that progresses with you
• Periodised plans for Y7-Y12 across Basic / Average / Intense tiers
• Bike, floor, and machine session libraries — over 50 distinct sessions
• Race-week auto-sharpening: when the next round is 7 days out, the app compresses your week to two short sharpeners plus rest
• Rep ranges + RIR + tempo cues — sessions adapt to the athlete, not the other way around
• Apple Watch session player with HR zones + lap haptics

Coach dashboard
• Adherence grid — see who's logged what, sorted by compliance
• At-risk auto-flagging for athletes under 40% adherence
• One-tap broadcast nudge to a struggling cohort
• Drag-reorder rider list, generate a blank race-report Excel pre-filled with your subteam
• Upload a completed race report and every rider's notes land on their public profile automatically
• Weekly intent field every athlete sees on launch
• Coach onboarding walkthrough so the first 5 minutes aren't guesswork

Team experience
• Subteam-scoped chat (coaches can broadcast everywhere)
• Streaks, XP, achievements
• Daily 3:30 PM motivation push with a week summary + AI-generated quote
• Home screen widget + Apple Watch complication showing days to next race

Privacy + safety
• Australia-based servers (Firebase)
• No third-party advertising
• Coach controls per-team chat moderation
• Per-athlete account deletion + data export

Built in Melbourne for Victorian HPR. Designed to feel native on iPhone, iPad, and Apple Watch.
```

### Keywords (100 char max, comma-separated, NO spaces around commas)
```
HPR,human powered vehicle,race,training,cycling,school sport,coach,team,leaderboard,energy breakthrough
```

### Support URL
```
https://turboprep.app/support
```

### Marketing URL (optional)
```
https://turboprep.app
```

### Privacy Policy URL (required)
```
https://turboprep.app/privacy
```

---

## What's New in 1.0.0 (4000 char max — visible on every TestFlight + release)
```
First public release.

• Race day leaderboard with live stint tracking
• Apple Watch session player with HR zones, lap haptics, pit count
• Coach dashboard with adherence grid + 1-tap nudges
• Race-report Excel upload → per-rider notes auto-link to profiles
• Periodised training plans Y7-Y12 across three tiers
• Race-week auto-sharpening
• Home screen widget showing days to next race
• Daily 3:30 PM motivation push
• Multi-year race archive with Excel + PDF export
```

---

## Required uploads

**App icon**: 1024×1024 PNG — already in `ios/TurboPrep/Assets.xcassets/AppIcon.appiconset/`

**Screenshots** (required — at least 3 per device size)

| Device | Resolution | Min count |
|---|---|---|
| iPhone 16 Pro Max / 6.7" / 6.9" | 1320×2868 | 3 |
| iPhone 15 / 6.5" | 1284×2778 | 3 |
| iPad 12.9" | 2048×2732 | 3 (only if iPad supported) |

**Recommended screenshot order**:
1. **Today page** with the orange Start Training CTA + weather + health card (the daily-driver view)
2. **Race day live** — leaderboard + stint timer with lap count (the wow moment)
3. **Coach dashboard** — roster grid with the at-risk banner (sells to head of sport)
4. **Apple Watch** — training session in flight with HR zones
5. **Race-week banner** — "RACE WEEK · D-3" with the sharpener session
6. **Plan library** — bike sessions grid (shows depth)

Use the iOS Simulator → Hardware → Save Screen to grab these at full resolution.

**App preview video** (optional, 15-30s, MP4 H.264)
- Open app → tap Start Training → watch syncs → end session → race day mode → leaderboard fills

---

## TestFlight beta description (255 char max — what beta testers see when accepting the invite)
```
Hi! This is the first public beta of TurboPrep, an HPR race-day app built with Caulfield Grammar. Use it through a normal training week. Tell me what's broken via WhatsApp or email hearn.tenny@icloud.com. Cheers — Tenny
```

---

## Reviewer notes (private — not visible to users)
```
TurboPrep is a sports-specific app for Australian high-school HPR (Human Powered Vehicle) racing teams. To test the full coach experience, please use the master demo account that's been emailed separately. Race day mode requires the master to toggle it from Admin → Race Day. The Watch app is optional; the iPhone app works without it.

Health data permission is requested because the Watch reads HR during training sessions and the phone reads HealthKit for daily-summary sync. Location is requested for GPS workout tracking. Neither is required for core functionality.

Anthropic API is used for the daily motivation push (server-side, Cloud Functions). No user input is sent to Anthropic from the device.

Demo account: demo@turboprep.app / TestPass2026 (this account is reset nightly).
```

---

## Why search currently shows only "website + short description"

App Store search ranks heavily on:
1. **Name** (you have)
2. **Subtitle** (currently empty?)
3. **Keywords** (currently empty? — this is the big one)
4. **Description** (short / generic?)
5. **In-app purchase names** (n/a)
6. **Indexed reviews** (over time)

Once you paste the **Subtitle**, **Promotional Text**, **Description**, and the comma-separated **Keywords** above into ASC and submit for review, searches for "HPR", "race", "human powered vehicle", "school sport", "energy breakthrough" will all surface TurboPrep. The website-only result happens because ASC is currently serving its fallback when there's nothing else indexed.

The keyword field is THE highest-leverage field — Apple weights it strongly and it's invisible to users (so you can stuff it with synonyms without sounding spammy in the description).
