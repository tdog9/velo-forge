import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var state = WatchAppState.shared

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            if auth.currentUser != nil {
                TabView {
                    WatchTodayView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                    WatchRecordView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                    WatchFitnessView()
                        .containerBackground(Theme.bg.gradient, for: .tabView)
                }
                .tabViewStyle(.verticalPage)
                .environmentObject(state)
            } else {
                WatchSignedOutView()
            }
        }
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
struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 0) {
            Text("Turbo").foregroundStyle(Theme.fg)
            Text("Prep").foregroundStyle(Theme.primary)
        }
        .font(.system(.title3, design: .rounded, weight: .heavy))
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
