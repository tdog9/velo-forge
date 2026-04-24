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

    // Firestore data isn't available directly on watchOS — FirebaseFirestore
    // doesn't build for watchOS. Profile + workout data will flow from the
    // paired iPhone via WatchConnectivity (wired in a later milestone).
    var body: some View {
        List {
            Section("You") {
                Text(auth.currentUser?.email ?? "—").font(.footnote)
            }
            Section("Coming soon") {
                Text("Heart rate, workout session, and plan sync arrive once WatchConnectivity is wired.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
