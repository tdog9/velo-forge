import SwiftUI
@preconcurrency import WebKit

/// Hosts the deployed TurboPrep web app inside a WKWebView. The web bundle
/// handles sign-in, today/fitness/plans/leaderboard rendering, and Firestore
/// reads. Native code stays minimal: WatchConnectivity intake, HealthKit
/// queries, and any future iOS-only features bridged into the web via a
/// `tpNative` JS handler.
struct WebViewContainer: UIViewRepresentable {
    let url: URL
    var onWebLoaded: (() -> Void)? = nil

    func makeCoordinator() -> Coordinator {
        Coordinator(onWebLoaded: onWebLoaded)
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
        // .never lets the web's CSS env(safe-area-inset-*) own all spacing,
        // so the bottom nav reaches the home-indicator edge instead of the
        // system inserting an extra inset above it. The 16px-min input CSS
        // (in styles.css) and the zoom locks below handle the rest.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bouncesZoom = false
        webView.scrollView.minimumZoomScale = 1.0
        webView.scrollView.maximumZoomScale = 1.0
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 10/255, green: 11/255, blue: 15/255, alpha: 1)  // matches web --bg
        webView.scrollView.backgroundColor = webView.backgroundColor

        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
        // Pull-to-refresh: standard iOS gesture; reloads the web bundle.
        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor(red: 0xf9/255, green: 0x73/255, blue: 0x16/255, alpha: 1)
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        context.coordinator.refresh = refresh
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        weak var webView: WKWebView?
        weak var refresh: UIRefreshControl?
        let onWebLoaded: (() -> Void)?
        private var didFireLoaded = false

        init(onWebLoaded: (() -> Void)?) {
            self.onWebLoaded = onWebLoaded
            super.init()
        }

        @objc func pullToRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
        }

        // Web → native: handle posted messages from the web app.
        func userContentController(_ uc: WKUserContentController, didReceive msg: WKScriptMessage) {
            guard let body = msg.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            switch type {
            case "ping":
                // No-op handshake. Kept so the bridge is testable from JS.
                break
            case "watch-state":
                // Web has gathered a state snapshot for the Watch. Forward it
                // via WCSession so the Watch's WatchAppState updates.
                if let state = body["state"] as? [String: Any] {
                    print("📲 [bridge] iPhone received watch-state — keys: \(state.keys.sorted())")
                    Task { @MainActor in
                        ConnectivityService.shared.pushStateToWatch(state)
                    }
                } else {
                    print("📲 [bridge] watch-state arrived but no `state` key")
                }
            default:
                break
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            self.webView = webView
            refresh?.endRefreshing()
            if !didFireLoaded {
                didFireLoaded = true
                onWebLoaded?()
            }
            // Wire the relays used to forward Watch payloads into the web.
            Task { @MainActor in
                WatchWorkoutReceiver.jsRelay = { [weak webView] payload in
                    guard let webView,
                          let data = try? JSONSerialization.data(withJSONObject: payload),
                          let json = String(data: data, encoding: .utf8) else { return }
                    let js = "if (window.tpNative && typeof window.tpNative.onRaceDayLaps === 'function') { window.tpNative.onRaceDayLaps(\(json)); }"
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
                WatchWorkoutReceiver.jsHealthRelay = { [weak webView] summary in
                    guard let webView,
                          let data = try? JSONSerialization.data(withJSONObject: summary),
                          let json = String(data: data, encoding: .utf8) else { return }
                    let js = "if (window.tpNative && typeof window.tpNative.onHealthSummary === 'function') { window.tpNative.onHealthSummary(\(json)); }"
                    webView.evaluateJavaScript(js, completionHandler: nil)
                }
            }
        }

        // Route navigation: same-origin stays in-app, system schemes open via
        // UIApplication, external HTTP(S) links (race results, YouTube,
        // Strava, etc.) open in Safari so the user has full browser chrome
        // (back, share, AirDrop) instead of a captive WebView.
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
            // External http(s) links — anything outside turboprep.app — open
            // in Safari. Triggered by user taps (.linkActivated). Programmatic
            // navigations and same-origin navs stay in-app.
            if navigationAction.navigationType == .linkActivated,
               let host = url.host?.lowercased(),
               !host.contains("turboprep.app"),
               (url.scheme == "http" || url.scheme == "https") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // WKWebView creates new windows for target=_blank and window.open. Without
        // this handler, those clicks silently do nothing. Route them through Safari.
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                UIApplication.shared.open(url)
            }
            return nil
        }

        // Surface JS alerts as native iOS alerts so they look right on iPhone.
        func webView(_ webView: WKWebView,
                     runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            present(alert)
        }

        // confirm() — without this, JS confirm() calls return false silently
        // and admin/coach actions that gate behind confirmation fail.
        func webView(_ webView: WKWebView,
                     runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK",     style: .default) { _ in completionHandler(true)  })
            present(alert)
        }

        // prompt() — same idea, with a text field. Used by AI plan editor.
        func webView(_ webView: WKWebView,
                     runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            alert.addTextField { tf in tf.text = defaultText }
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
            alert.addAction(UIAlertAction(title: "OK",     style: .default) { _ in
                completionHandler(alert.textFields?.first?.text)
            })
            present(alert)
        }

        private func present(_ alert: UIAlertController) {
            // keyWindow is deprecated in iOS 15+; walk windows instead so we
            // pick up the active scene's primary window without relying on
            // the deprecated property.
            let root = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first(where: { $0.isKeyWindow })?.rootViewController
                ?? UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .first?.rootViewController
            root?.present(alert, animated: true)
        }
    }
}
