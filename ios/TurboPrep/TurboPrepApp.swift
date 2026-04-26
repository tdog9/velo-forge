import SwiftUI
import UIKit

@main
struct TurboPrepApp: App {
    @StateObject private var auth = AuthService()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

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
                    await NotificationService.flushPendingToken()
                }
        }
    }
}

/// Routes APNs callbacks into NotificationService. Activated automatically
/// when @UIApplicationDelegateAdaptor adopts it.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            await NotificationService.handleRegistration(token: deviceToken)
        }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            NotificationService.handleRegistrationError(error)
        }
    }
}
