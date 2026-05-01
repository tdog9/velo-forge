import Foundation

/// Direct Watch → Netlify pairing — bypasses iPhone WCSession.
/// On a successful claim, the Watch saves uid + display name + email
/// locally so it never needs the iPhone again to know who it belongs
/// to. Race-day data flows over the same HTTPS endpoints.
final class WatchPairingService {
    static let shared = WatchPairingService()
    private init() {}

    /// Per-install device id, stable across launches. Random UUID
    /// generated once + persisted to UserDefaults — no Apple privacy
    /// hooks (we never need to identify the user across vendors).
    var deviceId: String {
        let key = "tp_watch_device_id"
        if let existing = UserDefaults.standard.string(forKey: key), !existing.isEmpty {
            return existing
        }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }

    /// Production URL of the Netlify deployment. Update if the domain
    /// ever changes; the Watch can't pull it from the iPhone since the
    /// whole point of this flow is iPhone-independence.
    private let baseUrl = "https://turboprep.app/.netlify/functions"

    /// POST /watch-pair with { code, deviceId, deviceName }. Returns
    /// the user identity on success, or a friendly error message.
    /// Updates WatchAppState directly on success so the calling view
    /// can just show a checkmark.
    func claim(code: String,
               deviceName: String = "Apple Watch",
               completion: @escaping (Result<(uid: String, displayName: String, email: String), Error>) -> Void) {
        guard let url = URL(string: "\(baseUrl)/watch-pair") else {
            completion(.failure(NSError(domain: "WatchPair", code: 1, userInfo: [NSLocalizedDescriptionKey: "Bad URL"])))
            return
        }
        let payload: [String: Any] = [
            "code": code,
            "deviceId": deviceId,
            "deviceName": deviceName,
        ]
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 12
        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            completion(.failure(error))
            return
        }
        URLSession.shared.dataTask(with: req) { data, _, err in
            if let err = err { DispatchQueue.main.async { completion(.failure(err)) }; return }
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                DispatchQueue.main.async {
                    completion(.failure(NSError(domain: "WatchPair", code: 2, userInfo: [NSLocalizedDescriptionKey: "Bad response"])))
                }
                return
            }
            let ok = json["ok"] as? Bool ?? false
            if !ok {
                let msg = (json["error"] as? String) ?? "Pair failed"
                DispatchQueue.main.async {
                    completion(.failure(NSError(domain: "WatchPair", code: 3, userInfo: [NSLocalizedDescriptionKey: msg])))
                }
                return
            }
            let uid  = (json["uid"] as? String) ?? ""
            let name = (json["displayName"] as? String) ?? ""
            let mail = (json["email"] as? String) ?? ""
            DispatchQueue.main.async {
                // Update the global state so the rest of the Watch UI
                // immediately reflects the signed-in identity. Persist
                // is automatic via the @Published didSet hooks.
                let s = WatchAppState.shared
                s.iPhoneUserDisplayName = name.isEmpty ? nil : name
                s.iPhoneUserEmail       = mail.isEmpty ? nil : mail
                s.iPhoneSignedIn        = true
                completion(.success((uid: uid, displayName: name, email: mail)))
            }
        }.resume()
    }
}
