import Foundation
import FirebaseAuth

@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var currentUser: User?
    @Published private(set) var isAuthenticating = false
    @Published var lastError: String?

    private var handle: AuthStateDidChangeListenerHandle?

    init() {
        self.currentUser = Auth.auth().currentUser
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor [weak self] in
                self?.currentUser = user
            }
        }
    }

    deinit {
        if let handle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    func signIn(email: String, password: String) async {
        isAuthenticating = true
        lastError = nil
        do {
            _ = try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            lastError = error.localizedDescription
        }
        isAuthenticating = false
    }

    func signOut() {
        try? Auth.auth().signOut()
    }
}
