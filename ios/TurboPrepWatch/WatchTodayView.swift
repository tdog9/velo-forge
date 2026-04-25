import SwiftUI

/// Today tab — compact mirror of the web Today page.
/// Stack: brand header → race-phase chip → today's plan workouts → HR card.
struct WatchTodayView: View {
    @EnvironmentObject private var state: WatchAppState
    @StateObject private var health = HealthKitService()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                BrandHeader()
                if let phase = state.racePhase {
                    PhaseChip(phase: phase)
                    Text(phase.description)
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                        .padding(.top, -2)
                }
                if state.raceDayActive {
                    raceDayBanner
                }
                if state.todayWorkouts.isEmpty {
                    ThemeCard {
                        Text("Rest day — enjoy the recovery.")
                            .font(.system(.caption))
                            .foregroundStyle(Theme.mutedFg)
                    }
                } else {
                    ForEach(state.todayWorkouts) { w in
                        TodayWorkoutCard(workout: w)
                    }
                }
                heartRateCard
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
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

    private var raceDayBanner: some View {
        ThemeCard {
            HStack(spacing: 6) {
                Circle()
                    .fill(Theme.phasePeak)
                    .frame(width: 6, height: 6)
                    .opacity(0.9)
                Text("RACE DAY LIVE")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.phasePeak)
                Spacer(minLength: 0)
                Text("Open Record")
                    .font(.system(.caption2))
                    .foregroundStyle(Theme.mutedFg)
            }
        }
    }

    private var heartRateCard: some View {
        ThemeCard {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "heart.fill")
                        .foregroundStyle(Theme.heartRateColor)
                        .font(.caption2)
                    Text("HEART RATE")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.mutedFg)
                }
                switch health.authorization {
                case .granted:
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(health.latestHeartRate.map(String.init) ?? "—")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundStyle(Theme.fg)
                            .monospacedDigit()
                        Text("bpm")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                    }
                case .notRequested, .requesting:
                    Button {
                        Task { await health.requestAuthorization() }
                    } label: {
                        Text("Allow Health")
                            .font(.system(.caption, weight: .semibold))
                            .foregroundStyle(Theme.primary)
                    }
                    .buttonStyle(.plain)
                case .denied:
                    Text("Health denied — change in iPhone Watch app.")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                case .unavailable:
                    Text("HealthKit unavailable")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                }
            }
        }
    }
}

/// Compact card for one of today's plan workouts. Tap to mark complete.
struct TodayWorkoutCard: View {
    let workout: WatchPlanWorkout
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        Button {
            state.markPlanWorkoutDone(workout)
        } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: workout.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(workout.completed ? Theme.primary : Theme.mutedFg)
                    .font(.system(size: 18))
                VStack(alignment: .leading, spacing: 3) {
                    Text(workout.name)
                        .font(.system(.caption, weight: .semibold))
                        .foregroundStyle(workout.completed ? Theme.mutedFg : Theme.fg)
                        .strikethrough(workout.completed)
                        .lineLimit(2)
                    HStack(spacing: 6) {
                        Text("\(workout.durationMinutes) min")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                        Text("•")
                            .foregroundStyle(Theme.mutedFg.opacity(0.5))
                        Text(workout.intensity.uppercased())
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.4)
                            .foregroundStyle(intensityColor)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Theme.border, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    private var intensityColor: Color {
        switch workout.intensity.lowercased() {
        case "hard":     return Theme.phasePeak
        case "moderate": return Theme.phaseBuild
        case "easy":     return Theme.phaseBase
        default:         return Theme.mutedFg
        }
    }
}
