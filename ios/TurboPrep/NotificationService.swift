import Foundation
import UIKit
import UserNotifications
import FirebaseAuth
import FirebaseFirestore

/// APNs / push notification handler for TurboPrep iOS.
///
/// Flow:
///   1. requestAuthorization() — prompts the user once (system sheet).
///   2. UIApplication.shared.registerForRemoteNotifications() — kicks off
///      device-token retrieval. The AppDelegate forwards the resulting
///      token (or error) to handleRegistration(token:) below.
///   3. Token is written to users/{uid}/devices/{tokenSuffix} in Firestore
///      so the Netlify push function knows where to deliver.
///
/// Inert until:
///   - The TurboPrep target has the "Push Notifications" capability enabled
///     in Signing & Capabilities (Xcode adds entitlement aps-environment).
///   - You're running on a real device (simulators don't get APNs tokens).
///   - You have a paid Apple Developer account + APNs auth key.
/// Foreground delegate so notifications display as banner+sound+badge
/// even while the user is inside the app. Without this iOS swallows
/// foreground pushes silently (background/lock-screen still work).
final class TurboPrepNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = TurboPrepNotificationDelegate()
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge, .list])
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        // Tapping the notification clears the badge — opening the app means
        // they've "seen" their alerts.
        Task { @MainActor in
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
        completionHandler()
    }
}

@MainActor
enum NotificationService {

    /// Ask the user for permission and start APNs registration.
    /// Safe to call multiple times — iOS only prompts once.
    static func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        center.delegate = TurboPrepNotificationDelegate.shared
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else {
                print("ℹ️ Push notification authorization denied by user.")
                return
            }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            print("⚠️ Notification authorization error: \(error.localizedDescription)")
        }
    }

    /// Clear the app icon badge — call when the user opens the in-app
    /// announcements list / inbox so the count resets.
    static func clearBadge() {
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    /// Called from AppDelegate
    /// `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`
    /// once iOS hands back the APNs token.
    static func handleRegistration(token: Data) async {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        guard let uid = Auth.auth().currentUser?.uid else {
            print("ℹ️ Got APNs token but no signed-in user — caching locally.")
            UserDefaults.standard.set(hex, forKey: "tp_pending_apns_token")
            return
        }
        let suffix = String(hex.suffix(16))
        let payload: [String: Any] = [
            "platform": "ios",
            "apnsToken": hex,
            "lastSeenAt": FieldValue.serverTimestamp(),
            "appBuild": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
        ]
        do {
            try await Firestore.firestore()
                .collection("users").document(uid)
                .collection("devices").document(suffix)
                .setData(payload, merge: true)
        } catch {
            print("⚠️ Failed to register device token: \(error.localizedDescription)")
        }
    }

    static func handleRegistrationError(_ error: Error) {
        print("⚠️ APNs registration failed: \(error.localizedDescription)")
    }

    /// Replay any cached APNs token after the user signs in (in case the
    /// token arrived before sign-in completed).
    static func flushPendingToken() async {
        guard let cached = UserDefaults.standard.string(forKey: "tp_pending_apns_token"),
              !cached.isEmpty,
              Auth.auth().currentUser != nil else { return }
        await handleRegistration(token: Data(hexString: cached) ?? Data())
        UserDefaults.standard.removeObject(forKey: "tp_pending_apns_token")
    }
}

private extension Data {
    init?(hexString: String) {
        let len = hexString.count / 2
        var data = Data(capacity: len)
        var index = hexString.startIndex
        for _ in 0..<len {
            let next = hexString.index(index, offsetBy: 2)
            guard let byte = UInt8(hexString[index..<next], radix: 16) else { return nil }
            data.append(byte)
            index = next
        }
        self = data
    }
}
