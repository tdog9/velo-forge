import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthService

    var body: some View {
        Group {
            if auth.currentUser != nil {
                HomeView()
            } else {
                AuthView()
            }
        }
        .animation(.default, value: auth.currentUser?.uid)
    }
}
