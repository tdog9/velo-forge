import Foundation
import FirebaseCore

// Configures Firebase once per process. Guards against the missing-plist
// crash so the scaffold still boots when GoogleService-Info.plist hasn't
// been dropped in yet — the first sign-in attempt will show a clear error.
enum FirebaseBootstrap {
    private static var configured = false
    static func configure() {
        guard !configured else { return }
        guard Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil else {
            print("⚠️ GoogleService-Info.plist not found in bundle — Firebase not configured.")
            return
        }
        FirebaseApp.configure()
        configured = true
    }
}
