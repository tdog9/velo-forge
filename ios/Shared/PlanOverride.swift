import Foundation

/// Firestore path: users/{uid}/planOverrides/{planId}
/// Mirror: schemas/plan-override.ts
struct PlanOverrideDoc: Equatable {
    var entries: [PlanOverrideEntry]
    var updatedAt: String?

    init(from data: [String: Any]) {
        let rawEntries = data["entries"] as? [[String: Any]] ?? []
        self.entries = rawEntries.compactMap(PlanOverrideEntry.init(from:))
        self.updatedAt = data["updatedAt"] as? String
    }

    init(entries: [PlanOverrideEntry], updatedAt: String? = nil) {
        self.entries = entries
        self.updatedAt = updatedAt
    }

    func toFirestoreData() -> [String: Any] {
        var out: [String: Any] = [
            "entries": entries.map { $0.toFirestoreData() },
        ]
        if let updatedAt { out["updatedAt"] = updatedAt }
        return out
    }
}

struct PlanOverrideEntry: Equatable {
    var week: Int
    var day: String     // "Mon" | "Tue" | ... | "Sun"
    var shiftedTo: String   // YYYY-MM-DD
    var shiftedAt: String   // ISO timestamp

    init(week: Int, day: String, shiftedTo: String, shiftedAt: String) {
        self.week = week
        self.day = day
        self.shiftedTo = shiftedTo
        self.shiftedAt = shiftedAt
    }

    init?(from data: [String: Any]) {
        guard let week = data["week"] as? Int,
              let day = data["day"] as? String,
              let shiftedTo = data["shiftedTo"] as? String,
              let shiftedAt = data["shiftedAt"] as? String else { return nil }
        self.week = week
        self.day = day
        self.shiftedTo = shiftedTo
        self.shiftedAt = shiftedAt
    }

    func toFirestoreData() -> [String: Any] {
        [
            "week": week,
            "day": day,
            "shiftedTo": shiftedTo,
            "shiftedAt": shiftedAt,
        ]
    }
}
