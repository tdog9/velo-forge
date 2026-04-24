import Foundation
import HealthKit

/// Watch-side cycling workout session. Uses HKWorkoutSession +
/// HKLiveWorkoutBuilder to collect heart rate and active energy throughout
/// the ride. On end, hands a WorkoutPayload to ConnectivityService for the
/// iPhone to write to Firestore.
@MainActor
final class WorkoutSessionService: NSObject, ObservableObject {
    @Published private(set) var isActive = false
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var heartRate: Int?
    @Published private(set) var heartRateMax: Int?
    @Published private(set) var energyKcal: Double = 0
    @Published var lastError: String?

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var startedAt: Date?
    private var elapsedTimer: Timer?
    private var runningHRTotal: Int = 0
    private var runningHRSamples: Int = 0

    func start() async {
        guard !isActive else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .cycling
        config.locationType = .outdoor
        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            session.delegate = self
            builder.delegate = self
            self.session = session
            self.builder = builder
            self.startedAt = Date()
            session.startActivity(with: Date())
            try await builder.beginCollection(at: Date())
            isActive = true
            startElapsedTimer()
        } catch {
            lastError = error.localizedDescription
        }
    }

    @discardableResult
    func end() async -> WorkoutPayload? {
        guard let session, let builder, let startedAt else { return nil }
        let endedAt = Date()
        session.end()
        do {
            try await builder.endCollection(at: endedAt)
            _ = try await builder.finishWorkout()
            isActive = false
            stopElapsedTimer()

            let avg = runningHRSamples > 0 ? runningHRTotal / runningHRSamples : nil
            let payload = WorkoutPayload(
                name: "HPV ride",
                durationSeconds: endedAt.timeIntervalSince(startedAt),
                heartRateAvg: avg,
                heartRateMax: heartRateMax,
                energyKcal: energyKcal > 0 ? energyKcal : nil,
                startedAt: startedAt,
                endedAt: endedAt,
                activityType: "cycling",
                source: "watch"
            )
            ConnectivityService.shared.sendWorkout(payload)
            self.session = nil
            self.builder = nil
            return payload
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    private func startElapsedTimer() {
        stopElapsedTimer()
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [weak self] in
                guard let self, let start = self.startedAt else { return }
                self.elapsed = Date().timeIntervalSince(start)
            }
        }
    }

    private func stopElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
    }
}

extension WorkoutSessionService: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {}

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didFailWithError error: Error) {
        let msg = error.localizedDescription
        Task { @MainActor [weak self] in
            self?.lastError = msg
            self?.isActive = false
        }
    }
}

extension WorkoutSessionService: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let hrType = HKObjectType.quantityType(forIdentifier: .heartRate)
        let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
        for type in collectedTypes {
            guard let qType = type as? HKQuantityType,
                  let stats = workoutBuilder.statistics(for: qType) else { continue }
            if qType == hrType {
                let bpmUnit = HKUnit.count().unitDivided(by: .minute())
                if let recent = stats.mostRecentQuantity()?.doubleValue(for: bpmUnit) {
                    let bpm = Int(recent.rounded())
                    let max = stats.maximumQuantity()?.doubleValue(for: bpmUnit).rounded()
                    Task { @MainActor [weak self] in
                        self?.heartRate = bpm
                        self?.runningHRTotal += bpm
                        self?.runningHRSamples += 1
                        if let max { self?.heartRateMax = Int(max) }
                    }
                }
            } else if qType == energyType {
                if let kcal = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) {
                    Task { @MainActor [weak self] in
                        self?.energyKcal = kcal
                    }
                }
            }
        }
    }
}
