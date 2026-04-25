import SwiftUI

@main
struct TurboPrepWatchApp: App {
    @StateObject private var auth = AuthService()

    init() {
        FirebaseBootstrap.configure()
        // Wire iPhone-pushed state into WatchAppState. Connectivity service
        // delivers via main-actor; reach in directly.
        ConnectivityService.shared.onStateSnapshotReceived = { snapshot in
            WatchAppState.shared.applyRemoteSnapshot(snapshot)
        }
    }

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(auth)
        }
    }
}
