import Foundation
import FirebaseAuth
import FirebaseFirestore

/// iPhone-side bridge: receives WorkoutPayloads forwarded by the Watch via
/// ConnectivityService and writes them to `users/{uid}/workouts/{autoId}`.
/// Idempotent — safe to call install() multiple times; the latest closure
/// wins.
@MainActor
enum WatchWorkoutReceiver {
    static func install() {
        ConnectivityService.shared.onWorkoutReceived = { payload in
            persist(payload)
        }
    }

    private static func persist(_ payload: WorkoutPayload) {
        guard let uid = Auth.auth().currentUser?.uid else {
            print("⚠️ Watch workout received but no signed-in user — dropping.")
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
