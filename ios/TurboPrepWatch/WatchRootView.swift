import SwiftUI

struct WatchRootView: View {
    @StateObject private var state = WatchAppState.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            // SIGN-IN GATE
            // Two paths to skip the gate:
            //   1) iPhoneSignedIn — live snapshot says iPhone has a user.
            //   2) watchPaired — user already paired this Watch (locally
            //      persisted in UserDefaults). Stays true forever, so a
            //      backgrounded / unreachable iPhone can't drag the gate
            //      back up after first pair.
            if !state.iPhoneSignedIn && !state.watchPaired {
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
        .onChange(of: scenePhase) { _, newPhase in
            // Force-refresh race-day state the moment the Watch wakes.
            // The 15s poll cadence is fine for steady-state but feels
            // sluggish when the rider raises their wrist after the
            // coach has just activated race-day. Free; race conditions
            // (overlapping fetches) are guarded inside pokeNow.
            if newPhase == .active {
                WatchRaceDayPoller.shared.pokeNow()
            }
        }
    }
}

/// Full-screen gate shown when the iPhone hasn't reported a signed-in
/// user. The Watch can't sign in directly — it just instructs the user
/// to open the iPhone app, with a Refresh button that pings the iPhone
/// via WCSession to re-publish state.
struct WatchSignInGate: View {
    @State private var refreshing = false
    @State private var lastTry: Date?
    @State private var pairCode: String = ""
    @State private var lastPaired: String = UserDefaults.standard.string(forKey: "tp_watch_last_paired_code") ?? ""
    @State private var pairError: String? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack(spacing: 0) {
                    Text("Turbo").foregroundStyle(Theme.fg)
                    Text("Prep").foregroundStyle(Theme.primary)
                }
                .font(.system(.title3, design: .rounded, weight: .heavy))
                .padding(.top, 4)

                Image(systemName: "iphone")
                    .font(.system(size: 30))
                    .foregroundStyle(Theme.primary)

                Text("Connect to iPhone")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Theme.fg)
                    .multilineTextAlignment(.center)

                if !lastPaired.isEmpty {
                    Text("Last paired with code \(lastPaired)")
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.fg.opacity(0.55))
                        .multilineTextAlignment(.center)
                }

                // Pair code entry — primary path. User reads the 6-digit
                // code from Profile → Connect Watch on the iPhone, types
                // it here, taps Pair. iPhone validates and pushes state.
                VStack(spacing: 6) {
                    Text("Enter 6-digit code from iPhone Profile")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Theme.fg.opacity(0.6))
                        .multilineTextAlignment(.center)
                    TextField("000000", text: $pairCode)
                        .multilineTextAlignment(.center)
                        .font(.system(size: 22, weight: .heavy, design: .monospaced))
                        .foregroundStyle(Theme.primary)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 10)
                        .background(Theme.fg.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .onChange(of: pairCode) { _, newValue in
                            // Trim to digits only, max 8 chars.
                            let digits = newValue.filter { $0.isNumber }
                            if digits != newValue { pairCode = String(digits.prefix(8)) }
                        }
                    Button {
                        let code = pairCode.filter { $0.isNumber }
                        guard code.count >= 4 else { return }
                        refreshing = true
                        lastTry = Date()
                        // PRIMARY path: hit the Netlify function
                        // directly — fully iPhone-independent. On
                        // success the service updates WatchAppState
                        // (display name, email, signed-in flag).
                        WatchPairingService.shared.claim(code: code) { result in
                            refreshing = false
                            switch result {
                            case .success:
                                WatchAppState.shared.setWatchPaired(code: code)
                                UserDefaults.standard.set(code, forKey: "tp_watch_last_paired_code")
                                lastPaired = code
                            case .failure(let err):
                                pairError = err.localizedDescription
                            }
                        }
                        // BEST-EFFORT secondary: also nudge the iPhone
                        // over WCSession so any cached state pushes too.
                        // Failure here doesn't matter — Netlify call is
                        // the source of truth now.
                        ConnectivityService.shared.sendPairAttempt(code: code)
                    } label: {
                        Text(refreshing ? "Paired ✓" : "Pair")
                            .font(.system(size: 12, weight: .heavy))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(pairCode.count >= 4 ? Theme.primary : Theme.fg.opacity(0.15))
                            .foregroundStyle(pairCode.count >= 4 ? Theme.bg : Theme.fg.opacity(0.4))
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(pairCode.count < 4 || refreshing)
                    if let err = pairError, !err.isEmpty {
                        Text(err)
                            .font(.system(size: 9))
                            .foregroundStyle(Color.red)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.vertical, 4)

                Divider().background(Theme.fg.opacity(0.1))

                Text("Or just sign in on iPhone — Watch syncs automatically.")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.fg.opacity(0.55))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Button {
                    refreshing = true
                    lastTry = Date()
                    ConnectivityService.shared.requestSnapshot()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        refreshing = false
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10, weight: .heavy))
                        Text("Refresh from iPhone")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 7)
                    .background(Theme.fg.opacity(0.08))
                    .foregroundStyle(Theme.fg)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(refreshing)

                if let lastTry, Date().timeIntervalSince(lastTry) > 8 {
                    Text("iPhone not reachable. Both devices need to be unlocked.")
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.fg.opacity(0.55))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .onAppear {
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
