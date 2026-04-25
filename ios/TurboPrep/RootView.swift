import SwiftUI

private let turboPrepURL = URL(string: "https://turboprep.app")!

/// iPhone shell — hosts the deployed web app inside a WKWebView so the iOS
/// app is visually + functionally identical to the web product. Native
/// SwiftUI screens (AuthView/HomeView) are kept in the source tree but no
/// longer used as the main UI; they remain available for future native
/// overlays (e.g. a phone-only HealthKit permission sheet).
struct RootView: View {
    var body: some View {
        WebViewContainer(url: turboPrepURL)
            .ignoresSafeArea(.container, edges: .bottom)
            .background(Color(red: 10/255, green: 11/255, blue: 15/255))
    }
}
