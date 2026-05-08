import Foundation
import Combine
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Single source of truth for the Watch UI. Mirrors the slices of state the
/// web app exposes on iPhone: race phase, today's plan items, recent
/// completed workouts, race-day status. Today this is seeded with mock data
/// so the Watch UI is fully usable; wiring real data flows from iPhone via
/// ConnectivityService is the next milestone.
@MainActor
final class WatchAppState: ObservableObject {
    static let shared = WatchAppState()

    // Demo seed values were leaking through to real users on cold boot
    // when the iPhone bridge hadn't yet pushed a state snapshot — the
    // Watch displayed "Round 2 · Casey Fields, 21d" forever for users
    // whose phone was off / web app not loaded. Start empty; views
    // render their own empty states until iPhone delivers real data.
    @Published var racePhase: WatchRacePhase? = nil
    @Published var todayWorkouts: [WatchPlanWorkout] = []
    @Published var completedWorkouts: [WatchLoggedWorkout] = []

    /// Race-day live state. When `active`, the Watch locks into the
    /// race-day screen. The iPhone's race-day controller (or our own
    /// /race-day-public poller) is the authority for `raceDayActive`.
    /// `raceDayStartedAt` is set ONLY when the rider taps Start Stint —
    /// activating race-day no longer auto-starts the stint timer.
    @Published var raceDayActive: Bool = false { didSet { scheduleRaceDaySave() } }
    @Published var raceDayLaps: [WatchLap] = [] { didSet { scheduleRaceDaySave() } }
    @Published var raceDayStartedAt: Date? { didSet { scheduleRaceDaySave() } }
    @Published var raceDayLeaderboard: [WatchLeaderboardEntry] = []
    /// Pit-stop tap count for the active stint. Cleared with the rest
    /// of the stint state on finish/exit. Sent along with the stint
    /// payload to the iPhone so it lands in race_day/{date}/stints.
    @Published var raceDayPits: Int = 0 { didSet { scheduleRaceDaySave() } }

    /// Training-mode state. Mirror of raceDayActive but for scheduled
    /// training sessions. When the iPhone pushes trainingActive=true,
    /// the Watch locks into the training screen — same focus pattern
    /// as race-day but without the multi-driver / stint scaffolding.
    /// trainingStartedAt is set when the user taps Start Session.
    @Published var trainingActive: Bool = false
    @Published var trainingStartedAt: Date? = nil
    @Published var trainingType: String = "ride"
    @Published var trainingTitle: String = "Training"
    @Published var trainingLaps: [WatchLap] = []
    /// Workout exercise list pushed from the iPhone when starting a
    /// training session from the Library or a plan day. Each item:
    /// { name, setsTotal, repsLabel, durationLabel, notes }. Watch
    /// displays the current step + a peek at the next.
    @Published var trainingExercises: [WatchTrainingExercise] = []
    @Published var trainingCurrentIdx: Int = 0
    @Published var trainingCurrentSet: Int = 0

    /// Pre-set stint duration in minutes. Drives the countdown timer on
    /// the active-stint screen. Default 30 — typical Vic HPR stint length.
    @Published var stintDurationMinutes: Int = max(5, UserDefaults.standard.integer(forKey: "tp_watch_stint_min") == 0 ? 30 : UserDefaults.standard.integer(forKey: "tp_watch_stint_min")) {
        didSet { UserDefaults.standard.set(stintDurationMinutes, forKey: "tp_watch_stint_min") }
    }

    /// `startedAt + stintDurationMinutes`. nil if no stint is in flight.
    var stintEndsAt: Date? {
        guard let started = raceDayStartedAt else { return nil }
        return started.addingTimeInterval(TimeInterval(stintDurationMinutes) * 60)
    }

    /// True iff a stint is currently being recorded (race-day mode is on
    /// AND the rider has tapped Start Stint).
    var stintInProgress: Bool { raceDayStartedAt != nil }

    /// Begin a new stint right now. Clears any leftover laps and locks
    /// in the start time used by the lap-anchor + countdown.
    func startStint() {
        raceDayLaps.removeAll()
        raceDayPits = 0
        raceDayStartedAt = Date()
    }
    func bumpPit() { raceDayPits += 1 }

