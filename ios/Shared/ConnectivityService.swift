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

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    func sendWorkout(_ payload: WorkoutPayload) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated else {
            s.activate()
            return
        }
        let dict = payload.toDictionary()
        if s.isReachable {
            s.sendMessage(dict, replyHandler: nil) { _ in
                // Live delivery failed — queue via transferUserInfo so the
                // payload still lands when the iPhone next wakes the app.
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
        guard let payload = WorkoutPayload(from: message) else { return }
        Task { @MainActor [weak self] in
            self?.onWorkoutReceived?(payload)
        }
    }

    nonisolated func session(_ session: WCSession,
                             didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let payload = WorkoutPayload(from: userInfo) else { return }
        Task { @MainActor [weak self] in
            self?.onWorkoutReceived?(payload)
        }
    }
}
