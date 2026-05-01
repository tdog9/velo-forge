import SwiftUI

struct WatchRootView: View {
    @StateObject private var state = WatchAppState.shared

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            // RACE-MODE LOCK
            // When the iPhone (or the Dev controls) flips raceDayActive
            // to true, the Watch collapses to ONLY the lap-timer view.
            // The user can't swipe to Today / Fitness / Dev mid-stint
            // and accidentally lose lap focus. Exits when raceDayActive
            // flips back to false (manual end-stint, or iPhone push).
            if state.raceDayActive {
                WatchRecordView()
                    .containerBackground(Theme.primary.opacity(0.04).gradient, for: .tabView)
            } else {
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
        }
        .environmentObject(state)
        .preferredColorScheme(.dark)
    }
}

/// "TurboPrep" wordmark + profile circle — matches the iPhone header
/// treatment. Wordmark on the left, primary-coloured circle with the
/// user's first initial on the right. Tap the circle to open Settings.
/// Long-press the wordmark still toggles race-day for dev.
struct BrandHeader: View {
    @EnvironmentObject private var state: WatchAppState
    @State private var showSettings = false
    var body: some View {
        HStack(spacing: 6) {
            HStack(spacing: 0) {
                Text("Turbo").foregroundStyle(Theme.fg)
                Text("Prep").foregroundStyle(Theme.primary)
            }
            .font(.system(.title3, design: .rounded, weight: .heavy))
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 1.5) {
                state.toggleRaceDayForDev()
            }
            Spacer(minLength: 4)
            Button {
                showSettings = true
            } label: {
                ZStack {
                    Circle()
                        .fill(Theme.primary)
                        .frame(width: 22, height: 22)
                    Text(state.userInitial)
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundStyle(Theme.bg)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open settings")
        }
        .sheet(isPresented: $showSettings) {
            WatchSettingsView()
                .environmentObject(state)
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
