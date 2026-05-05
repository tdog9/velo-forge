import Foundation
import UIKit
import UserNotifications
import FirebaseAuth
import FirebaseFirestore
import FirebaseMessaging

/// Push notification handler for TurboPrep iOS.
///
/// Flow:
///   1. requestAuthorization() — prompts the user once.
///   2. registerForRemoteNotifications() — kicks off APNs token retrieval.
///   3. APNs token forwarded to FCM via Messaging.apnsToken.
///   4. FCM issues a registration token (delivered via MessagingDelegate).
///   5. Both tokens cached in UserDefaults; the web bridge forwards them
///      into Firestore at users/{uid}/devices/{suffix} so onChatWrite can
///      look them up server-side.
///
/// We use FCM tokens for delivery (admin.messaging() in functions/) and
/// keep the raw APNs token as a fallback path. FCM handles dev/prod
/// transparently — no more APNs env mismatches.
final class TurboPrepNotificationDelegate: NSObject, UNUserNotificationCenterDelegate, MessagingDelegate {
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
    /// FCM hands us a registration token any time it issues or rotates one.
    /// Cache + dispatch to the same path as the APNs token so the web
    /// bridge picks it up when the WebView is ready.
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken, !token.isEmpty else { return }
        UserDefaults.standard.set(token, forKey: "tp_pending_fcm_token")
        Task { @MainActor in
            await NotificationService.flushPendingToken()
        }
    }
}

@MainActor
enum NotificationService {

    /// Ask the user for permission, register with APNs, and wire FCM.
    /// Safe to call multiple times — iOS only prompts once.
    static func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        center.delegate = TurboPrepNotificationDelegate.shared
        // FCM delegate — receives the FCM registration token via
        // messaging(_:didReceiveRegistrationToken:).
        Messaging.messaging().delegate = TurboPrepNotificationDelegate.shared
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

    /// Called from AppDelegate didRegisterForRemoteNotificationsWithDeviceToken.
    /// Hands the APNs token to FCM (which uses it to issue an FCM token via
    /// the MessagingDelegate callback) and caches the raw APNs hex too as
    /// a fallback path.
    static func handleRegistration(token: Data) async {
        // Hand to FCM — this triggers the FCM registration flow which ends
        // in messaging(_:didReceiveRegistrationToken:).
        Messaging.messaging().apnsToken = token
        // Cache APNs hex as well — the web bridge sends both up so the
        // server can fall back if the FCM token isn't available yet.
        let hex = token.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: "tp_pending_apns_token")
        // Best-effort native-Firestore write — usually no-op (native Auth
        // is typically unsigned even when the WebView is signed in). The
        // web bridge is the canonical path; this just cuts a few seconds
        // of latency when native does happen to be signed in.
        guard let uid = Auth.auth().currentUser?.uid else { return }
        let fcmToken = UserDefaults.standard.string(forKey: "tp_pending_fcm_token") ?? ""
        let suffix = String(hex.suffix(16))
        var payload: [String: Any] = [
            "platform": "ios",
            "apnsToken": hex,
            "lastSeenAt": FieldValue.serverTimestamp(),
            "appBuild": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?",
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
        ]
        if !fcmToken.isEmpty {
            payload["fcmToken"] = fcmToken
        }
        do {
            try await Firestore.firestore()
                .collection("users").document(uid)
                .collection("devices").document(suffix)
                .setData(payload, merge: true)
        } catch {
            print("⚠️ Native Firestore device-token write failed: \(error.localizedDescription)")
        }
    }

    static func handleRegistrationError(_ error: Error) {
        print("⚠️ APNs registration failed: \(error.localizedDescription)")
    }

    /// Replay any cached APNs/FCM tokens after the user signs in.
    static func flushPendingToken() async {
        guard Auth.auth().currentUser != nil else { return }
        let cached = UserDefaults.standard.string(forKey: "tp_pending_apns_token") ?? ""
        guard !cached.isEmpty else { return }
        await handleRegistration(token: Data(hexString: cached) ?? Data())
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
