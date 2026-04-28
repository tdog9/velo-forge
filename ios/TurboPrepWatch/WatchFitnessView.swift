import SwiftUI

/// Fitness tab — sub-tabs (Today's plan, Done, Race-Day stints). Visually
/// mirrors the web's Fitness page sub-tab pattern. Page-style swipe between
/// sub-tabs keeps it native-feeling on the Watch. The Stints page shows
/// completed race-day stints saved on-watch (works in standalone mode).
struct WatchFitnessView: View {
    var body: some View {
        TabView {
            FitnessTodayPlanView()
                .containerBackground(Theme.bg.gradient, for: .tabView)
            FitnessDoneView()
                .containerBackground(Theme.bg.gradient, for: .tabView)
            FitnessStintsView()
                .containerBackground(Theme.bg.gradient, for: .tabView)
        }
        .tabViewStyle(.page)
    }
}

private struct FitnessStintsView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("STINTS")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.6)
                        .foregroundStyle(Theme.mutedFg)
                    Spacer()
                    if !state.pastStints.isEmpty {
                        Button("Clear") { state.clearPastStints() }
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.mutedFg)
                            .buttonStyle(.plain)
                    }
                }
                .padding(.top, 4)
                .padding(.horizontal, 4)

                if state.pastStints.isEmpty {
                    ThemeCard {
                        Text("Past stints appear here after you finish a race-day session.")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                    }
                } else {
                    ForEach(state.pastStints) { stint in
                        PastStintCard(stint: stint)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
    }
}

private struct PastStintCard: View {
    let stint: WatchPastStint
    @State private var expanded: Bool = false

    private static let dateFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_AU")
        f.dateFormat = "d MMM, h:mma"
        return f
    }()

    var body: some View {
        Button { expanded.toggle() } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(Self.dateFormat.string(from: stint.startedAt))
                        .font(.system(.caption2, weight: .semibold))
                        .foregroundStyle(Theme.fg)
                    Spacer()
                    Text("\(stint.laps.count) laps")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                }
                HStack(spacing: 6) {
                    if let best = stint.bestLapSeconds {
                        statPill(label: "BEST", value: format(best), color: Theme.primary)
                    }
                    if let avg = stint.avgLapSeconds {
                        statPill(label: "AVG", value: format(avg), color: Theme.mutedFg)
                    }
                    statPill(label: "TOTAL", value: format(stint.durationSeconds), color: Theme.mutedFg)
                }
                if expanded {
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(stint.laps) { lap in
                            HStack {
                                Text("L\(lap.number)")
                                    .font(.system(.caption2, weight: .bold))
                                    .foregroundStyle(Theme.mutedFg)
                                    .frame(width: 26, alignment: .leading)
                                Text(format(lap.durationSeconds))
                                    .font(.system(.caption2, design: .rounded))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.fg)
                                Spacer()
                                if lap.durationSeconds == stint.bestLapSeconds {
                                    Text("BEST")
                                        .font(.system(size: 8, weight: .heavy))
                                        .foregroundStyle(Theme.primary)
                                }
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            }
            .padding(8)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Theme.border, lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    private func statPill(label: String, value: String, color: Color) -> some View {
        HStack(spacing: 3) {
            Text(label)
                .font(.system(size: 8, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(Theme.mutedFg)
            Text(value)
                .font(.system(.caption2, design: .rounded, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 6)
        .background(color.opacity(0.10))
        .clipShape(Capsule())
    }

    private func format(_ s: TimeInterval) -> String {
        let total = Int(s)
        let h = total / 3600
        let m = (total % 3600) / 60
        let sec = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, sec) }
        return String(format: "%d:%02d", m, sec)
    }
}

private struct FitnessTodayPlanView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("TODAY'S PLAN")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.mutedFg)
                    .padding(.top, 4)
                if state.todayWorkouts.isEmpty {
                    ThemeCard {
                        Text("Rest day — nothing scheduled.")
                            .font(.system(.caption))
                            .foregroundStyle(Theme.mutedFg)
                    }
                } else {
                    ForEach(state.todayWorkouts) { w in
                        TodayWorkoutCard(workout: w)
                    }
                    let total = state.todayWorkouts.reduce(0) { $0 + $1.durationMinutes }
                    let done  = state.todayWorkouts.filter(\.completed).reduce(0) { $0 + $1.durationMinutes }
                    Text("\(done) of \(total) min done")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
    }
}

private struct FitnessDoneView: View {
    @EnvironmentObject private var state: WatchAppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                Text("DONE")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.mutedFg)
                    .padding(.top, 4)
                    .padding(.horizontal, 4)
                if state.completedWorkouts.isEmpty {
                    ThemeCard {
                        Text("No completed workouts yet.")
                            .font(.system(.caption))
                            .foregroundStyle(Theme.mutedFg)
                    }
                } else {
                    ForEach(state.completedWorkouts) { w in
                        CompletedWorkoutRow(workout: w)
                    }
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 12)
        }
    }
}

private struct CompletedWorkoutRow: View {
    let workout: WatchLoggedWorkout

    private static let dateFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_AU")
        f.dateFormat = "d MMM"
        return f
    }()

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            sourceIcon
                .font(.system(size: 14))
                .foregroundStyle(sourceColor)
                .frame(width: 18, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(workout.name)
                    .font(.system(.caption, weight: .semibold))
                    .foregroundStyle(Theme.fg)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text("\(workout.durationMinutes) min")
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                    Text("•")
                        .foregroundStyle(Theme.mutedFg.opacity(0.5))
                    Text(Self.dateFormat.string(from: workout.date))
                        .font(.system(.caption2))
                        .foregroundStyle(Theme.mutedFg)
                    if let hr = workout.avgHeartRate {
                        Spacer(minLength: 4)
                        HStack(spacing: 2) {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 8))
                                .foregroundStyle(Theme.heartRateColor)
                            Text("\(hr)")
                                .font(.system(.caption2, design: .rounded, weight: .semibold))
                                .foregroundStyle(Theme.fg)
                        }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                .stroke(Theme.border, lineWidth: 0.5)
        )
    }

    private var sourceIcon: Image {
        switch workout.source {
        case "watch":   return Image(systemName: "applewatch")
        case "tracker": return Image(systemName: "location.fill")
        case "strava":  return Image(systemName: "flame.fill")
        default:        return Image(systemName: "checkmark.circle.fill")
        }
    }

    private var sourceColor: Color {
        switch workout.source {
        case "watch":   return Theme.phaseRaceWeek
        case "tracker": return Color.blue
        case "strava":  return Theme.phaseBuild
        default:        return Theme.primary
        }
    }
}
