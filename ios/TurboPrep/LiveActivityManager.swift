import Foundation
import ActivityKit

/// Thin wrapper around ActivityKit so the WebViewContainer bridge
/// can start / update / end the stint Live Activity in response to
/// race-day messages from the web app.
///
/// Single in-flight activity at a time — start replaces any prior.
/// Updates are no-ops when no activity is live (the web side fires
/// updates aggressively; we just drop them when nothing's running).
@available(iOS 16.2, *)
@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    private var current: Activity<StintActivityAttributes>?

    /// Start a new stint Live Activity. Idempotent: ends any prior
    /// before starting a new one. Silently no-ops if the user has
    /// disabled live activities in Settings.
    func startStint(raceName: String, riderName: String, startedAt: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            print("⛔️ [LiveActivity] disabled in Settings — skipping start")
            return
        }
        // Tear down any orphan from a prior stint that didn't end cleanly.
        Task { await endAll() }
        let attrs = StintActivityAttributes(raceName: raceName, riderName: riderName)
        let initial = StintActivityAttributes.State(
            lapCount: 0, pitCount: 0, lastLapMs: nil, bestLapMs: nil,
            stintStartedAt: startedAt
        )
        do {
            let activity = try Activity<StintActivityAttributes>.request(
                attributes: attrs,
                content: .init(state: initial, staleDate: nil),
                pushType: nil
            )
            current = activity
            print("✅ [LiveActivity] started stint id=\(activity.id)")
        } catch {
            print("❌ [LiveActivity] start failed: \(error)")
        }
    }

    /// Update the in-flight activity with new lap / pit counts +
    /// best-lap. Silently no-ops if nothing is live. Preserves the
    /// original `stintStartedAt` so SwiftUI's Text(timerInterval:)
    /// keeps ticking from the actual start time, not from each update.
    func updateStint(lapCount: Int, pitCount: Int, lastLapMs: Int?, bestLapMs: Int?) {
        guard let act = current else { return }
        let next = StintActivityAttributes.State(
            lapCount: lapCount,
            pitCount: pitCount,
            lastLapMs: lastLapMs,
            bestLapMs: bestLapMs,
            stintStartedAt: act.content.state.stintStartedAt
        )
        Task {
            await act.update(.init(state: next, staleDate: nil))
        }
    }

    /// End the current activity. Removes the lock-screen banner +
    /// Dynamic Island presence immediately.
    func endStint() {
        guard let act = current else { return }
        let final = act.content.state
        Task {
            await act.end(.init(state: final, staleDate: nil), dismissalPolicy: .immediate)
        }
        current = nil
    }

    /// Belt-and-braces — clear every TurboPrep stint activity, even
    /// orphans from a prior process.
    func endAll() async {
        for activity in Activity<StintActivityAttributes>.activities {
            await activity.end(.init(state: activity.content.state, staleDate: nil), dismissalPolicy: .immediate)
        }
        current = nil
    }
}