    /// Finished stints kept on the Watch so the athlete can review laps
    /// after the test — survives app restart via UserDefaults. Newest first.
    @Published var pastStints: [WatchPastStint] = []
    /// iPhone-side auth state mirrored into the Watch. The Watch can't read
    /// Firebase Firestore directly (no watchOS support) and keychain auth
    /// sharing requires paid-team signing, so the iPhone is the source of
    /// truth for "is the user signed in" via the WatchConnectivity bridge.
    // Persisted to UserDefaults so a relaunch (or a temporarily
    // unreachable iPhone after pairing) doesn't drop the user back to
    // "not signed in" — we cache the last-known user identity and
    // restore it on init. Live snapshots from iPhone refresh these
    // and re-persist via the didSet hooks.
    @Published var iPhoneSignedIn: Bool = UserDefaults.standard.bool(forKey: "tp_watch_iphone_signed_in") {
        didSet { UserDefaults.standard.set(iPhoneSignedIn, forKey: "tp_watch_iphone_signed_in") }
    }
    @Published var iPhoneUserEmail: String? = UserDefaults.standard.string(forKey: "tp_watch_iphone_email") {
        didSet { UserDefaults.standard.set(iPhoneUserEmail, forKey: "tp_watch_iphone_email") }
    }
    @Published var iPhoneUserDisplayName: String? = UserDefaults.standard.string(forKey: "tp_watch_iphone_name") {
        didSet { UserDefaults.standard.set(iPhoneUserDisplayName, forKey: "tp_watch_iphone_name") }
    }

    /// Local pairing flag — once the user taps Pair on the sign-in
    /// gate, the Watch is considered "paired with this iPhone" forever
    /// (until the user explicitly unpairs from Watch Settings → Sign
    /// out). The gate uses this OR iPhoneSignedIn, so a backgrounded
    /// or unreachable iPhone can't bring the gate back.
    @Published var watchPaired: Bool = UserDefaults.standard.bool(forKey: "tp_watch_paired") {
        didSet { UserDefaults.standard.set(watchPaired, forKey: "tp_watch_paired") }
    }
    @Published var pairedWithCode: String = UserDefaults.standard.string(forKey: "tp_watch_paired_code") ?? "" {
        didSet { UserDefaults.standard.set(pairedWithCode, forKey: "tp_watch_paired_code") }
    }
    func setWatchPaired(code: String) {
        self.pairedWithCode = code
        self.watchPaired = true
        // Optimistically flip iPhoneSignedIn so the rest of the Watch
        // UI ("you're signed in" copy, profile circle) updates the
        // moment the user finishes pairing — we don't have to wait
        // for the iPhone's next snapshot push to arrive. The next
        // applyRemoteSnapshot will refresh the user details (display
        // name, email) once it lands.
        self.iPhoneSignedIn = true
    }
    func clearWatchPaired() {
        self.watchPaired = false
        self.pairedWithCode = ""
        // Also drop cached iPhone identity — pairing was the gate to
        // that data on the Watch; if it's torn down, the data goes too.
        self.iPhoneSignedIn = false
        self.iPhoneUserEmail = nil
        self.iPhoneUserDisplayName = nil
    }

    /// First initial for the avatar circle in BrandHeader. Falls back
    /// through display-name → email → "?" so the UI never shows a
    /// completely blank circle.
    var userInitial: String {
        if let n = iPhoneUserDisplayName?.trimmingCharacters(in: .whitespaces),
           let c = n.first { return String(c).uppercased() }
        if let e = iPhoneUserEmail?.trimmingCharacters(in: .whitespaces),
           let c = e.first { return String(c).uppercased() }
        return "?"
    }

    private static let kRaceDayActive  = "tp_watch_rd_active"
    private static let kRaceDayStarted = "tp_watch_rd_started"
    private static let kRaceDayLaps    = "tp_watch_rd_laps"
    private static let kPastStints     = "tp_watch_past_stints"

    /// Coalesces back-to-back didSet writes so a flurry of laps doesn't
    /// hammer UserDefaults (audit found 3 writes per single lap tap).
    private var raceDaySaveTask: DispatchWorkItem?

    private init() {
        loadRaceDayState()
        loadPastStints()
    }

    /// Long-press the wordmark — toggle race-day mode locally for dev.
    /// Activating just enables race-day mode (locks the Watch into the
    /// race screen); the rider still has to tap Start Stint to begin
    /// the lap timer + stint countdown. Deactivating archives the
    /// in-flight stint so review data is preserved.
    func toggleRaceDayForDev() {
        if raceDayActive {
            archiveCurrentStint()
            raceDayActive = false
            raceDayStartedAt = nil
            raceDayLaps.removeAll()
        } else {
            raceDayActive = true
            raceDayStartedAt = nil
            raceDayLaps.removeAll()
        }
    }

