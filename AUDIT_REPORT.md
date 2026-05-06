# TurboPrep Overnight Audit — 2026-05-05

Status: 1 of 4 agents completed. Remaining: module-init race, UI overlap, performance.

The big root-cause from earlier today: `initTeamChat` was being called once with the noop stub before `teamchat.js` resolved. Module's internal `db`/`addDoc` context never got populated → every `sendChatMessage` returned false silently. **v3.5.100 fixes this** (post-import init re-call + direct addDoc fallback).

---

## Agent — Chat send remaining failure modes ✅

8 candidates ranked by likelihood. The first three are most likely contributing to the "stuck loading, never sends" symptom even after v3.5.100.

### Critical
1. **Optimistic-insert exceptions swallowed** (`app.js:9894, 9901-9902`) — empty `catch(_) {}` around `addPendingChatMessage`, `refreshTeamChatList`, `scrollChatToBottom`. If any throws, flow continues silently into doSend with the UI already wiped — typed message gone, send button stuck disabled. Fix: track `optimisticQueued`, surface error if false.

### High
2. **Stale textarea ref after re-render** (`app.js:9812, 9845`) — `ta` is captured at bind time. When `renderTeamChatPanelInto` re-renders (listener update, scope change), the textarea is replaced and the closure points at the detached DOM node. `ta?.value` returns undefined, send aborts with no error. Fix: read `c.querySelector('#team-chat-input')?.value` fresh on every click.

3. **directSend has no guard for unloaded Firebase SDK** (`app.js:9920`) — if Firebase functions (`addDoc`, `collection`, `serverTimestamp`) are still undefined when send fires, directSend throws with no useful message. Fix: explicit `if (!addDoc || !collection || !serverTimestamp) throw new Error('Firebase SDK not ready')`.

### Medium
4. **Empty-text silent return** (`app.js:9845-9846`) — `if (!text) return` exits with no feedback when ta value is undefined. Fix: pair with `showErr('Type a message first.')`.

5. **Re-bind on every render leaks click handlers** (`app.js:7306` + chat refresh paths) — `bindTeamChatPanel` re-runs on every refresh, attaching new click handlers while old ones remain on detached buttons. Most-recent button is in scope but click might land on stale one. Fix: `el._tpChatBound` guard so we only bind once per panel mount.

6. **Preflight passes but listener not yet live** (`app.js:9844`) — teamId exists but auto-join is async. Sends fire with permission-denied which is then caught + retried, but the retry chain has its own silent paths. Fix: require `_bgChatLive` before allowing send (or show "wait for connection").

7. **`sendBtn.dataset.sending` stuck at '1'** (`app.js:9863, 9986`) — after a render swap, the `sendBtn` ref points to a detached button. Finally-block resets the old one; the new one has no `sending` flag set. Next click reads the stale closure's `sendBtn.dataset.sending === '1'` and silently returns. Fix: re-query `currentBtn = c.querySelector('#team-chat-send')` in the finally block.

### Low
8. **Firestore rule strictness silent fail** (`rules:248`) — `kind in [...]` is case-sensitive; `displayName.size() <= 80` truncates silently if the user's name is over the limit. Both can pass client-side and fail server-side. Fix: validate + clamp before send.

---

## Recommended fix bundle (1-2 hour wave tomorrow morning)

In order of impact, all in `app.js` `bindTeamChatPanel`:

1. Read textarea + button fresh on click via `c.querySelector` (kills the stale-ref family — items 2 + 5 + 7)
2. Surface optimistic-insert errors instead of swallowing (item 1)
3. Guard directSend on Firebase SDK readiness (item 3)
4. Replace silent empty-text return with showErr (item 4)
5. Single-bind guard on the panel via `el._tpChatBound` (item 5 again, defence-in-depth)

That bundle should make sends actually work even if every other path is misbehaving.

---

## Agent — Module-init race audit ✅

Same shape as the teamchat.js bug — two more modules vulnerable:

### Vulnerable
1. **fitbit.js** — `initFitbit` and `fitbitHandleCallback` called from auth path before imports resolve. Internal `let A = {...}` never gets the real ctx → OAuth token writes silently no-op. Symptom: callback runs but tokens don't save, user stuck in auth flow.
2. **garmin.js** — `importGarminFile` called from a profile event listener. If user clicks file upload before the import completes, file picker accepts but nothing processes/uploads.
3. **teamchat.js** — same bug; just fixed in v3.5.100.

### Safe
- admin.js, strava.js, raceLog.js, timer.js, aifeatures.js — all already covered by the `renderCurrentPage` re-init block (lines 2853-2857 in app.js) which re-calls each `initX` after `invalidateModuleCtx`. The race is mitigated by the periodic re-init pattern.

