import SwiftUI

@main
struct TurboPrepWatchApp: App {
    // AuthService was previously instantiated and injected, but no
    // Watch view ever consumed it — keychain auth-sharing requires
    // paid-team signing, so the iPhone is the source of truth for
    // sign-in via WatchConnectivity. Removing the dead injection.

    init() {
        FirebaseBootstrap.configure()
        // Wire iPhone-pushed state into WatchAppState. Connectivity service
        // delivers via main-actor; reach in directly.
        ConnectivityService.shared.onStateSnapshotReceived = { snapshot in
            WatchAppState.shared.applyRemoteSnapshot(snapshot)
        }
        // Race-day state — iPhone-independent fallback. Polls
        // /race-day-public every 15s so the Watch flips into
        // race-day mode the moment a coach activates it on the web,
        // without needing WCSession to be reachable.
        Task { @MainActor in WatchRaceDayPoller.shared.start() }
    }

    var body: some Scene {
        WindowGroup {
            WatchRootView()
        }
    }
}
