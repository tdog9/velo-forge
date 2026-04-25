import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var auth: AuthService

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()
                if auth.currentUser != nil {
                    WatchHomeView()
                } else {
                    WatchSignedOutView()
                }
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

struct WatchHomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var health = HealthKitService()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                BrandHeader()
                heartRateCard
                rideButton
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
                            .font(.system(size: 30, weight: .black, design: .rounded))
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

    private var rideButton: some View {
        NavigationLink {
            WorkoutSessionView()
        } label: {
            HStack {
                Image(systemName: "bicycle")
                    .font(.headline)
                Text("Start ride")
                    .font(.system(.body, weight: .bold))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .opacity(0.6)
            }
            .foregroundStyle(Theme.primaryFg)
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(Theme.primary)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
        }
        .buttonStyle(.plain)
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
        .padding(.top, 4)
    }
}
