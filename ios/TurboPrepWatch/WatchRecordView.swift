import SwiftUI

/// Center "Record" tab. Behaviour:
/// - Race-day mode active → big lap timer with tap-to-lap and live BPM.
/// - Otherwise → standard HPV ride session (HKWorkoutSession + send to iPhone).
struct WatchRecordView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        Group {
            if state.raceDayActive {
                RaceDayLapView()
            } else {
                WorkoutSessionView()
            }
        }
    }
}

/// Race-day lap timer. Tap the centre area to record a split. Hold "End" to
/// finalize. Lap data accumulates in WatchAppState; iPhone-side will push
/// the race-day stints to Firestore (currently held locally).
struct RaceDayLapView: View {
    @EnvironmentObject private var state: WatchAppState
    @StateObject private var health = HealthKitService()
    @State private var lapStartedAt: Date = Date()
    @State private var now: Date = Date()
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Theme.phasePeak)
                        .frame(width: 6, height: 6)
                    Text("RACE DAY LIVE")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.phasePeak)
                    Spacer(minLength: 0)
                    Text("Lap \(state.raceDayLaps.count + 1)")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                }

                Button(action: recordLap) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CURRENT LAP")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Theme.mutedFg)
                        Text(currentLapText)
                            .font(.system(size: 32, weight: .black, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Theme.fg)
                        Text("Tap to lap")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.primary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                            .stroke(Theme.primary.opacity(0.4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                ThemeCard {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundStyle(Theme.heartRateColor)
                            .font(.caption2)
                        Text(health.latestHeartRate.map { "\($0) bpm" } ?? "— bpm")
                            .font(.system(.caption, weight: .semibold))
                            .foregroundStyle(Theme.fg)
                            .monospacedDigit()
                        Spacer(minLength: 0)
                        if let best = bestLapText {
                            Text("Best \(best)")
                                .font(.system(.caption2))
                                .foregroundStyle(Theme.mutedFg)
                        }
                    }
                }

                if !state.raceDayLaps.isEmpty {
                    Button(role: .destructive) {
                        finishStint()
                    } label: {
                        HStack {
                            Image(systemName: "stop.fill").font(.headline)
                            Text("Finish stint")
                                .font(.system(.body, weight: .bold))
                            Spacer(minLength: 0)
                        }
                        .foregroundStyle(.white)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity)
                        .background(Theme.phasePeak)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("LAPS")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.6)
                            .foregroundStyle(Theme.mutedFg)
                            .padding(.horizontal, 4)
                        ForEach(state.raceDayLaps.prefix(5)) { lap in
                            HStack {
                                Text("L\(lap.number)")
                                    .font(.system(.caption2, weight: .bold))
                                    .foregroundStyle(Theme.mutedFg)
                                    .frame(width: 26, alignment: .leading)
                                Text(format(lap.durationSeconds))
                                    .font(.system(.caption2, design: .rounded, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.fg)
                                Spacer(minLength: 0)
                                if lap.durationSeconds == bestLapSeconds {
                                    Text("BEST")
                                        .font(.system(size: 8, weight: .heavy))
                                        .foregroundStyle(Theme.primary)
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
        .onReceive(tick) { now = $0 }
        .task {
            if health.authorization == .notRequested {
                await health.requestAuthorization()
            }
            if health.authorization == .granted {
                await health.refreshLatestHeartRate()
                health.startHeartRateStreaming()
            }
        }
        .onDisappear { health.stopHeartRateStreaming() }
    }

    private func recordLap() {
        let dur = Date().timeIntervalSince(lapStartedAt)
        state.recordLap(durationSeconds: dur)
        lapStartedAt = Date()
    }

    private func finishStint() {
        let payload: [String: Any] = [
            "stintEndedAt": Date().timeIntervalSince1970,
            "stintStartedAt": (state.raceDayStartedAt ?? Date()).timeIntervalSince1970,
            "laps": state.raceDayLaps.map { lap in
                [
                    "number": lap.number,
                    "duration": Int(lap.durationSeconds * 1000),  // ms
                    "recordedAt": lap.recordedAt.timeIntervalSince1970,
                ] as [String: Any]
            },
        ]
        ConnectivityService.shared.sendRaceDayLaps(payload)
        state.raceDayLaps.removeAll()
        lapStartedAt = Date()
    }

    private var currentLapText: String {
        format(now.timeIntervalSince(lapStartedAt))
    }

    private var bestLapSeconds: TimeInterval? {
        state.raceDayLaps.map(\.durationSeconds).min()
    }

    private var bestLapText: String? {
        bestLapSeconds.map(format)
    }

    private func format(_ t: TimeInterval) -> String {
        let total = Int(t)
        let m = total / 60
        let s = total % 60
        let ms = Int((t - TimeInterval(total)) * 10)
        return String(format: "%d:%02d.%d", m, s, ms)
    }
}
