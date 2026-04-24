import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthService
    @StateObject private var firestore = FirestoreService()

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Email", value: auth.currentUser?.email ?? "—")
                    LabeledContent("UID", value: auth.currentUser?.uid ?? "—")
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
            }
            .refreshable {
                guard let uid = auth.currentUser?.uid else { return }
                await firestore.loadProfile(uid: uid)
            }
        }
    }
}
