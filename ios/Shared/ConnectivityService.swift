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
    /// iPhone-only: invoked when the Watch reports its HealthKit summary.
    var onHealthSummaryReceived: (([String: Any]) -> Void)?
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
        guard WCSession.isSupported() else {
            print("📲 [WC] WCSession not supported — skip pushStateToWatch")
            return
        }
        let s = WCSession.default
        guard s.activationState == .activated else {
            print("📲 [WC] session not activated yet (state \(s.activationState.rawValue)); reactivating")
            s.activate()
            return
        }
        let payload: [String: Any] = ["payload": "state", "data": snapshot]
        do {
            try s.updateApplicationContext(payload)
            print("📲 [WC] pushStateToWatch via applicationContext OK (reachable=\(s.isReachable))")
        } catch {
            print("📲 [WC] applicationContext failed: \(error.localizedDescription); falling back")
            if s.isReachable {
                s.sendMessage(payload, replyHandler: nil) { err in
                    print("📲 [WC] sendMessage fallback also failed: \(err.localizedDescription)")
                }
            } else {
                s.transferUserInfo(payload)
                print("📲 [WC] queued via transferUserInfo")
            }
        }
    }

    /// Watch → iPhone: send race-day lap data when the athlete ends a stint.
    /// `onSent` reports whether WCSession accepted the dispatch (true = sent
    /// or queued via transferUserInfo). Use this to avoid marking a stint
    /// "synced" before delivery is at least in flight.
    func sendRaceDayLaps(_ laps: [String: Any], onSent: (@MainActor (Bool) -> Void)? = nil) {
        send(["payload": "raceDayLaps", "data": laps], onSent: onSent)
    }

    /// Watch → iPhone: push a HealthKit summary (HR, steps, energy, sleep)
    /// so the iPhone can update the web app's userProfile.health.
    func sendHealthSummary(_ summary: [String: Any]) {
        send(["payload": "healthSummary", "data": summary])
    }

    private func send(_ dict: [String: Any], onSent: (@MainActor (Bool) -> Void)? = nil) {
        guard WCSession.isSupported() else {
            if let onSent { Task { @MainActor in onSent(false) } }
            return
        }
        let s = WCSession.default
        guard s.activationState == .activated else {
            s.activate()
            // We don't know yet if delivery will succeed — report pessimistically
            // so the caller doesn't mark synced.
            if let onSent { Task { @MainActor in onSent(false) } }
            return
        }
        if s.isReachable {
            s.sendMessage(dict, replyHandler: nil) { _ in
                // sendMessage failed — fall back to transferUserInfo (durable
                // queue). Either way the payload is at least in flight.
                s.transferUserInfo(dict)
                if let onSent { Task { @MainActor in onSent(true) } }
            }
            // If sendMessage didn't error in the synchronous setup path,
            // optimistically mark dispatched. The errorHandler above will
            // override if the actual transmission failed.
            if let onSent { Task { @MainActor in onSent(true) } }
        } else {
            s.transferUserInfo(dict)
            if let onSent { Task { @MainActor in onSent(true) } }
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
        let kind = (dict["payload"] as? String) ?? "(legacy)"
        print("📲 [WC] received payload=\(kind), keys=\(dict.keys.sorted())")
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
        case "healthSummary":
            onHealthSummaryReceived?(body)
        default:
            break
        }
    }
}
