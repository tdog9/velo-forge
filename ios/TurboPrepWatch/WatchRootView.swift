import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var state = WatchAppState.shared

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            // Show the main UI as soon as EITHER the native AuthService has a
            // user OR the iPhone has reported the user is signed in. The
            // iPhone path is the one that works on simulator and on real
            // devices without paid-team keychain sharing.
            if auth.currentUser != nil || state.iPhoneSignedIn {
                TabView {
                    WatchTodayView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                    WatchRecordView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                    WatchFitnessView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                }
                .tabViewStyle(.verticalPage)
            } else {
                WatchSignedOutView()
            }
        }
        .environmentObject(state)
        .preferredColorScheme(.dark)
    }
}

struct WatchSignedOutView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                BrandHeader()
                ThemeCard {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Sign in on iPhone")
                            .font(.system(.footnote, weight: .semibold))
                            .foregroundStyle(Theme.fg)
                        Text("Open TurboPrep on your phone and sign in. The Watch will pick up the session automatically.")
                            .font(.system(.caption2))
                            .foregroundStyle(Theme.mutedFg)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

/// "TurboPrep" wordmark — split-color matches the web header treatment.
/// Long-press toggles race-day dev mode locally on the Watch (until the
/// iPhone bridge lands a real race-day status push).
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
        case .taper:     return Theme.phaseTaper
        case .raceWeek:  return Theme.phaseRaceWeek
        }
    }
}
