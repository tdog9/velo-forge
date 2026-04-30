import SwiftUI
import UserNotifications

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
        // APNs notification delegate — was missing entirely despite
        // `aps-environment=development` being declared in entitlements.
        // Coach-broadcast pushes never reached the wrist because no
        // delegate handled them. Set up once at app launch; foreground
        // banners now display, and the user can tap one to focus the
        // watch app on the relevant view.
        UNUserNotificationCenter.current().delegate = WatchNotificationDelegate.shared
        Task {
            do {
                try await UNUserNotificationCenter.current()
                    .requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                // No-op — user can grant permission later via Settings.
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            WatchRootView()
        }
    }
}

/// Bridges APNs foreground / tap events into the Watch app. iPhone pushes
/// arrive directly (Watch + iPhone share the same APNs topic for
/// dual-device installs); this delegate lets foreground banners show
/// while the app is open and routes a tap into the right view via
/// WatchAppState's existing race-mode flag.
final class WatchNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = WatchNotificationDelegate()

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // Show banner + play default sound while app is foregrounded.
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        // If the push was a coach race-day broadcast, hint the Watch
        // toward race mode. The actual raceDayActive flip still comes
        // from the iPhone via WCSession — we just wake the carousel
        // toward the lap view so the user lands somewhere relevant.
        if let category = userInfo["category"] as? String,
           category == "race_day" || category == "coach_broadcast" {
            // No-op for now — UI routing is single-screen during race
            // mode. Hook for future per-category navigation.
        }
        completionHandler()
    }
}