    func recordLap(durationSeconds: TimeInterval) {
        let lap = WatchLap(
            number: raceDayLaps.count + 1,
            durationSeconds: durationSeconds,
            recordedAt: Date()
        )
        raceDayLaps.insert(lap, at: 0)
    }

    /// Move the in-progress stint into pastStints. Called when the user
    /// finishes a stint or toggles race-day off. Safe to call with no laps.
    func archiveCurrentStint() {
        guard let started = raceDayStartedAt, !raceDayLaps.isEmpty else { return }
        let stint = WatchPastStint(
            id: UUID(),
            startedAt: started,
            endedAt: Date(),
            // Stored chronologically (lap 1 first) so post-test exports read naturally
            laps: raceDayLaps.sorted(by: { $0.number < $1.number })
        )
        pastStints.insert(stint, at: 0)
        // Cap at 20 to keep UserDefaults small
        if pastStints.count > 20 { pastStints.removeLast(pastStints.count - 20) }
        savePastStints()
    }

    func clearPastStints() {
        pastStints.removeAll()
        savePastStints()
    }

    /// Mark every stint as having been dispatched to the iPhone. Called by
    /// the Dev tab's Sync button after firing each stint via WCSession.
    func markAllStintsSynced() {
        guard !pastStints.isEmpty else { return }
        pastStints = pastStints.map { stint in
            var s = stint; s.synced = true; return s
        }
        savePastStints()
    }

    /// Mark a single stint as synced — used after finishStint where only
    /// the most recent stint's payload was dispatched. Was previously
    /// using `markAllStintsSynced` which incorrectly flipped pending
    /// stints to "synced" even though only the latest was actually sent.
    func markStintSynced(stintId: UUID) {
        guard !pastStints.isEmpty else { return }
        var found = false
        pastStints = pastStints.map { stint in
            if stint.id == stintId {
                found = true
                var s = stint; s.synced = true; return s
            }
            return stint
        }
        if found { savePastStints() }
    }

    // MARK: - Persistence

