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
    @StateObject private var firestore = FirestoreService()

    var body: some View {
        List {
            Section("You") {
                Text(auth.currentUser?.email ?? "—").font(.footnote)
            }
            if let p = firestore.profile {
                Section("Plan") {
                    Text(p.activePlanId ?? "No active plan").font(.footnote)
                    if let xp = p.totalXp {
                        LabeledContent("XP") { Text("\(xp)") }
                    }
                }
            }
        }
        .task(id: auth.currentUser?.uid) {
            guard let uid = auth.currentUser?.uid else { return }
            await firestore.loadProfile(uid: uid)
        }
    }
}
