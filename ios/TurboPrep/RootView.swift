import SwiftUI

private let turboPrepURL = URL(string: "https://turboprep.app")!

/// iPhone shell — hosts the deployed web app inside a WKWebView so the iOS
/// app is visually + functionally identical to the web product. Native
/// SwiftUI screens (AuthView/HomeView) are kept in the source tree but no
/// longer used as the main UI; they remain available for future native
/// overlays (e.g. a phone-only HealthKit permission sheet).
struct RootView: View {
    @State private var splashVisible = true
    /// Mutated when a Universal Link arrives so WebViewContainer reloads at
    /// the deep-linked path instead of the home screen.
    @State private var loadURL: URL = turboPrepURL

    var body: some View {
        ZStack {
            WebViewContainer(url: loadURL) {
                // didFinish callback — fade the splash with a slight delay so
                // the first paint of the web app is visible underneath.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    splashVisible = false
                }
            }
            // Edge-to-edge: web bundle handles status-bar + home-indicator
            // padding via env(safe-area-inset-*).
            .ignoresSafeArea()
            .background(Color(red: 10/255, green: 11/255, blue: 15/255))
            SplashOverlay(visible: $splashVisible)
        }
        .onAppear {
            // Safety net — if the WebView never reports didFinish (DNS issue,
            // load timeout, server down), fade the splash anyway after 12s
            // so the user can pull-to-refresh instead of staring at a frozen
            // screen.
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) {
                if splashVisible { splashVisible = false }
            }
        }
        // Universal Links — when a https://turboprep.app/* link is tapped
        // anywhere on iOS (Messages, Mail, Safari long-press), iOS hands
        // us the URL via NSUserActivity and we navigate the WebView to
        // that exact path inside the app.
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            guard let url = activity.webpageURL,
                  let host = url.host?.lowercased(),
                  host.contains("turboprep.app") else { return }
            loadURL = url
        }
    }
}
