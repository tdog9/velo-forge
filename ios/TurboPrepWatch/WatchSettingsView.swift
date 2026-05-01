import SwiftUI

/// Settings sheet on the Watch — opened from the BrandHeader avatar
/// circle. Shows the signed-in user's name + email (mirrored from the
/// iPhone via WCSession), a quick tutorial, and a sign-out hint.
/// Auth lives on the iPhone, so the Watch only displays state — there
/// are no editable fields here.
struct WatchSettingsView: View {
    @EnvironmentObject private var state: WatchAppState
    @Environment(\.dismiss) private var dismiss
    @State private var showTutorial = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                profileBlock
                divider
                infoSection
                divider
                tutorialButton
                divider
                signedInState
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .navigationTitle("Settings")
        .sheet(isPresented: $showTutorial) {
            WatchTutorialView()
        }
    }

    private var profileBlock: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Theme.primary)
                    .frame(width: 36, height: 36)
                Text(state.userInitial)
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(Theme.bg)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(state.iPhoneUserDisplayName ?? "Not signed in")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Theme.fg)
                    .lineLimit(1)
                if let email = state.iPhoneUserEmail, !email.isEmpty {
                    Text(email)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.fg.opacity(0.6))
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeader("App")
            row("Race Day", value: state.raceDayActive ? "ACTIVE" : "Off",
                color: state.raceDayActive ? Theme.phasePeak : Theme.fg.opacity(0.6))
            if let phase = state.racePhase {
                row("Phase", value: phase.label, color: Theme.fg)
            }
            row("Past stints", value: "\(state.pastStints.count)", color: Theme.fg)
            let pending = state.pastStints.filter { !$0.synced }.count
            if pending > 0 {
                row("Pending sync", value: "\(pending)", color: Theme.phasePeak)
            }
        }
    }

    private var tutorialButton: some View {
        Button {
            showTutorial = true
        } label: {
            HStack {
                Image(systemName: "book.fill").foregroundStyle(Theme.primary)
                Text("How to use TurboPrep Watch")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.fg)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.fg.opacity(0.5))
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 10)
            .background(Theme.fg.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private var signedInState: some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeader("Sign-in")
            if state.iPhoneSignedIn {
                Text("Signed in via iPhone.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.fg.opacity(0.7))
            } else if state.watchPaired {
                Text("Paired with iPhone (code \(state.pairedWithCode)). User data syncs when iPhone is reachable.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.fg.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Open TurboPrep on your iPhone to sign in. The Watch mirrors the iPhone's auth.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.fg.opacity(0.7))
                    .fixedSize(horizontal: false, vertical: true)
            }
            if state.watchPaired {
                Button {
                    state.clearWatchPaired()
                } label: {
                    HStack {
                        Image(systemName: "iphone.slash").font(.system(size: 10, weight: .heavy))
                        Text("Unpair this Watch")
                            .font(.system(size: 11, weight: .heavy))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.red.opacity(0.15))
                    .foregroundStyle(Color.red)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.fg.opacity(0.08))
            .frame(height: 1)
            .padding(.vertical, 2)
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .heavy))
            .tracking(0.6)
            .foregroundStyle(Theme.fg.opacity(0.5))
    }

    private func row(_ label: String, value: String, color: Color) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.fg.opacity(0.75))
            Spacer(minLength: 0)
            Text(value)
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(color)
        }
    }
}

/// Lightweight tutorial — three short pages explaining the Watch's role
/// as an extension of the iPhone app.
struct WatchTutorialView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var page: Int = 0

    private let pages: [(String, String, String)] = [
        ("waveform.path.ecg",
         "Live HR + lap times",
         "Tap RECORD on the Watch to start a workout. Heart rate streams from the Watch and laps record locally."),
        ("flag.checkered.2.crossed",
         "Race-day mode",
         "When your coach starts race day, the Watch locks to the lap timer. Tap the screen to record laps. Past stints save automatically."),
        ("link",
         "Synced with iPhone",
         "The Watch follows what the iPhone is doing. Sign in on the iPhone and the Watch picks up your profile, plan, and race state via WatchConnectivity.")
    ]

    var body: some View {
        VStack(spacing: 8) {
            TabView(selection: $page) {
                ForEach(0..<pages.count, id: \.self) { i in
                    let p = pages[i]
                    VStack(spacing: 10) {
                        Image(systemName: p.0)
                            .font(.system(size: 32))
                            .foregroundStyle(Theme.primary)
                        Text(p.1)
                            .font(.system(size: 14, weight: .heavy))
                            .foregroundStyle(Theme.fg)
                            .multilineTextAlignment(.center)
                        Text(p.2)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.fg.opacity(0.75))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 14)
                    .tag(i)
                }
            }
            .tabViewStyle(.page)
            Button(page == pages.count - 1 ? "Done" : "Next") {
                if page == pages.count - 1 { dismiss() } else { page += 1 }
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
        }
        .navigationTitle("How it works")
    }
}