### Fix
Add to the `renderCurrentPage` re-init block:
```js
try { initFitbit(_ctx); } catch(e) {}
try { initGarmin(_ctx); } catch(e) {}
try { initTeamChat(_ctx); } catch(e) {}
```

Cheap belt-and-braces; one line each.

---

## Agent — UI overlap + scroll-blocked elements ✅

### Critical / High
1. **`#main-app > #content` is missing `padding-bottom`** (`styles.css:119`) — has `padding:16px` but **no bottom reservation for the 56px+safe-area tab bar**. Last items on every page get covered. **This is the primary "UIs blocked from going to bottom" cause.** Fix:
   ```css
   #main-app > #content {
     padding-bottom: calc(56px + env(safe-area-inset-bottom) + 16px);
   }
   ```
2. **AI fab z-index conflict** (`styles.css:764, z-index:35`) — sits below overlays (z-index:200) so when Timer/Profile/Training opens, fab disappears behind. Should be ~195 to stay below modals but above content.

### Medium
3. **Training overlay z-index 200** (`app.js:516`) collides with timer/profile/AI overlays. Bump to 205 to disambiguate.
4. **Member sheet `max-height: 88vh`** (`layout-fix.css:1912`) doesn't subtract safe-area-inset-bottom, so content overflows into the home indicator on iPhone 12+. Fix: `max-height: calc(88vh - env(safe-area-inset-bottom))`.
5. **Chat composer dvh calc** (`layout-fix.css:1357`) hardcodes 64px offset; should use `var(--tab-h)` and full safe-area math (already mostly correct, verify on device).

### Low
6. **`--header-h` variable static at 56px** but the actual header CSS uses `calc(56px + env(safe-area-inset-top))`. Make the variable match.
7. **Gallery grid `repeat(3, 1fr)`** in member sheet is too tight on narrow phones. Switch to `repeat(auto-fit, minmax(80px, 1fr))`.
8. **AI fab bottom offset** is 64px hardcoded — off by 8px on safe-area devices. Use `var(--tab-h)` directly.

### Tomorrow's fix priority
Item #1 alone is probably worth more than the rest combined — every page would gain a clean scroll-to-bottom.

---

## Agent — Performance hot paths ✅

