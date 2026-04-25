import Foundation
import WatchConnectivity

/// WatchConnectivity wrapper used by both the iPhone and Watch apps.
///
/// Watch side: call `sendWorkout(_:)` to transmit a finished workout. Tries
/// the live `sendMessage` first (instant when iPhone is foreground), falls
/// back to `transferUserInfo` (queued, delivered when iPhone wakes up).
///
/// iPhone side: assign `onWorkoutReceived` to a closure that persists the
/// payload to Firestore. The closure runs on the main actor.
@MainActor
final class ConnectivityService: NSObject, ObservableObject {
    static let shared = ConnectivityService()

    @Published private(set) var isReachable = false
    @Published private(set) var activationState: WCSessionActivationState = .notActivated

    /// iPhone-only: invoked when a workout payload arrives from the Watch.
    var onWorkoutReceived: ((WorkoutPayload) -> Void)?
    /// iPhone-only: invoked when the Watch reports race-day laps.
    var onRaceDayLapsReceived: (([String: Any]) -> Void)?
    /// Watch-only: invoked when the iPhone pushes a fresh state snapshot.
    var onStateSnapshotReceived: (([String: Any]) -> Void)?

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    func sendWorkout(_ payload: WorkoutPayload) {
        send(["payload": "workout", "data": payload.toDictionary()])
    }

    /// iPhone → Watch: push the latest state snapshot using
    /// updateApplicationContext so the Watch wakes up to it next launch
    /// even if we weren't reachable when it was sent.
    func pushStateToWatch(_ snapshot: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else { s.activate(); return }
        let payload: [String: Any] = ["payload": "state", "data": snapshot]
        do {
            try s.updateApplicationContext(payload)
        } catch {
            // Fallback: try a live message if the context call fails.
            if s.isReachable {
                s.sendMessage(payload, replyHandler: nil, errorHandler: nil)
            }
        }
    }

    /// Watch → iPhone: send race-day lap data when the athlete ends a stint.
    func sendRaceDayLaps(_ laps: [String: Any]) {
        send(["payload": "raceDayLaps", "data": laps])
    }

    private func send(_ dict: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else { s.activate(); return }
        if s.isReachable {
            s.sendMessage(dict, replyHandler: nil) { _ in
                s.transferUserInfo(dict)
            }
        } else {
            s.transferUserInfo(dict)
        }
    }
}

extension ConnectivityService: WCSessionDelegate {
    nonisolated func session(_ session: WCSession,
                             activationDidCompleteWith state: WCSessionActivationState,
                             error: Error?) {
        let reachable = session.isReachable
        Task { @MainActor [weak self] in
            self?.activationState = state
            self?.isReachable = reachable
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor [weak self] in
            self?.isReachable = reachable
        }
    }

    #if os(iOS)
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate so we keep receiving messages from the Watch.
        WCSession.default.activate()
    }
    #endif

    nonisolated func session(_ session: WCSession,
                             didReceiveMessage message: [String: Any]) {
        Task { @MainActor [weak self] in self?.routeIncoming(message) }
    }

    nonisolated func session(_ session: WCSession,
                             didReceiveUserInfo userInfo: [String: Any] = [:]) {
        Task { @MainActor [weak self] in self?.routeIncoming(userInfo) }
    }

    nonisolated func session(_ session: WCSession,
                             didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor [weak self] in self?.routeIncoming(applicationContext) }
    }

    @MainActor
    private func routeIncoming(_ dict: [String: Any]) {
        // Legacy path: messages with no "payload" tag are treated as workouts
        // (kept so older Watch builds in the wild still talk to a new iPhone).
        guard let kind = dict["payload"] as? String else {
            if let workout = WorkoutPayload(from: dict) {
                onWorkoutReceived?(workout)
            }
            return
        }
        let body = (dict["data"] as? [String: Any]) ?? [:]
        switch kind {
        case "workout":
            if let workout = WorkoutPayload(from: body) {
                onWorkoutReceived?(workout)
            }
        case "state":
            onStateSnapshotReceived?(body)
        case "raceDayLaps":
            onRaceDayLapsReceived?(body)
        default:
            break
        }
    }
}
