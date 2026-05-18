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
        // Install Home Screen Quick Actions — long-press the app icon to
        // jump straight to Race Day, Today, or Team Chat. Set
        // programmatically so we don't have to maintain a static
        // Info.plist alongside xcodegen's generated one.
        QuickActions.install()
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

    // Home Screen Quick Action tap. The shortcut's userInfo carries a
    // `go` string ("race-day" / "team-chat" / "today") which RootView
    // hands to the WebView as a deep-link URL.
    func application(_ application: UIApplication,
                     performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        if let go = shortcutItem.userInfo?["go"] as? String {
            QuickActions.handle(go: go)
            completionHandler(true)
        } else {
            completionHandler(false)
        }
    }
}

/// Installs and routes iOS Home Screen Quick Actions. Set programmatically
/// at app init so the items are always present without us needing to
/// hand-maintain Info.plist alongside xcodegen's generated keys.
enum QuickActions {
    /// NotificationCenter name RootView listens to. Posts a deep-link URL
    /// in `userInfo["url"]` which the WebView loads.
    static let deepLinkNotification = Notification.Name("TPQuickActionDeepLink")

    static func install() {
        let items: [UIApplicationShortcutItem] = [
            UIApplicationShortcutItem(
                type: "com.403productions.turboprep.race-day",
                localizedTitle: "Race Day",
                localizedSubtitle: "Open live race day",
                icon: UIApplicationShortcutIcon(systemImageName: "flag.checkered"),
                userInfo: ["go": "race-day" as NSSecureCoding]
            ),
            UIApplicationShortcutItem(
                type: "com.403productions.turboprep.team-chat",
                localizedTitle: "Team Chat",
                localizedSubtitle: "Jump into your team channel",
                icon: UIApplicationShortcutIcon(systemImageName: "bubble.left.and.bubble.right"),
                userInfo: ["go": "team-chat" as NSSecureCoding]
            ),
            UIApplicationShortcutItem(
                type: "com.403productions.turboprep.today",
                localizedTitle: "Today",
                localizedSubtitle: "Open today's plan",
                icon: UIApplicationShortcutIcon(systemImageName: "calendar"),
                userInfo: ["go": "today" as NSSecureCoding]
            ),
        ]
        UIApplication.shared.shortcutItems = items
    }

    static func handle(go: String) {
        // Whitelist — never push an arbitrary path into the WebView.
        let allowed: Set<String> = ["race-day", "team-chat", "today", "fitness", "races", "team"]
        guard allowed.contains(go) else { return }
        guard let url = URL(string: "https://turboprep.app/?go=\(go)") else { return }
        NotificationCenter.default.post(
            name: deepLinkNotification,
            object: nil,
            userInfo: ["url": url]
        )
    }
}
