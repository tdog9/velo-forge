import SwiftUI

private let turboPrepURL = URL(string: "https://turboprep.app")!

/// iPhone shell — hosts the deployed web app inside a WKWebView so the iOS
/// app is visually + functionally identical to the web product. Native
/// SwiftUI screens (AuthView/HomeView) are kept in the source tree but no
/// longer used as the main UI; they remain available for future native
/// overlays (e.g. a phone-only HealthKit permission sheet).
struct RootView: View {
    @State private var splashVisible = true

    var body: some View {
        ZStack {
            WebViewContainer(url: turboPrepURL) {
                // didFinish callback — fade the splash with a slight delay so
                // the first paint of the web app is visible underneath.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    splashVisible = false
                }
            }
            .ignoresSafeArea(.container, edges: .bottom)
            .background(Color(red: 10/255, green: 11/255, blue: 15/255))
            SplashOverlay(visible: $splashVisible)
        }
    }
}
