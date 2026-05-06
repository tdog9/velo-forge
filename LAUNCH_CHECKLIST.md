# TurboPrep — Launch Checklist

State as of v3.6.2. This is the complete path from where you are today (working dev/TestFlight build) to a publicly-launched school product.

---

## ✅ Already done (you don't need to think about these)

- iOS native app builds, signs, runs on real devices
- Firebase project (`hpr-2026`) on Blaze plan
- Firestore + rules deployed
- Cloud Storage configured + rules deployed
- Push notifications via FCM (auth key uploaded; tokens registering; `onChatWrite` Function fires broadcasts server-side)
- Cloud Functions deployed: `onChatWrite` (moderation + push), `cleanupOldChatMessages` (24h chat TTL), `createBigQueryViews` (analytics setup)
- Firestore→BigQuery streaming extensions installed (workouts, chat, stints)
- BigQuery views created for Looker Studio
- Web app at https://turboprep.app via Netlify
- Apple Developer account, signing certs, provisioning profiles
- Production APNs entitlement live in builds
- Race-day live sync, Training mode, Hub, Member sheets, Team chat, Photo attachments, 24h chat cleanup, Server-side moderation, AI fab opt-in, Welcome feature picker

---

## 🟡 Things only you can do (sign-in required)

### 1. BigQuery backfill (one-time, ~30 sec each)
Browser-only because the streaming extensions write with their own service account, not yours. Open each extension's manage page and run the import job:

| Collection | Manage URL |
|---|---|
| Workouts | https://console.firebase.google.com/project/hpr-2026/extensions/instances/workouts-bq |
| Chat | https://console.firebase.google.com/project/hpr-2026/extensions/instances/chat-bq |
| Stints | https://console.firebase.google.com/project/hpr-2026/extensions/instances/stints-bq |

For each: scroll to **"How this extension works"** → **"Backfill existing documents"** → click **Run**. Done in seconds.

### 2. Looker Studio dashboard
Pick the views you want as charts; takes ~10 minutes once.

1. Open https://lookerstudio.google.com/reporting/create
2. **Add data** → **BigQuery** → authorize Looker Studio if prompted → pick `hpr-2026` → `turboprep_analytics`
3. Choose `v_team_activity_daily` first (most useful)
4. Drop in a **Time series** chart: dimension `day`, metric `workouts`
5. Add more charts from the other views (`v_athlete_weekly_summary`, `v_chat_engagement`, `v_race_lap_distribution`)
6. **Share** → set audience to coaches' Google emails or "anyone with link"
7. Bookmark the dashboard URL and pin it in Coach tab if you want — I can wire that next session.

### 3. Archive iOS build for TestFlight
Apple processes new builds in 10-30 min. Bump build number first:

```sh
sed -i '' "s/CURRENT_PROJECT_VERSION = 20260504/CURRENT_PROJECT_VERSION = 20260506/g" \
  ~/dev/velo-forge/ios/TurboPrep.xcodeproj/project.pbxproj
```

Then in Xcode:
1. Open `~/dev/velo-forge/ios/TurboPrep.xcodeproj`
2. Top bar: scheme = TurboPrep, destination = **Any iOS Device (arm64)**
3. **Product → Archive**
4. When Organizer pops: **Distribute App** → **App Store Connect** → **Upload** → walk through (let Xcode auto-manage signing)
5. Wait 10-30 min for Apple processing
6. Existing TestFlight testers get the update in their TestFlight app automatically

---

## 🔴 Things you still need to do for App Store launch (one-time setup)

### A. App Store Connect listing
Open https://appstoreconnect.apple.com → My Apps → TurboPrep. You'll need:

- **App icon** — 1024×1024 PNG, no transparency, no alpha. Probably already have one in `ios/TurboPrep/Assets.xcassets/AppIcon.appiconset`.
- **Screenshots** — 6.7", 6.1", and 5.5" iPhone sizes. Minimum 3 each. Use the dev build to take screenshots of: Today page, Team Hub, Chat, Race-day overlay, Member detail sheet.
- **App description** (~4000 chars) — pitch for HPR coaches and athletes. Describe: training plans, race-day live tracking, team chat, gallery, Apple Watch lap timer.
- **Keywords** — 100 chars total. Suggest: "HPR,human powered vehicle,cycling,school,training,race,team,coach,Victoria"
- **Support URL** — point to https://turboprep.app/support.html (already exists)
- **Privacy Policy URL** — point to https://turboprep.app/privacy.html (already exists)
- **Marketing URL** (optional)
- **Age rating** — answer the questionnaire honestly. Likely 12+ given the school context (no objectionable content, but rates above 4+ for unrestricted internet access via the spectator link feature).
- **Category**: Health & Fitness (Primary), Sports (Secondary)

