import SwiftUI

/// Fitness tab — two sub-tabs (Today's plan, Done). Visually mirrors the
/// web's Fitness page sub-tab pattern. Page-style swipe between sub-tabs
/// keeps it native-feeling on the Watch.
struct WatchFitnessView: View {
    var body: some View {
        TabView {
            FitnessTodayPlanView()
                .containerBackground(Theme.bg.gradient, for: .tabView)
            FitnessDoneView()
                .containerBackground(Theme.bg.gradient, for: .tabView)
        }
        .tabViewStyle(.page)
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
        case "tracker": return Theme.phaseTaper
        case "strava":  return Theme.phaseBuild
        default:        return Theme.primary
        }
    }
}