    /// Debounce — schedule a save 200ms out, cancelling any pending save.
    /// Multiple property updates within the window collapse to one write.
    private func scheduleRaceDaySave() {
        raceDaySaveTask?.cancel()
        let task = DispatchWorkItem { [weak self] in
            Task { @MainActor in self?.saveRaceDayState() }
        }
        raceDaySaveTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(200), execute: task)
    }

    private func saveRaceDayState() {
        let d = UserDefaults.standard
        d.set(raceDayActive, forKey: Self.kRaceDayActive)
        if let started = raceDayStartedAt {
            d.set(started.timeIntervalSince1970, forKey: Self.kRaceDayStarted)
        } else {
            d.removeObject(forKey: Self.kRaceDayStarted)
        }
        if let data = try? JSONEncoder().encode(raceDayLaps) {
            d.set(data, forKey: Self.kRaceDayLaps)
        }
    }

    private func loadRaceDayState() {
        let d = UserDefaults.standard
        raceDayActive = d.bool(forKey: Self.kRaceDayActive)
        if let ts = d.object(forKey: Self.kRaceDayStarted) as? TimeInterval {
            raceDayStartedAt = Date(timeIntervalSince1970: ts)
        }
        if let data = d.data(forKey: Self.kRaceDayLaps),
           let laps = try? JSONDecoder().decode([WatchLap].self, from: data) {
            raceDayLaps = laps
        }
    }

    private func savePastStints() {
        if let data = try? JSONEncoder().encode(pastStints) {
            UserDefaults.standard.set(data, forKey: Self.kPastStints)
        }
    }

    private func loadPastStints() {
        if let data = UserDefaults.standard.data(forKey: Self.kPastStints),
           let stints = try? JSONDecoder().decode([WatchPastStint].self, from: data) {
            pastStints = stints
        }
    }

    func markPlanWorkoutDone(_ workout: WatchPlanWorkout) {
        guard let idx = todayWorkouts.firstIndex(where: { $0.id == workout.id }) else { return }
        todayWorkouts[idx].completed = true
    }

    /// Apply a state snapshot received from the iPhone (which got it from the
    /// web app via the tpNative bridge). Replaces mock data with real values.
    func applyRemoteSnapshot(_ dict: [String: Any]) {
        if let signedIn = dict["iPhoneSignedIn"] as? Bool {
            self.iPhoneSignedIn = signedIn
        }
        if let email = dict["iPhoneUserEmail"] as? String {
            self.iPhoneUserEmail = email
        }
        if let name = dict["iPhoneUserDisplayName"] as? String {
            self.iPhoneUserDisplayName = name
        }
        if let phaseDict = dict["racePhase"] as? [String: Any] {
            self.racePhase = WatchRacePhase(from: phaseDict)
        } else if dict.keys.contains("racePhase") {
            self.racePhase = nil
        }
        if let plan = dict["todayWorkouts"] as? [[String: Any]] {
            self.todayWorkouts = plan.compactMap(WatchPlanWorkout.init(from:))
        }
        if let logged = dict["completedWorkouts"] as? [[String: Any]] {
            self.completedWorkouts = logged.compactMap(WatchLoggedWorkout.init(from:))
        }
        if let lb = dict["raceDayLeaderboard"] as? [[String: Any]] {
            self.raceDayLeaderboard = lb.compactMap(WatchLeaderboardEntry.init(from:))
        }
        // Training mode flags — were silently ignored before today, so
        // tapping "Start now" on a Library workout left the watch on
        // its tabs view ("watch doesn't lock at all"). Now we apply
        // every training-related field.
        if let active = dict["trainingActive"] as? Bool {
            if active != self.trainingActive {
                self.trainingActive = active
                if !active {
                    self.trainingExercises = []
                    self.trainingCurrentIdx = 0
                    self.trainingCurrentSet = 0
                    self.trainingStartedAt = nil
                }
            }
        }
        if let t = dict["trainingType"] as? String { self.trainingType = t }
        if let t = dict["trainingTitle"] as? String { self.trainingTitle = t }
        if let exs = dict["trainingExercises"] as? [[String: Any]] {
            self.trainingExercises = exs.compactMap(WatchTrainingExercise.init(from:))
        }
        if let idx = dict["trainingCurrentIdx"] as? Int { self.trainingCurrentIdx = idx }
        if let s = dict["trainingCurrentSet"] as? Int { self.trainingCurrentSet = s }
        if let active = dict["raceDayActive"] as? Bool {
            // Only mutate raceDayActive when an explicit value arrives; preserve
            // local laps if the iPhone is just refreshing other state.
            //
            // Activating race-day mode locks the Watch into the race
            // screen but does NOT auto-start a stint — the rider taps
            // Start Stint when they're ready. Deactivating archives any
            // in-flight stint so a coach toggling race-day off doesn't
            // silently throw away the rider's lap data.
            if active != self.raceDayActive {
                self.raceDayActive = active
                if !active {
                    if self.raceDayStartedAt != nil {
                        self.archiveCurrentStint()
                    }
                    self.raceDayLaps.removeAll()
                    self.raceDayStartedAt = nil
                }
            }
        }
        // After ingesting the new state, push a snapshot to the App Group
        // container so the watch face complication can read it. The
        // complication is sandboxed (no Firebase, no WatchConnectivity)
        // so this is its only source of fresh data.
        writeComplicationSnapshot()
    }

    /// Mirror the parts of state the complication needs into the shared
    /// App Group UserDefaults, then ask WidgetKit to redraw all timelines.
    /// Stored as flat key/values (not JSON) so the complication doesn't have
    /// to know about Codable / Date encoding strategies.
    private func writeComplicationSnapshot() {
        guard let defaults = UserDefaults(suiteName: "group.com.403productions.turboprep") else { return }
        let phase = racePhase
        let phaseAccentHex: String = {
            switch phase?.phase {
            case .base?:     return "#3b82f6"
            case .build?:    return "#a855f7"
            case .peak?:     return "#ef4444"
            case .raceWeek?: return "#f97316"
            default:         return "#7a7d88"
            }
        }()
        defaults.set(phase?.label ?? "OFF SEASON",     forKey: "tp_comp_phaseLabel")
        defaults.set(phaseAccentHex,                   forKey: "tp_comp_phaseAccent")
        defaults.set(phase?.daysOut ?? 0,              forKey: "tp_comp_daysOut")
        defaults.set(phase?.raceShortName ?? "—",      forKey: "tp_comp_raceShortName")
        defaults.set(todayWorkouts.filter(\.completed).count, forKey: "tp_comp_todayDoneCount")
        defaults.set(todayWorkouts.count,              forKey: "tp_comp_todayTotalCount")
        defaults.set(Date().timeIntervalSince1970,     forKey: "tp_comp_updatedAt")

        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}

