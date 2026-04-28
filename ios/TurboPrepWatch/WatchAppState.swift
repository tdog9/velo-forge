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

    @Published var racePhase: WatchRacePhase? = .demoPeak
    @Published var todayWorkouts: [WatchPlanWorkout] = WatchPlanWorkout.demoToday
    @Published var completedWorkouts: [WatchLoggedWorkout] = WatchLoggedWorkout.demoRecent

    /// Race-day live state. When `active`, the Record tab swaps to a lap
    /// timer; the iPhone's race-day controller is the authority and pushes
    /// this state to the Watch.
    @Published var raceDayActive: Bool = false { didSet { scheduleRaceDaySave() } }
    @Published var raceDayLaps: [WatchLap] = [] { didSet { scheduleRaceDaySave() } }
    @Published var raceDayStartedAt: Date? { didSet { scheduleRaceDaySave() } }
    @Published var raceDayLeaderboard: [WatchLeaderboardEntry] = []

    /// Finished stints kept on the Watch so the athlete can review laps
    /// after the test — survives app restart via UserDefaults. Newest first.
    @Published var pastStints: [WatchPastStint] = []
    /// iPhone-side auth state mirrored into the Watch. The Watch can't read
    /// Firebase Firestore directly (no watchOS support) and keychain auth
    /// sharing requires paid-team signing, so the iPhone is the source of
    /// truth for "is the user signed in" via the WatchConnectivity bridge.
    @Published var iPhoneSignedIn: Bool = false
    @Published var iPhoneUserEmail: String?
    @Published var iPhoneUserDisplayName: String?

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

    /// Long-press the wordmark — start or end a race-day stint locally.
    /// Ending records the stint into pastStints (keeps lap data for review)
    /// rather than wiping it.
    func toggleRaceDayForDev() {
        if raceDayActive {
            archiveCurrentStint()
            raceDayActive = false
            raceDayStartedAt = nil
            raceDayLaps.removeAll()
        } else {
            raceDayActive = true
            raceDayStartedAt = Date()
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
        if let active = dict["raceDayActive"] as? Bool {
            // Only mutate raceDayActive when an explicit value arrives; preserve
            // local laps if the iPhone is just refreshing other state.
            if active != self.raceDayActive {
                self.raceDayActive = active
                if active {
                    self.raceDayStartedAt = Date()
                    self.raceDayLaps.removeAll()
                } else {
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
