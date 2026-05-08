import Foundation
import ActivityKit

/// Live Activity payload for an in-flight race-day stint. Static
/// attributes don't change after the activity starts; ContentState
/// is what we update each tick from the web app via the bridge.
///
/// Used by both the iOS app (LiveActivityManager) to start/update
/// activities and by the Widget Extension to render the lock-screen
/// + Dynamic Island UI.
@available(iOS 16.1, *)
struct StintActivityAttributes: ActivityAttributes {
    public typealias ContentState = State

    public struct State: Codable, Hashable {
        var lapCount: Int
        var pitCount: Int
        var lastLapMs: Int?
        var bestLapMs: Int?
        /// When the stint started (iOS local time). Used by the widget
        /// to render an auto-ticking elapsed timer without needing the
        /// host app to push every second of updates.
        var stintStartedAt: Date

        public init(lapCount: Int = 0, pitCount: Int = 0, lastLapMs: Int? = nil, bestLapMs: Int? = nil, stintStartedAt: Date = Date()) {
            self.lapCount = lapCount
            self.pitCount = pitCount
            self.lastLapMs = lastLapMs
            self.bestLapMs = bestLapMs
            self.stintStartedAt = stintStartedAt
        }
    }

    /// Race name (e.g. "Round 2 · Casey Fields"). Stays constant
    /// across the activity's lifetime.
    var raceName: String
    /// Driver's display name. Same: constant.
    var riderName: String

    public init(raceName: String, riderName: String) {
        self.raceName = raceName
        self.riderName = riderName
    }
}

/// Format helper shared between widget + manager — renders a lap time
/// (milliseconds) as a compact "1:23.45" / "23.45s" string.
@available(iOS 16.1, *)
public enum StintActivityFormat {
    public static func lapTime(_ ms: Int?) -> String {
        guard let ms = ms, ms > 0 else { return "—" }
        let m = ms / 60_000
        let s = (ms % 60_000) / 1000
        let cs = (ms % 1000) / 10
        if m > 0 {
            return String(format: "%d:%02d.%02d", m, s, cs)
        }
        return String(format: "%d.%02ds", s, cs)
    }
}
