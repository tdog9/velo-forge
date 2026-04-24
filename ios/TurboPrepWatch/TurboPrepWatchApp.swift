import SwiftUI

@main
struct TurboPrepWatchApp: App {
    @StateObject private var auth = AuthService()

    init() {
        FirebaseBootstrap.configure()
    }

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(auth)
        }
    }
}