### B. Privacy nutrition label
Apple requires this for every new submission. Open App Store Connect → Privacy → answer:

- **Identifiers**: User ID (Firebase UID), Device ID (APNs token)
- **Health & Fitness**: Health (HR, sleep, steps from HealthKit/Watch), Fitness (workouts, race times)
- **User Content**: Photos (chat + gallery), Other User Content (chat messages)
- **Usage Data**: Product Interaction (which tabs opened — only if you want to track this; currently you don't)
- **Diagnostics**: Crash data, Performance data (Firebase auto-collects)
- **Linked to user**: Yes, for the Health/Fitness/User Content categories
- **Used to track you**: No (you don't share data with other companies)

### C. Submit for App Review
Once the build is uploaded + listing is filled out:
1. App Store Connect → TurboPrep → + Version → 1.0
2. Pick the build that uploaded from Xcode
3. Add screenshots, description, keywords
4. **Demo account** — create one for Apple's reviewers: an email + password that can sign in to a populated test team. Reviewers WILL test it.
5. **Review notes** — tell them to log in with the demo account, then explain how to test race-day mode (you can stub a fake race day they can activate).
6. Submit
7. Average review time: 24-48 hours. They may ask questions or reject — respond fast and resubmit.

---

## 🟢 Hardening / polish before launch (recommended, not required)

### 1. Test all flows with a fresh account
Sign up as a brand-new user, walk through:
- Welcome flow with the new feature picker
- Joining a team via code
- Logging a workout
- Sending a chat message + photo
- Receiving a coach broadcast push
- Race-day overlay (have another account activate it)
- Apple Watch sign-in gate + training mode

### 2. Set Firebase budget alerts
https://console.cloud.google.com/billing/budgets?project=hpr-2026 → create a budget at $10/month, alert you at 50%, 90%, 100%. Cheap insurance against runaway bills if a Function loops.

### 3. Crashlytics
Add Firebase Crashlytics to the iOS app target (Xcode → File → Packages → already have firebase-ios-sdk → just check the FirebaseCrashlytics product). Adds ~30 sec of build time, gives you crash reports for every TestFlight build.

### 4. Privacy policy review
Re-read `privacy.html` — does it accurately describe: HealthKit data, push notifications, photo storage, FCM tokens, BigQuery analytics? If you added features Apple's reviewers will scrutinise the policy.

### 5. Support flow
Decide where users email when something breaks. `support@turboprep.app`? `matt@403productions.com.au`? Wire a `mailto:` link from `support.html` and from a "Contact support" entry in Profile.

### 6. Onboarding the first school
Pick the school. Get the head coach to test for a week. Their feedback drives v1.1.

---

## 📅 Suggested 7-day path to public TestFlight beta

**Day 0 (today)** — archive + upload to App Store Connect. Build processes overnight.
**Day 1** — backfill BigQuery, build Looker dashboard. Take screenshots for the listing.
**Day 2** — fill out App Store Connect listing + privacy nutrition label.
**Day 3** — invite 5-10 internal testers via TestFlight. Watch for bugs.
**Day 4-5** — Crashlytics + budget alerts + privacy polish.
**Day 6** — submit for App Review.
**Day 7** — answer Apple's questions (if any). Beta becomes available.

If you want to go straight to public App Store launch instead of TestFlight beta: same path, just skip the TestFlight step and ask Apple to publish directly when they approve.

---

## 🎯 What I can do for you next session
- Wire the Looker dashboard URL into the Coach tab as a new "Analytics" entry
- Set up Crashlytics
- Take + crop the App Store screenshots from your dev build
- Draft the App Store description + keywords
- Set up Firebase budget alerts (1 click + my Function helper)
- Create a polished demo team in Firestore for App Review

Tell me which.
