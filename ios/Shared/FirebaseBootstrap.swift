import Foundation
import FirebaseCore
import FirebaseAuth

// Configures Firebase once per process. Guards against the missing-plist
// crash so the scaffold still boots when GoogleService-Info.plist hasn't
// been dropped in yet — the first sign-in attempt will show a clear error.
//
// Also opts Firebase Auth into a shared Keychain Access Group so signing in
// on iPhone propagates to the paired Watch automatically. Both targets
// declare keychain-access-groups = $(AppIdentifierPrefix)com.tdog9.veloforge
// in their .entitlements file. Firebase prepends the AppIdentifierPrefix at
// runtime, so we pass just the bundle identifier here.
enum FirebaseBootstrap {
    private static let sharedAccessGroup = "com.tdog9.veloforge"
    private static var configured = false

    static func configure() {
        guard !configured else { return }
        guard Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil else {
            print("⚠️ GoogleService-Info.plist not found in bundle — Firebase not configured.")
            return
        }
        FirebaseApp.configure()
        do {
            try Auth.auth().useUserAccessGroup(sharedAccessGroup)
        } catch {
            // Non-fatal — auth still works, just won't sync iPhone↔Watch via keychain.
            // Most likely on simulator without a signing team configured.
            print("⚠️ Firebase Auth keychain sharing not enabled: \(error.localizedDescription)")
        }
        configured = true
    }
}
