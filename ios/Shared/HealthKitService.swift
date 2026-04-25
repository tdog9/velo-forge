import Foundation
import HealthKit

// HealthKit wrapper used by both the iPhone and Watch apps. iOS reads samples
// via HKSampleQuery on demand; watchOS subscribes to live HR updates during
// a workout session via HKAnchoredObjectQuery.
//
// On simulator without a paid Apple Dev account the requestAuthorization call
// will succeed but real samples won't flow — set the synthetic HR stream in
// the Health app, or accept that the BPM display stays at "—" until you
// validate on hardware.
@MainActor
final class HealthKitService: ObservableObject {
    enum AuthorizationState: Equatable {
        case notRequested
        case requesting
        case granted
        case denied
        case unavailable
    }

    @Published private(set) var authorization: AuthorizationState = .notRequested
    @Published private(set) var latestHeartRate: Int?
    @Published private(set) var latestHeartRateAt: Date?

    private let store = HKHealthStore()
    private var heartRateQuery: HKQuery?
    private var heartRateAnchor: HKQueryAnchor?

    private var readTypes: Set<HKObjectType> {
        var s: Set<HKObjectType> = []
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { s.insert(hr) }
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { s.insert(energy) }
        if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) { s.insert(steps) }
        s.insert(HKObjectType.workoutType())
        return s
    }

    private var writeTypes: Set<HKSampleType> {
        var s: Set<HKSampleType> = [HKObjectType.workoutType()]
        if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { s.insert(energy) }
        return s
    }

    init() {
        if !HKHealthStore.isHealthDataAvailable() {
            authorization = .unavailable
        }
    }

    /// Show the system permission sheet. Safe to call repeatedly; iOS shows
    /// the sheet once and remembers the choice.
    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            authorization = .unavailable
            return
        }
        authorization = .requesting
        do {
            try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
            // requestAuthorization doesn't reveal what the user actually picked
            // (privacy). Probe by attempting a sample read.
            await refreshLatestHeartRate()
            authorization = .granted
        } catch {
            authorization = .denied
        }
    }

    /// One-shot summary of today's key Health metrics. Returns a dictionary
    /// suitable for cross-device transport (no Date types — timestamps as
    /// TimeInterval since 1970). Used by the Watch to push a summary up to
    /// the iPhone, which forwards it into the web app's userProfile.health.
    func fetchTodaySummary() async -> [String: Any] {
        guard HKHealthStore.isHealthDataAvailable() else { return [:] }
        let cal = Calendar.current
        let startOfDay = cal.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: nil, options: .strictStartDate)
        var summary: [String: Any] = ["asOf": Date().timeIntervalSince1970]
        await refreshLatestHeartRate()
        if let hr = latestHeartRate { summary["latestHr"] = hr }
        // Steps today
        if let stepsType = HKObjectType.quantityType(forIdentifier: .stepCount) {
            let steps = await sumQuantity(type: stepsType, predicate: predicate, unit: .count())
            summary["latestSteps"] = Int(steps)
        }
        // Active energy today (kcal)
        if let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            let kcal = await sumQuantity(type: energyType, predicate: predicate, unit: .kilocalorie())
            summary["activeEnergyKcal"] = Int(kcal)
        }
        // Resting heart rate (most recent within 7 days)
        if let restingType = HKObjectType.quantityType(forIdentifier: .restingHeartRate) {
            let bpmUnit = HKUnit.count().unitDivided(by: .minute())
            let weekAgo = Date().addingTimeInterval(-7 * 86400)
            let weekPredicate = HKQuery.predicateForSamples(withStart: weekAgo, end: nil, options: .strictStartDate)
            if let resting = await mostRecentQuantity(type: restingType, predicate: weekPredicate, unit: bpmUnit) {
                summary["restingHr"] = Int(resting.rounded())
            }
        }
        return summary
    }

    private func sumQuantity(type: HKQuantityType, predicate: NSPredicate, unit: HKUnit) async -> Double {
        await withCheckedContinuation { (cont: CheckedContinuation<Double, Never>) in
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, _ in
                let v = stats?.sumQuantity()?.doubleValue(for: unit) ?? 0
                cont.resume(returning: v)
            }
            store.execute(q)
        }
    }

    private func mostRecentQuantity(type: HKQuantityType, predicate: NSPredicate, unit: HKUnit) async -> Double? {
        await withCheckedContinuation { (cont: CheckedContinuation<Double?, Never>) in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                if let s = samples?.first as? HKQuantitySample {
                    cont.resume(returning: s.quantity.doubleValue(for: unit))
                } else {
                    cont.resume(returning: nil)
                }
            }
            store.execute(q)
        }
    }

    /// One-shot fetch of the most-recent heart-rate sample. Cheap; safe to
    /// call from a `.task` modifier or on a refresh.
    func refreshLatestHeartRate() async {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return }
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let query = HKSampleQuery(
                sampleType: hrType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { [weak self] _, samples, _ in
                Task { @MainActor [weak self] in
                    guard let self else { cont.resume(); return }
                    if let sample = (samples?.first) as? HKQuantitySample {
                        let unit = HKUnit.count().unitDivided(by: .minute())
                        self.latestHeartRate = Int(sample.quantity.doubleValue(for: unit).rounded())
                        self.latestHeartRateAt = sample.endDate
                    }
                    cont.resume()
                }
            }
            store.execute(query)
        }
    }

    /// Subscribe to live heart-rate updates. Drives the BPM display on Watch
    /// during a workout session. Idempotent.
    func startHeartRateStreaming() {
        guard heartRateQuery == nil,
              let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return }
        let predicate = HKQuery.predicateForSamples(
            withStart: Date().addingTimeInterval(-60 * 60),
            end: nil,
            options: .strictStartDate
        )
        let q = HKAnchoredObjectQuery(
            type: hrType,
            predicate: predicate,
            anchor: heartRateAnchor,
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, _, newAnchor, _ in
            self?.handleHeartRateSamples(samples, anchor: newAnchor)
        }
        q.updateHandler = { [weak self] _, samples, _, newAnchor, _ in
            self?.handleHeartRateSamples(samples, anchor: newAnchor)
        }
        heartRateQuery = q
        store.execute(q)
    }

    func stopHeartRateStreaming() {
        if let q = heartRateQuery {
            store.stop(q)
            heartRateQuery = nil
        }
    }

    private nonisolated func handleHeartRateSamples(_ samples: [HKSample]?, anchor: HKQueryAnchor?) {
        guard let quantitySamples = samples as? [HKQuantitySample],
              let latest = quantitySamples.max(by: { $0.endDate < $1.endDate }) else { return }
        let unit = HKUnit.count().unitDivided(by: .minute())
        let bpm = Int(latest.quantity.doubleValue(for: unit).rounded())
        let endDate = latest.endDate
        Task { @MainActor [weak self] in
            self?.latestHeartRate = bpm
            self?.latestHeartRateAt = endDate
            if let anchor { self?.heartRateAnchor = anchor }
        }
    }
}
