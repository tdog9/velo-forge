import SwiftUI

@main
struct VeloForgeApp: App {
    @StateObject private var auth = AuthService()

    init() {
        FirebaseBootstrap.configure()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
        }
    }
}
