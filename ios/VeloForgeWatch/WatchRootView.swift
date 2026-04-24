import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var auth: AuthService

    var body: some View {
        NavigationStack {
            if auth.currentUser != nil {
                WatchHomeView()
            } else {
                WatchSignedOutView()
            }
        }
    }
}

struct WatchSignedOutView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("VeloForge").font(.headline)
                Text("Sign in on your iPhone first. Watch-side sign-in will arrive once we wire WatchConnectivity.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}

struct WatchHomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var health = HealthKitService()

    var body: some View {
        List {
            Section("You") {
                Text(auth.currentUser?.email ?? "—").font(.footnote)
            }
            Section {
                NavigationLink {
                    WorkoutSessionView()
                } label: {
                    Label("Start ride", systemImage: "bicycle")
                }
            }
            Section("Heart rate") {
                switch health.authorization {
                case .notRequested, .requesting:
                    Button("Allow Health") {
                        Task { await health.requestAuthorization() }
                    }
                    .disabled(health.authorization == .requesting)
                case .denied:
                    Text("Open Watch app on iPhone → enable Health permissions.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                case .unavailable:
                    Text("HealthKit unavailable")
                        .foregroundStyle(.secondary)
                case .granted:
                    if let bpm = health.latestHeartRate {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text("\(bpm)").font(.system(size: 36, weight: .bold))
                            Text("bpm").foregroundStyle(.secondary)
                        }
                    } else {
                        Text("Waiting for sample…").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
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
        .onDisappear {
            health.stopHeartRateStreaming()
        }
    }
}
