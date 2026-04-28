import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var state = WatchAppState.shared

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            // Watch app runs fully standalone — no gate. Demo seed data
            // populates Today / Fitness / Record on first launch; if the
            // iPhone bridge ever lands later it will overwrite the seed
            // values via WatchAppState.applyRemoteSnapshot. Race-day
            // toggling stays local (long-press the wordmark).
            TabView {
                WatchTodayView()
                    .containerBackground(Theme.bg.gradient, for: .tabView)
                WatchRecordView()
                    .containerBackground(Theme.bg.gradient, for: .tabView)
                WatchFitnessView()
                    .containerBackground(Theme.bg.gradient, for: .tabView)
                WatchDevView()
                    .containerBackground(Theme.bg.gradient, for: .tabView)
            }
            .tabViewStyle(.verticalPage)
        }
        .environmentObject(state)
        .preferredColorScheme(.dark)
    }
}

/// "TurboPrep" wordmark — split-color matches the web header treatment.
/// Long-press toggles race-day mode locally on the Watch.
struct BrandHeader: View {
    @EnvironmentObject private var state: WatchAppState
    var body: some View {
        HStack(spacing: 0) {
            Text("Turbo").foregroundStyle(Theme.fg)
            Text("Prep").foregroundStyle(Theme.primary)
        }
        .font(.system(.title3, design: .rounded, weight: .heavy))
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: 1.5) {
            state.toggleRaceDayForDev()
        }
    }
}

/// Phase chip — small pill in the phase colour, used on Today tab.
struct PhaseChip: View {
    let phase: WatchRacePhase
    var body: some View {
        let color = phaseColor(phase.phase)
        HStack(spacing: 6) {
            Text(phase.label)
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.6)
                .foregroundStyle(color)
            Text("\(phase.daysOut)d · \(phase.raceShortName)")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.fg.opacity(0.85))
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 8)
        .background(color.opacity(0.15))
        .clipShape(Capsule())
    }

    private func phaseColor(_ p: WatchRacePhase.Phase) -> Color {
        switch p {
        case .base:      return Theme.phaseBase
        case .build:     return Theme.phaseBuild
        case .peak:      return Theme.phasePeak
        case .raceWeek:  return Theme.phaseRaceWeek
        }
    }
}
