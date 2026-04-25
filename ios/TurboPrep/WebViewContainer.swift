import SwiftUI
@preconcurrency import WebKit

/// Hosts the deployed TurboPrep web app inside a WKWebView. The web bundle
/// handles sign-in, today/fitness/plans/leaderboard rendering, and Firestore
/// reads. Native code stays minimal: WatchConnectivity intake, HealthKit
/// queries, and any future iOS-only features bridged into the web via a
/// `tpNative` JS handler.
struct WebViewContainer: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()  // persist cookies + localStorage so auth survives launches
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        // Native bridge: web can post messages via window.webkit.messageHandlers.tpNative.postMessage(...)
        config.userContentController.add(context.coordinator, name: "tpNative")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 10/255, green: 11/255, blue: 15/255, alpha: 1)  // matches web --bg
        webView.scrollView.backgroundColor = webView.backgroundColor

        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        // Web → native: handle posted messages from the web app.
        func userContentController(_ uc: WKUserContentController, didReceive msg: WKScriptMessage) {
            guard let body = msg.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            switch type {
            case "ping":
                // No-op handshake. Kept so the bridge is testable from JS.
                break
            default:
                break
            }
        }

        // Open external links (mailto, tel, App Store) in Safari/system handler.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow); return
            }
            if let scheme = url.scheme, ["mailto", "tel", "sms", "itms-apps"].contains(scheme) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // Surface JS alerts as native iOS alerts so they look right on iPhone.
        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
                .first?.present(alert, animated: true)
        }
    }
}
