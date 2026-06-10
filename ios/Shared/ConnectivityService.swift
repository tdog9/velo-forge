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
    /// iPhone-only: invoked when the Watch finishes a training session.
    var onTrainingSessionEndReceived: (([String: Any]) -> Void)?
    /// Watch-only: invoked when the iPhone pushes a fresh state snapshot.
    var onStateSnapshotReceived: (([String: Any]) -> Void)?
    /// iPhone-side: called when the Watch sends a "requestSnapshot" ping
    /// (e.g. user tapped Refresh on the Watch sign-in gate). The iPhone
    /// should respond by re-pushing its current state via the
    /// applicationContext / userInfo path.
    var onSnapshotRequested: (() -> Void)?
    /// iPhone-side: called when the Watch submits a pair-code attempt.
    /// `body` contains `{ code: "123456" }`. iPhone should hand the
    /// code to the web, which validates against localStorage and on
    /// match pushes a fresh state snapshot back to the Watch.
    var onWatchPairAttempt: (([String: Any]) -> Void)?

    /// Watch → iPhone: latest Watch battery snapshot (rec #50). `body`
    /// contains `{ level: 0.0-1.0, state: Int }` where state is the
    /// WKInterfaceDeviceBatteryState raw value. iPhone forwards into
    /// the web via the tpNative bridge.
    var onWatchBatteryReceived: (([String: Any]) -> Void)?

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

    /// iPhone → Watch: push the latest state snapshot.
    ///
    /// Two-path delivery:
    ///   • `updateApplicationContext` — "latest-wins" key/value blob.
    ///     Best for high-frequency render-triggered state where we
    ///     only care about the most recent value (plan progress, race
    ///     phase, weather). Always tried first.
    ///   • `transferUserInfo` — FIFO queue, guaranteed delivery, persists
    ///     across watch app launches. Triggered ADDITIONALLY when the
    ///     snapshot carries a critical state change like training
    ///     start/end or race-day toggle, so a quick follow-up render
    ///     can't overwrite the trigger before the watch sees it.
    ///
    /// This fixes the "started training on phone but watch didn't
    /// enter training mode" complaint — those events now ride the
    /// guaranteed channel even when reachability is flaky.
    func pushStateToWatch(_ snapshot: [String: Any]) {
        guard WCSession.isSupported() else {
            print("📲 [WC] WCSession not supported — skip pushStateToWatch")
            return
        }
        let s = WCSession.default
        guard s.activationState == .activated else {
            print("📲 [WC] session not activated yet (state \(s.activationState.rawValue)); buffering snapshot for flush")
            // Latest-wins: replace any earlier pending snapshot. The web
            // app's pushWatchState calls always send the FULL current
            // state, so a newer snapshot fully supersedes an older one.
            pendingSnapshot = snapshot
            s.activate()
            return
        }
        let payload: [String: Any] = ["payload": "state", "data": snapshot]

        // 1. Always try the latest-wins context push first (cheap, fast).
        do {
            try s.updateApplicationContext(payload)
            print("📲 [WC] pushStateToWatch via applicationContext OK (reachable=\(s.isReachable))")
        } catch {
            print("📲 [WC] applicationContext failed: \(error.localizedDescription); falling back")
            if s.isReachable {
                s.sendMessage(payload, replyHandler: nil) { err in
                    print("📲 [WC] sendMessage fallback also failed: \(err.localizedDescription)")
                }
            }
        }

        // 2. If the snapshot carries a critical change, ALSO enqueue via
        // transferUserInfo so the watch is guaranteed to see it even
        // if another applicationContext write overwrites step 1 before
        // delivery. Detected via specific keys in the snapshot.
        let isCritical = (snapshot["trainingActive"] != nil)
            || (snapshot["raceDayActive"] != nil)
            || (snapshot["teamTrainingCue"] != nil)
        if isCritical {
            s.transferUserInfo(payload)
            print("📲 [WC] critical state — also queued via transferUserInfo")
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

    /// Watch → iPhone: training session ended. iPhone routes to the web
    /// which writes users/{uid}/training_sessions/{id}.
    func sendTrainingSessionEnd(_ payload: [String: Any]) {
        send(["payload": "trainingSessionEnd", "data": payload])
    }

    /// Watch → iPhone: current Watch battery level (rec #50). iPhone
    /// surfaces this in the race-day overlay so the pit crew knows
    /// whether to swap the Watch before the next stint.
    func sendWatchBattery(level: Float, state: Int) {
        send(["payload": "watchBattery", "data": ["level": level, "state": state]])
    }

    /// Snapshot waiting to be pushed once WCSession finishes activating.
    /// On a cold launch the very first state push from the web app fires
    /// before `activationDidCompleteWith` returns — without a buffer the
    /// snapshot was dropped on the floor, which manifested as "I signed
    /// in but the Watch still shows the sign-in gate". Single-slot
    /// because pushStateToWatch is latest-wins by design.
    private var pendingSnapshot: [String: Any]?

    private func flushPendingSnapshot() {
        guard let pending = pendingSnapshot else { return }
        pendingSnapshot = nil
        pushStateToWatch(pending)
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
        // Always queue durably via transferUserInfo first — even when
        // the session is reachable. The previous flow tried sendMessage
        // for fast delivery and reported `onSent(true)` synchronously
        // *before* the errorHandler had a chance to fire, so failures
        // marked stints as synced when nothing actually shipped. Now:
        // transferUserInfo is the source of truth (durable queue,
        // delivered when the iPhone wakes), and sendMessage is a
        // best-effort optimistic delivery on top of that. Either way,
        // `onSent(true)` only fires when at least the durable queue
        // has accepted the payload.
        s.transferUserInfo(dict)
        if s.isReachable {
            // Best-effort fast path. We don't ack the caller from
            // here — the durable queue already did.
            s.sendMessage(dict, replyHandler: nil) { _ in /* swallow; durable queue covers it */ }
        }
        if let onSent { Task { @MainActor in onSent(true) } }
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
            // Drain any snapshot that was buffered while activation was
            // still pending — fixes the cold-launch race where the very
            // first state push (typically the signed-in flip) used to
            // disappear because pushStateToWatch early-returned on a
            // not-yet-activated session.
            if state == .activated {
                self?.flushPendingSnapshot()
            }
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
        case "trainingSessionEnd":
            onTrainingSessionEndReceived?(body)
        case "requestSnapshot":
            onSnapshotRequested?()
        case "watchPairAttempt":
            onWatchPairAttempt?(body)
        case "watchBattery":
            onWatchBatteryReceived?(body)
        default:
            break
        }
    }

    /// Watch-side: ask the iPhone to re-push its current state. Used by
    /// the Watch sign-in gate's Refresh button when iPhoneSignedIn is
    /// false and the user wants to retry pulling auth state.
    func requestSnapshot() {
        send(["payload": "requestSnapshot", "data": [:] as [String: Any]])
    }

    /// Watch-side: submit the 6-digit pairing code the user typed on
    /// the sign-in gate. iPhone validates against the code stored in
    /// the web's localStorage and, on match, pushes a fresh state
    /// snapshot back over WCSession to dismiss the gate.
    func sendPairAttempt(code: String) {
        send(["payload": "watchPairAttempt", "data": ["code": code] as [String: Any]])
    }
}
