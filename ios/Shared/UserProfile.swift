import Foundation

struct UserProfile: Identifiable, Equatable {
    let id: String
    var email: String?
    var displayName: String?
    var yearLevel: String?
    var fitnessLevel: String?
    var totalXp: Int?
    var activePlanId: String?

    init(from data: [String: Any], id: String) {
        self.id = id
        self.email = data["email"] as? String
        self.displayName = data["displayName"] as? String
        self.yearLevel = data["yearLevel"] as? String
        self.fitnessLevel = data["fitnessLevel"] as? String
        self.totalXp = data["totalXp"] as? Int
        self.activePlanId = data["activePlanId"] as? String
    }

    init(id: String) {
        self.id = id
    }
}
