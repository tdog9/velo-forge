import Foundation
import FirebaseAuth
import FirebaseFirestore

/// iPhone-side bridge for messages arriving from the Watch via WatchConnectivity.
///
/// Workouts route through the web (`window.tpNative.onWatchWorkout`) because
/// the user is signed in to Firebase via the web JS SDK — the native
/// `Auth.auth().currentUser` is typically nil (keychain auth-sharing
/// requires paid-team signing), so writing via native Firestore drops
/// the workout at the auth gate. The web's signed-in Firestore SDK
/// writes under the correct uid and benefits from indexedDB offline
/// persistence + automatic retry.
///
/// All other Watch payloads (race-day laps, health summary, training
/// session end) already use the same JS-relay pattern.
@MainActor
enum WatchWorkoutReceiver {
    /// Set by WebViewContainer once `didFinish` fires so race-day payloads
    /// can be relayed into the web app's JS context.
    static var jsRelay: (([String: Any]) -> Void)?
    /// Set by WebViewContainer for health-summary forwarding into web.
    static var jsHealthRelay: (([String: Any]) -> Void)?
    /// Set by WebViewContainer for training-session-end forwarding into web.
    static var jsTrainingRelay: (([String: Any]) -> Void)?
    /// Set by WebViewContainer for workout forwarding into web. Primary
    /// path — uses the web's signed-in Firestore. Native fallback only
    /// fires if the web hasn't loaded yet (cold-boot race) AND a native
    /// auth user exists, which is rare.
    static var jsWorkoutRelay: (([String: Any]) -> Void)?

    static func install() {
        ConnectivityService.shared.onWorkoutReceived = { payload in
            // Preferred path: route to web via JS bridge — web SDK is
            // signed in, has offline persistence, retries automatically.
            if let relay = jsWorkoutRelay {
                relay(payload.toDictionary())
            } else {
                // Fallback: web not loaded yet. Try native write if
                // native auth happens to have a user; otherwise drop
                // with a clear log (the next watch sync after web loads
                // will route correctly).
                persistNative(payload)
            }
        }
        ConnectivityService.shared.onRaceDayLapsReceived = { laps in
            jsRelay?(laps)
        }
        ConnectivityService.shared.onHealthSummaryReceived = { summary in
            jsHealthRelay?(summary)
        }
        ConnectivityService.shared.onTrainingSessionEndReceived = { payload in
            jsTrainingRelay?(payload)
        }
    }

    /// Native Firestore fallback. Only used when the web hasn't loaded
    /// at the time the Watch sends a workout (cold-boot race condition).
    /// Most users sign in via the web — `Auth.auth().currentUser` is
    /// usually nil and this path drops the workout with a clear log.
    private static func persistNative(_ payload: WorkoutPayload) {
        guard let uid = Auth.auth().currentUser?.uid else {
            print("⚠️ Watch workout received before web loaded AND no native auth user — payload buffered? No. Dropping.")
            print("   payload: \(payload.toDictionary().keys.sorted())")
            print("   This is the 'workout vanished' bug. Web auth must be loaded BEFORE the Watch sends.")
            return
        }
        let workout = payload.toWorkout()
        Firestore.firestore()
            .collection("users").document(uid)
            .collection("workouts").document(workout.id)
            .setData(workout.toFirestoreData()) { error in
                if let error {
                    print("⚠️ Native Watch workout save failed: \(error.localizedDescription)")
                } else {
                    print("✓ Native Watch workout saved \(workout.id) (rare path)")
                }
            }
    }
}