// MARK: - Models (mirror schemas/*.ts and the web app's working shapes)

struct WatchRacePhase: Equatable {
    enum Phase: String { case base, build, peak, raceWeek = "race-week" }
    let phase: Phase
    let label: String
    let description: String
    let raceShortName: String
    let daysOut: Int

    init(phase: Phase, label: String, description: String, raceShortName: String, daysOut: Int) {
        self.phase = phase; self.label = label; self.description = description
        self.raceShortName = raceShortName; self.daysOut = daysOut
    }

    init?(from dict: [String: Any]) {
        guard let phaseStr = dict["phase"] as? String,
              let phase = Phase(rawValue: phaseStr) else { return nil }
        self.phase = phase
        self.label = (dict["label"] as? String) ?? phaseStr.uppercased()
        self.description = (dict["description"] as? String) ?? ""
        self.raceShortName = (dict["raceShortName"] as? String) ?? ""
        self.daysOut = (dict["daysOut"] as? Int) ?? 0
    }

    static let demoPeak = WatchRacePhase(
        phase: .peak,
        label: "PEAK",
        description: "Race-pace intervals. Sharpen your top gear.",
        raceShortName: "Round 2 · Casey Fields",
        daysOut: 21
    )

    static let demoRaceWeek = WatchRacePhase(
        phase: .raceWeek,
        label: "RACE WEEK",
        description: "Keep it light. Stay sharp. Trust your prep.",
        raceShortName: "Round 2 · Casey Fields",
        daysOut: 5
    )
}

struct WatchPlanWorkout: Identifiable, Equatable {
    var id: String { "\(planId)-\(week)-\(day)-\(indexInDay)" }
    let planId: String
    let week: Int
    let day: String          // Mon..Sun
    let indexInDay: Int
    let name: String
    let durationMinutes: Int
    let intensity: String    // "easy" | "moderate" | "hard"
    var completed: Bool

    init(planId: String, week: Int, day: String, indexInDay: Int, name: String, durationMinutes: Int, intensity: String, completed: Bool) {
        self.planId = planId; self.week = week; self.day = day; self.indexInDay = indexInDay
        self.name = name; self.durationMinutes = durationMinutes; self.intensity = intensity
        self.completed = completed
    }

    init?(from dict: [String: Any]) {
        guard let planId = dict["planId"] as? String,
              let week = dict["week"] as? Int,
              let day = dict["day"] as? String,
              let name = dict["name"] as? String else { return nil }
        self.planId = planId
        self.week = week
        self.day = day
        self.indexInDay = (dict["indexInDay"] as? Int) ?? 0
        self.name = name
        self.durationMinutes = (dict["durationMinutes"] as? Int) ?? 0
        self.intensity = (dict["intensity"] as? String) ?? "moderate"
        self.completed = (dict["completed"] as? Bool) ?? false
    }

    static let demoToday: [WatchPlanWorkout] = [
        WatchPlanWorkout(
            planId: "floor-y11-intense",
            week: 2,
            day: "Fri",
            indexInDay: 0,
            name: "Threshold intervals",
            durationMinutes: 35,
            intensity: "hard",
            completed: false
        ),
        WatchPlanWorkout(
            planId: "floor-y11-intense",
            week: 2,
            day: "Fri",
            indexInDay: 1,
            name: "Cool-down spin",
            durationMinutes: 10,
            intensity: "easy",
            completed: false
        )
    ]
}

struct WatchLoggedWorkout: Identifiable, Equatable {
    let id: String
    let name: String
    let durationMinutes: Int
    let date: Date
    let avgHeartRate: Int?
    let source: String?     // "watch" | "tracker" | "strava" | "manual"

    init(id: String, name: String, durationMinutes: Int, date: Date, avgHeartRate: Int?, source: String?) {
        self.id = id; self.name = name; self.durationMinutes = durationMinutes
        self.date = date; self.avgHeartRate = avgHeartRate; self.source = source
    }

    init?(from dict: [String: Any]) {
        guard let id = dict["id"] as? String,
              let name = dict["name"] as? String else { return nil }
        self.id = id
        self.name = name
        self.durationMinutes = (dict["durationMinutes"] as? Int) ?? 0
        if let ts = dict["date"] as? TimeInterval {
            self.date = Date(timeIntervalSince1970: ts)
        } else {
            self.date = Date()
        }
        self.avgHeartRate = dict["avgHeartRate"] as? Int
        self.source = dict["source"] as? String
    }

