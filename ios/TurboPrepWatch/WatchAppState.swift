import Foundation
import Combine

/// Single source of truth for the Watch UI. Mirrors the slices of state the
/// web app exposes on iPhone: race phase, today's plan items, recent
/// completed workouts, race-day status. Today this is seeded with mock data
/// so the Watch UI is fully usable; wiring real data flows from iPhone via
/// ConnectivityService is the next milestone.
@MainActor
final class WatchAppState: ObservableObject {
    static let shared = WatchAppState()

    @Published var racePhase: WatchRacePhase? = .demoTaper
    @Published var todayWorkouts: [WatchPlanWorkout] = WatchPlanWorkout.demoToday
    @Published var completedWorkouts: [WatchLoggedWorkout] = WatchLoggedWorkout.demoRecent

    /// Race-day live state. When `active`, the Record tab swaps to a lap
    /// timer; the iPhone's race-day controller is the authority and pushes
    /// this state to the Watch.
    @Published var raceDayActive: Bool = false
    @Published var raceDayLaps: [WatchLap] = []
    @Published var raceDayStartedAt: Date?

    private init() {}

    /// Simulator/dev convenience — flip race-day mode without the iPhone bridge.
    func toggleRaceDayForDev() {
        if raceDayActive {
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

    func markPlanWorkoutDone(_ workout: WatchPlanWorkout) {
        guard let idx = todayWorkouts.firstIndex(where: { $0.id == workout.id }) else { return }
        todayWorkouts[idx].completed = true
    }
}

// MARK: - Models (mirror schemas/*.ts and the web app's working shapes)

struct WatchRacePhase: Equatable {
    enum Phase: String { case base, build, peak, taper, raceWeek }
    let phase: Phase
    let label: String
    let description: String
    let raceShortName: String
    let daysOut: Int

    static let demoTaper = WatchRacePhase(
        phase: .taper,
        label: "TAPER",
        description: "Back off volume — your body absorbs the work now.",
        raceShortName: "Round 2 · Casey Fields",
        daysOut: 8
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

struct WatchLap: Identifiable, Equatable {
    var id: Int { number }
    let number: Int
    let durationSeconds: TimeInterval
    let recordedAt: Date
}
