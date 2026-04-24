import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var firestore = FirestoreService()
    @StateObject private var health = HealthKitService()

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Email", value: auth.currentUser?.email ?? "—")
                    LabeledContent("UID", value: auth.currentUser?.uid ?? "—")
                }
                Section("Health") {
                    switch health.authorization {
                    case .notRequested, .requesting:
                        Button {
                            Task { await health.requestAuthorization() }
                        } label: {
                            HStack {
                                Text("Connect Apple Health")
                                Spacer()
                                if health.authorization == .requesting {
                                    ProgressView()
                                }
                            }
                        }
                    case .denied:
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Health access denied")
                            Text("Enable in Settings → Privacy → Health → VeloForge")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    case .unavailable:
                        Text("HealthKit not available on this device")
                            .foregroundStyle(.secondary)
                    case .granted:
                        LabeledContent("Heart rate") {
                            if let bpm = health.latestHeartRate {
                                Text("\(bpm) bpm")
                            } else {
                                Text("—")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let at = health.latestHeartRateAt {
                            LabeledContent("Last sample") {
                                Text(at, style: .relative)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if let p = firestore.profile {
                    Section("Profile") {
                        LabeledContent("Year", value: p.yearLevel ?? "—")
                        LabeledContent("Tier", value: p.fitnessLevel ?? "—")
                        LabeledContent("Plan", value: p.activePlanId ?? "—")
                        LabeledContent("XP", value: p.totalXp.map(String.init) ?? "—")
                    }
                } else if firestore.lastError == nil {
                    Section { ProgressView("Loading profile…") }
                }
                if let err = firestore.lastError {
                    Section { Text(err).font(.footnote).foregroundStyle(.red) }
                }
                Section {
                    Button("Sign out", role: .destructive) { auth.signOut() }
                }
            }
            .navigationTitle("VeloForge")
            .task(id: auth.currentUser?.uid) {
                guard let uid = auth.currentUser?.uid else { return }
                await firestore.loadProfile(uid: uid)
                if health.authorization == .granted {
                    await health.refreshLatestHeartRate()
                }
            }
            .refreshable {
                guard let uid = auth.currentUser?.uid else { return }
                await firestore.loadProfile(uid: uid)
                if health.authorization == .granted {
                    await health.refreshLatestHeartRate()
                }
            }
        }
    }
}
