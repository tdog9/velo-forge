import SwiftUI

@main
struct TurboPrepApp: App {
    @StateObject private var auth = AuthService()

    init() {
        FirebaseBootstrap.configure()
        // Touch the connectivity singleton so its WCSession activates as the
        // app launches (delegate methods need the session live before the
        // Watch tries to send any workout payloads).
        _ = ConnectivityService.shared
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .task {
                    WatchWorkoutReceiver.install()
                }
        }
    }
}
