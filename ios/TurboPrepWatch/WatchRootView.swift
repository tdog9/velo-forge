import SwiftUI

struct WatchRootView: View {
    @StateObject private var state = WatchAppState.shared

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            // SIGN-IN GATE
            // The Watch can't authenticate on its own (no Firebase SDK
            // on watchOS); auth lives on the iPhone and mirrors via
            // WCSession. If the iPhone hasn't reported a signed-in
            // user, replace the entire UI with a clear "open iPhone to
            // sign in" gate + Refresh button (which pings the iPhone).
            if !state.iPhoneSignedIn {
                WatchSignInGate()
            } else if state.raceDayActive {
                // RACE-MODE LOCK
                // When the iPhone (or the Dev controls) flips
                // raceDayActive to true, the Watch collapses to ONLY
                // the lap-timer view so the rider can't swipe to
                // Today / Fitness / Dev mid-stint.
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

/// Full-screen gate shown when the iPhone hasn't reported a signed-in
/// user. The Watch can't sign in directly — it just instructs the user
/// to open the iPhone app, with a Refresh button that pings the iPhone
/// via WCSession to re-publish state.
struct WatchSignInGate: View {
    @State private var refreshing = false
    @State private var lastTry: Date?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                HStack(spacing: 0) {
                    Text("Turbo").foregroundStyle(Theme.fg)
                    Text("Prep").foregroundStyle(Theme.primary)
                }
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .padding(.top, 6)
                Image(systemName: "iphone")
                    .font(.system(size: 36))
                    .foregroundStyle(Theme.primary)
                    .padding(.top, 4)
                Text("Sign in on your iPhone")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Theme.fg)
                    .multilineTextAlignment(.center)
                Text("The Watch follows your iPhone. Open TurboPrep on your phone and sign in there.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.fg.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 6)
                Button {
                    refreshing = true
                    lastTry = Date()
                    ConnectivityService.shared.requestSnapshot()
                    // Visual stop after 2s — gives the iPhone time to
                    // respond and the Watch state to actually update.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        refreshing = false
                    }
                } label: {
                    HStack(spacing: 6) {
                        if refreshing {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 11, weight: .heavy))
                        }
                        Text(refreshing ? "Refreshing…" : "Refresh")
                            .font(.system(size: 12, weight: .heavy))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Theme.primary)
                    .foregroundStyle(Theme.bg)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(refreshing)
                if let lastTry, Date().timeIntervalSince(lastTry) > 8 {
                    Text("iPhone not reachable. Make sure both devices are unlocked and on the same Wi-Fi.")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.fg.opacity(0.55))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .onAppear {
            // Auto-fire one refresh on appear so the user doesn't have
            // to tap if the iPhone is already signed in but state
            // hadn't propagated yet (e.g. fresh app install).
            ConnectivityService.shared.requestSnapshot()
        }
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
