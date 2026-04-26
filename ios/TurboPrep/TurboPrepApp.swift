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
                    // Prompt for push permission once at launch — system
                    // remembers the answer so re-prompting on every launch
                    // is safe (no double-sheet). Without this call iOS
                    // never registers for remote notifications and no APNs
                    // token ever lands in Firestore, so admin pushes go
                    // nowhere.
                    await NotificationService.requestAuthorization()
                    await NotificationService.flushPendingToken()
                }
                .onChange(of: auth.currentUser?.uid) { _, _ in
                    // Re-flush whenever sign-in state flips, in case the
                    // APNs token landed before the user authenticated.
                    Task { await NotificationService.flushPendingToken() }
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
