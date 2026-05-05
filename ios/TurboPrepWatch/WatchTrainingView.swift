import SwiftUI
import WatchKit
import Combine

/// Watch training view — locks the Watch to a single, focused screen
/// for the duration of a scheduled training session. Mirror of the
/// race-day RaceDayView but without multi-driver / stint scaffolding.
///
/// Pre-session: Start button kicks off HR streaming + workout session.
/// Active session: HR + elapsed timer + lap counter + Finish button.
/// Locked from swipes by WatchRootView (state.trainingActive == true).
struct WatchTrainingView: View {
    @EnvironmentObject private var state: WatchAppState
    @StateObject private var health = HealthKitService()
    @StateObject private var session = WorkoutSessionService()
    @State private var now: Date = Date()
    @State private var tickCancellable: AnyCancellable?

    var body: some View {
        Group {
            if state.trainingStartedAt != nil {
                activeView
            } else {
                preSessionView
            }
        }
        .onAppear {
            tickCancellable = Timer.publish(every: 0.5, on: .main, in: .common)
                .autoconnect()
                .sink { now = $0 }
        }
        .onDisappear {
            tickCancellable?.cancel()
            tickCancellable = nil
            health.stopHeartRateStreaming()
            Task { _ = await session.end() }
        }
    }

    // MARK: - Pre-session screen ─────────────────────────────────────────
    private var preSessionView: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Circle().fill(Theme.primary).frame(width: 6, height: 6)
                Text(state.trainingTitle.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.primary)
                Spacer(minLength: 0)
            }

            Text(state.trainingType.capitalized)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.mutedFg)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 4)

            Button(action: startSession) {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 14, weight: .heavy))
                    Text("START SESSION")
                        .font(.system(size: 13, weight: .heavy))
                        .tracking(0.4)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(
                    LinearGradient(
                        colors: [Theme.primary, Theme.primary.opacity(0.78)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)

            Button(action: exitTraining) {
                Text("Exit training mode")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.mutedFg)
                    .frame(maxWidth: .infinity, minHeight: 28)
                    .background(Theme.surface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.top, 4)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    // MARK: - Active session screen ──────────────────────────────────────
    private var activeView: some View {
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                Text("LAP \(state.trainingLaps.count + 1)")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.primary)
                Spacer(minLength: 0)
                Text(elapsedString)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.fg)
                    .monospacedDigit()
            }

            // Big HR readout — primary metric for training.
            VStack(spacing: 2) {
                Text(hrString)
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.primary)
                    .monospacedDigit()
                Text("BPM")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.mutedFg)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)

            // Tap-anywhere-here lap zone.
            Button(action: recordLap) {
                Text("TAP TO LAP")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.mutedFg)
                    .frame(maxWidth: .infinity, minHeight: 38)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)

            Button(action: finishSession) {
                Text("FINISH")
                    .font(.system(size: 13, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .background(Color(red: 0.93, green: 0.27, blue: 0.27).opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
        .padding(.bottom, 4)
    }

    // MARK: - Computed strings ───────────────────────────────────────────
    private var hrString: String {
        guard let hr = health.latestHeartRate else { return "—" }
        return String(hr)
    }
    private var elapsedString: String {
        guard let start = state.trainingStartedAt else { return "0:00" }
        let secs = Int(now.timeIntervalSince(start))
        let h = secs / 3600
        let m = (secs % 3600) / 60
        let s = secs % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }

    // MARK: - Actions ────────────────────────────────────────────────────
    private func startSession() {
        WKInterfaceDevice.current().play(.start)
        state.trainingLaps.removeAll()
        state.trainingStartedAt = Date()
        // Begin HKWorkoutSession + HR streaming for the screen-on
        // guarantee + live HR feed. Same approach as race-day stint.
        Task {
            await session.start()
            health.startHeartRateStreaming()
        }
    }

    private func recordLap() {
        guard let started = state.trainingStartedAt else { return }
        WKInterfaceDevice.current().play(.click)
        let last = state.trainingLaps.first?.recordedAt ?? started
        let dur = Date().timeIntervalSince(last)
        let lap = WatchLap(number: state.trainingLaps.count + 1,
                           durationSeconds: dur,
                           recordedAt: Date())
        state.trainingLaps.insert(lap, at: 0)
    }

    private func finishSession() {
        WKInterfaceDevice.current().play(.success)
        // Forward laps + duration to iPhone for Firestore save. The
        // ConnectivityService/WatchWorkoutReceiver pair handles the
        // routing. State clears so the Watch returns to normal tabs.
        let laps = state.trainingLaps
        let started = state.trainingStartedAt
        state.trainingActive = false
        state.trainingStartedAt = nil
        state.trainingLaps.removeAll()
        Task {
            _ = await session.end()
            health.stopHeartRateStreaming()
            // Push session summary to iPhone via WCSession.
            if let started = started {
                let payload: [String: Any] = [
                    "startedAtMs": started.timeIntervalSince1970 * 1000,
                    "endedAtMs": Date().timeIntervalSince1970 * 1000,
                    "trainingType": state.trainingType,
                    "trainingTitle": state.trainingTitle,
                    "laps": laps.map { l in
                        [
                            "number": l.number,
                            "durationSeconds": l.durationSeconds,
                            "recordedAtMs": l.recordedAt.timeIntervalSince1970 * 1000,
                        ]
                    }
                ]
                ConnectivityService.shared.sendTrainingSessionEnd(payload)
            }
        }
    }

    private func exitTraining() {
        guard state.trainingStartedAt == nil else { return }
        WKInterfaceDevice.current().play(.success)
        state.trainingActive = false
    }
}