    static let demoRecent: [WatchLoggedWorkout] = [
        WatchLoggedWorkout(
            id: UUID().uuidString,
            name: "HPV ride",
            durationMinutes: 42,
            date: Date().addingTimeInterval(-86400),
            avgHeartRate: 148,
            source: "watch"
        ),
        WatchLoggedWorkout(
            id: UUID().uuidString,
            name: "Easy spin",
            durationMinutes: 25,
            date: Date().addingTimeInterval(-86400 * 2),
            avgHeartRate: 122,
            source: "tracker"
        ),
        WatchLoggedWorkout(
            id: UUID().uuidString,
            name: "Threshold blocks",
            durationMinutes: 35,
            date: Date().addingTimeInterval(-86400 * 4),
            avgHeartRate: 161,
            source: "watch"
        )
    ]
}

/// One exercise in a phone-pushed training session — surface for the
/// watch's training view so the rider can read what to do without
/// pulling out their phone.
struct WatchTrainingExercise: Identifiable, Equatable {
    let id: String
    let name: String
    let setsTotal: Int
    let repsLabel: String?
    let durationLabel: String?
    let notes: String?

    init(id: String, name: String, setsTotal: Int = 1, repsLabel: String? = nil, durationLabel: String? = nil, notes: String? = nil) {
        self.id = id
        self.name = name
        self.setsTotal = setsTotal
        self.repsLabel = repsLabel
        self.durationLabel = durationLabel
        self.notes = notes
    }

    init?(from dict: [String: Any]) {
        guard let name = dict["name"] as? String else { return nil }
        self.id = (dict["id"] as? String) ?? UUID().uuidString
        self.name = name
        self.setsTotal = (dict["setsTotal"] as? Int) ?? 1
        self.repsLabel = dict["repsLabel"] as? String
        self.durationLabel = dict["durationLabel"] as? String
        self.notes = dict["notes"] as? String
    }
}

struct WatchLap: Identifiable, Equatable, Codable {
    var id: Int { number }
    let number: Int
    let durationSeconds: TimeInterval
    let recordedAt: Date
}

/// A completed stint kept on-watch so the athlete can review laps after
/// finishing — even in standalone mode where there's no iPhone bridge to
/// send the laps to. Persisted in UserDefaults.
struct WatchPastStint: Identifiable, Equatable, Codable {
    let id: UUID
    let startedAt: Date
    let endedAt: Date
    let laps: [WatchLap]
    /// Set once the stint has been pushed to the iPhone successfully (or at
    /// least dispatched via WCSession — we trust the queue if delivery
    /// fails). Lets the Dev tab show "Sync N stints" only when there's
    /// genuinely unsynced data.
    var synced: Bool = false

    var durationSeconds: TimeInterval { endedAt.timeIntervalSince(startedAt) }
    var bestLapSeconds: TimeInterval? { laps.map(\.durationSeconds).min() }
    var avgLapSeconds: TimeInterval? {
        guard !laps.isEmpty else { return nil }
        return laps.map(\.durationSeconds).reduce(0, +) / Double(laps.count)
    }

    enum CodingKeys: String, CodingKey { case id, startedAt, endedAt, laps, synced }

    init(id: UUID, startedAt: Date, endedAt: Date, laps: [WatchLap], synced: Bool = false) {
        self.id = id; self.startedAt = startedAt; self.endedAt = endedAt
        self.laps = laps; self.synced = synced
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        startedAt = try c.decode(Date.self, forKey: .startedAt)
        endedAt = try c.decode(Date.self, forKey: .endedAt)
        laps = try c.decode([WatchLap].self, forKey: .laps)
        synced = (try? c.decode(Bool.self, forKey: .synced)) ?? false
    }
}

struct WatchLeaderboardEntry: Identifiable, Equatable {
    var id: String { uid }
    let rank: Int
    let uid: String
    let displayName: String
    let lapCount: Int
    let bestMs: Int?
    let isMe: Bool

    init?(from dict: [String: Any]) {
        guard let uid = dict["uid"] as? String,
              let rank = dict["rank"] as? Int else { return nil }
        self.uid = uid
        self.rank = rank
        self.displayName = (dict["displayName"] as? String) ?? uid
        self.lapCount = (dict["lapCount"] as? Int) ?? 0
        self.bestMs = dict["bestMs"] as? Int
        self.isMe = (dict["isMe"] as? Bool) ?? false
    }
}
