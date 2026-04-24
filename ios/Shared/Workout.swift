import Foundation

/// Firestore path: users/{uid}/workouts/{autoId}
/// Mirror: schemas/workout.ts
///
/// Written by the web app (manual/tracker/strava) and by the Watch
/// (source = "watch"). Reads come from the web today feed and fitness page.
struct Workout: Identifiable, Equatable {
    let id: String
    var name: String
    var type: String?
    var date: Date
    var duration: Int?      // minutes
    var distanceKm: Double?
    var heartRateAvg: Int?
    var heartRateMax: Int?
    var heartRateMin: Int?
    var energyKcal: Double?
    var notes: String?
    var source: Source?
    var activityType: ActivityType?

    enum Source: String {
        case manual, tracker, strava, watch
    }

    enum ActivityType: String {
        case cycling, running, walking, other
    }

    init(from data: [String: Any], id: String) {
        self.id = id
        self.name = (data["name"] as? String) ?? "Workout"
        self.type = data["type"] as? String
        if let ts = data["date"] as? [String: Any], let seconds = ts["seconds"] as? TimeInterval {
            self.date = Date(timeIntervalSince1970: seconds)
        } else if let iso = data["date"] as? String, let d = ISO8601DateFormatter().date(from: iso) {
            self.date = d
        } else {
            self.date = Date()
        }
        self.duration = data["duration"] as? Int
        self.distanceKm = data["distanceKm"] as? Double
        if let hr = data["heartRate"] as? [String: Any] {
            self.heartRateAvg = hr["avg"] as? Int
            self.heartRateMax = hr["max"] as? Int
            self.heartRateMin = hr["min"] as? Int
        }
        self.energyKcal = data["energyKcal"] as? Double
        self.notes = data["notes"] as? String
        if let s = data["source"] as? String { self.source = Source(rawValue: s) }
        if let a = data["activityType"] as? String { self.activityType = ActivityType(rawValue: a) }
    }

    /// Dictionary payload for Firestore write.
    func toFirestoreData() -> [String: Any] {
        var out: [String: Any] = [
            "name": name,
            "date": date,
        ]
        if let type { out["type"] = type }
        if let duration { out["duration"] = duration }
        if let distanceKm { out["distanceKm"] = distanceKm }
        var hr: [String: Any] = [:]
        if let heartRateAvg { hr["avg"] = heartRateAvg }
        if let heartRateMax { hr["max"] = heartRateMax }
        if let heartRateMin { hr["min"] = heartRateMin }
        if !hr.isEmpty { out["heartRate"] = hr }
        if let energyKcal { out["energyKcal"] = energyKcal }
        if let notes { out["notes"] = notes }
        if let source { out["source"] = source.rawValue }
        if let activityType { out["activityType"] = activityType.rawValue }
        return out
    }
}