### Surprise finding
The big constants the previous audit flagged — `ALL_ADMIN_FEATURES`, `COACH_FEATURES`, `ALBERT_PARK_WAYPOINTS` — are actually only **a few hundred bytes each** in current source (the previous audit's KB numbers came from a stale snapshot or were measured wrong). Lazy-loading them isn't the big win we thought; total gain is ~3 ms parse time.

### Real wins, ranked by user-visible impact

| # | Win | Saves | File:line |
|---|---|---|---|
| 1 | **Consolidate cold-start Firestore reads in parallel** instead of chained `.then()`s | 300–500ms cold-start on 3G | `app.js:11022-11056, 10978-10995` |
| 2 | **Debounce chat localStorage persist to 5s** | −90% localStorage I/O during active chat; ~8ms/snapshot | `teamchat.js:110-112` |
| 3 | **Remove redundant `refreshTeamChatList()` calls after sendChatMessage success** — onSnapshot already re-renders; double-DOM-churn on every message | 10-15ms per send | `app.js:9735, 9771, 9775` |
| 4 | **Cache `localStorage.getItem` reads in render hot paths** (`tp_widgets`, `tp_weather`, `tp_ai_widgets`) — currently re-reads on every renderToday | 1.5ms/render × ~25 renders/session | `app.js:411, 624, 681, 768+` |
| 5 | **Inline CSS for frequent small components** (`.chat-msg`, `.chat-scope-chip`, `.ai-msg`) — `layout-fix.css` is now 2063 lines / 61 KB | 1-2ms per render; first-load 500-800ms on 3G | `layout-fix.css` broad |
| 6 | **Lazy-load BADGES** (1.3 KB, only used on Profile + earn-calc) | 1.4ms cold-start | `app.js:1629-1644` |
| 7 | **Lazy-load ALL_ADMIN_FEATURES + COACH_FEATURES** | 0.8ms total | `app.js:2029-2036, 10091-10099` |
| 8 | **Lazy-load ALBERT_PARK_WAYPOINTS** to demo-only path | 0.8ms | `app.js:12263-12276` |

### Already healthy
- Listener cleanup on signOut is comprehensive (workouts, checklist, profile, team, chat, etc.) — no leaks.
- Gallery uses Storage URLs, not base64 (the previous audit's concern was already fixed).
- Service Worker cache strategy is fine.
- Race-day overlay's 4 onSnapshot listeners DO get torn down properly via `detachRdOverlayListeners()`.

### Total expected impact if all wins shipped
**-500 to -700ms cold-start**, **-25 to -35ms per hot render**, **-50 KB first-load weight**. Most user-visible improvement on slow networks.

---

# CONSOLIDATED MORNING SUMMARY

## What's most likely making "service is extremely slow"
Per the perf audit: not bundle weight (those constants are small) — it's **chained Firestore reads at cold start** + **localStorage thrashing during chat**. The first one alone explains most of the slow-feel.

## The "messages still not sending" mystery, after v3.5.100
The audit found **three high-likelihood remaining causes** even after my init-race fix:
1. **Stale textarea / button refs** in the send-button click closure after `renderTeamChatPanelInto` re-renders (sends fire against detached DOM)
2. **Optimistic-insert exceptions silently swallowed** — typed message gone, user sees nothing
3. **`sendBtn.dataset.sending` stuck at '1'** on the old detached button — next click silently blocked

Plus 2 more modules with the same init-race shape that bit teamchat.js: **fitbit.js** (OAuth tokens silently fail to save) and **garmin.js** (file uploads silently no-op).

## The "UIs blocked from going down" mystery
**Single primary cause**: `#main-app > #content` has no `padding-bottom` to reserve space for the bottom tab bar. Last items on EVERY page get covered. One CSS line fix unlocks scroll-to-bottom across the app.

## Top 10 fixes for tomorrow morning, ordered by impact

| # | Fix | File:line | Cost | Win |
|---|---|---|---|---|
| 1 | **Read textarea + button fresh on every click via `c.querySelector`** in chat send | `app.js:9812, 9845, 9863, 9986` | 5 min | Sends will actually fire reliably |
| 2 | **Add `#content` padding-bottom for tab bar** | `styles.css:119` | 1 min | All pages scroll to bottom |
| 3 | **Re-init fitbit + garmin in renderCurrentPage block** (defence-in-depth for the same bug shape teamchat.js had) | `app.js:2853-2857` | 2 min | OAuth + Garmin uploads stop silent-failing |
| 4 | **Surface optimistic-insert errors** instead of swallowing | `app.js:9894, 9901-9902` | 5 min | "Send button does nothing" becomes "Send failed: <reason>" |
| 5 | **Consolidate cold-start Firestore reads with Promise.all** | `app.js:11022-11056` | 20 min | -300-500ms cold-start |
| 6 | **Debounce `persistChatToLocal` to 5s** | `teamchat.js:110-112` | 5 min | -90% localStorage I/O during chat |
| 7 | **Remove redundant `refreshTeamChatList()` after send success** | `app.js:9735, 9771, 9775` | 3 min | -10ms per message; less DOM thrash |
| 8 | **Cache `localStorage.getItem` reads in renderToday hot path** | `app.js:411, 624, 681, 768` | 10 min | -1.5ms × 25 renders |
| 9 | **Lock z-index hierarchy** (AI fab 195, training overlay 205, member sheet safe-area math) | `styles.css:764`, `app.js:516`, `layout-fix.css:1912` | 10 min | Modal stacking always correct, no home-indicator overflow |
| 10 | **Single-bind guard on chat panel** (`el._tpChatBound`) so listeners don't accumulate | `app.js:7306` | 3 min | Click handlers don't pile up across re-renders |

Total time: ~60-70 min to ship the whole bundle. Items #1-3 alone restore basic functionality (chat works, scroll works, OAuth works).

## What's already shipped (yesterday + tonight)
- v3.5.86–v3.5.93: chat error visibility, dvh layout, member sheet click, single Learn-to-Ride video, achievements, push BadDeviceToken auto-fallback, optimistic chat send
- v3.5.94–v3.5.97: chat pill corner indicator, FCM migration (full pipeline), chat preflight self-heal
- v3.5.98: race-day live listeners, training mode V1 (Watch + phone)
- v3.5.99: chat preflight relaxed, AI fab off Hub, dead CHANGELOG dropped
- v3.5.100 (last night): **the actual chat-send root cause** — `initTeamChat` re-call after teamchat.js import + direct `addDoc` fallback

## Recommended first 30 minutes tomorrow
- Fixes 1, 2, 3 from the table above (10 min total). Should make chat sends reliable, restore scroll, and inoculate fitbit/garmin against the same race.
- THEN test sends end-to-end on iPhone before doing anything else.
- Then bundle 4-10 as a single ship if there's time.

Sleep well.
