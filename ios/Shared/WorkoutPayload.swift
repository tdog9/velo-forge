import Foundation

/// Wire format for Watch → iPhone workout transfers via WatchConnectivity.
/// Dates flatten to TimeInterval for dictionary serialization. The iPhone
/// receiver converts these into a `Workout` struct and writes to Firestore.
struct WorkoutPayload: Sendable {
    let name: String
    let durationSeconds: TimeInterval
    let heartRateAvg: Int?
    let heartRateMax: Int?
    let energyKcal: Double?
    let startedAt: Date
    let endedAt: Date
    let activityType: String
    let source: String

    func toDictionary() -> [String: Any] {
        var d: [String: Any] = [
            "name": name,
            "durationSeconds": durationSeconds,
            "startedAt": startedAt.timeIntervalSince1970,
            "endedAt": endedAt.timeIntervalSince1970,
            "activityType": activityType,
            "source": source,
        ]
        if let heartRateAvg { d["heartRateAvg"] = heartRateAvg }
        if let heartRateMax { d["heartRateMax"] = heartRateMax }
        if let energyKcal { d["energyKcal"] = energyKcal }
        return d
    }

    init?(from dict: [String: Any]) {
        guard let name = dict["name"] as? String,
              let durationSeconds = dict["durationSeconds"] as? TimeInterval,
              let startedAt = dict["startedAt"] as? TimeInterval,
              let endedAt = dict["endedAt"] as? TimeInterval,
              let activityType = dict["activityType"] as? String,
              let source = dict["source"] as? String
        else { return nil }
        self.name = name
        self.durationSeconds = durationSeconds
        self.heartRateAvg = dict["heartRateAvg"] as? Int
        self.heartRateMax = dict["heartRateMax"] as? Int
        self.energyKcal = dict["energyKcal"] as? Double
        self.startedAt = Date(timeIntervalSince1970: startedAt)
        self.endedAt = Date(timeIntervalSince1970: endedAt)
        self.activityType = activityType
        self.source = source
    }

    init(name: String, durationSeconds: TimeInterval, heartRateAvg: Int?, heartRateMax: Int?, energyKcal: Double?, startedAt: Date, endedAt: Date, activityType: String, source: String = "watch") {
        self.name = name
        self.durationSeconds = durationSeconds
        self.heartRateAvg = heartRateAvg
        self.heartRateMax = heartRateMax
        self.energyKcal = energyKcal
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.activityType = activityType
        self.source = source
    }

    /// Convert to a Workout suitable for Firestore write on the iPhone.
    func toWorkout() -> Workout {
        var w = Workout(from: [:], id: UUID().uuidString)
        w.name = name
        w.date = endedAt
        w.duration = Int((durationSeconds / 60).rounded())
        w.heartRateAvg = heartRateAvg
        w.heartRateMax = heartRateMax
        w.energyKcal = energyKcal
        w.source = Workout.Source(rawValue: source) ?? .watch
        w.activityType = Workout.ActivityType(rawValue: activityType) ?? .cycling
        return w
    }
}
