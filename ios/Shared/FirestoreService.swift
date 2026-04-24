import Foundation
import FirebaseFirestore

@MainActor
final class FirestoreService: ObservableObject {
    @Published var profile: UserProfile?
    @Published var lastError: String?

    private let db = Firestore.firestore()

    func loadProfile(uid: String) async {
        lastError = nil
        do {
            let snapshot = try await db.collection("users").document(uid).getDocument()
            if let data = snapshot.data() {
                profile = UserProfile(from: data, id: uid)
            } else {
                profile = UserProfile(id: uid)
            }
        } catch {
            lastError = error.localizedDescription
        }
    }
}
