import Foundation
import FirebaseAuth
import FirebaseFirestore

/// iPhone-side bridge for messages arriving from the Watch via WatchConnectivity.
/// - Workout payloads → write to `users/{uid}/workouts/{autoId}` in Firestore.
/// - Race-day lap payloads → forward to the web app (which owns the race-day
///   stints model) by evaluating a JS handler inside the WebView.
@MainActor
enum WatchWorkoutReceiver {
    /// Set by WebViewContainer once `didFinish` fires so race-day payloads
    /// can be relayed into the web app's JS context.
    static var jsRelay: (([String: Any]) -> Void)?
    /// Set by WebViewContainer for health-summary forwarding into web.
    static var jsHealthRelay: (([String: Any]) -> Void)?

    static func install() {
        ConnectivityService.shared.onWorkoutReceived = { payload in
            persist(payload)
        }
        ConnectivityService.shared.onRaceDayLapsReceived = { laps in
            jsRelay?(laps)
        }
        ConnectivityService.shared.onHealthSummaryReceived = { summary in
            jsHealthRelay?(summary)
        }
    }

    private static func persist(_ payload: WorkoutPayload) {
        guard let uid = Auth.auth().currentUser?.uid else {
            print("⚠️ Watch workout received but no native signed-in user — dropping. " +
                  "(Sign-in flows through the WebView; native AuthService isn't holding a user yet.)")
            return
        }
        let workout = payload.toWorkout()
        Firestore.firestore()
            .collection("users").document(uid)
            .collection("workouts").document(workout.id)
            .setData(workout.toFirestoreData()) { error in
                if let error {
                    print("⚠️ Watch workout save failed: \(error.localizedDescription)")
                }
            }
    }
}
